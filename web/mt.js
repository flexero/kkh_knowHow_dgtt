/* Machine tools tab (#mt) – modern machine types, trends, and selection for the compressor parts.
 * Data: mt_data.js (typical public values, examples). Deep links: /?mtitem=1&mtt=millturn#mt · ?mtitem=2&mttr=conn · ?mtitem=3&mtp=crankshaft */
import { CATS, TYPES, TRENDS, PARTS, CHECK } from "./mt_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const dots = (n, m = 5) => "●".repeat(n) + "○".repeat(m - n);

/* ------------------------------------------------------------------ item switch */
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-mtitem]").forEach((b) => b.classList.toggle("active", b.dataset.mtitem === n));
  ["1", "2", "3"].forEach((i) => { const el = $("mtItem" + i), it = $("mtIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  build(n);
}
document.querySelectorAll("[data-mtitem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.mtitem)));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "mt") build(current); };

/* ------------------------------------------------------------------ principle sketches (inline SVG, theme colours, small animations) */
function sketch(k) {
  const C = { m: "var(--text-2)", part: "#4f8fd6", tool: "#e1a32a", hot: "#e8542a", base: "var(--surface-2)" };
  const R = (x, y, w, h, f = C.base, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}" stroke="${C.m}" stroke-width="1" ${extra}/>`;
  const T = (x, y, t, a = "middle") => `<text x="${x}" y="${y}" text-anchor="${a}" class="mt-st">${t}</text>`;
  const spin = (cx, cy, d = 1.2) => `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="${d}s" repeatCount="indefinite"/>`;
  const arr = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--accent)" stroke-width="1.5" marker-end="url(#mtA)"/>`;
  let g = "";
  switch (k) {
    case "trunnion": g = R(30, 112, 140, 10) + R(50, 78, 100, 12) + R(44, 70, 8, 42) + R(148, 70, 8, 42) + `<g>${R(84, 56, 32, 22, C.part)}${spin(100, 67, 6)}</g>` + R(92, 10, 16, 30) + R(97, 40, 6, 14, C.tool) + arr(160, 84, 160, 64) + T(170, 60, "A tilt", "start") + T(100, 136, "X Y Z + A + C, tool tip control"); break;
    case "hmc": g = R(20, 110, 160, 12) + R(120, 30, 50, 80) + R(78, 58, 42, 14) + R(64, 62, 14, 6, C.tool) + R(30, 70, 32, 40, C.part) + R(20, 106, 54, 4, C.part) + arr(40, 100, 60, 100) + T(46, 60, "pallet B") + T(100, 136, "horizontal spindle, chips fall down"); break;
    case "gantry": g = R(10, 112, 180, 10) + R(20, 30, 10, 82) + R(170, 30, 10, 82) + R(20, 24, 160, 10) + R(90, 34, 20, 30) + R(97, 64, 6, 10, C.tool) + R(40, 92, 120, 20, C.part) + arr(60, 18, 140, 18) + T(100, 136, "head moves on a bridge over a big table"); break;
    case "vmc": g = R(30, 110, 140, 12) + R(140, 20, 30, 90) + R(90, 30, 50, 22) + `<g>${R(108, 52, 6, 22, C.tool)}${spin(111, 63, 0.4)}</g>` + R(70, 92, 80, 18, C.part) + T(100, 136, "very high spindle speed, light fast cuts"); break;
    case "vtl": g = R(20, 112, 160, 10) + `<g><ellipse cx="100" cy="100" rx="60" ry="10" fill="${C.part}" stroke="${C.m}"/>${spin(100, 100, 3)}</g>` + R(70, 76, 60, 22, C.part) + R(140, 18, 14, 54) + R(136, 64, 8, 10, C.tool) + T(100, 136, "part on a horizontal table, tool from above"); break;
    case "lathe": g = R(10, 110, 180, 12) + R(14, 50, 34, 60) + `<g>${R(48, 62, 90, 24, C.part)}<line x1="48" y1="74" x2="138" y2="74" stroke="${C.m}" stroke-dasharray="3 3"/></g>` + R(140, 66, 30, 16) + R(96, 88, 24, 16) + R(104, 84, 6, 6, C.tool) + R(70, 30, 18, 20) + R(76, 50, 6, 10, C.tool) + T(100, 136, "turning + driven tools (C + Y axis)"); break;
    case "swiss": g = R(10, 110, 180, 12) + R(14, 60, 40, 30) + R(54, 70, 70, 10, C.part) + R(86, 56, 10, 38) + R(110, 52, 6, 16, C.tool) + R(110, 82, 6, 16, C.tool) + arr(30, 50, 60, 50) + T(91, 48, "guide bushing") + T(100, 136, "bar slides, tool cuts next to the bushing"); break;
    case "millturn": g = R(10, 110, 180, 12) + R(14, 56, 30, 54) + R(44, 68, 110, 18, C.part) + R(154, 62, 26, 30) + `<g transform="rotate(-30 100 40)">${R(88, 10, 24, 32)}${R(97, 42, 6, 14, C.tool)}</g>` + R(90, 90, 22, 14) + R(98, 86, 6, 6, C.tool) + T(130, 22, "B-axis head", "start") + T(100, 136, "turn + 5-axis mill in one machine"); break;
    case "grind": g = R(10, 110, 180, 12) + `<g><circle cx="100" cy="40" r="28" fill="${C.tool}" stroke="${C.m}"/><line x1="100" y1="12" x2="100" y2="68" stroke="${C.m}"/>${spin(100, 40, 0.6)}</g>` + R(30, 72, 140, 16, C.part) + `<circle cx="120" cy="80" r="9" fill="none" stroke="${C.hot}" stroke-dasharray="3 2"><animateTransform attributeName="transform" type="rotate" from="0 100 80" to="360 100 80" dur="2s" repeatCount="indefinite"/></circle>` + T(100, 136, "wheel follows the orbiting crank pin"); break;
    case "hone": g = R(60, 60, 80, 60, C.part) + R(84, 60, 32, 60, "var(--surface)") + `<g>${R(92, 20, 16, 80, C.tool)}<animateTransform attributeName="transform" type="translate" values="0 0;0 20;0 0" dur="1.6s" repeatCount="indefinite"/></g>` + [0, 1, 2, 3].map((i) => `<line x1="86" y1="${70 + i * 12}" x2="114" y2="${78 + i * 12}" stroke="${C.m}"/><line x1="86" y1="${78 + i * 12}" x2="114" y2="${70 + i * 12}" stroke="${C.m}"/>`).join("") + T(100, 136, "rotate + stroke → cross-hatch in the bore"); break;
    case "skiving": g = `<g><circle cx="100" cy="88" r="36" fill="${C.part}" stroke="${C.m}"/><circle cx="100" cy="88" r="22" fill="var(--surface)" stroke="${C.m}"/>${spin(100, 88, 4)}</g>` + `<g transform="rotate(20 100 40)">${R(82, 20, 36, 14, C.tool)}${R(96, 4, 8, 16)}</g>` + T(150, 26, "tilted cutter", "start") + T(100, 136, "cutter + gear rotate in sync (crossing angle)"); break;
    case "laser": g = R(10, 100, 180, 8, C.part) + R(86, 20, 28, 26) + `<polygon points="92,46 108,46 100,60" fill="var(--surface-2)" stroke="${C.m}"/>` + `<line x1="100" y1="60" x2="100" y2="100" stroke="${C.hot}" stroke-width="3"/><circle cx="100" cy="100" r="4" fill="#ffd27a"/>` + `<path d="M30 104 H100" stroke="var(--surface)" stroke-width="3"/>` + T(100, 136, "focused beam melts, gas blows the kerf clean"); break;
    case "wedm": g = R(60, 50, 80, 50, C.part) + R(92, 14, 16, 14) + R(92, 112, 16, 14) + `<line x1="100" y1="28" x2="100" y2="112" stroke="${C.tool}" stroke-width="2"/>` + [0, 1, 2].map((i) => `<path d="M${98 - i * 2} ${60 + i * 12} l-6 3 l6 3" stroke="${C.hot}" fill="none"><animate attributeName="opacity" values="1;0;1" dur="${0.3 + i * 0.1}s" repeatCount="indefinite"/></path>`).join("") + T(100, 136, "sparks erode – hardness does not matter"); break;
    case "waterjet": g = R(10, 100, 180, 12, C.part) + R(90, 18, 20, 40) + `<line x1="100" y1="58" x2="100" y2="100" stroke="#6fa8d6" stroke-width="3"/>` + T(130, 30, "4 000–6 000 bar + abrasive", "start") + T(100, 136, "cold cutting of almost any material"); break;
    case "hybrid": g = R(20, 110, 160, 10) + R(50, 84, 100, 26, C.part) + R(70, 70, 40, 14, C.part, 'opacity=".6"') + `<polygon points="66,20 82,20 78,58 70,58" fill="var(--surface-2)" stroke="${C.m}"/><line x1="74" y1="58" x2="76" y2="70" stroke="${C.hot}" stroke-width="3"/>` + R(124, 22, 16, 30) + R(129, 52, 6, 16, C.tool) + T(74, 14, "DED head") + T(132, 14, "spindle") + T(100, 136, "build metal, then mill it in the same machine"); break;
    case "ultra": g = R(30, 110, 140, 10) + R(86, 14, 28, 36) + `<g>${R(96, 50, 8, 30, C.tool)}<animateTransform attributeName="transform" type="translate" values="0 0;0 3;0 0" dur="0.08s" repeatCount="indefinite"/></g>` + R(60, 82, 80, 28, C.part) + T(150, 60, "20–50 kHz", "start") + T(100, 136, "tool vibrates a few µm while it turns"); break;
    case "diamond": g = R(10, 110, 180, 12, "var(--surface-2)") + `<g><circle cx="70" cy="70" r="30" fill="${C.part}" stroke="${C.m}"/>${spin(70, 70, 2)}</g>` + `<polygon points="110,70 130,62 130,78" fill="#cfe8ff" stroke="${C.m}"/>` + T(140, 60, "diamond tool", "start") + T(100, 136, "air bearings, nm resolution, 20 ± 0.1 °C"); break;
    case "pkm": g = R(20, 112, 160, 10) + R(60, 92, 80, 20, C.part) + `<line x1="40" y1="20" x2="94" y2="70" stroke="${C.m}" stroke-width="3"/><line x1="160" y1="20" x2="106" y2="70" stroke="${C.m}" stroke-width="3"/><line x1="100" y1="14" x2="100" y2="66" stroke="${C.m}" stroke-width="3"/>` + R(92, 64, 16, 14) + R(97, 78, 6, 10, C.tool) + R(20, 10, 160, 8) + T(100, 136, "struts in parallel (or a robot) move the spindle"); break;
    case "fsw": g = R(20, 96, 160, 16, C.part) + `<line x1="100" y1="96" x2="100" y2="112" stroke="${C.m}" stroke-dasharray="2 2"/>` + `<g>${R(90, 40, 20, 50)}${R(97, 90, 6, 12, C.tool)}${spin(100, 70, 0.5)}</g>` + arr(40, 86, 80, 86) + T(100, 136, "rotating pin stirs the soft metal – no melting"); break;
  }
  return `<svg viewBox="0 0 200 142" class="mt-sk" role="img" aria-label="principle"><defs><marker id="mtA" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="var(--accent)"/></marker></defs>${g}</svg>`;
}

/* ------------------------------------------------------------------ item 1: machine types */
let cat = "", selT = Q.get("mtt") || "millturn";
function item1() {
  const host = $("mtItem1");
  host.innerHTML = `<div class="card"><div class="card-head"><h2>Modern machine-tool types</h2><span class="sub">${TYPES.length} types · click a card · maturity ● = how standard in industry · trend ▲ = how fast it spreads</span></div>
    <div class="am-filt" id="mtCats"><button class="chip" data-c="">all</button>${CATS.map(([k, n]) => `<button class="chip" data-c="${k}">${n}</button>`).join("")}</div>
    <div class="mt-grid" id="mtGrid"></div><div class="mt-det" id="mtDet"></div>
    <div class="am-3dbar"><button class="btn primary" id="mt3dBtn">Show 3D model</button><span class="sub">animated 3D model of the selected machine type (simplified) · drag = turn, wheel = zoom, right drag = move</span>
      <label class="am-chk"><input type="checkbox" id="mt3dLbl" checked> labels</label></div>
    <div id="mt3d" class="am-3d" hidden></div></div>
  <div class="card"><div class="card-head"><h2>Comparison of all types</h2><span class="sub">typical public ranges of current machine classes (examples)</span></div><div class="am-wrap"><table class="am-tab" id="mtCmp"></table></div></div>`;
  $("mtCats").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) { cat = b.dataset.c; grid(); } });
  $("mtGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (b) { selT = b.dataset.t; grid(); det(); } });
  $("mtCmp").addEventListener("click", (e) => { const r = e.target.closest("[data-t]"); if (r) { selT = r.dataset.t; cat = ""; grid(); det(); $("mtDet").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  grid(); det();
  let v3 = null;
  $("mt3dBtn").addEventListener("click", async () => {
    const el = $("mt3d"); el.hidden = !el.hidden; $("mt3dBtn").textContent = el.hidden ? "Show 3D model" : "Hide 3D model";
    if (!el.hidden && !v3) { try { const m = await import("./mt3d.js"); v3 = m.create(el, () => { const t = TYPES.find((x) => x.k === selT) || TYPES[0]; return { sk: t.sk, name: t.name, labels: $("mt3dLbl").checked }; }); } catch (err) { el.textContent = "3D view could not load: " + err.message; } }
  });
  if (Q.has("show3d")) setTimeout(() => $("mt3dBtn").click(), 300);
  $("mtCmp").innerHTML = `<thead><tr><th>Type</th><th>Group</th><th>Purpose</th><th>Typical values</th><th>Maturity</th><th>Trend</th></tr></thead><tbody>${TYPES.map((t) =>
    `<tr data-t="${t.k}" class="am-click"><td><b>${esc(t.name)}</b></td><td>${esc((CATS.find((c) => c[0] === t.cat) || [, ""])[1])}</td><td>${esc(t.purpose)}</td><td>${esc(t.spec)}</td><td class="mt-dots">${dots(t.mat)}</td><td>${"▲".repeat(t.trend)}</td></tr>`).join("")}</tbody>`;
}
function grid() {
  document.querySelectorAll("#mtCats [data-c]").forEach((b) => b.classList.toggle("am-sel", b.dataset.c === cat));
  $("mtGrid").innerHTML = TYPES.filter((t) => !cat || t.cat === cat).map((t) => `<button class="mt-card ${t.k === selT ? "active" : ""}" data-t="${t.k}">${sketch(t.sk)}<b>${esc(t.name)}</b><span class="mt-dots">${dots(t.mat)} <span class="mt-tr">${"▲".repeat(t.trend)}</span></span></button>`).join("");
}
function det() {
  const t = TYPES.find((x) => x.k === selT) || TYPES[0];
  $("mtDet").innerHTML = `<div class="mt-dh"><div class="mt-big">${sketch(t.sk)}</div><div><h3 class="am-h">${esc(t.name)}</h3><div class="sub">${esc((CATS.find((c) => c[0] === t.cat) || [, ""])[1])} · maturity ${dots(t.mat)} · trend ${"▲".repeat(t.trend)}</div>
    <p><b>Purpose:</b> ${esc(t.purpose)}</p><p><b>Principle:</b> ${esc(t.how)}</p></div></div>
    <table class="am-kv"><tbody><tr><td>Key components</td><td>${esc(t.comp)}</td></tr><tr><td>Typical values</td><td>${esc(t.spec)}</td></tr><tr><td>Typical parts</td><td>${esc(t.parts)}</td></tr>
    <tr><td>Makers (examples)</td><td>${esc(t.makers)}</td></tr><tr><td>For your compressor factory</td><td><b>${esc(t.you)}</b></td></tr></tbody></table>`;
}

/* ------------------------------------------------------------------ item 2: trends */
let selR = Q.get("mttr") || "conn";
function item2() {
  const host = $("mtItem2");
  host.innerHTML = `<div class="grid2"><div class="card"><div class="card-head"><h2>Trend map – maturity vs impact for a machining plant</h2><span class="sub">click a dot or a card · hover for the name</span></div><div id="mtMap"></div></div>
    <div class="card"><div class="card-head"><h2>Trend detail</h2></div><div id="mtTd"></div></div></div>
    <div class="card"><div class="card-head"><h2>All ${TRENDS.length} trends</h2><span class="sub">what · principle · gain · examples · what to ask the supplier</span></div><div class="am-wrap"><table class="am-tab" id="mtTt"></table></div></div>`;
  host.addEventListener("click", (e) => { const b = e.target.closest("[data-r]"); if (b) { selR = b.dataset.r; map(); tdet(); } });
  map(); tdet();
  $("mtTt").innerHTML = `<thead><tr><th>Trend</th><th>What</th><th>Principle</th><th>Gain (typical)</th><th>Maturity</th><th>Impact</th></tr></thead><tbody>${TRENDS.map((r) =>
    `<tr data-r="${r.k}" class="am-click"><td><b>${esc(r.name)}</b></td><td>${esc(r.what)}</td><td>${esc(r.how)}</td><td>${esc(r.gain)}</td><td class="mt-dots">${dots(r.mat)}</td><td class="mt-dots">${dots(r.imp)}</td></tr>`).join("")}</tbody>`;
}
function map() {
  const W = 560, H = 380, L = 56, B = 44, T = 16, Rr = 16, sx = (v) => L + (v - 0.5) / 5 * (W - L - Rr), sy = (v) => H - B - (v - 0.5) / 5 * (H - T - B);
  let g = "";
  for (let v = 1; v <= 5; v++) g += `<line x1="${sx(v)}" y1="${T}" x2="${sx(v)}" y2="${H - B}" class="am-grid"/><text x="${sx(v)}" y="${H - B + 16}" text-anchor="middle" class="am-s">${v}</text><line x1="${L}" y1="${sy(v)}" x2="${W - Rr}" y2="${sy(v)}" class="am-grid"/><text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end" class="am-s">${v}</text>`;
  g += `<text x="${(L + W) / 2}" y="${H - 8}" text-anchor="middle" class="am-s">maturity (1 = new … 5 = standard)</text><text transform="translate(14 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="am-s">impact for a machining plant</text>`;
  g += `<text x="${sx(5.3)}" y="${sy(5.4)}" text-anchor="end" class="am-s am-b">use now</text><text x="${sx(0.7)}" y="${sy(5.4)}" class="am-s am-b">prepare / pilot</text>`;
  const seen = {};
  const pts = TRENDS.map((r) => { const key = r.mat + "," + r.imp, n = (seen[key] = (seen[key] || 0) + 1) - 1, ang = n * 2.1, off = n ? 13 : 0;
    const x = sx(r.mat) + Math.cos(ang) * off, y = sy(r.imp) + Math.sin(ang) * off, on = r.k === selR;
    return `<g data-r="${r.k}" data-tip="${esc(r.name)} · maturity ${r.mat} · impact ${r.imp}" class="mt-pt"><circle cx="${x}" cy="${y}" r="12" class="am-hit"/><circle cx="${x}" cy="${y}" r="${on ? 8 : 6}" class="am-scd ${on ? "am-on2" : ""}"/></g>`; }).join("");
  $("mtMap").innerHTML = `<div class="am-chart"><svg viewBox="0 0 ${W} ${H}" class="am-svgc">${g}${pts}</svg><div class="am-tip" hidden></div></div>`;
  const box = $("mtMap").querySelector(".am-chart"), tip = box.querySelector(".am-tip");
  box.addEventListener("mousemove", (e) => { const t = e.target.closest("[data-tip]"); if (!t) { tip.hidden = true; return; } const rc = box.getBoundingClientRect(); tip.textContent = t.dataset.tip; tip.hidden = false; tip.style.left = Math.min(rc.width - 220, e.clientX - rc.left + 12) + "px"; tip.style.top = (e.clientY - rc.top + 12) + "px"; });
  box.addEventListener("mouseleave", () => { tip.hidden = true; });
}
function tdet() {
  const r = TRENDS.find((x) => x.k === selR) || TRENDS[0];
  document.querySelectorAll("#mtTt tr[data-r]").forEach((tr) => tr.classList.toggle("am-best", tr.dataset.r === selR));
  $("mtTd").innerHTML = `<h3 class="am-h">${esc(r.name)}</h3><div class="sub">maturity ${dots(r.mat)} · impact ${dots(r.imp)}</div>
    <table class="am-kv"><tbody><tr><td>What</td><td>${esc(r.what)}</td></tr><tr><td>Principle</td><td>${esc(r.how)}</td></tr><tr><td>Gain (typical)</td><td><b>${esc(r.gain)}</b></td></tr>
    <tr><td>Examples</td><td>${esc(r.ex)}</td></tr><tr><td>Ask the supplier</td><td>${esc(r.ask)}</td></tr></tbody></table>
    <div class="mt-chips">${TRENDS.map((x) => `<button class="chip ${x.k === selR ? "am-sel" : ""}" data-r="${x.k}">${esc(x.name.split(":")[0].split(" + ")[0])}</button>`).join("")}</div>`;
}

/* ------------------------------------------------------------------ item 3: selection for compressor parts + buying checklist */
let selP = Q.get("mtp") || "crankcase", ck = {};
try { ck = JSON.parse(localStorage.getItem("mtCheck") || "{}"); } catch (e) { /* storage blocked */ }
function item3() {
  const host = $("mtItem3");
  host.innerHTML = `<div class="card"><div class="card-head"><h2>Which machine types for your compressor parts?</h2><span class="sub">route = typical modern process chain (example) · click a machine to open it in item 1</span></div>
    <div class="mx-nav" id="mtParts">${PARTS.map((p) => `<button class="mx-el" data-p="${p.k}">${esc(p.name)}</button>`).join("")}</div><div id="mtPd"></div></div>
    <div class="card"><div class="card-head"><h2>Buying checklist for a new machine tool</h2><span class="sub" id="mtCkS"></span></div><div class="am-wrap"><table class="am-tab" id="mtCk"></table></div>
    <p class="am-note">Your ticks are saved on this PC only (browser storage). Use the list in every supplier meeting and compare offers on the same points.</p></div>`;
  $("mtParts").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { selP = b.dataset.p; pdet(); } });
  $("mtPd").addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { selT = b.dataset.go; cat = ""; showItem("1"); grid(); det(); $("mtDet").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  $("mtCk").addEventListener("change", (e) => { const k = e.target.dataset.ck; if (k == null) return; ck[k] = e.target.checked; try { localStorage.setItem("mtCheck", JSON.stringify(ck)); } catch (er) { /* storage blocked */ } ckSum(); });
  pdet();
  $("mtCk").innerHTML = `<thead><tr><th></th><th>Group</th><th>Check</th><th>Why</th></tr></thead><tbody>${CHECK.map(([g, it, why], i) => `<tr><td><input type="checkbox" data-ck="${i}" ${ck[i] ? "checked" : ""} aria-label="done"></td><td>${esc(g)}</td><td>${esc(it)}</td><td class="sub">${esc(why)}</td></tr>`).join("")}</tbody>`;
  ckSum();
}
function ckSum() { const n = CHECK.filter((_, i) => ck[i]).length; $("mtCkS").textContent = `${n} / ${CHECK.length} checked`; }
function pdet() {
  document.querySelectorAll("#mtParts [data-p]").forEach((b) => b.classList.toggle("active", b.dataset.p === selP));
  const p = PARTS.find((x) => x.k === selP) || PARTS[0];
  $("mtPd").innerHTML = `<table class="am-kv"><tbody><tr><td>Typical route</td><td>${p.route.split(" → ").map((s, i) => `<span class="mt-step">${i + 1} ${esc(s)}</span>`).join('<span class="mt-arr">→</span>')}</td></tr>
    <tr><td>Key quality features</td><td><b>${esc(p.key)}</b></td></tr><tr><td>Why these machines</td><td>${esc(p.why)}</td></tr></tbody></table>
    <div class="mt-pgrid">${p.types.map((k) => { const t = TYPES.find((x) => x.k === k); return `<button class="mt-card" data-go="${k}">${sketch(t.sk)}<b>${esc(t.name)}</b><span class="sub">${esc(t.spec)}</span></button>`; }).join("")}</div>`;
}

/* ------------------------------------------------------------------ boot */
const built = {};
function build(n) { if (built[n] || !$("mtItem" + n)) return; built[n] = true; ({ 1: item1, 2: item2, 3: item3 })[n](); }
const q = Q.get("mtitem");
if (q && ["2", "3"].includes(q)) showItem(q);
else if (location.hash === "#mt" || ($("tab-mt") && $("tab-mt").classList.contains("active"))) build("1");
window.mtCtl = { showItem };
