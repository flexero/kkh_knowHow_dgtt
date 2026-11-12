/* HYDRAULICS tab – item 2 "Standard circuits" (live ISO 1219 circuits + simulation) and item 3 "System sizing".
 * Files: hydckt_sim.js (lumped simulation core) · hydckt_sym.js (ISO 1219 symbols, prefix hs…) · hydckt_c1.js (circuits 1–5 + info)
 *        · hydckt_c2.js (circuits 6–9) · hydckt_size.js (sizing math + presets) · this file (UI) · hydckt.css. Guide: docs/30_hydraulic_circuits_sizing.md
 * Built lazily on the window event "hyitemshow" (hyd.js) with detail "2" / "3".
 * URL (deep links + tests): ?hyitem=2#hyd (&hcfreeze = stay paused after &hct) · &hcckt=lock|cbv|meter|seq|regen|acc|motor|supply|sync · &hcwrong=key[,key] (switch on a "what goes wrong")
 *   · &hcp=k:v,k:v (parameters) · &hct=SEC (pre-run the demo SEC seconds, for screenshots) · &hcinfo=poc (open an info box) · &hcmanual (no demo)
 *   · ?hyitem=3 &hcpreset=guide|apc|hmc|press|motor · &hcsup=auto|fixed|var|acc · &hcstep=N (scroll to a step)
 *   · &hctest (self-check lines in the console: circuits vs hand formulas + sizing vs docs/25) · &hcback (item switching test)
 *   · &hchold (test only: keeps the load event pending so headless screenshots wait for --timeout)
 * Offline, no libraries. All values are EXAMPLES – check every part with the supplier's current catalogue.
 */
import { CIRCUITS_A, INFO, f, PM } from "./hydckt_c1.js";
import { CIRCUITS_B } from "./hydckt_c2.js";
import { esc, hsPc, hsDcv, hsCyl, hsMotor, hsPump, hsRelief, hsTank, hsAcc, hsFilter, hsCBV, hsPRV, hsFCV, hsLine } from "./hydckt_sym.js";
import { design, bom, PRESETS, SER, MOUNT, SYS0, selfTest as sizeTest } from "./hydckt_size.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const CIRCUITS = [...CIRCUITS_A, ...CIRCUITS_B];
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
const log = (s) => console.log("HCTEST " + s);
// test only (&hchold): a never-ending SSE request keeps the load event pending, so headless screenshots wait for --timeout
if (Q.has("hchold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?hchold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr); setTimeout(() => { if (typeof window.showTab === "function") window.showTab("hyd"); }, 300); }

/* ======================================================================= small chart (SVG, one y-axis, legend for ≥ 2 series, hover) */
const COL = ["var(--rb-c1)", "var(--rb-c2)", "var(--rb-c3)", "var(--rb-c4)"];
function niceMax(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e; }
/** data: {t:[], s:[[...],[...]]}; names; unit; returns svg string */
export function chartSvg(data, names, unit, o = {}) {
  const W = o.w || 420, H = o.h || 150, l = 44, r = 8, t = 16, b = 22, iw = W - l - r, ih = H - t - b;
  const T = data.t; if (!T.length) return `<svg viewBox="0 0 ${W} ${H}" class="hc-chart"></svg>`;
  const t0 = o.t0 ?? T[0], t1 = o.t1 ?? Math.max(T[T.length - 1], t0 + 1);
  let lo = Infinity, hi = -Infinity; data.s.forEach((s) => s.forEach((v) => { if (v < lo) lo = v; if (v > hi) hi = v; }));
  if (o.y0 !== undefined) { lo = Math.min(lo, o.y0); }
  if (lo > 0 && lo < hi * 0.6) lo = 0;
  let span = hi - lo; if (!(span > 1e-9)) { span = Math.abs(hi) || 1; lo -= span / 2; hi += span / 2; span = hi - lo; }
  const step = niceMax(span / 4), y0 = Math.floor(lo / step) * step, y1 = Math.ceil(hi / step) * step;
  const X = (x) => l + (x - t0) / (t1 - t0) * iw, Y = (y) => t + ih - (y - y0) / (y1 - y0 || 1) * ih;
  let g = "";
  for (let y = y0; y <= y1 + step * 0.01; y += step) g += `<line x1="${l}" x2="${W - r}" y1="${Y(y).toFixed(1)}" y2="${Y(y).toFixed(1)}" class="hc-grid"/><text x="${l - 4}" y="${(Y(y) + 3).toFixed(1)}" class="hc-ax" text-anchor="end">${+y.toFixed(3)}</text>`;
  const ts = niceMax((t1 - t0) / 5); for (let x = Math.ceil(t0 / ts) * ts; x <= t1 + 1e-9; x += ts) g += `<text x="${X(x).toFixed(1)}" y="${H - 6}" class="hc-ax" text-anchor="middle">${+x.toFixed(2)}</text>`;
  g += `<text x="${W - r}" y="${H - 6}" class="hc-ax" text-anchor="end">${esc(o.xu || "s")}</text><text x="4" y="9" class="hc-ax">${esc(unit)}</text>`;
  data.s.forEach((s, i) => { let d = ""; const n = s.length, stp = Math.max(1, Math.floor(n / 600)); for (let k = 0; k < n; k += stp) d += (d ? "L" : "M") + X(T[k]).toFixed(1) + "," + Y(s[k]).toFixed(1); g += `<path d="${d}" class="hc-ser" style="stroke:${COL[i % 4]}"/>`; });
  if (o.hx !== undefined && o.hx >= 0) {   // hover crosshair
    const tx = t0 + o.hx * (t1 - t0); let k = 0; while (k < T.length - 1 && T[k] < tx) k++;
    const x = X(T[k]); g += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${t}" y2="${t + ih}" class="hc-cross"/>`;
    const lines = [`t = ${T[k].toFixed(2)} ${o.xu || "s"}`, ...data.s.map((s, i) => `${names[i]}: ${(+s[k]).toFixed(Math.abs(s[k]) < 10 ? 2 : 1)} ${unit}`)];
    const bw = Math.max(...lines.map((s) => s.length)) * 6 + 10, bx = x + 8 + bw > W ? x - 8 - bw : x + 8;
    g += `<rect x="${bx.toFixed(1)}" y="${t + 2}" width="${bw}" height="${lines.length * 13 + 6}" class="hc-tip"/>` + lines.map((s, i) => `<text x="${(bx + 5).toFixed(1)}" y="${t + 15 + i * 13}" class="hc-tipt">${esc(s)}</text>`).join("");
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="hc-chart">${g}</svg>`;
}
const legend = (names) => (names.length > 1 ? `<div class="hc-leg">${names.map((n, i) => `<span><i style="background:${COL[i % 4]}"></i>${esc(n)}</span>`).join("")}</div>` : "");
const tbl = (head, rows, cls = "hc-tbl") => `<table class="${cls}"><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table>`;
const card5 = (T) => `<div class="hc-c5">${[["What", T.what], ["Why", T.why], ["How", T.how], ["Check", T.check], ["Typical mistake", T.mistake]].map(([h, x]) => `<div class="hc-c5i ${h === "Typical mistake" ? "hc-c5m" : ""}"><b>${h}</b><p>${esc(x)}</p></div>`).join("")}</div>`;
const hoverable = (el, cb) => { el.addEventListener("mousemove", (e) => { const s = e.target.closest("svg.hc-chart"); if (!s) return; const r = s.getBoundingClientRect(), vw = s.viewBox.baseVal.width || 420, fx = (e.clientX - r.left) / r.width, l = 44 / vw, rr = 8 / vw; cb(s.dataset.ci, Math.max(0, Math.min(1, (fx - l) / (1 - l - rr)))); }); el.addEventListener("mouseleave", () => cb(null, -1)); };

/* ======================================================================= ITEM 2: standard circuits */
function buildCircuits(box) {
  const U = { c: null, P: {}, W: {}, n: null, hist: null, demo: false, scr: [], k: 0, paused: false, info: Q.get("hcinfo") || null, hover: {}, speedMul: 1 };
  box.innerHTML = `
  <div class="card hc-navc"><div class="hc-nav" role="group" aria-label="Circuit">${CIRCUITS.map((c) => `<button class="mx-el" data-hcc="${c.id}">${c.n} · ${esc(c.title.split(" – ")[0].split(" (")[0])}</button>`).join("")}</div>
    <p class="hc-note">Live ISO 1219 circuits: switch the valve, change the load, switch on a fault. Line colour = pressure (blue tank → red ≥ 12 MPa, violet = cavitation), moving dashes = oil flow. Click any symbol for its data. Simulation: lumped model with orifice equation, oil compressibility (β = 1.4 GPa), cylinder / motor dynamics – example values.</p></div>
  <div class="hc-main">
    <div class="card hc-left">
      <div class="hc-ttl"><h3 id="hcTitle"></h3><span id="hcSub" class="hc-sub"></span></div>
      <div class="hc-ctrl" id="hcCtrl"></div>
      <div class="hc-svgw"><svg id="hcSvg" class="hc-svg" viewBox="0 0 760 500" role="img" aria-label="hydraulic circuit"></svg></div>
      <div class="hc-cbar"><span>p:</span><i style="background:linear-gradient(90deg,${[0, 0.25, 0.5, 0.75, 1].map((r) => hsPc(r * PM, PM)).join(",")})"></i><span>0 → 12 MPa</span><i class="hc-cav"></i><span>cavitation</span><span class="hc-dash">- - -</span><span>pilot / drain</span></div>
      <div class="hc-params" id="hcParams"></div>
      <div class="hc-wrong" id="hcWrong"></div>
    </div>
    <div class="card hc-right">
      <div id="hcInfo" class="hc-info"></div>
      <h4>Live values</h4><table class="hc-tbl hc-rd" id="hcRd"></table>
      <div id="hcCharts"></div>
    </div>
  </div>
  <div class="card"><h3>What · Why · How · Check · Typical mistake</h3><div id="hcCards"></div></div>
  <div class="hc-g2"><div class="card"><h3>Formulas with example numbers <span class="hc-ex">example – check the supplier's current catalogue</span></h3><div id="hcFx"></div></div>
    <div class="card"><h3>Setting values</h3><div id="hcSet"></div><div id="hcExtra"></div></div></div>
  <div class="card"><h3>What goes wrong – failures, causes, remedies</h3><div id="hcFail"></div><p class="hc-twin" id="hcTwin"></p></div>`;
  const svg = $("hcSvg");

  function select(id, keepParams) {
    const c = CIRCUITS.find((x) => x.id === id) || CIRCUITS[0];
    U.c = c;
    if (!keepParams) { U.P = {}; c.P.forEach((p) => (U.P[p.k] = p.v)); U.W = {}; }
    box.querySelectorAll("[data-hcc]").forEach((b) => b.classList.toggle("active", b.dataset.hcc === c.id));
    $("hcTitle").textContent = `${c.n} · ${c.title}`; $("hcSub").textContent = c.sub;
    renderStatic(); reset(!Q.has("hcmanual"));
  }
  function renderStatic() {
    const c = U.c, P = U.P;
    $("hcCtrl").innerHTML = c.V.map((v) => `<div class="hc-seg"><span>${esc(v.l)}</span>${v.opts.map(([val, lab]) => `<button class="hc-sb" data-hcv="${v.k}" data-val="${val}">${esc(lab)}</button>`).join("")}</div>`).join("")
      + `<div class="hc-seg"><button class="hc-sb hc-run" data-hcdo="demo">▶ Demo cycle</button><button class="hc-sb" data-hcdo="reset">⟲ Reset</button><button class="hc-sb" data-hcdo="pause" id="hcPause">⏸ Pause</button><span id="hcTime" class="hc-time"></span></div>`;
    $("hcParams").innerHTML = c.P.map((p) => p.opts
      ? `<label class="hc-pi"><span>${esc(p.l)}</span><select data-hcp="${p.k}">${p.opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(P[p.k]) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>`
      : `<label class="hc-pi"><span>${esc(p.l)} <b data-hcpv="${p.k}">${P[p.k]} ${esc(p.u || "")}</b></span><input type="range" min="${p.min}" max="${p.max}" step="${p.st}" value="${P[p.k]}" data-hcp="${p.k}"></label>`).join("");
    $("hcWrong").innerHTML = `<b>What goes wrong without it?</b>` + c.W.map((w) => `<label class="hc-wi"><input type="checkbox" data-hcw="${w.k}" ${U.W[w.k] ? "checked" : ""}> ${esc(w.l)}</label>`).join("");
    $("hcCards").innerHTML = card5(c.txt);
    renderText();
    $("hcFail").innerHTML = tbl(["Fault", "Cause", "Remedy"], c.fail.map((r) => [esc(r[0]), esc(r[1]), esc(r[2])]));
    $("hcTwin").textContent = c.twin;
    $("hcCharts").innerHTML = c.charts.map((ch, i) => `<div class="hc-ch"><div class="hc-cht">${esc(ch.t)}</div><div data-hcch="${i}"></div>${legend(ch.s.map((s) => s[0]))}</div>`).join("");
  }
  function renderText() {
    const c = U.c;
    $("hcFx").innerHTML = c.fx(U.P, U.W);
    $("hcSet").innerHTML = tbl(["Element", "Setting (example)", "Rule"], c.set(U.P, U.W).map((r) => r.map(esc)));
    $("hcExtra").innerHTML = c.id === "supply" ? `<h4>Energy per 10 s cycle – all four supply types (same job, demand ${U.P.dem} %)</h4><div id="hcSupTbl"><button class="hc-sb" data-hcdo="suptbl">calculate the comparison</button></div>` : "";
    if (c.id === "supply") setTimeout(supTable, 30);
  }
  function supTable() {
    const el = $("hcSupTbl"); if (!el || U.c.id !== "supply") return;
    const R = U.c.results(U.P);
    el.innerHTML = tbl(["Supply type", "Energy in (kJ)", "Useful (kJ)", "Loss = heat (kJ)", "Average (kW)", "Efficiency"], R.map((r) => [esc(r.l), f(r.Ein / 1000, 1), f(r.Euse / 1000, 1), `<b>${f(r.Eloss / 1000, 1)}</b>`, f(r.Pavg / 1000, 2), f(r.Euse / r.Ein * 100, 0) + " %"]))
      + `<p class="hc-note">Simulated with the same lumped model (hydraulic power p·Q at the pump, η not included). The pause (≈ 60 % of the cycle) decides the winner. Example values.</p>`;
  }
  function reset(demo) {
    const c = U.c;
    U.n = c.make(U.P, U.W);
    U.hist = c.charts.map((ch) => ({ t: [], s: ch.s.map(() => []) }));
    U.lastRec = -1; U.demo = !!demo; U.scr = c.script(U.P, U.W).slice(); U.k = 0; U.paused = false;
    if (!demo) U.n.u.s = 0;
    U.speed = c.speed || 1; U.recDt = 0.02 * U.speed;
    if ($("hcPause")) $("hcPause").textContent = "⏸ Pause";
    renderInfo(); drawAll(true);
  }
  function setU(k, v, user) {
    const n = U.n; n.u[k] = v; if (U.c.onU) U.c.onU(n, { [k]: v });
    if (user) U.demo = false;
  }
  function advance(sec) {
    const n = U.n, c = U.c, steps = Math.round(sec / n.dt);
    for (let i = 0; i < steps; i++) {
      if (U.demo) while (U.k < U.scr.length && U.scr[U.k][0] <= n.t + 1e-9) { const u = U.scr[U.k][1]; Object.keys(u).forEach((kk) => setU(kk, u[kk], false)); U.k++; }
      if (n.t - U.lastRec >= U.recDt - 1e-9) { U.lastRec = n.t; record(); }
      n.step(n.dt);
    }
    void c;
  }
  function record() {
    const n = U.n, win = Math.max(U.c.dur, 12);
    U.c.charts.forEach((ch, i) => {
      const H = U.hist[i]; H.t.push(n.t); ch.s.forEach((s, j) => H.s[j].push(+s[1](n) || 0));
      while (H.t.length > 2 && H.t[0] < n.t - win) { H.t.shift(); H.s.forEach((a) => a.shift()); }
    });
  }
  let lastChart = 0, lastRd = 0;
  function drawAll(force) {
    const c = U.c, n = U.n, now = performance.now();
    try { svg.innerHTML = c.draw(n, U.P, U.W, n.t / (U.speed || 1)); } catch (e) { console.error(e); svg.innerHTML = `<text x="20" y="40" class="hs-warnbig">draw error: ${esc(e.message)}</text>`; }
    if (force || now - lastRd > 200) {
      lastRd = now;
      $("hcRd").innerHTML = c.rd(n, U.P, U.W).map(([l, v, cl]) => `<tr><td>${esc(l)}</td><td class="hc-v ${cl || ""}">${esc(v)}</td></tr>`).join("");
      $("hcTime").textContent = `t = ${n.t.toFixed(2)} s${U.speed > 1 ? " (× " + U.speed + ")" : ""}${U.demo ? " · demo" : " · manual"}${U.paused ? " · paused" : ""}`;
      box.querySelectorAll("[data-hcv]").forEach((b) => b.classList.toggle("active", String(n.u[b.dataset.hcv] || 0) === b.dataset.val));
    }
    if (force || now - lastChart > 250) {
      lastChart = now;
      c.charts.forEach((ch, i) => { const el = box.querySelector(`[data-hcch="${i}"]`); if (!el) return; const H = U.hist[i]; const t1 = n.t, t0 = Math.max(0, t1 - Math.max(c.dur, 12)); el.innerHTML = chartSvg(H, ch.s.map((s) => s[0]), ch.u, { t0, t1: Math.max(t1, t0 + Math.max(c.dur, 12) * (t1 < c.dur ? 1 : 1)), hx: U.hover[i] ?? -1 }).replace("<svg ", `<svg data-ci="${i}" `); });
    }
  }
  function renderInfo() {
    const el = $("hcInfo"), k = U.info, I = k && INFO[k];
    if (!I) { el.innerHTML = `<p class="hc-note">ⓘ Click a symbol in the circuit (valve, pump, cylinder, gauge …) to see what it is, its data, why it is there, what to check and how it fails.</p>`; return; }
    el.innerHTML = `<div class="hc-ib"><button class="hc-x" data-hcdo="closeinfo" aria-label="close">×</button><b>${esc(I.t)}</b><p>${esc(I.w)}</p><dl><dt>Data (example)</dt><dd>${esc(I.r)}</dd><dt>Why</dt><dd>${esc(I.y)}</dd>${I.c ? `<dt>Check</dt><dd>${esc(I.c)}</dd>` : ""}${I.f ? `<dt>Typical failure</dt><dd>${esc(I.f)}</dd>` : ""}</dl></div>`;
  }

  /* ---- events */
  box.addEventListener("click", (e) => {
    const cc = e.target.closest("[data-hcc]"); if (cc) { select(cc.dataset.hcc); return; }
    const v = e.target.closest("[data-hcv]"); if (v) { setU(v.dataset.hcv, +v.dataset.val, true); drawAll(true); return; }
    const d = e.target.closest("[data-hcdo]");
    if (d) {
      const k = d.dataset.hcdo;
      if (k === "demo") reset(true); else if (k === "reset") reset(false);
      else if (k === "pause") { U.paused = !U.paused; d.textContent = U.paused ? "▶ Continue" : "⏸ Pause"; }
      else if (k === "closeinfo") { U.info = null; renderInfo(); } else if (k === "suptbl") supTable();
      drawAll(true); return;
    }
  });
  svg.addEventListener("pointerdown", (e) => {
    const a = e.target.closest("[data-hcact]");
    if (a) { const [k, val] = a.dataset.hcact.split(":"); if (k === "sol") { const cur = U.n.u.s || 0, tv = +val; setU("s", cur === tv ? 0 : tv, true); drawAll(true); } return; }
    const h = e.target.closest("[data-hcinfo]"); if (h) { U.info = h.dataset.hcinfo; renderInfo(); }
  });
  box.addEventListener("input", (e) => {
    const p = e.target.closest("[data-hcp]");
    if (p) { const def = U.c.P.find((x) => x.k === p.dataset.hcp); U.P[p.dataset.hcp] = def.opts ? (isNaN(+p.value) ? p.value : +p.value) : +p.value; const lab = box.querySelector(`[data-hcpv="${def.k}"]`); if (lab) lab.textContent = `${p.value} ${def.u || ""}`; if (e.type === "input" && !def.opts) { renderText(); return; } }
  });
  box.addEventListener("change", (e) => {
    const p = e.target.closest("[data-hcp]"); if (p) { renderText(); reset(true); return; }
    const w = e.target.closest("[data-hcw]"); if (w) { U.W[w.dataset.hcw] = w.checked; renderText(); reset(true); }
  });
  hoverable($("hcCharts"), (ci, x) => { if (ci === null) U.hover = {}; else U.hover = { [ci]: x }; lastChart = 0; });

  /* ---- loop (pauses itself when the item / tab is hidden) */
  let raf = 0, lastTs = 0, running = false;
  function loop(ts) {
    raf = 0;
    if (!box.offsetParent) { running = false; return; }
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0; lastTs = ts;
    if (!U.paused) advance(dt * (U.speed || 1));
    drawAll(false);
    raf = requestAnimationFrame(loop);
  }
  function show() { if (!running) { running = true; lastTs = 0; raf = requestAnimationFrame(loop); } }

  /* ---- initial state from the URL */
  const c0 = CIRCUITS.find((x) => x.id === Q.get("hcckt")) || CIRCUITS[0];
  U.c = c0; c0.P.forEach((p) => (U.P[p.k] = p.v));
  (Q.get("hcp") || "").split(",").filter(Boolean).forEach((kv) => { const [k, v] = kv.split(":"); if (k in U.P) U.P[k] = isNaN(+v) ? v : +v; });
  (Q.get("hcwrong") || "").split(",").filter(Boolean).forEach((k) => (U.W[k] = true));
  select(c0.id, true);
  if (Q.get("hct")) { advance(+Q.get("hct")); if (Q.has("hcfreeze")) U.paused = true; drawAll(true); }

  /* ---- self-test (&hctest): every circuit against hand formulas */
  function selfTest() {
    CIRCUITS.forEach((c) => { const P = {}; c.P.forEach((p) => (P[p.k] = p.v)); try { c.test(P, {}).forEach(log); } catch (e) { log(`${c.id} ERROR ${e.message}`); } });
    log(`circuits errors=${errs.length ? errs.join(" | ") : "none"}`);
  }
  return { show, selfTest, U };
}

/* ======================================================================= ITEM 3: system sizing */
function buildSizing(box) {
  const presetKey = PRESETS[Q.get("hcpreset")] ? Q.get("hcpreset") : "guide";
  const Z = { key: presetKey, sys: {}, loads: [], R: null, hover: {} };
  const load = (k) => { const p = PRESETS[k]; Z.key = k; Z.sys = Object.assign({}, SYS0, p.sys); Z.loads = p.loads.map((l) => Object.assign({}, l)); if (Q.get("hcsup") && k === presetKey) Z.sys.supply = Q.get("hcsup"); };
  load(presetKey);
  box.innerHTML = `
  <div class="card"><div class="hc-nav">${Object.entries(PRESETS).map(([k, p]) => `<button class="mx-el" data-hzpre="${k}">${esc(p.title)}</button>`).join("")}</div>
    <p class="hc-note">Preset = a complete example. Change any input – every number, the parts list and the circuit summary update. Same method and numbers as docs/25 (preset "Guide 25"). All values are examples – check the supplier's current catalogue.</p>
    ${card5({ what: "A complete hydraulic system design from the load list: pressure, cylinders / motors, flows, duty cycle, supply type, pump, motor kW, accumulator, valve sizes, settings, pipes, heat, tank, filter, parts list.", why: "The supplier needs your load list and duty cycle; you need your own numbers to check the offers (pump size, accumulator, cooler, energy).", how: "Fill the load list (force, stroke, times, start time in the cycle, mounting, vertical?). The calculator follows the 12 steps of docs/25 and picks standard sizes from the shared series.", check: "Buckling OK (safety 3.5), relief ≥ 1.1 × highest working pressure, refill time < pause, oil velocity in the lines, heat ≤ tank cooling or cooler, cleanliness class for the most sensitive valve.", mistake: "Pump sized for the peak flow when the duty cycle has long pauses; return line sized for pump flow (the cap side gives A1/A2 × more); forgetting the rod-side intensification; accumulator with gauge pressure or n = 1." })}</div>
  <div class="card"><h3>Load list <span class="hc-ex">every actuator, its job and its time in the cycle</span></h3><div id="hzLoads"></div>
    <div class="hc-seg"><button class="hc-sb" data-hzdo="addc">+ cylinder</button><button class="hc-sb" data-hzdo="addm">+ hydraulic motor</button></div></div>
  <div class="card"><h3>System data</h3><div class="hc-sys" id="hzSys"></div></div>
  <div id="hzWarn"></div>
  <div class="card"><h3>Duty cycle <span class="hc-ex">flow and pressure over one machine cycle</span></h3><div class="hc-g2 hc-g2t"><div><div class="hc-cht">Flow demand of the actuators vs pump flow</div><div id="hzCh1"></div><div id="hzLg1"></div></div><div><div class="hc-cht">Electric input power of the three supply types</div><div id="hzCh2"></div><div id="hzLg2"></div></div></div><div id="hzDuty"></div></div>
  <div id="hzSteps"></div>
  <div class="hc-g2"><div class="card"><h3>Generated circuit (summary)</h3><svg id="hzSvg" class="hc-svg" viewBox="0 0 760 420"></svg><p class="hc-note">Simplified ISO 1219 summary of the result – not a complete production drawing.</p></div>
    <div class="card"><h3>Questions for the supplier</h3><ol class="hc-ol" id="hzQ"></ol></div></div>
  <div class="card"><h3>Parts list (BOM) <span class="hc-ex">example data – check the supplier's current catalogue</span></h3><div id="hzBom"></div></div>`;

  const num = (k, l, u, st = "any") => `<label class="hc-pi"><span>${l}</span><span class="hc-in"><input type="number" step="${st}" data-hzs="${k}" value="${Z.sys[k]}"> ${u}</span></label>`;
  function renderSys() {
    const s = Z.sys;
    $("hzSys").innerHTML = `<label class="hc-pi"><span>System pressure p_sys (ISO 2944)</span><select data-hzs="p">${SER.p.map((p) => `<option ${p === s.p ? "selected" : ""}>${p}</option>`).join("")}</select></label>`
      + num("loss", "Losses valves + lines (of p_sys)", "%") + num("etaCyl", "Cylinder efficiency η_cyl", "") + num("T", "Cycle time", "s") + num("dpl", "Δp valves + lines at peak flow", "MPa")
      + num("etaTot", "Pump + motor efficiency η_total", "") + num("etaV", "Pump volumetric efficiency η_v", "") + num("n", "Motor speed (4-pole 50 Hz)", "rpm", 1)
      + `<label class="hc-pi"><span>Supply type</span><select data-hzs="supply">${[["auto", "automatic choice"], ["fixed", "fixed pump + unloading"], ["var", "variable pump"], ["acc", "pump + accumulator"]].map(([v, l]) => `<option value="${v}" ${v === s.supply ? "selected" : ""}>${l}</option>`).join("")}</select></label>`
      + `<label class="hc-pi"><span>Gas law accumulator</span><select data-hzs="nGas"><option value="1.4" ${s.nGas == 1.4 ? "selected" : ""}>adiabatic n = 1.4 (fast, &lt; 1 min)</option><option value="1" ${s.nGas == 1 ? "selected" : ""}>isothermal n = 1 (slow)</option></select></label>`
      + `<label class="hc-pi"><span>Accumulator alone gives the stroke oil (pump ignored)</span><input type="checkbox" data-hzs="ignorePump" ${s.ignorePump ? "checked" : ""}></label>`
      + num("Lp", "Pressure line length", "m") + num("Lr", "Return line length", "m") + num("Tamb", "Ambient temperature", "°C") + num("Toil", "Max oil temperature", "°C") + num("k", "Tank heat transfer k", "W/m²K") + num("tankF", "Tank = × pump flow per minute", "");
  }
  function renderLoads() {
    const H = ["Name", "Type", "Force F / torque T", "Stroke / speed", "Start", "Extend / run", "Dwell", "Retract", "Return force", "Mounting (buckling)", "Vertical", "Hanging weight", "Reduced p", "Prop.", ""];
    $("hzLoads").innerHTML = `<div class="hc-scroll"><table class="hc-tbl hc-ld"><tr>${H.map((h) => `<th>${h}</th>`).join("")}</tr>${Z.loads.map((l, i) => {
      const n = (k, w = 58, st = "any") => `<input type="number" step="${st}" style="width:${w}px" data-hzl="${i}:${k}" value="${l[k]}">`;
      const cyl = l.type !== "mot";
      return `<tr><td><input type="text" style="width:150px" data-hzl="${i}:name" value="${esc(l.name)}"></td><td><select data-hzl="${i}:type"><option value="cyl" ${cyl ? "selected" : ""}>cylinder</option><option value="mot" ${cyl ? "" : "selected"}>motor</option></select></td>`
        + (cyl ? `<td>${n("F")} kN</td><td>${n("s")} mm</td><td>${n("t0", 46)} s</td><td>${n("tExt", 46)} s</td><td>${n("tDw", 46)} s</td><td>${n("tRet", 46)} s</td><td>${n("Fret", 46)} kN</td>
          <td><select data-hzl="${i}:mount">${Object.entries(MOUNT).map(([k, m]) => `<option value="${k}" ${k === l.mount ? "selected" : ""}>K=${m[0]} ${esc(m[1].split(" (")[0])}</option>`).join("")}</select></td><td><input type="checkbox" data-hzl="${i}:vert" ${l.vert ? "checked" : ""}></td><td>${n("mh", 58)} kg</td><td>${n("pred", 46)} MPa</td>`
          : `<td>${n("T")} N·m</td><td>${n("nm")} rpm</td><td>${n("t0", 46)} s</td><td>${n("tRun", 46)} s</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td><td>–</td>`)
        + `<td><input type="checkbox" data-hzl="${i}:prop" ${l.prop ? "checked" : ""}></td><td><button class="hc-sb" data-hzdel="${i}" aria-label="delete">✕</button></td></tr>`;
    }).join("")}</table></div><p class="hc-note">Reduced p &gt; 0 = branch with a pressure reducing valve (clamp). Prop. = proportional valve (cleanliness 16/14/11). Vertical = load can fall → holding valve. Hanging weight (kg, example) = 0: the force F itself is the lifted weight (rod up, holding pressure F/A1); &gt; 0: rod-down cylinder such as a press ram – F is the process force and the weight hangs on the rod side (holding pressure m·g/A2).</p>`;
  }
  const L2 = (x) => f(x, 2), L1 = (x) => f(x, 1);
  function step(n, title, body, check) { return `<div class="card hc-step" id="hzStep${n}"><h3><span class="hc-stn">${n}</span>${esc(title)}</h3>${body}${check ? `<p class="hc-chk">${check}</p>` : ""}</div>`; }
  function compute() {
    const R = design(Z.loads, Z.sys), S = R.S; Z.R = R;
    box.querySelectorAll("[data-hzpre]").forEach((b) => b.classList.toggle("active", b.dataset.hzpre === Z.key));
    $("hzWarn").innerHTML = R.warn.length ? `<div class="card hc-warnc"><b>Check:</b><ul>${R.warn.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>` : "";
    // ---- duty cycle charts
    const D = R.duty, stp = Math.max(1, Math.round(D.N / 500)), tt = [], qd = [], qp = [], pa = [], pb = [], pc = [];
    for (let k = 0; k < D.N; k += stp) { tt.push(k * D.dt); qd.push(D.Qd[k]); qp.push(R.pick === "acc" ? R.acc.pumpQ : R.pump.Q); pa.push(R.opt[0].P[k]); pb.push(R.opt[1].P[k]); pc.push(R.opt[2].P[k]); }
    const n1 = ["flow demand (actuators)", R.pick === "acc" ? "pump flow (accumulator charging)" : "pump flow"], n2 = R.opt.map((o) => o.l.split(" (")[0].split(" + tandem")[0]);
    const drawCh = () => { $("hzCh1").innerHTML = chartSvg({ t: tt, s: [qd, qp] }, n1, "L/min", { t0: 0, t1: S.T, y0: 0, w: 640, h: 200, hx: Z.hover[1] ?? -1 }).replace("<svg ", '<svg data-ci="1" '); $("hzCh2").innerHTML = chartSvg({ t: tt, s: [pa, pb, pc] }, n2, "kW", { t0: 0, t1: S.T, y0: 0, w: 640, h: 200, hx: Z.hover[2] ?? -1 }).replace("<svg ", '<svg data-ci="2" '); };
    Z.drawCh = drawCh; drawCh(); $("hzLg1").innerHTML = legend(n1); $("hzLg2").innerHTML = legend(n2);
    $("hzDuty").innerHTML = tbl(["Peak flow", "Average flow", "Peak / average", "Oil per cycle", "Moving time", "Highest pressure needed"], [[`<b>${L1(D.Qpk)} L/min</b>`, `${L2(D.Qavg)} L/min`, L1(D.ratio), `${f(D.Vtot, 3)} L`, `${L1(D.tMove)} s of ${S.T} s`, `${L2(D.pmax)} MPa (load + ${S.dpl} MPa losses)`]]);
    // ---- steps
    let h = "";
    const peff = S.p * (1 - S.loss / 100);
    h += step(1, "Load list and system pressure", `<p>p_sys = <b>${S.p} MPa</b> (machine-tool clamps 5–7, industry 10–21, mobile 25–35). Losses ${S.loss} % → p_eff = ${S.p} · (1 − ${S.loss / 100}) = <b>${L2(peff)} MPa</b> at the actuator.</p>`, "Higher pressure = smaller parts, but more leakage, noise and cost of components. Use the ISO 2944 steps.");
    h += step(2, "Cylinders and motors", R.acts.map((a) => {
      const ld = a.ld;
      if (a.kind === "mot") return `<h4>${a.tag} ${esc(ld.name)} – hydraulic motor</h4><pre class="hc-pre">V = 2π·T / (Δp·η_hm) = 2π·${ld.T} / (${L2(a.dp)} MPa · ${a.etaHm}) = ${L1(a.Vreq)} cm³/rev → <b>${a.V} cm³/rev</b> (${a.type})
Δp needed = 2π·T/(V·η_hm) + 0.5 back pressure = <b>${L2(a.pNeed)} MPa</b>
Q = V·n / η_v = ${a.V}·${ld.nm} / ${a.etaV} / 1000 = <b>${L1(a.Q)} L/min</b>      P = 2π·n·T/60 = ${L2(a.Pmech)} kW</pre>`;
      const b = a.buck;
      return `<h4>${a.tag} ${esc(ld.name)} – cylinder${ld.pred > 0 ? ` (reduced branch ${ld.pred} MPa)` : ""}</h4><pre class="hc-pre">A = F / (p_eff·η_cyl) = ${ld.F * 1000} N / (${L2(a.p)} MPa · ${S.etaCyl}) = ${L2(a.Areq)} cm²  →  D = √(4A/π) = ${L1(a.Dreq)} mm → <b>Ø${a.D}</b> (ISO 3320), rod <b>Ø${a.d}</b> (φ = ${L2(a.phi)})
A1 = ${L2(a.A1)} cm²   A_rod = ${L2(a.Ar)} cm²   A2 = ${L2(a.A2)} cm²   pressure needed p = F/(A1·η) = <b>${L2(a.pNeed)} MPa</b>   max force at ${ld.pred || S.p} MPa = ${L1(a.Fmax)} kN
Buckling: length extended L ≈ 2·stroke + 150 = ${a.Lfull} mm, K = ${a.K} (${esc(MOUNT[ld.mount][1].split(",")[0])}) → L_k = ${f(b.Lk, 0)} mm, I = π·d⁴/64 = ${f(b.I, 0)} mm⁴, λ = 4·L_k/d = ${L1(b.lam)}
  Euler F_k = π²·E·I / L_k² = ${f(b.Fe / 1000, 0)} kN   Tetmajer (λ < 85): (335 − 0.62·λ)·A_rod = ${f(b.Ft / 1000, 0)} kN   → ${b.rule}: F_k = ${f(b.Fk / 1000, 0)} kN
  allowed F_k / 3.5 = <b>${f(b.Fall / 1000, 1)} kN ${b.ok ? "≥" : "<"} ${ld.F} kN ${b.ok ? "✓" : "✗"}</b>
Rod side: meter-out intensification p·A1/A2 = ${ld.pred || S.p}·${L2(a.phi)} = <b>${L1(a.pInt)} MPa</b> → rate the rod side for it</pre>`;
    }).join(""), "Long thin rods: buckling with safety 3.5 (Euler for slender rods, Tetmajer for short ones). Choose the mounting so the rod is guided.");
    h += step(3, "Flows of every movement", tbl(["Actuator", "Movement", "Speed", "Flow in", "Flow out (return line!)", "Oil", "Pressure"], R.acts.flatMap((a) => a.kind === "mot" ? [[a.tag, "run", `${a.ld.nm} rpm`, `${L1(a.Q)} L/min`, `${L1(a.Q)} L/min`, `${f(a.Vol, 2)} L`, `${L2(a.pNeed)} MPa`]]
      : [[a.tag, "extend", `${f(a.vE, 3)} m/s`, `<b>${L1(a.QE)}</b> L/min`, `${L1(a.QEout)} L/min`, `${f(a.VE, 3)} L`, `${L2(a.pNeed)} MPa`], [a.tag, "retract", `${f(a.vR, 3)} m/s`, `${L1(a.QR)} L/min`, `<b>${L1(a.QRout)}</b> L/min`, `${f(a.VR, 3)} L`, `${L2(a.pRet)} MPa`]]))
      + `<pre class="hc-pre">Q [L/min] = A [cm²] · v [m/min] / 10      e.g. ${R.acts[0].kind === "cyl" ? `${L2(R.acts[0].A1)} · ${f(R.acts[0].vE * 60, 2)} / 10 = ${L1(R.acts[0].QE)} L/min` : "motor: Q = V·n/η_v"}</pre>`, "On retraction the cap side gives A1/A2 × the pump flow → size the return line and the return filter for it.");
    h += step(4, "Supply type – energy comparison", `${tbl(["Option", "Pump", "Peak power", "RMS power", "Average power", "Energy / cycle", "Loss = heat / cycle", "Motor (IEC)"], R.opt.map((o) => [(o.k === R.pick ? "<b>▶ " : "") + esc(o.l) + (o.k === R.pick ? "</b>" : ""), `${o.pump.list} ${o.pump.V} cm³/rev = ${L1(o.pump.Q)} L/min`, `${L2(o.Pk)} kW`, `${L2(o.Prms)} kW`, `${f(o.Pavg, 3)} kW`, `${L1(o.E)} kJ`, `${L1(o.Eloss)} kJ`, `<b>${o.kw} kW</b>`]))}
      <p>Choice: <b>${esc(R.sup.l)}</b> – ${esc(R.whyPick)}.</p>
      <pre class="hc-pre">Electric power P = p[bar] · Q[L/min] / (600 · η_total)          η_total = ${S.etaTot}
Intermittent duty: motor rating ≥ RMS power √(Σ P_i²·t_i / T) and ≥ peak / 1.5 (short overload of an induction motor)
Fixed pump at peak flow ${L1(R.opt[0].pump.Q)} L/min, working ${L2(D.pmax)} MPa: ${f(D.pmax * 10, 0)} bar · ${L1(R.opt[0].pump.Q)} / (600·${S.etaTot}) = ${L2(D.pmax * 10 * R.opt[0].pump.Q / (600 * S.etaTot))} kW while moving
Pump displacement V = Q·1000 / (n·η_v) = ${L1(R.sup.pump.Qreq)}·1000 / (${S.n}·${S.etaV}) = ${L2(R.sup.pump.Vg)} cm³/rev → standard <b>${R.sup.pump.V} cm³/rev</b> → Q = ${R.sup.pump.V}·${S.n}·${S.etaV}/1000 = ${L1(R.sup.pump.Q)} L/min</pre>`,
      `Rule: peak ≫ average and long pauses → small pump + accumulator; several actuators or changing flow → variable pump; nearly continuous flow → fixed pump. ${R.pick === "acc" && R.sup.pump.V === 4 ? "Note: the smallest gear pump of the series (4 cm³/rev = " + L1(R.sup.pump.Q) + " L/min) is bigger than needed – docs/25 uses an ideal 2 L/min pump (0.39 kW); a micro pump or a 6/8-pole motor gives the same." : ""}`);
    const A = R.acc;
    h += step(5, "Accumulator" + (R.pick === "acc" ? "" : " (only for the accumulator option)"), `<pre class="hc-pre">Use ABSOLUTE pressures and n = ${A.n} (${A.n == 1.4 ? "adiabatic, discharge < 1 min" : "isothermal"})
p1 = highest working pressure = ${L2(A.p1)} MPa g → ${L2(A.p1a)} MPa abs      p2 = p_sys = ${A.p2} MPa g → ${L2(A.p2a)} MPa abs
p0 = 0.9 · p1 = ${L2(A.p0a)} MPa abs = <b>${L2(A.p0g)} MPa gauge pre-charge (N₂)</b>
ΔV = oil of the largest movement window = ${f(A.dV, 3)} L ${Z.sys.ignorePump ? "(pump flow ignored – safe, = docs/25)" : "(minus the pump flow during the movement)"}
V0 = ΔV / [ (p0/p1)^(1/n) − (p0/p2)^(1/n) ] = ${f(A.dV, 3)} / ${f(A.fac, 4)} = <b>${L2(A.V0)} L</b> → bladder <b>${A.Vacc} L</b>   (isothermal would give ${L2(A.V0iso)} L – too small)
Charging: ${f(D.Vtot, 3)} L per cycle with ${L1(A.pumpQ)} L/min → ${L1(A.tCharge)} s of ${S.T} s ${A.tCharge < S.T ? "✓" : "✗"}</pre>`, "Pre-charge check yearly; safety and shut-off block with relief and discharge valve; PED 2014/68/EU; warning label 'accumulator – discharge before work'.");
    h += step(6, "Valves – sizes and settings", tbl(["Actuator", "Max flow through the valve", "Size (ISO 4401)", "Δp per path (≈ 0.5 MPa at 60 % of the rating, ∝ Q²)"], R.valves.map((v) => [v.a.tag, `${L1(v.a.Qv)} L/min`, `<b>${v.ng}</b> (up to ≈ ${v.Qmax} L/min)`, `${f(v.dp, 3)} MPa`]))
      + tbl(["Element", "Setting (example)", "Rule"], [["0V1 relief valve", `<b>${R.relief} MPa</b>`, `≥ 1.1 × ${L2(D.pmax)} = ${L2(R.reliefMin)} MPa and below the weakest part (cylinder rating ${R.ratingMin} MPa)`], ...R.settings.map((r) => [esc(r[0]), `<b>${esc(r[1])}</b>`, esc(r[2])])]),
      "Δp values from the catalogue Δp–Q curves of the real valve. Centre type: float for pilot checks / counterbalance, tandem for a fixed pump, closed for accumulator / variable pump.");
    h += step(7, "Pipes and hoses", tbl(["Line", "Flow", "Velocity rule", "d = 4.61·√(Q/v)", "Tube EN 10305-4", "Real v", "Re", "Barlow σ = p·D/(2t)", "Δp", "Hose"], R.lines.map((l) => [l.name, `${L1(l.Q)} L/min`, `${l.v} m/s`, `${L1(l.dreq)} mm`, `<b>${l.tube[0]}×${l.tube[1]}</b> (ID ${l.id})`, `${L2(l.vel)} m/s`, f(l.Re, 0) + (l.Re < 2300 ? " lam." : " turb."), `${f(l.sig, 0)} MPa ${l.sig <= 60 ? "✓" : "✗"}${l.fallback ? " <b class=\"hc-bad\">fallback – see warning</b>" : ""}`, `${f(l.dp, 3)} MPa / ${l.L} m`, `DN ${l.hose}`]))
      + `<pre class="hc-pre">Δp = λ·(L/d)·ρ·v²/2,  λ = 64/Re (laminar, Re = v·d/ν < 2300) or 0.316/Re^0.25 (turbulent),  ν = 46 mm²/s, ρ = 870 kg/m³ (HLP 46, 40 °C)
Allowed stress E235 ≈ 60 MPa (static, with safety); add fittings + bends (ζ) from the catalogue.</pre>`, "Suction 0.5–1.2 m/s (no cavitation), return 2–4 m/s, pressure 3–6 m/s. Return line for the largest outflow (cap side).");
    h += step(8, "Heat, tank and cooler", `<pre class="hc-pre">Power loss (chosen supply) P_loss = (energy in − useful work) / cycle = ${L1(R.sup.Eloss)} kJ / ${S.T} s = <b>${f(R.heat.Ploss, 3)} kW</b>
Tank volume ≈ ${S.tankF} × pump flow per minute = ${S.tankF} · ${L1(R.pump.Q)} = ${L1(S.tankF * R.pump.Q)} L, min. 1.3 × moving oil + 8 L → ${L1(R.tank.Vreq)} L → <b>${R.tank.V} L</b>
Tank surface A ≈ 0.065 · V^(2/3) = 0.065 · ${R.tank.V}^(2/3) = ${L2(R.tank.A)} m²
Tank cooling P = k · A · ΔT = ${S.k} · ${L2(R.tank.A)} · ${R.tank.dT} = <b>${L2(R.tank.Pcool)} kW</b>   (ΔT = ${S.Toil} − ${S.Tamb} °C)
Cooler = P_loss − tank cooling = ${f(R.cooler, 3)} kW → ${R.coolerKW > 0 ? `<b>oil cooler ${R.coolerKW} kW</b> (× 1.25 margin)` : "<b>no cooler needed</b>"}</pre>`, "Oil temperature 40–55 °C. Heat sources: relief valve, throttles, pump losses (1 − η). Fixed pump against a closed centre = all pump power becomes heat.");
    h += step(9, "Oil, filter, cleanliness", `<pre class="hc-pre">Most sensitive component: ${Z.loads.some((l) => l.prop) ? "proportional valve" : "standard solenoid valves + " + R.sup.pump.list + " pump"} → target ISO 4406 <b>${R.filter.iso}</b>
${R.filter.pf}
${R.filter.rf}, size for 2 × return flow (${L1(R.filter.Q)} L/min) → ≈ ${R.filter.size} L/min class, clean Δp ≤ 0.05 MPa, clogging indicator
Tank breather 3 µm with desiccant; oil HLP 46 (DIN 51524-2), working viscosity 16–36 mm²/s; filling only through a filter unit</pre>`, "Cleanliness: servo / proportional 16/14/11, standard valves 18/16/13, gear pump 19/17/14. β_x(c) ≥ 200 / 1000 (ISO 16889).");
    $("hzSteps").innerHTML = h;
    // ---- summary circuit, questions, BOM
    $("hzSvg").innerHTML = summarySvg(R);
    $("hzQ").innerHTML = [`Load list + duty cycle (this page) – please confirm pump ${R.sup.pump.V} cm³/rev and motor ${R.motorKW} kW.`, `Pressure: p_sys ${S.p} MPa, relief ${R.relief} MPa – ratings of all components ≥ ${S.p} MPa (rod side ${f(Math.max(...R.acts.filter((a) => a.kind === "cyl").map((a) => a.pInt), 0), 1)} MPa).`, "Δp–Q curves of the offered valves at our flows; centre types as listed.", R.pick === "acc" ? `Accumulator ${R.acc.Vacc} L, pre-charge ${f(R.acc.p0g, 2)} MPa, safety block, PED documents.` : "Variable pump: compensator response time, case drain.", `Heat: our loss estimate ${f(R.heat.Ploss, 2)} kW, ambient ${S.Tamb} °C – cooler needed?`, `Cleanliness class ${R.filter.iso}, flushing report and oil sample at FAT.`, "Standards: EN ISO 4413, ISO 1219-1/-2 circuit diagram, CE / Machinery Regulation, 24 V DC solenoids with LED plugs.", "Spare parts list, seal kits, delivery time, noise level dB(A) at 1 m."].map((x) => `<li>${esc(x)}</li>`).join("");
    $("hzBom").innerHTML = tbl(["Tag", "Element", "Data (example)", "Standard / note", "Qty"], bom(R).map((r) => r.map((c, i) => (i === 0 ? `<b>${esc(c)}</b>` : esc(c)))));
  }
  function summarySvg(R) {
    const n = R.acts.length, w = 760, xs = (i) => 330 + (i + 0.5) * (400 / n);
    let s = "";
    // HPU box
    s += `<rect x="20" y="210" width="250" height="190" class="hs-encl"/><text x="28" y="226" class="hs-tag">HPU · tank ${R.tank.V} L · ${R.motorKW} kW</text>`;
    s += hsTank(70, 380) + `<path d="M70,360 V380" class="hs-s"/>` + hsPump(70, 345, { tag: `${R.sup.pump.V} cm³`, variable: R.pick === "var" }) + `<path d="M70,330 V280" class="hs-s"/>`;
    s += `<path d="M70,280 H140 V302" class="hs-s"/>` + hsRelief(140, 318, { tag: "0V1", set: `${R.relief} MPa` }) + `<path d="M140,334 V350" class="hs-s"/>` + hsTank(140, 350);
    s += hsFilter(230, 320, { tag: "10 µm" }) + `<path d="M230,306 V180 M230,334 V350" class="hs-s"/>` + hsTank(230, 350);
    if (R.pick === "acc") s += `<path d="M190,280 V268" class="hs-s"/>` + hsAcc(190, 240, { tag: `${R.acc.Vacc} L` });
    s += `<path d="M70,280 V170 H${w - 20}" class="hs-s"/><path d="M230,180 H${w - 20}" class="hs-pil"/><text x="290" y="164" class="hs-tag">P ${R.relief} MPa · ${f(R.Qsup, 1)} L/min · ${R.lines[0].tube[0]}×${R.lines[0].tube[1]}</text><text x="290" y="194" class="hs-tag">T · ${R.lines[1].tube[0]}×${R.lines[1].tube[1]}</text>`;
    R.acts.forEach((a, i) => {
      const x = xs(i), ld = a.ld;
      s += `<path d="M${x - 9},170 V${305 - 0} M${x + 9},180 V305" class="hs-s"/>`.replace(`M${x - 9},170 V305`, `M${x - 9},170 V305`);
      s += `<path d="M${x - 9},170 V323 M${x + 9},180 V323" class="hs-s"/>` + hsDcv(x, 300, { s: 0, centre: ld.vert ? "float" : R.pick === "fixed" ? "tandem" : "closed", tag: `${i + 1}V1 ${R.valves[i].ng.split(" ")[0]}` }).replace(/data-hcact="[^"]*"/g, "");
      let y = 277;
      if (ld.pred > 0) { s += hsPRV(x - 9, 250, { tag: `${ld.pred} MPa` }); y = 232; }
      if (a.kind === "cyl" && ld.vert) { s += hsCBV(x - 9, ld.pred > 0 ? 190 : 235, { set: `${f(1.3 * a.pL, 1)} MPa` }); y = (ld.pred > 0 ? 190 : 235) - 28; }
      s += `<path d="M${x - 9},277 V${y} M${x + 9},277 V60" class="hs-s"/>`;
      if (a.kind === "cyl") { const cy = hsCyl(x - 20, 30, { vert: true, len: 70, frac: 0.3, pA: 0, pB: 0, tag: "" }); s += cy.svg.replace(/class="hs-ch"[^/]*\//g, 'class="hs-ch" style="fill:none"/'); s += `<path d="M${x - 9},${y} V110 H${x + 26} M${x + 9},60 H${x + 26}" class="hs-s"/>`; s += `<text x="${x}" y="22" class="hs-tag" text-anchor="middle">${a.tag} Ø${a.D}/${a.d}×${ld.s}</text>`; }
      else { s += hsMotor(x, 80, { tag: "" }) + `<path d="M${x - 9},${y} V96 H${x} M${x + 9},60 V64 H${x}" class="hs-s"/>` + `<text x="${x}" y="40" class="hs-tag" text-anchor="middle">${a.tag} ${a.V} cm³/rev</text>`; }
    });
    return s;
  }
  /* ---- events */
  box.addEventListener("click", (e) => {
    const p = e.target.closest("[data-hzpre]"); if (p) { load(p.dataset.hzpre); renderSys(); renderLoads(); compute(); return; }
    const d = e.target.closest("[data-hzdo]");
    if (d) { const t = Z.loads[0] ? Z.loads[Z.loads.length - 1] : null; const base = { name: d.dataset.hzdo === "addm" ? "Motor" : "Cylinder", type: d.dataset.hzdo === "addm" ? "mot" : "cyl", F: 10, s: 100, t0: t ? Math.min(Z.sys.T - 5, (t.t0 || 0) + 3) : 1, tExt: 1, tDw: 2, tRet: 1, Fret: 1, mount: "pinpin", vert: false, mh: 0, pred: 0, prop: false, T: 100, nm: 50, tRun: 5 }; Z.loads.push(base); renderLoads(); compute(); return; }
    const x = e.target.closest("[data-hzdel]"); if (x) { if (Z.loads.length > 1) Z.loads.splice(+x.dataset.hzdel, 1); renderLoads(); compute(); }
  });
  box.addEventListener("change", (e) => {
    const s = e.target.closest("[data-hzs]");
    if (s) { const k = s.dataset.hzs; Z.sys[k] = s.type === "checkbox" ? s.checked : k === "supply" ? s.value : +s.value; compute(); return; }
    const l = e.target.closest("[data-hzl]");
    if (l) { const [i, k] = l.dataset.hzl.split(":"); const ld = Z.loads[+i]; ld[k] = l.type === "checkbox" ? l.checked : ["name", "type", "mount"].includes(k) ? l.value : +l.value; if (k === "type") renderLoads(); compute(); }
  });
  hoverable(box, (ci, x) => { if (!Z.drawCh) return; Z.hover = ci === null ? {} : { [ci]: x }; Z.drawCh(); });
  renderSys(); renderLoads(); compute();
  if (Q.get("hcstep")) setTimeout(() => { const el = $("hzStep" + Q.get("hcstep")); if (el) el.scrollIntoView(); }, 400);
  return { Z, selfTest: () => { sizeTest().forEach(log); log(`sizing errors=${errs.length ? errs.join(" | ") : "none"}`); } };
}

/* ======================================================================= lazy build on the item switch (hyd.js) */
const box2 = $("hyItem2"), box3 = $("hyItem3");
let UI2 = null, UI3 = null, tried2 = false, tried3 = false;
function onShow(n) {
  n = String(n);
  if (n === "2" && box2) {
    if (!tried2) { tried2 = true; try { UI2 = buildCircuits(box2); } catch (e) { console.error(e); box2.innerHTML = `<div class="card"><p class="hc-bad">Item 2 could not start: ${esc(e.message)}</p></div>`; } }
    if (UI2) UI2.show();
  }
  if (n === "3" && box3 && !tried3) { tried3 = true; try { UI3 = buildSizing(box3); } catch (e) { console.error(e); box3.innerHTML = `<div class="card"><p class="hc-bad">Item 3 could not start: ${esc(e.message)}</p></div>`; } }
  if (Q.has("hctest") && !onShow.tested && (UI2 || UI3)) {
    onShow.tested = true;
    setTimeout(() => { if (UI3 || Q.get("hyitem") === "3") { if (!UI3 && box3) { tried3 = true; UI3 = buildSizing(box3); } UI3.selfTest(); } if (UI2) UI2.selfTest(); log("DONE"); }, 300);
  }
}
window.addEventListener("hyitemshow", (e) => onShow(e.detail));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "hyd" && window.hyCtl) onShow(window.hyCtl.current()); };
if (window.hyCtl && ["2", "3"].includes(window.hyCtl.current())) onShow(window.hyCtl.current());
// item switching test (&hcback): 2 → 1 → 3 → 2, report errors
if (Q.has("hcback")) setTimeout(() => {
  const H = window.hyCtl; if (!H) return;
  const rep = (s) => console.log("HCBACK " + s + ` errors=${errs.length ? errs.join(" | ") : "none"}`);
  H.showItem("2"); setTimeout(() => { rep(`item2 built=${!!UI2} svg=${!!document.querySelector("#hcSvg g")}`); H.showItem("1");
    setTimeout(() => { rep(`item1 visible=${!$("hyItem1").hidden} item2 hidden=${box2.hidden}`); H.showItem("3");
      setTimeout(() => { rep(`item3 built=${!!UI3} steps=${document.querySelectorAll(".hc-step").length}`); H.showItem("2");
        setTimeout(() => rep(`item2 again t=${UI2 ? UI2.U.n.t.toFixed(2) : "-"}`), 800); }, 800); }, 800); }, 800);
}, 1500);
window.hcCkt = { ui2: () => UI2, ui3: () => UI3 };
void hsCyl; void hsLine; void hsFCV;
