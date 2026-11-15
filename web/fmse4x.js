/* FMS engineering – item 4, deep sections 4F–4M (loaded by fmse4.js at the end of item 4).
 * 4F loss analysis & reliability (stop log → MTBF / MTTR / A_inherent, Pareto, TPM / SMED, OEE time model, system OEE, PackML → loss)
 * 4G exact queues (M/M/1, M/M/m Erlang C, servers m = 1 … 6, Erlang C vs Sakasegawa) · 4H variability sources (set-ups / lot size,
 * departure variability in a line, short vs long stops) · 4I closed systems & MVA (Seidmann) with DES sweep + confidence intervals
 * 4J simulation output analysis (replications, Welch warm-up, paired comparison with common random numbers, run length)
 * 4K Systematic Layout Planning (AEIOUX, SLP score, relationship diagram, space, aisles) · 4L layout patterns & detailed rules
 * 4M simulation project (VDI 3633 checklist, data templates, V&V, software buy list).
 * Example numbers: EX4 in fmse4x_data.js = copy of tools/fmse/examples/item4_examples.json (same formulas as guide docs/64 and tools/fmse/*.py).
 * The simulations reuse simFMS() of fmse4.js (item 4E model, unchanged). Offline; user edits in localStorage keys "fmse.4x.*".
 * Test hook: window.fe4x.results(). */
import { EX4, T975, SETUP_RA, LINE0, COUNTER, COUNTER_TYPE, PACKML, USES4, PATTERNS, RULES, VDI, TEMPLATES, VV, SOFTWARE } from "./fmse4x_data.js";
import { simFMS, theory } from "./fmse4.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const rnd = (x, d = 4) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const store = {   // own keys "fmse.4x.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.4x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.4x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.4x." + k); } catch (e) { /* storage blocked */ } },
};
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;   // items are trusted HTML written in this file
const ok = (b, y, n) => (b ? `<span class="fe-ok">✓ ${y}</span>` : `<span class="fe-no">✗ ${n}</span>`);
const wx = (title, steps) => `<details class="fx-more f4-wx"><summary><b>Worked example</b> – ${title}</summary><ol class="fx-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ol></details>`;
const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const kv = (rows) => `<table class="am-kv f4-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
const kpis = (a) => `<div class="phd-kpis">${a.map(([n, v]) => `<div class="phd-kpi"><b>${v}</b><span>${n}</span></div>`).join("")}</div>`;
const tq = (df) => { if (T975[df]) return T975[df]; const ks = Object.keys(T975).map(Number).sort((a, b) => a - b); let k = ks[0]; ks.forEach((x) => { if (x <= df) k = x; }); return T975[k]; };
const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

/* common guide block: principle text, use cases, real-project bullets (static text written in this file / data file) */
function guide({ principle, uses, howto }) {
  return `<div class="fx-guide">
    <div class="fx-prin"><h3 class="fe-h3">Principle</h3>${principle}</div>
    <details class="fx-more"><summary><b>Use cases</b> <span class="sub">different domains</span></summary>
      <div class="fx-uses">${uses.map(([d, t]) => `<div class="fx-use"><b>${esc(d)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>
    <details class="fx-more"><summary><b>How to use it in a real project</b></summary>${ul(howto)}</details></div>`;
}

/* ------------------------------------------------------------------ generic SVG x-y chart: lines, dots, error bars, bars */
function chart(svg, { series, xmin, xmax, ymin = 0, ymax, xl, yl, vmarks = [], hmarks = [], W = 680, H = 320, xfmt, yfmt }) {
  const x0 = 64, x1 = W - 16, y0 = H - 42, y1 = 14;
  const X = (v) => x0 + (v - xmin) / (xmax - xmin || 1) * (x1 - x0);
  const Y = (v) => y0 - (Math.min(Math.max(v, ymin), ymax) - ymin) / (ymax - ymin || 1) * (y0 - y1);
  const ticks = (lo, hi) => {
    const raw = (hi - lo) / 6, p = 10 ** Math.floor(Math.log10(raw || 1)), st = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || p;
    const a = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) a.push(+v.toFixed(10)); return a;
  };
  const kfmt = (v) => (Math.abs(v) >= 1e4 ? fx(v / 1e3, 0) + "k" : fx(v, Math.abs(v) < 10 && v % 1 ? (Math.abs(v * 10) % 1 ? 2 : 1) : 0));
  let s = "";
  ticks(ymin, ymax).forEach((v) => { const y = Y(v); s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${(yfmt || kfmt)(v)}</text>`; });
  ticks(xmin, xmax).forEach((v) => { const x = X(v); s += `<line class="fe-grid" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${x}" y="${y0 + 15}" text-anchor="middle">${(xfmt || kfmt)(v)}</text>`; });
  hmarks.forEach(([v, cls, lab, above]) => { const y = Y(v); s += `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>${lab ? `<text class="fe-tick" x="${x1 - 4}" y="${above ? y - 5 : y + 13}" text-anchor="end">${esc(lab)}</text>` : ""}`; });
  vmarks.forEach(([v, cls, lab]) => { const x = X(v); s += `<line class="${cls}" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/>${lab ? `<text class="fe-tick" x="${x + 4}" y="${y1 + 10}">${esc(lab)}</text>` : ""}`; });
  series.forEach((sr) => {
    const raw = sr.pts.map((p, i) => [p[0], p[1], sr.err ? sr.err[i] : 0]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    if (sr.bars) { const bw = (x1 - x0) / (xmax - xmin + 1) * 0.7; raw.forEach(([a, b]) => { s += `<rect class="f4-bar ${sr.cls}" x="${(X(a) - bw / 2).toFixed(1)}" y="${Y(b).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, Y(ymin) - Y(b)).toFixed(1)}"/>`; }); return; }
    if (sr.err) raw.forEach(([a, b, e]) => { if (e > 0) { const x = X(a).toFixed(1); s += `<line class="f4-err" x1="${x}" x2="${x}" y1="${Y(b - e).toFixed(1)}" y2="${Y(b + e).toFixed(1)}"/><line class="f4-err" x1="${X(a) - 4}" x2="${X(a) + 4}" y1="${Y(b + e).toFixed(1)}" y2="${Y(b + e).toFixed(1)}"/><line class="f4-err" x1="${X(a) - 4}" x2="${X(a) + 4}" y1="${Y(b - e).toFixed(1)}" y2="${Y(b - e).toFixed(1)}"/>`; } });
    const pts = raw.map(([a, b]) => [X(a), Y(b)]);
    if (!sr.noline && pts.length > 1) s += `<polyline class="f4-ln ${sr.cls}" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
    if (sr.dots) pts.forEach(([a, b]) => { s += `<circle class="f4-dot ${sr.cls}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${sr.r || 3.2}"/>`; });
  });
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text><text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  return series.filter((sr) => sr.n).map((sr) => `<span class="fx-lg"><i class="f4-lg ${sr.cls}${sr.bars ? " f4-lgb" : ""}"></i>${esc(sr.n)}</span>`).join(" ");
}

/* ================================================================== pure formulas (exactly as EX4._formulas) – used by programs AND results() */
function fStops(events, prodH) {
  const fl = events.filter((e) => e[0] === "failure"), sumF = fl.reduce((a, e) => a + e[1], 0), n = fl.length;
  const mttr = n ? sumF / n : NaN, mtbf = n ? (prodH * 60 - sumF) / n : NaN, A = mtbf / (mtbf + mttr);
  const byType = { failure: 0, minor: 0, setup: 0 }; events.forEach((e) => { byType[e[0]] = (byType[e[0]] || 0) + e[1]; });
  const map = new Map(); events.forEach(([t, d, r]) => { const k = String(r || "(no reason)"); if (!map.has(k)) map.set(k, { reason: k, min: 0, n: 0, types: new Set() }); const o = map.get(k); o.min += d; o.n++; o.types.add(t); });
  const tot = events.reduce((a, e) => a + e[1], 0); let cum = 0;
  const pareto = [...map.values()].sort((a, b) => b.min - a.min).map((o) => { cum += o.min; return { reason: o.reason, min: o.min, n: o.n, type: [...o.types].join("/"), share: o.min / tot, cum: cum / tot }; });
  return { n, sumF, mttr, mtbf, A, byType, tot, pareto };
}
function fOEE(v) {
  const run = v.plan - v.down - v.setup, net = v.ideal * v.total, speed = Math.max(0, run - net - v.minor), qual = v.ideal * (v.total - v.good), full = net - qual;
  const A = run / v.plan, P = net / run, Q = v.good / v.total, oee = A * P * Q;
  return { run, net, speed, qual, full, A, P, Q, oee, teep: oee * v.plan / v.cal, unplanned: v.cal - v.plan };
}
function fMM1(lph, te) { const mu = 60 / te, rho = lph / mu; if (!(rho < 1)) return { rho, mu, stable: false }; const Lq = rho * rho / (1 - rho), Wq = Lq / lph, W = Wq + 1 / mu; return { rho, mu, stable: true, Lq, Wq: Wq * 60, W: W * 60, L: lph * W }; }
function fMMm(lph, te, m) {
  const mu = 60 / te, a = lph / mu, rho = a / m;
  if (!(rho < 1)) return { a, rho, mu, m, stable: false };
  let s = 0; for (let k = 0; k < m; k++) s += a ** k / fact(k);
  const tail = a ** m / (fact(m) * (1 - rho)), P0 = 1 / (s + tail), C = tail * P0, Lq = C * rho / (1 - rho), Wq = Lq / lph, W = Wq + 1 / mu;
  return { a, rho, mu, m, stable: true, P0, C, Lq, Wq: Wq * 60, W: W * 60, L: lph * W };
}
const fSak = (u, m, ca2, ce2, te) => (u < 1 ? ((ca2 + ce2) / 2) * (u ** (Math.sqrt(2 * (m + 1)) - 1) / (m * (1 - u))) * te : NaN);
function fSetup(sv, Ns) { const te = sv.t0 + sv.ts / Ns, s2 = sv.sigma0 ** 2 + sv.sigma_s ** 2 / Ns + (Ns - 1) / Ns ** 2 * sv.ts ** 2; return { Ns, te, s2, ce2: s2 / te ** 2 }; }
function fBreak(t0, c0, mttf, mttr, cr) { const A = mttf / (mttf + mttr), te = t0 / A; return { A, te, ce2: c0 * c0 + (1 + cr * cr) * A * (1 - A) * mttr / t0 }; }
function fLine(raH, ca2, st) {   // single-server stations in series, Kingman + linking equation c_d² = u²c_e² + (1 − u²)c_a²
  let c = ca2; const ra = raH / 60;
  const rows = st.map(([n, te, ce2]) => { const u = ra * te, wq = fSak(u, 1, c, ce2, te), cd2 = u * u * ce2 + (1 - u * u) * c; const r = { n, te, ce2, ca2: c, u, wq, ct: wq + te, cd2 }; c = cd2; return r; });
  return { rows, ct: rows.reduce((a, r) => a + r.ct, 0), ok: rows.every((r) => r.u < 1) };
}
function fLaws(st) {   // st: [name, servers, D]
  const rates = st.map(([, m, D]) => m / D), rb = Math.min(...rates), T0 = st.reduce((a, s) => a + s[2], 0), W0 = rb * T0, bi = rates.indexOf(rb);
  return { rb, T0, W0, bn: st[bi] ? st[bi][0] : "", best: (N) => Math.min(N / T0, rb), pwc: (N) => N / (W0 + N - 1) * rb, worst: () => 1 / T0 };
}
function fMVA(st, Nmax) {
  const q = st.map(([, m, D]) => D / m), dl = st.map(([, m, D]) => D * (m - 1) / m);
  let Q = st.map(() => 0); const rows = [];
  for (let n = 1; n <= Nmax; n++) {
    const Rk = q.map((d, k) => d * (1 + Q[k])), loop = Rk.reduce((a, b) => a + b, 0) + dl.reduce((a, b) => a + b, 0), X = n / loop;
    Q = Rk.map((r) => X * r);
    rows.push({ n, R: Rk.map((r, k) => r + dl[k]), Rq: Rk, X, Xh: X * 60, Q: Q.map((x, k) => x + X * dl[k]), loop });
  }
  return rows;
}
const RATING = { A: 16, E: 8, I: 4, O: 2, U: 0, X: -64 };
const LY = EX4.layout, ND = LY.depts.length;
function layCost(lay) { const at = []; lay.forEach((d, s) => { at[d] = s; }); let c = 0; for (let i = 0; i < ND; i++) for (let j = 0; j < ND; j++) if (LY.flow[i][j]) { const a = LY.slots[at[i]], b = LY.slots[at[j]]; c += LY.flow[i][j] * (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])) * LY.pitch_m; } return c; }
function layScore(lay, rel) { const at = []; lay.forEach((d, s) => { at[d] = s; }); let sc = 0; const pairs = []; for (let i = 0; i < ND; i++) for (let j = i + 1; j < ND; j++) { const a = LY.slots[at[i]], b = LY.slots[at[j]]; if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) { const r = rel[i + "-" + j] || "U"; sc += RATING[r]; pairs.push([i, j, r]); } } return { score: sc, pairs }; }
function pairwise(start, f) {   // steepest descent on f (smaller = better); returns layout and swaps
  const lay = [...start]; let it = 0;
  for (;;) {
    let best = f(lay), bi = -1, bj = -1;
    for (let i = 0; i < lay.length; i++) for (let j = i + 1; j < lay.length; j++) { [lay[i], lay[j]] = [lay[j], lay[i]]; const c = f(lay); if (c < best - 1e-9) { best = c; bi = i; bj = j; } [lay[i], lay[j]] = [lay[j], lay[i]]; }
    if (bi < 0 || it > 60) break; [lay[bi], lay[bj]] = [lay[bj], lay[bi]]; it++;
  }
  return { lay, it };
}
const fSpace = (rows, share) => { const r = rows.map(([n, m, f, o, a]) => ({ n, m, f, o, a, area: m * (f + o) * (1 + a) })), sum = r.reduce((s, x) => s + x.area, 0); return { rows: r, sum, aisles: sum * share, total: sum * (1 + share), totalGross: share < 1 ? sum / (1 - share) : NaN }; };
function fAisle(a) { const w = Math.max(a.forklift_w, a.load_w); return { w, one: w + 2 * a.c, two: 2 * w + 3 * a.c, agvOne: a.agv_w + 2 * a.c, agvTwo: 2 * a.agv_w + 3 * a.c, agvOneP: a.agv_w + 2 * a.c + 2 * a.agv_people_clearance, agvTwoP: 2 * a.agv_w + 3 * a.c + 2 * a.agv_people_clearance }; }
function stats(xs, t) { const n = xs.length, mean = xs.reduce((a, b) => a + b, 0) / n, s = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0, tt = t || tq(n - 1), hw = n > 1 ? tt * s / Math.sqrt(n) : NaN; return { n, mean, s, t: tt, hw, lo: mean - hw, hi: mean + hw }; }
const simBase = () => { const p = clone(EX4.fms_sim); return { m: p.m, N: p.N, L: p.L, V: p.V, load: p.load, loadCv: p.loadCv, move: p.move, mttf: p.mttf, mttr: p.mttr, days: p.days, rule: p.rule, parts: p.parts, seed: 1 }; };

/* ================================================================== mount */
const R = {};   // latest key results of every section (read by tests)
const results = () => clone(R);
export function mount(el) {
  el.innerHTML = [html4F(), html4G(), html4H(), html4I(), html4J(), html4K(), html4L(), html4M()].join("");
  const it = [init4F, init4G, init4H, init4I, init4J, init4K, init4L, init4M];
  it.forEach((f) => { try { f(); } catch (e) { console.error("fmse4x " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  window.fe4x = { results, R };   // for tests / cross-checks: window.fe4x.results()
  setTimeout(() => runDesSweep(), 300);       // simulations: small setTimeout chains, UI stays responsive
}

/* ================================================================== 4F loss analysis & reliability */
function html4F() {
  const F = EX4._formulas;
  return card("f44F", "4F · Loss analysis &amp; reliability – stop log → MTBF, MTTR, availability, Pareto, countermeasures", "edit the stop log · same OEE inputs as 4A · PackML states → losses",
    guide({
      principle: `<p>Every stop of a machine is written into a <b>stop log</b>: type (failure = breakdown, minor stop, set-up), duration and reason. From the failures you get the two
        reliability numbers of maintenance: <b>MTTR</b> (mean time to repair – how long a breakdown lasts) and <b>MTBF</b> (mean time between failures – how long the machine runs between two
        breakdowns). Together they give the <b>inherent availability</b> – the share of time the machine is not broken.</p>
        <p class="phd-eq">MTTR = Σ failure durations ÷ number of failures<br>MTBF = (production time − Σ failure durations) ÷ number of failures<br>A_inherent = MTBF ÷ (MTBF + MTTR)</p>
        <p>The <b>Pareto chart</b> sorts all stop minutes by reason (largest first). In nearly every plant 3–4 reasons give 60–80 % of the lost time – work on these first.
        Each loss type has its standard method: breakdowns → <b>TPM</b> (total productive maintenance: autonomous + planned maintenance, focused improvement), set-ups → <b>SMED</b>
        (single-minute exchange of die: move work from internal = machine stopped to external = machine running), minor stops → small-stop analysis and poka-yoke.</p>
        <p class="sub">Formula (shared with guide + tools): ${esc(F.mtbf_mttr)}</p>`,
      uses: USES4.F,
      howto: ["Record stops automatically from the machine (PLC / CNC state, PackML state, OPC UA / MTConnect) – manual logs miss the short stops.",
        "Agree reason codes (max. 20–30, in a tree: type → group → reason) with production and maintenance before the start of production.",
        "Weekly: Pareto of the last 4 weeks, top 3 reasons get an owner and a countermeasure (A3 / 8D); track MTBF and MTTR per machine as trend.",
        "MTTR is reduced by spare parts, diagnostics and training; MTBF by maintenance and design changes – use both numbers to set the maintenance strategy.",
        "Use the measured MTBF / MTTR as breakdown input for the simulation (4E, 4J) and for the queueing models (4B, 4H)."],
    }) + `
    <div class="fe-row"><label>Production time of the log <input type="number" step="any" id="f4StH" value="${EX4.stop_log.production_time_h}"> h</label>
      <button class="mx-el" id="f4StAdd">+ Add stop</button><button class="mx-el" id="f4StRst">Reset to example</button><button class="mx-el" id="f4StCsv">Export CSV</button></div>
    <div class="grid2 eq"><div><div class="fe-scroll f4-logwrap"><table class="am-tab fe-calc f4-log" id="f4StTab"></table></div></div>
      <div><div id="f4StKpi"></div><svg id="f4Par" class="fe-chart" role="img" aria-label="Pareto chart of stop minutes by reason"></svg><div class="sub" id="f4ParLg"></div></div></div>
    <h3 class="fe-h3">Countermeasure per loss (sorted by stop minutes)</h3><div id="f4Cm"></div>
    <div id="f4StWx"></div>
    <h3 class="fe-h3">OEE time model – where the calendar time goes (inputs of 4A above)</h3>
    <div class="fx-prin"><p>The OEE time model cuts the calendar time step by step: <b>planned</b> time (shifts with orders) → <b>run</b> time (minus breakdowns and set-ups = availability loss)
      → <b>net run</b> time (minus minor stops and slow running = performance loss) → <b>fully productive</b> time (minus scrap and rework = quality loss).
      OEE = fully productive ÷ planned; TEEP = fully productive ÷ calendar. Change any number in 4A and the diagram follows.</p></div>
    <svg id="f4Tm" class="fe-chart" role="img" aria-label="OEE time model from calendar to fully productive time"></svg><div id="f4TmRes"></div>
    <h3 class="fe-h3">System OEE versus machine OEE</h3>
    <div class="fx-prin"><p>Machine OEE looks at one machine. <b>System OEE</b> looks at the output of the whole line or FMS: good parts of the system × ideal cycle time of the <b>bottleneck</b> ÷ planned time.
      It is <b>not</b> the average of the machine OEEs. In a rigid line without buffers every stop of any machine stops the whole line, so the availabilities multiply
      (system ≈ product of the machine values). With large buffers or a pallet pool (FMS) the machines are decoupled and the system OEE approaches the OEE of the bottleneck.
      Losses caused by starving (no pallet) or blocking (no place) are <b>system losses</b>: they do not reduce the machine OEE (PackML state Suspended) but they reduce the system output.</p></div>
    <div class="fe-row fe-calc"><label>Machines in series <input type="number" id="f4SoN" value="3" min="1" step="1"></label><label>Machine OEE (each) <input type="number" id="f4SoO" value="0.80" step="0.01"></label></div>
    <div id="f4SoRes"></div>
    <h3 class="fe-h3">PackML state → loss category (machine data → OEE automatically)</h3>
    <p class="sub">PackML (ISA-TR88.00.02) gives every machine the same state model. If the PLC reports the state (and a stop reason), the MES can compute OEE without manual logs.
      The mapping below is a common convention – fix your own mapping once in the MES and use it for all machines.</p>
    ${tab(["PackML state", "Loss category", "Meaning / rule", "Unit mode"], PACKML.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`))}`);
}
let LOG = null;
function init4F() {
  LOG = store.get("stoplog", null) || clone(EX4.stop_log.events);
  $("f4StH").value = store.get("stoph", EX4.stop_log.production_time_h);
  const save = () => { store.set("stoplog", LOG); store.set("stoph", num($("f4StH").value)); };
  $("f4StTab").addEventListener("input", (e) => { const t = e.target, i = +t.dataset.i, k = +t.dataset.k; if (!Number.isFinite(i)) return; LOG[i][k] = k === 1 ? Math.max(0, num(t.value)) : t.value; save(); calc4F(); });
  $("f4StTab").addEventListener("change", (e) => { if (e.target.tagName === "SELECT") { LOG[+e.target.dataset.i][0] = e.target.value; save(); calc4F(); } });
  $("f4StTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b) { LOG.splice(+b.dataset.del, 1); save(); draw4FTab(); calc4F(); } });
  $("f4StAdd").addEventListener("click", () => { LOG.push(["failure", 10, "New reason"]); save(); draw4FTab(); calc4F(); });
  $("f4StRst").addEventListener("click", () => { LOG = clone(EX4.stop_log.events); $("f4StH").value = EX4.stop_log.production_time_h; store.del("stoplog"); store.del("stoph"); draw4FTab(); calc4F(); });
  $("f4StCsv").addEventListener("click", () => download("stop_log.csv", toCSV([["type", "minutes", "reason"], ...LOG]), "text/csv"));
  $("f4StH").addEventListener("input", () => { save(); calc4F(); });
  ["f4SoN", "f4SoO"].forEach((id) => $(id).addEventListener("input", drawSysOEE));
  Object.keys(EX4.oee).forEach((k) => { const x = $("fe4O_" + k); if (x) x.addEventListener("input", drawTimeModel); });
  draw4FTab(); calc4F(); drawTimeModel(); drawSysOEE();
  // reference numbers of the shared example (independent of user edits)
  const ex = fStops(EX4.stop_log.events, EX4.stop_log.production_time_h);
  R.stops_example = { failures: ex.n, sum_failure_min: ex.sumF, MTTR_min: rnd(ex.mttr), MTBF_min: rnd(ex.mtbf), A_inherent: rnd(ex.A, 6), total_stop_min: ex.tot, by_type: ex.byType, pareto: ex.pareto.map((p) => [p.reason, p.min, rnd(p.cum, 4)]) };
}
function draw4FTab() {
  $("f4StTab").innerHTML = `<thead><tr><th>#</th><th>Type</th><th>min</th><th>Reason</th><th></th></tr></thead><tbody>${LOG.map((e, i) => `<tr><td>${i + 1}</td>
    <td><select data-i="${i}">${["failure", "minor", "setup"].map((t) => `<option${t === e[0] ? " selected" : ""}>${t}</option>`).join("")}</select></td>
    <td><input type="number" step="any" data-i="${i}" data-k="1" value="${e[1]}"></td><td><input type="text" class="f4-wn" data-i="${i}" data-k="2" value="${esc(e[2])}"></td>
    <td><button class="mx-el fx-x" data-del="${i}" title="Delete row">×</button></td></tr>`).join("")}</tbody>`;
}
function counter(reason, type) { const c = COUNTER.find(([re]) => re.test(reason)); return c ? c.slice(1) : COUNTER_TYPE[type.split("/")[0]] || COUNTER_TYPE.failure; }
function calc4F() {
  const H = num($("f4StH").value), r = fStops(LOG, H);
  R.stops = { failures: r.n, MTTR_min: rnd(r.mttr), MTBF_min: rnd(r.mtbf), A_inherent: rnd(r.A, 6), top3: r.pareto.slice(0, 3).map((p) => [p.reason, p.min]) };
  $("f4StKpi").innerHTML = kpis([["Failures", r.n], ["MTTR", fx(r.mttr, 1) + " min"], ["MTBF", fx(r.mtbf, 0) + " min"], ["A_inherent", fx(r.A * 100, 2) + " %"]]) +
    `<p class="sub">Stop minutes: failures ${fx(r.byType.failure, 0)} · minor ${fx(r.byType.minor, 0)} · set-up ${fx(r.byType.setup, 0)} · total ${fx(r.tot, 0)} min = ${fx(r.tot / (H * 60) * 100, 1)} % of the production time.</p>`;
  // Pareto chart: bars (minutes) + cumulative % line (right scale drawn as 0–100 % on the same height)
  const P = r.pareto, svg = $("f4Par"), W = 680, Hh = 330, x0 = 54, x1 = W - 44, y0 = 230, y1 = 14, n = Math.max(1, P.length), bw = (x1 - x0) / n, mx = Math.max(1, ...P.map((p) => p.min));
  const Y = (v) => y0 - v / mx * (y0 - y1), Yc = (c) => y0 - c * (y0 - y1);
  let s = "";
  [0, 0.25, 0.5, 0.75, 1].forEach((k) => { s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${Yc(k)}" y2="${Yc(k)}"/><text class="fe-tick" x="${x0 - 6}" y="${Yc(k) + 4}" text-anchor="end">${fx(mx * k, 0)}</text><text class="fe-tick" x="${x1 + 6}" y="${Yc(k) + 4}">${k * 100} %</text>`; });
  s += `<line class="f4-l80" x1="${x0}" x2="${x1}" y1="${Yc(0.8)}" y2="${Yc(0.8)}"/>`;
  P.forEach((p, i) => { const x = x0 + i * bw; s += `<rect class="f4-pb f4-t${p.type.split("/")[0]}" x="${x + 3}" y="${Y(p.min)}" width="${Math.max(2, bw - 6)}" height="${y0 - Y(p.min)}"><title>${esc(p.reason)}: ${p.min} min</title></rect><text class="fe-tick" x="${x + bw / 2}" y="${Y(p.min) - 3}" text-anchor="middle">${p.min}</text>
    <text class="f4-rot" transform="translate(${x + bw / 2 + 3} ${y0 + 8}) rotate(50)">${esc(p.reason.length > 24 ? p.reason.slice(0, 23) + "…" : p.reason)}</text>`; });
  s += `<polyline class="f4-cum" points="${P.map((p, i) => `${(x0 + (i + 0.5) * bw).toFixed(1)},${Yc(p.cum).toFixed(1)}`).join(" ")}"/>` + P.map((p, i) => `<circle class="f4-cumd" cx="${(x0 + (i + 0.5) * bw).toFixed(1)}" cy="${Yc(p.cum).toFixed(1)}" r="3"/>`).join("");
  s += `<text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">Stop minutes</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${Hh}`); svg.innerHTML = s;
  $("f4ParLg").innerHTML = `<span class="fx-lg"><i class="f4-lgb f4-tfailure"></i>failure</span><span class="fx-lg"><i class="f4-lgb f4-tminor"></i>minor stop</span><span class="fx-lg"><i class="f4-lgb f4-tsetup"></i>set-up</span><span class="fx-lg"><i class="f4-lg f4-s2"></i>cumulative %</span>`;
  $("f4Cm").innerHTML = tab(["Reason", "Type", "Stops", "Minutes", "Share", "Cum.", "Loss", "Method", "Countermeasure (example)"], P.map((p) => { const [loss, meth, act] = counter(p.reason, p.type); return `<tr${p.cum - p.share < 0.8 ? ' class="f4-top"' : ""}><td><b>${esc(p.reason)}</b></td><td>${esc(p.type)}</td><td>${p.n}</td><td>${fx(p.min, 0)}</td><td>${fx(p.share * 100, 1)} %</td><td>${fx(p.cum * 100, 1)} %</td><td>${esc(loss)}</td><td>${esc(meth)}</td><td class="f4-wide">${esc(act)}</td></tr>`; }), "f4-cmt") +
    `<p class="sub">Marked rows = the reasons that make the first 80 % of the stop minutes (cut with the cumulative share <b>before</b> the reason, as in 2F).</p>`;
  const top = P.slice(0, 3);
  $("f4StWx").innerHTML = wx("MTBF, MTTR and availability of the example log", [
    `Failures in the log: ${r.n} with durations ${LOG.filter((e) => e[0] === "failure").map((e) => e[1]).join(" + ")} = <b>${fx(r.sumF, 0)} min</b>.`,
    `MTTR = ${fx(r.sumF, 0)} ÷ ${r.n} = <b>${fx(r.mttr, 2)} min</b>.`,
    `Production time ${fx(H, 0)} h = ${fx(H * 60, 0)} min. MTBF = (${fx(H * 60, 0)} − ${fx(r.sumF, 0)}) ÷ ${r.n} = <b>${fx(r.mtbf, 2)} min</b> (≈ ${fx(r.mtbf / 60, 1)} h).`,
    `A_inherent = ${fx(r.mtbf, 2)} ÷ (${fx(r.mtbf, 2)} + ${fx(r.mttr, 2)}) = <b>${fx(r.A * 100, 2)} %</b>. Note: minor stops and set-ups are not in A_inherent – they appear in OEE (A and P).`,
    `Pareto: ${top.map((p) => `${esc(p.reason)} ${p.min} min`).join(", ")} = ${fx(top.length ? top[top.length - 1].cum * 100 : 0, 1)} % of all ${fx(r.tot, 0)} stop minutes → these three get an owner and a countermeasure first.`,
    `If the hydraulic clamp leak (120 min) is solved, MTBF rises to (${fx(H * 60, 0)} − ${fx(r.sumF - 120, 0)}) ÷ ${r.n - 1} = ${fx((H * 60 - r.sumF + 120) / (r.n - 1), 0)} min and MTTR falls to ${fx((r.sumF - 120) / (r.n - 1), 1)} min.`]);
}
function drawTimeModel() {
  const v = {}; Object.keys(EX4.oee).forEach((k) => { const x = $("fe4O_" + k); v[k] = Math.max(0, x ? num(x.value, EX4.oee[k]) : EX4.oee[k]); });
  const o = fOEE(v), W = 680, Hh = 250, x0 = 130, x1 = W - 12, X = (t) => (t / v.cal) * (x1 - x0);
  const rows = [["Calendar", v.cal, []], ["Planned", v.plan, [["not planned", o.unplanned, "f4-tmn"]]], ["Run", o.run, [["breakdowns", v.down, "f4-tma"], ["set-ups", v.setup, "f4-tma"]]],
    ["Net run", o.net, [["minor stops", v.minor, "f4-tmp"], ["speed loss", o.speed, "f4-tmp"]]], ["Fully productive", o.full, [["scrap / rework", o.qual, "f4-tmq"]]]];
  let s = "";
  rows.forEach(([n, t, losses], i) => {
    const y = 12 + i * 46; s += `<text class="fe-tick f4-tml" x="${x0 - 8}" y="${y + 20}" text-anchor="end">${n}</text><rect class="f4-tmv" x="${x0}" y="${y}" width="${Math.max(1, X(t))}" height="28" rx="3"/><text class="f4-tmt" x="${x0 + 6}" y="${y + 18}">${fx(t, 0)} min</text>`;
    let xx = x0 + X(t); losses.forEach(([ln, lt, cls]) => { const w = X(lt); s += `<rect class="${cls}" x="${xx}" y="${y}" width="${Math.max(0, w)}" height="28"><title>${ln}: ${fx(lt, 0)} min</title></rect>`; if (w > 40) s += `<text class="f4-tmt2" x="${xx + 4}" y="${y + 18}">${ln} ${fx(lt, 0)}</text>`; xx += w; });
  });
  $("f4Tm").setAttribute("viewBox", `0 0 ${W} ${Hh}`); $("f4Tm").innerHTML = s;
  R.oee = { run: o.run, net: o.net, speed: o.speed, quality_loss: o.qual, fully_productive: o.full, A: rnd(o.A, 6), P: rnd(o.P, 6), Q: rnd(o.Q, 6), OEE: rnd(o.oee, 6), TEEP: rnd(o.teep, 6) };
  $("f4TmRes").innerHTML = `<p class="phd-eq">A = ${fx(o.run, 0)} ÷ ${fx(v.plan, 0)} = ${fx(o.A * 100, 1)} % · P = ${v.ideal} × ${v.total} ÷ ${fx(o.run, 0)} = ${fx(o.P * 100, 1)} % · Q = ${v.good} ÷ ${v.total} = ${fx(o.Q * 100, 1)} % · OEE = ${fx(o.oee * 100, 1)} % = ${fx(o.full, 0)} ÷ ${fx(v.plan, 0)} · TEEP = ${fx(o.teep * 100, 1)} %</p>
    <p class="sub">Grey = time not planned (no shift / no order) – it lowers TEEP, not OEE. Red = availability losses, orange = performance losses, violet = quality loss. Speed loss = run − ideal × total − minor stops = ${fx(o.speed, 0)} min.</p>`;
}
function drawSysOEE() {
  const n = Math.max(1, Math.round(num($("f4SoN").value, 3))), o = Math.min(1, Math.max(0, num($("f4SoO").value, 0.8)));
  const rigid = o ** n;
  R.system_oee = { n, machine_oee: o, rigid: rnd(rigid, 6), decoupled: o };
  $("f4SoRes").innerHTML = kv([["Rigid coupling, no buffers ≈ OEEⁿ (losses independent)", `<b>${fx(rigid * 100, 1)} %</b> = ${fx(o, 2)}^${n}`], ["Fully decoupled (large buffers / pallet pool) ≈ OEE of the bottleneck", `<b>${fx(o * 100, 1)} %</b>`], ["Real systems", "in between – the buffer size (4C) or the pallet number (4I) decides where"]]) +
    `<p class="am-note">This is why the FMS has a pallet pool: it converts machine losses from "everybody stops" into "only this machine stops". Measure both: machine OEE for maintenance, system OEE for the plant output and the business case.</p>`;
}

/* ================================================================== 4G exact queues */
function html4G() {
  const F = EX4._formulas;
  return card("f44G", "4G · Exact queues – M/M/1 and M/M/m (Erlang C): how many servers?", "random arrivals, random service times · the exact formulas behind 4B",
    guide({
      principle: `<p>A <b>queue</b> forms when jobs arrive at random at a server (machine, operator, presetter, technician, charger). The simplest exact model is <b>M/M/1</b>: arrivals form a
        Poisson stream with rate λ (exponential times between arrivals, cₐ = 1), service times are exponential with mean tₑ = 1/μ (cₑ = 1), one server. With m parallel servers it is <b>M/M/m</b>;
        the probability that an arriving job must wait is the famous <b>Erlang C</b> formula (A. K. Erlang, telephone exchanges, 1917).</p>
        <p class="phd-eq">M/M/1: ρ = λ/μ · L_q = ρ²/(1 − ρ) · W_q = L_q/λ · W = W_q + 1/μ · L = λ·W (Little)<br>
        M/M/m: a = λ/μ (offered load in "servers") · ρ = a/m · P₀ = 1 / ( Σ_{k=0}^{m−1} aᵏ/k! + aᵐ/(m!(1 − ρ)) ) · C = aᵐ/(m!(1 − ρ))·P₀ · L_q = C·ρ/(1 − ρ)</p>
        <p>The queue is only stable if ρ &lt; 1, i.e. you need at least m &gt; a servers. Close to ρ = 1 the waiting time explodes. The Kingman / <b>Sakasegawa</b> formula of 4B is an
        approximation of these exact results that also works for any variability (cₐ, cₑ ≠ 1). For m = 1 and cₐ = cₑ = 1 it gives exactly the M/M/1 value.</p>
        <p class="sub">Formulas (shared): ${esc(F.mm1)} · ${esc(F.mmm_erlang_c)}</p>`,
      uses: USES4.G,
      howto: ["Measure the arrival rate λ (jobs per hour) in the peak hour, not the daily average; check that arrivals are really random (cₐ ≈ 1) – scheduled arrivals have cₐ ≪ 1.",
        "Measure the service time tₑ incl. all side work (walking, documentation); if cₑ is far from 1 use Sakasegawa (4B) instead of Erlang C.",
        "Pick m from the table: the smallest m that meets the waiting-time target – and check ρ ≤ 0.85 so a small rise in demand does not explode the queue.",
        "For machines that wait for an operator or a technician (machine interference), the number of machines is small – then a finite-source model (M/M/m//N) or simulation is better."],
    }) + `
    <div class="fx-calc3">
      <div class="fx-box"><h4>M/M/1 – one server</h4><div class="fe-row fe-calc"><label>λ <input type="number" step="any" id="f4M1l" value="${EX4.mm1.lambda_per_h}"> /h</label><label>tₑ <input type="number" step="any" id="f4M1t" value="${EX4.mm1.te_min}"> min</label></div><div id="f4M1Res"></div></div>
      <div class="fx-box"><h4>M/M/m – Erlang C</h4><div class="fe-row fe-calc"><label>λ <input type="number" step="any" id="f4Mml" value="${EX4.mmm.lambda_per_h}"> /h</label><label>tₑ <input type="number" step="any" id="f4Mmt" value="${EX4.mmm.te_min}"> min</label><label>m <input type="number" step="1" min="1" id="f4Mmm" value="${EX4.mmm.m}"></label></div><div id="f4MmRes"></div></div>
    </div>
    <h3 class="fe-h3">Same λ, servers m = 1 … 6 – when is one more server needed?</h3>
    <div class="fe-row fe-calc"><label>Waiting-time target W_q ≤ <input type="number" step="any" id="f4MmTg" value="5"> min</label></div>
    <div id="f4MmTab"></div>
    <div class="grid2"><div><svg id="f4MmCh" class="fe-chart" role="img" aria-label="Waiting time versus utilisation exact and approximate"></svg><div class="sub" id="f4MmLg"></div></div><div id="f4MmCmp"></div></div>
    <div id="f4MmWx"></div>`);
}
function init4G() { ["f4M1l", "f4M1t", "f4Mml", "f4Mmt", "f4Mmm", "f4MmTg"].forEach((id) => $(id).addEventListener("input", calc4G)); calc4G(); }
function calc4G() {
  const l1 = num($("f4M1l").value), t1 = num($("f4M1t").value, 1), q1 = fMM1(l1, t1);
  $("f4M1Res").innerHTML = q1.stable ? kv([["μ = 60 ÷ tₑ", fx(q1.mu, 3) + " /h"], ["ρ = λ ÷ μ", `<b>${fx(q1.rho, 4)}</b>`], ["L_q = ρ² ÷ (1 − ρ)", `<b>${fx(q1.Lq, 4)}</b> jobs`], ["W_q = L_q ÷ λ", `<b>${fx(q1.Wq, 2)} min</b>`], ["W = W_q + tₑ", `<b>${fx(q1.W, 2)} min</b>`], ["L = λ·W", `${fx(q1.L, 4)} jobs`]])
    : `<p class="fe-no">ρ = ${fx(q1.rho, 3)} ≥ 1 – unstable: the queue grows without limit.</p>`;
  const lm = num($("f4Mml").value), tm = num($("f4Mmt").value, 1), m = Math.max(1, Math.round(num($("f4Mmm").value, 1))), q = fMMm(lm, tm, m);
  $("f4MmRes").innerHTML = q.stable ? kv([["a = λ ÷ μ", fx(q.a, 4) + " servers busy on average"], ["ρ = a ÷ m", `<b>${fx(q.rho, 4)}</b>`], ["P₀ (system empty)", fx(q.P0, 5)], ["C = P(wait) – Erlang C", `<b>${fx(q.C * 100, 2)} %</b>`], ["L_q = C·ρ ÷ (1 − ρ)", `<b>${fx(q.Lq, 4)}</b>`], ["W_q", `<b>${fx(q.Wq, 2)} min</b>`], ["W = W_q + tₑ", fx(q.W, 2) + " min"], ["L = λ·W", fx(q.L, 4)]])
    : `<p class="fe-no">ρ = ${fx(q.rho, 3)} ≥ 1 – unstable with ${m} server(s); at least ${Math.floor(q.a) + 1} needed.</p>`;
  const tg = num($("f4MmTg").value, 5), rows = [1, 2, 3, 4, 5, 6].map((k) => fMMm(lm, tm, k));
  const mMin = rows.find((r) => r.stable), mTg = rows.find((r) => r.stable && r.Wq <= tg);
  $("f4MmTab").innerHTML = tab(["m", "ρ", "P₀", "C = P(wait)", "L_q", "W_q min", "W min", "L", "Sakasegawa W_q min", "error"], rows.map((r) => {
    if (!r.stable) return `<tr class="f4-bad"><td><b>${r.m}</b></td><td>${fx(r.rho, 3)}</td><td colspan="8">unstable (ρ ≥ 1) – queue grows without limit</td></tr>`;
    const sk = fSak(r.rho, r.m, 1, 1, tm);
    return `<tr${r === mTg ? ' class="fx-best"' : r.m === m ? ' class="fx-cur"' : ""}><td><b>${r.m}</b></td><td>${fx(r.rho, 4)}</td><td>${fx(r.P0, 5)}</td><td>${fx(r.C * 100, 2)} %</td><td>${fx(r.Lq, 4)}</td><td><b>${fx(r.Wq, 3)}</b></td><td>${fx(r.W, 3)}</td><td>${fx(r.L, 4)}</td><td>${fx(sk, 3)}</td><td>${fx((sk / r.Wq - 1) * 100, 1)} %</td></tr>`;
  })) + `<p>${mMin ? `Minimum for a stable queue: <b>m = ${mMin.m}</b> (a = ${fx(mMin.a, 2)}). ` : ""}${mTg ? `Smallest m with W_q ≤ ${fx(tg, 1)} min: <b>m = ${mTg.m}</b> (green row).` : `No m ≤ 6 meets W_q ≤ ${fx(tg, 1)} min.`}
    ${mMin && mTg && mTg.m > mMin.m ? ` Going from ${mMin.m} to ${mMin.m + 1} servers cuts W_q from ${fx(mMin.Wq, 1)} to ${fx(rows[mMin.m].Wq, 1)} min – the extra server is busy only ${fx(rows[mMin.m].rho * 100, 0)} % but removes most of the waiting.` : ""}</p>`;
  // chart: Wq/te vs rho for m = 1, chosen m: exact vs Sakasegawa
  const xs = []; for (let u = 0.30; u <= 0.951; u += 0.01) xs.push(+u.toFixed(2));
  const mm = Math.max(2, m), ex = (u, k) => { const r = fMMm(u * k * 60 / tm, tm, k); return r.Wq / tm; };
  const ser = [{ n: "M/M/1 exact (= Sakasegawa for m = 1)", pts: xs.map((u) => [u, ex(u, 1)]), cls: "f4-s1" }, { n: `M/M/${mm} exact (Erlang C)`, pts: xs.map((u) => [u, ex(u, mm)]), cls: "f4-s3" }, { n: `M/M/${mm} Sakasegawa`, pts: xs.map((u) => [u, fSak(u, mm, 1, 1, tm) / tm]), cls: "f4-s2" }];
  $("f4MmLg").innerHTML = chart($("f4MmCh"), { series: ser, xmin: 0.3, xmax: 0.95, ymax: 20, xl: "Utilisation ρ", yl: "W_q ÷ tₑ", vmarks: q.stable ? [[q.rho, "fe-req", "your ρ"]] : [] });
  $("f4MmCmp").innerHTML = `<p class="am-note"><b>Exact versus approximation.</b> Sakasegawa replaces the Erlang C sum by u^(√(2(m+1)) − 1) ÷ (m(1 − u)). For M/M/1 both are identical.
    For m &gt; 1 the approximation is good at high utilisation (the region that matters) and too pessimistic at low utilisation, where the waiting time is small anyway
    (table: ${rows.filter((r) => r.stable).map((r) => `m ${r.m}: ${fx((fSak(r.rho, r.m, 1, 1, tm) / r.Wq - 1) * 100, 0)} %`).join(", ")}).
    Use Erlang C when arrivals and service are really random; use Sakasegawa (4B) when you know cₐ and cₑ.</p>`;
  const ex1 = fMM1(EX4.mm1.lambda_per_h, EX4.mm1.te_min), exm = [1, 2, 3, 4, 5, 6].map((k) => fMMm(EX4.mmm.lambda_per_h, EX4.mmm.te_min, k));
  R.mm1 = { rho: rnd(ex1.rho, 6), Lq: rnd(ex1.Lq, 6), Wq_min: rnd(ex1.Wq, 6), W_min: rnd(ex1.W, 6), L: rnd(ex1.L, 6) };
  R.mmm = exm.map((r) => (r.stable ? { m: r.m, rho: rnd(r.rho, 6), P0: rnd(r.P0, 6), C: rnd(r.C, 6), Lq: rnd(r.Lq, 6), Wq_min: rnd(r.Wq, 6), W_min: rnd(r.W, 6), L: rnd(r.L, 6), sak_Wq_min: rnd(fSak(r.rho, r.m, 1, 1, EX4.mmm.te_min), 6) } : { m: r.m, rho: rnd(r.rho, 6), stable: false }));
  const e3 = exm[2];
  $("f4MmWx").innerHTML = wx("tool presetting room – 3 presetters (shared example)", [
    `λ = ${EX4.mmm.lambda_per_h} tools/h, tₑ = ${EX4.mmm.te_min} min → μ = 60 ÷ 15 = 4 /h per presetter; a = λ ÷ μ = <b>${fx(e3.a, 2)}</b> presetters busy on average.`,
    `With m = 1 or 2: ρ = 2.5 or 1.25 ≥ 1 → unstable. m = 3: ρ = 2.5 ÷ 3 = <b>${fx(e3.rho, 4)}</b>.`,
    `Σ_{k=0}^{2} aᵏ/k! = 1 + 2.5 + 3.125 = 6.625; aᵐ/(m!(1 − ρ)) = 15.625 ÷ (6 × 0.16667) = 15.625. P₀ = 1 ÷ (6.625 + 15.625) = <b>${fx(e3.P0, 5)}</b>.`,
    `C = 15.625 × ${fx(e3.P0, 5)} = <b>${fx(e3.C, 4)}</b> → ${fx(e3.C * 100, 1)} % of the tools must wait.`,
    `L_q = C·ρ ÷ (1 − ρ) = ${fx(e3.C, 4)} × 5 = <b>${fx(e3.Lq, 4)}</b> tools; W_q = L_q ÷ λ = ${fx(e3.Lq, 4)} ÷ 10 h = <b>${fx(e3.Wq, 2)} min</b>; W = ${fx(e3.W, 2)} min; L = ${fx(e3.L, 3)}.`,
    `A 4th presetter: ρ = 0.625, W_q = <b>${fx(exm[3].Wq, 2)} min</b> (−${fx((1 - exm[3].Wq / e3.Wq) * 100, 0)} %). Sakasegawa for m = 3 gives ${fx(fSak(e3.rho, 3, 1, 1, 15), 2)} min (+${fx((fSak(e3.rho, 3, 1, 1, 15) / e3.Wq - 1) * 100, 1)} %).`,
    `M/M/1 example (λ = 5 /h, tₑ = 10 min): ρ = 0.8333, L_q = ${fx(ex1.Lq, 4)}, W_q = ${fx(ex1.Wq, 1)} min, W = ${fx(ex1.W, 1)} min, L = ${fx(ex1.L, 2)}.`]);
}

/* ================================================================== 4H variability sources */
function html4H() {
  const F = EX4._formulas, sv = EX4.setup_var, qd = EX4.queue;
  return card("f44H", "4H · Where variability comes from – set-ups (lot size), flow between stations, short vs long stops", "Factory Physics (Hopp &amp; Spearman) · all three feed cₑ² or cₐ² of the Kingman formula (4B)",
    guide({
      principle: `<p>Waiting time grows with variability: W_q = (cₐ² + cₑ²)/2 · u/(1 − u) · tₑ (one server). The squared coefficient of variation c² = σ²/mean² of the effective process time cₑ²
        has several sources: the natural variation of the process (c₀²), <b>breakdowns</b> (4B), and <b>set-ups</b>. The arrival variability cₐ² of a station is the <b>departure variability</b>
        of the station before it – so variability travels down the line.</p>
        <p class="phd-eq">Set-ups (mean tₛ, variance σₛ², one set-up every Nₛ parts): tₑ = t₀ + tₛ/Nₛ · σₑ² = σ₀² + σₛ²/Nₛ + (Nₛ − 1)/Nₛ² · tₛ² · cₑ² = σₑ²/tₑ²<br>
        Departures (one server): c_d² = u²·cₑ² + (1 − u²)·cₐ²<br>Breakdowns: A = MTTF/(MTTF + MTTR) · tₑ = t₀/A · cₑ² = c₀² + (1 + c_r²)·A·(1 − A)·MTTR/t₀</p>
        <p>Three lessons: (1) small lots raise utilisation (more set-up time), big lots raise variability and lot-forming time – there is a best lot size; (2) a highly utilised station passes
        its own variability to the next one (u² ≈ 1), a lightly utilised one passes the arrival variability; (3) at the same availability, short frequent stops are much better than long rare ones
        (the term MTTR in cₑ²).</p>
        <p class="sub">Formulas (shared): ${esc(F.setup_variability)} · ${esc(F.breakdown_variability)}</p>`,
      uses: USES4.H,
      howto: ["Measure the set-up time of each change (mean and standard deviation) – the variance matters, not only the mean.",
        "Lot size: plot CT versus Nₛ for the real arrival rate; take the flat bottom of the curve, then reduce tₛ with SMED (4F) – that moves the whole curve down and to the left.",
        "Line: put the most variable station (breakdowns!) last or give it a buffer; keep the stations after a variable station below 85 % utilisation.",
        "Maintenance: an MTTR reduction (spare parts, diagnostics) is often worth more for the flow than an MTBF increase at the same availability."],
    }) + `
    <h3 class="fe-h3">a) Set-up variability and the lot-size trade-off</h3>
    <div class="fe-row fe-calc">${[["t0", "t₀", sv.t0, "min"], ["sigma0", "σ₀", sv.sigma0, "min"], ["ts", "tₛ", sv.ts, "min"], ["sigma_s", "σₛ", sv.sigma_s, "min"]].map(([k, n, d, u]) => `<label>${n} <input type="number" step="any" id="f4Sv_${k}" value="${d}"> ${u}</label>`).join("")}
      <label>Arrival rate rₐ <input type="number" step="any" id="f4SvRa" value="${SETUP_RA}"> parts/h</label><label>cₐ² <input type="number" step="any" id="f4SvCa" value="${qd.ca * qd.ca}"></label></div>
    <div class="grid2"><div id="f4SvTab"></div><div><svg id="f4SvCh" class="fe-chart" role="img" aria-label="Cycle time versus lot size"></svg><div class="sub" id="f4SvLg"></div></div></div>
    <div id="f4SvWx"></div>
    <h3 class="fe-h3">b) Departure variability – how variability flows down a line</h3>
    <div class="fe-row fe-calc"><label>Arrival rate <input type="number" step="any" id="f4LnRa" value="${LINE0.ra}"> parts/h</label><label>cₐ² into station 1 <input type="number" step="any" id="f4LnCa" value="${LINE0.ca2}"></label>
      <button class="mx-el" id="f4LnAdd">+ Station</button><button class="mx-el" id="f4LnRst">Reset</button></div>
    <div class="grid2"><div class="fe-scroll"><table class="am-tab fe-calc" id="f4LnIn"></table></div><div id="f4LnRes"></div></div>
    <h3 class="fe-h3">c) Short versus long stops – same availability, different waiting</h3>
    <div class="fe-row fe-calc">${[["u", "u", qd.u, ""], ["t0", "t₀", qd.t0, "min"], ["c0", "c₀", qd.c0, ""], ["ca", "cₐ", qd.ca, ""], ["mttf", "MTTF", qd.mttf, "min"], ["mttr", "MTTR", qd.mttr, "min"], ["cr", "c_r (repair)", qd.cr, ""]].map(([k, n, d, u]) => `<label>${n} <input type="number" step="any" id="f4Bk_${k}" value="${d}"> ${u}</label>`).join("")}</div>
    <div class="grid2"><div id="f4BkRes"></div><div><svg id="f4BkCh" class="fe-chart" role="img" aria-label="Cycle time versus repair time at the same availability"></svg><div class="sub" id="f4BkLg"></div></div></div>`);
}
let LINE = null;
function init4H() {
  ["t0", "sigma0", "ts", "sigma_s"].forEach((k) => $("f4Sv_" + k).addEventListener("input", calcSetup));
  ["f4SvRa", "f4SvCa"].forEach((id) => $(id).addEventListener("input", calcSetup));
  LINE = store.get("line", null) || clone(LINE0.st);
  $("f4LnIn").addEventListener("input", (e) => { const t = e.target, i = +t.dataset.i, k = +t.dataset.k; if (!Number.isFinite(i)) return; LINE[i][k] = k === 0 ? t.value : num(t.value); store.set("line", LINE); calcLine(); });
  $("f4LnIn").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b && LINE.length > 1) { LINE.splice(+b.dataset.del, 1); store.set("line", LINE); drawLineIn(); calcLine(); } });
  $("f4LnAdd").addEventListener("click", () => { LINE.push(["Station " + (LINE.length + 1), 8, 0.5]); store.set("line", LINE); drawLineIn(); calcLine(); });
  $("f4LnRst").addEventListener("click", () => { LINE = clone(LINE0.st); store.del("line"); $("f4LnRa").value = LINE0.ra; $("f4LnCa").value = LINE0.ca2; drawLineIn(); calcLine(); });
  ["f4LnRa", "f4LnCa"].forEach((id) => $(id).addEventListener("input", calcLine));
  ["u", "t0", "c0", "ca", "mttf", "mttr", "cr"].forEach((k) => $("f4Bk_" + k).addEventListener("input", calcBreak));
  calcSetup(); drawLineIn(); calcLine(); calcBreak();
  R.setup_var = EX4.setup_var.Ns_values.map((N) => { const r = fSetup(EX4.setup_var, N); return { Ns: N, te: rnd(r.te, 6), sigma_e2: rnd(r.s2, 6), ce2: rnd(r.ce2, 6) }; });
  const q = EX4.queue, b = fBreak(q.t0, q.c0, q.mttf, q.mttr, q.cr);
  R.breakdown = { A: rnd(b.A, 6), te: rnd(b.te, 6), ce2: rnd(b.ce2, 6), Wq_min: rnd(fSak(q.u, q.m, q.ca * q.ca, b.ce2, b.te), 4), CT_min: rnd(fSak(q.u, q.m, q.ca * q.ca, b.ce2, b.te) + b.te, 4) };
}
function calcSetup() {
  const sv = {}; ["t0", "sigma0", "ts", "sigma_s"].forEach((k) => { sv[k] = num($("f4Sv_" + k).value); });
  const raH = num($("f4SvRa").value, 3), ra = raH / 60, ca2 = num($("f4SvCa").value, 1);
  const row = (N) => { const r = fSetup(sv, N), u = ra * r.te, wq = fSak(u, 1, ca2, r.ce2, r.te), ct = wq + r.te, wtb = (N - 1) / (2 * ra); return { ...r, u, wq, ct, wtb, tot: ct + wtb }; };
  const Ns = [...new Set([...EX4.setup_var.Ns_values, 1, 2, 3])].sort((a, b) => a - b);
  const xs = []; for (let n = 1; n <= 60; n++) xs.push(n);
  const all = xs.map(row), best = all.filter((r) => Number.isFinite(r.tot)).reduce((a, b) => (b.tot < a.tot ? b : a), { tot: Infinity });
  $("f4SvTab").innerHTML = tab(["Nₛ", "tₑ min", "σₑ² min²", "cₑ²", "u", "CT per part min", "+ wait-to-lot min"], Ns.map((N) => { const r = row(N); return `<tr${EX4.setup_var.Ns_values.includes(N) ? "" : ' class="f4-dim"'}><td><b>${N}</b></td><td>${fx(r.te, 3)}</td><td>${fx(r.s2, 3)}</td><td><b>${fx(r.ce2, 4)}</b></td><td>${fx(r.u, 3)}</td><td>${r.u < 1 ? fx(r.ct, 1) : "unstable"}</td><td>${r.u < 1 ? fx(r.tot, 1) : "–"}</td></tr>`; }), "f4-num") +
    `<p class="sub">Bold Nₛ = shared example rows (JSON). Best lot size with lot forming (1 … 60): <b>Nₛ = ${best.Ns || "–"}</b>, total ${fx(best.tot, 1)} min. Smallest stable lot: Nₛ &gt; tₛ ÷ (1/rₐ − t₀) = ${ra * sv.t0 < 1 ? fx(sv.ts / (1 / ra - sv.t0), 2) : "∞"}.</p>`;
  const ymax = Math.min(600, Math.max(60, (Number.isFinite(best.tot) ? best.tot : 100) * 3));
  $("f4SvLg").innerHTML = chart($("f4SvCh"), { series: [{ n: "CT per part (Kingman, parts processed one by one)", pts: all.map((r) => [r.Ns, r.u < 1 ? r.ct : NaN]), cls: "f4-s1" }, { n: "+ wait-to-lot (Nₛ − 1)/(2rₐ) when the lot is released complete", pts: all.map((r) => [r.Ns, r.u < 1 ? r.tot : NaN]), cls: "f4-s2" }, { n: "tₑ", pts: all.map((r) => [r.Ns, r.te]), cls: "f4-s4" }],
    xmin: 1, xmax: 60, ymax, xl: "Lot size Nₛ (parts between set-ups)", yl: "Minutes per part", vmarks: Number.isFinite(best.tot) ? [[best.Ns, "fe-req", "best Nₛ = " + best.Ns]] : [] });
  const r10 = fSetup(EX4.setup_var, 10);
  $("f4SvWx").innerHTML = wx("set-up every 10 parts (shared example)", [
    `t₀ = 10 min, σ₀ = 5 min, set-up tₛ = 60 min with σₛ = 20 min, Nₛ = 10.`,
    `tₑ = t₀ + tₛ/Nₛ = 10 + 60/10 = <b>${fx(r10.te, 1)} min</b>.`,
    `σₑ² = 5² + 20²/10 + (10 − 1)/10² × 60² = 25 + 40 + 324 = <b>${fx(r10.s2, 0)} min²</b>.`,
    `cₑ² = 389 ÷ 16² = <b>${fx(r10.ce2, 4)}</b> – six times the natural c₀² = 0.25: the set-ups dominate the variability.`,
    `At rₐ = ${fx(raH, 1)} parts/h: u = ${fx(ra * 16, 3)}, W_q = (cₐ² + cₑ²)/2 · u/(1 − u) · tₑ = ${fx(fSak(ra * 16, 1, ca2, r10.ce2, 16), 1)} min. Larger lots lower u and the queue, but each part waits longer for its lot – the green line shows the best compromise.`,
    `SMED halves tₛ to 30 min → the whole curve moves down; the best lot size becomes smaller (try it in the inputs).`]);
}
function drawLineIn() {
  $("f4LnIn").innerHTML = `<thead><tr><th>Station</th><th>tₑ min</th><th>cₑ²</th><th></th></tr></thead><tbody>${LINE.map((s, i) => `<tr><td><input type="text" class="f4-wn" data-i="${i}" data-k="0" value="${esc(s[0])}"></td><td><input type="number" step="any" data-i="${i}" data-k="1" value="${s[1]}"></td><td><input type="number" step="any" data-i="${i}" data-k="2" value="${s[2]}"></td><td><button class="mx-el fx-x" data-del="${i}">×</button></td></tr>`).join("")}</tbody>`;
}
function calcLine() {
  const raH = num($("f4LnRa").value, 5), ca2 = num($("f4LnCa").value, 1), L = fLine(raH, ca2, LINE.map((s) => [s[0], num(s[1]), num(s[2])]));
  R.line = { ra_per_h: raH, ca2_in: ca2, rows: L.rows.map((r) => ({ n: r.n, u: rnd(r.u, 4), ca2: rnd(r.ca2, 4), cd2: rnd(r.cd2, 4), Wq_min: rnd(r.wq, 3), CT_min: rnd(r.ct, 3) })), CT_total_min: rnd(L.ct, 3) };
  $("f4LnRes").innerHTML = tab(["Station", "u = rₐ·tₑ", "cₐ² in", "cₑ²", "W_q min", "CT min", "c_d² out"], L.rows.map((r) => `<tr${r.u >= 1 ? ' class="f4-bad"' : ""}><td><b>${esc(r.n)}</b></td><td>${fx(r.u, 3)}</td><td>${fx(r.ca2, 3)}</td><td>${fx(r.ce2, 3)}</td><td>${r.u < 1 ? fx(r.wq, 1) : "unstable"}</td><td>${r.u < 1 ? fx(r.ct, 1) : "–"}</td><td>${fx(r.cd2, 3)}</td></tr>`), "f4-num") +
    `<p>${L.ok ? `Line cycle time = Σ CT = <b>${fx(L.ct, 1)} min</b> (pure process time ${fx(L.rows.reduce((a, r) => a + r.te, 0), 1)} min).` : '<span class="fe-no">One station is overloaded (u ≥ 1).</span>'}</p>
    <p class="am-note">c_d² = u²·cₑ² + (1 − u²)·cₐ²: a busy station (u → 1) sends out its own variability, a lightly loaded station passes on what it receives.
    Try: swap the breakdown station to the end – the station after it no longer gets the high cₐ², and the total cycle time drops.</p>`;
}
function calcBreak() {
  const g = {}; ["u", "t0", "c0", "ca", "mttf", "mttr", "cr"].forEach((k) => { g[k] = num($("f4Bk_" + k).value); });
  const A = g.mttf / (g.mttf + g.mttr), ca2 = g.ca * g.ca;
  const at = (mttr) => { const b = fBreak(g.t0, g.c0, mttr * A / (1 - A), mttr, g.cr), wq = fSak(g.u, 1, ca2, b.ce2, b.te); return { ...b, wq, ct: wq + b.te }; };
  const L = at(g.mttr), S = at(g.mttr / 10), V = at(g.mttr / 60), N0 = (() => { const wq = fSak(g.u, 1, ca2, g.c0 * g.c0, g.t0); return { A: 1, te: g.t0, ce2: g.c0 * g.c0, wq, ct: wq + g.t0 }; })();
  $("f4BkRes").innerHTML = tab(["Case", "MTTF / MTTR min", "A", "tₑ min", "cₑ²", "W_q min", "CT min"], [[`Your stops`, `${fx(g.mttf, 0)} / ${fx(g.mttr, 1)}`, L], ["10 × shorter, 10 × more often", `${fx(g.mttf / 10, 0)} / ${fx(g.mttr / 10, 1)}`, S], ["60 × shorter (micro-stops)", `${fx(g.mttf / 60, 1)} / ${fx(g.mttr / 60, 2)}`, V], ["No breakdowns (A = 1)", "–", N0]].map(([n, mm, r]) => `<tr><td><b>${n}</b></td><td>${mm}</td><td>${fx(r.A * 100, 2)} %</td><td>${fx(r.te, 2)}</td><td>${fx(r.ce2, 4)}</td><td>${fx(r.wq, 1)}</td><td><b>${fx(r.ct, 1)}</b></td></tr>`), "f4-num") +
    `<p class="phd-eq">cₑ² = ${fx(g.c0 * g.c0, 2)} + (1 + ${fx(g.cr * g.cr, 2)}) × ${fx(A, 4)} × ${fx(1 - A, 4)} × ${fx(g.mttr, 1)} ÷ ${fx(g.t0, 1)} = ${fx(L.ce2, 4)}</p>
    <p class="am-note">Same availability ${fx(A * 100, 1)} % in all three cases – but one long ${fx(g.mttr, 0)}-minute repair makes the queue ${fx(L.wq / S.wq, 1)} × longer than ten ${fx(g.mttr / 10, 0)}-minute stops. Repair-time variability (c_r) adds on top.</p>`;
  const xs = []; for (let r = 1; r <= 120; r += 1) xs.push(r);
  $("f4BkLg").innerHTML = chart($("f4BkCh"), { series: [{ n: `CT at u = ${fx(g.u, 2)}, A = ${fx(A * 100, 1)} % fixed`, pts: xs.map((r) => [r, at(r).ct]), cls: "f4-s1" }, { n: "no breakdowns", pts: xs.map((r) => [r, N0.ct]), cls: "f4-s4" }], xmin: 0, xmax: 120, ymax: Math.max(...xs.map((r) => at(r).ct)) * 1.1, xl: "MTTR [min] (MTTF changes so that A stays the same)", yl: "Cycle time CT [min]", vmarks: [[g.mttr, "fe-req", "your MTTR"]] });
}

/* ================================================================== 4I closed systems & MVA */
function html4I() {
  const F = EX4._formulas;
  return card("f44I", "4I · Closed systems – Mean Value Analysis (MVA): throughput versus number of pallets", "exact for exponential times · laws of Factory Physics · compared with the 4E simulation (10 replications per point)",
    guide({
      principle: `<p>An FMS with a fixed number N of pallets is a <b>closed queueing network</b>: a pallet that leaves the load station always comes back. The throughput X(N) rises with N until the
        bottleneck is saturated. Three simple <b>laws</b> bound it: with the bottleneck rate r_b and the raw loop time T₀ (sum of all demands) the best case is min(N/T₀, r_b), the
        practical worst case (PWC) N/(W₀ + N − 1)·r_b, with the critical WIP W₀ = r_b·T₀. <b>MVA</b> computes X(N) exactly for exponential times in milliseconds – no simulation needed.</p>
        <p class="phd-eq">Demand Dₖ = time per pallet loop at station k (visits × time) · r_b = minₖ mₖ/Dₖ · T₀ = Σ Dₖ · W₀ = r_b·T₀<br>
        MVA: Qₖ(0) = 0; for n = 1 … N: Rₖ(n) = Dₖ·(1 + Qₖ(n − 1)) · X(n) = n / Σ Rₖ(n) · Qₖ(n) = X(n)·Rₖ(n)<br>
        Seidmann for m servers: queue with D/m + pure delay D·(m − 1)/m</p>
        <p>The idea of MVA: an arriving pallet sees the network as it would be with one pallet less (arrival theorem) – so its residence time at k is its own service plus the service of the
        Qₖ(n − 1) pallets already there. Little's law closes the loop.</p>
        <p class="sub">Formulas (shared): ${esc(F.closed_laws)} · ${esc(F.mva_seidmann)}</p>`,
      uses: USES4.I,
      howto: ["Write each resource with its number of servers and its demand per pallet loop (incl. breakdowns: D = machining ÷ A; vehicle: 2 moves per loop).",
        "Run MVA for N = 1 … 2·W₀ + 5 and take the N where X reaches 90–95 % of r_b – that is the first estimate of the pallet number.",
        "Check with simulation (4E / below) for the real variability and rules; MVA is exact only for exponential times and FCFS – real machining times are less variable, so simulation is usually a bit higher in the middle of the curve.",
        "If X(N) flattens far below the target, more pallets do not help: increase the bottleneck rate (machines, load stations)."],
    }) + `
    <div class="fe-row"><label>N max <input type="number" step="1" min="2" id="f4MvN" value="${EX4.mva.N_max}"></label><button class="mx-el" id="f4MvAdd">+ Station</button><button class="mx-el" id="f4MvRst">Reset to example</button></div>
    <div class="fe-scroll"><table class="am-tab fe-calc" id="f4MvIn"></table></div>
    <div id="f4MvLaw"></div>
    <div class="grid2"><div><svg id="f4MvCh" class="fe-chart" role="img" aria-label="Throughput versus pallets: MVA, bounds and simulation"></svg><div class="sub" id="f4MvLg"></div>
        <div class="fe-row"><button class="mx-el" id="f4DsRun">Run DES sweep (4E model, 10 replications per N)</button><span class="sub" id="f4DsMsg"></span></div></div>
      <div id="f4MvRes"></div></div>
    <h3 class="fe-h3">MVA table (Seidmann) – residence time R per station, queue Q, throughput X, loop time</h3>
    <div id="f4MvTab"></div><div id="f4MvWx"></div>`);
}
let MV = null, DES = null;
function init4I() {
  MV = store.get("mva", null) || clone(EX4.mva.stations);
  $("f4MvIn").addEventListener("input", (e) => { const t = e.target, i = +t.dataset.i, k = +t.dataset.k; if (!Number.isFinite(i)) return; MV[i][k] = k === 0 ? t.value : num(t.value); store.set("mva", MV); calc4I(); });
  $("f4MvIn").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b && MV.length > 1) { MV.splice(+b.dataset.del, 1); store.set("mva", MV); drawMvIn(); calc4I(); } });
  $("f4MvAdd").addEventListener("click", () => { MV.push(["New station", 1, 5]); store.set("mva", MV); drawMvIn(); calc4I(); });
  $("f4MvRst").addEventListener("click", () => { MV = clone(EX4.mva.stations); store.del("mva"); $("f4MvN").value = EX4.mva.N_max; drawMvIn(); calc4I(); });
  $("f4MvN").addEventListener("input", calc4I);
  $("f4DsRun").addEventListener("click", () => runDesSweep());
  drawMvIn(); calc4I();
  const ex = fMVA(EX4.mva.stations, EX4.mva.N_max), lw = fLaws(EX4.mva.stations);
  R.mva = { X_per_h: ex.map((r) => rnd(r.Xh, 4)), loop_min: ex.map((r) => rnd(r.loop, 3)), R_N15: ex[ex.length - 1].R.map((x) => rnd(x, 3)) };
  R.closed_laws = { rb_per_h: rnd(lw.rb * 60, 4), T0_min: rnd(lw.T0, 3), W0: rnd(lw.W0, 4), bottleneck: lw.bn, best_per_h: ex.map((r) => rnd(lw.best(r.n) * 60, 4)), pwc_per_h: ex.map((r) => rnd(lw.pwc(r.n) * 60, 4)), worst_per_h: rnd(lw.worst() * 60, 4),
    N95_mva: (ex.find((r) => r.X >= 0.95 * lw.rb) || {}).n || null };
}
function drawMvIn() {
  $("f4MvIn").innerHTML = `<thead><tr><th>Station</th><th>Servers m</th><th>Demand D per loop min</th><th>Rate m/D per h</th><th></th></tr></thead><tbody>${MV.map((s, i) => `<tr><td><input type="text" class="f4-wl" data-i="${i}" data-k="0" value="${esc(s[0])}"></td><td><input type="number" step="1" min="1" data-i="${i}" data-k="1" value="${s[1]}"></td><td><input type="number" step="any" data-i="${i}" data-k="2" value="${s[2]}"></td><td class="f4-rate" data-r="${i}"></td><td><button class="mx-el fx-x" data-del="${i}">×</button></td></tr>`).join("")}</tbody>`;
}
function calc4I() {
  const st = MV.map(([n, m, D]) => [n, Math.max(1, Math.round(num(m, 1))), Math.max(1e-6, num(D, 1))]), Nmax = Math.max(2, Math.min(60, Math.round(num($("f4MvN").value, 15))));
  st.forEach((s, i) => { const c = document.querySelector(`#f4MvIn [data-r="${i}"]`); if (c) c.textContent = fx(s[1] / s[2] * 60, 3); });
  const rows = fMVA(st, Nmax), lw = fLaws(st), n95 = (rows.find((r) => r.X >= 0.95 * lw.rb) || {}).n;
  $("f4MvLaw").innerHTML = kpis([["Bottleneck rate r_b", fx(lw.rb * 60, 3) + " /h"], ["Bottleneck", esc(lw.bn.split(" (")[0])], ["Raw loop time T₀", fx(lw.T0, 2) + " min"], ["Critical WIP W₀ = r_b·T₀", fx(lw.W0, 3)], ["MVA: pallets for 95 % of r_b", n95 ? n95 : "> " + Nmax], ["Worst case 1/T₀", fx(60 / lw.T0, 3) + " /h"]]);
  $("f4MvTab").innerHTML = tab(["N", ...st.map((s) => "R " + esc(s[0].split(" (")[0]) + " min"), "X /h", ...st.map((s) => "Q " + esc(s[0].split(" (")[0])), "Loop time min", "Best /h", "PWC /h"], rows.map((r) => `<tr${r.n === n95 ? ' class="fx-best"' : ""}><td><b>${r.n}</b></td>${r.R.map((x) => `<td>${fx(x, 3)}</td>`).join("")}<td><b>${fx(r.Xh, 4)}</b></td>${r.Q.map((x) => `<td>${fx(x, 3)}</td>`).join("")}<td>${fx(r.loop, 2)}</td><td>${fx(lw.best(r.n) * 60, 3)}</td><td>${fx(lw.pwc(r.n) * 60, 3)}</td></tr>`), "f4-mvt") +
    `<p class="sub">R of a multi-server station = queue part D/m·(1 + Q) + delay part D·(m − 1)/m (Seidmann); Q shown incl. the pallets in the delay part. Check: Σ Q = N and loop time = N ÷ X (Little).</p>`;
  drawMvChart(st, rows, lw);
  const e = fMVA(EX4.mva.stations, 2), d = EX4.mva.stations;
  $("f4MvWx").innerHTML = wx("first two MVA steps of the FMS example", [
    `Stations: load 1 × 12 min, vehicle 1 × 3 min (2 moves × 1.5), machines 3 × 60.48 min (57.6 min mix-weighted machining ÷ A, A = 1200/1260). Seidmann: machines → queue 20.16 min + delay 40.32 min.`,
    `r_b = min(1/12, 1/3, 3/60.48) /min = 0.04960 /min = <b>2.976 pallets/h</b> (machines). T₀ = 12 + 3 + 60.48 = <b>75.48 min</b>; W₀ = 0.04960 × 75.48 = <b>3.744 pallets</b>.`,
    `n = 1: R = 12, 3, 20.16 (+ 40.32 delay) → loop 75.48 min, X(1) = 1/75.48 /min = <b>${fx(e[0].Xh, 4)} /h</b>; Q = X·R = ${e[0].Q.map((q) => fx(q, 3)).join(", ")} (load, vehicle, machines incl. delay).`,
    `n = 2: R_load = 12 × (1 + ${fx(e[0].Rq[0] / 75.48, 4)}) = ${fx(e[1].Rq[0], 3)}; R_veh = 3 × (1 + ${fx(e[0].Rq[1] / 75.48, 4)}) = ${fx(e[1].Rq[1], 3)}; R_mach = 20.16 × (1 + ${fx(e[0].Rq[2] / 75.48, 4)}) = ${fx(e[1].Rq[2], 3)} (+ 40.32).`,
    `Loop = ${fx(e[1].loop, 3)} min → X(2) = 2 ÷ ${fx(e[1].loop, 3)} × 60 = <b>${fx(e[1].Xh, 4)} /h</b>. Continue to N = 15 (table). X reaches 95 % of r_b (2.827 /h) at N = ${(fMVA(d, 15).find((r) => r.X >= 0.95 * 3 / 60.48) || {}).n}.`]);
}
function drawMvChart(st, rows, lw) {
  const Nmax = rows.length, xs = rows.map((r) => r.n), ser = [
    { n: "MVA (exact, exponential)", pts: rows.map((r) => [r.n, r.Xh]), cls: "f4-s1", dots: true },
    { n: "Best case min(N/T₀, r_b)", pts: xs.map((n) => [n, lw.best(n) * 60]), cls: "f4-s4" },
    { n: "Practical worst case", pts: xs.map((n) => [n, lw.pwc(n) * 60]), cls: "f4-s2" },
    { n: "Worst case 1/T₀", pts: xs.map((n) => [n, lw.worst() * 60]), cls: "f4-s5" }];
  if (DES && DES.pts.length) ser.push({ n: `DES 4E model: mean ± 95 % CI (${DES.R} replications, ${DES.days} d)`, pts: DES.pts.map((p) => [p.N, p.mean]), err: DES.pts.map((p) => p.hw), cls: "f4-s3", dots: true, noline: true, r: 3.6 });
  $("f4MvLg").innerHTML = chart($("f4MvCh"), { series: ser, xmin: 0, xmax: Nmax + 0.5, ymax: lw.rb * 60 * 1.15, xl: "Pallets in the system N", yl: "Throughput X [pallets/h]", hmarks: [[lw.rb * 60, "f4-rb", "r_b", 1], [lw.rb * 60 * 0.95, "f4-rb95", "95 % r_b"]] });
  const sim = DES && DES.pts.length ? DES : null;
  $("f4MvRes").innerHTML = sim ? `${tab(["N", "MVA /h", "DES mean /h", "± half width", "DES − MVA"], sim.pts.map((p) => { const m = rows[p.N - 1]; return `<tr${p.N === sim.n95 ? ' class="fx-best"' : ""}><td>${p.N}</td><td>${m ? fx(m.Xh, 3) : "–"}</td><td><b>${fx(p.mean, 3)}</b></td><td>${fx(p.hw, 3)}</td><td>${m ? fx(p.mean - m.Xh, 3) : "–"}</td></tr>`; }), "f4-small")}
    <p>DES: pallets for 95 % of r_b: <b>${sim.n95 || "–"}</b> · MVA: <b>${(rows.find((r) => r.X >= 0.95 * lw.rb) || {}).n || "–"}</b>.</p>
    <p class="am-note">The DES uses the 4E model (lognormal machining cv 0.15, load cv 0.3, constant moves, exponential breakdowns) – less variable than the exponential times of MVA, so the DES is higher than MVA for small and medium N${sim.pts[2] && rows[2] ? ` (N = 3: DES ${fx(sim.pts[2].mean, 3)} vs MVA ${fx(rows[2].Xh, 3)} /h)` : ""} and both meet r_b for large N. The DES points do not change when you edit the MVA stations.</p>`
    : `<p class="sub">DES points: press "Run DES sweep" (runs automatically once after loading).</p>`;
}
function runDesSweep(then) {
  const base = simBase(), Rn = EX4.fms_sim.replications, Nmax = EX4.mva.N_max, out = [];
  $("f4DsMsg").textContent = "running…"; $("f4DsRun").disabled = true;
  let N = 1;
  const step = () => {
    const ths = []; for (let s = 1; s <= Rn; s++) ths.push(simFMS({ ...base, N, seed: s }, false).th);
    const st = stats(ths); out.push({ N, mean: st.mean, s: st.s, hw: st.hw });
    $("f4DsMsg").textContent = `running… N = ${N} / ${Nmax}`;
    if (++N <= Nmax) { setTimeout(step, 0); return; }
    const rb = fLaws(EX4.mva.stations).rb * 60;
    DES = { pts: out, R: Rn, days: base.days, n95: (out.find((p) => p.mean >= 0.95 * rb) || {}).N || null };
    R.des_sweep = { R: Rn, days: base.days, seeds: "1.." + Rn, points: out.map((p) => ({ N: p.N, mean: rnd(p.mean, 4), hw: rnd(p.hw, 4) })), N95: DES.n95 };
    $("f4DsMsg").textContent = `done – ${Nmax * Rn} simulations`; $("f4DsRun").disabled = false;
    calc4I();
    if (typeof then === "function") then(); else if (!REP.done) setTimeout(() => runReps(), 50);
  };
  setTimeout(step, 0);
}

/* ================================================================== 4J simulation output analysis */
function html4J() {
  const F = EX4._formulas, s = EX4.fms_sim;
  return card("f44J", "4J · Simulation output analysis – replications, confidence intervals, warm-up, comparing alternatives", "the 4E FMS model, seeds 1 … R · one run is one random sample – never decide on one run",
    guide({
      principle: `<p>A stochastic simulation gives a <b>different answer for every random seed</b>. One run is one sample; the true long-run mean is unknown. Therefore you run R independent
        <b>replications</b> (seeds 1 … R), compute the mean and the sample standard deviation s and give a <b>95 % confidence interval</b>: with 95 % confidence the true mean is inside.</p>
        <p class="phd-eq">x̄ = Σ xᵢ / R · s = √( Σ (xᵢ − x̄)² / (R − 1) ) · half width h = t_{R−1, 0.975} · s / √R (t₉ = 2.262) · CI = x̄ ± h</p>
        <p><b>Warm-up:</b> the model starts empty (all pallets at the load station) – the first hours are not typical. Welch's method: average the output series (e.g. hourly throughput) over the
        replications, smooth it with a moving average of window w, and cut where the curve becomes flat. <b>Comparing two alternatives:</b> run both with the <b>same seeds</b> (common random numbers),
        take the difference per seed and build the CI of the differences. If it does not contain 0, the difference is significant.</p>
        <p class="sub">Formulas (shared): ${esc(F.replications)} · ${esc(F.welch)}</p>`,
      uses: USES4.J,
      howto: ["Fix the warm-up with Welch on a pilot run (5–10 replications), then delete the warm-up from all statistics (4E deletes min(10 % of the run, 2 days)).",
        "Run length: much longer than the longest cycle in the model (≥ 10–20 breakdown cycles MTBF + MTTR per machine; whole weeks if the shift pattern repeats weekly).",
        "Start with R = 10, look at the half width; if it is too wide, R_needed ≈ R·(h ÷ h_target)².",
        "Compare alternatives always with common random numbers and a paired CI; for more than two alternatives use a correction (e.g. Bonferroni: 95 % → 1 − 0.05/k per pair).",
        "Report every KPI as mean ± half width with R, run length and warm-up – a single number hides the uncertainty."],
    }) + `
    <div class="fe-row fe-calc"><label>Replications R <input type="number" step="1" min="2" max="60" id="f4RpR" value="${s.replications}"></label><label>Days per run <input type="number" step="1" min="2" id="f4RpD" value="${s.days}"></label>
      <label>Pallets N <input type="number" step="1" min="1" id="f4RpN" value="${s.N}"></label><label>Welch window w <input type="number" step="1" min="1" id="f4RpW" value="6"> h</label>
      <button class="mx-el" id="f4RpRun">Run replications</button><span class="sub" id="f4RpMsg"></span></div>
    <p class="sub">Model = 4E example: ${s.m} machines, ${s.L} load station, ${s.V} vehicle, load ${s.load} min (cv ${s.loadCv}), move ${s.move} min, MTTF ${s.mttf} / MTTR ${s.mttr} min, part mix ${s.parts.map((p) => p[1] + " % × " + p[2] + " min").join(", ")}, ${s.rule}. Seeds 1 … R.</p>
    <div class="grid2"><div id="f4RpTab"></div><div id="f4RpSum"></div></div>
    <h3 class="fe-h3">Welch plot – replication-averaged hourly throughput</h3>
    <svg id="f4WeCh" class="fe-chart" role="img" aria-label="Welch warm-up plot"></svg><div class="sub" id="f4WeLg"></div><div id="f4WeRes"></div>
    <h3 class="fe-h3">Compare two alternatives with common random numbers</h3>
    <div class="fe-row fe-calc"><b>Alternative B:</b>${[["m", "machines", s.m], ["N", "pallets", 6], ["L", "load stations", s.L], ["V", "vehicles", s.V]].map(([k, n, d]) => `<label>${n} <input type="number" step="1" min="1" id="f4CpB_${k}" value="${d}"></label>`).join("")}
      <button class="mx-el" id="f4CpRun">Compare A vs B</button><span class="sub" id="f4CpMsg"></span></div>
    <div id="f4CpRes"></div>
    <h3 class="fe-h3">Run-length and replication guidance</h3><div id="f4RlRes"></div>`);
}
const REP = { done: false, runs: [], hist: [], p: null };
function init4J() {
  $("f4RpRun").addEventListener("click", () => runReps());
  $("f4CpRun").addEventListener("click", () => runCompare());
  $("f4RpW").addEventListener("input", drawWelch);
  $("f4RpTab").innerHTML = `<p class="sub">Replications start automatically after the DES sweep of 4I, or press "Run replications".</p>`;
}
function readRepP() { const p = simBase(); p.days = Math.max(2, Math.round(num($("f4RpD").value, 14))); p.N = Math.max(1, Math.round(num($("f4RpN").value, 10))); return { p, Rn: Math.max(2, Math.min(60, Math.round(num($("f4RpR").value, 10)))) }; }
function runReps(then) {
  const { p, Rn } = readRepP(); const runs = [], hist = [];
  $("f4RpMsg").textContent = "running…"; $("f4RpRun").disabled = true;
  let s = 1;
  const step = () => {
    const h = []; const r = simFMS({ ...p, seed: s, hist: h }, false); runs.push({ seed: s, th: r.th, uM: r.uM, uL: r.uL, uV: r.uV, ct: r.ct, dM: r.dM }); hist.push(h);
    $("f4RpMsg").textContent = `running… ${s} / ${Rn}`;
    if (++s <= Rn) { setTimeout(step, 0); return; }
    Object.assign(REP, { done: true, runs, hist, p });
    $("f4RpMsg").textContent = `done – ${Rn} replications of ${p.days} days`; $("f4RpRun").disabled = false;
    drawReps(); drawWelch();
    if (typeof then === "function") then(); else if (!CMP.done) setTimeout(() => runCompare(), 50);
  };
  setTimeout(step, 0);
}
function drawReps() {
  const { runs, p } = REP, keys = [["th", "TH pallets/h", 3, 1], ["uM", "Machine busy % (incl. breakdowns)", 1, 100], ["uL", "Load st. util. %", 1, 100], ["uV", "Vehicle util. %", 1, 100], ["ct", "Loop time min", 1, 1]];
  const S = Object.fromEntries(keys.map(([k]) => [k, stats(runs.map((r) => r[k]))]));
  $("f4RpTab").innerHTML = tab(["Seed", ...keys.map((k) => k[1]), "Little N = TH·loop"], runs.map((r) => `<tr><td>${r.seed}</td>${keys.map(([k, , d, f]) => `<td>${fx(r[k] * f, d)}</td>`).join("")}<td>${fx(r.th / 60 * r.ct, 2)}</td></tr>`).concat(
    [["Mean x̄", "mean"], ["Std s", "s"], [`Half width (t = ${fx(S.th.t, 3)})`, "hw"], ["CI low", "lo"], ["CI high", "hi"]].map(([n, f]) => `<tr class="f4-sum"><td><b>${n}</b></td>${keys.map(([k, , d, m]) => `<td><b>${fx(S[k][f] * m, d + 1)}</b></td>`).join("")}<td></td></tr>`)), "f4-rep");
  const lw = fLaws(EX4.mva.stations), mva = fMVA(EX4.mva.stations, p.N)[p.N - 1];
  $("f4RpSum").innerHTML = kpis([["Throughput (95 % CI)", `${fx(S.th.mean, 3)} ± ${fx(S.th.hw, 3)}`], ["Machine utilisation", `${fx(S.uM.mean * 100, 1)} ± ${fx(S.uM.hw * 100, 1)} %`], ["Loop time", `${fx(S.ct.mean, 1)} ± ${fx(S.ct.hw, 1)} min`], ["Relative half width TH", fx(S.th.hw / S.th.mean * 100, 2) + " %"]]) +
    `<p>With 95 % confidence the long-run throughput of this FMS with N = ${p.N} pallets lies between <b>${fx(S.th.lo, 3)}</b> and <b>${fx(S.th.hi, 3)}</b> pallets/h.
     Bottleneck rate r_b = ${fx(lw.rb * 60, 3)} /h; MVA (exponential) X(${p.N}) = ${fx(mva.Xh, 3)} /h. Little: N = TH × loop time = ${fx(S.th.mean / 60 * S.ct.mean, 2)} ≈ ${p.N} ✓.</p>
     <p class="am-note">The single run of 4E (seed 7) is just one of these samples – another seed gives another number. The CI is what you report.</p>`;
  R.replications = { R: runs.length, days: p.days, N: p.N, seeds: "1.." + runs.length, t: S.th.t, TH: { mean: rnd(S.th.mean, 4), s: rnd(S.th.s, 4), hw: rnd(S.th.hw, 4), lo: rnd(S.th.lo, 4), hi: rnd(S.th.hi, 4) }, uM: { mean: rnd(S.uM.mean, 4), hw: rnd(S.uM.hw, 4) }, uL: { mean: rnd(S.uL.mean, 4), hw: rnd(S.uL.hw, 4) }, uV: { mean: rnd(S.uV.mean, 4), hw: rnd(S.uV.hw, 4) }, loop_min: { mean: rnd(S.ct.mean, 3), hw: rnd(S.ct.hw, 3) }, per_rep_TH: runs.map((r) => rnd(r.th, 4)) };
  drawRunLength(S);
}
function drawWelch() {
  if (!REP.done) return;
  const H = REP.p.days * 24, w = Math.max(1, Math.round(num($("f4RpW").value, 6))), Rn = REP.hist.length;
  const Y = new Array(H).fill(0); REP.hist.forEach((h) => h.forEach((t) => { const i = Math.floor(t / 60); if (i < H) Y[i] += 1 / Rn; }));
  const m = H - w, MA = [];
  for (let i = 1; i <= m; i++) { const lo = i <= w ? 1 : i - w, hi = i <= w ? 2 * i - 1 : i + w; let s = 0; for (let k = lo; k <= hi; k++) s += Y[k - 1]; MA.push([i - 0.5, s / (hi - lo + 1)]); }
  const warm = Math.min(REP.p.days * 1440 * 0.1, 2880) / 60, mean = R.replications ? R.replications.TH.mean : NaN;
  const ymax = Math.max(4, ...Y) * 1.1;
  $("f4WeLg").innerHTML = chart($("f4WeCh"), { series: [{ n: `Hourly throughput, average of ${Rn} replications`, pts: Y.map((y, i) => [i + 0.5, y]), cls: "f4-s5" }, { n: `Welch moving average (w = ${w} h)`, pts: MA, cls: "f4-s1" }], xmin: 0, xmax: H, ymax, W: 1200, H: 340, xl: "Simulated time [h]", yl: "Pallets per hour", vmarks: [[warm, "fe-req", `warm-up deleted by 4E: ${fx(warm, 1)} h`]], hmarks: Number.isFinite(mean) ? [[mean, "f4-rb", "steady-state mean " + fx(mean, 2)]] : [] });
  const first = MA.slice(0, 12).map((p) => fx(p[1], 2));
  R.welch = { window_h: w, hours: H, first12_MA: MA.slice(0, 12).map((p) => rnd(p[1], 3)), warmup_deleted_h: warm };
  $("f4WeRes").innerHTML = `<p class="sub">Moving average of the first 12 hours: ${first.join(" · ")}. The curve rises during the first hours (empty machines, all pallets queue at the single load station) and becomes flat after roughly one shift;
    4E deletes ${fx(warm, 1)} h – on the safe side. Window: for i ≤ w the average of the first 2i − 1 values, else of the 2w + 1 values around i (Welch).</p>`;
}
const CMP = { done: false };
function runCompare() {
  if (!REP.done) { runReps(() => runCompare()); return; }
  const pA = REP.p, pB = { ...pA }; ["m", "N", "L", "V"].forEach((k) => { pB[k] = Math.max(1, Math.round(num($("f4CpB_" + k).value, pA[k]))); });
  const Rn = REP.runs.length, b = [];
  $("f4CpMsg").textContent = "running…"; $("f4CpRun").disabled = true;
  let s = 1;
  const step = () => {
    b.push(simFMS({ ...pB, seed: s }, false).th);
    if (++s <= Rn) { setTimeout(step, 0); return; }
    const a = REP.runs.map((r) => r.th), d = a.map((x, i) => b[i] - x), SA = stats(a), SB = stats(b), SD = stats(d);
    const sig = SD.lo > 0 || SD.hi < 0, unpH = tq(2 * Rn - 2) * Math.sqrt((SA.s ** 2 + SB.s ** 2) / Rn);
    CMP.done = true;
    R.compare = { A: { m: pA.m, N: pA.N, L: pA.L, V: pA.V }, B: { m: pB.m, N: pB.N, L: pB.L, V: pB.V }, R: Rn, A_mean: rnd(SA.mean, 4), B_mean: rnd(SB.mean, 4), diff_mean: rnd(SD.mean, 4), diff_s: rnd(SD.s, 4), diff_hw: rnd(SD.hw, 4), diff_lo: rnd(SD.lo, 4), diff_hi: rnd(SD.hi, 4), significant: sig, unpaired_hw: rnd(unpH, 4) };
    $("f4CpMsg").textContent = "done"; $("f4CpRun").disabled = false;
    $("f4CpRes").innerHTML = `<div class="grid2"><div>${tab(["Seed", "A TH /h", "B TH /h", "d = B − A"], a.map((x, i) => `<tr><td>${i + 1}</td><td>${fx(x, 3)}</td><td>${fx(b[i], 3)}</td><td><b>${fx(d[i], 3)}</b></td></tr>`).concat(`<tr class="f4-sum"><td><b>Mean</b></td><td><b>${fx(SA.mean, 3)}</b></td><td><b>${fx(SB.mean, 3)}</b></td><td><b>${fx(SD.mean, 4)}</b></td></tr>`, `<tr class="f4-sum"><td><b>s</b></td><td>${fx(SA.s, 4)}</td><td>${fx(SB.s, 4)}</td><td>${fx(SD.s, 4)}</td></tr>`), "f4-small")}</div>
      <div>${kv([["A (base)", `m ${pA.m}, N ${pA.N}, L ${pA.L}, V ${pA.V}`], ["B", `m ${pB.m}, N ${pB.N}, L ${pB.L}, V ${pB.V}`], ["Mean difference d̄", `<b>${fx(SD.mean, 4)} pallets/h</b> (${fx(SD.mean / SA.mean * 100, 2)} %)`], [`Paired CI: d̄ ± t·s_d/√R = ${fx(SD.mean, 4)} ± ${fx(SD.t, 3)} × ${fx(SD.s, 4)}/√${Rn}`, `<b>[${fx(SD.lo, 4)} ; ${fx(SD.hi, 4)}]</b>`], ["Verdict", ok(sig, "significant – the CI does not contain 0", "not significant – the CI contains 0")], ["Half width without common random numbers (two independent samples)", fx(unpH, 4) + " – compare with the paired " + fx(SD.hw, 4)]])}
      <p class="am-note">Common random numbers: both alternatives see the same random stream per seed, so much of the noise cancels in the difference. simFMS uses one random stream for everything, so the
      synchronisation is only partial (a change in the model shifts which random number is used for what) – dedicated streams per random source would make the paired CI even narrower.
      Default question: can we save 4 pallets (N 10 → 6)? Try also +1 load station (L 2): the machines are already 100 % busy, so the true gain is zero – with 95 % confidence about 1 comparison in 20 still looks "significant" by chance (false alarm), so repeat with other seeds before you decide. A significant difference is not automatically a worthwhile one: compare d̄ × hours per year × contribution per pallet with the investment (item 1).</p></div></div>`;
    if (!R.vv) setTimeout(runVV, 50);
  };
  setTimeout(step, 0);
}
function drawRunLength(S) {
  const p = REP.p, Rn = REP.runs.length, need = (rel) => { let n = Rn; for (let k = 0; k < 6; k++) n = Math.max(2, Math.ceil((tq(n - 1) * S.th.s / (rel * S.th.mean)) ** 2)); return n; };
  const cyc = p.mttf + p.mttr, busy = p.days * 1440 * S.uM.mean, nBd = busy / p.mttf;
  R.run_length = { rel_hw_TH: rnd(S.th.hw / S.th.mean, 5), R_for_1pct: need(0.01), R_for_0_5pct: need(0.005), breakdowns_per_machine_per_run: rnd(nBd, 2) };
  $("f4RlRes").innerHTML = kv([["Current relative half width of TH", `<b>${fx(S.th.hw / S.th.mean * 100, 2)} %</b> with R = ${Rn}`], ["Replications for ± 1 % (R ≈ (t·s ÷ (0.01·x̄))², iterated)", `<b>${need(0.01)}</b>`], ["Replications for ± 0.5 %", `<b>${need(0.005)}</b>`], ["Breakdowns per machine per run ≈ busy time ÷ MTTF", `${fx(nBd, 1)} (cycle MTTF + MTTR = ${cyc} min) – aim for ≥ 10–20`], ["Warm-up deleted", `${fx(Math.min(p.days * 1440 * 0.1, 2880) / 60, 1)} h of ${p.days * 24} h`]]) +
    `<p class="am-note">Rules: (1) run length ≫ warm-up (≥ 10 ×) and ≫ the longest random cycle; (2) halving the half width needs 4 × the replications; (3) longer runs and more replications both narrow the CI – more replications also give independent samples, so prefer R ≥ 10;
    (4) for a terminating system (one shift, one order list) there is no warm-up deletion – the start state is part of the question.</p>`;
}

/* ================================================================== 4K Systematic Layout Planning */
function html4K() {
  const F = EX4._formulas;
  return card("f44K", "4K · Systematic Layout Planning (SLP, Muther) – closeness ratings, relationship diagram, space and aisles", "AEIOUX chart editable · SLP score and transport cost C for every layout · space and aisle calculators",
    guide({
      principle: `<p>Richard Muther's <b>SLP</b> (1961) plans a layout in steps: input data P-Q-R-S-T (product, quantity, routing, supporting services, time) → material flow + <b>activity relationships</b>
        → <b>relationship diagram</b> → space requirements → space relationship diagram → layout alternatives → evaluation. The material flow (4D from-to matrix) covers only transport;
        the relationship chart also covers non-flow reasons: shared people or equipment, supervision, noise, dust, safety, utilities.</p>
        <p>Each pair of departments gets a closeness rating: <b>A</b> absolutely necessary, <b>E</b> especially important, <b>I</b> important, <b>O</b> ordinary, <b>U</b> unimportant, <b>X</b> undesirable.
        To compare layouts the ratings get values and the score adds the values of all <b>adjacent</b> pairs (slots with distance 1).</p>
        <p class="phd-eq">score = Σ over adjacent pairs of value(rating) · A 16, E 8, I 4, O 2, U 0, X −64 · C = Σᵢ Σⱼ fᵢⱼ·dᵢⱼ (4D)<br>
        area = machines × (footprint + operator &amp; service) × (1 + allowance) · aisle one-way = w + 2c · two-way = 2w + 3c</p>
        <p class="sub">Formulas (shared): ${esc(F.slp_score)} · ${esc(F.space)} · ${esc(F.aisle)}</p>`,
      uses: USES4.K,
      howto: ["Fill the relationship chart in a workshop with production, logistics, maintenance, quality and safety – write a reason code for every A, E and X.",
        "Draw the relationship diagram first without areas (A pairs closest), then the space relationship diagram with real areas, then fit it into the building.",
        "Evaluate every layout alternative with BOTH numbers: transport cost C (flow) and SLP score (non-flow) – plus a weighted list of qualitative criteria (expansion, safety, cost).",
        "Space: start from the machine list (foundation plans), add operator / service areas, allowances for WIP and material, then aisles; compare with the building grid.",
        "Aisles: vehicle or load width + clearances; where AGVs and people share an aisle, add the protective clearance (ISO 3691-4) and mark pedestrian walkways."],
    }) + `
    <h3 class="fe-h3">Activity relationship chart (click a cell to change the rating)</h3>
    <div class="fe-row"><span class="sub">Values: ${Object.entries(RATING).map(([k, v]) => `<span class="f4-rt f4-r${k}">${k}</span> ${v}`).join(" · ")}</span><button class="mx-el" id="f4RelRst">Reset to example</button></div>
    <div class="fe-scroll"><table class="am-tab f4-rel" id="f4RelTab"></table></div>
    <div id="f4LyRes"></div>
    <div class="grid2"><div><div class="fe-row"><label>Diagram for <select id="f4LySel"><option value="start">start layout</option><option value="pe">pairwise exchange (min C)</option><option value="slp">pairwise exchange (max SLP score)</option></select></label></div>
        <svg id="f4RelD" class="fe-chart" role="img" aria-label="Relationship diagram"></svg><div class="sub">Lines: <span class="f4-rt f4-rA">A</span> 4 lines · <span class="f4-rt f4-rE">E</span> 3 · <span class="f4-rt f4-rI">I</span> 2 · <span class="f4-rt f4-rO">O</span> 1 · U none · <span class="f4-rt f4-rX">X</span> red zig-zag. Boxes = layout slots (4 × 2, 20 m).</div></div>
      <div id="f4LyWx"></div></div>
    <h3 class="fe-h3">Space requirement</h3>
    <div class="fe-row"><label>Aisle share <input type="number" step="any" id="f4SpA" value="${EX4.space.aisle_share}"></label><button class="mx-el" id="f4SpAdd">+ Department</button><button class="mx-el" id="f4SpRst">Reset</button></div>
    <div class="grid2"><div class="fe-scroll"><table class="am-tab fe-calc" id="f4SpTab"></table></div><div id="f4SpRes"></div></div>
    <h3 class="fe-h3">Aisle width</h3>
    <div class="fe-row fe-calc">${[["forklift_w", "Forklift width"], ["load_w", "Load width"], ["c", "Clearance c"], ["agv_w", "AGV width"], ["agv_people_clearance", "AGV clearance to people"]].map(([k, n]) => `<label>${n} <input type="number" step="any" id="f4Ai_${k}" value="${EX4.aisle[k]}"> m</label>`).join("")}</div>
    <div class="grid2"><div id="f4AiRes"></div><div><svg id="f4AiSk" class="fe-chart f4-aisk" role="img" aria-label="Aisle cross-section"></svg></div></div>`);
}
let REL = null, SPACE = null;
const relDefault = () => { const r = {}; EX4.layout.rel.forEach(([a, b, k]) => { let i = LY.depts.indexOf(a), j = LY.depts.indexOf(b); if (i > j) [i, j] = [j, i]; r[i + "-" + j] = k; }); return r; };
function init4K() {
  REL = store.get("rel", null) || relDefault();
  SPACE = store.get("space", null) || clone(EX4.space.depts);
  $("f4RelTab").addEventListener("click", (e) => { const c = e.target.closest("[data-p]"); if (!c) return; const ks = "AEIOUX", cur = REL[c.dataset.p] || "U"; REL[c.dataset.p] = ks[(ks.indexOf(cur) + 1) % 6]; store.set("rel", REL); calc4K(); });
  $("f4RelRst").addEventListener("click", () => { REL = relDefault(); store.del("rel"); calc4K(); });
  $("f4LySel").addEventListener("change", calc4K);
  $("f4SpTab").addEventListener("input", (e) => { const t = e.target, i = +t.dataset.i, k = +t.dataset.k; if (!Number.isFinite(i)) return; SPACE[i][k] = k === 0 ? t.value : num(t.value); store.set("space", SPACE); calcSpace(); });
  $("f4SpTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (b && SPACE.length > 1) { SPACE.splice(+b.dataset.del, 1); store.set("space", SPACE); drawSpaceIn(); calcSpace(); } });
  $("f4SpAdd").addEventListener("click", () => { SPACE.push(["New dept", 1, 10, 8, 0.3]); store.set("space", SPACE); drawSpaceIn(); calcSpace(); });
  $("f4SpRst").addEventListener("click", () => { SPACE = clone(EX4.space.depts); store.del("space"); $("f4SpA").value = EX4.space.aisle_share; drawSpaceIn(); calcSpace(); });
  $("f4SpA").addEventListener("input", calcSpace);
  Object.keys(EX4.aisle).forEach((k) => $("f4Ai_" + k).addEventListener("input", calcAisle));
  calc4K(); drawSpaceIn(); calcSpace(); calcAisle();
  // shared-example reference numbers
  const rd = relDefault(), st = LY.start, pe = pairwise(st, layCost), sl = pairwise(st, (l) => -layScore(l, rd).score);
  const sp = fSpace(EX4.space.depts, EX4.space.aisle_share), ai = fAisle(EX4.aisle);
  R.slp = { start: { layout: st, C: layCost(st), score: layScore(st, rd).score }, pairwise_C: { layout: pe.lay, swaps: pe.it, C: layCost(pe.lay), score: layScore(pe.lay, rd).score }, pairwise_score: { layout: sl.lay, swaps: sl.it, C: layCost(sl.lay), score: layScore(sl.lay, rd).score } };
  R.space = { depts: sp.rows.map((r) => [r.n, rnd(r.area, 3)]), sum_m2: rnd(sp.sum, 3), aisles_m2: rnd(sp.aisles, 3), total_m2: rnd(sp.total, 3), total_if_share_of_gross_m2: rnd(sp.totalGross, 3) };
  R.aisle = { w: ai.w, forklift_one_way_m: rnd(ai.one, 3), forklift_two_way_m: rnd(ai.two, 3), agv_one_way_m: rnd(ai.agvOne, 3), agv_two_way_m: rnd(ai.agvTwo, 3), agv_one_way_people_m: rnd(ai.agvOneP, 3), agv_two_way_people_m: rnd(ai.agvTwoP, 3) };
}
function calc4K() {
  const D = LY.depts, short = (s) => s.replace(" / prep", "").replace("Heat treat", "Heat tr.");
  let h = `<thead><tr><th></th>${D.map((d, j) => `<th class="f4-relh">${j + 1}</th>`).join("")}</tr></thead><tbody>`;
  D.forEach((d, i) => { h += `<tr><th class="f4-reln">${i + 1} ${esc(d)}</th>${D.map((_, j) => { if (j <= i) return `<td class="f4-relx"></td>`; const k = REL[i + "-" + j] || "U"; return `<td class="f4-relc" data-p="${i}-${j}" title="${esc(d)} – ${esc(D[j])}"><span class="f4-rt f4-r${k}">${k}</span></td>`; }).join("")}</tr>`; });
  $("f4RelTab").innerHTML = h + "</tbody>";
  const st = LY.start, pe = pairwise(st, layCost), sl = pairwise(st, (l) => -layScore(l, REL).score);
  const L = { start: { n: "Start layout", lay: st, it: 0 }, pe: { n: "Pairwise exchange – minimise C", lay: pe.lay, it: pe.it }, slp: { n: "Pairwise exchange – maximise SLP score", lay: sl.lay, it: sl.it } };
  const rows = Object.entries(L).map(([k, o]) => { const sc = layScore(o.lay, REL); return { k, ...o, C: layCost(o.lay), sc }; });
  R.slp_current = rows.map((r) => ({ k: r.k, C: r.C, score: r.sc.score, layout: r.lay }));
  const mini = (lay) => `<span class="f4-mini">${[0, 1].map((y) => `<span>${[0, 1, 2, 3].map((x) => { const s = LY.slots.findIndex((p) => p[0] === x && p[1] === y); return `<i>${esc(short(D[lay[s]]))}</i>`; }).join("")}</span>`).join("")}</span>`;
  $("f4LyRes").innerHTML = tab(["Layout", "Arrangement (4 × 2 slots)", "Swaps", "Transport cost C load·m/day", "SLP score", "Adjacent pairs with rating ≠ U"], rows.map((r) => `<tr${r.k === $("f4LySel").value ? ' class="fx-cur"' : ""}><td><b>${r.n}</b></td><td>${mini(r.lay)}</td><td>${r.it}</td><td><b>${fx(r.C, 0)}</b></td><td><b>${r.sc.score}</b></td><td class="f4-wide">${r.sc.pairs.filter((p) => p[2] !== "U").map((p) => `${esc(short(D[p[0]]))}–${esc(short(D[p[1]]))} <span class="f4-rt f4-r${p[2]}">${p[2]}</span>`).join(", ") || "–"}</td></tr>`), "f4-lyt") +
    `<p class="am-note">The two objectives do not always agree: the minimum-transport layout may still put an X pair side by side, the best-score layout may need more transport. Use both numbers (and qualitative criteria) to choose – or iterate: fix the X pairs, then minimise C.</p>`;
  drawRelDiagram(L[$("f4LySel").value].lay);
  const s0 = rows[0], s1 = rows[1];
  $("f4LyWx").innerHTML = wx("SLP score of the start layout (shared example)", [
    `Start layout (slot order, row 1 then row 2): ${st.map((d) => esc(D[d])).join(" · ")}.`,
    `Adjacent pairs (slot distance 1) with their ratings: ${s0.sc.pairs.map((p) => `${esc(short(D[p[0]]))}–${esc(short(D[p[1]]))} ${p[2]}`).join(", ")}.`,
    `Score = ${s0.sc.pairs.filter((p) => p[2] !== "U").map((p) => RATING[p[2]]).join(" + ") || "0"} = <b>${s0.sc.score}</b> (an X pair costs −64: Heat treat next to Assembly or Grinding next to Saw is heavily penalised).`,
    `After pairwise exchange on C (${s1.it} swaps): C falls from ${fx(s0.C, 0)} to <b>${fx(s1.C, 0)}</b> load·m/day and the score rises to <b>${s1.sc.score}</b>.`,
    `Pairwise exchange on the score alone reaches <b>${rows[2].sc.score}</b> with C = ${fx(rows[2].C, 0)} – a different compromise.`]);
}
function drawRelDiagram(lay) {
  const D = LY.depts, at = []; lay.forEach((d, s) => { at[d] = s; });
  const P = (d) => { const [x, y] = LY.slots[at[d]]; return [80 + x * 160, 95 + y * 150]; };
  const W = 640, Hh = 330; let s = "";
  const style = { A: [4, "f4-lA"], E: [3, "f4-lE"], I: [2, "f4-lI"], O: [1, "f4-lO"] };
  Object.entries(REL).forEach(([k, r]) => {
    if (r === "U") return; const [i, j] = k.split("-").map(Number), [x1, y1] = P(i), [x2, y2] = P(j);
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const arc = dy === 0 && Math.abs(dx) > 170, bow = arc ? (y1 < 150 ? -1 : 1) * (30 + Math.abs(dx) / 12) : 0;   // same row, not neighbours: bow around the boxes
    const ttl = `<title>${esc(D[i])} – ${esc(D[j])}: ${r}</title>`;
    if (r === "X") {
      if (arc) { s += `<path class="f4-lX f4-lXd" d="M${x1},${y1} Q${(x1 + x2) / 2},${y1 + 2 * bow} ${x2},${y2}">${ttl}</path>`; return; }
      let d = `M${x1},${y1}`; const n = Math.max(4, Math.round(L / 14)); for (let q = 1; q < n; q++) { const t = q / n, o = (q % 2 ? 6 : -6); d += ` L${(x1 + dx * t + nx * o).toFixed(1)},${(y1 + dy * t + ny * o).toFixed(1)}`; } d += ` L${x2},${y2}`; s += `<path class="f4-lX" d="${d}">${ttl}</path>`; return;
    }
    const [n, cls] = style[r];
    for (let q = 0; q < n; q++) {
      const o = (q - (n - 1) / 2) * 3.4;
      if (arc) s += `<path class="${cls} f4-arc" d="M${x1},${y1 + o} Q${(x1 + x2) / 2},${y1 + 2 * bow + o} ${x2},${y2 + o}">${ttl}</path>`;
      else s += `<line class="${cls}" x1="${(x1 + nx * o).toFixed(1)}" y1="${(y1 + ny * o).toFixed(1)}" x2="${(x2 + nx * o).toFixed(1)}" y2="${(y2 + ny * o).toFixed(1)}">${ttl}</line>`;
    }
  });
  D.forEach((d, i) => { const [x, y] = P(i); s += `<g class="f4-node"><rect x="${x - 58}" y="${y - 22}" width="116" height="44" rx="8"/><text x="${x}" y="${y + 4}" text-anchor="middle">${esc(d)}</text></g>`; });
  $("f4RelD").setAttribute("viewBox", `0 0 ${W} ${Hh}`); $("f4RelD").innerHTML = s;
}
function drawSpaceIn() {
  $("f4SpTab").innerHTML = `<thead><tr><th>Department</th><th>Machines</th><th>Footprint m²</th><th>Operator &amp; service m²</th><th>Allowance</th><th>Area m²</th><th></th></tr></thead><tbody>${SPACE.map((r, i) => `<tr><td><input type="text" class="f4-wn" data-i="${i}" data-k="0" value="${esc(r[0])}"></td>${[1, 2, 3, 4].map((k) => `<td><input type="number" step="any" data-i="${i}" data-k="${k}" value="${r[k]}"></td>`).join("")}<td class="f4-sa" data-a="${i}"></td><td><button class="mx-el fx-x" data-del="${i}">×</button></td></tr>`).join("")}</tbody>`;
}
function calcSpace() {
  const sh = num($("f4SpA").value, 0.25), sp = fSpace(SPACE.map((r) => [r[0], num(r[1]), num(r[2]), num(r[3]), num(r[4])]), sh);
  sp.rows.forEach((r, i) => { const c = document.querySelector(`#f4SpTab [data-a="${i}"]`); if (c) c.innerHTML = `<b>${fx(r.area, 1)}</b>`; });
  const t = sp.rows[0];
  $("f4SpRes").innerHTML = kpis([["Departments Σ", fx(sp.sum, 2) + " m²"], [`Aisles = ${fx(sh * 100, 0)} % of Σ`, fx(sp.aisles, 2) + " m²"], ["Total = Σ·(1 + share)", fx(sp.total, 2) + " m²"]]) +
    `<p class="sub">Interpretation used here (shared formula "total = sum + aisles share"): aisles = share × department sum. If your company defines the share as part of the <b>gross</b> area, total = Σ ÷ (1 − share) = ${fx(sp.totalGross, 1)} m².</p>
    ${t ? `<p class="phd-eq">${esc(t.n)}: ${t.m} × (${t.f} + ${t.o}) × (1 + ${t.a}) = ${fx(t.area, 1)} m²</p>` : ""}
    <p class="am-note">Add later: receiving / shipping, WIP and empty-pallet buffers, tool room, maintenance, quality lab, offices, social rooms, technical rooms (compressors, transformers) – typically 30–50 % on top of the production area.</p>`;
}
function calcAisle() {
  const a = {}; Object.keys(EX4.aisle).forEach((k) => { a[k] = num($("f4Ai_" + k).value, EX4.aisle[k]); });
  const r = fAisle(a);
  $("f4AiRes").innerHTML = tab(["Aisle", "Formula", "Width m"], [["Forklift / load, one-way", `w + 2c = ${fx(r.w, 2)} + 2 × ${fx(a.c, 2)}`, r.one], ["Forklift / load, two-way", `2w + 3c = 2 × ${fx(r.w, 2)} + 3 × ${fx(a.c, 2)}`, r.two], ["AGV one-way", `w_AGV + 2c`, r.agvOne], ["AGV two-way", `2w_AGV + 3c`, r.agvTwo], ["AGV one-way, people walk beside", `+ 2 × ${fx(a.agv_people_clearance, 2)} protective clearance`, r.agvOneP], ["AGV two-way, people walk beside", `+ 2 × ${fx(a.agv_people_clearance, 2)}`, r.agvTwoP]].map(([n, f, v]) => `<tr><td><b>${n}</b></td><td>${f}</td><td><b>${fx(v, 2)}</b></td></tr>`)) +
    `<p class="am-note">w = max(vehicle width, load width) = ${fx(r.w, 2)} m. Forklifts also need the turning aisle for stacking (data sheet "Ast", often 3–4 m for counterbalance trucks) – the formula above is for driving only. The ISO 3691-4 clearance is the idea; the real value comes from the AGV risk assessment.</p>`;
  // cross-section sketch: two-way forklift aisle
  const sc = 140, W = 680, Hh = 150, tot = r.two, x0 = (W - tot * sc) / 2; let s = `<line class="f4-sk" x1="${x0}" y1="110" x2="${x0 + tot * sc}" y2="110"/>`;
  let x = x0 + a.c * sc;
  [0, 1].forEach((k) => { s += `<rect class="f4-veh" x="${x}" y="50" width="${r.w * sc}" height="56" rx="4"/><text class="fe-tick" x="${x + r.w * sc / 2}" y="82" text-anchor="middle">w ${fx(r.w, 2)}</text>`; x += (r.w + a.c) * sc; });
  [[x0, x0 + a.c * sc], [x0 + (a.c + r.w) * sc, x0 + (2 * a.c + r.w) * sc], [x0 + (2 * a.c + 2 * r.w) * sc, x0 + tot * sc]].forEach(([p, q]) => { s += `<text class="fe-tick" x="${(p + q) / 2}" y="44" text-anchor="middle">c</text>`; });
  s += `<line class="f4-dimL" x1="${x0}" y1="128" x2="${x0 + tot * sc}" y2="128"/><text class="fe-tick" x="${W / 2}" y="144" text-anchor="middle">two-way aisle = 2w + 3c = ${fx(tot, 2)} m</text><line class="f4-wall" x1="${x0}" y1="20" x2="${x0}" y2="112"/><line class="f4-wall" x1="${x0 + tot * sc}" y1="20" x2="${x0 + tot * sc}" y2="112"/>`;
  $("f4AiSk").setAttribute("viewBox", `0 0 ${W} ${Hh}`); $("f4AiSk").innerHTML = s;
}

/* ================================================================== 4L layout patterns & detailed rules */
function html4L() {
  return card("f44L", "4L · FMS layout patterns and detailed layout rules", "sketches with example dimensions · checklist for the detailed layout (ticks are saved in this browser)",
    guide({
      principle: `<p>After the block layout (4D, 4K) comes the <b>detailed layout</b>: each machine with its real footprint, service areas, transport system and utilities. FMS and automated systems use a few
        recurring <b>patterns</b>. The pattern follows the transport system: a rail-guided vehicle or stacker gives a linear pool, AGVs and conveyors give loops, manual work gives U-cells,
        robot cells are boxes with a fence and a load side, assembly gives lines. Choose the pattern first, then check every detailed rule.</p>
        <p>The dimensions in the sketches are <b>examples</b> to give a feeling for the scale – real values come from the supplier foundation plans and the safety risk assessment.</p>`,
      uses: [["Machining FMS", "Linear pallet pool with 4 HMCs and a 2-level rack – expansion by extending the rail (keep the end free)."], ["Assembly", "Compressor final assembly as a line with AGV carriers; leak and run test at the end in a noise-protected booth."], ["Welding", "Two robot cells with turntables side by side share one operator and one fume extraction unit."], ["Mixed plant", "Loop AGV system connects machining, washing, measuring and assembly without fixed conveyors."]],
      howto: ["Get the foundation plan and installation drawing of every machine (footprint, service areas, door swing, chip conveyor exit, utility connections).",
        "Draw the detailed layout in CAD on the building grid (columns!); one layer per discipline: machines, transport, utilities, safety, escape routes.",
        "Walk through the layout with maintenance, safety officer and logistics using the checklist below; mark every open point.",
        "Freeze the layout before ordering foundations – late changes cost concrete."],
    }) + `
    <div class="f4-pats">${PATTERNS.map((p) => `<div class="fx-box f4-pat"><h4>${esc(p[1])}</h4><svg class="fe-chart" viewBox="0 0 320 190" role="img" aria-label="${esc(p[1])} sketch">${sketch(p[0])}</svg><p>${esc(p[2])}</p><p><b>Example:</b> ${esc(p[3])}</p><p><b>Best for:</b> ${esc(p[4])}</p><p><b>Watch out:</b> ${esc(p[5])}</p></div>`).join("")}</div>
    <h3 class="fe-h3">Detailed layout rules – checklist</h3><div class="fe-row"><span class="sub" id="f4RuCnt"></span><button class="mx-el" id="f4RuRst">Clear ticks</button></div>
    <div class="f4-rules" id="f4Ru">${RULES.map((r, i) => `<label class="f4-rule"><input type="checkbox" data-ru="${i}"><span><b>${esc(r[0])}</b> – ${esc(r[1])}</span></label>`).join("")}</div>`);
}
function sketch(k) {
  const M = (x, y, w, h, t) => `<rect class="f4-mach" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><text class="f4-skt" x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle">${t}</text>`;
  const dim = (x1, y1, x2, y2, t, vert) => `<line class="f4-dimL" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><text class="f4-skd" x="${vert ? x1 - 4 : (x1 + x2) / 2}" y="${vert ? (y1 + y2) / 2 : y1 - 4}" text-anchor="${vert ? "end" : "middle"}">${t}</text>`;
  if (k === "linear") return [0, 1, 2, 3].map((i) => M(30 + i * 62, 20, 50, 46, "HMC" + (i + 1))).join("") + `<rect class="f4-rail" x="20" y="84" width="270" height="12"/><text class="f4-skt" x="155" y="93" text-anchor="middle">rail / RGV 34 m</text>` + [...Array(8)].map((_, i) => `<rect class="f4-rack" x="${30 + i * 31}" y="108" width="27" height="26"/>`).join("") + M(268, 108, 34, 26, "L/U") + dim(30, 158, 278, 158, "≈ 34 m") + `<text class="f4-skd" x="155" y="180" text-anchor="middle">rack 2 levels × 16 · machines 7 m pitch · expansion →</text><rect class="f4-exp" x="292" y="20" width="22" height="46"/>`;
  if (k === "loop") return `<rect class="f4-loop" x="40" y="40" width="240" height="100" rx="40"/>` + [[60, 8], [140, 8], [220, 8], [60, 146], [140, 146], [220, 146]].map(([x, y], i) => M(x, y, 46, 28, ["Mill", "Mill", "Wash", "CMM", "Asm", "L/U"][i])).join("") + [[100, 36], [250, 70], [170, 136], [44, 100]].map(([x, y]) => `<rect class="f4-agv" x="${x}" y="${y}" width="16" height="10" rx="2"/>`).join("") + `<text class="f4-skt" x="160" y="94" text-anchor="middle">AGV loop, one direction</text>` + dim(40, 186, 280, 186, "≈ 60 m") + `<text class="f4-skd" x="300" y="94">24 m</text>`;
  if (k === "ucell") return M(40, 30, 50, 34, "OP10") + M(110, 20, 50, 34, "OP20") + M(180, 20, 50, 34, "OP30") + M(250, 30, 50, 34, "OP40") + M(250, 110, 50, 34, "Test") + M(40, 110, 50, 34, "In") + `<path class="f4-walk" d="M90 128 Q 70 80 100 70 L 230 70 Q 260 80 245 120"/><text class="f4-skt" x="165" y="104" text-anchor="middle">operator walks inside the U (1.5 m)</text><text class="f4-skd" x="65" y="160" text-anchor="middle">entry</text><text class="f4-skd" x="275" y="160" text-anchor="middle">exit</text>` + dim(40, 180, 300, 180, "≈ 8 m") + dim(20, 20, 20, 144, "6 m", true);
  if (k === "weld") return `<rect class="f4-fence" x="40" y="20" width="240" height="140"/><circle class="f4-mach" cx="110" cy="90" r="46"/><line class="f4-sk" x1="64" y1="90" x2="156" y2="90"/><text class="f4-skt" x="110" y="70" text-anchor="middle">turntable Ø 2.5 m</text>` + M(190, 60, 50, 50, "Robot") + `<line class="f4-curtain" x1="40" y1="30" x2="40" y2="150"/><text class="f4-skd" x="30" y="94" text-anchor="end">light curtain</text><text class="f4-skt" x="160" y="150" text-anchor="middle">fence · fume extraction above</text>` + dim(40, 182, 280, 182, "≈ 6 m") + dim(296, 20, 296, 160, "5 m", true).replace('text-anchor="end"', 'text-anchor="start"').replace(/x="292"/, 'x="300"');
  return [...Array(6)].map((_, i) => M(16 + i * 50, 70, 42, 34, "S" + (i + 1))).join("") + `<rect class="f4-rail" x="10" y="108" width="300" height="10"/><text class="f4-skt" x="160" y="132" text-anchor="middle">conveyor / AGV carriers at takt</text>` + [...Array(6)].map((_, i) => `<rect class="f4-rack" x="${18 + i * 50}" y="30" width="38" height="20"/>`).join("") + `<text class="f4-skd" x="160" y="24" text-anchor="middle">line-side supply racks / kitting</text>` + dim(16, 160, 306, 160, "12 stations × 2 m = 24 m (6 shown)");
}
function init4L() {
  const t = store.get("rules", {});
  document.querySelectorAll("#f4Ru [data-ru]").forEach((c) => { c.checked = !!t[c.dataset.ru]; });
  const cnt = () => { const n = document.querySelectorAll("#f4Ru [data-ru]:checked").length; $("f4RuCnt").textContent = `${n} of ${RULES.length} rules checked`; };
  $("f4Ru").addEventListener("change", (e) => { const c = e.target; if (c.dataset.ru == null) return; const s = store.get("rules", {}); s[c.dataset.ru] = c.checked; store.set("rules", s); cnt(); });
  $("f4RuRst").addEventListener("click", () => { store.del("rules"); document.querySelectorAll("#f4Ru [data-ru]").forEach((c) => { c.checked = false; }); cnt(); });
  cnt();
}

/* ================================================================== 4M simulation project & tools */
function html4M() {
  return card("f44M", "4M · Simulation project and tools – VDI 3633 steps, data templates, verification &amp; validation, software", "checklist saved in this browser · templates as CSV · buy list without invented facts",
    guide({
      principle: `<p>A simulation study is a small project with a clear question. The German guideline <b>VDI 3633</b> (simulation of logistics, material flow and production systems) describes the procedure:
        goal → task specification → system analysis → formal model → implementation → experiments and analysis, with <b>data collection</b> and <b>verification &amp; validation (V&amp;V)</b> running in parallel
        to all steps. Most failed studies fail at the start (unclear question, no agreed assumptions) or at the data – not in the software.</p>
        <p><b>Verification</b> = is the model built right (does it do what we specified)? <b>Validation</b> = is it the right model (does it behave like the real system for the question)?
        A model is never "valid" in general – only valid for a purpose and a range of inputs.</p>`,
      uses: USES4.M,
      howto: ["Write a one-page study charter: question, KPIs, scenarios, scope, data owner, deadline, decision maker.",
        "Do the analytic check first (bottleneck, MVA, queueing – 4G, 4I): it tells you the expected answer range and often already answers the question.",
        "Keep an assumptions list and get it signed – every later discussion goes back to it.",
        "Report results with confidence intervals (4J) and the V&V evidence; hand over model + data + report.",
        "Plan from the start whether the model will live on as a digital twin (data interfaces, naming, version control)."],
    }) + `
    <h3 class="fe-h3">VDI 3633 – steps of a simulation study (tick what is done)</h3><div class="fe-row"><div class="fe-prog f4-prog"><i id="f4VdBar"></i></div><span class="sub" id="f4VdCnt"></span><button class="mx-el" id="f4VdRst">Clear ticks</button></div>
    <div class="f4-vdi" id="f4Vd">${VDI.map(([st, items], i) => `<div class="fx-box"><h4>${esc(st)}</h4>${items.map((t, j) => `<label class="f4-rule"><input type="checkbox" data-vd="${i}.${j}"><span>${esc(t)}</span></label>`).join("")}</div>`).join("")}</div>
    <h3 class="fe-h3">Data collection templates</h3>
    <div class="f4-tpls">${TEMPLATES.map((t, i) => `<div class="fx-box"><h4>${esc(t[0])} <button class="mx-el fx-x" data-tpl="${i}">CSV</button></h4>${tab(t[1].map(esc), [`<tr>${t[2].map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`], "f4-small")}</div>`).join("")}</div>
    <h3 class="fe-h3">Verification and validation checks</h3>
    ${tab(["Kind", "Check", "How"], VV.map((r) => `<tr><td>${esc(r[0])}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td></tr>`))}
    <div class="fe-row"><button class="mx-el" id="f4VvRun">Run the automatic checks on the 4E model</button><span class="sub" id="f4VvMsg"></span></div><div id="f4VvRes"></div>
    <h3 class="fe-h3">Software buy list – simulation and layout</h3>
    <p class="sub">Only general facts are listed; licence terms, offline use and prices change – <b>check on the maker's website and ask for a quote</b>. Price class for all commercial tools: estimate – ask for a quote.</p>
    ${tab(["Product", "Maker", "Type", "Licence model", "Offline use", "Typical use", "Price class"], SOFTWARE.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td class="f4-wide">${esc(r[5])}</td><td>${/open source/i.test(r[3]) ? "free (open source) – own effort for modelling" : "estimate – ask for a quote"}</td></tr>`), "f4-sw")}
    <p class="am-note">For this offline factory PC: the open-source Python libraries (SimPy, Salabim) and JaamSim run without any internet connection; the browser models on this page (4E, 4I, 4J) also run fully offline and are good for first studies and for checking the results of a commercial tool.</p>`);
}
function init4M() {
  const cnt = () => { const all = document.querySelectorAll("#f4Vd [data-vd]"), n = document.querySelectorAll("#f4Vd [data-vd]:checked").length; $("f4VdCnt").textContent = `${n} of ${all.length} tasks done`; $("f4VdBar").style.width = (n / all.length * 100).toFixed(1) + "%"; };
  const t = store.get("vdi", {});
  document.querySelectorAll("#f4Vd [data-vd]").forEach((c) => { c.checked = !!t[c.dataset.vd]; });
  $("f4Vd").addEventListener("change", (e) => { const c = e.target; if (c.dataset.vd == null) return; const s = store.get("vdi", {}); s[c.dataset.vd] = c.checked; store.set("vdi", s); cnt(); });
  $("f4VdRst").addEventListener("click", () => { store.del("vdi"); document.querySelectorAll("#f4Vd [data-vd]").forEach((c) => { c.checked = false; }); cnt(); });
  document.querySelector("#f44M .f4-tpls").addEventListener("click", (e) => { const b = e.target.closest("[data-tpl]"); if (!b) return; const t = TEMPLATES[+b.dataset.tpl]; download(t[0].toLowerCase().replace(/[^a-z0-9]+/g, "_") + "_template.csv", toCSV([t[1], t[2]]), "text/csv"); });
  $("f4VvRun").addEventListener("click", runVV);
  cnt();
}
function runVV() {
  $("f4VvMsg").textContent = "running…";
  setTimeout(() => {
    const b = simBase(), th = theory(b);
    // 1 deterministic, no breakdowns, one part type, N large → TH = bottleneck rate exactly (after warm-up)
    const det = { ...b, loadCv: 0, mttf: 0, parts: [["Det", 100, 57.6, 0]], N: 12, seed: 1 }, rd = simFMS(det, false), rbDet = Math.min(det.m / 57.6, det.L / det.load, det.V / (2 * det.move)) * 60;
    // 2 deterministic N = 1 → loop time = T0 = load + 2 moves + machining
    const one = simFMS({ ...det, N: 1 }, false), T0 = det.load + 2 * det.move + 57.6;
    // 3 Little + bound on the stochastic model (seed 1)
    const st = simFMS({ ...b, seed: 1 }, false), little = st.th / 60 * st.ct;
    const chk = [["Deterministic, N = 12: TH = r_b", `${fx(rd.th, 4)} vs ${fx(rbDet, 4)} /h`, Math.abs(rd.th / rbDet - 1) < 0.01],
      ["Deterministic, N = 1: loop time = T₀", `${fx(one.ct, 3)} vs ${fx(T0, 3)} min`, Math.abs(one.ct - T0) < 0.01],
      ["Little's law (stochastic, seed 1): N = TH × loop time", `${fx(little, 3)} vs ${b.N}`, Math.abs(little - b.N) / b.N < 0.03],
      ["Bound: TH ≤ r_b (stochastic)", `${fx(st.th, 3)} ≤ ${fx(th.bn[1] * 60, 3)} /h`, st.th <= th.bn[1] * 60 * 1.001],
      ["Utilisation ≤ 100 %", `machines ${fx(st.uM * 100, 1)} %, load ${fx(st.uL * 100, 1)} %, vehicle ${fx(st.uV * 100, 1)} %`, st.uM <= 1 + 1e-9 && st.uL <= 1 + 1e-9 && st.uV <= 1 + 1e-9]];
    R.vv = chk.map(([n, v, o]) => ({ n, v, ok: o }));
    $("f4VvRes").innerHTML = tab(["Check", "Result", "Pass"], chk.map(([n, v, o]) => `<tr><td><b>${n}</b></td><td>${v}</td><td>${ok(o, "pass", "fail")}</td></tr>`)) + `<p class="sub">Little's law holds only approximately in a finite run (pallets in process at the start / end of the statistics window, warm-up cut) – a tolerance of 3 % is used.</p>`;
    $("f4VvMsg").textContent = "done";
  }, 20);
}
