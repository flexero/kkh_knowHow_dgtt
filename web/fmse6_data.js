/* FMS engineering – item 6 data: communication.  Guide: docs/FMS system design/66_communication.md. Typical values / examples. */

/* 6A protocols: [name, level, type, typical cycle / latency, data model, ecosystem, use in an FMS, + , −] */
export const PROTO = [
  ["IO-Link (IEC 61131-9)", "L0–1", "Point-to-point sensor / actuator link (3-wire, 24 V)", "2–10 ms", "IODD device description, parameters + diagnosis", "All brands (master on any fieldbus)", "Smart sensors, valve terminals, RFID heads at stations", "Parameters + diagnosis down to the sensor, cheap cable", "Not a network; max 20 m"],
  ["PROFINET RT / IRT", "L1", "Cyclic real-time Ethernet (provider / consumer)", "RT 1–10 ms, IRT 0.25–1 ms", "GSDML device file, slots / modules", "Siemens and many others (PI)", "PLC ⇄ remote IO, drives, valve terminals, robots, other PLCs", "Very wide device choice, diagnostics, PROFIsafe", "Engineering mostly in vendor tool; IRT needs special switches"],
  ["EtherCAT", "L1", "Cyclic, frame passes through all slaves ('on the fly')", "50 µs – 1 ms", "ESI file, CoE (CANopen objects)", "Beckhoff and many others (ETG)", "Fast motion, many axes, high-speed IO, test benches", "Very fast, cheap slaves, exact sync (distributed clocks)", "Line topology sensitive to cable breaks (use ring), not for plant-wide network"],
  ["EtherNet/IP (CIP)", "L1", "Cyclic implicit IO + explicit messaging", "1–100 ms", "EDS file, CIP objects", "Rockwell and many others (ODVA)", "Same as PROFINET in Rockwell plants", "Standard TCP/UDP, CIP Safety, CIP Motion", "Multicast needs IGMP-snooping switches"],
  ["Modbus TCP", "L1–2", "Client / server request-response, registers", "10–100 ms per transaction", "None – register map document per device", "Every vendor, open, free", "Simple PLC ⇄ PLC, PLC ⇄ gateway, energy meters, older devices, low-cost cells", "Simple, everywhere, easy to debug", "No data model, no security, polling only, word-order confusion"],
  ["CC-Link IE (TSN)", "L1", "Cyclic real-time Ethernet", "0.1–10 ms", "CSP+ file", "Mitsubishi and partners (CLPA)", "Mitsubishi PLC plants", "Fast, TSN option", "Mainly Asia / Mitsubishi ecosystem"],
  ["PROFIsafe / FSoE / CIP Safety", "L1 (safety)", "Safety layer on top of the fieldbus ('black channel')", "Same as bus + watchdog", "Safety telegram with CRC, counter, watchdog", "With PROFINET / EtherCAT / EtherNet/IP", "Safety IO, door locks, light curtains, safe drive functions over the network", "Fewer wires, safe diagnostics", "Safety PLC + certified devices; validation effort"],
  ["OPC UA client / server (IEC 62541)", "L2–3", "Client / server with information model, subscriptions", "50 ms – seconds", "Object model, companion specs (umati machine tools, robotics, PackML, Euromap 77 …)", "Vendor-neutral (OPC Foundation)", "PLC / CNC ⇄ cell controller, SCADA, MES; machine data", "Semantic data model, built-in security (certificates, encryption)", "Engineering of models, performance limits on small PLCs"],
  ["OPC UA PubSub (+ TSN)", "L1–3", "Publish / subscribe over UDP or MQTT", "ms (UDP / TSN) – s (MQTT)", "OPC UA model", "OPC Foundation, Field Level Communications (FLC)", "Controller ⇄ controller, future field level", "One model from field to cloud", "Still young at field level"],
  ["MTConnect (ANSI/MTC1.4)", "L2–3", "Read-only HTTP / XML (or JSON) agent", "~1 s", "Machine-tool data dictionary (axes, spindle, program, alarms)", "Machine-tool makers (US origin)", "Machine monitoring, OEE from CNCs", "Same vocabulary for all CNC brands, easy", "Read-only (no commands)"],
  ["umati (OPC UA for Machine Tools)", "L2–3", "OPC UA companion spec", "~1 s", "MachineTool, Monitoring, Production, Notification objects", "VDW / VDMA, European machine tools", "CNC data to MES / cell controller", "Standard model, secure, can be written to in later versions", "Not every CNC supports it yet"],
  ["MQTT (+ Sparkplug B)", "L2–4", "Publish / subscribe via a broker (TCP)", "100 ms – s", "Free topics (Sparkplug adds a model + state)", "IT / IoT world, all clouds", "Data collection to historian, dashboards, cloud, unified namespace", "Light, many consumers, firewall-friendly (one outgoing connection)", "No real-time, needs a broker, model only with Sparkplug / conventions"],
  ["HTTP / REST (JSON)", "L3–4", "Request / response (+ SSE / WebSocket for push)", "100 ms – s", "Own API (OpenAPI document)", "IT standard", "MES ⇄ ERP, MES ⇄ WMS / AGV fleet / printers, web HMIs", "Every IT person knows it, easy testing", "Not for control loops; design the API carefully"],
  ["B2MML / ISA-95 messages", "L3–4", "XML schemas for ISA-95 objects (orders, materials, performance)", "minutes", "ISA-95 object model", "MESA", "ERP ⇄ MES order and confirmation exchange", "Standard content, less mapping work", "Verbose XML; often only used as a guide"],
  ["Euromap 77 / 83 (OPC UA)", "L2–3", "OPC UA companion spec for injection moulding", "~1 s", "Machine, job, cycle parameters", "Moulding machine makers", "Moulding machines ⇄ MES", "Standard for that domain", "Domain-specific"],
  ["IPC-CFX / Hermes", "L2–3", "Electronics assembly messaging (AMQP) / board hand-over", "s / ms", "CFX message dictionary", "Electronics (SMT) industry", "SMT lines ⇄ MES", "Standard for that domain", "Domain-specific"],
];

/* 6C defaults */
export const PN0 = { dev: 30, io: 32, cyc: 2, spd: 100 };
export const EC0 = { dev: 40, bytes: 16, spd: 100, fwd: 0.6 };
export const MB0 = { dev: 20, regs: 60, resp: 8, rtt: 1, conn: 4 };
export const HI0 = { tags: 3000, rate: 1, bytes: 16, days: 730, comp: 0.3 };

/* 6D IP plan: zones / VLANs (template) */
export const ZONES = [
  [10, "Enterprise / office (L4)", "ERP, e-mail, office PCs – managed by IT"],
  [20, "Industrial DMZ (L3.5)", "Historian mirror, patch server, remote-access jump host, file transfer"],
  [30, "Manufacturing operations (L3)", "MES, SCADA servers, DNC, tool management, WMS"],
  [40, "Engineering", "Engineering workstations, back-up server (time-limited access to cells)"],
];
export const RANGES = [[10, 49, "PLCs / safety PLCs / cell controller"], [50, 99, "Remote IO, drives, valve terminals, IO-Link masters"], [100, 149, "HMIs, industrial PCs, cameras"], [150, 199, "CNCs, robot controllers, measuring machines"], [200, 239, "Spare / temporary (commissioning laptops)"], [240, 253, "Switches, firewalls, wireless APs"]];
// devices per module (for the device list): [module, name suffix, range start offset group index, count]
export const MODDEV = {
  M01: [["CNC", 3], ["PLC (machine)", 0], ["HMI", 2]], M02: [["IO (APC)", 1]], M03: [["PLC (stacker)", 0], ["Drive travel", 1], ["Drive hoist", 1], ["HMI", 2]],
  M04: [["IO + RFID", 1], ["HMI", 2]], M05: [["Robot controller", 3], ["Safety scanner", 1]], M06: [["Station IO", 1]], M07: [["PLC (conveyor)", 0], ["IO", 1]],
  M08: [["PLC (AS/RS)", 0], ["Drives", 1], ["HMI", 2]], M09: [["Presetter PC", 2]], M10: [["PLC (washer)", 0]], M11: [["CMM PC", 3]], M12: [["Marking laser", 3], ["Code reader", 2]],
  M13: [["PLC (station)", 0], ["Nutrunner controller", 3]], M14: [["Test PC", 3]], M15: [["Robot controller", 3], ["Welding power source", 1]], M16: [["PLC (press)", 0], ["Drive", 1]],
  M17: [["PLC (utilities)", 0]], M18: [["Safety PLC", 0]], M19: [["Cell controller", 0]], M20: [["SCADA client", 2]], M21: [], M22: [["Core switch", 5], ["Firewall", 5]],
};
export const KITS = {
  "FMS (3 HMCs + pool + AGV)": ["M01", "M01", "M01", "M02", "M02", "M02", "M03", "M04", "M04", "M06", "M10", "M11", "M12", "M17", "M18", "M19", "M20", "M22"],
  "FMC (1 HMC + rack)": ["M01", "M02", "M03", "M04", "M12", "M18", "M19", "M20", "M22"],
  "Assembly line (8 stations)": ["M07", "M13", "M13", "M13", "M13", "M13", "M14", "M14", "M12", "M04", "M18", "M19", "M20", "M22"],
  "Robot welding (2 cells)": ["M05", "M15", "M05", "M15", "M04", "M04", "M12", "M17", "M18", "M19", "M20", "M22"],
};

/* 6E zones & conduits (IEC 62443) – diagram boxes [id, name, x, y, w, h, SL, members] */
export const ZBOX = [
  ["ent", "Enterprise zone (L4)", 20, 20, 300, 70, "SL1", "ERP, office, e-mail"],
  ["dmz", "Industrial DMZ (L3.5)", 360, 20, 300, 70, "SL2", "Historian mirror, patch server, jump host"],
  ["mfg", "Manufacturing zone (L3)", 190, 140, 300, 70, "SL2", "MES, SCADA server, DNC, WMS"],
  ["c1", "Cell zone FMS1 (L1–2)", 20, 255, 260, 75, "SL2", "Cell controller, PLCs, CNCs, HMIs"],
  ["c2", "Cell zone ASM1 (L1–2)", 400, 255, 260, 75, "SL2", "Line PLC, stations, testers"],
  ["saf", "Safety zone FMS1 (inside the cell)", 40, 370, 300, 60, "SL3", "Safety PLC, safety IO – no remote write"],
];
// conduits: [from, to, allowed flows]
export const CONDUITS = [
  ["ent", "dmz", "HTTPS 443 (ERP → MES API proxy), historian read (web)"],
  ["dmz", "mfg", "HTTPS 443 MES API, patch distribution, jump host → RDP / SSH (time-limited, MFA)"],
  ["mfg", "c1", "OPC UA 4840 (MES / SCADA ⇄ cell controller, CNC), Modbus 502 / S7 102 (SCADA → PLC read, write only via cell controller)"],
  ["mfg", "c2", "OPC UA 4840, Modbus 502"],
  ["c1", "saf", "Safety PLC status read only (PROFIsafe stays inside the cell)"],
];
// flow tester: [source, destination, port / protocol, allowed?, reason]
export const FLOWS = [
  ["Office PC", "Cell PLC (FMS1)", "S7 / Modbus 502", false, "No direct path from enterprise to a cell – conduits only between neighbouring zones; use SCADA / MES."],
  ["ERP server", "MES server", "HTTPS 443", true, "Via the DMZ proxy / API gateway, authenticated, logged."],
  ["MES server", "Cell controller FMS1", "OPC UA 4840 (signed + encrypted)", true, "Mfg zone → cell zone conduit; job download and confirmations."],
  ["SCADA server", "HMC-02 CNC", "OPC UA 4840 read", true, "Monitoring read access allowed."],
  ["SCADA server", "Stacker PLC", "Modbus 502 write", false, "Write commands to modules only through the cell controller (one owner of the cell logic)."],
  ["Supplier laptop (internet)", "Robot controller", "Remote desktop", false, "Remote access only via jump host in the DMZ, MFA, time-limited, recorded – never direct VPN into the cell."],
  ["Engineering workstation", "Cell PLC (FMS1)", "Engineering protocol", true, "Only from the engineering zone, with change log and back-up, during an approved window."],
  ["Cell PLC", "Internet / cloud", "MQTT 8883", false, "Cell devices never talk to the internet; data leaves through the DMZ broker / historian."],
  ["Historian (mfg)", "Historian mirror (DMZ)", "Replication", true, "One-way replication outwards; office users read the mirror, not the plant historian."],
  ["Anyone", "Safety PLC", "Write", false, "Safety parameters change only locally with password and validation; no remote write."],
];

/* 6F the standard module data block (one per module) – word offsets, direction from the module's view */
export const BLOCK = [
  [0, "Status.StateCurrent", "INT", "out", "PackML state 1–17 (item 5)"],
  [1, "Status.UnitModeCurrent", "INT", "out", "1 Production · 2 Maintenance · 3 Manual"],
  [2, "Command.CntrlCmd", "INT", "in", "PackML command 1–9"],
  [3, "Command.Bits", "WORD", "in", "bit0 CmdChangeRequest · bit1 HS.Request · bit2 HS.Ack · bit3 FaultReset · bit8–15 spare"],
  [4, "Status.Bits", "WORD", "out", "bit0 Ready · bit1 Busy · bit2 Done · bit3 Fault · bit4 Warning · bit5 Auto · bit6 PartPresent · bit7 HS.Ready"],
  [5, "Command.UnitMode", "INT", "in", "requested mode"],
  [6, "Admin.AlarmNo", "INT", "out", "active alarm number (0 = none), module-range × 1000 + n"],
  [7, "Admin.WarningNo", "INT", "out", "active warning number"],
  [8, "Admin.ProdProcessedCount", "DINT", "out", "2 words – counter for OEE"],
  [10, "Admin.ProdDefectiveCount", "DINT", "out", "2 words"],
  [12, "Job.Id", "DINT", "in", "job / work order number from the cell controller"],
  [14, "Job.PalletId", "DINT", "in/out", "pallet / carrier ID (RFID)"],
  [16, "Status.LastCycle_s", "REAL", "out", "2 words, IEEE 754"],
  [18, "Status.Heartbeat", "UINT", "out", "+1 every second – the partner checks it (time-out 3 s)"],
  [19, "Command.Heartbeat", "UINT", "in", "+1 every second from the cell controller"],
];
// module-specific part starting at word 20: [offset, name, type, dir, meaning]
export const EXTRA = {
  M01: [[20, "NC.ProgramNo", "DINT", "in", "program to run"], [22, "NC.SpindleLoad_pct", "INT", "out", ""], [23, "NC.ToolLifeMin_pct", "INT", "out", "lowest remaining tool life"], [24, "NC.DoorClosed", "BOOL→WORD bit0", "out", "+ bit1 PalletClamped, bit2 ReadyForLoad"]],
  M03: [[20, "Move.From", "INT", "in", "place number"], [21, "Move.To", "INT", "in", "place number"], [22, "Move.PalletAt", "INT", "out", "current place of the fork"], [23, "Rack.FreePlaces", "INT", "out", ""]],
  M04: [[20, "LS.OperatorRelease", "WORD bit0", "out", "+ bit1 LightCurtainOK, bit2 ClampPressureOK"], [21, "LS.PartsOnPallet", "INT", "out", ""], [22, "LS.SerialFirst", "STRING[20]", "out", "10 words"]],
  M06: [[20, "Dock.ReadyToGive", "WORD bit0", "out", "+ bit1 ReadyToTake, bit2 TransferActive, bit3 TransferDone"], [21, "Dock.AGVPresent", "WORD bit0", "in", "+ bit1 AGVReadyToTransfer"]],
  M11: [[20, "Meas.ProgramNo", "INT", "in", ""], [21, "Meas.ResultOK", "WORD bit0", "out", "+ bit1 NOK, bit2 ResultValid"], [22, "Meas.FeaturesOut", "INT", "out", "number of features out of tolerance"]],
  M13: [[20, "Asm.RecipeNo", "INT", "in", ""], [21, "Asm.Torque_Nm", "REAL", "out", "2 words"], [23, "Asm.Angle_deg", "REAL", "out", "2 words"], [25, "Asm.ResultOK", "WORD bit0", "out", ""]],
  M15: [[20, "Weld.JobNo", "INT", "in", "robot + power source job"], [21, "Weld.ArcOnTime_s", "REAL", "out", "2 words"], [23, "Weld.TableSide", "INT", "out", "1 = A at robot, 2 = B"]],
};
