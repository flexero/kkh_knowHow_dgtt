/* Ball screw + guide factory – item 5 quality: tiny SVG chart helper (line / dots / bars / limit lines), theme colours via CSS classes in bsfqa.css. */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function ticks(a, b, n = 6) {
  if (!(b > a)) { b = a + 1; }
  const raw = (b - a) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(10)); return { v: out, st };
}
export const fmt = (v, st) => { const d = st >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(st) - 1e-9)); return (+v).toFixed(d).replace("-", "−"); };
export function range(vals, pad = 0.08) { let lo = Infinity, hi = -Infinity; for (const v of vals) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } if (!Number.isFinite(lo)) return [0, 1]; if (hi - lo < 1e-12) { lo -= 1; hi += 1; } const d = (hi - lo) * pad; return [lo - d, hi + d]; }
/* o: { w, h, xr, yr, xl, yl, series: [{ pts, cls, dots, bars, bw, flags }], hl: [{ y, cls, t }], vl: [{ x, cls, t }], bands: [{ x0, x1, y0, y1, cls }], marks: [{ x, y, t, cls }], left, title, aria } */
export function plot(o) {
  const W = o.w || 640, H = o.h || 260, L = o.left || 54, R = o.right || 16, T = o.title ? 24 : 10, B = 38;
  const [x0, x1] = o.xr, [y0, y1] = o.yr, pw = W - L - R, ph = H - T - B;
  const X = (v) => L + (v - x0) / (x1 - x0) * pw, Y = (v) => T + ph - (v - y0) / (y1 - y0) * ph;
  const tx = ticks(x0, x1, o.xn || 8), ty = ticks(y0, y1, o.yn || 5), s = [];
  s.push(`<svg class="bf5-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.aria || o.title || "chart")}">`);
  if (o.title) s.push(`<text x="${L}" y="15" class="bf5-pt">${esc(o.title)}</text>`);
  s.push(`<rect x="${L}" y="${T}" width="${pw}" height="${ph}" class="bf5-frame"/>`);
  for (const b of o.bands || []) { const xa = X(b.x0 ?? x0), xb = X(b.x1 ?? x1), ya = Y(b.y1 ?? y1), yb = Y(b.y0 ?? y0); s.push(`<rect x="${Math.min(xa, xb).toFixed(1)}" y="${Math.min(ya, yb).toFixed(1)}" width="${Math.abs(xb - xa).toFixed(1)}" height="${Math.abs(yb - ya).toFixed(1)}" class="${b.cls || "bf5-band"}"/>`); }
  for (const v of ty.v) s.push(`<line x1="${L}" x2="${L + pw}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="bf5-grid"/><text x="${L - 5}" y="${(Y(v) + 4).toFixed(1)}" class="bf5-tk" text-anchor="end">${fmt(v, ty.st)}</text>`);
  for (const v of tx.v) s.push(`<line y1="${T}" y2="${T + ph}" x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" class="bf5-grid"/><text x="${X(v).toFixed(1)}" y="${T + ph + 15}" class="bf5-tk" text-anchor="middle">${o.xf ? o.xf(v) : fmt(v, tx.st)}</text>`);
  if (o.xl) s.push(`<text x="${L + pw / 2}" y="${H - 5}" class="bf5-al" text-anchor="middle">${esc(o.xl)}</text>`);
  if (o.yl) s.push(`<text x="12" y="${T + ph / 2}" class="bf5-al" text-anchor="middle" transform="rotate(-90 12 ${T + ph / 2})">${esc(o.yl)}</text>`);
  s.push(`<g clip-path="none">`);
  for (const se of o.series || []) {
    const pts = se.pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (se.bars) { const bw = Math.max(1, (se.bw || (x1 - x0) / 30) / (x1 - x0) * pw - 1); for (const [x, y] of pts) { const yt = Y(Math.max(y, y0)), yb = Y(Math.max(y0, Math.min(0, y1))); s.push(`<rect x="${(X(x) - bw / 2).toFixed(1)}" y="${Math.min(yt, yb).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.abs(yb - yt).toFixed(1)}" class="${se.cls || "bf5-bar"}"/>`); } continue; }
    if (!se.dotsOnly && pts.length > 1) s.push(`<polyline points="${pts.map((p) => X(p[0]).toFixed(1) + "," + Y(Math.max(y0 - (y1 - y0), Math.min(y1 + (y1 - y0), p[1]))).toFixed(1)).join(" ")}" class="${se.cls || "bf5-l1"}"/>`);
    if (se.dots) pts.forEach((p, i) => { const bad = se.flags && se.flags[i] && se.flags[i].length; s.push(`<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="${bad ? 4 : 2.6}" class="${bad ? "bf5-dotbad" : se.dcls || "bf5-dot"}">${bad ? `<title>rule ${se.flags[i].join(", ")}</title>` : ""}</circle>`); });
  }
  s.push(`</g>`);
  for (const l of o.hl || []) { if (l.y < y0 || l.y > y1) continue; s.push(`<line x1="${L}" x2="${L + pw}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}" class="${l.cls || "bf5-lim"}"/>`); if (l.t) s.push(`<text x="${L + pw - 4}" y="${(Y(l.y) - 3).toFixed(1)}" class="bf5-ll" text-anchor="end">${esc(l.t)}</text>`); }
  for (const l of o.vl || []) { if (l.x < x0 || l.x > x1) continue; s.push(`<line y1="${T}" y2="${T + ph}" x1="${X(l.x).toFixed(1)}" x2="${X(l.x).toFixed(1)}" class="${l.cls || "bf5-lim"}"/>`); if (l.t) s.push(`<text x="${(X(l.x) + 3).toFixed(1)}" y="${T + 12}" class="bf5-ll">${esc(l.t)}</text>`); }
  for (const m of o.marks || []) s.push(`<text x="${X(m.x).toFixed(1)}" y="${Y(m.y).toFixed(1)}" class="${m.cls || "bf5-ll"}" text-anchor="${m.a || "middle"}">${esc(m.t)}</text>`);
  s.push(`</svg>`);
  return s.join("");
}
/* histogram bins */
export function histo(v, lo, hi, nb = 16) { const w = (hi - lo) / nb, c = new Array(nb).fill(0); for (const x of v) { const k = Math.floor((x - lo) / w); if (k >= 0 && k < nb) c[k]++; } return c.map((n, i) => [lo + (i + 0.5) * w, n]); }
