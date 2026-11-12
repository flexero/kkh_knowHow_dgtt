/* Installation tab – items 1 + 2 – all calculations (pure functions, no DOM).
 * Used by instmech_i1.js (foundation, vibration) and instmech_i2.js (levelling, alignment, acceptance).
 * Guide: docs/26_installation_foundation_alignment.md. All values are EXAMPLES – the machine maker's installation manual,
 * a structural engineer (slab, foundation) and the standards decide for the real machine. */

export const G = 9.81;

/* ---------------------------------------------------------------- example data: HMC 500 (catalogue class, example) */
export const HMC = {
  mMachine: 12000,      // kg, machine incl. column, table, magazine (example)
  mTableLoad: 510,      // kg, pallet 110 + workpiece 400 on the table
  mApc: 1500,           // kg, pallet changer with 2nd pallet stand (example)
  mPallet2: 510,        // kg, 2nd pallet + workpiece on the APC
  mCoolant: 1050,       // kg, 800 L emulsion (≈ 1.0 kg/L) + tank 250 kg
  mChip: 600,           // kg, chip conveyor
  footL: 5.2, footW: 2.8, height: 3.0, // m, footprint with APC
  bedL: 3.4, bedW: 2.2, // m, pad pattern of the bed (6 levelling bolts)
  mColumn: 1800, accG: 0.6, mTable: 900, colCgH: 1.4, // moving column, acceleration, CoG height above the pads (m)
  rpm: 6000,
};

/* six levelling bolts – bed coordinates: x to the right, z from the front (table / APC side, z < 0) to the rear (column).
 * 1–2 front, 3–4 middle (auxiliary), 5–6 rear. Main bolts = the 4 corners. */
export const PADS = [
  { n: 1, x: -1.1, z: -1.7, main: true }, { n: 2, x: 1.1, z: -1.7, main: true },
  { n: 3, x: -1.1, z: 0, main: false }, { n: 4, x: 1.1, z: 0, main: false },
  { n: 5, x: -1.1, z: 1.7, main: true }, { n: 6, x: 1.1, z: 1.7, main: true },
];

/* ---------------------------------------------------------------- 1. floor / slab / pad checks */
/* fcd = αcc·fck/γc (EN 1992-1-1, αcc = 0.85, γc = 1.5) · punching: v_Ed = F/(u1·d), u1 = 2π(a + 2d) for a round pad of radius a,
 * v_Rd,c(min) = 0.035·k^1.5·√fck, k = 1 + √(200/d[mm]) ≤ 2 (slab without shear reinforcement, simplified). */
export function floorCheck(p) {
  const mPads = p.mMachine + p.mTableLoad;                // kg on the 6 levelling bolts of the machine bed
  const mTotal = p.mMachine + p.mTableLoad + p.mApc + p.mPallet2 + p.mCoolant + p.mChip;
  const W = mTotal * G / 1000;                            // kN total
  const Wpads = mPads * G / 1000;                          // kN on the bed pads
  const Fpad = p.kUneven * Wpads / p.nPads;                // kN, highest pad (uneven factor)
  const aPad = p.padD / 2000;                              // m radius
  const Apad = Math.PI * aPad * aPad;                      // m²
  const pPad = Fpad / Apad / 1000;                         // MPa (kN/m² /1000)
  const fcd = 0.85 * p.fck / 1.5;                          // MPa design compressive strength
  const Afoot = p.footL * p.footW;                         // m²
  const qFoot = W / Afoot;                                 // kN/m² = kPa average under the footprint
  const h = p.slabH / 1000, d = Math.max(0.05, h - 0.05);  // m, effective depth ≈ h − 50 mm
  const u1 = 2 * Math.PI * (aPad + 2 * d);                 // m control perimeter at 2d
  const vEd = Fpad / (u1 * d) / 1000;                      // MPa
  const k = Math.min(2, 1 + Math.sqrt(200 / (d * 1000)));
  const vRd = 0.035 * Math.pow(k, 1.5) * Math.sqrt(p.fck); // MPa
  const Aeff = (p.footL + 2 * h) * (p.footW + 2 * h);      // m², 45° load spread through the slab
  const slabW = Aeff * h * 25;                             // kN slab self-weight (25 kN/m³)
  const qGround = (W + slabW) / Aeff;                      // kPa on the soil
  return { mPads, mTotal, W, Wpads, Fpad, Apad, pPad, fcd, padOk: pPad <= fcd, Afoot, qFoot, floorOk: qFoot <= p.qFloor,
    d, u1, vEd, k, vRd, punchOk: vEd <= vRd, Aeff, slabW, qGround, groundOk: qGround <= p.qSoil,
    slabMinOk: p.slabH >= p.slabMin };
}

/* isolated foundation block: mass ratio rule, plan = machine footprint + margin each side, depth = m_block/(ρ·A) (min depth). */
export function blockSize(p) {
  const mBlock = p.ratio * p.mMachine;
  const L = p.footL + 2 * p.margin, B = p.footW + 2 * p.margin;
  const A = L * B;
  const Vneed = mBlock / p.rho;
  const Hcalc = Vneed / A;
  const H = Math.max(p.hMin, Math.ceil(Hcalc * 20) / 20);     // round up to 50 mm
  const V = A * H, mReal = V * p.rho;
  const qSoil = (mReal + p.mMachine) * G / 1000 / A;          // kPa
  return { mBlock, L, B, A, Vneed, Hcalc, H, V, mReal, ratioReal: mReal / p.mMachine, qSoil, soilOk: qSoil <= p.qSoil };
}

/* ---------------------------------------------------------------- 2. single-degree-of-freedom isolation */
export function sdof(m, kNmm, zeta, f) {
  const k = kNmm * 1e6;                         // N/m (kN/mm → N/m)
  const wn = Math.sqrt(k / m);
  const fn = wn / (2 * Math.PI);
  const delta = m * G / k * 1000;               // mm static deflection
  const fnDelta = 15.76 / Math.sqrt(delta);     // Hz, the 15.76/√δ rule
  const r = f / fn;
  const T = trans(r, zeta);
  return { k, wn, fn, delta, fnDelta, r, T, iso: (1 - T) * 100, isolates: r > Math.SQRT2 };
}
export function trans(r, z) {
  const a = 2 * z * r;
  return Math.sqrt(1 + a * a) / Math.sqrt((1 - r * r) ** 2 + a * a);
}

/* inertia reaction of a moving axis + rocking on the pads */
export function reaction(p) {
  const F = p.m * p.accG * G;                   // N
  const M = F * p.h;                            // N·m rocking moment
  const dFside = M / p.span;                    // N, one pad row up, the other down
  const dFpad = dFside / p.perSide;             // N per pad
  const dz = dFpad / (p.kPad * 1e6) * 1000;     // mm deflection change of one pad
  const tilt = 2 * dz / p.span;                 // mm/m (one side down, other up)
  const unb = p.rotor * (p.G / (2 * Math.PI * p.rpm / 60) / 1000) * (2 * Math.PI * p.rpm / 60) ** 2; // N, F = m·e·ω², e·ω = G grade mm/s
  return { F, M, dFside, dFpad, dz, tilt, unb };
}

/* ---------------------------------------------------------------- 3. vibration from sources in the hall (SIMPLE model) */
/* Bornitz type: v(r) = v0 · (r0/r)^n · e^(−α (r − r0)), r0 = 1 m, n = 0.5 (surface waves); joint factor for a cut slab / isolated block.
 * Several sources: v = √(Σ v_i²) (uncorrelated RMS values add as squares). */
export function attenuate(v0, r, alpha, n = 0.5) {
  const rr = Math.max(1, r);
  return v0 * Math.pow(1 / rr, n) * Math.exp(-alpha * (rr - 1));
}
export function siteVib(machines, sources, alpha, jointF) {
  return machines.map((m) => {
    const parts = sources.map((s) => { const r = Math.hypot(s.x - m.x, s.y - m.y); return { id: s.id, r, v: attenuate(s.v0, r, alpha) * jointF }; });
    const v = Math.sqrt(parts.reduce((a, b) => a + b.v * b.v, 0));
    return { id: m.id, v, parts };
  });
}

/* ---------------------------------------------------------------- 4. levelling: bed on 6 elastic levelling bolts */
/* The bed = stiff body that can still TWIST (mode x·z) and BOW along its length (mode z² − s), like a real box bed.
 * Unknowns q = [w0, ax, az, c, b]; bed height w(x,z) = w0 + ax·x + az·z + c·x·z + b·(z² − s)  (w in mm, x z in m → slope in mm/m).
 * Bolt i: extension e_i (mm), force F_i = k·(e_i − w_i) if > 0 (else the bolt is free: no tension).
 * Energy minimum → Σ F_i·φ_j(i) = Q_j (rigid modes: weight W at CoG) and Σ F_i·φ_j(i) = K_j·q_j (elastic modes). */
export const LEV = {
  k: 1000,            // kN/mm per bolt (bolt + pad + concrete ≈ 1 kN/µm, example)
  Kc: 2800,           // twist stiffness (≈ 0.2 kN/µm at a corner, example)
  Kb: 7400,           // bow stiffness (≈ 1 kN/µm at a middle bolt ≈ 48·EI/L³ of a cast box bed, example)
  W: (HMC.mMachine + HMC.mTableLoad) * G / 1000, // kN on the bolts
  xg: 0.0, zg: 0.3,   // m, centre of gravity (column at the rear)
  pitch: 1.5,         // mm per turn: M30 × 1.5 fine-thread jack bolt (example)
  tol: 0.02,          // mm/m level tolerance (example – check the maker)
  hTol: 0.5,          // mm height tolerance for the interfaces (APC / robot / conveyor) (example)
  minShare: 0.25,     // each bolt must carry ≥ 25 % of the average load (no loose bolt)
  // reading positions: table at front end / middle / rear end of the Z stroke + column base (X only)
  pos: [{ id: "Tf", name: "table front (Z−)", x: 0, z: -1.3, zRead: true }, { id: "Tm", name: "table middle", x: 0, z: -0.75, zRead: true },
    { id: "Tr", name: "table rear (Z+)", x: 0, z: -0.2, zRead: true }, { id: "C", name: "column base", x: 0, z: 1.2, zRead: false }],
};
const S2 = PADS.reduce((a, p) => a + p.z * p.z, 0) / PADS.length; // mean z² = 1.927
const phi = (x, z) => [1, x, z, x * z, z * z - S2];
export function solveBed(e, L = LEV) {
  let act = PADS.map(() => true), q = null, F = null;
  for (let it = 0; it < 12; it++) {
    const A = [...Array(5)].map(() => [0, 0, 0, 0, 0]), b = [0, 0, 0, 0, 0];
    PADS.forEach((p, i) => { if (!act[i]) return; const f = phi(p.x, p.z); for (let r = 0; r < 5; r++) { b[r] += L.k * e[i] * f[r]; for (let c = 0; c < 5; c++) A[r][c] += L.k * f[r] * f[c]; } });
    A[3][3] += L.Kc; A[4][4] += L.Kb;
    b[0] -= L.W; b[1] -= L.W * L.xg; b[2] -= L.W * L.zg;
    q = gauss(A, b);
    if (!q) return null;
    F = PADS.map((p, i) => { const w = dot(phi(p.x, p.z), q); return L.k * (e[i] - w); });
    let changed = false;
    F.forEach((f, i) => { if (act[i] && f < -1e-9) { act[i] = false; changed = true; } else if (!act[i] && f > 1e-9) { act[i] = true; changed = true; } });
    if (!changed) break;
  }
  F = F.map((f, i) => (act[i] ? Math.max(0, f) : 0));
  const w = (x, z) => dot(phi(x, z), q);
  const sx = (x, z) => q[1] + q[3] * z;               // ∂w/∂x  mm/m
  const sz = (x, z) => q[2] + q[3] * x + 2 * q[4] * z; // ∂w/∂z  mm/m
  const read = L.pos.map((p) => ({ ...p, X: sx(p.x, p.z), Z: p.zRead ? sz(p.x, p.z) : null }));
  const xs = read.map((r) => r.X);
  const twist = Math.max(...xs) - Math.min(...xs);
  const zs = read.filter((r) => r.zRead).map((r) => r.Z);
  const bow = Math.max(...zs) - Math.min(...zs);
  const hgt = w(0, -0.75);                            // mm, height at the table centre vs target
  const avg = L.W / PADS.length;
  const share = F.map((f) => f / avg);
  const okRead = read.every((r) => Math.abs(r.X) <= L.tol && (r.Z === null || Math.abs(r.Z) <= L.tol));
  const okTwist = twist <= L.tol, okH = Math.abs(hgt) <= L.hTol, okLoad = share.every((s) => s >= L.minShare);
  return { q, F, act, read, twist, bow, hgt, share, okRead, okTwist, okH, okLoad, pass: okRead && okTwist && okH && okLoad, w };
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function gauss(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
/* "installed" state: bolt extensions that give a level bed at target height, with equal-as-possible loads (reference) */
export function levelState(L = LEV) {
  // for a level bed (q = 0): F_i = k·e_i must satisfy ΣF = W, ΣF·x = W·xg, ΣF·z = W·zg, ΣF·xz = 0, ΣF·(z²−s) = 0
  // 6 unknowns, 5 equations → minimum-norm deviation from the equal share (least squares via normal equations)
  const avg = L.W / PADS.length, C = PADS.map((p) => phi(p.x, p.z));
  const t = [L.W, L.W * L.xg, L.W * L.zg, 0, 0].map((v, j) => v - C.reduce((a, c) => a + c[j] * avg, 0));
  const N = [...Array(5)].map((_, r) => [...Array(5)].map((__, c) => C.reduce((a, ci) => a + ci[r] * ci[c], 0)));
  const lam = gauss(N, t);
  return PADS.map((p, i) => (avg + dot(C[i], lam)) / L.k); // e_i (mm) = F_i/k for w = 0
}
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
/* random "as placed" state: each bolt ±0.35 mm, height offset, one auxiliary bolt not touching */
export function randomState(seed, L = LEV) {
  const R = rng(seed), e0 = levelState(L);
  const off = (R() - 0.5) * 1.6;
  return e0.map((v, i) => {
    let d = (R() - 0.5) * 0.7 + off;
    if (!PADS[i].main && R() < 0.6) d -= 0.25 + R() * 0.3;
    return Math.round((v + d) / (L.pitch / 32)) * (L.pitch / 32); // bolts sit on 1/32-turn steps
  });
}
/* next-step hint: follow the real sequence: loose bolt → height → Z slope → X slope → twist → auxiliary bolts.
 * Each candidate move = turning a group of bolts; the amount comes from the model's sensitivity (finite difference),
 * rounded to 1/32 turn. Returns {txt, move:{bolts:[...], turns}} or {txt, done:true}. */
export const GROUPS = {
  all: { b: [0, 1, 2, 3, 4, 5], name: "all six bolts" }, front: { b: [0, 1], name: "front bolts 1 + 2" }, rear: { b: [4, 5], name: "rear bolts 5 + 6" },
  left: { b: [0, 2, 4], name: "left bolts 1 + 3 + 5" }, right: { b: [1, 3, 5], name: "right bolts 2 + 4 + 6" },
  d16: { b: [0, 5], name: "diagonal bolts 1 + 6" }, d25: { b: [1, 4], name: "diagonal bolts 2 + 5" },
  mid: { b: [2, 3], name: "middle (auxiliary) bolts 3 + 4" },
};
for (let i = 0; i < 6; i++) GROUPS["b" + (i + 1)] = { b: [i], name: "bolt " + (i + 1) };
export function applyMove(e, bolts, turns, L = LEV) { const n = e.slice(); bolts.forEach((i) => { n[i] += turns * L.pitch; }); return n; }
function bestTurns(e, bolts, f, L) {
  // choose turns (multiple of 1/32, |t| ≤ 2) that minimise |f(state)|
  let best = { t: 0, v: Math.abs(f(solveBed(e, L))) };
  for (let k = -64; k <= 64; k++) { if (!k) continue; const t = k / 32; const s = solveBed(applyMove(e, bolts, t, L), L); if (!s) continue; const v = Math.abs(f(s)); if (v < best.v - 1e-9) best = { t, v }; }
  return best;
}
/* merit = how far the state is from "levelled" (0 = all values within 60 % of their tolerance). Every hint step must lower it,
 * so the hint sequence can never run in a circle. */
export function merit(s, L = LEV) {
  if (!s) return Infinity;
  const p = (v, lim) => Math.max(0, Math.abs(v) / lim - 0.6) ** 2;
  let m = 0;
  s.read.forEach((r) => { m += p(r.X, L.tol); if (r.Z !== null) m += p(r.Z, L.tol); });
  m += p(s.twist, L.tol) + p(s.hgt, L.hTol);
  s.share.forEach((sh) => { m += Math.max(0, (L.minShare + 0.1 - sh) / L.minShare) ** 2; });
  return m;
}
export function hint(e, L = LEV) {
  const s = solveBed(e, L), avg = L.W / PADS.length, m0 = merit(s, L);
  if (s.pass) return { txt: "All readings within tolerance, no twist, all bolts loaded. Now tighten the lock nuts / anchors in a cross pattern, read again, and re-check after 1 week and 1 month.", done: true, move: null };
  const tf = (t) => { const n = Math.round(t * 32); const sg = n > 0 ? "+" : "−"; const a = Math.abs(n); const g = gcd(a, 32); return `${sg}${a / g}/${32 / g} turn`; };
  const txt = (why, g, t) => `${why} → turn ${g.name} by ${tf(t)} (${t > 0 ? "clockwise = up" : "anticlockwise = down"}, ${(t * L.pitch).toFixed(3)} mm).`;
  const better = (gk, t) => merit(solveBed(applyMove(e, GROUPS[gk].b, t, L), L), L) < m0 - 1e-9;
  const mk = (gk, f, why) => { const g = GROUPS[gk]; const b = bestTurns(e, g.b, f, L); if (!b.t || !better(gk, b.t)) return null; return { txt: txt(why, g, b.t), move: { bolts: g.b, turns: b.t } }; };
  const tol = L.tol * 0.6, rd = s.read, zMid = rd[1].Z, xMid = rd[1].X;
  const steps = [];
  // 1. loose main bolt
  const looseMain = s.F.map((f, i) => ({ i, f })).find((o) => PADS[o.i].main && o.f < L.minShare * avg);
  if (looseMain) steps.push(() => mk("b" + (looseMain.i + 1), (st) => Math.max(0, (L.minShare + 0.15) * avg - st.F[looseMain.i]), `Step 1 – main bolt ${looseMain.i + 1} carries only ${s.F[looseMain.i].toFixed(1)} kN (loose)`));
  // 2. height
  if (Math.abs(s.hgt) > L.hTol * 0.6) steps.push(() => mk("all", (st) => st.hgt, `Step 2 – height at the table is ${fmtS(s.hgt, 2)} mm from the target (interface height for APC / robot)`));
  // 3. Z slope (front – rear)
  if (Math.abs(zMid) > tol) steps.push(() => mk(zMid > 0 ? "front" : "rear", (st) => st.read[1].Z, `Step 3 – Z level at the table middle reads ${fmtS(zMid)} mm/m (${zMid > 0 ? "rear is high – raise the front" : "front is high – raise the rear"})`));
  // 4. X slope (left – right)
  if (Math.abs(xMid) > tol) steps.push(() => mk(xMid > 0 ? "left" : "right", (st) => st.read[1].X, `Step 4 – X level at the table middle reads ${fmtS(xMid)} mm/m (${xMid > 0 ? "right side is high – raise the left" : "left side is high – raise the right"})`));
  // 5. twist – one diagonal pair
  if (s.twist > tol) steps.push(() => { const f = (st) => st.read[0].X - st.read[3].X, why = `Step 5 – twist: the X reading changes by ${s.twist.toFixed(3)} mm/m from the table to the column (bed is warped)`;
    const c = [mk("d16", f, why), mk("d25", f, why)].filter(Boolean); if (!c.length) return null;
    return c.sort((a, b) => Math.abs(f(solveBed(applyMove(e, a.move.bolts, a.move.turns, L), L))) - Math.abs(f(solveBed(applyMove(e, b.move.bolts, b.move.turns, L), L))))[0]; });
  // 6. auxiliary bolts: carry load but do not bend the bed
  [2, 3].forEach((i) => { if (s.F[i] < L.minShare * avg) steps.push(() => mk("b" + (i + 1), (st) => Math.max(0, (L.minShare + 0.15) * avg - st.F[i]), `Step 6 – auxiliary bolt ${i + 1} carries only ${s.F[i].toFixed(1)} kN – bring it into contact without lifting the bed`)); });
  for (const st of steps) { const r = st(); if (r) return r; }
  // fine correction: the single group move (≤ ½ turn) that lowers the merit most
  let best = null;
  for (const gk of Object.keys(GROUPS)) for (let k = -16; k <= 16; k++) { if (!k) continue; const t = k / 32, v = merit(solveBed(applyMove(e, GROUPS[gk].b, t, L), L), L); if (v < m0 - 1e-9 && (!best || v < best.v)) best = { gk, t, v }; }
  if (best) { const what = !s.okLoad ? "a bolt is still too lightly loaded" : !s.okTwist ? `twist ${s.twist.toFixed(3)} mm/m` : !s.okRead ? "a reading is still outside 0.02 mm/m" : `height ${fmtS(s.hgt, 2)} mm`;
    return { txt: txt(`Fine correction – ${what}`, GROUPS[best.gk], best.t), move: { bolts: GROUPS[best.gk].b, turns: best.t } }; }
  return { txt: "No single move improves the result – reset or try 1/32 turns on single corner bolts and watch the readings.", move: null };
}
const fmtS = (v, d = 3) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/* ---------------------------------------------------------------- 5. ISO 230-2 positioning evaluation */
/* x[j][i]: deviation (µm) at target j, run i; up and down separate. Returns per target means, s, B, and the axis values A, B, E, M, R. */
export function iso2302(targets, up, dn) {
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  const rows = targets.map((P, j) => {
    const mu = mean(up[j]), md = mean(dn[j]), su = sd(up[j]), sdn = sd(dn[j]);
    const Bi = mu - md, xi = (mu + md) / 2;
    const Ru = 4 * su, Rd = 4 * sdn, Ri = Math.max(2 * su + 2 * sdn + Math.abs(Bi), Ru, Rd);
    return { P, mu, md, su, sd: sdn, Bi, xi, Ru, Rd, Ri };
  });
  const B = Math.max(...rows.map((r) => Math.abs(r.Bi)));
  const R = Math.max(...rows.map((r) => r.Ri));
  const E = Math.max(...rows.flatMap((r) => [r.mu, r.md])) - Math.min(...rows.flatMap((r) => [r.mu, r.md]));
  const M = Math.max(...rows.map((r) => r.xi)) - Math.min(...rows.map((r) => r.xi));
  const A = Math.max(...rows.flatMap((r) => [r.mu + 2 * r.su, r.md + 2 * r.sd])) - Math.min(...rows.flatMap((r) => [r.mu - 2 * r.su, r.md - 2 * r.sd]));
  return { rows, A, B, E, M, R };
}
/* example data set: X axis 0…800 mm, 9 targets, 5 runs up + 5 down; linear (pitch / thermal) error, reversal, noise */
export function exampleIso2302(comp = false, seed = 7) {
  const R = rng(seed), targets = [0, 100, 200, 300, 400, 500, 600, 700, 800].map((v, i) => v + [0, 3.2, -2.1, 5.4, 1.1, -4.3, 2.7, -1.6, 0][i]);
  const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += R(); return s - 3; }; // ≈ N(0, 0.71)
  const sys = (P) => (comp ? 0.4 : 10.5) * P / 800 + (comp ? 0.6 : 1.8) * Math.sin(P / 800 * Math.PI * 2) - (comp ? 0 : 1.0);
  const up = targets.map((P) => [...Array(5)].map(() => sys(P) + 0.9 + 0.55 * gauss()));
  const dn = targets.map((P) => [...Array(5)].map(() => sys(P) - 0.9 + 0.55 * gauss()));
  return { targets, up, dn };
}
