/* AS/RS item 7 – telescopic fork: geometry, pick-up / deposit sequence (plan + state at time t), design calculations.
 * Same fork as items 1 + 6 (asrscore CRANE: stroke ± 1.35 m, v 1.0 m/s, a 1.2 m/s², lift 0.1 m in 0.5 s; guide 38: 3 stages × 1.0 m, tines at ± 250 mm).
 * Coordinates of item 7 (metres, relative to the crane): X = fork direction (side L = −X, side R = +X), Y = up, Z = along the aisle.
 * ALL VALUES ARE EXAMPLES – the fork maker's data decides.
 */
import { CRANE, RACK, trapTime, trapPos, trapVel, moveTime, lhdTime } from "./asrscore.js";

/* ---------------------------------------------------------------- geometry (example – the fork maker's drawing decides) */
export const FG = {
  L: 1.0,                    // stage length (all 3 stages), m – item 6
  stroke: RACK.aisle / 2 + RACK.crateL / 2,   // 1.35 m top stage (tine) stroke = crate centre in the slot
  tineZ: 0.25,               // tines at ± 250 mm along the aisle (item 6)
  wB: 0.17, wM: 0.14, wT: 0.11,               // stage widths (item 6 / guide 38)
  yB: [-0.080, -0.054], yM: [-0.052, -0.028], yT: [-0.026, 0.0],   // stage heights relative to the tine top (fork envelope 80 mm)
  spr: 0.46, sprR: 0.0139,   // sprocket centre ± 0.46 m from the middle-stage centre, pitch radius (06B, z = 9 → d 27.8 mm)
  anc: 0.30,                 // chain anchors: on the base at ∓0.30 m, on the top stage at ∓0.30 m from its centre
  chainY: -0.040,            // sprocket axis height
  chainDz: 0.078,            // chain plane offset from the tine centre (+ = outer side: chain for side R, − = inner: chain for side L)
  pinR: 0.020,               // pinion pitch radius (m = 2, z = 20 → d = 40 mm)
  pinX: 0.30,                // 2 pinions per tine at ± 0.30 m, coupled (one is always in mesh with the 1 000 mm rack)
  pinY: -0.080,              // pinion axis = synchronising shaft height
  pitch: 0.009525,           // chain pitch 06B (3/8")
  rollIn: 0.0125,            // rollers sit 12.5 mm in from the stage ends → roller spacing = overlap − 25 mm
};
FG.sMid = FG.stroke / 2;                       // 0.675 m middle stage
FG.overlap = FG.L - FG.sMid;                   // 0.325 m overlap at full stroke
export const CR = { W: RACK.crateW, Lx: RACK.crateL, H: RACK.crateH, runH: 0.12, runZ: 0.375, runW: 0.05 };   // crate with 2 runners (feet) along the fork direction
export const RK = {
  xF: RACK.aisle / 2 + 0.06, xR: RACK.aisle / 2 + RACK.crateL - 0.06,      // front / rear upright + beam centre |X| (0.81 / 1.89) – item 1
  beamH: RACK.beamH, beamW: 0.05, levels: [0.40, 1.65, 2.90],             // beam top heights in this scene (pitch 1.25 m = RACK.levelPitch)
  bayZ: [-2.45, -0.525, 1.40, 3.325],          // upright lines along the aisle (bay pitch 1.925 m)
  crateZ: [-1.925, -1.05, 0, 0.875, 1.925, 2.80],
};
export const CLR = { below: 0.04, lift: CRANE.liftDz, tLift: CRANE.tLift };   // approach 40 mm under the crate floor, lift 100 mm in 0.5 s (core)
CLR.free = CLR.lift - CLR.below;                                       // 60 mm crate free above the beams
CLR.midToBeam = CR.runH - CLR.below + FG.yM[0];                        // 0.12 − 0.04 − 0.052 = 0.028 m middle stage over the beam
CLR.side = CR.runZ - CR.runW / 2 - (FG.tineZ + FG.wM / 2);             // runner ↔ middle stage, 30 mm
CLR.sideTop = CR.runZ - CR.runW / 2 - (FG.tineZ + FG.wT / 2);          // runner ↔ top stage, 45 mm
CLR.guide = (RK.crateZ[3] - RK.crateZ[2]) / 2 - CR.W / 2 - 0.01;       // crate ↔ load guide (guide 20 mm in the 75 mm gap), 27.5 mm

/* ---------------------------------------------------------------- fork motion (core trapezoid) */
export const FM = { v: CRANE.vf, a: CRANE.af, vLoaded: CRANE.vf, aLoaded: CRANE.af };
export const forkT = (d = FG.stroke, v = FM.v, a = FM.a) => trapTime(d, v, a);

/* ---------------------------------------------------------------- the cycle: pick from L (bay 2, level 2) → store into R (bay 3, level 3)
 * segment: { k, n, dur, z0, z1 (travel), y0, y1 (tine top), s0, s1 (top stage), lin (linear hoist), crate: "L" | "fork" | "lift" | "lower" | "R" | "Rback" }
 */
export const POS = { z0: RK.crateZ[0], zL: RK.crateZ[2], zR: RK.crateZ[4], bL: RK.levels[1], bR: RK.levels[2], b0: RK.levels[0] };
export const FAULTS = ["offset", "occupied", "chain", "obstacle", "notcentre", "overload"];
export function plan(o = {}) {
  const fault = o.fault || null, gentle = !!o.gentle, st = FG.stroke;
  const vL = gentle ? 0.8 : FM.vLoaded, aL = gentle ? 0.8 : FM.aLoaded;
  const tine0 = POS.b0 + CR.runH - CLR.below;            // start: level 1, pick height
  const yPickL = POS.bL + CR.runH - CLR.below;           // tine top 40 mm under the crate floor (slot L)
  const yDropR = POS.bR + CR.runH + CLR.free;            // crate runners 60 mm above the beams (slot R)
  const S = [];
  const add = (k, n, dur, x) => { const p = S.length ? S[S.length - 1] : { z1: POS.z0, y1: tine0, s1: 0, crate: "L" }; S.push(Object.assign({ k, n, dur, z0: p.z1, z1: p.z1, y0: p.y1, y1: p.y1, s0: p.s1, s1: p.s1, crate: p.crate === "lift" ? "fork" : p.crate === "lower" ? "R" : p.crate }, x)); };
  add("travel1", "Travel + hoist to slot L-02-1-2", moveTime(POS.z0, tine0, POS.zL, yPickL), { z1: POS.zL, y1: yPickL, crate: "L" });
  add("pos1", "Fine positioning ± 3 mm (x and z) + slot check", CRANE.tPos, {});
  if (fault === "obstacle") { // fork hits a fallen casting at |X| ≈ 1.40 m – torque monitoring stops it
    const sHit = -(1.40 - FG.L / 2 - 0.027), d = Math.abs(sHit), tHit = tAtDist(d, FM.v, FM.a, st);
    add("out1", "Fork out to L under the crate – HITS AN OBSTACLE", tHit + 0.15, { s1: sHit, sAt: (t) => -Math.min(d, trapPosPartial(t, st, FM.v, FM.a, tHit)), stop: true });
    S.at = S.length - 1; S.alarm = "obstacle"; return finish(S, fault);
  }
  add("out1", "Fork out to L under the crate (top stage − 1.35 m)", forkT(st), { s1: -st });
  if (fault === "chain") { S.at = S.length - 1; S.alarm = "chain"; }
  if (fault === "chain") return finish(S, fault);
  if (fault === "overload") {
    add("lift1", "Lift – crate gets heavy: load pins see 360 kg", 0.30, { y1: yPickL + 0.06, lin: true, crate: "lift" });
    add("lower1", "Overload! Lower the crate back onto the beams", 0.30, { y1: yPickL, lin: true, crate: "lowerL" });
    add("in1", "Fork in EMPTY (slowly), alarm to the WMS", forkT(st), { s1: 0, crate: "L" });
    S.at = S.length - 1; S.alarm = "overload"; return finish(S, fault);
  }
  add("lift1", "Lift 100 mm: 40 mm to touch + 60 mm free", CLR.tLift, { y1: yPickL + CLR.lift, lin: true, crate: "lift" });
  add("in1", "Fork in with the load", forkT(st, vL, aL), { s1: fault === "notcentre" ? -0.03 : 0, crate: "fork", vv: vL, aa: aL });
  add("chk1", "Checks: load on fork, overhang, centre position, encoder vs. switch", 0, {});
  if (fault === "offset" || fault === "notcentre") { S.at = S.length - 1; S.alarm = fault; return finish(S, fault); }
  add("travel2", "Travel + hoist to slot R-03-1-3 (with the crate)", moveTime(POS.zL, yPickL + CLR.lift, POS.zR, yDropR), { z1: POS.zR, y1: yDropR });
  add("pos2", "Fine positioning ± 3 mm + occupancy check of the target slot", CRANE.tPos, {});
  if (fault === "occupied") { S.at = S.length - 1; S.alarm = "occupied"; return finish(S, fault); }
  add("out2", "Fork out to R with the crate", forkT(st, vL, aL), { s1: st, vv: vL, aa: aL });
  add("lower2", "Lower 100 mm: 60 mm to set down + 40 mm free", CLR.tLift, { y1: yDropR - CLR.lift, lin: true, crate: "lower" });
  add("in2", "Fork in empty – WMS books the slot", forkT(st), { s1: 0, crate: "R" });
  return finish(S, fault);
}
function finish(S, fault) {
  let t = 0; S.forEach((g, i) => { g.t0 = t; t += g.dur; g.t1 = t; g.i = i; });
  S.T = t; S.fault = fault; if (S.at === undefined) S.at = -1;
  return S;
}
/* time to cover distance d on a trapezoid profile that is planned for the full stroke D */
function tAtDist(d, v, a, D) { const T = trapTime(D, v, a); let lo = 0, hi = T; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (Math.abs(trapPos(D, v, a, m)) < d) lo = m; else hi = m; } return hi; }
function trapPosPartial(t, D, v, a, tHit) { return Math.abs(trapPos(D, v, a, Math.min(t, tHit))); }

/* state of the whole scene at time t (s) */
export function stateAt(S, t, o = {}) {
  t = Math.max(0, Math.min(S.T, t));
  let g = S[S.length - 1]; for (const s of S) if (t < s.t1 || s === S[S.length - 1]) { g = s; break; }
  if (g.dur === 0 && S.length > g.i + 1 && t >= g.t1 && g.i !== S.at) g = S[g.i + 1];
  const u = Math.max(0, t - g.t0);
  let z = g.z0, y = g.y0, s = g.s0, vS = 0, vZ = 0, vY = 0;
  if (g.z1 !== g.z0 || (g.y1 !== g.y0 && !g.lin)) { z = g.z0 + trapPos(g.z1 - g.z0, CRANE.vx, CRANE.ax, u); y = g.y0 + trapPos(g.y1 - g.y0, CRANE.vz, CRANE.az, u); vZ = trapVel(g.z1 - g.z0, CRANE.vx, CRANE.ax, u); vY = trapVel(g.y1 - g.y0, CRANE.vz, CRANE.az, u); }
  if (g.lin) { const p = g.dur > 0 ? Math.min(1, u / g.dur) : 1; y = g.y0 + (g.y1 - g.y0) * p; vY = g.dur > 0 && p < 1 ? (g.y1 - g.y0) / g.dur : 0; }
  if (g.sAt) { s = g.sAt(u); const s2 = g.sAt(u + 0.01); vS = (s2 - s) / 0.01; }
  else if (g.s1 !== g.s0) { const vv = g.vv || FM.v, aa = g.aa || FM.a; s = g.s0 + trapPos(g.s1 - g.s0, vv, aa, u); vS = trapVel(g.s1 - g.s0, vv, aa, u); }
  const chainErr = S.fault === "chain" ? -0.025 * Math.sign(s) * Math.min(1, Math.abs(s) / FG.stroke) : 0;   // top stage lags 25 mm at full stroke
  const sTop = s + chainErr, sMid = s / 2;
  /* crate */
  const offX = S.fault === "offset" ? 0.06 : 0;                  // crate pushed 60 mm towards the aisle in slot L
  const restL = { x: -FG.stroke + offX, y: POS.bL + CR.runH, z: POS.zL }, restR = { x: FG.stroke, y: POS.bR + CR.runH, z: POS.zR };
  let cr;
  const onFork = (base) => ({ x: sTop + (base ? base.dx : 0), y: y, z: z });
  const dxPick = restL.x - (-FG.stroke);                        // offset relative to the tine centre when picked
  switch (g.crate) {
    case "L": cr = { ...restL, on: false }; break;
    case "lift": cr = { x: restL.x, y: Math.max(restL.y, y), z: restL.z, on: y > restL.y + 1e-6 }; break;
    case "lowerL": cr = { x: restL.x, y: Math.max(restL.y, y), z: restL.z, on: y > restL.y + 1e-6 }; break;
    case "fork": cr = { ...onFork({ dx: dxPick }), on: true }; break;
    case "lower": cr = { x: sTop + dxPick, y: Math.max(restR.y, y), z: restR.z, on: y > restR.y + 1e-6 }; break;
    default: cr = { ...restR, x: restR.x + dxPick, on: false };
  }
  /* sensors */
  const crateOnCarr = cr.on && Math.abs(cr.x - sTop) < 1 && Math.abs(sTop) < 0.05;
  const alarmNow = S.at >= 0 && g.i === S.at && (t >= g.t1 - 1e-6 || g.stop && u > g.dur - 0.16);
  const sens = {
    centre: Math.abs(sTop) < 0.005,
    endL: sTop <= -FG.stroke + 0.005, endR: sTop >= FG.stroke - 0.005,
    loadOn: cr.on && Math.abs(sTop - (cr.x - dxPick)) < 0.01,
    ovL: crateOnCarr && cr.x - CR.Lx / 2 < -CR.Lx / 2 - 0.02, ovR: crateOnCarr && cr.x + CR.Lx / 2 > CR.Lx / 2 + 0.02,
    occ: (g.k === "pos2" || g.k === "out2") && (S.fault === "occupied"),
    occL: (g.k === "pos1") ? true : false,
    inPos: g.k.startsWith("pos") && u > g.dur * 0.6 || g.k.startsWith("out") || g.k.startsWith("lift") || g.k.startsWith("lower") || (g.k.startsWith("in") && Math.abs(sTop) > 0.005),
    slip: Math.abs(chainErr) > 0.010,
    torque: S.fault === "obstacle" && g.k === "out1" && u > g.dur - 0.16,
    kg: cr.on ? (S.fault === "overload" ? 360 : 300) : 0,
  };
  return { t, g, u, z, y, s, sTop, sMid, vS, vZ, vY, crate: cr, sens, alarm: alarmNow ? S.alarm : null, chainErr };
}

/* ---------------------------------------------------------------- design calculations (live inputs) */
export const DEF7 = { m: 300, mf: 150, stroke: 1.35, v: 1.0, a: 1.2, mu: 0.05, eta: 0.8, d: 40, nM: 1400, L: 1.0, IB: 3.0e6, IM: 1.2e6, IT: 0.6e6, play: 0.4, slope: 3, enc: 4096, bl: 10, rb: 0.10, el: 0.1, Fb: 8900, kpk: 2.5 };
export const INP7 = [
  ["m", "load (crate + castings)", "kg"], ["mf", "moving fork mass allowance (stages, chains, rotating parts)", "kg"], ["stroke", "stroke of the top stage", "m"],
  ["v", "fork speed (top stage)", "m/s"], ["a", "fork acceleration", "m/s²"], ["mu", "friction coefficient (rollers + guides)", "–"], ["eta", "efficiency motor → tine", "–"],
  ["d", "pinion pitch diameter", "mm"], ["nM", "motor speed at full fork speed", "rpm"], ["L", "stage length", "m"], ["play", "play per overlap (rollers)", "mm"],
  ["slope", "slope of the fork (deflection / tilt)", "mm/m"], ["el", "chain wear elongation", "%"],
];
export function calc7(inp = {}) {
  const P = Object.assign({}, DEF7, inp), g = 9.81, E = 210000;
  const R = {}, S = [];
  const sec = (id, t, note) => { const o = { id, t, note, rows: [] }; S.push(o); return o; };
  const row = (s, item, formula, value, unit, ok, check = "") => { s.rows.push({ item, formula, value, unit, ok, check }); return value; };
  /* A kinematics */
  let s = sec("kin", "A · Kinematics – stroke doubling", "The motor moves only the middle stage. The chains (or belts) move the top stage twice as far and twice as fast.");
  R.sMid = row(s, "middle stage stroke s_mid", `s_mid = s_top / 2 = ${P.stroke} / 2`, P.stroke / 2, "m", null, "rack + pinion move this");
  R.vMid = row(s, "middle stage speed v_mid", `v_mid = v_top / 2 = ${P.v} / 2`, P.v / 2, "m/s", null);
  R.aMid = row(s, "middle stage acceleration", `a_mid = a_top / 2 = ${P.a} / 2`, P.a / 2, "m/s²", null);
  R.tF = row(s, "time for one stroke t_f", `s/v + v/a = ${P.stroke}/${P.v} + ${P.v}/${P.a}`, trapTime(P.stroke, P.v, P.a), "s", Math.abs(trapTime(P.stroke, P.v, P.a) - 2.183) < 0.01 ? true : null, "core 2.18 s (items 1, 6)");
  R.tAcc = row(s, "acceleration time", `t_a = v / a`, P.v / P.a, "s", null, P.stroke >= P.v * P.v / P.a ? "full speed reached" : "triangle profile – full speed not reached");
  R.lhd = row(s, "load handling at one stop t_LHD", `2 · t_f + t_lift = 2 · ${R.tF.toFixed(3)} + ${CRANE.tLift}`, 2 * R.tF + CRANE.tLift, "s", Math.abs(2 * R.tF + CRANE.tLift - lhdTime()) < 0.01 ? true : null, `core lhdTime ${lhdTime().toFixed(2)} s`);
  /* B gear transfer */
  s = sec("gear", "B · Gear transfer – motor → gearbox → shaft → pinion → rack", "v = π · d · n / 60. The pinion drives the rack on the middle stage, so it turns for v_mid, not for v_top.");
  R.nP = row(s, "pinion speed n_p", `n = v_mid · 60 / (π · d) = ${R.vMid} · 60 / (π · ${P.d / 1000})`, R.vMid * 60 / (Math.PI * P.d / 1000), "rpm", null);
  R.i = row(s, "gear ratio i", `i = n_motor / n_p = ${P.nM} / ${R.nP.toFixed(1)}`, P.nM / R.nP, "–", R.nP > 0 ? true : false, "choose the nearest catalogue ratio, then set the drive frequency");
  R.z = row(s, "pinion teeth z (module 2)", `z = d / m = ${P.d} / 2`, P.d / 2, "–", P.d / 2 >= 17 ? true : false, "≥ 17 teeth: no undercut");
  R.rackL = row(s, "rack length on the middle stage", "= stage length L (teeth over the full stage)", P.L, "m", P.L >= P.stroke ? true : null, P.L >= P.stroke ? "one central pinion is enough (L ≥ 2·s_mid)" : "L < 2·s_mid → one central pinion would run off the rack → 2 pinions per tine");
  R.mesh = row(s, "mesh margin, 2 pinions at ± 0.30 m", `L/2 − (s_mid − 0.30) = ${P.L / 2} − (${R.sMid} − 0.30)`, (P.L / 2 - Math.abs(R.sMid - FG.pinX)) * 1000, "mm", P.L / 2 - Math.abs(R.sMid - FG.pinX) >= 0.05 ? true : false, "≥ 50 mm (several teeth in mesh)");
  R.uM = row(s, "motor turns for one full stroke", `s_mid / (π · d) · i`, (P.stroke / 2) / (Math.PI * P.d / 1000) * R.i, "rev", null, "encoder counts these");
  /* C forces + power */
  s = sec("force", "C · Forces, torque and motor power", "Guide 31 §7.8: F = m·a + μ·m·g with m = load + 150 kg fork allowance, referred to the tine speed. Power is the same at every point of the train: F_top · v_top = F_rack · v_mid.");
  const mt = P.m + P.mf;
  R.Fa = row(s, "acceleration force", `m · a = ${mt} · ${P.a}`, mt * P.a, "N", null);
  R.Fr = row(s, "friction force", `μ · m · g = ${P.mu} · ${mt} · 9.81`, P.mu * mt * g, "N", null);
  R.Fs = row(s, "slope force (fork tilted)", `m · g · slope = ${mt} · 9.81 · ${P.slope}/1000`, mt * g * P.slope / 1000, "N", null, "small, but add it");
  R.F = row(s, "force at the tines F_top (both tines)", "F_acc + F_fric (+ slope)", R.Fa + R.Fr, "N", Math.abs(R.Fa + R.Fr - 761.1) < 1 ? true : null, "guide 31: 761 N");
  R.T = row(s, "chain force T per tine", `T = F_top / 2 tines = ${R.F.toFixed(0)} / 2`, R.F / 2, "N", null, "the chain pulls the top stage");
  R.Fspr = row(s, "force on the sprocket axle per tine", "2 · T (chain wraps the sprocket: both strands pull)", R.F, "N", null, "= what the middle stage must push");
  R.Frack = row(s, "rack force (both pinions)", `F_rack = F_top · v_top / v_mid = 2 · F_top`, 2 * R.F, "N", null, "chain force = half of this");
  R.Mp = row(s, "torque on the synchronising shaft", `M = F_rack · d/2 = ${(2 * R.F).toFixed(0)} · ${P.d / 2000}`, 2 * R.F * P.d / 2000, "N·m", null, `${(R.F * P.d / 2000).toFixed(1)} N·m per pinion`);
  R.Mm = row(s, "motor torque", `M_m = M / (i · η) = ${(2 * R.F * P.d / 2000).toFixed(1)} / (${R.i.toFixed(2)} · ${P.eta})`, 2 * R.F * P.d / 2000 / (R.i * P.eta), "N·m", null);
  R.P = row(s, "motor power", `P = F_top · v / η = ${R.F.toFixed(0)} · ${P.v} / ${P.eta}`, R.F * P.v / P.eta, "W", R.F * P.v / P.eta <= 1100 ? true : false, "motor 1.1 kW (guide 31 / 38)");
  R.Mn = row(s, "rated torque of a 1.1 kW motor", `9 550 · 1.1 / ${P.nM}`, 9550 * 1.1 / P.nM, "N·m", R.Mm <= 9550 * 1.1 / P.nM ? true : false, `use ${(R.Mm / (9550 * 1.1 / P.nM) * 100).toFixed(0)} %`);
  R.Tpk = row(s, "chain force at motor peak torque (jam / collision)", `T_pk = ${P.kpk} · M_n · i · η / (d/2) / 2 tines / 2`, P.kpk * R.Mn * R.i * P.eta / (P.d / 2000) / 2 / 2, "N", null, "torque limit in the drive keeps it lower");
  R.SF = row(s, "chain safety factor (06B-1, F_B ≥ 8.9 kN – check)", `F_B / T_pk = ${P.Fb} / ${R.Tpk.toFixed(0)}`, P.Fb / R.Tpk, "–", P.Fb / R.Tpk >= 6 ? true : false, "≥ 6 (example rule for drive chains – check)");
  /* D deflection */
  s = sec("defl", "D · Deflection – 3 stages as cantilevers in series (guide 38 §7.7)", "Per tine F = m·g/2 at the full reach a. The base stage carries 0 → L/2, the middle stage L/2 → s_mid + L/2, the top stage the rest. δ = Σ F/(3·E·I) · [(a − x₀)³ − (a − x₁)³].");
  const F1 = P.m * g / 2, a = P.stroke * 1000, x1 = P.L / 2 * 1000, x2 = (P.stroke / 2 + P.L / 2) * 1000;
  R.Ft = row(s, "load per tine F", `${P.m} · 9.81 / 2`, F1, "N", null);
  const z1 = (Math.pow(a, 3) - Math.pow(Math.max(0, a - x1), 3)) / 3 / P.IB, z2 = (Math.pow(Math.max(0, a - x1), 3) - Math.pow(Math.max(0, a - x2), 3)) / 3 / P.IM, z3 = Math.pow(Math.max(0, a - x2), 3) / 3 / P.IT;
  R.d1 = row(s, "zone 1 base stage (0 – " + x1.toFixed(0) + " mm)", `F/E · [(a)³ − (a − ${x1.toFixed(0)})³] / (3 · ${P.IB.toExponential(1)})`, F1 / E * z1, "mm", null);
  R.d2 = row(s, `zone 2 middle stage (${x1.toFixed(0)} – ${x2.toFixed(0)} mm)`, `I = ${P.IM.toExponential(1)} mm⁴`, F1 / E * z2, "mm", null);
  R.d3 = row(s, `zone 3 top stage (${x2.toFixed(0)} – ${a.toFixed(0)} mm)`, `I = ${P.IT.toExponential(1)} mm⁴`, F1 / E * z3, "mm", null);
  R.dE = row(s, "elastic tip deflection", "zone 1 + 2 + 3", R.d1 + R.d2 + R.d3, "mm", Math.abs(R.d1 + R.d2 + R.d3 - 2.64) < 0.02 ? true : null, "guide 38: 2.64 mm");
  R.ov = row(s, "overlap of two stages at full stroke", `o = L − s_mid = ${P.L} − ${R.sMid}`, (P.L - R.sMid) * 1000, "mm", P.L - R.sMid >= 0.25 * P.L ? true : false, "≥ ¼ L (rule of thumb)");
  R.rs = row(s, "roller spacing in the overlap", "e = o − 2 × 12.5 mm", R.ov - 25, "mm", null);
  R.dP = row(s, "tilt from roller play", `2 overlaps · ${P.play} / e · (a − L/2) = 2 · ${P.play} / ${R.rs.toFixed(0)} · ${(a - x1).toFixed(0)}`, 2 * P.play / R.rs * (a - x1), "mm", null, "same size as the elastic part!");
  R.dT = row(s, "tip deflection total", "elastic + play", R.dE + R.dP, "mm", R.dE + R.dP <= 5.0 ? true : false, "≤ 5 mm z-budget (guide 31 §9); guide 38: 4.9 mm");
  R.sig = row(s, "stress in the middle stage at x = L/2", `σ = F · (a − L/2) / (I_M / 32)`, F1 * (a - x1) / (P.IM / 32), "MPa", F1 * (a - x1) / (P.IM / 32) < 690 / 1.5 / 3 ? true : false, "S690QL: far below; stiffness decides, not strength");
  R.M0 = row(s, "root moment per tine", `F · a = ${F1.toFixed(0)} · ${P.stroke}`, F1 * P.stroke / 1000, "kN·m", null, "goes into the lifting carriage");
  /* E roller loads */
  s = sec("roll", "E · Roller loads in the overlap (reaction couple)", "Each stage is a short beam held by 2 roller rows: the front roller (at the tip of the stage below) pushes up, the rear roller (at the stage's rear end) holds down. Short overlap → large couple.");
  const e = R.rs / 1000, xbF = P.L / 2 - FG.rollIn, xmR = R.sMid - P.L / 2 + FG.rollIn, xmF = R.sMid + P.L / 2 - FG.rollIn, xtR = P.stroke - P.L / 2 + FG.rollIn, aa = P.stroke;
  R.R1f = row(s, "base → middle, front roller (up)", `F · (a − x_rear) / e = ${F1.toFixed(0)} · (${aa} − ${xmR.toFixed(4)}) / ${e.toFixed(3)}`, F1 * (aa - xmR) / e, "N", null, "per tine, 2 rollers share it");
  R.R1r = row(s, "base → middle, rear roller (down)", `F · (a − x_front) / e`, F1 * (aa - xbF) / e, "N", null);
  R.R2f = row(s, "middle → top, front roller (up)", `F · (a − ${xtR.toFixed(4)}) / e`, F1 * (aa - xtR) / e, "N", null);
  R.R2r = row(s, "middle → top, rear roller (down)", `F · (a − ${xmF.toFixed(4)}) / e`, Math.max(0, F1 * (aa - xmF) / e), "N", null);
  R.Rmax = row(s, "max. load per roller (2 rollers per row)", "R1f / 2", R.R1f / 2, "N", null, "choose a cam follower with static rating C₀ ≥ 2 × this (datasheet)");
  /* F accuracy */
  s = sec("acc", "F · Positioning accuracy of the tine (fork direction)", "Every error of the middle stage counts twice at the top stage. Chain wear adds directly.");
  const r = P.d / 2;
  R.eEnc = row(s, "encoder resolution at the tine", `2 · π · d / (N · i) = 2 · π · ${P.d} / (${P.enc} · ${R.i.toFixed(2)})`, 2 * Math.PI * P.d / (P.enc * R.i), "mm", null, "motor encoder 4 096 counts/rev");
  R.eBl = row(s, "gearbox backlash at the tine", `2 · r · θ = 2 · ${r} · ${P.bl}′ (in rad)`, 2 * r * P.bl / 60 * Math.PI / 180, "mm", null, `${P.bl} arcmin (catalogue)`);
  R.eRb = row(s, "rack ↔ pinion backlash at the tine", `2 · ${P.rb}`, 2 * P.rb, "mm", null);
  const Lc = 2 * (FG.spr + FG.anc) + Math.PI * FG.sprR;
  R.Lc = row(s, "chain length per chain", `2 · (0.46 + 0.30) + π · r_spr`, Lc * 1000, "mm", null);
  R.eCh = row(s, `chain wear elongation ${P.el} % → lag of the top stage`, `ΔL = ${P.el}/100 · ${(Lc * 1000).toFixed(0)}`, P.el / 100 * Lc * 1000, "mm", P.el / 100 * Lc * 1000 <= 2 ? true : false, "re-tension at ≈ 2 mm; replace at 2–3 % (chain maker)");
  R.eSum = row(s, "RSS tine position error", "√(Σ e²)", Math.hypot(R.eEnc, R.eBl, R.eRb, R.eCh), "mm", Math.hypot(R.eEnc, R.eBl, R.eRb, R.eCh) <= 5 ? true : false, "≤ ± 5 mm in depth (example), slip alarm at 10 mm");
  return { R, S, P };
}
/* hand-check values (Python: scratchpad frk/verify7.py) */
export const CHECK7 = { tF: 2.18333, lhd: 4.86667, nP: 238.732, i: 5.86431, F: 760.725, T: 380.3625, Frack: 1521.45, Mp: 30.429, Mm: 6.48606, P: 950.906, dE: 2.64322, dP: 2.26667, dT: 4.90989, sig: 33.354, R1f: 5702.06, R1r: 4230.56, R2f: 2391.19, R2r: 919.688, eCh: 1.56367, eSum: 1.58073, SF: 8.0903 };
