/* Ball screw + guide factory – item 4 communication: texts, HTTP API examples, comparison table, fault catalogue, catalogue card CARD4.
 * Guide: docs/43_bsf_communication_modbus_http.md. ALL VALUES ARE EXAMPLES – check with your network designer / the makers. */
export const NOTE4 = "Example values – check with your network designer, the machine makers and the device manuals.";
export const RULE4 = "Company rule: machines / PLCs ↔ gateway = Modbus TCP only (port 502); gateway ↔ MES, ERP, twin, AGV fleet, printer, browser = HTTP only (REST + JSON, Server-Sent Events for live push). No MQTT, no OPC UA. Safety is hard-wired (safety relay / F-PLC), never over Modbus or HTTP.";

/* HTTP "try it" examples: [label, method, path, body | null, idempotency] */
export const API_EX = [
  ["Gateway status", "GET", "/api/bsf/status", null],
  ["One machine (all values)", "GET", "/api/bsf/machine?id=BS-TGR-03", null],
  ["Last 5 Modbus frames", "GET", "/api/bsf/frames?n=5", null],
  ["Changes (report-by-exception, long poll 5 s)", "GET", "/api/bsf/events?since=0&wait=5", null],
  ["API catalogue", "GET", "/api/bsf/api", null],
  ["MES: work orders (paged)", "GET", "/api/bsf/mes/workorders?page=1&size=5", null],
  ["MES: create work order (Idempotency-Key)", "POST", "/api/bsf/mes/workorders", { product: "BS", qty: 40, dueDays: 5 }, true],
  ["MES: release WO-00001 (2nd time → 409)", "POST", "/api/bsf/mes/workorders/WO-00001/release", {}],
  ["MES: dispatch list BS-TGR-03", "GET", "/api/bsf/mes/dispatch?machine=BS-TGR-03", null],
  ["MES: confirmation (Idempotency-Key)", "POST", "/api/bsf/mes/confirmations", { wo: "WO-00001", op: "80", machine: "BS-TGR-03", good: 19, scrap: 1 }, true],
  ["MES: traceability of a serial", "GET", "/api/bsf/mes/trace?serial=BS-3210-1000-C5-0001", null],
  ["ERP: release production order → MES WO", "POST", "/api/bsf/erp/productionorders/PO-4711/release", { product: "LG", qty: 50 }, true],
  ["ERP: stock", "GET", "/api/bsf/erp/stock", null],
  ["ERP: goods issue too big → 409", "POST", "/api/bsf/erp/goodsmovements", { type: "GI", material: "LB-25-FL", qty: 99999, order: "WO-00002" }],
  ["AGV: transport order", "POST", "/api/bsf/agv/transportorders", { from: "GRIND-OUT", to: "QC-IN", load: "lot WO-00001-L01", priority: 3 }, true],
  ["Label: print job (print server)", "POST", "/api/bsf/printer/jobs", { printer: "PRT-PCK-01", template: "BS-box-100x50", data: { part: "BS-3210-1000-C5", serial: "BS-0001", qty: 1, lot: "WO-00001-L01" } }, true],
  ["Unknown resource → 404 problem+json", "GET", "/api/bsf/mes/workorders/WO-99999", null],
  ["Version in the URL (/v1/ = same)", "GET", "/api/bsf/v1/control", null],
];

/* what you lose without MQTT / OPC UA – and how this plant compensates */
export const CMP = [
  ["Live data push (publish / subscribe)", "MQTT broker pushes every change; OPC UA subscriptions with sampling + dead-band", "Gateway polls (fast 0.5 s) and does report-by-exception itself: dead-band per unit → event ring → Server-Sent Events (1 s) and long polling for MES / ERP", "1 extra hop; data age = poll period + RTT (≤ 0.5 s) – fine for MES / OEE, not for control loops"],
  ["Data model / semantics (names, units, types)", "OPC UA information model, companion specs (e.g. OPC 40501 machine tools); MQTT Sparkplug B", "Register map per machine type as JSON + CSV (/api/bsf/map), versioned (register 0 = map version), field names group.field + unit in the map; the gateway converts registers → JSON with names", "map must be kept in step with the PLC program (change control, test plan §14)"],
  ["Security (authentication, encryption)", "OPC UA certificates + signing; MQTT over TLS with user / client cert", "Modbus TCP has none → separate machine VLANs, firewall: port 502 only from the gateway, read-only maps where possible, command registers with handshake + plausibility; HTTP side over HTTPS (TLS) with API keys / basic auth", "an attacker inside a cell VLAN can still write registers → physical + switch-port security (802.1X / MAC lock)"],
  ["Browse / discovery", "OPC UA browse the address space; MQTT topic tree", "/api/bsf/api catalogue + /api/bsf/map; hdr.typeCode + hdr.mapVersion in every device", "no automatic discovery – the IP plan is the master list"],
  ["Time stamps at the source", "OPC UA SourceTimestamp, Sparkplug timestamps", "gateway time stamp at receipt (ageMs, stale flag); machine-side time only if the PLC writes it into registers (option: 2 × UINT32 epoch)", "± (RTT + poll period) uncertainty, synchronise the gateway clock (NTP – see §12)"],
  ["Store-and-forward when the network is down", "MQTT persistent sessions / QoS 1 – 2; OPC UA historical access", "machine counters are UINT32 totals (never lost, only late); the gateway buffers events in its ring and MES reads them with ?since=N; machine PLC keeps the lot result until MES acknowledges (DONE toggle)", "plan the counter roll-over (UINT32 = 4.29 billion parts – no problem)"],
  ["Methods / commands", "OPC UA methods with arguments + result", "command block 200 – 225 + toggle-bit handshake (REQ / ACK / DONE, sequence number, result code; 226 = gateway heartbeat since map V1.1) – POST /api/bsf/command, idempotent with msgId", "every machine maker must implement the handshake in the PLC (specification §8.4)"],
  ["Large data (programs, files, pictures)", "OPC UA file transfer; MQTT payloads", "HTTP: NC programs, measurement reports, pictures as files over HTTP (DNC / file server with HTTP API) – never over Modbus", "Modbus is for small process values only (≤ 125 registers per read)"],
];

/* fault catalogue for the fault-injection card */
export const FAULTS = [
  ["offline", "Machine offline (cable pulled / PLC off)", "fault offline on the chosen machine", "no answer → time-out after 300 ms, retry, status 'timeout', after 3 failures back-off (fast poll only every 2 s), data age grows → stale flag", "check link LED, switch port, ping, PLC in RUN"],
  ["slow", "Slow answer (overloaded PLC, Wi-Fi, long line)", "answer after 600 ms > time-out 300 ms", "time-out + retry, late answers are dropped (transaction id check + reconnect)", "raise the time-out for this device (e.g. 1 000 ms), reduce the poll rate, check PLC scan time"],
  ["exc04", "Device failure (exception 04)", "the device answers with exception 04", "status 'exception 04' – the gateway keeps the last values but marks them stale", "PLC diagnostics; often the Modbus server module of the PLC is not running"],
  ["cdab", "Wrong word order (CDAB instead of ABCD)", "the device sends REAL low word first", "temperatures like 4.4E+08 °C or 1.2E-38 – nonsense values with status 'online'", "set word order in the gateway per device type, or in the PLC; check with a known value (e.g. 20.0 °C = 0x41A0 0000)"],
  ["badunit", "Wrong unit id (exception 0B)", "request to unit 200 (does not exist)", "exception 0B GATEWAY TARGET DEVICE FAILED TO RESPOND (from a Modbus gateway / our simulator)", "unit id from the IP plan; for direct devices often 1 or 255"],
  ["badaddr", "Register out of range (exception 02)", "FC03 read from 300", "exception 02 ILLEGAL DATA ADDRESS", "1-based vs 0-based (40001 = offset 0), map version, block size"],
  ["badfc", "Function not supported (exception 01)", "FC08 diagnostics (serial-line only)", "exception 01 ILLEGAL FUNCTION", "use FC03 / FC04 / FC06 / FC16; check which FCs the device supports"],
  ["badqty", "Too many registers (exception 03)", "FC03 with quantity 200 (> 125)", "exception 03 ILLEGAL DATA VALUE", "max 125 registers per read, 123 per write – split the block"],
  ["netloss", "Network loss (switch / fibre down)", "no device answers", "all devices 'timeout', every value stale after 3 × fast period + time-out × (1 + retries) = 2.1 s; HTTP still works and reports stale", "redundant ring (MRP / RSTP), UPS for switches, alarm 'gateway: n devices stale'"],
];

const PR = "estimate – ask for a quote";
export const CARD4 = {
  guides: "guide 43", shopTab: "Shopping list (network + gateway)", shopLbl: "network", ph: "(e.g. SCALANCE, Moxa, MGate, WAGO, fibre)",
  buyNote: "Prices are rough estimates 2026 (" + PR + "); makers marked (check) – confirm the exact model and that it fits your plant. No external links – offline.",
  drawings: [
    { sec: "Network", f: "43_network_architecture.svg", t: "Network architecture – levels, VLANs, firewall", c: "ERP in IT behind the firewall, DMZ 610 (ERP connector, NTP), OPS 620 (MES, print server, historian), SUP 630 (gateway gw01 / gw02, twin, fleet manager), core switch, cell VLANs 641 – 645 (19 / 9 / 22 / 8 / 15 machines), AGV Wi-Fi 650, utilities 660. Modbus TCP below the gateway, HTTP above, safety hard-wired.", g: "guide 43 §4" },
    { sec: "Network", f: "43_vlan_ip_plan.svg", t: "VLAN + IP plan 10.60.xx.host", c: "10 VLANs with subnet, zone, host ranges (.1 gateway, .2 – .9 switches, .11 – .99 machines, .100 HMIs, .150 I/O + meters, .240 service), host names vc-bsf-<area>-<id>, unit id 1 … 73.", g: "guide 43 §4.3" },
    { sec: "Modbus TCP", f: "43_mbap_frame.svg", t: "Modbus TCP frame anatomy (MBAP + PDU)", c: "Request 00 01 00 00 00 06 0F 03 00 00 00 0C byte by byte: transaction id, protocol id, length, unit id, function code, start, quantity; max ADU 260 bytes, 125 registers per read.", g: "guide 43 §6.2" },
    { sec: "Modbus TCP", f: "43_fc03_request_response.svg", t: "FC03 request + response, exception", c: "Fast block of BS-TGR-03 (unit 15): 12 registers decoded into fields; exception answer 0F 83 02 and the list of exception codes.", g: "guide 43 §6.4" },
    { sec: "Modbus TCP", f: "43_real_word_order.svg", t: "Data types + word order (ABCD vs CDAB)", c: "570.8 = 0x440EB333: ABCD registers 0x440E 0xB333 read correctly, CDAB gives −4.174E-08; UINT32 high word first; ASCII 2 characters per register.", g: "guide 43 §7" },
    { sec: "Register map", f: "43_register_map_example.svg", t: "Register map BS-TGR (thread grinder)", c: "Blocks fast 0 – 11 (500 ms), counters + process 20 – 67 (1 s), energy 100 – 103 (10 s), command 200 – 226 (read / write; 226 = gateway heartbeat, map V1.1); REAL on even offsets; 40001 = offset 0.", g: "guide 43 §8" },
    { sec: "Register map", f: "43_handshake_toggle_bits.svg", t: "Toggle-bit handshake MES → machine", c: "Timing diagram t0 … t5: command data, REQ toggle, ACK, ackSeq, result, BUSY, lotDone, DONE toggle, READY; 3 s time-out.", g: "guide 43 §8.4" },
    { sec: "Gateway + HTTP", f: "43_gateway_internals.svg", t: "Gateway internals", c: "Worker threads with a schedule per device, Modbus client (time-out, retry, reconnect, transaction-id check, back-off), decode, value store with quality + stale flag, report-by-exception dead-band, frame + event rings, statistics, HTTP API + SSE, command path with idempotency cache, store-and-forward.", g: "guide 43 §9" },
    { sec: "Gateway + HTTP", f: "43_timing_load.svg", t: "Timing, data age and network load", c: "Poll timeline, data age saw-tooth (max = poll period + RTT), load for 73 machines (map V1.1): 226.3 reads/s + 73 heartbeat writes/s = 299.3 requests/s, ≈ 62.0 kB/s = 0.50 Mbit/s = 0.5 % of 100 Mbit/s.", g: "guide 43 §9.6" },
    { sec: "Gateway + HTTP", f: "43_http_api_map.svg", t: "HTTP API map /api/bsf/…", c: "Consumers (MES, ERP connector, twin, andon, AGV fleet, print server), resource tree with methods, status codes, problem+json errors, Idempotency-Key.", g: "guide 43 §10" },
    { sec: "Integration", f: "43_sequence_mes_order.svg", t: "Sequence: ERP → MES → gateway → machine", c: "ERP releases the order (HTTP), MES sends POST /api/bsf/command, gateway: FC03 read, FC16 write, FC06 toggle, FC03 poll until ACK; DONE event → MES confirmation → ERP goods receipt.", g: "guide 43 §11" },
    { sec: "Security", f: "43_firewall_zones.svg", t: "IEC 62443 zones, conduits, firewall rules", c: "Zones enterprise / DMZ / operations / supervisory / cells / AGV / utilities; conduits C1 – C10 (HTTPS 443, port 502 only from the gateway, NTP UDP 123, deny + log); compensating measures because Modbus has no security.", g: "guide 43 §13" },
  ],
  groups: [
    { id: "sw", t: "Managed industrial Ethernet switches (cell + core)", src: "guide 43 §4.5, §17", rows: [
      ["Cell switch, managed, 8 – 24 ports, DIN rail", "1 Gbit copper + 2 – 4 SFP fibre uplinks, VLAN 802.1Q, RSTP / MRP ring, IGMP, port mirroring, 802.1X, HTTPS web UI", "Siemens SCALANCE XC200 / XC300 (check)", "check", "≈ 0.8 – 2.5 k€ (" + PR + ")", "ring protocol (MRP / RSTP), port security, mirror port for Wireshark, 24 V redundant supply"],
      ["Same", "same", "Hirschmann (Belden) RSP / GREYHOUND / BOBCAT (check)", "check", "≈ 0.9 – 3 k€", "same; HiOS features, ring coupling"],
      ["Same", "same", "Moxa EDS-500 / EDS-G500 / RKS (check)", "check", "≈ 0.5 – 2 k€", "same; Turbo Ring, IEC 62443-4-2 certified models"],
      ["Same", "same", "Phoenix Contact FL SWITCH 2000 / 4000 (check)", "check", "≈ 0.6 – 2.5 k€", "same; PROFINET not needed here"],
      ["Core / distribution switch (19\" rack, L3)", "24 – 48 × 1 / 10 Gbit SFP, inter-VLAN routing only through the firewall", "Siemens SCALANCE XR500 · Hirschmann DRAGON / MACH · Cisco IE / Catalyst (check)", "check", "≈ 3 – 12 k€", "redundant power, stacking, ACLs, 10 Gbit uplinks between halls"],
      ["PoE switch for cameras / access points / andon", "802.3at / bt, 4 – 8 PoE ports", "Moxa · Phoenix · Siemens · Hirschmann (check)", "check", "≈ 0.8 – 2 k€", "PoE budget (W), VLAN per port"],
    ] },
    { id: "fw", t: "Firewall (zones + conduits, IEC 62443)", src: "guide 43 §13", rows: [
      ["Industrial firewall between IT, DMZ and OT (pair, HA)", "stateful, ≥ 6 interfaces, deep packet inspection for Modbus TCP (read-only filter option), VPN for remote service", "Fortinet FortiGate rugged (check)", "check", "≈ 3 – 10 k€ each (" + PR + ")", "Modbus DPI (allow FC 03 / 04 only from MES side), HA pair, logging to syslog"],
      ["Same", "same", "Siemens SCALANCE S615 / SC600 (check)", "check", "≈ 1.5 – 5 k€", "zone firewall per cell (option), simpler rules"],
      ["Same", "same", "Phoenix Contact mGuard (check)", "check", "≈ 1.5 – 4 k€", "same; cell firewall in the cabinet"],
      ["Same", "same", "Moxa EDR-G9010 / Cisco Secure Firewall ISA (check)", "check", "≈ 2 – 8 k€", "industrial DPI for Modbus"],
    ] },
    { id: "gw", t: "Modbus TCP gateways + remote I/O (old machines, serial devices)", src: "guide 43 §5, §6", rows: [
      ["Modbus RTU (RS-485) → Modbus TCP gateway", "1 – 4 serial ports, up to 32 devices per port, unit id routing", "Moxa MGate MB3170 / MB3270 / MB3660 (check)", "check", "≈ 0.3 – 1.2 k€ (" + PR + ")", "time-out per port, exception 0B / 0A behaviour, number of TCP connections"],
      ["Same", "same", "Phoenix Contact FL COMSERVER / GW Modbus (check)", "check", "≈ 0.3 – 1 k€", "same"],
      ["Same", "same", "Lantronix · Anybus (HMS) Communicator (check)", "check", "≈ 0.3 – 1 k€", "same"],
      ["Remote I/O coupler Modbus TCP (signal lamps, counters of old machines)", "digital in 24 V, counter inputs, 2 Ethernet ports", "WAGO 750-352 / 750-362 + I/O modules (check)", "check", "≈ 0.3 – 0.8 k€ + modules", "Modbus register map of the process image, watchdog"],
      ["Same", "same", "Phoenix Contact Axioline AXL F BK ETH (check) · Moxa ioLogik E1200 (check)", "check", "≈ 0.25 – 0.8 k€", "same; web configuration"],
      ["Energy meter with Modbus TCP per machine / sub-board", "class 0.5S, kW, kWh, cos φ", "Janitza UMG 96 / 604 · Siemens SENTRON PAC · Schneider PM5000 · Phoenix EEM (check)", "check", "≈ 0.4 – 1.5 k€", "register map (REAL, word order!), CT ratio"],
    ] },
    { id: "srv", t: "Servers, UPS, rack", src: "guide 43 §9, §17", rows: [
      ["Gateway PC (industrial, fanless) – gw01 + gw02", "4 – 8 cores, 16 GB, SSD, 2 – 4 Ethernet ports, Python stdlib service", "Siemens SIMATIC IPC · Advantech · Beckhoff C60xx · OnLogic (check)", "check", "≈ 1.5 – 4 k€ each (" + PR + ")", "2 NICs (cell side / server side), watchdog, 24 V supply, temperature range"],
      ["Twin / MES server (rack)", "2 × server, RAID 1, 32 – 64 GB, 10 Gbit", "Dell PowerEdge · HPE ProLiant · Lenovo ThinkSystem · Fujitsu PRIMERGY (check)", "check", "≈ 6 – 15 k€ each", "redundant PSU, remote management, backup"],
      ["UPS for servers + core switches", "3 – 6 kVA online (double conversion), 15 – 30 min", "APC (Schneider) Smart-UPS · Eaton 9PX · Socomec · Riello (check)", "check", "≈ 2 – 6 k€", "network card (HTTP / SNMP) for shutdown, battery test"],
      ["DIN-rail UPS 24 V for cell switches", "24 V / 5 – 20 A + battery / supercap", "Phoenix QUINT UPS · Siemens SITOP · PULS (check)", "check", "≈ 0.2 – 0.6 k€", "buffer time, status contact"],
      ["19\" network rack + patch panels", "42 U, fibre + copper patch panels", "Rittal · Schroff · Legrand (check)", "check", "≈ 1.5 – 4 k€", "cooling, earthing, cable management"],
    ] },
    { id: "cab", t: "Cabling", src: "guide 43 §4.6", rows: [
      ["Industrial Ethernet cable Cat6A S/FTP, PUR, oil-resistant", "4-pair, 10 Gbit up to 100 m, drag-chain versions", "Lapp ETHERLINE · Helukabel · Belden · Siemens IE FC (check)", "check", "≈ 2 – 6 €/m (" + PR + ")", "oil / coolant resistance, shielding, bending radius"],
      ["RJ45 field connectors / M12 X-coded", "IP20 in cabinets, M12 IP67 on machines", "Harting · Phoenix · Lapp · Murrelektronik (check)", "check", "≈ 8 – 30 € each", "shield contact 360°, tooling"],
      ["Fibre between halls / zones", "OM3 / OM4 multimode (≤ 300 – 400 m at 10 Gbit) or OS2 single mode, 12 fibres", "Corning · Prysmian · Lapp (check) + SFP modules from the switch maker", "check", "≈ 3 – 10 €/m + splicing", "immune to EMC, no earthing loops between buildings"],
      ["Wi-Fi access points for AGVs (industrial, roaming)", "802.11ac / ax, fast roaming, 5 GHz", "Siemens SCALANCE W · Moxa AWK · Phoenix FL WLAN · Cisco (check)", "check", "≈ 0.8 – 2.5 k€ each", "roaming time < 50 ms, site survey"],
    ] },
    { id: "tools", t: "Test + diagnosis tools", src: "guide 43 §14 – §15", rows: [
      ["Network tap / mirror port + laptop with Wireshark", "filter mbtcp, http; capture at the gateway port", "Wireshark (free) · Profitap / Garland taps (check)", "check", "≈ 0 – 1 k€", "mirror port on every cell switch"],
      ["Modbus test client (master simulator)", "read / write registers, log frames", "Modbus Poll (Witte Software) · QModMaster (free) · mbpoll (free) (check)", "check", "≈ 0 – 150 €", "word order setting, 0 / 1-based addressing option"],
      ["Cable tester / certifier", "Cat6A certification, fibre OTDR (contractor)", "Fluke Networks DSX · Softing (check)", "check", "≈ 2 – 15 k€ (or rent)", "certification report per link"],
    ] },
  ],
  shopTitle: "Network + Modbus gateway + HTTP servers for the 73 machines of item 2 (example design point – guide 43 §17). Machines: see item 2 (bfCard2).",
  shopNote: "Prices are rough estimates 2026 – ask for a quote. Building cabling trays, installation labour and IT licences (ERP) are not included.",
  shops: [
    { title: "Network + gateway – full plant", cols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (" + PR + ")"], m: 4, p: 5, rows: [
      ["1", "6", "Cell switches (641 – 645 + utilities 660), managed, 16 – 24 ports + 2 SFP", "VLAN, ring, mirror port", "SCALANCE XC · Hirschmann RSP · Moxa EDS · Phoenix FL", "≈ 8 – 18 k€"],
      ["2", "2", "Core switches L3, redundant", "10 Gbit uplinks", "SCALANCE XR · Hirschmann DRAGON · Cisco", "≈ 8 – 24 k€"],
      ["3", "2", "Firewall pair (HA) IT / DMZ / OT", "Modbus DPI option", "FortiGate rugged · SCALANCE S · mGuard", "≈ 8 – 20 k€"],
      ["4", "2", "Gateway PCs gw01 + gw02 (hot standby)", "2 NICs, fanless", "SIMATIC IPC · Advantech · Beckhoff", "≈ 4 – 8 k€"],
      ["5", "2", "Twin / MES servers + 19\" rack + 2 UPS", "RAID 1, 30 min", "Dell · HPE · Lenovo + APC · Eaton", "≈ 20 – 40 k€"],
      ["6", "6", "Modbus TCP I/O couplers / RTU gateways for machines without Modbus TCP", "estimate 6 of 73", "WAGO 750-352 · Moxa MGate · Phoenix", "≈ 3 – 8 k€"],
      ["7", "80", "Cat6A drops machine → cell switch (≈ 40 m each)", "S/FTP PUR, tested", "Lapp · Helukabel · Belden", "≈ 25 – 50 k€ incl. labour"],
      ["8", "1", "Fibre backbone between zones (12 × OM4 / OS2)", "≈ 600 m, spliced", "Corning · Prysmian", "≈ 10 – 25 k€"],
      ["9", "4", "Wi-Fi access points for AGVs + controller", "roaming < 50 ms", "SCALANCE W · Moxa AWK · Cisco", "≈ 5 – 12 k€"],
      ["10", "6", "Andon screens (browser kiosk, SSE)", "55\", 24/7", "any industrial display maker", "≈ 6 – 18 k€"],
      ["11", "1", "Engineering laptop + Modbus test tools + tap", "Wireshark, Modbus Poll", "any", "≈ 2 – 4 k€"],
      ["12", "1", "Network design, IP plan, firewall rules, commissioning tests (external)", "IEC 62443 risk assessment", "system integrator", "≈ 20 – 60 k€"],
    ] },
  ],
};
