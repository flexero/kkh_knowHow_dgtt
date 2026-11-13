/* Ball screw + guide factory – item 3 "Factory layout + live 3D digital twin" (#bfItem3).  Guide: docs/42_bsf_layout_digital_twin.md
 * Files: bsflay.js (UI, KPIs, charts, what-if, card, self-check) · bsflay_data.js (hall, zones, placement, doors, flow + area calc, CARD3) ·
 *   bsflay_3d.js (instanced 3D hall) · bsflay_svg.js (plan + the 12 drawings 42_*.svg) · bsfsim.js (SHARED plant simulation, window.BSF) · bsflay.css.
 * Lazy: built on window event "bfitemshow" (detail "3"); Three.js + the simulation start only then; the 3D renders only when visible.
 * URL: /?bfitem=3#bsf · &bf3view=iso|top|walk|grind|ht · &bf3mode=state|util|wip|oee|energy · &bf3speed=1..3600 · &bf3pause · &bf3sel=<machine id> ·
 *   &bf3plan=block|detail · &bf3card=lay|twin|ctl|what (scroll) · &bf3what (run the what-if at start) · &bf3test (self-check, console "BF3TEST …" + #bf3Debug) ·
 *   &bf3hold (headless: keep the load event pending, show the tab) · card: &bf3tab=draw|buy|shop · &bf3box=N · &bf3svgdump (test: window.bf3Svg = all drawings).
 * Offline. ALL VALUES ARE EXAMPLES – check with your factory planner.
 */
import { PLANT, MTYPES, MACHINES, ROUTES, capacity, CAP0, opsOf, effCycle } from "./bsfmfg_data.js";
import { NOTE3, HALL, ZONES, PROD_ZONES, ZONE_OF, PLACE, LOT, AGV, flowMatrix, fleetSize, areaTable, layoutCheck, doorDist, adjKey, footRect, CARD3 } from "./bsflay_data.js";
import { getBSF, createSim, SIGFIELDS, STATES, STATE_KEYS } from "./bsfsim.js";
import { pagePlan, DRAW, DRAW_KEYS } from "./bsflay_svg.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sp = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const f0 = (v) => sp(Math.round(v)), f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2), pc = (v) => (v * 100).toFixed(1) + " %";
const host = $("bfItem3");
const errs = [];
if (Q.has("bf3test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf3hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf3hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("3"); }, 300); }

const STC = { OFF: "#4b4f55", IDLE: "#a9aeb4", STARVED: "#f2c94c", SETUP: "#1590a8", RUN: "#27ae60", BLOCKED: "#e67e22", DOWN: "#d03b3b" };
const RN = { FABS: "Ball screw set", FALG: "Guide set", BS: "Screw shaft", BN: "Ball nut", LG: "Rail", LB: "Carriage" };
let built = false, B = null, V3 = null, sel = Q.get("bf3sel") || null, uiT = null;
const visible = () => host && !host.hidden && (!window.bfCtl || window.bfCtl.tabVisible());
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf3-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const seg = (attr, items, cur) => `<span class="seg" role="group">${items.map(([k, t]) => `<button class="seg-btn${k === cur ? " active" : ""}" type="button" data-${attr}="${k}">${esc(t)}</button>`).join("")}</span>`;

/* ------------------------------------------------------------------ build */
function build() {
  if (built || !host) return; built = true;
  B = getBSF();
  if (Q.get("bf3speed")) B.setSpeed(+Q.get("bf3speed")); if (Q.has("bf3pause")) B.pause();
  const mode0 = Q.get("bf3mode") || "state", view0 = Q.get("bf3view") || "iso";
  host.innerHTML = `
  <div class="bf3-wrap">
    <div class="card" id="bf3Lay">
      <div class="card-head"><h2>1 · Layout design – hall, zones, flow</h2><span class="bf3-ctl">${seg("bf3p", [["block", "Block layout"], ["detail", "Detailed (machine ids)"]], Q.get("bf3plan") === "detail" ? "detail" : "block")}</span></div>
      <div class="bf3-plangrid">
        <div class="bf3-planbox" id="bf3Plan"></div>
        <div class="bf3-side" id="bf3Hall"></div>
      </div>
      <h3 class="bf3-h">Zones – size, machines, space factor, climate</h3><div id="bf3Area"></div>
      <h3 class="bf3-h">Layout principles with numbers (example)</h3><div id="bf3Rules"></div>
      <h3 class="bf3-h">From–to matrix – lots per day between zones (from the routings of item 2)</h3><div id="bf3FT"></div>
      <p class="hint">${esc(NOTE3)} Drawings: catalogue card at the end (12 drawings, also in docs/img/42_*.svg).</p>
    </div>

    <div class="card" id="bf3Twin">
      <div class="card-head"><h2>2 · Live 3D digital twin of the hall</h2>
        <span class="bf3-ctl">${seg("bf3v", [["iso", "Iso"], ["top", "Top"], ["grind", "Grinding room"], ["ht", "Heat treatment"], ["walk", "Walk-through"]], view0)}
          <label class="bf3-lbl">labels <select id="bf3Lbl" aria-label="labels"><option value="zones">zones + stores</option><option value="machines">+ machine ids</option><option value="off">off</option></select></label></span></div>
      <div class="bf3-bar">${seg("bf3m", [["state", "Machine state"], ["util", "Utilisation"], ["wip", "WIP queue"], ["oee", "OEE"], ["energy", "Power"]], mode0)}<span class="bf3-legend" id="bf3Legend"></span></div>
      <div class="bf3-main">
        <div class="scene3d bf3-3d" id="bf33d"><div class="bf3-msg">3D view is loading …</div><div class="bf3-clock" id="bf3Clock"></div></div>
        <div class="bf3-info" id="bf3Info"></div>
      </div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom. Click a machine → panel (state, lot, operation, counters, OEE, alarm, Modbus signal preview).
        Boxes = lots (colour = part: blue screw, green nut, orange rail, violet carriage, red screw set, grey guide set) waiting at the machines or on the AGVs (orange vehicles).
        Rack fill = stock. Walk-through: camera follows the aisles at eye height (click to stop). ${esc(NOTE3)}</p>
    </div>

    <div class="card" id="bf3Ctl">
      <div class="card-head"><h2>3 · Controls + live KPIs</h2><span class="bf2-small" id="bf3Sub"></span></div>
      <div class="bf3-bar" id="bf3Ctrls">
        <button class="btn primary" type="button" id="bf3Run"></button>
        <label class="bf3-lbl">speed <select id="bf3Spd" aria-label="simulation speed">${[[1, "× 1 (real time)"], [10, "× 10"], [60, "× 60 (1 s = 1 min)"], [300, "× 300"], [900, "× 900"], [3600, "× 3600 (1 s = 1 h)"]].map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label>
        <label class="bf3-lbl">shifts <select id="bf3Sh" aria-label="shifts"><option>1</option><option>2</option><option>3</option></select></label>
        <label class="bf3-lbl">OEE target <select id="bf3Oee" aria-label="OEE target">${[0.65, 0.7, 0.75, 0.8, 0.85, 0.9].map((v) => `<option>${v}</option>`).join("")}</select></label>
        <label class="bf3-lbl">AGVs <select id="bf3Agv" aria-label="AGV count">${[1, 2, 3, 4, 5, 6].map((v) => `<option>${v}</option>`).join("")}</select></label>
      </div>
      <div class="bf3-bar">
        <label class="bf3-lbl">daily mix: screw sets <input type="number" id="bf3MixA" min="0" max="400" step="10" style="width:76px" aria-label="screw sets per day"></label>
        <label class="bf3-lbl">guide sets <input type="number" id="bf3MixB" min="0" max="600" step="10" style="width:76px" aria-label="guide sets per day"></label>
        <button class="btn" type="button" id="bf3MixSet">set mix</button>
        <span class="bf3-sep"></span>
        <label class="bf3-lbl">add order <select id="bf3OP" aria-label="order product">${Object.entries(RN).map(([k, t]) => `<option value="${k}">${k} – ${t}</option>`).join("")}</select></label>
        <input type="number" id="bf3OQ" value="40" min="1" max="2000" style="width:76px" aria-label="order quantity"><button class="btn" type="button" id="bf3OAdd">add</button>
        <span class="bf3-sep"></span>
        <label class="bf3-lbl">break a machine <select id="bf3Brk" aria-label="machine">${MACHINES.map((m) => `<option>${m.id}</option>`).join("")}</select></label>
        <button class="btn warn" type="button" id="bf3BrkOn">break</button><button class="btn" type="button" id="bf3BrkOff">repair</button>
      </div>
      <div class="bf3-kpis" id="bf3Kpi"></div>
      <div class="bf3-charts" id="bf3Charts"></div>
      <div class="bf3-grid3">
        <div><h3 class="bf3-h">Events (newest first)</h3><div class="bf3-log" id="bf3Log"></div></div>
        <div><h3 class="bf3-h">Orders</h3><div id="bf3Ord"></div></div>
        <div><h3 class="bf3-h">Stores</h3><div id="bf3Sto"></div></div>
      </div>
    </div>

    <div class="card" id="bf3What">
      <div class="card-head"><h2>4 · What-if – quick compare (same engine, separate instances, runs in the background)</h2></div>
      <div class="bf3-bar" id="bf3WSel"></div>
      <div class="bf3-bar"><label class="bf3-lbl">warm-up <select id="bf3WW"><option>5</option><option selected>8</option><option>12</option></select> days</label>
        <label class="bf3-lbl">measure <select id="bf3WD"><option>5</option><option selected>7</option><option>14</option></select> days</label>
        <button class="btn primary" type="button" id="bf3WRun">Run what-if</button><span class="bf2-small" id="bf3WSt"></span></div>
      <div id="bf3WOut"></div>
      <p class="hint">Every scenario = a new simulation with the same random seed (same breakdown pattern where possible), warm-up first, then the KPIs are measured.
        Output per day is the average of the measured days. Compare with capacity() of item 2: the thread grinder is the bottleneck at 95.8 % (8 machines). ${esc(NOTE3)}</p>
    </div>
    <div class="bf3-debug" id="bf3Debug" hidden></div>
  </div>`;

  // layout card
  const showPlan = (k) => { $("bf3Plan").innerHTML = pagePlan(k === "detail"); host.querySelectorAll("[data-bf3p]").forEach((b) => b.classList.toggle("active", b.dataset.bf3p === k)); };
  host.querySelectorAll("[data-bf3p]").forEach((b) => b.addEventListener("click", () => showPlan(b.dataset.bf3p)));
  showPlan(Q.get("bf3plan") === "detail" ? "detail" : "block");
  buildHall(); buildArea(); buildRules(); buildFT();
  // controls
  $("bf3Run").addEventListener("click", () => { B.running ? B.pause() : B.run(); syncCtl(); });
  $("bf3Spd").addEventListener("change", (e) => B.setSpeed(+e.target.value));
  $("bf3Sh").addEventListener("change", (e) => B.setShifts(+e.target.value));
  $("bf3Oee").addEventListener("change", (e) => B.setOEE(+e.target.value));
  $("bf3Agv").addEventListener("change", (e) => B.setAGVs(+e.target.value));
  $("bf3MixSet").addEventListener("click", () => B.setMix({ FABS: +$("bf3MixA").value, FALG: +$("bf3MixB").value }));
  $("bf3OAdd").addEventListener("click", () => { B.addOrder({ product: $("bf3OP").value, qty: +$("bf3OQ").value }); refresh(); });
  $("bf3BrkOn").addEventListener("click", () => { B.setMachineDown($("bf3Brk").value, true); sel = $("bf3Brk").value; if (V3) V3.select(sel); refresh(); });
  $("bf3BrkOff").addEventListener("click", () => { B.setMachineDown($("bf3Brk").value, false); refresh(); });
  syncCtl();
  buildWhatSel(); $("bf3WRun").addEventListener("click", runWhat);
  try { makeCard(CARD3, host.querySelector(".bf3-wrap"), { card: "bfCard3", q: "bfQ3", g: "bfG3", cnt: "bfCnt3", buy: "bfBuy3" }, "bf3"); } catch (e) { console.error(e); }
  host.querySelector(".bf3-wrap").appendChild($("bf3Debug"));
  const cardMap = { lay: "bf3Lay", twin: "bf3Twin", ctl: "bf3Ctl", what: "bf3What" };
  if (cardMap[Q.get("bf3card")]) setTimeout(() => $(cardMap[Q.get("bf3card")]).scrollIntoView({ block: "start" }), 900);
  if (Q.has("bf3svgdump")) window.bf3Svg = Object.fromEntries(DRAW_KEYS.map((k) => [k, DRAW[k]()]));

  legend(mode0);
  host.querySelectorAll("[data-bf3m]").forEach((b) => b.addEventListener("click", () => { host.querySelectorAll("[data-bf3m]").forEach((x) => x.classList.toggle("active", x === b)); legend(b.dataset.bf3m); if (V3) V3.setMode(b.dataset.bf3m); }));
  host.querySelectorAll("[data-bf3v]").forEach((b) => b.addEventListener("click", () => { host.querySelectorAll("[data-bf3v]").forEach((x) => x.classList.toggle("active", x === b)); if (V3) V3.setView(b.dataset.bf3v); }));
  $("bf3Lbl").addEventListener("change", (e) => { if (V3) V3.setLabels(e.target.value); });

  import("./bsflay_3d.js").then((M3) => {
    const el = $("bf33d"); el.querySelector(".bf3-msg").remove();
    V3 = M3.createLay3D(el, B, { onPick: (id) => { sel = id; $("bf3Brk").value = id; refresh(); } });
    window.bf3View = V3;
    V3.setMode(mode0); if (view0 !== "iso") V3.setView(view0); if (sel) V3.select(sel);
    if (Q.has("bf3test")) setTimeout(selfTest, 800);
  }).catch((e) => { console.error(e); $("bf33d").innerHTML = `<div class="bf3-msg">3D could not load: ${esc(e.message)}</div>`; if (Q.has("bf3test")) setTimeout(selfTest, 300); });
  refresh();
  uiT = setInterval(() => { if (visible()) refresh(); }, 500);
  if (Q.has("bf3what")) setTimeout(runWhat, 1500);
}
function syncCtl() {
  $("bf3Run").textContent = B.running ? "❚❚ Pause" : "▶ Run"; $("bf3Spd").value = String([1, 10, 60, 300, 900, 3600].reduce((a, b) => (Math.abs(b - B.speed) < Math.abs(a - B.speed) ? b : a)));
  $("bf3Sh").value = String(B.shifts); $("bf3Oee").value = String(B.oee); $("bf3Agv").value = String(B.agvs.filter((a) => !a.retire).length);
  $("bf3MixA").value = B.mix.FABS; $("bf3MixB").value = B.mix.FALG;
}
function legend(mode) {
  const el = $("bf3Legend"); if (!el) return;
  if (mode === "state") { el.innerHTML = STATE_KEYS.map((k) => `<span class="bf3-lg"><i style="background:${STC[k]}"></i>${k}</span>`).join(""); return; }
  const lab = { util: ["0 %", "100 % utilisation (run + set-up) / shift time"], wip: ["0", "≥ 8 lots waiting at the machine type"], oee: ["0", "1.0 OEE = A × P × Q"], energy: ["0 kW", "≥ 60 kW power"] }[mode];
  el.innerHTML = `<span class="bf3-lg">${lab[0]}</span><span class="bf3-ramp"></span><span class="bf3-lg">${lab[1]}</span>`;
}

/* ------------------------------------------------------------------ layout card */
function buildHall() {
  const at = areaTable(), need = at.Am72 * 2.75 + 920;
  const tgr = MACHINES.filter((m) => m.type === "BS-TGR"), vib = MACHINES.filter((m) => ["BS-STR", "LG-STR", "BS-STH", "LG-STH", "MS-SAW", "LG-SAW", "LB-MC"].includes(m.type));
  let dmin = 1e9, pair = ""; for (const a of tgr) for (const b of vib) { const d = Math.hypot(PLACE[a.id][0] - PLACE[b.id][0], PLACE[a.id][1] - PLACE[b.id][1]); if (d < dmin) { dmin = d; pair = `${a.id} ↔ ${b.id}`; } }
  window.bf3Calc = { at, need, dmin, pair };
  $("bf3Hall").innerHTML = `<h3 class="bf3-h" style="margin-top:0">Hall size – worked example</h3>
    <table class="bf3-kv"><tbody>
      <tr><th>Machine footprint (73 instances)</th><td>${f1(at.Am)} m² (without laboratory ${f1(at.Am72)} m²)</td></tr>
      <tr><th>Space factor (aisles, operator, WIP, service)</th><td>2.5 – 3.0 → ${f0(at.Am72 * 2.5)} – ${f0(at.Am72 * 3)} m²</td></tr>
      <tr><th>+ raw store, packing / FG, main aisle, plant room</th><td>240 + 240 + 320 + 120 = 920 m²</td></tr>
      <tr><th>Needed (factor 2.75)</th><td><b>${f0(need)} m²</b></td></tr>
      <tr><th>Chosen hall</th><td><b>${HALL.L} × ${HALL.W} m = ${f0(at.hall)} m²</b>, columns ${HALL.colX} × ${HALL.colY} m, clear height ${HALL.h} m</td></tr>
      <tr><th>Annex (2 floors over the office part)</th><td>${HALL.L} × ${HALL.annex} m = ${f0(at.annex)} m²: offices + MES room, compressed air, coolant + chips, electrics, HT utilities</td></tr>
      <tr><th>Smallest hall (factor 2.5, tight)</th><td>≈ ${f0(at.Am72 * 2.5 + 920)} m² ≈ 68 × 48 m – no room for growth</td></tr>
      <tr><th>Thread grinder ↔ nearest press / saw / HMC</th><td>${f1(dmin)} m (${esc(pair)}) – target ≥ 15 – 20 m + isolated foundation</td></tr>
      <tr><th>Heat treatment ↔ grinding room</th><td>no common wall; nearest corners ≈ ${f1(Math.hypot(52 - 42, 28 - 24))} m apart (aisle + two walls)</td></tr>
    </tbody></table>
    <p class="bf2-small">Flow: goods-in in the north-west, shipping in the south-east (Z-flow). Climate rooms in the south half, away from the hot heat-treatment bay (north-east).</p>`;
}
function buildArea() {
  const at = areaTable();
  $("bf3Area").innerHTML = tbl(["Zone", "Size (m)", "Area m²", "Machines", "Machine m²", "Factor", "Climate", "Contents"], at.rows.map((r) => [
    `<b>${esc(ZONES[r.z].s)}</b>`, `${r.w} × ${r.d}`, f0(r.A), r.k, f1(r.Am), r.f ? `<b>${f2(r.f)}</b>` : "–", esc(ZONES[r.z].climate), esc(ZONES[r.z].t)]).concat([[
    "<b>Total production hall</b>", `${HALL.L} × ${HALL.W}`, `<b>${f0(at.hall)}</b>`, MACHINES.length, f1(at.Am), f2(at.hall / at.Am), "", "incl. main aisle 80 × 4 m"]]), "bf3-area");
}
function buildRules() {
  const R = [
    ["Material flow", "one direction, Z-flow: raw store (NW) → saw → soft machining → heat treatment (NE) → grinding room → measurement → assembly → packing + FG (SE)", "backflow only between neighbour rooms by hand cart; total loaded AGV transport ≈ " + f0(flowMatrix().dist) + " m/day"],
    ["Layout type", "hybrid: functional groups where the 4 routes share machines (soft machining, heat treatment, grinding room); product lines in assembly (screw line, guide line)", "a pure product cell per part would need ≈ 15 more machines (low utilisation of saws, furnaces, washers)"],
    ["Main aisle", "4.0 m: 2 one-way AGV lanes (vehicle 0.95 m + 2 × 0.5 m clearance each, EN ISO 3691-4 style – check) + walkway", "no machine opens into the main aisle; P/D points in niches"],
    ["Cell aisles", "3.0 – 3.5 m (AGV or forklift + operator); grinding room aisles 3.0 – 3.3 m", "service space behind machines ≥ 1.0 m, between machines ≥ 1.0 – 1.5 m (doors, chip conveyors)"],
    ["Climate rooms", "grinding room 20 ± 1 °C (thread grinders + lead measurement 20 ± 0.5 °C), measurement room 20 ± 0.5 °C, airlock, soak buffer", "soak ≥ 4 h: ≈ 9 shafts/h + 14 rails/h × 4 h ≈ 36 shafts + 56 rails in the buffer"],
    ["Vibration", "thread grinders + cylindrical grinders on isolated foundations (block 2 – 4 × machine mass, f0 4 – 10 Hz)", "presses, saws, HMCs ≥ 15 – 20 m away (here " + f1((window.bf3Calc || {}).dmin || 0) + " m); no AGV lane over a foundation block"],
    ["Floor + foundations", "slab 250 mm steel-fibre / reinforced, flatness for AGVs; oil-tight coated floor + sump in heat treatment", "furnace lines + quench tanks: point loads, pit for the quench tank – maker's foundation drawing"],
    ["Cranes", "5 t bridge crane over the heat-treatment bay (baskets, coils, oil service); no crane in the grinding room (air turbulence, heat)", "jib cranes 0.5 – 1 t at the lathes and presses (shafts 1 – 2 m), forklift / AGV for HMC tombstones"],
    ["Heat treatment", "own walled bay with fire wall, exhaust hoods over the quench + washers, gas + quench-oil supply from the annex", "kept away from the grinding room (no common wall); runs 3 shifts"],
    ["Growth", "east bays of assembly / packing + 10 m hall extension to the east", "grinding room can grow south (outside wall) without moving machines"],
  ];
  $("bf3Rules").innerHTML = tbl(["Topic", "Rule in this layout", "Numbers / reason"], R.map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2])]), "bf3-rules");
}
function buildFT() {
  const F = flowMatrix(), Fs = fleetSize(F), Z = F.zones;
  const head = ["from \\ to", ...Z.map((z) => ZONES[z].s)];
  const rows = Z.map((zf, i) => [`<b>${esc(ZONES[zf].s)}</b>`, ...Z.map((zt, j) => { const v = F.m[i][j]; if (!v) return "<span class='bf3-mut'>–</span>"; const man = adjKey(zf, zt); return `<b${man ? " class='bf3-man'" : ""}>${Number.isInteger(v) ? v : f1(v)}</b><br><span class="bf3-mut">${man ? "hand cart" : "AGV " + f0(doorDist(zf, zt)) + " m"}</span>`; })]);
  const per = Object.entries(F.per).map(([r, p]) => [`<b>${r}</b> ${esc(RN[r])}`, f1(p.start), LOT[r], f2(p.lots), p.legs, p.man, f0(p.dm), f1(p.lots * p.legs), f0(p.lots * p.dm)]);
  $("bf3FT").innerHTML = tbl(head, rows, "bf3-ft") +
    tbl(["Route", "Start pcs/day", "Lot", "Lots/day", "AGV legs per lot", "Hand-cart legs", "m per lot", "AGV trips/day", "m/day"], per.concat([["<b>Total</b>", "", "", "", "", "", "", `<b>${f1(F.agvTrips)}</b>`, `<b>${f0(F.dist)}</b>`]]), "bf3-per") +
    `<table class="bf3-kv" style="max-width:820px"><tbody>
      <tr><th>Average loaded trip d</th><td>${f1(Fs.avgD)} m (P/D point to P/D point on the lanes)</td></tr>
      <tr><th>Time per trip</th><td>d · (1 + 0.8 empty) / v + t_load + t_unload + t_doors = ${f1(Fs.avgD)} × 1.8 / ${AGV.v} + ${AGV.tLoad} + ${AGV.tUnload} + ${AGV.tDoor} = <b>${f0(Fs.tTrip)} s</b></td></tr>
      <tr><th>AGV busy time per day</th><td>${f1(F.agvTrips)} trips × ${f0(Fs.tTrip)} s = ${f2(Fs.busyH)} h</td></tr>
      <tr><th>AGVs needed (70 % max. utilisation, ${Fs.hours} h)</th><td>${f2(Fs.busyH)} / (${Fs.hours} × 0.7) = ${f2(Fs.need)} → <b>${Fs.n} AGV + 1 spare = ${Fs.n + 1}</b> (the twin starts with ${AGV.n})</td></tr>
      <tr><th>Transport work</th><td>${f0(F.dist)} m/day loaded + ≈ ${f0(F.dist * 0.8)} m/day empty = ${f0(Fs.mDay)} m/day</td></tr>
    </tbody></table>`;
}

/* ------------------------------------------------------------------ live refresh */
function refresh() {
  if (!B) return;
  const k = B.kpi();
  if ($("bf3Clock")) $("bf3Clock").textContent = `${k.clock} · × ${B.speed} · ${B.running ? "running" : "paused"}`;
  $("bf3Sub").textContent = `${k.clock} · measured ${f1(k.elapsedDays)} days since start${k.fromPrev ? " (first hours: rates of the 3 warm-up days)" : ""} · ${B.shifts} shifts · OEE target ${B.oee}`;
  syncRun();
  kpis(k); charts(); logs(); orders(); stores(); info();
}
function syncRun() { const b = $("bf3Run"); if (b) b.textContent = B.running ? "❚❚ Pause" : "▶ Run"; }
function kpis(k) {
  const last = k.outLastDay, tA = k.target.FABS, tB = k.target.FALG;
  const tile = (h, v, s, tone) => `<div class="kpi bf3-k${tone ? " " + tone : ""}"><div class="bf3-kh">${h}</div><div class="bf3-kv1">${v}</div><div class="bf3-ks">${s}</div></div>`;
  const tone = (v, t) => (t > 0 && v >= 0.97 * t ? "ok" : t > 0 && v >= 0.85 * t ? "warn" : "bad");
  const outA = last ? last.FABS : k.outPerDay.FABS, outB = last ? last.FALG : k.outPerDay.FALG;
  $("bf3Kpi").innerHTML = [
    tile("Screw sets / day", `${f0(outA)} <small>/ ${tA}</small>`, `${last ? "last full day" : "average"} · avg ${f1(k.outPerDay.FABS)} · today ${k.outToday.FABS}`, tone(outA, tA)),
    tile("Guide sets / day", `${f0(outB)} <small>/ ${tB}</small>`, `${last ? "last full day" : "average"} · avg ${f1(k.outPerDay.FALG)} · today ${k.outToday.FALG}`, tone(outB, tB)),
    tile("OEE (plant)", pc(k.oee), `A × P × Q, weighted · target ${B.oee}`),
    tile("Bottleneck", k.bottleneck ? esc(k.bottleneck.type) : "–", k.bottleneck ? `${k.bottleneck.n} machines busy ${pc(k.bottleneck.share)} of shift time` : ""),
    tile("WIP", `${k.wip.lots} lots`, `${f0(k.wip.pcs)} pieces in the plant`),
    tile("Lead time", k.leadTime_h ? `${f1(k.leadTime_h / 24)} d` : "–", `order → complete (${k.ordersDone} orders) · screw lot ${f1(k.flowTime_h.BS || 0)} h`),
    tile("AGVs", `${k.agvs} · ${pc(k.agvUtil)}`, `${f1(k.tripsPerDay)} trips/day · ${f0(k.mLoadedPerDay)} m loaded`),
    tile("Energy", `${f0(k.energyPerDay_kWh)} kWh/d`, `${f1(k.kWhPerSet)} kWh per set · now ${f0(k.powerNow)} kW`),
  ].join("");
}
/* small SVG line charts: thin lines, one y-axis, legend for ≥ 2 series, text in text colours, hover read-out */
function lineChart(id, title, series, unit, ymax) {
  const W = 340, H = 150, l = 40, r = 10, t = 22, b = 24, h = B.hist;
  if (!h.length) return `<div class="bf3-chart"><div class="bf3-ct">${esc(title)}</div><div class="bf3-mut" style="padding:30px 8px">collecting samples (every 10 min sim time) …</div></div>`;
  const xs = h.map((p) => p.t), x0 = xs[0], x1 = Math.max(x0 + 1, xs[xs.length - 1]);
  let ym = ymax || 0; for (const s of series) for (const p of h) ym = Math.max(ym, s.v(p)); ym = ym > 0 ? niceMax(ym) : 1;
  const X = (x) => l + (x - x0) / (x1 - x0) * (W - l - r), Y = (y) => t + (1 - y / ym) * (H - t - b);
  let g = ""; for (let i = 0; i <= 5; i++) { const yv = ym * i / 5; g += `<line x1="${l}" x2="${W - r}" y1="${Y(yv)}" y2="${Y(yv)}" class="bf3-grid"/><text x="${l - 4}" y="${Y(yv) + 4}" text-anchor="end" class="bf3-ax">${fmtAx(yv)}</text>`; }
  const days = Math.max(1, Math.round((x1 - x0) / 86400)); g += `<text x="${l}" y="${H - 6}" class="bf3-ax">${esc(B.clockOf(x0))}</text><text x="${W - r}" y="${H - 6}" text-anchor="end" class="bf3-ax">${esc(B.clockOf(x1))}</text>`;
  for (const s of series) g += `<polyline fill="none" stroke="${s.c}" stroke-width="1.6" points="${h.map((p) => X(p.t).toFixed(1) + "," + Y(s.v(p)).toFixed(1)).join(" ")}"/>`;
  const lg = series.length > 1 ? `<div class="bf3-clg">${series.map((s) => `<span><i style="background:${s.c}"></i>${esc(s.n)}</span>`).join("")}</div>` : "";
  return `<div class="bf3-chart" data-ch="${id}"><div class="bf3-ct">${esc(title)} <span class="bf3-mut">(${esc(unit)})</span></div>${lg}<svg viewBox="0 0 ${W} ${H}" class="bf3-csvg">${g}<line class="bf3-xh" x1="0" x2="0" y1="${t}" y2="${H - b}" visibility="hidden"/><rect x="${l}" y="${t}" width="${W - l - r}" height="${H - t - b}" fill="transparent" class="bf3-hit"/></svg><div class="bf3-tip" hidden></div></div>`;
}
const niceMax = (v) => { const p = 10 ** Math.floor(Math.log10(v)), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p; };
const fmtAx = (v) => (v >= 1000 ? f0(v) : v >= 10 ? Math.round(v) : v >= 1 ? v.toFixed(1) : v.toFixed(2));
const CH = () => [
  ["out", "Output today", [{ n: "screw sets", c: "var(--series-1, #2a78d6)", v: (p) => p.FABS }, { n: "guide sets", c: "var(--series-2, #eb6834)", v: (p) => p.FALG }], "sets since 06:00"],
  ["wip", "WIP", [{ n: "lots", c: "var(--series-1, #2a78d6)", v: (p) => p.wip }], "lots in the plant"],
  ["oee", "Plant OEE", [{ n: "OEE", c: "var(--series-1, #2a78d6)", v: (p) => p.oee }], "0 – 1", 1],
  ["kw", "Power", [{ n: "kW", c: "var(--series-1, #2a78d6)", v: (p) => p.kW }], "kW, machines + HVAC + air"],
];
let lastChartN = -1;
function charts() {
  const el = $("bf3Charts"); if (!el || B.hist.length === lastChartN) return; lastChartN = B.hist.length;
  const C = CH(); el.innerHTML = C.map(([id, t, s, u, m]) => lineChart(id, t, s, u, m)).join("");
  el.querySelectorAll(".bf3-chart[data-ch]").forEach((c) => {
    const hit = c.querySelector(".bf3-hit"), xh = c.querySelector(".bf3-xh"), tip = c.querySelector(".bf3-tip"), def = C.find((x) => x[0] === c.dataset.ch);
    hit.addEventListener("mousemove", (e) => { const r = hit.getBoundingClientRect(), f = (e.clientX - r.left) / r.width, i = Math.max(0, Math.min(B.hist.length - 1, Math.round(f * (B.hist.length - 1)))), p = B.hist[i];
      const sv = c.querySelector("svg").getBoundingClientRect(), xv = 40 + f * (340 - 50); xh.setAttribute("x1", xv); xh.setAttribute("x2", xv); xh.setAttribute("visibility", "visible");
      tip.hidden = false; tip.innerHTML = `${esc(B.clockOf(p.t))}<br>${def[2].map((s) => `${esc(s.n)}: <b>${fmtAx(s.v(p))}</b>`).join("<br>")}`; tip.style.left = Math.min(sv.width - 130, e.clientX - sv.left + 10) + "px"; });
    hit.addEventListener("mouseleave", () => { xh.setAttribute("visibility", "hidden"); tip.hidden = true; });
  });
}
function logs() {
  $("bf3Log").innerHTML = B.log.slice(0, 24).map((e) => `<div class="bf3-ev ${e.lvl}"><span class="bf3-mut">${esc(e.clock)}</span> <b>${esc(e.kind)}</b> ${esc(e.msg)}</div>`).join("") || "<span class='bf3-mut'>no events yet</span>";
}
function orders() {
  const os = B.orders.slice(-9).reverse();
  $("bf3Ord").innerHTML = tbl(["Order", "Product", "Qty", "Done", "State", "Lead / age"], os.map((o) => [esc(o.id), esc(o.product), o.qty, o.done, esc(o.state), o.tDone ? f1((o.tDone - o.t0) / 3600) + " h" : f1((B.t - o.t0) / 3600) + " h (open)"]), "bf3-small");
}
function stores() {
  const s = B.stores, smo = { BS: 0, BN: 0, LG: 0, LB: 0 }; for (const [k, v] of Object.entries(s.sm)) for (const r in smo) smo[r] += v[r] || 0;
  $("bf3Sto").innerHTML = tbl(["Store", "Screw / nut", "Rail / block"], [
    ["Raw blanks", `${f0(s.raw.BS)} / ${f0(s.raw.BN)}`, `${f0(s.raw.LG)} / ${f0(s.raw.LB)}`],
    ["Assembly kits (bought)", `${f0(s.kits.BS)} screw kits`, `${f0(s.kits.LB)} block kits`],
    ["Supermarket (parts)", `${smo.BS} / ${smo.BN}`, `${smo.LG} / ${smo.LB}`],
    ["FG store (sets)", `${s.fg.FABS} screw sets`, `${s.fg.FALG} guide sets`],
  ], "bf3-small") + `<p class="bf2-small">Goods-in 07:00 (reorder point 2 days, max 6 days), shipping 14:00 (complete orders). Kits pass the incoming check QC-INC-01.</p>`;
}
function info() {
  const el = $("bf3Info"); if (!el) return;
  const m = sel ? B.machine(sel) : null;
  if (!m) {
    const cnt = {}; for (const x of B.M) cnt[x.state] = (cnt[x.state] || 0) + 1;
    el.innerHTML = `<h3>Plant – ${esc(B.clock())}</h3><p class="bf2-small">Click a machine in 3D (or choose it in "break a machine") for its panel.</p>
      <table class="bf3-kv"><tbody>${STATE_KEYS.map((k) => `<tr><th><i class="bf3-dot" style="background:${STC[k]}"></i>${k}</th><td>${cnt[k] || 0} machines – ${esc(STATES[k].t)}</td></tr>`).join("")}</tbody></table>
      <h3 class="bf3-h">AGVs</h3><table class="bf3-kv"><tbody>${B.agvs.map((a) => `<tr><th>${esc(a.id)}</th><td>${esc(a.state)}${a.lot ? " · lot " + esc(a.lot.id) + " " + esc(a.from) + " → " + esc(a.to) : ""} · battery ${Math.round(a.soc)} % · ${a.trips} trips</td></tr>`).join("")}</tbody></table>
      <h3 class="bf3-h">Transport orders waiting</h3><p class="bf2-small">${B.tq.length ? B.tq.slice(0, 8).map((q) => `${esc(q.lot.id)} ${esc(q.from)} → ${esc(q.to)}${q.agv ? " (" + esc(q.agv) + ")" : ""}`).join("<br>") : "none"}</p>`;
    return;
  }
  const t = m.t, on = Math.max(1, t.on), bar = ["run", "setup", "down", "blocked", "starved", "idle"].map((k) => `<i style="width:${(t[k] / on * 100).toFixed(1)}%;background:${STC[{ run: "RUN", setup: "SETUP", down: "DOWN", blocked: "BLOCKED", starved: "STARVED", idle: "IDLE" }[k]]}" title="${k} ${(t[k] / on * 100).toFixed(1)} %"></i>`).join("");
  const grp = m.groups.map((g) => `<tr class="bf3-gh"><th colspan="3">group <b>${g}</b></th></tr>` + SIGFIELDS[g].map(([n, ty, u]) => `<tr><td>${esc(n)}</td><td class="bf3-mut">${ty}</td><td>${esc(fmtSig(m.sig[g][n]))} ${esc(u)}</td></tr>`).join("")).join("");
  el.innerHTML = `<h3><i class="bf3-dot" style="background:${STC[m.state]}"></i>${esc(m.id)} <span class="bf3-st">${m.state}</span></h3>
    <p class="bf2-small">${esc(m.name)} · zone ${esc(ZONES[m.zone].s)} · ${m.kW} kW · footprint ${m.foot.join(" × ")} m</p>
    <table class="bf3-kv"><tbody>
      <tr><th>State since</th><td>${esc(B.clockOf(m.since))} (${esc(STATES[m.state].t)})</td></tr>
      <tr><th>Current lot / order</th><td>${m.lot ? esc(m.lot) + " · " + esc(m.order) : "–"}</td></tr>
      <tr><th>Part · operation</th><td>${m.part ? esc(m.part) + " · op " + esc(m.op) + " " + esc(m.opName) : "–"}</td></tr>
      <tr><th>Pieces in lot</th><td>${m.pcsLot ? `${m.pcsDone} / ${m.pcsLot} · piece ${pc(m.progress)}` : "–"}</td></tr>
      <tr><th>Cycle ideal / last</th><td>${m.cycleIdeal_s ? f0(m.cycleIdeal_s) + " s" : "–"} / ${m.lastCycle_s ? f0(m.lastCycle_s) + " s" : "–"}</td></tr>
      <tr><th>Counters good / scrap</th><td>${f0(m.good)} / ${f0(m.scrap)}</td></tr>
      <tr><th>OEE = A × P × Q</th><td><b>${pc(m.oee.OEE)}</b> = ${f2(m.oee.A)} × ${f2(m.oee.P)} × ${f2(m.oee.Q)}</td></tr>
      <tr><th>Utilisation</th><td>${pc(m.util)} (run + set-up / shift time) · queue ${m.queue} lots</td></tr>
      <tr><th>Time split</th><td><span class="bf3-tbar">${bar}</span></td></tr>
      <tr><th>Power · energy</th><td>${f1(m.power_kW)} kW · ${f0(m.energy_kWh)} kWh</td></tr>
      <tr><th>MTBF / MTTR (example)</th><td>${m.mtbf_h} h / ${m.mttr_h} h · speed factor P ${f2(m.perf)}</td></tr>
      <tr><th>Alarm</th><td>${m.alarm ? `<b class="bf3-alarm">${m.alarm} – ${esc(m.alarmText)}</b>` : "none"}${m.lastAlarm ? `<br><span class="bf3-mut">last: ${m.lastAlarm.code} ${esc(m.lastAlarm.text)} (${esc(m.lastAlarm.clock)})</span>` : ""}</td></tr>
    </tbody></table>
    <div class="bf3-bar" style="margin:8px 0"><button class="btn warn" type="button" id="bf3PBrk">break</button><button class="btn" type="button" id="bf3PRep">repair</button><button class="btn ghost" type="button" id="bf3PClr">close</button></div>
    <h3 class="bf3-h">Modbus TCP signal groups (preview – item 4 maps them to registers)</h3>
    <table class="bf3-kv bf3-sig"><tbody>${grp}</tbody></table>`;
  $("bf3PBrk").onclick = () => { B.setMachineDown(m.id, true); refresh(); }; $("bf3PRep").onclick = () => { B.setMachineDown(m.id, false); refresh(); };
  $("bf3PClr").onclick = () => { sel = null; if (V3) V3.select(null); refresh(); };
}
const fmtSig = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v === undefined ? "–" : String(v));

/* ------------------------------------------------------------------ what-if */
const SCEN = [
  ["base", "Base (8 thread grinders, 2 AGVs, OEE 0.75, 2 shifts)", {}],
  ["tgr7", "7 thread grinders", { count: { "BS-TGR": 7 } }],
  ["tgr9", "9 thread grinders", { count: { "BS-TGR": 9 } }],
  ["oee85", "OEE 0.85", { oee: 0.85 }],
  ["oee65", "OEE 0.65", { oee: 0.65 }],
  ["agv1", "1 AGV", { agvs: 1 }],
  ["agv3", "3 AGVs", { agvs: 3 }],
  ["lot2", "Transfer lots ½ (10 / 20 / 25 / 50)", { lot: { BS: 10, BN: 20, LG: 25, LB: 50, FABS: 10, FALG: 25 } }],
  ["sh3", "3 shifts", { shifts: 3 }],
  ["mix120", "Demand + 20 % (144 + 240 sets)", { mix: { FABS: 144, FALG: 240 } }],
];
const SCEN0 = ["base", "tgr7", "oee85", "agv1", "agv3", "lot2"];
function buildWhatSel() { $("bf3WSel").innerHTML = SCEN.map(([k, t]) => `<label class="bf3-chk"><input type="checkbox" data-bf3w="${k}"${SCEN0.includes(k) ? " checked" : ""}> ${esc(t)}</label>`).join(""); }
let whatRes = null;
export function runScenario(o, warm, days, onDone, chunk = 0.5) {
  const X = createSim({ seed: 7, autoOrders: true, ...o }); let left = warm, phase = 0;
  const go = () => {
    const d = Math.min(chunk, left); X.runFor(d * 86400, 30); left -= d;
    if (left <= 1e-9) { if (phase === 0) { X.resetStats(); phase = 1; left = days; } else return onDone(X.kpi(), X); }
    setTimeout(go, 0);
  };
  go();
}
function runWhat() {
  const keys = [...host.querySelectorAll("[data-bf3w]")].filter((c) => c.checked).map((c) => c.dataset.bf3w); if (!keys.length) return;
  const warm = +$("bf3WW").value, days = +$("bf3WD").value, res = []; $("bf3WRun").disabled = true;
  const t0 = performance.now();
  const next = (i) => {
    if (i >= keys.length) { $("bf3WRun").disabled = false; $("bf3WSt").textContent = `done – ${keys.length} scenarios × ${warm + days} days in ${f1((performance.now() - t0) / 1000)} s`; whatRes = res; renderWhat(res); return; }
    const S = SCEN.find((s) => s[0] === keys[i]); $("bf3WSt").textContent = `running ${i + 1} / ${keys.length}: ${S[1]} …`;
    runScenario(S[2], warm, days, (k) => { res.push({ key: S[0], n: S[1], k }); renderWhat(res); next(i + 1); });
  };
  next(0);
}
function renderWhat(res) {
  const base = res.find((r) => r.key === "base");
  const d = (v, b, inv) => (b === undefined || b === null || !base ? "" : ` <span class="bf3-d ${(v - b) * (inv ? -1 : 1) > 0.005 * Math.abs(b) ? "up" : (v - b) * (inv ? -1 : 1) < -0.005 * Math.abs(b) ? "dn" : ""}">${v - b >= 0 ? "+" : "−"}${Math.abs(v - b) >= 10 ? f0(Math.abs(v - b)) : f1(Math.abs(v - b))}</span>`);
  $("bf3WOut").innerHTML = tbl(["Scenario", "Screw sets/day (target)", "Guide sets/day (target)", "OEE", "Bottleneck (busy)", "WIP lots", "Lead time d", "AGV util.", "AGV trips/day", "kWh per set"], res.map(({ n, k }) => {
    const b = base ? base.k : null;
    return [esc(n), `<b>${f1(k.outPerDay.FABS)}</b> (${k.target.FABS})${b ? d(k.outPerDay.FABS, b.outPerDay.FABS) : ""}`, `<b>${f1(k.outPerDay.FALG)}</b> (${k.target.FALG})${b ? d(k.outPerDay.FALG, b.outPerDay.FALG) : ""}`, pc(k.oee),
      k.bottleneck ? `${esc(k.bottleneck.type)} (${pc(k.bottleneck.share)})` : "–", `${k.wip.lots}${b ? d(k.wip.lots, b.wip.lots, true) : ""}`, `${f2(k.leadTime_h / 24)}${b ? d(k.leadTime_h / 24, b.leadTime_h / 24, true) : ""}`, pc(k.agvUtil), f1(k.tripsPerDay), f1(k.kWhPerSet)];
  }), "bf3-what") + `<p class="bf2-small">Green = better than the base, red = worse (for WIP + lead time lower is better). Lead time = order release → order complete (average of the orders completed in the measured days).</p>`;
}

/* ------------------------------------------------------------------ self-check (&bf3test) */
function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("BF3TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const okk = Math.abs(got - exp) <= tol; okk ? pass++ : fail++; log(`${okk ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${Number(exp).toPrecision(6)} ± ${Number(tol).toPrecision(3)})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  // layout
  const le = layoutCheck(0.5); ok("layout: every machine placed, inside its zone, ≥ 0.5 m gap", le.length === 0, le.slice(0, 5).join(" | ") || `${MACHINES.length} machines`);
  chk("placed machines", Object.keys(PLACE).filter((id) => MACHINES.some((m) => m.id === id)).length, 73, 0);
  const at = areaTable(); chk("machine footprint m² (73)", at.Am, 978.8, 0.05); chk("footprint without lab m²", at.Am72, 930.8, 0.05); chk("hall m²", at.hall, 80 * 48, 0);
  chk("zone areas sum = hall (production zones + plant room + aisle)", at.rows.reduce((s, r) => s + r.A, 0) + 80 * 4, 3840, 0.01);
  // capacity hand check: ideal output of the bottleneck
  const tg = opsOf("BS").find((o) => o.m === "BS-TGR"), eff = effCycle(tg), idx = opsOf("BS").indexOf(tg);
  const yAfter = opsOf("BS").slice(idx).reduce((y, o) => y * (1 - o.scrap / 100), 1);
  const ideal1 = 8 * 900 / eff; chk("thread grinding eff. time (min) = 40 + 45/20", eff, 42.25, 1e-9); chk("ideal TGR starts/day at OEE 1 = 8 × 900 / 42.25", ideal1, 170.414, 0.01);
  chk("max good screws/day at OEE 0.75 = starts × 0.75 × yield", ideal1 * 0.75 * yAfter, 120 * 8 / CAP0.mach["BS-TGR"].need, 0.05);
  // flow + AGV
  const F = flowMatrix(), handTrips = Object.values(F.per).reduce((s, p) => s + p.lots * p.legs, 0);
  chk("AGV trips/day = Σ lots/day × AGV legs", F.agvTrips, handTrips, 1e-9);
  chk("screw lots/day = ceil(120 / yield / 20)", F.per.BS.lots, Math.ceil(120 / opsOf("BS").reduce((y, o) => y * (1 - o.scrap / 100), 1) / 20), 1e-9);
  chk("distance RAW → SAW (m) = |28 − 25| + 12 + |28 − 25| (east lane y 25)", doorDist("RAW", "SAW"), Math.abs(28 - 25) + 12 + Math.abs(28 - 25), 1e-9);
  const Fs = fleetSize(F); chk("AGVs needed (70 %)", Fs.n, 1, 0);
  // shared instance
  ok("getBSF() = window.BSF, one instance", getBSF() === window.BSF && getBSF() === B);
  const snap = B.snapshot(), js = JSON.stringify(snap);
  ok("snapshot JSON-serialisable", js.length > 1000 && JSON.parse(js).machines.length === 73, `${f0(js.length / 1024)} kB, ${snap.machines.length} machines, ${snap.lots.length} lots, ${snap.agvs.length} AGVs`);
  const missing = []; for (const m of snap.machines) for (const g of MTYPES[m.type].sig) for (const [n] of SIGFIELDS[g]) if (m.sig[g] === undefined || m.sig[g][n] === undefined) missing.push(m.id + "." + g + "." + n);
  ok("every machine has every SIGFIELDS field of its groups", missing.length === 0, missing.slice(0, 4).join(", ") || `${snap.machines.reduce((s, m) => s + Object.values(m.sig).reduce((a, g) => a + Object.keys(g).length, 0), 0)} fields`);
  ok("state codes 0 … 6 and status bit matches", snap.machines.every((m) => m.code === STATES[m.state].code && (m.sig.std.status & (1 << STATES[m.state].bit))));
  // events + methods on a separate instance
  const X = createSim({ seed: 3 }); let evM = 0, evA = 0, evL = 0, evS = 0, evT = 0; X.on("machine", () => evM++); X.on("alarm", () => evA++); X.on("lot", () => evL++); X.on("stock", () => evS++); X.on("tick", () => evT++);
  X.runFor(3600 * 4, 10); X.setMachineDown("BS-TGR-03", true); const dn = X.byId["BS-TGR-03"].state; X.step(60); const still = X.byId["BS-TGR-03"].state; X.setMachineDown("BS-TGR-03", false);
  ok("setMachineDown → DOWN (stays until repaired) → repaired", dn === "DOWN" && still === "DOWN" && X.byId["BS-TGR-03"].state !== "DOWN");
  const nO = X.orders.length, nL = X.lots.length; const o = X.addOrder({ product: "BN", qty: 50 }); ok("addOrder: order + lots", X.orders.length === nO + 1 && X.lots.length > nL, `${o.id}, ${X.lots.length - nL} lots of ≤ ${LOT.BN}`);
  ok("events fire (machine, alarm, lot, stock, tick)", evM > 0 && evA > 0 && evL > 0 && evS > 0 && evT > 0, `machine ${evM}, alarm ${evA}, lot ${evL}, stock ${evS}, tick ${evT}`);
  // background run: Little, output, bottleneck, AGV trips
  log("background run: 8 days warm-up + 10 days …");
  const tB = performance.now();
  runScenario({}, 8, 10, (k, Y) => {
    log(`background run done in ${f0(performance.now() - tB)} ms`);
    chk("Little's law: WIP lots L = λ × W (10 days)", k.little.L, k.little.LW, 0.1 * k.little.L);
    ok("screw sets/day ≥ 0.9 × 120", k.outPerDay.FABS >= 108, `${k.outPerDay.FABS} per day`); ok("guide sets/day ≥ 0.9 × 200", k.outPerDay.FALG >= 180, `${k.outPerDay.FALG} per day`);
    ok("bottleneck = BS-TGR (as capacity() of item 2)", k.bottleneck && k.bottleneck.type === "BS-TGR", k.bottleneck ? `${k.bottleneck.type} ${pc(k.bottleneck.share)}` : "");
    chk("AGV trips/day sim vs from–to matrix (whole lots)", k.tripsPerDay, F.agvTrips, 0.15 * F.agvTrips);
    ok("plant OEE 0.6 … 0.8 at target 0.75", k.oee > 0.6 && k.oee < 0.8, pc(k.oee));
    runScenario({ count: { "BS-TGR": 7 } }, 8, 10, (k7) => {
      ok("what-if: 7 thread grinders → fewer screw shafts per day", k7.outPerDay.BS < k.outPerDay.BS - 5, `${k7.outPerDay.BS} vs ${k.outPerDay.BS} (sets ${k7.outPerDay.FABS} vs ${k.outPerDay.FABS})`);
      ok("what-if: 7 TGR screw shafts ≤ hand capacity 109.6 + 5 %", k7.outPerDay.BS <= 109.6 * 1.05, `${k7.outPerDay.BS}`);
      ok("what-if: 7 thread grinders → still TGR bottleneck", k7.bottleneck && k7.bottleneck.type === "BS-TGR");
      chk("7 TGR max (hand) = 125.26 × 7/8", 120 * 7 / CAP0.mach["BS-TGR"].need, 109.6, 0.1);
      threeDTests();
    });
  });
  function threeDTests() {
    // drawings
    const svgs = DRAW_KEYS.map((k) => [k, DRAW[k]()]);
    chk("drawings", svgs.length, 12, 0);
    const bad = svgs.filter(([k, s]) => !/viewBox/.test(s) || !s.includes("EXAMPLE – check with your planner") || /[↑↓]/.test(s) || /font-size="(\d+(\.\d+)?)"/g.test(s) && [...s.matchAll(/font-size="([\d.]+)"/g)].some((m) => +m[1] < 11));
    ok("drawings: viewBox, title block, no ↑/↓, text ≥ 11 px", bad.length === 0, bad.map((b) => b[0]).join(", "));
    const V = window.bf3View;
    if (V) { $("bf3Twin").scrollIntoView({ block: "start" });
      const c = V.counts(); chk("3D machines", c.machines, 73, 0); ok("3D instanced (draw objects < 200)", c.drawObjects < 200, JSON.stringify(c));
      const shots = []; const views = ["iso", "top", "grind"];
      const doShot = (i) => {
        if (i >= views.length) return evalShots();
        V.setView(views[i]); setTimeout(() => { shots.push([views[i], V.snapshot()]); doShot(i + 1); }, 900);
      };
      const evalShots = () => { let n = 0;
        shots.forEach(([nm, url]) => { const img = new Image(); img.onload = () => {
          const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80; const g2 = cv.getContext("2d"); g2.drawImage(img, 0, 0, 120, 80);
          const d = g2.getImageData(0, 0, 120, 80).data; let mm = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 233) + Math.abs(d[i + 1] - 237) + Math.abs(d[i + 2] - 241) > 40) mm++;
          ok(`3D snapshot ${nm} not blank`, mm > 600, `${mm} of 9600 pixels differ from the background`);
          const dbg = $("bf3Debug"); const im = document.createElement("img"); im.src = url; im.alt = "3D snapshot " + nm + " (test)"; im.className = "bf3-shot"; dbg.appendChild(im);
          if (++n === shots.length) { V.setView("iso"); finish(); } }; img.src = url; });
      };
      setTimeout(() => doShot(0), 300);
    } else { ok("3D view built", false); finish(); }
  }
  function finish() {
    const card = $("bfCard3"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card bfCard3", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings", imgs.length, 12, 0); chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, 12, 0);
      ok("card is after the what-if card", card && card.previousElementSibling && card.previousElementSibling.id === "bf3What");
      ok("KPI tiles + charts rendered", $("bf3Kpi").children.length === 8 && $("bf3Charts").children.length === 4);
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("bf3Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre);
    }, 2500);
  }
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "3") { build(); setTimeout(() => { if (V3) V3.resize(); refresh(); }, 0); } });
if (window.bfCtl && window.bfCtl.current() === "3" && window.bfCtl.tabVisible()) build();
