/* FMS engineering – item 5 deep sections 5F–5M: data (fmse5x.js). Guide: docs/FMS system design/65_control_architecture.md. Examples only.
 * EX5 = copy of tools/fmse/examples/item5_examples.json – keep in sync (guide, tools/fmse/*.py and this page must give IDENTICAL results). */

/* copy of tools/fmse/examples/item5_examples.json – keep in sync */
export const EX5 = {
 "_note": "Shared worked-example inputs for FMS engineering item 5 (control architecture): guide docs/FMS system design/65_control_architecture.md, tools/fmse/*.py, web/fmse5x*.js. All values are EXAMPLES. Everything here is deterministic: guide, tools and web must give IDENTICAL results (including the cell-controller message log line by line).",
 "_formulas": {
  "packml": "state machine of ISA-TR88.00.02 exactly as in web/fmse5_data.js (STATES numbers, CMDS numbers, EDGES incl. SC; Stop allowed from every state except Stopped/Stopping/Aborting/Aborted/Clearing; Abort from every state except Aborting/Aborted); commands allowed per mode = web/fmse5_data.js MODES; a command not allowed in the current state or mode is REJECTED (state unchanged, log 'rejected'); 'SC' completes an acting state (rejected in a wait state); mode change only in Stopped, Idle, Aborted",
  "tag": "tag = site.area.cell.unit.equipment.signal joined by '.', exactly 6 parts; parts 1-5 only A-Z a-z 0-9; the last part (signal) only A-Z a-z 0-9 plus at most one '_' followed by a unit suffix (e.g. SpindleLoad_pct, Torque_Nm, LastCycle_s); unit = unit code + 2-digit number; total length <= max_len (48); signal must not start with a negative word (Not, No, Non, Un) followed by an upper-case letter or the end; duplicates are errors",
  "datablock_tags": "for every unit instance: the 15 standard data-block items of guide 66 section 8 (web/fmse6_data.js BLOCK names, e.g. Status.StateCurrent = group.item) -> 6-part tag site.area.cell.unit.group.item (the group is the 'equipment' part); plus the module part from web/fmse6_data.js EXTRA for that module code (names like NC.ProgramNo -> group NC); all must pass the tag rule",
  "availability": "A = MTBF/(MTBF+MTTR) ; series A = product ; parallel (redundant, independent) A = 1 - product(1-A_i) ; downtime h/year = (1-A)*hours_year",
  "mes_buffer": "MES outages: rate f per year = hours_year/(MTBF+MTTR) of the MES server, exponential outage duration with mean MTTR; a local job buffer of b hours keeps production running; P(outage > b) = exp(-b/MTTR); expected production loss h/year = f*MTTR*exp(-b/MTTR)",
  "alarm_kpi": "ISA-18.2 / EEMUA 191: alarm count per 10-min window (windows [0,600), [600,1200) ... over the shift); average alarms per hour per operator; peak 10-min count; flood window = more than 10 alarms in the window, % of windows in flood; priority distribution vs target low 80 % / medium 15 % / high 5 % (priority 3 = low, 2 = medium, 1 = high); chattering tag = same tag with >= 3 activations within any 60 s; top-5 bad actors by count (ties: first appearance); targets: <= 6 alarms/h average (~1 per 10 min) acceptable, <= 12 manageable",
  "cell_sim": "see cell_sim._rules"
 },
 "packml_scenarios": [{"name": "Normal job", "mode": "Production", "cmds": ["Reset", "SC", "Start", "SC", "SC", "SC", "Reset", "SC"], "_hint": "ends Idle"}, {"name": "Hold for missing material", "mode": "Production", "cmds": ["Reset", "SC", "Start", "SC", "Hold", "SC", "Unhold", "SC"], "_hint": "ends Execute"}, {"name": "Suspend (no pallet coming)", "mode": "Production", "cmds": ["Reset", "SC", "Start", "SC", "Suspend", "SC", "Unsuspend", "SC"], "_hint": "ends Execute"}, {"name": "E-stop and recovery", "mode": "Production", "cmds": ["Reset", "SC", "Start", "SC", "Abort", "SC", "Clear", "SC", "Reset", "SC"], "_hint": "ends Idle"}, {"name": "Wrong commands", "mode": "Production", "cmds": ["Start", "Reset", "SC", "Unhold"], "_hint": "Start and Unhold rejected, ends Idle"}, {"name": "Manual mode limits", "mode": "Manual", "cmds": ["Reset", "SC", "Start", "SC", "Hold", "Suspend", "Stop", "SC"], "_hint": "Hold and Suspend rejected, ends Stopped"}],
 "naming": {
  "site": "PLT1",
  "area": "MACH",
  "cell": "FMS1",
  "max_len": 48,
  "negative_words": ["Not", "No", "Non", "Un"],
  "units": [["M01", "MC", 3], ["M02", "APC", 3], ["M03", "POOL", 1], ["M04", "LS", 2], ["M06", "AGVST", 1], ["M08", "ASRS", 1], ["M09", "TOOL", 1], ["M10", "WASH", 1], ["M11", "CMM", 1], ["M12", "MARK", 1], ["M17", "UTIL", 1], ["M18", "SAFE", 1], ["M19", "CC", 1]],
  "test_tags": ["PLT1.MACH.FMS1.MC02.APC.ClampOK", "PLT1.MACH.FMS1.MC2.Door.Closed", "PLT1.MACH.FMS1.LS01.LightCurtain.NotOK", "PLT1.MACH.FMS1.POOL01.Fork.Pos-Ok", "PLT1.MACH.FMS1.WASH01.Tank.LevelHighHighAlarmWithDelay", "PLT1.MACH.FMS1.MC02.APC.ClampOK"],
  "iec81346_example": {"function": "=FMS1.MC02", "location": "+HALL1.A3", "product": "-KF1", "note": "IEC 81346 reference designation: = function aspect, + location aspect, - product aspect (letter codes per IEC 81346-2, e.g. KF control device, MA motor, BG sensor)"}
 },
 "availability": {
  "hours_year": 8760,
  "components": [["MES server", 8000, 4], ["Core switch", 50000, 2], ["Cell controller PC", 20000, 8], ["Cell PLC", 100000, 4], ["Safety PLC", 150000, 4], ["Machine PLC/CNC", 30000, 6]],
  "_components": "name, MTBF h, MTTR h",
  "variants": [{"name": "Single cell controller, single switch", "chain": [["Core switch", 1], ["Cell controller PC", 1], ["Cell PLC", 1]]}, {"name": "Redundant cell controller pair + switch ring", "chain": [["Core switch", 2], ["Cell controller PC", 2], ["Cell PLC", 1]]}],
  "_chain": "[component, number in parallel]; series of these blocks = the control chain that stops the whole cell",
  "mes_buffer_h": [0, 1, 2, 4, 8]
 },
 "alarm_log": {
  "shift_s": 28800,
  "operators": 1,
  "alarms": [[600, "MC01.CoolantLow", 3], [2100, "MC02.SpindleTemp", 2], [3600, "POOL1.ForkPos", 1], [5100, "LS1.LightCurtain", 3], [6600, "MC03.ToolLifeEnd", 3], [7800, "UTIL1.AirPressLow", 1], [7820, "MC01.ClampPressLow", 2], [7840, "MC02.ClampPressLow", 2], [7860, "MC03.ClampPressLow", 2], [7880, "POOL1.ClampPressLow", 2], [7900, "LS1.ClampPressLow", 2], [7920, "APC01.Fault", 2], [7940, "APC02.Fault", 2], [7960, "APC03.Fault", 2], [7980, "MC01.FeedHold", 3], [8000, "MC02.FeedHold", 3], [8020, "MC03.FeedHold", 3], [8040, "POOL1.Stopped", 3], [8060, "CC1.JobAborted", 3], [8100, "WASH1.TempLow", 3], [9600, "AGVST1.DockTimeout", 2], [11100, "CMM1.ProbeError", 3], [12600, "MC01.CoolantLow", 3], [14100, "MC02.SpindleTemp", 2], [15600, "POOL1.ForkPos", 1], [16200, "WASH1.LevelHigh", 3], [16212, "WASH1.LevelHigh", 3], [16224, "WASH1.LevelHigh", 3], [16236, "WASH1.LevelHigh", 3], [16248, "WASH1.LevelHigh", 3], [16260, "WASH1.LevelHigh", 3], [17100, "LS1.LightCurtain", 3], [18600, "MC03.ToolLifeEnd", 3], [20100, "WASH1.TempLow", 3], [21600, "AGVST1.DockTimeout", 2], [23100, "CMM1.ProbeError", 3], [24600, "MC01.CoolantLow", 3], [26100, "MC02.SpindleTemp", 2], [27600, "POOL1.ForkPos", 1]],
  "_cols": "t_s, tag, priority (1 high, 2 medium, 3 low)"
 },
 "cell_sim": {
  "T": 300,
  "load_min": 10,
  "move_min": 2,
  "job_buffer_max": 3,
  "pallets": ["P1", "P2", "P3", "P4", "P5", "P6"],
  "machines": ["MC01", "MC02", "MC03"],
  "jobs": [["J01", "O2010C", 30], ["J02", "O2020B", 40], ["J03", "O2010C", 30], ["J04", "O2030A", 40], ["J05", "O2010C", 30], ["J06", "O2020B", 40], ["J07", "O2010C", 30], ["J08", "O2030A", 40], ["J09", "O2010C", 30], ["J10", "O2020B", 40], ["J11", "O2010C", 30], ["J12", "O2020B", 40]],
  "events": [[50, "MES_DOWN", ""], [60, "FAULT", "MC02"], [80, "MES_UP", ""], [85, "REPAIRED", "MC02"]],
  "_rules": ["Time steps t = 0,1,2,...,T (minutes). In each step do 1-4 in this order.", "1 EXTERNAL: apply events with time t (sorted by time, then list order). FAULT: mark the machine faulted (it cannot be routed to); if it is executing, store remaining = end - t, clear end, state Held; otherwise keep its state (Idle or Complete). REPAIRED: clear the fault mark; if remaining stored, end = t + remaining, state Execute; otherwise keep the state. Log 'FAULT m <state>' / 'REPAIRED m <state>'. MES_DOWN / MES_UP switch the MES link (log MES_DOWN / MES_UP).", "2 COMPLETIONS with end == t, in this order: vehicle move, then machines by index, then load station. Vehicle move to a machine -> machine starts: state Execute, end = t + machining time of the job of the pallet, log START. Vehicle move to the load station -> pallet appended to the load-station queue (it will be unloaded + reloaded there), a confirmation CONF(job) is put in the outbox, log ARRIVE_LS. Machine end -> state Complete (pallet waits at the machine), log DONE, create vehicle request (pallet, to LS). Load station end -> pallet READY (holds its job), log LOADED.", "3 MES: if the MES link is up: send every confirmation in the outbox in order (log SEND_CONF), then if job buffer < job_buffer_max and jobs remain at MES: receive the next job into the buffer (log JOB) - at most ONE job per step. If down: nothing (confirmations stay in the outbox).", "4 DECISIONS in this order: (a) load station: if free and its queue is not empty and the job buffer is not empty -> take the first pallet of the queue and the first job of the buffer, end = t + load_min, log LOAD. If the queue is not empty, the buffer is empty AND the MES still has jobs left, count one starved minute (waiting for a job because of the MES link / buffer). (b) READY pallets (in READY order): if a machine is Idle (not reserved, not faulted), reserve the lowest-index such machine for the pallet and create a vehicle request (pallet, to that machine), log ROUTE. (c) vehicle: if free and requests exist, take the first request (FIFO by creation), end = t + move_min, log MOVE.", "A machine becomes Idle (and unreserved) again when the vehicle MOVE takes its pallet away (at the start of that move). Initial state: all pallets in the load-station queue in the listed order, machines Idle, vehicle free, job buffer empty, MES up, outbox empty.", "Log line format: 't EVENT object details' with t as integer minutes. KPIs at T: jobs started (START), jobs completed (DONE), confirmations sent, outbox at T, max outbox, starved minutes of the load station, machine Execute minutes per machine (minutes t in [start, end) while Execute), MC02 held minutes."],
  "events_b": [[50, "MES_DOWN", ""], [60, "FAULT", "MC02"], [85, "REPAIRED", "MC02"], [140, "MES_UP", ""]],
  "_events_b": "scenario B: same, but the MES is down 90 min (50-140) – longer than the 3-job buffer covers"
 },
 "_naming_changelog": "2026-11-15: max_len 40 -> 48, data-block tags 6-part (no '_' replacement), '_' allowed only for a unit suffix in the signal part"
};

/* ------------------------------------------------------------------ 5F ISA-95 operations model (IEC 62264-3) */
export const MOM_CAT = ["Production", "Maintenance", "Quality", "Inventory"];
// [activity, what it does (generic)]
export const MOM_ACT = [
  ["Resource management", "Knows which resources exist and whether they are available: people (qualification, shift), equipment (capability, state), material (lots), and reserves them for future work."],
  ["Definition management", "Keeps the 'how to make / maintain / test / store' definitions: routings, work masters, NC programs, test plans, maintenance procedures – with versions and release status."],
  ["Detailed scheduling", "Puts the released work into a time sequence per resource (machine, team, test lab, crane) with finite capacity – minutes to shifts horizon."],
  ["Dispatching", "Releases the next piece of work to the shop floor at the right moment (job to the cell, work order to the technician) and handles the queue when something changes."],
  ["Execution management", "Follows that the work is really done as defined: starts, steps, interlocks to the definition (right program, right tools), records deviations."],
  ["Data collection", "Gets the data from level 1/2 and from people: counts, times, states, measured values, consumption, alarms – with time stamp and context (job, serial, lot)."],
  ["Tracking", "Builds the history: where is each pallet / part / lot now, what happened to it (genealogy), which resources were used – the basis of traceability."],
  ["Performance analysis", "Turns the data into KPIs and reports: OEE, cycle time, MTBF / MTTR, first-pass yield, stock accuracy – and feeds them back to planning and improvement."],
];
// MOM_GRID[category][activity] = [FMS example, typical system]
export const MOM_GRID = [
  [ // Production
    ["Machine HMC02 available, fixture F-CC20 ×2 free, operator with LS qualification on shift 1", "MES resource module, shift plan"],
    ["Routing CC20/C: op 10 machining O2010C on HMC group, op 20 wash, op 30 measure 1 in 10", "MES / PLM (routing, NC program release)"],
    ["Sequence of jobs J01…J12 on the HMC group for the shift, set-up families grouped", "MES scheduler / APS"],
    ["Job J05 sent to the cell controller when the 3-job buffer has a free place", "MES dispatch list → cell controller"],
    ["Cell controller reports START MC01 P1 J01; MES checks the program revision matches the release", "MES execution + cell controller"],
    ["Cycle time 30.4 min, spindle load, good / scrap count from PackML Admin tags", "MES data collection, historian, OPC UA"],
    ["Serial CC20-0812 machined on HMC02 with tools T1–T38, pallet P1, operator 117", "MES genealogy"],
    ["OEE of the HMC group 71 %, top losses: waiting for pallet, tool change", "MES KPI dashboard"],
  ],
  [ // Maintenance
    ["Two maintenance technicians on call, spare spindle bearing set in stock", "CMMS (resource / spare parts)"],
    ["PM procedure 'HMC 2000 h service': steps, parts, 4 h, PackML Maintenance mode", "CMMS (maintenance plans)"],
    ["PM of HMC02 planned on Saturday shift 3 when the cell is idle", "CMMS + MES (capacity reservation)"],
    ["Work order WO-M-311 sent to the technician's tablet when HMC02 enters Held with alarm 1023", "CMMS work order dispatch"],
    ["Technician confirms each step; machine switched to Maintenance mode and back", "CMMS mobile app"],
    ["Spindle hours, axis travel km, alarm counts read from the CNC every hour", "CMMS condition monitoring / historian"],
    ["History of HMC02: 14 work orders, spindle changed 2025-03", "CMMS asset history"],
    ["MTBF 310 h, MTTR 1.6 h per machine; repeat failures list", "CMMS reports"],
  ],
  [ // Quality
    ["CMM1 calibrated until 2027-01, two qualified inspectors", "QMS / CAQ (gauge management)"],
    ["Test plan CC20: bore A Ø52 +0.030, 1 in 10 parts measured, SPC rules", "CAQ (inspection plans)"],
    ["Measure P1 on CMM1 after washing, first-part inspection after tool change", "CAQ + cell controller (routing rule)"],
    ["Inspection order sent to CMM1 with program CC20-M1 when the pallet arrives", "CAQ / cell controller"],
    ["Part NOK → pallet routed to rework place, job blocked in MES", "CAQ + MES (hold / release)"],
    ["Measured values from CMM1 (DMIS / Q-DAS file) with serial number", "CAQ data collection"],
    ["Which serials were measured, which were released by deviation", "CAQ / MES genealogy"],
    ["Cpk of bore A = 1.42, first-pass yield 98.6 %", "CAQ SPC reports"],
  ],
  [ // Inventory
    ["120 castings CC20 in AS/RS, 40 finished parts in buffer, 6 pallets", "WMS / ERP stock"],
    ["Storage rules: castings in box B, max. 2 boxes per place; pallet store places", "WMS master data"],
    ["Material call for J07 timed 20 min before the load station needs it", "WMS / MES"],
    ["Transport order AS/RS → LS1 released to the AGV fleet", "WMS + AGV fleet manager"],
    ["AGV docks at LS1, transfer confirmed by handshake", "AGV fleet manager / PLC"],
    ["Box B-2231 removed, 4 castings consumed by job J01", "WMS / MES consumption booking"],
    ["Where is box B-2231 now, which lot is on pallet P1", "WMS / MES tracking"],
    ["Stock accuracy 99.2 %, AS/RS utilisation 64 %", "WMS reports"],
  ],
];
// ISA-95 object models (IEC 62264-2): [model, what it holds, FMS example]
export const OBJ_MODELS = [
  ["Personnel", "Persons, personnel classes (qualifications), test of qualification", "Class 'LS operator FMS1' with valid training; person 117 on shift 1"],
  ["Equipment", "Equipment hierarchy (enterprise … work unit), equipment classes and properties, capability tests", "HMC02 of class 'HMC 500 mm', property MaxPartWeight = 400 kg"],
  ["Physical asset", "The real device with serial number and its mapping to the equipment role (for maintenance)", "Spindle unit SN 77812 currently installed in HMC02"],
  ["Material", "Material classes, definitions, lots, sublots (serials), material tests", "Material CC20-CAST, lot L2611-04, serial CC20-0812"],
  ["Process segment", "Business view of a production step: which resources it needs, how long", "Segment 'Machining CC20 op 10': 1 HMC, 1 fixture, 30 min"],
  ["Product definition", "How to make a product: product segments with parameters and BOM", "CC20-MACH: op 10 machine, op 20 wash, op 30 measure; NC O2010C"],
  ["Production capability", "What is available / committed / possible in a time range", "HMC group: 3 × 7.5 h free capacity on shift 1"],
  ["Production schedule", "Production requests sent from level 4 to level 3 (what, how many, when)", "PO 4711: 40 × CC20-MACH, due 2026-11-20"],
  ["Production performance", "Production responses back to level 4 (what was really made, used, how long)", "PO 4711: 12 good, 0 scrap, 7.0 machine hours"],
  ["Operations definition / schedule / performance / capability (2013 edition)", "Same four models generalised to maintenance, quality and inventory operations", "Maintenance request WO-M-311 and its response"],
  ["Work definition / work schedule / job order (Part 4)", "Level-3 internal models: work masters, work directives, job orders and job responses", "Job order J01 (work master O2010C) to the cell; job response with start / end"],
];
// B2M verbs (IEC 62264-5): [verb, meaning, typical answer, FMS example]
export const B2M_VERBS = [
  ["GET", "Ask for information about an object", "SHOW (with the data) or CONFIRM of error", "MES asks ERP: GetProductionSchedule for area MACH"],
  ["SHOW", "Send the requested information (answer to GET)", "–", "ERP answers ShowProductionSchedule with PO 4711"],
  ["PROCESS", "Ask the receiver to process a new object (create / execute it)", "ACKNOWLEDGE (accepted / rejected)", "ERP → MES ProcessProductionSchedule; MES → cell ProcessJobOrder J01"],
  ["ACKNOWLEDGE", "Answer to PROCESS: accepted, accepted with changes, or rejected", "–", "Cell → MES AcknowledgeJobOrder J01 accepted"],
  ["CHANGE", "Ask the receiver to change an existing object", "RESPOND", "MES → cell ChangeJobOrder J07: priority high"],
  ["CANCEL", "Ask the receiver to cancel an object (no answer expected)", "–", "MES → cell CancelJobOrder J12 (customer order cancelled)"],
  ["SYNC", "Publish a change to all subscribers (add / change / delete) – master data replication", "–", "PLM → MES SyncMaterialDefinition CC20-CAST rev D"],
  ["RESPOND", "Answer to CHANGE: accepted, accepted with modifications, rejected", "–", "Cell → MES RespondJobOrder J07 accepted"],
];

/* ------------------------------------------------------------------ 5G IEC 81346-2 letter codes (typical examples – check the edition your plant uses) */
export const IEC_CODES = [
  ["A", "–", "Two or more purposes (no main purpose)", "Combined module, e.g. a complete control box"],
  ["B", "BG", "Sensing position, presence, distance", "Proximity switch 'pallet present', limit switch"],
  ["B", "BP", "Sensing pressure", "Clamp pressure switch / transmitter"],
  ["B", "BT", "Sensing temperature", "Spindle temperature sensor, coolant temperature"],
  ["B", "BF", "Sensing flow", "Coolant flow monitor"],
  ["C", "CM", "Storing material (container)", "Coolant tank, washer tank"],
  ["F", "FC", "Protecting against over-current", "Miniature circuit breaker, fuse"],
  ["G", "GB", "Generating / storing electrical energy (battery)", "UPS battery of the cell controller"],
  ["K", "KF", "Processing signals (control device)", "PLC, safety relay, cell controller PC"],
  ["M", "MA", "Driving by electric motor", "Spindle motor, conveyor motor"],
  ["M", "MB", "Driving by electromagnetic force (solenoid)", "Solenoid of a door lock"],
  ["P", "PF", "Presenting information – signal / lamp", "Stack light, indicator lamp"],
  ["P", "PG", "Presenting information – display / meter", "HMI panel, pressure gauge display"],
  ["Q", "QA", "Switching electrical energy", "Contactor, motor circuit breaker"],
  ["Q", "QM", "Switching / controlling flow of fluids (valve)", "Clamp valve Y1, coolant valve"],
  ["S", "SF", "Manual operation – push button / switch", "Start button, mode selector, E-stop operator part"],
  ["T", "TA", "Transforming electrical energy", "Control transformer, power supply 24 V"],
  ["W", "WG", "Guiding / transporting signals (cable)", "Fieldbus cable, Ethernet cable"],
  ["X", "XD", "Connecting – terminals", "Terminal strip -XD1 in the cabinet"],
];

/* ------------------------------------------------------------------ 5H PackML in depth */
export const MOD_TYPES = ["HMC (machining centre)", "APC (pallet changer)", "Stacker / pallet pool", "Robot cell", "Washer", "Assembly station", "AGV station"];
// [state, meaning per module type (same order as MOD_TYPES)]
export const MOD_MEANING = [
  ["Stopped", ["Power on, axes not referenced or program reset", "Changer at rest, clamp state unknown", "Crane stopped, no transport order", "Robot in safe home, servo off", "Pumps off, heating off", "Station stopped, screwdriver disabled", "Dock conveyor stopped"]],
  ["Resetting", ["Reference axes, check tool magazine, warm-up check", "Home the changer, check clamp pressure", "Home travel / lift axes, read rack occupancy", "Servo on, move to home, check gripper", "Fill tank, heat to 55 °C", "Home axes, load recipe, check torque tool", "Home the transfer, check AGV link"]],
  ["Idle", ["Ready for next pallet + program", "Ready for a pallet change", "Waiting for a transport order", "Waiting for a part / pallet", "Hot and ready, door open", "Waiting for a carrier", "Ready to give / take a pallet"]],
  ["Starting", ["Close door, clamp, check program number", "Rotate to load position", "Accept order, plan route", "Load program, open gripper", "Close door, start pumps", "Clamp carrier, read RFID", "Wait for AGV docked signal"]],
  ["Execute", ["Machining the pallet (NC program running)", "Changing pallets", "Moving the pallet from place A to B", "Loading / unloading / deburring", "Washing cycle (spray, blow, dry)", "Screwing / pressing / testing", "Transferring the pallet"]],
  ["Completing", ["Program end, spindle stop, open door", "Unclamp check, return to rest", "Put down, retract fork", "Return to home", "Drip time, open door", "Write result, unclamp", "Confirm transfer done"]],
  ["Complete", ["Pallet finished – waits for pick-up (Reset → Idle)", "Change done", "Order done", "Cycle done", "Batch washed", "Part OK / NOK result ready", "Transfer done"]],
  ["Held", ["Tool missing / broken, coolant low – internal", "Clamp pressure low", "Fork sensor fault waiting for operator", "Gripper lost part", "Tank level low", "Screw feeder empty", "Dock sensor dirty"]],
  ["Suspended", ["No pallet coming (starved) – machine OK", "Machine not ready to take the pallet", "Destination place occupied (blocked)", "No part at input conveyor", "Downstream CMM full", "No carrier upstream / downstream full", "No AGV available"]],
  ["Aborted", ["E-stop or axis drive fault – needs Clear", "Collision sensor", "Overtravel, crane in emergency stop", "Collision detected, safety stop", "Over-temperature trip", "Light curtain stop during motion", "AGV collision bumper"]],
];
// [group, tag, type, meaning]
export const PACKTAGS = [
  ["Command", "Command.UnitMode", "INT", "Requested mode (1 Production, 2 Maintenance, 3 Manual, user modes > 3)"],
  ["Command", "Command.UnitModeChangeRequest", "BOOL", "Rising edge applies UnitMode"],
  ["Command", "Command.MachSpeed", "REAL", "Requested speed (parts/min or % of nominal)"],
  ["Command", "Command.CntrlCmd", "INT", "Command 1 Reset … 9 Clear (5C table)"],
  ["Command", "Command.CmdChangeRequest", "BOOL", "Rising edge executes CntrlCmd"],
  ["Command", "Command.Parameter[n]", "ID, Name, Unit, Value", "Machine parameters (e.g. wash temperature)"],
  ["Command", "Command.ProdRemoteInterface[n]", "Number, ControlCmdNumber, CmdValue, Parameter[]", "Hand-over to an upstream / downstream unit (job number, program)"],
  ["Status", "Status.UnitModeCurrent", "INT", "Current mode"],
  ["Status", "Status.UnitModeRequested / UnitModeChangeInProcess", "BOOL", "Mode change accepted / in progress"],
  ["Status", "Status.StateCurrent", "INT", "Current state 1–17"],
  ["Status", "Status.StateRequested / StateChangeInProcess", "INT / BOOL", "Target state of a running transition"],
  ["Status", "Status.MachSpeed / CurMachSpeed", "REAL", "Set and actual speed"],
  ["Status", "Status.EquipmentInterlock.Blocked / Starved", "BOOL", "Downstream blocked / upstream starved (reason for Suspended)"],
  ["Status", "Status.Parameter[n] / RemoteParam[n]", "struct", "Actual values of parameters"],
  ["Admin", "Admin.Alarm[n] / AlarmHistory[n]", "ID, Value, Message, TimeEvent, TimeAck", "Active alarms and history (same numbering in every module)"],
  ["Admin", "Admin.Warning[n]", "same as Alarm", "Warnings (no stop)"],
  ["Admin", "Admin.StopReason", "ID, Value", "First-out reason of the last stop – for loss analysis"],
  ["Admin", "Admin.ProdProcessedCount[n] / ProdDefectiveCount[n]", "ID, Name, Unit, Count, AccCount", "Good / bad counters for OEE"],
  ["Admin", "Admin.ModeCurrentTime[m] / ModeCumulativeTime[m]", "DINT", "Time in each mode"],
  ["Admin", "Admin.StateCurrentTime[m][s] / StateCumulativeTime[m][s]", "DINT", "Time in each state per mode – OEE time model directly"],
  ["Admin", "Admin.MachDesignSpeed", "REAL", "Ideal speed (ideal cycle time) for the performance rate"],
  ["Admin", "Admin.PACDateTime", "DateTime", "Controller clock (time sync check)"],
];
// [state, OEE loss class, comment]
export const STATE_OEE = [
  ["Execute", "Productive (run time)", "Speed loss if CurMachSpeed < MachDesignSpeed; quality loss from ProdDefectiveCount"],
  ["Starting / Completing", "Run time (part of the cycle) or minor stop", "Count as cycle when it is in the ideal cycle time; otherwise minor stop"],
  ["Idle", "Availability loss – waiting (no job, no operator)", "Planned idle (no order) is outside planned time"],
  ["Suspended / Suspending / Unsuspending", "Starved / blocked (system loss, not the machine)", "Shows the transport / buffer problem – key KPI for the cell controller"],
  ["Held / Holding / Unholding", "Availability loss – internal stop (minor stop if short)", "Reason from Admin.StopReason (tool missing, clamp pressure)"],
  ["Aborting / Aborted / Clearing", "Availability loss – breakdown", "MTBF / MTTR are calculated from these periods"],
  ["Stopped / Stopping / Resetting", "Availability loss – stopped (or planned stop if not in planned time)", "Set-up often done in Stopped / Manual mode → set-up loss"],
  ["Complete", "Availability loss – waiting for pick-up (blocked)", "Long Complete times show a slow vehicle / stacker"],
  ["Maintenance / Manual mode (any state)", "Planned maintenance / set-up", "Mode times from Admin.ModeCumulativeTime"],
];
export const ST_SKELETON = `(* PackML state machine – Structured Text skeleton (IEC 61131-3). Preview of items 9 / 10.
   One function block per unit; numbers = ISA-TR88.00.02 state and command numbers. *)
FUNCTION_BLOCK FB_PackML
VAR_INPUT
  CntrlCmd      : INT;     (* 1 Reset 2 Start 3 Stop 4 Hold 5 Unhold 6 Suspend 7 Unsuspend 8 Abort 9 Clear *)
  CmdChange     : BOOL;    (* rising edge executes CntrlCmd *)
  UnitMode      : INT;     (* 1 Production 2 Maintenance 3 Manual *)
  ModeChange    : BOOL;
  SC            : BOOL;    (* state complete from the unit sequence (acting states) *)
END_VAR
VAR_OUTPUT
  StateCurrent  : INT := 2;   (* Stopped *)
  ModeCurrent   : INT := 1;
  CmdRejected   : BOOL;
END_VAR
VAR
  rCmd, rMode   : R_TRIG;
  cmdOK         : BOOL;
END_VAR

rCmd(CLK := CmdChange);  rMode(CLK := ModeChange);
CmdRejected := FALSE;

(* mode change only in Stopped (2), Idle (4), Aborted (9) *)
IF rMode.Q THEN
  IF StateCurrent = 2 OR StateCurrent = 4 OR StateCurrent = 9 THEN ModeCurrent := UnitMode;
  ELSE CmdRejected := TRUE; END_IF
END_IF

IF rCmd.Q THEN
  (* commands allowed in this mode: Manual = Reset, Start, Stop, Abort, Clear *)
  cmdOK := (ModeCurrent = 1) OR
           (ModeCurrent = 2 AND CntrlCmd <> 6 AND CntrlCmd <> 7) OR
           (ModeCurrent = 3 AND (CntrlCmd = 1 OR CntrlCmd = 2 OR CntrlCmd = 3 OR CntrlCmd = 8 OR CntrlCmd = 9));
  IF NOT cmdOK THEN CmdRejected := TRUE;
  ELSIF CntrlCmd = 8 AND StateCurrent <> 8 AND StateCurrent <> 9 THEN StateCurrent := 8;        (* Abort → Aborting *)
  ELSIF CntrlCmd = 3 AND NOT (StateCurrent = 2 OR StateCurrent = 7 OR StateCurrent = 8
                              OR StateCurrent = 9 OR StateCurrent = 1) THEN StateCurrent := 7;  (* Stop → Stopping *)
  ELSE
    CASE StateCurrent OF
      2:  IF CntrlCmd = 1 THEN StateCurrent := 15; ELSE CmdRejected := TRUE; END_IF   (* Stopped  -Reset-> Resetting *)
      4:  IF CntrlCmd = 2 THEN StateCurrent := 3;  ELSE CmdRejected := TRUE; END_IF   (* Idle     -Start-> Starting *)
      6:  IF CntrlCmd = 4 THEN StateCurrent := 10;                                    (* Execute  -Hold->  Holding *)
          ELSIF CntrlCmd = 6 THEN StateCurrent := 13; ELSE CmdRejected := TRUE; END_IF (*        -Suspend-> Suspending *)
      11: IF CntrlCmd = 5 THEN StateCurrent := 12; ELSE CmdRejected := TRUE; END_IF   (* Held     -Unhold-> Unholding *)
      5:  IF CntrlCmd = 7 THEN StateCurrent := 14; ELSE CmdRejected := TRUE; END_IF   (* Suspended -Unsuspend-> *)
      17: IF CntrlCmd = 1 THEN StateCurrent := 15; ELSE CmdRejected := TRUE; END_IF   (* Complete -Reset-> Resetting *)
      9:  IF CntrlCmd = 9 THEN StateCurrent := 1;  ELSE CmdRejected := TRUE; END_IF   (* Aborted  -Clear-> Clearing *)
    ELSE CmdRejected := TRUE;
    END_CASE
  END_IF
END_IF

(* acting states finish with SC from the unit's own sequence *)
IF SC THEN
  CASE StateCurrent OF
    15: StateCurrent := 4;   3: StateCurrent := 6;   6: StateCurrent := 16;  16: StateCurrent := 17;
    10: StateCurrent := 11; 12: StateCurrent := 6;  13: StateCurrent := 5;  14: StateCurrent := 6;
     7: StateCurrent := 2;   8: StateCurrent := 9;   1: StateCurrent := 2;
  END_CASE
END_IF
END_FUNCTION_BLOCK`;

/* ------------------------------------------------------------------ 5I ISA-88 procedural model */
// tree nodes: [level, name, detail]
export const S88_FMS = { n: "Procedure: Machine crankcase CC20 – pallet with 4 parts (job J01)", t: "Procedure", d: "the whole job of the cell for one pallet", c: [
  { n: "Unit procedure: Load at LS1", t: "Unit procedure", d: "unit = load station LS01", c: [
    { n: "Operation: Prepare fixture", t: "Operation", c: [{ n: "Phase: Check fixture F-CC20 (RFID)", t: "Phase" }, { n: "Phase: Clean locators", t: "Phase" }] },
    { n: "Operation: Clamp parts", t: "Operation", c: [{ n: "Phase: Scan 4 serials", t: "Phase" }, { n: "Phase: Clamp + pressure check 60 bar", t: "Phase" }, { n: "Phase: Release pallet", t: "Phase" }] }] },
  { n: "Unit procedure: Machine on HMC (MC01)", t: "Unit procedure", d: "unit = machining centre; equipment modules APC, spindle, tool magazine", c: [
    { n: "Operation: Pallet in", t: "Operation", c: [{ n: "Phase: APC change", t: "Phase" }, { n: "Phase: Clamp check", t: "Phase" }] },
    { n: "Operation: Machining op 10", t: "Operation", c: [{ n: "Phase: Probe datum (O9810)", t: "Phase" }, { n: "Phase: Run NC program O2010C (30 min)", t: "Phase" }, { n: "Phase: Tool life check", t: "Phase" }] },
    { n: "Operation: Pallet out", t: "Operation", c: [{ n: "Phase: Blow off chips", t: "Phase" }, { n: "Phase: APC change", t: "Phase" }] }] },
  { n: "Unit procedure: Wash (WASH01)", t: "Unit procedure", c: [{ n: "Operation: Wash cycle", t: "Operation", c: [{ n: "Phase: Spray 55 °C 3 min", t: "Phase" }, { n: "Phase: Blow dry 2 min", t: "Phase" }] }] },
  { n: "Unit procedure: Measure 1 in 10 (CMM01)", t: "Unit procedure", c: [{ n: "Operation: Measure", t: "Operation", c: [{ n: "Phase: Temperature soak", t: "Phase" }, { n: "Phase: Run CMM program CC20-M1", t: "Phase" }, { n: "Phase: Send result to CAQ", t: "Phase" }] }] },
  { n: "Unit procedure: Unload at LS1", t: "Unit procedure", c: [{ n: "Operation: Unclamp + parts out", t: "Operation", c: [{ n: "Phase: Unclamp", t: "Phase" }, { n: "Phase: Parts to box, book to stock", t: "Phase" }] }] }] };
export const S88_ASM = { n: "Procedure: Assemble compressor VC20", t: "Procedure", d: "one carrier on the assembly line ASM1", c: [
  { n: "Unit procedure: Station 10 – crankshaft", t: "Unit procedure", c: [
    { n: "Operation: Insert bearings", t: "Operation", c: [{ n: "Phase: Press bearing 12 kN, force–distance check", t: "Phase" }] },
    { n: "Operation: Fit crankshaft", t: "Operation", c: [{ n: "Phase: Pick + place", t: "Phase" }, { n: "Phase: Turn-by-hand torque check", t: "Phase" }] }] },
  { n: "Unit procedure: Station 20 – piston + rod", t: "Unit procedure", c: [
    { n: "Operation: Fit pistons", t: "Operation", c: [{ n: "Phase: Oil rings", t: "Phase" }, { n: "Phase: Insert 2 pistons", t: "Phase" }] },
    { n: "Operation: Tighten rod caps", t: "Operation", c: [{ n: "Phase: Screw 4 × M8, 25 Nm + 60°", t: "Phase" }, { n: "Phase: Store torque / angle curves", t: "Phase" }] }] },
  { n: "Unit procedure: Station 30 – leak test", t: "Unit procedure", c: [{ n: "Operation: Leak test", t: "Operation", c: [{ n: "Phase: Fill 6 bar", t: "Phase" }, { n: "Phase: Stabilise 20 s, measure 10 s", t: "Phase" }, { n: "Phase: OK / NOK, label", t: "Phase" }] }] }] };
// recipe types: [type, contains, owner, FMS / assembly example]
export const RECIPES = [
  ["General recipe", "Process for a product independent of the site: steps, materials, quality targets", "Engineering (company)", "CC20 crankcase: rough, finish bores, wash, measure – any machining plant"],
  ["Site recipe", "General recipe adapted to the site: local material, language, units, regulations", "Site engineering", "Plant 1 uses castings from foundry A, tolerances to the plant standard"],
  ["Master recipe", "For one equipment type / cell: unit procedures, operations, phases with default parameters", "Process / manufacturing engineer", "FMS1 master: NC program O2010C rev C, fixture F-CC20, wash 55 °C, CMM program CC20-M1, 1 in 10"],
  ["Control recipe", "Copy of the master for ONE job, with actual equipment and actual values", "Created by MES / cell controller per job", "Job J01: pallet P1 on MC01, serials CC20-0812…0815, start 12, tool T12 replaced"],
];
// mapping of master recipe parameters to an FMS: [parameter, master value, where in the FMS, who uses it]
export const RECIPE_MAP = [
  ["NC program + revision", "O2010C rev C", "DNC / NC program management", "CNC of the HMC (phase 'Run NC program')"],
  ["Fixture", "F-CC20 (2 pieces)", "Fixture / pallet master data", "Load station HMI, cell controller routing"],
  ["Clamp pressure", "60 bar ± 5", "Parameter set of the LS / fixture", "LS PLC (phase 'Clamp + pressure check')"],
  ["Tool list", "T1–T38, sister tools for T12", "Tool management", "Cell controller (routing check), CNC tool life"],
  ["Wash parameters", "55 °C, spray 3 min, dry 2 min", "Washer recipe number 7", "Washer PLC (Command.Parameter[ ])"],
  ["Inspection rule", "1 in 10, program CC20-M1", "CAQ test plan", "Cell controller routing, CMM"],
  ["Assembly torque", "25 Nm + 60°, window 22–30 Nm", "Assembly recipe (screw program 3)", "Screwdriver controller (Asm.RecipeNo)"],
];

/* ------------------------------------------------------------------ 5L alarm management */
export const ALARM_LIFE = [
  ["A", "Philosophy", "Write the alarm philosophy: what is an alarm (needs an operator action), priorities, colours, KPIs, roles"],
  ["B", "Identification", "Collect candidate alarms from HAZOP / FMEA, P&IDs, machine manuals, incidents"],
  ["C", "Rationalisation", "For every alarm: cause, consequence, operator action, time to respond, priority, set-point – remove alarms without an action"],
  ["D", "Detailed design", "Deadbands, on/off delays, suppression (e.g. when the machine is in Manual or Stopped), HMI display"],
  ["E", "Implementation", "Program in PLC / SCADA, test (FAT / SAT), train the operators"],
  ["F", "Operation", "Operators respond with the documented action; shelving with time limit"],
  ["G", "Maintenance", "Out-of-service handling when a sensor is repaired; testing of the alarm"],
  ["H", "Monitoring & assessment", "Weekly KPIs: alarms/h, floods, top bad actors, chattering, stale alarms (this card)"],
  ["I", "Management of change", "No new alarm or set-point change without rationalisation and approval"],
  ["J", "Audit", "Yearly check that the philosophy is followed and KPIs are met"],
];
export const CONSEQ = ["Minor (no loss, small rework)", "Moderate (scrap, < 1 h stop)", "Major (machine damage, > 1 h stop)", "Severe (injury risk*, large damage)"];
export const TRESP = ["> 30 min", "10 – 30 min", "3 – 10 min", "< 3 min"];
// PRIO_M[time][consequence]: 0 = no alarm (event / message only), 3 low, 2 medium, 1 high
export const PRIO_M = [[0, 0, 3, 3], [0, 3, 3, 2], [3, 3, 2, 1], [3, 2, 1, 1]];
// rationalisation template [tag, description, cause, consequence, operator action, time to respond, priority, set-point / delay, suppression]
export const RAT_HEAD = ["Tag", "Alarm text", "Cause", "Consequence if no action", "Operator action", "Time to respond", "Priority", "Set-point / delay", "Suppressed when"];
export const RAT_ROWS = [
  ["UTIL1.AirPressLow", "Compressed air pressure low", "Compressor fault, leak, valve closed", "All clamps lose pressure, parts move – scrap, crash", "Stop loading, check compressor room, call maintenance", "< 3 min", "1 high", "< 5.0 bar, 2 s on-delay", "Cell in Stopped"],
  ["MC01.ClampPressLow", "MC01 clamp pressure low", "Air pressure low or leak at fixture", "Part moves in machining", "None separately – consequence of AirPressLow (suppress)", "–", "suppressed", "< 55 bar", "UTIL1.AirPressLow active"],
  ["WASH1.LevelHigh", "Washer tank level high", "Fill valve leaking / sensor wet", "Overflow onto floor", "Check fill valve, close manual valve", "10 – 30 min", "3 low", "> 90 %, 10 s on-delay + 2 % deadband", "Washer in Manual"],
  ["MC03.ToolLifeEnd", "MC03 tool life end T12", "Planned wear", "None – sister tool used", "Message only (tool list), no alarm", "–", "no alarm", "–", "–"],
];
// ISA-101 display hierarchy: [level, name, content, FMS example]
export const ISA101 = [
  [1, "Overview (area / cell)", "Whole area at one glance: KPIs, state of every unit, only abnormal things in colour", "FMS1 overview: 3 HMCs, pool, LS, washer, CMM as boxes with state and OEE; outbox and MES link"],
  [2, "Unit / process display", "One unit or sub-area with the main values for normal operation", "HMC02: state, job, pallet, program, spindle load, tool life, alarms of this unit"],
  [3, "Detail display", "Detail of one equipment module for diagnosis", "HMC02 APC: clamp pressure trend, valve states, handshake bits"],
  [4, "Support / diagnostic", "Help pages, interlock diagrams, manuals, procedures", "Alarm 1023 help: cause, action, wiring diagram page =FMS1.MC02+HALL1.A3-KF1"],
];

/* ------------------------------------------------------------------ 5M robustness */
export const RESTART = [
  "Read the last saved state of the cell controller (database / journal) – jobs, pallets, reservations.",
  "Read the REAL state of every module (PackML state, pallet ID by RFID, part present) – the real world wins over the database.",
  "Compare: pallet positions, jobs in progress, jobs in the buffer, unsent confirmations (outbox).",
  "Pallets with unknown status → block and ask the operator (HMI dialog with photo / RFID) – never guess.",
  "Jobs interrupted in Execute → mark 'interrupted', decide: restart program at block, rework, or scrap (rule per part type).",
  "Re-send the outbox (idempotent – the MES ignores duplicates by message ID).",
  "Ask the MES for the job list (GET) and compare with the local buffer (cancelled / changed jobs).",
  "Release the cell step by step: first transport in Manual, then Production mode.",
  "Write a restart report (what was found, what was corrected) for the shift log.",
];
export const MSG_HEAD = ["ID", "Message", "From → To", "Trigger", "Content (fields)", "Protocol", "Time-out / retry", "Idempotency key", "Answer"];
export const MSG_ROWS = [
  ["M01", "ProcessJobOrder", "MES → Cell", "buffer has free place", "job ID, work master, qty, due, priority", "HTTP POST JSON", "5 s, 3 retries, then alarm", "job ID", "AcknowledgeJobOrder"],
  ["M02", "AcknowledgeJobOrder", "Cell → MES", "job stored", "job ID, accepted / rejected, reason", "HTTP response", "–", "job ID", "–"],
  ["M03", "JobResponse (confirmation)", "Cell → MES", "pallet back at LS", "msg ID, job ID, machine, start, end, good, scrap", "HTTP POST via outbox", "10 s, retry until sent", "msg ID", "HTTP 200 / duplicate"],
  ["M04", "TransportOrder", "Cell → Stacker PLC", "ROUTE decision", "order no, pallet, from, to", "Modbus TCP block", "2 s handshake, 1 retry", "order no", "PackML Execute → Complete"],
  ["M05", "StartJob", "Cell → CNC", "pallet at machine", "program no, pallet ID, job ID", "Modbus TCP block", "3 s for Ready", "job ID", "Busy, then Done"],
  ["M06", "Heartbeat", "Cell ↔ every module", "every 1 s", "counter + 1", "Modbus register", "3 s → fault", "–", "partner counter"],
  ["M07", "StateChange", "Module → Cell", "PackML state change", "state, mode, alarm no", "polled 200 ms", "–", "–", "–"],
];
export const USES5 = {
  F: [["Machining FMS", "The MOM grid is used as a checklist in the MES tender: for each of the 32 cells the bidder states 'standard / configured / custom / not covered'."],
    ["Pharma packaging", "Quality and production activities are tightly linked (batch record); the grid shows where electronic signatures are needed."],
    ["Warehouse", "Inventory row dominates: WMS covers definition, scheduling, dispatching; MES only uses tracking and data collection."],
    ["Machine builder", "A supplier of a turnkey FMS shows which activities its FMS manager covers (dispatching, execution, data collection) and which stay in the customer's MES."]],
  G: [["New FMS", "The tag list of all 18 unit instances (297 tags) is generated before PLC programming – PLC, SCADA and MES teams work with the same names from day one."],
    ["Retrofit", "Old tags like 'M2_DOOR_CL' are mapped to the new names in a table; the validator finds non-standard names in the export of the old PLC."],
    ["Electrical design", "IEC 81346 designations =FMS1.MC02+HALL1.A3-KF1 appear in the circuit diagram, on the label in the cabinet and in the HMI help page."],
    ["MES integration", "The equipment ID in the MES is the tag prefix PLT1.MACH.FMS1.MC02 – no mapping table needed."]],
  H: [["Machine purchase", "The tender demands PackML states + the standard data block; at FAT the scenarios 1–6 are tested with a test PLC / script."],
    ["Packaging line", "PackML was born here: filler, capper, labeller all share the states – the line controller only needs one interface."],
    ["Robot cell", "The robot program is split into Starting / Execute / Completing routines; Held is used for 'gripper lost part'."],
    ["OEE", "StateCumulativeTime gives the OEE time model without extra logic in the MES."]],
  I: [["Machining", "Master recipe = NC program + fixture + parameter set; control recipe = job with actual machine, pallet, serials."],
    ["Assembly", "Screw programs, press curves and test limits are phases with parameters; a variant change is a new master recipe, not new PLC code."],
    ["Heat treatment", "Classic ISA-88 batch: furnace programs (temperature profile) are recipes; the load is the batch."],
    ["Food / chemicals", "The origin of ISA-88: units (reactors), phases (dose, heat, stir), recipes managed by a batch server."]],
  J: [["Cell controller FAT", "The log of the simulation is the expected log; the real cell controller fed with the same events must produce the same lines (regression test)."],
    ["MES outage planning", "Scenario B shows that a 3-job buffer covers only part of a 90 min outage (52 starved minutes); the buffer size is chosen from the expected MES outage (5K)."],
    ["Operator training", "Step through the log and explain every decision: why J04 waits, why MC02 is not routed while faulted."],
    ["Digital twin", "The same rules drive the 3D / 2D twin of the cell; the twin is validated against this log."]],
  K: [["Architecture decision", "Single vs redundant cell controller: about 4.2 h vs 0.35 h control downtime per year – compare with the cost of the redundancy."],
    ["MES buffer sizing", "A 2 h local job buffer reduces the expected MES-caused loss from 4.4 h to 2.7 h per year; 8 h to 0.6 h."],
    ["Network design", "A switch ring (two paths) removes the switch from the critical chain."],
    ["Service contract", "MTTR of 8 h for the cell PC (no spare on site) dominates – a spare PC on the shelf cuts it to 1 h."]],
  L: [["Commissioning", "Alarm KPIs of the first weeks show floods from consequential alarms (air pressure → 13 alarms in 5 min) – suppression is added."],
    ["Daily operation", "Top-5 bad actors are reviewed every week by the shift leader and maintenance."],
    ["Machine purchase", "The specification demands ISA-18.2 priorities, first-out alarm and suppression in Manual mode from the supplier."],
    ["HMI design", "ISA-101 level 1 overview shows only abnormal states in colour – grey is normal."]],
  M: [["MES interface", "Each confirmation has a message ID; the MES stores processed IDs – re-sending after a restart creates no double booking."],
    ["PLC handshake", "Every handshake step has a time-out and a defined error state – no endless waiting."],
    ["Pallet pool", "The cell controller limits pallets in the system to places − 1, so the stacker can always move."],
    ["Power failure", "Restart checklist is part of the operating manual and tested at SAT."]],
};
