/* Hydraulics tab – items 2 + 3: lumped-parameter SIMULATION CORE (pure math, no DOM).
 * A circuit = nodes (oil volumes with one pressure each) + elements (flows between nodes) + actuators (cylinder, motor,
 * accumulator, gear flow divider). Every time step:
 *   1. every element gives its flow Q (a → b) from the node pressures (orifice Q = Cd·A·√(2Δp/ρ), laminar leak Q = G·Δp, pump …)
 *   2. every node: dp/dt = β / V · ΣQ   (β = bulk modulus of the oil, V = hose + chamber volume)
 *   3. every actuator: Newton m·dv/dt = ΣF (cylinder) or J·dω/dt = ΣT (motor)
 * Explicit Euler with a "stability volume" (V_eff ≥ 1.5·β·G_max·dt, G_max = largest conductance seen at the node, so the
 * volume stays constant and oil volume is conserved), small dt (20–50 µs). Example values only.
 */
export const OIL = { rho: 870, Cd: 0.62, beta: 1.4e9, pvap: -0.09e6, nu: 46e-6 };
export const LPM = 1 / 60000;          // 1 L/min in m³/s
export const MPA = 1e6;
export const G0 = 9.81;
export const areaD = (dmm) => Math.PI / 4 * (dmm / 1000) ** 2;          // m² from a diameter in mm
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const ramp = (v, a, b) => clamp01((v - a) / (b - a));
const PT = 1e5; // below 0.1 MPa the orifice is treated as laminar (linear) – numerically smooth

/** orifice: returns [Q (m³/s, a→b positive), G = secant conductance] for area A (m²) and pressure difference dp (Pa) */
export function orifice(A, dp) {
  if (!(A > 0)) return [0, 0];
  const k = OIL.Cd * A * Math.sqrt(2 / OIL.rho), ad = Math.abs(dp);
  if (ad < PT) { const gl = k * Math.sqrt(PT) / PT; return [gl * dp, gl]; }
  const q = k * Math.sqrt(ad); return [dp < 0 ? -q : q, q / ad];
}
/** orifice area (m²) that passes Q (m³/s) at dp (Pa) – inverse of the orifice equation */
export const orificeArea = (Q, dp) => Q / (OIL.Cd * Math.sqrt(2 * dp / OIL.rho));

export class Net {
  constructor(o = {}) {
    this.t = 0; this.dt = o.dt || 2e-5; this.beta = o.beta || OIL.beta;
    this.N = { T: { V0: 0, Vx: 0, p: 0, q: 0, g: 0, tank: true, cav: false } };
    this.E = []; this.e = {}; this.A = []; this.a = {}; this.pre = null; this.u = {};
  }
  node(name, Vlitre, p0 = 0) { this.N[name] = { V0: Vlitre / 1000, Vx: 0, p: p0, q: 0, g: 0, tank: false, cav: false, pmin: p0, pmax: p0 }; return this; }
  p(n) { return this.N[n].p; }
  add(e) { this.E.push(e); if (e.name) this.e[e.name] = e; return e; }
  act(a) { this.A.push(a); if (a.name) this.a[a.name] = a; return a; }
  q(name) { const e = this.e[name]; return e ? e.q : 0; }
  step(dt) {
    const N = this.N;
    for (const k in N) { N[k].q = 0; N[k].g = 0; N[k].Vx = 0; }
    if (this.pre) this.pre(this, dt);
    for (const a of this.A) if (a.flows) a.flows(this, dt);
    for (const e of this.E) {
      e.flow(this, dt);
      const na = N[e.a], nb = N[e.b];
      if (na) { na.q -= e.q; na.g += e.g; }
      if (nb) { nb.q += e.q; nb.g += e.g; }
    }
    for (const k in N) {
      const nd = N[k]; if (nd.tank) continue;
      if (nd.g > (nd.gm || 0)) nd.gm = nd.g;   // running max → constant stability volume → mass conserving
      const V = nd.V0 + nd.Vx, Ve = Math.max(V, this.beta * (nd.gm || 0) * dt * 1.5);
      nd.p += this.beta / Ve * nd.q * dt;
      if (nd.p < OIL.pvap) nd.p = OIL.pvap;
      nd.cav = nd.p < -0.05e6;
    }
    for (const a of this.A) if (a.mech) a.mech(this, dt);
    for (const e of this.E) if (e.post) e.post(this, dt);
    this.t += dt;
  }
  run(sec, each) { const n = Math.round(sec / this.dt); for (let i = 0; i < n; i++) { this.step(this.dt); if (each) each(this); } }
}

/* ------------------------------------------------------------------ elements */
/** orifice / valve path with area function Af(net) (m²); optional first-order lag tau (s) for spool / poppet movement */
export function orif(a, b, Af, o = {}) {
  return { a, b, name: o.name, tau: o.tau || 0, y: null, A: 0, q: 0, g: 0,
    flow(n, dt) {
      let A = Math.max(0, Af(n));
      if (this.tau) { this.y = this.y === null ? A : this.y + (A - this.y) * Math.min(1, dt / this.tau); A = this.y; }
      this.A = A; const r = orifice(A, n.p(a) - n.p(b)); this.q = r[0]; this.g = r[1];
    } };
}
/** laminar leakage Q = G·Δp (G in m³/s/Pa) */
export function lam(a, b, Gf, o = {}) {
  return { a, b, name: o.name, q: 0, g: 0, flow(n) { const G = typeof Gf === "function" ? Gf(n) : Gf; this.g = G; this.q = G * (n.p(a) - n.p(b)); } };
}
/** flow source from the tank (pump): Qf(net) in m³/s */
export function src(b, Qf, o = {}) { return { a: "T", b, name: o.name, q: 0, g: 0, flow(n) { this.q = Qf(n); this.g = 0; } }; }
/** 2-way pressure-compensated flow control a→b (Qset m³/s), free reverse flow through a bypass check (Acheck) */
export function fcv(a, b, Qf, o = {}) {
  const Amax = o.Amax || 20e-6, Ac = o.Acheck || 0;
  return { a, b, name: o.name, q: 0, g: 0, reg: false,
    flow(n) {
      const dp = n.p(a) - n.p(b);
      if (dp >= 0) { const r = orifice(Amax, dp), qs = Math.max(0, Qf(n)); this.reg = r[0] > qs; if (this.reg) { this.q = qs; this.g = 0; } else { this.q = r[0]; this.g = r[1]; } }
      else { const r = orifice(Ac, dp); this.q = r[0]; this.g = r[1]; this.reg = false; }
    } };
}

/* ------------------------------------------------------------------ actuators */
/** differential cylinder. o: {name, A:node cap side, B:node rod side, D, d (mm), L (m stroke), m (kg), x0, F(net,cyl) = external force
 *  against extension (N), vert (gravity m·g against extension), c (N·s/m), Ff (N, seal friction),
 *  cd = structure damping of fast oscillations only (N·s/m, acts on v − v_filtered(0.15 s), no steady loss)} */
export function cyl(o) {
  const c = { kind: "cyl", name: o.name, na: o.A, nb: o.B, D: o.D, d: o.d, A1: areaD(o.D), A2: areaD(o.D) - areaD(o.d), L: o.L, m: o.m, x: o.x0 || 0, v: 0,
    F: o.F || (() => 0), vert: !!o.vert, c: o.c ?? 2000, Ff: o.Ff ?? 200, Fload: 0, hitEnd: 0, cd: o.cd ?? 0, vf: 0,
    flows(n) { const NA = n.N[this.na], NB = n.N[this.nb]; NA.q -= this.A1 * this.v; NB.q += this.A2 * this.v; NA.Vx += this.A1 * this.x; NB.Vx += this.A2 * (this.L - this.x); },
    mech(n, dt) {
      const ext = this.F(n, this) + (this.vert ? this.m * G0 : 0); this.Fload = ext;
      let F = n.p(this.na) * this.A1 - n.p(this.nb) * this.A2 - ext - this.c * this.v - this.cd * (this.v - this.vf);
      this.vf += (this.v - this.vf) * Math.min(1, dt / 0.15);
      if (Math.abs(this.v) < 2e-5 && Math.abs(F) <= this.Ff) this.v = 0;
      else { F -= this.Ff * Math.sign(this.v || F); this.v += F / this.m * dt; }
      this.x += this.v * dt;
      if (this.x <= 0) { this.x = 0; if (this.v < 0) this.v = 0; }
      if (this.x >= this.L) { this.x = this.L; if (this.v > 0) this.v = 0; }
    } };
  return c;
}
/** hydraulic motor. o: {name, A, B nodes, V (cm³/rev), J (kg·m²), TL(net,mot) load torque against forward rotation (N·m),
 *  etaHm, Gleak (internal A↔B), brake(net) → true = spring brake applied, Tb brake torque, cv viscous (N·m·s),
 *  cd damping of fast speed changes only} – forward = flow A → B */
export function motor(o) {
  const Vr = o.V * 1e-6 / (2 * Math.PI);
  return { kind: "motor", name: o.name, na: o.A, nb: o.B, Vcm: o.V, Vr, J: o.J, w: 0, th: 0, TL: o.TL || (() => 0), etaHm: o.etaHm ?? 0.9, T0: o.T0 ?? 5,
    G: o.Gleak ?? 0, brake: o.brake || (() => false), Tb: o.Tb ?? 0, braked: false, Th: 0, cd: o.cd ?? 0, wf: 0, cv: o.cv ?? 0, cdT: o.cdT ?? 0.3,
    flows(n) { const NA = n.N[this.na], NB = n.N[this.nb]; const q = this.Vr * this.w + this.G * (NA.p - NB.p); NA.q -= q; NB.q += q; NA.g += this.G; NB.g += this.G; },
    mech(n, dt) {
      const Th = (n.p(this.na) - n.p(this.nb)) * this.Vr; this.Th = Th;
      const TL = this.TL(n, this); this.braked = this.brake(n);
      const Tf = (1 - this.etaHm) * Math.abs(Th) + this.T0 + (this.braked ? this.Tb : 0);
      const T = Th - TL - this.cd * (this.w - this.wf) - this.cv * this.w; this.wf += (this.w - this.wf) * Math.min(1, dt / this.cdT);
      if (Math.abs(this.w) < 0.02 && Math.abs(T) <= Tf) this.w = 0;
      else { const w0 = this.w; this.w += (T - Tf * Math.sign(this.w || T)) / this.J * dt; if (w0 !== 0 && Math.sign(this.w) !== Math.sign(w0) && this.braked) this.w = 0; }
      this.th += this.w * dt;
    } };
}
/** gas accumulator at node. o: {name, node, V0 (L), p0 (MPa gauge pre-charge), n (1 isothermal … 1.4 adiabatic), A (m² connection), Vo0 (L oil)} */
export function accu(o) {
  return { kind: "acc", name: o.name, nd: o.node, V0: o.V0 / 1000, p0: o.p0 * MPA, n: o.n ?? 1.4, Ac: o.A ?? 30e-6, Vo: (o.Vo0 || 0) / 1000, q: 0,
    pg() { if (this.Vo <= 0) return this.p0; return (this.p0 + 1e5) * Math.pow(this.V0 / Math.max(1e-9, this.V0 - this.Vo), this.n) - 1e5; },
    flows(n) { const N = n.N[this.nd]; const r = orifice(this.Ac, N.p - this.pg()); let q = r[0]; if (q < 0 && this.Vo <= 0) q = 0; this.q = q; N.q -= q; N.g += r[1]; },
    mech(n, dt) { this.Vo = Math.max(0, Math.min(this.V0 * 0.95, this.Vo + this.q * dt)); } };
}
/** gear flow divider: two equal gear sections on one shaft. inlet node, outlets o1/o2, V (cm³/rev per section), leak G (Pa → m³/s) */
export function divider(o) {
  const Vr = o.V * 1e-6 / (2 * Math.PI);
  return { kind: "div", name: o.name, ni: o.in, n1: o.o1, n2: o.o2, Vr, J: o.J ?? 2e-4, G: o.G ?? 2e-12, w: 0, q1: 0, q2: 0,
    flows(n) {
      const pi = n.p(this.ni), p1 = n.p(this.n1), p2 = n.p(this.n2);
      this.q1 = this.Vr * this.w - this.G * (p1 - pi); this.q2 = this.Vr * this.w - this.G * (p2 - pi);
      n.N[this.ni].q -= this.q1 + this.q2; n.N[this.n1].q += this.q1; n.N[this.n2].q += this.q2;
      n.N[this.ni].g += 2 * this.G; n.N[this.n1].g += this.G; n.N[this.n2].g += this.G;
    },
    mech(n, dt) { const T = this.Vr * (2 * n.p(this.ni) - n.p(this.n1) - n.p(this.n2)) - 0.02 * this.w; this.w += T / this.J * dt; } };   // both directions: divider (extend) and combiner (retract)
}

/* ------------------------------------------------------------------ 4/3 directional valve helper
 * s = spool position −1 … +1 (+1 = solenoid Y1 / box "a": P→A, B→T; −1 = Y2 / box "b": P→B, A→T).
 * centre: "closed" | "float" (A,B→T) | "tandem" (P→T) | "open". Adds orifices + spool leakage (laminar G). */
export function dcv(net, o) {
  const { P, A, B, T = "T", Av = 25e-6, centre = "closed", leak = 0, tau = 0.04, pre = "" } = o;
  const s = () => net.u[o.key || "s"] || 0;
  const pos = () => Math.max(0, s()), neg = () => Math.max(0, -s()), mid = () => Math.max(0, 1 - Math.abs(s()) * 1.6);
  net.add(orif(P, A, () => Av * pos(), { name: pre + "PA", tau }));
  net.add(orif(B, T, () => Av * pos(), { name: pre + "BT", tau }));
  net.add(orif(P, B, () => Av * neg(), { name: pre + "PB", tau }));
  net.add(orif(A, T, () => Av * neg(), { name: pre + "AT", tau }));
  if (centre === "float" || centre === "open") { net.add(orif(A, T, () => Av * 0.6 * mid(), { name: pre + "cAT", tau })); net.add(orif(B, T, () => Av * 0.6 * mid(), { name: pre + "cBT", tau })); }
  if (centre === "tandem" || centre === "open") net.add(orif(P, T, () => Av * 1.2 * mid(), { name: pre + "cPT", tau }));
  if (leak > 0) {   // spool clearance leakage (laminar), always present
    if (centre !== "float" && centre !== "open") { net.add(lam(A, T, leak, { name: pre + "lAT" })); net.add(lam(B, T, leak, { name: pre + "lBT" })); }
    if (centre !== "tandem" && centre !== "open") { net.add(lam(P, A, leak, { name: pre + "lPA" })); net.add(lam(P, B, leak, { name: pre + "lPB" })); }
  }
}
/** leakage conductance G (m³/s/Pa) from "cm³/min at 10 MPa" */
export const leakG = (cm3min, atMPa = 10) => cm3min * 1e-6 / 60 / (atMPa * MPA);

/* ------------------------------------------------------------------ small helpers for hand checks */
export const cylForce = (p, A) => p * A;                      // N from Pa, m²
export const flowLpm = (A_cm2, v_ms) => A_cm2 * v_ms * 60 / 10; // L/min = A[cm²]·v[m/min]/10
export const powerKW = (pbar, Qlpm, eta = 1) => pbar * Qlpm / (600 * eta);
