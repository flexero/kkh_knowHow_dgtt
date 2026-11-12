/* Helpers for the LIVE spindle assembly station terminal (web/spst.js): formatting + small SVG charts.
   Offline, no libraries.  One y-axis per chart (never dual axes), 2 px lines, legend for >= 2 series,
   hover crosshair with the values (one delegated listener for all charts made here). */

export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const p2 = (n) => String(n).padStart(2, "0");
export function tm(t) { if (!t) return "–"; const d = new Date(t * 1000); return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`; }
export function dt(t) { if (!t) return "–"; const d = new Date(t * 1000); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; }
export function ago(t, now) { if (!t) return "never"; const s = Math.max(0, Math.round((now || Date.now() / 1000) - t)); return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`; }
/** number to a short string: 3 decimals max, no trailing zeros; big numbers with thin spaces */
export function num(v, d = 3) {
  if (v === null || v === undefined || v === "") return "–";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v !== "number") return String(v);
  if (!isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 10000) return Math.round(v).toLocaleString("en-US").replace(/,/g, " ");
  const dd = a >= 1000 ? 0 : a >= 100 ? Math.min(d, 1) : a >= 10 ? Math.min(d, 2) : d;
  return String(+v.toFixed(dd));
}
export const val = (v, u) => (v === null || v === undefined ? "–" : num(v) + (u && typeof v === "number" ? " " + u : ""));

/* ------------------------------------------------------------------ nice axis ticks */
function ticks(a, b, n = 4) {
  if (!(b > a)) { b = a + 1; }
  const raw = (b - a) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(a / st) * st; v <= b + st * 1e-6; v += st) out.push(+v.toFixed(10));
  return out;
}

let uid = 0;
const CH = {};   // chart id -> data for the hover layer

/**
 * Line chart (one y axis).
 * o = { title, unit, w, h, xl (x unit text), series: [{n, c (css colour), pts: [[x, y], …], dash}],
 *       hl: [{y, n, c, dash}] (horizontal lines: limits, mean), vl: [{x, n}] (vertical marks), y0, y1, x0, x1, step (step line) }
 */
export function lineChart(o) {
  const W = o.w || 360, H = o.h || 150, L = 46, R = 10, T = 22, B = 24, id = "stc" + (++uid);
  const all = o.series.flatMap((s) => s.pts.filter((p) => p[1] !== null && p[1] !== undefined && isFinite(p[1])));
  let xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  (o.hl || []).forEach((h) => { if (h.y !== null && h.y !== undefined) ys.push(h.y); });
  let x0 = o.x0 ?? (xs.length ? Math.min(...xs) : 0), x1 = o.x1 ?? (xs.length ? Math.max(...xs) : 1);
  if (!(x1 > x0)) x1 = x0 + 1;
  let y0 = o.y0 ?? (ys.length ? Math.min(...ys) : 0), y1 = o.y1 ?? (ys.length ? Math.max(...ys) : 1);
  if (o.y0 === undefined && o.zero) y0 = Math.min(0, y0);
  if (!(y1 > y0)) { y1 = y0 + (Math.abs(y0) * 0.1 || 1); y0 = y0 - (Math.abs(y0) * 0.1 || 0); }
  const pad = (y1 - y0) * 0.08; if (o.y0 === undefined && !(o.zero && y0 === 0)) y0 -= pad; if (o.y1 === undefined) y1 += pad;
  const X = (x) => L + (x - x0) / (x1 - x0) * (W - L - R), Y = (y) => T + (1 - (y - y0) / (y1 - y0)) * (H - T - B);
  let s = `<svg class="st-chart" id="${id}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(o.title || "chart")}">`;
  s += `<text x="${L}" y="14" class="st-ct">${esc(o.title || "")}${o.unit ? ` <tspan class="st-cu">(${esc(o.unit)})</tspan>` : ""}</text>`;
  if (o.series.length > 1) {   // legend (right aligned, colour swatch + text in text colour)
    let lx = W - R; const items = [...o.series].reverse();
    items.forEach((sr) => { const tw = sr.n.length * 6.2 + 18; lx -= tw; s += `<rect x="${lx}" y="7" width="10" height="3" rx="1.5" fill="${sr.c}"/><text x="${lx + 13}" y="12" class="st-cl">${esc(sr.n)}</text>`; });
  }
  ticks(y0, y1, 3).forEach((v) => { const y = Y(v); if (y < T - 1 || y > H - B + 1) return; s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="st-grid"/><text x="${L - 5}" y="${y + 3.5}" class="st-tick" text-anchor="end">${num(v)}</text>`; });
  const xlW = o.xl ? o.xl.length * 5.3 + 12 : 0;
  ticks(x0, x1, 5).forEach((v) => { const x = X(v); if (x < L - 1 || x > W - R + 1 || (xlW && x > W - R - xlW)) return; s += `<text x="${x}" y="${H - 8}" class="st-tick" text-anchor="middle">${num(v)}</text>`; });
  if (o.xl) s += `<text x="${W - R}" y="${H - 8}" class="st-tick" text-anchor="end">${esc(o.xl)}</text>`;
  s += `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="st-axis"/>`;
  (o.vl || []).forEach((v) => { const x = X(v.x); if (x < L || x > W - R) return; s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - B}" class="st-vl"/>${v.n ? `<text x="${x + 2}" y="${T + 8}" class="st-cl">${esc(v.n)}</text>` : ""}`; });
  (o.hl || []).forEach((h) => { if (h.y === null || h.y === undefined) return; const y = Y(h.y); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${h.c || "var(--critical)"}" stroke-width="1.2" ${h.dash !== false ? 'stroke-dasharray="5 3"' : ""}/>${h.right ? `<text x="${W - R - 3}" y="${y - 3}" class="st-cl" text-anchor="end">` : `<text x="${L + 4}" y="${y - 3}" class="st-cl">`}${esc(h.n || "")}</text>`; });
  o.series.forEach((sr) => {
    const pts = sr.pts.filter((p) => p[1] !== null && p[1] !== undefined && isFinite(p[1]));
    if (!pts.length) return;
    let d = "";
    pts.forEach((p, i) => { const x = X(p[0]).toFixed(1), y = Y(p[1]).toFixed(1); if (!i) d += `M${x},${y}`; else if (o.step) d += `H${x}V${y}`; else d += `L${x},${y}`; });
    if (o.step && o.x1 !== undefined) d += `H${X(o.x1).toFixed(1)}`;
    if (!sr.dots) s += `<path d="${d}" fill="none" stroke="${sr.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${sr.dash ? `stroke-dasharray="${sr.dash}"` : ""}/>`;
    if (sr.dots || pts.length === 1) pts.forEach((p) => { s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="4" fill="${p[2] || sr.c}" stroke="var(--surface)" stroke-width="2"/>`; });
  });
  if (o.marker) { const x = X(o.marker.x), y = Y(o.marker.y); s += `<circle cx="${x}" cy="${y}" r="5" fill="${o.marker.c || "var(--text)"}" stroke="var(--surface)" stroke-width="2"/>`; }
  s += `<line class="st-xh" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/>`;
  s += "</svg>";
  CH[id] = { W, L, R, X0: x0, X1: x1, series: o.series.map((sr) => ({ n: sr.n, u: sr.u || o.unit || "", pts: sr.pts, lab: sr.lab })), xl: o.xl || "" };
  return s;
}

/* hover: crosshair + tooltip with the values nearest to the pointer */
let tip = null;
document.addEventListener("pointermove", (e) => {
  const svg = e.target && e.target.closest ? e.target.closest("svg.st-chart") : null;
  if (!tip) { tip = document.createElement("div"); tip.className = "st-tip"; tip.hidden = true; document.body.appendChild(tip); }
  document.querySelectorAll("svg.st-chart .st-xh[visibility=visible]").forEach((l) => { if (!svg || !svg.contains(l)) l.setAttribute("visibility", "hidden"); });
  if (!svg || !CH[svg.id]) { tip.hidden = true; return; }
  const c = CH[svg.id], r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) / r.width * c.W;
  if (sx < c.L || sx > c.W - c.R) { tip.hidden = true; return; }
  const x = c.X0 + (sx - c.L) / (c.W - c.L - c.R) * (c.X1 - c.X0);
  let rows = "", bx = null;
  c.series.forEach((s) => { let best = null; s.pts.forEach((p) => { if (p[1] === null || p[1] === undefined) return; if (!best || Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p; });
    if (best) { bx = best[0]; rows += `<div>${esc(s.n)}: <b>${num(best[1])}${s.u ? " " + esc(s.u) : ""}</b>${s.lab && best[3] ? ` <span class="muted">${esc(best[3])}</span>` : ""}</div>`; } });
  if (!rows) { tip.hidden = true; return; }
  const line = svg.querySelector(".st-xh"), px = c.L + (bx - c.X0) / (c.X1 - c.X0) * (c.W - c.L - c.R);
  line.setAttribute("x1", px); line.setAttribute("x2", px); line.setAttribute("visibility", "visible");
  tip.innerHTML = `<div class="muted">${num(bx)} ${esc(c.xl)}</div>${rows}`; tip.hidden = false;
  const tx = Math.min(window.innerWidth - 220, e.clientX + 14); tip.style.left = tx + "px"; tip.style.top = (e.clientY + 14) + "px";
});

/** speed profile of the run-in as a step chart with the current step highlighted */
export function profileChart(profile, stepI, active, w = 360, h = 130) {
  const pts = []; let t = 0;
  profile.forEach(([rpm, min]) => { pts.push([t, rpm]); t += min; });
  const marks = [];
  if (stepI !== undefined && stepI !== null && profile[stepI]) { let t0 = 0; for (let i = 0; i < stepI; i++) t0 += profile[i][1]; marks.push({ x: t0, n: active ? "now" : "last" }); }
  return lineChart({ title: "Speed profile (example)", unit: "rpm", w, h, xl: "min (min. dwell)", series: [{ n: "set speed", c: "var(--st-s1)", pts }], step: true, x0: 0, x1: t, y0: 0, vl: marks });
}
