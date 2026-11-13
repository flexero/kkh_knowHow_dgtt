/* Ball screw + guide factory – SHARED REFERENCE PRODUCT DATA (item 1 owns it; items 2 – 8 import it).
 * Guide: docs/40_ballscrew_linear_guide_products.md
 *
 *   import { NOTE, BS, BN, LG, LB, MAT, ACC_BS, ACC_LG, PRELOAD_BS, PRELOAD_LG, MOUNT_LG, SUPPORT, NUT_TYPES, DN_LIMIT,
 *            BOM, FAMILY, PRODUCTS, codeBS, codeLG } from "./bsfprod_data.js";
 *
 * Units: mm, N, N·m, µm, min⁻¹ (rpm), kg, °C unless the key says otherwise.
 * Codes (contract docs/40_contract_bsf.md): BS-3210-1000-C5 (screw shaft), BN-3210-FL (ball nut), LG-25-1000 (rail), LB-25-FL (carriage).
 * EVERY VALUE IS AN EXAMPLE of catalogue class (THK / HIWIN / NSK / Bosch Rexroth / Schaeffler style) – check the maker's catalogue.
 */
export const NOTE = "Example values of catalogue class (THK / HIWIN / NSK / Bosch Rexroth / Schaeffler style) – check the maker's catalogue.";

/* ------------------------------------------------------------------ ball screw shaft BS-3210-1000-C5 */
export const BS = {
  code: "BS-3210-1000-C5", name: "Ground ball screw shaft Ø32 × lead 10, 1 000 mm, grade C5",
  d0: 32,            // nominal diameter
  Ph: 10,            // lead (= pitch, 1 start)
  starts: 1, hand: "right",
  dpw: 33.0,         // ball circle (pitch circle) diameter – ball centres
  dr: 26.4,          // root (minor) diameter used for rigidity, buckling, critical speed (catalogue); the gothic-arch profile below gives ≈ 26.5
  dOut: 31.5,        // outside diameter of the lands
  Lthread: 850, Ltot: 1000,
  ends: { fixed: "Ø25 h5 journal for the angular-contact pair + M25 × 1.5 lock-nut thread, motor journal Ø20 h6 with key 6 × 6", float: "Ø20 h6 journal + snap-ring groove DIN 471" },
  grade: "C5", leadAngleDeg: 5.51,
  material: "50CrMo4 (1.7228, SCM440 class) or CF53 (1.1213, S53C class) – quenched + tempered core 250 – 300 HB",
  hardness: "raceway induction hardened 58 – 62 HRC, case depth ≥ 1.5 mm (≈ 2 – 3 mm for Ø32), journals 20 – 30 HRC (soft for machining)",
  roughness: "raceway Ra ≤ 0.2 µm (ground), journals Ra ≤ 0.4 µm",
  runout: "radial run-out of the bearing journals to the thread axis ≤ 8 µm (C5 example, ISO 3408-3 t5 class)",
  E: 206000, rho: 7850, alphaT: 11.8e-6,
  mass: 5.4,         // kg/m ≈ ρ·π·d²/4 (Ø29.5 mean)
};

/* ------------------------------------------------------------------ ball nut BN-3210-FL */
export const BN = {
  code: "BN-3210-FL", name: "Flanged single ball nut, DIN 69051-5 form B style, internal deflector, preload P1",
  Dw: 6.35,          // ball diameter 1/4"
  f: 0.53,           // conformity ratio r_groove / Dw (0.52 – 0.56 typical)
  alphaDeg: 45,      // contact angle
  profile: "gothic arch (two arcs, radius r = f·Dw = 3.37 mm, centres offset e = r − Dw/2 = 0.19 mm along the 45° contact line)",
  circuits: 4, turnsPerCircuit: 1, ballsPerCircuit: 15, ballsTotal: 60,
  Ca: 38000,         // basic dynamic axial load rating (10⁶ rev)
  C0a: 76000,        // basic static axial load rating
  preloadPct: 3, Fpr: 1140,   // P1 = 3 % Ca by ball oversize (≈ +2 … +6 µm over the "zero-clearance" ball)
  Kn: 670,           // nut axial rigidity at 3 % Ca (catalogue ≈ 1 000 N/µm at 10 % Ca, scaled with (Fpr/0.1Ca)^(1/3))
  KnCat: 1000,
  DN: 120000,        // high-speed internal-deflector nut (standard nuts ≈ 70 000) – check catalogue
  D1: 50,            // nut body outside diameter (g6)
  D4: 80,            // flange diameter
  flangeT: 12,       // flange thickness
  boltCircle: 65, bolts: "6 × Ø9 (M8)", flats: "one flat at 62 mm (form B style)",
  L: 100,            // nut length incl. seals
  material: "20MnCr5 (1.7147) / 20CrMo4 (SCM420 class) case hardened, or 100Cr6 (1.3505) through-hardened",
  hardness: "58 – 62 HRC on the ball track, case depth 0.8 – 1.2 mm (Eht 550 HV)",
  seals: "2 wiper seals (NBR / TPU lip or labyrinth POM), snap rings",
  lube: "grease nipple M6 or lube hole on the flange; initial fill lithium-complex grease NLGI 2",
  mass: 1.2,
};

/* nut return systems: main = internal deflector; options end cap and tube */
export const NUT_TYPES = {
  deflector: { n: "Internal deflector (main)", circuits: 4, turns: 1, DN: 120000,
    how: "Each circuit is ONE turn. A small deflector (sintered steel / plastic insert in the nut wall) lifts the ball over the land of the screw and puts it back into the previous groove. Short circuits, compact nut OD, quiet. Standard for precision C3 – C5 nuts." },
  endcap: { n: "End-cap return (option)", circuits: 1, turns: 3.8, DN: 150000,
    how: "Balls run several turns along the whole loaded length, leave the groove tangentially into an end cap, travel back through an axial hole in the nut body and enter the groove again through the other end cap. Good for high speed and large leads (DN up to ≈ 150 000 – 200 000)." },
  tube: { n: "Return tube (option)", circuits: 2, turns: 2.5, DN: 70000,
    how: "A bent steel tube on the outside of the nut picks the balls up with a tongue and returns them over several turns. Simple, cheap, many balls per circuit; bigger nut envelope, noisier, DN ≈ 50 000 – 70 000." },
};
export const DN_LIMIT = [
  ["Standard tube / deflector nut", "50 000 – 70 000"],
  ["High-speed deflector nut", "100 000 – 130 000"],
  ["End-cap / high-speed nut (large lead)", "130 000 – 200 000"],
];

/* nut preload methods + classes */
export const PRELOAD_BS = {
  methods: [
    ["Ball oversize (single nut, 4-point contact)", "balls 2 – 6 µm bigger than the groove space → each ball touches 4 points", "P1 – P2 (2 – 5 % Ca)", "compact, short; higher friction per ball, lower max preload"],
    ["Double nut + spacer (2-point, O-type)", "a spacer pushes the two nuts apart (tension preload) – or pulls them together", "P2 – P3 (5 – 10 % Ca)", "highest rigidity, adjustable by spacer grinding; longer, heavier nut"],
    ["Offset lead (single nut)", "the nut thread has a lead shift of δ (e.g. +0.02 mm) in the middle", "P1 – P2", "short like oversize but 2-point contact; must be ground into the nut"],
  ],
  classes: [["P0", "0 (small clearance ≤ 0.01 mm allowed)", "transfer, C7 rolled screws"], ["P1", "2 – 5 % Ca", "machine tools light, robots, C5"], ["P2", "5 – 8 % Ca", "machine tools (double nut)"], ["P3", "8 – 10 % Ca", "heavy machining, high rigidity"]],
  lossFactor: 2.83,  // preload of one half disappears when the axial load F > 2.83 · Fpr
};

/* ISO 3408-3 / JIS B 1192-3 – positioning screws (example table values as printed in catalogues – check the standard) */
export const ACC_BS = {
  bins: [315, 400, 500, 630, 800, 1000, 1250, 1600, 2000],   // useful travel l_u "up to" (mm)
  ep: { C1: [6, 7, 8, 9, 10, 11, 13, 15, 18], C3: [12, 13, 15, 16, 18, 21, 24, 29, 35], C5: [23, 25, 27, 30, 35, 40, 46, 54, 65] },   // ± travel deviation e_p (µm)
  vup: { C1: [5, 5, 5, 6, 7, 8, 8, 10, 11], C3: [8, 10, 10, 12, 13, 15, 16, 18, 21], C5: [18, 20, 20, 23, 25, 27, 30, 35, 40] },     // travel variation v_up (µm)
  v300: { C0: 3.5, C1: 5, C2: 6, C3: 8, C5: 18, C7: 50, C8: 100, C10: 210 },    // variation in any 300 mm (µm)
  v2pi: { C0: 3, C1: 4, C2: 4, C3: 6, C5: 8 },                                   // variation in one revolution (µm)
  use: [["C0 – C1", "jig borers, measuring machines, ultra-precision"], ["C3", "precision machine tools, grinding"], ["C5", "CNC machining centres, lathes (with linear scales or pitch compensation)"], ["C7", "rolled screws – handling, packaging, robots"], ["C10", "simple transport"]],
  ourLu: 700,        // useful travel of BS-3210 (850 thread − 100 nut − 2 × 25 run-out) → bin 630 – 800: C5 e_p 35 µm, v_up 25 µm
};

/* ------------------------------------------------------------------ end supports (fixed side + floating side) */
export const SUPPORT = {
  fixed: { name: "Fixed side support unit (FK25 / BK25 class)", brg: "angular-contact thrust pair 25 × 62 × 15, 60°, DB / DF arrangement (e.g. NSK 25TAC62B, SKF BSA 205, Schaeffler 7602025)", Kb: 750, Tb: 0.2, locknut: "precision lock nut M25 × 1.5" },
  float: { name: "Floating side support unit (FF20 / BF20 class)", brg: "deep-groove ball bearing 6004 (20 × 42 × 12), axially free", },
  coupling: { name: "Bellows / disc coupling", J: 1.0e-4, T: "≥ 25 N·m rated, torsionally stiff (≥ 10 000 N·m/rad)" },
  // buckling factor η2 (THK style, safety 0.5 included) and critical-speed factor λ2·10⁷ (0.8 included) per mounting
  mounts: {
    ff: { n: "fixed – fixed", eta2: 20.0, nc: 21.9, lam: 4.730, euler: 4 },
    fs: { n: "fixed – supported", eta2: 10.0, nc: 15.1, lam: 3.927, euler: 2 },
    ss: { n: "supported – supported", eta2: 5.0, nc: 9.7, lam: Math.PI, euler: 1 },
    fr: { n: "fixed – free", eta2: 1.3, nc: 3.4, lam: 1.875, euler: 0.25 },
  },
};

/* ------------------------------------------------------------------ linear guide rail LG-25-1000 */
export const LG = {
  code: "LG-25-1000", name: "Profiled rail size 25, 1 000 mm, ball type, 4 raceways 45° (O-arrangement)",
  size: 25, W: 23, H: 22, L: 1000, pitch: 60, E: 20,   // E = distance first hole – rail end
  bolt: "M6 × 30, 12.9, ISO 4762 (counterbore Ø11 × 9)", torque: 13.7,
  raceways: 4, alphaDeg: 45, arrangement: "O (back-to-back)",
  material: "C55 (1.0535, S55C class) cold-drawn profile, or 100Cr6 for small sizes",
  hardness: "raceways induction hardened 58 – 62 HRC, case 1.5 – 2.5 mm, base soft for drilling",
  straightness: "after straightening ≤ 0.1 mm / m free, bolted down follows the machine bed",
  massPerM: 3.2,
  accuracy: "N (normal), H (high), P (precision), SP, UP – see ACC_LG",
};

/* carriage (block) LB-25-FL */
export const LB = {
  code: "LB-25-FL", name: "Flange carriage size 25, 4-row recirculating balls, preload Z1",
  Wb: 70, Lb: 84, Lsteel: 58, Hasm: 36, H1: 5.5,     // block width, length (incl. end caps), steel body length, assembly height, rail-bottom → block-bottom gap
  holes: "4 × M8 on 57 × 45", Dw: 4.763, rows: 4, ballsPerRow: 30,
  C: 34900, C0: 52800, M0R: 640, M0P: 470, M0Y: 470,  // N, N·m (C for 50 km)
  C100: 27700,       // same block rated for 100 km (C50 / 2^(1/3)) – Bosch Rexroth / NSK style
  preload: "Z1", K: { Z0: 380, Z1: 520, Z2: 760 },     // radial rigidity per block, N/µm (example)
  sealDrag: 10,      // N per block (end + bottom seals, greased)
  material: "20CrMo4 / SCM420 class case hardened, or 100Cr6 (SUJ2) through hardened",
  hardness: "raceways 58 – 62 HRC",
  parts: "steel body, 2 end caps (POM / PA), 2 end seals, 2 bottom seals, retainer wires / strips, ball return pipes, grease nipple M6 × 0.75",
  mass: 0.6,
};

export const PRELOAD_LG = [
  ["Z0", "0 (very light / small clearance)", "≈ 0", "transfer, light loads, smooth motion"],
  ["Z1", "light preload", "≈ 0.02 C", "general machines, small vibration (our default)"],
  ["Z2", "medium preload", "≈ 0.08 C", "machine tools, high rigidity, impact loads"],
];
// running parallelism of the block to the rail datum vs rail length (µm) – example, HIWIN / THK style
export const ACC_LG = {
  len: [100, 200, 300, 500, 700, 900, 1100, 1500, 1900, 2500, 3100, 3600, 4000],
  par: { N: [12, 14, 15, 17, 20, 22, 24, 26, 28, 31, 33, 36, 37], H: [7, 9, 10, 12, 13, 15, 16, 18, 20, 22, 25, 27, 28], P: [3, 4, 5, 6, 7, 8, 9, 11, 13, 15, 18, 20, 21], SP: [2, 2, 3, 3, 4, 5, 6, 7, 8, 10, 11, 14, 15], UP: [2, 2, 2, 2, 2, 3, 3, 4, 4, 5, 6, 7, 7] },
  // size 25: height H and width tolerance, variation between blocks (mm)
  cls: [["N", "± 0.1", "± 0.1", "0.02", "0.03"], ["H", "± 0.04", "± 0.04", "0.015", "0.015"], ["P", "0 / − 0.04", "0 / − 0.04", "0.007", "0.007"], ["SP", "0 / − 0.02", "0 / − 0.02", "0.005", "0.005"], ["UP", "0 / − 0.01", "0 / − 0.01", "0.003", "0.003"]],
};
// permissible mounting errors (size 25 example): P1 rail parallelism (µm), S1 = K1·a (level of the 2 rails over spacing a), S2 = K2·b (blocks along the rail)
export const MOUNT_LG = { P1: { Z0: 30, Z1: 20, Z2: 15 }, K1: { Z0: 2.2e-4, Z1: 1.7e-4, Z2: 1.2e-4 }, K2: 4.2e-5,
  shoulder: { rail: 5, block: 6, r: 1.0 }, flat: "mounting surface flatness ≈ 5 – 10 µm / 500 mm for H / P class (example)" };

/* ------------------------------------------------------------------ materials + heat treatment (summary) */
export const MAT = [
  ["Screw shaft", "50CrMo4 / CF53 (Cr-Mo or carbon steel, 0.45 – 0.55 % C)", "QT core 250 – 300 HB → induction hardening of the thread zone 58 – 62 HRC, tempering 160 – 180 °C, (sub-zero optional) → stress-relief, straightening", "case 2 – 3 mm, journals soft"],
  ["Nut", "20MnCr5 / 20CrMo4 (case hardening) or 100Cr6", "carburize 920 °C → quench → temper 160 °C → 58 – 62 HRC (Eht 0.8 – 1.2 mm); 100Cr6: through-harden 840 °C / oil, temper 160 °C", "low distortion, grind after hardening"],
  ["Balls", "100Cr6 (AISI 52100, SUJ2)", "through hardened 62 – 66 HRC, ISO 3290 grade G5 – G10 (sphericity ≤ 0.13 / 0.25 µm)", "sorted in 1 µm size steps for preload"],
  ["Rail", "C55 / S55C cold-drawn profile (100Cr6 for small sizes)", "induction hardening of the raceway shoulders 58 – 62 HRC, case 1.5 – 2.5 mm; straighten; grind raceways + datum", "base soft for the bolt holes"],
  ["Carriage body", "20CrMo4 / SCM420 case hardening, or 100Cr6", "carburize + harden 58 – 62 HRC; grind the 4 raceways in one set-up", "flange holes drilled before hardening"],
  ["Deflector / end cap / return pipe", "POM, PA66-GF, sintered steel (MIM) for high-load deflectors", "injection moulding / MIM, no heat treatment (MIM: sinter + harden)", "smooth ball path, no edge"],
  ["Seals", "NBR / TPU lip + steel plate, POM labyrinth, felt scrapers", "bought parts", "replaceable"],
];

/* ------------------------------------------------------------------ parts lists per product (feeds item 2 manufacturing + item 7 ERP BOM)
 * row: [pos, part, qty, make/buy, material, heat treatment / finish, note (main operations for item 2)] */
export const BOM = {
  "BS-3210-1000-C5": [
    ["10", "Screw shaft blank Ø36 × 1 010 mm", 1, "BUY (bar) → MAKE", "50CrMo4 +QT round bar, peeled", "QT 250 – 300 HB as delivered", "saw, face + centre, rough turn, stress relief"],
    ["20", "Screw shaft (finished)", 1, "MAKE", "50CrMo4", "induction harden thread zone 58 – 62 HRC, temper", "turn journals, harden, straighten, grind OD, thread grinding (C5), grind journals, lap"],
    ["30", "Lock nut M25 × 1.5 (precision)", 1, "BUY", "steel, with locking screw", "–", "normally supplied with the support unit"],
    ["40", "Key 6 × 6 × 20 (motor journal)", 1, "BUY", "C45 key steel", "–", "DIN 6885 A"],
    ["50", "Rust protection + VCI packing tube", 1, "BUY", "oil + plastic tube", "–", "ship horizontal, supported every 300 mm"],
  ],
  "BN-3210-FL": [
    ["10", "Nut body with flange", 1, "MAKE", "20MnCr5 bar Ø85", "carburize, harden, temper 58 – 62 HRC", "turn, drill flange, mill flat + deflector pockets, harden, grind bore + OD + flange face, internal thread grinding"],
    ["20", "Balls Ø6.35 (1/4\")", 60, "BUY", "100Cr6", "62 – 66 HRC, ISO 3290 G5", "sorted size class for preload P1 (oversize)"],
    ["30", "Deflector (internal return)", 4, "BUY", "sintered steel MIM / POM", "MIM: harden", "pressed / glued into the pockets"],
    ["40", "Wiper seal", 2, "BUY", "NBR / TPU + holder", "–", "snap ring retained"],
    ["50", "Snap ring for seal", 2, "BUY", "spring steel", "–", "DIN 472"],
    ["60", "Grease nipple M6 / plug", 1, "BUY", "steel zinc plated", "–", "DIN 71412"],
    ["70", "Grease (initial fill)", 1, "BUY", "lithium-complex NLGI 2 (e.g. Klüber Isoflex NBU 15 class)", "–", "≈ 3 – 4 cm³"],
    ["80", "Spacer (double-nut version BN-3210-FLD only)", 1, "MAKE", "100Cr6 / C45", "harden 58 HRC (or QT)", "grind width to the preload (± 1 µm)"],
  ],
  "LG-25-1000": [
    ["10", "Rail profile bar (cold drawn) 25", 1, "BUY → MAKE", "C55 profile from a specialist mill", "as drawn", "cut to 1 000 + allowance"],
    ["20", "Rail (finished)", 1, "MAKE", "C55", "induction harden raceways 58 – 62 HRC", "straighten, drill + counterbore 17 holes (pitch 60, E 20), harden, straighten, grind datum + 4 raceways, cut ends, mark datum"],
    ["30", "Rail hole caps Ø11", 17, "BUY", "POM (or brass for coolant areas)", "–", "flush with the rail top"],
    ["40", "Rust protection + packing", 1, "BUY", "oil + VCI film + wood profile", "–", "mark datum side + rail no. for matched pairs"],
  ],
  "LB-25-FL": [
    ["10", "Carriage steel body", 1, "MAKE", "20CrMo4 / 100Cr6", "carburize / harden 58 – 62 HRC", "mill, drill + tap M8, bore return holes, harden, grind base + reference side + 4 raceways"],
    ["20", "Balls Ø4.763 (3/16\")", 120, "BUY", "100Cr6", "ISO 3290 G10, size-matched", "4 rows × 30 (example)"],
    ["30", "End cap with return path", 2, "BUY", "POM / PA66 injection moulded", "–", "screwed, aligned to the body"],
    ["40", "Return pipe / insert", 4, "BUY", "POM", "–", "in the return holes"],
    ["50", "End seal (double lip + steel plate)", 2, "BUY", "NBR + steel", "–", "outside the end caps"],
    ["60", "Bottom seal strip", 2, "BUY", "NBR", "–", "under the body"],
    ["70", "Ball retainer (wire / strip)", 4, "BUY", "steel wire / POM", "–", "keeps balls in when the block leaves the rail"],
    ["80", "Grease nipple M6 × 0.75", 1, "BUY", "steel", "–", "on one end cap"],
    ["90", "Screws for end caps M2.5 / M3", 4, "BUY", "steel", "–", "ISO 7380"],
    ["100", "Dummy rail (shipping)", 1, "BUY", "PE / ABS", "–", "keep the block on it until mounting"],
  ],
};

/* ------------------------------------------------------------------ product family (MES / ERP) */
// ball screw sizes: [d0, Ph, Dw, circuits×turns, Ca kN, C0a kN] – catalogue-class examples
export const FAMILY_BS = [
  [16, 5, 3.175, "3 × 1", 7.6, 13.5], [16, 10, 3.175, "2 × 1", 5.6, 9.0],
  [20, 5, 3.175, "4 × 1", 10.5, 21.0], [20, 10, 3.969, "3 × 1", 11.0, 20.0], [20, 20, 3.969, "2 × 1.5", 7.5, 13.0],
  [25, 5, 3.175, "4 × 1", 12.0, 27.0], [25, 10, 4.762, "3 × 1", 17.0, 33.0], [25, 20, 4.762, "2 × 1.5", 11.0, 20.0],
  [32, 5, 3.175, "5 × 1", 16.0, 40.0], [32, 10, 6.35, "4 × 1", 38.0, 76.0], [32, 20, 6.35, "2 × 1.5", 23.0, 43.0],
  [40, 5, 3.175, "5 × 1", 18.0, 50.0], [40, 10, 6.35, "4 × 1", 44.0, 100.0], [40, 20, 6.35, "3 × 1", 33.0, 68.0],
];
// guide sizes: [size, rail W, rail H, block W (flange), C kN, C0 kN, M0R, M0P, M0Y kN·m, ball Ø]
export const FAMILY_LG = [
  [15, 15, 15, 47, 14.7, 23.5, 0.17, 0.15, 0.15, 3.175],
  [20, 20, 17.5, 63, 27.1, 36.7, 0.39, 0.29, 0.29, 3.969],
  [25, 23, 22, 70, 34.9, 52.8, 0.64, 0.47, 0.47, 4.763],
  [30, 28, 26, 90, 48.5, 71.9, 1.06, 0.83, 0.83, 5.556],
  [35, 34, 29, 100, 64.6, 93.6, 1.69, 1.14, 1.14, 6.35],
];
export const FAMILY = {
  bs: { d: [16, 20, 25, 32, 40], Ph: [5, 10, 20], len: [300, 2000], grades: ["C3", "C5", "C7"] },
  lg: { size: [15, 20, 25, 30, 35], len: [300, 4000], blocks: ["FL (flange)", "NA (narrow)"], preload: ["Z0", "Z1", "Z2"], cls: ["N", "H", "P"] },
};
// code builders (item 6 MES / item 7 ERP use them for item numbers)
export const codeBS = (d, Ph, L, g) => `BS-${d}${String(Ph).padStart(2, "0")}-${L}-${g}`;
export const codeBN = (d, Ph, t = "FL") => `BN-${d}${String(Ph).padStart(2, "0")}-${t}`;
export const codeLG = (s, L) => `LG-${s}-${L}`;
export const codeLB = (s, t = "FL") => `LB-${s}-${t}`;
export const PRODUCTS = [
  { code: BS.code, kind: "screw", name: BS.name, uom: "pc", make: true },
  { code: BN.code, kind: "nut", name: BN.name, uom: "pc", make: true },
  { code: LG.code, kind: "rail", name: LG.name, uom: "pc", make: true },
  { code: LB.code, kind: "block", name: LB.name, uom: "pc", make: true },
];

/* ------------------------------------------------------------------ click info for the 3D parts (function, material, hardness, tolerance, how made, how it fails) */
export const PARTS = {
  shaft: { n: "Screw shaft (BS-3210)", fn: "Turns the motor rotation into linear motion: one turn = one lead (10 mm). Carries the axial load through the balls into the fixed bearing.", mat: "50CrMo4 / CF53", hrd: "thread 58 – 62 HRC (induction), core 250 – 300 HB", tol: "C5: e_p ± 35 µm over 700 mm, v_300 18 µm, journal run-out ≤ 8 µm, journals h5 / h6", made: "QT bar → turn → induction harden → straighten → thread grinding (single-rib wheel) → journal grinding", fail: "flaking (fatigue) of the raceway after L10, indentation by chips (brinelling), wear by contamination → lost preload, bending by crash" },
  nut: { n: "Ball nut body (BN-3210-FL)", fn: "Carries the balls and transfers the axial force to the table via the flange. Holds the return system, seals and lubrication.", mat: "20MnCr5 / 20CrMo4 case hardened (or 100Cr6)", hrd: "58 – 62 HRC, case 0.8 – 1.2 mm", tol: "flange face run-out to the axis ≤ 10 µm, OD g6, profile + lead of the inner thread matched to the shaft", made: "turn → drill flange + pockets → carburize + harden → grind OD, face, bore → internal thread grinding → assemble balls + deflectors", fail: "flaking in the nut track, deflector break (overspeed, crash), seal wear → dirt inside, preload loss" },
  flange: { n: "Flange (DIN 69051-5 form B style)", fn: "Bolts the nut to the table / bracket. Flat side gives clearance; centring diameter D1 g6.", mat: "integral with the nut body", hrd: "soft core (not hardened in the bolt area)", tol: "face run-out ≤ 10 µm, bolt circle 65 ± 0.1", made: "turned + drilled with the nut body", fail: "loose bolts → fretting, misalignment → edge load on balls" },
  balls: { n: "Balls Ø6.35 (ISO 3290 G5)", fn: "Rolling elements between screw and nut. 4 circuits × 15 balls. Oversize balls give the preload.", mat: "100Cr6 (52100, SUJ2)", hrd: "62 – 66 HRC", tol: "G5: sphericity 0.13 µm, lot diameter variation 0.25 µm, size sorted in 1 µm steps", made: "cold heading → flashing → soft grinding → hardening → hard grinding → lapping → 100 % inspection", fail: "flaking, skidding marks (lubrication), breakage by overload, wear → preload drop" },
  deflector: { n: "Internal deflector", fn: "Lifts each ball over the land of the screw at the end of one turn and puts it back into the previous groove. 1 deflector per circuit.", mat: "sintered steel (MIM) or POM / PA (light loads)", hrd: "MIM ≈ 40 – 55 HRC", tol: "ball path step-free (≤ 0.02 mm), position in the nut ± 0.01 mm", made: "metal injection moulding / plastic injection, pressed or glued into a pocket", fail: "break or wear by overspeed (DN too high), crash, missing lubrication → ball jam" },
  endcap: { n: "End cap (return option)", fn: "At each nut end it picks the ball up tangentially and guides it into the axial return hole of the nut body.", mat: "POM / PA66 or sintered steel", hrd: "–", tol: "step-free transition to the groove", made: "injection moulded, screwed to the nut ends", fail: "wear at high speed, crack by ball impact" },
  tube: { n: "Return tube (option)", fn: "Bent tube outside the nut; a tongue lifts the balls out of the groove and returns them 2.5 turns back.", mat: "steel tube, tongue hardened", hrd: "–", tol: "tongue position ± 0.05 mm", made: "bent + flattened tube, clamped with a bridge plate", fail: "tongue breaks at high speed / crash, noise, balls drop out when the tube is damaged" },
  ret: { n: "Ball return path", fn: "Path where the balls are NOT loaded – they are pushed back to the start of the loaded zone.", mat: "deflector / end cap / tube", hrd: "–", tol: "smooth, ball clearance ≈ 0.1 – 0.2 mm", made: "see the return part", fail: "jam → stick-slip, noise, sudden lock" },
  seal: { n: "Wiper seal", fn: "Keeps chips and coolant out and grease in. Follows the thread profile.", mat: "NBR / TPU lip, POM labyrinth (contact-free, lower friction)", hrd: "–", tol: "lip interference ≈ 0.1 – 0.3 mm", made: "moulded, in a holder ring, snap ring", fail: "wear, hardening by coolant, lip turned over → dirt inside → wear" },
  spacer: { n: "Spacer (double-nut preload)", fn: "Pushes the two half-nuts apart (O / tension preload) so the balls of one nut touch the left and the other the right flanks: no backlash.", mat: "100Cr6 / C45", hrd: "58 HRC or QT", tol: "width ground to ± 1 µm for the preload, faces parallel ≤ 2 µm", made: "turn → harden → grind → measure preload torque", fail: "settling → preload loss, wrong width → too hot / backlash" },
  fixed: { n: "Fixed support (angular-contact pair)", fn: "Takes ALL axial load in both directions plus radial load. Sets the axial position of the screw.", mat: "bearing steel 100Cr6, housing EN-GJL-250 / C45", hrd: "bearing 60 – 64 HRC", tol: "ISO P4 / P5 bearings, housing bore H6, lock nut face run-out ≤ 3 µm", made: "bought support unit (FK25 / BK25 class) or own housing + bearing pair", fail: "fretting if the lock nut is loose, overheating by too much preload, brinelling by crash" },
  locknut: { n: "Precision lock nut", fn: "Clamps the bearing pair to the journal with the right preload (tightening torque).", mat: "steel with locking pins / set screws", hrd: "–", tol: "face run-out ≤ 3 µm", made: "bought", fail: "loosening → axial play (lost motion)" },
  float: { n: "Floating support (deep-groove bearing)", fn: "Carries radial load only; lets the shaft grow with temperature.", mat: "bearing 100Cr6, housing", hrd: "–", tol: "bore J6, snap ring DIN 471", made: "bought support unit FF20 / BF20 class", fail: "if mounted axially fixed → thermal stress, buckling, noise" },
  coupling: { n: "Bellows / disc coupling", fn: "Connects motor and screw torsionally stiff, but allows small misalignment.", mat: "stainless bellows, aluminium hubs", hrd: "–", tol: "misalignment ≤ 0.1 mm lateral, ≤ 1° angular (example)", made: "bought (R+W, KTR, Mayr class)", fail: "fatigue crack of the bellows when misaligned, slipping clamp hub" },
  motor: { n: "AC servo motor", fn: "Gives torque and speed; its encoder closes the position loop (semi-closed loop) unless a linear scale is used.", mat: "–", hrd: "–", tol: "flange + shaft per IEC / maker", made: "bought", fail: "overheating (RMS torque too high), encoder fault, brake wear (vertical axes)" },
  base: { n: "Machine base (example)", fn: "Holds both supports in line with the guides.", mat: "EN-GJL-300 / welded steel", hrd: "–", tol: "support bores in line ≤ 0.01 mm, parallel to the guides ≤ 0.01 mm / 500 mm", made: "machined in one set-up", fail: "misalignment → nut side load, short life" },
  // linear guide
  rail: { n: "Rail LG-25-1000", fn: "Fixed track with 4 hardened raceways. Datum side (marked) is pushed against the bed shoulder.", mat: "C55 / S55C", hrd: "raceways 58 – 62 HRC (induction)", tol: "class H: running parallelism 13 µm at 700 mm, height ± 0.04 mm", made: "cold-drawn profile → drill → induction harden → straighten → grind datum + raceways", fail: "flaking under the most loaded block, false brinelling (vibration at standstill), corrosion by coolant" },
  block: { n: "Carriage body LB-25-FL", fn: "Carries the table. 4 loaded ball rows at 45° take load in all 4 directions and moments.", mat: "20CrMo4 / 100Cr6", hrd: "58 – 62 HRC", tol: "height variation between blocks ≤ 15 µm (class H)", made: "mill + drill → harden → grind 4 raceways in one set-up", fail: "flaking, raceway wear, crack by crash" },
  gballs: { n: "Balls Ø4.763 (G10)", fn: "4 rows × 30. Loaded under the steel body, unloaded in the return holes and end caps.", mat: "100Cr6", hrd: "62 – 66 HRC", tol: "ISO 3290 G10, matched size", made: "ball mill", fail: "flaking, skidding, wear without grease" },
  gcap: { n: "End cap (block)", fn: "Turns the balls round (180°) from the loaded track to the return hole. Holds the grease channels.", mat: "POM / PA66", hrd: "–", tol: "step-free to the raceway", made: "injection moulded", fail: "crack by crash, wear at > 3 – 5 m/s" },
  gseal: { n: "End seal + bottom seal", fn: "Wipes the rail; double lip keeps grease in and dirt out. Bottom seals close the gap under the block.", mat: "NBR + steel plate", hrd: "–", tol: "lip follows the rail profile", made: "bought / moulded", fail: "wear → chips in the raceway → indentations" },
  retainer: { n: "Ball retainer", fn: "Keeps the balls in the block when it is pulled off the rail.", mat: "steel wire / POM strip", hrd: "–", tol: "–", made: "bent wire / moulded", fail: "bent → balls fall out during mounting" },
  nipple: { n: "Grease nipple M6 × 0.75", fn: "Re-lubrication point (or connection of the central lubrication line).", mat: "steel", hrd: "–", tol: "–", made: "bought", fail: "blocked → dry running" },
  gret: { n: "Return path (block)", fn: "Unloaded balls run back through a hole in the steel body (with a plastic pipe).", mat: "POM pipe", hrd: "–", tol: "ball clearance ≈ 0.2 mm", made: "drilled + insert", fail: "jam → high friction" },
  rollers: { n: "Rollers (roller guide option)", fn: "Line contact instead of point contact: ≈ 2× rigidity, higher load rating, for heavy machine tools.", mat: "100Cr6", hrd: "62 – 66 HRC", tol: "crowned roller, length matched", made: "roller mill", fail: "skew, edge load if the mounting is not flat" },
};

/* ------------------------------------------------------------------ catalogue card (makeCard) */
export const CARD1 = {
  guides: "guide 40",
  drawings: [
    { sec: "Ball screw + nut", f: "40_ballscrew_assembly_section.svg", t: "Ball screw assembly – section", c: "Motor, coupling, fixed support (angular-contact pair, lock nut), screw Ø32 × 10, flanged nut with seals, floating support; main sizes and part list.", g: "guide 40 §5" },
    { sec: "Ball screw + nut", f: "40_thread_profile_gothic_arch.svg", t: "Thread profile – gothic arch", c: "Ball Ø6.35 in the shaft and nut grooves, 2 arcs r = 0.53·Dw, offset e, contact angle 45°, d0 / dpw / dr, 4-point vs 2-point contact.", g: "guide 40 §6" },
    { sec: "Ball screw + nut", f: "40_recirculation_types.svg", t: "Ball return systems", c: "Internal deflector (1 turn per circuit), end cap (axial return hole), return tube – paths, pros and cons, DN limits.", g: "guide 40 §5.3" },
    { sec: "Ball screw + nut", f: "40_nut_preload_methods.svg", t: "Nut preload methods", c: "Ball oversize (4-point), double nut with spacer (O-type), offset lead; preload – deflection diagram and the 2.83 · Fpr limit.", g: "guide 40 §9" },
    { sec: "Ball screw + nut", f: "40_end_support_arrangements.svg", t: "End support arrangements", c: "Fixed–free, supported–supported, fixed–supported, fixed–fixed with buckling factor η2 and critical-speed factor λ.", g: "guide 40 §8" },
    { sec: "Ball screw + nut", f: "40_ballscrew_accuracy_grades.svg", t: "Accuracy grades ISO 3408-3", c: "Travel deviation e_p and variation v_up against useful travel for C1 / C3 / C5, v_300 for C7 / C10, how to read the lead chart.", g: "guide 40 §10" },
    { sec: "Linear guide", f: "40_linear_guide_section.svg", t: "Linear guide – rail + carriage section", c: "Size 25 rail 23 × 22 with 4 raceways, flange block 70 × 36, 4 ball rows at 45°, return holes, seals, main sizes.", g: "guide 40 §12" },
    { sec: "Linear guide", f: "40_o_vs_x_arrangement.svg", t: "O- vs X-arrangement", c: "Contact lines, lever arm of the moment, rigidity against rolling moment vs tolerance to mounting errors.", g: "guide 40 §12.3" },
    { sec: "Linear guide", f: "40_carriage_exploded.svg", t: "Carriage – exploded view", c: "Steel body, ball rows, retainer, return pipes, end caps, end seals, bottom seals, grease nipple, screws.", g: "guide 40 §12.2" },
    { sec: "Linear guide", f: "40_load_directions_moments.svg", t: "Load directions + moments", c: "Radial, reverse radial, lateral loads and M_R / M_P / M_Y; equivalent load P = |F_r| + |F_l| + C0·ΣM/M0.", g: "guide 40 §13" },
    { sec: "Linear guide", f: "40_guide_accuracy_parallelism.svg", t: "Guide accuracy classes", c: "Running parallelism vs rail length for N / H / P / SP / UP; height and width tolerances size 25.", g: "guide 40 §14" },
    { sec: "Linear guide", f: "40_mounting_tolerances.svg", t: "Mounting tolerances", c: "Rail parallelism P1, level S1 = K1·a, S2 = K2·b, shoulder heights and corner radii, datum sides.", g: "guide 40 §16" },
    { sec: "Selection", f: "40_selection_axis_example.svg", t: "Selection example – HMC X axis", c: "600 kg table, 30 m/min, 3 m/s², 4 kN cutting force: screw Ø32 × 10 fixed–supported, 2 rails size 25 × 2 blocks, loads and results.", g: "guide 40 §17" },
  ],
  groups: [
    { id: "bs", t: "Ground ball screws + nuts (complete)", src: "guide 40 §21.1", rows: [
      ["Ground ball screw Ø32 × 10, C5, flanged nut, preload", "d0 32, Ph 10, Dw 6.35, Ca ≥ 35 kN, DN ≥ 100 000, DIN 69051 flange", "THK BIF / BNFN 3210 (precision ground)", "Ca ≈ 33 – 38 kN (check)", "≈ 600 – 1 200 € per 1 m set", "Ca / C0a, nut rigidity, preload torque, DN, lead chart (e_p, v_300), end machining drawing"],
      ["Same", "same", "HIWIN FSI / FSV 32-10 (ground, internal recirculation)", "ground C3 / C5, internal return (check)", "≈ 400 – 900 €", "same"],
      ["Same", "same", "NSK ZFT / PFT 3210 (precision ground)", "check catalogue", "≈ 600 – 1 200 €", "same; NSK S1 seal + K1 lube unit option"],
      ["Same", "same", "Bosch Rexroth FEM-E-S 32×10 (precision ball screw assembly)", "DIN 69051 flange single nut (check)", "≈ 600 – 1 200 €", "same; Rexroth calculation tool"],
      ["Same", "same", "Schaeffler INA KGT / KGM 32×10 (check type)", "check catalogue", "ask for a quote", "same"],
      ["Same", "same", "PMI FSDC / FSIC 32-10 (check)", "ground, internal return", "≈ 400 – 900 €", "same"],
      ["Same", "same", "Kuroda Precision (ground ball screws, check type)", "C3 / C5", "ask for a quote", "same"],
      ["Same", "same", "Steinmeyer 1000 series (check)", "precision ground, DIN flange", "ask for a quote", "same"],
      ["Same", "same", "SKF / Ewellix precision ground ball screws (check brand)", "check catalogue", "ask for a quote", "same"],
      ["Rolled ball screw Ø32 × 10, C7 (cheaper option)", "C7 / v_300 50 µm, light preload", "HIWIN R32-10 / THK BTK / PMI rolled", "C7, Ca ≈ 20 – 30 kN (check)", "≈ 150 – 300 €", "lead accuracy, straightness, nut type"],
    ] },
    { id: "lg", t: "Profiled linear guides size 25 (ball type)", src: "guide 40 §21.2", rows: [
      ["Rail size 25 + flange block, Z1, class H", "C ≥ 30 kN (50 km), C0 ≥ 45 kN, 4 rows 45°, rail 23 × 22, pitch 60", "HIWIN HGR25 + HGW25CC", "C ≈ 34.9 kN, C0 ≈ 52.8 kN (check)", "≈ 150 – 300 € per 1 m rail + 2 blocks", "C (50 or 100 km basis!), C0, M0R/M0P/M0Y, rigidity, accuracy class table, mounting tolerances P1/S1"],
      ["Same", "same", "THK SHS25 / HSR25 (check type)", "check catalogue", "≈ 200 – 400 €", "same"],
      ["Same", "same", "NSK NH25 / LH25 (check)", "check catalogue (100 km basis?)", "≈ 200 – 400 €", "same"],
      ["Same", "same", "Bosch Rexroth ball rail system size 25 (R1651-…)", "C for 100 km (check)", "≈ 200 – 400 €", "same"],
      ["Same", "same", "Schaeffler INA KUVE25-B (check)", "check catalogue", "ask for a quote", "same"],
      ["Same", "same", "PMI MSA25 (check)", "check catalogue", "≈ 150 – 300 €", "same"],
      ["Same", "same", "SKF / Ewellix LLT size 25 (check brand)", "check catalogue", "ask for a quote", "same"],
      ["Roller guide size 25 (heavy option)", "C ≥ 50 kN, rigidity ≈ 2× ball type", "HIWIN RG25 / THK SRG25 / Rexroth roller rail / Schaeffler RUE25", "check catalogue", "≈ 300 – 600 €", "rigidity, mounting flatness needs"],
    ] },
    { id: "ball", t: "Precision balls (ISO 3290 / DIN 5401)", src: "guide 40 §21.3", rows: [
      ["Balls Ø6.35 G5, 100Cr6, size-sorted", "G5, sorting 1 µm, lot certificate", "Tsubaki Nakashima (incl. former Hoover Precision)", "G3 – G10, 52100", "≈ 30 – 80 € per 1 000 (check)", "grade, size class, hardness, lot traceability"],
      ["Same", "same", "AKS (Amatsuji Steel Ball)", "G3 – G10", "ask for a quote", "same"],
      ["Same", "same", "Hartford Technologies / ITI (check)", "check", "ask for a quote", "same"],
      ["Balls Ø4.763 G10 for blocks", "G10, matched lots", "Tsubaki Nakashima · AKS", "check", "≈ 15 – 40 € per 1 000", "same"],
    ] },
    { id: "seal", t: "Seals, wipers, deflectors, end caps", src: "guide 40 §21.4", rows: [
      ["Ball nut wiper seal Ø32 × 10", "profile seal, NBR / TPU, fits the lead", "From the ball screw maker (THK / HIWIN / NSK …)", "matched to the profile", "≈ 5 – 20 € each", "profile, drag torque, coolant resistance"],
      ["Rail wiper / double seal / scraper", "size 25", "From the guide maker (HIWIN DD / ZZ / KK, THK UU / SS / LaCS)", "check", "≈ 5 – 30 € per block set", "drag force, coolant type"],
      ["Elastomer seals – custom", "NBR / FKM / TPU", "Freudenberg (Simrit) · Trelleborg · SKF seals", "check", "ask for a quote", "material vs coolant, temperature"],
      ["Deflectors / end caps (own nut design)", "MIM steel / POM", "MIM and injection-moulding suppliers (local)", "tool needed", "tool 5 000 – 20 000 €, parts < 1 €", "step-free path, tolerances"],
    ] },
    { id: "lube", t: "Grease + lubrication", src: "guide 40 §21.5", rows: [
      ["Ball screw + guide grease", "lithium-complex / urea, NLGI 2, base oil ≈ 100 cSt", "Klüber Isoflex NBU 15 / Microlube GBU Y 131 (check)", "speed factor high", "≈ 20 – 60 € per kg", "compatibility with the maker's initial grease"],
      ["Same", "same", "THK AFB-LF / AFA · NSK AS2 / LR3 (maker greases)", "check", "≈ 30 – 80 € per 400 g", "same"],
      ["Central lubrication (oil / fluid grease)", "piston distributors, 0.03 – 0.1 cm³ / shot", "SKF Lincoln · Bijur Delimon · Lubricant pumps (local)", "check", "≈ 500 – 2 000 € per machine", "interval, distributor size per block / nut"],
    ] },
    { id: "brg", t: "Support bearings + support units + couplings", src: "guide 40 §21.6", rows: [
      ["Angular-contact thrust pair 25 × 62 × 15, 60°", "ISO P4, DB / DF, preload L / M", "NSK 25TAC62B (check)", "axial rigidity ≈ 750 N/µm pair (check)", "≈ 150 – 300 € pair", "rigidity, preload, limiting speed, lock nut torque"],
      ["Same", "same", "SKF BSA 205 C / BSD 2562 (check)", "check", "≈ 150 – 300 €", "same"],
      ["Same", "same", "Schaeffler INA 7602025-2RS / ZKLN 2557 (check)", "check", "≈ 100 – 250 €", "same"],
      ["Support units fixed / floating for Ø32 screw", "fixed FK25 / BK25, floating FF20 / BF20", "THK FK/FF · HIWIN BK/BF · NSK WBK (check)", "check", "≈ 150 – 300 € per pair", "shaft end drawing, lock nut, bearing class"],
      ["Bellows / disc coupling ≥ 25 N·m", "torsionally stiff, clamping hubs Ø20", "R+W BK2 / BKL · KTR Radex-NC · Mayr ROBA-DS (check)", "check", "≈ 80 – 250 €", "torsional stiffness, misalignment, inertia"],
    ] },
  ],
  shopTab: "Shopping list (prototype)", shopLbl: "prototype",
  ph: "(e.g. HIWIN, balls, seal)",
  price: "Prices are rough estimates 2026 – ask for a quote.",
  shopTitle: "First prototype run: 5 ball screw sets (BS-3210 + BN-3210-FL) and 5 guide sets (LG-25-1000 + 2 × LB-25-FL) made in-house, plus 2 bought benchmark sets per product – guide 40 §22.",
  shopNote: "Machines, heat treatment and measuring equipment are bought in items 2 and 5 – this list is material and purchased components only.",
  shops: [
    { title: "Material + bought components", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (estimate – ask for a quote)"], m: 4, p: 5, rows: [
      ["1", "2 × 6 m", "Round bar 50CrMo4 +QT Ø36, peeled", "for 5 shafts + set-up parts", "local steel stock holder (EN 10083-3)", "≈ 300 – 500 €"],
      ["2", "1 × 3 m", "Round bar 20MnCr5 Ø85 (nut bodies)", "5 nuts + trials", "local steel stock holder", "≈ 300 – 500 €"],
      ["3", "2 000", "Balls Ø6.35 G5 100Cr6, 3 size classes", "oversize sorting for P1", "Tsubaki Nakashima · AKS", "≈ 100 – 250 €"],
      ["4", "40", "Deflectors (prototype MIM / machined)", "4 per nut + spares", "MIM supplier / own CNC", "≈ 200 – 800 €"],
      ["5", "15", "Wiper seals Ø32 × 10", "2 per nut + spares", "screw maker spare part", "≈ 100 – 300 €"],
      ["6", "2 × 4 m", "Rail profile size 25, cold drawn C55", "5 rails + trials", "profile mill (ask the guide maker for the source)", "≈ 300 – 700 €"],
      ["7", "1 × 2 m", "Block blank bar 20CrMo4 / flat 75 × 40", "10 blocks + trials", "local steel stock holder", "≈ 150 – 300 €"],
      ["8", "2 000", "Balls Ø4.763 G10", "10 blocks × 120 + spares", "Tsubaki Nakashima · AKS", "≈ 50 – 120 €"],
      ["9", "25 sets", "End caps, end seals, bottom seals, retainers, nipples size 25", "bought as spare-part sets", "guide maker spare parts", "≈ 300 – 800 €"],
      ["10", "5 + 5", "Support units FK25 + FF20 class", "for the test stand + 4 kits", "THK · HIWIN · NSK", "≈ 750 – 1 500 €"],
      ["11", "2 kg", "Grease NLGI 2 lithium-complex", "initial fill", "Klüber · maker grease", "≈ 60 – 150 €"],
      ["12", "2", "Benchmark ground ball screw Ø32 × 10 C5 1 m", "to measure and compare (item 5)", "THK · HIWIN · NSK · Rexroth", "≈ 1 200 – 2 400 €"],
      ["13", "2", "Benchmark guide size 25, 1 m + 2 blocks", "same", "HIWIN · THK · Rexroth · Schaeffler", "≈ 300 – 800 €"],
      ["14", "1", "Bellows coupling + servo motor ≈ 1.5 kW (test stand)", "run-in and noise test", "R+W + any servo maker", "≈ 1 000 – 2 000 €"],
    ] },
  ],
};

/* standards register (short; the guide has the full table) */
export const STDS = [
  ["ISO 3408-1 … 5", "Ball screws: vocabulary, nominal sizes, acceptance (accuracy), axial rigidity, load ratings + life"],
  ["JIS B 1192-1 … 6", "Ball screws (Japanese; C0 … C10 grades used by THK / NSK / HIWIN)"],
  ["DIN 69051-1 … 6", "Ball screws (German; part 5: flange nut dimensions, form B)"],
  ["ISO 12090-1 / -2", "Rolling bearings – profiled rail guides for linear motion: boundary dimensions and tolerances (part 1 series 1 – 3, part 2 series 4 – 5) – check edition"],
  ["ISO 14728-1 / -2", "Linear motion rolling bearings: dynamic + static load ratings"],
  ["ISO 3290-1", "Rolling bearing balls – steel balls (grades G3 … G200); DIN 5401 old German version"],
  ["ISO 281", "Rolling bearings – dynamic load rating and rating life (idea L10 = (C/P)^p)"],
  ["ISO 76", "Rolling bearings – static load ratings (idea of C0, 4 200 MPa contact stress)"],
  ["ISO 230-2", "Test code for machine tools – positioning accuracy (the whole axis)"],
  ["ISO 683-17 / EN ISO 683-3", "Steels for rolling bearings / case-hardening steels"],
];
