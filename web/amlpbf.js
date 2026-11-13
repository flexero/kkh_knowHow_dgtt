/* Additive manufacturing tab – item 2: LPBF metal PROCESS TWIN (page / UI).
 * Model: amlpbf_model.js (pure). 3D: am3d.js (lazy, "Show 3D view").
 * Deep links: /?amitem=2&ampart=bracket|insert|head|impeller&ammach=m250|m400|m600&amor=up|flat|tilt
 *             &amop=40 (op no.) &amu=0.5 &amf=lowP,streak (faults) &show3d &amtest (self test in the console) #am
 * All values are EXAMPLES. */
import { MACH, MAT, PART, ORIENT, OPS, FAULTS, DEF, calc, simulate, series, lot, selfTest, clamp } from "./amlpbf_model.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f0 = (x) => Math.round(x).toLocaleString("en-US"), f1 = (x) => (+x).toFixed(1), f2 = (x) => (+x).toFixed(2);
const money = (x) => "$" + f0(x);
const Q = new URLSearchParams(location.search);
const KEY = "amLpbf";

let cfg = Object.assign({}, DEF), F = {}, seed = 1, op = 3, u = 0, playing = false, built = false;
let R = null, S = null, SER = null, view3d = null, lastT = 0;
try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { /* storage blocked */ }
if (Q.get("ampart") && PART[Q.get("ampart")]) { cfg.part = Q.get("ampart"); cfg.mat = PART[cfg.part].mat; cfg.n = 0; }
if (Q.get("ammach") && MACH[Q.get("ammach")]) { cfg.mach = Q.get("ammach"); cfg.n = 0; }
if (Q.get("amor") && ORIENT[Q.get("amor")]) cfg.orient = Q.get("amor");
if (Q.get("amf")) Q.get("amf").split(",").forEach((k) => { if (FAULTS.some((x) => x[0] === k)) F[k] = true; });
if (Q.get("amop")) { const i = OPS.findIndex((o) => o.no === +Q.get("amop")); if (i >= 0) op = i; }
if (Q.get("amu")) u = clamp(+Q.get("amu"), 0, 1);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* storage blocked */ } };

/* ------------------------------------------------------------------ recompute */
function recompute() {
  R = calc(cfg); S = simulate(cfg, F, seed); SER = series(cfg, F, seed);
}

/* ------------------------------------------------------------------ skeleton */
function build() {
  const host = $("amItem2"); if (!host || built) return; built = true;
  host.innerHTML = `
  <div class="card"><div class="card-head"><h2>Build job – part, material, machine, parameters</h2>
    <span class="sub">change any input – every number, the twin and the record update · <button class="btn ghost am-sm" id="amReset">Example values</button></span></div>
    <div class="am-form am-form4" id="amIn"></div><div class="am-warn" id="amWarn"></div></div>
  <div class="kpis" id="amKpi"></div>
  <div class="card"><div class="card-head"><h2>Process twin – from powder to the released part</h2><span class="sub">click an operation · faults change the simulated measured values</span></div>
    <div class="mx-nav" id="amOps"></div>
    <div class="am-play"><button class="btn primary" id="amPlay">▶ Play all</button><button class="btn" id="amPrev">◀</button><button class="btn" id="amNext">▶|</button>
      <input type="range" id="amU" min="0" max="1000" value="0"><button class="btn" id="amNew">New build (random)</button><button class="btn" id="amDl">Download build record</button></div>
    <div class="am-step" id="amStep"></div>
    <div class="grid2"><div><div id="amScene"></div>
      <div class="am-3dbar"><button class="btn" id="am3dBtn">Show 3D view</button><span class="sub">3D build chamber follows the operation + progress · drag = turn, wheel = zoom, right drag = move</span>
      <label class="am-chk"><input type="checkbox" id="amLbl" checked> labels</label></div>
      <div id="am3d" class="am-3d" hidden></div></div>
      <div id="amCard"></div></div>
    <div class="am-faults"><span class="sub">Inject a process fault (see where it starts and which check finds it):</span><div id="amF"></div></div></div>
  <div class="grid2 eq">
    <div class="card"><div class="card-head"><h2>Build record – every check</h2><span class="sub" id="amRecSub"></span></div><div id="amRec" class="am-wrap"></div></div>
    <div class="card"><div class="card-head"><h2>Lot simulation</h2><button class="btn" id="amLot">Run 30 builds</button></div><div id="amLotOut" class="am-wrap"><p class="sub">Same process + the switched-on faults, random variation of every value. Cpk ≥ 1.33 = capable process.</p></div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Calculations – formulas with your numbers</h2><span class="sub">build plan, time, powder, gas, energy, cost</span></div><div class="am-calc" id="amCalc"></div></div>
  <div class="card"><div class="card-head"><h2>Equipment list – what a real LPBF production cell needs</h2><span class="sub">BUY = purchase specification (classes, examples) · ask 2–3 suppliers per line</span></div><div id="amEq" class="am-wrap"></div></div>
  <div class="card"><div class="card-head"><h2>Safety, people, standards</h2><span class="sub">metal powder + class-4 laser + inert gas = plan it from day 1</span></div><div id="amSafe"></div></div>`;
  inputs(); bind(); recompute(); renderAll(); staticParts();
  if (Q.has("show3d")) setTimeout(() => $("am3dBtn").click(), 300);
  if (Q.has("amtest")) selfTest().forEach((l) => console.log("[amtest] " + l));
  requestAnimationFrame(frame);
}

function inputs() {
  const opt = (o, v) => Object.values(o).map((x) => `<option value="${x.key}" ${x.key === v ? "selected" : ""}>${esc(x.name)}</option>`).join("");
  const A = MAT[cfg.mat];
  const num = (k, l, unit, step, ph, note) => `<label>${l}<span class="am-in"><input type="number" data-k="${k}" step="${step}" value="${cfg[k] || ""}" placeholder="${ph}"><i>${unit}</i></span>${note ? `<small>${note}</small>` : ""}</label>`;
  $("amIn").innerHTML = `
    <label>Part<select data-k="part">${opt(PART, cfg.part)}</select><small>${esc(PART[cfg.part].why)}</small></label>
    <label>Material<select data-k="mat">${opt(MAT, cfg.mat)}</select><small>${esc(A.alloy)} · ${esc(A.danger)}</small></label>
    <label>Machine class<select data-k="mach">${opt(MACH, cfg.mach)}</select><small>${esc(MACH[cfg.mach].cls)}</small></label>
    <label>Orientation<select data-k="orient">${Object.entries(ORIENT).map(([k, o]) => `<option value="${k}" ${k === cfg.orient ? "selected" : ""}>${esc(o.name)}</option>`).join("")}</select><small>affects height (= time), supports, surface</small></label>
    ${num("n", "Parts per build", "pcs", 1, "max", "empty = as many as fit on the plate")}
    ${num("P", "Laser power P", "W", 5, A.P, "parameter set of the material")}
    ${num("v", "Scan speed v", "mm/s", 10, A.v, "")}
    ${num("h", "Hatch distance h", "mm", 0.01, A.h, "distance between scan lines")}
    ${num("t", "Layer thickness t", "mm", 0.01, A.t, "20–60 µm typical")}
    ${num("reuse", "Powder reuse cycles", "×", 1, 5, "how often this powder was printed")}
    <label>HIP<select data-k="hip"><option value="auto" ${cfg.hip === "auto" ? "selected" : ""}>auto (material rule)</option><option value="on" ${cfg.hip === "on" ? "selected" : ""}>yes</option><option value="off" ${cfg.hip === "off" ? "selected" : ""}>no</option></select><small>hot isostatic pressing closes inner pores</small></label>
    ${num("labour", "Labour rate", "$/h", 1, 45, "example")}`;
}
function bind() {
  $("amIn").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = e.target.tagName === "SELECT" ? e.target.value : (e.target.value === "" ? 0 : +e.target.value);
    cfg[k] = v;
    if (k === "part") { cfg.mat = PART[v].mat; cfg.n = 0; cfg.P = cfg.v = cfg.h = cfg.t = 0; }
    if (k === "mat") { cfg.P = cfg.v = cfg.h = cfg.t = 0; }
    if (k === "mach" || k === "orient") cfg.n = 0;
    save(); if (["part", "mat", "mach"].includes(k)) inputs(); recompute(); renderAll(); staticParts();
  });
  $("amReset").addEventListener("click", () => { cfg = Object.assign({}, DEF); F = {}; save(); inputs(); recompute(); renderAll(); staticParts(); });
  $("amOps").addEventListener("click", (e) => { const b = e.target.closest("[data-op]"); if (b) { op = +b.dataset.op; u = 0; playing = false; renderAll(); } });
  $("amPlay").addEventListener("click", () => { playing = !playing; if (playing && op === OPS.length - 1 && u >= 1) { op = 0; u = 0; } renderPlay(); });
  $("amPrev").addEventListener("click", () => { op = Math.max(0, op - 1); u = 0; renderAll(); });
  $("amNext").addEventListener("click", () => { op = Math.min(OPS.length - 1, op + 1); u = 0; renderAll(); });
  $("amU").addEventListener("input", (e) => { u = +e.target.value / 1000; playing = false; renderDyn(); });
  $("amNew").addEventListener("click", () => { seed = 1 + Math.floor(Math.random() * 99999); recompute(); renderAll(); });
  $("amDl").addEventListener("click", download);
  $("amLot").addEventListener("click", runLot);
  $("amF").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; F[b.dataset.f] = !F[b.dataset.f]; recompute(); renderAll(); });
  $("am3dBtn").addEventListener("click", async () => {
    const el = $("am3d"); el.hidden = !el.hidden; $("am3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view";
    if (!el.hidden && !view3d) { try { const m = await import("./am3d.js"); view3d = m.create(el, state3d); } catch (err) { el.innerHTML = `<p class="am-warn">3D view could not load: ${esc(err.message)}</p>`; } }
  });
}

/* ------------------------------------------------------------------ render */
function renderAll() { renderKpi(); renderOps(); renderFaults(); renderRec(); renderCalc(); renderDyn(); }
function renderKpi() {
  $("amWarn").innerHTML = R.warn.map((w) => `<div>⚠ ${esc(w)}</div>`).join("");
  const t = [
    ["Energy density E", `${f1(R.E)} J/mm³`, `window ${R.A.win[0]}–${R.A.win[1]} · ${R.winOk ? "inside ✓" : "OUTSIDE ✗"}`],
    ["Parts per build", `${R.n} / ${R.nMax}`, `${R.box.map(f0).join(" × ")} mm each`],
    ["Machine time", `${f1(R.tMach)} h`, `${f0(R.layers)} layers · print ${f1(R.tPrint)} h`],
    ["Cost per part", money(R.costPart), `build ${money(R.costBuild)} · ${R.conv.name.split(" (")[0]}: ${money(R.convAt(cfg.qty || 50))} @ ${cfg.qty || 50} pcs`],
    ["Lead time", `${f1(R.leadDays)} days`, `incl. post-processing${R.hipOn ? " + HIP" : ""}`],
    ["Build status", S.ok ? "released" : `${S.fails.length} check(s) failed`, S.ok ? "all checks passed" : esc(S.fails[0][1])],
  ];
  $("amKpi").innerHTML = t.map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value${String(v).length > 11 ? " text" : ""}">${v}</div><div class="note">${n}</div></div>`).join("");
}
function renderOps() {
  $("amOps").innerHTML = OPS.map((o, i) => { const bad = S.chk.some((c) => c[0] === o.k && !c[4]);
    return `<button class="mx-el ${i === op ? "active" : ""} ${bad ? "am-bad" : ""}" data-op="${i}">${o.no} ${esc(o.n.split(" – ")[0].split(" (")[0])}</button>`; }).join("");
}
function renderFaults() {
  $("amF").innerHTML = FAULTS.map(([k, n, eff, start, find]) => `<button class="chip ${F[k] ? "am-on" : ""}" data-f="${k}" title="${esc(eff)} · starts: ${esc(start)} · found: ${esc(find)}">${esc(n)}</button>`).join("");
}
function renderPlay() { $("amPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }

function renderDyn() {
  const o = OPS[op];
  $("amU").value = Math.round(u * 1000); renderPlay();
  $("amStep").innerHTML = `<span class="am-no">Op ${o.no}</span><b>${esc(o.n)}</b><span class="sub"> · ${esc(o.where)}</span>`;
  $("amScene").innerHTML = scene(o);
  $("amCard").innerHTML = card(o);
}

/* settings / numbers for each op */
function opInfo(o) {
  const A = R.A, M = R.M;
  switch (o.k) {
    case "powder": return [["Powder", `${A.name}, ${A.alloy}`], ["Powder to load", `${f1(R.mLoad)} kg (bed + 30 % dosing margin)`], ["Powder used by the build", `${f2(R.mUsed)} kg → ${money(R.cost.powder)}`], ["Reuse", `${cfg.reuse}× – mix with virgin powder, track the lot`], ["Price", `$${A.price}/kg (example)`]];
    case "prep": return [["Orientation", R.O.name], ["Parts per build", `${R.n} (max ${R.nMax})`], ["Build height", `${f0(R.H)} mm = ${f0(R.layers)} layers × ${R.t * 1000} µm`], ["Supports", `${f1(R.supV)} cm³ per part (${f0(R.supV / R.PT.vol * 100)} %)`], ["Scan strategy", "contour + stripes 67° rotation per layer, up/down-skin parameters"]];
    case "setup": return [["Plate preheat", `${A.pre} °C`], ["Inerting", `argon, ${f1(M.chamberL * 5 / 1000)} m³ purge, ${f1(M.inert)} h`], ["O2 limit", `≤ ${A.o2} ppm (machine pauses above)`], ["Recoater", "new / checked blade, level ±0.02 mm"]];
    case "print": { const p = SER.pts[Math.min(SER.pts.length - 1, Math.floor(u * SER.pts.length))];
      return [["Layer", `${f0(p.L)} / ${f0(R.layers)}`], ["Height", `${f1(p.z)} / ${f0(R.H)} mm`], ["Elapsed", `${f1(u * R.tPrint)} / ${f1(R.tPrint)} h`], ["Layer time", `${f1(p.tLay)} s (exposure ${f1(p.tExp)} s + recoat ${M.recoat} s)`],
        ["Melt-pool index", f2(p.mp) + (p.mp < 0.85 || p.mp > 1.2 ? " ✗" : " ✓")], ["O2", `${f0(p.o2)} ppm` + (p.o2 > A.o2 ? " ✗ PAUSE" : " ✓")], ["Lasers", `${M.lasers} × ${R.P} W, v ${R.v} mm/s`]]; }
    case "depowder": return [["Cool-down", `${f1(M.cool)} h in the machine`], ["Powder recovered", `${f1(R.mLoad - R.mUsed)} kg → sieve 63 µm → reuse ${cfg.reuse + 1}×`], ["Channels", R.PT.key === "insert" ? "rotate + vibrate 20 min, weigh the part" : "blow out, rotate"]];
    case "sr": return [["Cycle", A.srTxt], ["Why", "the laser leaves high residual stress – cut without stress relief = parts spring"]];
    case "edm": return [["Method", R.PT.vol > 300 ? "wire EDM (accurate)" : "band saw or wire EDM"], ["Cut", `in the support zone, ${R.supH} mm above the plate`], ["Plate", "regrind 0.3–0.5 mm, reuse 10–20 builds"]];
    case "support": return [["Supports", `${f0(R.mSup * 1000)} g per part to remove`], ["Blasting", "glass beads → Ra up-skin ≈ " + f1(S.raBlast) + " µm"]];
    case "ht": return [["Cycle", A.htTxt], ["HIP", R.hipOn ? "yes – closes inner pores (service, ≈ 3 days)" : "no"], ["Hardness", A.hard]];
    case "finish": return [["Faces", R.PT.feat], ["Set-up", "3-2-1 on printed reference pads, probe best-fit"], ["Stock", "0.3–0.5 mm on functional faces (planned in CAD)"]];
    case "inspect": return [["Density", `${f2(S.dens)} %`], ["Largest pore", `${f0(S.maxPore)} µm`], ["Deviation", `${f2(S.dev)} mm`], ["UTS / A%", `${f0(S.uts)} MPa / ${f1(S.el)} %`]];
    case "release": return [["Serial", `AM-${String(seed).padStart(5, "0")}-01 … ${String(R.n).padStart(2, "0")}`], ["Record", "machine, job, parameter set, powder lot + reuse, O2 log, monitoring, CT, coupons"], ["Status", S.ok ? "RELEASED" : "BLOCKED – NCR"]];
  }
  return [];
}
function card(o) {
  const chk = S.chk.filter((c) => c[0] === o.k);
  const show = u >= 0.999 || op < OPS.length && OPS.indexOf(o) < op;
  return `<div class="am-card"><h3 class="am-h">Op ${o.no} · ${esc(o.n)}</h3>
    <table class="am-kv"><tbody>${opInfo(o).map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table>
    <h4>Equipment (BUY)</h4><ul class="am-ul">${o.eq.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    <h4>Checks in this operation</h4><div class="sub">${esc(o.chk)}</div>
    ${chk.length ? `<table class="am-tab am-chk2"><tbody>${chk.map((c) => `<tr><td>${esc(c[1])}</td><td>${show ? esc(c[2]) : "…"}</td><td>${esc(c[3])}</td><td>${show ? (c[4] ? '<span class="am-ok">✓</span>' : '<span class="am-ng">✗</span>') : ""}</td></tr>`).join("")}</tbody></table>${show ? "" : '<div class="sub">… measured at the end of the operation</div>'}` : ""}</div>`;
}

/* 2D scene: print = powder-bed top view + monitoring charts; others = op picture */
function scene(o) {
  if (o.k === "print") return printScene();
  if (o.k === "sr" || o.k === "ht") return tempScene(o);
  const icons = { powder: "Powder: sieve → analyse → dry → closed container", prep: "CAD → orient → supports → nest → slice → build file", setup: "plate in · blade · filter · argon purge · preheat",
    depowder: "unpacking station: vibrate + rotate, powder back to the sieve", edm: "wire cuts through the supports", support: "break off supports, grind, blast",
    finish: "machine the functional faces on the HMC / 5-axis", inspect: "CT scan · CMM · roughness · coupons", release: "record complete → laser mark → certificate" };
  const [W, D] = R.M.plate, s = 300 / Math.max(W, D);
  const parts = R.place.map((p) => `<rect x="${170 + p.x * s - p.w * s / 2}" y="${160 + p.y * s - p.d * s / 2}" width="${p.w * s}" height="${p.d * s}" rx="3" class="am-pt"/>`).join("");
  const plate = o.k === "powder" || o.k === "prep" && u < 0.5 ? "" : `<rect x="${170 - W * s / 2}" y="${160 - D * s / 2}" width="${W * s}" height="${D * s}" class="am-plate"/>`;
  const showParts = !["powder", "setup"].includes(o.k) && !(o.k === "prep" && u < 0.4);
  return `<svg viewBox="0 0 640 330" class="am-svg"><text x="20" y="22" class="am-t">${esc(icons[o.k] || o.n)}</text>
    ${plate}${showParts ? parts : ""}
    <text x="170" y="${160 + D * s / 2 + 22}" text-anchor="middle" class="am-s">plate ${W} × ${D} mm · ${R.n} part(s)</text>
    ${o.k === "inspect" ? `<g transform="translate(470 160)"><circle r="70" class="am-ring"/><circle r="${8 + 50 * u}" class="am-scan"/><text y="96" text-anchor="middle" class="am-s">CT: ${u > 0.6 ? f2(S.dens) + " % dense, max pore " + f0(S.maxPore) + " µm" : "scanning …"}</text></g>` : ""}
    ${o.k === "powder" ? `<g transform="translate(470 150)">${psd()}</g>` : ""}
    <rect x="20" y="300" width="600" height="8" rx="4" class="am-pbg"/><rect x="20" y="300" width="${600 * u}" height="8" rx="4" class="am-pfg"/></svg>`;
}
function psd() { // particle size distribution curve (log-normal, D50 ≈ 35 µm)
  const pts = []; for (let i = 0; i <= 60; i++) { const d = 5 + i * 1.5, y = Math.exp(-((Math.log(d / 35)) ** 2) / (2 * 0.3 ** 2)); pts.push(`${-120 + i * 4},${60 - y * 110}`); }
  return `<polyline points="${pts.join(" ")}" class="am-line"/><line x1="-120" y1="60" x2="120" y2="60" class="am-ax"/><text x="0" y="80" text-anchor="middle" class="am-s">particle size 5 … 95 µm (D50 ≈ 35 µm)</text><text x="-120" y="-60" class="am-s">PSD check</text>`;
}
function tempScene(o) {
  const A = R.A, txt = o.k === "sr" ? A.srTxt : A.htTxt, m = /(\d[\d ]*)\s*°C/.exec(txt), T = m ? +m[1].replace(/\s/g, "") : 0;
  if (!T) return `<svg viewBox="0 0 640 330" class="am-svg"><text x="20" y="30" class="am-t">${esc(txt)}</text><text x="20" y="60" class="am-s">no furnace step for this material in this operation</text></svg>`;
  const x0 = 60, x1 = 600, y0 = 280, y1 = 60, tx = (f) => x0 + f * (x1 - x0), ty = (t) => y0 - (t / 1200) * (y0 - y1);
  const curve = [[0, 20], [0.25, T], [0.7, T], [1, 40]].map(([f, t]) => `${tx(f)},${ty(t)}`).join(" ");
  const cur = u < 0.25 ? 20 + (T - 20) * u / 0.25 : u < 0.7 ? T : T - (T - 40) * (u - 0.7) / 0.3;
  return `<svg viewBox="0 0 640 330" class="am-svg"><text x="20" y="24" class="am-t">${esc(txt)}</text>
    <line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" class="am-ax"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1 - 10}" class="am-ax"/>
    ${[0, 400, 800, 1200].map((t) => `<text x="${x0 - 6}" y="${ty(t) + 4}" text-anchor="end" class="am-s">${t}</text>`).join("")}<text x="${x0}" y="${y1 - 16}" class="am-s">°C</text>
    <polyline points="${curve}" class="am-line am-hot"/><circle cx="${tx(u)}" cy="${ty(cur)}" r="6" class="am-dot"/>
    <text x="${tx(u) + 10}" y="${ty(cur) - 10}" class="am-s">${f0(cur)} °C</text><text x="${x1}" y="${y0 + 22}" text-anchor="end" class="am-s">heat up → hold → cool (recorded by thermocouples)</text></svg>`;
}
function printScene() {
  const pts = SER.pts, N = pts.length, i = Math.min(N - 1, Math.floor(u * N)), p = pts[i], A = R.A;
  const [W, D] = R.M.plate, s = 230 / Math.max(W, D), cx = 140, cy = 150;
  const inSup = p.z < R.supH;
  const ph = (performance.now() / 1000) % 2 / 2;
  const recX = ph < 0.35 ? cx - W * s / 2 + (ph / 0.35) * W * s : null;
  const parts = R.place.map((q, k) => { const x = cx + q.x * s - q.w * s / 2, y = cy + q.y * s - q.d * s / 2, w = q.w * s, d = q.d * s;
    const sh = R.PT.shape, frac = clamp((p.z - R.supH) / q.h, 0, 1);
    const inner = sh === "impeller" ? `<circle cx="${x + w / 2}" cy="${y + d / 2}" r="${Math.min(w, d) / 2 * (frac < 0.2 ? 1 : 0.9)}" class="am-melt"/>`
      : sh === "insert" ? `<rect x="${x}" y="${y}" width="${w}" height="${d}" class="am-melt"/>${[0.3, 0.5, 0.7].map((f) => `<circle cx="${x + w * f}" cy="${y + d / 2}" r="${2.2}" class="am-hole"/>`).join("")}`
      : sh === "bracket" ? `<path d="M${x} ${y} h${w} v${d * 0.3} h${-w * 0.65} v${d * 0.7} h${-w * 0.35} Z" class="am-melt"/>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${d}" rx="4" class="am-melt"/>`;
    const curl = p.curl && k === 0 ? `<rect x="${x - 2}" y="${y - 2}" width="${w + 4}" height="6" class="am-curl"/>` : "";
    return inSup ? `<rect x="${x}" y="${y}" width="${w}" height="${d}" class="am-sup"/>` : inner + curl; }).join("");
  const spots = ph >= 0.35 && u < 1 ? R.place.slice(0, Math.max(1, Math.min(R.M.lasers, R.place.length))).map((q, k) => { const e = (ph - 0.35) / 0.65, row = Math.floor(e * 8), fx = row % 2 ? 1 - (e * 8 % 1) : e * 8 % 1;
    return `<circle cx="${cx + q.x * s - q.w * s / 2 + fx * q.w * s}" cy="${cy + q.y * s - q.d * s / 2 + (row + 0.5) / 8 * q.d * s}" r="4" class="am-spot"/>`; }).join("") : "";
  const streak = p.streak ? `<line x1="${cx - W * s / 2 + W * s * 0.35}" y1="${cy - D * s / 2}" x2="${cx - W * s / 2 + W * s * 0.35}" y2="${cy + D * s / 2}" class="am-streak"/>` : "";
  // charts
  const cX = 300, cW = 320, ch = (k, y0, h, lo, hi, band, lbl, unit) => {
    const vals = pts.slice(0, i + 1).map((q) => q[k]); const sx = (j) => cX + j / (N - 1) * cW, sy = (v) => y0 + h - (clamp(v, lo, hi) - lo) / (hi - lo) * h;
    return `<text x="${cX}" y="${y0 - 6}" class="am-s">${lbl}</text><rect x="${cX}" y="${sy(band[1])}" width="${cW}" height="${sy(band[0]) - sy(band[1])}" class="am-band"/>
      <line x1="${cX}" y1="${y0 + h}" x2="${cX + cW}" y2="${y0 + h}" class="am-ax"/><polyline points="${vals.map((v, j) => `${sx(j)},${sy(v)}`).join(" ")}" class="am-line"/>
      <text x="${cX + cW}" y="${y0 - 6}" text-anchor="end" class="am-s">${k === "o2" ? f0(p[k]) : f2(p[k])} ${unit}</text>`; };
  const flagged = pts.slice(0, i + 1).filter((q) => q.streak || q.curl).length;
  return `<svg viewBox="0 0 640 330" class="am-svg">
    <text x="20" y="20" class="am-t">Powder bed (camera view) – layer ${f0(p.L)} / ${f0(R.layers)} · z = ${f1(p.z)} mm${inSup ? " · supports" : ""}</text>
    <rect x="${cx - W * s / 2}" y="${cy - D * s / 2}" width="${W * s}" height="${D * s}" class="am-bed"/>${parts}${streak}${spots}
    ${recX != null ? `<line x1="${recX}" y1="${cy - D * s / 2 - 6}" x2="${recX}" y2="${cy + D * s / 2 + 6}" class="am-rec"/>` : ""}
    <text x="${cx}" y="${cy + D * s / 2 + 18}" text-anchor="middle" class="am-s">${ph < 0.35 ? "recoating …" : `${R.M.lasers} laser(s) exposing`} · gas flow →</text>
    ${ch("mp", 50, 70, 0.5, 1.6, [0.85, 1.2], "Melt-pool index (photodiode, 1 = nominal)", "")}
    ${ch("o2", 160, 70, 0, 3000, [0, A.o2], "O2 in the chamber", "ppm")}
    <text x="${cX}" y="262" class="am-s">Camera findings so far: ${flagged ? `<tspan class="am-ngt">${flagged} layer(s) flagged (${F.streak ? "streak" : ""}${F.streak && F.curl ? " + " : ""}${F.curl ? "curl" : ""})</tspan>` : "none"}</text>
    <text x="${cX}" y="280" class="am-s">Remaining print time ≈ ${f1((1 - u) * R.tPrint)} h</text>
    <rect x="20" y="300" width="600" height="8" rx="4" class="am-pbg"/><rect x="20" y="300" width="${600 * u}" height="8" rx="4" class="am-pfg"/></svg>`;
}

/* record + calc + lot + equipment + safety */
function renderRec() {
  $("amRecSub").textContent = `build seed ${seed} · ${S.ok ? "RELEASED" : "BLOCKED – " + S.fails.length + " failed"}`;
  $("amRec").innerHTML = `<table class="am-tab"><thead><tr><th>Op</th><th>Check</th><th>Value</th><th>Limit</th><th></th></tr></thead><tbody>${S.chk.map((c) => { const o = OPS.find((x) => x.k === c[0]);
    return `<tr class="${c[4] ? "" : "am-badrow"}"><td>${o.no}</td><td>${esc(c[1])}</td><td>${esc(c[2])}</td><td>${esc(c[3])}</td><td>${c[4] ? '<span class="am-ok">✓</span>' : '<span class="am-ng">✗</span>'}</td></tr>`; }).join("")}</tbody></table>
    ${Object.keys(F).filter((k) => F[k]).map((k) => { const x = FAULTS.find((f) => f[0] === k); return `<p class="am-note"><b>${esc(x[1])}</b>: ${esc(x[2])}. Starts at: ${esc(x[3])}. Found by: ${esc(x[4])}.</p>`; }).join("")}`;
}
function renderCalc() {
  const A = R.A, M = R.M, c = R.cost, q = cfg.qty || 50;
  const blk = (h, lines, note) => `<div class="am-cb"><h4>${h}</h4><pre>${lines.join("\n")}</pre>${note ? `<p class="am-note">${note}</p>` : ""}</div>`;
  $("amCalc").innerHTML = [
    blk("1 · Volumetric energy density", [`E = P / (v · h · t)`, `E = ${R.P} / (${R.v} · ${R.h} · ${R.t}) = ${f1(R.E)} J/mm³`, `window for ${A.name.split(" ")[0]}: ${A.win[0]} … ${A.win[1]} J/mm³  →  ${R.winOk ? "inside ✓" : "OUTSIDE ✗"}`, `E / E_nominal = ${f2(R.r)}`],
      "Too low E → powder not fully melted (lack-of-fusion pores, irregular). Too high E → the melt pool gets deep and unstable (keyhole pores, round). E is a guide only – the qualified parameter set decides."),
    blk("2 · Nesting on the plate", [`part box (oriented) = ${R.box.map(f0).join(" × ")} mm, gap 12 mm, edge 8 mm`, `plate ${M.plate[0]} × ${M.plate[1]} → ${R.nMax} parts fit, used ${R.n}`, `build height H = part ${f0(R.box[2])} + supports ${R.supH} = ${f0(R.H)} mm  (max ${M.plate[2]})`]),
    blk("3 · Build rate and time", [`ideal rate per laser = v · h · t = ${R.v}·${R.h}·${R.t} = ${f2(R.v * R.h * R.t)} mm³/s = ${f1(R.rate1i)} cm³/h`, `real ≈ 70 % (contours, jumps, gas delays) = ${f1(R.rate1)} cm³/h`, `${M.lasers} laser(s) × ${M.lasers === 1 ? "1.0" : "0.9"} = ${f1(R.rate)} cm³/h`,
      `scanned volume = n · (V_part + 0.4·V_sup) = ${R.n} · (${R.PT.vol} + 0.4·${f1(R.supV)}) = ${f0(R.Vscan)} cm³`, `exposure = ${f0(R.Vscan)} / ${f1(R.rate)} = ${f1(R.tExp)} h`, `recoating = ${f0(R.layers)} layers · ${M.recoat} s = ${f1(R.tRec)} h`,
      `machine time = inerting ${M.inert} + preheat 0.5 + print ${f1(R.tPrint)} + cool ${M.cool} = ${f1(R.tMach)} h`], "Recoating time depends only on the HEIGHT – so lay the part to reduce height, or fill the plate (more parts share the same recoat time)."),
    blk("4 · Powder", [`part mass = ${R.PT.vol} cm³ · ${A.rho} g/cm³ = ${f2(R.mPart)} kg; supports ${f2(R.mSup)} kg`, `loaded = plate area · (H + 10) · ρ · 0.55 packing · 1.3 = ${f1(R.mLoad)} kg`, `used = build ${f2(R.mBuild)} kg · 1.03 + 3 % sieve loss of the load = ${f2(R.mUsed)} kg`, `→ ${f2(R.mUsed)} · $${A.price}/kg = ${money(c.powder)}`],
      "Most of the loaded powder is NOT used – it is sieved and reused. Track the reuse count and the oxygen content of every lot."),
    blk("5 · Gas and energy", [`argon = 5 chamber volumes (${M.chamberL} L) + ${M.gas} L/min · ${f1(R.tPrint + 0.5)} h = ${f1(R.arM3)} m³ → ${money(c.gas)}`, `energy = ${M.kW} kW · 0.6 load · ${f1(R.tMach)} h = ${f0(R.kWh)} kWh → ${money(c.energy)}`]),
    blk("6 · Cost per build and per part", [`machine rate = price / (years · h/year) + 8 % service = ${money(M.price)} / (${cfg.years}·${cfg.hours}) + … = $${f1(R.machH)}/h`,
      `machine   ${money(c.machine).padStart(9)}`, `powder    ${money(c.powder).padStart(9)}`, `gas       ${money(c.gas).padStart(9)}`, `energy    ${money(c.energy).padStart(9)}`, `labour    ${money(c.labour).padStart(9)}   (set-up per build + post-processing per part)`,
      `post      ${money(c.post).padStart(9)}   (furnace, blasting, ${R.hipOn ? "HIP, " : ""}CT share)`, `plate     ${money(c.plate).padStart(9)}   (regrinding)`, `build     ${money(R.costBuild).padStart(9)}   / ${R.n} parts = ${money(R.costPart)} per part`],
      "Machine hours are usually the biggest cost → the more parts per build and the higher the machine use (h/year), the cheaper each part."),
    blk("7 · Compare with the conventional way", [`${R.conv.name}`, `tooling / pattern ≈ ${money(R.conv.tooling)}, piece ≈ ${money(R.conv.piece)}`, `conventional at ${q} pcs = (${f0(R.conv.tooling)} + ${f0(R.conv.piece)}·${q}) / ${q} = ${money(R.convAt(q))} per part`, `AM = ${money(R.costPart)} per part (no tooling)`,
      isFinite(R.breakEven) ? `break-even: AM is cheaper below ≈ ${R.breakEven} pcs` : `AM is cheaper at every quantity (piece cost lower)`],
      "AM is chosen for what the part can DO (lighter, cooling channels, no tooling, fast) – not to replace a cheap casting. The bracket shows this: AM costs more, but the robot gets lighter and faster."),
  ].join("");
}
function runLot() {
  const L = lot(cfg, F, 30, seed * 3 + 11);
  $("amLotOut").innerHTML = `<table class="am-tab"><thead><tr><th>Characteristic</th><th>Limits</th><th>Mean</th><th>σ</th><th>Cpk</th><th>Out</th><th>30 builds</th></tr></thead><tbody>${L.rows.map((r) => {
    const lim = `${r.lo != null ? f2(r.lo) : "–"} … ${r.hi != null ? f2(r.hi) : "–"}`, cl = r.cpk >= 1.33 ? "am-ok" : r.cpk >= 1 ? "am-mid" : "am-ng";
    const mn = Math.min(...r.xs, r.lo ?? Infinity), mx = Math.max(...r.xs, r.hi ?? -Infinity), sx = (v) => 4 + (v - mn) / Math.max(1e-9, mx - mn) * 112;
    return `<tr><td>${esc(r.name)}</td><td>${lim}</td><td>${r.m.toFixed(r.m > 50 ? 1 : 2)}</td><td>${r.sd.toFixed(3)}</td><td class="${cl}">${isFinite(r.cpk) ? r.cpk.toFixed(2) : "∞"}</td><td>${r.out}</td>
      <td><svg width="120" height="14" class="am-dots">${r.lo != null ? `<line x1="${sx(r.lo)}" y1="0" x2="${sx(r.lo)}" y2="14" class="am-lim"/>` : ""}${r.hi != null ? `<line x1="${sx(r.hi)}" y1="0" x2="${sx(r.hi)}" y2="14" class="am-lim"/>` : ""}${r.xs.map((x) => `<circle cx="${sx(x)}" cy="7" r="1.6"/>`).join("")}</svg></td></tr>`; }).join("")}</tbody></table>
    <p><b>Yield: ${Math.round(L.yield * L.n)} / ${L.n} builds pass every check (${Math.round(L.yield * 100)} %)</b></p>`;
}
function staticParts() {
  $("amEq").innerHTML = `<table class="am-tab"><thead><tr><th>Op</th><th>Equipment (required capability)</th><th>Checks</th></tr></thead><tbody>${OPS.map((o) => `<tr><td><b>${o.no}</b><br>${esc(o.n)}</td><td><ul class="am-ul">${o.eq.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></td><td>${esc(o.chk)}</td></tr>`).join("")}
    <tr><td><b>Room</b></td><td colspan="2">Separate AM room: 20–24 °C ± 2, humidity &lt; 50 %, solid floor (machine 2–8 t), argon supply (bundle / tank), compressed air, 400 V supply ${R.M.kW} kW class, ATEX zoning around powder handling, powder storage room, wet separator / ATEX vacuum, fire extinguisher class D (metal fires – never water), eye shower.</td></tr></tbody></table>`;
  $("amSafe").innerHTML = `<div class="am-safe">
    <div><h4>Metal powder</h4><ul class="am-ul"><li>Fine Al and Ti powder can <b>explode</b> as a dust cloud and burns with water → ATEX zones (EN 60079-10-2), grounded antistatic equipment, inert sieving, class D extinguisher, NFPA 484 as reference.</li><li>Breathing: FFP3 / powered respirator, gloves, antistatic clothes; Ni / Co powders are sensitising.</li><li>Filter cartridges of the machine are reactive: passivate (wet) before disposal.</li></ul></div>
    <div><h4>Laser + gas</h4><ul class="am-ul"><li>Class-4 laser inside a closed machine = laser class 1 outside (EN 60825-1); never bypass the door interlock.</li><li>Argon displaces oxygen: O2 alarm sensor in the room, ventilation; do not lean into the chamber after opening.</li></ul></div>
    <div><h4>People + skills</h4><ul class="am-ul"><li>AM engineer (DfAM, build prep), machine operator (set-up, powder), post-processing technician, quality (CT, metallography).</li><li>Start: buy parts from a service bureau → learn DfAM → then buy a machine when you print &gt; 1 500 h/year.</li></ul></div>
    <div><h4>Standards (orientation)</h4><ul class="am-ul"><li>ISO/ASTM 52900 terms · 52907 powder · 52910 / 52911-1 design for AM · 52920 production site qualification · 52930 LPBF installation / operation / performance qualification · 52904 metal PBF for critical parts · 52902 test artefacts · 52941 machine acceptance</li><li>Material specs: ASTM F3302 (Ti), F3184 (316L), F3055 (IN718), F3318 (AlSi10Mg)</li></ul></div></div>`;
}

/* ------------------------------------------------------------------ download record */
function download() {
  const rec = { record: "LPBF build record (digital twin – example values)", date: new Date().toISOString(), seed, part: R.PT.name, material: R.A.name, machine: R.M.name + " – " + R.M.cls,
    orientation: R.O.name, partsPerBuild: R.n, parameters: { P_W: R.P, v_mm_s: R.v, h_mm: R.h, t_mm: R.t, E_J_mm3: +R.E.toFixed(2) }, powder: { reuse: cfg.reuse, loaded_kg: +R.mLoad.toFixed(2), used_kg: +R.mUsed.toFixed(3) },
    machineTime_h: +R.tMach.toFixed(2), costPerPart_usd: Math.round(R.costPart), faults: Object.keys(F).filter((k) => F[k]), checks: S.chk.map((c) => ({ op: OPS.find((o) => o.k === c[0]).no, check: c[1], value: c[2], limit: c[3], ok: c[4] })), released: S.ok };
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" })); a.download = `lpbf_build_${seed}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ------------------------------------------------------------------ 3D state + animation loop */
function state3d() {
  if (!R) return null;
  const o = OPS[op], pr = o.k === "print", z = pr ? u * R.H : (OPS.findIndex((x) => x.k === "print") < op ? R.H : 0);
  const ph = (performance.now() / 1000) % 2 / 2;
  const spots = pr && ph >= 0.35 && u < 1 ? R.place.slice(0, Math.max(1, Math.min(R.M.lasers, R.place.length))).map((q) => { const e = (ph - 0.35) / 0.65, row = Math.floor(e * 8), fx = row % 2 ? 1 - (e * 8 % 1) : e * 8 % 1;
    return [q.x - q.w / 2 + fx * q.w, q.y - q.d / 2 + (row + 0.5) / 8 * q.d]; }) : [];
  const p = SER.pts[Math.min(SER.pts.length - 1, Math.floor(u * SER.pts.length))];
  return { key: `${cfg.mach}|${cfg.part}|${cfg.orient}|${R.n}`, plate: R.M.plate, lasers: R.M.lasers, parts: R.place, supH: R.supH, H: R.H, op: o.k, u, z,
    recoater: pr ? (ph < 0.35 ? ph / 0.35 : 1) : (o.k === "setup" ? (Math.sin(performance.now() / 700) + 1) / 2 : 0), spots,
    faults: { streak: !!(pr && p.streak), curl: !!(pr && p.curl) || !!(F.curl && op > 3), o2: !!(F.o2 && pr && p.o2 > R.A.o2), spatter: !!(F.filter && pr), lowP: !!F.lowP }, labels: $("amLbl") ? $("amLbl").checked : true };
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - (lastT || t)) / 1000); lastT = t;
  const p = $("tab-am"); if (!p || !p.classList.contains("active") || $("amItem2").hidden) return;
  const o = OPS[op];
  if (playing) { u += dt / (o.k === "print" ? 24 : 4); if (u >= 1) { u = 1; if (op < OPS.length - 1) { op++; u = 0; renderOps(); } else playing = false; } renderDyn(); }
  else if (o.k === "print" && u > 0 && u < 1) $("amScene").innerHTML = printScene();   // recoater / spots keep moving
}

window.addEventListener("amitemshow", (e) => { if (e.detail === "2") build(); });
if (window.amCtl && window.amCtl.current() === "2") build();
window.amLpbf = { state: state3d, get: () => ({ cfg, F, R, S }) };
