/* Ball screw + guide factory – item 5 QUALITY + INSPECTION: SHARED QUALITY DATA (item 5 owns it; items 6 MES and 7 ERP import it).
 * Guide: docs/44_bsf_quality_inspection.md
 *
 *   import { NOTE5, ALPHA, ROOM, CHARS, CHAR_BY_ID, CONTROL_PLAN, PLAN_PARTS, GATES, GATE_BY_ID, FLOWS, SPC, SPC_CHARS, WE_RULES,
 *            TORQUE_TOL, LEAD_SIM, AQL, GRR_DATA, GRR_INFO, CAL, UNC, SERIAL, RESULT_EXAMPLE, NCR_STEPS, NCR_EXAMPLE, STDS5 } from "./bsfqa_data.js";
 *
 * CHARS row = one characteristic of one part:
 *   { id, part ("BS"|"BN"|"LG"|"LB"|"FABS"|"FALG"), op (routing op no. of web/bsfmfg_data.js ROUTES), name, nom (nominal, number or text),
 *     lsl, usl (numbers in "unit" – null = one-sided / attribute), unit, spec (text), cls ("CC" critical | "SC" significant | ""),
 *     method, gauge, sample (sample size), freq, who, ctl (control method: SPC / 100 % auto / checklist …), react (reaction plan), gate (QGATES id or "") }
 * Units: mm, µm, N, N·m, HRC, HV, °C, dB(A).  α (ALPHA) = 11.5 µm/(m·K) for the lead measurement (item 1 uses 11.8 for the drive design – both are
 * inside the 11 – 12 range of hardened bearing / Cr-Mo steel; take the value of your material certificate or measure it).
 * EVERY VALUE IS AN EXAMPLE – check the standard (ISO 3408-3, ISO 12090-1 / maker classes, ISO 6508, ISO 6507, ISO 18203, ISO 21920, ISO 2859-1,
 * ISO 22514, AIAG MSA / SPC, JIS B 1192-3) and the drawing / contract of your customer.
 */
import { QGATES, ROUTES } from "./bsfmfg_data.js";
import { BS, BN, LG, LB, ACC_BS, ACC_LG } from "./bsfprod_data.js";

export const NOTE5 = "Example values – check the standard and your customer's drawing / quality agreement.";
export const ALPHA = 11.5;            // µm/(m·K) thermal expansion of the screw steel used for the lead temperature compensation
export const ROOM = { T: 20, tol: 0.5, rh: "45 ± 10 %", soak_h: 4, grad: 0.5, note: "Metrology room 20 ± 0.5 °C (ISO 1 reference temperature 20 °C), gradient ≤ 0.5 K/m vertical, change ≤ 0.5 K/h, screw soaked ≥ 4 h" };

/* ------------------------------------------------------------------ characteristics (control-plan rows) */
const C = (id, part, op, name, nom, lsl, usl, unit, spec, cls, method, gauge, sample, freq, who, ctl, react, gate = "") =>
  ({ id, part, op, name, nom, lsl, usl, unit, spec, cls, method, gauge, sample, freq, who, ctl, react, gate });
const LU = ACC_BS.ourLu, KBIN = ACC_BS.bins.findIndex((b) => LU <= b);
const EP5 = ACC_BS.ep.C5[KBIN], VU5 = ACC_BS.vup.C5[KBIN];
const parH = (cls, L = LG.L) => { const k = ACC_LG.len.findIndex((l) => L <= l); return ACC_LG.par[cls][k < 0 ? ACC_LG.len.length - 1 : k]; };
export const CHARS = [
  // ---------------- screw shaft BS-3210-1000-C5
  C("BS-LEN", "BS", "30", "Total length after facing", 1004, 1003.8, 1004.2, "mm", "1 004 ± 0.2", "", "length measurement against a setting master", "length gauge 0.01 mm + master bar", "1", "first part + 1 in 20", "operator", "check sheet", "re-set the length stop, check the last 20 parts"),
  C("BS-CTR", "BS", "30", "Centre holes DIN 332 B4 – 60°, concentric, undamaged", "60°", null, null, "", "60°, contact ≥ 80 %, no damage", "SC", "centre-hole gauge + blue-ink contact", "centre-hole gauge, master centre", "1", "first + 1 in 20", "operator", "check sheet", "re-centre; block the lot until checked", "QG-BS-1"),
  C("BS-OD", "BS", "40", "Thread zone Ø before hardening", 32.4, 32.35, 32.45, "mm", "Ø32.4 ± 0.05", "", "two-point measurement", "outside micrometer 25 – 50 mm, 0.001 mm", "1", "first part + 1 in 10", "operator", "check sheet", "correct the tool offset"),
  C("BS-HRC", "BS", "50", "Surface hardness of the thread zone (after tempering)", 60, 58, 62, "HRC", "58 – 62 HRC", "CC", "Rockwell C, ISO 6508-1, 3 readings on a ground flat at the run-out", "Rockwell tester (Emco-Test / Struers / Wilson class) + test block", "1 (3 readings)", "first + 1 in 20", "operator HT", "SPC chart (X̄-R, n = 3 readings)", "stop the induction machine, check coil gap + energy monitor, test the last 20", "QG-BS-2"),
  C("BS-CHD", "BS", "50", "Case depth SHD at 550 HV (induction)", 2.5, 2.0, 3.0, "mm", "2.0 – 3.0 mm at 550 HV 1", "CC", "cut-up, polish, HV 1 traverse ISO 6507-1 every 0.2 mm, evaluate per ISO 18203", "Vickers / micro-hardness tester with motorised stage", "1 cut-up", "1 per shift + every new set-up", "lab", "cut-up record", "hold the lot, adjust power / scan speed, re-test", "QG-BS-2"),
  C("BS-CRK", "BS", "50", "Surface cracks (quench cracks)", "none", null, null, "", "no crack indication", "CC", "eddy-current crack test (or magnetic particle ISO 9934)", "eddy-current tester with rotating probe", "100 %", "every part", "automatic", "100 % automatic check", "scrap the part; 2 cracks in a lot → stop + check quench", "QG-BS-2"),
  C("BS-RO", "BS", "70", "Run-out after straightening (TIR along the thread)", 0, null, 20, "µm", "≤ 20 µm TIR", "SC", "rotate on 2 rollers / centres, laser or LVDT sensor at 5 stations", "laser run-out sensor of the press, dial gauge 1 µm for audits", "100 %", "every part", "automatic", "100 % automatic + daily master check", "re-straighten (max 2 ×), else scrap (crack risk)", "QG-BS-3"),
  C("BS-JD", "BS", "90", "Bearing journal Ø25 h5 (deviation from nominal)", 0, -9, 0, "µm", "Ø25 h5 = 0 / −9 µm", "SC", "in-process gauge + air gauge in the cell", "Marposs / Movomatic in-process gauge, air gauge with ring master", "100 % (in-process) + 1 in 10 air gauge", "every part", "automatic + operator", "SPC chart (X̄-R, n = 5)", "re-master the gauge, check wheel wear", ""),
  C("BS-JRO", "BS", "120", "Journal radial run-out to the thread axis", 0, null, 8, "µm", "≤ 8 µm (C5, ISO 3408-3 t5 class)", "SC", "screw held in the thread (2 V-blocks with balls) – dial gauge on the journal", "lead machine run-out station, sensor 0.1 µm", "100 %", "every part", "inspector", "100 % + record", "regrind journals between the thread (centre check)", ""),
  C("BS-PD", "BS", "100", "Pitch Ø over balls (deviation)", 0, -3, 3, "µm", "± 3 µm", "CC", "2 measuring balls Ø6.35 in opposite grooves", "ball-pin micrometer / comparator with balls, 0.1 µm", "100 %", "every part", "operator", "SPC chart (I-MR)", "re-dress the wheel, check the dressing disc", "QG-BS-4"),
  C("BS-PRF", "BS", "100", "Thread profile – contact angle (gothic arch)", 45, 43, 47, "°", "45° ± 2°, conformity f = 0.53 ± 0.01", "SC", "stylus contour trace of the groove, fit 2 arcs, ball Ø6.35 contact points", "contour tester (Mahr MarSurf XC / Taylor Hobson Form Talysurf class)", "1", "1 in 10 + after each dressing", "operator", "check sheet + trend", "re-dress (profile), check dressing disc wear", "QG-BS-4"),
  C("BS-RA", "BS", "100", "Raceway roughness Ra", 0.1, null, 0.2, "µm", "Ra ≤ 0.2 µm (λc 0.25 mm)", "", "stylus roughness, ISO 21920-2 (Ra, Rz)", "portable roughness tester (Mahr / Mitutoyo SJ class) + skid-less pick-up", "1", "1 in 20 + after each wheel change", "operator", "check sheet", "re-dress, check coolant filter"),
  C("BS-EP", "BS", "120", "Lead: mean travel deviation E − T", 0, -EP5, EP5, "µm", `C5: E − T within ± ${EP5} µm (l_u ${LU} mm)`, "CC", "laser interferometer lead measuring machine, 1 mm steps, ISO 3408-3 evaluation, 20 °C compensation", "Renishaw XL-80 + XC-80 on a lead bench (QC-LED)", "100 %", "every C5 screw (C7: 1 in 20)", "inspector (automatic evaluation)", "SPC chart (I-MR) + 100 %", "downgrade to C7 or regrind with corrected compensation", "QG-BS-5"),
  C("BS-VU", "BS", "120", "Lead: travel variation v_up (over l_u)", 0, null, VU5, "µm", `C5: ≤ ${VU5} µm`, "CC", "same measurement", "QC-LED", "100 %", "every part", "inspector", "100 %", "check grinder lead system, regrind", "QG-BS-5"),
  C("BS-V300", "BS", "120", "Lead: variation in any 300 mm v_300", 0, null, ACC_BS.v300.C5, "µm", `C5: ≤ ${ACC_BS.v300.C5} µm`, "CC", "same measurement", "QC-LED", "100 %", "every part", "inspector", "SPC chart (I-MR)", "check grinding oil temperature + master screw", "QG-BS-5"),
  C("BS-V2PI", "BS", "120", "Lead: variation in one revolution v_2π", 0, null, ACC_BS.v2pi.C5, "µm", `C5: ≤ ${ACC_BS.v2pi.C5} µm`, "SC", "same measurement (fine steps 0.5 – 1 mm)", "QC-LED", "100 %", "every part", "inspector", "100 %", "check work-head run-out, centres, wheel balance", "QG-BS-5"),
  C("BS-MAG", "BS", "130", "Residual magnetism", 0, null, 0.3, "mT", "≤ 0.3 mT (≈ 2.4 A/cm)", "", "Hall probe at the thread ends", "gaussmeter / field meter", "3 parts", "1 per lot", "operator", "check sheet", "demagnetise again"),
  C("BS-CLN", "BS", "130", "Cleanliness + rust protection", "visual", null, 2.0, "mg", "residual dirt ≤ 2.0 mg / part, no particle > 400 µm, oil film complete", "", "visual 100 %; gravimetric extraction ISO 16232 / VDA 19.1 style", "lamp + white cloth; analysis balance 0.1 mg + microscope", "1 part", "1 per week + 100 % visual", "operator / lab", "check sheet", "clean the washer, change filters"),
  // ---------------- ball nut BN-3210-FL
  C("BN-HRC", "BN", "40", "Surface hardness (test piece per load)", 60, 58, 62, "HRC", "58 – 62 HRC", "CC", "Rockwell C on test pieces of the load", "Rockwell tester", "3 test pieces", "every load", "lab", "load record", "hold the load, re-temper / scrap", "QG-BN-1"),
  C("BN-CHD", "BN", "40", "Case depth CHD at 550 HV", 1.0, 0.8, 1.2, "mm", "Eht 0.8 – 1.2 mm", "CC", "HV 1 traverse on a test piece, ISO 18203", "micro-hardness tester", "1 test piece", "every load", "lab", "load record", "hold the load; check carbon potential + time", "QG-BN-1"),
  C("BN-RA", "BN", "40", "Retained austenite", 8, null, 15, "%", "≤ 15 %", "", "X-ray diffraction or metallography estimate", "XRD (external lab) / microscope", "1", "1 per week + new program", "lab", "lab report", "sub-zero treatment, check quench", "QG-BN-1"),
  C("BN-OD", "BN", "50", "Centring OD Ø50 g6 (deviation)", -17, -25, -9, "µm", "Ø50 g6 = −9 / −25 µm", "SC", "two-point", "air gauge / snap gauge, ring master", "1", "1 in 10", "operator", "SPC chart (X̄-R)", "correct the tool offset (CBN)"),
  C("BN-FRO", "BN", "50", "Flange face run-out to the bore", 0, null, 5, "µm", "≤ 5 µm", "SC", "nut on an expanding arbor, dial gauge on the flange face", "dial gauge 1 µm, precision arbor", "1", "1 in 10", "operator", "check sheet", "check chuck, re-turn the face"),
  C("BN-PD", "BN", "60", "Internal pitch Ø over 2 balls (deviation)", 0, -3, 3, "µm", "± 3 µm", "CC", "internal ball gauge with 2 measuring balls", "internal comparator + setting ring", "100 %", "every part", "operator", "SPC chart (I-MR)", "re-dress, check quill deflection", "QG-BN-2"),
  C("BN-PRF", "BN", "60", "Internal profile – contact angle", 45, 43, 47, "°", "45° ± 2°", "SC", "replica (casting) of the groove + contour trace, or internal contour arm", "contour tester with internal arm", "1", "1 in 10", "operator", "check sheet", "re-dress", "QG-BN-2"),
  C("BN-TAP", "BN", "60", "Taper of the pitch Ø over the nut length", 0, null, 2, "µm", "≤ 2 µm", "", "pitch Ø at both ends", "internal comparator", "1", "1 in 10", "operator", "check sheet", "adjust taper correction", "QG-BN-2"),
  C("BN-DEF", "BN", "80", "Deflector step to the groove", 0, null, 10, "µm", "≤ 10 µm, step-free", "SC", "LVDT on a master screw with gauge balls, roll through", "LVDT 0.1 µm, master screw", "100 %", "every part", "operator", "100 %", "re-press / replace the deflector", "QG-BN-3"),
  C("BN-CLS", "BN", "80", "Ball size class for the preload (axial play with gauge balls)", "class", null, null, "µm", "class = play + preload interference 2 – 6 µm", "CC", "axial play with gauge balls → choose oversize class (1 µm steps)", "LVDT axial play fixture, gauge balls", "100 %", "every part", "operator", "100 % + record", "re-measure; play out of range → nut to rework", "QG-BN-3"),
  // ---------------- rail LG-25-1000
  C("LG-HRC", "LG", "40", "Raceway hardness", 60, 58, 62, "HRC", "58 – 62 HRC", "CC", "Rockwell C on the raceway shoulder (or HV 10 converted)", "Rockwell tester", "1 (3 readings)", "1 in 20", "operator HT", "SPC chart (X̄-R)", "adjust power / feed, check the coil position", "QG-LG-1"),
  C("LG-CHD", "LG", "40", "Hardened pattern / case depth", 2.0, 1.5, 2.5, "mm", "1.5 – 2.5 mm, base soft", "SC", "cut-up, macro etch (nital) + HV traverse", "saw, polisher, micro-hardness", "1 cut-up", "1 per shift", "lab", "cut-up record", "adjust coil position / power", "QG-LG-1"),
  C("LG-STR", "LG", "60", "Straightness after hardening (vertical + horizontal)", 0, null, 100, "µm/m", "≤ 0.10 mm / m", "", "rail on supports, dial gauge / laser line", "straightening press sensor", "100 %", "every part", "automatic", "100 %", "re-straighten"),
  C("LG-H", "LG", "80", "Rail height over gauge balls (deviation)", 0, -15, 15, "µm", "± 15 µm to the master rail", "SC", "comparator + gauge balls vs master rail", "comparator 0.5 µm, master rail", "100 %", "every part", "operator", "SPC chart (I-MR)", "re-dress the form wheels", "QG-LG-2"),
  C("LG-PAR", "LG", "80", "Running parallelism of the raceways to datum A / D", 0, null, parH("H"), "µm", `class H: ≤ ${parH("H")} µm over ${LG.L} mm (P: ${parH("P")})`, "CC", "measuring block with 2 probes runs along the rail on a granite table", "rail measuring bench (QC-RAL)", "100 %", "every part", "automatic", "SPC chart (I-MR) + 100 %", "re-grind / downgrade class", "QG-LG-2"),
  C("LG-PITCH", "LG", "100", "Hole pitch cumulative error", 0, -200, 200, "µm", "60 ± 0.2 mm cumulative", "", "camera / scale on the bench", "rail measuring bench", "100 %", "every part", "automatic", "100 %", "scrap / re-drill rule", "QG-LG-3"),
  C("LG-RA", "LG", "80", "Raceway roughness Ra", 0.15, null, 0.4, "µm", "Ra ≤ 0.4 µm", "", "stylus roughness", "portable roughness tester", "1", "1 per shift", "operator", "check sheet", "re-dress"),
  C("LG-LEN", "LG", "90", "Length + end distance E", 1000, 999.5, 1000.5, "mm", "1 000 ± 0.5, E 20 ± 0.5", "", "length gauge", "length bench / tape (class I)", "1", "first + 1 in 20", "operator", "check sheet", "re-set the stop"),
  // ---------------- carriage LB-25-FL
  C("LB-HRC", "LB", "40", "Raceway hardness (test piece per load)", 60, 58, 62, "HRC", "58 – 62 HRC", "CC", "Rockwell C on test pieces", "Rockwell tester", "3 test pieces", "every load", "lab", "load record", "hold the load", "QG-LB-1"),
  C("LB-CHD", "LB", "40", "Case depth CHD at 550 HV", 0.9, 0.8, 1.0, "mm", "Eht 0.8 – 1.0 mm", "CC", "HV 1 traverse", "micro-hardness tester", "1", "every load", "lab", "load record", "hold the load", "QG-LB-1"),
  C("LB-HV", "LB", "60", "Raceway height variation in the lot (over gauge balls)", 0, null, 15, "µm", "≤ 15 µm (class H)", "SC", "comparator with gauge balls vs master rail", "comparator, master rail", "100 %", "every part", "operator", "SPC chart (I-MR)", "re-dress, check string clamping", "QG-LB-2"),
  C("LB-H", "LB", "90", "Assembly height H on the master rail (deviation)", 0, -40, 40, "µm", `H ${LB.Hasm} ± 0.04 mm (class H)`, "CC", "block on the master rail, height gauge vs gauge block stack", "electronic height gauge 0.1 µm, gauge blocks grade 0", "100 %", "every part", "automatic", "SPC chart (X̄-R, n = 5)", "re-ball (ball class), regrind", "QG-LB-3"),
  C("LB-W2", "LB", "90", "Width W2 to the rail reference side (deviation)", 0, -40, 40, "µm", "W2 ± 0.04 mm (class H)", "SC", "side probe vs master", "matching station probe", "100 %", "every part", "automatic", "100 %", "regrind reference side", "QG-LB-3"),
  C("LB-DRAG", "LB", "90", "Drag force (preload Z1) without seals", 15, 10, 22, "N", "Z1 window 10 – 22 N (example)", "CC", "push the block along the master rail with a force sensor at 60 mm/s", "force sensor (HBM / Kistler class) on the matching station", "100 %", "every part", "automatic", "SPC chart (I-MR)", "re-ball with the next ball class", "QG-LB-3"),
  C("LB-RA", "LB", "60", "Raceway roughness Ra", 0.1, null, 0.2, "µm", "Ra ≤ 0.2 µm", "", "replica / stylus", "roughness tester", "1", "1 per shift", "operator", "check sheet", "re-dress"),
  // ---------------- screw assembly FABS
  C("FA-TP", "FABS", "10", "Preload torque Tp (dynamic, mean over the stroke)", 0.29, 0.174, 0.406, "N·m", "Tp 0.29 N·m ± 40 % band (C5, Tp 0.2 – 0.4 N·m)", "CC", "nut held by a force arm, screw turned at 100 min⁻¹ (no seals), torque vs stroke", "preload torque tester with load cell + encoder (AS-BSA)", "100 %", "every part", "automatic", "SPC chart (I-MR) + 100 %", "re-ball with another ball class", "QG-FA-1"),
  C("FA-TPV", "FABS", "10", "Preload torque fluctuation (band over the effective stroke)", 40, null, 40, "%", "all values within Tp ± 40 % (JIS / ISO 3408-3 style table)", "CC", "same curve, ends (nut length) excluded", "AS-BSA", "100 %", "every part", "automatic", "100 %", "open the nut, check balls / deflectors", "QG-FA-1"),
  C("FA-AX", "FABS", "10", "Axial rigidity / lost motion", 670, 540, null, "N/µm", "K ≥ 540 N/µm, lost motion ≤ 2 µm", "SC", "axial force ± 2 kN, displacement with LVDT 0.1 µm", "rigidity test fixture", "1", "1 per lot", "inspector", "lot record", "check preload class, nut fit", ""),
  C("FA-NOISE", "FABS", "30", "Run-in noise at 500 min⁻¹", 58, null, 65, "dB(A)", "≤ 65 dB(A) at 0.3 m, 500 min⁻¹", "SC", "run-in stand, sound level meter class 1 (IEC 61672), speed sweep 100 – 3 000 min⁻¹", "run-in stand AS-RUN + microphone + accelerometer", "100 %", "every part", "automatic", "100 %", "open the nut, check deflectors + balls", "QG-FA-2"),
  C("FA-RUN", "FABS", "30", "Run-in torque peaks", 0, null, 40, "%", "no peak > Tp + 40 %", "SC", "torque chart during run-in", "AS-RUN", "100 %", "every part", "automatic", "100 %", "open the nut", "QG-FA-2"),
  C("FA-MRK", "FABS", "40", "Marking (code, serial, grade, date) – data-matrix grade", "B", null, null, "", "readable, ISO/IEC 29158 grade ≥ C", "", "scanner verification", "code verifier", "100 %", "every part", "automatic", "100 %", "re-mark / new label", ""),
  C("FA-PACK", "FABS", "50", "Rust protection + packing + documents", "check", null, null, "", "oil film, VCI tube, supports every 300 mm, test report inside", "", "checklist", "–", "100 %", "every part", "packer", "checklist", "re-pack", ""),
  // ---------------- guide set FALG
  C("FG-DRAG", "FALG", "10", "Drag force per block on the rail (with seals)", 25, 15, 35, "N", "15 – 35 N per block (Z1 + seals, example)", "SC", "force gauge, constant speed", "force sensor (AS-GAS)", "100 %", "every part", "operator", "100 %", "exchange the block", "QG-FA-3"),
  C("FG-PAR", "FALG", "10", "Running parallelism of the set", 0, null, parH("H"), "µm", `class H ≤ ${parH("H")} µm`, "CC", "probe on the blocks along the rail", "AS-GAS probe", "100 %", "every part", "operator", "100 %", "exchange rail / downgrade", "QG-FA-3"),
  C("FG-PAIRH", "FALG", "10", "Height variation of the 2 blocks (pair)", 0, null, 15, "µm", "ΔH ≤ 15 µm (class H)", "CC", "height of both blocks on the same rail", "height gauge", "100 %", "every part", "operator", "100 %", "exchange a block (match class)", "QG-FA-3"),
  C("FG-MRK", "FALG", "20", "Datum marks + serial on rail and blocks", "check", null, null, "", "datum side mark, same set no.", "", "visual", "–", "100 %", "every part", "operator", "checklist", "re-mark", ""),
  C("FG-PACK", "FALG", "30", "Rust protection + packing", "check", null, null, "", "VCI bag, end caps, blocks on dummy rail", "", "checklist", "–", "100 %", "every part", "packer", "checklist", "re-pack", ""),
];
export const CHAR_BY_ID = Object.fromEntries(CHARS.map((c) => [c.id, c]));
export const PLAN_PARTS = [
  { k: "BS", n: `Screw shaft ${BS.code}` }, { k: "BN", n: `Ball nut ${BN.code}` }, { k: "LG", n: `Rail ${LG.code}` }, { k: "LB", n: `Carriage ${LB.code}` },
  { k: "FABS", n: "Ball screw assembly (screw + nut)" }, { k: "FALG", n: "Linear guide set (rail + 2 blocks)" },
];
/* control plan (AIAG / IATF 16949 layout) – one row per characteristic, sorted by part + op */
export const CONTROL_PLAN = CHARS.map((c, i) => ({ no: i + 1, ...c, process: (ROUTES[c.part].ops.find((o) => o.no === c.op) || {}).op || "", machine: (ROUTES[c.part].ops.find((o) => o.no === c.op) || {}).m || "" }));

/* the 17 quality gates of item 2 (QGATES) + the characteristics that belong to each gate */
export const GATES = QGATES.map((g) => ({ ...g, chars: CHARS.filter((c) => c.gate === g.id).map((c) => c.id) }));
export const GATE_BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g]));
/* process flow per part for the clickable gate diagram: [op no, short name, machine type, gate id | ""] */
export const FLOWS = Object.fromEntries(Object.keys(ROUTES).map((r) => [r, ROUTES[r].ops.filter((o) => !o.v || o.v.includes("G")).map((o) => [o.no, o.op.split(/[(:–,]/)[0].trim().slice(0, 30), o.m, o.gate || ""])]));

/* ------------------------------------------------------------------ SPC settings */
export const SPC = {
  // control chart constants for subgroup size n = 2 … 10 (AIAG SPC manual / ASTM E2587)
  n: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  A2: [1.880, 1.023, 0.729, 0.577, 0.483, 0.419, 0.373, 0.337, 0.308],
  D3: [0, 0, 0, 0, 0, 0.076, 0.136, 0.184, 0.223],
  D4: [3.267, 2.574, 2.282, 2.114, 2.004, 1.924, 1.864, 1.816, 1.777],
  d2: [1.128, 1.693, 2.059, 2.326, 2.534, 2.704, 2.847, 2.970, 3.078],
  A3: [2.659, 1.954, 1.628, 1.427, 1.287, 1.182, 1.099, 1.032, 0.975],
  B3: [0, 0, 0, 0, 0.030, 0.118, 0.185, 0.239, 0.284],
  B4: [3.267, 2.568, 2.266, 2.089, 1.970, 1.882, 1.815, 1.761, 1.716],
  c4: [0.7979, 0.8862, 0.9213, 0.9400, 0.9515, 0.9594, 0.9650, 0.9693, 0.9727],
  E2: 2.660, D4mr: 3.267,   // I-MR (moving range of 2)
  phase1: 25,               // subgroups used to fix the control limits (phase I), then limits are frozen (phase II)
  targets: { Cpk: 1.33, CpkCC: 1.67, Ppk_new: 1.67, pctGRR_ok: 10, pctGRR_max: 30, ndc_min: 5 },
};
export const WE_RULES = [
  ["1", "1 point beyond 3σ (outside a control limit)", "special cause – stop + check"],
  ["2", "2 of 3 points in a row beyond 2σ on the same side", "shift starting"],
  ["3", "4 of 5 points in a row beyond 1σ on the same side", "small shift"],
  ["4", "8 points in a row on the same side of the centre line", "process mean has moved"],
];
/* characteristics with live SPC: process model of the twin (mu, sigma per piece; bias per machine instance), subgroup size n */
export const SPC_CHARS = [
  { id: "BS-EP", n: 1, chart: "imr", mu: 4.0, sigma: 6.0, src: "QC-LED", up: "BS-TGR", bias: 2.5, therm: true },
  { id: "BS-V300", n: 1, chart: "imr", mu: 9.0, sigma: 2.0, src: "QC-LED", up: "BS-TGR", bias: 0.8 },
  { id: "BS-JD", n: 5, chart: "xbarR", mu: -4.5, sigma: 1.0, src: "BS-CGR", up: "BS-CGR", bias: 0.4 },
  { id: "BS-HRC", n: 3, chart: "xbarR", mu: 60.2, sigma: 0.45, src: "BS-IND", up: "BS-IND", bias: 0.2 },
  { id: "FA-TP", n: 1, chart: "imr", mu: 0.295, sigma: 0.022, src: "AS-BSA", up: "AS-NAS", bias: 0.006 },
  { id: "LG-PAR", n: 1, chart: "imr", mu: 7.5, sigma: 1.8, src: "QC-RAL", up: "LG-PGR", bias: 0.6 },
  { id: "LB-H", n: 5, chart: "xbarR", mu: 3.0, sigma: 8.0, src: "QC-MAT", up: "LB-RGR", bias: 2.0 },
  { id: "LB-DRAG", n: 1, chart: "imr", mu: 15.5, sigma: 1.6, src: "QC-MAT", up: "AS-BAS", bias: 0.4 },
];

/* ------------------------------------------------------------------ preload torque tolerance (dynamic preload torque, band in % of the reference Tp)
 * rows: [Tp from, Tp to (N·m), C3, C5, C7 (± %)] – slenderness l_u / d0 ≤ 40. Example of the JIS B 1192-3 / ISO 3408-3 / catalogue table – check the standard. */
export const TORQUE_TOL = [[0.2, 0.4, 35, 40, 50], [0.4, 0.6, 25, 30, 35], [0.6, 1.0, 20, 25, 30], [1.0, 2.5, 15, 20, 25], [2.5, 6.3, 10, 15, 20], [6.3, 10, 10, 15, 15]];

/* ------------------------------------------------------------------ lead measurement simulation defaults (item 5 page, §2) */
export const LEAD_SIM = {
  lu: LU, step: 1, ph: BS.Ph, T: 0,
  sys_um: 4,            // residual systematic error of the grinder lead compensation over l_u (µm) – per screw ± sysSd
  sysSd: 5,
  a2pi: 1.6,            // amplitude of the once-per-revolution wobble (µm) – run-out of the work head / centres, thread eccentricity
  aLong: 2.0, pLong: 230,   // long wave (master screw / straightness) amplitude µm, period mm
  noise: 0.25,          // white noise µm (1σ)
  tGrind: 20.2,         // mean screw temperature during finish grinding °C (live value tgr.screwTemp_C of BS-TGR in item 2 / 3)
  riseGrind: 0.8,       // temperature rise of the screw during the finish pass (K) → bow
  tMat: 20.3, drift: 0.1, sensorErr: 0.0,   // material temperature at start °C, change during the run K, sensor error K
  comp: true, durS: 14,  // temperature compensation on, animation time s
};

/* ------------------------------------------------------------------ sampling ISO 2859-1 (general inspection level II, single sampling, normal) – EXAMPLE, check the standard */
export const AQL = {
  lots: [[2, 8, "A"], [9, 15, "B"], [16, 25, "C"], [26, 50, "D"], [51, 90, "E"], [91, 150, "F"], [151, 280, "G"], [281, 500, "H"], [501, 1200, "J"], [1201, 3200, "K"], [3201, 10000, "L"], [10001, 35000, "M"], [35001, 150000, "N"], [150001, 500000, "P"], [500001, 1e12, "Q"]],
  letters: ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "Q", "R"],
  n: [2, 3, 5, 8, 13, 20, 32, 50, 80, 125, 200, 315, 500, 800, 1250, 2000],
  // letter where Ac = 0 / Re = 1 first appears per AQL (Table 2-A diagonal); the following letters: ↑ (use the 0/1 plan), ↓ (use the 1/2 plan), then Ac 1, 2, 3, 5, 7, 10, 14, 21
  ac0: { "0.65": "F", "1.0": "E", "1.5": "D", "2.5": "C", "4.0": "B", "6.5": "A" },
  acSeq: [1, 2, 3, 5, 7, 10, 14, 21],
  use: "Sampling only for bought parts (incoming: balls, seals, end caps, deflectors) and audit checks. Precision characteristics of our own parts are checked 100 % (CC / SC in the control plan).",
};

/* ------------------------------------------------------------------ MSA / gauge R&R example: block height H deviation (µm), electronic height gauge 0.1 µm,
 * 10 blocks × 3 operators (A, B, C) × 3 trials, tolerance class H ± 40 µm → T = 80 µm. GRR_DATA[operator][part][trial] */
export const GRR_DATA = [
  [[-14.9, -13.7, -13.9], [-8.9, -8.6, -8.4], [-3.0, -3.0, -2.6], [2.1, 2.5, 1.3], [4.4, 5.4, 4.7], [8.7, 10.5, 9.9], [12.5, 12.6, 13.1], [-11.4, -11.2, -11.6], [5.4, 5.4, 7.4], [15.8, 14.1, 15.8]],
  [[-13.1, -12.8, -13.3], [-7.5, -8.3, -8.8], [-2.4, -2.1, -2.5], [1.2, 1.9, 1.8], [6.3, 4.9, 5.1], [9.7, 10.3, 11.0], [14.0, 12.7, 13.0], [-9.5, -10.5, -10.8], [7.9, 8.0, 8.8], [16.6, 16.0, 15.8]],
  [[-14.1, -14.8, -14.7], [-8.9, -9.9, -8.1], [-3.9, -3.9, -3.9], [0.9, 0.5, 0.6], [4.7, 5.2, 4.8], [7.9, 8.4, 9.7], [12.2, 12.3, 12.0], [-11.0, -12.4, -12.4], [6.8, 5.0, 5.8], [16.8, 15.0, 15.3]],
];
export const GRR_INFO = { char: "LB-H", what: "carriage height H deviation on the master rail", unit: "µm", tol: 80, ops: ["A", "B", "C"], gauge: "electronic height gauge 0.1 µm + gauge block stack grade 0",
  K1: { 2: 0.8862, 3: 0.5908 }, K2: { 2: 0.7071, 3: 0.5231 }, K3: { 2: 0.7071, 3: 0.5231, 4: 0.4467, 5: 0.4030, 6: 0.3742, 7: 0.3534, 8: 0.3375, 9: 0.3249, 10: 0.3146 } };

/* ------------------------------------------------------------------ calibration intervals (examples – set by your calibration procedure, history and risk) */
export const CAL = [
  ["Laser interferometer (Renishaw XL-80 class) + compensator XC-80 + sensors", "12 months", "accredited lab (ISO/IEC 17025) or maker", "daily: compare with a reference screw / step gauge"],
  ["Reference (master) ball screw for the lead bench", "24 months", "accredited lab (laser)", "monthly: measure on the bench, compare the curve"],
  ["Gauge blocks grade 0 / K (ISO 3650)", "12 – 24 months", "accredited lab", "visual, wringing check"],
  ["Setting rings / ring masters, master bars", "12 months", "lab", "after a drop"],
  ["Ball-pin micrometer, outside micrometers", "6 – 12 months", "internal lab with gauge blocks", "zero check every shift"],
  ["Dial gauges, digital indicators, LVDT probes", "6 – 12 months", "internal lab (indicator tester)", "check with gauge block before use"],
  ["Air gauges + in-process gauges", "6 months (masters 12)", "internal", "re-master every shift / every 2 h"],
  ["Rockwell tester", "12 months (indirect verification ISO 6508-2)", "accredited lab / maker", "daily: certified test block (ISO 6508-3)"],
  ["Vickers / micro-hardness tester", "12 months (ISO 6507-2)", "accredited lab / maker", "weekly: test block (ISO 6507-3)"],
  ["Roughness tester", "12 months", "maker / lab", "daily: roughness standard (ISO 5436-1 type C)"],
  ["Contour tester", "12 months", "maker", "weekly: contour standard (radius + angle gauge)"],
  ["Torque sensor of the preload tester", "12 months", "accredited lab (torque)", "weekly: reference weight on the arm"],
  ["Force sensor of the matching station", "12 months", "accredited lab", "weekly: reference weight"],
  ["CMM (ISO 10360-2)", "12 months", "maker / accredited lab", "monthly: interim check with a step gauge / ball plate"],
  ["Granite surface plate (DIN 876 / ISO 8512-2 grade 00 / 0)", "24 – 36 months", "service (electronic level / autocollimator)", "clean daily"],
  ["Thermometers + room loggers", "12 months", "accredited lab", "compare 2 sensors monthly"],
  ["Master rail + master carriage", "12 months", "internal lab with CMM / bench", "daily zero on the bench"],
  ["Sound level meter class 1 + calibrator (IEC 61672 / 60942)", "24 months (calibrator 12)", "accredited lab", "calibrator before each shift"],
];

/* ------------------------------------------------------------------ measurement uncertainty budget (GUM, simple) – lead measurement over l_u = 700 mm
 * row: [name, half-width a (formula of x = l_u in m, dT = room ± tolerance K), distribution, divisor, note] – computed in bsfqa_calc.js uncBudget() */
export const UNC = [
  { id: "laser", n: "Laser wavelength + air compensation (XL-80 with XC-80: ± 0.5 ppm)", a: (L) => 0.5e-6 * L * 1e6, dist: "rectangular", div: Math.sqrt(3) },
  { id: "tsens", n: "Material temperature sensor (± 0.1 K) × α × L", a: (L) => ALPHA * L * 0.1, dist: "rectangular", div: Math.sqrt(3) },
  { id: "alpha", n: "Uncertainty of α (± 1 µm/(m·K)) × |T − 20 °C| × L", a: (L, dT) => 1.0 * L * dT, dist: "rectangular", div: Math.sqrt(3) },
  { id: "grad", n: "Temperature gradient along the screw not seen by the sensors (± 0.1 K)", a: (L) => ALPHA * L * 0.1, dist: "rectangular", div: Math.sqrt(3) },
  { id: "abbe", n: "Abbe offset 20 mm × carriage pitch 2″ (9.7 µrad)", a: () => 20 * 9.7e-6 * 1000, dist: "rectangular", div: Math.sqrt(3) },
  { id: "cos", n: "Cosine error (beam misalignment 0.2 mm over the travel)", a: (L) => (L * 1000) * Math.pow(0.2 / (L * 1000), 2) / 2 * 1000, dist: "rectangular", div: Math.sqrt(3) },
  { id: "rep", n: "Repeatability of the probe in the groove (s from 5 repeats = 0.3 µm)", a: () => 0.3, dist: "normal (s)", div: 1 },
  { id: "dead", n: "Dead path 100 mm × air change 0.2 K × 1 ppm/K", a: () => 0.1 * 0.2 * 1e-6 * 1e6, dist: "rectangular", div: Math.sqrt(3) },
];

/* ------------------------------------------------------------------ traceability: serial numbers + data model */
export const SERIAL = {
  fmt: { BS: "BS3210-YYMMDD-NNNN", BN: "BN3210-YYMMDD-NNNN", LG: "LG25-YYMMDD-NNNN", LB: "LB25-YYMMDD-NNNN", FABS: "A-BS-YYMMDD-NNNN", FALG: "A-LG-YYMMDD-NNNN" },
  prefix: { BS: "BS3210", BN: "BN3210", LG: "LG25", LB: "LB25", FABS: "A-BS", FALG: "A-LG" },
  where: "laser marked on the screw end face / flange OD / rail end + datum side / block side (data-matrix ECC 200 + plain text); the serial is created when the part leaves its first operation that can carry a mark (screw: after centring = op 30, nut: op 20, rail: op 30, block: op 20) – before that the LOT number travels on the lot card / RFID-free barcode card",
  entities: [
    ["Heat lot (material)", "heat no., mill, EN 10204 3.1 certificate, chemistry, cleanliness", "ERP (goods receipt)"],
    ["Production lot", "lot id, work order, route, qty, heat lot, furnace load no.", "MES"],
    ["Serial", "serial no., part code, lot, order, grade / class, status (OK / NOK / blocked / scrapped)", "MES + QA"],
    ["Operation record", "serial / lot, op no., machine id, operator badge, start / end, program / recipe, process values (Modbus signals)", "MES (from the gateway)"],
    ["Measurement record", "serial, characteristic id, value, unit, LSL / USL, decision, gauge id, calibration due date, operator, time, raw data file (curve)", "QA (this item) → MES"],
    ["Gauge", "gauge id, type, calibration date, due date, certificate, MSA result", "QA (calibration system)"],
    ["NCR / 8D", "NCR no., serial(s), characteristic, disposition (use-as-is / rework / scrap / return), root cause, actions", "QA"],
    ["Shipment", "delivery note, customer, serials in the box, test reports (lead curve, torque chart)", "ERP"],
  ],
};
/* one measurement record as the instrument PC / page posts it (HTTP JSON) – see bsfqa.js sendResult() */
export const RESULT_EXAMPLE = {
  serial: "BS3210-261113-0042", part: BS.code, char: "BS-V300", name: "Lead: variation in any 300 mm v_300", value: 9.4, unit: "µm", lsl: null, usl: ACC_BS.v300.C5,
  op: "120", machine: "QC-LED-01", gauge: "XL80-0317 (cal. due 2027-03-01)", operator: "badge 1043", lot: "L0012", heat: "50CrMo4 heat 7741 (example)",
  tMeas: "2026-11-13T09:41:12Z", source: "instrument-pc", curve: { file: "/qa/curves/BS3210-261113-0042.csv", step_mm: 1, lu_mm: LU, tMat_C: 20.31 },
};
export const NCR_STEPS = [
  ["detect", "D0 / D2 – detect + describe", "What is wrong, where, how many, since when? (IS / IS-NOT)"],
  ["contain", "D3 – contain", "block the lot + WIP + stock, 100 % check, inform the customer if shipped"],
  ["root-cause", "D4 – root cause", "5-Why + Ishikawa (man, machine, method, material, measurement, environment); prove it (switch on / off)"],
  ["action", "D5 / D6 – corrective action", "permanent action, implement, update control plan + FMEA + work instruction"],
  ["verify", "D7 – verify + prevent", "effectiveness check (Cpk, 3 lots without defect), lessons learned, similar processes"],
  ["close", "D8 – close + thank the team", "sign-off by quality + production"],
];
export const NCR_EXAMPLE = {
  title: "v_300 too high on screws ground on BS-TGR-03 (night shift)",
  is: "12 of 40 screws BS-3210 C5 with v_300 = 19 – 23 µm (limit 18 µm), all ground on BS-TGR-03 between 22:00 and 02:00",
  isnot: "not on BS-TGR-01 / 02, not on the day shift, e_p and v_2π OK",
  why: [
    "Why is v_300 too high? – a long wave (≈ 230 mm) with 8 µm amplitude is in the lead curve.",
    "Why is there a long wave? – the screw temperature changed by ≈ 1.5 K during the finish pass.",
    "Why did the temperature change? – the grinding-oil temperature rose from 20.0 to 21.6 °C.",
    "Why did the oil temperature rise? – the oil chiller of BS-TGR-03 tripped (alarm 213 'oil temperature drift').",
    "Why was it not stopped? – alarm 213 was only a warning on the HMI; no interlock, nobody on the machine at night.",
  ],
  ishikawa: { Man: "no reaction to the warning", Machine: "chiller tripped (dirty condenser)", Method: "alarm 213 = warning only", Material: "–", Measurement: "lead measured only at the end (no in-process lead probe trend)", Environment: "hall temperature at night OK" },
  actions: ["contain: block 40 screws, re-measure all screws of the night (done), 12 to C7 or regrind", "chiller cleaned + filter plan (maintenance)", "alarm 213 → interlock: no finish pass when |oil − 20 °C| > 0.5 K (PLC, item 8)", "oil temperature → gateway → MES trend + andon (item 4 / 6)", "FMEA + control plan updated: oil temperature as process parameter, 100 % recorded"],
  verify: "3 weeks without v_300 rejects; Ppk (v_300) from 0.9 to 1.6",
};

/* ------------------------------------------------------------------ standards register of item 5 (title, what for) – check the current edition */
export const STDS5 = [
  ["ISO 9001", "quality management systems – requirements"], ["IATF 16949", "automotive QMS (APQP, PPAP, control plan, MSA, SPC) – ideas used here"],
  ["ISO 3408-3", "ball screws – acceptance conditions and acceptance tests (e_p, v_up, v_300p, v_2πp, preload torque)"], ["JIS B 1192-3", "ball screws – accuracy grades C0 – C10, preload torque tolerance"],
  ["ISO 12090-1", "rolling bearings – profiled rail guides – boundary dimensions + tolerances (check scope); accuracy classes N/H/P/SP/UP are maker classes"],
  ["ISO 1101", "GPS – geometrical tolerancing (run-out, straightness, parallelism)"], ["ISO 6508-1 / -2 / -3", "Rockwell hardness – test, verification of testers, test blocks"],
  ["ISO 6507-1 / -2 / -3", "Vickers hardness"], ["ISO 18203", "steel – determination of the thickness of surface-hardened layers (CHD, SHD, NHD)"],
  ["ISO 21920-1 / -2 / -3", "GPS – surface texture: profile (replaces ISO 4287, ISO 4288, ISO 13565)"], ["ISO 4287 / ISO 4288", "legacy roughness standards (Ra, Rz) – still on many drawings"],
  ["ISO 1", "GPS – standard reference temperature 20 °C"], ["ISO 14253-1", "GPS – decision rules for verifying conformity (guard bands)"],
  ["JCGM 100 (GUM)", "evaluation of measurement data – guide to the expression of uncertainty"], ["ISO 22514-2 / -4", "statistical methods – process capability and performance"],
  ["ISO 7870-2", "control charts – Shewhart charts"], ["AIAG MSA 4th ed.", "measurement systems analysis (gauge R&R, ndc)"], ["AIAG SPC 2nd ed.", "statistical process control"],
  ["ISO 2859-1", "sampling procedures for inspection by attributes (AQL)"], ["ISO 3290-1", "rolling bearings – balls (grades G3 – G200)"],
  ["ISO 230-2", "test code for machine tools – positioning accuracy (laser) – related method"], ["ISO 10360-2", "CMM acceptance + reverification"],
  ["ISO 16232 / VDA 19.1", "technical cleanliness – particle contamination"], ["IEC 61672-1", "sound level meters"],
  ["ISO 9934-1", "magnetic particle testing"], ["ISO 15549", "eddy-current testing – general principles"], ["ISO/IEC 17025", "competence of testing + calibration laboratories"],
  ["ISO 10012", "measurement management systems"], ["DIN 876 / ISO 8512-2", "surface plates"], ["ISO 3650", "gauge blocks"], ["ISO/IEC 29158", "direct part marking – data-matrix quality"],
];
