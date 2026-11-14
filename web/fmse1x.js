/* FMS engineering – item 1, deep sections 1F–1M (loaded by fmse.js at the end of item 1).
 * 1F flexibility types · 1G system economics · 1H project schedule (CPM) · 1I business case · 1J risk register
 * 1K requirements → URS · 1L acceptance tests · 1M module deep dive + N² interface matrix.
 * Example numbers: EX in fmse1x_data.js = copy of tools/fmse/examples/item1_examples.json (same formulas as guide docs/61 and tools/fmse/*.py).
 * Everything runs offline in the browser; user edits are kept in localStorage keys "fmse.1x.*". */
import { EX, FLEX, FLEXREF, FLEXUSE, ECOUSE, CPMUSE, BCUSE, RISKUSE, VAGUE, VERIFY, UNITS, REQEX, URSCH, URSUSE, CPKEX, ACCUSE, MODDEEP, MODUSE_NOTE } from "./fmse1x_data.js";
import { MODULES, QUEST } from "./fmse_data.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const eur = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en") + " €" : "–");
const clone = (o) => JSON.parse(JSON.stringify(o));
const store = {   // own keys "fmse.1x.<k>"; raw() reads any key (e.g. the questionnaire "fmse.answers")
  get(k, d) { try { const v = localStorage.getItem("fmse.1x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.1x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  raw(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
};
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;   // items are trusted HTML strings written here

/* common guide block: principle text, use cases, real-project bullets (all static, written in this file / data file) */
function guide({ principle, uses, howto }) {
  return `<div class="fx-guide">
    <div class="fx-prin"><h3 class="fe-h3">Principle</h3>${principle}</div>
    <details class="fx-more"><summary><b>Use cases</b> <span class="sub">different domains</span></summary>
      <div class="fx-uses">${uses.map(([d, t]) => `<div class="fx-use"><b>${esc(d)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>
    <details class="fx-more"><summary><b>How to use it in a real project</b></summary>${ul(howto)}</details></div>`;
}
const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;

/* ------------------------------------------------------------------ generic SVG x-y chart (linear or log axes) */
function xyChart(svg, { series, xlog, ylog, xmin, xmax, ymin, ymax, xl, yl, vmarks = [], hmarks = [], W = 680, H = 320, xfmt, yfmt }) {
  const x0 = 64, x1 = W - 16, y0 = H - 42, y1 = 14;
  const tx = (v) => (xlog ? Math.log10(v) : v), ty = (v) => (ylog ? Math.log10(v) : v);
  const X = (v) => x0 + (tx(v) - tx(xmin)) / (tx(xmax) - tx(xmin) || 1) * (x1 - x0);
  const Y = (v) => y0 - (ty(Math.min(Math.max(v, ymin), ymax)) - ty(ymin)) / (ty(ymax) - ty(ymin) || 1) * (y0 - y1);
  const ticks = (lo, hi, log) => {
    if (log) { const a = []; for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) [1, 2, 5].forEach((m) => { const v = m * 10 ** e; if (v >= lo * 0.999 && v <= hi * 1.001) a.push(v); }); return a; }
    const raw = (hi - lo) / 6, p = 10 ** Math.floor(Math.log10(raw || 1)), st = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) || p;
    const a = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) a.push(+v.toFixed(10)); return a;
  };
  const kfmt = (v) => (Math.abs(v) >= 1e6 ? fx(v / 1e6, v % 1e6 ? 1 : 0) + "M" : Math.abs(v) >= 1e3 ? fx(v / 1e3, v % 1e3 ? 1 : 0) + "k" : fx(v, Math.abs(v) < 10 && v % 1 ? 1 : 0));
  let s = "";
  ticks(ymin, ymax, ylog).forEach((v) => { const y = Y(v); s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${(yfmt || kfmt)(v)}</text>`; });
  ticks(xmin, xmax, xlog).forEach((v) => { const x = X(v); s += `<line class="fe-grid" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${x}" y="${y0 + 15}" text-anchor="middle">${(xfmt || kfmt)(v)}</text>`; });
  hmarks.forEach(([v, cls, lab, left]) => { const y = Y(v); s += `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>${lab ? `<text class="fe-tick" x="${left ? x0 + 6 : x1 - 4}" y="${y - 5}" text-anchor="${left ? "start" : "end"}">${esc(lab)}</text>` : ""}`; });
  vmarks.forEach(([v, cls, lab]) => { const x = X(v); s += `<line class="${cls}" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/>${lab ? `<text class="fe-tick" x="${x + 4}" y="${y1 + 10}">${esc(lab)}</text>` : ""}`; });
  series.forEach((sr) => {
    const pts = sr.pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b)).map(([a, b]) => [X(a), Y(b)]);
    s += `<polyline class="fx-ln ${sr.cls}" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
    if (sr.dots) pts.forEach(([a, b]) => { s += `<circle class="fx-dot ${sr.cls}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3.2"/>`; });
  });
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text><text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  return series.filter((sr) => sr.n).map((sr) => `<span class="fx-lg"><i class="${sr.cls}"></i>${esc(sr.n)}</span>`).join(" ");
}

/* ================================================================== mount */
export function mount(el) {
  el.innerHTML = [html1F(), html1G(), html1H(), html1I(), html1J(), html1K(), html1L(), html1M()].join("");
  init1F(); init1G(); init1H(); init1I(); init1J(); init1K(); init1L(); init1M();
  window.fe1x = { results };   // for tests / cross-checks: window.fe1x.results()
}
const R = {};   // latest key results of every section (read by tests)
const results = () => clone(R);

/* ================================================================== 1F flexibility types */
function html1F() {
  return card("fx1F", "1F · Flexibility – the 8 types (Browne et al. 1984) and your flexibility profile", "‘flexible’ is not one property · measure each type · design only for the types you need",
    guide({
      principle: `<p>Browne, Dubois, Rathmill, Sethi and Stecke (1984) split "flexibility" into 8 types. Each type answers a different question:
        can the machine change quickly (machine), can parts run mixed (process), can new parts come in (product), can work go around a broken
        machine (routing), can the system live with low and high volume (volume), can it grow (expansion), can operations change order
        (operation), how big is the part universe (production). <b>Every type costs money</b> – a good design buys only the types the business needs
        (from the questionnaire 1D: variety, volume trend, new parts, availability target).</p>`,
      uses: FLEXUSE,
      howto: ["In phase P1 ask the sponsor which changes will really come in 5 years (new parts? volume ±? breakdown risk?) → rate the needed level 1–5 per type.",
        "Rate each concept variant in P2 with the same 8 types – the radar shows where a variant is weak.",
        "Write the important types into the URS as numbers (1K): e.g. 'new part in ≤ 3 weeks', 'one machine down → ≥ 60 % output'.",
        "Do not pay for flexibility nobody uses: a transfer line is correct when volume is high and the product is stable."],
    }) + `
    <div class="fe-scroll"><table class="am-tab fx-flex"><thead><tr><th>Type</th><th>Definition</th><th>How to measure (indicator)</th><th>Example</th><th>How to design for it</th><th>Cost</th></tr></thead>
      <tbody>${FLEX.map(([, n, d, m, e, g, c, cn]) => `<tr><td><b>${esc(n)}</b></td><td>${esc(d)}</td><td>${esc(m)}</td><td>${esc(e)}</td><td>${esc(g)}</td><td><span class="fx-cost">${"€".repeat(c)}</span> <span class="sub">${esc(cn)}</span></td></tr>`).join("")}</tbody></table></div>
    <div class="grid2 eq">
      <div><h3 class="fe-h3">Your flexibility profile <span class="sub">rate your system (or a variant) 1 = very low … 5 = very high</span></h3>
        <div class="fx-rates" id="fxFlexIn"></div>
        <div class="fe-row"><label>Compare with <select id="fxFlexRef">${Object.entries(FLEXREF).map(([k, r]) => `<option value="${k}">${esc(r.n)} (typical)</option>`).join("")}</select></label>
          <label>Needed level (target) <input type="number" id="fxFlexTgt" min="1" max="5" step="1"></label>
          <button class="mx-el" id="fxFlexRst">Example ratings</button></div>
        <div id="fxFlexAdv"></div></div>
      <div><svg id="fxRadar" class="fe-chart fx-radar" role="img" aria-label="Flexibility radar chart"></svg><div class="sub" id="fxRadarLg"></div></div>
    </div>
    <h3 class="fe-h3">Indicator calculator <span class="sub">three flexibility types that you can measure today on the shop floor</span></h3>
    <div class="fx-calc3">
      <div class="fx-box"><h4>Machine flexibility – changeover share</h4><div class="fe-row fe-calc"><label>t_ch <input type="number" id="fxMch" value="45" step="any"> min</label><label>lot <input type="number" id="fxMlot" value="40" step="1"></label><label>t_cycle <input type="number" id="fxMcy" value="6" step="any"> min</label></div><div id="fxMres"></div></div>
      <div class="fx-box"><h4>Volume flexibility</h4><div class="fe-row fe-calc"><label>Q_min profitable <input type="number" id="fxVmin" value="9000" step="any"></label><label>Q_max capacity <input type="number" id="fxVmax" value="42000" step="any"></label></div><div id="fxVres"></div></div>
      <div class="fx-box"><h4>Routing flexibility</h4><div class="fe-row fe-calc"><label>Operations <input type="number" id="fxRops" value="6" step="1"></label><label>Σ capable machines over all operations <input type="number" id="fxRcap" value="15" step="1"></label><label>Machines m <input type="number" id="fxRm" value="3" step="1"></label></div><div id="fxRres"></div></div>
    </div>`);
}
const FLEX_EX = [3, 4, 3, 2, 3, 2, 3, 4];
function init1F() {
  const st = store.get("flex", { v: FLEX_EX.slice(), ref: "fms", tgt: 3 });
  const draw = () => {
    store.set("flex", st);
    const ref = FLEXREF[st.ref] || FLEXREF.fms;
    // radar: 8 axes, radius 1..5
    const W = 460, H = 380, cx = 230, cy = 192, r0 = 140, n = FLEX.length;
    const P = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n, rr = r0 * v / 5; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
    let s = "";
    for (let k = 1; k <= 5; k++) s += `<polygon class="fx-rgrid" points="${FLEX.map((_, i) => P(i, k).join(",")).join(" ")}"/>`;
    FLEX.forEach((f, i) => {
      const [x, y] = P(i, 5), [lx, ly] = P(i, 5.9);
      s += `<line class="fe-grid" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text class="fe-tick fx-rl" x="${lx}" y="${ly + 4}" text-anchor="${Math.abs(lx - cx) < 10 ? "middle" : lx > cx ? "start" : "end"}">${esc(f[1].replace(" flexibility", ""))}</text>`;
    });
    s += `<polygon class="fx-rtgt" points="${FLEX.map((_, i) => P(i, st.tgt).join(",")).join(" ")}"/>`;
    s += `<polygon class="fx-rref" points="${ref.v.map((v, i) => P(i, v).join(",")).join(" ")}"/>`;
    s += `<polygon class="fx-ryou" points="${st.v.map((v, i) => P(i, v).join(",")).join(" ")}"/>`;
    st.v.forEach((v, i) => { const [x, y] = P(i, v); s += `<circle class="fx-rdot" cx="${x}" cy="${y}" r="4"/>`; });
    $("fxRadar").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fxRadar").innerHTML = s;
    $("fxRadarLg").innerHTML = `<span class="fx-lg"><i class="fx-s1"></i>your system</span> <span class="fx-lg"><i class="fx-s2"></i>${esc(ref.n)} (typical)</span> <span class="fx-lg"><i class="fx-s4"></i>needed level ${st.tgt}</span>`;
    const weak = FLEX.map((f, i) => ({ f, v: st.v[i], r: ref.v[i] })).filter((x) => x.v < st.tgt);
    const avg = st.v.reduce((a, b) => a + b, 0) / n;
    R.flex = { ratings: st.v.slice(), average: +avg.toFixed(2), weak: weak.map((x) => x.f[0]) };
    $("fxFlexAdv").innerHTML = `<p class="fe-big">Average <b>${fx(avg, 1)}</b> / 5 · ${weak.length ? `<span class="fe-no">${weak.length} type(s) below the needed level ${st.tgt}</span>` : `<span class="fe-ok">all types reach the needed level ${st.tgt}</span>`}</p>
      ${weak.length ? `<table class="am-tab"><thead><tr><th>Weak type</th><th>You</th><th>${esc(ref.n)}</th><th>What to do</th></tr></thead><tbody>${weak.map((x) => `<tr><td><b>${esc(x.f[1])}</b></td><td>${x.v}</td><td>${x.r}</td><td>${esc(x.f[5])} <span class="sub">Cost: ${"€".repeat(x.f[6])}</span></td></tr>`).join("")}</tbody></table>` : ""}`;
  };
  $("fxFlexIn").innerHTML = FLEX.map((f, i) => `<label class="fx-rate"><span>${esc(f[1])}</span><input type="range" min="1" max="5" step="1" data-fi="${i}" value="${st.v[i]}"><b id="fxFv${i}">${st.v[i]}</b></label>`).join("");
  $("fxFlexRef").value = st.ref; $("fxFlexTgt").value = st.tgt;
  $("fxFlexIn").addEventListener("input", (e) => { const i = e.target.dataset.fi; if (i == null) return; st.v[i] = +e.target.value; $("fxFv" + i).textContent = e.target.value; draw(); });
  $("fxFlexRef").addEventListener("change", () => { st.ref = $("fxFlexRef").value; draw(); });
  $("fxFlexTgt").addEventListener("input", () => { st.tgt = Math.min(5, Math.max(1, Math.round(+$("fxFlexTgt").value || 3))); draw(); });
  $("fxFlexRst").addEventListener("click", () => { st.v = FLEX_EX.slice(); st.ref = "fms"; st.tgt = 3; $("fxFlexRef").value = "fms"; $("fxFlexTgt").value = 3; st.v.forEach((v, i) => { document.querySelector(`[data-fi="${i}"]`).value = v; $("fxFv" + i).textContent = v; }); draw(); });
  draw();
  // indicators
  const calc = () => {
    const tch = +$("fxMch").value, lot = +$("fxMlot").value, tc = +$("fxMcy").value, s = tch / (lot * tc + tch);
    $("fxMres").innerHTML = `<p class="phd-eq">s = t_ch ÷ (lot × t_cycle + t_ch) = ${fx(tch, 1)} ÷ (${fx(lot, 0)} × ${fx(tc, 1)} + ${fx(tch, 1)}) = <b>${fx(s * 100, 1)} %</b></p>
      <p>${s <= 0.05 ? '<span class="fe-ok">≤ 5 % – changeover is not a problem.</span>' : `<span class="fe-no">&gt; 5 % – reduce t_ch (SMED, set-up outside the machine) or make bigger lots. To reach 5 %: t_ch ≤ ${fx(0.05 * lot * tc / 0.95, 1)} min.</span>`}</p>`;
    const qmin = +$("fxVmin").value, qmax = +$("fxVmax").value, vf = 1 - qmin / qmax;
    $("fxVres").innerHTML = `<p class="phd-eq">VF = 1 − Q_min ÷ Q_max = 1 − ${fx(qmin, 0)} ÷ ${fx(qmax, 0)} = <b>${fx(vf, 2)}</b></p>
      <p>${vf >= 0.7 ? '<span class="fe-ok">High – profitable from 30 % load.</span>' : vf >= 0.4 ? "Medium." : '<span class="fe-no">Low – the system needs high load to earn money (high fixed cost share).</span>'} <span class="sub">Q_min from 1G: volume where cost per part = your target price.</span></p>`;
    const ops = +$("fxRops").value, cap = +$("fxRcap").value, m = +$("fxRm").value, r = cap / ops;
    $("fxRres").innerHTML = `<p class="phd-eq">r = Σ capable machines ÷ operations = ${fx(cap, 0)} ÷ ${fx(ops, 0)} = <b>${fx(r, 2)}</b> of ${fx(m, 0)} machines</p>
      <p>${r >= 2 ? '<span class="fe-ok">Every operation has on average ≥ 2 machines – a breakdown does not stop the flow.</span>' : '<span class="fe-no">r &lt; 2 – some operations have only one machine: a breakdown stops those parts.</span>'} <span class="sub">Full routing flexibility: r = m.</span></p>`;
    R.flexInd = { s: +s.toFixed(4), VF: +vf.toFixed(3), r: +r.toFixed(2) };
  };
  ["fxMch", "fxMlot", "fxMcy", "fxVmin", "fxVmax", "fxRops", "fxRcap", "fxRm"].forEach((id) => $(id).addEventListener("input", calc));
  calc();
}

/* ================================================================== 1G system economics */
const crf = (i, n) => (i === 0 ? 1 / n : i * (1 + i) ** n / ((1 + i) ** n - 1));
// annual cost of one system type for total volume Q and N changeovers per year (exact JSON formula)
function annual(t, Q, N, CRF) {
  const units = Math.ceil(Q / t.cap_per_unit);
  const cap = units * t.I_MEUR * 1e6 * CRF, fixed = units * t.F_MEUR * 1e6, vari = Q * t.v_EUR, ch = N * t.c_ch_EUR, C = cap + fixed + vari + ch;
  return { units, cap, fixed, vari, ch, C, cpp: C / Q };
}
const ECO_COL = { cnc: "fx-s1", fmc: "fx-s2", fms: "fx-s3", ftl: "fx-s4" };
function html1G() {
  return card("fx1G", "1G · System economics – which system type is cheapest per part?", "annual cost model with capital recovery factor · 4 system types × 3 scenarios · edit any number",
    guide({
      principle: `<p>Every system type has a different cost structure: a flexible transfer line has <b>high investment but low cost per part</b>; a stand-alone CNC cell
        has low investment but high labour per part and expensive changeovers. Which one is cheaper depends on <b>total volume</b> and <b>number of changeovers</b>.
        We turn the investment into an equal yearly amount with the <b>capital recovery factor</b> (CRF) and add the yearly fixed, variable and changeover costs.</p>
        <p class="phd-eq">CRF = i(1+i)<sup>n</sup> ÷ ((1+i)<sup>n</sup> − 1) · units = ⌈Q ÷ cap⌉ · C = units·I·CRF + units·F + Q·v + N·c<sub>ch</sub> · cost per part = C ÷ Q</p>
        <p class="sub">Q = variety × quantity per part number; N = variety × orders per part number per year (each order = one changeover).</p>`,
      uses: ECOUSE,
      howto: ["Get I, F, v, cap and c_ch for each variant from budget offers (P2) – v = labour + tools + energy + consumables per part.",
        "Use the 5-year volume (questionnaire Q06), not today's volume, and run all 3 scenarios: pessimistic, expected, optimistic.",
        "Look at the break-even volumes: if your volume is close to a switch point, choose the type with more volume / expansion flexibility (1F).",
        "Put the cheapest variant into the business case (1I): saving = today's cost − new cost."],
    }) + `
    <div class="fe-row"><span class="sub">Scenario</span><div class="mx-nav fe-inline" id="fxEcoSc"></div>
      <label>Interest i <input type="number" id="fxEcoI" step="0.005"></label><label>Years n <input type="number" id="fxEcoN" step="1" min="1"></label>
      <button class="mx-el" id="fxEcoRst">Reset to example</button></div>
    <div class="fe-row fe-calc" id="fxEcoScIn"></div>
    <div class="fe-scroll"><table class="am-tab fe-calc fx-eco" id="fxEcoTab"></table></div>
    <div id="fxEcoRes"></div>
    <div class="grid2"><div><svg id="fxEcoCh" class="fe-chart" role="img" aria-label="Cost per part versus total volume"></svg><div class="sub" id="fxEcoLg"></div></div>
      <div id="fxEcoBe"></div></div>
    <h3 class="fe-h3">All scenarios at a glance <span class="sub">cost per part (€) · cheapest in bold</span></h3>
    <div class="fe-scroll"><table class="am-tab" id="fxEcoAll"></table></div>
    <div id="fxEcoWx"></div>`);
}
function ecoDefault() { return { i: EX.economics.i, n: EX.economics.n_years, sc: clone(EX.economics.scenarios), types: clone(EX.economics.types), cur: "A" }; }
function init1G() {
  let st = store.get("eco", null); if (!st || !st.types || st.types.length !== 4) st = ecoDefault();
  const typeFields = [["I_MEUR", "Investment I per unit", "M€"], ["F_MEUR", "Fixed cost F per unit / year", "M€"], ["v_EUR", "Variable cost v per part", "€"], ["cap_per_unit", "Capacity per unit", "parts / year"], ["c_ch_EUR", "Cost per changeover c_ch", "€"]];
  const buildInputs = () => {
    $("fxEcoSc").innerHTML = st.sc.map((s) => `<button class="mx-el${s.id === st.cur ? " active" : ""}" data-sc="${s.id}">${s.id} · ${esc(s.name)}</button>`).join("");
    const s = st.sc.find((x) => x.id === st.cur) || st.sc[0];
    $("fxEcoScIn").innerHTML = `<label>Variety (part numbers) <input type="number" data-sf="variety" value="${s.variety}" step="1" min="1"></label>
      <label>Quantity per part number / year <input type="number" data-sf="q_per_part" value="${s.q_per_part}" step="1" min="1"></label>
      <label>Orders per part number / year <input type="number" data-sf="orders_per_part_year" value="${s.orders_per_part_year}" step="1" min="0"></label>`;
    $("fxEcoI").value = st.i; $("fxEcoN").value = st.n;
    $("fxEcoTab").innerHTML = `<thead><tr><th>Parameter</th>${st.types.map((t) => `<th><span class="fx-lg"><i class="${ECO_COL[t.k]}"></i></span>${esc(t.name)}</th>`).join("")}</tr></thead>
      <tbody>${typeFields.map(([f, n, u]) => `<tr><td>${n} <span class="sub">${u}</span></td>${st.types.map((t, j) => `<td><input type="number" step="any" data-tf="${f}" data-tj="${j}" value="${t[f]}"></td>`).join("")}</tr>`).join("")}</tbody>
      <tbody id="fxEcoOut"></tbody>`;
  };
  const draw = () => {
    store.set("eco", st);
    const CRF = crf(st.i, st.n), s = st.sc.find((x) => x.id === st.cur) || st.sc[0];
    const Q = s.variety * s.q_per_part, N = s.variety * s.orders_per_part_year;
    const res = st.types.map((t) => ({ t, ...annual(t, Q, N, CRF) }));
    const best = res.reduce((a, b) => (b.cpp < a.cpp ? b : a));
    const row = (n, f) => `<tr><td>${n}</td>${res.map((r) => `<td class="${r === best ? "fx-best" : ""}">${f(r)}</td>`).join("")}</tr>`;
    $("fxEcoOut").innerHTML = row("Units = ⌈Q ÷ cap⌉", (r) => r.units) + row("Capital units·I·CRF", (r) => eur(r.cap)) + row("Fixed units·F", (r) => eur(r.fixed))
      + row("Variable Q·v", (r) => eur(r.vari)) + row("Changeover N·c_ch", (r) => eur(r.ch)) + row("<b>Annual cost C</b>", (r) => `<b>${eur(r.C)}</b>`) + row("<b>Cost per part C ÷ Q</b>", (r) => `<b>${fx(r.cpp, 2)} €</b>`);
    $("fxEcoRes").innerHTML = `<div class="phd-kpis"><div class="phd-kpi"><b>${fx(CRF, 5)}</b><span>CRF (i = ${fx(st.i * 100, 1)} %, n = ${st.n})</span></div>
      <div class="phd-kpi"><b>${Q.toLocaleString("en")}</b><span>total volume Q = ${s.variety} × ${s.q_per_part.toLocaleString("en")}</span></div>
      <div class="phd-kpi"><b>${N.toLocaleString("en")}</b><span>changeovers N = ${s.variety} × ${s.orders_per_part_year}</span></div>
      <div class="phd-kpi"><b>${fx(best.cpp, 2)} €</b><span>cheapest: ${esc(best.t.name)}</span></div></div>`;
    // chart: cost per part vs total volume, same variety and orders
    const xmin = 100, xmax = 1e6, pts = 360, grid = [];
    for (let k = 0; k <= pts; k++) grid.push(Math.round(xmin * (xmax / xmin) ** (k / pts)));
    const cpp = (t, q) => annual(t, q, N, CRF).cpp;
    const series = st.types.map((t) => ({ n: t.name, cls: ECO_COL[t.k], pts: grid.map((q) => [q, cpp(t, q)]) }));
    const ally = series.flatMap((sr) => sr.pts.map((p) => p[1])).filter((v) => Number.isFinite(v) && v > 0);
    const ymin = 10 ** Math.floor(Math.log10(Math.min(...ally))), ymax = Math.min(10 ** Math.ceil(Math.log10(Math.max(...ally))), 1e5);
    $("fxEcoLg").innerHTML = xyChart($("fxEcoCh"), { series, xlog: true, ylog: true, xmin, xmax, ymin, ymax, xl: "Total volume Q (parts / year, log) – variety and orders as in the scenario", yl: "Cost per part € (log)", vmarks: [[Q, "fe-req", "your Q"]], xfmt: (v) => (v >= 1e6 ? v / 1e6 + "M" : v >= 1e3 ? v / 1e3 + "k" : String(v)) });
    // cheapest along the volume axis + switch points (bisection on integers between grid points)
    const cheapest = (q) => st.types.reduce((a, t) => (cpp(t, q) < cpp(a, q) ? t : a), st.types[0]);
    const switches = [];
    for (let k = 1; k < grid.length; k++) {
      let lo = grid[k - 1], hi = grid[k]; const a = cheapest(lo).k;
      if (cheapest(hi).k === a) continue;
      while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); if (cheapest(m).k === a) lo = m; else hi = m; }
      switches.push([hi, a, cheapest(hi).k]);
    }
    // pairwise break-even: first volume where the line with lower cost at low volume is overtaken
    const nm = (k) => st.types.find((t) => t.k === k).name.replace(/ \(.*\)/, "");
    const pairs = [];
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const A = st.types[a], B = st.types[b]; let found = null;
      for (let k = 1; k < grid.length && !found; k++) {
        const d0 = cpp(A, grid[k - 1]) - cpp(B, grid[k - 1]), d1 = cpp(A, grid[k]) - cpp(B, grid[k]);
        if (d0 * d1 < 0 || (d1 === 0 && d0 !== 0)) {
          let lo = grid[k - 1], hi = grid[k];
          while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); const dm = cpp(A, m) - cpp(B, m); if (dm * d0 > 0) lo = m; else hi = m; }
          found = hi;
        }
      }
      pairs.push([A.k, B.k, found]);
    }
    $("fxEcoBe").innerHTML = `<h3 class="fe-h3">Cheapest type along the volume axis</h3>
      <p class="sub">variety ${s.variety}, ${N} changeovers / year kept constant; only Q changes</p>
      ${ul((() => { const out = []; let from = xmin, cur = cheapest(xmin).k; switches.forEach(([q, , to]) => { out.push(`${from.toLocaleString("en")} – ${(q - 1).toLocaleString("en")}: <b>${esc(nm(cur))}</b>`); from = q; cur = to; }); out.push(`${from.toLocaleString("en")} – ${xmax.toLocaleString("en")}: <b>${esc(nm(cur))}</b>`); return out; })())}
      <h4>Break-even volume of each pair <span class="sub">first whole volume (above 100 parts / year) where the other type is cheaper. The Python tool <code>fms_economics.py</code> prints the exact crossing point instead (e.g. 14 001.x → shown as 14 001; a jump at a capacity limit is marked *), so its numbers can be 1 lower.</span></h4>
      <table class="am-tab"><tbody>${pairs.map(([a, b, q]) => `<tr><td>${esc(nm(a))} ↔ ${esc(nm(b))}</td><td>${q ? `<b>${q.toLocaleString("en")}</b> parts / year` : '<span class="sub">no crossing 100 … 1M</span>'}</td></tr>`).join("")}</tbody></table>
      <p class="am-note">The lines jump where one more unit (machine / line) is needed: ⌈Q ÷ cap⌉ rises by 1 → a step in capital and fixed cost. That is why several crossings are possible.</p>`;
    // all scenarios
    const all = st.sc.map((sc) => { const q = sc.variety * sc.q_per_part, n = sc.variety * sc.orders_per_part_year; const r = st.types.map((t) => annual(t, q, n, CRF)); const bi = r.reduce((a, x, i) => (x.cpp < r[a].cpp ? i : a), 0); return { sc, q, r, bi }; });
    $("fxEcoAll").innerHTML = `<thead><tr><th>Scenario</th><th>Q</th>${st.types.map((t) => `<th>${esc(t.name.replace(/ \(.*\)/, ""))}</th>`).join("")}<th>Cheapest</th></tr></thead>
      <tbody>${all.map(({ sc, q, r, bi }) => `<tr${sc.id === st.cur ? ' class="fx-cur"' : ""}><td><b>${sc.id}</b> ${esc(sc.name)}</td><td>${q.toLocaleString("en")}</td>${r.map((x, i) => `<td>${i === bi ? `<b>${fx(x.cpp, 2)}</b>` : fx(x.cpp, 2)}</td>`).join("")}<td><b>${esc(st.types[bi].name.replace(/ \(.*\)/, ""))}</b></td></tr>`).join("")}</tbody>`;
    // worked example: cheapest type of the current scenario, step by step
    const b = best, t = b.t;
    $("fxEcoWx").innerHTML = `<details class="fx-more" open><summary><b>Worked example</b> – scenario ${s.id}, ${esc(t.name)}</summary><ol class="fx-steps">
      <li>CRF = ${st.i}·(1+${st.i})<sup>${st.n}</sup> ÷ ((1+${st.i})<sup>${st.n}</sup> − 1) = ${fx(st.i * (1 + st.i) ** st.n, 5)} ÷ ${fx((1 + st.i) ** st.n - 1, 5)} = <b>${fx(CRF, 5)}</b></li>
      <li>Q = ${s.variety} × ${s.q_per_part.toLocaleString("en")} = <b>${Q.toLocaleString("en")}</b> parts / year; N = ${s.variety} × ${s.orders_per_part_year} = <b>${N}</b> changeovers</li>
      <li>units = ⌈${Q.toLocaleString("en")} ÷ ${t.cap_per_unit.toLocaleString("en")}⌉ = <b>${b.units}</b></li>
      <li>C = ${b.units}·${t.I_MEUR} M€·${fx(CRF, 5)} + ${b.units}·${t.F_MEUR} M€ + ${Q.toLocaleString("en")}·${t.v_EUR} € + ${N}·${t.c_ch_EUR} € = ${eur(b.cap)} + ${eur(b.fixed)} + ${eur(b.vari)} + ${eur(b.ch)} = <b>${eur(b.C)}</b></li>
      <li>cost per part = ${eur(b.C)} ÷ ${Q.toLocaleString("en")} = <b>${fx(b.cpp, 2)} € / part</b></li></ol></details>`;
    R.eco = { CRF: +CRF.toFixed(6), scenarios: all.map(({ sc, r, bi }) => ({ id: sc.id, cpp: Object.fromEntries(st.types.map((t, i) => [t.k, +r[i].cpp.toFixed(2)])), cheapest: st.types[bi].k })), switches: switches.map(([q, a, b2]) => [q, a, b2]), pairs };
  };
  buildInputs(); draw();
  $("fxEcoSc").addEventListener("click", (e) => { const b = e.target.closest("[data-sc]"); if (!b) return; st.cur = b.dataset.sc; buildInputs(); draw(); });
  $("fxEcoScIn").addEventListener("input", (e) => { const f = e.target.dataset.sf; if (!f) return; const s = st.sc.find((x) => x.id === st.cur); s[f] = Math.max(f === "orders_per_part_year" ? 0 : 1, +e.target.value || 0); draw(); });
  $("fxEcoTab").addEventListener("input", (e) => { const f = e.target.dataset.tf; if (!f) return; const v = +e.target.value; if (!(v >= 0) || (f === "cap_per_unit" && !(v > 0))) return; st.types[+e.target.dataset.tj][f] = v; draw(); });
  $("fxEcoI").addEventListener("input", () => { const v = +$("fxEcoI").value; if (v >= 0 && v < 1) { st.i = v; draw(); } });
  $("fxEcoN").addEventListener("input", () => { const v = Math.round(+$("fxEcoN").value); if (v >= 1) { st.n = v; draw(); } });
  $("fxEcoRst").addEventListener("click", () => { st = ecoDefault(); buildInputs(); draw(); });
}

/* ================================================================== 1H project schedule – CPM */
function html1H() {
  return card("fx1H", "1H · Project schedule – critical path method (CPM) and Gantt chart", "edit tasks, durations (weeks) and predecessors · forward / backward pass · float · critical path in red",
    guide({
      principle: `<p>A project is a network of tasks. Some tasks can run in parallel, others must wait for their predecessors. The <b>critical path</b> is the
        longest chain of dependent tasks – it decides the project end. A task on it has <b>zero float</b>: one week late there = one week late project.
        Tasks with float can move without delaying the end.</p>
        <p class="phd-eq">Forward: ES = max(EF of predecessors), EF = ES + d · Backward: LF = min(LS of successors), LS = LF − d · Float = LS − ES · critical ⇔ float = 0</p>`,
      uses: CPMUSE,
      howto: ["Make the task list from the 11 phases (1C) and the long-lead items of the offers (machines, pallet pool, robots: often 20–40 weeks).",
        "Ask every supplier for durations in weeks and write the dependencies – include owner tasks (site, foundation, IT accounts, training).",
        "Watch the critical path every week; put the best people and the earliest decisions on it. Use the float of other tasks for levelling resources.",
        "Contract milestones (FAT, delivery, SAT) = EF dates of the matching tasks + a buffer (5–10 %) owned by the project manager."],
    }) + `
    <div class="fe-row"><label>Project start <input type="date" id="fxCpmStart"></label>
      <button class="mx-el" id="fxCpmAdd">+ Add task</button><button class="mx-el" id="fxCpmRst">Reset to example</button><button class="mx-el" id="fxCpmCsv">Export CSV</button>
      <span class="sub">Predecessors: IDs separated by commas, e.g. <code>T13, T14</code></span></div>
    <div id="fxCpmMsg"></div>
    <div id="fxCpmKpi"></div>
    <div class="fe-scroll"><svg id="fxGantt" class="fe-chart fx-gantt" role="img" aria-label="Gantt chart with critical path"></svg></div>
    <p class="sub"><span class="fx-lg"><i class="fx-gc"></i>critical task (float 0)</span> <span class="fx-lg"><i class="fx-gn"></i>task with float</span> <span class="fx-lg"><i class="fx-gf"></i>float (can move)</span></p>
    <details class="fx-more"><summary><b>Task table</b> <span class="sub">edit here – results update at once</span></summary>
      <div class="fe-scroll"><table class="am-tab fe-calc fx-cpm" id="fxCpmTab"></table></div></details>
    <div id="fxCpmWx"></div>`);
}
function cpmDefault() { return { start: "2027-01-04", tasks: EX.cpm_project.tasks.map(([id, n, d, p]) => ({ id, n, d, p: p.join(", ") })) }; }
// CPM core – returns {ok, msg, rows, D, crit}
function cpm(tasks) {
  const ids = tasks.map((t) => t.id.trim());
  const dup = ids.filter((x, i) => x && ids.indexOf(x) !== i);
  const by = new Map(tasks.map((t, i) => [t.id.trim(), i]));
  const warn = [];
  if (dup.length) warn.push(`Duplicate IDs: ${[...new Set(dup)].join(", ")}`);
  const pre = tasks.map((t) => String(t.p || "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).filter((x) => { if (!by.has(x)) { warn.push(`${t.id}: unknown predecessor "${x}" (ignored)`); return false; } return true; }).map((x) => by.get(x)));
  const succ = tasks.map(() => []); pre.forEach((ps, i) => ps.forEach((p) => succ[p].push(i)));
  // Kahn topological order → cycle detection
  const indeg = pre.map((p) => p.length), order = [], q = indeg.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0);
  while (q.length) { const i = q.shift(); order.push(i); succ[i].forEach((s) => { if (--indeg[s] === 0) q.push(s); }); }
  if (order.length < tasks.length) {
    // remaining tasks = cycle + tasks behind it; strip tasks without remaining successors until only the cycle is left
    const rem = new Set(tasks.map((_, i) => i).filter((i) => indeg[i] > 0));
    let ch = true; while (ch) { ch = false; rem.forEach((i) => { if (!succ[i].some((x) => rem.has(x))) { rem.delete(i); ch = true; } }); }
    const left = [...rem].map((i) => tasks[i].id);
    return { ok: false, warn, msg: `Cycle in the dependencies – these tasks wait for each other: ${left.join(", ")}. Remove one predecessor link.` };
  }
  const d = tasks.map((t) => Math.max(0, +t.d || 0)), ES = [], EF = [], LS = [], LF = [];
  order.forEach((i) => { ES[i] = pre[i].reduce((m, p) => Math.max(m, EF[p]), 0); EF[i] = ES[i] + d[i]; });
  const D = Math.max(0, ...EF);
  [...order].reverse().forEach((i) => { LF[i] = succ[i].reduce((m, s) => Math.min(m, LS[s]), D); LS[i] = LF[i] - d[i]; });
  const rows = tasks.map((t, i) => ({ i, id: t.id, n: t.n, d: d[i], ES: ES[i], EF: EF[i], LS: LS[i], LF: LF[i], fl: LS[i] - ES[i], crit: Math.abs(LS[i] - ES[i]) < 1e-9 }));
  // critical path(s) as a chain: follow critical successors from critical start tasks (tasks sorted by ES)
  const crit = rows.filter((r) => r.crit).sort((a, b) => a.ES - b.ES || a.i - b.i).map((r) => r.id);
  return { ok: true, warn, rows, D, crit, order };
}
function init1H() {
  let st = store.get("cpm", null); if (!st || !Array.isArray(st.tasks)) st = cpmDefault();
  // dates in UTC (no time-zone shift): week w starts on start + 7w days; a task finishes on start + 7·EF − 1
  const addDays = (n) => { const dt = new Date(st.start + "T00:00:00Z"); if (isNaN(dt)) return "–"; dt.setUTCDate(dt.getUTCDate() + Math.round(n)); return dt.toISOString().slice(0, 10); };
  const addWeeks = (w) => addDays(w * 7), finish = (ef) => addDays(ef * 7 - 1);
  const buildTable = () => {
    $("fxCpmStart").value = st.start;
    $("fxCpmTab").innerHTML = `<thead><tr><th>ID</th><th>Task</th><th>d (weeks)</th><th>Predecessors</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>Float</th><th>Start date</th><th>Finish date</th><th></th></tr></thead>
      <tbody>${st.tasks.map((t, i) => `<tr data-row="${i}"><td><input class="fx-id" data-k="id" data-i="${i}" value="${esc(t.id)}"></td><td><input class="fx-name" data-k="n" data-i="${i}" value="${esc(t.n)}"></td>
        <td><input type="number" min="0" step="0.5" data-k="d" data-i="${i}" value="${t.d}"></td><td><input class="fx-pre" data-k="p" data-i="${i}" value="${esc(t.p)}"></td>
        <td id="fxC${i}_ES"></td><td id="fxC${i}_EF"></td><td id="fxC${i}_LS"></td><td id="fxC${i}_LF"></td><td id="fxC${i}_fl"></td><td id="fxC${i}_dt"></td><td id="fxC${i}_fd"></td>
        <td><button class="mx-el fx-x" data-del="${i}" title="Remove task">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const draw = () => {
    store.set("cpm", st);
    const r = cpm(st.tasks);
    $("fxCpmMsg").innerHTML = (r.warn.length ? `<p class="fe-no">${r.warn.map(esc).join("<br>")}</p>` : "") + (r.ok ? "" : `<p class="fe-no fx-alert">${esc(r.msg)}</p>`);
    if (!r.ok) { $("fxGantt").innerHTML = ""; $("fxCpmKpi").innerHTML = ""; R.cpm = { ok: false, msg: r.msg }; return; }
    r.rows.forEach((x) => {
      const set = (k, v) => { const c = $(`fxC${x.i}_${k}`); if (c) c.textContent = v; };
      set("ES", fx(x.ES, 1)); set("EF", fx(x.EF, 1)); set("LS", fx(x.LS, 1)); set("LF", fx(x.LF, 1)); set("fl", fx(x.fl, 1)); set("dt", addWeeks(x.ES)); set("fd", finish(x.EF));
      const tr = document.querySelector(`#fxCpmTab tr[data-row="${x.i}"]`); if (tr) tr.classList.toggle("fx-critrow", x.crit);
    });
    $("fxCpmKpi").innerHTML = `<div class="phd-kpis"><div class="phd-kpi"><b>${fx(r.D, 1)} weeks</b><span>total duration ≈ ${fx(r.D / 4.345, 1)} months</span></div>
      <div class="phd-kpi"><b>${finish(r.D)}</b><span>finish date = start + 7·EF − 1 (start ${esc(st.start)})</span></div>
      <div class="phd-kpi"><b>${r.crit.length} of ${r.rows.length}</b><span>tasks on the critical path</span></div></div>
      <p><b>Critical path:</b> ${r.crit.map(esc).join(" → ")}</p>`;
    // Gantt
    const rowH = 17, top = 26, left = 250, W = 960, right = 14, H = top + r.rows.length * rowH + 10;
    const X = (w) => left + w / (r.D || 1) * (W - left - right);
    let s = "";
    const step = r.D > 80 ? 10 : r.D > 30 ? 5 : r.D > 12 ? 2 : 1;
    for (let w = 0; w <= r.D + 1e-9; w += step) s += `<line class="fe-grid" x1="${X(w)}" x2="${X(w)}" y1="${top - 4}" y2="${H - 6}"/><text class="fe-tick" x="${X(w)}" y="${top - 8}" text-anchor="middle">${w}</text>`;
    s += `<text class="fe-tick" x="${left - 16}" y="${top - 8}" text-anchor="end">week →</text>`;
    r.rows.forEach((x, k) => {
      const y = top + k * rowH;
      s += `<text class="fe-tick fx-gl${x.crit ? " fx-glc" : ""}" x="4" y="${y + 12}">${esc(x.id)} ${esc(x.n.length > 34 ? x.n.slice(0, 33) + "…" : x.n)}</text>`;
      if (x.fl > 1e-9) s += `<rect class="fx-gf" x="${X(x.EF)}" y="${y + 4}" width="${Math.max(1, X(x.LF) - X(x.EF))}" height="${rowH - 8}" rx="2"/>`;
      s += `<rect class="${x.crit ? "fx-gc" : "fx-gn"}" x="${X(x.ES)}" y="${y + 2}" width="${Math.max(2, X(x.EF) - X(x.ES))}" height="${rowH - 4}" rx="3"><title>${esc(x.id)} ${esc(x.n)}: ES ${x.ES} – EF ${x.EF}, float ${x.fl}</title></rect>`;
    });
    $("fxGantt").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fxGantt").innerHTML = s;
    // worked example: one task with float
    const ex = r.rows.find((x) => x.id === "T10") || r.rows.find((x) => x.fl > 0) || r.rows[0];
    const preIds = String(st.tasks[ex.i].p || "").split(/[,;\s]+/).filter(Boolean);
    $("fxCpmWx").innerHTML = `<details class="fx-more"><summary><b>Worked example</b> – task ${esc(ex.id)} ${esc(ex.n)}</summary><ol class="fx-steps">
      <li>Forward pass: ES = max(EF of ${preIds.map(esc).join(", ") || "– (no predecessor)"}) = <b>${ex.ES}</b>; EF = ES + d = ${ex.ES} + ${ex.d} = <b>${ex.EF}</b></li>
      <li>Backward pass: LF = min(LS of its successors) = <b>${ex.LF}</b>; LS = LF − d = ${ex.LF} − ${ex.d} = <b>${ex.LS}</b></li>
      <li>Float = LS − ES = ${ex.LS} − ${ex.ES} = <b>${ex.fl} weeks</b> → ${ex.crit ? "critical: no delay allowed" : `this task may start up to ${ex.fl} weeks later without delaying the project end`}.</li></ol></details>`;
    R.cpm = { ok: true, D: r.D, finish: finish(r.D), crit: r.crit, float: Object.fromEntries(r.rows.map((x) => [x.id, x.fl])) };
  };
  buildTable(); draw();
  $("fxCpmTab").addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; const i = +e.target.dataset.i; st.tasks[i][k] = k === "d" ? Math.max(0, +e.target.value || 0) : e.target.value; draw(); });
  $("fxCpmTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; st.tasks.splice(+b.dataset.del, 1); buildTable(); draw(); });
  $("fxCpmAdd").addEventListener("click", () => { let n = st.tasks.length + 1; while (st.tasks.some((t) => t.id === "T" + String(n).padStart(2, "0"))) n++; const last = st.tasks[st.tasks.length - 1]; st.tasks.push({ id: "T" + String(n).padStart(2, "0"), n: "New task", d: 2, p: last ? last.id : "" }); buildTable(); draw(); $("fxCpmTab").closest("details").open = true; });
  $("fxCpmRst").addEventListener("click", () => { st = cpmDefault(); buildTable(); draw(); });
  $("fxCpmStart").addEventListener("change", () => { if ($("fxCpmStart").value) { st.start = $("fxCpmStart").value; draw(); } });
  $("fxCpmCsv").addEventListener("click", () => {
    const r = cpm(st.tasks); if (!r.ok) { alert(r.msg); return; }
    download("fms_project_cpm.csv", toCSV([["ID", "Task", "Duration_weeks", "Predecessors", "ES", "EF", "LS", "LF", "Float", "Critical", "Start_date", "Finish_date"], ...r.rows.map((x) => [x.id, x.n, x.d, st.tasks[x.i].p, x.ES, x.EF, x.LS, x.LF, x.fl, x.crit ? "yes" : "no", addWeeks(x.ES), finish(x.EF)])]), "text/csv");
  });
}

/* ================================================================== 1I business case */
function html1I() {
  return card("fx1I", "1I · Business case – cash flow, NPV, IRR, payback, sensitivity", "money in M€ · CF_t = saving × ramp_t − extra opex · edit any input",
    guide({
      principle: `<p>An FMS is an investment: money now (I<sub>0</sub>), savings later. Money later is worth less than money now, so future cash flows are
        <b>discounted</b> with the interest rate r. <b>NPV</b> &gt; 0 means the project earns more than r. <b>IRR</b> is the rate where NPV = 0.
        <b>Payback</b> is the time until the cumulative cash flow pays back I<sub>0</sub> (discounted payback: with discounted cash flows).</p>
        <p class="phd-eq">NPV = −I<sub>0</sub> + Σ<sub>t=1..n</sub> CF<sub>t</sub> ÷ (1+r)<sup>t</sup> + residual ÷ (1+r)<sup>n</sup> · IRR: NPV(IRR) = 0 (bisection −0.99 … 1.0)</p>`,
      uses: BCUSE,
      howto: ["Saving = cost today − cost with the new system (labour, scrap, set-up, overtime, outsourcing, inventory). Use the cost model of 1G.",
        "Use a ramp-up (year 1 often 50–70 %) and include extra opex (maintenance contracts, software licences, energy).",
        "Ask finance for the company's discount rate (WACC + risk) and the depreciation period; use their template for approval.",
        "Always show the sensitivity table: management wants to see when the project becomes negative."],
    }) + `
    <div class="fe-row fe-calc" id="fxBcIn"></div>
    <div id="fxBcKpi"></div>
    <div class="grid2"><div><svg id="fxBcCh" class="fe-chart" role="img" aria-label="Cumulative cash flow"></svg><div class="sub" id="fxBcLg"></div></div>
      <div><h3 class="fe-h3">Sensitivity – NPV (M€)</h3><div class="fe-scroll"><table class="am-tab fx-sens" id="fxBcSens"></table></div>
        <p class="am-note">Rows: change of the annual saving; columns: change of the investment I<sub>0</sub> only (residual, opex, ramp and rate unchanged). Payback values exclude the residual – it counts only in NPV and IRR. Green = NPV ≥ 0, red = NPV &lt; 0.</p></div></div>
    <div class="fe-scroll"><table class="am-tab" id="fxBcTab"></table></div>
    <div id="fxBcWx"></div>`);
}
function bcDefault() { const b = EX.business_case; return { I0: b.I0_MEUR, years: b.years, rate: b.rate, res: b.residual_MEUR, save: b.annual_saving_MEUR, opex: b.extra_opex_MEUR, ramp: b.ramp.join(", ") }; }
function bcCalc(p, sf = 1, inf = 1) {
  const ramp = String(p.ramp).split(/[,;\s]+/).filter(Boolean).map(Number);
  const n = Math.max(1, Math.round(p.years)), I0 = p.I0 * inf;
  const cf = []; for (let t = 1; t <= n; t++) cf.push(p.save * sf * (Number.isFinite(ramp[t - 1]) ? ramp[t - 1] : 1) - p.opex);
  const npv = (r) => -I0 + cf.reduce((a, c, k) => a + c / (1 + r) ** (k + 1), 0) + p.res / (1 + r) ** n;
  let irr = null, lo = -0.99, hi = 1.0;
  if (npv(lo) * npv(hi) <= 0) { while (hi - lo > 1e-7) { const m = (lo + hi) / 2; if (npv(lo) * npv(m) <= 0) hi = m; else lo = m; } irr = (lo + hi) / 2; }
  const pb = (vals) => { let c = 0; for (let k = 0; k < vals.length; k++) { if (c + vals[k] >= I0 && vals[k] > 0) return k + (I0 - c) / vals[k]; c += vals[k]; } return null; };
  const dcf = cf.map((c, k) => c / (1 + p.rate) ** (k + 1));
  return { n, I0, cf, dcf, NPV: npv(p.rate), IRR: irr, PB: pb(cf), DPB: pb(dcf), ramp };
}
function init1I() {
  let p = store.get("bc", null); if (!p || p.I0 == null) p = bcDefault();
  const fields = [["I0", "Investment I₀", "M€", 0.05], ["years", "Years n", "", 1], ["rate", "Discount rate r", "", 0.005], ["res", "Residual value", "M€", 0.01], ["save", "Annual saving", "M€ / year", 0.01], ["opex", "Extra opex", "M€ / year", 0.01]];
  const build = () => {
    $("fxBcIn").innerHTML = fields.map(([k, n, u, s]) => `<label>${n} <input type="number" data-bk="${k}" step="${s}" value="${p[k]}"> ${u}</label>`).join("")
      + `<label>Ramp-up per year <input class="fx-ramp" data-bk="ramp" value="${esc(p.ramp)}"></label><button class="mx-el" id="fxBcRst">Reset to example</button>`;
    $("fxBcRst").addEventListener("click", () => { p = bcDefault(); build(); draw(); });
  };
  const yrs = (v) => (v == null ? "not reached" : fx(v, 2) + " years");
  const draw = () => {
    store.set("bc", p);
    const r = bcCalc(p);
    $("fxBcKpi").innerHTML = `<div class="phd-kpis"><div class="phd-kpi"><b class="${r.NPV >= 0 ? "fe-ok" : "fe-no"}">${fx(r.NPV, 3)} M€</b><span>NPV at r = ${fx(p.rate * 100, 1)} %</span></div>
      <div class="phd-kpi"><b>${r.IRR == null ? "–" : fx(r.IRR * 100, 2) + " %"}</b><span>IRR ${r.IRR != null && r.IRR < p.rate ? "(below r)" : ""}</span></div>
      <div class="phd-kpi"><b>${yrs(r.PB)}</b><span>payback (undiscounted)</span></div>
      <div class="phd-kpi"><b>${yrs(r.DPB)}</b><span>discounted payback${r.DPB == null ? ` – not within ${r.n} years` : ""}</span></div></div>
      <p>${r.NPV >= 0 ? '<span class="fe-ok">NPV ≥ 0 – the project earns at least the discount rate.</span>' : `<span class="fe-no">NPV &lt; 0 – the project earns less than ${fx(p.rate * 100, 1)} %.</span> Improve saving, reduce investment or extend the life.`}</p>`;
    let cum = -r.I0, dcum = -r.I0; const rows = [];
    r.cf.forEach((c, k) => { cum += c; dcum += r.dcf[k]; rows.push([k + 1, Number.isFinite(r.ramp[k]) ? r.ramp[k] : 1, c, 1 / (1 + p.rate) ** (k + 1), r.dcf[k], cum, dcum]); });
    $("fxBcTab").innerHTML = `<thead><tr><th>Year t</th><th>Ramp</th><th>CF<sub>t</sub> M€</th><th>1 ÷ (1+r)<sup>t</sup></th><th>Discounted CF</th><th>Cumulative CF</th><th>Cumulative discounted</th></tr></thead>
      <tbody><tr><td>0</td><td></td><td>${fx(-r.I0, 3)}</td><td>1.0000</td><td>${fx(-r.I0, 3)}</td><td>${fx(-r.I0, 3)}</td><td>${fx(-r.I0, 3)}</td></tr>
      ${rows.map(([t, ra, c, df, d, cu, dc]) => `<tr><td>${t}</td><td>${fx(ra, 2)}</td><td>${fx(c, 3)}</td><td>${fx(df, 4)}</td><td>${fx(d, 3)}</td><td class="${cu >= 0 ? "fe-ok" : ""}">${fx(cu, 3)}</td><td class="${dc >= 0 ? "fe-ok" : ""}">${fx(dc, 3)}</td></tr>`).join("")}
      <tr><td>${r.n}</td><td colspan="3">residual value ÷ (1+r)<sup>n</sup></td><td>${fx(p.res / (1 + p.rate) ** r.n, 3)}</td><td></td><td><b>NPV ${fx(r.NPV, 3)}</b></td></tr></tbody>`;
    const xs = [0, ...rows.map((x) => x[0])], c1 = [-r.I0, ...rows.map((x) => x[5])], c2 = [-r.I0, ...rows.map((x) => x[6])];
    const all = [...c1, ...c2, 0], lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo) * 0.08 || 0.1;
    $("fxBcLg").innerHTML = xyChart($("fxBcCh"), { series: [{ n: "cumulative cash flow", cls: "fx-s1", dots: true, pts: xs.map((x, i) => [x, c1[i]]) }, { n: "cumulative discounted", cls: "fx-s2", dots: true, pts: xs.map((x, i) => [x, c2[i]]) }],
      xmin: 0, xmax: r.n, ymin: lo - pad, ymax: hi + pad, xl: "Year", yl: "M€", hmarks: [[0, "fx-zero", "0 = investment paid back", true]], xfmt: (v) => String(v), yfmt: (v) => fx(v, 1) });
    const sv = EX.business_case.sensitivity;
    const sens = sv.saving_pct.map((sp) => sv.invest_pct.map((ip) => bcCalc(p, 1 + sp / 100, 1 + ip / 100).NPV));
    $("fxBcSens").innerHTML = `<thead><tr><th>saving ↓ / invest →</th>${sv.invest_pct.map((ip) => `<th>${ip > 0 ? "+" : ""}${ip} %</th>`).join("")}</tr></thead>
      <tbody>${sv.saving_pct.map((sp, a) => `<tr><th>${sp > 0 ? "+" : ""}${sp} %</th>${sens[a].map((v) => `<td class="${v >= 0 ? "fx-pos" : "fx-neg"}">${fx(v, 3)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const c1y = r.cf[0];
    $("fxBcWx").innerHTML = `<details class="fx-more"><summary><b>Worked example</b> – the first year and the NPV</summary><ol class="fx-steps">
      <li>CF<sub>1</sub> = saving × ramp<sub>1</sub> − opex = ${p.save} × ${Number.isFinite(r.ramp[0]) ? r.ramp[0] : 1} − ${p.opex} = <b>${fx(c1y, 3)} M€</b>; discounted: ${fx(c1y, 3)} ÷ ${fx(1 + p.rate, 3)} = ${fx(r.dcf[0], 3)} M€</li>
      <li>Σ discounted CF = ${fx(r.dcf.reduce((a, b) => a + b, 0), 3)} M€; residual ${p.res} ÷ ${fx((1 + p.rate) ** r.n, 4)} = ${fx(p.res / (1 + p.rate) ** r.n, 3)} M€</li>
      <li>NPV = −${p.I0} + ${fx(r.dcf.reduce((a, b) => a + b, 0), 3)} + ${fx(p.res / (1 + p.rate) ** r.n, 3)} = <b>${fx(r.NPV, 3)} M€</b></li>
      <li>Payback: cumulative CF after year ${r.PB == null ? r.n : Math.floor(r.PB)} = ${fx(r.cf.slice(0, r.PB == null ? r.n : Math.floor(r.PB)).reduce((a, b) => a + b, 0), 3)} M€ ${r.PB == null ? "&lt; I₀ → not reached" : `→ the rest ${fx(r.I0 - r.cf.slice(0, Math.floor(r.PB)).reduce((a, b) => a + b, 0), 3)} ÷ ${fx(r.cf[Math.floor(r.PB)], 3)} = ${fx(r.PB - Math.floor(r.PB), 3)} of the next year → <b>${fx(r.PB, 2)} years</b>`}</li></ol></details>`;
    R.bc = { cf: r.cf.map((x) => +x.toFixed(4)), NPV: +r.NPV.toFixed(4), IRR: r.IRR == null ? null : +r.IRR.toFixed(5), PB: r.PB == null ? null : +r.PB.toFixed(3), DPB: r.DPB == null ? null : +r.DPB.toFixed(3), sens: sens.map((row) => row.map((v) => +v.toFixed(3))) };
  };
  build(); draw();
  $("fxBcIn").addEventListener("input", (e) => { const k = e.target.dataset.bk; if (!k) return; if (k === "ramp") p.ramp = e.target.value; else { const v = +e.target.value; if (!Number.isFinite(v) || (k === "years" && v < 1) || (k === "rate" && (v <= -0.99 || v >= 1))) return; p[k] = k === "years" ? Math.round(v) : v; } draw(); });
}

/* ================================================================== 1J risk register */
const rClass = (s) => (s >= 15 ? "high" : s >= 8 ? "medium" : "low");
function html1J() {
  return card("fx1J", "1J · Risk register – probability × impact, heat map", "score = P × I (1…25) · high ≥ 15, medium 8…14, low ≤ 7 · edit, add, sort",
    guide({
      principle: `<p>A risk is something that <b>may</b> happen and would hurt time, cost, quality or safety. Rate each risk with a probability P (1 = rare … 5 = almost sure)
        and an impact I (1 = small … 5 = project-threatening). The score <b>P × I</b> ranks the risks; the <b>heat map</b> shows where they sit.
        For every high risk there must be a mitigation (lower P), a contingency (lower I) and an owner.</p>
        <p class="phd-eq">score = P × I · class: high ≥ 15 · medium 8 … 14 · low ≤ 7</p>`,
      uses: RISKUSE,
      howto: ["Start the register in P0/P1 and review it at every gate (1C) and in the weekly project meeting.",
        "Give every risk an owner and a due date for the mitigation; re-rate after the mitigation is done.",
        "Put the top risks into the contract: penalty clauses, guarantees, escrow, acceptance criteria.",
        "Use the same scale for the whole company so that risks of different projects can be compared."],
    }) + `
    <div class="fe-row"><button class="mx-el" id="fxRkAdd">+ Add risk</button><button class="mx-el" id="fxRkRst">Reset to example</button><button class="mx-el" id="fxRkCsv">Export CSV</button><span class="sub" id="fxRkSum"></span></div>
    <div class="grid2"><div><h3 class="fe-h3">Ranked list</h3><div class="fe-scroll"><table class="am-tab" id="fxRkRank"></table></div></div>
      <div><h3 class="fe-h3">Heat map</h3><svg id="fxHeat" class="fe-chart fx-heat" role="img" aria-label="Risk heat map 5 by 5"></svg></div></div>
    <details class="fx-more"><summary><b>Edit the register</b></summary><div class="fe-scroll"><table class="am-tab fe-calc fx-rk" id="fxRkTab"></table></div></details>`);
}
function init1J() {
  let rk = store.get("risks", null); if (!Array.isArray(rk)) rk = clone(EX.risks);
  const opt = (v) => [1, 2, 3, 4, 5].map((k) => `<option${k === +v ? " selected" : ""}>${k}</option>`).join("");
  const build = () => {
    $("fxRkTab").innerHTML = `<thead><tr><th>ID</th><th>Risk</th><th>P</th><th>I</th><th>Score</th><th>Mitigation</th><th></th></tr></thead>
      <tbody>${rk.map((r, i) => `<tr><td><input class="fx-id" data-rf="0" data-ri="${i}" value="${esc(r[0])}"></td><td><input class="fx-name" data-rf="1" data-ri="${i}" value="${esc(r[1])}"></td>
        <td><select data-rf="2" data-ri="${i}">${opt(r[2])}</select></td><td><select data-rf="3" data-ri="${i}">${opt(r[3])}</select></td><td id="fxRs${i}"></td>
        <td><input class="fx-mit" data-rf="4" data-ri="${i}" value="${esc(r[4])}"></td><td><button class="mx-el fx-x" data-rdel="${i}" title="Remove">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const draw = () => {
    store.set("risks", rk);
    rk.forEach((r, i) => { const s = r[2] * r[3], c = $("fxRs" + i); if (c) c.innerHTML = `<span class="fx-rc fx-r-${rClass(s)}">${s}</span>`; });
    const sorted = rk.map((r) => ({ id: r[0], t: r[1], P: +r[2], I: +r[3], s: r[2] * r[3], m: r[4] })).sort((a, b) => b.s - a.s || b.P - a.P || String(a.id).localeCompare(String(b.id)));   // ties: score, then P descending, then id
    const cnt = { high: 0, medium: 0, low: 0 }; sorted.forEach((x) => cnt[rClass(x.s)]++);
    $("fxRkSum").innerHTML = `${rk.length} risks · <span class="fx-rc fx-r-high">${cnt.high} high</span> <span class="fx-rc fx-r-medium">${cnt.medium} medium</span> <span class="fx-rc fx-r-low">${cnt.low} low</span>`;
    $("fxRkRank").innerHTML = `<thead><tr><th>#</th><th>ID</th><th>Risk</th><th>P×I</th><th>Score</th><th>Mitigation</th></tr></thead>
      <tbody>${sorted.map((x, k) => `<tr><td>${k + 1}</td><td><b>${esc(x.id)}</b></td><td>${esc(x.t)}</td><td>${x.P}×${x.I}</td><td><span class="fx-rc fx-r-${rClass(x.s)}">${x.s} ${rClass(x.s)}</span></td><td>${esc(x.m)}</td></tr>`).join("")}</tbody>`;
    // heat map: x = probability 1..5, y = impact 5..1
    const W = 440, H = 400, x0 = 64, y0 = 14, c = 70;
    let s = "";
    for (let I = 5; I >= 1; I--) for (let P = 1; P <= 5; P++) {
      const x = x0 + (P - 1) * c, y = y0 + (5 - I) * c, sc = P * I, ids = sorted.filter((r) => r.P === P && r.I === I).map((r) => r.id);
      s += `<rect class="fx-hc fx-h-${rClass(sc)}" x="${x}" y="${y}" width="${c - 3}" height="${c - 3}" rx="5"/><text class="fx-hs" x="${x + c - 8}" y="${y + 13}" text-anchor="end">${sc}</text>`;
      ids.forEach((id, k) => { if (k < 6) s += `<text class="fx-hid" x="${x + 5 + (k % 2) * 32}" y="${y + 28 + Math.floor(k / 2) * 14}">${k === 5 && ids.length > 6 ? "+" + (ids.length - 5) : esc(id)}</text>`; });
    }
    for (let k = 1; k <= 5; k++) { s += `<text class="fe-tick" x="${x0 + (k - 1) * c + c / 2}" y="${y0 + 5 * c + 14}" text-anchor="middle">${k}</text><text class="fe-tick" x="${x0 - 8}" y="${y0 + (5 - k) * c + c / 2 + 4}" text-anchor="end">${k}</text>`; }
    s += `<text class="fe-axis" x="${x0 + 2.5 * c}" y="${H - 4}" text-anchor="middle">Probability P (1 rare … 5 almost sure)</text><text class="fe-axis" transform="translate(16 ${y0 + 2.5 * c}) rotate(-90)" text-anchor="middle">Impact I</text>`;
    $("fxHeat").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fxHeat").innerHTML = s;
    R.risks = { top3: sorted.slice(0, 3).map((x) => [x.id, x.s]), count: cnt };
  };
  build(); draw();
  const upd = (e) => { const f = e.target.dataset.rf; if (f == null) return; const i = +e.target.dataset.ri; rk[i][+f] = f === "2" || f === "3" ? +e.target.value : e.target.value; draw(); };
  $("fxRkTab").addEventListener("input", upd); $("fxRkTab").addEventListener("change", upd);
  $("fxRkTab").addEventListener("click", (e) => { const b = e.target.closest("[data-rdel]"); if (!b) return; rk.splice(+b.dataset.rdel, 1); build(); draw(); });
  $("fxRkAdd").addEventListener("click", () => { let n = rk.length + 1; while (rk.some((r) => r[0] === "R" + String(n).padStart(2, "0"))) n++; rk.push(["R" + String(n).padStart(2, "0"), "New risk", 3, 3, "Mitigation …"]); build(); draw(); $("fxRkTab").closest("details").open = true; });
  $("fxRkRst").addEventListener("click", () => { rk = clone(EX.risks); build(); draw(); });
  $("fxRkCsv").addEventListener("click", () => download("fms_risk_register.csv", toCSV([["ID", "Risk", "P", "I", "Score", "Class", "Mitigation"], ...rk.map((r) => [r[0], r[1], r[2], r[3], r[2] * r[3], rClass(r[2] * r[3]), r[4]])]), "text/csv"));
}

/* ================================================================== 1K requirements → URS */
function html1K() {
  return card("fx1K", "1K · Requirements → URS – testable requirements, URS draft, traceability", "a requirement is only useful if it can be tested at FAT / SAT · number + unit + method",
    guide({
      principle: `<p>The <b>URS</b> (User Requirement Specification) is the owner's description of WHAT the system must do. It becomes part of the contract and the
        base of the acceptance tests – so every requirement must be <b>testable</b>: one requirement per sentence, the word <b>"shall"</b>, a <b>number with a unit</b>
        and a <b>verification method</b>. Words like "fast", "reliable", "user-friendly" cannot be tested and lead to arguments at acceptance.
        <b>Traceability</b> links each URS requirement to the integrator's design answer (FDS) and to the test that proves it.</p>
        <p class="phd-eq">good requirement = subject + shall + measurable value (number + unit) + condition + verification method</p>`,
      uses: URSUSE,
      howto: ["Fill the questionnaire 1D first – the generator below turns every answer into a numbered URS requirement and lists the open points.",
        "Run every sentence through the testability checker; rewrite until it passes.",
        "Send the URS with the RFQ; ask suppliers to answer every ID with comply / deviation (P4).",
        "Keep the traceability table alive until SAT: no requirement without FDS reference and test reference."],
    }) + `
    <h3 class="fe-h3">(a) Testability checker</h3>
    <div class="grid2 eq fx-top0"><div><textarea id="fxReq" class="fx-ta" rows="4" spellcheck="false"></textarea>
        <div class="fe-row">${REQEX.map((x, i) => `<button class="mx-el" data-rex="${i}">Example ${i + 1} (bad)</button>`).join("")}</div></div>
      <div id="fxReqRes"></div></div>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Before (not testable)</th><th>After (testable)</th></tr></thead>
      <tbody>${REQEX.map(([a, b]) => `<tr><td class="fe-no">${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>
    <h3 class="fe-h3">(b) URS draft generator <span class="sub">reads the answers of the questionnaire 1D in this browser · updates live</span></h3>
    <div class="fe-row"><label>Project name <input id="fxUrsName" class="fx-name"></label><button class="mx-el" id="fxUrsRef">Re-read answers</button><button class="mx-el" id="fxUrsDl">Download URS (.md)</button><span class="sub" id="fxUrsSum"></span></div>
    <pre id="fxUrsMd" class="fx-md"></pre>
    <h3 class="fe-h3">(c) Traceability table <span class="sub">URS → FDS → test · edit the FDS and test references</span></h3>
    <div class="fe-row"><button class="mx-el" id="fxTrCsv">Export CSV</button><button class="mx-el" id="fxTrEx">Fill example references</button><button class="mx-el" id="fxTrClr">Clear references</button><span class="sub" id="fxTrSum"></span></div>
    <div class="fe-scroll"><table class="am-tab fe-calc fx-tr" id="fxTrTab"></table></div>`);
}
// testability check of one requirement sentence → {vague[], hasShall, nums[], hasUnit, hasVerify, score, verdict}
function checkReq(text) {
  const low = " " + String(text).toLowerCase().replace(/\s+/g, " ") + " ";
  const found = [];
  VAGUE.slice().sort((a, b) => b[0].length - a[0].length).forEach(([w, why, fix]) => {
    const re = new RegExp("(^|[^a-z0-9-])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=$|[^a-z0-9-])", "i");
    if (re.test(low) && !found.some((f) => f[0].includes(w))) found.push([w, why, fix]);
  });
  const numRe = /(\d+(?:[.,]\d+)?)\s*([^\s\d,;:]*)/g; let m; const nums = []; let hasUnit = false;
  while ((m = numRe.exec(low))) {
    nums.push(m[1]);
    const tok = (m[2] || "").replace(/[)\].]+$/, ""), first = tok.split("/")[0];
    if (UNITS.includes(tok) || UNITS.includes(first)) hasUnit = true;
    else if (!tok) { const nxt = low.slice(numRe.lastIndex).trim().split(/[\s,;.]+/)[0] || ""; if (UNITS.includes(nxt) || UNITS.includes(nxt.split("/")[0])) hasUnit = true; }
  }
  const words = low.split(/[^a-zµ°%€0-9]+/);
  const hasVerify = VERIFY.some((v) => words.includes(v));
  const hasShall = /\bshall\b/.test(low);
  const score = (found.length === 0) + hasShall + (nums.length > 0) + hasUnit + hasVerify;
  return { vague: found, hasShall, nums, hasUnit, hasVerify, score, ok: score === 5 };
}
function init1K() {
  // (a) checker
  const ta = $("fxReq");
  ta.value = store.get("req", REQEX[0][0]);
  const chk = () => {
    store.set("req", ta.value);
    const r = checkReq(ta.value);
    const it = (ok, t) => `<li class="${ok ? "fe-ok" : "fe-no"}">${ok ? "✓" : "✗"} ${t}</li>`;
    $("fxReqRes").innerHTML = `<p class="fe-big">Testability <b>${r.score} / 5</b> · ${r.ok ? '<span class="fe-ok">testable</span>' : '<span class="fe-no">not yet testable</span>'}</p>
      <ul class="fx-check">${it(!r.vague.length, r.vague.length ? `vague words: ${r.vague.map(([w]) => `<b>"${esc(w)}"</b>`).join(", ")}` : "no vague words")}${it(r.hasShall, 'uses "shall" (binding)')}${it(r.nums.length > 0, r.nums.length ? `numbers: ${r.nums.map(esc).join(", ")}` : "no number")}${it(r.hasUnit, "number with a unit (min, %, parts, mm …)")}${it(r.hasVerify, "verification method named (test, measure, inspection, FAT, SAT …)")}</ul>
      ${r.vague.length ? `<table class="am-tab"><thead><tr><th>Word</th><th>Problem</th><th>Write instead, e.g.</th></tr></thead><tbody>${r.vague.map(([w, why, fix]) => `<tr><td><b>${esc(w)}</b></td><td>${esc(why)}</td><td>${esc(fix)}</td></tr>`).join("")}</tbody></table>` : ""}`;
    R.req = { score: r.score, vague: r.vague.map((v) => v[0]) };
  };
  ta.addEventListener("input", chk);
  document.querySelectorAll("[data-rex]").forEach((b) => b.addEventListener("click", () => { ta.value = REQEX[+b.dataset.rex][0]; chk(); }));
  chk();
  // (b) URS generator
  $("fxUrsName").value = store.get("ursName", "FMS project");
  let md = "";
  const gen = () => {
    const ans = store.raw("fmse.answers", {}) || {};
    const name = $("fxUrsName").value || "FMS project"; store.set("ursName", name);
    const groups = [...new Set(QUEST.map((q) => q[1]))];
    const open = []; let nReq = 0; const chapters = [];
    groups.forEach((g, gi) => {
      const [code, title, ver] = URSCH[g] || ["GEN", g, "Review"];
      let k = 0; const lines = [];
      QUEST.filter((q) => q[1] === g).forEach(([id, , q]) => {
        const a = String(ans[id] || "").trim();
        if (!a) { open.push(`- [ ] ${id.toUpperCase()} – ${q}`); return; }
        k++; nReq++;
        const rid = `URS-${code}-${String(k).padStart(3, "0")}`;
        lines.push(`| ${rid} | ${q.replace(/\?$/, "").replace(/\|/g, "/")}: **${a.replace(/\|/g, "/").replace(/\n/g, " ")}** | ${ver} | ${id.toUpperCase()} |`);
      });
      chapters.push(`## ${gi + 3}. ${title} (${code})\n\n` + (lines.length ? `| ID | Requirement – the system shall fulfil | Verification | Source |\n|---|---|---|---|\n${lines.join("\n")}` : "_No answers yet – see open points._"));
    });
    const today = new Date().toISOString().slice(0, 10);
    md = `# User Requirement Specification (URS) – ${name}\n\nVersion 0.1 (draft) · ${today} · generated from the requirements questionnaire (FMS engineering 1D)\n\n` +
      `## 1. Purpose and scope\n\nThis URS describes WHAT the system shall do. The supplier answers every requirement ID with "comply" or "deviation" and describes HOW in the FDS.\n\n` +
      `## 2. Rules\n\n- Every requirement has an ID, a measurable value and a verification method (FAT / SAT).\n- "shall" = binding, "should" = wish (evaluated in the offer comparison).\n- Rewrite each line below as one testable sentence before release (use the checker 1K a).\n\n` +
      chapters.join("\n\n") + `\n\n## ${groups.length + 3}. Open points (${open.length})\n\n` + (open.length ? open.join("\n") : "_None – all questions answered._") + "\n";
    $("fxUrsMd").textContent = md;
    $("fxUrsSum").textContent = `${nReq} requirements · ${open.length} open points (of ${QUEST.length} questions)`;
    R.urs = { requirements: nReq, open: open.length };
  };
  gen();
  $("fxUrsName").addEventListener("input", gen);
  $("fxUrsRef").addEventListener("click", gen);
  let tm = 0; document.addEventListener("input", (e) => { if (e.target.closest && e.target.closest("[data-q]")) { clearTimeout(tm); tm = setTimeout(gen, 300); } });
  document.addEventListener("click", (e) => { if (e.target.closest && e.target.closest("#feQEx, #feQClr")) setTimeout(gen, 50); });
  window.addEventListener("storage", (e) => { if (e.key === "fmse.answers") gen(); });
  $("fxUrsDl").addEventListener("click", () => { gen(); download("URS_draft.md", md, "text/markdown"); });
  // (c) traceability
  const TREX = { "URS-PRD-001": ["FDS 2.1 part list", "FAT-01 first parts CMM"], "URS-CAP-001": ["FDS 4.2 capacity + scheduling", "FAT-07 8 h run / SAT-02 72 h"], "URS-AVL-001": ["FDS 4.5 availability concept", "SAT-02 72 h availability run"], "URS-QUA-001": ["FDS 5.1 process + measuring", "FAT-09 Cpk 50 parts"], "URS-UNM-001": ["FDS 4.3 unmanned concept", "SAT-03 8 h unmanned"], "URS-INT-001": ["FDS 7 interface sheets", "FAT-12 Modbus read/write"], "URS-SAF-001": ["FDS 8 safety concept", "FAT-15 safety validation"], "URS-DOC-001": ["FDS 10 documentation list", "SAT-06 document check"] };
  let tr = store.get("trace", {});
  const drawTr = () => {
    store.set("trace", tr);
    const rows = EX.requirements_sample;
    $("fxTrTab").innerHTML = `<thead><tr><th>URS ID</th><th>Chapter</th><th>Requirement</th><th>Verification</th><th>FDS reference</th><th>Test reference</th><th>Status</th></tr></thead>
      <tbody>${rows.map(([id, ch, t, v]) => { const x = tr[id] || ["", ""], done = x[0].trim() && x[1].trim(); return `<tr><td><b>${esc(id)}</b></td><td>${esc(ch)}</td><td>${esc(t)}</td><td>${esc(v)}</td>
        <td><input class="fx-ref" data-tid="${esc(id)}" data-tk="0" value="${esc(x[0])}" placeholder="FDS chapter"></td><td><input class="fx-ref" data-tid="${esc(id)}" data-tk="1" value="${esc(x[1])}" placeholder="FAT / SAT step"></td>
        <td id="fxTrS_${esc(id)}">${done ? '<span class="fe-ok">traced</span>' : '<span class="fe-no">open</span>'}</td></tr>`; }).join("")}</tbody>`;
    sumTr();
  };
  const sumTr = () => {
    const rows = EX.requirements_sample, n = rows.filter(([id]) => tr[id] && tr[id][0].trim() && tr[id][1].trim()).length;
    $("fxTrSum").textContent = `coverage ${n} / ${rows.length} = ${Math.round(100 * n / rows.length)} %`;
    rows.forEach(([id]) => { const c = document.getElementById("fxTrS_" + id), done = tr[id] && tr[id][0].trim() && tr[id][1].trim(); if (c) c.innerHTML = done ? '<span class="fe-ok">traced</span>' : '<span class="fe-no">open</span>'; });
    R.trace = { traced: n, total: rows.length };
  };
  $("fxTrTab").addEventListener("input", (e) => { const id = e.target.dataset.tid; if (!id) return; tr[id] = tr[id] || ["", ""]; tr[id][+e.target.dataset.tk] = e.target.value; store.set("trace", tr); sumTr(); });
  $("fxTrEx").addEventListener("click", () => { tr = clone(TREX); drawTr(); });
  $("fxTrClr").addEventListener("click", () => { tr = {}; drawTr(); });
  $("fxTrCsv").addEventListener("click", () => download("fms_traceability.csv", toCSV([["URS_ID", "Chapter", "Requirement", "Verification", "FDS_ref", "Test_ref"], ...EX.requirements_sample.map(([id, ch, t, v]) => [id, ch, t, v, (tr[id] || [])[0] || "", (tr[id] || [])[1] || ""])]), "text/csv"));
  drawTr();
}

/* ================================================================== 1L acceptance tests */
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sdev = (a) => { const m = mean(a); return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const parseNums = (t) => String(t).split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
function html1L() {
  const a = EX.acceptance_run;
  return card("fx1L", "1L · Acceptance tests – availability run, cycle-time check, process capability (Cpk)", "FAT at the supplier, SAT on site · the numbers from the URS are proven here",
    guide({
      principle: `<p>At <b>FAT</b> (factory acceptance test, at the supplier) and <b>SAT</b> (site acceptance test, in your plant) the supplier proves the URS numbers.
        Three calculations are used in almost every FMS contract: the <b>availability run</b> (only stops caused by the supplier count), the <b>cycle-time check</b>
        (mean of measured cycles vs the guaranteed time) and the <b>process capability</b> Cp / Cpk of critical features.</p>
        <p class="phd-eq">A = (T<sub>run</sub> − T<sub>owner</sub> − T<sub>supplier</sub>) ÷ (T<sub>run</sub> − T<sub>owner</sub>) · Cp = (USL − LSL) ÷ 6s · Cpk = min(USL − x̄, x̄ − LSL) ÷ 3s</p>`,
      uses: ACCUSE,
      howto: ["Write the test procedure in P3 together with the URS: duration, what counts as owner / supplier stop, sample size, who signs.",
        "During the run keep a stop log (start, end, cause, owner / supplier) signed by both sides every shift.",
        "Measure cycle times from the controller log (time stamps), not with a stopwatch, when possible.",
        "Cpk needs a capable measuring system first (MSA, %GRR ≤ 10 %) and ≥ 50 parts for a reliable value; 25 parts give only a first estimate."],
    }) + `
    <div class="fx-calc3">
      <div class="fx-box"><h4>Availability run</h4>
        <div class="fe-row fe-calc"><label>T_run <input type="number" id="fxAvR" value="${a.T_run_h}" step="any"> h</label><label>T_owner <input type="number" id="fxAvO" value="${a.T_owner_h}" step="any"> h</label>
          <label>T_supplier <input type="number" id="fxAvS" value="${a.T_supplier_h}" step="any"> h</label><label>Target <input type="number" id="fxAvT" value="${a.target}" step="0.01"></label></div>
        <div id="fxAvRes"></div></div>
      <div class="fx-box"><h4>Cycle-time check</h4>
        <div class="fe-row fe-calc"><label>Guaranteed <input type="number" id="fxCyG" value="${a.cycle_check.guaranteed_min}" step="any"> min</label></div>
        <textarea id="fxCyV" class="fx-ta" rows="2" spellcheck="false">${a.cycle_check.measured_min.join(", ")}</textarea>
        <div id="fxCyRes"></div><svg id="fxCyCh" class="fe-chart" role="img" aria-label="Measured cycle times"></svg></div>
      <div class="fx-box"><h4>Process capability Cp / Cpk</h4>
        <div class="fe-row fe-calc"><label>LSL <input type="number" id="fxCpL" step="any"></label><label>USL <input type="number" id="fxCpU" step="any"></label><button class="mx-el" id="fxCpEx">Example: ${esc(CPKEX.name)}</button></div>
        <textarea id="fxCpV" class="fx-ta" rows="3" spellcheck="false"></textarea>
        <div id="fxCpRes"></div><svg id="fxCpCh" class="fe-chart" role="img" aria-label="Histogram with tolerance limits"></svg></div>
    </div>`);
}
function init1L() {
  const av = () => {
    const T = +$("fxAvR").value, O = +$("fxAvO").value, S = +$("fxAvS").value, tg = +$("fxAvT").value;
    const A = (T - O - S) / (T - O), maxS = (1 - tg) * (T - O), ok = A >= tg;
    $("fxAvRes").innerHTML = `<p class="phd-eq">A = (${fx(T, 1)} − ${fx(O, 1)} − ${fx(S, 1)}) ÷ (${fx(T, 1)} − ${fx(O, 1)}) = ${fx(T - O - S, 1)} ÷ ${fx(T - O, 1)} = <b>${fx(A * 100, 2)} %</b></p>
      <p class="fe-big">${ok ? `<span class="fe-ok">PASSED</span> – ≥ ${fx(tg * 100, 1)} %` : `<span class="fe-no">FAILED</span> – below ${fx(tg * 100, 1)} %`}</p>
      <p class="sub">Supplier may cause at most (1 − target) × (T_run − T_owner) = <b>${fx(maxS, 2)} h</b> of stops; used ${fx(S, 2)} h (${fx(100 * S / maxS, 0)} % of the allowance). Owner stops (no raw parts, breaks, owner's IT) are removed from the base.</p>`;
    R.avail = { A: +A.toFixed(5), pass: ok, maxSupplier_h: +maxS.toFixed(3) };
  };
  ["fxAvR", "fxAvO", "fxAvS", "fxAvT"].forEach((id) => $(id).addEventListener("input", av)); av();
  const cy = () => {
    const v = parseNums($("fxCyV").value), g = +$("fxCyG").value;
    if (v.length < 2) { $("fxCyRes").innerHTML = '<p class="fe-no">Enter at least 2 values.</p>'; return; }
    const m = mean(v), s = sdev(v), mx = Math.max(...v), over = v.filter((x) => x > g).length, ok = m <= g;
    $("fxCyRes").innerHTML = `<table class="am-kv"><tbody><tr><td>n</td><td>${v.length}</td></tr><tr><td>Mean x̄ = Σx ÷ n</td><td><b>${fx(m, 2)} min</b></td></tr>
      <tr><td>Sample std s = √(Σ(x − x̄)² ÷ (n − 1))</td><td><b>${fx(s, 3)} min</b></td></tr><tr><td>Max</td><td><b>${fx(mx, 1)} min</b> · ${over} value(s) above ${fx(g, 1)}</td></tr></tbody></table>
      <p class="fe-big">${ok ? `<span class="fe-ok">PASSED</span> – mean ${fx(m, 2)} ≤ ${fx(g, 1)} min` : `<span class="fe-no">FAILED</span> – mean ${fx(m, 2)} &gt; ${fx(g, 1)} min`}</p>
      <p class="sub">Contract rule here: the mean of the measured cycles must not exceed the guaranteed time. Some contracts also limit the maximum – then the verdict would be ${mx <= g ? "passed" : "failed"} (max ${fx(mx, 1)}).</p>`;
    const lo = Math.min(...v, g) - 0.3, hi = Math.max(...v, g) + 0.3;
    xyChart($("fxCyCh"), { series: [{ cls: "fx-s1 fx-nol", dots: true, pts: v.map((x, i) => [i + 1, x]) }], xmin: 0.5, xmax: v.length + 0.5, ymin: lo, ymax: hi, xl: "Cycle number", yl: "min",
      hmarks: [[g, "fe-req", "guaranteed " + fx(g, 1)], [m, "fx-mean", "mean " + fx(m, 2), true]], W: 520, H: 230, xfmt: (x) => (x % 1 ? "" : String(x)), yfmt: (y) => fx(y, 1) });
    R.cycle = { mean: +m.toFixed(3), s: +s.toFixed(4), max: mx, pass: ok };
  };
  ["fxCyG", "fxCyV"].forEach((id) => $(id).addEventListener("input", cy)); cy();
  const cp = () => {
    const v = parseNums($("fxCpV").value), L = +$("fxCpL").value, U = +$("fxCpU").value;
    store.set("cpk", { v: $("fxCpV").value, L, U });
    if (v.length < 2 || !(U > L)) { $("fxCpRes").innerHTML = '<p class="fe-no">Enter ≥ 2 values and USL &gt; LSL.</p>'; $("fxCpCh").innerHTML = ""; return; }
    const m = mean(v), s = sdev(v), Cp = (U - L) / (6 * s), Cpk = Math.min(U - m, m - L) / (3 * s), ok = Cpk >= 1.33;
    const dec = Math.max(2, Math.min(5, ((String(v[0]).split(".")[1] || "").length) + 1));
    $("fxCpRes").innerHTML = `<table class="am-kv"><tbody><tr><td>n</td><td>${v.length}${v.length < 50 ? ' <span class="sub">(&lt; 50: first estimate only)</span>' : ""}</td></tr><tr><td>Mean x̄</td><td><b>${fx(m, dec)}</b></td></tr><tr><td>Std s</td><td><b>${fx(s, dec + 1)}</b></td></tr>
      <tr><td>Cp = (USL − LSL) ÷ 6s</td><td>(${U} − ${L}) ÷ (6 × ${fx(s, dec + 1)}) = <b>${fx(Cp, 2)}</b></td></tr>
      <tr><td>Cpk = min(USL − x̄, x̄ − LSL) ÷ 3s</td><td>min(${fx(U - m, dec)}, ${fx(m - L, dec)}) ÷ ${fx(3 * s, dec + 1)} = <b>${fx(Cpk, 2)}</b></td></tr></tbody></table>
      <p class="fe-big">${ok ? `<span class="fe-ok">CAPABLE</span> – Cpk ${fx(Cpk, 2)} ≥ 1.33` : `<span class="fe-no">NOT CAPABLE</span> – Cpk ${fx(Cpk, 2)} &lt; 1.33`}</p>
      <p class="sub">${Cp - Cpk > 0.2 ? "Cp is clearly higher than Cpk → the process is not centred: move the mean (tool offset) towards the middle " + fx((U + L) / 2, dec) + "." : "Process is well centred – to raise Cpk reduce the spread s (machine, fixture, temperature)."}</p>`;
    // histogram with LSL / USL
    const lo = Math.min(L, ...v), hi = Math.max(U, ...v), bins = 12, bw = (hi - lo) / bins || 1, cnt = Array(bins).fill(0);
    v.forEach((x) => { cnt[Math.min(bins - 1, Math.floor((x - lo) / bw))]++; });
    const W = 520, H = 210, x0 = 40, x1 = W - 12, y0 = H - 34, y1 = 12, X = (x) => x0 + (x - lo) / (hi - lo || 1) * (x1 - x0), cm = Math.max(...cnt);
    let s2 = "";
    cnt.forEach((c, k) => { const h = c / cm * (y0 - y1); s2 += `<rect class="fx-hist" x="${X(lo + k * bw) + 1}" y="${y0 - h}" width="${Math.max(1, X(lo + (k + 1) * bw) - X(lo + k * bw) - 2)}" height="${h}"/>`; });
    [[L, "LSL", "start"], [U, "USL", "end"]].forEach(([x, n, an]) => { s2 += `<line class="fe-req" x1="${X(x)}" x2="${X(x)}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${X(x)}" y="${y0 + 14}" text-anchor="${an}">${n} ${x}</text>`; });
    s2 += `<line class="fx-mean" x1="${X(m)}" x2="${X(m)}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${X(m)}" y="${y0 + 27}" text-anchor="middle">x̄ ${fx(m, dec)}</text><line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y0}" y2="${y0}"/>`;
    $("fxCpCh").setAttribute("viewBox", `0 0 ${W} ${H}`); $("fxCpCh").innerHTML = s2;
    R.cpk = { n: v.length, mean: +m.toFixed(5), s: +s.toFixed(6), Cp: +Cp.toFixed(3), Cpk: +Cpk.toFixed(3), pass: ok };
  };
  const setEx = () => { $("fxCpV").value = CPKEX.values.join(", "); $("fxCpL").value = CPKEX.lsl; $("fxCpU").value = CPKEX.usl; cp(); };
  const saved = store.get("cpk", null);
  if (saved && saved.v) { $("fxCpV").value = saved.v; $("fxCpL").value = saved.L; $("fxCpU").value = saved.U; cp(); } else setEx();
  ["fxCpL", "fxCpU", "fxCpV"].forEach((id) => $(id).addEventListener("input", cp));
  $("fxCpEx").addEventListener("click", setEx);
}

/* ================================================================== 1M module deep dive + N² interface matrix */
const CTRL = ["M19", "M20", "M21", "M22"];
// resolve the JSON interface list for one kit (rules of EX.interfaces_note)
function resolveIf(kit) {
  const rows = [];
  EX.interfaces.forEach(([a, b, ty, tx]) => {
    if (!kit.includes(a)) return;
    let tg;
    if (b === "*") tg = kit.filter((m) => !CTRL.includes(m) && m !== a);
    else if (b === "*physical") tg = kit.filter((m) => !CTRL.includes(m) && m !== "M09" && m !== a);
    else if (b === "*networked") tg = kit.filter((m) => m !== "M02" && m !== a);
    else tg = kit.includes(b) ? [b] : [];
    tg.forEach((x) => rows.push({ a, b: x, ty, tx }));
  });
  return rows;
}
const TYAB = { mech: "M", signal: "S", data: "D", utility: "U", safety: "F", network: "N" };
const tyAb = (ty) => ty.split("+").map((x) => TYAB[x] || x[0].toUpperCase()).join("+");
function html1M() {
  return card("fx1M", "1M · Module deep dive – boundary, IO list with tags, handshakes, alarms, FAT steps · N² interface matrix", "22 standard modules · tags PLT1.MACH.FMS1.&lt;UNIT&gt;.&lt;Signal&gt; · alarm number = module × 1000 + n",
    guide({
      principle: `<p>A module is only reusable when its <b>boundary</b> is clear: what is inside (delivered, tested and documented with the module) and what is outside
        (delivered by someone else, connected by an interface). Each module then has a <b>standard IO list</b> with fixed tag names, a <b>standard set of alarms</b>,
        <b>handshake partners</b> and <b>FAT steps</b>. The <b>N² matrix</b> lists every interface between the modules of a system – each filled cell needs one
        interface sheet with one owner.</p>
        <p class="phd-eq">tag = PLT1.MACH.FMS1.&lt;UNIT&gt;.&lt;Signal&gt; · alarm no. = module no. × 1000 + n (e.g. M03 fault 2 → 3002) · interfaces ≤ N(N−1)/2</p>`,
      uses: [["Machining", "FMS kit (16 modules): 51 interfaces. The pallet pool M03 has the most (APC, load station, washer, CMM, AS/RS, safety, cell controller, network)."],
        ["Assembly", "Assembly kit: the conveyor M07 is the hub – every station interface is 'carrier stop + RFID + release'."],
        ["Welding", "Welding kit: robot M05 ↔ welding M15 is the key interface (job number, arc on, table index) – write it first."],
        ["Sheet metal", "Sheet kit: AS/RS M08 ↔ pallet pool M03 and robot M05 ↔ press M16; the safety interface M18 reaches every moving module."]],
      howto: ["Choose the kit (1E), open each module here and copy its IO list (CSV) into the electrical design (items 7–8) – adapt only the unit number.",
        "Use the N² matrix as the checklist of interface sheets: one sheet per filled cell, signed by both module owners before FDS release.",
        "Give every alarm its number from the module range – the SCADA alarm list then sorts by module automatically.",
        "Use the FAT steps as the start of the FAT protocol per module (item 13)."],
    }) + `
    <div class="fe-row"><label>Module <select id="fxModSel">${MODULES.map((m) => `<option value="${m[0]}">${m[0]} · ${esc(m[1])}</option>`).join("")}</select></label>
      <button class="mx-el" id="fxModPrev">◀</button><button class="mx-el" id="fxModNext">▶</button><button class="mx-el" id="fxModCsv">Export IO list CSV</button></div>
    <div id="fxModD"></div>
    <h3 class="fe-h3">N² interface matrix <span class="sub">rows / columns = modules of the kit · click a cell</span></h3>
    <div class="fe-row"><label>Kit <select id="fxKit">${Object.keys(EX.kits).map((k) => `<option value="${k}">${esc(EX.kit_names[k] || k)}</option>`).join("")}</select></label>
      <span class="sub">M = mechanical · S = signal · D = data · U = utility · F = functional safety · N = network</span></div>
    <div id="fxKitSum"></div>
    <div class="grid2"><div class="fe-scroll"><table class="fx-n2" id="fxN2"></table></div><div id="fxIfD"></div></div>
    <p class="am-note">${esc(EX.interfaces_note)}</p>`);
}
function init1M() {
  let cur = store.get("mod", "M03"); if (!MODDEEP[cur]) cur = "M03";
  const tag = (u, s) => `PLT1.MACH.FMS1.${u}.${s}`;
  const draw = () => {
    store.set("mod", cur); $("fxModSel").value = cur;
    const m = MODULES.find((x) => x[0] === cur), d = MODDEEP[cur], no = +cur.slice(1);
    $("fxModD").innerHTML = `<h3 class="fe-h3">${cur} · ${esc(m[1])} <span class="sub">unit code ${esc(d.u)} · group ${esc(m[2])} · typical IO ${esc(m[4])}</span></h3>
      <div class="grid2 eq fx-top0">
        <div><table class="am-kv"><tbody><tr><td>What it does</td><td>${esc(m[3])}</td></tr><tr><td><b>Inside</b> the module</td><td>${esc(d.inside)}</td></tr><tr><td><b>Outside</b> (interface only)</td><td>${esc(d.outside)}</td></tr>
          <tr><td>Variants</td><td>${ul(d.variants.map(esc))}</td></tr><tr><td>Handshake partners</td><td>${d.partners.map(esc).join(" · ")}</td></tr></tbody></table>
          <h4>Key parameters</h4><table class="am-kv"><tbody>${d.params.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>
        <div><h4>Typical IO list <span class="sub">IN = module → cell controller, OUT = cell controller → module</span></h4>
          <div class="fe-scroll"><table class="am-tab fx-io"><thead><tr><th>Tag</th><th>Dir</th><th>Type</th><th>Meaning</th></tr></thead>
            <tbody>${d.io.map(([s, dir, ty, t]) => `<tr><td><code>${esc(tag(d.u, s))}</code></td><td>${esc(dir)}</td><td>${esc(ty)}</td><td>${esc(t)}</td></tr>`).join("")}</tbody></table></div>
          <p class="sub">${esc(MODUSE_NOTE)}</p></div></div>
      <div class="grid2 eq fx-top0">
        <div><h4>Typical faults / alarms <span class="sub">range ${no * 1000 + 1} … ${no * 1000 + 999}</span></h4>
          <div class="fe-scroll"><table class="am-tab"><thead><tr><th>No.</th><th>Alarm</th><th>Reaction</th></tr></thead><tbody>${d.faults.map(([n, t, r]) => `<tr><td><b>${no * 1000 + n}</b></td><td>${esc(t)}</td><td>${esc(r)}</td></tr>`).join("")}</tbody></table></div></div>
        <div><h4>FAT test steps</h4><ol class="fx-steps">${d.fat.map((x) => `<li>☐ ${esc(x)}</li>`).join("")}</ol>
          <h4>Use cases</h4>${d.uses.map(([dom, t]) => `<p><b>${esc(dom)}:</b> ${esc(t)}</p>`).join("")}</div></div>`;
  };
  const step = (k) => { const i = MODULES.findIndex((x) => x[0] === cur); cur = MODULES[(i + k + MODULES.length) % MODULES.length][0]; draw(); };
  $("fxModSel").addEventListener("change", () => { cur = $("fxModSel").value; draw(); });
  $("fxModPrev").addEventListener("click", () => step(-1)); $("fxModNext").addEventListener("click", () => step(1));
  $("fxModCsv").addEventListener("click", () => { const d = MODDEEP[cur]; download(`${cur}_${d.u}_io_list.csv`, toCSV([["Tag", "Direction", "Type", "Meaning"], ...d.io.map(([s, dir, ty, t]) => [tag(d.u, s), dir, ty, t])]), "text/csv"); });
  draw();
  // N² matrix
  let kit = store.get("kit", "fms"); if (!EX.kits[kit]) kit = "fms";
  let sel = null;
  const drawN2 = () => {
    store.set("kit", kit); $("fxKit").value = kit;
    const ms = EX.kits[kit], rows = resolveIf(ms), cell = {};
    rows.forEach((r) => { [[r.a, r.b], [r.b, r.a]].forEach(([p, q]) => { (cell[p + "|" + q] = cell[p + "|" + q] || []).push(r); }); });
    const pairs = new Set(rows.map((r) => [r.a, r.b].sort().join("|")));
    const byTy = {}; rows.forEach((r) => r.ty.split("+").forEach((t) => { byTy[t] = (byTy[t] || 0) + 1; }));
    const perMod = Object.fromEntries(ms.map((m) => [m, rows.filter((r) => r.a === m || r.b === m).length]));
    const hub = ms.filter((m) => !CTRL.includes(m) && m !== "M18").sort((a, b) => perMod[b] - perMod[a])[0];
    const N = ms.length;
    $("fxKitSum").innerHTML = `<div class="phd-kpis"><div class="phd-kpi"><b>${rows.length}</b><span>interfaces in kit ${esc(EX.kit_names[kit])} (${N} modules)</span></div>
      <div class="phd-kpi"><b>${pairs.size}</b><span>module pairs of N(N−1)/2 = ${N * (N - 1) / 2} possible</span></div>
      <div class="phd-kpi"><b>${Object.entries(byTy).map(([t, n]) => `${TYAB[t] || t}${n}`).join(" ")}</b><span>by content type</span></div>
      <div class="phd-kpi"><b>${hub} (${perMod[hub]})</b><span>process / handling module with most interfaces</span></div></div>`;
    $("fxN2").innerHTML = `<thead><tr><th></th>${ms.map((m) => `<th><span>${m}</span></th>`).join("")}<th>Σ</th></tr></thead><tbody>${ms.map((a) => `<tr><th title="${esc((MODULES.find((x) => x[0] === a) || [, ""])[1])}">${a} <span class="sub">${esc(MODDEEP[a].u)}</span></th>${ms.map((b) => {
      if (a === b) return `<td class="fx-diag">${a.slice(1)}</td>`;
      const c = cell[a + "|" + b];
      return c ? `<td class="fx-n2c fx-t-${c[0].ty.split("+")[0]}${sel === a + "|" + b ? " fx-n2sel" : ""}" data-pq="${a}|${b}">${[...new Set(c.map((x) => tyAb(x.ty)))].join(",")}</td>` : "<td></td>";
    }).join("")}<td><b>${perMod[a]}</b></td></tr>`).join("")}</tbody>`;
    const showIf = (pq) => {
      const c = cell[pq];
      if (!c) { $("fxIfD").innerHTML = `<p class="sub">Click a filled cell to see the interface content. Empty cell = no direct interface (the modules talk only through the cell controller).</p>`; return; }
      const [a, b] = pq.split("|");
      $("fxIfD").innerHTML = `<h3 class="fe-h3">${a} ↔ ${b}</h3><p class="sub">${esc(MODULES.find((x) => x[0] === a)[1])} ↔ ${esc(MODULES.find((x) => x[0] === b)[1])}</p>
        ${c.map((r) => `<table class="am-kv"><tbody><tr><td>Owner side</td><td><b>${r.a}</b> (listed from ${r.a})</td></tr><tr><td>Content type</td><td>${esc(r.ty)}</td></tr><tr><td>Interface content</td><td>${esc(r.tx)}</td></tr></tbody></table>`).join("")}
        <h4>Interface sheet – fill in</h4>${ul(["Mechanical: hand-over position, tolerance, load, drawing number", "Electrical: connector, cable, voltage, terminal numbers", "Signals: tag names (see IO lists above), positive logic, timeouts", "Data: words / registers of the standard data block, update rate", "Safety: which safety function, PL, stop category", "Owner of the interface, version, signatures of both module owners"])}`;
    };
    showIf(sel && cell[sel] ? sel : null);
    R.n2 = R.n2 || {}; Object.keys(EX.kits).forEach((k) => { const rr = resolveIf(EX.kits[k]); R.n2[k] = { interfaces: rr.length, pairs: new Set(rr.map((r) => [r.a, r.b].sort().join("|"))).size }; });
  };
  $("fxKit").addEventListener("change", () => { kit = $("fxKit").value; sel = null; drawN2(); });
  $("fxN2").addEventListener("click", (e) => { const td = e.target.closest("[data-pq]"); if (!td) return; sel = td.dataset.pq; drawN2(); });
  drawN2();
}
