/* Ball screw + guide factory – item 8 PLC programs: shared library.
 *  - small helpers to write ladder programs in the format of web/ladder.js (contract docs/35)
 *  - buildIF(cfg): the STANDARD MACHINE INTERFACE (template FB "FB_BsfIf") as ladder networks – modes, status word, counters,
 *    cycle time, alarm word, heartbeat, gateway watchdog, MES order handshake (REQ / ACK / BUSY / DONE toggle bits), energy and the
 *    filling of the Modbus holding-register image of item 4's map (twin/bsf_comm_map.py · web/bsfcomm_map.js, map V1.1)
 *  - the register image (227 holding registers 0 – 226, 0-based) with the "memory overlay" of a real PLC: status bits ARE bits of D4 / D8,
 *    32-bit values are split into words, the command block 200 – 226 is written by the gateway (226 = gateway heartbeat, +1 per s)
 *  - makeGateway(): a small simulated Modbus TCP client (the gateway of item 4) that polls the image, writes the gateway heartbeat 226
 *    every 1 s (map V1.1, FC06) and sends MES commands
 *  - assemble(def): machine program + interface → { program, plant, onScan, img, gw }
 * Guide: docs/47_bsf_plc_programs.md. All addresses, times and values are EXAMPLES – check with your PLC configuration. */
import { MAPV, MAP_SIZE, typeMap, typeCode, realToRegs, regsToReal, asciiToRegs, regsToAscii, decodeValue, NET_BY_ID, RESULTS, CMD_CODES } from "./bsfcomm_map.js";

/* ------------------------------------------------------------------ tag + tree helpers */
export const I = (name, delta, siemens, comment, wire = "", init = false, extra = {}) => ({ name, dir: "I", type: "BOOL", delta, siemens, comment, wire, init, ...extra });
export const Q = (name, delta, siemens, comment, wire = "", extra = {}) => ({ name, dir: "Q", type: "BOOL", delta, siemens, comment, wire, init: false, ...extra });
export const M = (name, delta, siemens, comment, init = false, extra = {}) => ({ name, dir: "M", type: "BOOL", delta, siemens, comment, init, ...extra });
export const AI = (name, delta, siemens, comment, unit, min, max, init = 0, wire = "", extra = {}) => ({ name, dir: "AI", type: "REAL", delta, siemens, comment, unit, min, max, init, wire, ...extra });
export const AQ = (name, delta, siemens, comment, unit, min, max, wire = "", extra = {}) => ({ name, dir: "AQ", type: "REAL", delta, siemens, comment, unit, min, max, init: 0, wire, ...extra });
export const W = (name, delta, siemens, comment, unit = "", init = 0, type = "REAL", extra = {}) => ({ name, dir: "W", type, delta, siemens, comment, unit, init, ...extra });
export const T = (name, delta, siemens, comment, pt) => ({ name, dir: "T", delta, siemens, comment, pt });
export const C = (name, delta, siemens, comment, pv) => ({ name, dir: "C", delta, siemens, comment, pv });
export const NO = (t) => ({ c: "NO", t });
export const NC = (t) => ({ c: "NC", t });
export const PE = (t) => ({ c: "P", t });
export const NE = (t) => ({ c: "N", t });
export const CMP = (cmp, a, b) => ({ cmp, a, b });
export const TON = (t) => ({ b: "TON", t });
export const TOF = (t) => ({ b: "TOF", t });
export const TP = (t) => ({ b: "TP", t });
export const CTU = (t, r) => ({ b: "CTU", t, r });
export const S = (...x) => ({ s: x });
export const P = (...x) => ({ p: x });
export const OUT = (t) => ({ o: "OUT", t });
export const SET = (t) => ({ o: "SET", t });
export const RST = (t) => ({ o: "RST", t });
export const CALC = (calc, to) => ({ calc, to });
export const MOV = (mov, to) => ({ mov, to });
export const R = (inp, ...out) => ({ in: inp, out });
export const N = (title, comment, ...rungs) => ({ title, comment, rungs });
export const lag = (x, target, tau, dt) => x + (target - x) * Math.min(1, dt / Math.max(tau, 1e-6));
export function delayBit(onDelay, offDelay = onDelay) {
  let out = false, t = 0;
  const f = (inp, dt) => { if (inp === out) { t = 0; return out; } t += dt; if (t >= (inp ? onDelay : offDelay)) { out = inp; t = 0; } return out; };
  f.reset = () => { out = false; t = 0; };
  return f;
}

/* system bits shared by every program (Delta AS: SM400 / SM402 – DVP: M1000 / M1002 / M1013 / M1012; Siemens: system + clock memory bytes) */
export const SYS_TAGS = () => [
  M("ON", "SM400 (AS) / M1000 (DVP)", "%M1.2 \"AlwaysTRUE\"", "Always-ON bit (Siemens: system memory byte MB1 – enable it in the CPU properties)", true, { sys: "on" }),
  M("FIRST", "SM402 (AS) / M1002 (DVP)", "%M1.0 \"FirstScan\"", "TRUE in the first scan after STOP → RUN only", false, { sys: "first" }),
  M("CLK1", "SM 1 s clock bit (check AS manual) / M1013 (DVP)", "%M0.5 \"Clock_1Hz\"", "1 Hz clock bit (Siemens: clock memory byte MB0 – enable it in the CPU properties)", false, { sys: "clk1" }),
  M("CLK10", "SM 0.1 s clock bit (check AS manual) / M1012 (DVP)", "%M0.0 \"Clock_10Hz\"", "10 Hz clock bit (100 ms period) – the sample clock for energy and measurement sums"),
];

/* ------------------------------------------------------------------ register image */
const RNAME = (n) => "HR_" + n;
const STATUS_BITS = ["SW_RUN", "SW_IDLE", "SW_SETUP", "SW_ALARM", "SW_ESTOP", "SW_BLOCKED", "SW_STARVED", "SW_OFF"];
const HS_BITS = ["HS_ACK", "HS_BUSY", "HS_DONE", "HS_REJ", "HS_READY"];
export const STATUS_TXT = ["RUN", "IDLE", "SET-UP", "ALARM", "E-STOP (copy)", "BLOCKED", "STARVED", "NO SHIFT"];
export const HS_TXT = ["ACK", "BUSY", "DONE", "REJECT", "READY"];
/** status word value for a set of bit numbers, e.g. statusWord([0]) = 1, statusWord([3, 4]) = 24 */
export const statusWord = (bits) => bits.reduce((s, b) => s | (1 << b), 0);

export function makeImage(type, unit) {
  const regs = typeMap(type);
  const HR = new Array(MAP_SIZE).fill(0);
  const img = { type, unit, regs, HR, order: "", part: "", changed: new Map(), t: 0 };
  img.values = () => regs.map((r) => ({ ...r, raw: HR.slice(r.addr, r.addr + r.n), value: decodeValue(r.type, HR.slice(r.addr, r.addr + r.n)) }));
  img.get = (name) => { const r = regs.find((x) => x.name === name); return r ? decodeValue(r.type, HR.slice(r.addr, r.addr + r.n)) : undefined; };
  img.reset = () => { HR.fill(0); img.order = ""; img.part = ""; img.changed.clear(); };
  return img;
}

/* ------------------------------------------------------------------ the standard interface (FB_BsfIf) */
/**
 * cfg = { type, mid (machine id, e.g. "BS-TGR-03"), hooks: { inCycle, partDone, partOk, alarm, alarmCode, partPresent, power },
 *         process: [[ "ind.power_kW", "TAG" ], …] (fields of item 4's map, REAL or UINT16) }
 * returns { tags, networks, img, put32 }
 */
export function buildIF(cfg) {
  const h = cfg.hooks;
  const unit = (NET_BY_ID[cfg.mid] || { unit: 0 }).unit;
  const img = makeImage(cfg.type, unit);
  const reg = (name) => img.regs.find((r) => r.name === name);
  const tags = [
    I("S_ON", "X1.0", "%I8.0", "Control ON key switch -SA1 (machine in shift; OFF = status 'no shift')", "-SA1 13/14 → SM 1221 / AS16AM10N-A", true, { group: "Operator panel (standard interface)" }),
    I("S_AUTO", "X1.1", "%I8.1", "Mode selector -SA2 position AUTO (3-position: MANUAL / AUTO / SET-UP)", "-SA2 13/14", true, { group: "Operator panel (standard interface)" }),
    I("S_SETUP", "X1.2", "%I8.2", "Mode selector -SA2 position SET-UP", "-SA2 23/24", false, { group: "Operator panel (standard interface)" }),
    I("S_START", "X1.3", "%I8.3", "Cycle start push button -SF2 (NO) – local start (the MES can also start with command 2)", "-SF2 13/14", false, { ui: "push", group: "Operator panel (standard interface)" }),
    I("S_STOP", "X1.4", "%I8.4", "Stop push button -SF1 (NC contact: wire break = stop) – stops at the end of the cycle", "-SF1 11/12", true, { ui: "push", group: "Operator panel (standard interface)" }),
    I("S_ACK", "X1.5", "%I8.5", "Alarm acknowledge push button -SF3 (NO)", "-SF3 13/14", false, { ui: "push", group: "Operator panel (standard interface)" }),
    I("ESTOP_OK", "X1.6", "%I8.6", "Safety relay -KF1 status 'e-stop chain + guards healthy' (INFO ONLY – the relay switches the power itself)", "-KF1 13/14 (PNOZ / SRB / PSR)", true, { group: "Faults + signals (click to simulate)" }),
    I("B_OUTFULL", "X1.7", "%I8.7", "Out-buffer / conveyor full (finished part cannot leave → status BLOCKED)", "-BG9 photo sensor", false, { group: "Faults + signals (click to simulate)" }),
    I("GW_POLL", "– (Delta AS: no per-request flag – network I1 uses D226)", "\"MB_SERVER_DB\".DR OR .NDR", "Pulse for every Modbus request of the gateway – Siemens option only (MB_SERVER outputs DR / NDR, may be put in parallel to M_GWHB in network I1). Not used by the template: the common method for both PLCs is the gateway heartbeat register 226 (map V1.1). The simulated gateway drives it.", "Ethernet port X1 (PROFINET / LAN)", false, { ui: "sensor", group: "Gateway / Modbus TCP" }),
    Q("H_RUN", "Y1.0", "%Q8.0", "Lamp green -PF1: machine running / ready", "-PF1"),
    Q("H_ALM", "Y1.1", "%Q8.1", "Lamp red -PF2: alarm (blinks until acknowledged)", "-PF2"),
    Q("H_GW", "Y1.2", "%Q8.2", "Lamp amber -PF3 / HMI message: gateway lost (gateway heartbeat 226 unchanged for 5 s) – machine finishes the lot, no new order", "-PF3"),
    Q("H_RDY", "Y1.3", "%Q8.3", "Lamp blue -PF4: ready for a MES order", "-PF4"),
    // interface memory (Delta M200… / Siemens DB "BsfIf")
    M("M_NEW", "M200", "\"BsfIf\".NewCmd", "New command: REQ (cmd.ctl bit 0) differs from ACK (hs.status bit 0)"),
    M("M_CMDSTART", "M201", "\"BsfIf\".CmdStart", "Command 2 'start' accepted (one scan)"),
    M("M_CMDSTOP", "M202", "\"BsfIf\".CmdStop", "Command 3 'stop at end of cycle' accepted (one scan)"),
    M("M_CMDACK", "M203", "\"BsfIf\".CmdAck", "Command 4 'acknowledge alarm' accepted (one scan)"),
    M("M_BMOV", "M204", "\"BsfIf\".CopyOrder", "Copy order + part (20 registers 203 – 222 → 26 – 45): Delta BMOV D203 D26 K20 · Siemens MOVE_BLK"),
    M("M_ACKP", "M205", "\"BsfIf\".AckPulse", "Acknowledge pulse: local push button (rising edge) OR MES command 4"),
    M("M_RUNREQ", "M206", "\"BsfIf\".RunReq", "Run request (seal-in): AUTO, started, no alarm, safety OK"),
    M("M_EOC", "M207", "\"BsfIf\".StopEoc", "Stop at the end of the cycle requested (command 3)"),
    M("M_EOCX", "M208", "\"BsfIf\".StopNow", "Stop request AND the cycle is finished → drop the run request"),
    M("M_ENABLE", "M209", "\"BsfIf\".Enable", "A NEW cycle may start: run request AND MES lot loaded (BUSY) AND no stop request"),
    M("M_LOTEND", "M210", "\"BsfIf\".LotEnd", "Lot finished (lotDone ≥ lot quantity) – one scan"),
    M("M_GWOK", "M211", "\"BsfIf\".GwOk", "Gateway alive (gateway heartbeat 226 changed in the last 5 s)"),
    M("M_DOWN", "M212", "\"BsfIf\".Down", "Machine DOWN: alarm active or e-stop chain open"),
    M("M_GWHB", "M213", "\"BsfIf\".GwHbChg", "Gateway heartbeat 226 changed in this scan (one-scan pulse, about once per second)"),
    // status word bits = bits of holding register 4 (Delta D4.b · Siemens slice access "MB_HR".std_status.%Xb)
    ...STATUS_BITS.map((n, b) => M(n, `D4.${b}`, `"MB_HR".std_status.%X${b}`, `std.status bit ${b} = ${STATUS_TXT[b]} (value ${1 << b})`)),
    ...HS_BITS.map((n, b) => M(n, `D8.${b}`, `"MB_HR".hs_status.%X${b}`, `hs.status bit ${b} = ${HS_TXT[b]}`)),
    // command block (written by the gateway, read by the PLC)
    W("CMD_CODE", "D200", "\"MB_HR\".cmd_code", "cmd.code 1 load order, 2 start, 3 stop, 4 ack alarm, 5 recipe (written by the gateway)", "", 0, "WORD"),
    W("CMD_SEQ", "D201", "\"MB_HR\".cmd_seq", "cmd.seq message counter (MES +1 per command)", "", 0, "WORD"),
    M("CMD_REQ", "D202.0", "\"MB_HR\".cmd_ctl.%X0", "cmd.ctl bit 0 = REQ toggle (written LAST by the gateway)"),
    W("CMD_ORD0", "D203", "\"MB_HR\".cmd_order[0]", "first word of cmd.order (2 ASCII characters) – 0 = empty order", "", 0, "WORD"),
    W("CMD_RECIPE", "D223", "\"MB_HR\".cmd_recipe", "cmd.recipe recipe / NC program no.", "", 0, "WORD"),
    W("CMD_QH", "D224", "\"MB_HR\".cmd_lotQty (high word)", "cmd.lotQty high word (UINT32, high word first)", "", 0, "WORD"),
    W("CMD_QL", "D225", "\"MB_HR\".cmd_lotQty (low word)", "cmd.lotQty low word", "", 0, "WORD"),
    W("GW_HB", "D226", "\"MB_HR\".cmd_gwHeartbeat", "map V1.1: gateway heartbeat – written by the GATEWAY with FC06 once per second, +1 per write, wraps 65535 → 0", "", 0, "WORD"),
    W("GW_HBOLD", "D1036", "\"BsfIf\".GwHbOld", "last seen value of the gateway heartbeat 226 (for the change detection)", "", 0, "WORD"),
    W("CMD_QTY", "D1030 (32 bit)", "\"BsfIf\".CmdQty (DInt)", "lot quantity of the command = high × 65536 + low", "pcs", 0, "DINT"),
    W("RESULT", "D1032", "\"BsfIf\".Result", "result of the command: 0 OK, 1 unknown, 2 not ready, 3 bad data, 4 busy", "", 0, "INT"),
    W("RECIPE", "D1033", "\"BsfIf\".Recipe", "active recipe / NC program no.", "", 0, "INT"),
    W("LOT_QTY", "D1034 (32 bit)", "\"BsfIf\".LotQty (DInt)", "quantity of the running MES lot", "pcs", 0, "DINT"),
    W("GOOD", "D1010 (32 bit)", "\"BsfIf\".Good (UDInt)", "good parts counter (retentive!)", "pcs", 0, "DINT"),
    W("SCRAP", "D1012 (32 bit)", "\"BsfIf\".Scrap (UDInt)", "scrap counter (retentive!)", "pcs", 0, "DINT"),
    W("LASTCYC", "D1014 (float)", "\"BsfIf\".LastCycle (Real)", "last cycle time (cycle start → part done)", "s", 0, "REAL"),
    W("E_KWH", "D1018 (float)", "\"BsfIf\".Energy (Real)", "energy counter (retentive!) = Σ power × 1 s / 3600", "kWh", 0, "REAL"),
    T("T_CYC", "T100", "\"IDB_T_Cyc\" (TON)", "cycle-time stopwatch (PT 3000 s – longer than any cycle; Delta T100 counts 100 ms ticks)", 3000),
    T("T_GW", "T101", "\"IDB_T_Gw\" (TOF)", "gateway watchdog: stays TRUE 5 s after the last change of the gateway heartbeat 226", 5.0),
  ];
  const sieF = (n) => { const r = img.regs.find((x) => x.addr === n); return `"MB_HR".${String(r ? r.name : "reg" + n).replace(".", "_")}`; };
  const hr = (n, comment, type = "WORD", init = 0) => { tags.push(W(RNAME(n), `D${n}`, sieF(n), comment || `holding register ${n}`, "", init, type, { hideIO: true, hr: n })); return RNAME(n); };
  [0, 1, 2, 3, 5, 6, 7, 9, 10, 11].forEach((n) => hr(n, `holding register ${n} = ${(img.regs.find((x) => x.addr === n) || {}).name}`));
  const put32 = []; // [{ src, addr, kind }]
  function split32(src, addr, kind, deltaSrc) {
    const st0 = (cfg.srcTags || []).find((t) => t.name === src);
    const mm = String(deltaSrc || (st0 && st0.delta) || "").match(/^D(\d+)/);
    const lo = mm ? +mm[1] : 1100 + 2 * put32.length;
    const hName = src + "_H", lName = src + "_L";
    tags.push(W(hName, `D${lo + 1}`, kind === "real" ? `(Siemens: not needed – see guide §9.3)` : `"BsfIf".${src}.%W1`, `high word of ${src} (Delta: a 32-bit value has its LOW word in the lower D register!)`, "", 0, "WORD", { hideIO: true, alias: { of: src, part: "hi", kind } }));
    tags.push(W(lName, `D${lo}`, kind === "real" ? `(Siemens: not needed – see guide §9.3)` : `"BsfIf".${src}.%W0`, `low word of ${src}`, "", 0, "WORD", { hideIO: true, alias: { of: src, part: "lo", kind } }));
    const r = img.regs.find((x) => x.addr === addr);
    tags.push(W(RNAME(addr), `D${addr}`, `${sieF(addr)} (high word)`, `register ${addr} = high word of ${r ? r.name : src}`, "", 0, "WORD", { hideIO: true, hr: addr }));
    tags.push(W(RNAME(addr + 1), `D${addr + 1}`, `${sieF(addr)} (low word)`, `register ${addr + 1} = low word of ${r ? r.name : src}`, "", 0, "WORD", { hideIO: true, hr: addr + 1 }));
    put32.push({ src, addr, kind });
    return [MOV(hName, RNAME(addr)), MOV(lName, RNAME(addr + 1))];
  }
  const tagOf = (n) => tags.find((t) => t.name === n);
  const m32 = (src, field, deltaSrc) => { const r = reg(field); return split32(src, r.addr, r.type === "REAL" ? "real" : "u32", deltaSrc); };
  const moves32 = [...m32("GOOD", "std.good", "D1010"), ...m32("SCRAP", "std.scrap", "D1012"), ...m32("LASTCYC", "std.lastCycle_s", "D1014")];
  const movesEn = [...m32(h.power, "std.power_kW", "D1016"), ...m32("E_KWH", "std.energy_kWh", "D1018")];
  const procMoves = [];
  (cfg.process || []).forEach(([field, src, dsrc], i) => {
    const r = reg(field); if (!r) throw new Error("buildIF: unknown map field " + field);
    if (r.n === 2) procMoves.push(...split32(src, r.addr, r.type === "REAL" ? "real" : "u32", dsrc));
    else { hr(r.addr, `register ${r.addr} = ${r.name}`); procMoves.push(MOV(src, RNAME(r.addr))); }
  });
  const ex = (k) => h[k];
  const nets = [
    N("I1 – Gateway watchdog (gateway heartbeat 226 changed within 5 s?)",
      "Map V1.1: the gateway writes register 226 (FC06) once per second, +1 per write. Rung 1: 226 ≠ last seen value → one-scan pulse M_GWHB and remember the value (Delta: D226 <> D1036 → MOV D226 D1036). Rung 2: TOF keeps GwOk TRUE 5 s after the last change. Gateway lost (or a gateway without the heartbeat) → message, the machine FINISHES its lot, but READY = 0 → no new order. Same network on Delta and Siemens; Siemens may put MB_SERVER DR OR NDR (GW_POLL) in parallel to M_GWHB (guide §6.2).",
      R(CMP("<>", "GW_HB", "GW_HBOLD"), OUT("M_GWHB"), MOV("GW_HB", "GW_HBOLD")),
      R(S(NO("M_GWHB"), TOF("T_GW")), OUT("M_GWOK")),
      R(NC("M_GWOK"), OUT("H_GW"))),
    N("I2 – New command? (toggle bit REQ ≠ ACK)",
      "The gateway writes the data first (FC16 200 – 225) and toggles REQ LAST (FC06 202). A new command = REQ differs from our ACK (XOR). The PLC handles it in ONE scan and answers ACK = REQ at the end (network I6).",
      R(P(S(NO("CMD_REQ"), NC("HS_ACK")), S(NC("CMD_REQ"), NO("HS_ACK"))), OUT("M_NEW"), CALC("CMD_QH*65536+CMD_QL", "CMD_QTY"), MOV(1, "RESULT"))),
    N("I3 – Check command 1 'load order' (result 0 / 2 / 4 / 3)",
      "Default result 1 = unknown command (set in I2). For code 1 the LAST matching MOVE wins: 0 OK → 2 not ready (not AUTO, alarm, gateway lost) → 4 busy (a lot is running) → 3 bad data (empty order, quantity 0 or > 100 000).",
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 1)), MOV(0, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 1), P(NC("S_AUTO"), NO("M_DOWN"), NC("S_ON"))), MOV(2, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 1), NO("HS_BUSY")), MOV(4, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 1), P(CMP("==", "CMD_ORD0", 0), CMP("<=", "CMD_QTY", 0), CMP(">", "CMD_QTY", 100000))), MOV(3, "RESULT"))),
    N("I4 – Check commands 2 start · 3 stop · 4 ack alarm · 5 recipe",
      "Start needs AUTO, no alarm and a loaded lot (else 2 not ready). Stop and acknowledge are always accepted. Recipe 0 = bad data (3); a recipe change during a lot = busy (4).",
      R(S(NO("M_NEW"), P(CMP("==", "CMD_CODE", 2), CMP("==", "CMD_CODE", 3), CMP("==", "CMD_CODE", 4), CMP("==", "CMD_CODE", 5))), MOV(0, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 2), P(NC("S_AUTO"), NO("M_DOWN"), NC("HS_BUSY"))), MOV(2, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 5), NO("HS_BUSY")), MOV(4, "RESULT")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 5), CMP("==", "CMD_RECIPE", 0)), MOV(3, "RESULT"))),
    N("I5 – Execute the accepted command",
      "Only with result 0. Load order: copy order + part (BMOV / MOVE_BLK 20 words), recipe and quantity, lotDone := 0, BUSY := 1. Start / stop / acknowledge give one-scan pulses for the networks below. Stop (3) also ends the MES lot (BUSY := 0) per guide 43 §8.4.",
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 1), CMP("==", "RESULT", 0)), OUT("M_BMOV"), MOV("CMD_RECIPE", "RECIPE"), MOV("CMD_QTY", "LOT_QTY"), MOV(0, RNAME(11)), SET("HS_BUSY")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 2), CMP("==", "RESULT", 0)), OUT("M_CMDSTART")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 3), CMP("==", "RESULT", 0)), OUT("M_CMDSTOP"), RST("HS_BUSY")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 4), CMP("==", "RESULT", 0)), OUT("M_CMDACK")),
      R(S(NO("M_NEW"), CMP("==", "CMD_CODE", 5), CMP("==", "RESULT", 0)), MOV("CMD_RECIPE", "RECIPE"))),
    N("I6 – Answer: ackSeq, result, REJECT, then ACK := REQ (LAST)",
      "Copy cmd.seq to hs.ackSeq and the result to hs.result, set REJECT if result ≠ 0. ACK follows REQ in the SAME scan, written last – the gateway sees ACK = REQ and ackSeq = seq at its next poll (100 ms).",
      R(NO("M_NEW"), MOV("CMD_SEQ", RNAME(9)), MOV("RESULT", RNAME(10))),
      R(S(NO("M_NEW"), CMP("<>", "RESULT", 0)), SET("HS_REJ")),
      R(S(NO("M_NEW"), CMP("==", "RESULT", 0)), RST("HS_REJ")),
      R(S(NO("M_NEW"), NO("CMD_REQ")), SET("HS_ACK")),
      R(S(NO("M_NEW"), NC("CMD_REQ")), RST("HS_ACK"))),
    N("I7 – Modes, acknowledge, run request (seal-in), stop at end of cycle",
      "Run request = classic seal-in: local start OR MES start; broken by the NC stop button, MANUAL / SET-UP, alarm, open safety chain, or 'stop at end of cycle' once the cycle is over. Enable = a NEW cycle may start (also needs a loaded MES lot).",
      R(P(PE("S_ACK"), NO("M_CMDACK")), OUT("M_ACKP")),
      R(NO("M_CMDSTOP"), SET("M_EOC")),
      R(NO("M_CMDSTART"), RST("M_EOC")),
      R(S(NO("M_EOC"), NC(ex("inCycle"))), OUT("M_EOCX")),
      R(S(P(NO("S_START"), NO("M_CMDSTART"), NO("M_RUNREQ")), NO("S_STOP"), NO("S_AUTO"), NC("S_SETUP"), NO("S_ON"), NC("M_DOWN"), NC("M_EOCX")), OUT("M_RUNREQ")),
      R(NC("M_RUNREQ"), RST("M_EOC")),
      R(S(NO("M_RUNREQ"), NO("HS_BUSY"), NC("M_EOC")), OUT("M_ENABLE"))),
    N("I8 – Machine state → status word bits (holding register 4) + READY",
      "Priority: no shift > alarm / e-stop > set-up > run > blocked > starved > idle – exactly one state bit is TRUE (bit 4 e-stop is an extra copy for display). The bits ARE the bits of D4 / \"MB_HR\".std_status, so the word is packed by the memory itself. READY (hs bit 4) = may receive an order.",
      R(P(NO(ex("alarm")), NC("ESTOP_OK")), OUT("M_DOWN")),
      R(NC("S_ON"), OUT("SW_OFF")),
      R(S(NO("S_ON"), NO("M_DOWN")), OUT("SW_ALARM")),
      R(NC("ESTOP_OK"), OUT("SW_ESTOP")),
      R(S(NO("S_ON"), NC("M_DOWN"), NO("S_SETUP")), OUT("SW_SETUP")),
      R(S(NO("S_ON"), NC("M_DOWN"), NC("S_SETUP"), NO(ex("inCycle"))), OUT("SW_RUN")),
      R(S(NO("S_ON"), NC("M_DOWN"), NC("S_SETUP"), NC(ex("inCycle")), NO("B_OUTFULL")), OUT("SW_BLOCKED")),
      R(S(NO("S_ON"), NC("M_DOWN"), NC("S_SETUP"), NC(ex("inCycle")), NC("B_OUTFULL"), NO("M_ENABLE"), NC(ex("partPresent"))), OUT("SW_STARVED")),
      R(S(NO("S_ON"), NC("SW_ALARM"), NC("SW_SETUP"), NC("SW_RUN"), NC("SW_BLOCKED"), NC("SW_STARVED")), OUT("SW_IDLE")),
      R(S(NO("S_ON"), NO("S_AUTO"), NC("S_SETUP"), NC("M_DOWN"), NC("HS_BUSY"), NO("M_GWOK")), OUT("HS_READY"), OUT("H_RDY"))),
    N("I9 – State code, mode, alarm code → registers 5 / 6 / 7",
      "std.mode: 0 manual, 1 auto, 2 set-up. std.stateCode: 0 OFF 1 IDLE 2 RUN 3 SETUP 4 DOWN 5 BLOCKED 6 STARVED (same order as item 3). std.alarm = the alarm code of the machine program (0 = none). Lamps: green = run request, red blinks (1 Hz) while DOWN.",
      R(NO("SW_OFF"), MOV(0, RNAME(6))), R(NO("SW_IDLE"), MOV(1, RNAME(6))), R(NO("SW_RUN"), MOV(2, RNAME(6))), R(NO("SW_SETUP"), MOV(3, RNAME(6))),
      R(NO("SW_ALARM"), MOV(4, RNAME(6))), R(NO("SW_BLOCKED"), MOV(5, RNAME(6))), R(NO("SW_STARVED"), MOV(6, RNAME(6))),
      R(S(NC("S_AUTO"), NC("S_SETUP")), MOV(0, RNAME(5))), R(S(NO("S_AUTO"), NC("S_SETUP")), MOV(1, RNAME(5))), R(NO("S_SETUP"), MOV(2, RNAME(5))),
      R(NO("ON"), MOV(ex("alarmCode"), RNAME(7))),
      R(NO("M_RUNREQ"), OUT("H_RUN")),
      R(S(NO("M_DOWN"), NO("CLK1")), OUT("H_ALM"))),
    N("I10 – Part counters + cycle time",
      "At the part-done pulse of the machine program: good OR scrap +1 (32-bit, retentive). The cycle-time stopwatch runs while the machine is in its cycle; its elapsed time is copied at the part-done pulse – BEFORE the timer rung, because the timer resets when the cycle bit drops (rung order matters!). Delta: T100 counts 100 ms ticks → FLT + DEDIV by 10 for seconds.",
      R(S(NO(ex("partDone")), NO(ex("partOk"))), CALC("GOOD+1", "GOOD")),
      R(S(NO(ex("partDone")), NC(ex("partOk"))), CALC("SCRAP+1", "SCRAP")),
      R(NO(ex("partDone")), MOV("T_CYC", "LASTCYC")),
      R(S(NO(ex("inCycle")), TON("T_CYC")))),
    N("I11 – MES lot: lotDone, end of lot, DONE toggle",
      "Every finished piece (good + scrap) of the MES lot counts. lotDone ≥ lot quantity → BUSY := 0 and DONE toggles (XOR with itself): the gateway sees a CHANGE of hs.status bit 2 and the MES books the confirmation.",
      R(S(NO(ex("partDone")), NO("HS_BUSY")), CALC(RNAME(11) + "+1", RNAME(11))),
      R(S(NO("HS_BUSY"), CMP(">", "LOT_QTY", 0), CMP(">=", RNAME(11), "LOT_QTY")), OUT("M_LOTEND")),
      R(P(S(NO("HS_DONE"), NC("M_LOTEND")), S(NC("HS_DONE"), NO("M_LOTEND"))), OUT("HS_DONE")),
      R(NO("M_LOTEND"), RST("HS_BUSY"))),
    N("I12 – Header + heartbeat (registers 0 – 3) + energy",
      "First scan: map version 0x0101 = 257 (V1.1), type code, unit id. Heartbeat +1 every second (rising edge of the 1 Hz clock), 65535 → 0. Frozen heartbeat = PLC program stopped (the comm. processor may still answer with old values!). Energy: kWh += kW / 3600 every second.",
      R(NO("FIRST"), MOV(MAPV, RNAME(0)), MOV(typeCode(cfg.type), RNAME(1)), MOV(unit, RNAME(2))),
      R(PE("CLK1"), CALC(RNAME(3) + "+1", RNAME(3)), CALC("E_KWH+" + h.power + "/3600", "E_KWH")),
      R(CMP(">", RNAME(3), 65535), MOV(0, RNAME(3)))),
    N("I13 – Counters + cycle time → registers 20 – 25 (32 bit, high word first)",
      "Map: UINT32 and REAL = 2 registers, HIGH word first (ABCD). Delta stores a 32-bit value with the LOW word in the lower D register (D1010 = low, D1011 = high) → the words must be swapped: MOV D1011 D20, MOV D1010 D21. Siemens stores big-endian: one MOVE of the UDInt / Real into the non-optimized DB \"MB_HR\" is already ABCD.",
      R(NO("ON"), ...moves32)),
    N("I14 – Power + energy → registers 100 – 103 (REAL, ABCD)",
      "Same word swap for the REAL values power kW and energy kWh (energy block, polled every 10 s).",
      R(NO("ON"), ...movesEn)),
  ];
  if (procMoves.length) {
    const per = 6;
    for (let i = 0; i < procMoves.length; i += per) {
      const part = procMoves.slice(i, i + per);
      const regsTxt = part.map((m) => m.to).filter((t) => tagOf(t) && tagOf(t).hr !== undefined).map((t) => tagOf(t).hr);
      nets.push(N(`I${nets.length + 1} – Process values → registers ${Math.min(...regsTxt)} – ${Math.max(...regsTxt)} (${cfg.type} signal groups)`,
        "The process values of the machine type, in the order of item 4's map (starting at offset 46). REAL = 2 words, word-swapped on Delta; UINT16 = one MOVE.",
        R(NO("ON"), ...part)));
    }
  }
  /* overlay: what the PLC memory does by itself */
  const aliasTags = tags.filter((t) => t.alias);
  const hrTags = tags.filter((t) => t.hr !== undefined);
  function overlayIn(st) {
    const H = img.HR;
    st.CMD_CODE = H[200]; st.CMD_SEQ = H[201]; st.CMD_REQ = !!(H[202] & 1); st.CMD_ORD0 = H[203]; st.CMD_RECIPE = H[223]; st.CMD_QH = H[224]; st.CMD_QL = H[225]; st.GW_HB = H[226];
    for (const t of aliasTags) {
      const v = +st[t.alias.of] || 0;
      if (t.alias.kind === "real") { const w = realToRegs(v); st[t.name] = t.alias.part === "hi" ? w[0] : w[1]; }
      else { const x = Math.max(0, Math.round(v)) >>> 0; st[t.name] = t.alias.part === "hi" ? (x >>> 16) & 0xffff : x & 0xffff; }
    }
  }
  function overlayOut(st) {
    const H = img.HR;
    if (st.M_BMOV) {   // BMOV D203 D26 K20 – order (10 words) + part (10 words)
      img.order = regsToAscii(H.slice(203, 213)); img.part = regsToAscii(H.slice(213, 223));
      for (let i = 0; i < 20; i++) H[26 + i] = H[203 + i];
    }
    // alias words are the SAME memory as the 32-bit value (no delay in a real PLC): refresh them and the word moves of I13 / I14 / process
    for (const t of aliasTags) {
      const v = +st[t.alias.of] || 0;
      if (t.alias.kind === "real") { const w = realToRegs(v); st[t.name] = t.alias.part === "hi" ? w[0] : w[1]; }
      else { const x = Math.max(0, Math.round(v)) >>> 0; st[t.name] = t.alias.part === "hi" ? (x >>> 16) & 0xffff : x & 0xffff; }
    }
    for (const q of put32) { st[RNAME(q.addr)] = st[q.src + "_H"]; st[RNAME(q.addr + 1)] = st[q.src + "_L"]; }
    for (const t of hrTags) H[t.hr] = (Math.round(+st[t.name] || 0) % 65536 + 65536) % 65536;
    H[4] = STATUS_BITS.reduce((s, n, b) => s | (st[n] ? 1 << b : 0), 0);
    H[8] = HS_BITS.reduce((s, n, b) => s | (st[n] ? 1 << b : 0), 0);
  }
  return { tags, networks: nets, img, overlayIn, overlayOut, put32 };
}

/* ------------------------------------------------------------------ simulated gateway (Modbus TCP client of item 4) */
export function makeGateway(img, opts = {}) {
  const H = img.HR;
  const G = {
    lost: false, auto: opts.auto !== false, fastMs: 100, slowMs: 500, timeout: 3, qty: opts.qty || 3, recipe: opts.recipe || 12, part: opts.part || "BS-3210-1000-C5",
    lotNo: 0, seq: 0, cur: null, queue: [], log: [], lastPoll: -1, pulse: false, lastDone: null, waitUntil: 2, results: [], polls: 0, frames: 0, onLog: null,
    hbMs: 1000, lastHb: -1, hbWrites: 0, noHb: false,   // map V1.1 gateway heartbeat (FC06 226 every 1 s); noHb = an old V1.0 gateway (polls, but no 226)
  };
  const L = (t, s) => { const e = { t, s }; G.log.unshift(e); if (G.log.length > 60) G.log.pop(); if (G.onLog) G.onLog(e); };
  const fmt = (t) => t.toFixed(2) + " s";
  G.send = (code, extra = {}) => { G.queue.push({ code, ...extra }); };
  G.loadOrder = (qty = G.qty, recipe = G.recipe, order) => { G.lotNo++; G.send(1, { order: order || `WO-${String(G.lotNo).padStart(5, "0")}-L01`, part: G.part, recipe, qty }); };
  G.reset = () => { G.cur = null; G.queue = []; G.log = []; G.lastPoll = -1; G.pulse = false; G.lastDone = null; G.waitUntil = 2; G.seq = 0; G.lotNo = 0; G.results = []; G.polls = 0; G.frames = 0; G.lastHb = -1; G.hbWrites = 0; };
  G.step = (t) => {
    G.pulse = false;
    if (G.lost) return;
    if (!G.noHb && (G.lastHb < 0 || t - G.lastHb >= G.hbMs / 1000 - 1e-9)) {   // FC06 write 226: gateway heartbeat +1 (wraps 65535 → 0)
      H[226] = (H[226] + 1) & 0xffff; G.lastHb = t; G.hbWrites++; G.frames++; G.pulse = true;
      if (G.hbWrites % 30 === 1) L(t, `FC06 write 226 = ${H[226]} (gateway heartbeat, +1 every ${G.hbMs / 1000} s – the PLC watchdog sees it change)`);
    }
    const c = G.cur;
    if (c && c.phase === "req") {                     // FC06 write 202: toggle REQ – its own frame, ≥ 1 PLC scan after the data
      H[202] ^= 1; c.tReq = t; c.phase = "wait"; G.frames++; G.pulse = true; G.lastPoll = t;
      L(t, `FC06 write 202 = ${H[202]} (REQ toggled, LAST) – seq ${c.seq}`); return;
    }
    const per = (c ? G.fastMs : G.slowMs) / 1000;
    if (G.lastPoll >= 0 && t - G.lastPoll < per - 1e-9) return;
    G.lastPoll = t; G.pulse = true; G.polls++; G.frames++;
    const hs = H[8], done = (hs >> 2) & 1;
    if (G.lastDone !== null && done !== G.lastDone) { L(t, `FC03 0–11: DONE toggled (${G.lastDone} → ${done}) – lot finished, lotDone ${H[11]} → MES confirmation (HTTP)`); G.waitUntil = t + 2; G.results.push({ t, kind: "done", lotDone: H[11] }); }
    G.lastDone = done;
    if (c && c.phase === "wait") {
      if ((H[8] & 1) === (H[202] & 1) && H[9] === c.seq) {
        const r = H[10]; c.tAck = t; G.results.push({ t, kind: "ack", code: c.code, seq: c.seq, result: r, dt: t - c.tReq, tData: c.tData });
        L(t, `FC03 8–11: ACK = REQ, ackSeq ${H[9]}, result ${r} ${RESULTS[r] || "?"} – ${Math.round((t - c.tReq) * 1000)} ms after REQ`);
        G.cur = null;
      } else if (t - c.tReq > G.timeout) { L(t, `handshake time-out (no ACK within ${G.timeout} s) – PLC program stopped?`); G.results.push({ t, kind: "timeout", code: c.code }); G.cur = null; }
      return;
    }
    if (!G.cur && !G.queue.length && G.auto && t >= G.waitUntil && (H[8] & 16) && !(H[8] & 2)) { G.loadOrder(); G.send(2); }
    if (!G.cur && G.queue.length) {
      const n = G.queue.shift();
      if ((H[202] & 1) !== (H[8] & 1)) { L(t, "previous command still open (REQ ≠ ACK) – not written"); return; }
      n.seq = G.seq = (G.seq + 1) & 0xffff; n.phase = "req"; n.tData = t; G.cur = n;
      H[200] = n.code; H[201] = n.seq;
      const o = asciiToRegs(n.order || "", 10), p = asciiToRegs(n.part || "", 10);
      for (let i = 0; i < 10; i++) { H[203 + i] = n.code === 1 ? o[i] : H[203 + i]; H[213 + i] = n.code === 1 ? p[i] : H[213 + i]; }
      if (n.recipe !== undefined) H[223] = n.recipe & 0xffff;
      if (n.code === 1) { H[224] = (n.qty >>> 16) & 0xffff; H[225] = n.qty & 0xffff; }
      G.frames++;
      L(t, `FC16 write 200–225: code ${n.code} ${CMD_CODES[n.code] || "?"}, seq ${n.seq}${n.code === 1 ? `, order ${n.order}, part ${n.part}, recipe ${n.recipe}, qty ${n.qty}` : ""} (REQ unchanged)`);
    }
  };
  G.fmt = fmt;
  return G;
}

/* ------------------------------------------------------------------ assemble machine program + interface */
/** def.build() → { meta, tags, networks, hooks, process, plant } (fresh objects every call). Returns everything for mountLadder / createEngine. */
export function assemble(def, opts = {}) {
  const m = def.build();
  const IF = buildIF({ type: def.TYPE, mid: def.MID, hooks: m.hooks, process: m.process, srcTags: m.tags });
  const tags = [...SYS_TAGS(), ...m.tags, ...IF.tags];
  const seen = new Set(); for (const t of tags) { if (seen.has(t.name)) throw new Error(`${def.KEY}: duplicate tag ${t.name}`); seen.add(t.name); }
  const program = { id: "bsf8-" + def.KEY, title: def.TITLE, scanMs: 20, plc: def.PLC, tags, networks: [...m.networks, ...IF.networks] };
  const gw = makeGateway(IF.img, { auto: opts.auto, qty: def.LOTQTY, recipe: def.RECIPE, part: def.PART });
  const mp = m.plant;
  const plant = {
    step(st, dt, E) {
      st.CLK10 = (E.time % 0.1) < 0.05 - 1e-9;
      gw.step(E.time);
      st.GW_POLL = gw.pulse;
      IF.overlayIn(st);
      mp.step(st, dt, E);
    },
    reset(st, E) { gw.reset(); IF.img.reset(); if (mp.reset) mp.reset(st, E); },
    info: mp.info,
  };
  const onScan = (st) => IF.overlayOut(st);
  return { def, meta: m, program, plant, onScan, img: IF.img, gw, IF };
}

/* REAL ↔ registers check helpers (self-test) */
export { realToRegs, regsToReal, asciiToRegs, regsToAscii, MAPV, typeCode };
