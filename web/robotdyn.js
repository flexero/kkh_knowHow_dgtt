/* Industrial robot – DYNAMICS core (pure math, no DOM). Uses the kinematics of robotkin.js.
 *
 *   τ = M(q)·q̈ + C(q,q̇)·q̇ + g(q)      (equation of motion of the arm)
 *
 * Here τ is computed directly with the Newton–Euler sums (no matrices needed):
 *   τ_i = z_i · Σ_(k ≥ i) [ (c_k − o_i) × m_k (a_k − g)  +  I_k α_k  +  ω_k × (I_k ω_k) ]
 *   z_i, o_i = axis direction + a point of joint i · c_k, a_k = centre of mass + its acceleration of link k
 *   ω_k, α_k = angular velocity + acceleration of link k · I_k = inertia tensor of link k (world frame)
 * Velocities/accelerations come from the exact kinematics by central differences (h = 1 ms).
 *
 * LINK MASSES AND INERTIAS ARE ESTIMATES (the catalogue gives only the total mass). Use the supplier's
 * sizing software (e.g. RobotLoad / KUKA.Load / FANUC payload check) for real decisions.
 * SI units inside: m, kg, s, N, N·m.
 */
import { fk, pos4 } from "./robotkin.js";

const G = [0, 0, -9.81];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const col = (M, j) => [M[j], M[4 + j], M[8 + j]];                       // column j of a row-major 4x4 (axis direction)
const R3 = (M) => [M[0], M[1], M[2], M[4], M[5], M[6], M[8], M[9], M[10]];
const mv = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const mtv = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
export { sub, add, scl, dot, crs };

/* ------------------------------------------------------------------ estimated mass model */
// Share of the catalogue mass per link (estimate). The base (25 %) does not move and is not in the sums.
export const MASS_SHARE = { base: 0.25, column: 0.25, larm: 0.15, uarm: 0.20, farm: 0.10, wrist: 0.05 };

// Returns 6 moving bodies: {n, frame (index in fk().frames), m kg, c [m] centre of mass in the frame, Id [Ixx,Iyy,Izz] kg·m² about the COM in frame axes}
// load = {m kg, z m} = gripper + part on the flange (COM on the flange Z axis).
export function massModel(rb, load = { m: 0, z: 0 }) {
  const d = rb.dims, M = rb.mass, mm = (v) => v / 1000;
  const L = { h1: mm(d.h1), a1: mm(d.a1), a2: mm(d.a2), a3: mm(d.a3), d4: mm(d.d4), d6: mm(d.d6) };
  const s = MASS_SHARE, r = (len) => Math.max(0.03, 0.14 * len + 0.02);     // equivalent radius of a link (estimate)
  const rod = (m, len, rad, axis) => {                                     // solid cylinder, long axis = 'x' | 'z'
    const It = m * (3 * rad * rad + len * len) / 12, Il = m * rad * rad / 2;
    return axis === "x" ? [Il, It, It] : [It, It, Il];
  };
  const box = (m, a, b, c) => [m * (b * b + c * c) / 12, m * (a * a + c * c) / 12, m * (a * a + b * b) / 12];
  return [
    { n: "column (turns with J1)", frame: 0, m: M * s.column, c: [L.a1 * 0.4, 0, L.h1 * 0.65], Id: box(M * s.column, L.h1 * 0.9, L.h1 * 0.8, L.h1 * 0.9) },
    { n: "lower arm", frame: 1, m: M * s.larm, c: [0, 0, L.a2 * 0.5], Id: rod(M * s.larm, L.a2, r(L.a2), "z") },
    // upper-arm housing: J3 reducer + the J4/J5/J6 motors at the REAR -> centre of mass a little behind J3 (counter-weight)
    { n: "upper arm housing + J4–J6 motors", frame: 2, m: M * s.uarm, c: [-0.12 * L.d4, 0, L.a3 * 0.8], Id: box(M * s.uarm, 0.6 * L.d4, 0.5 * L.d4, 0.4 * L.d4) },
    { n: "forearm tube", frame: 3, m: M * s.farm, c: [L.d4 * 0.55, 0, 0], Id: rod(M * s.farm, L.d4, r(L.d4) * 0.7, "x") },
    { n: "wrist (J5)", frame: 4, m: M * s.wrist, c: [L.d6 * 0.3, 0, 0], Id: box(M * s.wrist, 1.6 * L.d6, L.d6, L.d6) },
    // flange frame: Z out of the flange. Load = gripper + part.
    { n: "flange + load (gripper + part)", frame: 5, m: Math.max(0.01, load.m), c: [0, 0, load.z], Id: [load.m * 0.004, load.m * 0.004, load.m * 0.002] },
  ];
}

/* ------------------------------------------------------------------ joint axes (world) */
// Joint i axis direction z_i and a point o_i on it, from the fk frames (see the chain in robotkin.js).
export function jointAxes(F) {
  return [
    { z: col(F[0], 2), o: [0, 0, 0] },                 // J1: Z of the column frame
    { z: col(F[1], 1), o: pos4(F[1]) },                // J2: Y of the lower-arm frame
    { z: col(F[2], 1), o: pos4(F[2]) },                // J3: Y of the upper-arm frame
    { z: col(F[3], 0), o: pos4(F[3]) },                // J4: X of the forearm frame (roll)
    { z: col(F[4], 1), o: pos4(F[4]) },                // J5: Y of the wrist frame
    { z: col(F[4], 0), o: pos4(F[4]) },                // J6: X of the wrist frame (flange roll)
  ].map((a) => ({ z: a.z, o: scl(a.o, 0.001) }));
}

function bodiesAt(rb, q, body) {                       // world COM [m] and rotation of each body at pose q
  const F = fk(rb, q).frames;
  return { F, B: body.map((b) => { const T = F[b.frame], R = R3(T); return { c: add(scl(pos4(T), 0.001), mv(R, b.c)), R }; }) };
}
function angVel(R0, R1, h) {                           // ω from two rotations h apart: R1·R0ᵀ ≈ I + [ω]·h  ->  ω = vee(W − Wᵀ)/(2h) (world)
  const W = [];                                         // W = R1·R0ᵀ
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) W[i * 3 + j] = R1[i * 3] * R0[j * 3] + R1[i * 3 + 1] * R0[j * 3 + 1] + R1[i * 3 + 2] * R0[j * 3 + 2];
  return [(W[7] - W[5]) / (2 * h), (W[2] - W[6]) / (2 * h), (W[3] - W[1]) / (2 * h)];
}

/* ------------------------------------------------------------------ inverse dynamics */
// q deg, qd deg/s, qdd deg/s². Returns joint torques [N·m] split in parts:
// {tau, grav, dyn (= inertia + Coriolis/centrifugal), bal (torque the balancer spring gives on J2, estimate), net (= tau − bal: what motor + gear must give)}
export function invDyn(rb, q, qd, qdd, load, opts = {}) {
  const body = opts.body || massModel(rb, load);
  const h = 1e-3;
  const qp = q.map((v, i) => v + qd[i] * h + 0.5 * qdd[i] * h * h);
  const qm = q.map((v, i) => v - qd[i] * h + 0.5 * qdd[i] * h * h);
  const P0 = bodiesAt(rb, q, body), Pp = bodiesAt(rb, qp, body), Pm = bodiesAt(rb, qm, body);
  const ax = jointAxes(P0.F);
  const K = body.map((b, k) => {
    const a = scl(add(sub(Pp.B[k].c, scl(P0.B[k].c, 2)), Pm.B[k].c), 1 / (h * h));        // COM acceleration
    const wP = angVel(P0.B[k].R, Pp.B[k].R, h), wM = angVel(Pm.B[k].R, P0.B[k].R, h);   // ω at t + h/2 and t − h/2
    const w = scl(add(wP, wM), 0.5), al = scl(sub(wP, wM), 1 / h);                        // ω, α (world)
    const R = P0.B[k].R;
    const Iw = (v) => mv(R, ((u) => [b.Id[0] * u[0], b.Id[1] * u[1], b.Id[2] * u[2]])(mtv(R, v)));  // I_world · v
    return { m: b.m, c: P0.B[k].c, a, w, al, Iw };
  });
  const tau = [0, 0, 0, 0, 0, 0], grav = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6; i++) {
    let n = [0, 0, 0], ng = [0, 0, 0];
    for (let k = i; k < 6; k++) {
      const B = K[k], r = sub(B.c, ax[i].o);
      n = add(n, add(crs(r, scl(sub(B.a, G), B.m)), add(B.Iw(B.al), crs(B.w, B.Iw(B.w)))));
      ng = add(ng, crs(r, scl(scl(G, -1), B.m)));
    }
    tau[i] = dot(ax[i].z, n); grav[i] = dot(ax[i].z, ng);
  }
  const dyn = tau.map((t, i) => t - grav[i]);
  const bal = [0, balancerTorque(rb, q[1], body), 0, 0, 0, 0];
  return { tau, grav, dyn, bal, net: tau.map((t, i) => t - bal[i]) };   // bal = torque the spring gives to the arm -> motor + gear give the rest
}

// Balancing device (spring) – ESTIMATE: it gives back ≈ 70 % of the gravity torque of the arm (without load)
// when the lower arm leans:  τ_bal ≈ −0.7 · g · (m_larm·a2/2 + m_outer·a2) · sin(q2)
export function balancerTorque(rb, q2deg, body) {
  if (!rb.balancer) return 0;
  const b = body || massModel(rb), a2 = rb.dims.a2 / 1000;
  const mOuter = b[2].m + b[3].m + b[4].m;
  return -0.7 * 9.81 * (b[1].m * a2 / 2 + mOuter * a2) * Math.sin(q2deg * Math.PI / 180);
}

/* ------------------------------------------------------------------ Jacobian + statics */
// Geometric Jacobian at the TCP (6x6, rows vx vy vz [m/s per rad/s] then wx wy wz).   v = J · q̇
export function jacobian(rb, q, tool) {
  const st = fk(rb, q, tool), ax = jointAxes(st.frames), p = scl(st.p, 0.001);
  const J = [[], [], [], [], [], []];
  for (let i = 0; i < 6; i++) {
    const v = crs(ax[i].z, sub(p, ax[i].o));
    for (let r = 0; r < 3; r++) { J[r][i] = v[r]; J[r + 3][i] = ax[i].z[r]; }
  }
  return J;
}
export function det(A) {                              // Gaussian elimination, n x n
  const n = A.length, M = A.map((r) => r.slice());
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return 0;
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; d = -d; }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k < n; k++) M[r][k] -= f * M[c][k]; }
  }
  return d;
}
// Joint torques that hold a force F [N] and moment Mo [N·m] at the TCP (world):  τ = Jᵀ · [F; Mo]
export function staticTorque(J, F, Mo = [0, 0, 0]) {
  const w = [...F, ...Mo];
  return [0, 1, 2, 3, 4, 5].map((i) => J.reduce((s, row, r) => s + row[i] * w[r], 0));
}
// Singularity indicators: the det factors into 3 simple terms for this arm type
//   det J = a2 · b · sin(q3 + atan(d4/a3)·…) · (radial distance of the wrist centre) · sin(q5)   (up to sign)
export function singularity(rb, q) {
  const d = rb.dims, st = fk(rb, q);
  const wc = st.wc, rho = Math.hypot(wc[0], wc[1]);           // shoulder: wrist centre near the J1 axis
  const beta = Math.atan2(d.a3, d.d4);
  const elbow = Math.cos((q[2] * Math.PI) / 180 - beta);       // elbow: arm stretched -> cos(q3 − β) = 0
  return { shoulder: rho, elbow, wrist: Math.sin((q[4] * Math.PI) / 180) };
}

/* ------------------------------------------------------------------ drive train (motor side, estimates) */
// Gear ratio from "motor max speed ≈ 3500–4500 rpm at the catalogue axis speed":  n = n_mot · 6 / v_axis(°/s)
export function drive(rb) {
  const nMot = rb.payload <= 10 ? 4500 : rb.payload <= 60 ? 3500 : 3000;          // rpm (estimate)
  const ratio = rb.vmax.map((v) => Math.round(nMot * 6 / v));
  return { nMot, ratio, eta: 0.85 };                                              // gear efficiency (estimate, RV/harmonic 0.75–0.9)
}
// Motor values for joint torque τ [N·m] and axis speed qd [°/s]
export function motorSide(rb, tau, qd) {
  const D = drive(rb);
  return tau.map((t, i) => {
    const n = D.ratio[i];
    const motoring = t * qd[i] >= 0;                     // power flows motor -> arm (else the arm drives back: efficiency the other way)
    const tm = motoring ? t / (n * D.eta) : (t * D.eta) / n;
    const rpm = (qd[i] * n) / 6;
    const P = t * qd[i] * Math.PI / 180;                 // W at the joint
    return { n, tm, rpm, P };
  });
}
