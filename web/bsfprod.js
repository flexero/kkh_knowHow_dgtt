/* Ball screw + guide factory – item 1 "Products – ball screw, nut, profiled linear guide" (#bfItem1). Guide: docs/40_ballscrew_linear_guide_products.md
 * Files: bsfprod.js (UI, lazy build, calculators, selection, parts, card, self-check) · bsfprod_data.js (SHARED product data – items 2 – 8 import it) ·
 *   bsfprod_calc.js (formulas + CHECK1) · bsfprod_geo.js (thread profile, rail / block section) · bsfprod_3dcore.js · bsfprod_3dbs.js (ball screw 3D) ·
 *   bsfprod_3dlg.js (linear guide 3D) · bsfprod.css.
 * Lazy: built on window event "bfitemshow" (detail "1") or at load when item 1 of the visible tab is shown; Three.js is imported only then. Renders only when visible.
 * URL: /?bfitem=1#bsf · &bf1view=asm|cut|xray|exploded · &bf1nut=deflector|endcap|tube · &bf1pre=oversize|double · &bf1gview=asm|xray|cut|exploded ·
 *   &bf1arr=O|X · &bf1roll=ball|roller · &bf1play · &bf1calc=1…7 (calculator tab) · &bf1card=bs|lg|calc|sel|parts (scroll) · &bf1test (self-check, console "BF1TEST …" + #bf1Debug) ·
 *   &bf1hold (headless: keep the load event pending, show the tab) · card: &bf1tab=draw|buy|shop · &bf1box=N.
 * Offline. ALL VALUES ARE EXAMPLES – check the maker's catalogue.
 */
import { NOTE, BS, BN, LG, LB, NUT_TYPES, DN_LIMIT, PRELOAD_BS, ACC_BS, SUPPORT, PRELOAD_LG, ACC_LG, MOUNT_LG, MAT as MATS, BOM, FAMILY_BS, FAMILY_LG, FAMILY, PARTS, CARD1, codeBS, codeBN, codeLG, codeLB } from "./bsfprod_data.js";
import * as C from "./bsfprod_calc.js";
import { TH, shaftR, nutR, GD, railOutline, blockOutline } from "./bsfprod_geo.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const fv = (v, d) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return esc(v);
  if (d !== undefined) { const t = v.toFixed(d); const [a, b] = t.split("."); return sp(a) + (b ? "." + b : ""); }
  const a = Math.abs(v);
  return a >= 1e7 ? v.toExponential(2).replace("e+", " · 10^") : a >= 1000 ? sp(Math.round(v).toString()) : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toFixed(3);
};
const host = $("bfItem1");
const errs = [];
if (Q.has("bf1test")) {
  window.addEventListener("error", (e) => errs.push(e.message || String(e)));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
}
// test only (&bf1hold): a hidden iframe on the never-ending SSE stream keeps the load event pending (headless screenshots wait for --timeout), then shows the tab
if (Q.has("bf1hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf1hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("1"); }, 300); }

let built = false, VB = null, VG = null;
const ST = { bs: { rpm: 30, play: Q.has("bf1play") }, lg: { v: 40, play: Q.has("bf1play") } };

/* ------------------------------------------------------------------ small HTML helpers */
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf1-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const seg = (attr, items, cur) => `<span class="seg" role="group">${items.map(([k, t]) => `<button class="seg-btn${k === cur ? " active" : ""}" data-${attr}="${k}">${t}</button>`).join("")}</span>`;
const okb = (ok, t) => (ok === null || ok === undefined ? "" : `<span class="${ok ? "bf1-ok" : "bf1-nok"}">${t || (ok ? "OK" : "NOT OK")}</span>`);
function partInfo(k) {
  const p = PARTS[k]; if (!p) return "";
  return `<h3>${esc(p.n)}</h3><dl class="bf1-dl"><dt>Function</dt><dd>${esc(p.fn)}</dd><dt>Material</dt><dd>${esc(p.mat)}</dd><dt>Hardness</dt><dd>${esc(p.hrd)}</dd>
    <dt>Tolerance</dt><dd>${esc(p.tol)}</dd><dt>How it is made</dt><dd>${esc(p.made)}</dd><dt>How it fails</dt><dd>${esc(p.fail)}</dd></dl><p class="bf1-small">${esc(NOTE)}</p>`;
}

/* ------------------------------------------------------------------ build */
function build() {
  if (built || !host) return; built = true;
  const view0 = ["asm", "cut", "xray", "exploded"].includes(Q.get("bf1view")) ? Q.get("bf1view") : "asm";
  const gview0 = ["asm", "xray", "cut", "exploded"].includes(Q.get("bf1gview")) ? Q.get("bf1gview") : "asm";
  const nut0 = NUT_TYPES[Q.get("bf1nut")] ? Q.get("bf1nut") : "deflector", pre0 = Q.get("bf1pre") === "double" ? "double" : "oversize";
  const arr0 = Q.get("bf1arr") === "X" ? "X" : "O", roll0 = Q.get("bf1roll") === "roller" ? "roller" : "ball";
  host.innerHTML = `
  <div class="bf1-wrap">
    <div class="card" id="bf1BS">
      <div class="card-head"><h2>Ball screw + nut – 3D (${BS.code} + ${BN.code})</h2>
        <span class="bf1-ctl">${seg("bf1view", [["asm", "Assembled"], ["cut", "Cut-away"], ["xray", "X-ray"], ["exploded", "Exploded"]], view0)}</span></div>
      <div class="bf1-bar">
        <button class="btn primary" type="button" id="bf1Play">▶ Rotate the screw</button>
        <label class="bf1-lbl">screw speed <input type="range" id="bf1Rpm" min="5" max="300" step="5" value="${ST.bs.rpm}" aria-label="screw speed in the animation"> <b id="bf1RpmV">${ST.bs.rpm} rpm</b></label>
        <span class="bf1-sep"></span>
        <label class="bf1-lbl">ball return <select id="bf1Nut" aria-label="nut return system">${Object.entries(NUT_TYPES).map(([k, t]) => `<option value="${k}"${k === nut0 ? " selected" : ""}>${esc(t.n)}</option>`).join("")}</select></label>
        <label class="bf1-lbl">preload <select id="bf1Pre" aria-label="preload method"><option value="oversize"${pre0 === "oversize" ? " selected" : ""}>Ball oversize (single nut, P1)</option><option value="double"${pre0 === "double" ? " selected" : ""}>Double nut + spacer (P2)</option></select></label>
        <label class="bf1-chk"><input type="checkbox" id="bf1Lbl" checked> labels</label>
      </div>
      <div class="bf1-main">
        <div class="scene3d bf1-3d" id="bf13d"><div class="bf1-msg">3D view is loading …</div></div>
        <div class="bf1-info" id="bf1Info"></div>
      </div>
      <div class="bf1-design" id="bf1NutInfo"></div>
      <p class="hint">Mouse: left = turn, right = move, wheel = zoom, double-click = new orbit point. <b>Click a part</b> → function, material, hardness, tolerance, how it is made, how it fails.
        <b>Cut-away</b> removes the front half of the nut and the supports: you see the balls in the gothic-arch groove. <b>X-ray</b>: loaded balls grey, balls in the return path yellow.
        <b>Exploded</b>: the nut body lifts off, the balls stay on the screw. One screw turn moves the nut by one lead (10 mm). ${esc(NOTE)}</p>
      <h3 class="bf1-h">Key data (examples)</h3>
      ${tbl(["Item", "Value", "Item", "Value"], [
        ["Nominal Ø d0 / lead Ph", `${BS.d0} mm / ${BS.Ph} mm, ${BS.starts} start, ${BS.hand} hand`, "Ball Ø Dw / conformity f", `${BN.Dw} mm (1/4") / ${BN.f} (r = ${fv(TH.r, 2)} mm)`],
        ["Ball circle dpw / root dr / OD", `${BS.dpw} / ${BS.dr} / ${BS.dOut} mm`, "Contact angle / profile", `${BN.alphaDeg}° / gothic arch`],
        ["Lead angle λ", `${fv(C.efficiency().lam, 2)}°`, "Circuits", `${BN.circuits} × ${BN.turnsPerCircuit} turn (deflector)`],
        ["Ca / C0a", `${fv(BN.Ca / 1000, 1)} kN / ${fv(BN.C0a / 1000, 1)} kN`, "Preload P1", `${BN.preloadPct} % Ca = ${fv(BN.Fpr)} N (ball oversize)`],
        ["Length thread / total", `${BS.Lthread} / ${BS.Ltot} mm`, "Accuracy", `${BS.grade} – e_p ± 35 µm, v_up 25 µm over l_u ${ACC_BS.ourLu} mm`],
        ["Shaft material", esc(BS.material), "Nut material", esc(BN.material)],
        ["Shaft hardness", esc(BS.hardness), "Nut hardness", esc(BN.hardness)],
        ["Nut flange", `D1 ${BN.D1} g6, flange Ø${BN.D4} × ${BN.flangeT}, ${BN.bolts} on Ø${BN.boltCircle}, ${BN.flats}`, "DN limit (this nut)", `${fv(BN.DN)} (standard nuts ≈ 70 000)`],
      ], "bf1-kv4")}
    </div>

    <div class="card" id="bf1LG">
      <div class="card-head"><h2>Linear guide – 3D (${LG.code} + ${LB.code})</h2>
        <span class="bf1-ctl">${seg("bf1gview", [["asm", "Assembled"], ["xray", "X-ray"], ["cut", "Cut"], ["exploded", "Exploded"]], gview0)}</span></div>
      <div class="bf1-bar">
        <button class="btn primary" type="button" id="bf1GPlay">▶ Move the carriage</button>
        <label class="bf1-lbl">carriage speed <input type="range" id="bf1GV" min="5" max="200" step="5" value="${ST.lg.v}" aria-label="carriage speed"> <b id="bf1GVv">${ST.lg.v} mm/s</b></label>
        <span class="bf1-sep"></span>
        <span class="bf1-lbl">arrangement ${seg("bf1arr", [["O", "O (back-to-back)"], ["X", "X (face-to-face)"]], arr0)}</span>
        <label class="bf1-lbl">rolling element <select id="bf1Roll" aria-label="rolling element"><option value="ball"${roll0 === "ball" ? " selected" : ""}>Balls (our design)</option><option value="roller"${roll0 === "roller" ? " selected" : ""}>Rollers (alternative)</option></select></label>
        <label class="bf1-chk"><input type="checkbox" id="bf1GLbl" checked> labels</label>
      </div>
      <div class="bf1-main">
        <div class="scene3d bf1-3d" id="bf1G3d"><div class="bf1-msg">3D view is loading …</div></div>
        <div class="bf1-info" id="bf1GInfo"></div>
      </div>
      <div class="bf1-two">
        <div><h3 class="bf1-h">Section at the carriage centre – contact points (live)</h3><div class="bf1-svg" id="bf1Sec"></div></div>
        <div id="bf1ArrTxt"></div>
      </div>
      <p class="hint"><b>Cut</b> slices rail and carriage at the carriage centre (red lines = contact lines). <b>X-ray</b>: the 4 rows – loaded balls grey (under the steel body), return balls yellow
        (end caps + return holes). When the carriage moves, the loaded balls roll at <b>half</b> the carriage speed relative to the rail. ${esc(NOTE)}</p>
      <h3 class="bf1-h">Key data (examples)</h3>
      ${tbl(["Item", "Value", "Item", "Value"], [
        ["Rail W × H / length", `${LG.W} × ${LG.H} mm / ${LG.L} mm`, "Hole pitch / end distance", `${LG.pitch} mm / ${LG.E} mm → 17 holes, ${esc(LG.bolt)}, ${LG.torque} N·m`],
        ["Carriage W × L / H / H1", `${LB.Wb} × ${LB.Lb} mm / ${LB.Hasm} mm / ${LB.H1} mm`, "Raceways", `${LG.raceways} × ${LG.alphaDeg}°, ${esc(LG.arrangement)}, balls Ø${LB.Dw}`],
        ["C (50 km) / C0", `${fv(LB.C / 1000, 1)} kN / ${fv(LB.C0 / 1000, 1)} kN`, "C for 100 km basis", `${fv(LB.C100 / 1000, 1)} kN (= C50 / 1.26)`],
        ["M0R / M0P / M0Y", `${LB.M0R} / ${LB.M0P} / ${LB.M0Y} N·m`, "Preload / rigidity", `${LB.preload}; Z0 ${LB.K.Z0} · Z1 ${LB.K.Z1} · Z2 ${LB.K.Z2} N/µm`],
        ["Rail material", esc(LG.material), "Carriage material", esc(LB.material)],
        ["Rail hardness", esc(LG.hardness), "Carriage parts", esc(LB.parts)],
      ], "bf1-kv4")}
    </div>

    <div class="card" id="bf1Calc">
      <div class="card-head"><h2>Theory + calculators – live, check them by hand</h2><span class="sub">every result shows the formula with your numbers · ${esc(NOTE)}</span></div>
      <div class="bf1-ctabs" id="bf1CTabs"></div>
      <div id="bf1CBody"></div>
    </div>

    <div class="card" id="bf1Sel">
      <div class="card-head"><h2>Selection example – HMC / machining-centre X axis (end to end)</h2><span class="sub">change the inputs – all steps update · guide 40 §17</span></div>
      <div class="bf1-selgrid"><div class="bf1-inp" id="bf1SelIn"></div><div id="bf1SelOut"></div></div>
    </div>

    <div class="card" id="bf1Parts">
      <div class="card-head"><h2>Parts lists per product (make / buy) + product family</h2><span class="sub">feeds item 2 (manufacturing), item 6 (MES) and item 7 (ERP BOM) – data in web/bsfprod_data.js</span></div>
      <div class="bf1-ctabs" id="bf1PTabs"></div>
      <div id="bf1PBody"></div>
    </div>

    <div class="bf1-debug" id="bf1Debug" hidden></div>
  </div>`;

  /* ---------------- ball screw controls */
  const upd = (attr, v) => host.querySelectorAll(`[data-${attr}]`).forEach((b) => b.classList.toggle("active", b.dataset[attr.replace(/-([a-z])/g, (m, c) => c.toUpperCase())] === v));
  host.querySelectorAll("[data-bf1view]").forEach((b) => b.addEventListener("click", () => { upd("bf1view", b.dataset.bf1view); if (VB) VB.setView(b.dataset.bf1view); }));
  host.querySelectorAll("[data-bf1gview]").forEach((b) => b.addEventListener("click", () => { upd("bf1gview", b.dataset.bf1gview); if (VG) VG.setView(b.dataset.bf1gview); }));
  host.querySelectorAll("[data-bf1arr]").forEach((b) => b.addEventListener("click", () => { upd("bf1arr", b.dataset.bf1arr); if (VG) VG.setArr(b.dataset.bf1arr); secUpd(b.dataset.bf1arr); }));
  const playBtn = (id, on, t1, t0) => { $(id).textContent = on ? "❚❚ Pause" : t1; $(id).classList.toggle("primary", !on); };
  $("bf1Play").addEventListener("click", () => { ST.bs.play = !ST.bs.play; if (VB) VB.play(ST.bs.play); playBtn("bf1Play", ST.bs.play, "▶ Rotate the screw"); });
  $("bf1GPlay").addEventListener("click", () => { ST.lg.play = !ST.lg.play; if (VG) VG.play(ST.lg.play); playBtn("bf1GPlay", ST.lg.play, "▶ Move the carriage"); });
  $("bf1Rpm").addEventListener("input", (e) => { ST.bs.rpm = +e.target.value; $("bf1RpmV").textContent = ST.bs.rpm + " rpm"; if (VB) VB.setRpm(ST.bs.rpm); bsInfo(); });
  $("bf1GV").addEventListener("input", (e) => { ST.lg.v = +e.target.value; $("bf1GVv").textContent = ST.lg.v + " mm/s"; if (VG) VG.setSpeed(ST.lg.v); });
  $("bf1Nut").addEventListener("change", (e) => { if (VB) { VB.setNut(e.target.value); $("bf1Pre").value = VB.S.pre; } nutInfo(); bsInfo(); });
  $("bf1Pre").addEventListener("change", (e) => { if (VB) { VB.setPreload(e.target.value); $("bf1Nut").value = VB.S.nut; } nutInfo(); bsInfo(); });
  $("bf1Roll").addEventListener("change", (e) => { if (VG) VG.setRoll(e.target.value); arrTxt(); });
  $("bf1Lbl").addEventListener("change", (e) => { if (VB) VB.labels(e.target.checked); });
  $("bf1GLbl").addEventListener("change", (e) => { if (VG) VG.labels(e.target.checked); });
  if (ST.bs.play) playBtn("bf1Play", true, ""); if (ST.lg.play) playBtn("bf1GPlay", true, "");

  nutInfo(); bsInfo(); lgInfo(); secUpd(arr0); arrTxt();
  buildCalc(); buildSel(); buildParts();
  try { makeCard(CARD1, host.querySelector(".bf1-wrap"), { card: "bfCard1", q: "bfQ1", g: "bfG1", cnt: "bfCnt1", buy: "bfBuy1" }, "bf1"); } catch (e) { console.error(e); }
  const dbg = $("bf1Debug"); host.querySelector(".bf1-wrap").appendChild(dbg);      // debug box stays last
  const cardMap = { bs: "bf1BS", lg: "bf1LG", calc: "bf1Calc", sel: "bf1Sel", parts: "bf1Parts" };
  if (cardMap[Q.get("bf1card")]) setTimeout(() => $(cardMap[Q.get("bf1card")]).scrollIntoView({ block: "start" }), 900);

  /* ---------------- 3D (lazy import) */
  Promise.all([import("./bsfprod_3dbs.js"), import("./bsfprod_3dlg.js")]).then(([MB, MG]) => {
    const e1 = $("bf13d"); e1.querySelector(".bf1-msg").remove();
    VB = MB.createBS3D(e1, { onPick: (k) => { $("bf1Info").innerHTML = partInfo(k) + `<p><button class="btn ghost" type="button" id="bf1Back">back to the live data</button></p>`; $("bf1Back").onclick = () => { pickBS = null; bsInfo(); }; pickBS = k; },
      onState: () => { if (!pickBS) bsInfoThrottled(); } });
    window.bf1Screw = VB;
    VB.setRpm(ST.bs.rpm); if (pre0 === "double") VB.setPreload("double"); else if (nut0 !== "deflector") VB.setNut(nut0);
    VB.setView(view0, false); if (view0 !== "asm") VB.setView(view0, true);
    VB.play(ST.bs.play);
    const e2 = $("bf1G3d"); e2.querySelector(".bf1-msg").remove();
    VG = MG.createLG3D(e2, { onPick: (k) => { $("bf1GInfo").innerHTML = partInfo(k) + `<p><button class="btn ghost" type="button" id="bf1GBack">back to the live data</button></p>`; $("bf1GBack").onclick = () => { pickLG = null; lgInfo(); }; pickLG = k; },
      onState: () => { if (!pickLG) lgInfoThrottled(); } });
    window.bf1Guide = VG;
    VG.setSpeed(ST.lg.v); if (arr0 === "X") VG.setArr("X"); if (roll0 === "roller") VG.setRoll("roller");
    if (gview0 !== "asm") VG.setView(gview0, true);
    VG.play(ST.lg.play);
    nutInfo(); bsInfo(); lgInfo();
    if (Q.has("bf1test")) setTimeout(selfTest, 2500);
  }).catch((e) => { console.error(e); host.querySelectorAll(".bf1-msg").forEach((m) => { m.textContent = "3D view could not start: " + e.message; }); });
}
let pickBS = null, pickLG = null, tB = 0, tG = 0;
const bsInfoThrottled = () => { const t = performance.now(); if (t - tB > 120) { tB = t; bsInfo(); } };
const lgInfoThrottled = () => { const t = performance.now(); if (t - tG > 120) { tG = t; lgInfo(); } };

/* ------------------------------------------------------------------ live info panels */
function bsInfo() {
  if (pickBS) return;
  const S = VB ? VB.S : { theta: 0, s0: 50, nut: "deflector", pre: "oversize", circuits: 4, balls: 0 };
  const turns = S.theta / (2 * Math.PI), s = S.s0 - turns * BS.Ph, n = ST.bs.rpm;
  const g = BN.Dw * Math.cos(BN.alphaDeg * Math.PI / 180) / BS.dpw;
  $("bf1Info").innerHTML = `<h3>Live – what the screw does</h3>
    <table class="bf1-kv"><tbody>
      <tr><th>Screw turns θ / 2π</th><td>${fv(turns, 2)}</td></tr>
      <tr><th>Nut position s (from start 50 mm)</th><td>${fv(s, 1)} mm</td></tr>
      <tr><th>Travel = turns × lead</th><td>${fv(turns, 2)} × ${BS.Ph} = ${fv(turns * BS.Ph, 1)} mm</td></tr>
      <tr><th>Animation speed n</th><td>${n} rpm</td></tr>
      <tr><th>Feed v = n · Ph</th><td>${n} × ${BS.Ph} = ${fv(n * BS.Ph / 1000, 2)} m/min</td></tr>
      <tr><th>Machine rapid: 3 000 rpm</th><td>3 000 × 10 = 30 m/min</td></tr>
      <tr><th>Ball orbit speed (in the nut)</th><td>(1 − Dw·cosα/dpw)/2 = ${fv((1 - g) / 2, 3)} × n</td></tr>
      <tr><th>Circuits / balls (this nut)</th><td>${S.circuits} / ${S.balls}</td></tr>
    </tbody></table>
    <p class="bf1-small">Right-hand thread: the screw turns, the nut cannot turn (it is bolted to the table) → it must move along the axis by one lead per turn.
      The balls roll between the two grooves and move along the groove at about 0.43 × the screw speed; at the end of each turn (deflector) or after several turns (end cap / tube) they are lifted out and returned.</p>
    <p class="bf1-small"><b>Click any part</b> for its data.</p>`;
}
function nutInfo() {
  const S = VB ? VB.S : { nut: $("bf1Nut") ? $("bf1Nut").value : "deflector", pre: "oversize" };
  const t = NUT_TYPES[S.nut], pr = S.pre === "double" ? PRELOAD_BS.methods[1] : PRELOAD_BS.methods[0];
  $("bf1NutInfo").innerHTML = `<b>${esc(t.n)}</b> – ${esc(t.how)} DN limit ≈ ${fv(t.DN)} (example).<br><b>Preload: ${esc(pr[0])}</b> – ${esc(pr[1])}; ${esc(pr[2])}; ${esc(pr[3])}.
    ${S.pre === "double" ? " The double nut uses 2 × 2 deflector circuits; the spacer (gold) is ground to give the preload." : ""}`;
}
function lgInfo() {
  if (pickLG) return;
  const S = VG ? VG.S : { x: 0, rows: 4, balls: 0, arr: "O", roll: "ball" }, v = ST.lg.v;
  $("bf1GInfo").innerHTML = `<h3>Live – what the carriage does</h3>
    <table class="bf1-kv"><tbody>
      <tr><th>Carriage position x</th><td>${fv(S.x, 1)} mm</td></tr>
      <tr><th>Carriage speed v</th><td>${v} mm/s = ${fv(v * 0.06, 2)} m/min</td></tr>
      <tr><th>Loaded balls vs rail</th><td>v / 2 = ${fv(v / 2, 1)} mm/s</td></tr>
      <tr><th>Loaded balls vs carriage</th><td>− v / 2 = ${fv(-v / 2, 1)} mm/s</td></tr>
      <tr><th>Rows / balls in the carriage</th><td>${S.rows} / ${S.balls}</td></tr>
      <tr><th>Arrangement / element</th><td>${S.arr} / ${S.roll === "roller" ? "rollers" : "balls Ø" + LB.Dw}</td></tr>
      <tr><th>Steel body / total length</th><td>${GD.Ls} / ${GD.Lb} mm</td></tr>
    </tbody></table>
    <p class="bf1-small">A ball touches the rail and the carriage; it rolls without sliding, so its centre moves at half the carriage speed – like a cylinder under a plank.
      Under the steel body the balls carry the load; in the end caps and return holes they are free.</p><p class="bf1-small"><b>Click any part</b> for its data.</p>`;
}
function arrTxt() {
  const roll = $("bf1Roll") ? $("bf1Roll").value : "ball";
  $("bf1ArrTxt").innerHTML = `<h3 class="bf1-h">O- or X-arrangement?</h3>
    <p class="bf1-p">Each ball row touches rail and carriage at 2 points; the line through the 2 points is the <b>contact line</b> (45° here). The 4 rows give equal load capacity in all 4 directions (down, up, left, right).</p>
    <p class="bf1-p"><b>O-arrangement (back-to-back)</b> – the contact lines of the upper and lower row of one side meet <b>outside</b> the rail → large lever arm (≈ ${fv(2 * GD.arr.O.ip[0], 1)} mm) → high rigidity against the rolling moment M_R. Needs flat, parallel mounting surfaces. Our LG-25 / LB-25 is O.</p>
    <p class="bf1-p"><b>X-arrangement (face-to-face)</b> – the lines meet <b>inside</b> the rail → small lever arm (≈ ${fv(2 * GD.arr.X.ip[0], 1)} mm) → the block can tilt a little: it tolerates mounting errors (self-aligning), lower moment rigidity.</p>
    <p class="bf1-p"><b>Roller guide</b> ${roll === "roller" ? "(shown now)" : "(choose “Rollers”)"} – cylinders give line contact instead of point contact: about 2 × rigidity and 1.5 – 2 × load rating of the same size;
      life exponent 10/3 instead of 3; needs flatter mounting (edge load) and costs more. Used for heavy machining centres. The 3D model keeps the ball profile – real roller rails have flat 45° raceways.</p>`;
}
/* live section SVG (same outlines as the 3D) */
function secUpd(arr) {
  const A = GD.arr[arr], s = 7.2, cx = 300, by = 318, X = (x) => cx + x * s, Y = (y) => by - y * s;
  const path = (pts) => "M" + pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" L") + " Z";
  let g = `<path d="${path(blockOutline(arr))}" fill="url(#bf1h1)" stroke="#111" stroke-width="1.2"/><path d="${path(railOutline(arr))}" fill="url(#bf1h2)" stroke="#111" stroke-width="1.2"/>`;
  for (const sg of [1, -1]) A.balls.forEach((b) => {
    const x = sg * b[0], y = b[1], ix = sg * A.ip[0], iy = A.ip[1], dx = ix - x, dy = iy - y, d = Math.hypot(dx, dy);
    g += `<line x1="${X(x - dx / d * 4.5).toFixed(1)}" y1="${Y(y - dy / d * 4.5).toFixed(1)}" x2="${X(ix).toFixed(1)}" y2="${Y(iy).toFixed(1)}" stroke="#1f6fd1" stroke-width="1.6" stroke-dasharray="7,3"/>`;
    g += `<circle cx="${X(x).toFixed(1)}" cy="${Y(y).toFixed(1)}" r="${(GD.Dw / 2 * s).toFixed(1)}" fill="#dce8f8" stroke="#1f6fd1" stroke-width="1.4"/>`;
    for (const k of [-1, 1]) { const px = x + k * dx / d * GD.Dw / 2, py = y + k * dy / d * GD.Dw / 2; g += `<circle cx="${X(px).toFixed(1)}" cy="${Y(py).toFixed(1)}" r="2.6" fill="#d62828"/>`; }
  });
  for (const sg of [1, -1]) g += `<circle cx="${X(sg * A.ip[0]).toFixed(1)}" cy="${Y(A.ip[1]).toFixed(1)}" r="4.5" fill="#1f6fd1"/>`;
  const yd = arr === "O" ? Y(-2.5) : Y(-2.5);
  g += `<line x1="${X(-A.ip[0])}" y1="${yd}" x2="${X(A.ip[0])}" y2="${yd}" stroke="#1f6fd1" stroke-width="1.2" marker-start="url(#bf1a)" marker-end="url(#bf1a)"/>`;
  for (const sg of [1, -1]) g += `<line x1="${X(sg * A.ip[0])}" y1="${Y(A.ip[1])}" x2="${X(sg * A.ip[0])}" y2="${yd + 4}" stroke="#1f6fd1" stroke-width="0.8" stroke-dasharray="3,3"/>`;
  $("bf1Sec").innerHTML = `<svg viewBox="0 0 600 392" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="section of rail and carriage with contact lines">
    <defs><pattern id="bf1h1" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#fff"/><line x1="0" y1="0" x2="0" y2="7" stroke="#999" stroke-width="1"/></pattern>
      <pattern id="bf1h2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="5" height="5" fill="#f4f4f4"/><line x1="0" y1="0" x2="0" y2="5" stroke="#777" stroke-width="0.8"/></pattern>
      <marker id="bf1a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 Z" fill="#1f6fd1"/></marker></defs>
    <rect width="600" height="392" fill="#fff"/>
    <text x="12" y="22" font-size="13" font-weight="bold" fill="#111">${arr}-arrangement – size 25, 4 rows at 45°, balls Ø${GD.Dw}</text>
    ${g}
    <text x="${X(0)}" y="${Y(9)}" font-size="12" text-anchor="middle" fill="#111">rail ${GD.W} × ${GD.H}</text>
    <text x="${X(0)}" y="${Y(31)}" font-size="12" text-anchor="middle" fill="#111">carriage (flange) ${GD.Wb} wide, H ${GD.Hasm}</text>
    <text x="${X(0)}" y="${yd + 18}" font-size="12" text-anchor="middle" fill="#1f6fd1" font-weight="bold">lever arm ≈ ${fv(2 * A.ip[0], 1)} mm (contact lines meet ${arr === "O" ? "outside" : "inside"} the rail)</text>
    <text x="12" y="384" font-size="11" fill="#555">red dots = contact points · blue dashed = contact lines · EXAMPLE – check the maker's catalogue</text></svg>`;
}

/* ------------------------------------------------------------------ calculators */
const E = BS.E;
const CALC = [
  { id: "c1", t: "Screw: speed, torque, efficiency", inp: [["Ph", "lead Ph", "mm", 10], ["v", "speed v", "m/min", 30], ["F", "axial force F", "N", 4069], ["dpw", "ball circle dpw", "mm", 33], ["mu", "friction μ (rolling)", "–", 0.003], ["eta", "design efficiency η", "–", 0.9], ["etaB", "back-drive efficiency η'", "–", 0.8]],
    run: (v) => {
      const n = C.speed(v.v, v.Ph), ef = C.efficiency(v.Ph, v.dpw, v.mu), T = C.torqueDrive(v.F, v.Ph, v.eta), Tb = C.torqueBack(v.F, v.Ph, v.etaB), P = T * 2 * Math.PI * n / 60;
      return [
        ["Screw speed", `n = v·1000 / Ph = ${v.v}·1000 / ${v.Ph}`, fv(n), "rpm"],
        ["Feed check", `v = n · Ph / 1000 = ${fv(n)} · ${v.Ph} / 1000`, fv(C.feed(n, v.Ph), 2), "m/min"],
        ["Lead angle", `λ = atan(Ph / (π·dpw)) = atan(${v.Ph} / (π·${v.dpw}))`, fv(ef.lam, 3), "°"],
        ["Efficiency (theory)", `η = tan λ / tan(λ + ρ), ρ = atan μ = ${fv(Math.atan(v.mu) * 180 / Math.PI, 3)}°`, fv(ef.eta, 3), "–"],
        ["Back-drive efficiency (theory)", `η' = tan(λ − ρ) / tan λ`, fv(ef.etaB, 3), "–", null, "catalogues use 0.9 / 0.8 for design"],
        ["Drive torque", `T = F·Ph / (2π·η) = ${v.F}·${v.Ph / 1000} / (2π·${v.eta})`, fv(T, 3), "N·m"],
        ["Back-driving torque", `T' = F·Ph·η' / (2π) = ${v.F}·${v.Ph / 1000}·${v.etaB} / (2π)`, fv(Tb, 3), "N·m", null, "> 0: the load turns the screw → vertical axes need a motor brake"],
        ["Drive power at n", `P = T · 2π·n / 60`, fv(P), "W"],
      ];
    } },
  { id: "c2", t: "Screw: load cycle, mean load, life", inp: [["Ca", "dynamic rating Ca", "N", BN.Ca], ["C0a", "static rating C0a", "N", BN.C0a], ["fw", "load factor fw", "–", 1.2], ["Fpr", "preload Fpr", "N", BN.Fpr], ["req", "required life", "h", 20000]],
    cycle: [["rapid", 69.4, 3000, 20], ["accel", 1869.4, 1500, 5], ["decel", 1730.6, 1500, 5], ["cut", 4069.4, 100, 50], ["idle", 0, 0, 20]],
    run: (v) => {
      const ph = [1, 2, 3, 4, 5].map((i) => ({ F: v["F" + i], n: v["n" + i], t: v["t" + i] / 100 }));
      const m = C.meanLoad(ph, v.Fpr), L = C.lifeBS(v.Ca, m.Fm, v.fw, m.nm, BS.Ph), Lp = C.lifeBS(v.Ca, m.FmP, v.fw, m.nm, BS.Ph), Fmax = Math.max(...ph.map((p) => Math.abs(p.F)));
      return [
        ["Mean speed", `n_m = Σ n_i·t_i = ${ph.map((p) => `${p.n}·${p.t}`).join(" + ")}`, fv(m.nm), "rpm"],
        ["Mean load", `F_m = (Σ F_i³·n_i·t_i / n_m)^(1/3)`, fv(m.Fm), "N"],
        ["Mean load with preload", `F_i,eff = Fpr·(1 + F_i/(2.83·Fpr))^1.5 if F_i ≤ 2.83·Fpr = ${fv(2.83 * v.Fpr)} N`, fv(m.FmP), "N"],
        ["Life (revolutions)", `L10 = (Ca / (fw·F_m))³ · 10⁶ = (${v.Ca} / (${v.fw}·${fv(m.Fm)}))³ · 10⁶`, fv(L.L), "rev"],
        ["Life (hours)", `L_h = L10 / (60 · n_m)`, fv(L.Lh), "h", L.Lh >= v.req],
        ["Life with preload", `same with F_m,eff`, fv(Lp.Lh), "h", Lp.Lh >= v.req],
        ["Travel life", `L_km = L10 · Ph / 10⁶`, fv(L.Lkm), "km"],
        ["Preload kept?", `F_max = ${fv(Fmax)} N vs 2.83 · Fpr = ${fv(2.83 * v.Fpr)} N`, Fmax <= 2.83 * v.Fpr ? "yes" : "no", "", Fmax <= 2.83 * v.Fpr, Fmax <= 2.83 * v.Fpr ? "" : "one side of the nut is unloaded during this phase – OK for a short cut, use P2 for heavy cutting"],
        ["Static safety", `f_s = C0a / F_max = ${v.C0a} / ${fv(Fmax)}`, fv(v.C0a / Fmax, 2), "–", v.C0a / Fmax >= 2.5, "≥ 2 – 3 normal, ≥ 3 with impact (example)"],
      ];
    } },
  { id: "c3", t: "Screw: buckling, critical speed, DN", inp: [["dr", "root Ø dr", "mm", BS.dr], ["L", "span / free length L", "mm", 900], ["mount", "mounting", "", "fs", Object.entries(SUPPORT.mounts).map(([k, m]) => [k, m.n])], ["F", "max. compressive force", "N", 4069], ["n", "max. speed", "rpm", 3000], ["dpw", "ball circle dpw", "mm", BS.dpw], ["DN", "nut DN limit", "mm·rpm", BN.DN]],
    run: (v) => {
      const Mt = SUPPORT.mounts[v.mount], b = C.buckling(v.dr, v.L, v.mount), c = C.critSpeed(v.dr, v.L, v.mount), nD = C.dnSpeed(v.DN, v.dpw), nA = Math.min(c.nc, nD);
      return [
        ["Mounting factors", `${Mt.n}: η2 = ${Mt.eta2}, λ = ${fv(Mt.lam, 3)}, f = ${Mt.nc}, Euler m = ${Mt.euler}`, "", ""],
        ["Permissible buckling load", `F_k = η2 · dr⁴ / L² · 10⁴ = ${Mt.eta2} · ${v.dr}⁴ / ${v.L}² · 10⁴`, fv(b.Fk), "N", b.Fk >= v.F, "η2 includes safety 0.5"],
        ["Euler check (full)", `F = m·π²·E·I / L², I = π·dr⁴/64 = ${fv(b.I)} mm⁴`, fv(b.Feuler), "N", null, `0.5 · F = ${fv(b.Feuler / 2)} N`],
        ["Buckling safety", `F_k / F = ${fv(b.Fk)} / ${v.F}`, fv(b.Fk / v.F, 1), "–", b.Fk >= v.F],
        ["Critical speed (catalogue)", `n_c = f · dr / L² · 10⁷ = ${Mt.nc} · ${v.dr} / ${v.L}² · 10⁷`, fv(c.nc), "rpm", null, "f includes 0.8"],
        ["Critical speed (exact)", `n = 60·λ² / (2π·L²) · √(E·I / (ρ·A)) = ${fv(c.exact)} · 0.8`, fv(c.exact08), "rpm"],
        ["DN speed limit", `n_DN = DN / dpw = ${v.DN} / ${v.dpw}`, fv(nD), "rpm"],
        ["Allowed speed", `min(n_c, n_DN)`, fv(nA), "rpm", v.n <= nA, `your max. ${v.n} rpm · DN at max. = ${fv(v.dpw * v.n)}`],
      ];
    } },
  { id: "c4", t: "Screw: rigidity, lost motion, preload torque", inp: [["dr", "root Ø dr", "mm", BS.dr], ["La", "fixed bearing → nut a", "mm", 700], ["mount", "axial mounting", "", "fs", [["fs", "fixed – supported (or free)"], ["ff", "fixed – fixed"]]], ["L", "bearing span L", "mm", 900], ["KnCat", "nut rigidity at 10 % Ca (catalogue)", "N/µm", BN.KnCat], ["pct", "preload", "% Ca", BN.preloadPct], ["Kb", "support bearing rigidity", "N/µm", SUPPORT.fixed.Kb], ["F", "axial force", "N", 4069], ["Ff", "friction force (reversal)", "N", 69.4], ["Ph", "lead", "mm", BS.Ph]],
    run: (v) => {
      const Fpr = v.pct / 100 * BN.Ca, Kn = C.nutRigidity(v.KnCat, Fpr, BN.Ca), r = C.rigidity({ dr: v.dr, La: v.La, Kn, Kb: v.Kb, F: v.F, Ff: v.Ff, mount: v.mount, L: v.L }), Tp = C.preloadTorque(Fpr, v.Ph, BS.dpw);
      return [
        ["Root area", `A = π·dr²/4 = π·${v.dr}²/4`, fv(r.A, 1), "mm²"],
        ["Shaft rigidity", v.mount === "ff" ? `K_s = A·E·L / (4·a·(L − a)) = ${fv(r.A, 1)}·${E}·${v.L} / (4·${v.La}·${v.L - v.La}) / 1000` : `K_s = A·E / a = ${fv(r.A, 1)}·${E} / ${v.La} / 1000`, fv(r.Ks, 1), "N/µm"],
        ["Preload", `Fpr = ${v.pct} % · Ca = ${v.pct / 100} · ${BN.Ca}`, fv(Fpr), "N"],
        ["Nut rigidity", `K_n = K_cat · (Fpr / (0.1·Ca))^(1/3) = ${v.KnCat} · (${fv(Fpr)} / ${0.1 * BN.Ca})^(1/3)`, fv(Kn), "N/µm"],
        ["Total axial rigidity", `1/K = 1/K_s + 1/K_n + 1/K_b = 1/${fv(r.Ks, 1)} + 1/${fv(Kn)} + 1/${v.Kb}`, fv(r.K, 1), "N/µm"],
        ["Elastic deflection", `δ = F / K = ${v.F} / ${fv(r.K, 1)}`, fv(r.defl, 1), "µm"],
        ["Lost motion at reversal", `Δ = 2·F_f / K = 2·${v.Ff} / ${fv(r.K, 1)} (+ backlash 0, preloaded)`, fv(r.lost, 2), "µm"],
        ["Preload drag torque", `T_p = 0.05·(tan λ)^−0.5 · Fpr·Ph / (2π)`, fv(Tp, 3), "N·m", null, "catalogue ± 30 % band"],
        ["Preload disappears at", `F = 2.83 · Fpr`, fv(2.83 * Fpr), "N"],
      ];
    } },
  { id: "c5", t: "Screw: thermal growth, accuracy grade, error budget", inp: [["dT", "temperature rise ΔT", "K", 3], ["Lt", "thread length", "mm", BS.Lthread], ["dr", "root Ø dr", "mm", BS.dr], ["grade", "accuracy grade", "", "C5", [["C1", "C1"], ["C3", "C3"], ["C5", "C5"], ["C7", "C7"]]], ["lu", "useful travel l_u", "mm", ACC_BS.ourLu], ["F", "cutting force", "N", 4069], ["K", "axial rigidity K", "N/µm", 110.7], ["Ff", "friction force", "N", 69.4]],
    run: (v) => {
      const t = C.thermal(v.dT, v.Lt, v.dr), a = C.accuracyBS(v.grade, v.lu), ep = a.ep ?? a.v300 * v.lu / 300;
      const items = [ep, t.dL, v.F / v.K, 2 * v.Ff / v.K], sum = items.reduce((x, y) => x + y, 0), rss = Math.sqrt(items.reduce((x, y) => x + y * y, 0));
      return [
        ["Thermal elongation", `ΔL = α·ΔT·L = 11.8·10⁻⁶ · ${v.dT} · ${v.Lt} · 1000`, fv(t.dL, 1), "µm"],
        ["Pre-tension to absorb it", `F = α·ΔT·E·A = 11.8·10⁻⁶·${v.dT}·${E}·${fv(Math.PI * v.dr * v.dr / 4, 1)}`, fv(t.Fpre), "N", null, `target T ≈ −${fv(t.dL, 0)} µm over ${v.Lt} mm, fixed – fixed`],
        ["Travel deviation e_p", a.ep ? `${v.grade}, l_u ${v.lu} mm (bin ${a.bin[0]} – ${a.bin[1]})` : `${v.grade}: only v_300 is specified → ${a.v300} µm · ${v.lu}/300`, "± " + fv(ep, 0), "µm"],
        ["Travel variation v_up", a.vup ? `${v.grade}, same bin` : "–", a.vup ?? "–", "µm"],
        ["Variation in 300 mm / one turn", `v_300 / v_2π`, `${a.v300 ?? "–"} / ${a.v2pi ?? "–"}`, "µm"],
        ["Error budget items", `e_p ${fv(ep, 0)} + thermal ${fv(t.dL, 1)} + elastic F/K ${fv(v.F / v.K, 1)} + lost motion ${fv(2 * v.Ff / v.K, 2)}`, "", "µm"],
        ["Worst case (sum)", `Σ`, fv(sum, 1), "µm"],
        ["Statistical (RSS)", `√(Σ e_i²)`, fv(rss, 1), "µm", null, "linear scale + pitch compensation remove most of e_p and thermal"],
      ];
    } },
  { id: "c6", t: "Guide: equivalent load, life, static safety", inp: [["C", "dynamic rating C (50 km)", "N", LB.C], ["C0", "static rating C0", "N", LB.C0], ["M0R", "M0R", "N·m", LB.M0R], ["M0P", "M0P", "N·m", LB.M0P], ["M0Y", "M0Y", "N·m", LB.M0Y], ["Fr", "radial load F_r", "N", 2000], ["Fl", "lateral load F_l", "N", 500], ["MR", "rolling moment M_R", "N·m", 20], ["MP", "pitching moment M_P", "N·m", 15], ["MY", "yawing moment M_Y", "N·m", 10], ["fc", "contact factor fc", "–", 1], ["fw", "load factor fw", "–", 1.2], ["vm", "mean speed", "m/min", 8], ["el", "rolling element", "", "ball", [["ball", "ball (p = 3)"], ["roller", "roller (p = 10/3, 100 km)"]]]],
    run: (v) => {
      const P = C.eqLoad(v), ball = v.el === "ball", L = C.lifeLG({ C: v.C, P, fc: v.fc, fw: v.fw, vm: v.vm, ball }), fs = v.C0 / P;
      return [
        ["Moment → load", `C0·(M_R/M0R + M_P/M0P + M_Y/M0Y) = ${v.C0}·(${v.MR}/${v.M0R} + ${v.MP}/${v.M0P} + ${v.MY}/${v.M0Y})`, fv(P - Math.abs(v.Fr) - Math.abs(v.Fl)), "N"],
        ["Equivalent load", `P = |F_r| + |F_l| + C0·ΣM/M0 = ${v.Fr} + ${v.Fl} + …`, fv(P), "N"],
        ["Life", `L = (fh·ft·fc·C / (fw·P))^${ball ? "3" : "10/3"} · ${ball ? 50 : 100} km = (${v.fc}·${v.C} / (${v.fw}·${fv(P)}))^p · ${ball ? 50 : 100}`, fv(L.L), "km"],
        ["Life in hours", `L_h = L·10³ / (v_m · 60) = ${fv(L.L)}·10³ / (${v.vm}·60)`, fv(L.Lh), "h", L.Lh >= 20000, "machine tools ≥ 20 000 h (example)"],
        ["Static safety", `f_s = C0 / P0 = ${v.C0} / ${fv(P)}`, fv(fs, 2), "–", fs >= 3, "1 – 2 normal, 2 – 3 vibration, ≥ 3 machine tools (example)"],
        ["Same block, 100 km basis", `C100 = C50 / 2^(1/3) = ${v.C} / 1.26`, fv(v.C / Math.cbrt(2)), "N", null, "never mix 50 km and 100 km values"],
        ["fw guide (THK style)", "smooth, v ≤ 15 m/min: 1.0 – 1.2 · normal 15 – 60 m/min: 1.2 – 1.5 · impact, > 60 m/min: 1.5 – 3.0", "", ""],
      ];
    } },
  { id: "c7", t: "Guide: preload, accuracy class, mounting tolerances", inp: [["cls", "accuracy class", "", "H", ACC_LG.cls.map((c) => [c[0], c[0]])], ["Lr", "rail length", "mm", LG.L], ["z", "preload class", "", "Z1", [["Z0", "Z0"], ["Z1", "Z1"], ["Z2", "Z2"]]], ["a", "rail spacing a", "mm", 500], ["b", "block spacing b", "mm", 400], ["C", "dynamic rating C", "N", LB.C]],
    run: (v) => {
      let i = ACC_LG.len.findIndex((l) => v.Lr <= l); if (i < 0) i = ACC_LG.len.length - 1;
      const par = ACC_LG.par[v.cls][i], row = ACC_LG.cls.find((c) => c[0] === v.cls), m = C.mountTol(v.a, v.b, v.z), pf = { Z0: 0, Z1: 0.02, Z2: 0.08 }[v.z];
      return [
        ["Running parallelism", `class ${v.cls}, rail ≤ ${ACC_LG.len[i]} mm`, par, "µm"],
        ["Height H / width tolerance", `class ${v.cls}`, `${row[1]} / ${row[2]}`, "mm"],
        ["Variation ΔH / ΔW (blocks)", `class ${v.cls}`, `${row[3]} / ${row[4]}`, "mm"],
        ["Preload force", `${v.z}: ${pf} · C = ${pf} · ${v.C}`, fv(pf * v.C), "N"],
        ["Radial rigidity per block", `catalogue example`, LB.K[v.z], "N/µm"],
        ["Permissible rail parallelism P1", `${v.z}, size 25`, m.P1, "µm"],
        ["Permissible level error S1", `S1 = K1 · a = ${MOUNT_LG.K1[v.z]} · ${v.a}`, fv(m.S1, 3), "mm"],
        ["Permissible level error S2", `S2 = K2 · b = ${MOUNT_LG.K2} · ${v.b}`, fv(m.S2, 4), "mm"],
        ["Shoulders", `rail ≤ ${MOUNT_LG.shoulder.rail} mm, block ≤ ${MOUNT_LG.shoulder.block} mm, corner r ≤ ${MOUNT_LG.shoulder.r} mm`, "", ""],
      ];
    } },
];
const calcV = {};
function inpHtml(gid, d) {
  const [k, l, u, def, opt] = d, id = `bf1i_${gid}_${k}`;
  const ctl = opt ? `<select id="${id}" data-k="${k}">${opt.map(([o, t]) => `<option value="${o}"${o === def ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>` : `<input id="${id}" data-k="${k}" type="number" step="any" value="${def}">`;
  return `<label for="${id}"><span>${esc(l)}</span>${ctl}<em>${esc(u)}</em></label>`;
}
function buildCalc() {
  const tabs = $("bf1CTabs"), body = $("bf1CBody");
  tabs.innerHTML = CALC.map((g, i) => `<button class="seg-btn${i ? "" : " active"}" data-bf1c="${i}">${i + 1}. ${esc(g.t)}</button>`).join("");
  body.innerHTML = CALC.map((g, i) => `<div class="bf1-cgrp" data-bf1cg="${i}"${i ? " hidden" : ""}>
    <div class="bf1-cgrid"><div class="bf1-inp">${g.inp.map((d) => inpHtml(g.id, d)).join("")}
      ${g.cycle ? `<h4>Load cycle (phase: force N, speed rpm, time %)</h4><table class="bf1-cyc"><thead><tr><th>phase</th><th>F</th><th>n</th><th>t %</th></tr></thead><tbody>${g.cycle.map((c, j) => `<tr><td>${c[0]}</td>${[["F", c[1]], ["n", c[2]], ["t", c[3]]].map(([k, val]) => `<td><input type="number" step="any" data-k="${k}${j + 1}" value="${val}" aria-label="${k} ${c[0]}"></td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}</div>
      <div class="bf1-cout" id="bf1Out_${g.id}"></div></div>
    ${g.id === "c5" ? `<h4 class="bf1-h">ISO 3408-3 / JIS B 1192 – positioning screws (example table values – check the standard)</h4>${accTable()}` : ""}
    ${g.id === "c7" ? `<div class="bf1-two"><div><h4 class="bf1-h">Running parallelism vs rail length (µm, example)</h4><div class="bf1-svg">${parChart()}</div></div><div><h4 class="bf1-h">Preload classes</h4>${tbl(["Class", "Preload", "Force", "Use"], PRELOAD_LG.map((r) => r.map(esc)))}<h4 class="bf1-h">Accuracy classes size 25 (mm)</h4>${tbl(["Class", "Height H", "Width W", "ΔH", "ΔW"], ACC_LG.cls.map((r) => r.map(esc)))}</div></div>` : ""}
    ${g.id === "c3" ? `<h4 class="bf1-h">DN limits (examples)</h4>${tbl(["Nut type", "DN = dpw · n_max"], DN_LIMIT.map((r) => r.map(esc)))}` : ""}
    ${g.id === "c4" ? `<h4 class="bf1-h">Preload methods + classes</h4>${tbl(["Method", "How", "Class", "Pros / cons"], PRELOAD_BS.methods.map((r) => r.map(esc)))}${tbl(["Class", "Preload", "Typical use"], PRELOAD_BS.classes.map((r) => r.map(esc)))}` : ""}
  </div>`).join("");
  tabs.querySelectorAll("[data-bf1c]").forEach((b) => b.addEventListener("click", () => showCalc(+b.dataset.bf1c)));
  CALC.forEach((g, i) => { const box = body.querySelector(`[data-bf1cg="${i}"]`); box.querySelectorAll("[data-k]").forEach((el) => el.addEventListener("input", () => runCalc(i))); runCalc(i); });
  const c0 = +Q.get("bf1calc"); if (c0 >= 1 && c0 <= CALC.length) showCalc(c0 - 1);
}
function showCalc(i) {
  $("bf1CTabs").querySelectorAll("[data-bf1c]").forEach((b) => b.classList.toggle("active", +b.dataset.bf1c === i));
  $("bf1CBody").querySelectorAll("[data-bf1cg]").forEach((g) => { g.hidden = +g.dataset.bf1cg !== i; });
}
function runCalc(i) {
  const g = CALC[i], box = $("bf1CBody").querySelector(`[data-bf1cg="${i}"]`), v = {};
  box.querySelectorAll("[data-k]").forEach((el) => { v[el.dataset.k] = el.tagName === "SELECT" ? el.value : +el.value; });
  let rows; try { rows = g.run(v); } catch (e) { rows = [["Error", esc(e.message), "", ""]]; }
  calcV[g.id] = { v, rows };
  $("bf1Out_" + g.id).innerHTML = `<table class="bf1-tbl bf1-res"><thead><tr><th>Result</th><th>Formula with your numbers</th><th>Value</th><th>Unit</th></tr></thead><tbody>${
    rows.map(([l, f, val, u, ok, note]) => `<tr><td>${esc(l)}</td><td class="bf1-f">${esc(f)}${note ? `<br><span class="bf1-small">${esc(note)}</span>` : ""}</td><td class="bf1-v">${val === "" ? "" : esc(String(val))} ${okb(ok)}</td><td>${esc(u)}</td></tr>`).join("")}</tbody></table>`;
}
function accTable() {
  const head = ["Useful travel up to (mm)", ...ACC_BS.bins.map(String)];
  const rows = [];
  for (const g of ["C1", "C3", "C5"]) { rows.push([`${g} e_p ±`, ...ACC_BS.ep[g]]); rows.push([`${g} v_up`, ...ACC_BS.vup[g]]); }
  return tbl(head, rows) + tbl(["Grade", ...Object.keys(ACC_BS.v300)], [["v_300 (µm)", ...Object.values(ACC_BS.v300)], ["v_2π (µm)", ...Object.keys(ACC_BS.v300).map((k) => ACC_BS.v2pi[k] ?? "–")]]) +
    tbl(["Grade", "Typical use"], ACC_BS.use.map((r) => r.map(esc)));
}
function parChart() {
  const W = 560, H = 300, x0 = 50, y0 = 260, xs = (L) => x0 + L / 4000 * 480, ys = (p) => y0 - p / 40 * 230, col = { N: "#111", H: "#1f6fd1", P: "#111", SP: "#1f6fd1", UP: "#111" }, dash = { N: "", H: "", P: "6,3", SP: "6,3", UP: "2,3" };
  let g = `<rect width="${W}" height="${H}" fill="#fff"/>`;
  for (let p = 0; p <= 40; p += 10) g += `<line x1="${x0}" y1="${ys(p)}" x2="${xs(4000)}" y2="${ys(p)}" stroke="#ddd"/><text x="${x0 - 6}" y="${ys(p) + 4}" font-size="11" text-anchor="end">${p}</text>`;
  for (let L = 0; L <= 4000; L += 1000) g += `<line x1="${xs(L)}" y1="${y0}" x2="${xs(L)}" y2="${ys(40)}" stroke="#eee"/><text x="${xs(L)}" y="${y0 + 16}" font-size="11" text-anchor="middle">${L}</text>`;
  for (const c of Object.keys(ACC_LG.par)) {
    let d = ""; ACC_LG.len.forEach((L, i) => { const p = ACC_LG.par[c][i], xa = xs(i ? ACC_LG.len[i - 1] : 0); d += `${i ? "L" : "M"}${xa.toFixed(1)},${ys(p).toFixed(1)} L${xs(L).toFixed(1)},${ys(p).toFixed(1)} `; });
    g += `<path d="${d}" fill="none" stroke="${col[c]}" stroke-width="1.6" stroke-dasharray="${dash[c]}"/><text x="${xs(4000) + 6}" y="${ys(ACC_LG.par[c][12]) + 4}" font-size="11" fill="${col[c]}">${c}</text>`;
  }
  g += `<line x1="${xs(1000)}" y1="${y0}" x2="${xs(1000)}" y2="${ys(40)}" stroke="#d62828" stroke-dasharray="4,3"/><text x="${xs(1000) + 4}" y="${ys(38)}" font-size="11" fill="#d62828">LG-25-1000</text>`;
  g += `<text x="${x0}" y="16" font-size="11">µm</text><text x="${xs(4000)}" y="${y0 + 32}" font-size="11" text-anchor="end">rail length (mm)</text><text x="${x0}" y="${H - 4}" font-size="11" fill="#555">EXAMPLE – check the maker's catalogue</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="running parallelism chart">${g}</svg>`;
}

/* ------------------------------------------------------------------ selection example */
const SEL_IN = [["m", "moving mass (table + pallet + work)", "kg"], ["vr", "rapid traverse", "m/min"], ["a", "acceleration", "m/s²"], ["Fc", "axial cutting force F_x", "N"], ["FL", "lateral cutting force F_L", "N"], ["h", "height of the cutting force over the guides", "mm"],
  ["hg", "height of the centre of mass", "mm"], ["aR", "rail spacing a", "mm"], ["bB", "block spacing b", "mm"], ["Lb", "screw bearing span L", "mm"], ["La", "fixed bearing → nut (worst)", "mm"], ["Jm", "motor rotor inertia J_m", "kg·m²"], ["lifeReq", "required life", "h"]];
function buildSel() {
  $("bf1SelIn").innerHTML = `<h4>Inputs (examples)</h4>${SEL_IN.map(([k, l, u]) => `<label><span>${esc(l)}</span><input type="number" step="any" data-sk="${k}" value="${C.SEL_DEF[k]}"><em>${esc(u)}</em></label>`).join("")}
    <p class="bf1-small">Fixed: screw ${BS.code} (dr ${BS.dr}, Ca ${BN.Ca / 1000} kN, C0a ${BN.C0a / 1000} kN, preload ${BN.Fpr} N), fixed – supported, fw 1.2; guide 2 rails × 2 blocks LB-25 (C ${LB.C / 1000} kN, C0 ${LB.C0 / 1000} kN), fw 1.5;
      duty: rapid 20 %, accel 5 %, decel 5 %, cutting 50 % at 1 m/min, idle 20 %; μ guide 0.005 + seals 40 N; η 0.9; bearings 0.2 N·m.</p>`;
  $("bf1SelIn").querySelectorAll("[data-sk]").forEach((el) => el.addEventListener("input", runSel));
  runSel();
}
let selR = null;
function runSel() {
  const inp = {}; $("bf1SelIn").querySelectorAll("[data-sk]").forEach((el) => { inp[el.dataset.sk] = +el.value; });
  const R = C.selection(inp), S = R.S; selR = R;
  const rows = [
    ["1", "Screw speed at rapid", `n = v / Ph = ${S.vr}·1000 / ${S.Ph}`, `${fv(R.nR)} rpm`, null],
    ["2", "DN value", `DN = dpw · n = ${BS.dpw} · ${fv(R.nR)}`, fv(R.DN), R.DN <= BN.DN, `standard nut ≤ 70 000 → ${R.DN <= 70000 ? "OK" : "NOT OK"}; our high-speed nut ≤ ${fv(BN.DN)}`],
    ["3", "Axial forces", `F_f = μ·m·g + seals = ${fv(R.Ff, 1)} N · accel m·a + F_f = ${fv(R.Facc)} N · decel ${fv(R.Fdec)} N · cutting F_x + F_f = ${fv(R.Fcut)} N`, `max ${fv(Math.max(R.Fcut, R.Facc))} N`, null],
    ["4", "Load cycle", `n_m = Σ n_i·t_i; F_m = (Σ F³·n·t / n_m)^(1/3)`, `n_m ${fv(R.nm)} rpm, F_m ${fv(R.Fm)} N (with preload ${fv(R.FmP)} N)`, null],
    ["5", "Screw life", `L10 = (Ca / (fw·F_m))³·10⁶ = (${BN.Ca} / (${S.fw}·${fv(R.Fm)}))³·10⁶ = ${fv(R.L10)} rev`, `${fv(R.L10h)} h (preload: ${fv(R.L10ph)} h)`, R.L10ph >= S.lifeReq, `required ${fv(S.lifeReq)} h`],
    ["6", "Screw static safety", `C0a / F_max = ${BN.C0a} / ${fv(Math.max(R.Fcut, R.Facc))}`, fv(R.fsBS, 1), R.fsBS >= 2.5, "≥ 2.5 (example)"],
    ["7", "Buckling", `F_k = 10 · dr⁴ / L² · 10⁴ (fixed – supported, L ${S.Lb})`, `${fv(R.Fk)} N = ${fv(R.Fk / Math.max(R.Fcut, R.Facc), 1)} × F_max`, R.Fk >= Math.max(R.Fcut, R.Facc), ""],
    ["8", "Critical speed + DN speed", `n_c = 15.1 · dr / L² · 10⁷ = ${fv(R.nc)} rpm; n_DN = ${fv(BN.DN)} / ${BS.dpw} = ${fv(R.nDN)} rpm`, `allowed ${fv(R.nAllow)} rpm`, R.nR <= R.nAllow, `need ${fv(R.nR)} rpm`],
    ["9", "Motor torque", `cutting T = F·Ph/(2π·η) + T_p + T_b = ${fv(R.Tcut, 2)} + ${fv(R.Tp, 2)} + ${S.Tb}; peak = (J_load + J_m)·α + T_f + T_p + T_b, α = 2π·a/Ph = ${fv(R.alpha)} rad/s²`, `cut ${fv(R.TcutTot, 2)} N·m, peak ${fv(R.Tpeak, 2)} N·m`, null, `choose rated ≥ ${fv(R.TcutTot * 1.1, 1)} N·m (RMS check!), peak ≥ ${fv(R.Tpeak * 1.3, 1)} N·m`],
    ["10", "Inertia", `J_screw ${fv(R.Js * 1e4, 2)} + J_table m·(Ph/2π)² ${fv(R.Jt * 1e4, 2)} + J_coupling ${fv(R.Jc * 1e4, 2)} = ${fv(R.Jl * 1e4, 2)} kg·cm²`, `ratio J_load / J_m = ${fv(R.Jratio, 2)}`, R.Jratio <= 3, "≤ 3 – 5 for a stiff servo axis"],
    ["11", "Axial rigidity", `1/K = 1/K_s + 1/K_n + 1/K_b = 1/${fv(R.Ks)} + 1/${fv(R.Kn)} + 1/${SUPPORT.fixed.Kb}`, `K ${fv(R.K)} N/µm, δ = ${fv(R.defl, 1)} µm under F_x`, null, "a linear scale (closed loop) or fixed – fixed reduces the effect"],
    ["12", "Guide block loads (worst block)", `m·g/4 ${fv(R.Pw)} + F_L·h/(2a) ${fv(R.dPlat)} + F_x·h/(2b) ${fv(R.dPax)} + lateral F_L/4 ${fv(R.Flat)}`, `P_cut ${fv(R.Pcut)} N, P_acc ${fv(R.Pacc)} N`, null],
    ["13", "Guide mean load + life", `P_m = (Σ P³·d / Σd)^(1/3), v_m ${fv(R.vm, 1)} m/min; L = (C/(fw·P_m))³·50 = (${LB.C}/(${S.fwg}·${fv(R.Pm)}))³·50`, `${fv(R.Lg)} km = ${fv(R.Lgh)} h`, R.Lgh >= S.lifeReq, ""],
    ["14", "Guide static safety", `C0 / P_max = ${LB.C0} / ${fv(R.Pcut)}`, fv(R.fsLG, 1), R.fsLG >= 3, "≥ 3 for machine tools (example)"],
  ];
  const allOk = rows.every((r) => r[4] !== false);
  $("bf1SelOut").innerHTML = `<table class="bf1-tbl bf1-res bf1-sel"><thead><tr><th>#</th><th>Step</th><th>Formula with the numbers</th><th>Result</th><th>Check</th></tr></thead><tbody>${
    rows.map(([n, s, f, r, ok, note]) => `<tr><td>${n}</td><td>${esc(s)}</td><td class="bf1-f">${esc(f)}${note ? `<br><span class="bf1-small">${esc(note)}</span>` : ""}</td><td class="bf1-v">${esc(r)}</td><td>${okb(ok)}</td></tr>`).join("")}</tbody></table>
    <h4 class="bf1-h">Why lead 10? – the same axis with lead 10 / 16 / 20</h4>
    ${tbl(["Lead", "n at rapid (rpm)", "DN", "cutting torque (N·m)", "peak torque (N·m)", "J_table (kg·cm²)", "travel per encoder count (20 bit)"], R.leads.map((l) => [l.Ph + " mm", fv(l.n), fv(l.DN), fv(l.Tcut, 2), fv(l.Tpeak, 2), fv(l.Jt * 1e4, 2), fv(l.res * 1000, 2) + " nm"]))}
    <p class="bf1-p"><b>Result ${allOk ? "(all checks OK)" : "(some checks NOT OK – change the inputs or the screw)"}:</b> Ø32 × 10 needs 3 000 rpm at 30 m/min → DN 99 000: a <b>standard nut is not allowed</b> (≈ 70 000) – choose the
      high-speed internal-deflector nut (DN ≤ 120 000, example) or lead 16 / 20. Lead 10 keeps the cutting torque low (7.2 vs 14.4 N·m), gives finer resolution and the smallest reflected inertia;
      lead 20 halves the speed but doubles the torque. Life, buckling and critical speed have large margins. The cutting force (${fv(R.Fcut)} N) is above 2.83·Fpr = ${fv(2.83 * BN.Fpr)} N: the P1 preload opens during heavy cuts – for heavy cutting choose P2 (double nut) or a Ø40 screw.
      Guide size 25 has ${fv(R.Lgh / 1000, 0)} 000 h life and static safety ${fv(R.fsLG, 1)} – OK. ${esc(NOTE)}</p>`;
}

/* ------------------------------------------------------------------ parts + family */
function buildParts() {
  const keys = Object.keys(BOM), tabs = [...keys, "family", "materials"];
  const lbl = { family: "Product family + codes", materials: "Materials + heat treatment" };
  $("bf1PTabs").innerHTML = tabs.map((k, i) => `<button class="seg-btn${i ? "" : " active"}" data-bf1p="${k}">${esc(lbl[k] || k)}</button>`).join("");
  const bom = (k) => {
    const rows = BOM[k];
    const nMake = rows.filter((r) => /MAKE/.test(r[3])).length;
    return `<p class="bf1-p"><b>${esc(k)}</b> – ${rows.length} positions, ${nMake} made in-house (MAKE), ${rows.length - nMake} bought (BUY). The “operations” column is the start point for item 2 (manufacturing).</p>` +
      tbl(["Pos", "Part", "Qty", "Make / buy", "Material", "Heat treatment / finish", "Main operations / note"], rows.map((r) => [r[0], esc(r[1]), r[2], `<span class="${/MAKE/.test(r[3]) ? "bf1-make" : "bf1-buy"}">${esc(r[3])}</span>`, esc(r[4]), esc(r[5]), esc(r[6])]), "bf1-bom");
  };
  const fam = () => `<p class="bf1-p">Codes: <code>${codeBS(32, 10, 1000, "C5")}</code> = ball screw Ø32, lead 10, length 1 000, grade C5 · <code>${codeBN(32, 10)}</code> flanged nut (<code>${codeBN(32, 10, "FLD")}</code> double nut) ·
      <code>${codeLG(25, 1000)}</code> rail size 25 × 1 000 · <code>${codeLB(25)}</code> flange block (<code>${codeLB(25, "NA")}</code> narrow). Range: screws Ø ${FAMILY.bs.d.join(" / ")}, leads ${FAMILY.bs.Ph.join(" / ")}, ${FAMILY.bs.len.join(" – ")} mm, grades ${FAMILY.bs.grades.join(" / ")};
      guides size ${FAMILY.lg.size.join(" / ")}, rails ${FAMILY.lg.len.join(" – ")} mm, blocks ${FAMILY.lg.blocks.join(" / ")}, preload ${FAMILY.lg.preload.join(" / ")}.</p>
    <h4 class="bf1-h">Ball screw sizes (catalogue-class examples)</h4>${tbl(["d0", "Ph", "ball Ø", "circuits × turns", "Ca kN", "C0a kN", "code (1 000, C5)"], FAMILY_BS.map((r) => [...r.map(String), `<code>${codeBS(r[0], r[1], 1000, "C5")}</code>`]))}
    <h4 class="bf1-h">Guide sizes (catalogue-class examples, C for 50 km)</h4>${tbl(["size", "rail W", "rail H", "block W", "C kN", "C0 kN", "M0R kN·m", "M0P kN·m", "M0Y kN·m", "ball Ø", "code"], FAMILY_LG.map((r) => [...r.map(String), `<code>${codeLG(r[0], 1000)} / ${codeLB(r[0])}</code>`]))}
    <p class="bf1-small">${esc(NOTE)}</p>`;
  const mats = () => tbl(["Part", "Material", "Heat treatment", "Note"], MATS.map((r) => r.map(esc)));
  $("bf1PBody").innerHTML = tabs.map((k, i) => `<div data-bf1pg="${k}"${i ? " hidden" : ""}>${k === "family" ? fam() : k === "materials" ? mats() : bom(k)}</div>`).join("");
  $("bf1PTabs").querySelectorAll("[data-bf1p]").forEach((b) => b.addEventListener("click", () => {
    $("bf1PTabs").querySelectorAll("[data-bf1p]").forEach((x) => x.classList.toggle("active", x === b));
    $("bf1PBody").querySelectorAll("[data-bf1pg]").forEach((g) => { g.hidden = g.dataset.bf1pg !== b.dataset.bf1p; });
  }));
}

/* ------------------------------------------------------------------ self-check (&bf1test) */
function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("BF1TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const ok = Math.abs(got - exp) <= tol; ok ? pass++ : fail++; log(`${ok ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(6)} (hand ${exp} ± ${Number(tol).toPrecision(3)})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const R = C.selection({});
  for (const [k, e] of Object.entries(C.CHECK1)) chk("selection " + k, k === "lam" ? C.efficiency().lam : R[k], e, Math.max(Math.abs(e) * 0.002, 1e-6));
  const X = C.CHECK1X, t3 = C.thermal(3, 850);
  chk("thermal ΔL 3 K / 850 mm (µm)", t3.dL, X.dL3, 0.05); chk("pre-tension (N)", t3.Fpre, X.Fpre3, 5);
  chk("guide P_eq with moments (N)", C.eqLoad({ Fr: 2000, Fl: 500, MR: 20, MP: 15, MY: 10 }), X.Peq, 0.5); chk("C100 (N)", LB.C / Math.cbrt(2), X.C100, 1);
  chk("S1 Z1 a 500 (mm)", C.mountTol(500, 400, "Z1").S1, X.S1Z1, 1e-9); chk("S2 b 400 (mm)", C.mountTol(500, 400).S2, X.S2, 1e-9);
  chk("efficiency theory", C.efficiency().eta, X.etaTh, 0.0005); chk("back-drive torque 1 kN (N·m)", C.torqueBack(1000, 10), X.Tback1k, 0.001);
  const a5 = C.accuracyBS("C5", 700), bud = [a5.ep, t3.dL, R.defl, R.lost];
  chk("C5 e_p at l_u 700 (µm)", a5.ep, 35, 0); chk("C5 v_up at l_u 700 (µm)", a5.vup, 25, 0); chk("C3 e_p at 850", C.accuracyBS("C3", 850).ep, 21, 0);
  chk("error budget sum (µm)", bud.reduce((x, y) => x + y, 0), X.budgetSum, 0.05); chk("error budget RSS (µm)", Math.sqrt(bud.reduce((x, y) => x + y * y, 0)), X.budgetRss, 0.05);
  // geometry
  chk("gothic arch: root Ø from the profile (mm)", 2 * shaftR(0), 26.5438, 0.001); chk("groove radius r = 0.53·Dw", TH.r, 3.3655, 1e-4);
  chk("groove half width at the OD (mm)", (() => { let x = 0; while (shaftR(x) < TH.ro - 1e-9 && x < 5) x += 0.0005; return x; })(), 3.1124, 0.002);
  chk("nut groove bottom radius (mm)", nutR(0), TH.Rb - TH.c + Math.sqrt(TH.r * TH.r - TH.c * TH.c), 1e-9);
  ok("rail outline closed + 4 notches", railOutline("O").length > 100 && railOutline("O").some(([x, y]) => Math.hypot(x - 13.5, y - 12.5) < GD.rg + 1e-6));
  ok("block outline has 4 notches", [[9, 23.5], [-9, 23.5], [13.5, 12.5], [-13.5, 12.5]].every(([cx, cy]) => blockOutline("O").some(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - GD.rg) < 1e-6)));
  // calculators + selection rendered
  chk("calculator groups", $("bf1CBody").querySelectorAll("[data-bf1cg]").length, 7, 0);
  ok("calculators produce numbers", CALC.every((g) => calcV[g.id] && calcV[g.id].rows.length >= 5 && !calcV[g.id].rows.some((r) => r[0] === "Error")));
  chk("calc 1: drive torque 4 069 N (N·m)", parseFloat(calcV.c1.rows[5][2]), 7.196, 0.001);
  chk("calc 3: buckling F_k (N)", parseFloat(calcV.c3.rows[1][2].replace(/ /g, "")), 59970, 1);
  chk("selection table rows", $("bf1SelOut").querySelectorAll("tbody tr").length, 14 + 3, 0);
  chk("parts tabs (4 products + family + materials)", $("bf1PTabs").querySelectorAll("[data-bf1p]").length, 6, 0);
  const VBs = window.bf1Screw, VGs = window.bf1Guide;
  if (VBs && VGs) {
    let c = VBs.counts(); chk("screw: circuits (deflector)", c.circuits, 4, 0); ok("screw: balls per circuit 14 – 17", c.perCircuit.every((n) => n >= 14 && n <= 17), c.perCircuit.join("/"));
    const z0 = VBs.nutZ(); VBs.rotate(2 * Math.PI); chk("screw: nut travel for 1 turn (mm)", VBs.nutZ() - z0, -10, 1e-6); VBs.rotate(-2 * Math.PI);
    chk("screw: ball orbit factor (1 − Dw·cos45°/dpw)/2", VBs.travelCheck(1).ballOrbit, 0.431968, 1e-5);
    chk("screw: shaft radius at the groove centre = root", VBs.sampleRadius(5, 0).shaft, 13.2719, 0.001);
    VBs.setNut("endcap"); c = VBs.counts(); chk("screw: end cap circuits", c.circuits, 1, 0); log(`INFO end cap balls ${c.balls}, loop ${c.loops[0]} mm`);
    VBs.setNut("tube"); c = VBs.counts(); chk("screw: tube circuits", c.circuits, 2, 0); log(`INFO tube balls ${c.balls}`);
    VBs.setPreload("double"); c = VBs.counts(); chk("screw: double nut circuits", c.circuits, 4, 0); ok("screw: double nut forces the deflector type", VBs.S.nut === "deflector");
    VBs.setPreload("oversize");
    for (const v of ["cut", "xray", "exploded", "asm"]) { VBs.setView(v, false); ok(`screw view ${v}`, VBs.S.view === v); }
    let g = VGs.counts(); chk("guide: ball rows", g.rows, 4, 0); chk("guide: rail holes (pitch 60, E 20)", g.holes, 17, 0); ok("guide: balls per row 26 – 31", g.perRow.every((n) => n >= 26 && n <= 31), g.perRow.join("/"));
    const s0 = VGs.sigma(); VGs.setPos(100); chk("guide: balls move v/2 relative to the carriage", VGs.sigma() - s0, -50, 1e-9); VGs.setPos(0);
    VGs.setArr("X"); ok("guide: X arrangement", VGs.S.arr === "X"); VGs.setArr("O");
    VGs.setRoll("roller"); ok("guide: rollers", VGs.counts().balls > 0 && VGs.S.roll === "roller"); VGs.setRoll("ball");
    for (const v of ["xray", "cut", "exploded", "asm"]) { VGs.setView(v, false); ok(`guide view ${v}`, VGs.S.view === v); }
    setTimeout(() => {
      const shots = [["screw", VBs], ["guide", VGs]].map(([n, V]) => [n, V.snapshot()]);
      let k = 0;
      shots.forEach(([n, url]) => {
        const img = new Image(); img.onload = () => {
          const cv = document.createElement("canvas"); cv.width = 120; cv.height = 80; const g2 = cv.getContext("2d"); g2.drawImage(img, 0, 0, 120, 80);
          const d = g2.getImageData(0, 0, 120, 80).data; let m = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - 232) + Math.abs(d[i + 1] - 236) + Math.abs(d[i + 2] - 240) > 40) m++;
          ok(`3D snapshot ${n} not blank`, m > 300, `${m} of 9600 pixels differ from the background`);
          const dbg = $("bf1Debug"); const im = document.createElement("img"); im.src = url; im.alt = "3D snapshot " + n + " (test)"; im.className = "bf1-shot"; dbg.appendChild(im);
          if (++k === 2) finish();
        }; img.src = url;
      });
    }, 800);
  } else { ok("3D views built", false); finish(); }
  function finish() {
    const card = $("bfCard1"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card bfCard1", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings", imgs.length, 13, 0); chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, 13, 0);
      ok("card is after the parts card", card && card.previousElementSibling && card.previousElementSibling.id === "bf1Parts");
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("bf1Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre);
    }, 2500);
  }
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "1") { build(); setTimeout(() => { if (VB) VB.resize(); if (VG) VG.resize(); }, 0); } });
if (window.bfCtl && window.bfCtl.current() === "1" && window.bfCtl.tabVisible()) build();
