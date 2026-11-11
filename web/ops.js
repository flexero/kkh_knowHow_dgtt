/* Operations pages: material handling panel (live tab), MES and ERP tabs.
   Uses helpers from app.js: $, esc, pct, post, toast, fmtTime, setChart, snap. */
"use strict";

const STATE_TXT = {
  IDLE: "idle", TO_PICKUP: "driving to pick-up", WAIT_CRANE: "waiting for crane", LOADING: "loading",
  TO_DROP: "driving to drop", UNLOADING: "unloading", TO_CHARGE: "going to charger", CHARGING: "charging", TO_PARK: "going to park",
};
const STATUS_CLS = {
  PLANNED: "s-idle", RELEASED: "s-info", IN_PROGRESS: "s-good", ON_HOLD: "s-warn", COMPLETED: "s-done", CLOSED: "s-done",
  OPEN: "s-info", PARTIAL: "s-warn", SHIPPED: "s-done", RECEIVED: "s-done", DONE: "s-done",
  OK: "s-good", LOW: "s-warn", SHORT: "s-bad", WIP: "s-good", "IN STOCK": "s-info", SCRAPPED: "s-bad",
};
const chipS = (s) => `<span class="st-chip ${STATUS_CLS[s] || "s-idle"}">${esc(String(s).replace("_", " ").toLowerCase())}</span>`;
const bar = (f, cls = "") => `<div class="hbar ${cls}"><i style="width:${Math.max(0, Math.min(1, f)) * 100}%"></i></div>`;
const num = (v, d = 0) => (v == null ? "–" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }));
function rel(t) {
  if (t == null || !snap) return "–";
  const h = (t - snap.sim_time) / 3600;
  if (Math.abs(h) < 0.05) return "now";
  return h > 0 ? `in ${h < 10 ? h.toFixed(1) : h.toFixed(0)} h` : `<span class="neg">${(-h < 10 ? (-h).toFixed(1) : (-h).toFixed(0))} h late</span>`;
}
function ago(t) {
  if (t == null || !snap) return "–";
  const h = (snap.sim_time - t) / 3600;
  return h < 0.02 ? "just now" : h < 1 ? `${Math.round(h * 60)} min ago` : `${h.toFixed(1)} h ago`;
}
let CUR = "USD";
function money(v) {
  if (v == null) return "–";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: CUR, maximumFractionDigits: 0 }).format(v); }
  catch (e) { return num(v) + " " + CUR; }
}
const kpiTiles = (tiles) => tiles.map(([l, v, n]) =>
  `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n || "&nbsp;"}</div></div>`).join("");
function table(id, head, rows, empty = "Nothing yet") {
  $(id).innerHTML = `<tr>${head.map((h) => `<th${h.startsWith("#") ? ' class="num"' : ""}>${h.replace(/^#/, "")}</th>`).join("")}</tr>` +
    (rows.length ? rows.join("") : `<tr><td colspan="${head.length}" class="muted">${empty}</td></tr>`);
}
async function act(url, body) {
  try { const j = await post(url, body); toast(j.message); refresh(); }
  catch (e) { toast("Error: " + e.message); }
}

/* ================================================== material handling */
window.renderMH = function (s) {
  const h = s.handling;
  const card = $("mhCard");
  if (!h || (!h.agvs.length && !h.asrs.length && !h.pools.length)) { card.hidden = true; return; }
  card.hidden = false;
  $("mhSub").textContent = h.agvs.length ? `${h.agvs.length} AGVs · fleet busy ${pct(h.fleet_util)}` : "";
  const agvs = h.agvs.map((a) => `
    <div class="mh-item">
      <div class="mh-top"><b>${a.id}</b><span class="agv-st ${a.state}">${STATE_TXT[a.state] || a.state}</span></div>
      <div class="mh-row"><span>Battery</span><b>${Math.round(a.battery)}%</b></div>${bar(a.battery / 100, a.battery < 25 ? "warnbar" : "goodbar")}
      <div class="mh-row"><span>Load</span><b>${a.load ? `${a.load.qty} × ${esc(a.load.part)}` : "empty"}</b></div>
      <div class="mh-task">${esc(a.task || "no task")}</div>
      <div class="mh-row muted"><span>busy ${pct(a.util)}</span><span>${a.km} km</span></div>
    </div>`).join("");
  const asrs = h.asrs.map((a) => `
    <div class="mh-item wide">
      <div class="mh-top"><b>${esc(a.name)}</b><span class="agv-st ${a.busy ? "LOADING" : "IDLE"}">${a.busy ? (a.kind === "retrieve" ? "crane retrieving" : "crane storing") : "crane idle"}</span></div>
      <div class="mh-row"><span>Slots used</span><b>${a.used} / ${a.slots}</b></div>${bar(a.used / a.slots)}
      <div class="mh-row"><span>Crane busy</span><b>${pct(a.util)}</b></div>${bar(a.util, a.util > 0.85 ? "warnbar" : "")}
      <div class="mh-row"><span>Jobs waiting</span><b>${a.queue}</b></div>
      <div class="mh-stock">${a.stock.map((st) => `<span>${esc(st.name)} <b>${st.count}</b></span>`).join("")}</div>
    </div>`).join("");
  const pools = h.pools.map((p) => `
    <div class="mh-item">
      <div class="mh-top"><b>${esc(p.name)}</b></div>
      <div class="mh-row"><span>In use</span><b>${p.in_use} / ${p.count}</b></div>${bar(p.in_use / p.count, p.free === 0 ? "warnbar" : "")}
      <div class="mh-row muted"><span>${p.free} free pallets</span></div>
    </div>`).join("");
  const loops = h.transports.length ? `
    <div class="mh-item wide">
      <div class="mh-top"><b>Transport loops (kanban)</b></div>
      ${h.transports.map((t) => `<div class="mh-row"><span>${esc(t.name)}</span><b>${t.trips} trips · ${t.moved} parts${t.open ? ` · ${t.open} active` : ""}</b></div>`).join("")}
    </div>` : "";
  $("mh").innerHTML = agvs + asrs + pools + loops;
};

/* =============================================================== MES */
let active = null;
let mesData = null, erpData = null;
window.onTabShown = (name) => { active = name; refresh(); };
setInterval(() => { if (active === "mes" || active === "erp" || active === "fms") refresh(); }, 2000);
setInterval(() => { if (active === "order") refresh(); }, 1000);
// on the Live tab the 3D view keeps showing the units of the followed order (blue tags)
setInterval(async () => {
  if (!(active === null || active === "live") || !view3d || !view3d.setTracked) return;
  try {
    // the order chosen in the Order-flow tab, else the newest open make-to-order order
    const r = await fetch("/api/order?so=" + encodeURIComponent(orderSel || ""));
    if (r.ok) {
      const d = await r.json();
      view3d.setTracked(d.so && (orderSel || d.so.mto) ? d.wos.map((w) => w.id) : []);
    }
  } catch (e) { /* server restarting */ }
}, 3000);
async function refresh() {
  try {
    if (active === "mes") { mesData = await (await fetch("/api/mes")).json(); renderMES(mesData); }
    if (active === "erp") { erpData = await (await fetch("/api/erp")).json(); renderERP(erpData); }
    if (active === "fms") renderFMS(await (await fetch("/api/fms")).json());
    if (active === "order") {
      const r = await fetch("/api/order?so=" + encodeURIComponent(orderSel || ""));
      if (r.status === 404) { orderSel = ""; return; }
      renderOrder(await r.json());
    }
  } catch (e) { /* server restarting */ }
}

function renderMES(d) {
  const q = d.quality, s = d.summary;
  $("mesKpis").innerHTML = kpiTiles([
    ["Open work orders", s.open_wos, `${s.to_start} units still to start`],
    ["Units in production", s.wip_units, "serial numbers on the shop floor"],
    ["First-pass yield", q.fpy == null ? "–" : pct(q.fpy, 1), `${q.passed} of ${q.tested} passed the air-flow test`],
    ["Process capability Cpk", q.cpk == null ? "–" : q.cpk.toFixed(2), q.cpk == null ? "needs 8 tests" : q.cpk >= 1.33 ? "capable (≥ 1.33)" : `<b class="neg">not capable (< 1.33)</b>`],
    ["Open maintenance orders", s.open_mwos, "see the maintenance list"],
  ]);
  table("woTable", ["Order", "Model", "#Qty", "#Started", "#Done", "#Scrap", "Progress", "Status", "Due", "Source", ""],
    d.work_orders.map((w) => `<tr>
      <td><b>${w.id}</b></td><td>${pchip(w.product)}</td><td class="num">${w.qty}</td><td class="num">${w.started}</td><td class="num">${w.done}</td>
      <td class="num">${w.scrap || ""}</td><td style="min-width:80px">${bar(w.done / w.qty, "goodbar")}</td>
      <td>${chipS(w.status)}</td><td>${["COMPLETED", "CLOSED"].includes(w.status) ? "" : rel(w.due)}</td><td class="muted">${esc(w.source)}</td>
      <td class="acts">${w.status === "PLANNED" || w.status === "ON_HOLD" ? `<button class="mini" data-wo="release" data-id="${w.id}">Release</button>` : ""}
        ${w.status === "RELEASED" || w.status === "IN_PROGRESS" ? `<button class="mini" data-wo="hold" data-id="${w.id}">Hold</button>` : ""}
        ${["PLANNED", "RELEASED", "IN_PROGRESS", "ON_HOLD"].includes(w.status) ? `<button class="mini ghost" data-wo="close" data-id="${w.id}">Close</button>` : ""}</td></tr>`),
    "No work orders. Create one, or turn on MRP in the ERP tab.");
  table("unitTable", ["Serial no.", "Model", "Order", "Status", "#FAD m³/h", "Finished", "Customer"],
    d.units.map((u) => `<tr><td><a href="#" data-sn="${u.sn}">${u.sn}</a></td><td>${pchip(u.product)}</td><td>${u.wo || "–"}</td><td>${chipS(u.status)}</td>
      <td class="num">${u.fad == null ? "–" : u.fad.toFixed(2)}</td><td>${ago(u.end)}</td><td>${esc(u.customer || "")}</td></tr>`),
    "No finished units yet");
  // SPC
  $("qSub").textContent = q.tested ? `${q.tested} tests` : "";
  if (q.points.length > 1) {
    const lines = [];
    if (q.ucl != null) lines.push({ v: +q.ucl.toFixed(2), label: "UCL", c: "--serious" }, { v: +q.lcl.toFixed(2), label: "LCL", c: "--serious" });
    if (q.lsl != null) lines.push({ v: +q.lsl.toFixed(2), label: "LSL (spec)", c: "--critical" });
    if (q.mean != null) lines.push({ v: +q.mean.toFixed(2), label: "mean", c: "--muted" });
    setChart("cSpc", q.points, { unit: q.unit || "m³/h", lines });
  }
  const spcCap = document.querySelector(".spc figcaption");
  if (spcCap) spcCap.textContent = q.unit === "%"
    ? "Measured FAD per unit in % of the model's nominal flow (100% = 10 / 20 / 30 m³/h), with control limits (UCL / LCL) and the spec limit (LSL = 97%)"
    : "Measured FAD per unit (m³/h) with control limits (UCL / LCL) and the spec limit (LSL)";
  const byP = (q.by_product || []).filter((p) => p.product).map((p) => `<div><span>${pchip(p.product, true)} FPY</span>
    <b>${p.fpy == null ? "–" : pct(p.fpy, 1)}</b></div><div><span>mean FAD (nominal ${p.spec})</span><b>${p.mean_fad == null ? "–" : p.mean_fad.toFixed(2)}</b></div>`).join("");
  $("qStats").innerHTML = (q.mean == null ? `<p class="hint">Waiting for at least 8 test results…</p>` : `
    <div><span>Mean</span><b>${q.mean.toFixed(2)}${q.unit === "%" ? " %" : ""}</b></div><div><span>σ (I-MR)</span><b>${q.sigma.toFixed(3)}</b></div>
    <div><span>Cpk</span><b>${q.cpk == null ? "–" : q.cpk.toFixed(2)}</b></div>
    <div><span>Out of control (last 50)</span><b>${q.out_of_control}</b></div>`) + byP + (q.mean == null ? "" : `
    <p class="hint">Cpk = (mean − LSL) ÷ 3σ. Below 1.33 the process makes too many rejects; raise the mean air flow
      (better valves, tighter piston rings) or reduce the variation.${q.unit === "%" ? " With three models the chart uses % of nominal flow, so all units fit on one chart." : ""}</p>`);
  table("ncrTable", ["NCR", "When", "Station", "Part", "Lot", "Reason"],
    q.ncr.map((n) => `<tr><td>${n.id}</td><td>${ago(n.t)}</td><td>${esc(nameOf(n.station))}</td><td>${esc(n.part)}</td>
      <td>${esc(n.lot || "–")}</td><td>${esc(n.reason)}</td></tr>`), "No scrap yet");
  table("mwoTable", ["Order", "Machine", "Type", "Task", "Status", "Created", ""],
    d.maintenance.map((w) => `<tr><td>${w.id}</td><td>${esc(w.name)}</td><td>${w.type.toLowerCase()}</td>
      <td class="wrap">${esc(w.text)}${w.downtime_min ? ` <span class="muted">(${w.downtime_min} min down)</span>` : ""}</td>
      <td>${chipS(w.status)}</td><td>${ago(w.created)}</td>
      <td class="acts">${w.status === "OPEN" ? `<button class="mini" data-mwo="mwo_start" data-id="${w.id}">Start</button>` : ""}
        ${w.status !== "DONE" && w.type !== "CORRECTIVE" ? `<button class="mini ghost" data-mwo="mwo_close" data-id="${w.id}">Close</button>` : ""}</td></tr>`),
    "No maintenance orders");
  table("relTable", ["Machine", "#Failures", "#MTBF actual", "#plan", "#MTTR actual", "#plan"],
    d.reliability.filter((r) => r.failures).map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.failures}</td>
      <td class="num">${num(r.mtbf_h, 1)} h</td><td class="num muted">${num(r.plan_mtbf_h, 0)} h</td>
      <td class="num">${num(r.mttr_min, 0)} min</td><td class="num muted">${num(r.plan_mttr_min, 0)} min</td></tr>`),
    "No breakdowns yet");
}

async function showUnit(sn, target = "unitView") {
  if (!sn) return;
  try {
    const r = await fetch("/api/mes/unit?sn=" + encodeURIComponent(sn));
    if (!r.ok) { $(target).innerHTML = `<p class="neg">Serial number ${esc(sn)} not found.</p>`; return; }
    const u = await r.json();
    const route = u.route.map(([st, a, b]) => `<li><b>${esc(nameOf(st))}</b> <span class="muted">${fmtTime(a).replace("T+ ", "")} → ${fmtTime(b).replace("T+ ", "")}</span></li>`).join("");
    const comps = u.components.map((c) => `<tr><td>${esc(c.part)}</td><td>${esc(c.id)}</td><td>${esc(c.lot || "–")}</td>
      <td class="muted">${c.route.map((x) => esc(x[0])).join(" → ") || (c.part === "crankcase" ? "carries the serial no." : "")}</td></tr>`).join("");
    $(target).hidden = false;
    $(target).innerHTML = `
      <div class="unit-head"><b>${esc(u.sn)}</b> ${chipS(u.status)} <span>${esc(u.where || "")}</span>
        ${target !== "unitView" ? `<button class="mini ghost" data-close="${target}" style="margin-left:auto">Close</button>` : ""}</div>
      <div class="unit-facts">${u.product ? `<span>Model <b>${pchip(u.product, true)}</b></span>` : ""}<span>Work order <b>${u.wo || "–"}</b></span><span>Air flow <b>${u.fad == null ? "not tested yet" : u.fad.toFixed(2) + " m³/h"}</b></span>
        ${u.customer ? `<span>Customer <b>${esc(u.customer)}</b> (${esc(u.so)})</span>` : ""}</div>
      <div class="unit-cols"><div><h3>Route</h3><ol class="route">${route || "<li class='muted'>not started</li>"}</ol></div>
      <div><h3>Components and lots</h3><table>${comps}</table></div></div>`;
  } catch (e) { toast("Error: " + e.message); }
}
document.addEventListener("click", (e) => {
  const c = e.target.closest("[data-close]");
  if (c) { $(c.dataset.close).hidden = true; return; }
  const a = e.target.closest("[data-sn]");
  if (a && a.closest("#tab-order")) { e.preventDefault(); showUnit(a.dataset.sn, "ofUnit"); return; }
  if (a) { e.preventDefault(); $("snForm").sn.value = a.dataset.sn; showUnit(a.dataset.sn); return; }
  const w = e.target.closest("[data-wo]");
  if (w) return act("/api/mes", { action: w.dataset.wo, id: w.dataset.id });
  const m = e.target.closest("[data-mwo]");
  if (m) return act("/api/mes", { action: m.dataset.mwo, id: m.dataset.id });
  const so = e.target.closest("[data-ship]");
  if (so) return act("/api/erp", { action: "ship", id: so.dataset.ship });
});
$("snForm").addEventListener("submit", (e) => { e.preventDefault(); showUnit(e.target.sn.value.trim()); });
$("woForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  act("/api/mes", { action: "create_wo", qty: +f.qty.value, due_h: +f.due_h.value, release: f.release.checked,
                    product: f.product.value || undefined });
});

/* =============================================================== ERP */
let skuFilled = false;
function renderERP(d) {
  if (!d.enabled) { $("erpKpis").innerHTML = `<p class="hint">ERP is not configured for this factory (add an "erp" section to the config).</p>`; return; }
  CUR = d.currency || "USD";
  const f = d.finance, c = d.cost;
  $("erpKpis").innerHTML = kpiTiles([
    ["Revenue", money(f.revenue), `${f.shipped_units} units shipped`],
    ["Gross profit", money(f.gross_profit), `standard margin ${pct(c.margin_pct, 0)}`],
    ["On-time delivery", f.otd == null ? "–" : pct(f.otd, 0), "orders shipped by the due date"],
    ["Order backlog", f.backlog_units, `${f.open_orders} orders · ${f.late_orders ? `<b class="neg">${f.late_orders} late</b>` : "0 late"}`],
    ["Inventory value", money(f.inventory_value), `incl. WIP ${money(f.wip_value)}`],
    ["Purchases", money(f.purchases), "goods received"],
  ]);
  document.querySelectorAll("[data-set]").forEach((el) => {
    if (document.activeElement === el) return;
    const v = d.settings[el.dataset.set];
    if (el.type === "checkbox") el.checked = !!v; else el.value = v;
  });
  const m = d.mrp[0];
  $("mrpView").innerHTML = m ? `
    <p class="hint" style="margin:6px 0">Last MRP run ${ago(m.t)} (${esc(m.why)}), one model after the other:
      <b>net = open demand + safety stock − free finished stock − open work orders</b>
      ${m.wo ? `→ new ${esc(m.wo)} (${m.wo_qty} units)` : "→ no new work order"}${m.pos.length ? `, purchase orders ${m.pos.join(", ")}` : ""}.</p>
    ${m.fg ? `<div class="table-wrap"><table><tr><th>Model</th><th class="num">Open demand</th><th class="num">+ Safety</th><th class="num">− Free stock</th>
      <th class="num">− Open WOs</th><th class="num">= Net</th><th>Action</th></tr>
      ${m.fg.map((r) => `<tr><td>${pchip(r.product, true)}</td><td class="num">${r.demand}</td><td class="num">${r.safety}</td><td class="num">${r.fg_free}</td>
        <td class="num">${r.wo_open}</td><td class="num ${r.net > 0 ? "neg" : ""}">${r.net}</td><td>${r.wo ? `new ${r.wo} (${r.wo_qty})` : "enough"}</td></tr>`).join("")}
    </table></div>` : ""}
    <div class="table-wrap"><table><tr><th>Item</th><th class="num">Requirement</th><th class="num">+ Safety</th><th class="num">− On hand</th>
      <th class="num">− On order</th><th class="num">= Net</th><th>Action</th></tr>
      ${m.lines.map((l) => `<tr><td>${esc(l.sku)}</td><td class="num">${l.gross}</td><td class="num">${l.safety}</td><td class="num">${l.on_hand}</td>
        <td class="num">${l.on_order}</td><td class="num ${l.net > 0 ? "neg" : ""}">${l.net}</td><td>${l.po ? "ordered " + l.po : "enough"}</td></tr>`).join("")}
    </table></div>` : "";
  table("soTable", ["Order", "Customer", "Model", "#Qty", "#Shipped", "Status", "Due", "#Value", ""],
    d.sales_orders.map((s) => `<tr><td><b>${s.id}</b></td><td>${esc(s.customer)}</td><td>${pchip(s.product)}</td><td class="num">${s.qty}</td>
      <td class="num">${s.shipped}${s.picking ? ` <span class="muted">+${s.picking}</span>` : ""}</td><td>${chipS(s.status)}</td>
      <td>${s.status === "SHIPPED" ? (s.on_time ? "on time" : '<span class="neg">late</span>') : rel(s.due)}</td>
      <td class="num">${money(s.value)}</td>
      <td class="acts">${["OPEN", "PARTIAL"].includes(s.status) && !d.settings.auto_ship ? `<button class="mini" data-ship="${s.id}">Ship</button>` : ""}</td></tr>`));
  table("invTable", ["Item", "Location", "#On hand", "#Put-away", "#On order", "#Safety", "#Covers", "#Value", "Status"],
    d.inventory.map((i) => `<tr><td>${i.product ? pdot(i.product) : ""}<b>${esc(i.sku)}</b><div class="muted small">${esc(i.name)}${i.fg ? " · finished product" : ""}</div></td><td>${esc(i.location)}</td>
      <td class="num">${i.on_hand}</td><td class="num">${i.putaway || ""}</td><td class="num">${i.on_order ?? ""}</td><td class="num">${i.safety}</td>
      <td class="num">${i.coverage_h == null ? "" : i.coverage_h.toFixed(0) + " h"}</td><td class="num">${money(i.value)}</td><td>${chipS(i.status)}</td></tr>`));
  if (!skuFilled) {
    $("poSku").innerHTML = d.items.map((i) => `<option value="${esc(i.sku)}">${esc(i.sku)} · ${esc(i.name)}</option>`).join("");
    skuFilled = true;
  }
  table("poTable", ["Order", "Item", "Supplier", "#Qty", "#Cost", "Status", "Arrival", "Lot"],
    d.purchase_orders.map((p) => `<tr><td><b>${p.id}</b> <span class="muted small">${esc(p.source)}</span></td><td>${esc(p.sku)}</td>
      <td>${esc(p.supplier)}</td><td class="num">${p.qty}</td><td class="num">${money(p.cost)}</td><td>${chipS(p.status)}</td>
      <td>${p.status === "OPEN" ? rel(p.due) : ago(p.received)}</td><td>${esc(p.lot || "")}</td></tr>`));
  const costs = d.costs && d.costs.length ? d.costs : [c];
  if (!costs.some((x) => x.product === costSel)) costSel = c.product;
  const cc = costs.find((x) => x.product === costSel) || c;
  renderCost(cc, costs);
}
let costSel = null;
function renderCost(c, costs) {
  $("costSub").textContent = `${c.sku} · price ${money(c.price)}`;
  const cmp = costs.length > 1 ? `<div class="table-wrap"><table><tr><th>Model</th><th class="num">Material</th><th class="num">Machine + labour</th>
      <th class="num">Standard cost</th><th class="num">Price</th><th class="num">Margin</th></tr>
      ${costs.map((x) => `<tr${x.product === c.product ? ' class="sel"' : ""}><td><a href="#" data-cost="${esc(x.product)}">${pchip(x.product, true)}</a></td>
        <td class="num">${money(x.material)}</td><td class="num">${money(x.conversion)}</td><td class="num"><b>${money(x.total)}</b></td>
        <td class="num">${money(x.price)}</td><td class="num">${pct(x.margin_pct, 1)}</td></tr>`).join("")}
    </table></div><h3>Bill of materials: ${esc(c.sku)} <span class="muted small">(click a model above)</span></h3>` : "";
  $("costView").innerHTML = cmp + `
    <div class="table-wrap"><table>
      <tr><th>Component</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Cost</th></tr>
      ${c.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${l.qty}</td><td class="num">${money(l.cost)}</td><td class="num">${money(l.ext)}</td></tr>`).join("")}
      <tr><td>Other purchased parts (valves, heads, belt, packing)</td><td></td><td></td><td class="num">${money(c.other_parts)}</td></tr>
    </table></div>
    <div class="cost-break">
      <div><span>Material</span><b>${money(c.material)}</b></div>
      <div><span>Machine + labour</span><b>${money(c.conversion)}</b></div>
      <div><span>Energy</span><b>${money(c.energy)}</b></div>
      <div class="tot"><span>Standard cost</span><b>${money(c.total)}</b></div>
      <div><span>Margin at ${money(c.price)}</span><b>${pct(c.margin_pct, 1)}</b></div>
    </div>
    <details><summary>Machine and labour cost per station</summary><div class="table-wrap"><table>
      <tr><th>Station</th><th class="num">min / unit</th><th class="num">rate / h</th><th class="num">cost</th></tr>
      ${c.conv_lines.map((l) => `<tr><td>${esc(l.station)}</td><td class="num">${l.min_per_unit}</td><td class="num">${money(l.rate_h)}</td><td class="num">${money(l.cost)}</td></tr>`).join("")}
    </table></div></details>`;
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-cost]");
  if (!a) return;
  e.preventDefault();
  costSel = a.dataset.cost;
  if (erpData) renderERP(erpData);
});
document.querySelectorAll("[data-set]").forEach((el) => el.addEventListener("change", () =>
  act("/api/erp", { action: "settings", settings: { [el.dataset.set]: el.type === "checkbox" ? el.checked : +el.value } })));
$("mrpBtn").addEventListener("click", () => act("/api/erp", { action: "run_mrp" }));
$("soForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  act("/api/erp", { action: "create_so", customer: f.customer.value.trim(), qty: +f.qty.value, due_h: +f.due_h.value,
                    product: f.product.value || undefined });
});
$("poForm").addEventListener("submit", (e) => {
  e.preventDefault();
  act("/api/erp", { action: "create_po", sku: e.target.sku.value, qty: +e.target.qty.value });
});

/* ======================================================== ORDER FLOW */
let orderSel = "";
let lastOrder = null;
const KIND_TXT = { machine: "in machine", queue: "waiting", agv: "on AGV", io: "AS/RS entrance", fg: "in stock",
                   picking: "crane picking", shipped: "shipped", scrapped: "scrapped" };
const KIND_CLS = { machine: "s-good", queue: "s-warn", agv: "s-info", io: "s-info", fg: "s-info", picking: "s-info", shipped: "s-done", scrapped: "s-bad" };
const shortSn = (sn) => "#" + String(sn).split("-").pop().replace(/^0+(?=\d)/, "");
const unitChip = (sn, mine, extra = "") => `<a href="#" class="of-chip ${mine ? "mine" : "other"}" data-sn="${esc(sn)}" title="${esc(sn)}">${shortSn(sn)}${extra}</a>`;

function renderOrder(d) {
  lastOrder = d;
  // header controls
  document.querySelectorAll("[data-mode]").forEach((b) => b.classList.toggle("active", b.dataset.mode === d.mode));
  $("ofPause").textContent = d.paused ? "Run" : "Pause";
  $("ofClock").textContent = `${fmtTime(d.sim_time)} · ${d.paused ? "paused" : d.time_scale + "x"}${d.mode === "mixed" ? " · mode: mixed (see ERP tab)" : ""}`;
  const sel = $("ofSel");
  if (document.activeElement !== sel) {
    sel.innerHTML = (d.orders || []).map((o) => `<option value="${o.id}"${d.so && o.id === d.so.id ? " selected" : ""}>${o.id} · ${esc(o.customer)} · ${o.qty} × ${esc(o.sku || "")} · ${o.status.toLowerCase()}${o.mto ? "" : " (MRP)"}</option>`).join("");
  }
  const has = !!d.so;
  $("ofEmptyMsg").hidden = has;
  ["ofMain", "ofMapCard", "ofLower"].forEach((id) => ($(id).hidden = !has));
  if (view3d && view3d.setTracked) view3d.setTracked(has ? d.wos.map((w) => w.id) : []);
  if (!has) return;
  const so = d.so, c = d.counts;
  if (!orderSel) orderSel = so.id;
  $("ofTitle").innerHTML = `${so.id} · ${esc(so.customer)} · ${so.qty} × ${so.product ? pchip(so.product, true) : esc((d.product && d.product.sku) || "")} compressor · due ${so.status === "SHIPPED" ? (so.on_time ? "– shipped on time" : "– shipped late") : rel(so.due)}`;
  if (document.activeElement !== $("ofAuto")) $("ofAuto").checked = !!so.auto;

  // stages (wizard)
  $("ofStages").innerHTML = d.stages.map((s) => `<li class="${s.done ? "done" : s.active ? "active" : ""}">
      <div class="of-st-l">${s.done ? "✓ " : ""}${esc(s.label)}</div><div class="of-st-d">${esc(s.detail)}</div></li>`).join("");
  $("ofAction").innerHTML = orderAction(d);

  // route map
  const steps = d.steps;
  const notStarted = `<div class="of-col edge"><div class="of-h">Not started</div><div class="of-big">${c.to_start}</div>
      <div class="muted small">units still to start${c.planned < so.qty ? `<br>${so.qty - c.planned} not planned yet` : ""}</div></div>`;
  const cols = steps.map((s) => {
    const waitLbl = s.kind === "fg" ? "in stock" : s.kind === "agv" ? "waiting / on AGV" : "waiting";
    const chips = s.waiting.map((w) => unitChip(w.sn, true, w.kind === "agv" ? " 🚚" : w.kind === "picking" ? " ↑" : "")).join("");
    let body = "";
    if (s.kind === "station") {
      body = s.machines.map((m) => `
        <div class="of-m">
          <div class="of-mh"><i class="of-led" style="background:var(${STATE_VAR[m.state] || "--idle"})"></i><span title="${esc(m.name)}">${esc(m.id)}</span>
            <span class="muted small">${esc((STATES[m.state] && (STATES[m.state].short || STATES[m.state].label)) || m.state)}</span></div>
          ${m.sn ? `<div class="of-work">${unitChip(m.sn, m.mine)}${bar(m.progress, m.mine ? "goodbar" : "")}</div>` :
            `<div class="muted small">${m.reason ? esc(m.reason) : "empty"}</div>`}
        </div>`).join("");
      if (s.feeds.length) body += `<div class="of-feeds">${s.feeds.map((f) => `<div><span>+ ${esc(f.part)} ×${f.per_unit}</span><b>${f.count}</b></div>`).join("")}</div>`;
    } else if (s.kind === "agv") {
      body = `<div class="muted small">${s.agvs && s.agvs.length ? s.agvs.join(", ") + " on this route" : "no AGV on this route now"}</div>`;
    } else if (s.kind === "fg") {
      body = `<div class="muted small">crane ${esc(s.crane || "–")}</div>`;
    }
    return `<div class="of-col ${s.kind}">
      <div class="of-h"><span class="of-n">${s.i + 1}</span>${esc(s.name)}</div>
      ${body}
      ${chips || s.others ? `<div class="of-wait"><div class="muted small">${waitLbl}</div>${chips}${s.others ? `<span class="muted small"> +${s.others} other</span>` : ""}</div>` : ""}
    </div>`;
  }).join(`<div class="of-arrow" aria-hidden="true">→</div>`);
  const shipped = `<div class="of-col edge"><div class="of-h">Shipped</div><div class="of-big">${c.shipped}</div>
      <div class="muted small">of ${so.qty}${c.picking ? ` · ${c.picking} being picked` : ""}</div>
      ${c.scrapped ? `<div class="of-h" style="margin-top:10px">Scrapped</div><div class="of-big neg">${c.scrapped}</div><div class="muted small">replaced automatically</div>` : ""}</div>`;
  $("ofMap").innerHTML = notStarted + `<div class="of-arrow">→</div>` + cols + `<div class="of-arrow">→</div>` + shipped;
  $("ofMapSub").textContent = `${c.in_production} in production · ${c.in_stock} in stock · ${c.shipped} shipped`;

  // material + purchase orders
  table("ofMat", ["Item", "#Per unit", "#Still needed", "#In store", "#At line", "#− Other orders", "#On order", "Arrives", "Status"],
    d.materials.map((m) => `<tr><td><b>${esc(m.sku)}</b><div class="muted small">${esc(m.name)}</div></td><td class="num">${m.per_unit}</td>
      <td class="num">${m.need}</td><td class="num">${m.store}${m.putaway ? ` <span class="muted">+${m.putaway}</span>` : ""}</td><td class="num">${m.line}</td>
      <td class="num">${m.other || ""}</td>
      <td class="num">${m.on_order || ""}</td><td>${m.arrives == null ? "" : rel(m.arrives)}</td>
      <td>${chipS(m.status === "ON ORDER" ? "PARTIAL" : m.status).replace("partial", "on order")}</td></tr>`));
  table("ofPo", ["Order", "Item", "#Qty", "For", "Arrives", "Status", ""],
    d.pos.map((p) => `<tr><td>${p.id}</td><td>${esc(p.sku)}</td><td class="num">${p.qty}</td><td class="muted">${esc(p.source)}</td>
      <td>${p.status === "OPEN" ? rel(p.due) : ago(p.received)}</td><td>${chipS(p.status)}</td>
      <td class="acts">${p.status === "OPEN" ? `<button class="mini" data-of="receive_now" data-id="${p.id}" title="Training shortcut: the supplier delivers now">Deliver now</button>` : ""}</td></tr>`),
    "No open purchase orders");

  // units + log
  $("ofUnitsSub").textContent = `${d.units.length} serial numbers`;
  table("ofUnits", ["Serial no.", "Where", "Progress", "#FAD m³/h", "Status"],
    d.units.map((u) => `<tr><td>${unitChip(u.sn, true)} <span class="muted small">${esc(u.sn)}</span></td><td class="wrap">${esc(u.where)}</td>
      <td style="min-width:70px">${u.kind === "machine" ? bar(u.progress, "goodbar") : ""}</td>
      <td class="num">${u.fad == null ? "–" : u.fad.toFixed(2)}</td><td><span class="st-chip ${KIND_CLS[u.kind] || ""}">${KIND_TXT[u.kind] || u.kind}</span></td></tr>`),
    "No units yet: plan and release the order first");
  $("ofLog").innerHTML = d.log.map((e) => `<li><span class="muted">${fmtTime(e.t)}</span> ${esc(e.text)}</li>`).join("") || `<li class="muted">nothing yet</li>`;
}

function orderAction(d) {
  const so = d.so, c = d.counts;
  const st = d.stages.find((s) => s.active);
  if (!st) return `<p class="of-done">✓ Order complete: ${so.qty} units shipped to ${esc(so.customer)} ${so.on_time ? "on time" : '<span class="neg">late</span>'}.
    Click any serial number below to see its full history.</p>`;
  if (so.auto) return `<p class="hint">Automatic: the ERP and MES do every step of this order by themselves (plan, buy, release, ship).
    Untick <b>automatic steps for this order</b> to do the steps yourself.</p>`;
  const btn = (label, a, extra = "", cls = "primary") => `<button class="btn ${cls}" data-of="${a}" data-id="${so.id}" ${extra}>${label}</button>`;
  const wosToRelease = d.wos.filter((w) => w.status === "PLANNED" || w.status === "ON_HOLD");
  const release = wosToRelease.map((w) => `<button class="btn primary" data-of="release" data-id="${w.id}">Release ${w.id} to the shop floor</button>`).join(" ");
  switch (st.key) {
    case "plan":
      return `<p><b>Next step: plan.</b> The ERP turns the customer order into a <b>work order</b> for the MES.
        The work order is linked to this customer ("pegging"), so its units are kept for ${esc(so.customer)}.</p>
        ${btn(`Create work order for ${so.qty - c.planned} units`, "plan_so")}`;
    case "material": {
      const short = d.materials.filter((m) => m.status === "SHORT");
      if (short.length) return `<p><b>Next step: material.</b> Not enough ${short.map((m) => esc(m.name)).join(", ")} for this order.
        The ERP will send purchase orders to the suppliers (lead time ${short.map((m) => m.lead_h + " h").join(" / ")}).</p>
        ${btn("Buy missing material", "buy_so")} ${release ? `<span class="muted small">or start now with what is in stock:</span> ${release.replace(/btn primary/g, "btn")}` : ""}`;
      return `<p><b>Waiting for suppliers.</b> The purchase orders are open (see the table below). In real life you wait;
        here you can press <b>Deliver now</b> (training shortcut) or step the time forward. You can also release now and start with the stock you have.</p>
        ${release.replace(/btn primary/g, "btn")}`;
    }
    case "release":
      return `<p><b>Next step: release.</b> The material is there. Releasing tells the MES that the shop floor may start.
        The AGV brings ${esc(so.product || "")} castings, and the <b>Fixture Load Station</b> clamps one crankcase after the other on a pallet
        and marks its serial number. If other released orders wait, the <b>dispatching rule</b> (FMS tab) decides which goes first.</p>${release}`;
    case "produce":
      return `<p><b>Production is running.</b> Watch the units move from machine to machine in the route below.
        Use <b>+10 min</b> or a higher speed to go faster. Scrapped units are replaced automatically.</p>
        ${d.wos.filter((w) => ["RELEASED", "IN_PROGRESS"].includes(w.status)).map((w) => `<button class="btn ghost" data-of="hold" data-id="${w.id}">Hold ${w.id}</button>`).join(" ")}
        ${release}`;
    case "stock":
      return `<p>The last units are on the way to the finished-goods AS/RS.</p>`;
    case "ship":
      if (so.picking && !d.can_ship) return `<p>The crane is taking the units out of the AS/RS for shipping…</p>`;
      if (d.complete_in_stock) return `<p><b>Next step: ship.</b> All ${so.qty} units are in the finished-goods store. The crane takes them out and the order is shipped.</p>
        ${btn("Ship order", "ship")}`;
      return `<p>Not all units are finished yet.</p>${d.can_ship ? btn("Ship what is ready now (partial delivery)", "ship", "", "") : ""}`;
  }
  return "";
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-of]");
  if (!b) return;
  const a = b.dataset.of, id = b.dataset.id;
  if (a === "release" || a === "hold") return act("/api/mes", { action: a, id });
  act("/api/erp", { action: a === "plan_so" ? "plan_so" : a === "buy_so" ? "buy_so" : a, id });
});
document.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () =>
  act("/api/erp", { action: "mode", mode: b.dataset.mode })));
document.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", async () => {
  b.disabled = true;
  try { const j = await post("/api/command", { action: "step", value: +b.dataset.step }); toast(j.message); refresh(); }
  catch (err) { toast("Error: " + err.message); }
  b.disabled = false;
}));
$("ofPause").addEventListener("click", () =>
  post("/api/command", { action: lastOrder && lastOrder.paused ? "resume" : "pause" }).then((j) => { toast(j.message); refresh(); }));
$("ofEmpty").addEventListener("click", () => {
  if (!confirm("Restart the simulation with an empty order book in MANUAL mode? All current data is cleared.")) return;
  orderSel = "";
  post("/api/command", { action: "reset", mode: "manual" }).then((j) => { toast(j.message); refresh(); });
});
$("ofSel").addEventListener("change", (e) => { orderSel = e.target.value; $("ofUnit").hidden = true; refresh(); });
$("ofAuto").addEventListener("change", (e) => act("/api/erp", { action: "so_auto", id: orderSel, auto: e.target.checked }));
$("ofForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    await post("/api/erp", { action: "create_so", customer: f.customer.value.trim(), qty: +f.qty.value,
                             due_h: +f.due_h.value, mto: true, auto: f.auto.checked, product: f.product.value || undefined });
    orderSel = "";            // follow the new order
    toast("Order created - now follow the steps");
    refresh();
  } catch (err) { toast("Error: " + err.message); }
});

/* ================================================================ FMS */
const pname = (v) => (PRODUCTS[v] && PRODUCTS[v].sku) || v || "–";
function renderFMS(d) {
  const total = d.products.reduce((a, p) => a + p.finished, 0);
  $("fmsKpis").innerHTML = kpiTiles([
    ["Dispatching rule", d.rule, { FIFO: "first in, first out", EDD: "earliest due date", SPT: "shortest time first", SETUP: "least changeover" }[d.rule]],
    ["Changeovers", d.setups_total, `${num(d.setup_h_total, 1)} h machine time lost`],
    ["Finished units", total, d.products.map((p) => `${pdot(p.id)}${p.finished}`).join(" ")],
    ["Running now", d.last_v ? pchip(d.last_v) : "–", d.last_v ? `${d.run_len} unit(s) in a row at the load station` : "no unit started yet"],
    ["Open work orders", d.open_wos, `${d.queue.length} released and waiting to start`],
  ]);
  table("fmsProducts", ["Model", "#Mix", "#Nominal flow", "#Price", "#Work content", "#Order backlog", "#To start", "#In production", "#In stock", "#Finished"],
    d.products.map((p) => `<tr><td>${pchip(p.id, true)}<div class="muted small">${esc(p.name)}</div></td>
      <td class="num">${pct(p.mix, 0)}</td><td class="num">${p.spec_flow_m3_h ?? "–"} m³/h</td><td class="num">${money(p.price)}</td>
      <td class="num">${p.work_min} min</td><td class="num">${p.backlog}${p.open_orders ? ` <span class="muted small">(${p.open_orders})</span>` : ""}</td>
      <td class="num">${p.to_start}</td><td class="num">${p.wip}</td><td class="num">${p.in_stock}</td><td class="num">${p.finished}</td></tr>`));
  // rule
  document.querySelectorAll("[data-rule]").forEach((b) => b.classList.toggle("active", b.dataset.rule === d.rule));
  const w = $("fmsWindow");
  if (document.activeElement !== w) w.value = d.window_h;
  w.disabled = d.rule !== "SETUP";
  $("fmsRuleText").innerHTML = `<b>${d.rule}:</b> ${esc(d.rule_text[d.rule] || "")}<br><span class="small">Work-order priority always comes first
    (customer orders from the Order-flow tab have priority 3, MRP orders 5).</span>`;
  $("fmsRun").textContent = d.last_v ? `last started: ${pname(d.last_v)} (${d.run_len} in a row)` : "";
  table("fmsQueue", ["#Next", "Work order", "Model", "#Left / qty", "Due", "#Priority", "For"],
    d.queue.map((q, i) => `<tr><td class="num">${i + 1}</td><td><b>${q.id}</b></td><td>${pchip(q.product, true)}</td>
      <td class="num">${q.left} / ${q.qty}</td><td>${rel(q.due)}</td><td class="num">${q.priority}</td><td class="muted">${esc(q.so || "stock (MRP)")}</td></tr>`),
    d.planned.length ? `No released work order. ${d.planned.length} planned / on hold - release them in the MES tab.` : "No released work order");

  // FMS cell
  const st = (m) => `<span class="badge st-${m.state}">${esc((STATES[m.state] && (STATES[m.state].short || STATES[m.state].label)) || m.state)}</span>`;
  const partsV = (pv) => Object.entries(pv || {}).map(([v, n]) => `${pdot(v)}${n}`).join(" ") || "–";
  const P = d.pallets;
  let cards = "";
  if (P) {
    const L = P.load_station;
    cards += `<div class="fms-m st-${L.state}">
      <div class="top"><b>${esc(L.name)}</b>${st(L)}</div>
      <div class="muted small">${L.sn ? `clamping ${esc(L.sn)}` : esc(L.reason || "waiting")}</div>
      <div class="fms-row"><span>Castings at the station (places)</span></div>
      ${P.castings.map((c) => `<div class="fms-row"><span>${pchip(c.v, true)}</span><b>${c.count}${c.places ? ` / ${c.places}` : ""}${c.incoming ? ` <span class="muted">+${c.incoming} on AGV</span>` : ""}</b></div>`).join("")}
      <div class="muted small">AGVs bring castings only for models that released work orders still need.</div>
    </div>`;
    if (P.pool) cards += `<div class="fms-m">
      <div class="top"><b>Pallet pool</b><span class="muted small">${P.pool.count} fixture pallets</span></div>
      <div class="fms-row"><span>In use</span><b>${P.pool.in_use} / ${P.pool.count}</b></div>${bar(P.pool.in_use / P.pool.count, P.pool.free === 0 ? "warnbar" : "")}
      <div class="fms-row"><span>Loaded, waiting for a machine</span><b>${P.loaded_total} / ${P.queue_cap}</b></div>
      ${P.loaded.map((x) => `<div class="fms-row"><span>${pchip(x.v, true)}</span><b>${x.count}</b></div>`).join("")}
      <div class="muted small">No free pallet = the load station must wait (pallets limit the WIP of the cell).</div>
    </div>`;
  }
  cards += d.cell.map((m) => `<div class="fms-m st-${m.state}">
      <div class="top"><b>${esc(m.name.replace("Crankcase ", ""))}</b>${st(m)}</div>
      ${m.sn ? `<div class="fms-row"><span>${pchip(m.model, true)} <span class="muted">${esc(m.sn)}</span></span><b>${m.state === "SETUP" ? `${m.setup_left_s} s` : pct(m.progress)}</b></div>
        ${bar(m.state === "SETUP" ? 0 : m.progress, "goodbar")}` : `<div class="muted small">${esc(m.reason || "waiting for a pallet")}</div>`}
      <div class="fms-row"><span>Tool magazine</span><span class="tools">${m.tools ? [...Array(m.mag_sets).keys()].map((i) =>
        m.tools[i] ? `<span class="tool">${pdot(m.tools[i])}${esc(m.tools[i])}</span>` : `<span class="tool empty">empty</span>`).join("") : "–"}</span></div>
      <div class="fms-row"><span>Tool exchanges</span><b>${m.setups} · ${num(m.setup_h, 1)} h</b></div>
      <div class="fms-row"><span>Busy (last hour) · OEE</span><b>${pct(m.busy)} · ${pct(m.oee)}</b></div>
      <div class="fms-row"><span>Parts made</span><b>${partsV(m.parts_v)}</b></div>
      <div class="fms-row muted small"><span>Cycle</span><span>${Object.entries(m.cycle_v).map(([v, s]) => `${pdot(v)}${s} s`).join(" ")}</span></div>
    </div>`).join("");
  $("fmsCell").innerHTML = cards;
  $("fmsCellSub").textContent = `${d.cell.length} machining centers · flexible routing`;

  // kanban
  $("fmsKanban").innerHTML = d.kanbans.map((k) => {
    const m = k.machine;
    const max = Math.max(k.target, ...k.levels.map((l) => l.level));
    return `<h3 style="margin-top:6px">${esc(k.name)} <span class="muted small">(${esc(k.part)}s, target ${k.target}, trigger ${k.trigger} per model)</span></h3>
      <div class="muted small" style="margin-bottom:6px">${esc(m.name)}: ${st(m)} ${m.set_up_for ? `set up for ${pchip(m.set_up_for)}` : ""}
        ${m.state === "RUNNING" || m.state === "SETUP" ? `· making ${pchip(m.model)}` : m.reason ? "· " + esc(m.reason) : ""}</div>
      <div class="kb">${k.levels.map((l) => `<div class="kb-row"><span>${pchip(l.v, true)}</span>
        <div class="kb-bar" title="${l.stock} in the supermarket, ${l.level - l.stock} in the line, target ${k.target}">
          <s style="width:${(l.level / max) * 100}%"></s><i style="width:${(l.stock / max) * 100}%"></i><u style="left:${(k.trigger / max) * 100}%"></u></div>
        <span class="num small">${l.stock} <span class="muted">+${l.level - l.stock}</span> / ${k.target}</span></div>`).join("")}</div>`;
  }).join("") || `<p class="hint">No kanban loops in this configuration.</p>`;

  // changeovers
  const T = d.sim_time || 1;
  $("fmsSetupSub").textContent = `${d.setups_total} changeovers · ${num(d.setup_h_total, 1)} h`;
  table("fmsSetups", ["Station", "#Time per change", "Set up for", "#Changes", "#Hours", "Share of time"],
    d.changeovers.map((m) => `<tr><td title="${esc(m.state)}"><i class="of-led" style="display:inline-block;margin-right:6px;background:var(${STATE_VAR[m.state] || "--idle"})"></i>${esc(m.name)}</td>
      <td class="num">${m.mag_sets ? `${Math.round(m.tool_load_s / 60)} min tools` : `${Math.round(m.setup_s)} s`}</td>
      <td>${m.mag_sets ? (m.tools || []).map((v) => pchip(v)).join(" ") : pchip(m.set_up_for)}</td>
      <td class="num">${m.setups}</td><td class="num">${num(m.setup_h, 1)}</td>
      <td><span class="setup-share"><i style="width:${Math.min(100, m.setup_share * 100 * 5)}%"></i></span>${pct(m.setup_share, 1)}</td></tr>`));
}
document.querySelectorAll("[data-rule]").forEach((b) => b.addEventListener("click", () =>
  post("/api/command", { action: "rule", value: b.dataset.rule }).then((j) => { toast(j.message); refresh(); }).catch((e) => toast("Error: " + e.message))));
$("fmsWindow").addEventListener("change", (e) =>
  post("/api/command", { action: "rule", value: "SETUP", window_h: +e.target.value }).then((j) => { toast(j.message); refresh(); }).catch((err) => toast("Error: " + err.message)));
