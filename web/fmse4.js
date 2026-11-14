/* FMS engineering – item 4: capacity, layout, simulation.  Loaded by fmse.js (build "4").
 * 4A OEE six big losses · 4B queueing (Kingman / Sakasegawa, breakdown variability – Factory Physics)
 * 4C buffer between two machines (simulated) · 4D layout types + from-to matrix + pairwise exchange (CRAFT idea)
 * 4E discrete-event simulation of a generic closed-loop FMS (pallets, load stations, vehicle, machines with breakdowns)
 * Guide: docs/FMS system design/64_capacity_layout_simulation.md.  Deep link: /?feitem=4#fmse */
import { OEE0, LAYOUTS, DEPTS, FLOW, SLOTS, START, PITCH, SIM0 } from "./fmse4_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const clone = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------------------------------------------- random numbers (seeded → repeatable runs) */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const expo = (R, mean) => -mean * Math.log(1 - R());
function logn(R, mean, cv) {           // lognormal with given mean and coefficient of variation
  if (!cv) return mean;
  const s2 = Math.log(1 + cv * cv), mu = Math.log(mean) - s2 / 2;
  const z = Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
  return Math.exp(mu + Math.sqrt(s2) * z);
}
// processing with time-based failures (only while working): returns {dur, down, segs:[[dt, "run"|"down"], …]}; ttf is carried per machine
function withFailures(R, mc, p, mttf, mttr) {
  let left = p, dur = 0, down = 0; const segs = [];
  if (!(mttf > 0)) return { dur: p, down: 0, segs: [[p, "run"]] };
  while (mc.ttf < left) { if (mc.ttf > 0) segs.push([mc.ttf, "run"]); dur += mc.ttf; left -= mc.ttf; const r = expo(R, mttr); segs.push([r, "down"]); dur += r; down += r; mc.ttf = expo(R, mttf); }
  mc.ttf -= left; dur += left; segs.push([left, "run"]);
  return { dur, down, segs };
}

/* ---------------------------------------------------------------- small SVG line chart */
function lineChart(svg, { xs, series, xl, yl, mark, ymin = 0, ymax }) {
  const W = 640, H = 300, x0 = 60, x1 = W - 20, y0 = H - 40, y1 = 16;
  const all = series.flatMap((s) => s.y.filter(Number.isFinite));
  const yM = ymax != null ? ymax : Math.max(...all, 1e-9) * 1.1, xm = Math.min(...xs), xM = Math.max(...xs);
  const X = (x) => x0 + (x - xm) / (xM - xm || 1) * (x1 - x0), Y = (y) => y0 - (Math.min(y, yM) - ymin) / (yM - ymin) * (y0 - y1);
  let s = "";
  for (let k = 0; k <= 5; k++) { const v = ymin + (yM - ymin) * k / 5, y = Y(v); s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${f1(v, yM < 2 ? 2 : yM < 20 ? 1 : 0)}</text>`; }
  const step = Math.max(1, Math.ceil(xs.length / 10));
  xs.forEach((x, i) => { if (i % step === 0) s += `<text class="fe-tick" x="${X(x)}" y="${y0 + 16}" text-anchor="middle">${f1(x, xM - xm < 3 ? 2 : 0)}</text>`; });
  series.forEach((sr) => {
    const pts = xs.map((x, i) => [X(x), Y(sr.y[i])]).filter((p, i) => Number.isFinite(sr.y[i]));
    s += `<polyline class="fe-ln ${sr.cls}" points="${pts.map((p) => p.join(",")).join(" ")}"/>`;
    if (sr.dots) pts.forEach(([a, b]) => { s += `<circle class="fe-dt ${sr.cls}" cx="${a}" cy="${b}" r="3"/>`; });
  });
  if (mark) s += `<line class="fe-req" x1="${X(mark)}" x2="${X(mark)}" y1="${y1}" y2="${y0}"/>`;
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text><text class="fe-axis" transform="translate(14 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  return series.map((sr) => `<span class="fe-lg"><i class="${sr.cls}"></i>${esc(sr.n)}</span>`).join(" ");
}
const num = (id) => +$(id).value;

export function mount(el) {
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>4A · OEE – where does the machine time go? (six big losses)</h2>
      <span class="sub">one machine, one week · edit the numbers</span></div>
    <div class="grid2"><div><svg id="fe4Wf" class="fe-chart" role="img" aria-label="OEE loss waterfall"></svg></div>
      <div><table class="am-kv fe-calc"><tbody>${[["cal", "Calendar time", "min"], ["plan", "Planned production time", "min"], ["down", "Breakdowns", "min"], ["setup", "Set-ups + adjustments", "min"], ["minor", "Minor stops (< 5 min)", "min"], ["ideal", "Ideal cycle time", "min/part"], ["total", "Parts made (total)", "pcs"], ["good", "Good parts (first pass)", "pcs"]].map(([k, n, u]) => `<tr><td>${n}</td><td><input type="number" step="any" id="fe4O_${k}" value="${OEE0[k]}"> ${u}</td></tr>`).join("")}</tbody></table>
        <div id="fe4ORes"></div></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>4B · Why waiting time explodes – queueing with variability</h2>
      <span class="sub">Kingman (1 machine) / Sakasegawa (m machines) · breakdowns add variability (Hopp &amp; Spearman, Factory Physics)</span></div>
    <div class="grid2"><div><svg id="fe4Q" class="fe-chart" role="img" aria-label="Cycle time versus utilisation"></svg><div class="sub" id="fe4QLg"></div></div>
      <div><table class="am-kv fe-calc"><tbody>
          <tr><td>Utilisation u</td><td><input type="range" id="fe4u" min="0.3" max="0.97" step="0.01" value="0.85"> <b id="fe4uv"></b></td></tr>
          ${[["t0", "Process time t₀ (no failures)", 10, "min"], ["c0", "Process time variability c₀", 0.5, ""], ["ca", "Arrival variability cₐ", 1, ""], ["mf", "MTTF (busy time)", 600, "min"], ["mr", "MTTR", 60, "min"], ["mm", "Parallel machines m", 1, ""]].map(([k, n, d, u]) => `<tr><td>${n}</td><td><input type="number" step="any" id="fe4${k}" value="${d}"> ${u}</td></tr>`).join("")}
        </tbody></table><div id="fe4QRes"></div></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>4C · How big must the buffer between two machines be?</h2>
      <span class="sub">2 machines in series with random breakdowns · each point is a simulation of 30 000 min</span></div>
    <div class="fe-row">${[["b1", "Cycle M1", 1, "min"], ["b2", "Cycle M2", 1, "min"], ["bcv", "Cycle variability cv", 0.3, ""], ["bmf", "MTTF each", 100, "min"], ["bmr", "MTTR each", 10, "min"]].map(([k, n, d, u]) => `<label>${n} <input type="number" step="any" id="fe4${k}" value="${d}"> ${u}</label>`).join("")}
      <button class="mx-el" id="fe4BRun">Simulate</button></div>
    <div class="grid2"><div><svg id="fe4B" class="fe-chart" role="img" aria-label="Throughput versus buffer size"></svg><div class="sub" id="fe4BLg"></div></div><div id="fe4BRes"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>4D · Layout – types, and a from-to matrix that improves itself</h2>
      <span class="sub">transport effort = Σ flow × distance · click two departments to swap them, or let the pairwise-exchange method improve it</span></div>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Layout type</th><th>How it looks</th><th>Flow</th><th>Flexibility</th><th>Best for</th><th>Watch out</th></tr></thead>
      <tbody>${LAYOUTS.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <div class="fe-row"><button class="mx-el" id="fe4LImp">Improve (pairwise exchange)</button><button class="mx-el" id="fe4LRst">Start layout</button><span class="sub" id="fe4LMsg"></span></div>
    <div class="grid2"><div class="fe-scroll"><svg id="fe4L" class="fe-chart" viewBox="0 0 640 330" role="img" aria-label="Block layout with material flows"></svg></div><div id="fe4LRes"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>4E · Simulate a generic FMS – machines, pallets, load stations, vehicle, breakdowns</h2>
      <span class="sub">discrete-event simulation in your browser · closed loop: load → vehicle → machine → vehicle → load · same seed = same result</span></div>
    <div class="fe-simgrid"><div><table class="am-kv fe-calc"><tbody>
        ${[["m", "Machines (identical, any part)", ""], ["N", "Pallets in the system", ""], ["L", "Load stations", ""], ["V", "Vehicles (stacker / RGV / AGV)", ""], ["load", "Load / unload time per pallet", "min"], ["loadCv", "Load time variability cv", ""], ["move", "Vehicle time per move", "min"], ["mttf", "Machine MTTF (busy)", "min"], ["mttr", "Machine MTTR", "min"], ["days", "Simulated days (24 h)", ""], ["seed", "Random seed", ""]].map(([k, n, u]) => `<tr><td>${n}</td><td><input type="number" step="any" id="fe4S_${k}" value="${SIM0[k]}"> ${u}</td></tr>`).join("")}
        <tr><td>Dispatching at machines</td><td><select id="fe4S_rule"><option>FIFO</option><option>SPT</option></select></td></tr></tbody></table>
        <h4>Part mix (per pallet)</h4><table class="am-tab fe-calc" id="fe4Parts"></table>
        <div class="fe-row"><button class="mx-el" id="fe4SRun">Run simulation</button><button class="mx-el" id="fe4SSw">Sweep pallets 1 … n</button><button class="mx-el" id="fe4SRst">Example values</button></div></div>
      <div><div id="fe4SRes"></div><svg id="fe4G" class="fe-chart" role="img" aria-label="Gantt chart of the first 16 hours"></svg></div></div>
    <div class="grid2"><div><svg id="fe4Sw" class="fe-chart" role="img" aria-label="Throughput versus number of pallets"></svg><div class="sub" id="fe4SwLg"></div></div><div id="fe4SwRes"></div></div>
  </div>`;

  initOEE(); initQ(); initBuf(); initLayout(); initSim();
}

/* ================================================================== 4A OEE */
function initOEE() { Object.keys(OEE0).forEach((k) => $("fe4O_" + k).addEventListener("input", drawOEE)); drawOEE(); }
function drawOEE() {
  const v = {}; Object.keys(OEE0).forEach((k) => { v[k] = Math.max(0, +$("fe4O_" + k).value || 0); });
  const run = v.plan - v.down - v.setup, net = v.ideal * v.total, speed = Math.max(0, run - net - v.minor), full = v.ideal * v.good, qual = net - full;
  const A = run / v.plan, P = net / run, Qy = v.good / v.total, oee = A * P * Qy;
  const steps = [["Planned", v.plan, "base"], ["Breakdowns", -v.down, "loss"], ["Set-ups", -v.setup, "loss"], ["Run time", run, "sub"], ["Minor stops", -v.minor, "loss"], ["Speed loss", -speed, "loss"], ["Net run", net, "sub"], ["Scrap / rework", -qual, "loss"], ["Fully productive", full, "res"]];
  const W = 640, H = 300, x0 = 50, bw = (W - x0 - 10) / steps.length, Y = (x) => 260 - x / v.plan * 230;
  let s = "", level = 0;
  steps.forEach(([n, x, k], i) => {
    let top, bot;
    if (k === "loss") { top = level; bot = level + x; level = bot; } else { top = x; bot = 0; level = x; }
    const y = Y(Math.max(top, bot)), h = Math.abs(Y(top) - Y(bot));
    s += `<rect class="fe-wf-${k}" x="${x0 + i * bw + 4}" y="${y}" width="${bw - 8}" height="${Math.max(1, h)}" rx="3"/>
      <text class="fe-tick" x="${x0 + i * bw + bw / 2}" y="${y - 4}" text-anchor="middle">${f1(Math.abs(x), 0)}</text>
      <text class="fe-tick" x="${x0 + i * bw + bw / 2}" y="${276 + (i % 2) * 12}" text-anchor="middle">${esc(n)}</text>`;
  });
  $("fe4Wf").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fe4Wf").innerHTML = s;
  $("fe4ORes").innerHTML = `<table class="am-kv"><tbody>
    <tr><td>Availability A = run ÷ planned</td><td><b>${f1(A * 100, 1)} %</b> <span class="sub">${f1(run, 0)} ÷ ${f1(v.plan, 0)}</span></td></tr>
    <tr><td>Performance P = ideal × total ÷ run</td><td><b>${f1(P * 100, 1)} %</b> <span class="sub">${v.ideal} × ${v.total} ÷ ${f1(run, 0)}</span></td></tr>
    <tr><td>Quality Q = good ÷ total</td><td><b>${f1(Qy * 100, 1)} %</b></td></tr>
    <tr><td>OEE = A × P × Q</td><td><b>${f1(oee * 100, 1)} %</b> <span class="sub">= fully productive ÷ planned = ${f1(full, 0)} ÷ ${f1(v.plan, 0)}</span></td></tr>
    <tr><td>TEEP = OEE × planned ÷ calendar</td><td><b>${f1(oee * v.plan / v.cal * 100, 1)} %</b> <span class="sub">how much of the whole week is used</span></td></tr></tbody></table>
    ${v.minor > run - net ? '<p class="fe-no">Minor stops larger than the whole performance loss – check the numbers.</p>' : ""}
    <p class="am-note">World class ≈ 85 % (A 90 × P 95 × Q 99.9 %). New FMS: 60–75 % in year 1. The biggest bar shows where to work first:
      breakdowns → maintenance (TPM), set-ups → SMED / pallets, minor stops + speed → process, scrap → quality. For an FMS the unmanned hours raise TEEP more than any other action.</p>`;
}

/* ================================================================== 4B queueing */
function initQ() { ["fe4u", "fe4t0", "fe4c0", "fe4ca", "fe4mf", "fe4mr", "fe4mm"].forEach((id) => $(id).addEventListener("input", drawQ)); drawQ(); }
function qModel(t0, c0, ca, mf, mr, m) {
  const A = mf > 0 ? mf / (mf + mr) : 1, te = t0 / A, ce2 = c0 * c0 + (mf > 0 ? 2 * A * (1 - A) * mr / t0 : 0);   // cr = 1 (exponential repairs)
  const wq = (u) => ((ca * ca + ce2) / 2) * (Math.pow(u, Math.sqrt(2 * (m + 1)) - 1) / (m * (1 - u))) * te;
  return { A, te, ce2, ct: (u) => wq(u) + te, wq };
}
function drawQ() {
  const u = num("fe4u"), t0 = Math.max(0.01, num("fe4t0")), c0 = num("fe4c0"), ca = num("fe4ca"), mf = num("fe4mf"), mr = num("fe4mr"), m = Math.max(1, Math.round(num("fe4mm")));
  $("fe4uv").textContent = f1(u * 100, 0) + " %";
  const M1 = qModel(t0, c0, ca, mf, mr, m), M2 = qModel(t0, c0, ca, mf / 10, mr / 10, m), M0 = qModel(t0, c0, ca, 0, 0, m);
  const xs = []; for (let x = 0.3; x <= 0.971; x += 0.01) xs.push(+x.toFixed(2));
  $("fe4QLg").innerHTML = lineChart($("fe4Q"), { xs, xl: "Utilisation u", yl: "Cycle time ÷ effective process time", mark: u, ymax: 30,
    series: [{ n: `Your machine (MTTF ${mf}, MTTR ${mr})`, y: xs.map((x) => M1.ct(x) / M1.te), cls: "fe-s1" }, { n: `Same availability, 10× shorter stops (${mf / 10} / ${mr / 10})`, y: xs.map((x) => M2.ct(x) / M2.te), cls: "fe-s3" }, { n: "No breakdowns", y: xs.map((x) => M0.ct(x) / M0.te), cls: "fe-s4" }] });
  const ra = u * m / M1.te, ct = M1.ct(u);
  $("fe4QRes").innerHTML = `<table class="am-kv"><tbody>
    <tr><td>Availability A = MTTF ÷ (MTTF + MTTR)</td><td><b>${f1(M1.A * 100, 1)} %</b></td></tr>
    <tr><td>Effective time tₑ = t₀ ÷ A</td><td>${f1(M1.te, 2)} min</td></tr>
    <tr><td>cₑ² = c₀² + 2·A·(1 − A)·MTTR ÷ t₀</td><td>${f1(M1.ce2, 2)} <span class="sub">(10× shorter stops: ${f1(M2.ce2, 2)})</span></td></tr>
    <tr><td>Waiting time W_q at u = ${f1(u * 100, 0)} %</td><td><b>${f1(M1.wq(u), 1)} min</b></td></tr>
    <tr><td>Cycle time CT = W_q + tₑ</td><td><b>${f1(ct, 1)} min</b> = ${f1(ct / M1.te, 1)} × tₑ</td></tr>
    <tr><td>WIP = rₐ × CT (Little)</td><td>${f1(ra * ct, 1)} parts <span class="sub">arrival rate rₐ = ${f1(ra * 60, 2)} /h</span></td></tr></tbody></table>
    <p class="phd-eq">W_q = (cₐ² + cₑ²)/2 · u^(√(2(m+1)) − 1) / (m(1 − u)) · tₑ</p>
    <p class="am-note"><b>Three lessons:</b> (1) waiting grows like u ÷ (1 − u) – from 80 % to 95 % it becomes 4–5 × longer; plan bottlenecks at 80–85 %.
      (2) Variability costs capacity: halve c (stable process, regular arrivals) and the queue halves. (3) With the same availability, <b>frequent short stops are much better than rare long ones</b> – a 6-hour breakdown hurts more than 36 ten-minute stops.</p>`;
}

/* ================================================================== 4C buffer between two machines */
function runLine(B, p, seed) {
  const R = rng(seed), T = 30000, m1 = { ttf: expo(R, p.mf) }, m2 = { ttf: expo(R, p.mf) };
  const dur = (mc, t) => withFailures(R, mc, logn(R, t, p.cv), p.mf, p.mr).dur;
  let t = 0, buf = 0, done = 0, t1 = dur(m1, p.t1), t2 = Infinity, blocked = false;
  while (true) {
    const tn = Math.min(t1, t2); if (tn > T) break; t = tn;
    if (t1 <= t2) {                                     // M1 finished a part
      if (t2 === Infinity) { t2 = t + dur(m2, p.t2); t1 = t + dur(m1, p.t1); }
      else if (buf < B) { buf++; t1 = t + dur(m1, p.t1); }
      else { blocked = true; t1 = Infinity; }
    } else {                                            // M2 finished a part
      done++;
      if (buf > 0) { buf--; t2 = t + dur(m2, p.t2); } else t2 = Infinity;
      if (blocked) { blocked = false; if (t2 === Infinity) t2 = t + dur(m2, p.t2); else buf++; t1 = t + dur(m1, p.t1); }
    }
  }
  return done / T * 60;
}
function initBuf() { $("fe4BRun").addEventListener("click", drawBuf); drawBuf(); }
function drawBuf() {
  const p = { t1: num("fe4b1"), t2: num("fe4b2"), cv: num("fe4bcv"), mf: num("fe4bmf"), mr: num("fe4bmr") };
  const Bs = [...Array(21).keys()], th = Bs.map((B) => (runLine(B, p, 11) + runLine(B, p, 23)) / 2);
  const A = p.mf / (p.mf + p.mr), lim = Math.min(A / p.t1, A / p.t2) * 60;
  $("fe4BLg").innerHTML = lineChart($("fe4B"), { xs: Bs, xl: "Buffer places between M1 and M2", yl: "Throughput [parts/h]", ymax: lim * 1.08,
    series: [{ n: "Simulated line", y: th, cls: "fe-s1", dots: true }, { n: "Limit = slowest machine alone (with its breakdowns)", y: Bs.map(() => lim), cls: "fe-s4" }] });
  const b95 = Bs.find((B, i) => th[i] >= 0.95 * lim);
  const parts = p.mr / Math.min(p.t1, p.t2);
  $("fe4BRes").innerHTML = `<table class="am-kv"><tbody><tr><td>Throughput without buffer</td><td><b>${f1(th[0], 1)} /h</b> (${f1(th[0] / lim * 100, 0)} % of limit)</td></tr>
      <tr><td>With 20 places</td><td><b>${f1(th[20], 1)} /h</b> (${f1(th[20] / lim * 100, 0)} %)</td></tr>
      <tr><td>Places for 95 % of the limit</td><td><b>${b95 == null ? "> 20" : b95}</b></td></tr>
      <tr><td>Parts made during one average repair = MTTR ÷ cycle</td><td>${f1(parts, 0)} <span class="sub">rule of thumb for the buffer</span></td></tr></tbody></table>
    <p class="am-note">Without a buffer every stop of one machine stops the other – both availabilities multiply (≈ A²). A buffer of about <b>MTTR ÷ cycle time</b> parts decouples them. More places give less and less (diminishing return) but cost space and WIP.
      In an FMS the pallet pool <b>is</b> the buffer: that is why the number of pallets (item 3, 4E) matters so much.</p>`;
}

/* ================================================================== 4D layout */
let LAY = [...START], pick = null;
const pos = (slot) => [70 + SLOTS[slot][0] * 150, 70 + SLOTS[slot][1] * 160];
function cost(lay) {
  const at = []; lay.forEach((d, s) => { at[d] = s; });
  let c = 0;
  for (let i = 0; i < DEPTS.length; i++) for (let j = 0; j < DEPTS.length; j++) if (FLOW[i][j]) {
    const a = SLOTS[at[i]], b = SLOTS[at[j]]; c += FLOW[i][j] * (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) * PITCH;
  }
  return c;
}
function initLayout() {
  $("fe4L").addEventListener("click", (e) => {
    const g = e.target.closest("[data-slot]"); if (!g) return; const s = +g.dataset.slot;
    if (pick == null) pick = s; else { if (pick !== s) [LAY[pick], LAY[s]] = [LAY[s], LAY[pick]]; pick = null; $("fe4LMsg").textContent = ""; }
    drawLayout();
  });
  $("fe4LRst").addEventListener("click", () => { LAY = [...START]; pick = null; $("fe4LMsg").textContent = ""; drawLayout(); });
  $("fe4LImp").addEventListener("click", () => {
    const c0 = cost(LAY); let it = 0, better = true;
    while (better && it < 50) {       // steepest descent: try every pair, take the best swap, repeat
      better = false; let best = cost(LAY), bi = -1, bj = -1;
      for (let i = 0; i < LAY.length; i++) for (let j = i + 1; j < LAY.length; j++) { [LAY[i], LAY[j]] = [LAY[j], LAY[i]]; const c = cost(LAY); if (c < best - 1e-9) { best = c; bi = i; bj = j; } [LAY[i], LAY[j]] = [LAY[j], LAY[i]]; }
      if (bi >= 0) { [LAY[bi], LAY[bj]] = [LAY[bj], LAY[bi]]; better = true; it++; }
    }
    $("fe4LMsg").textContent = `${it} swaps: ${f1(c0, 0)} → ${f1(cost(LAY), 0)} load·m/day (−${f1((1 - cost(LAY) / c0) * 100, 0)} %). A local optimum – try another start.`;
    drawLayout();
  });
  drawLayout();
}
function drawLayout() {
  const at = []; LAY.forEach((d, s) => { at[d] = s; });
  const maxF = Math.max(...FLOW.flat());
  let lines = "", boxes = "";
  for (let i = 0; i < DEPTS.length; i++) for (let j = 0; j < DEPTS.length; j++) if (FLOW[i][j]) {
    const [x1, y1] = pos(at[i]), [x2, y2] = pos(at[j]);
    lines += `<line class="fe-fl" x1="${x1 + 50}" y1="${y1 + 45}" x2="${x2 + 50}" y2="${y2 + 45}" stroke-width="${1 + 7 * FLOW[i][j] / maxF}"><title>${esc(DEPTS[i])} → ${esc(DEPTS[j])}: ${FLOW[i][j]} loads/day</title></line>`;
  }
  LAY.forEach((d, s) => { const [x, y] = pos(s); boxes += `<g data-slot="${s}" class="fe-dep${pick === s ? " fe-msel" : ""}"><rect x="${x}" y="${y}" width="100" height="90" rx="8"/><text class="fe-mn" x="${x + 50}" y="${y + 50}" text-anchor="middle">${esc(DEPTS[d])}</text></g>`; });
  $("fe4L").innerHTML = `<text class="fe-tick" x="20" y="24">Slots 20 m apart (rectilinear distance). Line width = loads per day. ${pick != null ? "Now click the second department." : ""}</text>` + lines + boxes;
  const c = cost(LAY), c0 = cost(START);
  $("fe4LRes").innerHTML = `<p class="fe-big">Transport effort: <b>${f1(c, 0)}</b> load·m / day <span class="sub">(start layout ${f1(c0, 0)})</span></p>
    <p class="phd-eq">C = Σᵢ Σⱼ fᵢⱼ · dᵢⱼ ,  dᵢⱼ = (|xᵢ − xⱼ| + |yᵢ − yⱼ|) · 20 m</p>
    <p class="sub">${esc(DEPTS.length)} departments → ${f1(fact(DEPTS.length), 0)} possible layouts – too many to try all; pairwise exchange (the idea of CRAFT) swaps the pair that saves most until no swap helps.</p>
    <p class="am-note">Use it as a first step: the result ignores department sizes, building columns, utilities, noise / clean zones and safety distances. Big flows next to each other, receiving and shipping at the dock, heat treatment and grinding separated (dust / temperature).</p>`;
}
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

/* ================================================================== 4E generic FMS simulation */
let SP = clone(SIM0.parts);
function readSim() {
  const p = {}; ["m", "N", "L", "V", "load", "loadCv", "move", "mttf", "mttr", "days", "seed"].forEach((k) => { p[k] = +$("fe4S_" + k).value; });
  ["m", "N", "L", "V"].forEach((k) => { p[k] = Math.max(1, Math.round(p[k])); });
  p.rule = $("fe4S_rule").value; p.parts = SP.filter((r) => r[1] > 0 && r[2] > 0);
  return p;
}
// closed-loop DES: every pallet cycles load → move → machine → move → load
function simFMS(p, rec) {
  const R = rng(p.seed), T = p.days * 1440, warm = Math.min(T * 0.1, 2880), H = [];
  let seq = 0;
  const push = (t, k, d) => { H.push([t, seq++, k, d]); let i = H.length - 1; while (i > 0) { const j = (i - 1) >> 1; if (H[j][0] < H[i][0] || (H[j][0] === H[i][0] && H[j][1] < H[i][1])) break; [H[i], H[j]] = [H[j], H[i]]; i = j; } };
  const pop = () => { const top = H[0], last = H.pop(); if (H.length) { H[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let s = i; const lt = (a, b) => H[a][0] < H[b][0] || (H[a][0] === H[b][0] && H[a][1] < H[b][1]); if (l < H.length && lt(l, s)) s = l; if (r < H.length && lt(r, s)) s = r; if (s === i) break; [H[i], H[s]] = [H[s], H[i]]; i = s; } } return top; };
  const tot = p.parts.reduce((s, r) => s + r[1], 0);
  const pickType = () => { let x = R() * tot; for (let i = 0; i < p.parts.length; i++) { x -= p.parts[i][1]; if (x <= 0) return i; } return p.parts.length - 1; };
  const M = [...Array(p.m)].map(() => ({ busy: false, ttf: p.mttf > 0 ? expo(R, p.mttf) : Infinity }));
  let lFree = p.L, vFree = p.V, t = 0, last = 0;
  const loadQ = [], vehQ = [], machQ = [];
  const S = { lB: 0, vB: 0, mB: 0, mQ: 0, lQ: 0, down: 0, done: 0, byType: p.parts.map(() => 0), ct: 0, ctn: 0 };
  const G = rec ? { m: M.map(() => []), l: [...Array(p.L)].map(() => []), v: [...Array(p.V)].map(() => []), lUse: [...Array(p.L)].map(() => 0), vUse: [...Array(p.V)].map(() => 0) } : null;
  const acc = (tn) => { if (tn > warm) { const d = tn - Math.max(last, warm); if (d > 0) { S.lB += (p.L - lFree) * d; S.vB += (p.V - vFree) * d; S.mB += M.filter((x) => x.busy).length * d; S.mQ += machQ.length * d; S.lQ += loadQ.length * d; } } last = tn; };
  const slot = (arr, use) => { const i = use.findIndex((x) => x <= t); return i < 0 ? 0 : i; };
  function tryLoad() { while (lFree > 0 && loadQ.length) { const pal = loadQ.shift(); lFree--; pal.ty = pickType(); const d = logn(R, p.load, p.loadCv); if (G && t < 960) { const i = slot(G.l, G.lUse); G.l[i].push([t, t + d, "run"]); G.lUse[i] = t + d; } push(t + d, "loadDone", pal); } }
  function tryVeh() { while (vFree > 0 && vehQ.length) { const r = vehQ.shift(); vFree--; if (G && t < 960) { const i = slot(G.v, G.vUse); G.v[i].push([t, t + p.move, "run"]); G.vUse[i] = t + p.move; } push(t + p.move, "moveDone", r); } }
  function tryMach() {
    for (let k = 0; k < M.length && machQ.length; k++) {
      const mc = M[k]; if (mc.busy) continue;
      let qi = 0; if (p.rule === "SPT") machQ.forEach((x, i) => { if (p.parts[x.ty][2] < p.parts[machQ[qi].ty][2]) qi = i; });
      const pal = machQ.splice(qi, 1)[0], pt = p.parts[pal.ty], w = withFailures(R, mc, logn(R, pt[2], pt[3]), p.mttf, p.mttr);
      mc.busy = true; if (t > warm) S.down += w.down;
      if (G && t < 960) { let s = t; w.segs.forEach(([d, st]) => { G.m[k].push([s, s + d, st]); s += d; }); }
      push(t + w.dur, "machDone", { pal, k });
    }
  }
  for (let i = 0; i < p.N; i++) loadQ.push({ id: i, ty: 0, tl: null });
  tryLoad();
  while (H.length) {
    const [tn, , k, d] = pop(); if (tn > T) break; acc(tn); t = tn;
    if (k === "loadDone") { lFree++; if (d.tl != null && t > warm) { S.ct += t - d.tl; S.ctn++; } d.tl = t; vehQ.push({ pal: d, to: "M" }); tryVeh(); tryLoad(); }
    else if (k === "moveDone") { vFree++; if (d.to === "M") { machQ.push(d.pal); tryMach(); } else { loadQ.push(d.pal); tryLoad(); } tryVeh(); }
    else if (k === "machDone") { M[d.k].busy = false; if (t > warm) { S.done++; S.byType[d.pal.ty]++; } vehQ.push({ pal: d.pal, to: "L" }); tryVeh(); tryMach(); }
  }
  acc(T);
  const span = T - warm;
  return { th: S.done / span * 60, byType: S.byType.map((x) => x / span * 60), uM: S.mB / (p.m * span), dM: S.down / (p.m * span), uL: S.lB / (p.L * span), uV: S.vB / (p.V * span), mQ: S.mQ / span, lQ: S.lQ / span, ct: S.ctn ? S.ct / S.ctn : NaN, G };
}
function theory(p) {
  const tot = p.parts.reduce((s, r) => s + r[1], 0), tm = p.parts.reduce((s, r) => s + r[1] / tot * r[2], 0), A = p.mttf > 0 ? p.mttf / (p.mttf + p.mttr) : 1;
  const rates = [["machines", p.m / (tm / A)], ["load stations", p.L / p.load], ["vehicles", p.V / (2 * p.move)]];
  const bn = rates.reduce((a, b) => (b[1] < a[1] ? b : a)), T0 = p.load + 2 * p.move + tm / A, W0 = bn[1] * T0;
  return { tm, A, rates, bn, T0, W0, best: (n) => Math.min(n / T0, bn[1]) * 60, pwc: (n) => n / (W0 + n - 1) * bn[1] * 60 };
}
function initSim() {
  const drawParts = () => { $("fe4Parts").innerHTML = `<thead><tr><th>Part / pallet type</th><th>Mix %</th><th>Machining min</th><th>cv</th></tr></thead><tbody>${SP.map((r, i) => `<tr><td>${esc(r[0])}</td>${[1, 2, 3].map((k) => `<td><input type="number" step="any" data-pi="${i}" data-pk="${k}" value="${r[k]}"></td>`).join("")}</tr>`).join("")}</tbody>`; };
  $("fe4Parts").addEventListener("input", (e) => { const t = e.target; if (t.dataset.pi) SP[+t.dataset.pi][+t.dataset.pk] = +t.value || 0; });
  $("fe4SRun").addEventListener("click", runSim);
  $("fe4SSw").addEventListener("click", sweep);
  $("fe4SRst").addEventListener("click", () => { ["m", "N", "L", "V", "load", "loadCv", "move", "mttf", "mttr", "days", "seed"].forEach((k) => { $("fe4S_" + k).value = SIM0[k]; }); $("fe4S_rule").value = SIM0.rule; SP = clone(SIM0.parts); drawParts(); runSim(); sweep(); });
  drawParts(); runSim(); sweep();
}
function runSim() {
  const p = readSim(); if (!p.parts.length) { $("fe4SRes").innerHTML = '<p class="fe-no">Enter at least one part type.</p>'; return; }
  const r = simFMS(p, true), th = theory(p);
  $("fe4SRes").innerHTML = `<div class="phd-kpis">${[["Throughput", f1(r.th, 2) + " pallets/h"], ["Machine utilisation", f1(r.uM * 100, 0) + " %"], ["…of it breakdown", f1(r.dM * 100, 1) + " %"], ["Load station", f1(r.uL * 100, 0) + " %"], ["Vehicle", f1(r.uV * 100, 0) + " %"], ["Pallet loop time", f1(r.ct, 0) + " min"], ["Queue at machines", f1(r.mQ, 1) + " pallets"], ["Queue at load station", f1(r.lQ, 1) + " pallets"]].map(([a, b]) => `<div class="phd-kpi"><b>${b}</b><span>${a}</span></div>`).join("")}</div>
    <p class="sub">By type (pallets/h): ${p.parts.map((x, i) => `${esc(x[0].split(" (")[0])} ${f1(r.byType[i], 2)}`).join(" · ")} · Little check: N = TH × loop time = ${f1(r.th / 60 * r.ct, 1)} ≈ ${p.N} ✓ · theoretical bottleneck: <b>${th.bn[0]}</b> (${f1(th.bn[1] * 60, 2)} pallets/h)</p>`;
  drawGantt(r.G, p);
}
function drawGantt(G, p) {
  const rows = [...G.m.map((s, i) => [`Machine ${i + 1}`, s]), ...G.l.map((s, i) => [`Load station ${i + 1}`, s]), ...G.v.map((s, i) => [`Vehicle ${i + 1}`, s])];
  const W = 640, x0 = 100, x1 = W - 10, rh = 20, Hh = 30 + rows.length * rh, X = (t) => x0 + Math.min(t, 960) / 960 * (x1 - x0);
  let s = "";
  for (let h = 0; h <= 16; h += 2) s += `<line class="fe-grid" x1="${X(h * 60)}" x2="${X(h * 60)}" y1="12" y2="${Hh - 10}"/><text class="fe-tick" x="${X(h * 60)}" y="10" text-anchor="middle">${h} h</text>`;
  rows.forEach(([n, segs], i) => { const y = 16 + i * rh; s += `<text class="fe-tick" x="${x0 - 6}" y="${y + 13}" text-anchor="end">${n}</text>`; segs.forEach(([a, b, st]) => { if (a < 960) s += `<rect class="fe-g-${st}" x="${X(a)}" y="${y + 2}" width="${Math.max(0.6, X(b) - X(a))}" height="${rh - 6}"/>`; }); });
  $("fe4G").setAttribute("viewBox", `0 0 ${W} ${Hh}`);
  $("fe4G").innerHTML = s + `<text class="fe-tick" x="${x0}" y="${Hh - 1}">First 16 h: blue = working, red = breakdown, empty = waiting (no pallet / no space)</text>`;
}
function sweep() {
  const p = readSim(); if (!p.parts.length) return;
  const nMax = Math.max(p.m * 3 + 6, p.N + 4), xs = [...Array(nMax).keys()].map((i) => i + 1), th = theory(p);
  const sim = xs.map((n) => simFMS({ ...p, N: n, days: Math.min(p.days, 14) }, false).th);
  const top = Math.max(...sim), n95 = xs.find((n, i) => sim[i] >= 0.95 * top);
  $("fe4SwLg").innerHTML = lineChart($("fe4Sw"), { xs, xl: "Pallets in the system N", yl: "Throughput [pallets/h]", mark: p.N, ymax: th.best(nMax) * 1.1,
    series: [{ n: "Simulated", y: sim, cls: "fe-s1", dots: true }, { n: "Best case min(N ÷ T₀, r_b)", y: xs.map(th.best), cls: "fe-s4" }, { n: "Practical worst case", y: xs.map(th.pwc), cls: "fe-s2" }] });
  $("fe4SwRes").innerHTML = `<table class="am-kv"><tbody>
      <tr><td>Bottleneck rate r_b</td><td><b>${f1(th.bn[1] * 60, 2)} pallets/h</b> (${th.bn[0]}) <span class="sub">${th.rates.map(([n, r]) => `${n} ${f1(r * 60, 2)}`).join(" · ")}</span></td></tr>
      <tr><td>Raw loop time T₀ = load + 2 moves + machining ÷ A</td><td>${f1(th.T0, 1)} min</td></tr>
      <tr><td>Critical WIP W₀ = r_b × T₀</td><td><b>${f1(th.W0, 1)} pallets</b></td></tr>
      <tr><td>Pallets for 95 % of max. simulated output</td><td><b>${n95}</b> (your setting: ${p.N})</td></tr></tbody></table>
    <p class="phd-eq">best: TH = min(N/T₀, r_b) · practical worst case: TH = N/(W₀ + N − 1) · r_b</p>
    <p class="am-note">Below W₀ the machines wait for pallets; above it extra pallets only add waiting time (Little: loop time = N ÷ TH).
      A real FMS needs more than W₀ because of variability and breakdowns – the simulation shows how many. Next steps: vary machines, load stations and vehicles and see which resource becomes the bottleneck.</p>`;
}
