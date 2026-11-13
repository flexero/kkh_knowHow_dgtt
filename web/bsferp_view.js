/* Ball screw + guide factory – item 7 ERP – SVG / HTML renders (charts with thin marks, one y-axis per chart, legend for ≥ 2 series,
 * text in the text colours of the theme, native hover titles on every mark).  Guide: docs/46_bsf_erp.md. */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const f0 = (v) => (v == null || !Number.isFinite(+v) ? "–" : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
export const f1 = (v) => (v == null || !Number.isFinite(+v) ? "–" : (+v).toFixed(1));
export const f2 = (v) => (v == null || !Number.isFinite(+v) ? "–" : (+v).toFixed(2));
export const eur = (v) => (v == null || !Number.isFinite(+v) ? "–" : (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + " M€" : Math.abs(v) >= 1e4 ? f0(v / 1000) + " k€" : f2(v) + " €"));
export const pc = (v, d = 1) => (v == null || !Number.isFinite(+v) ? "–" : (100 * v).toFixed(d) + " %");
/* series colours: fixed order (identity), second series also dashed (not colour alone) */
export const SER = [{ c: "var(--bf7-s1)", dash: "" }, { c: "var(--bf7-s2)", dash: "6 4" }, { c: "var(--bf7-s3)", dash: "2 3" }];

/* round axis: step = 1 / 2 / 2.5 / 5 × 10^n, min / max snapped to the step (ticks are round numbers) */
function niceScale(lo, hi, n = 4) {
  if (!(hi > lo)) hi = lo + 1;
  const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p, step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  const mn = Math.floor(lo / step + 1e-9) * step, mx = Math.ceil(hi / step - 1e-9) * step; return { mn, mx, step, k: Math.round((mx - mn) / step) };
}
function niceMax(v) { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
const legend = (series) => (series.length >= 2 ? `<div class="bf7-legend">${series.map((s, i) => `<span><svg width="26" height="10" aria-hidden="true"><line x1="1" y1="5" x2="25" y2="5" stroke="${SER[i].c}" stroke-width="2" stroke-dasharray="${SER[i].dash}"/></svg>${esc(s.name)}</span>`).join("")}</div>` : "");

/** line chart: series [{name, values}], labels [x labels], opts {title, unit, fmt, min0, w, h, ref (horizontal reference line {y, text})} */
export function lineChart(series, labels, o = {}) {
  const W = o.w || 560, H = o.h || 210, L = 58, R = 12, T = 12, B = 30, n = labels.length, fmt = o.fmt || f0;
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v)), mx0 = Math.max(...all, o.ref ? o.ref.y : -Infinity), mn0 = Math.min(...all, o.ref ? o.ref.y : Infinity);
  const lo = o.min0 === false ? mn0 - 0.05 * (mx0 - mn0 || Math.abs(mx0) || 1) : Math.min(0, mn0), hi = o.max != null ? o.max : mx0 + 0.05 * (mx0 - lo || 1);
  const sc = niceScale(lo, hi), mn = sc.mn, mx = o.max != null ? Math.max(o.max, sc.mn + sc.step) : sc.mx, nT = o.max != null ? Math.max(1, Math.round((mx - mn) / sc.step)) : sc.k;
  const x = (i) => L + (n > 1 ? i * (W - L - R) / (n - 1) : (W - L - R) / 2), y = (v) => T + (H - T - B) * (1 - (v - mn) / (mx - mn || 1));
  let s = `<svg class="bf7-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "chart")}">`;
  for (let k = 0; k <= nT; k++) { const v = Math.min(mx, mn + sc.step * k); s += `<line class="bf7-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="bf7-ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`; }
  if (mn < 0) s += `<line class="bf7-base" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  labels.forEach((lb, i) => { if (n <= 12 || i % Math.ceil(n / 12) === 0) s += `<text class="bf7-ax" x="${x(i)}" y="${H - 10}" text-anchor="middle">${esc(lb)}</text>`; });
  if (o.ref) s += `<line class="bf7-ref" x1="${L}" x2="${W - R}" y1="${y(o.ref.y)}" y2="${y(o.ref.y)}"/><text class="bf7-ax2" x="${W - R}" y="${y(o.ref.y) - 4}" text-anchor="end">${esc(o.ref.text)}</text>`;
  series.forEach((se, si) => {
    const pts = se.values.map((v, i) => (Number.isFinite(v) ? `${x(i).toFixed(1)},${y(v).toFixed(1)}` : null)).filter(Boolean).join(" ");
    s += `<polyline fill="none" stroke="${SER[si].c}" stroke-width="2" stroke-dasharray="${SER[si].dash}" stroke-linejoin="round" points="${pts}"/>`;
    se.values.forEach((v, i) => { if (Number.isFinite(v)) s += `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${SER[si].c}" stroke="var(--surface)" stroke-width="2"><title>${esc(se.name)} · ${esc(labels[i])}: ${esc(fmt(v))}${esc(o.unit || "")}</title></circle>`; });
  });
  return s + `</svg>` + legend(series);
}

/** vertical bars, one series (or grouped ≤ 2): series [{name, values}], labels */
export function barChart(series, labels, o = {}) {
  const W = o.w || 560, H = o.h || 210, L = 58, R = 12, T = 12, B = 30, n = labels.length, fmt = o.fmt || f0, m = series.length;
  const all = series.flatMap((s) => s.values), hasNeg = all.some((v) => v < 0);
  const sc = niceScale(hasNeg ? Math.min(...all) : 0, Math.max(0, ...all) * 1.05), mx = sc.mx, mn = sc.mn, y = (v) => T + (H - T - B) * (1 - (v - mn) / (mx - mn));
  const bw = (W - L - R) / n, gap = 2, w = Math.max(3, (bw * 0.7 - gap * (m - 1)) / m);
  let s = `<svg class="bf7-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "chart")}">`;
  for (let k = 0; k <= sc.k; k++) { const v = mn + sc.step * k; s += `<line class="bf7-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="bf7-ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(fmt(v))}</text>`; }
  labels.forEach((lb, i) => { s += `<text class="bf7-ax" x="${L + bw * (i + 0.5)}" y="${H - 10}" text-anchor="middle">${esc(lb)}</text>`; });
  series.forEach((se, si) => se.values.forEach((v, i) => {
    const x0 = L + bw * i + bw * 0.15 + si * (w + gap), y0 = y(Math.max(0, v)), h = Math.max(1, Math.abs(y(v) - y(0)));
    s += `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${SER[si].c}" ${si ? 'fill-opacity="0.55"' : ""}><title>${esc(se.name)} · ${esc(labels[i])}: ${esc(fmt(v))}${esc(o.unit || "")}</title></rect>`;
  }));
  if (hasNeg) s += `<line class="bf7-base" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/>`;
  if (o.ref) s += `<line class="bf7-ref" x1="${L}" x2="${W - R}" y1="${y(o.ref.y)}" y2="${y(o.ref.y)}"/><text class="bf7-ax2" x="${W - R}" y="${y(o.ref.y) - 4}" text-anchor="end">${esc(o.ref.text)}</text>`;
  return s + `</svg>` + legend(series);
}

/** horizontal bars (capacity load, ABC): rows [{label, v, text}], opts {max, ref} */
export function hbars(rows, o = {}) {
  const W = o.w || 560, rh = 24, L = o.left || 150, R = 70, H = rows.length * rh + 26, mx = o.max || niceMax(Math.max(...rows.map((r) => r.v)) * 1.05), x = (v) => L + (W - L - R) * v / mx;
  let s = `<svg class="bf7-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "bars")}">`;
  rows.forEach((r, i) => { const y0 = 6 + i * rh; s += `<text class="bf7-ax2" x="${L - 6}" y="${y0 + 15}" text-anchor="end">${esc(r.label)}</text><rect x="${L}" y="${y0 + 3}" width="${Math.max(1, x(r.v) - L).toFixed(1)}" height="${rh - 8}" rx="3" fill="${r.warn ? "var(--bf7-warn)" : "var(--bf7-s1)"}"><title>${esc(r.label)}: ${esc(r.text)}</title></rect><text class="bf7-ax2" x="${x(Math.max(r.v, o.ref ? o.ref.v : 0)) + 6}" y="${y0 + 15}">${esc(r.text)}</text>`; });
  if (o.ref) s += `<line class="bf7-ref" x1="${x(o.ref.v)}" x2="${x(o.ref.v)}" y1="2" y2="${H - 18}"/><text class="bf7-ax" x="${x(o.ref.v)}" y="${H - 6}" text-anchor="middle">${esc(o.ref.text)}</text>`;
  return s + `</svg>`;
}

/** waterfall (cost roll-up): steps [{label, v}] + total */
export function waterfall(steps, o = {}) {
  const W = o.w || 560, H = o.h || 240, L = 54, R = 10, T = 14, B = 46, n = steps.length + 1, tot = steps.reduce((a, b) => a + b.v, 0), wsc = niceScale(0, Math.max(tot, o.price || 0) * 1.06), mx = wsc.mx, y = (v) => T + (H - T - B) * (1 - v / mx), bw = (W - L - R) / n;
  let s = `<svg class="bf7-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "waterfall")}">`;
  for (let k = 0; k <= wsc.k; k++) { const v = wsc.step * k; s += `<line class="bf7-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="bf7-ax" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${esc(f0(v))}</text>`; }
  let acc = 0;
  steps.forEach((st, i) => {
    const x0 = L + bw * i + bw * 0.12, w = bw * 0.76;
    s += `<rect x="${x0.toFixed(1)}" y="${y(acc + st.v).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, y(acc) - y(acc + st.v)).toFixed(1)}" rx="2" fill="var(--bf7-s1)" fill-opacity="0.75"><title>${esc(st.label)}: ${esc(f2(st.v))} €</title></rect>`;
    s += `<text class="bf7-ax2" x="${x0 + w / 2}" y="${y(acc + st.v) - 4}" text-anchor="middle">${esc(f1(st.v))}</text>`;
    s += `<text class="bf7-ax" x="${x0 + w / 2}" y="${H - 28}" text-anchor="middle">${esc(st.label)}</text>`;
    if (i < steps.length - 1) s += `<line class="bf7-grid" x1="${x0 + w}" x2="${x0 + bw}" y1="${y(acc + st.v)}" y2="${y(acc + st.v)}"/>`;
    acc += st.v;
  });
  const x0 = L + bw * steps.length + bw * 0.12, w = bw * 0.76;
  s += `<rect x="${x0}" y="${y(tot)}" width="${w}" height="${y(0) - y(tot)}" rx="2" fill="var(--bf7-s2)"><title>${esc(o.totalLabel || "total")}: ${esc(f2(tot))} €</title></rect><text class="bf7-ax2" x="${x0 + w / 2}" y="${y(tot) - 4}" text-anchor="middle" font-weight="700">${esc(f2(tot))}</text><text class="bf7-ax" x="${x0 + w / 2}" y="${H - 28}" text-anchor="middle">${esc(o.totalLabel || "total")}</text>`;
  if (o.price) s += `<line class="bf7-ref" x1="${L}" x2="${W - R}" y1="${y(o.price)}" y2="${y(o.price)}"/><text class="bf7-ax2" x="${W - R}" y="${y(o.price) - 4}" text-anchor="end">list price ${esc(f0(o.price))} €</text>`;
  return s + `<text class="bf7-ax" x="${L}" y="${H - 8}">€ per piece</text></svg>`;
}

/** MRP record (time-phased table) of one item */
export function mrpTable(r, weekStart) {
  const H = r.gross.length, wk = (t) => { const d = new Date(Date.parse(weekStart + "T00:00:00Z") + t * 7 * 86400000); return `W${t} ${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
  const row = (name, arr, cls = "", fmt = (v) => (Math.abs(v) < 1e-9 ? "" : +(+v).toFixed(2))) => `<tr class="${cls}"><th>${esc(name)}</th>${arr.slice(0, H).map((v) => `<td>${esc(fmt(v))}</td>`).join("")}</tr>`;
  return `<div class="table-wrap"><table class="bf7-tbl bf7-mrp"><thead><tr><th>${esc(r.name || "")}<br><span class="bf7-mut">on hand ${+r.oh.toFixed(2)} · SS ${r.ss} · LT ${r.lt} wk · ${esc(r.lot)}${r.q ? " " + r.q : ""}${r.lot === "EOQ" || r.lot === "POQ" ? ` (EOQ ${f0(r.EOQ)}${r.lot === "POQ" ? `, P = ${r.P} wk` : ""})` : ""} · LLC ${r.llc}</span></th>${Array.from({ length: H }, (_, t) => `<th>${wk(t)}</th>`).join("")}</tr></thead><tbody>
    ${row("Gross requirements", r.gross)}${row("Scheduled receipts", r.sr)}${row("Projected on hand", r.poh, "bf7-poh", (v) => +(+v).toFixed(2))}${row("Net requirements", r.net, "bf7-net")}${row("Planned order receipts", r.prc)}${row("Planned order releases", r.prl, "bf7-rel")}</tbody></table></div>`;
}
