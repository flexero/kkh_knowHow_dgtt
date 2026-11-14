/* FMS engineering – item 2 data: product → process → machines.  Guide: docs/FMS system design/62_product_process_machines.md.
 * All numbers are typical values / examples. */

/* ---------------------------------------------------------------- 2A  part–machine matrix (production flow analysis) */
// Example: 10 parts × 8 machines, rows/columns deliberately mixed. 1 = the part visits the machine.
export const PFA = {
  machines: ["LATHE", "HMC", "HONE", "DRILL", "GRIND", "VMC", "SAW", "WASH"],
  parts: ["P01 crankcase A", "P02 shaft S1", "P03 cylinder C1", "P04 crankcase B", "P05 shaft S2", "P06 cylinder C2", "P07 cover K", "P08 pin", "P09 cylinder C3", "P10 bracket"],
  m: [
    [0, 1, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 0],
    [0, 0, 1, 1, 0, 1, 0, 0],
    [0, 1, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 1, 0, 1, 1, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 1],
  ],
};

/* ---------------------------------------------------------------- 2B  process capability (ISO 286 IT grade, Ra µm) */
// [process, domain, IT best, IT worst, Ra best, Ra worst, typical machine / note]
export const PROC = [
  ["Sand casting", "Primary", 14, 16, 12.5, 25, "Foundry – raw part, machining allowance 2–5 mm"],
  ["Die casting (Al, Zn)", "Primary", 11, 13, 0.8, 3.2, "Die casting cell – near net shape"],
  ["Forging (closed die)", "Primary", 13, 15, 3.2, 12.5, "Forging press – allowance 1–3 mm"],
  ["Injection moulding", "Primary", 10, 13, 0.2, 1.6, "Moulding machine – depends on mould and shrinkage"],
  ["Additive (metal LPBF)", "Primary", 11, 14, 6, 15, "LPBF machine – functional surfaces machined after"],
  ["Laser cutting (sheet)", "Sheet metal", 11, 13, 1.6, 12.5, "Fibre laser – tolerance grows with thickness"],
  ["Punching", "Sheet metal", 10, 12, 3.2, 12.5, "Turret punch – burr side"],
  ["Press-brake bending", "Sheet metal", 12, 14, 3.2, 12.5, "Press brake – angle ± 0.3–0.5°, flange ± 0.1–0.2 mm"],
  ["Rough turning", "Machining", 11, 13, 6.3, 12.5, "CNC lathe"],
  ["Finish turning", "Machining", 7, 9, 0.8, 3.2, "CNC lathe"],
  ["Hard turning (CBN)", "Machining", 6, 7, 0.2, 0.8, "Rigid CNC lathe – replaces some grinding"],
  ["Rough milling", "Machining", 11, 13, 6.3, 12.5, "HMC / VMC"],
  ["Finish milling", "Machining", 8, 9, 1.6, 3.2, "HMC / VMC"],
  ["Drilling", "Machining", 11, 13, 3.2, 6.3, "HMC / VMC / drill"],
  ["Reaming", "Machining", 7, 8, 0.8, 1.6, "HMC / VMC"],
  ["Fine boring", "Machining", 6, 7, 0.4, 1.6, "HMC / VMC with fine-boring head"],
  ["Broaching", "Machining", 7, 8, 0.8, 3.2, "Broaching machine – high volume only"],
  ["Cylindrical grinding", "Machining", 5, 6, 0.1, 0.8, "OD / ID grinder"],
  ["Surface grinding", "Machining", 5, 7, 0.2, 0.8, "Surface grinder"],
  ["Honing", "Machining", 4, 6, 0.05, 0.4, "Honing machine – bores, cylinders"],
  ["Lapping / superfinishing", "Machining", 3, 5, 0.012, 0.1, "Lapping / superfinish – seals, gauges"],
  ["Wire EDM", "Machining", 5, 7, 0.2, 1.6, "Wire EDM – hard materials, dies"],
];
// joining / assembly processes (for the assembly and welding domains)
// [process, how it works, check / quality signal, typical cycle, module]
export const JOIN = [
  ["Screwdriving (torque–angle)", "Electric nutrunner tightens to torque, monitors angle window", "Final torque + angle curve per screw", "2–5 s per screw (automatic)", "M13"],
  ["Press-fit", "Servo press pushes a bearing / pin, monitors force over distance", "Force–distance curve inside an envelope", "3–8 s", "M13"],
  ["Riveting / clinching", "Plastic deformation joins sheets without heat", "Force curve, final height", "1–3 s", "M13 / M16"],
  ["Adhesive dispensing", "Robot applies a bead, then curing", "Bead vision check, cure time", "10–60 s + cure", "M13"],
  ["MIG/MAG welding", "Arc with wire electrode and gas – steel frames", "Current / voltage / wire feed monitoring, visual", "Weld speed 0.3–1 m/min", "M15"],
  ["TIG welding", "Tungsten electrode, filler wire – thin, stainless, aluminium", "Current, visual, leak test", "0.1–0.3 m/min", "M15"],
  ["Laser welding", "Focused laser – deep, narrow seams, low distortion", "Seam tracking, process monitoring", "1–6 m/min", "M15"],
  ["Resistance spot welding", "Two electrodes squeeze and pass current – sheet metal", "Current, time, electrode force, nugget tests", "1–3 s per spot", "M15"],
  ["Leak test (pressure decay)", "Fill with air, close, measure pressure drop", "Δp in time vs limit → leak rate", "10–40 s", "M14"],
  ["Function / performance test", "Run the product, measure flow, power, noise …", "Measured values vs limits, curves to MES", "30 s – 10 min", "M14"],
];

/* ---------------------------------------------------------------- 2C  cycle-time estimators */
// kc = specific cutting force [N/mm²] (typical, for chip thickness ≈ 0.2–0.3 mm)
export const MATS = [
  ["Steel C45 / 42CrMo4", 1900, 200, 150], // name, kc, vc turning m/min, vc milling m/min
  ["Cast iron EN-GJL-250", 1100, 220, 200],
  ["Stainless 1.4301", 2300, 150, 120],
  ["Aluminium AlSi10Mg", 750, 600, 800],
];

/* ---------------------------------------------------------------- 2D  capacity presets */
// groups: [name, available h/year per machine, OEE, set-up min per lot]
// parts:  [name, volume/year, lot size, minutes per part on each group (same order as groups; 0 = not used)]
export const CAP = {
  mach: {
    n: "Machining FMS (prismatic + rotational)",
    groups: [["HMC (pallet pool)", 5280, 0.75, 20], ["VMC", 3840, 0.75, 30], ["Washer", 3840, 0.85, 0], ["CMM", 3840, 0.8, 10]],
    parts: [["Crankcase A", 4000, 40, [14, 0, 2, 1]], ["Crankcase B", 3000, 30, [18, 0, 2, 1.2]], ["Cylinder C", 6000, 60, [0, 6, 1.5, 0.6]],
            ["Cover D", 8000, 100, [0, 3.5, 1, 0.3]], ["Bracket E", 2500, 25, [9, 4, 1, 0.5]]],
    note: "HMC 22 h/day (2 shifts + unmanned) × 240 days; others 2 shifts × 8 h × 240. CMM time = measuring time ÷ sample interval.",
  },
  asm: {
    n: "Assembly line (3 product variants)",
    groups: [["Manual pre-assembly", 3840, 0.85, 5], ["Auto screwdriving", 3840, 0.85, 5], ["Press-fit", 3840, 0.85, 5], ["Leak test", 3840, 0.9, 2], ["Function test", 3840, 0.85, 5]],
    parts: [["Pump V1", 60000, 600, [1.2, 0.5, 0.4, 0.8, 1.5]], ["Pump V2", 45000, 450, [1.4, 0.6, 0.4, 0.8, 1.6]], ["Pump V3", 24000, 240, [1.6, 0.7, 0.5, 0.9, 1.8]]],
    note: "Set-up = recipe / part kit change per lot. For a paced line compare each station time with the takt time.",
  },
  weld: {
    n: "Robot welding cells (frames)",
    groups: [["Manual fit-up / tack", 3840, 0.85, 10], ["Robot weld cell (2-station)", 3840, 0.8, 15], ["Grind / finish", 3840, 0.85, 0]],
    parts: [["Frame F1", 6000, 50, [4, 6.5, 2]], ["Frame F2", 3000, 30, [5, 9, 2.5]], ["Bracket B", 12000, 200, [1, 1.8, 0.5]]],
    note: "With a 2-station turntable the operator loads station B while the robot welds A – loading time is hidden if load < weld time.",
  },
  sheet: {
    n: "Sheet-metal system (laser + bending)",
    groups: [["Fibre laser + tower", 5280, 0.75, 5], ["Press brake", 3840, 0.7, 15], ["Deburr", 3840, 0.85, 0], ["Welding", 3840, 0.8, 10]],
    parts: [["Panel P1", 30000, 300, [0.8, 1.2, 0.3, 0]], ["Cover P2", 20000, 200, [0.6, 0.9, 0.2, 0]], ["Housing P3", 8000, 80, [1.5, 2.5, 0.4, 4]]],
    note: "Laser time from 2C (cut length ÷ speed + pierces); bending time ≈ bends × 8–15 s + handling.",
  },
};

/* ---------------------------------------------------------------- 2E  machine selection */
export const CHECK = [
  ["Part fits", "Work envelope (X/Y/Z), pallet size, max. part mass on table, swing diameter (lathe), sheet size (laser)"],
  ["Process power", "Spindle power and torque at the needed speed (2C power check), axis thrust, press force, laser power"],
  ["Accuracy", "Positioning / repeatability (ISO 230-2), thermal stability, achievable IT grade for your critical features (2B)"],
  ["Productivity", "Rapid traverse, tool change time (chip-to-chip), pallet change time, acceleration – estimated cycle time for your parts"],
  ["Automation ready", "Pallet changer / pallet pool option, robot loading door, zero-point clamping, M01 interface signals (start, end, door, clamp, alarms)"],
  ["Tools / fixtures", "Magazine size (sister tools for unmanned shifts), tool ID (RFID / chip), fixture standard"],
  ["Control & communication", "CNC brand (your standard?), OPC UA / MTConnect / Profinet / Modbus TCP, DNC / program transfer, data for OEE"],
  ["Service", "Local service engineer, spare parts stock in the country, response time, training, remote diagnosis rules"],
  ["Site", "Footprint incl. chip conveyor and service area, mass → foundation, power (kVA), air, coolant, noise"],
  ["Cost", "Purchase + options + transport + installation + tooling + energy + maintenance over 10 years (life-cycle cost)"],
];
// [criterion, weight %]
export const CRIT = [["Technical fit (envelope, power)", 20], ["Accuracy capability", 15], ["Cycle time for our parts", 15], ["Automation interface", 15], ["Control & communication", 10], ["Local service & spare parts", 15], ["Life-cycle cost", 10]];
export const CANDS = [["Machine A", [4, 4, 3, 5, 4, 3, 3]], ["Machine B", [5, 4, 4, 3, 3, 5, 2]], ["Machine C", [3, 3, 4, 4, 5, 4, 5]]];
