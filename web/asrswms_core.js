/* AS/RS item 4 – WMS / ERP / MES logic on top of the shared simulation window.ASRS.sim (no DOM).
 * Listens to sim events from module load: message counters, lot capture for traceability, stock history,
 * purchase orders + receipts, cycle counts, quality holds. Calculations: stock per SKU, coverage, valuation,
 * SS / ROP / EOQ, MRP record, slotting (random / ABC-COI / current), kanban, availability check.
 * ALL VALUES ARE EXAMPLES – the WMS / ERP / AS/RS suppliers decide.
 */
import { getASRS, SKU, SKUS, CRANE, RACK, moveTime, lhdTime } from "./asrscore.js";
import { PLAN, MAT } from "./asrswms_data.js";

export const A = getASRS();
export const sim = A.sim;

/* ---------------------------------------------------------------- formatting + identifiers (guide 15) */
export const pad = (n, k) => String(Math.max(0, Math.floor(n))).padStart(k, "0");
export const lotNum = (lot) => parseInt(String(lot || "").replace(/\D/g, ""), 10) || 0;
/** GS1 mod-10 check digit (GTIN, SSCC) – guide 15 §11.2 */
export function gs1Check(digits) {
  let s = 0; const d = String(digits);
  for (let i = 0; i < d.length; i++) s += (+d[d.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (s % 10)) % 10;
}
/** sim slot id "L-03-2-5" → real location ASRS-RAW-A01L-L5-S06 (S counted from the I/O point, 2 crates per bay) */
export function locOf(s) {
  if (!s) return "–";
  const [side, bay, k, lev] = s.id.split("-");
  return `ASRS-RAW-A01${side}-L${+lev}-S${pad((+bay - 1) * 2 + (+k), 2)}`;
}
export const realLot = (sku, lot) => `LOT-${MAT[sku].prefix}-${PLAN.yw}-${pad((lotNum(lot) - 4000) % 1000, 3)}`;
export const crateOf = (lot) => `CRT-${pad(lotNum(lot), 6)}`;
export function ssccOf(lot) { const b = "0" + PLAN.gs1 + "6" + pad(lotNum(lot), 8); return b + gs1Check(b); }
export const heatOf = (lot) => `H${41100 + Math.floor((lotNum(lot) - 4100) / 8)}`;
export const batchOf = (lot) => `F-${88200 + Math.floor((lotNum(lot) - 4100) / 8)}`;
export const poOf = (lot) => `PO-${PLAN.yw}-${pad(10 + Math.floor((lotNum(lot) - 4100) / 30), 4)}`;
const T0 = Date.UTC(2026, 10, 12, 5, 0, 0);     // sim t = 0 ↔ 2026-11-12 06:00 local (UTC+1) – example
export const isoT = (t) => new Date(T0 + t * 1000).toISOString().replace(/\.\d+Z$/, "Z");
export const clock = (t) => { const s = Math.floor(t + 6 * 3600), d = Math.floor(s / 86400), r = s - d * 86400; return `${d ? "d" + (d > 0 ? "+" : "") + d + " " : ""}${pad(Math.floor(r / 3600), 2)}:${pad(Math.floor(r / 60) % 60, 2)}`; };
export const dur = (s) => (s == null || !isFinite(s) ? "–" : s < 90 ? `${s.toFixed(0)} s` : s < 5400 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(1)} h`);
export const money = (v) => "$" + Math.round(v).toLocaleString("en-US");
export const n0 = (v) => (v == null || !isFinite(v) ? "–" : Math.round(v).toLocaleString("en-US"));
export const n1 = (v) => (v == null || !isFinite(v) ? "–" : (+v).toFixed(1));

/* ---------------------------------------------------------------- planning parameters per SKU (guide 03 §20) */
export function params(k) {
  const m = MAT[k], u = SKU[k];
  const d = PLAN.unitsPerH * m.mix * m.bom;                 // pcs/h line demand
  const sd = 4 * d / 8.6, sLT = 0.25 * m.lt;                // σ demand per h, σ lead time h (examples)
  const sig = Math.sqrt(m.lt * sd * sd + d * d * sLT * sLT);
  const ss = PLAN.z * sig, rop = d * m.lt + ss;
  const D = d * PLAN.hoursPerYear, H = PLAN.holdRate * m.price + PLAN.slotCostYear / u.perLoad, H0 = PLAN.holdRate * m.price;
  const eoq = Math.sqrt(2 * D * PLAN.orderCost / H), eoq0 = Math.sqrt(2 * D * PLAN.orderCost / H0);
  return { d, sd, sLT, sig, ss, rop, D, H, H0, eoq, eoq0, loadsPerH: d / u.perLoad, crateKg: u.perLoad * u.kg + 45, valueYear: D * m.price };
}
export const P = Object.fromEntries(SKUS.map((k) => [k, params(k)]));
/* ABC by crane moves (slotting) and by consumption value (purchasing) – guide 03 §20.1 */
export const ABC_MOVES = { RAW_CYL: "A", RAW_CS: "A", RAW_CC: "B", RAW_CC30: "C", RAW_CC10: "C" };
export const ABC_VALUE = { RAW_CS: "A", RAW_CYL: "A", RAW_CC: "A", RAW_CC30: "C", RAW_CC10: "C" };

/* ---------------------------------------------------------------- slot times + zones */
const stopT = CRANE.tPos + lhdTime();
export const scTime = (s) => 2 * moveTime(0, CRANE.zIO, s.x, s.z) + 2 * stopT;   // single cycle to this slot, s
const bySc = sim.slots.map((s) => ({ s, t: scTime(s) })).sort((a, b) => a.t - b.t);
export const SC_OF = new Map(bySc.map((o) => [o.s.id, o.t]));
/* zones: A = fastest 25 % of the slots, B = next 35 %, C = slowest 40 % (example split, guide 34 §5) */
export const ZONE = new Map(bySc.map((o, i) => [o.s.id, i < 0.25 * bySc.length ? "A" : i < 0.6 * bySc.length ? "B" : "C"]));
export const SC_MEAN_ALL = bySc.reduce((a, o) => a + o.t, 0) / bySc.length;

/* ---------------------------------------------------------------- live trackers (from module load) */
export const W = {
  cnt: { po: 0, asn: 0, inb: 0, sched: 0, call: 0, deliv: 0, perf: 0, gm: 0, to: 0, tc: 0, plc: 0, scan: 0, life: 0 },
  last: {},                     // last job per message key (for the payload examples)
  lots: new Map(),              // job id → { lot, sku, qty, kg, inDate, slotId, loc }
  trace: [],                    // retrieval jobs done (newest first) with captured lot
  hist: [],                     // { t, pcs: {sku: pcs} } every 60 s sim time
  pos: [], receipts: [], wos: [], counts: [], holds: new Map(), seq: { po: 1, wo: 1, gr: 1, cnt: 1, tel: 1 }, serial: { VC10: 0, VC20: 0, VC30: 0, pump: 0 },
  autoPO: false, autoRecv: true, lastAuto: 0, lastLife: 0, lastHist: -1e9,
};
const bump = (k, j) => { W.cnt[k]++; if (j) W.last[k] = j; };
sim.on("job", (j) => {
  if (j.state === "queued" && !W.lots.has(j.id + "q")) {
    W.lots.set(j.id + "q", 1);
    if (j.type === "store") { bump("inb", j); if (j.src === "auto") bump("asn", j); }
    else if (j.src !== "auto") bump("call", j);
  }
  if (j.state === "active") {
    bump("to", j); bump("plc", j);
    if (j.type === "retrieve" && j.slot && j.slot.load) { const L = j.slot.load; W.lots.set(j.id, { lot: L.lot, sku: L.sku, qty: L.qty, kg: L.kg, inDate: L.inDate, slotId: j.slot.id, loc: locOf(j.slot) }); }
  }
  if (j.state === "done" || j.state === "failed") {
    if (W.lots.has(j.id + "f")) return; W.lots.set(j.id + "f", 1);
    bump("tc", j);
    if (j.type === "store") { bump("scan", j); if (j.state === "done" && j.slot && j.slot.load) W.lots.set(j.id, { lot: j.slot.load.lot, sku: j.slot.load.sku, qty: j.slot.load.qty, kg: j.slot.load.kg, inDate: j.slot.load.inDate, slotId: j.slot.id, loc: locOf(j.slot) }); }
    if (j.state === "done") {
      bump("gm", j);
      if (j.type === "retrieve") {
        bump("deliv", j); bump("perf", j);
        const L = W.lots.get(j.id); if (L) { W.trace.unshift({ job: j, ...L, serials: assignSerials(j, L) }); if (W.trace.length > 40) W.trace.pop(); }
      }
    }
  }
});
sim.on("tick", () => {
  if (sim.t - W.lastLife >= 10) { W.lastLife = sim.t; W.cnt.life++; }
  if (sim.t - W.lastHist >= 60) { W.lastHist = sim.t; W.hist.push({ t: sim.t, pcs: pcsBySku() }); if (W.hist.length > 600) W.hist.shift(); }
  // purchase orders arrive after the lead time (auto receipt) – or the planner posts them earlier with the button
  if (W.autoRecv) for (const p of W.pos) if (p.state === "open" && sim.t >= p.due) receivePO(p, "lead time reached");
  if (W.autoPO && sim.t - W.lastAuto >= 30) { W.lastAuto = sim.t; for (const k of SKUS) { let n = 0; while (mrpStatus(k).below && n++ < 8) createPO(k, MAT[k].lot, "auto (position below ROP)"); } }   // lot < d·LT → several open POs at once
});

/* serial numbers assigned when the parts of this crate start (guide 15 §3.6) – example */
function assignSerials(j, L) {
  const m = MAT[L.sku], out = [];
  if (m.model !== "all") { for (let i = 0; i < L.qty; i++) { W.serial[m.model]++; out.push(`${m.model}-${PLAN.yw}-${pad(W.serial[m.model], 5)}`); } }
  else { const per = m.bom, n = Math.floor(L.qty / per); for (let i = 0; i < n; i++) { W.serial.pump++; const mod = ["VC20", "VC10", "VC20", "VC30", "VC20"][W.serial.pump % 5]; out.push(`${mod}-${PLAN.yw}-${pad(100 + W.serial.pump, 5)}`); } }
  return out;
}
export const woOf = (serial) => { const m = /^(VC\d0)-\d{4}-(\d{5})$/.exec(serial); if (!m) return "–"; const lot = m[1] === "VC30" ? 10 : 20; return `WO-${PLAN.yw}-${pad({ VC10: 100, VC20: 200, VC30: 300 }[m[1]] + Math.ceil(+m[2] / lot), 4)}`; };

/* ---------------------------------------------------------------- stock */
export function qiOf(s) { return s.load && sim.t - s.load.inDate < PLAN.qiMin * 60 && s.load.inDate > 0; }
/** stock category of a slot: free (unrestricted) / reserved / QI (quality inspection) / blocked / empty */
export function catOf(s) {
  if (!s.load) return s.blocked ? "blocked-empty" : s.reserved ? "reserved-in" : "empty";
  if (s.blocked) return "blocked"; if (s.reserved) return "reserved"; if (qiOf(s)) return "qi"; return "free";
}
export function pcsBySku() { const o = {}; SKUS.forEach((k) => (o[k] = 0)); sim.slots.forEach((s) => { if (s.load) o[s.load.sku] += s.load.qty; }); return o; }
export function stockTable() {
  const rows = {};
  SKUS.forEach((k) => (rows[k] = { k, loads: 0, pcs: 0, kg: 0, value: 0, free: 0, reserved: 0, qi: 0, blocked: 0, oldest: null }));
  for (const s of sim.slots) {
    if (!s.load) continue; const r = rows[s.load.sku]; const c = catOf(s);
    r.loads++; r.pcs += s.load.qty; r.kg += s.load.kg; r.value += s.load.qty * MAT[s.load.sku].price;
    if (c === "free") r.free += s.load.qty; else if (c === "reserved") r.reserved += s.load.qty; else if (c === "qi") r.qi += s.load.qty; else if (c === "blocked") r.blocked += s.load.qty;
    if (!r.oldest || ageOf(s) > ageOf(r.oldest)) r.oldest = s;
  }
  SKUS.forEach((k) => { const r = rows[k]; r.cov = r.pcs / P[k].d; r.covFree = r.free / P[k].d; });
  return rows;
}
/* age: initial stock was received before the twin started – in-date spread over the 10 h before start by lot number (example) */
export function ageOf(s) { if (!s || !s.load) return 0; const L = s.load; return L.inDate > 0 ? sim.t - L.inDate : sim.t + Math.max(0, 4500 - lotNum(L.lot)) * 90; }
export function inDateOf(s) { return sim.t - ageOf(s); }

/* ---------------------------------------------------------------- jobs + KPIs */
export function retrRate(k, windowS = 3600) {
  const t0 = sim.t - Math.min(windowS, Math.max(sim.t, 1));
  const n = sim.done.filter((j) => j.type === "retrieve" && j.state === "done" && j.sku === k && j.tEnd >= t0).length;
  return n / (Math.max(600, sim.t - t0) / 3600);   // at least 10 min in the denominator (no wild values right after start)
}
export function kpis() {
  const kp = sim.kpi(), h = Math.max(1e-6, sim.t / 3600);
  const retr = sim.done.filter((j) => j.type === "retrieve").slice(0, 100);
  const onTime = retr.filter((j) => j.state === "done" && j.tEnd - j.tReq <= PLAN.otifMin * 60).length;
  const stores = sim.done.filter((j) => j.type === "store" && j.state === "done").slice(0, 100);
  const d2s = stores.length ? stores.reduce((a, j) => a + (j.tEnd - j.tReq), 0) / stores.length : null;
  const st = stockTable(), value = SKUS.reduce((a, k) => a + st[k].value, 0), consYear = SKUS.reduce((a, k) => a + P[k].valueYear, 0);
  const counted = W.counts.reduce((a, c) => a + c.n, 0), ok = W.counts.reduce((a, c) => a + c.ok, 0);
  const failed = sim.done.filter((j) => j.state === "failed").length;
  return { ...kp, retrPerH: sim.stats.retrievals / h, storePerH: sim.stats.stores / h, otif: retr.length ? onTime / retr.length : null, otifN: retr.length,
    d2s, value, consYear, turns: value > 0 ? consYear / value : null, accuracy: counted ? ok / counted : null, counted, failed,
    queue: sim.queue.length, qRetr: sim.queue.filter((j) => j.type === "retrieve").length, qStore: sim.queue.filter((j) => j.type === "store").length };
}

/* ---------------------------------------------------------------- slotting analysis (guide 34 §5) */
/** mean single-cycle time weighted by the retrieval rate of each SKU: current layout, random, ABC by COI */
export function slotting() {
  const occ = sim.slots.filter((s) => s.load), rate = {}, n = {};
  SKUS.forEach((k) => { rate[k] = P[k].loadsPerH; n[k] = 0; });
  occ.forEach((s) => n[s.load.sku]++);
  const totR = SKUS.reduce((a, k) => a + rate[k], 0);
  // current: each SKU's retrievals spread over its own slots
  let cur = 0; SKUS.forEach((k) => { const sl = occ.filter((s) => s.load.sku === k); if (sl.length) cur += rate[k] * sl.reduce((a, s) => a + SC_OF.get(s.id), 0) / sl.length; });
  cur /= totR;
  const rnd = SC_MEAN_ALL;
  // COI = slots needed / retrievals per hour – lowest COI gets the fastest slots
  const coi = SKUS.map((k) => ({ k, coi: n[k] / rate[k] })).sort((a, b) => a.coi - b.coi);
  let i = 0, abc = 0; const zones = [];
  for (const c of coi) { const sl = bySc.slice(i, i + n[c.k]); i += n[c.k]; if (sl.length) { const m = sl.reduce((a, o) => a + o.t, 0) / sl.length; abc += rate[c.k] * m; zones.push({ k: c.k, coi: c.coi, n: n[c.k], from: sl[0].t, to: sl[sl.length - 1].t, mean: m }); } }
  abc /= totR;
  // share of class-A loads in zone A
  const aLoads = occ.filter((s) => ABC_MOVES[s.load.sku] === "A"), aInA = aLoads.filter((s) => ZONE.get(s.id) === "A").length;
  return { cur, rnd, abc, coi, zones, aShare: aLoads.length ? aInA / aLoads.length : 0, occ: occ.length };
}

/* ---------------------------------------------------------------- ERP: purchase orders, receipts, MRP */
export function onOrder(k) { return W.pos.filter((p) => p.sku === k && p.state === "open").reduce((a, p) => a + p.qty, 0); }
export function mrpStatus(k) {
  const st = stockTable()[k], oo = onOrder(k), pos = st.pcs - st.blocked + oo;
  return { onHand: st.pcs, usable: st.pcs - st.blocked, oo, position: pos, below: pos < P[k].rop };
}
export function createPO(k, qty, why = "planner") {
  const po = { id: `PO-${PLAN.yw}-${pad(W.seq.po++ + 40, 4)}`, sku: k, qty, crates: Math.ceil(qty / SKU[k].perLoad), t: sim.t, due: sim.t + MAT[k].lt * 3600, state: "open", why };
  W.pos.unshift(po); bump("po", { id: po.id, sku: k, qty, po }); sim.logMsg(`ERP ${po.id}: ${qty} × ${MAT[k].item} at ${MAT[k].supplier} (${why})`); return po;
}
/** post the inbound delivery: ASN → ID point → store jobs in the sim (one per crate) */
export function receivePO(po, why = "planner") {
  if (!po || po.state !== "open") return null;
  const free = sim.slots.filter((s) => !s.load && !s.reserved && !s.blocked).length - sim.queue.filter((j) => j.type === "store").length;
  const n = Math.max(0, Math.min(po.crates, free));
  const gr = { id: `GR-${PLAN.yw}-${pad(W.seq.gr++, 4)}`, po: po.id, sku: po.sku, crates: n, t: sim.t, jobs: [], why };
  for (let i = 0; i < n; i++) { sim.inConv.push({ sku: po.sku, t: sim.t }); const j = sim.addJob("store", po.sku, "ERP " + po.id); gr.jobs.push(j.id); }
  po.state = n < po.crates ? "partial" : "received"; po.tRecv = sim.t;
  W.receipts.unshift(gr); bump("asn", { id: gr.id, po }); sim.logMsg(`WMS ${gr.id}: ASN for ${po.id} – ${n} crates ${MAT[po.sku].item} to the infeed${n < po.crates ? ` (only ${n} free slots)` : ""}`);
  return gr;
}
/** time-phased MRP record, 6 periods of 8 h (guide 04 §20.3) */
export function mrpRecord(k, periods = 6) {
  const p = P[k], m = MAT[k], L = PLAN.shiftH, st = stockTable()[k];
  let poh = st.pcs - st.blocked; const rows = [];
  const ltP = Math.ceil(m.lt / L);
  for (let i = 0; i < periods; i++) {
    const t0 = sim.t + i * L * 3600, t1 = t0 + L * 3600;
    const gross = p.d * L / m.yield;
    const sr = W.pos.filter((o) => o.sku === k && o.state === "open" && o.due >= (i === 0 ? -1e12 : t0) && o.due < t1).reduce((a, o) => a + o.qty, 0);
    let pr = 0; const after = poh + sr - gross;
    if (after < p.ss) pr = Math.ceil((p.ss - after) / m.lot) * m.lot;
    poh = after + pr;
    rows.push({ i, t0, gross, sr, pr, poh, net: Math.max(0, p.ss - (after)), rel: 0 });
  }
  rows.forEach((r) => { if (r.pr) { const j = r.i - ltP; if (j >= 0) rows[j].rel += r.pr; else rows[0].late = (rows[0].late || 0) + r.pr; } });
  return { rows, ltP, start: st.pcs - st.blocked };
}

/* ---------------------------------------------------------------- MES: availability check + release, call-off */
const YIELD = { CC: 1 - 0.008 };
export function explode(model, qty) {
  const cc = { VC10: "RAW_CC10", VC20: "RAW_CC", VC30: "RAW_CC30" }[model];
  return [[cc, Math.ceil(qty * 1 / YIELD.CC)], ["RAW_CYL", Math.ceil(qty * 2 / MAT.RAW_CYL.yield)], ["RAW_CS", Math.ceil(qty * 1 / MAT.RAW_CS.yield)]];
}
export function availability(model, qty) {
  const st = stockTable();
  const reservedByWO = {}; SKUS.forEach((k) => (reservedByWO[k] = 0));
  W.wos.filter((w) => w.state === "released").forEach((w) => w.need.forEach(([k, q]) => (reservedByWO[k] += q)));
  const lines = explode(model, qty).map(([k, need]) => {
    const avail = Math.max(0, st[k].free - reservedByWO[k]);
    return { k, need, crates: Math.ceil(need / SKU[k].perLoad), free: st[k].free, resWO: reservedByWO[k], avail, ok: avail >= need };
  });
  return { lines, ok: lines.every((l) => l.ok) };
}
export function releaseWO(model, qty, callOff = true) {
  const av = availability(model, qty);
  const wo = { id: `WO-${PLAN.yw}-${pad(W.seq.wo++ + 500, 4)}`, model, qty, t: sim.t, need: av.lines.map((l) => [l.k, l.need]), state: av.ok ? "released" : "blocked (material short)", jobs: [] };
  W.wos.unshift(wo); bump("sched", { id: wo.id, wo });
  if (av.ok && callOff) { // MES calls the first crate of each material now (the rest by kanban)
    av.lines.forEach((l) => { const j = sim.addJob("retrieve", l.k, "MES " + wo.id); wo.jobs.push(j.id); });
  }
  sim.logMsg(`MES ${wo.id} ${qty} × ${model}: availability ${av.ok ? "OK – released, first crates called off" : "NOT OK – order stays planned"}`, av.ok ? "info" : "warn");
  return { wo, av };
}
export function callOff(k, src = "MES kanban") { return sim.addJob("retrieve", k, src); }

/* ---------------------------------------------------------------- WMS: cycle count + quality hold */
let cr = 12345; const crand = () => { cr = (cr * 1103515245 + 12345) & 0x7fffffff; return cr / 0x7fffffff; };
/** count plan: A items 12×/year, B 6×, C 4× per slot (ABC by moves) + zero-stock check (example) */
export function countPlan() {
  const st = stockTable(), f = { A: 12, B: 6, C: 4 };
  const rows = SKUS.map((k) => ({ k, cls: ABC_MOVES[k], loads: st[k].loads, freq: f[ABC_MOVES[k]], perYear: st[k].loads * f[ABC_MOVES[k]] }));
  const perYear = rows.reduce((a, r) => a + r.perYear, 0);
  return { rows, perYear, perDay: perYear / 250 };
}
/** count n slots (the crane brings each crate to the outfeed; the counter scans + counts). Deviation chance 0.4 % (example). */
export function runCount(n) {
  const occ = sim.slots.filter((s) => s.load && !s.reserved);
  const pick = []; for (let i = 0; i < n && occ.length; i++) pick.push(occ.splice(Math.floor(crand() * occ.length), 1)[0]);
  const dev = pick.filter(() => crand() < 0.004).map((s) => ({ loc: locOf(s), sku: s.load.sku, sys: s.load.qty, cnt: s.load.qty - 1 }));
  const c = { id: `CNT-${PLAN.yw}-${pad(W.seq.cnt++, 3)}`, t: sim.t, n: pick.length, ok: pick.length - dev.length, dev };
  W.counts.unshift(c); if (W.counts.length > 20) W.counts.pop(); return c;
}
export function hold(s, on, reason = "quality hold (NCR)") {
  if (!s || !s.load) return false;
  if (on) { if (s.blocked) return false; s.blocked = true; W.holds.set(s.id, { reason, t: sim.t, lot: s.load.lot }); sim.logMsg(`WMS: ${locOf(s)} lot ${s.load.lot} blocked – ${reason}`, "warn"); }
  else { if (!W.holds.has(s.id)) return false; s.blocked = false; W.holds.delete(s.id); sim.logMsg(`WMS: ${locOf(s)} released from quality hold`); }
  return true;
}
/* ISO 2859-1 single sampling, normal inspection, general level II, AQL 1.0 (example – check the standard tables) */
export function sampling(lotSize) {
  const T = [[8, "A", 2], [15, "B", 3], [25, "C", 5], [50, "D", 8], [90, "E", 13], [150, "F", 20], [280, "G", 32], [500, "H", 50], [1200, "J", 80], [3200, "K", 125]];
  const r = T.find((x) => lotSize <= x[0]) || T[T.length - 1];
  const plan = { A: ["E", 13, 0, 1], B: ["E", 13, 0, 1], C: ["E", 13, 0, 1], D: ["E", 13, 0, 1], E: ["E", 13, 0, 1], F: ["E", 13, 0, 1], G: ["G", 32, 1, 2], H: ["H", 50, 1, 2], J: ["J", 80, 2, 3], K: ["K", 125, 3, 4] }[r[1]];
  const n = Math.min(plan[1], lotSize);
  return { letter: r[1], nLetter: r[2], use: plan[0], n, ac: plan[2], re: plan[3] };
}

/* ---------------------------------------------------------------- message payload examples (live values) */
export function telegramTO(j) {
  const seq = pad(W.cnt.to % 100000, 5), id = (j ? j.id : "J00000").padEnd(8, " ");
  const st = j && j.type === "store", L = j && W.lots.get(j.id);
  const src = (st ? "ASRS-RAW-IN01" : j && j.slot ? locOf(j.slot) : "").padEnd(20, " "), dst = (st ? (j && j.slot ? locOf(j.slot) : "") : "ASRS-RAW-OUT01").padEnd(20, " ");
  const hu = (L ? crateOf(L.lot) : j && j.slot && j.slot.load ? crateOf(j.slot.load.lot) : "CRT-??????").padEnd(10, " ");
  const kg = pad(L ? L.kg : j && j.slot && j.slot.load ? j.slot.load.kg : 0, 4);
  return { raw: `<STX>TO${seq}WMS1WCS1${id}${st ? "ST" : "RT"}${src}${dst}${hu}${kg}${st ? 5 : 3}<ETX>`, fields: [["Type", "TO"], ["Seq", seq], ["Sender", "WMS1"], ["Receiver", "WCS1"], ["Job", id.trim()], ["Kind", st ? "ST store" : "RT retrieve"], ["Source", src.trim()], ["Destination", dst.trim()], ["HU", hu.trim()], ["Weight kg", kg], ["Priority", st ? "5" : "3 (retrievals first)"]] };
}
export function telegramTC(j) {
  const code = !j ? "00" : j.state === "failed" ? (/no-read/.test(j.err || "") ? "11" : /full/.test(j.err || "") ? "21" : /stock/.test(j.err || "") ? "22" : "90") : "00";
  const seq = pad(W.cnt.tc % 100000, 5), id = (j ? j.id : "J00000").padEnd(8, " ");
  return { code, raw: `<STX>TC${seq}WCS1WMS1${id}${code}${j && j.slot ? locOf(j.slot).padEnd(20, " ") : "".padEnd(20, " ")}${pad(j && j.tEnd ? (j.tEnd - j.tStart) * 10 : 0, 5)}<ETX>` };
}
export const TC_CODES = [["00", "done OK"], ["11", "no-read at the ID point → reject lane"], ["12", "contour / overhang fault → reject lane"], ["13", "overweight (> 300 kg)"], ["21", "destination slot occupied / store full"], ["22", "source slot empty (no stock)"], ["31", "crane fault – job aborted"], ["90", "other error – see WCS log"]];
