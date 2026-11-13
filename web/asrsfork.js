/* AS/RS raw materials – item 7 "Telescopic fork – how it moves, gear / chain transfer, load pick-up (3D simulation)" (#srItem7).
 * Guide: docs/39_asrs_telescopic_fork.md · same fork as items 1 + 6 (stroke ± 1.35 m, 1.0 m/s, 1.2 m/s², 3 stages, tines ± 250 mm, deflection 4.9 mm).
 * Files: asrsfork.js (UI, lazy build, timeline, self-check) · asrsfork_3d.js (Three.js fork + carriage + rack + crate) ·
 *   asrsfork_calc.js (geometry, cycle plan, state at t, calculations) · asrsfork_data.js (texts, tables, faults, BOM, card) · asrsfork.css.
 * Lazy: built on window event "sritemshow" (detail "7") or at load when item 7 of the visible AS/RS tab is shown; Three.js is imported only then.
 * Renders only when visible and something moves.
 * URL: ?sritem=7#asrs · &sr7view=iso|front|top|xray|section · &sr7design=rack|chain|belt|friction · &sr7t=<s> (seek) · &sr7fault=offset|occupied|chain|obstacle|notcentre|overload ·
 *   &sr7s=<m> (manual stroke −1.35…1.35) · &sr7follow · &sr7forces · &sr7play · &sr7card=seq|kin|load|fault|mfg · &sr7test (self-check, console "SR7TEST …" + #sr7Debug) ·
 *   &sr7back (7→6→1→7) · &sr7hold (headless: keep the load event pending) · card: &sr7tab=draw|buy|shop · &sr7box=N.
 * Offline. ALL VALUES ARE EXAMPLES – the fork maker's data decides.
 */
import { CRANE, RACK, lhdTime, forkTime, trapPos, trapVel, trapTime } from "./asrscore.js";
import { FG, CR, RK, CLR, POS, FAULTS, plan, stateAt, calc7, DEF7, INP7, CHECK7 } from "./asrsfork_calc.js";
import { NOTE7, DESIGNS, SENS, STEP_INFO, FAULT_INFO, IFACE, PALLET, LHD, MFG, TENSION, MAINT, FAILS, BOM7, CARD7 } from "./asrsfork_data.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fv = (v) => (typeof v !== "number" || !Number.isFinite(v) ? esc(v) : Math.abs(v) >= 1e5 ? v.toExponential(2) : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en-US").replace(/,/g, " ") : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));
const host = $("srItem7");
const errs = [];
if (Q.has("sr7test") || Q.has("sr7back")) {
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
}
// test only (&sr7hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots wait for --timeout)
if (Q.has("sr7hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?sr7hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("asrs"); else { const b = document.querySelector('[data-tab="asrs"]'); if (b) b.click(); } }, 300); }

let built = false, V = null, calcInp = {}, lastCalc = null;
const SIM = { P: plan(), t: 0, play: false, speed: 1, stopAt: null, mode: "cycle", man: 0, manTarget: null, gentle: false, fault: null, st: null };

/* manual mode: carriage parked at slot L (pick height), fork moved by the user */
function manualState(sTop, vS = 0) {
  const base = stateAt(SIM.P, SIM.P[1].t1 - 1e-6);
  const st = Object.assign({}, base, { s: sTop, sTop, sMid: sTop / 2, vS, g: { k: "man", n: "Manual: fork moved with the stroke slider / buttons", i: -1 }, alarm: null });
  st.crate = Object.assign({}, base.crate);
  st.sens = Object.assign({}, base.sens, { centre: Math.abs(sTop) < 0.005, endL: sTop <= -FG.stroke + 0.005, endR: sTop >= FG.stroke - 0.005, inPos: true, occ: false, loadOn: false, ovL: false, ovR: false, torque: false, slip: false });
  return st;
}

function build() {
  if (built || !host) return; built = true;
  const VIEWS = [["iso", "Iso"], ["front", "Front"], ["top", "Top"], ["xray", "X-ray"], ["section", "Section"]];
  host.innerHTML = `
  <div class="sr7-wrap">
    <div class="card" id="sr7Sim">
      <div class="card-head"><h2>3D simulation – 3-stage telescopic fork on the lifting carriage</h2>
        <span class="sr7-ctl"><span class="seg" role="group" aria-label="view">${VIEWS.map(([k, t]) => `<button class="seg-btn" data-sr7view="${k}">${t}</button>`).join("")}</span>
          <select id="sr7Design" aria-label="drive design">${Object.entries(DESIGNS).map(([k, d]) => `<option value="${k}">${esc(d.n)}</option>`).join("")}</select></span></div>
      <div class="sr7-bar">
        <button class="btn primary" type="button" id="sr7Play">▶ Play full cycle</button>
        <button class="btn" type="button" id="sr7Prev" title="go to the start of the previous step">◀ step</button>
        <button class="btn" type="button" id="sr7Next" title="play the next step only">step ▶</button>
        <button class="btn ghost" type="button" id="sr7Reset">Reset</button>
        <label class="sr7-lbl">speed <input type="range" id="sr7Speed" min="0.1" max="2" step="0.05" value="1" aria-label="speed"> <b id="sr7SpeedV">1.0×</b></label>
        <span class="sr7-sep"></span>
        <button class="btn" type="button" id="sr7ExL">◀ extend L</button><button class="btn" type="button" id="sr7Cen">centre</button><button class="btn" type="button" id="sr7ExR">extend R ▶</button>
        <label class="sr7-lbl">stroke <input type="range" id="sr7Stroke" min="-1.35" max="1.35" step="0.005" value="0" aria-label="stroke of the top stage"> <b id="sr7StrokeV">0 mm</b></label>
        <span class="sr7-sep"></span>
        <label class="sr7-chk"><input type="checkbox" id="sr7Lbl" checked> labels</label>
        <label class="sr7-chk"><input type="checkbox" id="sr7Follow"${Q.has("sr7follow") ? " checked" : ""}> follow one chain link</label>
        <label class="sr7-chk"><input type="checkbox" id="sr7Forces"${Q.has("sr7forces") ? " checked" : ""}> show forces</label>
        <label class="sr7-chk" title="loaded fork moves at 0.8 m/s, 0.8 m/s² (the core uses 1.0 / 1.2 both ways)"><input type="checkbox" id="sr7Gentle"> gentle with load</label>
      </div>
      <div class="sr7-main">
        <div class="scene3d sr7-3d" id="sr73d"><div class="sr7-msg">3D view is loading …</div><div class="sr7-alarm" id="sr7Alarm" hidden></div></div>
        <div class="sr7-info" id="sr7Info"></div>
      </div>
      <div class="sr7-design" id="sr7DesignInfo"></div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom, double-click = new orbit point. The camera follows the carriage.
        <b>X-ray</b> makes the stages and the crate transparent: you see the racks (green) and the 2 pinions per tine (red), the 2 synchronising shafts (violet) with their coupling chain, the sprockets (blue), the 4 chains with moving links,
        the chain anchors (orange) and the rollers (yellow). <b>Section</b> cuts through all 3 stages. "Follow one chain link": the yellow link lies still on the base, runs over the sprocket and then moves with the tine.
        Same fork as items 1 + 6: 2 tines at ± 250 mm, 3 stages × 1.0 m, stroke ± 1 350 mm. ${esc(NOTE7)}</p>
    </div>

    <div class="card" id="sr7Seq">
      <div class="card-head"><h2>Load pick-up + deposit – the cycle step by step</h2><span class="sub" id="sr7SeqSub"></span></div>
      <canvas class="sr7-chart" id="sr7Chart" width="1200" height="300" aria-label="timeline: fork position, fork speed, carriage height"></canvas>
      <p class="sr7-note">Timeline synced with the 3D view – click the chart to jump to a moment. Fork position = top stage (tine), speed = tine speed, carriage = height of the tine top (shaded = crate on the fork).
        Load handling at one stop = 2.18 + 0.50 + 2.18 = <b>${lhdTime().toFixed(2)} s</b> (asrscore lhdTime, items 1 + 6).</p>
      <div class="table-wrap"><table class="sr7-tbl" id="sr7StepTbl"></table></div>
    </div>

    <div class="card" id="sr7Kin">
      <div class="card-head"><h2>How it moves – kinematics + gear transfer (live numbers)</h2><span class="sub">hand-checkable · guide 39 §6–8 · consistent with guides 31 §7.8 + 38 §7.7</span></div>
      <div class="sr7-kingrid">
        <div class="sr7-kinsvg" id="sr7KinSvg"></div>
        <div><div class="sr7-inp" id="sr7Inp"></div>
          <p class="sr7-note">Change an input – all tables update. Example = the fork of items 1 / 6: 300 kg, 1.0 m/s, 1.2 m/s², pinion Ø40 (m 2, z 20), 4-pole motor 1 400 rpm, stages 1.0 m.</p></div>
      </div>
      <div id="sr7CalcOut"></div>
      <p class="sr7-note">Simplified checks for understanding (no full code check). The fork maker proves the design (FEM 9.831 / EN 13001 ideas, EN 528 for the crane) – ask for the calculation and the deflection test record.</p>
    </div>

    <div class="card" id="sr7Load">
      <div class="card-head"><h2>Connection with the load – tines, crate, clearances, load guides</h2><span class="sub">guide 39 §9</span></div>
      <div class="sr7-loadgrid"><div class="sr7-ifsvg" id="sr7IfSvg"></div>
        <div><div class="table-wrap"><table class="sr7-tbl sr7-tbl2" id="sr7IfTbl"></table></div></div></div>
      <h3 class="sr7-h">Crate with runners or pallet?</h3>
      <div class="table-wrap"><table class="sr7-tbl" id="sr7PalTbl"></table></div>
      <h3 class="sr7-h">What if the crate is offset or overhangs?</h3>
      <p class="sr7-sn">Up to ≈ 20 mm: the 45° lead-in of the load guides centres the crate at the next deposit. More than 20 mm: the overhang light barrier on the carriage stops the crane ("crate offset" in the fault card). A crate that overhangs the slot at the rear is found by the rear stop and the contour check at the infeed (guide 31 §10).
        <b>Lift carry</b> (our fork lifts the crate) keeps the crate still on the tines; <b>friction carry</b> (pull a tote over rollers) is used only for light totes.</p>
      <h3 class="sr7-h">Other load-handling devices – comparison</h3>
      <div class="table-wrap"><table class="sr7-tbl" id="sr7LhdTbl"></table></div>
    </div>

    <div class="card" id="sr7Fault">
      <div class="card-head"><h2>Faults – what the sensor sees and what the PLC does</h2><span class="sub">runs the cycle in the 3D view until the fault is detected</span></div>
      <div class="sr7-fbtns" id="sr7FBtns">${FAULTS.map((f) => `<button class="btn warn" type="button" data-sr7fault="${f}">${esc(FAULT_INFO[f].n)}</button>`).join("")}<button class="btn ghost" type="button" data-sr7fault="">no fault (normal cycle)</button></div>
      <div class="sr7-fout" id="sr7FOut"><p class="sr7-sn">Click a fault. The cycle starts from the beginning and stops where the sensor + PLC catch the fault.</p></div>
      <div class="table-wrap"><table class="sr7-tbl" id="sr7SensTbl"></table></div>
    </div>

    <div class="card" id="sr7Mfg">
      <div class="card-head"><h2>Manufacturing + maintenance</h2><span class="sub">guide 39 §12–15 · route "fork" in item 6</span></div>
      <h3 class="sr7-h">How the parts are made</h3><div class="table-wrap"><table class="sr7-tbl" id="sr7MfgTbl"></table></div>
      <div class="sr7-two"><div><h3 class="sr7-h">Chain tensioning procedure</h3><ol class="sr7-ol" id="sr7Tension"></ol></div>
        <div><h3 class="sr7-h">Maintenance plan</h3><div class="table-wrap"><table class="sr7-tbl sr7-tbl2" id="sr7MaintTbl"></table></div></div></div>
      <h3 class="sr7-h">Typical failures</h3><div class="table-wrap"><table class="sr7-tbl" id="sr7FailTbl"></table></div>
      <h3 class="sr7-h">Parts list – one fork with 2 tines (make / buy)</h3><div class="table-wrap"><table class="sr7-tbl" id="sr7BomTbl"></table></div>
      <p class="sr7-note">Buying the complete fork from the crane maker or a fork specialist is normal for a first crane; making it needs a long CNC mill (2 m), induction hardening and an assembly bench with a 300 kg test load (guide 38 §14.7). ${esc(NOTE7)}</p>
    </div>
    <div class="sr7-debug" id="sr7Debug" hidden></div>
  </div>`;

  /* ---------------- static tables */
  const tbl = (id, cols, rows, w) => { $(id).innerHTML = `${w ? `<colgroup>${w.map((x) => `<col style="width:${x}%">`).join("")}</colgroup>` : ""}<thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`; };
  tbl("sr7IfTbl", ["Item", "Value (example)", "Why / check"], IFACE, [24, 42, 34]);
  tbl("sr7PalTbl", ["", "Crate with runners", "Pallet"], PALLET, [18, 41, 41]);
  tbl("sr7LhdTbl", ["Device", "Loads", "How it works", "Plus", "Minus"], LHD, [17, 16, 25, 21, 21]);
  tbl("sr7SensTbl", ["Sensor", "What it checks", "How (example)"], SENS.map((s) => [s[0], s[1], s[2]]), [12, 38, 50]);
  tbl("sr7MfgTbl", ["Part", "Material / how", "Process notes", "Check"], MFG, [14, 34, 30, 22]);
  tbl("sr7MaintTbl", ["When", "What", "Who"], MAINT, [16, 64, 20]);
  tbl("sr7FailTbl", ["Failure", "Cause", "Effect", "Cure / prevention"], FAILS, [18, 24, 28, 30]);
  $("sr7Tension").innerHTML = TENSION.map((t) => `<li>${esc(t)}</li>`).join("");
  const bomKg = BOM7.reduce((s, r) => s + r[4] * r[5], 0);
  $("sr7BomTbl").innerHTML = `<colgroup><col style="width:5%"><col style="width:40%"><col style="width:13%"><col style="width:28%"><col style="width:6%"><col style="width:8%"></colgroup><thead><tr><th>Pos</th><th>Item</th><th>Make / buy</th><th>Material / spec</th><th>Qty</th><th>kg</th></tr></thead><tbody>${
    BOM7.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td><td class="${/BUY/.test(r[2]) && !/MAKE/.test(r[2]) ? "sr7-buy" : "sr7-make"}">${esc(r[2])}</td><td>${esc(r[3])}</td><td class="sr7-v">${r[4]}</td><td class="sr7-v">${fv(r[4] * r[5])}</td></tr>`).join("")}
    <tr class="sr7-sum"><td></td><td><b>${BOM7.length} positions</b></td><td></td><td>item 6 BOM: fork ≈ 200 kg</td><td></td><td class="sr7-v"><b>${fv(bomKg)}</b></td></tr></tbody>`;
  $("sr7IfSvg").innerHTML = ifSvg();

  /* ---------------- design selector */
  const dsel = $("sr7Design");
  const showDesign = () => { const d = DESIGNS[dsel.value]; $("sr7DesignInfo").innerHTML = `<b>${esc(d.n)}:</b> ${esc(d.how)} <span class="sr7-plus">+ ${esc(d.plus)}</span> <span class="sr7-minus">− ${esc(d.minus)}</span> <i>Used for: ${esc(d.where)}.</i>`; if (V) V.setDesign(dsel.value); };
  dsel.addEventListener("change", showDesign);
  if (DESIGNS[Q.get("sr7design")]) dsel.value = Q.get("sr7design");
  showDesign();

  /* ---------------- calculations */
  $("sr7Inp").innerHTML = INP7.map(([k, t, u]) => `<label>${esc(t)} <input type="number" step="any" data-sr7in="${k}" value="${DEF7[k]}"> <small>${esc(u)}</small></label>`).join("") + `<button class="btn ghost" type="button" id="sr7InpReset">Reset to the example</button>`;
  host.querySelectorAll("[data-sr7in]").forEach((i) => i.addEventListener("input", () => { const v = parseFloat(i.value); if (Number.isFinite(v) && v > 0) calcInp[i.dataset.sr7in] = v; else delete calcInp[i.dataset.sr7in]; renderCalc(); }));
  $("sr7InpReset").addEventListener("click", () => { calcInp = {}; host.querySelectorAll("[data-sr7in]").forEach((i) => (i.value = DEF7[i.dataset.sr7in])); renderCalc(); });
  function renderCalc() {
    lastCalc = calc7(calcInp); const { S } = lastCalc;
    $("sr7CalcOut").innerHTML = S.map((s) => `<h3 class="sr7-h" id="sr7c-${s.id}">${esc(s.t)}</h3><p class="sr7-sn">${esc(s.note)}</p>
      <div class="table-wrap"><table class="sr7-tbl sr7-calc"><colgroup><col style="width:24%"><col style="width:36%"><col style="width:11%"><col style="width:7%"><col style="width:22%"></colgroup>
      <thead><tr><th>Item</th><th>Formula / input</th><th>Value</th><th>Unit</th><th>Check</th></tr></thead><tbody>${s.rows.map((r) => `<tr><td>${esc(r.item)}</td><td>${esc(r.formula)}</td><td class="sr7-v">${fv(r.value)}</td><td>${esc(r.unit)}</td>
      <td>${r.ok === true ? '<span class="sr7-okb">OK</span> ' : r.ok === false ? '<span class="sr7-nok">CHECK</span> ' : ""}${esc(r.check)}</td></tr>`).join("")}</tbody></table></div>`).join("");
    if (V) V.forces($("sr7Forces").checked, lastCalc.R);
  }
  renderCalc();

  /* ---------------- step table + chart */
  function renderSteps() {
    const P = SIM.P;
    $("sr7SeqSub").textContent = `${P.length} steps · total ${P.T.toFixed(2)} s${P.fault ? " · FAULT: " + FAULT_INFO[P.fault].n : ""} · ${NOTE7}`;
    $("sr7StepTbl").innerHTML = `<colgroup><col style="width:4%"><col style="width:20%"><col style="width:8%"><col style="width:44%"><col style="width:24%"></colgroup><thead><tr><th>#</th><th>Step</th><th>Time (s)</th><th>What happens</th><th>Sensor states</th></tr></thead><tbody>${
      P.map((g, i) => { const inf = STEP_INFO[g.k] || { what: g.n, s: "" }; return `<tr data-sr7step="${i}"><td>${i + 1}</td><td><b>${esc(g.n)}</b></td><td class="sr7-v">${g.dur.toFixed(2)}<br><small>${g.t0.toFixed(2)} → ${g.t1.toFixed(2)}</small></td><td>${esc(inf.what)}</td><td>${esc(inf.s)}</td></tr>`; }).join("")}
      <tr class="sr7-sum"><td></td><td><b>total</b></td><td class="sr7-v"><b>${P.T.toFixed(2)}</b></td><td colspan="2">2 × travel ${P[0].dur.toFixed(2)} s + 2 × positioning ${CRANE.tPos} s + 2 × load handling ${lhdTime().toFixed(2)} s (normal cycle)</td></tr></tbody>`;
    $("sr7StepTbl").querySelectorAll("[data-sr7step]").forEach((tr) => tr.addEventListener("click", () => { SIM.mode = "cycle"; SIM.play = false; SIM.t = P[+tr.dataset.sr7step].t0 + 1e-4; apply(); }));
    chartData = null;
  }
  let chartData = null;
  function chart() {
    const cv = $("sr7Chart"), P = SIM.P;
    const w = cv.clientWidth || 1000, h = 300, pr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * pr)) { cv.width = Math.round(w * pr); cv.height = Math.round(h * pr); chartData = null; }
    const g = cv.getContext("2d"); g.setTransform(pr, 0, 0, pr, 0, 0);
    const css = getComputedStyle(host), tx = css.getPropertyValue("--text").trim() || "#111", t2 = css.getPropertyValue("--text-2").trim() || "#555", grid = css.getPropertyValue("--grid").trim() || "#ddd";
    if (!chartData) { const n = 600, d = []; for (let k = 0; k <= n; k++) { const t = P.T * k / n, s = stateAt(P, t); d.push([t, s.sTop, s.vS, s.y - P[0].y0, s.crate.on]); } chartData = d; }
    const L = 70, R = 12, Tm = 8, strips = [["fork position s_top (m)", 1, -1.5, 1.5, "#1f6fd1"], ["fork speed v_top (m/s)", 2, -1.2, 1.2, "#d62828"], ["carriage height Δz (m)", 3, -0.1, 2.75, "#2e8b57"]];
    const sh = (h - Tm - 22) / 3, X = (t) => L + (w - L - R) * t / P.T;
    g.clearRect(0, 0, w, h); g.font = "11px Arial, sans-serif";
    P.forEach((s, i) => { if (i % 2) { g.fillStyle = "rgba(127,127,127,0.07)"; g.fillRect(X(s.t0), Tm, X(s.t1) - X(s.t0), sh * 3); } });
    strips.forEach(([lab, idx, lo, hi, col], k) => {
      const y0 = Tm + k * sh, Y = (v) => y0 + sh - 4 - (sh - 10) * (v - lo) / (hi - lo);
      g.strokeStyle = grid; g.lineWidth = 1; g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(w - R, Y(0)); g.stroke();
      g.fillStyle = t2; g.textAlign = "right"; g.fillText(hi.toFixed(1), L - 6, Y(hi) + 8); g.fillText(lo.toFixed(1), L - 6, Y(lo)); g.textAlign = "left"; g.fillStyle = tx; g.fillText(lab, L + 4, y0 + 11);
      if (idx === 3) { g.fillStyle = "rgba(217,164,65,0.22)"; let a = null; chartData.forEach((d, j) => { if (d[4] && a === null) a = d[0]; if ((!d[4] || j === chartData.length - 1) && a !== null) { g.fillRect(X(a), y0 + 2, X(d[0]) - X(a), sh - 4); a = null; } }); }
      g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); chartData.forEach((d, j) => { const x = X(d[0]), y = Y(d[idx]); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    });
    g.fillStyle = t2; g.textAlign = "center"; P.forEach((s, i) => { if (s.dur > 0.4) g.fillText(String(i + 1), (X(s.t0) + X(s.t1)) / 2, h - 18); });
    g.textAlign = "left"; g.fillText("time (s) →  step numbers as in the table", L, h - 4); g.textAlign = "right"; g.fillText(`${P.T.toFixed(1)} s`, w - R, h - 4);
    if (SIM.mode === "cycle") { const x = X(SIM.t); g.strokeStyle = tx; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, Tm); g.lineTo(x, Tm + 3 * sh); g.stroke(); }
  }
  $("sr7Chart").addEventListener("click", (e) => { const r = e.target.getBoundingClientRect(), L = 70, R = 12; const t = (e.clientX - r.left - L) / (r.width - L - R) * SIM.P.T; if (t >= 0 && t <= SIM.P.T) { SIM.mode = "cycle"; SIM.play = false; SIM.t = t; apply(); } });

  /* ---------------- info panel + lamps */
  function info(st) {
    const R = lastCalc ? lastCalc.R : calc7({}).R;
    const vMid = st.vS / 2, nP = vMid * 60 / (Math.PI * 0.04), nM = nP * R.i;
    const lamp = (k) => { const v = st.sens[k]; const bad = (k === "ovL" || k === "ovR" || k === "occ" || k === "slip" || k === "torque") && v; return `<span class="sr7-lamp ${v ? (bad ? "bad" : "on") : ""}"></span>`; };
    $("sr7Info").innerHTML = `<h3>${SIM.mode === "cycle" ? `Step ${st.g.i + 1} / ${SIM.P.length}` : "Manual"}</h3><div class="sr7-phase">${esc(st.g.n)}</div>
      <table class="sr7-kv">
        <tr><th>time</th><td>${SIM.mode === "cycle" ? `${st.t.toFixed(2)} / ${SIM.P.T.toFixed(2)} s` : "–"}</td></tr>
        <tr><th>middle stage s_mid</th><td>${(st.sMid * 1000).toFixed(0)} mm</td></tr>
        <tr><th>top stage s_top (= 2·s_mid)</th><td>${(st.sTop * 1000).toFixed(0)} mm</td></tr>
        <tr><th>tine speed v_top</th><td>${st.vS.toFixed(2)} m/s</td></tr>
        <tr><th>middle stage v_mid</th><td>${vMid.toFixed(2)} m/s</td></tr>
        <tr><th>pinion n_p = v_mid·60/(π·d)</th><td>${Math.abs(nP).toFixed(0)} rpm</td></tr>
        <tr><th>motor n_m = n_p · i (${R.i.toFixed(2)})</th><td>${Math.abs(nM).toFixed(0)} rpm</td></tr>
        <tr><th>travel x · hoist (tine top)</th><td>${st.z.toFixed(3)} · ${st.y.toFixed(3)} m</td></tr>
        <tr><th>load on the fork</th><td>${st.sens.kg ? st.sens.kg + " kg" : "–"}</td></tr>
        ${V && V.S.follow ? `<tr><th>yellow chain link</th><td>${esc(V.S.linkState === "lower" ? "still (on the base)" : V.S.linkState === "arc" ? "over the sprocket" : "moving with the tine")}</td></tr>` : ""}
        ${V && V.S.forces && V.S.R && V.S.R.F ? `<tr><th>forces (one tine)</th><td>F ${V.S.R.F.toFixed(2)} kN · roller ${Math.max(V.S.R.R1f || 0, 0).toFixed(2)} kN</td></tr>` : ""}
      </table>
      <h4>Sensors</h4><ul class="sr7-lamps">${SENS.map(([k, t]) => `<li>${lamp(k)}${esc(t)}</li>`).join("")}</ul>
      <p class="sr7-small">green = signal ON, red = alarm signal ON. ${esc(NOTE7)}</p>`;
  }
  /* ---------------- alarm box */
  function alarm(st) {
    const box = $("sr7Alarm"), a = st.alarm;
    if (!a) { box.hidden = true; return; }
    const f = FAULT_INFO[a]; box.hidden = false;
    box.innerHTML = `<b>ALARM – ${esc(f.n)}</b><br><b>Sensor:</b> ${esc(f.see)}<br><b>PLC:</b> ${esc(f.plc)}`;
  }

  /* ---------------- kinematics drawing (live) */
  function kinSvg(st) {
    const s = st.sMid, t = st.sTop, X = (x) => 300 + x * 150, f0 = (v) => (v * 1000).toFixed(0);
    const yB = 150, yM = 120, yT = 90, r = 11;
    const xs = s + 0.46, ab = -0.3, at = t - 0.3;
    return `<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="stroke doubling live">
      <rect width="600" height="260" fill="#fff"/>
      <text x="12" y="20" font-size="13" font-weight="bold" fill="#111">Stroke doubling – one tine, chain for side R (live)</text>
      <line x1="${X(0)}" y1="30" x2="${X(0)}" y2="210" stroke="#999" stroke-dasharray="4 3"/><text x="${X(0) + 4}" y="40" font-size="11" fill="#555">crane axis</text>
      <rect x="${X(-0.5)}" y="${yB}" width="150" height="16" fill="#7f8890" stroke="#111"/><text x="${X(-0.5) + 4}" y="${yB + 12}" font-size="11" fill="#fff">base (fixed)</text>
      <rect x="${X(s - 0.5)}" y="${yM}" width="150" height="16" fill="#a9b1b8" stroke="#111"/><text x="${X(s - 0.5) + 4}" y="${yM + 12}" font-size="11" fill="#111">middle</text>
      <rect x="${X(t - 0.5)}" y="${yT}" width="150" height="16" fill="#c9ced3" stroke="#111"/><text x="${X(t - 0.5) + 4}" y="${yT + 12}" font-size="11" fill="#111">top = tine</text>
      <path d="M ${X(ab)} ${yB - 2} L ${X(xs)} ${yB - 2} A ${r} ${r} 0 0 0 ${X(xs)} ${yB - 2 - 2 * r} L ${X(at)} ${yB - 2 - 2 * r}" fill="none" stroke="#ff7f0e" stroke-width="3"/>
      <circle cx="${X(xs)}" cy="${yB - 2 - r}" r="${r - 2}" fill="#1f6fd1"/>
      <line x1="${X(at)}" y1="${yT + 16}" x2="${X(at)}" y2="${yB - 2 - 2 * r}" stroke="#111" stroke-width="2.5"/><rect x="${X(ab) - 5}" y="${yB - 7}" width="10" height="9" fill="#111"/><rect x="${X(at) - 5}" y="${yB - 2 - 2 * r - 4}" width="10" height="9" fill="#111"/>
      <text x="${X(ab)}" y="${yB + 30}" font-size="11" text-anchor="middle" fill="#111">anchor A (base)</text>
      <text x="${X(at)}" y="${yT - 6}" font-size="11" text-anchor="middle" fill="#111">anchor B (top stage)</text>
      <line x1="${X(0)}" y1="198" x2="${X(s)}" y2="198" stroke="#111" stroke-width="2"/><text x="${X(s / 2)}" y="194" font-size="12" text-anchor="middle" fill="#111">s_mid = ${f0(s)} mm</text>
      <line x1="${X(0)}" y1="222" x2="${X(t)}" y2="222" stroke="#d62828" stroke-width="2"/><text x="${X(t / 2)}" y="240" font-size="12" text-anchor="middle" fill="#d62828">s_top = 2 · s_mid = ${f0(t)} mm</text>
      <text x="588" y="252" font-size="11" text-anchor="end" fill="#888">EXAMPLE – the fork maker's data decides</text></svg>`;
  }

  /* ---------------- main apply + loop */
  function apply() {
    let st;
    if (SIM.mode === "manual") st = manualState(SIM.man, SIM.manV || 0); else st = stateAt(SIM.P, SIM.t);
    SIM.st = st;
    if (V) V.setState(st);
    $("sr7Stroke").value = st.sTop.toFixed(3); $("sr7StrokeV").textContent = `${(st.sTop * 1000).toFixed(0)} mm`;
    info(st); alarm(st); chart(); $("sr7KinSvg").innerHTML = kinSvg(st);
    host.querySelectorAll("[data-sr7step]").forEach((tr) => tr.classList.toggle("sr7-cur", SIM.mode === "cycle" && +tr.dataset.sr7step === st.g.i));
    $("sr7Play").textContent = SIM.play ? "❚❚ Pause" : SIM.mode === "cycle" && SIM.t >= SIM.P.T - 1e-6 ? "▶ Play again" : "▶ Play full cycle";
  }
  function setPlan(fault) {
    SIM.fault = fault || null; SIM.P = plan({ fault: SIM.fault, gentle: SIM.gentle }); SIM.t = 0; SIM.mode = "cycle"; SIM.stopAt = null;
    if (V) V.setFault(SIM.fault); renderSteps();
  }
  $("sr7Play").addEventListener("click", () => { if (SIM.mode !== "cycle") { SIM.mode = "cycle"; SIM.t = 0; } if (SIM.t >= SIM.P.T - 1e-6) SIM.t = 0; SIM.play = !SIM.play; SIM.stopAt = null; apply(); });
  $("sr7Next").addEventListener("click", () => { if (SIM.mode !== "cycle") { SIM.mode = "cycle"; SIM.t = 0; } const st = stateAt(SIM.P, SIM.t); let g = st.g; if (SIM.t >= g.t1 - 1e-4 && SIM.P[g.i + 1]) g = SIM.P[g.i + 1]; SIM.stopAt = g.t1; if (SIM.t >= SIM.P.T - 1e-6) { SIM.t = 0; SIM.stopAt = SIM.P[0].t1; } SIM.play = true; apply(); });
  $("sr7Prev").addEventListener("click", () => { SIM.mode = "cycle"; SIM.play = false; const st = stateAt(SIM.P, SIM.t); const i = SIM.t - st.g.t0 < 0.05 ? Math.max(0, st.g.i - 1) : st.g.i; SIM.t = SIM.P[i].t0 + 1e-4; apply(); });
  $("sr7Reset").addEventListener("click", () => { SIM.play = false; setPlan(SIM.fault); apply(); });
  $("sr7Speed").addEventListener("input", (e) => { SIM.speed = +e.target.value; $("sr7SpeedV").textContent = SIM.speed.toFixed(1) + "×"; });
  const goMan = (target) => { SIM.play = false; if (SIM.mode !== "manual") { SIM.mode = "manual"; SIM.man = 0; } SIM.manTarget = { from: SIM.man, to: target, t: 0 }; };
  $("sr7ExL").addEventListener("click", () => goMan(-FG.stroke)); $("sr7ExR").addEventListener("click", () => goMan(FG.stroke)); $("sr7Cen").addEventListener("click", () => goMan(0));
  $("sr7Stroke").addEventListener("input", (e) => { SIM.play = false; SIM.mode = "manual"; SIM.manTarget = null; SIM.man = +e.target.value; SIM.manV = 0; apply(); });
  host.querySelectorAll("[data-sr7view]").forEach((b) => b.addEventListener("click", () => { if (V) V.setView(b.dataset.sr7view); updViewBtns(); }));
  const updViewBtns = () => host.querySelectorAll("[data-sr7view]").forEach((b) => b.classList.toggle("active", V && b.dataset.sr7view === V.S.view));
  $("sr7Lbl").addEventListener("change", (e) => { if (V) V.labels(e.target.checked); });
  $("sr7Follow").addEventListener("change", (e) => { if (V) { V.follow(e.target.checked); if (e.target.checked && V.S.view !== "xray") { V.setView("xray"); updViewBtns(); } apply(); } });
  $("sr7Forces").addEventListener("change", (e) => { if (V) { V.forces(e.target.checked, lastCalc && lastCalc.R); apply(); } });
  $("sr7Gentle").addEventListener("change", (e) => { SIM.gentle = e.target.checked; setPlan(SIM.fault); apply(); });
  host.querySelectorAll("[data-sr7fault]").forEach((b) => b.addEventListener("click", () => {
    const f = b.dataset.sr7fault || null; setPlan(f); SIM.play = true; SIM.speed = Math.max(SIM.speed, 1);
    host.querySelectorAll("[data-sr7fault]").forEach((x) => x.classList.toggle("primary", x === b && !!f));
    $("sr7FOut").innerHTML = f ? `<div class="sr7-fcase"><h3>${esc(FAULT_INFO[f].n)}</h3><dl class="sr7-dl"><dt>What the sensor sees</dt><dd>${esc(FAULT_INFO[f].see)}</dd><dt>What the PLC does</dt><dd>${esc(FAULT_INFO[f].plc)}</dd><dt>How to fix + prevent</dt><dd>${esc(FAULT_INFO[f].fix)}</dd></dl>
      <p class="sr7-small">The 3D view runs the cycle and stops at the detection point (red box in the view). Steps: ${SIM.P.length}, stop at step ${SIM.P.at + 1} "${esc(SIM.P[SIM.P.at].n)}".</p></div>` : `<p class="sr7-sn">Normal cycle – no fault.</p>`;
    $("sr7Sim").scrollIntoView({ block: "start", behavior: "smooth" }); apply();
  }));

  let lastT = performance.now(), lastUi = 0;
  (function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    if (host.hidden || !host.offsetParent || document.hidden) return;
    let moved = false;
    if (SIM.mode === "cycle" && SIM.play) {
      SIM.t += dt * SIM.speed; moved = true;
      const P = SIM.P, atEnd = P.at >= 0 ? P[P.at].t1 : P.T;
      if (SIM.stopAt !== null && SIM.t >= SIM.stopAt) { SIM.t = SIM.stopAt; SIM.play = false; SIM.stopAt = null; }
      if (SIM.t >= atEnd) { SIM.t = atEnd; SIM.play = false; }
    }
    if (SIM.mode === "manual" && SIM.manTarget) {
      const m = SIM.manTarget, d = m.to - m.from; m.t += dt * SIM.speed;
      SIM.man = m.from + trapPos(d, CRANE.vf, CRANE.af, m.t); SIM.manV = trapVel(d, CRANE.vf, CRANE.af, m.t); moved = true;
      if (m.t >= trapTime(Math.abs(d), CRANE.vf, CRANE.af)) { SIM.man = m.to; SIM.manV = 0; SIM.manTarget = null; }
    }
    if (moved) { if (V) V.setState(SIM.mode === "manual" ? manualState(SIM.man, SIM.manV) : stateAt(SIM.P, SIM.t)); if (now - lastUi > 90 || !SIM.play && !SIM.manTarget) { lastUi = now; apply(); } }
  })();

  /* ---------------- catalogue card */
  try { makeCard(CARD7, host.querySelector(".sr7-wrap"), { card: "srCard7", q: "srQ7", g: "srG7", cnt: "srCnt7", buy: "srBuy7" }, "sr7"); } catch (e) { console.error(e); }
  host.querySelector(".sr7-wrap").appendChild($("sr7Debug"));

  /* ---------------- URL params + initial state */
  if (FAULTS.includes(Q.get("sr7fault"))) setPlan(Q.get("sr7fault")); else renderSteps();
  if (Q.has("sr7t")) SIM.t = Math.max(0, Math.min(SIM.P.T, +Q.get("sr7t") || 0));
  if (Q.has("sr7s")) { SIM.mode = "manual"; SIM.man = Math.max(-FG.stroke, Math.min(FG.stroke, +Q.get("sr7s") || 0)); }
  if (Q.has("sr7play")) SIM.play = true;
  apply();
  const cardMap = { seq: "sr7Seq", kin: "sr7Kin", load: "sr7Load", fault: "sr7Fault", mfg: "sr7Mfg" };
  if (cardMap[Q.get("sr7card")]) setTimeout(() => $(cardMap[Q.get("sr7card")]).scrollIntoView({ block: "start" }), 700);
  window.addEventListener("resize", () => { if (!host.hidden) { chartData = chartData; chart(); } });

  /* ---------------- 3D (lazy import) */
  import("./asrsfork_3d.js").then((M) => {
    const el = $("sr73d"); el.querySelector(".sr7-msg").remove();
    V = M.createFork3D(el, {}); window.sr7View = V;
    V.setDesign(dsel.value); V.setFault(SIM.fault);
    const v = Q.get("sr7view"); V.setView(["iso", "front", "top", "xray", "section"].includes(v) ? v : "iso", false);
    if (Q.has("sr7follow")) V.follow(true);
    if (Q.has("sr7forces")) V.forces(true, lastCalc.R);
    updViewBtns(); apply();
    if (Q.has("sr7test")) setTimeout(selfTest, 2500);
    if (Q.has("sr7back")) setTimeout(backTest, 2500);
  }).catch((e) => { console.error(e); const m = host.querySelector("#sr73d .sr7-msg"); if (m) m.textContent = "3D view could not start: " + e.message; });
  SIM.apply = apply; SIM.setPlan = setPlan;
}

/* ---------------- interface drawing (section at the slot, view along the fork direction) */
function ifSvg() {
  const X = (z) => 300 + z * 480, Y = (h) => 300 - h * 700;    // z along the aisle (m), h up from the beam top (m) – vertical scale × 1.46
  const t = (x, y, s, a = "start", c = "#111", fw = "normal", fs = 12) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fs}" text-anchor="${a}" fill="${c}" font-weight="${fw}">${s}</text>`;
  const rc = (z1, h1, z2, h2, f, s = "#111") => `<rect x="${X(z1).toFixed(1)}" y="${Y(h2).toFixed(1)}" width="${(X(z2) - X(z1)).toFixed(1)}" height="${(Y(h1) - Y(h2)).toFixed(1)}" fill="${f}" stroke="${s}"/>`;
  const A = "#d62828", yT = CR.runH - CLR.below;
  const dv = (x, h1, h2, s) => `<line x1="${x}" y1="${Y(h1)}" x2="${x}" y2="${Y(h2)}" stroke="${A}" stroke-width="1.4" marker-start="url(#sr7m)" marker-end="url(#sr7m)"/>${t(x + 6, (Y(h1) + Y(h2)) / 2 + 4, s, "start", A, "bold", 11.5)}`;
  const dh = (z1, z2, h, s, dy) => `<line x1="${X(z1)}" y1="${Y(h)}" x2="${X(z2)}" y2="${Y(h)}" stroke="${A}" stroke-width="1.4" marker-start="url(#sr7m)" marker-end="url(#sr7m)"/>${t((X(z1) + X(z2)) / 2, Y(h) + dy, s, "middle", A, "bold", 11.5)}`;
  let g = "";
  g += rc(-0.56, -0.04, 0.56, 0, "#f3b27a");                                   // beam (top part)
  g += rc(-CR.W / 2, CR.runH, CR.W / 2, CR.runH + 0.17, "#e9edf1");            // crate floor + body (part)
  for (const s of [-1, 1]) g += rc(s * CR.runZ - CR.runW / 2, 0, s * CR.runZ + CR.runW / 2, CR.runH, "#5c6670");
  for (const s of [-1, 1]) { const zc = s * FG.tineZ; g += rc(zc - FG.wM / 2, yT + FG.yM[0], zc + FG.wM / 2, yT + FG.yM[1], "#a9b1b8"); g += rc(zc - FG.wT / 2, yT + FG.yT[0], zc + FG.wT / 2, yT, "#c9ced3"); }
  for (const s of [-1, 1]) { const zg = s * (CR.W / 2 + CLR.guide + 0.01); g += rc(zg - 0.01, 0, zg + 0.01, 0.07, "#dfe3e7"); }
  return `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="clearances at the slot">
    <defs><marker id="sr7m" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="2.6" fill="${A}"/></marker></defs>
    <rect width="600" height="400" fill="#fff"/>
    ${t(14, 22, "Section at the slot – view along the fork (approach height, before the lift)", "start", "#111", "bold", 13)}
    ${g}
    ${t(X(0), Y(CR.runH + 0.10), "crate floor + castings (≤ 300 kg)", "middle")}
    ${t(X(0), Y(-0.02) + 4, "front beam (top 0)", "middle", "#111", "normal", 11.5)}
    ${t(X(-CR.runZ), Y(-0.04) + 15, "runner 50 × 120", "middle", "#111", "normal", 11.5)}${t(X(CR.runZ), Y(-0.04) + 15, "runner", "middle", "#111", "normal", 11.5)}
    ${t(X(-FG.tineZ), Y(yT) - 6, "tine (top / middle)", "middle", "#111", "normal", 11)}
    ${t(X(-(CR.W / 2 + CLR.guide + 0.01)) - 26, Y(0.085), "load guide", "start", "#111", "normal", 11)}
    ${dv(X(0) - 40, CR.runH, yT, `${(CLR.below * 1000).toFixed(0)} under the floor`)}
    ${dv(X(0) - 40, yT + FG.yM[0], 0, `${(CLR.midToBeam * 1000).toFixed(0)} over the beam`)}
    ${dh(FG.tineZ + FG.wM / 2, CR.runZ - CR.runW / 2, 0.015, `${(CLR.side * 1000).toFixed(0)}`, -6)}
    ${dh(CR.W / 2, CR.W / 2 + CLR.guide, 0.10, `${(CLR.guide * 1000).toFixed(1)}`, -8)}
    ${t(14, 366, `Side: runner ↔ middle stage ${(CLR.side * 1000).toFixed(0)} mm (top stage ${(CLR.sideTop * 1000).toFixed(0)}), crate ↔ load guide ${(CLR.guide * 1000).toFixed(1)} mm.`, "start", "#111", "normal", 12)}
    ${t(14, 382, `Lift 100 mm = ${(CLR.below * 1000).toFixed(0)} mm to touch + ${(CLR.free * 1000).toFixed(0)} mm free. Tines at ± ${FG.tineZ * 1000} mm, runners at ± ${CR.runZ * 1000} mm.`, "start", "#111", "normal", 12)}
    ${t(586, 397, "EXAMPLE – check the fork maker's documentation", "end", "#888", "normal", 11)}</svg>`;
}

/* ---------------- self-check (&sr7test) */
function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("SR7TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const ok = Math.abs(got - exp) <= tol; ok ? pass++ : fail++; log(`${ok ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${exp} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const { R } = calc7({});
  for (const [k, e] of Object.entries(CHECK7)) chk("calc " + k, R[k], e, Math.max(Math.abs(e) * 0.002, 0.002));
  // consistency with the core + guides 31 / 38
  chk("stroke = aisle/2 + crate/2 (core, item 6)", FG.stroke, 1.35, 1e-9); chk("core forkTime()", forkTime(), 2.18333, 0.001); chk("core lhdTime() 4.87 s (guide 31 §8)", lhdTime(), 4.86667, 0.001);
  chk("calc tF = core forkTime", R.tF, forkTime(), 1e-9); chk("guide 31 fork force 761 N", R.F, 761, 1); chk("guide 31 fork power 0.95 kW", R.P / 1000, 0.95, 0.005);
  chk("guide 38 tip deflection 4.9 mm", R.dT, 4.9, 0.05); chk("guide 38 elastic 2.64 mm", R.dE, 2.64, 0.01); chk("guide 38 play 2.27 mm", R.dP, 2.27, 0.01);
  chk("overlap at full stroke L − s/2 (mm)", R.ov, 325, 0.01);
  { let worst = 1; for (let k = 0; k <= 270; k++) { const sm = -FG.sMid + k * FG.sMid / 135; const m = Math.max(...[-FG.pinX, FG.pinX].map((px) => FG.L / 2 - Math.abs(px - sm))); worst = Math.min(worst, m); }
    chk("rack mesh: worst margin of the better pinion over the stroke (mm)", worst * 1000, 125, 0.5);
    log(`INFO one central pinion would leave the 1 000 mm rack at |s_mid| > ${(FG.L / 2 * 1000).toFixed(0)} mm (stroke ${(FG.sMid * 1000).toFixed(0)} mm) – that is why there are 2 pinions per tine`); }
  // plan
  const P = plan(), seg = (k) => P.find((g) => g.k === k);
  chk("plan steps (normal)", P.length, 11, 0); chk("plan total time (hand 2·3.924 + 2·3 + 2·4.867)", P.T, 23.5819, 0.002);
  chk("travel move time (hand 2·√(1.925/0.5))", seg("travel1").dur, 3.92428, 0.0005);
  chk("LHD at the pick = out + lift + in", seg("out1").dur + seg("lift1").dur + seg("in1").dur, lhdTime(), 1e-9);
  const sm = stateAt(P, seg("out1").t0 + 1.0); chk("s_top = 2·s_mid (mid of out1)", sm.sTop / sm.sMid, 2, 1e-9);
  const sAt = (k, f) => stateAt(P, seg(k).t0 + f * seg(k).dur);
  ok("centre sensor ON at t = 0", stateAt(P, 0).sens.centre); ok("end L ON at the end of out1", sAt("out1", 0.999).sens.endL || stateAt(P, seg("out1").t1).sens.endL);
  ok("crate on the fork after the lift", sAt("lift1", 1).crate.on && !sAt("lift1", 0.2).crate.on, `contact after ${(CLR.below / CLR.lift * CRANE.tLift).toFixed(2)} s of 0.5`);
  chk("crate free over the beams after the lift (mm)", (stateAt(P, seg("lift1").t1).crate.y - (POS.bL + CR.runH)) * 1000, 60, 0.5);
  chk("crate in slot R at the end (x)", stateAt(P, P.T).crate.x, FG.stroke, 1e-9); ok("crate not on the fork at the end", !stateAt(P, P.T).crate.on);
  chk("clearance middle stage ↔ beam (mm)", CLR.midToBeam * 1000, 28, 0.01); chk("side clearance (mm)", CLR.side * 1000, 30, 0.01); chk("load guide clearance (mm)", CLR.guide * 1000, 27.5, 0.01);
  // faults
  const exp = { offset: "chk1", occupied: "pos2", chain: "out1", obstacle: "out1", notcentre: "chk1", overload: "in1" };
  for (const f of FAULTS) { const Pf = plan({ fault: f }), g = Pf[Pf.at], st = stateAt(Pf, g.t1); ok(`fault ${f}: alarm at step "${g.k}"`, g.k === exp[f] && st.alarm === f, `stop at ${g.t1.toFixed(2)} s`); }
  { const Pf = plan({ fault: "occupied" }); ok("fault occupied: fork never extends to R", Pf.every((g) => g.k !== "out2")); }
  { const Pf = plan({ fault: "chain" }), st = stateAt(Pf, Pf[Pf.at].t1); chk("fault chain: top stage lag (mm)", (2 * st.sMid - st.sTop) * 1000, -25, 0.01); ok("fault chain: slip sensor", st.sens.slip); }
  { const Pf = plan({ fault: "obstacle" }), st = stateAt(Pf, Pf[Pf.at].t1); chk("fault obstacle: tine tip (with chamfer piece) stops at |X| (m)", Math.abs(st.sTop) + FG.L / 2 + 0.027, 1.40, 0.002); }
  { const Pf = plan({ fault: "offset" }), st = stateAt(Pf, Pf[Pf.at].t1); ok("fault offset: overhang R (crate stood 60 mm towards the aisle in slot L)", st.sens.ovR && !st.sens.ovL); }
  { const Pf = plan({ fault: "notcentre" }), st = stateAt(Pf, Pf[Pf.at].t1); ok("fault notcentre: centre sensor OFF", !st.sens.centre, `s_top ${(st.sTop * 1000).toFixed(0)} mm`); }
  { const Pf = plan({ fault: "overload" }), st = stateAt(Pf, Pf[Pf.at].t1); ok("fault overload: crate back on the beams, fork centred", !st.crate.on && Math.abs(st.sTop) < 1e-9); }
  { const Pg = plan({ gentle: true }); log(`INFO gentle loaded moves (0.8 m/s, 0.8 m/s²): total ${Pg.T.toFixed(2)} s (+ ${(Pg.T - P.T).toFixed(2)} s)`); }
  // 3D
  const V = window.sr7View;
  if (V) {
    const c = V.counts();
    chk("3D chains", c.chains, 4, 0); chk("3D sprockets (1 per chain)", c.sprockets, 4, 0); chk("3D rollers", c.rollers, 16, 0);
    log(`INFO 3D meshes=${c.meshes} links=${c.links} staticCrates=${c.staticCrates} frames=${c.frames}`);
    const L0 = V.chainCheck(0, 0), L1 = V.chainCheck(0.675, 1.35), L2 = V.chainCheck(-0.675, -1.35);
    ok("chain length constant over the stroke (4 chains, 3 positions)", L0.every((l, i) => Math.abs(l - L1[i]) < 1e-9 && Math.abs(l - L2[i]) < 1e-9), `L = ${(L0[0] * 1000).toFixed(1)} mm (calc ${R.Lc.toFixed(1)})`);
    chk("chain length vs calc (mm)", L0[0] * 1000, R.Lc, 0.01);
    // followed link: still while on the lower strand
    V.follow(true); V.setState(Object.assign(stateAt(P, 0), { sMid: 0, sTop: 0 })); const a = V.linkAt();
    V.setState(Object.assign(stateAt(P, 0), { sMid: -0.05, sTop: -0.1 })); const b = V.linkAt();
    ok("followed link lies still on the lower strand", a.st === "lower" && b.st === "lower" && Math.abs(a.x - b.x) < 1e-9, `x ${a.x.toFixed(3)} → ${b.x.toFixed(3)}`);
    V.setState(Object.assign(stateAt(P, 0), { sMid: -0.6, sTop: -1.2 })); const c2 = V.linkAt();
    V.setState(Object.assign(stateAt(P, 0), { sMid: -0.65, sTop: -1.3 })); const d2 = V.linkAt();
    ok("followed link moves 2× the middle stage on the upper strand", c2.st === "upper" && Math.abs((d2.x - c2.x) + 0.1) < 1e-9, `Δx ${(d2.x - c2.x).toFixed(3)} m for Δs_mid −0.05`);
    V.follow(false);
    SIM.mode = "cycle"; SIM.t = P[2].t0 + 1.5; SIM.apply();
    for (const v of ["front", "top", "xray", "section", "iso"]) { V.setView(v, false); ok(`view ${v}`, V.S.view === v); }
    ["chain", "belt", "friction", "rack"].forEach((d) => { V.setDesign(d); ok(`design ${d}`, V.S.design === d); });
    V.forces(true, R); V.setState(stateAt(P, seg("lift1").t1 + 0.001)); ok("forces shown with the load at full stroke", V.S.R && V.S.R.F > 1.4 && V.S.R.R1f > 5.6, V.S.R ? `F ${V.S.R.F.toFixed(3)} kN, R1f ${V.S.R.R1f.toFixed(2)} kN` : "");
    V.forces(false);
    setTimeout(() => {
      const shot = V.snapshot(); const img = new Image(); img.onload = () => {
        const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80; const g = cv.getContext("2d"); g.drawImage(img, 0, 0, 120, 80);
        const d = g.getImageData(0, 0, 120, 80).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 232) + Math.abs(d[i + 1] - 236) + Math.abs(d[i + 2] - 240) > 40) n++;
        ok("3D snapshot not blank", n > 300, `${n} of 9600 pixels differ from the background`);
        const dbg = $("sr7Debug"); if (dbg) { const im = document.createElement("img"); im.src = shot; im.alt = "3D snapshot (test)"; im.className = "sr7-shot"; dbg.appendChild(im); }
        finish();
      }; img.src = shot;
    }, 600);
  } else { ok("3D view built", false); finish(); }
  function finish() {
    const card = $("srCard7"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card srCard7", !!card, `drawings ${imgs.length} loaded ${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings", imgs.length, 8, 0); chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, 8, 0);
      chk("step table rows", host.querySelectorAll("#sr7StepTbl tbody tr[data-sr7step]").length, SIM.P.length, 0);
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("sr7Debug"); if (d) { d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre); }
    }, 2500);
  }
}
function backTest() {
  const seq = ["6", "1", "7", "6", "7"], ctl = window.srCtl;
  const stepB = (i) => {
    if (i >= seq.length) { console.log(`SR7BACK DONE item7 built=${host.children.length > 0} canvases=${host.querySelectorAll("canvas").length} item6 built=${!!document.querySelector("#srItem6 canvas")} item1 canvas=${!!document.querySelector("#srItem1 canvas")} errors=${errs.length ? errs.join(" | ") : "none"}`); return; }
    if (ctl) ctl.showItem(seq[i]);
    setTimeout(() => { const h = $("srItem" + seq[i]); console.log(`SR7BACK item${seq[i]} visible=${h && !h.hidden} built=${h && h.children.length > 0} errors=${errs.length}`); stepB(i + 1); }, 3000);
  };
  stepB(0);
}

window.addEventListener("sritemshow", (e) => { if (String(e.detail) === "7") { build(); setTimeout(() => { if (V) V.resize(); if (SIM.apply) SIM.apply(); }, 0); } });
if (window.srCtl && window.srCtl.current() === "7" && window.srCtl.tabVisible()) build();
