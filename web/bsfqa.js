/* Ball screw + guide factory – item 5 "Quality + inspection" (#bfItem5).  Guide: docs/44_bsf_quality_inspection.md
 * Files: bsfqa.js (UI, live records from the twin, lead bench, SPC, MSA, sampling / NCR / traceability, self-check) ·
 *   bsfqa_data.js (SHARED quality data – items 6 MES + 7 ERP import it: characteristics, control plan, gates, SPC settings, GRR example, …) ·
 *   bsfqa_calc.js (formulas + CHECK5) · bsfqa_meas.js (11 measuring stations) · bsfqa_chart.js (SVG charts) · bsfqa_card.js (CARD5) · bsfqa.css ·
 *   server side (optional): twin/bsf_qa.py – routes /api/bsf/qa/... in server.py (results, trace, spc, ncr, eval). Without it the page runs alone.
 * Lazy: built on window event "bfitemshow" (detail "5"). Live data = window.BSF (web/bsfsim.js, item 3): every piece that leaves a measuring
 *   machine (QC-LED, QC-RAL, QC-MAT, AS-BSA, BS-CGR, BS-IND) creates measurement records (process model + machine bias + live signals).
 * URL: /?bfitem=5#bsf · &bf5card=plan|lead|meas|spc|msa|trace (scroll) · &bf5only=plan|…|card (test-only: show one card) · &bf5part=BS|BN|LG|LB|FABS|FALG · &bf5meas=<station id> · &bf5spc=<char id>
 *   · &bf5test (self-check, console "BF5TEST …" + #bf5Debug) · &bf5hold (headless: keep the load pending, show the tab) · card: &bf5tab=draw|buy|shop · &bf5box=N.
 * Offline. ALL VALUES ARE EXAMPLES – check the standard and your customer.
 */
import { BS, BN, LG, LB, ACC_BS, ACC_LG } from "./bsfprod_data.js";
import { MTYPES } from "./bsfmfg_data.js";
import { getBSF } from "./bsfsim.js";
import { TYPE_MAPS, NET_BY_ID, regImage, demoServe, reqRead, hex, decodeFrame } from "./bsfcomm_map.js";
import { NOTE5, ALPHA, ROOM, CHARS, CHAR_BY_ID, CONTROL_PLAN, PLAN_PARTS, GATES, GATE_BY_ID, FLOWS, SPC, SPC_CHARS, WE_RULES, TORQUE_TOL, LEAD_SIM, AQL,
  GRR_DATA, GRR_INFO, CAL, SERIAL, RESULT_EXAMPLE, NCR_STEPS, NCR_EXAMPLE, STDS5 } from "./bsfqa_data.js";
import { rng, gauss, mean, sdev, phi, leadEval, leadSim, leadLimits, capability, xbarS, imrStats, weRules, ppmOut, grr, aqlPlan, ocPa, uncBudget, torqueTol, CHECK5 } from "./bsfqa_calc.js";
import { STATIONS, STATION_BY_ID, TP0, charName } from "./bsfqa_meas.js";
import { plot, range, histo } from "./bsfqa_chart.js";
import { CARD5 } from "./bsfqa_card.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f0 = (v) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "), f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2), f3 = (v) => (+v).toFixed(3);
const fx = (v, d = 2) => (v == null || !Number.isFinite(v) ? "–" : (+v).toFixed(d));
const okb = (b) => `<b class="${b ? "bf5-ok" : "bf5-nok"}">${b ? "OK" : "NOK"}</b>`;
const host = $("bfItem5");
const errs = [];
if (Q.has("bf5test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf5hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf5hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("5"); }, 300); }
const visible = () => host && !host.hidden && (!window.bfCtl || window.bfCtl.tabVisible());
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf5-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "q-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function api(method, path, body, headers = {}) {
  const t0 = performance.now();
  const r = await fetch(path, { method, headers: body != null ? { "Content-Type": "application/json", ...headers } : headers, body: body != null ? JSON.stringify(body) : undefined, cache: "no-store" });
  const ct = r.headers.get("Content-Type") || "", txt = await r.text(); let data = txt; try { if (ct.includes("json")) data = JSON.parse(txt); } catch (e) { /* text */ }
  return { status: r.status, ok: r.ok, data, ct, ms: performance.now() - t0 };
}

let built = false, B = null, U = rng(5), uiT = null, be = { qa: false };
const REC = [];                     // measurement records (history + live twin + bench + stations)
const seen = {};                    // machine id → good counter already turned into records
const shift = {};                   // char id → injected mean shift (in σ)
const serialNo = {};                // prefix + date → running number
let spcSel = SPC_CHARS.some((c) => c.id === Q.get("bf5spc")) ? Q.get("bf5spc") : "BS-EP", spcDirty = true, liveN = 0, lastNok = null;

/* ------------------------------------------------------------------ records + serial numbers */
function dateOf(day) { const d = new Date(Date.UTC(2026, 10, 9 + (day || 1))); return String(d.getUTCFullYear()).slice(2) + String(d.getUTCMonth() + 1).padStart(2, "0") + String(d.getUTCDate()).padStart(2, "0"); }
function newSerial(part, day) { const p = SERIAL.prefix[part] || part, k = p + "-" + dateOf(day); serialNo[k] = (serialNo[k] || 0) + 1; return `${k}-${String(serialNo[k]).padStart(4, "0")}`; }
const instances = (type) => (B ? B.M.filter((m) => m.type === type) : []);
function charValue(sc, upIdx, extra = 0) {
  const c = CHAR_BY_ID[sc.id], biasK = [0, 1, -0.6, 0.4, -1.1, 0.7, -0.3][upIdx % 7];
  let v = sc.mu + sc.bias * biasK + (shift[sc.id] || 0) * sc.sigma + extra + gauss(U) * sc.sigma;
  if (sc.id === "BS-HRC") v = Math.round(v * 10) / 10;
  return { v, c };
}
function addRecord(r) { REC.push(r); if (REC.length > 4000) REC.splice(0, REC.length - 4000); if (r.decision === "NOK") lastNok = r; if (SPC_CHARS.some((s) => s.id === r.char)) spcDirty = true; return r; }
function mkRecord(char, value, o = {}) {
  const c = CHAR_BY_ID[char] || { lsl: null, usl: null, unit: "", name: char, part: "", op: "" };
  const decision = (c.lsl != null && value < c.lsl - 1e-9) || (c.usl != null && value > c.usl + 1e-9) ? "NOK" : "OK";
  return { serial: o.serial, part: c.part, char, name: c.name, value: +(+value).toFixed(4), unit: c.unit, lsl: c.lsl, usl: c.usl, decision, op: c.op, machine: o.machine || "", up: o.up || "",
    lot: o.lot || "", heat: o.heat || "", operator: o.operator || "", gauge: o.gauge || c.gauge || "", t: o.t ?? (B ? B.t : 0), source: o.source || "twin" };
}
function heatOf(lot) { const h = 7700 + ((String(lot).split("").reduce((s, ch) => s + ch.charCodeAt(0), 0) * 37) % 290); return `heat ${h} (example)`; }
const operatorOf = (t) => { const hr = ((t || 0) / 3600 + 6) % 24; return hr >= 6 && hr < 14 ? "badge 1043 (shift A)" : hr >= 14 && hr < 22 ? "badge 2117 (shift B)" : "badge 3305 (shift C)"; };
/* history: 30 subgroups per SPC characteristic (simulated – "before the twin started") */
function seedHistory() {
  for (const sc of SPC_CHARS) {
    const ups = instances(sc.up), srcs = instances(sc.src), n = sc.n === 1 ? 40 : sc.n * 30;
    for (let i = 0; i < n; i++) {
      const k = Math.floor(i / Math.max(1, sc.n)), ui = k % Math.max(1, ups.length), { v } = charValue(sc, ui);
      addRecord(mkRecord(sc.id, v, { serial: newSerial(CHAR_BY_ID[sc.id].part, 0), machine: (srcs[0] || {}).id, up: (ups[ui] || {}).id, lot: `H${String(100 + Math.floor(i / 20))}`, t: -86400 + i * 600, source: "history", operator: operatorOf(i * 600) }));
    }
  }
}
/* live: every new good piece of a measuring machine → records for its characteristics */
function pollTwin() {
  if (!B) return;
  const types = [...new Set(SPC_CHARS.map((c) => c.src))];
  for (const t of types) for (const m of instances(t)) {
    const g = m.good; if (seen[m.id] == null) { seen[m.id] = g; continue; }
    let k = Math.min(6, g - seen[m.id]); seen[m.id] = g;
    while (k-- > 0) {
      const lotId = (m.lot || "").split(",")[0], L = B.lots.find((l) => l.id === lotId), part = SPC_CHARS.find((c) => c.src === t);
      const serial = newSerial(CHAR_BY_ID[part.id].part, B.day());
      for (const sc of SPC_CHARS.filter((c) => c.src === t)) {
        const ups = instances(sc.up); let up = null;
        if (L) { const h = L.h.slice().reverse().find((x) => String(x[1]).startsWith(sc.up)); if (h) up = B.byId[h[1]]; }
        if (!up) up = ups[Math.floor(U() * ups.length)] || m;
        const ui = Math.max(0, ups.indexOf(up));
        let extra = 0;
        if (sc.therm && up.sig && up.sig.tgr) { B.signals(up); extra = -ALPHA * (up.sig.tgr.screwTemp_C - 20.2) * LEAD_SIM.lu / 1000; }
        const { v } = charValue(sc, ui, extra);
        addRecord(mkRecord(sc.id, v, { serial, machine: m.id, up: up.id, lot: lotId, heat: heatOf(lot0(L, lotId)), t: B.t, operator: operatorOf(B.t), source: "twin" }));
        liveN++;
      }
    }
  }
}
const lot0 = (L, id) => (L ? L.order + "-" + L.route : id);

/* ------------------------------------------------------------------ build */
function build() {
  if (built || !host) return; built = true;
  B = getBSF();
  host.innerHTML = `
  <div class="bf5-wrap">
    <div class="bf5-rule"><b>Quality rule of this plant:</b> every characteristic of the control plan has a spec, a gauge, a frequency, an owner and a reaction plan.
      Measuring machines deliver their results by <b>Modbus TCP</b> registers (gateway) or the instrument PC posts <b>HTTP JSON</b> – no other protocols. ${esc(NOTE5)}</div>
    <div class="card" id="bf5Plan">
      <div class="card-head"><h2>1 · Control plan + 17 quality gates</h2>
        <span class="bf5-ctl"><label class="bf5-lbl">product <select id="bf5Part" aria-label="product">${PLAN_PARTS.map((p) => `<option value="${p.k}">${esc(p.n)}</option>`).join("")}</select></label>
          <span class="bf5-sub" id="bf5PlanSum"></span></span></div>
      <p class="bf5-sub2">Process flow of the routing (item 2). <b>Diamonds = quality gates</b> – click one to see its characteristics, gauges and reaction plan. Click an operation box to filter the control plan to it.</p>
      <div class="bf5-flowbox"><svg id="bf5Flow" class="bf5-flow" viewBox="0 0 1180 170" role="img" aria-label="process flow with quality gates"></svg></div>
      <div id="bf5GateInfo" class="bf5-info"></div>
      <div id="bf5PlanTbl" class="bf5-scroll"></div>
      <details class="bf5-det"><summary>All 17 quality gates (QGATES of item 2)</summary><div id="bf5Gates"></div></details>
    </div>

    <div class="card" id="bf5Lead">
      <div class="card-head"><h2>2 · Ball screw lead measurement – laser interferometer (live)</h2>
        <span class="bf5-ctl"><button class="btn primary" type="button" id="bf5LStart">Measure next screw</button><label class="bf5-lbl"><input type="checkbox" id="bf5LAuto"> auto</label>
          <span class="bf5-badge" id="bf5LSer">–</span></span></div>
      <div class="bf5-benchbox"><svg id="bf5Bench" class="bf5-bench" viewBox="0 0 1000 250" role="img" aria-label="lead measuring bench with laser interferometer"></svg></div>
      <div class="bf5-leadgrid">
        <div>
          <div class="bf5-params" id="bf5LPar"></div>
          <p class="bf5-hint" id="bf5LTherm"></p>
        </div>
        <div><div id="bf5LChart"></div><div id="bf5LRes"></div></div>
      </div>
      <p class="hint">Method (ISO 3408-3): the screw turns in the bench; a ball probe in the groove moves the carriage; the laser measures the carriage travel; the rotary encoder gives the nominal travel θ · Ph / 2π.
        Actual travel deviation e(l) = actual − nominal travel, every 1 mm over the useful travel l_u = ${LEAD_SIM.lu} mm. <b>Mean travel line</b> = least-squares line through e(l);
        <b>E</b> = its rise over l_u, compared with the specified travel compensation <b>T</b>: |E − T| ≤ e_p. <b>v_up</b> = band around the mean travel line over l_u, <b>v_300p</b> = largest band in any 300 mm,
        <b>v_2πp</b> = largest band in one revolution (10 mm). Temperature: the reading is corrected to 20 °C with α = ${ALPHA} µm/(m·K) and the material sensors.</p>
    </div>

    <div class="card" id="bf5Meas">
      <div class="card-head"><h2>3 · Other measurements – live stations</h2>
        <span class="bf5-ctl"><select id="bf5MOpt" aria-label="station option" hidden></select><button class="btn primary" type="button" id="bf5MGo">Measure next part</button><label class="bf5-lbl"><input type="checkbox" id="bf5MAuto"> auto</label></span></div>
      <div class="bf5-tabs" id="bf5MTabs" role="tablist">${STATIONS.map((s, i) => `<button class="bf5-tab${i ? "" : " on"}" type="button" data-st="${s.id}" role="tab">${esc(s.t)}</button>`).join("")}</div>
      <div class="bf5-measgrid"><div><div id="bf5MChart" class="bf5-chartrow"></div><div id="bf5MTbl"></div></div><div id="bf5MInfo" class="bf5-info"></div></div>
      <h3 class="bf5-h">Last results of the stations (sent as measurement records)</h3><div id="bf5MLog" class="bf5-log"></div>
    </div>

    <div class="card" id="bf5Spc">
      <div class="card-head"><h2>4 · SPC – control charts + capability on live twin data</h2>
        <span class="bf5-ctl"><label class="bf5-lbl">characteristic <select id="bf5SChar" aria-label="SPC characteristic">${SPC_CHARS.map((c) => `<option value="${c.id}"${c.id === spcSel ? " selected" : ""}>${c.id} – ${esc(CHAR_BY_ID[c.id].name.slice(0, 44))}</option>`).join("")}</select></label>
          <label class="bf5-lbl">chart <select id="bf5SType" aria-label="chart type"><option value="auto">auto</option><option value="xbarR">X̄-R</option><option value="xbarS">X̄-s</option><option value="imr">I-MR</option></select></label>
          <button class="btn" type="button" id="bf5SShift">inject shift +1.5σ</button><button class="btn" type="button" id="bf5SClr">remove shift</button><span class="bf5-badge" id="bf5SLive">–</span></span></div>
      <div class="bf5-spcgrid"><div id="bf5SCharts"></div><div><div id="bf5SCap"></div><div id="bf5SHist"></div></div></div>
      <div id="bf5SRules"></div>
      <div id="bf5SGw" class="bf5-sub2"></div>
    </div>

    <div class="card" id="bf5Msa">
      <div class="card-head"><h2>5 · MSA – gauge R&amp;R, calibration, measurement uncertainty</h2>
        <span class="bf5-ctl"><label class="bf5-lbl">method <select id="bf5GMeth" aria-label="GRR method"><option value="ar">average + range (AIAG)</option><option value="anova">ANOVA</option></select></label>
          <button class="btn" type="button" id="bf5GNew">new random study</button><button class="btn" type="button" id="bf5GEx">example data set</button></span></div>
      <div class="bf5-msagrid"><div id="bf5GData" class="bf5-scroll"></div><div><div id="bf5GRes"></div><div id="bf5GChart"></div></div></div>
      <h3 class="bf5-h">Measurement uncertainty of the lead measurement (GUM, simple) + decision rule ISO 14253-1</h3>
      <div class="bf5-bar"><label class="bf5-lbl">room / screw temperature 20 ± <select id="bf5URoom" aria-label="room tolerance"><option value="0.5">0.5 K</option><option value="1">1 K</option><option value="2">2 K</option></select></label>
        <label class="bf5-lbl">length l_u <select id="bf5UL" aria-label="length"><option value="0.3">300 mm</option><option value="0.7" selected>700 mm</option><option value="1.5">1 500 mm</option></select></label></div>
      <div class="bf5-msagrid"><div id="bf5UTbl"></div><div id="bf5UDec"></div></div>
      <details class="bf5-det"><summary>Calibration intervals of the gauges (examples)</summary>${tbl(["Gauge", "Interval", "Who calibrates", "Check between calibrations"], CAL.map((r) => r.map(esc)), "bf5-small")}</details>
    </div>

    <div class="card" id="bf5Trace">
      <div class="card-head"><h2>6 · Sampling, first article, NCR / 8D, traceability + results to the MES (HTTP / Modbus TCP)</h2><span class="bf5-badge" id="bf5QaBe">…</span></div>
      <div class="bf5-tgrid">
        <div><h3 class="bf5-h">Sampling plan ISO 2859-1 (bought parts – example)</h3>
          <div class="bf5-bar"><label class="bf5-lbl">lot size <input type="number" id="bf5ALot" value="1000" min="2" max="500000" style="width:90px" aria-label="lot size"></label>
            <label class="bf5-lbl">AQL <select id="bf5AAql" aria-label="AQL">${Object.keys(AQL.ac0).map((a) => `<option${a === "1.0" ? " selected" : ""}>${a}</option>`).join("")}</select> %</label></div>
          <div id="bf5APlan"></div><div id="bf5AOc"></div></div>
        <div><h3 class="bf5-h">First article inspection (FAI) – new part, new machine, new program</h3><div id="bf5Fai"></div></div>
      </div>
      <h3 class="bf5-h">NCR workflow – detect → contain → root cause (5-Why / Ishikawa) → action (8D) → verify → close</h3>
      <div class="bf5-ncrbar" id="bf5NSteps"></div>
      <div class="bf5-tgrid"><div id="bf5NEx"></div><div><div class="bf5-bar"><button class="btn" type="button" id="bf5NNew">open NCR for the last NOK result</button><button class="btn" type="button" id="bf5NNext">next 8D step</button></div><div id="bf5NLive" class="bf5-info"></div></div></div>
      <h3 class="bf5-h">Traceability per serial number – genealogy + measurement records</h3>
      <div class="bf5-bar"><label class="bf5-lbl">serial <select id="bf5TSer" aria-label="serial number"></select></label><button class="btn" type="button" id="bf5TRef">refresh list</button></div>
      <div class="bf5-tgrid"><div id="bf5TGen"></div><div id="bf5TRec"></div></div>
      <h3 class="bf5-h">How results reach the MES – HTTP JSON (instrument PC / this page) and Modbus TCP registers (machine → gateway)</h3>
      <div class="bf5-tgrid">
        <div><div class="bf5-bar"><button class="btn primary" type="button" id="bf5PSend">POST last lead result → /api/bsf/qa/results</button><button class="btn" type="button" id="bf5PMes">send confirmation → MES demo</button></div>
          <pre class="bf5-pre" id="bf5PReq"></pre><pre class="bf5-pre" id="bf5PResp"></pre></div>
        <div><div id="bf5Mb"></div></div>
      </div>
    </div>
    <div id="bf5Debug" class="bf5-debug" hidden></div>
  </div>`;
  try { makeCard(CARD5, host.querySelector(".bf5-wrap"), { card: "bfCard5", q: "bfQ5", g: "bfG5", cnt: "bfCnt5", buy: "bfBuy5" }, "bf5"); } catch (e) { console.error(e); }
  host.querySelector(".bf5-wrap").appendChild($("bf5Debug"));

  seedHistory();
  for (const t of [...new Set(SPC_CHARS.map((c) => c.src))]) for (const m of instances(t)) seen[m.id] = m.good;
  // 1 control plan
  const p0 = PLAN_PARTS.some((p) => p.k === Q.get("bf5part")) ? Q.get("bf5part") : "BS"; $("bf5Part").value = p0;
  $("bf5Part").addEventListener("change", () => { planFilter = null; renderPlan(); });
  $("bf5Gates").innerHTML = tbl(["Gate", "Part", "After op", "What", "Spec", "How", "Frequency", "Reaction", "Characteristics"], GATES.map((g) => [`<b>${g.id}</b>`, g.r, g.after, esc(g.what), esc(g.spec), esc(g.how), esc(g.freq), esc(g.react), g.chars.join(", ") || "–"]), "bf5-small");
  renderPlan();
  // 2 lead bench
  buildLead();
  // 3 stations
  $("bf5MTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) selStation(b.dataset.st); });
  $("bf5MGo").addEventListener("click", () => measure());
  $("bf5MOpt").addEventListener("change", () => measure());
  selStation(STATION_BY_ID[Q.get("bf5meas")] ? Q.get("bf5meas") : "runout");
  // 4 SPC
  $("bf5SChar").addEventListener("change", () => { spcSel = $("bf5SChar").value; spcDirty = true; renderSpc(); });
  $("bf5SType").addEventListener("change", () => { spcDirty = true; renderSpc(); });
  $("bf5SShift").addEventListener("click", () => { shift[spcSel] = 1.5; spcDirty = true; renderSpc(); });
  $("bf5SClr").addEventListener("click", () => { shift[spcSel] = 0; spcDirty = true; renderSpc(); });
  // 5 MSA
  grrData = GRR_DATA;
  $("bf5GMeth").addEventListener("change", renderGrr); $("bf5GEx").addEventListener("click", () => { grrData = GRR_DATA; renderGrr(); });
  $("bf5GNew").addEventListener("click", () => { grrData = randomGrr(); renderGrr(); });
  renderGrr();
  $("bf5URoom").addEventListener("change", renderUnc); $("bf5UL").addEventListener("change", renderUnc); renderUnc();
  // 6 sampling / NCR / trace
  $("bf5ALot").addEventListener("input", renderAql); $("bf5AAql").addEventListener("change", renderAql); renderAql();
  renderFai(); renderNcrEx();
  $("bf5NNew").addEventListener("click", openNcr); $("bf5NNext").addEventListener("click", nextNcr);
  $("bf5TRef").addEventListener("click", fillSerials); $("bf5TSer").addEventListener("change", renderTrace);
  $("bf5PSend").addEventListener("click", sendResult); $("bf5PMes").addEventListener("click", sendMes);
  fillSerials(); renderPost(); renderMb();
  checkBackend();

  const cardMap = { plan: "bf5Plan", lead: "bf5Lead", meas: "bf5Meas", spc: "bf5Spc", msa: "bf5Msa", trace: "bf5Trace" };
  if (cardMap[Q.get("bf5card")]) setTimeout(() => $(cardMap[Q.get("bf5card")]).scrollIntoView({ block: "start" }), 900);
  if (Q.get("bf5only")) { const k = Q.get("bf5only"); host.querySelectorAll(".bf5-wrap > .card, .bf5-wrap > .bf5-rule").forEach((c) => { c.hidden = !(c.id === cardMap[k] || (k === "card" && c.id === "bfCard5")); }); }   // test-only: screenshots
  uiT = setInterval(tick, 1000);
  requestAnimationFrame(loop);
  if (Q.has("bf5test")) setTimeout(selfTest, 800);
}

/* ------------------------------------------------------------------ 1 control plan + gate flow */
let planFilter = null;   // { gate } | { op }
function renderPlan() {
  const part = $("bf5Part").value, fl = FLOWS[part], n = fl.length, W = 1180, bw = Math.min(118, (W - 40) / n - 14), gap = (W - 40 - n * bw) / Math.max(1, n - 1);
  let s = `<defs><marker id="bf5Ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`;
  fl.forEach(([no, nm, m, gate], i) => {
    const x = 20 + i * (bw + gap), on = planFilter && planFilter.op === no;
    if (i < n - 1) s += `<line x1="${x + bw}" y1="52" x2="${x + bw + gap - 2}" y2="52" class="bf5-fl" marker-end="url(#bf5Ar)"/>`;
    const words = nm.split(" "), l1 = [], l2 = []; for (const w of words) ((l1.join(" ") + " " + w).length <= Math.floor(bw / 6.6) && !l2.length ? l1 : l2).push(w);
    s += `<g class="bf5-op${on ? " on" : ""}" data-op="${no}" tabindex="0" role="button" aria-label="operation ${no}"><rect x="${x}" y="22" width="${bw}" height="60" rx="6"/><text x="${x + bw / 2}" y="38" text-anchor="middle" class="bf5-opn">${no} · ${esc(m)}</text>
      <text x="${x + bw / 2}" y="55" text-anchor="middle" class="bf5-ops">${esc(l1.join(" "))}</text><text x="${x + bw / 2}" y="70" text-anchor="middle" class="bf5-ops">${esc(l2.join(" ").slice(0, Math.floor(bw / 6.2)))}</text></g>`;
    if (gate) { const cx = x + bw / 2, on2 = planFilter && planFilter.gate === gate; s += `<line x1="${cx}" y1="82" x2="${cx}" y2="106" class="bf5-fl"/><g class="bf5-gate${on2 ? " on" : ""}" data-gate="${gate}" tabindex="0" role="button" aria-label="gate ${gate}"><path d="M${cx},106 L${cx + 30},130 L${cx},154 L${cx - 30},130 Z"/><text x="${cx}" y="134" text-anchor="middle" class="bf5-gt">${gate.replace("QG-", "")}</text></g>`; }
  });
  $("bf5Flow").innerHTML = s;
  $("bf5Flow").querySelectorAll("[data-gate]").forEach((g) => g.addEventListener("click", () => { planFilter = { gate: g.dataset.gate }; renderPlan(); }));
  $("bf5Flow").querySelectorAll("[data-op]").forEach((g) => g.addEventListener("click", () => { planFilter = planFilter && planFilter.op === g.dataset.op ? null : { op: g.dataset.op }; renderPlan(); }));
  let rows = CONTROL_PLAN.filter((c) => c.part === part);
  const all = rows.length;
  if (planFilter && planFilter.gate) rows = rows.filter((c) => c.gate === planFilter.gate);
  if (planFilter && planFilter.op) rows = rows.filter((c) => c.op === planFilter.op);
  const gates = GATES.filter((g) => g.r === part);
  $("bf5PlanSum").textContent = `${all} characteristics · ${gates.length} gates · ${CHARS.filter((c) => c.part === part && c.cls === "CC").length} critical (CC)`;
  const g = planFilter && planFilter.gate ? GATE_BY_ID[planFilter.gate] : null;
  $("bf5GateInfo").innerHTML = g ? `<b>${g.id}</b> after op ${g.after}: <b>${esc(g.what)}</b> · spec ${esc(g.spec)} · how: ${esc(g.how)} · frequency: ${esc(g.freq)} · <b>reaction:</b> ${esc(g.react)} <button class="btn bf5-x" type="button" id="bf5GClr">show all</button>`
    : planFilter && planFilter.op ? `Operation <b>${planFilter.op}</b> only. <button class="btn bf5-x" type="button" id="bf5GClr">show all</button>` : `<span class="bf5-mut">CC = critical characteristic (function / safety / customer – 100 % or SPC with Cpk ≥ 1.67), SC = significant (Cpk ≥ 1.33). Sample size / frequency / reaction = examples.</span>`;
  if ($("bf5GClr")) $("bf5GClr").addEventListener("click", () => { planFilter = null; renderPlan(); });
  $("bf5PlanTbl").innerHTML = tbl(["No", "Op / machine", "Characteristic", "Class", "Spec", "Method / gauge", "Sample / frequency", "Who", "Control", "Reaction plan", "Gate"],
    rows.map((c) => [c.no, `${c.op} · ${esc(c.machine)}`, `<b>${c.id}</b> ${esc(c.name)}`, c.cls ? `<span class="bf5-cls ${c.cls}">${c.cls}</span>` : "", esc(c.spec), `${esc(c.method)}<br><span class="bf5-mut">${esc(c.gauge)}</span>`, `${esc(c.sample)} · ${esc(c.freq)}`, esc(c.who), esc(c.ctl), esc(c.react), c.gate ? `<a href="#" data-g="${c.gate}">${c.gate}</a>` : "–"]), "bf5-small bf5-plan");
  $("bf5PlanTbl").querySelectorAll("[data-g]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); planFilter = { gate: a.dataset.g }; renderPlan(); }));
}

/* ------------------------------------------------------------------ 2 lead bench */
const LP = { ...LEAD_SIM };
let lead = null;   // { sim, ev, t0, serial, done }
const LPAR = [
  ["T", "travel compensation T (µm over l_u)", -30, 30, 1], ["sys_um", "grinder lead error (mean, µm over l_u)", -40, 40, 1], ["a2pi", "2π wobble amplitude (µm)", 0, 5, 0.1], ["aLong", "long wave amplitude (µm)", 0, 8, 0.1],
  ["tGrind", "screw temperature in grinding (°C)", 19, 23, 0.1], ["riseGrind", "temperature rise during the finish pass (K)", 0, 3, 0.1], ["tMat", "material temperature at the bench (°C)", 18, 23, 0.1],
  ["drift", "temperature change during the run (K)", -0.5, 0.5, 0.05], ["sensorErr", "material sensor error (K)", -0.5, 0.5, 0.05], ["noise", "noise 1σ (µm)", 0, 1, 0.05],
];
function buildLead() {
  $("bf5LPar").innerHTML = LPAR.map(([k, t, lo, hi, st]) => `<label class="bf5-par"><span>${esc(t)}</span><input type="range" min="${lo}" max="${hi}" step="${st}" value="${LP[k]}" data-k="${k}" aria-label="${esc(t)}"><b id="bf5LV_${k}">${LP[k]}</b></label>`).join("")
    + `<label class="bf5-par"><span>temperature compensation</span><input type="checkbox" id="bf5LComp" checked aria-label="temperature compensation"><b></b></label>
       <label class="bf5-par"><span>use live screw temperature of the thread grinders (item 2 / 3, tgr.screwTemp_C)</span><input type="checkbox" id="bf5LLive" aria-label="live screw temperature"><b id="bf5LLiveV"></b></label>`;
  $("bf5LPar").querySelectorAll("input[type=range]").forEach((i) => i.addEventListener("input", () => { LP[i.dataset.k] = +i.value; $("bf5LV_" + i.dataset.k).textContent = i.value; if (lead && lead.done) { lead.ev = evalLead(lead.sim); renderLead(1); } thermText(); }));
  $("bf5LComp").addEventListener("change", () => { LP.comp = $("bf5LComp").checked; if (lead && lead.done) { lead.ev = evalLead(lead.sim); renderLead(1); } });
  $("bf5LStart").addEventListener("click", startLead);
  drawBench();
  startLead(); thermText();
}
function evalLead(sim) { return leadEval(sim.x, LP.comp ? sim.comp : sim.raw, LP.T, LP.ph); }
function startLead() {
  if ($("bf5LLive").checked && B) { const g = instances("BS-TGR"); if (g.length) { const t = mean(g.map((m) => (B.signals(m), m.sig.tgr.screwTemp_C))); LP.tGrind = +t.toFixed(2); $("bf5LV_tGrind").textContent = LP.tGrind; $("bf5LPar").querySelector('[data-k="tGrind"]').value = LP.tGrind; $("bf5LLiveV").textContent = LP.tGrind + " °C"; } }
  const sim = leadSim(LP, U), serial = newSerial("BS", B ? B.day() : 1), up = instances("BS-TGR")[Math.floor(U() * Math.max(1, instances("BS-TGR").length))];
  lead = { sim, ev: evalLead(sim), t0: performance.now(), serial, up: up ? up.id : "BS-TGR-01", done: false, sent: false };
  $("bf5LSer").textContent = serial; thermText();
}
function thermText() {
  const L = LP.lu / 1000, g1 = -ALPHA * (LP.tGrind - 20) * L, g2 = -ALPHA * LP.riseGrind * L / 2, m1 = ALPHA * (LP.tMat + LP.drift - 20) * L;
  $("bf5LTherm").innerHTML = `<b>Temperature effects (α = ${ALPHA} µm/(m·K), l_u = ${LP.lu} mm):</b><br>
    • grinding: screw ${f1(LP.tGrind)} °C → ground lead after cooling ΔL = −α·(T − 20)·l_u = −${ALPHA} × ${f2(LP.tGrind - 20)} × ${L} = <b>${f2(g1)} µm</b> (slope → E); a rise of ${f1(LP.riseGrind)} K during the pass bends the curve: end value ${f2(g2)} µm (→ v_up, v_300).<br>
    • bench: material ${f2(LP.tMat)} → ${f2(LP.tMat + LP.drift)} °C → the laser sees the warm screw longer by α·ΔT·l = <b>${f2(m1)} µm</b> at l_u. Compensation subtracts α·(T_sensor − 20)·l; a sensor error of ${f2(LP.sensorErr)} K leaves ${f2(ALPHA * LP.sensorErr * L)} µm.<br>
    • 1 K over 700 mm = 8.05 µm – about ¼ of the C5 e_p tolerance. That is why the room is 20 ± 0.5 °C and the screw soaks ≥ ${ROOM.soak_h} h.`;
}
function drawBench() {
  const X = (mm) => 140 + mm / 1000 * 720;   // shaft 0 … 1 000 mm → px
  let s = `<rect x="20" y="196" width="960" height="26" class="bf5-granite"/><text x="30" y="214" class="bf5-bl">granite bed + air-bearing guideway</text>`;
  s += `<rect x="40" y="88" width="92" height="86" rx="4" class="bf5-mach"/><text x="86" y="104" text-anchor="middle" class="bf5-bl">work head</text><text x="86" y="118" text-anchor="middle" class="bf5-bl">+ rotary</text><text x="86" y="131" text-anchor="middle" class="bf5-bl">encoder θ</text><rect x="132" y="112" width="10" height="20" class="bf5-mach"/>`;
  s += `<rect x="862" y="100" width="64" height="74" rx="4" class="bf5-mach"/><text x="894" y="150" text-anchor="middle" class="bf5-bl">tail-</text><text x="894" y="163" text-anchor="middle" class="bf5-bl">stock</text><path d="M862,122 L850,122 L846,118 L846,126 L850,122" class="bf5-mach"/>`;
  s += `<rect x="${X(0)}" y="113" width="${X(1000) - X(0)}" height="18" class="bf5-shaft"/><rect x="${X(75)}" y="111" width="${X(925) - X(75)}" height="22" class="bf5-thread"/><g id="bf5Hatch"></g>`;
  s += `<text x="${X(500)}" y="152" text-anchor="middle" class="bf5-bl">screw BS-3210 (thread 850 mm, l_u ${LP.lu} mm)</text>`;
  for (const mm of [150, 500, 850]) s += `<rect x="${X(mm) - 5}" y="104" width="10" height="7" class="bf5-sens"/>`;
  s += `<text x="${X(150)}" y="98" text-anchor="middle" class="bf5-bl">material sensors (3)</text>`;
  s += `<rect x="940" y="34" width="50" height="34" rx="3" class="bf5-laser"/><text x="992" y="26" text-anchor="end" class="bf5-bl">laser head (XL-80 class)</text><line x1="965" y1="68" x2="965" y2="196" class="bf5-mach"/>`;
  s += `<rect x="904" y="42" width="18" height="18" class="bf5-optic"/><text x="913" y="78" text-anchor="middle" class="bf5-bl">interferometer</text>`;
  s += `<line id="bf5Beam" x1="940" y1="51" x2="300" y2="51" class="bf5-beam"/>`;
  s += `<g id="bf5Car"><rect x="-26" y="164" width="52" height="30" rx="3" class="bf5-car"/><line x1="0" y1="164" x2="0" y2="62" class="bf5-mach"/><path d="M-10,42 L10,42 L10,60 L-10,60 Z" class="bf5-optic"/><circle cx="0" cy="133" r="5" class="bf5-probe"/><line x1="0" y1="138" x2="0" y2="164" class="bf5-mach"/>
    <text x="0" y="36" text-anchor="middle" class="bf5-bl">retro-reflector</text><text x="34" y="184" class="bf5-bl">carriage + ball probe</text></g>`;
  s += `<rect x="745" y="226" width="150" height="20" rx="3" class="bf5-comp"/><text x="820" y="240" text-anchor="middle" class="bf5-bl">compensator (XC-80)</text><text id="bf5BTemp" x="40" y="244" class="bf5-bl"></text><text id="bf5BPos" x="40" y="66" class="bf5-bt"></text>`;
  $("bf5Bench").innerHTML = s;
}
function benchFrame(p) {
  const X = (mm) => 140 + mm / 1000 * 720, x0 = 75 + (850 - LP.lu) / 2, xmm = x0 + p * LP.lu, px = X(xmm);
  const car = $("bf5Car"); if (!car) return;
  car.setAttribute("transform", `translate(${px.toFixed(1)},0)`); $("bf5Beam").setAttribute("x2", (px + 10).toFixed(1));
  const ph = (performance.now() / 60) % 8; let h = ""; for (let x = X(75) + ph; x < X(925); x += 8) h += `<line x1="${x.toFixed(1)}" y1="111" x2="${(x + 5).toFixed(1)}" y2="133" class="bf5-hl"/>`; $("bf5Hatch").innerHTML = h;
  const i = Math.min(lead.sim.x.length - 1, Math.floor(p * (lead.sim.x.length - 1)));
  $("bf5BTemp").textContent = `material ${f2(lead.sim.tm[i] + (LP.sensorErr || 0))} °C (sensor) · air 20.0 °C · 1 013 hPa · 45 % rH`;
  $("bf5BPos").textContent = `l = ${f1(lead.sim.x[i])} mm   e = ${f2((LP.comp ? lead.sim.comp : lead.sim.raw)[i])} µm`;
}
function renderLead(p) {
  const S = lead.sim, n = Math.max(2, Math.floor(p * (S.x.length - 1)) + 1), ev = lead.ev, sh = (arr) => S.x.slice(0, n).map((x, i) => [x, arr[i]]);
  const yv = S.comp.concat(S.raw, S.eT), yr = range(yv, 0.12), ys = [];
  const ser = [{ pts: sh(S.raw), cls: "bf5-l2d" }, { pts: sh(S.eT), cls: "bf5-l3" }, { pts: sh(LP.comp ? S.comp : S.raw), cls: "bf5-l1" }];
  if (p >= 1) { ser.push({ pts: [[0, ev.a], [ev.lu, ev.a + ev.b * ev.lu]], cls: "bf5-cl" }, { pts: [[0, ev.a], [ev.lu, ev.a + LP.T]], cls: "bf5-l4" }); }
  const bands = p >= 1 ? [{ x0: ev.v300at.x0, x1: ev.v300at.x1, cls: "bf5-band" }] : [];
  $("bf5LChart").innerHTML = plot({ w: 640, h: 270, xr: [0, LP.lu], yr, xl: "travel l (mm)", yl: "travel deviation e (µm)", series: ser, bands, title: "lead error curve e(l)" });
  $("bf5LChart").insertAdjacentHTML("beforeend", `<p class="bf5-mut">blue = evaluated curve (${LP.comp ? "compensated to 20 °C" : "raw – compensation off"}) · dashed grey = raw laser reading · green thin = true curve at 20 °C · green line = mean travel line · orange = T · shaded = worst 300 mm window</p>`);
  if (p < 1) { $("bf5LRes").innerHTML = `<p class="bf5-hint">measuring … ${Math.round(p * 100)} %</p>`; return; }
  const L = ev.lim, row = (k, lab, val, f) => [lab, f2(val) + " µm", ...["C3", "C5", "C7"].map((g) => { const lim = L[g][k]; if (lim == null) return "–"; const ok = f(val, lim); return `${f2(lim)} ${okb(ok)}`; })];
  $("bf5LRes").innerHTML = tbl(["Value (ISO 3408-3)", "Measured", "C3 limit", "C5 limit", "C7 limit"], [
    row("ep", "E − T (mean travel deviation − compensation)", ev.dev, (v, l) => Math.abs(v) <= l), row("vup", "v_up (band over l_u)", ev.vu, (v, l) => v <= l),
    row("v300", "v_300p (any 300 mm)", ev.v300, (v, l) => v <= l), row("v2pi", "v_2πp (one revolution)", ev.v2pi, (v, l) => v <= l)], "bf5-small")
    + `<p class="bf5-hint">E = ${f2(ev.E)} µm, T = ${f2(LP.T)} µm, l_u = ${f0(ev.lu)} mm (table row ≤ ${L.bin} mm), C7: e_p = l_u/300 × 50 µm. Grade reached: <b class="${ev.grade === "reject" ? "bf5-nok" : "bf5-ok"}">${ev.grade}</b> (ordered C5 → ${ev.ok.C5 ? "accepted" : ev.ok.C7 ? "downgrade to C7 or regrind" : "reject / regrind"}). Ground on ${esc(lead.up)}.</p>`;
}
function finishLead() {
  lead.done = true; renderLead(1);
  const o = { serial: lead.serial, machine: "QC-LED-01", up: lead.up, lot: "bench", gauge: "XL80-0317", source: "bench", operator: operatorOf(B ? B.t : 0) };
  lead.recs = [mkRecord("BS-EP", lead.ev.dev, o), mkRecord("BS-VU", lead.ev.vu, o), mkRecord("BS-V300", lead.ev.v300, o), mkRecord("BS-V2PI", lead.ev.v2pi, o)];
  lead.recs.forEach(addRecord); renderPost(); fillSerials(lead.serial);
  if ($("bf5LAuto").checked) setTimeout(() => { if ($("bf5LAuto").checked && visible()) startLead(); }, 2500);
}

/* ------------------------------------------------------------------ 3 stations */
let st = null;   // { s, d, t0, opt }
const MLOG = [];
function selStation(id) {
  $("bf5MTabs").querySelectorAll("[data-st]").forEach((b) => b.classList.toggle("on", b.dataset.st === id));
  const s = STATION_BY_ID[id], sel = $("bf5MOpt");
  sel.hidden = !s.opts; if (s.opts) sel.innerHTML = s.opts.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("");
  if (id === "torque") sel.value = "C5";
  $("bf5MInfo").innerHTML = `<h3>${esc(s.t)}</h3><p>${esc(s.how)}</p><p><b>Gauge:</b> ${esc(s.gauge)}</p><p><b>Standard:</b> ${esc(s.std)}</p><p><b>Control plan:</b> ${s.chars.map((c) => `${c} – ${esc(charName(c))} (${esc((CHAR_BY_ID[c] || {}).spec || "")})`).join("; ")}</p>`;
  st = { s }; measure();
}
function measure() { const opt = st.s.opts ? $("bf5MOpt").value : undefined; st.d = st.s.gen(U, opt); st.t0 = performance.now(); st.done = false; }
function stationFrame() {
  if (!st || !st.d) return;
  const p = Math.min(1, (performance.now() - st.t0) / 2200);
  if (st.done && p >= 1) return;
  const v = st.s.view(st.d, p);
  $("bf5MChart").innerHTML = v.svg; $("bf5MTbl").innerHTML = v.table;
  if (p >= 1 && !st.done) {
    st.done = true;
    const serial = newSerial(st.s.part, B ? B.day() : 1), m = { runout: "QC-LED-01", hard: "QC-LAB-01", profile: "QC-LAB-01", balls: "QC-INC-01", torque: "AS-BSA-01", rigid: "QC-LAB-01", par: "QC-RAL-01", hw: "QC-MAT-01", rough: "QC-LAB-01", noise: "AS-RUN-01", clean: "QC-LAB-01" }[st.s.id];
    const recs = v.rec.filter((r) => CHAR_BY_ID[r.char]).map((r) => addRecord(mkRecord(r.char, r.value, { serial, machine: m, source: "station", operator: operatorOf(B ? B.t : 0) })));
    MLOG.unshift({ t: new Date().toLocaleTimeString(), s: st.s.t, serial, ok: v.ok, recs }); MLOG.length = Math.min(MLOG.length, 12);
    $("bf5MLog").innerHTML = MLOG.map((l) => `<div class="bf5-ev">${l.t} · <b>${esc(l.s)}</b> · ${l.serial} · ${okb(l.ok)} · ${l.recs.map((r) => `${r.char} = ${fx(r.value, 3)} ${esc(r.unit)}`).join(", ")}</div>`).join("");
    if ($("bf5MAuto").checked) setTimeout(() => { if ($("bf5MAuto").checked && visible()) measure(); }, 1800);
  }
}

/* ------------------------------------------------------------------ 4 SPC */
function spcData() {
  const sc = SPC_CHARS.find((c) => c.id === spcSel), c = CHAR_BY_ID[spcSel], recs = REC.filter((r) => r.char === spcSel && r.source !== "station");
  let type = $("bf5SType").value; if (type === "auto") type = sc.chart; let n = sc.n; if (type === "imr") n = 1; else if (n < 2) n = 5;
  const vals = recs.map((r) => r.value).slice(-(type === "imr" ? 60 : n * 40));
  return { sc, c, recs, type, n, vals };
}
function renderSpc() {
  if (!spcDirty) return; spcDirty = false;
  const { sc, c, recs, type, n, vals } = spcData(), lsl = c.lsl, usl = c.usl, live = recs.filter((r) => r.source !== "history").length;
  $("bf5SLive").textContent = `${recs.length} values · ${live} from the twin / bench · shift ${shift[spcSel] ? "+" + shift[spcSel] + "σ" : "none"}`;
  let main, sub, cl, sig, cap, y, yr2, sub2, cl2, ucl2, lcl2, xl;
  if (type === "imr") {
    const ph1 = vals.slice(0, Math.min(SPC.phase1, vals.length)); const base = imrStats(ph1, lsl, usl); cap = imrStats(vals, lsl, usl);
    y = vals; cl = base.xbar; sig = base.sigmaWithin; main = { UCL: base.UCLx, LCL: base.LCLx }; sub = vals.slice(1).map((v, i) => Math.abs(v - vals[i])); cl2 = base.mrbar; ucl2 = base.UCLmr; lcl2 = 0; sub2 = "moving range MR"; xl = "value no.";
  } else {
    const k = Math.floor(vals.length / n), groups = Array.from({ length: k }, (_, i) => vals.slice(i * n, i * n + n)), ph1 = groups.slice(0, Math.min(SPC.phase1, k));
    if (type === "xbarS") { const b = xbarS(ph1), a = xbarS(groups); y = a.xb; sub = a.ss; cl = b.xbarbar; sig = b.sigmaWithin / Math.sqrt(n); main = { UCL: b.UCLx, LCL: b.LCLx }; cl2 = b.sbar; ucl2 = b.UCLs; lcl2 = b.LCLs; sub2 = "s (standard deviation of the subgroup)";
      const cc = capability(groups, lsl, usl); cap = { ...cc, sigmaWithin: a.sigmaWithin, Cp: lsl != null && usl != null ? (usl - lsl) / (6 * a.sigmaWithin) : null, Cpk: Math.min(usl != null ? (usl - a.xbarbar) / (3 * a.sigmaWithin) : Infinity, lsl != null ? (a.xbarbar - lsl) / (3 * a.sigmaWithin) : Infinity) }; cap.xbar = a.xbarbar; }
    else { const b = capability(ph1, lsl, usl); cap = capability(groups, lsl, usl); y = cap.xb; sub = cap.rr; cl = b.xbarbar; sig = (b.UCLx - b.xbarbar) / 3; main = { UCL: b.UCLx, LCL: b.LCLx }; cl2 = b.rbar; ucl2 = b.UCLr; lcl2 = b.LCLr; sub2 = "range R"; cap.xbar = cap.xbarbar; }
    xl = `subgroup no. (n = ${n})`;
  }
  const flags = weRules(y, cl, sig), pts = y.map((v, i) => [i + 1, v]);
  const yAll = y.concat([main.UCL, main.LCL]).concat(type === "imr" && lsl != null ? [lsl] : []).concat(type === "imr" && usl != null ? [usl] : []);
  const hl = [{ y: main.UCL, t: `UCL ${fx(main.UCL, 3)}`, cls: "bf5-ucl" }, { y: main.LCL, t: `LCL ${fx(main.LCL, 3)}`, cls: "bf5-ucl" }, { y: cl, t: `CL ${fx(cl, 3)}`, cls: "bf5-cl" }];
  if (type === "imr") { if (usl != null) hl.push({ y: usl, t: "USL", cls: "bf5-lim" }); if (lsl != null) hl.push({ y: lsl, t: "LSL", cls: "bf5-lim" }); }
  const zones = [1, 2].flatMap((k) => [{ y: cl + k * sig, cls: "bf5-zone" }, { y: cl - k * sig, cls: "bf5-zone" }]);
  $("bf5SCharts").innerHTML = plot({ w: 660, h: 250, xr: [0, Math.max(10, y.length + 1)], yr: range(yAll, 0.1), xl, yl: `${type === "imr" ? "I" : "X̄"} (${c.unit})`, series: [{ pts, cls: "bf5-l1", dots: true, flags }], hl: zones.concat(hl), title: `${type === "imr" ? "individuals I" : "X̄"} chart – ${c.id} ${c.name} (phase I limits from the first ${SPC.phase1})` })
    + plot({ w: 660, h: 170, xr: [0, Math.max(10, y.length + 1)], yr: [0, Math.max(ucl2, ...sub) * 1.15 || 1], xl, yl: c.unit, series: [{ pts: sub.map((v, i) => [i + (type === "imr" ? 2 : 1), v]), cls: "bf5-l2", dots: true }], hl: [{ y: ucl2, t: `UCL ${fx(ucl2, 3)}`, cls: "bf5-ucl" }, { y: cl2, t: `${fx(cl2, 3)}`, cls: "bf5-cl" }].concat(lcl2 > 0 ? [{ y: lcl2, t: "LCL", cls: "bf5-ucl" }] : []), title: sub2 });
  const fired = flags.map((f, i) => [i + 1, f]).filter(([, f]) => f.length);
  $("bf5SRules").innerHTML = `<h3 class="bf5-h">Western Electric rules (red points) – ${fired.length ? `${fired.length} points flagged: ` + fired.slice(-8).map(([i, f]) => `#${i} rule ${f.join("+")}`).join(", ") : "no rule fired – process in control"}</h3>`
    + tbl(["Rule", "Pattern", "Meaning"], WE_RULES.map((r) => r.map(esc)), "bf5-small");
  // capability
  const mu = type === "imr" ? cap.xbar : cap.xbar, sw = cap.sigmaWithin, so = cap.sigmaOverall, ppm = ppmOut(mu, so, lsl, usl), tgt = c.cls === "CC" ? SPC.targets.CpkCC : SPC.targets.Cpk;
  const ff = (v) => fx(v, 2);
  $("bf5SCap").innerHTML = `<h3 class="bf5-h">Capability (spec ${esc(c.spec)})</h3>` + tbl(["Index", "Formula", "Value"], [
    ["mean μ", type === "imr" ? "x̄ = Σx / N" : "X̄̄ = mean of the subgroup means", fx(mu, 4) + " " + esc(c.unit)],
    ["σ within", type === "imr" ? "MR̄ / d2 (d2 = 1.128)" : type === "xbarS" ? "s̄ / c4" : `R̄ / d2 (d2 = ${SPC.d2[n - 2]})`, fx(sw, 4)],
    ["σ overall", "s of all values (N − 1)", fx(so, 4)],
    ["Cp", "(USL − LSL) / 6σ_within", lsl != null && usl != null ? ff(cap.Cp) : "– (one-sided)"],
    ["Cpk", "min(USL − μ, μ − LSL) / 3σ_within", `<b class="${cap.Cpk >= tgt ? "bf5-ok" : "bf5-nok"}">${ff(cap.Cpk)}</b> (target ≥ ${tgt} for ${c.cls || "–"})`],
    ["Pp / Ppk", "same with σ_overall", `${lsl != null && usl != null ? ff(cap.Pp) : "–"} / ${ff(cap.Ppk)}`],
    ["expected out of spec", "normal distribution, σ_overall", f0(ppm) + " ppm"]], "bf5-small");
  const allV = vals, hr = range(allV.concat([lsl ?? mu, usl ?? mu]), 0.15), bins = histo(allV, hr[0], hr[1], 18), bw = (hr[1] - hr[0]) / 18, nn = allV.length;
  const curve = []; for (let i = 0; i <= 60; i++) { const x = hr[0] + (hr[1] - hr[0]) * i / 60; curve.push([x, nn * bw * Math.exp(-0.5 * ((x - mu) / so) ** 2) / (so * Math.sqrt(2 * Math.PI))]); }
  $("bf5SHist").innerHTML = plot({ w: 420, h: 220, xr: hr, yr: [0, Math.max(...bins.map((b) => b[1]), ...curve.map((p) => p[1])) * 1.15 || 1], xl: c.unit, yl: "count", series: [{ pts: bins, bars: true, bw, cls: "bf5-bar" }, { pts: curve, cls: "bf5-l3" }], vl: [lsl != null ? { x: lsl, t: "LSL", cls: "bf5-lim" } : null, usl != null ? { x: usl, t: "USL", cls: "bf5-lim" } : null, { x: mu, cls: "bf5-cl" }].filter(Boolean), title: `histogram (${nn} values) + normal curve`, left: 40 });
  renderGwMeas();
}
function renderGwMeas() {
  if (!B) return;
  const m = instances("QC-LED")[0]; if (!m) return; B.signals(m); const s = m.sig.meas;
  $("bf5SGw").innerHTML = `<b>Gateway signal group <code>meas</code> of ${m.id}</b> (Modbus TCP, item 4 register map): e_p ${fx(s.ep_um, 1)} µm · v_up ${fx(s.vup_um, 1)} · v_300 ${fx(s.v300_um, 1)} · v_2π ${fx(s.v2pi_um, 1)} µm · grade code ${s.grade} · material ${fx(s.matTemp_C, 2)} °C · state ${m.state} · good ${m.good}. The live SPC values above come from the same twin pieces (one record per piece leaving the measuring machine).`;
}

/* ------------------------------------------------------------------ 5 MSA */
let grrData = null;
function randomGrr() { const R = rng(Math.floor(Math.random() * 1e9)), tr = Array.from({ length: 10 }, () => gauss(R) * 10), bias = [0, gauss(R) * 0.8, gauss(R) * 0.8], s = 0.4 + R() * 1.2;
  return [0, 1, 2].map((o) => tr.map((t) => [0, 1, 2].map(() => Math.round((t + bias[o] + gauss(R) * s) * 10) / 10))); }
function renderGrr() {
  const D = grrData, R = grr(D, GRR_INFO.tol), meth = $("bf5GMeth").value, A = R.ar, N = R.anova;
  $("bf5GData").innerHTML = `<p class="bf5-sub2">${esc(GRR_INFO.what)} (${GRR_INFO.unit}) · ${esc(GRR_INFO.gauge)} · tolerance ${GRR_INFO.tol} µm (class H ± 40 µm). 10 blocks × 3 operators × 3 trials (blind, random order).</p>`
    + tbl(["Part", ...GRR_INFO.ops.flatMap((o) => [1, 2, 3].map((t) => `${o}${t}`)), "x̄ part"], Array.from({ length: 10 }, (_, p) => [p + 1, ...D.flatMap((op) => op[p].map(f1)), f2(A.xp[p])])
      .concat([["R̄ op", ...D.flatMap((op, o) => ["", f3(A.rbarOp[o]), ""]), ""], ["x̄ op", ...D.flatMap((op, o) => ["", f3(A.xbarOp[o]), ""]), ""]]), "bf5-small bf5-grr");
  const verdict = (p) => (p < 10 ? "<b class='bf5-ok'>acceptable (&lt; 10 %)</b>" : p <= 30 ? "<b class='bf5-warn'>conditional (10 – 30 %)</b>" : "<b class='bf5-nok'>not acceptable (&gt; 30 %)</b>");
  const rows = meth === "ar" ? [
    ["R̄̄ (mean range)", "mean of R̄_A, R̄_B, R̄_C", f3(A.rbarbar)], ["EV repeatability", `R̄̄ · K1 (K1 = ${GRR_INFO.K1[3]})`, f3(A.EV)], ["X̄diff", "max x̄_op − min x̄_op", f3(A.xdiff)],
    ["AV reproducibility", `√((X̄diff·K2)² − EV² / (n·r)), K2 = ${GRR_INFO.K2[3]}, n = 10, r = 3`, f3(A.AV)], ["GRR", "√(EV² + AV²)", f3(A.GRR)], ["Rp (range of part means)", "max − min of x̄ part", f3(A.Rp)],
    ["PV part variation", `Rp · K3 (K3 = ${GRR_INFO.K3[10]})`, f3(A.PV)], ["TV total", "√(GRR² + PV²)", f3(A.TV)],
    ["%GRR (of TV)", "100 · GRR / TV", `${f2(A.pctGRR)} % ${verdict(A.pctGRR)}`], ["%GRR (of tolerance)", "100 · 6·GRR / T", f2(A.pctTol) + " %"], ["ndc", "⌊1.41 · PV / GRR⌋ (≥ 5)", `<b>${A.ndc}</b> ${A.ndc >= 5 ? okb(true) : okb(false)}`]]
    : [["MS part / operator / interaction / error", "SS / df", `${f2(N.MS.part)} / ${f3(N.MS.operator)} / ${f3(N.MS.interaction)} / ${f3(N.MS.error)}`], ["F interaction", "MS_int / MS_error", f3(N.F_interaction) + (N.F_interaction < 2.2 ? " (small – could be pooled)" : "")],
      ["σ² repeatability", "MS_error", f3(N.var.repeatability)], ["σ² operator", "(MS_op − MS_int) / (b·r)", f3(N.var.operator)], ["σ² interaction", "(MS_int − MS_error) / r", f3(N.var.interaction)], ["σ² part", "(MS_part − MS_int) / (a·r)", f2(N.var.part)],
      ["σ_GRR", "√(σ²_rep + σ²_op + σ²_int)", f3(N.sigmaGRR)], ["%GRR (of TV)", "100 · σ_GRR / σ_TV", `${f2(N.pctGRR)} % ${verdict(N.pctGRR)}`], ["%GRR (of tolerance)", "100 · 6σ_GRR / T", f2(N.pctTol) + " %"], ["ndc", "⌊1.41 · σ_part / σ_GRR⌋", `<b>${N.ndc}</b>`]];
  $("bf5GRes").innerHTML = tbl(["Value", "Formula", "Result"], rows, "bf5-small");
  const ser = D.map((op, o) => ({ pts: op.map((p, i) => [i + 1, mean(p)]), cls: "bf5-l" + (o + 1), dots: true }));
  $("bf5GChart").innerHTML = plot({ w: 460, h: 220, xr: [0.5, 10.5], yr: range(D.flat(2), 0.1), xl: "part no.", yl: "mean of 3 trials (µm)", xn: 10, series: ser, title: "operators A (blue) B (grey) C (green) – lines should lie on top of each other", left: 40 })
    + plot({ w: 460, h: 160, xr: [0.5, 30.5], yr: [0, Math.max(...D.flatMap((op) => op.map((p) => Math.max(...p) - Math.min(...p)))) * 1.3], xl: "operator A 1 – 10 · B 11 – 20 · C 21 – 30", yl: "range", series: [{ pts: D.flatMap((op, o) => op.map((p, i) => [o * 10 + i + 1, Math.max(...p) - Math.min(...p)])), cls: "bf5-l1", dots: true }], hl: [{ y: 2.574 * A.rbarbar, t: "UCL_R = D4·R̄̄", cls: "bf5-ucl" }, { y: A.rbarbar, cls: "bf5-cl" }], title: "range chart (repeatability)", left: 40 });
}
function renderUnc() {
  const dT = +$("bf5URoom").value, L = +$("bf5UL").value, R = uncBudget(L, dT);
  $("bf5UTbl").innerHTML = tbl(["Contribution", "a (µm)", "Distribution", "u = a / divisor (µm)", "share"], R.rows.map((r) => [esc(r.n), f3(r.a), esc(r.dist), f3(r.u), f1(r.pct) + " %"]).concat([["<b>combined u_c = √Σu²</b>", "", "", `<b>${f3(R.uc)}</b>`, "100 %"], ["<b>expanded U = k · u_c (k = 2, ≈ 95 %)</b>", "", "", `<b>${f2(R.U)}</b>`, ""]]), "bf5-small");
  const lu = L * 1000, lim = leadLimits(lu), ep = lim.C5.ep, v3 = lim.C5.v300;
  $("bf5UDec").innerHTML = `<p class="bf5-sub2"><b>Decision rule ISO 14253-1 (supplier side):</b> conformity is proven only inside the tolerance reduced by U on each side (guard band).<br>
    C5 e_p ± ${ep} µm → conformance zone ± ${f2(ep - R.U)} µm · v_300 ≤ ${v3} µm → accept ≤ ${f2(v3 - R.U)} µm.<br>Rule of thumb: U ≤ 10 – 20 % of the tolerance → here U / (2·e_p) = ${f1(100 * R.U / (2 * ep))} %.
    ${dT > 0.5 ? `<br><b class="bf5-warn">Room ± ${dT} K: the α-uncertainty term grows – the guard band eats the tolerance. Keep 20 ± 0.5 °C for C3 / C5.</b>` : ""}</p>`
    + plot({ w: 420, h: 150, xr: [-ep * 1.3, ep * 1.3], yr: [0, 1], xl: "E − T (µm)", yn: 1, series: [], bands: [{ x0: -ep + R.U, x1: ep - R.U, y0: 0.3, y1: 0.7, cls: "bf5-band" }, { x0: -ep, x1: -ep + R.U, y0: 0.3, y1: 0.7, cls: "bf5-band3" }, { x0: ep - R.U, x1: ep, y0: 0.3, y1: 0.7, cls: "bf5-band3" }],
      vl: [{ x: -ep, t: "LSL", cls: "bf5-lim" }, { x: ep, t: "USL", cls: "bf5-lim" }], marks: [{ x: 0, y: 0.45, t: "conformance zone" }, { x: ep - R.U / 2, y: 0.8, t: "U" }], title: "tolerance, guard bands (orange) and conformance zone", left: 30 });
}

/* ------------------------------------------------------------------ 6 sampling, FAI, NCR, traceability, MES */
function renderAql() {
  const lot = Math.max(2, Math.min(500000, +$("bf5ALot").value || 2)), aql = $("bf5AAql").value, P = aqlPlan(lot, aql);
  $("bf5APlan").innerHTML = tbl(["Lot size", "Code letter (level II)", "Sample n", "Accept Ac", "Reject Re", "Note"], [[f0(lot), `${P.letter}${P.useLetter !== P.letter ? " → " + P.useLetter : ""}`, `<b>${P.n}</b>`, `<b>${P.ac}</b>`, P.re, esc(P.note || "–")]], "bf5-small")
    + `<p class="bf5-hint">Take ${P.n} parts at random. ≤ ${P.ac} defective → accept the lot; ≥ ${P.re} → reject (100 % sort or return). ${esc(AQL.use)}</p>`;
  const pts = [], pq = []; for (let p = 0; p <= 0.2001; p += 0.0025) pts.push([p * 100, ocPa(P.n, P.ac, p)]);
  $("bf5AOc").innerHTML = plot({ w: 460, h: 200, xr: [0, 20], yr: [0, 1.02], xl: "lot defective p (%)", yl: "P(accept)", series: [{ pts, cls: "bf5-l1" }], vl: [{ x: +aql, t: `AQL ${aql} %`, cls: "bf5-cl" }], title: `OC curve n = ${P.n}, Ac = ${P.ac}: Pa(AQL) = ${f1(100 * ocPa(P.n, P.ac, +aql / 100))} %`, left: 40 });
}
function renderFai() {
  $("bf5Fai").innerHTML = tbl(["Step", "What (example – AS9102 / PPAP ideas)"], [
    ["1 · Ballooned drawing", "every dimension, tolerance, note numbered (screw drawing ≈ 60 characteristics, rail ≈ 35)"], ["2 · Measure ALL characteristics", "first 1 – 3 parts of the new set-up / program / machine: CMM, contour, roughness, lead, hardness cut-up"],
    ["3 · Material + process records", "EN 10204 3.1 certificate (heat), heat-treatment chart, induction energy record"], ["4 · Report", "measured value vs spec per balloon, gauge id, decision; sign by QA"],
    ["5 · Release", "MES releases the lot only when the FAI record is 'approved' (HTTP POST /api/bsf/qa/results with char 'FAI')"], ["6 · Repeat", "after tool / wheel change of a CC operation, program change, machine move, 12 months no production"]], "bf5-small");
}
function renderNcrEx() {
  const E = NCR_EXAMPLE;
  $("bf5NSteps").innerHTML = NCR_STEPS.map((s, i) => `<span class="bf5-step" data-i="${i}"><b>${i + 1}. ${esc(s[1])}</b><br><span>${esc(s[2])}</span></span>`).join('<span class="bf5-arr">→</span>');
  $("bf5NEx").innerHTML = `<h3 class="bf5-h">Example 8D: ${esc(E.title)}</h3><p class="bf5-sub2"><b>IS:</b> ${esc(E.is)}<br><b>IS NOT:</b> ${esc(E.isnot)}</p><ol class="bf5-ul">${E.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ol>`
    + tbl(["Ishikawa (6M)", "Finding"], Object.entries(E.ishikawa).map(([k, v]) => [k, esc(v)]), "bf5-small") + `<ul class="bf5-ul">${E.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul><p class="bf5-sub2"><b>Verify:</b> ${esc(E.verify)}</p>`;
}
let ncr = null;
async function openNcr() {
  const r = lastNok || REC.slice().reverse().find((x) => x.decision === "NOK");
  const body = r ? { serial: r.serial, char: r.char, value: r.value, machine: r.machine, text: `${r.char} ${r.name} = ${fx(r.value, 3)} ${r.unit} outside ${r.lsl ?? "–"} … ${r.usl ?? "–"} (source ${r.source}, upstream ${r.up || "–"})` } : { char: "BS-V300", text: NCR_EXAMPLE.title };
  if (be.qa) { const x = await api("POST", "/api/bsf/qa/ncr", body, { "Idempotency-Key": uuid() }); ncr = x.ok ? x.data : { ...body, id: "NCR-local", steps: [{ step: "detect" }], status: "open" }; }
  else ncr = { ...body, id: "NCR-local-" + (Date.now() % 100000), steps: [{ step: "detect", text: body.text }], status: "open" };
  renderNcr();
}
async function nextNcr() {
  if (!ncr) await openNcr();
  const order = NCR_STEPS.map((s) => s[0]), last = ncr.steps[ncr.steps.length - 1].step; if (last === "close") return;
  const nx = order[order.indexOf(last) + 1], text = { contain: "lot + WIP blocked, 100 % re-check", "root-cause": "5-Why → see example", action: "interlock + chiller maintenance", verify: "3 lots OK, Ppk ≥ 1.33", close: "closed by QA" }[nx];
  if (be.qa && !String(ncr.id).startsWith("NCR-local")) { const x = await api("POST", `/api/bsf/qa/ncr/${ncr.id}/step`, { step: nx, text }); if (x.ok) ncr = x.data; }
  else { ncr.steps.push({ step: nx, text }); ncr.status = nx === "close" ? "closed" : nx; }
  renderNcr();
}
function renderNcr() {
  const done = ncr ? ncr.steps.map((s) => s.step) : [];
  $("bf5NSteps").querySelectorAll(".bf5-step").forEach((el, i) => el.classList.toggle("on", done.includes(NCR_STEPS[i][0])));
  $("bf5NLive").innerHTML = ncr ? `<b>${esc(ncr.id)}</b> · status <b>${esc(ncr.status)}</b> · ${esc(ncr.serial || "")} ${esc(ncr.char || "")}<br>${esc(ncr.text || "")}<br>${ncr.steps.map((s) => `${esc(s.step)}${s.text ? ": " + esc(s.text) : ""}`).join(" → ")}` : "";
}
function fillSerials(pick) {
  const sel = $("bf5TSer"); if (!sel) return; const cur = pick || sel.value, ser = [...new Set(REC.slice().reverse().filter((r) => r.source !== "history").map((r) => r.serial))].slice(0, 60);
  if (!ser.length) ser.push(...new Set(REC.slice(-30).map((r) => r.serial)));
  sel.innerHTML = ser.map((s) => `<option${s === cur ? " selected" : ""}>${s}</option>`).join(""); renderTrace();
}
function renderTrace() {
  const sn = $("bf5TSer").value, recs = REC.filter((r) => r.serial === sn); if (!recs.length) { $("bf5TGen").innerHTML = ""; $("bf5TRec").innerHTML = ""; return; }
  const r0 = recs[0], L = B ? B.lots.find((l) => l.id === r0.lot) : null, hist = L ? L.h : [];
  const gen = [["Serial", `<b>${esc(sn)}</b> (format ${esc(SERIAL.fmt[r0.part] || "")})`], ["Part", esc(r0.part)], ["Production lot", esc(r0.lot || "–") + (L ? ` (order ${esc(L.order)}, route ${esc(L.route)})` : "")], ["Heat lot (material)", esc(r0.heat || heatOf(r0.lot))],
    ["Upstream machine", esc(r0.up || "–")], ["Measured on", esc(r0.machine) + " · " + esc(r0.operator || "")]];
  $("bf5TGen").innerHTML = tbl(["Item", "Value"], gen, "bf5-small") + (hist.length ? `<h3 class="bf5-h">Operations of the lot (from the twin)</h3>` + tbl(["Op", "Machine", "In", "Out", "Good", "Scrap"], hist.map((h) => [h[0], h[1], B.clock ? fmtT(h[2]) : h[2], fmtT(h[3]), h[4], h[5]]), "bf5-small") : `<p class="bf5-hint">${esc(SERIAL.where)}</p>`);
  $("bf5TRec").innerHTML = `<h3 class="bf5-h">Measurement records</h3>` + tbl(["Char", "Name", "Value", "Spec", "Decision", "Gauge", "Source"], recs.map((r) => [r.char, esc(r.name), `${fx(r.value, 3)} ${esc(r.unit)}`, `${r.lsl ?? "–"} … ${r.usl ?? "–"}`, okb(r.decision === "OK"), esc(r.gauge).slice(0, 40), r.source]), "bf5-small")
    + `<h3 class="bf5-h">Data model (entities)</h3>` + tbl(["Entity", "Fields", "Owner"], SERIAL.entities.map((e) => e.map(esc)), "bf5-small");
}
const fmtT = (t) => { const d = Math.floor(t / 86400) + 1, s = ((t % 86400) + 86400) % 86400 + 6 * 3600; return `D${d} ${String(Math.floor(s / 3600) % 24).padStart(2, "0")}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}`; };
function resultBody() {
  const recs = lead && lead.recs ? lead.recs : REC.slice(-4);
  return { records: recs.map((r) => ({ serial: r.serial, part: BS.code, char: r.char, name: r.name, value: r.value, unit: r.unit, lsl: r.lsl, usl: r.usl, op: r.op, machine: r.machine, gauge: r.gauge,
    operator: r.operator, lot: r.lot, heat: r.heat, tMeas: new Date().toISOString().slice(0, 19) + "Z", source: "page" })) };
}
function renderPost(resp) {
  const b = resultBody();
  $("bf5PReq").textContent = `POST /api/bsf/qa/results HTTP/1.1\nContent-Type: application/json\nIdempotency-Key: <uuid>\n\n${JSON.stringify(b, null, 1).slice(0, 1800)}`;
  $("bf5PResp").textContent = resp ? `HTTP ${resp.status} (${f1(resp.ms)} ms)\n${typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data, null, 1)}` : `Instrument PC example (one record):\n${JSON.stringify(RESULT_EXAMPLE, null, 1)}`;
}
async function sendResult() {
  if (!be.qa) { renderPost({ status: 0, ms: 0, data: "backend /api/bsf/qa not reachable – records kept in the page (offline demo)" }); return; }
  const r = await api("POST", "/api/bsf/qa/results", resultBody(), { "Idempotency-Key": uuid() }); renderPost(r); return r;
}
let mesWo = null;
async function sendMes() {
  try {
    if (!mesWo) { const w = await api("POST", "/api/bsf/mes/workorders", { product: "BS", qty: 20 }, { "Idempotency-Key": uuid() }); if (!w.ok) throw new Error(JSON.stringify(w.data)); mesWo = w.data; await api("POST", `/api/bsf/mes/workorders/${mesWo.id}/release`, {}); }
    const op = (mesWo.operations || []).find((o) => o.machineType === "QC-LED"), good = lead && lead.ev && lead.ev.ok.C5 ? 1 : 0;
    const body = { wo: mesWo.id, op: op ? op.op : "90", machine: "QC-LED-01", good, scrap: 1 - good, serial: lead ? lead.serial : "", grade: lead ? lead.ev.grade : "" };
    const r = await api("POST", "/api/bsf/mes/confirmations", body, { "Idempotency-Key": uuid() });
    $("bf5PReq").textContent = `POST /api/bsf/mes/confirmations\nIdempotency-Key: <uuid>\n\n${JSON.stringify(body, null, 1)}`; $("bf5PResp").textContent = `HTTP ${r.status}\n${JSON.stringify(r.data, null, 1)}`; return r;
  } catch (e) { $("bf5PResp").textContent = "MES demo not reachable (item 4 backend /api/bsf/mes): " + e.message; return null; }
}
function renderMb() {
  if (!B) return;
  const m = instances("QC-LED")[0]; if (!m) return; B.signals(m);
  const nm = NET_BY_ID[m.id], rows = TYPE_MAPS["QC-LED"].filter((r) => r.name.startsWith("meas.")), st = rows[0].addr, q = rows[rows.length - 1].addr + rows[rows.length - 1].n - st;
  const req = reqRead(7, nm.unit, st, q), resp = demoServe(req, () => regImage(m), {}), dec = decodeFrame(resp, "resp", "QC-LED", st);
  $("bf5Mb").innerHTML = `<p class="bf5-sub2"><b>Machine → gateway (Modbus TCP):</b> the lead bench PLC writes its result into holding registers (signal group <code>meas</code>, REAL = 2 registers ABCD). The gateway reads them with FC03 after the "result ready" handshake and forwards them by HTTP. ${m.id} = ${nm.ip}, unit ${nm.unit}.</p>`
    + tbl(["Offset", "Name", "Type", "Unit", "Value (decoded)"], rows.map((r) => [r.addr, `<code>${r.name}</code>`, r.type, esc(r.unit), fx(dec.values[r.name], r.type === "REAL" ? 2 : 0)]), "bf5-small")
    + `<p class="bf5-mono">request&nbsp; ${hex(req)}<br>response ${hex(resp)}</p><p class="bf5-sub2"><b>Instrument PC → HTTP:</b> CMM, contour and roughness PCs have no Modbus; their software exports a result file or calls the HTTP API directly (JSON as on the left). Rule: only Modbus TCP below the gateway, only HTTP above.</p>`;
}
async function checkBackend() {
  try { const r = await api("GET", "/api/bsf/qa/health"); be.qa = r.ok && r.data && r.data.ok; } catch (e) { be.qa = false; }
  const b = $("bf5QaBe"); if (b) { b.textContent = be.qa ? "QA service /api/bsf/qa: online" : "QA service offline – page-only demo"; b.className = "bf5-badge" + (be.qa ? " on" : ""); }
  return be.qa;
}

/* ------------------------------------------------------------------ loop */
function tick() {
  if (!visible()) return;
  pollTwin();
  renderSpc();
  if (Math.random() < 0.2) { renderMb(); }
}
function loop() {
  requestAnimationFrame(loop);
  if (!visible() || !lead) return;
  if (!lead.done) { const p = Math.min(1, (performance.now() - lead.t0) / (LP.durS * 1000)); benchFrame(p); if (!lead._lastR || performance.now() - lead._lastR > 120 || p >= 1) { lead._lastR = performance.now(); renderLead(p); } if (p >= 1) finishLead(); }
  stationFrame();
}

/* ------------------------------------------------------------------ self-check (&bf5test) */
async function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("BF5TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const okk = Math.abs(got - exp) <= tol; okk ? pass++ : fail++; log(`${okk ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(7)} (hand ${Number(exp).toPrecision(7)} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const H = CHECK5;
  // lead – 8-point hand set
  const L8 = leadEval(H.lead8.x, H.lead8.e, 0, 10);
  chk("lead 8 points: slope b (µm/mm) = 19 100 / 420 000", L8.b, H.lead8.b, 1e-9); chk("E = b · 700", L8.E, H.lead8.E, 1e-5); chk("v_up", L8.vu, H.lead8.vu, 1e-5); chk("v_300", L8.v300, H.lead8.v300, 1e-5);
  ok("grade of the 8-point set = C5 (|E − T| 31.8 > C3 18, ≤ C5 35)", L8.grade === H.lead8.grade, L8.grade);
  const xs = Array.from({ length: 701 }, (_, i) => i), Lc = leadEval(xs, xs.map((x) => 2 * Math.cos(2 * Math.PI * (x - 350) / 10)), 0, 10);
  chk("cos curve (A = 2 µm, period 10 mm): E", Lc.E, 0, 1e-9); chk("cos curve v_2π = 2A", Lc.v2pi, 4, 1e-9); chk("cos curve v_300", Lc.v300, 4, 1e-9);
  const L7 = leadEval([0, 700], [0, 120], 0, 10); ok("C7 rule e_p = l_u / 300 · 50 = 116.7 µm → 120 µm is reject", L7.grade === "reject" && Math.abs(L7.lim.C7.ep - 116.6667) < 1e-3);
  // capability
  const cp = capability(H.cap.groups, H.cap.lsl, H.cap.usl);
  chk("X̄̄ of 5 × 5", cp.xbarbar, H.cap.xbarbar, 1e-9); chk("R̄", cp.rbar, H.cap.rbar, 1e-9); chk("σ = R̄ / 2.326", cp.sigmaWithin, H.cap.sigma, 1e-9); chk("Cp", cp.Cp, H.cap.Cp, 1e-5); chk("Cpk", cp.Cpk, H.cap.Cpk, 1e-5);
  chk("UCL X̄ = X̄̄ + A2·R̄", cp.UCLx, H.cap.UCLx, 1e-5); chk("UCL R = D4·R̄", cp.UCLr, H.cap.UCLr, 1e-5); chk("Pp", cp.Pp, H.cap.Pp, 1e-5);
  const im = imrStats([10, 12, 11, 13, 12], 5, 17); chk("I-MR: MR̄ = (2 + 1 + 2 + 1) / 4", im.mrbar, 1.5, 1e-12); chk("I-MR: σ = MR̄ / 1.128", im.sigmaWithin, 1.5 / 1.128, 1e-12);
  const we = weRules([0, 0, 0, 3.5, 0, 2.5, 2.4, 0, 1.2, 1.3, 1.1, 1.4, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], 0, 1);
  ok("Western Electric rules 1 (#4), 2 (#7), 3 (#12), 4 (#20)", we[3].includes(1) && we[6].includes(2) && we[11].includes(3) && we[19].includes(4), JSON.stringify(we.map((f, i) => f.length ? i + 1 + ":" + f.join("+") : "").filter(Boolean)));
  // GRR
  const G = grr(GRR_DATA, GRR_INFO.tol);
  chk("GRR R̄̄", G.ar.rbarbar, H.grr.rbarbar, 1e-6); chk("GRR X̄diff", G.ar.xdiff, H.grr.xdiff, 1e-6); chk("EV = R̄̄·0.5908", G.ar.EV, H.grr.EV, 1e-5); chk("AV", G.ar.AV, H.grr.AV, 1e-5); chk("GRR", G.ar.GRR, H.grr.GRR, 1e-5);
  chk("PV = Rp·0.3146", G.ar.PV, H.grr.PV, 1e-5); chk("%GRR (AR)", G.ar.pctGRR, H.grr.pctGRR, 1e-4); chk("ndc (AR)", G.ar.ndc, H.grr.ndc, 0); chk("%GRR of tolerance", G.ar.pctTol, H.grr.pctTol, 1e-4);
  chk("%GRR (ANOVA)", G.anova.pctGRR, H.grr.anovaPct, 1e-4); chk("ndc (ANOVA)", G.anova.ndc, H.grr.anovaNdc, 0); chk("F interaction", G.anova.F_interaction, H.grr.F, 1e-4);
  // sampling + uncertainty + torque
  for (const [lot, a, n, ac] of H.aql) { const P = aqlPlan(lot, a); ok(`ISO 2859-1 lot ${lot}, AQL ${a} → n ${n}, Ac ${ac}`, P.n === n && P.ac === ac, `${P.letter}→${P.useLetter} n ${P.n} Ac ${P.ac}`); }
  chk("OC: Pa(n 13, Ac 0, p 1 %) = 0.99^13", ocPa(13, 0, 0.01), Math.pow(0.99, 13), 1e-12);
  const ub = uncBudget(0.7, 0.5); chk("uncertainty u_c (700 mm, ± 0.5 K)", ub.uc, H.unc.uc, 1e-3); chk("expanded U (k = 2)", ub.U, H.unc.U, 2e-3);
  chk("preload torque Tp (item 2 formula)", TP0, 0.292097, 1e-5); ok("torque tolerance C5 at 0.29 N·m = ± 40 %", torqueTol(0.292, "C5") === 40);
  // data integrity
  ok("17 quality gates, every gate in the control plan", GATES.length === 17 && GATES.every((g) => g.chars.length > 0), GATES.filter((g) => !g.chars.length).map((g) => g.id).join(",") || "all linked");
  ok("control plan rows: unique ids, every op exists in the routing", new Set(CHARS.map((c) => c.id)).size === CHARS.length && CONTROL_PLAN.every((c) => c.process), `${CHARS.length} characteristics`);
  ok("SPC characteristics exist + have limits", SPC_CHARS.every((s) => CHAR_BY_ID[s.id] && (CHAR_BY_ID[s.id].lsl != null || CHAR_BY_ID[s.id].usl != null)));
  // live
  ok("history records seeded", REC.filter((r) => r.source === "history").length >= 300, `${REC.length} records`);
  for (const s of STATIONS) { try { const d = s.gen(U, s.opts ? s.opts[0][0] : undefined), v = s.view(d, 1); if (!(v.svg && v.table && v.rec.length)) throw new Error("empty"); pass++; log(`PASS station ${s.id} – ${v.rec.map((r) => r.char + " " + fx(r.value, 3)).join(", ")}`); } catch (e) { fail++; log(`FAIL station ${s.id} ${e.message}`); } }
  // profile station: nominal geometry must give 45° and f = 0.53 within noise
  { const s = STATION_BY_ID.profile, got = []; for (let i = 0; i < 5; i++) got.push(s.view(s.gen(rng(100 + i)), 1).rec[0].value); ok("profile fit: contact angle 43 – 47° on 5 random parts", got.filter((a) => a >= 43 && a <= 47).length >= 4, got.map((a) => a.toFixed(2)).join(" · ")); }
  const sim = leadSim({ ...LEAD_SIM, sysSd: 0, a2pi: 0, aLong: 0, noise: 0, riseGrind: 0, tGrind: 20, sys_um: 10, drift: 0, tMat: 21 }, rng(3));
  const evC = leadEval(sim.x, sim.comp, 0), evR = leadEval(sim.x, sim.raw, 0);
  chk("temperature compensation removes α·ΔT·l (E comp = 10 µm)", evC.E, 10, 1e-9); chk("raw reading at 21 °C: E = 10 + 11.5 · 0.7", evR.E, 10 + 11.5 * 0.7, 1e-9);
  const n0 = REC.length; B.runFor(1800, 10); pollTwin(); B.runFor(1800, 10); pollTwin();
  ok("twin → live records (pieces of the measuring machines)", REC.length >= n0, `+${REC.length - n0} records, live total ${liveN}`);
  while (!lead.done) await sleep(300);
  ok("lead bench finished + 4 records", lead.recs && lead.recs.length === 4, lead.serial + " grade " + lead.ev.grade);
  // backend
  await checkBackend();
  if (!be.qa) log("QA backend not reachable – browser-only checks done");
  else {
    const e1 = await api("POST", "/api/bsf/qa/eval", { kind: "lead", x: H.lead8.x, e: H.lead8.e, T: 0 });
    ok("Python = JavaScript: lead 8-point set", e1.ok && Math.abs(e1.data.E - L8.E) < 1e-9 && Math.abs(e1.data.v300 - L8.v300) < 1e-9 && e1.data.grade === L8.grade, `E ${e1.data.E}, v300 ${e1.data.v300}`);
    const sx = sim.x, se = lead.sim.comp, e2 = await api("POST", "/api/bsf/qa/eval", { kind: "lead", x: lead.sim.x, e: se, T: LP.T });
    const j2 = leadEval(lead.sim.x, se, LP.T);
    ok("Python = JavaScript: live lead curve (701 points)", e2.ok && ["E", "vu", "v300", "v2pi"].every((k) => Math.abs(e2.data[k] - j2[k]) < 1e-6) && e2.data.grade === j2.grade, `E ${fx(j2.E, 3)} v300 ${fx(j2.v300, 3)} v2π ${fx(j2.v2pi, 3)} ${j2.grade}`);
    const e3 = await api("POST", "/api/bsf/qa/eval", { kind: "capability", groups: H.cap.groups, lsl: 9, usl: 11 });
    ok("Python = JavaScript: Cp / Cpk", e3.ok && Math.abs(e3.data.Cpk - cp.Cpk) < 1e-9 && Math.abs(e3.data.Cp - cp.Cp) < 1e-9, `Cpk ${e3.data.Cpk}`);
    const e4 = await api("POST", "/api/bsf/qa/eval", { kind: "grr", data: GRR_DATA, tol: 80 });
    ok("Python = JavaScript: gauge R&R (AR + ANOVA)", e4.ok && Math.abs(e4.data.ar.pctGRR - G.ar.pctGRR) < 1e-9 && Math.abs(e4.data.anova.pctGRR - G.anova.pctGRR) < 1e-9 && e4.data.ar.ndc === G.ar.ndc, `%GRR ${f3(e4.data.ar.pctGRR)} / ${f3(e4.data.anova.pctGRR)}`);
    const pr = await sendResult(); ok("POST /api/bsf/qa/results → 201", pr && pr.status === 201 && pr.data.n === 4, pr ? JSON.stringify(pr.data).slice(0, 120) : "");
    const key = "k-" + uuid(), b1 = { serial: "T-1", char: "BS-V300", value: 25, usl: 18 }, p1 = await api("POST", "/api/bsf/qa/results", b1, { "Idempotency-Key": key }), p2 = await api("POST", "/api/bsf/qa/results", b1, { "Idempotency-Key": key });
    ok("decision NOK + idempotent replay", p1.status === 201 && p1.data.decision === "NOK" && p2.status === 200 && p2.data.replay === true && p2.data.id === p1.data.id);
    const bad = await api("POST", "/api/bsf/qa/results", { char: "X" }); ok("missing serial → 400 problem+json", bad.status === 400 && /problem\+json/.test(bad.ct));
    const tr = await api("GET", "/api/bsf/qa/trace?serial=" + encodeURIComponent(lead.serial)); ok("GET trace of the lead serial", tr.ok && tr.data.operations.length >= 1, tr.ok ? `${tr.data.operations[0].records.length} records, ${tr.data.decision}` : tr.status);
    const tn = await api("GET", "/api/bsf/qa/trace?serial=NOPE"); ok("unknown serial → 404", tn.status === 404);
    const tch = "T-" + uuid().slice(0, 8), many = { records: Array.from({ length: 30 }, (_, i) => ({ serial: "S-" + i, char: tch, value: H.cap.groups[Math.floor(i / 5) % 5][i % 5], lsl: 9, usl: 11 })) }; await api("POST", "/api/bsf/qa/results", many);
    const sp = await api("GET", "/api/bsf/qa/spc?char=" + tch + "&n=5"); ok("server SPC on posted values (6 subgroups)", sp.ok && sp.data.subgroups === 6, sp.ok ? `Cpk ${f3(sp.data.Cpk)}` : JSON.stringify(sp.data));
    await openNcr(); for (let i = 0; i < 5; i++) await nextNcr(); ok("NCR opened + 5 8D steps → closed", ncr && ncr.status === "closed" && ncr.steps.length === 6, `${ncr.id} ${ncr.status}`);
    const oo = await api("POST", `/api/bsf/qa/ncr/${ncr.id}/step`, { step: "contain" }); ok("step on a closed NCR → 409", oo.status === 409);
    const ms = await sendMes(); ok("MES confirmation (item 4 demo API) → 201", ms && ms.status === 201, ms ? JSON.stringify(ms.data).slice(0, 100) : "no MES");
  }
  finish();
  function finish() {
    const card = $("bfCard5"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : []; imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card bfCard5", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, CARD5.drawings.length, 0);
      ok("control plan table rows (BS)", $("bf5PlanTbl").querySelectorAll("tbody tr").length === CHARS.filter((c) => c.part === "BS").length);
      ok("SPC chart drawn", !!$("bf5SCharts").querySelector("svg"));
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("bf5Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre);
    }, 2500);
  }
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "5") build(); });
if (window.bfCtl && window.bfCtl.current() === "5" && window.bfCtl.tabVisible()) build();
