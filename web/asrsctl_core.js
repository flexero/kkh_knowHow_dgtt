/* AS/RS tab – item 2 "Control system": PURE MATH (no DOM). Used by asrsctl.js (UI) and the self-check (&sr2test).
 * Crane data come from asrscore.js (CRANE, RACK). Extra control data (sway frequency, loop gains, masses for the
 * energy model, stop data) are EXAMPLES – the AS/RS supplier's offer and the drive commissioning decide.
 * Guide: docs/32_asrs_control_system.md (all formulas + worked numbers, verified with Python).
 */
import { CRANE, RACK, trapTime, trapPos, trapVel } from "./asrscore.js";

export const G = 9.81;
export const CC = {               // control + drive data (examples)
  jx: 0.6, jz: 1.0, jf: 3.0,      // jerk limits m/s³ (travel jerk = a·f_mast → ramp time = 1 mast period)
  fMast: 1.2, zeta: 0.02,         // first mast bending mode Hz, structural damping ratio
  zetaActive: 0.20,               // effective damping with active sway damping in the travel drive
  Kv: 2.0, wv: 20, Ti: 0.2, Tc: 0.002, ff: 0.95,   // position gain 1/s, speed loop bandwidth rad/s, integral time s, current loop s, feedforward
  mTravel: CRANE.mass + 300,      // kg moving in travel (crane + full crate)
  mCarriage: 900,                 // kg lifting carriage with telescopic fork (example)
  rolling: 0.005,                 // rolling resistance travel wheels (steel on steel incl. guide rollers)
  etaMot: 0.92, etaInv: 0.97, etaGear: 0.90, etaHoist: 0.85,
  tReact1: 0.15, aStop1: 1.0,     // Stop Cat 1: reaction s, drive ramp m/s² (SS1)
  tReact0: 0.30, aStop0: 0.7,     // Stop Cat 0: reaction incl. brake closing s, brake decel m/s² (wheel slip limit μ·g·share)
  muRail: 0.15, driveShare: 0.5,
  cDC: 4e-3, uDC: 565, uChop: 760, // DC link capacitance F, nominal V (1.41 × 400 V), chopper threshold V
  vSlow: 1.0, xSlow: 8.0,         // safe reduced speed near the aisle ends m/s, zone length m
  bufA: 5.0,                      // buffer deceleration m/s² (≈ 0.5 g)
  tolX: 3, tolZ: 3, tolMax: 5,    // positioning tolerance ± mm (example)
  laserOff: 0.35,                 // m, laser on the aisle-end wall: reading = x + offset (example)
};

/* ------------------------------------------------------------------ jerk-limited (S-curve, 7-phase) move */
function phases(d, v, a, j) {     // returns [[jerk, duration] ...] for a rest-to-rest move of d ≥ 0
  d = Math.abs(d); if (d < 1e-9) return [];
  const dist = (vp) => { const ap = Math.min(a, Math.sqrt(vp * j)); return vp * (vp / ap + ap / j); };
  let vp = v;
  if (dist(v) > d) { let lo = 0, hi = v; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (dist(m) > d) hi = m; else lo = m; } vp = lo; }
  const ap = Math.min(a, Math.sqrt(vp * j)), tj = ap / j, ta = Math.max(0, vp / ap - tj), tv = Math.max(0, (d - dist(vp)) / Math.max(vp, 1e-9));
  return [[j, tj], [0, ta], [-j, tj], [0, tv], [-j, tj], [0, ta], [j, tj]];
}
export function scurveTime(d, v, a, j) { return phases(d, v, a, j).reduce((s, p) => s + p[1], 0); }
/** state {p, v, a} at time t of the S-curve move of distance d (signed) */
export function scurveAt(d, v, a, j, t) {
  const s = Math.sign(d) || 1, ph = phases(d, v, a, j);
  let p = 0, vv = 0, aa = 0, tt = Math.max(0, t);
  for (const [jk, du] of ph) {
    const h = Math.min(du, tt);
    p += vv * h + aa * h * h / 2 + jk * h * h * h / 6; vv += aa * h + jk * h * h / 2; aa += jk * h;
    tt -= h; if (tt <= 0) break;
  }
  if (t >= scurveTime(d, v, a, j)) { p = Math.abs(d); vv = 0; aa = 0; }
  return { p: s * p, v: s * vv, a: s * aa };
}
export function trapAcc(d, v, a, t) {
  const s = Math.sign(d); d = Math.abs(d); const T = trapTime(d, v, a); if (t <= 0 || t >= T) return 0;
  const vp = Math.min(v, Math.sqrt(d * a)), ta = vp / a;
  return s * (t < ta ? a : t < T - ta ? 0 : -a);
}
/** sampled profile of one crane move (travel + hoist together) – trapezoid as the core, or S-curve */
export function moveProfile(dx, dz, opt = {}) {
  const sc = !!opt.scurve, n = opt.n || 240;
  const Tx = sc ? scurveTime(dx, CRANE.vx, CRANE.ax, CC.jx) : trapTime(dx, CRANE.vx, CRANE.ax);
  const Tz = sc ? scurveTime(dz, CRANE.vz, CRANE.az, CC.jz) : trapTime(dz, CRANE.vz, CRANE.az);
  const T = Math.max(Tx, Tz, 1e-3), o = { T, Tx, Tz, t: [], x: [], vx: [], ax: [], z: [], vz: [], az: [] };
  for (let i = 0; i <= n; i++) {
    const t = T * i / n; o.t.push(t);
    if (sc) { const X = scurveAt(dx, CRANE.vx, CRANE.ax, CC.jx, t), Z = scurveAt(dz, CRANE.vz, CRANE.az, CC.jz, t); o.x.push(X.p); o.vx.push(X.v); o.ax.push(X.a); o.z.push(Z.p); o.vz.push(Z.v); o.az.push(Z.a); }
    else { o.x.push(trapPos(dx, CRANE.vx, CRANE.ax, t)); o.vx.push(trapVel(dx, CRANE.vx, CRANE.ax, t)); o.ax.push(trapAcc(dx, CRANE.vx, CRANE.ax, t));
      o.z.push(trapPos(dz, CRANE.vz, CRANE.az, t)); o.vz.push(trapVel(dz, CRANE.vz, CRANE.az, t)); o.az.push(trapAcc(dz, CRANE.vz, CRANE.az, t)); }
  }
  return o;
}
/** hoist speed that makes both axes arrive together (same acceleration): d = v'·(T − v'/a) */
export function syncSpeed(dz, T, a = CRANE.az, vmax = CRANE.vz) {
  dz = Math.abs(dz); if (dz < 1e-9) return 0; const disc = T * T - 4 * dz / a; if (disc < 0) return vmax;
  return Math.min(vmax, (T - Math.sqrt(disc)) * a / 2);
}

/* ------------------------------------------------------------------ mast sway: 2-mass model (base driven, top on a spring) */
/* relative top deflection q:  q'' + 2ζω q' + ω² q = −a_base(t)   ω = 2π f.  Static deflection under a = a/ω². */
export function swaySim(accFn, T, opt = {}) {
  const w = 2 * Math.PI * (opt.f || CC.fMast), z = opt.zeta ?? CC.zeta, dt = 0.002, tEnd = T + (opt.after ?? 4);
  let q = 0, dq = 0; const o = { t: [], q: [], a: [] };
  for (let t = 0, k = 0; t <= tEnd + 1e-9; t += dt, k++) {
    const a = t <= T ? accFn(t) : 0;
    const ddq = -a - 2 * z * w * dq - w * w * q; dq += ddq * dt; q += dq * dt;      // semi-implicit Euler (stable)
    if (k % 10 === 0) { o.t.push(t); o.q.push(q * 1000); o.a.push(a); }
  }
  let res = 0, last = T; for (let i = 0; i < o.t.length; i++) { if (o.t[i] > T + 1) res = Math.max(res, Math.abs(o.q[i])); if (o.t[i] > T && Math.abs(o.q[i]) > 2) last = o.t[i]; }
  o.residual = res; o.settle2 = last - T;           // max |q| from 1 s after the stop; time after the stop until |q| stays < 2 mm
  o.static = (opt.amax || CRANE.ax) / (w * w) * 1000;
  return o;
}
/** residual amplitude after one acceleration ramp of duration tr (undamped):  a/ω² · |sin(ω tr/2)/(ω tr/2)| */
export function residualFactor(tr, f = CC.fMast) { const x = Math.PI * f * tr; return x < 1e-9 ? 1 : Math.abs(Math.sin(x) / x); }

/* ------------------------------------------------------------------ cascade position control of the travel axis */
/* position P (Kv) + speed feedforward → speed PI (Kp = m·ω_v, Ti) → current/force loop (1st order Tc, limit) → rigid mass m.
 * Returns the following error (mm) over the move – shows why feedforward is needed with the low Kv of a tall crane. */
export function servoSim(d, opt = {}) {
  const m = opt.m || CC.mTravel, Kv = opt.Kv ?? CC.Kv, wv = opt.wv ?? CC.wv, Ti = opt.Ti ?? CC.Ti, ff = opt.ff ?? CC.ff, Tc = CC.Tc;
  const Kp = m * wv, Fmax = m * CRANE.ax * 2.0 + m * G * CC.rolling, Tm = trapTime(d, CRANE.vx, CRANE.ax), tEnd = Tm + 3, dt = 0.001;
  let x = 0, v = 0, F = 0, I = 0; const o = { t: [], err: [], F: [], v: [], Kp, Fmax, T: Tm };
  let eMax = 0, eEnd = 0, settle = null;
  for (let t = 0, k = 0; t <= tEnd; t += dt, k++) {
    const xr = trapPos(d, CRANE.vx, CRANE.ax, t), vr = trapVel(d, CRANE.vx, CRANE.ax, t), ar = trapAcc(d, CRANE.vx, CRANE.ax, t);
    const e = xr - x, vc = Kv * e + ff * vr, ev = vc - v;
    I += ev * dt / Ti;
    let Fc = Kp * (ev + I) + ff * m * ar; Fc = Math.max(-Fmax, Math.min(Fmax, Fc));
    if (Math.abs(Fc) >= Fmax) I -= ev * dt / Ti;                // anti wind-up
    F += (Fc - F) * dt / Tc;
    const Fr = m * G * CC.rolling * Math.tanh(v * 50);
    v += (F - Fr) / m * dt; x += v * dt;
    eMax = Math.max(eMax, Math.abs(e)); if (t > Tm) { eEnd = e; if (settle === null && Math.abs(e) < 0.001) settle = t - Tm; if (Math.abs(e) >= 0.001) settle = null; }
    if (k % 20 === 0) { o.t.push(t); o.err.push(e * 1000); o.F.push(F / 1000); o.v.push(v); }
  }
  o.eMax = eMax * 1000; o.eEnd = eEnd * 1000; o.settle = settle; o.eStatic = (1 - ff) * CRANE.vx / Kv * 1000;
  return o;
}

/* ------------------------------------------------------------------ stopping, buffers, light curtain */
export const stopDist = (v, tr, a) => v * tr + v * v / (2 * a);
export const stopTime = (v, tr, a) => tr + v / a;
export const brakeLimit = () => CC.muRail * G * CC.driveShare;           // m/s², wheel slip limit of the braked wheels
export const bufferStroke = (v, a = CC.bufA) => v * v / (2 * a);
export const isoS = (T, K = 1600, C = 850) => K * T + C;                   // ISO 13855, mm (T in s)

/* ------------------------------------------------------------------ energy of one move (travel + hoist on one DC link) */
export function moveEnergy(dx, dz, loadKg = 250) {
  const p = moveProfile(dx, dz, { n: 300 }), mT = CRANE.mass + loadKg, mL = CC.mCarriage + loadKg;
  const dt = p.T / (p.t.length - 1), o = { t: p.t, Pt: [], Ph: [], Pdc: [], T: p.T };
  let inT = 0, regT = 0, inH = 0, regH = 0, peak = 0, regPeak = 0;
  for (let i = 0; i < p.t.length; i++) {
    const mechT = (mT * p.ax[i] + mT * G * CC.rolling * Math.sign(p.vx[i])) * p.vx[i];   // W at the wheels
    const mechH = mL * (G + p.az[i]) * p.vz[i];                                        // W at the hoist drum
    const eT = CC.etaMot * CC.etaInv * CC.etaGear, eH = CC.etaMot * CC.etaInv * CC.etaHoist;
    const elT = mechT >= 0 ? mechT / eT : mechT * eT, elH = mechH >= 0 ? mechH / eH : mechH * eH;
    o.Pt.push(elT / 1000); o.Ph.push(elH / 1000); o.Pdc.push((elT + elH) / 1000);
    if (elT > 0) inT += elT * dt; else regT -= elT * dt;
    if (elH > 0) inH += elH * dt; else regH -= elH * dt;
    peak = Math.max(peak, elT + elH); regPeak = Math.max(regPeak, -(elT + elH));
  }
  let net = 0, back = 0; for (const P of o.Pdc) { if (P > 0) net += P * 1000 * dt; else back -= P * 1000 * dt; }
  Object.assign(o, { inT: inT / 3600, regT: regT / 3600, inH: inH / 3600, regH: regH / 3600, netIn: net / 3600, back: back / 3600, peak: peak / 1000, regPeak: regPeak / 1000,
    capJ: 0.5 * CC.cDC * (CC.uChop ** 2 - CC.uDC ** 2) });
  return o;
}

/* ------------------------------------------------------------------ IEC 62061 PFH, 1oo2 with diagnostics (architecture D) */
export function pfh1oo2(mttfdYears, DC, beta, T1h, T2h) {
  const l = 1 / (mttfdYears * 8760);
  return (1 - beta) ** 2 * (l * l * 2 * DC * T2h / 2 + l * l * (2 - 2 * DC) * T1h / 2) + beta * l;
}
export const plFromPfh = (p) => (p < 1e-7 ? "e" : p < 1e-6 ? "d" : p < 3e-6 ? "c" : p < 1e-5 ? "b" : "a");

/* ------------------------------------------------------------------ crane step chain (GRAFCET numbers = alarm A8sss) */
export const STEP = {
  idle:    { n: 10,  t: "Wait for job (WCS telegram)", to: null },
  toIO:    { n: 20,  t: "Travel + hoist to the I/O point", to: 1.5 },
  toSlot:  { n: 20,  t: "Travel + hoist to the rack slot", to: 1.5 },
  pos:     { n: 30,  t: "Fine positioning (slot reference sensor)", to: 6 },
  forkOut: { n: 40,  t: "Fork out (telescopic, 2 stages)", to: 5 },
  lift:    { n: 50,  t: "Lift load 100 mm (pick)", to: 2 },
  lower:   { n: 50,  t: "Lower load 100 mm (drop)", to: 2 },
  forkIn:  { n: 60,  t: "Fork in to centre (centre check)", to: 5 },
  estop:   { n: 900, t: "E-stop – STO + brakes", to: null },
  fault:   { n: 910, t: "Fault – crane stopped", to: null },
};
/** step numbers of a plan: each stop gets 30/40/50/60, moves 20, second job +100 */
export function planSteps(plan) {
  if (!plan) return [];
  const out = []; let job = 0, stopN = 0;
  plan.segs.forEach((s, i) => {
    if (s.ph === "toIO" || s.ph === "toSlot") stopN++;
    const base = STEP[s.ph] ? STEP[s.ph].n : 0;
    const jobIx = Math.min(plan.jobs.length - 1, Math.floor((stopN - 1) / 2));
    if (jobIx !== job) job = jobIx;
    const blk = (stopN - 1) % 2;                 // 0 = pick stop, 1 = drop stop of this job
    const n = job * 200 + blk * 100 + base;
    out.push({ i, ph: s.ph, n, t: STEP[s.ph] ? STEP[s.ph].t : s.ph, dur: s.dur, job: plan.jobs[job], what: blk ? "drop" : "pick", x1: s.x1, z1: s.z1 });
  });
  return out;
}

/* ------------------------------------------------------------------ WCS → PLC fixed-length telegram (example, 66 bytes) */
export const TG_FIELDS = [["STX", 1], ["Sender", 4], ["Receiver", 4], ["SeqNo", 4], ["Type", 2], ["JobId", 8], ["LU-ID", 10], ["Source", 12], ["Target", 12], ["Weight", 4], ["Status", 2], ["Check", 2], ["ETX", 1]];
const pad = (s, n, c = " ", left = false) => { s = String(s); if (s.length > n) return s.slice(0, n); return left ? c.repeat(n - s.length) + s : s + c.repeat(n - s.length); };
/** slot "L-03-1-5" → location code ASRS-RAW-A01L-L5-S05 (guide 15 format, two sides per aisle; S = bay·2 + k) */
export function locCode(slot) {
  if (!slot) return "IO";
  const [side, bay, k, lev] = slot.id.split("-"); const s = (+bay - 1) * 2 + +k;
  return `A01${side}-L${lev}-S${String(s).padStart(2, "0")}`;
}
export function telegram(job, seq, kg) {
  if (!job) return null;
  const typ = job.type === "store" ? "ST" : "RT";
  const src = job.type === "store" ? "IO-IN" : locCode(job.slot), dst = job.type === "store" ? locCode(job.slot) : "IO-OUT";
  const vals = { STX: "<", Sender: "WCS1", Receiver: "PLC1", SeqNo: pad(seq % 10000, 4, "0", true), Type: typ, JobId: pad(job.id, 8), "LU-ID": pad("CR" + job.id.slice(1).padStart(8, "0"), 10),
    Source: pad(src, 12), Target: pad(dst, 12), Weight: pad(Math.round(kg || 0), 4, "0", true), Status: "00", Check: "", ETX: ">" };
  let body = ""; for (const [f, n] of TG_FIELDS) if (f !== "Check" && f !== "ETX") body += pad(vals[f], n);
  let x = 0; for (let i = 1; i < body.length; i++) x ^= body.charCodeAt(i);         // XOR checksum over the data (STX excluded)
  vals.Check = x.toString(16).toUpperCase().padStart(2, "0");
  const str = TG_FIELDS.map(([f, n]) => pad(vals[f], n)).join("");
  return { str, vals, len: str.length, check: vals.Check };
}

/* ------------------------------------------------------------------ alarm list (guide 15: <Machine>_A<g><dd><n>, group 8 = A8sss) */
export const ALM = {
  A0011: ["System", "WCS telegram timeout (no life-bit for 3 s)", "crane finishes the step, then waits"],
  A0021: ["System", "Optical data link to the crane lost", "SS1 stop of all axes (PROFIsafe watchdog)"],
  A1011: ["Safety", "E-stop pressed", "Stop Cat 1 (SS1) then STO + SBC"],
  A1021: ["Safety", "Aisle door opened / access permission", "SS1 at the safe position, STO, door unlocked"],
  A1031: ["Safety", "Light curtain I/O interrupted without muting", "conveyor STO, crane fork out blocked at the I/O"],
  A1041: ["Safety", "End-of-aisle overrun – safe position limit", "Stop Cat 0, brakes, buffers"],
  A1051: ["Safety", "Safe speed exceeded in the end zone (SLS)", "Stop Cat 1 (SS1)"],
  A1061: ["Safety", "Hoist overspeed", "Stop Cat 0 + SBC, safety gear if > 130 %"],
  A1071: ["Safety", "Slack rope / belt", "Stop Cat 0 + SBC on the hoist"],
  A1081: ["Safety", "Fork not centred at travel request", "travel + hoist STO (no motion)"],
  A4011: ["Drives", "Travel drive fault / following error", "Stop Cat 1 if possible, else Cat 0"],
  A4041: ["Drives", "Fork collision sensor (fork tip / side)", "fork stop, travel + hoist blocked"],
  A5011: ["Process", "Hoist overload > 110 % (load cell)", "no lift, crane stops, load to be removed"],
  A7011: ["Material handling", "Barcode no-read at the infeed ID point", "load to the reject lane"],
  A7021: ["Material handling", "Contour check fault (overhang / height)", "load to the reject lane"],
  A7031: ["Material handling", "Overweight at the weighing point > 300 kg", "load to the reject lane"],
  A7041: ["Material handling", "Conveyor jam / zone timeout", "conveyor zone stop, crane does not pick at the I/O"],
  A7051: ["Material handling", "Double storage – target slot occupied", "slot blocked, WCS gives a new slot"],
  A7061: ["Material handling", "Empty slot at retrieval", "job aborted, stock correction to the WMS"],
  A7071: ["Material handling", "I/O handshake timeout", "crane waits, operator check"],
};
export const MACHINE = "ASRSRAW";
