/* Mechanical elements tab - item 4: the connection between the APC load station and the rotary pallet changer (APC).
   What has to be right so that the APC arm takes the pallet from the station receivers and sets it into the machine
   zero-point modules (catch ±1 mm) - and brings the finished pallet back onto the receivers (catch ±3 mm):
     mounting of the station to the APC (bolted + dowelled to the APC base, or separate on the floor), height and position
     alignment, accuracy chain station -> machine and machine -> station, pallet on the fork rails during the rotation,
     clearances (studs, sweep circle, AGV), interlocks + signals between the station PLC and the machine / APC,
     installation + alignment procedure with a master pallet, tests.
   2D SVG animation (top view + side section along the arm).  APC data (size, radius, stroke, times, backlash, catch range)
   come live from the Pallet changer tab (window.APC).  All other values are examples.  Offline, no libraries. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, H0 = 1050, LS = 44;
const ease = (u) => u * u * (3 - 2 * u), clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const GROUPS = [
  ["Mounting of the station", [
    ["eDow", "Position error, bolted + dowelled to the APC base", "± mm", 0.05, "dowels reamed after alignment"],
    ["eFloor", "Position error, separate floor frame (after setting)", "± mm", 0.3, "levelling feet + anchors"],
    ["drift", "Floor drift per year (floor frame only)", "± mm/year", 0.2, "settling, slab movement"],
    ["years", "Years until the next re-alignment", "years", 1, ""],
    ["hdiff", "Height: station receivers vs machine zero-point", "± mm", 0.1, "precision level + shims"]]],
  ["Accuracy chain", [
    ["eRec", "Pallet in the station receivers", "± mm", 0.02, "mech. item 1"],
    ["eTab", "Receivers on the station table", "± mm", 0.02, "machined in one set-up"],
    ["eRail", "Pallet on the APC fork rails", "± mm", 0.2, "locating blocks on the rails"],
    ["eMach", "Machine zero-point ↔ APC axis", "± mm", 0.05, "machine builder"],
    ["dT", "Temperature difference station ↔ APC", "K", 10, "sun, hydraulics, coolant"],
    ["rlead", "Station receiver catch range", "± mm", 3, "mech. item 1"],
    ["muR", "Friction pallet ledge ↔ fork rail", "", 0.15, "steel, oily"]]],
  ["Station + joint", [
    ["mst", "Station mass (table, lift chains, stop)", "kg", 260, ""],
    ["nb", "Bolts station bracket ↔ APC base", "", 4, "M16 10.9"],
    ["Fv", "Preload per bolt", "kN", 80, "M16 10.9, μ_thread 0.12"],
    ["muJ", "Friction in the joint", "", 0.2, "clean, dry steel"],
    ["ovh", "Fixture / part overhang over the pallet", "mm", 40, "tombstone with castings"],
    ["xagv", "AGV bumper from the station centre", "mm", 335, "mech. item 1 (a/2 + 85)"]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

function apcCtx() {
  const A = window.APC && window.APC.get && window.APC.get();
  const P = A ? A.P : { a: 500, b: 500, mp: 110, mw: 400, r: 480, s: 60, cap: 1, backlash: 3, trot: 2.5, tlift: 0.8, tpos: 1.5, tunc: 0.8, tcl: 0.8, tseat: 0.4, tdoor: 1.2, dm: 350, acc: 30, pitch: 400 };
  const R = A && A.R ? A.R : {};
  const ta = P.trot * P.acc / 100, om = Math.PI / (P.trot - ta);
  return { a: P.a, b: P.b, mp: P.mp, mw: P.mw, r: P.r, s: P.s, cap: P.cap, pitch: P.pitch, dm: P.dm,
    trot: P.trot, tlift: P.tlift, tpos: P.tpos, tunc: P.tunc, tcl: P.tcl, tseat: P.tseat, tdoor: P.tdoor,
    dpos: R.dpos ?? P.r * P.backlash / 60 * Math.PI / 180, al: R.al ?? om / ta, om, def: R.def ?? 0.1, backlash: P.backlash };
}

/* ------------------------------------------------------------------ calculation */
function calc(M, A, mount) {
  const R = { A, mount };
  R.mpl = A.mp + A.mw;
  R.eMount = mount === "base" ? M.eDow : M.eFloor + M.drift * M.years;
  R.eTh = 11.5e-6 * A.r * M.dT;
  R.chM = [["Pallet in the station receivers", M.eRec], ["Receivers on the station table (one set-up)", M.eTab],
    [mount === "base" ? "Station ↔ APC axis (bolted + dowelled)" : `Station ↔ APC axis (floor frame, + ${M.years} year drift)`, R.eMount],
    [`APC arm angle (backlash ${A.backlash}′ at r = ${A.r} mm)`, A.dpos], ["Pallet on the fork rails", M.eRail], [`Thermal growth (ΔT ${M.dT} K over r)`, R.eTh]];
  R.chS = [["Pallet in the machine zero-point", 0.005], ["Machine zero-point ↔ APC axis", M.eMach], [`APC arm angle (backlash)`, A.dpos],
    ["Pallet on the fork rails", M.eRail], [mount === "base" ? "Station ↔ APC axis (dowelled)" : "Station ↔ APC axis (floor frame)", R.eMount], ["Thermal growth", R.eTh]];
  const sum = (c) => c.reduce((s, r) => s + r[1], 0), rss = (c) => Math.sqrt(c.reduce((s, r) => s + r[1] * r[1], 0));
  R.wcM = sum(R.chM); R.rsM = rss(R.chM); R.wcS = sum(R.chS); R.rsS = rss(R.chS);
  R.at = A.al * A.r / 1000; R.ac = A.om * A.om * A.r / 1000;                 // tangential α·r and centripetal ω²·r at the end of acceleration
  R.ares = Math.hypot(R.at, R.ac); R.aFr = M.muR * G; R.slipSF = R.aFr / R.ares;   // friction must hold the RESULTANT (guide 09 §9.4, guide 10 §9.6)
  R.studLift = A.s - 5 - LS;
  R.Rc = Math.hypot(A.r + A.a / 2 + M.ovh, A.b / 2 + M.ovh); R.agvClr = A.r + M.xagv - R.Rc;
  R.Fst = R.mpl * 0.05 * 0.05 / (2 * 0.003) + 0.1 * R.mpl * G;            // pallet into the retractable stop + chain sliding
  R.Fjoint = 1.5 * R.Fst; R.Fcap = M.nb * M.muJ * M.Fv * 1000; R.jUse = R.Fjoint / R.Fcap;
  R.Ffeet = (M.mst + R.mpl) * G / 2;                                      // 2 levelling feet carry the weight, the bracket only locates
  R.steps = [
    ["pos", "Machine finished: axes go to the change position, the door opens", A.tpos],
    ["unc", "Machine unclamps its pallet (zero-point modules released by hydraulics)", A.tunc],
    ["chk", "Station reports READY: new pallet seated (air check), chains + stop down, AGV out, zone free, pallet ID read", 0.8],
    ["lift", `APC lifts ${A.s} mm: the fork rails lift both pallets by their ledges – the pull studs leave the receivers and the zero-point modules`, A.tlift],
    ["rot", `APC turns 180° (station LOCKED: no chains, no AGV, nobody in the zone)`, A.trot],
    ["low", `APC lowers: new pallet into the zero-point modules (catch ±${A.cap} mm), finished pallet onto the station receivers (catch ±${M.rlead} mm)`, A.tlift],
    ["cl", "Machine clamps (springs) + air seat check · station air seat check", A.tcl + A.tseat],
    ["door", "Door closes, machining starts · station reports 'finished pallet' → AGV may come / operator unloads", A.tdoor]];
  R.tch = R.steps.reduce((s, r) => s + r[2], 0);
  return R;
}

function stateAt(t, R) {
  let k = 0, t0 = 0; const ST = R.steps;
  while (k < ST.length - 1 && t >= t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = clamp((t - t0) / ST[k][2], 0, 1), key = ST[k][0], E = ease(u), s = R.A.s;
  const st = { k, u, key, th: 0, lift: 0, door: 1, clamp: true, ready: "idle", gauge: 0 };
  const order = ST.map((x) => x[0]), idx = order.indexOf(key), after = (n) => idx > order.indexOf(n);
  st.door = key === "pos" ? E : key === "door" ? 1 - E : 1;
  st.clamp = !(key === "unc" || after("unc")) || after("cl") || (key === "cl" && u > 0.5);
  if (key === "unc") st.clamp = u < 0.5;
  st.ready = key === "chk" ? (u > 0.4 ? "ready" : "idle") : ["lift", "rot", "low"].includes(key) ? "locked" : key === "cl" ? "locked" : key === "door" ? "done" : "idle";
  if (key === "lift") st.lift = s * E; else if (key === "rot") { st.lift = s; st.th = 180 * E; } else if (key === "low") { st.lift = s * (1 - E); st.th = 180; st.gauge = E; }
  else if (after("low")) { st.th = 180; st.gauge = 1; }
  return st;
}

/* ------------------------------------------------------------------ drawing */
function topSVG(st, R, M) {
  const A = R.A, k = 0.215, CX = 235, CY = 205, r = A.r * k, pa = A.a * k, pb = A.b * k;
  const Rc = R.Rc * k, base = (A.dm / 2 + 90) * k;
  let g = `<text x="8" y="16" class="apc-t" style="font-weight:600">Top view</text>`;
  // machine (left)
  const doorH = (Math.hypot(A.a, A.b) + 80) * k;
  g += `<rect x="6" y="40" width="${CX - 16}" height="330" rx="6" fill="color-mix(in srgb, #3c6e9e 10%, transparent)" stroke="#3c6e9e"/>`;
  g += `<text x="16" y="58" class="apc-t" style="fill:var(--text)">machining centre (HMC)</text>`;
  const wx = CX - 10;
  g += `<line x1="${wx}" y1="40" x2="${wx}" y2="${CY - doorH / 2}" stroke="#3c6e9e" stroke-width="4"/><line x1="${wx}" y1="${CY + doorH / 2}" x2="${wx}" y2="370" stroke="#3c6e9e" stroke-width="4"/>`;
  g += `<line x1="${wx}" y1="${CY - doorH / 2}" x2="${wx}" y2="${CY - doorH / 2 + doorH * (1 - st.door)}" stroke="#e1a32a" stroke-width="5"/>`;
  g += `<text x="${wx - 6}" y="${CY + doorH / 2 + 16}" class="apc-t r">door ${st.door > 0.95 ? "open" : st.door < 0.05 ? "closed" : "moving"}</text>`;
  const mx = CX - r;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g += `<circle cx="${mx + dx * A.pitch / 2 * k}" cy="${CY + dy * A.pitch / 2 * k}" r="6" fill="${st.clamp ? "#2fa84f" : "#e1a32a"}" stroke="#333"/>`;
  g += `<text x="${mx - 20}" y="${CY + pb / 2 + 80}" class="apc-t c">zero-point modules</text><text x="${mx - 20}" y="${CY + pb / 2 + 93}" class="apc-t c" style="fill:${st.clamp ? "var(--good-text)" : "var(--warning)"}">${st.clamp ? "clamped" : "released"}</text>`;
  // station (right) + mounting
  const sx = CX + r;
  g += `<rect x="${sx - pa / 2 - 12}" y="${CY - pb / 2 - 12}" width="${pa + 24}" height="${pb + 24}" rx="4" fill="color-mix(in srgb, #5b7a99 20%, transparent)" stroke="#5b7a99"/>`;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g += `<circle cx="${sx + dx * A.pitch / 2 * k}" cy="${CY + dy * A.pitch / 2 * k}" r="6" fill="#c9d0d6" stroke="#333"/>`;
  g += `<rect x="${sx - pa / 2 - 18}" y="${CY - 10}" width="6" height="20" fill="${["lift", "rot", "low"].includes(st.key) ? "#3a4048" : "#3a4048"}"/>`;
  g += `<text x="${sx + 20}" y="${CY + pb / 2 + 48}" class="apc-t c">load station (receivers)</text>`;
  g += `<circle cx="${CX}" cy="${CY}" r="${base}" fill="color-mix(in srgb, #67717b 25%, transparent)" stroke="#67717b"/><text x="${CX}" y="${CY + base + 13}" class="apc-t c">APC base</text>`;
  if (R.mount === "base") {
    const bx1 = sx - pa / 2 - 12, bx0 = Math.min(CX + base - 4, bx1 - 24);
    g += `<rect x="${bx0}" y="${CY - 34}" width="${bx1 - bx0 + 4}" height="14" fill="#e1a32a" stroke="#9a6b10"/><rect x="${bx0}" y="${CY + 20}" width="${bx1 - bx0 + 4}" height="14" fill="#e1a32a" stroke="#9a6b10"/>`;
    for (const yy of [CY - 27, CY + 27]) g += `<circle cx="${bx0 + 7}" cy="${yy}" r="3.5" fill="#fff" stroke="#333"/><circle cx="${bx1 - 4}" cy="${yy}" r="3.5" fill="#fff" stroke="#333"/>`;
    g += `<text x="${(bx0 + bx1) / 2}" y="${CY - 40}" class="apc-t c">bracket + dowels</text>`;
    for (const yy of [CY - pb / 2 - 4, CY + pb / 2 + 4]) g += `<rect x="${sx + pa / 2 + 4}" y="${yy - 4}" width="8" height="8" fill="#3a4048"/>`;
  } else {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g += `<path d="M${sx + dx * (pa / 2 + 12) - 5},${CY + dy * (pb / 2 + 12)} l10,0 M${sx + dx * (pa / 2 + 12)},${CY + dy * (pb / 2 + 12) - 5} l0,10" stroke="var(--critical)" stroke-width="2"/>`;
    g += `<text x="${sx + 20}" y="${CY + pb / 2 + 62}" class="apc-t c" style="fill:var(--critical)">floor anchors (separate frame)</text>`;
  }
  // AGV + safety zone
  const ax = sx + M.xagv * k;
  g += `<rect x="${ax}" y="${CY - pb / 2 - 25}" width="${470 - ax}" height="${pb + 50}" fill="none" stroke="var(--text-2)" stroke-dasharray="6 4"/><text x="${ax + 6}" y="${CY + 4}" class="apc-t">AGV</text>`;
  g += `<rect x="${sx - pa / 2 - 30}" y="${CY - pb / 2 - 50}" width="${470 - (sx - pa / 2 - 30)}" height="${pb + 100}" fill="none" stroke="${st.ready === "locked" ? "var(--critical)" : "var(--warning)"}" stroke-width="1.5" stroke-dasharray="2 3"/>`;
  g += `<text x="466" y="${CY - pb / 2 - 56}" class="apc-t r">station safety zone (scanner)</text>`;
  // sweep circle
  g += `<circle cx="${CX}" cy="${CY}" r="${Rc}" fill="none" stroke="var(--muted)" stroke-dasharray="5 4"/><text x="${CX}" y="${CY - Rc - 4}" class="apc-t c">sweep circle Ø${f(2 * R.Rc, 0)} (pallet + parts)</text>`;
  // arm + pallets (rotating)
  const lifted = st.lift > 1, sh = lifted ? 4 : 0;
  const pal = (x, lab, col) => `<rect x="${x - pa / 2 + sh}" y="${CY - pb / 2 + sh}" width="${pa}" height="${pb}" fill="rgba(0,0,0,.18)" opacity="${lifted ? 1 : 0}"/>
    <rect x="${x - pa / 2}" y="${CY - pb / 2}" width="${pa}" height="${pb}" rx="3" fill="${col}" stroke="#4a5560" stroke-width="${lifted ? 2 : 1.2}"/>
    <rect x="${x - pa / 4}" y="${CY - pb / 4}" width="${pa / 2}" height="${pb / 2}" fill="none" stroke="#4a5560" stroke-dasharray="3 2"/>`;
  g += `<g transform="rotate(${st.th} ${CX} ${CY})">`;
  g += `<rect x="${CX - r - pa / 2}" y="${CY - pb / 2 - 9}" width="${2 * r + pa}" height="5" fill="#e1a32a"/><rect x="${CX - r - pa / 2}" y="${CY + pb / 2 + 4}" width="${2 * r + pa}" height="5" fill="#e1a32a"/>`;
  g += pal(CX + r, "P1", "#d6e4f0") + pal(CX - r, "P2", "#ead7c0");
  g += `<rect x="${CX - 3}" y="${CY - pb / 2 - 30}" width="6" height="${pb + 60}" fill="#67717b"/></g>`;
  const rad = st.th * Math.PI / 180;
  g += `<text x="${CX + r * Math.cos(rad)}" y="${CY + r * Math.sin(rad) + 4}" class="apc-t c" style="fill:var(--text);font-weight:600">new</text>`;
  g += `<text x="${CX - r * Math.cos(rad)}" y="${CY - r * Math.sin(rad) + 4}" class="apc-t c" style="fill:var(--text);font-weight:600">finished</text>`;
  // status lamp
  const lc = { idle: ["var(--muted)", "station: working"], ready: ["#2fa84f", "station READY for APC"], locked: ["#d03b3b", "station LOCKED (APC moving)"], done: ["#2f7fd0", "finished pallet at the station"] }[st.ready];
  g += `<circle cx="250" cy="388" r="6" fill="${lc[0]}"/><text x="260" y="392" class="apc-t" style="fill:var(--text)">${lc[1]}</text>`;
  g += `<text x="8" y="392" class="apc-t">${lifted ? `lifted ${f(st.lift, 0)} mm` : "lowered"} · arm ${f(st.th, 0)}°</text>`;
  return g;
}

function sideSVG(st, R, M) {
  const A = R.A, X0 = 482, X1 = 752, cx = (X0 + X1) / 2, sc = (X1 - X0 - 10) / (2 * A.r + A.a + 80), fy = 250, Y = (h) => fy - h * sc;
  const c = Math.cos(st.th * Math.PI / 180), sn = Math.abs(Math.sin(st.th * Math.PI / 180));
  let g = `<text x="${X0}" y="16" class="apc-t" style="font-weight:600">Side section along the arm</text>`;
  g += `<line x1="${X0}" y1="${fy}" x2="${X1}" y2="${fy}" class="mx-floor"/>`;
  const mxx = cx - A.r * sc, sxx = cx + A.r * sc, tw = A.a * sc;
  g += `<rect x="${mxx - tw / 2 - 6}" y="${Y(H0)}" width="${tw + 12}" height="${H0 * sc}" fill="color-mix(in srgb, #3c6e9e 18%, transparent)" stroke="#3c6e9e"/><text x="${mxx}" y="${fy - 14}" class="apc-t c">machine</text>`;
  g += `<rect x="${sxx - tw / 2 - 6}" y="${Y(H0)}" width="${tw + 12}" height="${H0 * sc}" fill="color-mix(in srgb, #5b7a99 20%, transparent)" stroke="#5b7a99"/><text x="${sxx}" y="${fy - 14}" class="apc-t c">station</text>`;
  for (const x0 of [mxx, sxx]) for (const d of [-1, 1]) g += `<rect x="${x0 + d * A.pitch / 2 * sc - 4}" y="${Y(H0) - 1}" width="8" height="5" fill="${x0 === mxx ? "#2fa84f" : "#c9d0d6"}" stroke="#333" stroke-width=".6"/>`;
  g += `<line x1="${X0}" y1="${Y(H0)}" x2="${X1}" y2="${Y(H0)}" stroke="var(--accent)" stroke-dasharray="4 3"/><text x="${X1}" y="${fy + 14}" class="apc-t r" style="fill:var(--accent)">- - - H0 = ${H0} mm on BOTH sides (±${M.hdiff})</text>`;
  // APC column + lift
  g += `<rect x="${cx - 14}" y="${Y(H0 - 60 + st.lift)}" width="28" height="${(H0 - 60 + st.lift) * sc}" fill="#9aa4ae" stroke="#67717b"/>`;
  const rl = (A.r + A.a / 2) * Math.abs(c) + (A.b / 2) * sn, railY = Y(H0 - 50 + st.lift);
  g += `<rect x="${cx - rl * sc}" y="${railY}" width="${2 * rl * sc}" height="5" fill="#e1a32a"/>`;
  g += `<rect x="${cx - Math.max(2, (A.b / 2 + 75) * sn * sc)}" y="${Y(H0 + 280 + st.lift)}" width="${Math.max(4, 2 * (A.b / 2 + 75) * sn * sc)}" height="${330 * sc}" fill="#67717b" opacity=".75"/>`;
  // pallets (projected)
  const pw = A.a * Math.abs(c) + A.b * sn, tp = 70;
  const palG = (xc, col, lab) => {
    const x = cx + xc * sc, yb = Y(H0 + st.lift);
    let p = `<rect x="${x - pw / 2 * sc}" y="${yb - tp * sc}" width="${pw * sc}" height="${tp * sc}" fill="${col}" stroke="#4a5560"/>`;
    p += `<rect x="${x - pw / 4 * sc}" y="${yb - (tp + 300) * sc}" width="${pw / 2 * sc}" height="${300 * sc}" fill="none" stroke="#4a5560" stroke-dasharray="3 2"/>`;
    for (const d of [-1, 1]) p += `<rect x="${x + d * A.pitch / 2 * Math.abs(c) * sc - 2}" y="${yb}" width="4" height="${LS * sc}" fill="#3a4048"/>`;
    return p + `<text x="${x}" y="${yb - (tp + 310) * sc}" class="apc-t c" style="font-size:10px">${lab}</text>`;
  };
  g += palG(A.r * c, "#d6e4f0", "new") + palG(-A.r * c, "#ead7c0", "finished");
  if (st.lift > 1) g += `<text x="${cx}" y="${Y(H0 - 120)}" class="apc-t c" style="fill:var(--critical)">↑ ${f(st.lift, 0)} mm – studs ${f(Math.max(0, st.lift - 5 - LS), 0)} mm above the receivers</text>`;
  // catch gauges
  const gauge = (y, lab, err, cat, prog) => {
    const w = 250, x = X0 + 10, v = err * prog, col = err <= cat * 0.8 ? "var(--good)" : err <= cat ? "var(--warning)" : "var(--critical)";
    return `<text x="${x}" y="${y - 6}" class="apc-t" style="fill:var(--text)">${lab}</text><rect x="${x}" y="${y}" width="${w}" height="10" rx="3" fill="var(--surface-2)" stroke="var(--border)"/>
      <rect x="${x}" y="${y}" width="${Math.min(w, w * v / cat)}" height="10" rx="3" fill="${col}"/><text x="${x + w}" y="${y + 24}" class="apc-t r">worst ${f(err, 2)} mm of ±${f(cat, 1)} mm catch</text>`;
  };
  g += `<text x="${X0}" y="282" class="apc-t" style="font-weight:600">When the APC lowers (worst-case errors)</text>`;
  g += gauge(306, "new pallet → machine zero-point", R.wcM, A.cap, st.gauge);
  g += gauge(356, "finished pallet → station receivers", R.wcS, M.rlead, st.gauge);
  return g;
}

/* ------------------------------------------------------------------ UI */
const box4 = $("mxItem4");
if (box4) {
  box4.innerHTML = `
    <div class="kpis" id="m4Kpis"></div>
    <div class="card">
      <div class="card-head"><h2>Pallet change – load station ↔ APC ↔ machine</h2><span class="sub">animation with the times of the Pallet changer tab · click a step to jump</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="m4Play">▶ Play</button><input type="range" id="m4Scrub" min="0" max="1000" value="0" aria-label="Time">
        <span class="tb-label">Station mounting</span><div class="seg" role="group" aria-label="Mounting"><button class="seg-btn active" data-m4mount="base">bolted + dowelled to the APC base</button><button class="seg-btn" data-m4mount="floor">separate floor frame</button></div></div>
      <div class="dk-step" id="m4Step"></div>
      <div class="dk-svg" id="m4Svg"></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Steps</h2></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="m4Steps"></tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>How to mount the station?</h2><span class="sub">the most important decision of this connection</span></div><div class="table-wrap"><table class="apc-bom" id="m4Mount"></table></div><p class="hint" id="m4MountNote"></p></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Accuracy chain: station → machine</h2><span class="sub">new pallet into the zero-point modules</span></div><div class="table-wrap"><table class="apc-bom" id="m4ChM"></table></div></div>
      <div class="card"><div class="card-head"><h2>Accuracy chain: machine → station</h2><span class="sub">finished pallet back onto the receivers</span></div><div class="table-wrap"><table class="apc-bom" id="m4ChS"></table></div></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Interlocks – who may move when</h2><span class="sub">program them in the safety PLC, not only in the HMI</span></div><div class="table-wrap"><table class="apc-bom" id="m4Ilk"></table></div></div>
      <div class="card"><div class="card-head"><h2>Signals station PLC ↔ machine / APC</h2></div><div class="table-wrap"><table class="apc-bom" id="m4Sig"></table></div></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Inputs</h2><button class="btn ghost" id="m4Reset">Example values</button></div><div id="m4Inputs"></div>
        <p class="hint">Pallet size, arm radius, lift stroke, times, gear backlash and the zero-point catch range come from the Pallet changer tab.</p></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="m4Checks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="m4Calc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Bill of materials – connection parts</h2><span class="sub">MAKE = you manufacture · BUY = catalogue / supplier</span></div><div class="table-wrap"><table id="m4Bom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – installation, alignment with a master pallet, tests, maintenance</h2></div><div id="m4Guide" class="mx-guide"></div></div>`;

  let M = { ...DEF }, mount = "base";
  try { const sv = JSON.parse(localStorage.getItem("mech4State") || "{}"); mount = sv._mount || "base"; delete sv._mount; Object.assign(M, sv); } catch (er) { /* private window */ }
  let A = apcCtx(), R = calc(M, A, mount), T = 0, playing = false, last = performance.now(), started = false;
  const pane = $("tab-mech"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const save = () => { try { localStorage.setItem("mech4State", JSON.stringify({ ...M, _mount: mount })); } catch (er) { /* ignore */ } };

  function inputs() {
    $("m4Inputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Zero-point catches the new pallet", R.wcM <= A.cap * 0.8, R.wcM <= A.cap, `worst ${f(R.wcM, 2)} mm (RSS ${f(R.rsM, 2)}) ≤ ±${A.cap} mm`);
    add("Receivers catch the finished pallet", R.wcS <= M.rlead * 0.5, R.wcS <= M.rlead, `worst ${f(R.wcS, 2)} mm ≤ ±${M.rlead} mm`);
    add("Same height station / machine", M.hdiff <= 0.1, M.hdiff <= 0.3, `±${M.hdiff} mm (aim ±0.1)`);
    add("Studs leave the receivers when lifted", R.studLift >= 5, R.studLift >= 2, `${R.studLift} mm free (stroke ${A.s} − 5 − stud ${LS})`);
    add("Pallet does not slide on the fork rails", R.slipSF >= 1.5, R.slipSF >= 1.1, `friction ${f(R.aFr, 2)} m/s² vs resultant ${f(R.ares, 2)} m/s² (α·r + ω²·r) → ×${f(R.slipSF, 2)}${R.slipSF < 1.5 ? " – add locating blocks" : ""}`);
    add("AGV outside the sweep circle", R.agvClr >= 30, R.agvClr >= 10, R.agvClr < 10 ? `parts reach ${f(-R.agvClr, 0)} mm into the AGV bumper → AGV must stop further away (+${f(30 - R.agvClr, 0)} mm) or leave before every change` : `${f(R.agvClr, 0)} mm between the parts and the AGV bumper`);
    if (mount === "base") add("Bolted joint holds the stop force", R.jUse <= 0.5, R.jUse <= 1, `${f(R.Fjoint / 1000, 2)} kN of ${f(R.Fcap / 1000, 0)} kN friction grip (${f(R.jUse * 100, 0)} %)`);
    else add("Floor frame stays aligned", R.eMount <= A.cap * 0.4, R.eMount <= A.cap * 0.6, `±${f(R.eMount, 2)} mm after ${M.years} year(s) – re-align more often or dowel to the APC base`);
    add("Thermal growth small", R.eTh <= A.cap * 0.1, R.eTh <= A.cap * 0.25, `${f(R.eTh, 3)} mm at ΔT ${M.dT} K`);
    add("Arm angle error (gear backlash)", A.dpos <= A.cap * 0.5, A.dpos <= A.cap * 0.8, `${f(A.dpos, 2)} mm at r = ${A.r} mm`);
    return c;
  }
  function tables() {
    const ch = (rows, wc, rs, cat, lab) => `<thead><tr><th>Contributor</th><th>± mm</th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${f(v, v < 0.1 ? 3 : 2)}</td></tr>`).join("")}
      <tr><td><b>Worst case (all add up)</b></td><td><b>${f(wc, 2)}</b></td></tr><tr><td>Statistical (RSS = √Σe²)</td><td>${f(rs, 2)}</td></tr>
      <tr><td><b>${esc(lab)}</b></td><td><b>±${f(cat, 2)}</b></td></tr></tbody>`;
    $("m4ChM").innerHTML = ch(R.chM, R.wcM, R.rsM, A.cap, "Zero-point taper catches");
    $("m4ChS").innerHTML = ch(R.chS, R.wcS, R.rsS, M.rlead, "Station receivers catch");
    const eF = M.eFloor + M.drift * M.years;
    $("m4Mount").innerHTML = `<thead><tr><th></th><th>A · bolted + dowelled to the APC base</th><th>B · separate floor frame</th></tr></thead><tbody>
      <tr><td>Position to the APC axis</td><td><b>±${M.eDow} mm</b> – dowels keep it</td><td>±${M.eFloor} mm when set, <b>±${f(eF, 2)} mm</b> after ${M.years} year(s)</td></tr>
      <tr><td>Who carries the weight</td><td>2 levelling feet under the outer end (${f(R.Ffeet / 1000, 1)} kN each), the bracket only <b>locates</b></td><td>4 feet + anchors</td></tr>
      <tr><td>AGV docking shocks</td><td colspan="2">go into the separate buffer posts on the floor (mech. item 1) – never into the station or the APC</td></tr>
      <tr><td>Machine moved / re-levelled</td><td>station moves with the APC – no re-alignment</td><td>re-align the station every time</td></tr>
      <tr><td>Effort</td><td>bracket machined, dowel holes reamed on site after alignment</td><td>simple, but alignment check every ${M.years} year(s)</td></tr></tbody>`;
    $("m4MountNote").innerHTML = mount === "base" ? "Selected: <b>A</b>. Recommended – the station and the APC become one rigid unit; the floor does not matter any more." : "Selected: <b>B</b>. Works, but the floor drift eats the catch range of the zero-point modules. Plan a yearly check with the master pallet.";
    $("m4Ilk").innerHTML = `<thead><tr><th>Movement</th><th>Allowed only if</th><th>Signal type</th></tr></thead><tbody>
      <tr><td><b>APC lift / rotate</b></td><td>station chains DOWN · retractable stop DOWN · no transfer running · AGV not docked · station zone free · pallet at station seated (air) or station empty · machine door open, spindle stopped</td><td>safety (F-DI, 2 channels) + standard</td></tr>
      <tr><td><b>Station chains / stop</b></td><td>APC lowered AND at end position 0° or 180° AND standstill monitored</td><td>safety (APC standstill) + standard</td></tr>
      <tr><td><b>AGV docks / transfers</b></td><td>station not LOCKED · APC standstill · E84 handshake</td><td>E84 optical + standard</td></tr>
      <tr><td><b>Person enters the station zone</b></td><td>APC rotation stops (safe stop 1 → STO), lift held by the valve</td><td>safety scanner → safety PLC</td></tr>
      <tr><td><b>E-stop (any)</b></td><td>machine, APC and station stop together</td><td>hard-wired E-stop chain both ways</td></tr></tbody>`;
    $("m4Sig").innerHTML = `<thead><tr><th>Signal</th><th>From → to</th><th>Type</th></tr></thead><tbody>
      <tr><td>Station READY for APC (chains + stop down, no transfer, seated)</td><td>station → APC</td><td>Profinet + hard-wired</td></tr>
      <tr><td>Station zone free (scanner, AGV out)</td><td>station → APC</td><td>safety, 2 channels</td></tr>
      <tr><td>Pallet seated at station (air check)</td><td>station → APC</td><td>Profinet</td></tr>
      <tr><td>Pallet ID (RFID at the station) → NC program</td><td>station → CNC</td><td>Profinet / OPC UA</td></tr>
      <tr><td>APC lowered + at 0° / 180°, standstill</td><td>APC → station</td><td>safety + standard</td></tr>
      <tr><td>APC moving → station LOCKED</td><td>APC → station</td><td>safety</td></tr>
      <tr><td>Change done – finished pallet at station</td><td>APC → station → fleet manager</td><td>Profinet → MES / AGV</td></tr>
      <tr><td>E-stop chain</td><td>both ways</td><td>hard-wired</td></tr></tbody>`;
    const bom = [["Adapter bracket station ↔ APC base", "MAKE", 2, "S355 30 mm, faces machined, slotted holes ±3 mm for alignment", mount === "base" ? "" : "not needed (floor frame)"],
      ["Dowel pins Ø12 m6 + hardened bushes", "BUY", 4, "reamed on site after alignment", mount === "base" ? "" : "–"], ["Bolts M16 10.9 + washers", "BUY", M.nb, `preload ${M.Fv} kN, torque from the table`, ""],
      ["Levelling feet M24 with lock nut + pad", "BUY", mount === "base" ? 2 : 4, `${f(R.Ffeet / 1000, 1)} kN each`, ""], ["Chemical anchors M12", "BUY", mount === "base" ? 2 : 4, "fix the feet sideways", ""],
      ["Stainless shims 0.05 – 1 mm", "BUY", 1, "set", "height to ±0.1 mm"], ["Locating blocks on the APC fork rails", "MAKE", 4, "hardened, 0.1 mm clearance to the ledges", "keep the pallet during rotation"],
      ["Air blow nozzles at the receivers", "BUY", 4, "clean studs + faces before seating", ""], ["Air seat check (4 nozzles → pressure switch)", "BUY", 1, "", "'pallet seated' at the station"],
      ["Drip tray + chip guard under the station", "MAKE", 1, "stainless, slope to drain", "finished pallet brings coolant + chips"], ["RFID reader + tag per pallet", "BUY", 1, "", "pallet ID → NC program"],
      ["Sensors: chains down, stop down", "BUY", 4, "inductive, 2 per function", ""], ["Safety laser scanner for the station zone", "BUY", 1, "PL d", "or light curtain with muting"],
      ["Interface cable station ↔ machine (Profinet + safety + E-stop)", "BUY", 1, "", ""], ["Master pallet (ground studs, dial-gauge seats)", "BUY / MAKE", 1, "", "for alignment + yearly checks"]];
    $("m4Bom").innerHTML = `<thead><tr><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${bom.map((b) => `<tr><td>${esc(b[0])}</td><td>${esc(b[1])}</td><td>${b[2]}</td><td>${esc(b[3])}</td><td>${esc(b[4])}</td></tr>`).join("")}</tbody>`;
    $("m4Guide").innerHTML = `
      <h3>Who does what</h3><table class="apc-bom"><thead><tr><th></th><th>Machine / APC builder</th><th>You (station)</th></tr></thead><tbody>
        <tr><td>Reference</td><td>APC axis, zero-point height H0 = ${H0} mm, end positions 0° / 180°</td><td>station receivers aligned to the APC</td></tr>
        <tr><td>Interface</td><td>bolting face + 2 dowel holes on the APC base, interface signals</td><td>bracket, station, sensors, scanner, PLC program</td></tr></tbody></table>
      <h3>Installation + alignment (with a master pallet)</h3><ol>
        <li>Machine and APC are installed and levelled first (machine builder). Never align the station to the floor – always to the APC.</li>
        <li>${mount === "base" ? "Bolt the brackets to the APC base (slotted holes, bolts hand-tight). Set the 2 levelling feet under the outer end." : "Set the station frame on its 4 levelling feet, anchors not yet tightened."}</li>
        <li><b>Height:</b> precision level (0.02 mm/m) across the 4 receiver faces, then dial gauge on the APC fork rail: receiver faces at the same height as the machine zero-point faces ±${M.hdiff} mm → shims.</li>
        <li><b>Position:</b> clamp the master pallet in the machine. Lift, turn 180° and lower in slow manual mode until the studs are 2 mm above the receivers. Measure stud ↔ receiver bore in x and y (dial gauge / feeler). Move the station to ±0.05 mm.</li>
        <li>${mount === "base" ? "Tighten the bolts (torque wrench), then <b>drill + ream the dowel holes through bracket and APC base</b> and insert the dowels. From now on the position cannot change." : "Tighten the anchors, check again, mark the feet. Write the values in the machine log."}</li>
        <li>Turn back with the master pallet: check that it drops into the zero-point modules without force (air seat check OK, no scratch on the taper).</li>
        <li>Set the safety scanner field, test every interlock of the table above (try to start the APC with chains up, stop up, AGV docked, person in the zone – it must refuse).</li></ol>
      <h3>Acceptance tests</h3><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Pass if</th></tr></thead><tbody>
        <tr><td>Repeatability</td><td>100 pallet changes with a loaded pallet</td><td>seat check OK every time (station and machine)</td></tr>
        <tr><td>Position</td><td>master pallet: dial gauge on the stud at the station after 10 changes</td><td>scatter ≤ 0.05 mm</td></tr>
        <tr><td>Interlocks</td><td>each condition of the interlock table, one by one</td><td>APC / station refuse to move</td></tr>
        <tr><td>Clearance</td><td>turn slowly with the biggest fixture + parts</td><td>≥ 30 mm to the AGV, stop and brackets</td></tr></tbody></table>
      <h3>Maintenance</h3><ul><li>Daily: blow the receivers clean, check the drip tray. Weekly: air seat check function.</li>
        <li>Every 6 months${mount === "floor" ? " (floor frame: every 3 months)" : ""}: master pallet check of height + position. After any crash: full alignment check before production.</li>
        <li>Wear of the fork rail locating blocks: replace at 0.2 mm clearance.</li></ul>`;
  }
  function formulas() {
    $("m4Calc").innerHTML = [
      blk("1 · Accuracy chain station → machine", [R.chM.map((r) => f(r[1], 3)).join(" + ") + ` = <b>${f(R.wcM, 2)} mm</b> worst`, `RSS = √(Σ e²) = ${f(R.rsM, 2)} mm   (catch ±${A.cap} mm)`],
        "Worst case = all errors in the same direction at the same time. RSS is the realistic value. Design with the worst case."),
      blk("2 · Arm angle error", [`e = r · backlash = ${A.r} · ${A.backlash}/60 · π/180 = <b>${f(A.dpos, 2)} mm</b>`], "This is often the biggest part – a smaller backlash or a mechanical index (taper pin) at 0° / 180° reduces it."),
      blk("3 · Pallet on the rails during rotation", [`a_t = α · r = ${f(A.al, 2)} · ${f(A.r / 1000, 2)} = ${f(R.at, 2)} m/s²`, `a_c = ω² · r = ${f(A.om, 2)}² · ${f(A.r / 1000, 2)} = ${f(R.ac, 2)} m/s²`, `a_res = √(a_t² + a_c²) = ${f(R.ares, 2)} m/s²`, `friction holds μ · g = ${M.muR} · 9.81 = ${f(R.aFr, 2)} m/s² → ×${f(R.slipSF, 2)}`]),
      blk("4 · Thermal growth", [`Δ = α · r · ΔT = 11.5e-6 · ${A.r} · ${M.dT} = <b>${f(R.eTh, 3)} mm</b>`]),
      blk("5 · Clearances", [`stud free  = stroke − 5 − stud = ${A.s} − 5 − ${LS} = ${R.studLift} mm`, `sweep radius = √((r + a/2 + ovh)² + (b/2 + ovh)²) = ${f(R.Rc, 0)} mm`, `AGV bumper at r + ${M.xagv} = ${A.r + M.xagv} mm → clearance ${f(R.agvClr, 0)} mm`]),
      blk("6 · Bolted joint (A)", [`stop force F = m·v²/(2·s) + μ·m·g = ${f(R.Fst, 0)} N, ×1.5 = ${f(R.Fjoint, 0)} N`, `friction grip = n · μ · Fv = ${M.nb} · ${M.muJ} · ${M.Fv} kN = ${f(R.Fcap / 1000, 0)} kN`], "The dowels locate, the friction of the preloaded bolts carries the force – dowels must not carry load."),
    ].join("");
  }
  function render() {
    A = apcCtx(); R = calc(M, A, mount); T = Math.min(T, R.tch);
    const ch = checks();
    $("m4Kpis").innerHTML = [["Change time", f(R.tch, 1) + " s", "from the Pallet changer tab"], ["Station → machine", "±" + f(R.wcM, 2) + " mm", `worst case, zero-point catches ±${A.cap}`],
      ["Machine → station", "±" + f(R.wcS, 2) + " mm", `receivers catch ±${M.rlead}`], ["Height difference", "±" + M.hdiff + " mm", "station vs machine"],
      ["Mounting", mount === "base" ? "on APC base" : "floor frame", `±${f(R.eMount, 2)} mm`],
      ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("m4Checks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    tables(); formulas(); draw();
  }
  function draw() {
    const st = stateAt(T, R);
    $("m4Svg").innerHTML = `<svg viewBox="0 0 760 400" class="apc-svg" aria-label="Pallet change between load station, APC and machine">${topSVG(st, R, M)}${sideSVG(st, R, M)}</svg>`;
    $("m4Step").innerHTML = `<span class="dk-n">${st.k + 1}/${R.steps.length}</span> <b>${esc(R.steps[st.k][1])}</b><span class="dk-err">${f(T, 1)} / ${f(R.tch, 1)} s</span>`;
    $("m4Scrub").value = Math.round(T / R.tch * 1000); $("m4Play").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("m4Steps").innerHTML = R.steps.map((r, i) => `<tr class="${i === st.k ? "on" : ""}" data-m4k="${i}" style="cursor:pointer"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
  }
  function init() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || box4.hidden || !playing) return;
      T += dt * 0.5; if (T >= R.tch) { T = R.tch; playing = false; } draw(); };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("m4Inputs").addEventListener("change", (ev) => {
    const k = ev.target.dataset.k; if (!k) return;
    const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v < 0) { ev.target.value = M[k]; return; }
    M[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]); save(); render();
  });
  $("m4Reset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; mount = "base"; try { localStorage.removeItem("mech4State"); } catch (er) { /* ignore */ }
    box4.querySelectorAll("[data-m4mount]").forEach((x) => x.classList.toggle("active", x.dataset.m4mount === mount)); inputs(); render(); });
  $("m4Play").addEventListener("click", () => { if (!playing && T >= R.tch) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("m4Scrub").addEventListener("input", (ev) => { playing = false; T = R.tch * ev.target.value / 1000; draw(); });
  $("m4Steps").addEventListener("click", (ev) => { const tr = ev.target.closest("[data-m4k]"); if (!tr) return; playing = false; T = R.steps.slice(0, +tr.dataset.m4k).reduce((a, r) => a + r[2], 0) + 0.01; draw(); });
  box4.querySelectorAll("[data-m4mount]").forEach((b) => {
    b.classList.toggle("active", b.dataset.m4mount === mount);
    b.addEventListener("click", () => { mount = b.dataset.m4mount; box4.querySelectorAll("[data-m4mount]").forEach((x) => x.classList.toggle("active", x === b)); save(); render(); });
  });
  window.mech4 = { show() { render(); init(); } };
  const q = new URLSearchParams(location.search);
  if (q.get("m4mount")) { const b = box4.querySelector(`[data-m4mount="${q.get("m4mount")}"]`); if (b) b.click(); }
  if (q.get("m4t")) setTimeout(() => { T = Math.min(R.tch, parseFloat(q.get("m4t")) || 0); draw(); }, 400);
}
