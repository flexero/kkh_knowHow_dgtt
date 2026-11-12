/* HMC build tab - item 1: rotary table (B-axis) with worm drive - how to machine the parts and assemble it in reality.
   Half/full cross-section drawing with a step-by-step assembly animation, duplex worm backlash adjustment (interactive),
   contact pattern, process plans for every part you make (operations, machines, tolerances, checks), assembly + measuring
   steps, design calculations (worm gear, self-locking, motor, clamp, bearing tilting moment, positioning accuracy),
   bill of materials, acceptance tests (ISO 230-2 / ISO 10791).  Pallet data come from the Pallet changer tab (window.APC).
   All values are examples - use catalogue data of the chosen bearing, encoder, servo and clamp.  Offline, no libraries. */

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, RAD = Math.PI / 180, SEC = 180 / Math.PI * 3600;
const ease = (u) => u * u * (3 - 2 * u), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SERVOS = [
  { kw: 0.4, tn: 1.3, tmax: 3.8, nmax: 6000 }, { kw: 0.75, tn: 2.4, tmax: 7.2, nmax: 6000 }, { kw: 1.5, tn: 4.8, tmax: 14.3, nmax: 5000 },
  { kw: 2.0, tn: 6.4, tmax: 19, nmax: 5000 }, { kw: 3.0, tn: 9.6, tmax: 29, nmax: 4500 }, { kw: 4.5, tn: 14.3, tmax: 43, nmax: 4000 }];

const GROUPS = [
  ["Rotating parts", [
    ["mt", "Table + hub + worm wheel mass", "kg", 220, ""],
    ["Rt", "Table radius", "mm", 290, "Ø580 table for a 500 pallet"],
    ["nmax", "Max. table speed", "rpm", 20, "HMC B-axis 10–30 rpm"],
    ["ta", "Acceleration time", "s", 0.4, ""]]],
  ["Worm gear (duplex worm)", [
    ["z1", "Worm starts", "", 1, ""],
    ["z2", "Worm wheel teeth (= ratio)", "", 90, "HMC: 1:90 – 1:360"],
    ["m", "Axial module", "mm", 4, ""],
    ["d1", "Worm pitch diameter", "mm", 50, ""],
    ["b2", "Worm wheel face width", "mm", 36, ""],
    ["mu", "Friction (ground worm / bronze, oil)", "", 0.03, "0.02–0.05"],
    ["cB", "Allowed tooth load factor c (Bach)", "N/mm²", 6, "bronze / hardened steel, slow"],
    ["dp", "Duplex: lead difference L/R flank", "mm", 0.2, "per pitch"],
    ["j0", "Backlash as hobbed (start)", "mm", 0.05, ""],
    ["jt", "Target backlash", "mm", 0.008, "0.005–0.010"]]],
  ["Loads + clamp", [
    ["Fc", "Cutting force (side)", "N", 4000, "Pallet changer tab"],
    ["rc", "Cutting radius from the B-axis", "mm", 250, ""],
    ["hcut", "Cutting height above the bearing", "mm", 450, "table + pallet + fixture"],
    ["S", "Safety factor", "", 2, ""],
    ["Tcl", "Clamp holding torque (catalogue)", "N·m", 3000, "hydraulic clamp ring, 5 MPa"],
    ["Mka", "Bearing allowed tilting moment", "kN·m", 25, "axial-radial roller bearing, catalogue"],
    ["C0a", "Bearing static axial load rating", "kN", 900, "catalogue"]]],
  ["Accuracy", [
    ["enc", "Angle encoder accuracy", "± ″", 2.5, "arc seconds"],
    ["ecc", "Encoder scale eccentricity after centring", "mm", 0.005, ""],
    ["Rs", "Encoder scale radius", "mm", 105, ""],
    ["heads", "Read heads", "", 2, "2 opposite heads cancel the eccentricity"],
    ["Fp", "Worm wheel cumulative pitch error", "± ″", 12, "DIN 3974 class 5"],
    ["dT", "Temperature rise of the table", "K", 5, ""]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

function apcCtx() {
  const A = window.APC && window.APC.get && window.APC.get();
  const P = A ? A.P : { a: 500, b: 500, mp: 110, mw: 400, e: 50, hc: 250, pitch: 400 };
  return { a: P.a, b: P.b, mp: P.mp, mw: P.mw, e: P.e, hc: P.hc, pitch: P.pitch, mpl: P.mp + P.mw };
}

/* ------------------------------------------------------------------ calculation */
function calc(M, A) {
  const R = { A };
  R.i = M.z2 / M.z1; R.d2 = M.m * M.z2; R.px = Math.PI * M.m; R.a = (M.d1 + R.d2) / 2;
  R.gam = Math.atan(M.z1 * M.m / M.d1); R.rho = Math.atan(M.mu / Math.cos(20 * RAD));
  R.eta = Math.tan(R.gam) / Math.tan(R.gam + R.rho);
  R.etaB = R.gam > R.rho ? Math.tan(R.gam - R.rho) / Math.tan(R.gam) : 0; R.selfLock = R.gam <= R.rho;
  R.vs = Math.PI * M.d1 / 1000 * (M.nmax * R.i) / 60 / Math.cos(R.gam);              // sliding speed m/s
  // inertia + motor
  R.Jt = 0.5 * M.mt * (M.Rt / 1000) ** 2; R.Jp = A.mpl * ((A.a / 1000) ** 2 + (A.b / 1000) ** 2) / 12 + A.mw * (A.e / 1000) ** 2;
  R.J = R.Jt + R.Jp; R.om = 2 * Math.PI * M.nmax / 60; R.al = R.om / M.ta; R.Tacc = R.J * R.al * 1.1;
  R.nm = M.nmax * R.i; R.Tm = R.Tacc / (R.i * R.eta);
  R.servo = SERVOS.find((s) => s.tmax >= R.Tm * 1.3 && s.nmax >= R.nm) || null;
  // loads
  R.Tc = M.Fc * M.rc / 1000; R.TclNeed = M.S * R.Tc;
  R.Ft2 = 2 * R.Tc / (R.d2 / 1000); R.Ft2a = M.cB * M.b2 * R.px; R.Ft2acc = 2 * R.Tacc / (R.d2 / 1000);
  R.FcSim = R.Ft2a * R.d2 / 2 / M.rc;                                                  // allowed cutting force while the table turns (worm loaded)
  R.Mk = (M.Fc * M.hcut / 1000 + A.mw * G * A.e / 1000) / 1000; R.Fa = (A.mpl + M.mt) * G / 1000;
  // backlash (duplex worm): axial shift s changes the tooth thickness in mesh by s · dp / px
  R.jPerMm = M.dp / R.px; R.sAdj = (M.j0 - M.jt) / R.jPerMm; R.jSec = M.jt / (R.d2 / 2) * SEC;
  // accuracy
  R.eEcc = M.heads >= 2 ? 0 : M.ecc / M.Rs * SEC; R.eTh = 1.0;                         // 1″ thermal drift (example)
  R.accEnc = Math.sqrt(M.enc ** 2 + R.eEcc ** 2 + R.eTh ** 2);
  R.accNo = M.Fp + R.jSec / 2 + R.eTh;
  R.atEdge = (sec) => sec / SEC * A.a / 2;                                            // mm at the pallet edge
  return R;
}

/* ------------------------------------------------------------------ parts, section geometry (mm, x from the axis, y up) */
// rects [x0, y0, x1, y1] mirrored unless one-sided
const PARTS = {
  housing: { n: "Housing", col: "#9aa4ae", rects: [[0, 0, 350, 25], [310, 0, 350, 250], [150, 152, 310, 172], [150, 172, 172, 230], [290, 172, 310, 232]] },
  bearing: { n: "Main bearing (axial-radial roller)", col: "#c9a227", rects: [[100, 230, 170, 275]] },
  table: { n: "Table top + hub sleeve", col: "#6f8fb0", rects: [[0, 275, 290, 345], [80, 140, 100, 275]] },
  wheel: { n: "Worm wheel (bronze rim on steel hub)", col: "#b87333", rects: [[80, 100, 150, 140], [150, 102, 184, 138]] },
  worm: { n: "Duplex worm + bearing cartridge", col: "#556270", one: true },
  clamp: { n: "Hydraulic clamp ring + clamp disc", col: "#d0703a", rects: [[240, 232, 305, 250], [236, 254, 300, 262], [280, 262, 290, 275]] },
  encoder: { n: "Angle encoder (scale ring + 2 read heads)", col: "#2f9e8f", rects: [[100, 185, 108, 205], [112, 186, 135, 204], [128, 172, 150, 186]] },
  union: { n: "Rotary union (hydraulics + air)", col: "#7d5ba6", rects: [[0, 25, 45, 110], [0, 110, 28, 275]] },
  seal: { n: "Labyrinth cover + seals", col: "#444", rects: [[302, 250, 350, 260]] },
  zp: { n: "Zero-point modules (4)", col: "#2f6fb0", rects: [[175, 305, 225, 345]] },
  pallet: { n: "Test pallet", col: "#c9d0d6", rects: [[0, 345, 250, 415], [193, 322, 207, 345]] },
};
const SHORT = { housing: "Housing", bearing: "Main bearing", table: "Table", wheel: "Worm wheel", clamp: "Clamp", encoder: "Encoder", union: "Rotary union", seal: "Seal", zp: "Zero-point", pallet: "Pallet" };
const STEPS = [
  { k: "housing", add: ["housing"], t: "Clean the housing, check the CMM report, set it on 3 points on the assembly plate and level it (0.02 mm/m)", chk: "base face flatness 0.005 mm · bores as per CMM report", at: [330, 250] },
  { k: "bearing", add: ["bearing"], t: "Fit the main axial-radial bearing on the seat ring. Tighten the screws crosswise in 3 stages (30 / 70 / 100 % torque)", chk: "axial runout of the bearing face ≤ 0.003 mm", at: [135, 230] },
  { k: "table", add: ["table"], t: "Lower the table with its hub sleeve through the bearing and bolt it to the inner ring (crosswise, torque wrench)", chk: "table top: radial + axial runout ≤ 0.005 mm (dial gauge, turn by hand)", at: [290, 345] },
  { k: "wheel", add: ["wheel"], t: "From below: bolt the worm wheel to the hub sleeve with 2 dowels. Shim so the wheel mid-plane is on the worm axis", chk: "wheel runout radial + axial ≤ 0.01 mm · mid-plane ±0.02 mm", at: [184, 120] },
  { k: "worm", add: ["worm"], t: "Insert the worm cartridge from the side: preloaded angular contact pair on the motor side (fixed), needle bearing on the other side (floating)", chk: "worm axial play 0 · bearing friction torque as specified", at: [205, 150] },
  { k: "mesh", add: [], hl: ["worm", "wheel"], t: "Contact pattern: paint the worm with marking paste, turn both directions, look at the pattern on the wheel. Move the wheel axially (shims) until the pattern is in the middle, ≥ 60 % of the flank", chk: "pattern centred, slightly towards the mesh exit side (oil can enter)", at: [184, 102] },
  { k: "back", add: [], hl: ["worm"], t: "Backlash: shift the DUPLEX worm axially (grind the spacer ring to size) until the backlash is 0.005–0.010 mm at the wheel pitch circle", chk: "dial gauge on the table edge, worm locked, turn the table + / −", at: [290, 320] },
  { k: "clamp", add: ["clamp"], t: "Fit the hydraulic clamp ring and the clamp disc. Pressure test 1.5 × p. Holding torque test with a lever + load cell", chk: "no leak · holding torque ≥ required · table does not move when clamping (≤ 1″)", at: [270, 252] },
  { k: "encoder", add: ["encoder"], t: "Fit the angle encoder scale on the sleeve and centre it (dial gauge). Fit the 2 read heads exactly opposite – they cancel the eccentricity", chk: "scale runout ≤ 0.005 mm · signal amplitude OK on both heads", at: [104, 205] },
  { k: "union", add: ["union"], t: "Fit the rotary union (hydraulics for the pallet clamping, air for the seat check). Pressure + leak test", chk: "leak ≤ catalogue value at 1.5 × p, turning torque small", at: [30, 110] },
  { k: "seal", add: ["seal"], t: "Labyrinth cover, seals, sealing air. Fill the worm oil to the sight glass", chk: "oil level, sealing air 0.5 bar", at: [330, 260] },
  { k: "zp", add: ["zp"], t: "Fit the 4 zero-point modules into the table bores and connect the channels", chk: "release / clamp function, pressure test", at: [200, 345] },
  { k: "grind", add: [], hl: ["table", "zp"], t: "Final: grind / fine-machine the table top and the module faces IN THE TABLE'S OWN BEARING (the table turns while it is machined)", chk: "flatness 0.005 mm · parallel to the base 0.01 mm · module faces same height ±0.003", at: [150, 345] },
  { k: "test", add: ["pallet"], t: "Servo connected and tuned, 2 h run-in at changing speed, then measure positioning (ISO 230-2), clamp, temperature, seat check with a test pallet", chk: "accuracy + repeatability per spec · temperature rise ≤ 15 K · no noise", at: [125, 415] },
];

/* ------------------------------------------------------------------ section drawing */
function sectionSVG(step, u, M, R, pick) {
  const W = 760, H = 500, k = 0.95, cx = 380, fy = 470, X = (x) => cx + x * k, Y = (y) => fy - y * k;
  const shown = new Set(); STEPS.slice(0, step + 1).forEach((s) => s.add.forEach((p) => shown.add(p)));
  const cur = STEPS[step], hl = new Set([...(cur.add || []), ...(cur.hl || [])]);
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Rotary table cross-section, assembly step ${step + 1}">`;
  g += `<defs><pattern id="hrHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,.25)" stroke-width="1"/></pattern></defs>`;
  g += `<text x="10" y="18" class="apc-t" style="font-weight:600">Cross-section through the B-axis (example sizes, 1 : ${f(1 / k * 10, 0)} on screen)</text>`;
  g += `<line x1="${cx}" y1="30" x2="${cx}" y2="${fy + 10}" class="mx-axis"/><text x="${cx + 4}" y="40" class="apc-t">B-axis</text>`;
  g += `<line x1="20" y1="${fy}" x2="${W - 20}" y2="${fy}" class="mx-floor"/>`;
  for (const key of Object.keys(PARTS)) {
    if (!shown.has(key)) continue;
    const P = PARTS[key], isNew = (cur.add || []).includes(key), dy = isNew ? (1 - ease(u)) * 90 : 0, dx = isNew && key === "worm" ? (1 - ease(u)) * 120 : 0;
    const on = hl.has(key) || pick === key, op = isNew ? Math.min(1, u * 2) : 1;
    const st = `fill="${P.col}" fill-opacity="${on ? 0.95 : 0.6}" stroke="${on ? "var(--critical)" : "#333"}" stroke-width="${on ? 2 : 0.8}"`;
    g += `<g data-hrpart="${key}" style="cursor:pointer" opacity="${op.toFixed(2)}" transform="translate(${dx * k},${-dy * k})">`;
    if (key === "worm") {
      const wx = X(R.a), wy = Y(120), ro = (M.d1 / 2 + M.m) * k, rp = M.d1 / 2 * k;
      g += `<circle cx="${wx}" cy="${wy}" r="${ro}" ${st}/><circle cx="${wx}" cy="${wy}" r="${rp}" fill="none" stroke="#fff" stroke-dasharray="3 2"/><circle cx="${wx}" cy="${wy}" r="${12 * k}" fill="#333"/>`;
      g += `<text x="${wx + ro + 4}" y="${wy + 4}" class="apc-t">worm (axis ⟂ page)</text>`;
    } else {
      for (const [x0, y0, x1, y1] of P.rects) for (const sgn of P.one ? [1] : [1, -1]) {
        const xa = X(sgn * x0), xb = X(sgn * x1);
        g += `<rect x="${Math.min(xa, xb)}" y="${Y(y1)}" width="${Math.abs(xb - xa)}" height="${(y1 - y0) * k}" ${st}/>`;
        if (key !== "pallet" && key !== "seal") g += `<rect x="${Math.min(xa, xb)}" y="${Y(y1)}" width="${Math.abs(xb - xa)}" height="${(y1 - y0) * k}" fill="url(#hrHatch)" pointer-events="none"/>`;
      }
      if (key === "bearing") for (const sgn of [1, -1]) for (const [xx, yy] of [[125, 262], [145, 262], [160, 243]]) g += `<circle cx="${X(sgn * xx)}" cy="${Y(yy)}" r="${6 * k}" fill="#fff" stroke="#333" stroke-width=".7"/>`;
    }
    g += `</g>`;
  }
  // labels (left side, for parts already shown)
  const lab = [["table", 290, 330], ["bearing", 130, 255], ["wheel", 170, 115], ["clamp", 270, 245], ["encoder", 120, 195], ["union", 20, 70], ["housing", 330, 120], ["zp", 200, 325], ["pallet", 150, 400], ["seal", 330, 256]];
  let ly = 60;
  for (const [key, x, y] of lab) {
    if (!shown.has(key)) continue;
    const on = hl.has(key);
    g += `<line x1="${X(-x)}" y1="${Y(y)}" x2="70" y2="${ly}" stroke="${on ? "var(--critical)" : "var(--grid)"}"/><text x="66" y="${ly + 4}" class="apc-t r" style="${on ? "fill:var(--critical);font-weight:600" : ""}">${esc(SHORT[key])}</text>`;
    ly += 36;
  }
  // check marker (dial gauge)
  if (cur.chk) {
    const [mx, my] = cur.at, px = X(mx), py = Y(my);
    g += `<g opacity="${clamp(u * 2 - 0.6, 0, 1).toFixed(2)}"><line x1="${px}" y1="${py}" x2="${px + 26}" y2="${py - 30}" stroke="var(--critical)" stroke-width="1.5"/><circle cx="${px + 34}" cy="${py - 38}" r="11" fill="var(--surface)" stroke="var(--critical)" stroke-width="2"/><line x1="${px + 34}" y1="${py - 38}" x2="${px + 40}" y2="${py - 44}" stroke="var(--critical)" stroke-width="1.5"/><text x="${px + 50}" y="${py - 42}" class="apc-t" style="fill:var(--critical)">measure</text></g>`;
  }
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ duplex worm mesh view */
function meshSVG(s, M, R) {
  const W = 760, H = 272, x0 = 40, x1 = 470, yw = 160, k = 6;          // k px per mm of axial position
  const j = M.j0 - s * R.jPerMm;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Duplex worm backlash adjustment">`;
  g += `<text x="10" y="18" class="apc-t" style="font-weight:600">Duplex worm – axial section (lead difference drawn ×10)</text>`;
  g += `<defs><clipPath id="hrMw"><rect x="${x0}" y="30" width="${x1 - x0}" height="${H - 50}"/></clipPath></defs><g clip-path="url(#hrMw)">`;
  // wheel teeth (fixed, developed pitch line)
  const px = R.px, ex = 10;                                     // exaggeration of the lead difference
  const mid = (x0 + x1) / 2;
  for (let n = -6; n <= 6; n++) {
    const xc = mid + n * px * k;
    g += `<path d="M${xc - px * k * 0.22},${yw - 22} L${xc - px * k * 0.14},${yw - 2} L${xc + px * k * 0.14},${yw - 2} L${xc + px * k * 0.22},${yw - 22} Z" fill="#b87333" stroke="#6b3d14"/>`;
  }
  g += `<rect x="${x0}" y="${yw - 60}" width="${x1 - x0}" height="38" fill="#b87333" opacity=".35"/>`;
  // worm threads: thickness grows along the worm (duplex); the worm is shifted by s
  for (let n = -9; n <= 9; n++) {
    const xc = mid + (n + 0.5) * px * k - s * k;
    const tCore = 0.5 * px - 0.5 * M.j0 * ex + (n + 0.5) * M.dp / 2 * ex;   // thread gets thicker along the worm (exaggerated)
    const t = clamp(tCore, 0.2 * px, 0.8 * px) * k / 2;
    g += `<path d="M${xc - t - 5},${yw + 22} L${xc - t + 3},${yw + 2} L${xc + t - 3},${yw + 2} L${xc + t + 5},${yw + 22} Z" fill="#556270" stroke="#222"/>`;
  }
  g += `<rect x="${x0}" y="${yw + 22}" width="${x1 - x0}" height="26" fill="#556270"/></g>`;
  g += `<rect x="${mid - px * k * 1.5}" y="${yw - 26}" width="${px * k * 3}" height="52" fill="none" stroke="var(--accent)" stroke-dasharray="4 3"/><text x="${mid}" y="${yw + 64}" class="apc-t c" style="fill:var(--accent)">mesh zone (under the wheel)</text>`;
  g += `<line x1="${mid}" y1="${yw + 36}" x2="${mid - s * k * 4}" y2="${yw + 36}" stroke="var(--critical)" stroke-width="2" marker-end="url(#dkA)"/>`;
  g += `<text x="${x0}" y="${yw - 66}" class="apc-t">worm wheel teeth (fixed)</text><text x="${x0}" y="${yw + 82}" class="apc-t">worm: left flank lead ≠ right flank lead → thread gets thicker along the worm</text>`;
  // right: backlash readout
  const bx = 500, jmax = Math.max(M.j0, 0.06), col = j < 0 ? "var(--critical)" : j <= 0.010 && j >= 0.005 ? "var(--good)" : "var(--warning)";
  g += `<text x="${bx}" y="40" class="apc-t" style="font-weight:600">Backlash at the wheel pitch circle</text>`;
  g += `<rect x="${bx}" y="54" width="230" height="16" rx="4" fill="var(--surface-2)" stroke="var(--border)"/><rect x="${bx}" y="54" width="${clamp(Math.max(0, j) / jmax, 0, 1) * 230}" height="16" rx="4" fill="${col}"/>`;
  g += `<rect x="${bx + 0.005 / jmax * 230}" y="50" width="${0.005 / jmax * 230}" height="24" fill="none" stroke="var(--good-text)" stroke-dasharray="3 2"/>`;
  g += `<text x="${bx}" y="92" class="apc-t" style="fill:var(--text);font-size:15px;font-weight:700">${j < 0 ? "JAMMED (" + f(j, 3) + " mm)" : f(j, 3) + " mm"}</text><text x="${bx + 120}" y="92" class="apc-t">= ${f(Math.max(0, j) / (R.d2 / 2) * SEC, 1)}″ at the table</text>`;
  g += `<text x="${bx}" y="114" class="apc-t">axial shift s = ${f(s, 2)} mm</text><text x="${bx}" y="132" class="apc-t">j = j₀ − s · Δp / pₓ = ${M.j0} − ${f(s, 2)} · ${M.dp} / ${f(R.px, 2)}</text>`;
  g += `<text x="${bx}" y="150" class="apc-t">target 0.005–0.010 mm (green frame)</text><text x="${bx}" y="168" class="apc-t">needed shift ≈ <tspan style="font-weight:700;fill:var(--text)">${f(R.sAdj, 2)} mm</tspan> → grind the spacer ring</text>`;
  // contact patterns
  const cp = (x, y, dy, lab, ok) => `<rect x="${x}" y="${y}" width="66" height="44" rx="4" fill="#e8c9a6" stroke="#6b3d14"/><ellipse cx="${x + 33 + 6}" cy="${y + 22 + dy}" rx="20" ry="9" fill="#2f6fb0" opacity=".7"/>
    <text x="${x + 33}" y="${y + 58}" class="apc-t c" style="font-size:10px;fill:${ok ? "var(--good-text)" : "var(--critical)"}">${lab}</text>`;
  g += `<text x="${bx}" y="192" class="apc-t" style="font-weight:600">Contact pattern on a wheel tooth</text>`;
  g += cp(bx, 200 - 4, 0, "✓ centred", true) + cp(bx + 80, 196, -12, "too high → shim", false) + cp(bx + 160, 196, 12, "too low → shim", false);
  return g + `<defs><marker id="dkA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--critical)"/></marker></defs></svg>`;
}

/* ------------------------------------------------------------------ process plans */
function plans(M, R) {
  return {
    housing: { n: "Housing", m: "EN-GJL-300 casting (or welded S355 + stress relief)", ops: [
      ["10", "Foundry / QC", "Casting check: porosity (X-ray at the bearing seat), hardness 180–220 HB, marking", "no pores at seats"],
      ["20", "Floor-type boring mill / HMC", "Rough mill all faces, rough bore all bores (2–3 mm allowance)", "allowance even"],
      ["30", "Furnace", "Stress relief annealing 550 °C, 4–6 h, slow cooling (or vibratory stress relief)", "protocol"],
      ["40", "HMC", "Semi-finish faces + bores (0.3 mm allowance)", ""],
      ["50", "Surface grinder", "Grind the base face = reference A", "flatness 0.005"],
      ["60", "Jig borer / precision HMC at 20 °C ±1", `ONE set-up: bearing seat Ø300 H6 + seat face, worm bores H6 at centre distance a = ${f(R.a, 1)} ±0.01, clamp ring seat`, "seat face ⟂ axis 0.003 · worm axis ⟂ B-axis 0.01/100 · worm height to wheel mid-plane ±0.02"],
      ["70", "HMC", "Drill + tap, oil channels, sight glass, drain", ""],
      ["80", "Washing + CMM", "Deburr, wash, CMM report of all functional sizes", "report = assembly approval"],
      ["90", "Paint shop", "Oil-resistant primer inside, paint outside (mask the fits)", ""]] },
    table: { n: "Table top + hub sleeve", m: "EN-GJS-600 / C45 quenched + tempered", ops: [
      ["10", "QC / saw", "Blank / casting check", ""],
      ["20", "Vertical lathe", "Rough turn both sides, 2 mm allowance", ""],
      ["30", "Furnace", "Stress relief", ""],
      ["40", "Vertical lathe", "Finish turn in ONE set-up: bearing face, hub sleeve spigot, wheel spigot, clamp disc face, scale seat", "runout 0.005 between all seats"],
      ["50", "Jig borer / HMC", `4 zero-point bores at pitch ${R.A.pitch} mm (±0.01), threads, channels to the rotary union (deep drill + plugs)`, "position ±0.01"],
      ["60", "Test bench", "Pressure test all channels 1.5 × p", "no leak"],
      ["70", "AFTER assembly", "Grind the top + module faces in the table's own bearing", "flatness 0.005 · parallel 0.01"]] },
    wheel: { n: "Worm wheel", m: "rim CuSn12Ni2-C-GZ (centrifugal cast bronze) on C45 hub", ops: [
      ["10", "Lathe", "Turn hub and rim blank, fit: shrink the rim on the hub (or bolts + dowels)", ""],
      ["20", "Lathe", "Finish turn the blank: tip diameter, faces, bore / spigot", "runout 0.005 to the bore"],
      ["30", "Gear hobbing machine", `Hob ${M.z2} teeth, module ${M.m}, with a DUPLEX hob (or a fly cutter for 1–2 pieces), hob at centre distance a = ${f(R.a, 1)}`, "DIN 3974 class 5"],
      ["40", "Gear measuring machine", "Pitch, cumulative pitch, runout, flank form", `Fp ≤ ${M.Fp}″`],
      ["50", "Mesh test", "Roll with the master worm, marking paste – contact pattern", "≥ 60 % centred"],
      ["60", "Marking", "Mark as a MATCHED PAIR with its worm (worm + wheel are never exchanged alone)", "serial no."]] },
    worm: { n: "Duplex worm", m: "16MnCr5 / 20MnCr5 case-hardening steel", ops: [
      ["10–20", "Saw + lathe", "Saw, face, centre drill DIN 332 form B", "length ±0.1"],
      ["30–40", "CNC lathe / whirling", "Rough turn (+0.6 on ground Ø), rough the thread flank by flank with the 2 duplex leads, 0.25 mm stock per flank", "wire check M_soft"],
      ["50", "Furnace", "Case harden (CHD incl. grinding stock), 58–62 HRC, temper, straighten", "coupon: hardness + CHD"],
      ["60–70", "Centre-hole + cylindrical grinder", "Re-grind centre holes, grind journal + bearing seats k5 + thread tip", "runout 0.003"],
      ["80", "Worm grinding machine", `Grind the thread: left flank lead and right flank lead differ by Δp = ${M.dp} mm (duplex)`, "Q'w below burn limit"],
      ["90", "Etch line", "Nital etch – grinding burn check (100 %)", "no dark areas"],
      ["100–110", "Gear measuring machine + test bench", "Lead L + R, profile, runout, pitch, over-wire M; transmission error, backlash vs shift, run-in", "see item 2 (process twin)"],
      ["120", "Finishing", "Demagnetise, mark the pair, part record", ""]] },
    clamp: { n: "Clamp ring + disc", m: "42CrMo4 quenched + tempered (thin-wall ring), disc C45", ops: [
      ["10", "Lathe", "Rough turn", ""], ["20", "Furnace", "Quench + temper 900–1100 N/mm²", ""],
      ["30", "Lathe / grinder", "Finish turn the thin wall (wall thickness ±0.02), grind the clamp faces", "parallel 0.005"],
      ["40", "Test bench", "Pressure test 1.5 × p, holding torque test", `≥ ${M.Tcl} N·m`]] },
    cart: { n: "Worm bearing cartridges + spacer", m: "C45 / 42CrMo4", ops: [
      ["10", "Lathe", "Turn the cartridges, bearing seats H5/J5", "coaxial 0.005"],
      ["20", "Surface grinder", "Spacer ring: grind to the size found at assembly (backlash setting)", "±0.002"]] },
  };
}

/* ------------------------------------------------------------------ UI */
const boxH = $("hrItem1");
if (boxH) {
  boxH.innerHTML = `
    <div class="kpis" id="hrKpis"></div>
    <div class="card">
      <div class="card-head"><h2>Assembly – step by step</h2><span class="sub">click a part in the drawing for its data · parts slide in when they are fitted</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="hrPlay">▶ Play</button><button class="btn ghost" id="hrPrev">◀</button><button class="btn ghost" id="hrNext">▶|</button>
        <input type="range" id="hrStepR" min="0" max="${STEPS.length - 1}" value="0" aria-label="Assembly step"></div>
      <div class="dk-step" id="hrStep"></div>
      <div class="hr-grid"><div id="hrSec"></div><div class="apc3d-info" id="hrInfo"></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Backlash setting with the duplex worm</h2><span class="sub">move the slider = shift the worm axially</span></div>
      <div class="apc3d-bar"><span class="tb-label">Axial shift of the worm</span><input type="range" id="hrShift" min="0" max="5" step="0.05" value="0" aria-label="Axial shift" style="max-width:300px"><b id="hrShiftV"></b>
        <button class="btn ghost" id="hrShiftSet">set to target</button></div>
      <div class="dk-svg" id="hrMesh"></div>
      <p class="hint">Why a duplex worm: a normal worm can only be set by changing the centre distance, which spoils the contact pattern. In a duplex worm the left and right flanks have a
        slightly different lead, so the tooth gets thicker along the worm. Shifting the worm axially changes the backlash, while the centre distance and the contact pattern stay the same.
        This also lets you re-adjust after years of wear.</p>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Process plan – parts you make</h2></div>
        <div class="seg" role="group" aria-label="Part" id="hrPlanSeg" style="margin-bottom:8px"></div>
        <p class="small" id="hrPlanMat"></p><div class="table-wrap"><table class="apc-bom" id="hrPlan"></table></div></div>
      <div class="card"><div class="card-head"><h2>Assembly + measuring steps</h2><span class="sub">click a row to show it in the drawing</span></div><div class="table-wrap"><table class="apc-bom apc-seq" id="hrAsm"></table></div></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="hrReset">Example values</button></div><div id="hrInputs"></div>
        <p class="hint">Pallet size and load come from the Pallet changer tab.</p></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="hrChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="hrCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Bill of materials</h2><span class="sub">MAKE = you manufacture · BUY = catalogue / supplier</span></div><div class="table-wrap"><table id="hrBom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – workshop rules, acceptance tests, maintenance</h2></div><div id="hrGuide" class="mx-guide"></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("hmcRotState") || "{}")); } catch (er) { /* private window */ }
  let A = apcCtx(), R = calc(M, A), step = 0, u = 1, playing = false, last = performance.now(), started = false, pick = null, shift = 0, plan = "housing";
  const pane = $("tab-hmc"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const PINFO = () => ({
    housing: ["MAKE", "EN-GJL-300 casting", "Carries everything. Bearing seat and worm bores machined in ONE set-up – that fixes the centre distance and the perpendicularity.", `centre distance a = ${f(R.a, 1)} ±0.01 mm`],
    bearing: ["BUY", "axial-radial cylindrical roller bearing, bore 200", "Takes the axial load, the radial load and the tilting moment in one bearing – very stiff, low runout.", `tilting moment ${f(R.Mk, 2)} kN·m of ${M.Mka} allowed`],
    table: ["MAKE", "GJS-600 / C45", "Carries the zero-point modules and the pallet. The top is ground in its own bearing at the end.", `Ø${2 * M.Rt} mm`],
    wheel: ["MAKE", "CuSn12Ni2 bronze rim on C45 hub", "Bronze against hardened steel: low wear, good running-in. Matched pair with the worm.", `z = ${M.z2}, m = ${M.m}, d₂ = ${f(R.d2, 0)} mm`],
    worm: ["MAKE", "16MnCr5 case hardened + ground", "Duplex worm: axial shift sets the backlash. Fixed bearing pair on the motor side.", `d₁ = ${M.d1} mm, lead angle ${f(R.gam / RAD, 2)}°`],
    clamp: ["MAKE / BUY", "hydraulic thin-wall clamp ring", "Holds the table during 4-axis (indexed) machining, so the cutting force does not load the worm.", `${M.Tcl} N·m holding torque`],
    encoder: ["BUY", "hollow-shaft angle encoder, 2 read heads", "Measures the table angle directly → worm pitch errors and backlash do not matter (closed loop).", `±${M.enc}″`],
    union: ["BUY", "rotary union, hydraulic + air passages", "Brings oil (pallet clamping) and air (seat check, cleaning) into the turning table.", ""],
    seal: ["MAKE + BUY", "labyrinth + sealing air", "Keeps coolant and chips out of the bearing and the worm.", ""],
    zp: ["BUY", "zero-point clamping modules", "Clamp the pallet (Pallet changer tab).", `${A.pitch} mm pitch`],
    pallet: ["(APC)", "machining pallet", "Test pallet for the final checks.", `${A.a} × ${A.b} mm`],
  });

  function inputs() {
    $("hrInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, un, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(un)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Servo motor found", !!R.servo, false, R.servo ? `${R.servo.kw} kW: ${f(R.Tm, 2)} N·m × 1.3 ≤ ${R.servo.tmax} N·m at ${f(R.nm, 0)} rpm` : `${f(R.Tm, 2)} N·m at ${f(R.nm, 0)} rpm – no servo in the list`);
    add("Clamp holds the cutting torque", M.Tcl >= R.TclNeed, M.Tcl >= R.Tc, `${M.Tcl} ≥ ${f(R.TclNeed, 0)} N·m (S = ${M.S})`);
    add("Worm tooth load when cutting while turning", R.Ft2 <= R.Ft2a, M.Tcl >= R.TclNeed, R.Ft2 <= R.Ft2a ? `${f(R.Ft2 / 1000, 1)} kN ≤ ${f(R.Ft2a / 1000, 1)} kN (Bach)` : `${f(R.Ft2 / 1000, 1)} kN > ${f(R.Ft2a / 1000, 1)} kN → rough with the table CLAMPED; while turning cut only ≤ ${f(R.FcSim, 0)} N (or module ${M.m + 1}+)`);
    add("Bearing tilting moment", R.Mk <= M.Mka * 0.5, R.Mk <= M.Mka, `${f(R.Mk, 2)} kN·m of ${M.Mka}`);
    add("Bearing axial load", R.Fa * 4 <= M.C0a, R.Fa <= M.C0a, `${f(R.Fa, 1)} kN, static safety ×${f(M.C0a / R.Fa, 0)}`);
    add("Self-locking?", true, true, R.selfLock ? "yes – the worm holds by itself" : `NO (γ ${f(R.gam / RAD, 2)}° > ρ' ${f(R.rho / RAD, 2)}°) – the clamp and the servo brake must hold`);
    add("Sliding speed for bronze", R.vs <= 6, R.vs <= 10, `${f(R.vs, 2)} m/s (oil bath ≤ 6 m/s)`);
    add("Positioning accuracy (with encoder)", R.accEnc <= 5, R.accEnc <= 8, `±${f(R.accEnc, 1)}″ = ${f(R.atEdge(R.accEnc), 4)} mm at the pallet edge`);
    add("Backlash adjustable", R.sAdj > 0.3 && R.sAdj <= 5, R.sAdj > 0, `shift ${f(R.sAdj, 2)} mm for ${M.jt} mm`);
    return c;
  }
  function formulas() {
    $("hrCalc").innerHTML = [
      blk("1 · Worm gear geometry", [`ratio i = z₂ / z₁ = ${M.z2} / ${M.z1} = <b>${f(R.i, 0)}</b>`, `d₂ = m · z₂ = ${M.m} · ${M.z2} = ${f(R.d2, 0)} mm,   pₓ = π · m = ${f(R.px, 2)} mm`,
        `centre distance a = (d₁ + d₂) / 2 = <b>${f(R.a, 1)} mm</b>`, `lead angle γ = atan(z₁ · m / d₁) = ${f(R.gam / RAD, 2)}°`]),
      blk("2 · Efficiency + self-locking", [`ρ' = atan(μ / cos 20°) = ${f(R.rho / RAD, 2)}°`, `η (worm drives) = tan γ / tan(γ + ρ') = <b>${f(R.eta * 100, 0)} %</b>`,
        `η (wheel drives back) = ${R.etaB > 0 ? f(R.etaB * 100, 0) + " %" : "0 → self-locking"}`], "A precise ground worm with a small friction is NOT self-locking – that is why the table has a hydraulic clamp and the servo has a brake."),
      blk("3 · Motor", [`J = ½·m·R² + J_pallet = ${f(R.Jt, 2)} + ${f(R.Jp, 2)} = ${f(R.J, 2)} kg·m²`, `α = ω / t = ${f(R.om, 2)} / ${M.ta} = ${f(R.al, 2)} rad/s²,  T = J·α·1.1 = ${f(R.Tacc, 0)} N·m`,
        `T_motor = T / (i · η) = <b>${f(R.Tm, 2)} N·m</b> at n = ${f(R.nm, 0)} rpm`]),
      blk("4 · Cutting torque, clamp, tooth load", [`T_c = F_c · r = ${M.Fc} · ${M.rc / 1000} = ${f(R.Tc, 0)} N·m → clamp ≥ S · T_c = ${f(R.TclNeed, 0)} N·m`,
        `F_t2 = 2 · T_c / d₂ = ${f(R.Ft2, 0)} N   allowed (Bach) c · b₂ · pₓ = ${M.cB} · ${M.b2} · ${f(R.px, 2)} = ${f(R.Ft2a, 0)} N`]),
      blk("5 · Main bearing", [`M_k = F_c · h + m_w · g · e = ${f(R.Mk, 2)} kN·m`, `F_a = (m_pallet + m_table) · g = ${f(R.Fa, 1)} kN`]),
      blk("6 · Backlash with the duplex worm", [`Δj per mm shift = Δp / pₓ = ${M.dp} / ${f(R.px, 2)} = ${f(R.jPerMm, 4)} mm`, `shift s = (j₀ − j) / (Δp/pₓ) = (${M.j0} − ${M.jt}) / ${f(R.jPerMm, 4)} = <b>${f(R.sAdj, 2)} mm</b>`,
        `angle = j / (d₂/2) = ${f(R.jSec, 1)}″`]),
      blk("7 · Positioning accuracy", [`with direct encoder: √(enc² + eccentricity² + thermal²) = √(${M.enc}² + ${f(R.eEcc, 1)}² + ${R.eTh}²) = <b>±${f(R.accEnc, 1)}″</b>`,
        `${M.heads >= 2 ? "eccentricity cancelled by 2 opposite heads" : `1 head: e / R = ${M.ecc} / ${M.Rs} → ${f(R.eEcc, 1)}″`}`, `without encoder (motor encoder only): Fp + j/2 + thermal = ±${f(R.accNo, 1)}″`,
        `at the pallet edge: ±${f(R.atEdge(R.accEnc), 4)} mm (with) / ±${f(R.atEdge(R.accNo), 4)} mm (without)`], "That is why HMC rotary tables use a direct angle encoder: the worm then only drives, the encoder decides the position."),
    ].join("");
  }
  function tables() {
    const P = plans(M, R), keys = Object.keys(P);
    $("hrPlanSeg").innerHTML = keys.map((k) => `<button class="seg-btn${k === plan ? " active" : ""}" data-hrplan="${k}">${esc(P[k].n)}</button>`).join("");
    $("hrPlanMat").innerHTML = `<b>Material:</b> ${esc(P[plan].m)}`;
    $("hrPlan").innerHTML = `<thead><tr><th>Op</th><th>Machine</th><th>Operation</th><th>Tolerance / check</th></tr></thead><tbody>${P[plan].ops.map((o) => `<tr><td>${o[0]}</td><td>${esc(o[1])}</td><td>${esc(o[2])}</td><td>${esc(o[3])}</td></tr>`).join("")}</tbody>`;
    const bom = [["Housing", "MAKE", 1, "EN-GJL-300, process plan above", ""], ["Table top + hub sleeve", "MAKE", 1, `Ø${2 * M.Rt} mm`, ""],
      ["Worm wheel (bronze rim + hub)", "MAKE", 1, `z ${M.z2}, m ${M.m}, b ${M.b2} mm`, "or BUY as a set from a worm gear maker"], ["Duplex worm", "MAKE", 1, `d₁ ${M.d1}, Δp ${M.dp}`, "matched pair with the wheel"],
      ["Worm bearing cartridges + spacer ring", "MAKE", 2, "", "spacer ground at assembly"], ["Angular contact bearing pair (preloaded)", "BUY", 1, "worm fixed side, back-to-back", ""], ["Needle / cylindrical roller bearing", "BUY", 1, "worm floating side", ""],
      ["Axial-radial roller bearing", "BUY", 1, `bore 200, M_k allowed ${M.Mka} kN·m`, "check catalogue"], ["Hydraulic clamp ring + disc", "MAKE / BUY", 1, `${M.Tcl} N·m`, ""],
      ["Angle encoder + 2 read heads", "BUY", 1, `±${M.enc}″, hollow shaft`, ""], ["Servo motor with brake + bellows coupling", "BUY", 1, R.servo ? `${R.servo.kw} kW, ${f(R.nm, 0)} rpm` : "–", ""],
      ["Rotary union (hydraulic + air)", "BUY", 1, "4–6 passages", ""], ["Zero-point modules", "BUY", 4, "Pallet changer tab", ""], ["Labyrinth cover, seals, sight glass, oil", "MAKE / BUY", 1, "gear oil ISO VG 220–460", ""]];
    $("hrBom").innerHTML = `<thead><tr><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${bom.map((b) => `<tr><td>${esc(b[0])}</td><td>${esc(b[1])}</td><td>${b[2]}</td><td>${esc(b[3])}</td><td>${esc(b[4])}</td></tr>`).join("")}</tbody>`;
    $("hrGuide").innerHTML = `
      <h3>Workshop rules for precision parts</h3><ul>
        <li><b>Rough → stress relief → finish.</b> Castings and welded parts move after rough machining. Never finish before stress relief.</li>
        <li><b>One set-up for everything that must fit together</b> (bearing seat + worm bores, all table seats). Re-clamping costs 0.01–0.02 mm.</li>
        <li><b>Measure at 20 °C.</b> 1 K on Ø300 steel = 3.5 µm. Let parts rest 12 h in the measuring room before the CMM.</li>
        <li><b>Clean assembly room</b>, parts washed, bearings opened only at the bench, no compressed air on bearings.</li>
        <li><b>Worm + wheel = matched pair.</b> Store and replace them together.</li></ul>
      <h3>Acceptance tests (example limits, check ISO 230-2 / ISO 10791-1)</h3><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Limit</th></tr></thead><tbody>
        <tr><td>Positioning accuracy B</td><td>autocollimator + 12/24-face polygon, or laser + rotary calibrator, 5 runs both directions</td><td>A ≤ ${f(Math.max(5, Math.ceil(R.accEnc)), 0)}″</td></tr>
        <tr><td>Repeatability</td><td>same measurement</td><td>R ≤ 2″</td></tr>
        <tr><td>Reversal (backlash)</td><td>approach each point from + and −</td><td>≤ 2″ with encoder</td></tr>
        <tr><td>Table top</td><td>flatness (precision level / dial gauge), axial + radial runout</td><td>0.005 / 0.005 / 0.005 mm</td></tr>
        <tr><td>Clamp</td><td>torque with lever + load cell, angle change during clamping</td><td>≥ ${M.Tcl} N·m, ≤ 1″</td></tr>
        <tr><td>Thermal + noise</td><td>2 h at 50 % speed, then 30 min at max</td><td>ΔT ≤ 15 K, no noise peaks</td></tr></tbody></table>
      <h3>Maintenance</h3><ul><li>Worm oil: first change after 500 h (running-in wear), then every 4000 h. Check the oil level weekly.</li>
        <li>Every year: measure the backlash; re-set with the duplex worm when > 0.015 mm.</li><li>After a crash: runout + positioning test before production.</li></ul>`;
  }
  function render() {
    A = apcCtx(); R = calc(M, A);
    window.HMCROT = { M: { ...M }, R }; window.dispatchEvent(new Event("hmcrotchange"));   // item 2 (worm manufacturing) uses the worm data
    const ch = checks();
    $("hrKpis").innerHTML = [["Ratio", "1 : " + f(R.i, 0), `worm ${M.z1}-start, ${f(R.a, 0)} mm centre distance`], ["Motor", R.servo ? R.servo.kw + " kW" : "–", `${f(R.Tm, 2)} N·m at ${f(R.nm, 0)} rpm`],
      ["Accuracy", "±" + f(R.accEnc, 1) + "″", `direct encoder (±${f(R.accNo, 0)}″ without)`], ["Backlash", f(M.jt * 1000, 0) + " µm", `duplex shift ${f(R.sAdj, 1)} mm`],
      ["Self-locking", R.selfLock ? "yes" : "no", R.selfLock ? "" : "clamp + brake needed"], ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("hrChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); tables(); draw(); drawMesh();
  }
  function info() {
    const el = $("hrInfo"), key = pick || (STEPS[step].add[0] || (STEPS[step].hl || [])[0]), p = PINFO()[key], P = PARTS[key];
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(P ? P.n : "")}</b>${p ? `<span class="apc-mb ${p[0].split(" ")[0].replace("/", "")}">${esc(p[0])}</span>` : ""}</div>
      ${p ? `<p>${esc(p[2])}</p><p><span class="muted">Material / type</span><br>${esc(p[1])}</p>${p[3] ? `<p><span class="muted">Key value</span><br>${esc(p[3])}</p>` : ""}` : ""}
      <p><span class="muted">Check in this step</span><br><b>${esc(STEPS[step].chk)}</b></p>`;
  }
  function draw() {
    $("hrSec").innerHTML = sectionSVG(step, u, M, R, pick);
    $("hrStep").innerHTML = `<span class="dk-n">${step + 1}/${STEPS.length}</span> <b>${esc(STEPS[step].t)}</b>`;
    $("hrStepR").value = step; $("hrPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("hrAsm").innerHTML = `<thead><tr><th>#</th><th>Step</th><th>Check</th></tr></thead><tbody>${STEPS.map((s, i) => `<tr class="${i === step ? "on" : ""}" data-hrk="${i}" style="cursor:pointer"><td>${i + 1}</td><td>${esc(s.t)}</td><td>${esc(s.chk)}</td></tr>`).join("")}</tbody>`;
    info();
  }
  function drawMesh() { $("hrMesh").innerHTML = meshSVG(shift, M, R); $("hrShiftV").textContent = `${f(shift, 2)} mm`; }
  function go(n) { step = clamp(n, 0, STEPS.length - 1); u = 0; pick = null; draw(); }
  function init() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || boxH.hidden) return;
      if (u < 1) { u = Math.min(1, u + dt / 1.2); draw(); }
      else if (playing) { if (!init.hold) init.hold = 0; init.hold += dt; if (init.hold > 2.2) { init.hold = 0; if (step < STEPS.length - 1) go(step + 1); else { playing = false; draw(); } } } };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("hrInputs").addEventListener("change", (ev) => {
    const k = ev.target.dataset.k; if (!k) return;
    const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v <= 0) { ev.target.value = M[k]; return; }
    M[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("hmcRotState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("hrReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("hmcRotState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("hrPlay").addEventListener("click", () => { playing = !playing; if (playing && step === STEPS.length - 1 && u >= 1) go(0); last = performance.now(); draw(); });
  $("hrPrev").addEventListener("click", () => { playing = false; go(step - 1); });
  $("hrNext").addEventListener("click", () => { playing = false; go(step + 1); });
  $("hrStepR").addEventListener("input", (ev) => { playing = false; go(+ev.target.value); });
  $("hrAsm").addEventListener("click", (ev) => { const tr = ev.target.closest("[data-hrk]"); if (tr) { playing = false; go(+tr.dataset.hrk); } });
  $("hrSec").addEventListener("click", (ev) => { const g = ev.target.closest("[data-hrpart]"); pick = g ? g.dataset.hrpart : null; draw(); });
  $("hrShift").addEventListener("input", (ev) => { shift = parseFloat(ev.target.value); drawMesh(); });
  $("hrShiftSet").addEventListener("click", () => { shift = clamp(Math.round(R.sAdj * 20) / 20, 0, 5); $("hrShift").value = shift; drawMesh(); });
  $("hrPlanSeg").addEventListener("click", (ev) => { const b = ev.target.closest("[data-hrplan]"); if (b) { plan = b.dataset.hrplan; tables(); } });
  const prevShown = window.onTabShown;
  window.onTabShown = (name) => { if (prevShown) prevShown(name); if (name === "hmc") { render(); init(); } };
  if (location.hash === "#hmc") setTimeout(() => { render(); init(); }, 100);
  const q = new URLSearchParams(location.search);
  if (q.get("hrstep")) { step = clamp(parseInt(q.get("hrstep"), 10) - 1 || 0, 0, STEPS.length - 1); u = 1; draw(); }
  if (q.get("hrshift")) { shift = parseFloat(q.get("hrshift")) || 0; $("hrShift").value = shift; drawMesh(); }
  if (q.get("hrplan")) { plan = q.get("hrplan"); tables(); }
}

/* shared with the Assembly tab (asmrt.js) */
export { sectionSVG, calc as hmcCalc, DEF as HMC_DEF, apcCtx, PARTS as HMC_PARTS };
