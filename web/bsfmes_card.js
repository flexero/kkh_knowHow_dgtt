/* Ball screw + guide factory – item 6 MES: catalogue card CARD6 (makeCard of web/robotref.js) + build-vs-buy table.  Guide: docs/45_bsf_mes.md §22 – §24.
 * MES products are REFERENCES ONLY – every one must be checked for HTTP REST + a Modbus TCP gateway (no OPC UA / MQTT in this plant).
 * Makers marked (check) – confirm the exact model. Prices = rough estimates 2026 – ask for a quote. No external links (offline). */
const PR = "estimate – ask for a quote";
const CHK = "needs HTTP REST + Modbus gateway support; check";
export const CARD6 = {
  guides: "guide 45", shopTab: "Shopping list (MES roll-out)", shopLbl: "roll-out", ph: "(e.g. Opcenter, HYDRA, Zebra, Cognex, UPS)",
  buyNote: "Prices are rough estimates 2026 (" + PR + "). MES products are listed as references only – " + CHK + ". Makers marked (check) – confirm the model, the HTTP interface and the service in your country. No external links – offline.",
  drawings: [
    { sec: "What an MES is", f: "45_isa95_levels.svg", t: "ISA-95 / IEC 62264 levels of this plant", c: "Level 4 ERP (item 7) – level 3 MES (this item) – level 2 gateway + HMI – level 1 PLC / CNC – level 0 sensors; arrows only HTTP (above the gateway) and Modbus TCP (below).", g: "guide 45 §3" },
    { sec: "What an MES is", f: "45_integration_map.svg", t: "Integration map – HTTP + Modbus TCP only", c: "MES server with ERP, AGV fleet, label print server, QA service, browsers / terminals over HTTP (REST + SSE), 73 machines over Modbus TCP through the gateway; no MQTT, no OPC UA.", g: "guide 45 §8" },
    { sec: "Data + orders", f: "45_mes_data_model.svg", t: "MES data model (entities + keys)", c: "ProductionOrder → WorkOrder → Lot → Operation → Confirmation; Serial with parent / children; HeatLot, FurnaceLoad, Downtime, Machine, TransportRequest, Kanban; measurement records + NCR from item 5.", g: "guide 45 §4" },
    { sec: "Data + orders", f: "45_order_lifecycle.svg", t: "Work-order and lot life cycle", c: "created → released (readiness check) → running → done → closed; lot planned → queued → running → moving → done, with hold (quality) and scrapped; who triggers each step.", g: "guide 45 §5" },
    { sec: "Scheduling", f: "45_gantt_example.svg", t: "Gantt example – EDD vs set-up families on the thread grinder", c: "4 lots X1 Y1 X2 Y2 (100 min each, set-up 45 / 15 min): EDD 4 full set-ups, makespan 580 min; family rule 2 + 2, makespan 520 min.", g: "guide 45 §6" },
    { sec: "Scheduling", f: "45_dbr.svg", t: "Drum – buffer – rope at the thread grinders BS-TGR", c: "Drum = 8 thread grinders (bottleneck), time buffer 16 h in front of them, rope = release of bars timed from the drum schedule; WIP falls, output stays.", g: "guide 45 §6.6" },
    { sec: "Machine interface", f: "45_machine_handshake.svg", t: "Order download – sequence MES → gateway → machine", c: "POST /api/bsf/command → FC03 read 200 – 202 + 8 – 10 → FC16 write 200 – 225 → FC06 toggle REQ → FC03 poll until ACK = REQ → hs.lotDone counters → automatic confirmations → DONE toggle.", g: "guide 45 §8" },
    { sec: "Traceability", f: "45_genealogy_tree.svg", t: "Genealogy – heat lot to assembly serial", c: "Heat H7741 → lot → shaft serial BS3210-… → assembly A-BS-… ← nut serial BN3210-… ← heat H5512; guide set: rail ↔ 2 matched carriages; measurement records hang on every serial.", g: "guide 45 §10" },
    { sec: "Traceability", f: "45_gs1_label.svg", t: "Label with GS1 Data Matrix", c: "Element string (01) GTIN (11) date (21) serial (10) lot (240) product code, FNC1 / GS separators, text lines, where the label is printed and scanned.", g: "guide 45 §9" },
    { sec: "Performance", f: "45_oee_loss_tree.svg", t: "OEE loss tree (ISO 22400) with example numbers", c: "PBT 450 min → down 30 + set-up 15 → APT 405 → speed loss 45 → quality loss 40 → fully productive 320 min: A 0.900 × E 0.889 × Q 0.889 = OEE 0.711.", g: "guide 45 §13" },
    { sec: "Shop floor", f: "45_andon_layout.svg", t: "Andon board layout", c: "One tile per machine (colour = state), area rows, calls (supervisor / maintenance / quality / logistics), holds, SPC stops, plan vs actual per product, where the boards hang.", g: "guide 45 §15" },
    { sec: "Logistics", f: "45_kanban_loop.svg", t: "Kanban loop for bought parts", c: "Supermarket at assembly → empty bin scanned → MES signal → ERP / supplier → full bin back; N = ceil(D × LT × (1 + α) / C) = 9 boxes of balls Ø6.35.", g: "guide 45 §12" },
  ],
  groups: [
    { id: "mes", t: "MES software (reference products – " + CHK + ")", src: "guide 45 §22 – §23", rows: [
      ["MES suite – discrete manufacturing", "work orders, dispatch, data collection, genealogy, OEE, quality", "Siemens Opcenter Execution Discrete (check)", "check", "≈ 150 – 600 k€ + yearly (" + PR + ")", CHK + "; REST API for ERP, AGV, printers; Modbus TCP only through a gateway / own connector"],
      ["MES + ERP cloud / on-premise", "MES, quality, ERP in one", "Rockwell Plex MES · FactoryTalk ProductionCentre (check)", "check", "≈ 100 – 500 k€ + yearly", CHK + "; offline operation possible? (cloud!)"],
      ["MES (modular, discrete + process)", "dispatch, traceability, quality, APS add-on", "Critical Manufacturing MES (check)", "check", "≈ 150 – 500 k€", CHK + "; serial genealogy for assemblies"],
      ["MES / MDC / PDC (German SME standard)", "machine + operating data, HR, tool + quality modules", "MPDV HYDRA X (check)", "check", "≈ 80 – 400 k€", CHK + "; Modbus TCP terminals / MDC boxes?"],
      ["MES for assembly / traceability", "traceability, routing control, poka-yoke", "iTAC.MES.Suite (check)", "check", "≈ 80 – 300 k€", CHK + "; strong in assembly lines"],
      ["MES (process + discrete)", "work orders, quality, performance", "AVEVA MES (check)", "check", "≈ 100 – 400 k€", CHK],
      ["Other references", "MES / MOM", "Dassault DELMIA Apriso · SAP Digital Manufacturing · GE Proficy · Epicor (check)", "check", "≈ 100 – 800 k€", CHK + "; ERP coupling to item 7"],
      ["Own MES (this item: twin/bsf_mes.py + web/bsfmes*.js)", "stdlib Python + SQLite, HTTP REST + SSE, Modbus TCP via the item-4 gateway", "in-house", "–", "internal effort (≈ 1.5 – 3 developer-years for production use)", "who maintains it in 10 years? tests, backup, user rights, audit trail"],
    ] },
    { id: "term", t: "Shop-floor terminals + scanners", src: "guide 45 §14, §23", rows: [
      ["Industrial panel PC 15 – 22\" (machine terminal)", "IP65 front, fanless, touch, browser kiosk", "Siemens SIMATIC IPC / ITP · Beckhoff CP · B&R Automation PC · Advantech TPC (check)", "check", "≈ 1.5 – 4 k€ each", "browser only (HTTP) – no local software; glove touch; mounting arm"],
      ["Rugged tablet / handheld computer", "Android, scanner built in", "Zebra TC / ET series · Honeywell CT · Datalogic Memor (check)", "check", "≈ 1 – 2.5 k€", "Wi-Fi in the hall? (else fixed terminals)"],
      ["Handheld 2D scanner (corded / cordless)", "Data Matrix ECC 200 incl. DPM (laser marked)", "Zebra DS3600 / DS8100 · Cognex DataMan 8700 · Datalogic PowerScan · Honeywell Granit (check)", "check", "≈ 300 – 1 200 € each", "reads laser-marked Data Matrix on round steel (DPM!)"],
      ["Fixed-mount code reader", "DPM reading at the marker / assembly", "Cognex DataMan 370 · Keyence SR-X · Datalogic Matrix · SICK Lector (check)", "check", "≈ 1.5 – 4 k€", "Ethernet: HTTP / TCP output (no OPC UA needed)"],
      ["Badge reader (operator login)", "RFID 13.56 MHz, USB keyboard mode", "Elatec TWN4 · HID OMNIKEY (check)", "check", "≈ 100 – 250 €", "badge type of the plant"],
    ] },
    { id: "label", t: "Label printers + marking", src: "guide 45 §9, §23", rows: [
      ["Industrial label printer 300 dpi", "thermal transfer, ZPL, Ethernet, HTTP / web services", "Zebra ZT411 / ZT610 · SATO CL4NX Plus · Honeywell PM45 · Avery Dennison (check)", "check", "≈ 1.5 – 4 k€", "print server API over HTTP; GS1 Data Matrix (^BX); label stock"],
      ["Print server / label software", "templates, HTTP job API, audit", "Zebra Link-OS / ZebraDesigner · NiceLabel (Loftware) · BarTender (check)", "check", "≈ 2 – 20 k€", "REST job API (the MES only talks HTTP)"],
      ["Labels + ribbons (consumables)", "polyester, oil resistant", "label converters", "check", "≈ 0.02 – 0.10 € per label", "VCI packing compatibility"],
      ["Laser marker (serial on the part)", "fibre 20 W, class 1 cabin – see item 2 AS-MRK", "Trumpf · Coherent (Rofin) · Keyence · Gravotech (check)", "check", "item 2", "HTTP / Modbus TCP job data from the MES"],
    ] },
    { id: "andon", t: "Andon + displays", src: "guide 45 §15, §23", rows: [
      ["Andon display 55\" (area board)", "24/7 commercial display + mini PC with browser", "Samsung / LG / Philips commercial displays + any mini PC (check)", "check", "≈ 1 – 2.5 k€ each", "24/7 rating, brightness, mounting"],
      ["Network signal tower / stack light", "LED 3 – 5 tiers, buzzer, Ethernet", "Patlite LA6 / NHL-series (LAN) · Werma (WIN / EasyMaxx) · Banner (check)", "check", "≈ 250 – 700 €", "HTTP or Modbus TCP control – check the protocol list"],
      ["Andon call buttons", "4 colours, wired to the machine PLC (→ Modbus register)", "Schneider · Siemens · Eaton pushbuttons", "check", "≈ 50 – 150 € per set", "PLC input + register bit (item 8)"],
    ] },
    { id: "srv", t: "Servers, UPS, network, backup", src: "guide 45 §19, §23", rows: [
      ["MES server (2 × for redundancy)", "2 × 16 cores, 64 GB RAM, 2 × 1.9 TB SSD RAID 1", "Dell PowerEdge R660 · HPE ProLiant DL360 · Lenovo ThinkSystem SR630 (check)", "check", "≈ 8 – 15 k€ each", "virtualisation? spare parts 5 years, remote management"],
      ["UPS for the servers + network core", "3 kVA online double conversion, network card", "APC Smart-UPS SRT · Eaton 9PX · Socomec (check)", "check", "≈ 2 – 4 k€ each", "runtime ≥ 15 min, clean shutdown over the network"],
      ["Backup NAS / second site", "4 bays, snapshots, offline copy", "Synology · QNAP (check)", "check", "≈ 1.5 – 4 k€", "daily SQLite backup (online backup API), 30 days history, restore test"],
      ["Managed switches + firewall", "from item 4 (VLANs, MES zone)", "see bfCard4", "check", "item 4", "MES in the level-3 zone, gateway as the only Modbus client"],
      ["Reverse proxy / TLS certificates", "HTTPS, API keys, logging", "nginx · Caddy (open source)", "–", "internal effort", "certificates from the plant CA"],
    ] },
  ],
  shopTitle: "MES roll-out for the example plant (73 machines, 2 shifts). Own MES (this item) or a bought MES – the hardware is the same. Machines and the gateway: items 2 + 4.",
  shopNote: "Prices are rough estimates 2026 – ask for a quote. Software licences of a bought MES, project services, training and cabling are not included.",
  shops: [
    { title: "MES hardware + infrastructure", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (" + PR + ")"], m: 4, p: 5, rows: [
      ["1", "2", "MES servers (active + standby)", "16 cores, 64 GB, SSD RAID 1", "Dell · HPE · Lenovo", "≈ 16 – 30 k€"],
      ["2", "2", "UPS 3 kVA online", "≥ 15 min, shutdown via network", "APC · Eaton", "≈ 4 – 8 k€"],
      ["3", "1", "Backup NAS + offline disk rotation", "snapshots, 30 days", "Synology · QNAP", "≈ 2 – 5 k€"],
      ["4", "25", "Machine terminals (panel PC, browser kiosk)", "1 per 2 – 4 machines, IP65", "Siemens · Beckhoff · B&R · Advantech", "≈ 40 – 100 k€"],
      ["5", "30", "2D scanners (DPM capable)", "Data Matrix on steel", "Zebra · Cognex · Datalogic", "≈ 15 – 35 k€"],
      ["6", "4", "Fixed code readers (marker, assembly, packing)", "DPM, Ethernet", "Cognex · Keyence · SICK", "≈ 6 – 16 k€"],
      ["7", "6", "Label printers 300 dpi + print server software", "ZPL, HTTP job API", "Zebra · SATO · Honeywell", "≈ 12 – 30 k€"],
      ["8", "5", "Andon displays 55\" + mini PCs", "24/7", "Samsung · LG + mini PC", "≈ 6 – 12 k€"],
      ["9", "73", "Network stack lights (or PLC-driven lamps)", "LAN, 3 – 5 tiers", "Patlite · Werma", "≈ 20 – 50 k€"],
      ["10", "60", "Badge readers + badges", "RFID", "Elatec · HID", "≈ 8 – 15 k€"],
      ["11", "1", "MES software: own (this item, finish for production) OR bought licence + project", "see build vs buy", "own team / MES vendor", "own: ≈ 1.5 – 3 developer-years · bought: ≈ 150 – 600 k€ + 15 – 22 % / year"],
      ["12", "1", "Training + roll-out support (operators, supervisors, planners)", "3 – 5 days per role", "internal / vendor", "≈ 15 – 40 k€"],
    ] },
  ],
};

/* build vs buy – honest comparison (guide 45 §22) */
export const BUILD_BUY = [
  ["Fit to our rule (only Ethernet + Modbus TCP + HTTP)", "exact – built for it (gateway of item 4, REST + SSE)", "check every product: many expect OPC UA / MQTT / own MDC boxes → extra connector or gateway project"],
  ["Functions on day 1", "what we write: work orders, dispatch, confirmations, genealogy, OEE, andon, holds (this demo = proof of concept)", "very wide (APS, labour, maintenance, document control, CAPA, e-signatures, reports)"],
  ["Time to production", "≈ 12 – 24 months with 2 – 3 developers + tests, validation", "≈ 6 – 18 months (project, configuration, interfaces, training)"],
  ["Cost (example plant, 5 years)", "≈ 1.5 – 3 developer-years + hardware + own support (≈ 0.5 – 1 FTE / year)", "licence ≈ 150 – 600 k€ + maintenance 15 – 22 % / year + project + hardware"],
  ["Change speed (new product, new check)", "fast – own code, own release", "configuration fast; real changes = change requests to the vendor"],
  ["Risk", "key-person risk, security + backup + audit trail are OUR job, no certificate", "vendor lock-in, upgrade projects, licence model changes, cloud dependence"],
  ["Validation / customer audits (ISO 9001, IATF 16949-like)", "we must document + test (traceability, user rights, data integrity)", "vendor documents + references help; still our process"],
  ["Recommendation (example)", "start with this own MES for the pilot line (data model + interfaces), keep the HTTP contract (docs/43 + 45) as the specification", "run a tender with the HTTP contract as must-have; decide after the pilot with real numbers"],
];
