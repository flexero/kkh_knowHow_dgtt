/* Ball screw + guide factory – item 1 calculations (pure functions, no DOM). Guide 40 §7 – §17.
 * Every formula is the simple catalogue form so it can be checked with a pocket calculator.
 * Verified with Python stdlib (scratch bf1/calc.py) → CHECK1 below; the page self-check (&bf1test) compares.
 * ALL VALUES ARE EXAMPLES – check the maker's catalogue.
 */
import { BS, BN, LB, SUPPORT, ACC_BS, MOUNT_LG, PRELOAD_BS } from "./bsfprod_data.js";

const PI = Math.PI, G = 9.81;
export const rad = (d) => d * PI / 180, deg = (r) => r * 180 / PI;

/* ---------------- ball screw */
export const leadAngle = (Ph, dpw) => Math.atan(Ph / (PI * dpw));                         // rad
export function efficiency(Ph = BS.Ph, dpw = BS.dpw, mu = 0.003) {
  const l = leadAngle(Ph, dpw), r = Math.atan(mu);
  return { lam: deg(l), eta: Math.tan(l) / Math.tan(l + r), etaB: Math.tan(l - r) / Math.tan(l) };   // theory (catalogue design values 0.9 / 0.8)
}
export const speed = (v_m_min, Ph) => v_m_min * 1000 / Ph;                                 // rpm from m/min
export const feed = (n, Ph) => n * Ph / 1000;                                              // m/min
export const torqueDrive = (F, Ph, eta = 0.9) => F * Ph / 1000 / (2 * PI * eta);          // N·m
export const torqueBack = (F, Ph, etaB = 0.8) => F * Ph / 1000 * etaB / (2 * PI);         // N·m that the load produces on the screw
export const preloadTorque = (Fpr, Ph, dpw) => 0.05 * Math.pow(Math.tan(leadAngle(Ph, dpw)), -0.5) * Fpr * Ph / 1000 / (2 * PI);  // N·m (THK style)
export const effPreload = (F, Fpr) => (F > PRELOAD_BS.lossFactor * Fpr ? F : Fpr * Math.pow(1 + F / (PRELOAD_BS.lossFactor * Fpr), 1.5));
/* mean load from a load cycle: phases [{F, n, t}] (t = time fraction, n = rpm) – Fm = (Σ F³·n·t / Σ n·t)^(1/3) */
export function meanLoad(phases, Fpr = 0) {
  const nm = phases.reduce((s, p) => s + p.n * p.t, 0);
  const Fm = Math.cbrt(phases.reduce((s, p) => s + Math.pow(Math.abs(p.F), 3) * p.n * p.t, 0) / nm);
  const FmP = Fpr > 0 ? Math.cbrt(phases.filter((p) => p.n > 0).reduce((s, p) => s + Math.pow(effPreload(Math.abs(p.F), Fpr), 3) * p.n * p.t, 0) / nm) : Fm;
  return { nm, Fm, FmP };
}
export function lifeBS(Ca, Fm, fw, nm, Ph) {
  const L = Math.pow(Ca / (fw * Fm), 3) * 1e6;
  return { L, Lh: L / (60 * nm), Lkm: L * Ph / 1e6 };
}
export function buckling(dr, L, mount) {
  const M = SUPPORT.mounts[mount], I = PI * Math.pow(dr, 4) / 64;
  return { Fk: M.eta2 * Math.pow(dr, 4) / (L * L) * 1e4, Feuler: M.euler * PI * PI * BS.E * I / (L * L), I };   // Fk = permissible (0.5 · Euler)
}
export function critSpeed(dr, L, mount) {
  const M = SUPPORT.mounts[mount];
  const exact = 60 * M.lam * M.lam / (2 * PI * Math.pow(L / 1000, 2)) * (dr / 1000 / 4) * Math.sqrt(BS.E * 1e6 / BS.rho);
  return { nc: M.nc * dr / (L * L) * 1e7, exact, exact08: 0.8 * exact };
}
export const dnSpeed = (DN, dpw) => DN / dpw;
export function rigidity({ dr = BS.dr, La = 700, Kn = BN.Kn, Kb = SUPPORT.fixed.Kb, F = 0, Ff = 0, mount = "fs", L = 900 } = {}) {
  const A = PI * dr * dr / 4;
  const Ks = mount === "ff" ? A * BS.E * L / (4 * La * (L - La)) / 1000 : A * BS.E / La / 1000;   // N/µm
  const K = 1 / (1 / Ks + 1 / Kn + 1 / Kb);
  return { A, Ks, Kn, Kb, K, defl: F / K, lost: 2 * Ff / K };
}
export const nutRigidity = (KnCat, Fpr, Ca) => KnCat * Math.cbrt(Fpr / (0.1 * Ca));
export function thermal(dT, L, dr = BS.dr) {
  const A = PI * dr * dr / 4;
  return { dL: BS.alphaT * dT * L * 1000, Fpre: BS.alphaT * dT * BS.E * A };   // µm, N
}
export function accuracyBS(grade, lu) {
  let i = ACC_BS.bins.findIndex((b) => lu <= b); if (i < 0) i = ACC_BS.bins.length - 1;
  const ep = ACC_BS.ep[grade] ? ACC_BS.ep[grade][i] : null, vup = ACC_BS.vup[grade] ? ACC_BS.vup[grade][i] : null;
  return { ep, vup, v300: ACC_BS.v300[grade] ?? null, v2pi: ACC_BS.v2pi[grade] ?? null, bin: [i ? ACC_BS.bins[i - 1] : 0, ACC_BS.bins[i]] };
}
export function inertia({ m, Ph = BS.Ph, d0 = BS.d0, Ltot = BS.Ltot, Jc = SUPPORT.coupling.J }) {
  const Js = PI * BS.rho * (Ltot / 1000) * Math.pow(d0 / 1000, 4) / 32, Jt = m * Math.pow(Ph / 1000 / (2 * PI), 2);
  return { Js, Jt, Jc, Jl: Js + Jt + Jc };
}

/* ---------------- linear guide */
export const eqLoad = ({ Fr = 0, Fl = 0, MR = 0, MP = 0, MY = 0, C0 = LB.C0, M0R = LB.M0R, M0P = LB.M0P, M0Y = LB.M0Y }) =>
  Math.abs(Fr) + Math.abs(Fl) + C0 * (Math.abs(MR) / M0R + Math.abs(MP) / M0P + Math.abs(MY) / M0Y);
export function lifeLG({ C = LB.C, P, fh = 1, ft = 1, fc = 1, fw = 1.5, vm = 8, ball = true }) {
  const p = ball ? 3 : 10 / 3, base = ball ? 50 : 100;
  const L = Math.pow(fh * ft * fc * C / (fw * P), p) * base;   // km
  return { L, Lh: L * 1000 / vm / 60 };
}
export const meanLoadDist = (list) => { const D = list.reduce((s, x) => s + x.d, 0); return { D, Pm: Math.cbrt(list.reduce((s, x) => s + Math.pow(x.P, 3) * x.d, 0) / D) }; };
export function mountTol(a, b, z = "Z1") { return { P1: MOUNT_LG.P1[z], S1: a * MOUNT_LG.K1[z], S2: b * MOUNT_LG.K2 }; }   // µm, mm, mm

/* ---------------- selection example: HMC / machining-centre X axis (guide 40 §17) */
export const SEL_DEF = { m: 600, vr: 30, a: 3.0, Fc: 4000, FL: 3000, h: 350, hg: 200, mu: 0.005, Fseal: 40, aR: 500, bB: 400, Lb: 900, La: 700, Ph: 10, mount: "fs",
  fw: 1.2, fwg: 1.5, Jm: 2.7e-3, Tb: 0.2, eta: 0.9, lifeReq: 20000, duty: { rapid: 0.20, acc: 0.05, dec: 0.05, cut: 0.50, idle: 0.20 }, vcut: 1.0 };
export function selection(inp = {}) {
  const S = Object.assign({}, SEL_DEF, inp), R = { S };
  const Ph = S.Ph;
  R.nR = speed(S.vr, Ph); R.DN = BS.dpw * R.nR; R.DNok = R.DN <= BN.DN;
  R.Ff = S.mu * S.m * G + S.Fseal; R.Facc = S.m * S.a + R.Ff; R.Fdec = S.m * S.a - R.Ff; R.Fcut = S.Fc + R.Ff;
  const nc = speed(S.vcut, Ph);
  R.phases = [{ k: "rapid", F: R.Ff, n: R.nR, t: S.duty.rapid }, { k: "accel", F: R.Facc, n: R.nR / 2, t: S.duty.acc }, { k: "decel", F: R.Fdec, n: R.nR / 2, t: S.duty.dec },
    { k: "cut", F: R.Fcut, n: nc, t: S.duty.cut }, { k: "idle", F: 0, n: 0, t: S.duty.idle }];
  Object.assign(R, meanLoad(R.phases, BN.Fpr));
  const L1 = lifeBS(BN.Ca, R.Fm, S.fw, R.nm, Ph), L2 = lifeBS(BN.Ca, R.FmP, S.fw, R.nm, Ph);
  R.L10 = L1.L; R.L10h = L1.Lh; R.L10km = L1.Lkm; R.L10p = L2.L; R.L10ph = L2.Lh;
  R.fsBS = BN.C0a / Math.max(R.Fcut, R.Facc);
  const bk = buckling(BS.dr, S.Lb, S.mount), cs = critSpeed(BS.dr, S.Lb, S.mount);
  R.Fk = bk.Fk; R.Feuler = bk.Feuler; R.nc = cs.nc; R.ncExact = cs.exact; R.nDN = dnSpeed(BN.DN, BS.dpw); R.nAllow = Math.min(R.nc, R.nDN);
  R.Tp = preloadTorque(BN.Fpr, Ph, BS.dpw); R.Tcut = torqueDrive(R.Fcut, Ph, S.eta); R.Tf = torqueDrive(R.Ff, Ph, S.eta);
  Object.assign(R, inertia({ m: S.m, Ph }));
  R.alpha = 2 * PI * S.a / (Ph / 1000); R.tAcc = S.vr / 60 / S.a; R.Jratio = R.Jl / S.Jm;
  R.Tpeak = (R.Jl + S.Jm) * R.alpha + R.Tf + R.Tp + S.Tb; R.TcutTot = R.Tcut + R.Tp + S.Tb;
  const rg = rigidity({ La: S.La, Kn: nutRigidity(BN.KnCat, BN.Fpr, BN.Ca), F: R.Fcut, Ff: R.Ff, mount: "fs", L: S.Lb }); R.Ks = rg.Ks; R.Kn = rg.Kn; R.K = rg.K; R.defl = rg.defl; R.lost = rg.lost;
  // guide: 2 rails (spacing aR) × 2 blocks (spacing bB), weight centred, lateral cutting force FL and axial Fc at height h, CoG at hg
  R.Pw = S.m * G / 4; R.dPlat = S.FL * S.h / (2 * S.aR); R.dPax = S.Fc * S.h / (2 * S.bB); R.Flat = S.FL / 4; R.dPacc = S.m * S.a * S.hg / (2 * S.bB);
  R.Pcut = R.Pw + R.dPlat + R.dPax + R.Flat; R.Pacc = R.Pw + R.dPacc;
  const dist = [{ P: R.Pw, d: S.vr * S.duty.rapid }, { P: R.Pacc, d: S.vr / 2 * S.duty.acc }, { P: R.Pacc, d: S.vr / 2 * S.duty.dec }, { P: R.Pcut, d: S.vcut * S.duty.cut }];
  const md = meanLoadDist(dist); R.vm = md.D; R.Pm = md.Pm;
  const lg = lifeLG({ P: R.Pm, fw: S.fwg, vm: R.vm }); R.Lg = lg.L; R.Lgh = lg.Lh; R.fsLG = LB.C0 / R.Pcut;
  // compare leads 10 / 16 / 20 for the same axis
  R.leads = [10, 16, 20].map((p) => { const n = speed(S.vr, p), I = inertia({ m: S.m, Ph: p }), al = 2 * PI * S.a / (p / 1000);
    return { Ph: p, n, DN: BS.dpw * n, Tcut: torqueDrive(R.Fcut, p, S.eta), Tpeak: (I.Jl + S.Jm) * al + torqueDrive(R.Ff, p, S.eta) + preloadTorque(BN.Fpr, p, BS.dpw) + S.Tb, Jt: I.Jt, res: p / 1048576 * 1000 }; });  // res: µm per count with a 20-bit encoder
  return R;
}

/* ---------------- check values (Python stdlib, scratch bf1/calc.py – same inputs) */
export const CHECK1 = {
  lam: 5.50957, nR: 3000, DN: 99000, Ff: 69.43, Facc: 1869.43, Fdec: 1730.57, Fcut: 4069.43, nm: 800, Fm: 1744.67, FmP: 1955.74,
  L10: 5.97953e9, L10h: 124573, L10ph: 88437.4, L10km: 59795.3, Fk: 59969.5, Feuler: 119701, nc: 4921.48, ncExact: 6146.83,
  Tp: 0.292097, Tcut: 7.19633, Tf: 0.122779, Js: 8.08108e-4, Jt: 1.51982e-3, Jl: 2.42793e-3, alpha: 1884.96, Jratio: 0.899232, Tpeak: 10.2808, TcutTot: 7.68843,
  Ks: 161.089, Kn: 669.433, K: 110.682, defl: 36.7668, lost: 1.25458,
  Pw: 1471.5, dPlat: 1050, dPax: 1750, Pcut: 5021.5, Pacc: 1921.5, vm: 8, Pm: 2265.89, Lg: 54132.4, Lgh: 112776, fsLG: 10.5148, fsBS: 18.6758,
};
export const CHECK1X = { dL3: 30.09, Fpre3: 3991.79, Peq: 6958.51, C100: 27700.1, S1Z1: 0.085, S2: 0.0168, etaTh: 0.969556, Tback1k: 1.27324, budgetSum: 103.111, budgetRss: 59.0235 };
