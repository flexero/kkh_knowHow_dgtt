/* Installation tab – items 1 + 2 – small shared UI helpers (cards, What/Why/How box, info box, inputs, SVG chart). */
export const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const f = (v, d = 1) => (v === null || v === undefined || !isFinite(v) ? "–" : (+v).toFixed(d));
export const fs = (v, d = 3) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d);
export const ok = (b, t1 = "OK", t2 = "NOT OK") => `<span class="im-chip ${b ? "im-ok" : "im-bad"}">${b ? t1 : t2}</span>`;

/* What / Why / How / Check / Typical mistake */
export function wwh(o) {
  const row = (k, t) => (o[k] ? `<div class="im-w-${k}"><b>${t}</b><span>${o[k]}</span></div>` : "");
  return `<div class="im-wwh">${row("what", "What")}${row("why", "Why")}${row("how", "How")}${row("check", "Check")}${row("mistake", "Typical mistake")}</div>`;
}
export function card(id, title, sub, o, body) {
  return `<div class="card im-card" id="${id}"><div class="card-head"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}</div>${o ? wwh(o) : ""}${body || ""}</div>`;
}
/* number input */
export function num(id, label, v, step, unit, note) {
  return `<label class="im-in" title="${esc(note || label)}"><span>${label}</span><input type="number" id="${id}" value="${v}" step="${step}"><i>${unit || ""}</i></label>`;
}
export function sel(id, label, opts, v) {
  return `<label class="im-in"><span>${label}</span><select id="${id}">${opts.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? " selected" : ""}>${esc(o[1])}</option>`).join("")}</select></label>`;
}
export const val = (id) => { const e = $(id); return e ? parseFloat(e.value) : NaN; };

/* info boxes: elements with data-im="key" → INFO[key] = [title, what, why, check, mistake] shown in the panel */
export function bindInfo(root, INFO, panelId, start) {
  const show = (k) => {
    const p = $(panelId), it = INFO[k]; if (!p || !it) return;
    p.innerHTML = `<h3>${it[0]}</h3><p><b>What:</b> ${it[1]}</p><p><b>Why:</b> ${it[2]}</p><p><b>Check:</b> ${it[3]}</p><p><b>Typical mistake:</b> ${it[4]}</p>`;
    root.querySelectorAll("[data-im]").forEach((e) => e.classList.toggle("im-sel", e.dataset.im === k));
  };
  root.addEventListener("click", (e) => { const h = e.target.closest("[data-im]"); if (h && INFO[h.dataset.im] && root.contains(h)) show(h.dataset.im); });
  if (start && INFO[start]) show(start);
  return show;
}

/* simple SVG line chart, one y-axis (linear or log). series: [{pts:[[x,y]..], cls, name, dash}] · marks: [{x,y,cls,label}] */
export function chart(o) {
  const W = o.w || 520, H = o.h || 260, L = 48, R = 14, T = 14, B = 34;
  const [x0, x1] = o.xr, [y0, y1] = o.yr;
  const sx = (x) => L + (x - x0) / (x1 - x0) * (W - L - R);
  const ly = (y) => (o.ylog ? Math.log10(Math.max(y, 1e-9)) : y);
  const sy = (y) => { const a = ly(y0), b = ly(y1); return T + (1 - (Math.min(Math.max(ly(y), a), b) - a) / (b - a)) * (H - T - B); };
  let s = `<svg class="im-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.title || "chart")}">`;
  (o.xt || []).forEach((x) => { s += `<line class="im-grid" x1="${sx(x)}" x2="${sx(x)}" y1="${T}" y2="${H - B}"/><text class="im-tk" x="${sx(x)}" y="${H - B + 14}" text-anchor="middle">${x}</text>`; });
  (o.yt || []).forEach((y) => { s += `<line class="im-grid" x1="${L}" x2="${W - R}" y1="${sy(y)}" y2="${sy(y)}"/><text class="im-tk" x="${L - 5}" y="${sy(y) + 4}" text-anchor="end">${y}</text>`; });
  s += `<line class="im-ax" x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}"/><line class="im-ax" x1="${L}" x2="${L}" y1="${T}" y2="${H - B}"/>`;
  (o.bands || []).forEach((b) => { s += `<rect class="${b.cls}" x="${sx(b.x0)}" y="${T}" width="${sx(b.x1) - sx(b.x0)}" height="${H - T - B}"/>`; if (b.label) s += `<text class="im-tk" x="${sx(b.x0) + 4}" y="${T + 12}">${b.label}</text>`; });
  (o.hl || []).forEach((h) => { s += `<line class="${h.cls}" x1="${L}" x2="${W - R}" y1="${sy(h.y)}" y2="${sy(h.y)}"/>${h.label ? `<text class="im-tk" x="${W - R - 3}" y="${sy(h.y) - 4}" text-anchor="end">${h.label}</text>` : ""}`; });
  (o.vl || []).forEach((h) => { s += `<line class="${h.cls}" x1="${sx(h.x)}" x2="${sx(h.x)}" y1="${T}" y2="${H - B}"/>${h.label ? `<text class="im-tk" x="${sx(h.x) + 4}" y="${H - B - 6}">${h.label}</text>` : ""}`; });
  (o.series || []).forEach((se) => { s += `<polyline class="${se.cls}" fill="none" points="${se.pts.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ")}"/>`; });
  (o.marks || []).forEach((m) => { s += `<circle class="${m.cls}" cx="${sx(m.x)}" cy="${sy(m.y)}" r="${m.r || 5}"/>${m.label ? `<text class="im-tl" x="${sx(m.x) + 8}" y="${sy(m.y) - 8}">${esc(m.label)}</text>` : ""}`; });
  s += `<text class="im-tl" x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle">${o.xlabel || ""}</text>`;
  s += `<text class="im-tl" transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle">${o.ylabel || ""}</text>`;
  const leg = (o.series || []).filter((x) => x.name);
  if (leg.length >= 2) leg.forEach((se, i) => { const y = T + 8 + i * 15; s += `<line class="${se.cls}" x1="${W - R - 150}" x2="${W - R - 128}" y1="${y}" y2="${y}"/><text class="im-tk" x="${W - R - 123}" y="${y + 4}">${esc(se.name)}</text>`; });
  return s + "</svg>";
}
