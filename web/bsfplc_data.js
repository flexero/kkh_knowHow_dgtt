/* Item 8 – PLC selection per machine type (all 41 MTYPES of item 2), PLC bill of materials, Modbus server setup notes, commissioning
 * checklist and the architecture table. Guide: docs/47_bsf_plc_programs.md §3, §7, §8, §16, §19. Prices = rough estimates 2026 – ask for a quote.
 * Makers / models are catalogue examples, not a recommendation – check the current catalogue. */
import { MTYPES, MACHINES } from "./bsfmfg_data.js";

const QTY = MACHINES.reduce((m, x) => { m[x.type] = (m[x.type] || 0) + 1; return m; }, {});
/* ctl: who brings the control · own: our PLC (counted in the BOM) · io: DI / DO / AI / AO estimate of OUR PLC (or the maker's) · prog: program on the page */
const CNC = "maker's CNC + PLC (Fanuc / SINUMERIK / Mitsubishi …)", MAKER = "machine maker's PLC", OWN = "our PLC (own design / integrator)";
const SRV_CNC = "map V1.1 in the CNC's PLC (purchase spec, option – check)", SRV_S7 = "Siemens MB_SERVER (S7-1200 / 1500) or Delta AS built-in", SRV_MK = "maker implements map V1.1 (MB_SERVER / built-in server)";
const T = {
  "MS-SAW": [MAKER, "maker PLC (Siemens S7-1200 typical) – program 1 is the reference", [12, 8, 0, 0], SRV_MK, "std", false],
  "BS-STR": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231", [8, 6, 4, 0], SRV_S7, "str", true],
  "BS-CTR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BS-TRN": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BS-ROL": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BS-IND": [OWN, "AS332T-A + AS04AD-A + AS04DA-A + safety controller  /  S7-1500 CPU 1513F-1 PN + ET 200MP", [16, 12, 6, 2], "Siemens MB_SERVER (S7-1500) / Delta AS built-in", "ind", true],
  "HT-TMP": [MAKER, "furnace maker PLC + temperature controllers", [16, 12, 6, 2], SRV_MK, "", false],
  "BS-STH": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231 (or the press maker's CNC)", [10, 8, 4, 0], SRV_S7, "str", true],
  "BS-CLP": [MAKER, "maker PLC (small)", [8, 6, 0, 0], SRV_MK, "std", false],
  "BS-CGR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BS-WHL": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BS-TGR": [CNC + " + our cell PLC", "cell PLC AS332T-A + AS04RTD-A  /  S7-1200 1215C + SM 1223 + SM 1231 RTD (loader, door, chiller, mist)", [14, 11, 1, 0], "cell PLC: MB_SERVER / Delta built-in (CNC values via the CNC–PLC interface)", "tgr", true],
  "QC-LED": [OWN, "AS332T-A  /  S7-1200 1214C (bench I/O; laser data from the PC software)", [8, 6, 1, 0], "PC software Modbus TCP server (map V1.1) + PLC for the bench", "", true],
  "AS-WSH": [MAKER, "washer maker PLC", [16, 12, 4, 0], SRV_MK, "", false],
  "BN-TRN": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BN-MC": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "HT-CAR": [MAKER, "furnace line PLC (S7-1500 typical) + carbon controller", [64, 48, 16, 8], SRV_MK, "", false],
  "BN-HTN": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "BN-ITG": [CNC + " + our cell PLC", "cell PLC as BS-TGR (program 4)", [14, 11, 1, 0], "cell PLC: MB_SERVER / Delta built-in", "tgr", true],
  "AS-NAS": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231", [10, 8, 2, 0], SRV_S7, "trq", true],
  "LG-SAW": [MAKER, "maker PLC", [12, 8, 0, 0], SRV_MK, "std", false],
  "LG-STR": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231", [8, 6, 4, 0], SRV_S7, "str", true],
  "LG-DRL": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "LG-IND": [OWN, "AS332T-A + analog + safety controller  /  S7-1500 CPU 1513F-1 PN + ET 200MP", [20, 16, 8, 2], "Siemens MB_SERVER (S7-1500) / Delta AS built-in", "ind", true],
  "LG-STH": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231 (2 planes)", [12, 10, 6, 0], SRV_S7, "str", true],
  "LG-SGR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "LG-PGR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "LG-CUT": [MAKER, "maker PLC", [10, 8, 0, 0], SRV_MK, "std", false],
  "QC-RAL": [OWN, "AS332T-A  /  S7-1200 1214C (bench I/O; scale / camera data from the PC)", [8, 6, 1, 0], "PC software Modbus TCP server + PLC", "", true],
  "LB-MC": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "LB-SGR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "LB-RGR": [CNC, "CNC PLC", [0, 0, 0, 0], SRV_CNC, "", false],
  "QC-INC": [OWN, "small PLC AS228T-A  /  S7-1200 1212C (count + label request only)", [6, 4, 0, 0], SRV_S7, "std", true],
  "AS-BAS": [OWN, "AS332T-A  /  S7-1200 1215C (ball feeder, dummy rail)", [12, 8, 1, 0], SRV_S7, "std", true],
  "QC-MAT": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231 (force + height)", [8, 6, 3, 0], SRV_S7, "trq", true],
  "AS-BSA": [OWN, "AS332T-A + AS04AD-A + ASDA-B3  /  S7-1200 1215C + SM 1231 + V90 PN", [8, 6, 2, 1], SRV_S7, "trq", true],
  "AS-RUN": [OWN, "AS332T-A + AS04AD-A + ASDA-B3  /  S7-1200 1215C + SM 1223 + V90 PN", [12, 11, 1, 1], SRV_S7, "run", true],
  "AS-GAS": [OWN, "AS332T-A + AS04AD-A  /  S7-1200 1215C + SM 1231", [10, 6, 2, 0], SRV_S7, "trq", true],
  "AS-MRK": [MAKER, "laser maker controller (I/O + Ethernet)", [8, 8, 0, 0], SRV_MK, "std", false],
  "AS-PCK": [OWN, "AS332T-A  /  S7-1200 1214C (scale, label printer release – the printer itself talks HTTP to the print server)", [8, 6, 0, 0], SRV_S7, "std", true],
  "QC-LAB": ["lab instruments (no PLC)", "none – lab PCs with HTTP to the MES (or a Modbus I/O box for status)", [0, 0, 0, 0], "not connected by Modbus (HTTP from the lab software)", "", false],
};
export const PLC_ROWS = Object.keys(MTYPES).map((k) => { const t = T[k] || [MAKER, "?", [0, 0, 0, 0], SRV_MK, "", false]; return { type: k, n: MTYPES[k].n, qty: QTY[k] || 0, ctl: t[0], plc: t[1], io: t[2], srv: t[3], prog: t[4], own: t[5] }; });

/* price list (k€, estimate – ask for a quote) */
const PD = { cpu: 0.45, di: 0.15, dq: 0.15, ai: 0.30, aq: 0.35, psu: 0.12, saf: 0.30, hmi: 0.45, big: 2.0 };    // Delta AS
const PS = { cpu: 0.65, di: 0.28, dq: 0.32, ai: 0.45, aq: 0.55, psu: 0.15, saf: 0.30, hmi: 0.95, big: 4.2 };    // Siemens S7-1200 / (big = S7-1500F + ET 200MP extra)
const ON_D = [16, 16, 0, 0], ON_S = [14, 10, 2, 2];
export function plcBom() {
  const own = PLC_ROWS.filter((r) => r.own);
  const calc = (P, on, name) => {
    let n = 0, mods = 0, cost = 0, big = 0;
    for (const r of own) {
      const q = r.qty || 0; if (!q) continue;
      const [di, dq, ai, aq] = r.io;
      const m = Math.ceil(Math.max(0, di - on[0]) / 16) + Math.ceil(Math.max(0, dq - on[1]) / 16) + Math.ceil(Math.max(0, ai - on[2]) / 4) + Math.ceil(Math.max(0, aq - on[3]) / 4);
      const c = P.cpu + Math.ceil(Math.max(0, di - on[0]) / 16) * P.di + Math.ceil(Math.max(0, dq - on[1]) / 16) * P.dq + Math.ceil(Math.max(0, ai - on[2]) / 4) * P.ai + Math.ceil(Math.max(0, aq - on[3]) / 4) * P.aq + P.psu + P.saf + P.hmi + (r.prog === "ind" ? P.big : 0);
      n += q; mods += m * q; cost += c * q; if (r.prog === "ind") big += q;
    }
    return { opt: name, n, cpu: `${n} × ${name.startsWith("A") ? "AS332T-A" : "CPU 1215C"}${big ? ` (${big} induction: ${name.startsWith("A") ? "+ safety controller" : "S7-1500F"})` : ""}`, mod: `${mods} modules`, psu: `${n} × 24 V`, saf: `${n} × relay`, hmi: `${n} × ${name.startsWith("A") ? "DOP-107" : "KTP700"}`, total: `≈ ${cost.toFixed(1)} k€`, cost };
  };
  const A = calc(PD, ON_D, "A · Delta AS300"), B = calc(PS, ON_S, "B · Siemens S7-1200 / 1500");
  return { rows: [A, B], note: `Our PLCs only: ${A.n} machines of ${own.length} types (presses, induction, benches, test stands, assembly, cell PLCs of the thread grinders). CNC machines and bought machines bring their own control – the Modbus TCP server with map V1.1 is part of their price (purchase specification, guide 43 §8.6). Software: ISPSoft + DOPSoft free; TIA Portal STEP 7 Basic ≈ 0.6 k€ / Professional ≈ 2.5 k€ per seat, Safety ≈ 1.5 k€ (estimates). Prices: rough estimates 2026 – ask for a quote. Spare parts: 1 CPU + 1 of each module per family.` };
}

export const ARCH = [
  ["0 – process", "sensors, valves, motors, servo drives, generator, chiller", "24 V DC signals, 4 – 20 mA / 0 – 10 V, PT100, encoder", "hard-wired"],
  ["1 – control", "machine PLC (program + Modbus TCP server, port 502) · safety relay / F-CPU (hard-wired, independent)", "PLC ↔ gateway", "Modbus TCP (server in the PLC)"],
  ["1 – network", "managed switch per cell, machine VLAN 641 … 645, star topology", "Ethernet 100 Mbit / 1 Gbit, Cat6A / fibre", "Ethernet"],
  ["2 – supervisory", "gateway vc-bsf-sup-gw01 (Modbus TCP client: 100 ms … 10 s polls), digital twin, AGV fleet manager", "gateway ↔ MES / twin / andon", "HTTP REST + JSON, SSE"],
  ["3 – operations", "MES (orders, handshake commands, confirmations), historian, label print server", "MES ↔ ERP", "HTTP REST + JSON"],
  ["safety (all levels)", "e-stop, guard locking, light curtains, STO, generator HV off", "never over the network in this plant", "hard-wired to the safety relay / F-CPU"],
];

export const SERVER_SETUP = {
  delta: [
    ["Function", "AS332T-A: built-in Ethernet port with Modbus TCP server (slave) – enable it in HWCONFIG → CPU → Ethernet (IP, mask, gateway; check the AS manual for the exact menu)"],
    ["Address mapping (check AS manual!)", "holding register offset n = D n (FC03 / FC06 / FC16) → our map V1.1 lives in D0 … D226 (D0 = 400001 in 1-based tools; D226 = gateway heartbeat). Bits M n are coils (FC01 / FC05). DVP series differ: D0 = 0x1000 = 4096 (404097), M0 = 0x0800, X0 = 0x0400, Y0 = 0x0500."],
    ["Keep D0 … D226 free", "the program's own data starts at D1000; analog values at D300 …; scratch registers D900 … (calc)"],
    ["32-bit values", "Delta stores DINT / REAL with the LOW word in the lower D register (D1014 = low, D1015 = high) → for ABCD: MOV D1015 D24 + MOV D1014 D25 (network I13)"],
    ["Bits of a word", "D4.0 … D4.15 used directly as coils (AS series supports bit-of-word devices Dn.b – check the instruction set); D4 is then the status word"],
    ["Connections", "several Modbus TCP server connections at the same time (check the number in the AS manual) – gw01 + gw02 + engineering = 3"],
    ["Port", "502 (fixed); the ISPSoft / DIADesigner connection uses its own port"],
    ["Write protection", "none per range – the gateway writes only 200 … 226 (226 = its heartbeat every 1 s); our program rewrites 0 … 199 every scan"],
    ["Gateway alive", "no per-request flag in the program → map V1.1 gateway heartbeat D226 (decided 2026-11-13): the gateway writes +1 every second; network I1: D226 <> D1036 → MOV D226 D1036 + TOF 5 s = gateway OK"],
  ],
  siemens: [
    ["Instruction", "MB_SERVER (Communication → Others → MODBUS TCP) in OB1, called EVERY scan, with its own instance DB \"MB_SERVER_DB\""],
    ["CONNECT", "TCON_IP_v4 in a DB: InterfaceId = 64 (HW id of the PROFINET port, check), ID = 1 (unique per connection), ConnectionType = 11 (TCP), ActiveEstablished = FALSE (server), RemoteAddress 0.0.0.0 (any), RemotePort 0, LocalPort 502"],
    ["MB_HOLD_REG", "pointer to the holding-register area: a NON-optimized DB \"MB_HR\" (DB10, 227 words, typed struct exactly like the map V1.1, last member cmd_gwHeartbeat = DBW452) – P#DB10.DBX0.0 WORD 227 – or an Array[0..226] of Word in an optimized DB (MB_SERVER ≥ V4)"],
    ["Mapping", "holding register 0 (400001) = first word of MB_HOLD_REG. FC01 / FC05 = %Q, FC02 = %I, FC04 = %IW process image (NOT the DB!) – the gateway uses FC03; MB_SERVER V5 'Data_Area_Array' can map other areas to DBs (check)"],
    ["Big-endian", "S7 stores Int / DInt / Real big-endian → a Real in \"MB_HR\" is already ABCD, a DInt is already high word first – one MOVE per value"],
    ["Two clients", "gw01 + gw02: two MB_SERVER calls with two instance DBs and two CONNECT structs (ID 1 and 2), same port 502, same MB_HOLD_REG (check firmware ≥ V4)"],
    ["Connection resources", "S7-1200 has a limited number of open user communication connections (e.g. 8 – check the CPU data sheet) – the HMI, PG and MB_CLIENT also use some"],
    ["Outputs", "NDR (new data written) and DR (data read) = one-scan pulses → gateway watchdog (network I1); ERROR + STATUS (e.g. 16#80C3 = no resources – check the help)"],
    ["Protection", "CPU properties → Protection & Security → 'Permit access with PUT/GET' is NOT needed for Modbus; MB_SERVER cannot make registers read-only – our program rewrites 0 … 199 every scan"],
  ],
};

export const CHECKLIST = [
  ["Ping + port", "ping the PLC IP, open TCP 502 from the gateway (Modbus tool or tools/spst_gateway.py)", "reply < 5 ms in the machine VLAN, port open"],
  ["Map version", "FC03 read offset 0, quantity 1", "0x0101 (257) = map V1.1"],
  ["Type code + unit id", "FC03 read offsets 1 – 2", "type code of the IP plan (e.g. 12 = BS-TGR), unit id = item 4 IP plan (e.g. 15)"],
  ["Heartbeat", "read offset 3 for 10 s", "+10 ± 1 (1 per second); STOP the PLC → value frozen → gateway 'stale' after 3 s"],
  ["Word order REAL", "put the PLC in test mode, set last cycle time = 212.5 s, read 24 – 25", "0x4354 0x8000 (ABCD) – NOT 0x8000 0x4354 (CDAB)"],
  ["Word order UINT32", "set good counter = 70 000, read 20 – 21", "0x0001 0x1170 (high word first)"],
  ["Status word bits", "force each state (idle, run, set-up, alarm, e-stop, blocked, starved, key off)", "2, 1, 4, 8, 24 (alarm + e-stop copy), 32, 64, 128 – bit numbers as in guide 43 §7.5"],
  ["Order handshake OK", "gateway command 1 (order, part, qty 3, recipe 12): FC16 200 – 225, then FC06 REQ toggle", "ACK = REQ within ≤ 1 scan, ackSeq = seq, result 0, BUSY = 1, order + part copied to 26 – 45"],
  ["Handshake rejections", "command 1 with qty 0 · command 1 while busy · command 2 not in AUTO · code 9", "results 3 · 4 · 2 · 1, REJECT bit set"],
  ["REQ discipline", "write the data block but do NOT toggle REQ", "nothing happens (no ACK, no BUSY)"],
  ["Lot end + DONE", "run the lot of 3", "lotDone 1 → 2 → 3, then DONE toggles, BUSY 0, the MES books the confirmation"],
  ["Gateway heartbeat", "gateway running: read offset 226 (FC03, qty 1) for 10 s", "map V1.1: 226 counts +10 ± 1 (the gateway writes +1 per s with FC06), M_GWOK = 1, no H_GW"],
  ["Gateway lost", "pull the gateway cable / stop the gateway (or a V1.0 gateway that does not write 226)", "226 stops counting → after 5 s H_GW + HMI message, READY 0, the machine finishes its lot; reconnect → READY 1, DONE seen"],
  ["Two clients", "gw01 and gw02 poll at the same time", "both get answers; no ERROR at MB_SERVER (connection resources)"],
  ["Poll period vs scan", "read the fast block every 100 ms during a command", "no missed ACK (ACK stays until the next command), response < 20 ms"],
  ["Safety independence", "open a guard / press e-stop with the Ethernet cable unplugged", "the safety relay stops the machine anyway; status bit 4 only shows it when the network is back"],
];
