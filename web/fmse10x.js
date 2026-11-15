/* FMS engineering – item 10 part A engine: device FB library (unit-test semantics), FB_CmdIf, alarm manager, command matrix.
 * Rules = EX10A._rules of tools/fmse/examples/item10a_examples.json, exactly (same as tools/fmse/*.py and tools/fmse/plc_lib/*.st).
 * One tick = 100 ms, every FB is called once per tick; events change inputs BEFORE the call; log = outputs that changed.
 * FB_MotorDol and FB_AnalogIn keep the item 9 rules: they are imported from fmse9x.js, not duplicated. */
import { EX10A } from "./fmse10_data.js";
import { motor, analog, limits, M_ALM, EX9, codegen, CODES, MODS, PAT } from "./fmse9x.js";
export { EX10A, motor, analog, limits, M_ALM, EX9, codegen, CODES, MODS, PAT };

export const DT = 100;
const N = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v);     // BOOL TRUE == 1 as in Python / IEC (inputs '1' are BOOL)

class FB {
  constructor(cfg) {
    const C = this.constructor;
    this.i = Object.assign({}, C.IN); this.o = Object.assign({}, C.OUT); this.c = Object.assign({}, C.CFG, cfg || {}); this.init();
  }
  init() {}
  edge(n) { const k = "_p_" + n, e = !!this.i[n] && !this[k]; this[k] = this.i[n]; return e; }
}

class Sensor extends FB {
  static IN = { xOn: false }; static OUT = { xValue: false }; static CFG = { tOn_ms: 0, tOff_ms: 0 };
  init() { this.cnt = 0; }
  run() {
    const x = !!this.i.xOn;
    if (x !== !!this.o.xValue) { this.cnt += 1; if (this.cnt * DT >= (x ? this.c.tOn_ms : this.c.tOff_ms)) { this.o.xValue = x; this.cnt = 0; } }
    else this.cnt = 0;
  }
}

class Valve extends FB {
  static IN = { xPosA: true, xPosB: false, xCmdB: false, xEnable: true, xReset: false };
  static CFG = { tMove_ms: 2000, tLost_ms: 300, tBoth_ms: 200 };
  static NSOL = 1;
  init() {
    this.o = this.constructor.NSOL === 1 ? { qSol: false } : { qSolA: false, qSolB: false };
    Object.assign(this.o, { xAtA: false, xAtB: false, xBusy: false, xError: false, iAlarm: 0 });
    this.prevCmd = null; this.moving = false; this.n = 0; this.nl = 0; this.nb = 0;
  }
  run() {
    const i = this.i, o = this.o, c = this.c, rst = this.edge("xReset");
    const pa = !!i.xPosA, pb = !!i.xPosB, cmd = !!i.xCmdB, en = !!i.xEnable;
    const atA = pa && !pb, atB = pb && !pa, reached = cmd ? atB : atA;
    if (o.xError && rst && !(pa && pb)) { o.xError = false; o.iAlarm = 0; this.moving = !reached; this.n = 0; this.nl = 0; }
    if (this.prevCmd === null || cmd !== this.prevCmd) { this.moving = true; this.n = 0; }
    this.nb = pa && pb ? this.nb + 1 : 0;
    if (!o.xError) {
      if (this.nb * DT >= c.tBoth_ms) { o.xError = true; o.iAlarm = 3; this.moving = false; }
      else if (this.moving) {
        this.nl = 0;
        if (en) { this.n += 1; if (reached) this.moving = false; else if (this.n * DT >= c.tMove_ms) { o.xError = true; o.iAlarm = 1; this.moving = false; } }
      } else if (en) { this.nl = !reached ? this.nl + 1 : 0; if (this.nl * DT >= c.tLost_ms) { o.xError = true; o.iAlarm = 2; } }
      else this.nl = 0;
    }
    if (this.constructor.NSOL === 1) o.qSol = cmd && en; else { o.qSolB = cmd && en; o.qSolA = !cmd && en; }
    o.xAtA = atA; o.xAtB = atB; o.xBusy = this.moving && !o.xError; this.prevCmd = cmd;
  }
}
class Valve1 extends Valve { static NSOL = 1; }
class Valve2 extends Valve { static NSOL = 2; }

class DriveSto extends FB {
  static IN = { xReady: false, xFault: false, xSto: true, xCmdRun: false, xReset: false };
  static OUT = { wCtrl: 0, iState: 0, xWarn: false, xError: false, iAlarm: 0 };
  run() {
    const i = this.i, o = this.o, rst = this.edge("xReset"); let s = o.iState, ack = false;
    if (i.xFault && s !== 9) { s = 9; o.iAlarm = 1; }
    else if (s === 0) { if (i.xReady && !i.xSto) s = 1; }
    else if (s === 1) { if (i.xSto || !i.xReady) s = 0; else if (i.xCmdRun) s = 2; }
    else if (s === 2) { if (i.xSto) s = 0; else if (!i.xReady) { s = 9; o.iAlarm = 3; } else if (!i.xCmdRun) s = 1; }
    else if (s === 9) { if (rst && !i.xFault) { s = 0; o.iAlarm = 0; ack = true; } }
    o.iState = s; o.xError = s === 9; o.xWarn = !!i.xCmdRun && !!i.xSto;
    o.wCtrl = (i.xSto ? 0 : 1) | (s === 2 ? 2 : 0) | (ack ? 128 : 0);
  }
}

class Heater extends FB {
  static IN = { xOnFb: false, xOverTemp: false, rTemp: 20.0, xTempGood: true, xEnable: false, rSp: 60.0, xReset: false };
  static OUT = { qOn: false, xError: false, iAlarm: 0 }; static CFG = { rHyst: 2.0, tFb_ms: 500 };
  init() { this.heat = false; this.nfb = 0; this.nw = 0; }
  run() {
    const i = this.i, o = this.o, c = this.c, rst = this.edge("xReset");
    if (o.xError && rst && !i.xOverTemp && (i.xTempGood || !i.xEnable) && !i.xOnFb) { o.xError = false; o.iAlarm = 0; this.nfb = 0; this.nw = 0; }
    if (!o.xError) { if (i.xOverTemp) { o.xError = true; o.iAlarm = 1; } else if (i.xEnable && !i.xTempGood) { o.xError = true; o.iAlarm = 3; } }
    const T = N(i.rTemp), SP = N(i.rSp);
    if (!i.xEnable || o.xError) this.heat = false; else if (T <= SP - c.rHyst) this.heat = true; else if (T >= SP) this.heat = false;
    let q = this.heat;
    this.nfb = q && !i.xOnFb ? this.nfb + 1 : 0; this.nw = !q && i.xOnFb ? this.nw + 1 : 0;
    if (!o.xError && this.nfb * DT >= c.tFb_ms) { o.xError = true; o.iAlarm = 2; }
    if (!o.xError && this.nw * DT >= c.tFb_ms) { o.xError = true; o.iAlarm = 4; }
    if (o.xError) { this.heat = false; q = false; }
    o.qOn = q;
  }
}

class PushButton extends FB {
  static IN = { xPb: false, iLampMode: 0 }; static OUT = { qLamp: false, xPressed: false, xClick: false };
  init() { this.c_ = 0; }
  run() {
    const blink = Math.floor(this.c_ / 5) % 2 === 0; this.c_ += 1; const m = N(this.i.iLampMode);
    this.o.qLamp = m === 1 || (m === 2 && blink); this.o.xClick = this.edge("xPb"); this.o.xPressed = !!this.i.xPb;
  }
}

class SignalTower extends FB {
  static IN = { iState: 2, iAlarmClass: 0, xHornAck: false }; static OUT = { qRed: false, qYellow: false, qGreen: false, qBuzzer: false };
  init() { this.c_ = 0; this.prevCls = 0; this.horn = false; }
  run() {
    const i = this.i, o = this.o, blink = Math.floor(this.c_ / 5) % 2 === 0; this.c_ += 1;
    const s = N(i.iState), a = N(i.iAlarmClass), ack = this.edge("xHornAck");
    o.qRed = a === 1 || [8, 9].includes(s);
    o.qYellow = [2, 3].includes(a) || [2, 5, 11].includes(s);
    o.qGreen = [3, 6, 12, 14, 16].includes(s) || ([4, 17].includes(s) && blink);
    if ([1, 2].includes(a) && a !== this.prevCls) this.horn = true;
    if (ack || a === 0) this.horn = false;
    this.prevCls = a; o.qBuzzer = this.horn;
  }
}

class HandshakeHw extends FB {
  static IN = { xReady: false, xBusy: false, xDone: false, xFault: false, xStart: false, xReset: false };
  static OUT = { qRequest: false, qAck: false, qEnable: false, qReset: false, iStep: 0, xDoneOut: false, xError: false, iAlarm: 0 };
  static CFG = { tHs_ms: 2000, tJob_ms: 10000 };
  init() { this.n = 0; }
  run() {
    const i = this.i, o = this.o, c = this.c, rst = this.edge("xReset"); o.qReset = rst; o.xDoneOut = false; let st = o.iStep;
    if (o.xError) { if (rst && !i.xFault) { o.xError = false; o.iAlarm = 0; st = 0; } }
    else if (i.xFault && st !== 0) { o.xError = true; o.iAlarm = 4; }
    else if (st === 0) { if (i.xStart && i.xReady) { st = 10; this.n = 0; } }
    else if (st === 10) { this.n += 1; if (i.xBusy) { st = 20; this.n = 0; } else if (this.n * DT >= c.tHs_ms) { o.xError = true; o.iAlarm = 1; } }
    else if (st === 20) { this.n += 1; if (i.xDone) { st = 30; this.n = 0; } else if (this.n * DT >= c.tJob_ms) { o.xError = true; o.iAlarm = 2; } }
    else if (st === 30) { this.n += 1; if (!i.xDone) { st = 0; o.xDoneOut = true; } else if (this.n * DT >= c.tHs_ms) { o.xError = true; o.iAlarm = 3; } }
    o.iStep = st; const e = o.xError;
    o.qRequest = (st === 10 || st === 20) && !e; o.qEnable = (st === 10 || st === 20) && !e; o.qAck = st === 30 && !e;
  }
}

class Feeder extends FB {
  static IN = { xSupplyOn: true }; static OUT = { xOk: false, iAlarm: 0 }; static CFG = { tDelay_ms: 200 };
  init() { this.n = 0; }
  run() { this.n = !this.i.xSupplyOn ? this.n + 1 : 0; this.o.xOk = !!this.i.xSupplyOn; this.o.iAlarm = this.n * DT >= this.c.tDelay_ms ? 1 : 0; }
}

class Ups extends FB {
  static IN = { xUpsOk: true, xOnBattery: false }; static OUT = { xShutdownReq: false, iAlarm: 0 }; static CFG = { tBuffer_ms: 5000 };
  init() { this.n = 0; }
  run() {
    const i = this.i, o = this.o; this.n = i.xOnBattery ? this.n + 1 : 0;
    o.xShutdownReq = this.n * DT >= this.c.tBuffer_ms; o.iAlarm = !i.xUpsOk ? 1 : i.xOnBattery ? 2 : 0;
  }
}

class Safe2Ch extends FB {
  static IN = { xCh1: false, xCh2: false, xReset: false }; static OUT = { xOk: false, xResetReq: false, xDiscErr: false, iAlarm: 0 }; static CFG = { tDisc_ms: 500 };
  init() { this.latched = true; this.nd = 0; this.bothOpen = false; }
  run() {
    const i = this.i, o = this.o, c = this.c, rst = this.edge("xReset"), a = !!i.xCh1, b = !!i.xCh2;
    this.nd = a !== b ? this.nd + 1 : 0;
    if (this.nd * DT >= c.tDisc_ms && !o.xDiscErr) { o.xDiscErr = true; o.iAlarm = 1; this.bothOpen = false; }
    if (o.xDiscErr && !a && !b) this.bothOpen = true;
    if (!(a && b)) this.latched = true;
    if (rst && a && b) { if (o.xDiscErr && this.bothOpen) { o.xDiscErr = false; o.iAlarm = 0; } if (!o.xDiscErr) this.latched = false; }
    o.xOk = a && b && !this.latched && !o.xDiscErr; o.xResetReq = this.latched && a && b && !o.xDiscErr;
  }
}

class ModeSwitch extends FB {
  static IN = { xAuto: false, xMaint: false }; static OUT = { iMode: 3, xError: false, iAlarm: 0 }; static CFG = { tDisc_ms: 500 };
  init() { this.n = 0; }
  run() {
    const i = this.i, o = this.o, a = !!i.xAuto, m = !!i.xMaint;
    this.n = a && m ? this.n + 1 : 0;
    if (a && !m) o.iMode = 1; else if (m && !a) o.iMode = 2; else if (!a && !m) o.iMode = 3;
    o.xError = this.n * DT >= this.c.tDisc_ms; o.iAlarm = o.xError ? 1 : 0;
  }
}

class Edm extends FB {
  static IN = { xCmd: false, xFb: true, xReset: false }; static OUT = { xOn: false, xError: false, iAlarm: 0 }; static CFG = { tEdm_ms: 300, bInverted: true };
  init() { this.n = 0; }
  run() {
    const i = this.i, o = this.o, c = this.c, rst = this.edge("xReset");
    const exp = c.bInverted ? !i.xCmd : !!i.xCmd, okfb = !!i.xFb === exp;
    this.n = !okfb ? this.n + 1 : 0;
    if (o.xError && rst && okfb) { o.xError = false; o.iAlarm = 0; }
    if (!o.xError && this.n * DT >= c.tEdm_ms) { o.xError = true; o.iAlarm = 1; }
    o.xOn = !!i.xCmd && okfb && !o.xError;
  }
}

class TwoHand extends FB {
  static IN = { xLeft: false, xLeft2: false, xRight: false, xRight2: false }; static OUT = { xActuated: false, xError: false, iAlarm: 0 }; static CFG = { tSync_ms: 500 };
  init() { this.n = 0; this.blocked = false; }
  run() {
    const i = this.i, o = this.o, c = this.c, L = !!i.xLeft && !!i.xLeft2, R = !!i.xRight && !!i.xRight2;
    if (!L && !R) { this.blocked = false; this.n = 0; o.xError = false; o.iAlarm = 0; o.xActuated = false; return; }
    if (L !== R) {
      this.n += 1;
      if (this.n * DT > c.tSync_ms && !o.xActuated) { this.blocked = true; o.xError = true; o.iAlarm = 1; }
      o.xActuated = false; return;
    }
    o.xActuated = !this.blocked;
  }
}

class Scanner extends FB {
  static IN = { xOssd1: false, xOssd2: false, xWarn: false, iField: 1 }; static OUT = { qFieldA: false, qFieldB: false, xFree: false, xWarnOut: false, iAlarm: 0 };
  run() {
    const i = this.i, o = this.o, f = N(i.iField);
    o.qFieldA = f === 1; o.qFieldB = f === 2; o.xFree = !!i.xOssd1 && !!i.xOssd2; o.xWarnOut = !!i.xWarn; o.iAlarm = f === 1 || f === 2 ? 0 : 2;
  }
}

class DoorLock extends FB {
  static IN = { xClosed: true, xClosed2: true, xLocked: true, xLocked2: true, xRequest: false };
  static OUT = { xClosedOk: false, xLockedOk: false, xUnlockReq: false, xError: false, iAlarm: 0 }; static CFG = { tDisc_ms: 500 };
  init() { this.nc = 0; this.nl = 0; this.wasOpen = false; }
  run() {
    const i = this.i, o = this.o, c = this.c, req = this.edge("xRequest");
    const c1 = !!i.xClosed, c2 = !!i.xClosed2, l1 = !!i.xLocked, l2 = !!i.xLocked2, C = c1 && c2, L = l1 && l2;
    this.nc = c1 !== c2 ? this.nc + 1 : 0; this.nl = l1 !== l2 ? this.nl + 1 : 0;
    if (this.nc * DT >= c.tDisc_ms) { o.xError = true; o.iAlarm = 1; }
    else if (this.nl * DT >= c.tDisc_ms) { o.xError = true; o.iAlarm = 2; }
    if (L && !C && !o.xError) { o.xError = true; o.iAlarm = 3; }
    if (req && C && L) o.xUnlockReq = true;
    if (!c1 && !c2) this.wasOpen = true;
    if (o.xUnlockReq && this.wasOpen && C) { o.xUnlockReq = false; this.wasOpen = false; }
    o.xClosedOk = C; o.xLockedOk = L;
  }
}

/* ------------------------------------------------------------------ command interface + item 5 tables (as in the reference) */
export const STATES = { Clearing: 1, Stopped: 2, Starting: 3, Idle: 4, Suspended: 5, Execute: 6, Stopping: 7, Aborting: 8, Aborted: 9, Holding: 10, Held: 11, Unholding: 12, Suspending: 13, Unsuspending: 14, Resetting: 15, Completing: 16, Complete: 17 };
export const SN = Object.fromEntries(Object.entries(STATES).map(([k, v]) => [v, k]));
export const CMDS = { Reset: 1, Start: 2, Stop: 3, Hold: 4, Unhold: 5, Suspend: 6, Unsuspend: 7, Abort: 8, Clear: 9 };
export const CN = Object.fromEntries(Object.entries(CMDS).map(([k, v]) => [v, k]));
export const CEDGES = [["Stopped", "Resetting", "Reset"], ["Complete", "Resetting", "Reset"], ["Idle", "Starting", "Start"], ["Execute", "Holding", "Hold"], ["Held", "Unholding", "Unhold"], ["Execute", "Suspending", "Suspend"], ["Suspended", "Unsuspending", "Unsuspend"], ["Aborted", "Clearing", "Clear"]];
export const MODES10 = { 1: ["Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"], 2: ["Reset", "Start", "Stop", "Hold", "Unhold", "Abort", "Clear"], 3: ["Reset", "Start", "Stop", "Abort", "Clear"] };
export const MODE_N = { 1: "Production", 2: "Maintenance", 3: "Manual" };
/** why = reason text (for the matrix tooltip) */
export function allowedWhy(cmd, st, mode) {
  const c = CN[N(cmd)], s = SN[N(st)];
  if (c === undefined || s === undefined) return [false, "unknown command or state"];
  if (!(MODES10[N(mode)] || []).includes(c)) return [false, `${c} is not allowed in mode ${MODE_N[N(mode)] || mode}`];
  const e = CEDGES.find(([a, , l]) => a === s && l === c); if (e) return [true, `edge ${s} → ${e[1]} (${c})`];
  if (c === "Stop") return ["Stopped", "Stopping", "Aborting", "Aborted", "Clearing"].includes(s) ? [false, `Stop is not allowed in ${s}`] : [true, `Stop from every state except Stopped/Stopping/Aborting/Aborted/Clearing → Stopping`];
  if (c === "Abort") return ["Aborting", "Aborted"].includes(s) ? [false, `already ${s}`] : [true, "Abort from every state except Aborting/Aborted → Aborting"];
  return [false, `no edge ${s} --${c}-->`];
}
export const allowed = (cmd, st, mode) => allowedWhy(cmd, st, mode)[0];

class CmdIf extends FB {
  static IN = { iCntrlCmd: 0, xCmdChangeRequest: false, iState: 2, iMode: 1 };
  static OUT = { xCmdAck: false, xCmdRej: false, iCmdExec: 0, iLastCmd: 0, iRejectCount: 0 };
  run() {
    const i = this.i, o = this.o, e = this.edge("xCmdChangeRequest"); o.iCmdExec = 0;
    if (e) {
      const ok = allowed(i.iCntrlCmd, i.iState, i.iMode); o.iLastCmd = N(i.iCntrlCmd);
      if (ok) { o.xCmdAck = true; o.iCmdExec = N(i.iCntrlCmd); } else { o.xCmdRej = true; o.iRejectCount += 1; }
    }
    if (!i.xCmdChangeRequest) { o.xCmdAck = false; o.xCmdRej = false; }
  }
}

export const FBS = { FB_Sensor: Sensor, FB_Valve1: Valve1, FB_Valve2: Valve2, FB_DriveSto: DriveSto, FB_Heater: Heater, FB_PushButton: PushButton, FB_SignalTower: SignalTower,
  FB_HandshakeHw: HandshakeHw, FB_Feeder: Feeder, FB_Ups: Ups, FB_Safe2Ch: Safe2Ch, FB_ModeSwitch: ModeSwitch, FB_Edm: Edm, FB_TwoHand: TwoHand, FB_Scanner: Scanner,
  FB_DoorLock: DoorLock, FB_CmdIf: CmdIf };
export const newFB = (type, cfg) => new FBS[type](cfg);

export function conv(v) {
  if (v === "1" || v === "TRUE" || v === "True") return true;
  if (v === "0" || v === "FALSE" || v === "False") return false;
  return Number(v);
}
const g6 = (v) => { if (Number.isInteger(v)) return String(v); let s = v.toPrecision(6); if (s.includes("e")) return String(Number(s)); s = s.replace(/\.?0+$/, ""); return s; };
export const fmt = (v) => (typeof v === "boolean" ? (v ? "1" : "0") : g6(v));
export const same = (a, b) => N(a) === N(b);

/** run one fb_test: log (reference format) + trace per tick (inputs after events, outputs after the call, events) */
export function runTest(t) {
  const fb = newFB(t.fb, t.cfg), log = [], trace = []; let prev = null;
  for (let k = 0; k < t.K; k++) {
    const ev = [];
    t.events.forEach(([tk, ...sets]) => {
      if (tk !== k) return;
      sets.forEach((s) => { const [n, v] = s.split("="); if (!(n in fb.i)) throw new Error(`${t.name}: unknown input ${n}`); fb.i[n] = conv(v); ev.push(s); });
    });
    fb.run(); const cur = Object.assign({}, fb.o);
    let line = null;
    if (prev === null) line = `${k} init ` + Object.entries(cur).map(([n, v]) => `${n}=${fmt(v)}`).join(" ");
    else { const ch = Object.entries(cur).filter(([n, v]) => !same(v, prev[n])).map(([n, v]) => `${n}=${fmt(v)}`); if (ch.length) line = `${k} ` + ch.join(" "); }
    if (line) log.push(line);
    trace.push({ k, i: Object.assign({}, fb.i), o: cur, ev, line });
    prev = cur;
  }
  return { log, trace };
}

/* ------------------------------------------------------------------ alarm manager (decision D2 + D3) */
export const CLS_N = { A: 1, B: 2, C: 3, "-": 0 };
export const REACT = { A: "Abort", B: "Hold (if Execute)", C: "none (warning)", "-": "none" };
export const almNo = (M, i, a) => M * 1000 + 10 * i + a;
export function alarmMgr(A) {
  const active = new Map(); let order = 0; const log = [], rows = [];
  const cls = {}; A.classes.forEach(([t, a, c]) => { cls[t + "|" + a] = c; });
  for (const [t, ev, inst, alarm] of A.events) {
    const fbt = inst === 0 ? "MODULE" : (A.instances[inst - 1] || [])[1], c = cls[fbt + "|" + alarm] || "?";
    const no = almNo(A.module_code, inst, alarm);
    if (ev === "on" && !active.has(no)) { order += 1; active.set(no, [c, order]); }
    if (ev === "off") active.delete(no);
    const al = [...active].filter(([, v]) => v[0] === "A" || v[0] === "B").map(([n, v]) => [v[0], v[1], n]).sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1] || x[2] - y[2]));
    const wa = [...active].filter(([, v]) => v[0] === "C").map(([n, v]) => [v[1], n]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const alarmNo = al.length ? al[0][2] : 0, warnNo = wa.length ? wa[0][1] : 0, top = al.length ? al[0][0] : wa.length ? "C" : "-";
    log.push(`${t} ${ev} ${no} class ${c} -> AlarmNo=${alarmNo} WarningNo=${warnNo} AlarmClass=${CLS_N[top]} reaction=${REACT[top]}`);
    rows.push({ t, ev, inst, alarm, no, c, fbt, alarmNo, warnNo, cls: CLS_N[top], top, reaction: REACT[top], active: [...active].map(([n, v]) => [n, v[0], v[1]]) });
  }
  return { log, rows };
}

/* ------------------------------------------------------------------ library: FB types + where used (item 8 modules via item 9 codegen) */
export const FBT9 = EX9.codegen.fb_types;
export const DEVICE_TYPES = [...new Set(Object.values(FBT9))];
let usageCache = null;
/** per FB type: {total, mods: {M02: 2, ...}, patterns: [...]}; per module: fbc */
export function usage() {
  if (usageCache) return usageCache;
  const per = {}, mod = {};
  CODES.forEach((c) => { const g = codegen(c); mod[c] = { unit: g.unit, title: g.title, fbc: g.fbc, inst: g.inst, fb: g.fb }; Object.entries(g.fbc).forEach(([t, n]) => { const p = per[t] || (per[t] = { total: 0, mods: {} }); p.total += n; p.mods[c] = n; }); });
  Object.entries(FBT9).forEach(([pn, t]) => { const p = per[t] || (per[t] = { total: 0, mods: {} }); (p.patterns = p.patterns || []).push(pn); });
  return (usageCache = { per, mod });
}

/* ------------------------------------------------------------------ everything from the JSON (test hook) */
export function refLines(D = EX10A) {
  const out = [];
  D.fb_tests.forEach((t) => { const L = runTest(t).log; out.push(`TEST ${t.fb} | ${t.name} | ${L.length} lines`); L.forEach((l) => out.push("    " + l)); });
  out.push("ALARM MANAGER"); alarmMgr(D.alarm_manager).log.forEach((l) => out.push("    " + l));
  out.push("CMD MATRIX (Production): rows state, accepted commands");
  Object.keys(STATES).forEach((s) => { const acc = Object.keys(CMDS).filter((c) => allowed(CMDS[c], STATES[s], 1)); out.push(`    ${s} [${acc.map((c) => `'${c}'`).join(", ")}]`); });
  return out;
}
export function allResults() {
  const D = EX10A, u = usage();
  return {
    lines: refLines(D),
    tests: D.fb_tests.map((t) => { const r = runTest(t); return { fb: t.fb, name: t.name, lines: r.log.length, final: r.trace[r.trace.length - 1].o }; }),
    alarm: alarmMgr(D.alarm_manager).log,
    matrix: [1, 2, 3].map((m) => ({ mode: MODE_N[m], acc: Object.fromEntries(Object.keys(STATES).map((s) => [s, Object.keys(CMDS).filter((c) => allowed(CMDS[c], STATES[s], m))])) })),
    library: { device: DEVICE_TYPES.length, patterns: Object.keys(FBT9).length, kitUse: Object.fromEntries(Object.entries(u.per).map(([t, p]) => [t, p.total])) },
  };
}

/* ------------------------------------------------------------------ small UI helpers (strings only) */
export const store10 = {   // own keys "fmse.10.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.10." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.10." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.10." + k); } catch (e) { /* storage blocked */ } },
};

/* ================================================================== shared UI pieces for fmse10.js / fmse10y.js */
import { $, esc } from "./fmse8x.js";
export const L = (x1, y1, x2, y2, c = "f9-w") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
export const T = (x, y, t, a = "start", c = "f9-sm") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`;
export const RC = (x, y, w, h, c = "f9-box", rx = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${c}"/>`;
export const svg = (w, h, body, cls, label) => `<svg viewBox="0 0 ${w} ${h}" class="${cls}" role="img" aria-label="${esc(label)}">${body}</svg>`;
export const arrowDefs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="f9-ah"/></marker></defs>`;
export const ifOf = (fb) => EX10A.fb_interfaces[fb];
export const isBoolName = (n) => /^[xqb]/.test(n);
export const EDGE_IN = ["xReset", "xRequest", "xHornAck", "xPb"];

/** timing diagram of a trace [{k, i, o, ev}] – inputs (orange) above outputs (blue); BOOL as band, numbers as value boxes */
export function timingSvg(trace, ins, outs, k, opt = {}) {
  const K = Math.max(opt.K || trace.length, 1), x0 = 132, rh = 21, W = Math.max(600, Math.round(x0 + K * (opt.dx || (K > 60 ? 11 : 20)) + 10)), dx = (W - x0 - 10) / K;
  const rows = ins.map((n) => [n, "i"]).concat(outs.map((n) => [n, "o"]));
  let s = "";
  rows.forEach(([n, side], r) => {
    const y = 6 + r * rh + (side === "o" ? 8 : 0);
    s += T(x0 - 6, y + 15, n, "end", side === "i" ? "f10-tl f10-tin" : "f10-tl f10-tout");
    let segStart = 0;
    trace.forEach((q, j) => {
      const v = q[side][n];
      if (isBoolName(n)) { if (v) s += RC(x0 + j * dx, y + 2, dx + 0.3, rh - 5, side === "i" ? "f10-bin" : "f10-bout", 0); }
      const nx = trace[j + 1];
      if (!isBoolName(n) && (!nx || !same(nx[side][n], v))) {
        const xa = x0 + segStart * dx, w = (j + 1 - segStart) * dx, val = fmt(v);
        s += RC(xa + 0.5, y + 2, Math.max(w - 1, 0.5), rh - 5, N(v) ? (side === "i" ? "f10-nin" : "f10-nout") : "f10-n0", 2);
        if (w > val.length * 7 + 2) s += T(xa + w / 2, y + 14, val, "middle", "f10-nv");
        segStart = j + 1;
      }
    });
    s += L(x0, y + rh - 2, W - 10, y + rh - 2, "f9-grid");
  });
  const H = 6 + rows.length * rh + 8;
  trace.forEach((q, j) => { if (q.ev && q.ev.length) s += L(x0 + j * dx, 2, x0 + j * dx, H, "f9-evl"); });
  if (k != null && k >= 0) s += RC(x0 + k * dx, 1, dx, H, "f9-cur", 0);
  const step = K > 60 ? 10 : 5;
  for (let j = 0; j <= K; j += step) s += T(x0 + j * dx, H + 13, String(j), "middle", "f10-tl");
  s += T(x0 - 6, H + 13, "tick", "end", "f10-tl");
  return svg(W, H + 18, s, "f10-timing", opt.label || "Timing diagram of inputs and outputs").replace("<svg ", `<svg style="width:${W}px" `);
}

/** live FB widget: inputs as controls, tick buttons, outputs + rolling timing diagram + change log */
export function liveWidget(host, type, opt = {}) {
  const IF = ifOf(type), id = host.id;
  const W = { type, fb: newFB(type, opt.cfg), hist: [], log: [], k: 0, timer: null, pulse: {} };
  const ctl = (n) => {
    const v = W.fb.i[n];
    if (isBoolName(n)) return `<label class="f10-in"><input type="checkbox" data-in="${n}"${v ? " checked" : ""}> ${n}</label>${EDGE_IN.includes(n) ? `<button class="mx-el f10-pb" data-pulse="${n}" title="TRUE for one tick">pulse</button>` : ""}`;
    const sel = opt.selects && opt.selects[n];
    if (sel) return `<label class="f10-in">${n} <select class="fe-sel" data-in="${n}">${sel.map(([a, b]) => `<option value="${a}"${N(v) === a ? " selected" : ""}>${esc(b)}</option>`).join("")}</select></label>`;
    return `<label class="f10-in">${n} <input type="number" step="any" data-in="${n}" value="${N(v)}" class="f10-num"></label>`;
  };
  host.innerHTML = `<div class="f10-live"><div class="fe-row f10-ins">${IF.in.map(ctl).join("")}</div>
    <div class="fe-row"><button class="mx-el" data-act="1">+1 tick</button><button class="mx-el" data-act="10">+10 ticks</button><button class="mx-el" data-act="run">▶ Run (100 ms)</button><button class="mx-el" data-act="new">New instance</button><span class="f8-pt" data-k></span></div>
    <div class="f10-outs" data-outs></div><div class="fe-scroll" data-tim></div><div class="f9-log f10-llog" data-log></div></div>`;
  const q = (s) => host.querySelector(s);
  const draw = () => {
    q("[data-k]").innerHTML = `tick <b>${W.k}</b> · t = ${(W.k * DT / 1000).toFixed(1)} s`;
    q("[data-outs]").innerHTML = IF.out.map((n) => { const v = W.fb.o[n]; return isBoolName(n) ? `<span class="f10-o">${`<span class="f9-led${v ? (/Error|DiscErr|Rej|Buzzer|Red/.test(n) ? " f10-ledR" : " f9-on") : ""}"></span>`} ${n}</span>` : `<span class="f10-o">${n} = <b>${fmt(v)}</b></span>`; }).join("");
    q("[data-tim]").innerHTML = W.hist.length ? timingSvg(W.hist, IF.in, IF.out, W.hist.length - 1, { K: Math.max(40, W.hist.length), label: type + " live timing" }) : `<p class="am-note">Press "+1 tick" or "Run" – the FB is called once per tick (100 ms), like the PLC task.</p>`;
    q("[data-log]").innerHTML = W.log.slice(-60).map((l) => `<div>${esc(l)}</div>`).join("") || "<div class='f9-lfut'>log (outputs that changed)</div>";
    const lg = q("[data-log]"); lg.scrollTop = lg.scrollHeight;
    if (opt.onDraw) opt.onDraw(W);
  };
  const tick = () => {
    const ev = [];
    Object.keys(W.pulse).forEach((n) => { if (W.pulse[n] === 1) { W.fb.i[n] = true; W.pulse[n] = 2; ev.push(n + "=1"); } });
    const prev = W.hist.length ? W.hist[W.hist.length - 1].o : null;
    W.fb.run(); const cur = Object.assign({}, W.fb.o);
    if (!prev) W.log.push(`${W.k} init ` + Object.entries(cur).map(([n, v]) => `${n}=${fmt(v)}`).join(" "));
    else { const ch = Object.entries(cur).filter(([n, v]) => !same(v, prev[n])).map(([n, v]) => `${n}=${fmt(v)}`); if (ch.length) W.log.push(`${W.k} ` + ch.join(" ")); }
    W.hist.push({ k: W.k, i: Object.assign({}, W.fb.i), o: cur, ev: ev.concat(W.pend || []) }); W.pend = [];
    if (W.hist.length > 80) W.hist.shift();
    Object.keys(W.pulse).forEach((n) => { if (W.pulse[n] === 2) { W.fb.i[n] = false; delete W.pulse[n]; const cb = host.querySelector(`[data-in="${n}"]`); if (cb) cb.checked = false; } });
    W.k++;
  };
  const stop = () => { if (W.timer) { clearInterval(W.timer); W.timer = null; } const b = q('[data-act="run"]'); if (b) b.textContent = "▶ Run (100 ms)"; };
  host.addEventListener("change", (e) => {
    const n = e.target.dataset.in; if (!n) return;
    W.fb.i[n] = e.target.type === "checkbox" ? e.target.checked : Number(e.target.value);
    (W.pend = W.pend || []).push(`${n}=${fmt(W.fb.i[n])}`);
  });
  host.addEventListener("click", (e) => {
    const p = e.target.dataset.pulse; if (p) { W.pulse[p] = 1; const cb = host.querySelector(`[data-in="${p}"]`); if (cb) cb.checked = true; if (!W.timer) { tick(); draw(); } return; }
    const a = e.target.dataset.act; if (!a) return;
    if (a === "1" || a === "10") { for (let j = 0; j < +a; j++) tick(); draw(); }
    else if (a === "new") { stop(); W.fb = newFB(type, opt.cfg); W.hist = []; W.log = []; W.k = 0; W.pulse = {}; W.pend = []; q(".f10-ins").innerHTML = IF.in.map(ctl).join(""); tick(); draw(); }
    else if (a === "run") {
      if (W.timer) return stop();
      e.target.textContent = "❚❚ Pause";
      W.timer = setInterval(() => { if (!document.getElementById(id)) return stop(); tick(); draw(); }, 100);
    }
  });
  W.tick = tick; W.draw = draw; W.stop = stop;
  tick(); draw();
  host._w = W;
  return W;
}
