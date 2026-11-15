/* M_P_C tools tab (#mpc) – calculation programs of the folder "machine+program_software+control_system design".
 * Theory + program combined: every result comes from the same Python functions as the command line
 * (server: twin/mpc_tools.py -> tools/dm_toolkit.py, crank.py, fourbar.py). Offline, no libraries.
 * Deep links: /?mpcitem=2#mpc  (1 M1 calculators, 2 crank, 3 four-bar, 4 path generation, 6 M3 shaft, 7 M4 bearings, 8 M5 gears, 9 M5b bevel gears, 10 M5c worm gears, 11 M5d gear manufacturing, 12 M6 cams, 13 M7 bolted joints, 14 M8 springs, 15 M9 belts / chains / couplings, 16 M10 tolerances, 17 M11 welds / frames / pressure parts, 18 M12 optimisation workflows, 5 guides + self-test)
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

/* ------------------------------------------------------------------ item 7: M4 rolling bearings */
async function item7(host) {
  const C = await catalog(), D0 = C.bearing_default, CAT = C.bearing_catalogue;
  const opts = (sel) => Object.entries(CAT).map(([n, b]) => `<option value="${n}" ${n === sel ? "selected" : ""}>${n} – ${b.type}, ${b.d}×${b.D}×${b.B}, C ${b.C} kN</option>`).join("");
  const skip = new Set(["bearing_A", "bearing_B", "cleanliness", "oil_VG", "use_crank_loads"]);
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M4 – rolling bearings: life, lubrication, clearance, selection</h2><span class="sub">same code as <code>tools/bearing.py</code> · ISO 281 style (check the standard) · catalogue values typical – check your supplier · example values</span></div>
    <div class="mpc-form">
      <label class="mpc-f mpc-fw"><span>bearing A (locating)</span><select id="mpcBrA">${opts(D0.bearing_A)}</select></label>
      <label class="mpc-f mpc-fw"><span>bearing B (floating)</span><select id="mpcBrB">${opts(D0.bearing_B)}</select></label>
      <label class="mpc-f"><span>loads</span><select id="mpcBrUse"><option value="1">over a revolution: M2 crank → M3 shaft</option><option value="0">constant (fields below)</option></select></label>
      <label class="mpc-f"><span>oil ISO VG</span><select id="mpcBrVG">${[32, 46, 68, 100, 150, 220, 320, 460].map((v) => `<option ${v === D0.oil_VG ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label class="mpc-f mpc-fw"><span>cleanliness (e_c)</span><select id="mpcBrCl">${C.bearing_cleanliness.map((c) => `<option ${c === D0.cleanliness ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label></div>
    ${form("mpcBrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))))}
    <div class="mpc-btns"><button class="btn" id="mpcBrRun">Calculate</button><button class="btn ghost" id="mpcBrReset">Example values</button><button class="btn ghost" id="mpcBrCsv">Download loads CSV</button></div></div>
    <div id="mpcBrOut"></div>`;
  const run = async () => {
    const out = $("mpcBrOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcBrF");
      Object.assign(p, { bearing_A: $("mpcBrA").value, bearing_B: $("mpcBrB").value, use_crank_loads: $("mpcBrUse").value === "1", oil_VG: +$("mpcBrVG").value, cleanliness: $("mpcBrCl").value });
      const R = await api("/api/mpc/bearing", { params: p }); window.__mpcBr = R;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const side = (s) => { const r = R[s], L = r.life, c = r.clearance;
        return `${k(`${s}: ${r.name} – P`, f(r.eq.P, 0) + " N (max " + f(r.Fr_max, 0) + ")")}${k(`${s}: L10h / L_nm`, f(L.L10h, 0) + " / " + f(L.Lnmh, 0) + " h", L.Lnmh < R.params.target_life_h)}
          ${k(`${s}: κ · a_ISO`, f(L.kappa, 2) + " · " + f(L.a_iso, 2), L.kappa < 1)}${k(`${s}: s0`, f(r.s0, 1), r.s0 < 1)}
          ${c ? k(`${s}: operating clearance`, f(c.min, 1) + " … " + f(c.max, 1) + " µm", c.min < 0) : ""}${k(`${s}: friction loss`, f(r.friction.N_W, 2) + " W")}`; };
      const cand = (s) => `<div class="mpc-tw"><table><thead><tr><th>${s}: candidate</th><th>type</th><th>D×B</th><th>P N</th><th>L10h</th><th>L_nm h</th><th>a_ISO</th><th>κ</th><th>s0</th><th>mass kg</th><th></th></tr></thead><tbody>${R["cand_" + s].map((c) =>
        `<tr${c.name === R.params["bearing_" + s] ? ' class="mpc-sel"' : ""}><td>${c.name}</td><td>${c.type}</td><td>${c.D}×${c.B}</td><td>${f(c.P, 0)}</td><td>${f(c.L10h, 0)}</td><td>${f(c.Lnmh, 0)}</td><td>${f(c.a_iso, 2)}</td><td>${f(c.kappa, 2)}</td><td>${f(c.s0, 1)}</td><td>${f(c.m, 2)}</td><td class="${c.ok ? "mpc-okc" : "mpc-err"}">${c.ok ? "OK" : "no"}</td></tr>`).join("")}</tbody></table></div>`;
      const V = R.visc;
      out.innerHTML = `<div class="card"><div class="mpc-kpis">${side("A")}</div><div class="mpc-kpis">${side("B")}</div>
        <div class="mpc-charts">
          ${R.theta ? chart([{ name: "bearing A", x: R.theta, y: R.FA }, { name: "bearing B", x: R.theta, y: R.FB }], { title: "Radial bearing loads over one revolution [N]", xl: "crank angle [°]", yl: "N", zeroY: 1 }).svg : ""}
          ${chart([{ name: `ISO VG ${R.params.oil_VG}`, x: V.T, y: V.nu }, { name: "ν1 rated (κ = 1)", x: [V.T[0], V.T[V.T.length - 1]], y: [V.nu1, V.nu1], dash: 1 },
            { name: "operating point", x: [R.params.oil_temp_C], y: [R.A.life.nu], dots: 1, col: "#d03b3b" }], { title: "Oil viscosity vs temperature [mm²/s] (κ = ν / ν1)", xl: "°C", yl: "mm²/s" }).svg}
        </div>${cand("A")}${cand("B")}
        <details><summary>Full report (same as <code>python bearing.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcBrRun").onclick = run;
  $("mpcBrReset").onclick = () => { $("mpcBrF").outerHTML = form("mpcBrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); $("mpcBrA").value = D0.bearing_A; $("mpcBrB").value = D0.bearing_B; $("mpcBrUse").value = "1"; $("mpcBrVG").value = D0.oil_VG; $("mpcBrCl").value = D0.cleanliness; run(); };
  $("mpcBrCsv").onclick = () => { const R = window.__mpcBr; if (!R || !R.theta) return; csv("bearing_loads.csv", ["theta_deg", "Fr_A_N", "Fr_B_N"], R.theta.map((t, i) => [t, R.FA[i], R.FB[i]])); };
  run();
}

/* ------------------------------------------------------------------ item 8: M5 gear design */
async function item8(host) {
  const C = await catalog(), D0 = C.gear_default;
  const skip = new Set(["material1", "material2"]);
  const mopt = (sel) => C.gear_materials.map((m) => `<option ${m === sel ? "selected" : ""}>${esc(m)}</option>`).join("");
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M5 – cylindrical gear pair (spur / helical)</h2><span class="sub">same code as <code>tools/gear.py</code> · ISO 21771 geometry · ISO 6336 style capacity (simplified – check the standard) · example values</span></div>
    <div class="mpc-form"><label class="mpc-f mpc-fw"><span>material pinion</span><select id="mpcGrM1">${mopt(D0.material1)}</select></label>
      <label class="mpc-f mpc-fw"><span>material wheel</span><select id="mpcGrM2">${mopt(D0.material2)}</select></label></div>
    ${form("mpcGrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { a_w: "a_w mm (null = from x1 + x2)", pin_diameter_mm: "pin diameter mm (null = standard)" })}
    <div class="mpc-btns"><button class="btn" id="mpcGrRun">Calculate</button><button class="btn ghost" id="mpcGrReset">Example values</button></div></div>
    <div id="mpcGrOut"></div>`;
  const run = async () => {
    const out = $("mpcGrOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcGrF"); p.material1 = $("mpcGrM1").value; p.material2 = $("mpcGrM2").value;
      const R = await api("/api/mpc/gear", { params: p }), g = R.geometry, F = R.forces, P = R.params;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const sw = R.sweep_x1, inv = R.involute;
      const circ = (r, n = 90) => ({ x: [...Array(n + 1).keys()].map((i) => r * Math.cos(i / n * Math.PI / 2)), y: [...Array(n + 1).keys()].map((i) => r * Math.sin(i / n * Math.PI / 2)) });
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("Ratio u · a_w", f(g.u, 4) + " · " + f(g.aw, 3) + " mm")}${k("d1 / d2", f(g.d1, 3) + " / " + f(g.d2, 3) + " mm")}${k("ε_α · ε_β · ε_γ", f(g.ea, 3) + " · " + f(g.eb, 3) + " · " + f(g.eg, 3), g.ea < 1.2)}
          ${k("Ft · Fr · Fa", f(F.Ft, 0) + " · " + f(F.Fr, 0) + " · " + f(F.Fa, 0) + " N")}${k("v", f(F.v, 2) + " m/s")}${k("σ_H", f(R.factors.sH, 0) + " MPa")}
          ${k("S_H (pitting)", f(R.gear1.SH, 2), R.gear1.SH < P.SHmin)}${k("S_F pinion / wheel", f(R.gear1.SF, 2) + " / " + f(R.gear2.SF, 2), Math.min(R.gear1.SF, R.gear2.SF) < P.SFmin)}
          ${k("tip thickness s_a1 / mn", f(g.sa1 / P.mn, 2), g.sa1 < 0.25 * P.mn)}${k("undercut", P.x1 >= g.xmin1 && P.x2 >= g.xmin2 ? "none" : "UNDERCUT", P.x1 < g.xmin1 || P.x2 < g.xmin2)}</div>
        <div class="mpc-charts">
          ${chart([{ name: "S_H", x: sw.x1, y: sw.SH }, { name: "S_F pinion", x: sw.x1, y: sw.SF1 }, { name: "S_F wheel", x: sw.x1, y: sw.SF2 }, { name: "ε_α", x: sw.x1, y: sw.ea, dash: 1 },
            { name: "now (S_F pinion)", x: [P.x1], y: [R.gear1.SF], dots: 1, col: "#d03b3b" }], { title: "Effect of the pinion profile shift x1 (x2 fixed)", xl: "x1", yl: "" }).svg}
          ${chart([{ name: "pinion involute", x: inv["1"].map((q) => q[0]), y: inv["1"].map((q) => q[1]) }, { name: "base circle", ...circ(g.db1 / 2), dash: 1 },
            { name: "tip circle", ...circ(g.da1 / 2), dash: 1 }, { name: "root circle", ...circ(g.df1 / 2), dash: 1 }], { title: "Pinion: involute flank between base and tip circle [mm]", xl: "x", yl: "y", equal: 1 }).svg}
        </div>
        <div class="mpc-tw"><table><thead><tr><th></th><th>Y_F</th><th>Y_S</th><th>σ_F MPa</th><th>σ_FE MPa</th><th>S_F</th><th>S_H</th><th>W_k (k)</th><th>W_k with allowances</th><th>over pins D_M → M</th></tr></thead><tbody>
          ${[1, 2].map((i) => { const q = R["gear" + i], m = R.manufacturing[i]; return `<tr><td>${i === 1 ? "pinion" : "wheel"}</td><td>${f(q.ff.YF, 3)}</td><td>${f(q.ff.YS, 3)}</td><td>${f(q.sF, 0)}</td><td>${f(q.sFE, 0)}</td><td><b>${f(q.SF, 2)}</b></td><td><b>${f(q.SH, 2)}</b></td><td>${f(m.Wk_nom, 3)} (${m.k})</td><td>${f(m.Wk_lo, 3)} … ${f(m.Wk_up, 3)}</td><td>${f(m.pins.DM, 2)} → ${f(m.pins.M, 3)}</td></tr>`; }).join("")}</tbody></table></div>
        <p class="hint">K_V ${f(R.factors.KV, 3)} · K_Fβ ${f(R.factors.KFbeta, 3)} · Z_H ${f(R.factors.ZH, 3)} · Z_E ${f(R.factors.ZE, 1)} · Z_ε ${f(R.factors.Zeps, 3)} · Z_β ${f(R.factors.Zbeta, 3)} · Y_β ${f(R.factors.Ybeta, 3)} ·
          backlash j_n ${f(R.backlash.jn_min_um, 0)} … ${f(R.backlash.jn_max_um, 0)} µm</p>
        <details><summary>Full report (same as <code>python gear.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcGrRun").onclick = run;
  $("mpcGrReset").onclick = () => { $("mpcGrF").outerHTML = form("mpcGrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); $("mpcGrM1").value = D0.material1; $("mpcGrM2").value = D0.material2; run(); };
  run();
}

/* ------------------------------------------------------------------ item 9: M5b bevel gears */
async function item9(host) {
  const C = await catalog(), D0 = C.bevel_default;
  const sel = { kind: ["spiral", "straight"], hand1: ["left", "right"], rotation1: ["cw", "ccw"] };
  const skip = new Set(["material1", "material2", "kind", "hand1", "rotation1"]);
  const mopt = (v) => C.gear_materials.map((m) => `<option ${m === v ? "selected" : ""}>${esc(m)}</option>`).join("");
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M5b – bevel gears (straight / spiral)</h2><span class="sub">same code as <code>tools/bevel.py</code> · ISO 23509 style geometry · ISO 10300 style capacity via virtual gears (simplified – check) · example values</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f"><span>${k}</span><select id="mpcBv_${k}">${o.map((v) => `<option ${v === D0[k] ? "selected" : ""}>${v}</option>`).join("")}</select></label>`).join("")}
      <label class="mpc-f mpc-fw"><span>material pinion</span><select id="mpcBvM1">${mopt(D0.material1)}</select></label>
      <label class="mpc-f mpc-fw"><span>material wheel</span><select id="mpcBvM2">${mopt(D0.material2)}</select></label></div>
    ${form("mpcBvF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { x1: "x1 (null = Gleason style)", back_face_to_apex_mm: "back face to apex mm (null)" })}
    <div class="mpc-btns"><button class="btn" id="mpcBvRun">Calculate</button><button class="btn ghost" id="mpcBvReset">Example values</button></div></div>
    <div id="mpcBvOut"></div>`;
  const run = async () => {
    const out = $("mpcBvOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcBvF");
      Object.keys(sel).forEach((k) => { p[k] = $("mpcBv_" + k).value; });
      p.material1 = $("mpcBvM1").value; p.material2 = $("mpcBvM2").value;
      const R = await api("/api/mpc/bevel", { params: p }), g = R.geometry, F = R.forces, P = R.params;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const deg = (r) => f(r * 180 / Math.PI, 3) + "°";
      // cone sketch in the axial plane: apex at origin, pinion axis along +x, wheel axis along +y (Sigma 90 drawn generally)
      const S = P.Sigma_deg * Math.PI / 180, d1 = g.delta1, Re = g.Re, b = P.b;
      const ray = (ang, r) => [r * Math.cos(ang), r * Math.sin(ang)];
      const pitchPt = ray(d1, Re), toePt = ray(d1, Re - b);
      const sketch = chart([
        { name: "pitch cone line (common)", x: [0, pitchPt[0]], y: [0, pitchPt[1]] },
        { name: "pinion axis", x: [0, Re * 1.1], y: [0, 0], dash: 1 },
        { name: "wheel axis", x: [0, Re * 1.1 * Math.cos(S)], y: [0, Re * 1.1 * Math.sin(S)], dash: 1 },
        { name: "face width (toe → heel)", x: [toePt[0], pitchPt[0]], y: [toePt[1], pitchPt[1]], wid: 6, col: "#d03b3b" },
        { name: "pinion back cone", x: [pitchPt[0], pitchPt[0] + 15 * Math.cos(d1 - Math.PI / 2) * -1], y: [pitchPt[1], pitchPt[1] + 15 * Math.sin(d1 - Math.PI / 2) * -1] },
      ], { title: "Pitch cones in the axial plane (apex at 0) [mm]", xl: "pinion axis", yl: "", equal: 1, h: 300 }).svg;
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("u · δ1 / δ2", f(g.u, 4) + " · " + deg(g.delta1) + " / " + deg(g.delta2))}${k("Re · Rm", f(g.Re, 2) + " · " + f(g.Rm, 2) + " mm")}${k("b / Re", f(P.b / g.Re, 3), !g.checks.b_le_Re_3)}
          ${k("m_mn · x1", f(g.mmn, 4) + " · " + f(g.x1, 4))}${k("ε_vα · ε_vβ", f(g.eps_va, 3) + " · " + f(g.eps_vb, 3), g.eps_va < 1.1)}
          ${k("Ft · pinion Fa / Fr", f(F.Ft, 0) + " · " + f(F.Fa1, 0) + " / " + f(F.Fr1, 0) + " N")}${k("pinion thrust", F.Fa1 > 0 ? "away from apex (good)" : "TOWARDS apex", F.Fa1 < 0)}
          ${k("σ_H · S_H", f(R.sH, 0) + " MPa · " + f(R.gear1.SH, 2), R.gear1.SH < P.SHmin)}${k("S_F pinion / wheel", f(R.gear1.SF, 2) + " / " + f(R.gear2.SF, 2), Math.min(R.gear1.SF, R.gear2.SF) < P.SFmin)}</div>
        <div class="mpc-charts">${sketch}
          ${R.cutter ? chart([{ name: "spiral angle along the face", x: [P.b, P.b / 2, 0], y: [R.cutter.beta_toe, R.cutter.beta_mean, R.cutter.beta_heel] }], { title: `Spiral angle toe → heel with cutter r_c ${f(R.cutter.rc_mm, 1)} mm [°]`, xl: "distance from heel [mm]", yl: "°" }).svg : ""}</div>
        <div class="mpc-tw"><table><thead><tr><th></th><th>pitch angle</th><th>face angle</th><th>root angle</th><th>d_e</th><th>d_ae</th><th>crown to apex</th><th>h_ae / h_fe</th><th>chordal thickness / height (outer)</th><th>Y_F · Y_S</th><th>S_F</th></tr></thead><tbody>
          ${[1, 2].map((i) => { const c = R.chordal[i], q = R["gear" + i]; return `<tr><td>${i === 1 ? "pinion" : "wheel"}</td><td>${deg(g["delta" + i])}</td><td>${deg(g["face_angle" + i])}</td><td>${deg(g["root_angle" + i])}</td><td>${f(g["de" + i], 3)}</td><td>${f(g["dae" + i], 3)}</td><td>${f(g["crown_to_apex" + i], 3)}</td><td>${f(g["hae" + i], 3)} / ${f(g["hfe" + i], 3)}</td><td>${f(c.s_chord_outer, 3)} / ${f(c.h_chord_outer, 3)}</td><td>${f(q.ff.YF, 3)} · ${f(q.ff.YS, 3)}</td><td><b>${f(q.SF, 2)}</b></td></tr>`; }).join("")}</tbody></table></div>
        <p class="hint">Virtual gears: z_v ${f(g.zv1, 2)} / ${f(g.zv2, 2)}, z_vn ${f(g.zvn1, 2)} / ${f(g.zvn2, 2)} · K_V ${f(R.KV, 3)} · K_Hβ ${f(R.KHbeta, 3)} · Z_H ${f(R.ZH, 3)} · Z_ε ${f(R.Zeps, 3)} · Z_β ${f(R.Zbeta, 3)} · Z_K ${f(P.ZK, 2)} · wheel Fa / Fr ${f(F.Fa2, 0)} / ${f(F.Fr2, 0)} N</p>
        <details><summary>Full report (same as <code>python bevel.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcBvRun").onclick = run;
  $("mpcBvReset").onclick = () => { $("mpcBvF").outerHTML = form("mpcBvF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); Object.keys(sel).forEach((k) => { $("mpcBv_" + k).value = D0[k]; }); $("mpcBvM1").value = D0.material1; $("mpcBvM2").value = D0.material2; run(); };
  run();
}

/* ------------------------------------------------------------------ item 10: M5c worm gears */
async function item10(host) {
  const C = await catalog(), D0 = C.worm_default;
  const sel = { profile: ["ZI", "ZA", "ZN", "ZK"], lubricant: ["mineral", "polyglycol"], fan: [true, false] };
  const skip = new Set(["wheel_material", "profile", "lubricant", "fan"]);
  const mopt = (v) => C.worm_materials.map((m) => `<option ${m === v ? "selected" : ""}>${esc(m)}</option>`).join("");
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M5c – worm gears (cylindrical worm, 90°)</h2><span class="sub">same code as <code>tools/worm.py</code> · DIN 3975 geometry · ISO/TS 14521 / DIN 3996 style capacity (simplified – check) · example values</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f"><span>${k}</span><select id="mpcWm_${k}">${o.map((v) => `<option value="${v}" ${v === D0[k] ? "selected" : ""}>${v}</option>`).join("")}</select></label>`).join("")}
      <label class="mpc-f mpc-fw"><span>wheel material</span><select id="mpcWmM">${mopt(D0.wheel_material)}</select></label></div>
    ${form("mpcWmF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { J_W: "J_W (null = typical)", A_housing_m2: "A housing m² (null = estimate)" })}
    <div class="mpc-btns"><button class="btn" id="mpcWmRun">Calculate</button><button class="btn ghost" id="mpcWmReset">Example values</button></div></div>
    <div id="mpcWmOut"></div>`;
  const run = async () => {
    const out = $("mpcWmOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcWmF");
      p.profile = $("mpcWm_profile").value; p.lubricant = $("mpcWm_lubricant").value; p.fan = $("mpcWm_fan").value === "true";
      p.wheel_material = $("mpcWmM").value;
      const R = await api("/api/mpc/worm", { params: p }), g = R.geometry, e = R.eff, F = R.forces, L = R.losses, P = R.params;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const yn = (b) => (b ? "yes" : "no");
      const saf = [["pitting S_H", R.SH, P.SHmin], ["wear S_W", R.SW, P.SWmin], ["root worn S_F", R.SF_worn, P.SFmin],
                   ["deflection S_δ", R.Sd, P.Sdmin], ["temperature θ_lim/θ", R.ST, 1.0]];
      const mx = Math.max(3, ...saf.map((s) => s[1]));
      const bars = saf.map(([n, v, m]) => `<tr><td>${n}</td><td style="width:60%"><div style="background:${v >= m ? "#2e8b57" : "#d03b3b"};height:12px;width:${Math.min(100, v / mx * 100)}%"></div></td><td><b>${f(v, 2)}</b> (min ${f(m, 2)})</td></tr>`).join("");
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("i · γ", f(g.u, 2) + " · " + f(g.gamma_deg, 3) + "°")}${k("q · x2", f(g.q, 2) + " · " + f(g.x2, 4), !g.checks.x2_range)}
          ${k("v_g · μ_z", f(g.vg, 3) + " m/s · " + f(e.mu, 4))}${k("η worm / wheel driving", f(e.eta_z, 4) + " / " + f(e.eta_rev, 4))}
          ${k("self-locking rest / running", yn(e.self_locking_static) + " / " + yn(e.self_locking_dynamic))}
          ${k("T2 · Ft2 = Fa1 · Fr", f(F.T2, 1) + " N m · " + f(F.Ft2, 0) + " · " + f(F.Fr, 0) + " N")}
          ${k("P_V · η total", f(L.PV, 0) + " W · " + f(L.eta_total, 4))}${k("oil sump θ", f(L.theta_S, 1) + " °C (limit " + f(P.theta_lim, 0) + ")", !L.ok)}
          ${k("thermal power limit", f(R.P_thermal, 2) + " kW", R.P_thermal < P.P1_kW)}${k("σ_Hm / σ_HG", f(R.sHm, 0) + " / " + f(R.sHG, 0) + " MPa")}
          ${k("wear in Lh", f(R.dW, 3) + " mm (limit " + f(R.dWlim, 3) + ")", R.SW < P.SWmin)}</div>
        <div class="mpc-tw"><table><thead><tr><th>criterion</th><th>safety</th><th></th></tr></thead><tbody>${bars}</tbody></table></div>
        <div class="mpc-charts">
          ${chart([{ name: "oil sump", x: R.curve_P.map((c) => c[0]), y: R.curve_P.map((c) => c[1]) },
                   { name: "limit", x: [R.curve_P[0][0], R.curve_P[R.curve_P.length - 1][0]], y: [P.theta_lim, P.theta_lim], dash: 1, col: "#d03b3b" }],
                  { title: "Oil-sump temperature vs input power [°C]", xl: "P1 [kW]", yl: "°C" }).svg}
          ${chart([{ name: "worm driving", x: R.curve_n.map((c) => c[1]), y: R.curve_n.map((c) => c[2]) },
                   { name: "wheel driving", x: R.curve_n.map((c) => c[1]), y: R.curve_n.map((c) => c[3]) }],
                  { title: "Mesh efficiency vs sliding velocity (input speed varied)", xl: "v_g [m/s]", yl: "η" }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th></th><th>reference d</th><th>tip d_a</th><th>root d_f</th><th>outside</th><th>length / width</th><th>other</th></tr></thead><tbody>
          <tr><td>worm</td><td>${f(g.d1, 3)}</td><td>${f(g.da1, 3)}</td><td>${f(g.df1, 3)}</td><td>–</td><td>b1 ≥ ${f(Math.max(g.b1_geo, g.b1_emp), 1)}</td><td>lead p_z ${f(g.pz, 4)} · over wires D_M ${f(R.wires.DM, 4)} → M ${f(R.wires.M, 3)}</td></tr>
          <tr><td>wheel</td><td>${f(g.d2, 3)}</td><td>${f(g.da2, 3)}</td><td>${f(g.df2, 3)}</td><td>${f(g.dae2, 3)}</td><td>b2 ${f(P.b2, 1)} (rec. ${f(g.b2_rec, 1)}, max ${f(g.b2_max, 1)})</td><td>throat radius ${f(g.rk, 3)} · wrap ${f(g.wrap_deg, 1)}°</td></tr></tbody></table></div>
        <div class="mpc-tw"><table><thead><tr><th>z1</th><th>i</th><th>γ</th><th>η worm drv</th><th>η wheel drv</th><th>self-locking rest / running</th></tr></thead><tbody>
          ${R.starts.map((s) => `<tr><td>${s.z1}</td><td>${f(s.i, 2)}</td><td>${f(s.gamma_deg, 2)}°</td><td>${f(s.eta, 3)}</td><td>${f(s.eta_rev, 3)}</td><td>${yn(s.sl_static)} / ${yn(s.sl_dyn)}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint">μ_0T ${f(e.mu0T, 4)} · Y_S ${f(e.YS, 3)} · Y_R ${f(e.YR, 3)} · Y_W ${f(e.YW, 2)} · p*_m ${f(R.p_star_m, 3)} · E_red ${f(R.E_red, 0)} MPa · Z_N ${f(R.ZN, 3)} · Z_v ${f(R.Zv, 3)} · Z_S ${f(R.ZS, 3)} · s* ${f(R.s_star, 2)} · J_W ${R.JW.toExponential(2)} · τ_F ${f(R.tF, 1)} (worn ${f(R.tF_worn, 1)}) MPa · deflection ${f(R.delta_m, 4)} mm · Ft1 = Fa2 ${f(F.Ft1, 0)} N</p>
        <details><summary>Full report (same as <code>python worm.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcWmRun").onclick = run;
  $("mpcWmReset").onclick = () => { $("mpcWmF").outerHTML = form("mpcWmF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); Object.keys(sel).forEach((k) => { $("mpcWm_" + k).value = String(D0[k]); }); $("mpcWmM").value = D0.wheel_material; run(); };
  run();
}

/* ------------------------------------------------------------------ item 11: M5d gear manufacturing */
async function item11(host) {
  const C = await catalog(), D0 = C.gearmfg_default;
  const sel = { hand: ["right", "left"], hob_hand: ["right", "left"] };
  const skip = new Set(["hand", "hob_hand"]);
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M5d – cylindrical gear manufacturing (process chain, times, case depth, cost)</h2><span class="sub">same code as <code>tools/gearmfg.py</code> · hobbing / shaping / power skiving · carburising · generating / profile grinding · ISO 1328 · typical data – check</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f"><span>${k.replace("_", " ")}</span><select id="mpcGm_${k}">${o.map((v) => `<option ${v === D0[k] ? "selected" : ""}>${v}</option>`).join("")}</select></label>`).join("")}</div>
    ${form("mpcGmF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { CHD_target: "CHD target mm (null = 0.15..0.20 mn)" })}
    <div class="mpc-btns"><button class="btn" id="mpcGmRun">Calculate</button><button class="btn ghost" id="mpcGmReset">Example values</button></div></div>
    <div id="mpcGmOut"></div>`;
  const run = async () => {
    const out = $("mpcGmOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcGmF");
      Object.keys(sel).forEach((k) => { p[k] = $("mpcGm_" + k).value; });
      const R = await api("/api/mpc/gearmfg", { params: p }), w = R.work, hs = R.hob_setup, ht = R.hob_time, P = R.params;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const best = R.chains.find((c) => c.meets);
      const ops = [["hobbing", ht.t_total_min], ["shaping", R.shaping.t_total_min], ["power skiving", R.skiving.t_total_min],
                   ["generating grinding", R.gen_grinding.t_total_min], ["profile grinding", R.prof_grinding.t_total_min]];
      const mx = Math.max(...ops.map((o) => o[1]));
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("d · da · df", f(w.d, 3) + " · " + f(w.da, 3) + " · " + f(w.df, 3) + " mm")}${k("blank mass", f(w.mass_kg, 2) + " kg")}
          ${k("hob γ0 · swivel η", f(hs.gamma0_deg, 3) + "° · " + f(hs.eta_deg, 3) + "°")}${k("n0 · table", f(hs.n0, 0) + " · " + f(hs.n_table, 2) + " rpm")}
          ${k("hobbing cut / total", f(ht.t_cut_min, 2) + " / " + f(ht.t_total_min, 2) + " min")}
          ${k("feed marks · flats", f(1000 * R.feed_mark, 2) + " · " + f(1000 * R.envelope, 2) + " µm", 1000 * R.feed_mark > 10)}
          ${k("h_max (Hoffmeister)", f(R.hmax, 3) + " mm", R.hmax > 0.25)}
          ${k("CHD final / green", f(R.chd.CHD_final, 3) + " / " + f(R.chd.CHD_green, 3) + " mm")}${k("carburising", f(R.carb_h, 2) + " h at " + f(P.T_carb_C, 0) + " °C")}
          ${k("Q'w profile grinding", f(R.prof_grinding.Qw, 2) + " mm³/(mm s)", R.prof_grinding.Qw > 10)}
          ${k("best chain", best ? best.chain.replace(/_/g, " ") : "none meets grade " + P.grade_required, !best)}${k("cost · time", best ? f(best.cost, 2) + " € · " + f(best.t_min, 2) + " min" : "–")}</div>
        <div class="mpc-tw"><table><thead><tr><th>operation</th><th>time per part</th><th></th></tr></thead><tbody>
          ${ops.map(([n, t]) => `<tr><td>${n}</td><td style="width:60%"><div style="background:#3b7dd8;height:12px;width:${t / mx * 100}%"></div></td><td><b>${f(t, 2)}</b> min</td></tr>`).join("")}</tbody></table></div>
        <div class="mpc-charts">
          ${chart([{ name: "hobbing time [min]", x: R.curve_fa.map((c) => c[0]), y: R.curve_fa.map((c) => c[1]) },
                   { name: "feed marks [µm / 10]", x: R.curve_fa.map((c) => c[0]), y: R.curve_fa.map((c) => c[2] / 10) }],
                  { title: "Axial feed: time vs feed-mark depth", xl: "f_a [mm/rev]", yl: "" }).svg}
          ${chart([{ name: "total case (Harris)", x: R.curve_carb.map((c) => c[0]), y: R.curve_carb.map((c) => c[1]) },
                   { name: "effective CHD", x: R.curve_carb.map((c) => c[0]), y: R.curve_carb.map((c) => c[2]) }],
                  { title: `Carburising at ${f(P.T_carb_C, 0)} °C: case depth vs time [mm]`, xl: "t [h]", yl: "mm" }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>process chain</th><th>time min</th><th>cost €</th><th>best grade</th><th>result</th></tr></thead><tbody>
          ${R.chains.map((c) => `<tr class="${c.meets ? "" : "mpc-bad"}"><td>${esc(c.chain.replace(/_/g, " "))}</td><td>${f(c.t_min, 2)}</td><td>${f(c.cost, 2)}</td><td>${c.best_grade}</td><td>${c.meets ? "meets grade " + P.grade_required : (c.feasible ? "does not meet" : "stock too large for honing alone")}</td></tr>`).join("")}</tbody></table></div>
        <p class="hint">ISO 1328-1 grade ${P.grade_required}: f_pT ${f(R.tol.fpT, 1)} · F_pT ${f(R.tol.FpT, 1)} · F_αT ${f(R.tol.FalphaT, 1)} · F_βT ${f(R.tol.FbetaT, 1)} · F_rT ${f(R.tol.FrT, 1)} µm · shaping ${f(R.shaping.nDH, 0)} strokes/min · skiving tool helix ${f(R.skiving.beta0_deg, 2)}°, work / tool ${f(R.skiving.nw, 0)} / ${f(R.skiving.n0, 0)} rpm · grinding wheel ${f(R.gen_grinding.ns, 0)} rpm · hob cost ${f(R.hob_cost, 3)} €/part · induction depth 10 / 100 kHz ${f(R.ind10, 2)} / ${f(R.ind100, 2)} mm</p>
        <details><summary>Full report (same as <code>python gearmfg.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcGmRun").onclick = run;
  $("mpcGmReset").onclick = () => { $("mpcGmF").outerHTML = form("mpcGmF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); Object.keys(sel).forEach((k) => { $("mpcGm_" + k).value = D0[k]; }); run(); };
  run();
}

/* ------------------------------------------------------------------ item 12: M6 cams */
async function item12(host) {
  const C = await catalog(), D0 = C.cam_default;
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M6 – disc cam with translating roller follower</h2><span class="sub">same code as <code>tools/cam.py</code> · motion laws VDI 2143 style (${C.cam_laws.join(", ")}) · segments must add up to 360° · example values</span></div>
    ${form("mpcCmF", D0, { segments: "segments [{kind rise|dwell|return, law, beta}]" })}
    <div class="mpc-btns"><button class="btn" id="mpcCmRun">Calculate</button><button class="btn ghost" id="mpcCmReset">Example values</button></div></div>
    <div id="mpcCmOut"></div>`;
  const run = async () => {
    const out = $("mpcCmOut"); busy(out, "calculating …");
    try {
      const R = await api("/api/mpc/cam", { params: readForm("mpcCmF") }), g = R.geometry, J = R.jump, P = R.params, S = R.series;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const th = S.map((r) => r.th), col = (n) => S.map((r) => r[n]);
      const ang = []; for (let i = 0; i <= 72; i++) ang.push(i * 5 * Math.PI / 180);
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("pressure angle max / min", f(g.phi_max, 2) + "° / " + f(g.phi_min, 2) + "°", !g.phi_ok)}
          ${k("smallest convex radius pitch / profile", f(g.rho_pitch_min_convex, 2) + " / " + f(g.rho_cam_min_convex, 2) + " mm", g.undercut)}
          ${k("concave profile radius min", g.rho_concave_min ? f(g.rho_concave_min, 2) + " mm" : "none (convex)")}
          ${k("R0 min (φ, curvature)", R.R0_min ? f(R.R0_min, 2) + " mm" : "–")}
          ${k("contact force min", f(J.Fc_min, 1) + " N at " + f(J.theta_Fc_min, 1) + "°", J.lift_off)}
          ${k("preload needed / actual", f(J.F0_min_no_jump, 1) + " / " + f(P.F0_spring, 1) + " N", J.F0_min_no_jump > P.F0_spring)}
          ${k("normal force max", f(R.Fn_max, 0) + " N")}${k("camshaft torque", f(R.T_min, 2) + " … " + f(R.T_max, 2) + " N m")}
          ${k("Hertz p_max · S", f(R.contact.p_max, 0) + " MPa · " + f(R.contact.S_H, 2), R.contact.S_H < 1)}
          ${k("roller speed max", f(R.contact.n_roller_max, 0) + " rpm")}
          ${k("cutter / wheel", (R.gouge_cutter ? "cutter gouges" : "cutter OK") + " / " + (R.gouge_wheel ? "wheel gouges" : "wheel OK"), R.gouge_cutter || R.gouge_wheel)}</div>
        <div class="mpc-charts">
          ${chart([{ name: "cam profile", x: col("px"), y: col("py") }, { name: "pitch curve", x: col("qx"), y: col("qy"), dash: 1 },
                   { name: "base circle", x: ang.map((a) => P.R0 * Math.cos(a)), y: ang.map((a) => P.R0 * Math.sin(a)), dash: 1, col: "#999" }],
                  { title: "Cam profile and pitch curve [mm] (θ = 0 at +y, cam turns ccw)", equal: 1, h: 360 }).svg}
          ${chart([{ name: "s [mm]", x: th, y: col("s") }, { name: "v [m/s ×10]", x: th, y: S.map((r) => r.v * 10) }, { name: "a [m/s² /2]", x: th, y: S.map((r) => r.a / 2) }],
                  { title: "Lift s, velocity v, acceleration a over the cam angle", xl: "θ [°]", yl: "" }).svg}
          ${chart([{ name: "contact force Fc [N]", x: th, y: col("Fc") }, { name: "zero", x: [0, 360], y: [0, 0], dash: 1, col: "#d03b3b" }],
                  { title: "Contact force along the follower axis (below 0 = lift-off)", xl: "θ [°]", yl: "N", zeroY: 1 }).svg}
          ${chart([{ name: "pressure angle φ [°]", x: th, y: col("phi") }, { name: "+allow", x: [0, 360], y: [P.phi_allow, P.phi_allow], dash: 1, col: "#d03b3b" },
                   { name: "−allow", x: [0, 360], y: [-P.phi_allow, -P.phi_allow], dash: 1, col: "#d03b3b" }],
                  { title: "Pressure angle over the cam angle", xl: "θ [°]", yl: "°" }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>law</th><th>C_v</th><th>C_a</th><th>C_j</th></tr></thead><tbody>
          ${Object.entries(R.laws).map(([n, c]) => `<tr><td>${n}</td><td>${f(c.Cv, 3)}</td><td>${f(c.Ca, 3)}</td><td>${f(c.Cj, 1)}</td></tr>`).join("")}</tbody></table></div>
        <details><summary>Full report (same as <code>python cam.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcCmRun").onclick = run;
  $("mpcCmReset").onclick = () => { $("mpcCmF").outerHTML = form("mpcCmF", D0); run(); };
  run();
}

/* ------------------------------------------------------------------ item 13: M7 bolted joints */
async function item13(host) {
  const C = await catalog(), D0 = C.bolt_default, O = C.bolt_options;
  const sel = { thread: O.threads, cls: O.classes, joint: ["DSV", "ESV"], part_material: O.materials, nut_side_material: O.materials,
                tightening: O.tightening, Rz: O.Rz, rolled: ["before", "after"] };
  const skip = new Set(Object.keys(sel));
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M7 – bolted joint (VDI 2230 style, R0–R13)</h2><span class="sub">same code as <code>tools/bolt.py</code> · concentric single-bolt joint · simplified – check · example values</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f ${k === "tightening" || k.includes("material") ? "mpc-fw" : ""}"><span>${k.replace(/_/g, " ")}</span><select id="mpcBt_${k}">${o.map((v) => `<option ${v === D0[k] ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`).join("")}</div>
    ${form("mpcBtF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))))}
    <div class="mpc-btns"><button class="btn" id="mpcBtRun">Calculate</button><button class="btn ghost" id="mpcBtReset">Example values</button></div></div>
    <div id="mpcBtOut"></div>`;
  const run = async () => {
    const out = $("mpcBtOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcBtF");
      Object.keys(sel).forEach((k) => { p[k] = $("mpcBt_" + k).value; });
      const R = await api("/api/mpc/bolt", { params: p }), P = R.params, t = R.tight, D = R.diagram;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const saf = [["preload F_Mmax / F_Mzul ≤ 1", 1 / R.pre.utilisation, 1], ["yield S_F", R.ws.S_F, P.S_F_req], ["fatigue S_D", R.fat.S_D, P.S_D_req],
                   ["surface pressure S_p", R.sp.S_p, P.S_p_req], ["slip S_G", R.slip.S_G, P.S_slip_req]];
      const mx = Math.max(3, ...saf.map((s) => Math.min(s[1], 10)));
      const bars = saf.map(([n, v, m]) => `<tr><td>${n}</td><td style="width:60%"><div style="background:${v >= m ? "#2e8b57" : "#d03b3b"};height:12px;width:${Math.min(100, v / mx * 100)}%"></div></td><td><b>${f(v, 2)}</b> (min ${f(m, 2)})</td></tr>`).join("");
      const kN = (x) => f(x / 1000, 1) + " kN";
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("A_S · d2 · d3", f(R.g.AS, 2) + " mm² · " + f(R.g.d2, 3) + " · " + f(R.g.d3, 3))}${k("c_S · c_P", f(R.lf.cS / 1000, 0) + " · " + f(R.lf.cP / 1000, 0) + " kN/mm")}
          ${k("Φ_K · Φ_n", f(R.lf.Phi_K, 4) + " · " + f(R.lf.Phi_n, 4))}${k("cone model", R.plate.model + " (D_A,Gr " + f(R.plate.DA_Gr, 1) + ")")}
          ${k("F_Kerf · F_Z", kN(R.req.FKerf) + " · " + kN(R.emb.FZ))}${k("F_Mmin · F_Mmax", kN(R.pre.FMmin_req) + " · " + kN(R.pre.FMmax_req))}
          ${k("F_Mzul · utilisation", kN(t.FMzul) + " · " + f(R.pre.utilisation, 3), !R.ok.preload)}${k("tightening torque M_A", f(t.MA, 1) + " N m")}
          ${k("σ_red · σ_a", f(R.ws.sigma_red, 0) + " · " + f(R.fat.sigma_a, 1) + " MPa")}${k("p under head", f(R.sp.p_working, 0) + " / " + f(R.sp.pG, 0) + " MPa", !R.ok.pressure)}
          ${k("F_KRmin", kN(R.slip.FKRmin), R.slip.opens)}${k("smallest size passing all", R.select ? R.select.join(" ") : "none", !R.select)}</div>
        <div class="mpc-tw"><table><thead><tr><th>check</th><th>safety</th><th></th></tr></thead><tbody>${bars}</tbody></table></div>
        <div class="mpc-charts">
          ${chart([{ name: "bolt", x: D.bolt.map((q) => q[0]), y: D.bolt.map((q) => q[1] / 1000) }, { name: "clamped parts", x: D.plate.map((q) => q[0]), y: D.plate.map((q) => q[1] / 1000) },
                   { name: "F_SA (bolt share of F_A)", x: [D.fS, D.fS], y: [D.FV / 1000, (D.FV + D.FSA) / 1000], wid: 4, col: "#d03b3b" }],
                  { title: `Joint diagram at the lowest residual preload ${kN(D.FV)} [kN over µm]`, xl: "elongation / compression [µm]", yl: "kN", zeroY: 1 }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>tightening method</th><th>α_A</th><th>F_Mmax / F_Mzul</th><th>S_G</th><th>all checks</th></tr></thead><tbody>
          ${R.methods.map((m) => `<tr class="${m.all_ok ? "" : "mpc-bad"}"><td>${esc(m.method)}</td><td>${f(m.alpha_A, 1)}</td><td>${f(m.util, 3)}</td><td>${f(m.S_G, 2)}</td><td>${m.all_ok ? "pass" : "fail"}</td></tr>`).join("")}</tbody></table></div>
        <div class="mpc-tw"><table><thead><tr><th>thread</th><th>8.8 F_Mzul / M_A</th><th>10.9 F_Mzul / M_A</th><th>12.9 F_Mzul / M_A</th></tr></thead><tbody>
          ${R.torque_table.map((r) => `<tr><td>${r.thread}</td>${["8.8", "10.9", "12.9"].map((c) => `<td>${kN(r[c][0])} / ${f(r[c][1], 1)} N m</td>`).join("")}</tr>`).join("")}</tbody></table>
          <p class="hint">Torque table with the current friction μ_G,min ${f(P.muG_min, 2)} / μ_K,min ${f(P.muK_min, 2)} and ν ${f(P.nu, 2)}.</p></div>
        <details><summary>Full report (same as <code>python bolt.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcBtRun").onclick = run;
  $("mpcBtReset").onclick = () => { $("mpcBtF").outerHTML = form("mpcBtF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); Object.keys(sel).forEach((k) => { $("mpcBt_" + k).value = D0[k]; }); run(); };
  run();
}

/* ------------------------------------------------------------------ item 14: M8 springs */
async function item14(host) {
  const C = await catalog(), D0 = C.spring_default, O = C.spring_options;
  const sel = { material: O.materials, seating: O.seating, ends: ["closed and ground", "closed not ground", "open"], shot_peened: [true, false], dynamic: [true, false] };
  const skip = new Set(Object.keys(sel));
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M8 – helical compression spring (EN 13906-1 style)</h2><span class="sub">same code as <code>tools/spring.py</code> · default = follower spring of the M6 cam · typical material data – check · example values</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f ${k === "material" || k === "seating" ? "mpc-fw" : ""}"><span>${k.replace(/_/g, " ")}</span><select id="mpcSp_${k}">${o.map((v) => `<option value="${v}" ${v === D0[k] ? "selected" : ""}>${esc(String(v))}</option>`).join("")}</select></label>`).join("")}</div>
    ${form("mpcSpF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { req: "requirements {F1, F2, stroke, D, Da_max}" })}
    <div class="mpc-btns"><button class="btn" id="mpcSpRun">Calculate</button><button class="btn ghost" id="mpcSpReset">Example values</button></div></div>
    <div id="mpcSpOut"></div>`;
  const run = async () => {
    const out = $("mpcSpOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcSpF");
      Object.keys(sel).forEach((k) => { const v = $("mpcSp_" + k).value; p[k] = v === "true" ? true : v === "false" ? false : v; });
      const R = await api("/api/mpc/spring", { params: p }), g = R.geometry, F = R.forces, P = R.params, ft = R.fat, H = R.haigh;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const yn = (b) => (b ? "OK" : "NOT OK");
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("R_m · τ_zul", f(R.Rm, 0) + " · " + f(R.static.tau_zul, 0) + " MPa")}${k("rate R", f(F.R, 4) + " N/mm")}
          ${k("F1 · F2 · F_solid", f(F.F1, 1) + " · " + f(F.F2, 1) + " · " + f(F.Fc, 1) + " N")}${k("index w · k", f(g.w, 2) + " · " + f(g.k, 4), !R.ok.index_w)}
          ${k("L_c · L_n,min · L2", f(g.Lc, 2) + " · " + f(g.Ln_min, 2) + " · " + f(P.L2, 1) + " mm", !R.ok.min_gaps)}
          ${k("τ at L2 · S", f(R.static.tau_2, 0) + " MPa · " + f(R.static.S_2, 2), !R.ok.static)}${k("solid-safe", R.static.block_safe ? "yes" : "no", !R.static.block_safe)}
          ${k("fatigue stroke / allowed · S", f(ft.tau_kH, 0) + " / " + f(ft.tau_kH_lim, 0) + " MPa · " + f(ft.S_fat, 2), !R.ok.fatigue)}
          ${k("buckling", R.buck.sK ? "s_K " + f(R.buck.sK, 1) + " mm" : "none (stable)", !R.buck.safe)}
          ${k("natural frequency", f(R.freq.fe, 0) + " Hz = " + f(R.freq.ratio, 1) + " × f_exc", !R.ok.surge)}
          ${k("Da · mass", f(g.Da, 2) + " mm · " + f(g.mass_kg * 1000, 1) + " g", !R.ok.outer_diameter)}
          ${k("lightest design for req.", R.design.best ? "d " + f(R.design.best.d, 1) + ", n " + f(R.design.best.n, 1) + ", L0 " + f(R.design.best.L0, 1) : "none", !R.design.best)}</div>
        <div class="mpc-charts">
          ${chart([{ name: "characteristic", x: R.char.map((c) => c[0]), y: R.char.map((c) => c[1]) },
                   { name: "working stroke", x: [F.s1, F.s2], y: [F.F1, F.F2], wid: 5, col: "#d03b3b" }],
                  { title: "Spring characteristic F over deflection s (dots: L1, L2, solid) [N]", xl: "s [mm]", yl: "N", zeroY: 1 }).svg}
          ${chart([{ name: "Haigh limit (1e7)", x: H.limit.map((c) => c[0]), y: H.limit.map((c) => c[1]) }, { name: "static limit 0.5 Rm", x: H.static.map((c) => c[0]), y: H.static.map((c) => c[1]), dash: 1, col: "#999" },
                   { name: "τ_kO = τ_kU", x: H.diag.map((c) => c[0]), y: H.diag.map((c) => c[1]), dash: 1, col: "#bbb" },
                   { name: "working stroke", x: [H.point[0], H.point[0]], y: [H.point[0], H.point[1]], wid: 5, col: "#d03b3b" }],
                  { title: "Haigh diagram (corrected stresses) [MPa]", xl: "τ_kU [MPa]", yl: "τ_kO [MPa]", zeroY: 1 }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>d</th><th>n</th><th>R</th><th>L0</th><th>L2</th><th>mass g</th><th>S static</th><th>S fatigue</th><th>f_e Hz</th><th>result</th></tr></thead><tbody>
          ${R.design.candidates.map((c) => `<tr class="${c.ok ? "" : "mpc-bad"}"><td>${f(c.d, 1)}</td><td>${f(c.n, 1)}</td><td>${f(c.R, 2)}</td><td>${f(c.L0, 1)}</td><td>${f(c.L2, 1)}</td><td>${f(c.mass_g, 0)}</td><td>${f(c.S_2, 2)}</td><td>${f(c.S_fat, 2)}</td><td>${f(c.fe, 0)}</td><td>${c.ok ? "OK" : "fails: " + c.fails.join(", ")}</td></tr>`).join("")}</tbody></table>
          <p class="hint">Design from requirements: required rate ${f(R.design.R_req, 3)} N/mm · checks: ${Object.entries(R.ok).map(([n, v]) => n + " " + yn(v)).join(" · ")}</p></div>
        <details><summary>Full report (same as <code>python spring.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcSpRun").onclick = run;
  $("mpcSpReset").onclick = () => { $("mpcSpF").outerHTML = form("mpcSpF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k)))); Object.keys(sel).forEach((k) => { $("mpcSp_" + k).value = String(D0[k]); }); run(); };
  run();
}

/* ------------------------------------------------------------------ item 15: M9 belts, chains, couplings */
async function item15(host) {
  const C = await catalog(), D0 = C.drive_default, O = C.drive_options;
  const sel = { load_class: O.load_class, vb_section: O.vb_section, sy_profile: O.sy_profile, ch_chain: O.ch_chain, cp_spider: O.cp_spider };
  const skip = new Set(Object.keys(sel));
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M9 – belt, chain and coupling drives (DIN 7753 / ISO 5292, ISO 13050, ISO 606, DIN 740-2 style)</h2><span class="sub">same code as <code>tools/drive.py</code> · default = compressor drive of M2 (3 kW 2930 → 1450 rpm) · typical catalogue data – check · example values</span></div>
    <div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f ${k === "load_class" ? "mpc-fw" : ""}"><span>${k.replace(/_/g, " ")}</span><select id="mpcDr_${k}">${o.map((v) => `<option value="${esc(v)}" ${v === D0[k] ? "selected" : ""}>${esc(String(v))}</option>`).join("")}</select></label>`).join("")}</div>
    ${form("mpcDrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { cp_T_harm: "cp T harm [[order, N m], …]" })}
    <div class="mpc-btns"><button class="btn" id="mpcDrRun">Calculate</button><button class="btn ghost" id="mpcDrReset">Example values</button></div></div>
    <div id="mpcDrOut"></div>`;
  const run = async () => {
    const out = $("mpcDrOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcDrF");
      Object.keys(sel).forEach((k) => { p[k] = $("mpcDr_" + k).value; });
      const R = await api("/api/mpc/drive", { params: p }), V = R.vbelt, Y = R.sync, K = R.chain, B = R.cp_sel, T = R.vb_table;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const all = (o) => Object.values(o).every(Boolean);
      const fails = (o) => Object.entries(o).filter(([, v]) => !v).map(([n]) => n).join(", ");
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("service factor · P_B", f(V.c2, 2) + " · " + f(V.P_B, 2) + " kW")}
          ${k("V-belt " + V.section, V.z + " × Ld " + f(V.Ld, 0) + " · d " + f(V.d1, 0) + "/" + f(V.d2, 0), !all(V.ok))}
          ${k("a · wrap · v", f(V.a, 1) + " mm · " + f(V.beta1_deg, 1) + "° · " + f(V.v, 1) + " m/s")}
          ${k("per belt P_N · c1 · c3", f(V.P_N, 2) + " kW · " + f(V.c1, 3) + " · " + f(V.c3, 3))}
          ${k("T0 · shaft load run / stand", f(V.T0, 0) + " N · " + f(V.F_shaft, 0) + " / " + f(V.F_shaft_static, 0) + " N")}
          ${k("test: deflection · force · span f", f(V.test_deflection, 1) + " mm · " + f(V.F_test, 1) + " N · " + f(V.f_span, 0) + " Hz")}
          ${k("belt life (fatigue / expected)", f(V.L_h_fat, 0) + " / " + f(V.L_h, 0) + " h", V.L_h < 25000)}
          ${k("sync " + Y.profile, (Y.b ? Y.b + " mm wide" : "no width") + " · " + f(Y.Lp, 0) + " mm belt · n2 " + f(Y.n2, 0), !all(Y.ok))}
          ${k("chain " + K.chain + " ×" + K.strands, f(K.P_allow, 2) + " / " + f(K.P_req, 2) + " kW · " + K.lub, !all(K.ok))}
          ${k("coupling (direct drive)", R.coupling.best ? B.size + " · f_e " + f(B.f_e, 0) + " Hz · start " + f(B.T_S, 0) + "/" + f(B.T_Kmax, 0) + " N m" : "no size passes", !R.coupling.best)}
          ${k("cheapest V-belt", T.best ? T.best.section + " " + T.best.d1 + "/" + T.best.d2 + " × " + T.best.z : "none", !T.best)}</div>
        <div class="mpc-charts">
          ${chart(R.vb_curves.map((c) => ({ name: V.section + " d " + c.d, x: c.n, y: c.P }))
                 .concat([{ name: "required per belt", x: [P0(R).n1, P0(R).n1], y: [0, V.P_B / (V.z * V.c1 * V.c3)], wid: 4, col: "#d03b3b" }]),
                  { title: "V-belt rating P_N per belt (180°, reference length) [kW]", xl: "small pulley speed [rpm]", yl: "kW", zeroY: 1 }).svg}
          ${chart([{ name: "link plate", x: R.ch_curves.n, y: R.ch_curves.H1 }, { name: "roller-bushing", x: R.ch_curves.n, y: R.ch_curves.H2 },
                   { name: "required per strand", x: [R.ch_curves.n[0], R.ch_curves.n[R.ch_curves.n.length - 1]], y: [K.P_req / ({ 1: 1, 2: 1.7, 3: 2.5, 4: 3.3 })[K.strands], K.P_req / ({ 1: 1, 2: 1.7, 3: 2.5, 4: 3.3 })[K.strands]], dash: 1, col: "#d03b3b" }],
                  { title: "Chain " + K.chain + ", z1 " + K.z1 + ": rating per strand [kW] (operating speed " + f(P0(R).n1, 0) + " rpm)", xl: "small sprocket speed [rpm]", yl: "kW", zeroY: 1 }).svg}
          ${chart([{ name: "magnification V", x: R.cp_curve.f, y: R.cp_curve.V }, { name: "compressor orders", x: B.orders.map((o) => o.f), y: B.orders.map((o) => o.V), dots: 1, col: "#d03b3b" }],
                  { title: "Coupling " + B.size + ": magnification over frequency (f_e " + f(B.f_e, 0) + " Hz)", xl: "f [Hz]", yl: "V", zeroY: 1 }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>drive</th><th>result</th><th>n2 rpm</th><th>η drive</th><th>η motor</th><th>P electric kW</th><th>kWh / year</th><th>€ / year</th><th>shaft load N</th></tr></thead><tbody>
          ${R.compare.map((c) => `<tr class="${c.ok ? "" : "mpc-bad"}"><td>${esc(c.drive)}</td><td>${c.ok ? "OK" : "NOT OK"}</td><td>${f(c.n2, 0)}</td><td>${f(c.eta_drive, 3)}</td><td>${f(c.eta_motor, 3)}</td><td>${f(c.P_el_kW, 3)}</td><td>${f(c.kWh_year, 0)}</td><td>${f(c.eur_year, 0)}</td><td>${f(c.F_shaft, 0)}</td></tr>`).join("")}</tbody></table>
          <p class="hint">V-belt: ${all(V.ok) ? "all checks OK" : "fails: " + fails(V.ok)} · synchronous belt: ${all(Y.ok) ? "all checks OK" : "fails: " + fails(Y.ok)} · chain: ${all(K.ok) ? "all checks OK" : "fails: " + fails(K.ok)}</p></div>
        <div class="mpc-tw"><table><thead><tr><th>coupling</th><th>T_KN</th><th>T_Kmax</th><th>T_KW</th><th>C_dyn N m/rad</th><th>f_e Hz</th><th>start torque</th><th>max vib. util.</th><th>result</th></tr></thead><tbody>
          ${R.coupling.rows.map((r) => `<tr class="${all(r.ok) ? "" : "mpc-bad"}"><td>${r.size}</td><td>${f(r.T_KN, 0)}</td><td>${f(r.T_Kmax, 0)}</td><td>${f(r.T_KW, 1)}</td><td>${f(r.C_dyn, 0)}</td><td>${f(r.f_e, 0)}</td><td>${f(r.T_S, 1)}</td><td>${f(Math.max(...r.orders.map((o) => o.util)), 2)}</td><td>${all(r.ok) ? "OK" : "fails: " + fails(r.ok)}</td></tr>`).join("")}</tbody></table></div>
        <details><summary>Full report (same as <code>python drive.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  const P0 = (R) => R.params;
  $("mpcDrRun").onclick = run;
  $("mpcDrReset").onclick = () => { $("mpcDrF").outerHTML = form("mpcDrF", Object.fromEntries(Object.entries(D0).filter(([k]) => !skip.has(k))), { cp_T_harm: "cp T harm [[order, N m], …]" }); Object.keys(sel).forEach((k) => { $("mpcDr_" + k).value = String(D0[k]); }); run(); };
  run();
}

/* ------------------------------------------------------------------ item 16: M10 tolerances, fits, stack-up */
async function item16(host) {
  const C = await catalog(), D0 = C.tol_default;
  const calc0 = { D: 25, hole: "H7", shaft: "g6" };
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M10 – tolerances and fits (ISO 286), interference fit (DIN 7190 style), stack-up, position</h2><span class="sub">same code as <code>tools/tol.py</code> · ISO 286 table values (check against the standard) · default = M2 compressor seats, TDC gap stack, head bolts · example values</span></div>
    <div class="mpc-form"><label class="mpc-f"><span>fit calculator: nominal size D mm</span><input type="number" step="any" id="mpcTl_D" value="${calc0.D}"></label>
      <label class="mpc-f"><span>hole zone (e.g. H7, K6, brg_od, dev:+10/-5)</span><input type="text" id="mpcTl_hole" value="${calc0.hole}"></label>
      <label class="mpc-f"><span>shaft zone (e.g. g6, js5, brg_bore)</span><input type="text" id="mpcTl_shaft" value="${calc0.shaft}"></label></div>
    ${form("mpcTlF", D0)}
    <div class="mpc-btns"><button class="btn" id="mpcTlRun">Calculate</button><button class="btn ghost" id="mpcTlReset">Example values</button></div></div>
    <div id="mpcTlOut"></div>`;
  const run = async () => {
    const out = $("mpcTlOut"); busy(out, "calculating …");
    try {
      const p = readForm("mpcTlF");
      const fitIn = { D: Number($("mpcTl_D").value), hole: $("mpcTl_hole").value, shaft: $("mpcTl_shaft").value };
      const R = await api("/api/mpc/tol", { params: p, fit: fitIn }), F = R.fit, S = R.stack, Pr = R.press, G = R.gdt, st = R.params.stack;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const box = (x0, x1, a, b) => ({ x: [x0, x1, x1, x0, x0], y: [a, a, b, b, a] });
      const zmax = Math.max(F.ES, F.es, 0), zmin = Math.min(F.EI, F.ei, 0);
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("hole " + esc(F.hole) + " (µm)", f(F.ES, 1) + " / " + f(F.EI, 1))}${k("shaft " + esc(F.shaft) + " (µm)", f(F.es, 1) + " / " + f(F.ei, 1))}
          ${k("clearance min … max", f(F.C_min, 1) + " … " + f(F.C_max, 1) + " µm")}${k("fit type", F.type)}
          ${k("P(interference)", f(100 * F.P_interference, 1) + " %")}
          ${k("stack " + esc(st.name) + ": WC", f(S.G_min_wc, 3) + " … " + f(S.G_max_wc, 3) + " mm", !S.ok.worst_case)}
          ${k("stack RSS · Cpk", f(S.G_min_rss, 3) + " … " + f(S.G_max_rss, 3) + " mm · " + f(S.Cpk, 2), !S.ok.rss)}
          ${k("press fit " + esc(R.params.pressfit.fit) + ": slip safety", f(Pr.S_slip, 2) + " (T " + f(Pr.lo.T_Nm, 1) + " N m)", !Pr.ok.slip_at_U_min)}
          ${k("hub stress · S · shrink ΔT", f(Pr.hi.sig_v_hub, 0) + " MPa · " + f(Pr.hi.S_hub, 2) + " · " + f(Pr.dT_shrink, 0) + " K", !Pr.ok.hub_at_U_max)}
          ${k("position (floating / fixed)", "Ø " + f(G.T_floating, 2) + " / " + f(G.T_fixed, 2) + " mm")}</div>
        <div class="mpc-charts">
          ${chart([Object.assign({ name: "hole " + F.hole, col: "#2a6fdb", wid: 2.5 }, box(0, 1, F.EI, F.ES)), Object.assign({ name: "shaft " + F.shaft, col: "#d03b3b", wid: 2.5 }, box(1.4, 2.4, F.ei, F.es)),
                   { name: "zero line (nominal " + f(F.D, 1) + " mm)", x: [-0.2, 2.6], y: [0, 0], dash: 1, col: "#888" }],
                  { title: "Tolerance zones (µm from nominal size)", xl: "", yl: "µm", zeroY: 1 }).svg}
          ${chart([{ name: "Monte Carlo 20 000 (normal parts)", x: R.hist.x, y: R.hist.n }, { name: "LSL", x: [st.LSL, st.LSL], y: [0, Math.max(...R.hist.n)], dash: 1, col: "#d03b3b" },
                   { name: "USL", x: [st.USL, st.USL], y: [0, Math.max(...R.hist.n)], dash: 1, col: "#d03b3b" },
                   { name: "worst case", x: [S.G_min_wc, S.G_min_wc, S.G_max_wc, S.G_max_wc], y: [Math.max(...R.hist.n) * 0.5, 0, 0, Math.max(...R.hist.n) * 0.5], col: "#999" }],
                  { title: "Stack-up " + st.name + ": distribution of the closing dimension [mm]", xl: "mm", yl: "count", zeroY: 1 }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>feature</th><th>D</th><th>fit</th><th>hole µm</th><th>shaft µm</th><th>C min … max µm</th><th>type</th><th>hot C min … max</th><th>need</th><th>cold / hot</th></tr></thead><tbody>
          ${R.fits.map((r) => `<tr class="${r.ok_cold && r.ok_hot ? "" : "mpc-bad"}"><td>${esc(r.name)}</td><td>${f(r.D, 0)}</td><td>${esc(r.hole)}/${esc(r.shaft)}</td><td>${f(r.EI, 0)} / ${f(r.ES, 0)}</td><td>${f(r.ei, 0)} / ${f(r.es, 0)}</td><td>${f(r.C_min, 1)} … ${f(r.C_max, 1)}</td><td>${r.type}</td><td>${f(r.C_min_hot, 1)} … ${f(r.C_max_hot, 1)}</td><td>${r.need[0] === null ? "–" : r.need[0]} … ${r.need[1] === null ? "–" : r.need[1]}</td><td>${r.ok_cold ? "OK" : "NOT OK"} / ${r.ok_hot ? "OK" : "NOT OK"}</td></tr>`).join("")}</tbody></table>
          <p class="hint">Fits with the same clearance range as the calculator fit (fit finder, hole basis): ${R.finder.map((r) => esc(r.pair) + (r.preferred ? " (preferred)" : "")).join(" · ") || "none"}</p></div>
        <div class="mpc-tw"><table><thead><tr><th>stack item</th><th>sign</th><th>nominal mm</th><th>± mm</th><th>contribution</th></tr></thead><tbody>
          ${st.items.map((it, i) => `<tr><td>${esc(it[0])}</td><td>${it[1] > 0 ? "+" : "−"}</td><td>${f(it[2], 3)}</td><td>${f(it[3], 3)}</td><td>${f(S.contrib[i][1], 1)} %</td></tr>`).join("")}</tbody></table>
          <p class="hint">nominal ${f(S.G, 3)} mm · worst case ±${f(S.WC, 3)} · RSS ±${f(S.RSS, 3)} · modified RSS ±${f(S.MRSS, 3)} · Monte Carlo normal σ ${f(S.mc.normal.sd, 4)} mm, ${f(S.mc.normal.out_ppm, 0)} ppm out · uniform σ ${f(S.mc.uniform.sd, 4)} mm, ${f(S.mc.uniform.out_ppm, 0)} ppm out</p></div>
        <details><summary>Full report (same as <code>python tol.py run</code>)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcTlRun").onclick = run;
  $("mpcTlReset").onclick = () => { $("mpcTlF").outerHTML = form("mpcTlF", D0); $("mpcTl_D").value = calc0.D; $("mpcTl_hole").value = calc0.hole; $("mpcTl_shaft").value = calc0.shaft; run(); };
  run();
}

/* ------------------------------------------------------------------ item 17: M11 welds, frames, pressure parts */
async function item17(host) {
  const C = await catalog(), W0 = C.weld_default, V0 = C.vessel_default, O = C.weld_options;
  const wsel = { steel: O.steels, fat_toe: O.fat, fat_throat: O.fat, fat_shear: O.fat };
  const vsel = { material: O.vmat, joint: O.joint, head: O.heads };
  const wskip = new Set(Object.keys(wsel)), vskip = new Set(Object.keys(vsel));
  const selects = (pre, sel, D) => `<div class="mpc-form">${Object.entries(sel).map(([k, o]) => `<label class="mpc-f mpc-fw"><span>${k.replace(/_/g, " ")}</span><select id="${pre}${k}">${o.map((v) => `<option value="${esc(v)}" ${v === D[k] ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`).join("")}</div>`;
  const wform = () => form("mpcWdF", Object.fromEntries(Object.entries(W0).filter(([k]) => !wskip.has(k))));
  const vform = () => form("mpcVsF", Object.fromEntries(Object.entries(V0).filter(([k]) => !vskip.has(k))));
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M11 – welds and frames (EN 1993-1-8 / -1-9 style) and air receiver (EN 13445 / ASME VIII-1 style)</h2><span class="sub">same code as <code>tools/weld.py</code> and <code>tools/vessel.py</code> · default = motor bracket post and air receiver of the M2 compressor · typical values – check · example values</span></div>
    <h3>Weld group and fatigue</h3>${selects("mpcWd_", wsel, W0)}${wform()}
    <h3>Pressure vessel (air receiver)</h3>${selects("mpcVs_", vsel, V0)}${vform()}
    <div class="mpc-btns"><button class="btn" id="mpcWvRun">Calculate</button><button class="btn ghost" id="mpcWvReset">Example values</button></div></div>
    <div id="mpcWvOut"></div>`;
  const run = async () => {
    const out = $("mpcWvOut"); busy(out, "calculating …");
    try {
      const w = readForm("mpcWdF"), v = readForm("mpcVsF");
      Object.keys(wsel).forEach((k) => { w[k] = $("mpcWd_" + k).value; });
      Object.keys(vsel).forEach((k) => { v[k] = $("mpcVs_" + k).value; });
      const R = await api("/api/mpc/weldvessel", { weld: w, vessel: v }), F = R.fillet, M = R.member, Fa = R.fatigue, S = R.vessel, D = S.D;
      const k = (lab, val, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${val}</b></div>`;
      const rules = F.rules, rok = rules.ok_min && rules.ok_max && rules.ok_len;
      const lines = R.weld_params.lines;
      const geo = lines.map((l, i) => ({ name: i === 0 ? "weld lines" : "", x: [l[0], l[2]], y: [l[1], l[3]], wid: 3, col: "#2a6fdb" }));
      const nf = (N) => (N === null || N === Infinity || N > 1e300 ? "∞" : Number(N).toExponential(2));
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("weld utilisation (directional / simplified)", f(F.util_dir, 3) + " / " + f(F.util_simple, 3), F.util_dir > 1)}
          ${k("worst point σ⊥ · τ∥ · σ_eq", f(F.worst.sigma_perp, 1) + " · " + f(F.worst.tau_par, 1) + " · " + f(F.worst.sigma_eq, 1) + " MPa")}
          ${k("throat rules a_min … a_max", f(rules.a_min, 2) + " … " + f(rules.a_max, 2) + " mm", !rok)}
          ${k("member utilisation", f(M.util, 3), M.util > 1)}
          ${k("fatigue damage toe · throat · shear", f(Fa.D.toe, 3) + " · " + f(Fa.D.throat, 3) + " · " + f(Fa.D.shear, 3), !Fa.ok)}
          ${k("receiver volume", f(D.rv.V_req_L, 0) + " L req. → " + f(D.V, 0) + " L")}
          ${k("shell · head plate", f(D.t_shell, 1) + " · " + f(D.t_head, 1) + " mm (req. " + f(D.e_shell, 2) + " · " + f(D.e_head, 2) + ")")}
          ${k("length · mass", f(D.L_total, 0) + " mm · " + f(D.m_kg, 0) + " kg")}
          ${k("nozzle area req. / avail.", f(S.nozzle.A_req, 1) + " / " + f(S.nozzle.A_av, 1) + " mm²", !S.nozzle.ok)}
          ${k("test pressure · stress", f(S.test.P_test_bar, 2) + " bar · " + f(S.test.sigma_test, 0) + " MPa", !S.test.ok)}
          ${k("PS·V · category", f(S.cat.PV, 0) + " bar·L · " + S.cat.PED + (S.cat.SPVD ? " (SPVD applies)" : ""))}
          ${k("pressure-cycle fatigue n / N", f(S.fatigue.n, 0) + " / " + nf(S.fatigue.N), !S.fatigue.ok)}
          ${k("safety valve flow area", f(S.sv.A_req_mm2, 2) + " mm² (" + f(S.sv.Qm_kgh, 1) + " kg/h)")}</div>
        <div class="mpc-charts">
          ${chart(geo.concat([{ name: "worst point", x: [F.worst.x], y: [F.worst.y], dots: 1, r: 6, col: "#d03b3b" }, { name: "centroid", x: [F.G.xc], y: [F.G.yc], dots: 1, col: "#999" }]),
                  { title: "Weld group (mm) – worst point of the directional check", xl: "x [mm]", yl: "y [mm]", equal: 1 }).svg}
          ${chart([{ name: "utilisation (directional)", x: F.points.map((p, i) => i), y: F.points.map((p) => p.util_dir) }, { name: "simplified", x: F.points.map((p, i) => i), y: F.points.map((p) => p.util_simple), dash: 1 }],
                  { title: "Utilisation along the welds (check points, line by line)", xl: "check point", yl: "utilisation", zeroY: 1 }).svg}
          ${chart(R.curves.map((c) => ({ name: c.name, x: c.x, y: c.y })).concat([{ name: "load blocks (γ·Δσ)", x: R.fat_points.map((p) => p.logN), y: R.fat_points.map((p) => p.logS), dots: 1, col: "#d03b3b" }]),
                  { title: "S-N curves: log10 Δσ [MPa] over log10 N (flat = cut-off)", xl: "log10 N", yl: "log10 Δσ" }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>fatigue block</th><th>n</th><th>Δσ toe</th><th>Δσ throat</th><th>Δτ throat</th><th>N toe</th><th>N throat</th><th>N shear</th></tr></thead><tbody>
          ${Fa.blocks.map((b) => `<tr><td>${esc(b.name)}</td><td>${Number(b.n).toExponential(2)}</td><td>${f(b.ds_toe, 2)}</td><td>${f(b.ds_w, 2)}</td><td>${f(b.dt_w, 2)}</td><td>${nf(b.N_toe)}</td><td>${nf(b.N_throat)}</td><td>${nf(b.N_shear)}</td></tr>`).join("")}</tbody></table></div>
        <div class="mpc-tw"><table><thead><tr><th>head type</th><th>e req. mm</th><th>plate mm</th><th>depth mm</th><th>volume L</th><th>overall length mm</th><th>mass kg</th></tr></thead><tbody>
          ${R.heads.map((h) => `<tr class="${h.head === R.vessel_params.head ? "mpc-sel" : ""}"><td>${esc(h.head)}</td><td>${f(h.e, 2)}</td><td>${f(h.t, 1)}</td><td>${f(h.depth, 0)}</td><td>${f(h.V_head, 1)}</td><td>${f(h.L_total, 0)}</td><td>${f(h.m_kg, 0)}</td></tr>`).join("")}</tbody></table></div>
        <details><summary>Full weld report (same as <code>python weld.py run</code>)</summary><pre class="mpc-pre">${esc(R.weld_report)}</pre></details>
        <details><summary>Full vessel report (same as <code>python vessel.py run</code>)</summary><pre class="mpc-pre">${esc(R.vessel_report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcWvRun").onclick = run;
  $("mpcWvReset").onclick = () => {
    $("mpcWdF").outerHTML = wform(); $("mpcVsF").outerHTML = vform();
    Object.keys(wsel).forEach((k) => { $("mpcWd_" + k).value = W0[k]; }); Object.keys(vsel).forEach((k) => { $("mpcVs_" + k).value = V0[k]; }); run();
  };
  run();
}

/* ------------------------------------------------------------------ item 18: M12 optimisation workflows */
async function item18(host) {
  const C = await catalog(), D0 = C.optflow_default;
  host.innerHTML = `<div class="card"><div class="card-head"><h2>M12 – optimisation workflow: virtual CAE → Latin hypercube → Kriging → expected-improvement infill → verified optimum</h2><span class="sub">same code as <code>tools/optflow.py</code> · default = 2.5 m compressor package base frame on isolation mounts (M11) · templates for SOLIDWORKS / Ansys / Abaqus / Adams / MATLAB: <code>python optflow.py export</code> · example values</span></div>
    ${form("mpcOfF", D0)}
    <div class="mpc-btns"><button class="btn" id="mpcOfRun">Run workflow (about 15 s)</button><button class="btn ghost" id="mpcOfReset">Example values</button></div></div>
    <div id="mpcOfOut"></div>`;
  const run = async () => {
    const out = $("mpcOfOut"); busy(out, "running the DOE, the surrogate models and the infill loop on the virtual CAE …");
    try {
      const R = await api("/api/mpc/optflow", { params: readForm("mpcOfF") }), P = R.params, R0 = R.R0, B = R.best;
      const k = (lab, v, bad) => `<div class="mpc-kpi ${bad ? "mpc-bad" : ""}"><span>${lab}</span><b>${v}</b></div>`;
      const lim = P.limits, ok0 = Object.values(R.g0).every((v) => v <= 1e-3);
      const resp = (x) => `${f(x.mass_kg, 2)} kg · ${f(x.f_rigid, 2)} / ${f(x.f_bend, 1)} Hz · sag ${f(x.sag, 2)} mm`;
      const doe = R.points.filter((p) => p.doe), inf = R.points.filter((p) => !p.doe);
      const sc = (pts, feas) => pts.filter((p) => p.feasible === feas);
      out.innerHTML = `<div class="card"><div class="mpc-kpis">
          ${k("current design h · a · k", P.x0.map((v) => f(v, 1)).join(" · "))}${k("current responses", resp(R0), !ok0)}
          ${k("optimum h · a · k", B ? B[0].map((v) => f(v, 1)).join(" · ") : "no feasible design", !B)}
          ${B ? k("optimum responses", resp(B[1])) : ""}
          ${k("mass saving", B ? f(100 * (1 - B[1].mass_kg / R0.mass_kg), 1) + " %" : "–")}
          ${k("solver calls", R.calls + " (DOE " + P.doe_n + " + infill)")}
          ${k("limits", "f_rigid ≤ " + lim.f_rigid_max + " · f_bend ≥ " + lim.f_bend_min + " Hz · sag ≤ " + lim.sag_max + " mm")}</div>
        <div class="mpc-charts">
          ${chart([{ name: "best feasible mass", x: R.hist.filter((h) => h.best_mass).map((h) => h.calls), y: R.hist.filter((h) => h.best_mass).map((h) => h.best_mass) },
                   { name: "current design", x: [P.doe_n, R.calls], y: [R0.mass_kg, R0.mass_kg], dash: 1, col: "#999" }],
                  { title: "Convergence: best feasible mass over solver calls [kg]", xl: "solver calls", yl: "kg" }).svg}
          ${chart([{ name: "DOE feasible", x: sc(doe, true).map((p) => p.x[0]), y: sc(doe, true).map((p) => p.R.f_bend), dots: 1, col: "#2a6fdb" },
                   { name: "DOE infeasible", x: sc(doe, false).map((p) => p.x[0]), y: sc(doe, false).map((p) => p.R.f_bend), dots: 1, col: "#bbb" },
                   { name: "infill points", x: inf.map((p) => p.x[0]), y: inf.map((p) => p.R.f_bend), dots: 1, col: "#d03b3b" },
                   { name: "f_bend limit", x: [P.vars[0][1], P.vars[0][2]], y: [lim.f_bend_min, lim.f_bend_min], dash: 1, col: "#d03b3b" }],
                  { title: "Evaluated designs: first bending frequency over RHS height h", xl: "h [mm]", yl: "Hz" }).svg}
          ${chart([{ name: "mass [kg]", x: R.cut.map((c) => c.h), y: R.cut.map((c) => c.mass_kg) }, { name: "f_bend [Hz]", x: R.cut.map((c) => c.h), y: R.cut.map((c) => c.f_bend) },
                   { name: "f_bend limit", x: [R.cut[0].h, R.cut[R.cut.length - 1].h], y: [lim.f_bend_min, lim.f_bend_min], dash: 1, col: "#d03b3b" }],
                  { title: "Cut through the optimum (a, k fixed): true solver over h", xl: "h [mm]", yl: "kg · Hz", zeroY: 1 }).svg}</div>
        <div class="mpc-tw"><table><thead><tr><th>no</th><th>source</th><th>h</th><th>a</th><th>k</th><th>mass kg</th><th>f_rigid Hz</th><th>f_bend Hz</th><th>sag mm</th><th>σ MPa</th><th>feasible</th></tr></thead><tbody>
          ${R.points.map((p, i) => `<tr class="${p.feasible ? "" : "mpc-bad"}"><td>${i + 1}</td><td>${p.doe ? "DOE" : "infill"}</td><td>${f(p.x[0], 1)}</td><td>${f(p.x[1], 1)}</td><td>${f(p.x[2], 1)}</td><td>${f(p.R.mass_kg, 2)}</td><td>${f(p.R.f_rigid, 2)}</td><td>${f(p.R.f_bend, 1)}</td><td>${f(p.R.sag, 2)}</td><td>${f(p.R.sigma, 1)}</td><td>${p.feasible ? "yes" : "no"}</td></tr>`).join("")}</tbody></table></div>
        <details><summary>Workflow report (same as <code>python optflow.py run</code>, without the direct reference search)</summary><pre class="mpc-pre">${esc(R.report)}</pre></details></div>`;
    } catch (e) { err(out, e); }
  };
  $("mpcOfRun").onclick = run;
  $("mpcOfReset").onclick = () => { $("mpcOfF").outerHTML = form("mpcOfF", D0); run(); };
  run();
}

/* ------------------------------------------------------------------ item switch */
let current = Q.get("mpcitem") || "1";
const built = {};
function showItem(n, arg) {
  n = String(n); current = n;
  document.querySelectorAll("[data-mpcitem]").forEach((b) => b.classList.toggle("active", b.dataset.mpcitem === n));
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18"].forEach((i) => { const el = $("mpcItem" + i); if (el) el.hidden = i !== n; });
  const host = $("mpcItem" + n);
  if (!built[n] || arg) { built[n] = true; ({ 1: item1, 2: item2, 3: item3, 4: item4, 5: item5, 6: item6, 7: item7, 8: item8, 9: item9, 10: item10, 11: item11, 12: item12, 13: item13, 14: item14, 15: item15, 16: item16, 17: item17, 18: item18 })[n](host, arg); }
}
document.querySelectorAll("[data-mpcitem]").forEach((b) => b.addEventListener("click", () => showItem(b.dataset.mpcitem)));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "mpc") showItem(current); };
if (location.hash === "#mpc") setTimeout(() => showItem(current), 0);
