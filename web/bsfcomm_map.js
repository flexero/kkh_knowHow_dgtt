/* Ball screw + guide factory – item 4 communication: Modbus TCP REGISTER MAP, IP plan, frame codec, load calculator,
 * browser-only demo server (the same register image as tools/bsf_modbus_sim.py, built from window.BSF).
 * Mirror of twin/bsf_comm_map.py – the page self-check (&bf4test) compares both maps when the server is reachable.
 * Map V1.1 (2026-11-13): 227 registers 0 … 226; 226 = cmd.gwHeartbeat, written by the gateway (FC06, +1 per second).
 * Guide: docs/43_bsf_communication_modbus_http.md §6 – §9. ALL VALUES ARE EXAMPLES – check with your network designer.
 *
 *   import { MAPV, MAP_SIZE, VLANS, SERVERS, NETM, TYPE_IDS, typeMap, pollGroups, countersLen, encodeValue, decodeValue,
 *            realToRegs, regsToReal, reqRead, reqWrite1, reqWriteN, adu, decodeFrame, hex, parseHex, loadCalc, demoServe, regImage } from "./bsfcomm_map.js";
 */
import { MTYPES, MACHINES } from "./bsfmfg_data.js";
import { SIGFIELDS, STATES } from "./bsfsim.js";

export const MAPV = 0x0101, MAP_SIZE = 227, PORT = 502, GW_HB_ADDR = 226;   // map V1.1 (2026-11-13): 0 … 226; V1.0 = 0x0100, 226 registers 0 … 225
export const MAP_HISTORY = [
  { version: "V1.0", value: 0x0100, date: "2026-11-13", size: 226, change: "first release: blocks fast 0 – 11, counters + process 20 – 99, energy 100 – 103, command 200 – 225" },
  { version: "V1.1", value: 0x0101, date: "2026-11-13", size: 227, change: "addition: offset 226 cmd.gwHeartbeat (UINT16, gateway writes +1 per second with FC06) for the PLC 'gateway lost' watchdog" },
];
export const mapVersionText = (v = MAPV) => `V${v >> 8}.${v & 255}`;
export const NREG = { UINT16: 1, UINT32: 2, REAL: 2, ASCII20: 10 };
export const TYPE_IDS = Object.keys(MTYPES);
export const VLANS = [
  { vlan: 610, name: "BSF-DMZ", subnet: "10.60.10.0/24", zone: "DMZ (IT <-> OT)", level: "3.5", use: "ERP connector, time server, patch server, remote service" },
  { vlan: 620, name: "BSF-OPS", subnet: "10.60.20.0/24", zone: "operations (level 3)", level: "3", use: "MES, label print server, historian, DNS" },
  { vlan: 630, name: "BSF-SUP", subnet: "10.60.30.0/24", zone: "supervisory (level 2)", level: "2", use: "Modbus gateway, digital twin, AGV fleet manager, engineering station, andon screens" },
  { vlan: 641, name: "BSF-SOFT", subnet: "10.60.41.0/24", zone: "cell: soft machining", level: "1", use: "saws, lathes, machining centres, soft presses", area: "soft", code: "smc" },
  { vlan: 642, name: "BSF-HT", subnet: "10.60.42.0/24", zone: "cell: heat treatment", level: "1", use: "induction, furnaces, hardened straightening", area: "ht", code: "htr" },
  { vlan: 643, name: "BSF-GRIND", subnet: "10.60.43.0/24", zone: "cell: grinding room", level: "1", use: "grinders, hard turning", area: "grind", code: "grd" },
  { vlan: 644, name: "BSF-QC", subnet: "10.60.44.0/24", zone: "cell: metrology", level: "1", use: "lead measuring, rail bench, matching, laboratory", area: "qc", code: "qcl" },
  { vlan: 645, name: "BSF-ASSY", subnet: "10.60.45.0/24", zone: "cell: assembly + packing", level: "1", use: "washer, assembly benches, run-in, marker, packing", area: "assy", code: "asm" },
  { vlan: 650, name: "BSF-AGV", subnet: "10.60.50.0/24", zone: "AGV Wi-Fi (own SSID)", level: "1", use: "AGVs, chargers (the fleet manager talks HTTP to them or to its own server)" },
  { vlan: 660, name: "BSF-UTIL", subnet: "10.60.60.0/24", zone: "utilities", level: "1", use: "energy meters, compressors, HVAC, door I/O (all Modbus TCP)" },
];
export const SERVERS = [
  ["vc-bsf-dmz-erpgw01", "10.60.10.11", 610, "ERP connector (HTTP reverse proxy / API gateway between ERP and MES)"],
  ["vc-bsf-dmz-ntp01", "10.60.10.10", 610, "time server (NTP – UDP 123, the one infrastructure exception)"],
  ["vc-bsf-ops-mes01", "10.60.20.10", 620, "MES (HTTP REST + JSON)"],
  ["vc-bsf-ops-prt01", "10.60.20.11", 620, "label print server (HTTP job API → printers)"],
  ["vc-bsf-ops-hist01", "10.60.20.12", 620, "historian (HTTP write / read)"],
  ["vc-bsf-ops-dns01", "10.60.20.13", 620, "DNS (UDP/TCP 53, infrastructure)"],
  ["vc-bsf-sup-gw01", "10.60.30.10", 630, "Modbus TCP gateway (client to 73 machines, HTTP server)"],
  ["vc-bsf-sup-gw02", "10.60.30.9", 630, "standby gateway (hot standby, polls only when gw01 is silent)"],
  ["vc-bsf-sup-twin01", "10.60.30.11", 630, "digital twin (server.py, HTTP + SSE)"],
  ["vc-bsf-sup-fleet01", "10.60.30.12", 630, "AGV fleet manager (HTTP API)"],
  ["vc-bsf-sup-eng01", "10.60.30.20", 630, "engineering station (PLC / CNC tools, Wireshark)"],
  ["vc-bsf-sup-and01", "10.60.30.31", 630, "andon screen 1 (browser kiosk, HTTP + SSE)"],
  ["erp.corp (IT)", "10.10.0.20", 10, "ERP in the company IT network (only HTTPS to the DMZ connector)"],
];
const AREA_VLAN = Object.fromEntries(VLANS.filter((v) => v.area).map((v) => [v.area, v]));

/* 73 machines: id, type, unit id 1 … 73, VLAN, IP, host name (same algorithm as Python machines()) */
export const NETM = (() => {
  const hostNo = {}; let unit = 0;
  return MACHINES.map((m) => {
    unit++; const v = AREA_VLAN[m.area]; const h = (hostNo[m.area] || 10) + 1; hostNo[m.area] = h;
    return { id: m.id, type: m.type, area: m.area, unit, vlan: v.vlan, ip: `10.60.${v.vlan - 600}.${h}`, port: PORT, host: `vc-bsf-${v.code}-${m.id.replace(/-/g, "").toLowerCase()}`, groups: MTYPES[m.type].sig.slice() };
  });
})();
export const NET_BY_ID = Object.fromEntries(NETM.map((m) => [m.id, m]));
export const NET_BY_UNIT = Object.fromEntries(NETM.map((m) => [m.unit, m]));

const STDF = (n) => SIGFIELDS.std.find((f) => f[0] === n);
const FAST = [
  [0, "hdr.mapVersion", "UINT16", "", "R", "map version 0x0101 = 1.1 (check after a machine software update; 0x0100 = V1.0 without 226)"],
  [1, "hdr.typeCode", "UINT16", "", "R", "machine type code (1 = MS-SAW ... 41 = QC-LAB, order of the type list)"],
  [2, "hdr.unitId", "UINT16", "", "R", "unit id of this machine (plausibility check: wrong cable / wrong IP)"],
  [3, "hdr.heartbeat", "UINT16", "", "R", "+1 every second, wraps 65535 -> 0; frozen = machine program stopped"],
  [4, "std.status", "UINT16", "", "R", STDF("status")[3]], [5, "std.mode", "UINT16", "", "R", STDF("mode")[3]],
  [6, "std.stateCode", "UINT16", "", "R", STDF("stateCode")[3]], [7, "std.alarm", "UINT16", "", "R", STDF("alarm")[3]],
  [8, "hs.status", "UINT16", "", "R", "handshake: bit0 ACK toggle (= REQ when accepted), bit1 BUSY (MES lot running), bit2 DONE toggle (lot finished), bit3 REJECT, bit4 READY for an order"],
  [9, "hs.ackSeq", "UINT16", "", "R", "sequence number of the last accepted / rejected command"],
  [10, "hs.result", "UINT16", "", "R", "0 OK, 1 unknown command, 2 not ready (not auto / alarm), 3 bad data, 4 busy"],
  [11, "hs.lotDone", "UINT16", "pcs", "R", "pieces done of the MES lot"],
];
const CNT_STD = [[20, "good"], [22, "scrap"], [24, "lastCycle_s"], [26, "order"], [36, "part"]];
const EN_STD = [[100, "power_kW"], [102, "energy_kWh"]];
const CMD = [
  [200, "cmd.code", "UINT16", "", "RW", "1 load order, 2 start, 3 stop (end of cycle), 4 acknowledge alarm, 5 select recipe"],
  [201, "cmd.seq", "UINT16", "", "RW", "message counter (MES +1 per command) - the machine copies it to hs.ackSeq"],
  [202, "cmd.ctl", "UINT16", "", "RW", "bit0 REQ toggle - change it LAST; the machine answers ACK = REQ"],
  [203, "cmd.order", "ASCII20", "", "RW", "work order / lot no. for command 1"],
  [213, "cmd.part", "ASCII20", "", "RW", "part code for command 1"],
  [223, "cmd.recipe", "UINT16", "", "RW", "recipe / NC program no. for commands 1 and 5"],
  [224, "cmd.lotQty", "UINT32", "pcs", "RW", "lot quantity for command 1 (even offset)"],
  [226, "cmd.gwHeartbeat", "UINT16", "", "W", "V1.1: gateway heartbeat - the GATEWAY writes it with FC06 once per second, +1 per write, wraps 65535 -> 0; the PLC watchdog: unchanged for 5 s = gateway lost"],
];
export const CMD_CODES = { 1: "load order", 2: "start", 3: "stop", 4: "ack alarm", 5: "recipe" };
export const RESULTS = { 0: "OK", 1: "unknown command", 2: "not ready", 3: "bad data", 4: "busy" };
export const POLL_DEFAULT = { fast_ms: 500, counters_ms: 1000, energy_ms: 10000, gwhb_ms: 1000, timeout_ms: 300, retries: 1 };

export function typeMap(tid) {
  const T = MTYPES[tid], regs = [];
  const R = (addr, name, type, unit, rw, block, meaning) => regs.push({ addr, n: NREG[type], name, type, unit, scale: 1, rw, block, meaning });
  for (const [a, n, t, u, rw, m] of FAST) R(a, n, t, u, rw, "fast", m);
  for (const [a, f] of CNT_STD) { const s = STDF(f); R(a, "std." + f, s[1], s[2], "R", "counters", s[3]); }
  let a = 46;
  for (const g of T.sig) { if (g === "std") continue;
    for (const [f, t, u, m] of SIGFIELDS[g]) { if (NREG[t] === 2 && a % 2) a++; R(a, `${g}.${f}`, t, u, "R", "counters", m); a += NREG[t]; } }
  for (const [a2, f] of EN_STD) { const s = STDF(f); R(a2, "std." + f, s[1], s[2], "R", "energy", s[3]); }
  for (const [a2, n, t, u, rw, m] of CMD) R(a2, n, t, u, rw, "command", m);
  return regs.sort((x, y) => x.addr - y.addr);
}
export const TYPE_MAPS = Object.fromEntries(TYPE_IDS.map((t) => [t, typeMap(t)]));
export const countersLen = (tid) => Math.max(...TYPE_MAPS[tid].filter((r) => r.block === "counters").map((r) => r.addr + r.n)) - 20;
export const pollGroups = (tid) => [["fast", 0, 12], ["counters", 20, countersLen(tid)], ["energy", 100, 4]];
export const typeCode = (tid) => TYPE_IDS.indexOf(tid) + 1;

/* ------------------------------------------------------------------ values <-> registers */
const f32 = new DataView(new ArrayBuffer(4));
export function realToRegs(v, order = "ABCD") { f32.setFloat32(0, +v || 0, false); const hi = f32.getUint16(0, false), lo = f32.getUint16(2, false); return order === "ABCD" ? [hi, lo] : [lo, hi]; }
export function regsToReal(r0, r1, order = "ABCD") { if (order !== "ABCD") [r0, r1] = [r1, r0]; f32.setUint16(0, r0 & 0xffff, false); f32.setUint16(2, r1 & 0xffff, false); return f32.getFloat32(0, false); }
export const asciiToRegs = (s, n = 10) => { const b = String(s || "").slice(0, n * 2).split("").map((c) => { const k = c.charCodeAt(0); return k < 128 ? k : 63; }); while (b.length < n * 2) b.push(0); return Array.from({ length: n }, (_, i) => (b[2 * i] << 8) | b[2 * i + 1]); };
export const regsToAscii = (r) => { let s = ""; for (const w of r) { const a = (w >> 8) & 255, b = w & 255; if (!a) break; s += String.fromCharCode(a); if (!b) break; s += String.fromCharCode(b); } return s; };
export function encodeValue(type, v, order = "ABCD") {
  if (type === "UINT16") return [(+v || 0) & 0xffff];
  if (type === "UINT32") { const x = (+v || 0) >>> 0; return [x >>> 16, x & 0xffff]; }
  if (type === "REAL") return realToRegs(+v || 0, order);
  if (type === "ASCII20") return asciiToRegs(v, 10);
  throw new Error(type);
}
export function decodeValue(type, r, order = "ABCD") {
  if (type === "UINT16") return r[0];
  if (type === "UINT32") return ((r[0] << 16) >>> 0) + r[1];
  if (type === "REAL") { const v = regsToReal(r[0], r[1], order); return Number.isFinite(v) ? +v.toPrecision(7) : String(v); }
  if (type === "ASCII20") return regsToAscii(r);
  throw new Error(type);
}
export function decodeBlock(tid, start, regs, order = "ABCD") {
  const out = {}, end = start + regs.length;
  for (const r of TYPE_MAPS[tid]) if (r.addr >= start && r.addr + r.n <= end) out[r.name] = decodeValue(r.type, regs.slice(r.addr - start, r.addr - start + r.n), order);
  return out;
}

/* ------------------------------------------------------------------ frames */
export const FC_NAMES = { 1: "Read Coils", 2: "Read Discrete Inputs", 3: "Read Holding Registers", 4: "Read Input Registers", 5: "Write Single Coil", 6: "Write Single Register", 15: "Write Multiple Coils", 16: "Write Multiple Registers" };
export const EXC_NAMES = { 1: "ILLEGAL FUNCTION", 2: "ILLEGAL DATA ADDRESS", 3: "ILLEGAL DATA VALUE", 4: "SERVER DEVICE FAILURE", 5: "ACKNOWLEDGE", 6: "SERVER DEVICE BUSY", 8: "MEMORY PARITY ERROR", 10: "GATEWAY PATH UNAVAILABLE", 11: "GATEWAY TARGET DEVICE FAILED TO RESPOND" };
const u16 = (v) => [(v >> 8) & 255, v & 255];
export const adu = (tid, unit, pdu) => [...u16(tid & 0xffff), 0, 0, ...u16(pdu.length + 1), unit & 255, ...pdu];
export const reqRead = (tid, unit, start, qty, fc = 3) => adu(tid, unit, [fc, ...u16(start), ...u16(qty)]);
export const reqWrite1 = (tid, unit, addr, v) => adu(tid, unit, [6, ...u16(addr), ...u16(v & 0xffff)]);
export const reqWriteN = (tid, unit, start, vals) => adu(tid, unit, [16, ...u16(start), ...u16(vals.length), vals.length * 2, ...vals.flatMap((v) => u16(v & 0xffff))]);
export const reqCoil = (tid, unit, addr, on) => adu(tid, unit, [5, ...u16(addr), on ? 0xff : 0, 0]);
export const hex = (b) => b.map((x) => x.toString(16).toUpperCase().padStart(2, "0")).join(" ");
export function parseHex(s) {
  const t = String(s).replace(/0x/gi, "").replace(/[^0-9a-f]/gi, "");
  if (t.length % 2) throw new Error("odd number of hex digits");
  return Array.from({ length: t.length / 2 }, (_, i) => parseInt(t.substr(2 * i, 2), 16));
}
const rd16 = (b, i) => (b[i] << 8) | b[i + 1];
export function decodeFrame(b, dir = "auto", tidType = null, reqStart = null, order = "ABCD") {
  const d = { hex: hex(b), len: b.length, ok: false };
  if (b.length < 8) { d.error = "too short - an ADU has at least 7 bytes MBAP + 1 byte function code"; return d; }
  d.mbap = { transactionId: rd16(b, 0), protocolId: rd16(b, 2), length: rd16(b, 4), unitId: b[6] };
  if (d.mbap.protocolId !== 0) d.error = "protocol id must be 0 for Modbus";
  if (d.mbap.length !== b.length - 6) d.error = `MBAP length ${d.mbap.length} but ${b.length - 6} bytes follow (unit id + PDU)`;
  const p = b.slice(7), fc = p[0]; d.fc = fc;
  if (fc & 0x80) { const c = p[1] || 0; Object.assign(d, { dir: "resp", exception: c, text: `EXCEPTION fc ${String(fc & 0x7f).padStart(2, "0")} code ${c.toString(16).toUpperCase().padStart(2, "0")} ${EXC_NAMES[c] || "?"}` }); d.ok = !d.error; return d; }
  d.fcName = FC_NAMES[fc] || "unknown function";
  const y = p.slice(1);
  if (dir === "auto") {
    if ([1, 2, 3, 4].includes(fc)) dir = y.length >= 1 && y[0] === y.length - 1 && y.length !== 4 ? "resp" : "req";
    else if (fc === 16) dir = y.length >= 5 && y[4] === y.length - 5 ? "req" : "resp";
    else dir = "req";
  }
  d.dir = dir;
  try {
    const need = (n) => { if (y.length < n) throw new Error("short"); };
    if ([3, 4].includes(fc) && dir === "req") { need(4); const st = rd16(y, 0), q = rd16(y, 2); Object.assign(d, { start: st, qty: q, text: `read ${q} register(s) from ${st} (${40001 + st} 1-based)` }); }
    else if ([3, 4].includes(fc)) { need(1); const bc = y[0]; need(1 + bc); const regs = Array.from({ length: bc >> 1 }, (_, i) => rd16(y, 1 + 2 * i)); Object.assign(d, { byteCount: bc, regs, text: `${bc >> 1} register(s)` }); if (tidType && reqStart != null) d.values = decodeBlock(tidType, reqStart, regs, order); }
    else if ([1, 2].includes(fc) && dir === "req") { need(4); Object.assign(d, { start: rd16(y, 0), qty: rd16(y, 2), text: `read ${rd16(y, 2)} bit(s) from ${rd16(y, 0)}` }); }
    else if ([1, 2].includes(fc)) { const bc = y[0]; d.byteCount = bc; d.bits = Array.from({ length: bc * 8 }, (_, i) => (y[1 + (i >> 3)] >> (i % 8)) & 1); d.text = `${bc} byte(s) of bits`; }
    else if (fc === 5) { need(4); const a = rd16(y, 0), v = rd16(y, 2); Object.assign(d, { addr: a, value: v, text: `coil ${a} ${v === 0xff00 ? "ON" : v === 0 ? "OFF" : "bad value"}` }); }
    else if (fc === 6) { need(4); const a = rd16(y, 0), v = rd16(y, 2); Object.assign(d, { addr: a, value: v, text: `register ${a} = ${v} (0x${v.toString(16).toUpperCase().padStart(4, "0")})` + (dir === "resp" ? " (echo)" : "") }); }
    else if (fc === 16 && dir === "req") { need(5); const st = rd16(y, 0), q = rd16(y, 2); need(5 + 2 * q); Object.assign(d, { start: st, qty: q, byteCount: y[4], regs: Array.from({ length: q }, (_, i) => rd16(y, 5 + 2 * i)), text: `write ${q} register(s) from ${st}` }); }
    else if (fc === 16) { need(4); Object.assign(d, { start: rd16(y, 0), qty: rd16(y, 2), text: `${rd16(y, 2)} register(s) written from ${rd16(y, 0)}` }); }
    else d.text = "function code not decoded";
    d.ok = !d.error;
  } catch (e) { d.error = "PDU too short for this function code"; }
  return d;
}

/* ------------------------------------------------------------------ register image from the twin (browser demo server) */
export function regImage(m, extra = {}) {
  const R = new Array(MAP_SIZE).fill(0), vals = {};
  for (const g in m.sig) for (const k in m.sig[g]) vals[`${g}.${k}`] = m.sig[g][k];
  Object.assign(vals, { "hdr.mapVersion": MAPV, "hdr.typeCode": typeCode(m.type), "hdr.unitId": NET_BY_ID[m.id].unit, "hdr.heartbeat": extra.hb || 0,
    "hs.status": extra.hs || ((m.state !== "DOWN" && (!m.sig.std || m.sig.std.mode === 1)) ? 16 : 0), "hs.ackSeq": extra.ackSeq || 0, "hs.result": extra.result || 0, "hs.lotDone": extra.lotDone || 0 });
  for (const r of TYPE_MAPS[m.type]) { if (r.block === "command") continue; if (vals[r.name] !== undefined) encodeValue(r.type, vals[r.name]).forEach((w, i) => { R[r.addr + i] = w; }); }
  if (extra.cmd) extra.cmd.forEach((w, i) => { R[200 + i] = w; });
  if (extra.gwhb !== undefined) R[GW_HB_ADDR] = extra.gwhb & 0xffff;
  return R;
}
/* Demo Modbus server in the browser: request bytes -> response bytes (same rules as twin/bsf_comm_modbus.serve) */
export function demoServe(req, getImage, faults = {}) {
  const tid = rd16(req, 0), unit = req[6], fc = req[7], y = req.slice(8);
  const exc = (c) => adu(tid, unit, [fc | 0x80, c]);
  if (faults.netloss) return null;
  const nm = NET_BY_UNIT[unit]; if (!nm) return exc(0x0b);
  const f = faults[nm.id]; if (f === "offline" || f === "slow") return null; if (f === "exc04") return exc(0x04);
  const R = getImage(nm.id);
  if (fc === 3 || fc === 4) { const st = rd16(y, 0), q = rd16(y, 2); if (q < 1 || q > 125) return exc(3); if (st + q > MAP_SIZE) return exc(2);
    const regs = R.slice(st, st + q);
    if (f === "cdab") for (const r of TYPE_MAPS[nm.type]) if (r.type === "REAL" && r.addr >= st && r.addr + 2 <= st + q) { const i = r.addr - st; [regs[i], regs[i + 1]] = [regs[i + 1], regs[i]]; }
    return adu(tid, unit, [fc, 2 * q, ...regs.flatMap(u16)]); }
  if (fc === 6) { const a = rd16(y, 0); if (a < 200 || a >= MAP_SIZE) return exc(2); return adu(tid, unit, req.slice(7, 12)); }
  if (fc === 16) { const st = rd16(y, 0), q = rd16(y, 2), bc = y[4]; if (q < 1 || q > 123 || bc !== 2 * q) return exc(3); if (st < 200 || st + q > MAP_SIZE) return exc(2); return adu(tid, unit, [16, ...u16(st), ...u16(q)]); }
  if (fc === 1) { const st = rd16(y, 0), q = rd16(y, 2); if (q < 1 || q > 2000) return exc(3); if (st + q > 32) return exc(2); const w = R[4] | (R[8] << 16); const data = new Array((q + 7) >> 3).fill(0); for (let i = 0; i < q; i++) data[i >> 3] |= ((w >> (st + i)) & 1) << (i % 8); return adu(tid, unit, [1, data.length, ...data]); }
  if (fc === 5) { const a = rd16(y, 0), v = rd16(y, 2); if (v !== 0 && v !== 0xff00) return exc(3); if (a !== 100) return exc(2); return adu(tid, unit, req.slice(7, 12)); }
  return exc(1);
}

/* ------------------------------------------------------------------ timing + load (guide 43 §9.6) */
export const wireBytes = (aduLen, ovh = 58, pre = 20) => Math.max(64, aduLen + ovh) + pre;   // Ethernet 14 + IP 20 + TCP 20 + FCS 4 = 58; preamble + gap 20
export function loadCalc(o) {
  // reads (FC03): request 12 B ADU, response 9 + 2 × registers; map V1.1 heartbeat write (FC06 226): request 12 B, echo response 12 B
  const n = o.n ?? 73, groups = [["fast", o.fast_ms ?? 500, o.rFast ?? 12], ["counters", o.counters_ms ?? 1000, o.rCnt ?? avgCounters()], ["energy", o.energy_ms ?? 10000, o.rEn ?? 4]];
  if ((o.gwhb_ms ?? 1000) > 0) groups.push(["gw heartbeat (FC06 226)", o.gwhb_ms ?? 1000, 1, true]);
  const rtt = o.rtt_ms ?? 3, workers = Math.max(1, o.workers ?? 4), link = (o.link_mbit ?? 100) * 1e6, to = o.timeout_ms ?? 300, rt = o.retries ?? 1;
  const rows = groups.map(([g, T, r, w]) => { const pps = n * 1000 / T, reqA = 12, respA = w ? 12 : 9 + 2 * r, pay = reqA + respA, wire = wireBytes(reqA) + wireBytes(respA);
    return { g, T, r, w: !!w, pps, reqA, respA, pay, wire, payBps: pps * pay, wireBps: pps * wire, ageMax: T + rtt, ageFail: T + to * (1 + rt) + rtt }; });
  const reads = rows.filter((x) => !x.w).reduce((s, x) => s + x.pps, 0), writes = rows.filter((x) => x.w).reduce((s, x) => s + x.pps, 0);
  const pps = rows.reduce((s, x) => s + x.pps, 0), wireBps = rows.reduce((s, x) => s + x.wireBps, 0), payBps = rows.reduce((s, x) => s + x.payBps, 0);
  const busy = pps / workers * rtt / 1000;   // share of time a worker waits for answers (sequential polling per connection)
  const perDev = groups.reduce((s, [, T]) => s + 1000 / T, 0);
  return { rows, pps, reads, writes, payBps, wireBps, linkPct: wireBps * 8 / link * 100, busy, maxDevPerWorker: Math.floor(1000 / (perDev * rtt)), devPerWorker: Math.ceil(n / workers),
    cycleDev_ms: perDev * rtt, deadCost_ms: to * (1 + rt) };
}
export function avgCounters() { return NETM.reduce((s, m) => s + countersLen(m.type), 0) / NETM.length; }
export { STATES };
