/* Ball screw + guide factory – item 5 quality: formulas as pure functions + hand-check values CHECK5.
 * Guide: docs/44_bsf_quality_inspection.md. The same calculations exist independently in Python (twin/bsf_qa.py, POST /api/bsf/qa/eval) –
 * the self-check (&bf5test) compares both. ALL VALUES ARE EXAMPLES.
 *   leadEval(x, e, T, ph)  ISO 3408-3: mean travel line (least squares), E, E − T, v_up, v_300, v_2π, grade C3 / C5 / C7
 *   leadSim(o, U)          realistic lead-error curve (systematic + 2π wobble + long wave + noise + grinding heat + measuring temperature)
 *   capability(groups, lsl, usl) · imrStats(values, lsl, usl) · xbarS(groups) · weRules(y, cl, sigma)
 *   grr(data, tol)         AIAG average + range method AND two-way ANOVA
 *   aqlPlan(lot, aql) · ocPa(n, ac, p) · uncBudget(L, dT) · torqueTol(Tp, grade) · caseDepth(d, hv, lim) · roughness(z, dx, lc) · circleFit(pts)
 */
import { ACC_BS, ACC_LG } from "./bsfprod_data.js";
import { ALPHA, SPC, AQL, GRR_INFO, UNC, TORQUE_TOL } from "./bsfqa_data.js";

export function rng(seed = 5) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const gauss = (U) => { let u = 0, v = 0; while (u < 1e-12) u = U(); v = U(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const mean = (v) => v.reduce((s, a) => s + a, 0) / v.length;
export const sdev = (v) => { if (v.length < 2) return 0; const m = mean(v); return Math.sqrt(v.reduce((s, a) => s + (a - m) ** 2, 0) / (v.length - 1)); };
export const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
export const phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

/* ------------------------------------------------------------------ ISO 3408-3 lead evaluation */
export function lsq(x, y) {
  const n = x.length, mx = mean(x), my = mean(y); let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (x[i] - mx) ** 2; sxy += (x[i] - mx) * (y[i] - my); }
  const b = sxx ? sxy / sxx : 0; return { a: my - b * mx, b };
}
/* largest (max − min) of r inside any window of length w; the whole range when the travel is shorter than w. Also returns where. */
export function windowRange(x, r, w) {
  const n = x.length;
  if (x[n - 1] - x[0] <= w + 1e-9) { let lo = Infinity, hi = -Infinity; for (const v of r) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return { v: hi - lo, x0: x[0], x1: x[n - 1] }; }
  let best = 0, bx = x[0];
  for (let i = 0; i < n; i++) {
    if (x[i] + w > x[n - 1] + 1e-9) break;
    let lo = r[i], hi = r[i];
    for (let j = i; j < n && x[j] <= x[i] + w + 1e-9; j++) { if (r[j] < lo) lo = r[j]; if (r[j] > hi) hi = r[j]; }
    if (hi - lo > best) { best = hi - lo; bx = x[i]; }
  }
  return { v: best, x0: bx, x1: bx + w };
}
export function leadLimits(lu) {
  let k = ACC_BS.bins.findIndex((b) => lu <= b); if (k < 0) k = ACC_BS.bins.length - 1;
  return { bin: ACC_BS.bins[k],
    C3: { ep: ACC_BS.ep.C3[k], vup: ACC_BS.vup.C3[k], v300: ACC_BS.v300.C3, v2pi: ACC_BS.v2pi.C3 },
    C5: { ep: ACC_BS.ep.C5[k], vup: ACC_BS.vup.C5[k], v300: ACC_BS.v300.C5, v2pi: ACC_BS.v2pi.C5 },
    C7: { ep: lu / 300 * ACC_BS.v300.C7, vup: null, v300: ACC_BS.v300.C7, v2pi: null } };
}
export function leadEval(x, e, T = 0, ph = 10) {
  const n = x.length, lu = x[n - 1] - x[0], { a, b } = lsq(x, e), E = b * lu;
  const r = e.map((v, i) => v - (a + b * x[i]));
  let lo = Infinity, hi = -Infinity; for (const v of r) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const w300 = windowRange(x, r, 300), w2 = windowRange(x, r, ph);
  const lim = leadLimits(lu), dev = E - T, ok = {};
  for (const g of ["C3", "C5", "C7"]) { const L = lim[g]; ok[g] = Math.abs(dev) <= L.ep + 1e-9 && w300.v <= L.v300 + 1e-9 && (L.vup == null || hi - lo <= L.vup + 1e-9) && (L.v2pi == null || w2.v <= L.v2pi + 1e-9); }
  const grade = ["C3", "C5", "C7"].find((g) => ok[g]) || "reject";
  return { lu, a, b, E, T, dev, vu: hi - lo, v300: w300.v, v300at: w300, v2pi: w2.v, v2piAt: w2, r, lim, ok, grade };
}
/* realistic lead-error curve. Returns positions x (mm) and deviations (µm): true (at 20 °C), raw (laser reading, material at tMat), comp (after compensation) */
export function leadSim(o, U) {
  const n = Math.round(o.lu / o.step) + 1, x = [], eT = [], raw = [], comp = [], tm = [];
  const sys = o.sys_um + gauss(U) * (o.sysSd ?? 0), ph0 = U() * 2 * Math.PI, phL = U() * 2 * Math.PI;
  const dTg = o.tGrind - 20;   // screw warmer during grinding → ground lead too short after cooling: −α·ΔT·x
  for (let i = 0; i < n; i++) {
    const xi = i * o.step, s = xi / o.lu;
    const grind = -ALPHA * (dTg * xi + o.riseGrind * xi * xi / (2 * o.lu)) / 1000;
    const e = sys * s + grind + o.a2pi * Math.sin(2 * Math.PI * xi / o.ph + ph0) + o.aLong * Math.sin(2 * Math.PI * xi / o.pLong + phL) + gauss(U) * o.noise;
    const tMat = o.tMat + o.drift * s;   // material temperature when the probe is at xi (the run moves from 0 to l_u)
    const r = e + ALPHA * (tMat - 20) * xi / 1000;          // the laser sees the warm (longer) screw
    const tSens = tMat + (o.sensorErr || 0);
    x.push(xi); eT.push(e); raw.push(r); comp.push(r - ALPHA * (tSens - 20) * xi / 1000); tm.push(tMat);
  }
  return { x, eT, raw, comp, tm, sys, parts: { grindSlope_um: -ALPHA * dTg * o.lu / 1000, grindBow_um: -ALPHA * o.riseGrind * o.lu / 2 / 1000, tempRaw_um: ALPHA * (o.tMat + o.drift - 20) * o.lu / 1000 } };
}

/* ------------------------------------------------------------------ SPC + capability */
const kIdx = (n) => Math.max(0, Math.min(8, n - 2));
export function capability(groups, lsl = null, usl = null) {
  const n = groups[0].length, i = kIdx(n), xb = groups.map(mean), rr = groups.map((g) => Math.max(...g) - Math.min(...g));
  const xbb = mean(xb), rb = mean(rr), sw = rb / SPC.d2[i], all = groups.flat(), so = sdev(all);
  const idx = (s) => { const c = []; if (usl != null) c.push((usl - xbb) / (3 * s)); if (lsl != null) c.push((xbb - lsl) / (3 * s)); return c.length ? Math.min(...c) : null; };
  return { n, k: groups.length, xb, rr, xbarbar: xbb, rbar: rb, sigmaWithin: sw, sigmaOverall: so,
    UCLx: xbb + SPC.A2[i] * rb, LCLx: xbb - SPC.A2[i] * rb, UCLr: SPC.D4[i] * rb, LCLr: SPC.D3[i] * rb,
    Cp: usl != null && lsl != null && sw > 0 ? (usl - lsl) / (6 * sw) : null, Cpk: sw > 0 ? idx(sw) : null,
    Pp: usl != null && lsl != null && so > 0 ? (usl - lsl) / (6 * so) : null, Ppk: so > 0 ? idx(so) : null };
}
export function xbarS(groups) {
  const n = groups[0].length, i = kIdx(n), xb = groups.map(mean), ss = groups.map(sdev), xbb = mean(xb), sb = mean(ss);
  return { xb, ss, xbarbar: xbb, sbar: sb, sigmaWithin: sb / SPC.c4[i], UCLx: xbb + SPC.A3[i] * sb, LCLx: xbb - SPC.A3[i] * sb, UCLs: SPC.B4[i] * sb, LCLs: SPC.B3[i] * sb };
}
export function imrStats(v, lsl = null, usl = null) {
  const mr = v.slice(1).map((a, i) => Math.abs(a - v[i])), xb = mean(v), mrb = mr.length ? mean(mr) : 0, sw = mrb / SPC.d2[0], so = sdev(v);
  const idx = (s) => { const c = []; if (usl != null) c.push((usl - xb) / (3 * s)); if (lsl != null) c.push((xb - lsl) / (3 * s)); return c.length ? Math.min(...c) : null; };
  return { mr, xbar: xb, mrbar: mrb, sigmaWithin: sw, sigmaOverall: so, UCLx: xb + SPC.E2 * mrb, LCLx: xb - SPC.E2 * mrb, UCLmr: SPC.D4mr * mrb, LCLmr: 0,
    Cp: usl != null && lsl != null && sw > 0 ? (usl - lsl) / (6 * sw) : null, Cpk: sw > 0 ? idx(sw) : null,
    Pp: usl != null && lsl != null && so > 0 ? (usl - lsl) / (6 * so) : null, Ppk: so > 0 ? idx(so) : null };
}
/* Western Electric rules 1 – 4 → for each point the list of rules that fire AT this point */
export function weRules(y, cl, sigma) {
  const z = y.map((v) => (sigma > 0 ? (v - cl) / sigma : 0)), out = y.map(() => []);
  for (let i = 0; i < y.length; i++) {
    if (Math.abs(z[i]) > 3) out[i].push(1);
    for (const sgn of [1, -1]) {
      if (i >= 2) { const w = z.slice(i - 2, i + 1); if (sgn * z[i] > 2 && w.filter((q) => sgn * q > 2).length >= 2) out[i].push(2); }
      if (i >= 4) { const w = z.slice(i - 4, i + 1); if (sgn * z[i] > 1 && w.filter((q) => sgn * q > 1).length >= 4) out[i].push(3); }
      if (i >= 7) { const w = z.slice(i - 7, i + 1); if (w.every((q) => sgn * q > 0)) out[i].push(4); }
    }
  }
  return out.map((a) => [...new Set(a)]);
}
export const ppmOut = (mu, s, lsl, usl) => 1e6 * ((lsl != null ? phi((lsl - mu) / s) : 0) + (usl != null ? 1 - phi((usl - mu) / s) : 0));

/* ------------------------------------------------------------------ MSA – gauge R&R */
export function grr(data, tol = null) {
  const a = data.length, b = data[0].length, r = data[0][0].length, K = GRR_INFO;
  const rbarOp = data.map((op) => mean(op.map((p) => Math.max(...p) - Math.min(...p)))), xbarOp = data.map((op) => mean(op.flat()));
  const rbb = mean(rbarOp), EV = rbb * K.K1[r], xdiff = Math.max(...xbarOp) - Math.min(...xbarOp);
  const AV = Math.sqrt(Math.max(0, (xdiff * K.K2[a]) ** 2 - EV ** 2 / (b * r))), G = Math.hypot(EV, AV);
  const xp = Array.from({ length: b }, (_, p) => mean(data.flatMap((op) => op[p]))), Rp = Math.max(...xp) - Math.min(...xp), PV = Rp * K.K3[b], TV = Math.hypot(G, PV);
  const ar = { rbarOp, xbarOp, rbarbar: rbb, xdiff, xp, Rp, EV, AV, GRR: G, PV, TV, pctEV: 100 * EV / TV, pctAV: 100 * AV / TV, pctGRR: 100 * G / TV, pctPV: 100 * PV / TV,
    ndc: G > 0 ? Math.floor(1.41 * PV / G) : null, pctTol: tol ? 100 * 6 * G / tol : null };
  const all = data.flat(2), gm = mean(all), mo = xbarOp, cell = data.map((op) => op.map(mean));
  const ssO = b * r * mo.reduce((s, m) => s + (m - gm) ** 2, 0), ssP = a * r * xp.reduce((s, m) => s + (m - gm) ** 2, 0);
  const ssC = r * cell.flat().reduce((s, m) => s + (m - gm) ** 2, 0), ssI = ssC - ssO - ssP, ssT = all.reduce((s, v) => s + (v - gm) ** 2, 0), ssE = ssT - ssC;
  const df = { part: b - 1, operator: a - 1, interaction: (a - 1) * (b - 1), error: a * b * (r - 1) };
  const MS = { part: ssP / df.part, operator: ssO / df.operator, interaction: ssI / df.interaction, error: ssE / df.error };
  const v = { repeatability: MS.error, interaction: Math.max(0, (MS.interaction - MS.error) / r), operator: Math.max(0, (MS.operator - MS.interaction) / (b * r)), part: Math.max(0, (MS.part - MS.interaction) / (a * r)) };
  v.GRR = v.repeatability + v.operator + v.interaction;
  const sg = Math.sqrt(v.GRR), sp = Math.sqrt(v.part), st = Math.sqrt(v.GRR + v.part);
  const anova = { SS: { part: ssP, operator: ssO, interaction: ssI, error: ssE, total: ssT }, df, MS, F_interaction: MS.interaction / MS.error, var: v,
    sigmaGRR: sg, sigmaPart: sp, sigmaTV: st, pctGRR: 100 * sg / st, ndc: sg > 0 ? Math.floor(1.41 * sp / sg) : null, pctTol: tol ? 100 * 6 * sg / tol : null };
  return { ar, anova };
}

/* ------------------------------------------------------------------ sampling ISO 2859-1 (example table logic) */
export function aqlPlan(lot, aql) {
  const row = AQL.lots.find((l) => lot >= l[0] && lot <= l[1]) || AQL.lots[AQL.lots.length - 1], L = AQL.letters, li = L.indexOf(row[2]), i0 = L.indexOf(AQL.ac0[aql]);
  let k = li, ac, note = "";
  if (li <= i0) { k = i0; ac = 0; note = li < i0 ? `arrow ↓ → use letter ${L[i0]}` : ""; }
  else if (li === i0 + 1) { k = i0; ac = 0; note = `arrow ↑ → use letter ${L[i0]}`; }
  else if (li === i0 + 2) { k = i0 + 3; ac = 1; note = `arrow ↓ → use letter ${L[i0 + 3]}`; }
  else { const s = li - (i0 + 3); if (s < AQL.acSeq.length) ac = AQL.acSeq[s]; else { k = i0 + 3 + AQL.acSeq.length - 1; ac = AQL.acSeq[AQL.acSeq.length - 1]; note = `arrow ↑ → use letter ${L[k]}`; } }
  k = Math.min(k, AQL.n.length - 1);
  const n = AQL.n[k];
  return { letter: row[2], useLetter: L[k], n: Math.min(n, lot), ac, re: ac + 1, note: n >= lot ? "sample ≥ lot → inspect 100 %" : note };
}
export function ocPa(n, ac, p) { let s = 0, c = Math.pow(1 - p, n); for (let k = 0; k <= ac; k++) { if (k > 0) c *= (n - k + 1) / k * p / (1 - p); s += c; } return Math.min(1, s); }

/* ------------------------------------------------------------------ uncertainty budget (GUM, simple) */
export function uncBudget(Lm = 0.7, dT = 0.5, k = 2) {
  const rows = UNC.map((u) => { const a = u.a(Lm, dT), ui = a / u.div; return { id: u.id, n: u.n, a, dist: u.dist, div: u.div, u: ui }; });
  const uc = Math.sqrt(rows.reduce((s, r) => s + r.u * r.u, 0));
  rows.forEach((r) => { r.pct = 100 * r.u * r.u / (uc * uc); });
  return { rows, uc, k, U: k * uc };
}

/* ------------------------------------------------------------------ small measurement formulas */
export function torqueTol(Tp, grade = "C5") { const row = TORQUE_TOL.find((r) => Tp >= r[0] && Tp < r[1]) || TORQUE_TOL[Tp < 0.2 ? 0 : TORQUE_TOL.length - 1]; return row[{ C3: 2, C5: 3, C7: 4 }[grade] || 3]; }
export function torqueEval(s, T, Tp0, tolPct, excl) {
  const L = s[s.length - 1], keep = s.map((v, i) => v >= excl && v <= L - excl ? i : -1).filter((i) => i >= 0), t = keep.map((i) => T[i]);
  const m = mean(t), mx = Math.max(...t), mn = Math.min(...t), lo = Tp0 * (1 - tolPct / 100), hi = Tp0 * (1 + tolPct / 100);
  return { mean: m, max: mx, min: mn, var: (mx - mn) / 2, varPct: 100 * Math.max(mx - Tp0, Tp0 - mn) / Tp0, lo, hi, ok: mn >= lo && mx <= hi, meanDevPct: 100 * (m - Tp0) / Tp0, n: t.length };
}
/* case depth: depth where the hardness profile falls below the limit hardness (linear interpolation) */
export function caseDepth(d, hv, lim = 550) { for (let i = 1; i < d.length; i++) if (hv[i - 1] >= lim && hv[i] < lim) return d[i - 1] + (hv[i - 1] - lim) / (hv[i - 1] - hv[i]) * (d[i] - d[i - 1]); return hv[hv.length - 1] >= lim ? Infinity : 0; }
/* HRC ↔ HV approximate (ISO 18265 table style, example points) */
const HRC_HV = [[20, 238], [30, 302], [40, 392], [45, 446], [50, 513], [52, 544], [54, 577], [55, 595], [56, 613], [58, 653], [60, 697], [62, 746], [64, 800], [66, 865]];
export const hrcToHv = (h) => { for (let i = 1; i < HRC_HV.length; i++) if (h <= HRC_HV[i][0]) { const [a, b] = [HRC_HV[i - 1], HRC_HV[i]]; return a[1] + (h - a[0]) / (b[0] - a[0]) * (b[1] - a[1]); } return HRC_HV[HRC_HV.length - 1][1]; };
export const hvToHrc = (v) => { for (let i = 1; i < HRC_HV.length; i++) if (v <= HRC_HV[i][1]) { const [a, b] = [HRC_HV[i - 1], HRC_HV[i]]; return a[0] + (v - a[1]) / (b[1] - a[1]) * (b[0] - a[0]); } return 66; };
/* roughness from a profile z (µm) with point spacing dx (mm): mean line = moving average over λc (simple filter), Ra, Rq, Rz (mean of 5 sampling lengths) */
export function roughness(z, dx, lc = 0.8) {
  const w = Math.max(1, Math.round(lc / dx / 2)), n = z.length, m = z.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += z[j]; k++; } return s / k; });
  const rr = z.map((v, i) => v - m[i]), i0 = w, i1 = n - w, r = rr.slice(i0, i1);
  const Ra = mean(r.map(Math.abs)), Rq = Math.sqrt(mean(r.map((v) => v * v))), ls = Math.floor(r.length / 5), seg = [];
  for (let k = 0; k < 5; k++) { const s = r.slice(k * ls, (k + 1) * ls); seg.push(Math.max(...s) - Math.min(...s)); }
  return { Ra, Rq, Rz: mean(seg), seg, r, i0, mean: m };
}
/* algebraic least-squares circle (Kåsa) */
export function circleFit(p) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0; const n = p.length;
  for (const [x, y] of p) { const z = x * x + y * y; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; sxz += x * z; syz += y * z; sz += z; }
  const A = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]], B = [sxz, syz, sz];
  const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A), sol = [0, 1, 2].map((c) => det(A.map((row, i) => row.map((v, j) => (j === c ? B[i] : v)))) / D);
  const cx = sol[0] / 2, cy = sol[1] / 2; return { cx, cy, r: Math.sqrt(sol[2] + cx * cx + cy * cy) };
}
/* rail running parallelism → best accuracy class for the rail length */
export function parClass(L, dev) {
  let k = ACC_LG.len.findIndex((l) => L <= l); if (k < 0) k = ACC_LG.len.length - 1;
  const lim = Object.fromEntries(Object.keys(ACC_LG.par).map((c) => [c, ACC_LG.par[c][k]]));
  const cls = ["UP", "SP", "P", "H", "N"].find((c) => dev <= lim[c] + 1e-9) || "out";
  return { cls, lim, binL: ACC_LG.len[k] };
}
/* carriage height / width class: [class, H tol, W2 tol, ΔH, ΔW2] rows of ACC_LG.cls (strings → numbers in µm) */
export function hwClass(devH, devW, dH, dW) {
  const tol = (s) => { const m = s.replace(/\s/g, "").match(/^±(\d*\.?\d+)$/); if (m) return [-1000 * +m[1], 1000 * +m[1]]; const q = s.replace(/\s/g, "").replace("−", "-").match(/^0\/-(\d*\.?\d+)$/); return q ? [-1000 * +q[1], 0] : [-1e9, 1e9]; };
  const rows = ACC_LG.cls.map((r) => ({ c: r[0], H: tol(r[1]), W: tol(r[2]), dH: 1000 * +r[3], dW: 1000 * +r[4] }));
  const okc = (r) => devH.every((v) => v >= r.H[0] - 1e-9 && v <= r.H[1] + 1e-9) && devW.every((v) => v >= r.W[0] - 1e-9 && v <= r.W[1] + 1e-9) && dH <= r.dH + 1e-9 && dW <= r.dW + 1e-9;
  const best = ["UP", "SP", "P", "H", "N"].find((c) => okc(rows.find((r) => r.c === c))) || "out";
  return { best, rows };
}

/* ------------------------------------------------------------------ hand-check values (computed by hand + by twin/bsf_qa.py – guide 44 §8, §13, §14) */
export const CHECK5 = {
  lead8: { x: [0, 100, 200, 300, 400, 500, 600, 700], e: [0, 6, 9, 15, 16, 24, 27, 33], b: 19100 / 420000, E: 31.833333, vu: 3.642857, v300: 3.642857, grade: "C5" },
  cos: { E: 0, vu: 4, v300: 4, v2pi: 4, grade: "C3" },
  cap: { groups: [[10.2, 9.8, 10.1, 10.0, 9.9], [10.3, 10.0, 9.7, 10.1, 10.0], [9.9, 10.2, 10.0, 10.4, 10.0], [10.1, 9.6, 10.0, 10.2, 9.9], [10.0, 10.1, 9.8, 10.3, 10.2]],
    lsl: 9, usl: 11, xbarbar: 10.032, rbar: 0.52, sigma: 0.52 / 2.326, Cp: 1.491026, Cpk: 1.443313, UCLx: 10.33204, UCLr: 1.09928, Pp: 1.746342, Ppk: 1.690459 },
  grr: { rbarbar: 1.04, xdiff: 1.25, Rp: 29.611111, EV: 0.614432, AV: 0.644180, GRR: 0.890222, PV: 9.315656, pctGRR: 9.512854, ndc: 14, pctTol: 6.676664,
    anovaPct: 8.764318, anovaNdc: 16, F: 1.351915 },
  aql: [[150, "1.0", 13, 0], [500, "1.0", 50, 1], [1000, "2.5", 80, 5], [100, "0.65", 20, 0], [3000, "4.0", 125, 10]],
  unc: { uc: 0.785261, U: 1.570521 },
};
