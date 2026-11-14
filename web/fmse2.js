/* FMS engineering – item 2: product → process → machines (all domains).  Loaded by fmse.js (build "2").
 * 2A part families (production flow analysis: rank order clustering + similarity clustering)
 * 2B process capability (ISO 286 IT grade + Ra) and joining processes
 * 2C cycle-time estimators (turning, milling, drilling, robot welding, laser cutting, assembly) + power check
 * 2D capacity → number of machines, takt, bottleneck (presets for 4 domains, editable)
 * 2E machine selection checklist + weighted scoring.   Guide: docs/FMS system design/62_product_process_machines.md */
import { PFA, PROC, JOIN, MATS, CAP, CHECK, CRIT, CANDS } from "./fmse2_data.js";
import { EX2 } from "./fmse2x_data.js";   // ISO 286-1 IT table (copy of tools/fmse/examples/item2_examples.json)

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const clone = (o) => JSON.parse(JSON.stringify(o));
const Q = new URLSearchParams(location.search);

export function mount(el) {
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>2A · Part families – which parts belong together? (production flow analysis)</h2>
      <span class="sub">click a cell to change the matrix · the method finds machine cells and part families automatically</span></div>
    <div class="fe-row"><button class="mx-el" id="fe2Roc">1 · Rank order clustering (sort)</button>
      <label>2 · Similarity threshold T <input type="range" id="fe2T" min="0" max="1" step="0.05" value="0.3"> <b id="fe2Tv"></b></label>
      <button class="mx-el" id="fe2Shuf">Mix rows / columns</button><button class="mx-el" id="fe2Rst">Example matrix</button></div>
    <div class="grid2"><div class="fe-scroll" id="fe2Mat"></div><div id="fe2Res"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>2B · Process selection – which process reaches the tolerance and the surface?</h2>
      <span class="sub">ISO 286 IT grades · Ra in µm · typical economic ranges</span></div>
    <div class="fe-row"><label>Nominal size D <input type="number" id="fe2D" value="52" min="1" max="3150"> mm</label>
      <label>Tolerance width <input type="number" id="fe2Tol" value="30" min="1" max="10000"> µm</label>
      <label>Ra required ≤ <input type="number" id="fe2Ra" value="0.8" min="0.01" max="50" step="0.05"> µm</label>
      <label>Feature (last operation) <select id="fe2Feat"><option value="bore">bore in a housing (machining centre)</option><option value="bore_rot">bore in a rotational part</option><option value="shaft">shaft / outer diameter</option><option value="face">flat face</option></select></label>
      <label>Domain <select id="fe2Dom"><option value="">all</option><option>Primary</option><option>Machining</option><option>Sheet metal</option></select></label></div>
    <div id="fe2ITres"></div>
    <div class="fe-scroll"><svg id="fe2IT" class="fe-chart" viewBox="0 0 900 560" role="img" aria-label="IT grade ranges of the processes"></svg></div>
    <details class="fe-qg"><summary><b>Joining, assembly and test processes</b> <span class="sub">assembly + welding domains – what is checked</span></summary>
      <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Process</th><th>How it works</th><th>Quality signal (to MES)</th><th>Typical cycle</th><th>Module</th></tr></thead>
      <tbody>${JOIN.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>
  </div>

  <div class="card"><div class="card-head"><h2>2C · Cycle-time estimators – first numbers before any supplier quote</h2>
      <span class="sub">formulas shown with your numbers · ± 20–30 % accuracy · the supplier's time study replaces them later</span></div>
    <div class="mx-nav" id="fe2Calc">${[["turn", "Turning"], ["mill", "Milling"], ["drill", "Drilling"], ["weld", "Robot welding"], ["laser", "Laser cutting"], ["asm", "Assembly station"]].map(([k, n], i) => `<button class="mx-el${i ? "" : " active"}" data-calc="${k}">${n}</button>`).join("")}</div>
    <div class="grid2"><div id="fe2CIn"></div><div id="fe2COut"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>2D · Capacity → how many machines? takt time? bottleneck?</h2>
      <span class="sub">quick model with 4 domain presets · the full worked example with the calendar and the shared data is in 2J below</span></div>
    <div class="fe-row"><label>Example <select id="fe2Pre">${Object.entries(CAP).map(([k, p]) => `<option value="${k}">${esc(p.n)}</option>`).join("")}</select></label>
      <label>Volume growth / reserve (optional) <input type="number" id="fe2Gr" value="0" min="-50" max="300"> %</label>
      <button class="mx-el" id="fe2Reset">Reset example</button></div>
    <div class="fe-scroll" id="fe2Tab"></div>
    <div class="grid2"><div id="fe2Bars"></div><div id="fe2CapRes"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>2E · Machine selection – checklist and weighted scoring</h2>
      <span class="sub">use the same matrix for any supplier choice (machines, robots, AGVs, software)</span></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">10 checks before you ask for a quotation</h3>
        <table class="am-kv"><tbody>${CHECK.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
      <div><h3 class="fe-h3">Weighted scoring (scores 1 = poor … 5 = excellent)</h3><div class="fe-scroll" id="fe2Score"></div><div id="fe2ScoreRes"></div></div></div>
  </div>`;

  initPFA(); initProc(); initCalc(); initCap(); initScore();
  // 2F–2M: deep sections (guides + programs) live in fmse2x.js
  const deepEl = document.createElement("div"); deepEl.id = "feItem2x"; el.appendChild(deepEl);
  import("./fmse2x.js").then((m) => m.mount(deepEl)).catch((e) => { deepEl.innerHTML = `<div class="card"><p class="fe-no">Sections 2F–2M could not load: ${esc(e.message)}</p></div>`; });
}

/* ================================================================== 2A production flow analysis */
const P = { m: clone(PFA.m), rows: PFA.parts.map((_, i) => i), cols: PFA.machines.map((_, j) => j), T: 0.3 };
function initPFA() {
  $("fe2T").addEventListener("input", () => { P.T = +$("fe2T").value; drawPFA(); });
  $("fe2Roc").addEventListener("click", () => { roc(); drawPFA(); });
  $("fe2Shuf").addEventListener("click", () => { shuffle(P.rows); shuffle(P.cols); drawPFA(); });
  $("fe2Rst").addEventListener("click", () => { P.m = clone(PFA.m); P.rows = PFA.parts.map((_, i) => i); P.cols = PFA.machines.map((_, j) => j); drawPFA(); });
  $("fe2Mat").addEventListener("click", (e) => { const c = e.target.closest("[data-i]"); if (!c) return; const i = +c.dataset.i, j = +c.dataset.j; P.m[i][j] = P.m[i][j] ? 0 : 1; drawPFA(); });
  drawPFA();
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }
// King's rank order clustering: read each row as a binary number (columns in current order), sort; then the same for columns; repeat
function roc() {
  for (let it = 0; it < 12; it++) {
    const before = P.rows.join() + "|" + P.cols.join();
    const rw = (i) => P.cols.reduce((s, j, k) => s + P.m[i][j] * 2 ** (P.cols.length - 1 - k), 0);
    P.rows.sort((a, b) => rw(b) - rw(a));
    const cw = (j) => P.rows.reduce((s, i, k) => s + P.m[i][j] * 2 ** (P.rows.length - 1 - k), 0);
    P.cols.sort((a, b) => cw(b) - cw(a));
    if (P.rows.join() + "|" + P.cols.join() === before) break;
  }
}
// similarity (Jaccard) between machines + single linkage at threshold T → machine cells; parts to the cell with most operations
function cells() {
  const M = PFA.machines.length, N = PFA.parts.length, m = P.m;
  const sim = (j, k) => { let a = 0, b = 0; for (let i = 0; i < N; i++) { if (m[i][j] && m[i][k]) a++; else if (m[i][j] || m[i][k]) b++; } return a + b ? a / (a + b) : 0; };
  const par = [...Array(M).keys()], find = (x) => (par[x] === x ? x : (par[x] = find(par[x])));
  for (let j = 0; j < M; j++) for (let k = j + 1; k < M; k++) if (sim(j, k) >= P.T && sim(j, k) > 0) par[find(j)] = find(k);
  const roots = [...new Set([...Array(M).keys()].map(find))];
  const mc = [...Array(M).keys()].map((j) => roots.indexOf(find(j)));
  const pc = m.map((row) => { const cnt = roots.map((_, c) => row.reduce((s, v, j) => s + (v && mc[j] === c ? 1 : 0), 0)); const best = Math.max(...cnt); return best ? cnt.indexOf(best) : -1; });
  let e = 0, out = 0, voids = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { if (m[i][j]) { e++; if (mc[j] !== pc[i]) out++; } else if (mc[j] === pc[i]) voids++; }
  let maxSim = 0; for (let j = 0; j < M; j++) for (let k = j + 1; k < M; k++) maxSim = Math.max(maxSim, sim(j, k));
  return { mc, pc, k: roots.length, e, out, voids, eff: e ? (e - out) / (e + voids) : 0, sim };
}
function drawPFA() {
  $("fe2Tv").textContent = P.T.toFixed(2);
  const C = cells();
  // order: by cell, keeping the current (ROC) order inside a cell
  const rows = [...P.rows].sort((a, b) => (C.pc[a] - C.pc[b]) || (P.rows.indexOf(a) - P.rows.indexOf(b)));
  const cols = [...P.cols].sort((a, b) => (C.mc[a] - C.mc[b]) || (P.cols.indexOf(a) - P.cols.indexOf(b)));
  $("fe2Mat").innerHTML = `<table class="fe-mat"><thead><tr><th></th>${cols.map((j) => `<th class="fe-k${C.mc[j] % 6 + 1}"><span>${esc(PFA.machines[j])}</span></th>`).join("")}</tr></thead>
    <tbody>${rows.map((i) => `<tr><th class="fe-k${(C.pc[i] < 0 ? 0 : C.pc[i] % 6 + 1)}">${esc(PFA.parts[i])}</th>${cols.map((j) => {
      const v = P.m[i][j], inCell = C.mc[j] === C.pc[i];
      return `<td data-i="${i}" data-j="${j}" class="${inCell ? "fe-in fe-b" + (C.pc[i] % 6 + 1) : ""}${v && !inCell ? " fe-exc" : ""}">${v ? "1" : ""}</td>`;
    }).join("")}</tr>`).join("")}</tbody></table>
    <p class="sub">Coloured blocks = machine cells with their part families. <b>Red 1</b> = exceptional element (the part needs a machine of another cell). Empty cell inside a block = void.</p>`;
  const exc = [];
  for (let i = 0; i < PFA.parts.length; i++) for (let j = 0; j < PFA.machines.length; j++) if (P.m[i][j] && C.mc[j] !== C.pc[i]) exc.push(`${PFA.parts[i]} → ${PFA.machines[j]}`);
  $("fe2Res").innerHTML = `<table class="am-kv"><tbody>
      <tr><td>Cells found</td><td><b>${C.k}</b> at T = ${P.T.toFixed(2)}</td></tr>
      <tr><td>Operations (1s) e</td><td>${C.e}</td></tr><tr><td>Exceptional elements</td><td>${C.out}</td></tr><tr><td>Voids</td><td>${C.voids}</td></tr>
      <tr><td>Grouping efficacy Γ</td><td><b>${f1(C.eff * 100, 1)} %</b> <span class="sub">= (e − exceptional) ÷ (e + voids) = (${C.e} − ${C.out}) ÷ (${C.e} + ${C.voids})</span></td></tr></tbody></table>
    ${exc.length ? `<h4>What to do with each exceptional element</h4><ul class="am-ul">${exc.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <p class="sub">Options: (1) buy a second machine of that type for the cell (if load is high), (2) accept an inter-cell move (transport + waiting),
      (3) change the part design or the process so it is not needed, (4) buy that operation outside.</p>` : `<p class="fe-ok">No exceptional elements – the cells are independent.</p>`}
    <p class="am-note"><b>Method:</b> (1) Rank order clustering (King 1980) reads every row as a binary number and sorts rows and columns until nothing changes
      – blocks appear on the diagonal. (2) Machine similarity s<sub>jk</sub> = parts using both ÷ parts using at least one (Jaccard); machines with
      s ≥ T are joined (single linkage). Higher T → more, smaller cells, more exceptional elements. Good result: Γ ≥ 70–80 %.</p>`;
}

/* ================================================================== 2B process capability */
/* IT grade from the ISO 286-1 table (EX2.it_table_um = copy of tools/fmse/examples/item2_examples.json, grades IT5…IT13, D ≤ 500 mm).
 * Size range: lower < D ≤ upper; D ≤ 3 → first range. Required grade = largest k with IT_k ≤ tolerance width. */
const ITT = EX2.it_table_um;
function itRange(D) {
  const r = ITT.ranges_mm.findIndex(([lo, hi]) => D > lo && D <= hi);
  return r >= 0 ? r : D <= ITT.ranges_mm[0][1] ? 0 : ITT.ranges_mm.length - 1;
}
function itValue(g, D) {   // µm from the table; NaN outside IT5…IT13
  const k = ITT.grades.indexOf(g);
  return k < 0 ? NaN : ITT.values[itRange(D)][k];
}
function initProc() {
  ["fe2D", "fe2Tol", "fe2Ra", "fe2Dom", "fe2Feat"].forEach((id) => $(id).addEventListener("input", drawProc));
  drawProc();
}
function drawProc() {
  const D = Math.max(1, +$("fe2D").value || 1), T = Math.max(0.1, +$("fe2Tol").value || 1), Ra = Math.max(0.005, +$("fe2Ra").value || 1), dom = $("fe2Dom").value;
  let g = 0; ITT.grades.forEach((k) => { if (itValue(k, D) <= T) g = k; });
  const gMin = ITT.grades[0], gMax = ITT.grades[ITT.grades.length - 1], rg = ITT.ranges_mm[itRange(D)];
  const fine = g === 0, coarse = g === gMax, outD = D > ITT.ranges_mm[ITT.ranges_mm.length - 1][1];
  if (fine) g = gMin - 1;   // finer than IT5 → judge the processes as IT4 (lapping, honing, fine grinding)
  const list = PROC.filter((p) => !dom || p[1] === dom).map((p) => {
    const [n, d, b, w, rb, rw, note] = p;
    const itOk = g >= b, itEasy = g >= w, raOk = Ra >= rb, raEasy = Ra >= rw;
    const st = !(itOk && raOk) ? "no" : itEasy && raEasy ? "easy" : "ok";
    return { n, d, b, w, rb, rw, note, st };
  });
  const lab = { easy: "✓ economical", ok: "◐ capable – fine settings, check Cpk", no: "✗ not capable" };
  // final-operation suggestion: processes allowed for the feature, capable (IT + Ra), least precise capable process first
  // (coarser IT_best, then coarser Ra_best, PROC order on ties) – same rule as tools/fmse (item 2)
  const feat = $("fe2Feat").value, FEATS = { bore: ["Reaming", "Fine boring", "Broaching", "Honing", "Lapping / superfinishing"],
    bore_rot: ["Finish turning", "Hard turning (CBN)", "Reaming", "Fine boring", "Cylindrical grinding", "Honing", "Lapping / superfinishing"],
    shaft: ["Finish turning", "Hard turning (CBN)", "Cylindrical grinding", "Lapping / superfinishing"],
    face: ["Finish turning", "Hard turning (CBN)", "Finish milling", "Broaching", "Surface grinding", "Lapping / superfinishing"] };
  const all = PROC.map((p, i) => { const [n, , b, w, rb, rw] = p; return { n, b, w, rb, rw, i, st: !(g >= b && Ra >= rb) ? "no" : g >= w && Ra >= rw ? "easy" : "ok" }; });
  const fin = all.filter((p) => (FEATS[feat] || []).includes(p.n) && p.st !== "no").sort((a, b) => (b.b - a.b) || (b.rb - a.rb) || (a.i - b.i));
  $("fe2ITres").innerHTML = `<p class="fe-big">Required: <b>${fine ? `finer than IT${gMin}` : coarse ? `IT${gMax} or coarser` : `IT${g}`}</b> <span class="sub">(${fine ? `${f1(T, 0)} µm < IT${gMin} = ${itValue(gMin, D)} µm` : coarse ? `IT${gMax} = ${itValue(gMax, D)} µm ≤ ${f1(T, 0)} µm – the table ends at IT${gMax}` : `IT${g} = ${itValue(g, D)} µm ≤ ${f1(T, 0)} µm < IT${g + 1} = ${itValue(g + 1, D)} µm`}, size range ${rg[0]} < D ≤ ${rg[1]} mm)</span> and Ra ≤ ${Ra} µm</p>
    <p class="sub">ISO 286-1 table values for ${rg[0]} < D ≤ ${rg[1]} mm: ${ITT.grades.map((k) => `IT${k} = ${itValue(k, D)}`).join(" · ")} µm &nbsp;·&nbsp; source: ISO 286-1 standard tolerance grades (table copied in tools/fmse/examples/item2_examples.json – check against your copy of the standard)</p>
    ${outD ? `<p class="fe-no">D = ${D} mm is above 500 mm – the table here ends at 500 mm; the values of the last range are shown. Use the standard for larger sizes.</p>` : ""}
    ${fine ? `<p class="fe-no">Finer than IT${gMin} – the processes below are judged as IT${gMin - 1}; only lapping / honing / fine grinding reach it. Check if the tolerance is really needed.</p>` : ""}
    ${fin.length ? `<p><b>Last operation for this feature</b> (least precise capable process first): ${fin.map((p, k) => `${k + 1}. <b>${esc(p.n)}</b> <span class="sub">(IT${p.b}–${p.w}, Ra ${p.rb}–${p.rw} · ${p.st === "easy" ? "economical" : "capable – fine settings, check Cpk"})</span>`).join(" · ")}</p>
    <p class="sub">Choose the first one that fits your machine concept and volume (broaching only for high volume). Chain before it: raw part → rough machining → semi-finish → last operation; each step gains 2–3 IT grades (see 2H).</p>` : `<p class="fe-no">No process of the feature group reaches IT${g} and Ra ${Ra} µm – relax the tolerance or use a special process.</p>`}`;
  // chart: one bar per process from IT best to IT worst, line at required grade
  const x0 = 250, x1 = 790, gx = (k) => x0 + (k - 2) / 15 * (x1 - x0), rowH = Math.min(24, 520 / Math.max(1, list.length));
  let s = "";
  for (let k = 2; k <= 17; k++) s += `<line class="fe-grid" x1="${gx(k)}" x2="${gx(k)}" y1="20" y2="${30 + list.length * rowH}"/>${k <= 16 ? `<text class="fe-tick" x="${gx(k) + (gx(k + 1) - gx(k)) / 2}" y="14" text-anchor="middle">IT${k}</text>` : ""}`;
  list.forEach((p, r) => {
    const y = 26 + r * rowH;
    s += `<text class="fe-tick fe-pl" x="${x0 - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(p.n)}</text>
      <rect class="fe-pb fe-pb-${p.st}" x="${gx(p.b)}" y="${y + 3}" width="${gx(p.w + 1) - gx(p.b)}" height="${rowH - 7}" rx="4"><title>${esc(p.n)}: IT${p.b}–IT${p.w}, Ra ${p.rb}–${p.rw} µm · ${esc(p.note)}</title></rect>
      <text class="fe-tick" x="${gx(p.w + 1) + 6}" y="${y + rowH / 2 + 4}">${lab[p.st].split(" ")[0]} Ra ${p.rb}–${p.rw}</text>`;
  });
  if (g) s += `<line class="fe-req" x1="${gx(g + 1)}" x2="${gx(g + 1)}" y1="18" y2="${30 + list.length * rowH}"/><text class="fe-ptl" x="${gx(g + 1) + 4}" y="${34 + list.length * rowH}">required IT${g} (bars must reach left of this line)</text>`;
  $("fe2IT").setAttribute("viewBox", `0 0 900 ${50 + list.length * rowH}`);
  $("fe2IT").innerHTML = s;
}

/* ================================================================== 2C cycle-time estimators */
const CALC = {
  turn: { mat: true, inp: [["D", "Diameter D", 60, "mm"], ["L", "Length of cut L", 120, "mm"], ["ap", "Depth of cut aₚ", 2, "mm"], ["f", "Feed f", 0.25, "mm/rev"], ["vc", "Cutting speed v꜀", 200, "m/min"], ["pas", "Passes", 3, ""], ["nc", "Non-cutting share (rapid, tool change, load)", 35, "%"]],
    run(v, kc) {
      const n = 1000 * v.vc / (Math.PI * v.D), vf = v.f * n, tc = v.pas * v.L / vf, t = tc / (1 - v.nc / 100), Pc = kc * v.ap * v.f * v.vc / 60000, M = Pc * 9550 / n;
      return { out: [["Spindle speed n = 1000·v꜀ ÷ (π·D)", n, "rpm", 0], ["Feed speed v_f = f·n", vf, "mm/min", 0], ["Cutting time = passes·L ÷ v_f", tc, "min", 2], ["Time per part = cutting ÷ (1 − non-cutting share)", t, "min", 2], ["Cutting power P꜀ = k꜀·aₚ·f·v꜀ ÷ 60 000", Pc, "kW", 1], ["Spindle power needed (η = 0.8)", Pc / 0.8, "kW", 1], ["Torque M = 9550·P꜀ ÷ n", M, "N·m", 0]], t };
    } },
  mill: { mat: true, millv: true, inp: [["Dc", "Tool diameter D꜀", 63, "mm"], ["z", "Teeth z", 5, ""], ["fz", "Feed per tooth f_z", 0.15, "mm"], ["vc", "Cutting speed v꜀", 200, "m/min"], ["ap", "Depth aₚ", 3, "mm"], ["ae", "Width aₑ", 40, "mm"], ["L", "Path length L", 300, "mm"], ["pas", "Passes", 4, ""], ["nc", "Non-cutting share", 40, "%"]],
    run(v, kc) {
      const n = 1000 * v.vc / (Math.PI * v.Dc), vf = v.fz * v.z * n, tc = v.pas * (v.L + v.Dc) / vf, t = tc / (1 - v.nc / 100), Qm = v.ap * v.ae * vf / 1000, Pc = v.ap * v.ae * vf * kc / 6e7;
      return { out: [["Spindle speed n", n, "rpm", 0], ["Feed speed v_f = f_z·z·n", vf, "mm/min", 0], ["Cutting time = passes·(L + D꜀) ÷ v_f", tc, "min", 2], ["Time per part", t, "min", 2], ["Metal removal Q = aₚ·aₑ·v_f ÷ 1000", Qm, "cm³/min", 0], ["Cutting power P꜀ = aₚ·aₑ·v_f·k꜀ ÷ 60·10⁶", Pc, "kW", 1], ["Spindle power needed (η = 0.8)", Pc / 0.8, "kW", 1]], t };
    } },
  drill: { mat: true, drillv: true, inp: [["D", "Drill diameter D", 10, "mm"], ["H", "Hole depth", 30, "mm"], ["f", "Feed f", 0.2, "mm/rev"], ["vc", "Cutting speed v꜀", 90, "m/min"], ["k", "Number of holes", 12, ""], ["tp", "Positioning per hole", 1.5, "s"]],
    run(v, kc) {
      const n = 1000 * v.vc / (Math.PI * v.D), th = (v.H + 0.3 * v.D) / (v.f * n), t = v.k * (th + v.tp / 60), Pc = v.f * v.vc * v.D * kc / 240000, F = 0.5 * kc * v.D / 2 * v.f;
      return { out: [["Spindle speed n", n, "rpm", 0], ["Time per hole = (depth + 0.3·D) ÷ (f·n)", th * 60, "s", 1], ["Time all holes (incl. positioning)", t, "min", 2], ["Cutting power P꜀ = f·v꜀·D·k꜀ ÷ 240 000", Pc, "kW", 1], ["Feed force (rough) F ≈ 0.5·k꜀·(D/2)·f", F, "N", 0]], t };
    } },
  weld: { inp: [["Lw", "Total weld length per part", 1800, "mm"], ["vw", "Weld speed", 0.6, "m/min"], ["ns", "Number of seams", 14, ""], ["ta", "Air move + arc start per seam", 4, "s"], ["ti", "Turntable index", 4, "s"], ["tl", "Operator load / unload per part", 150, "s"], ["tc", "Torch cleaning time / every N parts", 20, "s"], ["nc", "N parts per cleaning", 5, ""]],
    run(v) {
      const arc = v.Lw / 1000 / v.vw * 60, rob = arc + v.ns * v.ta + v.tc / Math.max(1, v.nc), cyc = Math.max(rob, v.tl) + v.ti;
      return { out: [["Arc time = weld length ÷ speed", arc, "s", 0], ["Robot time = arc + seams·air + cleaning ÷ N", rob, "s", 0], ["Cycle (2-station): max(robot, load) + index", cyc, "s", 0], ["Arc-on ratio = arc ÷ cycle", 100 * arc / cyc, "%", 0], ["Bottleneck", rob >= v.tl ? 0 : 1, rob >= v.tl ? "robot (load is hidden)" : "operator loading – add a helper or a 3rd station", -1]], t: cyc / 60 };
    } },
  laser: { inp: [["Lc", "Cut length per part", 3.2, "m"], ["v", "Cutting speed (see note)", 8, "m/min"], ["np", "Pierces (contours) per part", 9, ""], ["tp", "Pierce time", 0.4, "s"], ["tm", "Positioning per contour", 0.3, "s"], ["ts", "Sheet change (auto tower)", 60, "s"], ["pp", "Parts per sheet", 24, ""]],
    run(v) {
      const tcut = v.Lc / v.v * 60, t = tcut + v.np * (v.tp + v.tm) + v.ts / Math.max(1, v.pp);
      return { out: [["Cutting = length ÷ speed", tcut, "s", 1], ["Pierce + positioning", v.np * (v.tp + v.tm), "s", 1], ["Sheet change per part", v.ts / Math.max(1, v.pp), "s", 1], ["Time per part", t, "s", 1], ["Parts per hour (100 %)", 3600 / t, "pcs/h", 0]], t: t / 60,
        note: "Typical fibre-laser speeds (6 kW, mild steel, O₂/N₂): 1 mm ≈ 30–40 m/min · 3 mm ≈ 10–15 · 6 mm ≈ 4–6 · 10 mm ≈ 1.5–2.5 m/min. Check the maker's cutting table." };
    } },
  asm: { inp: [["ns", "Screws (automatic, 3 s each)", 6, ""], ["np", "Press-fits (6 s each)", 2, ""], ["nm", "Manual picks / placements (2.5 s each)", 5, ""], ["nv", "Vision checks (1.5 s each)", 2, ""], ["tt", "Carrier transfer in / out", 4, "s"], ["tk", "Takt time wanted", 45, "s"]],
    run(v) {
      const t = v.ns * 3 + v.np * 6 + v.nm * 2.5 + v.nv * 1.5 + v.tt, st = Math.ceil(t / v.tk);
      return { out: [["Work content = Σ elements + transfer", t, "s", 1], ["Stations needed = ⌈work ÷ takt⌉", st, "", 0], ["Balance efficiency = work ÷ (stations × takt)", 100 * t / (st * v.tk), "%", 0]], t: t / 60,
        note: "Element times are typical automatic / manual values (MTM-style). Measure or simulate for the real product." };
    } },
};
let calcK = "turn"; const CV = {};
function initCalc() {
  $("fe2Calc").addEventListener("click", (e) => { const b = e.target.closest("[data-calc]"); if (b) { calcK = b.dataset.calc; document.querySelectorAll("#fe2Calc [data-calc]").forEach((x) => x.classList.toggle("active", x === b)); drawCalcIn(); } });
  $("fe2CIn").addEventListener("input", (e) => { const t = e.target; if (t.dataset.v) { CV[calcK][t.dataset.v] = +t.value; } if (t.id === "fe2CMat") { CV[calcK]._mat = +t.value; const m = MATS[+t.value]; if (CV[calcK].vc != null) { CV[calcK].vc = CALC[calcK].millv ? m[3] : CALC[calcK].drillv ? Math.round(m[2] * 0.45) : m[2]; drawCalcIn(); return; } } drawCalcOut(); });
  drawCalcIn();
}
function drawCalcIn() {
  const c = CALC[calcK];
  if (!CV[calcK]) { CV[calcK] = { _mat: 0 }; c.inp.forEach(([k, , d]) => { CV[calcK][k] = d; }); }
  const v = CV[calcK];
  $("fe2CIn").innerHTML = `${c.mat ? `<label class="fe-q"><span>Material (k꜀ and typical v꜀)</span><select id="fe2CMat">${MATS.map((m, i) => `<option value="${i}"${i === v._mat ? " selected" : ""}>${esc(m[0])} – k꜀ ${m[1]} N/mm²</option>`).join("")}</select></label>` : ""}
    <table class="am-kv fe-calc"><tbody>${c.inp.map(([k, n, , u]) => `<tr><td>${esc(n)}</td><td><input type="number" step="any" data-v="${k}" value="${v[k]}"> ${esc(u)}</td></tr>`).join("")}</tbody></table>`;
  drawCalcOut();
}
function drawCalcOut() {
  const c = CALC[calcK], v = CV[calcK], kc = MATS[v._mat || 0][1];
  const r = c.run(v, kc);
  $("fe2COut").innerHTML = `<table class="am-kv"><tbody>${r.out.map(([n, x, u, d]) => `<tr><td>${esc(n)}</td><td><b>${d < 0 ? esc(u) : f1(x, d) + " " + esc(u)}</b></td></tr>`).join("")}</tbody></table>
    <p class="fe-big">≈ <b>${f1(r.t, 2)} min</b> per part <span class="sub">→ use it in 2D</span></p>
    ${r.note ? `<p class="sub">${esc(r.note)}</p>` : ""}
    ${c.mat ? `<p class="am-note">Power check: the machine needs at least this spindle power <b>at this speed</b> (look at the power–speed curve of the spindle, not only the maximum kW). Torque matters at low speed (large tools, big diameters).</p>` : ""}`;
}

/* ================================================================== 2D capacity */
let C = null, preK = Q.get("fecap") && CAP[Q.get("fecap")] ? Q.get("fecap") : "mach";
function initCap() {
  $("fe2Pre").value = preK;
  $("fe2Pre").addEventListener("change", () => { preK = $("fe2Pre").value; C = clone(CAP[preK]); drawCapTab(); });
  $("fe2Reset").addEventListener("click", () => { C = clone(CAP[preK]); drawCapTab(); });
  $("fe2Gr").addEventListener("input", drawCapRes);
  $("fe2Tab").addEventListener("input", (e) => {
    const t = e.target, v = +t.value; if (!Number.isFinite(v)) return;
    if (t.dataset.g) { const [g, k] = t.dataset.g.split(","); C.groups[+g][+k] = v; }
    if (t.dataset.p) { const [p, k] = t.dataset.p.split(","); C.parts[+p][+k] = v; }
    if (t.dataset.t) { const [p, g] = t.dataset.t.split(","); C.parts[+p][3][+g] = v; }
    drawCapRes();
  });
  C = clone(CAP[preK]); drawCapTab();
}
function drawCapTab() {
  $("fe2Tab").innerHTML = `<table class="am-tab fe-cap"><thead>
      <tr><th>Part</th><th>Volume / year</th><th>Lot size</th>${C.groups.map(([n]) => `<th>${esc(n)}<br><span class="sub">min / part</span></th>`).join("")}</tr></thead><tbody>
      ${C.parts.map((p, i) => `<tr><td><b>${esc(p[0])}</b></td><td><input type="number" data-p="${i},1" value="${p[1]}"></td><td><input type="number" data-p="${i},2" value="${p[2]}"></td>
        ${p[3].map((t, g) => `<td><input type="number" step="any" data-t="${i},${g}" value="${t}"></td>`).join("")}</tr>`).join("")}
      <tr class="fe-gr"><td>Hours / year per machine</td><td colspan="2"></td>${C.groups.map((g, i) => `<td><input type="number" data-g="${i},1" value="${g[1]}"></td>`).join("")}</tr>
      <tr class="fe-gr"><td>OEE</td><td colspan="2"></td>${C.groups.map((g, i) => `<td><input type="number" step="0.01" data-g="${i},2" value="${g[2]}"></td>`).join("")}</tr>
      <tr class="fe-gr"><td>Set-up min per lot</td><td colspan="2"></td>${C.groups.map((g, i) => `<td><input type="number" data-g="${i},3" value="${g[3]}"></td>`).join("")}</tr>
    </tbody></table><p class="sub">${esc(C.note)}</p>`;
  drawCapRes();
}
function drawCapRes() {
  const gr = 1 + (+$("fe2Gr").value || 0) / 100;
  const Qtot = C.parts.reduce((s, p) => s + p[1] * gr, 0);
  const res = C.groups.map(([n, T, oee, su], g) => {
    let run = 0, set = 0;
    C.parts.forEach(([, q, lot, t]) => { if (!t[g]) return; run += q * gr * t[g] / 60; set += Math.ceil(q * gr / Math.max(1, lot)) * su / 60; });
    const load = run + set, cap = T * oee, exact = load / cap, nM = Math.max(load > 0 ? 1 : 0, Math.ceil(exact - 1e-9));
    return { n, T, oee, run, set, load, cap, exact, nM, util: nM ? exact / nM : 0, takt: T * 60 / Qtot };
  });
  const bn = res.reduce((a, b) => (b.util > a.util ? b : a), res[0]);
  $("fe2Bars").innerHTML = `<h3 class="fe-h3">Utilisation per machine group (after rounding up)</h3>
    <div class="fe-bars">${res.map((r) => `<div class="fe-bar${r === bn ? " fe-bn" : ""}"><span>${esc(r.n)}</span><i style="width:${Math.min(100, r.util * 100)}%"></i><em>${r.nM} × · ${f1(r.util * 100, 0)} %</em></div>`).join("")}</div>
    <p class="sub">Bar = load ÷ (machines × hours × OEE). Above ≈ 85 %: queues grow fast (item 4), no room for breakdowns.</p>`;
  $("fe2CapRes").innerHTML = `<table class="am-tab"><thead><tr><th>Group</th><th>Run h</th><th>Set-up h</th><th>Load h</th><th>Machines exact</th><th>Machines</th></tr></thead>
    <tbody>${res.map((r) => `<tr${r === bn ? ' class="fe-sel"' : ""}><td>${esc(r.n)}</td><td>${f1(r.run, 0)}</td><td>${f1(r.set, 0)}</td><td><b>${f1(r.load, 0)}</b></td><td>${f1(r.exact, 2)}</td><td><b>${r.nM}</b></td></tr>`).join("")}</tbody></table>
    <p><b>Bottleneck:</b> ${esc(bn.n)} – ${f1(bn.util * 100, 0)} % · total volume ${f1(Qtot, 0)} parts / year · takt time (on ${f1(bn.T, 0)} h) = <b>${f1(bn.takt, 2)} min</b> per part.</p>
    <p class="phd-eq">load = Σ Q·t/60 + Σ ⌈Q/lot⌉·t_setup/60 = ${f1(bn.run, 0)} + ${f1(bn.set, 0)} = ${f1(bn.load, 0)} h · machines = ${f1(bn.load, 0)} ÷ (${f1(bn.T, 0)} × ${bn.oee}) = ${f1(bn.exact, 2)} → ${bn.nM}</p>
    <p class="am-note">A fractional result like 1.15 means: buy 2 machines (58 % loaded) <b>or</b> reduce load – faster process (2C), fewer set-ups (bigger lots, SMED), more hours (unmanned shift),
      higher OEE, or move one part to another group. Only one machine of a group = no routing flexibility; decide if a breakdown may stop that product.</p>`;
}

/* ================================================================== 2E scoring */
const SC = { w: CRIT.map((c) => c[1]), c: clone(CANDS) };
function initScore() {
  $("fe2Score").addEventListener("input", (e) => { const t = e.target; if (t.dataset.w) SC.w[+t.dataset.w] = +t.value || 0; if (t.dataset.s) { const [c, k] = t.dataset.s.split(","); SC.c[+c][1][+k] = Math.max(1, Math.min(5, +t.value || 1)); } drawScoreRes(); });
  $("fe2Score").innerHTML = `<table class="am-tab fe-score"><thead><tr><th>Criterion</th><th>Weight %</th>${SC.c.map(([n]) => `<th>${esc(n)}</th>`).join("")}</tr></thead>
    <tbody>${CRIT.map(([n], k) => `<tr><td>${esc(n)}</td><td><input type="number" data-w="${k}" value="${SC.w[k]}"></td>${SC.c.map((c, i) => `<td><input type="number" min="1" max="5" data-s="${i},${k}" value="${c[1][k]}"></td>`).join("")}</tr>`).join("")}
      <tr class="fe-gr"><td><b>Weighted score</b></td><td id="fe2Wsum"></td>${SC.c.map((_, i) => `<td id="fe2Sc${i}"></td>`).join("")}</tr></tbody></table>`;
  drawScoreRes();
}
function drawScoreRes() {
  const W = SC.w.reduce((a, b) => a + b, 0) || 1;
  const sc = SC.c.map(([n, s]) => ({ n, v: s.reduce((a, x, k) => a + x * SC.w[k], 0) / (5 * W) * 100 }));
  $("fe2Wsum").textContent = W + (W === 100 ? "" : " (≠ 100, normalised)");
  sc.forEach((s, i) => { $("fe2Sc" + i).innerHTML = `<b>${f1(s.v, 0)} %</b>`; });
  const best = [...sc].sort((a, b) => b.v - a.v);
  $("fe2ScoreRes").innerHTML = `<p>Best: <b>${esc(best[0].n)}</b> (${f1(best[0].v, 0)} %), then ${esc(best[1].n)} (${f1(best[1].v, 0)} %). ${best[0].v - best[1].v < 5 ? '<span class="fe-no">Less than 5 points apart – the result is not robust: check with changed weights, visit references, ask for a test cut.</span>' : ""}</p>
    <p class="sub">Score = Σ (score × weight) ÷ (5 × Σ weight). Fix the weights <b>before</b> you see the offers – otherwise you choose the favourite and adjust the weights later.
      Knock-out criteria (e.g. "part does not fit", "no local service") are checked first and are not part of the score.</p>`;
}
