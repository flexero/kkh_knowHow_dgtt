/* Ball screw + guide factory – item 2 "Manufacturing processes" – SHARED PROCESS DATA (item 2 owns it; items 3 layout + twin, 5 quality,
 * 6 MES, 7 ERP, 8 PLC import it).  Guide: docs/41_ballscrew_guide_manufacturing.md
 *
 *   import { NOTE2, PLANT, ROUTES, ROUTE_KEYS, VARIANTS, MTYPES, MACHINES, QGATES, SIGNALS, capacity, CAP0, opsOf, effCycle,
 *            machineOps, CARD2 } from "./bsfmfg_data.js";
 *
 * Units: minutes (setup, cycle), mm, m/min (vc), mm/rev (f), mm (ap), m/s (wheel speed vs), kW, kHz, °C, % (scrap).
 * Part codes = web/bsfprod_data.js (BS-3210-1000-C5, BN-3210-FL, LG-25-1000, LB-25-FL).
 * cyc   = cycle time per piece incl. load / unload (min). Batch furnaces: cyc = load time / pieces per load (machine-minutes per piece).
 * setup = set-up / change-over time per batch (min), batch = pieces per batch → effective time per piece = cyc + setup / batch.
 * Machines needed per machine type = Σ (effective time × start quantity) / (available minutes per day × OEE)   – see capacity().
 * EVERY VALUE IS AN EXAMPLE – check the machine maker's data, your tooling supplier and your own trials.
 */
import { BS, BN, LG, LB } from "./bsfprod_data.js";

export const NOTE2 = "Example process data – check the machine maker's data, the tooling supplier and your own trials.";

/* ------------------------------------------------------------------ plant target (example design point) */
export const PLANT = {
  name: "Example plant – ball screws + profiled linear guides",
  qty: { BS: 120, BN: 120, LG: 200, LB: 400, FABS: 120, FALG: 200 },   // good parts per day
  qtyTxt: "120 ground ball screws BS-3210 + 120 ball nuts BN-3210-FL per day; 200 rails LG-25-1000 (= 200 m) + 400 carriages LB-25-FL (2 per rail) per day; 120 screw sets + 200 guide sets assembled + packed",
  days: 250,              // working days per year
  shifts: 2, hShift: 7.5,  // 2 shifts × 7.5 h net (8 h − 0.5 h break) = 900 min/day
  shiftsHT: 3,            // heat treatment (furnaces, tempering) runs 3 shifts – furnaces do not like to cool down
  oee: 0.75,              // overall equipment effectiveness = availability × performance × quality (example for a new plant)
  room: "Grinding room + metrology 20 ± 1 °C (thread grinding + lead measurement 20 ± 0.5 °C), soft machining + heat treatment normal hall",
};
export const VARIANTS = {
  G: { n: "Ground from solid (C5 – main)", t: "Thread ground from the solid hardened shaft (single-rib wheel, 7 passes)." },
  W: { n: "Hard whirling + finish grinding (C5)", t: "Hard whirling removes the stock in one pass (15 min cut, 17 min cycle), 2 finish grinding passes (18 min + 4 min handling) give the C5 lead + profile." },
  R: { n: "Rolled (C7 / C10)", t: "Thread rolled in the soft state, then induction hardened + straightened – no thread grinding. Cheap, C7 (v300 50 µm) or C10." },
};

/* ------------------------------------------------------------------ routings
 * op: { no, op, mod (3D module), m (machine type id), tool, data (cutting / process data text), p (numbers for 3D + formulas),
 *       setup, cyc (number or {G,W,R}), batch, chk (check), gauge, freq, err (typical mistake), eff (effect), scrap %, gate (quality gate id), v (variants), buy } */
export const ROUTES = {
  BS: {
    code: BS.code, n: "Screw shaft", qtyKey: "BS", color: "#1f6fd1",
    material: "50CrMo4 +QT round bar Ø36, peeled, 250 – 300 HB (1 010 mm per shaft)",
    ops: [
      { no: "10", op: "Saw the bar to length 1 010 mm", mod: "saw", m: "MS-SAW", tool: "Bi-metal band M42 3/4 TPI, 34 × 1.1 mm (or carbide band)", data: "band speed vc 60 m/min, cutting rate 30 cm²/min, cutting oil emulsion 6 %", p: { d: 36, vc: 60, rate: 30 },
        setup: 10, cyc: 1.0, batch: 60, chk: "length 1 010 ± 1 mm, cut square ≤ 0.5 mm", gauge: "steel tape / length stop, square", freq: "first part + every 20th", err: "worn band runs off → crooked cut", eff: "facing allowance lost, centre drill off-centre", scrap: 0.2 },
      { no: "20", op: "Straighten the bar (soft)", mod: "press", m: "BS-STR", tool: "2 V-blocks (span 400 mm), ram with prism insert, 2 rollers + dial gauge", data: "3-point bending, press force ≈ 30 – 50 kN, overbend ≈ spring-back + set, target run-out ≤ 0.10 mm / m", p: { d: 36, span: 400, F: 45, ro0: 0.6, ro1: 0.08 },
        setup: 5, cyc: 2.5, batch: 60, chk: "run-out ≤ 0.10 mm (TIR) over the length", gauge: "dial gauge 0.01 mm on 2 rollers", freq: "100 %", err: "over-bending in one place", eff: "kink, high residual stress → shaft bends again after turning / hardening", scrap: 0.3 },
      { no: "30", op: "Face both ends + centre drill (DIN 332 form B)", mod: "centre", m: "BS-CTR", tool: "2 facing heads with CNMG inserts + centre drill B4 (60°, protected cone), HSS-Co / carbide", data: "facing vc 150 m/min, f 0.15 mm/rev; centre drill n 1 500 min⁻¹, f 0.05 mm/rev", p: { vc: 150, f: 0.15 },
        setup: 15, cyc: 1.2, batch: 60, chk: "total length 1 004 ± 0.2 mm, centre depth (Ø at the face)", gauge: "length gauge, centre-hole gauge", freq: "first part + every 20th", err: "centre off-axis or damaged", eff: "the centres are the datum of EVERY later operation → run-out in turning, hardening, grinding", scrap: 0.1, gate: "QG-BS-1" },
      { no: "40", op: "CNC turning between centres: journals, thread OD + stock, grooves, keyway", mod: "lathe", m: "BS-TRN", tool: "CNMG 120408 carbide P25 (rough), VNMG 160404 P15 (finish), grooving 2 mm, driven end mill Ø6 for the key slot; follow / steady rest", data: "rough vc 200 m/min, f 0.30 mm/rev, ap 1.8 mm; finish vc 250 m/min, f 0.12 mm/rev, ap 0.3 mm; thread zone left Ø32.4 (grinding stock 0.2 / side), journals + 0.3 mm", p: { d: 36, d1: 32.4, L: 870, vcR: 200, fR: 0.3, apR: 1.8, vcF: 250, fF: 0.12 },
        setup: 30, cyc: 9.0, batch: 40, chk: "Ø thread zone 32.4 ± 0.05, journals, lengths, run-out ≤ 0.05 mm", gauge: "outside micrometer, height gauge, dial gauge between centres", freq: "first part + 1 in 10", err: "no steady rest at L/D ≈ 31", eff: "chatter marks, taper, bent shaft", scrap: 0.5 },
      { no: "45", op: "Thread rolling (rolled screw only)", mod: "roll", m: "BS-ROL", tool: "2 cylindrical rolling dies Ø200 with the ball-groove profile (multi-start ring dies), DC53 / HSS 60 HRC", data: "in-feed + through-feed rolling, die 30 min⁻¹, axial feed ≈ 1 m/min, rolling force ≈ 100 – 150 kN, blank Ø = pitch Ø − allowance", p: { n: 30, vax: 1000 },
        setup: 60, cyc: 3.0, batch: 60, chk: "lead v300 (C7: 50 µm), pitch Ø over balls, OD", gauge: "lead tester sample, ball micrometer", freq: "first part + 1 in 20", err: "blank Ø wrong or die wear", eff: "flank shape / Ø error → wrong preload, flaking", scrap: 1.0, v: ["R"] },
      { no: "50", op: "Induction hardening of the thread zone (scanning)", mod: "induction", m: "BS-IND", tool: "1-turn copper coil Ø46 ID with integral spray quench ring, part rotating between centres (vertical)", data: "frequency 30 kHz, generator 60 kW (used ≈ 30 – 40 kW), scan speed 4 mm/s, rotation 150 min⁻¹, polymer quench 10 %, 25 °C; case 2 – 3 mm, 58 – 62 HRC, journals NOT hardened", p: { f: 30, P: 35, v: 4, rpm: 150, L: 850, case: 2.5 },
        setup: 20, cyc: 5.0, batch: 60, chk: "surface hardness 58 – 62 HRC, case depth 2 – 3 mm (Rht 550 HV), no cracks", gauge: "Rockwell tester (ISO 6508); cut-up + Vickers HV1 profile (ISO 18203); eddy-current / magnetic-particle crack test", freq: "HRC: first + 1 in 20; case depth: 1 cut-up per shift / new set-up; crack test 100 %", err: "power or scan speed drift, coil gap not centred", eff: "soft spots (spiral soft band), too deep → cracks + distortion, overheated thread run-out", scrap: 1.0, gate: "QG-BS-2" },
      { no: "60", op: "Tempering (batch furnace)", mod: "furnace", m: "HT-TMP", tool: "air-circulation tempering furnace, vertical hanging rack 60 shafts", data: "170 °C, 2 h at temperature (≈ 2.5 h incl. heat-up), start within 1 h after quenching; optional sub-zero −80 °C before tempering for C3", p: { T: 170, h: 2.5, load: 60 },
        setup: 0, cyc: 2.5, batch: 60, chk: "furnace temperature chart, hardness after temper 58 – 62 HRC", gauge: "furnace recorder (AMS 2750 style survey), Rockwell", freq: "every load", err: "tempering too late or too hot", eff: "late: delayed quench cracks; too hot: < 58 HRC → short life", scrap: 0.2 },
      { no: "70", op: "Straightening after hardening (automatic press)", mod: "press", m: "BS-STH", tool: "CNC straightening press 100 kN with laser / LVDT run-out measurement on rotating rollers, bend only in the soft journal zones + careful press in the hardened zone", data: "measure → compute bend point + stroke → bend → re-measure (3 – 6 loops), target run-out ≤ 0.02 mm over the thread", p: { d: 26.4, span: 300, F: 50, ro0: 0.25, ro1: 0.02 },
        setup: 10, cyc: 6.0, batch: 60, chk: "run-out ≤ 0.02 mm TIR along the thread, no cracks", gauge: "laser run-out sensor (built in), crack test by eddy current", freq: "100 %", err: "too large bend stroke in the hardened zone", eff: "cracks in the case (scrap), residual stress → bends again in grinding", scrap: 1.5, gate: "QG-BS-3" },
      { no: "80", op: "Centre-hole grinding (re-centring after hardening)", mod: "centre", m: "BS-CLP", tool: "centre-hole grinder with a 60° mounted point (corundum / CBN), planetary motion", data: "spindle 30 000 min⁻¹, planetary 300 min⁻¹, 0.02 – 0.05 mm per centre", p: { vc: 30, f: 0.02 },
        setup: 10, cyc: 1.5, batch: 60, chk: "centre roundness ≤ 1 µm, contact pattern ≥ 80 %", gauge: "blue-ink contact test on a master centre", freq: "first + 1 in 20", err: "dirty or scaled centre left", eff: "all ground diameters run out → journal run-out not to C5", scrap: 0.1 },
      { no: "90", op: "Cylindrical grinding: thread OD + journals", mod: "cylgrind", m: "BS-CGR", tool: "vitrified corundum wheel 89A 60 K7 V Ø500 × 63 (or CBN B126), diamond roll dresser", data: "vs 45 m/s, work 150 min⁻¹ (vw 0.25 m/s), plunge 0.005 mm/rev rough, 0.001 mm/rev finish + spark-out, emulsion / oil filtered 10 µm, dress every 10 parts", p: { vs: 45, ds: 500, nw: 150, a: 0.005 },
        setup: 25, cyc: 9.0, batch: 40, chk: "journal Ø h5, roundness ≤ 2 µm, journal run-out ≤ 3 µm, no burn", gauge: "in-process gauge (Marposs / Movomatic style), roundness tester sample, nital etch or Barkhausen noise for burn", freq: "Ø 100 % in-process; roundness + burn 1 in 20", err: "dull wheel, too fast in-feed", eff: "grinding burn (tempered / re-hardened layer) → cracks, flaking", scrap: 0.5 },
      { no: "95", op: "Hard whirling of the thread (whirling option)", mod: "whirl", m: "BS-WHL", tool: "whirling ring with 6 CBN / carbide inserts with the gothic-arch form, ring tilted by the lead angle 5.51°", data: "ring 1 500 min⁻¹ (vc ≈ 150 – 200 m/min on 60 HRC), work 6 min⁻¹, axial feed = Ph × n = 60 mm/min, dry or MQL, 1 pass full depth (15 min cut + 2 min load / probe)", p: { nr: 1500, nw: 6, Ph: 10, L: 850 },
        setup: 40, cyc: 17.0, batch: 30, chk: "profile + pitch Ø over balls, lead v300 sample", gauge: "ball micrometer, profile projector / contour tester", freq: "first + 1 in 10", err: "insert edge chipping not detected", eff: "groove form error, white layer → must be ground", scrap: 1.0, v: ["W"] },
      { no: "100", op: "Thread grinding (single-rib wheel)", mod: "threadgrind", m: "BS-TGR", tool: "single-rib vitrified corundum wheel Ø400 × 12 (or CBN B91), gothic-arch form dressed by a CNC diamond disc; wheel head tilted by the lead angle 5.51°", data: "vs 40 m/s; work speed rough 40 / semi 20 / finish 10 min⁻¹ (table feed = Ph × n = 400 / 200 / 100 mm/min); passes 3 + 2 + 2; radial infeed 0.30 / 0.08 / 0.02 mm; grinding oil 20 ± 0.5 °C, 200 l/min; dress before finishing; lead compensation (thermal + T value)", p: { vs: 40, ds: 400, Ph: 10, L: 850, over: 50, passes: [[3, 40], [2, 20], [2, 10]], tilt: 5.51 },
        setup: 45, cyc: { G: 40, W: 22 }, batch: 20, chk: "pitch Ø over balls, profile (contact angle 45°), in-process lead probe", gauge: "ball-pin micrometer, contour tester sample, lead probe in the machine", freq: "100 % in-process; profile 1 in 10", err: "oil temperature drifts 1 K", eff: "lead grows 10 µm over 850 mm → C5 (e_p ± 35 µm) lost; worn wheel profile → wrong contact angle", scrap: 1.5, gate: "QG-BS-4", v: ["G", "W"] },
      { no: "110", op: "Thread polishing / super-finishing (rolled screw)", mod: "cylgrind", m: "BS-CGR", tool: "abrasive film / polishing stones in a follow fixture", data: "work 300 min⁻¹, film 30 µm → 9 µm, oil", p: { vs: 5, ds: 100, nw: 300, a: 0.001 },
        setup: 10, cyc: 4.0, batch: 60, chk: "Ra ≤ 0.4 µm in the groove", gauge: "roughness tester (sample)", freq: "1 in 20", err: "film not changed", eff: "rough groove → noise, wear", scrap: 0.2, v: ["R"] },
      { no: "120", op: "Lead measurement (laser) + run-out", mod: "lead", m: "QC-LED", tool: "lead measuring machine: screw between centres, ball probe follows the groove, laser interferometer (Renishaw XL-80 class) + rotary encoder", data: "room 20 ± 0.5 °C, screw soaked ≥ 4 h, material temperature sensor, measure every 1 – 5 mm over the useful travel; evaluate e_p, v_up, v_300, v_2π (ISO 3408-3)", p: { L: 850, step: 5 },
        setup: 5, cyc: { G: 12, W: 12, R: 2 }, batch: 20, chk: "C5: e_p ± 35 µm, v_up 25 µm (l_u 700), v_300 18 µm, v_2π 8 µm", gauge: "laser interferometer + certificate print", freq: "C5: 100 % (lead chart with the screw); C7: 1 in 20", err: "screw not at 20 °C", eff: "false reject / false accept (10 µm per K over 850 mm)", scrap: 0.5, gate: "QG-BS-5" },
      { no: "130", op: "Wash, demagnetise, rust protection", mod: "wash", m: "AS-WSH", tool: "through-feed washer: alkaline wash 55 °C, rinse, hot-air dry, demagnetising tunnel, oil mist", data: "belt 1 m/min, residual magnetism ≤ 0.3 mT, cleanliness ≤ 1 mg per part (example)", p: { v: 1 },
        setup: 0, cyc: 1.5, batch: 60, chk: "residual magnetism, visual cleanliness", gauge: "Gauss meter", freq: "1 in 20", err: "magnetised shaft", eff: "chips stick in the groove → noise, early wear", scrap: 0 },
    ],
  },
  BN: {
    code: BN.code, n: "Ball nut", qtyKey: "BN", color: "#2e9e57",
    material: "20MnCr5 round bar Ø85 (108 mm per nut)",
    ops: [
      { no: "10", op: "Saw the bar Ø85 to slugs 108 mm", mod: "saw", m: "MS-SAW", tool: "bi-metal band M42 2/3 TPI", data: "vc 50 m/min, 30 cm²/min", p: { d: 85, vc: 50, rate: 30 },
        setup: 10, cyc: 2.4, batch: 120, chk: "length 108 ± 0.5", gauge: "caliper", freq: "first + 1 in 50", err: "burr left on the slug", eff: "chuck clamps wrong → run-out", scrap: 0.2 },
      { no: "20", op: "CNC turning soft (OP1 + OP2): bore, OD, flange, faces, internal thread pre-cut", mod: "lathe", m: "BN-TRN", tool: "U-drill Ø30, boring bar, CNMG / DNMG P25, internal thread pre-cutting bar with gothic-arch insert (stock 0.2 mm), sub-spindle for OP2", data: "turning vc 220 m/min, f 0.25 mm/rev, ap 2; drilling vc 150 m/min f 0.10; thread pre-cut 12 passes, vc 120 m/min", p: { d: 85, d1: 50.4, L: 100, vcR: 220, fR: 0.25 },
        setup: 45, cyc: 12.0, batch: 40, chk: "bore Ø, OD Ø50.4, flange, length, thread pitch Ø (pre-cut)", gauge: "bore gauge, micrometer, thread ball gauge", freq: "first + 1 in 10", err: "uneven thread pre-cut stock", eff: "long grinding time or unground black spots after grinding", scrap: 0.8 },
      { no: "30", op: "Drill flange holes, mill the flat, drill return holes, mill 4 deflector windows, tap M6", mod: "mill", m: "BN-MC", tool: "carbide drill Ø9, end mill Ø16 (flat), end mill Ø6 (deflector windows), tap M6, 4th axis (rotary table)", data: "drill vc 80 m/min f 0.15 mm/rev; mill vc 180 m/min fz 0.05 mm; windows ± 0.02 mm to the thread phase (probe the groove first)", p: { holes: 6, windows: 4 },
        setup: 40, cyc: 10.0, batch: 40, chk: "hole position, window position to the groove (angle + axial)", gauge: "CMM (sample), window position gauge", freq: "first + 1 in 20", err: "window not phased to the pre-cut groove", eff: "step in the ball path → noise, ball jam, deflector break", scrap: 0.8 },
      { no: "40", op: "Carburise + harden + temper (sealed-quench furnace line)", mod: "furnace", m: "HT-CAR", tool: "sealed-quench (integral quench) furnace + washer + tempering furnace, baskets 300 nuts per load", data: "carburise 920 °C, carbon potential 1.1 → 0.8 %C, ≈ 5 h, harden 840 °C, oil quench 60 °C, wash, temper 170 °C 2 h; Eht 0.8 – 1.2 mm (550 HV), 58 – 62 HRC; load ≈ 10 h", p: { T: 920, h: 10, load: 300 },
        setup: 0, cyc: 2.0, batch: 300, chk: "surface hardness, case depth Eht, core hardness, retained austenite ≤ 15 %, distortion (bore ovality)", gauge: "Rockwell, HV1 profile on a test piece (ISO 18203), microscope, X-ray diffraction (retained austenite, sample)", freq: "every load (test pieces + 3 parts)", err: "carbon potential too low / time too short", eff: "thin case → flaking under the balls; too much retained austenite → size change in service", scrap: 1.0, gate: "QG-BN-1" },
      { no: "50", op: "Hard turning: flange face, OD Ø50 g6, bore lands (CBN)", mod: "lathe", m: "BN-HTN", tool: "CBN insert (low-CBN content, chamfered edge), precision lathe with hydrostatic or very stiff slide", data: "vc 180 m/min, f 0.08 mm/rev, ap 0.10 mm, dry", p: { d: 50, d1: 50, L: 100, vcR: 180, fR: 0.08 },
        setup: 30, cyc: 6.0, batch: 40, chk: "OD g6, flange face run-out ≤ 5 µm to the bore", gauge: "air gauge, run-out on a mandrel", freq: "100 % OD, run-out 1 in 10", err: "worn CBN edge", eff: "white layer, size drift, face run-out → nut tilts on the table", scrap: 0.5 },
      { no: "60", op: "Internal thread grinding (small wheel on a long quill)", mod: "intgrind", m: "BN-ITG", tool: "CBN B76 vitrified wheel Ø25 × 6 on a 120 mm quill, gothic-arch form dressed by a diamond disc; quill tilted by the lead angle", data: "vs 30 m/s (≈ 23 000 min⁻¹); work rough 30 / finish 8 min⁻¹ (table 300 / 80 mm/min); passes 4 + 2; infeed 0.04 / 0.01 mm; oil 20 ± 1 °C", p: { vs: 30, ds: 25, Ph: 10, L: 80, passes: [[4, 30], [2, 8]], tilt: 5.51 },
        setup: 40, cyc: 9.0, batch: 30, chk: "pitch Ø over 2 balls, profile, lead over the nut length", gauge: "internal ball gauge, contour tester sample, master screw fit", freq: "100 % ball gauge; profile 1 in 10", err: "quill deflection (long, thin quill)", eff: "thread tapers (bell-mouth) → load only on one circuit → short life", scrap: 1.5, gate: "QG-BN-2" },
      { no: "70", op: "Wash + demagnetise", mod: "wash", m: "AS-WSH", tool: "through-feed washer", data: "as screw op 130", p: { v: 1 },
        setup: 0, cyc: 1.0, batch: 120, chk: "cleanliness", gauge: "visual / filter weight sample", freq: "1 in 50", err: "grinding sludge left in the return holes", eff: "balls jam, noise", scrap: 0 },
      { no: "80", op: "Insert deflectors + gauge-ball fit (select the ball size class)", mod: "bench", m: "AS-NAS", tool: "press-in tool for the 4 deflectors, master screw + gauge balls in 1 µm classes, LVDT", data: "deflector pressed ≤ 0.5 kN, flush ≤ 0.01 mm to the groove; measure axial play with gauge balls → choose the oversize class for P1 (3 % Ca)", p: { defl: 4 },
        setup: 10, cyc: 6.0, batch: 40, chk: "deflector step-free, axial play with gauge balls → ball class", gauge: "LVDT on the master screw, feeler", freq: "100 %", err: "deflector not fully seated", eff: "ball jam → sudden lock of the axis", scrap: 0.5, gate: "QG-BN-3" },
    ],
  },
  LG: {
    code: LG.code, n: "Rail", qtyKey: "LG", color: "#c27a12",
    material: "C55 cold-drawn rail profile size 25 (bought from a profile mill, 4 m bars → 1 020 mm blanks)",
    ops: [
      { no: "10", op: "Incoming profile check + cut to 1 020 mm", mod: "saw", m: "LG-SAW", tool: "circular cold saw Ø350 HSS-Co / carbide-tipped", data: "vc 120 m/min (carbide), feed 0.05 mm/tooth, emulsion", p: { d: 23, vc: 120, rate: 60 },
        setup: 10, cyc: 0.8, batch: 100, chk: "profile width / height, twist, length 1 020 ± 1", gauge: "profile gauge, caliper", freq: "first + 1 in 50 (profile: every bar lot)", err: "twisted profile not detected", eff: "grinding stock not enough → black spots", scrap: 0.3 },
      { no: "20", op: "Straighten (soft)", mod: "press", m: "LG-STR", tool: "rail straightening press with 2 supports + ram, vertical + horizontal", data: "≈ 20 – 40 kN, target ≤ 0.3 mm / m both planes", p: { d: 23, span: 500, F: 30, ro0: 1.0, ro1: 0.25 },
        setup: 5, cyc: 2.0, batch: 100, chk: "straightness ≤ 0.3 mm / m", gauge: "straight edge + feeler / laser", freq: "100 %", err: "over-bending", eff: "residual stress → banana after hardening", scrap: 0.2 },
      { no: "30", op: "Drill + counterbore 17 holes (pitch 60, E 20)", mod: "raildrill", m: "LG-DRL", tool: "carbide step drill Ø7 / counterbore Ø11 × 9 (one tool), 2 spindles on a gantry", data: "vc 90 m/min, f 0.12 mm/rev, internal coolant 20 bar; pitch ± 0.05 mm (soft)", p: { holes: 17, pitch: 60, E: 20 },
        setup: 20, cyc: 2.6, batch: 100, chk: "hole pitch, counterbore depth, burr-free", gauge: "pitch gauge bar, depth gauge", freq: "first + 1 in 20", err: "burr in the counterbore, wrong reference end", eff: "bolt head not flush, cumulative pitch error → rails do not fit the customer bed", scrap: 0.3 },
      { no: "40", op: "Induction hardening of the raceway shoulders (through-feed)", mod: "railind", m: "LG-IND", tool: "2 profiled hairpin coils (left + right shoulder) + spray quench, rail pushed through on rollers", data: "30 kHz, ≈ 80 kW, feed 8 mm/s, polymer quench; case 1.5 – 2.5 mm, 58 – 62 HRC, base stays soft", p: { f: 30, P: 80, v: 8, L: 1020 },
        setup: 20, cyc: 3.1, batch: 100, chk: "hardness, hardened pattern (macro etch), base soft", gauge: "Rockwell / HV, macro-etch cut-up", freq: "HRC first + 1 in 20; pattern 1 cut-up per shift", err: "pattern reaches the bolt-hole area", eff: "cracks from the holes, large banana distortion", scrap: 0.8, gate: "QG-LG-1" },
      { no: "50", op: "Tempering (batch furnace)", mod: "furnace", m: "HT-TMP", tool: "air-circulation furnace, rack 100 rails", data: "170 °C, 2 h (≈ 2.5 h incl. heat-up)", p: { T: 170, h: 2.5, load: 100 },
        setup: 0, cyc: 1.5, batch: 100, chk: "furnace chart, hardness", gauge: "recorder, Rockwell", freq: "every load", err: "tempering delayed", eff: "delayed cracks", scrap: 0.2 },
      { no: "60", op: "Straightening after hardening (CNC, 2 planes)", mod: "press", m: "LG-STH", tool: "CNC rail straightening press, laser measurement vertical + horizontal, 150 kN", data: "measure → bend → re-measure; target ≤ 0.10 mm / m both planes", p: { d: 23, span: 400, F: 80, ro0: 0.6, ro1: 0.08 },
        setup: 10, cyc: 4.0, batch: 100, chk: "straightness ≤ 0.10 mm / m vertical + horizontal", gauge: "built-in laser line", freq: "100 %", err: "bending on a hole (weak section)", eff: "crack at the hole, kink", scrap: 0.8 },
      { no: "70", op: "Grind the base (mounting surface) – magnetic chuck", mod: "surfgrind", m: "LG-SGR", tool: "surface grinder, corundum wheel 89A 46 J Ø400 × 50, magnetic chuck 2 000 × 500 (8 rails)", data: "vs 30 m/s, table 15 m/min, cross feed 10 mm, ap 0.01 mm, 0.1 mm stock", p: { vs: 30, vt: 15 },
        setup: 15, cyc: 1.5, batch: 100, chk: "base flatness, height to the top", gauge: "dial gauge on a surface plate", freq: "first + 1 in 20", err: "magnetic clamping pulls the bent rail flat", eff: "rail springs back after unclamping → straightness lost", scrap: 0.3 },
      { no: "80", op: "Profile grinding: top, datum side, 4 raceways (multi-head, form wheels)", mod: "profgrind", m: "LG-PGR", tool: "3 grinding heads: (1) top + datum side, (2) left raceways form wheel, (3) right raceways form wheel; vitrified corundum form wheels Ø350, CNC diamond profile roll dressing", data: "vs 35 m/s, table 10 m/min rough / 3 m/min finish, 2 + 1 passes, 4 rails in a string on a 4.5 m table, dress every string (Ud ≈ 3)", p: { vs: 35, vR: 10, vF: 3, rails: 4 },
        setup: 60, cyc: 3.5, batch: 100, chk: "raceway height + width over gauge balls, profile radius, running parallelism", gauge: "comparator gauge with master rail + gauge balls, contour tester sample, block + electronic probe along the rail", freq: "100 % height / width; parallelism 1 in 10; profile 1 per string", err: "dressing roll worn, wheel profile not re-dressed", eff: "wrong raceway radius → contact angle + preload wrong, block runs rough", scrap: 1.0, gate: "QG-LG-2" },
      { no: "90", op: "Final length cut 1 000 mm + end chamfer", mod: "saw", m: "LG-CUT", tool: "precision abrasive / carbide cut-off + end-face mill, length stop to the hole pattern", data: "E = 20 mm both ends (symmetric), length 1 000 ± 0.5, chamfer 0.5 × 45°", p: { d: 23, vc: 60, rate: 60 },
        setup: 10, cyc: 1.5, batch: 100, chk: "length + E dimension", gauge: "length gauge to the first hole", freq: "100 %", err: "cut from the wrong end", eff: "E not symmetric → rails do not butt-join", scrap: 0.3 },
      { no: "100", op: "Hole-pitch + straightness check, datum mark, wash, oil", mod: "railcheck", m: "QC-RAL", tool: "rail measuring bench (linear stage + camera / probe), electronic level, marker", data: "hole pitch 60 ± 0.2 cumulative, straightness + running parallelism class H (13 µm / 700 mm), mark datum side + class + serial", p: { holes: 17 },
        setup: 5, cyc: 3.0, batch: 100, chk: "hole pitch, running parallelism, height class", gauge: "measuring bench with camera, electronic probe", freq: "100 %", err: "rail measured warm from the grinder", eff: "false class", scrap: 0.3, gate: "QG-LG-3" },
    ],
  },
  LB: {
    code: LB.code, n: "Carriage (block)", qtyKey: "LB", color: "#8e44ad",
    material: "20CrMo4 cold-drawn / forged block profile (bought), 62 mm per body",
    ops: [
      { no: "10", op: "Cut the drawn block profile to 62 mm", mod: "saw", m: "LG-SAW", tool: "circular cold saw (shared with the rail)", data: "vc 120 m/min carbide, emulsion", p: { d: 70, vc: 120, rate: 60 },
        setup: 10, cyc: 0.6, batch: 200, chk: "length 62 ± 0.3", gauge: "caliper", freq: "first + 1 in 50", err: "burr", eff: "wrong clamping on the tombstone", scrap: 0.2 },
      { no: "20", op: "Milling all faces + flange + channel (tombstone, 12 blocks)", mod: "mill", m: "LB-MC", tool: "face mill Ø80 (carbide), form cutter for the channel, chamfer mill", data: "vc 220 m/min, fz 0.15 mm, ap 2 mm; channel rough with 0.25 mm grinding stock", p: { holes: 4, windows: 0 },
        setup: 60, cyc: 3.5, batch: 120, chk: "width 70, height, channel width + stock", gauge: "micrometer, height gauge", freq: "first + 1 in 20", err: "chips under the block on the tombstone", eff: "height error → grinding stock uneven", scrap: 0.5 },
      { no: "30", op: "Drill + tap 4 × M8, drill 4 return holes Ø7 × 58, end-cap holes M3, nipple hole", mod: "mill", m: "LB-MC", tool: "carbide drill Ø6.8 + tap M8, long carbide drill Ø7 (internal coolant 40 bar), drill Ø2.5 + tap M3", data: "drill vc 80 m/min f 0.12 mm/rev; return holes peck-free with IC", p: { holes: 8, windows: 0 },
        setup: 20, cyc: 3.0, batch: 120, chk: "hole positions, return hole position to the channel", gauge: "CMM sample, plug gauges", freq: "first + 1 in 20", err: "return hole drifts (long drill)", eff: "ball path step at the end cap → noise", scrap: 0.5 },
      { no: "40", op: "Carburise + harden + temper (shared furnace line)", mod: "furnace", m: "HT-CAR", tool: "sealed-quench furnace line, 200 blocks per load", data: "920 °C carburise, 840 °C oil quench, temper 170 °C; Eht 0.8 – 1.0 mm, 58 – 62 HRC", p: { T: 920, h: 10, load: 200 },
        setup: 0, cyc: 3.0, batch: 200, chk: "hardness, Eht, distortion of the channel", gauge: "Rockwell, HV1 test piece", freq: "every load", err: "blocks packed too tight in the basket", eff: "soft spots, uneven case", scrap: 1.0, gate: "QG-LB-1" },
      { no: "50", op: "Grind base + reference side (magnetic, blocks in a string)", mod: "surfgrind", m: "LB-SGR", tool: "surface grinder, corundum wheel, magnetic chuck with 20 blocks", data: "vs 30 m/s, table 15 m/min, ap 0.01 mm", p: { vs: 30, vt: 15 },
        setup: 15, cyc: 1.0, batch: 200, chk: "base flatness, reference side square", gauge: "dial gauge, square", freq: "first + 1 in 20", err: "chuck not cleaned", eff: "tilt → block height variation", scrap: 0.3 },
      { no: "60", op: "Raceway grinding (internal form grinding, 4 raceways)", mod: "blockgrind", m: "LB-RGR", tool: "form wheel Ø80 (CBN or corundum) inside the channel grinding 2 raceways per side, blocks clamped in a string of 10 on a dummy-rail fixture", data: "vs 30 m/s (CBN 45 m/s), table 3 m/min, 3 passes, dressing by diamond roll every string", p: { vs: 30, vt: 3, blocks: 10 },
        setup: 45, cyc: 2.2, batch: 200, chk: "raceway height + width over gauge balls vs master rail, profile", gauge: "comparator with gauge balls, contour tester sample", freq: "100 %; profile 1 per string", err: "string clamping distorts the blocks", eff: "height variation between blocks > class H (15 µm)", scrap: 1.0, gate: "QG-LB-2" },
      { no: "70", op: "Wash", mod: "wash", m: "AS-WSH", tool: "through-feed washer", data: "as screw op 130", p: { v: 1 },
        setup: 0, cyc: 0.5, batch: 200, chk: "cleanliness", gauge: "visual", freq: "1 in 50", err: "sludge in the return holes", eff: "noise, jam", scrap: 0 },
      { no: "75", op: "End caps + seals – injection moulded (BOUGHT, incoming check)", mod: "mould", m: "QC-INC", tool: "supplier: injection moulding machine 80 t, 4-cavity tool, POM / PA66", data: "incoming check: ball path step, flash, dimensions (sample AQL 0.65)", p: {},
        setup: 0, cyc: 0.1, batch: 400, chk: "ball path, flash, colour", gauge: "go / no-go gauge, microscope", freq: "AQL sample per lot", err: "flash in the ball turn-around", eff: "ball jam, noise", scrap: 0, buy: true },
      { no: "80", op: "Block assembly: return pipes, retainers, 4 × 30 balls, end caps, seals, nipple", mod: "bench", m: "AS-BAS", tool: "assembly bench with dummy rail, ball counting feeder, screwdriver with torque control", data: "end-cap screws 0.6 N·m, balls from the selected size class, grease 1.5 cm³", p: { defl: 0 },
        setup: 10, cyc: 4.0, batch: 100, chk: "ball count, smooth running on the dummy rail", gauge: "counter, hand feel", freq: "100 %", err: "one ball missing or wrong class", eff: "uneven load, noise, low rigidity", scrap: 0.3 },
      { no: "90", op: "Preload matching on the rail (drag force → ball size class Z1)", mod: "match", m: "QC-MAT", tool: "matching station: block on a master rail section, force sensor, height probe", data: "drag force Z1 ≈ 10 – 20 N (example), height H ± 0.04 class H; if outside → re-ball with the next size class", p: {},
        setup: 5, cyc: 2.0, batch: 100, chk: "drag force, height H, height variation of the pair", gauge: "force sensor, height probe", freq: "100 %", err: "rail section worn", eff: "wrong preload class shipped", scrap: 0.3, gate: "QG-LB-3" },
    ],
  },
  FABS: {
    code: "BS-3210-1000-C5 + BN-3210-FL", n: "Ball screw set – assembly + packing", qtyKey: "FABS", color: "#d62828",
    material: "screw shaft + ball nut + 60 balls + 2 seals + grease",
    ops: [
      { no: "10", op: "Ball loading of the nut onto the screw + preload torque check", mod: "assy", m: "AS-BSA", tool: "ball loading sleeve (arbor), torque tester (screw turns 60 min⁻¹, nut held by a force arm)", data: "balls of the selected oversize class; dynamic preload torque Tp ≈ 0.29 N·m ± 40 % (P1, example)", p: { Tp: 0.29 },
        setup: 10, cyc: 10.0, batch: 20, chk: "preload torque mean + variation along the stroke", gauge: "torque tester with chart", freq: "100 %", err: "wrong ball class", eff: "too high → heat, short life; too low → backlash", scrap: 0.5, gate: "QG-FA-1" },
      { no: "20", op: "Seals, snap rings, grease fill", mod: "assy", m: "AS-BSA", tool: "seal press-in tool, grease dosing gun", data: "3.5 cm³ lithium-complex NLGI 2", p: {},
        setup: 0, cyc: 3.0, batch: 20, chk: "seal seated, grease amount", gauge: "visual, dosing counter", freq: "100 %", err: "seal lip turned over", eff: "dirt inside, grease leaks", scrap: 0 },
      { no: "30", op: "Run-in + torque chart + noise check", mod: "runin", m: "AS-RUN", tool: "run-in stand: servo, torque sensor, microphone / accelerometer", data: "10 strokes at 500 min⁻¹ (5 m/min), torque chart, noise limit", p: { rpm: 500 },
        setup: 5, cyc: 6.0, batch: 20, chk: "torque variation, noise", gauge: "torque sensor, sound level", freq: "100 %", err: "running dry", eff: "false torque peaks, wear", scrap: 0.3, gate: "QG-FA-2" },
      { no: "40", op: "Laser marking (code, serial, grade, date)", mod: "mark", m: "AS-MRK", tool: "fibre laser marker 20 W", data: "mark on the nut flange + shaft end, data from MES (HTTP)", p: {},
        setup: 0, cyc: 0.5, batch: 20, chk: "readable data-matrix", gauge: "code reader", freq: "100 %", err: "wrong serial", eff: "lead certificate does not match the screw", scrap: 0 },
      { no: "50", op: "Rust protection + packing (VCI tube, wood box)", mod: "pack", m: "AS-PCK", tool: "oil dip, VCI film, plastic tube, supports every 300 mm", data: "lead chart + test report in the box", p: {},
        setup: 0, cyc: 3.0, batch: 20, chk: "documents, supports", gauge: "check list", freq: "100 %", err: "screw packed without supports", eff: "bent in transport", scrap: 0 },
    ],
  },
  FALG: {
    code: "LG-25-1000 + 2 × LB-25-FL", n: "Guide set – assembly + packing", qtyKey: "FALG", color: "#555",
    material: "rail + 2 carriages + 17 hole caps",
    ops: [
      { no: "10", op: "Set assembly: 2 matched blocks on the rail, drag force + running parallelism", mod: "match", m: "AS-GAS", tool: "assembly table, force gauge, electronic probe", data: "both blocks of the same preload + height class; drag force per block, running parallelism class H", p: {},
        setup: 5, cyc: 3.0, batch: 50, chk: "drag force, parallelism, height variation of the 2 blocks ≤ 15 µm", gauge: "force gauge, probe", freq: "100 %", err: "blocks mixed between classes", eff: "uneven load on the table", scrap: 0.2, gate: "QG-FA-3" },
      { no: "20", op: "Laser marking rail + blocks (datum mark, serial)", mod: "mark", m: "AS-MRK", tool: "fibre laser marker 20 W", data: "datum arrow area on the rail end, serial on the blocks", p: {},
        setup: 0, cyc: 1.1, batch: 50, chk: "readable", gauge: "code reader", freq: "100 %", err: "datum mark on the wrong side", eff: "customer mounts the wrong side to the shoulder", scrap: 0 },
      { no: "30", op: "Rust protection + packing (rail in VCI bag + wood profile, blocks on dummy rail)", mod: "pack", m: "AS-PCK", tool: "oil spray, VCI bag, wood profile", data: "hole caps in a bag", p: {},
        setup: 0, cyc: 2.5, batch: 50, chk: "documents, caps", gauge: "check list", freq: "100 %", err: "block slides off the dummy rail", eff: "balls fall out", scrap: 0 },
    ],
  },
};
export const ROUTE_KEYS = ["BS", "BN", "LG", "LB", "FABS", "FALG"];

/* ------------------------------------------------------------------ Modbus TCP signal groups (item 4 makes the register maps; here: what each machine will offer) */
export const SIGNALS = {
  std: ["status word: run / idle / set-up / alarm / e-stop + mode (UINT16 bits)", "counters good / scrap (UINT32)", "last cycle time s (REAL)", "alarm code (UINT16)", "order no. + part code (ASCII 20 ch)", "power kW + energy kWh (REAL)"],
  grind: ["wheel speed m/s + spindle power % (REAL)", "dressing counter + wheel Ø (REAL)", "coolant / oil temperature °C (REAL)", "in-process gauge Ø deviation µm (REAL)"],
  tgr: ["pass no. / passes, work speed min⁻¹", "lead compensation µm/m + screw temperature °C (REAL)", "wheel tilt angle ° (REAL)"],
  ind: ["power kW, frequency kHz, scan speed mm/s (REAL)", "quench flow l/min, quench temperature °C, polymer % (REAL)", "energy monitor kJ per part (REAL) – pass / fail"],
  furn: ["zone temperatures °C (REAL ×4)", "carbon potential %C, CO % (REAL)", "quench oil temperature °C (REAL)", "load no., program step, remaining time min"],
  press: ["run-out before / after µm (REAL)", "press force kN, stroke mm (REAL)", "bend count per part (UINT16)"],
  meas: ["e_p, v_up, v_300, v_2π µm (REAL ×4)", "grade result C3 / C5 / C7 / reject (UINT16)", "material temperature °C (REAL)"],
  torque: ["preload torque mean / variation N·m (REAL)", "drag force N (REAL)", "result OK / NOK + class (UINT16)"],
  cnc: ["spindle speed min⁻¹ + load % (REAL)", "tool no. + tool life % (UINT16)", "feed override % (UINT16)"],
  wash: ["bath temperature °C, conductivity (REAL)", "belt speed m/min (REAL)"],
};

/* ------------------------------------------------------------------ machine types (id = type; instances BS-TRN-01, -02 … in MACHINES) */
// area: soft (soft machining), ht (heat treatment), grind (grinding room 20 ± 1 °C), assy (assembly), qc (metrology room 20 ± 0.5 °C)
export const MTYPES = {
  "MS-SAW": { n: "Automatic bandsaw (bar)", area: "soft", makers: "Kasto · Behringer · Amada (saws) · Bianco (check)", kW: 5, foot: [3.5, 2.0], sig: ["std"], cost: "≈ 40 – 90 k€" },
  "BS-STR": { n: "Hydraulic straightening press 100 kN (soft bars)", area: "soft", makers: "MAE · Galdabini · Eitel (check)", kW: 7.5, foot: [3.0, 1.5], sig: ["std", "press"], cost: "≈ 60 – 150 k€" },
  "BS-CTR": { n: "Facing + centring machine (both ends)", area: "soft", makers: "Hessapp (check) · local makers", kW: 11, foot: [3.5, 1.8], sig: ["std", "cnc"], cost: "≈ 80 – 180 k€" },
  "BS-TRN": { n: "CNC lathe with tailstock + steady rest (≥ 1 200 mm between centres)", area: "soft", makers: "DMG MORI CTX · Okuma LB / LU · Mazak QT · Doosan Puma", kW: 22, foot: [4.5, 2.2], sig: ["std", "cnc"], cost: "≈ 150 – 300 k€" },
  "BS-ROL": { n: "Thread rolling machine (2-die, through-feed)", area: "soft", makers: "Profiroll · PeeWee · Rollwalztechnik (check)", kW: 30, foot: [3.0, 2.5], sig: ["std", "cnc"], cost: "≈ 250 – 500 k€" },
  "BS-IND": { n: "Vertical induction scanning hardening machine 60 kW / 30 kHz", area: "ht", makers: "EMA Indutec · EFD Induction · eldec (EMAG) · SMS Elotherm", kW: 80, foot: [3.0, 2.5], sig: ["std", "ind"], cost: "≈ 250 – 450 k€", shifts3: true },
  "HT-TMP": { n: "Air-circulation tempering furnace (≤ 300 °C)", area: "ht", makers: "Nabertherm · Aichelin · Ipsen · local makers", kW: 45, foot: [3.0, 2.5], sig: ["std", "furn"], cost: "≈ 60 – 150 k€", shifts3: true },
  "BS-STH": { n: "CNC automatic straightening press 100 kN with run-out measurement", area: "ht", makers: "MAE · Galdabini · Eitel (check)", kW: 11, foot: [3.5, 1.8], sig: ["std", "press"], cost: "≈ 200 – 400 k€" },
  "BS-CLP": { n: "Centre-hole grinder", area: "grind", makers: "local makers (check)", kW: 3, foot: [1.5, 1.2], sig: ["std"], cost: "≈ 30 – 80 k€" },
  "BS-CGR": { n: "CNC cylindrical grinder (1 000 mm between centres)", area: "grind", makers: "Studer (United Grinding) · Junker · Kellenberger · Okamoto · Toyo / JTEKT", kW: 25, foot: [4.5, 2.8], sig: ["std", "grind"], cost: "≈ 350 – 700 k€" },
  "BS-WHL": { n: "Hard whirling machine", area: "grind", makers: "Leistritz (LWN / Polygon) · Burgsmüller (check)", kW: 30, foot: [6.0, 2.5], sig: ["std", "cnc"], cost: "≈ 500 k€ – 1 M€" },
  "BS-TGR": { n: "CNC external thread grinder (ball screws ≤ 1.5 m)", area: "grind", makers: "Mitsui Seiki (check) · Drake Manufacturing (check) · Holroyd / Precision Technologies Group (check) · Matrix (check)", kW: 30, foot: [5.5, 2.8], sig: ["std", "grind", "tgr"], cost: "≈ 700 k€ – 1.5 M€" },
  "QC-LED": { n: "Lead measuring machine (laser) ≤ 2 m", area: "qc", makers: "Renishaw XL-80 laser + bench by the screw-machine maker / local integrator (check)", kW: 2, foot: [3.5, 1.2], sig: ["std", "meas"], cost: "≈ 120 – 300 k€" },
  "AS-WSH": { n: "Through-feed washer + demagnetiser + oiler", area: "assy", makers: "Dürr Ecoclean · MAFAC · BvL (check)", kW: 25, foot: [6.0, 1.8], sig: ["std", "wash"], cost: "≈ 80 – 200 k€" },
  "BN-TRN": { n: "CNC turning centre, main + sub-spindle, driven tools", area: "soft", makers: "DMG MORI NLX · Okuma LB3000 EX II MYW · Mazak QT-Nexus · Doosan Lynx / Puma", kW: 18.5, foot: [3.8, 2.0], sig: ["std", "cnc"], cost: "≈ 180 – 350 k€" },
  "BN-MC": { n: "Vertical machining centre with 4th axis", area: "soft", makers: "DMG MORI CMX / DMU · Okuma MB-V · Mazak VCN · Doosan DNM", kW: 15, foot: [3.0, 2.5], sig: ["std", "cnc"], cost: "≈ 100 – 250 k€" },
  "HT-CAR": { n: "Sealed-quench carburising furnace line (furnace, washer, temper, loader)", area: "ht", makers: "Ipsen · Aichelin · SECO/WARWICK · ALD (LPC option) – check", kW: 250, foot: [14, 6], sig: ["std", "furn"], cost: "≈ 1 – 2 M€", shifts3: true },
  "BN-HTN": { n: "Precision hard-turning lathe", area: "grind", makers: "Hembrug (check) · DMG MORI · EMAG VL · Okuma", kW: 15, foot: [3.0, 2.0], sig: ["std", "cnc"], cost: "≈ 200 – 400 k€" },
  "BN-ITG": { n: "CNC internal thread grinder (ball nuts)", area: "grind", makers: "Mitsui Seiki (check) · Drake (check) · Holroyd / PTG (check) · Okamoto (check)", kW: 18, foot: [4.0, 2.5], sig: ["std", "grind", "tgr"], cost: "≈ 600 k€ – 1.2 M€" },
  "AS-NAS": { n: "Nut assembly bench (deflector press, gauge-ball fit)", area: "assy", makers: "own design / local integrator", kW: 1, foot: [2.0, 1.2], sig: ["std", "torque"], cost: "≈ 30 – 80 k€" },
  "LG-SAW": { n: "Circular cold saw (rail + block profiles)", area: "soft", makers: "Kasto · Behringer · Tsune (check)", kW: 7.5, foot: [5.0, 2.0], sig: ["std"], cost: "≈ 60 – 150 k€" },
  "LG-STR": { n: "Rail straightening press (soft)", area: "soft", makers: "MAE · Galdabini (check)", kW: 7.5, foot: [5.0, 1.5], sig: ["std", "press"], cost: "≈ 80 – 160 k€" },
  "LG-DRL": { n: "CNC rail drilling centre (gantry, 2 spindles)", area: "soft", makers: "local machine builders · DMG MORI / Okuma long-bed VMC (check)", kW: 15, foot: [7.0, 2.5], sig: ["std", "cnc"], cost: "≈ 150 – 300 k€" },
  "LG-IND": { n: "Horizontal through-feed induction line for rails", area: "ht", makers: "EFD Induction · EMA Indutec · SMS Elotherm (check)", kW: 120, foot: [10, 2.5], sig: ["std", "ind"], cost: "≈ 400 – 700 k€", shifts3: true },
  "LG-STH": { n: "CNC rail straightening press 150 kN, 2 planes", area: "ht", makers: "MAE · Galdabini (check)", kW: 15, foot: [8.0, 2.0], sig: ["std", "press"], cost: "≈ 300 – 500 k€" },
  "LG-SGR": { n: "Surface grinder with magnetic chuck 2 000 × 500", area: "grind", makers: "Okamoto · Amada (check) · Blohm (United Grinding) · Jung", kW: 15, foot: [6.0, 3.0], sig: ["std", "grind"], cost: "≈ 250 – 500 k€" },
  "LG-PGR": { n: "Linear-guide rail profile grinder (multi-head, 4.5 m table)", area: "grind", makers: "Amada (check) · Okamoto (check) · Blohm Jung PROFIMAT (check) · Nagase (check)", kW: 60, foot: [12, 4.0], sig: ["std", "grind"], cost: "≈ 1 – 2 M€" },
  "LG-CUT": { n: "Precision cut-off + end machining for rails", area: "grind", makers: "local builders (check)", kW: 7.5, foot: [5.0, 1.5], sig: ["std"], cost: "≈ 60 – 150 k€" },
  "QC-RAL": { n: "Rail measuring bench (hole pitch, straightness, parallelism)", area: "qc", makers: "own design with Renishaw / Heidenhain scales + camera (check)", kW: 1, foot: [5.0, 1.2], sig: ["std", "meas"], cost: "≈ 80 – 200 k€" },
  "LB-MC": { n: "Horizontal machining centre with pallet changer + tombstones", area: "soft", makers: "DMG MORI NHX · Okuma MA-H · Mazak HCN · Doosan NHP", kW: 26, foot: [6.0, 4.0], sig: ["std", "cnc"], cost: "≈ 350 – 600 k€" },
  "LB-SGR": { n: "Surface grinder for blocks (magnetic chuck)", area: "grind", makers: "Okamoto · Amada (check) · Blohm · Jung", kW: 11, foot: [4.0, 2.5], sig: ["std", "grind"], cost: "≈ 150 – 300 k€" },
  "LB-RGR": { n: "Block raceway grinder (internal form grinding, string fixture)", area: "grind", makers: "Amada (check) · Okamoto (check) · Blohm Jung (check) · special builders", kW: 30, foot: [6.0, 3.0], sig: ["std", "grind"], cost: "≈ 600 k€ – 1.2 M€" },
  "QC-INC": { n: "Incoming inspection bench (bought plastic parts)", area: "qc", makers: "microscope + gauges", kW: 0.5, foot: [2.0, 1.0], sig: ["std"], cost: "≈ 10 – 30 k€" },
  "AS-BAS": { n: "Block assembly bench (ball feeder, dummy rail)", area: "assy", makers: "own design / local integrator", kW: 1, foot: [2.0, 1.2], sig: ["std"], cost: "≈ 20 – 60 k€" },
  "QC-MAT": { n: "Block preload matching station (drag force + height)", area: "qc", makers: "own design (force sensor HBM / Kistler class)", kW: 1, foot: [2.0, 1.2], sig: ["std", "torque"], cost: "≈ 40 – 100 k€" },
  "AS-BSA": { n: "Ball screw assembly + preload torque tester", area: "assy", makers: "own design (torque sensor HBM / Kistler / Lorenz class)", kW: 2, foot: [3.5, 1.2], sig: ["std", "torque"], cost: "≈ 60 – 150 k€" },
  "AS-RUN": { n: "Run-in stand (servo + torque + noise)", area: "assy", makers: "own design", kW: 3, foot: [3.0, 1.0], sig: ["std", "torque"], cost: "≈ 40 – 100 k€" },
  "AS-GAS": { n: "Guide set assembly + check table", area: "assy", makers: "own design", kW: 0.5, foot: [5.0, 1.2], sig: ["std", "torque"], cost: "≈ 20 – 60 k€" },
  "AS-MRK": { n: "Fibre laser marker 20 W (class 1 cabin)", area: "assy", makers: "Trumpf · Rofin (Coherent) · Keyence · Gravotech", kW: 1, foot: [1.5, 1.2], sig: ["std"], cost: "≈ 20 – 50 k€" },
  "AS-PCK": { n: "Packing station (oil, VCI, tubes, boxes, label printer)", area: "assy", makers: "local", kW: 1, foot: [4.0, 2.0], sig: ["std"], cost: "≈ 10 – 40 k€" },
  "QC-LAB": { n: "Laboratory: Rockwell + Vickers testers, metallography, roundness, contour, CMM (not in the routing)", area: "qc", makers: "Zwick/Roell · Struers · Wilson (Buehler) · Mitutoyo · Zeiss · Taylor Hobson", kW: 5, foot: [8, 6], sig: ["std"], cost: "≈ 300 – 600 k€", lab: true },
};

/* ------------------------------------------------------------------ quality gates (feeds item 5) */
export const QGATES = [
  { id: "QG-BS-1", r: "BS", after: "30", what: "centre holes", spec: "concentric, undamaged, 60°", how: "centre-hole gauge, blue-ink contact", freq: "first + 1 in 20", react: "re-centre; block the lot until checked" },
  { id: "QG-BS-2", r: "BS", after: "50", what: "hardness + case depth + cracks", spec: "58 – 62 HRC, Rht 550 HV at 2 – 3 mm, no cracks", how: "Rockwell (ISO 6508), HV1 profile on a cut-up (ISO 18203), eddy current 100 %", freq: "HRC 1 in 20, cut-up per shift, crack 100 %", react: "stop the induction machine, check coil gap + energy monitor" },
  { id: "QG-BS-3", r: "BS", after: "70", what: "run-out after straightening", spec: "≤ 0.02 mm TIR along the thread", how: "laser / LVDT on rotating rollers", freq: "100 %", react: "re-straighten (max. 2 ×), else scrap (crack risk)" },
  { id: "QG-BS-4", r: "BS", after: "100", what: "thread profile + pitch Ø", spec: "contact angle 45° ± 2°, pitch Ø ± 3 µm", how: "ball-pin micrometer, contour tester", freq: "pitch Ø 100 %, profile 1 in 10", react: "re-dress the wheel, check the dressing disc" },
  { id: "QG-BS-5", r: "BS", after: "120", what: "lead accuracy", spec: "C5: e_p ± 35 µm, v_up 25 µm, v_300 18 µm, v_2π 8 µm", how: "laser lead measuring machine (ISO 3408-3)", freq: "C5 100 %, C7 1 in 20", react: "downgrade to C7 or regrind with compensation" },
  { id: "QG-BN-1", r: "BN", after: "40", what: "case hardening result", spec: "58 – 62 HRC, Eht 0.8 – 1.2 mm, RA ≤ 15 %", how: "test pieces per load, HV1 profile, microscope", freq: "every load", react: "hold the load, re-temper / scrap" },
  { id: "QG-BN-2", r: "BN", after: "60", what: "internal thread pitch Ø + profile + lead", spec: "pitch Ø ± 3 µm, profile 45°, no taper > 2 µm", how: "internal ball gauge, contour tester, master screw", freq: "100 % / 1 in 10", react: "re-dress, check quill, adjust taper correction" },
  { id: "QG-BN-3", r: "BN", after: "80", what: "deflector fit + ball class", spec: "step ≤ 0.01 mm, ball class for 3 % Ca", how: "LVDT on master screw with gauge balls", freq: "100 %", react: "re-press / replace the deflector" },
  { id: "QG-LG-1", r: "LG", after: "40", what: "raceway hardness + pattern", spec: "58 – 62 HRC, case 1.5 – 2.5 mm, base soft", how: "Rockwell, macro-etch cut-up", freq: "1 in 20, cut-up per shift", react: "adjust power / feed, check the coil position" },
  { id: "QG-LG-2", r: "LG", after: "80", what: "raceway geometry", spec: "height + width ± class H, raceway radius, parallelism 13 µm / 700 mm", how: "comparator + gauge balls vs master rail, contour tester", freq: "100 %", react: "re-dress the form wheels, re-grind" },
  { id: "QG-LG-3", r: "LG", after: "100", what: "hole pitch + straightness + class", spec: "pitch 60 ± 0.2 cumulative, class H", how: "rail measuring bench", freq: "100 %", react: "downgrade class N / scrap" },
  { id: "QG-LB-1", r: "LB", after: "40", what: "case hardening result", spec: "58 – 62 HRC, Eht 0.8 – 1.0 mm", how: "test pieces per load", freq: "every load", react: "hold the load" },
  { id: "QG-LB-2", r: "LB", after: "60", what: "raceway geometry", spec: "height variation ≤ 15 µm (class H), profile", how: "comparator with gauge balls vs master rail", freq: "100 %", react: "re-dress, check string clamping" },
  { id: "QG-LB-3", r: "LB", after: "90", what: "preload (drag force) + height class", spec: "Z1 drag force window, height H ± 0.04", how: "matching station", freq: "100 %", react: "re-ball with the next ball class" },
  { id: "QG-FA-1", r: "FABS", after: "10", what: "preload torque", spec: "Tp 0.29 N·m ± 40 % (P1 example), variation per JIS / ISO 3408-3 table", how: "torque tester with chart", freq: "100 %", react: "re-ball with another class" },
  { id: "QG-FA-2", r: "FABS", after: "30", what: "run-in torque + noise", spec: "no torque peaks > limit, noise ≤ limit (example 65 dB(A) at 500 min⁻¹)", how: "run-in stand", freq: "100 %", react: "open the nut, check deflectors + balls" },
  { id: "QG-FA-3", r: "FALG", after: "10", what: "guide set check", spec: "drag force per block, running parallelism class H, pair height variation ≤ 15 µm", how: "force gauge + probe", freq: "100 %", react: "exchange the block" },
];

/* ------------------------------------------------------------------ helpers + capacity */
export const opsOf = (r, variant = "G") => ROUTES[r].ops.filter((o) => !o.v || o.v.includes(variant));
export const cycOf = (o, variant = "G") => (typeof o.cyc === "number" ? o.cyc : (o.cyc[variant] ?? o.cyc.G));
export const effCycle = (o, variant = "G") => cycOf(o, variant) + (o.batch ? o.setup / o.batch : 0);   // min per piece incl. set-up share

/** capacity({ qty, shifts, hShift, oee, variant, shiftsHT }) → { rows (per op), mach (per machine type), avail, availHT, takt, bottleneck }
 *  start quantity of an op = good quantity / Π (1 − scrap) of this op and all later ops of the route. */
export function capacity(o = {}) {
  const qty = { ...PLANT.qty, ...(o.qty || {}) }, shifts = o.shifts ?? PLANT.shifts, hShift = o.hShift ?? PLANT.hShift;
  const oee = o.oee ?? PLANT.oee, variant = o.variant || "G", shiftsHT = Math.max(shifts, o.shiftsHT ?? PLANT.shiftsHT);
  const avail = shifts * hShift * 60, availHT = shiftsHT * hShift * 60;
  const rows = [], mach = {};
  for (const r of ROUTE_KEYS) {
    const ops = opsOf(r, variant); let y = 1; const yl = [];
    for (let i = ops.length - 1; i >= 0; i--) { y *= 1 - ops[i].scrap / 100; yl[i] = y; }
    ops.forEach((op, i) => {
      const start = qty[ROUTES[r].qtyKey] / yl[i], eff = effCycle(op, variant), load = eff * start;
      const T = MTYPES[op.m], av = T && T.shifts3 ? availHT : avail;
      rows.push({ r, no: op.no, op: op.op, m: op.m, eff, start, load, need: load / (av * oee), buy: !!op.buy });   // bought op: the time is the incoming check
      const M = mach[op.m] || (mach[op.m] = { id: op.m, load: 0, avail: av, ops: [] });
      M.load += load; M.ops.push(r + " " + op.no);
    });
  }
  for (const M of Object.values(mach)) { M.need = M.load / (M.avail * oee); M.n = Math.max(1, Math.ceil(M.need - 1e-9)); M.util = M.need / M.n; }
  const list = Object.values(mach).sort((a, b) => b.util - a.util);
  const takt = {}; for (const r of ROUTE_KEYS) takt[r] = avail / qty[ROUTES[r].qtyKey];
  return { rows, mach, list, avail, availHT, oee, variant, takt, bottleneck: list[0], machines: list.reduce((k, m) => k + m.n, 0) };
}
export const CAP0 = capacity();     // default design point (PLANT)
export const machineOps = (id) => ROUTE_KEYS.flatMap((r) => ROUTES[r].ops.filter((o) => o.m === id).map((o) => ({ r, ...o })));

/* machine instances of the default design point – item 3 places them, item 4 gives each one an IP + Modbus unit id */
export const MACHINES = Object.entries(MTYPES).flatMap(([id, T]) => {
  const n = T.lab ? 1 : (CAP0.mach[id] ? CAP0.mach[id].n : 0);
  return Array.from({ length: n }, (_, i) => ({ id: `${id}-${String(i + 1).padStart(2, "0")}`, type: id, n: T.n, area: T.area, kW: T.kW, foot: T.foot,
    signals: T.sig.flatMap((g) => SIGNALS[g]) }));
});

/* ------------------------------------------------------------------ catalogue card (makeCard) */
const PR = "estimate – ask for a quote";
export const CARD2 = {
  guides: "guide 41", shopTab: "Shopping list (first line)", shopLbl: "first line", ph: "(e.g. Studer, induction, Renishaw)",
  buyNote: "Machine prices are rough estimates 2026 (" + PR + "); makers marked (check) – confirm that they offer this machine type.",
  drawings: [
    { sec: "Process flows", f: "41_screw_shaft_process_flow.svg", t: "Screw shaft – process flow", c: "Bar → saw → straighten → centre → turn → induction harden → temper → straighten → grind OD → thread grinding / whirling / rolling → lead measurement → wash, with machines + cycle times.", g: "guide 41 §6" },
    { sec: "Process flows", f: "41_ball_nut_process_flow.svg", t: "Ball nut – process flow", c: "Bar → turn → drill + mill windows → carburise → hard turn → internal thread grinding → deflectors + gauge balls.", g: "guide 41 §7" },
    { sec: "Process flows", f: "41_rail_process_flow.svg", t: "Rail – process flow", c: "Drawn profile → cut → straighten → drill → induction harden → temper → straighten → base + profile grinding → cut → hole-pitch check.", g: "guide 41 §8" },
    { sec: "Process flows", f: "41_carriage_process_flow.svg", t: "Carriage – process flow", c: "Profile → cut → HMC milling + drilling → carburise → base grinding → raceway grinding → assembly → preload matching.", g: "guide 41 §9" },
    { sec: "Hard finishing", f: "41_thread_grinding_principle.svg", t: "Thread grinding principle", c: "Single-rib wheel tilted by the lead angle, workpiece rotation synchronised with the table (feed = Ph × n), passes, dressing disc, thermal lead compensation.", g: "guide 41 §12" },
    { sec: "Hard finishing", f: "41_thread_whirling_principle.svg", t: "Thread whirling principle", c: "Whirling ring with 6 inserts, eccentric to the shaft, tilted by the lead angle; comma-shaped chips; work 6 min⁻¹, ring 1 500 min⁻¹.", g: "guide 41 §13" },
    { sec: "Heat treatment", f: "41_induction_hardening.svg", t: "Induction hardening – scanning", c: "Coil + spray ring moving along the rotating shaft, hardened case 2 – 3 mm, penetration depth δ = 503·√(ρ/(μr·f)), hardness profile.", g: "guide 41 §11" },
    { sec: "Hard finishing", f: "41_nut_internal_grinding.svg", t: "Ball nut internal thread grinding", c: "Small CBN wheel Ø25 on a long quill, quill deflection and taper, wheel speed 23 000 min⁻¹ for 30 m/s.", g: "guide 41 §14" },
    { sec: "Hard finishing", f: "41_rail_profile_grinding.svg", t: "Rail profile grinding", c: "3 heads: top + datum, left + right raceway form wheels, diamond roll dressing, rails in a string on the magnetic table.", g: "guide 41 §15" },
    { sec: "Straightening + measurement", f: "41_straightening.svg", t: "Straightening – 3-point bending", c: "V-blocks, ram, dial gauge, overbend = spring-back + set, force F = 4·M/L with M = σ·W.", g: "guide 41 §16" },
    { sec: "Straightening + measurement", f: "41_lead_measurement_setup.svg", t: "Lead measurement set-up", c: "Screw between centres, rotary encoder, ball probe carriage, laser interferometer, material temperature sensor; e_p / v_300 / v_2π chart.", g: "guide 41 §17" },
    { sec: "Plant", f: "41_capacity_chart.svg", t: "Capacity chart – machines needed", c: "Load per machine type at the design point (2 shifts, OEE 0.75), utilisation bars, bottleneck = thread grinding.", g: "guide 41 §19" },
    { sec: "Plant", f: "41_grinding_room_layout.svg", t: "Grinding room layout (20 ± 1 °C)", c: "Temperature-controlled room with thread grinders, cylindrical + profile grinders, metrology room 20 ± 0.5 °C, oil cooling, material flow.", g: "guide 41 §20" },
  ],
  groups: [
    { id: "soft", t: "Soft machining (saw, lathe, machining centres)", src: "guide 41 §21.1", rows: [
      ["CNC lathe ≥ 1 200 mm between centres, steady rest", "Ø36 bars × 1 010, 22 kW, tailstock, driven tools", "DMG MORI CTX beta / CLX (check)", "check", "≈ 150 – 300 k€ (" + PR + ")", "between centres, steady rest, live tools, bar loader / gantry"],
      ["Same", "same", "Okuma LB3000 EX II / LU (check)", "check", "≈ 150 – 300 k€", "same"],
      ["Same", "same", "Mazak QT-Nexus / Quick Turn (check)", "check", "≈ 150 – 300 k€", "same"],
      ["Same", "same", "Doosan (DN Solutions) Puma / Lynx (check)", "check", "≈ 120 – 250 k€", "same"],
      ["Turning centre main + sub-spindle (nut)", "Ø85 chuck work, sub-spindle, Y axis", "DMG MORI NLX · Okuma LB-MYW · Mazak QT-Nexus MS · Doosan Puma SMX", "check", "≈ 180 – 350 k€", "bar Ø, sub-spindle, Y axis, gantry loader"],
      ["Vertical machining centre + 4th axis (nut)", "flange drilling, deflector windows", "DMG MORI CMX V · Okuma MB-46V · Mazak VCN · Doosan DNM", "check", "≈ 100 – 250 k€", "rotary table, probe"],
      ["Horizontal machining centre + tombstones (blocks)", "12 blocks per tombstone, pallet changer", "DMG MORI NHX · Okuma MA-500 · Mazak HCN · Doosan NHP", "check", "≈ 350 – 600 k€", "pallet pool, tool magazine ≥ 60, IC 40 bar"],
      ["Bandsaw / cold saw", "Ø36 – Ø85 bars, rail + block profiles", "Kasto · Behringer · Amada saws (check)", "check", "≈ 40 – 150 k€", "auto feed, bundle clamping"],
      ["Thread rolling machine (rolled screws)", "2-die through-feed", "Profiroll (check) · PeeWee (check)", "check", "≈ 250 – 500 k€", "rolling force, die Ø, through-feed length"],
    ] },
    { id: "ht", t: "Heat treatment (induction, carburising, tempering)", src: "guide 41 §21.2", rows: [
      ["Vertical induction scanning machine 60 kW, 30 kHz", "shaft ≤ 1 500 mm, spray quench, energy monitor", "EMA Indutec (check)", "check", "≈ 250 – 450 k€ (" + PR + ")", "generator kW + frequency range, energy monitor, quench system, coil change"],
      ["Same", "same", "EFD Induction (check)", "check", "≈ 250 – 450 k€", "same"],
      ["Same", "same", "eldec (EMAG group) (check)", "check", "≈ 250 – 450 k€", "same"],
      ["Same", "same", "SMS Elotherm (check)", "check", "≈ 250 – 450 k€", "same"],
      ["Rail induction through-feed line", "2 hairpin coils, 80 – 120 kW", "EFD Induction · EMA Indutec · SMS Elotherm (check)", "check", "≈ 400 – 700 k€", "rail sizes, feed speed, straightness after hardening"],
      ["Sealed-quench carburising furnace line", "≥ 600 kg per load, washer, temper", "Ipsen · Aichelin · SECO/WARWICK (check)", "check", "≈ 1 – 2 M€", "load size, carbon control, oil quench, LPC option"],
      ["Low-pressure carburising (LPC) + gas quench (option)", "less distortion, no IGO", "ALD Vacuum Technologies · Ipsen · SECO/WARWICK (check)", "check", "≈ 1.5 – 3 M€", "distortion, cycle, gas pressure"],
      ["Tempering furnace", "≤ 300 °C, air circulation", "Nabertherm · Aichelin · local (check)", "check", "≈ 60 – 150 k€", "uniformity ± 5 K survey"],
    ] },
    { id: "grind", t: "Grinding (cylindrical, thread, internal thread, profile, surface)", src: "guide 41 §21.3", rows: [
      ["CNC cylindrical grinder 1 000 mm", "between centres, in-process gauge", "Studer S33 / S41 (United Grinding)", "check", "≈ 350 – 700 k€ (" + PR + ")", "between centres, wheel Ø, in-process gauge, B axis"],
      ["Same", "same", "Junker (check type)", "check", "≈ 400 – 800 k€", "same; CBN high speed"],
      ["Same", "same", "Kellenberger (check)", "check", "≈ 350 – 700 k€", "same"],
      ["External thread grinder for ball screws", "≤ 1.5 m, single-rib wheel, CNC dresser, lead compensation", "Mitsui Seiki (check)", "check", "≈ 700 k€ – 1.5 M€", "max length, lead accuracy achieved, dressing, thermal control, references (ball screw makers)"],
      ["Same", "same", "Drake Manufacturing GS:TE (check)", "check", "≈ 700 k€ – 1.5 M€", "same"],
      ["Same", "same", "Holroyd / Precision Technologies Group (check)", "check", "≈ 700 k€ – 1.5 M€", "same"],
      ["Same", "same", "Matrix Machine Tools (check)", "check", "ask for a quote", "same"],
      ["Hard whirling machine", "Ø16 – 63, 1.5 m", "Leistritz (check type)", "check", "≈ 500 k€ – 1 M€", "hard whirling 60 HRC, insert life, accuracy C5 / C7"],
      ["Internal thread grinder for ball nuts", "nut ID ≥ 25 mm, quill ≤ 150 mm, 30 000 min⁻¹", "Mitsui Seiki · Drake · Holroyd / PTG · Okamoto (all check)", "check", "≈ 600 k€ – 1.2 M€", "min. bore, quill stiffness, CBN wheel, taper correction"],
      ["Rail profile grinder multi-head", "rails size 15 – 35, 4.5 m table", "Amada (check) · Okamoto (check) · Blohm Jung PROFIMAT (check) · Nagase (check)", "check", "≈ 1 – 2 M€", "heads, form dressing, magnetic chuck straightness, string length"],
      ["Block raceway grinder", "internal form wheel, string fixture", "Amada · Okamoto · Blohm Jung · special builders (all check)", "check", "≈ 600 k€ – 1.2 M€", "wheel Ø vs channel, CBN option"],
      ["Surface grinder 2 000 × 500 magnetic", "rail base, block base", "Okamoto · Blohm · Jung · Amada (check)", "check", "≈ 150 – 500 k€", "chuck size, auto-dressing"],
      ["Grinding wheels + dressers", "corundum 89A, CBN B76 – B126, diamond rolls + discs", "Tyrolit · Norton (Saint-Gobain) · Krebs & Riedel · Noritake · Winterthur (3M) · Dr. Kaiser (dressers)", "check", "≈ 0.3 – 5 k€ per wheel / roll", "grit, bond, speed rating, dressing system"],
      ["Grinding-oil filtration + cooling", "≤ 5 µm, 20 ± 0.5 °C", "Knoll · Mayfran · Losma · Filtration Group (check)", "check", "≈ 50 – 200 k€ per central plant", "flow, filter fineness, chiller capacity"],
    ] },
    { id: "str", t: "Straightening presses", src: "guide 41 §21.4", rows: [
      ["Automatic straightening press with run-out measurement", "100 – 150 kN, shafts + rails", "MAE (check) · Galdabini (check) · Eitel (check)", "check", "≈ 200 – 500 k€ (" + PR + ")", "force, measuring system, bend algorithm, crack monitoring"],
    ] },
    { id: "meas", t: "Measurement + laboratory", src: "guide 41 §21.5", rows: [
      ["Laser interferometer for lead measurement", "linear measurement, environmental compensation", "Renishaw XL-80 + XC-80", "± 0.5 ppm (check)", "≈ 25 – 40 k€", "material sensors, software, bench integration"],
      ["Lead measuring machine (complete)", "≤ 2 m screws, ball probe, encoder", "integrator / screw-machine makers (check)", "check", "≈ 120 – 300 k€", "uncertainty, ISO 3408-3 evaluation, report"],
      ["Rockwell hardness tester", "HRC, ISO 6508", "Zwick/Roell · Wilson (Buehler) · Mitutoyo · Emco-Test (check)", "check", "≈ 8 – 25 k€", "test blocks, automatic cycle"],
      ["Micro-Vickers + metallography", "HV1 profile, case depth ISO 18203", "Struers · Buehler · Qness (check)", "check", "≈ 40 – 120 k€", "auto traverse, cut-off + mount + polish"],
      ["Roundness + contour testers", "roundness ≤ 0.05 µm, contour", "Taylor Hobson · Mahr · Mitutoyo · Jenoptik (Hommel) (check)", "check", "≈ 60 – 200 k€ each", "thread profile software"],
      ["CMM", "hole positions, windows", "Zeiss · Hexagon · Mitutoyo (check)", "check", "≈ 100 – 250 k€", "temperature range"],
      ["Eddy-current / Barkhausen crack + burn testing", "100 % on shafts", "Foerster (check) · Stresstech (Barkhausen) (check)", "check", "≈ 50 – 150 k€", "probe, automatic scanning"],
    ] },
    { id: "assy", t: "Washing, assembly, marking, packing", src: "guide 41 §21.6", rows: [
      ["Through-feed washer + demagnetiser", "alkaline, dry, demag", "Dürr Ecoclean · MAFAC · BvL (check)", "check", "≈ 80 – 200 k€", "cleanliness spec"],
      ["Torque sensors for preload + run-in", "0 – 5 N·m, ± 0.1 % FS", "HBM (HBK) · Kistler · Lorenz Messtechnik (check)", "check", "≈ 2 – 6 k€ each", "range, speed, Modbus / analog out"],
      ["Fibre laser marker 20 W", "data-matrix, class 1 cabin", "Trumpf · Keyence · Gravotech · Coherent (Rofin) (check)", "check", "≈ 20 – 50 k€", "Ethernet interface, marking speed"],
    ] },
  ],
  shopTitle: "First line (ramp-up, 1 shift, ≈ 20 screws + 20 nuts + 30 rails + 60 blocks per day): one machine of each key type, sub-contract carburising + rail induction at first – guide 41 §22.",
  shopNote: "Prices are rough estimates 2026 – ask for a quote. Buildings, grinding room HVAC (20 ± 1 °C), compressed air, power supply and installation are extra.",
  shops: [
    { title: "Machines + equipment – first line", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (" + PR + ")"], m: 4, p: 5, rows: [
      ["1", "1", "Bandsaw automatic", "Ø20 – 100 bars", "Kasto · Behringer", "≈ 40 – 90 k€"],
      ["2", "1", "Straightening press (manual + dial gauge)", "100 kN", "MAE · Galdabini", "≈ 60 – 150 k€"],
      ["3", "1", "CNC lathe between centres + steady rest", "1 200 mm, 22 kW", "DMG MORI · Okuma · Mazak · Doosan", "≈ 150 – 300 k€"],
      ["4", "1", "Turning centre main + sub-spindle", "nuts", "DMG MORI · Okuma · Mazak · Doosan", "≈ 180 – 350 k€"],
      ["5", "1", "Vertical machining centre + 4th axis", "nuts + blocks (first line)", "DMG MORI · Okuma · Mazak · Doosan", "≈ 100 – 250 k€"],
      ["6", "1", "Induction scanning machine 60 kW", "shafts (rails sub-contracted)", "EMA Indutec · EFD · eldec", "≈ 250 – 450 k€"],
      ["7", "1", "Tempering furnace", "≤ 300 °C", "Nabertherm · Aichelin", "≈ 60 – 150 k€"],
      ["8", "1", "CNC automatic straightening press", "100 kN + run-out laser", "MAE · Galdabini · Eitel", "≈ 200 – 400 k€"],
      ["9", "1", "CNC cylindrical grinder", "1 000 mm", "Studer · Junker · Kellenberger", "≈ 350 – 700 k€"],
      ["10", "1", "External thread grinder", "≤ 1.5 m ball screws", "Mitsui Seiki · Drake · Holroyd / PTG (check)", "≈ 0.7 – 1.5 M€"],
      ["11", "1", "Internal thread grinder", "ball nuts", "Mitsui Seiki · Drake · Holroyd / PTG (check)", "≈ 0.6 – 1.2 M€"],
      ["12", "1", "Rail profile grinder (or used machine)", "4.5 m, 3 heads", "Amada · Okamoto · Blohm Jung (check)", "≈ 1 – 2 M€"],
      ["13", "1", "Surface grinder magnetic 2 000 × 500", "rail + block base", "Okamoto · Blohm · Jung", "≈ 250 – 500 k€"],
      ["14", "1", "Lead measuring machine with laser", "≤ 2 m", "Renishaw XL-80 + integrator", "≈ 120 – 300 k€"],
      ["15", "1", "Laboratory set (Rockwell, micro-Vickers, cut-off, roundness, contour)", "QC-LAB", "Zwick/Roell · Struers · Taylor Hobson · Mahr", "≈ 200 – 400 k€"],
      ["16", "1", "Washer + demagnetiser", "through-feed", "Dürr Ecoclean · MAFAC", "≈ 80 – 200 k€"],
      ["17", "2", "Assembly benches (nut + block) + torque tester + run-in stand", "own design", "HBM / Kistler sensors", "≈ 100 – 250 k€"],
      ["18", "1", "Laser marker + packing station", "20 W", "Trumpf · Keyence", "≈ 30 – 80 k€"],
      ["19", "1 set", "Grinding wheels, dressers, gauges, gauge balls, master screw + master rail", "start kit", "Tyrolit · Norton · Dr. Kaiser · ball maker", "≈ 80 – 200 k€"],
      ["20", "1", "Grinding room HVAC 20 ± 1 °C + oil chillers", "≈ 600 m²", "local HVAC + Knoll / Losma chillers", "≈ 300 – 800 k€"],
    ] },
  ],
};
