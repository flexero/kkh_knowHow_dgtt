/* Ball screw + guide factory – item 6 MES – SHARED MES DATA MODEL (item 6 owns it; item 7 ERP + item 8 PLC import it).
 * Guide: docs/45_bsf_mes.md.  The Python service twin/bsf_mes.py uses the SAME model (field names, states, ids, reason codes).
 *
 *   import { NOTE6, PRODUCTS6, prodInfo, LOT6, WO_STATES, LOT_STATES, OP_STATES, ENTITIES, REASONS, REASON_BY_CODE, alarmReason,
 *            ISA95, MESA11, ROLES, KANBAN, SERIAL6, gtinCheck, gs1Element, FAMILY_TYPES, MARK_OP, HEATS, GATEWAY6, API6,
 *            CHECK6, SAMPLE_WO } from "./bsfmes_data.js";
 *
 * Times: the MES core works in SECONDS of one clock domain (browser demo = twin time B.t, server = Unix time). Scheduling works in
 * MINUTES from "now" on a shift calendar (2 shifts × 7.5 h net from 06:00, heat treatment 3 shifts – like the twin, item 3).
 * EVERY VALUE IS AN EXAMPLE – check with your MES team, your machine makers and your own data.
 */
import { BS, BN, LG, LB, BOM } from "./bsfprod_data.js";
import { LOT } from "./bsflay_data.js";

export const NOTE6 = "Example MES data – check with your MES team, the machine makers and your own figures.";

/* ------------------------------------------------------------------ products the MES can make (family examples) */
// route = routing key of item 2 (web/bsfmfg_data.js ROUTES); fam = set-up family on the grinders; k = time factor for length / size (cycle × k)
export const PRODUCTS6 = [
  { code: BS.code, route: "BS", kind: "screw", fam: "Ø32×10", k: 1.0, n: "Ground ball screw Ø32 lead 10, 1 000 mm, C5 (reference)" },
  { code: "BS-2505-600-C7", route: "BS", kind: "screw", fam: "Ø25×5", k: 0.6, n: "Ball screw Ø25 lead 5, 600 mm, C7" },
  { code: "BS-3220-1200-C5", route: "BS", kind: "screw", fam: "Ø32×20", k: 1.2, n: "Ball screw Ø32 lead 20, 1 200 mm, C5" },
  { code: "BS-4010-1500-C5", route: "BS", kind: "screw", fam: "Ø40×10", k: 1.5, n: "Ball screw Ø40 lead 10, 1 500 mm, C5" },
  { code: BN.code, route: "BN", kind: "nut", fam: "Ø32×10", k: 1.0, n: "Flanged ball nut Ø32 lead 10 (reference)" },
  { code: "BN-2505-FL", route: "BN", kind: "nut", fam: "Ø25×5", k: 0.8, n: "Flanged ball nut Ø25 lead 5" },
  { code: "BN-3220-FL", route: "BN", kind: "nut", fam: "Ø32×20", k: 1.0, n: "Flanged ball nut Ø32 lead 20" },
  { code: "BN-4010-FL", route: "BN", kind: "nut", fam: "Ø40×10", k: 1.2, n: "Flanged ball nut Ø40 lead 10" },
  { code: LG.code, route: "LG", kind: "rail", fam: "size 25", k: 1.0, n: "Profiled rail size 25, 1 000 mm (reference)" },
  { code: "LG-20-800", route: "LG", kind: "rail", fam: "size 20", k: 0.8, n: "Profiled rail size 20, 800 mm" },
  { code: "LG-35-1500", route: "LG", kind: "rail", fam: "size 35", k: 1.5, n: "Profiled rail size 35, 1 500 mm" },
  { code: LB.code, route: "LB", kind: "carriage", fam: "size 25", k: 1.0, n: "Carriage size 25, flange (reference)" },
  { code: "LB-20-FL", route: "LB", kind: "carriage", fam: "size 20", k: 0.85, n: "Carriage size 20, flange" },
  { code: "LB-35-FL", route: "LB", kind: "carriage", fam: "size 35", k: 1.2, n: "Carriage size 35, flange" },
  { code: "FABS-3210-1000-C5", route: "FABS", kind: "assembly", fam: "Ø32×10", k: 1.0, n: "Ball screw set = screw + nut, preloaded, run in", parts: [[BS.code, 1], [BN.code, 1]] },
  { code: "FABS-4010-1500-C5", route: "FABS", kind: "assembly", fam: "Ø40×10", k: 1.2, n: "Ball screw set Ø40", parts: [["BS-4010-1500-C5", 1], ["BN-4010-FL", 1]] },
  { code: "FALG-25-1000", route: "FALG", kind: "assembly", fam: "size 25", k: 1.0, n: "Guide set = rail + 2 matched carriages", parts: [[LG.code, 1], [LB.code, 2]] },
  { code: "FALG-35-1500", route: "FALG", kind: "assembly", fam: "size 35", k: 1.3, n: "Guide set size 35", parts: [["LG-35-1500", 1], ["LB-35-FL", 2]] },
];
export const PROD_BY_CODE = Object.fromEntries(PRODUCTS6.map((p) => [p.code, p]));
/* short keys used by item 3 (twin) and item 4 (demo API): BS, BN, LG, LB, FABS, FALG → reference product */
export const REF_CODE = { BS: BS.code, BN: BN.code, LG: LG.code, LB: LB.code, FABS: "FABS-3210-1000-C5", FALG: "FALG-25-1000" };
export const prodInfo = (c) => PROD_BY_CODE[REF_CODE[c] || c] || null;
export const LOT6 = { ...LOT };            // transfer lot sizes (item 3): BS 20, BN 40, LG 50, LB 100, FABS 20, FALG 50
/* machine types where a "family" change-over is short (same lead / size → only fine adjustment): minor set-up = 1/3 of the full set-up */
export const FAMILY_TYPES = ["BS-TGR", "BN-ITG", "LG-PGR", "LB-RGR", "BS-CGR"];
export const MINOR_SETUP = 1 / 3;
/* the operation after which a part gets its laser-marked serial number (item 5 SERIAL.where) */
export const MARK_OP = { BS: "30", BN: "20", LG: "30", LB: "20", FABS: "10", FALG: "10" };      // sets: the assembly serial is created at the assembly op
/* readiness check before release (examples): wheel + dresser sets per family on the family grinders, gauge calibration due dates */
export const TOOLSETS = { "BS-TGR": ["Ø32×10", "Ø25×5", "Ø32×20"], "BN-ITG": ["Ø32×10", "Ø25×5", "Ø32×20", "Ø40×10"], "LG-PGR": ["size 25", "size 20", "size 35"], "LB-RGR": ["size 25", "size 20", "size 35"] };
export const GAUGES6 = [
  { id: "XL80-0317", type: "QC-LED", n: "laser interferometer (lead bench)", due: "2027-03-01" }, { id: "RB-0102", type: "QC-RAL", n: "rail measuring bench scale", due: "2027-01-15" },
  { id: "TQ-0211", type: "AS-BSA", n: "preload torque sensor", due: "2026-12-04" }, { id: "FM-0330", type: "QC-MAT", n: "drag force sensor", due: "2027-02-20" },
  { id: "HR-0007", type: "BS-IND", n: "Rockwell tester (induction gate)", due: "2026-12-18" }, { id: "BM-0415", type: "BS-TGR", n: "ball-pin micrometer (pitch Ø)", due: "2027-04-10" },
];
export const TODAY6 = "2026-11-13";

/* ------------------------------------------------------------------ life cycles */
export const WO_STATES = [
  ["created", "work order exists (from ERP or planner), not yet on the shop floor", "release"],
  ["released", "material + tools + gauges checked, lots created, visible in dispatch lists", "first confirmation"],
  ["running", "at least one operation confirmed", "last lot done"],
  ["done", "all lots finished (good quantity booked to finished goods / supermarket)", "close (ERP settles cost)"],
  ["closed", "technically complete – no more bookings", "–"],
  ["cancelled", "stopped before release (or by the planner with reason)", "–"],
];
export const LOT_STATES = [
  ["planned", "lot exists, waiting for release"], ["queued", "waiting in front of the next machine type"], ["running", "on a machine (set-up or production)"],
  ["moving", "transport order to the next area (AGV / cart)"], ["hold", "blocked by quality (gate NOK, NCR, SPC) – not dispatched"], ["done", "all operations finished"], ["scrapped", "whole lot scrapped"],
];
export const OP_STATES = ["open", "running", "done"];

/* ------------------------------------------------------------------ entities (ER model) – the same in JS and Python */
export const ENTITIES = [
  ["ProductionOrder (ERP)", "erpOrder", "product, qty, due, customer order", "ERP (item 7)", "Production request"],
  ["WorkOrder", "id WO-00001", "erpOrder, product, route, qty, due, priority, routingVersion, status, lines, lots", "MES", "Production schedule / Job order"],
  ["Lot", "id WO-00001-BS-01", "wo, route, code, family, qty, qty0, status, i (current op), hold, heat, ops[], serials[]", "MES", "Material lot (WIP)"],
  ["Operation (of a lot)", "lot + op no.", "machine type, set-up, cycle, status, machine, good, scrap, tStart, tEnd, plan", "MES (from routing, item 2)", "Job order / segment"],
  ["Confirmation", "id CF-00001", "wo, lot, op, machine, good, scrap, setupMin, runMin, source, key (idempotency)", "MES", "Production performance (actual)"],
  ["Serial", "BS3210-261113-0042", "part code, kind, lot, wo, heat, status, parent, children, grade, label", "MES (+ QA)", "Material sublot / serial"],
  ["Heat lot (material)", "H7741", "material, heat no., mill, certificate EN 10204 3.1, qty", "ERP goods receipt → MES", "Material lot"],
  ["Furnace load (HT batch)", "HT-00001", "furnace type, machine, lots[], qty / capacity, program, tStart, tEnd", "MES", "Job order (batch)"],
  ["Downtime", "DT-00001", "machine, start, end, reason code, source (gateway / terminal), comment, by", "MES", "Equipment state / event"],
  ["Machine (MES view)", "BS-TGR-03", "type, state, lot, download, spcStop, counters baseline", "MES ← gateway (item 4)", "Equipment"],
  ["Transport request", "TR-00001", "lot, from, to, priority, state, agvOrder (fleet id)", "MES → AGV fleet (HTTP)", "Material movement"],
  ["Kanban card", "KB-BALL635", "item, bin qty, bins, full, demand / day, lead time", "MES ↔ ERP", "Material definition + lot"],
  ["Measurement record", "QR-00001", "serial, char, value, decision, gauge, op, machine", "QA (item 5) → MES", "Quality test result"],
  ["NCR", "NCR-00001", "serial(s), char, text, 8D steps, status", "QA (item 5)", "Quality operations"],
];

/* ------------------------------------------------------------------ downtime reason codes (ISO 22400 time model) */
// cat: what kind of loss · oee: "A" = availability loss inside the planned busy time, "PDOT" = planned down time (outside OEE), "NP" = not planned (no demand)
export const REASONS = [
  ["100", "Breakdown – mechanical (spindle, axis, bearing)", "breakdown", "A"],
  ["110", "Breakdown – electrical / control / drive", "breakdown", "A"],
  ["120", "Breakdown – hydraulics / pneumatics / coolant", "breakdown", "A"],
  ["130", "Grinding-oil temperature / chiller", "breakdown", "A"],
  ["140", "Heat-treatment process out of window", "breakdown", "A"],
  ["200", "Set-up / change-over", "set-up", "A"],
  ["210", "Wheel dressing outside the cycle", "set-up", "A"],
  ["220", "Tool change / tool breakage", "tooling", "A"],
  ["300", "No material / parts (starved)", "logistics", "A"],
  ["310", "Waiting for AGV / transport", "logistics", "A"],
  ["320", "No operator", "organisation", "A"],
  ["330", "Waiting for first-part release (quality)", "quality", "A"],
  ["400", "Blocked – out-buffer full", "logistics", "A"],
  ["500", "Planned maintenance", "planned", "PDOT"],
  ["510", "Cleaning / 5S (planned)", "planned", "PDOT"],
  ["520", "Break / meeting (planned)", "planned", "PDOT"],
  ["600", "Quality problem – adjust / re-measure", "quality", "A"],
  ["700", "No order (idle)", "no demand", "NP"],
  ["900", "Manual stop – reason not given yet", "unknown", "A"],
];
export const REASON_BY_CODE = Object.fromEntries(REASONS.map((r) => [r[0], { code: r[0], text: r[1], cat: r[2], oee: r[3] }]));
/* alarm code of the machine (Modbus register std.alarm, item 3 / 4) → first guess of the reason (the operator confirms it on the terminal) */
export function alarmReason(code) {
  const c = +code || 0;
  if (c === 900) return "900";
  if (c === 213) return "130";
  if (c === 211 || c === 202) return "210";
  if (c === 102) return "220";
  if (c >= 400 && c < 500) return "140";
  if (c === 302 || c === 203 || c === 103 || c === 801) return "120";
  if (c === 301 || c === 104 || c === 201 || c === 212 || c === 502 || c === 601 || c === 701 || c === 802 || c === 153) return "110";
  if (c === 602) return "600";
  if (c === 702) return "300";
  if (c === 151) return "220";
  return "100";
}

/* ------------------------------------------------------------------ ISA-95 / IEC 62264-3 level-3 activities → this page + API */
export const ISA95 = [
  ["Product definition management", "routing + routing version (item 2), control plan (item 5), work instructions", "§1 data model", "GET /api/bsf/mes/workorders/{id} (operations)"],
  ["Production resource management", "machines, tools, gauges, operators, material readiness before release", "§1 readiness check", "GET /api/bsf/mes/machines · release → readiness"],
  ["Detailed production scheduling", "finite-capacity sequence per machine (rules, families, drum-buffer-rope)", "§2 scheduling + Gantt", "POST /api/bsf/mes/schedule"],
  ["Production dispatching", "dispatch list per machine, order download to the machine", "§2 dispatch · §3 download", "GET /api/bsf/mes/dispatch?machine= · POST …/machines/{id}/download"],
  ["Production execution management", "start / stop, terminal, holds, work instructions", "§3 terminal · §4 holds", "POST /api/bsf/mes/lots/{id}/hold"],
  ["Production data collection", "counters + states from the Modbus TCP gateway, confirmations, downtime", "§3 machine interface", "POST /api/bsf/mes/confirmations · /downtime · /sync"],
  ["Production tracking", "lots, serial numbers, genealogy, where-used", "§7 trace search", "GET /api/bsf/mes/trace?serial= | ?heat="],
  ["Production performance analysis", "OEE (ISO 22400), Pareto, shift report, WIP, lead time", "§6 performance", "GET /api/bsf/mes/oee · /report"],
  ["Quality operations (link)", "gate results, holds, NCR block, SPC stop", "§4 quality link", "/api/bsf/qa/results (item 5) → MES holds"],
  ["Inventory operations (link)", "transport requests, kanban, finished-goods booking", "§5 logistics link", "POST /api/bsf/mes/transport · /kanban/{item}/scan · /fg"],
  ["Maintenance operations (link)", "downtime with reason → maintenance request", "§3 downtime", "POST /api/bsf/mes/downtime"],
];
export const MESA11 = [
  ["Resource allocation + status", "machines, tools, gauges, people – who / what is free"], ["Operations / detail scheduling", "sequence with finite capacity"],
  ["Dispatching production units", "release lots, dispatch lists"], ["Document control", "work instructions, drawings, programs, recipes"],
  ["Data collection / acquisition", "counters, states, process values (gateway)"], ["Labour management", "operator badges, qualifications, shifts"],
  ["Quality management", "gates, holds, SPC, NCR (item 5)"], ["Process management", "routing, recipes, interlocks"],
  ["Maintenance management", "downtime, reasons, maintenance requests"], ["Product tracking + genealogy", "lots, serials, heat lots, where-used"],
  ["Performance analysis", "OEE, Pareto, KPIs, reports"],
];

/* ------------------------------------------------------------------ user roles (HTTP API keys / login in the real plant) */
export const ROLES = [
  ["operator", "terminal: start lot, scan serial, confirm good / scrap, downtime reason", "machine terminal page"],
  ["setter", "+ set-up confirmation, first-part request, program / recipe download", "terminal"],
  ["supervisor", "+ re-sequence dispatch list, reclassify downtime, shift report sign-off", "supervisor page"],
  ["quality", "hold / release lots, NCR link, SPC stop / release of a machine", "quality page"],
  ["logistics", "transport requests, kanban scan, finished-goods booking", "logistics page"],
  ["planner", "create / release work orders, run the scheduler, priorities", "planning page"],
  ["maintenance", "downtime reasons, maintenance requests, machine release after repair", "maintenance page"],
  ["admin", "users, API keys, master data, backup / restore", "admin page"],
];

/* ------------------------------------------------------------------ kanban / supermarket for bought parts (BOM of item 1) */
// N = ceil(D × LT × (1 + α) / C) : D demand per day, LT replenishment lead time (days), α safety factor, C container quantity
const per = (code, pos) => (BOM[code].find((r) => r[0] === pos) || [0, 0, 0])[2];
export const KANBAN = [
  { item: "BALL-6.35-G5", n: "Balls Ø6.35 G5 (nut)", per: per(BN.code, "20"), use: "BN", C: 5000, LT: 5, a: 0.2, sup: "ball maker (example)" },
  { item: "DEFL-3210", n: "Deflector MIM (nut)", per: per(BN.code, "30"), use: "BN", C: 500, LT: 10, a: 0.2, sup: "MIM supplier (example)" },
  { item: "SEAL-3210", n: "Wiper seal (nut)", per: per(BN.code, "40"), use: "BN", C: 200, LT: 10, a: 0.2, sup: "seal maker (example)" },
  { item: "RING-472", n: "Snap ring DIN 472 (nut)", per: per(BN.code, "50"), use: "BN", C: 1000, LT: 5, a: 0.2, sup: "standard parts" },
  { item: "BALL-4.763-G10", n: "Balls Ø4.763 G10 (carriage)", per: per(LB.code, "20"), use: "LB", C: 20000, LT: 5, a: 0.2, sup: "ball maker (example)" },
  { item: "CAP-LB25", n: "End cap POM (carriage)", per: per(LB.code, "30"), use: "LB", C: 500, LT: 15, a: 0.25, sup: "moulder (example)" },
  { item: "SEAL-LB25", n: "End seal (carriage)", per: per(LB.code, "50"), use: "LB", C: 500, LT: 10, a: 0.2, sup: "seal maker (example)" },
  { item: "CAPH-11", n: "Rail hole cap Ø11", per: per(LG.code, "30"), use: "LG", C: 2000, LT: 10, a: 0.2, sup: "moulder (example)" },
];
export const kanbanBins = (k, D) => Math.ceil(D * k.LT * (1 + k.a) / k.C - 1e-9);

/* ------------------------------------------------------------------ serial numbers + labels */
export const SERIAL6 = {
  prefix: { BS: "BS3210", BN: "BN3210", LG: "LG25", LB: "LB25", FABS: "A-BS", FALG: "A-LG" },    // = item 5 SERIAL.prefix (reference products)
  fmt: "<prefix>-YYMMDD-NNNN (running number per day and prefix)",
  gtinBase: "0950110100000",        // EXAMPLE only (GS1 example prefix 950110) – a real GTIN needs your own GS1 company prefix
  ais: [["01", "GTIN-14 (product)", "fixed 14"], ["21", "serial number", "variable ≤ 20, end with GS"], ["10", "batch / lot", "variable ≤ 20, end with GS"], ["11", "production date YYMMDD", "fixed 6"], ["240", "additional product id (our product code)", "variable ≤ 30"]],
  note: "ECC 200 Data Matrix, GS1 mode (FNC1 first). The label printer (or the laser marker) builds the symbol from the element string – the MES sends only the data (HTTP print job).",
};
export function gtinCheck(d13) { let s = 0; for (let i = 0; i < 13; i++) s += (+d13[12 - i]) * (i % 2 === 0 ? 3 : 1); return String((10 - (s % 10)) % 10); }
/* GS1 element string (human-readable with brackets, and the raw string with <GS> = ASCII 29) */
export function gs1Element(o) {
  const gt = o.gtin || (SERIAL6.gtinBase + gtinCheck(SERIAL6.gtinBase)), G = String.fromCharCode(29);
  const hr = `(01)${gt}(11)${o.date || "261113"}(21)${o.serial}(10)${o.lot}(240)${o.code}`;
  const raw = `01${gt}11${o.date || "261113"}21${o.serial}${G}10${o.lot}${G}240${o.code}`;
  return { gtin: gt, hr, raw, zpl: `^XA^FO30,30^BXN,6,200,0,0,1,_^FH^FD_1${raw.split(G).join("_1D")}^FS^FO230,30^A0N,26,26^FD${o.code}^FS^FO230,64^A0N,24,24^FDSN ${o.serial}^FS^FO230,96^A0N,24,24^FDLOT ${o.lot}^FS^XZ` };
}

/* ------------------------------------------------------------------ material heat lots (goods receipt by ERP, example) */
export const HEATS = [
  { heat: "H7741", mat: "50CrMo4 +QT bar Ø36", route: "BS", mill: "steel mill A (example)", cert: "EN 10204 3.1", qty: 400 },
  { heat: "H7802", mat: "50CrMo4 +QT bar Ø36", route: "BS", mill: "steel mill A (example)", cert: "EN 10204 3.1", qty: 400 },
  { heat: "H5512", mat: "20MnCr5 bar Ø85", route: "BN", mill: "steel mill B (example)", cert: "EN 10204 3.1", qty: 600 },
  { heat: "H5590", mat: "20MnCr5 bar Ø85", route: "BN", mill: "steel mill B (example)", cert: "EN 10204 3.1", qty: 600 },
  { heat: "P3307", mat: "C55 drawn rail profile 25", route: "LG", mill: "profile mill C (example)", cert: "EN 10204 3.1", qty: 800 },
  { heat: "P3351", mat: "C55 drawn rail profile 25", route: "LG", mill: "profile mill C (example)", cert: "EN 10204 3.1", qty: 800 },
  { heat: "B9120", mat: "20CrMo4 drawn block profile", route: "LB", mill: "profile mill C (example)", cert: "EN 10204 3.1", qty: 2000 },
  { heat: "B9188", mat: "20CrMo4 drawn block profile", route: "LB", mill: "profile mill C (example)", cert: "EN 10204 3.1", qty: 2000 },
];

/* ------------------------------------------------------------------ gateway command block (item 4, register 200 – 225) used for the order download */
export const GATEWAY6 = {
  block: "200 cmd.code · 201 cmd.seq · 202 cmd.ctl (REQ toggle, bit 0) · 203 – 212 order ASCII20 · 213 – 222 part ASCII20 · 223 recipe · 224 – 225 qty UINT32",
  hs: "8 hs.status (bit0 ACK, bit1 BUSY, bit2 DONE toggle, bit3 REJECT, bit4 READY) · 9 hs.ackSeq · 10 hs.result · 11 hs.lotDone",
  steps: ["FC03 read 200 – 202 (cmd.seq, REQ)", "FC03 read 8 – 10 (ACK = REQ? machine free)", "FC16 write 200 – 225 (data, REQ unchanged)", "FC06 write 202 = REQ toggled (LAST)", "FC03 poll 8 – 11 every 100 ms until ACK = REQ and ackSeq = seq", "result 0 OK → lot BUSY on the machine; counters hs.lotDone → automatic confirmations; DONE toggle → op finished"],
};

/* ------------------------------------------------------------------ HTTP API of the MES (server twin/bsf_mes.py = browser demo router in bsfmes_core.js) */
export const API6 = [
  ["GET", "/api/bsf/mes/health", "service health, counts, persistence file, gateway reachable?"],
  ["GET", "/api/bsf/mes/api", "this route list"],
  ["GET", "/api/bsf/mes/workorders?status=&page=1&size=20", "work orders (paged)"],
  ["POST", "/api/bsf/mes/workorders", "create {product, qty, due | dueDays, erpOrder, priority, lots?} (Idempotency-Key)"],
  ["GET", "/api/bsf/mes/workorders/{id}", "one work order with lines, lots and operations"],
  ["POST", "/api/bsf/mes/workorders/{id}/release", "readiness check (material, tools, gauges) + release; 409 wrong state, 422 not ready ({force: true} overrides)"],
  ["POST", "/api/bsf/mes/workorders/{id}/cancel", "cancel a created work order {reason}"],
  ["GET", "/api/bsf/mes/lots?wo=&status=", "lots"],
  ["GET", "/api/bsf/mes/lots/{id}", "one lot with operations, serials, heat, holds"],
  ["POST", "/api/bsf/mes/lots/{id}/hold", "quality hold {reason, ncr}"],
  ["POST", "/api/bsf/mes/lots/{id}/release", "release a hold {by, text}"],
  ["GET", "/api/bsf/mes/dispatch?machine=BS-TGR-03", "dispatch list of one machine (sequence from the last schedule)"],
  ["POST", "/api/bsf/mes/confirmations", "confirmation {lot | wo, op, machine, good, scrap, setupMin, runMin, serial} (Idempotency-Key)"],
  ["GET", "/api/bsf/mes/confirmations?lot=&n=50", "newest confirmations"],
  ["POST", "/api/bsf/mes/schedule", "finite-capacity schedule {rule: EDD|SPT|CR|FIFO|FAM, dbr, bufferH, compare, case?}"],
  ["GET", "/api/bsf/mes/schedule", "last schedule (ops + KPIs)"],
  ["GET", "/api/bsf/mes/machines", "MES view of all machines (state, lot, download, SPC stop, open downtime)"],
  ["POST", "/api/bsf/mes/machines/{id}/download", "order download {lot} → gateway POST /api/bsf/command (FC16 + FC06 toggle + FC03 ACK)"],
  ["POST", "/api/bsf/mes/machines/{id}/spc", "SPC alarm on / off {alarm: true, char} – stops dispatch to this machine"],
  ["GET", "/api/bsf/mes/downtime?machine=&open=1", "downtime records"],
  ["POST", "/api/bsf/mes/downtime", "downtime from the terminal {machine, reason, minutes | start/end, comment}"],
  ["POST", "/api/bsf/mes/downtime/{id}/reason", "classify / reclassify {reason, by}"],
  ["GET", "/api/bsf/mes/reasons", "reason code list"],
  ["GET", "/api/bsf/mes/andon", "andon board data (state per machine, calls, targets)"],
  ["POST", "/api/bsf/mes/andon/call", "andon call {machine, kind: supervisor | maintenance | quality | logistics} (+ /andon/ack {id})"],
  ["GET", "/api/bsf/mes/oee?machine=&type=", "OEE per machine / type / plant (ISO 22400)"],
  ["GET", "/api/bsf/mes/report?hours=7.5", "shift report"],
  ["GET", "/api/bsf/mes/pareto", "downtime Pareto (all records)"],
  ["GET", "/api/bsf/mes/serials?lot=", "serial numbers"],
  ["POST", "/api/bsf/mes/serials", "create serials {lot, n} → serials + GS1 label data"],
  ["POST", "/api/bsf/mes/genealogy/link", "assembly scan {parent, children: [...]}"],
  ["GET", "/api/bsf/mes/trace?serial=", "genealogy + operations + measurement records (item 5)"],
  ["GET", "/api/bsf/mes/trace?heat=H7741", "where-used of a heat lot"],
  ["GET", "/api/bsf/mes/htloads", "heat-treatment furnace loads"],
  ["POST", "/api/bsf/mes/htloads", "build a furnace load {furnace, lots: [...]}"],
  ["POST", "/api/bsf/mes/transport", "transport request {lot, from, to, priority} → AGV fleet POST /api/bsf/agv/transportorders"],
  ["GET", "/api/bsf/mes/kanban", "kanban loops (bins full / empty, signal)"],
  ["POST", "/api/bsf/mes/kanban/{item}/scan", "empty bin scanned → replenishment signal"],
  ["POST", "/api/bsf/mes/fg", "finished-goods booking {lot, qty} → ERP goods receipt"],
  ["POST", "/api/bsf/mes/twin", "shop-floor state from the twin page (orders, lots, machines) – the MES derives confirmations + downtime"],
  ["POST", "/api/bsf/mes/sync", "pull the Modbus TCP gateway (counters of downloaded lots → confirmations, states → downtime)"],
  ["POST", "/api/bsf/mes/eval", "calculation cross-check {kind: oee | schedule | kanban | little}"],
  ["GET", "/api/bsf/mes/events?since=0", "audit journal (who did what, when)"],
  ["POST", "/api/bsf/mes/control", "{action: reset | persist, on}"],
];

/* ------------------------------------------------------------------ hand-check values (&bf6test and guide 45) */
export const CHECK6 = {
  oee: { PBT: 450, down: 30, setup: 15, PRI: 40, PQ: 9, GQ: 8, A: 405 / 450, E: 360 / 405, Q: 8 / 9, OEE: 320 / 450 },
  plant: { m: [[320 / 450, 450], [0.8, 900]], OEE: (320 + 720) / 1350 },
  little: { TH: 120, LT: 5, WIP: 600 },
  kanban: { D: 7200, LT: 5, a: 0.2, C: 5000, N: 9 },
  cal: { tod0: 840, H: 900, start: 0, dur: 120, end: 660 },
  // single machine, 3 lots (min): p 300 / 180 / 480, due 360 / 540 / 600
  one: { p: [300, 180, 480], d: [360, 540, 600], EDD: { seq: "J1 J2 J3", tard: 360, max: 360 }, SPT: { seq: "J2 J1 J3", tard: 480, flow: 540 }, CR: { seq: "J1 J3 J2", tard: 600 } },
  // flow shop 2 machines, A (180, 120, due 360), B (60, 240, due 600)
  flow: { SPT: 420, EDD: 540 },
  // thread grinder: 4 lots X1 Y1 X2 Y2, p 100, set-up 45 / minor 15 (same family)
  fam: { EDD: 580, FAM: 520, majorsEDD: 4, majorsFAM: 2, minorsFAM: 2 },
};
export const SAMPLE_WO = { product: BS.code, qty: 40, due: "2026-11-20T14:00:00Z", erpOrder: "PO-260045", priority: 5 };
