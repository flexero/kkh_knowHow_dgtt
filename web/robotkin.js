/* Industrial robot – kinematic core (shared by robot.js = UI and robot3d.js = 3D model).
 * Offline, no libraries. Units: mm, degrees in the API (radians inside), seconds.
 *
 * Robot base frame: X forward, Y left, Z up, origin = centre of the base foot on the floor.
 * Joint convention (same as the reference catalogue, ABB style):
 *   J1 about Z (+ = turn left, seen from above)
 *   J2 about Y (+ = lower arm tilts forward)        J2 = 0 -> lower arm vertical
 *   J3 about Y (+ = forearm tilts down)              J3 = 0 -> forearm horizontal (at J2 = 0)
 *   J4 roll about the forearm axis, J5 wrist bend (+ = tool down), J6 flange roll
 * Zero pose: lower arm vertical, forearm horizontal forward, flange (tool Z) points along +X.
 *
 * Chain:  T = Rz(q1) · Tz(h1) · Tx(a1) · Ry(q2) · Tz(a2) · Ry(q3) · Tz(a3) · Tx(d4)
 *             · Rx(q4) · Ry(q5) · Rx(q6) · Tx(d6) · Ry(90°)  (= flange frame, Z out of the flange)
 *
 * All catalogue values are taken from the public product specifications of the reference robots
 * (as known to the author) – EXAMPLES, check every value with the current datasheet before you buy or design.
 */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export { D2R, R2D };

/* ------------------------------------------------------------------ robot library */
// dims: h1 = floor -> J2 axis, a1 = J1 axis -> J2 axis (forward), a2 = lower arm (J2 -> J3),
//       a3 = J3 -> forearm axis (up), d4 = J3 -> wrist centre (along forearm), d6 = wrist centre -> flange
// lim: [min, max] deg per axis · vmax: max axis speed deg/s · tacc: acceleration time s (ESTIMATE, not catalogue)
export const ROBOTS = [
  { id: "irb120", ref: "ABB IRB 120-3/0.6", cls: "small (assembly, small parts)",
    payload: 3, reach: 580, mass: 25, rep: 0.01, mount: "floor, wall, ceiling, any angle", ip: "IP30",
    dims: { h1: 290, a1: 0, a2: 270, a3: 70, d4: 302, d6: 72 },
    lim: [[-165, 165], [-110, 110], [-110, 70], [-160, 160], [-120, 120], [-400, 400]],
    vmax: [250, 250, 250, 320, 320, 420], tacc: 0.15, balancer: false,
    gear: "harmonic drives (strain-wave) on all axes – check", base: [180, 180], ctrl: "IRC5 Compact / OmniCore E10" },
  { id: "irb2600", ref: "ABB IRB 2600-20/1.65", cls: "medium (machine tending, handling, arc welding)",
    payload: 20, reach: 1650, mass: 272, rep: 0.04, mount: "floor, wall, tilted, inverted", ip: "IP67",
    dims: { h1: 445, a1: 150, a2: 700, a3: 115, d4: 795, d6: 85 },
    lim: [[-180, 180], [-95, 155], [-180, 75], [-175, 175], [-120, 120], [-400, 400]],
    vmax: [175, 175, 175, 360, 360, 500], tacc: 0.30, balancer: true,
    gear: "RV (cycloidal) reducers J1–J3, gear trains + reducers J4–J6 – check", base: [676, 511], ctrl: "IRC5 / OmniCore V250XT" },
  { id: "irb4600", ref: "ABB IRB 4600-60/2.05", cls: "medium-large (machine tending, palletising, cutting)",
    payload: 60, reach: 2050, mass: 425, rep: 0.06, mount: "floor, tilted, inverted, shelf", ip: "IP67",
    dims: { h1: 495, a1: 175, a2: 900, a3: 175, d4: 960, d6: 135 },
    lim: [[-180, 180], [-90, 150], [-180, 75], [-400, 400], [-125, 120], [-400, 400]],
    vmax: [175, 175, 175, 250, 250, 360], tacc: 0.40, balancer: true,
    gear: "RV (cycloidal) reducers J1–J3, gear trains + reducers J4–J6 – check", base: [730, 600], ctrl: "IRC5 / OmniCore V250XT" },
  { id: "irb6700", ref: "ABB IRB 6700-200/2.60", cls: "large (spot welding, heavy handling, machine loading)",
    payload: 200, reach: 2600, mass: 1170, rep: 0.05, mount: "floor", ip: "IP67",
    dims: { h1: 780, a1: 320, a2: 1125, a3: 200, d4: 1142.5, d6: 200 },
    lim: [[-170, 170], [-65, 85], [-180, 70], [-300, 300], [-130, 130], [-360, 360]],
    vmax: [110, 110, 110, 190, 150, 210], tacc: 0.60, balancer: true,
    gear: "RV (cycloidal) reducers J1–J3 (J1 large hollow), gear trains J4–J6 – check", base: [1000, 870], ctrl: "IRC5 / OmniCore V400XT" },
];
export function robotById(id) { return ROBOTS.find((r) => r.id === id) || ROBOTS[1]; }

/* Mechanical structure – shared texts (3D click info + structure table). Typical for this class, examples. */
export const PARTS = [
  { k: "base", n: "Base (foot)", ax: 0, t: "Cast iron / cast steel foot, bolted to the floor plate with 4 anchor bolts (or chemical anchors). Carries all forces and the tilting moment. Cable inlet (motor power, encoder, customer air + signals) at the rear." },
  { k: "j1", n: "Axis 1 – rotation (column / carousel)", ax: 1, t: "AC servo motor with brake + absolute encoder drives a large hollow RV (cycloidal) reducer, ratio ≈ 1:120–1:170. The column turns on the reducer's own main bearing. Hollow centre = path for the cable harness. Mechanical stop + adjustable stop pins." },
  { k: "j2", n: "Axis 2 – lower arm (shoulder)", ax: 2, t: "Servo motor + RV reducer on the side of the column. Carries the highest gravity torque (whole arm + payload). The balancing device (spring or gas cylinder) between column and lower arm takes part of this torque, so motor and gear can be smaller." },
  { k: "bal", n: "Balancing device (counterbalance)", ax: 2, t: "Pre-loaded spring pack (or gas/hydraulic cylinder) from the column to the lower arm. When the arm leans forward the spring stretches and pulls back – it compensates part of the gravity torque on J2. Dangerous stored energy: never open without the service tool." },
  { k: "larm", n: "Lower arm", ax: 2, t: "Cast steel / aluminium arm, very stiff in bending. Its length a2 sets most of the reach. Cables run along its side in a protected harness." },
  { k: "j3", n: "Axis 3 – upper arm (elbow)", ax: 3, t: "Servo motor + RV reducer at the elbow. Lifts the forearm, wrist and payload. With J2 it sets the height and distance of the wrist centre." },
  { k: "uarm", n: "Upper arm housing (rear)", ax: 3, t: "Housing behind the elbow. On most medium robots the motors of J4, J5 and J6 sit here at the rear – their mass balances the forearm and keeps the wrist light." },
  { k: "farm", n: "Forearm tube (J4 roll)", ax: 4, t: "Hollow tube that rotates (J4) in a bearing. Inside: hollow shafts that bring the J5 and J6 motion to the wrist. J4 gear: reducer at the rear of the tube." },
  { k: "wrist", n: "Wrist (J5 bend)", ax: 5, t: "Compact wrist housing. J5 bends the tool up/down through bevel gears + a small reducer. The wrist centre (crossing point of J4, J5, J6) makes the calculation (IK) simple: position from J1–J3, orientation from J4–J6." },
  { k: "flange", n: "Tool flange (J6)", ax: 6, t: "ISO 9409-1 flange with pitch circle, bolt holes and a dowel pin for the exact tool position. J6 turns the tool. All tool data (TCP, mass, centre of gravity) must be set in the controller." },
  { k: "motor", n: "Servo motors (6×)", ax: 0, t: "Permanent-magnet AC servo motors with holding brake (spring-applied, opens with 24 V) and absolute multi-turn encoder (battery backed, serial measurement board in the base). The brake holds the arm when the power is off." },
  { k: "cable", n: "Cable harness + customer air/signals", ax: 0, t: "Power and encoder cables run from the base through the hollow J1, along the lower arm to the upper arm. Customer air and signal lines end at the upper arm for the gripper. Bending life: millions of cycles – keep the dress pack loose." },
  { k: "grip", n: "Gripper (end effector, made by you)", ax: 6, t: "Not part of the robot. Pneumatic 2-finger / double gripper on the flange via an adapter plate (or a tool changer). Its mass, TCP and centre of gravity must be inside the load diagram of the robot." },
];

/* ------------------------------------------------------------------ small 4x4 / 3x3 math (row-major) */
export function mat4I() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
export function mul4(a, b) {
  const r = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[i * 4 + k] * b[k * 4 + j]; r[i * 4 + j] = s;
  }
  return r;
}
function Rx(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; }
function Ry(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; }
function Rz(t) { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
function Tr(x, y, z) { return [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1]; }
export { Rx, Ry, Rz, Tr };
export function pos4(m) { return [m[3], m[7], m[11]]; }
export function rot3(m) { return [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]; }
function mul3(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
  return r;
}
function tr3(a) { return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]; }
function fromRP(R, p) { return [R[0], R[1], R[2], p[0], R[3], R[4], R[5], p[1], R[6], R[7], R[8], p[2], 0, 0, 0, 1]; }
export { fromRP };

/* Euler ZYX (A about Z, B about Y, C about X) – the "A B C" shown on most teach pendants. deg. */
export function rotFromABC(A, B, C) { return rot3(mul4(mul4(Rz(A * D2R), Ry(B * D2R)), Rx(C * D2R))); }
export function abcFromRot(R) {
  const B = Math.asin(-Math.max(-1, Math.min(1, R[6])));
  let A, C;
  if (Math.abs(Math.cos(B)) > 1e-6) { A = Math.atan2(R[3], R[0]); C = Math.atan2(R[7], R[8]); }
  else { A = Math.atan2(-R[1], R[4]); C = 0; }
  return [A * R2D, B * R2D, C * R2D];
}

/* ------------------------------------------------------------------ forward kinematics */
// q: 6 joint angles in deg. tool: {x,y,z} TCP offset in the flange frame (mm, z = out of the flange).
// Returns the frames of every link (for the 3D model) and the TCP pose.
export function fk(rb, q, tool = { x: 0, y: 0, z: 0 }) {
  const d = rb.dims, r = q.map((v) => v * D2R);
  const F = [];
  let T = Rz(r[0]); F.push(T);                                         // 0: column frame (on the floor, turns with J1)
  T = mul4(T, Tr(d.a1, 0, d.h1)); T = mul4(T, Ry(r[1])); F.push(T);    // 1: lower arm frame (origin = J2 axis)
  T = mul4(T, Tr(0, 0, d.a2)); T = mul4(T, Ry(r[2])); F.push(T);       // 2: upper arm frame (origin = J3 axis)
  T = mul4(T, Tr(0, 0, d.a3)); T = mul4(T, Rx(r[3])); F.push(T);       // 3: forearm frame (origin on the forearm axis above J3, X along forearm)
  T = mul4(T, Tr(d.d4, 0, 0)); T = mul4(T, Ry(r[4])); F.push(T);       // 4: wrist frame (origin = wrist centre)
  T = mul4(T, Rx(r[5])); T = mul4(T, Tr(d.d6, 0, 0)); T = mul4(T, Ry(Math.PI / 2)); F.push(T); // 5: flange frame (Z out of flange)
  const Tt = mul4(T, Tr(tool.x || 0, tool.y || 0, tool.z || 0));
  const p = pos4(Tt), R = rot3(Tt);
  return { frames: F, flange: T, tcp: Tt, p, R, abc: abcFromRot(R), wc: pos4(F[4]) };
}

/* ------------------------------------------------------------------ inverse kinematics */
function wrapNear(a, ref, lo, hi) {           // a (deg) + k·360 closest to ref, inside [lo, hi] if possible
  let best = null;
  for (let k = -2; k <= 2; k++) {
    const v = a + 360 * k;
    if (v < lo - 1e-6 || v > hi + 1e-6) continue;
    if (best === null || Math.abs(v - ref) < Math.abs(best - ref)) best = v;
  }
  return best;
}
// Target: p = [x,y,z] TCP (mm), R = 3x3 rotation of the TCP frame. qRef = current joints (picks the closest solution).
// cfg (optional): {front: true/false, up: true/false, flip: true/false} to force a configuration.
// Returns {ok, q, err, all:[...]}.
export function ik(rb, p, R, tool = { x: 0, y: 0, z: 0 }, qRef = [0, 0, 0, 0, 0, 0], cfg = null) {
  const d = rb.dims;
  // flange pose = TCP pose · inverse(tool offset)
  const tz = [R[2], R[5], R[8]];
  const pf = [p[0] - (R[0] * (tool.x || 0) + R[1] * (tool.y || 0) + R[2] * (tool.z || 0)),
              p[1] - (R[3] * (tool.x || 0) + R[4] * (tool.y || 0) + R[5] * (tool.z || 0)),
              p[2] - (R[6] * (tool.x || 0) + R[7] * (tool.y || 0) + R[8] * (tool.z || 0))];
  const pw = [pf[0] - d.d6 * tz[0], pf[1] - d.d6 * tz[1], pf[2] - d.d6 * tz[2]];   // wrist centre
  const b = Math.hypot(d.d4, d.a3), beta = Math.atan2(d.a3, d.d4);
  const sols = [];
  let reachErr = "";
  for (const front of [true, false]) {
    if (cfg && cfg.front !== undefined && cfg.front !== front) continue;
    let t1 = Math.atan2(pw[1], pw[0]);
    const rho = Math.hypot(pw[0], pw[1]);
    let rr;
    if (front) rr = rho - d.a1; else { t1 += Math.PI; rr = -rho - d.a1; }
    const zz = pw[2] - d.h1;
    const D = (rr * rr + zz * zz - d.a2 * d.a2 - b * b) / (2 * d.a2 * b);
    if (Math.abs(D) > 1) { if (front) reachErr = "out of reach (wrist centre " + Math.round(Math.hypot(rr, zz) - d.a2 - b) + " mm too far)"; else if (!reachErr) reachErr = "out of reach"; continue; }
    for (const up of [true, false]) {
      if (cfg && cfg.up !== undefined && cfg.up !== up) continue;
      const g = (up ? -1 : 1) * Math.acos(D);
      const a2a = Math.atan2(zz, rr) - Math.atan2(b * Math.sin(g), d.a2 + b * Math.cos(g));
      const t2 = Math.PI / 2 - a2a;
      const t3 = beta - Math.PI / 2 - g;
      // wrist: R36 = R03ᵀ · R_flange · Ry(90)ᵀ   with R03 = Rz(t1)·Ry(t2+t3)
      const R03 = rot3(mul4(Rz(t1), Ry(t2 + t3)));
      const R36 = mul3(mul3(tr3(R03), R), tr3(rot3(Ry(Math.PI / 2))));
      const c5 = Math.max(-1, Math.min(1, R36[0]));
      for (const flip of [false, true]) {
        if (cfg && cfg.flip !== undefined && cfg.flip !== flip) continue;
        let t4, t5, t6;
        const s5abs = Math.sqrt(Math.max(0, 1 - c5 * c5));
        if (s5abs < 1e-5) {                                   // wrist singularity: J4 + J6 only as a sum
          t5 = 0; t4 = qRef[3] * D2R; t6 = Math.atan2(R36[7], R36[4]) - t4;
          if (flip) continue;
        } else {
          const sg = flip ? -1 : 1;
          t5 = sg * Math.acos(c5);
          t4 = Math.atan2(sg * R36[3], -sg * R36[6]);
          t6 = Math.atan2(sg * R36[1], sg * R36[2]);
        }
        const raw = [t1, t2, t3, t4, t5, t6].map((v) => v * R2D);
        const q = []; let okLim = true;
        for (let i = 0; i < 6; i++) {
          const v = wrapNear(raw[i], qRef[i], rb.lim[i][0], rb.lim[i][1]);
          if (v === null) { okLim = false; q.push(raw[i]); } else q.push(v);
        }
        sols.push({ q, okLim, front, up, flip, sing: s5abs < Math.sin(2 * D2R) });
      }
    }
  }
  const good = sols.filter((s) => s.okLim);
  if (!good.length) return { ok: false, q: null, err: sols.length ? "axis limit (no solution inside the axis ranges)" : (reachErr || "out of reach"), all: sols };
  const dist = (s) => s.q.reduce((a, v, i) => a + Math.abs(v - qRef[i]) * (i < 3 ? 2 : 1), 0);
  good.sort((a, c) => dist(a) - dist(c));
  return { ok: true, q: good[0].q, cfg: { front: good[0].front, up: good[0].up, flip: good[0].flip }, sing: good[0].sing, err: "", all: sols };
}

export function checkLimits(rb, q) {
  const out = [];
  for (let i = 0; i < 6; i++) if (q[i] < rb.lim[i][0] - 1e-6 || q[i] > rb.lim[i][1] + 1e-6) out.push("J" + (i + 1));
  return out;
}

/* ------------------------------------------------------------------ motion planning */
// Normalised trapezoid profile: s(τ) for τ in [0,1], accel fraction f (0 < f <= 0.5).
export function trap(tau, f) {
  tau = Math.max(0, Math.min(1, tau));
  const vp = 1 / (1 - f);                              // peak normalised speed
  if (tau < f) return 0.5 * vp / f * tau * tau;
  if (tau > 1 - f) { const u = 1 - tau; return 1 - 0.5 * vp / f * u * u; }
  return vp * (tau - f / 2);
}
export function trapV(tau, f) {                         // ds/dτ
  tau = Math.max(0, Math.min(1, tau));
  const vp = 1 / (1 - f);
  if (tau < f) return vp * tau / f;
  if (tau > 1 - f) return vp * (1 - tau) / f;
  return vp;
}

// PTP (MoveJ): all axes start and stop together; the slowest axis sets the time.
// ovr = speed override 0..1. Returns {T, ta, f, lead, q0, q1, at(t)->q}
export function planPTP(rb, q0, q1, ovr = 1, vFrac = 1) {
  const ta = rb.tacc;
  let Tc = 0, lead = 0;
  for (let i = 0; i < 6; i++) {
    const v = rb.vmax[i] * ovr * vFrac;
    const ti = Math.abs(q1[i] - q0[i]) / v;              // time at full speed
    if (ti > Tc) { Tc = ti; lead = i; }
  }
  let T, f;
  if (Tc < 1e-6) { T = 0; f = 0.5; }
  else if (Tc >= ta) { T = Tc + ta; f = ta / T; }        // trapezoid
  else { T = 2 * Math.sqrt(Tc * ta); f = 0.5; }          // triangle (short move, never reaches full speed)
  return {
    type: "J", T, ta, f, lead, q0: q0.slice(), q1: q1.slice(),
    at(t) { const s = T > 0 ? trap(t / T, f) : 1; return q0.map((v, i) => v + (q1[i] - v) * s); },
    vel(t) { const ds = T > 0 ? trapV(t / T, f) / T : 0; return q0.map((v, i) => (q1[i] - v) * ds); },
  };
}

function slerpR(R0, R1, s) {                            // rotation interpolation through axis-angle
  const Rr = mul3(tr3(R0), R1);
  const c = Math.max(-1, Math.min(1, (Rr[0] + Rr[4] + Rr[8] - 1) / 2));
  const ang = Math.acos(c);
  if (ang < 1e-9) return R0.slice();
  let ax = [Rr[7] - Rr[5], Rr[2] - Rr[6], Rr[3] - Rr[1]];
  let n = Math.hypot(ax[0], ax[1], ax[2]);
  if (n < 1e-9) {                                        // 180°: take the axis from the diagonal
    ax = [Math.sqrt(Math.max(0, (Rr[0] + 1) / 2)), Math.sqrt(Math.max(0, (Rr[4] + 1) / 2)), Math.sqrt(Math.max(0, (Rr[8] + 1) / 2))];
    if (Rr[1] < 0) ax[1] = -ax[1]; if (Rr[2] < 0) ax[2] = -ax[2];
    n = Math.hypot(ax[0], ax[1], ax[2]);
  }
  ax = ax.map((v) => v / n);
  const a = ang * s, cs = Math.cos(a), sn = Math.sin(a), C = 1 - cs, [x, y, z] = ax;
  const Ra = [cs + x * x * C, x * y * C - z * sn, x * z * C + y * sn,
              y * x * C + z * sn, cs + y * y * C, y * z * C - x * sn,
              z * x * C - y * sn, z * y * C + x * sn, cs + z * z * C];
  return mul3(R0, Ra);
}
export { slerpR };

// LIN (MoveL): the TCP goes on a straight line with speed v (mm/s); orientation turns evenly.
// The joints are sampled; if an axis would be faster than its limit, the move gets slower.
// Returns the plan or {ok:false, err}.
export function planLIN(rb, q0, p1, R1, tool, v, ovr = 1) {
  const st = fk(rb, q0, tool), p0 = st.p, R0 = st.R;
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
  const Rr = mul3(tr3(R0), R1);
  const ang = Math.acos(Math.max(-1, Math.min(1, (Rr[0] + Rr[4] + Rr[8] - 1) / 2))) * R2D;
  const N = Math.max(8, Math.ceil(Math.max(L / 5, ang / 1)));
  const qs = [q0.slice()];
  let q = q0.slice(), sing = false;
  for (let k = 1; k <= N; k++) {
    const s = k / N;
    const p = [p0[0] + (p1[0] - p0[0]) * s, p0[1] + (p1[1] - p0[1]) * s, p0[2] + (p1[2] - p0[2]) * s];
    const r = ik(rb, p, slerpR(R0, R1, s), tool, q);
    if (!r.ok) return { ok: false, err: "LIN path not possible at " + Math.round(s * 100) + " %: " + r.err };
    for (let i = 0; i < 6; i++) if (Math.abs(r.q[i] - q[i]) > 30) return { ok: false, err: "LIN path passes a singularity / configuration change (J" + (i + 1) + " jumps) – use MoveJ" };
    if (r.sing) sing = true;
    q = r.q; qs.push(q);
  }
  const ta = Math.min(rb.tacc, 0.4);
  const vEff = v * ovr;
  let Tc = Math.max(L / vEff, ang / (180 * ovr));        // orientation speed limit ≈ 180°/s (example)
  // joint speed check: peak normalised speed vp = 1/(1-f); check segment by segment
  let worst = 0, lead = -1;
  for (let k = 1; k <= N; k++) for (let i = 0; i < 6; i++) {
    const need = Math.abs(qs[k][i] - qs[k - 1][i]) * N;  // deg per unit of s
    const r = need / (rb.vmax[i] * ovr);                 // seconds needed for whole path at that rate
    if (r > worst) { worst = r; lead = i; }
  }
  let limitedBy = "TCP speed";
  if (worst > Tc) { Tc = worst; limitedBy = "axis J" + (lead + 1) + " speed (near singularity / big reorientation)"; }
  let T, f;
  if (Tc < 1e-6) { T = 0; f = 0.5; } else if (Tc >= ta) { T = Tc + ta; f = ta / T; } else { T = 2 * Math.sqrt(Tc * ta); f = 0.5; }
  const at = (t) => {
    const s = T > 0 ? trap(t / T, f) : 1, x = s * N, k = Math.min(N - 1, Math.floor(x)), u = x - k;
    return qs[k].map((v, i) => v + (qs[k + 1][i] - v) * u);
  };
  return {
    ok: true, type: "L", T, ta, f, L, ang, sing, limitedBy, q0: q0.slice(), q1: qs[N].slice(), at,
    vel(t) { const h = 0.002; return at(Math.min(T, t + h)).map((v, i) => (v - at(Math.max(0, t - h))[i]) / (2 * h)); },
  };
}

/* ------------------------------------------------------------------ workspace (side view) */
// Outline of the wrist-centre envelope in the arm plane (r, z) for J1 fixed: sampled J2/J3 grid -> points.
export function envelope(rb, step = 3) {
  const d = rb.dims, pts = [];
  const b = Math.hypot(d.d4, d.a3), beta = Math.atan2(d.a3, d.d4);
  for (let q2 = rb.lim[1][0]; q2 <= rb.lim[1][1]; q2 += step)
    for (let q3 = rb.lim[2][0]; q3 <= rb.lim[2][1]; q3 += step) {
      const t2 = q2 * D2R, psi = (q2 + q3) * D2R - beta;
      const r = d.a1 + d.a2 * Math.sin(t2) + b * Math.cos(psi);
      const z = d.h1 + d.a2 * Math.cos(t2) - b * Math.sin(psi);
      pts.push([r, z]);
    }
  return pts;
}

/* Gravity torque from the payload alone on J2/J3/J5 (N·m) – simple check, arm masses NOT included. */
export function payloadTorque(rb, q, mKg, tool) {
  const st = fk(rb, q, tool), g = 9.81;
  const pc = st.p;                                       // payload centre ≈ TCP (example)
  const j2 = pos4(st.frames[1]), j3 = pos4(st.frames[2]), wc = st.wc;
  const hd = (a) => Math.hypot(pc[0] - a[0], pc[1] - a[1]);  // horizontal lever arm
  return { j2: mKg * g * hd(j2) / 1000, j3: mKg * g * hd(j3) / 1000, j5: mKg * g * hd(wc) / 1000 };
}

/* ------------------------------------------------------------------ machine-tending cell (shared layout) */
// Everything scales with the robot reach (k = reach / 1650 mm) so every robot size gets a cell that fits.
// Robot base frame, mm. Part = compressor housing (example), cylinder with a flange.
// Approach directions: conveyors from ABOVE (tool Z down), machine from the FRONT (tool Z along +X).
export function cellLayout(rb) {
  const k = rb.reach / 1650, ps = Math.cbrt(Math.max(1, Math.min(rb.payload, 60)) / 20);
  const part = { d: Math.round(140 * ps), h: Math.round(160 * ps), mass: +(Math.min(rb.payload * 0.5, 12 * ps * ps * ps)).toFixed(1) };
  const pedestal = k < 0.6 ? 500 : 0;                                      // small robots stand on a table/pedestal (floor is at z = −pedestal)
  const convZ = Math.round(750 * Math.min(1, k));                          // conveyor top height above the robot base
  const toolLen = Math.round(180 * Math.max(0.5, Math.sqrt(k)));          // gripper TCP length (flange -> finger centre)
  const fx = Math.round(0.58 * rb.reach + toolLen + rb.dims.d6 + part.h / 2);   // fixture centre: wrist centre at ≈ 58 % of the reach
  const C = {
    k, part, toolLen, pedestal,
    tool: { x: 0, y: 0, z: toolLen }, gripMass: +(3 * ps * ps).toFixed(1),
    infeed:  { x0: 350 * k, x1: 350 * k, y0: 600 * k, y1: 1700 * k, z: convZ, w: Math.round(320 * ps), dir: [0, -1, 0],
               pick: [350 * k, 820 * k, convZ + part.h] },              // parts come toward the robot (−Y)
    outfeed: { x0: 350 * k, x1: 350 * k, y0: -820 * k, y1: -1700 * k, z: convZ, w: Math.round(320 * ps), dir: [0, -1, 0],
               place: [350 * k, -820 * k, convZ + part.h] },            // finished parts go away (−Y)
    machine: { x0: fx - 150 * k, x1: fx + 1050 * k, y0: -650 * k, y1: 650 * k, h: Math.max(1600, 2100 * k) - pedestal,
               door: { y0: -380 * k, y1: 380 * k, z0: convZ + 100 * k, z1: convZ + 750 * k },
               fixture: [fx, 0, convZ + 300 * k] },               // part axis horizontal, loaded along +X
    fence: { x0: -900 * k, x1: fx - 150 * k, y0: -1900 * k, y1: 1900 * k, h: Math.max(1400, 2000 * Math.min(1, k)) },
    home: [0, 0, 0, 0, 30, 0],
  };
  C.machine.load = [C.machine.fixture[0] - part.h / 2, 0, C.machine.fixture[2]]; // TCP at the part centre when it sits in the fixture
  return C;
}
// Typical tool orientations (3x3) for the cell: down = tool Z points to the floor, front = tool Z along +X.
export const ORIENT = { down: () => rotFromABC(0, 180, 0), front: () => rotFromABC(0, 90, 0) };
