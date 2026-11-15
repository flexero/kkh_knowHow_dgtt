/* FMS engineering – item 5 data: control architecture (ISA-95, equipment hierarchy, PackML, message flow, variants).
 * Guide: docs/FMS system design/65_control_architecture.md. Examples only. */

/* 5A ISA-95 functional levels */
export const LEVELS = [
  { l: 4, n: "Business planning & logistics", sys: "ERP", time: "months, weeks, days",
    does: ["Sales orders, demand forecast", "Master production schedule, MRP (what and how much, when)", "Purchasing, stock value, costing", "Production orders released to level 3"],
    out: "Production orders, BOM, routings, due dates", inp: "Confirmations: good / scrap quantity, consumption, hours, order status",
    fms: "Releases 'PO 4711: 40 × crankcase VC20, due 20 Nov' – does NOT know pallets or machines." },
  { l: 3, n: "Manufacturing operations management", sys: "MES / MOM (+ QMS, CMMS, WMS, DNC, tool management)", time: "shifts, hours, minutes",
    does: ["Detailed scheduling and dispatching of work orders", "Kit check: material, fixture, NC program, tools before release", "WIP tracking, traceability (genealogy per serial)", "Quality data, SPC; maintenance orders; OEE and KPIs", "NC program management (versions, download)"],
    out: "Work orders / jobs, programs, recipes, parameters", inp: "States, counts, times, measured values, alarms",
    fms: "Turns the PO into jobs per machine group, checks the kit, follows every serial number." },
  { l: 2, n: "Supervisory control", sys: "Cell controller, SCADA / HMI, historian", time: "minutes, seconds",
    does: ["Cell controller: which pallet to which machine now, transport orders, pallet / fixture / tool status", "SCADA / HMI: overview, alarms, trends, operator commands", "Historian: time series of all signals"],
    out: "Transport orders, start commands with program number, set-points", inp: "Module states (PackML), hand-over signals, alarms",
    fms: "Sends pallet P07 to MC02, starts program O2010C, routes it to the washer afterwards." },
  { l: 1, n: "Basic control", sys: "PLC, CNC, robot controller, safety PLC, drives", time: "milliseconds, seconds",
    does: ["Sequences of each module (pallet change, clamp, door, stacker move)", "Interlocks, hand-over handshakes", "Motion control, NC program execution", "Safety functions (hard-wired / safety PLC)"],
    out: "Outputs to valves, motors, drives", inp: "Sensors, encoders, switches, safety devices",
    fms: "Stacker PLC moves the crane, HMC CNC runs the program and changes pallets, safety PLC stops motion when a door opens." },
  { l: 0, n: "Physical process", sys: "Sensors, actuators, machines, the part", time: "real time (physics)",
    does: ["Cutting, clamping, moving, measuring – the real process", "Sensors (proximity, pressure, encoders, cameras)", "Actuators (motors, cylinders, valves)"],
    out: "Physical effect on the part", inp: "Energy, material",
    fms: "The spindle cuts, the clamp cylinder closes, the pressure switch reports 'clamped'." },
];

/* 5A decision matrix: [decision, level, system, why there] */
export const DECIDE = [
  ["Which customer orders to make this month", 4, "ERP", "Needs sales, stock and finance data; weeks of horizon"],
  ["How much raw material to buy and when", 4, "ERP (MRP)", "BOM × demand – stock and supplier lead times"],
  ["Sequence of work orders on each machine group this shift", 3, "MES scheduler", "Needs due dates + real machine states + set-ups"],
  ["Release a job only when material, fixture, program and tools are ready", 3, "MES (kit check)", "Combines data from WMS, tool management, DNC"],
  ["Which pallet goes to which free machine now", 2, "Cell controller", "Seconds-level decision with the live state of all modules"],
  ["Which NC program version to run", 3, "MES / DNC", "Version control and release; executed by the CNC (level 1)"],
  ["Stacker route, speed, positioning", 1, "Stacker PLC", "Millisecond motion control, local sensors"],
  ["Open door, unclamp, change pallet – the sequence", 1, "PLC / CNC of the machine", "Fast, local interlocks"],
  ["Stop all motion when a guard door opens", 1, "Safety PLC / hard-wired", "Must never depend on a network or a PC"],
  ["Show alarm and let operator acknowledge", 2, "SCADA / HMI", "Operator interface for the whole cell"],
  ["Part OK / NOK from measured values", 3, "MES / QMS (inline gauge: level 1)", "Needs limits, history, traceability"],
  ["Count tool life, call sister tool", 1, "CNC", "Real-time, per cut; data copied to tool management (level 3)"],
  ["OEE and downtime reasons", 3, "MES", "Calculated from level 1/2 signals over shifts"],
  ["Preventive maintenance order", 3, "CMMS", "Counters from machines, plan, spare parts; costs go to ERP"],
];

/* 5B equipment hierarchy (ISA-95 / ISA-88 role-based) for an example FMS */
export const HIER = { n: "Enterprise – Example Compressors Ltd", t: "Enterprise", c: [
  { n: "Site – Plant 1", t: "Site", c: [
    { n: "Area – Machining", t: "Area", c: [
      { n: "Work cell – FMS1 (crankcases)", t: "Work centre / cell", c: [
        { n: "MC01 – machining centre (M01)", t: "Work unit", c: [{ n: "APC – pallet changer (M02)", t: "Equipment module", c: [{ n: "Clamp valve Y1 + pressure switch B3", t: "Control module" }, { n: "Rotary drive M1", t: "Control module" }] }, { n: "Tool magazine (M09)", t: "Equipment module" }, { n: "Door", t: "Equipment module", c: [{ n: "Door lock S5 (safety)", t: "Control module" }] }] },
        { n: "MC02 – machining centre (M01)", t: "Work unit" },
        { n: "MC03 – machining centre (M01)", t: "Work unit" },
        { n: "POOL1 – pallet pool + stacker (M03)", t: "Work unit", c: [{ n: "Stacker travel axis", t: "Equipment module" }, { n: "Fork / transfer", t: "Equipment module" }] },
        { n: "LS1, LS2 – load stations (M04)", t: "Work unit" },
        { n: "WASH1 – washer (M10)", t: "Work unit" },
        { n: "CMM1 – measuring (M11)", t: "Work unit" },
        { n: "SAFE1 – cell safety controller (M18)", t: "Work unit" },
        { n: "CC1 – cell controller (M19)", t: "Work unit" }] },
      { n: "Work cell – Turning cell 2", t: "Work centre / cell" }] },
    { n: "Area – Assembly", t: "Area", c: [{ n: "Line – ASM1 (M07, M13, M14)", t: "Work centre / line" }] }] }] };

/* 5C PackML (ISA-TR88.00.02) state numbers and commands */
export const STATES = { Clearing: 1, Stopped: 2, Starting: 3, Idle: 4, Suspended: 5, Execute: 6, Stopping: 7, Aborting: 8, Aborted: 9, Holding: 10, Held: 11, Unholding: 12, Suspending: 13, Unsuspending: 14, Resetting: 15, Completing: 16, Complete: 17 };
export const CMDS = { Reset: 1, Start: 2, Stop: 3, Hold: 4, Unhold: 5, Suspend: 6, Unsuspend: 7, Abort: 8, Clear: 9 };
// grid positions for the diagram
export const POS = { Idle: [0, 1], Starting: [1, 1], Execute: [2, 1], Completing: [3, 1], Complete: [4, 1], Unholding: [1, 0], Held: [2, 0], Holding: [3, 0],
  Unsuspending: [1, 2], Suspended: [2, 2], Suspending: [3, 2], Resetting: [0, 3], Stopped: [1, 3], Stopping: [3, 3], Clearing: [1, 4], Aborted: [2, 4], Aborting: [3, 4] };
// [from, to, label]  (SC = state complete)
export const EDGES = [["Stopped", "Resetting", "Reset"], ["Resetting", "Idle", "SC"], ["Idle", "Starting", "Start"], ["Starting", "Execute", "SC"], ["Execute", "Completing", "SC"], ["Completing", "Complete", "SC"], ["Complete", "Resetting", "Reset"],
  ["Execute", "Holding", "Hold"], ["Holding", "Held", "SC"], ["Held", "Unholding", "Unhold"], ["Unholding", "Execute", "SC"],
  ["Execute", "Suspending", "Suspend"], ["Suspending", "Suspended", "SC"], ["Suspended", "Unsuspending", "Unsuspend"], ["Unsuspending", "Execute", "SC"],
  ["Stopping", "Stopped", "SC"], ["Aborting", "Aborted", "SC"], ["Aborted", "Clearing", "Clear"], ["Clearing", "Stopped", "SC"]];
export const MEANING = {
  Stopped: "Powered, not running, ready for Reset.", Resetting: "Homing, initialising, checking – then Idle.", Idle: "Ready, waiting for Start (e.g. next job from the cell controller).",
  Starting: "Start-up steps (spindle warm-up, close door, clamp).", Execute: "Doing its job (machining, moving, washing).", Completing: "Finishing steps (unclamp, open door).", Complete: "Job done – waits for Reset (next job).",
  Holding: "Going to Held because of an INTERNAL condition (material missing at the machine, operator request, tool missing).", Held: "Paused by an internal reason – Unhold when solved.", Unholding: "Resuming.",
  Suspending: "Going to Suspended because of an EXTERNAL condition (upstream starved / downstream blocked).", Suspended: "Waiting for others (no pallet, no space) – machine itself OK.", Unsuspending: "Resuming when the external condition is gone.",
  Stopping: "Controlled stop (end the cycle safely).", Aborting: "Fast stop on a fault or E-stop.", Aborted: "Stopped after a fault – needs Clear (fault removed, acknowledged).", Clearing: "Resetting faults – then Stopped.",
};
// which commands are allowed per mode
export const MODES = { Production: ["Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"], Maintenance: ["Reset", "Start", "Stop", "Hold", "Unhold", "Abort", "Clear"], Manual: ["Reset", "Start", "Stop", "Abort", "Clear"] };

/* 5D one pallet through all levels: lanes and steps [from, to, level, title, message] */
export const LANES = ["ERP", "MES", "Cell controller", "SCADA / HMI", "AS/RS · WMS", "Stacker PLC", "Load station", "MC02 CNC", "CMM"];
export const LANE_LVL = [4, 3, 2, 2, 3, 1, 1, 1, 1];
export const FLOWSTEPS = [
  [0, 1, 4, "Production order released", 'HTTP POST /mes/orders {"po":"4711","item":"CC20-MACH","qty":40,"due":"2026-11-20","routing":"R-CC20/C"}'],
  [1, 1, 3, "Schedule + kit check", "WO-4711-10 on group HMC · castings 40 in AS/RS ✓ · fixture F-CC20 ×2 ✓ · NC O2010 rev C released ✓ · tools T1–T38 in MC01/02 ✓ → release"],
  [1, 2, 3, "Job to the cell", 'job {"wo":"WO-4711-10","pallets":10,"fixture":"F-CC20","program":"O2010C","machines":["MC01","MC02"]}'],
  [2, 4, 2, "Material call", 'transport order {"item":"CC20-CAST","qty":4,"to":"LS1"} → AS/RS retrieves box B-2231'],
  [2, 5, 2, "Bring empty fixture pallet", 'Modbus/OPC UA write: Job.Cmd=MOVE, From=RACK-12, To=LS1, Pallet=P07 → PackML Execute → Done'],
  [6, 6, 1, "Operator clamps parts", "HMI LS1: 'Clamp 4 × CC20 on P07 (F-CC20)' · scan pallet RFID P07 · scan serials CC20-0812…0815 · clamp pressure OK · release button"],
  [6, 2, 1, "Pallet released", 'LS1 → cell: {"pallet":"P07","wo":"WO-4711-10","serials":["CC20-0812","CC20-0813","CC20-0814","CC20-0815"],"state":"READY"}'],
  [2, 5, 2, "Route to free machine", "MC02 Idle + tools OK + program present → stacker: MOVE P07 LS1 → MC02/APC"],
  [2, 7, 2, "Start machining", "Handshake: cell sets Request(program=O2010C, pallet=P07) → CNC Ready → Busy → PackML Execute"],
  [7, 3, 1, "Live status", "State=Execute · spindle 18 % load · tool T12 life 61 % · SCADA trend + historian; no alarm"],
  [7, 2, 1, "Cycle done", '{"machine":"MC02","pallet":"P07","result":"DONE","cycle_min":57.2,"parts_ok":4} → PackML Complete → Reset → Idle'],
  [2, 5, 2, "Pallet to washer / CMM", "Rule: 1 in 10 measured → P07 selected → MOVE MC02 → WASH1 → CMM1"],
  [8, 1, 1, "Measured values", '{"serial":"CC20-0812","bore_A":{"value":52.012,"tol":"52.000/+0.030","ok":true}, …} → SPC chart'],
  [6, 2, 1, "Unclamp, parts out", "LS1: unclamp 4 parts → box to AS/RS (finished WIP) · pallet P07 back to rack"],
  [2, 1, 2, "Confirmation to MES", 'confirm {"wo":"WO-4711-10","good":4,"scrap":0,"machine":"MC02","run_min":57.2} → genealogy per serial'],
  [1, 0, 3, "Confirmation to ERP", 'HTTP POST /erp/confirmations {"po":"4711","op":"10","yield":4,"scrap":0,"hours":0.95} → stock + cost updated'],
];

/* 5E architecture variants: [variant, how, + , −, when] */
export const VARIANTS = [
  ["Central cell controller (FMS host)", "One PC / server program decides routing, transport, job start for all modules; modules are 'servants' with a standard interface", "Clear responsibility, global optimisation, one place for logic", "Single point of failure (needs redundancy / manual fallback), special software", "Classic FMS with pallet pool, 3–10 machines"],
  ["Line / cell PLC as controller", "A (bigger) PLC runs the cell logic, talks to module PLCs and CNCs", "Robust, PLC skills in house, no PC software", "Limited data handling (orders, many part types), scheduling is simple rules", "Small cells, fixed flows, assembly lines"],
  ["Machine builder's FMS software", "Turnkey FMS manager from the machine / pallet pool supplier", "Proven, fast start, includes tool management", "Lock-in to one supplier, interfaces to MES / other brands limited", "FMC / FMS of one machine brand"],
  ["MES-driven (no separate cell controller)", "MES dispatches directly to machines and transport via OPC UA / REST", "Fewer layers, one data model", "MES must handle second-level timing, risky if network / server slow", "Simple cells with slow cycles, modern MES"],
  ["Distributed / service-oriented (skills, plug & produce)", "Each module offers skills (e.g. 'Machine(program)', 'Move(from,to)') via OPC UA; an orchestrator combines them; MTP (VDI 2658) idea", "Re-use, easy to add modules, vendor-neutral", "Standards still young in discrete manufacturing, needs good engineering", "New greenfield systems, frequent re-configuration"],
];
