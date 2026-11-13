/* Additive manufacturing tab – item 2: LPBF (laser powder bed fusion, metal) PROCESS MODEL.
 * Pure functions, no DOM. Used by amlpbf.js (page) and am3d.js (3D, via the state object).
 *
 *   calc(cfg)              -> build plan: energy density, nesting, layers, build time, powder, gas, energy, cost per part
 *   simulate(cfg, F, seed) -> one build record: simulated measured values + every check (pass / fail) + which op finds a fault
 *   series(cfg, F, seed)   -> layer-by-layer monitoring data (melt pool, O2, layer time, camera findings) for the live view
 *   lot(cfg, F, n)         -> n builds -> mean, sigma, Cpk per characteristic
 *
 * All numbers are EXAMPLE values of the right size (public parameter ranges of the machine classes).
 * Real parameters come from the machine maker's qualified parameter sets and your own test builds. */

export const MACH = {
  m250: { key: "m250", name: "Single-laser 250 class", cls: "class of e.g. EOS M 290, Trumpf TruPrint 2000, Farsoon FS273M",
    plate: [250, 250, 325], lasers: 1, Pmax: 400, spot: 80, price: 650000, kW: 8.5, gas: 2.5, recoat: 9, inert: 1.2, cool: 3, chamberL: 120 },
  m400: { key: "m400", name: "Quad-laser 400 class", cls: "class of e.g. EOS M 400-4, SLM 500, Farsoon FS421M, BLT S400",
    plate: [400, 400, 400], lasers: 4, Pmax: 400, spot: 90, price: 1600000, kW: 22, gas: 5, recoat: 11, inert: 1.8, cool: 5, chamberL: 450 },
  m600: { key: "m600", name: "Large 12-laser 600 class", cls: "class of e.g. Nikon SLM NXG 600, EOS M 400 large / BLT S600 series",
    plate: [600, 600, 600], lasers: 12, Pmax: 1000, spot: 100, price: 4200000, kW: 60, gas: 12, recoat: 14, inert: 2.5, cool: 8, chamberL: 1400 },
};

// t = layer thickness mm, P W, v mm/s, h hatch mm. Eopt = centre of the process window (J/mm³), win = [lo, hi] of good density.
export const MAT = {
  alsi: { key: "alsi", name: "AlSi10Mg (aluminium)", rho: 2.67, price: 75, t: 0.03, P: 370, v: 1300, h: 0.19, win: [40, 70], o2: 1000, pre: 165,
    dens: 99.5, uts0: 430, uts: 300, el: 8, hard: "≈ 95 HBW after stress relief", ra: [7, 18], tol: 0.12, srTxt: "Stress relief 300 °C · 2 h in Ar (on the plate)",
    htTxt: "– (stress relief is enough; T6 only if needed)", hip: false, alloy: "EN AC-43000 type", danger: "very reactive fine powder – ATEX zone, Class D extinguisher" },
  ss316: { key: "ss316", name: "316L (stainless steel)", rho: 7.99, price: 40, t: 0.04, P: 200, v: 800, h: 0.11, win: [45, 100], o2: 1300, pre: 80,
    dens: 99.8, uts0: 620, uts: 580, el: 35, hard: "≈ 220 HV", ra: [8, 20], tol: 0.1, srTxt: "Stress relief 650 °C · 2 h in Ar (on the plate)",
    htTxt: "– (optional solution anneal 1 050 °C)", hip: false, alloy: "1.4404", danger: "fine powder – respirator FFP3, ATEX check" },
  ti64: { key: "ti64", name: "Ti6Al4V (titanium grade 5)", rho: 4.43, price: 250, t: 0.03, P: 280, v: 1200, h: 0.14, win: [42, 80], o2: 1000, pre: 80,
    dens: 99.8, uts0: 1150, uts: 980, el: 12, hard: "≈ 34 HRC", ra: [7, 18], tol: 0.1, srTxt: "Stress relief 800 °C · 2 h in vacuum / Ar (on the plate)",
    htTxt: "HIP 920 °C · 100 MPa · 2 h (fatigue parts)", hip: true, alloy: "grade 5 / ASTM F3302", danger: "very reactive – ATEX zone, inert sieving, Class D extinguisher" },
  ms1: { key: "ms1", name: "1.2709 maraging tool steel", rho: 8.0, price: 70, t: 0.04, P: 285, v: 960, h: 0.11, win: [52, 95], o2: 1300, pre: 100,
    dens: 99.8, uts0: 1100, uts: 2000, el: 4, hard: "50–54 HRC after ageing", ra: [8, 20], tol: 0.1, srTxt: "– (ageing does it)",
    htTxt: "Ageing 490 °C · 6 h → 50–54 HRC", hip: false, alloy: "18Ni-300 / 1.2709", danger: "fine powder – Ni / Co content: respirator, gloves" },
  in718: { key: "in718", name: "Inconel 718 (nickel alloy)", rho: 8.19, price: 110, t: 0.04, P: 285, v: 960, h: 0.11, win: [55, 95], o2: 1000, pre: 80,
    dens: 99.8, uts0: 1000, uts: 1350, el: 15, hard: "≈ 45 HRC after ageing", ra: [8, 20], tol: 0.1, srTxt: "Stress relief 1 065 °C · 1.5 h in Ar (on the plate)",
    htTxt: "HIP + solution + double ageing (AMS 5664 type)", hip: true, alloy: "2.4668", danger: "Ni powder – respirator, skin protection" },
};

// bbox = [x, y, z] mm in the "as designed" orientation (z up). vol cm³ per part. sup = support volume / part volume.
export const PART = {
  bracket: { key: "bracket", shape: "bracket", name: "Robot gripper bracket (topology optimised)", mat: "alsi", bbox: [120, 80, 60], vol: 95, sup: 0.18,
    why: "Gripper for the robot cells: 55 % lighter than the milled part → faster robot, smaller robot. Typical AM part in car and machine plants.",
    conv: ["Milled from AlZnMgCu plate", 210, 95], feat: "lattice ribs, Ø8 H7 bores machined after printing" },
  insert: { key: "insert", shape: "insert", name: "Die insert with conformal cooling", mat: "ms1", bbox: [90, 90, 70], vol: 420, sup: 0.06,
    why: "Insert for the crankcase / cover casting or a plastic mould: cooling channels follow the surface → 20–40 % shorter cycle, less hot spots. Widely used in tool shops.",
    conv: ["Milled + drilled straight channels (1.2343)", 1600, 1250], feat: "Ø5 mm channels 6 mm under the surface, faces machined + polished" },
  head: { key: "head", shape: "head", name: "Compressor cylinder head – prototype", mat: "alsi", bbox: [150, 150, 85], vol: 540, sup: 0.22,
    why: "Test new valve and cooling designs in weeks instead of waiting 3–4 months for a casting pattern. Prototypes before series casting.",
    conv: ["Sand casting + machining (needs a pattern ≈ $9 000)", 9400, 380], feat: "integrated cooling fins + air passages, seats machined" },
  impeller: { key: "impeller", shape: "impeller", name: "Spare part – cooling fan impeller (no drawing, obsolete)", mat: "ss316", bbox: [110, 110, 45], vol: 160, sup: 0.25,
    why: "Spare part on demand: scan the old part, print 1–5 pieces, no stock, no tooling. Railways and plant makers run digital warehouses like this.",
    conv: ["Investment casting (tooling ≈ $6 000)", 6300, 140], feat: "thin blades 1.2 mm, hub bore reamed" },
};

export const ORIENT = {
  up: { name: "as designed (z up)", sup: 1.0, ra: 1.0, curl: 1.0 },
  flat: { name: "lying flat (smallest height)", sup: 1.5, ra: 1.15, curl: 1.4 },
  tilt: { name: "tilted 45° (less support, more height)", sup: 0.7, ra: 0.95, curl: 0.8 },
};

// Process route. eq = real equipment class (BUY), what to measure. min = labour minutes per part (or per build: perBuild).
export const OPS = [
  { no: 10, k: "powder", n: "Powder incoming check + preparation", where: "powder room (ATEX)", perBuild: 30, min: 0,
    eq: ["Laser diffraction particle size analyser (D10/D50/D90)", "Hall flowmeter + apparent / tap density (ISO 4490, ISO 3923)", "O/N/H analyser (inert gas fusion)", "Ultrasonic sieve 63 µm, inert", "Drying oven / dry storage < 10 % RH", "Powder containers with ID (virgin / used, reuse count)"],
    chk: "PSD 15–45 µm (Al/Ti 20–63), O ≤ limit, flow ≤ 25 s/50 g, moisture" },
  { no: 20, k: "prep", n: "Build preparation (data)", where: "AM engineering office", perBuild: 90, min: 0,
    eq: ["Data-prep software (e.g. Materialise Magics, Autodesk Netfabb, Siemens NX AM, Oqton)", "Distortion simulation (e.g. Ansys Additive, Simufact Additive)", "Parameter sets qualified for machine + material", "MES / build job record"],
    chk: "orientation, supports, nesting, scan strategy, simulated distortion < 0.3 mm" },
  { no: 30, k: "setup", n: "Machine set-up + inerting", where: "LPBF machine", perBuild: 60, min: 0,
    eq: ["Build plate (machined + ground, same alloy family)", "Recoater blade (HSS / ceramic / carbon brush)", "Filter cartridge check, protective window cleaned", "Argon supply (tank or 4.6 bottles), O2 sensor", "ATEX vacuum cleaner, PPE (FFP3, gloves, antistatic)"],
    chk: "plate level ±0.02 mm, O2 below limit, plate preheated" },
  { no: 40, k: "print", n: "Printing – layer by layer", where: "LPBF machine", perBuild: 0, min: 0,
    eq: ["LPBF machine (see machine class)", "Melt-pool monitoring (photodiodes / camera on axis)", "Powder-bed camera (image after recoat + after exposure)", "O2, gas flow, filter Δp, laser power monitor", "Remote monitoring / MES connection (OPC UA)"],
    chk: "melt-pool signal in band, O2 < limit, no streaks / curl, no recoater stop" },
  { no: 50, k: "depowder", n: "Cool-down + depowdering", where: "unpacking station (inert)", perBuild: 60, min: 4,
    eq: ["Closed unpacking station with glove ports, Ar", "Vibration / rotation depowdering unit (e.g. Solukon class)", "ATEX vacuum, powder back to sieving"],
    chk: "no powder in channels (shake + rotate), all powder recovered" },
  { no: 60, k: "sr", n: "Stress relief on the plate", where: "heat treatment", perBuild: 30, min: 0,
    eq: ["Furnace with Ar retort or vacuum furnace", "Thermocouples on the plate, chart recorder (AMS 2750 style)"],
    chk: "temperature curve recorded; skipped = parts warp after cutting" },
  { no: 70, k: "edm", n: "Cut parts from the build plate", where: "wire EDM / band saw", perBuild: 20, min: 6,
    eq: ["Wire EDM (accurate, no force) or band saw (fast)", "Plate re-machined (ground) after each build"],
    chk: "cut in the support zone, part not damaged" },
  { no: 80, k: "support", n: "Support removal + blasting", where: "post-processing", perBuild: 0, min: 12,
    eq: ["Hand tools, pneumatic chisel, grinder", "Glass-bead / ceramic blasting cabinet", "Optional: CNC for support faces"],
    chk: "no support rests, Ra after blasting" },
  { no: 90, k: "ht", n: "Heat treatment / HIP", where: "heat treatment (often subcontract)", perBuild: 15, min: 1,
    eq: ["Vacuum furnace (ageing, solution)", "HIP (hot isostatic pressing) – mostly a subcontractor service"],
    chk: "hardness / test coupon, HIP closes inner pores" },
  { no: 100, k: "finish", n: "CNC machining of functional faces", where: "machining (HMC / 5-axis)", perBuild: 0, min: 25,
    eq: ["5-axis machining centre or your HMC", "Fixture with 3-2-1 datum on printed reference pads", "Probe for best-fit set-up"],
    chk: "fits (H7 bores, seal faces), Ra 0.8–1.6 µm" },
  { no: 110, k: "inspect", n: "Inspection: CT, CMM, coupons", where: "quality lab", perBuild: 30, min: 20,
    eq: ["Industrial CT (porosity, channels, wall thickness)", "CMM or 3D scanner vs CAD", "Roughness tester, hardness tester", "Tensile test on witness coupons from the same build", "Flow test bench (cooling channels)"],
    chk: "density, max pore, deviation vs CAD, Ra, UTS / elongation of coupons" },
  { no: 120, k: "release", n: "Release + traceability", where: "quality / MES", perBuild: 10, min: 3,
    eq: ["Build record: machine, job, parameter set, powder lot + reuse, O2 log, monitoring report", "Laser marking (serial + build ID)", "Certificate (3.1) for the customer"],
    chk: "every record complete, NCR closed" },
];

export const FAULTS = [
  ["lowP", "Dirty protective window – laser power at the powder −25 %", "E too low → lack of fusion pores", "print (melt-pool signal low)", "inspect (CT, density)"],
  ["highE", "Wrong parameter set – speed −35 % (too much energy)", "keyhole pores, spatter, rough surface", "print (melt-pool signal high)", "inspect (CT)"],
  ["streak", "Recoater blade damaged (nick) – powder streak", "thin powder line → defect line in every layer", "print (powder-bed camera)", "inspect (CT)"],
  ["curl", "Too few supports – edges curl up", "recoater hits the part, build may stop", "print (camera, recoater torque)", "inspect (CMM)"],
  ["o2", "Gas leak at the door seal – O2 rises", "oxidation, poor fusion; machine pauses at the limit", "print (O2 sensor)", "inspect (coupons)"],
  ["filter", "Gas filter clogged – weak flow, spatter lands on the bed", "spatter inclusions, porosity", "print (flow / Δp sensor)", "inspect (CT)"],
  ["reuse", "Powder reused too often (O pick-up)", "lower elongation, more oxide inclusions", "powder (O analysis)", "inspect (tensile coupon)"],
  ["nosr", "Stress relief skipped", "parts spring / warp after cutting from the plate", "– (nobody sees it on the plate)", "inspect (CMM deviation)"],
  ["trapped", "Powder trapped in the cooling channels", "blocked channel → hot spot in the tool", "depowder (weighing)", "inspect (CT + flow test)"],
];

/* ---------------------------------------------------------------- helpers */
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export const DEF = { mach: "m250", part: "bracket", mat: "alsi", orient: "up", n: 0, P: 0, v: 0, h: 0, t: 0, reuse: 5, hip: "auto",
  rate: 45, labour: 45, kwh: 0.15, ar: 6, years: 6, hours: 6000, wasteFrac: 0.03, qty: 50 };

/* Oriented part box: [footprint x, footprint y, height] */
export function orientBox(bb, o) {
  const s = [...bb].sort((a, b) => a - b);
  if (o === "flat") return [s[2], s[1], s[0]];
  if (o === "tilt") return [bb[0] * 0.71 + bb[2] * 0.71, bb[1], bb[0] * 0.71 + bb[2] * 0.71];
  return [bb[0], bb[1], bb[2]];
}

/* ---------------------------------------------------------------- build plan */
export function calc(cfg) {
  const c = Object.assign({}, DEF, cfg);
  const M = MACH[c.mach], A = MAT[c.mat], PT = PART[c.part], O = ORIENT[c.orient];
  const P = c.P || A.P, v = c.v || A.v, h = c.h || A.h, t = c.t || A.t;
  const R = { c, M, A, PT, O, P, v, h, t };
  // 1 energy density
  R.E = P / (v * h * t);                                  // J/mm³
  R.Eopt = (A.P / (A.v * A.h * A.t));
  R.r = R.E / R.Eopt;
  R.winOk = R.E >= A.win[0] && R.E <= A.win[1];
  R.Pok = P <= M.Pmax;
  // 2 orientation + nesting
  const [bx, by, bz] = orientBox(PT.bbox, c.orient);
  const supH = c.orient === "flat" ? 4 : 5;
  R.box = [bx, by, bz]; R.supH = supH; R.H = bz + supH;
  const g = 12, [W, D, Hm] = M.plate, edge = 8;
  const nx = Math.max(0, Math.floor((W - 2 * edge + g) / (bx + g))), ny = Math.max(0, Math.floor((D - 2 * edge + g) / (by + g)));
  R.nMax = nx * ny; R.fitH = R.H <= Hm;
  R.n = clamp(c.n || R.nMax, 0, R.nMax);
  R.place = [];
  for (let i = 0; i < R.n; i++) { const ix = i % nx, iy = Math.floor(i / nx);
    const x0 = -((nx * bx + (nx - 1) * g) / 2) + bx / 2 + ix * (bx + g), y0 = -((ny * by + (ny - 1) * g) / 2) + by / 2 + iy * (by + g);
    R.place.push({ x: x0, y: y0, w: bx, d: by, h: bz, shape: PT.shape }); }
  // 3 volumes + mass
  R.supV = PT.vol * PT.sup * O.sup;                         // cm³ per part
  R.mPart = PT.vol * A.rho / 1000;                          // kg
  R.mSup = R.supV * A.rho / 1000;
  // 4 build rate (cm³/h).  ideal = v·h·t mm³/s; real ≈ 70 % (contours, jumps, skywriting, gas delays); multi-laser 90 % each (overlap / waiting)
  R.rate1i = v * h * t * 3.6;                               // cm³/h ideal
  R.rate1 = R.rate1i * 0.7;
  R.lasEff = M.lasers === 1 ? 1 : M.lasers * 0.9;
  R.rate = R.rate1 * R.lasEff;
  // supports are scanned fast and thin: count 40 %
  R.Vscan = R.n * (PT.vol + 0.4 * R.supV);
  R.tExp = R.n ? R.Vscan / R.rate : 0;                      // h
  R.layers = Math.ceil(R.H / t);
  R.tRec = R.layers * M.recoat / 3600;
  R.tPrint = R.tExp + R.tRec;
  R.tMach = M.inert + 0.5 + R.tPrint + M.cool;              // inert + preheat + print + cool, h
  // 5 powder
  R.mBuild = R.n * (R.mPart + R.mSup);
  R.mLoad = W * D * (R.H + 10) * 1e-3 * A.rho * 0.55 / 1000 * 1.3;   // kg loaded: bed (55 % packing) + 30 % dosing margin
  R.mUsed = R.mBuild * (1 + c.wasteFrac) + R.mLoad * c.wasteFrac;    // consumed: parts + supports + sieve losses
  // 6 gas + energy
  R.arM3 = M.chamberL / 1000 * 5 + M.gas * 60 * (R.tPrint + 0.5) / 1000;   // purge 5 volumes + flow
  R.kWh = M.kW * 0.6 * R.tMach;
  // 7 cost per build and per part
  const machH = M.price / (c.years * c.hours) + M.price * 0.08 / c.hours;  // depreciation + 8 %/year service
  R.machH = machH;
  const opsB = OPS.reduce((s, o) => s + o.perBuild, 0), opsP = OPS.reduce((s, o) => s + o.min, 0);
  R.cost = {
    machine: machH * R.tMach,
    powder: R.mUsed * A.price,
    gas: R.arM3 * c.ar,
    energy: R.kWh * c.kwh,
    labour: (opsB + opsP * R.n) / 60 * c.labour,
    post: R.n * (8 + R.mPart * 6 + (R.hipOn = (c.hip === "on" || (c.hip === "auto" && A.hip))) * (40 + R.mPart * 30) + 35),  // furnace / blasting / HIP / CT share
    plate: 60,
  };
  R.costBuild = Object.values(R.cost).reduce((a, b) => a + b, 0);
  R.costPart = R.n ? R.costBuild / R.n : 0;
  R.leadDays = (R.tMach + 24 + (R.hipOn ? 72 : 0) + 16) / 24 + 1;   // + post-processing queues
  // 8 conventional comparison (example)
  const [cn, ctool, cpiece] = PT.conv;
  R.conv = { name: cn, tooling: ctool - cpiece, piece: cpiece };
  R.convAt = (q) => (R.conv.tooling + R.conv.piece * q) / q;
  R.breakEven = R.costPart > R.conv.piece ? Math.floor(R.conv.tooling / (R.costPart - R.conv.piece)) : Infinity;
  // 9 warnings
  R.warn = [];
  if (!R.Pok) R.warn.push(`Laser power ${P} W > machine max ${M.Pmax} W`);
  if (!R.fitH) R.warn.push(`Build height ${R.H.toFixed(0)} mm > machine ${Hm} mm`);
  if (!R.nMax) R.warn.push("Part does not fit on the plate in this orientation");
  if (!R.winOk) R.warn.push(`Energy density ${R.E.toFixed(1)} J/mm³ outside the window ${A.win[0]}–${A.win[1]}`);
  if (c.reuse > 15) R.warn.push(`Powder reuse ${c.reuse}× – check O content every lot`);
  return R;
}

/* ---------------------------------------------------------------- one build: simulated measurements + checks */
export function simulate(cfg, F = {}, seed = 1) {
  const R = calc(cfg), A = R.A, r = rng(seed), g = () => gauss(r);
  let Pe = R.P * (F.lowP ? 0.75 : 1), ve = R.v * (F.highE ? 0.65 : 1);
  const E = Pe / (ve * R.h * R.t), rr = E / R.Eopt;
  const o2 = (F.o2 ? 2600 : 350) + 60 * g();
  const reuseO = R.c.reuse * 0.012 + (F.reuse ? 0.35 : 0);       // extra O wt-% ×10 (index)
  // porosity % : lack of fusion below ~0.85·Eopt, keyhole above ~1.3·Eopt
  let por = 0.06 + 40 * Math.max(0, 0.88 - rr) ** 2 + 18 * Math.max(0, rr - 1.3) ** 2;
  if (F.filter) por += 0.25; if (F.o2) por += 0.2; if (F.streak) por += 0.15;
  por = Math.max(0.01, por * (1 + 0.15 * g()));
  const hipOn = R.hipOn;
  const porFinal = hipOn ? Math.min(por, 0.02 + 0.02 * r()) : por;
  const dens = 100 - porFinal;
  const maxPore = (hipOn ? 15 : 0) + (hipOn ? 10 * r() : 30 + 260 * Math.sqrt(por) + 20 * g() + (F.streak ? 180 : 0));
  const ra = A.ra[0] * R.O.ra * (1 + 0.5 * Math.max(0, rr - 1.2)) * (1 + 0.08 * g());
  const raDown = A.ra[1] * R.O.ra * (1 + 0.08 * g());
  const raBlast = ra * 0.55;
  const curl = F.curl ? 0.35 + 0.1 * r() : 0.04 * R.O.curl * Math.abs(g());
  const warp = (F.nosr ? 0.35 + 0.25 * r() : 0.02) + 0.015 * Math.abs(g());
  const dev = Math.abs(0.03 + 0.02 * g()) + warp + (F.curl ? 0.15 : 0);
  const uts = A.uts * (1 - porFinal * 0.06) * (1 - (F.o2 ? 0.03 : 0)) + 0.03 * A.uts * g();
  const el = Math.max(0.5, A.el * (1 - porFinal * 0.25) * (1 - reuseO * 0.6) * (F.o2 ? 0.75 : 1) * (1 + 0.08 * g()));
  const flowOk = !(F.trapped);
  const mp = rr * (1 + 0.03 * g());            // melt-pool index (1 = nominal)
  const abort = F.curl && r() < 0.35;          // recoater crash stops the build in some cases
  const chk = [
    ["powder", "Powder O content index", reuseO.toFixed(2), "≤ 0.30", reuseO <= 0.3],
    ["prep", "Energy density E of the parameter set (J/mm³)", R.E.toFixed(1), `${A.win[0]}–${A.win[1]}`, R.E >= A.win[0] && R.E <= A.win[1]],
    ["setup", "O2 at start (ppm)", Math.round(o2 * 0.6), `≤ ${A.o2}`, o2 * 0.6 <= A.o2],
    ["print", "Melt-pool index (1 = nominal)", mp.toFixed(2), "0.85–1.20", mp >= 0.85 && mp <= 1.2],
    ["print", "O2 during the build, mean (ppm)", Math.round(o2), `≤ ${A.o2}`, o2 <= A.o2],
    ["print", "Powder-bed camera: streak / curl findings", (F.streak ? "streak" : "") + (F.curl ? (F.streak ? " + " : "") + "curl" : "") || "none", "none", !F.streak && !F.curl],
    ["print", "Gas flow: filter Δp (× clean filter)", (F.filter ? 3.2 + 0.3 * r() : 1.1 + 0.1 * r()).toFixed(1), "≤ 2.0", !F.filter],
    ["print", "Build completed", abort ? "STOPPED (recoater crash)" : "yes", "yes", !abort],
    ["depowder", "Channels free (weighing / shake test)", flowOk ? "free" : "powder found", "free", flowOk],
    ["edm", "Warp after cutting (mm)", warp.toFixed(2), "≤ 0.10", warp <= 0.1],
    ["support", "Ra after blasting, up-skin (µm)", raBlast.toFixed(1), "≤ 8", raBlast <= 8],
    ["inspect", "Density (CT / Archimedes, %)", dens.toFixed(2), `≥ ${A.dens}`, dens >= A.dens],
    ["inspect", "Largest pore (CT, µm)", Math.round(maxPore), "≤ 200", maxPore <= 200],
    ["inspect", "Deviation vs CAD, unmachined (mm)", dev.toFixed(2), `≤ ${A.tol + 0.08}`, dev <= A.tol + 0.08],
    ["inspect", "UTS of witness coupon (MPa)", Math.round(uts), `≥ ${Math.round(A.uts * 0.93)}`, uts >= A.uts * 0.93],
    ["inspect", "Elongation of coupon (%)", el.toFixed(1), `≥ ${(A.el * 0.75).toFixed(1)}`, el >= A.el * 0.75],
  ];
  if (R.PT.key === "insert") chk.push(["inspect", "Cooling channel flow test", flowOk ? "OK" : "blocked", "OK", flowOk]);
  return { R, seed, F: Object.assign({}, F), E, rr, o2, por, porFinal, dens, maxPore, ra, raDown, raBlast, curl, warp, dev, uts, el, mp, abort, chk,
    ok: chk.every((x) => x[4]), fails: chk.filter((x) => !x[4]) };
}

/* ---------------------------------------------------------------- layer monitoring series (≤ 400 points) */
export function series(cfg, F = {}, seed = 1) {
  const R = calc(cfg), r = rng(seed * 7 + 3), g = () => gauss(r);
  const N = Math.min(400, R.layers), step = R.layers / N;
  const sim = simulate(cfg, F, seed);
  const out = [];
  const shape = { bracket: (s) => 0.6 + 0.8 * Math.abs(Math.sin(s * 9)) * (1 - s * 0.4), insert: (s) => 1.15 - 0.2 * s, head: (s) => (s < 0.3 ? 1.4 : 0.7 + 0.3 * Math.cos(s * 20) ** 2), impeller: (s) => (s < 0.2 ? 1.6 : 0.65) }[R.PT.shape];
  const area1 = R.PT.vol * 1000 / R.box[2];                // mean part cross-section mm²
  for (let i = 0; i < N; i++) {
    const L = Math.round(i * step), z = L * R.t, inSup = z < R.supH, s = clamp((z - R.supH) / R.box[2], 0, 1);
    const area = R.n * (inSup ? area1 * 0.12 : area1 * shape(s));         // mm² scanned in this layer
    const tExp = area / (R.v * R.h * R.lasEff * 0.7);                       // s
    const f = i / N;
    let mp = sim.rr * (1 + 0.025 * g()); if (inSup) mp *= 0.93;
    if (F.filter && f > 0.25) mp *= 0.95 + 0.04 * g();
    let o2 = 320 + 40 * g(); if (F.o2 && f > 0.35) o2 = Math.min(3000, 320 + (f - 0.35) * 9000) + 60 * g();
    const streak = F.streak && f > 0.3, curl = F.curl && f > 0.45 && f < 0.75 && r() < 0.25;
    out.push({ L, z, area, tExp, tLay: tExp + R.M.recoat, mp, o2, streak, curl, flowDp: (F.filter ? 1 + f * 2.5 : 1) * (1 + 0.03 * g()) });
  }
  return { R, sim, pts: out };
}

/* ---------------------------------------------------------------- lot: n builds -> Cpk */
export const CHAR = [
  ["dens", "Density %", (s) => s.dens, (A) => [A.dens, null]],
  ["maxPore", "Largest pore µm", (s) => s.maxPore, () => [null, 200]],
  ["dev", "Deviation vs CAD mm", (s) => s.dev, (A) => [null, A.tol + 0.08]],
  ["raBlast", "Ra blasted µm", (s) => s.raBlast, () => [null, 8]],
  ["uts", "UTS MPa", (s) => s.uts, (A) => [A.uts * 0.93, null]],
  ["el", "Elongation %", (s) => s.el, (A) => [A.el * 0.75, null]],
];
export function lot(cfg, F, n = 30, seed0 = 100) {
  const runs = []; for (let i = 0; i < n; i++) runs.push(simulate(cfg, F, seed0 + i * 13));
  const A = runs[0].R.A;
  const rows = CHAR.map(([k, name, get, lim]) => {
    const xs = runs.map(get), m = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)) || 1e-9;
    const [lo, hi] = lim(A); const cpk = Math.min(lo == null ? Infinity : (m - lo) / (3 * sd), hi == null ? Infinity : (hi - m) / (3 * sd));
    const out = xs.filter((x) => (lo != null && x < lo) || (hi != null && x > hi)).length;
    return { k, name, m, sd, lo, hi, cpk, out, xs };
  });
  return { rows, yield: runs.filter((s) => s.ok).length / n, n };
}

/* self test: ?amtest prints PASS / FAIL lines in the console */
export function selfTest() {
  const L = [];
  const ok = (c, m) => L.push((c ? "PASS " : "FAIL ") + m);
  const R = calc({});
  ok(Math.abs(R.E - 370 / (1300 * 0.19 * 0.03)) < 1e-9 && R.E > 49 && R.E < 51, `E AlSi10Mg = ${R.E.toFixed(2)} J/mm³ ≈ 49.9`);
  ok(Math.abs(R.rate1i - 26.68) < 0.05, `ideal rate 1 laser = ${R.rate1i.toFixed(2)} cm³/h ≈ 26.7`);
  ok(R.nMax === 2, `bracket nesting on 250 plate = ${R.nMax} (1 × 2 expected: 2·120 + 12 > 234 usable)`);
  ok(R.layers === Math.ceil(65 / 0.03), `layers = ${R.layers}`);
  const s0 = simulate({}, {}, 5); ok(s0.ok, `nominal build passes all checks (${s0.fails.map((x) => x[1]).join(", ") || "none failed"})`);
  ok(!simulate({}, { lowP: true }, 5).ok, "dirty window is found");
  ok(!simulate({}, { nosr: true }, 5).ok, "skipped stress relief is found (warp)");
  ok(!simulate({ part: "insert", mat: "ms1" }, { trapped: true }, 5).ok, "trapped powder in the insert is found");
  FAULTS.forEach(([k, n]) => { let found = 0; for (let i = 1; i <= 10; i++) if (!simulate({}, { [k]: true }, i * 17).ok) found++; ok(found >= 8, `fault "${n}" found in ${found}/10 builds`); });
  const lt = lot({}, {}, 40); ok(lt.yield >= 0.9, `nominal lot yield = ${(lt.yield * 100).toFixed(0)} % (≥ 90 %)`);
  Object.keys(PART).forEach((p) => Object.keys(MACH).forEach((m) => { const x = calc({ part: p, mat: PART[p].mat, mach: m }); ok(x.nMax > 0 && x.costPart > 0 && isFinite(x.tMach), `${p} on ${m}: ${x.nMax} parts, ${x.tMach.toFixed(1)} h, $${x.costPart.toFixed(0)}/part`); }));
  return L;
}
