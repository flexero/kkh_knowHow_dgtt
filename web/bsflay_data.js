/* Ball screw + guide factory – item 3 "Factory layout + live 3D digital twin" – LAYOUT DATA (shared by bsflay*.js and bsfsim.js).
 * Guide: docs/42_bsf_layout_digital_twin.md
 *
 *   import { HALL, ZONES, ZONE_OF, PLACE, DOORS, LANES, CHARGERS, RACKS, COLS, ADJ, LOT, flowMatrix, doorDist, CARD3 } from "./bsflay_data.js";
 *
 * Coordinates: metres, x = along the hall (west → east, 0 … 80), y = across the hall (south → north, 0 … 48), origin = south-west
 * inside corner of the production hall. The annex (offices + utilities) is y 48 … 56. 3D: X = x, Y = up, Z = −y.
 * PLACE[id] = [cx, cy, rot, face]: centre of the machine footprint, rot 0 = footprint length (MTYPES foot[0]) along x,
 * rot 90 = along y; face = side where the operator / the WIP rack is ("S" | "N" | "E" | "W").
 * EVERY VALUE IS AN EXAMPLE – check with your factory planner, the machine makers' installation drawings and the local codes.
 */
import { MTYPES, MACHINES, ROUTES, ROUTE_KEYS, PLANT, opsOf } from "./bsfmfg_data.js";

export const NOTE3 = "Example layout + simulation values – check with your factory planner, the machine makers and the local codes.";

/* ------------------------------------------------------------------ hall */
export const HALL = {
  L: 80, W: 48, annex: 8, h: 9.0,           // production hall 80 × 48 m (3 840 m²), clear height 9 m under the crane girder; annex 80 × 8 m (2 floors over the office part)
  colX: 10, colY: 24,                        // column grid 10 m × 24 m (two 24 m spans, steel frame)
  aisle: [0, 24, 80, 28],                    // main AGV aisle (4 m wide, two lanes + 1 m walkway)
  lanes: { east: 25.0, west: 27.0 },         // AGV lane centre lines (one-way each)
  craneHT: "5 t bridge crane over the heat-treatment bay (furnace baskets, coils, quench-oil service)",
  craneGrind: "no crane in the grinding room (stable climate) – machines placed by mobile crane / air skates through a 5 × 4.5 m door",
};

/* ------------------------------------------------------------------ zones (rect = [x0, y0, x1, y1]) */
export const ZONES = {
  RAW:   { n: "Goods-in + raw-material store", s: "Raw store", rect: [0, 28, 12, 48], climate: "hall 15 – 30 °C", c: "#8a6d3b", t: "bars Ø36 / Ø85 (cantilever racks), rail + block profiles, bought parts (balls, seals, end caps), incoming check; truck dock in the west wall" },
  SAW:   { n: "Saw + straighten + centre cell", s: "Saw cell", rect: [12, 28, 24, 48], climate: "hall", c: "#6b6b6b", t: "bandsaw, cold saw, soft straightening presses, facing + centring – noisy + vibrating, kept away from the grinders" },
  SOFT:  { n: "Soft machining (turning, milling, drilling)", s: "Soft machining", rect: [24, 28, 52, 48], climate: "hall", c: "#1f6fd1", t: "CNC lathes, turning centres, VMCs, rail drilling centre, 5 HMCs with tombstones; emulsion central system, chip conveyors" },
  HT:    { n: "Heat treatment + hard straightening (walled)", s: "Heat treatment", rect: [52, 28, 80, 48], climate: "hot zone, exhaust", c: "#c0392b", t: "2 sealed-quench carburising lines, induction (shafts + rails), tempering, CNC straightening presses; fire wall, exhaust hoods, 5 t crane, oil-tight floor" },
  AISLE: { n: "Main AGV aisle (4 m)", s: "Main aisle", rect: [0, 24, 80, 28], climate: "hall", c: "#d4a017", t: "2 one-way AGV lanes + walkway, all hand-over points (doors) lie on it" },
  GRIND: { n: "Grinding room 20 ± 1 °C", s: "Grinding room", rect: [0, 0, 42, 24], climate: "20 ± 1 °C (thread grinders 20 ± 0.5 °C)", c: "#2e9e57", t: "8 thread grinders on isolated foundations, cylindrical, internal thread, profile, surface + raceway grinders; airlock, soak buffer ≥ 4 h" },
  METRO: { n: "Measurement room 20 ± 0.5 °C", s: "Measurement room", rect: [42, 0, 54, 14], climate: "20 ± 0.5 °C, no sun", c: "#8e44ad", t: "3 laser lead measuring machines, rail measuring bench, laboratory (hardness, metallography, roundness, contour, CMM)" },
  PLANT: { n: "Grinding HVAC + oil plant room", s: "Plant room", rect: [42, 14, 54, 24], climate: "technical", c: "#7f8c8d", t: "air-handling units for the grinding + measurement rooms, central grinding-oil filtration ≤ 5 µm + chillers, CO₂ fire protection" },
  ASSY:  { n: "Wash + assembly + run-in (20 – 24 °C, clean)", s: "Assembly", rect: [54, 0, 70, 24], climate: "20 – 24 °C, clean", c: "#d35400", t: "washer + demagnetiser, nut + block assembly, preload matching, screw assembly + torque test, run-in stands, laser marker, component supermarket" },
  PACK:  { n: "Packing + finished-goods store + shipping", s: "Packing + FG", rect: [70, 0, 80, 24], climate: "hall", c: "#555555", t: "packing stations (VCI, tubes, boxes, labels), finished-goods racks, truck dock in the east wall" },
  OFFICE:{ n: "Offices + MES / server room (2 floors)", s: "Offices + MES", rect: [0, 48, 16, 56], climate: "office", c: "#34495e", t: "production office, planning, quality office, MES / twin server room with UPS, Ethernet core switch", annex: true },
  AIR:   { n: "Compressed-air station", s: "Compressed air", rect: [16, 48, 28, 56], climate: "technical", c: "#7f8c8d", t: "2 + 1 screw compressors, dryer, 2 × 3 m³ receivers, heat recovery", annex: true },
  COOL:  { n: "Coolant central system + chip handling", s: "Coolant + chips", rect: [28, 48, 44, 56], climate: "technical", c: "#7f8c8d", t: "emulsion central filtration (soft machining), chip conveyor end, briquetting press, chip containers", annex: true },
  ELEC:  { n: "Transformer + main LV switchboard", s: "Electrics", rect: [44, 48, 56, 56], climate: "technical", c: "#7f8c8d", t: "1 600 kVA transformer (example), main LV board, power-factor correction, energy meters (Modbus TCP)", annex: true },
  HTU:   { n: "Heat-treatment utilities", s: "HT utilities", rect: [56, 48, 80, 56], climate: "technical", c: "#7f8c8d", t: "endogas generator / N₂-methanol, propane, quench-oil cooler, polymer tank, closed cooling tower, exhaust fans", annex: true },
};
export const ZONE_KEYS = Object.keys(ZONES);
export const PROD_ZONES = ["RAW", "SAW", "SOFT", "HT", "GRIND", "METRO", "ASSY", "PACK"];

/* machine type → zone (layout areas are finer than MTYPES[...].area of item 2) */
export const ZONE_OF = {
  "MS-SAW": "SAW", "BS-STR": "SAW", "BS-CTR": "SAW", "LG-SAW": "SAW", "LG-STR": "SAW",
  "BS-TRN": "SOFT", "BN-TRN": "SOFT", "BN-MC": "SOFT", "LG-DRL": "SOFT", "LB-MC": "SOFT", "BS-ROL": "SOFT",
  "BS-IND": "HT", "HT-TMP": "HT", "HT-CAR": "HT", "LG-IND": "HT", "BS-STH": "HT", "LG-STH": "HT",
  "BS-CLP": "GRIND", "BS-CGR": "GRIND", "BS-TGR": "GRIND", "BN-HTN": "GRIND", "BN-ITG": "GRIND", "LG-SGR": "GRIND", "LG-PGR": "GRIND",
  "LG-CUT": "GRIND", "LB-SGR": "GRIND", "LB-RGR": "GRIND", "BS-WHL": "GRIND",
  "QC-LED": "METRO", "QC-RAL": "METRO", "QC-LAB": "METRO", "QC-INC": "RAW",
  "AS-WSH": "ASSY", "AS-NAS": "ASSY", "AS-BAS": "ASSY", "QC-MAT": "ASSY", "AS-BSA": "ASSY", "AS-RUN": "ASSY", "AS-GAS": "ASSY", "AS-MRK": "ASSY",
  "AS-PCK": "PACK",
};

/* machine placement [cx, cy, rot, face] – every MACHINES id of the default design point (73) */
export const PLACE = {
  // saw cell
  "MS-SAW-01": [15.5, 45.5, 0, "S"], "BS-STR-01": [21, 45.5, 0, "S"], "BS-CTR-01": [21, 41.5, 0, "S"],
  "LG-SAW-01": [16, 36, 0, "S"], "LG-STR-01": [16, 31.5, 0, "S"],
  // soft machining: 5 HMCs (row 1, long side across), lathes (row 2, face the cell aisle), VMCs + rail drill (row 3, face the main aisle)
  "LB-MC-01": [27, 44, 90, "S"], "LB-MC-02": [32.5, 44, 90, "S"], "LB-MC-03": [38, 44, 90, "S"], "LB-MC-04": [43.5, 44, 90, "S"], "LB-MC-05": [49, 44, 90, "S"],
  "BS-TRN-01": [27.25, 36.1, 0, "N"], "BS-TRN-02": [33.15, 36.1, 0, "N"], "BN-TRN-01": [38.7, 36.1, 0, "N"], "BN-TRN-02": [43.9, 36.1, 0, "N"], "BN-TRN-03": [49.1, 36.1, 0, "N"],
  "BN-MC-01": [26.5, 30.75, 0, "S"], "BN-MC-02": [30.5, 30.75, 0, "S"], "BN-MC-03": [34.5, 30.75, 0, "S"], "LG-DRL-01": [41.5, 30.75, 0, "S"],
  // heat treatment
  "HT-CAR-01": [60.5, 44, 0, "S"], "HT-CAR-02": [60.5, 36.25, 0, "S"], "LG-IND-01": [58.5, 30.25, 0, "S"],
  "BS-IND-01": [71, 45.5, 0, "S"], "HT-TMP-01": [76.5, 45.5, 0, "S"], "BS-STH-01": [71.25, 41, 0, "S"], "BS-STH-02": [76.5, 41, 0, "S"],
  "LG-STH-01": [74, 31, 0, "S"], "LG-STH-02": [74, 35.5, 0, "S"],
  // grinding room: row S = 8 thread grinders + 2 cylindrical grinders on isolated foundations (long side across), row M = rail line, row N = nut + block grinders
  "BS-TGR-01": [2.4, 3.55, 90, "N"], "BS-TGR-02": [6.4, 3.55, 90, "N"], "BS-TGR-03": [10.4, 3.55, 90, "N"], "BS-TGR-04": [14.4, 3.55, 90, "N"],
  "BS-TGR-05": [18.4, 3.55, 90, "N"], "BS-TGR-06": [22.4, 3.55, 90, "N"], "BS-TGR-07": [26.4, 3.55, 90, "N"], "BS-TGR-08": [30.4, 3.55, 90, "N"],
  "BS-CGR-01": [34.4, 3.05, 90, "N"], "BS-CGR-02": [38.4, 3.05, 90, "N"],
  "LG-SGR-01": [4.2, 11.6, 0, "S"], "LG-PGR-01": [14.7, 11.6, 0, "S"], "LG-PGR-02": [28.2, 11.6, 0, "S"], "LG-CUT-01": [38.2, 11.6, 0, "S"],
  "LB-RGR-01": [4.2, 18.1, 0, "S"], "LB-RGR-02": [11.4, 18.1, 0, "S"], "LB-SGR-01": [17.6, 18.1, 0, "S"], "BN-HTN-01": [22.3, 18.1, 0, "S"],
  "BN-HTN-02": [26.5, 18.1, 0, "S"], "BN-ITG-01": [31.2, 18.1, 0, "S"], "BN-ITG-02": [36.4, 18.1, 0, "S"], "BS-CLP-01": [40.2, 18.1, 0, "S"],
  // measurement room
  "QC-LAB-01": [49.5, 3.75, 0, "N"], "QC-LED-01": [44.6, 9.2, 0, "N"], "QC-LED-02": [49.0, 9.2, 0, "N"], "QC-LED-03": [44.6, 12.2, 0, "S"], "QC-RAL-01": [50.0, 12.2, 0, "S"],
  // raw store
  "QC-INC-01": [9.5, 33, 0, "S"],
  // assembly
  "AS-WSH-01": [58.5, 21.4, 0, "S"], "AS-MRK-01": [66.5, 21.4, 0, "S"],
  "AS-NAS-01": [56, 17.4, 0, "S"], "AS-NAS-02": [59, 17.4, 0, "S"], "AS-BSA-01": [62.75, 17.4, 0, "S"], "AS-BSA-02": [67.25, 17.4, 0, "S"],
  "AS-BSA-03": [56.75, 13.4, 0, "S"], "AS-RUN-01": [61, 13.4, 0, "S"], "AS-RUN-02": [65, 13.4, 0, "S"],
  "AS-BAS-01": [56, 9.2, 0, "S"], "AS-BAS-02": [59, 9.2, 0, "S"], "AS-BAS-03": [62, 9.2, 0, "S"], "QC-MAT-01": [65, 9.2, 0, "S"], "QC-MAT-02": [68, 9.2, 0, "S"],
  "AS-GAS-01": [57.5, 5.2, 0, "S"],
  // packing
  "AS-PCK-01": [73, 19.5, 0, "W"], "AS-PCK-02": [73, 15.5, 0, "W"],
};

/* footprint rectangle of a placed machine [x0, y0, x1, y1] */
export function footRect(id, type) {
  const p = PLACE[id], T = MTYPES[type || id.slice(0, -3)]; if (!p || !T) return null;
  const [l, w] = T.foot, [a, b] = p[2] === 90 ? [w, l] : [l, w];
  return [p[0] - a / 2, p[1] - b / 2, p[0] + a / 2, p[1] + b / 2];
}

/* hand-over points (AGV pick / drop) on the main aisle edge; GRIND = airlock door */
export const DOORS = {
  RAW: [6, 28], SAW: [18, 28], SOFT: [38, 28], HT: [56, 28], GRIND: [38.5, 24], ASSY: [58, 24], PACK: [74, 24],
  METRO: [48, 14], // reached through the grinding room / assembly (internal doors) – no AGV stop; listed for the drawings
};
export const LANES = HALL.lanes;
export const CHARGERS = [[1.6, 25.0], [1.6, 27.0], [4.0, 25.0], [4.0, 27.0]];       // AGV charging bays at the west end of the main aisle
/* zones that share a wall + door: transfer by hand cart, no AGV (minutes, metres) */
export const ADJ = { "GRIND|METRO": [5, 12], "METRO|ASSY": [5, 12], "ASSY|PACK": [4, 10] };
export const adjKey = (a, b) => (ADJ[a + "|" + b] ? a + "|" + b : ADJ[b + "|" + a] ? b + "|" + a : null);

/* racks / stores / fixed objects [x0, y0, x1, y1, height, label, kind] */
export const RACKS = [
  [1, 45, 8.5, 47.5, 2.6, "Cantilever rack – bars Ø36 + Ø85 (6 m)", "raw"],
  [1, 40, 8.5, 42.5, 2.6, "Cantilever rack – rail + block profiles (4 m / 3 m)", "raw"],
  [1, 34.5, 6, 36.5, 2.2, "Shelves – bought parts (balls, seals, end caps)", "kit"],
  [24, 21.2, 34, 23.2, 1.8, "Soak buffer ≥ 4 h (shafts + rails)", "soak"],
  [36, 20.6, 41, 23.8, 2.8, "Airlock (parts + people)", "lock"],
  [62, 2.5, 69, 6.5, 2.0, "Component supermarket (screws, nuts, rails, blocks)", "sm"],
  [77, 4, 79.5, 22, 3.5, "FG rack A (screw sets, wooden boxes)", "fg"],
  [71, 4, 75, 10, 3.0, "FG rack B (guide sets)", "fg"],
  [43, 15, 47, 23, 2.8, "Air-handling units (grinding + measurement)", "ahu"],
  [48, 15, 53, 19, 2.2, "Grinding-oil central filtration + chillers", "oil"],
  [48, 20, 53, 23, 2.0, "CO₂ fire protection + oil tanks", "oil"],
  [46, 29, 51, 33, 1.4, "Chip bins + tool presetting", "aux"],
  [64, 29, 69, 33, 1.2, "HT buffer (rails after hardening)", "aux"],
];
export const COLS = (() => { const c = []; for (let x = 0; x <= HALL.L; x += HALL.colX) for (const y of [0, 24, 48]) c.push([x, y]); return c; })();
/* room walls (closed rooms): [x0, y0, x1, y1, height, label] */
export const WALLS = [
  [0, 0, 42, 24, 4.0, "Grinding room"], [42, 0, 54, 14, 3.5, "Measurement room"], [42, 14, 54, 24, 3.5, "Plant room"], [52, 28, 80, 48, 6.0, "Heat treatment"],
];

/* transfer lot (pieces per AGV load / per work-order lot) – example */
export const LOT = { BS: 20, BN: 40, LG: 50, LB: 100, FABS: 20, FALG: 50 };
export const AGV = { n: 2, v: 1.0, tLoad: 45, tUnload: 45, tDoor: 30, battH: 8, chargeRate: 40, lowSoc: 25, okSoc: 90 };   // m/s, s, s, s (doors / traffic), h of driving, %/h, %

/* ------------------------------------------------------------------ distances + from–to analysis */
export function doorDist(a, b) {
  const A = DOORS[a], B = DOORS[b]; if (!A || !B) return 0;
  const lane = B[0] >= A[0] ? LANES.east : LANES.west;
  return Math.abs(A[1] - lane) + Math.abs(B[0] - A[0]) + Math.abs(B[1] - lane);
}
const yieldFrom = (ops, i) => ops.slice(i).reduce((y, o) => y * (1 - o.scrap / 100), 1);
/** zone sequence of a route incl. start (RAW for parts, supermarket = ASSY for assembly) and end (supermarket ASSY for parts, PACK for sets) */
export function routeZones(r, variant = "G") {
  const ops = opsOf(r, variant).filter((o) => !o.buy);
  const start = r === "FABS" || r === "FALG" ? "ASSY" : "RAW", end = r === "FABS" || r === "FALG" ? "PACK" : "ASSY";
  return { ops, zones: [start, ...ops.map((o) => ZONE_OF[o.m]), end] };
}
/** flowMatrix({ qty, variant, lot, avg }) (avg = fractional lots, else whole lots of one daily order) → { zones, lots (per route per day), m (lots/day from→to), pcs, agvTrips, manual, rows, dist (m/day) } */
export function flowMatrix(o = {}) {
  const qty = { ...PLANT.qty, ...(o.qty || {}) }, variant = o.variant || "G", lot = { ...LOT, ...(o.lot || {}) };
  const Z = PROD_ZONES, idx = Object.fromEntries(Z.map((z, i) => [z, i]));
  const m = Z.map(() => Z.map(() => 0)), pcs = Z.map(() => Z.map(() => 0));
  const per = {}; let agvTrips = 0, manual = 0, dist = 0;
  for (const r of ROUTE_KEYS) {
    const { ops, zones } = routeZones(r, variant);
    const start = qty[ROUTES[r].qtyKey] / yieldFrom(ops, 0), lots = o.avg ? start / lot[r] : Math.ceil(start / lot[r] - 1e-9);   // one order per product per day → whole lots
    let legs = 0, man = 0, dm = 0;
    for (let k = 0; k + 1 < zones.length; k++) {
      const a = zones[k], b = zones[k + 1]; if (a === b) continue;
      m[idx[a]][idx[b]] += lots; pcs[idx[a]][idx[b]] += start;
      if (adjKey(a, b)) man++; else { legs++; dm += doorDist(a, b); }
    }
    per[r] = { start, lots, legs, man, dm, zones };
    agvTrips += lots * legs; manual += lots * man; dist += lots * dm;
  }
  return { zones: Z, per, m, pcs, agvTrips, manual, dist };
}
/** AGV fleet sizing: t per trip = d/v + load + unload + doors; empty drive ≈ factor × loaded */
export function fleetSize(F = flowMatrix(), o = {}) {
  const v = o.v ?? AGV.v, hours = o.hours ?? (PLANT.shifts * PLANT.hShift), util = o.util ?? 0.7, empty = o.empty ?? 0.8;
  const avgD = F.dist / Math.max(1e-9, F.agvTrips);
  const tTrip = (avgD * (1 + empty)) / v + AGV.tLoad + AGV.tUnload + AGV.tDoor;   // s
  const busyH = F.agvTrips * tTrip / 3600;
  return { avgD, tTrip, busyH, hours, util, need: busyH / (hours * util), n: Math.max(1, Math.ceil(busyH / (hours * util) - 1e-9)), mDay: F.dist * (1 + empty) };
}
/** area table per production zone: zone m², machine m², factor */
export function areaTable() {
  const rows = PROD_ZONES.concat(["PLANT"]).map((z) => {
    const r = ZONES[z].rect, A = (r[2] - r[0]) * (r[3] - r[1]);
    const ms = MACHINES.filter((m) => ZONE_OF[m.type] === z), Am = ms.reduce((s, m) => s + m.foot[0] * m.foot[1], 0);
    return { z, n: ZONES[z].n, A, Am, k: ms.length, f: Am > 0 ? A / Am : 0, w: r[2] - r[0], d: r[3] - r[1] };
  });
  const Am = MACHINES.reduce((s, m) => s + m.foot[0] * m.foot[1], 0);
  return { rows, Am, Am72: Am - MACHINES.filter((m) => MTYPES[m.type].lab).reduce((s, m) => s + m.foot[0] * m.foot[1], 0), hall: HALL.L * HALL.W, annex: HALL.L * HALL.annex };
}
/** geometry check: every machine placed, inside its zone, no overlap (min gap g metres) */
export function layoutCheck(g = 0.5) {
  const errs = [], R = MACHINES.map((m) => ({ id: m.id, z: ZONE_OF[m.type], r: footRect(m.id, m.type) }));
  for (const a of R) {
    if (!a.r) { errs.push(a.id + " not placed"); continue; }
    const zr = ZONES[a.z].rect;
    if (a.r[0] < zr[0] + 0.3 || a.r[1] < zr[1] + 0.3 || a.r[2] > zr[2] - 0.3 || a.r[3] > zr[3] - 0.3) errs.push(a.id + " outside " + a.z);
  }
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i].r, b = R[j].r; if (!a || !b) continue;
    if (a[0] < b[2] + g && b[0] < a[2] + g && a[1] < b[3] + g && b[1] < a[3] + g) errs.push(R[i].id + " × " + R[j].id);
  }
  return errs;
}

/* ------------------------------------------------------------------ catalogue card (makeCard) */
const PR = "estimate – ask for a quote";
export const CARD3 = {
  guides: "guide 42", shopTab: "Shopping list (plant + twin)", shopLbl: "plant + twin", ph: "(e.g. AGV, Knoll, Bilz, rack, HVAC)",
  buyNote: "Prices are rough estimates 2026 (" + PR + "); makers marked (check) – confirm that they offer this product for this use. No external links – offline.",
  drawings: [
    { sec: "Layout", f: "42_block_layout.svg", t: "Block layout – 80 × 48 m hall + annex", c: "Zones with sizes: raw store, saw cell, soft machining, heat treatment (walled), grinding room 20 ± 1 °C, measurement room 20 ± 0.5 °C, plant room, assembly, packing + FG, main AGV aisle, annex with offices + utilities.", g: "guide 42 §6" },
    { sec: "Layout", f: "42_detailed_layout.svg", t: "Detailed layout with machine ids", c: "All 73 machine instances of item 2 placed with their footprint, aisles 3 – 4 m, doors, racks, columns 10 × 24 m.", g: "guide 42 §7" },
    { sec: "Layout", f: "42_area_calculation.svg", t: "Area calculation per zone", c: "Machine footprint vs zone area, space factor per zone (target 2.5 – 3), hall size 80 × 48 m justified from 931 m² machine footprint.", g: "guide 42 §5" },
    { sec: "Material flow", f: "42_from_to_matrix.svg", t: "From–to matrix (lots per day)", c: "Lots per day between the zones from the routings and the transfer lot sizes, AGV trips vs hand-cart moves, transport metres per day.", g: "guide 42 §8" },
    { sec: "Material flow", f: "42_material_flow_sankey.svg", t: "Material flow – Sankey style", c: "Pieces per day from raw store through soft machining, heat treatment, grinding, measurement to assembly and FG; band width = pieces per day.", g: "guide 42 §8" },
    { sec: "Material flow", f: "42_agv_routes.svg", t: "AGV routes, doors and charging", c: "Two one-way lanes in the 4 m main aisle, 7 hand-over points, 4 charging bays, fleet sizing 2 AGVs (example).", g: "guide 42 §12" },
    { sec: "Special rooms", f: "42_grinding_room_hvac.svg", t: "Grinding room HVAC 20 ± 1 °C", c: "Heat loads (machines, people, lights, walls), air-handling unit, displacement air outlets, return air, oil chillers, ± 1 K control loop, airlock.", g: "guide 42 §9" },
    { sec: "Special rooms", f: "42_grinder_foundation.svg", t: "Isolated foundation for a thread grinder", c: "Reinforced concrete block on vibration isolators / mat in a pit, separation joint, mass ratio, natural frequency 5 – 8 Hz, VC criteria.", g: "guide 42 §10" },
    { sec: "Utilities", f: "42_utilities_single_line.svg", t: "Utilities – electrical single line + media", c: "1 600 kVA transformer, main LV board, sub-boards per zone with diversity factor, compressed air, coolant central systems, chip handling.", g: "guide 42 §11" },
    { sec: "Digital twin", f: "42_twin_data_flow.svg", t: "Twin data flow – Modbus TCP → gateway → HTTP", c: "Machines + PLCs (Modbus TCP, port 502) → gateway (polling 100 ms / 1 s / 10 s) → HTTP REST + SSE → twin, MES, ERP, browser. No MQTT, no OPC UA.", g: "guide 42 §14" },
    { sec: "Digital twin", f: "42_planning_method.svg", t: "Factory planning method", c: "Capacity → machines → areas → block layout → detailed layout → flow check → simulation (twin) → what-if → decision.", g: "guide 42 §4" },
    { sec: "Digital twin", f: "42_sim_states_oee.svg", t: "Machine states, OEE and Little's law", c: "State model OFF / IDLE / STARVED / SETUP / RUN / BLOCKED / DOWN, OEE = A × P × Q (ISO 22400 style), WIP = throughput × lead time.", g: "guide 42 §13" },
  ],
  groups: [
    { id: "agv", t: "AGVs / AMRs + fleet manager (HTTP API)", src: "guide 42 §16.1", rows: [
      ["Underride / pallet AGV 1 000 – 1 500 kg for long-part racks", "lot rack 1.2 × 0.8 m (screws, rails ≤ 1.1 m), lift 60 mm, natural or laser navigation, ± 10 mm stop", "KUKA (KMP series) (check)", "check", "≈ 60 – 120 k€ each (" + PR + ")", "fleet manager HTTP / REST API (VDA 5050 ideas over HTTP), stop accuracy, charging contacts, safety scanners PL d"],
      ["Same", "same", "Jungheinrich (AGV / ERC series) (check)", "check", "≈ 60 – 130 k€ each", "same; forklift-type AGV for pallets"],
      ["Same", "same", "DS Automotion (check)", "check", "≈ 70 – 140 k€ each", "same; custom long-load handling"],
      ["Same", "same", "Grenzebach (check)", "check", "≈ 60 – 120 k€ each", "same"],
      ["Same", "same", "MiR (Teradyne) MiR1350 / SAFELOG / Linde Robotics (check)", "check", "≈ 50 – 110 k€ each", "same"],
      ["Fleet manager / traffic control software", "orders over HTTP REST from the MES, traffic rules, doors + airlock interface", "from the AGV maker (check)", "check", "≈ 30 – 100 k€", "open HTTP API, door interface (Modbus TCP I/O), simulation of the layout"],
      ["Charging stations (contact / inductive)", "24 – 48 V, 100 – 300 A, floor contacts", "from the AGV maker · Wiferion (check)", "check", "≈ 5 – 15 k€ each", "opportunity charging, Modbus TCP status"],
      ["Rapid doors + airlock interlock for AGVs", "door opens on AGV request (Modbus TCP I/O)", "Efaflex · Hörmann · Novoferm (check)", "check", "≈ 8 – 25 k€ per door", "speed, insulation (grinding room), safety edge, I/O"],
    ] },
    { id: "rack", t: "Racks + stores", src: "guide 42 §16.2", rows: [
      ["Cantilever racks for bars + profiles", "6 m bars, arms 1 000 – 1 500 mm, 1 – 2 t per arm", "Kasto · OHRA · Mecalux · SSI Schäfer (check)", "check", "≈ 1 – 3 k€ per column (" + PR + ")", "arm load, height, forklift / crane access"],
      ["Automatic bar store (option)", "honeycomb store for bars, saw connection", "Kasto UNITOWER / UNICOMPACT (check)", "check", "≈ 300 – 800 k€", "cassettes, saw interface, WMS over HTTP"],
      ["Pallet racks for FG + kits", "1 000 kg / pallet place, 3 – 4 levels", "SSI Schäfer · Mecalux · Jungheinrich · Stow (check)", "check", "≈ 60 – 120 € per pallet place", "beam load, seismic class, protection"],
      ["Long-part lot racks (AGV load carriers)", "20 shafts / 50 rails, plastic-coated V-supports", "local steel builder (check)", "check", "≈ 0.8 – 2 k€ each", "AGV interface, stacking, no steel-steel contact"],
      ["Shelving for bought parts (balls, seals, end caps)", "bins, FIFO, ESD not needed", "Bito · SSI Schäfer · Kardex (vertical lift) (check)", "check", "≈ 5 – 60 k€", "FIFO, lot traceability label"],
    ] },
    { id: "hvac", t: "Air-conditioning for the grinding + measurement rooms", src: "guide 42 §16.3", rows: [
      ["Air-handling unit (AHU) for the grinding room ± 1 K", "≈ 130 – 150 kW cooling, ≈ 75 000 m³/h, displacement / textile outlets", "Weiss Klimatechnik (check) · Trox · Swegon · Systemair · Daikin Applied (check)", "check", "≈ 200 – 500 k€ incl. ducts (" + PR + ")", "± 1 K at all points, gradient ≤ 1 K/m, sensors + logging, redundancy"],
      ["Precision air-conditioning for the measurement room ± 0.5 K", "≈ 15 – 25 kW, laminar low velocity ≤ 0.2 m/s", "Weiss Klimatechnik (check) · Stulz · Vertiv (Liebert) (check)", "check", "≈ 60 – 150 k€", "± 0.5 K, humidity 45 ± 10 %, recovery after door opening"],
      ["Chiller + free cooling for the AHUs", "≈ 200 kW, glycol", "Carrier · Trane · Daikin · Clivet (check)", "check", "≈ 80 – 200 k€", "COP / SEER, free cooling hours, refrigerant"],
      ["Sandwich panel room (insulated walls + ceiling)", "PIR 100 mm, doors, airlock", "Kingspan · local clean-room builders (check)", "check", "≈ 80 – 160 €/m² wall", "U-value, airtightness, doors"],
    ] },
    { id: "cool", t: "Coolant + grinding oil central systems, chip handling", src: "guide 42 §16.4", rows: [
      ["Central grinding-oil filtration for the grinding room", "≈ 1 500 – 2 500 l/min, ≤ 5 µm (precoat / backflush), 20 ± 0.5 °C", "Knoll (check)", "check", "≈ 250 – 600 k€ (" + PR + ")", "flow per machine, filter fineness, chiller ± 0.5 K, CO₂ fire protection, mist"],
      ["Same", "same", "MAYFRAN (check)", "check", "≈ 250 – 600 k€", "same"],
      ["Same", "same", "LOSMA (check)", "check", "≈ 200 – 500 k€", "same"],
      ["Same", "same", "Filtration Group / Transor / Vomat (check)", "check", "≈ 200 – 500 k€", "same"],
      ["Emulsion central system for soft machining", "≈ 800 – 1 200 l/min, band filter + vacuum, 20 µm", "Knoll · MAYFRAN · LOSMA (check)", "check", "≈ 120 – 300 k€", "concentration control, skimmer, flow per machine"],
      ["Chip conveyors + briquetting press", "steel chips 1 – 2 t/day", "Knoll · MAYFRAN · RUF (briquetting) (check)", "check", "≈ 80 – 200 k€", "chip type, oil recovery, container logistics"],
      ["Oil mist extraction per machine", "electrostatic / mechanical, ≥ 99 %", "Absolent · Filtermist · Losma · Keller (check)", "check", "≈ 3 – 10 k€ per machine", "air flow, filter class, fire safety"],
    ] },
    { id: "air", t: "Compressed air", src: "guide 42 §16.5", rows: [
      ["Screw compressors 2 + 1 (speed controlled)", "≈ 2 × 30 kW, 8 bar, ≈ 2 × 5 m³/min", "Atlas Copco · Kaeser · Boge · Ingersoll Rand (check)", "check", "≈ 25 – 50 k€ each (" + PR + ")", "free air delivery, specific power kW/(m³/min), heat recovery, Modbus TCP"],
      ["Refrigeration dryer + filters (ISO 8573-1 class 1.4.1)", "dew point + 3 °C, oil ≤ 0.01 mg/m³", "same makers (check)", "check", "≈ 8 – 20 k€", "pressure dew point, pressure drop"],
      ["Air receivers + ring main", "2 × 3 m³, aluminium ring DN 50", "Transair (Parker) · Teseo · Infinity (check)", "check", "≈ 30 – 80 k€", "pressure drop ≤ 0.1 bar, leak tightness"],
    ] },
    { id: "floor", t: "Floor, foundations + vibration isolation", src: "guide 42 §16.6", rows: [
      ["Industrial floor slab", "250 mm reinforced / steel-fibre, flatness DIN 18202 / EN 15620 (AGV lanes)", "local contractor (check)", "check", "≈ 60 – 120 €/m² (" + PR + ")", "load per wheel, flatness for AGVs, joints, oil resistance (HT)"],
      ["Isolated foundation blocks for thread grinders", "concrete block ≈ 2 – 3 × machine mass, separation joint", "local contractor + design by the isolator maker (check)", "check", "≈ 15 – 40 k€ per machine", "machine maker's foundation drawing, soil report"],
      ["Vibration isolators / spring elements", "steel springs + viscous dampers, f0 ≈ 3 – 6 Hz", "Bilz (check) · GERB (check)", "check", "≈ 5 – 25 k€ per machine", "natural frequency, damping, levelling"],
      ["Elastomer isolation mats (PUR)", "Sylomer / Sylodyn under foundation blocks, f0 ≈ 8 – 12 Hz", "Getzner (check) · Regupol (check)", "check", "≈ 80 – 200 €/m²", "static load range, creep, natural frequency"],
      ["Levelling machine mounts", "for presses / lathes outside the grinding room", "Bilz · Nivell · Airloc (check)", "check", "≈ 50 – 300 € each", "load, isolation efficiency"],
    ] },
    { id: "twin", t: "Twin + communication hardware (Modbus TCP + HTTP only)", src: "guide 42 §16.7", rows: [
      ["Twin / MES server (on-premise)", "2 × server, RAID, UPS, Python stdlib service, HTTP + SSE", "Dell · HPE · Lenovo · Fujitsu (check)", "check", "≈ 8 – 20 k€ each (" + PR + ")", "redundancy, backup, no cloud needed"],
      ["Managed industrial Ethernet switches (machine VLAN)", "24 × 1 Gbit, ring / star, VLAN", "Siemens SCALANCE · Hirschmann (Belden) · Phoenix Contact · Moxa (check)", "check", "≈ 0.8 – 3 k€ each", "VLAN, port mirroring, diagnostics over HTTP / SNMP"],
      ["Modbus TCP energy meters per sub-board", "class 0.5S, kW / kWh / cos φ", "Janitza · Siemens SENTRON PAC · Schneider PM · Phoenix EEM (check)", "check", "≈ 0.4 – 1.5 k€ each", "Modbus TCP register map, CT ratio"],
      ["Modbus TCP I/O couplers for old machines", "status lamp + counter signals → Modbus TCP", "WAGO 750 · Phoenix Contact · Moxa ioLogik · Advantech ADAM (check)", "check", "≈ 0.3 – 1 k€ each", "inputs 24 V, counters, Modbus TCP unit id"],
      ["Large screens for the twin (andon)", "55 – 65 inch, browser kiosk", "any industrial display maker (check)", "check", "≈ 1 – 3 k€ each", "brightness, 24/7 rating"],
    ] },
  ],
  shopTitle: "Plant infrastructure + twin for the full design point (120 screw sets + 200 guide sets per day, 2 shifts) – guide 42 §17. Machines: see item 2 (bfCard2).",
  shopNote: "Prices are rough estimates 2026 – ask for a quote. Building shell, land, permits and the production machines of item 2 are not included.",
  shops: [
    { title: "Infrastructure + twin – full plant", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (" + PR + ")"], m: 4, p: 5, rows: [
      ["1", "1", "Industrial floor 3 840 m² + annex 640 m²", "250 mm, FF for AGV lanes, oil-tight in HT", "local contractor", "≈ 0.3 – 0.5 M€"],
      ["2", "10", "Isolated foundations (8 thread grinders + 2 cylindrical)", "block + isolators / mats", "Bilz · GERB · Getzner + contractor", "≈ 0.2 – 0.6 M€"],
      ["3", "1", "Grinding room 1 008 m² + measurement room 168 m² (panels, doors, airlock)", "PIR 100 mm, 2 rapid doors", "Kingspan + local builder", "≈ 0.25 – 0.45 M€"],
      ["4", "1", "HVAC grinding room (± 1 K) + measurement room (± 0.5 K) + chiller", "≈ 150 + 20 kW cooling", "Weiss · Trox · Stulz · Carrier", "≈ 0.4 – 0.9 M€"],
      ["5", "1", "Central grinding-oil filtration + chillers", "≈ 2 000 l/min, ≤ 5 µm", "Knoll · MAYFRAN · LOSMA", "≈ 0.25 – 0.6 M€"],
      ["6", "1", "Emulsion central system + chip conveyors + briquetting", "soft machining", "Knoll · MAYFRAN · LOSMA · RUF", "≈ 0.2 – 0.5 M€"],
      ["7", "1", "Compressed-air station 2 + 1 compressors, dryer, ring main", "8 bar, ≈ 10 m³/min", "Atlas Copco · Kaeser · Boge", "≈ 0.12 – 0.25 M€"],
      ["8", "1", "Transformer 1 600 kVA + main LV board + 11 sub-boards + energy meters", "diversity 0.4 – 0.7 per board", "Siemens · ABB · Schneider · Janitza", "≈ 0.35 – 0.7 M€"],
      ["9", "1", "HT utilities (gas supply, exhaust, quench-oil cooler, cooling tower)", "for 2 carburising lines + induction", "furnace maker + local", "≈ 0.3 – 0.8 M€"],
      ["10", "1", "5 t bridge crane over the HT bay", "span 28 m", "Demag · Konecranes · ABUS · Stahl", "≈ 60 – 120 k€"],
      ["11", "2 + 1", "AGVs (2 + 1 spare) + fleet manager + 4 charging bays", "1 000 – 1 500 kg, HTTP API", "KUKA · Jungheinrich · DS Automotion · Grenzebach", "≈ 0.25 – 0.5 M€"],
      ["12", "40", "Long-part lot racks (AGV load carriers)", "20 shafts / 50 rails", "local steel builder", "≈ 40 – 80 k€"],
      ["13", "1", "Cantilever racks + bought-part shelves + FG pallet racks + supermarket", "raw + FG", "Kasto · OHRA · SSI Schäfer · Mecalux", "≈ 80 – 200 k€"],
      ["14", "4", "Rapid doors (HT, grinding airlock × 2, assembly)", "AGV request via Modbus TCP I/O", "Efaflex · Hörmann", "≈ 40 – 100 k€"],
      ["15", "1", "Ethernet machine network (switches, fibre, 80 drops) + Modbus TCP I/O couplers", "VLAN, star", "Siemens · Hirschmann · Phoenix · WAGO", "≈ 80 – 180 k€"],
      ["16", "2", "Twin / MES servers + UPS + 6 andon screens", "on-premise, HTTP + SSE", "Dell · HPE · Lenovo", "≈ 40 – 90 k€"],
      ["17", "1", "Factory planning + simulation study (external)", "layout, flow, HVAC, foundations", "planning office", "≈ 50 – 150 k€"],
    ] },
  ],
};
