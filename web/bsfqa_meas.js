/* Ball screw + guide factory – item 5 quality: "other measurements, live" – 11 measuring stations as generators + renderers.
 * Each station: { id, t, part, chars, how, gauge, std, gen(U) → data, view(data, frac) → html }. frac 0 … 1 = progress of the live measurement.
 * The generators use the reference product data of item 1 (web/bsfprod_data.js). ALL VALUES ARE EXAMPLES – check the standard + your customer. */
import { BS, BN, LG, LB, ACC_LG } from "./bsfprod_data.js";
import { preloadTorque } from "./bsfmfg_calc.js";
import { CHAR_BY_ID } from "./bsfqa_data.js";
import { gauss, mean, sdev, caseDepth, hrcToHv, hvToHrc, roughness, circleFit, torqueTol, torqueEval, parClass, hwClass, lsq } from "./bsfqa_calc.js";
import { plot, range } from "./bsfqa_chart.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2), f3 = (v) => (+v).toFixed(3);
const okb = (b) => `<b class="${b ? "bf5-ok" : "bf5-nok"}">${b ? "OK" : "NOK"}</b>`;
const tbl = (cols, rows) => `<div class="table-wrap"><table class="bf5-tbl bf5-small"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const cut = (pts, frac) => pts.slice(0, Math.max(2, Math.ceil(pts.length * frac)));
export const TP0 = preloadTorque().Tp;   // 0.292 N·m (item 2 formula)

export const STATIONS = [
  /* ------------------------------------------------------------------ 1 run-out */
  { id: "runout", t: "Shaft run-out", part: "BS", chars: ["BS-RO", "BS-JRO"], std: "ISO 1101 (circular run-out), ISO 3408-3 (t5 journal run-out)",
    how: "The screw turns between centres (or the thread lies in 2 V-blocks with balls). A dial gauge / laser sensor touches the surface at 5 stations. Circular run-out = TIR = max − min reading in one turn. Bow (bent shaft) gives a sine with 1 wave per turn; form error (out-of-round) gives 2, 3 … waves.",
    gauge: "centres or V-blocks on a granite plate, dial gauge 1 µm or laser / LVDT sensor (QC-LED run-out station, BS-STH press sensor)",
    gen(U) {
      const st = [[25, "journal fixed end", 8], [200, "thread", 20], [425, "thread middle", 20], [650, "thread", 20], [980, "journal floating end", 8]];
      const bow = 6 + U() * 6, ph = U() * 6.283;
      return st.map(([x, n, lim]) => { const e = (lim === 8 ? 0.35 : 1) * bow * Math.sin(Math.PI * Math.min(x, 1000 - x) / 1000 * 1.6) / 2 + gauss(U) * 0.6, f2a = 0.3 + U() * 0.4, f3a = 0.2 * U(), p2 = U() * 6.283;
        const pts = []; for (let a = 0; a <= 360; a += 5) { const r = a * Math.PI / 180; pts.push([a, Math.abs(e) * Math.cos(r - ph) + f2a * Math.cos(2 * r + p2) + f3a * Math.cos(3 * r) + gauss(U) * 0.08]); }
        const v = pts.map((p) => p[1]); return { x, n, lim, pts, tir: Math.max(...v) - Math.min(...v) }; });
    },
    view(d, fr) {
      const all = d.flatMap((s) => s.pts.map((p) => p[1])), yr = range(all, 0.1);
      const svg = plot({ w: 620, h: 250, xr: [0, 360], yr, xl: "rotation angle (°)", yl: "reading (µm)", xn: 8, series: d.map((s, i) => ({ pts: cut(s.pts, fr), cls: "bf5-l" + (1 + (i % 5)) })), title: "dial gauge reading vs angle – 5 stations" });
      const rows = d.map((s) => [`${s.x} mm`, esc(s.n), f1(s.tir) + " µm", `≤ ${s.lim} µm`, fr >= 1 ? okb(s.tir <= s.lim) : "…"]);
      return { svg, table: tbl(["Station x", "Where", "TIR = max − min", "Limit", "Result"], rows), ok: d.every((s) => s.tir <= s.lim),
        rec: [{ char: "BS-RO", value: Math.max(...d.filter((s) => s.lim === 20).map((s) => s.tir)) }, { char: "BS-JRO", value: Math.max(...d.filter((s) => s.lim === 8).map((s) => s.tir)) }] };
    } },
  /* ------------------------------------------------------------------ 2 hardness + case depth */
  { id: "hard", t: "Hardness + case depth", part: "BS", chars: ["BS-HRC", "BS-CHD"], std: "ISO 6508-1 (Rockwell), ISO 6507-1 (Vickers), ISO 18203 (case depth)", opts: [["BS", "screw – induction, SHD 2 – 3 mm"], ["BN", "nut – carburised, CHD 0.8 – 1.2 mm"], ["LG", "rail – induction, 1.5 – 2.5 mm"]],
    how: "Surface: 3 Rockwell C readings (diamond cone, 150 kgf) on a ground spot. Depth: a test piece (or a scrapped part) is cut, polished and an HV 1 traverse is made from the surface inwards. The case depth is the depth where the hardness falls to the limit hardness (here 550 HV – ISO 18203: CHD for case hardening = 550 HV; for induction SHD the limit = 0.8 × minimum surface hardness ≈ 522 HV for 58 HRC, the drawing may say 550 HV).",
    gauge: "Rockwell tester + certified test block; micro-hardness tester HV 1 with motorised stage, cut-off saw, mounting press, polisher",
    gen(U, opt = "BS") {
      const P = { BS: { lo: 2.0, hi: 3.0, core: 295, dmax: 4.2, step: 0.2, w: 0.2, id: ["BS-HRC", "BS-CHD"] }, BN: { lo: 0.8, hi: 1.2, core: 360, dmax: 2.0, step: 0.1, w: 0.12, id: ["BN-HRC", "BN-CHD"] }, LG: { lo: 1.5, hi: 2.5, core: 260, dmax: 3.6, step: 0.2, w: 0.18, id: ["LG-HRC", "LG-CHD"] } }[opt];
      const hrc = [0, 1, 2].map(() => 60.2 + gauss(U) * 0.6), surf = hrcToHv(mean(hrc)), chd = (P.lo + P.hi) / 2 + gauss(U) * (P.hi - P.lo) * 0.17;
      const d50 = chd - P.w * Math.log((surf - P.core) / (550 - P.core) - 1), d = [], hv = [];
      for (let x = 0.1; x <= P.dmax + 1e-9; x += P.step) { d.push(+x.toFixed(2)); hv.push(P.core + (surf - P.core) / (1 + Math.exp((x - d50) / P.w)) + gauss(U) * 7); }
      return { opt, P, hrc, d, hv, chd: caseDepth(d, hv, 550) };
    },
    view(D, fr) {
      const n = Math.max(2, Math.ceil(D.d.length * fr)), pts = D.d.map((x, i) => [x, D.hv[i]]).slice(0, n), m = mean(D.hrc);
      const svg = plot({ w: 620, h: 250, xr: [0, D.P.dmax + 0.1], yr: [200, 800], xl: "depth below the surface (mm)", yl: "hardness HV 1", series: [{ pts, cls: "bf5-l1", dots: true }],
        hl: [{ y: 550, t: "limit 550 HV", cls: "bf5-lim" }], vl: fr >= 1 ? [{ x: D.chd, t: `CHD ${f2(D.chd)} mm`, cls: "bf5-cl" }, { x: D.P.lo, cls: "bf5-spec" }, { x: D.P.hi, cls: "bf5-spec" }] : [],
        bands: [{ x0: D.P.lo, x1: D.P.hi, cls: "bf5-band" }], title: "HV 1 traverse (cut-up)" });
      const okH = D.hrc.every((h) => h >= 58 && h <= 62), okC = D.chd >= D.P.lo && D.chd <= D.P.hi;
      const rows = [["HRC readings", D.hrc.map(f1).join(" · ") + ` → mean ${f1(m)} HRC (≈ ${Math.round(hrcToHv(m))} HV)`, "58 – 62 HRC", fr >= 1 ? okb(okH) : "…"],
        ["Case depth at 550 HV", fr >= 1 ? f2(D.chd) + " mm" : "…", `${D.P.lo} – ${D.P.hi} mm`, fr >= 1 ? okb(okC) : "…"],
        ["Core hardness", `${Math.round(D.hv[D.hv.length - 1])} HV ≈ ${f1(hvToHrc(D.hv[D.hv.length - 1]))} HRC`, "info (QT core)", "–"]];
      return { svg, table: tbl(["Check", "Measured", "Spec", "Result"], rows), ok: okH && okC, rec: [{ char: D.P.id[0], value: m }, { char: D.P.id[1], value: D.chd }] };
    } },
  /* ------------------------------------------------------------------ 3 thread profile */
  { id: "profile", t: "Thread profile (gothic arch)", part: "BS", chars: ["BS-PRF"], std: "maker standard (contour, ISO 3408 gives no profile tolerance); evaluation like ISO 25178 / contour software",
    how: "A stylus contour tester traces the groove across (axial direction). The software fits one circle to each flank, places a ball of Ø6.35 mm into the two arcs and computes: arc radius r (conformity f = r / Dw), contact angle α of each flank (nominal 45°), symmetry. Gothic arch = 2 arcs with their centres offset by e = r − Dw/2 = 0.19 mm along the 45° contact lines.",
    gauge: "contour tester (Mahr MarSurf XC / LD, Taylor Hobson Form Talysurf, Mitutoyo CV / Formtracer) with a 25° cone stylus, glass or radius standard",
    gen(U) {
      const rb = BN.Dw / 2, r0 = BN.f * BN.Dw, e0 = r0 - rb, al = Math.PI / 4;
      const dR = gauss(U) * 0.012, dA = [gauss(U) * 0.9, gauss(U) * 0.9].map((v) => v * Math.PI / 180), pts = [], nom = [];
      const flank = (u, side, err) => { const a = al + (err ? dA[side > 0 ? 1 : 0] : 0), r = r0 + (err ? dR : 0), e = r - rb, cu = -side * e * Math.sin(a), cv = e * Math.cos(a); const q = r * r - (u - cu) ** 2; return q > 0 ? cv - Math.sqrt(q) : NaN; };
      for (let u = -2.9; u <= 2.9 + 1e-9; u += 0.02) { const s = u >= 0 ? 1 : -1; const vN = Math.max(flank(u, s, false), -0.75 - 3), vM = flank(u, s, true) + gauss(U) * 0.0003 + 0.0006 * Math.sin(u * 40); nom.push([u, vN]); pts.push([u, vM]); }
      return { rb, r0, e0, pts, nom };
    },
    view(D, fr) {
      const fit = (side) => circleFit(D.pts.filter((p) => side * p[0] >= 1.2 && side * p[0] <= 2.8 && Number.isFinite(p[1])));
      const cR = fit(1), cL = fit(-1), rb = D.rb;
      // ball centre = intersection of the circles (cR, r_R − rb) and (cL, r_L − rb); the arc centres lie above the ball centre → lower solution
      const d = Math.hypot(cR.cx - cL.cx, cR.cy - cL.cy), r1 = cL.r - rb, r2 = cR.r - rb, a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
      const mx = cL.cx + a * (cR.cx - cL.cx) / d, my = cL.cy + a * (cR.cy - cL.cy) / d, ox = h * (cR.cy - cL.cy) / d, oy = h * (cR.cx - cL.cx) / d;
      const B = my + oy < my - oy ? [mx - ox, my + oy] : [mx + ox, my - oy];
      const ang = (c) => { const ux = (B[0] - c.cx), uy = (B[1] - c.cy), L = Math.hypot(ux, uy), px = c.cx + c.r * ux / L, py = c.cy + c.r * uy / L; return { a: Math.atan2(Math.abs(px - B[0]), Math.abs(B[1] - py)) * 180 / Math.PI, p: [px, py] }; };
      const aR = ang(cR), aL = ang(cL);
      const n = Math.max(2, Math.ceil(D.pts.length * fr)), dev = D.pts.slice(0, n).map((p, i) => [p[0], (p[1] - D.nom[i][1]) * 1000]).filter((p) => Number.isFinite(p[1]) && Math.abs(p[0]) <= 2.8);
      const ball = []; for (let t = 0; t <= 360; t += 6) { const q = t * Math.PI / 180; ball.push([B[0] + rb * Math.cos(q), B[1] + rb * Math.sin(q)]); }
      const svg = plot({ w: 300, h: 250, xr: [-3.4, 3.4], yr: [-3.6, 3.2], xl: "axial (mm)", yl: "radial (mm)", series: [{ pts: D.nom.filter((p) => Number.isFinite(p[1])), cls: "bf5-l2" }, { pts: D.pts.slice(0, n).filter((p) => Number.isFinite(p[1])), cls: "bf5-l1" }].concat(fr >= 1 ? [{ pts: ball, cls: "bf5-l3" }, { pts: [B, aR.p], cls: "bf5-l4" }, { pts: [B, aL.p], cls: "bf5-l4" }] : []), title: "groove trace + fitted ball", left: 40 })
        + plot({ w: 320, h: 250, xr: [-2.9, 2.9], yr: [-6, 6], xl: "axial (mm)", yl: "deviation from nominal (µm)", series: [{ pts: dev, cls: "bf5-l1" }], hl: [{ y: 0, cls: "bf5-cl0" }], title: "profile deviation", left: 40 });
      const fR = cR.r / BN.Dw, fL = cL.r / BN.Dw, okA = [aR.a, aL.a].every((v) => v >= 43 && v <= 47), okF = [fR, fL].every((v) => v >= 0.52 && v <= 0.54);
      const rows = fr >= 1 ? [["Arc radius r (left / right)", `${f3(cL.r)} / ${f3(cR.r)} mm`, `${f3(D.r0)} mm (f·Dw)`, "–"], ["Conformity f = r / Dw", `${f3(fL)} / ${f3(fR)}`, "0.53 ± 0.01", okb(okF)],
        ["Contact angle α (left / right)", `${f1(aL.a)}° / ${f1(aR.a)}°`, "45° ± 2°", okb(okA)], ["Ball centre height over the groove bottom", f3(B[1] - Math.min(...D.pts.map((p) => p[1]).filter(Number.isFinite))) + " mm", "≈ 3.23 mm", "–"]] : [["…", "tracing", "", ""]];
      return { svg, table: tbl(["Check", "Measured", "Nominal / spec", "Result"], rows), ok: okA && okF, rec: [{ char: "BS-PRF", value: Math.min(aR.a, aL.a) < 45 ? Math.min(aR.a, aL.a) : Math.max(aR.a, aL.a) }] };
    } },
  /* ------------------------------------------------------------------ 4 ball size classes */
  { id: "balls", t: "Ball size class sorting", part: "BN", chars: ["BN-CLS"], std: "ISO 3290-1 (balls: grade G5 – sphericity 0.13 µm, lot diameter variation 0.25 µm)",
    how: "Balls come in sorts (size classes) of 1 µm steps around the nominal Ø6.35 mm (e.g. −2 … +8 µm). Incoming check: a sample is measured on a ball comparator (0.05 µm). At nut assembly the axial play of the nut with gauge balls (class 0) is measured; the needed oversize = play (as diameter) + preload interference 2 – 6 µm → the operator takes 60 balls of that class.",
    gauge: "ball comparator with 2 flat anvils + gauge block, 0.05 µm (Mahr / Tesa class), gauge-ball set",
    gen(U) {
      const v = []; for (let i = 0; i < 300; i++) { const sort = [0, 1, 2, 3, 4, 5, 6][Math.floor(U() * 7)] - 1; v.push(sort + gauss(U) * 0.12 + 0.05); }
      const play = 0.8 + U() * 3.2, need = Math.round(play + 4);
      return { v, play, need };
    },
    view(D, fr) {
      const n = Math.max(2, Math.ceil(D.v.length * fr)), v = D.v.slice(0, n), cls = {}; for (const x of v) { const c = Math.round(x); cls[c] = (cls[c] || 0) + 1; }
      const bins = []; for (let x = -2.5; x <= 7.5; x += 0.2) bins.push([x + 0.1, v.filter((q) => q >= x && q < x + 0.2).length]);
      const svg = plot({ w: 620, h: 240, xr: [-2.5, 7.5], yr: [0, Math.max(5, ...bins.map((b) => b[1])) * 1.1], xl: "ball Ø deviation from 6.350 mm (µm)", yl: "balls", series: [{ pts: bins, bars: true, bw: 0.2, cls: "bf5-bar" }],
        vl: Object.keys(cls).map((c) => ({ x: +c + 0.5, cls: "bf5-grid2" })), title: `${n} balls measured – sorts in 1 µm steps` });
      const rows = Object.keys(cls).sort((a, b) => a - b).map((c) => [`${c >= 0 ? "+" : ""}${c} µm`, cls[c], f2(sdev(v.filter((q) => Math.round(q) === +c)) || 0) + " µm", +c === D.need ? "<b>← next nut</b>" : ""]);
      const enough = (cls[D.need] || 0) >= BN.ballsTotal;
      return { svg, table: tbl(["Size class", "Balls", "Spread s inside the class", ""], rows) + `<p class="bf5-hint">Next nut: axial play with gauge balls → equivalent ${f1(D.play)} µm; + preload interference 4 µm (P1 example) → class <b>+${D.need} µm</b>, 60 balls needed, ${cls[D.need] || 0} in this sample ${fr >= 1 ? okb(enough) : ""}.</p>`,
        ok: enough, rec: [{ char: "BN-CLS", value: D.need }] };
    } },
  /* ------------------------------------------------------------------ 5 preload torque */
  { id: "torque", t: "Preload torque test", part: "FABS", chars: ["FA-TP", "FA-TPV"], std: "ISO 3408-3 / JIS B 1192-3 (dynamic preload torque, tolerance band in % of Tp)", opts: [["C3", "grade C3"], ["C5", "grade C5"], ["C7", "grade C7"]],
    how: `The screw turns at a constant speed (e.g. 100 min⁻¹), the nut is held by an arm on a load cell, seals removed, standard grease. Torque vs stroke is recorded. The nut length at both ends is ignored. Reference Tp = 0.05 / √tanλ · Fpr · Ph / 2π = ${f3(TP0)} N·m (item 2). All values over the effective stroke must stay inside Tp ± tolerance (table by Tp and grade).`,
    gauge: "preload torque tester: servo drive + encoder, load cell 0.01 N·m class (HBM / Kistler / Lorenz), chart software (AS-BSA)",
    gen(U, opt = "C5") {
      const m = 0.02 + gauss(U) * 0.07, ph = U() * 6.283, pd = 0.05 + U() * 0.08, s = [], T = [];
      for (let x = 0; x <= 600; x += 2) { s.push(x); T.push(TP0 * (1 + m) * (1 + pd * Math.sin(2 * Math.PI * x / 420 + ph)) + 0.022 * TP0 * Math.sin(2 * Math.PI * x / 38) + gauss(U) * 0.012 * TP0 + (x < 30 || x > 570 ? 0.06 * TP0 * U() : 0)); }
      return { opt, s, T, tol: torqueTol(TP0, opt) };
    },
    view(D, fr) {
      const r = torqueEval(D.s, D.T, TP0, D.tol, 50), n = Math.max(2, Math.ceil(D.s.length * fr));
      const svg = plot({ w: 620, h: 250, xr: [0, 600], yr: [0, TP0 * 1.8], xl: "stroke (mm)", yl: "torque (N·m)", series: [{ pts: D.s.slice(0, n).map((x, i) => [x, D.T[i]]), cls: "bf5-l1" }],
        hl: [{ y: r.hi, t: `Tp + ${D.tol} %`, cls: "bf5-lim" }, { y: r.lo, t: `Tp − ${D.tol} %`, cls: "bf5-lim" }, { y: TP0, t: `Tp ${f3(TP0)}`, cls: "bf5-cl0" }].concat(fr >= 1 ? [{ y: r.mean, t: `mean ${f3(r.mean)}`, cls: "bf5-cl" }] : []),
        bands: [{ x0: 0, x1: 50, cls: "bf5-band2" }, { x0: 550, x1: 600, cls: "bf5-band2" }], title: `torque vs stroke (grey = ignored ends), grade ${D.opt}` });
      const rows = fr >= 1 ? [["Mean torque Tpm", f3(r.mean) + " N·m", `${f3(TP0)} N·m (dev. ${f1(r.meanDevPct)} %)`, okb(Math.abs(r.meanDevPct) <= D.tol)], ["Max / min", `${f3(r.max)} / ${f3(r.min)} N·m`, `${f3(r.lo)} … ${f3(r.hi)}`, okb(r.ok)],
        ["Fluctuation (largest deviation from Tp)", f1(r.varPct) + " %", `± ${D.tol} % (${D.opt}, Tp 0.2 – 0.4 N·m)`, okb(r.varPct <= D.tol)], ["Points evaluated", r.n, "stroke 50 … 550 mm", "–"]] : [["…", "measuring", "", ""]];
      return { svg, table: tbl(["Check", "Measured", "Spec", "Result"], rows), ok: r.ok, rec: [{ char: "FA-TP", value: r.mean }, { char: "FA-TPV", value: r.varPct }] };
    } },
  /* ------------------------------------------------------------------ 6 axial rigidity / lost motion */
  { id: "rigid", t: "Axial rigidity + lost motion", part: "FABS", chars: ["FA-AX"], std: "ISO 3408-4 (static axial rigidity), maker method",
    how: "The screw is clamped, the nut is loaded axially 0 → +F → 0 → −F → 0 (F = 2 kN) by a hydraulic / screw cylinder with a load cell. An LVDT (0.1 µm) measures the nut displacement against the screw. Rigidity K = ΔF / Δδ on the loading branch (0.3 F … F). Lost motion = gap between the two branches at F = 0 (backlash + elastic + friction). A preloaded nut has nearly no lost motion.",
    gauge: "rigidity test fixture: load cell 5 kN, LVDT / capacitive probe 0.1 µm, screw clamp",
    gen(U) {
      const K = BN.Kn * (1 + gauss(U) * 0.07), lm = 0.4 + U() * 1.6, h = 0.3 + U() * 0.4, F = [], d = [], dir = [];
      const seq = []; for (let f = 0; f <= 2000; f += 100) seq.push([f, 1]); for (let f = 1900; f >= -2000; f -= 100) seq.push([f, -1]); for (let f = -1900; f <= 0; f += 100) seq.push([f, 1]);
      for (const [f, s] of seq) { F.push(f); dir.push(s); d.push(f / K + lm / 2 * Math.tanh(f / 250) + s * h / 2 + gauss(U) * 0.05); }
      return { K, F, d, dir };
    },
    view(D, fr) {
      const n = Math.max(2, Math.ceil(D.F.length * fr)), pts = D.F.slice(0, n).map((f, i) => [f, D.d[i]]);
      const ld = D.F.map((f, i) => [f, D.d[i]]).slice(0, 21).filter((p) => p[0] >= 600), { b } = lsq(ld.map((p) => p[0]), ld.map((p) => p[1])), K = 1 / b;
      const z1 = D.d[D.F.indexOf(0, 21)], z2 = D.d[D.F.length - 1], lm = Math.abs(z1 - z2);
      const svg = plot({ w: 620, h: 250, xr: [-2200, 2200], yr: range(D.d, 0.1), xl: "axial force F (N)", yl: "displacement δ (µm)", series: [{ pts, cls: "bf5-l1", dots: true }], title: "force – displacement loop", vl: [{ x: 0, cls: "bf5-cl0" }] });
      const okK = K >= 540, okL = lm <= 2;
      const rows = fr >= 1 ? [["Axial rigidity K = ΔF / Δδ (600 … 2 000 N)", f1(K) + " N/µm", "≥ 540 N/µm (≈ 0.8 · Kn " + BN.Kn + ")", okb(okK)], ["Lost motion at F = 0", f2(lm) + " µm", "≤ 2 µm", okb(okL)], ["δ at + 2 kN", f2(D.d[20]) + " µm", "info", "–"]] : [["…", "loading", "", ""]];
      return { svg, table: tbl(["Check", "Measured", "Spec", "Result"], rows), ok: okK && okL, rec: [{ char: "FA-AX", value: K }] };
    } },
  /* ------------------------------------------------------------------ 7 rail running parallelism */
  { id: "par", t: "Rail running parallelism", part: "LG", chars: ["LG-PAR"], std: "ISO 12090-1 / maker classes N / H / P / SP / UP (running parallelism vs rail length)",
    how: "The rail is bolted (or laid) on a granite table with the datum side against a straight edge. A measuring block with two probes runs along the rail: probe 1 on the top reference (B → A, vertical) and probe 2 on the side reference (C → D, horizontal). Running parallelism = max − min of each probe over the rail length. Compare with the class table for the rail length.",
    gauge: "rail measuring bench QC-RAL: granite 1.5 m (≥ rail length), measuring carriage with 2 probes 0.1 µm, linear scale (Heidenhain / Renishaw)",
    gen(U) {
      const L = LG.L, a = 3 + U() * 5, b = 2 + U() * 4, p1 = U() * 6.283, p2 = U() * 6.283, x = [], v = [], h = [];
      for (let s = 0; s <= L; s += 5) { const q = s / L; x.push(s); v.push(a * Math.sin(Math.PI * q + p1) * 0.8 + 1.2 * Math.sin(2 * Math.PI * s / LG.pitch) * 0.3 + gauss(U) * 0.25); h.push(b * Math.sin(2 * Math.PI * q * 1.2 + p2) + gauss(U) * 0.25); }
      return { L, x, v, h };
    },
    view(D, fr) {
      const n = Math.max(2, Math.ceil(D.x.length * fr)), pv = Math.max(...D.v) - Math.min(...D.v), phh = Math.max(...D.h) - Math.min(...D.h), dev = Math.max(pv, phh), C = parClass(D.L, dev);
      const svg = plot({ w: 620, h: 250, xr: [0, D.L], yr: range(D.v.concat(D.h), 0.15), xl: "position along the rail (mm)", yl: "probe reading (µm)", series: [{ pts: D.x.slice(0, n).map((s, i) => [s, D.v[i]]), cls: "bf5-l1" }, { pts: D.x.slice(0, n).map((s, i) => [s, D.h[i]]), cls: "bf5-l2" }], title: "top (vertical, blue) and side (horizontal, grey) probe" });
      const rows = fr >= 1 ? [["Vertical (top B to bottom A)", f1(pv) + " µm"], ["Horizontal (side D to datum C)", f1(phh) + " µm"], ["Class limits at " + D.L + " mm (table ≤ " + C.binL + " mm)", Object.entries(C.lim).map(([c, l]) => `${c} ${l}`).join(" · ") + " µm"], ["Best class reached", `<b>${C.cls}</b> (target H ≤ ${C.lim.H} µm) ${okb(dev <= C.lim.H)}`]] : [["…", "probing"]];
      return { svg, table: tbl(["Result", "Value"], rows), ok: dev <= C.lim.H, rec: [{ char: "LG-PAR", value: dev }] };
    } },
  /* ------------------------------------------------------------------ 8 carriage height H + width W2 */
  { id: "hw", t: "Carriage height H + width W2", part: "LB", chars: ["LB-H", "LB-W2"], std: "maker classes (size 25: H / W2 tolerance and variation between blocks on one rail)",
    how: `Each block sits on the master rail. An electronic height gauge measures the assembly height H (${LB.Hasm} mm nominal) against a gauge-block stack; a side probe measures W2 (block reference side to rail datum side). For a set, the variation ΔH (max − min of the blocks on one rail) and ΔW2 also count. The best class whose tolerance AND variation are met is the class of the set.`,
    gauge: "master rail, electronic height gauge 0.1 µm, gauge blocks grade 0, side probe (QC-MAT)",
    gen(U) { const bH = gauss(U) * 6, bW = gauss(U) * 5; return { H: [0, 1, 2, 3].map(() => bH + 3 + gauss(U) * 5), W: [0, 1, 2, 3].map(() => bW + gauss(U) * 4) }; },
    view(D, fr) {
      const k = Math.max(1, Math.ceil(4 * fr)), dH = Math.max(...D.H) - Math.min(...D.H), dW = Math.max(...D.W) - Math.min(...D.W), C = hwClass(D.H, D.W, dH, dW);
      const svg = plot({ w: 620, h: 230, xr: [0.4, 4.6], yr: [-45, 45], xl: "block no.", yl: "deviation (µm)", xn: 4, xf: (v) => (Number.isInteger(v) ? "#" + v : ""), series: [{ pts: D.H.slice(0, k).map((v, i) => [i + 0.88, v]), bars: true, bw: 0.22, cls: "bf5-bar" }, { pts: D.W.slice(0, k).map((v, i) => [i + 1.12, v]), bars: true, bw: 0.22, cls: "bf5-bar2" }],
        hl: [{ y: 40, t: "H class ± 40", cls: "bf5-lim" }, { y: -40, cls: "bf5-lim" }, { y: 0, cls: "bf5-cl0" }], title: "H deviation (blue) and W2 deviation (grey) of 4 blocks" });
      const rows = D.H.map((h, i) => [`#${i + 1}`, (i < k ? f1(h) : "…") + " µm", (i < k ? f1(D.W[i]) : "…") + " µm"]);
      const cl = C.rows.map((r) => `${r.c}: H ${r.H[0]}/${r.H[1]}, ΔH ≤ ${r.dH}`).join(" · ");
      return { svg, table: tbl(["Block", "H − 36.000 mm", "W2 deviation"], rows) + (fr >= 1 ? `<p class="bf5-hint">ΔH = ${f1(dH)} µm, ΔW2 = ${f1(dW)} µm → best class <b>${C.best}</b> ${okb(["UP", "SP", "P", "H"].includes(C.best))} (target H). Class table (µm): ${esc(cl)}.</p>` : ""),
        ok: ["UP", "SP", "P", "H"].includes(C.best), rec: [{ char: "LB-H", value: D.H[0] }, { char: "LB-W2", value: D.W[0] }, { char: "FG-PAIRH", value: Math.abs(D.H[0] - D.H[1]) }] };
    } },
  /* ------------------------------------------------------------------ 9 roughness */
  { id: "rough", t: "Surface roughness Ra / Rz", part: "BS", chars: ["BS-RA"], std: "ISO 21920-2 (profile parameters; replaces ISO 4287), cut-off λc 0.25 mm for Ra 0.02 – 0.1 … 0.8 mm for Ra 0.1 – 2 µm (ISO 21920-3 / old ISO 4288)",
    how: "A diamond stylus (tip radius 2 µm) is drawn along the raceway (in the groove direction). The primary profile is filtered with the cut-off λc into waviness + roughness. Ra = mean of |z| of the roughness profile; Rz = mean of the 5 peak-to-valley heights of 5 sampling lengths. A ground raceway: Ra ≈ 0.05 – 0.2 µm, Rz ≈ 0.4 – 1.5 µm.",
    gauge: "stylus roughness tester (Mahr MarSurf, Mitutoyo SJ / Surftest, Taylor Hobson Surtronic / Talysurf, Hommel / Jenoptik) + roughness standard",
    gen(U) {
      const dx = 0.0005, lc = 0.25, n = Math.round((5 * lc + 2 * lc / 2) / dx), z = [], target = 0.11 * (1 + gauss(U) * 0.25); let a = 0, b = 0;
      for (let i = 0; i < n; i++) { a = 0.82 * a + gauss(U); b = 0.995 * b + gauss(U) * 0.08; z.push(a + b); }
      const r0 = roughness(z, dx, lc), k = target / r0.Ra; return { z: z.map((v) => v * k), dx, lc };
    },
    view(D, fr) {
      const R = roughness(D.z, D.dx, D.lc), n = Math.max(2, Math.ceil(R.r.length * fr)), step = 3, pts = []; for (let i = 0; i < n; i += step) pts.push([i * D.dx, R.r[i]]);
      const svg = plot({ w: 620, h: 230, xr: [0, R.r.length * D.dx], yr: range(R.r, 0.1), xl: "evaluation length (mm) = 5 × λc", yl: "roughness profile (µm)", series: [{ pts, cls: "bf5-l1" }],
        hl: [{ y: R.Ra, t: "+Ra", cls: "bf5-cl" }, { y: -R.Ra, t: "−Ra", cls: "bf5-cl" }, { y: 0, cls: "bf5-cl0" }], vl: [1, 2, 3, 4].map((k) => ({ x: k * D.lc, cls: "bf5-grid2" })), title: `roughness profile after the λc ${D.lc} mm filter` });
      const rows = fr >= 1 ? [["Ra", f3(R.Ra) + " µm", "≤ 0.2 µm", okb(R.Ra <= 0.2)], ["Rq", f3(R.Rq) + " µm", "info", "–"], ["Rz (5 sampling lengths)", f2(R.Rz) + " µm (" + R.seg.map(f2).join(" · ") + ")", "info (≈ 4 – 7 × Ra)", "–"]] : [["…", "tracing", "", ""]];
      return { svg, table: tbl(["Parameter", "Measured", "Spec", "Result"], rows), ok: R.Ra <= 0.2, rec: [{ char: "BS-RA", value: R.Ra }] };
    } },
  /* ------------------------------------------------------------------ 10 noise / vibration run-in */
  { id: "noise", t: "Noise + vibration run-in", part: "FABS", chars: ["FA-NOISE"], std: "IEC 61672-1 (sound level meter class 1), ISO 3744 / 11201 ideas (measurement distance), maker limit",
    how: "The assembled screw runs on the run-in stand: speed sweep 100 → 3 000 min⁻¹ and back, microphone at 0.3 m, accelerometer on the nut. Limit example: 65 dB(A) at 500 min⁻¹, + 6 dB per doubling of speed above. A damaged deflector or a ball of the wrong class gives a peak at the ball-pass frequency f_b ≈ (n / 60) · (z_turn / 2) · (1 − Dw cos α / dpw).",
    gauge: "run-in stand AS-RUN: servo motor, torque sensor, class 1 microphone + calibrator, IEPE accelerometer, FFT software",
    gen(U) {
      const bad = U() < 0.12, base = 52 + gauss(U) * 2.5, n = [], L = [];
      for (let s = 100; s <= 3000; s += 100) { n.push(s); L.push(base + 18 * Math.log10(s / 500) + gauss(U) * 0.8 + (bad && s >= 1200 && s <= 1600 ? 7 : 0)); }
      const fn = 1500 / 60, z = Math.PI * BS.dpw / BN.Dw, fb = fn * z / 2 * (1 - BN.Dw * Math.cos(Math.PI / 4) / BS.dpw);
      const spec = [[fn, 0.25], [2 * fn, 0.12], [fb, bad ? 1.6 : 0.45], [2 * fb, bad ? 0.7 : 0.18], [3 * fb, 0.08], [fn * BN.circuits, 0.15]].map(([f, a]) => [f, a * (1 + gauss(U) * 0.1)]);
      return { n, L, fb, spec, bad };
    },
    view(D, fr) {
      const k = Math.max(2, Math.ceil(D.n.length * fr)), lim = (s) => 65 + (s > 500 ? 6 * Math.log2(s / 500) : 0), L500 = D.L[D.n.indexOf(500)];
      const ok = D.n.every((s, i) => D.L[i] <= lim(s));
      const svg = plot({ w: 400, h: 240, xr: [0, 3000], yr: [35, 90], xl: "speed (min⁻¹)", yl: "sound level dB(A)", series: [{ pts: D.n.slice(0, k).map((s, i) => [s, D.L[i]]), cls: "bf5-l1", dots: true }, { pts: D.n.map((s) => [s, lim(s)]), cls: "bf5-lim" }], title: "speed sweep (red = limit)", left: 44 })
        + plot({ w: 260, h: 240, xr: [0, 600], yr: [0, 2], xl: "frequency (Hz) at 1 500 min⁻¹", yl: "vibration velocity mm/s", series: [{ pts: fr >= 1 ? D.spec : [], bars: true, bw: 9, cls: "bf5-bar" }], vl: [{ x: D.fb, t: "f_b", cls: "bf5-grid2" }], title: "spectrum", left: 40 });
      const rows = fr >= 1 ? [["Level at 500 min⁻¹", f1(L500) + " dB(A)", "≤ 65 dB(A)", okb(L500 <= 65)], ["Whole sweep under the limit line", ok ? "yes" : "no – peak", "+ 6 dB / doubling", okb(ok)], ["Ball-pass frequency at 1 500 min⁻¹", f1(D.fb) + " Hz", "peak must be small", D.bad ? "<b class='bf5-nok'>high</b>" : "normal"]] : [["…", "sweeping", "", ""]];
      return { svg, table: tbl(["Check", "Measured", "Spec", "Result"], rows), ok: ok && L500 <= 65, rec: [{ char: "FA-NOISE", value: L500 }] };
    } },
  /* ------------------------------------------------------------------ 11 cleanliness + rust protection */
  { id: "clean", t: "Cleanliness + rust protection", part: "BS", chars: ["BS-CLN", "BS-MAG"], std: "ISO 16232 / VDA 19.1 (technical cleanliness), maker packing standard",
    how: "Once a week one washed part is rinsed in a cabinet with clean solvent; the liquid is filtered (5 µm membrane), dried and weighed (residual dirt mg) and the particles are counted + sized under a microscope (size classes). Every part: visual (no rust, no fingerprints, oil film complete), residual magnetism with a Hall probe, VCI tube closed, humidity indicator in the box.",
    gauge: "extraction cabinet, analysis balance 0.1 mg, membrane filters, microscope with particle software, gaussmeter",
    gen(U) {
      const mg = 0.6 + Math.abs(gauss(U)) * 0.7 + (U() < 0.08 ? 1.5 : 0), big = 120 + Math.abs(gauss(U)) * 140, mag = 0.08 + Math.abs(gauss(U)) * 0.1;
      const cls = [["B 5–15", 900], ["C 15–25", 420], ["D 25–50", 210], ["E 50–100", 70], ["F 100–150", 18], ["G 150–200", 6], ["H 200–400", big > 200 ? 2 : 0], ["I 400–600", big > 400 ? 1 : 0]].map(([c, n]) => [c, Math.round(n * (0.6 + U() * 0.8))]);
      return { mg, big, mag, cls, film: U() > 0.03 };
    },
    view(D, fr) {
      const k = Math.max(1, Math.ceil(D.cls.length * fr));
      const svg = plot({ w: 620, h: 220, xr: [0.5, 8.5], yr: [0, 1300], xl: "particle size class (ISO 16232)", yl: "particles / part", xn: 8, xf: (v) => (D.cls[v - 1] ? D.cls[v - 1][0].split(" ")[0] : ""), series: [{ pts: D.cls.slice(0, k).map((c, i) => [i + 1, c[1]]), bars: true, bw: 0.6, cls: "bf5-bar" }], title: "particle count per size class (µm)" });
      const okM = D.mg <= 2, okB = D.big <= 400, okG = D.mag <= 0.3;
      const rows = fr >= 1 ? [["Residual dirt (gravimetric)", f2(D.mg) + " mg", "≤ 2.0 mg / part", okb(okM)], ["Largest particle", Math.round(D.big) + " µm", "≤ 400 µm", okb(okB)], ["Residual magnetism", f2(D.mag) + " mT", "≤ 0.3 mT", okb(okG)], ["Oil film / no rust / VCI closed", D.film ? "complete" : "dry spot", "complete", okb(D.film)]] : [["…", "analysing", "", ""]];
      return { svg, table: tbl(["Check", "Measured", "Spec", "Result"], rows), ok: okM && okB && okG && D.film, rec: [{ char: "BS-CLN", value: D.mg }, { char: "BS-MAG", value: D.mag }] };
    } },
];
export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s]));
export const charName = (id) => (CHAR_BY_ID[id] ? CHAR_BY_ID[id].name : id);
