/* AS/RS raw materials – item 6 "Stacker crane – structure + manufacturing (3D build twin)" (#srItem6).
 * Guide: docs/38_asrs_stacker_crane_manufacturing.md · same crane as item 1 (guide 31): geometry from asrs3d_scene.js, masses + calcs from guide 31 §7.
 * Files: asrscrane.js (UI, lazy build, self-check) · asrscrane_3d.js (Three.js model, views, load path, assembly animation) · asrscrane_calc.js (checks) ·
 *   asrscrane_mfg.js (animated SVG of each manufacturing operation) · asrscrane_data.js (assemblies, part info, routes, assembly steps, BOM, card) · asrscrane.css.
 * Lazy: built on window event "sritemshow" (detail "6") or at load when item 6 of the visible AS/RS tab is shown; Three.js is imported only then.
 * Rendering on demand; nothing runs while the item / tab is hidden.
 * URL: ?sritem=6#asrs · &sr6view=assembled|exploded|xray|section · &sr6ex=0..1 · &sr6focus=<assembly> · &sr6pick=<part> · &sr6flow · &sr6part=<route> · &sr6op=N ·
 *   &sr6step=N · &sr6card=load|mfg|asm|bom · &sr6test (self-check, console "SR6TEST …" + #sr6Debug) · &sr6back (6→1→6) · &sr6hold (headless: keep load pending) ·
 *   card: &sr6tab=draw|buy|shop · &sr6q=text · &sr6box=N · &sr6scroll. Offline. ALL VALUES ARE EXAMPLES – the crane maker's drawings decide.
 */
import { RACK, CRANE } from "./asrscore.js";
import { ASM, ASM_KEYS, PARTS6, ROUTES, ROUTE_KEYS, OPNAME, ASSY, BOM, CARD6, NOTE6 } from "./asrscrane_data.js";
import { calc6, DEF6, INP6, CHECK6 } from "./asrscrane_calc.js";
import { opSvg, OP_TYPES } from "./asrscrane_mfg.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hex = (c) => "#" + c.toString(16).padStart(6, "0");
const fv = (v) => (typeof v !== "number" || !Number.isFinite(v) ? esc(v) : Math.abs(v) >= 1e6 ? v.toExponential(2) : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));
const host = $("srItem6");
const errs = [];
if (Q.has("sr6test") || Q.has("sr6back")) {
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
}
// test only (&sr6hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots wait for --timeout)
if (Q.has("sr6hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?sr6hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("asrs"); else { const b = document.querySelector('[data-tab="asrs"]'); if (b) b.click(); } }, 300); }

let built = false, V1 = null, V2 = null, calcInp = {}, mfg = { part: "mast", op: 0, t: 0, play: true, all: false }, lastF = null;
const asmMass = {}; BOM.forEach((r) => { asmMass[r[6]] = (asmMass[r[6]] || 0) + r[4] * r[5]; });

function build() {
  if (built || !host) return; built = true;
  const VIEWS = [["assembled", "Assembled"], ["exploded", "Exploded"], ["xray", "X-ray"], ["section", "Section"]];
  host.innerHTML = `
  <div class="sr6-wrap">
    <div class="card" id="sr6Struct">
      <div class="card-head"><h2>Structure – 3D build twin of the single-mast stacker crane</h2>
        <span class="sr6-ctl">
          <span class="seg" role="group" aria-label="view">${VIEWS.map(([k, t]) => `<button class="seg-btn" data-sr6view="${k}">${t}</button>`).join("")}</span>
          <label class="sr6-lbl">explode <input type="range" id="sr6Ex" min="0" max="100" value="0" aria-label="explode"></label>
          <button class="btn" type="button" id="sr6ExPlay" title="animate: assembled → exploded → assembled">▶ Play</button>
          <select id="sr6Focus" aria-label="focus one assembly"><option value="">focus: all assemblies</option>${ASM_KEYS.map((k) => `<option value="${k}">${esc(ASM[k].n)}</option>`).join("")}</select>
          <label class="sr6-chk"><input type="checkbox" id="sr6Lbl" checked> labels</label>
          <label class="sr6-chk"><input type="checkbox" id="sr6Flow"${Q.has("sr6flow") ? " checked" : ""}> load path</label>
          <button class="btn ghost" type="button" id="sr6Fit">Fit</button>
        </span></div>
      <div class="sr6-main">
        <div class="scene3d sr6-3d" id="sr63d"><div class="sr6-msg">3D view is loading …</div></div>
        <div class="sr6-info" id="sr6Info"></div>
      </div>
      <div class="sr6-legend" id="sr6Legend">${ASM_KEYS.map((k) => `<button type="button" class="sr6-lg" data-sr6asm="${k}"><i style="background:${hex(ASM[k].c)}"></i>${esc(ASM[k].n)} <small>≈ ${Math.round(asmMass[k] || 0)} kg</small></button>`).join("")}</div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom, double-click = new orbit point. <b>Click any part</b> for its function, size, material, tolerances, weight, how it fails and what to check.
        <b>X-ray</b> shows the inside (green = internal diaphragms of the mast and the box beam), <b>Section</b> cuts the crane at the mast centre plane. Click a legend chip to focus one assembly.
        Same crane and dimensions as item 1 (wheelbase 2.4 m, mast 500 × 350 × 9.3 m, fork stroke ± 1.35 m). ${esc(NOTE6)}</p>
    </div>

    <div class="card" id="sr6Load">
      <div class="card-head"><h2>How it carries the load – load path + main calculations</h2><span class="sub">simplified, hand-checkable · guide 38 §7 · consistent with guide 31 §7</span></div>
      <div class="sr6-loadgrid">
        <div class="sr6-loadsvg" id="sr6LoadSvg"></div>
        <div><div class="sr6-inp" id="sr6Inp"></div>
          <p class="sr6-note">Change an input – every number, the 3D load-path labels and the drawing update. Example inputs = the crane of item 1 (load 300 kg, 0.5 m/s², wall 6 mm, reach 1 350 mm, rope Ø8, weld a 5, emergency braking = 2 × the inertia).</p></div>
      </div>
      <div id="sr6CalcOut"></div>
      <p class="sr6-note">Simplified checks for understanding (FEM 9.831 / EN 13001 / EN 1993 ideas, no full code check). The crane maker proves the structure (load cases, fatigue, tests per EN 528) – ask for the calculation report.</p>
    </div>

    <div class="card" id="sr6Mfg">
      <div class="card-head"><h2>Manufacturing twin – how each part is made</h2><span class="sub" id="sr6MfgSub"></span></div>
      <div class="sr6-parts" id="sr6Parts">${ROUTE_KEYS.map((k) => `<button type="button" class="btn" data-sr6part="${k}">${esc(ROUTES[k].n.replace(/ \(.*/, ""))}</button>`).join("")}</div>
      <div class="sr6-mfggrid">
        <div><div class="sr6-player" id="sr6Player"></div>
          <div class="sr6-pctl"><button class="btn" type="button" id="sr6Prev">◀ previous</button><button class="btn primary" type="button" id="sr6Play">❚❚ Pause</button>
            <button class="btn" type="button" id="sr6Next">next ▶</button><button class="btn ghost" type="button" id="sr6All" title="play all operations of this part one after the other">▶▶ whole route</button></div></div>
        <div class="sr6-opinfo" id="sr6OpInfo"></div>
      </div>
      <h3 class="sr6-h">Route sheet (click a row to play that operation)</h3>
      <div class="table-wrap"><table class="sr6-tbl sr6-route" id="sr6Route"></table></div>
    </div>

    <div class="card" id="sr6Asm">
      <div class="card-head"><h2>Assembly + installation on site – animated sequence</h2>
        <span class="sr6-ctl"><button class="btn primary" type="button" id="sr6AsmPlay">▶ Play all steps</button></span></div>
      <div class="sr6-main">
        <div class="scene3d sr6-3d sr6-3dasm" id="sr6Asm3d"><div class="sr6-msg">3D view loads when visible …</div></div>
        <div class="sr6-info" id="sr6Steps"></div>
      </div>
      <div class="table-wrap"><table class="sr6-tbl" id="sr6StepTbl"></table></div>
    </div>

    <div class="card" id="sr6Bom">
      <div class="card-head"><h2>Parts list (BOM) – make or buy</h2>
        <span class="sr6-ctl"><span class="seg" role="group" aria-label="filter">${[["", "all"], ["MAKE", "make"], ["BUY", "buy"]].map(([k, t]) => `<button class="seg-btn${k ? "" : " active"}" data-sr6bom="${k}">${t}</button>`).join("")}</span></span></div>
      <div class="table-wrap"><table class="sr6-tbl" id="sr6BomTbl"></table></div>
      <p class="sr6-note">Make-or-buy depends on your workshop: a floor-type boring mill long enough for the mast pads, a stress-relief furnace (or subcontract), NDT staff (ISO 9712). Purchased parts with example makers: see the catalogue card below. ${esc(NOTE6)}</p>
    </div>
    <div class="sr6-debug" id="sr6Debug" hidden></div>
  </div>`;

  /* ---------------- structure card */
  const info = $("sr6Info");
  function infoDefault() {
    info.innerHTML = `<h3>13 assemblies – click a part</h3><p class="sr6-small">A single-mast stacker crane is a vertical column (mast) on a travelling beam (bottom carriage) with 2 wheels. The lifting carriage runs up the mast on rollers;
      the telescopic fork moves the crate sideways into the rack. Top guide rollers keep the mast vertical across the aisle.</p>
      <table class="sr6-kv">${ASM_KEYS.map((k) => `<tr><th><i class="sr6-dot" style="background:${hex(ASM[k].c)}"></i>${esc(ASM[k].n)}</th><td>${Math.round(asmMass[k] || 0)} kg</td></tr>`).join("")}
      <tr><th><b>total (BOM)</b></th><td><b>${Math.round(BOM.reduce((s, r) => s + r[4] * r[5], 0))} kg</b></td></tr></table>
      <p class="sr6-small">Moving mass in item 1: ${CRANE.mass} kg empty + 300 kg load (guide 31 §7.4).</p>`;
  }
  function showPart(k) {
    const p = PARTS6[k]; if (!p) { infoDefault(); return; }
    info.innerHTML = `<button type="button" class="sr6-x" aria-label="close">✕</button><h3>${esc(p.n)}</h3><div class="sr6-asm"><i class="sr6-dot" style="background:${hex(ASM[p.a].c)}"></i>${esc(ASM[p.a].n)}</div>
      <dl class="sr6-dl"><dt>What it does</dt><dd>${esc(p.fn)}</dd><dt>Size (example)</dt><dd>${esc(p.size)}</dd><dt>Material</dt><dd>${esc(p.mat)}</dd><dt>Tolerances</dt><dd>${esc(p.tol)}</dd>
      <dt>Weight</dt><dd>${esc(p.kg)}</dd><dt>How it fails</dt><dd>${esc(p.fail)}</dd><dt>What to check</dt><dd>${esc(p.chk)}</dd></dl>
      ${routeFor(p.a) ? `<button type="button" class="btn ghost" data-sr6goto="${routeFor(p.a)}">How it is made →</button>` : ""}<p class="sr6-small">${esc(NOTE6)}</p>`;
    info.querySelector(".sr6-x").addEventListener("click", () => { if (V1) V1.select(null); infoDefault(); });
    const g = info.querySelector("[data-sr6goto]"); if (g) g.addEventListener("click", () => { setPart(g.dataset.sr6goto); $("sr6Mfg").scrollIntoView({ block: "start", behavior: "smooth" }); });
  }
  const routeFor = (a) => ({ bottom: "bottom", wheels: "wheel", mast: "mast", top: "top", carriage: "carriage", fork: "fork", hoist: "drum" }[a]);
  infoDefault();
  const updViewBtns = () => host.querySelectorAll("[data-sr6view]").forEach((b) => b.classList.toggle("active", V1 && b.dataset.sr6view === V1.S.view));
  host.querySelectorAll("[data-sr6view]").forEach((b) => b.addEventListener("click", () => { if (!V1) return; V1.setView(b.dataset.sr6view); updViewBtns(); }));
  $("sr6Ex").addEventListener("input", (e) => { if (V1) { V1.setExplode(+e.target.value / 100); V1.S.view = V1.S.ex > 0.5 ? "exploded" : V1.S.view === "exploded" ? "assembled" : V1.S.view; updViewBtns(); } });
  let exPlay = 0;
  $("sr6ExPlay").addEventListener("click", () => { if (!V1) return; clearTimeout(exPlay); V1.animEx(1); exPlay = setTimeout(() => V1.animEx(0), 3200); });
  $("sr6Focus").addEventListener("change", (e) => { if (V1) V1.focus(e.target.value || null); });
  host.querySelectorAll("[data-sr6asm]").forEach((b) => b.addEventListener("click", () => { const k = b.dataset.sr6asm, cur = $("sr6Focus").value === k ? "" : k; $("sr6Focus").value = cur; if (V1) V1.focus(cur || null); }));
  $("sr6Lbl").addEventListener("change", (e) => { if (V1) V1.labels(e.target.checked); });
  $("sr6Flow").addEventListener("change", (e) => { if (!V1) return; if (e.target.checked) { V1.setExplode(0); $("sr6Ex").value = 0; } V1.flow(e.target.checked, lastF); });
  $("sr6Fit").addEventListener("click", () => { if (V1) V1.frameAll(); });

  /* ---------------- load card */
  $("sr6Inp").innerHTML = INP6.map(([k, t, u]) => `<label>${t} <input type="number" step="any" data-sr6in="${k}" value="${DEF6[k]}"> <small>${u}</small></label>`).join("") + `<button class="btn ghost" type="button" id="sr6InpReset">Reset to the example</button>`;
  host.querySelectorAll("[data-sr6in]").forEach((i) => i.addEventListener("input", () => { const v = parseFloat(i.value); if (Number.isFinite(v) && v > 0) calcInp[i.dataset.sr6in] = v; else delete calcInp[i.dataset.sr6in]; renderCalc(); }));
  $("sr6InpReset").addEventListener("click", () => { calcInp = {}; host.querySelectorAll("[data-sr6in]").forEach((i) => (i.value = DEF6[i.dataset.sr6in])); renderCalc(); });
  function renderCalc() {
    const { S, F } = calc6(calcInp); lastF = F;
    $("sr6CalcOut").innerHTML = S.map((s) => `<h3 class="sr6-h" id="sr6c-${s.id}">${esc(s.t)}</h3><p class="sr6-sn">${esc(s.note)}</p>
      <div class="table-wrap"><table class="sr6-tbl sr6-calc"><colgroup><col style="width:22%"><col style="width:38%"><col style="width:11%"><col style="width:9%"><col style="width:20%"></colgroup>
      <thead><tr><th>Item</th><th>Formula / input</th><th>Value</th><th>Unit</th><th>Check</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.formula)}</td><td class="sr6-v">${fv(r.value)}</td><td>${esc(r.unit)}</td>
      <td>${r.ok === true ? '<span class="sr6-okb">OK</span> ' : r.ok === false ? '<span class="sr6-nok">CHECK</span> ' : ""}${esc(r.check)}</td></tr>`).join("")}</tbody></table></div>`).join("");
    $("sr6LoadSvg").innerHTML = loadSvg(F);
    if (V1 && V1.S.flow) V1.flow(true, F);
  }
  renderCalc();

  /* ---------------- manufacturing card */
  function setPart(k) { if (!ROUTES[k]) return; mfg.part = k; mfg.op = 0; mfg.t = 0; mfg.all = false; renderRoute(); renderOp(); }
  function renderRoute() {
    const R = ROUTES[mfg.part], tot = R.ops.reduce((s, o) => s + o[4], 0);
    host.querySelectorAll("[data-sr6part]").forEach((b) => b.classList.toggle("primary", b.dataset.sr6part === mfg.part));
    $("sr6MfgSub").textContent = `${R.n} · ${R.ops.length} operations · ≈ ${tot} min ≈ ${(tot / 60).toFixed(1)} h (example, without waiting / transport)`;
    $("sr6Route").innerHTML = `<colgroup><col style="width:4%"><col style="width:16%"><col style="width:17%"><col style="width:20%"><col style="width:6%"><col style="width:19%"><col style="width:18%"></colgroup>
      <thead><tr><th>#</th><th>Operation</th><th>Machine</th><th>Tooling / parameters</th><th>min</th><th>Quality check</th><th>Typical mistake</th></tr></thead><tbody>${
      R.ops.map((o, i) => `<tr data-sr6op="${i}" class="${i === mfg.op ? "sr6-cur" : ""}"><td>${i + 1}</td><td><b>${esc(o[1])}</b><br><small>${esc(OPNAME[o[0]] || o[0])}</small></td><td>${esc(o[2])}</td><td>${esc(o[3])}</td><td class="sr6-v">${o[4]}</td><td>${esc(o[5])}</td><td>${esc(o[6])}</td></tr>`).join("")}
      <tr class="sr6-sum"><td></td><td><b>total</b></td><td colspan="2">${R.ops.length} operations</td><td class="sr6-v"><b>${tot}</b></td><td colspan="2">≈ ${(tot / 60).toFixed(1)} h · part mass ≈ ${R.kg} kg</td></tr></tbody>`;
    $("sr6Route").querySelectorAll("[data-sr6op]").forEach((tr) => tr.addEventListener("click", () => { mfg.op = +tr.dataset.sr6op; mfg.t = 0; mfg.play = true; renderRoute(); renderOp(); }));
  }
  function renderOp() {
    const R = ROUTES[mfg.part], o = R.ops[mfg.op];
    $("sr6Player").innerHTML = opSvg(mfg.part, o, mfg.t, mfg.op, R.ops.length);
    $("sr6OpInfo").innerHTML = `<h3>${mfg.op + 1}. ${esc(o[1])}</h3><dl class="sr6-dl"><dt>Machine</dt><dd>${esc(o[2])}</dd><dt>Tooling / parameters</dt><dd>${esc(o[3])}</dd>
      <dt>Time (example)</dt><dd>≈ ${o[4]} min</dd><dt>Quality check</dt><dd>${esc(o[5])}</dd><dt>Typical mistake</dt><dd class="sr6-bad">${esc(o[6])}</dd></dl><p class="sr6-small">${esc(NOTE6)}</p>`;
    $("sr6Play").textContent = mfg.play ? "❚❚ Pause" : "▶ Play";
    $("sr6Route").querySelectorAll("[data-sr6op]").forEach((tr) => tr.classList.toggle("sr6-cur", +tr.dataset.sr6op === mfg.op));
  }
  host.querySelectorAll("[data-sr6part]").forEach((b) => b.addEventListener("click", () => setPart(b.dataset.sr6part)));
  const step = (d) => { const n = ROUTES[mfg.part].ops.length; mfg.op = (mfg.op + d + n) % n; mfg.t = 0; renderOp(); };
  $("sr6Prev").addEventListener("click", () => step(-1)); $("sr6Next").addEventListener("click", () => step(1));
  $("sr6Play").addEventListener("click", () => { mfg.play = !mfg.play; renderOp(); });
  $("sr6All").addEventListener("click", () => { mfg.all = true; mfg.op = 0; mfg.t = 0; mfg.play = true; renderOp(); });
  if (ROUTES[Q.get("sr6part")]) mfg.part = Q.get("sr6part");
  if (Q.has("sr6op")) mfg.op = Math.max(0, Math.min(ROUTES[mfg.part].ops.length - 1, (+Q.get("sr6op") || 1) - 1));
  renderRoute(); renderOp();
  let lastT = performance.now(), lastDraw = 0;
  (function mfgLoop() {
    requestAnimationFrame(mfgLoop);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (host.hidden || !host.offsetParent || document.hidden || !mfg.play) return;
    const p = $("sr6Player"), r = p.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
    mfg.t += dt / 6;
    if (mfg.t >= 1) { if (mfg.all) { if (mfg.op < ROUTES[mfg.part].ops.length - 1) { mfg.op++; mfg.t = 0; renderOp(); } else { mfg.all = false; mfg.t = 1; mfg.play = false; renderOp(); } } else mfg.t = 0; }
    if (now - lastDraw > 40) { lastDraw = now; p.innerHTML = opSvg(mfg.part, ROUTES[mfg.part].ops[mfg.op], Math.min(1, mfg.t), mfg.op, ROUTES[mfg.part].ops.length); }
  })();

  /* ---------------- assembly card */
  $("sr6Steps").innerHTML = `<h3>8 steps – click one</h3>${ASSY.map((s, i) => `<button type="button" class="sr6-step" data-sr6step="${i}">${esc(s.t)}</button>`).join("")}<div id="sr6StepInfo"></div>`;
  $("sr6StepTbl").innerHTML = `<colgroup><col style="width:22%"><col style="width:28%"><col style="width:40%"><col style="width:10%"></colgroup><thead><tr><th>Step</th><th>Tools</th><th>Checks + values (example)</th><th>Time</th></tr></thead><tbody>${
    ASSY.map((s) => `<tr><td><b>${esc(s.t)}</b></td><td>${esc(s.tools)}</td><td>${esc(s.chk)}</td><td>${esc(s.time)}</td></tr>`).join("")}</tbody>`;
  function showStep(i) {
    host.querySelectorAll("[data-sr6step]").forEach((b) => b.classList.toggle("on", +b.dataset.sr6step === i));
    const s = ASSY[i]; $("sr6StepInfo").innerHTML = `<dl class="sr6-dl"><dt>Tools</dt><dd>${esc(s.tools)}</dd><dt>Checks + values</dt><dd>${esc(s.chk)}</dd><dt>Time</dt><dd>${esc(s.time)}</dd></dl>`;
  }
  host.querySelectorAll("[data-sr6step]").forEach((b) => b.addEventListener("click", () => { const i = +b.dataset.sr6step; showStep(i); if (V2) { V2.playSteps(false); V2.setStep(i); } }));
  $("sr6AsmPlay").addEventListener("click", () => { showStep(0); if (V2) V2.playSteps(true); });
  showStep(Q.has("sr6step") ? Math.max(0, Math.min(7, (+Q.get("sr6step") || 1) - 1)) : ASSY.length - 1);

  /* ---------------- BOM */
  let bomF = "";
  function renderBom() {
    const rows = BOM.filter((r) => !bomF || r[2].includes(bomF)), tot = rows.reduce((s, r) => s + r[4] * r[5], 0);
    $("sr6BomTbl").innerHTML = `<colgroup><col style="width:5%"><col style="width:33%"><col style="width:11%"><col style="width:24%"><col style="width:6%"><col style="width:9%"><col style="width:12%"></colgroup>
      <thead><tr><th>Pos</th><th>Item</th><th>Make / buy</th><th>Material / spec</th><th>Qty</th><th>kg (total)</th><th>Assembly</th></tr></thead><tbody>${
      rows.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="${/BUY/.test(r[2]) && !/MAKE/.test(r[2]) ? "sr6-buy" : /MAKE/.test(r[2]) && !/BUY/.test(r[2]) ? "sr6-make" : ""}">${esc(r[2])}</td><td>${esc(r[3])}</td><td class="sr6-v">${r[4]}</td><td class="sr6-v">${fv(r[4] * r[5])}</td>
      <td><i class="sr6-dot" style="background:${hex(ASM[r[6]].c)}"></i>${esc(ASM[r[6]].n.replace(/ \(.*/, ""))}</td></tr>`).join("")}<tr class="sr6-sum"><td></td><td><b>${rows.length} positions</b></td><td></td><td></td><td></td><td class="sr6-v"><b>${fv(tot)}</b></td><td>${bomF ? "" : `item 1: ${CRANE.mass} kg empty`}</td></tr></tbody>`;
  }
  host.querySelectorAll("[data-sr6bom]").forEach((b) => b.addEventListener("click", () => { bomF = b.dataset.sr6bom; host.querySelectorAll("[data-sr6bom]").forEach((x) => x.classList.toggle("active", x === b)); renderBom(); }));
  renderBom();

  /* ---------------- catalogue card */
  try { makeCard(CARD6, host.querySelector(".sr6-wrap"), { card: "srCard6", q: "srQ6", g: "srG6", cnt: "srCnt6", buy: "srBuy6" }, "sr6"); } catch (e) { console.error(e); }
  const dbg = $("sr6Debug"); host.querySelector(".sr6-wrap").appendChild(dbg);
  if (Q.get("sr6card") && $({ load: "sr6Load", mfg: "sr6Mfg", asm: "sr6Asm", bom: "sr6Bom" }[Q.get("sr6card")] || "x")) setTimeout(() => $({ load: "sr6Load", mfg: "sr6Mfg", asm: "sr6Asm", bom: "sr6Bom" }[Q.get("sr6card")]).scrollIntoView({ block: "start" }), 700);

  /* ---------------- 3D (lazy import) */
  import("./asrscrane_3d.js").then((M) => {
    const el = $("sr63d"); el.querySelector(".sr6-msg").remove();
    V1 = M.createCrane3D(el, { mode: "structure", onPick: (k) => showPart(k), onExplode: (e) => { $("sr6Ex").value = Math.round(e * 100); } });
    window.sr6View = V1;
    const v = Q.get("sr6view"); if (["assembled", "exploded", "xray", "section"].includes(v)) V1.setView(v);
    if (Q.has("sr6ex")) { V1.setExplode(+Q.get("sr6ex") || 0); $("sr6Ex").value = Math.round(V1.S.ex * 100); }
    if (Q.get("sr6focus") && ASM[Q.get("sr6focus")]) { $("sr6Focus").value = Q.get("sr6focus"); V1.focus(Q.get("sr6focus")); }
    if (Q.get("sr6pick") && PARTS6[Q.get("sr6pick")]) V1.select(Q.get("sr6pick"));
    if (Q.has("sr6flow")) V1.flow(true, lastF);
    updViewBtns();
    const startAsm = () => { if (V2) return; const e2 = $("sr6Asm3d"); const m = e2.querySelector(".sr6-msg"); if (m) m.remove();
      V2 = M.createCrane3D(e2, { mode: "assembly", onStep: (i) => showStep(i) }); window.sr6Asm = V2;
      if (Q.has("sr6step")) V2.setStep(Math.max(0, Math.min(7, (+Q.get("sr6step") || 1) - 1))); };
    if (Q.has("sr6test") || Q.has("sr6step") || Q.get("sr6card") === "asm") startAsm();
    else { try { const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); startAsm(); } }, { rootMargin: "200px" }); io.observe($("sr6Asm3d")); } catch (e) { startAsm(); } }
    if (Q.has("sr6test")) setTimeout(selfTest, 3500);
    if (Q.has("sr6back")) setTimeout(backTest, 3000);
  }).catch((e) => { console.error(e); const m = host.querySelector("#sr63d .sr6-msg"); if (m) m.textContent = "3D view could not start: " + e.message; });
}

/* ---------------- load path drawing (side view along the aisle, live numbers) */
function loadSvg(F) {
  const f1 = (v, d = 1) => Number(v).toFixed(d);
  const X = (x) => 250 + x * 95, Z = (z) => 505 - z * 44;           // crane metres → px
  const A = "#1f6fd1", Rr = "#d62828";
  const ar = (x1, y1, x2, y2, c = Rr, w = 3) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" marker-end="url(#sr6a${c === A ? "b" : "r"})" class="sr6-flowl"/>`;
  const t = (x, y, s, a = "start", c = "#111", fw = "normal") => `<text x="${x}" y="${y}" font-size="12" text-anchor="${a}" fill="${c}" font-weight="${fw}">${s}</text>`;
  const cz = 6.0;
  return `<svg viewBox="0 0 600 560" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="load path">
  <defs><marker id="sr6ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="${Rr}"/></marker>
  <marker id="sr6ab" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="${A}"/></marker></defs>
  <rect width="600" height="560" fill="#fff"/>
  <line x1="40" y1="${Z(0)}" x2="580" y2="${Z(0)}" stroke="#111" stroke-width="2"/><rect x="40" y="${Z(0)}" width="540" height="8" fill="#ddd"/>
  <rect x="${X(-1.25 + 0.2)}" y="${Z(0.28)}" width="${2.9 * 95}" height="${0.16 * 44 + 4}" fill="#f0b323" stroke="#111"/>
  <circle cx="${X(-1.05)}" cy="${Z(0.22)}" r="12" fill="#bbb" stroke="#111"/><circle cx="${X(1.35)}" cy="${Z(0.22)}" r="12" fill="#bbb" stroke="#111"/>
  <rect x="${X(-1.0)}" y="${Z(9.0)}" width="${0.5 * 95}" height="${8.64 * 44}" fill="#e3e7ea" stroke="#111"/>
  <rect x="${X(-1.05)}" y="${Z(9.18)}" width="${0.7 * 95}" height="9" fill="#e2731c" stroke="#111"/>
  <line x1="${X(-1.2)}" y1="${Z(9.31)}" x2="${X(0.4)}" y2="${Z(9.31)}" stroke="#555" stroke-width="4"/>
  <rect x="${X(-0.45)}" y="${Z(cz + 0.92)}" width="${0.95 * 95}" height="${1.0 * 44}" fill="none" stroke="#d99a1e" stroke-width="5"/>
  <rect x="${X(-0.05)}" y="${Z(cz)}" width="${1.3 * 95}" height="${0.6 * 44}" fill="#6f87a6" stroke="#111"/>
  ${t(X(1.35) + 4, Z(cz) + 26, "crate 300 kg", "start")}
  ${ar(X(0.6), Z(cz) - 26, X(0.6), Z(cz) + 32)}${t(X(1.35) + 4, Z(cz) + 10, `① ${f1(F.load, 2)} kN`, "start", Rr, "bold")}
  ${ar(X(-0.2), Z(cz + 0.8), X(-0.47), Z(cz + 0.8))}${ar(X(-0.47), Z(cz), X(-0.2), Z(cz))}
  ${t(X(-0.15), Z(cz + 0.8) - 8, `② rollers ± ${f1(F.roller, 2)} kN per level (couple)`, "start", Rr, "bold")}
  ${ar(X(-0.75), Z(cz - 0.6), X(-0.75), Z(0.8))}${t(X(-0.5) + 6, Z(3.2), `③ mast: N ${f1(F.N)} kN`, "start", Rr, "bold")}${t(X(-0.5) + 6, Z(3.2) + 15, `M foot ${f1(F.Mn, 2)} kN·m (emergency ${f1(F.Mem, 2)})`, "start", Rr)}
  ${t(X(-0.5) + 6, Z(0.62), `④ flange 12 × M24: ${f1(F.bolt)} kN per bolt`, "start", Rr)}
  ${t(X(0.2), Z(0.28) + 30, `⑤ box beam M ${f1(F.beam)} kN·m`, "middle", Rr, "bold")}
  ${ar(X(-1.05), Z(0.1), X(-1.05), Z(-0.25))}${ar(X(1.35), Z(0.1), X(1.35), Z(-0.25))}
  ${t(X(-1.05), Z(-0.25) + 22, `⑥ drive ${f1(F.Rd)} kN (max ${f1(F.Rmax)})`, "middle", Rr, "bold")}${t(X(1.35), Z(-0.25) + 22, `⑦ idler ${f1(F.Ri)} kN`, "middle", Rr, "bold")}
  ${ar(X(-0.75), Z(9.15), X(-0.75), Z(9.45), A, 2.5)}${t(X(-0.2), Z(9.45) + 4, "⑧ top guide ≈ 0.5 kN (only across the aisle)", "start", A)}
  ${t(20, 22, "Load path – side view along the aisle (carriage at 6 m, fork in)", "start", "#111", "bold")}
  ${t(20, 40, "load → fork → carriage → rollers → mast → flange → beam → wheels → rail → floor", "start", "#555")}
  ${t(580, 60, "EXAMPLE – the crane maker's drawings decide", "end", "#888")}</svg>`;
}

/* ---------------- self-check (&sr6test) */
function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("SR6TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const ok = Math.abs(got - exp) <= tol; ok ? pass++ : fail++; log(`${ok ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${exp} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const { R } = calc6({});
  for (const [k, e] of Object.entries(CHECK6)) chk("calc " + k, R[k], e, Math.max(Math.abs(e) * 0.002, 0.002));
  // consistency with item 1 / guide 31 / core
  chk("guide 31 f1 ≈ 2.55 Hz", R.f1, 2.55, 0.01); chk("guide 31 R_max ≈ 30.2 kN", R.Rmax, 30.2, 0.1); chk("guide 31 Z_p ≈ 8.6", R.Zp, 8.6, 0.05);
  chk("core moving mass (empty) = guide 31 table − load", 1600 + 1000 + 600 + 800 + 200, CRANE.mass, 0);
  chk("core mast height 9.3 m", CRANE.mastH, 9.3, 0); chk("top rail z = RACK.height − 0.19", RACK.height - 0.19, 9.31, 1e-9);
  const M = window.sr6View;
  if (M) {
    const c = M.counts();
    chk("3D assemblies (groups with parts)", c.groups, 13, 0); chk("3D mast diaphragms", c.diaphragmM, 6, 0); chk("3D box-beam diaphragms", c.diaphragmB, 6, 0); chk("3D flange bolts", c.bolts, 12, 0);
    ok("every 3D part has an info record", c.partsNoInfo.length === 0, c.partsNoInfo.join(",") || `${c.partsWithInfo} parts`);
    ok("every info record is used in 3D", Object.keys(PARTS6).every((k) => c.byPart[k]), Object.keys(PARTS6).filter((k) => !c.byPart[k]).join(",") || "all used");
    log(`INFO 3D meshes=${c.meshes} frames=${c.frames} byAsm=${JSON.stringify(c.byAsm)}`);
    M.setView("assembled"); M.focus(null); M.setExplode(0);
    for (const p of ["mastBox", "cab", "beam", "wheelI"]) { const h = M.pickTest(p); ok(`pick ${p}`, h === p, "hit " + h); }
    const shot = M.snapshot(); const img = new Image(); img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = 120; cv.height = 90; const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 120, 90);
      const d = g.getImageData(0, 0, 120, 90).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 232) + Math.abs(d[i + 1] - 236) + Math.abs(d[i + 2] - 240) > 40) n++;
      ok("3D snapshot not blank", n > 300, `${n} of 10800 pixels differ from the background`);
      const dbg = $("sr6Debug"); if (dbg) { const im = document.createElement("img"); im.src = shot; im.alt = "3D snapshot (test)"; im.className = "sr6-shot"; dbg.appendChild(im); }
    }; img.src = shot;
    M.setView("exploded");
    setTimeout(() => { chk("explode animation reaches 1", M.S.ex, 1, 0.01); M.setView("section"); ok("section view set", M.S.view === "section"); M.setView("xray"); ok("X-ray view set", M.S.view === "xray");
      M.setView("assembled"); M.flow(true, calc6({}).F); ok("load path on", M.S.flow); setTimeout(() => { M.flow(false); finish(); }, 600); }, 2200);
  } else { ok("3D view built", false); finish(); }
  // routes, assembly, BOM, card
  const nOps = ROUTE_KEYS.reduce((s, k) => s + ROUTES[k].ops.length, 0), tMin = ROUTE_KEYS.reduce((s, k) => s + ROUTES[k].ops.reduce((a, o) => a + o[4], 0), 0);
  chk("routes: parts", ROUTE_KEYS.length, 7, 0); chk("routes: operations", nOps, 56, 0); chk("routes: total minutes", tMin, 7980, 0);
  ok("every op has 7 fields + a known animation type", ROUTE_KEYS.every((k) => ROUTES[k].ops.every((o) => o.length === 7 && OP_TYPES.includes(o[0]))));
  chk("assembly steps", ASSY.length, 8, 0);
  const bomKg = BOM.reduce((s, r) => s + r[4] * r[5], 0); chk("BOM positions", BOM.length, 27, 0); chk("BOM mass ≈ crane empty 4 200 kg (± 2 %)", bomKg, 4200, 84);
  function finish() {
    const V2 = window.sr6Asm;
    if (V2) { V2.setStep(7, false); const vis = V2.counts(); ok("assembly view built", vis.meshes > 100, `meshes ${vis.meshes}`); V2.setStep(0, false); V2.setStep(2, true); ok("assembly step 3 animating (mast lift)", V2.isAnimating()); }
    else ok("assembly view built", false);
    const card = $("srCard6"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    setTimeout(() => {
      ok("card srCard6", !!card, `drawings ${imgs.length} loaded ${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings", imgs.length, 12, 0);
      log(`INFO mfg player op=${mfg.part}#${mfg.op + 1} svg=${!!$("sr6Player").querySelector("svg")} route rows=${$("sr6Route").querySelectorAll("tbody tr").length}`);
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("sr6Debug"); if (d) { d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre); }
    }, 1500);
  }
}
function backTest() {
  const seq = ["1", "6", "1", "6"], ctl = window.srCtl;
  const stepB = (i) => {
    if (i >= seq.length) { console.log(`SR6BACK DONE item6 built=${host.children.length > 0} canvases=${host.querySelectorAll("canvas").length} item1 canvas=${!!document.querySelector("#srItem1 canvas")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (ctl) ctl.showItem(seq[i]);
    setTimeout(() => { const h = $("srItem" + seq[i]); console.log(`SR6BACK item${seq[i]} visible=${h && !h.hidden} built=${h && h.children.length > 0} errors=${errs.length}`); stepB(i + 1); }, 2500);
  };
  stepB(0);
}

window.addEventListener("sritemshow", (e) => { if (String(e.detail) === "6") { build(); setTimeout(() => { if (V1) V1.resize(); if (V2) V2.resize(); }, 0); } });
if (window.srCtl && window.srCtl.current() === "6" && window.srCtl.tabVisible()) build();
