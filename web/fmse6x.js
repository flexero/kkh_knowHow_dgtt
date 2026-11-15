/* FMS engineering – item 6, deep sections 6G–6N (loaded by fmse6.js at the end of item 6).
 * 6G network calculator lab (latency, IO-Link, OPC UA, MQTT, fibre, subnets / overlap / duplicates)
 * 6H Modbus frame lab (standard block encoding, FC03/FC06/FC16 frames + exceptions, decoder, word order, bit words)
 * 6I handshake & heartbeat simulator (EX6.handshake_sim._rules exactly, timing diagram, log, KPIs)
 * 6J interface sheet generator (Modbus / PROFINET / OPC UA / Sparkplug / tag per data-block row, IP plan with PROFINET names, CSV)
 * 6K security (firewall rule tester + audit, IEC 62443 risk table, FR1–FR7)   6L protocol deep cards
 * 6M commissioning & troubleshooting (FAT/SAT checklist, decision trees, Wireshark filters)   6N cases.
 * Example numbers: EX6 in fmse6x_data.js = copy of tools/fmse/examples/item6_examples.json (same formulas as guide docs/66 and tools/fmse/*.py).
 * Offline; user edits in localStorage keys "fmse.6x.*". Test hook: window.fe6x.results() (always computed from the JSON defaults). */
import { EX6, USES6, FR7, PCARDS, CHECK6, TREES, WSF, CASES6 } from "./fmse6x_data.js";
import { BLOCK, EXTRA, KITS, MODDEV, RANGES } from "./fmse6_data.js";
import { UNIT, CALC } from "./fmse6.js";

/* ------------------------------------------------------------------ helpers */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fx = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
const rnd = (x, d = 6) => (Number.isFinite(x) ? +x.toFixed(d) : null);
const clone = (o) => JSON.parse(JSON.stringify(o));
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const store = {   // own keys "fmse.6x.<k>"
  get(k, d) { try { const v = localStorage.getItem("fmse.6x." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("fmse.6x." + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem("fmse.6x." + k); } catch (e) { /* storage blocked */ } },
};
function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const csvCell = (v) => { const s = String(v == null ? "" : v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(";")).join("\n") + "\n";
const ul = (a) => `<ul class="am-ul">${a.map((x) => `<li>${x}</li>`).join("")}</ul>`;   // items are trusted HTML written in this file
const ok = (b, y, n) => (b ? `<span class="fe-ok">✓ ${y}</span>` : `<span class="fe-no">✗ ${n}</span>`);
const card = (id, title, sub, body) => `<div class="card" id="${id}"><div class="card-head"><h2>${title}</h2><span class="sub">${sub}</span></div>${body}</div>`;
const tab = (head, rows, cls = "") => `<div class="fe-scroll"><table class="am-tab ${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
const kv = (rows) => `<table class="am-kv f6-kv"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join("")}</tbody></table>`;
const kpis = (a) => `<div class="phd-kpis">${a.map(([n, v, c]) => `<div class="phd-kpi"><b class="${c || ""}">${v}</b><span>${n}</span></div>`).join("")}</div>`;
const live = (el) => !!el && document.body.contains(el) && el.offsetParent !== null && !document.hidden;
const uses = (k) => `<details class="fx-more"><summary><b>Use cases</b> <span class="sub">where this is used in real projects</span></summary><div class="fx-uses">${USES6[k].map(([d, t]) => `<div class="fx-use"><b>${esc(d)}</b><p>${esc(t)}</p></div>`).join("")}</div></details>`;
const intro = (html) => `<div class="fx-guide"><div class="fx-prin">${html}</div></div>`;
// number-input table bound to a state path: rows [key, label, unit, step]
const inTab = (path, obj, rows) => `<table class="am-kv f6-kv f6-in"><tbody>${rows.map(([k, n, u, st]) => `<tr><td>${esc(n)}</td><td><input type="${typeof obj[k] === "string" ? "text" : "number"}" step="${st || "any"}" data-p="${path}.${k}" value="${esc(obj[k])}"${typeof obj[k] === "string" ? ' class="f6-wide"' : ""}> ${esc(u || "")}</td></tr>`).join("")}</tbody></table>`;
const getP = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const setP = (o, p, v) => { const ks = p.split("."), last = ks.pop(); const t = ks.reduce((a, k) => a[k], o); t[last] = v; };
const hex2 = (b) => (b & 255).toString(16).toUpperCase().padStart(2, "0");
const hex4 = (w) => (w & 0xffff).toString(16).toUpperCase().padStart(4, "0");
const hexs = (bytes) => bytes.map(hex2).join(" ");
const R = {};   // errors of init functions

/* ================================================================== pure calculations (exact formulas of EX6._formulas) */
export function latency(p) {   // µs
  const Rb = p.R_Mbit * 1e6, ttx = p.wire_bytes * 8 / Rb * 1e6, cable = p.length_m * 5e-9 * 1e6;
  const base = (p.hops + 1) * ttx + p.hops * p.t_sw_us + cable, tmax = p.max_wire_bytes * 8 / Rb * 1e6, worst = base + p.hops * tmax;
  return { ttx, cable, tmax, base, worst, hops: p.hops, t_sw: p.t_sw_us };
}
export function iolink(p, rates = EX6.net_calc.iolink.rates) {
  const mB = 2 + p.pd_out, dB = p.od + p.pd_in + 1, bits = 11 * (mB + dB) + 10;
  return rates.map(([com, baud]) => { const t = bits / baud * 1000; return { com, baud, master_bytes: mB, device_bytes: dB, bits, tmsg_ms: t, cycle_ms: Math.max(t, p.device_min_cycle_ms) }; });
}
export function opcua(p) {
  const notif = p.items / (p.sampling_ms / 1000) * p.change_ratio, msgs = p.subscriptions / (p.publishing_ms / 1000);
  const Bps = notif * p.bytes_per_notification + msgs * p.overhead_per_message;
  return { notif, msgs, Bps, kbit: Bps * 8 / 1000 };
}
export function mqtt(p) {
  const msg = 2 + (String(p.topic).length + 2) + p.metrics_per_msg * p.bytes_per_metric + p.sparkplug_header;
  const inM = p.edges * p.rate, inB = inM * msg, outB = inB * p.subscribers;
  return { topic_len: String(p.topic).length, msg_bytes: msg, in_msgs: inM, in_Bps: inB, out_Bps: outB, kbit: (inB + outB) * 8 / 1000 };
}
export function fibre(p) {
  const loss = p.length_km * p.att_db_km + p.connectors * p.conn_db + p.splices * p.splice_db, budget = p.tx_min_dbm - p.rx_sens_dbm, margin = budget - loss;
  return { loss, budget, margin, ok: margin >= 3 };
}
const ip2n = (s) => { const a = String(s).trim().split("."); if (a.length !== 4 || a.some((x) => !/^\d{1,3}$/.test(x) || +x > 255)) return null; return (((+a[0]) << 24) >>> 0) + ((+a[1]) << 16) + ((+a[2]) << 8) + (+a[3]); };
const n2ip = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
export function subnet(c) {
  const m = String(c).trim().match(/^([\d.]+)\/(\d{1,2})$/);
  const ip = m ? ip2n(m[1]) : null, p = m ? +m[2] : -1;
  if (ip == null || p < 0 || p > 32) return { cidr: String(c).trim(), err: "format must be a.b.c.d/p (p 0–32)" };
  const mask = p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0, net = (ip & mask) >>> 0, bc = (net | (~mask >>> 0)) >>> 0;
  const hosts = p <= 30 ? 2 ** (32 - p) - 2 : 2 ** (32 - p);
  return { cidr: String(c).trim(), prefix: p, mask: n2ip(mask), network: n2ip(net), broadcast: n2ip(bc), first: n2ip(p <= 30 ? net + 1 : net), last: n2ip(p <= 30 ? bc - 1 : bc), hosts, _net: net, _mask: mask, isNet: ip === net };
}
export function overlaps(list) {
  const s = list.map(subnet), out = [];
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) {
    const a = s[i], b = s[j]; if (a.err || b.err) continue;
    if (((b._net & a._mask) >>> 0) === a._net || ((a._net & b._mask) >>> 0) === b._net) out.push([a.cidr, b.cidr]);
  }
  return out;
}
export function duplicates(devs) {
  const by = {}; devs.forEach(([n, ip]) => { const k = String(ip).trim(); (by[k] = by[k] || []).push(n); });
  return Object.entries(by).filter(([, v]) => v.length > 1).map(([ip, names]) => ({ ip, names }));
}

/* ---- Modbus: data block, encoding, frames */
const words = (t) => (/DINT|REAL/.test(t) ? 2 : /STRING\[20\]/.test(t) ? 10 : 1);
export function dbRows(mod) { return [...BLOCK.map((r) => [...r, true]), ...(EXTRA[mod] || []).map((r) => [...r, false])].map(([o, n, t, d, mn, std]) => ({ o, n, t, d, mn, std, w: words(t) })); }
const f32 = (v) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, v, false); return [dv.getUint16(0), dv.getUint16(2)]; };
export function encode(mod, values, base = 0) {   // → { regs, dir, size, rows }
  const rows = dbRows(mod), size = Math.max(...rows.map((r) => r.o + r.w)), regs = new Array(size).fill(0), dir = new Array(size).fill(""), name = new Array(size).fill("");
  rows.forEach((r) => {
    const v = values[r.n] == null ? 0 : values[r.n];
    let ws;
    if (r.t === "DINT") { const u = Math.trunc(num(v)) >>> 0; ws = [u >>> 16, u & 0xffff]; }
    else if (r.t === "REAL") ws = f32(num(v));
    else if (/STRING/.test(r.t)) { const s = String(v === 0 ? "" : v); ws = []; for (let i = 0; i < r.w; i++) ws.push(((s.charCodeAt(2 * i) || 0) & 255) << 8 | ((s.charCodeAt(2 * i + 1) || 0) & 255)); }
    else ws = [Math.trunc(num(v)) & 0xffff];
    ws.forEach((x, i) => { regs[r.o + i] = x; dir[r.o + i] = r.d; name[r.o + i] = r.n + (r.w > 1 ? (r.w === 2 ? (i ? " (low word)" : " (high word)") : ` [${i}]`) : ""); });
  });
  return { regs, dir, name, size, rows, base, table: regs.map((x, i) => ({ word: i, reg: "4" + String(base + i + 1).padStart(4, "0"), pdu: base + i, name: name[i], value: x, hex: hex4(x) })) };
}
const mbap = (tid, unit, pdu) => [tid >> 8, tid, 0, 0, (pdu.length + 1) >> 8, pdu.length + 1, unit, ...pdu].map((b) => b & 255);
const w2 = (w) => [(w >> 8) & 255, w & 255];
export const EXC = { 1: "01 illegal function", 2: "02 illegal data address", 3: "03 illegal data value", 4: "04 server device failure" };
export function mbFrame(fr, srv) {   // srv = encode(...) result + unit id
  const fc = fr.fc | 0, start = fr.start | 0, unit = srv.unit, vals = (fr.values || []).map((x) => x | 0);
  let pdu, q;
  if (fc === 3) { q = fr.qty | 0; pdu = [3, ...w2(start), ...w2(q)]; }
  else if (fc === 6) { q = 1; pdu = [6, ...w2(start), ...w2(fr.value | 0)]; }
  else if (fc === 16) { q = vals.length; pdu = [16, ...w2(start), ...w2(q), 2 * q, ...vals.flatMap(w2)]; }
  else { q = fr.qty | 0; pdu = [fc, ...w2(start), ...w2(q)]; }
  let exc = 0;   // checks in the order of _formulas.modbus_frames
  if (![3, 6, 16].includes(fc)) exc = 1;
  else if ((fc === 3 && (q < 1 || q > 125)) || (fc === 16 && (q < 1 || q > 123))) exc = 3;
  else {
    const a0 = start - srv.base;
    if (a0 < 0 || a0 + q > srv.size) exc = 2;
    else if (fc !== 3) { for (let i = a0; i < a0 + q; i++) if (!(srv.dir[i] === "in" || srv.dir[i] === "in/out")) { exc = 2; break; } }
  }
  let rp;
  if (exc) rp = [fc + 0x80, exc];
  else if (fc === 3) { const a0 = start - srv.base, data = srv.regs.slice(a0, a0 + q); rp = [3, 2 * q, ...data.flatMap(w2)]; }
  else if (fc === 6) rp = pdu.slice();
  else rp = [16, ...w2(start), ...w2(q)];
  return { name: fr.name || "", tid: fr.tid | 0, fc, request: hexs(mbap(fr.tid | 0, unit, pdu)), response: hexs(mbap(fr.tid | 0, unit, rp)), exception: exc ? EXC[exc] : "", exc };
}
export const ORDERS = ["ABCD", "CDAB", "BADC", "DCBA"];
const perm = (b, o) => (o === "ABCD" ? b.slice() : o === "CDAB" ? [b[2], b[3], b[0], b[1]] : o === "BADC" ? [b[1], b[0], b[3], b[2]] : [b[3], b[2], b[1], b[0]]);
const bytesOf = (v, type) => { const dv = new DataView(new ArrayBuffer(4)); if (type === "REAL") dv.setFloat32(0, v, false); else dv.setInt32(0, Math.trunc(v), false); return [0, 1, 2, 3].map((i) => dv.getUint8(i)); };
const valOf = (b, type) => { const dv = new DataView(new ArrayBuffer(4)); b.forEach((x, i) => dv.setUint8(i, x)); return type === "REAL" ? dv.getFloat32(0, false) : dv.getInt32(0, false); };
export function wordOrder(v, type) {   // device sends in variant X, client decodes as ABCD (standard)
  const b = bytesOf(v, type);
  return ORDERS.map((o) => { const w = perm(b, o); return { order: o, bytes: hexs(w), regs: [hex4(w[0] << 8 | w[1]), hex4(w[2] << 8 | w[3])], readAsABCD: valOf(w, type) }; });
}
function decodeRow(regs, t, order) {
  if (t === "DINT" || t === "REAL") { const b = perm([regs[0] >> 8, regs[0] & 255, regs[1] >> 8, regs[1] & 255], order); return valOf(b, t); }
  if (t === "INT") return regs[0] >= 0x8000 ? regs[0] - 0x10000 : regs[0];
  if (/STRING/.test(t)) return regs.map((r) => String.fromCharCode(r >> 8, r & 255)).join("").replace(/\0+$/, "");
  return regs[0];
}
export function decodeResp(hex, mod, startWord, order = "ABCD") {
  const b = String(hex).trim().split(/[\s,:]+/).filter(Boolean).map((x) => parseInt(x, 16));
  if (b.length < 9 || b.some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return { err: "need at least 9 hex bytes (MBAP 7 + function + data)" };
  const tid = b[0] << 8 | b[1], pid = b[2] << 8 | b[3], len = b[4] << 8 | b[5], unit = b[6], fc = b[7];
  const head = { tid, pid, len, lenOk: len === b.length - 6, unit, fc };
  if (fc >= 0x80) return { ...head, exception: EXC[b[8]] || hex2(b[8]) + " (other code)", rows: [] };
  if (fc !== 3 && fc !== 4) return { ...head, err: "decoder reads FC03 / FC04 responses only", rows: [] };
  const bc = b[8], regs = []; for (let i = 0; i < bc / 2; i++) regs.push((b[9 + 2 * i] << 8) | b[10 + 2 * i]);
  const n = regs.length, rows = dbRows(mod).filter((r) => r.o >= startWord && r.o + r.w <= startWord + n)
    .map((r) => ({ word: r.o, name: r.n, type: r.t, value: decodeRow(regs.slice(r.o - startWord, r.o - startWord + r.w), r.t, order) }));
  return { ...head, bytecount: bc, bcOk: bc === b.length - 9, regs, rows };
}

/* ---- handshake simulator: EX6.handshake_sim._rules */
export function hsSim(P, sc) {
  const K = P.K, hbp = P.hb_period_ticks, hbto = P.hb_timeout_ticks, hsto = P.hs_timeout_ticks, jobto = P.job_timeout_ticks, ex = sc.exec_ticks;
  const cc = { Request: 0, Ack: 0, JobId: 0, HB: 0 }, md = { Ready: 1, Busy: 0, Done: 0, HSReady: 0, HB: 0, JobId: 0 };
  const M = { st: "IDLE", last: 0, seen: 0, lost: false, frozen: false, f: 0, ignore: false, end: 0 };
  const C = { st: "S0", t: 0, last: 0, seen: 0, lost: false, frozen: false, f: 0, job: null };
  const queue = sc.jobs.slice(), log = [], trace = [], completed = [];
  const L = (k, s) => log.push(k + " " + s);
  const cset = (st, k) => { C.st = st; C.t = k; };
  for (let k = 0; k <= K; k++) {
    const snc = { ...cc }, snm = { ...md };
    // 1 events
    sc.events.forEach(([t, kind]) => {
      if (t !== k) return;
      L(k, "EVENT " + kind);
      if (kind === "MOD_FREEZE") { M.frozen = true; M.f = k; }
      else if (kind === "MOD_RESUME") { M.frozen = false; M.last = k; M.seen = snc.HB; if (M.st === "EXEC") M.end += k - M.f; }
      else if (kind === "CC_FREEZE") { C.frozen = true; C.f = k; }
      else if (kind === "CC_RESUME") { C.frozen = false; C.last = k; C.seen = snm.HB; }
      else if (kind === "IGNORE_REQ_ON") M.ignore = true;
      else if (kind === "IGNORE_REQ_OFF") M.ignore = false;
      else if (kind === "CC_RESET") { if (C.st === "ERR") cset("S0", k); }
    });
    // 2 MOD
    if (!M.frozen) {
      if (k > 0 && k % hbp === 0) md.HB += 1;
      if (snc.HB !== M.seen) { M.seen = snc.HB; M.last = k; }
      if (!M.lost && k - M.last >= hbto) { M.lost = true; L(k, "MOD CC_LOSS"); if (M.st === "IDLE") md.Ready = 0; }
      else if (M.lost && M.last === k) { M.lost = false; L(k, "MOD CC_OK"); if (M.st === "IDLE") md.Ready = 1; }
      if (M.st === "IDLE") { if (!M.lost && !M.ignore && snc.Request === 1) { md.JobId = snc.JobId; md.HSReady = 1; md.Busy = 1; md.Ready = 0; M.st = "ACCEPT"; L(k, "MOD ACCEPT " + md.JobId); } }
      else if (M.st === "ACCEPT") { if (snc.Request === 0) { md.HSReady = 0; M.end = k + ex; M.st = "EXEC"; L(k, "MOD START " + md.JobId); } }
      else if (M.st === "EXEC") { if (k >= M.end) { md.Busy = 0; md.Done = 1; M.st = "DONE"; L(k, "MOD DONE " + md.JobId); } }
      else if (M.st === "DONE") { if (snc.Ack === 1) { md.Done = 0; md.Ready = M.lost ? 0 : 1; M.st = "IDLE"; L(k, "MOD RELEASE " + md.JobId); } }
    }
    // 3 CC
    if (!C.frozen) {
      if (k > 0 && k % hbp === 0) cc.HB += 1;
      if (snm.HB !== C.seen) { C.seen = snm.HB; C.last = k; }
      if (!C.lost && k - C.last >= hbto) { C.lost = true; cc.Request = 0; cc.Ack = 0; if (C.st !== "ERR") cset("OFFLINE", k); L(k, "CC COMM_LOSS"); }
      else if (C.lost && C.last === k) {
        C.lost = false; L(k, "CC COMM_OK");
        if (C.st === "OFFLINE") {
          if (snm.Done === 1) { cc.Ack = 1; cset("S4", k); L(k, "CC RESYNC_DONE " + C.job); }
          else if (snm.Busy === 1) { cset("S3", k); L(k, "CC RESYNC_BUSY " + C.job); }
          else { cset("S0", k); L(k, "CC RESYNC_IDLE"); if (C.job != null) queue.unshift(C.job); C.job = null; }
        }
      } else if (!C.lost) {
        const t = C.t;
        if (C.st === "S0") { if (queue.length && snm.Ready === 1 && snm.Busy === 0) { C.job = queue.shift(); cc.JobId = C.job; cc.Request = 1; cset("S1", k); L(k, "CC REQUEST " + C.job); } }
        else if (C.st === "S1") { if (snm.HSReady === 1) { cc.Request = 0; cset("S2", k); L(k, "CC ACCEPTED " + C.job); } else if (k - t >= hsto) { cc.Request = 0; cset("ERR", k); queue.unshift(C.job); L(k, "CC HS_TIMEOUT S1 " + C.job); C.job = null; } }
        else if (C.st === "S2") { if (snm.HSReady === 0) { cset("S3", k); L(k, "CC RUNNING " + C.job); } else if (k - t >= hsto) { cset("ERR", k); L(k, "CC HS_TIMEOUT S2 " + C.job); } }
        else if (C.st === "S3") { if (snm.Done === 1) { cc.Ack = 1; cset("S4", k); L(k, "CC DONE " + C.job); } else if (k - t >= jobto) { cset("ERR", k); L(k, "CC JOB_TIMEOUT " + C.job); } }
        else if (C.st === "S4") { if (snm.Done === 0) { cc.Ack = 0; cset("S0", k); completed.push([C.job, k]); L(k, "CC COMPLETE " + C.job); C.job = null; } else if (k - t >= hsto) { cc.Ack = 0; cset("ERR", k); L(k, "CC HS_TIMEOUT S4 " + C.job); } }
      }
    }
    trace.push({ k, cc: { ...cc }, md: { ...md }, cs: C.st, ms: M.st, cf: C.frozen, mf: M.frozen, cl: C.lost, ml: M.lost });
  }
  const tick = (s) => { const l = log.find((x) => x.endsWith(" " + s) || x.includes(" " + s + " ")); return l ? +l.split(" ")[0] : null; };
  const fz = sc.events.find((e) => e[1] === "MOD_FREEZE" || e[1] === "CC_FREEZE");
  const det = fz ? (() => { const s = fz[1] === "MOD_FREEZE" ? "CC COMM_LOSS" : "MOD CC_LOSS"; const l = log.find((x) => x.endsWith(" " + s) && +x.split(" ")[0] >= fz[0]); return l ? +l.split(" ")[0] - fz[0] : null; })() : null;
  const KPI = { lines: log.length, completed, finalCC: C.st, finalMOD: M.st, hsTimeouts: log.filter((l) => l.includes("HS_TIMEOUT")).length, jobTimeouts: log.filter((l) => l.includes("JOB_TIMEOUT")).length,
    commLossTick: tick("CC COMM_LOSS"), modLossTick: tick("MOD CC_LOSS"), detectDelay: det };
  return { log, trace, KPI };
}

/* ---- interface sheet + IP plan with PROFINET names */
const NOBLOCK = new Set(["M20", "M21", "M22"]);   // same as 6F: SCADA, MES connector, network have no module data block
function pnAddr(rows, base) {
  let ib = base, qb = base;
  return rows.map((r) => { const len = 2 * r.w; let a; if (r.d === "out") { a = `%IB${ib}…${ib + len - 1}`; ib += len; } else if (r.d === "in") { a = `%QB${qb}…${qb + len - 1}`; qb += len; } else { a = `%IB${ib} / %QB${qb}`; ib += len; qb += len; } return a; });
}
export function ifSheet(kitName, o) {
  const kit = KITS[kitName] || [], cnt = {}, rows = [], cell = (o.cell || "CELL").replace(/[^A-Za-z0-9]/g, "");
  kit.forEach((m) => {
    cnt[m] = (cnt[m] || 0) + 1; const unit = UNIT[m] + String(cnt[m]).padStart(2, "0");
    if (NOBLOCK.has(m)) return;
    const rs = dbRows(m), pn = pnAddr(rs, o.base);
    rs.forEach((r, i) => {
      const tag = `${o.site}.${o.area}.${cell}.${unit}.${r.n}`;   // item-5 6-part tag: site.area.cell.unit.group.signal
      rows.push({ unit, mod: m, word: r.o + (r.w > 1 ? "–" + (r.o + r.w - 1) : ""), name: r.n, type: r.t, dir: r.d, std: r.std,
        reg: "4" + String(o.base + r.o + 1).padStart(4, "0"), pdu: o.base + r.o, pn: pn[i], node: `ns=2;s=${unit}.${r.n}`,
        metric: r.n.replace(".", "/"), topic: `spBv1.0/${o.group}/${r.d === "in" ? "DCMD" : "DDATA"}/${o.edge}/${unit}`, tag, len: tag.length, tagOk: tag.length <= 48 });
    });
  });
  return rows;
}
export function pnName(cell, unit, dev) {
  const slug = String(dev).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const name = `${cell}-${unit}-${slug}`.toLowerCase(), labels = name.split(".");
  const errs = [];
  if (!/^[a-z0-9.-]+$/.test(name)) errs.push("only a-z 0-9 - .");
  if (labels.some((l) => l.length > 63)) errs.push("label > 63");
  if (name.length > 240) errs.push("> 240 chars");
  if (name.startsWith("port-")) errs.push("starts with port-");
  return { name, ok: !errs.length, errs };
}
export function ipPlan(kitName, site, cell0, vlan) {   // exactly as drawIP of fmse6.js + PROFINET name
  const kit = KITS[kitName] || [], cell = (cell0 || "CELL").replace(/[^A-Za-z0-9]/g, ""), third = vlan % 256, net = `10.${site}.${third}.0/24`, gw = `10.${site}.${third}.1`;
  const next = RANGES.map((r) => r[0]), cnt = {}, rows = [];
  kit.forEach((m) => {
    cnt[m] = (cnt[m] || 0) + 1; const unit = UNIT[m] + String(cnt[m]).padStart(2, "0");
    (MODDEV[m] || []).forEach(([dn, g]) => { const ip = next[g]++; const pn = pnName(cell, unit, dn);
      rows.push({ tag: `${cell}.${unit}`, dev: dn, mod: m, ip: ip <= RANGES[g][1] ? `10.${site}.${third}.${ip}` : "range full!", net, gw, vlan, pn: pn.name, pnOk: pn.ok, pnErr: pn.errs.join(", ") }); });
  });
  return rows;
}

/* ---- security */
const fm = (r, v) => r === "*" || r === v;
export function fwCheck(rules, f) {   // f = [src host, src zone, dst host, dst zone, service]
  for (const r of rules) if (fm(r[1], f[1]) && fm(r[2], f[0]) && fm(r[3], f[3]) && fm(r[4], f[2]) && fm(r[5], f[4])) return { id: r[0], action: r[6] };
  return { id: "DEFAULT", action: "deny" };
}
export function fwAudit(rules, nb) {
  const ns = new Set(nb.flatMap(([a, b]) => [a + "|" + b, b + "|" + a])), out = [];
  rules.forEach((r) => { if (r[6] !== "allow") return;
    if (r[1] === "*" || r[3] === "*" || !ns.has(r[1] + "|" + r[3])) out.push({ id: r[0], finding: "crosses zones", detail: `${r[1]} → ${r[3]} are not neighbours` });
    if (r[5] === "*") out.push({ id: r[0], finding: "any service", detail: `${r[2]} → ${r[4]} all services` }); });
  return out;
}
const rcls = (x) => (x >= 15 ? "high" : x >= 8 ? "medium" : "low");
export function riskTable(threats) {
  const rows = threats.map(([n, z, L, C, cms]) => { const r = L * C, c = rcls(r), pts = cms.reduce((a, x) => a + num(x[1]), 0), rL = Math.max(1, L - pts), rr = rL * C;
    return { threat: n, zone: z, L, C, risk: r, cls: c, slt: { high: 3, medium: 2, low: 1 }[c], points: pts, resL: rL, residual: rr, resCls: rcls(rr) }; });
  const zone = {}; rows.forEach((r) => { zone[r.zone] = Math.max(zone[r.zone] || 0, r.slt); });
  return { rows, zone };
}

/* ================================================================== state (user edits, persisted) */
const NC = EX6.net_calc, DB = EX6.datablock, HS = EX6.handshake_sim, SEC = EX6.security, NM = EX6.naming;
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
const DEF = {
  g: { lat: pick(NC.latency, ["wire_bytes", "R_Mbit", "hops", "t_sw_us", "length_m", "max_wire_bytes"]), iol: pick(NC.iolink, ["pd_in", "pd_out", "od", "device_min_cycle_ms"]),
    ua: pick(NC.opcua, ["items", "sampling_ms", "change_ratio", "bytes_per_notification", "subscriptions", "publishing_ms", "overhead_per_message"]),
    mq: pick(NC.mqtt, ["edges", "rate", "topic", "metrics_per_msg", "bytes_per_metric", "sparkplug_header", "subscribers"]),
    fi: pick(NC.fibre, ["length_km", "att_db_km", "connectors", "conn_db", "splices", "splice_db", "tx_min_dbm", "rx_sens_dbm"]),
    cidrs: EX6.subnet.cidrs.join("\n"), plan: EX6.subnet.plan.join("\n"), devs: EX6.subnet.devices.map((d) => d.join(" ; ")).join("\n") },
  h: { mod: DB.module, unit: DB.unit, unit_id: DB.unit_id, base: DB.base, values: clone(DB.values), dint: DB.word_order_demo.DINT, real: DB.word_order_demo.REAL,
    cu: { tid: 7, fc: 3, start: 0, qty: 25, values: "2, 1" }, dec: "", decStart: 0, decOrder: "ABCD" },
  i: { sc: 0, exec: HS.scenarios[0].exec_ticks, events: "", jobs: HS.scenarios[0].jobs.join(", ") },
  j: { kit: EX6.ip_plan.kit, site: NM.site, area: NM.area, cell: NM.cell, group: NM.sparkplug_group, edge: NM.sparkplug_edge, ipsite: EX6.ip_plan.site, vlan: EX6.ip_plan.vlan, base: DB.base },
  k: { rules: clone(SEC.rules), threats: clone(SEC.threats) },
};
const S = {};
function loadState() { Object.keys(DEF).forEach((k) => { const v = store.get(k, null); S[k] = v && typeof v === "object" ? Object.assign(clone(DEF[k]), v) : clone(DEF[k]); }); }
const save = (k) => store.set(k, S[k]);
function resetSec(k) { store.del(k); S[k] = clone(DEF[k]); }
function bindIn(id, key, redraw) {   // delegated input → state path → save → redraw outputs
  $(id).addEventListener("input", (e) => { const t = e.target; if (!t.dataset.p) return;
    setP(S, t.dataset.p, t.type === "checkbox" ? t.checked : t.type === "number" ? num(t.value) : t.value); save(key); redraw(); });
}

/* ================================================================== mount */
export function mount(el) {
  loadState();
  el.innerHTML = [html6G(), html6H(), html6I(), html6J(), html6K(), html6L(), html6M(), html6N()].join("");
  [init6G, init6H, init6I, init6J, init6K, init6L, init6M, init6N].forEach((f) => { try { f(); } catch (e) { console.error("fmse6x " + f.name, e); R.errors = (R.errors || []).concat(f.name + ": " + e.message); } });
  window.fe6x = { results, R, hsSim, mbFrame, encode, subnet };   // for tests / cross-checks: window.fe6x.results()
}

/* ================================================================== 6G network calculator lab */
const LAT_F = [["wire_bytes", "Frame on the wire (64-byte frame + 20 preamble/gap)", "bytes"], ["R_Mbit", "Link speed R", "Mbit/s"], ["hops", "Switches on the path (hops)", "", 1], ["t_sw_us", "Switch delay per hop t_sw", "µs"], ["length_m", "Total cable length", "m"], ["max_wire_bytes", "Largest frame that may block a port (1518 + 20)", "bytes"]];
const IOL_F = [["pd_in", "Process data in (device → master)", "bytes", 1], ["pd_out", "Process data out (master → device)", "bytes", 1], ["od", "On-request data per cycle", "bytes", 1], ["device_min_cycle_ms", "Minimum cycle of the device", "ms"]];
const UA_F = [["items", "Monitored items", ""], ["sampling_ms", "Sampling interval", "ms"], ["change_ratio", "Share of samples that change (deadband)", ""], ["bytes_per_notification", "Bytes per notification", "bytes"], ["subscriptions", "Subscriptions", ""], ["publishing_ms", "Publishing interval", "ms"], ["overhead_per_message", "Overhead per publish message", "bytes"]];
const MQ_F = [["edges", "Edge nodes / devices publishing", ""], ["rate", "Messages per second per edge", "/s"], ["topic", "Topic", ""], ["metrics_per_msg", "Metrics per message", ""], ["bytes_per_metric", "Bytes per metric (protobuf)", "bytes"], ["sparkplug_header", "Sparkplug header (timestamp, seq)", "bytes"], ["subscribers", "Subscribers (historian, dashboard …)", ""]];
const FI_F = [["length_km", "Fibre length", "km"], ["att_db_km", "Attenuation", "dB/km"], ["connectors", "Connector pairs", ""], ["conn_db", "Loss per connector pair", "dB"], ["splices", "Splices", ""], ["splice_db", "Loss per splice", "dB"], ["tx_min_dbm", "Transmitter power (minimum)", "dBm"], ["rx_sens_dbm", "Receiver sensitivity", "dBm"]];
function html6G() {
  const g = S.g;
  return card("f66G", "6G · Network calculator lab – latency, IO-Link, OPC UA, MQTT, fibre, IP subnets", "formulas of the shared example (item6_examples.json) · edit any value · reset restores the example",
    intro(`<p>Before the network is ordered, a few numbers decide the design: <b>how long does a frame need</b> through a line of switches, <b>how fast</b> is an IO-Link sensor,
      <b>how much traffic</b> do OPC UA subscriptions and MQTT create, does the <b>fibre</b> between hall and cabinet have enough light, and do the <b>IP subnets</b> fit together without overlap or duplicates.</p>
      <p class="phd-eq">t_tx = wire bytes × 8 ÷ R · base = (hops + 1)·t_tx + hops·t_sw + length·5 ns/m · worst = base + hops × max frame × 8 ÷ R</p>
      <p class="sub">The worst case assumes that at each switch output a maximum frame has just started – priority (VLAN PCP) does not stop a frame already on the wire. PROFINET IRT and TSN time slots remove this term.</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f6GRst">Reset to example values</button></div>
    <div class="grid2">
      <div><h3 class="fe-h3">Latency budget through a line of switches</h3>${inTab("g.lat", g.lat, LAT_F)}<div id="f6GLat"></div></div>
      <div><svg id="f6GLatC" class="fe-chart" viewBox="0 0 680 250" role="img" aria-label="Latency per hop, stacked: transmission, switch delay, waiting for a maximum frame"></svg>
        <div class="sub"><span class="fx-lg"><i class="f6-sw f6-c1"></i>transmission t_tx</span> <span class="fx-lg"><i class="f6-sw f6-c3"></i>switch delay</span> <span class="fx-lg"><i class="f6-sw f6-c2"></i>worst case: max frame ahead</span></div></div>
    </div>
    <div class="grid2">
      <div><h3 class="fe-h3">IO-Link cycle per COM rate</h3><p class="phd-eq">master bytes = 2 + PD out · device bytes = OD + PD in + 1 · bits = 11 × (master + device) + 10 · t = bits ÷ baud · cycle = max(t, device min)</p>${inTab("g.iol", g.iol, IOL_F)}<div id="f6GIol"></div></div>
      <div><h3 class="fe-h3">OPC UA subscription load</h3><p class="phd-eq">notifications/s = items ÷ sampling × change ratio · messages/s = subscriptions ÷ publishing · kbit/s = (notif × bytes + msgs × overhead) × 8 ÷ 1000</p>${inTab("g.ua", g.ua, UA_F)}<div id="f6GUa"></div></div>
    </div>
    <div class="grid2">
      <div><h3 class="fe-h3">MQTT / Sparkplug load at the broker</h3><p class="phd-eq">msg = 2 + (topic length + 2) + metrics × bytes + header · in = edges × rate × msg · out = in × subscribers · kbit/s = (in + out) × 8 ÷ 1000</p>${inTab("g.mq", g.mq, MQ_F)}<div id="f6GMq"></div></div>
      <div><h3 class="fe-h3">Fibre link budget</h3><p class="phd-eq">loss = L·α + n_c·a_c + n_s·a_s · budget = P_tx,min − S_rx · margin = budget − loss ≥ 3 dB</p>${inTab("g.fi", g.fi, FI_F)}<div id="f6GFi"></div></div>
    </div>
    <h3 class="fe-h3">Subnet calculator <span class="sub">one CIDR per line · mask = p ones · network = IP AND mask · broadcast = network OR NOT mask · hosts = 2^(32−p) − 2</span></h3>
    <div class="grid2"><div><textarea class="f6-ta" rows="5" data-p="g.cidrs">${esc(g.cidrs)}</textarea></div><div id="f6GSub"></div></div>
    <div class="grid2">
      <div><h3 class="fe-h3">Overlap checker <span class="sub">subnet plan, one per line</span></h3><textarea class="f6-ta" rows="6" data-p="g.plan">${esc(g.plan)}</textarea><div id="f6GOv"></div></div>
      <div><h3 class="fe-h3">Duplicate-IP checker <span class="sub">name ; IP per line</span></h3><textarea class="f6-ta" rows="6" data-p="g.devs">${esc(g.devs)}</textarea><div id="f6GDup"></div></div>
    </div>
    <p class="am-note"><b>Use case:</b> the example line of 10 PROFINET devices has a base latency of about 0.1 ms but a worst case above 1.3 ms when big frames share the line – so a 1 ms IRT axis group cannot share its line with a camera. Run the overlap and duplicate checks on every supplier IP list before the SAT.</p>
    ${uses("G")}`);
}
const parseDevs = (txt) => String(txt).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.lastIndexOf(";"); return i < 0 ? [l, ""] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
const lines = (txt) => String(txt).split("\n").map((l) => l.trim()).filter(Boolean);
function init6G() { bindIn("f66G", "g", draw6G); $("f6GRst").addEventListener("click", () => { resetSec("g"); $("f66G").outerHTML = html6G(); init6G(); }); draw6G(); }
function draw6G() {
  const g = S.g, l = latency(g.lat);
  $("f6GLat").innerHTML = kv([["t_tx (one small frame on one link)", `<b>${fx(l.ttx, 2)} µs</b>`], ["Cable delay (5 ns/m)", `${fx(l.cable, 2)} µs`], ["<b>Base latency</b>", `<b>${fx(l.base, 2)} µs</b>`],
    ["Max frame on one link", `${fx(l.tmax, 2)} µs`], ["<b>Worst case</b> (one max frame ahead at each hop)", `<b>${fx(l.worst, 2)} µs</b> = ${fx(l.worst / 1000, 3)} ms`],
    ["Verdict", l.worst <= 1000 ? ok(true, "worst case ≤ 1 ms") : `<span class="fe-no">worst case > 1 ms – keep big frames off this line, use IRT / TSN, 1 Gbit/s or fewer hops</span>`]]);
  // bar chart per hop
  const n = Math.max(0, Math.min(60, Math.round(l.hops))), bars = [{ lab: "send", a: l.ttx, b: 0, c: 0 }];
  for (let i = 1; i <= n; i++) bars.push({ lab: "SW" + i, a: l.ttx, b: l.t_sw, c: l.tmax });
  const W = 680, H = 250, x0 = 50, x1 = W - 10, y0 = H - 34, y1 = 14, ymax = Math.max(...bars.map((x) => x.a + x.b + x.c), 1) * 1.08, bw = (x1 - x0) / bars.length;
  const Y = (v) => y0 - v / ymax * (y0 - y1);
  let s = ""; const st = ymax > 500 ? 200 : ymax > 100 ? 50 : 10;
  for (let v = 0; v <= ymax; v += st) s += `<line class="fe-grid" x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}"/><text class="fe-tick" x="${x0 - 5}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
  bars.forEach((b, i) => { const x = x0 + i * bw + bw * 0.15, w = bw * 0.7; let y = y0;
    [[b.a, "f6-c1"], [b.b, "f6-c3"], [b.c, "f6-c2 f6-lt"]].forEach(([v, c]) => { if (v > 0) { const h = y0 - Y(v); y -= h; s += `<rect class="${c}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"><title>${b.lab}: ${fx(v, 2)} µs</title></rect>`; } });
    if (bars.length <= 24 || i % 2 === 0) s += `<text class="fe-tick" x="${(x + w / 2).toFixed(1)}" y="${y0 + 14}" text-anchor="middle">${b.lab}</text>`; });
  s += `<text class="fe-axis" transform="translate(12 ${(y0 + y1) / 2}) rotate(-90)" text-anchor="middle">µs per hop</text><text class="fe-axis" x="${(x0 + x1) / 2}" y="${H - 4}" text-anchor="middle">sender link and each switch (+ its output link) · cable ${fx(l.cable, 1)} µs not drawn</text>`;
  $("f6GLatC").innerHTML = s;
  const io = iolink(g.iol);
  $("f6GIol").innerHTML = tab(["COM", "bit/s", "bits", "t message", "cycle"], io.map((r) => `<tr><td>${r.com}</td><td>${r.baud}</td><td>${r.bits}</td><td>${fx(r.tmsg_ms, 3)} ms</td><td><b>${fx(r.cycle_ms, 3)} ms</b></td></tr>`), "f6-num");
  const ua = opcua(g.ua);
  $("f6GUa").innerHTML = kv([["Notifications / s", fx(ua.notif, 1)], ["Publish messages / s", fx(ua.msgs, 1)], ["Bytes / s", fx(ua.Bps, 0)], ["<b>Load</b>", `<b>${fx(ua.kbit, 1)} kbit/s</b>`],
    ["Verdict", `${ok(ua.kbit < 10000, "network no problem (< 1 % of 1 Gbit/s)", "high load")} <span class="sub">– check the server limit of ${fx(g.ua.items, 0)} monitored items</span>`]]);
  const mq = mqtt(g.mq);
  $("f6GMq").innerHTML = kv([["Topic length", mq.topic_len + " characters"], ["Message size", fx(mq.msg_bytes, 0) + " bytes"], ["In: messages / s", fx(mq.in_msgs, 1)], ["In: bytes / s", fx(mq.in_Bps, 0)], ["Out: bytes / s", fx(mq.out_Bps, 0)], ["<b>Total at the broker</b>", `<b>${fx(mq.kbit, 2)} kbit/s</b>`]]);
  const fi = fibre(g.fi);
  $("f6GFi").innerHTML = kv([["Loss", fx(fi.loss, 2) + " dB"], ["Power budget", fx(fi.budget, 2) + " dB"], ["<b>Margin</b>", `<b>${fx(fi.margin, 2)} dB</b>`], ["Verdict", ok(fi.ok, "margin ≥ 3 dB", "margin < 3 dB – fewer connectors, better fibre or single-mode")]]);
  const sub = lines(g.cidrs).map(subnet);
  $("f6GSub").innerHTML = tab(["CIDR", "Mask", "Network", "Broadcast", "First", "Last", "Hosts"], sub.map((r) => r.err ? `<tr><td>${esc(r.cidr)}</td><td colspan="6" class="fe-no">${esc(r.err)}</td></tr>` :
    `<tr><td><code>${esc(r.cidr)}</code>${r.isNet ? "" : ' <span class="sub">(host bits set)</span>'}</td><td>${r.mask}</td><td>${r.network}</td><td>${r.broadcast}</td><td>${r.first}</td><td>${r.last}</td><td>${r.hosts}</td></tr>`), "f6-num");
  const ov = overlaps(lines(g.plan));
  $("f6GOv").innerHTML = ov.length ? `<p class="fe-no">✗ ${ov.length} overlap(s):</p>${ul(ov.map(([a, b]) => `<code>${esc(a)}</code> ⇄ <code>${esc(b)}</code>`))}` : `<p class="fe-ok">✓ no overlaps</p>`;
  const du = duplicates(parseDevs(g.devs));
  $("f6GDup").innerHTML = du.length ? `<p class="fe-no">✗ ${du.length} duplicate address(es):</p>${ul(du.map((d) => `<code>${esc(d.ip)}</code>: ${d.names.map(esc).join(" · ")}`))}` : `<p class="fe-ok">✓ no duplicates</p>`;
}

/* ================================================================== 6H Modbus frame lab */
const SBITS = ["Ready", "Busy", "Done", "Fault", "Warning", "Auto", "PartPresent", "HS.Ready"];
const CBITS = ["CmdChangeRequest", "HS.Request", "HS.Ack", "FaultReset"];
const MODS = Object.keys(UNIT).filter((k) => !NOBLOCK.has(k));
function html6H() {
  const h = S.h;
  return card("f66H", "6H · Modbus frame lab – standard block, registers, frames, exceptions, word order", "MBAP + PDU byte by byte · server = module " + esc(DB.unit) + " with the example values · checks: function → quantity → address → write allowed",
    intro(`<p>Modbus TCP sends <b>16-bit registers</b>. A frame = <b>MBAP header</b> (transaction id 2 bytes, protocol id 0 2 bytes, length 2 bytes = bytes that follow, unit id 1 byte) + <b>PDU</b> (function code + data).
      INT / UINT / WORD use one register, DINT and REAL use two – in this standard the <b>high word first</b> ("ABCD"), all bytes big-endian. REAL = IEEE 754 single.</p>
      <p class="phd-eq">FC03 request = 03 start(2) qty(2) → response 03 bytecount data · FC06 = 06 addr(2) value(2) (echo) · FC16 = 10 start(2) qty(2) bytecount data → response 10 start qty · exception = (fc + 0x80) code</p>
      <p class="sub">Exception codes: 01 illegal function · 02 illegal data address (outside the map, or write to a read-only word) · 03 illegal data value (qty 0 or > 125 for FC03, > 123 for FC16) · 04 server device failure.</p>`) +
    `<div class="fe-row"><label>Module <select id="f6HMod" data-p="h.mod">${MODS.map((k) => `<option value="${k}"${k === h.mod ? " selected" : ""}>${k} · ${UNIT[k]}</option>`).join("")}</select></label>
      <label>Unit <input type="text" data-p="h.unit" value="${esc(h.unit)}" style="width:80px"></label><label>Unit id <input type="number" data-p="h.unit_id" value="${h.unit_id}" min="0" max="255"></label>
      <label>Base (PDU address of word 0) <input type="number" data-p="h.base" value="${h.base}" min="0"></label><button class="mx-el" id="f6HRst">Reset to example values</button></div>
    <div class="grid2"><div><h3 class="fe-h3">Values of the module (edit)</h3><div id="f6HVals" class="fe-scroll f6-tall"></div>
        <h4>Status.Bits (word 4) and Command.Bits (word 3)</h4><div id="f6HBits"></div></div>
      <div><h3 class="fe-h3">Encoded registers</h3><div id="f6HRegs" class="f6-tall"></div></div></div>
    <h3 class="fe-h3">FC03 response – read of the standard block (words 0–19, transaction 1)</h3><pre class="f6-pre" id="f6HFc03"></pre>
    <h3 class="fe-h3">Frame builder – the 6 example frames <span class="sub">server map = 20 + module part words; writes only to 'in' / 'in/out' words</span></h3>
    <div id="f6HFr"></div>
    <h4>Own frame</h4><div class="fe-row"><label>Transaction <input type="number" data-p="h.cu.tid" value="${h.cu.tid}" min="0" max="65535"></label>
      <label>Function <select data-p="h.cu.fc">${[[3, "03 read holding registers"], [6, "06 write single register"], [16, "16 write multiple registers"], [4, "04 read input registers (not in this server)"], [5, "05 write coil (not supported)"]].map(([v, n]) => `<option value="${v}"${+h.cu.fc === v ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Start (PDU) <input type="number" data-p="h.cu.start" value="${h.cu.start}" min="0" max="65535"></label><label>Quantity (03) <input type="number" data-p="h.cu.qty" value="${h.cu.qty}" min="0" max="65535"></label>
      <label class="f6-grow">Values (06: first, 16: all) <input type="text" data-p="h.cu.values" value="${esc(h.cu.values)}" class="f6-wide"></label></div><div id="f6HCu"></div>
    <h3 class="fe-h3">Decoder <span class="sub">paste a response (hex) → named values</span></h3>
    <div class="fe-row"><label>Start word of the request <input type="number" data-p="h.decStart" value="${h.decStart}" min="0"></label>
      <label>32-bit word order <select data-p="h.decOrder">${ORDERS.map((o) => `<option${o === h.decOrder ? " selected" : ""}>${o}</option>`).join("")}</select></label><button class="mx-el" id="f6HDecFill">Use the FC03 response above</button></div>
    <textarea class="f6-ta" rows="3" data-p="h.dec" id="f6HDec" placeholder="00 01 00 00 00 2B 01 03 28 …">${esc(h.dec)}</textarea><div id="f6HDecO"></div>
    <h3 class="fe-h3">Word-order demo <span class="sub">device sends in variant X – a client that decodes the standard ABCD reads …</span></h3>
    <div class="fe-row"><label>DINT <input type="number" data-p="h.dint" value="${h.dint}" step="1"></label><label>REAL <input type="number" data-p="h.real" value="${h.real}" step="any"></label></div><div id="f6HWo"></div>
    <p class="am-note"><b>Use case:</b> the commissioning engineer prints the expected FC03 response of each module and compares it with the Wireshark capture (<code>mbtcp.trans_id == 1</code>). A Job.Id of 292 618 241 instead of 70001 means word swap (CDAB) – fix it once in the gateway or the client, and write "ABCD" into the interface sheet.</p>
    ${uses("H")}`);
}
const hVals = () => { const h = S.h, v = {}; dbRows(h.mod).forEach((r) => { v[r.n] = h.values[r.n] == null ? (/STRING/.test(r.t) ? "" : 0) : h.values[r.n]; }); return v; };
const hSrv = () => { const h = S.h, e = encode(h.mod, hVals(), Math.max(0, h.base | 0)); e.unit = h.unit_id | 0; return e; };
function init6H() {
  bindIn("f66H", "h", () => draw6H(false));
  $("f6HVals").addEventListener("input", (e) => { const t = e.target; if (t.dataset.v == null) return; S.h.values[t.dataset.v] = t.type === "number" ? num(t.value) : t.value; save("h"); draw6H(false); });
  $("f6HVals").addEventListener("change", () => draw6H(true));
  $("f66H").addEventListener("change", (e) => { if (e.target.id === "f6HMod") draw6H(true); });
  $("f6HBits").addEventListener("input", (e) => { const t = e.target; if (!t.dataset.b) return; const [nm, bit] = t.dataset.b.split(":"); let v = num(S.h.values[nm]) | 0; v = t.checked ? v | (1 << +bit) : v & ~(1 << +bit); S.h.values[nm] = v; save("h"); draw6H(true); });
  $("f6HRst").addEventListener("click", () => { resetSec("h"); $("f66H").outerHTML = html6H(); init6H(); });
  $("f6HDecFill").addEventListener("click", () => { const e = hSrv(); S.h.dec = mbFrame({ tid: 1, fc: 3, start: e.base, qty: 20 }, e).response; S.h.decStart = 0; $("f6HDec").value = S.h.dec; save("h"); draw6H(false); });
  draw6H(true);
}
function draw6H(full) {
  const h = S.h, v = hVals(), e = hSrv(), rows = dbRows(h.mod);
  if (full) {
    $("f6HVals").innerHTML = `<table class="am-tab f6-num"><thead><tr><th>Word</th><th>Name</th><th>Type</th><th>Dir</th><th>Value</th></tr></thead><tbody>${rows.map((r) => `<tr${r.std ? "" : ' class="fe-sel"'}><td>${r.o}</td><td><code>${esc(r.n)}</code></td><td>${esc(r.t)}</td><td>${r.d}</td><td><input type="${/STRING/.test(r.t) ? "text" : "number"}" step="any" data-v="${esc(r.n)}" value="${esc(v[r.n])}" class="f6-vin"></td></tr>`).join("")}</tbody></table>`;
    const bits = (nm, labels, n) => { const x = num(v[nm]) | 0; return `<div class="f6-bits"><b>${nm} = ${x} = 0x${hex4(x)}</b><br>${Array.from({ length: n }, (_, i) => `<label class="f6-bit"><input type="checkbox" data-b="${nm}:${i}"${x & (1 << i) ? " checked" : ""}> bit${i} ${esc(labels[i] || "spare")}</label>`).join("")}</div>`; };
    $("f6HBits").innerHTML = bits("Status.Bits", SBITS, 8) + bits("Command.Bits", CBITS, 8);
  }
  $("f6HRegs").innerHTML = tab(["Word", "Register", "PDU", "Name", "Value", "Hex"], e.table.map((r) => `<tr><td>${r.word}</td><td><code>${r.reg}</code></td><td>${r.pdu}</td><td class="sub">${esc(r.name)}</td><td>${r.value}</td><td><code>${r.hex}</code></td></tr>`), "f6-num f6-small");
  const fc03 = mbFrame({ tid: 1, fc: 3, start: e.base, qty: 20 }, e);
  $("f6HFc03").textContent = `request : ${fc03.request}\nresponse: ${fc03.response}\n          MBAP (tid ${fc03.tid}, protocol 0, length 0x2B = 43, unit ${e.unit}) + 03 + bytecount 0x28 = 40 + 20 registers`;
  const frs = DB.frames.map((f) => mbFrame({ ...f, start: f.start + e.base - DB.base }, e));
  $("f6HFr").innerHTML = tab(["#", "Frame", "Request (hex)", "Response (hex)", "Result"], frs.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td><code class="f6-brk">${r.request}</code></td><td><code class="f6-brk">${r.response}</code></td><td>${r.exc ? `<span class="fe-no">exception ${esc(r.exception)}</span>` : '<span class="fe-ok">OK</span>'}</td></tr>`), "f6-small");
  const cu = h.cu, cv = String(cu.values).split(/[\s,;]+/).filter(Boolean).map((x) => num(x) | 0);
  const c = mbFrame({ tid: cu.tid, fc: +cu.fc, start: cu.start, qty: cu.qty, value: cv[0] || 0, values: cv }, e);
  $("f6HCu").innerHTML = kv([["Request", `<code class="f6-brk">${c.request}</code>`], ["Response", `<code class="f6-brk">${c.response}</code>`], ["Result", c.exc ? `<span class="fe-no">exception ${esc(c.exception)}</span>` : '<span class="fe-ok">OK</span>']]);
  const hex = String(h.dec || "").trim();
  if (!hex) $("f6HDecO").innerHTML = `<p class="sub">Paste a response or press the button.</p>`;
  else { const d = decodeResp(hex, h.mod, h.decStart | 0, h.decOrder);
    $("f6HDecO").innerHTML = d.err && d.tid == null ? `<p class="fe-no">${esc(d.err)}</p>` : kv([["MBAP", `transaction ${d.tid}, protocol ${d.pid}, length ${d.len} ${d.lenOk ? ok(true, "matches") : '<span class="fe-no">✗ does not match the bytes</span>'}, unit ${d.unit}`], ["Function", d.exception ? `<span class="fe-no">exception: ${esc(d.exception)}</span>` : d.err ? `<span class="fe-no">${esc(d.err)}</span>` : `${d.fc} · bytecount ${d.bytecount} (${d.regs.length} registers) ${d.bcOk ? "" : '<span class="fe-no">✗ bytecount wrong</span>'}`]]) +
      (d.rows && d.rows.length ? tab(["Word", "Name", "Type", "Value"], d.rows.map((r) => `<tr><td>${r.word}</td><td><code>${esc(r.name)}</code></td><td>${esc(r.type)}</td><td><b>${esc(typeof r.value === "number" ? +r.value.toPrecision(10) : r.value)}</b></td></tr>`), "f6-num f6-small") : ""); }
  const wo = (val, t) => wordOrder(val, t).map((r) => `<tr${r.order === "ABCD" ? ' class="fe-sel"' : ""}><td>${t} ${esc(val)}</td><td><b>${r.order}</b></td><td><code>${r.bytes}</code></td><td><code>${r.regs.join(" ")}</code></td><td>${r.order === "ABCD" ? `<span class="fe-ok">${+r.readAsABCD.toPrecision(10)} ✓</span>` : `<span class="fe-no">${+r.readAsABCD.toPrecision(10)}</span>`}</td></tr>`).join("");
  $("f6HWo").innerHTML = tab(["Value", "Device order", "Bytes on the wire", "Registers (hex)", "Read as ABCD"], [wo(num(h.dint), "DINT"), wo(num(h.real), "REAL")]);
}

/* ================================================================== 6I handshake & heartbeat simulator */
const HSIG = [["CC.Request", (t) => t.cc.Request], ["MOD.HSReady", (t) => t.md.HSReady], ["MOD.Busy", (t) => t.md.Busy], ["MOD.Done", (t) => t.md.Done], ["CC.Ack", (t) => t.cc.Ack], ["MOD.Ready", (t) => t.md.Ready],
  ["CC heartbeat", (t) => t.cc.HB % 2], ["MOD heartbeat", (t) => t.md.HB % 2]];
const CSCOL = { S0: "f6-st0", S1: "f6-st1", S2: "f6-st1", S3: "f6-st3", S4: "f6-st4", OFFLINE: "f6-st5", ERR: "f6-st6", IDLE: "f6-st0", ACCEPT: "f6-st1", EXEC: "f6-st3", DONE: "f6-st4" };
const I = { tick: 0, timer: null, sim: null };
const scFromState = () => { const i = S.i, base = HS.scenarios[i.sc] || HS.scenarios[0];
  const ev = String(i.events).split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(\d+)\s+([A-Z_]+)/); return m ? [+m[1], m[2]] : null; }).filter(Boolean);
  const jobs = String(i.jobs).split(/[\s,;]+/).filter(Boolean).map((x) => num(x) | 0);
  return { name: base.name, jobs: jobs.length ? jobs : base.jobs, exec_ticks: Math.max(1, i.exec | 0), events: ev }; };
function html6I() {
  return card("f66I", "6I · Handshake & heartbeat simulator – cell controller ⇄ module", "rules of handshake_sim._rules · one tick = 100 ms poll · one-tick delay between the two sides · same log line by line as the guide and the Python tool",
    intro(`<p>Two controllers that only <b>poll</b> each other (Modbus TCP, OPC UA read) cannot use a single "start" bit safely – a lost or doubled message would start a job twice or never.
      The <b>4-step handshake</b> makes every step visible on both sides: the cell controller (CC) sets <b>Request</b> with the job id → the module answers <b>HSReady</b> (accepted, Busy) → CC drops Request → module drops HSReady and starts →
      module sets <b>Done</b> → CC sets <b>Ack</b> → module drops Done → CC drops Ack. Every step waits for the other side; each step has a <b>timeout</b>.</p>
      <p>The <b>heartbeat</b>: each side counts a word up every second (here every 10 ticks). If the partner's counter does not change for 3 s (30 ticks) the link is lost: the CC goes OFFLINE and later <b>resynchronises</b> from the module's Busy / Done bits – no job is started twice.</p>
      <p class="phd-eq">each tick k: snapshot of both images (end of k−1) → 1 events → 2 module → 3 cell controller · success is checked before the timeout · lost if k − last change ≥ 30</p>
      <p class="sub">Module states IDLE → ACCEPT → EXEC → DONE → IDLE. CC states S0 wait ready → S1 wait accept → S2 wait release → S3 wait done → S4 wait done clear → S0; OFFLINE and ERR (operator reset).</p>`) +
    `<div class="fe-row"><label>Scenario <select id="f6IS">${HS.scenarios.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join("")}</select></label>
      <label>Exec ticks <input type="number" data-p="i.exec" min="1" step="1" id="f6IEx"></label><label class="f6-grow">Jobs <input type="text" data-p="i.jobs" id="f6IJ" class="f6-wide"></label></div>
    <div class="fe-row"><label class="f6-grow">Events (tick KIND per line: MOD_FREEZE, MOD_RESUME, CC_FREEZE, CC_RESUME, IGNORE_REQ_ON, IGNORE_REQ_OFF, CC_RESET)<textarea class="f6-ta" rows="3" data-p="i.events" id="f6IEv"></textarea></label></div>
    <div class="fe-row"><button class="mx-el" id="f6IPlay">▶ Play</button><button class="mx-el" id="f6IBk">◀ −1</button><button class="mx-el" id="f6ISt">+1 ▶</button><button class="mx-el" id="f6INx">next log line ▶▶</button><button class="mx-el" id="f6IEnd">End</button><button class="mx-el" id="f6IRst">Reset scenario</button>
      <label>Speed <select id="f6ISp"><option value="5">5 ticks/s</option><option value="10" selected>10 ticks/s (real time)</option><option value="25">25 ticks/s</option><option value="60">60 ticks/s</option></select></label>
      <label class="f6-grow">Tick <input type="range" id="f6IR" min="0" max="${HS.K}" step="1" value="0" class="f6-range"></label><b id="f6IT" class="f6-tnow"></b><button class="mx-el" id="f6ICsv">Log CSV</button></div>
    <div class="fe-scroll"><svg id="f6IG" class="fe-chart f6-tim" role="img" aria-label="Timing diagram of the handshake signals, heartbeats and states over ticks"></svg></div>
    <div class="sub f6-lgd"><span class="fx-lg"><i class="f6-sw f6-st0"></i>S0 / IDLE</span><span class="fx-lg"><i class="f6-sw f6-st1"></i>S1–S2 / ACCEPT</span><span class="fx-lg"><i class="f6-sw f6-st3"></i>S3 / EXEC</span><span class="fx-lg"><i class="f6-sw f6-st4"></i>S4 / DONE</span><span class="fx-lg"><i class="f6-sw f6-st5"></i>OFFLINE</span><span class="fx-lg"><i class="f6-sw f6-st6"></i>ERR</span><span class="fx-lg"><i class="f6-sw f6-frz"></i>frozen (PLC stopped)</span> · click the diagram to jump to a tick</div>
    <div class="grid2"><div id="f6INow"></div><div id="f6IK"></div></div>
    <h3 class="fe-h3">Log <span class="sub">lines up to the current tick in bold</span></h3><div id="f6ILog" class="f6-tall"></div>
    <p class="am-note"><b>Use case:</b> at the FAT pull the module cable for 6 s (scenario B): the CC must log COMM_LOSS after ~2–3 s, keep the job, and after the cable is back continue with RESYNC_BUSY – the job completes once (no double start). Scenario C shows why every step needs a timeout and an operator reset.</p>
    ${uses("I")}`);
}
function i6Fill() { const i = S.i; $("f6IS").value = i.sc; $("f6IEx").value = i.exec; $("f6IJ").value = i.jobs; $("f6IEv").value = i.events; }
function i6Load(sc) { const s = HS.scenarios[sc]; S.i = { sc, exec: s.exec_ticks, jobs: s.jobs.join(", "), events: s.events.map(([t, k]) => t + " " + k).join("\n") }; save("i"); i6Fill(); i6Run(); }
function i6Run() { I.sim = hsSim(HS, scFromState()); I.tick = Math.min(I.tick, HS.K); draw6I(); }
function i6Stop() { if (I.timer) { clearInterval(I.timer); I.timer = null; } const b = $("f6IPlay"); if (b) b.textContent = "▶ Play"; }
function init6I() {
  if (!S.i.events && !store.get("i", null)) { i6Load(0); } else { i6Fill(); i6Run(); }
  bindIn("f66I", "i", i6Run);
  $("f6IS").addEventListener("change", () => { I.tick = 0; i6Load(+$("f6IS").value); });
  $("f6IRst").addEventListener("click", () => { I.tick = 0; i6Load(S.i.sc); });
  const go = (t) => { I.tick = Math.max(0, Math.min(HS.K, t)); draw6I(); };
  $("f6IBk").addEventListener("click", () => { i6Stop(); go(I.tick - 1); });
  $("f6ISt").addEventListener("click", () => { i6Stop(); go(I.tick + 1); });
  $("f6IEnd").addEventListener("click", () => { i6Stop(); go(HS.K); });
  $("f6INx").addEventListener("click", () => { i6Stop(); const n = I.sim.log.map((l) => +l.split(" ")[0]).find((k) => k > I.tick); go(n == null ? HS.K : n); });
  $("f6IR").addEventListener("input", (e) => { i6Stop(); go(+e.target.value); });
  $("f6IG").addEventListener("click", (e) => { const svg = $("f6IG"), r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; const x = (e.clientX - r.left) / r.width * vb.width; i6Stop(); go(Math.round((x - 118) / 3)); });
  $("f6IPlay").addEventListener("click", () => {
    if (I.timer) { i6Stop(); return; }
    if (I.tick >= HS.K) I.tick = 0;
    $("f6IPlay").textContent = "❚❚ Pause";
    I.timer = setInterval(() => { if (!live($("f6IG"))) { i6Stop(); return; } if (I.tick >= HS.K) { i6Stop(); return; } I.tick++; draw6I(); }, 1000 / num($("f6ISp").value, 10));
  });
  $("f6ICsv").addEventListener("click", () => download("handshake_log.csv", toCSV([["tick", "text"], ...I.sim.log.map((l) => { const i = l.indexOf(" "); return [l.slice(0, i), l.slice(i + 1)]; })]), "text/csv"));
}
function draw6I() {
  const sim = I.sim, K = HS.K, T = sim.trace, k = I.tick, x0 = 118, dx = 3, W = x0 + (K + 1) * dx + 12, rh = 22, top = 26;
  const X = (t) => x0 + t * dx;
  const nSig = HSIG.length, H = top + (nSig + 2) * rh + 20;
  let s = "";
  // frozen shading
  [["mf", "f6-frz"], ["cf", "f6-frz2"]].forEach(([f, c]) => { let a = null; T.forEach((t, i) => { if (t[f] && a == null) a = i; if ((!t[f] || i === T.length - 1) && a != null) { const e = t[f] ? i + 1 : i; s += `<rect class="${c}" x="${X(a)}" y="${top - 4}" width="${(e - a) * dx}" height="${(nSig + 2) * rh + 4}"/>`; a = null; } }); });
  for (let t = 0; t <= K; t += 10) s += `<line class="fe-grid" x1="${X(t)}" x2="${X(t)}" y1="${top - 4}" y2="${H - 16}"/>${t % 50 === 0 ? `<text class="fe-tick" x="${X(t)}" y="${H - 4}" text-anchor="middle">${t}</text>` : ""}`;
  HSIG.forEach(([n, f], j) => { const y = top + j * rh, yh = y + 3, yl = y + rh - 5; let d = "";
    T.forEach((t, i) => { const yy = f(t) ? yh : yl; d += (i ? ` H${X(i)} V${yy}` : `M${X(0)} ${yy}`); }); d += ` H${X(K + 1)}`;
    s += `<text class="fe-tick" x="4" y="${y + 14}">${n}</text><path class="f6-sig${j >= 6 ? " f6-hb" : ""}" d="${d}"/>`; });
  [["CC state", "cs"], ["MOD state", "ms"]].forEach(([n, f], j) => { const y = top + (nSig + j) * rh; s += `<text class="fe-tick" x="4" y="${y + 14}">${n}</text>`;
    let a = 0; for (let i = 1; i <= T.length; i++) { if (i === T.length || T[i][f] !== T[a][f]) { const w = (i - a) * dx; s += `<rect class="${CSCOL[T[a][f]] || "f6-st0"}" x="${X(a)}" y="${y + 2}" width="${w}" height="${rh - 5}"><title>${T[a][f]} ticks ${a}–${i - 1}</title></rect>${w > 26 ? `<text class="f6-stl" x="${X(a) + 2}" y="${y + 14}">${T[a][f]}</text>` : ""}`; a = i; } } });
  scFromState().events.forEach(([t, kd]) => { if (t <= K) s += `<line class="f6-ev" x1="${X(t)}" x2="${X(t)}" y1="10" y2="${H - 16}"/><text class="fe-tick f6-evt" x="${X(t) + 2}" y="12">${kd}</text>`; });
  s += `<line class="f6-cur" x1="${X(k) + dx / 2}" x2="${X(k) + dx / 2}" y1="${top - 6}" y2="${H - 16}"/>`;
  const svg = $("f6IG"); svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.innerHTML = s;
  $("f6IR").value = k; $("f6IT").textContent = `k = ${k} (${fx(k * HS.tick_ms / 1000, 1)} s)`;
  const t = T[k];
  $("f6INow").innerHTML = `<h4>At tick ${k}</h4>` + kv([["CC state", `<b>${t.cs}</b>${t.cf ? ' <span class="fe-no">frozen</span>' : ""}${t.cl ? ' <span class="fe-no">link lost</span>' : ""}`], ["CC image", `Request ${t.cc.Request} · Ack ${t.cc.Ack} · JobId ${t.cc.JobId} · HB ${t.cc.HB}`],
    ["MOD state", `<b>${t.ms}</b>${t.mf ? ' <span class="fe-no">frozen</span>' : ""}${t.ml ? ' <span class="fe-no">CC lost</span>' : ""}`], ["MOD image", `Ready ${t.md.Ready} · Busy ${t.md.Busy} · Done ${t.md.Done} · HSReady ${t.md.HSReady} · JobId ${t.md.JobId} · HB ${t.md.HB}`]]);
  const P = sim.KPI;
  $("f6IK").innerHTML = `<h4>KPIs (whole run 0–${K})</h4>` + kpis([["log lines", P.lines], ["jobs completed", P.completed.length + " / " + scFromState().jobs.length, P.completed.length === scFromState().jobs.length ? "fe-ok" : "fe-no"], ["final CC state", P.finalCC, P.finalCC === "ERR" ? "fe-no" : ""],
    ["HS / job timeouts", P.hsTimeouts + " / " + P.jobTimeouts, P.hsTimeouts + P.jobTimeouts ? "fe-no" : ""], ["loss detected after", P.detectDelay == null ? "–" : P.detectDelay + " ticks"]]) +
    `<p class="sub">Completions: ${P.completed.map(([j, c]) => `${j} at ${c}`).join(" · ") || "none"}</p>`;
  $("f6ILog").innerHTML = `<table class="am-tab f6-small f6-num"><tbody>${sim.log.map((l) => { const i = l.indexOf(" "), kk = +l.slice(0, i), tx = l.slice(i + 1); return `<tr class="${kk <= k ? "" : "f6-dim"}${/LOSS|TIMEOUT|ERR/.test(tx) ? " f6-bad" : ""}"><td>${kk}</td><td>${kk <= k ? "<b>" + esc(tx) + "</b>" : esc(tx)}</td></tr>`; }).join("")}</tbody></table>`;
}

/* ================================================================== 6J interface sheet generator */
function html6J() {
  const j = S.j;
  return card("f66J", "6J · Interface sheet generator – one row per data word on every protocol", "kit → units (counters per module as in 6D) → standard block + module part · Modbus / PROFINET / OPC UA / Sparkplug / tag · IP plan with PROFINET names · CSV",
    intro(`<p>The <b>interface sheet</b> is the contract between the cell supplier and each module supplier: for every word of the module data block it lists the address on every protocol, the type, the direction and the tag.
      It is generated, not typed – then all modules are identical and the SCADA / historian import is a copy.</p>
      <p class="phd-eq">Modbus 4xxxx = 4 + (base + word + 1) · PDU = base + word · tag = SITE.AREA.CELL.UNIT.group.signal (item 5, 6 parts) ≤ 48 characters · PROFINET name = lower-case cell-unit-device ('-' for other characters)</p>`) +
    `<div class="fe-row"><label>Kit <select data-p="j.kit">${Object.keys(KITS).map((k) => `<option${k === j.kit ? " selected" : ""}>${esc(k)}</option>`).join("")}</select></label>
      <label>Site <input type="text" data-p="j.site" value="${esc(j.site)}" style="width:70px"></label><label>Area <input type="text" data-p="j.area" value="${esc(j.area)}" style="width:70px"></label>
      <label>Cell <input type="text" data-p="j.cell" value="${esc(j.cell)}" style="width:70px"></label><label>Sparkplug group <input type="text" data-p="j.group" value="${esc(j.group)}" style="width:70px"></label>
      <label>Edge <input type="text" data-p="j.edge" value="${esc(j.edge)}" style="width:60px"></label><label>Base register / byte <input type="number" data-p="j.base" value="${j.base}" min="0"></label></div>
    <div id="f6JSum"></div>
    <div class="fe-row"><button class="mx-el" id="f6JCsv">Interface sheet CSV</button><button class="mx-el" id="f6JIpCsv">IP plan CSV</button><button class="mx-el" id="f6JRst">Reset</button></div>
    <div id="f6JTab" class="f6-tall"></div>
    <h3 class="fe-h3">IP plan with PROFINET device names <span class="sub">exactly the 6D rules · site (2nd octet) and VLAN</span></h3>
    <div class="fe-row"><label>Site number <input type="number" data-p="j.ipsite" value="${j.ipsite}" min="0" max="255"></label><label>Cell VLAN <input type="number" data-p="j.vlan" value="${j.vlan}" min="2" max="4094"></label></div>
    <div id="f6JIp" class="f6-tall"></div>
    <p class="am-note"><b>Use case:</b> the CSV is an annex of each module purchase order; the supplier fills in his PLC addresses and signs. The same file imports into the SCADA tag list and the historian. PROFINET names follow one rule, so "assign device name" becomes copy and paste.</p>
    ${uses("J")}`);
}
let J = { rows: [], ip: [] };
function init6J() { bindIn("f66J", "j", draw6J);
  $("f6JRst").addEventListener("click", () => { resetSec("j"); $("f66J").outerHTML = html6J(); init6J(); });
  $("f6JCsv").addEventListener("click", () => download(`interface_sheet_${S.j.cell}.csv`, toCSV([["Unit", "Module", "Word", "Name", "Type", "Direction (module view)", "Modbus register", "PDU address", "PROFINET", "OPC UA NodeId", "Sparkplug metric", "Sparkplug topic", "Tag", "Tag length", "Tag OK"],
    ...J.rows.map((r) => [r.unit, r.mod, r.word, r.name, r.type, r.dir, r.reg, r.pdu, r.pn, r.node, r.metric, r.topic, r.tag, r.len, r.tagOk ? "yes" : "TOO LONG"])]), "text/csv"));
  $("f6JIpCsv").addEventListener("click", () => download(`ip_plan_pn_${S.j.cell}.csv`, toCSV([["Tag", "Device", "Module", "IP", "Subnet", "Gateway", "VLAN", "PROFINET name", "Name OK"], ...J.ip.map((r) => [r.tag, r.dev, r.mod, r.ip, r.net, r.gw, r.vlan, r.pn, r.pnOk ? "yes" : r.pnErr])]), "text/csv"));
  draw6J(); }
function draw6J() {
  const j = S.j; J.rows = ifSheet(j.kit, { site: j.site, area: j.area, cell: j.cell, group: j.group, edge: j.edge, base: Math.max(0, j.base | 0) });
  J.ip = ipPlan(j.kit, Math.max(0, Math.min(255, j.ipsite | 0)), j.cell, j.vlan | 0 || 101);
  const units = [...new Set(J.rows.map((r) => r.unit))], longest = J.rows.reduce((a, r) => (r.len > a.len ? r : a), { len: 0, tag: "" }), bad = J.rows.filter((r) => !r.tagOk).length;
  $("f6JSum").innerHTML = kpis([["units with a data block", units.length], ["sheet rows", J.rows.length], ["longest tag", longest.len + " chars", longest.len > 48 ? "fe-no" : "fe-ok"], ["tags > 48", bad, bad ? "fe-no" : "fe-ok"], ["IP plan rows", J.ip.length]]) + `<p class="sub">Longest tag: <code>${esc(longest.tag)}</code></p>`;
  $("f6JTab").innerHTML = tab(["Unit", "Word", "Name", "Type", "Dir", "Modbus", "PDU", "PROFINET", "OPC UA NodeId", "Sparkplug metric / topic", "Tag"], J.rows.map((r) => `<tr${r.std ? "" : ' class="fe-sel"'}><td>${r.unit}</td><td>${r.word}</td><td><code>${esc(r.name)}</code></td><td>${esc(r.type)}</td><td>${r.dir}</td><td><code>${r.reg}</code></td><td>${r.pdu}</td><td><code>${r.pn}</code></td><td><code>${esc(r.node)}</code></td><td><code>${esc(r.metric)}</code><br><span class="sub">${esc(r.topic)}</span></td><td><code>${esc(r.tag)}</code> ${r.tagOk ? "" : `<span class="fe-no">${r.len} > 48</span>`}</td></tr>`), "f6-small f6-num");
  $("f6JIp").innerHTML = tab(["Tag", "Device", "Module", "IP", "PROFINET device name", "Rule"], J.ip.map((r) => `<tr><td><code>${esc(r.tag)}</code></td><td>${esc(r.dev)}</td><td>${r.mod}</td><td><code>${esc(r.ip)}</code></td><td><code>${esc(r.pn)}</code></td><td>${r.pnOk ? '<span class="fe-ok">✓</span>' : `<span class="fe-no">${esc(r.pnErr)}</span>`}</td></tr>`), "f6-small f6-num");
}

/* ================================================================== 6K security */
const ZN = Object.fromEntries(SEC.zones);
function html6K() {
  return card("f66K", "6K · Security – firewall rule tester, rule audit, IEC 62443 risk table", "first match wins · default deny · conduits only between neighbour zones · risk = likelihood × consequence → SL-T per zone",
    intro(`<p>A firewall checks its rules <b>from top to bottom</b>; the <b>first rule that matches</b> decides (allow or deny). If nothing matches, the packet is dropped (<b>default deny</b>).
      So the <b>order</b> matters: a broad allow above a specific deny opens the door. A rule matches when every field (source zone, source host, destination zone, destination host, service) is equal or '*'.</p>
      <p class="phd-eq">risk = L (1–5) × C (1–5) · high ≥ 15 → SL-T 3 · medium 8–14 → SL-T 2 · low ≤ 7 → SL-T 1 · residual L = max(1, L − countermeasure points) · zone SL-T = max SL-T of its threats</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f6KRst">Reset rules and risks to the example</button></div>
    <h3 class="fe-h3">Rules <span class="sub">↑ ↓ change the order · change the action</span></h3><div id="f6KRules"></div>
    <h3 class="fe-h3">Flow test <span class="sub">the 17 example flows</span></h3><div id="f6KFlows"></div>
    <h4>Test your own flow</h4><div class="fe-row" id="f6KOwn"><label>Source host <input type="text" id="f6KSh" value="SCADA server" style="width:130px"></label><label>zone <select id="f6KSz">${SEC.zones.map(([z, n]) => `<option value="${z}"${z === "mfg" ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Destination host <input type="text" id="f6KDh" value="Cell controller" style="width:130px"></label><label>zone <select id="f6KDz">${SEC.zones.map(([z, n]) => `<option value="${z}"${z === "c1" ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
      <label>Service <input type="text" id="f6KSv" value="modbus-write" style="width:110px"></label></div><div id="f6KOwnR"></div>
    <h3 class="fe-h3">Rule audit</h3><div id="f6KAud"></div>
    <h3 class="fe-h3">IEC 62443 risk table <span class="sub">edit likelihood L, consequence C and the countermeasure points</span></h3><div id="f6KRisk"></div><div id="f6KZone"></div>
    <h3 class="fe-h3">The 7 foundational requirements (IEC 62443-3-3)</h3>
    ${tab(["FR", "Name", "Question", "FMS example"], FR7.map((r) => `<tr><td><b>${r[0]}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td class="sub">${esc(r[3])}</td></tr>`), "f6-small")}
    <p class="am-note"><b>Use case:</b> before the firewall goes to default deny, every flow of the conduit list is tested here; the audit finds the rule R04 (DMZ jump host directly into the cell – should end in the manufacturing zone) and R15 ('allow all' left after commissioning). The zone SL-T values go into the supplier requirements.</p>
    ${uses("K")}`);
}
function init6K() {
  $("f6KRules").addEventListener("click", (e) => { const b = e.target.closest("[data-mv]"); if (!b) return; const [i, d] = b.dataset.mv.split(":").map(Number), r = S.k.rules, jx = i + d; if (jx < 0 || jx >= r.length) return; [r[i], r[jx]] = [r[jx], r[i]]; save("k"); draw6K(); });
  $("f6KRules").addEventListener("change", (e) => { const t = e.target; if (t.dataset.act == null) return; S.k.rules[+t.dataset.act][6] = t.value; save("k"); draw6K(); });
  $("f6KRisk").addEventListener("change", (e) => { const t = e.target; if (!t.dataset.r) return; const [i, f, c] = t.dataset.r.split(":"), th = S.k.threats[+i], v = Math.max(f === "cm" ? 0 : 1, Math.min(5, Math.round(num(t.value, 1))));
    if (f === "L") th[2] = v; else if (f === "C") th[3] = v; else th[4][+c][1] = v; save("k"); draw6K(); });
  $("f6KOwn").addEventListener("input", drawOwn);
  $("f6KRst").addEventListener("click", () => { resetSec("k"); draw6K(); });
  draw6K();
}
function drawOwn() { const f = [$("f6KSh").value.trim(), $("f6KSz").value, $("f6KDh").value.trim(), $("f6KDz").value, $("f6KSv").value.trim()];
  const r = f[1] === f[3] ? { id: "–", action: "allow (same zone, not filtered)" } : fwCheck(S.k.rules, f);
  $("f6KOwnR").innerHTML = `<p class="fe-big ${r.action.startsWith("allow") ? "fe-ok" : "fe-no"}">${r.action.startsWith("allow") ? "✓" : "✗"} ${esc(r.action)} – rule <b>${esc(r.id)}</b></p>`; }
function draw6K() {
  const rules = S.k.rules;
  $("f6KRules").innerHTML = tab(["#", "Order", "Id", "Source zone", "Source host", "Dest. zone", "Dest. host", "Service", "Action", "Note"], rules.map((r, i) => `<tr><td>${i + 1}</td><td class="f6-nw"><button class="mx-el f6-mini" data-mv="${i}:-1" aria-label="move up">↑</button><button class="mx-el f6-mini" data-mv="${i}:1" aria-label="move down">↓</button></td><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${esc(r[2])}</td><td>${r[3]}</td><td>${esc(r[4])}</td><td><code>${esc(r[5])}</code></td>
    <td><select data-act="${i}" class="${r[6] === "allow" ? "f6-allow" : "f6-deny"}"><option${r[6] === "allow" ? " selected" : ""}>allow</option><option${r[6] === "deny" ? " selected" : ""}>deny</option></select></td><td class="sub">${esc(r[7])}</td></tr>`), "f6-small");
  $("f6KFlows").innerHTML = tab(["#", "Source", "Destination", "Service", "Verdict", "Rule"], SEC.flows.map((f, i) => { const v = fwCheck(rules, f); return `<tr><td>${i + 1}</td><td>${esc(f[0])} <span class="sub">${f[1]}</span></td><td>${esc(f[2])} <span class="sub">${f[3]}</span></td><td><code>${esc(f[4])}</code></td><td>${v.action === "allow" ? '<span class="fe-ok">✓ allow</span>' : '<span class="fe-no">✗ deny</span>'}</td><td><b>${v.id}</b></td></tr>`; }), "f6-small");
  const au = fwAudit(rules, SEC.neighbours);
  $("f6KAud").innerHTML = au.length ? tab(["Rule", "Finding", "Detail"], au.map((a) => `<tr><td><b>${a.id}</b></td><td class="fe-no">${a.finding}</td><td>${esc(a.detail)}</td></tr>`)) : `<p class="fe-ok">✓ no findings</p>`;
  const rt = riskTable(S.k.threats), cl = (c) => (c === "high" ? "fe-no" : c === "medium" ? "f6-warn" : "fe-ok");
  $("f6KRisk").innerHTML = tab(["Threat", "Zone", "L", "C", "Risk", "Class", "SL-T", "Countermeasures (points)", "Residual L", "Residual risk"], rt.rows.map((r, i) => `<tr><td>${esc(r.threat)}</td><td>${r.zone}</td>
    <td><input type="number" class="f6-n1" min="1" max="5" step="1" value="${r.L}" data-r="${i}:L"></td><td><input type="number" class="f6-n1" min="1" max="5" step="1" value="${r.C}" data-r="${i}:C"></td><td><b>${r.risk}</b></td><td class="${cl(r.cls)}">${r.cls}</td><td><b>SL ${r.slt}</b></td>
    <td>${S.k.threats[i][4].map((c, ci) => `<div class="f6-cm">${esc(c[0])} <input type="number" class="f6-n1" min="0" max="5" step="1" value="${c[1]}" data-r="${i}:cm:${ci}"></div>`).join("")}</td><td>${r.resL}</td><td><b>${r.residual}</b> <span class="${cl(r.resCls)}">${r.resCls}</span></td></tr>`), "f6-small");
  $("f6KZone").innerHTML = `<h4>Target security level per zone</h4>` + tab(["Zone", "Name", "SL-T"], SEC.zones.map(([z, n]) => `<tr><td>${z}</td><td>${esc(n)}</td><td>${rt.zone[z] ? "<b>SL " + rt.zone[z] + "</b>" : '<span class="sub">no threat listed</span>'}</td></tr>`), "f6-small");
  drawOwn();
}

/* ================================================================== 6L protocol deep cards */
function html6L() {
  return card("f66L", "6L · Protocol deep cards – how it works, parameters, design rules, faults, use in an FMS", "9 protocols · typical values – confirm with the device manuals",
    intro(`<p>Each card answers the five questions an engineer has when a protocol appears in a specification: <b>how does it work</b>, which <b>parameters</b> matter, which <b>design rules</b> keep it reliable, which <b>faults</b> are typical, and <b>where</b> it belongs in an FMS.</p>`) +
    `<div class="mx-nav" id="f6LNav">${PCARDS.map((p, i) => `<button class="mx-el${i ? "" : " active"}" data-l="${i}">${esc(p.name.split(" (")[0])}</button>`).join("")}</div><div id="f6LCard"></div>
    <p class="am-note"><b>Use case:</b> copy the design rules into the network chapter of the FMS specification (one sub-chapter per protocol used) and the typical faults into the service manual.</p>
    ${uses("L")}`);
}
function init6L() { const show = (i) => { const p = PCARDS[i]; document.querySelectorAll("#f6LNav [data-l]").forEach((b) => b.classList.toggle("active", +b.dataset.l === i));
    $("f6LCard").innerHTML = `<h3 class="fe-h3">${esc(p.name)}</h3><p>${esc(p.how)}</p><div class="grid2"><div><h4>Key parameters</h4>${kv(p.params.map(([a, b]) => [esc(a), esc(b)]))}</div>
      <div><h4>Design rules</h4>${ul(p.rules.map(esc))}<h4>Typical faults</h4>${ul(p.faults.map(esc))}</div></div><p class="am-note"><b>When to use it in an FMS:</b> ${esc(p.when)}</p>`; };
  $("f6LNav").addEventListener("click", (e) => { const b = e.target.closest("[data-l]"); if (b) show(+b.dataset.l); }); show(0); }

/* ================================================================== 6M commissioning & troubleshooting */
function html6M() {
  return card("f66M", "6M · Commissioning & troubleshooting – checklist, decision trees, Wireshark filters", "tick the FAT / SAT checklist (saved in this browser) · step-by-step fault finding · physical layer first",
    intro(`<p>Interfaces fail at commissioning for a few reasons only: cable and port, address and name, wrong numbering or word order, missing firewall rule, timeouts that are too tight. A <b>fixed order of checks</b> – from the physical layer up to the application – finds the cause fastest.</p>
      <p class="phd-eq">layer 1 link LED / port counters → layer 2 VLAN / MAC → layer 3 ping / IP → layer 4 TCP port → application request / exception → data meaning (numbering, word order, scale)</p>`) +
    `<h3 class="fe-h3">Interface FAT / SAT checklist <span class="sub" id="f6MProg"></span></h3><div class="fe-row"><button class="mx-el" id="f6MClr">Clear all ticks</button></div><div id="f6MChk" class="f6-chk"></div>
    <h3 class="fe-h3">Troubleshooting decision trees</h3><div class="mx-nav" id="f6MTN">${Object.entries(TREES).map(([k, t], i) => `<button class="mx-el${i ? "" : " active"}" data-t="${k}">${esc(t.name)}</button>`).join("")}</div><div id="f6MTree" class="f6-detail"></div>
    <h3 class="fe-h3">Wireshark display filters</h3>${tab(["Filter", "Shows"], WSF.map(([f, m]) => `<tr><td><code>${esc(f)}</code></td><td>${esc(m)}</td></tr>`), "f6-small")}
    <p class="am-note"><b>Use case:</b> connect a laptop with Wireshark to a mirror port of the cell switch; filter <code>mbtcp &amp;&amp; ip.addr == 10.1.101.150</code> and compare the FC03 response with the expected frame from 6H.</p>
    ${uses("M")}`);
}
const MT = { tree: "none", node: "a", path: [] };
function init6M() {
  const chk = () => store.get("chk", {});
  const drawChk = () => { const c = chk(); let n = 0, d = 0;
    $("f6MChk").innerHTML = CHECK6.map(([g, items], gi) => `<div class="f6-chkg"><h4>${esc(g)}</h4>${items.map((it, ii) => { const key = gi + "." + ii; n++; if (c[key]) d++; return `<label class="f6-ci"><input type="checkbox" data-c="${key}"${c[key] ? " checked" : ""}> ${esc(it)}</label>`; }).join("")}</div>`).join("");
    $("f6MProg").innerHTML = `${d} / ${n} done`; };
  $("f6MChk").addEventListener("change", (e) => { const t = e.target; if (!t.dataset.c) return; const c = chk(); if (t.checked) c[t.dataset.c] = 1; else delete c[t.dataset.c]; store.set("chk", c); drawChk(); });
  $("f6MClr").addEventListener("click", () => { store.del("chk"); drawChk(); });
  drawChk();
  const drawTree = () => { const T = TREES[MT.tree], nd = T.nodes[MT.node];
    $("f6MTree").innerHTML = (MT.path.length ? `<ol class="f6-path">${MT.path.map(([q, a]) => `<li>${esc(q)} <b>${a}</b></li>`).join("")}</ol>` : "") +
      (nd.fix ? `<p class="am-note"><b>Cause / action:</b> ${esc(nd.fix)}</p><button class="mx-el" data-a="r">Start again</button>` :
        `<p class="fe-big">Step ${MT.path.length + 1}: ${esc(nd.q)}</p><div class="fe-row"><button class="mx-el" data-a="y">Yes</button><button class="mx-el" data-a="n">No</button>${MT.path.length ? '<button class="mx-el" data-a="b">◀ Back</button>' : ""}</div>`); };
  $("f6MTree").addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (!b) return; const T = TREES[MT.tree], a = b.dataset.a;
    if (a === "r") { MT.node = T.start; MT.path = []; }
    else if (a === "b") { const p = MT.path.pop(); MT.node = p[2]; }
    else { const nd = T.nodes[MT.node]; MT.path.push([nd.q, a === "y" ? "Yes" : "No", MT.node]); MT.node = a === "y" ? nd.y : nd.n; }
    drawTree(); });
  $("f6MTN").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; MT.tree = b.dataset.t; MT.node = TREES[MT.tree].start; MT.path = []; document.querySelectorAll("#f6MTN [data-t]").forEach((x) => x.classList.toggle("active", x === b)); drawTree(); });
  drawTree();
}

/* ================================================================== 6N cases */
function caseNums(c) {
  const out = [];
  if (c.calc.pn) { const r = CALC.pn.run(c.calc.pn); out.push(["PROFINET cyclic load (" + c.calc.pn.dev + " devices, " + c.calc.pn.io + " bytes, " + c.calc.pn.cyc + " ms)", fx(r[3][1], 1) + " %"]); }
  if (c.id === "c1") { const l = latency(EX6.net_calc.latency); out.push(["Latency through a line of 10 devices (base / worst)", `${fx(l.base, 1)} µs / ${fx(l.worst, 1)} µs`]); out.push(["IP addresses in the cell (6J, FMS kit)", ipPlan(EX6.ip_plan.kit, EX6.ip_plan.site, EX6.ip_plan.cell, EX6.ip_plan.vlan).length]); }
  if (c.calc.ua) { const u = opcua(c.calc.ua); out.push(["OPC UA subscription load (" + c.calc.ua.items + " items)", fx(u.kbit, 1) + " kbit/s"]); }
  if (c.calc.mb) { const r = CALC.mb.run(c.calc.mb); out.push(["Modbus poll cycle (" + c.calc.mb.dev + " modules, " + c.calc.mb.regs + " registers, " + c.calc.mb.conn + " connections)", fx(r[2][1], 0) + " ms"]); }
  if (c.calc.hs) { const a = hsSim(HS, HS.scenarios[0]).KPI.completed; out.push(["Handshake overhead per job at 100 ms poll (6I, scenario A)", `${a[0][1] - HS.scenarios[0].exec_ticks} ticks = ${fx((a[0][1] - HS.scenarios[0].exec_ticks) * HS.tick_ms / 1000, 1)} s (job of ${HS.scenarios[0].exec_ticks * HS.tick_ms / 1000} s)`]);
    const b = hsSim(HS, HS.scenarios[1]).KPI; out.push(["Cable pulled 6 s → loss detected after", b.detectDelay + " ticks = " + fx(b.detectDelay * HS.tick_ms / 1000, 1) + " s"]); }
  if (c.calc.mq) { const m = mqtt(c.calc.mq); out.push(["MQTT load at the broker (" + c.calc.mq.edges + " edges, " + c.calc.mq.subscribers + " subscribers)", fx(m.kbit, 2) + " kbit/s"]); }
  if (c.id === "c3") out.push(["Interface sheet rows (assembly kit)", ifSheet("Assembly line (8 stations)", { site: NM.site, area: NM.area, cell: "ASM1", group: "ASM1", edge: "LC1", base: 0 }).length]);
  return out;
}
function html6N() {
  return card("f66N", "6N · Cases – three FMS communication architectures", "protocol per link · network plan · key numbers from the calculators above",
    intro(`<p>The same module standard (data block words 0–19) works on every protocol – what changes between plants is <b>which protocol carries it</b> on which link. Three typical plants:</p>`) +
    `<div class="mx-nav" id="f6NNav">${CASES6.map((c, i) => `<button class="mx-el${i ? "" : " active"}" data-n="${i}">${esc(c.name.split(" · ")[1])}</button>`).join("")}</div><div id="f6NCase"></div>
    ${uses("N")}`);
}
function init6N() { const show = (i) => { const c = CASES6[i]; document.querySelectorAll("#f6NNav [data-n]").forEach((b) => b.classList.toggle("active", +b.dataset.n === i));
    $("f6NCase").innerHTML = `<h3 class="fe-h3">${esc(c.name)}</h3><p>${esc(c.intro)}</p>${tab(["Link", "Protocol", "Why"], c.links.map(([a, b, w]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="sub">${esc(w)}</td></tr>`))}
      <div class="grid2"><div><h4>Network plan</h4>${kv(c.net.map(([a, b]) => [esc(a), esc(b)]))}</div><div><h4>Key numbers</h4>${kv(caseNums(c).map(([a, b]) => [esc(a), `<b>${esc(b)}</b>`]))}</div></div>`; };
  $("f6NNav").addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (b) show(+b.dataset.n); }); show(0); }

/* ================================================================== results for tests / cross-checks (JSON defaults only) */
function results() {
  const lat = latency(NC.latency), io = iolink(NC.iolink), ua = opcua(NC.opcua), mq = mqtt(NC.mqtt), fi = fibre(NC.fibre);
  const sub = EX6.subnet.cidrs.map(subnet).map(({ _net, _mask, isNet, ...r }) => r);
  const srv = encode(DB.module, DB.values, DB.base); srv.unit = DB.unit_id;
  const fc03 = mbFrame({ tid: 1, fc: 3, start: DB.base, qty: 20 }, srv);
  const frames = DB.frames.map((f) => mbFrame(f, srv));
  const wo = { DINT: wordOrder(DB.word_order_demo.DINT, "DINT").map((r) => ({ order: r.order, bytes: r.bytes, readAsABCD: r.readAsABCD })), REAL: wordOrder(DB.word_order_demo.REAL, "REAL").map((r) => ({ order: r.order, bytes: r.bytes, readAsABCD: r.readAsABCD })) };
  const hs = {}; HS.scenarios.forEach((s) => { const r = hsSim(HS, s); hs[s.name[0]] = { ...r.KPI, log: r.log }; });
  const sheet = ifSheet(EX6.ip_plan.kit, { site: NM.site, area: NM.area, cell: NM.cell, group: NM.sparkplug_group, edge: NM.sparkplug_edge, base: DB.base });
  const longest = sheet.reduce((a, r) => (r.len > a.len ? r : a), { len: 0, tag: "" });
  const ip = ipPlan(EX6.ip_plan.kit, EX6.ip_plan.site, EX6.ip_plan.cell, EX6.ip_plan.vlan);
  const rt = riskTable(SEC.threats);
  return {
    latency: { t_tx_us: rnd(lat.ttx), base_us: rnd(lat.base), worst_us: rnd(lat.worst) },
    iolink: io.map((r) => ({ com: r.com, bits: r.bits, tmsg_ms: rnd(r.tmsg_ms), cycle_ms: rnd(r.cycle_ms) })),
    opcua: { notif_s: rnd(ua.notif), msgs_s: rnd(ua.msgs), Bps: rnd(ua.Bps), kbit_s: rnd(ua.kbit) },
    mqtt: { msg_bytes: mq.msg_bytes, in_Bps: rnd(mq.in_Bps), out_Bps: rnd(mq.out_Bps), kbit_s: rnd(mq.kbit) },
    fibre: { loss_db: rnd(fi.loss), budget_db: rnd(fi.budget), margin_db: rnd(fi.margin), ok: fi.ok },
    subnets: sub, overlaps: overlaps(EX6.subnet.plan), duplicates: duplicates(EX6.subnet.devices),
    registers: srv.regs, registersHex: srv.regs.map(hex4).join(" "), fc03: { request: fc03.request, response: fc03.response },
    frames: frames.map((f) => ({ name: f.name, request: f.request, response: f.response, exception: f.exception })),
    wordOrder: wo,
    handshake: hs,
    sheet: { kit: EX6.ip_plan.kit, rows: sheet.length, units: [...new Set(sheet.map((r) => r.unit))].length, longestTag: longest.tag, longestLen: longest.len, over48: sheet.filter((r) => !r.tagOk).length },
    ipPlan: { rows: ip.length, pnBad: ip.filter((r) => !r.pnOk).length, first: ip.slice(0, 3).map((r) => [r.tag, r.dev, r.ip, r.pn]) },
    firewall: SEC.flows.map((f, i) => ({ flow: i + 1, verdict: fwCheck(SEC.rules, f).action, rule: fwCheck(SEC.rules, f).id })),
    audit: fwAudit(SEC.rules, SEC.neighbours).map((a) => [a.id, a.finding]),
    risk: rt.rows.map((r) => ({ threat: r.threat, zone: r.zone, risk: r.risk, cls: r.cls, slt: r.slt, resL: r.resL, residual: r.residual, resCls: r.resCls })), zoneSLT: rt.zone,
    errors: R.errors || [],
  };
}
