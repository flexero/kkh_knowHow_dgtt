/* Doctoral research tab – calculation core (pure functions, no DOM). JavaScript port of the thesis code:
 *   thesis/code/bayes.py (conjugate models, capacity), flowline.py (departure-time recursion DES),
 *   rampup_experiment.py + discrepancy.py (virtual ramp-up, predictors), chapter 5 sizing formulas.
 * Same formulas and defaults as the thesis; seeded RNG so results are reproducible in the browser. */

/* ------------------------------------------------------------------ random numbers */
export function rng(seed = 1) {
  let s = seed >>> 0;
  const r = {
    random() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
    gauss(m = 0, sd = 1) { let u = 0; while (u === 0) u = r.random(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r.random()); },
    expo(mean) { let u = 0; while (u === 0) u = r.random(); return -Math.log(u) * mean; },
    lognorm(mu, sd) { return Math.exp(r.gauss(mu, sd)); },
    gamma(a, scale = 1) {            // Marsaglia–Tsang; a < 1 via boost
      if (a < 1) { const g = r.gamma(a + 1, 1); let u = 0; while (u === 0) u = r.random(); return scale * g * Math.pow(u, 1 / a); }
      const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) { let x, v; do { x = r.gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = r.random();
        if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return scale * d * v; }
    },
    beta(a, b) { const x = r.gamma(a), y = r.gamma(b); return x / (x + y); },
    uniform(a, b) { return a + (b - a) * r.random(); },
  };
  return r;
}
const quant = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))]; };
export const interval = (arr, lvl = 0.9) => [quant(arr, (1 - lvl) / 2), quant(arr, (1 + lvl) / 2)];
export const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/* ------------------------------------------------------------------ conjugate models (thesis Table 4.4) */
export class FailureRate {                  // Gamma–Poisson, Eq. 4.5–4.6
  constructor(mtbf, equivHours) { this.b = equivHours; this.a = 1 + equivHours / mtbf; }
  update(n, T, rho = 1) { this.a = rho * this.a + n; this.b = rho * this.b + T; return this; }
  mtbfMean() { return this.a > 1 ? this.b / (this.a - 1) : this.b / this.a; }
  sampleMtbf(R) { return 1 / R.gamma(this.a, 1 / this.b); }
}
export class RepairTime {                   // Gamma–exponential, Eq. 4.7
  constructor(mttr, equivRepairs) { this.a = 1 + equivRepairs; this.b = equivRepairs * mttr; }
  update(reps, rho = 1) { this.a = rho * this.a + reps.length; this.b = rho * this.b + reps.reduce((x, y) => x + y, 0); return this; }
  mttrMean() { return this.a > 1 ? this.b / (this.a - 1) : this.b / this.a; }
  sampleMttr(R) { return 1 / R.gamma(this.a, 1 / this.b); }
}
export class CycleTime {                    // Normal-Inverse-Gamma on ln t, Eq. 4.8–4.9
  constructor(tMode, spread, equivCycles) {
    const s0 = Math.log(1 + spread) / 1.645;
    this.m = Math.log(tMode) + s0 * s0; this.k = equivCycles; this.a = Math.max(2, equivCycles / 2); this.b = s0 * s0 * (this.a - 1);
  }
  update(times, rho = 1) {
    const y = times.map(Math.log), n = y.length; if (!n) return this;
    const k0 = rho * this.k, m0 = this.m, a0 = rho * this.a, b0 = rho * this.b;
    const yb = mean(y), S = y.reduce((s, v) => s + (v - yb) ** 2, 0);
    this.k = k0 + n; this.m = (k0 * m0 + n * yb) / this.k; this.a = a0 + n / 2; this.b = b0 + S / 2 + k0 * n * (yb - m0) ** 2 / (2 * this.k);
    return this;
  }
  s2Mean() { return this.a > 1 ? this.b / (this.a - 1) : this.b / this.a; }
  meanTime() { return Math.exp(this.m + this.s2Mean() / 2); }
  sample(R) { const s2 = 1 / R.gamma(this.a, 1 / this.b), m = R.gauss(this.m, Math.sqrt(s2 / this.k)); return { speed: Math.exp(m + s2 / 2), sigma: Math.sqrt(s2) }; }
}
export class ScrapRate {                    // Beta–binomial, Eq. 4.10
  constructor(q0, equivParts) { this.a = q0 * equivParts; this.b = (1 - q0) * equivParts; }
  update(x, n, rho = 1) { this.a = rho * this.a + x; this.b = rho * this.b + n - x; return this; }
  mean() { return this.a / (this.a + this.b); }
  sample(R) { return R.beta(this.a, this.b); }
}

/* ------------------------------------------------------------------ static capacity (Eq. 4.1–4.2) */
export const availability = (mtbf, mttr) => mtbf / (mtbf + mttr);
export function capacity(st, mix, hours) {
  const tm = Object.keys(mix).reduce((s, v) => s + mix[v] * st.t[v], 0);
  const A = availability(st.mtbf, st.mttr / 60);
  return { tm, A, C: st.c * A * 3600 * hours / (tm + st.h) * (1 - st.q) };
}

/* design estimates of the compressor FMS (thesis Table 4.2) */
export const MIX = { VC10: 0.3, VC20: 0.5, VC30: 0.2 };
export const STATIONS = [
  ["LOAD", 1, 80, 90, 100, 0, 200, 5, 0], ["HMC", 3, 270, 345, 450, 15, 30, 20, 0.008], ["WASH", 1, 130, 150, 170, 0, 80, 10, 0],
  ["VMC", 1, 85, 100, 125, 0, 35, 15, 0.010], ["HONE", 1, 75, 90, 110, 0, 45, 12, 0.008], ["LATHE", 1, 140, 170, 210, 0, 30, 15, 0.010],
  ["GRIND", 1, 160, 190, 230, 0, 40, 18, 0.012], ["ASSY", 1, 170, 200, 240, 0, 120, 8, 0.003], ["ROBOT", 1, 95, 110, 130, 0, 70, 10, 0.002],
  ["TEST", 2, 300, 360, 420, 0, 90, 10, 0], ["PAINT", 1, 130, 160, 200, 0, 60, 15, 0.006], ["FINAL", 1, 180, 210, 250, 0, 120, 8, 0.002],
  ["PACK", 1, 100, 120, 140, 0, 80, 6, 0],
].map(([name, c, a, b, d, h, mtbf, mttr, q]) => ({ name, c, t: { VC10: a, VC20: b, VC30: d }, h, mtbf, mttr, q }));

/* ------------------------------------------------------------------ flow-line DES (thesis Eq. 6.2) */
/* line: [{name, c, buffer, td:{v:s}, speed, sigma, mtbf [h], mttr [h], q}] */
export function simLine(line, mix, hours, R, record = false) {
  const M = line.length, H = hours * 3600, vs = Object.keys(mix), cum = []; let acc = 0;
  vs.forEach((v) => { acc += mix[v]; cum.push(acc); });
  const mu = line.map((st) => { const o = {}; vs.forEach((v) => { o[v] = Math.log(st.td[v] * st.speed) - st.sigma ** 2 / 2; }); return o; });
  const free = line.map((st) => new Array(st.c).fill(0)), ttf = line.map((st) => Array.from({ length: st.c }, () => R.expo(st.mtbf * 3600)));
  const K = line.map((st, j) => (j < M - 1 ? line[j + 1].buffer + line[j + 1].c : 0)), starts = line.map(() => []);
  const obs = record ? line.map(() => ({ fail: 0, busy: 0, reps: [], ratios: [], parts: 0, scrap: 0 })) : null;
  let good = 0;
  for (let i = 0; ; i++) {
    const u = R.random(); let v = vs[vs.length - 1]; for (let x = 0; x < cum.length; x++) if (u <= cum[x]) { v = vs[x]; break; }
    let prev = 0, bad = false;
    for (let j = 0; j < M; j++) {
      const st = line[j], k = i % st.c, s = Math.max(prev, free[j][k]);
      if (j === 0 && s > H) return { good, obs };
      starts[j].push(s);
      const p = R.lognorm(mu[j][v], st.sigma); let work = p, left = p, rem = ttf[j][k];
      while (rem < left) { left -= rem; const rep = R.expo(st.mttr * 3600); work += rep; if (record) { obs[j].fail++; obs[j].reps.push(rep / 3600); } rem = R.expo(st.mtbf * 3600); }
      ttf[j][k] = rem - left;
      const done = s + work; let dep = done;
      if (j < M - 1 && i - K[j] >= 0) dep = Math.max(done, starts[j + 1][i - K[j]]);
      free[j][k] = dep; prev = dep;
      if (R.random() < st.q) { bad = true; if (record) obs[j].scrap++; }
      if (record) { const o = obs[j]; o.busy += p / 3600; o.parts++; if (o.ratios.length < 300) o.ratios.push(p / st.td[v]); }
    }
    if (prev <= H && !bad) good++;
  }
}
export function designLine(buffer = 4, sigma = 0.05) {
  return STATIONS.map((s) => ({ name: s.name, c: s.c, buffer, td: { VC10: s.t.VC10 + s.h, VC20: s.t.VC20 + s.h, VC30: s.t.VC30 + s.h }, speed: 1, sigma, mtbf: s.mtbf, mttr: s.mttr / 60, q: s.q }));
}

/* ------------------------------------------------------------------ virtual ramp-up (thesis section 6.4) */
const ramp = (k, tau = 2) => Math.exp(-(k - 1) / tau);
export function makeTruth(seed) {
  const R = rng(10000 + seed);
  return STATIONS.map(() => ({ fM: R.uniform(0.6, 1.1), fR: R.uniform(1.0, 1.5), fS: R.uniform(0.98, 1.12), sig: R.uniform(0.04, 0.1), fQ: R.uniform(1, 2) }));
}
export function trueLine(design, truth, k) {
  return design.map((st, j) => { const t = truth[j]; return { ...st, speed: t.fS * (1 + 0.08 * ramp(k)), sigma: t.sig, mtbf: st.mtbf * t.fM * (1 - 0.5 * ramp(k)), mttr: st.mttr * t.fR * (1 + 0.5 * ramp(k)), q: Math.min(0.5, st.q * t.fQ * (1 + 2 * ramp(k, 1.5))) }; });
}
class Belief {
  constructor(st, w) { this.f = new FailureRate(st.mtbf, 10 * st.mtbf * w); this.r = new RepairTime(st.mttr, 5 * w); this.c = new CycleTime(1, 0.1, 10 * w); this.q = new ScrapRate(Math.max(st.q, 1e-4), 250 * w); }
  update(o, rho) { this.f.update(o.fail, o.busy, rho); this.r.update(o.reps, rho); this.c.update(o.ratios, rho); this.q.update(o.scrap, o.parts, rho); }
  sample(st, R) { const cs = this.c.sample(R); return { ...st, speed: cs.speed, sigma: cs.sigma, mtbf: this.f.sampleMtbf(R), mttr: this.r.sampleMttr(R), q: this.q.sample(R) }; }
  meanLine(st) { return { ...st, speed: this.c.meanTime(), mtbf: this.f.mtbfMean(), mttr: this.r.mttrMean(), q: this.q.mean() }; }
}
const summ = (v) => ({ m: mean(v), lo: quant(v, 0.05), hi: quant(v, 0.95) });

/* One scenario, month by month. Predictors: B0 design · P07 Bayesian rho 0.7 · P07D with discrepancy. Yields per month. */
export function* rampupScenario(seed, { nTheta = 20, w = 1, hours = 330 } = {}) {
  const R = rng(seed), design = designLine(), truth = makeTruth(seed);
  const b0 = summ(Array.from({ length: 10 }, () => simLine(design, MIX, hours, R).good));
  const bel = design.map((st) => new Belief(st, w));
  const predB = () => summ(Array.from({ length: nTheta }, () => simLine(design.map((st, j) => bel[j].sample(st, R)), MIX, hours, R).good));
  let p07 = predB();
  let dm = 0, dk = 1, da = 2, db = 0.05 ** 2 * (da - 1);       // discrepancy NIG (Eq. 6.1)
  for (let k = 1; k <= 12; k++) {
    const tl = trueLine(design, truth, k), res = simLine(tl, MIX, hours, R, true), y = res.good;
    const scale = Math.sqrt(db * (dk + 1) / (da * dk)), smc = Math.log(p07.hi / p07.lo) / 3.29, t95 = da >= 10 ? 1.7 : (da >= 4 ? 1.9 : 2.3);
    const c = p07.m * Math.exp(dm), half = t95 * Math.sqrt(smc * smc + scale * scale);
    const p07d = { m: c, lo: c * Math.exp(-half), hi: c * Math.exp(half) };
    const capTrue = tl.map((st) => capOf(st, hours)), capBay = design.map((st, j) => capOf(bel[j].meanLine(st), hours)), capDes = design.map((st) => capOf(st, hours));
    const argmin = (a) => a.indexOf(Math.min(...a));
    yield { k, y, B0: b0, P07: { ...p07 }, P07D: p07d, bnTrue: design[argmin(capTrue)].name, bnBay: design[argmin(capBay)].name, bnDes: design[argmin(capDes)].name };
    if (k === 12) break;
    if (k >= 2) { const e = Math.log(y / p07.m), k0 = 0.7 * dk, m0 = dm, a0 = 0.7 * da, b0_ = 0.7 * db; dk = k0 + 1; dm = (k0 * m0 + e) / dk; da = a0 + 0.5; db = b0_ + k0 * (e - m0) ** 2 / (2 * dk); }
    res.obs.forEach((o, j) => bel[j].update(o, 0.7));
    p07 = predB();
  }
}
function capOf(st, hours) { const tm = Object.keys(MIX).reduce((s, v) => s + MIX[v] * st.td[v] * st.speed, 0); return st.c * availability(st.mtbf, st.mttr) * 3600 * hours / tm * (1 - st.q); }

/* ------------------------------------------------------------------ chapter 5 sizing formulas */
export const pollBytes = (n) => (12 + 78) + (9 + 2 * n + 78) + 84;                 // Eq. 5.1
export const rttMean = (tnet, t0, scan) => tnet + t0 + scan / 2;                    // Eq. 5.3 [ms]
export const nMaxSeq = (P, k, rtt) => (P * 1000) / (k * rtt);                       // Eq. 5.4
export function poissonTail(mu, R) { let p = Math.exp(-mu), c = p; for (let k = 1; k <= R; k++) { p *= mu / k; c += p; } return Math.max(0, 1 - c); } // Eq. 5.6
/* share of state segments never observed with state-only polling (pulse share, pulse range, mean normal state) */
export function stateOnlyMiss(P, pulseShare = 0.3, pmin = 0.05, pmax = 0.5, meanState = 5) {
  let pm = 0; const n = 2000; for (let i = 0; i < n; i++) { const d = pmin + (pmax - pmin) * (i + 0.5) / n; pm += Math.max(0, 1 - d / P); } pm /= n;
  const lam = 1 / meanState; let em = 0; const steps = 4000, dx = P / steps; for (let i = 0; i < steps; i++) { const d = (i + 0.5) * dx; em += (1 - d / P) * lam * Math.exp(-lam * d) * dx; }
  return pulseShare * pm + (1 - pulseShare) * em;
}

/* ------------------------------------------------------------------ chapter 7 staging (port of thesis/code/staging.py) */
/* opts: Set of option codes. Design values only (the calculator shows the planner's view at design time). */
export function stageLine(opts) {
  return designLine(2).map((st) => {
    const s = { ...st, td: { ...st.td }, mttr: st.mttr * 1.3, buffer: 2 };
    if (s.name === "HMC" && !opts.has("PAL")) Object.keys(s.td).forEach((v) => { s.td[v] += 105; });
    if (s.name === "GRIND" && opts.has("GR2")) s.c = 2;
    if (s.name === "ASSY" && opts.has("AS2")) s.c = 2;
    if (s.name === "FINAL" && opts.has("FRB")) Object.keys(s.td).forEach((v) => { s.td[v] *= 0.75; });
    if (opts.has("MES")) { s.mttr = st.mttr; s.q = st.q * 0.8; }
    if (opts.has("AGV")) s.buffer = 4;
    return s;
  });
}
/* Eq. 7.3 screening model; eta = blocking efficiency per buffer size (calibrated against the DES in the thesis) */
export function screenTh(line, eta, hours) {
  let minRaw = Infinity, y = 1;
  line.forEach((st) => {
    const tm = Object.keys(MIX).reduce((s, v) => s + MIX[v] * st.td[v] * st.speed, 0);
    minRaw = Math.min(minRaw, st.c * availability(st.mtbf, st.mttr) * 3600 * hours / tm); y *= 1 - st.q;
  });
  return minRaw * y * eta[String(line[0].buffer)];
}
/* plan: array of S arrays of option codes added at stage s. Returns per-stage table and NPV terms (Eq. 7.1). */
export function evalPlan(plan, E, eta, OPTS, demFactor = 1) {
  const disc = (s) => Math.pow(1 + E.disc, s), dem = E.demand.map((d) => d * demFactor);
  const inst = new Set(); let npv = 0, capital = 0; const rows = []; const warn = [];
  const stageVal = (th, d, s) => (E.margin * Math.min(th, d) - E.penalty * Math.max(0, d - th)) * E.months / disc(s);
  for (let s = 1; s <= E.stages; s++) {
    const add = plan[s - 1] || []; const capex = add.reduce((x, o) => x + OPTS[o][0], 0);
    if (capex > E.budget) warn.push(`stage ${s}: capex ${capex.toLocaleString()} EUR > budget ${E.budget.toLocaleString()} EUR`);
    add.forEach((o) => inst.add(o));
    [...inst].forEach((o) => { const pre = OPTS[o][2]; if (pre && !inst.has(pre)) warn.push(`stage ${s}: ${o} requires ${pre}`); });
    capital += capex; const opex = E.opex * [...inst].reduce((x, o) => x + OPTS[o][0], 0);
    const th = screenTh(stageLine(inst), eta, E.hours), d = dem[s - 1], v = stageVal(th, d, s);
    npv += v - capex / disc(s) - opex / disc(s);
    rows.push({ s, add: [...add], th, d, short: th < 0.95 * d, value: v, capex, opex });
  }
  const thEnd = screenTh(stageLine(inst), eta, E.hours), opexEnd = E.opex * [...inst].reduce((x, o) => x + OPTS[o][0], 0);
  for (let t = E.stages + 1; t <= E.stages + E.terminal; t++) npv += stageVal(thEnd, dem[dem.length - 1], t) - opexEnd / disc(t);
  return { rows, npv, capital, thEnd, warn: [...new Set(warn)] };
}
/* STATIC rule of the thesis (Eq. 7.2 with design values): enumerate feasible additions per stage, configuration kept afterwards */
export function suggestPlan(E, eta, OPTS, demFactor = 1) {
  const codes = Object.keys(OPTS), disc = (s) => Math.pow(1 + E.disc, s), dem = E.demand.map((d) => d * demFactor);
  const stageVal = (th, d, s) => (E.margin * Math.min(th, d) - E.penalty * Math.max(0, d - th)) * E.months / disc(s);
  let inst = new Set(); const plan = [];
  for (let s = 1; s <= E.stages; s++) {
    const rest = codes.filter((o) => !inst.has(o)); let best = [], bestV = -Infinity;
    for (let mask = 0; mask < 1 << rest.length; mask++) {
      const comb = rest.filter((_, i) => mask & (1 << i)); const cost = comb.reduce((x, o) => x + OPTS[o][0], 0);
      if (cost > E.budget) continue;
      const opts = new Set([...inst, ...comb]); if ([...opts].some((o) => OPTS[o][2] && !opts.has(OPTS[o][2]))) continue;
      const th = screenTh(stageLine(opts), eta, E.hours), capAll = [...opts].reduce((x, o) => x + OPTS[o][0], 0);
      let v = 0; for (let t = s; t <= E.stages; t++) v += stageVal(th, dem[t - 1], t);
      for (let t = E.stages + 1; t <= E.stages + E.terminal; t++) v += stageVal(th, dem[dem.length - 1], t);
      for (let t = s; t <= E.stages + E.terminal; t++) v -= E.opex * capAll / disc(t);
      v -= cost / disc(s);
      if (v > bestV + 1e-6) { bestV = v; best = comb; }
    }
    plan.push(best); best.forEach((o) => inst.add(o));
  }
  return plan;
}
