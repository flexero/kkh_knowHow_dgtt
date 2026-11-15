/* FMS engineering – item 10 part B engine: the GENERIC module program (PackML core with decisions D1–D4, device FBs, step sequences,
 * alarm classes, monitors, data block) + the GENERIC plant, for every module M01–M22.
 * Rules = EX10B._rules of tools/fmse/examples/item10b_examples.json, exactly (same logs as the reference engine and tools/fmse).
 * The device FBs are the classes of fmse10x.js (part A). Only the FBs that part A runs as item-9 scenarios (FB_MotorDol, FB_AnalogIn)
 * and the thin wrappers around FB_Safe2Ch / FB_Edm (FB_Estop, FB_Door2Ch, FB_EnableSwitch, FB_LightCurtain, FB_SafetyCoupling,
 * FB_ZoneOut, FB_ContactorPair, FB_SafeValve) are added here as classes – the wrappers call the part-A FB_Safe2Ch / FB_Edm inside.
 * One tick = 100 ms. ALL VALUES ARE EXAMPLES. */
import { EX10B, LIBALM10B } from "./fmse10b_data.js";
import { FBS, STATES as ST, CMDS as CM, CN, FBT9, MODS, PAT } from "./fmse10x.js";
import { UC } from "./fmse8x.js";
export { EX10B, ST, CM, CN };

export const DT = 100;
const FB = Object.getPrototypeOf(FBS.FB_Sensor);     // the part-A FB base class (inputs i, outputs o, configuration c, edge())

/* ------------------------------------------------------------------ item-9 FBs as classes (same rules as tools/fmse/fb_library.py) */
class MotorDol extends FB {
  static IN = { xRunFb: false, xTripped: false, xCmd: false, xReset: false }; static OUT = { qRun: false, iState: 0, xError: false, iAlarm: 0 }; static CFG = { tFb_ms: 500 };
  init() { this.n = 0; this.nfb = 0; }
  run() {
    const i = this.i, o = this.o, c = this.c, ce = this.edge("xCmd"), rst = this.edge("xReset"); let st = o.iState;
    if (i.xTripped && st !== 9) { st = 9; o.iAlarm = 3; }
    else if (st === 0) { this.nfb = i.xRunFb ? this.nfb + 1 : 0; if (this.nfb * DT >= c.tFb_ms) { st = 9; o.iAlarm = 4; } else if (ce) { st = 1; this.n = 0; } }
    else if (st === 1) { this.n += 1; if (i.xRunFb) st = 2; else if (this.n * DT >= c.tFb_ms) { st = 9; o.iAlarm = 1; } }
    else if (st === 2) { if (!i.xCmd) { st = 3; this.n = 0; } else if (!i.xRunFb) { st = 9; o.iAlarm = 2; } }
    else if (st === 3) { this.n += 1; if (!i.xRunFb) { st = 0; this.nfb = 0; } else if (this.n * DT >= c.tFb_ms) { st = 9; o.iAlarm = 4; } }
    else if (st === 9) { if (rst && !i.xTripped && !(o.iAlarm === 4 && i.xRunFb)) { st = 0; o.iAlarm = 0; this.nfb = 0; } }
    o.iState = st; o.qRun = st === 1 || st === 2; o.xError = st === 9;
  }
}
class AnalogIn extends FB {
  static IN = { iValue: 0 }; static OUT = { rMa: 0, rValueLin: 0, rValue: 0, iQuality: 0, iStatus: 0, xGood: false, iAlarm: 0 }; static CFG = { rLo: 0, rHi: 10 };
  run() {
    const i = this.i, o = this.o, c = this.c, mA = 4 + 16 * i.iValue / 27648; let q, s;
    if (mA <= 3.6) { q = 2; s = 1; } else if (mA < 3.8) { q = 1; s = 2; } else if (mA <= 20.5) { q = 0; s = 0; } else if (mA < 21) { q = 1; s = 3; } else { q = 2; s = 4; }
    const v = c.rLo + (c.rHi - c.rLo) * (mA - 4) / 16;
    o.rMa = mA; o.rValueLin = v; o.rValue = q === 2 ? c.rLo : Math.min(c.rHi, Math.max(c.rLo, v));
    o.iQuality = q; o.iStatus = s; o.xGood = q === 0; o.iAlarm = q !== 0 ? 3 : 0;
  }
}
/* wrappers: FB_Safe2Ch / FB_Edm of part A with the codegen signal names */
class Safe2ChWrap extends FB {
  static CH = ["xCh1", "xCh2"]; static WARN = false; static CFG = { tDisc_ms: 500 };
  init() { this.b = new FBS.FB_Safe2Ch(); }
  run() {
    const b = this.b, i = this.i, o = this.o, C = this.constructor;
    b.c.tDisc_ms = this.c.tDisc_ms; b.i.xCh1 = i[C.CH[0]]; b.i.xCh2 = i[C.CH[1]]; b.i.xReset = i.xReset; b.run();
    o.xSafe = b.o.xOk; if (C.WARN) o.xWarnOut = i.xWarn;
    o.xResetReq = b.o.xResetReq; o.xDiscErr = b.o.xDiscErr; o.iAlarm = b.o.iAlarm;
  }
}
class Estop extends Safe2ChWrap { static CH = ["xOk", "xOk2"]; static IN = { xOk: false, xOk2: false, xReset: false }; static OUT = { xSafe: false, xResetReq: false, xDiscErr: false, iAlarm: 0 }; }
class EnableSwitch extends Estop {}
class Door2Ch extends Safe2ChWrap { static CH = ["xClosed", "xClosed2"]; static IN = { xClosed: false, xClosed2: false, xReset: false }; static OUT = { xSafe: false, xResetReq: false, xDiscErr: false, iAlarm: 0 }; }
class LightCurtain extends Safe2ChWrap { static CH = ["xOssd1", "xOssd2"]; static WARN = true; static IN = { xOssd1: false, xOssd2: false, xWarn: false, xReset: false }; static OUT = { xSafe: false, xWarnOut: false, xResetReq: false, xDiscErr: false, iAlarm: 0 }; }
class SafetyCoupling extends FB {
  static IN = { xEstopIn: false, xEstopIn2: false, xZoneFree: false, xZoneFree2: false, xReset: false };
  static OUT = { xEstopOk: false, xZoneOk: false, xResetReq: false, xDiscErr: false, iAlarm: 0 }; static CFG = { tDisc_ms: 500 };
  init() { this.e = new FBS.FB_Safe2Ch(); this.z = new FBS.FB_Safe2Ch(); }
  run() {
    const i = this.i, o = this.o;
    [[this.e, "xEstopIn", "xEstopIn2"], [this.z, "xZoneFree", "xZoneFree2"]].forEach(([b, a1, a2]) => { b.c.tDisc_ms = this.c.tDisc_ms; b.i.xCh1 = i[a1]; b.i.xCh2 = i[a2]; b.i.xReset = i.xReset; b.run(); });
    o.xEstopOk = this.e.o.xOk; o.xZoneOk = this.z.o.xOk; o.xResetReq = this.e.o.xResetReq || this.z.o.xResetReq;
    o.xDiscErr = this.e.o.xDiscErr || this.z.o.xDiscErr; o.iAlarm = this.e.o.xDiscErr ? 1 : this.z.o.xDiscErr ? 2 : 0;
  }
}
class EdmWrap extends FB {
  static FBN = "xFb"; static CFG = { tEdm_ms: 300 };
  init() { this.b = new FBS.FB_Edm({ bInverted: true }); }
  run() { const b = this.b, i = this.i; b.c.tEdm_ms = this.c.tEdm_ms; b.i.xCmd = i.xCmd; b.i.xFb = i[this.constructor.FBN]; b.i.xReset = i.xReset; b.run(); Object.assign(this.o, b.o); }
}
class ZoneOut extends EdmWrap { static FBN = "xFb"; static IN = { xCmd: false, xFb: true, xReset: false }; static OUT = { xOn: false, xError: false, iAlarm: 0 }; }
class ContactorPair extends EdmWrap { static FBN = "xEDM"; static IN = { xCmd: false, xEDM: true, xReset: false }; static OUT = { xOn: false, xError: false, iAlarm: 0 }; }
class SafeValve extends FB {
  static IN = { xCmdA: false, xCmdB: false, xFbA: false, xFbB: false, xReset: false }; static OUT = { xOnA: false, xOnB: false, xError: false, iAlarm: 0 }; static CFG = { tEdm_ms: 300 };
  init() { this.a = new FBS.FB_Edm({ bInverted: false }); this.b = new FBS.FB_Edm({ bInverted: false }); this.a.i.xFb = false; this.b.i.xFb = false; }
  run() {
    const i = this.i, o = this.o;
    [[this.a, "xCmdA", "xFbA"], [this.b, "xCmdB", "xFbB"]].forEach(([e, cm, fb]) => { e.c.tEdm_ms = this.c.tEdm_ms; e.i.xCmd = i[cm]; e.i.xFb = i[fb]; e.i.xReset = i.xReset; e.run(); });
    o.xOnA = this.a.o.xOn; o.xOnB = this.b.o.xOn; o.xError = this.a.o.xError || this.b.o.xError; o.iAlarm = this.a.o.xError ? 1 : this.b.o.xError ? 2 : 0;
  }
}
export const XFBS = { FB_MotorDol: MotorDol, FB_AnalogIn: AnalogIn, FB_Estop: Estop, FB_EnableSwitch: EnableSwitch, FB_Door2Ch: Door2Ch, FB_LightCurtain: LightCurtain,
  FB_SafetyCoupling: SafetyCoupling, FB_ZoneOut: ZoneOut, FB_ContactorPair: ContactorPair, FB_SafeValve: SafeValve };

/** FB.set of the reference: value coerced to the type of the input / configuration default (BOOL, number) */
export function setIn(fb, n, v) {
  const C = fb.constructor, inI = C.IN && n in C.IN, inC = C.CFG && n in C.CFG;
  if (!inI && !inC) throw new Error(`${C.name}: '${n}' is not an input of the FB`);
  const def = inI ? C.IN[n] : C.CFG[n], d = inI ? fb.i : fb.c;
  d[n] = typeof def === "boolean" ? !!(typeof v === "boolean" ? v : Number(v)) : Number(v);
}
export function makeFB(t, cfg) {
  const K = XFBS[t] || FBS[t]; if (!K) throw new Error("unknown FB " + t);
  const fb = new K(); Object.entries(cfg || {}).forEach(([k, v]) => setIn(fb, k, v)); return fb;
}

/* ------------------------------------------------------------------ PackML tables (item 5) + core constants of the rules */
export const EDGES = [["Stopped", "Resetting", "Reset"], ["Resetting", "Idle", "SC"], ["Idle", "Starting", "Start"], ["Starting", "Execute", "SC"], ["Execute", "Completing", "SC"], ["Completing", "Complete", "SC"], ["Complete", "Resetting", "Reset"],
  ["Execute", "Holding", "Hold"], ["Holding", "Held", "SC"], ["Held", "Unholding", "Unhold"], ["Unholding", "Execute", "SC"], ["Execute", "Suspending", "Suspend"], ["Suspending", "Suspended", "SC"],
  ["Suspended", "Unsuspending", "Unsuspend"], ["Unsuspending", "Execute", "SC"], ["Stopping", "Stopped", "SC"], ["Aborting", "Aborted", "SC"], ["Aborted", "Clearing", "Clear"], ["Clearing", "Stopped", "SC"]];
export const tgt = (s, lab) => { const e = EDGES.find(([a, , l]) => a === s && l === lab); return e ? e[1] : null; };
export const BUSY = new Set(["Starting", "Execute", "Completing", "Resetting", "Holding", "Unholding", "Suspending", "Unsuspending", "Stopping", "Aborting", "Clearing"]);
export const DUR = { Stopping: 1, Aborting: 1, Holding: 1, Unholding: 1, Suspending: 1, Unsuspending: 1 };
export const SEQ = { Resetting: "home", Starting: "start", Execute: "exec", Completing: "complete" };
export const SAFETY = new Set(["FB_Estop", "FB_Door2Ch", "FB_LightCurtain", "FB_SafetyCoupling", "FB_DoorLock"]);
const DEFCLS = {}; EX10B.default_classes.forEach(([t, a, c]) => { DEFCLS[t + "|" + a] = c; });
export const defClass = (t, a) => DEFCLS[t + "|" + a];
const TERM = /^(!?)\s*([A-Za-z_][\w.]*)\s*(>=|<=|=|>|<)?\s*([-\d.]*)$/;
const pyRound0 = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };   // Python round() (half to even)
const round6 = (x) => Number(x.toFixed(6));

/** condition: '|' OR-groups of '&' terms; term = [!] operand [op number] */
export function ev(expr, get) {
  for (const grp of String(expr).split("|")) {
    let ok = true;
    for (const term of grp.split("&")) {
      const m = term.trim().match(TERM); if (!m) throw new Error(`bad term '${term}' in '${expr}'`);
      const [, neg, opd, op, val] = m, v = get(opd); let r;
      if (op) { const x = parseFloat(val), n = Number(v); r = op === ">=" ? n >= x : op === "<=" ? n <= x : op === "=" ? n === x : op === ">" ? n > x : n < x; }
      else r = !!v;
      if (neg) r = !r;
      if (!r) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}
/** operands used in an expression (for the UI) */
export const operands = (expr) => String(expr).split(/[|&]/).map((t) => (t.trim().match(TERM) || [])[2]).filter((x) => x && x !== "T" && x !== "F" && x !== "t");

/* ------------------------------------------------------------------ module description from the data (instances, classes, alarm texts) */
const descCache = {};
export function moduleDesc(code) {
  if (descCache[code]) return descCache[code];
  const md = EX10B.modules[code], M = parseInt(code.slice(1), 10), inst = [];
  MODS[code].instances.forEach(([p, g]) => { if (PAT[p].io.length) inst.push([g, FBT9[p], p]); });
  if (md.partner) inst.push([md.partner.name, "FB_HandshakeHw", "PARTNER"]);
  const cls = {};
  inst.forEach(([g, t]) => { EX10B.default_classes.forEach(([ft, a, c]) => { if (ft === t) cls[g + "|" + a] = c; }); });
  (md.classes || []).forEach(([g, a, c]) => { cls[g + "|" + a] = c; });
  const malarm = {}; md.alarms.forEach(([a, txt, c]) => { malarm[a] = [txt, c]; });
  const alarmText = (no) => { const r = no - M * 1000, i = Math.floor(r / 10), a = r % 10; if (i === 0) return malarm[a][0]; const [g, t] = inst[i - 1]; return `${g}: ` + ((LIBALM10B[t] || {})[a] || `alarm ${a}`); };
  const alarmClass = (no) => { const r = no - M * 1000, i = Math.floor(r / 10), a = r % 10; if (i === 0) return malarm[a][1]; return cls[inst[i - 1][0] + "|" + a] || "B"; };
  /* full alarm table: module alarms + every library alarm of every instance */
  const table = md.alarms.map(([a, txt, c]) => ({ no: M * 1000 + a, i: 0, a, inst: "module", type: "MODULE", text: txt, cls: c, src: "module data" }));
  inst.forEach(([g, t], ix) => Object.keys(LIBALM10B[t] || {}).forEach((a) => {
    const no = M * 1000 + 10 * (ix + 1) + +a, ov = (md.classes || []).some(([gg, aa]) => gg === g && aa === +a);
    table.push({ no, i: ix + 1, a: +a, inst: g, type: t, text: alarmText(no), cls: alarmClass(no), src: ov ? "module override" : defClass(t, +a) ? "library default" : "default B" });
  }));
  return (descCache[code] = { code, M, md, unit: UC[code] + "01", title: MODS[code].title, inst, cls, malarm, alarmText, alarmClass, table });
}

/* ------------------------------------------------------------------ the module program + plant (one object = one module instance) */
export class Module {
  constructor(code, events = [], cc = null, K = null, opt = {}) {
    const D = moduleDesc(code); Object.assign(this, { code, M: D.M, md: D.md, unit: D.unit, D });
    const md = this.md;
    this.inst = D.inst; this.types = {}; this.fb = {}; this.cmd = {}; this.pp = {}; this.pv = {};
    this.inst.forEach(([g, t]) => { this.types[g] = t; this.fb[g] = makeFB(t, (md.cfg || {})[g]); });
    this.inst.forEach(([g, t]) => { this.cmd[g] = Module.cmdInit(t); });
    this.keep = new Set(md.keep || []);
    this.inst.forEach(([g]) => { this.pp[g] = Object.assign({}, (md.plant || {})[g] || {}); });
    this.inst.forEach(([g, t]) => { this.pv[g] = this.plantInit(g, t); });
    this.forced = new Map();
    this.events = events.map((e) => e.slice()); this.cc = (cc != null ? cc : md.cc).map((x) => x.slice()); this.K = K || EX10B.normal_K;
    this.state = "Stopped"; this.nst = 0; this.seq = null; this.step = null; this.t = 0; this.entered = false; this.prevEntry = null;
    this.malActive = new Set(); this.malFired = new Set(); this.monN = {};
    this.active = new Map(); this.order = 0; this.rejwarn = 0; this.resetPulse = false; this.resetNext = false;
    this.db = { CntrlCmd: 0, CCR: false, Ack: false, Rej: false, State: 2, AlarmNo: 0, WarningNo: 0, Bits: 0 };
    this.cmdif = makeFB("FB_CmdIf"); this.log = []; this.prevOut = this.snapOut(); this.top = 0; this.k = 0; this.mode = 1;
    this.userQ = []; this.trace = opt.trace ? [] : null; this.lastCmd = "";
  }
  static cmdInit(t) {
    if (t === "FB_Valve1" || t === "FB_Valve2") return { xCmdB: false, xEnable: true };
    if (t === "FB_MotorDol") return { xCmd: false };
    if (t === "FB_DriveSto") return { xCmdRun: false };
    if (t === "FB_Heater") return { xEnable: false, rSp: 60.0 };
    if (t === "FB_PushButton") return { iLampMode: 0 };
    if (t === "FB_HandshakeHw") return { xStart: false };
    if (t === "FB_Scanner") return { iField: 1 };
    return {};
  }
  snapOut() { const r = {}; Object.entries(this.fb).forEach(([g, f]) => { r[g] = Object.assign({}, f.o); }); return r; }
  safeCmd(aborting) {
    this.inst.forEach(([g]) => {
      Object.entries(this.cmd[g]).forEach(([k, v]) => {
        if (this.keep.has(g + "." + k) && !aborting) return;
        if (k === "iField") this.cmd[g][k] = 1; else if (k === "rSp") return; else if (typeof v === "boolean") this.cmd[g][k] = false; else this.cmd[g][k] = 0;
      });
    });
    this.inst.forEach(([g, t]) => { if (t === "FB_Valve1" || t === "FB_Valve2") this.cmd[g].xEnable = false; });
  }
  plantInit(g, t) {
    const pp = this.pp[g];
    if (t === "FB_Valve1" || t === "FB_Valve2") return { x: 0, spool: "A", jam: 0 };
    if (t === "FB_MotorDol") return { run: 0, trip: 0 };
    if (t === "FB_DriveSto") return { pos: 0, dir: 1, running: 0, fault: 0 };
    if (t === "FB_Heater") return { temp: pp.temp0 != null ? pp.temp0 : 20.0, overtemp: 0 };
    if (t === "FB_AnalogIn") return { n: 0, v1: pp.v1 != null ? pp.v1 : 0, v0: pp.v0 != null ? pp.v0 : 0, value: pp.value != null ? pp.value : 0 };
    if (t === "FB_Sensor") return { value: pp.value != null ? pp.value : 0, latch: pp.value != null ? pp.value : 0 };
    if (t === "FB_HandshakeHw") return { ph: "idle", n: 0, dead: 0, fault: 0 };
    if (SAFETY.has(t) || t === "FB_EnableSwitch") return { ok: 1 };
    return {};
  }
  pget(opd) { if (opd === "T") return true; if (opd === "F") return false; const [, g, v] = opd.split("."); return this.pv[g][v]; }
  get(opd) { if (opd === "T") return true; if (opd === "F") return false; if (opd === "t") return this.t; const [g, o] = opd.split("."); return this.fb[g].o[o]; }

  plant() {
    const out = this.prevOut, IO = {}, pg = (x) => this.pget(x); let rel = true;
    this.inst.forEach(([g, t]) => {
      if (!SAFETY.has(t)) return;
      const ok = t === "FB_Door2Ch" && "expr2" in this.pp[g] ? ev(this.pp[g].expr2, pg) : !!this.pv[g].ok; rel = rel && ok;
    });
    this.inst.forEach(([g, t, p]) => {
      const pp = this.pp[g], pv = this.pv[g], o = out[g]; let io = {};
      if (t === "FB_Valve1" || t === "FB_Valve2") {
        const T = pp.T != null ? pp.T : 10; let tB;
        if (t === "FB_Valve1") tB = !!o.qSol;
        else { if (o.qSolB && !o.qSolA) pv.spool = "B"; else if (o.qSolA && !o.qSolB) pv.spool = "A"; tB = pv.spool === "B"; }
        if (!pv.jam) { if (tB && pv.x < T) pv.x += 1; else if (!tB && pv.x > 0) pv.x -= 1; }
        io = { xPosA: pv.x === 0, xPosB: pv.x === T };
      } else if (t === "FB_MotorDol") { pv.run = o.qRun ? pv.run + 1 : 0; io = { xRunFb: pv.run >= 2, xTripped: !!pv.trip }; }
      else if (t === "FB_DriveSto") {
        const Lm = pp.L != null ? pp.L : 20, run = !!(o.wCtrl & 2);
        if (run && !pv.running) { if (pv.pos === 0) pv.dir = 1; else if (pv.pos === Lm) pv.dir = -1; }
        pv.running = run ? 1 : 0;
        if (run) pv.pos = Math.max(0, Math.min(Lm, pv.pos + pv.dir));
        io = { xReady: !pv.fault, xFault: !!pv.fault, xSto: !rel };
      } else if (t === "FB_Heater") { pv.temp = round6(pv.temp + (o.qOn ? 0.5 : -0.1)); io = { xOnFb: o.qOn, xOverTemp: !!pv.overtemp }; }
      else if (t === "FB_HandshakeHw") {
        const job = p === "PARTNER" ? (pp.job != null ? pp.job : ((this.md.partner || {}).job != null ? this.md.partner.job : 30)) : (pp.job != null ? pp.job : 30);
        if (pv.ph === "idle") { if (o.qRequest && !pv.dead) { pv.ph = "wait"; pv.n = 0; } }
        else if (pv.ph === "wait") { pv.n += 1; if (pv.n >= 2) { pv.ph = "busy"; pv.n = 0; } }
        else if (pv.ph === "busy") { pv.n += 1; if (pv.n >= job) pv.ph = "done"; }
        else if (pv.ph === "done") { if (o.qAck) pv.ph = "idle"; }
        const ph = pv.ph; io = { xReady: ph === "idle" || ph === "wait", xBusy: ph === "busy", xDone: ph === "done", xFault: !!pv.fault };
      } else if (t === "FB_Feeder") io = { xSupplyOn: true };
      else if (t === "FB_Ups") io = { xUpsOk: true, xOnBattery: false };
      else if (t === "FB_PushButton") io = { xPb: false };
      else if (t === "FB_Estop" || t === "FB_EnableSwitch") { const ok = !!pv.ok; io = { xOk: ok, xOk2: ok }; }
      else if (t === "FB_Door2Ch") { const ok = "expr2" in pp ? ev(pp.expr2, pg) : !!pv.ok; io = { xClosed: ok, xClosed2: ok }; }
      else if (t === "FB_LightCurtain") { const ok = !!pv.ok; io = { xOssd1: ok, xOssd2: ok, xWarn: false }; }
      else if (t === "FB_SafetyCoupling") { const ok = !!pv.ok; io = { xEstopIn: ok, xEstopIn2: ok, xZoneFree: ok, xZoneFree2: ok }; }
      else if (t === "FB_DoorLock") { const ok = !!pv.ok; io = { xClosed: ok, xClosed2: ok, xLocked: ok, xLocked2: ok, xRequest: false }; }
      else if (t === "FB_ModeSwitch") io = { xAuto: true, xMaint: false };
      else if (t === "FB_TwoHand") io = { xLeft: false, xLeft2: false, xRight: false, xRight2: false };
      else if (t === "FB_Scanner") io = { xOssd1: true, xOssd2: true, xWarn: false };
      else if (t === "FB_ZoneOut") io = { xCmd: rel, xFb: !this.fb[g].i.xCmd };
      else if (t === "FB_ContactorPair") io = { xCmd: rel, xEDM: !this.fb[g].i.xCmd };
      else if (t === "FB_SafeValve") io = { xCmdA: rel, xCmdB: rel, xFbA: this.fb[g].i.xCmdA, xFbB: this.fb[g].i.xCmdB };
      IO[g] = io;
    });
    this.inst.forEach(([g, t]) => {     // analog + sensors read the plant AFTER the actuator update
      const pp = this.pp[g], pv = this.pv[g];
      if (t === "FB_AnalogIn") {
        let v;
        if ("src" in pp) v = this.pv[pp.src].temp;
        else if ("expr" in pp) { pv.n = ev(pp.expr, pg) ? pv.n + 1 : 0; v = pv.n > (pp.delay || 0) ? pv.v1 : pv.v0; }
        else v = pv.value;
        const c = this.fb[g].c; IO[g] = { iValue: pyRound0((v - c.rLo) / (c.rHi - c.rLo) * 27648) };
      } else if (t === "FB_Sensor") {
        let x;
        if ("expr" in pp) x = ev(pp.expr, pg);
        else if ("set" in pp) { if (ev(pp.set, pg)) pv.latch = 1; else if (ev(pp.reset, pg)) pv.latch = 0; x = !!pv.latch; }
        else x = !!pv.value;
        IO[g] = { xOn: x };
      }
    });
    return IO;
  }

  L(k, s) { this.log.push(`${k} ${s}`); }
  enterSeq(k, name) { this.seq = name; const steps = this.md[name] || []; if (!steps.length) { this.step = null; return; } this.goto(k, 0); }
  goto(k, idx, frm = null) {
    const steps = this.md[this.seq];
    for (;;) {
      if (idx >= steps.length) { this.L(k, `${this.seq} step S${frm} -> S0`); this.step = null; return "end"; }
      const st = steps[idx];
      if (st.skip_if && ev(st.skip_if, (x) => this.get(x))) { this.L(k, `${this.seq} step S${frm != null ? frm : 0} -> S${st.s} skip`); frm = st.s; idx += 1; continue; }
      this.L(k, `${this.seq} step S${frm != null ? frm : 0} -> S${st.s}`);
      Object.entries(st.do || {}).forEach(([key, v]) => { const [g, c] = key.split("."), cur = this.cmd[g][c]; this.cmd[g][c] = typeof cur === "boolean" ? !!v : Number(v); });
      this.step = idx; this.t = 0; return null;
    }
  }
  changeState(k, ns) {
    this.state = ns; this.nst = 0; this.entered = true;
    if (ns === "Resetting" || ns === "Clearing" || ns === "Unholding") { this.malActive.clear(); this.malFired.clear(); this.monN = {}; this.resetNext = true; }
    if (ns === "Stopping" || ns === "Aborting") { this.safeCmd(ns === "Aborting"); this.seq = null; this.step = null; }
    if (ns === "Resetting") this.inst.forEach(([g, t]) => { if (t === "FB_Valve1" || t === "FB_Valve2") this.cmd[g].xEnable = true; });
    if (ns in SEQ) {
      if (ns === "Execute" && (this.prevEntry === "Unholding" || this.prevEntry === "Unsuspending")) this.t = 0;
      else if (ns !== "Execute" || this.prevEntry === "Starting") this.enterSeq(k, SEQ[ns]);
    }
  }
  setState(k, ns) { this.prevEntry = this.state; this.changeState(k, ns); }

  applyEvent(k, txt) {
    this.L(k, `event ${txt}`);
    const sp = txt.indexOf(" "), kind = txt.slice(0, sp), rest = txt.slice(sp + 1);
    if (kind === "P") {
      const [lhs, vs] = rest.split("="), [g, v] = lhs.split("."), x = parseFloat(vs);
      if (["jam", "trip", "fault", "dead", "overtemp", "ok"].includes(v)) this.pv[g][v] = Math.trunc(x);
      else if (v === "value") { this.pv[g].value = x; this.pv[g].latch = x; } else this.pv[g][v] = x;
    } else if (kind === "SET") { const [lhs, vs] = rest.split("="), [g, inp] = lhs.split("."); this.forced.set(g + "|" + inp, parseFloat(vs)); }
    else if (kind === "SAFE") { const [g, vs] = rest.split("="); this.pv[g].ok = parseInt(vs, 10); }
  }

  tick() {
    const k = this.k, s0 = this.state, db = this.db, n0 = this.log.length; this.entered = false;
    // (1) events
    this.events.forEach((e) => { if (e[0] === k) e.slice(1).forEach((txt) => this.applyEvent(k, txt)); });
    // (2) cell controller model (D1)
    if (db.CCR && (db.Ack || db.Rej)) { db.CCR = false; db.CntrlCmd = 0; this.L(k, "cc clears request"); }
    else if (!db.CCR && this.cc.length && db.State === ST[this.cc[0][1]] && k >= this.cc[0][2]) { const c = this.cc.shift()[0]; db.CntrlCmd = CM[c]; db.CCR = true; this.lastCmd = c; this.L(k, `cc sends ${c}`); }
    else if (!db.CCR && this.userQ.length) { const c = this.userQ.shift(); db.CntrlCmd = CM[c]; db.CCR = true; this.lastCmd = c; this.L(k, `cc sends ${c}`); }
    // (3) plant
    const IO = this.plant();
    // (4) device FBs
    this.resetPulse = this.resetNext; this.resetNext = false;
    this.inst.forEach(([g, t]) => {
      const fb = this.fb[g];
      Object.entries(IO[g]).forEach(([n, v]) => setIn(fb, n, v));
      Object.entries(this.cmd[g]).forEach(([n, v]) => setIn(fb, n, v));
      (this.md.wires || []).forEach(([tg, src]) => { const [tgi, tin] = tg.split("."); if (tgi === g) { const [sg, so] = src.split("."); setIn(fb, tin, this.prevOut[sg][so]); } });
      if (t === "FB_SignalTower") { setIn(fb, "iState", ST[this.state]); setIn(fb, "iAlarmClass", this.top); }
      if ("xReset" in fb.i) setIn(fb, "xReset", this.resetPulse);
      this.forced.forEach((v, key) => { const [fg, inp] = key.split("|"); if (fg === g) setIn(fb, inp, v); });
      fb.run();
    });
    // (5) alarms
    const cur = new Set();
    this.inst.forEach(([g], ix) => { const a = this.fb[g].o.iAlarm || 0; if (a) cur.add(this.M * 1000 + 10 * (ix + 1) + a); });
    this.malActive.forEach((a) => cur.add(this.M * 1000 + a));
    [...cur].filter((n) => !this.active.has(n)).sort((a, b) => a - b).forEach((no) => { this.order += 1; this.active.set(no, this.order); this.L(k, `alarm ON ${no} class ${this.D.alarmClass(no)} ${this.D.alarmText(no)}`); });
    [...this.active.keys()].filter((n) => !cur.has(n)).sort((a, b) => a - b).forEach((no) => { this.active.delete(no); this.L(k, `alarm OFF ${no}`); });
    this.updateAlarmWords();
    // (6) command interface FB_CmdIf (part A)
    const ci = this.cmdif; setIn(ci, "iCntrlCmd", db.CntrlCmd); setIn(ci, "xCmdChangeRequest", db.CCR); setIn(ci, "iState", ST[this.state]);
    const mode = this.fb.Mode && this.types.Mode === "FB_ModeSwitch" ? this.fb.Mode.o.iMode : 1; this.mode = mode; setIn(ci, "iMode", mode); ci.run();
    if (ci.o.iCmdExec) {
      const c = CN[ci.o.iCmdExec], ns = tgt(this.state, c) || (c === "Stop" ? "Stopping" : "Aborting");
      this.L(k, `cmd ${c} accepted: ${this.state} -> ${ns}`); this.rejwarn = 0; this.setState(k, ns);
    } else if (ci.o.xCmdRej && !db.Rej) {
      this.rejwarn = this.M * 1000 + 900 + ci.o.iLastCmd; this.updateAlarmWords();
      this.L(k, `cmd ${CN[ci.o.iLastCmd] != null ? CN[ci.o.iLastCmd] : ci.o.iLastCmd} rejected in ${this.state} (WarningNo ${this.rejwarn})`);
    }
    // (7) alarm reaction
    if (this.top === 1 && !["Aborting", "Aborted", "Clearing"].includes(this.state)) { this.L(k, `internal Abort (alarm ${db.AlarmNo}): ${this.state} -> Aborting`); this.setState(k, "Aborting"); }
    else if (this.top === 2 && this.state === "Execute") { this.L(k, `internal Hold (alarm ${db.AlarmNo}): ${this.state} -> Holding`); this.setState(k, "Holding"); }
    // (8) state action
    if (!this.entered) this.stateAction(k);
    // (9) monitors
    (this.md.monitors || []).forEach(([a, expr, states, delay]) => {
      const on = ev(expr, (x) => this.get(x)) && (states.includes("all") || states.includes(this.state));
      this.monN[a] = on ? (this.monN[a] || 0) + 1 : 0;
      if (this.monN[a] > delay) this.malActive.add(a);
    });
    // (10) data block
    this.updateAlarmWords();
    db.State = ST[this.state]; db.Ack = ci.o.xCmdAck; db.Rej = ci.o.xCmdRej;
    db.Bits = (this.state === "Idle" ? 1 : 0) | (BUSY.has(this.state) ? 2 : 0) | (this.state === "Complete" ? 4 : 0) | (db.AlarmNo ? 8 : 0) | (mode === 1 ? 32 : 0) | (db.Ack ? 256 : 0) | (db.Rej ? 512 : 0);
    if (this.state !== s0) this.L(k, `state ${this.state} StateCurrent=${ST[this.state]} AlarmNo=${db.AlarmNo} WarningNo=${db.WarningNo} Bits=${db.Bits}`);
    this.prevOut = this.snapOut();
    if (this.trace) this.trace.push(this.snap(n0));
    this.k += 1;
  }
  run() { while (this.k < this.K) this.tick(); return this.log; }

  updateAlarmWords() {
    const ab = [...this.active].filter(([n]) => ["A", "B"].includes(this.D.alarmClass(n))).map(([n, o]) => [this.D.alarmClass(n), o, n])
      .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1] || x[2] - y[2]));
    const cw = [...this.active].filter(([n]) => this.D.alarmClass(n) === "C").map(([n, o]) => [o, n]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    this.db.AlarmNo = ab.length ? ab[0][2] : 0;
    this.db.WarningNo = cw.length ? cw[0][1] : this.rejwarn;
    this.top = ab.length ? { A: 1, B: 2 }[ab[0][0]] : cw.length ? 3 : 0;
  }
  stateAction(k) {
    const s = this.state;
    if (s in DUR) { this.nst += 1; if (this.nst >= DUR[s]) { const ns = tgt(s, "SC"); this.L(k, `SC: ${s} -> ${ns}`); this.setState(k, ns); } }
    else if (s === "Clearing") {
      this.nst += 1;
      if (this.top === 1 || this.top === 2) { this.L(k, "clear failed: Clearing -> Aborted"); this.setState(k, "Aborted"); }
      else { this.L(k, "SC: Clearing -> Stopped"); this.setState(k, "Stopped"); }
    } else if (s in SEQ) {
      if (this.step == null) { const ns = tgt(s, "SC"); this.L(k, `SC: ${s} -> ${ns}`); this.setState(k, ns); return; }
      const steps = this.md[this.seq], st = steps[this.step]; this.t += 1;
      if (ev(st.wait, (x) => this.get(x))) {
        let nidx = this.step + 1;
        if (st.next != null) nidx = steps.findIndex((x) => x.s === st.next);
        if (this.goto(k, nidx, st.s) === "end") { const ns = tgt(s, "SC"); this.L(k, `SC: ${s} -> ${ns}`); this.setState(k, ns); }
      } else if ((st.to || 0) > 0 && this.t >= st.to && !this.malFired.has(this.seq + "|" + this.step)) {
        this.malFired.add(this.seq + "|" + this.step); const a = st.al; this.malActive.add(a);
        if (this.D.malarm[a][1] === "C") { if (this.goto(k, this.step + 1, st.s) === "end") { const ns = tgt(s, "SC"); this.L(k, `SC: ${s} -> ${ns}`); this.setState(k, ns); } }
      }
    }
  }
  /** snapshot after a tick (UI): state, step, words, alarms, FB outputs, plant, log lines of the tick */
  snap(n0) {
    const st = this.step != null && this.seq ? this.md[this.seq][this.step] : null;
    return {
      k: this.k, state: this.state, seq: this.seq, step: st ? st.s : null, t: this.t, top: this.top, mode: this.mode,
      db: Object.assign({}, this.db), act: [...this.active].map(([n, o]) => [n, o]), mal: [...this.malActive],
      fo: this.snapOut(), fi: Object.fromEntries(Object.entries(this.fb).map(([g, f]) => [g, Object.assign({}, f.i)])), pv: JSON.parse(JSON.stringify(this.pv)),
      cmd: JSON.parse(JSON.stringify(this.cmd)), lines: this.log.slice(n0),
    };
  }
}

/* ------------------------------------------------------------------ scenarios + reference text */
export const CODES10B = Object.keys(EX10B.modules);
export const summary = (m) => `final ${m.state} StateCurrent=${ST[m.state]} AlarmNo=${m.db.AlarmNo} WarningNo=${m.db.WarningNo} lines ${m.log.length}`;
export const normalOf = (code, trace) => { const m = new Module(code, EX10B.modules[code].ops || [], null, null, { trace }); m.run(); return m; };
export const faultOf = (f, trace) => { const m = new Module(f.module, f.events, f.cc, f.K, { trace }); m.run(); return m; };
export const faultId = (f) => f.name.split(" ")[0];

export function refLines10B() {
  const out = [];
  CODES10B.forEach((code) => { const m = normalOf(code); out.push(`NORMAL ${code} ${m.unit} | instances ${m.inst.length} | ${summary(m)}`); m.log.forEach((l) => out.push("    " + l)); });
  EX10B.fault_scenarios.forEach((f) => { const m = faultOf(f); out.push(`FAULT ${f.module} ${f.name} | ${summary(m)}`); m.log.forEach((l) => out.push("    " + l)); });
  return out;
}

/** cycle-time and alarm statistics per module from the normal scenario */
export function stats(code) {
  const m = normalOf(code), D = m.D, md = m.md, log = m.log;
  const tk = (re) => { const l = log.find((x) => re.test(x)); return l ? parseInt(l, 10) : null; };
  const tStart = tk(/cmd Start accepted/), tExec = tk(/SC: Starting -> Execute/), tDone = tk(/state Complete /), tIdle = tk(/state Idle /);
  const nsteps = ["home", "start", "exec", "complete"].reduce((s, q) => s + (md[q] || []).length, 0);
  const homeT = (() => { const a = tk(/cmd Reset accepted/); return a == null || tIdle == null ? null : tIdle - a; })();
  const cls = { A: 0, B: 0, C: 0 }; D.table.forEach((r) => { cls[r.cls] = (cls[r.cls] || 0) + 1; });
  return {
    code, unit: m.unit, title: D.title, inst: m.inst.length, steps: nsteps, home: (md.home || []).length, start: (md.start || []).length, exec: (md.exec || []).length,
    cont: tDone == null, cycle: tStart != null && tDone != null ? tDone - tStart : null, homeT, execAt: tExec, alarms: D.table.length, modAlarms: md.alarms.length,
    clsA: cls.A, clsB: cls.B, clsC: cls.C, monitors: (md.monitors || []).length, wires: (md.wires || []).length, final: m.state, lines: log.length,
  };
}

/** everything (test hook) */
export function allResults10B() {
  const lines = refLines10B(), st = CODES10B.map(stats);
  return {
    lines, n: lines.length,
    finals: Object.fromEntries(CODES10B.map((c) => [c, normalOf(c).state])),
    faults: EX10B.fault_scenarios.map((f) => { const m = faultOf(f); return `${faultId(f)} ${f.module} ${m.state} ${m.db.AlarmNo}/${m.db.WarningNo} ${m.log.length}`; }),
    stats: st, kit: { modules: st.length, instances: st.reduce((s, x) => s + x.inst, 0), steps: st.reduce((s, x) => s + x.steps, 0), alarms: st.reduce((s, x) => s + x.alarms, 0) },
  };
}
