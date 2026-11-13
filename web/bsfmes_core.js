/* Ball screw + guide factory – item 6 MES – CORE (pure logic, no DOM).  Guide: docs/45_bsf_mes.md.
 * The SAME model and algorithms run in Python in twin/bsf_mes.py + twin/bsf_mes_core.py (server). This file is the browser twin of it:
 *   schedule(input)      finite-capacity forward scheduler (rules EDD / SPT / CR / FIFO / FAM, furnace loads, drum-buffer-rope)
 *   oeeISO(o)            ISO 22400 OEE = A × E × Q
 *   createMES(opts)      MES state + local HTTP router (same paths, JSON and problem+json as /api/bsf/mes/... of the server)
 *                        → used by the page when the server is not running ("demo mode"), fed by the twin (window.BSF)
 * opts: { now() → s, fmt(t) → text, tod0() → min since 06:00 of today, shifts() → 1|2|3, dateOf(t) → "YYMMDD", qa(serial) → records,
 *         agv(body) → transport order, erp(body) → goods movement, gateway(machine, body) → handshake result (or null = simulate) }
 * ALL VALUES ARE EXAMPLES.
 */
import { ROUTES, opsOf, cycOf, MACHINES, MTYPES } from "./bsfmfg_data.js";
import { PRODUCTS6, prodInfo, LOT6, FAMILY_TYPES, MINOR_SETUP, MARK_OP, REASONS, REASON_BY_CODE, alarmReason, KANBAN, kanbanBins, SERIAL6, gs1Element,
  HEATS, TOOLSETS, GAUGES6, TODAY6, API6 } from "./bsfmes_data.js";

export const VERSION6 = "bsf_mes 1.0";
const r2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const EPS = 1e-9;

/* ================================================================== shift calendar (minutes from "now") */
// a day has a working window [0, H) counted from 06:00; tod0 = minutes since 06:00 of today at t = 0
export function calendar(tod0 = 0, shifts = 2, cal = "shift") {
  const H = (ht) => (cal === "247" ? 1440 : Math.min(1440, (ht ? Math.max(3, shifts) : shifts) * 450));
  const pos = (t) => { const a = tod0 + t, d = Math.floor(a / 1440); return [d, a - d * 1440]; };
  const nextWork = (t, ht) => { const h = H(ht); if (h >= 1440) return t; const [d, r] = pos(t); return r < h ? t : (d + 1) * 1440 - tod0; };
  const addWork = (t, dur, ht) => {
    const h = H(ht); if (h >= 1440) return t + dur;
    let x = nextWork(t, ht), rest = dur;
    for (let guard = 0; guard < 100000; guard++) {
      const [, r] = pos(x), av = h - r;
      if (rest <= av + EPS) return x + rest;
      rest -= av; x = nextWork(x + av, ht);
    }
    return x + rest;
  };
  const workBetween = (a, b, ht) => { const h = H(ht); if (h >= 1440) return Math.max(0, b - a); let s = 0, x = nextWork(a, ht);
    for (let guard = 0; guard < 100000 && x < b; guard++) { const [, r] = pos(x), av = Math.min(h - r, b - x); s += av; x = nextWork(x + (h - r), ht); } return s; };
  return { H, nextWork, addWork, workBetween };
}

/* ================================================================== finite-capacity forward scheduler */
/* input: { rule, tod0, shifts, calendar ("shift"|"247"), transfer (min), dbr: { drum, bufferMin } | null,
 *          machines: { type: [{ id, free, lastKey, lastFam, ht }] },
 *          lots: [{ id, wo, code, route, qty, due (min), release (min), started, fixed: { machine, end } | null,
 *                   ops: [{ no, m, setup, setupMinor, cyc, batch, furnace, key, fam }] }] }
 * output: { ops: [{ lot, wo, code, route, k, no, m, machine, start, end, setup, setupKind, qty, load, due }], kpi, lots: { id: { end, tard } } } */
export function schedule(inp) {
  const run = (lotsIn) => schedOnce(inp, lotsIn);
  let lots = inp.lots.map((L) => ({ ...L }));
  let r = run(lots), dbr = null;
  if (inp.dbr) {
    const drum = inp.dbr.drum || "BS-TGR", buf = inp.dbr.bufferMin ?? 960; let moved = 0;
    lots = lots.map((L) => {
      if (L.started || L.fixed) return L;
      const j = L.ops.findIndex((o) => o.m === drum); if (j < 0) return L;
      const e = r.ops.find((o) => o.lot === L.id && o.k === j); if (!e) return L;
      let up = 0; for (let i = 0; i < j; i++) up += L.ops[i].furnace ? L.ops[i].cyc * L.ops[i].batch : L.ops[i].setup + L.qty * L.ops[i].cyc;
      const rel = Math.max(L.release || 0, e.start - up - buf); if (rel > (L.release || 0) + EPS) moved++;
      return { ...L, release: rel };
    });
    const r1 = r.kpi; r = run(lots); dbr = { drum, bufferMin: buf, moved, before: r1 };
  }
  r.kpi.dbr = dbr; r.rule = inp.rule || "EDD"; r.releases = Object.fromEntries(lots.map((L) => [L.id, L.release || 0]));
  return r;
}
function schedOnce(inp, lotsIn) {
  const rule = inp.rule || "EDD", C = calendar(inp.tod0 || 0, inp.shifts || 2, inp.calendar || "shift"), tr = inp.transfer || 0;
  const M = {}; for (const [type, list] of Object.entries(inp.machines || {})) M[type] = list.map((m) => ({ id: m.id, type, free: m.free || 0, lastKey: m.lastKey || "", lastFam: m.lastFam || "", ht: !!m.ht, busy: 0 }));
  const byId = {}; for (const t in M) for (const m of M[t]) byId[m.id] = m;
  const lots = lotsIn.map((L) => ({ L, k: 0, ready: L.release || 0 }));
  const out = []; let majors = 0, minors = 0, setupMin = 0, nLoad = 0, unsched = 0;
  const pT = (op, qty) => (op.furnace ? op.cyc * op.batch : qty * op.cyc);
  const famPref = (m, op) => (m.lastKey && m.lastKey === op.key ? 2 : op.fam && m.lastFam === op.fam ? 1 : 0);
  const setupOf = (m, op) => { const f = famPref(m, op); return op.furnace ? [0, ""] : f === 2 ? [0, ""] : f === 1 ? [op.setupMinor ?? op.setup, "minor"] : [op.setup, op.setup > 0 ? "major" : ""]; };
  for (const x of lots) {
    const F = x.L.fixed; if (!F || !x.L.ops.length) continue;
    const m = byId[F.machine], op = x.L.ops[0];
    out.push({ lot: x.L.id, wo: x.L.wo || "", code: x.L.code || "", route: x.L.route || "", k: 0, no: op.no, m: op.m, machine: F.machine, start: 0, end: F.end, setup: 0, setupKind: "", qty: x.L.qty, load: "", due: x.L.due, fixed: true });
    if (m) { m.free = Math.max(m.free, F.end); m.lastKey = op.key; if (op.fam) m.lastFam = op.fam; m.busy += F.end; }
    x.ready = F.end + tr; x.k = 1;
  }
  const remWork = (x) => { let s = 0; for (let i = x.k; i < x.L.ops.length; i++) s += x.L.ops[i].setup + pT(x.L.ops[i], x.L.qty); return s; };
  const key = (c, t) => {
    const L = c.x.L, op = c.op;
    if (rule === "FIFO") return [L.release || 0];
    if (rule === "SPT") return [setupOf(c.m, op)[0] + pT(op, L.qty)];
    if (rule === "CR") { const w = remWork(c.x); return [(L.due - t) / Math.max(EPS, w)]; }
    if (rule === "FAM") return [famPref(c.m, op) >= 1 ? 0 : 1, L.due];
    return [L.due];
  };
  const cmp = (a, b, t) => { const ka = key(a, t), kb = key(b, t); for (let i = 0; i < ka.length; i++) { if (ka[i] < kb[i] - EPS) return -1; if (ka[i] > kb[i] + EPS) return 1; }
    return a.x.L.id < b.x.L.id ? -1 : a.x.L.id > b.x.L.id ? 1 : a.x.k - b.x.k; };
  for (let guard = 0; guard < 200000; guard++) {
    const cand = [];
    for (const x of lots) {
      if (x.k >= x.L.ops.length) continue;
      const op = x.L.ops[x.k], ms = M[op.m];
      if (!ms || !ms.length) { unsched++; x.k = x.L.ops.length; continue; }
      let best = null;
      for (const m of ms) {
        const est = C.nextWork(Math.max(x.ready, m.free), m.ht);
        if (!best || est < best.est - EPS || (Math.abs(est - best.est) <= EPS && famPref(m, op) > famPref(best.m, op))) best = { m, est };
      }
      cand.push({ x, op, m: best.m, est: best.est });
    }
    if (!cand.length) break;
    let tmin = Infinity; for (const c of cand) tmin = Math.min(tmin, c.est);
    const conf = cand.filter((c) => c.est <= tmin + EPS);
    conf.sort((a, b) => cmp(a, b, tmin));
    const pick = conf[0], m = pick.m, op = pick.op, start = pick.est;
    if (op.furnace) {
      const load = [pick]; let q = pick.x.L.qty;
      const others = cand.filter((c) => c !== pick && c.op.m === op.m && c.op.furnace && c.x.ready <= start + EPS).sort((a, b) => cmp(a, b, start));
      for (const c of others) if (q + c.x.L.qty <= op.batch) { load.push(c); q += c.x.L.qty; }
      const dur = op.cyc * op.batch, end = C.addWork(start, dur, m.ht), lid = "LOAD-" + String(++nLoad).padStart(3, "0");
      for (const c of load) {
        const L = c.x.L;
        out.push({ lot: L.id, wo: L.wo || "", code: L.code || "", route: L.route || "", k: c.x.k, no: c.op.no, m: op.m, machine: m.id, start, end, setup: 0, setupKind: "", qty: L.qty, load: lid, fill: q, cap: op.batch, due: L.due });
        c.x.ready = end + tr; c.x.k++;
      }
      m.free = end; m.busy += dur;
    } else {
      const [st, sk] = setupOf(m, op), L = pick.x.L, dur = st + L.qty * op.cyc, end = C.addWork(start, dur, m.ht);
      out.push({ lot: L.id, wo: L.wo || "", code: L.code || "", route: L.route || "", k: pick.x.k, no: op.no, m: op.m, machine: m.id, start, end, setup: st, setupKind: sk, qty: L.qty, load: "", due: L.due });
      if (sk === "major") majors++; else if (sk === "minor") minors++; setupMin += st;
      m.free = end; m.lastKey = op.key; if (op.fam) m.lastFam = op.fam; m.busy += dur;
      pick.x.ready = end + tr; pick.x.k++;
    }
  }
  // KPIs
  const lotRes = {}; let horizon = 0;
  for (const o of out) { horizon = Math.max(horizon, o.end); const r = lotRes[o.lot] || (lotRes[o.lot] = { end: 0, due: o.due, release: 0 }); r.end = Math.max(r.end, o.end); }
  let onTime = 0, tard = 0, maxT = 0, flow = 0, n = 0;
  for (const x of lots) { const r = lotRes[x.L.id]; if (!r) continue; n++; r.release = x.L.release || 0; const t = Math.max(0, r.end - x.L.due); r.tard = t; tard += t; maxT = Math.max(maxT, t); if (t <= EPS) onTime++; flow += r.end - r.release; }
  const util = {};
  for (const t in M) { let busy = 0, av = 0; for (const m of M[t]) { busy += m.busy; av += C.workBetween(0, horizon, m.ht); } util[t] = av > 0 ? busy / av : 0; }
  const kpi = { lots: n, onTimePct: n ? (100 * onTime) / n : 100, tardSum: tard, tardMax: maxT, flowMean: n ? flow / n : 0, wipMean: horizon > 0 ? flow / horizon : 0, makespan: horizon,
    majors, minors, setupMin, loads: nLoad, unscheduled: unsched, util };
  return { ops: out, kpi, lots: lotRes };
}

/* ================================================================== OEE (ISO 22400-2) */
// PBT planned busy time, down = unplanned down time, setup = set-up time (both inside PBT), PRI planned run time per item, PQ produced, GQ good
export function oeeISO(o) {
  const APT = Math.max(0, o.PBT - (o.down || 0) - (o.setup || 0));
  const A = o.PBT > 0 ? APT / o.PBT : 0, E = APT > 0 ? (o.PRI * o.PQ) / APT : 0, Q = o.PQ > 0 ? o.GQ / o.PQ : 0;
  return { APT, A, E, Q, OEE: A * E * Q };
}

/* ================================================================== routing → lot operations */
export function routeOps(route, code) {
  const p = prodInfo(code) || {}, k = p.k || 1, fam = p.fam || "";
  return opsOf(route, "G").filter((o) => !o.buy).map((o) => {
    const furnace = o.mod === "furnace", isFam = FAMILY_TYPES.includes(o.m);
    return { no: o.no, m: o.m, n: o.op.split(/[(:–,]/)[0].trim().slice(0, 42), setup: o.setup, setupMinor: isFam ? Math.round(o.setup * MINOR_SETUP) : o.setup,
      cyc: furnace ? cycOf(o) : r2(cycOf(o) * k, 3), batch: o.batch || 1, furnace, gate: o.gate || "", fam: isFam ? fam : "", scrapPct: o.scrap || 0,
      status: "open", machine: "", good: 0, scrap: 0, qtyIn: 0, tStart: null, tEnd: null };
  });
}
export const routeYield = (route) => opsOf(route, "G").filter((o) => !o.buy).reduce((y, o) => y * (1 - (o.scrap || 0) / 100), 1);
const SETS = { FABS: [["BS", 1], ["BN", 1]], FALG: [["LG", 1], ["LB", 2]] };
export const MACH_BY_TYPE = MACHINES.reduce((a, m) => { (a[m.type] = a[m.type] || []).push(m.id); return a; }, {});

/* ================================================================== MES state + local router */
export function createMES(opts = {}) {
  const now = opts.now || (() => Date.now() / 1000), fmt = opts.fmt || ((t) => new Date(t * 1000).toISOString().slice(0, 19) + "Z");
  const S = { wo: {}, lots: {}, conf: [], ser: {}, heats: HEATS.map((h) => ({ ...h, used: 0 })), ht: {}, dt: [], tr: {}, calls: [], fg: [], kb: {}, mach: {}, sched: null,
    events: [], seq: {}, idem: new Map(), serialNo: {}, twin: { orders: {}, lotSeen: {}, kpi: null, t: 0 } };
  for (const k of KANBAN) { const D = k.per * ({ BN: 120, LB: 400, LG: 200 }[k.use] || 100), N = kanbanBins(k, D); S.kb[k.item] = { ...k, D, N, full: N, signals: 0, pending: [], used: 0 }; }
  for (const m of MACHINES) S.mach[m.id] = { id: m.id, type: m.type, state: "IDLE", lot: "", spcStop: null, download: null, live: null, dtOpen: null };
  const nid = (p, w = 5) => { S.seq[p] = (S.seq[p] || 0) + 1; return `${p}-${String(S.seq[p]).padStart(w, "0")}`; };
  const ev = (kind, text, extra = {}) => { const e = { seq: (S.seq.ev = (S.seq.ev || 0) + 1), t: now(), at: fmt(now()), kind, text, ...extra }; S.events.push(e); if (S.events.length > 2000) S.events.shift(); return e; };
  const prob = (status, title, detail = "") => ({ status, data: { type: "https://plant.example/problems/" + title.replace(/ /g, "-"), title, status, detail }, ct: "application/problem+json" });
  const ok = (status, data) => ({ status, data, ct: "application/json" });

  /* ---------- work orders + lots */
  function makeLot(id, wo, route, code, qty) {
    const L = { id, wo: wo.id, route, code, fam: (prodInfo(code) || {}).fam || "", qty, qty0: qty, status: wo.status === "created" ? "planned" : "queued", i: 0, hold: null, heat: "",
      ops: routeOps(route, code), serials: [], t0: now(), tDone: null, machine: "", started: false };
    if (L.ops[0]) L.ops[0].qtyIn = qty;
    S.lots[id] = L; wo.lots.push(id); return L;
  }
  function createWO(b, idOverride) {
    const p = prodInfo(b.product);
    if (!p) return prob(400, "unknown product", "product = code from PRODUCTS6 (e.g. BS-3210-1000-C5) or BS | BN | LG | LB | FABS | FALG");
    const qty = Math.round(+b.qty || 0);
    if (!(qty >= 1 && qty <= 5000)) return prob(422, "quantity out of range", "1 … 5000");
    const due = b.dueT != null ? +b.dueT : b.dueDays != null ? now() + +b.dueDays * 86400 : opts.parseDue && b.due ? opts.parseDue(b.due) : now() + 5 * 86400;
    const id = idOverride || nid("WO");
    const wo = { id, erpOrder: b.erpOrder || "", product: p.code, route: p.route, qty, due, dueAt: fmt(due), priority: +b.priority || 5, routingVersion: `R-${p.route}-01`, status: "created",
      created: now(), createdAt: fmt(now()), released: null, done: null, lines: [], lots: [], source: b.source || "api", good: 0 };
    S.wo[id] = wo;
    const lines = SETS[p.route] ? [...SETS[p.route].map(([r, k]) => { const pc = (p.parts.find((x) => prodInfo(x[0]).route === r) || [r])[0]; return { route: r, code: prodInfo(pc).code, need: qty * k }; }), { route: p.route, code: p.code, need: qty }]
      : [{ route: p.route, code: p.code, need: qty }];
    for (const ln of lines) {
      ln.start = SETS[ln.route] ? ln.need : Math.ceil(ln.need / routeYield(ln.route) - EPS); ln.lots = [];
      if (Array.isArray(b.lots)) continue;
      const n = Math.ceil(ln.start / LOT6[ln.route]);
      for (let k = 0; k < n; k++) { const q = Math.min(LOT6[ln.route], ln.start - k * LOT6[ln.route]); const L = makeLot(`${id}-${ln.route}-${String(k + 1).padStart(2, "0")}`, wo, ln.route, ln.code, q); ln.lots.push(L.id); }
    }
    if (Array.isArray(b.lots)) for (const x of b.lots) { const ln = lines.find((l) => l.route === x.route); if (!ln) continue; const L = makeLot(x.id, wo, x.route, ln.code, +x.qty || 1); ln.lots.push(L.id); }
    wo.lines = lines;
    ev("wo", `${id} created: ${qty} × ${p.code}, due ${wo.dueAt}${wo.erpOrder ? " (ERP " + wo.erpOrder + ")" : ""}`, { wo: id });
    if (b.release) releaseWO(wo, true);
    return ok(201, woView(wo));
  }
  function readiness(wo) {
    const items = [];
    for (const ln of wo.lines) {
      if (SETS[ln.route]) { items.push({ kind: "material", item: `components for ${ln.route}`, ok: true, text: "made in this work order (component lots)" }); continue; }
      const free = S.heats.filter((h) => h.route === ln.route).reduce((s, h) => s + h.qty - h.used, 0);
      items.push({ kind: "material", item: `${ln.route} raw material (heat lots)`, ok: free >= ln.start, text: `need ${ln.start}, free ${free}` });
      const fam = (prodInfo(ln.code) || {}).fam;
      for (const o of routeOps(ln.route, ln.code)) if (TOOLSETS[o.m]) items.push({ kind: "tool", item: `${o.m} wheel + dresser set ${fam}`, ok: TOOLSETS[o.m].includes(fam), text: TOOLSETS[o.m].includes(fam) ? "in the tool store, measured" : "NOT available – order the dresser / wheel set" });
      for (const g of GAUGES6) if (routeOps(ln.route, ln.code).some((o) => o.m === g.type)) items.push({ kind: "gauge", item: `${g.id} ${g.n}`, ok: g.due > TODAY6, text: `calibration due ${g.due}` });
    }
    return { ok: items.every((i) => i.ok), items };
  }
  function releaseWO(wo, force) {
    if (wo.status !== "created") return prob(409, "wrong state", `${wo.id} is '${wo.status}', only 'created' can be released`);
    const r = readiness(wo);
    if (!r.ok && !force) return { status: 422, data: { type: "https://plant.example/problems/not-ready", title: "not ready", status: 422, detail: r.items.filter((i) => !i.ok).map((i) => i.item + ": " + i.text).join("; "), readiness: r }, ct: "application/problem+json" };
    for (const id of wo.lots) { const L = S.lots[id]; if (L.status === "planned") L.status = "queued"; if (!L.heat) assignHeat(L); }
    wo.status = "released"; wo.released = now(); wo.releasedAt = fmt(now());
    ev("wo", `${wo.id} released (${wo.lots.length} lots)${!r.ok ? " – FORCED, not ready: " + r.items.filter((i) => !i.ok).map((i) => i.item).join(", ") : ""}`, { wo: wo.id });
    return ok(200, { ...woView(wo), readiness: r });
  }
  function assignHeat(L) {      // material issue: FIFO from the heat lots; the ERP keeps at least one full heat lot in stock (demo goods receipt)
    if (SETS[L.route] || L.heat) return;
    const h = S.heats.find((x) => x.route === L.route && x.qty - x.used >= L.qty) || receiveHeat(L.route);
    if (!h) return;
    h.used += L.qty; L.heat = h.heat;
    const base = HEATS.find((x) => x.route === L.route), free = S.heats.filter((x) => x.route === L.route).reduce((s, x) => s + x.qty - x.used, 0);
    if (base && free < base.qty) receiveHeat(L.route);
  }
  function receiveHeat(route) {
    const b = HEATS.find((x) => x.route === route); if (!b) return null;
    const n = (S.seq["heat" + route] = (S.seq["heat" + route] || 0) + 1), h = { ...b, heat: b.heat[0] + String(+b.heat.slice(1) + 100 + 7 * n), used: 0, received: fmt(now()), note: "goods receipt (demo)" };
    S.heats.push(h);
    const same = S.heats.filter((x) => x.route === route); if (same.length > 12) { const old = same.find((x) => x.used >= x.qty); if (old) S.heats.splice(S.heats.indexOf(old), 1); }
    return h;
  }
  function woView(wo) {
    const lots = wo.lots.map((id) => S.lots[id]).filter(Boolean), ops = [];
    for (const ln of wo.lines) { const ls = lots.filter((l) => l.route === ln.route); const tmpl = ls[0] ? ls[0].ops : routeOps(ln.route, ln.code);
      tmpl.forEach((o, j) => ops.push({ op: o.no, machineType: o.m, route: ln.route, name: o.n, status: ls.length && ls.every((l) => l.ops[j] && l.ops[j].status === "done") ? "done" : ls.some((l) => l.ops[j] && l.ops[j].status !== "open") ? "running" : "open",
        good: ls.reduce((s, l) => s + (l.ops[j] ? l.ops[j].good : 0), 0), scrap: ls.reduce((s, l) => s + (l.ops[j] ? l.ops[j].scrap : 0), 0) })); }
    return { id: wo.id, erpOrder: wo.erpOrder, product: wo.product, route: wo.route, material: wo.product, qty: wo.qty, due: wo.dueAt, dueT: wo.due, priority: wo.priority, routingVersion: wo.routingVersion,
      status: wo.status, created: wo.createdAt, released: wo.releasedAt || null, good: wo.good, lines: wo.lines.map((l) => ({ route: l.route, code: l.code, need: l.need, start: l.start, lots: l.lots })),
      lots: wo.lots, operations: ops, holds: lots.filter((l) => l.hold).map((l) => l.id), source: wo.source };
  }
  const woRow = (w) => ({ id: w.id, erpOrder: w.erpOrder, product: w.product, route: w.route, material: w.product, qty: w.qty, due: w.dueAt, dueT: w.due, status: w.status, good: w.good, lots: w.lots.length, source: w.source,
    holds: w.lots.filter((id) => S.lots[id] && S.lots[id].hold).length });
  const lotView = (L) => ({ ...L, ops: L.ops.map((o) => ({ ...o })), woProduct: (S.wo[L.wo] || {}).product, dueT: (S.wo[L.wo] || {}).due, due: (S.wo[L.wo] || {}).dueAt, opNow: L.ops[L.i] ? L.ops[L.i].no : "", mNow: L.ops[L.i] ? L.ops[L.i].m : "" });

  /* ---------- confirmations (good / scrap / time) */
  function confirm(b, source) {
    let L = b.lot ? S.lots[b.lot] : null, wo = L ? S.wo[L.wo] : S.wo[b.wo];
    if (b.lot && !L) return prob(404, "unknown lot", String(b.lot));
    if (!wo) return prob(404, "unknown work order", String(b.wo));
    if (!["released", "running"].includes(wo.status)) return prob(409, "wrong state", `${wo.id} is '${wo.status}'`);
    const g = Math.round(+b.good || 0), s = Math.round(+b.scrap || 0);
    if (g < 0 || s < 0) return prob(400, "negative quantity");
    const opNo = String(b.op ?? ""), mt = b.machine ? String(b.machine).replace(/-\d+$/, "") : "";
    if (!L) {
      const lots = wo.lots.map((id) => S.lots[id]);
      L = lots.find((l) => l.ops.some((o) => o.no === opNo && o.m === mt && o.status !== "done")) || lots.find((l) => l.ops.some((o) => o.no === opNo && o.status !== "done")) || lots.find((l) => l.ops.some((o) => o.no === opNo));
    }
    const j = L ? (opNo ? L.ops.findIndex((o) => o.no === opNo && (!mt || o.m === mt)) : L.i) : -1, jj = j >= 0 ? j : L ? L.ops.findIndex((o) => o.no === opNo) : -1;
    if (!L || jj < 0) return prob(422, "unknown operation", opNo);
    if (L.hold && source !== "twin") return prob(423, "lot on hold", `${L.id}: ${L.hold.reason}`);
    const op = L.ops[jj];
    op.good += g; op.scrap += s; op.machine = b.machine || op.machine; if (op.tStart == null) op.tStart = b.tStart ?? now(); op.status = "running"; L.started = true;
    if (!op.qtyIn) op.qtyIn = L.qty;
    const c = { id: nid("CF"), wo: wo.id, lot: L.id, op: op.no, machine: b.machine || "", good: g, scrap: s, setupMin: +b.setupMin || 0, runMin: +b.runMin || 0, source: source || b.source || "api",
      serial: b.serial || "", grade: b.grade || "", t: now(), at: fmt(now()) };
    S.conf.push(c); if (S.conf.length > 20000) S.conf.splice(0, S.conf.length - 20000);
    if (wo.status === "released") wo.status = "running";
    if (b.serial && S.ser[b.serial] && b.grade) S.ser[b.serial].grade = b.grade;
    if (op.good + op.scrap >= op.qtyIn || b.final) finishOp(L, jj, b.tEnd ?? now());
    return ok(201, c);
  }
  function finishOp(L, j, tEnd) {
    const op = L.ops[j]; op.status = "done"; op.tEnd = tEnd; L.qty = op.good;
    if (op.no === MARK_OP[L.route]) makeSerials(L, op.good, op.machine);
    if (L.route === "BN" || L.route === "LB" || L.route === "LG") useKanban(L.route, op, op.good);
    if (j === L.i) { L.i = j + 1; while (L.i < L.ops.length && L.ops[L.i].status === "done") L.i++; }
    if (L.ops[L.i]) L.ops[L.i].qtyIn = L.qty;
    if (L.qty <= 0) { L.status = "scrapped"; L.tDone = tEnd; ev("lot", `${L.id} fully scrapped at op ${op.no}`, { lot: L.id }); }
    else if (L.i >= L.ops.length) { L.status = "done"; L.tDone = tEnd; lotDone(L); }
    else if (!L.hold) L.status = "queued";
  }
  function lotDone(L) {
    const wo = S.wo[L.wo]; ev("lot", `${L.id} done: ${L.qty} good ${L.code}`, { lot: L.id });
    if (wo && wo.route === L.route) { wo.good += L.qty; S.fg.push({ id: nid("FG"), lot: L.id, wo: wo.id, code: L.code, qty: L.qty, t: now(), at: fmt(now()), auto: true }); if (opts.erp) try { opts.erp({ type: "GR", material: L.code, qty: L.qty, order: wo.id }); } catch (e) { /* demo */ } }
    if (wo && wo.lots.every((id) => ["done", "scrapped"].includes(S.lots[id].status)) && wo.status !== "done") { wo.status = "done"; wo.done = now(); ev("wo", `${wo.id} done (${wo.good} good of ${wo.qty})`, { wo: wo.id }); }
  }

  /* ---------- serials + genealogy */
  const prefixOf = (L) => (SETS[L.route] ? SERIAL6.prefix[L.route] : L.code.split("-").slice(0, 2).join(""));
  function newSerial(L) { const d = opts.dateOf ? opts.dateOf(now()) : "261113", k = prefixOf(L) + "-" + d; S.serialNo[k] = (S.serialNo[k] || 0) + 1; return `${k}-${String(S.serialNo[k]).padStart(4, "0")}`; }
  function makeSerials(L, n, machine) {
    const out = [], kind = (prodInfo(L.code) || {}).kind || "part";
    n = Math.max(0, Math.min(n, L.qty0 * 2) - L.serials.length);
    for (let i = 0; i < n; i++) {
      const sn = newSerial(L), lbl = gs1Element({ serial: sn, lot: L.id.slice(0, 20), code: L.code, date: opts.dateOf ? opts.dateOf(now()) : "261113" });
      const s = { sn, code: L.code, kind, route: L.route, lot: L.id, wo: L.wo, heat: L.heat, status: "ok", parent: "", children: [], grade: "", t: now(), at: fmt(now()), machine: machine || "", label: lbl.hr };
      if (SETS[L.route]) link(s, L);
      S.ser[sn] = s; L.serials.push(sn); out.push(s);
    }
    const keys = Object.keys(S.ser); if (keys.length > 8000) for (const k of keys.slice(0, keys.length - 8000)) delete S.ser[k];
    return out;
  }
  function link(s, L) {   // assembly: take free component serials (same work order first, FIFO)
    for (const [r, k] of SETS[L.route]) {
      for (let i = 0; i < k; i++) {
        const free = Object.values(S.ser).filter((x) => x.route === r && !x.parent && x.status === "ok");
        const c = free.find((x) => x.wo === L.wo) || free[0];
        if (c) { c.parent = s.sn; s.children.push(c.sn); } else s.children.push(`(missing ${r})`);
      }
    }
    if (L.route === "FALG") s.match = "rail + 2 carriages matched: height class H, pair variation ≤ 15 µm (example)";
  }
  function linkManual(parent, children) {
    const p = S.ser[parent]; if (!p) return prob(404, "unknown serial", parent);
    const bad = children.filter((c) => !S.ser[c]); if (bad.length) return prob(404, "unknown serial", bad.join(", "));
    const used = children.filter((c) => S.ser[c].parent && S.ser[c].parent !== parent); if (used.length) return prob(409, "already built in", used.map((c) => `${c} → ${S.ser[c].parent}`).join(", "));
    for (const c of children) { S.ser[c].parent = parent; if (!p.children.includes(c)) p.children.push(c); }
    ev("trace", `scan: ${children.join(", ")} built into ${parent}`); return ok(200, traceSerial(parent));
  }
  function opsOfSerial(s) {
    const L = S.lots[s.lot]; if (!L) return [];
    return L.ops.filter((o) => o.status !== "open").map((o) => ({ op: o.no, name: o.n, machine: o.machine, good: o.good, scrap: o.scrap, start: o.tStart != null ? fmt(o.tStart) : "", end: o.tEnd != null ? fmt(o.tEnd) : "", gate: o.gate }));
  }
  function node(sn, depth = 0) {
    const s = S.ser[sn]; if (!s) return { sn, missing: true };
    const L = S.lots[s.lot], h = S.heats.find((x) => x.heat === s.heat);
    return { sn, code: s.code, kind: s.kind, lot: s.lot, wo: s.wo, heat: s.heat, heatInfo: h ? { mat: h.mat, mill: h.mill, cert: h.cert } : null, status: s.status, grade: s.grade, created: s.at, label: s.label, match: s.match || "",
      lotStatus: L ? L.status : "", ops: opsOfSerial(s), qa: opts.qa ? opts.qa(sn, s) : [], children: depth < 3 ? s.children.map((c) => node(c, depth + 1)) : [] };
  }
  function traceSerial(sn) { const s = S.ser[sn]; if (!s) return null; return { serial: sn, parent: s.parent || "", root: s.parent ? s.parent : sn, tree: node(s.parent || sn), self: node(sn) }; }
  function traceHeat(heat) {
    const parts = Object.values(S.ser).filter((s) => s.heat === heat), lots = [...new Set(parts.map((s) => s.lot))], asm = [...new Set(parts.map((s) => s.parent).filter(Boolean))];
    const h = S.heats.find((x) => x.heat === heat);
    return { heat, info: h || null, lots, serials: parts.map((s) => s.sn), assemblies: asm, count: parts.length, lotsAll: Object.values(S.lots).filter((L) => L.heat === heat).map((L) => L.id) };
  }

  /* ---------- holds (quality link) */
  function hold(L, reason, by, ncr) { if (!L) return prob(404, "unknown lot"); if (["done", "scrapped"].includes(L.status)) return prob(409, "wrong state", `${L.id} is ${L.status}`);
    L.hold = { reason: reason || "quality hold", by: by || "quality", ncr: ncr || "", t: now(), at: fmt(now()) }; L.status = "hold"; ev("quality", `HOLD ${L.id}: ${L.hold.reason}`, { lot: L.id }); return ok(200, lotView(L)); }
  function unhold(L, by, text) { if (!L) return prob(404, "unknown lot"); if (!L.hold) return prob(409, "not on hold", L.id);
    ev("quality", `RELEASE ${L.id} (was: ${L.hold.reason}) by ${by || "quality"}${text ? " – " + text : ""}`, { lot: L.id }); L.hold = null; L.status = L.i >= L.ops.length ? "done" : "queued"; return ok(200, lotView(L)); }
  function qaSync(records, ncrs) {      // NOK gate result → hold the lot of that serial; open NCR → block; 2 of the last 3 NOK of one char on one machine → SPC stop
    let n = 0;
    for (const r of records || []) {
      if (r.decision !== "NOK") continue;
      const s = S.ser[r.serial], L = s ? S.lots[s.lot] : r.lot ? S.lots[r.lot] : null;
      if (L && !L.hold && !["done", "scrapped"].includes(L.status)) { hold(L, `QA NOK ${r.char} = ${r.value} ${r.unit || ""} (serial ${r.serial})`, "QA (item 5)"); n++; }
    }
    for (const c of ncrs || []) {
      if (c.status === "closed") continue;
      const s = S.ser[c.serial], L = s ? S.lots[s.lot] : null;
      if (L && (!L.hold || !L.hold.ncr)) { hold(L, `NCR ${c.id}: ${String(c.text).slice(0, 60)}`, "QA (item 5)", c.id); n++; }
    }
    const by = {}; for (const r of records || []) if (r.machine && r.char) (by[r.machine + "|" + r.char] = by[r.machine + "|" + r.char] || []).push(r);
    for (const [k, v] of Object.entries(by)) { const last = v.slice(-3), bad = last.filter((r) => r.decision === "NOK").length, [mid, ch] = k.split("|");
      if (bad >= 2 && S.mach[mid] && !S.mach[mid].spcStop) { S.mach[mid].spcStop = { char: ch, t: now(), at: fmt(now()), text: `${bad} of the last 3 ${ch} NOK` }; ev("quality", `SPC STOP ${mid}: ${bad} of the last 3 ${ch} NOK – no dispatch`); n++; } }
    return n;
  }

  /* ---------- machines: download, SPC, downtime, andon */
  function download(mid, b) {
    const M = S.mach[mid]; if (!M) return prob(404, "unknown machine", mid);
    if (M.spcStop) return prob(423, "machine stopped by SPC", `${mid}: ${M.spcStop.text} – quality must release it`);
    const L = S.lots[b.lot]; if (!L) return prob(404, "unknown lot", String(b.lot));
    if (L.hold) return prob(423, "lot on hold", `${L.id}: ${L.hold.reason}`);
    const op = L.ops[L.i]; if (!op || op.m !== M.type) return prob(422, "wrong machine type", `${L.id} next op ${op ? op.no + " needs " + op.m : "none"}, machine is ${M.type}`);
    const body = { id: mid, cmd: "order", order: L.id.slice(0, 20), part: L.code.slice(0, 20), qty: L.qty, recipe: +op.no, msgId: b.msgId || `${L.id}/${op.no}/${mid}` };
    const res = opts.gateway ? opts.gateway(mid, body) : null;
    M.download = { lot: L.id, op: op.no, qty: L.qty, t: now(), at: fmt(now()), body, result: res, base: 0 };
    if (!res || res.ok) { M.lot = L.id; L.status = "running"; L.machine = mid; op.machine = mid; op.status = "running"; if (op.tStart == null) op.tStart = now(); ev("machine", `order download ${L.id} op ${op.no} → ${mid} (${res ? "ACK " + res.resultText : "simulated"})`, { lot: L.id }); }
    return ok(res && !res.ok ? 422 : 200, { machine: mid, lot: L.id, op: op.no, command: body, gateway: res, simulated: !res });
  }
  function downtimeAdd(b) {
    const M = S.mach[b.machine]; if (!M) return prob(404, "unknown machine", String(b.machine));
    const R = REASON_BY_CODE[String(b.reason)]; if (!R) return prob(400, "unknown reason", "see GET /api/bsf/mes/reasons");
    const end = b.end ?? now(), start = b.start ?? end - (+b.minutes || 0) * 60;
    if (!(end >= start)) return prob(400, "end before start");
    const d = { id: nid("DT"), machine: M.id, type: M.type, start, end, min: r2((end - start) / 60, 1), reason: R.code, reasonText: R.text, cat: R.cat, oee: R.oee, source: b.source || "terminal", comment: b.comment || "", by: b.by || "operator", startAt: fmt(start), endAt: fmt(end) };
    S.dt.push(d); if (S.dt.length > 5000) S.dt.shift(); ev("downtime", `${M.id} ${d.min} min ${R.code} ${R.text}`); return ok(201, d);
  }
  function classify(id, reason, by) { const d = S.dt.find((x) => x.id === id) || (Object.values(S.mach).map((m) => m.dtOpen).find((x) => x && x.id === id)); if (!d) return prob(404, "unknown downtime", id);
    const R = REASON_BY_CODE[String(reason)]; if (!R) return prob(400, "unknown reason"); Object.assign(d, { reason: R.code, reasonText: R.text, cat: R.cat, oee: R.oee, by: by || "operator", classified: true }); ev("downtime", `${d.machine} ${d.id} classified ${R.code} ${R.text} by ${d.by}`); return ok(200, d); }
  const STATE_COLOR = { RUN: "green", SETUP: "blue", IDLE: "grey", OFF: "grey", STARVED: "yellow", BLOCKED: "yellow", DOWN: "red" };
  function andon() {
    const ms = Object.values(S.mach).map((M) => { const l = M.live || {}; const st = l.state || M.state;
      return { id: M.id, type: M.type, state: st, color: M.spcStop ? "red" : STATE_COLOR[st] || "grey", lot: l.lot || M.lot || "", op: l.op || "", pcs: l.pcsLot ? `${l.pcsDone}/${l.pcsLot}` : "", progress: l.progress || 0,
        alarm: l.alarm || 0, alarmText: l.alarmText || "", since: l.since ?? null, spcStop: M.spcStop, dt: M.dtOpen ? { id: M.dtOpen.id, reason: M.dtOpen.reason, text: M.dtOpen.reasonText, classified: !!M.dtOpen.classified } : null,
        call: S.calls.filter((c) => c.machine === M.id && !c.done).map((c) => c.kind), oee: l.oee ? l.oee.OEE : null }; });
    const cnt = {}; for (const m of ms) cnt[m.color] = (cnt[m.color] || 0) + 1;
    const k = S.twin.kpi || {};
    return { t: now(), at: fmt(now()), machines: ms, count: cnt, calls: S.calls.filter((c) => !c.done), holds: Object.values(S.lots).filter((L) => L.hold).map((L) => ({ lot: L.id, reason: L.hold.reason })),
      targets: k.target ? { today: k.outToday || {}, target: k.target } : null, spcStops: ms.filter((m) => m.spcStop).map((m) => m.id) };
  }

  /* ---------- OEE + reports */
  function oeeMachine(M) {
    const l = M.live; if (!l || !l.t) return null;
    const t = l.t, PBT = (t.run + t.setup + t.down + t.blocked + t.starved) / 60;
    if (PBT <= 0) return { id: M.id, type: M.type, PBT: 0, A: 0, E: 0, Q: 0, OEE: 0 };
    const E = l.oee ? l.oee.P : 0, Q = l.oee ? l.oee.Q : 0, run = t.run / 60;
    const A = run / PBT;
    return { id: M.id, type: M.type, PBT: r2(PBT, 1), run: r2(run, 1), setup: r2(t.setup / 60, 1), down: r2(t.down / 60, 1), starved: r2(t.starved / 60, 1), blocked: r2(t.blocked / 60, 1),
      A: r2(A, 4), E: r2(E, 4), Q: r2(Q, 4), OEE: r2(A * E * Q, 4), speedLoss: r2(run * (1 - E), 1), qualityLoss: r2(run * E * (1 - Q), 1), good: l.good, scrap: l.scrap, energy: l.energy_kWh };
  }
  function oee(q = {}) {
    const rows = Object.values(S.mach).map(oeeMachine).filter((r) => r && r.PBT > 0);
    // A = Σ APT / Σ PBT; E and Q weighted by APT over the machines that finished parts in the window (a machine without a finished part says nothing about speed / quality)
    const agg = (list) => { const P = list.reduce((s, r) => s + r.PBT, 0); if (!P) return null; const run = list.reduce((s, r) => s + (r.run || 0), 0), wq = list.filter((r) => r.E > 0 && r.Q > 0), wr = wq.reduce((s, r) => s + r.run, 0);
      const A = run / P, E = wr ? wq.reduce((s, r) => s + r.E * r.run, 0) / wr : 0, Q = wr ? wq.reduce((s, r) => s + r.Q * r.run, 0) / wr : 0;
      return { PBT: r2(P, 1), A: r2(A, 4), E: r2(E, 4), Q: r2(Q, 4), OEE: r2(A * E * Q, 4), n: list.length, nEQ: wq.length }; };
    const types = {}; for (const r of rows) (types[r.type] = types[r.type] || []).push(r);
    const areaOf = (t) => (MTYPES[t] || {}).area || "other", areas = {}; for (const r of rows) (areas[areaOf(r.type)] = areas[areaOf(r.type)] || []).push(r);
    const sel = q.machine ? rows.filter((r) => r.id === q.machine) : q.type ? rows.filter((r) => r.type === q.type) : rows;
    return { machines: sel, types: Object.fromEntries(Object.entries(types).map(([k, v]) => [k, agg(v)])), lines: Object.fromEntries(Object.entries(areas).map(([k, v]) => [k, agg(v)])), plant: agg(rows),
      formula: "OEE = A × E × Q (ISO 22400-2): A = APT / PBT, E = PRI × PQ / APT, Q = GQ / PQ; PBT = run + set-up + down + blocked + starved; line / plant: A = Σ APT / Σ PBT, E and Q weighted by APT of the machines with finished parts" };
  }
  function pareto(t0 = -Infinity) {
    const by = {};
    for (const d of S.dt) if (d.end >= t0) { const k = d.reason; by[k] = by[k] || { reason: k, text: d.reasonText, min: 0, n: 0 }; by[k].min += Math.min(d.min, (d.end - Math.max(t0, d.start)) / 60); by[k].n++; }
    for (const M of Object.values(S.mach)) if (M.dtOpen) { const d = M.dtOpen, k = d.reason; by[k] = by[k] || { reason: k, text: d.reasonText, min: 0, n: 0 }; by[k].min += (now() - Math.max(t0, d.start)) / 60; by[k].n++; }
    const list = Object.values(by).map((x) => ({ ...x, min: r2(x.min, 1) })).sort((a, b) => b.min - a.min), tot = list.reduce((s, x) => s + x.min, 0); let cum = 0;
    return list.map((x) => { cum += x.min; return { ...x, pct: tot ? r2((100 * x.min) / tot, 1) : 0, cum: tot ? r2((100 * cum) / tot, 1) : 0 }; });
  }
  function report(q = {}) {
    const shiftLen = 7.5 * 3600, tEnd = now(), t0 = q.from != null ? +q.from : tEnd - (q.hours ? +q.hours * 3600 : shiftLen);
    const cf = S.conf.filter((c) => c.t >= t0), out = {}, scrapBy = {};
    for (const c of cf) { const L = S.lots[c.lot]; if (!L) continue; const op = L.ops.find((o) => o.no === c.op); if (op && L.ops[L.ops.length - 1] === op) out[L.route] = (out[L.route] || 0) + c.good;
      if (c.scrap > 0) { const k = `${L.route} ${c.op} ${op ? op.n : ""}`.trim(); scrapBy[k] = (scrapBy[k] || 0) + c.scrap; } }
    const k = S.twin.kpi || {};
    return { from: fmt(t0), to: fmt(tEnd), hours: r2((tEnd - t0) / 3600, 2), output: out, confirmations: cf.length, scrapByCause: Object.entries(scrapBy).map(([c, n]) => ({ cause: c, pcs: n })).sort((a, b) => b.pcs - a.pcs),
      downtime: pareto(t0), oee: oee().plant, wip: k.wip || null, little: k.little || null, leadTime_h: k.leadTime_h ?? null, kWhPerSet: k.kWhPerSet ?? null, energyPerDay_kWh: k.energyPerDay_kWh ?? null,
      holds: Object.values(S.lots).filter((L) => L.hold).length, spcStops: Object.values(S.mach).filter((M) => M.spcStop).map((M) => M.id), events: S.events.filter((e) => e.t >= t0).slice(-30) };
  }

  /* ---------- scheduling from the MES state */
  function schedInput(b = {}) {
    const t = now(), machines = {}, lots = [];
    const downUntil = (M) => { const l = M.live; if (l && l.state === "DOWN") return Math.max(30, (l.mttr_h || 2) * 60 - (t - (l.since ?? t)) / 60); return 0; };
    for (const [type, ids] of Object.entries(MACH_BY_TYPE)) machines[type] = ids.map((id) => { const M = S.mach[id], l = M.live || {}, ht = (MTYPES[type] || {}).shifts3 || false;
      return { id, free: M.spcStop ? 1e7 : downUntil(M), ht, lastKey: l.part && l.op ? `${l.part}/${l.op}` : "", lastFam: "" }; });
    for (const L of Object.values(S.lots)) {
      if (["done", "scrapped"].includes(L.status) || L.hold) continue;
      const wo = S.wo[L.wo]; if (!wo || wo.status === "created" || wo.status === "cancelled") continue;
      const ops = L.ops.slice(L.i).map((o) => ({ no: o.no, m: o.m, setup: o.setup, setupMinor: o.setupMinor, cyc: o.cyc, batch: o.batch, furnace: o.furnace, key: `${L.code}/${o.no}`, fam: o.fam }));
      if (!ops.length) continue;
      const live = L.machine && S.mach[L.machine] && S.mach[L.machine].live, run = L.status === "running" && L.machine && MACH_BY_TYPE[ops[0].m] && MACH_BY_TYPE[ops[0].m].includes(L.machine);
      let fixed = null;
      if (run) { const o = ops[0], done = live && live.lot && String(live.lot).includes(L.id) ? live.pcsDone || 0 : 0; fixed = { machine: L.machine, end: Math.max(1, o.furnace ? o.cyc * o.batch * (1 - ((live && live.progress) || 0)) : (L.qty - done) * o.cyc) }; }
      lots.push({ id: L.id, wo: L.wo, code: L.code, route: L.route, qty: L.qty, due: (wo.due - t) / 60, release: 0, started: L.started || L.i > 0, fixed, ops });
    }
    return { rule: b.rule || "EDD", tod0: opts.tod0 ? opts.tod0() : 0, shifts: opts.shifts ? opts.shifts() : 2, calendar: "shift", transfer: b.transfer ?? 30, dbr: b.dbr ? { drum: b.drum || "BS-TGR", bufferMin: (b.bufferH ?? 16) * 60 } : null, machines, lots };
  }
  function runSchedule(b = {}) {
    if (b.case) { const r = schedule(b.case); return ok(200, { case: true, ...r }); }
    const inp = schedInput(b), r = schedule(inp);
    const prev = S.sched ? S.sched.kpi : null;
    S.sched = { t: now(), at: fmt(now()), rule: inp.rule, dbr: !!inp.dbr, reason: b.reason || "manual", ops: r.ops, kpi: r.kpi, lots: r.lots, tod0: inp.tod0, shifts: inp.shifts, prev };
    if (b.compare) S.sched.compare = ["EDD", "SPT", "CR", "FIFO", "FAM"].flatMap((rule) => [false, true].map((d) => { const k = { ...schedule({ ...inp, rule, dbr: d ? { drum: "BS-TGR", bufferMin: (b.bufferH ?? 16) * 60 } : null }).kpi }; delete k.dbr; return { rule, dbr: d, kpi: k }; }));
    ev("schedule", `schedule ${inp.rule}${inp.dbr ? " + DBR" : ""} (${b.reason || "manual"}): ${r.ops.length} operations, on time ${r2(r.kpi.onTimePct, 1)} %, ${r.kpi.majors} set-ups, BS-TGR ${r2(100 * (r.kpi.util["BS-TGR"] || 0), 1)} %`);
    return ok(200, S.sched);
  }
  function dispatch(mid) {
    const M = S.mach[mid]; if (!M) return prob(404, "unknown machine", mid);
    const held = Object.values(S.lots).filter((L) => L.hold && L.ops[L.i] && L.ops[L.i].m === M.type).map((L) => ({ lot: L.id, reason: L.hold.reason }));
    if (M.spcStop) return ok(200, { machine: mid, machineType: M.type, blocked: M.spcStop, items: [], held, generated: fmt(now()) });
    let items = [];
    if (S.sched) items = S.sched.ops.filter((o) => o.machine === mid && S.lots[o.lot] && !S.lots[o.lot].hold && S.lots[o.lot].status !== "done").sort((a, b) => a.start - b.start)
      .map((o, i) => { const L = S.lots[o.lot], w = S.wo[L.wo] || {}; return { seq: i + 1, wo: L.wo, lot: o.lot, op: o.no, product: L.code, qty: o.qty, setup: o.setup, setupKind: o.setupKind, startIn_min: r2(o.start, 0), due: w.dueAt, load: o.load || "" }; });
    if (!items.length) items = Object.values(S.lots).filter((L) => !L.hold && ["queued", "running"].includes(L.status) && L.ops[L.i] && L.ops[L.i].m === M.type).sort((a, b) => (S.wo[a.wo] || {}).due - (S.wo[b.wo] || {}).due)
      .map((L, i) => ({ seq: i + 1, wo: L.wo, lot: L.id, op: L.ops[L.i].no, product: L.code, qty: L.qty, setup: L.ops[L.i].setup, due: (S.wo[L.wo] || {}).dueAt }));
    return ok(200, { machine: mid, machineType: M.type, items: items.slice(0, 30), held, from: S.sched ? "schedule " + S.sched.at : "queue (EDD)", generated: fmt(now()) });
  }

  /* ---------- logistics: transport, kanban, FG */
  function transport(b) {
    if (!b.from || !b.to || b.from === b.to) return prob(400, "from and to needed (different stations)");
    const r = { id: nid("TR"), lot: b.lot || "", from: b.from, to: b.to, priority: +b.priority || 5, state: "REQUESTED", t: now(), at: fmt(now()), agvOrder: null };
    if (opts.agv) { try { const a = opts.agv({ from: b.from, to: b.to, load: b.lot || "", priority: r.priority }); if (a) { r.agvOrder = a.id; r.state = a.state || "CREATED"; } } catch (e) { r.state = "AGV fleet not reachable"; } }
    S.tr[r.id] = r; ev("logistics", `transport ${r.id} ${r.lot} ${r.from} → ${r.to} (AGV order ${r.agvOrder || "-"})`); return ok(201, r);
  }
  function useKanban(route, op, n) {
    for (const k of Object.values(S.kb)) {
      if (k.use !== route || op.no !== { BN: "80", LB: "80", LG: "100" }[route]) continue;
      k.used += n * k.per;
      while (k.used >= k.C && k.full > 0) { k.used -= k.C; k.full--; kbSignal(k, "consumed"); }
    }
  }
  function kbSignal(k, why) { k.signals++; const due = now() + k.LT * 86400; k.pending.push({ id: nid("KB"), t: now(), due, dueAt: fmt(due) }); ev("logistics", `kanban ${k.item}: bin empty (${why}) → replenishment signal, ${k.full}/${k.N} full`); }
  function kbTick() { const t = now(); for (const k of Object.values(S.kb)) { const arr = k.pending.filter((p) => p.due <= t); if (arr.length) { k.pending = k.pending.filter((p) => p.due > t); k.full = Math.min(k.N, k.full + arr.length); } } }
  function kanbanView() { kbTick(); return { items: Object.values(S.kb).map((k) => ({ item: k.item, n: k.n, per: k.per, use: k.use, D: k.D, LT: k.LT, a: k.a, C: k.C, N: k.N, full: k.full, empty: k.N - k.full, open: k.pending.length, signals: k.signals, sup: k.sup,
    red: k.full <= Math.ceil(k.N * 0.3), formula: `N = ceil(${k.D} × ${k.LT} × ${1 + k.a} / ${k.C}) = ${k.N}` })) }; }
  function fgBook(b) {
    const L = S.lots[b.lot]; if (!L) return prob(404, "unknown lot", String(b.lot));
    if (L.status !== "done") return prob(409, "lot not finished", `${L.id} is ${L.status}`);
    const qty = Math.round(+b.qty || L.qty); if (qty <= 0 || qty > L.qty) return prob(422, "quantity", `1 … ${L.qty}`);
    const f = { id: nid("FG"), lot: L.id, wo: L.wo, code: L.code, qty, t: now(), at: fmt(now()), auto: false, erp: null };
    if (opts.erp) { try { f.erp = opts.erp({ type: "GR", material: L.code, qty, order: L.wo }); } catch (e) { f.erp = { error: String(e.message || e) }; } }
    S.fg.push(f); ev("logistics", `FG booking ${f.id}: ${qty} × ${L.code} (lot ${L.id})`); return ok(201, f);
  }
  function htLoad(b) {
    const T = String(b.furnace || ""), lots = (b.lots || []).map((id) => S.lots[id]);
    if (!["HT-TMP", "HT-CAR"].includes(T)) return prob(400, "furnace must be HT-TMP or HT-CAR");
    if (!lots.length || lots.some((L) => !L)) return prob(404, "unknown lot", (b.lots || []).filter((id) => !S.lots[id]).join(", ") || "lots: [...] needed");
    const wrong = lots.filter((L) => !L.ops[L.i] || L.ops[L.i].m !== T); if (wrong.length) return prob(422, "lot not at this furnace", wrong.map((L) => `${L.id} next ${L.ops[L.i] ? L.ops[L.i].m : "-"}`).join(", "));
    const cap = lots[0].ops[lots[0].i].batch, q = lots.reduce((s, L) => s + L.qty, 0); if (q > cap) return prob(422, "load too big", `${q} pcs > capacity ${cap}`);
    const h = { id: nid("HT"), furnace: T, machine: b.machine || MACH_BY_TYPE[T][0], lots: lots.map((L) => L.id), qty: q, cap, fill: r2(q / cap, 3), program: T === "HT-TMP" ? "temper 170 °C 2 h" : "carburise 930 °C, 0.8 %C, quench, temper 170 °C", t: now(), at: fmt(now()), status: "built", source: b.source || "planner" };
    S.ht[h.id] = h; ev("heat", `furnace load ${h.id} ${T}: ${h.lots.join(" + ")} = ${q}/${cap} pcs`); return ok(201, h);
  }

  /* ---------- the twin = shop floor (state every 2 s → confirmations, downtime, loads) */
  function twinSync(snap) {
    const t = now(); let nConf = 0, nDt = 0, nWo = 0;
    S.twin.t = snap.t; if (snap.kpi) S.twin.kpi = snap.kpi;
    for (const o of snap.orders || []) {
      let id = S.twin.orders[o.id];
      if (!id) { const r = createWO({ product: o.product, qty: o.qty, dueT: o.due, erpOrder: o.id, source: "twin", lots: [] }, "WO-T" + String(o.id).replace(/\D/g, "").padStart(4, "0"));
        if (r.status !== 201) continue; id = r.data.id; S.twin.orders[o.id] = id; const w = S.wo[id]; w.status = "released"; w.released = t; w.releasedAt = fmt(t); nWo++; }
      const w = S.wo[id]; if (w && o.done != null) w.good = Math.max(w.good, +o.done || 0); if (w && (o.state === "complete" || o.state === "shipped") && w.status !== "done") { w.status = "done"; w.done = t; }
    }
    const todo = [], xs = {};
    for (const x of snap.lots || []) {
      const woId = S.twin.orders[x.order]; if (!woId || !S.wo[woId]) continue;
      const wo = S.wo[woId]; let L = S.lots[x.id];
      if (!L) { const ln = wo.lines.find((l) => l.route === x.route); L = makeLot(x.id, wo, x.route, ln ? ln.code : prodInfo(x.route).code, x.qty0 || x.qty); if (ln) ln.lots.push(L.id); L.status = "queued"; assignHeat(L); }
      const seen = S.twin.lotSeen[x.id] || 0, h = x.h || [];
      for (let i = seen; i < h.length; i++) todo.push([L, h[i]]);
      S.twin.lotSeen[x.id] = h.length; xs[L.id] = x;
    }
    todo.sort((a, b) => a[1][3] - b[1][3]);       // confirm in time order (components before the assembly that uses them)
    for (const [L, e] of todo) {
      const [opNo, mid, tIn, tOut, good, scrap] = e;
      if (!L.ops.some((o, jj) => o.no === String(opNo) && o.status !== "done" && jj >= L.i)) continue;
      const r = confirm({ lot: L.id, op: String(opNo), machine: mid, good, scrap, runMin: r2((tOut - tIn) / 60, 1), tStart: tIn, tEnd: tOut, final: true }, "twin");
      if (r.status === 201) nConf++;
    }
    for (const [id, x] of Object.entries(xs)) { const L = S.lots[id];
      if (L && !L.hold && L.status !== "done" && L.status !== "scrapped") { L.machine = x.machine || ""; if (["run", "setup"].includes(x.state)) L.status = "running"; else if (["agv", "move", "wait-agv"].includes(x.state)) L.status = "moving"; else if (x.state === "queue" || x.state === "blocked") L.status = "queued"; } }
    for (const m of snap.machines || []) {
      const M = S.mach[m.id]; if (!M) continue;
      const prev = M.live ? M.live.state : null; M.live = m; M.state = m.state; M.lot = m.lot || "";
      if (m.state === "DOWN" && prev !== "DOWN" && !M.dtOpen) { const rc = alarmReason(m.alarm), R = REASON_BY_CODE[rc]; M.dtOpen = { id: nid("DT"), machine: M.id, type: M.type, start: m.since ?? t, end: null, reason: rc, reasonText: R.text, cat: R.cat, oee: R.oee, source: "gateway (alarm " + (m.alarm || 0) + ")", alarmText: m.alarmText || "", comment: "", by: "auto", classified: false, startAt: fmt(m.since ?? t) }; nDt++; ev("downtime", `${M.id} DOWN alarm ${m.alarm} ${m.alarmText || ""} → reason ${rc} (operator to confirm)`); }
      if (m.state !== "DOWN" && M.dtOpen) { const d = M.dtOpen; d.end = t; d.endAt = fmt(t); d.min = r2((d.end - d.start) / 60, 1); S.dt.push(d); if (S.dt.length > 5000) S.dt.shift(); M.dtOpen = null; }
      if ((m.type === "HT-TMP" || m.type === "HT-CAR") && m.lot && m.state === "RUN") {
        const key = m.id + "|" + m.lot;
        if (!S.ht[key]) { const ids = m.lot.split(","), ls = ids.map((id) => S.lots[id]).filter(Boolean);
          const fill = ls.reduce((s, L) => { const o = L.ops.find((op) => op.m === m.type); return s + (o ? L.qty / o.batch : 0); }, 0);
          S.ht[key] = { id: "HT-" + m.id.slice(3) + "-" + String(Object.keys(S.ht).length + 1).padStart(4, "0"), furnace: m.type, machine: m.id, lots: ids, qty: ls.reduce((s, L) => s + L.qty, 0), fill: r2(fill, 3),
            program: m.type === "HT-TMP" ? "temper 170 °C 2 h" : "carburise 930 °C, 0.8 %C, quench, temper 170 °C", t, at: fmt(t), status: "running", source: "twin" };
          const ks = Object.keys(S.ht); if (ks.length > 300) delete S.ht[ks[0]]; }
      }
    }
    kbTick();
    for (const id of Object.keys(S.lots)) { const L = S.lots[id]; if (["done", "scrapped"].includes(L.status) && L.tDone != null && t - L.tDone > 3 * 86400) { delete S.lots[id]; delete S.twin.lotSeen[id]; } }
    for (const id of Object.keys(S.wo)) { const w = S.wo[id]; if (w.status === "done" && w.done != null && t - w.done > 4 * 86400) delete S.wo[id]; }
    return { orders: nWo, confirmations: nConf, downtime: nDt };
  }

  /* ---------- seed (server-like start data: 3 work orders like the item-4 demo, WO-00001 released) */
  function seed() {
    createWO({ product: "BS", qty: 20, dueDays: 2, erpOrder: "PO-260001" }); releaseWO(S.wo["WO-00001"], true);
    createWO({ product: "LG", qty: 50, dueDays: 3, erpOrder: "PO-260002" }); releaseWO(S.wo["WO-00002"], true);
    createWO({ product: "LB", qty: 100, dueDays: 4, erpOrder: "PO-260003" });
  }

  /* ---------- router (same paths as the server) */
  function eval6(b) {
    if (b.kind === "oee") return ok(200, oeeISO(b));
    if (b.kind === "schedule") return ok(200, schedule(b.case || b));
    if (b.kind === "kanban") return ok(200, { N: Math.ceil(b.D * b.LT * (1 + b.a) / b.C - EPS) });
    if (b.kind === "little") return ok(200, { WIP: b.TH * b.LT, LT: b.WIP != null ? b.WIP / b.TH : null });
    return prob(400, "unknown kind", "oee | schedule | kanban | little");
  }
  function page(items, q, base) { const p = Math.max(1, +q.page || 1), s = Math.max(1, Math.min(200, +q.size || 20)), out = { items: items.slice((p - 1) * s, p * s), page: p, size: s, total: items.length }; if (p * s < items.length) out.next = `${base}?page=${p + 1}&size=${s}`; return out; }
  function route(method, path, q = {}, b = {}, headers = {}) {
    path = path.replace("/api/bsf/v1/", "/api/bsf/");
    const P = path.replace(/^\/api\/bsf\/mes\/?/, "").split("/").filter(Boolean), res = P[0] || "", id = P[1] ? decodeURIComponent(P[1]) : "", act = P[2] || "";
    const key = method === "POST" ? headers["Idempotency-Key"] || b.msgId || "" : "";
    if (key && S.idem.has(key)) return { ...S.idem.get(key), status: 200, data: { ...S.idem.get(key).data, replay: true } };
    let r;
    try { r = route2(method, res, id, act, q, b); } catch (e) { r = prob(500, "internal error", String(e && e.message || e)); }
    if (key && (r.status === 200 || r.status === 201)) { S.idem.set(key, r); if (S.idem.size > 3000) S.idem.delete(S.idem.keys().next().value); }
    return r;
  }
  function route2(method, res, id, act, q, b) {
    const G = method === "GET";
    if (G && (res === "" || res === "health")) return ok(200, { ok: true, version: VERSION6, mode: "browser demo", workorders: Object.keys(S.wo).length, lots: Object.keys(S.lots).length, serials: Object.keys(S.ser).length, confirmations: S.conf.length, persist: null, t: fmt(now()) });
    if (G && res === "api") return ok(200, { version: VERSION6, routes: API6 });
    if (res === "workorders" && !id) {
      if (G) { const items = Object.values(S.wo).filter((w) => !q.status || w.status === q.status).sort((a, b) => (a.id < b.id ? 1 : -1)).map(woRow); return ok(200, page(items, q, "/api/bsf/mes/workorders")); }
      if (method === "POST") return createWO(b);
    }
    if (res === "workorders" && id) { const w = S.wo[id]; if (!w) return prob(404, "unknown work order", id);
      if (G && !act) return ok(200, woView(w)); if (method === "POST" && act === "release") return releaseWO(w, !!b.force);
      if (method === "POST" && act === "cancel") { if (w.status !== "created") return prob(409, "wrong state", "only 'created' can be cancelled"); w.status = "cancelled"; ev("wo", `${w.id} cancelled: ${b.reason || ""}`); return ok(200, woView(w)); } }
    if (res === "lots" && !id && G) return ok(200, { items: Object.values(S.lots).filter((L) => (!q.wo || L.wo === q.wo) && (!q.status || L.status === q.status)).slice(-500).map((L) => ({ id: L.id, wo: L.wo, route: L.route, code: L.code, qty: L.qty, status: L.status, op: L.ops[L.i] ? L.ops[L.i].no : "", m: L.ops[L.i] ? L.ops[L.i].m : "", hold: L.hold, heat: L.heat })) });
    if (res === "lots" && id) { const L = S.lots[id]; if (!L) return prob(404, "unknown lot", id); if (G) return ok(200, lotView(L)); if (act === "hold") return hold(L, b.reason, b.by, b.ncr); if (act === "release") return unhold(L, b.by, b.text); }
    if (res === "dispatch" && G) return dispatch(q.machine || "BS-TGR-01");
    if (res === "confirmations") { if (method === "POST") return confirm(b, b.source || "api"); return ok(200, { items: S.conf.filter((c) => !q.lot || c.lot === q.lot).slice(-(+q.n || 50)) }); }
    if (res === "schedule") { if (method === "POST") return runSchedule(b); return S.sched ? ok(200, S.sched) : prob(404, "no schedule yet", "POST /api/bsf/mes/schedule first"); }
    if (res === "machines" && !id && G) return ok(200, { items: Object.values(S.mach).map((M) => ({ id: M.id, type: M.type, state: M.state, lot: M.lot, download: M.download, spcStop: M.spcStop, dtOpen: M.dtOpen })) });
    if (res === "machines" && id) { if (act === "download") return download(id, b); if (act === "spc") { const M = S.mach[id]; if (!M) return prob(404, "unknown machine", id); M.spcStop = b.alarm ? { char: b.char || "", t: now(), at: fmt(now()), text: b.text || `SPC alarm ${b.char || ""}` } : null; ev("quality", `SPC ${b.alarm ? "STOP" : "release"} ${id} ${b.char || ""}`); return ok(200, { id, spcStop: M.spcStop }); }
      if (G) { const M = S.mach[id]; return M ? ok(200, M) : prob(404, "unknown machine", id); } }
    if (res === "downtime") { if (method === "POST" && !id) return downtimeAdd(b); if (method === "POST" && act === "reason") return classify(id, b.reason, b.by);
      return ok(200, { items: [...S.dt, ...Object.values(S.mach).map((m) => m.dtOpen).filter(Boolean)].filter((d) => (!q.machine || d.machine === q.machine) && (!q.open || d.end == null)).slice(-(+q.n || 200)) }); }
    if (res === "reasons" && G) return ok(200, { items: REASONS.map((r) => ({ code: r[0], text: r[1], cat: r[2], oee: r[3] })) });
    if (res === "andon") { if (method === "POST" && id === "call") { const c = { id: nid("AC"), machine: b.machine, kind: b.kind || "supervisor", t: now(), at: fmt(now()), done: false }; S.calls.push(c); ev("andon", `call ${c.kind} at ${c.machine}`); return ok(201, c); }
      if (method === "POST" && id === "ack") { const c = S.calls.find((x) => x.id === b.id); if (!c) return prob(404, "unknown call"); c.done = true; return ok(200, c); } return ok(200, andon()); }
    if (res === "oee" && G) return ok(200, oee(q));
    if (res === "report" && G) return ok(200, report(q));
    if (res === "pareto" && G) return ok(200, { items: pareto() });
    if (res === "serials") { if (method === "POST") { const L = S.lots[b.lot]; if (!L) return prob(404, "unknown lot", String(b.lot)); const n = Math.max(1, Math.min(200, +b.n || 1)); const made = makeSerials(L, n + L.serials.length > L.qty0 * 2 ? 0 : n, b.machine); return ok(201, { lot: L.id, items: made.map((s) => ({ ...s, gs1: gs1Element({ serial: s.sn, lot: L.id.slice(0, 20), code: s.code }) })) }); }
      return ok(200, { items: Object.values(S.ser).filter((s) => !q.lot || s.lot === q.lot).slice(-(+q.n || 200)) }); }
    if (res === "genealogy" && id === "link" && method === "POST") return linkManual(b.parent, b.children || []);
    if (res === "trace" && G) { if (q.heat) return ok(200, traceHeat(q.heat)); const tr = traceSerial(q.serial || ""); return tr ? ok(200, tr) : prob(404, "unknown serial", q.serial || ""); }
    if (res === "htloads") { if (method === "POST") return htLoad(b); return ok(200, { items: Object.values(S.ht).slice(-60) }); }
    if (res === "transport") { if (method === "POST") return transport(b); return ok(200, { items: Object.values(S.tr).slice(-60) }); }
    if (res === "kanban") { if (method === "POST" && act === "scan") { const k = S.kb[id]; if (!k) return prob(404, "unknown kanban item", id); if (k.full <= 0) return prob(409, "no full bin left", id); k.full--; kbSignal(k, "scanned"); return ok(200, kanbanView().items.find((x) => x.item === id)); } return ok(200, kanbanView()); }
    if (res === "fg") { if (method === "POST") return fgBook(b); return ok(200, { items: S.fg.slice(-60) }); }
    if (res === "twin" && method === "POST") return ok(200, twinSync(b));
    if (res === "eval" && method === "POST") return eval6(b);
    if (res === "events" && G) return ok(200, { items: S.events.filter((e) => e.seq > (+q.since || 0)).slice(-200) });
    if (res === "control" && method === "POST") { if (b.action === "reset") { const k = createMES(opts); Object.assign(S, k._S); return ok(200, { reset: true }); } return prob(400, "unknown action", "reset"); }
    if (res === "sync" && method === "POST") return ok(200, { gateway: false, note: "browser demo: the twin feeds the MES (POST /api/bsf/mes/twin)" });
    return prob(404, "not found", "/api/bsf/mes/" + [res, id, act].filter(Boolean).join("/"));
  }
  return { S, _S: S, route, seed, createWO, releaseWO, confirm, twinSync, runSchedule, schedInput, dispatch, andon, oee, pareto, report, traceSerial, traceHeat, qaSync, hold, unhold, download, readiness, kanbanView, woView, lotView };
}
