/* AS/RS raw materials – item 4 "WMS / ERP / MES" (#srItem4). Guide: docs/34_asrs_wms_erp_mes.md.
 * Live from the ONE shared simulation window.ASRS.sim (asrscore.js): stock per slot / lot, rack map, slotting,
 * goods receipt + issue flows, cycle counts, quality hold, job list (this file); ERP material master, valuation,
 * MRP + purchase orders, MES call-off, availability check, traceability, KPIs (asrswms_erp.js).
 * Ends with the card "Real components + drawings – catalogue examples" (makeCard, id srCard4).
 * Lazy: built on window event "sritemshow" with detail "4" (or at load when srCtl.current()==="4" and the tab is visible).
 * Test: &sr4only=stock,slot (show only these cards – headless screenshots) · /?sritem=4&sr4hold#asrs (hold: keeps the load event pending for headless screenshots, shows the tab) ·
 *       &sr4test (console "SR4TEST …" hand-checkable lines + error count) · &sr4card=<id> scrolls to a card
 *       (land, stock, slot, flow, count, jobs, mat, mrp, mes, trace, kpi, srCard4) · &sr4slot=L-01-1-3 selects a slot.
 * Offline, no libraries. ALL VALUES ARE EXAMPLES – the WMS / ERP / AS/RS suppliers' offers decide.
 */
import { makeCard } from "./robotref.js";
import { SKU, SKUS, RACK } from "./asrscore.js";
import { PLAN, MAT, SYSTEMS, MSGS, CARD } from "./asrswms_data.js";
import { A, sim, W, P, locOf, realLot, crateOf, ssccOf, heatOf, batchOf, poOf, isoT, clock, dur, money, n0, n1, pad,
  stockTable, catOf, ageOf, inDateOf, slotting, SC_OF, ZONE, ABC_MOVES, countPlan, runCount, hold, sampling, telegramTO, telegramTC, TC_CODES, kpis } from "./asrswms_core.js";
import { buildErp, updateErp, payloadErp, testErp } from "./asrswms_erp.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const EX = "example – the WMS / AS/RS supplier's offer decides";
let built = false, host = null, selSlot = null, mapMode = "sku", selMsg = "to", selSys = null, jobF = { type: "", state: "", sku: "", src: "" };
const errs = [];

// test only (&sr4hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots), then shows the tab
if (Q.has("sr4hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?sr4hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("asrs"); }, 300); }
if (Q.has("sr4test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }

const visible = () => built && window.srCtl && window.srCtl.current() === "4" && window.srCtl.tabVisible() && !document.hidden;
const skuName = (k) => `${MAT[k].item}`;
const dot = (k) => `<i class="s4-dot" style="background:${SKU[k].color}"></i>`;

/* ================================================================ build */
function build() {
  if (built) return; host = $("srItem4"); if (!host) return;
  built = true;
  host.innerHTML = `
  <div class="card s4-top">
    <div class="s4-nav" role="navigation" aria-label="WMS ERP MES sections">
      ${[["land", "Landscape + messages"], ["stock", "WMS stock + rack map"], ["slot", "Slotting"], ["flow", "Goods receipt / issue"], ["count", "Counting + quality hold"], ["jobs", "Job list"],
        ["mat", "ERP material master"], ["mrp", "ERP MRP + purchasing"], ["mes", "MES call-off + release"], ["trace", "Traceability"], ["kpi", "KPIs"], ["srCard4", "Buy list + drawings"]]
        .map(([id, t]) => `<button class="chip" data-s4go="${id}">${t}</button>`).join("")}
    </div>
    <div class="s4-live" id="s4Live"></div>
  </div>

  <div class="card" id="s4c-land">
    <div class="card-head"><h2>System landscape – ERP → MES → WMS → WCS → crane PLC, with the messages between them</h2>
      <span class="sub">live message counters from the running twin · click a system or a message · host names / IP addresses per guide 15 · ${EX}</span></div>
    <p class="s4-p">Each layer owns its own data and talks only to its neighbours. <b>Orders go down, confirmations go up.</b> The ERP plans in days and money, the MES in orders
      and serials, the WMS in slots and crates, the WCS in crane moves, the PLC in millimetres and milliseconds. Counters show how many messages of each kind the twin has
      produced since the page was opened.</p>
    <div class="s4-land"><div class="s4-svgwrap" id="s4LandSvg"></div><div class="s4-detail" id="s4LandDet"></div></div>
    <div class="table-wrap"><table class="s4-t" id="s4MsgT"></table></div>
  </div>

  <div class="card" id="s4c-stock">
    <div class="card-head"><h2>WMS – live stock per material and rack occupancy</h2>
      <span class="sub">392 slots · 2 sides × 14 bays × 2 crates × 7 levels · coverage against the line demand at 17.2 units/h (guide 03 §20) · ${EX}</span></div>
    <div class="table-wrap"><table class="s4-t" id="s4StockT"></table></div>
    <p class="s4-f">coverage (h) = pieces in stock ÷ line demand (pcs/h); line demand = 17.2 units/h × model mix × BOM quantity. Coverage shorter than the lead time = order now (ERP card).</p>
    <div class="s4-bar"><b>Colour the rack by</b>
      ${[["sku", "material (SKU)"], ["age", "age (FIFO)"], ["abc", "ABC zone vs class"], ["cat", "stock category"]].map(([k, t]) => `<button class="chip${k === mapMode ? " on" : ""}" data-s4map="${k}">${t}</button>`).join("")}
      <span class="muted" id="s4MapInfo"></span></div>
    <div class="s4-rack"><div class="s4-svgwrap" id="s4Rack"></div><div class="s4-detail" id="s4Slot"></div></div>
    <div class="s4-legend" id="s4Legend"></div>
  </div>

  <div class="card" id="s4c-slot">
    <div class="card-head"><h2>Slotting strategy – which slot for which crate, and what it does to the crane cycle</h2>
      <span class="sub">single-cycle time per slot from the crane model (travel + hoist together, 2 stops) · live numbers from the current stock</span></div>
    <div class="s4-grid2">
      <div><div class="table-wrap"><table class="s4-t">
        <tr><th>Strategy</th><th>Rule</th><th>Good for</th><th>Effect on cycle time</th></tr>
        <tr><td><b>Shortest cycle (closest free slot)</b> – used by the twin's sim</td><td>store into the free slot with the shortest crane move from the I/O point</td><td>simple, fast put-away</td><td>put-away fast; but fast and slow movers get mixed, so retrievals are not always short</td></tr>
        <tr><td><b>ABC zones (class-based)</b></td><td>zone A = fastest 25 % of slots for class-A movers, B next 35 %, C the rest</td><td>few SKUs with very different move rates</td><td>retrieval cycle shorter by 10 – 25 % (see live numbers)</td></tr>
        <tr><td><b>COI rule</b> (cube-per-order index)</td><td>COI = slots needed ÷ retrievals per hour – lowest COI gets the best slots</td><td>exact ranking of SKUs for zoning</td><td>optimal for single-command cycles (theorem of Heskett)</td></tr>
        <tr><td><b>FIFO</b> (retrieval rule)</td><td>retrieve the oldest lot first, then the shortest move</td><td>castings / forgings (corrosion, traceability)</td><td>slightly longer moves than "nearest crate"; needed for quality</td></tr>
        <tr><td><b>Fixed (dedicated) slots</b></td><td>each SKU has its own slots</td><td>manual stores, very few SKUs</td><td>needs ≈ 15 % more slots (guide 03 §20.5: 209 vs 180)</td></tr>
        <tr><td><b>Random (chaotic)</b></td><td>any free slot; WMS remembers it</td><td>AS/RS with a WMS</td><td>best space use; cycle = mean of all slots</td></tr>
      </table></div></div>
      <div><div class="s4-kpis" id="s4SlotK"></div><div class="table-wrap"><table class="s4-t" id="s4CoiT"></table></div>
        <p class="s4-f">mean retrieval cycle = Σ (retrievals/h of SKU × mean single-cycle time of its slots) ÷ Σ retrievals/h. Retrieval rates = line demand in crates/h (guide 03 §4.4).</p></div>
    </div>
  </div>

  <div class="card" id="s4c-flow">
    <div class="card-head"><h2>Goods receipt and goods issue – the two flows through the store</h2>
      <span class="sub">live counters from the sim queue / done list · ID point, quality check (ISO 2859-1 sample), putaway · MES call-off, retrieval, outfeed, line</span></div>
    <h3>Goods receipt: ASN → ID point → quality check → putaway job</h3><div class="s4-flow" id="s4GR"></div>
    <h3>Goods issue: MES call-off → retrieval job → outfeed → line</h3><div class="s4-flow" id="s4GI"></div>
    <div class="s4-grid2"><div><h3>Sampling at goods receipt (ISO 2859-1, normal inspection, level II, AQL 1.0 – example)</h3><div class="table-wrap"><table class="s4-t" id="s4Samp"></table></div></div>
      <div><h3>Last receipts (ERP deliveries posted in the ERP card)</h3><div class="table-wrap scroll"><table class="s4-t" id="s4Rec"></table></div></div></div>
  </div>

  <div class="card" id="s4c-count">
    <div class="card-head"><h2>Inventory counting, stock categories and quality hold</h2>
      <span class="sub">cycle count plan by ABC class · blocked / quality-hold stock · stock accuracy KPI</span></div>
    <div class="s4-grid2">
      <div><h3>Cycle count plan (permanent inventory instead of a yearly stop)</h3><div class="table-wrap"><table class="s4-t" id="s4CntPlan"></table></div>
        <div class="s4-bar"><button class="btn" id="s4CntRun">Run today's cycle count</button><span class="muted" id="s4CntInfo"></span></div>
        <div class="table-wrap scroll"><table class="s4-t" id="s4CntLog"></table></div></div>
      <div><h3>Stock categories (live)</h3><div class="table-wrap"><table class="s4-t" id="s4Cat"></table></div>
        <h3>Blocked / quality-hold slots</h3><div class="table-wrap scroll"><table class="s4-t" id="s4Hold"></table></div>
        <p class="s4-f">Block a crate: click a slot in the rack map, then "Put on quality hold". A blocked crate is never retrieved by the sim (shared with items 1 – 3).</p></div>
    </div>
  </div>

  <div class="card" id="s4c-jobs">
    <div class="card-head"><h2>Job list – transport orders of the WMS (live from sim.queue / sim.done)</h2>
      <span class="sub">store = put-away, retrieve = call-off · source: auto (sim demand), line, MES, ERP · newest first</span></div>
    <div class="s4-bar" id="s4JobF">
      <select data-f="type" aria-label="type"><option value="">all types</option><option value="store">store</option><option value="retrieve">retrieve</option></select>
      <select data-f="state" aria-label="state"><option value="">all states</option><option>queued</option><option>active</option><option>done</option><option>failed</option></select>
      <select data-f="sku" aria-label="material"><option value="">all materials</option>${SKUS.map((k) => `<option value="${k}">${MAT[k].item}</option>`).join("")}</select>
      <select data-f="src" aria-label="source"><option value="">all sources</option><option value="auto">auto (sim)</option><option value="line">line</option><option value="MES">MES</option><option value="ERP">ERP</option></select>
      <span class="muted" id="s4JobN"></span></div>
    <div class="table-wrap scroll s4-tall"><table class="s4-t" id="s4Jobs"></table></div>
  </div>
  <div id="s4Erp"></div>`;

  host.querySelectorAll("[data-s4go]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.s4go; const el = $(id === "srCard4" ? "srCard4" : "s4c-" + id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }));
  host.querySelectorAll("[data-s4map]").forEach((b) => b.addEventListener("click", () => { mapMode = b.dataset.s4map; host.querySelectorAll("[data-s4map]").forEach((x) => x.classList.toggle("on", x === b)); paintRack(true); }));
  $("s4JobF").querySelectorAll("select").forEach((s) => s.addEventListener("change", () => { jobF[s.dataset.f] = s.value; renderJobs(); }));
  $("s4CntRun").addEventListener("click", () => { const c = runCount(Math.max(1, Math.round(countPlan().perDay))); $("s4CntInfo").textContent = `${c.id}: ${c.n} crates counted, ${c.n - c.ok} deviation(s)`; renderCount(); });

  buildLand(); buildRack();
  buildErp($("s4Erp"));
  if (!W.counts.length) runCount(40);            // a first count so the accuracy KPI has data (simulated)
  try { makeCard({ drawings: CARD.drawings, groups: CARD.groups, shopCols: CARD.shopCols, shop: CARD.shop, shopM: 1, shopP: 5, guides: CARD.guides, shopTab: "Shopping list – WMS layer",
    ph: CARD.ph, buyNote: CARD.price, shopLbl: "shopping list", shopTitle: CARD.shopTitle, shopNote: CARD.shopNote, shopPrice: true, shopW: [5, 22, 9, 26, 26, 12] },
  host, { card: "srCard4", q: "srQ4", g: "srG4", cnt: "srCnt4", buy: "srBuy4" }, "sr4"); } catch (e) { console.error(e); }
  if (Q.get("sr4slot") && sim.byId.get(Q.get("sr4slot"))) selSlot = sim.byId.get(Q.get("sr4slot"));
  if (Q.get("sr4only")) { const keep = Q.get("sr4only").split(",").map((x) => (x === "srCard4" ? "srCard4" : "s4c-" + x)); // test only: headless screenshots of chosen cards
    host.querySelectorAll(".card").forEach((c) => { if (c.id && !keep.includes(c.id)) c.style.display = "none"; }); }
  update(true);
  if (Q.get("sr4card")) setTimeout(() => { const id = Q.get("sr4card"); const el = $(id === "srCard4" ? "srCard4" : "s4c-" + id); if (el) el.scrollIntoView({ block: "start" }); }, 400);
  if (Q.has("sr4test")) setTimeout(selfTest, +Q.get("sr4test") || 3000);
}

/* ================================================================ landscape */
const BOX = { ERP: [180, 30, 320, 58], MES: [260, 150, 240, 58], WMS: [180, 270, 320, 58], WCS: [260, 390, 240, 58], PLC: [260, 500, 240, 58],
  SUP: [690, 30, 250, 58], LINE: [690, 150, 250, 58], PRT: [690, 270, 250, 58], IDP: [690, 390, 250, 58] };
const ARR = [ // id, x1,y1,x2,y2, label x,y
  ["po", 500, 50, 690, 50, 595, 44], ["asn", 690, 72, 500, 72, 595, 86],
  ["sched", 300, 88, 300, 150, 300, 120], ["perf", 360, 150, 360, 88, 360, 120],
  ["inb", 205, 88, 205, 270, 205, 175], ["gm", 235, 270, 235, 88, 235, 215],
  ["call", 330, 208, 330, 270, 330, 240], ["deliv", 440, 270, 440, 208, 440, 240],
  ["to", 300, 328, 300, 390, 300, 360], ["tc", 380, 390, 380, 328, 380, 360], ["life", 460, 390, 460, 328, 460, 360],
  ["plc", 330, 448, 330, 500, 330, 474], ["scan", 690, 419, 500, 419, 595, 412],
];
const SHORT = { po: "ORDERS", asn: "DESADV", inb: "INB", sched: "SCHED", perf: "PERF", call: "CALL", deliv: "DELIV", gm: "GM", to: "TO", tc: "TC", life: "LS", plc: "JOB", scan: "SCAN" };
function buildLand() {
  const sys = Object.entries(BOX).map(([k, [x, y, w, h]]) => { const S = SYSTEMS[k];
    return `<g class="s4-sys" data-sys="${k}" tabindex="0" role="button" aria-label="${esc(S.t)}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>
      <text x="${x + 10}" y="${y + 20}" class="s4-st">${esc(S.t)}</text><text x="${x + 10}" y="${y + 36}" class="s4-ss">${esc(S.s)}</text><text x="${x + 10}" y="${y + 50}" class="s4-sh">${esc(S.host.split(" ")[0])}</text></g>`; }).join("");
  const arr = ARR.map(([id, x1, y1, x2, y2, lx, ly]) => `<g class="s4-msg" data-msg="${id}" tabindex="0" role="button" aria-label="${esc(SHORT[id])}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#s4ar)"/>
      <rect x="${lx - 34}" y="${ly - 10}" width="68" height="18" rx="9"/><text x="${lx}" y="${ly + 3}" text-anchor="middle"><tspan class="s4-mt">${SHORT[id]}</tspan> <tspan data-cnt="${id}">0</tspan></text></g>`).join("");
  $("s4LandSvg").innerHTML = `<svg viewBox="0 0 960 580" class="s4-landsvg" role="img" aria-label="system landscape">
    <defs><marker id="s4ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="s4-arh"/></marker></defs>
    <text x="10" y="64" class="s4-lv">L4</text><text x="10" y="184" class="s4-lv">L3</text><text x="10" y="304" class="s4-lv">L3</text><text x="10" y="424" class="s4-lv">L2</text><text x="10" y="530" class="s4-lv">L1</text>
    <line x1="690" y1="178" x2="500" y2="178" class="s4-phys" marker-end="url(#s4ar)"/><text x="595" y="172" text-anchor="middle" class="s4-ss">kanban signal (OPC UA)</text>
    <line x1="690" y1="298" x2="500" y2="298" class="s4-phys" marker-start="url(#s4ar)"/><text x="595" y="292" text-anchor="middle" class="s4-ss">crate label print job</text>
    <path d="M500,529 L600,529 L600,568 L815,568 L815,208" class="s4-phys" marker-end="url(#s4ar)"/><text x="700" y="561" text-anchor="middle" class="s4-ss">crate: outfeed → AGV → line (material)</text>
    ${sys}${arr}</svg>`;
  $("s4LandSvg").querySelectorAll("[data-sys]").forEach((g) => { const f = () => { selSys = g.dataset.sys; selMsg = null; renderLandDet(); }; g.addEventListener("click", f); g.addEventListener("keydown", (e) => { if (e.key === "Enter") f(); }); });
  $("s4LandSvg").querySelectorAll("[data-msg]").forEach((g) => { const f = () => { selMsg = g.dataset.msg; selSys = null; renderLandDet(); }; g.addEventListener("click", f); g.addEventListener("keydown", (e) => { if (e.key === "Enter") f(); }); });
  $("s4MsgT").addEventListener("click", (e) => { const b = e.target.closest("[data-showmsg]"); if (b) { selMsg = b.dataset.showmsg; selSys = null; renderLandDet(); $("s4LandDet").scrollIntoView({ block: "nearest" }); } });
}
function renderLand() {
  $("s4LandSvg").querySelectorAll("[data-cnt]").forEach((t) => { t.textContent = W.cnt[t.dataset.cnt]; });
  $("s4LandSvg").querySelectorAll("[data-msg]").forEach((g) => g.classList.toggle("on", g.dataset.msg === selMsg));
  $("s4LandSvg").querySelectorAll("[data-sys]").forEach((g) => g.classList.toggle("on", !!(g.dataset.sys === selSys || (selMsg && MSGS.find((m) => m.id === selMsg && (m.from === g.dataset.sys || m.to === g.dataset.sys))))));
  $("s4MsgT").innerHTML = `<tr><th>Code</th><th>From → to</th><th>Message</th><th>Protocol (example)</th><th class="num">Count</th><th></th></tr>` +
    MSGS.map((m) => `<tr${m.id === selMsg ? ' class="s4-hit"' : ""}><td><b>${SHORT[m.id]}</b></td><td>${SYSTEMS[m.from].t} → ${SYSTEMS[m.to].t}</td><td>${esc(m.name)}</td><td>${esc(m.proto)}</td><td class="num">${W.cnt[m.key]}</td><td><button class="chip" data-showmsg="${m.id}">example</button></td></tr>`).join("");
}
function renderLandDet() {
  const d = $("s4LandDet");
  if (selSys) { const S = SYSTEMS[selSys];
    d.innerHTML = `<h3>${esc(S.t)} <small>${esc(S.s)}</small></h3><table class="s4-kv"><tr><td>Host name</td><td><code>${esc(S.host)}</code></td></tr><tr><td>IP</td><td><code>${esc(S.ip)}</code></td></tr>
      <tr><td>Owns</td><td>${esc(S.own)}</td></tr></table><p>${esc(S.note)}</p><p class="muted">Messages: ${MSGS.filter((m) => m.from === selSys || m.to === selSys).map((m) => SHORT[m.id] + " " + W.cnt[m.key]).join(" · ") || "physical only"}</p>`;
    renderLand(); return; }
  const m = MSGS.find((x) => x.id === selMsg) || MSGS[8]; const pl = payload(m.id);
  d.innerHTML = `<h3>${SHORT[m.id]} – ${esc(m.name)}</h3><p class="muted">${SYSTEMS[m.from].t} → ${SYSTEMS[m.to].t} · ${esc(m.proto)} · count <b>${W.cnt[m.key]}</b></p>
    <pre class="s4-pre">${esc(pl.text)}</pre>${pl.note ? `<p class="s4-f">${pl.note}</p>` : ""}`;
  renderLand();
}
/** example payload with live values (WMS / WCS side here; ERP / MES ones in asrswms_erp.js) */
function payload(id) {
  const j = W.last[id] && W.last[id].type ? W.last[id] : null;
  if (id === "to" || id === "plc") { const tg = telegramTO(W.last.to);
    if (id === "plc") { const L = W.last.plc && W.lots.get(W.last.plc.id); const jj = W.last.plc;
      return { text: `OPC UA write  ns=3;s="DB_WCS_Job"   (or PROFINET / S7 data block DB100)\n  JobId        : "${jj ? jj.id : "-"}"\n  JobType      : ${jj && jj.type === "store" ? 1 : 2}            // 1 store, 2 retrieve\n  SrcX_mm      : ${jj && jj.type === "retrieve" && jj.slot ? Math.round(jj.slot.x * 1000) : 0}\n  SrcZ_mm      : ${jj && jj.type === "retrieve" && jj.slot ? Math.round(jj.slot.z * 1000) : 750}\n  DstX_mm      : ${jj && jj.type === "store" && jj.slot ? Math.round(jj.slot.x * 1000) : 0}\n  DstZ_mm      : ${jj && jj.type === "store" && jj.slot ? Math.round(jj.slot.z * 1000) : 750}\n  Side         : ${jj && jj.slot ? (jj.slot.side === "L" ? -1 : 1) : 0}             // -1 left, +1 right\n  HU           : "${L ? crateOf(L.lot) : "-"}"\n  WeightKg     : ${L ? L.kg : 0}\n  Handshake    : NewJob=TRUE → PLC: JobAccepted=TRUE → … → JobDone=TRUE, WCS resets NewJob`,
        note: "The PLC gets coordinates and the handling unit – never the item or the lot. Handshake bits with a time-out (e.g. 5 s) – no answer = alarm, the WCS does not resend blindly." }; }
    return { text: tg.raw + "\n\n" + tg.fields.map(([k, v]) => k.padEnd(12) + ": " + v).join("\n"), note: "Fixed-length ASCII telegram over TCP/IP (field layout = drawing 34_telegram_format). The sequence number lets the WCS detect a lost or doubled telegram; every telegram is acknowledged." }; }
  if (id === "tc") { const t = telegramTC(W.last.tc); return { text: t.raw + "\n\nstatus " + t.code + "\n\nStatus codes:\n" + TC_CODES.map(([c, x]) => `  ${c}  ${x}`).join("\n"), note: "The WMS books the stock movement only after TC with status 00. Errors keep the job open for a planner decision." }; }
  if (id === "life") return { text: `<STX>LS${pad(W.cnt.life % 100000, 5)}WCS1WMS1${isoT(sim.t).replace(/[-:TZ]/g, "").slice(0, 14)}<ETX>\n\nsent every 10 s by each side; 3 missing life signs (30 s) = link down → WMS stops sending orders, WCS finishes the active job and stops.`, note: "" };
  if (id === "scan") { const jj = W.last.scan, L = jj && W.lots.get(jj.id);
    return { text: `<STX>ID${pad(W.cnt.scan % 100000, 5)}IDP1WCS1${(L ? crateOf(L.lot) : "NOREAD").padEnd(10)}${L ? "0" + ssccOf(L.lot) : "".padEnd(19, "0")}${jj && jj.state === "failed" ? "11" : "00"}C${jj && jj.state === "failed" ? "?" : "1"}W${pad(L ? L.kg : 0, 4)}<ETX>\n\nRFID EPC (GRAI-96 of the crate) + barcode ${L ? "(00)" + ssccOf(L.lot) : "no-read"}\ncontour check: ${jj && jj.state === "failed" ? "not reached" : "OK"} · weight ${L ? L.kg + " kg" : "-"} (limit 300 kg)\nresult: ${jj && jj.state === "failed" ? "NO-READ → reject lane, TC status 11" : "accepted → WMS assigns slot"}`, note: "Two technologies (RFID + barcode) at the ID point: a single no-read must not stop the infeed." }; }
  const e = payloadErp(id, j); if (e) return e;
  return { text: "-", note: "" };
}

/* ================================================================ rack map */
const MX0 = 60, MW = 880, mx = (x) => MX0 + (x - RACK.x0) / RACK.length * MW, CW = 0.8 / RACK.length * MW, RH = 17, TOPL = 26, TOPR = TOPL + 7 * RH + 44;
const ry = (side, lev) => (side === "L" ? TOPL : TOPR) + (6 - lev) * RH;
function buildRack() {
  const cells = sim.slots.map((s) => `<rect class="s4-cell" data-slot="${s.id}" x="${(mx(s.x) - CW / 2).toFixed(1)}" y="${ry(s.side, s.level) + 1}" width="${(CW - 1).toFixed(1)}" height="${RH - 2}"/>`).join("");
  const bays = Array.from({ length: RACK.bays }, (_, b) => `<text x="${mx(RACK.x0 + 0.1 + b * RACK.bayPitch + RACK.bayPitch / 2).toFixed(1)}" y="${TOPR + 7 * RH + 13}" text-anchor="middle" class="s4-ax">${b + 1}</text>`).join("");
  const levs = [0, 1, 2, 3, 4, 5, 6].map((l) => `<text x="${MX0 - 6}" y="${ry("L", l) + 12}" text-anchor="end" class="s4-ax">L${l + 1}</text><text x="${MX0 - 6}" y="${ry("R", l) + 12}" text-anchor="end" class="s4-ax">L${l + 1}</text>`).join("");
  $("s4Rack").innerHTML = `<svg viewBox="0 0 960 ${TOPR + 7 * RH + 20}" class="s4-racksvg" role="img" aria-label="rack occupancy map">
    <text x="${MX0}" y="16" class="s4-ss">Side L (aisle view) · slots S01 … S28 counted from the I/O point (left)</text>
    <text x="${MX0}" y="${TOPR - 6}" class="s4-ss">Side R (aisle view)</text>
    <rect x="${MX0 - 40}" y="${TOPL + 7 * RH + 6}" width="${MW + 44}" height="20" class="s4-aisle"/>
    <text x="${MX0 - 36}" y="${TOPL + 7 * RH + 20}" class="s4-ax">I/O</text>
    <g id="s4Crane"><rect x="0" y="${TOPL + 7 * RH + 4}" width="10" height="24" rx="2" class="s4-crane"/></g>
    ${levs}${bays}${cells}<rect id="s4Sel" x="-50" y="-50" width="${CW + 3}" height="${RH + 1}" class="s4-sel"/></svg>`;
  $("s4Rack").addEventListener("click", (e) => { const c = e.target.closest("[data-slot]"); if (c) { selSlot = sim.byId.get(c.dataset.slot); renderSlot(); paintRack(true); } });
}
const AGE_C = ["#d6e6f7", "#a9c9ee", "#78a8e2", "#4b86cf", "#2a63b0", "#173f7a"];
const ZC = { A: "#2a78d6", B: "#9a7b2f", C: "#898781" };
const CATC = { free: "#0ca30c", reserved: "#2a78d6", qi: "#fab219", blocked: "#d03b3b" };
let lastPaint = {};
function cellStyle(s) {
  const z = ZONE.get(s.id);
  if (!s.load) { if (mapMode === "abc") return [ZC[z], 0.13, ""]; return [s.blocked ? "#d03b3b" : "none", s.blocked ? 0.35 : 0, s.reserved ? "res" : ""]; }
  if (mapMode === "sku") return [SKU[s.load.sku].color, 1, s.reserved ? "res" : s.blocked ? "blk" : ""];
  if (mapMode === "age") { const h = ageOf(s) / 3600; return [AGE_C[Math.min(5, Math.floor(h / 2))], 1, s.blocked ? "blk" : ""]; }
  if (mapMode === "abc") { const c = ABC_MOVES[s.load.sku]; return [ZC[c], c === z ? 0.95 : 0.5, c === z ? "" : "mis"]; }
  const c = catOf(s); return [CATC[c] || "#898781", 1, ""];
}
function paintRack(force) {
  if (force) lastPaint = {};
  const svg = $("s4Rack"); if (!svg) return;
  const cells = svg.querySelectorAll("[data-slot]");
  cells.forEach((el) => { const s = sim.byId.get(el.dataset.slot); const [f, o, cls] = cellStyle(s); const key = f + o + cls;
    if (lastPaint[s.id] !== key) { lastPaint[s.id] = key; el.setAttribute("fill", f); el.setAttribute("fill-opacity", o); el.setAttribute("class", "s4-cell" + (cls ? " " + cls : "")); } });
  const cr = $("s4Crane"); if (cr) cr.setAttribute("transform", `translate(${(mx(Math.max(-1.2, sim.crane.x)) - 5).toFixed(1)},0)`);
  const sel = $("s4Sel"); if (sel && selSlot) { sel.setAttribute("x", (mx(selSlot.x) - CW / 2 - 2).toFixed(1)); sel.setAttribute("y", ry(selSlot.side, selSlot.level)); }
  const leg = { sku: SKUS.map((k) => `<span>${dot(k)}${MAT[k].item}</span>`).join("") + `<span><i class="s4-dot res"></i>reserved (job running)</span><span><i class="s4-dot blk"></i>blocked</span>`,
    age: AGE_C.map((c, i) => `<span><i class="s4-dot" style="background:${c}"></i>${i * 2}–${i * 2 + 2} h${i === 5 ? "+" : ""}</span>`).join("") + `<span class="muted">initial stock: in-date spread over the 10 h before start (example)</span>`,
    abc: ["A", "B", "C"].map((z) => `<span><i class="s4-dot" style="background:${ZC[z]}"></i>zone / class ${z}</span>`).join("") + `<span class="muted">pale empty cell = zone; full colour = load of the matching class; striped = class does not match its zone</span>`,
    cat: Object.entries(CATC).map(([k, c]) => `<span><i class="s4-dot" style="background:${c}"></i>${{ free: "unrestricted", reserved: "reserved (retrieval running)", qi: "quality inspection", blocked: "blocked" }[k]}</span>`).join("") };
  $("s4Legend").innerHTML = leg[mapMode];
  const occ = sim.slots.filter((s) => s.load).length;
  $("s4MapInfo").textContent = `${occ} / ${sim.slots.length} slots full (${(occ / sim.slots.length * 100).toFixed(0)} %) · crane ${sim.crane.phase} at x = ${sim.crane.x.toFixed(1)} m`;
}
function renderSlot() {
  const d = $("s4Slot"), s = selSlot;
  if (!s) { d.innerHTML = `<h3>Slot detail</h3><p class="muted">Click a slot in the rack map.</p>`; return; }
  const z = ZONE.get(s.id), sc = SC_OF.get(s.id);
  let h = `<h3>${locOf(s)} <small>twin ${s.id}</small></h3><table class="s4-kv"><tr><td>Zone / single cycle</td><td>${z} · ${sc.toFixed(1)} s · x ${s.x.toFixed(2)} m, z ${s.z.toFixed(2)} m</td></tr>`;
  if (!s.load) { h += `<tr><td>Content</td><td>${s.reserved ? "reserved for put-away " + s.reserved : s.blocked ? "empty, blocked" : "empty"}</td></tr></table>`; d.innerHTML = h; return; }
  const L = s.load, k = L.sku, c = catOf(s), hd = W.holds.get(s.id);
  h += `<tr><td>Material</td><td>${dot(k)}<b>${MAT[k].item}</b> – ${esc(MAT[k].desc)}</td></tr>
    <tr><td>Quantity</td><td>${L.qty} pcs · ${L.kg} kg gross (crate 45 kg)</td></tr>
    <tr><td>Lot</td><td>twin <code>${esc(L.lot)}</code> = <code>${realLot(k, L.lot)}</code></td></tr>
    <tr><td>Handling unit</td><td><code>${crateOf(L.lot)}</code> · SSCC <code>(00)${ssccOf(L.lot)}</code></td></tr>
    <tr><td>In-date / age</td><td>${clock(inDateOf(s))} · ${dur(ageOf(s))}</td></tr>
    <tr><td>Supplier</td><td>${MAT[k].supplier} · batch ${batchOf(L.lot)} · heat ${heatOf(L.lot)} · ${poOf(L.lot)}</td></tr>
    <tr><td>Inspection</td><td>${c === "qi" ? `<span class="st-chip s-warn">in inspection (sample, ${PLAN.qiMin} min)</span>` : c === "blocked" ? `<span class="st-chip s-bad">blocked – ${esc(hd ? hd.reason : "by item 2 / fault")}</span>` : `<span class="st-chip s-good">released (3.1 certificate OK)</span>`}</td></tr>
    <tr><td>Category</td><td>${c}${s.reserved ? " – job " + s.reserved : ""}</td></tr></table>
    <div class="s4-bar">${s.blocked ? (hd ? `<button class="btn" id="s4Rel">Release from hold</button>` : "") : `<button class="btn warn" id="s4Hold">Put on quality hold</button>`}</div>`;
  d.innerHTML = h;
  const b1 = $("s4Hold"), b2 = $("s4Rel");
  if (b1) b1.addEventListener("click", () => { hold(s, true); renderSlot(); paintRack(true); renderCount(); });
  if (b2) b2.addEventListener("click", () => { hold(s, false); renderSlot(); paintRack(true); renderCount(); });
}

/* ================================================================ stock table, slotting, flows, counts, jobs */
function renderStock() {
  const st = stockTable(); let T = { loads: 0, pcs: 0, kg: 0, value: 0 };
  const rows = SKUS.map((k) => { const r = st[k], p = P[k]; T.loads += r.loads; T.pcs += r.pcs; T.kg += r.kg; T.value += r.value;
    const cls = r.cov < MAT[k].lt ? "s-bad" : r.pcs < p.rop ? "s-warn" : "s-good";
    return `<tr><td>${dot(k)}<b>${MAT[k].item}</b><br><span class="muted">${esc(SKU[k].name)}</span></td><td class="num">${r.loads}</td><td class="num">${n0(r.pcs)}</td><td class="num">${n0(r.kg)}</td><td class="num">${money(r.value)}</td>
      <td class="num">${n1(p.d)}</td><td class="num"><b>${n1(r.cov)} h</b></td><td class="num">${MAT[k].lt} h</td><td class="num">${n0(p.rop)}</td><td><span class="st-chip ${cls}">${cls === "s-bad" ? "cover < lead time" : cls === "s-warn" ? "below ROP – order" : "OK"}</span></td>
      <td class="num">${r.oldest ? dur(ageOf(r.oldest)) : "–"}</td></tr>`; }).join("");
  $("s4StockT").innerHTML = `<tr><th>Material</th><th class="num">Loads</th><th class="num">Pieces</th><th class="num">kg gross</th><th class="num">Value</th><th class="num">Line demand pcs/h</th><th class="num">Coverage</th><th class="num">Lead time</th><th class="num">ROP pcs</th><th>Status</th><th class="num">Oldest crate</th></tr>${rows}
    <tr class="s4-sum"><td>Total</td><td class="num">${T.loads}</td><td class="num">${n0(T.pcs)}</td><td class="num">${n0(T.kg)}</td><td class="num">${money(T.value)}</td><td colspan="6" class="muted">fill ${(T.loads / RACK.slots * 100).toFixed(0)} % · stored mass ${(T.kg / 1000).toFixed(1)} t of ${(RACK.slots * 0.3).toFixed(0)} t design</td></tr>`;
}
function renderSlotting() {
  const r = slotting(), gain = (1 - r.abc / r.cur) * 100;
  $("s4SlotK").innerHTML = [["Random slot (mean of all 392)", r.rnd.toFixed(1) + " s", "single cycle, uniform"], ["Current layout (sim: closest free slot)", r.cur.toFixed(1) + " s", "weighted by retrieval rate"],
    ["ABC by COI (re-slotted)", r.abc.toFixed(1) + " s", `${gain >= 0 ? "−" : "+"}${Math.abs(gain).toFixed(0)} % vs current`], ["Class-A loads in zone A", (r.aShare * 100).toFixed(0) + " %", "cylinders + crankshafts"]]
    .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`).join("");
  $("s4CoiT").innerHTML = `<tr><th>Rank</th><th>Material</th><th class="num">Loads (slots)</th><th class="num">Retrievals/h (line)</th><th class="num">COI = slots ÷ retr./h</th><th class="num">Slots get SC</th></tr>` +
    r.zones.map((z, i) => `<tr><td>${i + 1}</td><td>${dot(z.k)}${MAT[z.k].item} <span class="muted">(${ABC_MOVES[z.k]})</span></td><td class="num">${z.n}</td><td class="num">${P[z.k].loadsPerH.toFixed(2)}</td><td class="num">${z.coi.toFixed(1)}</td><td class="num">${z.from.toFixed(0)} – ${z.to.toFixed(0)} s</td></tr>`).join("");
}
function flowStep(t, v, n, cls = "") { return `<div class="s4-step ${cls}"><div class="s4-sh2">${t}</div><div class="s4-sv">${v}</div><div class="s4-sn">${n}</div></div>`; }
function renderFlows() {
  const q = sim.queue, dn = sim.done, f = sim.faults;
  const stQ = q.filter((j) => j.type === "store" && j.state === "queued").length, stA = q.filter((j) => j.type === "store" && j.state === "active").length;
  const noRead = dn.filter((j) => j.type === "store" && j.state === "failed").length, stored = sim.stats.stores;
  const qi = sim.slots.filter((s) => catOf(s) === "qi").length;
  const k = kpis();
  $("s4GR").innerHTML = [flowStep("1 ASN / delivery", W.cnt.asn, "deliveries announced (EDI DESADV)"), flowStep("2 Unload + label", sim.inConv.length, "crates on the infeed conveyor"),
    flowStep("3 ID point", f.scanner ? "NO-READ" : "OK", `RFID + barcode, contour, weight · rejects ${noRead}`, f.scanner ? "bad" : ""), flowStep("4 Quality check", qi, `crates in inspection (sample ISO 2859-1, ${PLAN.qiMin} min)`),
    flowStep("5 Putaway job", `${stQ} + ${stA}`, "queued + active store jobs"), flowStep("6 In stock", stored, `stored · dock-to-stock ${dur(k.d2s)}`)].join('<span class="s4-arr">→</span>');
  const rQ = q.filter((j) => j.type === "retrieve" && j.state === "queued").length, rA = q.filter((j) => j.type === "retrieve" && j.state === "active").length;
  const noStock = dn.filter((j) => j.type === "retrieve" && j.state === "failed").length;
  $("s4GI").innerHTML = [flowStep("1 MES call-off", W.cnt.call, `line / MES call-offs · sim demand ${sim.rates.retrievePerH}/h`),
    flowStep("2 WMS slot choice", "FIFO", "oldest lot, then shortest move · no stock " + noStock), flowStep("3 Retrieval job", `${rQ} + ${rA}`, "queued + active"),
    flowStep("4 Crane", sim.estop ? "E-STOP" : f.crane ? "FAULT" : sim.crane.phase, `cycle ${dur(k.avgCycle)} · util ${(k.util * 100).toFixed(0)} %`, sim.estop || f.crane ? "bad" : ""),
    flowStep("5 Outfeed", sim.outConv.length, "crates on the outfeed (30 s)"), flowStep("6 Line", sim.stats.retrievals, `delivered · OTIF ${k.otif == null ? "–" : (k.otif * 100).toFixed(0) + " %"}`)].join('<span class="s4-arr">→</span>');
  $("s4Samp").innerHTML = `<tr><th>Material</th><th class="num">Delivery lot (pcs)</th><th>Code letter</th><th class="num">Sample n</th><th class="num">Ac / Re</th><th>Check</th></tr>` +
    SKUS.map((k2) => { const s = sampling(MAT[k2].lot); return `<tr><td>${MAT[k2].item}</td><td class="num">${MAT[k2].lot}</td><td>${s.letter}${s.use !== s.letter ? " → " + s.use : ""}</td><td class="num">${s.n}</td><td class="num">${s.ac} / ${s.re}</td><td>visual, key dimensions, hardness; 3.1 certificate vs. heat</td></tr>`; }).join("");
  $("s4Rec").innerHTML = `<tr><th>GR</th><th>PO</th><th>Material</th><th class="num">Crates</th><th>Time</th><th>Jobs</th></tr>` + (W.receipts.length ? W.receipts.slice(0, 12).map((g) =>
    `<tr><td>${g.id}</td><td>${g.po}</td><td>${MAT[g.sku].item}</td><td class="num">${g.crates}</td><td>${clock(g.t)}</td><td>${g.jobs.map((id) => { const j = sim.done.find((x) => x.id === id) || sim.queue.find((x) => x.id === id); return j ? j.state[0] : "?"; }).join("")}</td></tr>`).join("")
    : `<tr><td colspan="6" class="muted">No ERP delivery posted yet – use "Post inbound delivery" in the ERP MRP card. Sim deliveries (auto) arrive as single crates (${sim.rates.storePerH}/h).</td></tr>`);
}
function renderCount() {
  const cp = countPlan();
  $("s4CntPlan").innerHTML = `<tr><th>Material</th><th>Class (moves)</th><th class="num">Loads</th><th class="num">Counts / slot / year</th><th class="num">Counts / year</th></tr>` +
    cp.rows.map((r) => `<tr><td>${dot(r.k)}${MAT[r.k].item}</td><td>${r.cls}</td><td class="num">${r.loads}</td><td class="num">${r.freq}</td><td class="num">${r.perYear}</td></tr>`).join("") +
    `<tr class="s4-sum"><td colspan="4">Total – ${cp.perYear} counts / 250 working days</td><td class="num">${cp.perDay.toFixed(1)} / day</td></tr>`;
  const tot = W.counts.reduce((a, c) => a + c.n, 0), ok = W.counts.reduce((a, c) => a + c.ok, 0);
  $("s4CntLog").innerHTML = `<tr><th>Count</th><th>Time</th><th class="num">Crates</th><th class="num">OK</th><th>Deviations (book difference after recount)</th></tr>` +
    W.counts.map((c) => `<tr><td>${c.id}</td><td>${clock(c.t)}</td><td class="num">${c.n}</td><td class="num">${c.ok}</td><td>${c.dev.map((d) => `${d.loc}: system ${d.sys}, counted ${d.cnt}`).join("; ") || "none"}</td></tr>`).join("") +
    `<tr class="s4-sum"><td colspan="5">stock accuracy = correct crates ÷ counted crates = ${ok} ÷ ${tot} = ${tot ? (ok / tot * 100).toFixed(2) : "–"} % (target ≥ 99.5 %)</td></tr>`;
  const cats = { free: [0, 0], reserved: [0, 0], qi: [0, 0], blocked: [0, 0] };
  sim.slots.forEach((s) => { const c = catOf(s); if (cats[c]) { cats[c][0]++; cats[c][1] += s.load.qty * MAT[s.load.sku].price; } });
  $("s4Cat").innerHTML = `<tr><th>Category</th><th>Meaning</th><th class="num">Crates</th><th class="num">Value</th></tr>` + [["free", "unrestricted – can be called off"], ["reserved", "reserved – retrieval job running"], ["qi", "quality inspection – new receipt, sample open"], ["blocked", "blocked – quality hold / NCR / fault"]]
    .map(([k, t]) => `<tr><td><i class="s4-dot" style="background:${CATC[k]}"></i>${k}</td><td>${t}</td><td class="num">${cats[k][0]}</td><td class="num">${money(cats[k][1])}</td></tr>`).join("");
  const bl = sim.slots.filter((s) => s.blocked);
  $("s4Hold").innerHTML = `<tr><th>Location</th><th>Material</th><th>Lot</th><th>Reason</th><th>Since</th></tr>` + (bl.length ? bl.map((s) => { const h = W.holds.get(s.id);
    return `<tr><td>${locOf(s)}</td><td>${s.load ? MAT[s.load.sku].item : "empty"}</td><td>${s.load ? realLot(s.load.sku, s.load.lot) : "–"}</td><td>${esc(h ? h.reason : "blocked from item 2 / fault")}</td><td>${h ? clock(h.t) : "–"}</td></tr>`; }).join("")
    : `<tr><td colspan="5" class="muted">no blocked slots</td></tr>`);
}
function renderJobs() {
  const all = sim.queue.slice().reverse().concat(sim.done);
  const f = all.filter((j) => (!jobF.type || j.type === jobF.type) && (!jobF.state || j.state === jobF.state) && (!jobF.sku || j.sku === jobF.sku) &&
    (!jobF.src || (jobF.src === "auto" ? j.src === "auto" : jobF.src === "line" ? j.src === "line" : String(j.src).startsWith(jobF.src))));
  $("s4JobN").textContent = `${f.length} of ${all.length} jobs · queue ${sim.queue.length}`;
  $("s4Jobs").innerHTML = `<tr><th>Job</th><th>Type</th><th>Material</th><th class="num">Qty</th><th>Slot</th><th>Source</th><th>Requested</th><th class="num">Wait</th><th class="num">Cycle</th><th>State</th></tr>` +
    (f.length ? f.slice(0, 80).map((j) => `<tr><td>${j.id}</td><td>${j.type}</td><td>${dot(j.sku)}${MAT[j.sku].item}</td><td class="num">${j.qty}</td><td>${j.slot ? locOf(j.slot) : "–"}</td><td>${esc(j.src)}</td><td>${clock(j.tReq)}</td>
      <td class="num">${j.tStart != null ? dur(j.tStart - j.tReq) : dur(sim.t - j.tReq)}</td><td class="num">${j.tEnd != null ? dur(j.tEnd - j.tStart) : "–"}</td>
      <td><span class="st-chip ${{ queued: "s-idle", active: "s-good", done: "s-done", failed: "s-bad" }[j.state]}">${j.state}${j.err ? ": " + esc(j.err) : ""}</span></td></tr>`).join("") : `<tr><td colspan="10" class="muted">no job matches the filter</td></tr>`);
}
function renderLive() {
  const k = kpis(), f = sim.faults, fl = Object.entries(f).filter(([, v]) => v).map(([n]) => n);
  $("s4Live").innerHTML = `<span><b>Twin time</b> ${clock(sim.t)} (${isoT(sim.t)})</span><span><b>Crane</b> ${sim.estop ? '<span class="st-chip s-bad">E-STOP</span>' : esc(sim.crane.phase)}</span>
    <span><b>Queue</b> ${k.qStore} store · ${k.qRetr} retrieve</span><span><b>Fill</b> ${(k.fill * 100).toFixed(0)} %</span><span><b>Stock value</b> ${money(k.value)}</span>
    <span><b>Faults</b> ${fl.length ? fl.map((x) => `<span class="st-chip s-bad">${esc(x)}</span>`).join(" ") : "none"}</span><span class="muted">all values are examples</span>`;
}

/* ================================================================ update loop */
let tick = 0;
function update(force) {
  if (!built || (!force && !visible())) return;
  try {
    tick++;
    renderLive(); paintRack(force);
    if (force || tick % 2 === 0) { renderLand(); renderStock(); renderFlows(); renderJobs(); updateErp(force); if (selMsg && !selSys) renderLandDet(); }
    if (force || tick % 5 === 0) { renderSlotting(); renderCount(); renderSlot(); }
    if (force) renderLandDet();
  } catch (e) { console.error(e); }
}
setInterval(() => update(false), 1000);

/* ================================================================ self-check (&sr4test) */
function selfTest() {
  const log = (s) => console.log("SR4TEST " + s);
  const st = stockTable(), k = kpis(), sl = slotting();
  log(`build ok=${built} cards=${host.querySelectorAll(":scope > .card").length} srCard4=${!!$("srCard4")} last=${host.lastElementChild && host.lastElementChild.id} cells=${host.querySelectorAll("[data-slot]").length}`);
  log(`params CC20 d=${P.RAW_CC.d.toFixed(2)}/h SS=${P.RAW_CC.ss.toFixed(1)} ROP=${P.RAW_CC.rop.toFixed(1)} EOQ=${P.RAW_CC.eoq.toFixed(1)} (expect 8.60, 62.4, 200.0, 246.2) · CYL SS=${P.RAW_CYL.ss.toFixed(1)} ROP=${P.RAW_CYL.rop.toFixed(1)} EOQ=${P.RAW_CYL.eoq.toFixed(1)} (expect 249.6, 800.0, 861.5)`);
  const tot = SKUS.reduce((a, x) => a + st[x].loads, 0), fill = sim.slots.filter((s) => s.load).length;
  log(`stock loads=${tot} slotsFull=${fill} match=${tot === fill} CC20 loads=${st.RAW_CC.loads} pcs=${st.RAW_CC.pcs} (=4×loads ${st.RAW_CC.pcs === 4 * st.RAW_CC.loads}) value=${Math.round(st.RAW_CC.value)} (=95×pcs ${Math.round(st.RAW_CC.value) === 95 * st.RAW_CC.pcs}) cov=${st.RAW_CC.cov.toFixed(1)} h (=pcs/8.6 ${(st.RAW_CC.pcs / 8.6).toFixed(1)})`);
  log(`ids loc(L-01-1-1)=${locOf(sim.byId.get("L-01-1-1"))} loc(R-14-2-7)=${locOf(sim.byId.get("R-14-2-7"))} sscc(L4123)=${ssccOf("L4123")} gs1(09521234500001234)=${"09521234500001234" + (function () { let s = 0; const d = "09521234500001234"; for (let i = 0; i < d.length; i++) s += (+d[d.length - 1 - i]) * (i % 2 === 0 ? 3 : 1); return (10 - s % 10) % 10; })()} (expect …49)`);
  log(`slotting rnd=${sl.rnd.toFixed(1)} s cur=${sl.cur.toFixed(1)} s abc=${sl.abc.toFixed(1)} s aInA=${(sl.aShare * 100).toFixed(0)} % · FEM SC=${A.fem.sc.toFixed(1)} s`);
  log(`kpi t=${sim.t.toFixed(0)} s jobs/h=${k.jobsPerH.toFixed(1)} util=${(k.util * 100).toFixed(1)} % retr/h=${k.retrPerH.toFixed(1)} otif=${k.otif == null ? "-" : (k.otif * 100).toFixed(0)} % accuracy=${k.accuracy == null ? "-" : (k.accuracy * 100).toFixed(2)} % turns=${k.turns ? k.turns.toFixed(0) : "-"} counters to=${W.cnt.to} tc=${W.cnt.tc} gm=${W.cnt.gm} life=${W.cnt.life}`);
  const s4 = sampling(120), s5 = sampling(240); log(`ISO2859 lot120 → ${s4.letter}/${s4.use} n=${s4.n} Ac${s4.ac} · lot240 → ${s5.letter} n=${s5.n} Ac${s5.ac} (expect F/E n=13 Ac0 · G n=32 Ac1)`);
  testErp(log);
  // interaction: map modes, job filter, hold + release on one loaded slot
  ["age", "abc", "cat", "sku"].forEach((m) => { host.querySelector(`[data-s4map="${m}"]`).click(); });
  const s = sim.slots.find((x) => x.load && !x.reserved && !x.blocked);
  const okH = hold(s, true), wasB = s.blocked, okR = hold(s, false);
  log(`hold ${locOf(s)} set=${okH} blocked=${wasB} released=${okR} now=${s.blocked}`);
  selMsg = "to"; renderLandDet(); const pre = host.querySelector(".s4-pre"); log(`telegram TO len=${pre ? pre.textContent.split("\n")[0].length : 0} first="${pre ? pre.textContent.split("\n")[0].slice(0, 40) : ""}"`);
  ["sched", "perf", "gm", "inb", "asn", "call", "deliv", "po", "tc", "life", "scan", "plc"].forEach((m) => { selMsg = m; renderLandDet(); });
  setTimeout(() => {
    ["1", "2", "3", "4"].forEach((n, i) => setTimeout(() => window.srCtl.showItem(n), i * 700));
    setTimeout(() => { const card = $("srCard4"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
      log(`switch 1→2→3→4 visible4=${!$("srItem4").hidden} card=${!!card} imgs=${imgs.length} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      log(`DONE errors=${errs.length ? errs.join(" | ") : "none"}`); }, 3400);
  }, 500);
}

/* ================================================================ lazy start */
window.addEventListener("sritemshow", (e) => { if (String(e.detail) === "4") { build(); update(true); } });
if (window.srCtl && window.srCtl.current() === "4" && window.srCtl.tabVisible()) build();
