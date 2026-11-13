/* AS/RS item 4 (WMS / ERP / MES) – static data: material master, planning parameters, system landscape,
 * message catalogue and the "Real components + drawings – catalogue examples" card (guide 34).
 * Sources: config/factory.json (erp.items, products, asrs[0].unit_load), guide 03 §19 – §20 / §25 – §26,
 * guide 04 (MRP, BOM, B2MML), guide 15 (numbers, host names, IP plan). ALL VALUES ARE EXAMPLES –
 * the AS/RS, WMS and ERP suppliers' offers decide. Offline: no external links.
 */

/* planning base (guide 03 §20 / guide 04 §4.7): ideal factory rate 17.2 units/h, 4 000 operating h/year */
export const PLAN = {
  unitsPerH: 17.2, hoursPerYear: 4000, z: 1.645, serviceLevel: 0.95,
  orderCost: 120,            // $ per purchase order (purchasing, transport, receipt, inspection) – guide 03 §20.4
  holdRate: 0.25,            // holding cost share of the price per year
  slotCostYear: 450,         // $ per AS/RS slot and year (3 000 $ × 15 %) – guide 03 §20.4
  shiftH: 8, mix: { VC10: 0.3, VC20: 0.5, VC30: 0.2 },
  yw: "2646",                // ISO year + week of 2026-11-12 (guide 15 §3.15)
  gs1: "9521234",            // GS1 DEMO company prefix (952 = demonstration only – never print)
  otifMin: 15,               // retrieval on time if delivered ≤ 15 min after the call-off (example target)
  qiMin: 15,                 // a new crate stays "in quality inspection" 15 min after put-away (example)
};

/* material master – the 5 raw materials of ASRS-RAW (config erp.items + guide 15 part numbers).
 * d = line demand pcs/h = 17.2 × mix × BOM qty; sd = σ of the hourly demand (CV as guide 03 §20.3: 4 /h at 8.6 /h);
 * sLT = σ of the lead time (25 % of LT, guide 03 §20.3 uses 4 h at 16 h); yield = planned yield of the machining route (guide 04 §19.3).
 * SS / ROP / EOQ computed in asrswms_core.js – CC20: SS 62, ROP 200, EOQ 246 (guide 03 §20.3 / §20.4). */
export const MAT = {
  RAW_CC10: { item: "CC10-CAST", prefix: "CC10", desc: "CASTING, CRANKCASE, VC10, EN-GJL-250", makes: "VC-PRD-CC-0010", model: "VC10", mix: 0.3, bom: 1,
    price: 72, supplier: "Foundry A", lt: 16, lot: 120, ssCfg: 60, yield: 1 - 0.008, line: "Crankcase FMS cell (LOAD-CC → HMC-01…03)", station: "LOAD-CC", route: "HMC-0x → WASH-01" },
  RAW_CC: { item: "CC20-CAST", prefix: "CC20", desc: "CASTING, CRANKCASE, VC20, EN-GJL-250", makes: "VC-PRD-CC-0020", model: "VC20", mix: 0.5, bom: 1,
    price: 95, supplier: "Foundry A", lt: 16, lot: 120, ssCfg: 100, yield: 1 - 0.008, line: "Crankcase FMS cell (LOAD-CC → HMC-01…03)", station: "LOAD-CC", route: "HMC-0x → WASH-01" },
  RAW_CC30: { item: "CC30-CAST", prefix: "CC30", desc: "CASTING, CRANKCASE, VC30, EN-GJL-250", makes: "VC-PRD-CC-0030", model: "VC30", mix: 0.2, bom: 1,
    price: 138, supplier: "Foundry A", lt: 16, lot: 60, ssCfg: 40, yield: 1 - 0.008, line: "Crankcase FMS cell (LOAD-CC → HMC-01…03)", station: "LOAD-CC", route: "HMC-0x → WASH-01" },
  RAW_CYL: { item: "CYL-CAST", prefix: "CYL", desc: "CASTING, CYLINDER, ALL MODELS, EN-GJL-250", makes: "VC-PRD-CYL-0020", model: "all", mix: 1, bom: 2,
    price: 28, supplier: "Foundry A", lt: 16, lot: 240, ssCfg: 300, yield: (1 - 0.010) * (1 - 0.008), line: "Cylinder line (VMC-01 → HONE-01)", station: "VMC-01", route: "VMC-01 → HONE-01" },
  RAW_CS: { item: "CS-FORG", prefix: "CS", desc: "FORGING, CRANKSHAFT, ALL MODELS, C45", makes: "VC-PRD-CS-0020", model: "all", mix: 1, bom: 1,
    price: 60, supplier: "Forge B", lt: 20, lot: 120, ssCfg: 150, yield: (1 - 0.010) * (1 - 0.012), line: "Crankshaft line (LATHE-01 → GRIND-01)", station: "LATHE-01", route: "LATHE-01 → GRIND-01" },
};

/* line call-off / kanban of the three machining lines (config stations[].kanban, transports[]) */
export const LINES = [
  { id: "CC", name: "Crankcase FMS cell", station: "LOAD-CC", buffer: "B_CC0 (12 castings, 4 per variant)", skus: ["RAW_CC10", "RAW_CC", "RAW_CC30"],
    rule: "per-model call-off: the MES calls 1 crate of the model of the next work order when B_CC0 holds < 4 castings of it", target: 4, trigger: 2 },
  { id: "CYL", name: "Cylinder line", station: "VMC-01", buffer: "B_CYL0 (24) · kanban B_CYL target 12 / trigger 6", skus: ["RAW_CYL"],
    rule: "kanban: when the supermarket B_CYL falls to 6 the MES calls 1 crate (12 castings)", target: 12, trigger: 6 },
  { id: "CS", name: "Crankshaft line", station: "LATHE-01", buffer: "B_CS0 (12) · kanban B_CS target 8 / trigger 4", skus: ["RAW_CS"],
    rule: "kanban: when the supermarket B_CS falls to 4 the MES calls 1 crate (6 forgings)", target: 8, trigger: 4 },
];

/* systems of the landscape (guide 15 §3.13 host names / IP plan; WCS and GR printer = proposals, add to VC-ITS-NET-0001) */
export const SYSTEMS = {
  SUP: { t: "Suppliers", s: "Foundry A · Forge B", host: "external (EDI / portal)", ip: "via DMZ", lvl: "outside",
    own: "delivery notes, ASN (DESADV), 3.1 certificates, supplier batch + heat numbers", note: "EDI over AS2 / SFTP into the DMZ – never directly into the OT network." },
  ERP: { t: "ERP", s: "ISA-95 level 4", host: "vc-ent-erp01 (proposal) + gateway vc-dmz-b2mml01", ip: "10.10.0.100 · gateway 10.20.0.101", lvl: "L4",
    own: "material master, prices, suppliers, purchase orders, stock VALUE, MRP, cost", note: "Owns the item master and the money. Knows stock per storage location (quantity per item/lot), not per slot." },
  MES: { t: "MES", s: "ISA-95 level 3", host: "vc-ops-mes01", ip: "10.30.0.100", lvl: "L3",
    own: "work orders, dispatch, serials, genealogy, line call-offs, material availability check", note: "Knows which order runs where and which casting lot went into which serial." },
  WMS: { t: "WMS", s: "ISA-95 level 3 (inventory operations)", host: "vc-ops-wms01", ip: "10.30.0.104", lvl: "L3",
    own: "storage locations, handling units (crates), lots, stock per slot, stock categories, slotting, cycle counts, transport orders", note: "Owns WHERE every crate is. Master of slot data and handling units." },
  WCS: { t: "WCS / MFC", s: "ISA-95 level 2 (material-flow control)", host: "vc-log-wcsraw01", ip: "10.54.0.100 (VLAN 54)", lvl: "L2",
    own: "transport execution: crane + conveyor routing, telegrams, sequence, device status", note: "Often delivered by the AS/RS supplier. Executes one transport order at a time per device, reports done / error." },
  PLC: { t: "Crane + conveyor PLC", s: "ISA-95 level 1", host: "vc-log-plcasrsraw", ip: "10.54.0.31", lvl: "L1",
    own: "axes, positions, safety, I/O, fault codes", note: "Receives a job record (source, destination, HU) – knows nothing about items or lots (items 2 / 3 of this tab)." },
  IDP: { t: "ID point", s: "infeed: RFID gate + barcode + contour + weight", host: "vc-log-asrsraw-rfid1 / 2", ip: "10.54.0.150 / .151", lvl: "L1",
    own: "read crate ID (CRT / SSCC), contour OK, weight", note: "No-read or contour fault → the crate goes to the reject lane; the WMS never guesses an ID." },
  LINE: { t: "Machining lines", s: "LOAD-CC · VMC-01 · LATHE-01", host: "vc-mch-plc01 / 02 / 03", ip: "10.51.0.11 · 10.52.0.12 / .13", lvl: "L1",
    own: "line-side buffers, kanban signals, part marking (serial)", note: "Kanban signal from the line PLC → MES → WMS call-off." },
  PRT: { t: "Label print server", s: "crate + location labels", host: "vc-ops-prt01", ip: "10.30.0.106", lvl: "L3",
    own: "label templates (GS1-128, DataMatrix)", note: "Prints the own crate label at goods receipt (CRT, lot, SSCC)." },
};

/* message catalogue: from, to, name, protocol, counter key (asrswms_core counters) */
export const MSGS = [
  { id: "po", from: "ERP", to: "SUP", name: "Purchase order", proto: "EDI ORDERS (EDIFACT / VDA 4984) via the DMZ", key: "po" },
  { id: "asn", from: "SUP", to: "ERP", name: "Advance shipping notice (ASN)", proto: "EDI DESADV with SSCC, lot, heat", key: "asn" },
  { id: "inb", from: "ERP", to: "WMS", name: "Expected receipt (inbound delivery item)", proto: "REST JSON / IDoc / B2MML MaterialLot", key: "inb" },
  { id: "sched", from: "ERP", to: "MES", name: "ProcessProductionSchedule (work order)", proto: "ISA-95 B2MML XML", key: "sched" },
  { id: "call", from: "MES", to: "WMS", name: "Material call-off (line / kanban)", proto: "REST JSON (or OPC UA method)", key: "call" },
  { id: "deliv", from: "WMS", to: "MES", name: "Material delivered to line (HU, lot, qty)", proto: "REST JSON event / MQTT", key: "deliv" },
  { id: "perf", from: "MES", to: "ERP", name: "ProcessProductionPerformance (consumption by lot)", proto: "ISA-95 B2MML XML", key: "perf" },
  { id: "gm", from: "WMS", to: "ERP", name: "Goods movement posting (GR 101 / GI 261)", proto: "REST JSON / IDoc WMMBXY", key: "gm" },
  { id: "to", from: "WMS", to: "WCS", name: "Transport order", proto: "fixed telegram (TCP/IP) or OPC UA", key: "to" },
  { id: "tc", from: "WCS", to: "WMS", name: "Transport confirmation / error", proto: "fixed telegram (TCP/IP) or OPC UA", key: "tc" },
  { id: "plc", from: "WCS", to: "PLC", name: "Job record (src, dst, HU) + handshake", proto: "PROFINET / S7 DB or OPC UA", key: "plc" },
  { id: "scan", from: "IDP", to: "WCS", name: "ID point scan (ID, contour, weight)", proto: "fixed telegram / OPC UA", key: "scan" },
  { id: "life", from: "WCS", to: "WMS", name: "Life sign (every 10 s)", proto: "fixed telegram LS", key: "life" },
];

/* "Real components + drawings – catalogue examples" card (srCard4) – generated from guide 34 §28 (keep in step) */
export const CARD = {
  guides: "guide 34",
  ph: "(e.g. EWM, Odoo, Zebra, Cognex, RFID)",
  price: "Price classes are rough estimates (2020s, Europe, licence / hardware only, without integration and services) – always ask 2 – 3 suppliers.",
  drawings: [
    { f: "34_system_landscape.svg", t: "System landscape ERP → MES → WMS → WCS → PLC", c: "Levels 4 to 1 with host names and IP addresses of guide 15, ID point, lines, suppliers and the 13 messages with protocol", g: "guide 34 §2" },
    { f: "34_data_model.svg", t: "WMS data model", c: "Item, storage location, handling unit (crate, SSCC), lot, quant (stock record), stock category, transport order, movement – keys and links", g: "guide 34 §3" },
    { f: "34_goods_receipt.svg", t: "Goods receipt flow", c: "ASN → unloading → ID point (RFID + barcode, contour, weight) → quality check (ISO 2859-1 sample) → putaway job → slot, with the system postings", g: "guide 34 §8" },
    { f: "34_goods_issue.svg", t: "Goods issue / line call-off flow", c: "Kanban signal → MES call-off → WMS FIFO slot choice → retrieval job → crane → outfeed → AGV → line, with times", g: "guide 34 §9" },
    { f: "34_slotting_abc.svg", t: "Slotting – ABC zones on the rack", c: "Front elevation of one rack side with single-cycle time per slot, A / B / C zones by cycle time, COI ranking and effect on the mean cycle", g: "guide 34 §5" },
    { f: "34_inventory_sawtooth.svg", t: "Inventory saw-tooth CC20-CAST", c: "Stock over time with safety stock 62, reorder point 200, lead time 16 h, lot 120 / EOQ 246, and the EOQ cost curve with slot cost", g: "guide 34 §6" },
    { f: "34_genealogy.svg", t: "Genealogy tree casting → compressor", c: "Heat → supplier batch → own lot → crate SSCC → slot → retrieval job → work order → machined crankcase → compressor serial, backward and forward trace", g: "guide 34 §10" },
    { f: "34_message_sequence.svg", t: "Message sequence ERP → MES → WMS → WCS → PLC", c: "Sequence diagram of one work order: schedule, availability check, call-off, transport order, job, confirmation, goods issue, consumption", g: "guide 34 §7" },
    { f: "34_telegram_format.svg", t: "Fixed telegram WMS ↔ WCS", c: "Field layout of the transport order TO and the confirmation TC with positions, lengths, status codes, sequence number and life sign", g: "guide 34 §7.4" },
  ],
  groups: [
    { id: "wms", t: "WMS software", src: "guide 34 §28.1", rows: [
      ["WMS", "large WMS inside the ERP, AS/RS + MFC module", "SAP EWM (Extended Warehouse Management, embedded or decentral on S/4HANA)", "MFC (material flow control) can talk telegrams directly to PLCs", "$$$", "On-prem / offline: yes (on-prem S/4HANA or decentral EWM) · partner with AS/RS experience, licence model, MFC vs. vendor WCS"],
      ["WMS", "tier-1 WMS, cloud native", "Manhattan Active Warehouse Management (Manhattan Associates)", "SaaS, continuous updates", "$$$ (subscription)", "On-prem / offline: no (cloud) · internet dependency of daily operation, local buffering"],
      ["WMS", "tier-1 / tier-2 WMS", "Körber WMS (formerly HighJump / K.Motion)", "on-prem and cloud editions", "$$ – $$$", "On-prem / offline: yes (on-prem edition) · which edition, AS/RS interface, local partner"],
      ["WMS", "WMS with strong AS/RS + automation link", "Reply LEA (Logistics Execution Architecture)", "modular, used by intralogistics integrators", "$$ – $$$", "On-prem / offline: yes · reference with pallet AS/RS, MFC module"],
      ["WMS", "WMS inside the Infor suite", "Infor WMS (Infor SCE)", "cloud first (multi-tenant), on-prem older releases", "$$ – $$$", "On-prem / offline: check (mainly cloud) · release on-prem support"],
      ["WMS", "WMS from an AS/RS maker", "Mecalux Easy WMS (+ Galileo control software)", "on-prem or cloud, sized from small stores", "$ – $$", "On-prem / offline: yes (on-prem) · integration with other makers' cranes"],
      ["WMS", "ERP + WMS for mid-size plants", "Microsoft Dynamics 365 Supply Chain Management – Warehouse management", "cloud ERP with WMS; scale units for edge", "$$ (subscription)", "On-prem / offline: limited (cloud; edge scale unit – check) · offline behaviour"],
      ["WMS", "open-source ERP with inventory / WMS", "Odoo Inventory (Community LGPL / Enterprise)", "multi-location, lots, serials, barcode app (Enterprise), self-hosted", "$ (Community free; Enterprise per user)", "On-prem / offline: yes (self-hosted) · no AS/RS telegram interface out of the box – needs WCS + adapter"],
      ["WMS", "open-source inventory system", "OpenBoxes", "lots, expiry, stock movements, web UI, self-hosted (Java)", "free (open source) + own effort", "On-prem / offline: yes · made for supply chains (health), no automation interface – own adapter"],
    ] },
    { id: "wcs", t: "WCS / material-flow controllers (from AS/RS makers)", src: "guide 34 §28.2", rows: [
      ["WCS / WMS", "warehouse + material flow software", "SSI Schäfer WAMAS", "WMS + MFC, pallet and mini-load AS/RS", "$$ – $$$ (with the system)", "On-prem: yes · interface spec to your ERP / MES, 24/7 hotline"],
      ["WCS / WES", "warehouse control / execution", "Swisslog SynQ", "WMS / WCS / MFS for Swisslog AS/RS (Vectura cranes)", "$$ – $$$ (with the system)", "On-prem: yes · remote support access via DMZ only"],
      ["WCS", "control software", "Dematic iQ", "WES / WCS for Dematic systems", "$$ – $$$ (with the system)", "On-prem: yes (check) · scope split WMS vs WCS"],
      ["MFC", "material flow computer", "Kardex Mlog MFC / Mlog control system", "MFC for stacker cranes and conveyors", "$$ (with the system)", "On-prem: yes · telegram spec, simulation for FAT"],
      ["WCS", "control software", "TGW software suite (WCS + WES)", "for TGW Stingray / pallet systems", "$$ – $$$ (with the system)", "On-prem: yes · references in production supply"],
      ["WCS / WMS", "warehouse software", "Knapp KiSoft", "WMS / WCS / visualisation", "$$ – $$$ (with the system)", "On-prem: yes · interface to non-Knapp equipment"],
      ["WCS", "AS/RS control software", "Mecalux Galileo", "control software for Mecalux cranes and conveyors", "$$ (with the system)", "On-prem: yes · works with Easy WMS or a third-party WMS"],
      ["WMS / WCS", "logistics software for own trucks + AS/RS", "Jungheinrich WMS / logistics interface", "WMS + automation link", "$$ (with the system)", "On-prem: check · mixed fleet support"],
    ] },
    { id: "int", t: "MES / ERP link and integration (see guide 04)", src: "guide 34 §28.3", rows: [
      ["OPC UA server / gateway", "PLC ↔ IT link", "PTC Kepware KEPServerEX", "OPC UA, many PLC drivers, IoT gateway", "$ – $$", "On-prem: yes · licence per driver, redundancy"],
      ["Integration flows", "low-code adapters, REST ↔ OPC UA ↔ MQTT", "Node-RED (OpenJS Foundation, open source)", "flows in JavaScript, runs on any PC", "free + own effort", "On-prem: yes · version control of flows, support"],
      ["MQTT broker", "event bus for WMS / MES events", "Eclipse Mosquitto / HiveMQ", "MQTT 3.1.1 / 5, TLS", "free / $ – $$", "On-prem: yes · cluster for high availability (guide 07)"],
      ["Integration platform", "enterprise integration, queues, mapping", "MuleSoft Anypoint (runtime on-prem) / SAP Integration Suite", "API management, mapping B2MML ↔ IDoc", "$$ – $$$", "On-prem / offline: MuleSoft runtime yes; SAP Integration Suite cloud – no"],
      ["ERP", "ERP with MRP, purchasing, inventory", "SAP S/4HANA, Microsoft Dynamics 365 BC, Odoo (guide 04 §31.2)", "see guide 04", "$ – $$$", "On-prem / offline: depends on edition – see guide 04"],
      ["MES", "MES with genealogy + material call-off", "see guide 04 §31.1 (Opcenter, FactoryTalk, Critical Manufacturing …)", "see guide 04", "$$ – $$$", "On-prem / offline: see guide 04"],
    ] },
    { id: "prt", t: "Label printers and label software (goods receipt, crates, locations)", src: "guide 34 §28.4", rows: [
      ["Industrial label printer", "thermal transfer, 300 dpi, 4 in", "Zebra ZT411 / ZT421", "203 / 300 / 600 dpi, Ethernet, ZPL", "$", "Ribbon type (wax-resin for warehouse labels), cutter / peeler"],
      ["Industrial label printer", "high volume, 24/7", "Zebra ZT610 / ZT620", "metal frame, 300 / 600 dpi", "$ – $$", "Duty cycle, print speed"],
      ["Label printer", "mid-range industrial", "Honeywell PM45", "203 / 300 / 406 dpi, Ethernet", "$", "Emulations (ZPL / DPL), ribbon"],
      ["Label printer", "mid-range industrial", "SATO CL4NX Plus", "203 / 305 / 609 dpi, RFID option", "$", "RFID encoding option for UHF crate tags"],
      ["Print-and-apply", "label on moving crates", "Zebra ZE511 engine + applicator (integrator) / Weber Legi-Air", "print engine for applicators", "$$", "Apply position, cycle time, label size A6"],
      ["Label software", "templates, GS1-128, print server", "Seagull BarTender / Loftware NiceLabel", "print server, audit trail, GS1 wizard", "$ – $$", "On-prem: yes · integration REST / file drop"],
      ["Barcode verifier", "ISO/IEC 15416 / 15415 grading", "Axicon 15000 series / Honeywell (Omron) LVS-95xx", "grade A – F per ISO", "$ – $$", "Calibration card, GS1 application standards"],
    ] },
    { id: "id", t: "Identification at the ID point (scanners, cameras, RFID, contour)", src: "guide 34 §28.5", rows: [
      ["Fixed barcode scanner", "read crate label at the infeed, 0.5 – 1.5 m", "SICK Lector 64x / CLV6xx", "image-based / laser, PROFINET / Ethernet", "$ – $$", "Reading distance, field of view, label position tolerance"],
      ["Fixed image reader", "1D / 2D, DPM capable", "Cognex DataMan 380 / 470 series", "liquid lens, PROFINET / EtherNet/IP", "$ – $$", "Lighting, read rate in the real place, FTP of no-read images"],
      ["Fixed image reader", "1D / 2D at conveyor speed", "Datalogic Matrix 320 / Keyence SR-X series", "PROFINET option", "$ – $$", "Mounting, depth of field"],
      ["UHF RFID reader", "gate at the infeed, 865 – 868 MHz", "SICK RFU63x / Siemens SIMATIC RF680R / Zebra FX9600", "EPC Gen2 (ISO/IEC 18000-63), PROFINET (SICK / Siemens)", "$$", "Antennas, read zone tuning, on-metal tags"],
      ["UHF tags", "on-metal tags for steel crates", "Confidex Ironside / HID (Omni-ID) on-metal tags", "read range on metal see datasheet", "$ (per tag)", "Temperature, mounting, tag position on the crate"],
      ["Contour + height check", "light grids at the infeed", "SICK MLG-2 / Leuze CML 700i", "beam spacing 5 – 30 mm", "$ – $$", "Resolution vs. allowed overhang, muting"],
      ["Weighing", "crate weight ≤ 300 kg + tare check", "load cells in the conveyor (Mettler Toledo / HBM) + weighing terminal", "class III, ±0.5 kg typical", "$ – $$", "Legal-for-trade not needed – overload check only"],
    ] },
    { id: "hht", t: "Handheld terminals and wearables (goods receipt, counting, quality hold)", src: "guide 34 §28.6", rows: [
      ["Rugged handheld", "keypad + scanner, freezer / warehouse", "Zebra MC9400 / MC9450", "Android, long-range imager, Wi-Fi 6E", "$$", "Scan range, battery, MDM, offline mode of the WMS app"],
      ["Touch handheld", "light industrial", "Zebra TC58 / TC53", "Android, SE4720 imager", "$ – $$", "Drop spec, glove touch"],
      ["Rugged handheld", "keypad + scanner", "Honeywell CK65", "Android, long-range option", "$$", "Terminal emulation vs native app"],
      ["Touch handheld", "light industrial", "Honeywell CT45 / CT47", "Android, imager", "$ – $$", "MDM, battery swap"],
      ["Wearable scanner", "hands-free scanning", "ProGlove MARK / Zebra WT6300 + RS5100", "Bluetooth ring / wrist", "$", "Pairing, battery shift life"],
      ["Vehicle-mount terminal", "forklift at goods receipt", "Zebra VC8300 / Honeywell Thor VM1A", "Android / Windows, 8 – 10 in", "$$", "Power from the truck, screen readability"],
    ] },
    { id: "srv", t: "On-premise servers and infrastructure for WMS / WCS", src: "guide 34 §28.7", rows: [
      ["Server", "WMS + database, 2 nodes or VM cluster", "Dell PowerEdge R660 / HPE ProLiant DL360 Gen11", "2 × CPU, 128 – 256 GB RAM, RAID SSD", "$$ (each)", "Redundancy, iDRAC / iLO, warranty 5 y"],
      ["Database", "WMS database", "Microsoft SQL Server / PostgreSQL / SAP HANA (for EWM)", "as required by the WMS", "$ – $$$ / free", "What the WMS supports, backup tool"],
      ["UPS", "servers + network, ≥ 15 min", "APC Smart-UPS SRT / Eaton 9PX", "online double conversion", "$", "Shutdown agent for the VMs"],
      ["Backup", "image + database backup, offline copy", "Veeam Backup & Replication / Windows Server Backup + NAS (Synology)", "3-2-1 rule", "$ – $$", "Restore test every quarter"],
    ] },
  ],
  shopCols: ["Pos", "Item", "Qty", "Spec / purpose", "Example (choose after offers)", "Price class (estimate)"],
  shop: [
    ["1", "WMS licence (on-prem) incl. AS/RS interface", "1 site", "slots, HU, lots, stock categories, FIFO, cycle count, ERP + MES + WCS interfaces", "SAP EWM / Körber / Reply LEA / Mecalux Easy WMS / Odoo + adapter", "$$ – $$$"],
    ["2", "WCS / MFC for ASRS-RAW", "1", "transport orders → crane + conveyor telegrams, ID point, reject lane", "from the AS/RS supplier (WAMAS, SynQ, Mlog, Galileo …)", "with the AS/RS"],
    ["3", "Server pair or VM cluster + UPS", "2 + 1", "WMS + DB + WCS VMs, ≥ 15 min UPS", "Dell R660 / HPE DL360, APC SRT", "$$"],
    ["4", "Integration middleware", "1", "B2MML / REST / OPC UA mapping, queue, monitor", "Kepware + Node-RED / MuleSoft runtime", "$ – $$"],
    ["5", "Fixed barcode / image reader at the infeed", "2", "2 sides of the crate, PROFINET", "SICK Lector 64x / Cognex DataMan 470", "$ – $$"],
    ["6", "UHF RFID gate at the infeed + on-metal crate tags", "1 gate + 400 tags", "865 – 868 MHz, 2 antennas", "SICK RFU63x / Siemens RF680R + Confidex Ironside", "$$"],
    ["7", "Contour light grids + weighing conveyor section", "1 set", "overhang, height, weight ≤ 300 kg", "SICK MLG-2 + load cells", "$ – $$"],
    ["8", "Industrial label printers (goods receipt + reject lane)", "2", "300 dpi, GS1-128 crate labels", "Zebra ZT421 / SATO CL4NX Plus", "$"],
    ["9", "Label software / print server", "1", "templates, audit trail", "BarTender / NiceLabel", "$ – $$"],
    ["10", "Handheld terminals", "4", "goods receipt, counting, quality hold, manual retrieval", "Zebra MC9400 / Honeywell CK65", "$$"],
    ["11", "Vehicle-mount terminal (forklift at the dock)", "1", "unloading, ASN check", "Zebra VC8300", "$$"],
    ["12", "Barcode verifier", "1", "label grade check ISO/IEC 15416", "Axicon 15000 series", "$"],
    ["13", "Location labels for 392 slots + I/O points", "1 set", "Code 128 + text ASRS-RAW-A01L-L1-S01 …", "printed on site (pos. 8)", "$"],
    ["14", "Services: requirements, data migration, interface tests, go-live support", "1", "§26 of guide 34", "WMS partner + own team", "$$ – $$$"],
  ],
  shopTitle: "Consolidated shopping list for the software layer of ASRS-RAW (WMS, WCS link, identification, terminals) – guide 34 §28.8. Quantities and classes are examples.",
  shopNote: "Order the WMS and the WCS with ONE interface specification (telegrams, error codes, master data owner) – guide 34 §7. Ask every supplier for an on-premise / offline statement in writing.",
};
