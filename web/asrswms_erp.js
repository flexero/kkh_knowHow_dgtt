/* AS/RS item 4 – ERP + MES part: material master, stock valuation, MRP record + purchase orders (posting an inbound
 * delivery creates store jobs in the shared sim), MES line call-off / kanban, material availability check + order release,
 * traceability (genealogy from the sim's lots), KPIs, and the ERP / MES message payload examples. Guide 34.
 * ALL VALUES ARE EXAMPLES – the ERP / MES suppliers decide.
 */
import { SKU, SKUS } from "./asrscore.js";
import { PLAN, MAT, LINES } from "./asrswms_data.js";
import { sim, W, P, locOf, realLot, crateOf, ssccOf, heatOf, batchOf, poOf, isoT, clock, dur, money, n0, n1, pad,
  stockTable, mrpStatus, mrpRecord, createPO, receivePO, onOrder, availability, releaseWO, callOff, kpis, woOf, retrRate, ABC_VALUE, ABC_MOVES } from "./asrswms_core.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const dot = (k) => `<i class="s4-dot" style="background:${SKU[k].color}"></i>`;
let selK = "RAW_CC", selTrace = 0, built = false;

export function buildErp(el) {
  el.innerHTML = `
  <div class="card" id="s4c-mat">
    <div class="card-head"><h2>ERP – material master of the 5 raw materials and stock valuation</h2>
      <span class="sub">config erp.items + part numbers of guide 15 · price = standard price (moving average in a real ERP) · example values</span></div>
    <div class="table-wrap"><table class="s4-t" id="s4Mat"></table></div>
    <p class="s4-f">The ERP owns the material master (number, description, price, supplier, lead time, lot size). The WMS copies it and adds storage data (unit load, crate, weight class).
      Rule of guide 15: purchased product parts keep the config number (<code>CC20-CAST</code>); the machined part made from it has its own number (<code>VC-PRD-CC-0020</code>) – never read "20" as "VC20" in software.</p>
    <h3>Stock valuation (live)</h3><div class="table-wrap"><table class="s4-t" id="s4Val"></table></div>
  </div>

  <div class="card" id="s4c-mrp">
    <div class="card-head"><h2>ERP – MRP, reorder point and purchase orders for one material</h2>
      <span class="sub">gross requirement from the production plan (17.2 units/h × mix × BOM ÷ yield) · on hand from the sim · open orders · planned orders · SS / ROP / EOQ with live numbers</span></div>
    <div class="s4-bar"><b>Material</b> ${SKUS.map((k) => `<button class="chip${k === selK ? " on" : ""}" data-s4k="${k}">${dot(k)}${MAT[k].item}</button>`).join("")}</div>
    <div class="s4-grid2">
      <div><pre class="s4-pre s4-form" id="s4Form"></pre></div>
      <div><div class="s4-kpis" id="s4MrpK"></div>
        <div class="s4-bar"><label>PO qty <input type="number" id="s4PoQty" min="1" step="1" style="width:90px"></label>
          <button class="btn" id="s4PoBtn">Create purchase order</button><button class="btn primary" id="s4GrBtn">Post inbound delivery (ASN) → store jobs</button></div>
        <div class="s4-bar"><label><input type="checkbox" id="s4AutoPO"> auto-create a PO when the stock position falls below the ROP</label>
          <label><input type="checkbox" id="s4AutoGR" checked> auto-receive when the lead time is reached</label></div>
        <p class="s4-f" id="s4PoMsg"></p></div>
    </div>
    <h3>Time-phased MRP record – 6 shifts of 8 h (guide 04 §20.3)</h3><div class="table-wrap"><table class="s4-t" id="s4Mrp"></table></div>
    <h3>Stock of the selected material – actual (solid, from the sim, 1 point / min) and MRP projection (dashed)</h3><div class="s4-svgwrap" id="s4Saw"></div>
    <h3>Purchase orders</h3><div class="table-wrap scroll"><table class="s4-t" id="s4Pos"></table></div>
  </div>

  <div class="card" id="s4c-mes">
    <div class="card-head"><h2>MES – line call-off / kanban and material availability check before order release</h2>
      <span class="sub">retrieval jobs from the crankcase, cylinder and crankshaft lines · BOM explosion with planned scrap (guide 04 §19.3) · release creates retrieval jobs in the sim</span></div>
    <div class="table-wrap"><table class="s4-t" id="s4Lines"></table></div>
    <p class="s4-f">number of kanban crates N = D × RLT × (1 + α) ÷ C – D = demand pcs/h, RLT = replenishment lead time (call-off → part at the line), α = safety factor (0.2), C = pieces per crate.
      RLT here = queue wait + crane cycle + outfeed 30 s + AGV trip ≈ 10 min (example) → see the live column.</p>
    <div class="s4-grid2">
      <div><h3>Availability check for a new work order</h3>
        <div class="s4-bar"><label>Model <select id="s4WoM"><option>VC10</option><option selected>VC20</option><option>VC30</option></select></label>
          <label>Qty <input type="number" id="s4WoQ" value="20" min="1" max="200" style="width:80px"></label>
          <button class="btn" id="s4WoChk">Check</button><button class="btn primary" id="s4WoRel">Release + call off first crates</button></div>
        <div class="table-wrap"><table class="s4-t" id="s4Av"></table></div>
        <p class="s4-f">available = unrestricted stock (not reserved, not in inspection, not blocked) − quantities already reserved for released work orders. Needed = qty × BOM ÷ yield, rounded up.</p></div>
      <div><h3>Work orders released here</h3><div class="table-wrap scroll"><table class="s4-t" id="s4Wos"></table></div></div>
    </div>
  </div>

  <div class="card" id="s4c-trace">
    <div class="card-head"><h2>MES – traceability: casting lot → crate SSCC → slot → retrieval → machining order → compressor serial</h2>
      <span class="sub">genealogy built live from the lots of the last retrieved crates · heat, supplier batch and serials = example numbering per guide 15</span></div>
    <div class="s4-bar" id="s4TrSel"></div>
    <div class="s4-grid2"><div class="s4-tree" id="s4Tree"></div><div><h3>Backward and forward trace</h3><div id="s4TrQ"></div></div></div>
  </div>

  <div class="card" id="s4c-kpi">
    <div class="card-head"><h2>KPIs of the store and its software layer (live)</h2>
      <span class="sub">from sim.kpi() and the job lists · targets = examples (guide 03 §28)</span></div>
    <div class="s4-kpis" id="s4Kpi"></div>
    <div class="table-wrap"><table class="s4-t" id="s4KpiT"></table></div>
  </div>`;
  el.querySelectorAll("[data-s4k]").forEach((b) => b.addEventListener("click", () => { selK = b.dataset.s4k; el.querySelectorAll("[data-s4k]").forEach((x) => x.classList.toggle("on", x === b)); $("s4PoQty").value = MAT[selK].lot; updateErp(true); }));
  $("s4PoQty").value = MAT[selK].lot;
  $("s4PoBtn").addEventListener("click", () => { const q = Math.max(1, Math.round(+$("s4PoQty").value || MAT[selK].lot)); const po = createPO(selK, q, "planner"); $("s4PoMsg").textContent = `${po.id} created: ${q} × ${MAT[selK].item}, due ${clock(po.due)} (lead time ${MAT[selK].lt} h).`; updateErp(true); });
  $("s4GrBtn").addEventListener("click", () => {
    let po = W.pos.find((p) => p.sku === selK && p.state === "open");
    if (!po) po = createPO(selK, Math.max(1, Math.round(+$("s4PoQty").value || MAT[selK].lot)), "planner (delivery now)");
    const gr = receivePO(po, "planner"); $("s4PoMsg").textContent = gr ? `${gr.id}: ${gr.crates} store jobs for ${po.id} sent to the sim (${MAT[selK].item}). Watch them in the job list and the 3D view (item 1).` : "nothing to receive"; updateErp(true);
  });
  $("s4AutoPO").addEventListener("change", (e) => { W.autoPO = e.target.checked; });
  $("s4AutoGR").addEventListener("change", (e) => { W.autoRecv = e.target.checked; });
  $("s4WoChk").addEventListener("click", () => renderAv());
  $("s4WoRel").addEventListener("click", () => { const r = releaseWO($("s4WoM").value, Math.max(1, Math.round(+$("s4WoQ").value || 20))); renderAv(r); renderWos(); });
  $("s4Lines").addEventListener("click", (e) => { const b = e.target.closest("[data-call]"); if (b) { callOff(b.dataset.call, "MES call-off " + b.dataset.line); renderLines(); } });
  $("s4TrSel").addEventListener("click", (e) => { const b = e.target.closest("[data-tr]"); if (b) { selTrace = +b.dataset.tr; renderTrace(true); } });
  built = true;
}

/* ---------------------------------------------------------------- material master + valuation */
function renderMat() {
  $("s4Mat").innerHTML = `<tr><th>ERP item</th><th>Description (ERP short text)</th><th>Becomes (MAKE part)</th><th class="num">Unit load pcs/crate</th><th class="num">kg/pc</th><th class="num">Crate kg gross</th><th class="num">Price $</th>
    <th>Supplier</th><th class="num">Lead time</th><th class="num">MOQ / lot</th><th class="num">EOQ (with slot cost)</th><th>ABC value / moves</th><th>Lot format</th></tr>` +
    SKUS.map((k) => { const m = MAT[k], u = SKU[k], p = P[k];
      return `<tr><td>${dot(k)}<b>${m.item}</b></td><td>${esc(m.desc)}</td><td><code>${m.makes}</code></td><td class="num">${u.perLoad}</td><td class="num">${u.kg}</td><td class="num">${p.crateKg}</td><td class="num">${m.price}</td>
        <td>${m.supplier}</td><td class="num">${m.lt} h</td><td class="num">${m.lot}</td><td class="num">${n0(p.eoq)} (${n0(p.eoq / u.perLoad)} crates)</td><td>${ABC_VALUE[k]} / ${ABC_MOVES[k]}</td><td><code>LOT-${m.prefix}-YYWW-nnn</code></td></tr>`; }).join("");
}
function renderVal() {
  const st = stockTable(); let tv = 0, tq = 0;
  const rows = SKUS.map((k) => { const r = st[k]; tv += r.value; const cons = P[k].valueYear; return `<tr><td>${dot(k)}${MAT[k].item}</td><td class="num">${n0(r.pcs)}</td><td class="num">${MAT[k].price}</td><td class="num"><b>${money(r.value)}</b></td>
    <td class="num">${money(r.blocked * MAT[k].price)}</td><td class="num">${money(cons / 1e3)}k</td><td class="num">${r.value ? n0(cons / r.value) : "–"}</td><td class="num">${n1(r.cov)} h</td></tr>`; }).join("");
  const cons = SKUS.reduce((a, k) => a + P[k].valueYear, 0);
  $("s4Val").innerHTML = `<tr><th>Material</th><th class="num">Pieces</th><th class="num">Price $</th><th class="num">Stock value</th><th class="num">of it blocked</th><th class="num">Consumption / year</th><th class="num">Turns / year</th><th class="num">Coverage</th></tr>${rows}
    <tr class="s4-sum"><td>Total</td><td></td><td></td><td class="num">${money(tv)}</td><td></td><td class="num">${money(cons / 1e6 * 1e3)}k</td><td class="num">${tv ? n0(cons / tv) : "–"}</td><td class="muted">turns = consumption value ÷ stock value</td></tr>`;
}

/* ---------------------------------------------------------------- MRP */
function renderMrp() {
  const k = selK, p = P[k], m = MAT[k], s = mrpStatus(k), rec = mrpRecord(k);
  $("s4Form").textContent =
`${m.item} – ${m.desc}
line demand      d   = 17.2 units/h × mix ${m.mix} × BOM ${m.bom}           = ${p.d.toFixed(2)} pcs/h
demand variation σd  = ${p.sd.toFixed(2)} pcs/h   lead time LT = ${m.lt} h, σLT = ${p.sLT.toFixed(1)} h  (examples)
σ in lead time       = √(LT·σd² + d²·σLT²) = √(${m.lt}·${p.sd.toFixed(2)}² + ${p.d.toFixed(2)}²·${p.sLT.toFixed(1)}²) = ${p.sig.toFixed(1)} pcs
safety stock    SS   = z·σ = 1.645 × ${p.sig.toFixed(1)}                     = ${p.ss.toFixed(0)} pcs  (95 %; config ${m.ssCfg})
reorder point   ROP  = d·LT + SS = ${p.d.toFixed(2)} × ${m.lt} + ${p.ss.toFixed(0)}                = ${p.rop.toFixed(0)} pcs  (${(p.rop / SKU[k].perLoad).toFixed(1)} crates)
EOQ                  = √(2·D·S/H) = √(2 × ${n0(p.D)} × ${PLAN.orderCost} / ${p.H.toFixed(2)})  = ${p.eoq.toFixed(0)} pcs
      D = d × 4 000 h/yr, S = $${PLAN.orderCost}/order, H = 25 % × $${m.price} + slot $450/yr ÷ ${SKU[k].perLoad} pcs = $${p.H.toFixed(2)}/pc·yr
      (without slot cost: EOQ = ${p.eoq0.toFixed(0)} – space in an AS/RS is expensive)
stock position       = on hand ${s.usable} (usable) + on order ${s.oo} = ${s.position} pcs  →  ${s.below ? "BELOW ROP – create a purchase order" : "above ROP – no order"}`;
  $("s4MrpK").innerHTML = [["On hand (sim)", n0(s.onHand), `${stockTable()[k].loads} crates · usable ${s.usable}`], ["On order", n0(s.oo), `${W.pos.filter((x) => x.sku === k && x.state === "open").length} open PO`],
    ["Reorder point", n0(p.rop), `SS ${n0(p.ss)}`], ["Status", s.below ? "ORDER" : "OK", s.below ? "position < ROP" : "position ≥ ROP"]]
    .map(([l, v, n], i) => `<div class="kpi${i === 3 && s.below ? " s4-alert" : ""}"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`).join("");
  const R = rec.rows;
  const row = (t, f, cls = "") => `<tr class="${cls}"><td>${t}</td>${R.map((r) => `<td class="num">${f(r)}</td>`).join("")}</tr>`;
  $("s4Mrp").innerHTML = `<tr><th>Shift starting</th>${R.map((r) => `<th class="num">${clock(r.t0)}</th>`).join("")}</tr>` +
    row("Gross requirement (d × 8 h ÷ yield)", (r) => n0(r.gross)) + row("Scheduled receipts (open PO)", (r) => (r.sr ? n0(r.sr) : "")) +
    row("Projected on hand (start " + n0(rec.start) + ")", (r) => n0(r.poh), "s4-sum") + row("Net requirement (below SS)", (r) => (r.pr ? n0(r.net) : "")) +
    row(`Planned order receipt (lot ${m.lot})`, (r) => (r.pr ? n0(r.pr) : "")) + row(`Planned order release (LT ${m.lt} h = ${rec.ltP} shifts earlier)`, (r) => (r.rel ? n0(r.rel) : "") + (r.i === 0 && r.late ? ` <span class="st-chip s-bad">${n0(r.late)} late – release now</span>` : ""));
  renderSaw(rec);
  $("s4Pos").innerHTML = `<tr><th>PO</th><th>Material</th><th class="num">Qty</th><th class="num">Crates</th><th>Created</th><th>Due</th><th>Why</th><th>State</th></tr>` + (W.pos.length ? W.pos.slice(0, 15).map((o) =>
    `<tr><td>${o.id}</td><td>${MAT[o.sku].item}</td><td class="num">${o.qty}</td><td class="num">${o.crates}</td><td>${clock(o.t)}</td><td>${clock(o.due)}</td><td>${esc(o.why)}</td><td><span class="st-chip ${o.state === "open" ? "s-info" : "s-done"}">${o.state}${o.tRecv != null ? " " + clock(o.tRecv) : ""}</span></td></tr>`).join("")
    : `<tr><td colspan="8" class="muted">No purchase order yet. Create one above – "Post inbound delivery" sends the crates to the infeed as store jobs.</td></tr>`);
}
function renderSaw(rec) {
  const k = selK, p = P[k], H = W.hist.slice(-240), now = sim.t;
  const t0 = H.length ? H[0].t : now, t1 = now + rec.rows.length * PLAN.shiftH * 3600;
  const proj = [{ t: now, v: rec.start }]; let prev = rec.start;   // receipts arrive at the start of a shift (bucket), consumption is linear inside it
  rec.rows.forEach((r) => { if (r.sr + r.pr) proj.push({ t: r.t0, v: prev + r.sr + r.pr }); proj.push({ t: r.t0 + PLAN.shiftH * 3600, v: r.poh }); prev = r.poh; });
  const vmax = Math.max(p.rop * 1.4, ...H.map((h) => h.pcs[k]), ...proj.map((x) => x.v), 10);
  const X = (t) => 50 + (t - t0) / Math.max(1, t1 - t0) * 900, Y = (v) => 200 - Math.max(0, v) / vmax * 180;
  const act = H.map((h, i) => `${i ? "L" : "M"}${X(h.t).toFixed(1)},${Y(h.pcs[k]).toFixed(1)}`).join(" ");
  let pj = `M${X(proj[0].t).toFixed(1)},${Y(proj[0].v).toFixed(1)}`; for (let i = 1; i < proj.length; i++) pj += ` L${X(proj[i].t).toFixed(1)},${Y(proj[i].v).toFixed(1)}`;
  $("s4Saw").innerHTML = `<svg viewBox="0 0 960 230" class="s4-sawsvg" role="img" aria-label="stock curve">
    <line x1="50" y1="200" x2="950" y2="200" class="s4-axl"/><line x1="50" y1="15" x2="50" y2="200" class="s4-axl"/>
    <line x1="50" x2="950" y1="${Y(p.rop).toFixed(1)}" y2="${Y(p.rop).toFixed(1)}" class="s4-rop"/><text x="955" y="${Y(p.rop) + 4}" class="s4-ax" text-anchor="end" dy="-6">ROP ${n0(p.rop)}</text>
    <line x1="50" x2="950" y1="${Y(p.ss).toFixed(1)}" y2="${Y(p.ss).toFixed(1)}" class="s4-ss2"/><text x="955" y="${Y(p.ss) + 4}" class="s4-ax" text-anchor="end" dy="-6">SS ${n0(p.ss)}</text>
    <line x1="${X(now).toFixed(1)}" x2="${X(now).toFixed(1)}" y1="15" y2="200" class="s4-now"/><text x="${X(now) + 4}" y="26" class="s4-ax">now ${clock(now)}</text>
    ${act ? `<path d="${act}" class="s4-act"/>` : ""}<path d="${pj}" class="s4-proj"/>
    <text x="46" y="${Y(vmax) + 4}" class="s4-ax" text-anchor="end">${n0(vmax)}</text><text x="46" y="204" class="s4-ax" text-anchor="end">0</text>
    <text x="50" y="222" class="s4-ax">${clock(t0)}</text><text x="950" y="222" class="s4-ax" text-anchor="end">${clock(t1)} (+48 h)</text></svg>`;
}

/* ---------------------------------------------------------------- MES */
function renderLines() {
  const k = kpis(), rlt = (k.avgCycle || 60) + 30 + 300 + sim.queue.filter((j) => j.type === "retrieve").length * (k.avgCycle || 60) / 2;
  $("s4Lines").innerHTML = `<tr><th>Line</th><th>Station / buffer</th><th>Call-off rule (MES)</th><th>Material</th><th class="num">Demand pcs/h</th><th class="num">Crate</th><th class="num">Kanban N (RLT ${dur(rlt)})</th><th class="num">Retrievals/h (sim, last h)</th><th>Last delivery</th><th></th></tr>` +
    LINES.map((L) => L.skus.map((s, i) => { const p = P[s], N = p.d * (rlt / 3600) * 1.2 / SKU[s].perLoad;
      const last = sim.done.find((j) => j.type === "retrieve" && j.state === "done" && j.sku === s);
      return `<tr>${i === 0 ? `<td rowspan="${L.skus.length}"><b>${L.name}</b></td><td rowspan="${L.skus.length}">${L.station}<br><span class="muted">${esc(L.buffer)}</span></td><td rowspan="${L.skus.length}">${esc(L.rule)}</td>` : ""}
        <td>${dot(s)}${MAT[s].item}</td><td class="num">${n1(p.d)}</td><td class="num">${SKU[s].perLoad}</td><td class="num">${N.toFixed(2)} → ${Math.max(2, Math.ceil(N))}</td><td class="num">${retrRate(s).toFixed(1)}</td>
        <td>${last ? `${last.id} ${clock(last.tEnd)} (${esc(last.src)})` : "–"}</td><td><button class="chip" data-call="${s}" data-line="${L.station}">call off 1 crate</button></td></tr>`; }).join("")).join("");
}
function renderAv(r) {
  const model = $("s4WoM").value, qty = Math.max(1, Math.round(+$("s4WoQ").value || 20));
  const av = r ? r.av : availability(model, qty);
  $("s4Av").innerHTML = `<tr><th>Material</th><th class="num">Needed</th><th class="num">Crates</th><th class="num">Unrestricted</th><th class="num">Reserved for WOs</th><th class="num">Available</th><th>Result</th></tr>` +
    av.lines.map((l) => `<tr><td>${dot(l.k)}${MAT[l.k].item}</td><td class="num">${l.need}</td><td class="num">${l.crates}</td><td class="num">${l.free}</td><td class="num">${l.resWO}</td><td class="num">${l.avail}</td><td><span class="st-chip ${l.ok ? "s-good" : "s-bad"}">${l.ok ? "OK" : "short " + (l.need - l.avail)}</span></td></tr>`).join("") +
    `<tr class="s4-sum"><td colspan="7">${qty} × ${model}: ${av.ok ? "all material available → order can be released" : "material missing → order stays PLANNED, ERP is asked for a delivery"}${r ? ` · <b>${r.wo.id}</b> ${r.wo.state}${r.wo.jobs.length ? " – jobs " + r.wo.jobs.join(", ") : ""}` : ""}</td></tr>`;
}
function renderWos() {
  $("s4Wos").innerHTML = `<tr><th>WO</th><th>Model</th><th class="num">Qty</th><th>Released</th><th>State</th><th>First call-off jobs</th></tr>` + (W.wos.length ? W.wos.slice(0, 12).map((w) =>
    `<tr><td>${w.id}</td><td>${w.model}</td><td class="num">${w.qty}</td><td>${clock(w.t)}</td><td><span class="st-chip ${w.state === "released" ? "s-good" : "s-bad"}">${esc(w.state)}</span></td><td>${w.jobs.map((id) => { const j = sim.done.find((x) => x.id === id) || sim.queue.find((x) => x.id === id); return `${id} ${j ? j.state : ""}`; }).join(", ")}</td></tr>`).join("")
    : `<tr><td colspan="6" class="muted">none yet – check and release a work order on the left</td></tr>`);
}
let lastTraceKey = "";
function renderTrace(force) {
  const T = W.trace;
  const key = T.length + ":" + selTrace + ":" + (T[0] ? T[0].job.id : "");
  if (!force && key === lastTraceKey) return; lastTraceKey = key;
  $("s4TrSel").innerHTML = T.length ? `<b>Retrieved crate</b> ` + T.slice(0, 8).map((t, i) => `<button class="chip${i === selTrace ? " on" : ""}" data-tr="${i}">${dot(t.sku)}${t.job.id} ${MAT[t.sku].prefix}</button>`).join("") : `<span class="muted">waiting for the first retrieval to finish …</span>`;
  const t = T[Math.min(selTrace, T.length - 1)];
  if (!t) { $("s4Tree").innerHTML = ""; $("s4TrQ").innerHTML = ""; return; }
  const m = MAT[t.sku], j = t.job, ser = t.serials;
  const node = (lvl, title, val, sub) => `<li><span class="s4-tn s4-l${lvl}"><b>${title}</b> <code>${esc(val)}</code>${sub ? `<br><small>${sub}</small>` : ""}</span>`;
  const isCC = m.model !== "all";
  $("s4Tree").innerHTML = `<ul>${node(0, "Heat (3.1 certificate)", heatOf(t.lot), `${m.supplier} · EN 10204 3.1 file ${realLot(t.sku, t.lot)}_3.1.pdf`)}
    <ul>${node(1, "Supplier batch / PO", `${batchOf(t.lot)} · ${poOf(t.lot)}`, "ASN (DESADV) with SSCC + heat")}
    <ul>${node(2, "Own lot (goods receipt)", realLot(t.sku, t.lot), `twin lot ${esc(t.lot)} · ${m.item} · sample ISO 2859-1 OK`)}
    <ul>${node(3, "Handling unit", `${crateOf(t.lot)} · (00)${ssccOf(t.lot)}`, `${t.qty} pcs · ${t.kg} kg`)}
    <ul>${node(4, "Storage location", t.loc, `in ${clock(t.inDate)} → out ${clock(j.tStart)} · twin slot ${t.slotId}`)}
    <ul>${node(5, "Retrieval job (WMS → WCS)", j.id, `${esc(j.src)} · requested ${clock(j.tReq)} · delivered ${clock(j.tEnd)} · ${dur(j.tEnd - j.tReq)}`)}
    <ul>${node(6, "Line / station", m.station, `${esc(m.line)} · route ${esc(m.route)}`)}
    <ul>${node(7, isCC ? "Machined part + work order" : "Machined part → pump assembly ASSY-01", isCC ? `${m.makes} · ${woOf(ser[0])}` : m.makes, isCC ? "serial marked at LOAD-CC (DataMatrix)" : `${m.bom} per pump · lot recorded at ASSY-01`)}
    <ul>${ser.map((s) => `<li><span class="s4-tn s4-l8"><b>Compressor serial</b> <code>${s}</code>${isCC ? "" : ` <small>${woOf(s)}</small>`}</span></li>`).join("")}</ul>
    </li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>`;
  const sameHeat = W.trace.filter((x) => heatOf(x.lot) === heatOf(t.lot) && x.sku === t.sku);
  const nSer = sameHeat.reduce((a, x) => a + x.serials.length, 0);
  const inStock = sim.slots.filter((s) => s.load && s.load.sku === t.sku && heatOf(s.load.lot) === heatOf(t.lot));
  $("s4TrQ").innerHTML = `<table class="s4-kv"><tr><td>Backward (from serial ${ser[0] || "–"})</td><td>serial → ${isCC ? woOf(ser[0]) + " → " : ""}${m.station} → ${j.id} → ${t.loc} → ${crateOf(t.lot)} → ${realLot(t.sku, t.lot)} → ${batchOf(t.lot)} → heat ${heatOf(t.lot)}</td></tr>
    <tr><td>Forward (heat ${heatOf(t.lot)} is suspect)</td><td>${sameHeat.length} crate(s) of this heat already used → ${nSer} serial(s) seen in this session; <b>${inStock.length} crate(s) still in the store</b>: ${inStock.slice(0, 6).map((s) => locOf(s)).join(", ") || "none"} ${inStock.length ? "→ block them (quality hold) and inform the supplier (8D)" : ""}</td></tr>
    <tr><td>Query (SQL idea)</td><td><code>SELECT serial FROM genealogy g JOIN lot l ON g.lot_id = l.id WHERE l.heat = '${heatOf(t.lot)}'</code></td></tr>
    <tr><td>Recall drill target</td><td>steps 1 – 8 of guide 15 §3.18 in &lt; 1 hour</td></tr></table>
    <p class="s4-f">Twin simplification: each crate gets its own lot number; in a real WMS one lot = one delivery of one item from one heat (guide 15 §3.7), and the crate is the handling unit with its own ID.</p>`;
}
function renderKpi() {
  const k = kpis();
  const tiles = [["Stock accuracy", k.accuracy == null ? "–" : (k.accuracy * 100).toFixed(2) + " %", `${k.counted} crates counted · target ≥ 99.5 %`],
    ["OTIF to the line", k.otif == null ? "–" : (k.otif * 100).toFixed(0) + " %", `delivered ≤ ${PLAN.otifMin} min, last ${k.otifN} call-offs`],
    ["Dock-to-stock", dur(k.d2s), "infeed request → stored (excl. inspection)"], ["Inventory turns", k.turns ? n0(k.turns) + " /yr" : "–", `${money(k.consYear / 1e6 * 1e6)} /yr ÷ ${money(k.value)}`],
    ["Retrievals / h", n1(k.retrPerH), `stores ${n1(k.storePerH)} /h · total ${n1(k.jobsPerH)} jobs/h`], ["Crane utilisation", (k.util * 100).toFixed(0) + " %", "busy time ÷ time (plan ≤ 80 – 85 %)"],
    ["Mean cycle per job", dur(k.avgCycle), "start → done incl. dual cycles"], ["Energy per job", k.energyWhPerJob.toFixed(1) + " Wh", "crane estimate from the sim"]];
  $("s4Kpi").innerHTML = tiles.map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`).join("");
  $("s4KpiT").innerHTML = `<tr><th>KPI</th><th>Formula</th><th>Live</th><th>Target (example)</th></tr>
    <tr><td>Stock accuracy</td><td>correct counted crates ÷ counted crates</td><td>${k.accuracy == null ? "–" : (k.accuracy * 100).toFixed(2) + " %"}</td><td>≥ 99.5 % (AS/RS ≈ 100 %)</td></tr>
    <tr><td>OTIF to the line</td><td>call-offs delivered complete and ≤ ${PLAN.otifMin} min ÷ all call-offs</td><td>${k.otif == null ? "–" : (k.otif * 100).toFixed(1) + " %"}</td><td>≥ 98 %</td></tr>
    <tr><td>Dock-to-stock time</td><td>stored time − infeed request time (+ inspection)</td><td>${dur(k.d2s)}</td><td>≤ 1 – 2 h incl. inspection</td></tr>
    <tr><td>Inventory turns</td><td>consumption value per year ÷ stock value</td><td>${k.turns ? n0(k.turns) : "–"}</td><td>depends on the supply chain (guide 03 §20.6: 253)</td></tr>
    <tr><td>Retrievals per hour</td><td>retrievals done ÷ hours</td><td>${n1(k.retrPerH)}</td><td>line need 9.9 crates/h at 17.2 units/h</td></tr>
    <tr><td>Crane utilisation</td><td>busy time ÷ elapsed time</td><td>${(k.util * 100).toFixed(1)} %</td><td>≤ 80 – 85 %</td></tr>
    <tr><td>Failed jobs</td><td>no-read, no stock, store full</td><td>${k.failed}</td><td>0 – each one = a root cause</td></tr>`;
}

/* ---------------------------------------------------------------- payload examples (ERP / MES messages) */
export function payloadErp(id) {
  const lastTr = W.trace[0], L = lastTr, po = W.last.po && W.last.po.po, gr = W.last.asn && W.last.asn.po;
  if (id === "sched") { const w = W.last.sched && W.last.sched.wo;
    return { text: `<ProcessProductionSchedule xmlns="http://www.mesa.org/xml/B2MML">
  <ApplicationArea><Sender><LogicalID>ERP</LogicalID></Sender><BODID>ERP-${PLAN.yw}-${pad(W.cnt.sched, 6)}</BODID>
    <CreationDateTime>${isoT(w ? w.t : sim.t)}</CreationDateTime></ApplicationArea>
  <DataArea><Process/>
    <ProductionSchedule><ProductionRequest>
      <ID>${w ? w.id : "WO-" + PLAN.yw + "-0501"}</ID><Priority>3</Priority><EndTime>${isoT((w ? w.t : sim.t) + 24 * 3600)}</EndTime>
      <SegmentRequirement><MaterialProducedRequirement>
        <MaterialDefinitionID>${w ? { VC10: "VC10-100", VC20: "VC20-300", VC30: "VC30-500" }[w.model] : "VC20-300"}</MaterialDefinitionID>
        <Quantity><QuantityString>${w ? w.qty : 20}</QuantityString><UnitOfMeasure>EA</UnitOfMeasure></Quantity>
      </MaterialProducedRequirement></SegmentRequirement>
    </ProductionRequest></ProductionSchedule></DataArea>
</ProcessProductionSchedule>`, note: `Count = work orders released in the MES card (${W.cnt.sched}). The MES answers with AcknowledgeProductionSchedule within 60 s (guide 04 §11.14).` }; }
  if (id === "perf") return { text: `<ProcessProductionPerformance xmlns="http://www.mesa.org/xml/B2MML">
  <ApplicationArea><Sender><LogicalID>MES</LogicalID></Sender><BODID>MES-${PLAN.yw}-${pad(W.cnt.perf, 6)}</BODID><CreationDateTime>${isoT(L ? L.job.tEnd : sim.t)}</CreationDateTime></ApplicationArea>
  <DataArea><Process/><ProductionPerformance><ProductionResponse>
    <ID>${L && L.serials[0] ? woOf(L.serials[0]) : "WO-" + PLAN.yw + "-0201"}</ID>
    <SegmentResponse><MaterialConsumedActual>
      <MaterialDefinitionID>${L ? MAT[L.sku].item : "CC20-CAST"}</MaterialDefinitionID>
      <MaterialLotID>${L ? realLot(L.sku, L.lot) : "LOT-CC20-2646-003"}</MaterialLotID>
      <Quantity><QuantityString>${L ? L.qty : 4}</QuantityString><UnitOfMeasure>EA</UnitOfMeasure></Quantity>
    </MaterialConsumedActual></SegmentResponse>
  </ProductionResponse></ProductionPerformance></DataArea>
</ProcessProductionPerformance>`, note: "Consumption by lot (backflush) – the ERP reduces stock value and the lot quantity. Count = crates delivered to the lines." };
  if (id === "gm") { const j = W.last.gm, LL = j && W.lots.get(j.id);
    return { text: JSON.stringify({ messageId: `WMS-GM-${pad(W.cnt.gm, 6)}`, time: isoT(j ? j.tEnd || sim.t : sim.t), movementType: j && j.type === "retrieve" ? "261 goods issue to production" : "101 goods receipt into storage",
      material: j ? MAT[j.sku].item : "CC20-CAST", lot: LL ? realLot(LL.sku, LL.lot) : null, quantity: j ? j.qty : 0, unit: "EA", plant: "VC01", storageLocation: "ASRS-RAW",
      handlingUnit: LL ? crateOf(LL.lot) : null, reference: j ? j.src : null, wmsJob: j ? j.id : null }, null, 2), note: "The ERP sees the store as ONE storage location ASRS-RAW with quantity per lot; slot data stay in the WMS. Posted only after the WCS confirmation (TC 00)." }; }
  if (id === "inb") { const j = W.last.inb;
    return { text: JSON.stringify({ messageId: `ERP-INB-${pad(W.cnt.inb, 6)}`, delivery: po ? po.id.replace("PO", "DLV") : "DLV-auto", purchaseOrder: po ? po.id : null, supplier: j ? MAT[j.sku].supplier : "Foundry A",
      items: [{ material: j ? MAT[j.sku].item : "CC20-CAST", quantity: j ? j.qty : 4, unit: "EA", handlingUnits: 1, inspection: "ISO 2859-1 level II AQL 1.0", stockCategory: "QI" }] }, null, 2),
      note: "Expected receipt: the WMS knows what comes before the truck arrives and can check the ASN and reserve slots. Count = store jobs announced." }; }
  if (id === "asn") return { text: `UNH+1+DESADV:D:96A:UN'
BGM+351+${gr ? gr.id.replace("PO", "ASN") : "ASN-" + PLAN.yw + "-0001"}+9'
DTM+137:${isoT(sim.t).replace(/[-:TZ]/g, "").slice(0, 12)}:203'
RFF+ON:${gr ? gr.id : "PO-" + PLAN.yw + "-0041"}'
NAD+SU+FOUNDRYA::92'
CPS+1'  PAC+${gr ? gr.crates : 30}++CRT'
GIN+BJ+0${PLAN.gs1}600004123'          (SSCC of each crate)
LIN+1++${gr ? MAT[gr.sku].item : "CC20-CAST"}:IN'
QTY+12:${gr ? gr.qty : 120}'
PCI+36E'  GIN+BX+${gr ? "F-88" + pad(200 + W.cnt.asn, 3) : "F-88213"}'   (batch / heat link)
UNT+...'`, note: "Count = deliveries announced (ERP deliveries posted + the sim's single-crate arrivals). ASN = EDIFACT DESADV or VDA 4987 / GS1 XML." };
  if (id === "po") return { text: `UNH+1+ORDERS:D:96A:UN'
BGM+220+${po ? po.id : "PO-" + PLAN.yw + "-0041"}+9'
DTM+2:${isoT(po ? po.due : sim.t + 57600).replace(/[-:TZ]/g, "").slice(0, 12)}:203'   (requested delivery = now + lead time)
NAD+BY+VCFACTORY::92'  NAD+SU+${po ? MAT[po.sku].supplier.replace(/\s/g, "").toUpperCase() : "FOUNDRYA"}::92'
LIN+1++${po ? MAT[po.sku].item : "CC20-CAST"}:IN'
QTY+21:${po ? po.qty : 120}'  PRI+AAA:${po ? MAT[po.sku].price : 95}'
UNT+...'`, note: `Count = purchase orders created in the ERP card (${W.cnt.po}).` };
  if (id === "call") { const j = W.last.call;
    return { text: `POST https://vc-ops-wms01/api/v1/calloffs\n` + JSON.stringify({ calloffId: j ? j.id : "-", time: isoT(j ? j.tReq : sim.t), line: j && /MES/.test(j.src) ? j.src : "line kanban", material: j ? MAT[j.sku].item : "CYL-CAST",
      handlingUnits: 1, destination: j ? MAT[j.sku].station : "VMC-01", fifo: true, priority: 3 }, null, 2) + `\n→ 201 Created {"wmsJob":"${j ? j.id : "-"}"}`, note: "The MES asks for material, not for a slot – the WMS chooses the crate (FIFO). Count = line + MES call-offs." }; }
  if (id === "deliv") return { text: `MQTT topic vc/plant1/wms/asrsraw/delivered   (QoS 1)\n` + JSON.stringify({ time: isoT(L ? L.job.tEnd : sim.t), wmsJob: L ? L.job.id : "-", material: L ? MAT[L.sku].item : "-", lot: L ? realLot(L.sku, L.lot) : "-",
    handlingUnit: L ? crateOf(L.lot) : "-", sscc: L ? ssccOf(L.lot) : "-", qty: L ? L.qty : 0, from: L ? L.loc : "-", to: L ? MAT[L.sku].station : "-" }, null, 2), note: "The MES links this lot to the next serials started at the station (genealogy)." };
  return null;
}

/* ---------------------------------------------------------------- update + self-check */
let t = 0;
export function updateErp(force) {
  if (!built) return; t++;
  renderMrp(); renderKpi(); renderLines(); renderTrace(force);
  if (force || t % 3 === 0) { renderMat(); renderVal(); renderWos(); if (force) renderAv(); }
  const a = $("s4AutoPO"); if (a) a.checked = W.autoPO; const g = $("s4AutoGR"); if (g) g.checked = W.autoRecv;
}
export function testErp(log) {
  const before = sim.queue.filter((j) => j.type === "store").length, inc = sim.inConv.length;
  const po = createPO("RAW_CC30", 6, "self-test"), gr = receivePO(po, "self-test");
  log(`erp PO ${po.id} qty 6 crates=${po.crates} (expect 2) GR ${gr.id} jobs=${gr.jobs.length} storeQueue +${sim.queue.filter((j) => j.type === "store").length - before} inConv +${sim.inConv.length - inc} state=${po.state}`);
  const av = availability("VC20", 20); log(`avail VC20×20 need ${av.lines.map((l) => MAT[l.k].item + "=" + l.need).join(" ")} (expect CC20 21, CYL 41, CS 21) ok=${av.ok}`);
  const r = releaseWO("VC20", 20); log(`release ${r.wo.id} state=${r.wo.state} jobs=${r.wo.jobs.length}`);
  const rec = mrpRecord("RAW_CC"); log(`mrp CC20 gross/shift=${rec.rows[0].gross.toFixed(1)} (expect 69.4 = 8.6×8/0.992) start=${rec.start} ltShifts=${rec.ltP}`);
  log(`trace crates=${W.trace.length} first=${W.trace[0] ? W.trace[0].job.id + " " + W.trace[0].lot + " serials " + W.trace[0].serials.length : "none yet"} onOrder CC30=${onOrder("RAW_CC30")}`);
}
