/* HMC build tab - item 4: DIGITAL TWIN of the SPINDLE MANUFACTURING (motor spindle HSK-A63, 12 000 rpm).
   The SPINDLE SHAFT runs through 14 animated operations (2D SVG side view in half section + optional 3D view): saw,
   face + centre, rough turn, deep-hole (gun) drilling of the drawbar bore, stress relief, semi-finish turn, C-axis milling,
   pre-grinding, gas nitriding, external cylindrical grinding, internal grinding of the HSK taper, thread finishing,
   dynamic balancing and the final inspection.  Every operation lists the real equipment (required machine capability,
   tooling, workholding, gauges, consumables).  Each shaft gets a simulated part record (random variation + 7 switchable
   faults), lot simulation with Cpk, time + cost.  Housing, spacers, drawbar + disc springs, covers have process plans.
   Design data (shaft profile, bearings, balancing grade …) from spindle.js (shared with the spindle assembly twin).
   All values are EXAMPLES.  Offline, no libraries. */
import { $, esc, f, clamp, ease, lerp, rngOf, gauss, chart, svgOpen, txt, big, sparks, STEEL, HARD, GRD, CARB, CL, CR } from "./wormmfg.js";
import { SP_GROUPS, SP_DEF, spGeom, spCalc, SP_PARTS } from "./spindle.js";

const SW = 760, SH = 380, HOT = "#e8742a", NIT = "#4d5b6b", ABR = "#c9b48f", BLUE = "#2f6fb0", RHO = 7.85e-6, ALPHA = 11.5e-6;
const YYWW = "2646";                                                     // ISO year + week of the example serials
const PGROUPS = [
  ["Order + material", [
    ["lot", "Lot size (shafts per order)", "pcs", 10, "set-up time is shared"],
    ["Db", "Bar Ø, 31CrMoV9 +QT", "mm", 130, "largest shaft Ø + ≈ 10"],
    ["prSt", "Bar price 31CrMoV9 +QT", "$/kg", 4.5, "example"]]],
  ["Turning", [
    ["vcT", "Cutting speed (coated carbide, QT steel)", "m/min", 180, "150–220"],
    ["fT", "Feed, roughing", "mm/rev", 0.35, ""],
    ["apT", "Depth of cut, roughing", "mm", 3, ""],
    ["aR", "Allowance after rough turning (on Ø)", "mm", 2, "for drift + distortion"],
    ["aS", "Grinding stock after semi-finish turning (on Ø)", "mm", 0.4, "0.3–0.5"],
    ["aP", "Stock left by pre-grinding (on Ø)", "mm", 0.06, "removed after nitriding"]]],
  ["Deep-hole (gun) drilling", [
    ["vcG", "Cutting speed, carbide gun drill", "m/min", 80, "60–100, tool maker"],
    ["fG", "Feed", "mm/rev", 0.03, "0.02–0.05"],
    ["pG", "Coolant pressure at the drill", "bar", 60, "Ø22: ≈ 40–80, tool maker"],
    ["dLim", "Max. bore drift at the exit", "mm", 0.15, "example limit"]]],
  ["Gas nitriding", [
    ["Tn", "Nitriding temperature", "°C", 520, "500–530"],
    ["Nht", "Target nitriding depth Nht (as nitrided)", "mm", 0.5, "0.4–0.6"],
    ["kN", "Depth factor k in Nht = k·√t", "mm/√h", 0.075, "from heat-treater trials – check"],
    ["NhtMin", "Min. Nht after grinding (drawing)", "mm", 0.4, ""],
    ["charge", "Shafts per furnace charge", "pcs", 12, ""]]],
  ["Grinding", [
    ["vs", "Wheel speed (vitrified CBN)", "m/s", 45, "never above the wheel marking"],
    ["vw", "Work speed", "m/min", 20, "q = vs/vw ≈ 100–150"],
    ["frR", "Plunge infeed rough, per work rev", "mm", 0.002, ""],
    ["frF", "Plunge infeed finish, per work rev", "mm", 0.0005, "+ spark-out"],
    ["bW", "Wheel width", "mm", 40, ""],
    ["dTg", "Coolant temperature drift", "K", 0.5, "chiller ±0.5 K"],
    ["dIw", "Internal wheel Ø (taper)", "mm", 32, "≈ 0.7 × bore"],
    ["vsI", "Internal wheel speed", "m/s", 35, ""]]],
  ["Balancing", [
    ["nBal", "Balancing speed", "rpm", 1200, "rigid rotor"],
    ["rCor", "Correction radius (M6 balancing screws)", "mm", 34, "body Ø68"],
    ["mCorMax", "Max. correction mass per plane", "g", 3, "screw sizes / holes"]]],
  ["Tolerances (examples – check drawing + bearing maker)", [
    ["tSeat", "Bearing seat Ø js4", "± µm", 4, "IT4 = 8 µm (50–80 mm)"],
    ["tRnd", "Roundness of the bearing seats", "µm", 1.0, ""],
    ["tCo", "Runout of the seats to the common axis A-B", "µm", 1.5, ""],
    ["tTap", "Taper runout at the nose to A-B", "µm", 2, ""],
    ["tT300", "Test mandrel runout at 300 mm", "µm", 5, "check with the spindle spec"],
    ["tCon", "Taper contact (blue test), min.", "%", 80, ""],
    ["tNut", "Lock-nut face runout (thread ⟂ axis)", "µm", 3, ""],
    ["tRa", "Ra of the bearing seats", "µm", 0.2, ""]]],
  ["Cost (example rates)", [
    ["rSaw", "Band saw", "$/h", 30, ""], ["rLathe", "CNC lathe", "$/h", 60, ""], ["rGun", "Gun-drilling machine", "$/h", 90, ""],
    ["rHT", "Furnace (per charge hour)", "$/h", 70, ""], ["rMill", "Turn-mill centre (C/Y axis)", "$/h", 85, ""], ["rGr", "CNC cylindrical grinder (CBN)", "$/h", 120, ""],
    ["rIG", "Universal internal grinder", "$/h", 130, ""], ["rBal", "Balancing machine", "$/h", 70, ""], ["rMeas", "Measuring room", "$/h", 90, ""]]],
];
const ALLG = [...SP_GROUPS.map(([n, fs]) => ["Design – " + n, fs]), ...PGROUPS];
const DEF = { ...SP_DEF }; PGROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

const FAULTS = [
  ["drift", "Gun drill drifts (worn guide pads, no counter-rotation)", "starts Op 40 · exit position check at Op 40; if missed: large unbalance at Op 130"],
  ["nit", "Nitriding too shallow (Kn too low / cycle cut short)", "starts Op 90 · hardness traverse on the coupon at Op 90"],
  ["chatter", "Grinding chatter (wheel out of balance, not dressed)", "starts Op 100 · roundness at Op 100 (lobes)"],
  ["taper", "Taper angle wrong (table swivel 0.01° off)", "starts Op 110 · blue test < 80 % + runout at Op 110"],
  ["thread", "Lock-nut thread not square (clamped on an unground Ø)", "starts Op 120 · gauge-nut face runout at Op 120"],
  ["burn", "Grinding burn (coolant nozzle blocked)", "starts Op 100 · nital etch at Op 100"],
  ["unbal", "Balancing correction at the wrong angle (plane set-up wrong)", "starts Op 130 · verification run at Op 130"],
];
const OPS = [
  { k: "saw", no: 10, n: "Saw", mc: "Band saw", steps: (G, P) => [`Take bar Ø${P.Db} 31CrMoV9 +QT from the store, check the 3.1 certificate (+ ultrasonic test of the bar)`, `Saw to ${G.Lsaw} mm (≈ 5 mm facing allowance per end)`, "Stamp the heat number – from now on every value goes into the part record"] },
  { k: "face", no: 20, n: "Face + centre", mc: "CNC lathe", steps: (G) => ["Clamp in the chuck, support the free end in a steady rest", `Face both ends to the length ${G.L} mm`, "Drill centre holes DIN 332 form B on both ends (temporary – the bore removes them)", "Check length + centre contact (blue)"] },
  { k: "rough", no: 30, n: "Rough turn", mc: "CNC lathe (chuck + tailstock)", steps: (G, P) => ["Clamp: chuck on the tail end, live centre in the nose centre hole", `Rough turn all diameters in passes, ap ${P.apT} mm`, `Every diameter keeps +${P.aR} mm on Ø (drift of the bore + distortion are still to come)`, "Turn the part around, rough the tail end"] },
  { k: "gun", no: 40, n: "Gun drilling", mc: "Deep-hole drilling machine", steps: (G, P) => ["Clamp the shaft in the workhead chuck + steady rest, nose face against the drill bushing", `Pilot: the drill enters through the guide bushing (Ø${G.M.dBore} G6) – start slowly`, `Drill Ø${G.M.dBore} through ${G.L} mm (L/D ${f(G.LD, 0)}) – workpiece AND drill turn in opposite directions (counter-rotation = less drift)`, `High-pressure oil ${P.pG} bar through the drill, chips flush out along the V-flute`, "Measure the drift: bore centre at the exit vs outside Ø (wall thickness)"] },
  { k: "relief", no: 50, n: "Stress relief", mc: "Pit furnace (shafts hanging)", steps: () => ["Hang the shafts vertically (lying shafts bend in the furnace)", "Heat slowly to 580 °C, hold 2 h (≥ 30 K above nitriding, ≥ 30 K below the tempering temperature of the bar – check certificate)", "Cool in the furnace to < 300 °C, then in still air", "Check hardness (HBW) and bend (runout on V-blocks)"] },
  { k: "semi", no: 60, n: "Semi-finish turn", mc: "CNC lathe with steady rest", steps: (G, P) => [`Turn all ground diameters to +${P.aS} mm on Ø, others to finished size, chamfers, undercuts`, "Steady rest on the front seat: bore the HSK taper (+stock) and the clamping-set cavity", "From the rear: bore the rear bore; the disc-spring chamber Ø41 lies between the Ø22 and Ø30 bores and cannot be reached by a normal boring bar – DESIGN POINT, see guide 18 §17.2 (options: two-piece shaft, spring chamber opened to the rear, smaller spring pack, or undercut tool)", "Turn 60° protected centre chamfers in both bore ends (the new references for grinding)", `Rough the lock-nut threads M${G.M.dF}×1.5 and M${G.M.dR}×1.5 (stay soft – masked when nitriding)`] },
  { k: "mill", no: 70, n: "Mill (C-axis)", mc: "Turn-mill centre / HMC with rotary axis", steps: () => ["Clamp on the turned Ø, C-axis indexes the shaft", "Mill 2 drive-key seats in the nose face, drill + tap the key and cover screw holes", "Drill + tap 2 × 8 M6 balancing holes in 2 correction planes", "Mill the wrench flats on the tail, deburr every hole (no burr into the bore!)"] },
  { k: "pre", no: 80, n: "Pre-grind", mc: "CNC cylindrical grinder", steps: (G, P) => ["Between the turned centre chamfers (centre plugs)", `Grind seats, rotor seat, tail and nose face to final + ${P.aP} mm on Ø`, "Pre-grind the taper (+ stock) – nitriding grows the part only a few µm", "Wash; mask the threads + balancing planes with anti-nitriding paste"] },
  { k: "nit", no: 90, n: "Gas nitriding", mc: "Gas nitriding furnace with Kn control", steps: (G, P) => [`Hang the shafts + test coupon of the same heat; purge with N₂`, `Heat to ${P.Tn} °C, NH₃ atmosphere, nitriding potential Kn controlled (H₂ sensor)`, `Hold ≈ ${f(G.tN, 0)} h for Nht ${P.Nht} mm (Nht ≈ k·√t)`, "Cool under N₂; coupon: surface HV, hardness traverse → Nht, white layer; bend check"] },
  { k: "grind", no: 100, n: "OD grind", mc: "CNC cylindrical grinder, CBN, in-process gauge", steps: () => ["Re-lap / grind the centre chamfers, fit hardened centre plugs (runout ≤ 0.5 µm)", "Soak at 20 °C, plunge grind front + rear bearing seats js4, rotor seat, tail in ONE set-up", "Grind the nose face with an angled wheel (⟂ to the seats)", "In-process gauge stops the infeed; spark-out; measure roundness + runout; nital etch"] },
  { k: "taper", no: 110, n: "Grind HSK taper", mc: "Universal internal / external grinder", steps: () => ["Hold the shaft on its ground bearing seats (steady rests / collet) – NOT on the centres", "Swivel the table to the taper half-angle 2.862° (taper 1:10)", "Internal high-frequency spindle grinds the taper; grind the HSK face in the same set-up", "Blue test with the taper gauge (contact ≥ 80 %), runout with the test mandrel"] },
  { k: "thread", no: 120, n: "Finish threads", mc: "Precision CNC lathe (hard turning)", steps: (G) => ["Clamp on the ground rear seat (collet), steady rest on the ground front seat", `Finish turn M${G.M.dF}×1.5 and M${G.M.dR}×1.5 6g with the thread start square to the axis`, "Thread ring gauge GO / NO-GO", "Screw on a gauge nut, measure its face runout (= thread ⟂ axis)"] },
  { k: "bal", no: 130, n: "Balance", mc: "Horizontal balancing machine (2 planes)", steps: (G, P) => ["Lay the shaft on the roller supports at the bearing seats, belt drive", `Measure the unbalance in 2 planes at ${P.nBal} rpm`, "Correct with M6 balancing screws in the planes (mass + angle from the machine)", "Verification run: residual unbalance ≤ U_per per plane"] },
  { k: "insp", no: 140, n: "Inspect + mark", mc: "Measuring room 20 °C + laser marker", steps: () => ["Roundness tester: seats roundness, coaxiality, nose face runout", "Taper: test mandrel runout at the nose and at 300 mm, gauge dimension", "Hardness (UCI on the nitrided surface), Ra, visual; CMM report", "Laser mark the serial, oil + VCI, store hanging or in a V-box"] },
];
const EQUIP = {
  saw: (G, P) => ({ mc: `Automatic band saw, capacity ≥ Ø${Math.ceil((P.Db + 20) / 50) * 50}, bimetal blade, coolant, length stop ±0.5 mm`, tool: "Bimetal band M42, 3/4 tpi variable pitch (for Ø100–150 solid)", fix: "Hydraulic vise + bundle feed", gauge: "Tape / length stop, steel stamp set", cons: "31CrMoV9 +QT bar (EN 10085), 3.1 certificate, saw coolant" }),
  face: (G) => ({ mc: `CNC lathe, swing ≥ Ø400, between centres ≥ 750 mm, spindle bore ≥ Ø${Math.ceil(G.M.dR / 10) * 10 + 10} optional, ≥ 22 kW`, tool: "Facing insert CNMG 12 04 08 (P25), centre drill DIN 333 form B Ø6.3", fix: "3-jaw chuck Ø250, self-centring steady rest Ø30–150", gauge: "Caliper 0–600, blue paint for the centre contact", cons: "Emulsion 6–8 %" }),
  rough: (G) => ({ mc: `CNC lathe as Op 20, tailstock with live centre (load ≥ 5 kN), contour cycle`, tool: "CNMG 16 06 12 roughing (P25, CVD coated), DNMG for the contour, grooving insert 3 mm", fix: "Chuck (tail end) + live centre (nose)", gauge: "Outside micrometers 50–150 (0.01), caliper", cons: "Emulsion, chip conveyor" }),
  gun: (G, P) => ({ mc: `Deep-hole (gun) drilling machine: drill Ø 10–30 mm, bore depth ≥ 600 mm, workpiece rotation (counter-rotation) ${f(G.nG / 2, 0)}–${f(G.nG, 0)} rpm, high-pressure pump ≥ 100 bar with flow ≥ 60 l/min (Ø22 needs ≈ ${P.pG} bar), oil filtration ≤ 10 µm, drill whip guides, feed-force monitoring + drill breakage stop`, tool: `Carbide-tipped single-lip gun drill Ø${G.M.dBore} (tip Ø tolerance per tool maker), total length ≥ ${Math.ceil((G.L + 150) / 50) * 50} mm, coolant hole, guide pads; spare drill + regrinding service`, fix: `Workhead chuck + steady rest, drill bushing Ø${G.M.dBore} (carbide) in the bushing holder pressed against the nose face`, gauge: `Bore gauge Ø${G.M.dBore} (0.002), ultrasonic wall-thickness gauge (drift at the exit), long dial bore gauge`, cons: "Deep-hole drilling oil (neat, EP), oil cooler, chip box, filter cartridges" }),
  relief: () => ({ mc: "Electric pit furnace (or bogie hearth with hanging rack), 650 °C max., temperature uniformity ±10 K, programmer + recorder, 3 thermocouples", tool: "–", fix: "Hanging rack (shafts vertical, hooked in the rear bore)", gauge: "Brinell tester HBW 10/3000 (ISO 6506) or portable UCI/Leeb, V-blocks + dial 0.01 for bend", cons: "Furnace chart record, tags" }),
  semi: (G) => ({ mc: `CNC lathe swing ≥ Ø400, turret with driven tools optional, steady rest Ø40–150, boring bar ≥ Ø32 (L/D ≤ 4 carbide shank, anti-vibration if longer)`, tool: "Finishing inserts VBMT 16 04 04 (P15), boring bar + CCMT 09 T3 04, 60° chamfer tool, threading insert 1.5 ISO (partial profile for roughing)", fix: "Soft jaws on the tail Ø, hydraulic steady rest on the front seat", gauge: `Micrometers, taper ring/plug gauge (soft check), thread gauge M${G.M.dF}×1.5 / M${G.M.dR}×1.5 rough, dial 0.002 for runout`, cons: "Emulsion" }),
  mill: () => ({ mc: "Turn-mill centre with C-axis (indexing 0.001°) + Y-axis, or HMC with rotary table and tailstock; position accuracy ≤ 0.01 mm", tool: "End mill Ø10 carbide (key seats), drills Ø5 + taps M6, chamfer tool, deburring tool for cross holes", fix: "Chuck + tailstock / V-block fixture with clamp", gauge: "Thread plug gauge M6 6H, gauge pins, CMM for key-seat symmetry", cons: "Emulsion, compressed air for blowing out the bore" }),
  pre: (G) => ({ mc: `CNC cylindrical grinder (universal), between centres ≥ 650 mm, swing ≥ Ø300, wheel Ø500 × ${G.P.bW}, angle-head optional, in-process gauge`, tool: "Al₂O₃ vitrified wheel (soft QT steel) or CBN, diamond dresser", fix: "Centre plugs in the 60° bore chamfers, drive dog on the tail", gauge: "Micrometers 0.001, snap gauge, dial 0.001", cons: "Grinding oil / emulsion with fine filter, anti-nitriding masking paste" }),
  nit: (G, P) => ({ mc: `Gas nitriding furnace (pit / bell type) with NH₃ + N₂ (+ dissociated NH₃) supply, Kn (nitriding potential) control with H₂ sensor, temperature uniformity ±5 K at ${P.Tn} °C, usable height ≥ ${Math.ceil((G.L + 200) / 100) * 100} mm (hanging), recorder; or a qualified heat-treat supplier with the same control`, tool: "Test coupons (same heat, same QT) for every charge", fix: "Hanging fixture (shafts vertical)", gauge: "Micro-hardness tester HV0.5/HV1 (ISO 6507) for the hardness traverse → Nht (ISO 18203 – check), metallography: white-layer thickness, V-blocks + dial for distortion", cons: "NH₃, N₂, anti-nitriding paste, coupon + report per charge" }),
  grind: (G, P) => ({ mc: `CNC cylindrical grinder: between centres ≥ 650 mm, roundness capability ≤ 0.5 µm (test piece), hydrostatic or high-precision workhead, wheelhead resolution 0.1 µm, angle-head or B-axis for the nose face, wheel balancing on the machine, in-process gauge (2-point, 0.1 µm), coolant chiller ±0.5 K, enclosure in a 20 ±1 °C room`, tool: `Vitrified CBN wheel Ø400–500 × ${P.bW} (vs ${P.vs} m/s max. per marking), rotary diamond dresser`, fix: "Hardened + lapped centre plugs in the bore chamfers (runout ≤ 0.5 µm), driver on the tail", gauge: "In-process gauge, roundness tester (≤ 0.05 µm resolution), indicating micrometer 0.5 µm, master rings, nital etch kit (ISO 14104)", cons: "Grinding oil (neat) with 5 µm filtration, dressing logs" }),
  taper: (G, P) => ({ mc: `Universal internal / external grinder: swivel table (taper 1:10 = 2.862°), internal high-frequency spindle 30–60 krpm (here ${f(G.nI / 1000, 0)} krpm with the Ø${P.dIw} wheel), workhead runout ≤ 0.5 µm, face grinding in the same set-up`, tool: `Internal CBN or Al₂O₃ wheel Ø${P.dIw} on a stiff quill (short + thick), external face wheel`, fix: "Steady rests / collet on the GROUND bearing seats (axis A-B), not on the centres", gauge: "HSK taper plug gauge (blue), test mandrel 300 mm, dial 0.5 µm, gauge-dimension fixture (taper to face)", cons: "Marking blue (very thin), grinding oil" }),
  thread: (G) => ({ mc: "Precision CNC lathe (hard turning capable): spindle runout ≤ 1 µm, thermal stable, Z resolution 0.1 µm; alternative: thread grinding machine if the threads are nitrided", tool: "CBN or fine-grain carbide full-profile threading insert 1.5 ISO", fix: "Precision collet on the ground rear seat + steady rest on the front seat (runout ≤ 1 µm)", gauge: `Thread ring gauges M${G.M.dF}×1.5 6g + M${G.M.dR}×1.5 6g GO/NO-GO, gauge nut with ground face, dial 0.5 µm`, cons: "Cutting oil" }),
  bal: (G, P) => ({ mc: `Horizontal hard-bearing balancing machine for rotors 5–50 kg, Ø ≤ 300 mm, belt or end drive, 2-plane measurement, minimum achievable residual unbalance e_mar ≤ 0.2 g·mm/kg (check ISO 21940-21), speed ${P.nBal} rpm, angle display 1°, proving rotor for the check`, tool: "Balancing screws M6 (set of masses), drill + tap M6 (if a new hole is needed)", fix: "Roller supports at the bearing seats (rollers soft-faced, clean)", gauge: "Calibrated balancing electronics, test masses for the calibration run", cons: "Thread locker for the balancing screws" }),
  insp: () => ({ mc: "Roundness / form tester (spindle accuracy ≤ 0.02 µm + 0.0003 µm/mm, resolution ≤ 0.05 µm), CMM (MPE ≈ 1.5 + L/350 µm – check), UCI hardness tester, roughness tester, laser marker", tool: "Test mandrel HSK-A63 × 300 mm (runout ≤ 1 µm), taper gauge, gauge blocks", fix: "V-blocks, centres for the CMM", gauge: "Calibration certificates of all gauges (traceable)", cons: "Preservation oil, VCI film, V-box / hanging rack" }),
};

/* ------------------------------------------------------------------ geometry + process numbers */
function geomS(P) {
  const M = {}; Object.keys(SP_DEF).forEach((k) => { M[k] = P[k]; });
  const g = spGeom(M), C = spCalc(M), G = { ...g, M, C, P };
  G.Lsaw = Math.ceil(g.L + 10); G.rB = P.Db / 2;
  G.segAt = (x) => g.segs.find((q) => x >= q.x0 && x <= q.x1) || g.segs[g.segs.length - 1];
  G.B = [...new Set([...g.segs.flatMap((s) => [s.x0, s.x1]), ...g.inner.flatMap((s) => [s.x0, s.x1])])];
  G.grList = g.segs.filter((s) => s.gr);
  const vol = (ro, ri) => { let v = 0; for (let x = 0.5; x < g.L; x += 1) v += Math.PI * (ro(x) ** 2 - (ri ? ri(x) ** 2 : 0)); return v; };
  G.mBar = Math.PI / 4 * P.Db ** 2 * G.Lsaw * RHO;
  G.mFin = vol(g.rOut, g.rIn) * RHO;
  const vRough = vol((x) => Math.min(G.rB, g.rOut(x) + P.aR / 2));
  G.Vr = (Math.PI / 4 * P.Db ** 2 * g.L - vRough) / 1000;                       // cm³ chips in roughing
  G.Q = P.vcT * P.fT * P.apT; G.tRough = G.Vr / G.Q * 1.3 + 6;
  const bore = g.inner.find((s) => s.k === "bore"), bEnd = g.inner.find((s) => s.k === "rear") || bore; G.Lbore = bEnd.x0 - bore.x0;   // gun-drilled length (through the spring-bore zone too)
  G.mBore = Math.PI / 4 * M.dBore ** 2 * G.Lbore * RHO;                          // kg of the removed bore core
  G.nG = 1000 * P.vcG / (Math.PI * M.dBore); G.vfG = P.fG * G.nG; G.tGun = g.L / G.vfG + 5; G.LD = g.L / M.dBore;
  G.tN = (P.Nht / P.kN) ** 2; G.tNtot = G.tN + 12;
  const plunge = (s, d, L) => { const nw = 1000 * P.vw / (Math.PI * d), sr = s / 2, tR = Math.max(0, sr - 0.005) / (P.frR * nw), tF = Math.min(sr, 0.005) / (P.frF * nw); return { nw, n: Math.ceil(L / P.bW), t: Math.ceil(L / P.bW) * (tR + tF + 0.1) + 0.3, tR, tF }; };
  G.gr = G.grList.map((s) => ({ s, ...plunge(P.aP, s.d, s.L) })); G.tGr = G.gr.reduce((a, b) => a + b.t, 0) + 14;
  G.pre = G.grList.map((s) => ({ s, ...plunge(P.aS - P.aP, s.d, s.L) })); G.tPre = G.pre.reduce((a, b) => a + b.t, 0) + 10;
  G.nwF = 1000 * P.vw / (Math.PI * M.dF); G.q = P.vs * 60 / P.vw;
  G.nI = P.vsI * 60000 / (Math.PI * P.dIw); G.half = Math.atan(0.05);
  G.mS = G.mFin; G.Uper = 9549 * M.Gbal * G.mS / M.nmax; G.UperPl = G.Uper / 2; G.Ucap = P.mCorMax * P.rCor;
  G.dTh = ALPHA * P.dTg * M.dF * 1000;                                             // µm Ø error from coolant drift
  return G;
}

/* ------------------------------------------------------------------ shaft profile at an operation + progress (shared by 2D + 3D) */
function profAt(G, P, k, u) {
  const i = OPS.findIndex((o) => o.k === k), ro0 = G.rOut, gr = (x) => G.segAt(x).gr, B = [...G.B];
  const rough = (x) => Math.min(G.rB, ro0(x) + P.aR / 2), semi = (x) => ro0(x) + (gr(x) ? P.aS / 2 : 0), pre = (x) => ro0(x) + (gr(x) ? P.aP / 2 : 0);
  const inSemi = (x) => { const s = G.inner.find((q) => x >= q.x0 && x <= q.x1); return s && s.k === "taper" ? G.rIn(x) - P.aS / 2 : G.rIn(x); };
  const inPre = (x) => { const s = G.inner.find((q) => x >= q.x0 && x <= q.x1); return s && s.k === "taper" ? G.rIn(x) - P.aP / 2 : G.rIn(x); };
  const bore = (x) => (x >= 0 ? G.M.dBore / 2 : 0);
  const o = { L: G.L, B, ro: ro0, ri: G.rIn, nitr: i > 8 || (i === 8 && u > 0.5), grDone: [], thr: i >= 11 && (i > 11 || u > 0.6) ? 2 : i >= 5 && (i > 5 || u > 0.8) ? 1 : 0, holes: i > 6 ? 1 : i === 6 ? u : 0, xt: null, mask: i === 7 && u > 0.85 || i === 8 };
  if (i === 0) { o.L = G.Lsaw; o.ro = () => G.rB; o.ri = null; o.B = []; }
  else if (i === 1) { o.L = lerp(G.Lsaw, G.L, clamp(u / 0.6, 0, 1)); o.ro = () => G.rB; o.ri = null; o.B = []; }
  else if (i === 2) {
    const rmin = Math.min(...G.segs.map((s) => rough(s.x0 + 1))), Np = Math.max(1, Math.ceil((G.rB - rmin) / P.apT)), pu = clamp(u, 0, 0.9999) * Np, kk = Math.floor(pu) + 1, xt = G.L * (pu - Math.floor(pu));
    const lev = (j) => Math.max(rmin, G.rB - j * P.apT);
    o.ro = u >= 1 ? rough : (x) => Math.max(rough(x), x <= xt ? lev(kk) : lev(kk - 1)); o.ri = null; o.xt = xt; o.pass = kk; o.Np = Np; B.push(xt);
  } else if (i === 3) { const d = clamp((u - 0.08) / 0.84, 0, 1) * G.L; o.ro = rough; o.ri = (x) => (x <= d ? bore(x) : 0); o.xt = d; B.push(d); }
  else if (i === 4) { o.ro = rough; o.ri = bore; }
  else if (i === 5) {
    if (u < 0.5) { const xt = clamp(u / 0.5, 0, 1) * G.L; o.ro = (x) => (x <= xt ? semi(x) : rough(x)); o.ri = bore; o.xt = xt; B.push(xt); }
    else if (u < 0.8) { const xb = clamp((u - 0.5) / 0.3, 0, 1) * 75; o.ro = semi; o.ri = (x) => (x <= xb || x >= G.L - 40 && u > 0.7 ? inSemi(x) : bore(x)); o.xt = xb; B.push(xb); }
    else { o.ro = semi; o.ri = inSemi; }
  } else if (i === 6) { o.ro = semi; o.ri = inSemi; }
  else if (i === 7 || i === 9) {
    const list = G.grList, n = list.length, done = Math.floor(clamp(u / 0.85, 0, 0.9999) * n), base = i === 7 ? semi : pre, fin = i === 7 ? pre : ro0;
    const doneKeys = new Set(list.slice(0, u >= 0.85 ? n : done).map((s) => s.k));
    o.ro = (x) => (doneKeys.has(G.segAt(x).k) ? fin(x) : base(x)); o.ri = i === 7 ? (u > 0.85 ? inPre : inSemi) : inPre; o.cur = u < 0.85 ? list[done] : null;
    o.grDone = i === 9 ? [...doneKeys] : []; o.preDone = i === 7 ? [...doneKeys] : G.grList.map((s) => s.k);
  } else if (i === 8) { o.ro = pre; o.ri = inPre; o.preDone = G.grList.map((s) => s.k); }
  else if (i === 10) { const xb = clamp((u - 0.1) / 0.6, 0, 1) * 32; o.ri = (x) => (x <= 32 && x > xb ? inPre(x) : G.rIn(x)); o.grDone = G.grList.map((s) => s.k); o.xt = xb; B.push(xb); }
  else { o.grDone = G.grList.map((s) => s.k); }
  return o;
}

/* ------------------------------------------------------------------ simulation: part record of one shaft */
function simulate(G, P, F, seed) {
  const r = rngOf(seed + 311), N = (m, s) => m + s * gauss(r), A = Math.abs, O = {}, res = (l, v, st) => [l, v, st], M = G.M;
  const hb = N(305, 9);
  O.saw = { setup: 10, t: Math.PI * P.Db ** 2 / 400 / 30 + 3, rate: P.rSaw, heat: "H" + (61000 + seed % 900), par: [["Material", "31CrMoV9 +QT (1.8519), EN 10085, 3.1 certificate"], ["Bar", `Ø${P.Db} × ${G.Lsaw} mm, ${f(G.mBar, 1)} kg`], ["Saw", "bimetal band, ≈ 30 cm²/min"]],
    res: [res("Hardness on the certificate", `${f(hb, 0)} HBW (example window 280–340, check order)`, hb >= 280 && hb <= 340 ? "ok" : "bad"), res("Heat number stamped", "H" + (61000 + seed % 900), "ok")] };
  const lenE = N(0, 0.04);
  O.face = { setup: 15, t: 9, rate: P.rLathe, par: [["Length", `${G.L} ±0.1 mm`], ["Centre holes", "DIN 332 form B, both ends (temporary)"]],
    res: [res("Length", `${f(G.L + lenE, 2)} mm`, A(lenE) <= 0.1 ? "ok" : "bad"), res("Centre contact (blue)", `${f(clamp(N(85, 5), 60, 98), 0)} %`, "ok")] };
  const dRo = N(0, 0.03);
  O.rough = { setup: 20, t: G.tRough, rate: P.rLathe, par: [["Cutting data", `vc ${P.vcT} m/min · f ${P.fT} mm/rev · ap ${P.apT} mm`], ["Removal rate", `Q = vc·f·ap = ${f(G.Q, 0)} cm³/min`], ["Chips", `${f(G.Vr, 0)} cm³ = ${f(G.Vr * 7.85 / 1000, 1)} kg`], ["Allowance", `+${P.aR} mm on Ø`]],
    res: [res("Diameters vs allowance", `${dRo >= 0 ? "+" : ""}${f(dRo, 2)} mm (±0.1)`, A(dRo) <= 0.1 ? "ok" : "bad")] };
  const drift = A(N(0.05, 0.02)) + (F.drift ? 0.45 : 0), bDev = N(0.014, 0.006), wall = drift;
  O.gun = { setup: 30, t: G.tGun, rate: P.rGun, drift, par: [["Drill", `single-lip carbide gun drill Ø${M.dBore}, through ${G.L} mm (L/D ${f(G.LD, 0)})`], ["Speeds", `n = ${f(G.nG, 0)} rpm (counter-rotation) · f ${P.fG} mm/rev → vf ${f(G.vfG, 1)} mm/min`], ["Coolant", `${P.pG} bar oil through the drill`], ["Time", `L/vf + 5 = ${f(G.tGun, 1)} min`]],
    res: [res("Bore Ø", `+${f(bDev * 1000, 0)} µm (IT9: 0…+52)`, bDev >= 0 && bDev <= 0.052 ? "ok" : "bad"), res("Drift at the exit (wall thickness)", `${f(wall, 2)} mm (≤ ${P.dLim})`, wall <= P.dLim ? "ok" : "bad"), res("Chips", F.drift ? "long, blue chips at the end – guide pads worn" : "short, curled (good)", F.drift ? "warn" : "ok")] };
  const hbR = N(300, 8), bend = A(N(0.04, 0.015));
  O.relief = { setup: 0, t: 10 * 60 / P.charge + 8, rate: P.rHT, par: [["Cycle", "580 °C × 2 h, furnace cool to 300 °C"], ["Position", "hanging vertical"], ["Charge", `${P.charge} shafts`]],
    res: [res("Hardness after", `${f(hbR, 0)} HBW`, hbR >= 270 ? "ok" : "bad"), res("Bend (runout on V-blocks)", `${f(bend, 3)} mm (≤ 0.15)`, bend <= 0.15 ? "ok" : "bad")] };
  const run6 = A(N(0.008, 0.003));
  O.semi = { setup: 40, t: 55, rate: P.rLathe, par: [["Stock", `ground Ø +${P.aS} mm, taper +${P.aS} mm on Ø`], ["Centres", "60° chamfers in both bore ends"], ["Threads", `M${M.dF}×1.5, M${M.dR}×1.5 roughed (0.1 mm on the flanks)`]],
    res: [res("Runout to the centre chamfers", `${f(run6 * 1000, 0)} µm (≤ 20)`, run6 <= 0.02 ? "ok" : "bad"), res("Taper stock (soft gauge)", `${P.aS} mm on Ø, even`, "ok")] };
  const pos = A(N(0.008, 0.004));
  O.mill = { setup: 30, t: 35, rate: P.rMill, par: [["Features", "2 key seats, 6 × M6 nose, 2 × 8 × M6 balancing, 2 wrench flats"], ["C-axis", "indexing 0.001°"]],
    res: [res("Hole / key-seat position", `${f(pos * 1000, 0)} µm (≤ 20)`, pos <= 0.02 ? "ok" : "bad"), res("Cross holes deburred, bore blown out", "yes", "ok")] };
  const stk = N(P.aP, 0.005), runP = A(N(3, 1));
  O.pre = { setup: 30, t: G.tPre, rate: P.rGr, par: [["Stock removed", `${f(P.aS - P.aP, 2)} mm on Ø`], ["Stock left", `${P.aP} mm on Ø (removed after nitriding)`], ["Masking", "threads + balancing planes: anti-nitriding paste"]],
    res: [res("Stock left on the seats", `${f(stk, 3)} mm (${P.aP} ±0.015)`, A(stk - P.aP) <= 0.015 ? "ok" : "bad"), res("Runout before nitriding", `${f(runP, 1)} µm (≤ 6)`, runP <= 6 ? "ok" : "bad")] };
  const NhtA = (F.nit ? 0.5 : 1) * P.kN * Math.sqrt(G.tN) * (1 + N(0, 0.04)), HVs = (F.nit ? 640 : 820 + (520 - P.Tn) * 3) + N(0, 15), core = hbR * 1.05, wl = A(N(7, 1.5)), dist = A(N(6, 2)), grow = N(6, 1);
  const z0 = NhtA / Math.sqrt(Math.log(Math.max(1.1, (HVs - core) / 50)));
  const trHV = Array.from({ length: 41 }, (_, j) => { const z = j * 0.025; return [z, core + (HVs - core) * Math.exp(-((z / z0) ** 2)) + N(0, 6)]; });
  const NhtG = NhtA - P.aP / 2;
  O.nit = { setup: 0, t: G.tNtot * 60 / P.charge, rate: P.rHT, NhtA, HVs, core, trHV, wl, dist, grow, NhtG,
    par: [["Cycle", `${P.Tn} °C, Kn controlled, ${f(G.tN, 0)} h hold (+ ≈ 12 h heat / cool)`], ["Model", `Nht ≈ k·√t = ${P.kN}·√${f(G.tN, 0)} = ${f(P.kN * Math.sqrt(G.tN), 2)} mm`], ["Charge", `${P.charge} shafts + coupon`]],
    res: [res("Surface hardness (coupon)", `${f(HVs, 0)} HV1 (≥ 750)`, HVs >= 750 ? "ok" : "bad"), res("Nht (coupon traverse, core + 50 HV)", `${f(NhtA, 2)} mm (need ≥ ${f(P.NhtMin + P.aP / 2, 2)} = min + grinding stock)`, NhtA >= P.NhtMin + P.aP / 2 ? "ok" : "bad"),
      res("White (compound) layer", `${f(wl, 1)} µm – ground off on the seats`, wl <= 12 ? "ok" : "warn"), res("Distortion (runout)", `${f(dist, 1)} µm (≤ 15)`, dist <= 15 ? "ok" : "bad"), res("Growth on Ø", `+${f(grow, 1)} µm`, "info")] };
  const dF = N(0, 0.95) + N(0, 0.3) * G.dTh, dR = N(0, 0.95) + N(0, 0.3) * G.dTh, dRot = N(38.5, 1.6), rnd = A(N(0.45, 0.12)) + (F.chatter ? 2.2 : 0), co = A(N(0.6, 0.2)), face = A(N(0.8, 0.3)), ra = N(0.12, 0.02) + (F.chatter ? 0.09 : 0);
  const ph = r() * 6.283, trR = Array.from({ length: 181 }, (_, j) => { const a = j * 2 * Math.PI / 180; return [a, (rnd - (F.chatter ? 2.2 : 0)) / 2 * Math.sin(3 * a + ph) + (F.chatter ? 1.1 * Math.sin(17 * a) : 0) + N(0, 0.05)]; });
  O.grind = { setup: 40, t: G.tGr, rate: P.rGr, dF, dR, rnd, co, face, ra, trR,
    par: [["Wheel", `CBN, vs ${P.vs} m/s, ${P.bW} mm wide`], ["Work speed", `${P.vw} m/min → n_w = ${f(G.nwF, 0)} rpm on Ø${M.dF} (q = ${f(G.q, 0)})`], ["Plunge", `rough ${P.frR} / finish ${P.frF} mm per rev + spark-out`], ["Stock", `${P.aP} mm on Ø`]],
    res: [res(`Front seat Ø${M.dF} js4`, `${dF >= 0 ? "+" : ""}${f(dF, 1)} µm (±${P.tSeat})`, A(dF) <= P.tSeat ? "ok" : "bad"), res(`Rear seat Ø${M.dR} js4`, `${dR >= 0 ? "+" : ""}${f(dR, 1)} µm (±${P.tSeat})`, A(dR) <= P.tSeat ? "ok" : "bad"),
      res(`Rotor seat Ø${M.dRot} p5`, `+${f(dRot, 1)} µm (+32…+45)`, dRot >= 32 && dRot <= 45 ? "ok" : "bad"), res("Roundness of the seats", `${f(rnd, 2)} µm (≤ ${P.tRnd})${F.chatter ? " – 17 lobes = chatter" : ""}`, rnd <= P.tRnd ? "ok" : "bad"),
      res("Seat runout to A-B", `${f(co, 2)} µm (≤ ${P.tCo})`, co <= P.tCo ? "ok" : "bad"), res("Nose face runout", `${f(face, 2)} µm (≤ 2)`, face <= 2 ? "ok" : "bad"), res("Ra seats", `${f(ra, 2)} µm (≤ ${P.tRa})`, ra <= P.tRa ? "ok" : "bad"),
      res("Nital etch (ISO 14104)", F.burn ? "dark zones on the front seat = GRINDING BURN → REJECT" : "no indications", F.burn ? "bad" : "ok"), res("Nht left after grinding", `${f(NhtG, 2)} mm (≥ ${P.NhtMin})`, NhtG >= P.NhtMin ? "ok" : "bad")] };
  const con = clamp(N(90, 2.2) - (F.taper ? 26 : 0), 30, 98), angE = N(0, 0.5) + (F.taper ? 5.6 : 0), runN = A(N(0.8, 0.3)) + (F.taper ? 1.4 : 0), run300 = runN * 1.5 + A(N(1.2, 0.5)) + (F.taper ? 2.5 : 0), gD = N(0, 1.5);
  O.taper = { setup: 45, t: 28, rate: P.rIG, con, angE, runN, run300, gD,
    par: [["Set-up", "on the ground bearing seats (A-B)"], ["Table swivel", "half-angle atan(1/20) = 2.862°"], ["Wheel", `Ø${P.dIw}, ${P.vsI} m/s → ${f(G.nI, 0)} rpm`]],
    res: [res("Taper contact (blue)", `${f(con, 0)} % (≥ ${P.tCon})`, con >= P.tCon ? "ok" : "bad"), res("Angle error over the taper length", `${f(angE, 1)} µm (±2, check AT class)`, A(angE) <= 2 ? "ok" : "bad"),
      res("Taper runout at the nose", `${f(runN, 2)} µm (≤ ${P.tTap})`, runN <= P.tTap ? "ok" : "bad"), res("Test mandrel at 300 mm", `${f(run300, 1)} µm (≤ ${P.tT300})`, run300 <= P.tT300 ? "ok" : "bad"), res("Gauge dimension (taper → face)", `${f(gD, 1)} µm (±5, check HSK standard)`, A(gD) <= 5 ? "ok" : "bad")] };
  const nut = A(N(1.1, 0.45)) + (F.thread ? 9 : 0);
  O.thread = { setup: 30, t: 22, rate: P.rLathe, nut, par: [["Threads", `M${M.dF}×1.5 6g, M${M.dR}×1.5 6g`], ["Clamping", "collet on the ground rear seat + steady on the front seat"]],
    res: [res("Thread gauges GO / NO-GO", "GO passes, NO-GO stops", "ok"), res("Gauge-nut face runout (thread ⟂)", `${f(nut, 1)} µm (≤ ${P.tNut})`, nut <= P.tNut ? "ok" : "bad")] };
  const e = drift / 2, U0 = [0, 1].map(() => ({ m: A(N(16, 7)) + G.mBore * 1000 * e / 2, a: r() * 360 }));
  const Ures = U0.map((u0) => (F.unbal ? 2 * u0.m * Math.sin(15 * Math.PI / 180) * (0.9 + 0.2 * r()) : A(N(0.25, 0.1)) * G.UperPl));
  const capOK = U0.every((u0) => u0.m <= G.Ucap);
  O.bal = { setup: 15, t: 20, rate: P.rBal, U0, Ures, capOK, par: [["Speed", `${P.nBal} rpm (rigid rotor)`], ["Limit", `U_per = 9549·G·m/n = 9549·${M.Gbal}·${f(G.mS, 1)}/${M.nmax} = ${f(G.Uper, 1)} g·mm → ${f(G.UperPl, 1)} per plane`], ["Correction", `M6 screws at r = ${P.rCor} mm, ≤ ${P.mCorMax} g per plane (${f(G.Ucap, 0)} g·mm)`]],
    res: [res("Initial unbalance plane 1 / 2", `${f(U0[0].m, 0)} / ${f(U0[1].m, 0)} g·mm (correctable ≤ ${f(G.Ucap, 0)})`, capOK ? "ok" : "bad"), res("Residual plane 1 / 2", capOK ? `${f(Ures[0], 1)} / ${f(Ures[1], 1)} g·mm (≤ ${f(G.UperPl, 1)})` : "not reachable – correction capacity exceeded (check the bore drift)", capOK && Math.max(...Ures) <= G.UperPl ? "ok" : "bad")] };
  const hvU = HVs - 25 + N(0, 12);
  O.insp = { setup: 10, t: 45, rate: P.rMeas, par: [["Room", "20 ±0.5 °C, part soaked ≥ 4 h"], ["Serial", `SPS-${YYWW}-${String(seed - 3000).padStart(5, "0")}`], ["Preservation", "oil + VCI, stored hanging"]],
    res: [res("Roundness tester: seats / coaxiality", `${f(rnd + 0.05, 2)} / ${f(co + 0.1, 2)} µm`, rnd + 0.05 <= P.tRnd && co + 0.1 <= P.tCo ? "ok" : "bad"), res("Taper runout nose / 300 mm", `${f(runN, 2)} / ${f(run300, 1)} µm`, runN <= P.tTap && run300 <= P.tT300 ? "ok" : "bad"),
      res("UCI hardness on the nitrided body", `${f(hvU, 0)} HV (≥ 700 on the part)`, hvU >= 700 ? "ok" : "bad"), res("Marking + report", `SPS-${YYWW}-${String(seed - 3000).padStart(5, "0")}`, "ok")] };
  let tSum = 0, cSum = G.mBar * P.prSt; const fails = [], warns = [];
  OPS.forEach((o) => { const x = O[o.k]; x.cost = ((x.setup || 0) / P.lot + x.t) / 60 * x.rate; tSum += x.t; cSum += x.cost;
    x.res.forEach((rw) => { if (rw[2] === "bad") fails.push({ no: o.no, l: rw[0], v: rw[1] }); else if (rw[2] === "warn") warns.push({ no: o.no, l: rw[0], v: rw[1] }); }); });
  return { seed, sn: seed - 3000, O, fails, warns, tSum, cSum, mat: G.mBar * P.prSt, drift };
}

/* ------------------------------------------------------------------ drawing helpers (shaft side view: upper half = section, lower half = outside view) */
const KX = 1.12, X0 = 70, CY = 128;
const DEFS = `<defs><pattern id="smH" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,.30)"/></pattern></defs>`;
function sample(fn, B, L) {
  const xs = [...new Set([0, L, ...B.filter((x) => x > 0 && x < L)])].sort((a, b) => a - b), o = [];
  for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; if (b - a < 1e-3) continue; const e = Math.min(0.05, (b - a) / 3); o.push([a, fn(a + e)], [b, fn(b - e)]); }
  return o;
}
function shaft(G, st, o = {}) {
  const k = o.k || KX, x0 = o.X0 ?? X0, cy = o.cy ?? CY, X = (x) => (x0 + x * k).toFixed(1), L = st.L, ri = st.ri || (() => 0);
  const po = sample(st.ro, st.B, L), pi = sample(ri, st.B, L), col = o.col || STEEL, Yu = (r) => (cy - r * k).toFixed(1), Yl = (r) => (cy + r * k).toFixed(1);
  let s = DEFS;
  s += `<path d="M${X(0)},${cy} ${po.map(([x, r]) => `L${X(x)},${Yl(r)}`).join("")} L${X(L)},${cy} Z" fill="${col}" stroke="#555"/>`;
  (st.preDone || []).forEach((kk) => { if ((st.grDone || []).includes(kk)) return; const sg = G.segs.find((q) => q.k === kk); s += `<rect x="${X(sg.x0)}" y="${cy}" width="${(sg.L * k).toFixed(1)}" height="${(st.ro(sg.x0 + sg.L / 2) * k).toFixed(1)}" fill="#c3ccd4" stroke="#7a858f" stroke-width=".6"/>`; });
  (st.grDone || []).forEach((kk) => { const sg = G.segs.find((q) => q.k === kk); s += `<rect x="${X(sg.x0)}" y="${cy}" width="${(sg.L * k).toFixed(1)}" height="${(st.ro(sg.x0 + sg.L / 2) * k).toFixed(1)}" fill="${GRD}" stroke="#7a858f" stroke-width=".6"/>`; });
  if (st.thr) G.segs.filter((q) => q.thread).forEach((sg) => { for (let x = sg.x0 + 1.5; x < sg.x1 - 0.5; x += 3) s += `<line x1="${X(x)}" y1="${cy + 3}" x2="${X(x + 1.5)}" y2="${Yl(sg.d / 2)}" stroke="${st.thr === 2 ? "#333" : "#666"}" stroke-width="${st.thr === 2 ? 1.1 : 0.7}"/>`; });
  if (st.mask) G.segs.filter((q) => q.thread || q.k === "b1" || q.k === "b2").forEach((sg) => { s += `<rect x="${X(sg.x0)}" y="${cy}" width="${(sg.L * k).toFixed(1)}" height="${(sg.d / 2 * k).toFixed(1)}" fill="#b5651d" opacity=".55"/>`; });
  if (st.holes > 0) G.segs.filter((q) => q.k === "b1" || q.k === "b2").forEach((sg, j) => { const n = Math.floor(clamp((st.holes - 0.3 - j * 0.22) / 0.2, 0, 1) * 4); for (let i = 0; i < n; i++) s += `<circle cx="${X(sg.x0 + sg.L / 2)}" cy="${(cy + (sg.d / 2) * k * (0.2 + i * 0.22)).toFixed(1)}" r="2.6" fill="#333"/>`; });
  const up = `M${X(0)},${Yu(ri(0.01))} ${po.map(([x, r]) => `L${X(x)},${Yu(r)}`).join("")} ${pi.slice().reverse().map(([x, r]) => `L${X(x)},${Yu(r)}`).join("")} Z`;
  s += `<path d="${up}" fill="${col}" stroke="#555"/><path d="${up}" fill="url(#smH)"/>`;
  if (st.ri) s += `<path d="${pi.map(([x, r], i) => `${i ? "L" : "M"}${X(x)},${Yl(r)}`).join("")}" fill="none" stroke="#555" stroke-dasharray="4 3" stroke-width=".9"/>`;
  if (st.nitr) s += `<path d="${po.map(([x, r], i) => `${i ? "L" : "M"}${X(x)},${Yu(r)}`).join("")}" fill="none" stroke="${NIT}" stroke-width="2.6"/><path d="${po.map(([x, r], i) => `${i ? "L" : "M"}${X(x)},${Yl(r)}`).join("")}" fill="none" stroke="${NIT}" stroke-width="2.6" opacity=".7"/>`;
  s += `<line x1="${x0 - 14}" y1="${cy}" x2="${x0 + L * k + 14}" y2="${cy}" stroke="var(--muted)" stroke-dasharray="10 3 2 3"/>`;
  return s;
}
const chuckR = (x, cy, rr, lab = "chuck") => `<rect x="${x - 26}" y="${cy - rr - 16}" width="34" height="14" fill="#666"/><rect x="${x - 26}" y="${cy + rr + 2}" width="34" height="14" fill="#666"/><rect x="${x + 8}" y="${cy - rr - 34}" width="${Math.max(30, SW - 12 - x - 8)}" height="${2 * rr + 68}" rx="5" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(x + 14, cy + 4, lab)}`;
const centreL = (x, cy, lab = "tailstock") => `<rect x="12" y="${cy - 20}" width="${Math.max(10, x - 36)}" height="40" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/><path d="M${x - 24},${cy - 11} L${x + 4},${cy} L${x - 24},${cy + 11} Z" fill="#8a8a8a" stroke="#444"/>${txt(14, cy + 34, lab)}`;
const centreR = (x, cy) => `<path d="M${x + 24},${cy - 11} L${x - 4},${cy} L${x + 24},${cy + 11} Z" fill="#8a8a8a" stroke="#444"/><rect x="${x + 24}" y="${cy - 20}" width="${Math.max(10, SW - 12 - x - 24)}" height="40" rx="4" fill="var(--surface-2)" stroke="var(--axis)"/>`;
const steady = (x, cy, rr) => `<circle cx="${x}" cy="${cy - rr - 6}" r="6" fill="#888" stroke="#333"/><circle cx="${x}" cy="${cy + rr + 6}" r="6" fill="#888" stroke="#333"/><path d="M${x - 16},${cy - rr - 26} L${x},${cy - rr - 12} L${x + 16},${cy - rr - 26}" fill="none" stroke="#555" stroke-width="3"/><path d="M${x - 16},${cy + rr + 26} L${x},${cy + rr + 12} L${x + 16},${cy + rr + 26}" fill="none" stroke="#555" stroke-width="3"/>`;
const toolDown = (tx, ty) => `<path d="M${tx},${ty} L${tx + 8},${ty - 14} L${tx + 22},${ty - 14} L${tx + 14},${ty} Z" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx + 9}" y="${ty - 56}" width="16" height="42" fill="#777"/>`;
const XS = (x) => X0 + x * KX, YS = (r) => CY - r * KX;
function polar(cx, cy, R, tr, sc, col = CL) {   // roundness plot: tr = [[angle, dev µm]]
  let s = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--grid)"/><circle cx="${cx}" cy="${cy}" r="${R + sc}" fill="none" stroke="var(--grid)" stroke-dasharray="2 3"/><circle cx="${cx}" cy="${cy}" r="${R - sc}" fill="none" stroke="var(--grid)" stroke-dasharray="2 3"/>`;
  s += `<path d="${tr.map(([a, d], i) => `${i ? "L" : "M"}${(cx + (R + d * sc) * Math.cos(a)).toFixed(1)},${(cy + (R + d * sc) * Math.sin(a)).toFixed(1)}`).join("")}Z" fill="none" stroke="${col}" stroke-width="1.6"/>`;
  return s;
}
function vec(cx, cy, R, m, a, max, col, lab) { const l = clamp(m / max, 0, 1.15) * R, x = cx + l * Math.cos(a * Math.PI / 180), y = cy - l * Math.sin(a * Math.PI / 180); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${col}" stroke-width="2.5"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${col}"/>${lab ? txt(x + 5, y - 4, lab, `fill:${col};font-size:10px`) : ""}`; }
const linesAt = (x, y, arr, dy = 17) => arr.map((t, i) => txt(x, y + i * dy, t)).join("");

/* ------------------------------------------------------------------ scenes (u = 0..1) */
function sSaw(G, R, u, P) {
  const k = KX, cy = CY, rr = G.rB * k, xc = X0 + G.Lsaw * k, p = clamp((u - 0.12) / 0.68, 0, 1), yb = cy - rr - 16 + p * (2 * rr + 22), sep = u > 0.84 ? ease((u - 0.84) / 0.16) * 30 : 0;
  let s = svgOpen("Op 10 · Saw the bar to length (side view)", "band saw");
  if (p < 1) s += `<rect x="${X0}" y="${cy - rr}" width="${SW - 12 - X0}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/><rect x="${xc}" y="${cy - rr}" width="4" height="${clamp(yb - (cy - rr), 0, 2 * rr)}" fill="var(--surface)"/>`;
  else s += `<rect x="${X0 - sep}" y="${cy - rr}" width="${xc - X0}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/><rect x="${xc + 4}" y="${cy - rr}" width="${SW - 16 - xc}" height="${2 * rr}" fill="${STEEL}" stroke="#555"/>`;
  s += `<rect x="${xc - 1}" y="28" width="6" height="${Math.max(0, yb - 28)}" fill="#c8ccd0" stroke="#666"/><rect x="${xc - 50}" y="26" width="100" height="16" rx="3" fill="var(--surface-2)" stroke="var(--axis)"/>`;
  s += `<rect x="${xc + 12}" y="${cy - rr - 14}" width="60" height="12" fill="#666"/><rect x="${xc + 12}" y="${cy + rr + 2}" width="60" height="12" fill="#666"/>${txt(xc + 76, cy - rr - 4, "vise")}`;
  if (p > 0 && p < 1) s += sparks(xc + 2, Math.min(yb, cy + rr), u * 30, 6, "#9aa3ab", 1);
  if (u > 0.9) s += `<text x="${X0 - sep + 14}" y="${cy + 4}" class="apc-t" style="font-family:monospace;font-size:13px;fill:#333">${R.O.saw.heat}</text>`;
  s += big(20, 252, `bar Ø${P.Db} × ${G.Lsaw} mm · 31CrMoV9 +QT · ${f(G.mBar, 1)} kg`) + linesAt(20, 276, [`finished shaft ${f(G.mFin, 1)} kg → ${f((1 - G.mFin / G.mBar) * 100, 0)} % of the bar becomes chips (normal for a hollow, stepped shaft)`,
    `why +QT bar: nitriding needs a quenched + tempered core (strength under the thin hard layer, tempered ≥ 30–50 K above ${P.Tn} °C)`, `cut area ${f(Math.PI * P.Db ** 2 / 400, 0)} cm² at ≈ 30 cm²/min → ${f(R.O.saw.t, 1)} min · heat number = link to the 3.1 certificate`, "order the bar ultrasonically tested (no pipe / inclusions in the core – the bore goes right through it)"]);
  return s + `</svg>`;
}
function sFace(G, R, u, P) {
  const st = profAt(G, P, "face", u), k = KX, rr = G.rB * k, v = clamp((u - 0.62) / 0.3, 0, 1);
  let s = svgOpen("Op 20 · Face to length + centre drill both ends", "CNC lathe") + shaft(G, st);
  const xe = X0 + st.L * k; s += chuckR(xe - 50, CY, rr);
  if (u < 0.6) { const ty = CY - rr - 12 + (u % 0.3) / 0.3 * (rr + 12); s += `<path d="M${X0},${ty} l-18,-10 l0,-30 l-14,0 l0,40 Z" fill="${CARB}" stroke="#7a5a10"/>` + sparks(X0, ty, u * 40, 5, "#9aa3ab", 1); }
  else if (u < 0.95) { const dx = X0 - 60 + v * 66; s += `<rect x="${dx - 70}" y="${CY - 5}" width="70" height="10" fill="#9aa" stroke="#444"/><path d="M${dx},${CY} l-10,-6 l0,12 Z" fill="#444"/>`; }
  if (u > 0.85) s += `<path d="M${X0},${CY - 5} L${X0 + 9},${CY - 1} L${X0 + 14},${CY - 1} L${X0 + 14},${CY + 1} L${X0 + 9},${CY + 1} L${X0},${CY + 5} Z" fill="var(--surface)" stroke="#555"/>`;
  s += big(20, 252, u < 0.6 ? `facing: length ${f(st.L, 1)} → ${G.L} mm` : u < 0.95 ? "centre drilling DIN 332 form B" : "done – both ends faced + centred") + linesAt(20, 276, ["steady rest supports the free end (a 50 kg bar must not whip)", "the centre holes are TEMPORARY: the gun drill removes them in Op 40;", "later 60° protected chamfers in the bore ends (Op 60) become the grinding references", `measured length ${R.O.face.res[0][1]}`]);
  return s + `</svg>`;
}
function sRough(G, R, u, P) {
  const st = profAt(G, P, "rough", u), k = KX;
  let s = svgOpen("Op 30 · Rough turning – every Ø keeps an allowance", "CNC lathe") + shaft(G, st) + centreL(X0, CY, "live centre") + chuckR(X0 + G.L * k - 40, CY, G.rB * k);
  if (u < 1) { const tx = XS(st.xt), ty = YS(st.ro(st.xt + 0.01)); s += toolDown(tx, ty) + sparks(tx, ty, u * 50, 6, "#8a6d3b", 1); }
  const n = 1000 * P.vcT / (Math.PI * 2 * st.ro(st.xt || 1));
  s += big(20, 252, u < 1 ? `pass ${st.pass} / ${st.Np}` : "roughing done") + linesAt(20, 276, [`ap ${P.apT} mm · f ${P.fT} mm/rev · vc ${P.vcT} m/min → n ≈ ${f(Math.min(n, 2500), 0)} rpm (constant cutting speed)`, `Q = vc·f·ap = ${f(G.Q, 0)} cm³/min · chips ${f(G.Vr, 0)} cm³ · time ≈ ${f(G.tRough, 0)} min`,
    `allowance +${P.aR} mm on Ø: the gun-drilled bore may drift + the shaft may move after stress relief –`, "the outside is finished LATER around the real bore (wall thickness stays even)"]);
  return s + `</svg>`;
}
function sGun(G, R, u, P) {
  const k = 0.6, x0 = 430, cy = 106, st = profAt(G, P, "gun", u), X = (x) => x0 + x * k, D = R.O.gun, dl = (G.L + 60) * k, depth = st.xt;
  let s = svgOpen("Op 40 · Deep-hole (gun) drilling of the drawbar bore", "gun-drilling machine") + shaft(G, st, { k, X0: x0, cy });
  s += `<rect x="${X(G.L) + 4}" y="${cy - G.rB * k - 22}" width="${SW - 14 - X(G.L) - 4}" height="${2 * G.rB * k + 44}" rx="5" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(SW - 12, cy - G.rB * k - 28, "workhead (chuck) ↻", "text-anchor:end")}`;
  s += `<rect x="${x0 - 22}" y="${cy - 26}" width="20" height="52" fill="#556" stroke="#333"/>${txt(x0 - 96, cy - 32, "drill bushing")}`;
  const tip = X(depth), carr = tip - dl;
  s += `<rect x="${carr}" y="${cy - 2.5}" width="${dl}" height="5" fill="#9aa4ae" stroke="#555" stroke-width=".6"/><rect x="${carr - 46}" y="${cy - 22}" width="46" height="44" rx="4" fill="#667" stroke="#333"/>${txt(carr - 46, cy + 36, "drill carriage ↺")}`;
  [0.33, 0.66].forEach((q) => { const wx = lerp(carr, x0 - 22, q); if (wx > carr + 10) s += `<rect x="${wx - 6}" y="${cy - 16}" width="12" height="32" rx="3" fill="#889" stroke="#333"/>`; });
  if (u > 0.08 && u < 0.92) s += sparks(tip, cy, u * 60, 4, "#c9a227", -1);
  s += txt(carr - 46, cy - 50, `oil ${P.pG} bar →`, "fill:var(--accent);font-weight:600");
  // inset: gun drill cross section
  const ix = 20, iy = 196, cx = ix + 70, ccy = iy + 92;
  s += `<rect x="${ix}" y="${iy}" width="340" height="176" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(ix + 8, iy + 16, "Gun drill – section at the tip", "font-weight:600")}`;
  s += `<path d="M${cx},${ccy} L${cx + 46},${ccy} A46,46 0 1 1 ${cx + 46 * Math.cos(-1.9)},${ccy + 46 * Math.sin(-1.9)} Z" fill="#9aa4ae" stroke="#333"/><circle cx="${cx - 14}" cy="${ccy + 12}" r="8" fill="var(--accent)" opacity=".7"/>`;
  s += `<rect x="${cx - 52}" y="${ccy - 6}" width="8" height="12" fill="${CARB}"/><rect x="${cx + 10}" y="${ccy + 40}" width="12" height="8" fill="${CARB}"/>`;
  s += linesAt(ix + 136, iy + 40, ["V-flute: chips + oil flow back out", "blue = oil hole (high pressure)", "orange = guide pads: they rub on", "the bore wall and keep the drill", "straight (burnishing)", "single cutting lip, off-centre point"], 16);
  // drift chart
  const tr = Array.from({ length: 13 }, (_, j) => { const x = j / 12 * G.L; return [x, D.drift * (x / G.L) ** 2 * 1000]; }).filter((p) => p[0] <= depth + 1);
  s += chart({ x: 372, y: 196, w: 378, h: 120, t: "Bore centre offset vs depth (µm)", note: depth >= G.L - 1 ? `exit ${f(D.drift * 1000, 0)} µm` : "", xr: [0, G.L], yr: [0, Math.max(200, P.dLim * 1300, D.drift * 1100)], xl: "depth mm", hl: [{ y: P.dLim * 1000, t: "limit", col: "var(--critical)" }], series: [{ pts: tr.length > 1 ? tr : [[0, 0], [1, 0]], col: CR }] });
  s += linesAt(372, 334, [`n ${f(G.nG, 0)} rpm · f ${P.fG} mm/rev → vf ${f(G.vfG, 1)} mm/min · ${f(G.tGun, 0)} min · L/D ${f(G.LD, 0)}`, `drilled ${f(depth, 0)} / ${G.L} mm · removed core ${f(G.mBore, 2)} kg`]);
  return s + `</svg>`;
}
function sRelief(G, R, u, P) {
  let s = svgOpen("Op 50 · Stress-relief annealing (shafts hanging) + check", "pit furnace");
  const cyc = [[0, 20], [4, 580], [6, 580], [10, 300], [12, 40]], tu = clamp(u / 0.7, 0, 1) * 12;
  let T = 20; for (let i = 1; i < cyc.length; i++) if (tu <= cyc[i][0]) { const a = cyc[i - 1], b = cyc[i]; T = lerp(a[1], b[1], (tu - a[0]) / (b[0] - a[0])); break; } else T = cyc[i][1];
  if (u < 0.7) {
    const glow = clamp((T - 350) / 230, 0, 1), col = glow > 0.05 ? `rgb(${Math.round(lerp(170, 240, glow))},${Math.round(lerp(180, 110, glow))},${Math.round(lerp(190, 40, glow))})` : STEEL;
    s += `<rect x="40" y="40" width="250" height="320" rx="8" fill="#555" stroke="#333"/><rect x="56" y="56" width="218" height="290" fill="#2b2b2b"/>`;
    for (let i = 0; i < 4; i++) { const x = 80 + i * 52; s += `<line x1="${x + 12}" y1="56" x2="${x + 12}" y2="74" stroke="#aaa" stroke-width="2"/><rect x="${x}" y="74" width="24" height="${G.L * 0.52}" rx="3" fill="${col}" stroke="#222"/>`; }
    s += txt(300, 60, "shafts hang vertically – lying in the furnace they would sag");
    s += chart({ x: 300, y: 76, w: 450, h: 190, t: "Furnace temperature (°C)", note: `${f(T, 0)} °C`, xr: [0, 12], xt: [0, 2, 4, 6, 8, 10, 12], yr: [0, 650], xl: "h", series: [{ pts: cyc, col: "var(--muted)", w: 1, dash: "4 3" }, { pts: [...cyc.filter((p) => p[0] <= tu), [tu, T]], col: HOT }] });
    s += linesAt(300, 290, ["580 °C × 2 h releases the stresses from rolling, roughing and gun drilling", `rule: ≥ 30 K above nitriding (${P.Tn} °C) so the shaft does not move in Op 90,`, "and below the tempering temperature of the bar (else the core gets softer)", `furnace cost per shaft = 10 h × $${P.rHT}/h / ${P.charge} shafts = $${f(10 * P.rHT / P.charge, 0)}`]);
  } else {
    const st = profAt(G, P, "relief", u), bend = R.O.relief.res[1][1];
    s += shaft(G, st) + `<path d="M${XS(G.segs[1].x0 + 20) - 18},${CY + G.rOut(40) * KX + 30} l18,-22 l18,22 Z" fill="#667"/><path d="M${XS(G.segs[6].x0 + 10) - 18},${CY + G.rOut(400) * KX + 30} l18,-22 l18,22 Z" fill="#667"/>`;
    const gx = XS(G.segs[4].x0 + 80), gy = YS(G.rOut(300) + P.aR / 2) - 10, a = Math.sin(u * 40) * 0.7;
    s += `<line x1="${gx}" y1="${gy}" x2="${gx}" y2="${gy - 30}" stroke="#333" stroke-width="2"/><circle cx="${gx}" cy="${gy - 48}" r="18" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="${gx}" y1="${gy - 48}" x2="${gx + 15 * Math.sin(a)}" y2="${gy - 48 - 15 * Math.cos(a)}" stroke="var(--critical)" stroke-width="2"/>`;
    s += big(20, 252, "Checks after the furnace") + linesAt(20, 276, [`hardness: ${R.O.relief.res[0][1]} (core for nitriding)`, `bend: turn the shaft on V-blocks, dial on the rotor seat → ${bend}`, "do NOT straighten a nitriding shaft by bending – the stresses come back in the furnace;", "if the bend is larger than the allowance → scrap (or re-rough + stress relieve again)"]);
  }
  return s + `</svg>`;
}
function sSemi(G, R, u, P) {
  const st = profAt(G, P, "semi", u), k = KX, rrF = G.rOut(50) + P.aS / 2;
  let s = svgOpen("Op 60 · Semi-finish turning: outside, HSK taper bore, centre chamfers, threads", "CNC lathe + steady rest") + shaft(G, st) + chuckR(X0 + G.L * k - 36, CY, (G.rOut(470) + P.aS) * k, "soft jaws") + steady(XS(G.segs[1].x0 + 40), CY, rrF * k);
  if (u < 0.5) { const tx = XS(st.xt), ty = YS(st.ro(st.xt + 0.01)); s += toolDown(tx, ty) + sparks(tx, ty, u * 50, 5, "#8a6d3b", 1); }
  else if (u < 0.8) { const bx = XS(st.xt); s += `<rect x="${X0 - 90}" y="${CY - 9}" width="${bx - X0 + 90}" height="10" fill="#777" stroke="#333"/><path d="M${bx},${CY - 9} l6,-8 l6,8 Z" fill="${CARB}"/>${txt(X0 - 60, CY - 16, "boring bar")}` + sparks(bx + 6, CY - 15, u * 50, 4, "#8a6d3b", -1); }
  else { const th = u < 0.9 ? G.segs[2] : G.segs[7], tx = XS(th.x0 + (u * 10 % 1) * th.L); s += `<path d="M${tx},${YS(th.d / 2)} l-6,-12 l12,0 Z" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx - 7}" y="${YS(th.d / 2) - 52}" width="14" height="40" fill="#777"/>`; }
  s += big(20, 252, u < 0.5 ? "outside: ground Ø + " + P.aS + " mm, others finished" : u < 0.8 ? "inside: HSK taper (+ stock) + clamping-set cavity" : "threads roughed (soft) + 60° centre chamfers") + linesAt(20, 276, [
    `steady rest on the front seat: the nose end is free for the boring bar (taper 1:10, Ø${G.inner[0].d0} → ${G.inner[0].d1})`, "60° protected centre chamfers in both bore ends = the references for all grinding operations", `runout to the chamfers: ${R.O.semi.res[0][1]}`, "allowance is now small: the bore is the reference, the outside follows it"]);
  return s + `</svg>`;
}
function sMill(G, R, u, P) {
  const st = profAt(G, P, "mill", u), k = KX, ph = u < 0.3 ? 0 : u < 0.75 ? 1 : 2;
  let s = svgOpen("Op 70 · Milling + drilling with the C-axis", "turn-mill centre") + shaft(G, st) + chuckR(X0 + G.L * k - 36, CY, (G.rOut(470) + P.aS) * k);
  const b1 = G.segs[3], b2 = G.segs[5], mx = ph === 0 ? X0 + 8 : ph === 1 ? XS((u < 0.52 ? b1 : b2).x0 + 20) : XS(G.L - 40), my = ph === 0 ? CY - 40 : YS(G.segAt(ph === 1 ? (u < 0.52 ? b1 : b2).x0 + 20 : G.L - 40).d / 2 + P.aS / 2);
  s += `<rect x="${mx - 14}" y="${my - 90}" width="28" height="60" fill="#556" stroke="#333"/><rect x="${mx - 4}" y="${my - 30 - Math.abs(Math.sin(u * 30)) * 6}" width="8" height="30" fill="${CARB}" stroke="#7a5a10"/>`;
  if (u > 0.1) s += `<rect x="${X0 - 2}" y="${CY - 40}" width="5" height="14" fill="#333"/>`;
  if (u > 0.85) s += `<rect x="${XS(G.L - 40)}" y="${YS(G.rOut(470) + P.aS / 2) - 1}" width="${30 * k}" height="4" fill="var(--surface)"/>`;
  const ex = 640, ey = 300, rr = 58, nH = ph < 1 ? 0 : ph === 1 ? Math.floor((u - 0.3) / 0.45 * 16) : 16;
  s += `<circle cx="${ex}" cy="${ey}" r="${rr}" fill="${STEEL}" stroke="#555"/><circle cx="${ex}" cy="${ey}" r="${G.M.dBore / 2 / 41 * rr}" fill="var(--surface)" stroke="#555"/>`;
  for (let i = 0; i < Math.min(8, nH % 8 === 0 && nH > 0 ? 8 : nH % 8); i++) { const a = i * Math.PI / 4 + u * 0.5; s += `<circle cx="${ex + rr * 0.86 * Math.cos(a)}" cy="${ey + rr * 0.86 * Math.sin(a)}" r="4" fill="#333"/>`; }
  s += txt(ex - 60, ey - rr - 8, "end view, C-axis");
  s += big(20, 252, ph === 0 ? "nose: 2 drive-key seats + 6 × M6" : ph === 1 ? `balancing holes 2 × 8 × M6 (plane ${u < 0.52 ? 1 : 2})` : "wrench flats on the tail") + linesAt(20, 276, ["C-axis indexes the shaft (0.001°), the driven tool mills / drills / taps",
    "balancing holes are made NOW (soft) – after nitriding the surface is ≈ 800 HV and hard to drill", "deburr every cross hole, blow the bore clean: a chip in the bore later scratches the drawbar", `position check ${R.O.mill.res[0][1]}`]);
  return s + `</svg>`;
}
function grindScene(G, R, u, P, fin) {
  const st = profAt(G, P, fin ? "grind" : "pre", u), k = KX, cur = st.cur;
  let s = svgOpen(fin ? "Op 100 · OD grinding after nitriding – seats js4, rotor seat, nose face in ONE set-up" : "Op 80 · Pre-grinding before nitriding (leaves a small stock)", "CNC cylindrical grinder") + shaft(G, st) + centreL(X0, CY, "centre plug") + centreR(XS(G.L), CY);
  if (cur) { const x = XS(cur.x0 + cur.L / 2) + Math.sin(u * 40) * Math.max(0, cur.L * k / 2 - P.bW * k / 2), ty = YS(st.ro(cur.x0 + cur.L / 2));
    const wh = Math.min(110, ty - 30);
    if (cur.k === "nose") s += `<rect x="${X0 - 16 - P.bW * 0.4}" y="${ty - wh - 2}" width="${P.bW * 0.6}" height="${wh}" rx="4" fill="${ABR}" stroke="#7a6a48" transform="rotate(-25 ${X0} ${ty})"/>`;
    else s += `<rect x="${x - P.bW * k / 2}" y="${ty - wh - 2}" width="${P.bW * k}" height="${wh}" rx="4" fill="${ABR}" stroke="#7a6a48"/>`;
    s += sparks(cur.k === "nose" ? X0 + 4 : x, ty, u * 70, 7, "#ffb347", 1);
    s += `<path d="M${XS(cur.x0 + cur.L / 2) + 26},${CY + G.rOut(cur.x0 + 1) * k + 4} l0,16 M${XS(cur.x0 + cur.L / 2) - 26},${CY + G.rOut(cur.x0 + 1) * k + 4} l0,16" stroke="var(--accent)" stroke-width="3"/>`; }
  const D = R.O.grind, Gi = cur ? (fin ? G.gr : G.pre).find((q) => q.s.k === cur.k) : null;
  s += big(20, 252, cur ? `${cur.n}` : fin ? "all surfaces ground – measure" : "pre-ground – mask threads + balancing planes");
  if (fin) {
    if (u > 0.88) s += linesAt(20, 276, [`front seat ${D.res[0][1]} · rear seat ${D.res[1][1]}`, `rotor seat ${D.res[2][1]}`, `seat runout A-B ${f(D.co, 2)} µm · nose face ${f(D.face, 2)} µm · Ra ${f(D.ra, 2)} µm`, `Nht left after grinding ${f(R.O.nit.NhtG, 2)} mm (≥ ${P.NhtMin})`]);
    else s += linesAt(20, 276, [`stock ${P.aP} mm on Ø: rough ${P.frR}, finish ${P.frF} mm/rev, spark-out · n_w ${Gi ? f(Gi.nw, 0) : f(G.nwF, 0)} rpm · ${Gi ? Gi.n + " plunge(s)" : ""}`, `blue = in-process gauge (2-point) stops the infeed at size · coolant ±${P.dTg} K = ${f(G.dTh, 1)} µm on Ø${G.M.dF}`,
      "the white layer (5–10 µm) is ground off the seats; Nht left " + f(R.O.nit.NhtG, 2) + " mm", `time ≈ ${f(G.tGr, 0)} min incl. dressing + measuring`]);
    if (u > 0.88) { s += `<rect x="530" y="232" width="220" height="140" rx="6" fill="var(--surface)" stroke="var(--border)"/>` + txt(538, 248, `Roundness front seat ${f(D.rnd, 2)} µm`, `font-weight:600;${D.rnd > P.tRnd ? "fill:var(--critical)" : ""}`) + polar(640, 310, 42, D.trR, 12, D.rnd > P.tRnd ? "var(--critical)" : CL);
      if (R.F.burn) s += txt(20, 360, "nital etch: dark burn zones on the front seat → REJECT", "fill:var(--critical);font-weight:600"); }
  } else s += linesAt(20, 276, [`grind ${f(P.aS - P.aP, 2)} mm on Ø, leave ${P.aP} mm: after nitriding only ${P.aP / 2} mm per side is ground away,`, `so most of the nitrided layer stays (Nht ${P.Nht} − ${P.aP / 2} = ${f(P.Nht - P.aP / 2, 2)} mm)`, "nitriding moves the part only a few µm – that is why the shape is made BEFORE the furnace", `brown = anti-nitriding paste on threads + balancing planes (they stay soft) · time ≈ ${f(G.tPre, 0)} min`]);
  return s + `</svg>`;
}
const sPre = (G, R, u, P) => grindScene(G, R, u, P, false), sGrind = (G, R, u, P) => grindScene(G, R, u, P, true);
function sNit(G, R, u, P) {
  const D = R.O.nit; let s = svgOpen(`Op 90 · Gas nitriding ${P.Tn} °C, Kn controlled – Nht ${P.Nht} mm`, "nitriding furnace");
  const tTot = G.tN + 12, tu = clamp(u / 0.6, 0, 1) * tTot, T = tu < 5 ? 20 + tu / 5 * (P.Tn - 20) : tu < 5 + G.tN ? P.Tn : Math.max(40, P.Tn - (tu - 5 - G.tN) / 7 * (P.Tn - 40));
  const glow = clamp((T - 300) / (P.Tn - 300), 0, 1), col = glow > 0.05 ? `rgb(${Math.round(lerp(170, 220, glow))},${Math.round(lerp(180, 120, glow))},${Math.round(lerp(190, 70, glow))})` : STEEL;
  s += `<rect x="40" y="56" width="220" height="300" rx="10" fill="#606a74" stroke="#333"/><rect x="54" y="70" width="192" height="272" rx="6" fill="#2b2f34"/><path d="M40,56 Q150,20 260,56" fill="#4d5660" stroke="#333"/>`;
  for (let i = 0; i < 3; i++) { const x = 78 + i * 56; s += `<line x1="${x + 12}" y1="70" x2="${x + 12}" y2="86" stroke="#aaa" stroke-width="2"/><rect x="${x}" y="86" width="24" height="${G.L * 0.5}" rx="3" fill="${col}" stroke="${u > 0.3 ? NIT : "#222"}" stroke-width="${u > 0.3 ? 2.5 : 1}"/>`; }
  s += `<rect x="216" y="300" width="16" height="12" fill="#ccc"/>${txt(176, 330, "coupon", "fill:#ddd")}<path d="M0,120 L40,120" stroke="var(--accent)" stroke-width="3"/>${txt(4, 112, "NH₃ + N₂")}`;
  if (u < 0.6) {
    s += chart({ x: 290, y: 30, w: 460, h: 170, t: "Furnace temperature (°C)", note: `${f(T, 0)} °C · Kn ${f(T > 480 ? 2.5 - 1.5 * clamp((tu - 5) / G.tN, 0, 1) : 0, 1)}`, xr: [0, tTot], yr: [0, 600], xl: "h", series: [{ pts: [[0, 20], [5, P.Tn], [5 + G.tN, P.Tn], [tTot, 40]], col: "var(--muted)", dash: "4 3", w: 1 }, { pts: [[0, 20], ...[5, 5 + G.tN, tTot].filter((x) => x < tu).map((x) => [x, x === tTot ? 40 : P.Tn]), [tu, T]], col: HOT }] });
    s += linesAt(290, 224, [`t = (Nht / k)² = (${P.Nht} / ${P.kN})² = ${f(G.tN, 0)} h hold (+ ≈ 12 h heat-up + cool-down)`, "Kn (nitriding potential) high at the start = fast build-up, then lower:", "keeps the white (compound) layer thin (it is brittle, ground off the seats)", "no quench → very little distortion; the core stays as tempered", `furnace cost per shaft ≈ ${f(tTot, 0)} h × $${P.rHT}/h / ${P.charge} = $${f(tTot * P.rHT / P.charge, 0)}`]);
  } else {
    const n = Math.max(2, Math.round(clamp((u - 0.6) / 0.3, 0, 1) * 41));
    s += chart({ x: 290, y: 30, w: 460, h: 200, t: "Coupon: hardness traverse (HV0.5)", note: u > 0.9 ? `Nht ${f(D.NhtA, 2)} mm` : "", xr: [0, 1], yr: [200, 1000], xl: "depth mm", hl: [{ y: D.core + 50, t: "core + 50 HV → Nht", col: "var(--text-2)" }], series: [{ pts: D.trHV.slice(0, n), col: CL, dots: false }, ...(u > 0.9 ? [{ pts: [[D.NhtA, 200], [D.NhtA, 1000]], col: "var(--critical)", dash: "3 3", w: 1 }, { pts: [[P.aP / 2, 200], [P.aP / 2, 1000]], col: CR, dash: "3 3", w: 1 }] : [])] });
    s += `<rect x="290" y="244" width="200" height="16" fill="#f4f4f0" stroke="#888"/><rect x="290" y="260" width="200" height="40" fill="${NIT}" opacity=".55"/><rect x="290" y="300" width="200" height="40" fill="${STEEL}"/>`;
    s += txt(496, 256, `white layer ${f(D.wl, 1)} µm (ground off)`) + txt(496, 284, `diffusion zone → Nht ${f(D.NhtA, 2)} mm`) + txt(496, 324, "core (QT ≈ 300 HB)");
    s += txt(290, 358, `surface ${f(D.HVs, 0)} HV (≥ 750) · after grinding Nht ${f(D.NhtG, 2)} mm (≥ ${P.NhtMin})`, D.NhtG < P.NhtMin || D.HVs < 750 ? "fill:var(--critical);font-weight:600" : "font-weight:600") + txt(290, 374, `orange dashed line = grinding stock ${P.aP / 2} mm per side`);
  }
  return s + `</svg>`;
}
function sTaper(G, R, u, P) {
  const st = profAt(G, P, "taper", u), k = KX, D = R.O.taper;
  let s = svgOpen("Op 110 · Internal grinding of the HSK taper (held on the ground bearing seats)", "universal internal grinder") + shaft(G, st) + chuckR(XS(G.L) - 34, CY, G.rOut(470) * k, "workhead (collet)") + steady(XS(G.segs[1].x0 + 40), CY, G.rOut(40) * k);
  if (u < 0.72) { const osc = Math.sin(u * 50) * 0.5 + 0.5, wx = XS(4 + osc * 18), wr = P.dIw / 2 * k * 0.55;
    s += `<g transform="rotate(${-G.half * 180 / Math.PI * 4} ${wx} ${CY})"><rect x="${wx - 150}" y="${CY - 5}" width="150" height="10" fill="#777" stroke="#333"/><rect x="${wx}" y="${CY - wr}" width="${14 * k}" height="${2 * wr}" rx="2" fill="${ABR}" stroke="#7a6a48"/></g><rect x="${wx - 210}" y="${CY - 22}" width="62" height="44" rx="4" fill="#556" stroke="#333"/>`;
    s += txt(wx - 210, CY - 28, `HF spindle ${f(G.nI / 1000, 0)} krpm`) + sparks(wx + 8, CY - wr, u * 60, 4, "#ffb347", -1);
    s += big(20, 252, "grinding the taper 1:10 (half-angle 2.862°)") + linesAt(20, 276, [`wheel Ø${P.dIw} at ${P.vsI} m/s → n = vs·60000/(π·d) = ${f(G.nI, 0)} rpm (high-frequency spindle 30–60 krpm)`, "the shaft is held on its GROUND bearing seats → the taper becomes coaxial to the real bearing axis A-B", "quill short + thick (stiff) · oscillate along the taper · face ground in the same set-up", "angle drawn exaggerated ×4"]);
  } else {
    const v = clamp((u - 0.72) / 0.25, 0, 1), x = 400, y = 236, w = 340, h = 100;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#e9e3d6" stroke="#666"/>`;
    const rr = rngOf(R.seed + 5); for (let i = 0; i < 260 * v; i++) { const px = rr(), py = rr(), on = R.F.taper ? px < D.con / 100 * 1.05 : rr() < D.con / 100 + 0.08; if (on) s += `<rect x="${(x + 4 + px * (w - 8)).toFixed(1)}" y="${(y + 4 + py * (h - 8)).toFixed(1)}" width="7" height="5" fill="${BLUE}" opacity=".7"/>`; }
    s += txt(x, y - 6, "blue print on the taper gauge (unrolled, nose ← → inside)", "font-weight:600");
    s += big(20, 252, `taper contact ${f(D.con * v, 0)} % (≥ ${P.tCon})`, v >= 1 ? (D.con >= P.tCon ? "var(--good-text)" : "var(--critical)") : "var(--text)") + linesAt(20, 276, [`runout at the nose ${f(D.runN, 2)} µm (≤ ${P.tTap})`, `test mandrel at 300 mm ${f(D.run300, 1)} µm (≤ ${P.tT300})`, `angle error ${f(D.angE, 1)} µm over the taper · gauge dimension ${f(D.gD, 1)} µm`, R.F.taper ? "contact only at one end → angle wrong → regrind" : "contact over the whole length = angle correct"]);
  }
  return s + `</svg>`;
}
function sThread(G, R, u, P) {
  const st = profAt(G, P, "thread", u), k = KX, D = R.O.thread;
  let s = svgOpen("Op 120 · Finish the lock-nut threads square to the axis", "precision CNC lathe") + shaft(G, st) + chuckR(XS(G.L) - 34, CY, G.rOut(470) * k, "collet (ground seat)") + steady(XS(G.segs[1].x0 + 40), CY, G.rOut(40) * k);
  if (u < 0.6) { const th = u < 0.3 ? G.segs[2] : G.segs[7], tx = XS(th.x0 + (u * 10 % 1) * th.L), ty = YS(th.d / 2); s += `<path d="M${tx},${ty} l-6,-12 l12,0 Z" fill="${CARB}" stroke="#7a5a10"/><rect x="${tx - 7}" y="${ty - 52}" width="14" height="40" fill="#777"/>` + sparks(tx, ty, u * 40, 4, "#8a6d3b", 1); }
  else { const th = G.segs[2], nx = XS(th.x0 + 2), a = Math.sin(u * 30) * (D.nut > P.tNut ? 1.2 : 0.3);
    s += `<rect x="${nx}" y="${YS(th.d / 2 + 14)}" width="${14 * k}" height="${(th.d + 28) * k}" fill="#8a96a3" stroke="#333"/><line x1="${nx - 2}" y1="${YS(th.d / 2 + 10)}" x2="${nx - 26}" y2="${YS(th.d / 2 + 10) - 26}" stroke="#333" stroke-width="2"/><circle cx="${nx - 40}" cy="${YS(th.d / 2 + 10) - 40}" r="17" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="${nx - 40}" y1="${YS(th.d / 2 + 10) - 40}" x2="${nx - 40 + 14 * Math.sin(a)}" y2="${YS(th.d / 2 + 10) - 40 - 14 * Math.cos(a)}" stroke="var(--critical)" stroke-width="2"/>`; }
  s += big(20, 252, u < 0.6 ? `finish turning M${(u < 0.3 ? G.M.dF : G.M.dR)}×1.5 6g (soft – masked in the furnace)` : `gauge-nut face runout ${f(D.nut, 1)} µm (≤ ${P.tNut})`, u >= 0.6 && D.nut > P.tNut ? "var(--critical)" : "var(--text)") + linesAt(20, 276, ["the lock nut presses on the bearing inner rings: if its face wobbles, it tilts the rings → runout + heat",
    "so: clamp on the GROUND seats (not on a turned Ø) and cut the thread in the same set-up as its reference", "check: screw on a gauge nut with a ground face, turn the shaft, dial on the nut face", "precision nuts with radial set screws can correct a few µm in assembly – not 10 µm"]);
  return s + `</svg>`;
}
function sBal(G, R, u, P) {
  const st = profAt(G, P, "bal", u), k = KX, D = R.O.bal, b1 = G.segs[3], b2 = G.segs[5];
  let s = svgOpen("Op 130 · Dynamic balancing in 2 planes", "horizontal balancing machine") + shaft(G, st);
  [G.segs[1].x0 + 45, G.segs[6].x0 + 20].forEach((x) => { const y = CY + G.rOut(x) * k; s += `<circle cx="${XS(x) - 10}" cy="${y + 9}" r="9" fill="#888" stroke="#333"/><circle cx="${XS(x) + 10}" cy="${y + 9}" r="9" fill="#888" stroke="#333"/><rect x="${XS(x) - 24}" y="${y + 18}" width="48" height="40" fill="var(--surface-2)" stroke="var(--axis)"/>`; });
  const bx = XS(G.segs[4].x0 + 80); s += `<path d="M${bx - 8},${YS(G.M.dRot / 2)} L${bx - 8},28 M${bx + 8},${YS(G.M.dRot / 2)} L${bx + 8},28" stroke="#333" stroke-width="2"/>${txt(bx + 14, 40, "belt drive")}`;
  [b1, b2].forEach((sg, j) => { const x = XS(sg.x0 + sg.L / 2); s += `<line x1="${x}" y1="${YS(sg.d / 2) - 6}" x2="${x}" y2="${CY + sg.d / 2 * k + 6}" stroke="var(--critical)" stroke-dasharray="3 2"/>${txt(x - 20, YS(sg.d / 2) - 10, `plane ${j + 1}`, "fill:var(--critical)")}`; });
  const mk = (u * 30) % 1; s += `<rect x="${XS(G.segs[4].x0 + 20)}" y="${CY - 2 + Math.sin(mk * 6.283) * G.M.dRot / 2 * k * 0.9}" width="10" height="4" fill="#d03b3b"/>`;
  const after = u > 0.6, max = Math.max(D.U0[0].m, D.U0[1].m, G.UperPl * 2) * 1.25;
  [0, 1].forEach((j) => { const cx = 470 + j * 150, cy = 300, Rr = 58; s += `<circle cx="${cx}" cy="${cy}" r="${Rr}" fill="var(--surface)" stroke="var(--border)"/><circle cx="${cx}" cy="${cy}" r="${G.UperPl / max * Rr}" fill="var(--good)" opacity=".25"/>${txt(cx - 26, cy - Rr - 6, `plane ${j + 1}`, "font-weight:600")}`;
    s += vec(cx, cy, Rr, D.U0[j].m * clamp(u / 0.3, 0, 1), D.U0[j].a, max, "var(--critical)", after ? "" : f(D.U0[j].m, 0));
    if (after) s += vec(cx, cy, Rr, D.Ures[j], D.U0[j].a + 70, max, "var(--good-text)", f(D.Ures[j], 1)); });
  s += txt(395, 374, `green circle = U_per per plane ${f(G.UperPl, 1)} g·mm`);
  s += big(20, 252, after ? (D.capOK && Math.max(...D.Ures) <= G.UperPl ? "residual within U_per – OK" : D.capOK ? "residual too high – correct again" : "unbalance larger than the correction capacity") : `measuring at ${P.nBal} rpm`, after ? (D.capOK && Math.max(...D.Ures) <= G.UperPl ? "var(--good-text)" : "var(--critical)") : "var(--text)");
  s += linesAt(20, 276, [`U_per = 9549·G·m/n = 9549·${G.M.Gbal}·${f(G.mS, 1)}/${G.M.nmax} = ${f(G.Uper, 1)} g·mm (G ${G.M.Gbal})`, `= centre of mass only ${f(G.Uper / G.mS, 2)} µm off the axis!`, `correction: M6 screws at r ${P.rCor} mm, ≤ ${P.mCorMax} g → ${f(G.Ucap, 0)} g·mm / plane`, "the full rotor is balanced again in the assembly"], 17);
  return s + `</svg>`;
}
function sInsp(G, R, u, P) {
  const st = profAt(G, P, "insp", u), k = KX, D = R.O.grind, T = R.O.taper;
  let s = svgOpen("Op 140 · Final inspection (20 °C), marking, preservation", "measuring room");
  if (u < 0.45) {
    s += `<rect x="60" y="330" width="260" height="30" rx="4" fill="#556"/><ellipse cx="190" cy="330" rx="90" ry="12" fill="#889" stroke="#333"/>`;
    const sh = 0.55;
    for (const sg of G.segs) s += `<rect x="${190 - sg.d / 2 * sh}" y="${326 - sg.x1 * sh}" width="${sg.d * sh}" height="${sg.L * sh}" fill="${sg.gr ? GRD : NIT}" stroke="#555" stroke-width=".7"/>`;
    const py = 326 - (G.segs[6].x0 + 20) * sh; s += `<rect x="${190 + G.M.dR / 2 * sh}" y="${py - 3}" width="90" height="6" fill="#333"/><rect x="290" y="40" width="14" height="290" fill="#778"/><circle cx="${190 + G.M.dR / 2 * sh + 2}" cy="${py}" r="3" fill="var(--critical)"/>`;
    s += txt(320, 60, "roundness / form tester: shaft stands on the rotary table,", "font-weight:600") + txt(320, 78, "the probe measures each seat over 360°");
    s += polar(470, 200, 60, D.trR, 16, D.rnd > P.tRnd ? "var(--critical)" : CL) + txt(560, 170, `roundness ${f(D.rnd + 0.05, 2)} µm`) + txt(560, 188, `coaxiality ${f(D.co + 0.1, 2)} µm`) + txt(560, 206, `nose face ${f(D.face, 2)} µm`) + txt(560, 224, `Ra ${f(D.ra, 2)} µm`);
    s += txt(320, 300, "filter 1–50 UPR (check), 0.05 µm resolution – the part soaks ≥ 4 h at 20 °C") + txt(320, 318, `1 K on Ø${G.M.dF} = ${f(ALPHA * G.M.dF * 1000, 2)} µm – as big as the tolerance band / 10`);
  } else if (u < 0.8) {
    const k2 = 0.8, x2 = 300; s += shaft(G, st, { k: k2, X0: x2 }) + `<rect x="${x2 - 300 * k2}" y="${CY - 16}" width="${300 * k2 + 4}" height="32" fill="${GRD}" stroke="#555"/>`;
    [G.segs[1].x0 + 45, G.segs[6].x0 + 20].forEach((x) => { s += `<path d="M${x2 + x * k2 - 16},${CY + G.rOut(x) * k2 + 22} l16,-20 l16,20 Z" fill="#667"/>`; });
    const gx1 = x2 - 8, gx2 = x2 - 300 * k2 + 10; [[gx1, T.runN], [gx2, T.run300]].forEach(([gx, v], i) => { const a = Math.sin(u * 40 + i) * Math.min(1.4, v / 3); s += `<line x1="${gx}" y1="${CY - 16}" x2="${gx}" y2="${CY - 46}" stroke="#333" stroke-width="2"/><circle cx="${gx}" cy="${CY - 62}" r="15" fill="var(--surface)" stroke="var(--text-2)" stroke-width="2"/><line x1="${gx}" y1="${CY - 62}" x2="${gx + 12 * Math.sin(a)}" y2="${CY - 62 - 12 * Math.cos(a)}" stroke="var(--critical)" stroke-width="2"/>`; });
    s += txt(92, 104, "test mandrel 300 mm in the taper") + big(20, 252, `taper runout nose ${f(T.runN, 2)} µm · at 300 mm ${f(T.run300, 1)} µm`) + linesAt(20, 276, ["shaft turns on V-blocks at the GROUND bearing seats (= axis A-B), mandrel in the taper", "near + far dial: the far reading shows the angle (tilt) of the taper axis", `UCI hardness on the nitrided body: ${R.O.insp.res[2][1]}`, "CMM: lengths, shoulders, key seats, thread positions → report"]);
  } else {
    s += shaft(G, st) + `<rect x="${XS(G.segs[3].x0 + 4)}" y="${CY + 8}" width="${32 * k}" height="12" fill="#222"/>` + txt(XS(G.segs[3].x0 + 6), CY + 18, "SPS…", "font-family:monospace;fill:#fff;font-size:9px");
    if (u > 0.9) s += `<rect x="${X0 - 8}" y="${CY - 80}" width="${G.L * k + 16}" height="160" rx="10" fill="#7fb37f" opacity=".25" stroke="#4a8a4a" stroke-dasharray="5 3"/>${txt(X0, CY - 86, "VCI film + oil")}`;
    s += big(20, 252, `laser mark SPS-${YYWW}-${String(R.sn).padStart(5, "0")} on the body (not on a seat!)`, R.fails.length ? "var(--critical)" : "var(--good-text)") + linesAt(20, 276, [R.fails.length ? `verdict: REJECT – ${R.fails.map((x) => "Op " + x.no + " " + x.l).slice(0, 2).join(" · ")}` : "verdict: RELEASED – all checks passed", "preserve: clean, oil, VCI bag, store hanging or in a V-box (never on a seat / taper)", "part record (JSON) + CMM / roundness reports go with the shaft to the spindle assembly"]);
  }
  return s + `</svg>`;
}
const SC = { saw: sSaw, face: sFace, rough: sRough, gun: sGun, relief: sRelief, semi: sSemi, mill: sMill, pre: sPre, nit: sNit, grind: sGrind, taper: sTaper, thread: sThread, bal: sBal, insp: sInsp };

/* ------------------------------------------------------------------ process plans of the other spindle parts (not animated) */
function plans(G, P) {
  const M = G.M, h = G.hsg, C = G.C;
  return {
    housing: { t: `Spindle housing (cartridge) – 42CrMo4 +QT (or EN-GJS-600-3), Ø${h.Dout} × ${h.L} mm`, rows: [
      ["10", "Saw / buy forging, 3.1 cert.", "band saw Ø ≥ 250", `blank Ø${h.Dout + 10} × ${h.L + 10}`],
      ["20", "Rough turn outside + bores (+2 mm)", "CNC lathe swing ≥ Ø400", "±0.2"],
      ["30", "Stress relief 580 °C 2 h", "furnace", "bend ≤ 0.1"],
      ["40", "Semi-finish turn, cooling grooves (helix / rings) on the outside, O-ring grooves", "CNC lathe", "groove depth ±0.05, O-ring groove per seal maker"],
      ["50", "Drill: coolant + oil-air + sensor holes, bolt circles, tap", "HMC with rotary table", "position ±0.02, deburr cross holes"],
      ["60", `Shrink the cooling sleeve (heat ≈ 150 °C), O-rings`, "induction heater / oven + press stand", `ΔT = (U + 0.001·d)/(α·d) on Ø${h.Dout}`],
      ["70", "Pressure test cooling circuit 1.5 × p (e.g. 9 bar, 10 min)", "water / air test stand + gauge", "no drop, no leak"],
      ["80", `Finish bores AFTER the shrink: front Ø${M.DF} + rear Ø${h.boreR} in ONE set-up (fine boring + honing, or internal grinding)`, "jig borer / horizontal fine-boring machine + honing, or universal internal grinder", `IT4 (Ø${M.DF}: IT4 = 10 µm), e.g. JS4/K5 per bearing maker – check · roundness ≤ 1.5 µm · coaxial ≤ 3 µm`],
      ["90", "Grind the front face + spigot to the bore axis", "universal grinder", "face ⟂ ≤ 2 µm, spigot runout ≤ 3 µm"],
      ["100", "Measure: bores, coaxiality, faces (20 °C)", "CMM / roundness tester with long column", "report, serial SPH-YYWW-nnnnn"]] },
    sleeve: { t: "Cooling sleeve – S355 / stainless, shrunk on the housing", rows: [
      ["10", "Turn from tube, inside to shrink Ø", "CNC lathe", `inside Ø${h.Dout} with interference (e.g. 0.08–0.12 mm, check Lamé)`],
      ["20", "Ports (inlet / outlet) + threads", "HMC", "G1/4 port per hose"],
      ["30", "Shrink on housing (housing Op 60) + pressure test (Op 70)", "oven ≈ 150 °C", "1.5 × p, 10 min"]] },
    spacers: { t: `Bearing spacers (inner + outer, front ${M.dF}/${M.DF}) – 100Cr6 hardened 60–64 HRC, stabilised`, rows: [
      ["10", "Turn from tube (+0.3 on faces, +0.2 on Ø)", "CNC lathe", "±0.05"],
      ["20", "Harden + deep-freeze / stabilise + temper", "vacuum furnace + −80 °C box (check heat treater)", "60–64 HRC, dimensional stable"],
      ["30", "Grind Ø inner / outer", "cylindrical / internal grinder", "inner spacer bore: slide fit on the shaft (≈ 5–10 µm clearance)"],
      ["40", "Grind + lap both faces as a PAIR (inner and outer together)", "double-disc grinder or surface grinder + lapping machine", "parallelism ≤ 1 µm, flatness ≤ 0.5 µm"],
      ["50", `Measure lengths, inner vs outer`, "comparator 0.1 µm + gauge blocks, 20 °C", "length difference = preload offset ±1 µm (bearing maker)"],
      ["60", "Mark the pair + direction, preserve", "vibro-engraver", "keep the pair together"]] },
    drawbar: { t: `Drawbar + disc-spring pack + HSK clamping set – drawbar 42CrMo4 +QT, springs DIN EN 16983 (51CrV4 class)`, rows: [
      ["10", "Saw + turn drawbar (guide Ø, threads)", "CNC lathe with steady rest (long + thin)", "straightness ≤ 0.05"],
      ["20", "Gun drill the coolant hole (option, coolant through spindle)", "gun-drilling machine", "drift as Op 40"],
      ["30", "Nitride or induction harden the guide Ø", "furnace / induction", "≥ 550 HV"],
      ["40", "Grind guide Ø (g5) + thread to clamping set", "cylindrical grinder", "runout ≤ 0.01"],
      ["50", `Spring pack: buy springs, stack (series/parallel) for F = ${f(C.Fspring / 1000, 1)} kN at the clamped position`, "spring force tester (force-displacement curve)", "force ±5 % at clamped + unclamped stroke"],
      ["60", "Pre-set the pack (load to flat 3× before measuring), guide rod", "press + tester", "record the curve"],
      ["70", "Check clamping force with the force gauge after assembly", `HSK-A63 clamping force gauge`, `≥ ${M.Fclamp} kN`]] },
    covers: { t: "Front cover with labyrinth, rear cover – C45 / aluminium, rotating labyrinth ring on the shaft", rows: [
      ["10", "Rough + finish turn spigot, labyrinth grooves", "CNC lathe", "spigot h6 / H7 to the housing"],
      ["20", "Drill sealing-air + drain holes (drain at the bottom!)", "HMC", "position ±0.1"],
      ["30", "Labyrinth ring (rotating): turn, balance with the rotor", "CNC lathe + balancing", "radial gap 0.2–0.3 mm when assembled"],
      ["40", "Face runout of the cover to the spigot", "dial / CMM", "≤ 5 µm"]] },
  };
}

/* ------------------------------------------------------------------ UI */
const box = $("hrItem4");
if (box) {
  const css = document.createElement("style");
  css.textContent = `#smPlanSeg{margin-bottom:8px} #hrItem4 .sm-plan td{font-size:12px;vertical-align:top} #hrItem4 .sm-polar{display:flex;flex-wrap:wrap;gap:8px}`;
  document.head.appendChild(css);
  box.innerHTML = `
    <div class="kpis" id="smKpis"></div>
    <div class="card"><div class="card-head"><h2>Process twin – one spindle shaft from the bar to the released part</h2><span class="sub">click an operation · faults change the simulated measured values</span></div>
      <div class="wm-route" id="smRoute"></div>
      <div class="apc3d-bar"><button class="btn primary" id="smPlay">▶ Play all</button><button class="btn ghost" id="smPrev">◀</button><button class="btn ghost" id="smNext">▶|</button>
        <input type="range" id="smU" min="0" max="1000" value="0" aria-label="Progress" style="max-width:220px"><button class="btn ghost" id="smNew">New shaft (random)</button><button class="btn ghost" id="smExport">Download part record</button></div>
      <div class="dk-step" id="smStep"></div>
      <div class="hr-grid"><div id="smScene"></div><div class="apc3d-info" id="smInfo"></div></div>
      <div class="apc3d-bar" style="margin-top:8px"><button class="btn ghost" id="sm3dBtn">Show 3D view</button><span class="small muted">3D follows the same operation + progress · "Cut" opens the shaft to show the bore</span></div>
      <div class="mf3d" id="sm3d" hidden></div>
      <div class="wm-faults-wrap"><span class="tb-label">Inject a process fault:</span><div class="wm-faults" id="smFaults"></div></div></div>
    <div class="card"><div class="card-head"><h2>Inspection report (Op 40 · 90 · 100 · 110 · 130)</h2><span class="sub" id="smRepSub"></span></div><div class="wm-charts" id="smRep"></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Part record – route, time, cost</h2></div><div class="table-wrap"><table class="apc-bom" id="smRouteT"></table></div></div>
      <div class="card"><div class="card-head"><h2>Lot simulation</h2><button class="btn ghost" id="smLotRun">Run 50 shafts</button></div><div class="table-wrap"><table class="apc-bom" id="smLot"></table></div></div></div>
    <div class="card"><div class="card-head"><h2>Equipment list – machines, tooling, workholding, gauges, consumables</h2><span class="sub">required capability = purchase specification (example values)</span></div><div class="table-wrap"><table class="apc-bom wm-eq" id="smEquip"></table></div></div>
    <div class="card"><div class="card-head"><h2>Process plans – the other spindle parts</h2><span class="sub">housing · cooling sleeve · spacers · drawbar + springs · covers (not animated)</span></div><div class="seg" id="smPlanSeg"></div><div class="table-wrap"><table class="apc-bom sm-plan" id="smPlan"></table></div><p class="small muted" id="smParts"></p></div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design + process inputs</h2><button class="btn ghost" id="smReset">Example values</button></div><p class="small" id="smGeo"></p><div id="smInputs"></div></div>
      <div class="apc-right"><div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="smCalc" class="apc-calc"></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Guide – faults, causes, checks, rules</h2></div><div id="smGuide" class="mx-guide"></div></div>`;

  let P = { ...DEF };
  try { Object.assign(P, JSON.parse(localStorage.getItem("hmcSpdMfg") || "{}")); } catch (er) { /* private */ }
  let F = {}, serial = 1, op = 0, u = 0, playing = false, last = performance.now(), started = false, hold = 0, G = null, R = null, lastDraw = 0, plan = "housing", cut = new URLSearchParams(location.search).has("smcut");
  const pane = $("tab-hmc"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad", info: "wm-info" }, ico = { ok: "✓", warn: "!", bad: "✕", info: "i" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  const st = (k) => { const r = R.O[k].res; return r.some((x) => x[2] === "bad") ? "bad" : r.some((x) => x[2] === "warn") ? "warn" : "ok"; };
  const chk = (rows) => rows.map(([l, v, s]) => `<div class="apc-chk ${cls[s]}"><b>${ico[s]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("");
  const sn = () => `SPS-${YYWW}-${String(R.sn).padStart(5, "0")}`;
  function compute() { G = geomS(P); R = simulate(G, P, F, 3000 + serial); R.P = P; R.F = F; }
  function inputs() {
    $("smInputs").innerHTML = ALLG.map(([gn, fs]) => `<fieldset class="apc-fs"><legend>${esc(gn)}</legend>${fs.map(([k, l, un, d, n]) => `<label class="apc-f" title="${esc(n)}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span><span class="apc-in"><input type="number" step="any" data-k="${k}" value="${P[k]}"${P[k] !== d ? ' class="chg"' : ""}><em>${esc(un)}</em></span></label>`).join("")}</fieldset>`).join("");
    $("smFaults").innerHTML = FAULTS.map(([k, l, w]) => `<button class="chip${F[k] ? " on" : ""}" data-smf="${k}" title="${esc(w)}">${F[k] ? "⚠ " : ""}${esc(l)}</button>`).join("");
  }
  function kpis() {
    const s = R.fails.length ? `REJECT at Op ${R.fails[0].no}` : R.warns.length ? "released, warnings" : "released";
    $("smKpis").innerHTML = [["Shaft", sn(), `heat ${R.O.saw.heat} · drawing VC-HMC-SPN-0101`], ["Status", s, R.fails.length ? "failed: " + [...new Set(R.fails.map((x) => "Op " + x.no))].join(", ") : "all checks passed"],
      ["Time per shaft", f(R.tSum / 60, 1) + " h", `incl. furnace share · nitriding ${f(G.tN, 0)} h hold`], ["Cost per shaft", "$" + f(R.cSum, 0), `bar $${f(R.mat, 0)} · lot ${P.lot}`], ["Taper runout", f(R.O.taper.runN, 2) + " µm", `300 mm: ${f(R.O.taper.run300, 1)} µm`], ["Residual unbalance", f(Math.max(...R.O.bal.Ures), 1) + " g·mm", `U_per/plane ${f(G.UperPl, 1)} g·mm`]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
  }
  function route() {
    $("smRoute").innerHTML = OPS.map((o, i) => { const done = i < op || (i === op && u >= 1), s = done ? st(o.k) : ""; return `<button class="wm-op${i === op ? " on" : ""}${done ? " done" : ""}${s === "bad" || s === "warn" ? " " + s : ""}" data-smop="${i}">${o.no} ${esc(o.n)}</button>`; }).join("");
  }
  function routeTable() {
    $("smRouteT").innerHTML = `<thead><tr><th>Op</th><th>Operation / machine</th><th>Set-up min</th><th>min / shaft</th><th>Cost</th><th>Result</th></tr></thead><tbody>${OPS.map((o) => `<tr><td>${o.no}</td><td>${esc(o.n)}<br><span class="muted">${esc(o.mc)}</span></td><td>${f(R.O[o.k].setup, 0)}</td><td>${f(R.O[o.k].t, 1)}</td><td>$${f(R.O[o.k].cost, 1)}</td><td class="wm-st-${st(o.k)}">${ico[st(o.k)]}</td></tr>`).join("")}
      <tr><td></td><td>Material: bar Ø${P.Db} × ${G.Lsaw}, ${f(G.mBar, 1)} kg × $${P.prSt}/kg</td><td></td><td></td><td>$${f(R.mat, 0)}</td><td></td></tr><tr><td></td><td><b>Total</b> (furnace hours shared by ${P.charge} shafts per charge)</td><td></td><td><b>${f(R.tSum, 0)}</b></td><td><b>$${f(R.cSum, 0)}</b></td><td></td></tr></tbody>`;
  }
  const eq = (k) => EQUIP[k](G, P);
  function info() {
    const o = OPS[op], x = R.O[o.k], steps = o.steps(G, P), si = Math.min(steps.length - 1, Math.floor(u * steps.length)), e = eq(o.k);
    $("smStep").innerHTML = `<span class="dk-n">Op ${o.no}</span> <b>${esc(steps[si])}</b>`;
    $("smInfo").innerHTML = `<div class="apc-pi-h"><b>Op ${o.no} · ${esc(o.n)}</b></div><p class="muted">${esc(o.mc)}</p><ol class="wm-steps">${steps.map((t, i) => `<li class="${i === si ? "on" : i < si ? "done" : ""}">${esc(t)}</li>`).join("")}</ol>
      <h4>Equipment</h4><table class="wm-kv">${[["Machine", e.mc], ["Tooling", e.tool], ["Workholding", e.fix], ["Gauges", e.gauge], ["Consumables", e.cons]].map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <h4>Settings</h4><table class="wm-kv">${x.par.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</table>
      <h4>Checks</h4>${u >= 0.92 ? chk(x.res) : `<p class="muted">… measured at the end of the operation</p>`}<p class="small muted">time ${f(x.t, 1)} min · set-up ${f(x.setup, 0)} min · $${f(x.cost, 1)}</p>`;
  }
  function scene() { $("smScene").innerHTML = SC[OPS[op].k](G, R, u, P); }
  const reached = (i) => op > i || (op === i && u >= 1);
  function reports() {
    const card = (inner, w = 360, h = 210) => `<svg viewBox="0 0 ${w} ${h}" class="apc-svg">${inner}</svg>`, D = R.O;
    $("smRepSub").textContent = reached(3) ? `shaft ${sn()}` : "first values at Op 40";
    if (!reached(3)) { $("smRep").innerHTML = `<p class="muted">The shaft has not been measured yet.</p>`; return; }
    const out = [], rows = [...D.gun.res];
    out.push(card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Gun drill: bore offset (µm)", note: `exit ${f(D.gun.drift * 1000, 0)} µm`, xr: [0, G.L], yr: [0, Math.max(200, P.dLim * 1300, D.gun.drift * 1100)], xl: "depth mm", hl: [{ y: P.dLim * 1000, t: "limit", col: "var(--critical)" }], series: [{ pts: Array.from({ length: 13 }, (_, j) => [j / 12 * G.L, D.gun.drift * (j / 12) ** 2 * 1000]), col: CR }] })));
    if (reached(8)) { out.push(card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Nitriding: hardness traverse (HV)", note: `Nht ${f(D.nit.NhtA, 2)} mm`, xr: [0, 1], yr: [200, 1000], xl: "depth mm", hl: [{ y: D.nit.core + 50, t: "core + 50", col: "var(--text-2)" }], series: [{ pts: D.nit.trHV, col: CL }, { pts: [[P.aP / 2, 200], [P.aP / 2, 1000]], col: CR, dash: "3 3", w: 1 }] }))); rows.push(...D.nit.res); }
    if (reached(9)) { out.push(card(`<rect x="0" y="0" width="360" height="210" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(8, 15, "Roundness front seat (µm)", "font-weight:600;fill:var(--text)")}${txt(352, 15, `${f(D.grind.rnd, 2)} µm (≤ ${P.tRnd})`, "text-anchor:end")}${polar(180, 112, 62, D.grind.trR, 18, D.grind.rnd > P.tRnd ? "var(--critical)" : CL)}${txt(8, 202, "dashed = ±1 µm", "font-size:10px")}`)); rows.push(...D.grind.res); }
    if (reached(10)) { const rr = rngOf(R.seed + 5); let pat = ""; for (let i = 0; i < 260; i++) { const px = rr(), py = rr(), on = F.taper ? px < D.taper.con / 100 * 1.05 : rr() < D.taper.con / 100 + 0.08; if (on) pat += `<rect x="${(14 + px * 330).toFixed(1)}" y="${(40 + py * 130).toFixed(1)}" width="7" height="5" fill="${BLUE}" opacity=".7"/>`; }
      out.push(card(`<rect x="0" y="0" width="360" height="210" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(8, 15, "HSK taper: blue contact", "font-weight:600;fill:var(--text)")}${txt(352, 15, `${f(D.taper.con, 0)} % (≥ ${P.tCon})`, "text-anchor:end")}<rect x="10" y="36" width="340" height="140" fill="#e9e3d6" stroke="#666"/>${pat}${txt(10, 196, "nose ←  taper length  → inside", "font-size:10px")}`)); rows.push(...D.taper.res); }
    if (reached(12)) { const max = Math.max(D.bal.U0[0].m, D.bal.U0[1].m, G.UperPl * 2) * 1.25; let v = `<rect x="0" y="0" width="360" height="210" rx="6" fill="var(--surface)" stroke="var(--border)"/>${txt(8, 15, "Balancing: before (red) / after (green)", "font-weight:600;fill:var(--text)")}`;
      [0, 1].forEach((j) => { const cx = 95 + j * 170, cy = 115, Rr = 70; v += `<circle cx="${cx}" cy="${cy}" r="${Rr}" fill="none" stroke="var(--border)"/><circle cx="${cx}" cy="${cy}" r="${G.UperPl / max * Rr}" fill="var(--good)" opacity=".25"/>${txt(cx - 22, 202, `plane ${j + 1}`)}` + vec(cx, cy, Rr, D.bal.U0[j].m, D.bal.U0[j].a, max, "var(--critical)", f(D.bal.U0[j].m, 0)) + vec(cx, cy, Rr, D.bal.Ures[j], D.bal.U0[j].a + 70, max, "var(--good-text)", ""); });
      out.push(card(v)); rows.push(...D.bal.res); }
    $("smRep").innerHTML = out.join("") + `<div class="apc-checks">${chk(rows)}</div>`;
  }
  function equipTable() {
    $("smEquip").innerHTML = `<thead><tr><th>Op</th><th>Machine (required capability)</th><th>Tooling</th><th>Workholding</th><th>Gauges / test equipment</th><th>Consumables</th></tr></thead><tbody>${OPS.map((o) => { const e = eq(o.k); return `<tr><td><b>${o.no}</b><br>${esc(o.n)}</td><td>${esc(e.mc)}</td><td>${esc(e.tool)}</td><td>${esc(e.fix)}</td><td>${esc(e.gauge)}</td><td>${esc(e.cons)}</td></tr>`; }).join("")}</tbody>`;
  }
  function planTable() {
    const PL = plans(G, P), names = { housing: "Housing", sleeve: "Cooling sleeve", spacers: "Spacers", drawbar: "Drawbar + springs", covers: "Covers + labyrinth" };
    $("smPlanSeg").innerHTML = Object.keys(PL).map((k) => `<button class="seg-btn${plan === k ? " active" : ""}" data-smpl="${k}">${names[k]}</button>`).join("");
    const p = PL[plan];
    $("smPlan").innerHTML = `<caption style="text-align:left;font-weight:600;padding:4px 0">${esc(p.t)}</caption><thead><tr><th>Op</th><th>Operation</th><th>Equipment (capability)</th><th>Tolerance / check</th></tr></thead><tbody>${p.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    $("smParts").innerHTML = "<b>Part list (MAKE / BUY):</b> " + SP_PARTS.map(([, n, mb]) => `${esc(n)} <i>(${mb})</i>`).join(" · ");
  }
  function runLot() {
    const N = 50, recs = Array.from({ length: N }, (_, i) => simulate(G, P, F, 8000 + i));
    const C = [["Gun-drill drift at exit (mm)", (r) => r.O.gun.drift, null, P.dLim], ["Nht after grinding (mm)", (r) => r.O.nit.NhtG, P.NhtMin, null], ["Surface hardness (HV)", (r) => r.O.nit.HVs, 750, null],
      ["Front seat Ø (µm)", (r) => r.O.grind.dF, -P.tSeat, P.tSeat], ["Rear seat Ø (µm)", (r) => r.O.grind.dR, -P.tSeat, P.tSeat], ["Roundness seats (µm)", (r) => r.O.grind.rnd, null, P.tRnd], ["Seat runout A-B (µm)", (r) => r.O.grind.co, null, P.tCo],
      ["Taper contact (%)", (r) => r.O.taper.con, P.tCon, null], ["Taper runout nose (µm)", (r) => r.O.taper.runN, null, P.tTap], ["Mandrel 300 mm (µm)", (r) => r.O.taper.run300, null, P.tT300], ["Lock-nut face runout (µm)", (r) => r.O.thread.nut, null, P.tNut],
      ["Residual unbalance max (g·mm)", (r) => Math.max(...r.O.bal.Ures), null, G.UperPl]];
    const rows = C.map(([n, fn, lo, hi]) => { const v = recs.map(fn), m = v.reduce((a, b) => a + b, 0) / N, sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1)) || 1e-9;
      const cpk = Math.min(hi != null ? (hi - m) / (3 * sd) : Infinity, lo != null ? (m - lo) / (3 * sd) : Infinity), outN = v.filter((x) => (hi != null && x > hi) || (lo != null && x < lo)).length;
      return `<tr><td>${esc(n)}</td><td>${lo != null ? f(lo, 3) : "–"} … ${hi != null ? f(hi, 3) : "–"}</td><td>${f(m, 3)}</td><td>${f(sd, 3)}</td><td class="wm-st-${cpk >= 1.33 ? "ok" : cpk >= 1 ? "warn" : "bad"}">${Number.isFinite(cpk) ? (cpk > 99 ? "> 99" : f(cpk, 2)) : "–"}</td><td>${outN}</td></tr>`; }).join("");
    const good = recs.filter((r) => !r.fails.length).length;
    $("smLot").innerHTML = `<thead><tr><th>Characteristic</th><th>Limits</th><th>Mean</th><th>σ</th><th>Cpk</th><th>Out</th></tr></thead><tbody>${rows}<tr><td colspan="6"><b>Yield: ${good} / ${N} shafts pass every check (${f(good / N * 100, 0)} %)</b></td></tr></tbody>`;
  }
  function formulas() {
    const M = G.M, C = G.C, half = G.half;
    $("smGeo").innerHTML = `<b>Shaft from spindle.js:</b> L ${G.L} mm · seats Ø${M.dF} / Ø${M.dR} js4 · rotor Ø${M.dRot} · bore Ø${M.dBore} · HSK-A63 · ${M.nmax} rpm · G ${M.Gbal}. Design values are shared with the spindle assembly twin (Assembly item 2) – the copy here is stored separately.`;
    $("smCalc").innerHTML = [
      blk("1 · Shaft, bar, masses", [`bar: π/4·D²·L·ρ = π/4·${P.Db}²·${G.Lsaw}·7.85·10⁻⁶ = <b>${f(G.mBar, 1)} kg</b>`, `finished hollow shaft: Σ π·(r_o² − r_i²)·Δx·ρ = <b>${f(G.mFin, 1)} kg</b> → chips ${f((1 - G.mFin / G.mBar) * 100, 0)} %`, `removed bore core: π/4·${M.dBore}²·${f(G.Lbore, 0)}·ρ = ${f(G.mBore, 2)} kg`]),
      blk("2 · Rough turning", [`Q = v_c·f·a_p = ${P.vcT}·${P.fT}·${P.apT} = <b>${f(G.Q, 0)} cm³/min</b>`, `chip volume V = ${f(G.Vr, 0)} cm³ → t ≈ V/Q·1.3 + 6 = <b>${f(G.tRough, 0)} min</b> (1.3 = air cuts, rapid)`, `allowance a_R = ${P.aR} mm on Ø ≥ 2·(drift ${P.dLim} + bend 0.15) + clean-up`]),
      blk("3 · Gun drilling", [`n = 1000·v_c/(π·d) = 1000·${P.vcG}/(π·${M.dBore}) = <b>${f(G.nG, 0)} rpm</b> (sum of drill + work speed with counter-rotation)`, `v_f = f·n = ${P.fG}·${f(G.nG, 0)} = ${f(G.vfG, 1)} mm/min → t = L/v_f + 5 = <b>${f(G.tGun, 0)} min</b>`, `L/D = ${G.L}/${M.dBore} = ${f(G.LD, 0)} (normal twist drills: ≤ 5–10 → gun drill needed)`,
        `drift e at the exit makes an unbalance: U ≈ m_core·e/2 = ${f(G.mBore * 1000, 0)} g · e/2 → e = 0.1 mm → <b>${f(G.mBore * 1000 * 0.05, 0)} g·mm</b> (U_per of the shaft only ${f(G.Uper, 1)} g·mm!)`], "Counter-rotation (part + drill turn opposite) and new guide pads keep the drift small. Check the drift with an ultrasonic wall-thickness gauge at the exit."),
      blk("4 · Gas nitriding", [`depth grows with √time: Nht ≈ k·√t  →  t = (Nht/k)² = (${P.Nht}/${P.kN})² = <b>${f(G.tN, 0)} h</b> at ${P.Tn} °C`, `double depth = 4 × time: Nht 0.6 mm → ${f((0.6 / P.kN) ** 2, 0)} h, 0.3 mm → ${f((0.3 / P.kN) ** 2, 0)} h`, `after grinding: Nht − a_P/2 = ${P.Nht} − ${P.aP / 2} = <b>${f(P.Nht - P.aP / 2, 2)} mm</b> (≥ ${P.NhtMin})`,
        `hardness traverse model HV(z) = HV_core + (HV_s − HV_core)·exp(−(z/z₀)²); Nht where HV = core + 50 (ISO 18203 – check)`], "k depends on steel, temperature and Kn – get it from the heat treater's coupons, do not trust a book value."),
      blk("5 · Cylindrical grinding", [`work speed n_w = 1000·v_w/(π·d) = 1000·${P.vw}/(π·${M.dF}) = ${f(G.nwF, 0)} rpm,  speed ratio q = v_s/v_w = ${P.vs}·60/${P.vw} = ${f(G.q, 0)}`,
        `plunge: t = (s − 0.005)/(f_r·n_w) + 0.005/(f_f·n_w) + spark-out → front seat ${f(G.gr[1] ? G.gr[1].t : 0, 1)} min (${G.gr[1] ? G.gr[1].n : 0} plunges of ${P.bW} mm)`, `all ground surfaces: <b>${f(G.tGr, 0)} min</b> incl. dressing + measuring`,
        `thermal: Δd = α·ΔT·d = 11.5·10⁻⁶·${P.dTg}·${M.dF} = <b>${f(G.dTh, 2)} µm</b> per coolant drift – js4 band is ±${P.tSeat} µm`]),
      blk("6 · Internal grinding of the taper", [`taper 1:10 → half-angle α/2 = atan(1/20) = ${f(half * 180 / Math.PI, 3)}°`, `wheel speed n = v_s·60000/(π·d) = ${P.vsI}·60000/(π·${P.dIw}) = <b>${f(G.nI, 0)} rpm</b>`, `swivel error 0.01° over the taper length 32 mm → Δr = 32·tan(0.01°) = <b>${f(32 * Math.tan(0.01 * Math.PI / 180) * 1000, 1)} µm</b> → contact only at one end`]),
      blk("7 · Balancing (ISO 21940-11)", [`U_per = 9549·G·m/n = 9549·${M.Gbal}·${f(G.mS, 1)}/${M.nmax} = <b>${f(G.Uper, 1)} g·mm</b> (shaft alone), ${f(G.UperPl, 1)} per plane`, `centre-of-mass offset e = U/m = ${f(G.Uper / G.mS, 2)} µm`, `correction capacity = m_max·r = ${P.mCorMax}·${P.rCor} = ${f(G.Ucap, 0)} g·mm per plane`, `whole rotor (spindle.js): U_per = ${f(C.Uper, 1)} g·mm, ${f(C.UperPlane, 1)} per plane`]),
      blk("8 · Design checks (spindle.js)", [`torque at n_max: T = P/ω = ${M.P}·1000/${f(C.om, 0)} = ${f(C.Tn, 1)} N·m · base speed ${f(C.nBase, 0)} rpm`, `speed factor n·d_m front = ${M.nmax}·${f(G.dmF, 0)} = ${f(C.ndmF / 1e6, 2)}·10⁶ ${C.ndmOK ? "(≤ 1.4·10⁶ – check catalogue)" : "TOO HIGH – check catalogue"}`, `drawbar force ${f(C.Fdraw / 1000, 1)} kN → spring pack ${f(C.Fspring / 1000, 1)} kN → unclamp piston Ø${f(C.dPiston, 0)} at ${C.pUnclamp} MPa`,
        `1st bending critical speed ≈ ${f(C.nCrit, 0)} rpm ${C.critOK ? "≥ 1.3·n_max ✓" : "< 1.3·n_max ✕"} · thermal growth rear ${f(C.dLshaft * 1000, 0)} µm, nose ${f(C.dLnose * 1000, 0)} µm`, `rotor shrink: heat to ≈ ${f(C.Trot, 0)} °C`]),
    ].join("");
  }
  function guide() {
    $("smGuide").innerHTML = `<h3>Faults – cause → found by → prevention</h3><table class="apc-bom"><thead><tr><th>Fault</th><th>Cause</th><th>Found by</th><th>Prevention</th></tr></thead><tbody>
      <tr><td>Bore drift (gun drilling)</td><td>worn guide pads, no counter-rotation, bushing not aligned, wrong feed / pressure</td><td>wall thickness at the exit (Op 40); if missed: huge unbalance (Op 130)</td><td>counter-rotation, bushing aligned to the work axis ≤ 0.01, new pads, feed-force monitoring, first-part check</td></tr>
      <tr><td>Nitriding too shallow / soft</td><td>Kn too low, cycle cut short, wrong core (not QT), oily surface</td><td>coupon: surface HV + hardness traverse (Op 90)</td><td>coupon of the same heat in every charge, Kn recorder, clean parts, contract with Nht + HV + white layer limits</td></tr>
      <tr><td>Chatter marks / lobes</td><td>wheel out of balance, not dressed, loose centre plug, worn bearings</td><td>roundness tester (Op 100 / 140): lobes</td><td>balance the wheel on the machine, dress on time, centre plugs lapped, q = v_s/v_w ≈ 100–150</td></tr>
      <tr><td>Taper contact &lt; 80 %</td><td>swivel angle off, worn wheel, quill bends</td><td>blue test + mandrel runout (Op 110)</td><td>set the angle with a master taper, short stiff quill, dress before the last pass</td></tr>
      <tr><td>Thread not square</td><td>thread cut while clamped on an unground Ø</td><td>gauge-nut face runout (Op 120)</td><td>clamp on the ground seats, thread + reference in one set-up</td></tr>
      <tr><td>Grinding burn</td><td>coolant missing / blocked nozzle, too much infeed, dull wheel</td><td>nital etch (Op 100), hardness drop</td><td>coolant flow monitor, CBN wheel, infeed limits from trials, etch every shaft</td></tr>
      <tr><td>Residual unbalance high</td><td>plane distances or angle reference set wrong, machine not calibrated</td><td>verification run (Op 130)</td><td>proving rotor + test mass run every shift, set-up sheet per shaft type</td></tr></tbody></table>
      <h3>Workshop rules</h3><ul><li><b>The bore is drilled early, the outside follows it.</b> Gun drilling comes before the outside is finished, so the wall thickness stays even.</li>
        <li><b>Stress relief before nitriding</b> (≥ 30 K above the nitriding temperature) – else the shaft moves in the furnace. Never straighten by bending.</li>
        <li><b>Shape before the furnace:</b> pre-grind to a small stock (${P.aP} mm on Ø). Nitriding barely changes the size; the final grind removes only the white layer and a little of the hard layer.</li>
        <li><b>One reference axis:</b> grind all bearing seats and the nose face in ONE set-up; grind the taper while the shaft sits on these ground seats.</li>
        <li><b>20 °C:</b> grind and measure in a temperature-controlled room; 1 K = ${f(ALPHA * G.M.dF * 1000, 2)} µm on Ø${G.M.dF}.</li>
        <li><b>Never touch seats and taper</b> with hard tools; store hanging or in V-boxes; the serial is marked on the body, not on a functional surface.</li>
        <li><b>Make or buy:</b> gun drilling, nitriding and precision grinding can be bought from specialists for small lots – the twin's equipment list is then the supplier qualification list.</li></ul>`;
  }
  function renderAll() { compute(); kpis(); route(); routeTable(); scene(); info(); reports(); formulas(); runLot(); equipTable(); planTable(); guide(); }
  function frame() { scene(); info(); route(); $("smU").value = Math.round(u * 1000); $("smPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }
  function go(n) { op = clamp(n, 0, OPS.length - 1); u = 0; hold = 0; frame(); reports(); }
  function startLoop() {
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || box.hidden || !playing) return;
      if (u < 1) { u = Math.min(1, u + dt / 7); if (now - lastDraw > 33 || u >= 1) { lastDraw = now; frame(); if (u >= 1) reports(); } }
      else { hold += dt; if (hold > 1.4) { hold = 0; if (op < OPS.length - 1) go(op + 1); else { playing = false; frame(); } } } };
    requestAnimationFrame(loop);
  }
  const save = () => { try { localStorage.setItem("hmcSpdMfg", JSON.stringify(P)); } catch (er) { /* ignore */ } };
  inputs();
  $("smInputs").addEventListener("change", (ev) => { const k = ev.target.dataset.k; if (!k) return; const v = parseFloat(ev.target.value); if (!Number.isFinite(v) || v <= 0) { ev.target.value = P[k]; return; }
    P[k] = v; ev.target.classList.toggle("chg", v !== DEF[k]); save(); renderAll(); frame(); });
  $("smFaults").addEventListener("click", (ev) => { const b = ev.target.closest("[data-smf]"); if (!b) return; F[b.dataset.smf] = !F[b.dataset.smf]; inputs(); renderAll(); frame(); });
  $("smPlanSeg").addEventListener("click", (ev) => { const b = ev.target.closest("[data-smpl]"); if (!b) return; plan = b.dataset.smpl; planTable(); });
  $("smReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; P = { ...DEF }; try { localStorage.removeItem("hmcSpdMfg"); } catch (er) { /* ignore */ } inputs(); renderAll(); frame(); });
  $("smPlay").addEventListener("click", () => { playing = !playing; if (playing && op === OPS.length - 1 && u >= 1) go(0); last = performance.now(); frame(); });
  $("smPrev").addEventListener("click", () => { playing = false; go(op - 1); });
  $("smNext").addEventListener("click", () => { playing = false; go(op + 1); });
  $("smU").addEventListener("input", (ev) => { playing = false; u = ev.target.value / 1000; frame(); reports(); });
  $("smRoute").addEventListener("click", (ev) => { const b = ev.target.closest("[data-smop]"); if (b) { playing = false; go(+b.dataset.smop); } });
  $("smNew").addEventListener("click", () => { serial++; renderAll(); frame(); });
  $("sm3dBtn").addEventListener("click", () => { const el = $("sm3d"); el.hidden = !el.hidden; $("sm3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view"; if (!el.hidden && !el.dataset.on) { el.dataset.on = "1"; import("./spd3d.js").then((m) => m.create(el, () => window.spdMfg.state(), "shaft")); } });
  $("smLotRun").addEventListener("click", () => runLot());
  $("smExport").addEventListener("click", () => {
    const rec = { shaft: sn(), drawing: "VC-HMC-SPN-0101-A", heat: R.O.saw.heat, design: Object.fromEntries(Object.keys(SP_DEF).map((k) => [k, P[k]])), faults: Object.keys(F).filter((k) => F[k]),
      operations: OPS.map((o) => ({ op: o.no, name: o.n, equipment: eq(o.k), setup_min: R.O[o.k].setup, time_min: +R.O[o.k].t.toFixed(2), cost: +R.O[o.k].cost.toFixed(2), settings: Object.fromEntries(R.O[o.k].par), checks: R.O[o.k].res.map(([l, v, s]) => ({ check: l, value: v, result: s })) })),
      verdict: R.fails.length ? "REJECT" : "RELEASED", note: "simulated example values" };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(rec, null, 2)], { type: "application/json" })); a.download = `${rec.shaft}_part_record.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  let shown = false;
  const show = () => { shown = true; renderAll(); frame(); startLoop(); if (new URLSearchParams(location.search).has("show3d") && $("sm3d").hidden) setTimeout(() => $("sm3dBtn").click(), 300); };
  window.addEventListener("hritemshow", (ev) => { if (ev.detail === "4") show(); });
  window.spdMfg = { show: () => window.wormMfg && window.wormMfg.showItem("4"), state: () => (G ? { k: OPS[op].k, no: OPS[op].no, n: OPS[op].n, u, G, R, P, F, cut, prof: profAt(G, P, OPS[op].k, u), setCut: (v) => { cut = !!v; }, visible: !box.hidden && pane && pane.classList.contains("active") } : null), profAt: (k, uu) => profAt(G, P, k, uu) };
  const q = new URLSearchParams(location.search);
  if (q.get("smf")) q.get("smf").split(",").forEach((k) => { if (FAULTS.some((x) => x[0] === k)) F[k] = true; });
  if (q.get("smsn")) serial = Math.max(1, parseInt(q.get("smsn"), 10) || 1);
  if (q.get("smop")) { const i = OPS.findIndex((o) => o.no === parseInt(q.get("smop"), 10)); if (i >= 0) { op = i; u = q.get("smu") ? clamp(parseFloat(q.get("smu")), 0, 1) : 1; } }
  if (q.get("hritem") === "4") { inputs(); setTimeout(() => { if (box.hidden && window.wormMfg) window.wormMfg.showItem("4"); else if (!shown) show(); }, 50); }
}
export { profAt as spdProfAt, OPS as SPD_OPS };
