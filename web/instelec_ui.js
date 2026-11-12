/* INSTALLATION tab – items 3 + 4: small shared UI helpers (no DOM state). */
export const $ = (id) => document.getElementById(id);
export const Q = new URLSearchParams(location.search);
export const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const f = (v, d = 1) => (v == null || isNaN(v) ? "–" : (+v).toFixed(d));
export const kA = (A) => f(A / 1000, 2) + " kA";
export const ok = (b, t1 = "OK", t0 = "FAIL") => `<span class="ie-st ${b ? "ie-ok" : "ie-bad"}">${b ? t1 : t0}</span>`;
export const warn = (t) => `<span class="ie-st ie-warn">${esc(t)}</span>`;
/* "What / Why / How / Check / Typical mistake" block (strings may contain simple HTML) */
export function wwh(o) {
  const row = (k, t) => (o[k] ? `<div class="ie-wk">${t}</div><div class="ie-wv">${o[k]}</div>` : "");
  return `<div class="ie-wwh">${row("what", "What")}${row("why", "Why")}${row("how", "How")}${row("check", "Check")}${row("mistake", "Typical mistake")}</div>`;
}
export function card(id, title, sub, body) {
  return `<div class="card ie-card" id="${id}"><div class="card-head"><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}</div>${body}</div>`;
}
export function tbl(head, rows, cls = "") {
  return `<div class="table-wrap"><table class="ie-tbl ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export const ex = (t = "example") => `<span class="ie-ex">${t}</span>`;
export function seg(name, opts, cur) {
  return `<span class="seg">${opts.map(([v, t]) => `<button class="seg-btn${String(v) === String(cur) ? " active" : ""}" data-ieseg="${name}" data-v="${esc(v)}">${esc(t)}</button>`).join("")}</span>`;
}
export function num(id, v, step = 1, min = 0, max = 1e6, w = 70) { return `<input type="number" id="${id}" value="${v}" step="${step}" min="${min}" max="${max}" style="width:${w}px">`; }
export function sel(id, opts, cur) { return `<select id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`; }
/* info box: {t, w, r, y, c, f} → title, what, rating (example), why, check, typical failure */
export function infoHtml(it, R) {
  if (!it) return "";
  const r = typeof it.r === "function" ? it.r(R) : it.r;
  return `<h3>${esc(it.t)}</h3><p>${it.w}</p>${r ? `<p><b>Rating (example):</b> ${r}</p>` : ""}<p><b>Why:</b> ${it.y}</p><p><b>Check:</b> ${it.c}</p><p><b>Typical mistake / failure:</b> ${it.f}</p>`;
}
/* test log (&ietest): console line + hidden DOM list (readable with chrome --dump-dom) */
const TLOG = [];
export function tlog(name, val, exp, tol) {
  let pass;
  if (typeof exp === "number") pass = Math.abs(val - exp) <= (tol == null ? Math.abs(exp) * 0.005 + 1e-9 : tol);
  else if (typeof exp === "boolean") pass = !!val === exp;
  else pass = String(val) === String(exp);
  const line = `IETEST ${pass ? "ok  " : "FAIL"} ${name}: ${typeof val === "number" ? +val.toFixed(4) : val} (expected ${exp})`;
  TLOG.push(line); console.log(line);
  let el = document.getElementById("ieTestOut");
  if (!el) { el = document.createElement("pre"); el.id = "ieTestOut"; el.hidden = true; document.body.appendChild(el); }
  el.textContent = TLOG.join("\n");
  return pass;
}
