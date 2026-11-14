/* M_P_C tools tab (#mpc) – calculation programs of the folder "machine+program_software+control_system design".
 * Theory + program combined: every result comes from the same Python functions as the command line
 * (server: twin/mpc_tools.py -> tools/dm_toolkit.py, crank.py, fourbar.py). Offline, no libraries.
 * Deep links: /?mpcitem=2#mpc  (1 M1 calculators, 2 crank, 3 four-bar, 4 path generation, 6 M3 shaft, 5 guides + self-test)
 *             /?mpcitem=5&mpcguide=M2b#mpc */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const Q = new URLSearchParams(location.search);
const f = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v)) ? "–" : Number(v).toFixed(d);
let CAT = null;

async function api(path, body) {
  const r = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const ct = r.headers.get("Content-Type") || "";
  const j = ct.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new Error((j && j.error) || r.statusText);
  return j;
}
async function catalog() { if (!CAT) CAT = await api("/api/mpc/catalog"); return CAT; }

/* ------------------------------------------------------------------ charts (inline SVG, theme colours) */
const COLS = ["var(--series)", "#e1752a", "#2ca02c", "#9467bd", "#d03b3b", "#1590a8"];
function chart(series, o = {}) {
  // series: [{name, x:[], y:[], col?, dots?}] ; o: {w,h,title,xl,yl,equal,x0}
  const W = o.w || 520, H = o.h || 300, L = 56, R = 12, T = 26, B = 40;
  const xs = series.flatMap((s) => s.x), ys = series.flatMap((s) => s.y);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (o.zeroY) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
  if (x1 === x0) x1 = x0 + 1; if (y1 === y0) y1 = y0 + 1;
  if (o.equal) {                          // same scale in x and y (geometry, polar diagrams)
    const sx = (x1 - x0) / (W - L - R), sy = (y1 - y0) / (H - T - B), s = Math.max(sx, sy) * 1.05;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    x0 = cx - s * (W - L - R) / 2; x1 = cx + s * (W - L - R) / 2; y0 = cy - s * (H - T - B) / 2; y1 = cy + s * (H - T - B) / 2;
  }
  const X = (v) => L + (v - x0) / (x1 - x0) * (W - L - R), Y = (v) => H - B - (v - y0) / (y1 - y0) * (H - T - B);
  let g = `<text x="${L}" y="16" class="mpc-ct">${esc(o.title || "")}</text>`;
  for (let i = 0; i <= 4; i++) {
    const yv = y0 + (y1 - y0) * i / 4, xv = x0 + (x1 - x0) * i / 4;
    g += `<line x1="${L}" x2="${W - R}" y1="${Y(yv)}" y2="${Y(yv)}" class="mpc-grid"/><text x="${L - 4}" y="${Y(yv) + 4}" text-anchor="end" class="mpc-ax">${+yv.toPrecision(3)}</text>`;
    g += `<line y1="${T}" y2="${H - B}" x1="${X(xv)}" x2="${X(xv)}" class="mpc-grid"/><text x="${X(xv)}" y="${H - B + 14}" text-anchor="middle" class="mpc-ax">${+xv.toPrecision(3)}</text>`;
  }
  if (y0 < 0 && y1 > 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" class="mpc-zero"/>`;
  series.forEach((s, k) => {
    const c = s.col || COLS[k % COLS.length];
    if (s.dots) g += s.x.map((x, i) => `<circle cx="${X(x)}" cy="${Y(s.y[i])}" r="${s.r || 3.5}" fill="${c}"/>`).join("");
    else g += `<polyline fill="none" stroke="${c}" stroke-width="${s.wid || 1.7}" ${s.dash ? 'stroke-dasharray="4 3"' : ""} points="${s.x.map((x, i) => X(x).toFixed(1) + "," + Y(s.y[i]).toFixed(1)).join(" ")}"/>`;
    g += `<text x="${W - R - 4}" y="${T + 12 + 13 * k}" text-anchor="end" fill="${c}" class="mpc-lg">${esc(s.name)}</text>`;
  });
  g += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="mpc-ax">${esc(o.xl || "")}</text>`;
  g += `<text x="12" y="${(T + H - B) / 2}" transform="rotate(-90 12 ${(T + H - B) / 2})" text-anchor="middle" class="mpc-ax">${esc(o.yl || "")}</text>`;
  return { svg: `<svg viewBox="0 0 ${W} ${H}" class="mpc-chart" role="img" aria-label="${esc(o.title || "chart")}">${g}</svg>`, X, Y };
}

/* ------------------------------------------------------------------ parameter form from a default JSON */
function form(id, defaults, labels = {}) {
  const rows = Object.entries(defaults).filter(([k]) => k !== "name").map(([k, v]) => {
    const lab = labels[k] || k.replace(/_/g, " ");
    if (typeof v === "number") return `<label class="mpc-f"><span>${esc(lab)}</span><input type="number" step="any" data-k="${k}" value="${v}"></label>`;
    return `<label class="mpc-f mpc-fw"><span>${esc(lab)} (JSON)</span><input type="text" data-k="${k}" data-json="1" value='${esc(JSON.stringify(v))}'></label>`;
  }).join("");
  return `<div class="mpc-form" id="${id}">${rows}</div>`;
}
function readForm(id) {
  const out = {};
  $(id).querySelectorAll("input[data-k]").forEach((i) => { out[i.dataset.k] = i.dataset.json ? JSON.parse(i.value) : Number(i.value); });
  return out;
}
function csv(name, header, rows) {
  const blob = new Blob([header.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
const busy = (el, txt) => { el.innerHTML = `<p class="hint">⏳ ${esc(txt)}</p>`; };
const err = (el, e) => { el.innerHTML = `<p class="mpc-err">Error: ${esc(e.message || e)}</p>`; };

/* ------------------------------------------------------------------ item 1: M1 calculators */
const DM = [
  { tool: "gci", t: "Mesh convergence (GCI, Roache) – guide M1 §5.7 / ch. 28", f: { f1: 212, f2: 206.5, f3: 190, r: 2 },
    show: (r) => `order p = <b>${f(r.p, 3)}</b> · extrapolated = <b>${f(r.f_ext, 2)}</b> · GCI fine = <b>${f(r.gci_fine_pct, 2)} %</b> · GCI medium ${f(r.gci_med_pct, 2)} % · asymptotic ratio ${f(r.asymptotic_ratio, 3)} (≈ 1 = OK)` },
  { tool: "rel", t: "Stress–strength interference (reliability) – M1 §6.2 / ch. 27", f: { muS: 350, sS: 25, muL: 220, sL: 30 },
    show: (r) => `z = <b>${f(r.z, 3)}</b> · R = <b>${f(r.R, 5)}</b> · failures per million = <b>${f(r.ppm, 0)}</b> · central safety factor ${f(r.sf_central, 2)}` },
  { tool: "goodman", t: "Fatigue: Marin factors + Goodman (steel) – M1 §6.3 / ch. 26", f: { Rm: 650, Re: 430, d: 30, sa: 80, sm: 60, rel: 99 }, sel: { surface: ["machined", "ground", "hot_rolled", "forged"] },
    show: (r) => `Se' ${f(r.Se_prime, 0)} · ka ${f(r.ka, 3)} · kb ${f(r.kb, 3)} · ke ${f(r.ke, 3)} → <b>Se = ${f(r.Se, 1)} MPa</b> · <b>n fatigue = ${f(r.n_fatigue, 2)}</b> · n yield ${f(r.n_yield, 2)}` },
  { tool: "stack", t: "Tolerance stack-up – M1 §5.6 / ch. 24 (± values, comma separated)", f: { tols: "0.05, 0.10, 0.02, 0.03" },
    show: (r) => `worst case ±<b>${f(r.worst_case, 4)}</b> · RSS ±<b>${f(r.rss, 4)}</b> · RSS × 1.5 ±${f(r.rss_bender, 4)} mm` },
  { tool: "shaftopt", t: "Optimisation: minimum-mass hollow shaft – M1 §8.5 (T, M N·m; Re MPa; phi °/m; mm)", f: { T: 200, M: 150, Re: 355, n: 2, G: 80000, phi: 1.0, tmin: 3, domax: 50 },
    show: (r) => `optimum <b>do ${f(r.do, 2)} / di ${f(r.di, 2)} mm</b>, area ${f(r.area_mm2, 1)} mm² · stress ${f(r.stress, 1)} / ${f(r.allow, 1)} MPa · twist ${f(r.twist, 3)} °/m · best solid d ${f(r.d_solid, 2)} mm → <b>saving ${f(r.mass_saving_pct, 1)} %</b>` },
];
function item1(host) {
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M1 – design-method calculators</h2><span class="sub">same functions as <code>tools/dm_toolkit.py</code> · example values · guide M1 (item 5)</span></div>
    <div class="mpc-calcs">${DM.map((c, i) => `<div class="mpc-calc"><h3>${esc(c.t)}</h3><div class="mpc-form">${Object.entries(c.f).map(([k, v]) =>
      `<label class="mpc-f ${k === "tols" ? "mpc-fw" : ""}"><span>${k}</span><input ${k === "tols" ? 'type="text"' : 'type="number" step="any"'} data-c="${i}" data-k="${k}" value="${v}"></label>`).join("")}
      ${c.sel ? Object.entries(c.sel).map(([k, opts]) => `<label class="mpc-f"><span>${k}</span><select data-c="${i}" data-k="${k}">${opts.map((o) => `<option>${o}</option>`).join("")}</select></label>`).join("") : ""}</div>
      <button class="btn" data-run="${i}">Calculate</button><div class="mpc-res" id="mpcDm${i}"></div></div>`).join("")}</div></div>`;
  host.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", async () => {
    const i = +b.dataset.run, c = DM[i], body = { tool: c.tool };
    host.querySelectorAll(`[data-c="${i}"]`).forEach((el) => { body[el.dataset.k] = el.dataset.k === "tols" ? el.value.split(",").map(Number) : (el.tagName === "SELECT" ? el.value : Number(el.value)); });
    const out = $("mpcDm" + i);
    try { out.innerHTML = c.show(await api("/api/mpc/dm", body)); } catch (e) { err(out, e); }
  }));
  host.querySelectorAll("[data-run]").forEach((b) => b.click());
}

/* ------------------------------------------------------------------ item 2: crank */
async function item2(host) {
  const C = await catalog();
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M2 – crank mechanism of the V-twin compressor</h2><span class="sub">same code as <code>tools/crank.py</code> · example values</span></div>
    ${form("mpcCrF", C.crank_default)}
    <div class="mpc-btns"><button class="btn" id="mpcCrRun">Calculate</button><button class="btn ghost" id="mpcCrReset">Example values</button>
      <button class="btn ghost" id="mpcCr20">Design for 20 m³/h (bore 70, c 0.035)</button><button class="btn ghost" id="mpcCrCsv">Download CSV</button></div></div>
    <div id="mpcCrOut"></div>`;
  const run = async () => {
    const out = $("mpcCrOut"); busy(out, "calculating …");
    try {
      const R = await api("/api/mpc/crank", { params: readForm("mpcCrF") }); window.__mpcCrank = R;
      const s = R.series, th = s.theta, cl = (o) => ({ x: o.x.concat([o.x[0]]), y: o.y.concat([o.y[0]]) });  // close polar loops
      const k = (lab, v) => `<div class="mpc-kpi"><span>${lab}</span><b>${v}</b></div>`;
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("FAD", f(R.cycle.fad_m3h, 2) + " m³/h")}${k("Indicated power", f(R.cycle.P_ind_W, 0) + " W")}${k("Torque mean / max", f(R.torque.M_mean, 2) + " / " + f(R.torque.M_max, 2) + " N·m")}
          ${k("Flywheel to add", f(R.torque.J_fly, 4) + " kg·m²")}${k("Residual shaking", f(R.balance.shake_residual_max, 1) + " N")}${k("Rod bearing max", f(R.bearings.rod_bearing_max_N, 0) + " N")}
          ${k("Min TDC gap (worst case)", f(R.tol.gap_min_wc, 3) + " mm")}</div>
        <div class="mpc-charts">
          ${chart([{ name: "drive torque", x: th, y: s.M }, { name: "mean", x: [0, 360], y: [R.torque.M_mean, R.torque.M_mean], dash: 1 }], { title: "Drive torque M(θ) [N·m]", xl: "crank angle θ [°]", yl: "N·m", zeroY: 1 }).svg}
          ${chart([{ name: "cylinder p–V", x: s.pv.V, y: s.pv.p }], { title: "p–V diagram (one cylinder)", xl: "V [cm³]", yl: "p abs [bar]" }).svg}
          ${chart([{ name: "rod 1 on pin", ...cl(s.rod1) }, { name: "both rods", ...cl(s.pin) }], { title: "Crank-pin load polar diagram [N]", xl: "Fx", yl: "Fy", equal: 1 }).svg}
          ${chart([{ name: "oscillating only", ...cl(s.shake_osc) }, { name: "with counterweight", ...cl(s.shake) }], { title: "Shaking force on the frame [N]", xl: "Fx", yl: "Fy", equal: 1 }).svg}
          ${chart(R.params.cyl_angles_deg.map((g, i) => ({ name: "cylinder " + (i + 1), x: th, y: s.p.map((v) => v[i]) })), { title: "Cylinder pressure [bar abs]", xl: "θ [°]", yl: "bar" }).svg}
          ${chart(R.params.cyl_angles_deg.map((g, i) => ({ name: "rod force " + (i + 1), x: th, y: s.S.map((v) => v[i]) })), { title: "Rod force S (compression +) [N]", xl: "θ [°]", yl: "N", zeroY: 1 }).svg}
        </div><details><summary>Full report (same as <code>python crank.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcCrRun").onclick = run;
  $("mpcCrReset").onclick = () => { $("mpcCrF").outerHTML = form("mpcCrF", C.crank_default); run(); };
  $("mpcCr20").onclick = () => { $("mpcCrF").querySelector('[data-k="bore_mm"]').value = 70; $("mpcCrF").querySelector('[data-k="clearance_ratio"]').value = 0.035; run(); };
  $("mpcCrCsv").onclick = () => { const R = window.__mpcCrank; if (!R) return; const s = R.series;
    csv("crank.csv", ["theta_deg", "M_drive_Nm", "p1_bar", "p2_bar", "S1_N", "S2_N", "Fpin_x", "Fpin_y", "shake_x", "shake_y"],
      s.theta.map((t, i) => [t, s.M[i], s.p[i][0], s.p[i][1] ?? "", s.S[i][0], s.S[i][1] ?? "", s.pin.x[i], s.pin.y[i], s.shake.x[i], s.shake.y[i]])); };
  run();
}

/* ------------------------------------------------------------------ linkage animation (items 3 + 4) */
function animator(host, frames, fixed, extra = {}) {
  // frames: [{A:[x,y], B:[x,y], P:[x,y]}], fixed: {O2:[x,y], O4:[x,y]}; extra: {targets:[[x,y]], trace:[[x,y]]}
  const pts = frames.flatMap((q) => [q.A, q.B, q.P]).concat([fixed.O2, fixed.O4]).concat(extra.targets || []);
  const ser = [{ name: "coupler curve", x: frames.map((q) => q.P[0]), y: frames.map((q) => q.P[1]) }];
  if (extra.targets) ser.push({ name: "required track", x: extra.targets.map((t) => t[0]), y: extra.targets.map((t) => t[1]), dots: 1, col: "#d03b3b" });
  ser.push({ name: "", x: pts.map((p) => p[0]), y: pts.map((p) => p[1]), col: "transparent", wid: 0 });
  const c = chart(ser, { w: 620, h: 420, title: extra.title || "Linkage (mm) – drag the slider or press Play", xl: "x [mm]", yl: "y [mm]", equal: 1 });
  host.innerHTML = `<div class="mpc-anim">${c.svg.replace("</svg>", '<g id="mpcLk"></g></svg>')}
    <div class="mpc-btns"><button class="btn" data-play>▶ Play</button><input type="range" min="0" max="${frames.length - 1}" value="0" data-sl style="flex:1"><span class="hint" data-lab></span></div></div>`;
  const g = host.querySelector("#mpcLk"), sl = host.querySelector("[data-sl]"), lab = host.querySelector("[data-lab]");
  const line = (p, q, cls) => `<line x1="${c.X(p[0])}" y1="${c.Y(p[1])}" x2="${c.X(q[0])}" y2="${c.Y(q[1])}" class="${cls}"/>`;
  const dot = (p, cls, r = 4) => `<circle cx="${c.X(p[0])}" cy="${c.Y(p[1])}" r="${r}" class="${cls}"/>`;
  const draw = (i) => {
    const q = frames[i];
    g.innerHTML = line(fixed.O2, fixed.O4, "mpc-gnd") + line(fixed.O2, q.A, "mpc-l2") + `<polygon points="${[q.A, q.B, q.P].map((p) => c.X(p[0]) + "," + c.Y(p[1])).join(" ")}" class="mpc-l3"/>` +
      line(fixed.O4, q.B, "mpc-l4") + dot(fixed.O2, "mpc-piv", 5) + dot(fixed.O4, "mpc-piv", 5) + dot(q.A, "mpc-jt") + dot(q.B, "mpc-jt") + dot(q.P, "mpc-cp", 5);
    lab.textContent = extra.label ? extra.label(i) : `frame ${i + 1} / ${frames.length}`;
  };
  let timer = null;
  sl.oninput = () => draw(+sl.value);
  host.querySelector("[data-play]").onclick = (ev) => {
    if (timer) { clearInterval(timer); timer = null; ev.target.textContent = "▶ Play"; return; }
    ev.target.textContent = "⏸ Pause";
    timer = setInterval(() => { sl.value = (+sl.value + 1) % frames.length; draw(+sl.value); if (!document.body.contains(sl)) clearInterval(timer); }, 40);
  };
  draw(0);
}

/* ------------------------------------------------------------------ item 3: four-bar analysis */
async function item3(host, params) {
  const C = await catalog();
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M2b – four-bar linkage: analysis, animation, dynamics</h2><span class="sub">same code as <code>tools/fourbar.py</code> · a crank, b coupler, c rocker, d ground (mm) · example values</span></div>
    ${form("mpcFbF", Object.assign({}, C.fourbar_default, params || {}))}
    <div class="mpc-btns"><button class="btn" id="mpcFbRun">Analyse</button><button class="btn ghost" id="mpcFbReset">Example values</button><button class="btn ghost" id="mpcFbCsv">Download CSV</button></div></div>
    <div id="mpcFbOut"></div>`;
  const run = async () => {
    const out = $("mpcFbOut"); busy(out, "analysing …");
    try {
      const R = await api("/api/mpc/fourbar", { params: readForm("mpcFbF") }); window.__mpcFb = R;
      const F = R.frames, t2 = F.map((q) => q.t2), S = R.summary;
      const k = (lab, v) => `<div class="mpc-kpi"><span>${lab}</span><b>${v}</b></div>`;
      out.innerHTML = `<div class="card"><p class="mpc-cls"><b>${esc(R.grashof.class)}</b> · s + l = ${f(R.grashof.s + R.grashof.l, 2)}, p + q = ${f(R.grashof.p_plus_q, 2)} · assemblable ${R.assemblable}/${R.total} input angles</p>
        <div class="mpc-kpis">${k("Rocker swing", f(S.swing, 2) + "°")}${R.limits ? k("Time ratio Q", f(R.limits.Q, 4)) : ""}${k("Transmission angle", f(S.mu_min, 1) + " … " + f(S.mu_max, 1) + "°")}
          ${k("Input torque max / min", f(S.T_max, 3) + " / " + f(S.T_min, 3) + " N·m")}${k("Mean power", f(S.P_mean_W, 1) + " W")}${k("Pin force max", f(Math.max(...Object.values(S.pin_max)), 1) + " N")}${k("Shaking force max", f(S.shake_max, 1) + " N")}</div>
        <div id="mpcFbAnim"></div>
        <div class="mpc-charts">
          ${chart([{ name: "θ4 rocker", x: t2, y: F.map((q) => q.t4) }, { name: "transmission angle μ", x: t2, y: F.map((q) => q.mu) }], { title: "Output angle and transmission angle [°]", xl: "θ2 [°]", yl: "°" }).svg}
          ${chart([{ name: "input torque T12", x: t2, y: F.map((q) => q.T) }], { title: "Input torque [N·m]", xl: "θ2 [°]", yl: "N·m", zeroY: 1 }).svg}
          ${chart(["F12", "F32", "F43", "F14"].map((n) => ({ name: n, x: t2, y: F.map((q) => q[n]) })), { title: "Pin forces |F| [N]", xl: "θ2 [°]", yl: "N" }).svg}
          ${chart([{ name: "ω4 [rad/s]", x: t2, y: F.map((q) => q.w4) }, { name: "α4 / 10 [rad/s²]", x: t2, y: F.map((q) => q.al4 / 10) }], { title: "Rocker velocity and acceleration", xl: "θ2 [°]", yl: "", zeroY: 1 }).svg}
        </div><details><summary>Full report (same as <code>python fourbar.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
      animator($("mpcFbAnim"), F, { O2: [0, 0], O4: [R.params.d_mm, 0] }, { label: (i) => `θ2 = ${f(F[i].t2, 0)}° · θ4 = ${f(F[i].t4, 1)}° · μ = ${f(F[i].mu, 1)}° · T = ${f(F[i].T, 3)} N·m` });
    } catch (e) { err(out, e); }
  };
  $("mpcFbRun").onclick = run;
  $("mpcFbReset").onclick = () => { $("mpcFbF").outerHTML = form("mpcFbF", C.fourbar_default); run(); };
  $("mpcFbCsv").onclick = () => { const R = window.__mpcFb; if (!R) return;
    csv("fourbar.csv", ["theta2", "theta4", "mu", "T12", "w4", "al4", "F12", "F32", "F43", "F14", "Px", "Py"], R.frames.map((q) => [q.t2, q.t4, q.mu, q.T, q.w4, q.al4, q.F12, q.F32, q.F43, q.F14, q.P[0], q.P[1]])); };
  run();
}

/* ------------------------------------------------------------------ item 4: path generation */
async function item4(host) {
  const C = await catalog(), ex = C.path_example;
  const presets = {
    "D-track pick-and-place (10 points)": { track: ex.track_mm, timing: null },
    "Straight 120 mm, constant speed (timed)": { track: [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0]], timing: [0, 30, 60, 90, 120] },
    "Lift-and-carry arc (8 points)": { track: [[0, 0], [20, 25], [50, 40], [85, 40], [115, 25], [135, 0], [90, -6], [45, -6]], timing: null },
  };
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M2b – path generation: required track → four-bar linkage</h2><span class="sub">same code as <code>fourbar.py path</code> · guide M2b chapter 6b · example values</span></div>
    <p class="intro">Enter the points the tool must pass (mm). <b>Timing</b> empty = only the shape matters; or one crank angle per point (first = 0) when the tool must be at a point at a given time.
      The solver (genetic algorithm + Nelder–Mead) keeps a full-turn crank, transmission angle ≥ μ<sub>min</sub>, practical size and the order of the points. One run takes about 15–30 s.
      You can also <b>click in the chart</b> below to add points.</p>
    <div class="mpc-btns">${Object.keys(presets).map((n, i) => `<button class="chip" data-pre="${i}">${esc(n)}</button>`).join("")}<button class="chip" id="mpcPClr">clear points</button></div>
    <div class="mpc-form"><label class="mpc-f mpc-fw"><span>track points [[x, y], …] mm</span><input type="text" id="mpcPTr"></label>
      <label class="mpc-f mpc-fw"><span>timing [deg] or empty</span><input type="text" id="mpcPTi"></label>
      <label class="mpc-f"><span>μ min [°]</span><input type="number" id="mpcPMu" value="40"></label>
      <label class="mpc-f"><span>max link / track size</span><input type="number" step="0.1" id="mpcPMl" value="2.5"></label>
      <label class="mpc-f"><span>generations</span><input type="number" id="mpcPGe" value="120"></label></div>
    <div id="mpcPPick"></div>
    <div class="mpc-btns"><button class="btn" id="mpcPRun">Find linkage (N points)</button><button class="btn ghost" id="mpcP3">Exact 3-point solution (first 3 points, timing 0 / 60 / 120° or your timing)</button></div></div>
    <div id="mpcPOut"></div>`;
  const setP = (p) => { $("mpcPTr").value = JSON.stringify(p.track); $("mpcPTi").value = p.timing ? JSON.stringify(p.timing) : ""; pick(); };
  const track = () => JSON.parse($("mpcPTr").value || "[]");
  function pick() {                                   // clickable editor
    const tr = track(), box = tr.length ? tr : [[0, 0], [100, 50]];
    const c = chart([{ name: "required track (click to add)", x: box.map((t) => t[0]).concat([Math.min(...box.map((t) => t[0])) - 30, Math.max(...box.map((t) => t[0])) + 30]),
      y: box.map((t) => t[1]).concat([Math.min(...box.map((t) => t[1])) - 30, Math.max(...box.map((t) => t[1])) + 30]), col: "transparent" },
      { name: "points", x: tr.map((t) => t[0]), y: tr.map((t) => t[1]), dots: 1, col: "#d03b3b" }], { w: 620, h: 300, title: "Track editor [mm]", xl: "x", yl: "y", equal: 1 });
    $("mpcPPick").innerHTML = c.svg; const svg = $("mpcPPick").querySelector("svg");
    svg.style.cursor = "crosshair";
    svg.onclick = (ev) => { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
      const sx = (ev.clientX - r.left) * vb.width / r.width, sy = (ev.clientY - r.top) * vb.height / r.height;
      let lo = -1e9, hi = 1e9; // invert X, Y numerically (linear)
      const x = invert(c.X, sx), y = invert(c.Y, sy);
      const t = track(); t.push([+x.toFixed(1), +y.toFixed(1)]); $("mpcPTr").value = JSON.stringify(t); pick(); };
  }
  const invert = (F, v) => { const a = F(0), b = F(1); return (v - a) / (b - a); };
  host.querySelectorAll("[data-pre]").forEach((b) => b.onclick = () => setP(Object.values(presets)[+b.dataset.pre]));
  $("mpcPClr").onclick = () => { $("mpcPTr").value = "[]"; $("mpcPTi").value = ""; pick(); };
  $("mpcPTr").onchange = pick;
  const show = (R, out, title) => {
    const k = (lab, v) => `<div class="mpc-kpi"><span>${lab}</span><b>${v}</b></div>`;
    out.innerHTML = `<div class="card"><p class="mpc-cls"><b>${esc(R.grashof)}</b></p><div class="mpc-kpis">
      ${k("Links a / b / c / d", `${f(R.a, 1)} / ${f(R.b, 1)} / ${f(R.c, 1)} / ${f(R.d, 1)} mm`)}${k("O2 · O4", `(${f(R.O2[0], 1)}, ${f(R.O2[1], 1)}) · (${f(R.O4[0], 1)}, ${f(R.O4[1], 1)})`)}
      ${R.rms_mm !== undefined ? k("Track error RMS / max", `${f(R.rms_mm, 3)} / ${f(R.max_mm, 3)} mm`) : k("Valid designs found", R.found)}
      ${R.mu_min !== undefined ? k("Transmission angle", `${f(R.mu_min, 1)} … ${f(R.mu_max, 1)}°`) : k("Worst transmission angle", f(R.mu_worst, 1) + "°")}</div>
      <div id="mpcPAnim"></div>${R.report ? `<pre class="mpc-pre">${esc(R.report)}</pre>` : ""}
      ${R.params_for_run ? `<div class="mpc-btns"><button class="btn" id="mpcPAn">Analyse this linkage in item 3 (velocities, torque, pin forces, tolerances)</button>
        <button class="btn ghost" id="mpcPJs">Download linkage_for_run.json</button></div>` : ""}</div>`;
    animator($("mpcPAnim"), R.frames, { O2: R.O2, O4: R.O4 }, { targets: R.track || R.points, title });
    if (R.params_for_run) {
      $("mpcPAn").onclick = () => { showItem("3", R.params_for_run); };
      $("mpcPJs").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(R.params_for_run, null, 2)], { type: "application/json" })); a.download = "linkage_for_run.json"; a.click(); };
    }
  };
  $("mpcPRun").onclick = async () => {
    const out = $("mpcPOut"); busy(out, "searching (genetic algorithm + Nelder–Mead, about 15–30 s) …");
    try {
      const ti = $("mpcPTi").value.trim();
      const R = await api("/api/mpc/path", { track: track(), timing: ti ? JSON.parse(ti) : null, mu_min: +$("mpcPMu").value, max_link_factor: +$("mpcPMl").value, generations: +$("mpcPGe").value });
      show(R, out, "Required track (red) and the synthesised linkage");
    } catch (e) { err(out, e); }
  };
  $("mpcP3").onclick = async () => {
    const out = $("mpcPOut"); busy(out, "exact 3-point synthesis + search of the free choices …");
    try {
      const ti = $("mpcPTi").value.trim(), t = ti ? JSON.parse(ti) : [0, 60, 120];
      const R = await api("/api/mpc/path3", { points: track().slice(0, 3), betas: [t[1] - t[0], t[2] - t[0]], mu_min: +$("mpcPMu").value });
      if (!R.found) { out.innerHTML = `<p class="mpc-err">${esc(R.message)}</p>`; return; }
      show(R, out, "Exact 3-point path generation (points met to ≈ 1e-13 mm)");
    } catch (e) { err(out, e); }
  };
  setP(Object.values(presets)[0]);
}

/* ------------------------------------------------------------------ item 5: guides + self-test */
function md(src) {                      // small Markdown renderer: headings, tables, code, lists, bold, inline code
  const lines = src.replace(/\r/g, "").split("\n"); let h = "", i = 0;
  const inl = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<i>$2</i>");
  while (i < lines.length) {
    const l = lines[i];
    if (l.startsWith("```")) { let c = ""; i++; while (i < lines.length && !lines[i].startsWith("```")) c += lines[i++] + "\n"; i++; h += `<pre class="mpc-pre">${esc(c)}</pre>`; continue; }
    if (/^\|/.test(l)) { const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      h += `<div class="mpc-tw"><table><thead><tr>${cells(rows[0]).map((c) => `<th>${inl(c)}</th>`).join("")}</tr></thead><tbody>${rows.slice(2).map((r) => `<tr>${cells(r).map((c) => `<td>${inl(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; continue; }
    const m = l.match(/^(#{1,4}) (.*)/);
    if (m) { h += `<h${m[1].length + 1} class="mpc-h">${inl(m[2])}</h${m[1].length + 1}>`; i++; continue; }
    if (/^\s*[-*] /.test(l)) { h += "<ul>"; while (i < lines.length && /^\s*[-*] /.test(lines[i])) h += `<li>${inl(lines[i++].replace(/^\s*[-*] /, ""))}</li>`; h += "</ul>"; continue; }
    if (/^\s*\d+\. /.test(l)) { h += "<ol>"; while (i < lines.length && /^\s*\d+\. /.test(lines[i])) h += `<li>${inl(lines[i++].replace(/^\s*\d+\. /, ""))}</li>`; h += "</ol>"; continue; }
    if (l.startsWith(">")) { h += `<blockquote>${inl(l.replace(/^>\s?/, ""))}</blockquote>`; i++; continue; }
    if (l.trim() === "---") { h += "<hr>"; i++; continue; }
    if (l.trim()) h += `<p>${inl(l)}</p>`;
    i++;
  }
  return h;
}
async function item5(host) {
  const C = await catalog(), g0 = Q.get("mpcguide") || "M1";
  host.innerHTML = `<div class="card"><div class="card-head"><h2>Guides + self-test</h2><span class="sub">folder <code>${esc(C.folder)}</code></span></div>
    <div class="mpc-btns">${C.guides.map((g) => `<button class="chip" data-g="${g.id}">${esc(g.title)}</button>`).join("")}
      <button class="btn" id="mpcST">Run self-test of all programs (≈ 30 s)</button></div><div id="mpcSTo"></div>
    <input type="search" id="mpcGs" placeholder="find in guide …" class="mpc-gs"><div class="mpc-guide" id="mpcGd"></div></div>`;
  const load = async (id) => { host.querySelectorAll("[data-g]").forEach((b) => b.classList.toggle("on", b.dataset.g === id)); const el = $("mpcGd"); busy(el, "loading guide …");
    try { el.innerHTML = md(await api("/api/mpc/guide?id=" + id)); } catch (e) { err(el, e); } };
  host.querySelectorAll("[data-g]").forEach((b) => b.onclick = () => load(b.dataset.g));
  $("mpcGs").onkeydown = (ev) => { if (ev.key !== "Enter") return; const q = ev.target.value.toLowerCase(); if (!q) return;
    const hit = [...$("mpcGd").querySelectorAll("h2,h3,h4,h5,p,li,td")].find((n) => n.textContent.toLowerCase().includes(q)); if (hit) { hit.scrollIntoView({ block: "center" }); hit.classList.add("mpc-hit"); setTimeout(() => hit.classList.remove("mpc-hit"), 2000); } };
  $("mpcST").onclick = async () => { const o = $("mpcSTo"); busy(o, "running all self-tests …");
    try { const r = await api("/api/mpc/selftest"); o.innerHTML = `<pre class="mpc-pre ${r.ok ? "" : "mpc-err"}">${esc(r.output)}</pre>`; } catch (e) { err(o, e); } };
  load(g0);
}

/* ------------------------------------------------------------------ item 6: M3 shaft design */
async function item6(host) {
  const C = await catalog(), D0 = C.shaft_default;
  const labels = { segments: "segments [[length, d, bore], …] mm", bearings: "bearing centres x [mm] (A locating, B floating)",
    forces: "forces [[x, Fy, Fz, label], …] N", masses: "masses [[x, kg, label]] (critical speed)",
    notches: "notches [[x, type, {…}]] – shoulder / keyway / pressfit / groove / plain", key: "feather key", pressfit: "interference fit" };
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M3 – shaft design: stepped shaft on two bearings</h2><span class="sub">same code as <code>tools/shaft.py</code> · DIN 743 style proof (simplified – see guide M3) · example values</span></div>
    <div class="mpc-form"><label class="mpc-f"><span>material</span><select id="mpcShMat">${C.shaft_materials.map((m) => `<option ${m === D0.material ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label></div>
    ${form("mpcShF", Object.fromEntries(Object.entries(D0).filter(([k]) => k !== "material")), labels)}
    <div class="mpc-btns"><button class="btn" id="mpcShRun">Calculate</button><button class="btn ghost" id="mpcShReset">Example values</button>
      <button class="btn ghost" id="mpcShHo">Take loads from M2 crank (hand-over)</button><button class="btn ghost" id="mpcShCsv">Download CSV</button><span class="hint" id="mpcShHoT"></span></div></div>
    <div id="mpcShOut"></div>`;
  const run = async () => {
    const out = $("mpcShOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcShF"); p.material = $("mpcShMat").value;
      const R = await api("/api/mpc/shaft", { params: p }); window.__mpcSh = R;
      const g = R.diagram, d = R.deflection, c = R.critical, P = R.params;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const minF = Math.min(...R.strength.map((s) => s.S_fatigue)), minS = Math.min(...R.strength.map((s) => s.S_static));
      const RA = Math.hypot(R.reactions.y[0], R.reactions.z[0]), RB = Math.hypot(R.reactions.y[1], R.reactions.z[1]);
      const contour = { x: g.x.concat(g.x.slice().reverse()), y: g.D.map((v) => v / 2).concat(g.D.slice().reverse().map((v) => -v / 2)) };
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("Bearing loads A / B", f(RA, 0) + " / " + f(RB, 0) + " N")}${k("Max deflection", f(d.v_max * 1000, 1) + " µm", d.v_max > P.deflection_limit_mm)}
          ${k("Slope A / B", f(d.slope_A * 1000, 3) + " / " + f(d.slope_B * 1000, 3) + " mrad", Math.max(d.slope_A, d.slope_B) > P.slope_limit_rad)}
          ${k("Critical speed", f(c.n_crit_rpm, 0) + " rpm (" + f(c.ratio, 1) + " × n)", c.ratio < 1.3)}${k("Twist", f(R.torsion.phi_deg, 4) + "°")}
          ${k("Min safety fatigue / static", f(minF, 2) + " / " + f(minS, 2), Math.min(minF, minS) < P.S_min)}
          ${k("Key pressure", f(R.key.p, 1) + " / " + f(R.key.p_allow, 0) + " MPa", R.key.S_p < 1)}
          ${k("Press fit slip safety (U min)", f(R.pressfit.S_slip_min, 2), R.pressfit.S_slip_min < 1)}${k("Shrink temperature", f(R.pressfit.shrink_dT_K, 0) + " K", R.pressfit.shrink_dT_K > 200)}</div>
        <div class="mpc-charts">
          ${chart([{ name: "contour", ...contour }, { name: "bearings", x: P.bearings, y: P.bearings.map(() => 0), dots: 1, col: "#2ca02c" },
            { name: "loads", x: P.forces.map((q) => q[0]), y: P.forces.map(() => 0), dots: 1, col: "#d03b3b" }], { title: "Shaft geometry [mm] (green bearings, red loads)", xl: "x [mm]", yl: "r [mm]", equal: 1, h: 220 }).svg}
          ${chart([{ name: "M resultant", x: g.x, y: g.M }, { name: "My", x: g.x, y: g.My }, { name: "Mz", x: g.x, y: g.Mz }, { name: "T (peak)", x: g.x, y: g.T, dash: 1 }], { title: "Bending moments and torque [N·m]", xl: "x [mm]", yl: "N·m", zeroY: 1 }).svg}
          ${chart([{ name: "deflection", x: g.x, y: g.v_um }], { title: "Resultant deflection [µm]", xl: "x [mm]", yl: "µm" }).svg}
          ${chart([{ name: "slope", x: g.x, y: g.slope.map((v) => v * 1000) }], { title: "Slope [mrad]", xl: "x [mm]", yl: "mrad" }).svg}
        </div>
        <h3>Strength at every notch (S_min ${f(P.S_min, 2)})</h3><div class="mpc-tw"><table><thead><tr><th>x mm</th><th>type</th><th>d</th><th>M N·m</th><th>σba MPa</th><th>τta MPa</th>
          <th>β_σ</th><th>K_σ</th><th>σADK MPa</th><th>S fatigue</th><th>S static</th><th></th></tr></thead><tbody>${R.strength.map((s) =>
          `<tr><td>${f(s.x, 1)}</td><td>${esc(s.type)}</td><td>${f(s.d, 0)}</td><td>${f(s.M_Nm, 1)}</td><td>${f(s.sba, 1)}</td><td>${f(s.tta, 1)}</td><td>${f(s.beta_s, 2)}</td><td>${f(s.K_sigma, 2)}</td>
           <td>${f(s.sADK, 1)}</td><td><b>${f(s.S_fatigue, 2)}</b></td><td><b>${f(s.S_static, 2)}</b></td><td class="${s.ok ? "mpc-okc" : "mpc-err"}">${s.ok ? "OK" : "NOT OK"}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint">Key ${R.key.b}×${R.key.h}, t1 ${R.key.t1}, l_tr ${f(R.key.l_tr, 0)} mm: p ${f(R.key.p, 1)} MPa, τ ${f(R.key.tau, 1)} MPa, l_min ${f(R.key.l_min, 1)} mm ·
          Press fit: p ${f(R.pressfit.min.p, 1)} … ${f(R.pressfit.max.p, 1)} MPa, torque ${f(R.pressfit.min.T_Nm, 1)} … ${f(R.pressfit.max.T_Nm, 1)} N·m, hub von Mises ${f(R.pressfit.max.sv_hub, 0)} MPa.</p>
        <details><summary>Full report (same as <code>python shaft.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcShRun").onclick = run;
  $("mpcShReset").onclick = () => { $("mpcShF").outerHTML = form("mpcShF", Object.fromEntries(Object.entries(D0).filter(([k]) => k !== "material")), labels); $("mpcShMat").value = D0.material; run(); };
  $("mpcShHo").onclick = async () => {
    try {
      const h = (await api("/api/mpc/shaft", { handover: true })).handover, F = $("mpcShF");
      const set = (k, v) => { const i = F.querySelector(`[data-k="${k}"]`); if (i) i.value = i.dataset.json ? JSON.stringify(v) : v; };
      set("T_mean_Nm", +h.T_mid.toFixed(2)); set("T_amp_Nm", +h.T_amp.toFixed(2)); set("T_max_Nm", +h.T_max.toFixed(2));
      const fo = JSON.parse(F.querySelector('[data-k="forces"]').value);
      if (fo[0]) fo[0][2] = -Math.round(h.F_belt); if (fo[1]) fo[1][1] = -Math.round(h.pin_max);
      set("forces", fo);
      $("mpcShHoT").textContent = `from crank.py: T mid-range (fatigue mean) ${f(h.T_mid, 2)} (time average ${f(h.T_mean, 2)}), amplitude ${f(h.T_amp, 2)}, max ${f(h.T_max, 2)} N·m; pin ${f(h.pin_max, 0)} N; belt ${f(h.F_belt, 0)} N`;
      run();
    } catch (e) { err($("mpcShOut"), e); }
  };
  $("mpcShCsv").onclick = () => { const R = window.__mpcSh; if (!R) return; const g = R.diagram;
    csv("shaft.csv", ["x_mm", "D_mm", "My_Nm", "Mz_Nm", "M_Nm", "T_Nm", "deflection_um", "slope_rad"], g.x.map((x, i) => [x, g.D[i], g.My[i], g.Mz[i], g.M[i], g.T[i], g.v_um[i], g.slope[i]])); };
  run();
}

/* ------------------------------------------------------------------ item switch */
let current = Q.get("mpcitem") || "1";
const built = {};
function showItem(n, arg) {
  n = String(n); current = n;
  document.querySelectorAll("[data-mpcitem]").forEach((b) => b.classList.toggle("active", b.dataset.mpcitem === n));
  ["1", "2", "3", "4", "5", "6"].forEach((i) => { const el = $("mpcItem" + i); if (el) el.hidden = i !== n; });
  const host = $("mpcItem" + n);
  if (!built[n] || arg) { built[n] = true; ({ 1: item1, 2: item2, 3: item3, 4: item4, 5: item5, 6: item6 })[n](host, arg); }
}
document.querySelectorAll("[data-mpcitem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.mpcitem)));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "mpc") showItem(current); };
if (location.hash === "#mpc") setTimeout(() => showItem(current), 0);
