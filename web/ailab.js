/* AI tab – item 3 "Live AI labs": five small, real AI / optimisation algorithms that run offline in the browser.
 *   pdm    predictive maintenance – logistic regression trained by gradient descent
 *   vision visual inspection     – feature extraction + small neural network (MLP, SGD)
 *   opt    cutting-data optimisation – grid / random / surrogate (Bayesian-style) / Nelder–Mead search
 *   fc     demand forecasting     – moving average / Holt-Winters / regression with features
 *   rag    search assistant       – TF-IDF retrieval over the standards library (the "R" of RAG)
 * All data are SIMULATED examples. Pure JS, no libraries. Export: mountLab(host). Deep link ?ailab=pdm|vision|opt|fc|rag */
import { ROWS } from "./std_data.js";
import { EXTRA, EXPLAIN } from "./std_extra.js";

const Q = new URLSearchParams(location.search);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x) => (+x).toFixed(1), f2 = (x) => (+x).toFixed(2), f0 = (x) => Math.round(x).toLocaleString("en-US");
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gaussOf = (r) => () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const sig = (z) => 1 / (1 + Math.exp(-z));

/* ---------- shared UI pieces ---------- */
function explain(rows) { return `<table class="am-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`; }
function learn(items) { return `<div class="card"><div class="card-head"><h2>What you learn</h2></div><ul>${items.map((x) => `<li>${x}</li>`).join("")}</ul><p class="am-note">All data in this lab are simulated examples – the method is real, the numbers are not from your factory.</p></div>`; }
function kpis(list) { return `<div class="kpis">${list.map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n || ""}</div></div>`).join("")}</div>`; }
function confusion(names, M) {
  return `<table class="am-tab"><thead><tr><th>true ↓ / predicted →</th>${names.map((n) => `<th>${n}</th>`).join("")}</tr></thead><tbody>${M.map((row, i) =>
    `<tr><td><b>${names[i]}</b></td>${row.map((v, j) => `<td style="${i === j ? "font-weight:700" : v ? "color:var(--critical);font-weight:600" : "color:var(--muted)"}">${v}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
/* simple line chart: series = [{pts:[[x,y]], dash, strong, label}] */
function lineChart(series, o) {
  const W = o.w || 520, H = o.h || 220, L = 48, R = 12, T = 12, B = 30;
  const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
  const x0 = o.x0 ?? Math.min(...xs), x1 = o.x1 ?? Math.max(...xs), y0 = o.y0 ?? Math.min(0, ...ys), y1 = o.y1 ?? (Math.max(...ys) * 1.05 || 1);
  const sx = (x) => L + (x - x0) / (x1 - x0 || 1) * (W - L - R), sy = (y) => H - B - (y - y0) / (y1 - y0 || 1) * (H - T - B);
  let g = "";
  for (let i = 0; i <= 4; i++) { const y = y0 + (y1 - y0) * i / 4; g += `<line x1="${L}" y1="${sy(y)}" x2="${W - R}" y2="${sy(y)}" class="am-grid"/><text x="${L - 6}" y="${sy(y) + 4}" text-anchor="end" class="am-s">${Math.abs(y) >= 100 ? f0(y) : f2(y)}</text>`; }
  g += `<text x="${(L + W) / 2}" y="${H - 6}" text-anchor="middle" class="am-s">${o.xl || ""}</text>`;
  (o.marks || []).forEach((m) => { g += `<line x1="${sx(m.x)}" y1="${T}" x2="${sx(m.x)}" y2="${H - B}" stroke="var(--axis)" stroke-dasharray="4 3"/><text x="${sx(m.x) + 4}" y="${T + 34}" class="am-s">${m.t}</text>`; });
  series.forEach((s) => { g += `<polyline fill="none" stroke="${s.strong ? "var(--series)" : "var(--text-2)"}" stroke-width="${s.strong ? 2.2 : 1.6}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} points="${s.pts.map((p) => `${sx(p[0])},${sy(p[1])}`).join(" ")}"/>`; });
  const leg = series.filter((s) => s.label).map((s, i) => `<g transform="translate(${L + 8 + (series.length > 3 ? (i % 2) * 175 : i * 130)},${T + 4 + (series.length > 3 ? Math.floor(i / 2) * 14 : 0)})"><line x1="0" y1="0" x2="22" y2="0" stroke="${s.strong ? "var(--series)" : "var(--text-2)"}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/><text x="26" y="4" class="am-s">${esc(s.label)}</text></g>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}${leg}</svg>`;
}
function bars(items, o = {}) { // horizontal bars for signed values
  const W = 560, rh = 24, L = 170, H = items.length * rh + 8, m = Math.max(...items.map((i) => Math.abs(i[1])), 1e-9), mid = L + (W - L) / 2, sc = (W - L) / 2 - 30;
  return `<svg viewBox="0 0 ${W} ${H}" class="am-svgc"><line x1="${mid}" y1="0" x2="${mid}" y2="${H}" class="am-grid"/>${items.map(([n, v], i) => { const w = v / m * sc, y = 4 + i * rh;
    return `<text x="${L - 6}" y="${y + 14}" text-anchor="end" class="am-s">${esc(n)}</text><rect x="${Math.min(mid, mid + w)}" y="${y + 4}" width="${Math.abs(w)}" height="14" rx="3" fill="var(--series)" opacity="${v >= 0 ? 1 : 0.5}"/><text x="${mid + w + (w >= 0 ? 4 : -4)}" y="${y + 15}" text-anchor="${w >= 0 ? "start" : "end"}" class="am-s">${o.fmt ? o.fmt(v) : f2(v)}</text>`; }).join("")}</svg>`;
}

/* =====================================================================================  1  PREDICTIVE MAINTENANCE */
const PDM = { N: 400, seed: 7, th: 0.5, model: null };
const FEAT = ["RMS vibration (mm/s)", "Kurtosis", "Bearing temp. (°C)", "BPFO band energy (g)"];
function pdmData(N, seed) {
  const r = rng(seed), g = gaussOf(r), D = [];
  for (let i = 0; i < N; i++) {
    const y = r() < 0.3 ? 1 : 0; // 30 % of runs: outer-race damage is developing
    D.push({ y, x: [Math.max(0.3, y ? 3.1 + 1.3 * g() : 2.1 + 0.8 * g()), Math.max(1.5, y ? 4.1 + 1.1 * g() : 3.0 + 0.5 * g()), y ? 51 + 6 * g() : 46 + 5 * g(), Math.max(0.02, y ? 0.85 + 0.4 * g() : 0.38 + 0.2 * g())] });
  }
  return D;
}
function pdmTrain() {
  const D = pdmData(PDM.N, PDM.seed), nTr = Math.round(D.length * 0.7), tr = D.slice(0, nTr), te = D.slice(nTr);
  const mu = [0, 1, 2, 3].map((j) => tr.reduce((s, d) => s + d.x[j], 0) / tr.length);
  const sd = [0, 1, 2, 3].map((j) => Math.sqrt(tr.reduce((s, d) => s + (d.x[j] - mu[j]) ** 2, 0) / tr.length) || 1);
  const z = (x) => x.map((v, j) => (v - mu[j]) / sd[j]);
  let w = [0, 0, 0, 0], b = 0; const loss = [], lr = 0.4;
  for (let ep = 0; ep < 150; ep++) { // gradient descent on the log-loss
    const gw = [0, 0, 0, 0]; let gb = 0, L = 0;
    tr.forEach((d) => { const zx = z(d.x), p = sig(zx.reduce((s, v, j) => s + v * w[j], b)); const e = p - d.y; zx.forEach((v, j) => (gw[j] += e * v)); gb += e; L += -(d.y * Math.log(p + 1e-9) + (1 - d.y) * Math.log(1 - p + 1e-9)); });
    w = w.map((v, j) => v - lr * gw[j] / tr.length); b -= lr * gb / tr.length; loss.push([ep + 1, L / tr.length]);
  }
  te.forEach((d) => (d.p = sig(z(d.x).reduce((s, v, j) => s + v * w[j], b))));
  PDM.model = { w, b, mu, sd, loss, te, nTr };
}
function pdmEval(te, pred) { let TP = 0, FP = 0, TN = 0, FN = 0; te.forEach((d) => { const p = pred(d); if (p && d.y) TP++; else if (p) FP++; else if (d.y) FN++; else TN++; }); return { TP, FP, TN, FN, acc: (TP + TN) / te.length, prec: TP / (TP + FP || 1), rec: TP / (TP + FN || 1), cost: FP * 150 + FN * 18000 }; }
function pdmRender(el) {
  if (!PDM.model) pdmTrain();
  const m = PDM.model, te = m.te, ev = pdmEval(te, (d) => d.p >= PDM.th), rule = pdmEval(te, (d) => d.x[0] > 4.5);
  let best = { th: 0.5, cost: 1e18 }; for (let t = 0.02; t < 0.99; t += 0.01) { const c = pdmEval(te, (d) => d.p >= t).cost; if (c < best.cost) best = { th: t, cost: c }; }
  // scatter RMS vs BPFO + decision line (other features at their mean, i.e. z = 0)
  const W = 460, H = 300, L = 48, B = 34, T = 10, R = 10, sx = (v) => L + (v / 8) * (W - L - R), sy = (v) => H - B - (v / 2.2) * (H - T - B);
  const logit = Math.log(PDM.th / (1 - PDM.th)), line = [];
  for (let rms = 0; rms <= 8; rms += 0.25) { const zr = (rms - m.mu[0]) / m.sd[0], zb = (logit - m.b - m.w[0] * zr) / m.w[3], bp = zb * m.sd[3] + m.mu[3]; if (bp >= 0 && bp <= 2.2) line.push(`${sx(rms)},${sy(bp)}`); }
  let sc = ""; for (let v = 0; v <= 8; v += 2) sc += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${H - B}" class="am-grid"/><text x="${sx(v)}" y="${H - B + 14}" text-anchor="middle" class="am-s">${v}</text>`;
  for (let v = 0; v <= 2; v += 0.5) sc += `<line x1="${L}" y1="${sy(v)}" x2="${W - R}" y2="${sy(v)}" class="am-grid"/><text x="${L - 6}" y="${sy(v) + 4}" text-anchor="end" class="am-s">${v}</text>`;
  sc += `<line x1="${sx(4.5)}" y1="${T}" x2="${sx(4.5)}" y2="${H - B}" stroke="var(--warning)" stroke-dasharray="5 3"/><text x="${sx(4.5) + 4}" y="${T + 12}" class="am-s">rule RMS > 4.5</text>`;
  te.forEach((d) => { const x = sx(Math.min(8, d.x[0])), y = sy(Math.min(2.2, d.x[3])); sc += d.y ? `<circle cx="${x}" cy="${y}" r="3.4" fill="var(--critical)" stroke="var(--surface)" stroke-width="1"/>` : `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="var(--series)" stroke-width="1.3"/>`; });
  if (line.length > 1) sc += `<polyline points="${line.join(" ")}" fill="none" stroke="var(--text)" stroke-width="2"/>`;
  sc += `<text x="${(L + W) / 2}" y="${H - 4}" text-anchor="middle" class="am-s">RMS vibration (mm/s)</text><text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle" class="am-s">BPFO band energy (g)</text>`;
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>Lab 1 · Predictive maintenance – spindle bearing damage</h2><span class="sub">logistic regression, trained here in your browser</span></div>
    ${explain([["Factory problem", "A spindle bearing fails → crash, scrap, 2–5 days down, ≈ € 18 000. We want to see the damage <b>weeks before</b> and plan the repair (SCADA + HMC build tabs)."],
      ["Data", `${PDM.N} simulated spindle runs, 4 features from a vibration sensor + temperature. 30 % have a developing outer-race damage. 70 % train / 30 % test.`],
      ["Algorithm", "Logistic regression: p(damage) = 1 / (1 + e<sup>−(w·x + b)</sup>). Gradient descent changes w and b step by step to make the log-loss smaller (curve below)."],
      ["What to look at", "Move the threshold: low threshold = more false alarms (inspection € 150 each), high threshold = more missed failures (€ 18 000 each). The best threshold is where the total cost is lowest."],
      ["Honest limits", "Real damage data are rare: you need months of sensor history WITH known failures (labels). Start with simple limits (ISO 20816 style) + trend, collect data, then train."]])}
    <div class="am-filt"><button class="btn primary" data-a="train">Train again</button><button class="btn" data-a="new">New data</button>
      <span class="sub">Data size:</span>${[100, 400, 1600].map((n) => `<button class="chip ${n === PDM.N ? "am-sel" : ""}" data-n="${n}">${n} runs</button>`).join("")}
      <span class="sub" style="margin-left:12px">Threshold ${f2(PDM.th)}</span><input type="range" min="0.02" max="0.98" step="0.01" value="${PDM.th}" data-a="th" style="width:200px"></div>
    ${kpis([["Test accuracy", (ev.acc * 100).toFixed(0) + " %", `${te.length} test runs`], ["Precision", (ev.prec * 100).toFixed(0) + " %", "alarms that were real"], ["Recall", (ev.rec * 100).toFixed(0) + " %", "damages found"],
      ["Cost on test set", "€ " + f0(ev.cost), `best threshold ${f2(best.th)} → € ${f0(best.cost)}`], ["Simple rule RMS > 4.5", "€ " + f0(rule.cost), `recall ${(rule.rec * 100).toFixed(0)} % – sees only late damage`]])}
    <div class="grid2 eq"><div><h3>Test runs: RMS vs BPFO energy</h3><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${sc}</svg>
        <p class="am-note">● filled = damaged, ○ hollow = healthy. Black line = model decision border at this threshold (other features at their mean). Dashed = classic single limit.</p></div>
      <div><h3>Confusion matrix (model)</h3>${confusion(["healthy", "damage"], [[ev.TN, ev.FP], [ev.FN, ev.TP]])}
        <h3>Learning curve (log-loss per epoch)</h3>${lineChart([{ pts: m.loss, strong: true }], { h: 160, xl: "epoch" })}
        <h3>Feature weights (standardised)</h3>${bars(FEAT.map((n, j) => [n, m.w[j]]))}</div></div></div>
  ${learn(["A model learns weights from labelled examples – no labels, no learning.", "The threshold is a <b>business decision</b> (cost of false alarm vs missed failure), not a technical one.", "Combining several features (BPFO energy + kurtosis) finds damage much earlier than one RMS limit. More data → more stable model."])}`;
  el.onclick = (e) => { const t = e.target; if (t.dataset.a === "train") { pdmTrain(); pdmRender(el); } if (t.dataset.a === "new") { PDM.seed = 1 + Math.floor(Math.random() * 9999); pdmTrain(); pdmRender(el); } if (t.dataset.n) { PDM.N = +t.dataset.n; pdmTrain(); pdmRender(el); } };
  el.oninput = (e) => { if (e.target.dataset.a === "th") { PDM.th = +e.target.value; pdmRender(el); el.querySelector('[data-a="th"]').focus(); } };
}

/* =====================================================================================  2  VISUAL INSPECTION */
const CLS = ["OK", "scratch", "porosity", "chatter"], S = 24;
const VIS = { seed: 3, net: null, test: [], live: null };
function makeImg(c, r) {
  const g = gaussOf(r), ph = r() * 6.28, img = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img[y * S + x] = 0.62 + 0.07 * Math.sin(x * 0.95 + ph) + 0.045 * g(); // vertical turning marks + noise
  if (c === 1) { const a = r() * Math.PI, cx = 6 + r() * 12, cy = 6 + r() * 12, len = 8 + r() * 10; for (let t = -len; t <= len; t += 0.4) { const x = Math.round(cx + t * Math.cos(a)), y = Math.round(cy + t * Math.sin(a)); if (x >= 0 && y >= 0 && x < S && y < S) img[y * S + x] -= 0.33; } }
  if (c === 2) { const n = 3 + Math.floor(r() * 5); for (let k = 0; k < n; k++) { const cx = 2 + r() * 20, cy = 2 + r() * 20, rad = 0.8 + r() * 0.9; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= rad * rad) img[y * S + x] -= 0.38; } }
  if (c === 3) { const per = 3 + r() * 2, ph2 = r() * 6.28, amp = 0.09 + r() * 0.05; for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) img[y * S + x] += amp * Math.sin(2 * Math.PI * y / per + ph2); } // horizontal chatter bands
  for (let i = 0; i < img.length; i++) img[i] = clamp(img[i], 0, 1);
  return img;
}
/* hand-made features (what an engineer would look for) */
function feats(img) {
  const colM = new Float32Array(S); for (let x = 0; x < S; x++) { let s = 0; for (let y = 0; y < S; y++) s += img[y * S + x]; colM[x] = s / S; }
  const res = new Float32Array(S * S); for (let i = 0; i < S * S; i++) res[i] = img[i] - colM[i % S]; // remove the normal turning marks
  const rowM = []; for (let y = 0; y < S; y++) { let s = 0; for (let x = 0; x < S; x++) s += res[y * S + x]; rowM.push(s / S); }
  const rowVar = rowM.reduce((s, v) => s + v * v, 0) / S;
  const dark = []; for (let i = 0; i < S * S; i++) if (res[i] < -0.17) dark.push([i % S, Math.floor(i / S)]);
  let elong = 0; if (dark.length > 2) { const mx = dark.reduce((s, p) => s + p[0], 0) / dark.length, my = dark.reduce((s, p) => s + p[1], 0) / dark.length; let a = 0, b = 0, c = 0; dark.forEach(([x, y]) => { a += (x - mx) ** 2; b += (x - mx) * (y - my); c += (y - my) ** 2; }); a /= dark.length; b /= dark.length; c /= dark.length; const tr = a + c, dt = Math.sqrt(Math.max(0, (a - c) ** 2 / 4 + b * b)), l1 = tr / 2 + dt, l2 = Math.max(0.05, tr / 2 - dt); elong = Math.log(l1 / l2); }
  // connected dark blobs (4-neighbour)
  const set = new Set(dark.map(([x, y]) => y * S + x)), seen = new Set(); let blobs = 0, maxB = 0;
  set.forEach((p) => { if (seen.has(p)) return; blobs++; let n = 0; const st = [p]; seen.add(p); while (st.length) { const q = st.pop(); n++; [q - 1, q + 1, q - S, q + S].forEach((k) => { if (set.has(k) && !seen.has(k) && Math.abs((k % S) - (q % S)) <= 1) { seen.add(k); st.push(k); } }); } maxB = Math.max(maxB, n); });
  const sd = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / res.length);
  return [Math.log1p(dark.length), rowVar * 1000, elong, Math.log1p(blobs), Math.log1p(maxB), sd * 20];
}
const FN = ["dark pixels", "row-band variance", "elongation of dark area", "number of dark spots", "largest spot size", "texture roughness"];
function visTrain() {
  const r = rng(VIS.seed), tr = [], te = [];
  for (let c = 0; c < 4; c++) { for (let i = 0; i < 90; i++) tr.push({ c, img: makeImg(c, r) }); for (let i = 0; i < 24; i++) te.push({ c, img: makeImg(c, r) }); }
  tr.forEach((d) => (d.f = feats(d.img))); te.forEach((d) => (d.f = feats(d.img)));
  const nf = 6, mu = [], sd = []; for (let j = 0; j < nf; j++) { mu[j] = tr.reduce((s, d) => s + d.f[j], 0) / tr.length; sd[j] = Math.sqrt(tr.reduce((s, d) => s + (d.f[j] - mu[j]) ** 2, 0) / tr.length) || 1; }
  const H = 16, wr = rng(11), W1 = [], b1 = new Array(H).fill(0), W2 = [], b2 = [0, 0, 0, 0];
  for (let h = 0; h < H; h++) W1.push(Array.from({ length: nf }, () => (wr() - 0.5) * 0.8)); for (let k = 0; k < 4; k++) W2.push(Array.from({ length: H }, () => (wr() - 0.5) * 0.8));
  const fwd = (f) => { const x = f.map((v, j) => (v - mu[j]) / sd[j]), h = W1.map((w, i) => Math.max(0, w.reduce((s, v, j) => s + v * x[j], b1[i]))), o = W2.map((w, k) => w.reduce((s, v, i) => s + v * h[i], b2[k])), mx = Math.max(...o), e = o.map((v) => Math.exp(v - mx)), se = e.reduce((a, b) => a + b, 0); return { x, h, p: e.map((v) => v / se) }; };
  const order = tr.map((_, i) => i), lr = 0.05, loss = [];
  for (let ep = 0; ep < 40; ep++) { // stochastic gradient descent, cross-entropy loss
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(wr() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let L = 0; order.forEach((idx) => { const d = tr[idx], { x, h, p } = fwd(d.f); L -= Math.log(p[d.c] + 1e-9); const go = p.map((v, k) => v - (k === d.c ? 1 : 0)), gh = h.map((hv, i) => (hv > 0 ? go.reduce((s, g, k) => s + g * W2[k][i], 0) : 0));
      for (let k = 0; k < 4; k++) { for (let i = 0; i < H; i++) W2[k][i] -= lr * go[k] * h[i]; b2[k] -= lr * go[k]; } for (let i = 0; i < H; i++) { for (let j = 0; j < nf; j++) W1[i][j] -= lr * gh[i] * x[j]; b1[i] -= lr * gh[i]; } });
    loss.push([ep + 1, L / tr.length]); }
  te.forEach((d) => { d.p = fwd(d.f).p; d.pred = d.p.indexOf(Math.max(...d.p)); });
  VIS.net = { fwd, loss }; VIS.test = te; VIS.live = null;
}
function paint(cv, img, scale) {
  const ctx = cv.getContext("2d"), id = ctx.createImageData(S * scale, S * scale);
  for (let y = 0; y < S * scale; y++) for (let x = 0; x < S * scale; x++) { const v = Math.round(img[Math.floor(y / scale) * S + Math.floor(x / scale)] * 255), o = (y * S * scale + x) * 4; id.data[o] = id.data[o + 1] = id.data[o + 2] = v; id.data[o + 3] = 255; }
  ctx.putImageData(id, 0, 0);
}
function visRender(el) {
  if (!VIS.net) visTrain();
  const te = VIS.test, M = CLS.map(() => [0, 0, 0, 0]); te.forEach((d) => M[d.c][d.pred]++);
  const acc = te.filter((d) => d.c === d.pred).length / te.length;
  const show = te.filter((_, i) => i % 3 === 0);
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>Lab 2 · Visual inspection – surface defects on machined parts</h2><span class="sub">feature extraction + small neural network (6 → 16 → 4), trained here</span></div>
    ${explain([["Factory problem", "Operators check bores and sealing faces by eye: tiring, different from person to person, 100 % check is expensive. A camera + model checks every part in seconds (quality / MES)."],
      ["Data", "Simulated 24 × 24 grey images of a turned surface (vertical turning marks + noise): OK, scratch (line), porosity (dark spots), chatter (horizontal bands). 360 training, 96 test images."],
      ["Algorithm", "Step 1: compute 6 features an engineer would look at (dark pixels, band variance, elongation, spot count …). Step 2: a neural network with 16 hidden neurons (ReLU) and softmax output learns by stochastic gradient descent: weights change after every image to reduce the cross-entropy −log p(true class)."],
      ["What to look at", "Wrong predictions are framed red. Try <b>New random part</b>, or draw your own scratch with the mouse on the big image."],
      ["Honest limits", "Real systems use deep CNNs on GPU / edge PCs and need hundreds to thousands of labelled images per defect. <b>Lighting and camera set-up are ≈ 50 % of success.</b> Rare defects need special handling; keep a human for unclear parts."]])}
    <div class="am-filt"><button class="btn primary" data-a="train">Train again</button><button class="btn" data-a="new">New data</button></div>
    ${kpis([["Test accuracy", (acc * 100).toFixed(0) + " %", `${te.length} test images`], ["Missed defects", String(M.slice(1).reduce((s, r) => s + r[0], 0)), "defect predicted as OK (worst error)"], ["False rejects", String(M[0].slice(1).reduce((a, b) => a + b, 0)), "OK part rejected"]])}
    <div class="grid2"><div><h3>Test images (every 3rd) – predicted / true</h3><div class="ail-grid" style="display:flex;flex-wrap:wrap;gap:6px">${show.map((d, i) =>
      `<figure style="margin:0;text-align:center;font-size:10.5px;color:var(--text-2)"><canvas width="${S * 2}" height="${S * 2}" data-ti="${te.indexOf(d)}" style="display:block;border:2px solid ${d.pred === d.c ? "var(--grid)" : "var(--critical)"};border-radius:4px"></canvas>${CLS[d.pred]}${d.pred === d.c ? "" : `<br><b style="color:var(--critical)">true: ${CLS[d.c]}</b>`}</figure>`).join("")}</div>
      <h3>Confusion matrix</h3>${confusion(CLS, M)}</div>
      <div><h3>Live part</h3><div class="am-filt"><button class="btn" data-a="part">New random part</button><button class="btn" data-a="clean">Clean OK part (draw on it)</button></div>
        <canvas id="ailLive" width="${S * 8}" height="${S * 8}" style="display:block;border:1px solid var(--border);border-radius:6px;cursor:crosshair;touch-action:none"></canvas>
        <div id="ailProb"></div>
        <h3>Learning curve</h3>${lineChart([{ pts: VIS.net.loss, strong: true }], { h: 140, xl: "epoch", w: 380 })}</div></div></div>
  ${learn(["A model needs features that show the difference – today deep networks learn them from many images, small systems use engineered ones.", "The worst error is a missed defect; tune the model so it rejects when unsure (human checks those parts).", "Image quality (light, camera, fixture) matters as much as the algorithm."])}`;
  el.querySelectorAll("canvas[data-ti]").forEach((cv) => paint(cv, te[+cv.dataset.ti].img, 2));
  const cv = el.querySelector("#ailLive");
  const classify = () => { const p = VIS.net.fwd(feats(VIS.live.img)).p; paint(cv, VIS.live.img, 8);
    el.querySelector("#ailProb").innerHTML = bars(CLS.map((n, k) => [n, p[k]]), { fmt: (v) => (v * 100).toFixed(0) + " %" }) + (VIS.live.c != null ? `<p class="am-note">This part was generated as: <b>${CLS[VIS.live.c]}</b></p>` : `<p class="am-note">Hand-drawn part – the model decides.</p>`); };
  const newPart = (c) => { const r = rng(Math.floor(Math.random() * 1e9)); const cc = c == null ? Math.floor(r() * 4) : c; VIS.live = { c: cc, img: makeImg(cc, r) }; classify(); };
  if (!VIS.live) newPart(); else classify();
  let drawing = false; const draw = (e) => { const b = cv.getBoundingClientRect(), x = Math.floor((e.clientX - b.left) / b.width * S), y = Math.floor((e.clientY - b.top) / b.height * S); if (x >= 0 && y >= 0 && x < S && y < S) { VIS.live.img[y * S + x] = Math.max(0, VIS.live.img[y * S + x] - 0.3); VIS.live.c = null; paint(cv, VIS.live.img, 8); } };
  cv.onpointerdown = (e) => { drawing = true; draw(e); }; cv.onpointermove = (e) => { if (drawing) draw(e); }; cv.onpointerup = cv.onpointerleave = () => { if (drawing) { drawing = false; classify(); } };
  el.onclick = (e) => { const a = e.target.dataset.a; if (a === "train") { visTrain(); visRender(el); } if (a === "new") { VIS.seed = 1 + Math.floor(Math.random() * 9999); visTrain(); visRender(el); } if (a === "part") newPart(); if (a === "clean") newPart(0); };
}

/* =====================================================================================  3  CUTTING-DATA OPTIMISATION */
const OP = { D: 63, z: 5, ap: 3, ae: 50, V: 180, M: 1.0, tool: 9, tch: 1.0, kc: 1200, Pmax: 11, rE: 1.6, Ra: 6.3, n: 0.25, Ct: 400 };
const VC = [80, 400], FZ = [0.05, 0.4];
function cut(vc, fz) { // returns cost € per part and feasibility
  const rpm = vc * 1000 / (Math.PI * OP.D), vf = fz * OP.z * rpm, mrr = OP.ap * OP.ae * vf / 1000; // cm³/min
  const tc = OP.V / mrr, T = Math.pow(OP.Ct / vc, 1 / OP.n) * Math.pow(0.15 / fz, 0.6); // min
  const cost = tc * OP.M + (tc / T) * (OP.tool + OP.tch * OP.M) + 0.5 * OP.M;
  const P = OP.ap * OP.ae * vf * OP.kc / 6e7, Ra = fz * fz / (8 * OP.rE) * 1000, chat = vc > 268 && vc < 312 && fz > 0.1;
  return { cost, P, Ra, T, tc, ok: P <= OP.Pmax && Ra <= OP.Ra && !chat, why: P > OP.Pmax ? "power" : Ra > OP.Ra ? "surface" : chat ? "chatter" : "" };
}
const known = (vc, fz) => { const c = cut(vc, fz); return c.P <= OP.Pmax && c.Ra <= OP.Ra; }; // power + Ra are calculable before cutting; chatter only shows in a test cut
function trueOpt() { let b = null; for (let i = 0; i <= 160; i++) for (let j = 0; j <= 140; j++) { const vc = VC[0] + (VC[1] - VC[0]) * i / 160, fz = FZ[0] + (FZ[1] - FZ[0]) * j / 140, c = cut(vc, fz); if (c.ok && (!b || c.cost < b.cost)) b = { vc, fz, cost: c.cost }; } return b; }
function search(method, budget, seed) {
  const r = rng(seed), pts = [], ev = (vc, fz) => { vc = clamp(vc, VC[0], VC[1]); fz = clamp(fz, FZ[0], FZ[1]); const c = cut(vc, fz); pts.push({ vc, fz, cost: c.cost, ok: c.ok }); return c.ok ? c.cost : c.cost * 1.6 + 2; };
  const uv = (u) => VC[0] + u * (VC[1] - VC[0]), uf = (u) => FZ[0] + u * (FZ[1] - FZ[0]);
  if (method === "grid") { for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) ev(uv((i + 0.5) / 6), uf((j + 0.5) / 5)); }
  else if (method === "random") { for (let k = 0; k < budget; k++) ev(uv(r()), uf(r())); }
  else if (method === "surr") { // Bayesian-style: quadratic surrogate of the feasible results + exploration bonus
    for (let k = 0; k < 6; k++) ev(uv(r()), uf(r()));
    while (pts.length < budget) {
      const okp = pts.filter((p) => p.ok).map((p) => ({ u: (p.vc - VC[0]) / (VC[1] - VC[0]), v: (p.fz - FZ[0]) / (FZ[1] - FZ[0]), y: p.cost }));
      const co = okp.length >= 6 ? lsq(okp.map((p) => [1, p.u, p.v, p.u * p.u, p.v * p.v, p.u * p.v]), okp.map((p) => p.y)) : null;
      let best = null;
      for (let c = 0; c < 500; c++) { const u = r(), v = r(), vc = uv(u), fz = uf(v); if (!known(vc, fz)) continue;
        const near = Math.min(...pts.map((p) => Math.hypot((p.vc - vc) / (VC[1] - VC[0]), (p.fz - fz) / (FZ[1] - FZ[0])))), bad = pts.some((p) => !p.ok && p.why !== "" && Math.hypot((p.vc - vc) / 320, (p.fz - fz) / 0.35) < 0.06);
        const pred = co ? co[0] + co[1] * u + co[2] * v + co[3] * u * u + co[4] * v * v + co[5] * u * v : 0, score = pred - 1.2 * near + (bad ? 5 : 0);
        if (!best || score < best.s) best = { s: score, vc, fz }; }
      if (best) ev(best.vc, best.fz); else ev(uv(r()), uf(r()));
    }
  } else { // Nelder–Mead on the normalised square with penalty
    const f = (p) => ev(uv(clamp(p[0], 0, 1)), uf(clamp(p[1], 0, 1)));
    let s = [[0.3, 0.3], [0.5, 0.3], [0.3, 0.5]].map((p) => ({ p, y: f(p) }));
    while (pts.length < budget) {
      s.sort((a, b) => a.y - b.y); const c = [(s[0].p[0] + s[1].p[0]) / 2, (s[0].p[1] + s[1].p[1]) / 2], w = s[2];
      const xr = [2 * c[0] - w.p[0], 2 * c[1] - w.p[1]], yr = f(xr);
      if (yr < s[0].y && pts.length < budget) { const xe = [3 * c[0] - 2 * w.p[0], 3 * c[1] - 2 * w.p[1]], ye = f(xe); s[2] = ye < yr ? { p: xe, y: ye } : { p: xr, y: yr }; }
      else if (yr < s[1].y) s[2] = { p: xr, y: yr };
      else if (pts.length < budget) { const xc = [(c[0] + w.p[0]) / 2, (c[1] + w.p[1]) / 2], yc = f(xc); if (yc < w.y) s[2] = { p: xc, y: yc }; else { s = s.map((q, i) => (i === 0 ? q : { p: [(q.p[0] + s[0].p[0]) / 2, (q.p[1] + s[0].p[1]) / 2], y: q.y })); s[1].y = f(s[1].p); s[2].y = f(s[2].p); } }
    }
  }
  pts.length = Math.min(pts.length, budget);
  let b = Infinity; pts.forEach((p) => { if (p.ok) b = Math.min(b, p.cost); p.best = b; });
  return pts;
}
function lsq(X, y) { // least squares via normal equations + small ridge
  const n = X[0].length, A = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j < n ? X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? 1e-6 : 0) : X.reduce((s, r, k) => s + r[i] * y[k], 0))));
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; if (Math.abs(A[c][c]) < 1e-12) continue; for (let r = 0; r < n; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let j = c; j <= n; j++) A[r][j] -= k * A[c][j]; } }
  return A.map((r, i) => r[n] / (r[i] || 1));
}
const METH = [["grid", "Grid search", ""], ["random", "Random search", "6 3"], ["surr", "Surrogate (Bayesian-style)", "2 3"], ["nm", "Nelder–Mead", "8 3 2 3"]];
const OPS = { m: "surr", seed: 5, step: 30, runs: null, timer: null };
function optRender(el) {
  const opt = trueOpt();
  if (!OPS.runs) OPS.runs = Object.fromEntries(METH.map(([k]) => [k, search(k, 30, OPS.seed)]));
  const W = 520, H = 340, L = 50, B = 36, T = 10, R = 10, sx = (vc) => L + (vc - VC[0]) / (VC[1] - VC[0]) * (W - L - R), sy = (fz) => H - B - (fz - FZ[0]) / (FZ[1] - FZ[0]) * (H - T - B);
  // heat map: 40 × 28 cells, one hue (darker = cheaper)
  let g = `<defs><pattern id="ailHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--surface-2)"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--axis)" stroke-width="2"/></pattern></defs>`;
  const nx = 40, ny = 28, cw = (W - L - R) / nx, ch = (H - T - B) / ny, cells = []; let cmin = 1e9, cmax = 0;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const vc = VC[0] + (i + 0.5) / nx * (VC[1] - VC[0]), fz = FZ[0] + (j + 0.5) / ny * (FZ[1] - FZ[0]), c = cut(vc, fz); cells.push([i, j, c]); if (c.ok) { cmin = Math.min(cmin, c.cost); cmax = Math.max(cmax, c.cost); } }
  cells.forEach(([i, j, c]) => { const x = L + i * cw, y = H - B - (j + 1) * ch; g += c.ok ? `<rect x="${x}" y="${y}" width="${cw + 0.5}" height="${ch + 0.5}" fill="var(--series)" opacity="${(0.08 + 0.85 * Math.pow(1 - (c.cost - cmin) / (cmax - cmin), 2)).toFixed(2)}"/>` : `<rect x="${x}" y="${y}" width="${cw + 0.5}" height="${ch + 0.5}" fill="url(#ailHatch)"/>`; });
  for (let v = 100; v <= 400; v += 50) g += `<text x="${sx(v)}" y="${H - B + 14}" text-anchor="middle" class="am-s">${v}</text>`;
  for (let f = 0.05; f <= 0.401; f += 0.05) g += `<text x="${L - 6}" y="${sy(f) + 4}" text-anchor="end" class="am-s">${f.toFixed(2)}</text>`;
  g += `<text x="${(L + W) / 2}" y="${H - 4}" text-anchor="middle" class="am-s">cutting speed vc (m/min)</text><text transform="translate(12 ${H / 2}) rotate(-90)" text-anchor="middle" class="am-s">feed per tooth fz (mm)</text>`;
  g += `<text x="${sx(290)}" y="${sy(0.37)}" text-anchor="middle" class="am-s">chatter</text><text x="${sx(370)}" y="${sy(0.33)}" text-anchor="middle" class="am-s">power</text><text x="${sx(120)}" y="${sy(0.37)}" text-anchor="middle" class="am-s">surface Ra</text>`;
  const pts = OPS.runs[OPS.m].slice(0, OPS.step);
  pts.forEach((p, i) => { const last = i === pts.length - 1; g += p.ok ? `<circle cx="${sx(p.vc)}" cy="${sy(p.fz)}" r="${last ? 6 : 4}" fill="var(--surface)" stroke="var(--text)" stroke-width="${last ? 2.5 : 1.5}"/>` : `<g stroke="var(--critical)" stroke-width="2"><line x1="${sx(p.vc) - 4}" y1="${sy(p.fz) - 4}" x2="${sx(p.vc) + 4}" y2="${sy(p.fz) + 4}"/><line x1="${sx(p.vc) - 4}" y1="${sy(p.fz) + 4}" x2="${sx(p.vc) + 4}" y2="${sy(p.fz) - 4}"/></g>`; });
  g += `<path d="M${sx(opt.vc)} ${sy(opt.fz) - 9} l3 6 h7 l-5.5 4 l2 7 l-6.5 -4 l-6.5 4 l2 -7 l-5.5 -4 h7 Z" fill="var(--warning)" stroke="var(--text)" stroke-width="0.8"/>`;
  const best = pts.filter((p) => p.ok).sort((a, b) => a.cost - b.cost)[0], bc = best ? cut(best.vc, best.fz) : null;
  const curves = METH.map(([k, n, dash]) => ({ pts: OPS.runs[k].slice(0, OPS.step).filter((p) => isFinite(p.best)).map((p, i, a) => [OPS.runs[k].indexOf(p) + 1, p.best]), label: n, dash, strong: k === OPS.m }));
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>Lab 3 · Optimisation – best cutting data with few test cuts</h2><span class="sub">face milling a cast-iron crankcase face (simulated model)</span></div>
    ${explain([["Factory problem", "Which cutting speed vc and feed fz give the lowest cost per part? Every test cut costs machine time, a tool and maybe a part. Trial and error takes weeks (CNC / HMC tabs)."],
      ["Model (from engineers)", `Tool life (Taylor): T = (C<sub>t</sub>/vc)<sup>1/n</sup>·(0.15/fz)<sup>0.6</sup>, n = ${OP.n}, C<sub>t</sub> = ${OP.Ct} · time t<sub>c</sub> = V / MRR, MRR = a<sub>p</sub>·a<sub>e</sub>·fz·z·n · cost C = t<sub>c</sub>·M + (t<sub>c</sub>/T)·(tool + change) + handling. Limits: power P = MRR·k<sub>c</sub> ≤ ${OP.Pmax} kW, surface Ra = fz²/(8 r<sub>ε</sub>) ≤ ${OP.Ra} µm, chatter zone (stability lobe).`],
      ["Algorithm", "Search methods choose the next test cut: <b>grid</b> (fixed pattern), <b>random</b>, <b>surrogate / Bayesian-style</b> (fits a smooth model to the results so far and tests where it predicts low cost or knows little), <b>Nelder–Mead</b> (a triangle that rolls downhill)."],
      ["What to look at", "Dark blue = cheap, hatched = not allowed. ○ = test cut, ✕ = test cut in a forbidden zone (e.g. chatter found), ★ = true optimum. Compare how fast each method gets near the star."],
      ["Honest limits", "The model and the limits come from engineering knowledge and must be checked with real cuts. AI does not replace the process engineer – it reduces the number of expensive experiments."]])}
    <div class="am-filt"><span class="sub">Method:</span>${METH.map(([k, n]) => `<button class="chip ${k === OPS.m ? "am-sel" : ""}" data-m="${k}">${n}</button>`).join("")}
      <button class="btn primary" data-a="play">▶ Animate test cuts</button><button class="btn" data-a="new">New random start</button>
      <span class="sub">trials ${OPS.step} / 30</span><input type="range" min="1" max="30" value="${OPS.step}" data-a="step" style="width:160px"></div>
    ${kpis([["Best found (this method)", best ? "€ " + f2(best.cost) : "–", best ? `vc ${f0(best.vc)} m/min · fz ${f2(best.fz)} mm` : "no allowed cut yet"], ["True optimum", "€ " + f2(opt.cost), `vc ${f0(opt.vc)} · fz ${f2(opt.fz)}`],
      ["Gap to optimum", best ? f1((best.cost / opt.cost - 1) * 100) + " %" : "–", `after ${OPS.step} test cuts`], ["At best point", bc ? `${f1(bc.P)} kW` : "–", bc ? `Ra ${f1(bc.Ra)} µm · tool life ${f0(bc.T)} min` : ""]])}
    <div class="grid2"><div><h3>Cost per part over the cutting-data window</h3><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}</svg></div>
      <div><h3>Best cost found vs number of test cuts</h3>${lineChart(curves, { h: 260, w: 420, xl: "number of test cuts", x0: 1, x1: 30, y0: opt.cost * 0.97, y1: opt.cost * 1.6 })}
        <p class="am-note">Selected method = blue line. Lower and earlier = fewer expensive test cuts.</p></div></div></div>
  ${learn(["Optimisation needs a target (cost per part) and limits (power, surface, chatter) – both defined by engineers.", "Smart search (surrogate / Bayesian) usually gets close to the optimum with far fewer test cuts than a grid.", "The same idea works for welding, heat treatment, LPBF parameters and assembly press-fits."])}`;
  el.onclick = (e) => { const t = e.target; if (t.dataset.m) { OPS.m = t.dataset.m; optRender(el); } if (t.dataset.a === "new") { OPS.seed = 1 + Math.floor(Math.random() * 9999); OPS.runs = null; optRender(el); }
    if (t.dataset.a === "play") { clearInterval(OPS.timer); OPS.step = 1; OPS.timer = setInterval(() => { if (!el.isConnected || OPS.step >= 30) { clearInterval(OPS.timer); return; } OPS.step++; optRender(el); }, 180); optRender(el); } };
  el.oninput = (e) => { if (e.target.dataset.a === "step") { clearInterval(OPS.timer); OPS.step = +e.target.value; optRender(el); el.querySelector('[data-a="step"]').focus(); } };
}

/* =====================================================================================  4  DEMAND FORECASTING */
const FC = { seed: 21, hold: 26 };
function fcData(seed) {
  const r = rng(seed), g = gaussOf(r), y = [], promo = [];
  for (let t = 0; t < 156; t++) { const p = r() < 0.08 ? 1 : 0; promo.push(p); y.push(Math.max(0, Math.round(38 + 0.07 * t + 7 * Math.sin(2 * Math.PI * t / 52 - 1.2) + 12 * p + 4 * g()))); }
  return { y, promo };
}
function fcRun() {
  const { y, promo } = fcData(FC.seed), n = y.length, h = FC.hold, tr = y.slice(0, n - h), act = y.slice(n - h);
  const ma = new Array(h).fill(tr.slice(-8).reduce((a, b) => a + b, 0) / 8);
  // Holt-Winters additive, season 52
  const m = 52, a = 0.3, b = 0.05, gm = 0.25; let L = tr.slice(0, m).reduce((s, v) => s + v, 0) / m, B = (tr.slice(m, 2 * m).reduce((s, v) => s + v, 0) / m - L) / m; const Sz = tr.slice(0, m).map((v) => v - L);
  for (let t = m; t < tr.length; t++) { const s = Sz[t - m], Lp = L; L = a * (tr[t] - s) + (1 - a) * (L + B); B = b * (L - Lp) + (1 - b) * B; Sz[t] = gm * (tr[t] - L) + (1 - gm) * s; }
  const hw = Array.from({ length: h }, (_, k) => L + (k + 1) * B + Sz[tr.length - m + (k % m)]);
  // regression with features: trend + 2 harmonics + planned promotion flag
  const X = (t) => [1, t, Math.sin(2 * Math.PI * t / 52), Math.cos(2 * Math.PI * t / 52), Math.sin(4 * Math.PI * t / 52), Math.cos(4 * Math.PI * t / 52), promo[t]];
  const co = lsq(tr.map((_, t) => X(t)), tr), reg = Array.from({ length: h }, (_, k) => X(n - h + k).reduce((s, v, j) => s + v * co[j], 0));
  const met = (f) => { const e = f.map((v, k) => act[k] - v), mae = e.reduce((s, v) => s + Math.abs(v), 0) / h, mape = e.reduce((s, v, k) => s + Math.abs(v) / Math.max(1, act[k]), 0) / h * 100, sd = Math.sqrt(e.reduce((s, v) => s + v * v, 0) / h); return { mae, mape, sd, ss: 1.65 * sd * Math.sqrt(4) }; };
  return { y, tr, act, n, h, f: { ma, hw, reg }, m: { ma: met(ma), hw: met(hw), reg: met(reg) } };
}
function fcRender(el) {
  const R = fcRun(), start = R.n - R.h - 52, val = 650;
  const hist = R.y.slice(start).map((v, i) => [start + i + 1, v]), fx = (f) => f.map((v, k) => [R.n - R.h + k + 1, v]);
  const names = { ma: "Moving average (8 weeks)", hw: "Holt-Winters (exp. smoothing)", reg: "Regression with features (ML)" };
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>Lab 4 · Demand forecasting – weekly compressor orders</h2><span class="sub">3 methods tested on the last 26 weeks they have never seen</span></div>
    ${explain([["Factory problem", "How many VC10 / VC20 / VC30 compressors will be ordered in the next months? Too high = cash tied up in stock; too low = late orders (ERP + Order flow tabs)."],
      ["Data", "3 years (156 weeks) of simulated orders: slow growth + yearly season + sales promotions + random noise. The last 26 weeks are hidden (hold-out test)."],
      ["Algorithms", "<b>Moving average</b>: mean of the last 8 weeks. <b>Holt-Winters</b>: level + trend + seasonal index, updated with smoothing factors α = 0.3, β = 0.05, γ = 0.25. <b>Regression (ML)</b>: least-squares fit of trend + 2 seasonal waves + the planned promotion calendar as features."],
      ["What to look at", "MAPE = mean absolute % error. Safety stock = z·σ·√L (z = 1.65 for 95 % service, L = 4 weeks lead time, σ = forecast error) → value in € at € 650 per unit (example)."],
      ["Honest limits", "A model only knows patterns that are in the data. A new competitor, a crisis or a big project order is invisible – planners must add that knowledge."]])}
    <div class="am-filt"><button class="btn" data-a="new">New data</button></div>
    ${lineChart([{ pts: hist, label: "actual orders", strong: true }, { pts: fx(R.f.ma), label: "moving avg.", dash: "2 3" }, { pts: fx(R.f.hw), label: "Holt-Winters", dash: "6 3" }, { pts: fx(R.f.reg), label: "regression", dash: "10 3 2 3" }], { h: 280, w: 760, xl: "week", marks: [{ x: R.n - R.h + 0.5, t: "← history | hidden test →" }] })}
    <div class="am-wrap"><table class="am-tab"><thead><tr><th>Method</th><th>MAPE</th><th>MAE (units / week)</th><th>Error σ</th><th>Safety stock (units)</th><th>Safety stock value</th></tr></thead><tbody>${Object.keys(names).map((k) => { const m = R.m[k];
      return `<tr><td><b>${names[k]}</b></td><td>${f1(m.mape)} %</td><td>${f1(m.mae)}</td><td>${f1(m.sd)}</td><td>${f0(m.ss)}</td><td>€ ${f0(m.ss * val)}</td></tr>`; }).join("")}</tbody></table></div>
    <p class="am-note">Difference between the worst and the best method: <b>€ ${f0((Math.max(...Object.values(R.m).map((m) => m.ss)) - Math.min(...Object.values(R.m).map((m) => m.ss))) * val)}</b> less safety stock for the same service level.</p></div>
  ${learn(["Better forecasts → less safety stock and fewer late orders, at the same service level.", "Adding known future information (promotions, project orders) as features is often worth more than a fancier algorithm.", "Always test on data the model has not seen (hold-out) – a good fit on history means nothing."])}`;
  el.onclick = (e) => { if (e.target.dataset.a === "new") { FC.seed = 1 + Math.floor(Math.random() * 9999); fcRender(el); } };
}

/* =====================================================================================  5  SEARCH ASSISTANT (RETRIEVAL) */
const STOP = new Set("a an and are as at be by for from how i in is it of on or the to what which with this that do does can my we our you your about into per vs".split(" "));
const stem = (w) => w.length > 5 && w.endsWith("ing") ? w.slice(0, -3) : w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w;
const tok = (s) => String(s).toLowerCase().replace(/<[^>]+>/g, " ").split(/[^a-z0-9äöüß]+/).filter((w) => w && !STOP.has(w)).map(stem);
let IDX = null;
function buildIndex() {
  const docs = [];
  ROWS.forEach((r) => { const ex = EXPLAIN[r.k]; docs.push({ id: r.id, title: r.title, sum: r.req, text: [r.id, r.title, r.title, r.req, r.project, r.covers, r.official, ex && [ex.what, ex.why, ex.content.join(" "), ex.apply.join(" ")].join(" ")].join(" ") }); });
  EXTRA.forEach(([id, , title, req]) => { if (!docs.some((d) => d.id === id)) { const ex = EXPLAIN[id]; docs.push({ id, title, sum: req, text: [id, title, title, req, ex && [ex.what, ex.content.join(" ")].join(" ")].join(" ") }); } });
  const df = new Map(); docs.forEach((d) => { const tf = new Map(); tok(d.text).forEach((w) => tf.set(w, (tf.get(w) || 0) + 1)); d.tf = tf; tf.forEach((_, w) => df.set(w, (df.get(w) || 0) + 1)); });
  const N = docs.length, idf = (w) => Math.log((N + 1) / ((df.get(w) || 0) + 1)) + 1;
  docs.forEach((d) => { let s = 0; d.tf.forEach((c, w) => { const v = (1 + Math.log(c)) * idf(w); s += v * v; }); d.norm = Math.sqrt(s) || 1; });
  IDX = { docs, idf };
}
function ask(q) {
  if (!IDX) buildIndex();
  const qt = new Map(); tok(q).forEach((w) => qt.set(w, (qt.get(w) || 0) + 1));
  let qn = 0; qt.forEach((c, w) => (qn += ((1 + Math.log(c)) * IDX.idf(w)) ** 2)); qn = Math.sqrt(qn) || 1;
  return IDX.docs.map((d) => { let dot = 0; qt.forEach((c, w) => { const t = d.tf.get(w); if (t) dot += (1 + Math.log(c)) * IDX.idf(w) * (1 + Math.log(t)) * IDX.idf(w); }); return { d, s: dot / (qn * d.norm) }; }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => ({ ...x, qt }));
}
const hl = (s, qt) => esc(s).replace(/[A-Za-z0-9äöüß]+/g, (w) => (qt.has(stem(w.toLowerCase())) ? `<b style="color:var(--series)">${w}</b>` : w));
const RAG = { q: "safety distance light curtain" };
function ragRender(el) {
  const res = ask(RAG.q), ex = ["safety distance light curtain", "hydraulic oil cleanliness", "how to test machine accuracy", "metal powder explosion", "pressure vessel air receiver", "robot collaborative limits"];
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>Lab 5 · Search assistant – the retrieval part of an AI assistant</h2><span class="sub">TF-IDF + cosine similarity over ${IDX ? IDX.docs.length : "all"} standards in the Standards tab</span></div>
    ${explain([["Factory problem", "Engineers and operators lose time searching manuals, standards, work instructions and old NCRs. An assistant should find the right document and answer the question – with the source."],
      ["Data", "The offline standards library of this twin (titles, requirements, project notes, explainers)."],
      ["Algorithm", "Every text is split into words; each word gets a weight TF-IDF = (1 + log count) · log(N / documents with the word) – rare words count more. The question gets the same weights; the score is the cosine of the angle between the two word vectors."],
      ["What to look at", "Ask a question in your words. Highlighted = words that matched. Score = cosine similarity (0 … 1)."],
      ["Honest limits", "This is only the <b>R</b> of <b>RAG</b> (retrieval-augmented generation). A full assistant adds a language model (LLM) that writes the answer from these documents. Offline that needs a local LLM server (on-premise GPU PC); otherwise a cloud service. Always show the sources and let a person check the answer – LLMs can invent things."]])}
    <div class="am-filt"><input type="search" data-a="q" value="${esc(RAG.q)}" style="flex:1 1 320px" placeholder="Ask a question …"><button class="btn primary" data-a="ask">Search</button></div>
    <div class="am-filt">${ex.map((x) => `<button class="chip" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>
    <div class="am-wrap"><table class="am-tab"><thead><tr><th>#</th><th>Document</th><th>Score</th><th>Summary (matched words highlighted)</th></tr></thead><tbody>${res.map((x, i) =>
      `<tr><td>${i + 1}</td><td><b>${esc(x.d.id)}</b><br><span class="sub">${hl(x.d.title, x.qt)}</span></td><td>${f2(x.s)}</td><td>${hl(x.d.sum, x.qt)}</td></tr>`).join("") || `<tr><td colspan="4" class="sub">No match – try other words.</td></tr>`}</tbody></table></div>
    <h3>What a language model would receive next (RAG step 2)</h3>
    <pre style="white-space:pre-wrap;background:var(--surface-2);padding:10px;border-radius:6px;font-size:12px;color:var(--text)">Answer the question using ONLY the sources below. Name the source for every statement. If the sources do not answer it, say so.
Question: ${esc(RAG.q)}
${res.map((x, i) => `[${i + 1}] ${esc(x.d.id)} – ${esc(x.d.title)}: ${esc(x.d.sum)}`).join("\n")}</pre></div>
  ${learn(["Most of a good company assistant is good retrieval: clean documents, good search, sources shown.", "Keyword methods (TF-IDF) are fast and transparent; modern systems add semantic 'embeddings' so synonyms also match.", "Keep the LLM on your own network for confidential documents, and always let a human check safety-relevant answers."])}`;
  const go = () => { RAG.q = el.querySelector('[data-a="q"]').value; ragRender(el); };
  el.onclick = (e) => { if (e.target.dataset.q) { RAG.q = e.target.dataset.q; ragRender(el); } if (e.target.dataset.a === "ask") go(); };
  el.onkeydown = (e) => { if (e.target.dataset.a === "q" && e.key === "Enter") go(); };
}

/* =====================================================================================  mount */
const LABS = [["pdm", "1 · Predictive maintenance", pdmRender], ["vision", "2 · Visual inspection", visRender], ["opt", "3 · Optimise cutting data", optRender], ["fc", "4 · Demand forecasting", fcRender], ["rag", "5 · Search assistant", ragRender]];
export function mountLab(host) {
  let cur = LABS.some((l) => l[0] === Q.get("ailab")) ? Q.get("ailab") : "pdm";
  host.innerHTML = `<div class="card"><div class="card-head"><h2>Live AI labs – real algorithms, running offline in this browser</h2><span class="sub">simulated data · click a lab · every result is computed here, nothing is sent anywhere</span></div>
    <div class="mx-nav" data-r="nav">${LABS.map(([k, n]) => `<button class="mx-el ${k === cur ? "active" : ""}" data-lab="${k}">${n}</button>`).join("")}</div></div><div data-r="lab"></div>`;
  const nav = host.querySelector('[data-r="nav"]'), box = host.querySelector('[data-r="lab"]');
  const show = (k) => { cur = k; nav.querySelectorAll("[data-lab]").forEach((b) => b.classList.toggle("active", b.dataset.lab === k)); box.onclick = box.oninput = box.onkeydown = null; LABS.find((l) => l[0] === k)[2](box); };
  nav.addEventListener("click", (e) => { const b = e.target.closest("[data-lab]"); if (b) show(b.dataset.lab); });
  show(cur);
}
