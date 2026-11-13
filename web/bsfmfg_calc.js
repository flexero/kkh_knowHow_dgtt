/* Ball screw + guide factory – item 2: process physics formulas (pure functions) + hand-check values CHECK2.
 * Guide: docs/41_ballscrew_guide_manufacturing.md §10 – §17. Hand values verified with Python stdlib (scratch calc.py).
 * ALL VALUES ARE EXAMPLES – check the machine maker's data.
 */
import { BS, BN } from "./bsfprod_data.js";
const PI = Math.PI;

/** induction penetration depth δ = 503·√(ρ/(μr·f)) → mm  (ρ Ω·m, f Hz) */
export const inductionDepth = (rho, mur, f) => 503 * Math.sqrt(rho / (mur * f)) * 1000;
/** frequency for a wanted hot depth δ (mm): f = ρ·(503/δ)² */
export const freqForDepth = (rho, deltaMm) => rho * (503 / (deltaMm / 1000)) ** 2;
/** induction scanning power: heated case ring (Do, case mm) at scan speed v (mm/s) → heat in the case + generator power with losses */
export function inductionPower({ Do = 31.5, cs = 2.5, v = 4, T = 900, T0 = 20, c = 0.65, rho = 7.85e-3, eta = 0.5 * 0.65, L = BS.Lthread } = {}) {
  const A = PI / 4 * (Do * Do - (Do - 2 * cs) ** 2), mdot = A * v * rho, Pnet = mdot * c * (T - T0);
  return { A, mdot, Pnet: Pnet / 1000, Pgen: Pnet / eta / 1000, tScan: L / v };
}
/** thread grinding (or whirling) time = Σ passes × (L + overrun) / (Ph × n_w)  (min) */
export const threadTime = (passes, L, over, Ph) => passes.reduce((t, [n, nw]) => t + n * (L + over) / (Ph * nw), 0);
/** wheel / spindle speed n = vs·60 000 / (π·d)  (vs m/s, d mm → min⁻¹) */
export const wheelRpm = (vs, d) => vs * 60000 / (PI * d);
/** turning: n = 1 000·vc/(π·d), t = L/(f·n), cutting power P = vc·ap·f·kc / 60 000 / η */
export function turning({ d, L, vc, f, ap = 1, kc = 2600, eta = 0.85 }) {
  const n = 1000 * vc / (PI * d); return { n, t: L / (f * n), Q: vc * ap * f, P: vc * ap * f * kc / 60000 / eta };
}
/** grinding power + surface temperature (Jaeger moving band source, high Péclet number)
 *  vw = π·dw·nw/60, Q'w = a·vw, P' = ec·Q'w, de = ds·dw/(ds+dw), lc = √(a·de), q = ε·P'/lc, θ = 1.13·q·√(α·lc/vw)/k */
export function grindBurn({ a = 0.005, ec = 40, eps = 0.75, nw = 150, dw = 32, ds = 500, b = 20, k = 40, alpha = 1.1e-5, limit = 450 } = {}) {
  const vw = PI * dw * nw / 60, Qp = a * vw, Pp = ec * Qp, de = ds * dw / (ds + dw), lc = Math.sqrt(a * de), q = eps * Pp / lc;
  const th = 1.13 * (q * 1e6) * Math.sqrt(alpha * (lc / 1000) / (vw / 1000)) / k;
  return { vw, Qp, Pp, P: Pp * b, de, lc, q, th, burn: th > limit, limit };
}
/** thermal growth ΔL = α·L·ΔT (µm) */
export const thermalGrowth = (L, dT, alpha = BS.alphaT) => alpha * L * dT * 1000;
/** straightening by 3-point bending: W = π·d³/32, I = π·d⁴/64, M_y = σ_y·W, F_y = 4·M_y/L, elastic deflection at yield δ_y = F·L³/(48·E·I) */
export function straighten({ d = 36, sy = 700, span = 400, E = 206000, over = 1.5 } = {}) {
  const W = PI * d ** 3 / 32, I = PI * d ** 4 / 64, My = sy * W, F = 4 * My / span;
  return { W, I, My: My / 1e6, F: F / 1000, Fover: over * F / 1000, dy: F * span ** 3 / (48 * E * I) };
}
/** Hollomon–Jaffe tempering parameter P = T·(20 + log10 t)  (T K, t h) */
export const hollomon = (TC, h) => (TC + 273.15) * (20 + Math.log10(h));
/** carburising case depth d = K·√t  (K ≈ 0.63 mm/√h at 920 °C, example) */
export const carbDepth = (h, K = 0.63) => K * Math.sqrt(h);
export const carbTime = (d, K = 0.63) => (d / K) ** 2;
/** nut preload drag torque (catalogue formula) Tp = 0.05/√tanλ · Fpr·Ph/(2π)   (N·m) */
export function preloadTorque(Fpr = BN.Fpr, Ph = BS.Ph, dpw = BS.dpw) {
  const lam = Math.atan(Ph / (PI * dpw)); return { lamDeg: lam * 180 / PI, Tp: 0.05 / Math.sqrt(Math.tan(lam)) * Fpr * Ph / 1000 / (2 * PI) };
}
/** saw time = cross-section (cm²) / cutting rate (cm²/min) */
export const sawTime = (d, rate) => PI / 4 * (d / 10) ** 2 / rate;
/** cost per part on one machine = hourly rate · cycle / 60 / OEE */
export const costPerPart = (rate, cyc, oee) => rate * cyc / 60 / oee;

/* hand values (Python stdlib) – checked by &bf2test */
export const CHECK2 = {
  deltaHot30k: 3.181251, deltaHot10k: 5.510089, deltaCold30k: 0.129874, fFor3: 33734.53,
  Acase: 227.7655, Pnet: 4.09085, Pgen: 12.58723, tScan: 212.5,
  tGrindG: 33.75, tGrindWfin: 18.0, tWhirl: 15.0, tIntGrind: 3.066667,
  nTgr: 1909.859, nInt: 22918.31, nCgr: 1718.873, nRough: 1768.388, tRough: 1.639911, tFin: 2.95184, Prough: 5.505882,
  thCor: 357.7926, thCor2: 601.7331, thCbn: 107.3378, lcCor: 0.387783, Pcor: 1005.31,
  dL1K: 10.03, dL2K: 20.06, strF: 32.06309, strDy: 2.51708, strHardF: 33.71929,
  HJ170: 8996.401, carbT12: 3.628118, carbD5: 1.408723, Tp: 0.292097, lamDeg: 5.509565, saw36: 0.339292, saw85: 1.891501, costTgr: 133.3333,
};
