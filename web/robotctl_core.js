/* ROBOT tab – item 2 "Robot control system": SIMULATION CORE (pure math, no DOM). Used by robotctl.js (UI).
 *
 * One robot joint as a real servo axis:
 *   position loop P (Kv, 1/s) -> speed loop PI (Kp N·m·s/rad, Ti s) -> current/torque loop (1st-order lag, T_i = 0.3 ms, torque limit)
 *   -> plant = TWO-MASS model: motor (J_M = Jm·n², joint side) -- gear spring k + damping c -- link (J_L(q) from the dynamic model)
 *   + gravity torque (robotdyn.invDyn at the pose) + Coulomb/viscous friction + optional contact spring (collision).
 * ALL GAINS, TORQUES AND INERTIAS ARE ON THE JOINT SIDE (after the gear): rad, rad/s, N·m, kg·m².  Motor side = joint side / n (torque: / (n·η)).
 * Sample rates: plant dt ≤ 0.1 ms, position + speed loop 0.5 ms, interpolator (IPO) 4 ms with quadratic fine interpolation.
 * Collision detection: generalised-momentum observer  r = K_O·(p − p0 − ∫(τ_meas − τ_grav − τ_fric + ½J'ω² + r)dt),  p = Ĵ·ω.
 * Motor inertia, gear stiffness, friction, torque limit = ESTIMATES (rules below) – check with the robot supplier.
 */
import { planPTP, fk, D2R, cellLayout } from "./robotkin.js";
import { invDyn, drive, jointAxes, sub, crs } from "./robotdyn.js";

export const CTL = {
  tPos: 0.5e-3,       // s, position + speed loop cycle (axis computer), example
  tIpo: 4e-3,         // s, interpolator cycle (main computer), example
  tCur: 0.3e-3,       // s, equivalent time constant of the closed current loop (current loop cycle 62.5 µs = 16 kHz), example
  pwm: 8000,          // Hz, IGBT switching frequency, example
  inertiaRatio: 3,    // J_link,max / (Jm·n²) used to size the motor (estimate, servo practice 1–5)
  reserve: 1.4,       // torque reserve of the motor size over the worst case (estimate)
  zeta: 0.05,         // damping ratio of the gear spring (estimate)
  fricC: 0.03,        // Coulomb friction = 3 % of the joint torque limit (estimate)
  fricV: 0.04,        // viscous friction at max axis speed = 4 % of the torque limit (estimate)
  fricModel: 0.8,     // the controller's friction model knows only 80 % of the real friction (model error, realistic)
  noise: 0.004,       // torque measurement noise (from the current), ± fraction of the limit
  vdc0: 565,          // V, DC bus without load = 1.41 × 400 V AC
  cdc: 2e-3,          // F, DC-bus capacitance (example)
  chopOn: 750, chopOff: 730, rChop: 40,   // brake chopper thresholds (V) + resistor (Ω), example
  brakeDelay: 0.06,   // s, holding brake closes ~60 ms after the command (example 20–100 ms)
  kO: 60,             // 1/s, momentum observer gain (residual filter time constant 1/K_O ≈ 17 ms)
};
// Gear torsional stiffness of J1 by robot (estimate; RV reducer + structure). J2.. = J1 × factor.
export const K_GEAR = { irb120: 4e4, irb2600: 8e5, irb4600: 1.6e6, irb6700: 5e6 };
export const K_FAC = [1, 1, 0.6, 0.08, 0.05, 0.03];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ZERO6 = [0, 0, 0, 0, 0, 0];

/* ------------------------------------------------------------------ joint data from the dynamic model */
export function loadOf(rb, m) { const C = cellLayout(rb); return { m, z: C.toolLen / 1000 }; }
// Link inertia seen by joint j at pose q (deg) = M_jj(q):  I = τ(q̈_j = 1 rad/s²) − τ(q̈ = 0)
export function linkInertia(rb, q, j, load) {
  const A = 1000, qdd = ZERO6.slice(); qdd[j] = A;                 // deg/s²
  const t1 = invDyn(rb, q, ZERO6, qdd, load).tau[j], t0 = invDyn(rb, q, ZERO6, ZERO6, load).tau[j];
  return Math.max(1e-6, (t1 - t0) / (A * D2R));
}
export function holdTorque(rb, q, j, load) { return invDyn(rb, q, ZERO6, ZERO6, load).net[j]; }   // gravity − balancer

// Motor size per robot (cached): worst link inertia + worst hold torque over a J2/J3 grid with max payload
const sizeCache = new Map();
export function sizing(rb) {
  if (sizeCache.has(rb.id)) return sizeCache.get(rb.id);
  const L = loadOf(rb, rb.payload), Imax = ZERO6.slice(), Hmax = ZERO6.slice();
  const g = (lo, hi, k) => Array.from({ length: k }, (_, i) => lo + (hi - lo) * i / (k - 1));
  for (const q2 of g(Math.max(-60, rb.lim[1][0]), Math.min(90, rb.lim[1][1]), 6))
    for (const q3 of g(Math.max(-90, rb.lim[2][0]), Math.min(60, rb.lim[2][1]), 6)) for (const q5 of [0, 90]) {
      const q = [0, q2, q3, q5 ? 90 : 0, q5, 0];
      const t0 = invDyn(rb, q, ZERO6, ZERO6, L);
      for (let j = 0; j < 6; j++) {
        Hmax[j] = Math.max(Hmax[j], Math.abs(t0.net[j]));
        const qdd = ZERO6.slice(); qdd[j] = 1000;
        Imax[j] = Math.max(Imax[j], (invDyn(rb, q, ZERO6, qdd, L).tau[j] - t0.tau[j]) / (1000 * D2R));
      }
    }
  // wrist joints: load-diagram floor – payload with its centre of gravity 100 mm off the flange axis (estimate)
  const off = 0.1, zc = L.z;
  [[3, 1], [4, 1], [5, 0.6]].forEach(([j, f]) => {
    Hmax[j] = Math.max(Hmax[j], f * rb.payload * 9.81 * Math.hypot(zc, off));
    Imax[j] = Math.max(Imax[j], rb.payload * (off * off + (j === 5 ? 0 : zc * zc)) + 0.02 * rb.payload * 0.01);
  });
  const D = drive(rb);
  const out = Imax.map((I, j) => {
    const n = D.ratio[j], aMax = rb.vmax[j] * D2R / rb.tacc;                     // rad/s² (catalogue speed / estimated acc. time)
    const tauLim = CTL.reserve * (Hmax[j] + I * aMax);                            // joint side, N·m
    const Jm = Math.max(2e-5, I / (n * n * CTL.inertiaRatio));                   // kg·m² motor rotor (+ brake, encoder)
    const tmMax = tauLim / (n * D.eta);
    const wMot = D.nMot * 2 * Math.PI / 60;
    const Kt = 0.6 * 400 * Math.sqrt(3) / wMot;                                   // N·m/A (estimate from the 400 V supply)
    return { j, n, eta: D.eta, Imax: I, Hmax: Hmax[j], aMax, tauLim, Jm, tmMax, Kt, iMax: tmMax / Kt, nMot: D.nMot };
  });
  sizeCache.set(rb.id, out);
  return out;
}

// Everything the servo simulation needs for joint j at pose q with load mass m (kg)
export function jointModel(rb, j, q, m, kScale = 1) {
  const S = sizing(rb)[j], load = loadOf(rb, m);
  const JL = linkInertia(rb, q, j, load), JM = S.Jm * S.n * S.n;
  const k = K_GEAR[rb.id] * K_FAC[j] * kScale;
  const Jr = 1 / (1 / JL + 1 / JM), c = 2 * CTL.zeta * Math.sqrt(k * Jr);
  const wRes = Math.sqrt(k * (1 / JL + 1 / JM)), wLock = Math.sqrt(k / JL);
  const C = cellLayout(rb), st = fk(rb, q, C.tool), ax = jointAxes(st.frames)[j];
  const lever = Math.hypot(...crs(ax.z, sub(st.p.map((v) => v / 1000), ax.o)));        // m, TCP distance from the joint axis
  const wMax = rb.vmax[j] * D2R;
  return {
    rb, j, q: q.slice(), m, load, ...S, JL, JM, k, c, Jr, wRes, fRes: wRes / (2 * Math.PI), fLock: wLock / (2 * Math.PI),
    lever: Math.max(0.05, lever), wMax, fc: CTL.fricC * S.tauLim, bv: CTL.fricV * S.tauLim / wMax,
    hold0: holdTorque(rb, q, j, load), brake: 1.2 * S.tauLim,
  };
}

/* Rule-of-thumb tuning (shown on the page):
 *   ω_v = min(0.5·ω_res, 2π·80 Hz)        speed-loop bandwidth: stay well below the gear resonance
 *   Kp  = (J_L + J_M)·ω_v                 speed gain [N·m·s/rad, joint side]
 *   Ti  = 4 / ω_v                         integral time
 *   Kv  = ω_v / 4                         position gain [1/s] = position-loop bandwidth in rad/s            */
// jerk-filter length: one period of the locked-motor frequency f_lock = (1/2π)·√(k/J_L) (the arm swings at this frequency when the motor is held)
export function jerkN(M) { return Math.max(1, Math.round(1 / (M.fLock * CTL.tIpo))); }
export function autoTune(M) {
  const wv = Math.min(0.5 * M.wRes, 2 * Math.PI * 80);
  return { Kp: (M.JL + M.JM) * wv, Ti: 4 / wv, Kv: wv / 4, wv };
}

/* ------------------------------------------------------------------ tables along the joint (gravity, inertia) */
function tables(M, a0, a1, mDecl) {
  const lo = Math.min(a0, a1) - 8, hi = Math.max(a0, a1) + 8, N = Math.max(12, Math.ceil(hi - lo));
  const st = (hi - lo) / N, L = M.load, Ld = loadOf(M.rb, mDecl);
  const H = [], I = [], Hd = [], Id = [];
  for (let i = 0; i <= N; i++) {
    const q = M.q.slice(); q[M.j] = lo + i * st;
    H.push(holdTorque(M.rb, q, M.j, L)); I.push(linkInertia(M.rb, q, M.j, L));
    if (mDecl !== M.m) { Hd.push(holdTorque(M.rb, q, M.j, Ld)); Id.push(linkInertia(M.rb, q, M.j, Ld)); }
  }
  const look = (T) => (deg) => { const x = clamp((deg - lo) / st, 0, N - 1e-9), i = Math.floor(x), u = x - i; return T[i] + (T[i + 1] - T[i]) * u; };
  const dlook = (T) => (deg) => { const x = clamp((deg - lo) / st, 0, N - 1e-9), i = Math.floor(x); return (T[i + 1] - T[i]) / (st * D2R); };
  return { hold: look(H), J: look(I), dJ: dlook(I), holdD: look(Hd.length ? Hd : H), JD: look(Id.length ? Id : I), dJD: dlook(Id.length ? Id : I) };
}

// small deterministic random numbers (measurement noise) – same result every run
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; }

/* ------------------------------------------------------------------ the simulation
 * opt: {Kv, Kp, Ti, ffv, fft, jerk (setpoint filter on), twc (gear-twist compensation), bits, dq (deg), ovr, dwell (s), coll: {on, frac, kc N/m, mode 'model'|'none', thr (fraction of τ_lim)}, mDecl (declared load kg)}
 * Motion: rest 0.2 s -> PTP +dq -> dwell -> PTP back -> dwell (planPTP with the catalogue axis speed).
 */
export function simulate(M, opt) {
  const rb = M.rb, j = M.j, n = M.n;
  const q0 = M.q[j];
  let dq = opt.dq;
  if (q0 + dq > rb.lim[j][1] - 1) dq = -Math.abs(dq);
  if (q0 + dq < rb.lim[j][0] + 1) dq = Math.abs(dq);
  const qa = M.q.slice(), qb = M.q.slice(); qb[j] = q0 + dq;
  const plan = planPTP(rb, qa, qb, opt.ovr || 1);
  const T = plan.T, dwell = opt.dwell || 0.6, t0 = 0.2, Tj = opt.jerk ? (opt.nJ || jerkN(M)) * CTL.tIpo : 0;
  const tEnd1 = t0 + T + Tj, tStart2 = tEnd1 + dwell, tEnd2 = tStart2 + T + Tj, tTot = opt.tTot || tEnd2 + dwell;
  const coll = opt.coll && opt.coll.on ? opt.coll : null;
  const mDecl = opt.mDecl === undefined ? M.m : opt.mDecl;
  const TB = tables(M, q0, q0 + dq, mDecl);
  const refAt = (t) => {                                          // joint setpoint from the path planner, rad relative to q0
    if (t <= t0) return 0;
    if (t <= t0 + T) return (plan.at(t - t0)[j] - q0) * D2R;
    if (t <= tStart2) return dq * D2R;
    if (t <= tStart2 + T) return (plan.at(T - (t - tStart2))[j] - q0) * D2R;
    return 0;
  };
  // integration step: ≤ 0.1 ms and ≤ 0.15 / ω_max, integer divider of the 0.5 ms loop
  const wHi = Math.sqrt(M.k / Math.min(M.Jr, TB.J(q0) * M.JM / (TB.J(q0) + M.JM)));
  const sub = Math.max(5, Math.ceil(CTL.tPos * wHi / 0.15)), dt = CTL.tPos / sub;
  const ipoN = Math.round(CTL.tIpo / CTL.tPos);
  const res = 2 * Math.PI / (Math.pow(2, opt.bits || 20) * n);   // encoder resolution, rad on the joint side
  const qz = (x) => Math.round(x / res) * res;
  const aCur = 1 - Math.exp(-dt / CTL.tCur);
  const noise = rng(12345);
  const Kp = opt.Kp, Ti = Math.max(1e-4, opt.Ti), Kv = opt.Kv, lim = M.tauLim;
  const thrC = coll ? coll.thr * lim : Infinity;
  const obsOn = !!coll && coll.kc > 0 && (coll.frac || 0.6) <= 1;
  const obs = coll ? dq * D2R * clamp(coll.frac || 0.6, 0.1, 0.95) : 0, sgn = Math.sign(dq) || 1;
  // state (joint side, rad relative to q0). Start in gravity equilibrium: gear twisted by τ_g/k, integrator pre-loaded.
  const g0 = TB.hold(q0), twc = !!opt.twc;
  let xM = twc ? TB.holdD(q0) / M.k : 0, xL = xM - g0 / M.k, wL = 0, wM = 0, tau = g0, tauCmd = g0;
  let I = (g0 - (opt.fft ? TB.holdD(q0) : 0)) * Ti / Kp;
  let off0 = twc ? TB.holdD(q0) / M.k : 0, off1 = off0;          // gear-twist compensation offsets (motor side)
  // jerk limit: moving-average setpoint filter over ≈ one resonance period (N IPO cycles) – smooth acceleration, no ringing
  const nJ = opt.jerk ? (opt.nJ || jerkN(M)) : 1, jbuf = new Array(nJ).fill(0);
  let rm = 0, r0 = 0, r1 = 0, vIpo = 0, aIpo = 0, d1 = 0, d2 = 0, xMeasPrev = qz(xM), wMeas = 0, wCmd = 0;
  let vdc = CTL.vdc0, chop = false, eChop = 0;
  // observer
  let pObs0 = null, sObs = 0, resid = 0;
  // stop logic
  let stop = null;            // {t, kind, ref, v, phase: 'ramp'|'brake'|'sto', tStand, tBrake}
  let det = null, satRun = 0, contact = null, Fmax = 0, brakeOn = false, xStop = null;
  let falseAlarm = null;
  const out = { t: [], ref: [], xM: [], xL: [], eL: [], eM: [], tau: [], tm: [], twist: [], res: [], F: [], vdc: [], chop: [], P: [], w: [] };
  let maxE = 0, maxEM = 0, maxEnoMove = 0, peakTau = 0, satT = 0, stableBad = false, diverged = false;
  const holdWin = [];
  const aStop = 2 * M.aMax;
  let k = 0;
  const nSteps = Math.round(tTot / CTL.tPos);
  for (let s = 0; s < nSteps; s++) {
    const t = s * CTL.tPos;
    /* ---- main computer: interpolator every 4 ms (one cycle look-ahead: the axis moves between the last two setpoints) */
    if (s % ipoN === 0 && !stop) {
      jbuf.push(refAt(t + CTL.tIpo)); jbuf.shift();
      rm = r0; r0 = r1; r1 = jbuf.reduce((a, v) => a + v, 0) / nJ;
      d1 = (r1 - rm) / 2; d2 = r1 - 2 * r0 + rm;                       // quadratic fine interpolation through 3 IPO points
      aIpo = d2 / (CTL.tIpo * CTL.tIpo);
      if (twc) { off0 = off1; off1 = (TB.holdD(q0 + r1 / D2R) + TB.JD(q0 + r1 / D2R) * aIpo) / M.k; }
    }
    let ref;
    if (!stop) { const u = (s % ipoN) / ipoN; ref = r0 + u * d1 + 0.5 * u * u * d2; vIpo = (d1 + u * d2) / CTL.tIpo; }
    else {                                                          // controlled stop ramp (cat 1 / SS1-like)
      if (stop.phase === "ramp") {
        const dv = aStop * CTL.tPos;
        stop.v = Math.abs(stop.v) <= dv ? 0 : stop.v - Math.sign(stop.v) * dv;
        stop.ref += stop.v * CTL.tPos;
        if (stop.v === 0) { stop.phase = "brake"; stop.tStand = t; }
      } else if (stop.phase === "brake" && t >= stop.tStand + CTL.brakeDelay) { stop.phase = "sto"; stop.tBrake = t; brakeOn = true; }
      ref = stop.ref; vIpo = stop.v; aIpo = 0;
    }
    /* ---- axis computer (0.5 ms): measure, position loop, speed loop, observer */
    const xMeas = qz(xM);
    wMeas = (xMeas - xMeasPrev) / CTL.tPos; xMeasPrev = xMeas;
    const u01 = (s % ipoN) / ipoN;
    const refM = twc && !stop ? ref + off0 + (off1 - off0) * u01 : ref + (twc ? off1 : 0);   // motor setpoint incl. the expected gear twist τ/k
    const eM = refM - xMeas;
    wCmd = Kv * eM + (opt.ffv ? vIpo + (twc && !stop ? (off1 - off0) / CTL.tIpo : 0) : 0);
    const ew = wCmd - wMeas;
    const qDegM = q0 + xMeas / D2R;
    const Jhat = TB.JD(qDegM) + M.JM;
    const fricHat = CTL.fricModel * (M.fc * Math.tanh(wMeas / 0.02) + M.bv * wMeas);
    const ff = opt.fft ? Jhat * aIpo + TB.holdD(q0 + ref / D2R) + CTL.fricModel * (M.fc * Math.tanh(vIpo / 0.02) + M.bv * vIpo) : 0;
    let u = Kp * (ew + I / Ti) + ff;
    const sat = Math.abs(u) > lim;
    if (!sat) I += ew * CTL.tPos;                                    // anti-windup: no integration while saturated
    tauCmd = clamp(u, -lim, lim);
    if (stop && stop.phase === "sto") tauCmd = 0;
    // torque from the measured current (+ noise) and the residual of the momentum observer
    const tauMeas = tau + CTL.noise * lim * noise() * 2;
    const p = Jhat * wMeas;
    if (pObs0 === null) pObs0 = p;
    sObs += (tauMeas - TB.holdD(qDegM) - fricHat + 0.5 * TB.dJD(qDegM) * wMeas * wMeas + resid) * CTL.tPos;
    resid = CTL.kO * (p - pObs0 - sObs);
    if (stop && stop.phase === "sto") { resid = 0; }
    // collision supervision
    if (!stop) {
      let why = "";
      if (coll && coll.mode === "model" && Math.abs(resid) > thrC) { satRun++; if (satRun >= 2) why = "residual > threshold (model-based)"; }
      else if (coll && coll.mode === "none") {
        if (Math.abs(tauMeas) > 0.95 * lim) satRun++; else satRun = 0;
        if (satRun >= 20) why = "motor at the current limit for 10 ms";
        if (Math.abs(eM) > 1 * D2R) why = "following error > 1° (position supervision)";
      } else satRun = 0;
      if (why) {
        det = { t, why, contactT: contact ? contact.t : null };
        if (!contact) falseAlarm = { t, why };
        stop = { t, phase: "ramp", ref: xMeas, v: wMeas };
      }
    }
    /* ---- drive + mechanics, fine time step */
    for (let i = 0; i < sub; i++) {
      tau += (tauCmd - tau) * aCur;
      const qDeg = q0 + xL / D2R;
      const JLx = TB.J(qDeg);
      const tw = M.k * (xM - xL) + M.c * (wM - wL);
      let F = 0;
      if (obsOn) {
        const pen = sgn * (xL - obs);
        if (pen > 0) {
          const d = pen * M.lever, dv = sgn * wL * M.lever;
          F = Math.max(0, coll.kc * d + 0.02 * Math.sqrt(coll.kc * JLx / (M.lever * M.lever)) * dv);
          if (!contact) contact = { t: t + i * dt };
        }
      }
      const tauC = -sgn * F * M.lever;
      const fr = M.fc * Math.tanh(wM / 0.02) + M.bv * wM;
      let aM;
      if (brakeOn) {                                                // holding brake on the motor: stick or slip
        const free = tau - tw - fr;
        if (Math.abs(wM) < 1e-3 && Math.abs(free) < M.brake) { wM = 0; aM = 0; }
        else aM = (free - Math.sign(wM || free) * M.brake) / M.JM;
      } else aM = (tau - tw - fr) / M.JM;
      const aL = (tw - TB.hold(qDeg) + tauC - 0.5 * TB.dJ(qDeg) * wL * wL) / JLx;
      wM += aM * dt; wL += aL * dt; xM += wM * dt; xL += wL * dt;     // semi-implicit Euler
      if (F > Fmax) Fmax = F;
      if (i === sub - 1) out._F = F;
    }
    if (!isFinite(xL) || Math.abs(xL) > 20 || Math.abs(wM) > 1e4) { diverged = true; break; }
    /* ---- DC bus (this axis only; the other 5 axes stand still) */
    const Pm = tau * wM, Pe = Pm >= 0 ? Pm / M.eta : Pm * M.eta;      // W electrical (motoring: + , braking: − )
    const vSup = CTL.vdc0 - 0.0025 * Math.max(0, Pe);                    // rectifier: stiff supply, small drop under load
    const Pc = chop ? vdc * vdc / CTL.rChop : 0;
    vdc -= (Pe + Pc) / (CTL.cdc * vdc) * CTL.tPos;                        // capacitor: C·V·dV/dt = −P
    if (vdc < vSup) vdc = vSup;                                           // diodes conduct -> the grid feeds the bus
    if (vdc > CTL.chopOn) chop = true; else if (vdc < CTL.chopOff) chop = false;
    if (chop) eChop += Pc * CTL.tPos;
    /* ---- KPIs + record */
    const eL = ref - xL;
    const moving = (t > t0 && t < tEnd1 + 0.05) || (t > tStart2 && t < tEnd2 + 0.05);
    if (!stop) { if (moving) { maxE = Math.max(maxE, Math.abs(eL)); maxEM = Math.max(maxEM, Math.abs(eM)); } else maxEnoMove = Math.max(maxEnoMove, Math.abs(eL)); }
    peakTau = Math.max(peakTau, Math.abs(tau)); if (Math.abs(tau) > 0.98 * lim) satT += CTL.tPos;
    if (t > tTot - 0.25) holdWin.push([eL, tau, eM]);
    out.t.push(t); out.ref.push(ref); out.xM.push(xM); out.xL.push(xL); out.eL.push(eL); out.eM.push(eM);
    out.tau.push(tau); out.tm.push(tau / (n * M.eta)); out.twist.push(xM - xL); out.res.push(resid); out.F.push(out._F || 0);
    out.vdc.push(vdc); out.chop.push(chop ? 1 : 0); out.P.push(Pe); out.w.push(wL);
    k++;
  }
  delete out._F;
  // settling + overshoot after move 1
  const band = Math.max(rb.rep, 0.01) / 1000 / M.lever;            // rad: repeatability at the TCP
  let settle = null, over = 0;
  const target = dq * D2R;
  const i1 = Math.round(tEnd1 / CTL.tPos), i2 = Math.min(out.t.length, Math.round(tStart2 / CTL.tPos));
  let xFin = target;
  if (!stop && i2 > i1 + 120) {
    xFin = 0; for (let i = i2 - 100; i < i2; i++) xFin += out.xL[i] / 100;     // final link position (incl. static gear sag)
    let lastOut = i1;
    for (let i = i1; i < i2; i++) {
      if (Math.abs(xFin - out.xL[i]) > band) lastOut = i;
      over = Math.max(over, sgn * (out.xL[i] - xFin));
    }
    settle = lastOut < i2 - 1 ? (lastOut - i1 + 1) * CTL.tPos : null;
  }
  const hw = holdWin.length ? holdWin : [[0, 0]];
  const p2p = Math.max(...hw.map((h) => h[0])) - Math.min(...hw.map((h) => h[0]));
  const mean = hw.reduce((a, h) => a + h[1], 0) / hw.length;
  const tstd = Math.sqrt(hw.reduce((a, h) => a + (h[1] - mean) ** 2, 0) / hw.length);
  const ssErr = hw.reduce((a, h) => a + h[0], 0) / hw.length, ssErrM = hw.reduce((a, h) => a + (h[2] || 0), 0) / hw.length;
  let status = "stable";
  if (diverged) status = "unstable";
  else if (!stop && (tstd > 0.03 * lim || p2p > 4 * band || satT > 0.2 * tTot)) status = "oscillating";
  else if (!stop && (tstd > 0.01 * lim || p2p > 1.5 * band)) status = "poorly damped";
  return {
    out, T, dq, t0, tEnd1, tStart2, tEnd2, tTot, dt, sub, res, band, lever: M.lever,
    maxE, maxEM, maxEnoMove, settle, over: Math.max(0, over), ssErr, ssErrM, sag: target - xFin, nJ, Tj, p2p, tstd, peakTau, satT, status, diverged,
    det, contact, Fmax, stop, falseAlarm, eChop, vdcMax: Math.max(...out.vdc), obs, maxRes: Math.max(...out.res.map(Math.abs)),
    stopDist: stop && contact ? (Math.max(...out.xL.map((x) => sgn * x)) - sgn * obs) * M.lever : null,
  };
}

/* ------------------------------------------------------------------ stop categories (IEC 60204-1) for the safety card
 * One axis (J1 of the robot, at the pose) moving at v0 (fraction of max speed). Returns speed-time curves.
 *   cat 0: STO at once, the axis coasts until the brake closes (≈ 60 ms), then the brake torque decelerates it
 *   cat 1: controlled ramp with max motor torque (≈ 200–500 ms), then STO + brake
 *   cat 2: controlled ramp, power stays on, servo holds the position (safe operating stop SOS)              */
export function stopCurves(M, v0f = 1) {
  const v0 = v0f * M.wMax, Jt = M.JL + M.JM, dt = 1e-3;
  const aRamp = Math.min(0.9 * M.tauLim / Jt, 2 * M.aMax);             // controlled deceleration (servo)
  const aBrake = M.brake / Jt;                                          // brake on the motor shaft, referred to the joint
  const run = (cat) => {
    const pts = []; let v = v0, x = 0, t = 0, tSTO = null, tBr = null, phase = cat === 0 ? "coast" : "ramp";
    if (cat === 0) tSTO = 0;
    while (t < 1.5 && (v > 1e-4 || t < 0.05)) {
      if (phase === "coast" && t >= CTL.brakeDelay) { phase = "brake"; tBr = t; }
      const a = phase === "coast" ? 0 : phase === "brake" ? aBrake : aRamp;
      v = Math.max(0, v - a * dt); x += v * dt; t += dt;
      pts.push([t, v]);
      if (v <= 1e-4 && phase === "ramp") { if (cat === 1) { tSTO = t; tBr = t + CTL.brakeDelay; } break; }
    }
    return { cat, pts, tStop: t, dist: x, distTcp: x * M.lever, tSTO, tBr };
  };
  return { v0, aRamp, aBrake, c: [run(0), run(1), run(2)] };
}
