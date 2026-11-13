/* Ball screw + guide factory – item 6 "MES" (#bfItem6).  Guide: docs/45_bsf_mes.md
 * Files: bsfmes.js (UI, twin feed, self-check) · bsfmes_data.js (SHARED MES data model – item 7 ERP + item 8 import it) · bsfmes_core.js (scheduler, OEE,
 *   MES state + local router = browser twin of the server) · bsfmes_view.js (SVG / HTML renders) · bsfmes_card.js (CARD6 + build vs buy) · bsfmes.css ·
 *   server (optional): twin/bsf_mes.py + twin/bsf_mes_core.py – routes /api/bsf/mes/... in server.py. Without the server the page runs the SAME MES in the
 *   browser ("demo mode") – every call below goes through mes(), which uses the server when it answers and the local router otherwise.
 * Lazy: built on window event "bfitemshow" (detail "6"). Live data = window.BSF (item 3): every 2 s the shop-floor state (orders, lots with their
 *   operation history, 73 machine states) goes to the MES (POST /api/bsf/mes/twin) → work orders, confirmations, serials, downtime, furnace loads.
 * URL: /?bfitem=6#bsf · &bf6card=model|wo|sched|term|andon|qual|log|perf|trace|api|buy (scroll) · &bf6only=<same>|card (test-only: one card) · &bf6m=BS-TGR-03 ·
 *   &bf6sn=<serial> · &bf6rule=EDD|SPT|CR|FIFO|FAM · &bf6zoom=480|1440|4320|10080 · &bf6demo (force browser demo) · &bf6test (self-check, console "BF6TEST …" +
 *   #bf6Debug) · &bf6hold (headless: keep the load pending, show the tab) · card: &bf6tab=draw|buy|shop · &bf6box=N.
 * Offline. ALL VALUES ARE EXAMPLES – check with your MES team.
 */
import { getBSF } from "./bsfsim.js";
import { MACHINES, MTYPES } from "./bsfmfg_data.js";
import { NET_BY_ID, reqRead, reqWrite1, reqWriteN, asciiToRegs, encodeValue, hex, decodeFrame, adu, RESULTS } from "./bsfcomm_map.js";
import { CHARS } from "./bsfqa_data.js";
import { NOTE6, PRODUCTS6, prodInfo, ENTITIES, WO_STATES, LOT_STATES, REASONS, ISA95, MESA11, ROLES, SERIAL6, gs1Element, GATEWAY6, API6, CHECK6, SAMPLE_WO } from "./bsfmes_data.js";
import { createMES, schedule, oeeISO, calendar, VERSION6, routeOps } from "./bsfmes_core.js";
import { esc, gantt, pareto, lossBars, bars, tree, labelSvg, RCOL } from "./bsfmes_view.js";
import { CARD6, BUILD_BUY } from "./bsfmes_card.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const host = $("bfItem6");
const errs = [];
const f0 = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "), f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2), f3 = (v) => (+v).toFixed(3);
const pc = (v, d = 1) => (v == null || !Number.isFinite(+v) ? "–" : (100 * v).toFixed(d) + " %");
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "k-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf6-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
if (Q.has("bf6test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf6hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf6hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("6"); }, 300); }
const visible = () => host && !host.hidden && (!window.bfCtl || window.bfCtl.tabVisible());

/* ------------------------------------------------------------------ HTTP: server MES or the browser twin of it */
async function api(method, path, body, headers = {}, timeout = 6000) {
  const t0 = performance.now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(path, { method, headers: body != null ? { "Content-Type": "application/json", ...headers } : headers, body: body != null ? JSON.stringify(body) : undefined, cache: "no-store", signal: ac.signal });
    const ct = r.headers.get("Content-Type") || "", txt = await r.text(); let data = txt; try { if (ct.includes("json")) data = JSON.parse(txt); } catch (e) { /* text */ }
    return { status: r.status, ok: r.ok, data, ct, ms: performance.now() - t0, via: "server" };
  } finally { clearTimeout(to); }
}
let built = false, B = null, LM = null, be = { on: false, reachable: false, info: null, forced: Q.has("bf6demo") };
async function mes(method, path, body, headers = {}) {
  if (be.on) {
    try { const r = await api(method, path, body, headers); if (r.status !== 404 || (r.data && r.data.title)) return r; } catch (e) { be.on = false; be.reachable = false; badge(); }
  }
  const u = new URL(path, location.origin), q = Object.fromEntries(u.searchParams), t0 = performance.now();
  const r = LM.route(method, u.pathname, q, body || {}, headers);
  return { status: r.status, ok: r.status < 400, data: r.data, ct: r.ct + "; charset=utf-8", ms: performance.now() - t0, via: "browser demo" };
}
async function checkBackend() {
  try { const r = await api("GET", "/api/bsf/mes/health", null, {}, 1500); be.reachable = r.ok && r.data && r.data.mode === "server"; be.info = be.reachable ? r.data : null; } catch (e) { be.reachable = false; be.info = null; }
  be.on = be.reachable && !be.forced; badge(); return be.on;
}
function badge() {
  const b = $("bf6Badge"); if (!b) return;
  const p = be.info && be.info.persist;
  b.textContent = be.on ? `MES server /api/bsf/mes: online · ${p && p.on ? (p.exists ? "SQLite " + p.path.split(/[\\/]/).pop() : "SQLite after the first change") : "no persistence"}${be.info.gateway ? " · gateway running" : ""}`
    : be.reachable ? "Browser demo chosen (the MES server is online – switch below)" : "Browser demo – the MES runs in this page with the live twin (start python server.py for the server MES)";
  b.className = "bf6-badge" + (be.on ? " on" : "");
  const sw = $("bf6Mode"); if (sw) { sw.hidden = !be.reachable; sw.textContent = be.on ? "use the browser demo" : "use the MES server"; }
}

/* ------------------------------------------------------------------ the twin = shop floor → MES */
const sent = { lots: {}, orders: {} };
const dateOf6 = (t) => { const d = new Date(Date.UTC(2026, 10, 9 + Math.floor((t || 0) / 86400) + 1)); return String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0"); };
function twinSnap(full = false) {
  const lots = [], orders = [];
  for (const L of B.lotsDone.slice(-160).concat(B.lots)) {      // oldest first (heat lots are issued FIFO)
    if (L.kind === "kit" || !L.order) continue;
    const k = L.h.length + "|" + L.state + "|" + L.machine;
    if (!full) { if (sent.lots[L.id] === k) continue; sent.lots[L.id] = k; }
    lots.push({ id: L.id, order: L.order, route: L.route, qty: L.qty, qty0: L.qty0, i: L.i, state: L.state, machine: L.machine, op: L.op, h: L.h.map((e) => e.slice()) });
  }
  for (const o of B.orders.slice(-80)) { if (!full) { if (sent.orders[o.id] === o.state) continue; sent.orders[o.id] = o.state; } orders.push({ id: o.id, product: o.product, qty: o.qty, due: o.due, state: o.state, done: o.done }); }
  const machines = B.M.map((m) => ({ id: m.id, type: m.type, state: m.state, alarm: m.alarm, alarmText: m.alarmText, lot: m.lot, op: m.op, part: m.part, pcsLot: m.pcsLot, pcsDone: m.pcsDone,
    progress: Math.round(m.progress * 1000) / 1000, since: m.since, good: m.good, scrap: m.scrap, t: { ...m.t }, oee: { ...m.oee }, mttr_h: m.mttr_h, energy_kWh: Math.round(m.energy_kWh * 10) / 10, power_kW: Math.round(m.power_kW * 10) / 10 }));
  const k = B.kpi();
  return { t: B.t, clock: B.clock(), orders, lots, machines, kpi: { wip: k.wip, little: k.little, leadTime_h: k.leadTime_h, kWhPerSet: k.kWhPerSet, energyPerDay_kWh: k.energyPerDay_kWh, target: k.target, outToday: k.outToday, oee: k.oee } };
}
let feeding = false, lastFeed = null, nFeed = 0, reschedFor = null;
async function feed() {
  if (feeding || !B) return; feeding = true;
  try {
    const snap = twinSnap();
    if (be.on) { const r = await api("POST", "/api/bsf/mes/twin", snap, {}, 15000); lastFeed = r.data; } else lastFeed = LM.twinSync(snap);
    nFeed++;
    if (reschedFor) { const m = reschedFor; reschedFor = null; await doSchedule(`breakdown ${m}`); }
  } catch (e) { if (be.on) { be.on = false; badge(); Object.keys(sent.lots).forEach((k) => delete sent.lots[k]); Object.keys(sent.orders).forEach((k) => delete sent.orders[k]); } }
  feeding = false;
}
function resetSent() { for (const k of Object.keys(sent.lots)) delete sent.lots[k]; for (const k of Object.keys(sent.orders)) delete sent.orders[k]; }

/* demo hooks of the local MES: measurement records (example values from the control plan, item 5), AGV transport orders */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; };
function qaDemo(sn, s) {
  const L = LM && LM.S.lots[s.lot], done = L ? L.ops.filter((o) => o.status === "done").map((o) => o.no) : [];
  return CHARS.filter((c) => c.part === s.route && done.includes(c.op)).slice(0, 8).map((c) => {
    const u = hash(sn + c.id), lo = c.lsl, hi = c.usl;
    const v = lo != null && hi != null ? lo + (hi - lo) * (0.25 + 0.5 * u) : hi != null ? hi * (0.25 + 0.5 * u) : lo != null ? lo * (1.05 + 0.2 * u) : u;
    const op = L ? L.ops.find((o) => o.no === c.op) : null;
    return { char: c.id, name: c.name, value: +v.toFixed(3), unit: c.unit, lsl: lo, usl: hi, decision: "OK", op: c.op, machine: op ? op.machine : "", gauge: c.gauge || "", source: "example (demo)" };
  });
}
const agvLocal = {};
function agvDemo(b) { const id = "TO-L" + String(Object.keys(agvLocal).length + 1).padStart(4, "0"); agvLocal[id] = { id, t: B.t, ...b }; return { id, state: "CREATED" }; }
const agvState = (id) => { const a = agvLocal[id]; if (!a) return null; const e = B.t - a.t; return e < 30 ? "CREATED" : e < 90 ? "ASSIGNED" : e < 240 ? "PICKING" : e < 600 ? "DELIVERING" : "FINISHED"; };
function newLocal() {
  return createMES({ now: () => B.t, fmt: (t) => B.clockOf(t), tod0: () => (((B.t % 86400) + 86400) % 86400) / 60, shifts: () => B.shifts, dateOf: dateOf6, qa: qaDemo, agv: agvDemo,
    parseDue: (s) => { const d = Date.parse(s); return Number.isFinite(d) ? B.t + Math.max(0, Math.min(30, (d - Date.parse("2026-11-13T06:00:00Z")) / 86400000)) * 86400 : null; } });
}

/* ------------------------------------------------------------------ build */
const SECTIONS = { model: "bf6Model", wo: "bf6Wo", sched: "bf6Sched", term: "bf6Term", andon: "bf6Andon", qual: "bf6Qual", log: "bf6Log", perf: "bf6Perf", trace: "bf6Trace", api: "bf6Api", buy: "bf6Buy" };
const AREAS = [["soft", "Soft machining"], ["ht", "Heat treatment"], ["grind", "Grinding room 20 ± 1 °C"], ["qc", "Metrology / QC"], ["assy", "Assembly + packing"]];
let selM = MACHINES.some((m) => m.id === Q.get("bf6m")) ? Q.get("bf6m") : "BS-TGR-03", selLot = "", selWo = "", sched = null, zoom = +Q.get("bf6zoom") || 1440, lastHs = null, schedLog = [];
function build() {
  if (built || !host) return; built = true;
  B = getBSF(); LM = newLocal();
  const prodOpts = PRODUCTS6.map((p) => `<option value="${esc(p.code)}"${p.code === SAMPLE_WO.product ? " selected" : ""}>${esc(p.code)} – ${esc(p.n)}</option>`).join("");
  const mOpts = MACHINES.map((m) => `<option${m.id === selM ? " selected" : ""}>${esc(m.id)}</option>`).join("");
  const rOpts = REASONS.map((r) => `<option value="${r[0]}">${r[0]} ${esc(r[1])}</option>`).join("");
  host.innerHTML = `
  <div class="bf6-wrap">
    <div class="bf6-rule"><b>MES rule of this plant:</b> the MES talks <b>HTTP only</b> (REST + JSON, Server-Sent Events) to ERP, AGV fleet, label printers, QA and every browser / terminal,
      and reads + writes the 73 machines only through the <b>Modbus TCP gateway</b> of item 4 (counters, states, order download with the toggle-bit handshake). No MQTT, no OPC UA. ${esc(NOTE6)}
      <div class="bf6-bar"><span class="bf6-badge" id="bf6Badge">…</span> <button class="btn" id="bf6Mode" hidden>use the MES server</button> <span class="bf6-sub" id="bf6Feed"></span></div></div>

    <div class="card" id="bf6Model">
      <div class="card-head"><h2>1 · Data model + flow – from the ERP order to the serial number</h2><span class="bf6-sub">ISA-95 / IEC 62264 level 3 · ${ENTITIES.length} entities</span></div>
      <div class="bf6-two"><div><img class="bf6-img" src="img/45_mes_data_model.svg" alt="MES data model" loading="lazy"></div>
        <div><p class="bf6-hint"><b>Flow:</b> ERP production order → <b>work order</b> (product code, quantity, due date, routing version) → <b>lots</b> (transfer lot size of item 3:
          screw 20, nut 40, rail 50, carriage 100, sets 20 / 50) → one <b>operation</b> per routing step of item 2 on a machine type → <b>confirmations</b> (good / scrap / time) →
          <b>serial numbers</b> at the first marking operation → <b>genealogy</b> (heat lot → shaft → assembly ← nut; rail ↔ 2 matched carriages).</p>
          <p class="bf6-hint">Start quantity of a lot line = need / route yield (example BS: route yield Π(1 − scrap) = 0.938 → 40 / 0.938 = 42.7 → 43 = 3 lots 20 + 20 + 3). Before release the MES checks <b>material</b> (heat lots),
          <b>tools</b> (grinding wheel + dresser set of the family) and <b>gauges</b> (calibration due) – try product BS-4010-1500-C5: the Ø40×10 dresser is missing → 422 "not ready".</p></div></div>
      <details class="bf6-det" open><summary>Entities (the same in the browser and in twin/bsf_mes.py)</summary>${tbl(["Entity", "Key (example)", "Main fields", "Owner", "ISA-95 object"], ENTITIES.map((e) => e.map(esc)), "bf6-small")}</details>
      <details class="bf6-det"><summary>Life cycles – work order + lot</summary><div class="bf6-two"><div>${tbl(["WO state", "meaning", "next step by"], WO_STATES.map((r) => r.map(esc)), "bf6-small")}</div><div>${tbl(["Lot state", "meaning"], LOT_STATES.map((r) => r.map(esc)), "bf6-small")}</div></div></details>
      <details class="bf6-det"><summary>ISA-95 / IEC 62264-3 level-3 activities → this page → API</summary>${tbl(["Activity", "what the MES does here", "page", "HTTP"], ISA95.map((r) => r.map(esc)), "bf6-small")}
        <p class="bf6-hint"><b>MESA-11 functions:</b> ${MESA11.map((m) => `<b>${esc(m[0])}</b> (${esc(m[1])})`).join(" · ")}</p>
        ${tbl(["Role", "may do", "screen"], ROLES.map((r) => r.map(esc)), "bf6-small")}</details>
      <h3 class="bf6-h">Heat lots (raw material, goods receipt by ERP) + heat-treatment furnace loads</h3><div class="bf6-two"><div id="bf6Heats"></div><div id="bf6Ht"></div></div>
    </div>

    <div class="card" id="bf6Wo">
      <div class="card-head"><h2>2 · Work orders + lots (supervisor view)</h2><span class="bf6-sub" id="bf6WoSum"></span></div>
      <div class="bf6-bar"><label class="bf6-lbl">product <select id="bf6WP" aria-label="product">${prodOpts}</select></label>
        <label class="bf6-lbl">qty <input id="bf6WQ" type="number" min="1" max="5000" value="${SAMPLE_WO.qty}" style="width:70px" aria-label="quantity"></label>
        <label class="bf6-lbl">due in days <input id="bf6WD" type="number" min="0" max="60" step="0.5" value="5" style="width:60px" aria-label="due in days"></label>
        <label class="bf6-lbl">ERP order <input id="bf6WE" value="${SAMPLE_WO.erpOrder}" style="width:100px" aria-label="ERP order"></label>
        <button class="btn" id="bf6WNew">POST work order</button> <button class="btn" id="bf6WRel" disabled>release (readiness check)</button> <button class="btn" id="bf6WForce" disabled>release with force</button></div>
      <div class="bf6-pre" id="bf6WOut">Create a work order – the request and the answer appear here.</div>
      <div class="bf6-two"><div><div class="bf6-scroll" id="bf6WList"></div></div><div id="bf6WDet" class="bf6-info">Click a work order to see its lots and operations; click a lot for its details.</div></div>
    </div>

    <div class="card" id="bf6Sched">
      <div class="card-head"><h2>3 · Scheduling + dispatch – finite capacity, 73 machines</h2><span class="bf6-sub" id="bf6SSum"></span></div>
      <div class="bf6-bar"><label class="bf6-lbl">rule <select id="bf6Rule" aria-label="priority rule">${["EDD", "SPT", "CR", "FIFO", "FAM"].map((r) => `<option${r === (Q.get("bf6rule") || "EDD") ? " selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="bf6-lbl"><input type="checkbox" id="bf6Dbr"> drum-buffer-rope (drum BS-TGR, buffer <input id="bf6Buf" type="number" value="16" min="2" max="72" style="width:48px" aria-label="buffer hours"> h)</label>
        <button class="btn" id="bf6SRun">schedule now</button> <label class="bf6-lbl"><input type="checkbox" id="bf6Auto" checked> re-schedule on breakdown</label>
        <button class="btn" id="bf6Break">breakdown ${esc(selM)} (2 h)</button>
        <span class="bf6-lbl">zoom ${[[480, "8 h"], [1440, "1 day"], [4320, "3 days"], [10080, "7 days"]].map(([z, t]) => `<button class="btn bf6-z${z === zoom ? " on" : ""}" data-z="${z}">${t}</button>`).join("")}</span></div>
      <p class="bf6-sub2">EDD = earliest due date · SPT = shortest processing time · CR = critical ratio (time left / work left) · FIFO · FAM = keep the set-up family on the grinders (same lead / size → 1/3 set-up).
        Forward, non-delay: at every step the earliest possible operation starts; when several can start, the rule decides. Hatched = set-up, grey = no shift. Click a bar = lot details.</p>
      <div class="bf6-kpis" id="bf6Kpi"></div>
      <div class="bf6-gbox" id="bf6Gantt"></div>
      <div class="bf6-two"><div><h3 class="bf6-h">Rule comparison (same orders, same machines)</h3><div id="bf6Cmp"></div><div class="bf6-log" id="bf6SLog"></div></div>
        <div><h3 class="bf6-h">Dispatch list <select id="bf6DM" aria-label="machine">${mOpts}</select></h3><div id="bf6Disp"></div><img class="bf6-img" src="img/45_dbr.svg" alt="drum buffer rope" loading="lazy"></div></div>
    </div>

    <div class="card" id="bf6Term">
      <div class="card-head"><h2>4 · Machine terminal + interface (Modbus TCP gateway + HTTP)</h2><span class="bf6-sub">operator page – runs in the browser of the panel PC</span></div>
      <div class="bf6-bar"><label class="bf6-lbl">machine <select id="bf6TM" aria-label="terminal machine">${mOpts}</select></label> <span id="bf6TState"></span></div>
      <div class="bf6-two"><div>
        <div class="bf6-info" id="bf6TLot"></div>
        <div class="bf6-bar"><button class="btn" id="bf6TDl">download next lot to the machine</button> <button class="btn" id="bf6TStart">start (cmd 2)</button>
          <span class="bf6-mut">FC16 data → FC06 toggle → FC03 ACK (item 4)</span></div>
        <div class="bf6-bar"><label class="bf6-lbl">good <input id="bf6TG" type="number" value="1" min="0" style="width:56px" aria-label="good"></label><label class="bf6-lbl">scrap <input id="bf6TS" type="number" value="0" min="0" style="width:50px" aria-label="scrap"></label>
          <button class="btn" id="bf6TConf">confirm (POST confirmations)</button> <label class="bf6-lbl">scan serial <input id="bf6TScan" placeholder="BS3210-…" style="width:150px" aria-label="scan serial"></label></div>
        <div class="bf6-bar"><label class="bf6-lbl">downtime reason <select id="bf6TR" aria-label="downtime reason">${rOpts}</select></label><label class="bf6-lbl">min <input id="bf6TMin" type="number" value="15" min="1" style="width:56px" aria-label="minutes"></label>
          <input id="bf6TCom" placeholder="comment" style="width:140px" aria-label="comment"> <button class="btn" id="bf6TDt">book downtime</button></div>
        <div class="bf6-bar">andon call: ${["supervisor", "maintenance", "quality", "logistics"].map((k) => `<button class="btn bf6-call" data-call="${k}">${k}</button>`).join(" ")}</div>
        <div class="bf6-pre" id="bf6TOut">Terminal answers appear here.</div></div>
        <div><h3 class="bf6-h">Order download – handshake frames</h3><div id="bf6Hs" class="bf6-hs"><p class="bf6-mut">Press "download". With the server + gateway running (item 4 "start") these are REAL Modbus TCP frames; otherwise the page shows the same frames from a simulated machine.</p></div>
          <img class="bf6-img" src="img/45_machine_handshake.svg" alt="handshake sequence" loading="lazy"></div></div>
    </div>

    <div class="card" id="bf6Andon">
      <div class="card-head"><h2>5 · Andon board – 73 machines</h2><span class="bf6-sub" id="bf6ASum"></span></div>
      <div class="bf6-legend"><span class="bf6-dot green"></span>run <span class="bf6-dot blue"></span>set-up <span class="bf6-dot yellow"></span>starved / blocked <span class="bf6-dot red"></span>down / SPC stop <span class="bf6-dot grey"></span>idle / no shift · 📣 open call · ✋ downtime reason missing</div>
      <div id="bf6ABoard"></div><div class="bf6-two"><div id="bf6ATgt"></div><div id="bf6ACalls"></div></div>
    </div>

    <div class="card" id="bf6Qual">
      <div class="card-head"><h2>6 · Quality link – gate results, holds, NCR, SPC stop</h2><span class="bf6-sub">item 5 → MES</span></div>
      <p class="bf6-sub2">Rules (examples): a NOK result at a quality gate (<code>POST /api/bsf/qa/results</code>, item 5) puts the lot of that serial on <b>hold</b>; an open NCR <b>blocks</b> the lot;
        2 of the last 3 results of one characteristic on one machine NOK → <b>SPC stop</b>: the dispatch list of that machine is empty until quality releases it. Held lots are not scheduled and cannot be confirmed or downloaded (HTTP 423).</p>
      <div class="bf6-bar"><button class="btn" id="bf6QNok">simulate a gate NOK on a running lot</button> <button class="btn" id="bf6QSpc">simulate SPC alarm on BS-TGR-03</button> <span class="bf6-mut" id="bf6QMsg"></span></div>
      <div class="bf6-two"><div><h3 class="bf6-h">Lots on hold</h3><div id="bf6QHold"></div></div><div><h3 class="bf6-h">Machines stopped by SPC</h3><div id="bf6QSpcL"></div></div></div>
    </div>

    <div class="card" id="bf6Log">
      <div class="card-head"><h2>7 · Logistics link – AGV transport, kanban, finished goods</h2><span class="bf6-sub">HTTP to the AGV fleet + ERP</span></div>
      <div class="bf6-bar"><label class="bf6-lbl">lot <select id="bf6LLot" aria-label="lot"></select></label><label class="bf6-lbl">from <select id="bf6LFrom" aria-label="from">${["RAW", "SAW", "SOFT", "HT", "GRIND", "METRO", "ASSY", "PACK"].map((z) => `<option>${z}</option>`).join("")}</select></label>
        <label class="bf6-lbl">to <select id="bf6LTo" aria-label="to">${["RAW", "SAW", "SOFT", "HT", "GRIND", "METRO", "ASSY", "PACK"].map((z, i) => `<option${i === 3 ? " selected" : ""}>${z}</option>`).join("")}</select></label>
        <button class="btn" id="bf6LGo">POST transport request</button></div>
      <div class="bf6-two"><div><h3 class="bf6-h">Transport requests → AGV fleet (<code>POST /api/bsf/agv/transportorders</code>)</h3><div id="bf6LTr"></div><h3 class="bf6-h">Finished-goods bookings (→ ERP goods receipt)</h3><div id="bf6LFg"></div></div>
        <div><h3 class="bf6-h">Kanban / supermarket for bought parts</h3><div id="bf6LKb"></div><img class="bf6-img" src="img/45_kanban_loop.svg" alt="kanban loop" loading="lazy"></div></div>
    </div>

    <div class="card" id="bf6Perf">
      <div class="card-head"><h2>8 · Performance – OEE (ISO 22400), downtime Pareto, shift report, WIP + lead time</h2><span class="bf6-sub" id="bf6PSum"></span></div>
      <div class="bf6-two"><div class="bf6-info" id="bf6PEx"></div><div><img class="bf6-img" src="img/45_oee_loss_tree.svg" alt="OEE loss tree" loading="lazy"></div></div>
      <div class="bf6-two"><div><h3 class="bf6-h">OEE per machine type (live, A × E × Q per type) – target line 75 %</h3><div id="bf6POee"></div></div><div><h3 class="bf6-h">Plant loss tree (live)</h3><div id="bf6PLoss"></div><div id="bf6PLines"></div></div></div>
      <div class="bf6-two"><div><h3 class="bf6-h">Downtime Pareto (reason codes)</h3><div id="bf6PPar"></div></div><div><h3 class="bf6-h">Shift report (last 7.5 h)</h3><div id="bf6PRep"></div></div></div>
    </div>

    <div class="card" id="bf6Trace">
      <div class="card-head"><h2>9 · Trace search – serial → full genealogy with measurement records</h2><span class="bf6-sub">heat lot → part → assembly · where-used</span></div>
      <div class="bf6-bar"><input id="bf6Sn" placeholder="serial (A-BS-…, BS3210-…) or heat (H7741)" style="width:280px" aria-label="serial or heat"> <button class="btn" id="bf6SnGo">search</button> <span id="bf6SnChips"></span></div>
      <div class="bf6-two"><div id="bf6Tree" class="bf6-tree"><p class="bf6-mut">Pick a serial – the newest assembly serials appear as buttons after the first twin data arrive.</p></div>
        <div><h3 class="bf6-h">Label (GS1 Data Matrix element string)</h3><div id="bf6Lbl"></div><div class="bf6-pre" id="bf6Zpl"></div></div></div>
    </div>

    <div class="card" id="bf6Api">
      <div class="card-head"><h2>10 · API "try it" – real HTTP requests + JSON answers</h2><span class="bf6-sub">${API6.length} routes · /api/bsf/mes/… (also /api/bsf/v1/mes/…)</span></div>
      <div class="bf6-bar"><select id="bf6XEx" aria-label="example">${apiExamples().map((x, i) => `<option value="${i}">${esc(x[0])}</option>`).join("")}</select>
        <select id="bf6XM" aria-label="method"><option>GET</option><option>POST</option></select> <input id="bf6XP" style="width:340px" aria-label="path">
        <label class="bf6-lbl"><input type="checkbox" id="bf6XK"> Idempotency-Key</label> <button class="btn" id="bf6XGo">send</button></div>
      <textarea id="bf6XB" rows="4" class="bf6-ta" aria-label="request body"></textarea>
      <div class="bf6-two"><div><h3 class="bf6-h">Request</h3><div class="bf6-pre" id="bf6XReq"></div></div><div><h3 class="bf6-h">Response</h3><div class="bf6-pre" id="bf6XRes"></div></div></div>
      <details class="bf6-det"><summary>All routes</summary>${tbl(["Method", "Path", "What"], API6.map((r) => [`<b>${r[0]}</b>`, `<code>${esc(r[1])}</code>`, esc(r[2])]), "bf6-small")}</details>
    </div>

    <div class="card" id="bf6Buy">
      <div class="card-head"><h2>11 · Build or buy the MES? – honest comparison</h2><span class="bf6-sub">guide 45 §22</span></div>
      ${tbl(["Point", "Own MES (like this item)", "Bought MES product"], BUILD_BUY.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]))}
    </div>
    <div class="bf6-debug" id="bf6Debug" hidden></div>
  </div>`;
  try { makeCard(CARD6, host.querySelector(".bf6-wrap"), { card: "bfCard6", q: "bfQ6", g: "bfG6", cnt: "bfCnt6", buy: "bfBuy6" }, "bf6"); } catch (e) { console.error(e); }
  host.querySelector(".bf6-wrap").appendChild($("bf6Debug"));
  wire();
  renderStatic();
  checkBackend().then(async () => {
    await feed();
    await doSchedule("start");
    renderAll();
    if (Q.get("bf6sn")) traceSearch(Q.get("bf6sn"));
    if (Q.has("bf6test")) setTimeout(selfTest, 400);
  });
  B.on("alarm", (d) => { if (d.on && $("bf6Auto") && $("bf6Auto").checked) reschedFor = d.m.id; });
  setInterval(feed, 2000);
  setInterval(tick, 1000);
  if (SECTIONS[Q.get("bf6card")]) setTimeout(() => $(SECTIONS[Q.get("bf6card")]).scrollIntoView({ block: "start" }), 900);
  if (Q.get("bf6only")) { const k = Q.get("bf6only"); host.querySelectorAll(".bf6-wrap > .card, .bf6-wrap > .bf6-rule").forEach((c) => { c.hidden = !(c.id === SECTIONS[k] || (k === "card" && c.id === "bfCard6")); }); }
}

/* ------------------------------------------------------------------ wiring */
function wire() {
  $("bf6Mode").addEventListener("click", async () => { be.forced = be.on; be.on = !be.on && be.reachable; resetSent(); badge(); await feed(); await doSchedule("mode switch"); renderAll(); });
  $("bf6WNew").addEventListener("click", newWo);
  $("bf6WRel").addEventListener("click", () => releaseWo(false)); $("bf6WForce").addEventListener("click", () => releaseWo(true));
  $("bf6WList").addEventListener("click", (e) => { const r = e.target.closest("[data-wo]"); if (r) { selWo = r.dataset.wo; showWo(); } });
  $("bf6WDet").addEventListener("click", (e) => { const l = e.target.closest("[data-lot]"); if (l) showLot(l.dataset.lot); const h = e.target.closest("[data-hold]"); if (h) holdLot(h.dataset.hold); });
  $("bf6SRun").addEventListener("click", () => doSchedule("manual"));
  $("bf6Rule").addEventListener("change", () => doSchedule("rule changed")); $("bf6Dbr").addEventListener("change", () => doSchedule("DBR switched"));
  $("bf6Break").addEventListener("click", () => { B.setMachineDown(selM, true, 120); reschedFor = $("bf6Auto").checked ? selM : null; feed(); });
  host.querySelectorAll(".bf6-z").forEach((b) => b.addEventListener("click", () => { zoom = +b.dataset.z; host.querySelectorAll(".bf6-z").forEach((x) => x.classList.toggle("on", x === b)); renderGantt(); }));
  $("bf6Gantt").addEventListener("click", (e) => { const g = e.target.closest("[data-lot]"); if (g) { selLot = g.dataset.lot; renderGantt(); showLot(selLot); $("bf6Wo").scrollIntoView({ block: "start" }); } const m = e.target.closest("[data-m]"); if (m) setMachine(m.dataset.m); });
  $("bf6DM").addEventListener("change", (e) => setMachine(e.target.value)); $("bf6TM").addEventListener("change", (e) => setMachine(e.target.value));
  $("bf6TDl").addEventListener("click", downloadNext); $("bf6TStart").addEventListener("click", () => machineCmd("start"));
  $("bf6TConf").addEventListener("click", terminalConfirm); $("bf6TDt").addEventListener("click", terminalDowntime);
  $("bf6TScan").addEventListener("change", (e) => { traceSearch(e.target.value.trim()); });
  host.querySelectorAll(".bf6-call").forEach((b) => b.addEventListener("click", async () => { const r = await mes("POST", "/api/bsf/mes/andon/call", { machine: selM, kind: b.dataset.call }); out("bf6TOut", "POST /api/bsf/mes/andon/call", { machine: selM, kind: b.dataset.call }, r); renderAndon(); }));
  $("bf6TLot").addEventListener("click", async (e) => { const c = e.target.closest("[data-dtc]"); if (!c) return; const body = { reason: $("bf6TR").value, by: "operator (terminal)" }, r = await mes("POST", `/api/bsf/mes/downtime/${c.dataset.dtc}/reason`, body); out("bf6TOut", `POST /api/bsf/mes/downtime/${c.dataset.dtc}/reason`, body, r); renderTerminal(); });
  $("bf6ABoard").addEventListener("click", (e) => { const t = e.target.closest("[data-m]"); if (t) { setMachine(t.dataset.m); $("bf6Term").scrollIntoView({ block: "start" }); } });
  $("bf6ACalls").addEventListener("click", async (e) => { const a = e.target.closest("[data-ack]"); if (a) { await mes("POST", "/api/bsf/mes/andon/ack", { id: a.dataset.ack }); renderAndon(); } });
  $("bf6QNok").addEventListener("click", simNok); $("bf6QSpc").addEventListener("click", simSpc);
  $("bf6QHold").addEventListener("click", async (e) => { const b = e.target.closest("[data-rel]"); if (b) { await mes("POST", `/api/bsf/mes/lots/${b.dataset.rel}/release`, { by: "quality (page)", text: "re-measured OK" }); renderQuality(); } });
  $("bf6QSpcL").addEventListener("click", async (e) => { const b = e.target.closest("[data-spc]"); if (b) { await mes("POST", `/api/bsf/mes/machines/${b.dataset.spc}/spc`, { alarm: false }); renderQuality(); } });
  $("bf6LGo").addEventListener("click", async () => { const body = { lot: $("bf6LLot").value, from: $("bf6LFrom").value, to: $("bf6LTo").value, priority: 5 }; const r = await mes("POST", "/api/bsf/mes/transport", body); renderLogistics(); if (!r.ok) $("bf6LTr").insertAdjacentHTML("afterbegin", `<p class="bf6-nok">${esc(r.data.title)}: ${esc(r.data.detail)}</p>`); });
  $("bf6LKb").addEventListener("click", async (e) => { const b = e.target.closest("[data-kb]"); if (b) { await mes("POST", `/api/bsf/mes/kanban/${b.dataset.kb}/scan`, {}); renderLogistics(); } });
  $("bf6SnGo").addEventListener("click", () => traceSearch($("bf6Sn").value.trim()));
  $("bf6Sn").addEventListener("keydown", (e) => { if (e.key === "Enter") traceSearch($("bf6Sn").value.trim()); });
  $("bf6SnChips").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (b) traceSearch(b.dataset.q); });
  $("bf6Tree").addEventListener("click", (e) => { const s = e.target.closest("[data-sn]"); if (s) showLabel(s.dataset.sn); const h = e.target.closest("[data-heat]"); if (h) traceSearch(h.dataset.heat); });
  $("bf6XEx").addEventListener("change", fillExample); $("bf6XGo").addEventListener("click", sendTry); fillExample();
}
function setMachine(id) { selM = id; $("bf6DM").value = id; $("bf6TM").value = id; $("bf6Break").textContent = `breakdown ${id} (2 h)`; renderDispatch(); renderTerminal(); renderGantt(); }
function out(id, req, body, r) { $(id).textContent = `${req}${body != null ? "\n" + JSON.stringify(body, null, 1) : ""}\n\nHTTP ${r.status} (${r.via}${r.ms ? ", " + f1(r.ms) + " ms" : ""})\n${JSON.stringify(r.data, null, 1).slice(0, 3000)}`; }

/* ------------------------------------------------------------------ 1 + 2: static tables, work orders, lots */
function renderStatic() { /* nothing live */ }
async function renderModel() {
  const S = be.on ? null : LM.S;
  const heats = S ? S.heats : (await mes("GET", "/api/bsf/mes/health")) && null;
  if (heats) $("bf6Heats").innerHTML = tbl(["Heat", "Material", "Route", "Cert.", "Qty", "Used"], heats.map((h) => [`<b>${esc(h.heat)}</b>`, esc(h.mat), h.route, esc(h.cert), h.qty, h.used]), "bf6-small");
  else $("bf6Heats").innerHTML = `<p class="bf6-mut">Heat lots live in the MES server (used in readiness + genealogy). Trace a heat: <code>GET /api/bsf/mes/trace?heat=H7741</code>.</p>`;
  const r = await mes("GET", "/api/bsf/mes/htloads");
  const items = (r.data.items || []).slice(-8).reverse();
  $("bf6Ht").innerHTML = items.length ? tbl(["Load", "Furnace", "Lots", "Pcs", "Fill", "Program", "Start"], items.map((h) => [esc(h.id), esc(h.machine), esc(h.lots.join(" + ")), h.qty, pc(h.fill, 0), esc(h.program), esc(h.at)]), "bf6-small")
    : `<p class="bf6-mut">No furnace load yet – they appear when the twin starts a tempering / carburising load (several lots of the same temperature in one load).</p>`;
}
let lastWo = null;
async function newWo() {
  const body = { product: $("bf6WP").value, qty: +$("bf6WQ").value, dueDays: +$("bf6WD").value, erpOrder: $("bf6WE").value, priority: 5 }, key = uuid();
  const r = await mes("POST", "/api/bsf/mes/workorders", body, { "Idempotency-Key": key });
  out("bf6WOut", `POST /api/bsf/mes/workorders\nIdempotency-Key: ${key}`, body, r);
  if (r.status === 201) { lastWo = r.data.id; selWo = lastWo; $("bf6WRel").disabled = false; $("bf6WForce").disabled = false; }
  renderWo(); showWo();
}
async function releaseWo(force) {
  if (!lastWo) return;
  const r = await mes("POST", `/api/bsf/mes/workorders/${lastWo}/release`, force ? { force: true } : {});
  out("bf6WOut", `POST /api/bsf/mes/workorders/${lastWo}/release`, force ? { force: true } : {}, r);
  if (r.ok) { $("bf6WRel").disabled = true; $("bf6WForce").disabled = true; }
  renderWo(); showWo();
}
async function renderWo() {
  const r = await mes("GET", "/api/bsf/mes/workorders?size=40"), d = r.data;
  $("bf6WoSum").textContent = `${d.total} work orders (${r.via})`;
  $("bf6WList").innerHTML = tbl(["WO", "ERP", "Product", "Qty", "Good", "Due", "Status", "Lots", "Hold"], (d.items || []).map((w) => [`<a href="#" data-wo="${esc(w.id)}" onclick="return false"><b>${esc(w.id)}</b></a>`, esc(w.erpOrder), esc(w.product), w.qty, w.good, esc(w.due),
    `<span class="bf6-st ${esc(w.status)}">${esc(w.status)}</span>`, w.lots, w.holds ? `<b class="bf6-nok">${w.holds}</b>` : ""]), "bf6-small");
}
async function showWo() {
  if (!selWo) return;
  const r = await mes("GET", `/api/bsf/mes/workorders/${selWo}`); if (!r.ok) { $("bf6WDet").textContent = `${selWo}: ${r.data.title}`; return; }
  const w = r.data, lots = await Promise.all(w.lots.slice(0, 40).map((id) => mes("GET", `/api/bsf/mes/lots/${encodeURIComponent(id)}`)));
  $("bf6WDet").innerHTML = `<h3>${esc(w.id)} · ${esc(w.product)} × ${w.qty} · <span class="bf6-st ${esc(w.status)}">${esc(w.status)}</span></h3>
    <p class="bf6-mut">ERP ${esc(w.erpOrder || "–")} · due ${esc(w.due)} · routing ${esc(w.routingVersion)} · lines: ${w.lines.map((l) => `${l.route} need ${l.need} → start ${l.start} (${l.lots.length} lots)`).join(" · ")}</p>
    ${tbl(["Lot", "Route", "Qty", "Status", "Op now", "Progress", "Heat", ""], lots.filter((x) => x.ok).map((x) => { const L = x.data, dn = L.ops.filter((o) => o.status === "done").length;
      return [`<a href="#" data-lot="${esc(L.id)}" onclick="return false"><b>${esc(L.id)}</b></a>`, L.route, `${L.qty}/${L.qty0}`, `<span class="bf6-st ${esc(L.status)}">${esc(L.status)}</span>${L.hold ? ` <span class="bf6-nok" title="${esc(L.hold.reason)}">⛔</span>` : ""}`,
        esc(L.opNow ? L.opNow + " " + L.mNow : "–"), `<span class="bf6-prog"><i style="width:${(100 * dn / L.ops.length).toFixed(0)}%;background:${RCOL[L.route]}"></i></span> ${dn}/${L.ops.length}`, esc(L.heat || ""),
        L.hold || ["done", "scrapped"].includes(L.status) ? "" : `<button class="btn bf6-x" data-hold="${esc(L.id)}">hold</button>`]; }), "bf6-small")}`;
}
async function showLot(id) {
  const r = await mes("GET", `/api/bsf/mes/lots/${encodeURIComponent(id)}`); if (!r.ok) return;
  const L = r.data; selLot = L.id;
  $("bf6WDet").innerHTML = `<h3>Lot ${esc(L.id)} · ${esc(L.code)} · ${L.qty}/${L.qty0} pcs · <span class="bf6-st ${esc(L.status)}">${esc(L.status)}</span></h3>
    <p class="bf6-mut">work order <a href="#" data-wo2="${esc(L.wo)}" onclick="return false">${esc(L.wo)}</a> · due ${esc(L.due || "–")} · heat ${esc(L.heat || "–")} · family ${esc(L.fam || "–")}${L.hold ? ` · <b class="bf6-nok">HOLD: ${esc(L.hold.reason)} (${esc(L.hold.by)}, ${esc(L.hold.at)})</b>` : ""}</p>
    ${tbl(["Op", "Operation", "Machine type", "Set-up", "Cycle min/pc", "Status", "Machine", "Good", "Scrap", "Gate"], L.ops.map((o, j) => [`<b>${esc(o.no)}</b>`, esc(o.n), esc(o.m), o.setup + (o.fam ? ` / ${o.setupMinor}` : ""), o.furnace ? `${o.cyc} (load ${o.batch})` : o.cyc,
      `<span class="bf6-st ${esc(o.status)}">${esc(o.status)}</span>${j === L.i && !["done", "scrapped"].includes(L.status) ? " ◀" : ""}`, esc(o.machine), o.good, o.scrap, esc(o.gate)]), "bf6-small")}
    <p class="bf6-mut">serials (${L.serials.length}): ${L.serials.slice(0, 24).map((s) => `<a href="#" class="bf6-snl" data-q="${esc(s)}" onclick="return false">${esc(s)}</a>`).join(" ") || "– (created at op " + esc({ BS: "30", BN: "20", LG: "30", LB: "20", FABS: "10", FALG: "10" }[L.route]) + ")"}</p>`;
  $("bf6WDet").querySelectorAll("[data-q]").forEach((a) => a.addEventListener("click", () => { traceSearch(a.dataset.q); $("bf6Trace").scrollIntoView({ block: "start" }); }));
  const w2 = $("bf6WDet").querySelector("[data-wo2]"); if (w2) w2.addEventListener("click", () => { selWo = w2.dataset.wo2; showWo(); });
}
async function holdLot(id) { const r = await mes("POST", `/api/bsf/mes/lots/${encodeURIComponent(id)}/hold`, { reason: "supervisor hold (page) – check before next op", by: "supervisor" }); out("bf6WOut", `POST /api/bsf/mes/lots/${id}/hold`, { reason: "supervisor hold (page)" }, r); showWo(); renderQuality(); }

/* ------------------------------------------------------------------ 3: scheduling + Gantt + dispatch */
const ROWS = MACHINES.map((m) => ({ id: m.id, type: m.type, ht: !!(MTYPES[m.type] || {}).shifts3 }));
async function doSchedule(reason) {
  const body = { rule: $("bf6Rule") ? $("bf6Rule").value : "EDD", dbr: $("bf6Dbr") ? $("bf6Dbr").checked : false, bufferH: $("bf6Buf") ? +$("bf6Buf").value : 16, compare: true, reason };
  const r = await mes("POST", "/api/bsf/mes/schedule", body);
  if (!r.ok) return null;
  sched = r.data;
  const k = sched.kpi, p = sched.prev;
  schedLog.unshift(`${sched.at} · ${reason} · ${sched.rule}${sched.dbr ? " + DBR" : ""}: on time ${f1(k.onTimePct)} %${p ? ` (before ${f1(p.onTimePct)} %)` : ""}, set-ups ${k.majors} + ${k.minors} minor, BS-TGR ${pc(k.util["BS-TGR"])}, makespan ${f1(k.makespan / 60)} h`);
  schedLog = schedLog.slice(0, 12);
  renderSched(); return sched;
}
function renderSched() {
  if (!sched) return;
  const k = sched.kpi, tiles = [["On time (lots)", f1(k.onTimePct) + " %"], ["Set-ups", `${k.majors} + ${k.minors} minor`], ["Set-up time", f1(k.setupMin / 60) + " h"], ["BS-TGR utilisation", pc(k.util["BS-TGR"])],
    ["Makespan", f1(k.makespan / 60) + " h"], ["Mean flow / lot", f1(k.flowMean / 60) + " h"], ["Mean WIP (lots)", f1(k.wipMean)], ["Furnace loads", k.loads]];
  $("bf6Kpi").innerHTML = tiles.map(([a, b]) => `<div class="bf6-tile"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("") + (k.dbr ? `<div class="bf6-tile wide"><span>DBR</span><b>${k.dbr.moved} lots released later · WIP ${f1(k.dbr.before.wipMean)} → ${f1(k.wipMean)}</b></div>` : "");
  $("bf6SSum").textContent = `${sched.ops.length} operations · ${k.lots} lots · ${sched.rule}${sched.dbr ? " + DBR" : ""} · ${sched.at} (${be.on ? "server" : "browser demo"})`;
  if (sched.compare) $("bf6Cmp").innerHTML = tbl(["Rule", "DBR", "On time", "Tardiness Σ h", "Set-ups", "BS-TGR util.", "Mean WIP", "Mean flow h"], sched.compare.map((c) => [`<b>${c.rule}</b>`, c.dbr ? "yes" : "", f1(c.kpi.onTimePct) + " %", f1(c.kpi.tardSum / 60), `${c.kpi.majors} + ${c.kpi.minors}`, pc(c.kpi.util["BS-TGR"]), f1(c.kpi.wipMean), f1(c.kpi.flowMean / 60)]), "bf6-small bf6-num");
  $("bf6SLog").innerHTML = schedLog.map((s) => `<div class="bf6-ev">${esc(s)}</div>`).join("");
  renderGantt(); renderDispatch();
}
function renderGantt() {
  if (!sched) return;
  const t0 = sched.t, label = be.on ? (m) => { const d = new Date((t0 + m * 60) * 1000); return `${String(d.getDate()).padStart(2, "0")}. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; } : (m) => B.clockOf(t0 + m * 60);
  const down = {}; for (const m of B.M) if (m.state === "DOWN") down[m.id] = true;
  $("bf6Gantt").innerHTML = gantt(sched, { rows: ROWS, zoomMin: zoom, label, sel: selLot, down, selM, width: Math.max(700, ($("bf6Gantt").clientWidth || 1100) - 130) });
}
async function renderDispatch() {
  const r = await mes("GET", `/api/bsf/mes/dispatch?machine=${encodeURIComponent(selM)}`), d = r.data;
  $("bf6Disp").innerHTML = (d.blocked ? `<p class="bf6-nok"><b>SPC STOP:</b> ${esc(d.blocked.text)} – no dispatch until quality releases the machine.</p>` : "") +
    (d.items && d.items.length ? tbl(["#", "Lot", "Op", "Product", "Qty", "Set-up", "Start in", "Due"], d.items.slice(0, 12).map((x) => [x.seq, `<b>${esc(x.lot)}</b>`, esc(x.op), esc(x.product), x.qty, x.setup ? `${x.setup} min ${esc(x.setupKind || "")}` : "–", x.startIn_min != null ? f1(x.startIn_min / 60) + " h" : "–", esc(x.due || "")]), "bf6-small") : `<p class="bf6-mut">No lot for ${esc(selM)} in the plan.</p>`) +
    (d.held && d.held.length ? `<p class="bf6-warn">held (not dispatched): ${d.held.map((h) => esc(h.lot)).join(", ")}</p>` : "") + `<p class="bf6-mut">source: ${esc(d.from || "")} · GET /api/bsf/mes/dispatch?machine=${esc(selM)} (${r.via})</p>`;
}

/* ------------------------------------------------------------------ 4: terminal + handshake */
let andonData = null;
async function renderTerminal() {
  const a = andonData && andonData.machines.find((m) => m.id === selM), tm = B.byId[selM];
  $("bf6TState").innerHTML = a ? `<span class="bf6-dot ${a.color}"></span> <b>${esc(a.state)}</b>${a.alarm ? ` · alarm ${a.alarm} ${esc(a.alarmText)}` : ""}${a.spcStop ? ` · <b class="bf6-nok">SPC STOP</b>` : ""} · ${esc(MTYPES[tm.type].n)} · IP ${esc(NET_BY_ID[selM] ? NET_BY_ID[selM].ip : "")} unit ${NET_BY_ID[selM] ? NET_BY_ID[selM].unit : ""}` : "";
  const d = (await mes("GET", `/api/bsf/mes/dispatch?machine=${encodeURIComponent(selM)}`)).data, nx = d.items && d.items[0];
  $("bf6TLot").innerHTML = `<b>Now on the machine:</b> ${tm.lot ? `${esc(tm.lot)} · op ${esc(tm.op)} ${esc(tm.opName.slice(0, 40))} · ${tm.pcsDone}/${tm.pcsLot} pcs` : "no lot"}<br>
    <b>Next from the dispatch list:</b> ${nx ? `${esc(nx.lot)} op ${esc(nx.op)} · ${nx.qty} × ${esc(nx.product)}` : "–"}${d.blocked ? ` <b class="bf6-nok">(SPC stop)</b>` : ""}
    ${a && a.dt ? `<br><b class="${a.dt.classified ? "" : "bf6-warn"}">Downtime ${esc(a.dt.id)}: ${esc(a.dt.reason)} ${esc(a.dt.text)}${a.dt.classified ? "" : " – automatic guess from the alarm, please confirm:"}</b> <button class="btn bf6-x" data-dtc="${esc(a.dt.id)}">set reason from the list</button>` : ""}`;
}
async function downloadNext() {
  const d = (await mes("GET", `/api/bsf/mes/dispatch?machine=${encodeURIComponent(selM)}`)).data, nx = d.items && d.items[0];
  if (!nx) { $("bf6TOut").textContent = `No lot in the dispatch list of ${selM}${d.blocked ? " (SPC stop)" : ""}.`; return; }
  const body = { lot: nx.lot, msgId: uuid() }, r = await mes("POST", `/api/bsf/mes/machines/${selM}/download`, body);
  out("bf6TOut", `POST /api/bsf/mes/machines/${selM}/download`, body, r);
  lastHs = r.data && r.data.gateway && r.data.gateway.steps ? { real: true, steps: r.data.gateway.steps, res: r.data.gateway } : r.data && r.data.command ? { real: false, ...simHandshake(selM, r.data.command) } : r.status === 409 && r.data.title === "gateway not running" ? { real: false, note: "server: gateway not running – simulated frames", ...simHandshake(selM, { id: selM, cmd: "order", order: nx.lot.slice(0, 20), part: nx.product.slice(0, 20), qty: nx.qty, recipe: +nx.op }) } : null;
  renderHs();
}
async function machineCmd(cmd) {
  const body = { id: selM, cmd, msgId: uuid() };
  if (be.on) { try { const r = await api("POST", "/api/bsf/command", body); out("bf6TOut", "POST /api/bsf/command", body, r); if (r.data && r.data.steps) { lastHs = { real: true, steps: r.data.steps, res: r.data }; renderHs(); return; } } catch (e) { /* demo below */ } }
  lastHs = { real: false, ...simHandshake(selM, { ...body, order: "", part: "", qty: 0 }) }; $("bf6TOut").textContent = `POST /api/bsf/command ${JSON.stringify(body)}\n→ gateway not running: simulated handshake below`; renderHs();
}
let hsSeq = 6, hsReq = 0;
function simHandshake(mid, c) {
  const u = NET_BY_ID[mid] ? NET_BY_ID[mid].unit : 1, code = { order: 1, start: 2, stop: 3, ack: 4, recipe: 5 }[c.cmd] || 1, steps = []; let tid = 400 + hsSeq * 7;
  const u16 = (v) => [(v >> 8) & 255, v & 255], resp = (t, regs) => adu(t, u, [3, regs.length * 2, ...regs.flatMap(u16)]);
  const add = (text, req, rsp) => steps.push({ ms: steps.length * 12 + 3, text, req: hex(req), resp: hex(rsp), decoded: (decodeFrame(rsp, "resp") || {}).text || "" });
  const seq = (hsSeq + 1) & 0xffff;
  let f = reqRead(++tid, u, 200, 3); add("1 read cmd.code / cmd.seq / cmd.ctl (200 – 202)", f, resp(tid, [0, hsSeq, hsReq]));
  f = reqRead(++tid, u, 8, 3); add("2 read hs.status / ackSeq / result (8 – 10)", f, resp(tid, [16 | hsReq, hsSeq, 0]));
  const data = [code, seq, hsReq, ...asciiToRegs(c.order || "", 10), ...asciiToRegs(c.part || "", 10), (+c.recipe || 0) & 0xffff, ...encodeValue("UINT32", +c.qty || 0)];
  f = reqWriteN(++tid, u, 200, data); add(`3 FC16 write command block 200 – 225 (code ${code}, seq ${seq}), REQ unchanged`, f, adu(tid, u, [16, 0, 200, 0, data.length]));
  const rq = hsReq ^ 1; f = reqWrite1(++tid, u, 202, rq); add(`4 FC06 toggle REQ: cmd.ctl = ${rq} (written LAST)`, f, f.slice());
  f = reqRead(++tid, u, 8, 4); add("5.1 poll hs.status until ACK = REQ (still old)", f, resp(tid, [16 | hsReq, hsSeq, 0, 0]));
  f = reqRead(++tid, u, 8, 4); add("5.2 poll: ACK = REQ, ackSeq = seq, BUSY → lot accepted", f, resp(tid, [(rq & 1) | (code === 1 ? 2 : 0), seq, 0, 0]));
  hsSeq = seq; hsReq = rq;
  return { steps, res: { ok: true, result: 0, resultText: RESULTS[0], ackSeq: seq } };
}
function renderHs() {
  if (!lastHs) return;
  $("bf6Hs").innerHTML = `<p class="${lastHs.real ? "bf6-ok" : "bf6-mut"}"><b>${lastHs.real ? "REAL Modbus TCP frames via the gateway" : "Simulated machine (browser demo)" + (lastHs.note ? " – " + esc(lastHs.note) : "")}</b> · result ${esc(lastHs.res ? lastHs.res.resultText || lastHs.res.error || "" : "")}${lastHs.res && lastHs.res.ackSeq != null ? " · ackSeq " + lastHs.res.ackSeq : ""}</p>` +
    tbl(["ms", "step", "request (hex)", "response (hex)"], lastHs.steps.map((s) => [s.ms, esc(s.text), `<code>${esc(s.req)}</code>`, `<code>${esc(s.resp)}</code>${s.decoded ? `<br><span class="bf6-mut">${esc(s.decoded)}</span>` : ""}`]), "bf6-small bf6-hex");
}
async function terminalConfirm() {
  const d = (await mes("GET", `/api/bsf/mes/dispatch?machine=${encodeURIComponent(selM)}`)).data, tm = B.byId[selM], lot = (tm.lot && !tm.lot.includes(",") ? tm.lot : "") || (d.items && d.items[0] && d.items[0].lot);
  if (!lot) { $("bf6TOut").textContent = "No lot to confirm on " + selM; return; }
  const L = (await mes("GET", `/api/bsf/mes/lots/${encodeURIComponent(lot)}`)).data, op = L && L.ops ? (L.ops.find((o) => o.m === tm.type && o.status !== "done") || {}).no : "";
  const body = { lot, op, machine: selM, good: +$("bf6TG").value, scrap: +$("bf6TS").value, source: "terminal" }, key = uuid();
  const r = await mes("POST", "/api/bsf/mes/confirmations", body, { "Idempotency-Key": key }); out("bf6TOut", `POST /api/bsf/mes/confirmations\nIdempotency-Key: ${key}`, body, r);
}
async function terminalDowntime() {
  const body = { machine: selM, reason: $("bf6TR").value, minutes: +$("bf6TMin").value, comment: $("bf6TCom").value, by: "operator (terminal)" };
  const r = await mes("POST", "/api/bsf/mes/downtime", body); out("bf6TOut", "POST /api/bsf/mes/downtime", body, r); renderPerf();
}

/* ------------------------------------------------------------------ 5: andon */
async function renderAndon() {
  const r = await mes("GET", "/api/bsf/mes/andon"); andonData = r.data; const a = andonData;
  const by = Object.fromEntries(a.machines.map((m) => [m.id, m]));
  $("bf6ABoard").innerHTML = AREAS.map(([k, t]) => { const ms = MACHINES.filter((m) => m.area === k); return `<div class="bf6-area"><h4>${esc(t)} (${ms.length})</h4><div class="bf6-tiles">${ms.map((m) => { const x = by[m.id] || {};
    return `<div class="bf6-at ${esc(x.color || "grey")}${m.id === selM ? " sel" : ""}" data-m="${esc(m.id)}" title="${esc(`${m.id} ${x.state || ""} ${x.alarmText || ""} ${x.dt ? x.dt.reason + " " + x.dt.text : ""}`)}"><b>${esc(m.id)}</b><span>${esc(x.state || "")}${x.call && x.call.length ? " 📣" : ""}${x.dt && !x.dt.classified ? " ✋" : ""}</span>
      <span class="bf6-al">${esc(x.spcStop ? "SPC STOP" : x.alarm ? "A" + x.alarm : x.lot ? String(x.lot).split(",")[0] : "")}</span>${x.progress ? `<i style="width:${(100 * x.progress).toFixed(0)}%"></i>` : ""}</div>`; }).join("")}</div></div>`; }).join("");
  const c = a.count || {};
  $("bf6ASum").textContent = `run ${c.green || 0} · set-up ${c.blue || 0} · starved/blocked ${c.yellow || 0} · down ${c.red || 0} · idle ${c.grey || 0} · ${a.at}`;
  const T = a.targets;
  $("bf6ATgt").innerHTML = T ? `<h3 class="bf6-h">Plan vs actual today (good parts / sets)</h3>${bars(["FABS", "FALG", "BS", "BN", "LG", "LB"].map((p) => [p, (T.today || {})[p] || 0, (T.today || {})[p] >= (T.target || {})[p] * frac() ? "bf6-l2" : "bf6-l1"]), { l: 60, max: Math.max(...Object.values(T.target || { a: 1 })), fmt: (v) => f0(v), aria: "plan vs actual" })}
    <p class="bf6-mut">target per day: ${Object.entries(T.target || {}).map(([k, v]) => `${k} ${v}`).join(" · ")} · bar green = on track for the time of the day</p>` : "";
  $("bf6ACalls").innerHTML = `<h3 class="bf6-h">Open calls + holds</h3>${a.calls.length ? a.calls.map((x) => `<div class="bf6-ev">📣 <b>${esc(x.kind)}</b> at ${esc(x.machine)} · ${esc(x.at)} <button class="btn bf6-x" data-ack="${esc(x.id)}">done</button></div>`).join("") : `<p class="bf6-mut">no open call</p>`}
    ${a.holds.length ? `<p class="bf6-warn">${a.holds.length} lots on hold: ${a.holds.slice(0, 6).map((h) => esc(h.lot)).join(", ")}</p>` : ""}${a.spcStops.length ? `<p class="bf6-nok">SPC stop: ${a.spcStops.map(esc).join(", ")}</p>` : ""}`;
}
const frac = () => { const tod = (((B.t % 86400) + 86400) % 86400) / 60; return Math.min(1, tod / (B.shifts * 450)); };

/* ------------------------------------------------------------------ 6: quality */
async function renderQuality() {
  const a = (await mes("GET", "/api/bsf/mes/andon")).data, lots = (await mes("GET", "/api/bsf/mes/lots?status=hold")).data.items || [];
  $("bf6QHold").innerHTML = lots.length ? tbl(["Lot", "Product", "Op", "Reason", "By", ""], lots.map((L) => [`<b>${esc(L.id)}</b>`, esc(L.code), esc(L.op), esc(L.hold.reason), esc(L.hold.by), `<button class="btn bf6-x" data-rel="${esc(L.id)}">release</button>`]), "bf6-small") : `<p class="bf6-mut">no lot on hold</p>`;
  const sp = a.machines.filter((m) => m.spcStop);
  $("bf6QSpcL").innerHTML = sp.length ? tbl(["Machine", "Characteristic", "Why", "Since", ""], sp.map((m) => [`<b>${esc(m.id)}</b>`, esc(m.spcStop.char), esc(m.spcStop.text), esc(m.spcStop.at), `<button class="btn bf6-x" data-spc="${esc(m.id)}">release</button>`]), "bf6-small") : `<p class="bf6-mut">no machine stopped</p>`;
}
async function simNok() {
  const lots = ((await mes("GET", "/api/bsf/mes/lots?status=running")).data.items || []).concat((await mes("GET", "/api/bsf/mes/lots?status=queued")).data.items || []);
  const L = lots.find((x) => x.route === "BS" && !x.hold) || lots.find((x) => !x.hold); if (!L) { $("bf6QMsg").textContent = "no running lot"; return; }
  const sers = (await mes("GET", `/api/bsf/mes/serials?lot=${encodeURIComponent(L.id)}`)).data.items || [], sn = sers.length ? sers[0].sn : "";
  const rec = { serial: sn || L.id, lot: L.id, part: L.code, char: "BS-V300", name: "Lead: v_300 (simulated NOK)", value: 21.4, unit: "µm", usl: 18, op: "120", machine: "QC-LED-01", source: "page" };
  if (be.on) { const r = await api("POST", "/api/bsf/qa/results", rec, { "Idempotency-Key": uuid() }); $("bf6QMsg").textContent = `POST /api/bsf/qa/results → HTTP ${r.status} ${r.data.decision || ""} – the MES pulls it on the next read`; await mes("POST", "/api/bsf/mes/sync", {}); if (!sn) await mes("POST", `/api/bsf/mes/lots/${encodeURIComponent(L.id)}/hold`, { reason: `QA NOK BS-V300 = 21.4 µm (simulated)`, by: "QA (item 5)" }); }
  else { const n = LM.qaSync([{ ...rec, decision: "NOK" }], []); if (!n) LM.hold(LM.S.lots[L.id], "QA NOK BS-V300 = 21.4 µm (simulated)", "QA (item 5)"); $("bf6QMsg").textContent = `browser demo: NOK record → hold ${L.id}`; }
  renderQuality(); renderDispatch();
}
async function simSpc() {
  if (be.on) { for (let i = 0; i < 2; i++) await api("POST", "/api/bsf/qa/results", { serial: "SPC-T-" + i + "-" + Date.now(), char: "BS-PD", value: 4.2, unit: "µm", lsl: -3, usl: 3, machine: "BS-TGR-03", op: "100", source: "page" }, { "Idempotency-Key": uuid() }); await mes("POST", "/api/bsf/mes/sync", {}); }
  const a = (await mes("GET", "/api/bsf/mes/andon")).data; if (!a.spcStops.includes("BS-TGR-03")) await mes("POST", "/api/bsf/mes/machines/BS-TGR-03/spc", { alarm: true, char: "BS-PD", text: "2 of the last 3 pitch-Ø results NOK (simulated)" });
  $("bf6QMsg").textContent = "BS-TGR-03 stopped by SPC – its dispatch list is empty"; setMachine("BS-TGR-03"); renderQuality();
}

/* ------------------------------------------------------------------ 7: logistics */
async function renderLogistics() {
  const lots = ((await mes("GET", "/api/bsf/mes/lots?status=queued")).data.items || []).slice(-30);
  const cur = $("bf6LLot").value; $("bf6LLot").innerHTML = lots.map((L) => `<option${L.id === cur ? " selected" : ""}>${esc(L.id)}</option>`).join("");
  const tr = (await mes("GET", "/api/bsf/mes/transport")).data.items || [];
  $("bf6LTr").innerHTML = tr.length ? tbl(["Request", "Lot", "From → to", "AGV order", "State"], tr.slice(-8).reverse().map((t) => [esc(t.id), esc(t.lot), `${esc(t.from)} → ${esc(t.to)}`, esc(t.agvOrder || "–"), `<b>${esc((!be.on && agvState(t.agvOrder)) || t.state)}</b>${t.vehicle ? " " + esc(t.vehicle) : ""}`]), "bf6-small") : `<p class="bf6-mut">no request yet (the twin moves its lots itself; here the MES asks the fleet over HTTP)</p>`;
  const kb = (await mes("GET", "/api/bsf/mes/kanban")).data.items || [];
  $("bf6LKb").innerHTML = tbl(["Item", "per product", "D / day", "LT d", "C / bin", "N bins", "full", "", ""], kb.map((k) => [`<b>${esc(k.item)}</b><br><span class="bf6-mut">${esc(k.n)}</span>`, k.per, f0(k.D), k.LT, f0(k.C), `<span title="${esc(k.formula)}">${k.N}</span>`, `${k.full}/${k.N}${k.open ? ` (${k.open} open)` : ""}`,
    `<span class="bf6-bins">${Array.from({ length: k.N }, (_, i) => `<i class="${i < k.full ? "f" : ""}${k.red ? " r" : ""}"></i>`).join("")}</span>`, `<button class="btn bf6-x" data-kb="${esc(k.item)}">scan empty</button>`]), "bf6-small");
  const fg = (await mes("GET", "/api/bsf/mes/fg")).data.items || [];
  $("bf6LFg").innerHTML = fg.length ? tbl(["Booking", "Lot", "Product", "Qty", "When"], fg.slice(-6).reverse().map((f) => [esc(f.id), esc(f.lot), esc(f.code), f.qty, esc(f.at)]), "bf6-small") : `<p class="bf6-mut">no finished lot yet</p>`;
}

/* ------------------------------------------------------------------ 8: performance */
function renderOeeExample() {
  const o = CHECK6.oee, r = oeeISO(o);
  $("bf6PEx").innerHTML = `<h3>OEE worked example – one thread grinder BS-TGR, one shift (ISO 22400-2)</h3>
    <p>Planned busy time <b>PBT = 450 min</b> (7.5 h net). Breakdown 30 min, set-up 15 min → actual production time <b>APT = 450 − 30 − 15 = ${r.APT} min</b>.</p>
    <p>Planned run time per item <b>PRI = 40 min</b>, produced <b>PQ = 9</b>, good <b>GQ = 8</b>.</p>
    <p><b>A</b> = APT / PBT = 405 / 450 = <b>${f3(r.A)}</b> · <b>E</b> = PRI × PQ / APT = 40 × 9 / 405 = <b>${f3(r.E)}</b> · <b>Q</b> = GQ / PQ = 8 / 9 = <b>${f3(r.Q)}</b></p>
    <p><b>OEE = A × E × Q = ${f3(r.OEE)}</b> = GQ × PRI / PBT = 8 × 40 / 450 (check). Plant OEE = Σ (OEE × PBT) / Σ PBT, e.g. (0.711 × 450 + 0.800 × 900) / 1 350 = <b>${f3(CHECK6.plant.OEE)}</b>.</p>
    <p class="bf6-mut">Little's law: WIP = throughput × lead time = 120 sets/day × 5 days = <b>${CHECK6.little.WIP} sets</b>. The live values below use PBT = run + set-up + down + blocked + starved of every machine of the twin.</p>`;
}
async function renderPerf() {
  const o = (await mes("GET", "/api/bsf/mes/oee")).data;
  if (o.plant) {
    const types = Object.entries(o.types).filter(([, v]) => v && v.nEQ > 0).sort((a, b) => a[1].OEE - b[1].OEE), noPart = Object.entries(o.types).filter(([, v]) => v && !v.nEQ).map(([t]) => t);
    $("bf6POee").innerHTML = bars(types.map(([t, v]) => [t, v.OEE, t === "BS-TGR" ? "bf6-l3" : v.OEE < 0.6 ? "bf6-l1" : "bf6-l2"]), { l: 70, max: 1, target: 0.75, fmt: (v) => pc(v, 0), aria: "OEE per machine type" }) + (noPart.length ? `<p class="bf6-mut">no finished part yet in this window (E, Q unknown): ${noPart.map(esc).join(", ")}</p>` : "");
    const sum = (k) => o.machines.reduce((s, r) => s + (r[k] || 0), 0), P = sum("PBT");
    $("bf6PLoss").innerHTML = lossBars({ PBT: P, down: sum("down"), setup: sum("setup"), starved: sum("starved"), blocked: sum("blocked"), run: sum("run"), speedLoss: sum("speedLoss"), qualityLoss: sum("qualityLoss"), OEE: o.plant.OEE });
    $("bf6PLines").innerHTML = o.lines ? tbl(["Area (line)", "PBT h", "A", "E", "Q", "OEE"], Object.entries(o.lines).filter(([, v]) => v).map(([k, v]) => [esc((AREAS.find((a) => a[0] === k) || [k, k])[1]), f0(v.PBT / 60), pc(v.A), pc(v.E), pc(v.Q), `<b>${pc(v.OEE)}</b>`]).concat([["<b>Plant</b>", f0(o.plant.PBT / 60), pc(o.plant.A), pc(o.plant.E), pc(o.plant.Q), `<b>${pc(o.plant.OEE)}</b>`]]), "bf6-small bf6-num") : "";
    $("bf6PSum").textContent = `plant OEE ${pc(o.plant.OEE)} (A ${pc(o.plant.A)} × E ${pc(o.plant.E)} × Q ${pc(o.plant.Q)}) · ${o.plant.n} machines`;
  } else { $("bf6POee").innerHTML = `<p class="bf6-mut">${esc(o.note || "no machine data yet")}</p>`; }
  const pa = (await mes("GET", "/api/bsf/mes/pareto")).data.items || [];
  $("bf6PPar").innerHTML = pa.length ? pareto(pa.slice(0, 10)) + tbl(["Reason", "min", "stops", "%", "cum %"], pa.slice(0, 8).map((x) => [`${esc(x.reason)} ${esc(x.text)}`, f0(x.min), x.n, f1(x.pct), f1(x.cum)]), "bf6-small bf6-num") : `<p class="bf6-mut">no downtime recorded yet</p>`;
  const rp = (await mes("GET", "/api/bsf/mes/report?hours=7.5")).data, L = rp.little || {};
  $("bf6PRep").innerHTML = `<div class="bf6-pre bf6-rep">SHIFT REPORT ${esc(rp.from)} – ${esc(rp.to)} (${rp.hours} h) – EXAMPLE
Output (good, last op): ${Object.entries(rp.output).map(([k, v]) => `${k} ${v}`).join(" · ") || "–"}
Confirmations: ${rp.confirmations} · lots on hold: ${rp.holds} · SPC stops: ${rp.spcStops.join(", ") || "none"}
OEE plant: ${rp.oee ? pc(rp.oee.OEE) : "–"}
Scrap by cause: ${rp.scrapByCause.slice(0, 5).map((s) => `${s.cause} ${s.pcs}`).join(" · ") || "none"}
Top downtime: ${rp.downtime.slice(0, 3).map((d) => `${d.reason} ${d.text} ${f0(d.min)} min`).join(" · ") || "none"}
WIP: ${rp.wip ? `${rp.wip.lots} lots / ${rp.wip.pcs} pcs` : "–"} · Little: L ${L.L ?? "–"} lots = λ ${L.lambda_h ?? "–"} lots/h × W ${L.W_h ?? "–"} h (λW = ${L.LW ?? "–"})
Order lead time: ${rp.leadTime_h ?? "–"} h · energy per set: ${rp.kWhPerSet ?? "–"} kWh · energy per day: ${rp.energyPerDay_kWh ?? "–"} kWh</div>`;
}

/* ------------------------------------------------------------------ 9: trace + label */
async function traceSearch(q) {
  if (!q) return; $("bf6Sn").value = q;
  if (/^[HPB]\d{4}$/.test(q)) {
    $("bf6Lbl").innerHTML = `<p class="bf6-mut">The label preview appears when you open a serial.</p>`; $("bf6Zpl").textContent = "";
    const r = await mes("GET", `/api/bsf/mes/trace?heat=${encodeURIComponent(q)}`), d = r.data;
    $("bf6Tree").innerHTML = `<h3>Where-used of heat ${esc(q)}</h3><p class="bf6-mut">${d.info ? `${esc(d.info.mat)} · ${esc(d.info.mill || "")} · ${esc(d.info.cert)}` : ""} · GET /api/bsf/mes/trace?heat=${esc(q)} (${r.via})</p>
      <p><b>${d.lotsAll.length} lots</b>: ${d.lotsAll.slice(0, 30).map(esc).join(", ")}</p><p><b>${d.count} serials</b>, built into <b>${d.assemblies.length} assemblies</b>: ${d.assemblies.slice(0, 20).map((a) => `<a href="#" class="bf6-snl" data-sn2="${esc(a)}" onclick="return false">${esc(a)}</a>`).join(" ")}</p>`;
    $("bf6Tree").querySelectorAll("[data-sn2]").forEach((a) => a.addEventListener("click", () => traceSearch(a.dataset.sn2)));
    return d;
  }
  const r = await mes("GET", `/api/bsf/mes/trace?serial=${encodeURIComponent(q)}`);
  if (!r.ok) { $("bf6Tree").innerHTML = `<p class="bf6-warn">${esc(r.data.title)}: ${esc(r.data.detail)}</p>`; return null; }
  $("bf6Tree").innerHTML = `<p class="bf6-mut">GET /api/bsf/mes/trace?serial=${esc(q)} (${r.via}, ${f1(r.ms)} ms)${r.data.parent ? ` · built into <b>${esc(r.data.parent)}</b>` : ""}</p>` + tree(r.data.tree, { hl: q });
  showLabel(q); return r.data;
}
async function showLabel(sn) {
  const r = await mes("GET", `/api/bsf/mes/trace?serial=${encodeURIComponent(sn)}`); if (!r.ok) return;
  const s = r.data.self, g = gs1Element({ serial: sn, lot: String(s.lot).slice(0, 20), code: s.code, date: sn.split("-").slice(-2, -1)[0] });
  $("bf6Lbl").innerHTML = labelSvg({ ...g, serial: sn, lot: s.lot, code: s.code });
  $("bf6Zpl").textContent = `GS1 element string (human readable):\n${g.hr}\n\nraw (FNC1 first, <GS> = ASCII 29 after variable fields):\n${g.raw.replace(/\x1d/g, "<GS>")}\n\nZPL for the print server (POST /api/bsf/printer/jobs, item 4):\n${g.zpl}\n\n${SERIAL6.note}`;
}
async function renderChips() {
  const r = await mes("GET", "/api/bsf/mes/serials?n=400"), it = r.data.items || [];
  const asm = it.filter((s) => s.kind === "assembly").slice(-5).reverse(), parts = it.filter((s) => s.kind !== "assembly" && s.parent).slice(-2).reverse();
  const hp = it.filter((s) => s.kind !== "assembly" && s.parent && s.heat).slice(-1)[0], heat = hp ? hp.heat : "H7741";     // a heat that is already in an assembly
  $("bf6SnChips").innerHTML = asm.concat(parts).map((s) => `<button class="btn bf6-x" data-q="${esc(s.sn)}">${esc(s.sn)}</button>`).join("") + ` <button class="btn bf6-x" data-q="${esc(heat)}">heat ${esc(heat)} (where-used)</button>`;
  return asm;
}

/* ------------------------------------------------------------------ 10: try it */
function apiExamples() {
  return [["GET health", "GET", "/api/bsf/mes/health", null], ["GET work orders (paged)", "GET", "/api/bsf/mes/workorders?page=1&size=5", null],
    ["POST work order (Idempotency-Key)", "POST", "/api/bsf/mes/workorders", { product: "BS-3210-1000-C5", qty: 40, dueDays: 5, erpOrder: "PO-260045" }, true],
    ["POST release WO-00001 (2nd time → 409)", "POST", "/api/bsf/mes/workorders/WO-00001/release", {}],
    ["GET one work order", "GET", "/api/bsf/mes/workorders/WO-00001", null], ["GET dispatch BS-TGR-03", "GET", "/api/bsf/mes/dispatch?machine=BS-TGR-03", null],
    ["POST confirmation (Idempotency-Key)", "POST", "/api/bsf/mes/confirmations", { wo: "WO-00001", op: "10", machine: "MS-SAW-01", good: 20, scrap: 0 }, true],
    ["POST schedule EDD + compare", "POST", "/api/bsf/mes/schedule", { rule: "EDD", compare: true }], ["GET andon", "GET", "/api/bsf/mes/andon", null],
    ["GET OEE BS-TGR", "GET", "/api/bsf/mes/oee?type=BS-TGR", null], ["GET shift report", "GET", "/api/bsf/mes/report?hours=7.5", null],
    ["POST downtime (terminal)", "POST", "/api/bsf/mes/downtime", { machine: "BS-TGR-03", reason: "210", minutes: 12, comment: "wheel dressed outside the cycle" }],
    ["GET reasons", "GET", "/api/bsf/mes/reasons", null], ["GET trace heat H7741", "GET", "/api/bsf/mes/trace?heat=H7741", null],
    ["POST transport request → AGV", "POST", "/api/bsf/mes/transport", { lot: "WO-00001-BS-01", from: "SAW", to: "SOFT", priority: 5 }],
    ["GET kanban", "GET", "/api/bsf/mes/kanban", null], ["POST eval OEE (cross-check)", "POST", "/api/bsf/mes/eval", { kind: "oee", PBT: 450, down: 30, setup: 15, PRI: 40, PQ: 9, GQ: 8 }],
    ["POST eval schedule (3 lots, EDD)", "POST", "/api/bsf/mes/eval", { kind: "schedule", case: caseOne("EDD") }],
    ["Unknown work order → 404 problem+json", "GET", "/api/bsf/mes/workorders/WO-99999", null], ["Bad product → 400", "POST", "/api/bsf/mes/workorders", { product: "XX-1", qty: 5 }],
    ["Quantity 0 → 422", "POST", "/api/bsf/mes/workorders", { product: "LG", qty: 0 }], ["GET audit journal", "GET", "/api/bsf/mes/events?since=0", null]];
}
function fillExample() { const x = apiExamples()[+$("bf6XEx").value || 0]; $("bf6XM").value = x[1]; $("bf6XP").value = x[2]; $("bf6XB").value = x[3] ? JSON.stringify(x[3], null, 1) : ""; $("bf6XK").checked = !!x[4]; }
async function sendTry() {
  const m = $("bf6XM").value, p = $("bf6XP").value.trim(); let body = null;
  if (m === "POST") { try { body = $("bf6XB").value.trim() ? JSON.parse($("bf6XB").value) : {}; } catch (e) { $("bf6XRes").textContent = "body is not valid JSON: " + e.message; return; } }
  const h = $("bf6XK").checked ? { "Idempotency-Key": uuid() } : {};
  $("bf6XReq").textContent = `${m} ${p} HTTP/1.1\nHost: ${location.host}\nAccept: application/json${body ? "\nContent-Type: application/json" : ""}${h["Idempotency-Key"] ? "\nIdempotency-Key: " + h["Idempotency-Key"] : ""}\n\n${body ? JSON.stringify(body, null, 1) : ""}`;
  const r = await mes(m, p, body, h);
  const txt = JSON.stringify(r.data, null, 1);
  $("bf6XRes").textContent = `HTTP/1.1 ${r.status}\nContent-Type: ${r.ct}\n(${r.via}${r.via === "browser demo" ? " – the same contract as twin/bsf_mes.py" : ""}, ${f1(r.ms)} ms)\n\n${txt.length > 6000 ? txt.slice(0, 6000) + "\n… (" + txt.length + " characters)" : txt}`;
  return r;
}

/* ------------------------------------------------------------------ loop */
let nTick = 0;
async function tick() {
  if (!visible() || !built) return;
  nTick++;
  const f = lastFeed; $("bf6Feed").textContent = `twin ${B.clock()} · MES feed #${nFeed}${f ? ` (+${f.confirmations || 0} confirmations, +${f.orders || 0} WOs)` : ""} · ${be.on ? "server" : "browser demo"}`;
  try {
    if (nTick % 2 === 0) { await renderAndon(); await renderTerminal(); }
    if (nTick % 5 === 1) { await renderQuality(); await renderLogistics(); }
    if (nTick % 7 === 3) { await renderPerf(); await renderWo(); await renderModel(); }
    if (nTick % 9 === 4) await renderChips();
    if (nTick % 60 === 59) await doSchedule("periodic (60 s)");
  } catch (e) { /* demo – never show errors */ }
}
async function renderAll() {
  renderOeeExample();
  try { await renderAndon(); await renderTerminal(); await renderWo(); await renderModel(); await renderQuality(); await renderLogistics(); await renderPerf(); await renderChips(); renderSched(); } catch (e) { console.error(e); }
}

/* ------------------------------------------------------------------ self-check (&bf6test) */
const opc = (m, p, setup = 0, key, fam = "", sm) => ({ no: "10", m, setup, setupMinor: sm ?? setup, cyc: p, batch: 1, furnace: false, key: key || m + p, fam });
function caseOne(rule) { const H = CHECK6.one; return { rule, calendar: "247", machines: { M1: [{ id: "M1-01" }] }, lots: ["J1", "J2", "J3"].map((id, i) => ({ id, qty: 1, due: H.d[i], ops: [opc("M1", H.p[i], 0, id)] })) }; }
function caseFlow(rule) { return { rule, calendar: "247", machines: { M1: [{ id: "M1-01" }], M2: [{ id: "M2-01" }] }, lots: [{ id: "A", qty: 1, due: 360, ops: [opc("M1", 180, 0, "a1"), opc("M2", 120, 0, "a2")] }, { id: "B", qty: 1, due: 600, ops: [opc("M1", 60, 0, "b1"), opc("M2", 240, 0, "b2")] }] }; }
function caseFam(rule) { return { rule, calendar: "247", machines: { "BS-TGR": [{ id: "T1" }] }, lots: [["X1", "X", 100], ["Y1", "Y", 200], ["X2", "X", 300], ["Y2", "Y", 400]].map(([id, f, d]) => ({ id, qty: 1, due: d, ops: [opc("BS-TGR", 100, 45, id, f, 15)] })) }; }
async function selfTest() {
  const outL = [], log = (s) => { outL.push(s); console.log("BF6TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const okk = Math.abs(got - exp) <= tol; okk ? pass++ : fail++; log(`${okk ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(7)} (hand ${Number(exp).toPrecision(7)} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const H = CHECK6;
  try {
    // OEE + Little + kanban + calendar
    const o = oeeISO(H.oee); chk("OEE A = 405 / 450", o.A, 0.9, 1e-12); chk("OEE E = 40 × 9 / 405", o.E, 360 / 405, 1e-12); chk("OEE Q = 8 / 9", o.Q, 8 / 9, 1e-12); chk("OEE = A × E × Q = 8 × 40 / 450", o.OEE, 320 / 450, 1e-12);
    chk("plant OEE weighted by PBT", (H.plant.m[0][0] * 450 + 0.8 * 900) / 1350, H.plant.OEE, 1e-12);
    chk("kanban N = ceil(7 200 × 5 × 1.2 / 5 000)", Math.ceil(H.kanban.D * H.kanban.LT * (1 + H.kanban.a) / H.kanban.C - 1e-9), 9, 0); chk("Little WIP = 120 × 5", H.little.TH * H.little.LT, 600, 0);
    chk("shift calendar: 20:00 + 120 min work (2 shifts) → next day 07:00", calendar(840, 2).addWork(0, 120), 660, 1e-9);
    // scheduler hand cases
    const seq = (r) => r.ops.map((x) => x.lot).join(" ");
    const e = schedule(caseOne("EDD")), s = schedule(caseOne("SPT")), c = schedule(caseOne("CR"));
    ok("EDD sequence J1 J2 J3, Σ tardiness 360 min", seq(e) === H.one.EDD.seq && e.kpi.tardSum === 360, `${seq(e)} · ${e.kpi.tardSum}`);
    ok("SPT sequence J2 J1 J3, Σ tardiness 480, mean flow 540", seq(s) === H.one.SPT.seq && s.kpi.tardSum === 480 && s.kpi.flowMean === 540, `${seq(s)} · ${s.kpi.tardSum} · ${s.kpi.flowMean}`);
    ok("CR sequence J1 J3 J2 (CR at t = 300: J3 0.625 < J2 1.33), Σ tardiness 600", seq(c) === H.one.CR.seq && c.kpi.tardSum === 600, `${seq(c)} · ${c.kpi.tardSum}`);
    chk("flow shop 2 machines SPT makespan", schedule(caseFlow("SPT")).kpi.makespan, H.flow.SPT, 1e-9); chk("flow shop EDD makespan", schedule(caseFlow("EDD")).kpi.makespan, H.flow.EDD, 1e-9);
    const fe = schedule(caseFam("EDD")), ff = schedule(caseFam("FAM"));
    chk("thread grinder EDD makespan (4 full set-ups)", fe.kpi.makespan, H.fam.EDD, 1e-9); chk("thread grinder FAM makespan (2 full + 2 minor)", ff.kpi.makespan, H.fam.FAM, 1e-9);
    ok("set-up counts EDD 4 / FAM 2 + 2", fe.kpi.majors === 4 && ff.kpi.majors === 2 && ff.kpi.minors === 2, `${fe.kpi.majors} / ${ff.kpi.majors} + ${ff.kpi.minors}`);
    // live MES
    const LT = newLocal(), fs = LT.twinSync(twinSnap(true));      // a separate browser MES fed with the full twin state (independent of the mode)
    ok("twin → MES: work orders, confirmations, serials, assemblies", Object.keys(LT.S.wo).length > 5 && LT.S.conf.length > 50 && Object.values(LT.S.ser).some((x) => x.kind === "assembly" && x.children.some((c) => !c.startsWith("("))), `${Object.keys(LT.S.wo).length} WOs, ${LT.S.conf.length} confirmations, ${Object.keys(LT.S.ser).length} serials (${JSON.stringify(fs)})`);
    const live = LT.schedInput({ rule: "EDD" }), r0 = schedule(live), r1 = schedule({ ...live, dbr: { drum: "BS-TGR", bufferMin: 960 } });
    ok("live schedule: every open lot planned, no unscheduled op", r0.kpi.lots > 10 && r0.kpi.unscheduled === 0, `${r0.kpi.lots} lots, ${r0.ops.length} ops, BS-TGR ${pc(r0.kpi.util["BS-TGR"])}`);
    ok("DBR: rope releases lots later → mean WIP not higher", r1.kpi.dbr && r1.kpi.dbr.moved >= 0 && r1.kpi.wipMean <= r0.kpi.wipMean + 1e-6, `moved ${r1.kpi.dbr.moved}, WIP ${f2(r0.kpi.wipMean)} → ${f2(r1.kpi.wipMean)}`);
    // genealogy on a fresh MES (fixed clock)
    let T = 1000; const G = createMES({ now: () => T, fmt: (t) => "t" + t, dateOf: () => "261113" });
    const w = G.route("POST", "/api/bsf/mes/workorders", {}, { product: "FABS", qty: 1, dueDays: 2 }).data, rel = G.route("POST", `/api/bsf/mes/workorders/${w.id}/release`, {}, {});
    for (const id of w.lots) { const L = G.S.lots[id]; if (L.route === "FABS") continue; for (const op of L.ops) { T += 60; G.route("POST", "/api/bsf/mes/confirmations", {}, { lot: id, op: op.no, machine: op.m + "-01", good: L.qty, scrap: 0 }); } }
    const A = w.lots.map((id) => G.S.lots[id]).find((L) => L.route === "FABS");
    for (const op of A.ops) { T += 60; G.route("POST", "/api/bsf/mes/confirmations", {}, { lot: A.id, op: op.no, machine: op.m + "-01", good: 1, scrap: 0 }); }
    const asn = A.serials[0], tr = G.route("GET", "/api/bsf/mes/trace", { serial: asn }, {}).data, kids = tr ? tr.tree.children : [];
    ok("release FABS work order (qty 1) → 200, 3 lots (BS 2 pcs, BN 2 pcs, set 1 – start = need / yield)", rel.status === 200 && w.lots.length === 3, `${rel.status}, lots ${w.lots.join(", ")}`);
    ok("genealogy: assembly A-BS-… ← shaft (heat H7741) + nut (heat H5512)", !!asn && kids.length === 2 && kids.some((k) => k.heat === "H7741" && k.kind === "screw") && kids.some((k) => k.heat === "H5512" && k.kind === "nut"), `${asn} ← ${kids.map((k) => k.sn + " " + k.heat).join(", ")}`);
    const wu = G.route("GET", "/api/bsf/mes/trace", { heat: "H7741" }, {}).data; ok("where-used heat H7741 → the assembly", wu.assemblies.includes(asn), `${wu.count} serials, ${wu.assemblies.length} assemblies`);
    // idempotent confirmation + holds + SPC
    const W2 = G.route("POST", "/api/bsf/mes/workorders", {}, { product: "LG", qty: 10, release: true }).data, L2 = W2.lots[0], body = { lot: L2, op: "10", machine: "LG-SAW-01", good: 3, scrap: 0 };
    const k1 = G.route("POST", "/api/bsf/mes/confirmations", {}, body, { "Idempotency-Key": "t-1" }), k2 = G.route("POST", "/api/bsf/mes/confirmations", {}, body, { "Idempotency-Key": "t-1" });
    ok("idempotent confirmation: same key → replay, counted once", k1.status === 201 && k2.status === 200 && k2.data.replay === true && k2.data.id === k1.data.id && G.S.lots[L2].ops[0].good === 3, `${k1.data.id}, good ${G.S.lots[L2].ops[0].good}`);
    G.route("POST", `/api/bsf/mes/lots/${L2}/hold`, {}, { reason: "test hold" });
    const h1 = G.route("POST", "/api/bsf/mes/confirmations", {}, { ...body, good: 1 }), h2 = G.route("POST", "/api/bsf/mes/machines/LG-SAW-01/download", {}, { lot: L2 });
    ok("hold: confirmation + download → 423, not in dispatch", h1.status === 423 && h2.status === 423 && !G.route("GET", "/api/bsf/mes/dispatch", { machine: "LG-SAW-01" }, {}).data.items.some((x) => x.lot === L2));
    G.route("POST", `/api/bsf/mes/lots/${L2}/release`, {}, {}); G.route("POST", "/api/bsf/mes/machines/LG-SAW-01/spc", {}, { alarm: true, char: "LG-H" });
    const dsp = G.route("GET", "/api/bsf/mes/dispatch", { machine: "LG-SAW-01" }, {}).data; ok("SPC stop → dispatch list empty + blocked", dsp.blocked && dsp.items.length === 0);
    const nr = G.route("POST", "/api/bsf/mes/workorders", {}, { product: "BS-4010-1500-C5", qty: 5 }).data, n1 = G.route("POST", `/api/bsf/mes/workorders/${nr.id}/release`, {}, {}), n2 = G.route("POST", `/api/bsf/mes/workorders/${nr.id}/release`, {}, { force: true });
    ok("readiness: Ø40×10 dresser missing → 422, force → 200", n1.status === 422 && /dresser/.test(n1.data.detail) && n2.status === 200, n1.data.detail);
    ok("problem+json: unknown WO 404, bad product 400, qty 0 → 422", G.route("GET", "/api/bsf/mes/workorders/WO-99999", {}, {}).status === 404 && G.route("POST", "/api/bsf/mes/workorders", {}, { product: "XX" }).status === 400 && G.route("POST", "/api/bsf/mes/workorders", {}, { product: "LG", qty: 0 }).status === 422);
    const lb = gs1Element({ serial: "BS3210-261113-0042", lot: "L0012", code: "BS-3210-1000-C5" }); ok("GS1: GTIN check digit (Σ 29 → 1) + element string", lb.gtin === "09501101000001" && lb.hr.startsWith("(01)09501101000001(11)261113(21)BS3210-261113-0042"), lb.hr);
    // backend round trip
    await checkBackend();
    if (!be.reachable) log("MES server not reachable – browser-only checks done");
    else {
      const key = "t-" + uuid(), wb = { product: "BS", qty: 40, dueDays: 3, erpOrder: "TEST-6" };
      const s1 = await api("POST", "/api/bsf/mes/workorders", wb, { "Idempotency-Key": key }), s2 = await api("POST", "/api/bsf/mes/workorders", wb, { "Idempotency-Key": key });
      ok("server: POST work order 201 + same key → replay", s1.status === 201 && s2.status === 200 && s2.data.replay && s2.data.id === s1.data.id, s1.data.id);
      const s3 = await api("POST", `/api/bsf/mes/workorders/${s1.data.id}/release`, {}), s4 = await api("POST", `/api/bsf/mes/workorders/${s1.data.id}/release`, {});
      ok("server: release 200, 2nd release 409 problem+json", s3.status === 200 && s4.status === 409 && /problem\+json/.test(s4.ct), `${s3.status} / ${s4.status}`);
      for (const [nm, cs] of [["one EDD", caseOne("EDD")], ["one SPT", caseOne("SPT")], ["one CR", caseOne("CR")], ["flow SPT", caseFlow("SPT")], ["fam FAM", caseFam("FAM")], ["fam EDD", caseFam("EDD")]]) {
        const p = await api("POST", "/api/bsf/mes/eval", { kind: "schedule", case: cs }), j = schedule(cs);
        ok(`Python = JavaScript scheduler (${nm})`, p.ok && p.data.ops.length === j.ops.length && p.data.ops.every((x, i) => x.lot === j.ops[i].lot && Math.abs(x.start - j.ops[i].start) < 1e-6 && Math.abs(x.end - j.ops[i].end) < 1e-6), `${seq(j)} makespan ${j.kpi.makespan}`);
      }
      const big = { ...live, lots: live.lots.slice(0, 40) }, pb = await api("POST", "/api/bsf/mes/eval", { kind: "schedule", case: big }, {}, 20000), jb = schedule(big);
      ok("Python = JavaScript on the live plant (40 lots, shift calendar, furnaces)", pb.ok && pb.data.ops.length === jb.ops.length && pb.data.ops.every((x, i) => x.lot === jb.ops[i].lot && x.machine === jb.ops[i].machine && Math.abs(x.start - jb.ops[i].start) < 1e-6), `${jb.ops.length} ops, makespan ${f1(jb.kpi.makespan)} min, loads ${jb.kpi.loads}`);
      const po = await api("POST", "/api/bsf/mes/eval", { kind: "oee", ...H.oee }); ok("Python = JavaScript OEE", po.ok && Math.abs(po.data.OEE - o.OEE) < 1e-12, `${po.data.OEE}`);
      const ck = "c-" + uuid(), cb = { lot: s1.data.lots[0], op: "10", machine: "MS-SAW-01", good: 20, scrap: 0 };
      const c1 = await api("POST", "/api/bsf/mes/confirmations", cb, { "Idempotency-Key": ck }), c2 = await api("POST", "/api/bsf/mes/confirmations", cb, { "Idempotency-Key": ck });
      ok("server: confirmation 201 + replay", c1.status === 201 && c2.status === 200 && c2.data.replay && c2.data.id === c1.data.id, c1.data.id);
      const t4 = await api("GET", "/api/bsf/mes/trace?serial=NOPE"); ok("server: unknown serial → 404 problem+json", t4.status === 404 && /problem\+json/.test(t4.ct));
      const v1 = await api("GET", "/api/bsf/v1/mes/health"); ok("server: /api/bsf/v1/mes/... alias", v1.ok && v1.data.mode === "server");
      const ap = await api("GET", "/api/bsf/mes/api"); ok("server: route catalogue", ap.ok && ap.data.routes.length >= 40, `${ap.data.routes.length} routes`);
      const tw = await api("POST", "/api/bsf/mes/twin", twinSnap(true), {}, 20000); ok("server: twin state → MES (orders, confirmations)", tw.ok && tw.data.confirmations >= 0, JSON.stringify(tw.data));
      const sv = await api("GET", "/api/bsf/mes/serials?n=400"), asm = (sv.data.items || []).filter((x) => x.kind === "assembly");
      if (asm.length) { const tt = await api("GET", "/api/bsf/mes/trace?serial=" + encodeURIComponent(asm[asm.length - 1].sn)); ok("server: trace of a live assembly serial", tt.ok && tt.data.tree.children.length >= 2, `${asm[asm.length - 1].sn} ← ${tt.data.tree.children.map((k) => k.sn).join(", ")}`); }
      const hl = await api("GET", "/api/bsf/mes/health"); ok("server: persistence file in the scratch data folder", hl.data.persist && hl.data.persist.exists, hl.data.persist && hl.data.persist.path);
    }
  } catch (ex) { fail++; log("FAIL exception " + (ex && ex.stack || ex)); }
  const card = $("bfCard6"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : []; imgs.forEach((i) => { i.loading = "eager"; });
  host.querySelectorAll(".bf6-img").forEach((i) => { i.loading = "eager"; });
  setTimeout(() => {
    ok("card bfCard6", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
    chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, CARD6.drawings.length, 0);
    ok("Gantt: 73 machine rows", $("bf6Gantt").querySelectorAll(".bf6-rl").length === 73, `${$("bf6Gantt").querySelectorAll(".bf6-bar").length} bars`);
    ok("andon: 73 tiles", $("bf6ABoard").querySelectorAll(".bf6-at").length === 73);
    ok("page images loaded", [...host.querySelectorAll(".bf6-img")].every((i) => i.complete && i.naturalWidth > 0));
    log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
    const d = $("bf6Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = outL.join("\n"); d.prepend(pre);
  }, 3000);
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "6") { build(); if (built) setTimeout(() => { renderGantt(); }, 50); } });
if (window.bfCtl && window.bfCtl.current() === "6" && window.bfCtl.tabVisible()) build();
export { VERSION6, routeOps };
