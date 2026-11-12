/* HYDRAULICS tab – item 1 "Element data book" (builder A).
 * Files: hydlib_sym.js (ISO 1219-1 symbols + principle drawings, reusable) · hydlib_calc.js (formulas, calculators, charts, self-test)
 *        hydlib_d1.js (pumps, motors, cylinders) · hydlib_d2.js (directional, pressure, flow, check/lock, cartridge valves)
 *        hydlib_d3.js (accumulators, filtration + conditioning, lines, sensors, fluids) · hydlib.css · guide docs/29_hydraulic_elements_data.md
 * Built lazily on window event "hyitemshow" (detail "1") from hyd.js, or at load when hyCtl.current() === "1"; data modules are imported on first build.
 * URL: /?hyitem=1&hlel=<element id>#hyd (deep link; hlel=overview | legend) · &hlq=<search> · &hltest (self-check in the console, "HLTEST" lines)
 *      · &hlback (switch to item 2, 3 and back, report errors) · &hlhold (test only: keeps the load event pending for headless screenshots)
 *      · &hlmd (test only: writes the data book as Markdown into <pre id="hlMd"> for the guide)
 * Offline, no libraries. All values are EXAMPLES (catalogue class) – check the supplier's current catalogue.
 */
const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
window.addEventListener("unhandledrejection", (e) => errs.push(String(e.reason)));
if (Q.has("hlhold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?hlhold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr); setTimeout(() => { if (typeof window.showTab === "function") window.showTab("hyd"); }, 300); }

export const FAMILIES = [
  ["pump", "Pumps"], ["motor", "Hydraulic motors"], ["cyl", "Cylinders + rotary actuators"], ["dir", "Directional valves"],
  ["pres", "Pressure control valves"], ["flow", "Flow control valves"], ["check", "Check + lock valves"], ["cart", "Cartridge valves"],
  ["acc", "Accumulators"], ["filt", "Filtration + conditioning"], ["line", "Lines, fittings, manifolds"], ["sens", "Sensors + measurement"], ["fluid", "Fluids"],
];
const famName = (k) => (FAMILIES.find((x) => x[0] === k) || [k, k])[1];
const esc = (s) => String(s).replace(/&(?![a-z#0-9]+;)/gi, "&amp;");
let S = null; // { sym, calc, ELS, byId }
let built = false, cur = null;

function build() {
  if (built) return; built = true;
  const box = $("hyItem1"); if (!box) return;
  box.innerHTML = `<div class="card hl-loading">Loading the element data book …</div>`;
  Promise.all([import("./hydlib_sym.js"), import("./hydlib_calc.js"), import("./hydlib_d1.js"), import("./hydlib_d2.js"), import("./hydlib_d3.js")])
    .then(([sym, calc, d1, d2, d3]) => {
      const ELS = [...d1.ELEMENTS, ...d2.ELEMENTS, ...d3.ELEMENTS];
      const order = FAMILIES.map((x) => x[0]);
      ELS.sort((a, b) => order.indexOf(a.fam) - order.indexOf(b.fam));
      S = { sym, calc, ELS, byId: Object.fromEntries(ELS.map((e) => [e.id, e])) };
      init(box);
    })
    .catch((e) => { box.innerHTML = `<div class="card">Could not load the data book: ${esc(e.message || e)}</div>`; errs.push(String(e)); console.error(e); });
}
window.addEventListener("hyitemshow", (e) => { if (e.detail === "1") build(); });
if (window.hyCtl && window.hyCtl.current() === "1") build();

/* ------------------------------------------------------------------ layout */
function init(box) {
  box.innerHTML = `<div class="hl-wrap">
    <aside class="card hl-nav" aria-label="Element navigator">
      <input id="hlSearch" class="hl-search" type="search" placeholder="Search: counterbalance, NG10, bladder, 4406 …" aria-label="Search elements">
      <div id="hlNav" class="hl-navlist"></div>
    </aside>
    <main id="hlPage" class="card hl-page" aria-live="polite"></main>
  </div>`;
  const inp = $("hlSearch");
  inp.value = Q.get("hlq") || "";
  inp.addEventListener("input", () => renderNav(inp.value));
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { const first = $("hlNav").querySelector("[data-hlel]:not([data-hlel=overview]):not([data-hlel=legend])"); if (first) show(first.dataset.hlel, true); } });
  $("hlNav").addEventListener("click", (e) => { const b = e.target.closest("[data-hlel]"); if (b) show(b.dataset.hlel, true); });
  $("hlPage").addEventListener("click", (e) => { const b = e.target.closest("[data-hlel]"); if (b) { e.preventDefault(); show(b.dataset.hlel, true); } });
  const start = Q.get("hlel");
  renderNav(inp.value);
  show(start && (S.byId[start] || start === "overview" || start === "legend") ? start : "overview", false);
  if (Q.has("hltest")) setTimeout(selfTest, 100);
  if (Q.has("hlmd")) writeMd();
  if (Q.has("hlback")) setTimeout(backTest, 600);
}

function matches(e, q) {
  if (!q) return true;
  const hay = (e.id + " " + e.name + " " + e.short + " " + famName(e.fam) + " " + JSON.stringify(e.types || []) + " " + JSON.stringify(e.data || {}) + " " + (e.std || "")).toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
function renderNav(q) {
  q = (q || "").trim();
  let h = `<button class="hl-nb hl-top" data-hlel="overview">Overview – all ${S.ELS.length} elements</button><button class="hl-nb hl-top" data-hlel="legend">ISO 1219 symbol legend</button>`;
  let hits = 0;
  for (const [k, nm] of FAMILIES) {
    const list = S.ELS.filter((e) => (e.fam === k || (e.also || []).includes(k)) && matches(e, q));
    if (!list.length) continue; hits += list.length;
    const open = q || (cur && S.byId[cur] && (S.byId[cur].fam === k)) ? " open" : "";
    h += `<details class="hl-fam"${open}><summary>${nm} <span class="hl-cnt">${list.length}</span></summary>` +
      list.map((e) => `<button class="hl-nb${e.id === cur ? " active" : ""}" data-hlel="${e.id}">${e.name}${e.fam !== k ? ' <span class="hl-also">→ ' + famName(e.fam) + "</span>" : ""}</button>`).join("") + `</details>`;
  }
  if (q && !hits) h += `<p class="hl-small">No element found for "${esc(q)}".</p>`;
  $("hlNav").innerHTML = h;
}

/* ------------------------------------------------------------------ pages */
function show(id, user) {
  cur = id;
  const pg = $("hlPage");
  pg.innerHTML = id === "overview" ? overviewHTML() : id === "legend" ? legendHTML() : elementHTML(S.byId[id]);
  if (S.byId[id]) wireCalc(pg, S.byId[id]);
  renderNav($("hlSearch").value);
  const u = new URL(location.href); u.searchParams.set("hlel", id); history.replaceState(null, "", u.pathname + u.search + u.hash);
  if (user) { const r = pg.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight) pg.scrollIntoView({ block: "start", behavior: "smooth" }); }
}
const tbl = (h, rows, cls = "") => `<div class="hl-tw"><table class="hl-t ${cls}"><thead><tr>${h.map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
function symsHTML(e, cls = "") { return (e.sym || []).map(([k, o]) => S.sym.symbol(k, o)).join(""); }

function elementHTML(e) {
  if (!e) return `<p>Unknown element.</p>`;
  const i = S.ELS.indexOf(e), prev = S.ELS[i - 1], next = S.ELS[i + 1];
  const dr = e.draw ? S.sym.drawing(e.draw) : "";
  let h = `<div class="hl-head"><span class="hl-badge">${famName(e.fam)}</span><h3 class="hl-h3">${e.name}</h3>
    <p class="hl-short">${e.short || ""}</p>
    <p class="hl-note">All numbers are <b>examples</b> (catalogue class) – check the supplier's current catalogue.${e.std ? " Standards: " + e.std + "." : ""}</p></div>
  <div class="hl-figs"><figure class="hl-fig hl-symfig"><div class="hl-syms">${symsHTML(e)}</div><figcaption>ISO 1219-1 symbol (simplified)${e.symNote ? " – " + e.symNote : ""}</figcaption></figure>
  ${dr ? `<figure class="hl-fig hl-drfig">${dr}<figcaption>How it is built (principle drawing, not to scale)</figcaption></figure>` : ""}</div>
  <div class="hl-grid2"><section><h4>How it works</h4>${(e.how || []).map((p) => `<p>${p}</p>`).join("")}</section>
  <section><h4>Types</h4>${e.types ? tbl(["Type", "What it is / when to use"], e.types) : ""}</section></div>
  <section><h4>Data (catalogue class – examples)</h4>${e.data ? tbl(e.data.h, e.data.r, "hl-data") : ""}</section>`;
  for (const t of e.tables || []) h += `<section><h4>${t.t}</h4>${tbl(t.h, t.r)}${t.note ? `<p class="hl-small">${t.note}</p>` : ""}</section>`;
  if (e.sel) h += `<section><h4>Selection – formula and worked example</h4><div class="hl-sel"><div class="hl-form">${(e.sel.f || []).map((x) => `<div>${x}</div>`).join("")}</div>
    <div class="hl-ex"><b>Worked example</b>${(e.sel.ex || []).map((x) => `<div>${x}</div>`).join("")}</div></div></section>`;
  if (e.calc && S.calc.CALC[e.calc]) h += calcHTML(e.calc, e);
  if (e.chart) h += chartHTML(e.chart);
  h += `<div class="hl-grid2"><section><h4>Mounting and installation</h4><ul>${(e.mount || []).map((x) => `<li>${x}</li>`).join("")}</ul></section>
    <section><h4>What to ask the supplier</h4><ol>${(e.ask || []).map((x) => `<li>${x}</li>`).join("")}</ol></section></div>
  <section><h4>Typical failures</h4>${e.fail ? tbl(["Symptom", "Cause", "Fix"], e.fail, "hl-fail") : ""}</section>
  <div class="hl-pn">${prev ? `<button class="btn" data-hlel="${prev.id}">← ${prev.name}</button>` : "<span></span>"}<button class="btn" data-hlel="overview">Overview</button>${next ? `<button class="btn" data-hlel="${next.id}">${next.name} →</button>` : "<span></span>"}</div>`;
  return h;
}

/* ------------------------------------------------------------------ calculators */
/* element-specific calculator defaults (= the worked example on that page); all others use the docs/25 reference job */
const CALC_DEF = {
  pump_axial_var: { V: 45, ev: 0.95, p: 210, et: 0.88 },
  motor_axial: { V: 56, dp: 200, Q: 17.7, ev: 0.95, ehm: 0.93 }, motor_radial: { V: 1000, dp: 200, Q: 30, ev: 0.95, ehm: 0.95 },
};
function calcHTML(key, e) {
  const c = S.calc.CALC[key], dd = (e && CALC_DEF[e.id]) || {};
  const inp = c.inp.map(([k, lab, def0, unit, step]) => { const def = dd[k] ?? def0; return Array.isArray(step)
    ? `<label class="hl-in"><span>${lab}</span><select data-k="${k}">${step.map(([v, t]) => `<option value="${v}"${String(v) === String(def) ? " selected" : ""}>${t}</option>`).join("")}</select></label>`
    : `<label class="hl-in"><span>${lab}${unit ? " [" + unit + "]" : ""}</span><input type="number" data-k="${k}" value="${def}" step="${step}"></label>`; }).join("");
  return `<section class="hl-calc" data-calc="${key}"><h4>Live calculator – ${c.t}</h4><div class="hl-ins">${inp}</div><div class="hl-out"></div><p class="hl-small">Defaults = the worked example of this page or the docs/25 reference job. Change any value – results update at once.</p></section>`;
}
function runCalc(sec) {
  const c = S.calc.CALC[sec.dataset.calc], v = {};
  sec.querySelectorAll("[data-k]").forEach((el) => { const raw = el.value; v[el.dataset.k] = el.tagName === "SELECT" && isNaN(+raw) ? raw : +raw; });
  let rows; try { rows = c.run(v); } catch (err) { rows = [["Error", String(err)]]; }
  sec.querySelector(".hl-out").innerHTML = tbl(["Result", "Value", "Note"], rows.map((r) => [r[0], `<b>${r[1]}</b>`, r[2] || ""]), "hl-res");
  return rows;
}
function wireCalc(pg) { pg.querySelectorAll(".hl-calc").forEach((sec) => { sec.addEventListener("input", () => runCalc(sec)); sec.addEventListener("change", () => runCalc(sec)); runCalc(sec); }); }

/* ------------------------------------------------------------------ charts (SVG, thin lines, one y-axis, legend) */
function chartHTML(key) {
  const d = S.calc.chartData(key); if (!d) return "";
  const W = 620, H = 300, l = 54, r = 14, t = 14, b = 40, pw = W - l - r, ph = H - t - b;
  const tx = d.logx ? (x) => l + (Math.log10(x) - Math.log10(d.xr[0])) / (Math.log10(d.xr[1]) - Math.log10(d.xr[0])) * pw : (x) => l + (x - d.xr[0]) / (d.xr[1] - d.xr[0]) * pw;
  const ty = d.logy ? (y) => t + ph - (Math.log10(y) - Math.log10(d.yr[0])) / (Math.log10(d.yr[1]) - Math.log10(d.yr[0])) * ph : (y) => t + ph - (y - d.yr[0]) / (d.yr[1] - d.yr[0]) * ph;
  const ticks = (lo, hi, log) => { if (log) { const o = []; for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo - 1e-9 && v <= hi + 1e-9) o.push(v); } return o; }
    const span = hi - lo, st = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100].find((s) => span / s <= 8) || 100, o = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) o.push(+v.toFixed(6)); return o; };
  let g = "";
  if (d.band) g += `<rect class="hl-band" x="${l}" y="${ty(d.band[1])}" width="${pw}" height="${ty(d.band[0]) - ty(d.band[1])}"/>`;
  for (const x of ticks(d.xr[0], d.xr[1], d.logx)) g += `<line class="hl-grid" x1="${tx(x)}" y1="${t}" x2="${tx(x)}" y2="${t + ph}"/><text class="hl-tick" x="${tx(x)}" y="${t + ph + 14}" text-anchor="middle">${x}</text>`;
  for (const y of ticks(d.yr[0], d.yr[1], d.logy)) g += `<line class="hl-grid" x1="${l}" y1="${ty(y)}" x2="${l + pw}" y2="${ty(y)}"/><text class="hl-tick" x="${l - 6}" y="${ty(y) + 3}" text-anchor="end">${y}</text>`;
  for (const [y, lab] of d.marks || []) g += `<line class="hl-mark" x1="${l}" y1="${ty(y)}" x2="${l + pw}" y2="${ty(y)}"/><text class="hl-tick" x="${l + pw - 4}" y="${ty(y) - 4}" text-anchor="end">${lab}</text>`;
  g += `<line class="hl-axis" x1="${l}" y1="${t + ph}" x2="${l + pw}" y2="${t + ph}"/><line class="hl-axis" x1="${l}" y1="${t}" x2="${l}" y2="${t + ph}"/>`;
  g += `<text class="hl-tick" x="${l + pw / 2}" y="${H - 6}" text-anchor="middle">${d.xl}</text><text class="hl-tick" transform="translate(13 ${t + ph / 2}) rotate(-90)" text-anchor="middle">${d.yl}</text>`;
  d.s.forEach((s, i) => { if (!s.p.length) return; g += `<path class="hl-ser hl-s${i}" d="${s.p.map((p, j) => (j ? "L" : "M") + tx(p[0]).toFixed(1) + " " + ty(p[1]).toFixed(1)).join("")}"/>`; });
  const leg = d.s.map((s, i) => `<span class="hl-leg"><i class="hl-s${i}"></i>${s.n}</span>`).join("");
  return `<section class="hl-chart" data-chart="${key}"><h4>${d.t}</h4><svg viewBox="0 0 ${W} ${H}" class="hl-csvg" role="img" aria-label="${d.t}">${g}</svg><div class="hl-legend">${leg}</div><p class="hl-small">Example curves – the real curve is in the supplier's catalogue.</p></section>`;
}

/* ------------------------------------------------------------------ overview + legend */
function overviewHTML() {
  const rows = S.ELS.map((e) => {
    const s0 = e.sym && e.sym[0] ? S.sym.symbol(e.sym[0][0], e.sym[0][1]) : "";
    const key = e.data && e.data.r ? e.data.r.slice(0, 3).map((r) => `<b>${r[0]}:</b> ${r.slice(1).join(" · ")}`).join("<br>") : "";
    return [`<div class="hl-ovsym">${s0}</div>`, `<a href="#" data-hlel="${e.id}">${e.name}</a>`, famName(e.fam), e.short || "", key];
  });
  const fams = FAMILIES.map(([k, n]) => `<button class="hl-chip" data-hlel="${(S.ELS.find((e) => e.fam === k) || {}).id}">${n} · ${S.ELS.filter((e) => e.fam === k).length}</button>`).join("");
  return `<div class="hl-head"><h3 class="hl-h3">Overview – all ${S.ELS.length} hydraulic elements</h3>
    <p class="hl-short">One line per element: ISO 1219 symbol, what it is and the first key data. Click a name for its full page (how it works, types, data, selection formula with example, mounting, failures, supplier questions).</p>
    <p class="hl-note">All numbers are <b>examples</b> (catalogue class) – check the supplier's current catalogue. Reference job for every worked example: docs/25 (F 20 kN, bore 63 / rod 36, 10 MPa, 18.7 L/min).</p>
    <div class="hl-chips">${fams}</div></div>${tbl(["Symbol", "Element", "Family", "What it is", "Key data (examples)"], rows, "hl-ov")}`;
}
function legendHTML() {
  const rules = [
    ["Function, not construction", "A symbol shows WHAT the element does (ports, flow paths, how it is actuated), not how it looks inside."],
    ["Normal position", "Valves are drawn in the normal (not actuated) position: the box where the port lines touch. 3-position valves: the middle box. 2-position with spring: the box next to the spring."],
    ["Circle", "Energy conversion: pump, motor (big circle), measuring instrument, check-valve ball (small circle)."],
    ["Square / box", "One box = one switching position of a valve. Arrows inside = flow paths, a T-stub = blocked port."],
    ["Triangle", "Direction of energy / flow. Filled = hydraulic, hollow = pneumatic (air). Pump: points OUT, motor: points IN."],
    ["Diagonal arrow", "Adjustable or variable (variable pump, adjustable spring, adjustable throttle)."],
    ["Spring (zig-zag)", "Returns the element to the normal position or sets a pressure. With a diagonal arrow = adjustable spring."],
    ["Lines", "Solid = working line. Long dashes = pilot (control) line. Short dashes = drain / leakage line. Dash-dot = enclosure (several functions in one body, e.g. a manifold or a valve with built-in check)."],
    ["Port letters (ISO 9461)", "P pump/pressure · T tank · A, B working ports · X, Y pilot supply / pilot drain · L leakage (case drain) · S suction · M measuring port."],
    ["Actuators at the box ends", "Solenoid (box with diagonal), proportional solenoid (plus arrow), lever, push button, pilot pressure (triangle + dashed line), detent (notches)."],
    ["Circuit numbering (ISO 1219-2)", "Each component has a code: e.g. 1A1 actuator, 1V1 valve, 0P1 pump, 0Z1 filter – first digit = circuit number. Lines are drawn without crossing where possible."],
  ];
  const ports = [["P", "Pressure supply from the pump"], ["T (R)", "Return to tank"], ["A, B", "Working ports to the actuator"], ["X", "External pilot pressure"], ["Y", "External pilot drain (to tank, no back pressure)"], ["L", "Leakage / case drain"], ["S", "Suction"], ["M / MP", "Measuring port (gauge, test point)"]];
  const gal = S.sym.SYMBOL_INFO.map(([k, o, t]) => `<figure class="hl-gi">${S.sym.symbol(k, o)}<figcaption>${t}</figcaption></figure>`).join("");
  return `<div class="hl-head"><h3 class="hl-h3">ISO 1219-1 symbol legend – the basic rules</h3>
    <p class="hl-short">How to read a hydraulic circuit diagram. The symbols in this app are simplified teaching versions; the real diagram follows ISO 1219-1 (symbols) and ISO 1219-2 (circuit diagrams, numbering).</p></div>
    <div class="hl-grid2"><section><h4>Basic rules</h4>${tbl(["Rule", "Meaning"], rules)}</section><section><h4>Port letters</h4>${tbl(["Port", "Meaning"], ports)}
    <h4>How to read a 4/3 valve</h4><p>Look at the middle box (the ports touch it): that is what happens when no solenoid is on. When the LEFT solenoid is on, imagine the LEFT box sliding into the middle: its arrows now connect the ports. Example 4/3 closed centre: middle = all ports blocked (load held, but the pump must go somewhere – relief or pressure-compensated pump), left box P→A and B→T (extend), right box P→B and A→T (retract).</p></section></div>
    <section><h4>All symbols used in the data book (${S.sym.SYMBOL_INFO.length})</h4><div class="hl-gal">${gal}</div></section>`;
}

/* ------------------------------------------------------------------ tests */
function selfTest() {
  const out = (s) => console.log("HLTEST " + s);
  let pass = 0, fail = 0;
  for (const [lab, v, hand, tol] of S.calc.selfTest()) { const okk = Math.abs(v - hand) <= tol; okk ? pass++ : fail++; out(`${okk ? "PASS" : "FAIL"} ${lab}: code ${(+v).toPrecision(5)} hand ${hand}`); }
  const ids = new Set(); let dup = 0, symN = 0, unk = 0, pages = 0, perr = [], drawMissing = [], calcMissing = [], chartMissing = [];
  const req = ["id", "fam", "name", "short", "sym", "how", "types", "data", "sel", "mount", "fail", "ask"];
  const host = document.createElement("div"); host.style.cssText = "position:absolute;left:-9999px;top:0;width:900px"; document.body.appendChild(host);
  for (const e of S.ELS) {
    if (ids.has(e.id)) dup++; ids.add(e.id);
    const miss = req.filter((k) => !e[k]); if (miss.length) perr.push(e.id + " missing " + miss.join(","));
    try {
      host.innerHTML = elementHTML(e); wireCalc(host);
      const n = host.querySelectorAll("svg.hl-sym").length; symN += n; if (!n) perr.push(e.id + " no symbol");
      unk += (host.innerHTML.match(/unknown symbol/g) || []).length;
      if (e.draw && !host.querySelector("svg.hl-draw")) drawMissing.push(e.id + ":" + e.draw);
      if (e.calc && !host.querySelector(".hl-calc .hl-res")) calcMissing.push(e.id + ":" + e.calc);
      if (e.chart && !host.querySelector(".hl-chart path.hl-ser")) chartMissing.push(e.id + ":" + e.chart);
      if (/Error|NaN/.test(host.querySelector(".hl-out")?.textContent || "")) perr.push(e.id + " calc shows NaN/Error");
      pages++;
    } catch (err) { perr.push(e.id + " " + err.message); }
  }
  host.remove();
  const famCount = FAMILIES.map(([k]) => k + " " + S.ELS.filter((e) => e.fam === k).length).join(", ");
  out(`elements ${S.ELS.length} (${famCount}); duplicates ${dup}`);
  out(`pages rendered ${pages}/${S.ELS.length}; symbols on pages ${symN}; unknown symbols ${unk}; symbol functions ${S.sym.SYMBOL_KEYS.length}; legend symbols ${S.sym.SYMBOL_INFO.length}; drawings ${S.sym.DRAWING_KEYS.length}`);
  out(`calculators ${Object.keys(S.calc.CALC).length}, charts dpq/relief/visc/pumpPQ/fcomp/accu ${["dpq", "relief", "visc", "pumpPQ", "fcomp", "accu"].every((k) => S.calc.chartData(k)) ? "OK" : "MISSING"}`);
  out(`missing drawings: ${drawMissing.join(" ") || "none"} · missing calcs: ${calcMissing.join(" ") || "none"} · missing charts: ${chartMissing.join(" ") || "none"}`);
  out(`page problems: ${perr.join(" | ") || "none"}`);
  out(`formulas ${pass} PASS, ${fail} FAIL; console errors: ${errs.length ? errs.join(" | ") : "none"}`);
  out(`RESULT ${fail === 0 && !perr.length && !dup && !unk && !drawMissing.length && !calcMissing.length && !chartMissing.length ? "ALL OK" : "PROBLEMS"}`);
}
function backTest() {
  const ctl = window.hyCtl; if (!ctl) { console.log("HLBACK no hyCtl"); return; }
  ctl.showItem("2");
  setTimeout(() => { console.log(`HLBACK item2 visible=${!$("hyItem2").hidden} item1 hidden=${$("hyItem1").hidden}`); ctl.showItem("3");
    setTimeout(() => { console.log(`HLBACK item3 visible=${!$("hyItem3").hidden}`); ctl.showItem("1");
      setTimeout(() => console.log(`HLBACK item1 again visible=${!$("hyItem1").hidden} page=${!!$("hlPage") && $("hlPage").children.length > 0} errors=${errs.length ? errs.join(" | ") : "none"}`), 400); }, 400); }, 400);
}

/* ------------------------------------------------------------------ markdown export for the guide (&hlmd) */
function md(s) {
  return String(s ?? "").replace(/<br\s*\/?>/g, " ").replace(/<\/?b>/g, "**").replace(/<\/?i>/g, "*").replace(/<\/?code>/g, "`").replace(/<sub>(.*?)<\/sub>/g, "_$1").replace(/<sup>(.*?)<\/sup>/g, "^$1")
    .replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}
const mdT = (h, rows) => `| ${h.map(md).join(" | ")} |\n|${h.map(() => "---").join("|")}|\n` + rows.map((r) => `| ${r.map(md).join(" | ")} |`).join("\n") + "\n";
function writeMd() {
  let o = "";
  FAMILIES.forEach(([k, nm], fi) => {
    const list = S.ELS.filter((e) => e.fam === k);
    o += `\n## ${fi + 4}. ${nm}\n\n`;
    list.forEach((e, ei) => {
      o += `### ${fi + 4}.${ei + 1} ${md(e.name)} \`${e.id}\`\n\n${md(e.short)}${e.std ? " *Standards: " + md(e.std) + ".*" : ""}\n\n`;
      o += `**How it works.** ${(e.how || []).map(md).join(" ")}\n\n`;
      if (e.types) o += `**Types**\n\n` + mdT(["Type", "What it is / when to use"], e.types) + "\n";
      if (e.data) o += `**Data (examples)**\n\n` + mdT(e.data.h, e.data.r) + "\n";
      for (const t of e.tables || []) o += `**${md(t.t)}**\n\n` + mdT(t.h, t.r) + (t.note ? `\n${md(t.note)}\n` : "") + "\n";
      if (e.sel) o += `**Selection**\n\n\`\`\`\n${(e.sel.f || []).map(md).join("\n")}\n\`\`\`\nWorked example: ${(e.sel.ex || []).map(md).join(" ")}\n\n`;
      if (e.calc) o += `*Live calculator in the app: ${md(S.calc.CALC[e.calc].t)}.*\n\n`;
      o += `**Mounting:** ${(e.mount || []).map(md).join(" · ")}\n\n`;
      if (e.fail) o += `**Typical failures**\n\n` + mdT(["Symptom", "Cause", "Fix"], e.fail) + "\n";
      o += `**Ask the supplier:** ${(e.ask || []).map((x, i) => `(${i + 1}) ${md(x)}`).join(" ")}\n\n`;
    });
  });
  const pre = document.createElement("pre"); pre.id = "hlMd"; pre.hidden = true; pre.textContent = o; document.body.appendChild(pre);
}
