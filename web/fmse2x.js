/* FMS engineering – item 2, deep sections 2F–2M (loaded by fmse2.js at the end of item 2).
 * 2F product analysis (ABC / Pareto, BOM) · 2G group technology code (simplified Opitz) · 2H process chain, allowances, routing sheet
 * 2I time + tool life (spindle curve, Taylor economics, tapping, moulding, bending, arc time) · 2J calendar, capacity, lot size (EOQ)
 * 2K line balancing (RPW + LCR) · 2L AHP + life-cycle cost · 2M machine catalogue.
 * Example numbers: EX2 in fmse2x_data.js = copy of tools/fmse/examples/item2_examples.json (same formulas as guide docs/62 and tools/fmse/*.py).
 * Everything runs offline in the browser; user edits are kept in localStorage keys "fmse.2x.*". */
import { EX2, USES, ABC_MEAN, BOM, OPITZ, OPITZ_CELL, ROUTING, MACH } from "./fmse2x_data.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const eur = (x) => (Number.isFinite(x) ? Math.round(x).toLocaleString("en") + " €" : "–");
const rnd = (x, d = 4) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const store = {   // own keys "fmse.2x.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.2x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.2x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
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
const wx = (title, steps) => `<details class="fx-more f2-wx"><summary><b>Worked example</b> – ${title}</summary><ol class="fx-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ol></details>`;

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
  const kfmt = (v) => (Math.abs(v) >= 1e6 ? fx(v / 1e6, v % 1e6 ? 1 : 0) + "M" : Math.abs(v) >= 1e4 ? fx(v / 1e3, v % 1e3 ? 1 : 0) + "k" : fx(v, Math.abs(v) < 10 && v % 1 ? (Math.abs(v * 10) % 1 ? 2 : 1) : 0));
  let s = "";
  ticks(ymin, ymax, ylog).forEach((v) => { const y = Y(v); s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/><text class="fe-tick" x="${x0 - 6}" y="${y + 4}" text-anchor="end">${(yfmt || kfmt)(v)}</text>`; });
  ticks(xmin, xmax, xlog).forEach((v) => { const x = X(v); s += `<line class="fe-grid" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/><text class="fe-tick" x="${x}" y="${y0 + 15}" text-anchor="middle">${(xfmt || kfmt)(v)}</text>`; });
  hmarks.forEach(([v, cls, lab, left]) => { const y = Y(v); s += `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>${lab ? `<text class="fe-tick" x="${left ? x0 + 6 : x1 - 4}" y="${y - 5}" text-anchor="${left ? "start" : "end"}">${esc(lab)}</text>` : ""}`; });
  vmarks.forEach(([v, cls, lab, dy]) => { const x = X(v); s += `<line class="${cls}" x1="${x}" x2="${x}" y1="${y1}" y2="${y0}"/>${lab ? `<text class="fe-tick" x="${x + 4}" y="${y1 + 10 + (dy || 0)}">${esc(lab)}</text>` : ""}`; });
  series.forEach((sr) => {
    const raw = sr.pts.filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
    const pts = raw.map(([a, b]) => [X(a), Y(b)]);
    if (!sr.noline) s += `<polyline class="f2-ln ${sr.cls}" points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}"/>`;
    if (sr.dots) pts.forEach(([a, b], i) => { s += `<circle class="f2-dot ${sr.cls}" cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="${sr.r || 3.2}"/>${sr.lab && sr.lab[i] ? `<text class="f2-plab" x="${(a + 7).toFixed(1)}" y="${(b + (i % 2 ? 16 : -6)).toFixed(1)}">${esc(sr.lab[i])}</text>` : ""}`; });
  });
  s += `<text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 6}" text-anchor="middle">${esc(xl)}</text><text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${esc(yl)}</text>`;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  return series.filter((sr) => sr.n).map((sr) => `<span class="fx-lg"><i class="f2-lg ${sr.cls}"></i>${esc(sr.n)}</span>`).join(" ");
}

/* ------------------------------------------------------------------ shared formulas (exactly as EX2._formulas) */
const IT = EX2.it_table_um;
function itRange(D) { const r = IT.ranges_mm.findIndex(([lo, hi]) => D > lo && D <= hi); return r >= 0 ? r : D <= IT.ranges_mm[0][1] ? 0 : IT.ranges_mm.length - 1; }
function itUm(g, D) { const k = IT.grades.indexOf(g); return k < 0 ? NaN : IT.values[itRange(D)][k]; }
function itGrade(D, tolUm) { let g = 0; IT.grades.forEach((k) => { if (itUm(k, D) <= tolUm) g = k; }); return g; }   // 0 = finer than IT5

/* ================================================================== mount */
export function mount(el) {
  el.innerHTML = [html2F(), html2G(), html2H(), html2I(), html2J(), html2K(), html2L(), html2M()].join("");
  const it = [init2F, init2G, init2H, init2I, init2J, init2K, init2L, init2M];
  it.forEach((f) => { try { f(); } catch (e) { console.error("fmse2x " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  R.it_2B = { D: 52, tol_um: 30, grade: itGrade(52, 30), IT_um: itUm(itGrade(52, 30), 52), range: IT.ranges_mm[itRange(52)] };
  window.fe2x = { results };   // for tests / cross-checks: window.fe2x.results()
}
const R = {};   // latest key results of every section (read by tests)
const results = () => clone(R);

/* ================================================================== 2F product analysis – ABC / Pareto + BOM */
function html2F() {
  return card("f22F", "2F · Product analysis – ABC / Pareto: which parts carry the volume? + bill of materials", "edit the part list · class A / B / C decides which system type each part needs",
    guide({
      principle: `<p>In almost every factory a few parts make most of the volume (Pareto 80/20). Sort the parts by annual volume (or by revenue = volume × price),
        add the shares from the top and cut the list into three classes. <b>A</b> parts justify a dedicated or highly automated system,
        <b>B</b> parts share a flexible system (FMS, cells), <b>C</b> parts should not drive the design (job shop, supplier). The analysis is the first step of the
        P-Q analysis (product – quantity) of the plant layout method (Muther).</p>
        <p class="phd-eq">value_i = Q_i (basis volume) or Q_i·price_i (basis revenue) · share_i = value_i / Σ value · cum_i = Σ shares of the parts before i (sorted descending)<br>
        class A if cum before the part &lt; 80 %, B if &lt; 95 %, else C</p>
        <p>The cut is made with the cumulative share <b>before</b> the part is added – so the part that crosses 80 % is still A (it carries part of the first 80 %).</p>`,
      uses: USES.F,
      howto: ["Take 12 months of sales or production data per part number from the ERP (volume and price) – plus the forecast for the next 3–5 years.",
        "Run ABC by volume (for capacity / system type) AND by revenue (for priorities); a part that is A in one and C in the other needs a discussion.",
        "Plot the result (P-Q curve): a steep curve → product layout (lines) for A; a flat curve → process layout / FMS.",
        "Re-check the classes every year – new products move parts between classes and may change the system design."],
    }) + `
    <div class="fe-row"><label>Basis <select id="f2AbcBasis"><option value="volume">annual volume</option><option value="revenue">revenue = volume × price</option></select></label>
      <button class="mx-el" id="f2AbcAdd">+ Add part</button><button class="mx-el" id="f2AbcRst">Reset to example</button><button class="mx-el" id="f2AbcCsv">Export CSV</button></div>
    <div class="grid2 eq">
      <div><div class="fe-scroll"><table class="am-tab fe-calc f2-abc" id="f2AbcTab"></table></div></div>
      <div><svg id="f2Pareto" class="fe-chart" role="img" aria-label="Pareto chart of the parts"></svg><div class="sub" id="f2ParetoLg"></div><div id="f2AbcRes"></div></div>
    </div>
    <h3 class="fe-h3">What the classes mean for the system design</h3>
    <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Class</th><th>Typical share</th><th>System type</th><th>Planning rule</th></tr></thead>
      <tbody>${ABC_MEAN.map(([c, a, b, d]) => `<tr><td><span class="f2-cls f2-c${c}">${c}</span></td><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(d)}</td></tr>`).join("")}</tbody></table></div>
    <div id="f2AbcWx"></div>
    <h3 class="fe-h3">Bill of materials (BOM) – structure of the product</h3>
    <div class="fx-prin"><p>The BOM lists every part of the product with the <b>quantity per parent</b>. Level 0 = end product, level 1 = main assemblies, level 2 = parts.
      The gross requirement of a part = product volume × product of all quantities on the way down the tree. "Make" parts are your machining
      / assembly load (input for 2J), "buy" parts go to purchasing. The BOM also gives the assembly sequence (input for line balancing 2K).</p>
      <p class="phd-eq">gross requirement(part) = Q_product × Π qty(parents … part)</p></div>
    <div class="fe-row"><label>Compressors VC20 per year <input type="number" id="f2BomQ" value="3000" min="0" step="100"></label>
      <span class="sub">the 3 models VC10 / VC20 / VC30 (9 000 per year) share all parts except the crankcase → common parts × 3 = volumes in the ABC table (cylinder 2 × 9 000 = 18 000)</span></div>
    <div class="grid2 eq"><div class="f2-bom" id="f2Bom"></div><div class="fe-scroll" id="f2BomReq"></div></div>`);
}
function abcCalc(parts, basis) {
  const rows = parts.map((p, i) => ({ i, n: p[0], q: Math.max(0, num(p[1])), pr: Math.max(0, num(p[2])) })).map((r) => ({ ...r, v: basis === "revenue" ? r.q * r.pr : r.q }));
  const tot = rows.reduce((a, r) => a + r.v, 0) || 1;
  const s = [...rows].sort((a, b) => b.v - a.v || a.i - b.i);
  let cum = 0;
  s.forEach((r, k) => { r.rank = k + 1; r.before = cum / tot; r.cls = r.before < 0.8 ? "A" : r.before < 0.95 ? "B" : "C"; r.share = r.v / tot; cum += r.v; r.cum = cum / tot; });
  return { rows, sorted: s, tot };
}
function init2F() {
  const def = () => ({ basis: EX2.pq_parts.basis, parts: clone(EX2.pq_parts.parts) });
  let st = store.get("abc", def());
  const build = () => {
    $("f2AbcBasis").value = st.basis;
    $("f2AbcTab").innerHTML = `<thead><tr><th>Part</th><th>Volume / year</th><th>Price €</th><th>Value</th><th>Share</th><th>Cum. before</th><th>Rank</th><th>Class</th><th></th></tr></thead>
      <tbody>${st.parts.map((p, i) => `<tr><td><input class="f2-wn" data-i="${i}" data-k="0" value="${esc(p[0])}"></td><td><input type="number" min="0" data-i="${i}" data-k="1" value="${p[1]}"></td><td><input type="number" min="0" step="any" data-i="${i}" data-k="2" value="${p[2]}"></td>
        <td id="f2Av${i}"></td><td id="f2As${i}"></td><td id="f2Ac${i}"></td><td id="f2Ar${i}"></td><td id="f2Ak${i}"></td><td><button class="mx-el fx-x" data-del="${i}" title="remove">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const draw = () => {
    store.set("abc", st);
    const r = abcCalc(st.parts, st.basis), rev = st.basis === "revenue";
    r.rows.forEach((x) => {
      $("f2Av" + x.i).textContent = rev ? eur(x.v) : fx(x.v, 0); $("f2As" + x.i).textContent = fx(x.share * 100, 1) + " %"; $("f2Ac" + x.i).textContent = fx(x.before * 100, 1) + " %";
      $("f2Ar" + x.i).textContent = x.rank; $("f2Ak" + x.i).innerHTML = `<span class="f2-cls f2-c${x.cls}">${x.cls}</span>`;
    });
    // Pareto chart: bars (value) + cumulative line (right axis 0–100 %)
    const n = r.sorted.length, W = 680, H = 330, x0 = 64, x1 = W - 48, y0 = H - 92, y1 = 14, bw = (x1 - x0) / Math.max(1, n);
    const vmax = Math.max(1, ...r.sorted.map((x) => x.v)), Y = (v) => y0 - v / vmax * (y0 - y1), Yp = (p) => y0 - p * (y0 - y1);
    let s = "";
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => { s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${Yp(p)}" y2="${Yp(p)}"/><text class="fe-tick" x="${x1 + 6}" y="${Yp(p) + 4}">${p * 100} %</text><text class="fe-tick" x="${x0 - 6}" y="${Yp(p) + 4}" text-anchor="end">${rev ? fx(vmax * p / 1000, 0) + "k€" : fx(vmax * p, 0)}</text>`; });
    [[0.8, "80 %"], [0.95, "95 %"]].forEach(([p, l]) => { s += `<line class="f2-lim" x1="${x0}" x2="${x1}" y1="${Yp(p)}" y2="${Yp(p)}"/><text class="fe-tick" x="${x1 - 4}" y="${Yp(p) - 4}" text-anchor="end">${l}</text>`; });
    r.sorted.forEach((x, k) => {
      const xx = x0 + k * bw;
      s += `<rect class="f2-bar f2-b${x.cls}" x="${xx + bw * 0.12}" y="${Y(x.v)}" width="${bw * 0.76}" height="${y0 - Y(x.v)}"><title>${esc(x.n)}: ${rev ? eur(x.v) : fx(x.v, 0)} (${fx(x.share * 100, 1)} %), class ${x.cls}</title></rect>
        <text class="fe-tick f2-rot" transform="translate(${xx + bw / 2 + 3} ${y0 + 8}) rotate(60)">${esc(x.n.length > 16 ? x.n.slice(0, 15) + "…" : x.n)}</text>`;
    });
    s += `<polyline class="f2-ln f2-s2" points="${x0},${y0} ${r.sorted.map((x, k) => `${(x0 + (k + 1) * bw).toFixed(1)},${Yp(x.cum).toFixed(1)}`).join(" ")}"/>`;
    r.sorted.forEach((x, k) => { s += `<circle class="f2-dot f2-s2" cx="${(x0 + (k + 1) * bw).toFixed(1)}" cy="${Yp(x.cum).toFixed(1)}" r="2.8"/>`; });
    s += `<text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">${rev ? "revenue per year" : "volume per year"}</text>`;
    $("f2Pareto").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f2Pareto").innerHTML = s;
    $("f2ParetoLg").innerHTML = `<span class="fx-lg"><i class="f2-lg f2-bA"></i>A</span><span class="fx-lg"><i class="f2-lg f2-bB"></i>B</span><span class="fx-lg"><i class="f2-lg f2-bC"></i>C</span><span class="fx-lg"><i class="f2-lg f2-s2"></i>cumulative share (right axis)</span>`;
    const cls = { A: [], B: [], C: [] }; r.sorted.forEach((x) => cls[x.cls].push(x));
    const sh = (c) => cls[c].reduce((a, x) => a + x.share, 0);
    $("f2AbcRes").innerHTML = `<div class="fe-scroll"><table class="am-tab"><thead><tr><th>Class</th><th>Parts</th><th>% of parts</th><th>% of ${rev ? "revenue" : "volume"}</th></tr></thead><tbody>
      ${["A", "B", "C"].map((c) => `<tr><td><span class="f2-cls f2-c${c}">${c}</span></td><td>${cls[c].length}</td><td>${fx(cls[c].length / Math.max(1, n) * 100, 0)} %</td><td>${fx(sh(c) * 100, 1)} %</td></tr>`).join("")}</tbody></table></div>
      <p class="sub">Total ${rev ? eur(r.tot) : fx(r.tot, 0) + " parts"} per year. A: ${cls.A.map((x) => esc(x.n)).join(", ") || "–"}.</p>`;
    const kA = cls.A[cls.A.length - 1], kB = cls.B[0];
    const t3 = r.sorted.slice(0, 3);
    $("f2AbcWx").innerHTML = wx(`ABC by ${st.basis} for the first parts and the class border`, [
      `Total = Σ value = <b>${rev ? eur(r.tot) : fx(r.tot, 0)}</b>. Sort descending (equal values keep the list order).`,
      ...t3.map((x) => `Rank ${x.rank} ${esc(x.n)}: share = ${rev ? eur(x.v) : fx(x.v, 0)} / ${rev ? eur(r.tot) : fx(r.tot, 0)} = ${fx(x.share * 100, 1)} %; cumulative before = ${fx(x.before * 100, 1)} % &lt; 80 % → <b>${x.cls}</b>; after = ${fx(x.cum * 100, 1)} %`),
      kA ? `Last A part: ${esc(kA.n)} – before it the cumulative share is ${fx(kA.before * 100, 1)} % (&lt; 80 %), so it is still A although the curve passes 80 % with it (${fx(kA.cum * 100, 1)} %).` : "No A part.",
      kB ? `First B part: ${esc(kB.n)} – cumulative before = ${fx(kB.before * 100, 1)} % ≥ 80 % → B. C starts where the cumulative share before the part reaches 95 %.` : "No B part."]);
    R.abc = { basis: st.basis, total: r.tot, classes: Object.fromEntries(r.sorted.map((x) => [x.n, x.cls])), count: { A: cls.A.length, B: cls.B.length, C: cls.C.length }, share_pct: { A: rnd(sh("A") * 100, 2), B: rnd(sh("B") * 100, 2), C: rnd(sh("C") * 100, 2) } };
  };
  build(); draw();
  $("f2AbcTab").addEventListener("input", (e) => { const t = e.target; if (t.dataset.k == null) return; const i = +t.dataset.i, k = +t.dataset.k; st.parts[i][k] = k ? Math.max(0, num(t.value)) : t.value; draw(); });
  $("f2AbcTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; if (st.parts.length <= 1) return; st.parts.splice(+b.dataset.del, 1); build(); draw(); });
  $("f2AbcBasis").addEventListener("change", () => { st.basis = $("f2AbcBasis").value; draw(); });
  $("f2AbcAdd").addEventListener("click", () => { st.parts.push([`P${String(st.parts.length + 1).padStart(2, "0")} New part`, 1000, 10]); build(); draw(); });
  $("f2AbcRst").addEventListener("click", () => { st = def(); build(); draw(); });
  $("f2AbcCsv").addEventListener("click", () => { const r = abcCalc(st.parts, st.basis); download("abc_analysis.csv", toCSV([["Rank", "Part", "Volume", "Price_EUR", "Value", "Share_pct", "Cum_before_pct", "Class"], ...r.sorted.map((x) => [x.rank, x.n, x.q, x.pr, x.v, (x.share * 100).toFixed(2), (x.before * 100).toFixed(2), x.cls])]), "text/csv"); });
  // BOM tree + gross requirements
  const tree = (nd, lvl) => `<li><span class="f2-bn f2-${nd[2]}">${esc(nd[0])}</span> <span class="sub">× ${nd[1]} · ${nd[2]} · level ${lvl}</span>${nd[3].length ? `<ul>${nd[3].map((c) => tree(c, lvl + 1)).join("")}</ul>` : ""}</li>`;
  $("f2Bom").innerHTML = `<ul class="f2-tree">${tree(BOM, 0)}</ul>`;
  const bomDraw = () => {
    const Q = Math.max(0, num($("f2BomQ").value)), out = [];
    const walk = (nd, mult, path) => { const m = mult * nd[1]; if (!nd[3].length) out.push([nd[0], nd[2], m, path.concat(nd[1]).join(" × ")]); nd[3].forEach((c) => walk(c, m, path.concat(nd[1]))); };
    walk(BOM, Q, []);
    $("f2BomReq").innerHTML = `<div class="fe-scroll"><table class="am-tab"><thead><tr><th>Part (leaf)</th><th>Make / buy</th><th>Qty path</th><th>Gross requirement / year</th></tr></thead><tbody>
      ${out.map(([n, mb, q, p]) => `<tr><td>${esc(n)}</td><td>${mb}</td><td class="sub">${fx(Q, 0)} × ${p.split(" × ").slice(1).join(" × ")}</td><td><b>${fx(q, 0)}</b></td></tr>`).join("")}</tbody></table></div>
      <p class="sub">Make parts: ${out.filter((x) => x[1] === "make").length} (machining load) · buy parts: ${out.filter((x) => x[1] === "buy").length} (purchasing).</p>`;
    R.bom = { Q, req: Object.fromEntries(out.map((x) => [x[0], x[2]])) };
  };
  $("f2BomQ").addEventListener("input", bomDraw); bomDraw();
}

/* ================================================================== 2G group technology – simplified Opitz code */
const GT_FAMILY = [["Compressor crankshaft blank", "25033"], ["Shaft S2 (stepped, keyway)", "24030"], ["Pin Ø12 × 40", "20000"], ["Cylinder liner", "11102"], ["Flywheel", "01162"], ["Bearing bush", "01100"], ["Valve-plate disc", "00022"]];
function html2G() {
  return card("f22G", "2G · Group technology – a 5-digit form code (simplified Opitz) for rotational parts", "choose the digits · L/D sets digit 1 · decode · compare two codes",
    guide({
      principle: `<p>Group technology (GT) groups parts by <b>similar shape</b> (design families) or <b>similar process</b> (production families, see 2A).
        A classification code describes the shape with digits, so a computer can find similar parts. The Opitz code (H. Opitz, Aachen 1970) uses 5 form digits
        (+ 4 supplementary digits for size, material, raw form, accuracy). For rotational parts: digit 1 = part class (from L/D), 2 = external shape,
        3 = internal shape, 4 = plane surface machining, 5 = auxiliary holes and gear teeth.</p>
        <p class="phd-eq">digit 1 (rotational): L/D ≤ 0.5 → 0 · 0.5 &lt; L/D &lt; 3 → 1 · L/D ≥ 3 → 2 · similarity(code a, code b) = number of equal digits / 5</p>
        <p class="fx-alert"><b>Simplified</b> – the digit texts here are shortened from the Opitz tables and only show the method. For real classification use the original Opitz tables
        (or your company's own code, e.g. a DIN 4000 feature list).</p>`,
      uses: USES.G,
      howto: ["Code a sample of 200–500 parts (start with the A and B parts from 2F); one person codes, a second person checks 10 %.",
        "Sort by code: families appear as groups with the same first 2–3 digits; compare them with the routing families from 2A.",
        "For each family define a standard routing, fixture concept and tool set – this is the basis of a GT cell.",
        "Add the code as a field in the ERP / PLM so new parts are coded when they are created."],
    }) + `
    <div class="fe-row"><label>Length L <input type="number" id="f2GL" min="0.1" step="any"> mm</label><label>Diameter D <input type="number" id="f2GD" min="0.1" step="any"> mm</label>
      <span id="f2GLD"></span><button class="mx-el" id="f2GEx">Example crankshaft (25033)</button></div>
    <div class="f2-gtsel" id="f2GSel"></div>
    <div class="grid2 eq"><div id="f2GCode"></div><div id="f2GFam"></div></div>
    <div class="fe-row"><label>Compare with code <input id="f2GCmp" maxlength="5" size="7" class="f2-code-in"></label><span id="f2GSim"></span></div>
    <div id="f2GWx"></div>`);
}
function init2G() {
  const EXO = EX2.opitz_example;
  const def = () => ({ d: EXO.digits.map((x) => x[2]), L: 320, D: 60, cmp: "24030" });
  let st = store.get("gt", def());
  $("f2GSel").innerHTML = OPITZ.map(([n, opts], k) => `<label class="f2-gd"><span>${esc(n)}</span><select data-g="${k}">${opts.map((o, v) => `<option value="${v}">${esc(o)}</option>`).join("")}</select></label>`).join("");
  const sim = (a, b) => { let e = 0; for (let i = 0; i < 5; i++) if (a[i] === b[i]) e++; return e; };
  const draw = () => {
    store.set("gt", st);
    document.querySelectorAll("#f2GSel select").forEach((s) => { s.value = st.d[+s.dataset.g]; });
    const ld = st.L / st.D, code = st.d.join("");
    $("f2GLD").innerHTML = `L/D = ${fx(st.L, 0)} / ${fx(st.D, 0)} = <b>${fx(ld, 2)}</b> → digit 1 = ${ld <= 0.5 ? 0 : ld < 3 ? 1 : 2} (if rotational without deviation)`;
    $("f2GCode").innerHTML = `<p class="fe-big">Form code <b class="f2-code">${code.split("").map((c, i) => `<span class="f2-dg f2-dg${i}">${c}</span>`).join("")}</b></p>
      <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Digit</th><th>Value</th><th>Meaning</th></tr></thead><tbody>${OPITZ.map(([n, o], k) => `<tr><td>${esc(n)}</td><td><b>${st.d[k]}</b></td><td>${esc(o[st.d[k]].replace(/^\d\s/, ""))}</td></tr>`).join("")}</tbody></table></div>
      <p><b>Shop-floor meaning:</b> ${esc(OPITZ_CELL[st.d[0]])}${st.d[2] > 0 ? "; has a bore → internal turning / boring" : ""}${st.d[3] > 0 ? "; milled surfaces → driven tools or a milling operation" : ""}${st.d[4] > 0 ? (st.d[4] >= 6 ? "; gear teeth → hobbing / shaping machine" : "; auxiliary holes → drilling (driven tools or machining centre)") : ""}.</p>`;
    const fam = GT_FAMILY.map(([n, c]) => ({ n, c, s: sim(code, c) })).sort((a, b) => b.s - a.s);
    $("f2GFam").innerHTML = `<h3 class="fe-h3">Similar parts in the example part list <span class="sub">(design retrieval)</span></h3><div class="fe-scroll"><table class="am-tab"><thead><tr><th>Part</th><th>Code</th><th>Equal digits</th><th>Similarity</th></tr></thead><tbody>
      ${fam.map((x) => `<tr${x.s >= 4 ? ' class="fx-best"' : ""}><td>${esc(x.n)}</td><td><code>${x.c}</code></td><td>${x.s} / 5</td><td>${x.s * 20} %</td></tr>`).join("")}</tbody></table></div>
      <p class="sub">Rule of thumb: ≥ 4 equal digits (≥ 80 %) → same family, try the same routing and fixture; first 3 digits equal → same turning concept.</p>`;
    const c2 = String(st.cmp).replace(/\D/g, "").slice(0, 5);
    if (c2.length === 5) { const e = sim(code, c2); $("f2GSim").innerHTML = `${code} vs ${c2}: equal digits ${e} / 5 → similarity <b>${e * 20} %</b> (different: ${[0, 1, 2, 3, 4].filter((i) => code[i] !== c2[i]).map((i) => "digit " + (i + 1)).join(", ") || "none"})`; R.gt_sim = { a: code, b: c2, equal: e, sim: e / 5 }; }
    else $("f2GSim").innerHTML = '<span class="sub">enter 5 digits</span>';
    $("f2GWx").innerHTML = wx(`${esc(EXO.part)}`, EXO.digits.map(([n, t, v]) => `Digit ${esc(n)}: ${esc(t)} → <b>${v}</b>`).concat([`Code = <b>${esc(EXO.code)}</b>. Your current code: <b>${code}</b> ${code === EXO.code ? '<span class="fe-ok">✓ same</span>' : ""}.`]));
    R.opitz = { code, L_D: rnd(ld, 3), example: EXO.code, matches_example: code === EXO.code };
  };
  $("f2GSel").addEventListener("change", (e) => { const k = e.target.dataset.g; if (k == null) return; st.d[+k] = +e.target.value; draw(); });
  const setLD = () => { st.L = Math.max(0.1, num($("f2GL").value, st.L)); st.D = Math.max(0.1, num($("f2GD").value, st.D)); const ld = st.L / st.D; if (st.d[0] <= 2) st.d[0] = ld <= 0.5 ? 0 : ld < 3 ? 1 : 2; sync(); draw(); };
  $("f2GL").addEventListener("change", setLD); $("f2GD").addEventListener("change", setLD);
  $("f2GCmp").addEventListener("input", () => { st.cmp = $("f2GCmp").value; draw(); });
  const sync = () => { $("f2GL").value = st.L; $("f2GD").value = st.D; $("f2GCmp").value = st.cmp; };
  $("f2GEx").addEventListener("click", () => { st = def(); sync(); draw(); });
  sync(); draw();
}

/* ================================================================== 2H process chain, allowances, routing sheet */
function html2H() {
  const pc = EX2.process_chain;
  return card("f22H", "2H · Process chain and machining allowances – from the raw part to the final tolerance + routing sheet", "edit steps, IT grades and z_min · tolerances from the ISO 286 table · diameters before / after each step",
    guide({
      principle: `<p>One process seldom goes from the raw part to IT7 / Ra 0.8. A <b>process chain</b> (rough → semi-finish → finish) improves the tolerance step by step;
        each step usually gains 2–3 IT grades. Every step needs an <b>allowance</b> z (stock per side): a minimum z_min (to remove the damaged layer and the
        roughness of the step before) plus half of the tolerance of the step before (the part can be at the worst end of that tolerance).</p>
        <p class="phd-eq">T_i = IT value of the grade of step i for the nominal size (ISO 286 table) · z_i = z_min,i + T_(i−1)/2 (T_0 = raw-part tolerance)<br>
        bore: D_before,i = D_after,i − 2·z_i · shaft: D_before,i = D_after,i + 2·z_i · start: D_after,last = mid-tolerance final diameter</p>
        <p>Worked feature: <b>${esc(pc.feature)}</b>. Final diameter at mid tolerance = ${pc.final_D} mm, cast raw-part tolerance ${pc.raw_tol_mm} mm.</p>`,
      uses: USES.H,
      howto: ["Start from the drawing: for each critical feature write tolerance, Ra and the material.",
        "Choose the last process from 2B (IT + Ra), then add steps backwards until the raw-part tolerance is reached (casting / forging / bar: IT14–IT16 or ± 1 mm).",
        "Use z_min from the tool supplier's catalogue or your experience (roughing 0.3–1 mm, semi-finish 0.1–0.2 mm, finishing 0.03–0.1 mm per side).",
        "The diameters before each step are the tool diameters for the boring bars / reamers and the raw-part dimensions for the casting drawing.",
        "Write the steps into the routing sheet (below) – one line per operation with machine, fixture, tools and time."],
    }) + `
    <div class="fe-row"><label>Feature <select id="f2HType"><option value="bore">bore (diameter grows)</option><option value="shaft">shaft (diameter shrinks)</option></select></label>
      <label>Final D (mid tolerance) <input type="number" id="f2HD" step="0.001"> mm</label><label>Raw-part tolerance <input type="number" id="f2HRaw" step="0.1" min="0"> mm</label>
      <label>Required tolerance <input type="number" id="f2HReq" step="1" min="1"> µm</label><label>Required Ra ≤ <input type="number" id="f2HRa" step="0.1" min="0.01"> µm</label>
      <button class="mx-el" id="f2HAdd">+ Add step</button><button class="mx-el" id="f2HRst">Reset to example</button></div>
    <div class="fe-scroll"><table class="am-tab fe-calc f2-pc" id="f2HTab"></table></div>
    <div class="grid2 eq"><div><svg id="f2HChart" class="fe-chart" role="img" aria-label="Diameter after each step with tolerance band"></svg></div><div id="f2HRes"></div></div>
    <div id="f2HWx"></div>
    <h3 class="fe-h3">Routing sheet builder <span class="sub">(operation sheet / work plan) – example: crankcase VC20</span></h3>
    <div class="fe-row"><label>Annual volume <input type="number" id="f2RQ" min="0" step="100"></label><label>Lot size <input type="number" id="f2RLot" min="1" step="1"></label>
      <button class="mx-el" id="f2RAdd">+ Add operation</button><button class="mx-el" id="f2RRst">Reset to example</button><button class="mx-el" id="f2RCsv">Export CSV</button></div>
    <div class="fe-scroll"><table class="am-tab fe-calc f2-rt" id="f2RTab"></table></div>
    <div id="f2RRes"></div>`);
}
function pcCalc(st) {
  const D = num(st.D, 52), n = st.steps.length, sign = st.type === "shaft" ? 1 : -1;
  const rows = st.steps.map((s) => ({ name: s[0], g: Math.round(num(s[1])), zmin: Math.max(0, num(s[2])), ra: num(s[3]) }));
  rows.forEach((r, i) => { r.T = itUm(r.g, D) / 1000; r.Tprev = i ? rows[i - 1].T : Math.max(0, num(st.raw)); r.z = r.zmin + r.Tprev / 2; });
  let after = D;
  for (let i = n - 1; i >= 0; i--) { rows[i].after = after; rows[i].before = after + sign * 2 * rows[i].z; after = rows[i].before; }
  const bad = rows.filter((r) => !Number.isFinite(r.T));
  return { D, rows, raw: n ? rows[0].before : D, bad, range: IT.ranges_mm[itRange(D)] };
}
function init2H() {
  const pc = EX2.process_chain;
  const def = () => ({ type: "bore", D: pc.final_D, raw: pc.raw_tol_mm, req: 30, ra: 0.8, steps: clone(pc.steps) });
  let st = store.get("pc", def());
  const sync = () => { $("f2HType").value = st.type; $("f2HD").value = st.D; $("f2HRaw").value = st.raw; $("f2HReq").value = st.req; $("f2HRa").value = st.ra; };
  const build = () => {
    $("f2HTab").innerHTML = `<thead><tr><th>#</th><th>Step</th><th>IT grade</th><th>T (ISO) mm</th><th>z_min mm</th><th>T_prev / 2</th><th>z = z_min + T_prev/2</th><th>D before</th><th>D after</th><th>Ra µm</th><th></th></tr></thead>
      <tbody>${st.steps.map((s, i) => `<tr><td>${i + 1}</td><td><input class="f2-wn" data-i="${i}" data-k="0" value="${esc(s[0])}"></td>
        <td><select data-i="${i}" data-k="1">${IT.grades.map((g) => `<option value="${g}"${g === +s[1] ? " selected" : ""}>IT${g}</option>`).join("")}</select></td>
        <td id="f2HT${i}"></td><td><input type="number" step="0.01" min="0" data-i="${i}" data-k="2" value="${s[2]}"></td><td id="f2HP${i}"></td><td id="f2HZ${i}"></td><td id="f2HB${i}"></td><td id="f2HA${i}"></td>
        <td><input type="number" step="0.1" min="0.01" data-i="${i}" data-k="3" value="${s[3]}"></td><td><button class="mx-el fx-x" data-del="${i}" title="remove">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const draw = () => {
    store.set("pc", st);
    const r = pcCalc(st), n = r.rows.length;
    r.rows.forEach((x, i) => { $("f2HT" + i).textContent = fx(x.T, 3); $("f2HP" + i).textContent = fx(x.Tprev / 2, 3); $("f2HZ" + i).innerHTML = `<b>${fx(x.z, 3)}</b>`; $("f2HB" + i).textContent = fx(x.before, 3); $("f2HA" + i).textContent = fx(x.after, 3); });
    if (!n) { $("f2HRes").innerHTML = '<p class="fe-no">Add at least one step.</p>'; return; }
    const last = r.rows[n - 1], tolOk = last.T * 1000 <= num(st.req) + 1e-9, raOk = last.ra <= num(st.ra) + 1e-9;
    const warn = [];
    r.rows.forEach((x, i) => {
      if (i && x.g >= r.rows[i - 1].g) warn.push(`Step ${i + 1} (${esc(x.name)}) does not improve the grade (IT${r.rows[i - 1].g} → IT${x.g}).`);
      if (i && r.rows[i - 1].g - x.g > 4) warn.push(`Step ${i + 1} jumps ${r.rows[i - 1].g - x.g} grades – one step usually gains 2–3; add an intermediate step or check the process.`);
      if (i && x.ra > r.rows[i - 1].ra) warn.push(`Step ${i + 1}: Ra becomes worse (${r.rows[i - 1].ra} → ${x.ra} µm).`);
      if (x.z > 3) warn.push(`Step ${i + 1}: allowance ${fx(x.z, 2)} mm per side is large – more passes or a better raw part (smaller casting tolerance).`);
    });
    const tot = r.rows.reduce((a, x) => a + x.z, 0);
    $("f2HRes").innerHTML = `<p class="fe-big">Raw part D = <b>${fx(r.raw, 3)} mm</b> · total stock <b>${fx(tot, 3)} mm</b> per side</p>
      <ul class="fe-faces"><li>${ok(tolOk, `last step IT${last.g} = ${fx(last.T * 1000, 0)} µm ≤ required ${st.req} µm`, `last step IT${last.g} = ${fx(last.T * 1000, 0)} µm > required ${st.req} µm – add a finer last step`)}</li>
      <li>${ok(raOk, `Ra ${last.ra} µm ≤ ${st.ra} µm`, `Ra ${last.ra} µm > ${st.ra} µm – finer finishing (fine boring → honing / grinding)`)}</li>
      ${warn.map((w) => `<li><span class="fe-no">!</span> ${w}</li>`).join("")}</ul>
      <p class="sub">T values from the ISO 286-1 table for ${r.range[0]} &lt; D ≤ ${r.range[1]} mm (D = ${st.D}). Bore: the tool / boring-bar diameter of step i is D after i; the casting drawing gets D before step 1 (here ${fx(r.raw, 2)} mm ± ${fx(st.raw / 2, 2)}).</p>`;
    // chart: diameter after each stage with ± T/2 band
    const pts = [["raw", r.raw, num(st.raw)], ...r.rows.map((x, i) => [`${i + 1} ${x.name.split(" ")[0]}`, x.after, x.T])];
    const W = 640, H = 300, x0 = 70, x1 = W - 20, y0 = H - 40, y1 = 16;
    const lo = Math.min(...pts.map((p) => p[1] - p[2] / 2)), hi = Math.max(...pts.map((p) => p[1] + p[2] / 2)), pad = (hi - lo) * 0.08 || 0.1;
    const Y = (v) => y0 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (y0 - y1), X = (k) => x0 + (k + 0.5) * (x1 - x0) / pts.length;
    let s = "";
    for (let k = 0; k <= 5; k++) { const v = lo - pad + k * (hi - lo + 2 * pad) / 5; s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/><text class="fe-tick" x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end">${fx(v, 2)}</text>`; }
    pts.forEach(([l, d, t], k) => {
      s += `<rect class="f2-tolb" x="${X(k) - 16}" y="${Y(d + t / 2)}" width="32" height="${Math.max(1.5, Y(d - t / 2) - Y(d + t / 2))}"><title>${esc(l)}: ${fx(d, 3)} ± ${fx(t / 2, 3)} mm</title></rect>
        <circle class="f2-dot f2-s1" cx="${X(k)}" cy="${Y(d)}" r="4"/><text class="fe-tick" x="${X(k)}" y="${y0 + 16}" text-anchor="middle">${esc(l)}</text>
        <text class="f2-plab" x="${X(k) + 20}" y="${Y(d) + 4}">${fx(d, 3)}</text>`;
      if (k) s += `<text class="fe-tick" x="${(X(k) + X(k - 1)) / 2}" y="${Math.min(Y(d), Y(pts[k - 1][1])) - 8}" text-anchor="middle">z = ${fx(r.rows[k - 1].z, 3)}</text>`;
    });
    s += `<polyline class="f2-ln f2-s1" points="${pts.map((p, k) => `${X(k)},${Y(p[1])}`).join(" ")}"/>`;
    s += `<text class="fe-axis" transform="translate(13 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">diameter mm (band = tolerance T)</text>`;
    $("f2HChart").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f2HChart").innerHTML = s;
    const L3 = r.rows[n - 1], L2 = n > 1 ? r.rows[n - 2] : null;
    $("f2HWx").innerHTML = wx("allowance of the last step and the chain backwards", [
      `Tolerances from the table (${r.range[0]} &lt; D ≤ ${r.range[1]} mm): ${r.rows.map((x) => `IT${x.g} = ${fx(x.T * 1000, 0)} µm`).join(", ")}.`,
      `Last step ${esc(L3.name)}: z = z_min + T_prev/2 = ${L3.zmin} + ${fx(L3.Tprev, 3)}/2 = <b>${fx(L3.z, 3)} mm</b>; D before = ${fx(L3.after, 3)} ${st.type === "bore" ? "−" : "+"} 2 × ${fx(L3.z, 3)} = <b>${fx(L3.before, 3)} mm</b>.`,
      L2 ? `Step ${esc(L2.name)}: z = ${L2.zmin} + ${fx(L2.Tprev, 3)}/2 = <b>${fx(L2.z, 3)} mm</b>; D before = ${fx(L2.after, 3)} ${st.type === "bore" ? "−" : "+"} 2 × ${fx(L2.z, 3)} = <b>${fx(L2.before, 3)} mm</b>.` : "",
      `First step uses the raw-part tolerance: z_1 = ${r.rows[0].zmin} + ${fx(r.rows[0].Tprev, 3)}/2 = <b>${fx(r.rows[0].z, 3)} mm</b> → raw diameter <b>${fx(r.raw, 3)} mm</b>.`,
      `Check: IT${L3.g} = ${fx(L3.T * 1000, 0)} µm ≤ ${st.req} µm and Ra ${L3.ra} ≤ ${st.ra} µm → ${tolOk && raOk ? "the chain reaches the drawing" : "the chain does NOT reach the drawing"}.`].filter(Boolean));
    R.chain = { D: r.D, steps: r.rows.map((x) => ({ name: x.name, IT: x.g, T_mm: rnd(x.T, 3), z_mm: rnd(x.z, 4), D_before: rnd(x.before, 4), D_after: rnd(x.after, 4), Ra: x.ra })), raw_D: rnd(r.raw, 4), total_stock: rnd(tot, 4), tol_ok: tolOk, ra_ok: raOk };
  };
  sync(); build(); draw();
  $("f2HTab").addEventListener("input", (e) => { const t = e.target; if (t.dataset.k == null) return; const i = +t.dataset.i, k = +t.dataset.k; st.steps[i][k] = k ? num(t.value) : t.value; draw(); });
  $("f2HTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; st.steps.splice(+b.dataset.del, 1); build(); draw(); });
  [["f2HType", "type"], ["f2HD", "D"], ["f2HRaw", "raw"], ["f2HReq", "req"], ["f2HRa", "ra"]].forEach(([id, k]) => $(id).addEventListener("input", () => { st[k] = k === "type" ? $(id).value : num($(id).value, st[k]); draw(); }));
  $("f2HAdd").addEventListener("click", () => { const l = st.steps[st.steps.length - 1]; st.steps.push(["New step", l ? Math.max(5, l[1] - 2) : 9, 0.03, l ? Math.max(0.1, l[3] / 2) : 1.6]); build(); draw(); });
  $("f2HRst").addEventListener("click", () => { st = def(); sync(); build(); draw(); });

  // routing sheet
  const rdef = () => ({ Q: 3000, lot: 30, ops: clone(ROUTING) });
  let rt = store.get("routing", rdef());
  const cols = [["Op", 0, "f2-op"], ["Operation", 1, "f2-wn"], ["Machine", 2, "f2-mc"], ["Set-up / fixture", 3, "f2-wn"], ["Tools", 4, "f2-wn"], ["Set-up min/lot", 5, ""], ["Time min/part", 6, ""]];
  const rbuild = () => {
    $("f2RQ").value = rt.Q; $("f2RLot").value = rt.lot;
    $("f2RTab").innerHTML = `<thead><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}<th></th></tr></thead><tbody>${rt.ops.map((o, i) => `<tr>${cols.map(([, k, c]) => `<td><input ${k >= 5 ? 'type="number" step="any" min="0"' : ""} class="${c}" data-i="${i}" data-k="${k}" value="${esc(o[k])}"></td>`).join("")}<td><button class="mx-el fx-x" data-del="${i}" title="remove">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const rdraw = () => {
    store.set("routing", rt);
    const by = {}; const lots = Math.ceil(rt.Q / Math.max(1, rt.lot));
    rt.ops.forEach((o) => { const m = String(o[2] || "?").trim() || "?"; by[m] = by[m] || { t: 0, su: 0, ops: [] }; by[m].t += num(o[5 + 1]); by[m].su += num(o[5]); by[m].ops.push(o[0]); });
    const rows = Object.entries(by).map(([m, v]) => ({ m, ...v, h: rt.Q * v.t / 60 + lots * v.su / 60 }));
    $("f2RRes").innerHTML = `<div class="fe-scroll"><table class="am-tab"><thead><tr><th>Machine</th><th>Operations</th><th>Time min/part</th><th>Set-up min/lot</th><th>Hours / year = Q·t/60 + ⌈Q/lot⌉·t_su/60</th></tr></thead><tbody>
      ${rows.map((x) => `<tr><td><b>${esc(x.m)}</b></td><td>${x.ops.map(esc).join(", ")}</td><td>${fx(x.t, 2)}</td><td>${fx(x.su, 0)}</td><td>${fx(rt.Q, 0)}·${fx(x.t, 2)}/60 + ${lots}·${fx(x.su, 0)}/60 = <b>${fx(x.h, 1)} h</b></td></tr>`).join("")}</tbody></table></div>
      <p class="sub">The HMC line (9 + 15 + 12 = 36 min, set-up 20 min per lot) is the same input as "Crankcase VC20" in the capacity table 2J. Export the CSV and give it to the suppliers with the RFQ.</p>`;
    R.routing = Object.fromEntries(rows.map((x) => [x.m, { t_min: rnd(x.t, 3), setup_min: x.su, hours: rnd(x.h, 2) }]));
  };
  rbuild(); rdraw();
  $("f2RTab").addEventListener("input", (e) => { const t = e.target; if (t.dataset.k == null) return; const i = +t.dataset.i, k = +t.dataset.k; rt.ops[i][k] = k >= 5 ? Math.max(0, num(t.value)) : t.value; rdraw(); });
  $("f2RTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; rt.ops.splice(+b.dataset.del, 1); rbuild(); rdraw(); });
  $("f2RQ").addEventListener("input", () => { rt.Q = Math.max(0, num($("f2RQ").value)); rdraw(); });
  $("f2RLot").addEventListener("input", () => { rt.lot = Math.max(1, num($("f2RLot").value, 1)); rdraw(); });
  $("f2RAdd").addEventListener("click", () => { const l = rt.ops[rt.ops.length - 1]; rt.ops.push([String((l ? num(l[0]) : 0) + 10), "New operation", "", "", "", 0, 1]); rbuild(); rdraw(); });
  $("f2RRst").addEventListener("click", () => { rt = rdef(); rbuild(); rdraw(); });
  $("f2RCsv").addEventListener("click", () => download("routing_sheet.csv", toCSV([["Op", "Operation", "Machine", "Setup_fixture", "Tools", "Setup_min_per_lot", "Time_min_per_part"], ...rt.ops]), "text/csv"));
}

/* ================================================================== 2I time + tool life */
let taylorRedraw = null;   // the Taylor chart uses the turning cut time → redraw when the cut changes
const CUTF = {   // inputs per cut (key, label, unit)
  turning: [["D", "D", "mm"], ["L", "L", "mm"], ["ap", "aₚ", "mm"], ["f", "f", "mm/rev"], ["vc", "v꜀", "m/min"], ["passes", "passes", ""]],
  milling: [["Dc", "D꜀", "mm"], ["z", "z", "teeth"], ["fz", "f_z", "mm"], ["vc", "v꜀", "m/min"], ["ap", "aₚ", "mm"], ["ae", "aₑ", "mm"], ["L", "L", "mm"], ["passes", "passes", ""]],
  drilling: [["D", "D", "mm"], ["H", "H", "mm"], ["f", "f", "mm/rev"], ["vc", "v꜀", "m/min"], ["holes", "holes", ""]],
};
function cutCalc(k, c, kc) {
  const pi = Math.PI;
  if (k === "turning") { const n = 1000 * c.vc / (pi * c.D), vf = c.f * n, t = c.passes * c.L / vf, Pc = kc * c.ap * c.f * c.vc / 60000; return { n, vf, t, Pc, M: 9550 * Pc / n }; }
  if (k === "milling") { const n = 1000 * c.vc / (pi * c.Dc), vf = c.fz * c.z * n, t = c.passes * (c.L + c.Dc) / vf, Q = c.ap * c.ae * vf / 1000, Pc = c.ap * c.ae * vf * kc / 60e6; return { n, vf, t, Q, Pc, M: 9550 * Pc / n }; }
  const n = 1000 * c.vc / (pi * c.D), th = (c.H + 0.3 * c.D) / (c.f * n), Pc = c.f * c.vc * c.D * kc / 240000; return { n, th, t: th * c.holes, Pc, M: 9550 * Pc / n };
}
function html2I() {
  return card("f22I", "2I · Time and tool life – spindle power / torque, Taylor economics, tapping, moulding, bending, welding", "every formula with your numbers · first estimates before supplier quotes",
    guide({
      principle: `<p>A spindle drive gives <b>constant torque</b> up to the base speed n_b and <b>constant power</b> above it. A cut is possible when the power it needs
        (incl. drive efficiency η) is below the available power at its speed. Big tools at low speed hit the torque limit, small tools at high speed hit the power limit.</p>
        <p class="phd-eq">P_av(n) = min(P_rated, M_max·n/9550) · n_b = 9550·P_rated/M_max · check P꜀/η ≤ P_av(n), η = ${EX2.cutting.spindle.eta}</p>
        <p><b>Tool life</b> falls quickly with cutting speed (Taylor): v·Tⁿ = C. Faster cutting = shorter machining time but more tool changes and tool cost.
        The minimum-cost tool life balances machine cost and tool cost; the maximum-production tool life only looks at time.</p>
        <p class="phd-eq">T = (C/v)^(1/n) · T_min-cost = (1/n − 1)·(t_ct + K_t/(M/60)) · T_max-prod = (1/n − 1)·t_ct · v = C/Tⁿ</p>`,
      uses: USES.I,
      howto: ["Ask every machine supplier for the S1 and S6 power / torque curve and check your 3 heaviest cuts with the chart below.",
        "Take n and C for your tool / material pair from the tool supplier (or measure: two tool lives at two speeds → n = log(v1/v2)/log(T2/T1)).",
        "Set the CAM default cutting speed between v_min-cost and v_max-prod; use v_max-prod only on the bottleneck machine.",
        "For plastics, ask the mould maker for the cooling simulation; the formula here is the check for his number (± 20 %)."],
    }) + `
    <h3 class="fe-h3">Spindle power and torque check</h3>
    <div class="fe-row"><label>P_rated <input type="number" id="f2SP" step="any" min="0.1"> kW</label><label>M_max <input type="number" id="f2SM" step="any" min="1"> Nm</label>
      <label>n_max <input type="number" id="f2SN" step="100" min="100"> rpm</label><label>η <input type="number" id="f2SE" step="0.05" min="0.1" max="1"></label><button class="mx-el" id="f2SRst">Reset to example</button><span id="f2SNb"></span></div>
    <div class="fx-calc3" id="f2Cuts"></div>
    <div class="grid2 eq"><div><svg id="f2SPw" class="fe-chart" role="img" aria-label="Spindle power over speed with cut points"></svg></div><div><svg id="f2STq" class="fe-chart" role="img" aria-label="Spindle torque over speed with cut points"></svg></div></div>
    <div class="sub" id="f2SLg"></div>
    <div id="f2SRes"></div>
    <h3 class="fe-h3">Taylor tool life and economic cutting speed</h3>
    <div class="fe-row"><label>n <input type="number" id="f2Tn" step="0.01" min="0.05" max="0.95"></label><label>C <input type="number" id="f2TC" step="any" min="1"> m/min</label>
      <label>M (machine + labour) <input type="number" id="f2TM" step="any" min="0"> €/h</label><label>K_t <input type="number" id="f2TK" step="any" min="0"> €/edge</label><label>t_ct <input type="number" id="f2Tct" step="any" min="0"> min</label>
      <label>your v꜀ <input type="number" id="f2Tv" step="any" min="1"> m/min</label><label>handling t_h <input type="number" id="f2Th" step="any" min="0"> min/part</label></div>
    <div class="grid2 eq"><div><svg id="f2TChart" class="fe-chart" role="img" aria-label="Cost per part over cutting speed"></svg><div class="sub" id="f2TLg"></div></div><div id="f2TRes"></div></div>
    <div id="f2TWx"></div>
    <div class="fx-calc3">
      <div class="fx-box"><h4>Tapping</h4><div class="fe-row fe-calc" id="f2TapIn"></div><div id="f2TapRes"></div></div>
      <div class="fx-box"><h4>Press brake – bending time</h4><div class="fe-row fe-calc" id="f2BeIn"></div><div id="f2BeRes"></div></div>
      <div class="fx-box"><h4>Robot welding – arc time</h4><div class="fe-row fe-calc" id="f2WeIn"></div><div id="f2WeRes"></div></div>
    </div>
    <h3 class="fe-h3">Injection moulding – cooling time, cycle, clamp force</h3>
    <div class="fe-row fe-calc" id="f2MoIn"></div>
    <div class="grid2 eq"><div id="f2MoRes"></div><div><svg id="f2MoChart" class="fe-chart" role="img" aria-label="Cooling time over wall thickness"></svg></div></div>`);
}
function init2I() {
  const C = EX2.cutting, mats = C.materials;
  const def = () => ({ sp: clone(C.spindle), cuts: { turning: clone(C.turning), milling: clone(C.milling), drilling: clone(C.drilling) } });
  let st = store.get("spindle", def());
  const sync = () => { $("f2SP").value = st.sp.P_rated_kW; $("f2SM").value = st.sp.M_max_Nm; $("f2SN").value = st.sp.n_max; $("f2SE").value = st.sp.eta; };
  const build = () => {
    $("f2Cuts").innerHTML = Object.entries(CUTF).map(([k, fl]) => `<div class="fx-box"><h4>${k[0].toUpperCase() + k.slice(1)}</h4>
      <div class="fe-row fe-calc"><label>material <select data-c="${k}" data-f="mat">${mats.map((m, i) => `<option value="${i}"${i === +st.cuts[k].mat ? " selected" : ""}>${esc(m[0])} (k꜀ ${m[1]})</option>`).join("")}</select></label>
      ${fl.map(([f, l, u]) => `<label>${l} <input type="number" step="any" min="0" data-c="${k}" data-f="${f}" value="${st.cuts[k][f]}"> ${u}</label>`).join("")}</div><div id="f2Cut_${k}"></div></div>`).join("");
  };
  const draw = () => {
    store.set("spindle", st);
    const sp = st.sp, P = num(sp.P_rated_kW, 1), Mx = num(sp.M_max_Nm, 1), nm = num(sp.n_max, 1000), eta = num(sp.eta, 0.8);
    const nb = 9550 * P / Mx, Pav = (n) => Math.min(P, Mx * n / 9550), Mav = (n) => Math.min(Mx, 9550 * P / Math.max(n, 1e-9));
    $("f2SNb").innerHTML = `base speed n_b = 9550 · ${P} / ${Mx} = <b>${fx(nb, 0)} rpm</b>`;
    const res = {};
    Object.keys(CUTF).forEach((k) => {
      const c = st.cuts[k], kc = mats[+c.mat] ? mats[+c.mat][1] : 1500, r = cutCalc(k, c, kc);
      const need = r.Pc / eta, av = Pav(r.n), lim = r.n < nb ? "torque" : "power", okk = need <= av + 1e-9 && r.n <= nm;
      res[k] = { ...r, need, av, lim, ok: okk, util: need / av, kc };
      const f = k === "turning" ? `n = 1000·${c.vc}/(π·${c.D}) = <b>${fx(r.n, 0)} rpm</b> · v_f = ${c.f}·${fx(r.n, 0)} = ${fx(r.vf, 1)} mm/min · t꜀ = ${c.passes}·${c.L}/${fx(r.vf, 1)} = <b>${fx(r.t, 3)} min</b><br>P꜀ = ${kc}·${c.ap}·${c.f}·${c.vc}/60000 = <b>${fx(r.Pc, 2)} kW</b> · M = 9550·P꜀/n = ${fx(r.M, 1)} Nm`
        : k === "milling" ? `n = 1000·${c.vc}/(π·${c.Dc}) = <b>${fx(r.n, 0)} rpm</b> · v_f = ${c.fz}·${c.z}·${fx(r.n, 0)} = ${fx(r.vf, 1)} mm/min · t꜀ = ${c.passes}·(${c.L}+${c.Dc})/${fx(r.vf, 1)} = <b>${fx(r.t, 3)} min</b><br>Q = ${c.ap}·${c.ae}·${fx(r.vf, 1)}/1000 = ${fx(r.Q, 1)} cm³/min · P꜀ = aₚ·aₑ·v_f·k꜀/60·10⁶ = <b>${fx(r.Pc, 2)} kW</b> · M = ${fx(r.M, 1)} Nm`
        : `n = 1000·${c.vc}/(π·${c.D}) = <b>${fx(r.n, 0)} rpm</b> · t_hole = (${c.H} + 0.3·${c.D})/(${c.f}·${fx(r.n, 0)}) = ${fx(r.th * 60, 2)} s · ${c.holes} holes = <b>${fx(r.t * 60, 1)} s</b><br>P꜀ = ${c.f}·${c.vc}·${c.D}·${kc}/240000 = <b>${fx(r.Pc, 2)} kW</b> · M = ${fx(r.M, 1)} Nm`;
      $("f2Cut_" + k).innerHTML = `<p class="phd-eq">${f}</p><p>P꜀/η = ${fx(r.Pc, 2)}/${eta} = <b>${fx(need, 2)} kW</b> · P_av(${fx(r.n, 0)}) = min(${P}, ${Mx}·${fx(r.n, 0)}/9550) = <b>${fx(av, 2)} kW</b><br>
        ${r.n > nm ? `<span class="fe-no">✗ n above n_max ${nm} rpm</span>` : ok(okk, `uses ${fx(need / av * 100, 0)} % – ${lim}-limited range (n ${r.n < nb ? "<" : "≥"} n_b)`, `needs ${fx(need / av * 100, 0)} % of the available power – reduce aₚ / f or use a stronger spindle (${lim} limit)`)}</p>`;
    });
    // charts
    const ns = []; for (let i = 0; i <= 120; i++) ns.push(nm * i / 120); ns.push(nb); ns.sort((a, b) => a - b);
    const keys = Object.keys(res), lab = keys.map((k) => k);
    const pmax = Math.max(P, ...keys.map((k) => res[k].need)) * 1.15;
    const lg = xyChart($("f2SPw"), { series: [{ n: "available power P_av(n)", cls: "f2-s1", pts: ns.map((n) => [n, Pav(n)]) }, { n: "cut: P꜀/η", cls: "f2-s3", noline: true, dots: true, r: 5, lab, pts: keys.map((k) => [res[k].n, res[k].need]) }],
      xmin: 0, xmax: nm, ymin: 0, ymax: pmax, xl: "spindle speed n (rpm)", yl: "power kW", vmarks: [[nb, "f2-lim", `n_b = ${fx(nb, 0)}`]], W: 560, H: 300 });
    const mmax = Math.max(Mx, ...keys.map((k) => res[k].M / eta)) * 1.15;
    xyChart($("f2STq"), { series: [{ cls: "f2-s2", pts: ns.filter((n) => n > 0).map((n) => [n, Mav(n)]) }, { cls: "f2-s3", noline: true, dots: true, r: 5, lab, pts: keys.map((k) => [res[k].n, res[k].M / eta]) }],
      xmin: 0, xmax: nm, ymin: 0, ymax: mmax, xl: "spindle speed n (rpm)", yl: "torque Nm", vmarks: [[nb, "f2-lim", `n_b`]], W: 560, H: 300 });
    $("f2SLg").innerHTML = lg + ` <span class="fx-lg"><i class="f2-lg f2-s2"></i>available torque M_av(n) = min(M_max, 9550·P_rated/n)</span>`;
    $("f2SRes").innerHTML = `<p>${keys.map((k) => `<b>${k}</b>: ${res[k].ok ? "OK" : "NOT OK"}, ${res[k].lim}-limited (${fx(res[k].util * 100, 0)} %)`).join(" · ")}. <span class="sub">Below n_b the motor gives full torque but not full power – a large face mill at low speed uses the torque; above n_b only the power counts.</span></p>`;
    R.spindle = { n_b: rnd(nb, 2), cuts: Object.fromEntries(keys.map((k) => [k, { n: rnd(res[k].n, 2), Pc_kW: rnd(res[k].Pc, 4), M_Nm: rnd(res[k].M, 3), P_need_kW: rnd(res[k].need, 4), P_av_kW: rnd(res[k].av, 4), limit: res[k].lim, ok: res[k].ok, t_min: rnd(res[k].t, 4) }])) };
    R.cut_ref = { vc: num(st.cuts.turning.vc), t: res.turning.t };
    if (taylorRedraw) taylorRedraw();
  };
  sync(); build(); draw();
  $("f2Cuts").addEventListener("input", (e) => { const t = e.target; if (!t.dataset.c) return; st.cuts[t.dataset.c][t.dataset.f] = num(t.value); draw(); });
  [["f2SP", "P_rated_kW"], ["f2SM", "M_max_Nm"], ["f2SN", "n_max"], ["f2SE", "eta"]].forEach(([id, k]) => $(id).addEventListener("input", () => { const v = num($(id).value); if (v > 0) { st.sp[k] = v; draw(); } }));
  $("f2SRst").addEventListener("click", () => { st = def(); sync(); build(); draw(); });

  // Taylor
  const TY = EX2.taylor;
  const tdef = () => ({ n: TY.n, C: TY.C, M: TY.rate_EUR_h, K: TY.K_t_EUR, tct: TY.t_ct_min, v: C.turning.vc, th: 0.5 });
  let ts = store.get("taylor", tdef());
  [["f2Tn", "n"], ["f2TC", "C"], ["f2TM", "M"], ["f2TK", "K"], ["f2Tct", "tct"], ["f2Tv", "v"], ["f2Th", "th"]].forEach(([id, k]) => { $(id).value = ts[k]; $(id).addEventListener("input", () => { const v = num($(id).value, NaN); if (Number.isFinite(v) && v >= 0) { ts[k] = v; tdraw(); } }); });
  function tdraw() {
    store.set("taylor", ts);
    const n = Math.min(0.95, Math.max(0.05, ts.n)), Cc = ts.C, Mm = ts.M / 60, T = (v) => (Cc / v) ** (1 / n);
    const Tmc = (1 / n - 1) * (ts.tct + ts.K / Mm), Tmp = (1 / n - 1) * ts.tct, vmc = Cc / Tmc ** n, vmp = Cc / Tmp ** n;
    const ref = R.cut_ref || { vc: 200, t: 1.357 }, tm = (v) => ref.t * ref.vc / v;   // machining time scales with 1/v (same feed, same path)
    const cost = (v) => Mm * (ts.th + tm(v)) + (Mm * ts.tct + ts.K) * tm(v) / T(v);
    const time = (v) => ts.th + tm(v) + ts.tct * tm(v) / T(v);
    const vs = []; const va = Math.max(1, Math.min(vmc, vmp) * 0.4), vb = Math.max(vmc, vmp, ts.v) * 1.6; for (let i = 0; i <= 120; i++) vs.push(va + (vb - va) * i / 120);
    const cmin = vs.reduce((b, v) => (cost(v) < cost(b) ? v : b), vs[0]);
    const lg = xyChart($("f2TChart"), { series: [{ n: "cost per part €", cls: "f2-s1", pts: vs.map((v) => [v, cost(v)]) }, { n: "time per part min (× M/60 → €)", cls: "f2-s2", pts: vs.map((v) => [v, time(v) * Mm]) }],
      xmin: va, xmax: vb, ymin: 0, ymax: Math.max(...vs.map((v) => Math.max(cost(v), time(v) * Mm))) * 1.05, xl: "cutting speed v꜀ (m/min)", yl: "€ per part",
      vmarks: [[vmc, "f2-lim", `v_min-cost ${fx(vmc, 0)}`], [vmp, "fe-req", `v_max-prod ${fx(vmp, 0)}`, 14], [ts.v, "f2-you", "your v꜀", 28]], W: 600, H: 300 });
    $("f2TLg").innerHTML = lg + ` <span class="sub">machining time from the turning cut above: t_m(v) = ${fx(ref.t, 3)} min · ${fx(ref.vc, 0)}/v; handling ${ts.th} min</span>`;
    $("f2TRes").innerHTML = `<table class="am-kv"><tbody>
      <tr><td>Tool life at your v꜀ = ${ts.v}</td><td>T = (${Cc}/${ts.v})^(1/${n}) = <b>${fx(T(ts.v), 1)} min</b> · cost ${fx(cost(ts.v), 3)} €/part · time ${fx(time(ts.v), 3)} min/part</td></tr>
      <tr><td>Minimum cost</td><td>T = (1/${n} − 1)·(${ts.tct} + ${ts.K}/(${ts.M}/60)) = <b>${fx(Tmc, 2)} min</b> → v = ${Cc}/${fx(Tmc, 2)}^${n} = <b>${fx(vmc, 1)} m/min</b> · ${fx(cost(vmc), 3)} €/part</td></tr>
      <tr><td>Maximum production</td><td>T = (1/${n} − 1)·${ts.tct} = <b>${fx(Tmp, 2)} min</b> → v = ${Cc}/${fx(Tmp, 2)}^${n} = <b>${fx(vmp, 1)} m/min</b> · ${fx(time(vmp), 3)} min/part</td></tr>
      <tr><td>Check (numeric)</td><td>lowest point of the cost curve at ≈ ${fx(cmin, 0)} m/min ${Math.abs(cmin - vmc) / vmc < 0.03 ? '<span class="fe-ok">= v_min-cost ✓</span>' : ""}</td></tr></tbody></table>
      <p class="sub">${ts.v > vmp ? '<span class="fe-no">Your speed is above v_max-prod: slower AND more expensive – reduce it.</span>' : ts.v < vmc ? "Your speed is below v_min-cost: you lose machine time; raise it towards v_min-cost." : "Your speed is in the efficiency range between v_min-cost and v_max-prod ✓."}</p>`;
    $("f2TWx").innerHTML = wx("tool life and economic speed for the example", [
      `Taylor: v·T^${n} = ${Cc} → at v = ${ts.v} m/min: T = (${Cc}/${ts.v})^(1/${n}) = ${fx(Cc / ts.v, 3)}^${fx(1 / n, 2)} = <b>${fx(T(ts.v), 2)} min</b>.`,
      `Machine rate M = ${ts.M} €/h = ${fx(Mm, 3)} €/min. Tool cost per edge in minutes of machine time: K_t/(M/60) = ${ts.K}/${fx(Mm, 3)} = ${fx(ts.K / Mm, 2)} min.`,
      `T_min-cost = (1/${n} − 1)·(t_ct + K_t/(M/60)) = ${fx(1 / n - 1, 2)}·(${ts.tct} + ${fx(ts.K / Mm, 2)}) = <b>${fx(Tmc, 2)} min</b> → v = ${Cc}/${fx(Tmc, 2)}^${n} = <b>${fx(vmc, 1)} m/min</b>.`,
      `T_max-prod = (1/${n} − 1)·t_ct = ${fx(1 / n - 1, 2)}·${ts.tct} = <b>${fx(Tmp, 2)} min</b> → v = <b>${fx(vmp, 1)} m/min</b>.`]);
    R.taylor = { T_at_v: rnd(T(ts.v), 3), v: ts.v, T_min_cost: rnd(Tmc, 4), v_min_cost: rnd(vmc, 3), T_max_prod: rnd(Tmp, 4), v_max_prod: rnd(vmp, 3), cost_at_vmc: rnd(cost(vmc), 4) };
  }
  taylorRedraw = tdraw; tdraw();

  // small boxes: tapping, bending, welding, moulding
  const small = (inId, resId, key, flds, calc) => {
    let v = store.get(key, null) || Object.fromEntries(flds.map(([k, , , d]) => [k, d]));
    $(inId).innerHTML = flds.map(([k, l, u]) => `<label>${l} <input type="number" step="any" min="0" data-k="${k}" value="${v[k]}"> ${u}</label>`).join("");
    const go = () => { store.set(key, v); $(resId).innerHTML = calc(v); };
    $(inId).addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; v[k] = num(e.target.value); go(); });
    go();
  };
  const tp = C.tapping;
  small("f2TapIn", "f2TapRes", "tap", [["D", "D", "mm", tp.D], ["P", "pitch P", "mm", tp.P], ["H", "depth H", "mm", tp.H], ["vc", "v꜀", "m/min", tp.vc], ["holes", "holes", "", tp.holes]], (v) => {
    const n = 1000 * v.vc / (Math.PI * v.D), t = 2 * (v.H + 2 * v.P) / (v.P * n);
    R.tapping = { n: rnd(n, 2), t_hole_s: rnd(t * 60, 3), total_s: rnd(t * 60 * v.holes, 2) };
    return `<p class="phd-eq">n = 1000·${v.vc}/(π·${v.D}) = <b>${fx(n, 0)} rpm</b><br>t = 2·(H + 2P)/(P·n) = 2·(${v.H} + 2·${v.P})/(${v.P}·${fx(n, 0)}) = <b>${fx(t * 60, 2)} s</b> per hole</p><p>${v.holes} holes: <b>${fx(t * 60 * v.holes, 1)} s</b> (+ positioning between holes). In and out at the same speed (rigid tapping).</p>`;
  });
  const be = EX2.bending;
  small("f2BeIn", "f2BeRes", "bend", [["nb", "bends", "", be.n_bends], ["tb", "t per bend", "s", be.t_bend_s], ["th", "handling", "s", be.t_handling_s]], (v) => {
    const t = v.nb * v.tb + v.th; R.bending = { t_s: t };
    return `<p class="phd-eq">t = n_bends·t_bend + t_handling = ${v.nb}·${v.tb} + ${v.th} = <b>${fx(t, 0)} s</b></p><p>${fx(3600 / t, 0)} parts per hour at 100 % – fewer bends (design) or a robot cell for long runs.</p>`;
  });
  const we = EX2.welding;
  small("f2WeIn", "f2WeRes", "weld", [["L", "weld length", "mm", we.L_weld_mm], ["v", "weld speed", "m/min", we.v_weld_m_min]], (v) => {
    const t = v.L / 1000 / v.v; R.welding = { t_arc_min: rnd(t, 4), t_arc_s: rnd(t * 60, 2) };
    return `<p class="phd-eq">t_arc = L_weld/v_weld = ${fx(v.L / 1000, 2)} m / ${v.v} m/min = <b>${fx(t, 2)} min = ${fx(t * 60, 0)} s</b></p><p>Cell cycle ≈ t_arc / arc-on share (typical 40–70 %: air moves, torch cleaning, positioner turns) → ${fx(t / 0.6, 1)} min at 60 %.</p>`;
  });
  const mo = EX2.moulding;
  small("f2MoIn", "f2MoRes", "mould", [["s", "wall s", "mm", mo.s_mm], ["a", "α", "mm²/s", mo.alpha_mm2_s], ["Tm", "T_melt", "°C", mo.T_m], ["Tw", "T_mould", "°C", mo.T_w], ["Te", "T_eject", "°C", mo.T_e], ["A", "A_proj", "cm²", mo.A_proj_cm2], ["p", "p_cav", "bar", mo.p_cav_bar], ["sf", "safety", "", mo.safety], ["ti", "t_inject", "s", mo.t_inject_s], ["thd", "t_hold", "s", mo.t_hold_s], ["to", "t_open/eject/close", "s", mo.t_open_s]], (v) => {
    const tc = (s) => s * s / (Math.PI ** 2 * v.a) * Math.log((8 / Math.PI ** 2) * (v.Tm - v.Tw) / (v.Te - v.Tw));
    const t = tc(v.s), cyc = v.ti + v.thd + t + v.to, F = v.p * v.A * v.sf * 0.01;
    const lnArg = (8 / Math.PI ** 2) * (v.Tm - v.Tw) / (v.Te - v.Tw);
    R.moulding = { t_cool_s: rnd(t, 3), t_cycle_s: rnd(cyc, 3), F_kN: rnd(F, 2), F_t: rnd(F / 9.80665, 1) };
    const ss = []; for (let i = 1; i <= 50; i++) ss.push(i / 10);
    xyChart($("f2MoChart"), { series: [{ cls: "f2-s1", pts: ss.map((s) => [s, tc(s)]) }, { cls: "f2-s3", noline: true, dots: true, r: 5, lab: [`${v.s} mm → ${fx(t, 1)} s`], pts: [[v.s, t]] }], xmin: 0, xmax: 5, ymin: 0, ymax: Math.max(5, tc(5)) * 1.05, xl: "wall thickness s (mm)", yl: "cooling time s", W: 560, H: 280 });
    return `<p class="phd-eq">t_cool = s²/(π²·α) · ln((8/π²)·(T_m − T_w)/(T_e − T_w)) = ${v.s}²/(π²·${v.a}) · ln(${fx(8 / Math.PI ** 2, 4)}·${fx(v.Tm - v.Tw, 0)}/${fx(v.Te - v.Tw, 0)}) = ${fx(v.s * v.s / (Math.PI ** 2 * v.a), 3)} · ${fx(Math.log(lnArg), 4)} = <b>${fx(t, 2)} s</b></p>
      <p class="phd-eq">t_cycle = t_inject + t_hold + t_cool + t_open = ${v.ti} + ${v.thd} + ${fx(t, 2)} + ${v.to} = <b>${fx(cyc, 2)} s</b> → ${fx(3600 / cyc, 0)} shots per hour</p>
      <p class="phd-eq">F = p_cav·A_proj·safety = ${v.p}·${v.A}·${v.sf} bar·cm² × 0.01 = <b>${fx(F, 0)} kN</b> (≈ ${fx(F / 9.80665, 0)} t) → choose the next machine size above it</p>
      ${lnArg <= 1 ? '<p class="fe-no">T_eject must be well below T_melt and above T_mould – the logarithm is not positive.</p>' : ""}
      <p class="sub">Cooling time grows with s² – a wall of ${fx(v.s * 2, 1)} mm needs ${fx(tc(v.s * 2) / t, 1)} × longer. α ≈ 0.07–0.12 mm²/s for most thermoplastics.</p>`;
  });
}

/* ================================================================== 2J calendar, capacity, lot size */
function html2J() {
  return card("f22J", "2J · Calendar, capacity and lot size – available hours, machines per group, bottleneck, EOQ", "edit the calendar, the part table and the cost data · everything recalculates",
    guide({
      principle: `<p>Capacity planning compares the <b>load</b> (hours the parts need) with the <b>available hours</b> of a machine. The calendar gives the hours a machine
        is staffed; OEE (availability × performance × quality) gives the share of them that becomes good parts. Set-ups are part of the load: every lot needs one set-up,
        so small lots cost capacity. The group with the highest utilisation is the <b>bottleneck</b> – it decides the output of the whole system.</p>
        <p class="phd-eq">days = 365 − weekend − holidays − shutdown · h = days·shifts·(shift_h − break_h) · h_avail = h·(1 − planned_maint)<br>
        L_g = Σ Q_i·t_ig/60 + Σ ⌈Q_i/lot_i⌉·t_setup,g/60 · machines_g = ⌈L_g/(h_avail·OEE_g)⌉ · util_g = L_g/(machines_g·h_avail·OEE_g)</p>
        <p>The <b>economic order quantity</b> (EOQ, Harris 1913) balances set-up cost (falls with bigger lots) and holding cost (grows with bigger lots):</p>
        <p class="phd-eq">Q* = √(2·D·S/H) · S = t_setup·rate + admin · H = holding_rate·unit_value · total cost = D/Q·S + Q/2·H</p>`,
      uses: USES.J,
      howto: ["Take the calendar from HR / the works council agreement (shifts, holidays, shutdown) – not the theoretical 8 760 h.",
        "Use measured OEE of similar machines (typical 65–80 % for machining; new FMS target 80–85 %) – never 100 %.",
        "Plan the bottleneck at ≤ 85 % utilisation – the rest is the buffer for breakdowns, new parts and volume growth.",
        "Check lot sizes on the bottleneck: if set-up hours are a large share, invest in quick change-over (SMED) before buying another machine.",
        "Repeat the calculation for the forecast volume of year 3 and year 5 → when is the next machine needed?"],
    }) + `
    <h3 class="fe-h3">Calendar → available hours per machine</h3>
    <div class="fe-row fe-calc" id="f2CalIn"></div><div id="f2CalRes"></div>
    <h3 class="fe-h3">Load per machine group</h3>
    <div class="fe-row"><label>Volume growth (optional) <input type="number" id="f2CapGr" value="0" min="-50" max="300" step="5"> %</label><button class="mx-el" id="f2CapRst">Reset to example</button><span class="sub">minutes per part on each group; 0 = the part does not visit the group</span></div>
    <div class="fe-scroll"><table class="am-tab fe-calc f2-cap" id="f2CapTab"></table></div>
    <div class="grid2 eq"><div id="f2CapRes"></div><div><svg id="f2CapChart" class="fe-chart" role="img" aria-label="Utilisation per machine group"></svg></div></div>
    <div id="f2CapWx"></div>
    <h3 class="fe-h3">Economic lot size (EOQ)</h3>
    <div class="fe-row fe-calc" id="f2EoqIn"></div>
    <div class="grid2 eq"><div id="f2EoqRes"></div><div><svg id="f2EoqChart" class="fe-chart" role="img" aria-label="Cost over lot size"></svg><div class="sub" id="f2EoqLg"></div></div></div>
    <h3 class="fe-h3">Lot size against capacity – set-up hours on the bottleneck</h3>
    <div class="fe-row"><label>Part <select id="f2LsPart"></select></label><span class="sub">all other parts keep their lot size from the table above</span></div>
    <div class="fe-scroll" id="f2LsTab"></div>`);
}
function capCalc(groups, parts, hav) {
  return groups.map(([name, oee, su], g) => {
    let run = 0, set = 0;
    parts.forEach(([, Q, lot, t]) => { const tg = num(t[g]); if (tg > 0) { run += num(Q) * tg / 60; set += Math.ceil(num(Q) / Math.max(1, num(lot, 1))) * num(su) / 60; } });
    const L = run + set, cap = hav * num(oee, 1), m = L > 0 ? Math.ceil(L / cap - 1e-9) : 0;
    return { name, oee: num(oee), su: num(su), run, set, L, cap, m, util: m ? L / (m * cap) : 0, need: L / cap };
  });
}
function init2J() {
  const CA = EX2.calendar;
  let cal = store.get("cal", clone(CA));
  const cf = [["weekend_days", "weekend days", ""], ["holidays", "holidays", ""], ["shutdown_days", "shutdown days", ""], ["shifts", "shifts / day", ""], ["shift_h", "shift", "h"], ["break_h", "break", "h"], ["planned_maint", "planned maintenance", "share"]];
  $("f2CalIn").innerHTML = cf.map(([k, l, u]) => `<label>${l} <input type="number" step="any" min="0" data-k="${k}" value="${cal[k]}"> ${u}</label>`).join("");
  let hav = 0;
  const calDraw = () => {
    store.set("cal", cal);
    const days = 365 - cal.weekend_days - cal.holidays - cal.shutdown_days, h = days * cal.shifts * (cal.shift_h - cal.break_h); hav = h * (1 - cal.planned_maint);
    $("f2CalRes").innerHTML = `<p class="phd-eq">days = 365 − ${cal.weekend_days} − ${cal.holidays} − ${cal.shutdown_days} = <b>${days}</b> · h = ${days}·${cal.shifts}·(${cal.shift_h} − ${cal.break_h}) = <b>${fx(h, 1)} h</b> · h_avail = ${fx(h, 1)}·(1 − ${cal.planned_maint}) = <b>${fx(hav, 2)} h per machine and year</b></p>
      <p class="sub">That is ${fx(hav / 8760 * 100, 0)} % of the 8 760 hours of a year. 3 shifts would give ${fx(days * 3 * (cal.shift_h - cal.break_h) * (1 - cal.planned_maint), 0)} h.</p>`;
    R.calendar = { days, h: rnd(h, 3), h_avail: rnd(hav, 3) };
  };
  $("f2CalIn").addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; cal[k] = num(e.target.value); calDraw(); capDraw(); });
  calDraw();

  const CP = EX2.capacity;
  const cdef = () => ({ groups: clone(CP.groups), parts: clone(CP.parts) });
  let cp = store.get("cap", cdef());
  const cbuild = () => {
    const G = cp.groups;
    $("f2CapTab").innerHTML = `<thead><tr><th>Part</th><th>Volume / year</th><th>Lot size</th>${G.map((g) => `<th>${esc(g[0])} min/part</th>`).join("")}</tr></thead><tbody>
      ${cp.parts.map((p, i) => `<tr><td>${esc(p[0])}</td><td><input type="number" min="0" data-p="${i}" data-k="1" value="${p[1]}"></td><td><input type="number" min="1" data-p="${i}" data-k="2" value="${p[2]}"></td>${G.map((_, g) => `<td><input type="number" min="0" step="any" data-t="${i},${g}" value="${p[3][g]}"></td>`).join("")}</tr>`).join("")}
      <tr class="fx-cur"><td><b>OEE</b></td><td></td><td></td>${G.map((g, k) => `<td><input type="number" min="0.05" max="1" step="0.01" data-g="${k}" data-k="1" value="${g[1]}"></td>`).join("")}</tr>
      <tr class="fx-cur"><td><b>Set-up min / lot</b></td><td></td><td></td>${G.map((g, k) => `<td><input type="number" min="0" step="any" data-g="${k}" data-k="2" value="${g[2]}"></td>`).join("")}</tr></tbody>`;
  };
  function capDraw() {
    store.set("cap", cp);
    const gr = 1 + num($("f2CapGr").value) / 100, partsG = cp.parts.map((p) => [p[0], p[1] * gr, p[2], p[3]]);
    const r = capCalc(cp.groups, partsG, hav), bn = r.reduce((b, x) => (x.util > b.util ? x : b), r[0]);
    $("f2CapRes").innerHTML = `<div class="fe-scroll"><table class="am-tab"><thead><tr><th>Group</th><th>Run h</th><th>Set-up h</th><th>Load L h</th><th>h·OEE</th><th>L/(h·OEE)</th><th>Machines</th><th>Util.</th></tr></thead><tbody>
      ${r.map((x) => `<tr${x === bn ? ' class="fx-best"' : ""}><td><b>${esc(x.name)}</b>${x === bn ? " ← bottleneck" : ""}</td><td>${fx(x.run, 1)}</td><td>${fx(x.set, 1)}</td><td>${fx(x.L, 1)}</td><td>${fx(x.cap, 1)}</td><td>${fx(x.need, 2)}</td><td><b>${x.m}</b></td><td>${fx(x.util * 100, 1)} %</td></tr>`).join("")}</tbody></table></div>
      <p>${bn.util > 0.85 ? `<span class="fe-no">Bottleneck ${esc(bn.name)} at ${fx(bn.util * 100, 1)} % – above 85 %: no buffer for breakdowns or growth. A group at ~100 % has no time for breakdowns, and queues (waiting pallets) grow without limit as utilisation approaches 100 % (queueing, see item 4) – this is not acceptable. Options: one more machine (${bn.m + 1} → ${fx(bn.L / ((bn.m + 1) * bn.cap) * 100, 0)} %), more hours, less set-up (SMED, bigger lots), higher OEE, a 3rd shift, or move work to another group.</span>` : `<span class="fe-ok">Bottleneck ${esc(bn.name)} at ${fx(bn.util * 100, 1)} % – below 85 % ✓</span>`}</p>`;
    const W = 560, H = 260, x0 = 90, x1 = W - 20, rowH = (H - 40) / Math.max(1, r.length), X = (u) => x0 + Math.min(u, 1.2) / 1.2 * (x1 - x0);
    let s = "";
    [0, 0.25, 0.5, 0.75, 1].forEach((u) => { s += `<line class="fe-grid" x1="${X(u)}" x2="${X(u)}" y1="10" y2="${H - 26}"/><text class="fe-tick" x="${X(u)}" y="${H - 10}" text-anchor="middle">${u * 100} %</text>`; });
    r.forEach((x, k) => { const y = 14 + k * rowH; s += `<text class="fe-tick f2-pl" x="${x0 - 8}" y="${y + rowH / 2 + 4}" text-anchor="end">${esc(x.name)} ×${x.m}</text><rect class="f2-ubar${x === bn ? " f2-ubn" : ""}" x="${x0}" y="${y + 4}" width="${X(x.util) - x0}" height="${rowH - 10}" rx="3"/><text class="f2-plab" x="${X(x.util) + 4}" y="${y + rowH / 2 + 4}">${fx(x.util * 100, 1)} %</text>`; });
    s += `<line class="fe-req" x1="${X(0.85)}" x2="${X(0.85)}" y1="10" y2="${H - 26}"/><text class="fe-tick" x="${X(0.85) + 3}" y="20">85 %</text>`;
    $("f2CapChart").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f2CapChart").innerHTML = s;
    const g0 = r[0], p0 = cp.parts.filter((p) => num(p[3][0]) > 0);
    $("f2CapWx").innerHTML = wx(`load of the group ${esc(g0.name)}`, [
      `Run hours: ${p0.map((p) => `${fx(p[1], 0)}·${p[3][0]}`).join(" + ")} = ${fx(g0.run * 60, 0)} min = <b>${fx(g0.run, 1)} h</b>.`,
      `Set-ups: ${p0.map((p) => `⌈${p[1]}/${p[2]}⌉`).join(" + ")} = ${p0.reduce((a, p) => a + Math.ceil(p[1] / Math.max(1, p[2])), 0)} lots × ${g0.su} min = <b>${fx(g0.set, 1)} h</b>.`,
      `L = ${fx(g0.L, 1)} h; one machine gives h_avail·OEE = ${fx(hav, 2)}·${g0.oee} = ${fx(g0.cap, 1)} h → ${fx(g0.need, 3)} machines → <b>${g0.m}</b>; utilisation = ${fx(g0.L, 1)}/(${g0.m}·${fx(g0.cap, 1)}) = <b>${fx(g0.util * 100, 1)} %</b>.`]);
    R.capacity = { growth_pct: rnd((gr - 1) * 100, 2), h_avail: rnd(hav, 3), groups: Object.fromEntries(r.map((x) => [x.name, { load_h: rnd(x.L, 3), setup_h: rnd(x.set, 3), machines: x.m, util: rnd(x.util, 4) }])), bottleneck: bn.name };
    $("f2LsPart").innerHTML = cp.parts.map((p, i) => `<option value="${i}"${i === lsPart ? " selected" : ""}>${esc(p[0])}</option>`).join("");
    lsDraw();
  }
  let lsPart = 1;   // Crankcase VC10 – its volume 4 000 = EOQ example D
  const lsDraw = () => {
    const p = cp.parts[lsPart]; if (!p) return;
    const gi = cp.groups.map((g, k) => k).filter((k) => num(p[3][k]) > 0);
    const eoq = R.eoq ? Math.round(R.eoq.Q) : 94;
    const lots = [...new Set([10, 20, p[2], eoq, 200, 500, p[1]].map((x) => Math.max(1, Math.round(num(x, 1)))))].sort((a, b) => a - b);
    const rows = lots.map((lot) => { const parts = cp.parts.map((q, i) => (i === lsPart ? [q[0], q[1], lot, q[3]] : q)); return { lot, r: capCalc(cp.groups, parts, hav) }; });
    const S = R.eoq ? R.eoq.S : 50, Hc = R.eoq ? R.eoq.H : 45;
    $("f2LsTab").innerHTML = `<div class="fe-scroll"><table class="am-tab"><thead><tr><th>Lot size of ${esc(p[0])}</th><th>Lots / year</th>${gi.map((k) => `<th>${esc(cp.groups[k][0])}: set-up h · machines · util.</th>`).join("")}<th>Set-up + holding cost (EOQ data)</th></tr></thead><tbody>
      ${rows.map(({ lot, r }) => `<tr${lot === eoq ? ' class="fx-best"' : lot === p[2] ? ' class="fx-cur"' : ""}><td><b>${lot}</b>${lot === eoq ? " (EOQ)" : lot === p[2] ? " (table)" : ""}</td><td>${Math.ceil(p[1] / lot)}</td>${gi.map((k) => `<td>${fx(r[k].set, 1)} h · ${r[k].m} · ${fx(r[k].util * 100, 1)} %</td>`).join("")}<td>${eur(p[1] / lot * S + lot / 2 * Hc)}</td></tr>`).join("")}</tbody></table></div>
      <p class="sub">Small lots → many set-ups → set-up hours eat the capacity of the bottleneck; big lots → high stock. If the bottleneck is close to 100 %, use a lot size ≥ EOQ or reduce the set-up time (then the EOQ itself becomes smaller).</p>`;
  };
  cbuild(); capDraw();
  $("f2CapTab").addEventListener("input", (e) => { const t = e.target, v = num(t.value);
    if (t.dataset.p != null) cp.parts[+t.dataset.p][+t.dataset.k] = Math.max(t.dataset.k === "2" ? 1 : 0, v);
    if (t.dataset.t) { const [i, g] = t.dataset.t.split(","); cp.parts[+i][3][+g] = Math.max(0, v); }
    if (t.dataset.g != null) cp.groups[+t.dataset.g][+t.dataset.k] = t.dataset.k === "1" ? Math.min(1, Math.max(0.05, v)) : Math.max(0, v);
    capDraw(); });
  $("f2CapRst").addEventListener("click", () => { cp = cdef(); $("f2CapGr").value = 0; cbuild(); capDraw(); });
  $("f2CapGr").addEventListener("input", capDraw);
  $("f2LsPart").addEventListener("change", () => { lsPart = +$("f2LsPart").value; lsDraw(); });

  const EQ = EX2.eoq;
  let eq = store.get("eoq", clone(EQ));
  const ef = [["D", "demand D", "/year"], ["t_setup_h", "set-up time", "h"], ["rate_EUR_h", "rate", "€/h"], ["admin_EUR", "admin per order", "€"], ["holding_rate", "holding rate", "/year"], ["unit_value_EUR", "unit value", "€"]];
  $("f2EoqIn").innerHTML = ef.map(([k, l, u]) => `<label>${l} <input type="number" step="any" min="0" data-k="${k}" value="${eq[k]}"> ${u}</label>`).join("");
  const eqDraw = () => {
    store.set("eoq", eq);
    const S = eq.t_setup_h * eq.rate_EUR_h + eq.admin_EUR, Hh = eq.holding_rate * eq.unit_value_EUR, Q = Math.sqrt(2 * eq.D * S / Hh), tc = (q) => eq.D / q * S + q / 2 * Hh;
    R.eoq = { S: rnd(S, 4), H: rnd(Hh, 4), Q: rnd(Q, 3), TC: rnd(tc(Q), 2), lots_per_year: rnd(eq.D / Q, 2) };
    $("f2EoqRes").innerHTML = `<p class="phd-eq">S = ${eq.t_setup_h}·${eq.rate_EUR_h} + ${eq.admin_EUR} = <b>${fx(S, 2)} €</b> · H = ${eq.holding_rate}·${eq.unit_value_EUR} = <b>${fx(Hh, 2)} € per part and year</b><br>
      Q* = √(2·${eq.D}·${fx(S, 2)}/${fx(Hh, 2)}) = <b>${fx(Q, 1)} parts</b> → ${fx(eq.D / Q, 1)} lots per year · total cost at Q* = ${eur(tc(Q))} per year</p>
      <p>At Q* set-up cost = holding cost (${eur(eq.D / Q * S)} each). The curve is flat near Q*: ±30 % lot size costs only ${fx((tc(Q * 1.3) / tc(Q) - 1) * 100, 1)} % / ${fx((tc(Q * 0.7) / tc(Q) - 1) * 100, 1)} % more → round to a practical value (pallet, container, multiples of the fixture).</p>`;
    const qs = []; for (let i = 1; i <= 100; i++) qs.push(Q * 4 * i / 100);
    $("f2EoqLg").innerHTML = xyChart($("f2EoqChart"), { series: [{ n: "set-up cost D/Q·S", cls: "f2-s2", pts: qs.map((q) => [q, eq.D / q * S]) }, { n: "holding cost Q/2·H", cls: "f2-s3", pts: qs.map((q) => [q, q / 2 * Hh]) }, { n: "total cost", cls: "f2-s1", pts: qs.map((q) => [q, tc(q)]) }],
      xmin: 0, xmax: Q * 4, ymin: 0, ymax: tc(Q) * 2.5, xl: "lot size Q (parts)", yl: "€ per year", vmarks: [[Q, "f2-lim", `Q* = ${fx(Q, 0)}`]], W: 560, H: 280 });
    lsDraw();
  };
  $("f2EoqIn").addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; const v = num(e.target.value); if (v > 0 || k === "admin_EUR") { eq[k] = v; eqDraw(); } });
  eqDraw();
}

/* ================================================================== 2K line balancing */
function html2K() {
  return card("f22K", "2K · Line balancing – takt time, precedence graph, RPW and LCR assignment, station loads", "edit tasks, times and predecessors · two heuristics side by side · cycle detection",
    guide({
      principle: `<p>An assembly line is a chain of stations; every station has the same time window, the <b>takt time</b>. Line balancing assigns the tasks to as few stations
        as possible without breaking the precedence (a task can only start when its predecessors are done) and without any station exceeding the takt.
        The exact problem is hard (NP-hard); two simple heuristics give good results in seconds:</p>
        <p class="phd-eq">takt = h_avail·3600/demand [s] · min stations = ⌈Σt/takt⌉ · efficiency = Σt/(stations·takt) · balance delay = 1 − efficiency</p>
        <p><b>RPW</b> (ranked positional weight, Helgeson & Birnie 1961): positional weight = own time + times of all following tasks; tasks with a long "tail" go first.
        <b>LCR</b> (largest candidate rule): the longest available task first. Both fill a station with the first task in the ranked list whose predecessors are
        assigned and which still fits; if none fits, the next station is opened.</p>`,
      uses: USES.K,
      howto: ["Write the task list with times from MTM / time studies or from a similar line; one task = smallest unit that cannot be split between stations.",
        "Draw the precedence graph with the product designer – only real technical dependencies, not the habit of the old line.",
        "Plan with takt × 0.90–0.95 (operator variation, small stops) and check the fullest station.",
        "A task longer than the takt needs parallel stations (2 stations doing the same task, each at 2 × takt) or a faster process.",
        "Re-balance when the demand changes: the takt changes → new number of stations and operators."],
    }) + `
    <div class="fe-row"><label>Demand <input type="number" id="f2LbD" min="1" step="100"> / year</label><label>Available hours <input type="number" id="f2LbH" min="1" step="10"> h / year</label>
      <button class="mx-el" id="f2LbAdd">+ Add task</button><button class="mx-el" id="f2LbRst">Reset to example</button><span class="sub">Predecessors: IDs separated by commas, e.g. <code>B, C</code></span></div>
    <div id="f2LbMsg"></div><div id="f2LbKpi"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Precedence graph <span class="sub">columns = levels (longest path from the start)</span></h3><div class="fe-scroll"><svg id="f2LbGraph" class="fe-chart" role="img" aria-label="Precedence graph"></svg></div></div>
      <div><h3 class="fe-h3">Task table</h3><div class="fe-scroll"><table class="am-tab fe-calc f2-lb" id="f2LbTab"></table></div></div></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Stations – RPW</h3><svg id="f2LbG1" class="fe-chart" role="img" aria-label="Station loads RPW"></svg></div><div><h3 class="fe-h3">Stations – LCR</h3><svg id="f2LbG2" class="fe-chart" role="img" aria-label="Station loads LCR"></svg></div></div>
    <div class="fe-scroll" id="f2LbPw"></div>
    <div id="f2LbWx"></div>`);
}
function lbCalc(tasks, takt) {
  const ids = tasks.map((t) => String(t.id).trim()), by = new Map(ids.map((x, i) => [x, i])), warn = [];
  ids.forEach((x, i) => { if (!x) warn.push(`Task ${i + 1} has no ID.`); else if (ids.indexOf(x) !== i) warn.push(`Duplicate ID ${esc(x)}.`); });
  const pre = tasks.map((t) => String(t.p || "").split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean).filter((x) => { if (!by.has(x)) { warn.push(`${esc(t.id)}: unknown predecessor "${esc(x)}" (ignored)`); return false; } return true; }).map((x) => by.get(x)));
  const succ = tasks.map(() => []); pre.forEach((ps, i) => ps.forEach((p) => succ[p].push(i)));
  const indeg = pre.map((p) => p.length), order = [], q = indeg.map((d, i) => (d === 0 ? i : -1)).filter((i) => i >= 0);
  while (q.length) { const i = q.shift(); order.push(i); succ[i].forEach((s) => { if (--indeg[s] === 0) q.push(s); }); }
  if (order.length < tasks.length) {
    const rem = new Set(tasks.map((_, i) => i).filter((i) => indeg[i] > 0));
    let ch = true; while (ch) { ch = false; rem.forEach((i) => { if (!succ[i].some((x) => rem.has(x))) { rem.delete(i); ch = true; } }); }
    return { ok: false, warn, msg: `Cycle in the precedence – these tasks wait for each other: ${[...rem].map((i) => esc(ids[i])).join(", ")}. Remove one predecessor link.` };
  }
  const t = tasks.map((x) => Math.max(0, num(x.t)));
  const level = []; order.forEach((i) => { level[i] = pre[i].reduce((m, p) => Math.max(m, level[p] + 1), 0); });
  const all = tasks.map((_, i) => { const s = new Set(), st = [...succ[i]]; while (st.length) { const k = st.pop(); if (!s.has(k)) { s.add(k); st.push(...succ[k]); } } return s; });
  const pw = t.map((ti, i) => ti + [...all[i]].reduce((a, k) => a + t[k], 0));
  const cmpId = (a, b) => (ids[a] < ids[b] ? -1 : ids[a] > ids[b] ? 1 : 0);
  const assign = (rank) => {
    const done = new Set(), st = []; let over = false;
    while (done.size < t.length) {
      const cur = []; let left = takt;
      for (;;) {
        const av = rank.filter((i) => !done.has(i) && pre[i].every((p) => done.has(p)));
        let c = av.find((i) => t[i] <= left + 1e-9);
        if (c == null && !cur.length && av.length) { c = av[0]; over = true; }   // task longer than takt → alone in a station (overload)
        if (c == null) break;
        cur.push(c); done.add(c); left -= t[c];
      }
      st.push(cur);
    }
    return { st, load: st.map((s) => s.reduce((a, i) => a + t[i], 0)), over };
  };
  const idx = tasks.map((_, i) => i);
  const rpw = assign([...idx].sort((a, b) => pw[b] - pw[a] || cmpId(a, b)));
  const lcr = assign([...idx].sort((a, b) => t[b] - t[a] || cmpId(a, b)));
  const sum = t.reduce((a, b) => a + b, 0), kpi = (r) => ({ n: r.st.length, eff: sum / (r.st.length * takt), max: Math.max(...r.load) });
  return { ok: true, warn, ids, pre, succ, all, t, level, pw, rpw, lcr, sum, kRpw: kpi(rpw), kLcr: kpi(lcr), minSt: Math.ceil(sum / takt - 1e-9) };
}
function init2K() {
  const LB = EX2.line_balance;
  const def = () => ({ D: LB.demand_per_year, H: LB.hours, tasks: LB.tasks.map(([id, n, t, p]) => ({ id, n, t, p: p.join(", ") })) });
  let st = store.get("lb", def());
  const sync = () => { $("f2LbD").value = st.D; $("f2LbH").value = st.H; };
  const build = () => {
    $("f2LbTab").innerHTML = `<thead><tr><th>ID</th><th>Task</th><th>t s</th><th>Predecessors</th><th></th></tr></thead><tbody>${st.tasks.map((x, i) => `<tr><td><input class="fx-id" data-i="${i}" data-k="id" value="${esc(x.id)}"></td><td><input class="f2-wn" data-i="${i}" data-k="n" value="${esc(x.n)}"></td><td><input type="number" min="0" step="any" data-i="${i}" data-k="t" value="${x.t}"></td><td><input class="f2-pre" data-i="${i}" data-k="p" value="${esc(x.p)}"></td><td><button class="mx-el fx-x" data-del="${i}" title="remove">✕</button></td></tr>`).join("")}</tbody>`;
  };
  const gantt = (svg, res, r, takt) => {
    const W = 560, rowH = 30, H = 40 + res.st.length * rowH, x0 = 46, x1 = W - 16, tm = Math.max(takt, res.load.reduce((a, b) => Math.max(a, b), 0)) * 1.08, X = (v) => x0 + v / tm * (x1 - x0);
    let s = "";
    const step = tm > 200 ? 50 : 20;
    for (let v = 0; v <= tm; v += step) s += `<line class="fe-grid" x1="${X(v)}" x2="${X(v)}" y1="8" y2="${H - 22}"/><text class="fe-tick" x="${X(v)}" y="${H - 8}" text-anchor="middle">${v}</text>`;
    res.st.forEach((tasks, k) => {
      const y = 10 + k * rowH; let acc = 0;
      s += `<text class="fe-tick f2-pl" x="${x0 - 6}" y="${y + rowH / 2 + 2}" text-anchor="end">S${k + 1}</text>`;
      tasks.forEach((i, j) => { s += `<rect class="f2-task f2-tk${j % 2}${res.load[k] > takt + 1e-9 ? " f2-tover" : ""}" x="${X(acc)}" y="${y + 2}" width="${Math.max(1, X(acc + r.t[i]) - X(acc))}" height="${rowH - 8}"><title>${esc(r.ids[i])}: ${r.t[i]} s</title></rect><text class="f2-tl" x="${(X(acc) + X(acc + r.t[i])) / 2}" y="${y + rowH / 2 + 2}" text-anchor="middle">${esc(r.ids[i])}</text>`; acc += r.t[i]; });
      s += `<text class="fe-tick" x="${X(acc) + 4}" y="${y + rowH / 2 + 2}">${fx(acc, 0)} s</text>`;
    });
    s += `<line class="fe-req" x1="${X(takt)}" x2="${X(takt)}" y1="4" y2="${H - 22}"/><text class="fe-tick" x="${X(takt) - 4}" y="${H - 24}" text-anchor="end">takt ${fx(takt, 1)} s</text>`;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  };
  const draw = () => {
    store.set("lb", st);
    const takt = num(st.H) * 3600 / Math.max(1, num(st.D, 1)), r = lbCalc(st.tasks, takt);
    $("f2LbMsg").innerHTML = (r.warn.length ? `<p class="fe-no">${r.warn.join("<br>")}</p>` : "") + (r.ok ? "" : `<p class="fe-no fx-alert">${r.msg}</p>`);
    if (!r.ok) { R.line = { ok: false, msg: r.msg }; return; }
    const long = r.t.map((x, i) => [x, i]).filter(([x]) => x > takt + 1e-9);
    const sta = (res) => res.st.map((s) => s.map((i) => r.ids[i]));
    $("f2LbKpi").innerHTML = `<p class="fe-big">takt = ${fx(st.H, 0)}·3600/${fx(st.D, 0)} = <b>${fx(takt, 1)} s</b> · Σt = <b>${fx(r.sum, 0)} s</b> · min stations = ⌈${fx(r.sum, 0)}/${fx(takt, 1)}⌉ = <b>${r.minSt}</b></p>
      <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Method</th><th>Stations</th><th>Efficiency Σt/(N·takt)</th><th>Balance delay</th><th>Fullest station</th><th>Station contents</th></tr></thead><tbody>
      ${[["RPW", r.rpw, r.kRpw], ["LCR", r.lcr, r.kLcr]].map(([n, res, k]) => `<tr><td><b>${n}</b></td><td>${k.n}</td><td>${fx(r.sum, 0)}/(${k.n}·${fx(takt, 1)}) = <b>${fx(k.eff * 100, 2)} %</b></td><td>${fx((1 - k.eff) * 100, 2)} %</td><td>${fx(k.max, 0)} s → max. ${fx(3600 / k.max, 1)} units/h</td><td>${sta(res).map((s, j) => `S${j + 1}: ${s.join("+")}`).join(" · ")}</td></tr>`).join("")}</tbody></table></div>
      ${long.length ? `<p class="fe-no">Task(s) ${long.map(([x, i]) => `${esc(r.ids[i])} (${x} s)`).join(", ")} longer than the takt – put them in parallel stations or speed them up; they are shown alone in an overloaded station.</p>` : ""}
      <p class="sub">${r.kRpw.n > r.minSt ? `Both heuristics need more than the theoretical minimum of ${r.minSt} stations – the precedence and the task sizes do not allow a perfect fill. Split a large task or allow a slightly longer takt to save a station.` : "The heuristic reaches the theoretical minimum ✓."}</p>`;
    // precedence graph
    const maxL = Math.max(...r.level), cols = []; r.level.forEach((l, i) => { (cols[l] = cols[l] || []).push(i); });
    const maxR = Math.max(...cols.map((c) => c.length)), W = Math.max(440, 90 * (maxL + 1) + 40), H = Math.max(160, 64 * maxR + 20);
    const pos = []; cols.forEach((c, l) => c.forEach((i, k) => { pos[i] = [40 + l * ((W - 80) / Math.max(1, maxL)), (H / (c.length + 1)) * (k + 1)]; }));
    let s = `<defs><marker id="f2Arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="f2-arrh"/></marker></defs>`;
    r.pre.forEach((ps, i) => ps.forEach((p) => { const [ax, ay] = pos[p], [bx, by] = pos[i], d = Math.hypot(bx - ax, by - ay) || 1, rr = 20; s += `<line class="f2-edge" x1="${ax + (bx - ax) / d * rr}" y1="${ay + (by - ay) / d * rr}" x2="${bx - (bx - ax) / d * (rr + 2)}" y2="${by - (by - ay) / d * (rr + 2)}" marker-end="url(#f2Arr)"/>`; }));
    const stOf = []; r.rpw.st.forEach((sx, k) => sx.forEach((i) => { stOf[i] = k; }));
    r.ids.forEach((id, i) => { const [x, y] = pos[i]; s += `<g><circle class="f2-node f2-ns${stOf[i] % 5}" cx="${x}" cy="${y}" r="19"><title>${esc(st.tasks[i].n)} – ${r.t[i]} s, RPW station S${stOf[i] + 1}</title></circle><text class="f2-nid" x="${x}" y="${y - 1}" text-anchor="middle">${esc(id)}</text><text class="f2-nt" x="${x}" y="${y + 11}" text-anchor="middle">${r.t[i]}s</text></g>`; });
    $("f2LbGraph").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f2LbGraph").innerHTML = s;
    gantt($("f2LbG1"), r.rpw, r, takt); gantt($("f2LbG2"), r.lcr, r, takt);
    const lcrOf = []; r.lcr.st.forEach((sx, k) => sx.forEach((i) => { lcrOf[i] = k; }));
    const ord = r.ids.map((_, i) => i).sort((a, b) => r.pw[b] - r.pw[a] || (r.ids[a] < r.ids[b] ? -1 : 1));
    $("f2LbPw").innerHTML = `<h3 class="fe-h3">Positional weights (RPW ranking)</h3><div class="fe-scroll"><table class="am-tab"><thead><tr><th>Rank</th><th>Task</th><th>t s</th><th>All following tasks</th><th>Positional weight</th><th>RPW station</th><th>LCR station</th></tr></thead><tbody>
      ${ord.map((i, k) => `<tr><td>${k + 1}</td><td><b>${esc(r.ids[i])}</b> ${esc(st.tasks[i].n)}</td><td>${r.t[i]}</td><td>${[...r.all[i]].map((j) => r.ids[j]).sort().map(esc).join(", ") || "–"}</td><td><b>${fx(r.pw[i], 0)}</b></td><td>S${stOf[i] + 1}</td><td>S${lcrOf[i] + 1}</td></tr>`).join("")}</tbody></table></div>`;
    const a = ord[0], s1 = r.rpw.st[0];
    $("f2LbWx").innerHTML = wx("RPW for the first station", [
      `Positional weight of ${esc(r.ids[a])} = own ${r.t[a]} s + all following tasks (${[...r.all[a]].length}) = <b>${fx(r.pw[a], 0)} s</b> – the largest, so ${esc(r.ids[a])} comes first.`,
      `Station 1 starts with ${fx(takt, 1)} s free. ${s1.map((i) => `${esc(r.ids[i])} (${r.t[i]} s)`).join(" + ")} = ${fx(r.rpw.load[0], 0)} s fit; the next task in the ranking ${(() => { const nx = ord.find((i) => !s1.includes(i)); return nx == null ? "–" : `${esc(r.ids[nx])} (${r.t[nx]} s) ${r.t[nx] > takt - r.rpw.load[0] ? "does not fit in the remaining " + fx(takt - r.rpw.load[0], 1) + " s" : "is not yet available (predecessors open)"}`; })()} → open station 2.`,
      `Result: ${r.kRpw.n} stations; efficiency = ${fx(r.sum, 0)}/(${r.kRpw.n}·${fx(takt, 1)}) = <b>${fx(r.kRpw.eff * 100, 1)} %</b>, balance delay ${fx((1 - r.kRpw.eff) * 100, 1)} %.`]);
    R.line = { ok: true, takt: rnd(takt, 3), sum_t: r.sum, min_stations: r.minSt, positional_weights: Object.fromEntries(r.ids.map((id, i) => [id, r.pw[i]])),
      rpw: { stations: r.kRpw.n, efficiency: rnd(r.kRpw.eff, 4), balance_delay: rnd(1 - r.kRpw.eff, 4), contents: sta(r.rpw), loads: r.rpw.load },
      lcr: { stations: r.kLcr.n, efficiency: rnd(r.kLcr.eff, 4), balance_delay: rnd(1 - r.kLcr.eff, 4), contents: sta(r.lcr), loads: r.lcr.load } };
  };
  sync(); build(); draw();
  $("f2LbTab").addEventListener("input", (e) => { const k = e.target.dataset.k; if (!k) return; const i = +e.target.dataset.i; st.tasks[i][k] = k === "t" ? Math.max(0, num(e.target.value)) : e.target.value; draw(); });
  $("f2LbTab").addEventListener("click", (e) => { const b = e.target.closest("[data-del]"); if (!b) return; st.tasks.splice(+b.dataset.del, 1); build(); draw(); });
  $("f2LbD").addEventListener("input", () => { const v = num($("f2LbD").value); if (v > 0) { st.D = v; draw(); } });
  $("f2LbH").addEventListener("input", () => { const v = num($("f2LbH").value); if (v > 0) { st.H = v; draw(); } });
  $("f2LbAdd").addEventListener("click", () => { let c = 65; while (st.tasks.some((x) => x.id === String.fromCharCode(c))) c++; const l = st.tasks[st.tasks.length - 1]; st.tasks.push({ id: c <= 90 ? String.fromCharCode(c) : "T" + st.tasks.length, n: "New task", t: 20, p: l ? l.id : "" }); build(); draw(); });
  $("f2LbRst").addEventListener("click", () => { st = def(); sync(); build(); draw(); });
}

/* ================================================================== 2L AHP + life-cycle cost */
const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32 };
function ahpCalc(A) {
  const n = A.length, g = A.map((r) => r.reduce((a, b) => a * b, 1) ** (1 / n)), sg = g.reduce((a, b) => a + b, 0), w = g.map((x) => x / sg);
  const Aw = A.map((r) => r.reduce((a, v, j) => a + v * w[j], 0)), lam = Aw.reduce((a, v, i) => a + v / w[i], 0) / n;
  const CI = n > 1 ? (lam - n) / (n - 1) : 0, ri = RI[n] || 1.32, CR = ri ? CI / ri : 0;
  return { g, w, Aw, lam, CI, CR, ri };
}
function lccCalc(L) {
  const r = L.rate, Y = Math.round(L.years), af = Array.from({ length: Y }, (_, t) => 1 / (1 + r) ** (t + 1)).reduce((a, b) => a + b, 0);
  return L.cands.map(([n, P, I, kW, mp, tool, res]) => {
    const en = kW * L.hours * L.price, ma = mp * P;
    const pvE = en * af, pvM = ma * af, pvT = tool * af, pvR = res / (1 + r) ** Y;
    return { n, P, I, en, ma, tool, res, pvE, pvM, pvT, pvR, af, lcc: P + I + pvE + pvM + pvT - pvR };
  });
}
function html2L() {
  return card("f22L", "2L · Decision – AHP weights with consistency check + life-cycle cost (LCC)", "pairwise judgements → weights → ranking · net present value of all costs over the machine life",
    guide({
      principle: `<p><b>AHP</b> (Analytic Hierarchy Process, Saaty 1980): instead of guessing weights, the team compares the criteria in pairs on the scale
        1 = equal, 3 = moderately more important, 5 = strongly, 7 = very strongly, 9 = extremely (2, 4, 6, 8 between; reciprocal values the other way round).
        The weights come from the matrix; the <b>consistency ratio</b> CR shows whether the judgements contradict each other (A &gt; B, B &gt; C but C &gt; A).</p>
        <p class="phd-eq">w_i = (Π_j a_ij)^(1/n) / Σ_k (Π_j a_kj)^(1/n) · λ_max = mean_i (A·w)_i / w_i · CI = (λ_max − n)/(n − 1) · CR = CI/RI(n), RI(3) = 0.58, RI(4) = 0.90, RI(5) = 1.12 · CR &lt; 0.10 acceptable<br>score_alt = Σ_k w_k·s_alt,k</p>
        <p><b>LCC</b>: the purchase price is often less than half of the money a machine costs over its life. Bring all future costs to today with the discount rate r:</p>
        <p class="phd-eq">LCC = purchase + installation + Σ_(t=1..N) (energy_t + maintenance_t + tooling_t)/(1+r)^t − residual/(1+r)^N · energy_t = kW_avg·hours·price · maintenance_t = maint_%·purchase</p>`,
      uses: USES.L,
      howto: ["Fix the criteria and do the pairwise comparison in a workshop BEFORE the offers are opened; record the matrix in the project file.",
        "If CR ≥ 0.10, find the pair with the largest contradiction (largest a_ij·w_j/w_i far from 1) and discuss it again.",
        "Score each offer 1–10 per criterion with evidence (test cut, reference visit, datasheet) – not by impression.",
        "Ask every supplier for the same LCC inputs: average power in YOUR cycle, maintenance contract price, tooling, expected residual value.",
        "Present both results together: AHP = how good, LCC = how expensive. If they disagree, show the sensitivity (change one weight or the rate)."],
    }) + `
    <div class="grid2 eq">
      <div><h3 class="fe-h3">Pairwise comparison matrix <span class="sub">row is … times as important as column; the mirror cell is set to 1/x</span></h3>
        <div class="fe-row"><button class="mx-el" id="f2AhpRst">Reset to example</button></div>
        <div class="fe-scroll"><table class="am-tab fe-calc f2-ahp" id="f2AhpTab"></table></div><div id="f2AhpRes"></div></div>
      <div><h3 class="fe-h3">Alternatives – scores 1…10 per criterion</h3><div class="fe-scroll"><table class="am-tab fe-calc f2-ahp" id="f2AltTab"></table></div><div id="f2AltRes"></div></div>
    </div>
    <div id="f2AhpWx"></div>
    <h3 class="fe-h3">Life-cycle cost</h3>
    <div class="fe-row fe-calc"><label>Years N <input type="number" id="f2LcY" min="1" max="40" step="1"></label><label>Rate r <input type="number" id="f2LcR" min="0" max="0.5" step="0.01"></label>
      <label>Hours / year <input type="number" id="f2LcH" min="0" step="100"></label><label>Energy price <input type="number" id="f2LcP" min="0" step="0.01"> €/kWh</label><button class="mx-el" id="f2LcRst">Reset to example</button></div>
    <div class="fe-scroll"><table class="am-tab fe-calc f2-lcc" id="f2LcTab"></table></div>
    <div class="grid2 eq"><div id="f2LcRes"></div><div><svg id="f2LcChart" class="fe-chart" role="img" aria-label="LCC per candidate"></svg><div class="sub" id="f2LcLg"></div></div></div>
    <div id="f2Dec"></div>`);
}
function init2L() {
  const AH = EX2.ahp;
  const def = () => ({ A: clone(AH.pairwise), alts: clone(AH.alternatives) });
  let st = store.get("ahp", def());
  const crit = AH.criteria, n = crit.length;
  const fmtA = (v) => (v >= 1 ? String(+v.toFixed(3)) : `1/${+(1 / v).toFixed(2)}`);
  const build = () => {
    $("f2AhpTab").innerHTML = `<thead><tr><th></th>${crit.map((c) => `<th>${esc(c)}</th>`).join("")}<th>geo. mean</th><th>weight</th></tr></thead><tbody>
      ${crit.map((c, i) => `<tr><td><b>${esc(c)}</b></td>${crit.map((_, j) => `<td>${i === j ? "1" : `<input type="number" min="0.111" max="9" step="any" data-a="${i},${j}" value="${+(+st.A[i][j]).toFixed(6)}" title="${fmtA(+st.A[i][j])}">`}</td>`).join("")}<td id="f2Ag${i}"></td><td id="f2Aw${i}"></td></tr>`).join("")}</tbody>`;
    $("f2AltTab").innerHTML = `<thead><tr><th>Alternative</th>${crit.map((c) => `<th>${esc(c)}</th>`).join("")}<th>Score</th></tr></thead><tbody>
      ${st.alts.map((a, k) => `<tr><td><b>${esc(a[0])}</b></td>${a[1].map((v, j) => `<td><input type="number" min="1" max="10" step="any" data-s="${k},${j}" value="${v}"></td>`).join("")}<td id="f2AlS${k}"></td></tr>`).join("")}</tbody>`;
  };
  const draw = () => {
    store.set("ahp", st);
    const r = ahpCalc(st.A);
    r.g.forEach((g, i) => { $("f2Ag" + i).textContent = fx(g, 4); $("f2Aw" + i).innerHTML = `<b>${fx(r.w[i] * 100, 1)} %</b>`; });
    const okc = r.CR < 0.1;
    $("f2AhpRes").innerHTML = `<p class="phd-eq">λ_max = ${fx(r.lam, 4)} · CI = (${fx(r.lam, 4)} − ${n})/${n - 1} = ${fx(r.CI, 4)} · CR = ${fx(r.CI, 4)}/${r.ri} = <b>${fx(r.CR, 4)}</b></p>
      <p>${ok(okc, `CR ${fx(r.CR, 3)} &lt; 0.10 – the judgements are consistent`, `CR ${fx(r.CR, 3)} ≥ 0.10 – judgements contradict each other; review the pairs`)}</p>`;
    const sc = st.alts.map((a) => ({ n: a[0], s: a[1].reduce((acc, v, j) => acc + r.w[j] * num(v), 0) }));
    sc.forEach((x, k) => { $("f2AlS" + k).innerHTML = `<b>${fx(x.s, 3)}</b>`; });
    const rank = [...sc].sort((a, b) => b.s - a.s);
    $("f2AltRes").innerHTML = `<div class="f2-hbars">${rank.map((x) => `<div class="f2-hb"><span>${esc(x.n)}</span><i style="width:${Math.max(2, x.s * 10)}%"></i><b>${fx(x.s, 2)}</b></div>`).join("")}</div>
      <p>Ranking: ${rank.map((x, k) => `${k + 1}. <b>${esc(x.n)}</b> (${fx(x.s, 2)})`).join(" · ")}${rank.length > 1 && rank[0].s - rank[1].s < 0.3 ? ' <span class="fe-no">– less than 0.3 points apart: not robust</span>' : ""}</p>`;
    const a0 = st.A[0];
    $("f2AhpWx").innerHTML = wx("weights and consistency of the example matrix", [
      `Row 1 (${esc(crit[0])}): geometric mean = (${a0.map((v) => fx(+v, 3)).join("·")})^(1/${n}) = <b>${fx(r.g[0], 4)}</b>; sum of all geometric means = ${fx(r.g.reduce((a, b) => a + b, 0), 4)} → w₁ = <b>${fx(r.w[0], 4)}</b>.`,
      `Weights: ${crit.map((c, i) => `${esc(c)} ${fx(r.w[i], 4)}`).join(", ")}.`,
      `(A·w)₁ = ${a0.map((v, j) => `${fx(+v, 3)}·${fx(r.w[j], 4)}`).join(" + ")} = ${fx(r.Aw[0], 4)} → (A·w)₁/w₁ = ${fx(r.Aw[0] / r.w[0], 4)}; mean over all rows λ_max = ${fx(r.lam, 4)}.`,
      `CI = ${fx(r.CI, 5)}, RI(${n}) = ${r.ri}, CR = <b>${fx(r.CR, 4)}</b> → ${okc ? "acceptable" : "not acceptable"}.`,
      `Score ${esc(sc[0].n)} = ${st.alts[0][1].map((v, j) => `${fx(r.w[j], 3)}·${v}`).join(" + ")} = <b>${fx(sc[0].s, 3)}</b>.`]);
    R.ahp = { weights: Object.fromEntries(crit.map((c, i) => [c, rnd(r.w[i], 4)])), lambda_max: rnd(r.lam, 4), CI: rnd(r.CI, 5), CR: rnd(r.CR, 5), consistent: okc, scores: Object.fromEntries(sc.map((x) => [x.n, rnd(x.s, 4)])), ranking: rank.map((x) => x.n) };
    decide();
  };
  build(); draw();
  $("f2AhpTab").addEventListener("input", (e) => {
    const t = e.target; if (!t.dataset.a) return; const [i, j] = t.dataset.a.split(",").map(Number); const v = num(t.value);
    if (!(v > 0)) return; const vv = Math.min(9, Math.max(1 / 9, v));
    st.A[i][j] = vv; st.A[j][i] = 1 / vv; const m = document.querySelector(`#f2AhpTab [data-a="${j},${i}"]`); if (m) { m.value = +(1 / vv).toFixed(6); m.title = fmtA(1 / vv); } t.title = fmtA(vv);
    draw();
  });
  $("f2AltTab").addEventListener("input", (e) => { const t = e.target; if (!t.dataset.s) return; const [k, j] = t.dataset.s.split(",").map(Number); st.alts[k][1][j] = Math.min(10, Math.max(0, num(t.value))); draw(); });
  $("f2AhpRst").addEventListener("click", () => { st = def(); build(); draw(); });

  const LC = EX2.lcc;
  const ldef = () => ({ years: LC.years, rate: LC.rate, hours: LC.hours_per_year, price: LC.energy_EUR_kWh, cands: clone(LC.candidates) });
  let lc = store.get("lcc", ldef());
  const lcols = [["Purchase €", 1, 1000], ["Installation €", 2, 1000], ["Avg. power kW", 3, 0.5], ["Maint. share / year", 4, 0.005], ["Tooling €/year", 5, 500], ["Residual € (year N)", 6, 1000]];
  const lsync = () => { $("f2LcY").value = lc.years; $("f2LcR").value = lc.rate; $("f2LcH").value = lc.hours; $("f2LcP").value = lc.price; };
  const lbuild = () => {
    $("f2LcTab").innerHTML = `<thead><tr><th>Candidate</th>${lcols.map((c) => `<th>${c[0]}</th>`).join("")}<th>PV energy</th><th>PV maint.</th><th>PV tooling</th><th>PV residual</th><th>LCC</th></tr></thead><tbody>
      ${lc.cands.map((c, k) => `<tr><td><b>${esc(c[0])}</b></td>${lcols.map(([, j, s]) => `<td><input type="number" min="0" step="${s}" data-l="${k},${j}" value="${c[j]}"></td>`).join("")}<td id="f2Le${k}"></td><td id="f2Lm${k}"></td><td id="f2Lt${k}"></td><td id="f2Lr${k}"></td><td id="f2Ll${k}"></td></tr>`).join("")}</tbody>`;
  };
  const ldraw = () => {
    store.set("lcc", lc);
    const r = lccCalc(lc);
    r.forEach((x, k) => { $("f2Le" + k).textContent = eur(x.pvE); $("f2Lm" + k).textContent = eur(x.pvM); $("f2Lt" + k).textContent = eur(x.pvT); $("f2Lr" + k).textContent = "− " + eur(x.pvR); $("f2Ll" + k).innerHTML = `<b>${eur(x.lcc)}</b>`; });
    const rank = [...r].sort((a, b) => a.lcc - b.lcc), b0 = rank[0];
    $("f2LcRes").innerHTML = `<p class="fe-big">Lowest LCC: <b>${esc(b0.n)}</b> ${eur(b0.lcc)}</p>
      <p>Ranking: ${rank.map((x, k) => `${k + 1}. ${esc(x.n)} ${eur(x.lcc)}${k ? ` (+${eur(x.lcc - b0.lcc)})` : ""}`).join(" · ")}</p>
      <p class="phd-eq">annuity factor Σ 1/(1+${lc.rate})^t, t = 1…${lc.years} = <b>${fx(b0.af, 4)}</b> · ${esc(b0.n)}: energy ${lc.cands.find((c) => c[0] === b0.n)[3]}·${lc.hours}·${lc.price} = ${eur(b0.en)}/year, maintenance ${eur(b0.ma)}/year, tooling ${eur(b0.tool)}/year</p>
      <p class="sub">The cheapest purchase price (${esc([...r].sort((a, b) => a.P - b.P)[0].n)}) is ${[...r].sort((a, b) => a.P - b.P)[0].n === b0.n ? "also" : "not"} the cheapest over ${lc.years} years. Running costs = ${fx((b0.pvE + b0.pvM + b0.pvT) / b0.lcc * 100, 0)} % of the LCC of ${esc(b0.n)}.</p>`;
    const W = 560, rowH = 46, H = 40 + r.length * rowH, x0 = 90, x1 = W - 70, mx = Math.max(...r.map((x) => x.P + x.I + x.pvE + x.pvM + x.pvT)) * 1.02, X = (v) => x0 + v / mx * (x1 - x0);
    let s = "";
    for (let k = 0; k <= 4; k++) { const v = mx * k / 4; s += `<line class="fe-grid" x1="${X(v)}" x2="${X(v)}" y1="8" y2="${H - 24}"/><text class="fe-tick" x="${X(v)}" y="${H - 8}" text-anchor="middle">${fx(v / 1000, 0)}k€</text>`; }
    r.forEach((x, k) => {
      const y = 12 + k * rowH; let acc = 0;
      s += `<text class="fe-tick f2-pl" x="${x0 - 8}" y="${y + rowH / 2}" text-anchor="end">${esc(x.n)}</text>`;
      [[x.P + x.I, "f2-c1"], [x.pvE, "f2-c2"], [x.pvM, "f2-c3"], [x.pvT, "f2-c4"]].forEach(([v, c]) => { s += `<rect class="f2-stk ${c}" x="${X(acc)}" y="${y}" width="${Math.max(0, X(acc + v) - X(acc))}" height="${rowH - 18}"><title>${eur(v)}</title></rect>`; acc += v; });
      s += `<rect class="f2-stk f2-c5" x="${X(acc - x.pvR)}" y="${y + rowH - 16}" width="${X(acc) - X(acc - x.pvR)}" height="6"><title>residual − ${eur(x.pvR)}</title></rect><text class="f2-plab" x="${X(acc) + 4}" y="${y + rowH / 2 - 2}">${fx(x.lcc / 1000, 0)}k€</text>`;
    });
    $("f2LcChart").setAttribute("viewBox", `0 0 ${W} ${H}`); $("f2LcChart").innerHTML = s;
    $("f2LcLg").innerHTML = [["f2-c1", "purchase + installation"], ["f2-c2", "PV energy"], ["f2-c3", "PV maintenance"], ["f2-c4", "PV tooling"], ["f2-c5", "minus PV residual (thin bar)"]].map(([c, l]) => `<span class="fx-lg"><i class="f2-lg ${c}"></i>${l}</span>`).join("");
    R.lcc = { annuity_factor: rnd(b0.af, 5), candidates: Object.fromEntries(r.map((x) => [x.n, { pv_energy: rnd(x.pvE, 2), pv_maint: rnd(x.pvM, 2), pv_tooling: rnd(x.pvT, 2), pv_residual: rnd(x.pvR, 2), lcc: rnd(x.lcc, 2) }])), ranking: rank.map((x) => x.n) };
    decide();
  };
  lsync(); lbuild(); ldraw();
  $("f2LcTab").addEventListener("input", (e) => { const t = e.target; if (!t.dataset.l) return; const [k, j] = t.dataset.l.split(",").map(Number); lc.cands[k][j] = Math.max(0, num(t.value)); ldraw(); });
  [["f2LcY", "years"], ["f2LcR", "rate"], ["f2LcH", "hours"], ["f2LcP", "price"]].forEach(([id, k]) => $(id).addEventListener("input", () => { const v = num($(id).value, NaN); if (Number.isFinite(v) && v >= 0 && (k !== "years" || v >= 1)) { lc[k] = v; ldraw(); } }));
  $("f2LcRst").addEventListener("click", () => { lc = ldef(); lsync(); lbuild(); ldraw(); });

  function decide() {
    if (!R.ahp || !R.lcc || !$("f2Dec")) return;
    const a = R.ahp.ranking[0], l = R.lcc.ranking[0], la = R.lcc.candidates[a], ll = R.lcc.candidates[l];
    const txt = a === l
      ? `<span class="fe-ok">AHP and LCC agree: <b>${esc(a)}</b></span> is the best technical / organisational choice (score ${fx(R.ahp.scores[a], 2)}) and has the lowest life-cycle cost (${eur(ll.lcc)}). Recommendation: negotiate with ${esc(a)}; keep the second (${esc(R.ahp.ranking[1])}) as fallback.`
      : `AHP prefers <b>${esc(a)}</b> (score ${fx(R.ahp.scores[a], 2)}), LCC prefers <b>${esc(l)}</b> (${eur(ll.lcc)}). The AHP winner costs ${la ? eur(la.lcc - ll.lcc) : "–"} more over the life. Decide whether its advantage in the criteria is worth this money – or negotiate the price / service of ${esc(a)} down.`;
    $("f2Dec").innerHTML = `<div class="fx-box f2-dec"><h4>Combined decision</h4><p>${txt}</p><p class="sub">${R.ahp.consistent ? "The AHP weights are consistent (CR < 0.10)." : "<b>Warning:</b> the AHP judgements are not consistent – fix them before you decide."} Note: the AHP criterion "Life-cycle cost" is scored 1–10; use the LCC table to give these scores (lowest LCC = best score) so both parts tell the same story.</p></div>`;
    R.decision = { ahp_best: a, lcc_best: l, agree: a === l };
  }
}

/* ================================================================== 2M machine catalogue */
function html2M() {
  return card("f22M", "2M · Machine catalogue – what to specify, typical ranges, datasheet checks, makers", "choose a machine type · parameters become the skeleton of your RFQ / URS",
    guide({
      principle: `<p>Machine selection starts with the <b>process</b> (2B, 2H), the <b>time</b> (2C, 2I) and the <b>capacity</b> (2J). Only then you choose the machine type and write
        the specification. For each type the same few parameters decide: working envelope and load (does the part fit?), spindle / force / power (can it cut / press / bend?),
        accuracy (does it reach the tolerance with Cpk ≥ 1.33?), automation and data interfaces (can it work in the FMS?), and service.</p>
        <p class="fx-alert">Ranges are typical values for orientation, makers are examples (the order is not a ranking), prices are rough estimates
        – <b>always ask for a quote</b>. No model numbers are given on purpose: models change every few years; ask the makers for their current range.</p>`,
      uses: USES.M,
      howto: ["Choose the machine type with the process chain (2H) and the part family (2A / 2G).",
        "Copy the parameter list (CSV button) into the URS / RFQ and fill in YOUR required values – never send a blank list.",
        "Ask 3–5 makers for an offer with the same parameter table + your part drawings + yearly volume → they offer the cycle time.",
        "Use the datasheet checks during the offer comparison and the reference visits; put the critical ones into the acceptance tests (FAT / SAT).",
        "Score the offers with 2E or AHP + LCC (2L)."],
    }) + `
    <div class="mx-nav f2-mnav" id="f2MNav">${MACH.map((m, i) => `<button class="mx-el${i ? "" : " active"}" data-m="${i}">${esc(m.n.replace(/ \(.*\)$/, ""))}</button>`).join("")}</div>
    <div id="f2MDet"></div>
    <details class="fx-more"><summary><b>Overview – all machine types</b></summary><div class="fe-scroll"><table class="am-tab"><thead><tr><th>Type</th><th>Typical use</th><th>Makers (examples)</th><th>Price class (estimate – ask for a quote)</th></tr></thead>
      <tbody>${MACH.map((m) => `<tr><td><b>${esc(m.n)}</b></td><td>${esc(m.use)}</td><td>${esc(m.makers)}</td><td>${esc(m.price)}</td></tr>`).join("")}</tbody></table></div></details>`);
}
function init2M() {
  let sel = Math.min(MACH.length - 1, Math.max(0, num(store.get("mach", 0))));
  const draw = () => {
    store.set("mach", sel);
    document.querySelectorAll("#f2MNav [data-m]").forEach((b) => b.classList.toggle("active", +b.dataset.m === sel));
    const m = MACH[sel];
    $("f2MDet").innerHTML = `<div class="grid2 eq"><div><h3 class="fe-h3">${esc(m.n)}</h3><p>${esc(m.use)}</p>
        <div class="fe-scroll"><table class="am-tab"><thead><tr><th>Parameter to specify</th><th>Typical range</th><th>Your value</th></tr></thead><tbody>
        ${m.params.map(([p, r], i) => `<tr><td><b>${esc(p)}</b></td><td>${esc(r)}</td><td><input class="f2-wn f2-mv" data-p="${i}" placeholder="required value"></td></tr>`).join("")}</tbody></table></div>
        <div class="fe-row"><button class="mx-el" id="f2MCsv">Export RFQ table (CSV)</button></div></div>
      <div><h3 class="fe-h3">Check in the datasheet / offer</h3>${ul(m.check.map(esc))}
        <table class="am-kv"><tbody><tr><td>Makers (examples)</td><td>${esc(m.makers)}</td></tr><tr><td>Price class</td><td>${esc(m.price)}</td></tr></tbody></table></div></div>`;
    const vals = store.get("machv." + m.k, {});
    document.querySelectorAll("#f2MDet .f2-mv").forEach((inp) => { inp.value = vals[inp.dataset.p] || ""; inp.addEventListener("input", () => { vals[inp.dataset.p] = inp.value; store.set("machv." + m.k, vals); }); });
    $("f2MCsv").addEventListener("click", () => download(`rfq_${m.k}.csv`, toCSV([["Machine type", m.n], [], ["Parameter", "Typical range", "Required value"], ...m.params.map(([p, r], i) => [p, r, vals[i] || ""]), [], ["Checks"], ...m.check.map((c) => [c])]), "text/csv"));
    R.machine = { selected: m.n, types: MACH.length };
  };
  $("f2MNav").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { sel = +b.dataset.m; draw(); } });
  draw();
}
