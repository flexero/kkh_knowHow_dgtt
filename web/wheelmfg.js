/* HMC build tab - item 3: DIGITAL TWIN of the WORM WHEEL manufacturing process (bronze rim shrunk on a steel hub, hobbed
   with a duplex hob that matches the worm of item 2).  11 operations from the hub blank and the centrifugal-cast bronze rim
   to the gear measuring machine, the double-flank roll test and the pairing with its worm.  Every operation is animated
   (2D SVG) and lists the real equipment (machine capability, tooling, workholding, gauges, consumables).  Each wheel gets a
   simulated part record (random variation + switchable faults), lot simulation with Cpk, time + cost.
   Geometry from item 1 (window.HMCROT), the matched worm from item 2 (window.wormMfg.current()).  Example values.  Offline. */
import { $, esc, f, RAD, SEC, AL, clamp, ease, lerp, rngOf, gauss, chart, svgOpen, txt, big, sparks, STEEL, HARD, CARB, WHEEL, CL, CR, wormData } from "./wormmfg.js";

const SW = 760, SH = 380, BRONZE = "#c08a4a", BRZ_D = "#8a5a28", HOT = "#e8742a";
const GROUPS = [
  ["Order + hub", [
    ["lot", "Lot size (wheels per order)", "pcs", 20, ""],
    ["dB", "Hub bore (fits the table hub sleeve)", "mm", 160, "H6"],
    ["pcd", "Bolt circle", "mm", 230, ""],
    ["nB", "Bolts (hub → table sleeve)", "", 12, "M10 10.9 + 2 dowels"]]],
  ["Shrink fit bronze rim on steel hub", [
    ["delta", "Interference (diameter)", "mm", 0.20, "≈ 0.6 ‰ of the joint Ø"],
    ["muJ", "Friction in the joint", "", 0.15, "dry, degreased"],
    ["Ebr", "E-modulus bronze CuSn12Ni2-C", "N/mm²", 95000, "90 000–100 000"],
    ["RpBr", "Yield strength bronze Rp0.2", "N/mm²", 180, "centrifugal cast, check EN 1982"],
    ["Sreq", "Torque safety vs. max tooth torque", "", 3, ""]]],
  ["Hobbing", [
    ["vcH", "Hob cutting speed (PM-HSS TiAlN, bronze)", "m/min", 60, "40–80"],
    ["frad", "Radial infeed per wheel turn", "mm", 0.15, ""],
    ["ftan", "Tangential feed per wheel turn", "mm", 0.5, ""],
    ["Lt", "Tangential travel (hob taper entry)", "mm", 40, ""],
    ["dhNew", "Hob pitch Ø new (oversize)", "mm", 52, "worm d₁ + 2"],
    ["dhNow", "Hob pitch Ø now (after resharpening)", "mm", 51.2, ""],
    ["dTh", "Temperature drift of the wheel while hobbing", "K", 0.3, "coolant oil"]]],
  ["Tolerances (example ≈ DIN 3974 class 5–6)", [
    ["tfp", "Single pitch fp", "± µm", 6, ""],
    ["tFp", "Cumulative pitch Fp", "µm", 20, "≈ ±12″ at d₂/2"],
    ["tFr", "Runout Fr", "µm", 16, ""],
    ["tFi", "Radial composite Fi'' (double flank)", "µm", 28, ""],
    ["tfi", "Tooth-to-tooth fi''", "µm", 10, ""],
    ["tDa", "Tight-mesh centre distance deviation", "± mm", 0.02, "= tooth thickness"],
    ["tEm", "Mid-plane position", "± mm", 0.03, ""]]],
  ["Cost (example rates)", [
    ["prBr", "Centrifugal-cast bronze rim (bought)", "$/kg", 18, ""], ["prSt", "Steel bar / forging C45", "$/kg", 2.5, ""],
    ["rLathe", "CNC lathe", "$/h", 50, ""], ["rVTL", "Vertical turning lathe", "$/h", 70, ""], ["rHMC", "Machining centre", "$/h", 80, ""],
    ["rHob", "Gear hobbing machine", "$/h", 110, ""], ["rMeas", "Measuring room", "$/h", 90, ""], ["rBench", "Roll tester / bench", "$/h", 40, ""], ["hobCost", "Duplex hob (custom) per wheel share", "$", 35, "≈ tool price / wheels per hob life"]]],
];
const DEF = { meth: "rt" }; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));
const METH = { rad: "Radial infeed", tan: "Tangential feed", rt: "Radial + tangential finish", fly: "Fly cutter (1–2 wheels)" };
const FAULTS = [
  ["porosity", "Porosity in the bronze rim casting", "starts at the foundry · PT at Op 20 finds it (else pores on the flanks at Op 90)"],
  ["shrink", "Interference too small (bore turned oversize)", "starts Op 30 · the fit measurement at Op 30 finds it; the torque test at Op 40 may still pass, but the rim gets loose when the gear is warm"],
  ["hobA", "Hob centre distance set 0.05 mm too deep", "starts Op 70 · tight-mesh check at Op 100 + shift at Op 110"],
  ["hobWear", "Worn hob (not resharpened)", "starts Op 70 · profile at Op 90 + pattern at Op 100"],
  ["hobWrong", "Wrong hob: single-lead instead of duplex", "starts Op 70 · pattern moves with the worm shift at Op 110"],
  ["thermal", "Wheel warms 3 K during the finishing cut", "starts Op 70 · cumulative pitch Fp at Op 90"],
  ["midplane", "Mid-plane offset 0.3 mm (wrong spacer on the hobbing mandrel)", "starts Op 70 · contact pattern at Op 100"],
];
const OPS = [
  { k: "hub", no: 10, n: "Hub", mc: "Band saw + CNC lathe", steps: (G) => [`Saw C45 bar Ø${Math.ceil((G.dj + 10) / 10) * 10} (or buy a forging), stamp the heat number`, `Rough turn: seat Ø${G.dj} +1, bore Ø${G.dB} −2, faces +1`, "Normalise / stress relieve if forged (C45 +N)"] },
  { k: "cast", no: 20, n: "Bronze rim", mc: "Foundry (bought) + incoming inspection", steps: () => ["Foundry: induction-melt CuSn12Ni2, pour into the spinning steel mould (centrifugal casting → dense, fine grain)", "Certificate EN 10204 3.1: chemical analysis, tensile test, hardness", "Incoming: Brinell hardness, dye-penetrant (PT) test of the bore + faces, visual"] },
  { k: "rimturn", no: 30, n: "Fit turning", mc: "CNC lathe / vertical lathe", steps: (G, P) => [`Turn the rim bore to Ø${G.dj} − ${P.delta} (interference)`, `Finish the hub seat Ø${G.dj} (k5-quality, Ra 0.8) and the shoulder`, "Measure both at 20 °C, write the real interference into the part record"] },
  { k: "shrink", no: 40, n: "Shrink fit", mc: "Induction heater / oven + press fixture", steps: (G) => [`Heat the rim evenly to ≈ ${f(G.Theat, 0)} °C (never > 200 °C)`, "Slide it onto the hub against the shoulder in < 20 s, hold while cooling", "Secure: 6 axial set screws M8 half in rim / half in hub (secondary lock)", "Torque test: lever + load cell to the test torque – no slip"] },
  { k: "finish", no: 50, n: "Finish turn", mc: "CNC vertical turning lathe", steps: (G) => [`ONE set-up: bore Ø${G.dB} H6, reference faces, tip Ø${f(G.de2, 1)}, throat Ø${f(G.da2, 1)} with throat radius R${f(G.rk, 1)}`, "Mark the mid-plane reference on the face (needed for hobbing + assembly)", "Check runout of the throat and faces to the bore"] },
  { k: "drill", no: 60, n: "Drill + ream", mc: "Machining centre (HMC/VMC)", steps: (G, P) => [`Drill ${P.nB} × M10 tap holes / through holes on PCD ${P.pcd}`, "Ream 2 dowel holes Ø10 H7 (position ±0.01)", "Deburr, blow out"] },
  { k: "hob", no: 70, n: "Hobbing", mc: "CNC gear hobbing machine with tangential head", steps: (G, P) => [`Clamp on the expanding mandrel (bore H6), align the mid-plane to the hob axis (spacer, ±${P.tEm} mm)`, `Set the hob centre distance a_h = (d_hob + d₂)/2 = ${f(G.ah, 2)} mm for the hob Ø now`, `${METH[P.meth]}: hob ${f(G.n0, 0)} rpm, wheel ${f(G.n2, 2)} rpm (electronic gearbox z₁/z₂)`, "Last revolutions without feed (spark-out) at constant oil temperature"] },
  { k: "deburr", no: 80, n: "Deburr", mc: "Brush deburring + washer", steps: () => ["Brush the tooth ends (no sharp edges, no burr into the flank)", "Wash, dry, laser mark serial on the hub face"] },
  { k: "gmm", no: 90, n: "Gear measuring", mc: "CNC gear measuring machine", steps: () => ["Rest 2 h at 20 °C", "Pitch on all 90 teeth (both flanks) → fp, Fp", "Runout Fr with a ball in every gap", "Flank (profile) on 4 teeth"] },
  { k: "roll", no: 100, n: "Roll test", mc: "Double-flank roll tester + master worm", steps: () => ["Mesh with the master worm under light spring force (no backlash)", "Record the centre-distance change over 1 wheel turn → Fi'', fi''", "Tight-mesh centre distance vs. nominal → tooth thickness", "Marking paste → contact pattern position + size"] },
  { k: "pair", no: 110, n: "Pair with worm", mc: "Test bench (as worm Op 110)", steps: () => ["Take the worm from item 2 (its part record), mount both at centre distance a", "Shift the worm axially, measure backlash, find the spacer size", "Contact pattern at the working shift", "Mark both parts with the same pair no., store + replace them together"] },
];
const EQUIP = {
  hub: (G) => ({ mc: `Automatic band saw (≥ Ø${Math.ceil((G.dj + 20) / 50) * 50}); CNC lathe swing ≥ Ø500, chuck Ø315–400, ≥ 15 kW`, tool: "CNMG 16 06 12 roughing (P25), boring bar Ø32 with CCMT insert", fix: "3-jaw chuck with soft jaws", gauge: "Caliper 0–500, inside micrometer", cons: `C45 bar / forging (EN 10083-2), emulsion` }),
  cast: () => ({ mc: "At the foundry: induction melting furnace + horizontal centrifugal casting machine (rotating steel mould, 600–1200 rpm for this size). In your goods-in: Brinell tester HBW 10/1000 (ISO 6506), dye-penetrant kit (ISO 3452), optional ultrasonic flaw detector", tool: "–", fix: "–", gauge: "PT: cleaner, red penetrant, white developer; certificate 3.1 check list", cons: "Bronze CuSn12Ni2-C-GZ (EN 1982, GZ = centrifugal cast)" }),
  rimturn: (G) => ({ mc: `CNC lathe or vertical turning lathe, swing ≥ Ø500, rigid boring`, tool: "Positive inserts for copper alloys (sharp, polished, K10 uncoated or PCD for the fit), wiper insert for the seat", fix: "Soft jaws / 6-jaw chuck for the thin rim (avoid ovality!)", gauge: `Inside micrometer / bore gauge Ø${G.dj - 5}–${G.dj + 5} (0.001), outside micrometer ${Math.floor(G.dj / 25) * 25}–${Math.floor(G.dj / 25) * 25 + 25} (0.001), thermometer (both parts at the same temperature)`, cons: "Dry or emulsion (bronze), lint-free cloth" }),
  shrink: (G, P) => ({ mc: `Induction heater for rings (temperature control, auto demagnetise not needed for bronze) or air-circulation oven ≤ 250 °C; press fixture with locating shoulder`, tool: "Heat-resistant gloves, lifting tool", fix: "Hub standing on its face, centring mandrel", gauge: `Contact thermometer / thermocouple (rim + hub), torque test rig: lever + load cell or hydraulic torque wrench ≥ ${Math.ceil(G.Ttest / 500) * 500} N·m`, cons: "6 set screws M8 ISO 4026 + thread locker, degreaser" }),
  finish: (G) => ({ mc: `CNC vertical turning lathe, table Ø≥ 500, C-axis optional, contouring for the throat radius R${f(G.rk, 1)}, thermally stable`, tool: "Profile insert R2–R3 for the throat (polished, for bronze), boring bar for H6, wiper inserts", fix: "Face plate with 3 clamps on the hub (not on the rim)", gauge: `Air plug gauge Ø${G.dB} H6, dial indicator 0.001 on a magnetic stand (runout), radius gauge / CMM for throat R`, cons: "Emulsion" }),
  drill: (G, P) => ({ mc: "Machining centre with rotary table (or VMC + indexer), position accuracy ≤ 0.01 mm", tool: `Drill Ø8.5 + tap M10 (or Ø11 through), reamer Ø10 H7, chamfer tool`, fix: "Clamp on the face, locate in the bore (Ø H6 pin)", gauge: `Plug gauge Ø10 H7, thread plug gauge M10 6H, CMM for PCD ${P.pcd} ±0.02`, cons: "Emulsion" }),
  hob: (G, P) => ({ mc: `CNC gear hobbing machine for worm wheels: wheel Ø ≥ ${Math.ceil((G.de2 + 50) / 50) * 50} mm, module ≥ ${G.m}, TANGENTIAL HEAD (hob axial feed), hob Ø ≤ 100 / length ≤ 200, hob swivel set 0° (crossed axes 90°), electronic gearbox, radial axis resolution 0.001 mm, oil coolant + mist extraction`,
    tool: `DUPLEX hob made to the worm: m ${G.m}, z₀ = ${G.z1}, ZK profile, L-lead ${f(G.pL, 3)} / R-lead ${f(G.pR, 3)} mm (= worm leads), pitch Ø new ${P.dhNew} mm (oversize for resharpening), tip Ø = worm tip + 2·0.2m, 12–16 gashes, taper entry ${P.Lt} mm, PM-HSS TiAlN, tolerance class AA (DIN 3968-type); alternative for 1–2 wheels: fly cutter in a holder`,
    fix: `Expanding mandrel for bore Ø${G.dB} H6 (runout ≤ 0.003), spacer rings to set the mid-plane`, gauge: "Setting gauge for the mid-plane, dial 0.001 for mandrel runout, hob runout check on the arbor", cons: "Hobbing oil (neat), hob resharpening service" }),
  deburr: () => ({ mc: "Brush deburring station (nylon-abrasive brush) + industrial washer; laser marker", tool: "Abrasive nylon brush Ø150", fix: "Rotating nest", gauge: "Visual + fingernail test, magnifier", cons: "Washer detergent, rust inhibitor for the steel hub" }),
  gmm: (G) => ({ mc: `CNC gear measuring machine with rotary table (wheel Ø ≤ ${Math.ceil((G.de2 + 50) / 50) * 50}, load ≥ 50 kg), worm-wheel software (pitch, runout, flank), 20 ±1 °C room`, tool: "Ball probe Ø2–3 mm", fix: "Measuring mandrel in the bore (runout ≤ 0.002)", gauge: "Calibrated pitch / profile artefacts", cons: "Alcohol, cloth" }),
  roll: (G) => ({ mc: `Double-flank roll tester for worm gears: fixed worm slide + spring-loaded wheel slide (measuring force 20–50 N), centre distance setting ${f(G.a, 1)} mm, LVDT / dial 0.001 mm, chart or digital recorder over 1 wheel turn`, tool: `MASTER WORM m ${G.m}, duplex leads as the production worm, quality class 3–4, hardened + ground`, fix: "Wheel on a measuring mandrel", gauge: "Gauge block stack to set the nominal centre distance, marking paste", cons: "Marking paste (Prussian blue), oil" }),
  pair: (G) => ({ mc: "Worm gear test bench (same as worm Op 110): adjustable centre distance, axial worm shift with micrometer, encoders, torque", tool: "The production worm of this pair (item 2 part record)", fix: "Bearing blocks as in the rotary table", gauge: "Dial 0.001 at the wheel pitch circle (backlash), marking paste", cons: "Gear oil ISO VG 220–460, tags / labels for the pair" }),
};

/* ------------------------------------------------------------------ geometry */
function geomW(W, P) {
  const G = { ...W, ...P };
  G.px = Math.PI * W.m; G.lead = W.z1 * G.px; G.gam = Math.atan(G.lead / (Math.PI * W.d1));
  G.pL = W.z1 * (G.px - W.dp / 2); G.pR = W.z1 * (G.px + W.dp / 2);
  G.d2 = W.m * W.z2; G.da2 = G.d2 + 2 * W.m; G.df2 = G.d2 - 2.4 * W.m; G.de2 = G.da2 + 1.5 * W.m; G.a = (W.d1 + G.d2) / 2; G.rk = G.a - G.da2 / 2;
  G.b2 = (window.HMCROT && window.HMCROT.M.b2) || 36; G.dj = Math.floor((G.df2 - 3.2 * W.m) / 5) * 5; G.bh = G.b2 + 10;
  G.da1 = W.d1 + 2 * W.m; G.dah = G.da1 + 0.4 * W.m;
  // shrink fit (Lamé, thick rim on a solid hub, plane stress)
  const Q = G.dj / G.de2, Est = 210000;
  G.p = (P.delta / G.dj) / ((1 / P.Ebr) * ((1 + Q * Q) / (1 - Q * Q) + 0.34) + (1 - 0.3) / Est);
  G.Thold = P.muJ * G.p * Math.PI * G.dj * G.b2 * G.dj / 2 / 1000;            // N·m
  G.Ft2a = (window.HMCROT && window.HMCROT.R && window.HMCROT.R.Ft2a) || 2714;
  G.Tmax = G.Ft2a * G.d2 / 2 / 1000; G.Treq = P.Sreq * G.Tmax; G.Ttest = Math.max(G.Treq, 1.2 * G.Tmax);
  G.sigRim = G.p * (1 + Q * Q) / (1 - Q * Q);
  G.dTheat = (P.delta + 0.001 * G.dj) / (18e-6 * G.dj); G.Theat = 20 + G.dTheat;
  // hobbing
  G.n0 = 1000 * P.vcH / (Math.PI * G.dah); G.n2 = G.n0 * W.z1 / W.z2; G.h = 2.2 * W.m;
  G.tRad = G.h / P.frad / G.n2; G.tTan = P.Lt / P.ftan / G.n2; G.tFly = P.Lt / 0.05 / (600 / W.z2);
  G.tHob = P.meth === "rad" ? G.tRad + 2 / G.n2 : P.meth === "tan" ? (G.h + 0.2) / 0.6 / G.n2 + G.tTan : P.meth === "fly" ? G.tFly : (G.h - 0.2) / P.frad / G.n2 + G.tTan;
  G.ah = (P.dhNow + G.d2) / 2;
  // masses
  G.mRim = Math.PI / 4 * (G.de2 ** 2 - G.dj ** 2) * (G.b2 + 4) * 8.8e-6;
  G.mHub = Math.PI / 4 * (G.dj ** 2 - P.dB ** 2) * G.bh * 7.85e-6;
  return G;
}

/* ------------------------------------------------------------------ simulation (part record of one wheel) */
function simulateW(G, P, F, seed, worm) {
  const r = rngOf(seed + 77), N = (m, s) => m + s * gauss(r), A = Math.abs, rng = (a) => Math.max(...a) - Math.min(...a), tanA = Math.tan(AL), O = {};
  const res = (l, v, st) => [l, v, st];
  O.hub = { setup: 20, t: 14, rate: P.rLathe, par: [["Material", "C45 +N (1.0503), or EN-GJS-600-3"], ["Blank", `Ø${Math.ceil((G.dj + 10) / 10) * 10} × ${G.bh + 6} mm, ${f(G.mHub * 1.6, 1)} kg`], ["Allowance", "+1 mm on all faces / Ø"]], res: [res("Heat number stamped", "H" + (52000 + seed % 700), "ok")] };
  const hb = N(102, 5), pores = F.porosity ? 3 + Math.floor(r() * 3) : 0;
  O.cast = { setup: 0, t: 8, rate: P.rMeas, par: [["Alloy", "CuSn12Ni2-C-GZ (EN 1982), centrifugal cast"], ["Rim blank", `Ø${Math.ceil(G.de2 + 8)} / Ø${Math.floor(G.dj - 8)} × ${G.b2 + 8} mm, ${f(G.mRim * 1.5, 1)} kg`], ["Tests", "3.1 certificate, HBW 10/1000, PT"]],
    res: [res("Hardness", `${f(hb, 0)} HBW (≥ 90, check EN 1982)`, hb >= 90 ? "ok" : "bad"), res("Dye-penetrant (bore, faces)", pores ? `${pores} indications (porosity) → REJECT rim` : "no indications", pores ? "bad" : "ok"), res("Certificate 3.1", "Sn 11–13 %, Ni 1.5–2.5 % (example)", "ok")] };
  const dAct = (F.shrink ? 0.3 : 1) * P.delta + N(0, 0.006);
  O.rimturn = { setup: 25, t: 18, rate: P.rVTL, dAct, par: [["Rim bore", `Ø${G.dj} − ${P.delta} (target)`], ["Hub seat", `Ø${G.dj} (IT5, Ra 0.8)`], ["Measuring", "both at 20 °C, same gauge"]],
    res: [res("Interference measured", `${f(dAct, 3)} mm (target ${P.delta} ±0.015)`, A(dAct - P.delta) <= 0.015 ? "ok" : "bad"), res("Rim bore roundness", `${f(A(N(6, 2)), 0)} µm (≤ 15)`, "ok")] };
  const pA = G.p * dAct / P.delta, Th = G.Thold * dAct / P.delta;
  O.shrink = { setup: 15, t: 20, rate: P.rLathe, Th, par: [["Joint pressure (Lamé)", `p = ${f(pA, 1)} N/mm²`], ["Heating", `ΔT = (δ + 0.001·d)/(α·d) = ${f(G.dTheat, 0)} K → ${f(G.Theat, 0)} °C`], ["Hoop stress in rim", `${f(G.sigRim * dAct / P.delta, 0)} N/mm² (Rp0.2 ${P.RpBr})`], ["Test torque", `${f(G.Ttest, 0)} N·m`]],
    res: [res("Holding torque (calc. from real δ)", `${f(Th, 0)} N·m (need ${f(G.Treq, 0)} = ${P.Sreq} × ${f(G.Tmax, 0)})`, Th >= G.Treq ? "ok" : "bad"), res("Torque test", Th >= G.Ttest ? `no slip at ${f(G.Ttest, 0)} N·m` : `SLIPPED at ${f(Th, 0)} N·m`, Th >= G.Ttest ? "ok" : "bad"), res("Rim stress", `${f(G.sigRim * dAct / P.delta, 0)} N/mm²`, G.sigRim * dAct / P.delta <= P.RpBr / 1.5 ? "ok" : "warn")] };
  const runB = A(N(3, 1.2)), boreDev = N(0.012, 0.004);
  O.finish = { setup: 30, t: 26, rate: P.rVTL, runB, par: [["Bore", `Ø${P.dB} H6 (0/+0.025)`], ["Throat", `Ø${f(G.da2, 1)} h8, R${f(G.rk, 1)}`], ["Tip", `Ø${f(G.de2, 1)}`]],
    res: [res("Bore Ø H6", `+${f(boreDev * 1000, 0)} µm (0…25)`, boreDev >= 0 && boreDev <= 0.025 ? "ok" : "bad"), res("Throat + face runout to bore", `${f(runB, 1)} µm (≤ 8)`, runB <= 8 ? "ok" : "bad")] };
  const posE = A(N(0.006, 0.003));
  O.drill = { setup: 20, t: 12, rate: P.rHMC, par: [["Holes", `${P.nB} × M10 on PCD ${P.pcd}, 2 × Ø10 H7 dowels`]], res: [res("Hole position", `${f(posE * 1000, 0)} µm (≤ 20)`, posE <= 0.02 ? "ok" : "bad")] };
  const daErr = N(0, 0.004) + (F.hobA ? 0.05 : 0), wear = F.hobWear ? 6 : 0, dpHob = F.hobWrong ? 0 : G.dp, em = N(0, 0.008) + (F.midplane ? 0.3 : 0), dT = F.thermal ? 3 : P.dTh;
  const FpTh = 18e-6 * dT * Math.PI * G.d2 / 4 * 1000, eCl = A(N(2, 0.8));
  O.hob = { setup: 60, t: G.tHob + 6, rate: P.rHob, daErr, em, wear, dpHob, FpTh,
    par: [["Method", METH[P.meth]], ["Hob", `duplex m ${G.m}, leads ${f(G.pL, 3)} / ${f(G.pR, 3)}, Ø now ${P.dhNow}`], ["Centre distance setting", `a_h = (${P.dhNow} + ${f(G.d2, 0)})/2 = ${f(G.ah, 2)} mm`], ["Speeds", `hob ${f(G.n0, 0)} rpm (vc ${P.vcH}), wheel ${f(G.n2, 2)} rpm`], ["Hobbing time", `${f(G.tHob, 1)} min`]],
    res: [res("Centre distance as set (machine readout)", `${daErr >= 0 ? "+" : ""}${f(daErr * 1000, 0)} µm deeper`, "info"), res("Mid-plane alignment (spacer)", `${f(em, 3)} mm`, "info"), res("Oil temperature drift", `${f(dT, 1)} K`, "info")] };
  O.deburr = { setup: 5, t: 6, rate: P.rLathe, par: [["Brush", "nylon-abrasive"]], res: [res("Burr free, marked", `serial WHL-${String(seed - 2000).padStart(5, "0")}`, "ok")] };
  // inspection traces
  const z = G.z2, phE = r() * 6.283, cum = [], fp = [];
  let walk = 0; for (let i = 0; i <= z; i++) { walk += N(0, 1.0); cum.push(walk); }
  const closeW = cum[z] / z;
  for (let i = 0; i <= z; i++) cum[i] = cum[i] - closeW * i + eCl * Math.sin(2 * Math.PI * i / z + phE) + FpTh * Math.sin(Math.PI * i / z) + (pores && i % 29 === 7 ? 3 : 0);
  for (let i = 1; i <= z; i++) fp.push([i, cum[i] - cum[i - 1]]);
  const trCum = cum.map((v, i) => [i, v]), Fp = rng(cum), fpMax = Math.max(...fp.map((p) => A(p[1])));
  const trRun = Array.from({ length: 24 }, (_, i) => [i * 15, eCl * Math.cos(i * 15 * RAD + phE) * 1.8 + N(0, 0.6)]), Fr = rng(trRun.map((p) => p[1])) + runB * 0.3;
  const ffa = A(N(3, 0.8)) + wear;
  O.gmm = { setup: 10, t: 30, rate: P.rMeas, fp, trCum, trRun, Fp, fpMax, Fr, ffa, par: [["Pitch", `all ${z} teeth, both flanks`], ["Reference", "bore (measuring mandrel)"]],
    res: [res("Single pitch fp (max)", `${f(fpMax, 1)} µm (±${P.tfp})`, fpMax <= P.tfp ? "ok" : "bad"), res("Cumulative pitch Fp", `${f(Fp, 1)} µm = ${f(Fp / 1000 / (G.d2 / 2) * SEC, 1)}″ (≤ ${P.tFp})`, Fp <= P.tFp ? "ok" : "bad"),
      res("Runout Fr", `${f(Fr, 1)} µm (≤ ${P.tFr})`, Fr <= P.tFr ? "ok" : "bad"), res("Flank form ffα", `${f(ffa, 1)} µm (≤ 6)`, ffa <= 6 ? "ok" : "bad"), res("Pores on the flanks", pores ? "visible after hobbing" : "none", pores ? "bad" : "ok")] };
  // double-flank roll test
  const fi = A(N(4, 1)) + wear * 0.8, trDF = Array.from({ length: 721 }, (_, i) => { const th = i / 2 * RAD; return [i / 2, eCl * 1.8 * Math.cos(th + phE) + fi / 2 * Math.sin(z * th) + 0.6 * Math.sin(3.7 * z * th + 1)]; });
  const Fi = rng(trDF.map((p) => p[1])), dAtight = -daErr + N(0, 0.002);       // deeper hob → thinner tooth → tight mesh closer
  const dx = clamp(em / 1.0, -0.45, 0.45), dy = clamp((P.dhNow - G.d1) / 12 - wear / 30, -0.3, 0.3), cSize = clamp(0.72 - wear / 25 - A(P.dhNow - G.d1) / 30, 0.3, 0.8);
  O.roll = { setup: 10, t: 15, rate: P.rBench, trDF, Fi, fi, dAtight, dx, dy, cSize, par: [["Master worm", `m ${G.m}, duplex, class 3–4`], ["Measuring force", "30 N (spring)"], ["Nominal a", `${f(G.a, 2)} mm`]],
    res: [res("Radial composite Fi''", `${f(Fi, 1)} µm (≤ ${P.tFi})`, Fi <= P.tFi ? "ok" : "bad"), res("Tooth-to-tooth fi''", `${f(fi, 1)} µm (≤ ${P.tfi})`, fi <= P.tfi ? "ok" : "bad"),
      res("Tight-mesh centre distance", `${f(dAtight * 1000, 0)} µm (±${P.tDa * 1000})`, A(dAtight) <= P.tDa ? "ok" : "bad"), res("Contact pattern", `${f(dx * 100, 0)} % along face, ${f(dy * 100, 0)} % height, ${f(cSize * 100, 0)} % size`, A(dx) <= 0.15 && cSize >= 0.6 ? "ok" : A(dx) <= 0.25 && cSize >= 0.5 ? "warn" : "bad")] };
  // pair with the worm of item 2
  const wR = worm && worm.R, Moff = wR ? wR.O.gmm.Moff : 0, dpU = wR ? wR.O.tg.dpU : G.dp, wsn = wR ? `WRM-2546-${String(wR.sn).padStart(5, "0")}` : "WRM-(item 2)";
  const ds = 2 * daErr * tanA, j0 = G.j0 - Moff * tanA + ds, slope = dpU / G.px, sNeed = (j0 - G.jt) / slope;
  const trJ = [0, 1, 2, 3, 4, 5].map((s) => [s, (j0 - s * slope) * 1000 + N(0, 0.5)]);
  const dxS = clamp(dx + (dpU - dpHob) / G.px * clamp(sNeed, 0, 6) / 0.05 * 0.5, -0.45, 0.45);
  O.pair = { setup: 15, t: 30, rate: P.rBench, trJ, sNeed, dxS, wsn, par: [["Worm", wsn], ["Pair no.", `P-2546-${String(seed - 2000).padStart(5, "0")}`], ["Target backlash", `${G.jt * 1000} µm`]],
    res: [res("Shift for target backlash", `${f(sNeed, 2)} mm (range 0.3–5)`, sNeed >= 0.3 && sNeed <= 5 ? "ok" : "bad"), res("Pattern at the working shift", `${f(dxS * 100, 0)} % off centre`, A(dxS) <= 0.15 ? "ok" : A(dxS) <= 0.25 ? "warn" : "bad"),
      res("Run-in", "2 h on the bench as worm Op 110", "info")] };
  let tSum = 0, cSum = G.mRim * 1.5 * P.prBr + G.mHub * 1.6 * P.prSt + P.hobCost; const fails = [], warns = [];
  OPS.forEach((o) => { const x = O[o.k]; x.cost = ((x.setup || 0) / P.lot + x.t) / 60 * x.rate; tSum += x.t; cSum += x.cost;
    x.res.forEach((rw) => { if (rw[2] === "bad") fails.push({ no: o.no, l: rw[0], v: rw[1] }); else if (rw[2] === "warn") warns.push({ no: o.no, l: rw[0], v: rw[1] }); }); });
  return { seed, sn: seed - 2000, O, fails, warns, tSum, cSum, mat: G.mRim * 1.5 * P.prBr + G.mHub * 1.6 * P.prSt, pores };
}

/* ------------------------------------------------------------------ drawing helpers */
function wheelFace(cx, cy, R, z, rot, q, o = {}) {   // face view; q = tooth depth fraction (0..1); R = tip radius px
  const h = R * 0.06, rr = R - q * h;
  let p = "";
  for (let i = 0; i < z; i++) {
    const a0 = rot + i * 2 * Math.PI / z, a1 = a0 + 0.3 * 2 * Math.PI / z, a2 = a0 + 0.7 * 2 * Math.PI / z, a3 = a0 + 2 * Math.PI / z, cut = o.cutTo == null || i <= o.cutTo;
    const P2 = (a, rad) => `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
    p += (i ? "L" : "M") + P2(a0, R) + "L" + P2(a1, R) + "L" + P2(a1 + 0.05 / z * 6, cut ? rr : R) + "L" + P2(a2 - 0.05 / z * 6, cut ? rr : R) + "L" + P2(a2, R) + "L" + P2(a3, R);
  }
  return `<path d="${p}Z" fill="${o.col || BRONZE}" stroke="${BRZ_D}" stroke-width=".8"/>`;
}
function wheelSection(x0, cy, k, G, o = {}) {   // FULL section (both halves) through the wheel axis: hub (steel) + rim (bronze, throat)
  const bh = G.bh, b2 = G.b2, rimO = o.rimO || G.de2 / 2, rimI = o.rimI || G.dj / 2, thr = o.throat !== false;
  let s = `<defs><pattern id="wwH" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,.28)"/></pattern></defs>`;
  for (const sg of [-1, 1]) {
    const Y = (rad) => cy + sg * rad * k;
    s += `<rect x="${x0 - bh / 2 * k}" y="${Math.min(Y(G.dj / 2), Y((o.bore || G.dB) / 2))}" width="${bh * k}" height="${(G.dj - (o.bore || G.dB)) / 2 * k}" fill="${o.hubCol || STEEL}" stroke="#444"/>`;
    s += `<rect x="${x0 - bh / 2 * k}" y="${Math.min(Y(G.dj / 2), Y((o.bore || G.dB) / 2))}" width="${bh * k}" height="${(G.dj - (o.bore || G.dB)) / 2 * k}" fill="url(#wwH)"/>`;
    if (o.rim !== false) {
      const xa = x0 - b2 / 2 * k + (o.rimDx || 0), xb = x0 + b2 / 2 * k + (o.rimDx || 0), ctrl = thr ? (2 * G.da2 / 2 - rimO) : rimO;
      s += `<path d="M${xa},${Y(rimI)} L${xa},${Y(rimO)} Q${(xa + xb) / 2},${Y(2 * ctrl - rimO)} ${xb},${Y(rimO)} L${xb},${Y(rimI)} Z" fill="${o.rimCol || BRONZE}" stroke="${BRZ_D}"/>`;
    }
  }
  if (o.labels !== false) {
    s += `<text x="${x0 + bh / 2 * k + 8}" y="${cy - (G.dj / 2 + (G.dB / 2 - G.dj / 2) / 2) * k}" class="apc-t">hub C45 (steel)</text>`;
    if (o.rim !== false) s += `<text x="${x0 + b2 / 2 * k + 8 + (o.rimDx || 0)}" y="${cy - (rimO - 4) * k}" class="apc-t">rim CuSn12Ni2 (bronze)</text>`;
    s += `<text x="${x0 + bh / 2 * k + 8}" y="${cy + 4}" class="apc-t">bore Ø${o.bore || G.dB}</text>`;
  }
  return s + `<line x1="${x0 - 120}" y1="${cy}" x2="${x0 + 150}" y2="${cy}" class="mx-axis"/><line x1="${x0}" y1="${cy - G.de2 / 2 * k - 12}" x2="${x0}" y2="${cy + G.de2 / 2 * k + 12}" stroke="var(--muted)" stroke-dasharray="2 3"/>`;
}
/* ------------------------------------------------------------------ scenes */
function sHub(G, R, u) {
  const k = 0.85, x0 = 560, cy = 200, p = clamp(u / 0.85, 0, 1);
  let s = svgOpen("Op 10 · Hub: saw C45 + rough turn (full section)", "CNC lathe");
  const rO = lerp(G.dj / 2 + 8, G.dj / 2 + 1, p), bore = lerp(G.dB - 24, G.dB - 4, p);
  s += wheelSection(x0, cy, k, { ...G, dj: 2 * rO, bh: G.bh + 6 }, { rim: false, bore, labels: false });
  const tx = x0 + ((G.bh + 6) / 2) * k * Math.cos(u * 30), ty = cy - rO * k;
  if (u < 0.9) s += `<path d="M${tx},${ty} l10,-16 l14,0 l-8,16 Z" fill="${CARB}"/>` + sparks(tx, ty, u * 40, 5, "#8a6d3b", 1);
  s += big(40, 60, `seat Ø${f(2 * rO, 1)} → ${G.dj + 1}`) + txt(40, 82, `bore Ø${f(bore, 1)} → ${G.dB - 2}`) + txt(40, 100, `width ${G.bh + 6} → ${G.bh + 2} mm · C45 +N · ≈ ${f(G.mHub, 1)} kg finished`) + txt(40, 130, "the seat Ø and the shoulder get finished in Op 30 (fit)");
  return s + `</svg>`;
}
function sCast(G, R, u) {
  let s = svgOpen("Op 20 · Bronze rim: centrifugal casting (foundry) + incoming inspection", "bought part");
  if (u < 0.55) {
    const v = u / 0.55, cx = 230, cy = 210, Ro = 130, th = 6 + v * 28, rot = u * 80;
    s += `<circle cx="${cx}" cy="${cy}" r="${Ro + 14}" fill="#666" stroke="#333"/><circle cx="${cx}" cy="${cy}" r="${Ro}" fill="#222"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${Ro - th / 2}" fill="none" stroke="${v < 0.9 ? HOT : BRONZE}" stroke-width="${th}"/>`;
    for (let i = 0; i < 8; i++) { const a = rot + i * 0.785; s += `<line x1="${cx + (Ro + 2) * Math.cos(a)}" y1="${cy + (Ro + 2) * Math.sin(a)}" x2="${cx + (Ro + 12) * Math.cos(a)}" y2="${cy + (Ro + 12) * Math.sin(a)}" stroke="#999" stroke-width="2"/>`; }
    s += `<path d="M${cx + 40},40 L${cx + 10},${cy - 20}" stroke="${HOT}" stroke-width="6"/><rect x="${cx + 20}" y="30" width="60" height="22" fill="#777"/>${txt(cx + 86, 46, "ladle (≈ 1180 °C)")}`;
    s += big(420, 110, "Mould spins ≈ 900 rpm") + txt(420, 132, "centrifugal force pushes the melt outwards:") + txt(420, 150, "dense outer layer, impurities stay at the bore") + txt(420, 168, "→ the bore side is machined off (allowance)") + txt(420, 200, `rim blank Ø${Math.ceil(G.de2 + 8)} / Ø${Math.floor(G.dj - 8)} × ${G.b2 + 8} mm`);
  } else {
    const cx = 230, cy = 210, Ro = 130;
    s += `<circle cx="${cx}" cy="${cy}" r="${Ro}" fill="${BRONZE}" stroke="${BRZ_D}"/><circle cx="${cx}" cy="${cy}" r="${Ro - 26}" fill="var(--surface)" stroke="${BRZ_D}"/>`;
    if (u > 0.7) s += `<circle cx="${cx}" cy="${cy}" r="${Ro - 13}" fill="none" stroke="#fff" stroke-width="22" opacity=".55"/>`;
    if (R.pores && u > 0.8) for (let i = 0; i < R.pores; i++) { const a = 0.6 + i * 1.7; s += `<circle cx="${cx + (Ro - 13) * Math.cos(a)}" cy="${cy + (Ro - 13) * Math.sin(a)}" r="5" fill="var(--critical)"/>`; }
    s += big(420, 110, "Incoming inspection") + txt(420, 132, "1 · 3.1 certificate: chemistry + tensile test") + txt(420, 150, `2 · Brinell HBW 10/1000: ${R.O.cast.res[0][1]}`) + txt(420, 168, "3 · Dye penetrant: clean → red penetrant → white developer");
    if (u > 0.8) s += big(420, 210, R.pores ? `${R.pores} red indications → REJECT` : "no indications → OK", R.pores ? "var(--critical)" : "var(--good-text)");
  }
  return s + `</svg>`;
}
function sRimTurn(G, R, u) {
  const k = 0.85, cy = 200; let s = svgOpen("Op 30 · Fit turning: rim bore + hub seat (interference fit)", "CNC / vertical lathe");
  const p = clamp(u / 0.8, 0, 1), dA = R.O.rimturn.dAct, rimI = lerp(G.dj / 2 - 4, G.dj / 2 - dA / 2, p);
  s += wheelSection(470, cy, k, G, { rim: false, labels: false }) + wheelSection(640, cy, k, { ...G, bh: 0.01 }, { rimI, labels: false });
  s += txt(420, 28 + 6, "hub seat Ø" + G.dj) + txt(600, 34, "rim (separate)");
  s += big(40, 60, `hub seat Ø${G.dj}.000`) + big(40, 82, `rim bore Ø${f(2 * rimI, 3)}`) + txt(40, 104, `interference δ = ${f(dA, 3)} mm (target ${R.P.delta})`) + txt(40, 122, "measure both at the same temperature:") + txt(40, 138, "1 K difference = 6 µm on Ø335 (bronze vs steel)");
  return s + `</svg>`;
}
function sShrink(G, R, u) {
  const k = 0.85, cy = 200, S = R.O.shrink; let s = svgOpen("Op 40 · Shrink fit: heat the rim, slide on, cool, torque test", "induction heater");
  const heat = clamp(u / 0.4, 0, 1), cool = clamp((u - 0.62) / 0.25, 0, 1), T = u < 0.4 ? 20 + heat * G.dTheat : u < 0.62 ? G.Theat : G.Theat - cool * G.dTheat;
  const exp = (T - 20) * 18e-6 * G.dj, slide = clamp((u - 0.42) / 0.18, 0, 1), rimI = G.dj / 2 - R.O.rimturn.dAct / 2 + exp / 2;
  s += wheelSection(520, cy, k, G, { rim: false, labels: false }) + wheelSection(520, cy, k, { ...G, bh: 0.01 }, { rimI, rimDx: lerp(190, 0, ease(slide)), rimCol: T > 60 ? HOT : BRONZE, labels: false });
  if (u < 0.42) s += `<rect x="${710 - 30}" y="${cy - 12}" width="60" height="24" fill="#556"/>${txt(680, cy + 32, "induction heater")}`;
  s += big(40, 60, `${f(T, 0)} °C`, T > 60 ? HOT : "var(--text)") + txt(40, 82, `bore grows ${f(exp * 1000, 0)} µm`) + txt(40, 100, `needed δ + clearance = ${f((R.O.rimturn.dAct + 0.001 * G.dj) * 1000, 0)} µm`) + txt(40, 118, u < 0.62 ? "slide on quickly (< 20 s) against the shoulder" : "cool in still air → set screws → torque test");
  if (u > 0.88) s += big(40, 160, S.res[1][1], S.res[1][2] === "ok" ? "var(--good-text)" : "var(--critical)") + `<line x1="520" y1="${cy}" x2="${520 - 200}" y2="${cy + 140}" stroke="#555" stroke-width="6"/>${txt(330, cy + 160, "lever + load cell on the hub, rim held")}`;
  return s + `</svg>`;
}
function sFinish(G, R, u) {
  const k = 0.85, x0 = 560, cy = 200; let s = svgOpen("Op 50 · Finish turn the wheel blank in ONE set-up", "CNC vertical turning lathe");
  s += wheelSection(x0, cy, k, G, {});
  const tx = x0 + (G.b2 / 2) * k * Math.sin((u - 0.5) * 2.4), ty = cy - (G.da2 / 2 + 0.5) * k;
  if (u < 0.85) s += `<circle cx="${tx}" cy="${ty - 6}" r="6" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx - 5}" y="${ty - 40}" width="10" height="30" fill="#777"/>` + sparks(tx, ty, u * 50, 4, "#c08a4a", -1);
  s += `<circle cx="120" cy="250" r="24" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="120" y1="250" x2="${120 + 20 * Math.sin(u * 20)}" y2="${250 - 20 * Math.cos(u * 20)}" stroke="var(--critical)" stroke-width="2"/>${txt(150, 254, `runout ${f(R.O.finish.runB, 1)} µm (≤ 8)`)}`;
  s += big(40, 60, `bore Ø${G.dB} H6 · throat Ø${f(G.da2, 1)}`) + big(40, 82, `R${f(G.rk, 1)} · tip Ø${f(G.de2, 1)}`) + txt(40, 104, "throat radius R = a − d_a2/2: the wheel wraps") + txt(40, 120, "around the worm") + txt(40, 144, "clamp on the hub only – clamping the thin") + txt(40, 160, "bronze rim makes it oval");
  return s + `</svg>`;
}
function sDrill(G, R, u, P) {
  const cx = 250, cy = 200, Rr = 150; let s = svgOpen("Op 60 · Drill + ream bolt and dowel holes (face view)", "machining centre");
  s += wheelFace(cx, cy, Rr, 90, 0, 0) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/><circle cx="${cx}" cy="${cy}" r="${G.dB / G.de2 * Rr}" fill="var(--surface)" stroke="#444"/>`;
  const n = Math.floor(u * (P.nB + 2.5)), pr = P.pcd / G.de2 * Rr;
  for (let i = 0; i < Math.min(n, P.nB); i++) { const a = i * 2 * Math.PI / P.nB; s += `<circle cx="${cx + pr * Math.cos(a)}" cy="${cy + pr * Math.sin(a)}" r="5" fill="#222"/>`; }
  if (n > P.nB) [0.5, 0.5 + Math.PI].forEach((a, j) => { if (n > P.nB + j) s += `<circle cx="${cx + pr * Math.cos(a + Math.PI / P.nB)}" cy="${cy + pr * Math.sin(a + Math.PI / P.nB)}" r="4" fill="var(--accent)"/>`; });
  s += big(450, 110, `${P.nB} × M10 on PCD ${P.pcd}`) + txt(450, 132, "2 × Ø10 H7 dowels (blue) – position ±0.01") + txt(450, 150, `measured position error ${f(parseFloat(R.O.drill.res[0][1]), 0)} µm`);
  return s + `</svg>`;
}
function sHob(G, R, u, P) {
  const cx = 250, cy = 215, Rr = 150, H = R.O.hob, rot = u * 2 * Math.PI * 3;
  let s = svgOpen(`Op 70 · Hobbing with the duplex hob – ${METH[P.meth]}`, "CNC gear hobbing machine");
  const q = P.meth === "rad" ? clamp(u / 0.9, 0, 1) : P.meth === "tan" || P.meth === "fly" ? clamp(u / 0.3, 0, 1) : clamp(u / 0.6, 0, 0.98) + (u > 0.6 ? 0.02 : 0);
  s += wheelFace(cx, cy, Rr, 90, rot, q) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/><circle cx="${cx}" cy="${cy}" r="${G.dB / G.de2 * Rr - 6}" fill="#777"/>${txt(cx - 30, cy + 4, "mandrel", "fill:#fff")}`;
  const tanX = P.meth === "rad" ? 0 : (clamp((u - (P.meth === "rt" ? 0.6 : 0.3)) / 0.4, 0, 1) - 0.5) * 120, hy = cy - Rr - 14 + (1 - q) * 6, hx = cx + tanX;
  s += `<rect x="${hx - 70}" y="${hy - 16}" width="140" height="28" rx="6" fill="#9aa4ae" stroke="#333"/>`;
  for (let i = 0; i < 14; i++) { const xx = hx - 66 + ((i * 10 + u * 600) % 140); s += `<line x1="${xx}" y1="${hy - 16}" x2="${xx + 4}" y2="${hy + 12}" stroke="#333"/>`; }
  s += `<line x1="${hx - 110}" y1="${hy - 2}" x2="${hx + 110}" y2="${hy - 2}" stroke="#555" stroke-width="4"/>${txt(hx + 116, hy + 2, "duplex hob")}`;
  if (u < 0.97) s += sparks(cx, cy - Rr, u * 70, 6, "#c08a4a", -1);
  s += big(440, 110, P.meth === "rad" ? `radial infeed ${f(q * G.h, 2)} / ${f(G.h, 1)} mm` : u < (P.meth === "rt" ? 0.6 : 0.3) ? `infeed to depth ${f(q * G.h, 2)} mm` : `tangential pass ${f((tanX / 120 + 0.5) * P.Lt, 0)} / ${P.Lt} mm`);
  [[`hob ${f(G.n0, 0)} rpm (vc ${P.vcH} m/min, Ø${f(G.dah, 1)})`], [`wheel ${f(G.n2, 2)} rpm = hob × z₁/z₂ (electronic gearbox)`], [`centre distance a_h = (d_hob + d₂)/2 = ${f(G.ah, 2)} mm`], [`hob leads L ${f(G.pL, 3)} / R ${f(G.pR, 3)} = worm leads`], [`mid-plane set ${f(H.em, 3)} mm (±${P.tEm})`], [`time ≈ ${f(G.tHob, 1)} min`]]
    .forEach(([t], i) => { s += txt(440, 136 + i * 18, t, i === 4 && Math.abs(H.em) > P.tEm ? "fill:var(--critical)" : ""); });
  s += txt(440, 260, "Why tangential: the hob shifts along its axis, so every hob tooth") + txt(440, 276, "generates the flank → exact duplex flank shape, smooth surface.") + txt(440, 300, "Resharpened hob is smaller → set a_h with the REAL hob Ø.");
  return s + `</svg>`;
}
function sDeburr(G, R, u) {
  const cx = 250, cy = 200, Rr = 150; let s = svgOpen("Op 80 · Deburr, wash, mark", "brush station");
  s += wheelFace(cx, cy, Rr, 90, u * 6, 1) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/>`;
  s += `<circle cx="${cx + Rr + 20}" cy="${cy}" r="34" fill="#4a6" opacity=".5" stroke="#285"/>${txt(cx + Rr + 60, cy - 40, "abrasive nylon brush")}`;
  if (u > 0.6) s += `<text x="${cx - 40}" y="${cy + 70}" class="apc-t" style="font-family:monospace;fill:#fff">WHL-${String(R.sn).padStart(5, "0")}</text>`;
  return s + `</svg>`;
}
function sGmm(G, R, u, P) {
  const M = R.O.gmm; let s = svgOpen("Op 90 · Gear measuring machine: pitch, cumulative pitch, runout, flank", "20 °C room");
  const cx = 140, cy = 210, Rr = 110; s += wheelFace(cx, cy, Rr, 90, u * 6.283, 1) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/><circle cx="${cx + Rr + 4}" cy="${cy}" r="4" fill="var(--critical)"/><line x1="${cx + Rr + 8}" y1="${cy}" x2="290" y2="${cy}" stroke="#555" stroke-width="3"/>`;
  const n = Math.max(1, Math.round(clamp(u / 0.7, 0, 1) * 90));
  s += chart({ x: 300, y: 30, w: 450, h: 160, t: "Single pitch fp (µm) – 90 teeth", xr: [0, 91], xt: [1, 30, 60, 90], yr: [-8, 8], xl: "tooth", hl: [{ y: P.tfp }, { y: -P.tfp }], series: [{ pts: M.fp.slice(0, n), col: CL, bars: true, lab: "tooth" }] });
  s += chart({ x: 300, y: 196, w: 450, h: 160, t: "Cumulative pitch (µm)", note: u > 0.7 ? `Fp ${f(M.Fp, 1)} µm (≤ ${P.tFp})` : "", xr: [0, 90], xt: [0, 30, 60, 90], yr: [-15, 15], xl: "tooth", series: [{ pts: M.trCum.slice(0, n + 1), col: CR }] });
  return s + `</svg>`;
}
function sRoll(G, R, u, P) {
  const D = R.O.roll; let s = svgOpen("Op 100 · Double-flank roll test with the master worm + contact pattern", "roll tester");
  const cx = 160, cy = 220, Rr = 120; s += wheelFace(cx, cy, Rr, 90, u * 6.283, 1) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/>`;
  const wy = cy - Rr - 22 + (D.trDF[Math.min(720, Math.round(u * 720))][1]) * 0.6;
  s += `<rect x="${cx - 90}" y="${wy - 14}" width="180" height="26" rx="8" fill="#7f8c9c" stroke="#333"/>${txt(cx + 96, wy - 6, "master worm")}<path d="M${cx},${wy - 18} l0,-20" stroke="#555" stroke-width="2"/>${txt(cx + 6, wy - 30, "spring 30 N + LVDT")}`;
  if (u < 0.7) { const n = Math.max(2, Math.round(u / 0.7 * 721));
    s += chart({ x: 320, y: 30, w: 430, h: 200, t: "Centre-distance change over 1 wheel turn (µm)", xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-20, 20], xl: "wheel °", series: [{ pts: D.trDF.slice(0, n), col: CL, w: 1 }] });
    if (u > 0.6) s += txt(320, 252, `Fi'' ${f(D.Fi, 1)} µm (≤ ${P.tFi}) · fi'' ${f(D.fi, 1)} µm (≤ ${P.tfi}) · tight-mesh Δa ${f(D.dAtight * 1000, 0)} µm`, "font-weight:600"); }
  else { const v = (u - 0.7) / 0.3;
    s += `<rect x="360" y="70" width="240" height="130" rx="10" fill="#e8c9a6" stroke="#6b3d14"/><ellipse cx="${480 + D.dx * 240}" cy="${135 + D.dy * 130}" rx="${D.cSize * 100}" ry="${D.cSize * 50}" fill="#2f6fb0" opacity="${0.15 + 0.6 * v}"/>`;
    s += txt(360, 60, "Pattern on a wheel tooth (face width →)", "font-weight:600") + txt(360, 222, `${f(D.dx * 100, 0)} % along the face · ${f(D.dy * 100, 0)} % in height · ${f(D.cSize * 100, 0)} % size`) + txt(360, 240, "along the face = mid-plane offset · in height = hob Ø / profile") + txt(360, 258, "aim: centred, slightly towards the mesh exit, ≥ 60 %"); }
  return s + `</svg>`;
}
function sPair(G, R, u, P) {
  const Pp = R.O.pair; let s = svgOpen("Op 110 · Pair the wheel with ITS worm (item 2) on the test bench", "test bench");
  const cx = 170, cy = 240, Rr = 120; s += wheelFace(cx, cy, Rr, 90, u * 4, 1) + `<circle cx="${cx}" cy="${cy}" r="${G.dj / G.de2 * Rr}" fill="${STEEL}" stroke="#444"/>`;
  const sh = clamp(u / 0.6, 0, 1) * 5; s += `<g transform="translate(${sh * 3},0)"><rect x="${cx - 120}" y="${cy - Rr - 34}" width="240" height="26" rx="8" fill="#7f8c9c" stroke="#333"/></g>${txt(cx - 120, cy - Rr - 42, `worm ${Pp.wsn} shifted ${f(sh, 1)} mm`)}`;
  const n = Math.max(1, Math.round(clamp(u / 0.6, 0, 1) * 6));
  s += chart({ x: 330, y: 30, w: 420, h: 220, t: "Backlash (µm) vs worm shift – this pair", xr: [0, 5], yr: [-40, 70], xl: "shift mm", band: [[5, 10]], hl: [{ y: 0, t: "< 0 = jammed", col: "var(--critical)" }], series: [{ pts: Pp.trJ.slice(0, n), col: CL, dots: true, lab: "shift" }] });
  if (u > 0.65) s += big(330, 278, `spacer for ${G.jt * 1000} µm: shift ${f(Pp.sNeed, 2)} mm`, Pp.sNeed >= 0.3 && Pp.sNeed <= 5 ? "var(--good-text)" : "var(--critical)") + txt(330, 298, `pattern at this shift: ${f(Pp.dxS * 100, 0)} % off centre`, Math.abs(Pp.dxS) > 0.25 ? "fill:var(--critical);font-weight:600" : "") + txt(330, 318, `pair ${Pp.par[1][1]} = ${Pp.wsn} + WHL-${String(R.sn).padStart(5, "0")} – always replaced together`);
  return s + `</svg>`;
}
const SC = { hub: sHub, cast: sCast, rimturn: sRimTurn, shrink: sShrink, finish: sFinish, drill: sDrill, hob: sHob, deburr: sDeburr, gmm: sGmm, roll: sRoll, pair: sPair };

/* ------------------------------------------------------------------ UI */
const box = $("hrItem3");
if (box) {
  box.innerHTML = `
    <div class="kpis" id="wwKpis"></div>
    <div class="card"><div class="card-head"><h2>Process twin – one worm wheel from blanks to the matched pair</h2><span class="sub">click an operation · faults change the simulated measured values</span></div>
      <div class="wm-route" id="wwRoute"></div>
      <div class="apc3d-bar"><button class="btn primary" id="wwPlay">▶ Play all</button><button class="btn ghost" id="wwPrev">◀</button><button class="btn ghost" id="wwNext">▶|</button>
        <input type="range" id="wwU" min="0" max="1000" value="0" aria-label="Progress" style="max-width:220px"><button class="btn ghost" id="wwNew">New wheel (random)</button><button class="btn ghost" id="wwExport">Download part record</button></div>
      <div class="dk-step" id="wwStep"></div>
      <div class="hr-grid"><div id="wwScene"></div><div class="apc3d-info" id="wwInfo"></div></div>
      <div class="apc3d-bar" style="margin-top:8px"><button class="btn ghost" id="ww3dBtn">Show 3D view</button><span class="small muted">3D follows the same operation + progress</span></div>
      <div class="mf3d" id="ww3d" hidden></div>
      <div class="wm-faults-wrap"><span class="tb-label">Inject a process fault:</span><div class="wm-faults" id="wwFaults"></div></div></div>
    <div class="card"><div class="card-head"><h2>Inspection report (Op 90 + 100) and pairing (Op 110)</h2><span class="sub" id="wwRepSub"></span></div><div class="wm-charts" id="wwRep"></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Part record – route, time, cost</h2></div><div class="table-wrap"><table class="apc-bom" id="wwRouteT"></table></div></div>
      <div class="card"><div class="card-head"><h2>Lot simulation</h2><button class="btn ghost" id="wwLotRun">Run 50 wheels</button></div><div class="table-wrap"><table class="apc-bom" id="wwLot"></table></div></div></div>
    <div class="card"><div class="card-head"><h2>Equipment list – machines, tooling, workholding, gauges, consumables</h2><span class="sub">required capability = purchase specification (example values)</span></div><div class="table-wrap"><table class="apc-bom wm-eq" id="wwEquip"></table></div></div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Process inputs</h2><button class="btn ghost" id="wwReset">Example values</button></div><p class="small" id="wwGeo"></p>
        <div class="seg" id="wwMeth" style="margin-bottom:8px"></div><div id="wwInputs"></div></div>
      <div class="apc-right"><div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="wwCalc" class="apc-calc"></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Guide – faults, causes, checks, rules</h2></div><div id="wwGuide" class="mx-guide"></div></div>`;

  let P = { ...DEF };
  try { Object.assign(P, JSON.parse(localStorage.getItem("hmcWheelMfg") || "{}")); } catch (er) { /* private */ }
  let F = {}, serial = 1, op = 0, u = 0, playing = false, last = performance.now(), started = false, hold = 0, G = null, R = null, lastDraw = 0;
  const pane = $("tab-hmc"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad", info: "wm-info" }, ico = { ok: "✓", warn: "!", bad: "✕", info: "i" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const worm = () => (window.wormMfg && window.wormMfg.current ? window.wormMfg.current() : null);
  const st = (k) => { const r = R.O[k].res; return r.some((x) => x[2] === "bad") ? "bad" : r.some((x) => x[2] === "warn") ? "warn" : "ok"; };
  const chk = (rows) => rows.map(([l, v, s]) => `<div class="apc-chk ${cls[s]}"><b>${ico[s]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("");
  function compute() { G = geomW(wormData(), P); R = simulateW(G, P, F, 2000 + serial, worm()); R.P = P; }
  function inputs() {
    $("wwInputs").innerHTML = GROUPS.map(([gn, fs]) => `<fieldset class="apc-fs"><legend>${esc(gn)}</legend>${fs.map(([k, l, un, d, n]) => `<label class="apc-f" title="${esc(n)}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span><span class="apc-in"><input type="number" step="any" data-k="${k}" value="${P[k]}"${P[k] !== d ? ' class="chg"' : ""}><em>${esc(un)}</em></span></label>`).join("")}</fieldset>`).join("");
    $("wwMeth").innerHTML = Object.entries(METH).map(([k, t]) => `<button class="seg-btn${P.meth === k ? " active" : ""}" data-wwm="${k}">${esc(t)}</button>`).join("");
    $("wwFaults").innerHTML = FAULTS.map(([k, l, w]) => `<button class="chip${F[k] ? " on" : ""}" data-wwf="${k}" title="${esc(w)}">${F[k] ? "⚠ " : ""}${esc(l)}</button>`).join("");
  }
  function kpis() {
    const s = R.fails.length ? `REJECT at Op ${R.fails[0].no}` : R.warns.length ? "released, warnings" : "released";
    $("wwKpis").innerHTML = [["Wheel", `WHL-${String(R.sn).padStart(5, "0")}`, `pair with ${R.O.pair.wsn}`], ["Status", s, R.fails.length ? "failed: " + [...new Set(R.fails.map((x) => "Op " + x.no))].join(", ") : "all checks passed"],
      ["Time per wheel", f(R.tSum / 60, 1) + " h", `hobbing ${f(G.tHob, 0)} min`], ["Cost per wheel", "$" + f(R.cSum, 0), `material $${f(R.mat, 0)} · lot ${P.lot}`], ["Holding torque", f(R.O.shrink.Th, 0) + " N·m", `need ${f(G.Treq, 0)} N·m`], ["Cum. pitch Fp", f(R.O.gmm.Fp, 1) + " µm", `${f(R.O.gmm.Fp / 1000 / (G.d2 / 2) * SEC, 1)}″ at the table`]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
  }
  function route() {
    $("wwRoute").innerHTML = OPS.map((o, i) => { const done = i < op || (i === op && u >= 1), s = done ? st(o.k) : ""; return `<button class="wm-op${i === op ? " on" : ""}${done ? " done" : ""}${s === "bad" || s === "warn" ? " " + s : ""}" data-wwop="${i}">${o.no} ${esc(o.n)}</button>`; }).join("");
    $("wwRouteT").innerHTML = `<thead><tr><th>Op</th><th>Operation / machine</th><th>Set-up min</th><th>min / wheel</th><th>Cost</th><th>Result</th></tr></thead><tbody>${OPS.map((o) => `<tr><td>${o.no}</td><td>${esc(o.n)}<br><span class="muted">${esc(o.mc)}</span></td><td>${f(R.O[o.k].setup, 0)}</td><td>${f(R.O[o.k].t, 1)}</td><td>$${f(R.O[o.k].cost, 1)}</td><td class="wm-st-${st(o.k)}">${ico[st(o.k)]}</td></tr>`).join("")}
      <tr><td></td><td>Material (rim ${f(G.mRim * 1.5, 1)} kg bronze, hub ${f(G.mHub * 1.6, 1)} kg steel) + hob share</td><td></td><td></td><td>$${f(R.mat + P.hobCost, 0)}</td><td></td></tr><tr><td></td><td><b>Total</b></td><td></td><td><b>${f(R.tSum, 0)}</b></td><td><b>$${f(R.cSum, 0)}</b></td><td></td></tr></tbody>`;
  }
  const eq = (k) => EQUIP[k](G, P);
  function info() {
    const o = OPS[op], x = R.O[o.k], steps = o.steps(G, P), si = Math.min(steps.length - 1, Math.floor(u * steps.length)), e = eq(o.k);
    $("wwStep").innerHTML = `<span class="dk-n">Op ${o.no}</span> <b>${esc(steps[si])}</b>`;
    $("wwInfo").innerHTML = `<div class="apc-pi-h"><b>Op ${o.no} · ${esc(o.n)}</b></div><p class="muted">${esc(o.mc)}</p><ol class="wm-steps">${steps.map((t, i) => `<li class="${i === si ? "on" : i < si ? "done" : ""}">${esc(t)}</li>`).join("")}</ol>
      <h4>Equipment</h4><table class="wm-kv">${[["Machine", e.mc], ["Tooling", e.tool], ["Workholding", e.fix], ["Gauges", e.gauge], ["Consumables", e.cons]].map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <h4>Settings</h4><table class="wm-kv">${x.par.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <h4>Checks</h4>${u >= 0.92 ? chk(x.res) : `<p class="muted">… measured at the end of the operation</p>`}<p class="small muted">time ${f(x.t, 1)} min · set-up ${f(x.setup, 0)} min · $${f(x.cost, 1)}</p>`;
  }
  function scene() { $("wwScene").innerHTML = SC[OPS[op].k](G, R, u, P); }
  function reports() {
    const M = R.O.gmm, D = R.O.roll, Pp = R.O.pair, ok = op > 8 || (op === 8 && u >= 1), card = (inner) => `<svg viewBox="0 0 360 210" class="apc-svg">${inner}</svg>`;
    $("wwRepSub").textContent = ok ? `wheel WHL-${String(R.sn).padStart(5, "0")}` : "reached at Op 90";
    if (!ok) { $("wwRep").innerHTML = `<p class="muted">The wheel has not been measured yet.</p>`; return; }
    $("wwRep").innerHTML = [
      card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Single pitch fp (µm)", note: `max ${f(M.fpMax, 1)} (±${P.tfp})`, xr: [0, 91], xt: [1, 30, 60, 90], yr: [-8, 8], xl: "tooth", hl: [{ y: P.tfp }, { y: -P.tfp }], series: [{ pts: M.fp, col: CL, bars: true, lab: "tooth" }] })),
      card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Cumulative pitch (µm)", note: `Fp ${f(M.Fp, 1)} (≤ ${P.tFp})`, xr: [0, 90], xt: [0, 30, 60, 90], yr: [-15, 15], xl: "tooth", series: [{ pts: M.trCum, col: CR }] })),
      card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Runout (µm)", note: `Fr ${f(M.Fr, 1)} (≤ ${P.tFr})`, xr: [0, 345], xt: [0, 90, 180, 270], yr: [-12, 12], xl: "angle °", series: [{ pts: M.trRun, col: CL, dots: true, lab: "angle" }] })),
      ...(op > 9 || (op === 9 && u >= 1) ? [card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Double flank: centre distance (µm)", note: `Fi'' ${f(D.Fi, 1)} · fi'' ${f(D.fi, 1)}`, xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-20, 20], xl: "wheel °", series: [{ pts: D.trDF, col: CL, w: 1 }] }))] : []),
      ...(op > 10 || (op === 10 && u >= 1) ? [card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Backlash vs worm shift (µm)", note: `shift ${f(Pp.sNeed, 2)} mm`, xr: [0, 5], yr: [-40, 70], xl: "shift mm", band: [[5, 10]], series: [{ pts: Pp.trJ, col: CL, dots: true, lab: "shift" }] }))] : []),
      `<div class="apc-checks">${chk([...M.res, ...(op >= 9 ? D.res : []), ...(op >= 10 ? Pp.res : [])])}</div>`].join("");
  }
  function equipTable() {
    $("wwEquip").innerHTML = `<thead><tr><th>Op</th><th>Machine (required capability)</th><th>Tooling</th><th>Workholding</th><th>Gauges / test equipment</th><th>Consumables</th></tr></thead><tbody>${OPS.map((o) => { const e = eq(o.k); return `<tr><td><b>${o.no}</b><br>${esc(o.n)}</td><td>${esc(e.mc)}</td><td>${esc(e.tool)}</td><td>${esc(e.fix)}</td><td>${esc(e.gauge)}</td><td>${esc(e.cons)}</td></tr>`; }).join("")}</tbody>`;
  }
  function runLot() {
    const N = 50, recs = Array.from({ length: N }, (_, i) => simulateW(G, P, F, 7000 + i, worm()));
    const C = [["Interference δ (mm)", (r) => r.O.rimturn.dAct, P.delta - 0.015, P.delta + 0.015], ["Holding torque (N·m)", (r) => r.O.shrink.Th, G.Treq, null], ["Throat runout (µm)", (r) => r.O.finish.runB, null, 8],
      ["Single pitch fp max (µm)", (r) => r.O.gmm.fpMax, null, P.tfp], ["Cumulative Fp (µm)", (r) => r.O.gmm.Fp, null, P.tFp], ["Runout Fr (µm)", (r) => r.O.gmm.Fr, null, P.tFr], ["Fi'' (µm)", (r) => r.O.roll.Fi, null, P.tFi],
      ["Tight-mesh Δa (mm)", (r) => r.O.roll.dAtight, -P.tDa, P.tDa], ["Pattern off centre (%)", (r) => r.O.roll.dx * 100, -15, 15], ["Worm shift needed (mm)", (r) => r.O.pair.sNeed, 0.3, 5]];
    const rows = C.map(([n, fn, lo, hi]) => { const v = recs.map(fn), m = v.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1)) || 1e-9;
      const cpk = Math.min(hi != null ? (hi - m) / (3 * sd) : Infinity, lo != null ? (m - lo) / (3 * sd) : Infinity), out = v.filter((x) => (hi != null && x > hi) || (lo != null && x < lo)).length;
      return `<tr><td>${esc(n)}</td><td>${lo != null ? f(lo, 3) : "–"} … ${hi != null ? f(hi, 3) : "–"}</td><td>${f(m, 3)}</td><td>${f(sd, 3)}</td><td class="wm-st-${cpk >= 1.33 ? "ok" : cpk >= 1 ? "warn" : "bad"}">${Number.isFinite(cpk) ? (cpk > 99 ? "> 99" : f(cpk, 2)) : "–"}</td><td>${out}</td></tr>`; }).join("");
    const good = recs.filter((r) => !r.fails.length).length;
    $("wwLot").innerHTML = `<thead><tr><th>Characteristic</th><th>Limits</th><th>Mean</th><th>σ</th><th>Cpk</th><th>Out</th></tr></thead><tbody>${rows}<tr><td colspan="6"><b>Yield: ${good} / ${N} wheels pass every check (${f(good / N * 100, 0)} %)</b></td></tr></tbody>`;
  }
  function formulas() {
    $("wwGeo").innerHTML = `<b>From item 1:</b> m ${G.m} · z₂ ${G.z2} · d₁ ${G.d1} · b₂ ${G.b2} · Δp ${G.dp} mm · matched worm from item 2: ${R.O.pair.wsn}`;
    $("wwCalc").innerHTML = [
      blk("1 · Wheel geometry", [`d₂ = m·z₂ = ${f(G.d2, 0)} mm,  throat d_a2 = d₂ + 2m = ${f(G.da2, 1)},  root d_f2 = d₂ − 2.4m = ${f(G.df2, 1)}`, `tip d_e2 ≈ d_a2 + 1.5m = ${f(G.de2, 1)},  centre distance a = (d₁ + d₂)/2 = ${f(G.a, 1)}`, `throat radius r_k = a − d_a2/2 = <b>${f(G.rk, 1)} mm</b>,  joint Ø (rim/hub) ≈ d_f2 − 3.2m → ${G.dj} mm`]),
      blk("2 · Shrink fit (Lamé, thick rim on solid hub)", [`Q = d_j/d_e2 = ${f(G.dj / G.de2, 3)}`, `p = (δ/d_j) / [ (1/E_br)·((1+Q²)/(1−Q²) + ν_br) + (1−ν_st)/E_st ] = <b>${f(G.p, 1)} N/mm²</b>`, `T_hold = μ·p·π·d_j·b·d_j/2 = ${P.muJ}·${f(G.p, 1)}·π·${G.dj}·${G.b2}·${G.dj}/2 = <b>${f(G.Thold, 0)} N·m</b>`,
        `need ${P.Sreq} × T_max,  T_max = F_t2,allowed·d₂/2 = ${f(G.Ft2a, 0)}·${f(G.d2 / 2000, 3)} = ${f(G.Tmax, 0)} N·m → ${f(G.Treq, 0)} N·m`, `hoop stress σ_t = p·(1+Q²)/(1−Q²) = ${f(G.sigRim, 0)} N/mm² (≤ Rp0.2/1.5 = ${f(P.RpBr / 1.5, 0)})`, `heating ΔT = (δ + 0.001·d_j)/(α_br·d_j) = ${f(G.dTheat, 0)} K → ${f(G.Theat, 0)} °C (α_br = 18·10⁻⁶/K)`, `warm gear: the bronze rim is OUTSIDE and grows more than the steel hub → fit gets looser: Δδ = (α_br − α_st)·ΔT·d_j = (18 − 11.5)·10⁻⁶·30 K·${G.dj} = <b>${f(6.5e-6 * 30 * G.dj, 3)} mm</b> at +30 K → δ left ${f(P.delta - 6.5e-6 * 30 * G.dj, 3)} mm, T_hold ${f(G.Thold * (P.delta - 6.5e-6 * 30 * G.dj) / P.delta, 0)} N·m`], "Secondary lock: 6 set screws (ISO 4026) drilled half in the rim, half in the hub, with thread locker."),
      blk("3 · Hobbing", [`hob tip Ø = d_a1 + 0.4m = ${f(G.dah, 1)} mm,  n₀ = 1000·v_c/(π·d) = ${f(G.n0, 0)} rpm`, `wheel speed n₂ = n₀·z₁/z₂ = ${f(G.n2, 2)} rpm (electronic gearbox)`, `radial: t = h/(f_r·n₂) = ${f(G.h, 1)}/(${P.frad}·${f(G.n2, 2)}) = ${f(G.tRad, 1)} min`, `tangential: t = L_t/(f_t·n₂) = ${P.Lt}/(${P.ftan}·${f(G.n2, 2)}) = ${f(G.tTan, 1)} min`, `chosen: ${METH[P.meth]} → <b>${f(G.tHob, 1)} min</b>`, `centre distance setting a_h = (d_hob,now + d₂)/2 = (${P.dhNow} + ${f(G.d2, 0)})/2 = ${f(G.ah, 2)} mm`]),
      blk("4 · Effects on the gear", [`hob 0.01 mm too deep → tooth thinner by 2·0.01·tan20° = 7.3 µm → backlash +7.3 µm`, `→ worm shift changes by Δj/(Δp/pₓ) = 7.3/${f(G.dp / G.px * 1000, 1)} = ${f(7.3 / (G.dp / G.px * 1000), 2)} mm`, `pitch error from wheel temperature drift: F_p ≈ α·ΔT·π·d₂/4 = ${f(18e-6 * P.dTh * Math.PI * G.d2 / 4 * 1000, 1)} µm (simple model)`, `1 µm at r = d₂/2 = ${f(G.d2 / 2, 0)} mm = ${f(1e-3 / (G.d2 / 2) * SEC, 2)}″ table angle`]),
    ].join("");
  }
  function guide() {
    $("wwGuide").innerHTML = `<h3>Faults – cause → found by → prevention</h3><table class="apc-bom"><thead><tr><th>Fault</th><th>Cause</th><th>Found by</th><th>Prevention</th></tr></thead><tbody>
      <tr><td>Porosity</td><td>casting gas / shrinkage, bad melt practice</td><td>PT at goods-in (Op 20), pores on flanks after hobbing</td><td>centrifugal casting, enough bore allowance, 3.1 certificate, PT every rim</td></tr>
      <tr><td>Rim slips on hub</td><td>interference too small, oily joint, rim at a different temperature when measured</td><td>torque test Op 40</td><td>measure both parts at 20 °C, degrease, set screws as secondary lock</td></tr>
      <tr><td>Wrong tooth thickness</td><td>hob centre distance set for the NEW hob Ø</td><td>tight-mesh centre distance Op 100, worm shift Op 110</td><td>set a_h from the measured hob Ø after every resharpening, first-part check</td></tr>
      <tr><td>Profile error / rough flanks</td><td>worn hob</td><td>flank form Op 90, fi'' + pattern Op 100</td><td>tool life counter, resharpen in time, hob runout check on the arbor</td></tr>
      <tr><td>Pattern moves with worm shift</td><td>hob leads ≠ worm leads (single-lead hob for a duplex worm)</td><td>pairing Op 110</td><td>order the hob WITH the worm data (leads L/R, profile, d₁), keep hob + worm drawing linked</td></tr>
      <tr><td>Cumulative pitch error</td><td>temperature drift, mandrel runout, machine indexing</td><td>Fp at Op 90</td><td>constant oil temperature, mandrel ≤ 3 µm, last passes as spark-out</td></tr>
      <tr><td>Pattern off centre (along face)</td><td>mid-plane offset on the hobbing mandrel</td><td>pattern Op 100</td><td>mid-plane reference from Op 50, spacer + setting gauge</td></tr></tbody></table>
      <h3>Workshop rules</h3><ul><li><b>Bore = reference</b> for finish turning, hobbing, measuring and assembly – one bore, H6, never re-machined.</li>
        <li><b>The hob is made from the worm data.</b> Duplex worm → duplex hob with the same leads and profile; it is a custom tool (long lead time – order early).</li>
        <li><b>Real hob Ø after every resharpening</b> → new centre distance setting.</li>
        <li><b>Thin bronze rim:</b> clamp on the hub, light cuts, sharp polished inserts – bronze is soft and the rim goes oval.</li>
        <li><b>Worm + wheel = matched pair</b>: pair number on both, stored and replaced together; spacer ring ground for this pair.</li>
        <li><b>Make or buy:</b> the hobbing machine with tangential head and the custom duplex hob are the expensive part – for few tables compare with worm-gear makers' quotes for a matched set.</li></ul>`;
  }
  function renderAll() { compute(); kpis(); route(); scene(); info(); reports(); formulas(); runLot(); equipTable(); guide(); }
  function frame() { scene(); info(); route(); $("wwU").value = Math.round(u * 1000); $("wwPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }
  function go(n) { op = clamp(n, 0, OPS.length - 1); u = 0; hold = 0; frame(); reports(); }
  function startLoop() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || box.hidden || !playing) return;
      if (u < 1) { u = Math.min(1, u + dt / 7); if (now - lastDraw > 33 || u >= 1) { lastDraw = now; frame(); if (u >= 1) { reports(); } } }
      else { hold += dt; if (hold > 1.4) { hold = 0; if (op < OPS.length - 1) go(op + 1); else { playing = false; frame(); } } } };
    requestAnimationFrame(loop);
  }
  inputs();
  $("wwInputs").addEventListener("change", (ev) => { const k = ev.target.dataset.k; if (!k) return; const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v <= 0) { ev.target.value = P[k]; return; }
    P[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]); try { localStorage.setItem("hmcWheelMfg", JSON.stringify(P)); } catch (er) { /* ignore */ } renderAll(); frame(); });
  $("wwMeth").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wwm]"); if (!b) return; P.meth = b.dataset.wwm; try { localStorage.setItem("hmcWheelMfg", JSON.stringify(P)); } catch (er) { /* ignore */ } inputs(); renderAll(); frame(); });
  $("wwFaults").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wwf]"); if (!b) return; F[b.dataset.wwf] = !F[b.dataset.wwf]; inputs(); renderAll(); frame(); });
  $("wwReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; P = { ...DEF }; try { localStorage.removeItem("hmcWheelMfg"); } catch (er) { /* ignore */ } inputs(); renderAll(); frame(); });
  $("wwPlay").addEventListener("click", () => { playing = !playing; if (playing && op === OPS.length - 1 && u >= 1) go(0); last = performance.now(); frame(); });
  $("wwPrev").addEventListener("click", () => { playing = false; go(op - 1); });
  $("wwNext").addEventListener("click", () => { playing = false; go(op + 1); });
  $("wwU").addEventListener("input", (ev) => { playing = false; u = ev.target.value / 1000; frame(); reports(); });
  $("wwRoute").addEventListener("click", (ev) => { const b = ev.target.closest("[data-wwop]"); if (b) { playing = false; go(+b.dataset.wwop); } });
  $("wwNew").addEventListener("click", () => { serial++; renderAll(); frame(); });
  $("ww3dBtn").addEventListener("click", () => { const el = $("ww3d"); el.hidden = !el.hidden; $("ww3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view"; if (!el.hidden && !el.dataset.on) { el.dataset.on = "1"; import("./mfg3d.js").then((m) => m.create(el, () => window.wheelMfg.state(), "wheel")); } });
  if (new URLSearchParams(location.search).has("show3d")) setTimeout(() => $("ww3dBtn").click(), 400);
  $("wwLotRun").addEventListener("click", () => runLot());
  $("wwExport").addEventListener("click", () => {
    const rec = { wheel: `WHL-2546-${String(R.sn).padStart(5, "0")}`, pair: R.O.pair.par[1][1], worm: R.O.pair.wsn, geometry: { m: G.m, z2: G.z2, d2: G.d2, da2: G.da2, de2: G.de2, rk: G.rk, b2: G.b2, joint: G.dj }, faults: Object.keys(F).filter((k) => F[k]),
      operations: OPS.map((o) => ({ op: o.no, name: o.n, equipment: eq(o.k), setup_min: R.O[o.k].setup, time_min: +R.O[o.k].t.toFixed(2), cost: +R.O[o.k].cost.toFixed(2), settings: Object.fromEntries(R.O[o.k].par), checks: R.O[o.k].res.map(([l, v, s]) => ({ check: l, value: v, result: s })) })),
      verdict: R.fails.length ? "REJECT" : "RELEASED", note: "simulated example values" };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" })); a.download = `${rec.wheel}_part_record.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  window.addEventListener("hritemshow", (ev) => { if (ev.detail === "3") { renderAll(); frame(); startLoop(); } });
  window.addEventListener("hmcrotchange", () => { if (!box.hidden) { renderAll(); frame(); } });
  window.wheelMfg = { show: () => window.wormMfg && window.wormMfg.showItem("3"), state: () => ({ k: OPS[op].k, no: OPS[op].no, n: OPS[op].n, u, G, R, P, F, visible: !box.hidden && pane && pane.classList.contains("active") }) };
  const q = new URLSearchParams(location.search);
  if (q.get("wwf")) q.get("wwf").split(",").forEach((k) => { if (FAULTS.some((x) => x[0] === k)) F[k] = true; });
  if (q.get("wwsn")) serial = Math.max(1, parseInt(q.get("wwsn"), 10) || 1);
  if (q.get("wwop")) { const i = OPS.findIndex((o) => o.no === parseInt(q.get("wwop"), 10)); if (i >= 0) { op = i; u = q.get("wwu") ? clamp(parseFloat(q.get("wwu")), 0, 1) : 1; } }
  if (q.get("hritem") === "3") { inputs(); setTimeout(() => { if (box.hidden && window.wormMfg) window.wormMfg.showItem("3"); else { renderAll(); frame(); startLoop(); } }, 50); }
}
