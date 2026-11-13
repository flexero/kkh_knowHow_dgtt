/* Ball screw + guide factory – item 6 MES – render helpers (SVG / HTML strings, no state).  Guide: docs/45_bsf_mes.md.
 *   gantt(sched, o) · pareto(items, o) · lossBars(o) · tree(node) · dmPattern(text, size) · labelSvg(o) · bars(rows, o)
 * Colours: route colours of item 2 (ROUTES[r].color); text uses the theme variables of style.css (light + dark). */
import { ROUTES } from "./bsfmfg_data.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const RCOL = Object.fromEntries(Object.keys(ROUTES).map((r) => [r, ROUTES[r].color || "#777"]));
const f1 = (v) => (+v).toFixed(1);

/* ------------------------------------------------------------------ Gantt per machine
 * sched = { ops: [{ lot, route, machine, start, end, setup, setupKind, load, no, qty, due }], tod0, shifts }, o = { rows: [{ id, type, ht }], zoomMin, label(min) → text,
 *            sel (lot id), down: { machineId: true }, width } */
export function gantt(sched, o) {
  const rows = o.rows, rowH = 13, top = 26, lw = 112, span = Math.max(60, o.zoomMin || 1440), W0 = o.width || 1100, ppm = W0 / span;
  const horizon = Math.min(14 * 1440, Math.max(span, ...sched.ops.map((x) => x.end), 60));
  const W = lw + horizon * ppm + 10, H = top + rows.length * rowH + 8, idx = Object.fromEntries(rows.map((r, i) => [r.id, i]));
  const tod0 = sched.tod0 || 0, shifts = sched.shifts || 2, X = (m) => lw + m * ppm;
  let g = `<svg class="bf6-gantt" viewBox="0 0 ${Math.round(W)} ${H}" width="${Math.round(W)}" height="${H}" role="img" aria-label="Gantt chart of the schedule">
  <defs><pattern id="bf6Hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff" opacity="0.35"/><line x1="0" y1="0" x2="0" y2="5" stroke="#000" stroke-width="1.6" opacity="0.45"/></pattern></defs>`;
  // non-working time per row
  for (const [ri, r] of rows.entries()) {
    const Hw = Math.min(1440, (r.ht ? Math.max(3, shifts) : shifts) * 450); if (Hw >= 1440) continue;
    for (let d = -1; d * 1440 - tod0 < horizon; d++) { const a = Math.max(0, d * 1440 - tod0 + Hw), b = Math.min(horizon, (d + 1) * 1440 - tod0); if (b > a) g += `<rect x="${X(a).toFixed(1)}" y="${top + ri * rowH}" width="${((b - a) * ppm).toFixed(1)}" height="${rowH}" class="bf6-off"/>`; }
  }
  // grid + axis
  const step = span <= 600 ? 60 : span <= 1500 ? 120 : span <= 4400 ? 360 : 720;
  for (let m = 0; m <= horizon; m += step) g += `<line x1="${X(m).toFixed(1)}" y1="${top - 4}" x2="${X(m).toFixed(1)}" y2="${H - 6}" class="bf6-grid"/><text x="${(X(m) + 2).toFixed(1)}" y="${top - 8}" class="bf6-ax">${esc(o.label ? o.label(m) : "+" + m / 60 + " h")}</text>`;
  let lastType = "";
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    if (r.type !== lastType) { g += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" class="bf6-sep"/>`; lastType = r.type; }
    g += `<text x="3" y="${y + rowH - 3}" class="bf6-rl${o.down && o.down[r.id] ? " bf6-rdown" : ""}${r.id === o.selM ? " bf6-rsel" : ""}" data-m="${esc(r.id)}">${esc(r.id)}${o.down && o.down[r.id] ? " ✖" : ""}</text>`;
  });
  const seen = {};
  for (const x of sched.ops) {
    const i = idx[x.machine]; if (i == null) continue;
    if (x.load) { const k = x.machine + x.load; if (seen[k]) continue; seen[k] = 1; }
    const y = top + i * rowH + 1.5, x0 = X(x.start), w = Math.max(1.2, (x.end - x.start) * ppm), c = RCOL[x.route] || "#888", sel = o.sel && (x.lot === o.sel || (x.load && sched.ops.some((z) => z.load === x.load && z.machine === x.machine && z.lot === o.sel)));
    const sw = x.setup > 0 ? Math.min(w, x.setup * ppm) : 0, lots = x.load ? sched.ops.filter((z) => z.load === x.load && z.machine === x.machine).map((z) => z.lot) : [x.lot];
    const tip = `${x.machine} · ${x.load ? "furnace " + x.load + ": " + lots.join(" + ") + ` (${x.fill}/${x.cap} pcs)` : "lot " + x.lot + " op " + x.no + " · " + x.qty + " pcs"}\nstart ${o.label ? o.label(x.start) : x.start} · end ${o.label ? o.label(x.end) : x.end}${x.setup ? `\nset-up ${x.setup} min (${x.setupKind})` : ""}${x.fixed ? "\n(running now)" : ""}`;
    g += `<g class="bf6-bar${sel ? " on" : ""}" data-lot="${esc(x.lot)}"><title>${esc(tip)}</title><rect x="${x0.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${rowH - 3}" fill="${c}" rx="1.5"/>${sw > 0.8 ? `<rect x="${x0.toFixed(1)}" y="${y}" width="${sw.toFixed(1)}" height="${rowH - 3}" fill="url(#bf6Hatch)"/>` : ""}${w > 46 ? `<text x="${(x0 + sw + 2).toFixed(1)}" y="${y + rowH - 5}" class="bf6-bt">${esc(x.load ? x.load : x.lot.replace(/^WO-/, ""))}</text>` : ""}</g>`;
  }
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ Pareto (bars + cumulative %) */
export function pareto(items, o = {}) {
  const W = o.w || 640, H = o.h || 250, l = 46, r = 40, t = 14, b = 70, n = Math.max(1, items.length), bw = (W - l - r) / n, max = Math.max(1, ...items.map((x) => x.min));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="bf6-chart" role="img" aria-label="downtime Pareto chart">`;
  for (let k = 0; k <= 4; k++) { const y = t + (H - t - b) * (1 - k / 4); s += `<line x1="${l}" y1="${y}" x2="${W - r}" y2="${y}" class="bf6-grid"/><text x="${l - 4}" y="${y + 4}" class="bf6-ax" text-anchor="end">${max >= 20 ? Math.round(max * k / 4) : (max * k / 4).toFixed(1)}</text><text x="${W - r + 4}" y="${y + 4}" class="bf6-ax">${k * 25} %</text>`; }
  let pl = "";
  items.forEach((x, i) => {
    const h = (H - t - b) * x.min / max, X = l + i * bw;
    s += `<rect x="${(X + bw * 0.12).toFixed(1)}" y="${(H - b - h).toFixed(1)}" width="${(bw * 0.76).toFixed(1)}" height="${h.toFixed(1)}" class="bf6-pbar"><title>${esc(x.reason + " " + x.text + ": " + x.min + " min, " + x.n + " stops")}</title></rect>`;
    s += `<text x="${(X + bw / 2).toFixed(1)}" y="${H - b + 12}" class="bf6-ax" text-anchor="end" transform="rotate(-35 ${(X + bw / 2).toFixed(1)} ${H - b + 12})">${esc(x.reason + " " + x.text.slice(0, 18))}</text>`;
    pl += `${i ? "L" : "M"}${(X + bw / 2).toFixed(1)} ${(t + (H - t - b) * (1 - x.cum / 100)).toFixed(1)} `;
  });
  s += `<text x="${l - 34}" y="${t - 3}" class="bf6-ax">min</text>`;
  return s + (pl ? `<path d="${pl}" class="bf6-cum"/>` : "") + `</svg>`;
}

/* ------------------------------------------------------------------ OEE loss bars (minutes) */
export function lossBars(o) {
  const rows = [["Planned busy time PBT", o.PBT, "bf6-l0"], ["– breakdowns (down)", o.down, "bf6-l1"], ["– set-up", o.setup, "bf6-l1"], ["– starved / blocked", o.starved + o.blocked, "bf6-l1"],
    ["= actual production time APT (run)", o.run, "bf6-l2"], ["– speed loss APT × (1 − E)", o.speedLoss, "bf6-l1"], ["– quality loss", o.qualityLoss, "bf6-l1"], ["= fully productive time (OEE × PBT)", o.PBT * o.OEE, "bf6-l3"]];
  const W = 640, rh = 22, l = 230, max = Math.max(1, o.PBT);
  let s = `<svg viewBox="0 0 ${W} ${rows.length * rh + 8}" class="bf6-chart" role="img" aria-label="OEE loss tree">`;
  rows.forEach(([t, v, c], i) => { const w = (W - l - 70) * Math.max(0, v) / max; s += `<text x="4" y="${i * rh + 15}" class="bf6-ax2">${esc(t)}</text><rect x="${l}" y="${i * rh + 4}" width="${w.toFixed(1)}" height="${rh - 7}" class="${c}"/><text x="${(l + w + 4).toFixed(1)}" y="${i * rh + 15}" class="bf6-ax2">${f1(v / 60)} h</text>`; });
  return s + `</svg>`;
}

/* ------------------------------------------------------------------ horizontal bars (OEE per type etc.) */
export function bars(rows, o = {}) {
  const W = o.w || 640, rh = 17, l = o.l || 90, max = o.max || Math.max(1e-9, ...rows.map((r) => r[1]));
  let s = `<svg viewBox="0 0 ${W} ${rows.length * rh + 6}" class="bf6-chart" role="img" aria-label="${esc(o.aria || "bar chart")}">`;
  if (o.target != null) { const x = l + (W - l - 60) * o.target / max; s += `<line x1="${x}" y1="0" x2="${x}" y2="${rows.length * rh + 4}" class="bf6-tgt"/>`; }
  rows.forEach(([t, v, c], i) => { const w = (W - l - 60) * Math.max(0, v) / max; s += `<text x="3" y="${i * rh + 13}" class="bf6-ax2">${esc(t)}</text><rect x="${l}" y="${i * rh + 3}" width="${w.toFixed(1)}" height="${rh - 5}" class="${c || "bf6-l2"}"/><text x="${(l + w + 4).toFixed(1)}" y="${i * rh + 13}" class="bf6-ax2">${esc(o.fmt ? o.fmt(v) : v)}</text>`; });
  return s + `</svg>`;
}

/* ------------------------------------------------------------------ genealogy tree (HTML) */
export function tree(n, opts = {}) {
  if (!n) return "";
  if (n.missing) return `<div class="bf6-node bf6-miss"><b>${esc(n.sn)}</b> – not in the MES (component made before the MES started or not scanned)</div>`;
  const qa = (n.qa || []).slice(0, 8);
  return `<div class="bf6-node${n.sn === opts.hl ? " on" : ""}">
    <div class="bf6-nh"><b class="bf6-sn" data-sn="${esc(n.sn)}">${esc(n.sn)}</b> <span class="bf6-kind">${esc(n.kind)}</span> ${esc(n.code)} · lot <b>${esc(n.lot)}</b> · ${esc(n.wo)}${n.heat ? ` · heat <b class="bf6-heat" data-heat="${esc(n.heat)}">${esc(n.heat)}</b>${n.heatInfo ? ` (${esc(n.heatInfo.mat)}, ${esc(n.heatInfo.cert)})` : ""}` : ""} · status ${esc(n.status)}${n.grade ? " · grade " + esc(n.grade) : ""}</div>
    ${n.match ? `<div class="bf6-mut">${esc(n.match)}</div>` : ""}
    ${n.ops && n.ops.length ? `<div class="bf6-mut">operations: ${n.ops.map((o) => `${esc(o.op)} ${esc(o.machine || "?")}${o.scrap ? ` (scrap ${o.scrap})` : ""}`).join(" → ")}</div>` : ""}
    ${qa.length ? `<table class="bf6-tbl bf6-small"><thead><tr><th>char</th><th>value</th><th>limits</th><th>decision</th><th>op / machine</th><th>gauge</th><th>source</th></tr></thead><tbody>${qa.map((r) => `<tr><td>${esc(r.char)}</td><td>${r.value == null ? "–" : esc(r.value)} ${esc(r.unit || "")}</td><td>${r.lsl ?? ""} … ${r.usl ?? ""}</td><td class="${r.decision === "NOK" ? "bf6-nok" : "bf6-ok"}">${esc(r.decision)}</td><td>${esc(r.op || "")} ${esc(r.machine || "")}</td><td>${esc(r.gauge || "")}</td><td>${esc(r.source || "QA item 5")}</td></tr>`).join("")}</tbody></table>` : ""}
    ${n.children && n.children.length ? `<div class="bf6-kids">${n.children.map((c) => tree(c, opts)).join("")}</div>` : ""}
  </div>`;
}

/* ------------------------------------------------------------------ Data Matrix ILLUSTRATION (finder pattern + hash cells – the printer encodes the real ECC 200 symbol) */
export function dmPattern(text, n = 18, px = 4) {
  let h = 2166136261; const cells = [];
  for (let i = 0; i < n * n; i++) { h ^= text.charCodeAt(i % Math.max(1, text.length)) + i; h = Math.imul(h, 16777619) >>> 0; cells.push(h & 1); }
  let s = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const on = x === 0 || y === n - 1 ? 1 : y === 0 ? (x % 2 === 0 ? 1 : 0) : x === n - 1 ? (y % 2 === 1 ? 1 : 0) : cells[y * n + x];
    if (on) s += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}"/>`;
  }
  return s;
}
export function labelSvg(o) {
  return `<svg viewBox="0 0 420 140" class="bf6-label" role="img" aria-label="label preview"><rect x="1" y="1" width="418" height="138" rx="6" fill="#fff" stroke="#000"/>
    <g transform="translate(14 22)" fill="#000">${dmPattern(o.raw || o.serial, 18, 5)}</g>
    <text x="118" y="34" font-size="17" font-weight="700" fill="#000">${esc(o.code)}</text><text x="118" y="58" font-size="14" fill="#000">SN ${esc(o.serial)}</text>
    <text x="118" y="78" font-size="13" fill="#000">LOT ${esc(o.lot)}</text><text x="118" y="98" font-size="11" fill="#000">${esc(o.hr).slice(0, 52)}</text>
    <text x="118" y="114" font-size="11" fill="#000">${esc(o.hr).slice(52, 104)}</text><text x="14" y="132" font-size="10" fill="#555">EXAMPLE – Data Matrix pattern is an illustration; the printer builds the real ECC 200 symbol</text></svg>`;
}
