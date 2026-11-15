/* FMS engineering – item 9 engine (used by fmse9.js / fmse9y.js).
 * Implements EX9._rules of tools/fmse/examples/item9_examples.json EXACTLY (response, tasks, overflow, fb_trace, analog, limits,
 * motor, module_run, alarms, codegen, effort) – same numbers and log lines as guide docs/FMS system design/69_plc_programming.md
 * and tools/fmse/*.py. Code generation re-uses the item 8 library expansion of fmse8x.js (calcModule: IO order, card addresses,
 * revised power-cable rule). Pure functions, no DOM. All values are EXAMPLES. */
import { EX9, EX8 } from "./fmse9_data.js";
import { PAT, MODS, CODES, calcModule, calcKit, pyRound } from "./fmse8x.js";
import { STATES, CMDS, EDGES, MODES } from "./fmse5_data.js";
export { EX9, EX8, PAT, MODS, CODES, pyRound, STATES, CMDS, EDGES, MODES };

/* ------------------------------------------------------------------ response */
export function response(c) {
  const tmin = c.t_in + c.T_scan + c.t_out, tmax = c.t_in + 2 * c.T_bus + 2 * c.T_scan + c.t_out;
  return { name: c.name, tmin: pyRound(tmin, 2), tmax: pyRound(tmax, 2), dist: pyRound(c.v_mm_s * tmax / 1000, 1) };
}

/* ------------------------------------------------------------------ tasks: utilisation, Liu-Layland bound, response-time analysis */
export function tasks(list) {
  const ts = list.map((x) => x.slice()).sort((a, b) => a[3] - b[3]), n = ts.length;
  const U = ts.reduce((s, [, T, C]) => s + C / T, 0), b = n * (Math.pow(2, 1 / n) - 1);
  const rows = ts.map(([nm, T, C, pr], i) => {
    let R = C, ok; const it = [R];
    for (let g = 0; g < 10000; g++) {
      let Rn = C; for (let j = 0; j < i; j++) Rn += Math.ceil(R / ts[j][1]) * ts[j][2];
      it.push(Rn);
      if (Rn > T) { R = Rn; ok = false; break; }
      if (Rn === R) { ok = true; break; }
      R = Rn;
    }
    return { name: nm, T, C, pr, R, RT: pyRound(R / T, 3), ok, iter: it, u: C / T };
  });
  return { U: pyRound(U, 4), Uraw: U, bound: pyRound(b, 4), boundOk: U <= b, rows };
}

/* ------------------------------------------------------------------ overflow */
export function overflow([name, mx, r]) { const s = mx / r; return { name, max: mx, rate: r, s: pyRound(s, 1), d: pyRound(s / 86400, 2), y: pyRound(s / 86400 / 365, 2) }; }

/* ------------------------------------------------------------------ standard FB trace (scan based) */
export const FB_KEYS = ["TON_Q", "TOF_Q", "TP_Q", "RTRIG", "FTRIG", "CTU_Q", "CTD_Q", "SR", "RS", "CTU_CV", "CTD_CV"];
export function fbTrace(F) {
  const dt = F.dt_ms, PT = F.PT_ms, PV = F.PV;
  const sig = (name, k) => (F.signals[name] || []).some(([a, b]) => a <= k && k <= b);
  const ton = { start: null }, tof = { run: false, fall: null }, tp = { start: null, prev: false };
  const rt = { M: false }, ft = { P: false }, ctu = { CV: 0, prev: false }, ctd = { CV: 0, prev: false };
  let sr = false, rs = false; const rows = [];
  for (let k = 0; k < F.N; k++) {
    const t = k * dt, A = sig("A", k), B = sig("B", k), RST = sig("RST", k), LD = sig("LD", k);
    let tonET, tonQ, tofET, tofQ, tpET, tpQ;
    if (A) { if (ton.start === null) ton.start = t; tonET = Math.min(PT, t - ton.start); tonQ = tonET >= PT; } else { ton.start = null; tonET = 0; tonQ = false; }
    if (A) { tof.run = true; tof.fall = null; tofET = 0; tofQ = true; }
    else if (tof.run) { if (tof.fall === null) tof.fall = t; tofET = Math.min(PT, t - tof.fall); tofQ = tofET < PT; }
    else { tofET = 0; tofQ = false; }
    if (A && !tp.prev && tp.start === null) tp.start = t;
    if (tp.start !== null) {
      const el = t - tp.start;
      if (el < PT) { tpQ = true; tpET = el; } else { tpQ = false; tpET = PT; if (!A) { tp.start = null; tpET = 0; } }
    } else { tpQ = false; tpET = 0; }
    tp.prev = A;
    const rQ = A && !rt.M; rt.M = A;
    const fQ = !A && ft.P; ft.P = A;
    let e = A && !ctu.prev; ctu.prev = A;
    if (RST) ctu.CV = 0; else if (e && ctu.CV < 32767) ctu.CV += 1;
    const cuQ = ctu.CV >= PV;
    e = A && !ctd.prev; ctd.prev = A;
    if (LD) ctd.CV = PV; else if (e && ctd.CV > -32768) ctd.CV -= 1;
    const cdQ = ctd.CV <= 0;
    sr = A || (!B && sr); rs = !B && (A || rs);
    rows.push({ k, A, B, RST, LD, TON_Q: tonQ, TON_ET: tonET, TOF_Q: tofQ, TOF_ET: tofET, TP_Q: tpQ, TP_ET: tpET, RTRIG: rQ, FTRIG: fQ, CTU_CV: ctu.CV, CTU_Q: cuQ, CTD_CV: ctd.CV, CTD_Q: cdQ, SR: sr, RS: rs });
  }
  const B2 = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v);
  const events = {};
  FB_KEYS.forEach((key) => { events[key] = rows.filter((r, i) => (i === 0 ? !!r[key] : r[key] !== rows[i - 1][key])).map((r) => [r.k, B2(r[key])]); });
  return { rows, events };
}

/* ------------------------------------------------------------------ analog input + NE 43 */
export function analog(raw, lo, hi) {
  const mA = 4 + 16 * raw / 27648; let q, st;
  if (mA <= 3.6) { q = "BAD"; st = "fault low (wire break)"; }
  else if (mA < 3.8) { q = "UNCERTAIN"; st = "under range"; }
  else if (mA <= 20.5) { q = "GOOD"; st = "ok"; }
  else if (mA < 21.0) { q = "UNCERTAIN"; st = "over range"; }
  else { q = "BAD"; st = "fault high"; }
  const v = lo + (hi - lo) * (mA - 4) / 16, vo = q === "BAD" ? lo : Math.min(hi, Math.max(lo, v));
  return { raw, mA: pyRound(mA, 3), q, st, v: pyRound(v, 3), vo: pyRound(vo, 3) };
}
export function limits(lm) {
  let H = false, Lo = false, nh = 0, nl = 0; const ev = [], rows = [];
  lm.values.forEach((v, i) => {
    nh = v >= lm.H ? nh + 1 : 0; nl = v <= lm.L ? nl + 1 : 0;
    if (!H && nh >= lm.delay) { H = true; ev.push([i, "H on"]); } else if (H && v < lm.H - lm.hyst) { H = false; ev.push([i, "H off"]); }
    if (!Lo && nl >= lm.delay) { Lo = true; ev.push([i, "L on"]); } else if (Lo && v > lm.L + lm.hyst) { Lo = false; ev.push([i, "L off"]); }
    rows.push({ i, v, H, L: Lo, nh, nl });
  });
  return { rows, ev };
}

/* ------------------------------------------------------------------ FB_MotorDol */
export const M_ALM = { 1: "no run feedback after start", 2: "run feedback lost while running", 3: "motor protection tripped", 4: "run feedback without command (contactor welded?)" };
export const M_SN = { 0: "STOPPED", 1: "STARTING", 2: "RUNNING", 3: "STOPPING", 9: "FAULT" };
export function motor(sc, M = EX9.motor) {
  const TFB = M.T_fb_ms, tick = M.tick_ms;
  let cmd = false, cmdp = false, fbb = false, trip = false, weld = false, run = false, contPrev = false, on = 0, st = 0, n = 0, nfb = 0, alarm = 0;
  const log = [], ticks = [];
  for (let k = 0; k < M.K; k++) {
    let reset = false; const evs = [];
    sc.events.forEach(([t, e]) => {
      if (t !== k) return;
      if (e === "CMD_ON") cmd = true; else if (e === "CMD_OFF") cmd = false; else if (e === "RESET") reset = true;
      else if (e === "FB_BROKEN") fbb = true; else if (e === "FB_OK") fbb = false; else if (e === "TRIP") trip = true;
      else if (e === "TRIP_CLEAR") trip = false; else if (e === "WELD") weld = true;
      log.push(`${k} event ${e}`); evs.push(e);
    });
    const cont = run || (weld && contPrev); contPrev = cont;
    on = cont ? on + 1 : 0; const runfb = on >= 2 && !fbb;
    const edge = cmd && !cmdp, st0 = st; let entered = false;
    if (trip && st !== 9) { st = 9; alarm = 3; entered = true; log.push(`${k} ${M_SN[st0]} -> FAULT alarm 3 ${M_ALM[3]}`); }
    if (!entered) {
      if (st === 0) {
        nfb = runfb ? nfb + 1 : 0;
        if (nfb * tick >= TFB) { st = 9; alarm = 4; log.push(`${k} STOPPED -> FAULT alarm 4 ${M_ALM[4]}`); }
        else if (edge) { st = 1; n = 0; log.push(`${k} STOPPED -> STARTING`); }
      } else if (st === 1) {
        n += 1;
        if (runfb) { st = 2; log.push(`${k} STARTING -> RUNNING`); }
        else if (n * tick >= TFB) { st = 9; alarm = 1; log.push(`${k} STARTING -> FAULT alarm 1 ${M_ALM[1]}`); }
      } else if (st === 2) {
        if (!cmd) { st = 3; n = 0; log.push(`${k} RUNNING -> STOPPING`); }
        else if (!runfb) { st = 9; alarm = 2; log.push(`${k} RUNNING -> FAULT alarm 2 ${M_ALM[2]}`); }
      } else if (st === 3) {
        n += 1;
        if (!runfb) { st = 0; nfb = 0; log.push(`${k} STOPPING -> STOPPED`); }
        else if (n * tick >= TFB) { st = 9; alarm = 4; log.push(`${k} STOPPING -> FAULT alarm 4 ${M_ALM[4]}`); }
      } else if (st === 9) {
        if (reset && !trip && !(alarm === 4 && runfb)) { st = 0; alarm = 0; nfb = 0; log.push(`${k} FAULT -> STOPPED reset accepted`); }
        else if (reset) log.push(`${k} reset rejected (alarm ${alarm})`);
      }
    }
    run = st === 1 || st === 2; cmdp = cmd;
    ticks.push({ k, evs, cmd, reset, fbb, trip, weld, cont, runfb, st, st0, alarm, run, n, nfb });
  }
  return { name: sc.name, final: M_SN[st], st, alarm, run, log, ticks };
}

/* ------------------------------------------------------------------ APC01 sequence inside PackML (module_run) */
export const DUR = { Resetting: 5, Starting: 2, Completing: 2, Stopping: 2, Aborting: 1, Clearing: 2, Holding: 1, Unholding: 1, Suspending: 1, Unsuspending: 1 };
export const BUSY = new Set(["Starting", "Execute", "Completing", "Resetting", "Holding", "Unholding", "Suspending", "Unsuspending", "Stopping", "Aborting", "Clearing"]);
export const R_ALM = { 10: "rotate not in an end position at start", 11: "unclamp timeout", 12: "rotate timeout", 13: "clamp pressure low / clamp timeout" };
const tgt = (s, lab) => { const e = EDGES.find(([a, , l]) => a === s && l === lab); return e ? e[1] : null; };
const CMDNAME = Object.fromEntries(Object.entries(CMDS).map(([k, v]) => [v, k]));
export function moduleRun(sc, MR = EX9.module_run, mode = "Production") {
  let state = "Stopped", step = 0, n = 0, nst = 0, alarm = 0, count = 0, target = null;
  let rx = 0, spool = "A", cx = 0, cn = 3, jam = false, plow = false, press = 0.5;
  let out = { ClampSol: false, SolA: false, SolB: false }, cmd = 0, ccr = 0; const pal = true;
  const log = [], ticks = [];
  const bits = () => (state === "Idle" ? 1 : 0) | (BUSY.has(state) ? 2 : 0) | (state === "Complete" ? 4 : 0) | (alarm ? 8 : 0) | 32 | (pal ? 64 : 0);
  let lastStart = null, lastCycle = 0;
  for (let k = 0; k < MR.K; k++) {
    const l0 = log.length, evs = [];
    sc.events.forEach(([t, e]) => {
      if (t !== k) return;
      if (e.startsWith("CMD ")) { cmd = CMDS[e.slice(4)]; ccr = 1; }
      else if (e === "JAM_ROT") jam = true; else if (e === "UNJAM_ROT") jam = false;
      else if (e === "PRESS_LOW") plow = true; else if (e === "PRESS_OK") plow = false;
      log.push(`${k} event ${e}`); evs.push(e);
    });
    const cmdIn = cmd, ccrIn = ccr;
    // 2 plant (outputs of tick k-1)
    if (out.SolA && !out.SolB) spool = "A"; else if (out.SolB && !out.SolA) spool = "B";
    if (!jam) { if (spool === "A" && rx > 0) rx -= 1; else if (spool === "B" && rx < 30) rx += 1; }
    if (out.ClampSol && cx < 8) cx += 1; else if (!out.ClampSol && cx > 0) cx -= 1;
    cn = cx === 0 ? cn + 1 : 0; press = cn >= 3 ? (plow ? 3.8 : 6.0) : 0.5;
    const PosA = rx === 0, PosB = rx === 30, CPA = cx === 0, CPB = cx === 8;
    const s0 = state; let entered = false, entryFrom = null, cmdRes = "";
    // (a) command
    if (ccr) {
      const c = CMDNAME[cmd];
      const ok = MODES[mode].includes(c) && (tgt(state, c) !== null || (c === "Stop" && !["Stopped", "Stopping", "Aborting", "Aborted", "Clearing"].includes(state)) || (c === "Abort" && !["Aborting", "Aborted"].includes(state)));
      if (ok) {
        const ns = tgt(state, c) || (c === "Stop" ? "Stopping" : "Aborting");
        log.push(`${k} cmd ${c} accepted: ${state} -> ${ns}`); entryFrom = state; state = ns; nst = 0; entered = true; cmdRes = "accepted";
      } else { log.push(`${k} cmd ${c} rejected in ${state}`); cmdRes = "rejected"; }
      cmd = 0; ccr = 0;
    }
    // (b) state action
    const trans = [];
    if (entered) trans.push([entryFrom, state]);
    if (!entered) {
      if (DUR[state] != null) {
        nst += 1;
        if (nst >= DUR[state]) { const ns = tgt(state, "SC"); log.push(`${k} SC: ${state} -> ${ns}`); trans.push([state, ns]); state = ns; nst = 0; }
      } else if (state === "Execute") {
        n += 1; let adv = 0, al = 0;
        if (step === 10) { if (CPB) adv = 20; else if (n >= 30) al = 11; }
        else if (step === 20) { if (target === "B" ? PosB : PosA) adv = 30; else if (n >= 50) al = 12; }
        else if (step === 30) { if (CPA && press >= 4.5) adv = 40; else if (n >= 30) al = 13; }
        if (adv) {
          log.push(`${k} step S${step} -> S${adv}`); step = adv; n = 0;
          if (step === 40) { log.push(`${k} SC: Execute -> Completing (sequence done)`); trans.push(["Execute", "Completing"]); state = "Completing"; nst = 0; }
        }
        if (al) { alarm = al; log.push(`${k} ALARM ${al} ${R_ALM[al]} in S${step} -> internal Abort: Execute -> Aborting`); trans.push(["Execute", "Aborting"]); state = "Aborting"; nst = 0; }
      }
    }
    for (const [prev, cur] of trans) {
      if (cur === "Execute" && prev === "Starting") {
        if (PosA) target = "B"; else if (PosB) target = "A";
        else { target = null; alarm = 10; log.push(`${k} ALARM 10 ${R_ALM[10]} -> internal Abort: Execute -> Aborting`); state = "Aborting"; nst = 0; step = 0; continue; }
        step = 10; n = 0; log.push(`${k} sequence start: target ${target}, step S10`); lastStart = k;
      }
      if (cur === "Clearing") alarm = 0;
      if (cur === "Complete") { count += 1; if (lastStart !== null) lastCycle = (k - lastStart) * MR.tick_ms / 1000; }
      if (["Stopped", "Idle", "Aborted", "Completing", "Stopping"].includes(cur)) step = 0;
    }
    // (c) outputs
    if (["Execute", "Holding", "Held", "Unholding"].includes(state)) out = { ClampSol: step === 10 || step === 20, SolA: step === 20 && target === "A", SolB: step === 20 && target === "B" };
    else out = { ClampSol: false, SolA: false, SolB: false };
    if (state !== s0) log.push(`${k} state ${state} StateCurrent=${STATES[state]} AlarmNo=${alarm} Bits=${bits()} count=${count}`);
    ticks.push({ k, evs, cmdIn, ccrIn, cmdRes, state, s0, sc: STATES[state], step, n, nst, alarm, count, target, rx, spool, cx, press, jam, plow,
      PosA: rx === 0, PosB: rx === 30, CPA: cx === 0, CPB: cx === 8, out: { ...out }, bits: bits(), lastCycle, log: log.slice(l0) });
  }
  return { name: sc.name, final: state, sc: STATES[state], alarm, count, bits: bits(), rx, spool, log, ticks };
}

/* ------------------------------------------------------------------ ISA-18.2 alarm state machine */
export function alarms(AL) {
  const defs = Object.fromEntries(AL.defs.map((a) => [a[0], a])), ids = AL.defs.map((a) => a[0]);
  const stt = Object.fromEntries(ids.map((a) => [a, "NORM"])), act = Object.fromEntries(ids.map((a) => [a, false]));
  const groups = {}; AL.defs.forEach((a) => { (groups[a[3]] = groups[a[3]] || []).push(a[0]); });
  const armed = Object.fromEntries(Object.keys(groups).map((g) => [g, true])), fo = Object.fromEntries(Object.keys(groups).map((g) => [g, null]));
  const ann = Object.fromEntries(ids.map((a) => [a, 0])), acts = Object.fromEntries(ids.map((a) => [a, []])), chat = new Set(), rows = [];
  const evs = AL.events.slice().sort((x, y) => x[0] - y[0]);
  for (const [t, a, ev] of evs) {
    if (!defs[a]) continue;
    const s = stt[a]; let ns = s;
    if (ev === "act") { act[a] = true; acts[a].push(t); }
    if (ev === "clr") act[a] = false;
    if (ev === "act" && (s === "NORM" || s === "RTNUN")) ns = "UNACK";
    else if (ev === "ack" && s === "UNACK") ns = "ACKED";
    else if (ev === "clr" && s === "UNACK") ns = "RTNUN";
    else if (ev === "clr" && s === "ACKED") ns = "NORM";
    else if (ev === "ack" && s === "RTNUN") ns = "NORM";
    else if (ev === "shelve" && defs[a][4] && ["NORM", "UNACK", "ACKED", "RTNUN"].includes(s)) ns = "SHLVD";
    else if (ev === "unshelve" && s === "SHLVD") ns = act[a] ? "UNACK" : "NORM";
    else if (ev === "oos" && s !== "OOS") ns = "OOS";
    else if (ev === "ios" && s === "OOS") ns = act[a] ? "UNACK" : "NORM";
    stt[a] = ns; const an = ns === "UNACK" && s !== "UNACK"; let fot = ""; const g = defs[a][3];
    if (an) { ann[a] += 1; if (armed[g]) { armed[g] = false; fo[g] = a; fot = "FIRST-OUT"; } }
    if (ev === "act") { const x = acts[a]; if (x.length >= 3 && x[x.length - 1] - x[x.length - 3] <= 60) chat.add(a); }
    Object.entries(groups).forEach(([gg, mem]) => { if (mem.every((m) => stt[m] === "NORM") && !armed[gg]) { armed[gg] = true; fo[gg] = null; } });
    rows.push({ t, a, ev, from: s, to: ns, txt: ns !== s ? ns : `${s} (no effect)`, ann: an, fo: fot, active: act[a], snap: { ...stt }, foSnap: { ...fo } });
  }
  return { rows, final: { ...stt }, ann, chatter: [...chat].sort(), standing: ids.filter((a) => stt[a] === "UNACK" || stt[a] === "ACKED"), fo };
}

/* ------------------------------------------------------------------ code generator (item 8 library -> ST) */
export function adler32(bytes) { let a = 1, b = 0; for (let i = 0; i < bytes.length; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; } return ((b << 16) | a) >>> 0; }
export function codegen(code, FBT = EX9.codegen.fb_types) {
  const r = calcModule(code, 1), unit = r.unit, title = MODS[code].title, u = r.used, cards = r.cards;
  const lines = [`(* AUTO-GENERATED from the item 8 circuit library: ${code} ${unit} - ${title} *)`,
    `(* IO: ${r.io.length} points (DI ${u.DI}, DO ${u.DO}, AI ${u.AI}, AO ${u.AO}, FDI ${u.FDI}, FDO ${u.FDO}) - do not edit by hand, regenerate *)`, "VAR_GLOBAL"];
  const cnt = { DI: 0, DO: 0, AI: 0, AO: 0, FDI: 0, FDO: 0 }, vars = [];
  r.io.forEach((x) => {
    const parts = x.tag.split("."), sym = `${unit}_${parts[4]}_${parts[5]}`, kk = cnt[x.t]++; let a = "";
    if (x.t === "DI" || x.t === "DO") { const b = 2 * Math.floor(kk / 16) + Math.floor((kk % 16) / 8); a = `%${x.t === "DI" ? "I" : "Q"}X${b}.${kk % 8}`; lines.push(`  ${sym} AT ${a} : BOOL; (* ${x.tag} | ${x.addr} | ${x.ds} *)`); }
    else if (x.t === "AI") { a = `%IW${2 * cards.DI + 8 * Math.floor(kk / 4) + 2 * (kk % 4)}`; lines.push(`  ${sym} AT ${a} : INT; (* ${x.tag} | ${x.addr} | ${x.ds} *)`); }
    else if (x.t === "AO") { a = `%QW${2 * cards.DO + 4 * Math.floor(kk / 2) + 2 * (kk % 2)}`; lines.push(`  ${sym} AT ${a} : INT; (* ${x.tag} | ${x.addr} | ${x.ds} *)`); }
    else if (x.t === "FDI") lines.push(`  ${sym} : BOOL; (* ${x.tag} | ${x.addr} | F-input, read-only copy from the F-program *)`);
    else lines.push(`  ${sym} : BOOL; (* ${x.tag} | ${x.addr} | F-output, written only by the F-program *)`);
    vars.push({ sym, t: x.t, iec: a, tag: x.tag, addr: x.addr, ds: x.ds });
  });
  lines.push("END_VAR", "", `FUNCTION_BLOCK FB_${unit}_Devices`, "VAR");
  const inst = MODS[code].instances.filter(([pn]) => PAT[pn].io.length).map(([pn, g]) => [pn, g]);
  inst.forEach(([pn, g]) => lines.push(`  ${g} : ${FBT[pn]}; (* ${pn} *)`));
  lines.push("END_VAR");
  inst.forEach(([pn, g]) => {
    const io = PAT[pn].io, sym = (s) => `${unit}_${g}_${s}`;
    const prm = io.filter(([, t]) => t === "DI" || t === "FDI" || t === "AI").map(([s, t]) => (t === "AI" ? `i${s} := ${sym(s)}` : `x${s} := ${sym(s)}`));
    lines.push(`${g}(${prm.join(", ")});`);
    io.forEach(([s, t]) => { if (t === "DO") lines.push(`${sym(s)} := ${g}.q${s};`); else if (t === "AO") lines.push(`${sym(s)} := ${g}.w${s};`); });
  });
  lines.push("END_FUNCTION_BLOCK");
  const txt = lines.join("\n") + "\n", bytes = new TextEncoder().encode(txt);
  const fbc = {}; inst.forEach(([pn]) => { fbc[FBT[pn]] = (fbc[FBT[pn]] || 0) + 1; });
  return { code, unit, title, txt, lines: lines.length, chars: txt.length, bytes: bytes.length, ascii: bytes.length === txt.length, adler: adler32(bytes).toString(16).padStart(8, "0"), fb: inst.length, inst, vars, fbc, used: u, cards };
}
export function kitFb(list = EX8.kit.modules) { const per = {}; CODES.forEach((c) => { per[c] = codegen(c).fb; }); return { per, kit: list.reduce((s, c) => s + per[c], 0) }; }

/* ------------------------------------------------------------------ effort */
export function kitQty(list = EX8.kit.modules) {
  const u = calcKit(list).tot.used, fb = kitFb(list).kit;
  return Object.assign({ io_std: u.DI + u.DO + u.AI + u.AO, io_safe: u.FDI + u.FDO, fb_instances: fb }, EX9.effort.kit_qty);
}
export function effort(qty, coef = EX9.effort.coef_h, fa = EX9.effort.factors) {
  const items = Object.keys(coef).map((k) => [k, +qty[k] || 0, +coef[k] || 0, (+qty[k] || 0) * (+coef[k] || 0)]);
  const eng = items.reduce((s, x) => s + x[3], 0), test = fa.test_factor * eng, doc = fa.doc_factor * eng, pm = fa.pm_factor * (eng + test + doc);
  const sub = eng + test + doc + pm, cont = fa.contingency_factor * sub, tot = sub + cont;
  const R1 = (x) => pyRound(x, 1);
  return { items, eng: R1(eng), test: R1(test), doc: R1(doc), pm: R1(pm), sub: R1(sub), cont: R1(cont), total: R1(tot), weeks: R1(tot / fa.hours_per_week) };
}

/* ------------------------------------------------------------------ everything from the JSON (test hook) */
export function allResults() {
  const D = EX9;
  const cg = {}; D.codegen.modules.forEach((c) => { const g = codegen(c); cg[c] = { lines: g.lines, chars: g.chars, bytes: g.bytes, ascii: g.ascii, adler32: g.adler, fb: g.fb, txt: g.txt }; });
  const kf = kitFb(), q = kitQty();
  return {
    response: D.response_cases.map(response),
    tasks: D.task_sets.map((s) => { const r = tasks(s.tasks); return { name: s.name, U: r.U, bound: r.bound, boundOk: r.boundOk, rows: r.rows.map((x) => ({ name: x.name, R: x.R, RT: x.RT, ok: x.ok, iter: x.iter })) }; }),
    overflow: D.overflow.map(overflow),
    fb: (() => { const t = fbTrace(D.fb_trace); return { rows: t.rows, events: t.events }; })(),
    analog: D.analog.raws.map((r) => analog(r, D.analog.lo, D.analog.hi)),
    limits: (() => { const l = limits(D.limits); return { rows: l.rows.map((x) => [x.i, x.v, x.H ? 1 : 0, x.L ? 1 : 0]), ev: l.ev }; })(),
    motor: D.motor.scenarios.map((s) => { const m = motor(s); return { name: m.name, final: m.final, alarm: m.alarm, run: m.run ? 1 : 0, lines: m.log.length, log: m.log }; }),
    run: D.module_run.scenarios.map((s) => { const m = moduleRun(s); return { name: m.name, final: m.final, sc: m.sc, alarm: m.alarm, count: m.count, bits: m.bits, rx: m.rx, spool: m.spool, lines: m.log.length, log: m.log }; }),
    alarms: (() => { const a = alarms(D.alarms); return { rows: a.rows.map((r) => [r.t, r.a, r.ev, r.from, r.txt, r.ann ? "ANN" : "", r.fo]), final: a.final, ann: a.ann, chatter: a.chatter, standing: a.standing, fo: a.fo }; })(),
    codegen: cg, fbPerModule: kf.per, kitFb: kf.kit,
    effort: Object.assign({ qty: q }, (() => { const e = effort(q); delete e.items; return e; })()),
  };
}

/* ================================================================== small UI helpers shared by fmse9.js / fmse9y.js (strings only) */
export const store9 = {   // own keys "fmse.9.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.9." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.9." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.9." + k); } catch (e) { /* storage blocked */ } },
};
export const exBox = (title, body) => `<div class="fx-box f9-ex"><h4 class="fe-h3">Example – ${title}</h4>${body}</div>`;
export const pre = (txt, id = "", cls = "") => `<pre class="f9-code ${cls}"${id ? ` id="${id}"` : ""}>${String(txt).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</pre>`;
export const onoff = (v) => `<span class="f9-led${v ? " f9-on" : ""}"></span>`;
export const bin = (v, n = 8) => (v >>> 0).toString(2).padStart(n, "0");
/** ranges text "2-8, 11-12" <-> [[2,8],[11,12]] */
export const parseRanges = (s) => String(s).split(/[,;]/).map((x) => x.trim()).filter(Boolean).map((x) => { const m = x.match(/^(-?\d+)\s*(?:-|–|\.\.)\s*(-?\d+)$/) || x.match(/^(-?\d+)$/); if (!m) return null; const a = +m[1], b = m[2] != null ? +m[2] : a; return [Math.min(a, b), Math.max(a, b)]; }).filter(Boolean);
export const fmtRanges = (r) => r.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
