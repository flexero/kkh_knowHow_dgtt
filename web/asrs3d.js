/* AS/RS raw materials – item 1 "Mechanical system – 3D twin" (#srItem1).
 * Contract: docs/31_contract_asrs.md · guide: docs/31_asrs_mechanical_3d.md · shared core: asrscore.js (window.ASRS, one sim for all items).
 * Files: asrs3d.js (UI, 3D view, live panel, calculations card, self-check) · asrs3d_scene.js (Three.js geometry) · asrs3d_calc.js (engineering
 *   calculations) · asrs3d_parts.js (click-info texts) · asrs3d_data.js (catalogue card, generated from the guide) · asrs1.css.
 * Lazy: built on window event "sritemshow" (detail "1") or at load when item 1 of the visible AS/RS tab is shown. Three.js is imported only then.
 * URL (tests / deep links): ?sritem=1#asrs · &sr1view=iso|front|side|top|follow · &sr1ex (explode) · &sr1mode=sku|fill|age · &sr1dims · &sr1speed=N ·
 *   &sr1ff=S (fast-forward the shared sim S seconds at start) · &sr1pick=<part key> · &sr1slot=L-03-2-5 · &sr1calc (scroll to the calculations) ·
 *   &sr1test (self-check, console "SR1TEST …" + #sr1Debug) · &sr1back (switch items 1→2→3→4→1, report errors) · &sr1hold (headless: keep load pending, show the tab).
 * Offline: local three.js + view3d.js only. ALL VALUES ARE EXAMPLES – the AS/RS supplier's offer decides.
 */
import { getASRS, RACK, CRANE, SKU, SKUS } from "./asrscore.js";
import { calcAll, CHECK, DEF } from "./asrs3d_calc.js";
import { PARTS } from "./asrs3d_parts.js";
import { CARD } from "./asrs3d_data.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const host = $("srItem1");
const errs = [];
if (Q.has("sr1test") || Q.has("sr1back")) {
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
}
// test only (&sr1hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots wait for --timeout)
if (Q.has("sr1hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?sr1hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("asrs"); else { const b = document.querySelector('[data-tab="asrs"]'); if (b) b.click(); } }, 300); }

let built = false, view = null, calcInp = {}, lastCalc = 0;
const PHASE = { idle: "idle – waiting for a job", toIO: "travelling to the I/O point", toSlot: "travelling to the slot", pos: "fine positioning", forkOut: "fork extending",
  forkIn: "fork retracting", lift: "lifting the load", lower: "lowering the load", fault: "FAULT – crane stopped", estop: "EMERGENCY STOP" };

function build() {
  if (built || !host) return; built = true;
  const A = getASRS(), sim = A.sim;
  if (Q.has("sr1speed")) sim.speed = Math.max(1, Math.min(50, +Q.get("sr1speed") || 1));
  if (Q.has("sr1ff")) { const sp = sim.speed; sim.speed = 1; const n = Math.min(36000, (+Q.get("sr1ff") || 0) * 10); for (let i = 0; i < n; i++) sim.step(0.1); sim.speed = sp; }
  host.innerHTML = `
  <div class="sr1-wrap">
    <div class="card sr1-3dcard">
      <div class="card-head"><h2>3D twin – high-bay rack, stacker crane, I/O conveyors (live)</h2>
        <span class="sr1-ctl">
          <span class="sr1-lbl">sim speed</span><span class="seg" role="group" aria-label="simulation speed">${[1, 5, 10, 20, 50].map((s) => `<button class="seg-btn" data-sr1speed="${s}">${s}×</button>`).join("")}</span>
          <button class="btn" id="sr1Pause" type="button" title="pause / run the shared AS/RS simulation (all items)">❚❚ Pause</button>
          <span class="sr1-lbl">colour</span><span class="seg" role="group" aria-label="slot colour mode">${[["sku", "by SKU"], ["fill", "by fill (kg)"], ["age", "by age"]].map(([k, t]) => `<button class="seg-btn" data-sr1mode="${k}">${t}</button>`).join("")}</span>
          <label class="sr1-chk"><input type="checkbox" id="sr1Dims"${Q.has("sr1dims") ? " checked" : ""}> dimensions</label>
        </span></div>
      <div class="sr1-main">
        <div class="scene3d sr1-3d" id="sr13d"><div class="sr1-msg" id="sr13dMsg">3D view is loading …</div></div>
        <div class="sr1-live" id="sr1Live"></div>
      </div>
      <div class="sr1-legend" id="sr1Legend"></div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom, double-click = new orbit point. <b>Click a part</b> (upright, beam, mast, fork, wheel, drive, sensor, conveyor, fence …) for what it is,
        its design data, the calculation and the typical failure; <b>click a crate or an empty slot</b> for the slot id, load, lot and kg. The simulation is shared with items 2–4 (faults injected there show here).
        All dimensions follow guide 03 §19.1 / guide 31 – example values, the AS/RS supplier's offer decides.</p>
    </div>
    <div class="card sr1-calc" id="sr1Calc">
      <div class="card-head"><h2>Engineering calculations – rack, floor, crane, drives, cycle, accuracy, energy</h2>
        <span class="sub">hand-checkable · simplified (labelled) · rows marked LIVE use the running twin · guide 31 §6–9 + §17</span></div>
      <div class="sr1-inp" id="sr1Inp"></div>
      <div id="sr1CalcOut"></div>
      <p class="sr1-note">Simplified checks for understanding and plausibility (EN 15512 / FEM style, no full code check). The rack maker designs the rack per EN 15512 (with tests of uprights,
        connectors and base plates), the crane maker designs the crane per FEM 9.831 / EN 528 and proves the cycle time per FEM 9.851. Example values – ask for the supplier's calculation.</p>
    </div>
    <div class="sr1-debug" id="sr1Debug" hidden></div>
  </div>`;
  // controls
  host.querySelectorAll("[data-sr1speed]").forEach((b) => b.addEventListener("click", () => { sim.speed = +b.dataset.sr1speed; updCtl(); }));
  $("sr1Pause").addEventListener("click", () => { sim.running = !sim.running; updCtl(); });
  host.querySelectorAll("[data-sr1mode]").forEach((b) => b.addEventListener("click", () => { mode = b.dataset.sr1mode; updCtl(); legend(); }));
  $("sr1Dims").addEventListener("change", () => { if (view) view.dims($("sr1Dims").checked); });
  let mode = ["sku", "fill", "age"].includes(Q.get("sr1mode")) ? Q.get("sr1mode") : "sku";
  function updCtl() {
    host.querySelectorAll("[data-sr1speed]").forEach((b) => b.classList.toggle("active", +b.dataset.sr1speed === sim.speed));
    host.querySelectorAll("[data-sr1mode]").forEach((b) => b.classList.toggle("active", b.dataset.sr1mode === mode));
    $("sr1Pause").textContent = sim.running ? "❚❚ Pause" : "▶ Run"; $("sr1Pause").classList.toggle("primary", !sim.running);
  }
  function legend() {
    const L = $("sr1Legend");
    if (mode === "sku") L.innerHTML = SKUS.map((k) => `<span class="sr1-lg"><i style="background:${SKU[k].color}"></i>${esc(SKU[k].name)} (${SKU[k].perLoad}/crate, ${SKU[k].kg} kg)</span>`).join("") +
      `<span class="sr1-lg"><i style="background:#e0a020"></i>slot reserved by a job</span><span class="sr1-lg"><i style="background:#d0302a"></i>slot blocked</span><span class="sr1-lg"><i style="background:#eeeeee;border-color:#999"></i>slot empty (label plate)</span>`;
    else if (mode === "fill") L.innerHTML = `<span class="sr1-lg sr1-grad"><i class="sr1-heat"></i>crate gross mass 0 → ${RACK.maxLoad} kg (green → red; design load ${RACK.maxLoad} kg)</span><span class="sr1-lg"><i style="background:#3b8a52"></i>label: occupied</span><span class="sr1-lg"><i style="background:#e0a020"></i>reserved</span><span class="sr1-lg"><i style="background:#d0302a"></i>blocked</span>`;
    else L.innerHTML = `<span class="sr1-lg sr1-grad"><i class="sr1-age"></i>time in store: new (blue) → oldest (red) – FIFO by lot takes the oldest first</span>`;
  }
  updCtl(); legend();
  setInterval(() => { if (!host.hidden) updCtl(); }, 1000);

  /* ---------------- live panel */
  const live = $("sr1Live");
  function updLive() {
    if (host.hidden) return;
    const c = sim.crane, kp = sim.kpi(), fem = A.fem, act = c.plan ? c.plan.jobs : [], qd = sim.queue.filter((j) => j.state === "queued");
    const flt = Object.entries(sim.faults).filter(([, v]) => v).map(([k, v]) => k + (typeof v === "string" ? " " + v : ""));
    if (sim.estop) flt.unshift("E-STOP");
    const row = (k, v, cls = "") => `<tr><th>${k}</th><td class="${cls}">${v}</td></tr>`;
    live.innerHTML = `
      <h3>Stacker crane</h3><table class="sr1-kv">
        ${row("travel x", `${f(c.x, 2)} m <small>v ${f(c.vx, 2)} m/s</small>`)}${row("hoist z (fork)", `${f(c.z, 2)} m <small>v ${f(c.vz, 2)} m/s</small>`)}
        ${row("fork", `${f(c.fork * 1350, 0)} mm ${c.fork < -0.05 ? "(side L)" : c.fork > 0.05 ? "(side R)" : "(centre)"}`)}
        ${row("phase", esc(PHASE[c.phase] || c.phase), c.phase === "fault" || c.phase === "estop" ? "sr1-bad" : "")}${row("mode", esc(c.mode))}
        ${row("carrying", c.carrying ? `${esc(SKU[c.carrying.sku] ? SKU[c.carrying.sku].name : c.carrying.sku)} · ${c.carrying.kg} kg · ${esc(c.carrying.lot)}` : "–")}</table>
      <h3>Jobs</h3><table class="sr1-kv">
        ${row("active", act.length ? act.map((j) => `${j.id} ${j.type} ${esc(j.sku)} → ${j.slot ? j.slot.id : "?"}`).join("<br>") + (act.length === 2 ? " <small>(dual cycle)</small>" : "") : "–")}
        ${row("queue", `${qd.length}${qd.length ? " · " + qd.slice(0, 4).map((j) => `${j.id} ${j.type === "store" ? "S" : "R"} ${esc(j.sku)}`).join(", ") : ""}`)}
        ${row("conveyors", `infeed ${sim.inConv.length} · outfeed ${sim.outConv.length}`)}${row("done", `${sim.stats.stores} stores · ${sim.stats.retrievals} retrievals`)}</table>
      <h3>KPIs (since start, sim time ${f(sim.t / 60, 1)} min)</h3><table class="sr1-kv">
        ${row("throughput", `${f(kp.jobsPerH, 1)} jobs/h`)}${row("crane utilisation", `${f(kp.util * 100, 0)} %`)}${row("avg job time", `${f(kp.avgCycle, 1)} s`)}
        ${row("fill", `${f(kp.fill * 100, 1)} % (${sim.slots.filter((s) => s.load).length} / ${RACK.slots})`)}${row("energy", `${f(kp.energyWhPerJob, 1)} Wh/job`)}</table>
      <h3>FEM 9.851 cycle (this crane)</h3><table class="sr1-kv">
        ${row("single SC", `${f(fem.sc, 1)} s → ${f(fem.scPerH, 0)} jobs/h`)}${row("dual DC", `${f(fem.dc, 1)} s → ${f(fem.dcPerH, 0)} jobs/h`)}
        ${row("P1 / P2", `(${f(fem.P1.x, 2)}, ${f(fem.P1.z, 2)}) / (${f(fem.P2.x, 2)}, ${f(fem.P2.z, 2)}) m`)}</table>
      <h3>Faults</h3><div class="${flt.length ? "sr1-bad" : "sr1-ok"}">${flt.length ? esc(flt.join(" · ")) + " <small>(set / clear in item 2)</small>" : "none"}</div>`;
  }
  updLive(); setInterval(updLive, 300);

  /* ---------------- calculations card */
  const INP = [["slotKg", "design load per crate", "kg"], ["craneKg", "crane moving mass", "kg"], ["vx", "travel speed", "m/s"], ["ax", "travel accel.", "m/s²"], ["vz", "hoist speed", "m/s"],
    ["az", "hoist accel.", "m/s²"], ["mastT", "mast wall t", "mm"], ["wheelD", "wheel Ø", "mm"], ["dualShare", "dual-cycle share p", "0…1"], ["etaBack", "regen. back-feed η", "0…1"]];
  $("sr1Inp").innerHTML = INP.map(([k, t, u]) => `<label>${t} <input type="number" step="any" data-sr1in="${k}" value="${DEF[k]}"> <small>${u}</small></label>`).join("") +
    `<button class="btn ghost" type="button" id="sr1InpReset">Reset to the example</button>`;
  host.querySelectorAll("[data-sr1in]").forEach((i) => i.addEventListener("input", () => { const v = parseFloat(i.value); if (Number.isFinite(v) && v > 0) calcInp[i.dataset.sr1in] = v; else delete calcInp[i.dataset.sr1in]; renderCalc(); }));
  $("sr1InpReset").addEventListener("click", () => { calcInp = {}; host.querySelectorAll("[data-sr1in]").forEach((i) => (i.value = DEF[i.dataset.sr1in])); renderCalc(); });
  function renderCalc() {
    lastCalc = performance.now();
    const { S } = calcAll(calcInp, sim);
    const fv = (v, u) => (typeof v !== "number" ? esc(v) : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));
    $("sr1CalcOut").innerHTML = S.map((s) => `<h3 class="sr1-h" id="sr1c-${s.id}">${esc(s.t)}</h3><p class="sr1-sn">${esc(s.note || "")}</p>
      <div class="table-wrap"><table class="sr1-tbl"><colgroup><col style="width:24%"><col style="width:40%"><col style="width:10%"><col style="width:8%"><col style="width:18%"></colgroup>
      <thead><tr><th>Item</th><th>Formula / input</th><th>Value</th><th>Unit</th><th>Check</th></tr></thead><tbody>${s.rows.map((r) => `<tr class="${/^LIVE/.test(r.item) ? "sr1-liverow" : ""}"><td>${esc(r.item)}</td><td>${esc(r.formula)}</td><td class="sr1-v">${fv(r.value)}</td><td>${esc(r.unit)}</td>
      <td>${r.ok === true ? '<span class="sr1-okb">OK</span> ' : r.ok === false ? '<span class="sr1-nok">CHECK</span> ' : ""}${esc(r.check)}</td></tr>`).join("")}</tbody></table></div>`).join("");
  }
  renderCalc();
  setInterval(() => { if (host.hidden || document.hidden) return; const a = document.activeElement; if (a && a.dataset && a.dataset.sr1in) return; if (performance.now() - lastCalc > 2500) renderCalc(); }, 3000);
  if (Q.has("sr1calc")) setTimeout(() => $("sr1Calc").scrollIntoView({ block: "start" }), 600);

  /* ---------------- catalogue card */
  try { makeCard(CARD, host.querySelector(".sr1-wrap"), { card: "srCard1", q: "srQ1", g: "srG1", cnt: "srCnt1", buy: "srBuy1" }, "sr1"); } catch (e) { console.error(e); }

  /* ---------------- 3D (lazy import) */
  Promise.all([import("./asrs3d_view.js")]).then(([V]) => {
    const el = $("sr13d"); const msg = $("sr13dMsg"); if (msg) msg.remove();
    view = V.createASRS3D(el, A, { getMode: () => mode, parts: PARTS, dims: $("sr1Dims").checked, view: Q.get("sr1view"), ex: Q.has("sr1ex"), pick: Q.get("sr1pick"), slot: Q.get("sr1slot") });
    window.sr1View = view;
    if (Q.has("sr1test")) setTimeout(() => selfTest(A), 3500);
    if (Q.has("sr1back")) setTimeout(backTest, 3000);
  }).catch((e) => { console.error(e); const m = $("sr13dMsg"); if (m) m.textContent = "3D view could not start: " + e.message; });
}

/* ---------------- self-check (&sr1test) */
function selfTest(A) {
  const out = [], log = (s) => { out.push(s); console.log("SR1TEST " + s); };
  const { R } = calcAll({}, null);
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const ok = Math.abs(got - exp) <= tol; ok ? pass++ : fail++; log(`${ok ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${exp} ± ${tol})`); };
  const fem = A.fem;
  chk("FEM SC s (core)", fem.sc, 34.8, 0.05); chk("FEM DC s (core)", fem.dc, 57.8, 0.05); chk("FEM SC jobs/h", fem.scPerH, 103.4, 0.1); chk("FEM DC jobs/h", fem.dcPerH, 124.5, 0.1);
  chk("FEM SC calc = core", R.fem.sc, fem.sc, 1e-6); chk("FEM DC calc = core", R.fem.dc, fem.dc, 1e-6);
  chk("slots RACK.slots", RACK.slots, 392, 0); chk("slots sim", A.sim.slots.length, 392, 0); chk("slot ids unique", new Set(A.sim.slots.map((s) => s.id)).size, 392, 0);
  for (const [k, exp] of Object.entries(CHECK)) { const got = k === "sc" || k === "dc" ? R.fem[k] : R[k]; const tol = Math.max(Math.abs(exp) * 0.002, 0.002); chk("calc " + k, got, exp, tol); }
  const c = view ? view.counts() : {};
  chk("3D uprights (inner, both sides)", c.upright || 0, 52, 0); chk("3D end-frame uprights", c.endframe || 0, 8, 0); chk("3D beams", c.beam || 0, 392, 0);
  chk("3D slot label plates", c.slotPlates || 0, 392, 0); chk("3D slot pick volumes", c.pickVolumes || 0, 392, 0); chk("3D load guides", c.loadGuide || 0, 784, 0);
  chk("3D crates shown = loads in slots + crane + conveyors", c.cratesShown || 0, A.sim.slots.filter((s) => s.load).length + (A.sim.crane.carrying ? 1 : 0) + Math.min(7, A.sim.inConv.length) + A.sim.outConv.length, 0);
  log(`INFO 3D objects: meshes=${c.meshes} instanced=${c.instanced} instances=${c.instances} bracing=${c.bracing} castings=${c.castingsShown} parts=${c.parts} drawCalls=${c.calls} tris=${c.tris}`);
  if (view && view.pickWorld) { const sl = A.sim.byId.get("L-03-1-4"), hp = view.pickWorld(sl.x, -1.93, sl.z + 0.25), hi = view.pickWorld(-5.0, -1.35 - 0.66, 0.74);
    const okS = /L-03-1-4/.test(hp), okI = hi === "part:infeed"; okS ? pass++ : fail++; okI ? pass++ : fail++;
    log(`${okS ? "PASS" : "FAIL"} pick rear face of slot L-03-1-4 → ${hp}`); log(`${okI ? "PASS" : "FAIL"} pick infeed conveyor side guide → ${hi}`); }
  log(`INFO crane x=${A.sim.crane.x.toFixed(2)} z=${A.sim.crane.z.toFixed(2)} phase=${A.sim.crane.phase} fill=${(A.sim.fill() * 100).toFixed(1)}% jobs done=${A.sim.stats.stores + A.sim.stats.retrievals}`);
  const card = $("srCard1");
  log(`INFO card srCard1=${!!card} drawings=${card ? card.querySelectorAll(".rr-fig img").length : 0} buyRows=${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows=${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
  // shared fault: crane fault set (as item 2 would) → alarm banner in the 3D view, crane phase "fault"; then cleared again
  A.sim.setFault("crane", true);
  setTimeout(() => {
    const al = host.querySelector(".sr1-alarm"), okA = !!(al && !al.hidden && /CRANE FAULT/.test(al.textContent)), okP = A.sim.crane.phase === "fault";
    okA && okP ? pass++ : fail++; log(`${okA && okP ? "PASS" : "FAIL"} shared crane fault → banner "${al ? al.textContent : ""}", phase ${A.sim.crane.phase}`);
    A.sim.setFault("crane", false);
    log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
    const d = $("sr1Debug"); if (d) { d.hidden = false; d.textContent = out.join("\n"); }
  }, 800);
}
function backTest() {
  const seq = ["2", "3", "4", "1"], ctl = window.srCtl;
  const step = (i) => {
    if (i >= seq.length) { console.log(`SR1BACK DONE item1 built=${host.children.length > 0} canvas=${!!host.querySelector("canvas")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (ctl) ctl.showItem(seq[i]);
    setTimeout(() => { const h = $("srItem" + seq[i]); console.log(`SR1BACK item${seq[i]} visible=${h && !h.hidden} built=${h && h.children.length > 0} errors=${errs.length}`); step(i + 1); }, 2500);
  };
  step(0);
}

window.addEventListener("sritemshow", (e) => { if (String(e.detail) === "1") { build(); if (view) setTimeout(() => view.resize(), 0); } });
if (window.srCtl && window.srCtl.current() === "1" && window.srCtl.tabVisible()) build();
