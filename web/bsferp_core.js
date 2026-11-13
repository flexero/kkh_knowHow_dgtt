/* Ball screw + guide factory – item 7 ERP – CORE (browser twin of twin/bsf_erp_core.py + twin/bsf_erp.py: same model, same paths, same numbers).
 * Guide: docs/46_bsf_erp.md.  Pure calculations (exported) + createERP(opts) = ERP state + local router (demo mode without the server; never throws).
 *
 *   import { mhr, workcenters, costRollup, eoq, safetyStock, rop, mav, lotCompare, mrp, mrpItem, mrpCheck, ctpCase, bottleneck, mpsLoad, configure,
 *            listPrice, finance, breakeven, explodeBuy, bomTree, evaluate, createERP, MAT, VERSION7 } from "./bsferp_core.js";
 *   const erp = createERP({ now: () => Date.now() / 1000, mes: (method, path, body, headers) => ({ status, data }) });
 *   erp.route("POST", "/api/bsf/erp/mrp/run", {}, { horizon: 8 }) → { status, data, ct }
 * ALL VALUES ARE EXAMPLES.
 */
import { MD } from "./bsferp_data.js";
import { ROUTES, MTYPES, MACHINES, cycOf } from "./bsfmfg_data.js";
import { PRODUCTS6, prodInfo, REF_CODE } from "./bsfmes_data.js";
import { aqlPlan as aqlPlan5 } from "./bsfqa_calc.js";

export const VERSION7 = "bsf_erp 1.0";
const P = MD.plant, EPS = 1e-9;
const r2 = (v, d = 2) => { const f = 10 ** d; return Math.round((+v) * f) / f; };
const sum = (a) => a.reduce((s, x) => s + x, 0);
export const NMACH = MACHINES.reduce((a, m) => { a[m.type] = (a[m.type] || 0) + 1; return a; }, {});
const MCOLS = ["id", "n", "type", "uom", "proc", "lt", "lot", "lotQ", "ss", "price", "sup", "route"];
export const MAT = {};
for (const r of MD.materials) MAT[r[0]] = Object.fromEntries(MCOLS.map((k, i) => [k, r[i]]));
const kTxt = (k) => (Number.isInteger(k) ? k.toFixed(1) : String(k));
for (const p of PRODUCTS6) if (!MAT[p.code]) MAT[p.code] = { id: p.code, n: `${p.kind} ${p.fam} (family variant, k = ${kTxt(p.k)})`, type: "fg", uom: "pc", proc: "make", lt: ["BS", "BN", "LG", "LB"].includes(p.route) ? 10 : 2, lot: "L4L", lotQ: 0, ss: 0, price: 0, sup: "", route: p.route, variant: true };
export const BOM = MD.bom;
export const CUST = Object.fromEntries(MD.customers.map((r) => [r[0], { id: r[0], n: r[1], country: r[2], terms: r[3], creditK: r[4], inco: r[5], channel: r[6], group: r[7] }]));
export const SUPP = Object.fromEntries(MD.suppliers.map((r) => [r[0], { id: r[0], n: r[1], supplies: r[2], lt: r[3], terms: r[4], rating: r[5], channel: r[6], cert: r[7] }]));
const REF = REF_CODE;
const BOTTLE = { BS: ["BS", "100", 1], BN: ["BN", "60", 1], LG: ["LG", "80", 1], LB: ["LB", "60", 1], FABS: ["BS", "100", 1], FALG: ["LB", "60", 2] };

export function matId(x) {
  if (x == null) return null; x = String(x);
  if (MAT[x]) return x; if (REF[x]) return REF[x];
  const u = x.toUpperCase(); return Object.keys(MAT).find((k) => k.toUpperCase() === u) || null;
}
export const routeOf = (code) => { const m = MAT[code] || {}; return m.proc === "make" ? String(m.route || "").split(":")[0] : ""; };
export const kOf = (code) => { const p = prodInfo(code); return p ? p.k : 1.0; };
export const opsOf7 = (route) => (ROUTES[route] ? ROUTES[route].ops.filter((o) => (!o.v || o.v.includes("G")) && !o.buy) : []);
const shortName = (n) => n.split(/[(:–,]/)[0].trim().slice(0, 42);
export const effTime = (o, k = 1) => (o.mod === "furnace" ? cycOf(o, "G") : cycOf(o, "G") * k) + (o.batch ? o.setup / o.batch : 0);
export function routeYield(route, fromNo = null) { let y = 1, on = fromNo == null; for (const o of opsOf7(route)) { if (o.no === fromNo) on = true; if (on) y *= 1 - (o.scrap || 0) / 100; } return y; }
const shiftsOf = (t) => (MTYPES[t] && MTYPES[t].shifts3 ? 3 : 2);

/* ================================================================== machine hour rate */
export function mhr(t) {
  const T = MTYPES[t], W = MD.wc[t]; if (!T || !W) return null;
  const price = W[0] * 1000, hours = P.days * shiftsOf(t) * P.shiftH, area = T.foot[0] * T.foot[1] * P.access;
  const dep = price / P.life, int = price / 2 * P.interest, space = area * P.room[T.area], energy = T.kW * P.loadFactor * hours * P.energy, maint = P.maint[T.area] * price;
  const total = dep + int + space + energy + maint;
  return { type: t, name: T.n, area: T.area, kW: T.kW, price, life: P.life, hours, areaM2: area, dep, int, space, energy, maint, total, rate: total / hours, energyRate: energy / hours,
    nonCashRate: (dep + int) / hours, crew: W[1], labourRate: W[1] * P.labour, n: NMACH[t] || 0 };
}
export const workcenters = () => Object.keys(MD.wc).map(mhr).filter(Boolean);

/* ================================================================== standard cost roll-up */
function children(code) {
  if (BOM[code]) return [BOM[code], 1.0];
  const r = routeOf(code); if (r && BOM[REF[r]]) return [BOM[REF[r]], kOf(code)];
  return [[], 1.0];
}
export function stdPrice(code) { const m = MAT[code]; if (!m) return 0; if (m.proc === "buy") return +m.price; if (m.proc === "phantom") return 0; return costRollup(code).std; }
function material(code, k, factor = 1, out = []) {
  const [kids, kk] = children(code);
  for (const [child, qty, pos] of kids) {
    const c = MAT[child]; if (!c) continue;
    const q = qty * factor * (c.type === "raw" ? kk : 1);
    if (c.proc === "phantom") material(child, k, q, out);
    else if (c.proc === "make") out.push({ pos, child, qty: q, price: stdPrice(child), kind: "make", type: c.type, uom: c.uom });
    else out.push({ pos, child, qty: q, price: +c.price, kind: "buy", type: c.type, uom: c.uom });
  }
  return out;
}
const COST = {};
export function costRollup(code) {
  if (COST[code]) return COST[code];
  const m = MAT[code]; if (!m || m.proc !== "make") return null;
  const route = routeOf(code), k = kOf(code), mat = material(code, k);
  for (const x of mat) x.value = x.qty * x.price;
  const matBuy = sum(mat.filter((x) => x.kind === "buy").map((x) => x.value)), matMake = sum(mat.filter((x) => x.kind === "make").map((x) => x.value)), moh = P.moh * matBuy;
  const ops = []; let cum = 0, mach = 0, lab = 0, fixNc = 0, fixC = 0, ener = 0;
  for (const o of opsOf7(route)) {
    const R = mhr(o.m), t = effTime(o, k), f = t / 60 / P.oee, cm = f * R.rate, cl = f * R.labourRate;
    mach += cm; lab += cl; fixNc += f * R.nonCashRate; ener += f * R.energyRate; fixC += f * (R.rate - R.nonCashRate - R.energyRate); cum += (cm + cl) * (1 + P.poh);
    ops.push({ no: o.no, m: o.m, name: shortName(o.op), t, rate: R.rate, crew: R.crew, machine: cm, labour: cl, scrap: o.scrap, cumConv: cum });
  }
  const poh = P.poh * (mach + lab), base = matBuy + matMake + moh + mach + lab + poh, y = routeYield(route), scrap = base * (1 / y - 1), std = base + scrap, full = std * (1 + P.sga);
  const price = +(MD.prices[code] || 0) || null, semi = {};
  for (const [sid, sm] of Object.entries(MAT)) {
    if (sm.proc === "phantom" && sm.route.split(":")[0] === route && code === REF[route]) {
      const upto = sm.route.split(":")[1], raw = sum(mat.filter((x) => x.type === "raw").map((x) => x.value)), op = ops.find((x) => x.no === upto);
      semi[sid] = raw * (1 + P.moh) + (op ? op.cumConv : 0);
    }
  }
  let roll = { mat: matBuy, moh, labour: lab, energy: ener, fixCash: fixC, fixNonCash: fixNc, poh };
  for (const x of mat) if (x.kind === "make") { const cr = costRollup(x.child).roll; for (const kk of Object.keys(roll)) roll[kk] += cr[kk] * x.qty; }
  roll = Object.fromEntries(Object.entries(roll).map(([kk, v]) => [kk, v / y]));
  const variable = roll.mat + roll.moh + roll.labour + roll.energy;
  const r = { code, route, k, material: mat, matBuy, matMake, moh, ops, machine: mach, labour: lab, poh, base, yield: y, scrap, std, sga: std * P.sga, full, price,
    margin: price ? price - full : null, marginPct: price ? (price - full) / price : null, semi, fixNonCash: fixNc, fixCash: fixC, energy: ener, variable, roll, fixed: roll.fixCash + roll.fixNonCash + roll.poh };
  COST[code] = r; return r;
}

/* ================================================================== lot sizing, EOQ, SS / ROP */
export const eoq = (D, S, H) => (H > 0 && D > 0 ? Math.sqrt(2 * D * S / H) : 0);
export const safetyStock = (z, sigma, LT) => z * sigma * Math.sqrt(LT);
export const rop = (d, LT, SS) => d * LT + SS;
export const mav = (q0, p0, q1, p1) => (q0 + q1 > 0 ? (q0 * p0 + q1 * p1) / (q0 + q1) : p1);
const pyRound = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); };   // Python round() = half to even
export function lotCompare(net, S, H, foq) {
  const n = net.length, avg = n ? sum(net) / n : 0, Q = eoq(avg, S, H), Pp = avg > 0 ? Math.max(1, pyRound(Q / avg)) : 1, res = {};
  for (const rule of ["L4L", "FOQ", "EOQ", "POQ"]) {
    let inv = 0; const orders = new Array(n).fill(0), ends = [];
    for (let t = 0; t < n; t++) {
      if (inv < net[t] - EPS) {
        const need = net[t] - inv;
        const q = rule === "L4L" ? need : rule === "FOQ" ? Math.ceil(need / foq - EPS) * foq : rule === "EOQ" ? Math.max(pyRound(Q), need) : sum(net.slice(t, t + Pp)) - inv;
        orders[t] = q; inv += q;
      }
      inv -= net[t]; ends.push(inv);
    }
    const setups = orders.filter((q) => q > 0).length;
    res[rule] = { orders, end: ends, setups, setupCost: setups * S, holdCost: sum(ends) * H, cost: setups * S + sum(ends) * H };
  }
  return { net, S, H, EOQ: Q, P: Pp, FOQ: foq, rules: res };
}

/* ================================================================== MRP */
export function lowLevelCodes(items) {
  const llc = Object.fromEntries(items.map((i) => [i, 0])); let changed = true;
  while (changed) { changed = false; for (const [parent, kids] of Object.entries(BOM)) for (const [child] of kids) if (child in llc && parent in llc && llc[child] < llc[parent] + 1) { llc[child] = llc[parent] + 1; changed = true; } }
  return llc;
}
export function mrpItem(it, gross, H) {
  const sr = [...(it.sr || new Array(H).fill(0)), ...new Array(H).fill(0)];
  const oh = +(it.oh || 0), ss = +(it.ss || 0), lt = +(it.lt || 0) | 0, rule = it.lot || "L4L";
  const avg = H ? sum(gross) / H : 0, Q = ["EOQ", "POQ"].includes(rule) ? eoq(avg, it.S || 0, it.Hw || 0) : 0;
  const Pp = rule === "POQ" && avg > 0 && Q > 0 ? Math.max(1, pyRound(Q / avg)) : 1;
  const poh = [], net = new Array(H).fill(0), prc = new Array(H).fill(0), prl = new Array(H + lt + 1).fill(0), exc = [];
  let last = oh;
  for (let t = 0; t < H; t++) {
    let avail = last + sr[t] - gross[t];
    if (avail < ss - EPS) {
      const n = ss - avail; net[t] = n; let q;
      if (it.phantom || rule === "L4L") q = n;
      else if (rule === "FOQ") q = it.q ? Math.ceil(n / it.q - EPS) * it.q : n;
      else if (rule === "EOQ") q = Q ? Math.max(pyRound(Q), n) : n;
      else if (rule === "POQ") q = Math.max(sum(gross.slice(t, t + Pp)) + ss - (last + sum(sr.slice(t, t + Pp))), n);
      else q = n;
      prc[t] = q; avail += q;
      let rt = t - lt;
      if (rt < 0) { exc.push({ kind: "expedite", bucket: t, qty: q, planned: true, text: `planned order due in week ${t} needs release in week ${rt} (past) - expedite / shorten lead time` }); rt = 0; }
      prl[rt] += q;
    }
    poh.push(avail); last = avail;
  }
  const srs = []; for (let t = 0; t < H; t++) if (sr[t] > 0) srs.push([t, sr[t]]);
  let used = 0;
  for (const [tR, qR] of srs) {
    let needAt = null, inv = oh;
    for (let t = 0; t < H; t++) { const inv2 = inv - gross[t] + (srs.slice(0, used).some((x) => x[0] === t) ? sr[t] : 0); if (inv2 < ss - EPS && needAt === null) needAt = t; inv = inv2; }
    const g = +qR.toPrecision(12);
    if (needAt === null) exc.push({ kind: "cancel", bucket: tR, text: `receipt of ${g} in week ${tR} is not needed in the horizon - cancel or reduce` });
    else if (needAt > tR) exc.push({ kind: "push out", bucket: tR, text: `receipt of ${g} in week ${tR} is needed only in week ${needAt} - push out` });
    else if (needAt < tR) exc.push({ kind: "expedite", bucket: tR, text: `receipt of ${g} in week ${tR} is needed already in week ${needAt} - pull in (expedite)` });
    used++;
  }
  return { gross, sr: sr.slice(0, H), poh, net, prc, prl: prl.slice(0, H), exceptions: exc, EOQ: Q, P: Pp };
}
export function mrp(items, indep, H) {
  const ids = Object.keys(items), llc = lowLevelCodes(ids);
  const order = ids.slice().sort((a, b) => llc[a] - llc[b] || (a < b ? -1 : a > b ? 1 : 0));
  const gross = Object.fromEntries(ids.map((i) => [i, (indep[i] || new Array(H).fill(0)).slice()])), out = {};
  for (const i of order) {
    const r = mrpItem(items[i], gross[i], H); r.llc = llc[i]; out[i] = r;
    for (const [child, q] of BOM[i] || []) if (gross[child]) for (let t = 0; t < H; t++) gross[child][t] += r.prl[t] * q;
  }
  return out;
}
export function mrpCheck() {
  const c = MD.check.mrp, A = c.A, B = c.B, H = A.gross.length;
  const ra = mrpItem({ oh: A.oh, ss: A.ss, lt: A.lt, lot: A.lot }, A.gross, H), gb = ra.prl.map((x) => x * B.per);
  const rb = mrpItem({ oh: B.oh, ss: B.ss, lt: B.lt, lot: B.lot, q: B.q, sr: B.sr }, gb, H);
  const rc = mrpItem({ oh: 0, ss: 0, lt: 1, lot: "L4L", sr: [0, 50, 0, 0] }, [0, 0, 0, 50], 4), rd = mrpItem({ oh: 0, ss: 0, lt: 2, lot: "L4L" }, [30, 0, 0, 0], 4);
  return { A: ra, B: rb, grossB: gb, C: rc, D: rd };
}

/* ================================================================== ATP / CTP */
export function ctpCase(c) {
  const rem = Math.max(0, c.q - (c.free || 0)), need = rem * c.minPerPc;
  if (need <= EPS) return { rem: 0, need: 0, doneDay: 0, promiseDay: c.ship ?? 1, used: [] };
  let acc = 0; const used = [], fm = c.freeMin;
  for (let d = (c.upstream || 0) | 0; d < fm.length; d++) {
    const take = Math.min(fm[d], need - acc); if (take > 0) used.push([d, take]);
    acc += fm[d];
    if (acc >= need - EPS) return { rem, need, doneDay: d, promiseDay: d + (c.after || 0) + (c.ship ?? 1), used };
  }
  return { rem, need, doneDay: null, promiseDay: null, used, text: "not possible in the horizon" };
}
export function bottleneck(code) {
  const r = routeOf(code); if (!BOTTLE[r]) return null;
  const [br, opno, per] = BOTTLE[r], o = opsOf7(br).find((x) => x.no === opno); if (!o) return null;
  const t = o.m, cap = (NMACH[t] || 1) * shiftsOf(t) * P.shiftH * 60 * P.oee;
  const kk = !["FABS", "FALG"].includes(r) ? kOf(code) : (REF[br] ? kOf(REF[br]) : 1);
  return { type: t, route: br, op: opno, per, cap, minPerPc: effTime(o, kk) / routeYield(br, opno) * per, n: NMACH[t] || 1, effTime: effTime(o, kk), yieldAfter: routeYield(br, opno) };
}
/* minutes per day the MPS (= forecast / 5) puts on a machine type: every route of the product (sets: component routes × qty), every op on that type, t / yield to the end */
const SETS7 = { FABS: [["BS", 1], ["BN", 1]], FALG: [["LG", 1], ["LB", 2]] };
export function mpsLoad(btype) {
  let s = 0;
  for (const [code, wk] of Object.entries(MD.forecast)) {
    const r = routeOf(code), routes = !SETS7[r] ? [[r, 1, kOf(code)]] : [[r, 1, 1], ...SETS7[r].map(([x, q]) => [x, q, 1])];
    for (const [rr, per, kk] of routes) for (const o of opsOf7(rr)) if (o.m === btype) s += wk / P.weekDays * per * effTime(o, kk) / routeYield(rr, o.no);
  }
  return s;
}

/* ================================================================== configurator */
const f2 = (v) => v.toFixed(2), g = (v) => String(+(+v).toPrecision(12));
export function configure(b = {}) {
  const kind = String(b.kind || "screw").toLowerCase(), C = MD.config, rules = []; let ok = true;
  if (kind === "screw" || kind === "bs") {
    const c = C.bs, d = +(b.d ?? 32) | 0, lead = +(b.lead ?? 10) | 0, L = +(b.length ?? 1000) | 0, gr = String(b.grade || "C5"), pre = String(b.preload || "P1");
    if (!c.d.includes(d)) return { ok: false, rules: [`diameter ${d} not in the family [${c.d.join(", ")}]`] };
    if (!c.lead[String(d)].includes(lead)) { ok = false; rules.push(`lead ${lead} not available for Ø${d} (possible [${c.lead[String(d)].join(", ")}])`); }
    const lmax = Math.min(c.lenMax, c.slender * d);
    if (!(c.lenMin <= L && L <= lmax)) { ok = false; rules.push(`length ${L} outside ${c.lenMin} … ${lmax} mm (slenderness L/d ≤ ${c.slender})`); }
    if (!(gr in c.grade)) return { ok: false, rules: [`grade ${gr} unknown (C3 / C5 / C7)`] };
    if (gr === "C3" && L > c.c3Max) { ok = false; rules.push(`C3 only up to ${c.c3Max} mm (lead measuring + thread grinding limit)`); }
    if (!(pre in c.preload)) return { ok: false, rules: [`preload ${pre} unknown (P0 / P1 / P2)`] };
    const screw = (c.base[d] * c.leadF[lead] + c.perM[d] * L / 1000) * c.grade[gr], nut = c.nut[d] * c.preload[pre];
    const pp = String(lead).padStart(2, "0"), codeS = `BS-${d}${pp}-${L}-${gr}`, codeN = `BN-${d}${pp}-FL`, codeSet = `FABS-${d}${pp}-${L}-${gr}`;
    rules.push(`screw = (${c.base[d]} × ${c.leadF[lead]} + ${c.perM[d]} × ${g(L / 1000)}) × ${c.grade[gr]} = ${f2(screw)} €`);
    rules.push(`nut = ${c.nut[d]} × ${c.preload[pre]} = ${f2(nut)} € · set = screw + nut + ${c.setAdd} € assembly / run-in`);
    return { ok, kind: "screw", code: codeSet, codes: { set: codeSet, screw: codeS, nut: codeN }, variant: `${codeS} / ${codeN} ${pre}`, price: screw + nut + c.setAdd,
      parts: { screw, nut, assembly: c.setAdd }, k: L / 1000, known: !!(MAT[codeSet] || MAT[codeS]), rules };
  }
  const c = C.lg, s = +(b.size ?? 25) | 0, L = +(b.length ?? 1000) | 0, bt = String(b.block || "FL"), pre = String(b.preload || "Z1"), cl = String(b.cls || "H"), nb = +(b.blocks ?? 2) | 0;
  if (!c.size.includes(s)) return { ok: false, rules: [`size ${s} not in the family [${c.size.join(", ")}]`] };
  if (!(bt in c.blockType) || !(pre in c.preload) || !(cl in c.cls)) return { ok: false, rules: ["block FL / NA, preload Z0 / Z1 / Z2, class N / H / P"] };
  if (!(c.lenMin <= L && L <= c.lenMax)) { ok = false; rules.push(`rail length ${L} outside ${c.lenMin} … ${c.lenMax} mm (longer: butt-jointed matched rails)`); }
  const pitch = c.pitch[s];
  if (L % pitch) rules.push(`note: ${L} mm is not a multiple of the hole pitch ${pitch} mm – end distance E = ${g((L % pitch) / 2 + pitch / 2)} mm each side (check E ≥ min.)`);
  if (!(nb >= 1 && nb <= 6)) { ok = false; rules.push("1 … 6 carriages per rail"); }
  const rail = c.rail[s] * L / 1000 * c.cls[cl], blk = c.block[s] * c.blockType[bt] * c.preload[pre] * c.cls[cl];
  const codeR = `LG-${s}-${L}`, codeB = `LB-${s}-${bt}`, codeSet = `FALG-${s}-${L}`;
  rules.push(`rail = ${c.rail[s]} × ${g(L / 1000)} × ${c.cls[cl]} = ${f2(rail)} € · carriage = ${c.block[s]} × ${c.blockType[bt]} × ${c.preload[pre]} × ${c.cls[cl]} = ${f2(blk)} €`);
  return { ok, kind: "guide", code: codeSet, codes: { set: codeSet, rail: codeR, block: codeB }, variant: `${codeR} + ${nb} × ${codeB} ${pre} ${cl}`, price: rail + nb * blk,
    parts: { rail, block: blk, blocks: nb }, k: L / 1000, known: !!(MAT[codeSet] || MAT[codeR]), rules };
}
export function listPrice(code) {
  if (MD.prices[code] != null) return +MD.prices[code];
  const p = prodInfo(code); if (!p) return 0;
  let m = /^(FABS|BS|BN)-(\d\d)(\d\d)(?:-(\d+)-(C\d))?/.exec(code);
  if (m && ["BS", "FABS", "BN"].includes(p.route)) {
    const cf = configure({ kind: "screw", d: +m[2], lead: +m[3], length: +(m[4] || 1000), grade: m[5] || "C5" });
    if (p.route === "BN") return (cf.parts || {}).nut || 0;
    return p.route === "FABS" ? cf.price || 0 : (cf.parts || {}).screw || 0;
  }
  m = /^(FALG|LG|LB)-(\d\d)-(\d+|FL|NA)/.exec(code);
  if (m) { const cf = configure({ kind: "guide", size: +m[2], length: /^\d+$/.test(m[3]) ? +m[3] : 1000 }); if (p.route === "LB") return (cf.parts || {}).block || 0; return p.route === "FALG" ? cf.price || 0 : (cf.parts || {}).rail || 0; }
  return 0;
}
export const aqlPlan = (lot, aql = "1.0") => ({ ...aqlPlan5(lot, aql), aql });

/* ================================================================== deterministic random (= bsfqa_calc rng) + dates (UTC working days) */
export function rng(seed = 7) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export const day0 = (t) => Math.floor(t / 86400);
export const isWork = (d) => ((d + 3) % 7 + 7) % 7 < 5;
export function addWd(d, n) { while (!isWork(d)) d++; while (n > 0) { d++; if (isWork(d)) n--; } return d; }
export function wdBetween(a, b) { let n = 0, d = a; while (d < b) { d++; if (isWork(d)) n++; } return n; }
export const isoDay = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
export const parseDay = (s) => { const t = Date.parse(String(s).slice(0, 10) + "T00:00:00Z"); return Number.isFinite(t) ? Math.floor(t / 86400000) : null; };
export const weekOf = (d, today) => Math.max(0, Math.floor((d - (today - ((today + 3) % 7))) / 7));

/* ================================================================== explosion, BOM tree, finance */
export function explodeBuy(code, factor = 1, out = {}) {
  const [kids, kk] = children(code);
  for (const [child, q] of kids) {
    const c = MAT[child]; if (!c) continue;
    const qq = q * factor * (c.type === "raw" ? kk : 1);
    if (c.proc === "make" || c.proc === "phantom") explodeBuy(child, qq, out); else out[child] = (out[child] || 0) + qq;
  }
  return out;
}
export function bomTree(code, qty = 1, level = 0, out = []) {
  if (level === 0) out.push({ level: 0, material: code, qty: 1.0, uom: MAT[code].uom, proc: MAT[code].proc, type: MAT[code].type, name: MAT[code].n, pos: "" });
  const [kids, kk] = children(code);
  for (const [child, q, pos] of kids) {
    const c = MAT[child]; if (!c) continue;
    const qq = qty * q * (c.type === "raw" ? kk : 1);
    out.push({ level: level + 1, material: child, qty: qq, uom: c.uom, proc: c.proc, type: c.type, name: c.n, pos, price: c.proc === "buy" ? +c.price : null });
    if (c.proc === "make" || c.proc === "phantom") bomTree(child, qq, level + 1, out);
  }
  if (level === 0) { const llc = lowLevelCodes(Object.keys(MAT).filter((m) => !MAT[m].variant)); for (const r of out) r.llc = llc[r.material] || 0; return { material: code, rows: out, levels: Math.max(...out.map((r) => r.level)) }; }
  return out;
}
function matCash(units) { let s = 0; for (const [p, u] of Object.entries(units)) for (const [m, q] of Object.entries(explodeBuy(p))) s += u * q * +MAT[m].price; return s; }
export function finance() {
  const F = MD.fin, mdays = sum(F.monthDays) / 12, mix = Object.entries(F.mix), rows = [];
  let fixedMonthConv = 0; for (const [code, perday] of mix) fixedMonthConv += perday * mdays * costRollup(code).fixed;
  const fixedMach = sum(workcenters().map((R) => (R.dep + R.int + R.space + R.maint) * R.n)) / 12;
  const absorbed = sum(mix.map(([p, q]) => q * mdays * (costRollup(p).roll.fixCash + costRollup(p).roll.fixNonCash)));
  const idle = Math.max(0, fixedMach - absorbed), depInt = sum(workcenters().map((R) => (R.dep + R.int) * R.n)) / 12;
  let cash = F.openingCash;
  F.months.forEach((mname, i) => {
    const units = {}, normal = {}; for (const [p, q] of mix) { units[p] = F.monthDays[i] * q * F.index[i]; normal[p] = F.monthDays[i] * q; }
    const rev = sum(Object.keys(units).map((p) => units[p] * +MD.prices[p])), cogs = sum(Object.keys(units).map((p) => units[p] * costRollup(p).std));
    const volvar = sum(Object.keys(units).map((p) => (normal[p] - units[p]) * costRollup(p).fixed)), gm = rev - cogs - volvar, ebit = gm - idle - F.sgaMonth;
    rows.push({ month: mname, days: F.monthDays[i], units, revenue: rev, cogs, volVar: volvar, gross: gm, idle, sga: F.sgaMonth, ebit, ebitPct: rev ? ebit / rev : 0, material: matCash(units) });
  });
  rows.forEach((r, i) => {
    const rec = i >= F.dso ? rows[i - F.dso].revenue : r.revenue, payMat = i >= F.dpo ? rows[i - F.dpo].material : r.material;
    const other = r.cogs + r.volVar + r.idle + r.sga - r.material - depInt, capex = F.capexMonth[i], net = rec - payMat - other - capex;
    cash += net; Object.assign(r, { receipts: rec, payMaterial: payMat, payOther: other, nonCash: depInt, capex, netCash: net, cash });
  });
  const year = {}; for (const k of ["revenue", "cogs", "volVar", "gross", "idle", "sga", "ebit", "netCash"]) year[k] = sum(rows.map((r) => r[k]));
  return { rows, year, fixedConvMonth: fixedMonthConv, fixedMachMonth: fixedMach, absorbedMonth: absorbed };
}
export function breakeven() {
  const F = MD.fin, days = sum(F.monthDays) / 12; let contrib = 0, rev = 0; const lines = [];
  for (const [p, q] of Object.entries(F.mix)) { const c = costRollup(p), price = +MD.prices[p], cm = price - c.variable; contrib += q * cm; rev += q * price; lines.push({ code: p, perDay: q, price, variable: c.variable, contribution: cm, cmPct: cm / price }); }
  const fixedMach = sum(workcenters().map((R) => (R.dep + R.int + R.space + R.maint) * R.n)) / 12, pohMonth = sum(Object.entries(F.mix).map(([p, q]) => q * days * costRollup(p).roll.poh));
  const fixed = fixedMach + pohMonth + F.sgaMonth, beDays = fixed / contrib;
  return { lines, contribPerDay: contrib, revenuePerDay: rev, fixedMachMonth: fixedMach, pohMonth, sgaMonth: F.sgaMonth, fixedMonth: fixed, beDays, planDays: days, bePct: beDays / days, beRevenueMonth: beDays * rev, safetyMargin: 1 - beDays / days };
}
const okR = (status, data) => ({ status, data, ct: "application/json" });
const probR = (status, title, detail = "", extra = {}) => ({ status, data: { type: "https://plant.example/problems/" + title.replace(/ /g, "-"), title, status, detail, ...extra }, ct: "application/problem+json" });
export function evaluate(b) {
  try {
    const k = b.kind, L = MD.lotExample;
    if (k === "eoq") return okR(200, { Q: eoq(+b.D, +b.S, +b.H) });
    if (k === "rop") { const ss = safetyStock(+b.z, +b.sigma, +b.LT); return okR(200, { SS: ss, ROP: rop(+b.d, +b.LT, ss) }); }
    if (k === "mrp") return okR(200, mrpCheck());
    if (k === "mhr") return okR(200, mhr(String(b.type || "BS-TGR")));
    if (k === "stdcost") { const c = costRollup(matId(b.code) || ""); return c ? okR(200, c) : probR(404, "not a make item", String(b.code)); }
    if (k === "atp") return okR(200, ctpCase(b.case || MD.check.atp));
    if (k === "lot") return okR(200, lotCompare(b.net || L.net, +(b.S || L.S), +(b.H || L.Hweek), +(b.foq || L.FOQ)));
    if (k === "config") return okR(200, configure(b.config || {}));
    if (k === "mav") return okR(200, { avg: mav(+b.q0, +b.p0, +b.q1, +b.p1) });
    if (k === "finance") return okR(200, { pnl: finance(), breakeven: breakeven() });
    if (k === "aql") return okR(200, aqlPlan(+(b.lot || 1000) | 0, String(b.aql || "1.0")));
  } catch (e) { return probR(400, "bad input", String(e.message || e)); }
  return probR(400, "unknown kind", "eoq | rop | mrp | mhr | stdcost | atp | lot | config | mav | finance | aql");
}

/* ================================================================== ERP state + local router (= class ERP in twin/bsf_erp.py) */
export function createERP(opts = {}) {
  const now = opts.now || (() => Date.now() / 1000), fmt = (t) => new Date(t * 1000).toISOString().slice(0, 19) + "Z";
  const E = { S: null, idem: new Map() };
  const today = () => day0(now());
  const nid = (p, w = 5) => { E.S.seq[p] = (E.S.seq[p] || 0) + 1; return `${p}-${String(E.S.seq[p]).padStart(w, "0")}`; };
  const ev = (kind, text, extra = {}) => { const S = E.S; S.seq.ev = (S.seq.ev || 0) + 1; const e = { seq: S.seq.ev, t: now(), at: fmt(now()), kind, text, ...extra }; S.events.push(e); if (S.events.length > 1500) S.events.shift(); return e; };
  function log(dir, method, path, req, status, resp, ms = 0) {
    const S = E.S; S.seq.log = (S.seq.log || 0) + 1; const txt = JSON.stringify(resp) || "";
    S.log.push({ seq: S.seq.log, at: fmt(now()), dir, method, path, req, status, resp: txt.length < 1500 ? resp : { _shortened: txt.slice(0, 1500) + " …" }, ms: r2(ms, 1) });
    if (S.log.length > 400) S.log.shift();
  }
  function mes(method, path, body = null, headers = null) {
    const t0 = performance.now(); let r;
    try { r = opts.mes ? opts.mes(method, path, body, headers) : { status: 503, data: { title: "MES not reachable", detail: "no MES link configured" } }; } catch (e) { r = { status: 503, data: { title: "MES not reachable", detail: String(e.message || e) } }; }
    log("ERP → MES", method, path, body, r.status, r.data, performance.now() - t0); return r;
  }
  const free = (m) => sum(E.S.stock.filter((s) => s.mat === m && s.status === "free").map((s) => s.qty));
  const onhand = (m) => sum(E.S.stock.filter((s) => s.mat === m).map((s) => s.qty));
  function defaultLoc(m) { const s = MD.stock0.find((x) => x[0] === m); if (s) return s[1]; const t = MAT[m].type; return { fg: ["FABS", "FALG"].includes(routeOf(m)) ? "FG-01" : "SM-01", raw: "RM-01", buy: "SM-02", pack: "PK-01", mro: "TS-01" }[t] || "SM-01"; }
  function post(typ, mat, qty, order = "", loc = null, batch = "", status = "free", price = null, text = "") {
    const S = E.S;
    if (typ === "GR") {
      loc = loc || defaultLoc(mat);
      const row = S.stock.find((s) => s.mat === mat && s.loc === loc && s.batch === batch && s.status === status);
      if (row) row.qty += qty; else S.stock.push({ mat, loc, batch, qty: +qty, status });
      if (price != null) { const q0 = onhand(mat) - qty; S.mav[mat] = mav(Math.max(0, q0), S.mav[mat] ?? price, qty, price); }
    } else {
      let left = qty; for (const s of S.stock) if (s.mat === mat && s.status === "free" && s.qty > 0 && left > 0) { const take = Math.min(s.qty, left); s.qty -= take; left -= take; }
      S.stock = S.stock.filter((s) => s.qty > 1e-9);
    }
    const mv = { id: nid("MV"), type: typ, material: mat, qty, order, loc: loc || "", batch, stock: free(mat), t: fmt(now()), value: r2(qty * (S.mav[mat] || 0)), text };
    S.mov.push(mv); if (S.mov.length > 3000) S.mov.shift(); return mv;
  }
  const priceOf = (code, cust) => listPrice(code) * (MD.priceGroups[(CUST[cust] || {}).group || "–"] ?? 1);
  function soNew(cust, lines, dueDay, source = "api") {
    const sid = nid("SO");
    const ls = lines.map((ln, i) => { const p = ln.price != null ? ln.price : priceOf(ln.code, cust); return { pos: 10 * (i + 1), code: ln.code, qty: +ln.qty, price: r2(p), value: r2(p * +ln.qty), config: ln.config || null, confirmed: null, method: "", delivered: 0 }; });
    const so = { id: sid, customer: cust, customerName: (CUST[cust] || {}).n || cust, lines: ls, product: ls[0].code, qty: ls[0].qty, due: isoDay(dueDay), status: "open", created: fmt(now()), createdDay: today(),
      value: r2(sum(ls.map((x) => x.value))), confirmed: null, source, deliveries: [], invoices: [] };
    E.S.so[sid] = so; ev("sales", `${sid} created: ${cust} · ${ls.map((x) => `${g(x.qty)} × ${x.code}`).join(", ")} · ${so.value.toFixed(0)} €`); return so;
  }
  function prodNew(pid, mat, qty, dueDay, source = "api") {
    const p = { id: pid, material: mat, qty: +qty, due: isoDay(dueDay), status: "created", mesWorkOrder: "", lots: [], created: fmt(now()), releasedAt: null, source, good: 0, scrap: 0, grQty: 0, ops: [], issued: {}, conf: [], serials: [], syncedAt: null, settlement: null, push: [] };
    E.S.prod[pid] = p; return p;
  }
  function prodView(p) { const c = costRollup(p.material); return { ...p, materialName: (MAT[p.material] || {}).n || "", stdCost: c ? r2(c.std) : null, stdTotal: c ? r2(c.std * p.qty) : null }; }
  function fresh() {
    const t0 = today();
    E.S = { stock: [], mav: {}, so: {}, qt: {}, dn: {}, inv: {}, pr: {}, po: {}, insp: {}, prod: {}, conf: [], mov: [], ppv: [], settled: [], mrp: null, planned: {}, log: [], events: [], seq: {}, ctp: {}, twin: { orders: 0, stores: null, clock: "" }, day0: t0 };
    const S = E.S;
    for (const m of Object.values(MAT)) S.mav[m.id] = stdPrice(m.id);
    for (const [mat, loc, batch, q] of MD.stock0) S.stock.push({ mat, loc, batch, qty: +q, status: "free" });
    for (const [sup, mat, q, price, wk] of MD.openPurchase) { const pid = nid("PU"); S.po[pid] = { id: pid, supplier: sup, status: "sent", created: fmt(now()), lines: [{ pos: 10, material: mat, qty: +q, price, due: isoDay(addWd(t0, wk * 5)), received: 0 }], sent: { via: SUPP[sup].channel, at: fmt(now()) }, source: "seed" }; }
    for (const [pid, mat, q, wk, wo, st] of MD.openProduction) { const p = prodNew(pid, mat, q, addWd(t0, wk * 5 + 2), "seed"); Object.assign(p, { status: st, mesWorkOrder: st !== "created" ? wo : "", releasedAt: st !== "created" ? fmt(now()) : null }); }
    S.seq.PO = 260003;
    for (const [cust, code, q, wk] of MD.salesSeed) { const so = soNew(cust, [{ code, qty: q }], addWd(t0, wk * 5 + 3), "seed"); so.status = "confirmed"; for (const ln of so.lines) { ln.confirmed = so.due; ln.method = "seed"; } so.confirmed = so.due; }
    seedPipeline();
    ev("system", `ERP initialised: ${Object.keys(MAT).length} materials, ${Object.keys(CUST).length} customers, ${Object.keys(SUPP).length} suppliers (example data)`);
  }

  /* ---------------- sales */
  function atp(code, qty, exclude = null) {
    const t0 = today(), H = 40, fr = free(code), mps = (MD.forecast[code] || 0) / P.weekDays, commit = new Array(H + 1).fill(0);
    for (const so of Object.values(E.S.so)) {
      if (so.id === exclude || so.customer === "C-1000" || ["delivered", "invoiced", "paid", "cancelled", "open"].includes(so.status)) continue;
      for (const ln of so.lines) if (ln.code === code && ln.confirmed && ln.method !== "CTP") { const d = Math.max(0, wdBetween(t0, parseDay(ln.confirmed) ?? t0)); commit[Math.min(H, d)] += ln.qty - ln.delivered; }
    }
    const cum = []; let c = 0; for (let d = 0; d <= H; d++) { c += (d === 0 ? fr : mps) - commit[d]; cum.push(c); }
    const avail = cum.map((_, d) => Math.min(...cum.slice(d)));
    let atpDay = null; for (let d = 0; d <= H; d++) if (avail[d] >= qty - 1e-9) { atpDay = d; break; }
    const steps = [`free stock ${g(fr)}, MPS ${g(mps)} per working day (forecast / 5), committed ${g(sum(commit))} → ATP now ${g(Math.max(0, avail[0]))}`];
    const res = { product: code, qty, today: isoDay(t0), freeStock: fr, mps, atpNow: Math.max(0, avail[0]), atpDays: avail.slice(0, 11).map((x) => r2(x, 1)), atpDay };
    const b = bottleneck(code); let ctp = null;
    if (b) {
      const booked = E.S.ctp[b.type] || {}, base = mpsLoad(b.type);
      const fm = Array.from({ length: H }, (_, d) => Math.max(0, b.cap - base - (booked[String(addWd(t0, d))] || 0)));
      let up = P.atp.upstreamDays, rawNeed = 0, rawFree = 0, rawMat = "";
      for (const [m, q] of Object.entries(explodeBuy(code))) if (MAT[m].type === "raw") { rawMat = m; rawNeed = q * Math.max(0, qty - Math.max(0, avail[0])); rawFree = free(m); if (rawNeed > rawFree) up = Math.max(up, MAT[m].lt); break; }
      ctp = ctpCase({ q: qty, free: Math.max(0, avail[0]), minPerPc: b.minPerPc, freeMin: fm, upstream: up, after: P.atp.afterDays, ship: P.shipDays });
      Object.assign(ctp, { bottleneck: b.type, machines: b.n, capMin: b.cap, mpsLoadMin: base, freeMinDay0: fm[0], upstream: up, route: routeOf(code), raw: rawMat, rawNeed, rawFree });
      steps.push(`CTP: ${g(ctp.rem)} pcs × ${b.minPerPc.toFixed(2)} min = ${ctp.need.toFixed(0)} min on ${b.type} (${b.n} machines, capacity ${b.cap.toFixed(0)} min/day, MPS load ${base.toFixed(0)}, free ≈ ${fm[0].toFixed(0)} min/day)` +
        (rawNeed > rawFree ? `; raw ${rawMat} short (${g(rawFree)} < ${g(rawNeed)}) → start after ${up} days` : `; start after ${up} days (soft + heat treatment)`));
    }
    const cands = []; if (atpDay != null) cands.push([atpDay + P.shipDays, "ATP"]); if (ctp && ctp.promiseDay != null) cands.push([ctp.promiseDay, "CTP"]);
    if (!cands.length) return { ...res, ok: false, ctp, steps: [...steps, "no date in the horizon of 40 working days – ask planning"], method: "none" };
    cands.sort((a, b2) => a[0] - b2[0] || (a[1] < b2[1] ? -1 : 1));
    const [pd, meth] = cands[0];
    steps.push(`promise = working day +${pd} (${meth}) = ${isoDay(addWd(t0, pd))}`);
    return { ...res, ok: true, ctp, promiseDay: pd, promiseDate: isoDay(addWd(t0, pd)), method: meth, steps };
  }
  function confirmSo(so) {
    if (!["open", "confirmed"].includes(so.status)) return probR(409, "wrong state", `${so.id} is '${so.status}'`);
    const out = []; let last = today();
    for (const ln of so.lines) {
      const a = atp(ln.code, ln.qty - ln.delivered, so.id);
      if (!a.ok) return probR(422, "no delivery date", a.steps.join("; "), { atp: a });
      ln.confirmed = a.promiseDate; ln.method = a.method;
      if (a.method === "CTP" && a.ctp) { const bk = E.S.ctp[a.ctp.bottleneck] = E.S.ctp[a.ctp.bottleneck] || {}; for (const [d, m] of a.ctp.used) { const k = String(addWd(today(), d)); bk[k] = (bk[k] || 0) + m; } }
      last = Math.max(last, parseDay(a.promiseDate)); out.push(a);
    }
    so.confirmed = isoDay(last); so.status = "confirmed";
    so.ack = { text: `Order confirmation ${so.id}: we deliver ${so.lines.map((x) => `${g(x.qty)} × ${x.code} on ${x.confirmed} (${x.method})`).join("; ")}. Total ${so.value.toFixed(2)} € net, terms ${(CUST[so.customer] || {}).terms ?? 30} days.`, at: fmt(now()) };
    ev("sales", `${so.id} confirmed for ${so.confirmed} (${so.lines.map((x) => x.method).join(", ")})`);
    return okR(200, { ...so, atp: out });
  }
  function deliver(so) {
    if (!["confirmed", "open", "ready"].includes(so.status)) return probR(409, "wrong state", `${so.id} is '${so.status}'`);
    for (const ln of so.lines) { const need = ln.qty - ln.delivered; if (free(ln.code) < need - 1e-9) return probR(409, "not enough stock", `${ln.code}: free ${g(free(ln.code))} < ${g(need)} – produce first (MRP / production order)`); }
    const dn = { id: nid("DN"), so: so.id, customer: so.customer, lines: [], at: fmt(now()), day: today() };
    for (const ln of so.lines) { const need = ln.qty - ln.delivered; post("GI", ln.code, need, so.id, null, "", "free", null, "delivery " + dn.id); ln.delivered += need; dn.lines.push({ code: ln.code, qty: need }); }
    dn.onTime = today() <= (parseDay(so.confirmed || so.due) ?? today());
    E.S.dn[dn.id] = dn; so.status = "delivered"; so.deliveries.push(dn.id);
    ev("sales", `${dn.id} delivered ${so.id} (${dn.onTime ? "on time" : "LATE"})`); return okR(201, dn);
  }
  function invoice(so) {
    if (so.status !== "delivered") return probR(409, "wrong state", `${so.id} is '${so.status}' – deliver first`);
    const net = sum(so.lines.map((l) => l.value)), terms = (CUST[so.customer] || {}).terms ?? 30;
    const inv = { id: nid("INV"), so: so.id, customer: so.customer, net: r2(net), vatRate: P.vat, vat: r2(net * P.vat), gross: r2(net * (1 + P.vat)), date: isoDay(today()), due: isoDay(today() + terms), status: "open" };
    E.S.inv[inv.id] = inv; so.status = "invoiced"; so.invoices.push(inv.id);
    ev("finance", `${inv.id} for ${so.id}: ${inv.gross.toFixed(2)} € gross, due ${inv.due}`); return okR(201, inv);
  }

  /* ---------------- MRP */
  function mrpInputs(H) {
    const t0 = today(), items = {}, indep = {};
    for (const m of Object.values(MAT)) {
      if (m.type === "mro" || m.variant) continue;
      const ltw = m.proc !== "phantom" ? Math.ceil(m.lt / P.weekDays) : 0, price = stdPrice(m.id) || 1;
      const S_ = m.proc === "make" ? sum(opsOf7(routeOf(m.id)).map((o) => o.setup / 60 * mhr(o.m).rate)) : P.orderCost;
      items[m.id] = { oh: free(m.id), ss: m.ss, lt: ltw, lot: m.lot, q: m.lotQ, sr: new Array(H).fill(0), S: S_, Hw: P.holdRate * price / 50, phantom: m.proc === "phantom", name: m.n, uom: m.uom, proc: m.proc, type: m.type };
    }
    for (const po of Object.values(E.S.po)) { if (["cancelled", "closed"].includes(po.status)) continue; for (const ln of po.lines) { const rest = ln.qty - ln.received; if (rest > 0 && items[ln.material]) items[ln.material].sr[Math.min(H - 1, weekOf(parseDay(ln.due) ?? t0, t0))] += rest; } }
    for (const p of Object.values(E.S.prod)) { if (["done", "settled", "cancelled"].includes(p.status) || !items[p.material]) continue; const rest = p.qty - p.good; if (rest > 0) items[p.material].sr[Math.min(H - 1, weekOf(parseDay(p.due) ?? t0, t0))] += rest; }
    const firm = {};
    for (const so of Object.values(E.S.so)) {
      if (so.customer === "C-1000" || ["delivered", "invoiced", "paid", "cancelled"].includes(so.status)) continue;
      for (const ln of so.lines) if (items[ln.code]) { (firm[ln.code] = firm[ln.code] || new Array(H).fill(0))[Math.min(H - 1, weekOf(parseDay(ln.confirmed || so.due) ?? t0, t0))] += ln.qty - ln.delivered; }
    }
    const wd = (t0 + 3) % 7, rest0 = wd < 5 ? Math.max(0, 5 - wd) / 5 : 0;      // week 0: only the remaining working days of this week (past forecast is consumed)
    for (const code of Object.keys(items)) { const fc = MD.forecast[code] || 0, f = firm[code] || new Array(H).fill(0); indep[code] = Array.from({ length: H }, (_, t) => Math.max(fc * (t === 0 ? rest0 : 1), f[t])); }
    return [items, indep];
  }
  function seedPipeline() {
    /* a running plant already has open orders for the cumulative lead time: every planned order whose release would lie in the past becomes an open order (seed) */
    const t0 = today(), mon = t0 - ((t0 + 3) % 7);
    for (let it = 0; it < 12; it++) {      // level by level: the parents' new receipts change the children's gross requirements
      const [items, indep] = mrpInputs(P.horizon), res = mrp(items, indep, P.horizon); let n = 0;
      const lv = Object.entries(res).filter(([i, r]) => !items[i].phantom && r.exceptions.some((x) => x.planned)).map(([, r]) => r.llc), lmin = lv.length ? Math.min(...lv) : -1;
      for (const [i, r] of Object.entries(res)) {
        if (items[i].phantom || r.llc !== lmin) continue;
        for (const x of r.exceptions) {
          if (!x.planned) continue; n++;
          const due = Math.max(t0, mon + 7 * x.bucket + 4);
          if (items[i].proc === "make") { const p = prodNew(nid("PO", 6), i, x.qty, due, "pipeline (seed)"); p.status = "released"; p.releasedAt = fmt(now()); }
          else { const pid = nid("PU"), sup = MAT[i].sup; E.S.po[pid] = { id: pid, supplier: sup, status: "sent", created: fmt(now()), lines: [{ pos: 10, material: i, qty: x.qty, price: +MAT[i].price, due: isoDay(due), received: 0 }], sent: { via: SUPP[sup].channel, at: fmt(now()) }, source: "pipeline (seed)" }; }
        }
      }
      if (!n) break;
    }
  }
  function runMrp(Hin) {
    let H = +(Hin || P.horizon) | 0; H = Math.max(4, Math.min(26, H));
    const [items, indep] = mrpInputs(H), res = mrp(items, indep, H), planned = [], exc = [];
    E.S.seq.PL = 0; const mon = today() - ((today() + 3) % 7);
    for (const [i, r] of Object.entries(res)) {
      const it = items[i];
      Object.assign(r, { name: it.name, uom: it.uom, proc: it.proc, type: it.type, oh: it.oh, ss: it.ss, lt: it.lt, lot: it.lot, q: it.q, indep: indep[i] });
      for (const x of r.exceptions) exc.push({ item: i, ...x });
      if (it.phantom) continue;
      for (let t = 0; t < H; t++) { const q = r.prl[t]; if (q > 1e-9) planned.push({ id: nid("PL"), item: i, qty: r2(q, 3), release: t, due: t + it.lt, releaseDate: isoDay(Math.max(today(), mon + 7 * t)), dueDate: isoDay(mon + 7 * (t + it.lt) + 4), kind: it.proc === "make" ? "production" : "purchase", status: "planned" }); }
    }
    // same order as Python (dict insertion = MRP processing order)
    E.S.planned = Object.fromEntries(planned.map((p) => [p.id, p]));
    E.S.mrp = { at: fmt(now()), H, weekStart: isoDay(mon), items: res, planned: planned.map((p) => p.id), exceptions: exc };
    ev("mrp", `MRP run: ${Object.keys(res).length} items, ${planned.length} planned orders, ${exc.length} exception messages`);
    const summary = {}; for (const i of Object.keys(res).slice(0, 60)) { const r = res[i]; summary[i] = { llc: r.llc, gross: r.gross, sr: r.sr, poh: r.poh, net: r.net, prc: r.prc, prl: r.prl }; }
    return { at: E.S.mrp.at, H, weekStart: isoDay(mon), items: Object.keys(res).length, planned, exceptions: exc, summary };
  }
  function convert(pl) {
    if (pl.status !== "planned") return probR(409, "wrong state", `${pl.id} is '${pl.status}'`);
    if (pl.kind === "purchase") {
      const pr = { id: nid("PR"), material: pl.item, qty: pl.qty, need: pl.dueDate, supplier: MAT[pl.item].sup, from: pl.id, status: "open", created: fmt(now()) };
      E.S.pr[pr.id] = pr; pl.status = "converted"; pl.to = pr.id; ev("purchasing", `${pl.id} → requisition ${pr.id}: ${g(pr.qty)} ${pl.item}`); return okR(201, pr);
    }
    const p = prodNew(nid("PO", 6), pl.item, pl.qty, parseDay(pl.dueDate), "MRP " + pl.id);
    pl.status = "converted"; pl.to = p.id; ev("production", `${pl.id} → production order ${p.id}: ${g(p.qty)} ${p.material}`); return okR(201, prodView(p));
  }

  /* ---------------- purchasing + inventory */
  function poCreate(b) {
    let sup, lines, pr = null;
    if (b.requisition) {
      pr = E.S.pr[b.requisition]; if (!pr) return probR(404, "unknown requisition", String(b.requisition));
      if (pr.status !== "open") return probR(409, "wrong state", `${pr.id} is '${pr.status}'`);
      sup = pr.supplier; lines = [{ material: pr.material, qty: pr.qty, due: pr.need }];
    } else { sup = b.supplier; lines = b.lines || (b.material ? [{ material: b.material, qty: b.qty }] : []); }
    if (!SUPP[sup]) return probR(400, "unknown supplier", String(sup));
    if (!lines.length) return probR(400, "lines needed", "[{material, qty, price?, due?}]");
    const ls = [];
    for (const [i, ln] of lines.entries()) {
      const m = matId(ln.material); if (!m || MAT[m].proc !== "buy") return probR(400, "unknown purchased material", String(ln.material));
      const q = +ln.qty || 0; if (q <= 0) return probR(422, "quantity must be > 0");
      ls.push({ pos: 10 * (i + 1), material: m, qty: q, price: +(ln.price || MAT[m].price), due: ln.due || isoDay(addWd(today(), MAT[m].lt)), received: 0 });
    }
    const po = { id: nid("PU"), supplier: sup, status: "created", created: fmt(now()), lines: ls, sent: null, source: pr ? pr.id : "api", value: r2(sum(ls.map((x) => x.qty * x.price))) };
    E.S.po[po.id] = po; if (pr) { pr.status = "ordered"; pr.po = po.id; }
    ev("purchasing", `${po.id} created for ${sup}: ${ls.map((x) => `${g(x.qty)} ${x.material}`).join(", ")}`); return okR(201, po);
  }
  function poSend(po) {
    if (!["created", "sent"].includes(po.status)) return probR(409, "wrong state", `${po.id} is '${po.status}'`);
    const sup = SUPP[po.supplier];
    const msg = { orderNumber: po.id, buyer: "Ball screw + guide factory (example)", supplier: po.supplier, currency: "EUR", incoterm: "FCA",
      lines: po.lines.map((x) => ({ pos: x.pos, material: x.material, text: MAT[x.material].n, qty: x.qty, uom: MAT[x.material].uom, price: x.price, due: x.due })),
      certificate: po.lines.some((x) => MAT[x.material].type === "raw") ? "EN 10204 3.1" : "", deliveryAddress: "Goods-in gate 1 (example)" };
    const http = sup.channel.includes("portal") || sup.channel.includes("HTTP");
    po.sent = { via: sup.channel, at: fmt(now()), http, message: msg, note: http ? "POST https://portal.supplier.example/api/orders (JSON over HTTPS)" : "PDF by e-mail (the supplier has no portal) – the ERP still keeps the JSON" };
    po.status = "sent";
    log("ERP → supplier", http ? "POST" : "MAIL", http ? "/api/orders (supplier portal)" : "e-mail PDF", msg, http ? 202 : 0, http ? { accepted: true, supplierRef: "SR-" + po.id.slice(3) } : { note: "e-mail queued" });
    ev("purchasing", `${po.id} sent to ${po.supplier} via ${sup.channel}`); return okR(200, po);
  }
  function goodsReceipt(b) {
    const po = E.S.po[b.po]; if (!po) return probR(404, "unknown purchase order", String(b.po));
    const mat = b.material ? matId(b.material) : null, ln = po.lines.find((x) => (!mat || x.material === mat) && x.qty - x.received > 1e-9);
    if (!ln) return probR(409, "nothing open", `${po.id}: all lines received`);
    const q = +(b.qty || (ln.qty - ln.received));
    if (q <= 0 || q > (ln.qty - ln.received) * 1.1 + 1e-9) return probR(422, "quantity", `1 … ${g(ln.qty - ln.received)} (+10 % tolerance)`);
    const m = MAT[ln.material], batch = String(b.batch || ((m.type === "raw" ? "H" : "L") + String(8000 + (E.S.seq.GR || 0) + 1)));
    const gr = { id: nid("GR"), po: po.id, pos: ln.pos, material: ln.material, qty: q, batch, at: fmt(now()) };
    const mv = post("GR", ln.material, q, po.id, "QI-01", batch, "blocked", ln.price, "goods receipt " + gr.id);
    ln.received += q; po.status = po.lines.every((x) => x.received >= x.qty - 1e-9) ? "received" : "partly received";
    const std = +m.price, ppv = { gr: gr.id, po: po.id, material: ln.material, qty: q, price: ln.price, std, ppv: r2((ln.price - std) * q) };
    E.S.ppv.push(ppv);
    let plan;
    if (m.type === "raw") plan = { letter: "–", n: 1, ac: 0, re: 1, aql: "cert", text: "check the EN 10204 3.1 certificate (chemistry, heat no.) + 1 hardness / chemistry sample per heat" };
    else { plan = aqlPlan(q | 0, "1.0"); plan.text = `ISO 2859-1 normal, level II, AQL 1.0: lot ${g(q)} → code ${plan.letter} → sample n = ${plan.n}, accept ≤ ${plan.ac}, reject ≥ ${plan.re} (item 5 sampling)`; }
    const il = { id: nid("IL"), gr: gr.id, po: po.id, material: ln.material, qty: q, batch, plan, status: "open", decision: null, at: fmt(now()) };
    E.S.insp[il.id] = il; Object.assign(gr, { inspection: il.id, movement: mv.id, ppv: ppv.ppv });
    ev("stores", `${gr.id}: ${g(q)} ${ln.material} batch ${batch} → blocked stock QI-01, inspection ${il.id} (n = ${plan.n})`); return okR(201, gr);
  }
  function decide(il, b) {
    if (il.status !== "open") return probR(409, "wrong state", `${il.id} is '${il.status}'`);
    let d = String(b.decision || "").toLowerCase(); const defects = +b.defects | 0;
    if (!["accept", "reject"].includes(d)) d = defects <= il.plan.ac ? "accept" : "reject";
    const row = E.S.stock.find((s) => s.mat === il.material && s.batch === il.batch && s.status === "blocked"), q = row ? Math.min(il.qty, row.qty) : 0;
    if (row) row.qty -= q; E.S.stock = E.S.stock.filter((s) => s.qty > 1e-9);
    if (d === "accept") {
      const loc = defaultLoc(il.material), row2 = E.S.stock.find((s) => s.mat === il.material && s.loc === loc && s.batch === il.batch && s.status === "free");
      if (row2) row2.qty += q; else E.S.stock.push({ mat: il.material, loc, batch: il.batch, qty: q, status: "free" });
      post("TR", il.material, 0, il.id, null, "", "free", null, `release ${g(q)} from QI-01 to ${loc}`);
    } else post("RET", il.material, q, il.po, null, "", "free", null, "returned to the supplier (rejected)");
    Object.assign(il, { status: "done", decision: d, defects, by: String(b.by || "quality") });
    ev("quality", `${il.id} ${il.material} batch ${il.batch}: ${d.toUpperCase()} (${defects} defects, Ac ${il.plan.ac})`); return okR(200, il);
  }
  function goodsMovement(b) {
    const t = b.type, mat = matId(b.material), qty = +b.qty || 0;
    if (!["GI", "GR"].includes(t)) return probR(400, "type must be GI (goods issue) or GR (goods receipt)");
    if (!mat) return probR(404, "unknown material", String(b.material));
    if (qty <= 0) return probR(422, "quantity must be > 0");
    if (t === "GI" && free(mat) < qty - 1e-9) return probR(409, "not enough stock", `${mat}: ${g(free(mat))} < ${g(qty)}`);
    const order = String(b.order || "");
    const mv = post(t, mat, qty, order, null, String(b.batch || (t === "GR" ? order : "")), "free", t === "GR" ? stdPrice(mat) : null, String(b.text || ""));
    if (t === "GR" && order) {
      const p = Object.values(E.S.prod).find((x) => x.mesWorkOrder === order || x.id === order); if (p) { p.grQty += qty; mv.productionOrder = p.id; }
      if (order.startsWith("WO-")) log("MES → ERP", "POST", "/api/bsf/erp/goodsmovements", b, 201, { id: mv.id, stock: mv.stock });
    }
    return okR(201, mv);
  }

  /* ---------------- production orders ↔ MES */
  function release(pid, b) {
    let p = E.S.prod[pid];
    if (!p) {
      const mat = matId(b.product || b.material);
      if (!mat || MAT[mat].proc !== "make") return probR(400, "unknown product", "product = BS | BN | LG | LB | FABS | FALG or a make material code");
      const q = (+(b.qty || 20)) | 0; if (q <= 0) return probR(422, "quantity must be > 0");
      p = prodNew(pid, mat, q, addWd(today(), +(b.dueDays || 5) | 0), "api (item 4 compatible)");
    }
    if (p.status !== "created") return probR(409, "wrong state", `${pid} is '${p.status}', only 'created' can be released (MES work order ${p.mesWorkOrder})`);
    const l = mes("GET", "/api/bsf/mes/workorders?size=200");
    let r2_;
    if (l.status >= 500 || l.status === 0) r2_ = l;
    else {
      const w = ((l.data || {}).items || []).find((x) => x.erpOrder === pid && x.status !== "cancelled");
      if (w && w.status === "created") r2_ = mes("POST", `/api/bsf/mes/workorders/${w.id}/release`, { force: true }, { "Idempotency-Key": `erp-rel-${pid}` });
      else if (w) r2_ = mes("GET", `/api/bsf/mes/workorders/${w.id}`);
      else r2_ = mes("POST", "/api/bsf/mes/workorders", { product: p.material, qty: Math.round(p.qty), due: p.due + "T14:00:00Z", erpOrder: pid, priority: 5, release: true }, { "Idempotency-Key": `erp-rel-${pid}` });
    }
    const st2 = r2_.status, d2 = r2_.data || {};
    if (st2 >= 500 || st2 === 0) { ev("production", `${pid}: MES not reachable – order stays 'created' (retry later)`); return probR(503, "MES not reachable", (d2.detail || "") + " – the production order stays 'created'; retry with the same Idempotency-Key"); }
    if (![200, 201].includes(st2)) return { status: st2, data: { ...d2, productionOrder: pid }, ct: "application/problem+json" };
    Object.assign(p, { status: "released", mesWorkOrder: d2.id, lots: d2.lots || [], releasedAt: fmt(now()) });
    ev("production", `${pid} released → MES work order ${d2.id} (${(d2.lots || []).length} lots, status ${d2.status})`);
    return okR(201, { productionOrder: pid, status: d2.status, mesWorkOrder: d2.id, lots: d2.lots || [], order: prodView(p) });
  }
  function sync(p) {
    const w0 = mes("GET", `/api/bsf/mes/workorders/${p.mesWorkOrder}`);
    if (w0.status !== 200) return probR(w0.status >= 500 ? 503 : w0.status, "MES answer", (w0.data || {}).detail || "");
    const w = w0.data, cf = mes("GET", "/api/bsf/mes/confirmations?n=5000"), confs = cf.status === 200 ? (cf.data.items || []).filter((c) => c.wo === p.mesWorkOrder) : [];
    let sers = []; const main = (w.lines || []).filter((x) => x.route === w.route);
    for (const lid of (main[0] ? main[0].lots : []).slice(0, 4)) { const s3 = mes("GET", `/api/bsf/mes/serials?lot=${lid}&n=200`); if (s3.status === 200) sers = sers.concat((s3.data.items || []).map((x) => x.sn)); }
    const k = kOf(p.material), ops = [];
    for (const o of w.operations || []) {
      const act = sum(confs.filter((c) => c.op === o.op && String(c.lot || "").split("-").slice(-2, -1)[0] === o.route).map((c) => (+c.setupMin || 0) + (+c.runMin || 0)));
      const ro = opsOf7(o.route).find((x) => x.no === o.op), t = ro ? effTime(ro, o.route === routeOf(p.material) ? k : 1) : 0, stdmin = t * (o.good + o.scrap) / P.oee;
      ops.push({ ...o, stdMin: r2(stdmin, 1), actMin: r2(act > 0 ? act : stdmin, 1), actualFromMes: act > 0 });
    }
    p.ops = ops; p.good = +(w.good || 0); p.scrap = sum(ops.map((o) => o.scrap));
    p.conf = confs.map((c) => ({ id: c.id, lot: c.lot, op: c.op, machine: c.machine, good: c.good, scrap: c.scrap, setupMin: c.setupMin, runMin: c.runMin, at: c.at })).slice(-60);
    p.serials = sers.slice(0, 200); p.syncedAt = fmt(now());
    if (w.status === "done") p.status = "done"; else if (["running", "released"].includes(w.status) && p.status === "released") p.status = w.status === "running" ? "running" : "released";
    const posted = [];
    const rmain = routeOf(p.material), SETS7 = { FABS: ["BS", "BN"], FALG: ["LG", "LB"] };
    for (const [m, q] of Object.entries(explodeBuy(p.material))) {
      let target;
      if (MAT[m].type === "raw") {      // raw = pieces STARTED at the first operation of the route that uses this bar / profile
        const r = !SETS7[rmain] ? rmain : (SETS7[rmain].find((x) => explodeBuy(REF[x])[m] != null) || rmain), per = r === rmain ? q : explodeBuy(REF[r])[m], first = ops.find((o) => o.route === r);
        target = per * (first ? first.good + first.scrap : 0);
      } else target = q * p.good;
      const delta = target - (p.issued[m] || 0);
      if (delta > 1e-9) {
        const take = Math.min(delta, free(m));
        if (take > 1e-9) { post("GI", m, take, p.id, null, "", "free", null, "backflush from MES confirmations"); p.issued[m] = (p.issued[m] || 0) + take; posted.push([m, r2(take, 3)]); }
        if (take < delta - 1e-9) posted.push([m, "short " + r2(delta - take, 3)]);
      }
    }
    ev("production", `${p.id} synced from MES ${p.mesWorkOrder}: good ${g(p.good)}, scrap ${g(p.scrap)}, ${confs.length} confirmations, backflush ${posted.length} lines`);
    return okR(200, { ...prodView(p), backflush: posted });
  }
  function confirmPush(b) {
    const pid = b.erpOrder || "", p = E.S.prod[pid] || Object.values(E.S.prod).find((x) => x.mesWorkOrder && x.mesWorkOrder === b.mesWorkOrder);
    if (!p) return probR(404, "unknown production order", String(pid || b.mesWorkOrder));
    const gd = +(b.good || 0), sc = +(b.scrap || 0);
    if (!Number.isFinite(gd) || !Number.isFinite(sc)) return probR(400, "good / scrap must be numbers");
    if (gd < 0 || sc < 0) return probR(400, "negative quantity");
    const c = { id: nid("CO"), order: p.id, op: String(b.op || ""), good: gd, scrap: sc, setupMin: +(b.setupMin || 0), runMin: +(b.runMin || 0), serials: (b.serials || []).slice(0, 200), final: !!b.final, at: fmt(now()) };
    p.push.push(c); E.S.conf.push(c);
    if (c.final) { p.good += gd; p.scrap += sc; p.serials = p.serials.concat(c.serials); }
    if (p.status === "released") p.status = "running";
    log("MES → ERP", "POST", "/api/bsf/erp/confirmations", b, 201, { id: c.id });
    ev("production", `confirmation ${c.id} for ${p.id} op ${c.op}: ${g(gd)} good / ${g(sc)} scrap`); return okR(201, c);
  }
  function settle(p, force = false) {
    if (p.status !== "done" && !force) return probR(409, "wrong state", `${p.id} is '${p.status}' – settle after the MES reports 'done' (or force)`);
    const c = costRollup(p.material), good = p.good, stdTotal = good * c.std; let qv = 0; const lines = [];
    for (const [m, q] of Object.entries(explodeBuy(p.material))) { const stdq = q * good, act = p.issued[m] || 0, v = (act - stdq) * +MAT[m].price; qv += v; if (Math.abs(v) > 0.005) lines.push({ material: m, stdQty: r2(stdq, 3), actQty: r2(act, 3), variance: r2(v) }); }
    let evv = 0, sv = 0;
    for (const o of p.ops) {
      const R = mhr(o.machineType); if (!R) continue;
      evv += (o.actMin - o.stdMin) / 60 * (R.rate + R.labourRate);
      const rc = REF[o.route] ? costRollup(REF[o.route]) : null;
      if (rc && o.scrap) { const x = rc.ops.find((y) => y.no === o.op); sv += o.scrap * (x ? x.cumConv : 0); }
    }
    const total = qv + evv + sv;
    const st = { order: p.id, material: p.material, good, stdCost: r2(c.std), stdTotal: r2(stdTotal), qtyVariance: r2(qv), efficiencyVariance: r2(evv), scrapVariance: r2(sv), totalVariance: r2(total),
      actualTotal: r2(stdTotal + total), actualPerPc: good ? r2((stdTotal + total) / good) : null, materialLines: lines, at: fmt(now()),
      note: "material at standard price (price variance = PPV at goods receipt) · conversion at machine hour rate + labour · scrap at the cumulative std value of the op" };
    p.settlement = st; p.status = "settled"; E.S.settled.push(st);
    ev("finance", `${p.id} settled: std ${stdTotal.toFixed(2)} €, variance ${total >= 0 ? "+" : ""}${total.toFixed(2)} €`); return okR(200, st);
  }

  /* ---------------- analysis */
  function annualUse() { const use = {}; for (const [code, wk] of Object.entries(MD.forecast)) for (const [m, q] of Object.entries(explodeBuy(code))) use[m] = (use[m] || 0) + wk * 50 * q; for (const [m, d] of Object.entries(MD.mroDay)) use[m] = (use[m] || 0) + d * P.days; return use; }
  function abc() {
    const rows = Object.entries(annualUse()).map(([m, q]) => ({ material: m, name: MAT[m].n, type: MAT[m].type, annualQty: r2(q, 1), price: +MAT[m].price, value: r2(q * +MAT[m].price) }));
    rows.sort((a, b) => b.value - a.value);
    const tot = sum(rows.map((r) => r.value)) || 1; let cum = 0;
    rows.forEach((r, i) => {
      cum += r.value; r.cumPct = r2(cum / tot, 4); r.abc = cum / tot <= 0.80 + 1e-9 || i === 0 ? "A" : cum / tot <= 0.95 + 1e-9 ? "B" : "C";
      const d = r.annualQty / P.days, sg = MD.sigmaDay[r.material], cv = sg != null && d > 0 ? sg / d : 0.15;
      r.cv = r2(cv, 3); r.xyz = cv < 0.25 ? "X" : cv < 0.5 ? "Y" : "Z";
      const lt = MAT[r.material].lt; if (sg != null) { const ss = safetyStock(1.65, sg, lt); Object.assign(r, { dDay: r2(d, 2), sigmaDay: sg, LT: lt, SS: r2(ss, 1), ROP: r2(rop(d, lt, ss), 1) }); }
    });
    return { items: rows, total: r2(tot), rule: "A = first 80 % of the value, B = next 15 %, C = last 5 % · X: CV < 0.25, Y: < 0.5, Z: ≥ 0.5 · SS = z·σ·√LT (z 1.65 = 95 %), ROP = d·LT + SS" };
  }
  const planCogs = () => sum(Object.entries(MD.forecast).map(([c, wk]) => wk * 50 * costRollup(c).std));
  function valuation() {
    const per = {}; for (const s of E.S.stock) per[s.mat] = (per[s.mat] || 0) + s.qty;
    const rows = [], byType = {}; let totM = 0, totS = 0;
    for (const [m, q] of Object.entries(per)) { const mv = E.S.mav[m] || 0, std = stdPrice(m); rows.push({ material: m, type: MAT[m].type, qty: r2(q, 3), mav: r2(mv, 4), std: r2(std, 4), valueMav: r2(q * mv), valueStd: r2(q * std) }); totM += q * mv; totS += q * std; byType[MAT[m].type] = (byType[MAT[m].type] || 0) + q * mv; }
    const cogs = planCogs();
    return { items: rows, totalMav: r2(totM), totalStd: r2(totS), byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, r2(v)])), cogsYear: r2(cogs), turns: totM ? r2(cogs / totM, 2) : null, daysOfSupply: cogs ? r2(totM / (cogs / P.days), 1) : null };
  }
  const ts = (s) => { const t = Date.parse(String(s)); return Number.isFinite(t) ? t / 1000 : 0; };
  function kpi() {
    const S = E.S, t = now(), real = Object.values(S.so).filter((so) => so.customer !== "C-1000");
    const intake30 = sum(real.filter((so) => t - ts(so.created) <= 30 * 86400).map((so) => so.value));
    const backlog = sum(Object.values(S.so).filter((so) => ["open", "confirmed", "in production", "ready"].includes(so.status)).map((so) => so.value));
    const dns = Object.values(S.dn), tw = Object.values(S.so).filter((so) => so.customer === "C-1000" && so.onTime != null);
    const nOt = dns.filter((d) => d.onTime).length + tw.filter((so) => so.onTime).length, nAll = dns.length + tw.length, val = valuation();
    const rev = sum(Object.entries(MD.forecast).map(([c, wk]) => wk * 50 * listPrice(c))), full = sum(Object.entries(MD.forecast).map(([c, wk]) => wk * 50 * costRollup(c).full));
    const load = {};
    for (const r of ["FABS", "BN", "LG", "FALG"]) { const b = bottleneck(REF[r]); if (load[b.type] != null) continue; const bk = S.ctp[b.type] || {}; let nx = 0; for (let d = 0; d < 10; d++) nx += bk[String(addWd(today(), d))] || 0; load[b.type] = r2((mpsLoad(b.type) + nx / 10) / b.cap, 4); }
    const U = rng(17), weekRev = rev / 50, trend = [];
    for (let i = 0; i < 12; i++) { const u1 = U(), u2 = U(), u3 = U(); trend.push({ week: i - 11, intake: r2(weekRev * (0.88 + 0.24 * u1)), delivered: r2(weekRev * (0.9 + 0.18 * u2)), otd: r2(0.86 + 0.12 * u3, 3), inventory: r2(val.totalMav * (0.92 + 0.16 * U())), loadTGR: r2(Math.min(1.05, (load["BS-TGR"] ?? 0.95) * (0.93 + 0.1 * U())), 3) }); }
    Object.assign(trend[11], { intake: r2(Math.max(trend[11].intake, intake30 / 4.3)), inventory: val.totalMav });
    return { intake30: r2(intake30), backlog: r2(backlog), otd: nAll ? r2(nOt / nAll, 4) : null, otdCount: [nOt, nAll], inventory: val.totalMav, turns: val.turns, marginPlan: rev ? r2((rev - full) / rev, 4) : null, revenuePlan: r2(rev), load, trend,
      openSO: real.filter((so) => ["open", "confirmed"].includes(so.status)).length, openPO: Object.values(S.po).filter((p) => ["created", "sent", "partly received"].includes(p.status)).length,
      prodOpen: Object.values(S.prod).filter((p) => ["created", "released", "running"].includes(p.status)).length };
  }
  function twinFeed(b) {
    let n = 0; const price = { FABS: listPrice("FABS-3210-1000-C5"), FALG: listPrice("FALG-25-1000") };
    for (const o of (b.orders || []).slice(-80)) {
      const sid = "SO-T" + String(o.id).replace(/\D/g, "").padStart(4, "0"), code = matId(o.product) || matId(o.code); if (!code) continue;
      const st = { open: "in production", complete: "ready", shipped: "delivered" }[o.state] || "in production";
      let so = E.S.so[sid];
      if (!so) {
        const p = price[o.product] ?? listPrice(code), q = +(o.qty || 0);
        so = { id: sid, customer: "C-1000", customerName: CUST["C-1000"].n, lines: [{ pos: 10, code, qty: q, price: r2(p), value: r2(p * q), confirmed: null, method: "twin", delivered: 0 }], product: code, qty: q, due: o.dueTxt || "twin",
          status: st, created: fmt(now()), createdDay: today(), value: r2(p * q), confirmed: null, source: "twin", deliveries: [], invoices: [], twinId: o.id };
        E.S.so[sid] = so; n++;
      }
      so.status = st; so.done = o.done;
      if (o.tShip != null || o.tDone != null) { const td = o.tDone != null ? o.tDone : o.tShip; so.onTime = o.due == null || td <= o.due; }
    }
    const tw = Object.keys(E.S.so).filter((k) => k.startsWith("SO-T")); for (const k of tw.slice(0, Math.max(0, tw.length - 120))) delete E.S.so[k];
    E.S.twin = { orders: Object.keys(E.S.so).filter((k) => k.startsWith("SO-T")).length, stores: b.stores || null, clock: b.clock || "" };
    return { new: n, twinOrders: E.S.twin.orders };
  }
  const page = (items, q, base) => { const p = Math.max(1, +(q.page || 1) | 0), s = Math.max(1, Math.min(200, +(q.size || 20) | 0)), out = { items: items.slice((p - 1) * s, p * s), page: p, size: s, total: items.length }; if (p * s < items.length) out.next = `${base}?page=${p + 1}&size=${s}`; return out; };

  /* ---------------- router */
  function route(method, path, query = {}, body = {}, headers = {}) {
    try {
      body = body || {}; query = query || {};
      let key = "";
      if (method === "POST") { key = (headers && (headers["Idempotency-Key"] || headers["idempotency-key"])) || String(body.msgId || ""); if (key && E.idem.has(key)) return okR(200, { ...E.idem.get(key).data, replay: true }); }
      const r = route0(method, path, query, body);
      if (method === "POST" && key && [200, 201].includes(r.status)) { E.idem.set(key, { status: r.status, data: r.data }); if (E.idem.size > 3000) E.idem.delete(E.idem.keys().next().value); }
      return r;
    } catch (e) { return probR(500, "internal error", `${e.name}: ${e.message}`); }
  }
  function route0(method, path, query, body) {
    if (path.startsWith("/api/bsf/v1/")) path = "/api/bsf/" + path.slice("/api/bsf/v1/".length);
    const Pp = path.slice("/api/bsf/erp".length).split("/").filter(Boolean), res = Pp[0] || "", rid = Pp[1] || "", act = Pp[2] || "", G = method === "GET", PO = method === "POST", S = E.S;
    if (G && (res === "" || res === "health")) return okR(200, { ok: true, version: VERSION7, mode: "browser demo", materials: Object.keys(MAT).length, salesOrders: Object.keys(S.so).length, purchaseOrders: Object.keys(S.po).length, productionOrders: Object.keys(S.prod).length, movements: S.mov.length, persist: null, mes: !!opts.mes, t: fmt(now()) });
    if (G && res === "api") return okR(200, { version: VERSION7, routes: opts.api || [] });
    if (G && res === "customers") return okR(200, { items: Object.values(CUST) });
    if (G && res === "suppliers") return okR(200, { items: Object.values(SUPP) });
    if (G && res === "materials" && !rid) { const ty = query.type; return okR(200, { items: Object.values(MAT).filter((m) => !ty || m.type === ty).map((m) => ({ ...m, stock: onhand(m.id), free: free(m.id), std: r2(stdPrice(m.id), 4) })) }); }
    if (G && res === "materials") { const m = MAT[matId(rid) || ""]; if (!m) return probR(404, "unknown material", rid); return okR(200, { ...m, stock: S.stock.filter((s) => s.mat === m.id), free: free(m.id), std: stdPrice(m.id), mav: S.mav[m.id], usedIn: Object.entries(BOM).filter(([, k]) => k.some((x) => x[0] === m.id)).map(([p]) => p), bom: BOM[m.id] || [] }); }
    if (G && res === "boms") { const m = matId(rid); if (!m) return probR(404, "unknown material", rid); return okR(200, bomTree(m)); }
    if (G && res === "routings") { const m = matId(rid), r = m ? routeOf(m) : ""; if (!r) return probR(404, "no routing", `${rid} is not a make item`); const k = kOf(m);
      return okR(200, { material: m, route: r, k, version: `R-${r}-01`, ops: opsOf7(r).map((o) => ({ no: o.no, workCenter: o.m, name: shortName(o.op), setup: o.setup, cycle: o.mod === "furnace" ? cycOf(o, "G") : cycOf(o, "G") * k, batch: o.batch, effMin: effTime(o, k), scrapPct: o.scrap, rate: mhr(o.m).rate })), yield: routeYield(r) }); }
    if (G && res === "workcenters") return okR(200, { items: workcenters(), formula: "rate = (depreciation + interest + space + energy + maintenance) / planned hours" });
    if (PO && res === "configure") return okR(200, configure(body));
    if (res === "quotations" && !rid) {
      if (G) return okR(200, { items: Object.values(S.qt).reverse() });
      const cust = body.customer; if (!CUST[cust]) return probR(400, "unknown customer", String(cust));
      const lines = [];
      for (const ln of body.lines || []) {
        if (ln.config) { const cf = configure(ln.config); if (!cf.ok) return probR(422, "configuration not valid", (cf.rules || []).join("; ")); const gg = MD.priceGroups[CUST[cust].group] ?? 1; lines.push({ code: cf.code, qty: +(ln.qty || 1), price: r2(cf.price * gg), config: ln.config, text: cf.variant }); }
        else { const c = matId(ln.code); if (!c || MAT[c].type !== "fg") return probR(400, "unknown product", String(ln.code)); lines.push({ code: c, qty: +(ln.qty || 1), price: r2(priceOf(c, cust)) }); }
      }
      if (!lines.length || lines.some((x) => x.qty <= 0)) return probR(422, "lines with qty > 0 needed");
      const q = { id: nid("QT"), customer: cust, lines: lines.map((x) => ({ ...x, value: r2(x.qty * x.price) })), value: r2(sum(lines.map((x) => x.qty * x.price))), validTo: isoDay(today() + 30), status: "open", created: fmt(now()), dueDays: +(body.dueDays || 15) | 0 };
      S.qt[q.id] = q; ev("sales", `${q.id} for ${cust}: ${q.value.toFixed(2)} €`); return okR(201, q);
    }
    if (res === "quotations" && rid) {
      const q = S.qt[rid]; if (!q) return probR(404, "unknown quotation", rid); if (G) return okR(200, q);
      if (act === "accept") { if (q.status !== "open") return probR(409, "wrong state", `${rid} is '${q.status}'`); const so = soNew(q.customer, q.lines, addWd(today(), q.dueDays), "quotation " + rid); q.status = "accepted"; q.so = so.id; return okR(201, so); }
    }
    if (res === "salesorders" && !rid) {
      if (G) { const st = query.status; const items = Object.values(S.so).sort((a, b) => (a.id < b.id ? 1 : -1)).filter((s) => !st || s.status === st); return okR(200, page(items, query, "/api/bsf/erp/salesorders")); }
      let cust = body.customer || "C-1001"; if (!CUST[cust]) { const nm = String(cust); cust = (Object.values(CUST).find((v) => v.n === nm) || { id: "C-1001" }).id; }
      const lines = body.lines || [{ code: body.product, qty: body.qty }], ls = [];
      for (const ln of lines) { const c = matId(ln.code || ln.product); if (!c || MAT[c].type !== "fg") return probR(400, "unknown product", String(ln.code || ln.product)); const q = +(ln.qty || 0) || 0; if (q <= 0) return probR(422, "quantity must be > 0"); ls.push({ code: c, qty: q, price: ln.price }); }
      const due = (body.due ? parseDay(body.due) : null) || addWd(today(), +(body.dueDays || 14) | 0);
      return okR(201, soNew(cust, ls, due, String(body.source || "api")));
    }
    if (res === "salesorders" && rid) {
      const so = S.so[rid]; if (!so) return probR(404, "unknown sales order", rid); if (G) return okR(200, so);
      if (act === "confirm") return confirmSo(so); if (act === "deliver") return deliver(so); if (act === "invoice") return invoice(so);
      if (act === "cancel") { if (["delivered", "invoiced", "paid"].includes(so.status)) return probR(409, "wrong state", so.status); so.status = "cancelled"; return okR(200, so); }
    }
    if (PO && res === "atp") { const c = matId(body.product); if (!c || MAT[c].type !== "fg") return probR(400, "unknown product", String(body.product)); const q = +(body.qty || 0); if (q <= 0) return probR(422, "quantity must be > 0"); return okR(200, atp(c, q)); }
    if (G && res === "deliveries") return okR(200, { items: Object.values(S.dn).reverse() });
    if (res === "invoices") {
      if (G && !rid) return okR(200, { items: Object.values(S.inv).reverse() });
      const inv = S.inv[rid]; if (!inv) return probR(404, "unknown invoice", rid);
      if (PO && act === "pay") { if (inv.status === "paid") return probR(409, "already paid", rid); inv.status = "paid"; inv.paidAt = fmt(now()); if (S.so[inv.so]) S.so[inv.so].status = "paid"; ev("finance", `${rid} paid (${inv.gross.toFixed(2)} €)`); return okR(200, inv); }
      return okR(200, inv);
    }
    if (res === "mrp") {
      if (PO && rid === "run") return okR(200, runMrp(body.horizon));
      if (G) {
        if (!S.mrp) return probR(404, "no MRP run yet", "POST /api/bsf/erp/mrp/run first");
        if (query.item) { const i = matId(query.item); if (!S.mrp.items[i]) return probR(404, "item not in the MRP", query.item); return okR(200, { item: i, weekStart: S.mrp.weekStart, ...S.mrp.items[i] }); }
        return okR(200, { at: S.mrp.at, H: S.mrp.H, weekStart: S.mrp.weekStart, items: S.mrp.items, exceptions: S.mrp.exceptions, planned: S.mrp.planned.filter((x) => S.planned[x]).map((x) => S.planned[x]) });
      }
    }
    if (res === "plannedorders") { if (G && !rid) return okR(200, { items: Object.values(S.planned) }); const pl = S.planned[rid]; if (!pl) return probR(404, "unknown planned order", rid); if (PO && act === "convert") return convert(pl); }
    if (G && res === "purchaserequisitions") return okR(200, { items: Object.values(S.pr).reverse() });
    if (res === "purchaseorders") {
      if (G && !rid) return okR(200, { items: Object.values(S.po).reverse() }); if (PO && !rid) return poCreate(body);
      const po = S.po[rid]; if (!po) return probR(404, "unknown purchase order", rid); if (G) return okR(200, po); if (act === "send") return poSend(po);
    }
    if (PO && res === "goodsreceipts") return goodsReceipt(body);
    if (res === "inspections") { if (G && !rid) return okR(200, { items: Object.values(S.insp).reverse() }); const il = S.insp[rid]; if (!il) return probR(404, "unknown inspection lot", rid); if (PO && act === "decision") return decide(il, body); return okR(200, il); }
    if (res === "goodsmovements") { if (PO) return goodsMovement(body); const n = +(query.n || 50) | 0; return okR(200, { items: S.mov.slice(-n).reverse() }); }
    if (G && res === "stock") {
      if (query.material) { const mm = matId(query.material); if (!mm) return probR(404, "unknown material", query.material); return okR(200, { material: mm, qty: free(mm), onHand: onhand(mm), unit: MAT[mm].uom, rows: S.stock.filter((s) => s.mat === mm), t: fmt(now()) }); }
      const agg = {}; for (const s of S.stock) agg[s.mat] = (agg[s.mat] || 0) + (s.status === "free" ? s.qty : 0);
      return okR(200, { items: Object.entries(agg).map(([k, v]) => ({ material: k, qty: v, unit: MAT[k].uom })), rows: S.stock, t: fmt(now()) });
    }
    if (G && res === "inventory" && rid === "valuation") return okR(200, valuation());
    if (G && res === "analysis" && rid === "abc") return okR(200, abc());
    if (res === "productionorders" && !rid) {
      if (G) return okR(200, { items: Object.values(S.prod).sort((a, b) => (a.id < b.id ? 1 : -1)).map(prodView) });
      const m = matId(body.material || body.product); if (!m || MAT[m].proc !== "make") return probR(400, "unknown make material", String(body.material));
      const q = +(body.qty || 0); if (q <= 0) return probR(422, "quantity must be > 0");
      const due = body.due ? parseDay(body.due) : addWd(today(), +(body.dueDays || 10) | 0), p = prodNew(nid("PO", 6), m, q, due);
      ev("production", `${p.id} created: ${g(q)} ${m}`); return okR(201, prodView(p));
    }
    if (res === "productionorders" && rid) {
      if (PO && act === "release") return release(rid, body);
      const p = S.prod[rid]; if (!p) return probR(404, "unknown production order", rid); if (G) return okR(200, prodView(p));
      if (act === "sync") { if (!p.mesWorkOrder) return probR(409, "not released", `${rid} has no MES work order yet`); return sync(p); }
      if (act === "settle") return settle(p, !!body.force);
    }
    if (PO && res === "confirmations") return confirmPush(body);
    if (G && res === "confirmations") return okR(200, { items: S.conf.slice(-100) });
    if (G && res === "costing") { const m = matId(rid), c = m ? costRollup(m) : null; if (!c) return probR(404, "not a make item", rid); return okR(200, c); }
    if (G && res === "variances") return okR(200, { settled: S.settled.slice().reverse(), ppv: S.ppv.slice().reverse(), ppvTotal: r2(sum(S.ppv.map((x) => x.ppv))) });
    if (G && res === "finance") { if (rid === "pnl" || rid === "cash") return okR(200, finance()); if (rid === "breakeven") return okR(200, breakeven()); }
    if (G && res === "kpi") return okR(200, kpi());
    if (G && res === "log") { const since = +(query.since || 0) | 0; return okR(200, { items: S.log.filter((x) => x.seq > since).slice(-200) }); }
    if (G && res === "events") { const since = +(query.since || 0) | 0; return okR(200, { items: S.events.filter((x) => x.seq > since).slice(-200) }); }
    if (PO && res === "twin") return okR(200, twinFeed(body));
    if (PO && res === "eval") return evaluate(body);
    if (PO && res === "control") { if (body.action === "reset") { E.idem.clear(); fresh(); return okR(200, { reset: true }); } if (body.action === "persist") return okR(200, { persist: false, path: null, note: "browser demo – no file" }); return probR(400, "unknown action", "reset | persist"); }
    return probR(404, "not found", path);
  }
  fresh();
  return { get S() { return E.S; }, route, atp, kpi, valuation, abc, runMrp, twinFeed, free, reset: fresh };
}
