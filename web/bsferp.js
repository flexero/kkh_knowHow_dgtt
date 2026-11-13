/* Ball screw + guide factory – item 7 "ERP" (#bfItem7).  Guide: docs/46_bsf_erp.md
 * Files: bsferp.js (UI, twin feed, self-check) · bsferp_data.js (SHARED master + sample data – the Python core reads its JSON block; item 8 may import it) ·
 *   bsferp_core.js (calculations + ERP state + local router = browser twin of the server) · bsferp_view.js (charts, MRP table) · bsferp_card.js (CARD7 + build vs buy) ·
 *   bsferp.css · server (optional): twin/bsf_erp.py + twin/bsf_erp_core.py – routes /api/bsf/erp/... in server.py.  Without the server the page runs the SAME ERP
 *   in the browser ("demo mode") with its own browser MES (web/bsfmes_core.js) – every call goes through erp(): server when it answers, local router otherwise.
 * Lazy: built on window event "bfitemshow" (detail "7"). Live: window.BSF (item 3) – the daily twin orders become sales orders of customer C-1000 (POST /twin every 5 s).
 * URL: /?bfitem=7#bsf · &bf7card=model|master|sales|mrp|buy|mes|cost|kpi|api|bb (scroll) · &bf7only=<same>|card (test-only: one card) · &bf7mat=<material> ·
 *   &bf7demo (force browser demo) · &bf7test (self-check, console "BF7TEST …" + #bf7Debug) · &bf7hold (headless: keep the load pending, show the tab) · card: &bf7tab=draw|buy|shop.
 * Offline. ALL VALUES ARE EXAMPLES – check with your ERP team.
 */
import { getBSF } from "./bsfsim.js";
import { NOTE7, MD, MAT7, CUST7, SUPP7, API7, MODULES7, ROLES7, CHECK7, SAMPLE7, TYPE_TXT, LOT_TXT } from "./bsferp_data.js";
import { createERP, mhr, workcenters, costRollup, eoq, safetyStock, rop, mav, lotCompare, mrpCheck, ctpCase, configure, finance, breakeven, aqlPlan, bottleneck, mpsLoad, MAT, VERSION7 } from "./bsferp_core.js";
import { esc, f0, f1, f2, eur, pc, lineChart, barChart, hbars, waterfall, mrpTable } from "./bsferp_view.js";
import { createMES } from "./bsfmes_core.js";
import { CARD7, BUILD_BUY7 } from "./bsferp_card.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const host = $("bfItem7");
const errs = [];
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "k-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf7-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const st = (s) => `<span class="bf7-st ${esc(String(s).replace(/ /g, "-"))}">${esc(s)}</span>`;
const g = (v) => String(+(+v).toPrecision(10));
if (Q.has("bf7test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf7hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf7hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("7"); }, 300); }
const visible = () => host && !host.hidden && (!window.bfCtl || window.bfCtl.tabVisible());

/* ------------------------------------------------------------------ HTTP: server ERP or the browser twin of it */
async function api(method, path, body, headers = {}, timeout = 8000) {
  const t0 = performance.now(), ac = new AbortController(), to = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(path, { method, headers: body != null ? { "Content-Type": "application/json", ...headers } : headers, body: body != null ? JSON.stringify(body) : undefined, cache: "no-store", signal: ac.signal });
    const ct = r.headers.get("Content-Type") || "", txt = await r.text(); let data = txt; try { if (ct.includes("json")) data = JSON.parse(txt); } catch (e) { /* text */ }
    return { status: r.status, ok: r.ok, data, ct, ms: performance.now() - t0, via: "server" };
  } finally { clearTimeout(to); }
}
let built = false, B = null, LE = null, LM = null, be = { on: false, reachable: false, info: null, forced: Q.has("bf7demo") };
function newLocal() {
  let erpRef = null;
  const mesL = createMES({ erp: (b) => (erpRef ? erpRef.route("POST", "/api/bsf/erp/goodsmovements", {}, b, null).data : null) });
  const mesFn = (method, path, body, headers) => { const u = new URL(path, location.origin); const r = mesL.route(method, u.pathname, Object.fromEntries(u.searchParams), body || {}, headers || {}); return { status: r.status, data: r.data }; };
  const erpL = createERP({ mes: mesFn, api: API7 }); erpRef = erpL;
  return [erpL, mesL];
}
async function erp(method, path, body, headers = {}) {
  if (be.on) { try { const r = await api(method, path, body, headers); if (r.status !== 404 || (r.data && r.data.title)) return r; } catch (e) { be.on = false; be.reachable = false; badge(); } }
  const u = new URL(path, location.origin), t0 = performance.now(), r = LE.route(method, u.pathname, Object.fromEntries(u.searchParams), body || {}, headers);
  return { status: r.status, ok: r.status < 400, data: r.data, ct: r.ct + "; charset=utf-8", ms: performance.now() - t0, via: "browser demo" };
}
async function checkBackend() {
  try { const r = await api("GET", "/api/bsf/erp/health", null, {}, 2000); be.reachable = r.ok && r.data && r.data.mode === "server"; be.info = be.reachable ? r.data : null; } catch (e) { be.reachable = false; be.info = null; }
  be.on = be.reachable && !be.forced; badge(); return be.on;
}
function badge() {
  const b = $("bf7Badge"); if (!b) return; const p = be.info && be.info.persist;
  b.textContent = be.on ? `ERP server /api/bsf/erp: online · ${p && p.on ? (p.exists ? "SQLite " + p.path.split(/[\\/]/).pop() : "SQLite after the first change") : "no persistence"} · MES ${be.info.mes ? "reachable" : "not reachable"}`
    : be.reachable ? "Browser demo chosen (the ERP server is online – switch below)" : "Browser demo – ERP + MES run in this page (start python server.py for the server ERP)";
  b.className = "bf7-badge" + (be.on ? " on" : "");
  const sw = $("bf7Mode"); if (sw) { sw.hidden = !be.reachable; sw.textContent = be.on ? "use the browser demo" : "use the ERP server"; }
}
function out(id, req, body, r) { const el = $(id); if (el) el.textContent = `${req}${body != null ? "\n" + JSON.stringify(body, null, 1) : ""}\n\nHTTP ${r.status} (${r.via}${r.ms ? ", " + f1(r.ms) + " ms" : ""})\n${JSON.stringify(r.data, null, 1).slice(0, 3500)}`; }

/* ------------------------------------------------------------------ twin → ERP (daily plant orders as sales orders of C-1000) */
let nFeed = 0, lastFeed = null;
async function feed() {
  if (!B) return;
  const orders = B.orders.slice(-40).map((o) => ({ id: o.id, product: o.product, qty: o.qty, due: o.due, state: o.state, done: o.done, tDone: o.tDone, tShip: o.tShip, dueTxt: B.clockOf ? B.clockOf(o.due) : "" }));
  try { const r = await erp("POST", "/api/bsf/erp/twin", { orders, stores: { fg: { ...B.stores.fg }, raw: { ...B.stores.raw } }, clock: B.clock(), t: B.t }); lastFeed = r.data; nFeed++; } catch (e) { /* demo */ }
}

/* ------------------------------------------------------------------ build */
const SECTIONS = { model: "bf7Model", master: "bf7Master", sales: "bf7Sales", mrp: "bf7Mrp", buy: "bf7Buy", mes: "bf7Mes", cost: "bf7Cost", kpi: "bf7Kpi", api: "bf7Api", bb: "bf7BB" };
const MAKE = MAT7.filter((m) => m.proc === "make").map((m) => m.id), REFS = ["FABS-3210-1000-C5", "FALG-25-1000", "BS-3210-1000-C5", "BN-3210-FL", "LG-25-1000", "LB-25-FL"];
let selMat = MAT[Q.get("bf7mat")] ? Q.get("bf7mat") : "FABS-3210-1000-C5", selMrp = "BN-3210-FL", selCost = "BS-3210-1000-C5", selSo = "", lastMrp = null, logSeq = 0;
function build() {
  if (built || !host) return; built = true;
  B = getBSF(); [LE, LM] = newLocal();
  const opt = (arr, sel) => arr.map((x) => `<option${x === sel ? " selected" : ""}>${esc(x)}</option>`).join("");
  const custOpts = CUST7.filter((c) => c.id !== "C-1000").map((c) => `<option value="${c.id}"${c.id === SAMPLE7.customer ? " selected" : ""}>${c.id} – ${esc(c.n)}</option>`).join("");
  const fgOpts = MAT7.filter((m) => m.type === "fg" && !MAT[m.id].variant).map((m) => `<option${m.id === SAMPLE7.product ? " selected" : ""}>${esc(m.id)}</option>`).join("");
  host.innerHTML = `
  <div class="bf7-wrap">
    <div class="bf7-rule"><b>ERP rule of this plant:</b> the ERP talks <b>HTTP only</b> (REST + JSON): to the MES (item 6, <code>/api/bsf/mes/…</code>), to supplier portals, to customer order APIs and to every browser.
      It never talks to a machine – machines are behind the MES and the Modbus TCP gateway (item 4). No MQTT, no OPC UA. ${esc(NOTE7)}
      <div class="bf7-bar"><span class="bf7-badge" id="bf7Badge">…</span> <button class="btn" id="bf7Mode" hidden>use the ERP server</button> <span class="bf7-sub" id="bf7Feed"></span></div></div>

    <div class="card" id="bf7Model">
      <div class="card-head"><h2>1 · What the ERP does – modules, data flow, roles</h2><span class="bf7-sub">ISA-95 / IEC 62264 level 4 · ${MODULES7.length} modules · ${API7.length} HTTP routes</span></div>
      <div class="bf7-two"><div><img class="bf7-img" src="img/46_erp_modules.svg" alt="ERP modules map" loading="lazy"></div>
        <div>${tbl(["Module", "what it does here", "HTTP"], MODULES7.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), `<code>${esc(r[2])}</code>`]), "bf7-small")}
          <details class="bf7-det"><summary>Roles</summary>${tbl(["Role", "does"], ROLES7.map((r) => r.map(esc)), "bf7-small")}</details>
          <p class="bf7-hint"><b>ERP vs MES:</b> the ERP decides <b>what</b> and <b>when</b> (orders, dates, material, money) in days and weeks; the MES decides <b>which machine, which minute</b> and reports back what really happened.
          The production order is the hand-over: <code>POST /api/bsf/erp/productionorders/{id}/release</code> → MES work order.</p></div></div>
      <img class="bf7-img bf7-half" src="img/46_data_model.svg" alt="ERP data model" loading="lazy">
    </div>

    <div class="card" id="bf7Master">
      <div class="card-head"><h2>2 · Master data – customers, suppliers, materials, BOMs, routings, work centres, configurator</h2><span class="bf7-sub">${MAT7.length} materials (+ family variants) · ${CUST7.length} customers · ${SUPP7.length} suppliers</span></div>
      <div class="bf7-tabs" id="bf7MTabs">${[["mat", "Materials"], ["bom", "BOM"], ["rout", "Routing + work centres"], ["mhr", "Machine hour rate"], ["cfg", "Configurator"], ["cs", "Customers + suppliers"]].map(([k, t], i) => `<button class="btn bf7-tab${i ? "" : " on"}" data-mt="${k}">${t}</button>`).join("")}</div>
      <div data-mp="mat"><div class="bf7-bar"><label class="bf7-lbl">type <select id="bf7MType" aria-label="material type"><option value="">all</option>${Object.entries(TYPE_TXT).map(([k, t]) => `<option value="${k}">${k} – ${esc(t)}</option>`).join("")}</select></label></div><div class="bf7-scroll" id="bf7MatList"></div></div>
      <div data-mp="bom" hidden><div class="bf7-bar"><label class="bf7-lbl">material <select id="bf7BomSel" aria-label="BOM material">${opt(REFS, selMat)}</select></label> <span class="bf7-mut">GET /api/bsf/erp/boms/{id} – phantom = routing step inside the parent's MES work order (no own order, no stock)</span></div>
        <div class="bf7-two"><div id="bf7Bom"></div><div><img class="bf7-img" src="img/46_bom_tree.svg" alt="BOM tree" loading="lazy"></div></div></div>
      <div data-mp="rout" hidden><div class="bf7-bar"><label class="bf7-lbl">make item <select id="bf7RoutSel" aria-label="routing material">${opt(REFS, "BS-3210-1000-C5")}</select></label></div><div id="bf7Rout"></div></div>
      <div data-mp="mhr" hidden><div class="bf7-two"><div id="bf7MhrEx"></div><div><img class="bf7-img" src="img/46_mhr_buildup.svg" alt="machine hour rate" loading="lazy"></div></div><div class="bf7-scroll" id="bf7MhrList"></div></div>
      <div data-mp="cfg" hidden>
        <div class="bf7-two"><div class="bf7-info"><h3>Ball screw set</h3>
          <div class="bf7-bar"><label class="bf7-lbl">Ø d <select id="bf7CfD">${opt(MD.config.bs.d.map(String), "32")}</select></label><label class="bf7-lbl">lead <select id="bf7CfL">${opt(["5", "10", "20"], "10")}</select></label>
            <label class="bf7-lbl">length <input id="bf7CfLen" type="number" value="1000" step="50" style="width:70px"></label><label class="bf7-lbl">grade <select id="bf7CfG">${opt(["C3", "C5", "C7"], "C5")}</select></label>
            <label class="bf7-lbl">preload <select id="bf7CfP">${opt(["P0", "P1", "P2"], "P1")}</select></label></div><div id="bf7CfOutS" class="bf7-pre"></div></div>
          <div class="bf7-info"><h3>Linear guide set</h3>
          <div class="bf7-bar"><label class="bf7-lbl">size <select id="bf7CgS">${opt(MD.config.lg.size.map(String), "25")}</select></label><label class="bf7-lbl">rail length <input id="bf7CgLen" type="number" value="1000" step="20" style="width:70px"></label>
            <label class="bf7-lbl">block <select id="bf7CgB">${opt(["FL", "NA"], "FL")}</select></label><label class="bf7-lbl">preload <select id="bf7CgP">${opt(["Z0", "Z1", "Z2"], "Z1")}</select></label>
            <label class="bf7-lbl">class <select id="bf7CgC">${opt(["N", "H", "P"], "H")}</select></label><label class="bf7-lbl">carriages <input id="bf7CgN" type="number" value="2" min="1" max="6" style="width:46px"></label></div><div id="bf7CfOutG" class="bf7-pre"></div></div></div>
        <p class="bf7-sub2">Codes follow item 1 (codeBS / codeBN / codeLG / codeLB). Price = rule table in <code>MD.config</code> (example list prices, price group factor of the customer applied in the quotation). Rules: lead per Ø, L/d ≤ 60, C3 ≤ 1 500 mm, rail ≤ 4 000 mm.</p></div>
      <div data-mp="cs" hidden><div class="bf7-two"><div>${tbl(["Customer", "Name", "Country", "Terms d", "Credit k€", "Incoterm", "Order channel", "Price group"], CUST7.map((c) => [`<b>${c.id}</b>`, esc(c.n), c.country, c.terms, c.creditK, esc(c.inco), esc(c.channel), esc(c.group)]), "bf7-small")}</div>
        <div>${tbl(["Supplier", "Name", "Supplies", "LT d", "Terms d", "Rating", "Channel", "Cert."], SUPP7.map((s) => [`<b>${s.id}</b>`, esc(s.n), esc(s.supplies), s.lt, s.terms, s.rating, esc(s.channel), esc(s.cert)]), "bf7-small")}</div></div></div>
    </div>

    <div class="card" id="bf7Sales">
      <div class="card-head"><h2>3 · Sales – quotation → sales order → ATP / CTP date → confirmation → delivery → invoice</h2><span class="bf7-sub" id="bf7SoSum"></span></div>
      <div class="bf7-bar"><label class="bf7-lbl">customer <select id="bf7SC" aria-label="customer">${custOpts}</select></label><label class="bf7-lbl">product <select id="bf7SP" aria-label="product"><option value="__cfg">configured (screw form above)</option>${fgOpts}</select></label>
        <label class="bf7-lbl">qty <input id="bf7SQ" type="number" value="${SAMPLE7.qty}" min="1" style="width:70px"></label>
        <button class="btn" id="bf7QNew">POST quotation</button> <button class="btn" id="bf7QAcc" disabled>accept → sales order</button> <button class="btn" id="bf7Atp">ATP / CTP check</button></div>
      <div class="bf7-two"><div><div class="bf7-pre" id="bf7SOut">Create a quotation – request and answer appear here.</div><div id="bf7AtpBox" class="bf7-info">ATP / CTP: press "ATP / CTP check" (try qty 400 or 2 000 of the set).</div></div>
        <div><img class="bf7-img" src="img/46_order_to_cash.svg" alt="order to cash" loading="lazy"></div></div>
      <h3 class="bf7-h">Sales orders (newest first) – actions</h3><div class="bf7-scroll" id="bf7SoList"></div>
      <details class="bf7-det"><summary>Deliveries + invoices</summary><div class="bf7-two"><div id="bf7DnList"></div><div id="bf7InvList"></div></div></details>
    </div>

    <div class="card" id="bf7Mrp">
      <div class="card-head"><h2>4 · MRP – gross → net requirements, lot sizing, lead-time offset, planned orders, exception messages</h2><span class="bf7-sub" id="bf7MrpSum"></span></div>
      <div class="bf7-bar"><label class="bf7-lbl">horizon <select id="bf7MH">${opt(["6", "8", "12"], "8")}</select> weeks</label><button class="btn" id="bf7MRun">run MRP</button>
        <label class="bf7-lbl">item <select id="bf7MItem" aria-label="MRP item"></select></label><span class="bf7-mut">gross = max(forecast, firm orders) for saleable items; dependent = parent planned releases × BOM qty; phantoms pass through.</span></div>
      <div id="bf7MTable"></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Planned orders (convert → requisition / production order)</h3><div class="bf7-scroll" id="bf7PlList"></div></div>
        <div><h3 class="bf7-h">Exception messages</h3><div class="bf7-scroll" id="bf7Exc"></div><img class="bf7-img" src="img/46_mrp_logic.svg" alt="MRP logic" loading="lazy"></div></div>
      <h3 class="bf7-h">Lot sizing compared (${esc(MD.lotExample.item)}, net requirements of 8 weeks, S = ${MD.lotExample.S} € per set-up, H = ${MD.lotExample.Hweek} € per piece and week)</h3>
      <div class="bf7-two"><div id="bf7Lot"></div><div id="bf7LotChart"></div></div>
      <div class="bf7-two"><div class="bf7-info" id="bf7Eoq"></div><div class="bf7-info" id="bf7Rop"></div></div>
    </div>

    <div class="card" id="bf7Buy">
      <div class="card-head"><h2>5 · Purchasing + inventory – requisition → PO (supplier portal over HTTP) → goods receipt → incoming inspection → stock</h2><span class="bf7-sub" id="bf7BuySum"></span></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Purchase requisitions (from MRP)</h3><div id="bf7PrList"></div><h3 class="bf7-h">Purchase orders</h3><div class="bf7-scroll" id="bf7PoList"></div>
          <h3 class="bf7-h">Inspection lots (item 5 sampling ISO 2859-1)</h3><div id="bf7IlList"></div><div class="bf7-pre" id="bf7BOut">Actions answer here.</div></div>
        <div><img class="bf7-img" src="img/46_procure_to_pay.svg" alt="procure to pay" loading="lazy"><h3 class="bf7-h">Stock value + turns</h3><div id="bf7Val"></div></div></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Stock per material / location / batch (heat lot)</h3><div class="bf7-scroll" id="bf7Stock"></div></div><div><h3 class="bf7-h">ABC / XYZ + reorder points</h3><div class="bf7-scroll" id="bf7Abc"></div></div></div>
      <details class="bf7-det"><summary>Last goods movements</summary><div class="bf7-scroll" id="bf7Mov"></div></details>
    </div>

    <div class="card" id="bf7Mes">
      <div class="card-head"><h2>6 · Production orders ↔ MES over HTTP – release, confirmations back, backflush, settlement</h2><span class="bf7-sub" id="bf7PSum"></span></div>
      <div class="bf7-bar"><label class="bf7-lbl">new production order <select id="bf7PM" aria-label="make material">${opt(REFS, "LG-25-1000")}</select></label><label class="bf7-lbl">qty <input id="bf7PQ" type="number" value="50" min="1" style="width:60px"></label>
        <button class="btn" id="bf7PNew">POST production order</button> <span class="bf7-mut">then: release → MES work order · sync → confirmations + backflush · settle → variances</span></div>
      <div class="bf7-two"><div><div class="bf7-scroll" id="bf7PList"></div><div class="bf7-pre" id="bf7POut">Production-order actions answer here.</div></div><div><img class="bf7-img" src="img/46_erp_mes_sequence.svg" alt="ERP MES sequence" loading="lazy"></div></div>
      <h3 class="bf7-h">Live log of the HTTP JSON messages (ERP ↔ MES, MES → ERP goods receipts, ERP → supplier portal)</h3><div class="bf7-log" id="bf7Log"></div>
    </div>

    <div class="card" id="bf7Cost">
      <div class="card-head"><h2>7 · Costing + finance – standard cost roll-up, actual cost, variances, P&L, cash, break-even</h2><span class="bf7-sub">material + machine hours × rate + labour + overhead + scrap allowance</span></div>
      <div class="bf7-bar"><label class="bf7-lbl">product <select id="bf7CSel" aria-label="cost product">${opt(REFS, selCost)}</select></label></div>
      <div class="bf7-two"><div id="bf7CRoll"></div><div id="bf7CWf"></div></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Standard cost of the reference products</h3><div id="bf7CAll"></div></div><div><h3 class="bf7-h">Variances (settled orders + purchase price variance)</h3><div id="bf7Var"></div></div></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Simple P&L per month (plan year)</h3><div id="bf7Pnl"></div></div><div><h3 class="bf7-h">EBIT and cash per month</h3><div id="bf7PnlChart"></div><div id="bf7Be" class="bf7-info"></div></div></div>
    </div>

    <div class="card" id="bf7Kpi">
      <div class="card-head"><h2>8 · Dashboard – order intake, backlog, on-time delivery, inventory, turns, margin, capacity load</h2><span class="bf7-sub" id="bf7KSum"></span></div>
      <div class="bf7-kpis" id="bf7Tiles"></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Order intake vs delivered value per week (€)</h3><div id="bf7K1"></div></div><div><h3 class="bf7-h">On-time delivery per week</h3><div id="bf7K2"></div></div></div>
      <div class="bf7-two"><div><h3 class="bf7-h">Inventory value per week (€)</h3><div id="bf7K3"></div></div><div><h3 class="bf7-h">Capacity load of the bottlenecks (MPS + CTP bookings)</h3><div id="bf7K4"></div><img class="bf7-img" src="img/46_atp_ctp.svg" alt="ATP CTP" loading="lazy"></div></div>
    </div>

    <div class="card" id="bf7Api">
      <div class="card-head"><h2>9 · API "try it" – real HTTP requests + JSON answers</h2><span class="bf7-sub">${API7.length} routes · /api/bsf/erp/… (also /api/bsf/v1/erp/…)</span></div>
      <div class="bf7-bar"><select id="bf7XEx" aria-label="example">${apiExamples().map((x, i) => `<option value="${i}">${esc(x[0])}</option>`).join("")}</select>
        <select id="bf7XM" aria-label="method"><option>GET</option><option>POST</option></select> <input id="bf7XP" style="width:340px" aria-label="path">
        <label class="bf7-lbl"><input type="checkbox" id="bf7XK"> Idempotency-Key</label> <button class="btn" id="bf7XGo">send</button></div>
      <textarea id="bf7XB" rows="4" class="bf7-ta" aria-label="request body"></textarea>
      <div class="bf7-two"><div><h3 class="bf7-h">Request</h3><div class="bf7-pre" id="bf7XReq"></div></div><div><h3 class="bf7-h">Response</h3><div class="bf7-pre" id="bf7XRes"></div></div></div>
      <details class="bf7-det"><summary>All routes</summary>${tbl(["Method", "Path", "What"], API7.map((r) => [`<b>${r[0]}</b>`, `<code>${esc(r[1])}</code>`, esc(r[2])]), "bf7-small")}</details>
    </div>

    <div class="card" id="bf7BB">
      <div class="card-head"><h2>10 · Build or buy the ERP? – honest comparison</h2><span class="bf7-sub">guide 46 §24</span></div>
      ${tbl(["Point", "Own ERP core (like this item)", "Bought ERP product"], BUILD_BUY7.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]))}
    </div>
    <div class="bf7-debug" id="bf7Debug" hidden></div>
  </div>`;
  try { makeCard(CARD7, host.querySelector(".bf7-wrap"), { card: "bfCard7", q: "bfQ7", g: "bfG7", cnt: "bfCnt7", buy: "bfBuy7" }, "bf7"); } catch (e) { console.error(e); }
  host.querySelector(".bf7-wrap").appendChild($("bf7Debug"));
  wire();
  renderStatic();
  checkBackend().then(async () => {
    await feed(); await runMrp(false); await renderAll();
    if (Q.has("bf7test")) setTimeout(selfTest, 400);
  });
  setInterval(() => { if (visible()) feed(); }, 5000);
  setInterval(tick, 2000);
  if (SECTIONS[Q.get("bf7card")]) setTimeout(() => $(SECTIONS[Q.get("bf7card")]).scrollIntoView({ block: "start" }), 900);
  if (Q.get("bf7only")) { const k = Q.get("bf7only"); host.querySelectorAll(".bf7-wrap > .card, .bf7-wrap > .bf7-rule").forEach((c) => { c.hidden = !(c.id === SECTIONS[k] || (k === "card" && c.id === "bfCard7")); }); }
}

/* ------------------------------------------------------------------ wiring */
let lastQt = null;
function wire() {
  $("bf7Mode").addEventListener("click", async () => { be.forced = be.on; be.on = !be.on && be.reachable; badge(); await feed(); await runMrp(false); await renderAll(); });
  host.querySelectorAll("[data-mt]").forEach((b) => b.addEventListener("click", () => { host.querySelectorAll("[data-mt]").forEach((x) => x.classList.toggle("on", x === b)); host.querySelectorAll("[data-mp]").forEach((p) => { p.hidden = p.dataset.mp !== b.dataset.mt; }); }));
  $("bf7MType").addEventListener("change", renderMaterials);
  $("bf7BomSel").addEventListener("change", (e) => { selMat = e.target.value; renderBom(); });
  $("bf7RoutSel").addEventListener("change", renderRouting);
  ["bf7CfD", "bf7CfL", "bf7CfLen", "bf7CfG", "bf7CfP", "bf7CgS", "bf7CgLen", "bf7CgB", "bf7CgP", "bf7CgC", "bf7CgN"].forEach((id) => $(id).addEventListener("input", renderConfig));
  $("bf7QNew").addEventListener("click", newQuote); $("bf7QAcc").addEventListener("click", acceptQuote); $("bf7Atp").addEventListener("click", atpCheck);
  $("bf7SoList").addEventListener("click", async (e) => { const b = e.target.closest("[data-so]"); if (!b) return; const path = `/api/bsf/erp/salesorders/${b.dataset.so}/${b.dataset.act}`, r = await erp("POST", path, {}); out("bf7SOut", "POST " + path, {}, r); if (b.dataset.act === "confirm" && r.data && r.data.atp) showAtp(r.data.atp[0]); await renderSales(); });
  $("bf7InvList").addEventListener("click", async (e) => { const b = e.target.closest("[data-pay]"); if (!b) return; const r = await erp("POST", `/api/bsf/erp/invoices/${b.dataset.pay}/pay`, {}); out("bf7SOut", `POST /api/bsf/erp/invoices/${b.dataset.pay}/pay`, {}, r); renderSales(); });
  $("bf7MRun").addEventListener("click", () => runMrp(true)); $("bf7MItem").addEventListener("change", (e) => { selMrp = e.target.value; renderMrpTable(); });
  $("bf7PlList").addEventListener("click", async (e) => { const b = e.target.closest("[data-pl]"); if (!b) return; const r = await erp("POST", `/api/bsf/erp/plannedorders/${b.dataset.pl}/convert`, {}); out("bf7BOut", `POST /api/bsf/erp/plannedorders/${b.dataset.pl}/convert`, {}, r); await renderMrpLists(); await renderBuy(); await renderProd(); });
  $("bf7PrList").addEventListener("click", async (e) => { const b = e.target.closest("[data-pr]"); if (!b) return; const body = { requisition: b.dataset.pr }, r = await erp("POST", "/api/bsf/erp/purchaseorders", body, { "Idempotency-Key": uuid() }); out("bf7BOut", "POST /api/bsf/erp/purchaseorders", body, r); renderBuy(); });
  $("bf7PoList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-po]"); if (!b) return;
    const path = b.dataset.act === "send" ? `/api/bsf/erp/purchaseorders/${b.dataset.po}/send` : "/api/bsf/erp/goodsreceipts", body = b.dataset.act === "send" ? {} : { po: b.dataset.po };
    const r = await erp("POST", path, body); out("bf7BOut", "POST " + path, body, r); renderBuy(); renderLog();
  });
  $("bf7IlList").addEventListener("click", async (e) => { const b = e.target.closest("[data-il]"); if (!b) return; const body = { decision: b.dataset.d, defects: b.dataset.d === "accept" ? 0 : 9, by: "quality (page)" }, r = await erp("POST", `/api/bsf/erp/inspections/${b.dataset.il}/decision`, body); out("bf7BOut", `POST /api/bsf/erp/inspections/${b.dataset.il}/decision`, body, r); renderBuy(); });
  $("bf7PNew").addEventListener("click", async () => { const body = { material: $("bf7PM").value, qty: +$("bf7PQ").value, dueDays: 10 }, r = await erp("POST", "/api/bsf/erp/productionorders", body, { "Idempotency-Key": uuid() }); out("bf7POut", "POST /api/bsf/erp/productionorders", body, r); renderProd(); });
  $("bf7PList").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pid]"); if (!b) return;
    const path = `/api/bsf/erp/productionorders/${b.dataset.pid}/${b.dataset.act}`, body = b.dataset.act === "settle" ? { force: true } : {}, key = b.dataset.act === "release" ? `rel-${b.dataset.pid}-${Date.now()}` : "";
    const r = await erp("POST", path, body, key ? { "Idempotency-Key": key } : {}); out("bf7POut", `POST ${path}${key ? "\nIdempotency-Key: " + key : ""}`, body, r); await renderProd(); await renderLog(); renderCostVar();
  });
  $("bf7CSel").addEventListener("change", (e) => { selCost = e.target.value; renderCost(); });
  $("bf7XEx").addEventListener("change", fillExample); $("bf7XGo").addEventListener("click", sendTry); fillExample();
}

/* ------------------------------------------------------------------ 2: master data */
function renderStatic() { renderMaterials(); renderBom(); renderRouting(); renderMhr(); renderConfig(); renderLotEoq(); renderCost(); renderFinance(); }
function renderMaterials() {
  const ty = $("bf7MType").value;
  $("bf7MatList").innerHTML = tbl(["Material", "Name", "Type", "UoM", "Proc.", "LT d", "Lot rule", "Lot q", "SS", "Std price €", "Supplier"], MAT7.filter((m) => !ty || m.type === ty).map((m) => {
    const c = m.proc === "make" ? costRollup(m.id) : null;
    return [`<b>${esc(m.id)}</b>`, esc(m.n), esc(m.type), m.uom, esc(m.proc), m.lt, `<span title="${esc(LOT_TXT[m.lot] || "")}">${esc(m.lot)}</span>`, m.lotQ || "", m.ss, c ? f2(c.std) + " (roll-up)" : m.proc === "phantom" ? "–" : String(m.price), esc(m.sup)];
  }), "bf7-small bf7-num");
}
async function renderBom() {
  const r = await erp("GET", `/api/bsf/erp/boms/${encodeURIComponent(selMat)}`), d = r.data;
  $("bf7Bom").innerHTML = d.rows ? tbl(["Level", "Material", "Qty / 1", "UoM", "Proc.", "LLC", "Std €"], d.rows.map((x) => [`<span class="bf7-lvl" style="padding-left:${x.level * 12}px">${x.level}</span>`, `<b>${esc(x.material)}</b><br><span class="bf7-mut">${esc(x.name)}</span>`, g(x.qty.toFixed(4)), x.uom, esc(x.proc), x.llc, x.price != null ? f2(x.price) : ""]), "bf7-small") + `<p class="bf7-mut">${d.levels} levels · ${r.via}</p>` : esc(JSON.stringify(d));
}
async function renderRouting() {
  const m = $("bf7RoutSel").value, r = await erp("GET", `/api/bsf/erp/routings/${encodeURIComponent(m)}`), d = r.data;
  if (!d.ops) { $("bf7Rout").textContent = d.title; return; }
  const c = costRollup(m);
  $("bf7Rout").innerHTML = `<p class="bf7-hint">${esc(m)} · routing ${esc(d.version)} (item 2 web/bsfmfg_data.js, variant G) · route yield Π(1 − scrap) = <b>${d.yield.toFixed(4)}</b> · time per piece t = cycle + set-up / batch · cost per op = t / 60 / OEE ${MD.plant.oee} × (machine rate + crew × ${MD.plant.labour} €/h)</p>` +
    tbl(["Op", "Work centre", "Operation", "Set-up min", "Cycle min", "Batch", "t min/pc", "Scrap %", "Rate €/h", "Machine €", "Labour €"], d.ops.map((o, i) => [`<b>${o.no}</b>`, esc(o.workCenter), esc(o.name), o.setup, f2(o.cycle), o.batch, f2(o.effMin), o.scrapPct, f2(o.rate), f2(c.ops[i].machine), f2(c.ops[i].labour)]), "bf7-small bf7-num");
}
function renderMhr() {
  const R = mhr("BS-TGR"), H = CHECK7.mhr;
  $("bf7MhrEx").innerHTML = `<h3>Worked example – thread grinder BS-TGR (${R.n} machines)</h3>
    <p class="bf7-hint">machine hour rate = (depreciation + interest + space + energy + maintenance) / planned hours</p>${tbl(["Element", "Formula (example values)", "€ per year"], [
    ["Depreciation", `price ${f0(R.price)} € / life ${R.life} years`, f0(R.dep)], ["Interest (calculatory)", `price / 2 × ${pc(MD.plant.interest, 0)}`, f0(R.int)],
    ["Space", `${R.areaM2.toFixed(2)} m² (footprint × ${MD.plant.access} access) × ${MD.plant.room.grind} €/m² (climate room)`, f0(R.space)],
    ["Energy", `${R.kW} kW × load ${MD.plant.loadFactor} × ${f0(R.hours)} h × ${MD.plant.energy} €/kWh`, f0(R.energy)], ["Maintenance", `${pc(MD.plant.maint.grind, 0)} of the price per year`, f0(R.maint)],
    ["<b>Total</b>", "", `<b>${f0(R.total)}</b>`], ["Planned hours", `${MD.plant.days} days × 2 shifts × ${MD.plant.shiftH} h`, f0(R.hours)], ["<b>Machine hour rate</b>", `${f0(R.total)} / ${f0(R.hours)}`, `<b>${f2(R.rate)} €/h</b>`],
    ["+ labour", `crew ${R.crew} × ${MD.plant.labour} €/h`, f2(R.labourRate) + " €/h"]].map((r) => r.map((x) => (typeof x === "string" && x.startsWith("<b>") ? x : esc(x)))), "bf7-small")}
    <p class="bf7-mut">hand check: ${f0(H.dep)} + ${f0(H.int)} + ${f0(H.space)} + ${f0(H.energy)} + ${f0(H.maint)} = ${f0(H.dep + H.int + H.space + H.energy + H.maint)} € / ${f0(H.hours)} h</p>`;
  $("bf7MhrList").innerHTML = tbl(["Work centre", "Name", "n", "Price k€", "kW", "Area m²", "Hours / year", "Depr.", "Interest", "Space", "Energy", "Maint.", "Rate €/h", "Crew"], workcenters().map((R) => [`<b>${R.type}</b>`, esc(R.name.slice(0, 44)), R.n, f0(R.price / 1000), R.kW, f1(R.areaM2), f0(R.hours), f0(R.dep), f0(R.int), f0(R.space), f0(R.energy), f0(R.maint), `<b>${f2(R.rate)}</b>`, R.crew]), "bf7-small bf7-num");
}
async function renderConfig() {
  const bs = { kind: "screw", d: +$("bf7CfD").value, lead: +$("bf7CfL").value, length: +$("bf7CfLen").value, grade: $("bf7CfG").value, preload: $("bf7CfP").value };
  const lg = { kind: "guide", size: +$("bf7CgS").value, length: +$("bf7CgLen").value, block: $("bf7CgB").value, preload: $("bf7CgP").value, cls: $("bf7CgC").value, blocks: +$("bf7CgN").value };
  for (const [b, id] of [[bs, "bf7CfOutS"], [lg, "bf7CfOutG"]]) { const r = await erp("POST", "/api/bsf/erp/configure", b), d = r.data; $(id).textContent = `POST /api/bsf/erp/configure ${JSON.stringify(b)}\n→ ${d.ok ? "OK" : "NOT VALID"} ${d.code || ""}  ${d.variant || ""}\nlist price ${d.price != null ? f2(d.price) + " €" : "–"}\n${(d.rules || []).join("\n")}`; }
}

/* ------------------------------------------------------------------ 3: sales */
async function newQuote() {
  const p = $("bf7SP").value, line = p === "__cfg" ? { config: { kind: "screw", d: +$("bf7CfD").value, lead: +$("bf7CfL").value, length: +$("bf7CfLen").value, grade: $("bf7CfG").value, preload: $("bf7CfP").value }, qty: +$("bf7SQ").value } : { code: p, qty: +$("bf7SQ").value };
  const body = { customer: $("bf7SC").value, lines: [line], dueDays: 15 }, key = uuid(), r = await erp("POST", "/api/bsf/erp/quotations", body, { "Idempotency-Key": key });
  out("bf7SOut", `POST /api/bsf/erp/quotations\nIdempotency-Key: ${key}`, body, r); if (r.status === 201) { lastQt = r.data.id; $("bf7QAcc").disabled = false; }
}
async function acceptQuote() { if (!lastQt) return; const r = await erp("POST", `/api/bsf/erp/quotations/${lastQt}/accept`, {}); out("bf7SOut", `POST /api/bsf/erp/quotations/${lastQt}/accept`, {}, r); if (r.ok) { $("bf7QAcc").disabled = true; selSo = r.data.id; } renderSales(); }
async function atpCheck() { const p = $("bf7SP").value === "__cfg" ? "FABS-3210-1000-C5" : $("bf7SP").value, body = { product: p, qty: +$("bf7SQ").value }, r = await erp("POST", "/api/bsf/erp/atp", body); out("bf7SOut", "POST /api/bsf/erp/atp", body, r); if (r.ok) showAtp(r.data); }
function showAtp(a) {
  if (!a) return; const c = a.ctp;
  $("bf7AtpBox").innerHTML = `<h3>${esc(a.product)} × ${g(a.qty)} → <b>${esc(a.promiseDate || "no date")}</b> (${esc(a.method)})</h3><ol class="bf7-ol">${(a.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
    <p class="bf7-mut">cumulative ATP (look-ahead) day 0 … 10: ${(a.atpDays || []).map(f0).join(" · ")}${c ? ` · CTP: need ${f0(c.need)} min, done day ${c.doneDay ?? "–"}, bottleneck ${esc(c.bottleneck)} free ≈ ${f0(c.freeMinDay0)} min/day of ${f0(c.capMin)}` : ""}</p>`;
}
async function renderSales() {
  const r = await erp("GET", "/api/bsf/erp/salesorders?size=60"), d = r.data, items = d.items || [];
  $("bf7SoSum").textContent = `${d.total} sales orders (${items.filter((s) => s.customer === "C-1000").length} from the twin) · ${r.via}`;
  const actions = (s) => s.customer === "C-1000" ? `<span class="bf7-mut">twin</span>` : s.status === "open" ? `<button class="btn bf7-x" data-so="${s.id}" data-act="confirm">confirm (ATP/CTP)</button>` : s.status === "confirmed" ? `<button class="btn bf7-x" data-so="${s.id}" data-act="deliver">deliver</button>` : s.status === "delivered" ? `<button class="btn bf7-x" data-so="${s.id}" data-act="invoice">invoice</button>` : "";
  $("bf7SoList").innerHTML = tbl(["SO", "Customer", "Lines", "Value", "Due", "Confirmed", "Status", ""], items.map((s) => [`<b>${esc(s.id)}</b>`, esc(s.customer), s.lines.map((l) => `${g(l.qty)} × ${esc(l.code)}${l.method ? ` <span class="bf7-mut">(${esc(l.method)})</span>` : ""}`).join("<br>"), eur(s.value), esc(s.due), esc(s.confirmed || ""), st(s.status), actions(s)]), "bf7-small");
  const dn = (await erp("GET", "/api/bsf/erp/deliveries")).data.items || [], inv = (await erp("GET", "/api/bsf/erp/invoices")).data.items || [];
  $("bf7DnList").innerHTML = dn.length ? tbl(["Delivery", "SO", "Lines", "On time"], dn.map((x) => [esc(x.id), esc(x.so), x.lines.map((l) => `${g(l.qty)} × ${esc(l.code)}`).join(", "), x.onTime ? "yes" : `<b class="bf7-nok">late</b>`]), "bf7-small") : `<p class="bf7-mut">no delivery yet</p>`;
  $("bf7InvList").innerHTML = inv.length ? tbl(["Invoice", "SO", "Net", "VAT", "Gross", "Due", "Status", ""], inv.map((x) => [esc(x.id), esc(x.so), eur(x.net), eur(x.vat), eur(x.gross), esc(x.due), st(x.status), x.status === "open" ? `<button class="btn bf7-x" data-pay="${x.id}">pay</button>` : ""]), "bf7-small") : `<p class="bf7-mut">no invoice yet</p>`;
}

/* ------------------------------------------------------------------ 4: MRP */
async function runMrp(manual) {
  const H = $("bf7MH") ? +$("bf7MH").value : 8, r = await erp("POST", "/api/bsf/erp/mrp/run", { horizon: H });
  if (!r.ok) return; lastMrp = (await erp("GET", "/api/bsf/erp/mrp")).data;
  const ids = Object.keys(lastMrp.items);
  $("bf7MItem").innerHTML = ids.map((i) => `<option${i === selMrp ? " selected" : ""}>${esc(i)}</option>`).join("");
  $("bf7MrpSum").textContent = `${ids.length} items · ${r.data.planned.length} planned orders · ${r.data.exceptions.length} exceptions · run ${r.data.at} (${r.via})${manual ? " · manual" : ""}`;
  renderMrpTable(); await renderMrpLists();
}
function renderMrpTable() { if (!lastMrp || !lastMrp.items[selMrp]) return; $("bf7MTable").innerHTML = mrpTable(lastMrp.items[selMrp], lastMrp.weekStart) + `<p class="bf7-mut">net = SS − (on hand + receipts − gross) when that is below the safety stock · planned receipt = lot size(net) · release = receipt − LT weeks</p>`; }
async function renderMrpLists() {
  const pl = (await erp("GET", "/api/bsf/erp/plannedorders")).data.items || [];
  $("bf7PlList").innerHTML = tbl(["Planned", "Item", "Qty", "Release", "Due", "Kind", ""], pl.slice(0, 80).map((p) => [esc(p.id), esc(p.item), g(p.qty), esc(p.releaseDate), esc(p.dueDate), esc(p.kind), p.status === "planned" ? `<button class="btn bf7-x" data-pl="${p.id}">convert</button>` : `→ ${esc(p.to)}`]), "bf7-small");
  const ex = lastMrp ? lastMrp.exceptions : [];
  $("bf7Exc").innerHTML = ex.length ? tbl(["Item", "Message", "Week", "Text"], ex.map((x) => [esc(x.item), `<b>${esc(x.kind)}</b>`, x.bucket, esc(x.text)]), "bf7-small") : `<p class="bf7-mut">no exception</p>`;
}
function renderLotEoq() {
  const L = MD.lotExample, lc = lotCompare(L.net, L.S, L.Hweek, L.FOQ), rules = ["L4L", "FOQ", "EOQ", "POQ"];
  $("bf7Lot").innerHTML = tbl(["Rule", ...L.net.map((_, i) => "W" + (i + 1)), "Set-ups", "Set-up €", "Holding €", "Total €"], [["net", ...L.net.map(String), "", "", "", ""], ...rules.map((r) => { const x = lc.rules[r]; return [`<b>${r}</b>`, ...x.orders.map((q) => (q ? f0(q) : "")), x.setups, f0(x.setupCost), f0(x.holdCost), `<b>${f0(x.cost)}</b>`]; })], "bf7-small bf7-num") +
    `<p class="bf7-mut">EOQ = √(2 × ${f1(L.net.reduce((a, b) => a + b) / 8)} × ${L.S} / ${L.Hweek}) = ${f1(lc.EOQ)} · POQ period P = round(EOQ / mean demand) = ${lc.P} weeks · fixed lot ${L.FOQ} · holding on the stock at the end of each week</p>`;
  $("bf7LotChart").innerHTML = barChart([{ name: "total cost €", values: rules.map((r) => lc.rules[r].cost) }], rules, { title: "lot sizing total cost", fmt: f0, unit: " €", h: 190 });
  const E = CHECK7.eoq, R = CHECK7.rop;
  $("bf7Eoq").innerHTML = `<h3>EOQ = √(2DS/H)</h3><p>wiper seal SEAL-3210: D = ${f0(E.D)} pcs / year (2 × 120 nuts × 250 days), S = ${E.S} € per order, H = 20 % × 0.90 € = ${E.H} € per pc and year</p><p>EOQ = √(2 × ${f0(E.D)} × ${E.S} / ${E.H}) = <b>${f0(eoq(E.D, E.S, E.H))} pcs</b> → ${f1(E.D / eoq(E.D, E.S, E.H))} orders per year</p>`;
  $("bf7Rop").innerHTML = `<h3>Reorder point = d × LT + SS, SS = z · σ · √LT</h3><p>z = ${R.z} (95 % service), σ = ${R.sigma} pcs/day, LT = ${R.LT} days → SS = ${R.z} × ${R.sigma} × √${R.LT} = <b>${f1(safetyStock(R.z, R.sigma, R.LT))}</b></p><p>d = ${R.d} pcs/day → ROP = ${R.d} × ${R.LT} + ${R.SS} = <b>${f1(rop(R.d, R.LT, R.SS))} pcs</b></p>`;
}

/* ------------------------------------------------------------------ 5: purchasing + inventory */
async function renderBuy() {
  const prs = (await erp("GET", "/api/bsf/erp/purchaserequisitions")).data.items || [], pos = (await erp("GET", "/api/bsf/erp/purchaseorders")).data.items || [], ils = (await erp("GET", "/api/bsf/erp/inspections")).data.items || [];
  $("bf7BuySum").textContent = `${prs.length} requisitions · ${pos.length} purchase orders · ${ils.filter((x) => x.status === "open").length} open inspection lots`;
  $("bf7PrList").innerHTML = prs.length ? tbl(["PR", "Material", "Qty", "Need", "Supplier", "Status", ""], prs.slice(0, 20).map((p) => [esc(p.id), esc(p.material), g(p.qty), esc(p.need), esc(p.supplier), st(p.status), p.status === "open" ? `<button class="btn bf7-x" data-pr="${p.id}">→ PO</button>` : esc(p.po || "")]), "bf7-small") : `<p class="bf7-mut">convert a planned purchase order in section 4 first</p>`;
  $("bf7PoList").innerHTML = tbl(["PO", "Supplier", "Lines", "Status", "Sent via", ""], pos.slice(0, 30).map((p) => [`<b>${esc(p.id)}</b>`, esc(p.supplier), p.lines.map((l) => `${g(l.qty)} ${esc(l.material)} @ ${l.price} (${g(l.received)} rec.)`).join("<br>"), st(p.status), esc(p.sent ? p.sent.via : "–"),
    (p.status === "created" ? `<button class="btn bf7-x" data-po="${p.id}" data-act="send">send (HTTP)</button>` : "") + (["sent", "partly received"].includes(p.status) ? `<button class="btn bf7-x" data-po="${p.id}" data-act="gr">goods receipt</button>` : "")]), "bf7-small");
  $("bf7IlList").innerHTML = ils.length ? tbl(["Lot", "Material", "Qty", "Batch", "Plan", "Status", ""], ils.slice(0, 12).map((x) => [esc(x.id), esc(x.material), g(x.qty), esc(x.batch), esc(x.plan.text || ""), x.decision ? st(x.decision) : st(x.status), x.status === "open" ? `<button class="btn bf7-x" data-il="${x.id}" data-d="accept">accept</button><button class="btn bf7-x" data-il="${x.id}" data-d="reject">reject</button>` : ""]), "bf7-small") : `<p class="bf7-mut">no inspection lot yet – make a goods receipt</p>`;
  const v = (await erp("GET", "/api/bsf/erp/inventory/valuation")).data;
  $("bf7Val").innerHTML = `<div class="bf7-kpis">${[["Stock value (moving average)", eur(v.totalMav)], ["at standard", eur(v.totalStd)], ["Plan COGS / year", eur(v.cogsYear)], ["Turns", f1(v.turns)], ["Days of supply", f1(v.daysOfSupply)]].map(([a, b]) => `<div class="bf7-tile"><span>${a}</span><b>${b}</b></div>`).join("")}</div>
    ${hbars(Object.entries(v.byType).map(([k, x]) => ({ label: TYPE_TXT[k] || k, v: x, text: eur(x) })), { title: "stock value by type", left: 190 })}<p class="bf7-mut">turns = COGS / stock value – high here because the WIP sits in the MES lots and is not valued in this demo (real plants with WIP: ≈ 6 – 15).</p>`;
  const sr = (await erp("GET", "/api/bsf/erp/stock")).data.rows || [];
  $("bf7Stock").innerHTML = tbl(["Material", "Location", "Batch", "Qty", "Status"], sr.map((s) => [esc(s.mat), esc(s.loc), esc(s.batch), g(s.qty.toFixed(3)), s.status === "blocked" ? `<b class="bf7-warn">blocked (QI)</b>` : "free"]), "bf7-small bf7-num");
  const a = (await erp("GET", "/api/bsf/erp/analysis/abc")).data;
  $("bf7Abc").innerHTML = tbl(["Material", "Value / year", "Cum.", "ABC", "CV", "XYZ", "SS", "ROP"], a.items.map((x) => [esc(x.material), eur(x.value), pc(x.cumPct, 0), `<b>${x.abc}</b>`, x.cv, x.xyz, x.SS != null ? f0(x.SS) : "", x.ROP != null ? f0(x.ROP) : ""]), "bf7-small bf7-num") + `<p class="bf7-mut">${esc(a.rule)}</p>`;
  const mv = (await erp("GET", "/api/bsf/erp/goodsmovements?n=40")).data.items || [];
  $("bf7Mov").innerHTML = tbl(["Movement", "Type", "Material", "Qty", "Order", "Batch", "Stock after", "Text"], mv.map((m) => [esc(m.id), esc(m.type), esc(m.material), g(m.qty), esc(m.order), esc(m.batch), g(m.stock), esc(m.text)]), "bf7-small");
}

/* ------------------------------------------------------------------ 6: production orders ↔ MES */
async function renderProd() {
  const items = (await erp("GET", "/api/bsf/erp/productionorders")).data.items || [];
  $("bf7PSum").textContent = `${items.length} production orders · ${items.filter((p) => p.mesWorkOrder).length} in the MES`;
  const act = (p) => (p.status === "created" ? `<button class="btn bf7-x" data-pid="${p.id}" data-act="release">release → MES</button>` : "") + (p.mesWorkOrder && !["settled"].includes(p.status) ? `<button class="btn bf7-x" data-pid="${p.id}" data-act="sync">sync</button><button class="btn bf7-x" data-pid="${p.id}" data-act="settle">settle</button>` : "");
  $("bf7PList").innerHTML = tbl(["Order", "Material", "Qty", "Due", "Status", "MES WO", "Good / scrap", "GR from MES", "Std total", ""], items.slice(0, 30).map((p) => [`<b>${esc(p.id)}</b>`, esc(p.material), g(p.qty), esc(p.due), st(p.status), esc(p.mesWorkOrder || "–"), `${g(p.good)} / ${g(p.scrap)}`, g(p.grQty), eur(p.stdTotal), act(p)]), "bf7-small");
}
async function renderLog() {
  const r = await erp("GET", "/api/bsf/erp/log?since=0"), items = (r.data.items || []).slice(-25).reverse();
  $("bf7Log").innerHTML = items.length ? items.map((x) => `<div class="bf7-ev"><b>${esc(x.dir)}</b> ${esc(x.method)} <code>${esc(x.path)}</code> → <b>${x.status || "–"}</b> ${x.ms ? f1(x.ms) + " ms" : ""} <span class="bf7-mut">${esc(x.at)}</span>
    <details><summary>JSON</summary><pre>${esc(JSON.stringify({ request: x.req, response: x.resp }, null, 1).slice(0, 2500))}</pre></details></div>`).join("") : `<p class="bf7-mut">No message yet – release a production order, send a PO, or wait for MES goods receipts.</p>`;
}

/* ------------------------------------------------------------------ 7: costing + finance */
function renderCost() {
  const c = costRollup(selCost);
  const rows = [["Material (BOM at std price)", f2(c.matBuy + c.matMake), c.material.map((x) => `${g(x.qty.toFixed(4))} ${x.uom} ${x.child} × ${f2(x.price)}`).join(" + ")], ["Material overhead MOH", f2(c.moh), `${pc(MD.plant.moh, 0)} × bought material ${f2(c.matBuy)}`],
    ["Machine (t / 60 / OEE × rate)", f2(c.machine), `${c.ops.length} operations of route ${c.route}`], ["Labour (t / 60 / OEE × crew × " + MD.plant.labour + " €/h)", f2(c.labour), ""], ["Production overhead POH", f2(c.poh), `${pc(MD.plant.poh, 0)} × (machine + labour)`],
    ["Scrap allowance", f2(c.scrap), `base ${f2(c.base)} × (1 / yield ${c.yield.toFixed(4)} − 1)`], ["<b>Standard cost</b>", `<b>${f2(c.std)}</b>`, ""], ["SG&A " + pc(MD.plant.sga, 0), f2(c.sga), ""], ["<b>Full cost</b>", `<b>${f2(c.full)}</b>`, ""],
    ["List price", f2(c.price), ""], ["<b>Margin</b>", `<b>${f2(c.margin)} (${pc(c.marginPct)})</b>`, "(price − full cost) / price"]];
  $("bf7CRoll").innerHTML = tbl(["Element", "€ / pc", "how"], rows.map((r) => [r[0].startsWith("<b>") ? r[0] : esc(r[0]), r[1], esc(r[2])]), "bf7-small") +
    `<details class="bf7-det"><summary>Operations (${c.ops.length})</summary>${tbl(["Op", "WC", "t min", "Rate", "Machine €", "Labour €", "Cum. conversion incl. POH"], c.ops.map((o) => [o.no, o.m, f2(o.t), f2(o.rate), f2(o.machine), f2(o.labour), f2(o.cumConv)]), "bf7-small bf7-num")}</details>` +
    (Object.keys(c.semi).length ? `<p class="bf7-mut">semi-finished values (raw + MOH + conversion up to the op): ${Object.entries(c.semi).map(([k, v]) => `${k} ${f2(v)} €`).join(" · ")}</p>` : "");
  $("bf7CWf").innerHTML = waterfall([{ label: "material", v: c.matBuy + c.matMake }, { label: "MOH", v: c.moh }, { label: "machine", v: c.machine }, { label: "labour", v: c.labour }, { label: "POH", v: c.poh }, { label: "scrap", v: c.scrap }], { title: "cost roll-up " + selCost, totalLabel: "std cost", price: c.price });
  $("bf7CAll").innerHTML = tbl(["Product", "Material", "Conversion", "Overhead", "Scrap", "Std", "Full", "Price", "Margin"], REFS.map((p) => { const x = costRollup(p); return [`<b>${p}</b>`, f2(x.matBuy + x.matMake + x.moh), f2(x.machine + x.labour), f2(x.poh), f2(x.scrap), `<b>${f2(x.std)}</b>`, f2(x.full), f0(x.price), pc(x.marginPct)]; }), "bf7-small bf7-num");
  renderCostVar();
}
async function renderCostVar() {
  const v = (await erp("GET", "/api/bsf/erp/variances")).data;
  $("bf7Var").innerHTML = (v.settled.length ? tbl(["Order", "Good", "Std total", "Qty var.", "Efficiency var.", "Scrap var.", "Actual", "Actual / pc"], v.settled.slice(0, 10).map((s) => [esc(s.order), g(s.good), eur(s.stdTotal), f2(s.qtyVariance), f2(s.efficiencyVariance), f2(s.scrapVariance), eur(s.actualTotal), f2(s.actualPerPc)]), "bf7-small bf7-num") : `<p class="bf7-mut">No settled order yet – section 6: release, sync (after the MES has produced), settle.</p>`) +
    `<p class="bf7-mut">Purchase price variance PPV = (PO price − std price) × qty at goods receipt: Σ ${f2(v.ppvTotal)} € over ${v.ppv.length} receipts. Price variance (material), quantity variance (usage), efficiency variance (hours) – guide 46 §17.</p>`;
}
function renderFinance() {
  const F = finance(), B2 = breakeven(), rows = F.rows;
  $("bf7Pnl").innerHTML = tbl(["Month", "Days", "Revenue", "COGS (std)", "Volume var.", "Idle capacity", "SG&A", "EBIT", "EBIT %", "Cash end"], [...rows.map((r) => [r.month, r.days, eur(r.revenue), eur(r.cogs), eur(r.volVar), eur(r.idle), eur(r.sga), `<b>${eur(r.ebit)}</b>`, pc(r.ebitPct), eur(r.cash)]),
    ["<b>Year</b>", "", `<b>${eur(F.year.revenue)}</b>`, eur(F.year.cogs), eur(F.year.volVar), eur(F.year.idle), eur(F.year.sga), `<b>${eur(F.year.ebit)}</b>`, pc(F.year.ebit / F.year.revenue), ""]], "bf7-small bf7-num");
  $("bf7PnlChart").innerHTML = lineChart([{ name: "EBIT per month", values: rows.map((r) => r.ebit) }, { name: "net cash flow per month", values: rows.map((r) => r.netCash) }], rows.map((r) => r.month), { title: "EBIT and cash", fmt: (v) => f0(v / 1000) + " k", unit: " €", min0: false });
  $("bf7Be").innerHTML = `<b>Break-even</b> = fixed costs / contribution margin: fixed per month = machines ${eur(B2.fixedMachMonth)} + production overhead ${eur(B2.pohMonth)} + SG&A ${eur(B2.sgaMonth)} = <b>${eur(B2.fixedMonth)}</b>;
    contribution per production day (120 FABS + 200 FALG) = ${B2.lines.map((l) => `${l.perDay} × (${f0(l.price)} − ${f2(l.variable)})`).join(" + ")} = <b>${eur(B2.contribPerDay)}</b> → break-even after <b>${f1(B2.beDays)} of ${f1(B2.planDays)} days</b> per month (${pc(B2.bePct)}), safety margin ${pc(B2.safetyMargin)}.`;
}

/* ------------------------------------------------------------------ 8: dashboard */
async function renderKpi() {
  const k = (await erp("GET", "/api/bsf/erp/kpi")).data;
  $("bf7KSum").textContent = `${k.openSO} open customer orders · ${k.openPO} open POs · ${k.prodOpen} open production orders · twin ${B ? B.clock() : ""}`;
  const tiles = [["Order intake 30 days", eur(k.intake30)], ["Backlog", eur(k.backlog)], ["On-time delivery", `${pc(k.otd)} (${k.otdCount[0]} / ${k.otdCount[1]})`], ["Inventory value", eur(k.inventory)], ["Turns", f1(k.turns)], ["Plan margin (full cost)", pc(k.marginPlan)], ["Revenue plan / year", eur(k.revenuePlan)], ["Load BS-TGR", pc(k.load["BS-TGR"])]];
  $("bf7Tiles").innerHTML = tiles.map(([a, b]) => `<div class="bf7-tile"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join("");
  const lab = k.trend.map((t) => (t.week ? "W" + t.week : "now"));
  $("bf7K1").innerHTML = lineChart([{ name: "order intake", values: k.trend.map((t) => t.intake) }, { name: "delivered", values: k.trend.map((t) => t.delivered) }], lab, { fmt: (v) => f0(v / 1000) + " k", unit: " €", min0: false });
  $("bf7K2").innerHTML = lineChart([{ name: "on-time delivery", values: k.trend.map((t) => t.otd) }], lab, { fmt: (v) => pc(v, 0), max: 1, min0: false, ref: { y: 0.95, text: "target 95 %" } });
  $("bf7K3").innerHTML = lineChart([{ name: "inventory value", values: k.trend.map((t) => t.inventory) }], lab, { fmt: (v) => f0(v / 1000) + " k", unit: " €" });
  $("bf7K4").innerHTML = hbars(Object.entries(k.load).map(([t, v]) => ({ label: t, v, text: pc(v), warn: v > 0.9 })), { max: 1.1, ref: { v: 1, text: "100 %" }, title: "bottleneck load" });
}

/* ------------------------------------------------------------------ 9: try it */
function apiExamples() {
  return [["GET health", "GET", "/api/bsf/erp/health", null], ["GET materials (raw)", "GET", "/api/bsf/erp/materials?type=raw", null], ["GET BOM FABS", "GET", "/api/bsf/erp/boms/FABS-3210-1000-C5", null],
    ["GET routing BS", "GET", "/api/bsf/erp/routings/BS-3210-1000-C5", null], ["GET work centres (machine hour rates)", "GET", "/api/bsf/erp/workcenters", null],
    ["POST configure screw", "POST", "/api/bsf/erp/configure", { kind: "screw", d: 25, lead: 5, length: 600, grade: "C7", preload: "P1" }],
    ["POST sales order (Idempotency-Key)", "POST", "/api/bsf/erp/salesorders", { customer: "C-1003", product: "FALG-25-1000", qty: 80, dueDays: 10 }, true],
    ["POST ATP / CTP 2 000 sets", "POST", "/api/bsf/erp/atp", { product: "FABS-3210-1000-C5", qty: 2000 }], ["POST MRP run", "POST", "/api/bsf/erp/mrp/run", { horizon: 8 }],
    ["GET MRP item BN", "GET", "/api/bsf/erp/mrp?item=BN-3210-FL", null], ["POST purchase order", "POST", "/api/bsf/erp/purchaseorders", { supplier: "S-2004", lines: [{ material: "BALL-6.35-G5", qty: 40000 }] }, true],
    ["POST production order", "POST", "/api/bsf/erp/productionorders", { material: "LB-25-FL", qty: 200, dueDays: 8 }, true],
    ["POST release (item 4 compatible: unknown id + product)", "POST", "/api/bsf/erp/productionorders/PO-4711/release", { product: "LG", qty: 50 }, true],
    ["POST release PO-260001 again → 409", "POST", "/api/bsf/erp/productionorders/PO-260001/release", {}],
    ["POST goods issue too big → 409", "POST", "/api/bsf/erp/goodsmovements", { type: "GI", material: "LB-25-FL", qty: 99999, order: "WO-00002" }],
    ["POST MES confirmation push", "POST", "/api/bsf/erp/confirmations", { erpOrder: "PO-260002", op: "10", good: 50, scrap: 0, setupMin: 10, runMin: 41, msgId: "conf-demo-1" }],
    ["GET stock of one material", "GET", "/api/bsf/erp/stock?material=RAW-50CRMO4-D36", null], ["GET costing BS", "GET", "/api/bsf/erp/costing/BS-3210-1000-C5", null],
    ["GET P&L", "GET", "/api/bsf/erp/finance/pnl", null], ["GET KPI", "GET", "/api/bsf/erp/kpi", null], ["POST eval EOQ", "POST", "/api/bsf/erp/eval", { kind: "eoq", D: 60000, S: 80, H: 0.18 }],
    ["POST eval MRP hand case", "POST", "/api/bsf/erp/eval", { kind: "mrp" }], ["Unknown sales order → 404 problem+json", "GET", "/api/bsf/erp/salesorders/SO-99999", null],
    ["Bad product → 400", "POST", "/api/bsf/erp/salesorders", { customer: "C-1001", product: "XX-1", qty: 5 }], ["GET message log", "GET", "/api/bsf/erp/log?since=0", null]];
}
function fillExample() { const x = apiExamples()[+$("bf7XEx").value || 0]; $("bf7XM").value = x[1]; $("bf7XP").value = x[2]; $("bf7XB").value = x[3] ? JSON.stringify(x[3], null, 1) : ""; $("bf7XK").checked = !!x[4]; }
async function sendTry() {
  const m = $("bf7XM").value, p = $("bf7XP").value.trim(); let body = null;
  if (m === "POST") { try { body = $("bf7XB").value.trim() ? JSON.parse($("bf7XB").value) : {}; } catch (e) { $("bf7XRes").textContent = "body is not valid JSON: " + e.message; return; } }
  const h = $("bf7XK").checked ? { "Idempotency-Key": uuid() } : {};
  $("bf7XReq").textContent = `${m} ${p} HTTP/1.1\nHost: ${location.host}\nAccept: application/json${body ? "\nContent-Type: application/json" : ""}${h["Idempotency-Key"] ? "\nIdempotency-Key: " + h["Idempotency-Key"] : ""}\n\n${body ? JSON.stringify(body, null, 1) : ""}`;
  const r = await erp(m, p, body, h), txt = JSON.stringify(r.data, null, 1);
  $("bf7XRes").textContent = `HTTP/1.1 ${r.status}\nContent-Type: ${r.ct}\n(${r.via}${r.via === "browser demo" ? " – the same contract as twin/bsf_erp.py" : ""}, ${f1(r.ms)} ms)\n\n${txt.length > 6000 ? txt.slice(0, 6000) + "\n… (" + txt.length + " characters)" : txt}`;
  return r;
}

/* ------------------------------------------------------------------ loop */
let nTick = 0;
async function tick() {
  if (!visible() || !built) return; nTick++;
  $("bf7Feed").textContent = `twin ${B.clock()} · ERP feed #${nFeed}${lastFeed ? ` (${lastFeed.twinOrders} twin orders)` : ""} · ${be.on ? "server" : "browser demo"}`;
  try { if (nTick % 3 === 1) { await renderSales(); await renderLog(); } if (nTick % 5 === 2) { await renderKpi(); await renderProd(); } if (nTick % 15 === 7) await renderBuy(); } catch (e) { /* demo – never show errors */ }
}
async function renderAll() { try { await renderSales(); await renderBuy(); await renderProd(); await renderLog(); await renderKpi(); renderCostVar(); } catch (e) { console.error(e); } }

/* ------------------------------------------------------------------ self-check (&bf7test) */
async function selfTest() {
  const outL = [], log = (s) => { outL.push(s); console.log("BF7TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const okk = Math.abs(got - exp) <= tol; okk ? pass++ : fail++; log(`${okk ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(8)} (hand ${Number(exp).toPrecision(8)} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const eqA = (a, b) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
  const H = CHECK7;
  try {
    // MRP on the small BOM (A → 2 × B)
    const m = mrpCheck();
    ok("MRP A: planned releases 10 / 20 / 40 / 0 / 50 / 0 (lot-for-lot, LT 1)", eqA(m.A.prl, H.mrp.relA), m.A.prl.join(" "));
    ok("MRP B: gross = 2 × releases of A", eqA(m.grossB, H.mrp.grossB), m.grossB.join(" "));
    ok("MRP B: projected on hand 30 / 90 / 10 / 10 / 10 / 10, net 100 in week 4", eqA(m.B.poh, H.mrp.pohB) && eqA(m.B.net, H.mrp.netB), `POH ${m.B.poh.join(" ")}, net ${m.B.net.join(" ")}`);
    ok("MRP B: fixed lot 100 released in week 2 (LT 2)", eqA(m.B.prl, H.mrp.relB), m.B.prl.join(" "));
    ok("exception: receipt 50 in week 1 needed only in week 3 → push out", m.C.exceptions.some((e) => e.kind === "push out" && /week 3/.test(e.text)), m.C.exceptions.map((e) => e.kind).join(", "));
    ok("exception: requirement in week 0 with LT 2 → expedite", m.D.exceptions.some((e) => e.kind === "expedite"), m.D.exceptions.map((e) => e.text).join("; "));
    chk("EOQ = √(2 × 60 000 × 80 / 0.18)", eoq(H.eoq.D, H.eoq.S, H.eoq.H), H.eoq.Q, 1e-9);
    chk("SS = 1.65 × 30 × √9", safetyStock(H.rop.z, H.rop.sigma, H.rop.LT), H.rop.SS, 1e-9); chk("ROP = 240 × 9 + 148.5", rop(H.rop.d, H.rop.LT, H.rop.SS), H.rop.ROP, 1e-9);
    chk("moving average (400 × 14.40 + 400 × 14.10) / 800", mav(H.mav.q0, H.mav.p0, H.mav.q1, H.mav.p1), H.mav.avg, 1e-12);
    const R = mhr("BS-TGR"), M = H.mhr;
    chk("MHR BS-TGR depreciation 1.1 M€ / 10", R.dep, M.dep, 1e-9); chk("interest 1.1 M€ / 2 × 6 %", R.int, M.int, 1e-9); chk("space 5.5 × 2.8 × 1.8 × 250", R.space, M.space, 1e-9);
    chk("energy 30 × 0.6 × 3 750 × 0.18", R.energy, M.energy, 1e-9); chk("maintenance 5 % × 1.1 M€", R.maint, M.maint, 1e-9);
    chk("machine hour rate = 217 080 / 3 750", R.rate, (M.dep + M.int + M.space + M.energy + M.maint) / M.hours, 1e-9);
    const c = costRollup("BS-3210-1000-C5"), tgr = c.ops.find((o) => o.no === "100");
    chk("op 100 thread grinding t = 40 + 45 / 20 min", tgr.t, 42.25, 1e-12); chk("op 100 machine € = 42.25 / 60 / 0.75 × rate", tgr.machine, 42.25 / 60 / 0.75 * R.rate, 1e-9);
    chk("BS material = 1.01 m × 14.40 + 4.50 + 0.20 + 2.80", c.matBuy, 1.01 * 14.4 + 4.5 + 0.2 + 2.8, 1e-9);
    chk("BS std = (M + MOH + machine + labour + POH) / yield", c.std, (c.matBuy + 0.06 * c.matBuy + c.machine + c.labour + 0.6 * (c.machine + c.labour)) / c.yield, 1e-9);
    const fabs = costRollup("FABS-3210-1000-C5");
    chk("FABS material = std BS + std BN + carton 3.50 + 2 g grease", fabs.matBuy + fabs.matMake, costRollup("BS-3210-1000-C5").std + costRollup("BN-3210-FL").std + 3.5 + 2 * 0.03, 1e-9);
    const lg = costRollup("LG-25-1000"), lb = costRollup("LB-25-FL"), falg = costRollup("FALG-25-1000");
    chk("FALG material = LG + 2 × LB + carton", falg.matBuy + falg.matMake, lg.std + 2 * lb.std + 2.6, 1e-9);
    ok("all reference products: price > full cost (margin > 0)", ["FABS-3210-1000-C5", "FALG-25-1000", "BS-3210-1000-C5", "BN-3210-FL", "LG-25-1000", "LB-25-FL"].every((p) => costRollup(p).marginPct > 0), ["BS-3210-1000-C5", "LB-25-FL"].map((p) => p + " " + pc(costRollup(p).marginPct)).join(", "));
    const lc = lotCompare(MD.lotExample.net, MD.lotExample.S, MD.lotExample.Hweek, MD.lotExample.FOQ);
    chk("lot-for-lot cost = 8 set-ups × 400 €", lc.rules.L4L.cost, 3200, 1e-9); ok("POQ cheaper than lot-for-lot here", lc.rules.POQ.cost < lc.rules.L4L.cost, `POQ ${f0(lc.rules.POQ.cost)} €, EOQ ${f1(lc.EOQ)}`);
    const a = ctpCase(H.atp); ok("CTP hand case: 70 × 45 = 3 150 min, 1 200 min/day from day 3 → done day 5, promise day 8", a.need === 3150 && a.doneDay === H.atp.doneDay && a.promiseDay === H.atp.promiseDay, `${a.need} min, day ${a.doneDay} → ${a.promiseDay}`);
    const b = bottleneck("FABS-3210-1000-C5"); chk("BS-TGR capacity = 8 × 900 min × 0.75", b.cap, 5400, 1e-9); ok("MPS load below capacity (CTP has free minutes)", mpsLoad("BS-TGR") < b.cap, `${f0(mpsLoad("BS-TGR"))} of ${f0(b.cap)} min`);
    const cs = configure({ kind: "screw" }), cg = configure({ kind: "guide" });
    ok("configurator: reference screw set = list price 640 € and code FABS-3210-1000-C5", Math.abs(cs.price - 640) < 1e-9 && cs.code === "FABS-3210-1000-C5" && cs.codes.screw === "BS-3210-1000-C5", `${f2(cs.price)} € ${cs.code}`);
    ok("configurator: reference guide set = 246 €, Ø16 lead 20 rejected", Math.abs(cg.price - 246) < 1e-9 && !configure({ kind: "screw", d: 16, lead: 20 }).ok, `${f2(cg.price)} €`);
    const aq = aqlPlan(2000, "1.0"); ok("AQL 1.0, lot 2 000 → code K, n 125, Ac 3 (item 5 sampling)", aq.letter === "K" && aq.n === 125 && aq.ac === 3, JSON.stringify(aq));
    const fy = finance(); ok("plan year: EBIT > 0 and break-even below the plan days", fy.year.ebit > 0 && breakeven().bePct < 1, `EBIT ${eur(fy.year.ebit)} (${pc(fy.year.ebit / fy.year.revenue)}), break-even ${pc(breakeven().bePct)}`);
    // browser ERP + browser MES round trip
    const [E2, M2] = newLocal(), rt = (mth, p, bd, hd) => E2.route(mth, p, {}, bd || {}, hd || {});
    const so = rt("POST", "/api/bsf/erp/salesorders", { customer: "C-1001", product: "FABS", qty: 40 }).data, cf = rt("POST", `/api/bsf/erp/salesorders/${so.id}/confirm`), dl = rt("POST", `/api/bsf/erp/salesorders/${so.id}/deliver`), iv = rt("POST", `/api/bsf/erp/salesorders/${so.id}/invoice`);
    ok("order to cash: SO 201 → confirm (ATP) → deliver 201 → invoice 201 (19 % VAT)", cf.status === 200 && cf.data.lines[0].method === "ATP" && dl.status === 201 && iv.status === 201 && Math.abs(iv.data.vat - 0.19 * iv.data.net) < 0.01, `${so.id} ${cf.data.confirmed} · ${iv.data.gross} €`);
    const big = rt("POST", "/api/bsf/erp/atp", { product: "FABS-3210-1000-C5", qty: 2000 }).data; ok("ATP / CTP for 2 000 sets: date found, later than for 40", big.ok && big.promiseDay > 1, `${big.method} day +${big.promiseDay} ${big.promiseDate}`);
    const mr = rt("POST", "/api/bsf/erp/mrp/run", { horizon: 8 }).data; ok("MRP run on the plant data: planned orders + every item has a record", mr.planned.length > 10 && mr.items > 30, `${mr.items} items, ${mr.planned.length} planned, ${mr.exceptions.length} exceptions`);
    const pb = mr.planned.find((p) => p.kind === "purchase"), pr = rt("POST", `/api/bsf/erp/plannedorders/${pb.id}/convert`).data, po = rt("POST", "/api/bsf/erp/purchaseorders", { requisition: pr.id }).data;
    const snd = rt("POST", `/api/bsf/erp/purchaseorders/${po.id}/send`), gr = rt("POST", "/api/bsf/erp/goodsreceipts", { po: po.id }).data, dec = rt("POST", `/api/bsf/erp/inspections/${gr.inspection}/decision`, { defects: 0 });
    ok("procure to pay: planned → PR → PO → send (HTTP) → GR blocked → inspection accept → free stock", snd.status === 200 && gr.id && dec.status === 200 && dec.data.decision === "accept" && E2.S.stock.some((s) => s.batch === gr.batch && s.status === "free"), `${pb.item}: ${po.id} ${gr.batch}`);
    const pro = rt("POST", "/api/bsf/erp/productionorders", { material: "LG-25-1000", qty: 10 }).data, k = "t-" + uuid();
    const r1 = rt("POST", `/api/bsf/erp/productionorders/${pro.id}/release`, {}, { "Idempotency-Key": k }), r2 = rt("POST", `/api/bsf/erp/productionorders/${pro.id}/release`, {}, { "Idempotency-Key": k }), r3 = rt("POST", `/api/bsf/erp/productionorders/${pro.id}/release`);
    ok("release → MES work order (create + release), same key → replay, again → 409", r1.status === 201 && r1.data.mesWorkOrder && r2.status === 200 && r2.data.replay && r3.status === 409 && M2.S.wo[r1.data.mesWorkOrder].erpOrder === pro.id, `${pro.id} → ${r1.data.mesWorkOrder} (${r1.data.lots.length} lots)`);
    const w = M2.S.wo[r1.data.mesWorkOrder], stock0 = E2.free("LG-25-1000");
    for (const lid of w.lots) { const L = M2.S.lots[lid]; for (const op of L.ops) M2.route("POST", "/api/bsf/mes/confirmations", {}, { lot: lid, op: op.no, machine: op.m + "-01", good: L.qty, scrap: 0 }); }
    const sy = rt("POST", `/api/bsf/erp/productionorders/${pro.id}/sync`), se = rt("POST", `/api/bsf/erp/productionorders/${pro.id}/settle`);
    ok("MES → ERP: finished goods booked (GR), sync = done + backflush, settle → variances", E2.free("LG-25-1000") > stock0 && sy.status === 200 && sy.data.status === "done" && sy.data.backflush.length > 0 && se.status === 200, `GR +${g(E2.free("LG-25-1000") - stock0)}, good ${sy.data.good}, var ${se.data && se.data.totalVariance}`);
    ok("problem+json: unknown SO 404, bad product 400, GI too big 409", rt("GET", "/api/bsf/erp/salesorders/SO-99999").status === 404 && rt("POST", "/api/bsf/erp/salesorders", { product: "XX" }).status === 400 && rt("POST", "/api/bsf/erp/goodsmovements", { type: "GI", material: "LB-25-FL", qty: 99999 }).status === 409);
    // server (Python) = browser (JavaScript)
    await checkBackend();
    if (!be.reachable) log("ERP server not reachable – browser-only checks done");
    else {
      const ev = async (b2) => (await api("POST", "/api/bsf/erp/eval", b2, {}, 15000)).data;
      const pm = await ev({ kind: "mrp" }); ok("Python = JavaScript: MRP hand case", eqA(pm.B.prl, m.B.prl) && eqA(pm.B.poh, m.B.poh) && eqA(pm.A.prl, m.A.prl) && pm.C.exceptions[0].kind === m.C.exceptions[0].kind);
      let same = true, worst = 0;
      for (const p of ["FABS-3210-1000-C5", "FALG-25-1000", "BS-3210-1000-C5", "BN-3210-FL", "LG-25-1000", "LB-25-FL", "BS-2505-600-C7"]) { const x = await ev({ kind: "stdcost", code: p }), y = costRollup(p); worst = Math.max(worst, Math.abs(x.std - y.std)); same = same && Math.abs(x.std - y.std) < 1e-6 && Math.abs(x.variable - y.variable) < 1e-6; }
      ok("Python = JavaScript: standard cost of 7 products (incl. variant)", same, `max diff ${worst.toExponential(2)} €`);
      let mw = 0; const wcs = workcenters(); for (const t of ["BS-TGR", "HT-CAR", "LB-MC", "QC-LED", "AS-PCK"]) { const x = await ev({ kind: "mhr", type: t }); mw = Math.max(mw, Math.abs(x.rate - mhr(t).rate)); } ok("Python = JavaScript: machine hour rates (5 types, MTYPES parsed from item 2)", mw < 1e-9, `${wcs.length} work centres, max diff ${mw}`);
      const pl = await ev({ kind: "lot" }); ok("Python = JavaScript: lot sizing costs", ["L4L", "FOQ", "EOQ", "POQ"].every((r) => Math.abs(pl.rules[r].cost - lc.rules[r].cost) < 1e-6), ["L4L", "FOQ", "EOQ", "POQ"].map((r) => r + " " + f0(pl.rules[r].cost)).join(", "));
      const pf = await ev({ kind: "finance" }); ok("Python = JavaScript: P&L year + break-even", Math.abs(pf.pnl.year.ebit - fy.year.ebit) < 1e-3 && Math.abs(pf.breakeven.beDays - breakeven().beDays) < 1e-9, `EBIT ${eur(pf.pnl.year.ebit)}`);
      const pc2 = await ev({ kind: "config", config: { kind: "guide", size: 35, length: 1520, block: "NA", preload: "Z2", cls: "P", blocks: 3 } }), jc = configure({ kind: "guide", size: 35, length: 1520, block: "NA", preload: "Z2", cls: "P", blocks: 3 });
      ok("Python = JavaScript: configurator (guide size 35, 1 520 mm, 3 × NA Z2 P)", Math.abs(pc2.price - jc.price) < 1e-9 && pc2.code === jc.code && pc2.rules.length === jc.rules.length, `${f2(jc.price)} € ${jc.code}`);
      const pa = await ev({ kind: "atp", case: H.atp }); ok("Python = JavaScript: CTP hand case", pa.promiseDay === a.promiseDay && pa.need === a.need);
      // ERP → MES release round trip over HTTP
      const key = "t7-" + uuid(), s1 = await api("POST", "/api/bsf/erp/productionorders", { material: "BS-3210-1000-C5", qty: 20, dueDays: 6 }, { "Idempotency-Key": key });
      const rk = "r7-" + uuid(), s2 = await api("POST", `/api/bsf/erp/productionorders/${s1.data.id}/release`, {}, { "Idempotency-Key": rk }), s3 = await api("POST", `/api/bsf/erp/productionorders/${s1.data.id}/release`, {}, { "Idempotency-Key": rk }), s4 = await api("POST", `/api/bsf/erp/productionorders/${s1.data.id}/release`, {});
      ok("server: production order 201 → release 201 (MES work order) → replay 200 → 409 problem+json", s1.status === 201 && s2.status === 201 && s2.data.mesWorkOrder && s3.status === 200 && s3.data.replay && s4.status === 409 && /problem\+json/.test(s4.ct), `${s1.data.id} → ${s2.data.mesWorkOrder}`);
      const wo = await api("GET", `/api/bsf/mes/workorders/${s2.data.mesWorkOrder}`); ok("server: the MES has the work order with erpOrder = production order, released", wo.ok && wo.data.erpOrder === s1.data.id && ["released", "running"].includes(wo.data.status), `${wo.data.id} ${wo.data.status} ${wo.data.lots.length} lots`);
      const cb = { lot: wo.data.lots[0], op: "10", machine: "MS-SAW-01", good: 20, scrap: 0, setupMin: 10, runMin: 22 }; await api("POST", "/api/bsf/mes/confirmations", cb, { "Idempotency-Key": "c7-" + uuid() });
      const sy2 = await api("POST", `/api/bsf/erp/productionorders/${s1.data.id}/sync`, {}); ok("server: sync pulls the confirmation (actual minutes from the MES) + backflush of the bar", sy2.ok && sy2.data.ops.some((o) => o.op === "10" && o.actualFromMes) && sy2.data.backflush.length > 0, JSON.stringify(sy2.data.backflush).slice(0, 120));
      const c4 = await api("POST", "/api/bsf/erp/productionorders/PO-4711-T" + Date.now().toString(36).slice(-4) + "/release", { product: "LG", qty: 50 }, { "Idempotency-Key": "c4-" + uuid() });
      ok("server: item-4 compatible release {product: LG, qty: 50} → 201 mesWorkOrder + lots", c4.status === 201 && c4.data.mesWorkOrder && c4.data.lots.length > 0, c4.data.mesWorkOrder);
      const gm = await api("POST", "/api/bsf/erp/goodsmovements", { type: "GI", material: "LB-25-FL", qty: 99999, order: "WO-00002" }); ok("server: goods issue too big → 409 problem+json (item 4 example)", gm.status === 409 && /problem\+json/.test(gm.ct));
      const st1 = await api("GET", "/api/bsf/erp/stock?material=RAW-50CrMo4-D36"); ok("server: stock?material= (case-insensitive id)", st1.ok && st1.data.material === "RAW-50CRMO4-D36", `${st1.data.qty} m`);
      const v1 = await api("GET", "/api/bsf/v1/erp/health"); ok("server: /api/bsf/v1/erp/... alias + MES reachable", v1.ok && v1.data.mode === "server" && v1.data.mes === true);
      const ap = await api("GET", "/api/bsf/erp/api"); ok("server: route catalogue", ap.ok && ap.data.routes.length >= 55, `${ap.data.routes.length} routes`);
      const lgg = await api("GET", "/api/bsf/erp/log?since=0"); ok("server: message log has ERP → MES calls", lgg.ok && lgg.data.items.some((x) => x.dir === "ERP → MES" && x.path === "/api/bsf/mes/workorders"));
      const hl = await api("GET", "/api/bsf/erp/health"); ok("server: persistence file exists after the first POST", hl.data.persist && hl.data.persist.exists, hl.data.persist && hl.data.persist.path);
    }
  } catch (ex) { fail++; log("FAIL exception " + (ex && ex.stack || ex)); }
  const card = $("bfCard7"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : []; imgs.forEach((i) => { i.loading = "eager"; });
  host.querySelectorAll(".bf7-img").forEach((i) => { i.loading = "eager"; });
  setTimeout(() => {
    ok("card bfCard7", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
    chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, CARD7.drawings.length, 0);
    ok("page images loaded", [...host.querySelectorAll(".bf7-img")].every((i) => i.complete && i.naturalWidth > 0), `${host.querySelectorAll(".bf7-img").length} images`);
    ok("charts rendered (dashboard, lot sizing, waterfall, P&L)", host.querySelectorAll(".bf7-chart").length >= 7, `${host.querySelectorAll(".bf7-chart").length} charts`);
    ok("MRP table + sales list rendered", !!host.querySelector(".bf7-mrp") && $("bf7SoList").querySelectorAll("tr").length > 3);
    log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
    const d = $("bf7Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = outL.join("\n"); d.prepend(pre);
  }, 3000);
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "7") build(); });
if (window.bfCtl && window.bfCtl.current() === "7" && window.bfCtl.tabVisible()) build();
export { VERSION7 };
