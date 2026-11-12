/* ASSEMBLY tab - item 2: DIGITAL TWIN of the MOTOR SPINDLE ASSEMBLY (HMC build item 4, shared model web/spindle.js).
   21 steps from the kit check in the clean room to the final spindle test: bearing measuring + spacer grinding (preload),
   grease dosing, heating + mounting the front TBT set, lock-nut runout correction, front bearing housing, rotor shrink fit,
   rear bearings, drawbar + disc-spring pack, balancing, stator + cooling sleeve, insertion into the motor housing, covers,
   unclamp cylinder, clamping-force test, sensors, run-in, final test, packing.  Each step: how-to, equipment to BUY,
   jigs to MAKE (blue), torques, checks with limits and simulated values (random + 8 faults).  2D section built from
   spGeom(), 3D in asmsp3d.js.  All values are EXAMPLES.  Offline, no libraries. */
import { SP_DEF, spGeom, spCalc } from "./spindle.js";
import { $, esc, f, RAD, clamp, ease, rngOf, gauss, chart, txt, big, CL, CR } from "./wormmfg.js";

const W = 760, H = 500, YYWW = "2546", pad = (n, l = 5) => String(n).padStart(l, "0");
const open = (t, sub) => `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="${esc(t)}"><text x="10" y="18" class="apc-t" style="font-weight:600">${esc(t)}</text>${sub ? `<text x="${W - 10}" y="18" class="apc-t r">${esc(sub)}</text>` : ""}`;
const JC = "#3a6ea8", JD = "#26486e";   // jig blue
const C = { shaft: "#aab4bd", ring: "#cdd6de", ball: "#2f353b", spacer: "#8fa3b8", nut: "#6f7f8f", rotor: "#7d9a6a", stator: "#8b9a8b", copper: "#c07a3a", hsg: "#9aa4ae", hsgF: "#a7b0b9",
  sleeve: "#7fa6c9", cover: "#b8c0c8", bar: "#7c838a", spring: "#c0603a", cyl: "#8d96a0", oring: "#222", sensor: "#d0a020", hot: "#e8742a" };

/* ------------------------------------------------------------------ equipment (BUY) + jigs (MAKE) */
const EQ = {
  E1: ["Clean assembly room", "BUY/BUILD", "separate room, 20 ±1 °C, filtered air with over-pressure, cleanliness ISO 14644-1 class 7–8 (check what your bearing maker asks for), no grinding / welding / compressed-air blowing inside, ≥ 1000 lx at the bench, ESD-safe floor"],
  E2: ["Washing station (solvent + ultrasonic)", "BUY", "closed solvent washer (filtered, 2 baths: wash + rinse) and ultrasonic tank for shaft, spacers, nuts, covers; lint-free drying; filter-patch kit. Bearings: only if the bearing maker says so"],
  E3: ["Temperature soak rack / cabinet", "BUY", "in the clean room; all parts ≥ 12 h at 20 °C before measuring (1 K on Ø70 steel = 0.8 µm)"],
  E4: ["Laminar-flow clean bench", "BUY", "vertical laminar flow, HEPA H14, ISO 14644-1 class 5 at the work surface (check), for unpacking bearings, measuring and greasing"],
  E5: ["Bearing measuring stand", "BUY / MAKE", "measures the stand-out (face offset) of angular-contact bearings under a defined measuring load (from the bearing catalogue), electronic probe resolution 0.1 µm, granite base"],
  E6: ["Precision measuring set", "BUY", "bore gauges 0.001 mm with setting rings Ø60 / Ø70 / Ø75 / Ø95 / Ø110 / Ø120 / Ø200, outside micrometers 0.001 mm 50–225 mm, feeler gauges 0.02–1 mm, gauge blocks grade 0 or 1"],
  E7: ["Surface grinder / lapping plate for spacers", "BUY or SERVICE", "grinds spacer faces to ±1 µm length, parallelism ≤ 1 µm (or fine lapping on a cast-iron plate); length measured with a 0.1 µm comparator"],
  E8: ["Grease dosing unit + precision scale", "BUY", "syringe or dosing gun with clean cartridges of the bearing grease, scale 0.01 g; grease type + quantity from the bearing catalogue"],
  E9: ["Induction bearing heater", "BUY", "temperature control with magnetic probe, max set 110 °C (check bearing catalogue: hybrid / ceramic balls), automatic demagnetising, bores 50–120 mm"],
  E10: ["Torque wrenches + hook-spanner adapters", "BUY", "ISO 6789 calibrated, 2–25 / 20–100 / 60–340 N·m; hook-spanner / pin-wrench adapters for the precision lock nuts; small torque screwdriver 0.5–6 N·m for the nut set screws"],
  E11: ["Indicators: dial 0.001 + electronic probe 0.1 µm", "BUY", "2 × test indicator 0.001 mm, 1 × electronic lever probe 0.1 µm (for ≤ 2 µm runout use the 0.1 µm probe – 10 : 1 rule), magnetic + rigid stands"],
  E12: ["Hydraulic hand press + force gauge", "BUY", "0–50 kN, digital force gauge, used to set bearings axially after cooling and to load the spring pack tool"],
  E13: ["Crane / chain hoist 500 kg with slow speed", "BUY", "slow lowering ≤ 0.5 m/min (or micro-lift), round slings, lifting adapter for the spindle nose"],
  E14: ["Rotor heating oven", "BUY", "air-circulation oven up to 250 °C (check the rotor maker's maximum – permanent magnets!), controlled ±5 °C, thermocouple on the part, heat-protective gloves"],
  E15: ["Housing heater", "BUY", "oven or heating jacket for housings up to Ø300 × 500 mm, ≤ 120 °C, for stator and bearing-housing shrink fits"],
  E16: ["Balancing machine + field balancing instrument", "BUY / SERVICE", "horizontal balancing machine for rotors 5–50 kg, 2-plane, minimum achievable residual unbalance far below Uper (≤ 1 g·mm); field balancing instrument (vibration + phase) for trim balancing in the housing"],
  E17: ["Pressure test unit (cooling jacket)", "BUY", "hand pump or regulated air/water 0–16 bar, gauge class 0.6 or digital 0.1 %, plugs for the cooling ports"],
  E18: ["HSK clamping-force gauge (HSK-A63)", "BUY", "dummy tool with force sensor, range 0–40 kN, accuracy ≤ 2 %, with calibration certificate"],
  E19: ["Hydraulic test unit for the unclamp cylinder", "BUY / use the machine unit", "0–10 MPa adjustable, pressure transducer, 4/2 valve, flow ≥ 2 l/min"],
  E20: ["Run-in test stand", "BUY / MAKE", "spindle drive (inverter for the built-in motor, encoder interface), chiller for the cooling jacket (20 ±0.5 °C), sealing air + oil-free dry air, data logger ≥ 8 temperature channels + speed + vibration, run-in program"],
  E21: ["Test mandrel HSK-A63, 300 mm", "BUY", "ground test mandrel with calibration certificate, runout of the mandrel itself known (≤ 1 µm, check certificate)"],
  E22: ["Non-contact displacement sensors", "BUY", "2–3 capacitive or eddy-current probes, resolution ≤ 0.1 µm, bandwidth ≥ 2 kHz, for runout at speed and thermal growth at the nose"],
  E23: ["Vibration meter + sound level meter", "BUY", "vibration velocity mm/s RMS (10–1000 Hz) + spectrum; sound level meter class 2 dB(A)"],
  E24: ["Electrical test set", "BUY", "insulation tester 500 / 1000 V DC, micro-ohmmeter for winding resistance, PT100 / KTY simulator, encoder signal tester"],
  E25: ["Barcode / DataMatrix scanner + MES tablet", "BUY", "reads laser marks on metal, writes the assembly record"],
  E26: ["Stiffness loading device", "BUY / MAKE", "hydraulic or screw loading with force gauge 0–5 kN, axial + radial at the test mandrel, displacement probe 0.1 µm"],
};
const JIG = {
  J1: ["Vertical assembly stand (nose down)", "welded / cast stand, height 750 mm, top plate with a centring adapter for the nose face (soft PA insert, Ø120 recess), shaft stands nose-down, can turn by hand, locking pin; hole Ø50 in the middle for the drawbar"],
  J2: ["Bearing push sleeves (front + rear sets)", "tubes of steel with brass or PA end ring, one per bearing size: pushes ONLY on the inner ring (Ø70 → face Ø71–Ø83; Ø60 → Ø61–Ø71); length > distance to the seat; used for the final axial setting after cooling (press E12, max force from the catalogue)"],
  J3: ["Nut runout fixture", "rigid arm clamped to J1, holds the 0.1 µm probe on the nut face (radius ≈ 44 mm) and a second probe on the seat; indexing ring with 8 marks (45°) for the set-screw correction"],
  J4: ["Rotor heating + mounting fixture", "heat-resistant tongs / 3-jaw gripper with a lifting eye that hold the rotor sleeve level; guide bush F7 on the shaft tail (Ø50 example) so the hot rotor goes straight; the body shoulder (Ø68 example) is the axial stop"],
  J5: ["Mounting cone + thread protector (rear)", "PA cone over the M60 thread and the tail so bearings and rotor do not touch the thread; rear push sleeve"],
  J6: ["Spring-pack compression tool", "frame on the shaft tail, threaded spindle M20 pushes the drawbar against the spring pack, force gauge in series; compresses the pack to the clamped length to fit the drawbar nut / collet; stroke ≥ 15 mm"],
  J7: ["Balancing supports", "the front bearing housing sits in cradle 1 of the balancing machine; rear support sleeve J7 (bore = rear bearing OD, clearance 5–10 µm) sits in cradle 2; the rotor turns in its OWN bearings; drive by belt on the rotor end or by the nose"],
  J8: ["Housing stand + insertion guide", "stand for the motor housing standing on its rear face (hole for the tail), 3 guide rods Ø16 h7 screwed into the housing front face (flange threads) that guide the front bearing housing; lifting adapter in the HSK taper / nose thread"],
  J9: ["Stator insertion fixture", "3-point lifting fixture for the stator + cooling sleeve, centring cone, keeps the leads safe; O-ring fitting sleeves (no sharp edges)"],
  J10: ["Labyrinth gap gauge + cover centring ring", "feeler set 0.15 / 0.20 / 0.25 / 0.30 mm, centring ring that holds the front cover concentric (gap all round equal) while the screws are tightened"],
  J11: ["Test mandrel holder / sensor frame", "rigid frame on the spindle housing for 2 capacitive probes at the taper (z = 10 mm) and at 300 mm, + 1 axial probe on the nose face (thermal growth)"],
  J12: ["Run-in cradle", "clamping cradle with Ø230 H7 half-shells for the housing, connections for cooling water, sealing air and the unclamp cylinder; mounted on a heavy base (vibration-free)"],
};
const TQ = [ // joint, screws, class, torque, sequence (examples – catalogue / drawing wins)
  ["Front precision lock nut M70×1.5", "1 nut (hook spanner)", "–", "≈ 125 (example – nut catalogue)", "seat to 2× torque, loosen, final torque; then correct runout with the radial set screws"],
  ["Lock-nut radial set screws (front + rear)", "4–8 × M6 set screws", "45H", "nut catalogue (small!)", "evenly first, then only the screw at the HIGH point for the runout correction"],
  ["Rear precision lock nut M60×1.5", "1 nut", "–", "≈ 73 (example – nut catalogue)", "same as front"],
  ["Front bearing housing → motor housing", "8 × M10", "10.9", 67, "crosswise, 3 stages 30 / 70 / 100 %"],
  ["Front cover (labyrinth) → bearing housing", "6 × M6", "8.8", 9.5, "crosswise, with centring ring J10, then check the gap"],
  ["Rear cover / floating sleeve cover", "6 × M6", "8.8", 9.5, "crosswise"],
  ["Cooling sleeve / stator clamp ring", "6 × M8", "10.9", 34, "crosswise"],
  ["Unclamp cylinder → rear cover", "6 × M8", "10.9", 34, "crosswise, after the stroke setting"],
  ["Drawbar ↔ clamping set (collet)", "thread on the drawbar", "–", "clamping-set catalogue", "thread locker as the catalogue, hold the drawbar flats"],
  ["Balancing screws in the nut / balancing ring", "M5 / M6 set screws", "45H", "≈ 3–5 (example)", "medium-strength thread locker"],
  ["Spindle housing → machine (flange)", "8 × M12", "10.9", 115, "crosswise, 3 stages (check doc 14)"],
];

/* ------------------------------------------------------------------ steps */
// ori: d = nose down (shaft on J1), u = nose up (housing on J8), c = custom scene;  add: parts that come in this step; from: -1 above / +1 below
const STEPS = [
  { k: "kit", ph: "Prepare", ori: "c", n: "Kit + traceability", t: 30, men: 1, eq: ["E25"], jig: [], how: ["Scan every serial into the assembly record: shaft, housings, matched bearing sets, spacers, nuts, rotor + stator (one motor kit), drawbar + clamping set, springs", "Matched bearing sets: all rings carry the SAME set number; the V-line on the outer rings must be continuous", "Check the part records are released (shaft runout ≤ 2 µm, bores IT4, no open NCR)", "Keep bearings in their sealed packing until step 3"] },
  { k: "clean", ph: "Prepare", ori: "c", n: "Clean room, wash, soak at 20 °C", t: 120, men: 1, eq: ["E1", "E2", "E3", "E4"], jig: [], how: ["Gloves (nitrile, lint-free), clean coat, cap; nothing from the machine shop enters the room", "Wash shaft, spacers, nuts, covers, housings in the solvent washer, small parts in the ultrasonic tank; blow out bores with FILTERED dry air (never on bearings)", "Bearings: follow the bearing maker – many are mounted with their preservative; if washed: clean solvent, dry without spinning", "Soak all parts ≥ 12 h at 20 ±1 °C, cover them (clean film)"] },
  { k: "meas", ph: "Measure", ori: "c", n: "Measure bearings, seats, bores (fits)", t: 120, men: 1, eq: ["E4", "E5", "E6", "E11"], jig: [], how: ["Bearing measuring stand: measure the stand-out (face offset) of every bearing under the catalogue measuring load", "Read the deviation marks on each ring (bore Δd, OD ΔD in µm) and check them with the bore gauge / micrometer", "Measure the shaft seats (front Ø70 js4, rear Ø60 js4) at 2 planes × 2 directions, the housing bores Ø110 and the floating sleeve", "Calculate every fit: shaft − bore = interference, bore − OD = clearance; write them into the record"] },
  { k: "spacer", ph: "Measure", ori: "c", n: "Grind spacers to the measured offset (preload)", t: 90, men: 1, eq: ["E7", "E5", "E6"], jig: [], how: ["From the stand-outs calculate the required length difference outer − inner spacer (Δs)", "Grind (or lap) the INNER spacer so that Lo − Li = Δs ±1 µm; both faces parallel ≤ 1 µm", "Measure both spacers with the 0.1 µm comparator at 4 points, mark them (set number + position)", "Wash and soak the spacers again"] },
  { k: "grease", ph: "Measure", ori: "c", n: "Grease the bearings (weighed quantity)", t: 45, men: 1, eq: ["E4", "E8"], jig: [], how: ["Grease type and quantity from the bearing catalogue (here 15 % of the free volume – example)", "Weigh the grease for each bearing on the 0.01 g scale", "Put it evenly between the balls from BOTH sides, turn the bearing slowly by hand to spread it", "Cover the greased bearings – no dust may touch the grease"] },
  { k: "front", ph: "Shaft unit", ori: "d", add: ["brgF", "spF"], from: -1, n: "Heat + mount the front TBT set", t: 75, men: 2, eq: ["E9", "E11", "E12"], jig: ["J1", "J2"], how: ["Shaft nose-down in the vertical stand J1, seat oiled thinly", "Heat inner rings in the induction heater to ≈ 70 °C (never above 110 °C), one bearing after the other in the order of the V-line", "Slide on bearing 1, 2 (tandem), inner + outer spacer, bearing 3, 4 (tandem, back-to-back to 1–2): the V on the outer rings points to the nose", "Hold each bearing against the shoulder until it grips; after cooling press axially with the push sleeve J2 (force from the catalogue)"] },
  { k: "nut", ph: "Shaft unit", ori: "d", add: ["nutF"], from: -1, n: "Front lock nut: torque + runout correction", t: 60, men: 1, eq: ["E10", "E11"], jig: ["J1", "J3"], how: ["Screw on the precision nut by hand, seat it with 2 × torque, loosen, tighten to the final torque", "Measure the face runout of the nut with the 0.1 µm probe (fixture J3), turn the shaft slowly, find the high point", "Correct with the radial set screws: tighten the screw at the HIGH point a little, measure again, until ≤ 2 µm", "Measure the bearing friction torque (preload check) and lock all set screws to the catalogue torque"] },
  { k: "fbh", ph: "Shaft unit", ori: "d", add: ["hsgF"], from: -1, n: "Front bearing housing over the front set", t: 45, men: 2, eq: ["E15", "E13", "E11"], jig: ["J1"], how: ["Heat the front bearing housing ≈ 20 K above room temperature (bore Ø110 grows ≈ 25 µm)", "Lower it with the crane, slowly and level, over the front set until the shoulder touches the outer ring of bearing 4", "Hold it down until it has cooled (5–10 min), then check: outer rings seated, no axial play (probe)", "The front cover is fitted later (step 15)"] },
  { k: "rotor", ph: "Shaft unit", ori: "d", add: ["rotor"], from: -1, n: "Rotor sleeve shrink fit", t: 60, men: 2, eq: ["E14", "E13", "E6"], jig: ["J4", "J5"], how: ["Measure rotor bore and shaft seat once more (20 °C): interference = seat − bore", "Heat the rotor in the oven to the calculated temperature (check the magnet limit of the rotor maker)", "Thread protector J5 on the tail; lift the rotor with the tongs J4, slide it down quickly and straight to the shoulder (axial stop)", "Hold it against the shoulder until it grips (≈ 1 min), let it cool in air; never cool with water"] },
  { k: "rear", ph: "Shaft unit", ori: "d", add: ["brgR", "nutR"], from: -1, n: "Rear bearings (DB) + rear nut", t: 60, men: 1, eq: ["E9", "E10", "E11"], jig: ["J2", "J5"], how: ["Heat the 2 rear bearings (≈ 70 °C) and mount them back-to-back (V-line), push sleeve J2 after cooling", "Rear precision nut: seat, loosen, final torque, runout correction ≤ 2 µm like the front nut", "Check that the floating sleeve slides over the outer rings with a light push (later in the housing)", "Measure the runout of the rear seat area and the tail (encoder ring seat) ≤ 3 µm"] },
  { k: "draw", ph: "Shaft unit", ori: "d", add: ["bar", "springs"], from: -1, n: "Drawbar + disc-spring pack", t: 60, men: 2, eq: ["E12", "E10"], jig: ["J6"], how: ["Stack the disc springs on the drawbar EXACTLY as the drawing: groups of 2 in parallel (same direction), groups in series (alternating) – count them", "Grease the springs lightly (catalogue), measure the free pack length L0", "Insert drawbar + springs + clamping set into the shaft bore, compress the pack with tool J6 to the clamped length and fit the drawbar nut", "Read the force gauge at the clamped length = spring force; write it down"] },
  { k: "balance", ph: "Balance", ori: "c", n: "Balance the rotor unit (2 planes)", t: 90, men: 1, eq: ["E16", "E13"], jig: ["J7"], how: ["Put the rotor unit on the balancing machine: front bearing housing in cradle 1, rear support sleeve J7 in cradle 2 – it turns in its own bearings", "Measure the initial unbalance in plane 1 (front nut) and plane 2 (rear nut / rotor ring) at the balancing speed", "Correct with balancing screws in the nut threads (or drill in the balancing ring): mass m = U / r at the shown angle", "Repeat until the residual unbalance per plane ≤ Uper/2 (ISO 21940-11 grade); lock the screws"] },
  { k: "stator", ph: "Housing", ori: "u", add: ["hsgM", "sleeve", "stator"], fix: ["hsgM"], from: -1, n: "Stator + cooling sleeve into the motor housing", t: 90, men: 2, eq: ["E15", "E17", "E13", "E24"], jig: ["J8", "J9"], how: ["Motor housing standing on its rear face on stand J8", "Heat the cooling sleeve, insert the stator (shrink fit, stator maker's temperature limit), let it cool; leads out through the cable bore", "Fit the O-rings (oiled, fitting sleeve), lower sleeve + stator into the housing with J9", "Pressure test the cooling jacket 1.5 × working pressure for 15 min; insulation + winding resistance test"] },
  { k: "insert", ph: "Housing", ori: "u", add: ["unit"], from: -1, n: "Insert the shaft unit (vertical)", t: 75, men: 2, eq: ["E15", "E13", "E11"], jig: ["J8"], how: ["Turn the shaft unit nose-up, lifting adapter in the nose, crane on slow speed", "Screw the 3 guide rods J8 into the housing face; warm the housing ≈ 15 K if the drawing asks for it", "Lower the unit tail-first: the rotor goes into the stator WITHOUT touching (air gap ≈ 1 mm), the front bearing housing slides on the guide rods", "Bolt the front bearing housing (8 × M10, 67 N·m crosswise); turn the shaft by hand: free, even, no noise"] },
  { k: "cover", ph: "Housing", ori: "u", add: ["coverF", "sleeveR", "coverR"], below: ["sleeveR", "coverR"], from: -1, n: "Front cover (labyrinth) + rear sleeve + cover", t: 60, men: 1, eq: ["E10", "E6"], jig: ["J10"], how: ["Front cover with the centring ring J10: labyrinth gap all round equal (feeler gauges)", "6 × M6, 9.5 N·m crosswise; sealing-air test: air comes out evenly at the labyrinth", "From the rear: floating sleeve over the rear bearings (it must slide – it takes the thermal growth of the shaft), rear cover", "Check: the floating sleeve moves axially with a small force, shaft still turns freely"] },
  { k: "unclamp", ph: "Clamping", ori: "u", add: ["cyl"], from: 1, n: "Unclamp cylinder + stroke setting", t: 60, men: 1, eq: ["E19", "E10", "E11"], jig: [], how: ["Fit the unclamp cylinder (piston, seals oiled) to the rear cover, 6 × M8 crosswise", "Connect the hydraulic test unit, bleed, raise the pressure slowly: note the pressure where the drawbar starts to move", "Measure the drawbar stroke at the tail (indicator): clamped → unclamped, and the ejection of the tool at the nose", "Set the gap piston ↔ drawbar in the clamped state (piston must NOT touch the turning drawbar)"] },
  { k: "clamp", ph: "Clamping", ori: "u", n: "Clamping-force test (HSK gauge)", t: 45, men: 1, eq: ["E18", "E19"], jig: [], how: ["Clean the taper, insert the HSK-A63 clamping-force gauge, release the cylinder pressure → the springs clamp", "Read the clamping force; repeat 3 times (unclamp – clamp) and use the mean", "Check the 3 positions of the clamp sensor: unclamped / clamped with tool / clamped without tool", "Tool ejection at unclamp: the tool is pushed out of the taper (feel + indicator)"] },
  { k: "sensors", ph: "Clamping", ori: "u", add: ["sens"], from: -1, n: "Sensors + electrical test", t: 60, men: 1, eq: ["E24"], jig: [], how: ["Fit the temperature sensors (PT100 at the front bearings, KTY / PT in the stator winding), vibration sensor on the housing", "Fit the encoder (gear / magnetic ring on the tail, read head gap with the gauge), clamp-position sensor at the cylinder", "Electrical test: insulation, winding resistance 3 phases, sensor values plausible at 20 °C, encoder signal amplitude", "Label every cable (device tag) and fix it – nothing may touch the turning parts"] },
  { k: "runin", ph: "Test", ori: "c", n: "Run-in program (grease distribution)", t: 300, men: 1, eq: ["E20", "E22", "E23"], jig: ["J12"], how: ["Spindle in the run-in cradle J12, cooling 20 °C on, sealing air on, temperatures + vibration logged", "Speed steps 2 000 → 4 000 → … → nmax; at each step wait until the bearing temperature is stable", "If the temperature rise reaches the stop limit (25 K example): stop, let it cool to 12 K, continue at the same step", "End: 30 min at nmax with a stable temperature – grease is distributed"] },
  { k: "test", ph: "Test", ori: "c", n: "Final test: runout, stiffness, thermal growth, vibration", t: 180, men: 1, eq: ["E21", "E22", "E23", "E26", "E18", "E11"], jig: ["J11", "J12"], how: ["Runout of the taper (near the nose) and at the 300 mm test mandrel (turn the mandrel 4 × 90° and average – this removes the mandrel's own error)", "Axial + radial stiffness: load step by step, measure displacement, k = ΔF / Δx", "Thermal growth at the nose: axial probe, 60 min at nmax", "Vibration velocity + spectrum at nmax, noise, clamping force once more, power at no load"] },
  { k: "pack", ph: "Test", ori: "u", add: ["lock"], from: -1, n: "Record, transport lock, packing", t: 45, men: 1, eq: ["E25"], jig: [], how: ["Close the assembly record (all values, serials, gauge IDs, signatures), type plate SPU-YYWW-nnnnn", "Transport lock: cap on the nose + taper cover, drawbar clamped, cooling channels blown empty and plugged", "Preservation on bare surfaces (taper: special oil, no grease), desiccant, VCI film", "Crate with shock indicator; spindle lies horizontal on its housing (never on the nose)"] },
];
const SI = Object.fromEntries(STEPS.map((s, i) => [s.k, i]));
const FAULTS = [
  ["mix", "Bearing set mixed / one bearing reversed", "V-line at step 6, friction torque step 7, run-in temperature + stiffness"],
  ["spacer", "Spacer ground 6 µm too short", "spacer check at step 4, friction torque step 7, run-in temperature"],
  ["dirt", "Dirt in a bearing (blown with shop air)", "run-in noise + vibration, final vibration"],
  ["grease", "Grease dosed by eye (≈ 3× too much)", "grease step 5 (not weighed), run-in stops + long run-in"],
  ["nut", "Nut runout not corrected", "nut runout at step 7, taper + mandrel runout at step 20"],
  ["rotor", "Rotor interference too small", "rotor fit at step 9, unbalance shift after run-in (step 20)"],
  ["spring", "Disc springs stacked wrong", "pack length step 11, clamping force at step 17"],
  ["oring", "Cooling-sleeve O-ring cut", "pressure test at step 13"],
];

/* ------------------------------------------------------------------ disc-spring pack (Almen–László, DIN EN 16979 formula – check) */
const SPRING = { De: 40, Di: 20.4, t: 2.25, h0: 0.9, np: 2, stroke: 6, p: 6, dRod: 30, name: "A 40 × 20.4 × 2.25 (example – check DIN EN 16983 / catalogue)" };
function almen(s, S = SPRING) {
  const d = S.De / S.Di, K1 = (1 / Math.PI) * ((d - 1) / d) ** 2 / ((d + 1) / (d - 1) - 2 / Math.log(d)), E = 206000, mu = 0.3;
  return 4 * E / (1 - mu * mu) * S.t ** 4 / (K1 * S.De ** 2) * (s / S.t) * ((S.h0 / S.t - s / S.t) * (S.h0 / S.t - s / (2 * S.t)) + 1);
}
export function packCalc(R, S = SPRING) {
  const per = R.Fspring / S.np; let a = 0, b = S.h0;
  for (let i = 0; i < 50; i++) { const m = (a + b) / 2; if (almen(m, S) < per) a = m; else b = m; }
  const sc = (a + b) / 2, sMax = 0.75 * S.h0, ns = Math.ceil(S.stroke / Math.max(0.01, sMax - sc)), su = sc + S.stroke / ns;
  const Fu = S.np * almen(su, S), l0g = S.h0 + S.np * S.t, L0 = ns * l0g, Lc = L0 - ns * sc, Lu = Lc - S.stroke, Fp = 1.1 * Fu;
  const Ap = Fp / S.p, Dp = Math.sqrt(4 * Ap / Math.PI + S.dRod ** 2), FpCalc = R.pUnclamp * R.Apiston;
  const curve = []; for (let x = -2; x <= S.stroke + 1e-9; x += 0.25) curve.push([x, S.np * almen(Math.max(0, sc + x / ns), S) / 1000]);
  return { S, sc, su, ns, n: ns * S.np, Fc: S.np * almen(sc, S), Fu, rise: Fu / (S.np * almen(sc, S)) - 1, l0g, L0, Lc, Lu, Fp, Ap, Dp, FpCalc, curve, F075: almen(sMax, S) };
}

/* ------------------------------------------------------------------ assembly geometry (r, x) – shared by 2D and 3D.  x = 0 at the nose, towards the rear */
export function spAsmGeom(g, M, PK) {
  const G = { g, M, PK }, hF = (M.DF - M.dF) / 2 * 0.36, sF = g.segs[1], th1 = g.segs[2], th2 = g.segs[7];
  // shaft contour (outer up, inner back) - spring bore: from spGeom if it has one, otherwise an assumed bore (marked "assumed")
  const sb = g.inner.find((q) => /spring/i.test(q.k + " " + q.n));
  G.springBore = sb ? { x0: sb.x0, x1: sb.x1, r: sb.d0 / 2, assumed: false } : { x0: 290, x1: 290 + PK.Lc + 4, r: (PK.S.De + 1) / 2, assumed: true };
  const out = []; g.segs.forEach((s) => { out.push([s.d / 2, s.x0], [s.d / 2, s.x1]); });
  const inn = []; g.inner.forEach((q) => { inn.push([q.d0 / 2, q.x0], [q.d1 / 2, q.x1]); });
  const B = G.springBore, inner2 = inn;
  // insert spring bore into the inner profile (only where the drawbar bore is)
  const innerFinal = []; for (let i = 0; i < inner2.length; i += 2) { const [r0, x0] = inner2[i], [r1, x1] = inner2[i + 1];
    if (B.x0 >= x0 && B.x1 <= x1 && r0 === r1 && !sb) innerFinal.push([r0, x0], [r0, B.x0], [B.r, B.x0], [B.r, B.x1], [r0, B.x1], [r1, x1]); else innerFinal.push([r0, x0], [r1, x1]); }
  G.shaft = [...out, ...innerFinal.slice().reverse()];
  G.bearings = g.bearings.map((b) => { const h = (b.D - b.d) / 2 * 0.36; return { ...b, h, ri: [b.d / 2, b.d / 2 + h], ro: [b.D / 2 - h, b.D / 2], rb: (b.d + b.D) / 4, Dw: (b.D - b.d) * 0.3, z: Math.floor(Math.PI * (b.d + b.D) / 2 / ((b.D - b.d) * 0.3 * 1.25)) }; });
  const b2 = G.bearings[1], b3 = G.bearings[2];
  G.spIn = { x0: b2.x0 + b2.B, x1: b3.x0, r0: M.dF / 2, r1: M.dF / 2 + hF }; G.spOut = { x0: b2.x0 + b2.B, x1: b3.x0, r0: M.DF / 2 - hF, r1: M.DF / 2 };
  G.nutF = { x0: th1.x0 + 1, x1: th1.x1, r0: M.dF / 2, r1: M.dF / 2 + 14 }; G.nutR = { x0: th2.x0, x1: th2.x1, r0: M.dR / 2, r1: M.dR / 2 + 12 };
  const rs = g.segs[4], H = g.hsg; G.rotorOD = H.statorD - 52;
  G.rotor = { x0: rs.x0, x1: rs.x1, r0: M.dRot / 2, r1: G.rotorOD / 2 };
  G.stator = { x0: rs.x0, x1: rs.x1, r0: G.rotorOD / 2 + 1, r1: H.statorD / 2 }; G.wind = [{ x0: rs.x0 - 15, x1: rs.x0, r0: G.rotorOD / 2 + 4, r1: H.statorD / 2 - 4 }, { x0: rs.x1, x1: rs.x1 + 15, r0: G.rotorOD / 2 + 4, r1: H.statorD / 2 - 4 }];
  const Ro = H.Dout / 2, rF = M.DF / 2, rsl = H.statorD / 2 + 8, rR = H.boreR / 2, xF = sF.x0, xS = sF.x1 + 20, xR = g.segs[6].x0 - 8, xE = xR + 85;
  G.hsgF = [[rF, xF], [Ro, xF], [Ro, xS], [rF - 3, xS], [rF - 3, sF.x1], [rF, sF.x1]];
  G.hsgM = [[rsl, xS], [Ro, xS], [Ro, xE], [rR, xE], [rR, xR], [rsl, xR]];
  G.sleeve = { x0: xS + 10, x1: xR - 4, r0: H.statorD / 2, r1: rsl }; G.orings = [xS + 16, xR - 10];
  G.coverF = [[g.segs[0].d / 2 + 0.25, 0], [Ro, 0], [Ro, xF], [g.segs[0].d / 2 + 0.25, xF]];
  G.sleeveR = { x0: G.bearings[4].x0 - 5, x1: G.bearings[5].x0 + G.bearings[5].B + 5, r0: M.DR / 2, r1: rR };
  G.coverR = { x0: xE, x1: xE + 13, r0: M.dR / 2 - 28, r1: Ro };
  const rp = PK.Dp / 2; G.cyl = { body: { x0: xE + 15, x1: xE + 80, r0: rp, r1: rp + 12 }, end: { x0: xE + 80, x1: xE + 90, r0: 8, r1: rp + 12 }, piston: { x0: xE + 33, x1: xE + 48, r0: PK.S.dRod / 2 - 6, r1: rp } };
  G.bar = { x0: 62, x1: g.L + 8, r: 8 }; G.head = { x0: 52, x1: 62, r: 15 }; G.collet = { x0: 34, x1: 60, r0: 8, r1: 17 };
  G.xE = xE; G.Lall = xE + 90; G.Ro = Ro; G.xS = xS; G.xR = xR;
  // springs: groups of np in parallel, ns groups in series (alternating), clamped state
  const S = PK.S, gl = S.np * S.t + S.h0 - PK.sc; G.springs = []; for (let i = 0; i < PK.ns; i++) G.springs.push({ x: B.x0 + 2 + i * gl, o: i % 2 ? 1 : -1, gl });
  return G;
}

/* ------------------------------------------------------------------ simulation (assembly record of one spindle) */
function runinSim(M, Feff, F, r) {
  const S = [2000, 4000, 6000, 8000, 10000].filter((n) => n < M.nmax).concat([M.nmax]), Tlim = 25, pf = (Feff / M.Fpre) ** 0.6, C0 = 6 * (F.grease ? 3.6 : 1) * (1 + 0.1 * gauss(r));
  let t = 0, T = 0, i = 0, tS = 0, run = true, chK = 1, stops = 0, last = 0; const tr = [], sp = [], ev = [];
  while (i < S.length && t < 900) {
    const n = run ? S[i] : 0, fr = n / M.nmax, Tss = run ? 14 * fr ** 1.2 * pf + (F.dirt ? 2.5 * fr : 0) : 0, ch = run ? C0 * fr * chK * Math.exp(-tS / 10) : 0;
    T += (Tss + ch - T) / 9; tr.push([t, T]); sp.push([t, n]); t++; tS++;
    if (run && T >= Tlim) { run = false; stops++; chK *= 0.55; ev.push([t, "stop"]); }
    else if (!run && T <= 12) { run = true; tS = 0; }
    else if (run && ((i < S.length - 1 && tS >= 15 && Math.abs(T - last) < 0.06) || tS >= (i === S.length - 1 ? 30 : 60))) { if (i === S.length - 1 && tS < 30) { /* hold */ } else { i++; tS = 0; } }
    last = T;
  }
  const Tmax = Math.max(...tr.map((p) => p[1])), Tend = tr[tr.length - 1][1];
  return { tr, sp, stops, Tmax, Tend, t, Tlim, steps: S, ev };
}
function simulate(M, R, PK, F, seed, ids) {
  const r = rngOf(seed + 517), N = (m, s) => m + s * gauss(r), A = Math.abs, out = {}, add = (k, rows) => { out[k] = rows; }, g = R.g, x = {};
  add("kit", [["Shaft serial (laser, tail face)", ids.shaft, "ok"], ["Front set 4 × 7014 – same set number, V-line continuous", ids.setF, "ok"], ["Rear set 2 × 7012", ids.setR, "ok"], ["Motor kit rotor + stator (same kit number)", ids.motor, "ok"], ["Open NCRs on the parts", "0", "ok"]]);
  const part = Math.round(A(N(90000, 40000))), Troom = N(20.1, 0.25);
  add("clean", [["Particles ≥ 0.5 µm in the room", `${f(part, 0)} /m³ (class 7 limit 352 000 – check)`, part <= 352000 ? "ok" : "bad"], ["Room temperature", `${f(Troom, 1)} °C (20 ±1)`, A(Troom - 20) <= 1 ? "ok" : "bad"], ["Soak time", "≥ 12 h, parts covered", "ok"], ["Filter patch shaft bore", `${f(A(N(0.8, 0.3)), 1)} mg (≤ 2 – example)`, "ok"]]);
  // bearing stand-outs (µm, + = less preload than nominal) and fits
  x.e = [N(1.2, 1.1), N(1.0, 1.1), N(0.9, 1.1), N(1.3, 1.1)]; x.ds = (x.e[0] + x.e[1]) / 2 + (x.e[2] + x.e[3]) / 2;
  x.bore = [0, 1, 2, 3].map(() => -A(N(2.4, 0.6))); x.od = [0, 1, 2, 3].map(() => -A(N(3.0, 0.8))); x.shF = N(0.3, 0.6); x.hbF = N(1.8, 0.7);
  const avg = (a) => a.reduce((p, q) => p + q, 0) / a.length; x.iF = x.shF - avg(x.bore); x.cF = x.hbF - avg(x.od); x.shR = N(0.2, 0.6); x.boreR = -A(N(2.3, 0.6)); x.iR = x.shR - x.boreR; x.cR = N(8, 1.2);
  add("meas", [["Stand-out deviations bearing 1–4", x.e.map((v) => f(v, 1)).join(" / ") + " µm", "info"], ["Bore deviation marks (Δd)", x.bore.map((v) => f(v, 1)).join(" / ") + " µm", "info"],
    ["Front fit shaft − bore (interference)", `${f(x.iF, 1)} µm (0 … +5 – check catalogue)`, x.iF >= 0 && x.iF <= 5 ? "ok" : "bad"], ["Front housing bore − OD (clearance)", `${f(x.cF, 1)} µm (2 … 8 – check)`, x.cF >= 2 && x.cF <= 8 ? "ok" : x.cF >= 0 ? "warn" : "bad"],
    ["Rear fit shaft − bore", `${f(x.iR, 1)} µm (0 … +5)`, x.iR >= 0 && x.iR <= 5 ? "ok" : "bad"], ["Floating sleeve − rear OD (clearance)", `${f(x.cR, 1)} µm (5 … 12 – check)`, x.cR >= 5 && x.cR <= 12 ? "ok" : "bad"]]);
  x.dsAct = F.spacer ? x.ds + 6 : x.ds + N(0, 0.35); x.eps = x.dsAct - x.ds;   // ε = Δs(actual) − Δs(required); + = more preload in a DB set (Lo − Li too big / inner spacer too short) – guide 19 §4.1
  x.d0 = 8; x.Feff = M.Fpre * Math.max(0.05, 1 + x.eps / x.d0) ** 1.5 * (F.mix ? 2.2 : 1);
  add("spacer", [["Required Lo − Li (Σ of the 2 tandem pairs)", `${f(x.ds, 1)} µm`, "info"], ["Ground spacers: Lo − Li measured", `${f(x.dsAct, 1)} µm (target ${f(x.ds, 1)} ±1)`, A(x.eps) <= 1 ? "ok" : "bad"], ["Parallelism of the spacer faces", `${f(A(N(0.5, 0.2)), 1)} µm (≤ 1)`, "ok"],
    ["→ preload expected", `${f(x.Feff / (F.mix ? 2.2 : 1), 0)} N per bearing (target ${M.Fpre})`, A(x.eps) <= 1 ? "ok" : "bad"]]);
  const vF = 0.15 * Math.PI / 4 * (M.DF ** 2 - M.dF ** 2) * M.BF / 1000, vR = 0.15 * Math.PI / 4 * (M.DR ** 2 - M.dR ** 2) * M.BR / 1000; x.gF = 0.15 * vF * 0.9; x.gR = 0.15 * vR * 0.9;
  add("grease", F.grease ? [["Grease per front bearing", "not weighed – by eye (≈ 3 × too much)", "warn"], ["Grease per rear bearing", "not weighed", "warn"]] : [["Grease per front bearing (7014)", `${f(x.gF * N(1, 0.02), 2)} g (target ${f(x.gF, 2)} ±5 %)`, "ok"], ["Grease per rear bearing (7012)", `${f(x.gR * N(1, 0.02), 2)} g (target ${f(x.gR, 2)} ±5 %)`, "ok"], ["Distributed both sides, turned by hand", "yes", "ok"]]);
  const Th = N(72, 3); add("front", [["Inner ring temperature at mounting", `${f(Th, 0)} °C (60–80, never > 110)`, Th <= 110 ? "ok" : "bad"], ["V-line on the outer rings", F.mix ? "BROKEN at bearing 3 – reversed" : "continuous, points to the nose", F.mix ? "bad" : "ok"], ["Seated after cooling (axial press, no movement)", "yes", "ok"]]);
  x.nr0 = A(N(5, 1.8)) + 1.5; x.nr1 = F.nut ? x.nr0 : A(N(1.0, 0.4)); x.Tf = 0.15 + 0.35 * x.Feff / M.Fpre * N(1, 0.05);
  add("nut", [["Nut tightening", "seat 2× torque, loosen, final torque – marked", "ok"], ["Nut face runout before correction", `${f(x.nr0, 1)} µm`, "info"], ["Nut face runout after correction", `${f(x.nr1, 1)} µm (≤ 2)${F.nut ? " – NOT corrected" : ""}`, x.nr1 <= 2 ? "ok" : "bad"], ["Friction torque of the front set (preload check)", `${f(x.Tf, 2)} N·m (0.35–0.70 – example)`, x.Tf >= 0.35 && x.Tf <= 0.7 ? "ok" : "bad"]]);
  const dTh = 0.02 / (11.5e-6 * M.DF); add("fbh", [["Bearing housing heated", `+${f(dTh + N(4, 1), 0)} K (bore grows ${f(11.5e-6 * M.DF * 20 * 1000, 0)} µm at +20 K)`, "ok"], ["Outer rings seated, axial play", `${f(A(N(0.3, 0.2)), 1)} µm (≤ 1)`, "ok"]]);
  x.iRot = F.rotor ? N(0.028, 0.003) : N(M.dRotI, 0.004); const Trot = R.Trot + N(0, 4);
  add("rotor", [["Rotor interference seat − bore", `${f(x.iRot, 3)} mm (${f(M.dRotI - 0.015, 3)} … ${f(M.dRotI + 0.015, 3)})`, x.iRot >= M.dRotI - 0.015 && x.iRot <= M.dRotI + 0.015 ? "ok" : "warn"], ["Rotor temperature at mounting", `${f(Trot, 0)} °C (calc. ${f(R.Trot, 0)} °C – check magnet limit)`, "ok"], ["Rotor against the shoulder", `${f(A(N(0.02, 0.01)), 2)} mm gap (≤ 0.05)`, "ok"]]);
  x.rr = A(N(1.1, 0.4)); add("rear", [["Rear nut face runout after correction", `${f(x.rr, 1)} µm (≤ 2)`, x.rr <= 2 ? "ok" : "bad"], ["Tail / encoder seat runout", `${f(A(N(1.5, 0.6)), 1)} µm (≤ 3)`, "ok"], ["Floating sleeve slides by hand", "yes", "ok"]]);
  x.L0 = PK.L0 + N(0, 0.15) + (F.spring ? 2 * PK.S.t : 0); x.Fpk = PK.Fc * N(1.01, 0.02) * (F.spring ? 0.6 : 1);
  add("draw", [["Number of springs / stacking", `${PK.n} = ${PK.ns} groups × ${PK.S.np} in parallel`, "info"], ["Free pack length L0", `${f(x.L0, 1)} mm (calc. ${f(PK.L0, 1)} ±0.5)`, A(x.L0 - PK.L0) <= 0.5 ? "ok" : "warn"], ["Spring force at clamped length (tool J6)", `${f(x.Fpk / 1000, 2)} kN (≥ ${f(R.Fspring / 1000, 2)})`, x.Fpk >= R.Fspring * 0.97 ? "ok" : "bad"]]);
  const ang = () => r() * 360; x.U0 = [[A(N(70, 25)), ang()], [A(N(55, 20)), ang()]]; x.U1 = [[A(N(0.3, 0.12)) * R.UperPlane, ang()], [A(N(0.3, 0.12)) * R.UperPlane, ang()]]; x.rc = 38;
  add("balance", [["Initial unbalance plane 1 / 2", `${f(x.U0[0][0], 0)} g·mm ∠${f(x.U0[0][1], 0)}° / ${f(x.U0[1][0], 0)} g·mm ∠${f(x.U0[1][1], 0)}°`, "info"], ["Correction masses at r = 38 mm", `${f(x.U0[0][0] / x.rc, 2)} g ∠${f((x.U0[0][1] + 180) % 360, 0)}° / ${f(x.U0[1][0] / x.rc, 2)} g ∠${f((x.U0[1][1] + 180) % 360, 0)}°`, "info"],
    ["Residual unbalance plane 1 / 2", `${f(x.U1[0][0], 1)} / ${f(x.U1[1][0], 1)} g·mm (≤ ${f(R.UperPlane, 1)} each)`, Math.max(x.U1[0][0], x.U1[1][0]) <= R.UperPlane ? "ok" : "bad"]]);
  x.drop = F.oring ? N(1.4, 0.2) : A(N(0.03, 0.02)); x.ins = A(N(800, 300)) + 200;
  add("stator", [["Pressure test cooling jacket 1.5 × p, 15 min", `drop ${f(x.drop, 2)} bar (≤ 0.1)${F.oring ? " – water at the O-ring" : ""}`, x.drop <= 0.1 ? "ok" : "bad"], ["Insulation resistance 500 V DC", `${f(x.ins, 0)} MΩ (≥ 100 – example, check motor maker)`, "ok"], ["Winding resistance U-V / V-W / W-U", `balance ${f(A(N(0.6, 0.3)), 1)} % (≤ 2)`, "ok"]]);
  x.gap = [0, 1, 2, 3].map(() => 1 + N(0, 0.04)); add("insert", [["Air gap rotor ↔ stator (4 positions)", x.gap.map((v) => f(v, 2)).join(" / ") + " mm (even ±0.1)", "ok"], ["Turning torque by hand", `${f(x.Tf + 0.1, 2)} N·m, even, no noise`, x.Tf <= 0.7 ? "ok" : "warn"]]);
  x.lab = [0, 1, 2, 3].map(() => 0.25 + N(0, 0.015)); add("cover", [["Labyrinth gap (4 positions)", x.lab.map((v) => f(v, 2)).join(" / ") + " mm (0.20–0.30)", x.lab.every((v) => v >= 0.2 && v <= 0.3) ? "ok" : "bad"], ["Sealing air at the labyrinth", "even all round", "ok"], ["Floating sleeve axial movement", `${f(A(N(60, 15)), 0)} N to move (≤ 150 – example)`, "ok"]]);
  x.pRel = PK.Fc * (F.spring ? 0.6 : 1) / (Math.PI / 4 * (PK.Dp ** 2 - PK.S.dRod ** 2)) * N(1.05, 0.02); x.stroke = PK.S.stroke + N(0, 0.08); x.eject = N(0.5, 0.05);
  add("unclamp", [["Pressure where the drawbar starts to move", `${f(x.pRel, 2)} MPa (calc. ${f(PK.Fc / (Math.PI / 4 * (PK.Dp ** 2 - PK.S.dRod ** 2)), 2)}; supply ${PK.S.p})`, x.pRel < PK.S.p ? "ok" : "bad"], ["Drawbar stroke clamped → unclamped", `${f(x.stroke, 2)} mm (${PK.S.stroke} ±0.2)`, A(x.stroke - PK.S.stroke) <= 0.2 ? "ok" : "bad"], ["Tool ejection at the nose", `${f(x.eject, 2)} mm (0.4–0.6 – check clamping set)`, "ok"]]);
  x.Fcl = [0, 1, 2].map(() => M.Fclamp * N(1.03, 0.025) * (F.spring ? 0.6 : 1)); x.FclM = x.Fcl.reduce((a, b) => a + b, 0) / 3;
  add("clamp", [["Clamping force 3 × (mean)", `${x.Fcl.map((v) => f(v, 1)).join(" / ")} → ${f(x.FclM, 1)} kN (${f(M.Fclamp * 0.9, 1)} … ${f(M.Fclamp * 1.15, 1)})`, x.FclM >= M.Fclamp * 0.9 && x.FclM <= M.Fclamp * 1.15 ? "ok" : "bad"], ["Clamp sensor: unclamped / with tool / without tool", "3 positions switch correctly", "ok"], ["Tool ejected at unclamp", "yes", "ok"]]);
  add("sensors", [["PT100 front bearings / stator at 20 °C", `${f(N(20.2, 0.2), 1)} / ${f(N(20.3, 0.2), 1)} °C`, "ok"], ["Vibration sensor signal", "OK (tap test)", "ok"], ["Encoder amplitude A / B", `${f(N(1.0, 0.03), 2)} / ${f(N(1.0, 0.03), 2)} Vpp (0.8–1.2 – check)`, "ok"], ["Cables labelled + fixed", "yes", "ok"]]);
  x.ri = runinSim(M, x.Feff, F, r);
  add("runin", [["Max. temperature rise (front bearings)", `${f(x.ri.Tmax, 1)} K (stop limit ${x.ri.Tlim})`, x.ri.stops === 0 ? "ok" : x.ri.stops <= 2 && !F.mix && !F.spacer ? "warn" : "bad"], ["Stops (temperature) / run-in time", `${x.ri.stops} / ${f(x.ri.t / 60, 1)} h`, x.ri.stops === 0 ? "ok" : x.ri.stops <= 2 && !F.mix && !F.spacer ? "warn" : "bad"], ["Stable rise at nmax", `${f(x.ri.Tend, 1)} K (≤ 20)`, x.ri.Tend <= 20 ? "ok" : "bad"], ["Noise during run-in", F.dirt ? "rumbling, irregular" : "smooth", F.dirt ? "bad" : "ok"]]);
  x.tr = A(N(0.9, 0.3)) + (F.nut ? 0.35 * x.nr0 : 0); x.tr300 = A(N(2.4, 0.7)) + (F.nut ? 1.1 * x.nr0 : 0) + (F.mix ? 1.5 : 0);
  x.kax = M.cax * (x.Feff / (F.mix ? 2.2 : 1) / M.Fpre) ** (1 / 3) * (F.mix ? 0.6 : 1) * N(1, 0.04); x.krad = 200 * (x.Feff / (F.mix ? 2.2 : 1) / M.Fpre) ** (1 / 3) * (F.mix ? 0.75 : 1) * N(1, 0.05);
  x.grow = R.dLnose * 1000 + N(5, 1.2) + (x.Feff / M.Fpre - 1) * 4; x.shift = F.rotor ? N(28, 5) : A(N(1.2, 0.6));
  x.vib = A(N(0.42, 0.08)) + (F.dirt ? 1.1 : 0) + (F.rotor ? 0.9 : 0) + (F.mix ? 0.3 : 0); x.noise = N(68, 1.5) + (F.dirt ? 9 : 0); x.Fcl2 = x.FclM * N(1, 0.01);
  add("test", [["Taper runout (near the nose)", `${f(x.tr, 1)} µm (≤ 2 – example, check ISO 10791-1 / contract)`, x.tr <= 2 ? "ok" : "bad"], ["Runout at 300 mm (test mandrel)", `${f(x.tr300, 1)} µm (≤ 5 – example)`, x.tr300 <= 5 ? "ok" : "bad"],
    ["Axial stiffness", `${f(x.kax, 0)} N/µm (≥ ${f(0.85 * M.cax, 0)} = 0.85 × design)`, x.kax >= 0.85 * M.cax ? "ok" : "bad"], ["Radial stiffness at the nose", `${f(x.krad, 0)} N/µm (≥ 170 – example design value)`, x.krad >= 170 ? "ok" : "bad"],
    ["Thermal growth at the nose, 60 min nmax", `${f(x.grow, 1)} µm (≤ 15 – example)`, x.grow <= 15 ? "ok" : "bad"], ["Vibration velocity at nmax", `${f(x.vib, 2)} mm/s RMS (≤ 1.0 – example)`, x.vib <= 1 ? "ok" : "bad"],
    ["Unbalance change after run-in", `${f(x.shift, 1)} g·mm (≤ ${f(R.UperPlane, 1)})`, x.shift <= R.UperPlane ? "ok" : "bad"], ["Noise at 1 m", `${f(x.noise, 0)} dB(A) (≤ 75 – example)`, x.noise <= 75 ? "ok" : "bad"], ["Clamping force re-check", `${f(x.Fcl2, 1)} kN`, x.Fcl2 >= M.Fclamp * 0.9 ? "ok" : "bad"]]);
  add("pack", [["Assembly record", "complete, signed", "ok"], ["Transport lock + preservation", "fitted", "ok"]]);
  const fails = [], warns = []; STEPS.forEach((st, i) => out[st.k].forEach((y) => { if (y[2] === "bad") fails.push({ i, l: y[0] }); else if (y[2] === "warn") warns.push({ i, l: y[0] }); }));
  return { out, fails, warns, x };
}

/* ------------------------------------------------------------------ 2D: section of the spindle (nose down on J1 or nose up on J8) */
function section(si, u, ctx, labMax = 494) {
  const s = STEPS[si], G = ctx.G, up = s.ori === "u", K = up ? 0.76 : 0.82, cx = 250, Yx = up ? (x) => 62 + x * K : (x) => 470 - x * K, X = (r) => cx + r * K;
  const vis = new Set(); STEPS.slice(0, si + 1).forEach((q) => (q.add || []).forEach((p) => vis.add(p)));
  const unitParts = ["shaft", "brgF", "spF", "nutF", "hsgF", "rotor", "brgR", "nutR", "bar", "springs"];
  if (si >= SI.front) vis.add("shaft");
  if (vis.has("unit")) unitParts.forEach((p) => vis.add(p));
  if (s.k === "stator") unitParts.forEach((p) => vis.delete(p));
  const newest = new Set((s.add || []).filter((p) => !(s.fix || []).includes(p))); if (newest.has("unit")) unitParts.forEach((p) => newest.add(p));
  const travel = (1 - ease(Math.min(1, u * 1.6))) * (s.k === "insert" ? 260 : 110) * (s.from || -1);
  const oy = (p) => (newest.has(p) ? ((s.below || []).includes(p) ? -travel : travel) : 0);
  const lab = [];
  const rr = (x0, x1, r0, r1, fill, dy, st = "#333", op = 1) => { const ya = Yx(x0) + dy, yb = Yx(x1) + dy, y = Math.min(ya, yb), h = Math.abs(yb - ya);
    return `<rect x="${X(r0)}" y="${y}" width="${(r1 - r0) * K}" height="${h}" fill="${fill}" stroke="${st}" stroke-width=".6" opacity="${op}"/><rect x="${2 * cx - X(r1)}" y="${y}" width="${(r1 - r0) * K}" height="${h}" fill="${fill}" stroke="${st}" stroke-width=".6" opacity="${op}"/>`; };
  const poly = (pts, fill, dy, st = "#333") => { const p1 = pts.map(([r, x]) => `${X(r).toFixed(1)},${(Yx(x) + dy).toFixed(1)}`).join(" "), p2 = pts.map(([r, x]) => `${(2 * cx - X(r)).toFixed(1)},${(Yx(x) + dy).toFixed(1)}`).join(" ");
    return `<polygon points="${p1}" fill="${fill}" stroke="${st}" stroke-width=".7"/><polygon points="${p2}" fill="${fill}" stroke="${st}" stroke-width=".7"/>`; };
  const L = (p, x, r, t) => { if (vis.has(p)) lab.push({ y: Yx(x) + oy(p), xa: X(r), t, nw: newest.has(p) }); };
  let o = open(`Step ${si + 1} · ${s.n} (section${up ? ", nose up" : ", nose down on J1"}, jigs in blue)`, `spindle ${ctx.ids.spu}`);
  o += `<line x1="${cx}" y1="30" x2="${cx}" y2="492" stroke="var(--text-2)" stroke-dasharray="8 3 2 3" stroke-width=".7"/>`;
  // static first, then moving
  if (vis.has("hsgM")) { o += poly(G.hsgM, C.hsg, oy("hsgM")); L("hsgM", (G.xS + G.xR) / 2 + 60, G.Ro, "Motor housing"); }
  if (vis.has("sleeve")) { const S = G.sleeve; o += rr(S.x0, S.x1, S.r0, S.r1, C.sleeve, oy("sleeve")); for (let xx = S.x0 + 10; xx < S.x1 - 8; xx += 14) o += rr(xx, xx + 6, S.r1 - 3, S.r1, "#3d6f9e", oy("sleeve"), "none");
    G.orings.forEach((xo) => { o += `<circle cx="${X(G.sleeve.r1)}" cy="${Yx(xo) + oy("sleeve")}" r="2.4" fill="${C.oring}"/><circle cx="${2 * cx - X(G.sleeve.r1)}" cy="${Yx(xo) + oy("sleeve")}" r="2.4" fill="${C.oring}"/>`; });
    L("sleeve", (S.x0 + S.x1) / 2 - 40, S.r1, "Cooling sleeve (grooves) + O-rings"); }
  if (vis.has("stator")) { const S = G.stator; o += rr(S.x0, S.x1, S.r0, S.r1, C.stator, oy("stator")); G.wind.forEach((w) => { o += rr(w.x0, w.x1, w.r0, w.r1, C.copper, oy("stator")); }); L("stator", (S.x0 + S.x1) / 2, S.r1, "Stator (laminations + winding)"); }
  if (vis.has("sleeveR")) { const S = G.sleeveR; o += rr(S.x0, S.x1, S.r0, S.r1, C.cover, oy("sleeveR")); L("sleeveR", S.x0, S.r1, "Floating sleeve (rear bearings slide)"); }
  if (vis.has("coverR")) { const S = G.coverR; o += rr(S.x0, S.x1, S.r0, S.r1, C.cover, oy("coverR")); }
  if (vis.has("cyl")) { const Q = G.cyl, dyc = oy("cyl"), pist = s.k === "unclamp" || s.k === "clamp" ? (s.k === "unclamp" ? Math.max(0, Math.sin(Math.min(1, u * 1.4) * Math.PI)) : (u > 0.3 && u < 0.5 ? 1 : 0)) * ctx.PK.S.stroke : 0;
    o += rr(Q.body.x0, Q.body.x1, Q.body.r0, Q.body.r1, C.cyl, dyc) + rr(Q.end.x0, Q.end.x1, Q.end.r0, Q.end.r1, C.cyl, dyc) + rr(Q.piston.x0 - pist, Q.piston.x1 - pist, Q.piston.r0, Q.piston.r1, "#c2cad2", dyc);
    L("cyl", Q.body.x1 - 10, Q.body.r1, `Unclamp cylinder, piston Ø${f(ctx.PK.Dp, 0)}`); }
  // shaft unit
  const drawUnit = () => {
    let u2 = "";
    if (vis.has("shaft")) { u2 += poly(G.shaft, C.shaft, oy("shaft")); G.g.segs.filter((q) => q.thread).forEach((q) => { for (let xx = q.x0 + 2; xx < q.x1; xx += 3) u2 += `<line x1="${X(q.d / 2 - 1.5)}" y1="${Yx(xx) + oy("shaft")}" x2="${X(q.d / 2)}" y2="${Yx(xx) + oy("shaft")}" stroke="#555" stroke-width=".5"/><line x1="${2 * cx - X(q.d / 2 - 1.5)}" y1="${Yx(xx) + oy("shaft")}" x2="${2 * cx - X(q.d / 2)}" y2="${Yx(xx) + oy("shaft")}" stroke="#555" stroke-width=".5"/>`; });
      L("shaft", 10, 60, `Shaft ${ctx.ids.shaft} (HSK-A63 taper)`); }
    if (vis.has("hsgF")) { u2 += poly(G.hsgF, C.hsgF, oy("hsgF")); L("hsgF", (G.hsgF[0][1] + G.hsgF[2][1]) / 2, G.Ro, "Front bearing housing"); }
    G.bearings.forEach((b, i) => { const p = b.set === "front" ? "brgF" : "brgR"; if (!vis.has(p)) return; const dy = oy(p) + (newest.has(p) && b.set === "front" ? (3 - i) * travel * 0.15 : 0);
      u2 += rr(b.x0, b.x0 + b.B, b.ri[0], b.ri[1], C.ring, dy) + rr(b.x0, b.x0 + b.B, b.ro[0], b.ro[1], C.ring, dy);
      const yc = Yx(b.x0 + b.B / 2) + dy, a = 15 * RAD, dirn = (up ? -1 : 1) * b.dir, l = b.Dw * K * 0.95;
      [1, -1].forEach((sd) => { const xc = cx + sd * b.rb * K; u2 += `<circle cx="${xc}" cy="${yc}" r="${b.Dw / 2 * K}" fill="${C.ball}"/><line x1="${xc - sd * Math.cos(a) * l}" y1="${yc - Math.sin(a) * l * dirn}" x2="${xc + sd * Math.cos(a) * l}" y2="${yc + Math.sin(a) * l * dirn}" stroke="#e05030" stroke-width="1.1"/>`; });
      if (ctx.F.mix && b.set === "front" && i === 2) u2 += `<text x="${X(b.ro[1]) + 3}" y="${yc + 3}" class="apc-t" style="fill:var(--critical);font-weight:700">⟲ reversed!</text>`; });
    L("brgF", G.bearings[1].x0 + 10, G.bearings[1].ro[1], `Front set 4 × 7014 TBT (${ctx.ids.setF.split(" ")[0]})`); L("brgR", G.bearings[4].x0 + 18, G.bearings[4].ro[1], "Rear set 2 × 7012 DB (floating)");
    if (vis.has("spF")) { u2 += rr(G.spIn.x0, G.spIn.x1, G.spIn.r0, G.spIn.r1, C.spacer, oy("spF")) + rr(G.spOut.x0, G.spOut.x1, G.spOut.r0, G.spOut.r1, C.spacer, oy("spF")); L("spF", (G.spIn.x0 + G.spIn.x1) / 2, G.spOut.r1, "Inner + outer spacer (ground pair)"); }
    if (vis.has("nutF")) { const q = G.nutF; u2 += rr(q.x0, q.x1, q.r0, q.r1, C.nut, oy("nutF")); L("nutF", (q.x0 + q.x1) / 2, q.r1, "Front precision lock nut M70×1.5"); }
    if (vis.has("rotor")) { const q = G.rotor, hot = s.k === "rotor" && u < 0.65; u2 += rr(q.x0, q.x1, q.r0, q.r1, hot ? C.hot : C.rotor, oy("rotor")); for (let xx = q.x0 + 8; xx < q.x1; xx += 8) u2 += `<line x1="${X(q.r0 + 3)}" y1="${Yx(xx) + oy("rotor")}" x2="${X(q.r1)}" y2="${Yx(xx) + oy("rotor")}" stroke="#4b6440" stroke-width=".4"/><line x1="${2 * cx - X(q.r0 + 3)}" y1="${Yx(xx) + oy("rotor")}" x2="${2 * cx - X(q.r1)}" y2="${Yx(xx) + oy("rotor")}" stroke="#4b6440" stroke-width=".4"/>`;
      L("rotor", (q.x0 + q.x1) / 2 + 30, q.r1, hot ? `Rotor sleeve – hot ≈ ${f(ctx.R.Trot, 0)} °C` : "Rotor sleeve (shrink fit)"); }
    if (vis.has("nutR")) { const q = G.nutR; u2 += rr(q.x0, q.x1, q.r0, q.r1, C.nut, oy("nutR")); L("nutR", q.x1, q.r1, "Rear lock nut M60×1.5"); }
    if (vis.has("bar")) { const dyb = oy("bar"), shift = (s.k === "unclamp" ? Math.max(0, Math.sin(Math.min(1, u * 1.4) * Math.PI)) : s.k === "clamp" ? (u > 0.3 && u < 0.5 ? 1 : 0) : 0) * ctx.PK.S.stroke;
      u2 += rr(G.bar.x0 - shift, G.bar.x1 - shift, 0, G.bar.r, C.bar, dyb) + rr(G.head.x0 - shift, G.head.x1 - shift, 0, G.head.r, C.bar, dyb) + rr(G.collet.x0 - shift, G.collet.x1 - shift, G.collet.r0, G.collet.r1, "#9b8fb0", dyb);
      L("bar", G.bar.x1 - 30, 10, "Drawbar + HSK clamping set (collet)"); }
    if (vis.has("springs")) { const dyb = oy("springs"), S = ctx.PK.S, sb = G.springBore, gl0 = G.springs[0] ? G.springs[0].gl : 3, comp = (s.k === "unclamp" ? Math.max(0, Math.sin(Math.min(1, u * 1.4) * Math.PI)) : 0) * S.stroke / ctx.PK.ns;
      G.springs.forEach((sp, i) => { const gl = gl0 - comp, xx = sb.x0 + 2 + i * gl; for (let j = 0; j < S.np; j++) { const xa = xx + j * S.t; [1, -1].forEach((sd) => { const xi = cx + sd * S.Di / 2 * K, xo = cx + sd * S.De / 2 * K, ya = Yx(xa + (sp.o > 0 ? 0 : S.h0 - ctx.PK.sc)) + dyb, yb = Yx(xa + (sp.o > 0 ? S.h0 - ctx.PK.sc : 0)) + dyb;
        u2 += `<line x1="${xi}" y1="${ya}" x2="${xo}" y2="${yb}" stroke="${ctx.F.spring && i % 5 === 2 ? "#d02020" : C.spring}" stroke-width="${Math.max(1, S.t * K * 0.8)}"/>`; }); } });
      L("springs", sb.x0 + 40, sb.r, `Disc-spring pack ${ctx.PK.n} × (${ctx.PK.ns} in series × ${S.np})${sb.assumed ? " – spring bore Ø" + f(sb.r * 2, 0) + " assumed" : ""}`); }
    return u2;
  };
  o += drawUnit();
  if (vis.has("coverF")) { o += poly(G.coverF, C.cover, oy("coverF")); L("coverF", 12, G.Ro, "Front cover + labyrinth (gap 0.2–0.3)"); }
  if (vis.has("sens")) { const dy = oy("sens"), dot = (r, x, c, t) => { o += `<rect x="${X(r) - 4}" y="${Yx(x) + dy - 4}" width="8" height="8" fill="${c}" stroke="#333"/>`; lab.push({ y: Yx(x) + dy, xa: X(r) + 4, t, nw: true }); };
    dot(G.Ro, 60, C.sensor, "PT100 front bearings"); dot(G.Ro, (G.xS + G.xR) / 2, C.sensor, "Vibration sensor"); dot(G.stator.r1 - 6, G.stator.x0 + 20, "#d04040", "KTY / PT in the winding"); dot(G.cyl.body.r1, G.cyl.body.x0 + 20, "#40a040", "Clamp position sensor"); dot(G.nutR.r1 + 4, G.g.segs[8].x0 + 20, "#4060d0", "Encoder (tail)"); }
  if (vis.has("lock")) { const dy = oy("lock"); o += `<rect x="${X(-62)}" y="${Yx(0) + dy - 22}" width="${124 * K}" height="22" rx="4" fill="${JC}" opacity=".85"/>`; lab.push({ y: Yx(0) + dy - 11, xa: X(62), t: "Transport cap on the nose + taper cover", nw: true }); }
  o += overlay(s.k, u, ctx, { X, Yx, cx, K, up });
  // labels: right column, no overlap
  lab.sort((a, b) => a.y - b.y); let yl = 34; lab.forEach((l) => { l.yy = Math.max(yl, l.y); yl = l.yy + 14; });
  if (labMax < 494) { lab.splice(0, lab.length, ...lab.filter((l) => l.y <= labMax)); yl = 34; lab.forEach((l) => { l.yy = Math.max(yl, l.y); yl = l.yy + 14; }); }
  if (lab.length && lab[lab.length - 1].yy > labMax) { const sh = lab[lab.length - 1].yy - labMax; lab.forEach((l) => { l.yy -= sh; }); for (let i = 1; i < lab.length; i++) if (lab[i].yy - lab[i - 1].yy < 14) lab[i].yy = lab[i - 1].yy + 14; }
  lab.forEach((l) => { o += `<line x1="${l.xa}" y1="${l.y}" x2="372" y2="${l.yy}" stroke="var(--text-2)" stroke-width=".5"/><text x="376" y="${l.yy + 3.5}" class="apc-t" style="${l.nw ? "font-weight:700;fill:var(--accent)" : ""}">${esc(l.t)}</text>`; });
  return o + `</svg>`;
}

/* ------------------------------------------------------------------ jigs + devices per step (blue) */
function overlay(k, u, ctx, T) {
  const { X, Yx, cx, K } = T, G = ctx.G, rec = ctx.rec, R = ctx.R, M = ctx.M, PK = ctx.PK, d = (1 - ease(Math.min(1, u * 1.6))) * 110;
  const lb = (x, y, t, st = "") => t.split("|").map((l, i) => `<text x="${x}" y="${y + i * 14}" class="apc-t" style="fill:${JC};font-weight:600;${st}">${esc(l)}</text>`).join("");
  const dial = (x, y, val) => `<circle cx="${x}" cy="${y}" r="9" fill="var(--surface)" stroke="${JC}" stroke-width="2"/><line x1="${x}" y1="${y}" x2="${x + 5}" y2="${y - 6}" stroke="${JC}"/>${val ? `<text x="${x - 12}" y="${y - 13}" class="apc-t" style="font-size:10px">${esc(val)}</text>` : ""}`;
  const stand = () => `<rect x="${cx - 120}" y="${Yx(0) + 2}" width="240" height="10" fill="${JC}"/><rect x="${cx - 60}" y="${Yx(0) - 4}" width="120" height="6" fill="#d8b070"/><rect x="${cx - 110}" y="${Yx(0) + 12}" width="14" height="${488 - Yx(0) - 12}" fill="${JD}"/><rect x="${cx + 96}" y="${Yx(0) + 12}" width="14" height="${488 - Yx(0) - 12}" fill="${JD}"/>${lb(20, Yx(0) - 28, "J1 vertical stand|(PA nose insert)")}`;
  const heater = (x, y, T0, t) => `<rect x="${x}" y="${y}" width="96" height="70" rx="6" fill="#4a5560"/><rect x="${x + 30}" y="${y - 20}" width="36" height="22" fill="#606b76"/><ellipse cx="${x + 48}" cy="${y - 6}" rx="34" ry="8" fill="none" stroke="${C.hot}" stroke-width="5"/><text x="${x + 10}" y="${y + 40}" class="apc-t" style="fill:#fff;font-weight:700">${esc(T0)}</text>${lb(x, y + 86, t)}`;
  const hook = (x, y) => `<line x1="${x}" y1="28" x2="${x}" y2="${y}" stroke="#555" stroke-width="2"/><path d="M${x - 6},${y} q6,10 12,0" fill="none" stroke="#555" stroke-width="3"/>`;
  switch (k) {
    case "front": { const Th = 20 + 52 * Math.min(1, u * 2.5); return stand() + heater(20, 150, `${f(Th, 0)} °C`, "E9 induction heater|≤ 110 °C") + `<rect x="${X(M.dF / 2 + 0.5)}" y="${Yx(130) - d - 60}" width="${8 * K}" height="60" fill="${JC}" opacity=".85"/><rect x="${2 * cx - X(M.dF / 2 + 8.5)}" y="${Yx(130) - d - 60}" width="${8 * K}" height="60" fill="${JC}" opacity=".85"/>${lb(20, Yx(150) - 40, "J2 push sleeve|(inner ring only)")}${lb(20, 365, "V-line on the outer|rings → nose")}`; }
    case "nut": { const ang = (u * 720) % 360, hi = rec.x.nr1; return stand() + `<line x1="${X(G.nutF.r1)}" y1="${Yx(G.nutF.x1) - 2}" x2="${X(G.nutF.r1) + 70}" y2="${Yx(G.nutF.x1) - 30}" stroke="${JC}" stroke-width="3"/>${dial(X(G.nutF.r1) + 76, Yx(G.nutF.x1) - 36, u < 0.5 ? f(rec.x.nr0 * Math.abs(Math.sin(ang * RAD)), 1) + " µm" : f(hi * Math.abs(Math.sin(ang * RAD)), 1) + " µm")}${lb(20, Yx(G.nutF.x1) - 60, "J3 runout fixture|+ 0.1 µm probe")}
      <line x1="${2 * cx - X(G.nutF.r1)}" y1="${Yx((G.nutF.x0 + G.nutF.x1) / 2)}" x2="40" y2="${Yx((G.nutF.x0 + G.nutF.x1) / 2) - 10}" stroke="#555" stroke-width="5"/>${lb(20, Yx((G.nutF.x0 + G.nutF.x1) / 2) + 16, "hook spanner +|torque wrench E10")}`; }
    case "fbh": return stand() + hook(cx, Yx(G.hsgF[2][1]) - d - 20) + `<line x1="${cx}" y1="${Yx(G.hsgF[2][1]) - d - 20}" x2="${X(G.Ro - 10)}" y2="${Yx(G.hsgF[2][1]) - d}" stroke="#555"/><line x1="${cx}" y1="${Yx(G.hsgF[2][1]) - d - 20}" x2="${2 * cx - X(G.Ro - 10)}" y2="${Yx(G.hsgF[2][1]) - d}" stroke="#555"/>${lb(20, 120, "crane slow speed (E13)")}${lb(20, 136, "housing warmed +20 K (E15)")}`;
    case "rotor": { const Tn = u < 0.65 ? R.Trot : 20 + (R.Trot - 20) * Math.exp(-(u - 0.65) * 8); return stand() + heater(18, 110, `${f(Tn, 0)} °C`, "E14 oven – rotor") + `<rect x="${X(M.dRot / 2 + 0.5)}" y="${Yx(G.g.L) - 4}" width="${6 * K}" height="${(G.g.L - G.rotor.x1) * K}" fill="${JC}" opacity=".7"/>${hook(cx, Yx(G.rotor.x1) - d - 40)}<path d="M${X(G.rotor.r1) + 4},${Yx(G.rotor.x1) - d - 10} l12,-30 M${2 * cx - X(G.rotor.r1) - 4},${Yx(G.rotor.x1) - d - 10} l-12,-30" stroke="${JC}" stroke-width="4"/>${lb(20, 240, `J4 tongs|+ guide bush|J5 thread cone|stop = shoulder Ø${G.g.segs[3].d}`)}`; }
    case "rear": return stand() + heater(20, 150, "70 °C", "E9 induction heater") + `<rect x="${X(M.dR / 2 + 0.5)}" y="${Yx(G.g.L) - d - 40}" width="${6 * K}" height="50" fill="${JC}" opacity=".85"/>${lb(20, 290, "J2 rear push sleeve|J5 thread cone")}`;
    case "draw": { const top = Yx(G.bar.x1) - 2, yb = Yx(G.g.L - 20); return stand() + `<rect x="${cx - 70}" y="${top - 14}" width="140" height="10" fill="${JC}"/><rect x="${cx - 70}" y="${top - 14}" width="10" height="${yb - top + 14}" fill="${JD}"/><rect x="${cx + 60}" y="${top - 14}" width="10" height="${yb - top + 14}" fill="${JD}"/><rect x="${cx - 4}" y="${top - 34}" width="8" height="30" fill="#666"/><rect x="${cx - 14}" y="${top - 4}" width="28" height="6" fill="#e0b040" stroke="#7a5a10"/>
      <text x="${cx + 76}" y="${top - 2}" class="apc-t" style="font-size:10px;font-weight:700">${f(rec.x.Fpk / 1000 * Math.min(1, u * 1.3), 2)} kN</text>${lb(20, 90, "J6 spring-pack|compression tool|+ force gauge")}`; }
    case "stator": { const Th = 20 + 60 * Math.min(1, u * 2); return `<rect x="${cx - 130}" y="${Yx(G.Lall) + 2}" width="260" height="10" fill="${JC}"/>${lb(20, Yx(G.Lall) - 22, "J8 housing stand|(rear face down)")}` + heater(20, 120, `${f(Th, 0)} °C`, "E15 sleeve heated|(stator shrink fit)") + hook(cx, Yx(G.sleeve.x0) - d - 30) + `<path d="M${cx},${Yx(G.sleeve.x0) - d - 30} L${X(G.sleeve.r1 - 4)},${Yx(G.sleeve.x0) - d} M${cx},${Yx(G.sleeve.x0) - d - 30} L${2 * cx - X(G.sleeve.r1 - 4)},${Yx(G.sleeve.x0) - d}" stroke="${JC}" stroke-width="3"/>${lb(20, 270, "J9 stator fixture|E17 pressure test")}`; }
    case "insert": { const dd = (1 - ease(Math.min(1, u * 1.6))) * 260; return `<rect x="${cx - 130}" y="${Yx(G.Lall) + 2}" width="260" height="10" fill="${JC}"/>${[-1, 1].map((sd) => `<rect x="${cx + sd * (G.Ro - 20) * K - 3}" y="${Yx(G.xS) - 150}" width="6" height="150" fill="${JC}"/>`).join("")}${hook(cx, Yx(0) - dd - 14)}<rect x="${cx - 14}" y="${Yx(0) - dd - 16}" width="28" height="16" fill="${JC}"/>
      ${lb(20, Yx(G.xS) + 40, "J8 guide rods (3×)|lifting adapter|in the nose|rotor into stator:|air gap ≈ 1 mm")}`; }
    case "cover": return `<rect x="${cx - 130}" y="${Yx(G.Lall) + 2}" width="260" height="10" fill="${JC}"/>${dial(X(G.Ro) + 30, Yx(10), "gap " + f(rec.x.lab[0], 2))}${lb(20, Yx(10) + 60, "J10 centring ring|+ feeler gauges")}`;
    case "unclamp": { const p = Math.max(0, Math.sin(Math.min(1, u * 1.4) * Math.PI)) * PK.S.p; return `<path d="M${2 * cx - X(G.cyl.body.r1)},${Yx(G.cyl.body.x0 + 30)} C 60,${Yx(G.cyl.body.x0 + 30)} 60,${Yx(G.cyl.body.x0) - 60} 40,${Yx(G.cyl.body.x0) - 80}" fill="none" stroke="#c33" stroke-width="3"/><rect x="20" y="${Yx(G.cyl.body.x0) - 130}" width="80" height="50" rx="6" fill="#556"/><text x="26" y="${Yx(G.cyl.body.x0) - 100}" class="apc-t" style="fill:#fff;font-weight:700">${f(p, 1)} MPa</text>${lb(20, Yx(G.cyl.body.x0) - 136, "E19 hydraulic test unit")}${dial(X(20), Yx(G.Lall) + 12, "stroke")}`; }
    case "clamp": return "";
    case "sensors": return lb(20, 200, "E24 electrical test:|insulation, phases,|sensors, encoder");
    case "pack": return lb(20, 200, "drawbar clamped|cooling ports plugged|VCI film + crate");
    default: return "";
  }
}

/* ------------------------------------------------------------------ custom scenes */
function customScene(si, u, ctx) {
  const s = STEPS[si], rec = ctx.rec, x = rec.x, M = ctx.M, R = ctx.R, PK = ctx.PK, ids = ctx.ids;
  let o = open(`Step ${si + 1} · ${s.n}`, s.k === "runin" ? "run-in stand E20" : s.k === "test" ? "test stand + sensors" : "clean room");
  const row = (y, a, b, c2, ok) => `<rect x="30" y="${y}" width="700" height="24" rx="4" fill="var(--surface)" stroke="var(--border)"/>${txt(42, y + 16, esc(a))}<text x="300" y="${y + 16}" class="apc-t" style="font-family:monospace">${esc(b)}</text>${txt(560, y + 16, esc(c2))}${ok ? `<text x="712" y="${y + 16}" class="apc-t" style="fill:var(--good-text);font-weight:700">✓</text>` : ""}`;
  if (s.k === "kit") {
    const parts = [["Shaft (HMC item 4 manufacturing)", ids.shaft, "runout ≤ 2 µm"], ["Front bearing set 4 × 7014 hybrid", ids.setF, "V-line, set no."], ["Rear bearing set 2 × 7012 hybrid", ids.setR, "V-line, set no."], ["Spacer pair (inner + outer)", ids.spacer, "ground in step 4"], ["Precision lock nuts M70 / M60", "B-NUT-00012 / 00013", "set screws"],
      ["Rotor sleeve + stator (motor kit)", ids.motor, "same kit no."], ["Front bearing housing / motor housing", `${ids.hsgF} / ${ids.hsgM}`, "bores IT4"], ["Cooling sleeve + O-rings", ids.sleeve, ""], ["Drawbar, clamping set, disc springs", `B-CLS-00007 · ${PK.n} springs`, "count!"], ["Unclamp cylinder, sensors, encoder", "B-CYL-00003 · B-SEN-…", ""]];
    parts.forEach((p, i) => { o += row(38 + i * 30, p[0], p[1], p[2], u * parts.length > i); });
    o += txt(30, 352, "Every serial is scanned into the assembly record. Matched bearing sets stay together – never mix rings of two sets.");
    o += `<g transform="translate(60,380)">${[0, 1, 2, 3].map((i) => `<rect x="${i * 46}" y="0" width="40" height="80" fill="${C.ring}" stroke="#333"/><line x1="${i * 46 + (i < 2 ? 8 : 32)}" y1="6" x2="${i * 46 + 20}" y2="74" stroke="#d02020" stroke-width="2"/><line x1="${i * 46 + 20}" y1="74" x2="${i * 46 + (i < 2 ? 32 : 8)}" y2="6" stroke="none"/>`).join("")}</g>${txt(260, 400, "V-line: a 'V' is marked across the outer rings of a matched set.")}${txt(260, 418, "Mounted in the right order and direction the line is continuous;")}${txt(260, 436, "the tip of the V points in the direction of the axial load (to the nose – check catalogue).")}${txt(260, 460, "Each ring also carries its deviation marks (bore Δd, OD ΔD in µm).")}`;
  } else if (s.k === "clean") {
    o += `<rect x="20" y="40" width="720" height="300" rx="10" fill="none" stroke="var(--axis)" stroke-dasharray="6 3"/>${txt(30, 58, "<tspan style='font-weight:600'>Clean room 20 ±1 °C, ISO 14644-1 class 7–8 (check) – over-pressure, gowning</tspan>")}`;
    o += `<rect x="40" y="80" width="200" height="160" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(50, 100, "E2 solvent washer + ultrasonic", "font-weight:600")}`;
    for (let i = 0; i < 10; i++) o += `<circle cx="${70 + i * 16}" cy="${200 - ((u * 300 + i * 23) % 80)}" r="3" fill="none" stroke="#4aa3df"/>`;
    o += `<rect x="70" y="200" width="140" height="30" fill="${C.shaft}" stroke="#444"/><rect x="270" y="80" width="220" height="160" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(280, 100, "E4 laminar-flow bench (class 5)", "font-weight:600")}`;
    for (let i = 0; i < 8; i++) o += `<line x1="${290 + i * 25}" y1="110" x2="${290 + i * 25}" y2="${130 + ((u * 200 + i * 9) % 60)}" stroke="#9fc6e6" stroke-width="2"/>`;
    o += `<ellipse cx="380" cy="215" rx="40" ry="12" fill="${C.ring}" stroke="#333"/><rect x="520" y="80" width="200" height="160" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(530, 100, "E3 soak rack ≥ 12 h", "font-weight:600")}`;
    for (let i = 0; i < 3; i++) o += `<rect x="540" y="${115 + i * 40}" width="160" height="26" fill="#9aa4ae" stroke="#444"/>`;
    o += big(530, 290, `${f(20 + 6 * Math.exp(-u * 4), 1)} °C`) + txt(530, 308, "part temperature") + txt(40, 280, "NO compressed air on bearings: it spins them dry (damage) and blows dirt in.") + txt(40, 298, "Filtered dry air only for bores / channels of the shaft and housings.") + txt(40, 316, `room particles: ${esc(rec.out.clean[0][1])}`);
    o += txt(30, 372, "<tspan style='font-weight:600'>Why so clean?</tspan> A 5 µm particle in a ball track of a preloaded spindle bearing makes a dent → noise, vibration, early failure.") + txt(30, 390, "Why 20 °C? Bearing fits are a few µm: Ø110 steel grows 1.3 µm per K. Measure only when everything has the same temperature.");
  } else if (s.k === "meas") {
    o += `<rect x="40" y="60" width="240" height="20" fill="#556"/><rect x="60" y="80" width="200" height="200" fill="#8a8f94"/>${txt(48, 74, "<tspan style='fill:#fff'>E5 bearing measuring stand</tspan>")}`;
    o += `<rect x="110" y="190" width="100" height="40" fill="${C.ring}" stroke="#333"/><rect x="118" y="168" width="84" height="22" fill="#b0b8c0" stroke="#333"/>${txt(176, 132, "load F")}<line x1="160" y1="120" x2="160" y2="168" stroke="#333" stroke-width="3"/><path d="M152,130 l8,-12 l8,12" fill="#333"/>`;
    o += `<rect x="225" y="${200 - u * 4}" width="30" height="8" fill="${JC}"/>${txt(196, 268, "0.1 µm probe")}${txt(40, 300, "stand-out a = inner − outer ring face")}${txt(40, 316, "(under the catalogue measuring load)")}`;
    o += chart({ x: 300, y: 40, w: 440, h: 190, t: "Stand-out deviation per bearing (µm, + = less preload)", xr: [0.5, 4.5], xt: [1, 2, 3, 4], yr: [-3, 4], series: [{ pts: x.e.map((v, i) => [i + 1, v]), col: CL, bars: true, lab: "bearing" }], hl: [{ y: 0 }] });
    const rows2 = [["Front fit shaft − bore (mean of set)", `${f(x.shF, 1)} − (${f(x.shF - x.iF, 1)}) = ${f(x.iF, 1)} µm`], ["Front bore − OD (mean of set)", `${f(x.hbF, 1)} − (${f(x.hbF - x.cF, 1)}) = ${f(x.cF, 1)} µm`], ["Rear fit shaft − bore", `${f(x.iR, 1)} µm`], ["Sleeve − rear OD", `${f(x.cR, 1)} µm`], ["Σ tandem pairs → Δs", `(${f(x.e[0], 1)}+${f(x.e[1], 1)})/2 + (${f(x.e[2], 1)}+${f(x.e[3], 1)})/2 = ${f(x.ds, 1)} µm`]];
    rows2.forEach(([a, b], i) => { if (u * 6 > i + 0.5) o += `${txt(310, 262 + i * 22, esc(a), "font-weight:600")}<text x="540" y="${262 + i * 22}" class="apc-t" style="font-family:monospace">${esc(b)}</text>`; });
    o += txt(30, 400, "Deviations are measured at 20 °C. A fit is: shaft − bore (+ = interference), housing bore − OD (+ = clearance).") + txt(30, 418, "The measured values (not the nominal) decide the spacer length in step 4.");
  } else if (s.k === "spacer") {
    o += `<rect x="40" y="250" width="320" height="30" fill="#556"/><rect x="60" y="210" width="280" height="40" fill="#8a8f94"/>${txt(48, 300, "E7 surface grinder (magnetic chuck)")}`;
    o += `<circle cx="${120 + u * 160}" cy="140" r="56" fill="#c9b48f" stroke="#7a6a4a"/><rect x="150" y="196" width="60" height="14" fill="${C.spacer}" stroke="#333"/>${txt(150, 190, "inner spacer")}`;
    const Li = 15 - x.dsAct * Math.min(1, u * 1.2) / 1000;
    o += `<g transform="translate(420,60)"><rect x="0" y="0" width="300" height="150" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(10, 22, "Spacer lengths (0.1 µm comparator)", "font-weight:600")}${txt(10, 50, `Outer spacer Lo = 15.0000 mm`)}${txt(10, 72, `Inner spacer Li = ${Li.toFixed(4)} mm`)}${txt(10, 94, `Lo − Li = ${f(x.dsAct * Math.min(1, u * 1.2), 1)} µm`)}${txt(10, 116, `target Δs = ${f(x.ds, 1)} ±1 µm`)}${txt(10, 138, esc(rec.out.spacer[1][2] === "ok" ? "→ OK" : "→ WRONG – grind a new inner spacer"), `font-weight:700;fill:${rec.out.spacer[1][2] === "ok" ? "var(--good-text)" : "var(--critical)"}`)}</g>`;
    const pts = []; for (let e = -6; e <= 6; e += 0.5) pts.push([e, M.Fpre * Math.max(0.05, 1 + e / x.d0) ** 1.5]);
    o += chart({ x: 420, y: 230, w: 320, h: 170, t: "Preload vs spacer error ε (Hertz F ~ δ^1.5)", xr: [-6, 6], xt: [-6, -3, 0, 3, 6], yr: [0, 1200], xl: "ε µm", series: [{ pts, col: CL }, { pts: [[x.eps, x.Feff / (ctx.F.mix ? 2.2 : 1)]], col: CR, dots: true, dotsOnly: true, lab: "this spindle" }], hl: [{ y: M.Fpre, t: `target ${M.Fpre} N` }] });
    o += txt(30, 340, "Back-to-back (O) pairs: the nut clamps the inner rings together.") + txt(30, 358, "Inner spacer SHORTER than the outer → MORE preload (check catalogue).") + txt(30, 376, `δ0 = ${x.d0} µm offset ↔ light preload ${M.Fpre} N (example – catalogue).`) + txt(30, 394, `F = Fpre · (1 + ε/δ0)^1.5 → 1 µm error = ${f(M.Fpre * ((1 + 1 / x.d0) ** 1.5 - 1), 0)} N more.`);
  } else if (s.k === "grease") {
    const vF = 0.15 * Math.PI / 4 * (M.DF ** 2 - M.dF ** 2) * M.BF / 1000;
    o += `<rect x="60" y="250" width="160" height="16" fill="#556"/><rect x="80" y="220" width="120" height="30" fill="#ddd" stroke="#333"/><text x="100" y="242" class="apc-t" style="font-family:monospace;font-weight:700">${f(x.gF * Math.min(1, u * 1.5), 2)} g</text>${txt(60, 284, "E8 scale 0.01 g")}`;
    o += `<g transform="translate(${300 + Math.sin(u * 20) * 6},120) rotate(30)"><rect x="0" y="0" width="120" height="18" rx="4" fill="#eee" stroke="#333"/><rect x="120" y="5" width="30" height="8" fill="#ccc" stroke="#333"/></g>`;
    o += `<circle cx="520" cy="200" r="100" fill="${C.ring}" stroke="#333"/><circle cx="520" cy="200" r="62" fill="var(--surface)" stroke="#333"/>`;
    for (let i = 0; i < 20; i++) { const a = i / 20 * 2 * Math.PI; o += `<circle cx="${520 + 81 * Math.cos(a)}" cy="${200 + 81 * Math.sin(a)}" r="8" fill="${C.ball}"/>${i / 20 < u ? `<circle cx="${520 + 81 * Math.cos(a + 0.16)}" cy="${200 + 81 * Math.sin(a + 0.16)}" r="4" fill="#e6d27a"/>` : ""}`; }
    o += txt(30, 330, `Free volume 7014 ≈ 0.15 × π/4 × (110² − 70²) × 20 = ${f(vF, 1)} cm³ (estimate – catalogue gives the real value)`) + txt(30, 348, `Fill 15 % (10–20 % typical – check catalogue) = ${f(0.15 * vF, 2)} cm³ × 0.9 g/cm³ = ${f(x.gF, 2)} g per bearing`) + txt(30, 366, `Rear 7012: ${f(x.gR, 2)} g per bearing`) + txt(30, 390, "Too much grease → churning → high temperature, long run-in. Too little → short life.") + txt(30, 408, esc(`This spindle: ${rec.out.grease[0][1]}`), ctx.F.grease ? "fill:var(--critical);font-weight:700" : "");
  } else if (s.k === "balance") {
    const sp = u * 40;
    o += `<rect x="30" y="230" width="360" height="24" fill="#556"/>${[90, 300].map((xx) => `<rect x="${xx - 25}" y="170" width="50" height="60" fill="${JC}"/>`).join("")}`;
    o += `<rect x="60" y="150" width="70" height="60" fill="${C.hsgF}" stroke="#333"/><rect x="130" y="160" width="160" height="40" fill="${C.rotor}" stroke="#333"/><rect x="40" y="165" width="300" height="30" fill="${C.shaft}" stroke="#333" opacity=".5"/><rect x="280" y="163" width="40" height="34" fill="${JC}" opacity=".8"/>`;
    o += `<line x1="${110 + 12 * Math.cos(sp)}" y1="${180 + 12 * Math.sin(sp)}" x2="110" y2="180" stroke="#d02020" stroke-width="2"/>${txt(30, 280, "E16 balancing machine · cradle 1 = front bearing housing")}${txt(30, 298, "cradle 2 = J7 rear support sleeve (turns in its own bearings)")}${txt(30, 316, `Plane 1 = front nut (r = ${x.rc} mm), plane 2 = rear nut / ring`)}`;
    o += txt(30, 348, `Uper = 9549 · G · m / n = 9549 · ${M.Gbal} · ${M.mRot} / ${M.nmax} = ${f(R.Uper, 1)} g·mm`) + txt(30, 366, `per plane ≈ Uper / 2 = ${f(R.UperPlane, 1)} g·mm → e = ${f(R.ecc, 2)} µm`) + txt(30, 384, `Correction mass m = U / r: ${f(x.U0[0][0], 0)} / ${x.rc} = ${f(x.U0[0][0] / x.rc, 2)} g opposite the heavy spot`);
    o += polar(410, 40, 330, ctx, u);
  } else if (s.k === "runin") {
    const n = Math.max(2, Math.round(u * x.ri.tr.length));
    o += chart({ x: 20, y: 30, w: 720, h: 140, t: "Speed program (rpm)", xr: [0, x.ri.t], yr: [0, M.nmax * 1.1], series: [{ pts: x.ri.sp.slice(0, n), col: CL }] });
    o += chart({ x: 20, y: 180, w: 720, h: 230, t: "Temperature rise front bearings ΔT (K)", note: esc(rec.out.runin[0][1]), xr: [0, x.ri.t], yr: [0, 30], xl: "minutes", hl: [{ y: x.ri.Tlim, t: `stop limit ${x.ri.Tlim} K`, col: "var(--critical)" }, { y: 20, t: "stable ≤ 20 K" }], series: [{ pts: x.ri.tr.slice(0, n), col: "var(--critical)" }] });
    o += txt(20, 432, `Rule: hold each speed until ΔT is stable (< 0.06 K/min); if ΔT ≥ ${x.ri.Tlim} K stop, cool to 12 K, repeat the step.`) + txt(20, 450, "The grease is pushed out of the ball path into the side spaces; then the temperature drops → that is the end of the run-in.") + txt(20, 468, esc(`Stops: ${x.ri.stops} · time ${f(x.ri.t / 60, 1)} h · end ΔT ${f(x.ri.Tend, 1)} K`), "font-weight:600");
  } else if (s.k === "test") {
    const pr = [0, 1, 2, 3].map((i) => i / 4 < u);
    o += `<rect x="30" y="80" width="230" height="90" fill="${C.hsg}" stroke="#333"/><rect x="260" y="105" width="22" height="40" fill="${C.shaft}" stroke="#333"/><rect x="282" y="113" width="${300 * 0.9}" height="24" fill="#dfe6ec" stroke="#333"/>${txt(300, 106, "test mandrel 300 mm (E21)")}`;
    o += [[292, "taper"], [282 + 270, "300 mm"]].map(([xx, t]) => `<rect x="${xx - 5}" y="140" width="10" height="26" fill="${JC}"/>${txt(xx - 18, 182, t)}`).join("") + `<rect x="${282 + 270 + 18}" y="118" width="22" height="12" fill="${JC}"/>${txt(565, 106, "axial probe")}${txt(30, 196, "J11 sensor frame · E22 capacitive probes · E26 loading device")}`;
    const cards = [["Runout taper / 300 mm", `${f(x.tr, 1)} / ${f(x.tr300, 1)} µm`, rec.out.test[0][2] === "ok" && rec.out.test[1][2] === "ok"], ["Stiffness axial / radial", `${f(x.kax, 0)} / ${f(x.krad, 0)} N/µm`, rec.out.test[2][2] === "ok" && rec.out.test[3][2] === "ok"], ["Thermal growth nose", `${f(x.grow, 1)} µm`, rec.out.test[4][2] === "ok"], ["Vibration / noise", `${f(x.vib, 2)} mm/s · ${f(x.noise, 0)} dB(A)`, rec.out.test[5][2] === "ok" && rec.out.test[7][2] === "ok"]];
    cards.forEach(([a, b, ok], i) => { if (!pr[i]) return; o += `<rect x="${30 + i * 180}" y="214" width="170" height="64" rx="8" fill="var(--surface)" stroke="${ok ? "var(--good)" : "var(--critical)"}" stroke-width="2"/>${txt(40 + i * 180, 234, esc(a), "font-weight:600")}${big(40 + i * 180, 262, esc(b), ok ? "var(--text)" : "var(--critical)")}`; });
    const tr = []; for (let a = 0; a <= 360; a += 10) tr.push([a, x.tr300 / 2 * Math.sin(a * RAD + 0.7) + 0.25 * Math.sin(3 * a * RAD)]);
    o += chart({ x: 30, y: 292, w: 350, h: 190, t: "Runout at 300 mm over one turn (µm)", xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-4, 4], series: [{ pts: tr, col: CL }], hl: [{ y: 2.5 }, { y: -2.5 }] });
    const gr = []; for (let t = 0; t <= 60; t += 2) gr.push([t, x.grow * (1 - Math.exp(-t / 14))]);
    o += chart({ x: 390, y: 292, w: 350, h: 190, t: "Thermal growth at the nose (µm), nmax", xr: [0, 60], yr: [0, 20], xl: "min", hl: [{ y: 15, col: "var(--critical)", t: "limit 15 (example)" }], series: [{ pts: gr.slice(0, Math.max(2, Math.round(u * gr.length))), col: "var(--critical)" }] });
  }
  return o + `</svg>`;
}
function polar(x0, y0, w, ctx, u) {
  const x = ctx.rec.x, R = ctx.R, cxp = x0 + w / 2, cyp = y0 + 150, rmax = 120, sc = rmax / Math.max(80, x.U0[0][0], x.U0[1][0]), lim = R.UperPlane * sc;
  let o = `<rect x="${x0}" y="${y0}" width="${w}" height="${w - 20}" rx="6" fill="var(--surface)" stroke="var(--border)"/><text x="${x0 + 8}" y="${y0 + 15}" class="apc-t" style="font-weight:600">Unbalance polar plot (g·mm)</text>`;
  [0.25, 0.5, 0.75, 1].forEach((q) => { o += `<circle cx="${cxp}" cy="${cyp}" r="${rmax * q}" fill="none" stroke="var(--grid)"/>`; });
  o += `<circle cx="${cxp}" cy="${cyp}" r="${Math.max(2, lim)}" fill="var(--good)" opacity=".25"/><text x="${cxp + lim + 3}" y="${cyp - 3}" class="apc-t" style="font-size:9.5px">Uper/2 = ${f(R.UperPlane, 1)}</text>`;
  const ph = Math.min(1, u * 1.5), vec = (U, a, col, lab) => { const rr = U * sc, xa = cxp + rr * Math.cos(a * RAD), ya = cyp - rr * Math.sin(a * RAD); return `<line x1="${cxp}" y1="${cyp}" x2="${xa}" y2="${ya}" stroke="${col}" stroke-width="2.5"/><circle cx="${xa}" cy="${ya}" r="4" fill="${col}"/><text x="${xa + 5}" y="${ya - 4}" class="apc-t" style="font-size:10px">${esc(lab)}</text>`; };
  [0, 1].forEach((p) => { const U = ph < 1 ? x.U0[p][0] * (1 - ph) + x.U1[p][0] * ph : x.U1[p][0], a = ph < 1 ? x.U0[p][1] : x.U1[p][1]; o += vec(x.U0[p][0], x.U0[p][1], p ? CR : CL, `P${p + 1} before ${f(x.U0[p][0], 0)}`); if (u > 0.4) { o += vec(U, a, p ? "#a05000" : "#204080", ""); o += `<text x="${x0 + 10}" y="${y0 + w - 64 + p * 14}" class="apc-t" style="font-size:10.5px;font-weight:600;fill:${p ? "#a05000" : "#204080"}">P${p + 1} ${ph < 1 ? "correcting" : "after"}: ${f(U, 1)} g·mm${ph >= 1 ? ` ∠${f(a, 0)}° (≤ ${f(R.UperPlane, 1)})` : ""}</text>`; } });
  o += `<text x="${x0 + 8}" y="${y0 + w - 30}" class="apc-t" style="font-size:10px">0° = reference mark on the nut; correction 180° opposite</text>`;
  return o;
}
function clampScene(si, u, ctx) {
  let s = section(si, u, ctx, 290);
  const PK = ctx.PK, rec = ctx.rec, M = ctx.M, K = 0.76, cx = 250, Yx = (x) => 62 + x * K, done = u > 0.6;
  const g = `<rect x="${cx - 18}" y="${Yx(0) - 18}" width="36" height="${18 + 30 * K}" fill="${JC}" opacity=".85"/><rect x="${cx - 30}" y="${Yx(0) - 30}" width="60" height="12" rx="3" fill="${JD}"/><text x="${cx + 36}" y="${Yx(0) - 20}" class="apc-t" style="font-weight:700;fill:${JC}">${done ? f(rec.x.FclM, 1) : f(rec.x.FclM * Math.min(1, u * 1.7), 1)} kN</text><text x="20" y="44" class="apc-t" style="fill:${JC};font-weight:600">E18 HSK-A63 clamping-force gauge</text>`;
  const ch = chart({ x: 520, y: 300, w: 236, h: 196, t: "Spring pack: force vs drawbar travel", xr: [-2, PK.S.stroke], yr: [0, Math.ceil(PK.Fu / 1000 / 2) * 2 + 2], xl: "mm (0 = clamped)", series: [{ pts: PK.curve, col: CL }, { pts: [[0, rec.x.Fpk / 1000]], col: CR, dots: true, dotsOnly: true, lab: "measured" }], hl: [{ y: ctx.R.Fspring / 1000, t: "needed" }] });
  return s.replace("</svg>", g + ch + "</svg>");
}

/* ------------------------------------------------------------------ UI */
const box = $("arItem2");
let api = null;
if (box) {
  const css = document.createElement("style");
  css.textContent = `#arItem2 .as-calc { display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:10px; } #arItem2 .as-calc div { border:1px solid var(--grid); border-radius:8px; padding:8px 10px; font-size:12.5px; } #arItem2 .as-calc b { display:block; margin-bottom:4px; } #arItem2 .as-calc code { font-size:12px; }`;
  document.head.appendChild(css);
  box.innerHTML = `
    <div class="kpis" id="asKpis"></div>
    <div class="card"><div class="card-head"><h2>Assembly twin – motor spindle (HSK-A63, ${SP_DEF.nmax} rpm example)</h2><span class="sub">click a step · jigs drawn in blue · faults change the simulated measurements</span></div>
      <div class="wm-route" id="asRoute"></div>
      <div class="apc3d-bar"><button class="btn primary" id="asPlay">▶ Play all</button><button class="btn ghost" id="asPrev">◀</button><button class="btn ghost" id="asNext">▶|</button>
        <input type="range" id="asU" min="0" max="1000" value="0" style="max-width:220px" aria-label="Progress"><button class="btn ghost" id="asNew">New spindle (random)</button><button class="btn ghost" id="asExport">Download assembly record</button></div>
      <div class="dk-step" id="asStep"></div>
      <div class="hr-grid"><div id="asScene"></div><div class="apc3d-info" id="asInfo"></div></div>
      <div class="apc3d-bar" style="margin-top:8px"><button class="btn ghost" id="as3dBtn">Show 3D view</button><label class="small"><input type="checkbox" id="as3dCut" checked> quarter cut</label><span class="small muted">3D follows the same step + progress · jigs in blue</span></div>
      <div class="mf3d" id="as3d" hidden></div>
      <div class="wm-faults-wrap"><span class="tb-label">Inject an assembly fault:</span><div class="wm-faults" id="asFaults"></div></div></div>
    <div class="card"><div class="card-head"><h2>Key calculations (from the spindle model, example values)</h2><span class="sub">formulas with numbers · guide doc 19 chapter 4</span></div><div class="as-calc" id="asCalc"></div></div>
    <div class="card"><div class="card-head"><h2>Balancing, clamping, run-in, final test</h2><span class="sub" id="asAccSub"></span></div><div class="wm-charts" id="asAcc"></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Assembly record – steps, time, result</h2></div><div class="table-wrap"><table class="apc-bom" id="asRec"></table></div></div>
      <div class="card"><div class="card-head"><h2>Tightening torques + sequence</h2><span class="sub">examples – nut / bearing catalogue and doc 14 win</span></div><div class="table-wrap"><table class="apc-bom" id="asTq"></table></div></div></div>
    <div class="card"><div class="card-head"><h2>Equipment to BUY</h2><span class="sub">required capability (examples)</span></div><div class="table-wrap"><table class="apc-bom wm-eq" id="asEq"></table></div></div>
    <div class="card"><div class="card-head"><h2>Jigs + fixtures to MAKE</h2></div><div class="table-wrap"><table class="apc-bom wm-eq" id="asJig"></table></div></div>
    <div class="card"><div class="card-head"><h2>Spindle clean room layout (example)</h2></div><div class="dk-svg" id="asLay"></div></div>
    <div class="card"><div class="card-head"><h2>Guide – spindle assembly rules + faults</h2></div><div id="asGuide" class="mx-guide"></div></div>`;
  let F = {}, serial = 1, st = 0, u = 0, playing = false, last = performance.now(), started = false, hold = 0, rec = null, M = { ...SP_DEF }, R = null, PK = null, G = null, ids = {}, lastDraw = 0;
  const pane = $("tab-asm"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad", info: "wm-info" }, ico = { ok: "✓", warn: "!", bad: "✕", info: "i" }, rate = 45;
  const shown = () => pane && pane.classList.contains("active") && !box.hidden;
  const chk = (rows) => rows.map(([l, v, s]) => `<div class="apc-chk ${cls[s]}"><b>${ico[s]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("");
  const sstat = (k) => { const r = rec.out[k]; return r.some((y) => y[2] === "bad") ? "bad" : r.some((y) => y[2] === "warn") ? "warn" : "ok"; };
  const ctx = () => ({ G, M, R, PK, rec, F, ids });
  function compute() {
    const ext = window.spMfg && window.spMfg.M ? window.spMfg.M : null;
    M = { ...SP_DEF, ...(ext || {}) }; R = spCalc(M); PK = packCalc(R); G = spAsmGeom(R.g, M, PK);
    let shaftSn = null; try { const c = window.spMfg && window.spMfg.current ? window.spMfg.current() : null; shaftSn = c && (c.sn || (c.R && c.R.sn)); } catch (e) { shaftSn = null; }
    const n5 = pad(serial);
    ids = { spu: `SPU-${YYWW}-${n5}`, shaft: typeof shaftSn === "string" ? shaftSn : `SPS-${YYWW}-${shaftSn ? pad(shaftSn) : n5}`, setF: `B-BRG-00041 set ${pad(23410 + serial * 7, 6)}`, setR: `B-BRG-00042 set ${pad(31870 + serial * 5, 6)}`, spacer: `SPC-${YYWW}-${n5}`, motor: `B-MOT-00004 kit ${pad(5100 + serial, 6)}`, hsgF: `SBH-${YYWW}-${n5}`, hsgM: `SMH-${YYWW}-${n5}`, sleeve: `SCS-${YYWW}-${n5}` };
    rec = simulate(M, R, PK, F, 7000 + serial, ids);
  }
  function kpis() {
    const hrs = STEPS.reduce((a, s) => a + s.t * s.men, 0) / 60, x = rec.x, s = rec.fails.length ? `REJECT at step ${rec.fails[0].i + 1}` : rec.warns.length ? "accepted, warnings" : "accepted";
    $("asKpis").innerHTML = [["Motor spindle", ids.spu, `shaft ${ids.shaft}`], ["Status", s, rec.fails.length ? rec.fails.map((y) => y.l).slice(0, 2).join(" · ") : "all checks passed"], ["Labour", f(hrs, 1) + " h", `${f(STEPS.reduce((a, q) => a + q.t, 0) / 60, 1)} h lead time + 12 h soak`],
      ["Labour cost", "$" + f(hrs * rate, 0), `${rate} $/h (example)`], ["Runout taper / 300 mm", `${f(x.tr, 1)} / ${f(x.tr300, 1)} µm`, "limits 2 / 5 µm (example)"], ["Clamping force", f(x.FclM, 1) + " kN", `target ${M.Fclamp} kN (${f(M.Fclamp * 0.9, 1)}–${f(M.Fclamp * 1.15, 1)})`],
      ["Run-in ΔT max", f(x.ri.Tmax, 1) + " K", `${x.ri.stops} stops · ${f(x.ri.t / 60, 1)} h`], ["Vibration at nmax", f(x.vib, 2) + " mm/s", "limit 1.0 mm/s (example)"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
  }
  function route() {
    $("asRoute").innerHTML = STEPS.map((s, i) => { const done = i < st || (i === st && u >= 1), r = done ? sstat(s.k) : ""; return `<button class="wm-op${i === st ? " on" : ""}${done ? " done" : ""}${r === "bad" || r === "warn" ? " " + r : ""}" data-asst="${i}">${i + 1} ${esc(s.n.split(":")[0].split(",")[0].split("(")[0])}</button>`; }).join("");
  }
  function scene() {
    const s = STEPS[st];
    $("asScene").innerHTML = s.ori === "c" ? customScene(st, u, ctx()) : s.k === "clamp" ? clampScene(st, u, ctx()) : section(st, u, ctx());
  }
  function info() {
    const s = STEPS[st], si = Math.min(s.how.length - 1, Math.floor(u * s.how.length));
    $("asStep").innerHTML = `<span class="dk-n">${st + 1}/${STEPS.length}</span> <b>${esc(s.how[si])}</b>`;
    const tq = { nut: [0, 1], rear: [1, 2], insert: [3], cover: [4, 5], stator: [6], unclamp: [7], draw: [8], balance: [9] }[s.k] || [];
    $("asInfo").innerHTML = `<div class="apc-pi-h"><b>Step ${st + 1} · ${esc(s.n)}</b><span class="apc-mb">${esc(s.ph)}</span></div>
      <ol class="wm-steps">${s.how.map((t, i) => `<li class="${i === si ? "on" : i < si ? "done" : ""}">${esc(t)}</li>`).join("")}</ol>
      <h4>Equipment (BUY)</h4>${s.eq.length ? `<table class="wm-kv">${s.eq.map((e) => `<tr><td>${e} ${esc(EQ[e][0])}</td><td>${esc(EQ[e][2])}</td></tr>`).join("")}</table>` : `<p class="muted">–</p>`}
      <h4>Jigs (MAKE)</h4>${s.jig.length ? `<table class="wm-kv">${s.jig.map((j) => `<tr><td>${j} ${esc(JIG[j][0])}</td><td>${esc(JIG[j][1])}</td></tr>`).join("")}</table>` : `<p class="muted">–</p>`}
      ${tq.length ? `<h4>Torques</h4><table class="wm-kv">${tq.map((i) => `<tr><td>${esc(TQ[i][0])}</td><td><b>${esc(String(TQ[i][3]))}</b> N·m · ${esc(TQ[i][4])}</td></tr>`).join("")}</table>` : ""}
      <h4>Checks</h4>${u >= 0.9 ? chk(rec.out[s.k]) : `<p class="muted">… measured at the end of the step</p>`}
      <p class="small muted">${s.t} min × ${s.men} fitter(s)</p>`;
  }
  function calcCard() {
    const x = rec.x, g = R.g, vF = 0.15 * Math.PI / 4 * (M.DF ** 2 - M.dF ** 2) * M.BF / 1000, dTb = (0.004 + 0.015) / (11.5e-6 * M.dF);
    const c = [
      ["Preload + spacer", `Δs = Lo − Li = Σ stand-out of the 2 tandem pairs = ${f(x.ds, 1)} µm<br>F = Fpre·(1 + ε/δ0)^1.5, δ0 = ${x.d0} µm (example) → ε = 1 µm gives +${f(M.Fpre * ((1 + 1 / x.d0) ** 1.5 - 1), 0)} N`],
      ["Speed factor", `n·dm = ${M.nmax} × ${f(g.dmF, 0)} = ${f(R.ndmF / 1e6, 2)}·10⁶ mm/min (${R.ndmOK ? "≤ 1.4·10⁶ OK for hybrid + grease – check catalogue" : "TOO HIGH for grease – check"})`],
      ["Grease quantity", `V_free ≈ 0.15·π/4·(D² − d²)·B = ${f(vF, 1)} cm³ (7014, estimate)<br>fill 15 % → ${f(0.15 * vF, 2)} cm³ = ${f(x.gF, 2)} g`],
      ["Bearing heating", `ΔT = (i + s_mount) / (α·d) = (0.004 + 0.015) / (11.5·10⁻⁶ × ${M.dF}) = ${f(dTb, 0)} K → heat to ≈ 70 °C (≤ 110 °C)`],
      ["Rotor shrink temperature", `ΔT = (i + 0.0015·d) / (α·d) = (${M.dRotI} + ${f(0.0015 * M.dRot, 4)}) / (11.5·10⁻⁶ × ${M.dRot}) = ${f(R.rotHeat, 0)} K → ${f(R.Trot, 0)} °C (check magnet limit!)`],
      ["Clamping force → spring pack", `F_draw = Fclamp / i = ${M.Fclamp} kN / ${M.iClamp} = ${f(R.Fdraw / 1000, 2)} kN, +15 % → F_spring = ${f(R.Fspring / 1000, 2)} kN<br>${esc(PK.S.name)}: F(0.75 h0) = ${f(PK.F075 / 1000, 2)} kN each`],
      ["Spring pack design", `${PK.S.np} in parallel → s_clamped = ${f(PK.sc, 3)} mm per spring; stroke ${PK.S.stroke} mm / (0.75·h0 − s_c) → ${PK.ns} groups = ${PK.n} springs<br>L0 = ${f(PK.L0, 1)} mm, clamped ${f(PK.Lc, 1)} mm, F_unclamped = ${f(PK.Fu / 1000, 2)} kN (+${f(PK.rise * 100, 0)} %)`],
      ["Unclamp piston", `F_piston ≥ 1.1·F_unclamped = ${f(PK.Fp / 1000, 2)} kN at ${PK.S.p} MPa → A = ${f(PK.Ap, 0)} mm² → annular piston Ø${f(PK.Dp, 0)} (rod Ø${PK.S.dRod})<br><span class="muted">spindle model (spCalc, unclamped force +10 %): p·A = ${f(PK.FpCalc / 1000, 2)} kN, Ø${f(R.dPiston, 0)} solid piston – ${PK.FpCalc >= PK.Fp ? "OK" : "too small for this pack → check"}</span>`],
      ["Balancing", `Uper = 9549·G·m/n = 9549 × ${M.Gbal} × ${M.mRot} / ${M.nmax} = ${f(R.Uper, 1)} g·mm → ${f(R.UperPlane, 1)} g·mm per plane, e = ${f(R.ecc, 2)} µm`],
      ["Thermal growth", `rear end: α·L·ΔT = 11.5·10⁻⁶ × ${f(g.L - g.segs[1].x0, 0)} × ${M.dT} = ${f(R.dLshaft * 1000, 0)} µm → taken by the floating rear bearings<br>nose (shaft only): ${f(R.dLnose * 1000, 1)} µm + housing growth`],
      ["Critical speed + cooling", `n_crit ≈ ${f(R.nCrit, 0)} rpm (${R.critOK ? "≥ 1.3·nmax OK" : "too low"}) · cooling water ΔT = P_loss / (ṁ·c) = ${f(R.dTw, 1)} K`],
    ];
    $("asCalc").innerHTML = c.map(([h, b]) => `<div><b>${esc(h)}</b>${b}</div>`).join("");
  }
  function tables() {
    $("asRec").innerHTML = `<thead><tr><th>#</th><th>Step</th><th>min</th><th>Fitters</th><th>Measured</th><th>Result</th></tr></thead><tbody>${STEPS.map((s, i) => `<tr data-asst="${i}" style="cursor:pointer" class="${i === st ? "on" : ""}"><td>${i + 1}</td><td>${esc(s.n)}</td><td>${s.t}</td><td>${s.men}</td><td class="small">${rec.out[s.k].map((y) => esc(y[1])).join(" · ")}</td><td class="wm-st-${sstat(s.k)}">${ico[sstat(s.k)]}</td></tr>`).join("")}</tbody>`;
    $("asTq").innerHTML = `<thead><tr><th>Joint</th><th>Screws</th><th>Class</th><th>Torque N·m</th><th>Sequence</th></tr></thead><tbody>${TQ.map((t) => `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td>${t[2]}</td><td><b>${esc(String(t[3]))}</b></td><td>${esc(t[4])}</td></tr>`).join("")}</tbody>`;
    const used = (id, key) => STEPS.map((s, i) => (s[key].includes(id) ? i + 1 : null)).filter(Boolean).join(", ");
    $("asEq").innerHTML = `<thead><tr><th>ID</th><th>Equipment</th><th>Buy / make</th><th>Required capability</th><th>Used in step</th></tr></thead><tbody>${Object.entries(EQ).map(([id, e]) => `<tr><td>${id}</td><td>${esc(e[0])}</td><td>${esc(e[1])}</td><td>${esc(e[2])}</td><td>${used(id, "eq")}</td></tr>`).join("")}</tbody>`;
    $("asJig").innerHTML = `<thead><tr><th>ID</th><th>Jig / fixture (MAKE)</th><th>Design + function</th><th>Used in step</th></tr></thead><tbody>${Object.entries(JIG).map(([id, j]) => `<tr><td>${id}</td><td>${esc(j[0])}</td><td>${esc(j[1])}</td><td>${used(id, "jig")}</td></tr>`).join("")}</tbody>`;
    const zones = [["Gowning lock (air shower)", 20, 40, 130, 110, 0], ["Washing E2 + soak rack E3", 165, 40, 190, 110, 0], ["Laminar bench E4: bearings, measuring stand E5, greasing E8", 370, 40, 360, 110, 1], ["Vertical stand J1 + heaters E9 / E14", 20, 170, 220, 130, 1], ["Housing stand J8 + crane E13", 255, 170, 200, 130, 1], ["Balancing machine E16", 470, 170, 260, 130, 0], ["Run-in + test stand E20 (outside the clean room, own room)", 20, 320, 450, 110, 0], ["Jig + gauge board, record PC", 485, 320, 245, 110, 0]];
    $("asLay").innerHTML = `<svg viewBox="0 0 760 460" class="apc-svg"><rect x="10" y="30" width="730" height="282" rx="10" fill="none" stroke="var(--accent)" stroke-dasharray="6 3"/><text x="16" y="24" class="apc-t" style="fill:var(--accent);font-weight:600">clean room 20 ±1 °C, ISO 14644-1 class 7–8 (check), over-pressure</text>${zones.map(([n, x, y, w, h, cl]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${cl ? "var(--surface)" : "var(--surface-2)"}" stroke="var(--axis)"/><text x="${x + 8}" y="${y + 20}" class="apc-t" style="font-weight:600">${esc(n.length > 46 ? n.slice(0, 46) : n)}</text>${n.length > 46 ? `<text x="${x + 8}" y="${y + 36}" class="apc-t" style="font-weight:600">${esc(n.slice(46))}</text>` : ""}`).join("")}
      <line x1="20" y1="448" x2="740" y2="448" stroke="#e0b040" stroke-width="6"/><text x="24" y="442" class="apc-t">crane 500 kg over stand J1, J8 and the balancing machine · parts flow: lock → washing → bench → stands → balancing → test</text></svg>`;
  }
  function acc() {
    const ok = st >= SI.balance;
    $("asAccSub").textContent = ok ? ids.spu : "reached from step 12";
    if (!ok) { $("asAcc").innerHTML = `<p class="muted">Not balanced / tested yet.</p>`; return; }
    const x = rec.x, card = (i, h = 230) => `<svg viewBox="0 0 360 ${h}" class="apc-svg">${i}</svg>`, c = ctx(), cards = [];
    cards.push(card(polar(0, 0, 360, c, 1), 340));
    if (st >= SI.clamp) cards.push(card(chart({ x: 0, y: 0, w: 360, h: 230, t: "Spring pack force vs drawbar travel (kN)", note: `measured ${f(x.FclM, 1)} kN clamp`, xr: [-2, PK.S.stroke], yr: [0, Math.ceil(PK.Fu / 1000 / 2) * 2 + 2], xl: "mm (0 = clamped)", series: [{ pts: PK.curve, col: CL }, { pts: [[0, x.Fpk / 1000]], col: CR, dots: true, dotsOnly: true, lab: "spring force measured" }], hl: [{ y: R.Fspring / 1000, t: "needed" }] })));
    if (st >= SI.runin) cards.push(card(chart({ x: 0, y: 0, w: 360, h: 230, t: "Run-in ΔT (K)", note: `${x.ri.stops} stops`, xr: [0, x.ri.t], yr: [0, 30], xl: "min", hl: [{ y: x.ri.Tlim, col: "var(--critical)" }], series: [{ pts: x.ri.tr, col: "var(--critical)" }, { pts: x.ri.sp.map(([t, n]) => [t, n / M.nmax * 10]), col: CL, w: 1.2, lab: "speed (0–10 = 0–nmax)" }], legend: [["ΔT", "var(--critical)"], ["speed", CL]] })));
    if (st >= SI.test) cards.push(card(chart({ x: 0, y: 0, w: 360, h: 230, t: "Final test vs limits (% of limit)", xr: [0.5, 6.5], xt: [1, 2, 3, 4, 5, 6], yr: [0, 160], series: [{ pts: [[1, x.tr / 2 * 100], [2, x.tr300 / 5 * 100], [3, x.grow / 15 * 100], [4, x.vib / 1 * 100], [5, x.shift / R.UperPlane * 100], [6, 0.85 * M.cax / x.kax * 100]], col: CL, bars: true, lab: "1 taper 2 300mm 3 growth 4 vib 5 unbal 6 stiffness" }], hl: [{ y: 100, col: "var(--critical)", t: "limit" }] })));
    cards.push(`<div class="apc-checks">${chk([...rec.out.balance, ...(st >= SI.clamp ? rec.out.clamp : []), ...(st >= SI.runin ? rec.out.runin : []), ...(st >= SI.test ? rec.out.test : [])])}</div>`);
    $("asAcc").innerHTML = cards.join("");
  }
  function guide() {
    $("asGuide").innerHTML = `<h3>Spindle assembly rules</h3><ul><li><b>Clean room + 20 °C.</b> Bearing fits and preload are a few µm – dirt or 2 K difference destroy them.</li>
      <li><b>No compressed air on bearings</b>, no hammer, no pushing over the balls: force only on the ring that is being fitted (push sleeves J2).</li>
      <li><b>Matched sets stay together</b> and keep their order: the V-line on the outer rings must be continuous and point to the nose (check catalogue).</li>
      <li><b>Preload comes from measured values</b>, not nominal: stand-out → spacer difference ±1 µm.</li>
      <li><b>Weigh the grease</b> (10–20 % of the free volume, catalogue) – overfilling is the most common cause of hot spindles.</li>
      <li><b>Nut runout ≤ 2 µm</b> after correction with the radial set screws; it tilts the inner rings → runout at the tool.</li>
      <li><b>Heat, don't press:</b> bearings ≤ 110 °C induction, rotor to the calculated temperature (magnet limit!), housing +15–20 K.</li>
      <li><b>Count the disc springs</b> and check the stacking against the drawing; measure the pack length and force.</li>
      <li><b>Run-in until stable</b> – never jump to nmax with fresh grease.</li></ul>
      <h3>Faults – found at</h3><table class="apc-bom"><thead><tr><th>Fault</th><th>Found at</th><th>Prevention</th></tr></thead><tbody>
      ${FAULTS.map(([, l, w]) => `<tr><td>${esc(l)}</td><td>${esc(w)}</td><td>${esc({ "Bearing set mixed / one bearing reversed": "V-line check, sets in the original packing until mounting, second person checks", "Spacer ground 6 µm too short": "write 'Lo − Li = +x µm' on the card, measure after grinding with 0.1 µm", "Dirt in a bearing (blown with shop air)": "clean room, no shop air, bearings unpacked only on the laminar bench", "Grease dosed by eye (≈ 3× too much)": "weigh every portion, record the weight", "Nut runout not corrected": "J3 fixture + 0.1 µm probe, value ≤ 2 µm is a signed record line", "Rotor interference too small": "measure rotor bore + seat before heating, reject if out of range", "Disc springs stacked wrong": "stacking picture on the work card, count + measure L0", "Cooling-sleeve O-ring cut": "deburred chamfers, fitting sleeve, oiled O-rings, pressure test" }[l] || "")}</td></tr>`).join("")}</tbody></table>`;
  }
  function renderAll() { compute(); kpis(); route(); scene(); info(); tables(); acc(); guide(); calcCard(); }
  function frame() { scene(); info(); route(); $("asU").value = Math.round(u * 1000); $("asPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }
  function go(n) { st = clamp(n, 0, STEPS.length - 1); u = 0; hold = 0; frame(); acc(); tables(); kpis(); }
  function startLoop() { if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!shown() || !playing) return;
      if (u < 1) { u = Math.min(1, u + dt / 6); if (now - lastDraw > 40 || u >= 1) { lastDraw = now; frame(); if (u >= 1) { acc(); tables(); } } }
      else { hold += dt; if (hold > 1.2) { hold = 0; if (st < STEPS.length - 1) go(st + 1); else { playing = false; frame(); } } } };
    requestAnimationFrame(loop); }
  const fbtn = (b) => { b.classList.toggle("on", !!F[b.dataset.asf]); b.textContent = (F[b.dataset.asf] ? "⚠ " : "") + FAULTS.find((y) => y[0] === b.dataset.asf)[1]; };
  $("asFaults").innerHTML = FAULTS.map(([k, l, w]) => `<button class="chip" data-asf="${k}" title="${esc(w)}">${esc(l)}</button>`).join("");
  $("asFaults").addEventListener("click", (ev) => { const b = ev.target.closest("[data-asf]"); if (!b) return; F[b.dataset.asf] = !F[b.dataset.asf]; fbtn(b); renderAll(); frame(); });
  $("asPlay").addEventListener("click", () => { playing = !playing; if (playing && st === STEPS.length - 1 && u >= 1) go(0); last = performance.now(); frame(); startLoop(); });
  $("asPrev").addEventListener("click", () => { playing = false; go(st - 1); });
  $("asNext").addEventListener("click", () => { playing = false; go(st + 1); });
  $("asU").addEventListener("input", (ev) => { playing = false; u = ev.target.value / 1000; frame(); });
  $("asRoute").addEventListener("click", (ev) => { const b = ev.target.closest("[data-asst]"); if (b) { playing = false; go(+b.dataset.asst); } });
  $("asRec").addEventListener("click", (ev) => { const b = ev.target.closest("[data-asst]"); if (b) { playing = false; go(+b.dataset.asst); } });
  $("asNew").addEventListener("click", () => { serial++; renderAll(); frame(); });
  api = { state: () => ({ k: STEPS[st].k, si: st, ori: STEPS[st].ori, no: st + 1, n: STEPS[st].n, u, M, R, PK, G, F, rec, ids, cut: $("as3dCut").checked, visible: shown() }), steps: STEPS, go: (n) => go(n - 1) };
  window.asmSP = api;
  $("as3dBtn").addEventListener("click", () => { const el = $("as3d"); el.hidden = !el.hidden; $("as3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view"; if (!el.hidden && !el.dataset.on) { el.dataset.on = "1"; import("./asmsp3d.js").then((m) => m.create(el, () => window.asmSP.state())); } });
  $("asExport").addEventListener("click", () => {
    const out = { spindle: ids.spu, shaft: ids.shaft, bearing_set_front: ids.setF, bearing_set_rear: ids.setR, spacer_pair: ids.spacer, motor_kit: ids.motor, front_bearing_housing: ids.hsgF, motor_housing: ids.hsgM, faults: Object.keys(F).filter((k) => F[k]),
      design: { nmax_rpm: M.nmax, Fclamp_kN: M.Fclamp, preload_N: M.Fpre, Uper_gmm: +R.Uper.toFixed(2), rotor_T_C: Math.round(R.Trot), springs: `${PK.n} = ${PK.ns} x ${PK.S.np}`, spring_force_clamped_N: Math.round(PK.Fc) },
      steps: STEPS.map((s, i) => ({ step: i + 1, name: s.n, minutes: s.t, fitters: s.men, equipment: s.eq.map((e) => `${e} ${EQ[e][0]}`), jigs: s.jig.map((j) => `${j} ${JIG[j][0]}`), checks: rec.out[s.k].map(([l, v, r]) => ({ check: l, value: v, result: r })) })),
      torques: TQ.map((t) => ({ joint: t[0], screws: t[1], cls: t[2], torque_Nm: t[3], sequence: t[4] })), verdict: rec.fails.length ? "REJECT" : "ACCEPTED", note: "simulated example values" };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" })); a.download = `${ids.spu}_assembly_record.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const prev = window.onTabShown;
  window.onTabShown = (name) => { if (prev) prev(name); if (name === "asm" && !box.hidden) { renderAll(); frame(); startLoop(); } };
  window.addEventListener("asitemshow", (e) => { if (e.detail === "2") { renderAll(); frame(); startLoop(); } });
  const q = new URLSearchParams(location.search);
  if (q.get("asf")) q.get("asf").split(",").forEach((k) => { if (FAULTS.some((y) => y[0] === k)) F[k] = true; });
  if (q.get("asst")) { st = clamp(parseInt(q.get("asst"), 10) - 1 || 0, 0, STEPS.length - 1); u = q.get("asu") ? clamp(parseFloat(q.get("asu")), 0, 1) : 1; }
  [...$("asFaults").children].forEach(fbtn);
  if (q.get("asitem") === "2") setTimeout(() => { if (box.hidden && window.asmTab) window.asmTab.showItem("2"); renderAll(); frame(); startLoop(); if (q.has("show3d")) setTimeout(() => { if ($("as3d").hidden) $("as3dBtn").click(); }, 300); }, 450);
}
export { STEPS as SP_ASM_STEPS };
