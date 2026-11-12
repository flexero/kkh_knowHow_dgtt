/* ASSEMBLY tab - item 1: DIGITAL TWIN of the rotary table (B-axis) ASSEMBLY.
   18 steps from kit check + cleaning to the ISO 230-2 acceptance test.  Each step: how to do it, the equipment to BUY,
   the jigs to MAKE (drawn on the cross-section of item 1), tightening torques + sequence, the check with its limit and a
   simulated measured value.  Assembly record with the real worm / wheel serials (items 2 + 3), 7 assembly faults, time +
   labour cost, equipment + jig list, torque table, assembly room layout.  Example values.  Offline, no libraries. */
import { sectionSVG, hmcCalc, HMC_DEF, apcCtx } from "./hmc.js";
import { $, esc, f, RAD, clamp, ease, rngOf, gauss, chart, svgOpen, txt, big, CL, CR } from "./wormmfg.js";

const W = 760, H = 500, K = 0.95, X = (x) => 380 + x * K, Y = (y) => 470 - y * K;
/* ------------------------------------------------------------------ equipment (BUY) + jigs (MAKE) */
const EQ = {
  E1: ["Clean assembly room", "BUY/BUILD", "20 ±1 °C, slight over-pressure, filtered air, no grinding/welding nearby, sealed (epoxy) floor, good light ≥ 750 lx"],
  E2: ["Parts washer + ultrasonic tank", "BUY", "aqueous spray-rinse-dry cabinet for housing/table (≥ Ø800 basket); ultrasonic tank for small parts; residual dirt check (filter patch)"],
  E3: ["Temperature soak rack", "BUY", "rack in the assembly room; parts rest ≥ 12 h to reach 20 °C before measuring"],
  E4: ["Crane with chain hoist 1 t", "BUY", "bridge or jib crane, chain hoist with 2 speeds, slow speed ≤ 0.5 m/min for precise lowering, round slings + shackles (load chart)"],
  E5: ["Assembly plate / granite plate", "BUY", "cast-iron T-slot plate or granite 1000 × 1000, flatness grade 0–1, on levelling feet"],
  E6: ["Precision level", "BUY", "machinist or electronic level, resolution 0.02 mm/m"],
  E7: ["Dial indicators + stands", "BUY", "4 × dial / test indicator 0.001 mm, magnetic + articulating stands"],
  E8: ["Torque wrenches", "BUY", "calibrated to ISO 6789: 1–5, 5–60, 20–100, 60–340 N·m; torque marking pen"],
  E9: ["Induction bearing heater", "BUY", "temperature controlled (max 110 °C for bearings), auto demagnetise"],
  E10: ["Hydraulic hand test pump", "BUY", "0–16 MPa, digital pressure transducer 0.1 % (or gauge class 0.25 – class 0.6 = ±0.1 MPa is as big as the leak limit), hoses + quick couplings, test oil = system oil"],
  E11: ["Load cell + indicator", "BUY", "0–5 kN, accuracy 0.5 %, for the clamp torque test with the lever"],
  E12: ["Autocollimator + polygon (or laser + rotary calibrator)", "BUY / RENT / SERVICE", "autocollimator resolution ≤ 0.1″ + calibrated 24-face polygon; or laser interferometer with a rotary calibrator; calibration certificate"],
  E13: ["Height gauge + gauge blocks", "BUY", "digital height gauge 0.001, gauge block set grade 1"],
  E14: ["Micrometers + depth micrometer, feeler gauges", "BUY", "0–25 / 25–50 mm (0.001), depth micrometer 0–25, feeler set 0.02–1 mm"],
  E15: ["Marking paste, assembly oil + grease, thread locker", "BUY", "Prussian blue paste; bearing grease as bearing catalogue; medium-strength thread locker; lint-free cloths, nitrile gloves"],
  E16: ["Surface grinder", "BUY (workshop)", "to grind the spacer ring to ±0.002 mm, parallelism 0.002"],
  E17: ["Servo drive + commissioning PC", "BUY (with the servo)", "drive tuning software, scope function, thermocouples + data logger"],
  E18: ["Encoder diagnostic kit", "BUY (from the encoder maker)", "shows signal amplitude / quality per read head"],
  E19: ["Grinder for the table top", "BUY / SERVICE", "large surface or vertical grinder where the table can turn with its own servo while it is ground (or grind on the HMC later)"],
  E20: ["Barcode / DataMatrix scanner + MES tablet", "BUY", "scan the serials into the assembly record"],
};
const JIG = {
  J1: ["Rotatable assembly stand", "trunnion stand, load ≥ 500 kg, turns the housing 180° (access from below for the worm wheel), locking pin every 90°, adapter plate bolted to the housing base"],
  J2: ["Lifting beam for the table", "3-point spreader beam with 3 eye bolts M12 (DIN 580) screwed into the table, adjustable to the centre of gravity → the table hangs level"],
  J3: ["Guide studs (3×)", "3 × M10 studs, length 250, with a turned guide part Ø10.5 h9 that passes the Ø11 screw holes of the table; screwed into 3 inner-ring threads (120°) → the table goes down straight without hitting the bearing"],
  J4: ["Bearing lifting ring", "ring with 3 hooks under the bearing outer ring; transport screws of the bearing stay in until the bearing is bolted (never separate the rings)"],
  J5: ["Mid-plane setting mandrel + bridge", "EXPANDING mandrel (or a ground mandrel selectively fitted to the measured worm bore, clearance ≤ 3 µm – a normal g5/H6 fit is too loose) + height-gauge bridge on the wheel face → measures wheel mid-plane vs. worm axis to 0.005 mm"],
  J6: ["Worm cartridge preload fixture", "holds the fixed-side cartridge, applies the KM nut torque, measures the bearing friction torque with a torque gauge"],
  J7: ["Spacer measuring bridge", "depth-micrometer bridge over the cartridge flange → gap = spacer thickness"],
  J8: ["Encoder centring arm", "dial-gauge holder clamped to the housing, reaches the scale ring; read-head gap gauge (plastic spacer of the encoder maker)"],
  J9: ["Torque test lever", "1.0 m steel arm bolted to the table with 4 × M16 10.9 on Ø300 (check against the real table holes), load cell at the end: T = F · L; motor coupling OPEN so the worm turns freely – the clamp alone must hold (else the worm teeth carry the test torque)"],
  J10: ["Hydraulic test adapter plate", "plate with quick couplings for the clamp ring and the rotary union ports, plugs, bleed screw"],
  J11: ["Test pallet + mirror holder", "pallet with pull studs for the zero-point modules, holder for the polygon / mirror on the table axis"],
  J12: ["Grinding driver", "connects the table servo (or a separate drive) so that the table turns slowly while its top is ground"],
};
const TQ = [ // joint, screws, class, torque N·m (μ ≈ 0.12, check doc 14 + the part catalogue), sequence
  ["Housing → assembly stand adapter", "8 × M16", "10.9", 285, "crosswise, 2 stages"],
  ["Main bearing outer ring → housing", "24 × M10", "10.9", 67, "crosswise in 3 stages 30 / 70 / 100 % (use the BEARING catalogue value if different)"],
  ["Table / hub sleeve → bearing inner ring", "24 × M10", "10.9", 67, "crosswise in 3 stages, table turned between stages"],
  ["Worm wheel → hub sleeve", "12 × M10 + 2 dowels Ø10", "10.9", 67, "dowels first, then crosswise in 3 stages"],
  ["Worm cartridge flange (fixed side)", "6 × M8", "10.9", 34, "crosswise"],
  ["Worm bearing KM lock nut", "KM nut (size per worm journal, e.g. KM5 = M25×1.5)", "–", "preload by friction torque", "tighten to the friction torque in the bearing catalogue, then lock"],
  ["Clamp ring → housing", "16 × M8", "10.9", 34, "crosswise, before the pressure test"],
  ["Encoder scale ring → sleeve", "8 × M4", "8.8", 2.8, "lightly, centre, then final torque"],
  ["Zero-point modules → table", "4 × 4 × M8", "12.9", 40, "as the module catalogue"],
  ["Covers, labyrinth", "M6", "8.8", 9.5, "–"],
];
/* ------------------------------------------------------------------ assembly steps (hs = step of the item-1 section drawing) */
const STEPS = [
  { k: "kit", ph: "Prepare", hs: 0, n: "Kit check + traceability", t: 30, men: 1, eq: ["E20"], jig: [], how: ["Scan every part serial into the assembly record (housing, table, bearing, worm WRM + wheel WHL = pair P, cartridges, clamp, encoder, union)", "Check the CMM reports / part records are released (no open NCR)", "Worm + wheel must carry the SAME pair number"] },
  { k: "clean", ph: "Prepare", hs: 0, n: "Wash, deburr, soak at 20 °C", t: 90, men: 1, eq: ["E1", "E2", "E3"], jig: [], how: ["Deburr all edges, blow out every oil channel and thread", "Wash (spray + rinse + dry), small parts in the ultrasonic tank", "Filter-patch test on the housing (cleanliness)", "Soak ≥ 12 h at 20 °C on the rack before measuring"] },
  { k: "level", ph: "Base", hs: 0, n: "Housing on the assembly stand, level", t: 45, men: 2, eq: ["E4", "E5", "E6", "E8"], jig: ["J1"], how: ["Lift the housing with round slings, bolt it to the stand adapter (8 × M16, 285 N·m)", "Level the stand: 2 directions, ≤ 0.02 mm/m", "Clean the bearing seat once more with lint-free cloth + alcohol"] },
  { k: "bearing", ph: "Bearing + table", hs: 1, n: "Fit the main axial-radial bearing", t: 60, men: 2, eq: ["E4", "E7", "E8", "E15"], jig: ["J4"], how: ["Lift with the bearing ring, transport screws IN; lower onto the seat without tilting", "Screw in all 24 screws by hand; tighten crosswise 30 % → 70 % → 100 % (67 N·m)", "Remove the transport screws only now", "Measure axial runout of the bearing face (dial, turn the inner ring)"] },
  { k: "table", ph: "Bearing + table", hs: 2, n: "Lower the table, bolt to the inner ring", t: 60, men: 2, eq: ["E4", "E7", "E8"], jig: ["J2", "J3"], how: ["Screw the 3 guide studs into the inner ring", "Lift the table level with the lifting beam, lower on slow speed over the studs", "24 screws crosswise in 3 stages; turn the table by hand between the stages", "Measure radial + axial runout of the table top (dial at Ø500)"] },
  { k: "wheel", ph: "Drive", hs: 3, n: "Worm wheel to the hub sleeve (from below)", t: 90, men: 2, eq: ["E7", "E8", "E13"], jig: ["J1", "J5"], how: ["Turn the housing 180° on the stand", "Put the setting mandrel into the worm bores", "Fit the wheel with shims, 2 dowels, 12 × M10 (67 N·m crosswise)", "Measure wheel runout and the MID-PLANE vs. the mandrel; correct the shims"] },
  { k: "worm", ph: "Drive", hs: 4, n: "Worm + bearing cartridges", t: 90, men: 2, eq: ["E8", "E9", "E15"], jig: ["J6"], how: ["Heat the angular-contact pair inner rings (≤ 110 °C), mount back-to-back on the worm", "Preload with the KM nut to the catalogue friction torque, lock it", "Insert the worm from the side, fit the fixed-side flange (6 × M8, 34 N·m) and the floating needle bearing", "Check: worm axial play 0, friction torque in range"] },
  { k: "mesh", ph: "Drive", hs: 5, n: "Contact pattern", t: 60, men: 1, eq: ["E15"], jig: [], how: ["Thin marking paste on 3 worm turns", "Turn the worm by hand both directions, light brake on the table", "Read the pattern on the wheel: centred, ≥ 60 %, slightly to the exit side", "If off centre along the face → change the wheel shims (mid-plane) and repeat"] },
  { k: "back", ph: "Drive", hs: 6, n: "Backlash: grind the spacer ring", t: 120, men: 1, eq: ["E7", "E14", "E16"], jig: ["J7"], how: ["Lock the worm, dial at the table edge (Ø500), turn the table + / − → backlash", "Measure at 4 table positions (90°), use the SMALLEST value", "Shift needed s = (j − j_target) / (Δp / pₓ); measure the gap with the bridge", "Grind the spacer to size, refit, measure again: 5–10 µm"] },
  { k: "clamp", ph: "Clamp + encoder", hs: 7, n: "Hydraulic clamp: fit, pressure + torque test", t: 90, men: 2, eq: ["E8", "E10", "E11", "E12"], jig: ["J9", "J10"], how: ["Oil the O-rings, fit clamp ring + disc (16 × M8, 34 N·m)", "Pressure test 1.5 × p for 10 min with the hand pump: no leak, no drop", "Torque test: motor coupling open (worm free), lever + load cell to the holding torque, table must not move", "Angle change when clamping ≤ 1″ (autocollimator)"] },
  { k: "encoder", ph: "Clamp + encoder", hs: 8, n: "Angle encoder: centre the scale, set 2 heads", t: 60, men: 1, eq: ["E7", "E18"], jig: ["J8"], how: ["Fit the scale ring lightly, centre with the dial arm: radial runout ≤ 5 µm", "Tighten 8 × M4 (2.8 N·m) crosswise, measure again", "Fit the 2 read heads exactly opposite, set the gap with the gauge", "Check signal amplitude on both heads with the diagnostic kit"] },
  { k: "union", ph: "Media", hs: 9, n: "Rotary union + leak test", t: 45, men: 1, eq: ["E10"], jig: ["J10"], how: ["Fit the rotary union with its anti-rotation pin", "Pressure test every passage 1.5 × p, leakage ≤ catalogue", "Turning torque of the table not increased"] },
  { k: "seal", ph: "Media", hs: 10, n: "Seals, labyrinth, sealing air, oil fill", t: 45, men: 1, eq: ["E15"], jig: [], how: ["Fit labyrinth cover + seals (lip seal lips oiled)", "Sealing air 0.5 bar → check it blows out of the labyrinth", "Fill worm-gear oil to the sight glass (ISO VG 220–460)"] },
  { k: "zp", ph: "Media", hs: 11, n: "Zero-point modules", t: 60, men: 1, eq: ["E8", "E10"], jig: ["J11"], how: ["Fit 4 modules (catalogue torque), connect the channels", "Release / clamp test with the test pallet, seat-check air works"] },
  { k: "grind", ph: "Finish", hs: 12, n: "Grind the table top in its own bearing", t: 240, men: 1, eq: ["E19", "E7"], jig: ["J12"], how: ["Mount the table unit on the grinder, drive the table slowly with its own servo", "Grind the top + module faces (the table turns in ITS bearing → errors of the bearing are ground out)", "Flatness ≤ 5 µm, parallel to the base ≤ 10 µm, module faces same height ±3 µm"] },
  { k: "runin", ph: "Test", hs: 13, n: "Servo tuning + 2 h run-in", t: 180, men: 1, eq: ["E17"], jig: [], how: ["Connect servo + encoder, tune the position loop with the direct encoder", "Run 2 h with changing speed + direction, log temperatures", "Temperature rise ≤ 15 K, no noise peaks, oil level OK"] },
  { k: "iso", ph: "Test", hs: 13, n: "Acceptance: ISO 230-2 positioning + geometry", t: 240, men: 1, eq: ["E12", "E7"], jig: ["J11"], how: ["Polygon / mirror on the table axis, autocollimator fixed", "24 positions (15°), 5 runs each direction", "Compute accuracy A, repeatability R, reversal B; table runout + flatness", "Sign the protocol"] },
  { k: "pack", ph: "Test", hs: 13, n: "Record, mark, pack", t: 60, men: 1, eq: ["E20"], jig: [], how: ["Close the assembly record (all measured values, serials, signatures)", "Type plate RT-YYWW-nnnnn, oil level sticker, transport lock on the table", "Rust protection, cover, crate"] },
];
const FAULTS = [
  ["dirt", "Dirt / chip on the bearing seat", "bearing axial runout too high at step 4"],
  ["seq", "Table screws tightened in a circle (not crosswise)", "table runout at step 5"],
  ["shim", "Wrong wheel shim (mid-plane +0.15 mm)", "mid-plane at step 6, pattern at step 8"],
  ["spacer", "Spacer ground with the wrong sign", "backlash check at step 9 (gear loose), reversal B at step 17"],
  ["seal", "Clamp O-ring cut during fitting", "pressure test at step 10"],
  ["enc", "Encoder scale not centred (20 µm)", "scale runout at step 11, accuracy at step 17"],
  ["oil", "Oil not filled", "temperature + noise at the run-in (step 16)"],
];

/* ------------------------------------------------------------------ simulation (assembly record of one table) */
function simulate(M, R1, F, seed, pairs) {
  const r = rngOf(seed + 313), N = (m, s) => m + s * gauss(r), A = Math.abs, out = {};
  const add = (k, rows) => { out[k] = rows; };
  const w = pairs.worm, wh = pairs.wheel;
  add("kit", [["Pair number worm = wheel", `${w} + ${wh}`, "ok"], ["Open NCRs on parts", "0", "ok"]]);
  const patch = A(N(1.5, 0.5)); add("clean", [["Filter patch residue", `${f(patch, 1)} mg (≤ 5)`, patch <= 5 ? "ok" : "bad"], ["Soak time", "≥ 12 h at 20 ±1 °C", "ok"]]);
  const lev = A(N(0.008, 0.004)); add("level", [["Level (2 directions)", `${f(lev, 3)} mm/m (≤ 0.02)`, lev <= 0.02 ? "ok" : "bad"]]);
  const bAx = A(N(1.6, 0.5)) + (F.dirt ? 6 : 0); add("bearing", [["Bearing face axial runout", `${f(bAx, 1)} µm (≤ 3)`, bAx <= 3 ? "ok" : "bad"], ["Screw torque", "24 × 67 N·m, 3 stages, marked", "ok"]]);
  const tRad = A(N(2.8, 0.9)) + (F.seq ? 4.5 : 0) + (F.dirt ? 3 : 0), tAx = A(N(2.5, 0.8)) + (F.seq ? 5.5 : 0) + (F.dirt ? 4 : 0);
  add("table", [["Table top radial runout", `${f(tRad, 1)} µm (≤ 5)`, tRad <= 5 ? "ok" : "bad"], ["Table top axial runout", `${f(tAx, 1)} µm (≤ 5)`, tAx <= 5 ? "ok" : "bad"]]);
  const wRun = A(N(5, 1.8)), mid = N(0, 0.007) + (F.shim ? 0.15 : 0); add("wheel", [["Wheel runout radial / axial", `${f(wRun, 1)} µm (≤ 10)`, wRun <= 10 ? "ok" : "bad"], ["Mid-plane vs worm axis", `${f(mid, 3)} mm (±0.02)`, A(mid) <= 0.02 ? "ok" : "bad"]]);
  const fric = N(0.36, 0.04), play = A(N(0.5, 0.4)); add("worm", [["Worm bearing friction torque", `${f(fric, 2)} N·m (0.25–0.50)`, fric >= 0.25 && fric <= 0.5 ? "ok" : "bad"], ["Worm axial play", `${f(play, 1)} µm (≤ 2)`, play <= 2 ? "ok" : "bad"]]);
  const px = Math.PI * M.m, dxp = clamp(mid / 0.5, -0.45, 0.45), size = clamp(0.72 - A(dxp) * 0.4, 0.3, 0.8);
  add("mesh", [["Contact pattern", `${f(dxp * 100, 0)} % along the face, ${f(size * 100, 0)} % size`, A(dxp) <= 0.15 ? "ok" : "bad"]]);
  const j0 = (M.j0 + N(0, 0.004)) * 1000, slope = M.dp / px * 1000, sNeed = (j0 - M.jt * 1000) / slope, sErr = N(0, 0.03);
  const jF = F.spacer ? j0 + sNeed * slope : j0 - (sNeed + sErr) * slope;
  add("back", [["Backlash before (smallest of 4)", `${f(j0, 1)} µm`, "info"], ["Spacer thickness change", `${f(sNeed, 2)} mm = (j − ${M.jt * 1000}) / ${f(slope, 2)}`, "info"], ["Backlash after grinding", F.spacer ? `${f(jF, 1)} µm – TOO LOOSE (wrong sign)` : `${f(jF, 1)} µm (5–10)`, jF >= 5 && jF <= 10 ? "ok" : jF >= 3 && jF <= 12 ? "warn" : "bad"]]);
  const drop = F.seal ? 0.8 : A(N(0.02, 0.01)), Thold = M.Tcl * N(1.08, 0.03), dAng = A(N(0.4, 0.2));
  add("clamp", [["Pressure test 1.5 × p, 10 min", `drop ${f(drop, 2)} MPa (≤ 0.1)`, drop <= 0.1 ? "ok" : "bad"], ["Holding torque (lever + load cell)", `${f(Thold, 0)} N·m (≥ ${M.Tcl})`, Thold >= M.Tcl ? "ok" : "bad"], ["Angle change when clamping", `${f(dAng, 1)}″ (≤ 1)`, dAng <= 1 ? "ok" : "bad"]]);
  const sRun = A(N(2.8, 1)) + (F.enc ? 18 : 0); add("encoder", [["Scale ring radial runout", `${f(sRun, 1)} µm (≤ 5)`, sRun <= 5 ? "ok" : "bad"], ["Signal amplitude head 1 / 2", F.enc ? "72 % / 118 % (unequal)" : "98 % / 101 %", F.enc ? "warn" : "ok"]]);
  add("union", [["Leak test all passages", "within catalogue", "ok"]]);
  add("seal", [["Oil level", F.oil ? "EMPTY (not filled)" : "at the sight glass", F.oil ? "bad" : "ok"], ["Sealing air", "0.5 bar, blows out", "ok"]]);
  add("zp", [["Clamp / release test", "4 modules OK, seat check OK", "ok"]]);
  const flat = A(N(3, 0.9)), modH = A(N(1.4, 0.6)); add("grind", [["Table top flatness", `${f(flat, 1)} µm (≤ 5)`, flat <= 5 ? "ok" : "bad"], ["Module faces same height", `±${f(modH, 1)} µm (±3)`, modH <= 3 ? "ok" : "bad"]]);
  const trT = []; let T = 0; const Tmax = (F.oil ? 34 : 9) + N(0, 1.2);
  for (let t = 0; t <= 120; t += 2) { T = Tmax * (1 - Math.exp(-t / 28)); trT.push([t, T]); }
  add("runin", [["Temperature rise after 2 h", `${f(Tmax, 1)} K (≤ 15)`, Tmax <= 15 ? "ok" : "bad"], ["Noise", F.oil ? "squeal at the worm" : "no peaks", F.oil ? "bad" : "ok"]]);
  // ISO 230-2: 24 targets, 5 runs each direction; systematic = encoder graduation error + eccentric residue
  const enc = R1 ? Math.min(2.5, R1.accEnc) : 2.5, ph = r() * 6.28, ecc2 = F.enc ? 3.2 : 0.2, Bm = F.spacer ? 2.6 : 0.6, s = 0.17;
  const pos = Array.from({ length: 25 }, (_, i) => i * 15), sys = (a) => enc * 0.4 * Math.sin(a * RAD + ph) + 0.35 * Math.sin(3 * a * RAD) + ecc2 * Math.sin(2 * a * RAD + 1);
  const up = pos.map((a) => { const v = Array.from({ length: 5 }, () => sys(a) + Bm / 2 + N(0, s)); return [a, v]; }), dn = pos.map((a) => { const v = Array.from({ length: 5 }, () => sys(a) - Bm / 2 + N(0, s)); return [a, v]; });
  const mean = (v) => v.reduce((x, y) => x + y, 0) / v.length, sd = (v) => { const m = mean(v); return Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / (v.length - 1)); };
  const mu = up.map(([a, v]) => [a, mean(v)]), md = dn.map(([a, v]) => [a, mean(v)]);
  const hi = Math.max(...up.map(([, v]) => mean(v) + 2 * sd(v)), ...dn.map(([, v]) => mean(v) + 2 * sd(v))), lo = Math.min(...up.map(([, v]) => mean(v) - 2 * sd(v)), ...dn.map(([, v]) => mean(v) - 2 * sd(v)));
  const Aacc = hi - lo, Rr = Math.max(...up.map(([, v]) => 4 * sd(v)), ...dn.map(([, v]) => 4 * sd(v))), Bb = Math.max(...mu.map(([, m], i) => A(m - md[i][1])));
  const accLim = R1 ? Math.max(5, Math.ceil(R1.accEnc)) : 5;
  add("iso", [["Accuracy A (bidirectional)", `${f(Aacc, 1)}″ (≤ ${accLim})`, Aacc <= accLim ? "ok" : "bad"], ["Repeatability R", `${f(Rr, 1)}″ (≤ 2)`, Rr <= 2 ? "ok" : "bad"], ["Reversal B", `${f(Bb, 1)}″ (≤ 2)`, Bb <= 2 ? "ok" : "bad"], ["Table runout / flatness", `${f(tRad, 1)} / ${f(flat, 1)} µm`, tRad <= 5 && flat <= 5 ? "ok" : "bad"]]);
  add("pack", [["Assembly record", "complete, signed", "ok"]]);
  const fails = [], warns = []; STEPS.forEach((st, i) => out[st.k].forEach((x) => { if (x[2] === "bad") fails.push({ i, l: x[0] }); else if (x[2] === "warn") warns.push({ i, l: x[0] }); }));
  return { out, fails, warns, trT, mu, md, up, dn, Aacc, Rr, Bb, accLim, sNeed, dxp, size, mid, jF };
}

/* ------------------------------------------------------------------ jig overlays on the item-1 cross-section */
function overlay(k, u, M, R1) {
  const a = R1 ? R1.a : 205, d = (1 - ease(Math.min(1, u * 1.6))) * 80;
  const lbl = (x, y, t) => `<text x="${x}" y="${y}" class="apc-t" style="fill:var(--accent);font-weight:600">${esc(t)}</text>`;
  const tw = (x, y) => `<g transform="translate(${x},${y}) rotate(-20)"><rect x="0" y="-4" width="70" height="8" rx="3" fill="#3a6ea8"/><rect x="-6" y="-8" width="12" height="16" rx="2" fill="#26486e"/></g>`;
  const dial = (x, y) => `<circle cx="${x}" cy="${y}" r="10" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/><line x1="${x}" y1="${y}" x2="${x + 6}" y2="${y - 6}" stroke="var(--accent)"/>`;
  switch (k) {
    case "level": return `<rect x="${X(-120)}" y="${Y(25) - 22}" width="90" height="14" rx="3" fill="#e0b040" stroke="#7a5a10"/>${lbl(X(-120), Y(25) - 28, "precision level 0.02 mm/m")}<rect x="${X(-360)}" y="${Y(-8)}" width="${720 * K}" height="10" fill="#666"/>${lbl(X(-360), Y(-8) + 24, "J1 rotatable assembly stand (adapter plate)")}`;
    case "bearing": return `<path d="M${X(-175)},${Y(290) - d} L${X(-175)},${Y(380) - d} L${X(175)},${Y(380) - d} L${X(175)},${Y(290) - d}" fill="none" stroke="var(--accent)" stroke-width="3"/><line x1="${X(0)}" y1="${Y(380) - d}" x2="${X(0)}" y2="20" stroke="#555" stroke-width="2"/>${lbl(X(185), Y(360) - d, "J4 bearing lifting ring (transport screws IN)")}${tw(X(-140), Y(286))}${lbl(X(-345), Y(300), "torque wrench 67 N·m, 3 stages")}`;
    case "table": return `${[-150, 150].map((x) => `<line x1="${X(x)}" y1="${Y(275)}" x2="${X(x)}" y2="${Y(420)}" stroke="var(--accent)" stroke-width="4"/>`).join("")}<rect x="${X(-300)}" y="${Y(435) - d}" width="${600 * K}" height="10" fill="#3a6ea8"/>${[-250, 0, 250].map((x) => `<line x1="${X(x)}" y1="${Y(435) - d + 10}" x2="${X(x)}" y2="${Y(345) - d}" stroke="#555"/>`).join("")}<line x1="${X(0)}" y1="${Y(435) - d}" x2="${X(0)}" y2="30" stroke="#555" stroke-width="2"/>${lbl(X(160), Y(400), "J3 guide studs")}${lbl(X(-300), Y(435) - d - 6, "J2 lifting beam (3-point, level)")}${dial(X(300), Y(330))}`;
    case "wheel": return `<circle cx="${X(a)}" cy="${Y(120)}" r="${10 * K}" fill="#3a6ea8"/><line x1="${X(a)}" y1="${Y(120)}" x2="${X(a + 140)}" y2="${Y(120)}" stroke="#3a6ea8" stroke-width="6"/>${lbl(X(a - 120), Y(60), "J5 setting mandrel in the worm bores")}<rect x="${X(150)}" y="${Y(160)}" width="50" height="8" fill="#e0b040"/>${lbl(X(-345), Y(60), "housing turned 180° on J1 – wheel fitted from below")}${dial(X(184), Y(150))}`;
    case "worm": return `<rect x="${X(a + 40) + d}" y="${Y(150)}" width="70" height="${60 * K}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-dasharray="5 3"/>${lbl(X(a - 60), Y(180), "J6 cartridge preload fixture · bearing heater ≤ 110 °C")}`;
    case "mesh": return `${lbl(X(-345), Y(60), "marking paste on 3 worm turns, turn by hand both ways")}<circle cx="${X(184)}" cy="${Y(102)}" r="16" fill="#2f6fb0" opacity="${0.2 + 0.5 * u}"/>`;
    case "back": return `${dial(X(300), Y(330))}${lbl(X(205), Y(352), "dial 0.001 at Ø500")}<rect x="${X(a + 50)}" y="${Y(150)}" width="12" height="${60 * K}" fill="#e0b040" stroke="#7a5a10"/>${lbl(X(a - 80), Y(185), "J7 bridge → spacer thickness → surface grinder")}`;
    case "clamp": return `<rect x="${X(310)}" y="${Y(200)}" width="40" height="26" fill="#556"/><path d="M${X(310)},${Y(195)} Q${X(300)},${Y(230)} ${X(272)},${Y(240)}" fill="none" stroke="#c33" stroke-width="3"/>${lbl(X(320), Y(210), "test pump 1.5 × p (J10)")}<line x1="${X(0)}" y1="${Y(350)}" x2="${X(380)}" y2="${Y(350)}" stroke="#555" stroke-width="6"/>${lbl(X(150), Y(362), "J9 lever 1.0 m + load cell")}`;
    case "encoder": return `<line x1="${X(-60)}" y1="${Y(195)}" x2="${X(-100)}" y2="${Y(195)}" stroke="#555" stroke-width="3"/>${dial(X(-62), Y(195))}${lbl(X(-345), Y(215), "J8 centring arm: runout ≤ 5 µm")}`;
    case "union": return `${lbl(X(-345), Y(60), "J10 test plate: every passage 1.5 × p")}`;
    case "seal": return `${lbl(X(200), Y(280), "oil to the sight glass")}`;
    case "zp": return `${lbl(X(-345), Y(440), "J11 test pallet: clamp / release / seat check")}`;
    case "grind": return `<rect x="${X(-200 + u * 300)}" y="${Y(400)}" width="90" height="40" rx="6" fill="#c9b48f" stroke="#7a6a4a"/>${lbl(X(-345), Y(440), "grinder: table turns in ITS bearing (J12)")}`;
    default: return "";
  }
}
function prepScene(k, u, rec, pairs) {
  let s = svgOpen(k === "kit" ? "Step 1 · Kit check + traceability" : "Step 2 · Wash, deburr, soak at 20 °C", "assembly room");
  if (k === "kit") {
    const parts = [["Housing", "HSG-2546-00003"], ["Table + hub sleeve", "TBL-2546-00003"], ["Axial-radial bearing", "B-BRG-00012 (lot)"], ["Worm (pair)", pairs.worm], ["Worm wheel (pair)", pairs.wheel], ["Worm cartridges + spacer", "CTG-2546-00006/7"], ["Clamp ring + disc", "CLR-2546-00003"], ["Angle encoder", "B-ENC-… serial"], ["Rotary union", "B-RUN-… serial"], ["Zero-point modules (4)", "B-ZPM-…"]];
    parts.forEach(([n, sn], i) => { const ok = u * parts.length > i; s += `<rect x="40" y="${40 + i * 31}" width="680" height="26" rx="4" fill="var(--surface)" stroke="var(--border)"/>${txt(52, 58 + i * 31, n)}<text x="330" y="${58 + i * 31}" class="apc-t" style="font-family:monospace">${esc(sn)}</text>${ok ? `<text x="690" y="${58 + i * 31}" class="apc-t" style="fill:var(--good-text);font-weight:700">✓</text>` : ""}`; });
    s += txt(40, 365, "Scanned into the assembly record. Worm and wheel must carry the SAME pair number (matched pair from items 2 + 3).");
  } else {
    s += `<rect x="40" y="60" width="220" height="200" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(50, 80, "parts washer", "font-weight:600")}`;
    for (let i = 0; i < 12; i++) s += `<line x1="${70 + i * 15}" y1="90" x2="${66 + i * 15 + Math.sin(u * 30 + i) * 6}" y2="${120 + (u * 400 + i * 20) % 100}" stroke="#4aa3df" stroke-width="2"/>`;
    s += `<rect x="90" y="200" width="120" height="40" fill="#9aa4ae" stroke="#444"/><rect x="300" y="60" width="200" height="200" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/>${txt(310, 80, "soak rack 20 ±1 °C, ≥ 12 h", "font-weight:600")}`;
    for (let i = 0; i < 3; i++) s += `<rect x="320" y="${100 + i * 50}" width="160" height="30" fill="#9aa4ae" stroke="#444"/>`;
    s += big(540, 110, `${f(20 + 8 * Math.exp(-u * 4), 1)} °C`) + txt(540, 132, "part temperature") + txt(540, 160, "1 K on Ø300 steel = 3.5 µm") + txt(540, 178, "→ measure only at 20 °C") + txt(40, 300, `filter patch: ${rec.out.clean[0][1]}`);
  }
  return s + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const box = $("arItem1");
if (box) {
  box.innerHTML = `
    <div class="kpis" id="arKpis"></div>
    <div class="card"><div class="card-head"><h2>Assembly twin – rotary table (B-axis)</h2><span class="sub">click a step · jigs drawn in blue · faults change the simulated measurements</span></div>
      <div class="wm-route" id="arRoute"></div>
      <div class="apc3d-bar"><button class="btn primary" id="arPlay">▶ Play all</button><button class="btn ghost" id="arPrev">◀</button><button class="btn ghost" id="arNext">▶|</button>
        <input type="range" id="arU" min="0" max="1000" value="0" style="max-width:220px" aria-label="Progress"><button class="btn ghost" id="arNew">New table (random)</button><button class="btn ghost" id="arExport">Download assembly record</button></div>
      <div class="dk-step" id="arStep"></div>
      <div class="hr-grid"><div id="arScene"></div><div class="apc3d-info" id="arInfo"></div></div>
      <div class="apc3d-bar" style="margin-top:8px"><button class="btn ghost" id="ar3dBtn">Show 3D view</button><label class="small"><input type="checkbox" id="ar3dCut" checked> quarter cut</label><span class="small muted">3D follows the same step + progress · jigs in blue</span></div>
      <div class="mf3d" id="ar3d" hidden></div>
      <div class="wm-faults-wrap"><span class="tb-label">Inject an assembly fault:</span><div class="wm-faults" id="arFaults"></div></div></div>
    <div class="card"><div class="card-head"><h2>Acceptance + run-in</h2><span class="sub" id="arAccSub"></span></div><div class="wm-charts" id="arAcc"></div></div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Assembly record – steps, time, result</h2></div><div class="table-wrap"><table class="apc-bom" id="arRec"></table></div></div>
      <div class="card"><div class="card-head"><h2>Tightening torques + sequence</h2><span class="sub">μ ≈ 0.12, oiled thread – check doc 14 + catalogue</span></div><div class="table-wrap"><table class="apc-bom" id="arTq"></table></div></div></div>
    <div class="card"><div class="card-head"><h2>Equipment to BUY</h2><span class="sub">required capability (examples)</span></div><div class="table-wrap"><table class="apc-bom wm-eq" id="arEq"></table></div></div>
    <div class="card"><div class="card-head"><h2>Jigs + fixtures to MAKE</h2></div><div class="table-wrap"><table class="apc-bom wm-eq" id="arJig"></table></div></div>
    <div class="card"><div class="card-head"><h2>Assembly room layout (example)</h2></div><div class="dk-svg" id="arLay"></div></div>
    <div class="card"><div class="card-head"><h2>Guide – assembly rules + faults</h2></div><div id="arGuide" class="mx-guide"></div></div>`;
  let F = {}, serial = 1, st = 0, u = 0, playing = false, last = performance.now(), started = false, hold = 0, rec = null, M = { ...HMC_DEF }, R1 = null, pairs = {}, lastDraw = 0;
  const pane = $("tab-asm"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad", info: "wm-info" }, ico = { ok: "✓", warn: "!", bad: "✕", info: "i" }, rate = 45;
  const chk = (rows) => rows.map(([l, v, s]) => `<div class="apc-chk ${cls[s]}"><b>${ico[s]}</b><span>${esc(l)}</span><span class="muted">${esc(v)}</span></div>`).join("");
  const sstat = (k) => { const r = rec.out[k]; return r.some((x) => x[2] === "bad") ? "bad" : r.some((x) => x[2] === "warn") ? "warn" : "ok"; };
  function compute() {
    M = window.HMCROT ? { ...window.HMCROT.M } : { ...HMC_DEF }; R1 = window.HMCROT ? window.HMCROT.R : hmcCalc(M, apcCtx());
    const w = window.wormMfg && window.wormMfg.current ? window.wormMfg.current() : null;
    pairs = { worm: w && w.R ? `WRM-2546-${String(w.R.sn).padStart(5, "0")}` : "WRM-2546-00001", wheel: "WHL-2546-00001", pair: "P-2546-00001", table: `RT-2546-${String(serial).padStart(5, "0")}` };
    rec = simulate(M, R1, F, 4000 + serial, pairs);
  }
  function kpis() {
    const hrs = STEPS.reduce((a, s) => a + s.t * s.men, 0) / 60, s = rec.fails.length ? `REJECT at step ${rec.fails[0].i + 1}` : rec.warns.length ? "accepted, warnings" : "accepted";
    $("arKpis").innerHTML = [["Rotary table", pairs.table, `pair ${pairs.pair}`], ["Status", s, rec.fails.length ? rec.fails.map((x) => x.l).slice(0, 2).join(" · ") : "all checks passed"], ["Labour", f(hrs, 1) + " h", `${f(STEPS.reduce((a, s) => a + s.t, 0) / 60, 1)} h lead time + 12 h soak`],
      ["Labour cost", "$" + f(hrs * rate, 0), `${rate} $/h (example)`], ["Accuracy A", f(rec.Aacc, 1) + "″", `limit ${rec.accLim}″ · R ${f(rec.Rr, 1)}″ · B ${f(rec.Bb, 1)}″`], ["Backlash", f(rec.jF, 1) + " µm", `spacer change ${f(rec.sNeed, 2)} mm`]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
  }
  function route() {
    $("arRoute").innerHTML = STEPS.map((s, i) => { const done = i < st || (i === st && u >= 1), r = done ? sstat(s.k) : ""; return `<button class="wm-op${i === st ? " on" : ""}${done ? " done" : ""}${r === "bad" || r === "warn" ? " " + r : ""}" data-arst="${i}">${i + 1} ${esc(s.n.split(":")[0].split(",")[0])}</button>`; }).join("");
  }
  function scene() {
    const s = STEPS[st];
    if (s.k === "kit" || s.k === "clean") { $("arScene").innerHTML = prepScene(s.k, u, rec, pairs); return; }
    if (s.k === "runin" || s.k === "iso") {
      let g = svgOpen(`Step ${st + 1} · ${s.n}`, s.k === "iso" ? "autocollimator + 24-face polygon" : "servo + data logger");
      if (s.k === "runin") { const n = Math.max(2, Math.round(u * rec.trT.length)); g += chart({ x: 20, y: 40, w: 720, h: 300, t: "Temperature rise during the 2 h run-in (K)", xr: [0, 120], yr: [0, 40], xl: "minutes", hl: [{ y: 15, t: "limit 15 K", col: "var(--critical)" }], series: [{ pts: rec.trT.slice(0, n), col: "var(--critical)" }] }); }
      else { const n = Math.max(2, Math.round(u * 25));
        g += `<circle cx="110" cy="190" r="70" fill="#9aa4ae" stroke="#333"/><polygon points="${Array.from({ length: 24 }, (_, i) => `${110 + 34 * Math.cos(i * 15 * RAD + u * 6.28)},${190 + 34 * Math.sin(i * 15 * RAD + u * 6.28)}`).join(" ")}" fill="#dfe6ec" stroke="#333"/><rect x="200" y="176" width="60" height="28" fill="#556"/><line x1="144" y1="190" x2="200" y2="190" stroke="var(--critical)" stroke-dasharray="3 2"/>${txt(40, 290, "polygon on the table axis,")}${txt(40, 306, "autocollimator fixed: each face = 15°")}`;
        g += chart({ x: 290, y: 40, w: 460, h: 300, t: "ISO 230-2: positioning deviation (″)", xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-8, 8], xl: "target angle °", hl: [{ y: rec.accLim / 2 }, { y: -rec.accLim / 2 }], series: [{ pts: rec.mu.slice(0, n), col: CL, dots: true, lab: "↑ mean" }, { pts: rec.md.slice(0, n), col: CR, dots: true, lab: "↓ mean" }], legend: [["approach +", CL], ["approach −", CR]] }); }
      $("arScene").innerHTML = g + `</svg>`; return;
    }
    let svg = sectionSVG(s.hs, s.k === "level" ? 1 : Math.min(1, u * 1.2), M, R1, null);
    svg = svg.replace(/<text x="10" y="18"[^>]*>[^<]*<\/text>/, `<text x="10" y="18" class="apc-t" style="font-weight:600">Step ${st + 1} · ${esc(s.n)} (cross-section, jigs in blue)</text>`);
    $("arScene").innerHTML = svg.replace("</svg>", overlay(s.k, u, M, R1) + "</svg>");
  }
  function info() {
    const s = STEPS[st], si = Math.min(s.how.length - 1, Math.floor(u * s.how.length));
    $("arStep").innerHTML = `<span class="dk-n">${st + 1}/${STEPS.length}</span> <b>${esc(s.how[si])}</b>`;
    $("arInfo").innerHTML = `<div class="apc-pi-h"><b>Step ${st + 1} · ${esc(s.n)}</b><span class="apc-mb">${esc(s.ph)}</span></div>
      <ol class="wm-steps">${s.how.map((t, i) => `<li class="${i === si ? "on" : i < si ? "done" : ""}">${esc(t)}</li>`).join("")}</ol>
      <h4>Equipment (BUY)</h4>${s.eq.length ? `<table class="wm-kv">${s.eq.map((e) => `<tr><td>${e} ${esc(EQ[e][0])}</td><td>${esc(EQ[e][2])}</td></tr>`).join("")}</table>` : `<p class="muted">–</p>`}
      <h4>Jigs (MAKE)</h4>${s.jig.length ? `<table class="wm-kv">${s.jig.map((j) => `<tr><td>${j} ${esc(JIG[j][0])}</td><td>${esc(JIG[j][1])}</td></tr>`).join("")}</table>` : `<p class="muted">–</p>`}
      <h4>Checks</h4>${u >= 0.9 ? chk(rec.out[s.k]) : `<p class="muted">… measured at the end of the step</p>`}
      <p class="small muted">${s.t} min × ${s.men} fitter(s)</p>`;
  }
  function tables() {
    $("arRec").innerHTML = `<thead><tr><th>#</th><th>Step</th><th>min</th><th>Fitters</th><th>Measured</th><th>Result</th></tr></thead><tbody>${STEPS.map((s, i) => `<tr data-arst="${i}" style="cursor:pointer" class="${i === st ? "on" : ""}"><td>${i + 1}</td><td>${esc(s.n)}</td><td>${s.t}</td><td>${s.men}</td><td class="small">${rec.out[s.k].map((x) => esc(x[1])).join(" · ")}</td><td class="wm-st-${sstat(s.k)}">${ico[sstat(s.k)]}</td></tr>`).join("")}</tbody>`;
    $("arTq").innerHTML = `<thead><tr><th>Joint</th><th>Screws</th><th>Class</th><th>Torque N·m</th><th>Sequence</th></tr></thead><tbody>${TQ.map((t) => `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td>${t[2]}</td><td><b>${t[3]}</b></td><td>${esc(t[4])}</td></tr>`).join("")}</tbody>`;
    const used = (id, key) => STEPS.map((s, i) => (s[key].includes(id) ? i + 1 : null)).filter(Boolean).join(", ");
    $("arEq").innerHTML = `<thead><tr><th>ID</th><th>Equipment</th><th>Buy / make</th><th>Required capability</th><th>Used in step</th></tr></thead><tbody>${Object.entries(EQ).map(([id, e]) => `<tr><td>${id}</td><td>${esc(e[0])}</td><td>${esc(e[1])}</td><td>${esc(e[2])}</td><td>${used(id, "eq")}</td></tr>`).join("")}</tbody>`;
    $("arJig").innerHTML = `<thead><tr><th>ID</th><th>Jig / fixture (MAKE)</th><th>Design + function</th><th>Used in step</th></tr></thead><tbody>${Object.entries(JIG).map(([id, j]) => `<tr><td>${id}</td><td>${esc(j[0])}</td><td>${esc(j[1])}</td><td>${used(id, "jig")}</td></tr>`).join("")}</tbody>`;
    const zones = [["Goods-in + kit area", 20, 40, 150, 120], ["Washer + ultrasonic", 190, 40, 150, 120], ["Soak rack 20 °C", 360, 40, 140, 120], ["Assembly stand J1 + plate", 220, 190, 200, 130], ["Jig + tool board", 20, 190, 170, 130], ["Measuring corner (autocollimator, dial gauges)", 450, 190, 280, 130], ["Grinder / test bench (workshop)", 520, 40, 210, 120]];
    $("arLay").innerHTML = `<svg viewBox="0 0 760 360" class="apc-svg">${zones.map(([n, x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--surface-2)" stroke="var(--axis)"/><text x="${x + 8}" y="${y + 20}" class="apc-t" style="font-weight:600">${esc(n)}</text>`).join("")}
      <line x1="20" y1="340" x2="740" y2="340" stroke="#e0b040" stroke-width="6"/><text x="24" y="332" class="apc-t">crane runway 1 t over the whole room · parts flow left → right · clean room 20 ±1 °C</text></svg>`;
  }
  function acc() {
    const ok = st >= 15;
    $("arAccSub").textContent = ok ? pairs.table : "reached at steps 16–17";
    if (!ok) { $("arAcc").innerHTML = `<p class="muted">Not tested yet.</p>`; return; }
    const card = (i) => `<svg viewBox="0 0 360 210" class="apc-svg">${i}</svg>`;
    $("arAcc").innerHTML = [card(chart({ x: 0, y: 0, w: 360, h: 210, t: "Run-in temperature rise (K)", note: rec.out.runin[0][1], xr: [0, 120], yr: [0, 40], xl: "min", hl: [{ y: 15, col: "var(--critical)" }], series: [{ pts: rec.trT, col: "var(--critical)" }] })),
      ...(st >= 16 ? [card(chart({ x: 0, y: 0, w: 360, h: 210, t: "ISO 230-2 deviation (″)", note: `A ${f(rec.Aacc, 1)}″`, xr: [0, 360], xt: [0, 90, 180, 270, 360], yr: [-8, 8], xl: "°", series: [{ pts: rec.mu, col: CL, dots: true, lab: "+" }, { pts: rec.md, col: CR, dots: true, lab: "−" }], legend: [["+", CL], ["−", CR]] }))] : []),
      `<div class="apc-checks">${chk([...rec.out.runin, ...(st >= 16 ? rec.out.iso : [])])}</div>`].join("");
  }
  function guide() {
    $("arGuide").innerHTML = `<h3>Assembly rules</h3><ul><li><b>Clean + 20 °C first.</b> Every measurement in µm is wrong if the parts are warm or dirty.</li>
      <li><b>Crosswise in 3 stages</b> for every ring of screws; mark every screw after the final torque (paint pen).</li>
      <li><b>Never hit a bearing</b>; lift with the jigs, lower slowly over guide studs, heat inner rings only with the induction heater (≤ 110 °C).</li>
      <li><b>Measure after every step</b> and write the value into the assembly record – a problem found at the end costs a full disassembly.</li>
      <li><b>Matched pairs stay together:</b> worm + wheel (pair no.), spacer ring ground for THIS pair.</li>
      <li><b>Backlash: use the smallest of 4 positions</b> (wheel runout makes it vary), never set it to zero cold – the warm worm closes the gap further.</li></ul>
      <h3>Faults – found at</h3><table class="apc-bom"><thead><tr><th>Fault</th><th>Found at</th><th>Prevention</th></tr></thead><tbody>
      <tr><td>Dirt on the bearing seat</td><td>bearing axial runout (step 4)</td><td>washer + soak, cloth + alcohol right before, covers over open parts</td></tr>
      <tr><td>Screws tightened in a circle</td><td>table runout (step 5)</td><td>crosswise pattern drawn on the work card, 3 stages</td></tr>
      <tr><td>Wrong wheel shim</td><td>mid-plane (6) + pattern (8)</td><td>measure with the mandrel J5, shim calculated, not guessed</td></tr>
      <tr><td>Spacer ground with the wrong sign</td><td>backlash after grinding (9)</td><td>write "+ thicker / − thinner" on the card, second person checks</td></tr>
      <tr><td>Cut O-ring</td><td>pressure test (10)</td><td>chamfers deburred, O-rings oiled, fitting sleeve</td></tr>
      <tr><td>Encoder not centred</td><td>scale runout (11), accuracy (17)</td><td>centring arm J8, measure before + after tightening</td></tr>
      <tr><td>No oil</td><td>run-in temperature + noise (16)</td><td>oil fill is a signed checklist line</td></tr></tbody></table>`;
  }
  function renderAll() { compute(); kpis(); route(); scene(); info(); tables(); acc(); guide(); }
  function frame() { scene(); info(); route(); $("arU").value = Math.round(u * 1000); $("arPlay").textContent = playing ? "❚❚ Pause" : "▶ Play all"; }
  function go(n) { st = clamp(n, 0, STEPS.length - 1); u = 0; hold = 0; frame(); acc(); tables(); kpis(); }
  function startLoop() { if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane || !pane.classList.contains("active") || !playing) return;
      if (u < 1) { u = Math.min(1, u + dt / 6); if (now - lastDraw > 33 || u >= 1) { lastDraw = now; frame(); if (u >= 1) { acc(); tables(); } } }
      else { hold += dt; if (hold > 1.2) { hold = 0; if (st < STEPS.length - 1) go(st + 1); else { playing = false; frame(); } } } };
    requestAnimationFrame(loop); }
  $("arFaults").innerHTML = FAULTS.map(([k, l, w]) => `<button class="chip" data-arf="${k}" title="${esc(w)}">${esc(l)}</button>`).join("");
  $("arFaults").addEventListener("click", (ev) => { const b = ev.target.closest("[data-arf]"); if (!b) return; F[b.dataset.arf] = !F[b.dataset.arf]; b.classList.toggle("on", F[b.dataset.arf]); b.textContent = (F[b.dataset.arf] ? "⚠ " : "") + FAULTS.find((x) => x[0] === b.dataset.arf)[1]; renderAll(); frame(); });
  $("arPlay").addEventListener("click", () => { playing = !playing; if (playing && st === STEPS.length - 1 && u >= 1) go(0); last = performance.now(); frame(); startLoop(); });
  $("arPrev").addEventListener("click", () => { playing = false; go(st - 1); });
  $("arNext").addEventListener("click", () => { playing = false; go(st + 1); });
  $("arU").addEventListener("input", (ev) => { playing = false; u = ev.target.value / 1000; frame(); });
  $("arRoute").addEventListener("click", (ev) => { const b = ev.target.closest("[data-arst]"); if (b) { playing = false; go(+b.dataset.arst); } });
  $("arRec").addEventListener("click", (ev) => { const b = ev.target.closest("[data-arst]"); if (b) { playing = false; go(+b.dataset.arst); } });
  $("arNew").addEventListener("click", () => { serial++; renderAll(); frame(); });
  window.asmRT = { state: () => ({ k: STEPS[st].k, hs: STEPS[st].hs, no: st + 1, n: STEPS[st].n, u, M, R1, F, rec, cut: $("ar3dCut").checked, visible: pane && pane.classList.contains("active") }) };
  $("ar3dBtn").addEventListener("click", () => { const el = $("ar3d"); el.hidden = !el.hidden; $("ar3dBtn").textContent = el.hidden ? "Show 3D view" : "Hide 3D view"; if (!el.hidden && !el.dataset.on) { el.dataset.on = "1"; import("./mfg3d.js").then((m) => m.create(el, () => window.asmRT.state(), "asm")); } });
  if (new URLSearchParams(location.search).has("show3d")) setTimeout(() => $("ar3dBtn").click(), 400);
  $("arExport").addEventListener("click", () => {
    const out = { table: pairs.table, pair: pairs.pair, worm: pairs.worm, wheel: pairs.wheel, faults: Object.keys(F).filter((k) => F[k]), steps: STEPS.map((s, i) => ({ step: i + 1, name: s.n, minutes: s.t, fitters: s.men, equipment: s.eq.map((e) => `${e} ${EQ[e][0]}`), jigs: s.jig.map((j) => `${j} ${JIG[j][0]}`), checks: rec.out[s.k].map(([l, v, r]) => ({ check: l, value: v, result: r })) })),
      torques: TQ.map((t) => ({ joint: t[0], screws: t[1], cls: t[2], torque_Nm: t[3], sequence: t[4] })), verdict: rec.fails.length ? "REJECT" : "ACCEPTED", note: "simulated example values" };
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: "application/json" })); a.download = `${pairs.table}_assembly_record.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const prev = window.onTabShown;
  window.onTabShown = (name) => { if (prev) prev(name); if (name === "asm") { renderAll(); frame(); startLoop(); } };
  window.addEventListener("hmcrotchange", () => { if (pane && pane.classList.contains("active")) { renderAll(); frame(); } });
  const q = new URLSearchParams(location.search);
  if (q.get("arf")) q.get("arf").split(",").forEach((k) => { F[k] = true; });
  if (q.get("arst")) { st = clamp(parseInt(q.get("arst"), 10) - 1 || 0, 0, STEPS.length - 1); u = q.get("aru") ? clamp(parseFloat(q.get("aru")), 0, 1) : 1; }
  if (location.hash === "#asm") setTimeout(() => { renderAll(); frame(); startLoop(); [...$("arFaults").children].forEach((b) => { if (F[b.dataset.arf]) { b.classList.add("on"); b.textContent = "⚠ " + FAULTS.find((x) => x[0] === b.dataset.arf)[1]; } }); }, 150);
  // item switch of the Assembly tab (generic: data-asitem buttons, arItemN + asIntroN), fires "asitemshow"
  const showAs = (n) => { document.querySelectorAll("[data-asitem]").forEach((b) => { const i = b.dataset.asitem, on = i === n; b.classList.toggle("active", on); const el = $("arItem" + i), it = $("asIntro" + i); if (el) el.hidden = !on; if (it) it.hidden = !on; });
    if (n === "1") { renderAll(); frame(); } window.dispatchEvent(new CustomEvent("asitemshow", { detail: n })); };
  document.querySelectorAll("[data-asitem]").forEach((b) => b.addEventListener("click", () => showAs(b.dataset.asitem)));
  window.asmTab = { showItem: showAs };
  if (q.get("asitem")) setTimeout(() => showAs(q.get("asitem")), 200);
}
