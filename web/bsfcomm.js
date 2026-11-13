/* Ball screw + guide factory – item 4 "Communication – only Ethernet + Modbus TCP + HTTP" (#bfItem4).  Guide: docs/43_bsf_communication_modbus_http.md
 * Files: bsfcomm.js (UI, live flow, device table, tools, self-check) · bsfcomm_map.js (register map, IP plan, frame codec, load calculator,
 *   browser demo server) · bsfcomm_data.js (texts, HTTP examples, comparison, faults, CARD4) · bsfcomm.css ·
 *   server side: twin/bsf_comm.py (gateway + HTTP), twin/bsf_comm_modbus.py (Modbus TCP server + client), twin/bsf_comm_map.py (map),
 *   twin/bsf_comm_api.py (MES / ERP / AGV / printer demo APIs), tools/bsf_modbus_sim.py, tools/bsf_gateway.py.
 * Lazy: built on window event "bfitemshow" (detail "4"). Nothing starts on the server until the user presses "Start Modbus sim + gateway"
 *   (POST /api/bsf/control). Without the backend the page runs in a browser-only demo mode (same codec, same register image).
 * URL: /?bfitem=4#bsf · &bf4card=net|flow|dev|map|cmd|calc|fault|api|cmp (scroll) · &bf4start (start the backend) · &bf4port=1502 (simulator port) ·
 *   &bf4demo (force browser demo) · &bf4type=BS-TGR · &bf4test (self-check, console "BF4TEST …" + #bf4Debug) · &bf4hold (headless: keep load pending,
 *   show the tab) · card: &bf4tab=draw|buy|shop · &bf4box=N.
 * Offline. ALL VALUES ARE EXAMPLES – check with your network designer.
 */
import { MTYPES } from "./bsfmfg_data.js";
import { getBSF, STATES } from "./bsfsim.js";
import { MAPV, MAP_SIZE, GW_HB_ADDR, MAP_HISTORY, mapVersionText, VLANS, SERVERS, NETM, NET_BY_ID, NET_BY_UNIT, TYPE_IDS, TYPE_MAPS, pollGroups, countersLen, decodeBlock, decodeValue, encodeValue,
  realToRegs, regsToReal, asciiToRegs, reqRead, reqWrite1, reqWriteN, reqCoil, adu, decodeFrame, hex, parseHex, loadCalc, avgCounters, demoServe, regImage,
  CMD_CODES, RESULTS, EXC_NAMES, wireBytes } from "./bsfcomm_map.js";
import { NOTE4, RULE4, API_EX, CMP, FAULTS, CARD4 } from "./bsfcomm_data.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const sp = (s) => String(s).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const f0 = (v) => sp(Math.round(v)), f1 = (v) => (+v).toFixed(1), f2 = (v) => (+v).toFixed(2);
const host = $("bfItem4");
const errs = [];
if (Q.has("bf4test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf4hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf4hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("4"); }, 300); }

const visible = () => host && !host.hidden && (!window.bfCtl || window.bfCtl.tabVisible());
const tbl = (cols, rows, cls = "") => `<div class="table-wrap"><table class="bf4-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
const AREA_N = { soft: "soft machining", ht: "heat treatment", grind: "grinding room", qc: "metrology", assy: "assembly" };
const STC = { online: "#27ae60", timeout: "#d03b3b", offline: "#d03b3b", exception: "#e67e22", stale: "#f2c94c", unknown: "#a9aeb4", demo: "#2a78d6" };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let built = false, B = null, uiT = null, es = null, live = null, be = { reachable: false, running: false, ctl: null }, lastSnapPost = 0, demoFaults = {}, demo = null;
const simPort = +(Q.get("bf4port") || 1502);

async function api(method, path, body, headers = {}) {
  const t0 = performance.now();
  const r = await fetch(path, { method, headers: body != null ? { "Content-Type": "application/json", ...headers } : headers, body: body != null ? JSON.stringify(body) : undefined, cache: "no-store" });
  const ct = r.headers.get("Content-Type") || ""; const txt = await r.text();
  let data = txt; try { if (ct.includes("json")) data = JSON.parse(txt); } catch (e) { /* text */ }
  return { status: r.status, ok: r.ok, data, ct, ms: performance.now() - t0 };
}

/* ------------------------------------------------------------------ browser demo engine (no backend) */
function makeDemo() {
  const D = { tid: 0, frames: [], fseq: 0, hb: 0, t0: performance.now(), stats: { req: 0, ok: 0, timeout: 0, exception: 0, tx: 0, rx: 0 }, hs: {}, ev: [], eseq: 0, last: {}, rr: 0, values: {}, tOk: {} };
  D.hsOf = (id) => D.hs[id] || (D.hs[id] = { ctl: 0, ack: 0, seq: 0, ackSeq: 0, result: 0, busy: false, done: 0, lotDone: 0, qty: 0, cmd: new Array(26).fill(0), order: "" });
  D.gwhb = {};   // map V1.1: last value the demo gateway wrote into register 226 per machine (FC06 every tick)
  D.image = (id) => { const m = B.byId[id]; B.signals(m); const h = D.hsOf(id); const R = regImage(m, { gwhb: D.gwhb[id] || 0, hb: D.hb, hs: (h.ack & 1) | (h.busy ? 2 : 0) | (h.done & 1 ? 4 : 0) | (h.result ? 8 : 0) | (!h.busy && m.state !== "DOWN" ? 16 : 0), ackSeq: h.ackSeq, result: h.result, lotDone: h.lotDone, cmd: h.cmd });
    if (h.order) asciiToRegs(h.order).forEach((w, i) => { R[26 + i] = w; });
    return R; };
  D.tx = (req) => { D.stats.req++; D.stats.tx += req.length; const resp = demoServe(req, D.image, demoFaults); if (!resp) { D.stats.timeout++; return null; } D.stats.rx += resp.length; if (resp[7] & 0x80) D.stats.exception++; else D.stats.ok++; return resp; };
  D.poll = (nm, g, st, q) => {
    D.tid = (D.tid + 1) & 0xffff; const req = reqRead(D.tid, nm.unit, st, q); const resp = D.tx(req); const rtt = 0.8 + Math.random() * 1.6;
    const e = { seq: ++D.fseq, t: Date.now() / 1000, id: nm.id, unit: nm.unit, group: g, kind: resp ? (resp[7] & 0x80 ? "exception" : "ok") : "timeout", req: hex(req), resp: resp ? hex(resp) : "", rttMs: resp ? +rtt.toFixed(2) : 0, text: "" };
    if (resp && !(resp[7] & 0x80)) { const d = decodeFrame(resp, "resp", nm.type, st); const old = D.values[nm.id] || {}; const first = !(D.tOk[nm.id] && D.tOk[nm.id][g]);
      for (const k in d.values) if (!first && old[k] !== undefined && old[k] !== d.values[k] && k !== "hdr.heartbeat" && !(typeof d.values[k] === "number" && Math.abs(d.values[k] - old[k]) <= Math.max(0.2, Math.abs(old[k]) * 0.01))) { D.ev.push({ seq: ++D.eseq, t: Date.now() / 1000, id: nm.id, name: k, old: old[k], new: d.values[k] }); }
      D.values[nm.id] = { ...old, ...d.values }; (D.tOk[nm.id] = D.tOk[nm.id] || {})[g] = Date.now(); e.text = `FC03 ${g} ${resp.length - 9} B data`; e.values = Object.fromEntries(Object.entries(d.values).filter(([k]) => ["std.status", "std.stateCode", "std.alarm", "std.good", "hs.status", "hdr.heartbeat"].includes(k)));
    } else if (resp) e.text = decodeFrame(resp, "resp").text; else e.text = "no answer within 300 ms (browser demo)";
    D.frames.push(e); if (D.frames.length > 400) D.frames.shift(); if (D.ev.length > 600) D.ev.splice(0, 200);
  };
  D.hbWrite = (nm) => {   // map V1.1: FC06 write of the gateway heartbeat 226 (+1 per write) – the PLC watchdog
    const v = ((D.gwhb[nm.id] || 0) + 1) & 0xffff; D.tid = (D.tid + 1) & 0xffff; const req = reqWrite1(D.tid, nm.unit, GW_HB_ADDR, v); const resp = D.tx(req);
    const okk = resp && !(resp[7] & 0x80); if (okk) { D.gwhb[nm.id] = v; (D.values[nm.id] = D.values[nm.id] || {})["cmd.gwHeartbeat"] = v; D.stats.hbWrites = (D.stats.hbWrites || 0) + 1; }
    D.frames.push({ seq: ++D.fseq, t: Date.now() / 1000, id: nm.id, unit: nm.unit, group: "gwhb", kind: resp ? (resp[7] & 0x80 ? "exception" : "ok") : "timeout", req: hex(req), resp: resp ? hex(resp) : "", rttMs: resp ? +(0.8 + Math.random() * 1.6).toFixed(2) : 0,
      text: okk ? `FC06 gateway heartbeat ${GW_HB_ADDR} = ${v} (echo)` : resp ? decodeFrame(resp, "resp").text : "no answer within 300 ms (browser demo)" });
    if (D.frames.length > 400) D.frames.shift();
  };
  D.tick = () => {   // 1 s: every machine fast + counters + gateway heartbeat write (V1.1), energy every 10th tick (the same plan as the gateway, 0.5 s fast shown as 1 s here)
    D.hb = (D.hb + 1) & 0xffff;
    for (const nm of NETM) { const G = pollGroups(nm.type); D.poll(nm, "fast", 0, 12); D.poll(nm, "counters", G[1][1], G[1][2]); if ((D.rr + nm.unit) % 10 === 0) D.poll(nm, "energy", 100, 4); D.hbWrite(nm); }
    D.rr++;
    for (const id in D.hs) { const h = D.hs[id]; if (h.busy) { h.lotDone++; if (h.lotDone >= h.qty) { h.busy = false; h.done++; } } }
  };
  D.payload = () => {
    const now = Date.now(), lim = 3 * 1000 + 300 * 2;
    const machines = NETM.map((nm) => { const v = D.values[nm.id] || {}, t = D.tOk[nm.id] && D.tOk[nm.id].fast, age = t ? now - t : null, f = demoFaults[nm.id];
      const st = demoFaults.netloss || f === "offline" || f === "slow" ? "timeout" : f === "exc04" ? "exception" : "online";
      return { id: nm.id, type: nm.type, unit: nm.unit, ip: nm.ip, host: nm.host, vlan: nm.vlan, status: st === "online" && (age == null || age > lim) ? "stale" : st, rttMs: st === "online" ? +(0.8 + Math.random()).toFixed(2) : 0,
        quality: { ageMs: age, stale: age == null || age > lim }, main: { "std.status": v["std.status"], "std.stateCode": v["std.stateCode"], "std.alarm": v["std.alarm"], "std.good": v["std.good"], "std.scrap": v["std.scrap"], "std.order": v["std.order"], "std.power_kW": v["std.power_kW"] } }; });
    const S = D.stats, el = (performance.now() - D.t0) / 1000;
    return { running: true, demo: true, t: now / 1000, status: { online: machines.filter((m) => m.status === "online").length, n: 73, totals: { ...S }, rate: { reqPerS: +(S.req / el).toFixed(1), bytesPerS: Math.round((S.tx + S.rx) / el), rttAvgMs: 1.6 } },
      machines, frames: D.frames.slice(-12), events: D.ev.slice(-60) };
  };
  return D;
}

/* ------------------------------------------------------------------ build */
function build() {
  if (built || !host) return; built = true;
  B = getBSF();
  const tid0 = TYPE_IDS.includes(Q.get("bf4type")) ? Q.get("bf4type") : "BS-TGR";
  host.innerHTML = `
  <div class="bf4-wrap">
    <div class="bf4-rule" id="bf4Rule"><b>Rule of this plant:</b> ${esc(RULE4)}</div>
    <div class="card" id="bf4Net">
      <div class="card-head"><h2>1 · Network architecture + IP plan</h2><span class="bf4-sub">site block 10.60.0.0/16 · VLAN 6xx ↔ subnet 10.60.xx.0/24 · ${NETM.length} machines</span></div>
      <div class="bf4-netgrid">
        <a class="bf4-fig" href="img/43_network_architecture.svg" target="_blank" rel="noopener"><img src="img/43_network_architecture.svg" alt="Network architecture: levels, VLANs, firewall, gateway, cell switches" width="1200" height="830"></a>
        <div>
          <h3 class="bf4-h">VLANs (one subnet per zone)</h3>
          ${tbl(["VLAN", "Name", "Subnet", "Level", "Use", "Machines"], VLANS.map((v) => [v.vlan, esc(v.name), `<code>${v.subnet}</code>`, v.level, esc(v.use), v.area ? NETM.filter((m) => m.area === v.area).length : "–"]), "bf4-small")}
          <h3 class="bf4-h">Servers + central devices</h3>
          ${tbl(["Host name", "IP", "VLAN", "Role"], SERVERS.map((s) => [`<code>${esc(s[0])}</code>`, `<code>${s[1]}</code>`, s[2], esc(s[3])]), "bf4-small")}
          <p class="hint">Host numbers in a cell: <b>.1</b> firewall / router, <b>.2 – .9</b> switches, <b>.11 – .99</b> machines (order of the machine list), <b>.100</b> HMIs, <b>.150</b> I/O couplers + energy meters, <b>.240</b> service laptops. Host name <code>vc-bsf-&lt;area&gt;-&lt;machine id&gt;</code>, e.g. <code>vc-bsf-grd-bstgr03</code> = 10.60.43.16, unit id 15. No DHCP in the cells.
            Download: <a href="/api/bsf/map.csv" download>register map + IP list (CSV)</a> · <a href="/api/bsf/map" target="_blank" rel="noopener">JSON</a>.</p>
        </div>
      </div>
    </div>

    <div class="card" id="bf4Flow">
      <div class="card-head"><h2>2 · Live data flow – twin → Modbus TCP → gateway → HTTP → MES / ERP / page</h2>
        <span class="bf4-ctl"><span class="bf4-badge" id="bf4Mode">…</span>
          <label class="bf4-lbl">simulator port <input type="number" id="bf4Port" min="1024" max="65535" value="${simPort}" style="width:82px" aria-label="Modbus simulator TCP port"></label>
          <button class="btn primary" type="button" id="bf4Start">Start Modbus sim + gateway</button><button class="btn" type="button" id="bf4Stop">Stop</button></span></div>
      <div class="bf4-flowbox"><svg id="bf4Anim" class="bf4-anim" viewBox="0 0 1180 300" role="img" aria-label="data flow animation"></svg></div>
      <div class="bf4-kpis" id="bf4Kpi"></div>
      <h3 class="bf4-h">Last Modbus TCP frames (real bytes – request and response)</h3>
      <div id="bf4Frames"></div>
      <h3 class="bf4-h">Report-by-exception – the newest value changes (dead-band per unit), pushed to this page by Server-Sent Events</h3>
      <div id="bf4Events" class="bf4-log"></div>
      <p class="hint" id="bf4FlowHint">The gateway polls every machine: fast block (12 registers) every 500 ms, counters + process every 1 s, energy every 10 s. The page receives one SSE message per second
        (<code>GET /api/bsf/stream</code>). The browser twin posts its snapshot every second (<code>POST /api/bsf/snapshot</code>) – the Modbus simulator serves these values, so the registers show the same factory as item 3.</p>
    </div>

    <div class="card" id="bf4Dev">
      <div class="card-head"><h2>3 · Devices – 73 machines (IP, unit id, status, round-trip, data age)</h2>
        <span class="bf4-ctl"><label class="bf4-lbl">area <select id="bf4Area" aria-label="area filter"><option value="">all</option>${Object.entries(AREA_N).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select></label>
          <label class="bf4-lbl">status <select id="bf4St" aria-label="status filter"><option value="">all</option><option value="online">online</option><option value="bad">not online</option></select></label><span class="bf4-sub" id="bf4DevSum"></span></span></div>
      <div class="bf4-devgrid"><div id="bf4DevTbl" class="bf4-devtbl"></div><div id="bf4DevInfo" class="bf4-info"><p class="bf4-mut">Click a machine for all decoded values.</p></div></div>
    </div>

    <div class="card" id="bf4Map">
      <div class="card-head"><h2>4 · Register maps + frame decoder + frame builder</h2>
        <span class="bf4-ctl"><label class="bf4-lbl">machine type <select id="bf4Type" aria-label="machine type">${TYPE_IDS.map((t) => `<option value="${t}"${t === tid0 ? " selected" : ""}>${t} – ${esc(MTYPES[t].n.slice(0, 48))}${NETM.some((m) => m.type === t) ? "" : " (0 in plan)"}</option>`).join("")}</select></label>
          <label class="bf4-lbl">live values of <select id="bf4MapM" aria-label="machine"></select></label></span></div>
      <div id="bf4MapSum" class="bf4-sub2"></div>
      <div id="bf4MapTbl" class="bf4-maptbl"></div>
      <div class="bf4-tools">
        <div class="bf4-tool"><h3 class="bf4-h">Decode this frame (paste hex)</h3>
          <textarea id="bf4Hex" rows="3" spellcheck="false" aria-label="frame hex">00 01 00 00 00 06 0F 03 00 00 00 0C</textarea>
          <div class="bf4-bar"><label class="bf4-lbl">direction <select id="bf4Dir"><option value="auto">auto</option><option value="req">request</option><option value="resp">response</option></select></label>
            <label class="bf4-lbl">response of a read from <input type="number" id="bf4DStart" value="0" min="0" max="225" style="width:64px" aria-label="start address of the request"></label>
            <label class="bf4-lbl">word order <select id="bf4DOrd"><option>ABCD</option><option>CDAB</option></select></label>
            <button class="btn" type="button" id="bf4Dec">Decode</button></div>
          <div class="bf4-bar bf4-ex">examples: <button class="btn" type="button" data-bf4ex="req">FC03 request</button><button class="btn" type="button" data-bf4ex="resp">FC03 response (live)</button><button class="btn" type="button" data-bf4ex="exc">exception 02</button><button class="btn" type="button" data-bf4ex="fc16">FC16 command</button><button class="btn" type="button" data-bf4ex="bad">wrong length</button></div>
          <div id="bf4DecOut" class="bf4-out"></div></div>
        <div class="bf4-tool"><h3 class="bf4-h">Frame builder (FC 03 / 04 / 06 / 16 / 01 / 05 → hex)</h3>
          <div class="bf4-bar"><label class="bf4-lbl">FC <select id="bf4BFc"><option value="3">03 read holding</option><option value="4">04 read input</option><option value="6">06 write single</option><option value="16">16 write multiple</option><option value="1">01 read coils</option><option value="5">05 write coil</option></select></label>
            <label class="bf4-lbl">unit <input type="number" id="bf4BUnit" value="15" min="0" max="255" style="width:58px"></label>
            <label class="bf4-lbl">start / addr <input type="number" id="bf4BStart" value="0" min="0" max="65535" style="width:70px"></label>
            <label class="bf4-lbl">qty <input type="number" id="bf4BQty" value="12" min="1" max="2000" style="width:62px"></label>
            <label class="bf4-lbl">tid <input type="number" id="bf4BTid" value="1" min="0" max="65535" style="width:64px"></label></div>
          <div class="bf4-bar"><label class="bf4-lbl">values (FC06 / FC16, comma) <input type="text" id="bf4BVals" value="1, 7, 0" style="width:180px" aria-label="register values"></label>
            <button class="btn" type="button" id="bf4BBuild">Build</button><button class="btn" type="button" id="bf4BSend">Send to simulator</button><button class="btn" type="button" id="bf4BToDec">→ decoder</button></div>
          <div id="bf4BOut" class="bf4-out"></div>
          <h3 class="bf4-h">REAL ↔ registers (word order)</h3>
          <div class="bf4-bar"><label class="bf4-lbl">value <input type="number" id="bf4RV" value="570.8" step="any" style="width:100px"></label><span id="bf4RVOut" class="bf4-mono"></span></div>
          <div class="bf4-bar"><label class="bf4-lbl">registers <input type="text" id="bf4RR" value="440E B333" style="width:110px" aria-label="two registers hex"></label><span id="bf4RROut" class="bf4-mono"></span></div></div>
      </div>
    </div>

    <div class="card" id="bf4Cmd">
      <div class="card-head"><h2>5 · Command to a machine – MES order → FC16 write → toggle-bit handshake → ACK</h2><span class="bf4-sub">POST /api/bsf/command · idempotent with msgId</span></div>
      <div class="bf4-bar">
        <label class="bf4-lbl">machine <select id="bf4CM">${NETM.map((m) => `<option${m.id === "BS-TGR-03" ? " selected" : ""}>${m.id}</option>`).join("")}</select></label>
        <label class="bf4-lbl">command <select id="bf4CC">${Object.entries(CMD_CODES).map(([k, t]) => `<option value="${["", "order", "start", "stop", "ack", "recipe"][k]}">${k} ${t}</option>`).join("")}<option value="bad">9 unknown (→ result 1)</option></select></label>
        <label class="bf4-lbl">order <input type="text" id="bf4CO" value="WO-00001-L01" maxlength="20" style="width:120px"></label>
        <label class="bf4-lbl">part <input type="text" id="bf4CP" value="BS-3210-1000-C5" maxlength="20" style="width:130px"></label>
        <label class="bf4-lbl">qty <input type="number" id="bf4CQ" value="10" min="0" max="100000" style="width:70px"></label>
        <label class="bf4-lbl">recipe <input type="number" id="bf4CR" value="12" min="0" max="65535" style="width:64px"></label></div>
      <div class="bf4-bar"><label class="bf4-lbl">msgId <input type="text" id="bf4CId" style="width:290px" aria-label="message id"></label><button class="btn" type="button" id="bf4CNew">new msgId</button>
        <button class="btn primary" type="button" id="bf4CSend">Send command</button><span class="bf4-mut">Same msgId again → the gateway returns the first answer ("replay"), it does not write twice.</span></div>
      <div id="bf4COut"></div><div id="bf4CWatch" class="bf4-sub2"></div>
    </div>

    <div class="card" id="bf4Calc">
      <div class="card-head"><h2>6 · Timing + load calculator</h2><span class="bf4-sub">polls/s, bytes/s, link load, worker load, worst-case data age</span></div>
      <div class="bf4-bar" id="bf4CalcIn">
        ${[["n", "devices", 73, 1, 500], ["fast_ms", "fast period ms", 500, 100, 5000], ["counters_ms", "counters ms", 1000, 200, 60000], ["energy_ms", "energy ms", 10000, 1000, 600000], ["gwhb_ms", "gw heartbeat write ms (0 = V1.0)", 1000, 0, 2000], ["rCnt", "counter regs (avg)", +avgCounters().toFixed(2), 1, 125],
          ["rtt_ms", "device RTT ms", 3, 0.1, 500], ["workers", "worker threads", 4, 1, 32], ["timeout_ms", "time-out ms", 300, 50, 5000], ["retries", "retries", 1, 0, 5], ["link_mbit", "link Mbit/s", 100, 10, 10000]]
          .map(([k, t, v, lo, hi]) => `<label class="bf4-lbl">${t} <input type="number" data-bf4c="${k}" value="${v}" min="${lo}" max="${hi}" step="any" style="width:76px"></label>`).join("")}</div>
      <div id="bf4CalcOut"></div>
    </div>

    <div class="card" id="bf4Fault">
      <div class="card-head"><h2>7 · Fault injection – what goes wrong and how it looks</h2>
        <span class="bf4-ctl"><label class="bf4-lbl">machine <select id="bf4FM">${NETM.map((m) => `<option${m.id === "BS-TGR-01" ? " selected" : ""}>${m.id}</option>`).join("")}</select></label><button class="btn" type="button" id="bf4FClear">Clear all faults</button></span></div>
      <div class="bf4-fbtn" id="bf4FBtns">${FAULTS.map((f) => `<button class="btn" type="button" data-bf4f="${f[0]}" title="${esc(f[2])}">${esc(f[1])}</button>`).join("")}</div>
      <div id="bf4FOut" class="bf4-out"></div>
      ${tbl(["Fault", "Injected as", "What you see", "What to do"], FAULTS.map((f) => [esc(f[1]), esc(f[2]), esc(f[3]), esc(f[4])]), "bf4-small")}
    </div>

    <div class="card" id="bf4Api">
      <div class="card-head"><h2>8 · HTTP APIs – gateway, MES, ERP, AGV fleet, label printer (REST + JSON)</h2><span class="bf4-sub">try it – real requests to this server</span></div>
      <div class="bf4-bar"><select id="bf4AEx" aria-label="example request">${API_EX.map((e, i) => `<option value="${i}">${esc(e[1])} ${esc(e[2])} – ${esc(e[0])}</option>`).join("")}</select>
        <button class="btn primary" type="button" id="bf4ASend">Send</button><button class="btn" type="button" id="bf4AAgain">Send again (same Idempotency-Key)</button></div>
      <div class="bf4-apigrid"><div><h3 class="bf4-h">Request</h3><pre id="bf4AReq" class="bf4-pre"></pre></div><div><h3 class="bf4-h">Response</h3><pre id="bf4AResp" class="bf4-pre"></pre></div></div>
      <h3 class="bf4-h">API catalogue</h3><div id="bf4ACat"></div>
      <p class="hint">Rules: JSON (RFC 8259), errors as problem+json (RFC 9457), <code>Idempotency-Key</code> header on every POST that creates something, paging <code>?page=&amp;size=</code>, version in the path (<code>/api/bsf/v1/…</code>), HTTPS + API key in the real plant (TLS is still HTTP – it is allowed by the rule).
        A label printer speaks ZPL over raw TCP 9100 – that is <b>not</b> HTTP, so the MES sends an HTTP job to the print server (<code>vc-bsf-ops-prt01</code>) or uses the printer's own HTTP interface (check the model).</p>
    </div>

    <div class="card" id="bf4Cmp">
      <div class="card-head"><h2>9 · Without MQTT and OPC UA – what you lose and how this plant compensates</h2></div>
      ${tbl(["Topic", "MQTT / OPC UA would give", "Here: Modbus TCP + HTTP", "Limit / cost"], CMP.map((r) => r.map(esc)), "bf4-small")}
      <h3 class="bf4-h">Honest exceptions (infrastructure, not application data)</h3>
      <ul class="bf4-ul"><li><b>Time sync:</b> NTP is UDP 123, not HTTP. Accept it as an infrastructure service from <code>vc-bsf-dmz-ntp01</code> (recommended), or set the gateway clock from the HTTP <code>Date</code> header of the MES (± 1 s, enough for OEE, not for sequence-of-events).</li>
        <li><b>DNS</b> (UDP / TCP 53) and <b>switch management</b> (HTTPS web UI is fine; SNMP / syslog are UDP) – decide with IT; Modbus devices are addressed by IP, so DNS is not needed in the cells.</li>
        <li><b>Safety</b> (emergency stop, guard doors, light curtains) is hard-wired to safety relays / F-PLCs. The Modbus status bit 4 "e-stop" is only a copy for display.</li>
        <li><b>Machine vendors</b> often offer OPC UA or MTConnect – switch it off or block it at the cell firewall; ask for Modbus TCP server with the register map of §8 (supplier questions in the guide).</li></ul>
      <p class="hint">${esc(NOTE4)}</p>
    </div>
    <div id="bf4Debug" class="bf4-debug" hidden></div>
  </div>`;

  // controls
  $("bf4Start").addEventListener("click", () => startBackend(+$("bf4Port").value || 1502));
  $("bf4Stop").addEventListener("click", stopBackend);
  $("bf4Area").addEventListener("change", renderDevices); $("bf4St").addEventListener("change", renderDevices);
  $("bf4Type").addEventListener("change", () => { fillMapMachines(); renderMap(); });
  $("bf4MapM").addEventListener("change", renderMap);
  $("bf4Dec").addEventListener("click", runDecode);
  host.querySelectorAll("[data-bf4ex]").forEach((b) => b.addEventListener("click", () => exampleFrame(b.dataset.bf4ex)));
  $("bf4BBuild").addEventListener("click", buildFrame); $("bf4BSend").addEventListener("click", sendFrame);
  $("bf4BToDec").addEventListener("click", () => { $("bf4Hex").value = buildFrame(); $("bf4Dir").value = "req"; runDecode(); });
  $("bf4BFc").addEventListener("change", buildFrame);
  $("bf4RV").addEventListener("input", realConv); $("bf4RR").addEventListener("input", realConv);
  $("bf4CNew").addEventListener("click", () => { $("bf4CId").value = uuid(); }); $("bf4CId").value = uuid();
  $("bf4CSend").addEventListener("click", sendCommand);
  host.querySelectorAll("[data-bf4c]").forEach((i) => i.addEventListener("input", renderCalc));
  host.querySelectorAll("[data-bf4f]").forEach((b) => b.addEventListener("click", () => injectFault(b.dataset.bf4f)));
  $("bf4FClear").addEventListener("click", () => injectFault("clear"));
  $("bf4ASend").addEventListener("click", () => tryApi(false)); $("bf4AAgain").addEventListener("click", () => tryApi(true));
  $("bf4AEx").addEventListener("change", () => showApiReq(false));

  fillMapMachines(); renderMap(); runDecode(); buildFrame(); realConv(); renderCalc(); showApiReq(false); renderCatalogue(); drawAnim();
  try { makeCard(CARD4, host.querySelector(".bf4-wrap"), { card: "bfCard4", q: "bfQ4", g: "bfG4", cnt: "bfCnt4", buy: "bfBuy4" }, "bf4"); } catch (e) { console.error(e); }
  host.querySelector(".bf4-wrap").appendChild($("bf4Debug"));
  const cardMap = { net: "bf4Net", flow: "bf4Flow", dev: "bf4Dev", map: "bf4Map", cmd: "bf4Cmd", calc: "bf4Calc", fault: "bf4Fault", api: "bf4Api", cmp: "bf4Cmp" };
  if (cardMap[Q.get("bf4card")]) setTimeout(() => $(cardMap[Q.get("bf4card")]).scrollIntoView({ block: "start" }), 900);

  demo = makeDemo();
  checkBackend().then(() => { if (Q.has("bf4start") && !be.running && be.reachable && !Q.has("bf4demo")) startBackend(simPort); if (Q.has("bf4test")) setTimeout(selfTest, 600); });
  uiT = setInterval(tick, 1000);
  requestAnimationFrame(animLoop);
}

/* ------------------------------------------------------------------ backend control + live stream */
async function checkBackend() {
  if (Q.has("bf4demo")) { be = { reachable: false, running: false, ctl: null }; setMode(); return be; }
  try { const r = await api("GET", "/api/bsf/control"); be = { reachable: r.ok, running: !!(r.ok && r.data.running), ctl: r.ok ? r.data : null }; }
  catch (e) { be = { reachable: false, running: false, ctl: null }; }
  setMode(); return be;
}
function setMode() {
  const m = $("bf4Mode"); if (!m) return;
  const c = be.ctl || {};
  if (be.running) { m.textContent = `backend: Modbus simulator 127.0.0.1:${c.simPort || "–"} (${c.simMode === "twin" ? "values from the twin" : "own model"}) + gateway running`; m.className = "bf4-badge on"; }
  else if (be.reachable) { m.textContent = "backend stopped – browser demo mode (same codec, same register image)"; m.className = "bf4-badge"; }
  else { m.textContent = "no backend – browser demo mode"; m.className = "bf4-badge"; }
  $("bf4Start").disabled = be.running || !be.reachable; $("bf4Stop").disabled = !be.running;
  if (be.running && !es && visible()) openStream();
  if (!be.running && es) { es.close(); es = null; }
}
async function startBackend(port) {
  $("bf4Start").disabled = true;
  const r = await api("POST", "/api/bsf/control", { action: "start", simPort: port });
  if (!r.ok) { $("bf4Mode").textContent = "start failed: " + (r.data && (r.data.detail || r.data.title) || r.status); $("bf4Mode").className = "bf4-badge bad"; $("bf4Start").disabled = false; return r; }
  await checkBackend(); return r;
}
async function stopBackend() { const r = await api("POST", "/api/bsf/control", { action: "stop" }); live = null; await checkBackend(); return r; }
function openStream() {
  es = new EventSource("/api/bsf/stream");
  es.addEventListener("bsf", (e) => { try { const d = JSON.parse(e.data); if (d.running) { live = d; onLive(d); } else if (be.running) { be.running = false; live = null; checkBackend(); } } catch (err) { console.error(err); } });
  es.onerror = () => { /* the browser reconnects (retry 3 s) */ };
}
async function postSnapshot() {
  if (!be.running || !(be.ctl && be.ctl.sim)) return;
  const now = performance.now(); if (now - lastSnapPost < 950) return; lastSnapPost = now;
  const machines = B.M.map((m) => { B.signals(m); return { id: m.id, state: m.state, code: m.code, sig: m.sig }; });
  try { const r = await api("POST", "/api/bsf/snapshot", { t: B.t, clock: B.clock(), machines }); flows.push({ k: "snap", t: performance.now() }); return r; } catch (e) { /* ignore */ }
}

let lastFrameSeq = 0, lastEvSeq = 0;
function onLive(d) {
  if (d.control && !d.demo) { const m0 = be.ctl && be.ctl.simMode; be.ctl = d.control; if (m0 !== d.control.simMode) setMode(); }
  const fr = d.frames || []; const nNew = fr.filter((f) => f.seq > lastFrameSeq).length; if (fr.length) lastFrameSeq = fr[fr.length - 1].seq;
  const t = performance.now();
  for (let i = 0; i < Math.min(8, Math.max(1, nNew)); i++) flows.push({ k: "mb", t: t + i * 110 });
  flows.push({ k: "sse", t: t + 300 });
  const ne = (d.events || []).filter((e) => e.seq > lastEvSeq).length; if ((d.events || []).length) lastEvSeq = d.events[d.events.length - 1].seq;
  if (ne) { flows.push({ k: "mes", t: t + 450 }); if (ne > 5) flows.push({ k: "erp", t: t + 600 }); }
  if (fr.length) animLabel = fr[fr.length - 1];
  if (visible()) renderLive(d);
}
function tick() {
  if (!visible()) { if (es) { es.close(); es = null; } return; }
  if (be.running) { if (!es) openStream(); postSnapshot(); if (!$("bf4DevInfo").dataset.id) { /* nothing */ } return; }
  demo.tick(); flows.push({ k: "snap", t: performance.now() }); const d = demo.payload(); onLive(d);
}

/* ------------------------------------------------------------------ animation */
const NODES = { twin: [85, 70, "Digital twin", "browser · item 3"], sim: [355, 70, "Modbus TCP server", "73 machines · unit 1 – 73"], gw: [610, 170, "Gateway", "Modbus client → JSON"],
  api: [870, 170, "HTTP API", "/api/bsf/…  REST + SSE"], mes: [1095, 55, "MES", "HTTP"], erp: [1095, 170, "ERP", "HTTP"], page: [1095, 268, "This page", "SSE 1 s"] };
// link: [from, to, label, label x, label y, anchor]
const LINKS = { snap: ["twin", "sim", "HTTP POST snapshot", 220, 56, "middle"], mb: ["sim", "gw", "Modbus TCP :" + simPort, 548, 112, "start"], gwapi: ["gw", "api", "in-process", 740, 160, "middle"],
  mes: ["api", "mes", "HTTP", 972, 96, "end"], erp: ["api", "erp", "HTTP", 1000, 194, "middle"], sse: ["api", "page", "SSE", 972, 250, "end"] };
const flows = []; let animLabel = null;
function drawAnim() {
  const s = $("bf4Anim"); if (!s) return;
  const W = 150, H = 54;
  let g = `<defs><marker id="bf4Ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>`;
  g += `<rect x="262" y="8" width="460" height="284" rx="10" class="bf4-zone"/><text x="274" y="26" class="bf4-zt">Modbus TCP zone (cell VLANs 641 – 645)</text>`;
  g += `<rect x="748" y="8" width="426" height="284" rx="10" class="bf4-zone b"/><text x="760" y="26" class="bf4-zt">HTTP zone (REST + JSON, SSE)</text>`;
  for (const [k, [a, b, lab, lx, ly, anc]] of Object.entries(LINKS)) { const A = NODES[a], Bn = NODES[b];
    const x1 = A[0] + W / 2, y1 = A[1], x2 = Bn[0] - W / 2, y2 = Bn[1];
    g += `<path id="bf4L_${k}" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" class="bf4-link" marker-end="url(#bf4Ar)"${k === "mb" ? ' marker-start="url(#bf4Ar)"' : ""}/>`;
    g += `<text x="${lx}" y="${ly}" class="bf4-ll" text-anchor="${anc}">${esc(lab)}</text>`; }
  for (const [k, [x, y, t, st]] of Object.entries(NODES)) g += `<g class="bf4-node${k === "gw" ? " gw" : ""}"><rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="8"/><text x="${x}" y="${y - 4}" text-anchor="middle" class="bf4-nt">${esc(t)}</text><text x="${x}" y="${y + 14}" text-anchor="middle" class="bf4-ns">${esc(st)}</text></g>`;
  g += `<text id="bf4ALab" x="492" y="252" text-anchor="middle" class="bf4-hexl"></text><text id="bf4ALab2" x="492" y="272" text-anchor="middle" class="bf4-hexl"></text><g id="bf4Dots"></g>`;
  s.innerHTML = g;
}
function animLoop() {
  requestAnimationFrame(animLoop);
  if (!visible()) return;
  const now = performance.now(), dots = $("bf4Dots"); if (!dots) return;
  const DUR = { snap: 900, mb: 650, sse: 700, mes: 800, erp: 800 };
  while (flows.length && now - flows[0].t > 1500) flows.shift();
  let h = "";
  for (const f of flows) { const dur = DUR[f.k] || 700, p = (now - f.t) / dur; if (p < 0 || p > 1) continue;
    const path = $("bf4L_" + f.k); if (!path) continue; const L = path.getTotalLength(); const back = f.k === "mb" && Math.floor(f.t / 10) % 2;
    const pt = path.getPointAtLength((back ? 1 - p : p) * L); h += `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="${f.k === "mb" ? 5 : 6}" class="bf4-dot ${f.k}"/>`; }
  dots.innerHTML = h;
  if (animLabel) { const a = $("bf4ALab"), b = $("bf4ALab2"); if (a && a.dataset.s !== String(animLabel.seq)) { a.dataset.s = animLabel.seq; a.textContent = "→ " + animLabel.req; b.textContent = "← " + (animLabel.resp ? animLabel.resp.slice(0, 66) + (animLabel.resp.length > 66 ? " …" : "") : "(no answer)"); } }
}

/* ------------------------------------------------------------------ live rendering */
function renderLive(d) {
  const S = d.status || {}, T = S.totals || {}, R = S.rate || {};
  const ms = d.machines || [];
  const maxAge = Math.max(0, ...ms.map((m) => (m.quality && m.quality.ageMs) || 0));
  const kpi = [["Devices online", `${S.online ?? 0} / ${S.n ?? 73}`, d.demo ? "browser demo" : "gateway", (S.online === 73 ? "ok" : S.online > 60 ? "warn" : "bad")],
    ["Requests / s", f1(R.reqPerS || 0), d.demo ? "demo plan 226.3 = 153.3 reads (fast + counters 1 s, energy 10 s) + 73 heartbeat writes 226" : "plan 299.3 = 226.3 reads (0.5 / 1 / 10 s) + 73 heartbeat writes 226 (1 s)", ""], ["Bytes / s (Modbus ADU)", f0(R.bytesPerS || 0), "without TCP/IP headers", ""],
    ["Round-trip avg", `${f2(R.rttAvgMs || 0)} ms`, d.demo ? "simulated" : "measured", ""], ["Time-outs", f0(T.timeout || 0), "since start", T.timeout ? "warn" : "ok"],
    ["Exceptions", f0(T.exception || 0), "since start", T.exception ? "warn" : "ok"], ["Max data age", `${f0(maxAge)} ms`, d.demo ? "stale limit 3.6 s (demo polls every 1 s)" : "stale limit 2.1 s", maxAge > (d.demo ? 3600 : 2100) ? "bad" : "ok"],
    ["Snapshot from twin", be.ctl && be.ctl.simMode === "twin" ? "used" : d.demo ? "direct" : "not yet", d.demo ? "demo reads window.BSF" : "POST /api/bsf/snapshot 1 / s", ""]];
  $("bf4Kpi").innerHTML = kpi.map(([h, v, s, c]) => `<div class="card bf4-k ${c}"><div class="bf4-kh">${esc(h)}</div><div class="bf4-kv">${esc(v)}</div><div class="bf4-ks">${esc(s)}</div></div>`).join("");
  const fr = (d.frames || []).slice(-10).reverse();
  $("bf4Frames").innerHTML = tbl(["#", "machine / unit", "group", "request (hex)", "response (hex)", "RTT ms", "decoded"], fr.map((f) => [f.seq, `${esc(f.id)} / ${f.unit}`, esc(f.group),
    `<code class="bf4-hx">${esc(f.req)}</code>`, `<code class="bf4-hx${f.kind !== "ok" && f.kind !== "cmd" ? " bad" : ""}">${esc(f.resp || "– no answer –")}</code>`, f.rttMs, esc(f.text) + (f.values ? `<br><span class="bf4-mut">${esc(Object.entries(f.values).map(([k, v]) => `${k}=${v}`).join(" · "))}</span>` : "")]), "bf4-small bf4-fr");
  const ev = (d.events || []).slice(-14).reverse();
  $("bf4Events").innerHTML = ev.length ? ev.map((e) => `<div class="bf4-ev"><b>${esc(e.id)}</b> ${esc(e.name)}: ${esc(e.old)} → <b>${esc(e.new)}</b></div>`).join("") : `<div class="bf4-mut">no change beyond the dead-band yet</div>`;
  lastMachines = ms;
  renderDevices(); renderMapLive(); renderCalc();
  const info = $("bf4DevInfo"); if (info.dataset.id) showDevice(info.dataset.id, true);
}
let lastMachines = [];
function stateName(code) { return Object.keys(STATES).find((k) => STATES[k].code === code) || "–"; }
function renderDevices() {
  const a = $("bf4Area").value, s = $("bf4St").value, el = $("bf4DevTbl");
  const by = Object.fromEntries(lastMachines.map((m) => [m.id, m]));
  const rows = NETM.filter((m) => !a || m.area === a).map((nm) => [nm, by[nm.id]]).filter(([, m]) => !s || (s === "online" ? m && m.status === "online" : !m || m.status !== "online"));
  const n = lastMachines.filter((m) => m.status === "online").length;
  $("bf4DevSum").textContent = `${n} online of 73 · ${rows.length} shown`;
  el.innerHTML = tbl(["Machine", "Host name", "IP : port", "Unit", "VLAN", "Status", "RTT ms", "Age ms", "State", "Good", "Alarm", "kW"], rows.map(([nm, m]) => {
    const st = m ? m.status : "unknown", mm = (m && m.main) || {};
    return [`<a href="#" data-bf4dev="${nm.id}">${nm.id}</a>`, `<code>${nm.host}</code>`, `<code>${nm.ip}:502</code>`, nm.unit, nm.vlan, `<span class="bf4-dot2" style="background:${STC[st] || "#999"}"></span>${esc(st)}${m && m.exc ? " " + m.exc.toString(16).padStart(2, "0") : ""}`,
      m ? f2(m.rttMs || 0) : "–", m && m.quality && m.quality.ageMs != null ? f0(m.quality.ageMs) : "–", mm["std.stateCode"] != null ? stateName(mm["std.stateCode"]) : "–", mm["std.good"] ?? "–", mm["std.alarm"] ? `<b class="bf4-alarm">${mm["std.alarm"]}</b>` : (mm["std.alarm"] ?? "–"), typeof mm["std.power_kW"] === "number" ? f1(mm["std.power_kW"]) : esc(mm["std.power_kW"] ?? "–")];
  }), "bf4-small bf4-dev");
  el.querySelectorAll("[data-bf4dev]").forEach((x) => x.addEventListener("click", (e) => { e.preventDefault(); showDevice(x.dataset.bf4dev); }));
}
async function showDevice(id, quiet) {
  const el = $("bf4DevInfo"); el.dataset.id = id; const nm = NET_BY_ID[id];
  let vals = null, extra = "";
  if (be.running) { try { const r = await api("GET", "/api/bsf/machine?id=" + encodeURIComponent(id)); if (r.ok) { vals = { ...r.data.values, "cmd.gwHeartbeat": r.data.gwHeartbeat }; extra = `status <b>${esc(r.data.status)}</b> · RTT ${f2(r.data.rttMs)} ms (avg ${f2(r.data.rttAvgMs)}) · ok ${r.data.ok} · errors ${r.data.errors} · changes ${r.data.changes} · age ${r.data.quality.ageMs ?? "–"} ms${r.data.err ? " · " + esc(r.data.err) : ""}`; } } catch (e) { /* ignore */ } }
  else { vals = demo.values[id] || {}; extra = "browser demo – values decoded from the real register image of window.BSF"; }
  if (!vals) return;
  const regs = TYPE_MAPS[nm.type].filter((r) => r.block !== "command" || r.addr === GW_HB_ADDR);
  el.innerHTML = `<h3>${esc(id)} <span class="bf4-mut">${esc(nm.host)} · ${nm.ip} · unit ${nm.unit}</span></h3><p class="bf4-sub2">${extra}</p>` +
    tbl(["Addr", "Name", "Value", "Unit"], regs.map((r) => [r.addr, esc(r.name), `<b>${esc(vals[r.name] ?? "–")}</b>`, esc(r.unit)]), "bf4-small");
  if (!quiet) el.scrollTop = 0;
}

/* ------------------------------------------------------------------ register map card */
function fillMapMachines() { const t = $("bf4Type").value, ms = NETM.filter((m) => m.type === t); $("bf4MapM").innerHTML = ms.length ? ms.map((m) => `<option>${m.id}</option>`).join("") : `<option value="">(no machine of this type in the plan)</option>`; }
function curMapValues() {
  const id = $("bf4MapM").value; if (!id) return {};
  if (be.running) return mapLive[id] || {};
  return demo && demo.values[id] ? demo.values[id] : {};
}
const mapLive = {};
async function renderMapLive() {
  const id = $("bf4MapM").value; if (!id || !visible()) return;
  if (be.running) { try { const r = await api("GET", "/api/bsf/machine?id=" + encodeURIComponent(id)); if (r.ok) mapLive[id] = { ...r.data.values, "cmd.gwHeartbeat": r.data.gwHeartbeat }; } catch (e) { /* ignore */ } }
  const v = curMapValues(); host.querySelectorAll("[data-bf4mv]").forEach((td) => { const x = v[td.dataset.bf4mv]; td.textContent = x == null ? "–" : x; });
}
function renderMap() {
  const t = $("bf4Type").value, regs = TYPE_MAPS[t], G = pollGroups(t), v = curMapValues();
  $("bf4MapSum").innerHTML = `<b>${t}</b> – ${esc(MTYPES[t].n)} · groups ${MTYPES[t].sig.join(" + ")} · ${regs.length} fields · polls: ${G.map(([g, s, q]) => `<code>FC03 ${g} start ${s} qty ${q}</code>`).join(" ")} · <code>FC06 gateway heartbeat ${GW_HB_ADDR} every 1 s</code> · type code ${TYPE_IDS.indexOf(t) + 1} · map version 0x${MAPV.toString(16).padStart(4, "0")} = ${mapVersionText()} (${MAP_SIZE} registers 0 – ${MAP_SIZE - 1}) · history: ${MAP_HISTORY.map((h) => `${h.version} ${h.date} – ${esc(h.change)}`).join(" · ")}`;
  $("bf4MapTbl").innerHTML = tbl(["Offset", "4xxxx", "Regs", "Name", "Type", "Unit", "R/W", "Block", "Meaning", "Live value"], regs.map((r) => [r.addr, 40001 + r.addr, r.n, `<code>${esc(r.name)}</code>`, r.type, esc(r.unit), r.rw, r.block, esc(r.meaning), `<span data-bf4mv="${esc(r.name)}">${esc(v[r.name] ?? "–")}</span>`]), "bf4-small bf4-map");
}
function exampleFrame(k) {
  const nm = NET_BY_ID["BS-TGR-03"];
  if (k === "req") { $("bf4Hex").value = hex(reqRead(1, nm.unit, 0, 12)); $("bf4Dir").value = "req"; }
  if (k === "resp") { let b = null; const f = (live && live.frames || []).find((x) => x.group === "fast" && x.kind === "ok"); if (f) { b = f.resp; $("bf4DStart").value = 0; } else { const req = reqRead(1, nm.unit, 0, 12); b = hex(demoServe(req, demo.image, {})); $("bf4DStart").value = 0; } $("bf4Hex").value = b; $("bf4Dir").value = "resp"; }
  if (k === "exc") { $("bf4Hex").value = hex(adu(1, nm.unit, [0x83, 0x02])); $("bf4Dir").value = "auto"; }
  if (k === "fc16") { $("bf4Hex").value = hex(reqWriteN(5, nm.unit, 200, [1, 7, 0, ...asciiToRegs("WO-00001-L01"), ...asciiToRegs("BS-3210-1000-C5"), 12, 0, 10])); $("bf4Dir").value = "req"; }
  if (k === "bad") { $("bf4Hex").value = "00 01 00 00 00 09 0F 03 00 00 00 0C"; $("bf4Dir").value = "auto"; }
  runDecode();
}
function frameHtml(d, typ) {
  if (!d) return "";
  let h = `<div class="bf4-dec"><div><b>${esc(d.text || d.error || "")}</b>${d.error ? ` <span class="bf4-alarm">– ${esc(d.error)}</span>` : ""}</div>`;
  if (d.mbap) h += `<div class="bf4-mono">MBAP: transaction ${d.mbap.transactionId} · protocol ${d.mbap.protocolId} · length ${d.mbap.length} · unit ${d.mbap.unitId}${NET_BY_UNIT[d.mbap.unitId] ? " (" + NET_BY_UNIT[d.mbap.unitId].id + ")" : ""} · FC ${d.fc} ${esc(d.fcName || "")}${d.dir ? " · " + d.dir : ""}</div>`;
  if (d.regs) h += `<div class="bf4-mono">registers: ${d.regs.map((r, i) => `${(d.start ?? +$("bf4DStart").value) + i}=0x${r.toString(16).toUpperCase().padStart(4, "0")}`).join(" ")}</div>`;
  if (d.values) h += tbl(["Field", "Value"], Object.entries(d.values).map(([k, v]) => [`<code>${esc(k)}</code>`, `<b>${esc(v)}</b>`]), "bf4-small");
  return h + "</div>";
}
function runDecode() {
  let d; try { const b = parseHex($("bf4Hex").value); const u = b.length > 6 ? NET_BY_UNIT[b[6]] : null; d = decodeFrame(b, $("bf4Dir").value, u ? u.type : null, +$("bf4DStart").value, $("bf4DOrd").value); }
  catch (e) { d = { error: e.message }; }
  $("bf4DecOut").innerHTML = frameHtml(d); return d;
}
function buildFrame() {
  const fc = +$("bf4BFc").value, u = +$("bf4BUnit").value, st = +$("bf4BStart").value, q = +$("bf4BQty").value, tid = +$("bf4BTid").value;
  const vals = $("bf4BVals").value.split(/[,\s]+/).filter(Boolean).map((x) => (x.startsWith("0x") ? parseInt(x, 16) : +x) & 0xffff);
  let b;
  if (fc === 3 || fc === 4 || fc === 1) b = reqRead(tid, u, st, q, fc);
  else if (fc === 6) b = reqWrite1(tid, u, st, vals[0] || 0);
  else if (fc === 16) b = reqWriteN(tid, u, st, vals.length ? vals : [0]);
  else b = reqCoil(tid, u, st, (vals[0] || 0) !== 0);
  const h = hex(b); $("bf4BOut").innerHTML = `<div class="bf4-mono"><b>${h}</b></div><div class="bf4-mut">${b.length} bytes = 7 MBAP + ${b.length - 7} PDU · Ethernet wire bytes ${wireBytes(b.length)} (with 58 B headers + 20 B preamble / gap, min. frame 64 B)</div>`;
  return h;
}
async function sendFrame() {
  const h = buildFrame(); const req = parseHex(h);
  let out;
  if (be.running) { const r = await api("POST", "/api/bsf/control", { action: "raw", hex: h }); out = r.ok ? r.data : { ok: false, error: (r.data && r.data.detail) || r.status }; }
  else { const resp = demoServe(req, demo.image, demoFaults); const u = NET_BY_UNIT[req[6]];
    out = resp ? { ok: true, rttMs: 1.2, req: decodeFrame(req, "req"), resp: decodeFrame(resp, "resp", u && (req[7] === 3 || req[7] === 4) ? u.type : null, (req[8] << 8) | req[9]) } : { ok: false, error: "no answer (time-out)", req: decodeFrame(req, "req") }; }
  $("bf4BOut").innerHTML += `<div class="bf4-mono">→ ${esc(h)}</div>` + (out.resp ? `<div class="bf4-mono">← <b>${esc(out.resp.hex)}</b> (${out.rttMs} ms${be.running ? "" : ", browser demo"})</div>` + frameHtml(out.resp) : `<div class="bf4-alarm">${esc(out.error)}</div>`);
  return out;
}
function realConv() {
  const v = +$("bf4RV").value, a = realToRegs(v, "ABCD"), c = realToRegs(v, "CDAB"), hx = (r) => r.map((x) => "0x" + x.toString(16).toUpperCase().padStart(4, "0")).join(" ");
  $("bf4RVOut").innerHTML = `ABCD (this plant): <b>${hx(a)}</b> · CDAB: ${hx(c)} · read wrongly: ${esc(regsToReal(a[0], a[1], "CDAB").toPrecision(5))}`;
  try { const r = parseHex($("bf4RR").value); if (r.length >= 4) { const r0 = (r[0] << 8) | r[1], r1 = (r[2] << 8) | r[3]; $("bf4RROut").innerHTML = `as ABCD: <b>${esc(regsToReal(r0, r1, "ABCD").toPrecision(7))}</b> · as CDAB: ${esc(regsToReal(r0, r1, "CDAB").toPrecision(7))} · as UINT32: ${(((r0 << 16) >>> 0) + r1)}`; } } catch (e) { $("bf4RROut").textContent = e.message; }
}

/* ------------------------------------------------------------------ command card */
async function sendCommand() {
  const body = { id: $("bf4CM").value, cmd: $("bf4CC").value, order: $("bf4CO").value, part: $("bf4CP").value, qty: +$("bf4CQ").value, recipe: +$("bf4CR").value, msgId: $("bf4CId").value || uuid() };
  if (body.cmd === "bad") { body.cmd = ""; body.code = 9; }
  $("bf4COut").innerHTML = `<p class="bf4-mut">sending …</p>`;
  let r;
  if (be.running) { const x = await api("POST", "/api/bsf/command", body); r = x.data; r.http = x.status; }
  else r = demoCommand(body);
  showCommand(r); if (r.ok && r.code === 1) watchLot(body.id, body.qty);
  return r;
}
function demoCommand(body) {
  const nm = NET_BY_ID[body.id], h = demo.hsOf(body.id), steps = []; let ms = 0, tid = 0x7000;
  if (body.msgId && demo.cache && demo.cache[body.msgId]) return { ...demo.cache[body.msgId], replay: true };
  const code = body.code || { order: 1, start: 2, stop: 3, ack: 4, recipe: 5 }[body.cmd] || 0;
  const tx = (req, text) => { const resp = demoServe(req, demo.image, demoFaults); ms += 1 + Math.random() * 2; steps.push({ ms: +ms.toFixed(1), text, req: hex(req), resp: resp ? hex(resp) : "", rttMs: 1.2, decoded: resp ? decodeFrame(resp, "resp").text : "time-out" }); return resp; };
  if (!tx(reqRead(++tid, nm.unit, 200, 3), "1 read cmd.code / cmd.seq / cmd.ctl (200 - 202)")) return { ok: false, error: "no answer within 300 ms (browser demo)", steps, id: body.id, code };
  tx(reqRead(++tid, nm.unit, 8, 3), "2 read hs.status / ackSeq / result (8 - 10)");
  const seq = (h.seq + 1) & 0xffff; const data = [code, seq, h.ctl, ...asciiToRegs(body.order), ...asciiToRegs(body.part), body.recipe & 0xffff, ...encodeValue("UINT32", body.qty)];
  tx(reqWriteN(++tid, nm.unit, 200, data), `3 FC16 write command block 200 - 225 (code ${code} ${CMD_CODES[code] || "?"}, seq ${seq}), REQ unchanged (226 = gateway heartbeat, written separately)`);
  h.ctl ^= 1; h.seq = seq; h.cmd = data.slice(); h.cmd[2] = h.ctl;
  tx(reqWrite1(++tid, nm.unit, 202, h.ctl), `4 FC06 toggle REQ: cmd.ctl = ${h.ctl} (written LAST)`);
  const m = B.byId[body.id]; const ready = m.state !== "DOWN"; let res = 0;
  if (code === 1) { if (!body.order || body.qty <= 0) res = 3; else if (h.busy) res = 4; else if (!ready) res = 2; else { h.busy = true; h.lotDone = 0; h.qty = Math.min(body.qty, 30); h.order = body.order; } }
  else if (code === 2) res = ready ? 0 : 2; else if (code === 3) h.busy = false; else if (code === 4) res = 0; else if (code === 5) res = body.recipe ? 0 : 3; else res = 1;
  h.ack = h.ctl; h.ackSeq = seq; h.result = res; ms += 100;
  tx(reqRead(++tid, nm.unit, 8, 4), "5.1 poll hs.status until ACK = REQ"); ms += 100;
  const r = { ok: res === 0, result: res, resultText: RESULTS[res], ackSeq: seq, busy: h.busy, reject: res !== 0, steps, id: body.id, code, cmd: CMD_CODES[code] || "?", ms: +ms.toFixed(1), msgId: body.msgId, demo: true };
  (demo.cache = demo.cache || {})[body.msgId] = r; return r;
}
function showCommand(r) {
  const st = r.ok ? `<span class="bf4-badge on">ACK – result ${r.result} ${esc(r.resultText)}</span>` : `<span class="bf4-badge bad">${esc(r.error || ("result " + r.result + " " + (r.resultText || "")))}</span>`;
  $("bf4COut").innerHTML = `<p>${st} ${r.replay ? '<span class="bf4-badge">replay – same msgId, nothing written again</span>' : ""} <span class="bf4-mut">${esc(r.id)} · command ${r.code} ${esc(r.cmd || "")} · ackSeq ${r.ackSeq ?? "–"} · total ${r.ms ?? "–"} ms${r.demo ? " · browser demo" : ""}${r.http ? " · HTTP " + r.http : ""}</span></p>` +
    tbl(["Step", "ms", "Request (hex)", "Response (hex)", "Decoded"], (r.steps || []).map((s) => [esc(s.text), s.ms, `<code class="bf4-hx">${esc(s.req)}</code>`, `<code class="bf4-hx">${esc(s.resp)}</code>`, esc(s.decoded)]), "bf4-small bf4-fr");
}
let watchT = null;
function watchLot(id, qty) {
  clearInterval(watchT); let n = 0;
  watchT = setInterval(async () => {
    n++; let v = null;
    if (be.running) { try { const r = await api("GET", "/api/bsf/machine?id=" + id); if (r.ok) v = r.data.values; } catch (e) { /* ignore */ } } else { const h = demo.hsOf(id); v = { "hs.status": (h.ack & 1) | (h.busy ? 2 : 0) | (h.done & 1 ? 4 : 0), "hs.lotDone": h.lotDone, "std.order": h.order }; }
    if (!v) return; const hs = v["hs.status"] || 0;
    $("bf4CWatch").innerHTML = `machine side (read by the gateway, fast block): hs.status = 0b${hs.toString(2).padStart(5, "0")} → ACK ${hs & 1} · BUSY ${(hs >> 1) & 1} · DONE toggle ${(hs >> 2) & 1} · READY ${(hs >> 4) & 1} · lotDone <b>${v["hs.lotDone"] ?? 0}</b> / ${qty} · std.order = ${esc(v["std.order"] ?? "")}` +
      ((hs & 2) ? "" : ` · <b>lot finished – DONE toggled → MES books the confirmation (POST /api/bsf/mes/confirmations)</b>`);
    if (!(hs & 2) && n > 2 || n > 60) clearInterval(watchT);
  }, 1000);
}

/* ------------------------------------------------------------------ calculator */
function renderCalc() {
  const o = {}; host.querySelectorAll("[data-bf4c]").forEach((i) => { o[i.dataset.bf4c] = +i.value; });
  const c = loadCalc(o), L = live && live.status && live.status.rate;
  $("bf4CalcOut").innerHTML = tbl(["Group", "Period ms", "Registers", "Polls / s", "Request ADU B", "Response ADU B", "Wire B per poll", "Wire B / s", "Max data age ms (= T + RTT)", "If a device fails ms (T + time-out × (1 + retries) + RTT)"],
    c.rows.map((r) => [r.w ? `${esc(r.g)} <span class="bf4-mut">write, echo answer</span>` : r.g, f0(r.T), f2(r.r), f1(r.pps), r.reqA, f1(r.respA), f1(r.wire), f0(r.wireBps), f1(r.ageMax), f0(r.ageFail)])
      .concat([["<b>total</b>", "", "", `<b>${f1(c.pps)}</b><br><span class="bf4-mut">${f1(c.reads)} reads + ${f1(c.writes)} writes</span>`, "", "", "", `<b>${f0(c.wireBps)}</b>`, "", ""]]), "bf4-small") +
    `<div class="bf4-kpis">${[["Link load", `${f2(c.linkPct)} %`, `${f2(c.wireBps * 8 / 1e6)} Mbit/s of ${o.link_mbit} Mbit/s`, c.linkPct < 20 ? "ok" : "warn"],
      ["Worker load", `${f0(c.busy * 100)} %`, `polls/s ÷ workers × RTT = ${f1(c.pps)} ÷ ${o.workers} × ${o.rtt_ms} ms`, c.busy < 0.5 ? "ok" : c.busy < 0.8 ? "warn" : "bad"],
      ["Cycle per device", `${f1(c.cycleDev_ms)} ms/s`, "Σ (1/T) × RTT – one device keeps a connection busy this long per second", ""],
      ["Max devices per worker", f0(c.maxDevPerWorker), `at RTT ${o.rtt_ms} ms (now ${c.devPerWorker} per worker)`, c.devPerWorker <= c.maxDevPerWorker ? "ok" : "bad"],
      ["Cost of one dead device", `${f0(c.deadCost_ms)} ms`, "time-out × (1 + retries) per poll – hence back-off after 3 failures", ""],
      ["Measured (gateway)", L ? `${f1(L.reqPerS)} req/s` : "–", L ? `${f0(L.bytesPerS)} B/s ADU · RTT ${f2(L.rttAvgMs)} ms (loopback)` : "start the backend", ""]]
      .map(([h, v, s, k]) => `<div class="card bf4-k ${k}"><div class="bf4-kh">${esc(h)}</div><div class="bf4-kv">${esc(v)}</div><div class="bf4-ks">${esc(s)}</div></div>`).join("")}</div>
    <p class="hint">Wire bytes per frame = max(64, ADU + 58) + 20 (Ethernet 14 + IP 20 + TCP 20 + FCS 4 = 58 B, minimum frame 64 B, preamble + inter-frame gap 20 B); TCP ACKs are not counted (mostly piggy-backed).
      Example (defaults): fast 12 + 33 B ADU → 90 + 111 = 201 wire bytes × 146 polls/s = 29 346 B/s; map V1.1 gateway heartbeat FC06 226: 12 + 12 B ADU → 90 + 90 = 180 wire bytes × 73 writes/s = 13 140 B/s;
      total 299.3 requests/s ≈ 62.0 kB/s = 0.50 Mbit/s = 0.5 % of 100 Mbit/s (V1.0 without the heartbeat: 226.3 /s, 48.8 kB/s, 0.39 %) – the network is never the problem; the device answer time (RTT 2 – 20 ms on real PLCs / CNCs) and the number of TCP connections a device accepts are.</p>`;
  return c;
}

/* ------------------------------------------------------------------ faults */
async function injectFault(k) {
  const id = $("bf4FM").value, out = $("bf4FOut");
  const probe = { badunit: 1, badaddr: 1, badfc: 1, badqty: 1 }[k];
  let html = "";
  if (be.running) {
    if (k === "clear") { await api("POST", "/api/bsf/control", { action: "fault", id: "all", fault: "none" }); await api("POST", "/api/bsf/control", { action: "netloss", on: false }); html = "all faults cleared – devices come back within ≈ 2 s (back-off)"; }
    else if (k === "netloss") { const on = !(be.ctl && be.ctl.netloss); await api("POST", "/api/bsf/control", { action: "netloss", on }); html = on ? "network loss ON – no device answers; watch the device table: time-out, then stale after 2.1 s" : "network loss OFF"; }
    else if (probe) { const r = await api("POST", "/api/bsf/control", { action: "probe", kind: k }); const d = r.data; html = `<div class="bf4-mono">→ ${esc(d.req && d.req.hex)}</div>` + (d.resp ? `<div class="bf4-mono">← <b>${esc(d.resp.hex)}</b></div>` + frameHtml(d.resp) : `<div class="bf4-alarm">${esc(d.error)}</div>`); }
    else if (k === "cdab") { await api("POST", "/api/bsf/control", { action: "fault", id, fault: "cdab" }); const r = await api("POST", "/api/bsf/control", { action: "probe", kind: "cdab" });
      const a = r.data.resp && r.data.resp.values || {}, c = r.data.respCDAB && r.data.respCDAB.values || {};
      html = `${esc(id)} now sends REAL low word first (watch its values in the device table). Probe on BS-TGR-03 – the same response decoded both ways:` + tbl(["Field", "decoded ABCD (gateway setting) = garbage", "decoded CDAB = correct"], Object.keys(a).filter((x) => /REAL/.test((TYPE_MAPS["BS-TGR"].find((r) => r.name === x) || {}).type || "")).slice(0, 8).map((x) => [esc(x), `<b class="bf4-alarm">${esc(a[x])}</b>`, esc(c[x])]), "bf4-small"); }
    else { await api("POST", "/api/bsf/control", { action: "fault", id, fault: k }); html = `fault <b>${esc(k)}</b> set on ${esc(id)} – watch the device table (status, age, RTT) and the frames.`; }
    await checkBackend();
  } else {
    if (k === "clear") { demoFaults = {}; html = "all faults cleared (browser demo)"; }
    else if (k === "netloss") { demoFaults.netloss = !demoFaults.netloss; html = "network loss " + (demoFaults.netloss ? "ON" : "OFF") + " (browser demo)"; }
    else if (probe) { const nm = NET_BY_ID["BS-TGR-03"]; const req = { badunit: reqRead(1, 200, 0, 12), badaddr: reqRead(1, nm.unit, 300, 4), badfc: adu(1, nm.unit, [8, 0, 0, 0x12, 0x34]), badqty: reqRead(1, nm.unit, 0, 200) }[k];
      const resp = demoServe(req, demo.image, demoFaults); html = `<div class="bf4-mono">→ ${hex(req)}</div><div class="bf4-mono">← <b>${hex(resp)}</b> (browser demo)</div>` + frameHtml(decodeFrame(resp, "resp")); }
    else if (k === "cdab") { demoFaults[id] = "cdab"; const nm = NET_BY_ID[id], q = countersLen(nm.type), req = reqRead(1, nm.unit, 20, q), resp = demoServe(req, demo.image, demoFaults);
      const a = decodeFrame(resp, "resp", nm.type, 20, "ABCD").values, c = decodeFrame(resp, "resp", nm.type, 20, "CDAB").values;
      html = `${esc(id)} sends REAL low word first (browser demo):` + tbl(["Field", "decoded ABCD = garbage", "decoded CDAB = correct"], Object.keys(a).filter((x) => (TYPE_MAPS[nm.type].find((r) => r.name === x) || {}).type === "REAL").slice(0, 8).map((x) => [esc(x), `<b class="bf4-alarm">${esc(a[x])}</b>`, esc(c[x])]), "bf4-small"); }
    else { demoFaults[id] = k; html = `fault <b>${esc(k)}</b> set on ${esc(id)} (browser demo) – watch the device table.`; }
  }
  out.innerHTML = html; return html;
}

/* ------------------------------------------------------------------ HTTP API card */
let apiKey = uuid();
function showApiReq(again) {
  const e = API_EX[+$("bf4AEx").value]; if (!again) apiKey = uuid();
  const hdr = [`${e[1]} ${e[2]} HTTP/1.1`, `Host: ${location.host}`, "Accept: application/json"];
  if (e[3] != null) hdr.push("Content-Type: application/json");
  if (e[4]) hdr.push("Idempotency-Key: " + apiKey);
  $("bf4AReq").textContent = hdr.join("\n") + (e[3] != null ? "\n\n" + JSON.stringify(e[3], null, 2) : "");
  return e;
}
async function tryApi(again) {
  const e = showApiReq(again);
  const r = await api(e[1], e[2], e[3], e[4] ? { "Idempotency-Key": apiKey } : {});
  let body = typeof r.data === "string" ? r.data : JSON.stringify(r.data, null, 2); if (body.length > 6000) body = body.slice(0, 6000) + "\n… (cut)";
  $("bf4AResp").textContent = `HTTP/1.1 ${r.status}\nContent-Type: ${r.ct}\n(${f1(r.ms)} ms)\n\n${body}`;
  return r;
}
async function renderCatalogue() {
  let rows = null; try { const r = await api("GET", "/api/bsf/api"); if (r.ok) rows = r.data.routes; } catch (e) { /* offline */ }
  if (!rows) rows = API_EX.map((e) => [e[1], e[2], e[0]]);
  $("bf4ACat").innerHTML = tbl(["Method", "Path", "Purpose"], rows.map((r) => [`<b>${esc(r[0])}</b>`, `<code>${esc(r[1])}</code>`, esc(r[2])]), "bf4-small");
}

/* ------------------------------------------------------------------ self-check (&bf4test) */
async function selfTest() {
  const out = [], log = (s) => { out.push(s); console.log("BF4TEST " + s); };
  let pass = 0, fail = 0;
  const chk = (name, got, exp, tol) => { const okk = Math.abs(got - exp) <= tol; okk ? pass++ : fail++; log(`${okk ? "PASS" : "FAIL"} ${name} = ${Number(got).toPrecision(7)} (hand ${Number(exp).toPrecision(7)} ± ${tol})`); };
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  // map + IP plan
  chk("machines in the plan", NETM.length, 73, 0);
  ok("unit ids 1 … 73 unique", new Set(NETM.map((m) => m.unit)).size === 73 && Math.max(...NETM.map((m) => m.unit)) === 73);
  ok("IP addresses unique, host names ≤ 63 characters, lower case", new Set(NETM.map((m) => m.ip)).size === 73 && NETM.every((m) => m.host.length <= 63 && m.host === m.host.toLowerCase()), `${NETM[14].id} → ${NETM[14].ip} ${NETM[14].host}`);
  let overl = [], odd = [], big = [];
  for (const t of TYPE_IDS) { const used = new Array(MAP_SIZE).fill(null); for (const r of TYPE_MAPS[t]) { if (r.n === 2 && r.addr % 2) odd.push(t + "." + r.name); for (let i = 0; i < r.n; i++) { if (used[r.addr + i]) overl.push(t + "." + r.name); used[r.addr + i] = r.name; } } if (countersLen(t) > 125 || 20 + countersLen(t) > 100) big.push(t); }
  ok("register maps: no overlap, REAL / UINT32 on even offsets, counters block ≤ 80 registers", !overl.length && !odd.length && !big.length, overl.concat(odd, big).slice(0, 4).join(", ") || `${TYPE_IDS.length} types`);
  // frames
  ok("FC03 request frame", hex(reqRead(1, 15, 0, 12)) === "00 01 00 00 00 06 0F 03 00 00 00 0C");
  ok("FC06 request frame", hex(reqWrite1(4, 15, 202, 1)) === "00 04 00 00 00 06 0F 06 00 CA 00 01");
  ok("FC16 request frame (2 registers)", hex(reqWriteN(3, 15, 200, [1, 7])) === "00 03 00 00 00 0B 0F 10 00 C8 00 02 04 00 01 00 07");
  const ex = decodeFrame(parseHex("00 01 00 00 00 03 0F 83 02")); ok("decode exception 02", ex.exception === 2 && /ILLEGAL DATA ADDRESS/.test(ex.text));
  const rq = decodeFrame(parseHex("00 01 00 00 00 06 0F 03 00 14 00 30")); ok("decode request start 20 qty 48", rq.dir === "req" && rq.start === 20 && rq.qty === 48 && rq.mbap.unitId === 15);
  ok("decode wrong MBAP length → error", !!decodeFrame(parseHex("00 01 00 00 00 09 0F 03 00 00 00 0C")).error);
  // data types
  const a = realToRegs(570.8); ok("REAL 570.8 → ABCD 0x440E 0xB333", a[0] === 0x440e && a[1] === 0xb333);
  chk("REAL back from 0x440E 0xB333", regsToReal(0x440e, 0xb333), 570.8, 1e-4);
  chk("same registers read as CDAB (garbage)", regsToReal(0x440e, 0xb333, "CDAB"), -4.1741e-8, 1e-11);
  const t20 = realToRegs(20); ok("REAL 20.0 = 0x41A0 0x0000", t20[0] === 0x41a0 && t20[1] === 0);
  const u32 = encodeValue("UINT32", 2120); ok("UINT32 2120 → 0x0000 0x0848 (high word first)", u32[0] === 0 && u32[1] === 0x848 && decodeValue("UINT32", [1, 2]) === 65538);
  ok("ASCII 'WO' = 0x574F, round trip", asciiToRegs("WO-1")[0] === 0x574f && decodeValue("ASCII20", asciiToRegs("WO-00001-L01")) === "WO-00001-L01");
  // round trip twin → registers → frame → decoded
  const m = B.byId["BS-TGR-03"]; B.signals(m); const nm = NET_BY_ID["BS-TGR-03"], G = pollGroups(nm.type);
  const resp = demoServe(reqRead(9, nm.unit, G[1][1], G[1][2]), demo.image, {}); const dv = decodeFrame(resp, "resp", nm.type, G[1][1]).values;
  const bad = []; for (const g of ["grind", "tgr"]) for (const k in m.sig[g]) { const v = dv[`${g}.${k}`], w = m.sig[g][k]; if (Math.abs(v - w) > Math.max(1e-6, Math.abs(w) * 1e-6)) bad.push(`${g}.${k} ${v}≠${w}`); }
  ok("round trip twin → registers → FC03 → decoded (BS-TGR-03 process values)", !bad.length && dv["std.good"] === m.sig.std.good, bad.slice(0, 3).join(", ") || `${Object.keys(dv).length} fields, good = ${dv["std.good"]}`);
  const e0b = demoServe(reqRead(1, 200, 0, 12), demo.image, {}), e02 = demoServe(reqRead(1, 15, 300, 4), demo.image, {}), e03 = demoServe(reqRead(1, 15, 0, 200), demo.image, {}), e01 = demoServe(adu(1, 15, [8, 0, 0, 0, 0]), demo.image, {});
  ok("demo server exceptions 0B / 02 / 03 / 01", e0b[8] === 0x0b && e02[8] === 2 && e03[8] === 3 && e01[8] === 1 && e0b[7] === 0x83);
  // timing
  ok("map V1.1: version 0x0101, 227 registers, 226 = cmd.gwHeartbeat UINT16 W in every type", MAPV === 0x0101 && MAP_SIZE === 227 && TYPE_IDS.every((t) => TYPE_MAPS[t].some((r) => r.addr === 226 && r.name === "cmd.gwHeartbeat" && r.type === "UINT16" && r.rw === "W" && r.block === "command")), mapVersionText());
  const hbw = demoServe(reqWrite1(5, 15, 226, 65535), demo.image, {}), hb7 = demoServe(reqWrite1(5, 15, 227, 1), demo.image, {}), hr2 = demoServe(reqRead(5, 15, 200, 27), demo.image, {}), hr3 = demoServe(reqRead(5, 15, 200, 28), demo.image, {});
  ok("demo server: FC06 226 echo, 227 → exc 02, FC03 200 qty 27 ok, qty 28 → exc 02", hex(hbw) === hex(reqWrite1(5, 15, 226, 65535)) && hb7[8] === 2 && hr2[8] === 54 && hr3[8] === 2);
  const c0 = loadCalc({ gwhb_ms: 0 }); chk("V1.0 reads only: polls/s 73 × (2 + 1 + 0.1)", c0.pps, 226.3, 1e-9); chk("V1.0 wire bytes/s 48 827.5", c0.wireBps, 48827.5, 1);
  const c = loadCalc({}); chk("V1.1 requests/s 226.3 reads + 73 heartbeat writes", c.pps, 299.3, 1e-9); chk("heartbeat writes/s", c.writes, 73, 1e-9); chk("heartbeat wire bytes per write = 90 + 90", c.rows[3].wire, 180, 0);
  chk("V1.1 wire bytes/s (guide 61 967.5)", c.wireBps, 61967.5, 1); chk("V1.1 link load % of 100 Mbit/s", c.linkPct, 0.4957, 0.001); chk("V1.1 ADU bytes/s (guide 15 276.7)", c.payBps, 15276.7, 0.5); chk("max devices per worker at 3 ms (1000 / (4.1 × 3))", c.maxDevPerWorker, 81, 0);
  chk("fast poll wire bytes = 90 + 111", c.rows[0].wire, 201, 0); chk("max data age fast = 500 + 3 ms", c.rows[0].ageMax, 503, 0);
  // backend
  await checkBackend();
  if (!be.reachable) { log("backend not reachable – browser-only checks done"); return finish(); }
  const wasRunning = be.running;
  const mp = await api("GET", "/api/bsf/map");
  const pyM = mp.data.machines.map((x) => [x.id, x.unit, x.ip, x.host, x.vlan].join("|")).join(","), jsM = NETM.map((x) => [x.id, x.unit, x.ip, x.host, x.vlan].join("|")).join(",");
  ok("IP plan Python = JavaScript (73 machines)", pyM === jsM);
  ok("map version + size Python = JavaScript (V1.1, 227)", mp.data.version === MAPV && mp.data.size === MAP_SIZE && mp.data.blocks.command[1] === 226 && mp.data.poll.gwhb_ms === 1000, `${mp.data.versionText} · ${mp.data.size}`);
  const key = (r) => [r.addr, r.n, r.name, r.type, r.unit, r.rw, r.block].join("|");
  const diff = mp.data.types.filter((T) => !TYPE_MAPS[T.id] || T.registers.map(key).join(",") !== TYPE_MAPS[T.id].map(key).join(",")).map((T) => T.id);
  ok("register maps Python = JavaScript (all types)", diff.length === 0 && mp.data.types.length === TYPE_IDS.length, diff.join(", ") || `${mp.data.types.length} types`);
  if (!wasRunning) { const r = await startBackend(+(Q.get("bf4port") || 15020)); ok("start Modbus sim + gateway (POST /api/bsf/control)", r.ok, r.ok ? `port ${r.data.simPort}` : JSON.stringify(r.data)); if (!r.ok) return finish(); }
  await sleep(3500);
  const st = await api("GET", "/api/bsf/status");
  ok("gateway polls all 73 machines", st.data.online === 73, `online ${st.data.online}, ${st.data.rate.reqPerS} req/s, RTT ${st.data.rate.rttAvgMs} ms`);
  chk("measured requests/s ≈ plan 299.3 = 226.3 reads + 73 writes (± 20 %)", st.data.rate.reqPerS, 299.3, 60);
  ok("gateway writes the heartbeat 226 (FC06) – statistics count it", st.data.totals.hbWrites > 73 && st.data.totals.reads > 146, `${st.data.totals.hbWrites} heartbeat writes, ${st.data.totals.reads} reads`);
  const cv = await api("GET", "/api/bsf/control"); ok("simulated PLCs see the gateway heartbeat 226 change (watchdog OK 73 / 73), map V1.1", cv.data.gwHbOk === 73 && cv.data.mapVersion === "V1.1" && cv.data.mapSize === 227, `gwHbOk ${cv.data.gwHbOk}, ${cv.data.mapVersion}, ${cv.data.mapSize} registers`);
  const hbf = await api("GET", "/api/bsf/frames?n=400"); const hf = hbf.data.frames.find((f) => f.group === "gwhb" && f.kind === "ok");
  ok("heartbeat frame FC06 226 in the frame log", !!hf && decodeFrame(parseHex(hf.req), "req").addr === 226 && decodeFrame(parseHex(hf.req), "req").fc === 6, hf ? hf.req + " · " + hf.text : "none");
  const fr = await api("GET", "/api/bsf/frames?n=20"); ok("frames > 0 with hex + decoded text", fr.data.frames.length > 0 && /^[0-9A-F ]+$/.test(fr.data.frames[0].req), fr.data.frames.length ? fr.data.frames[fr.data.frames.length - 1].req : "");
  const f1r = fr.data.frames.find((f) => f.kind === "ok"); if (f1r) { const dd = decodeFrame(parseHex(f1r.resp), "resp"); ok("JS decodes a real gateway response", dd.ok && dd.mbap.unitId === f1r.unit, dd.text); }
  await postSnapshot(); lastSnapPost = 0; await sleep(1200); await postSnapshot(); await sleep(1500);
  const ctl = await api("GET", "/api/bsf/control"); ok("simulator uses the twin snapshot", ctl.data.simMode === "twin", ctl.data.simMode);
  const mv = await api("GET", "/api/bsf/machine?id=BS-TGR-03"); B.signals(m);
  ok("gateway value = twin value (BS-TGR-03 state code)", mv.data.values["std.stateCode"] === m.sig.std.stateCode, `${mv.data.values["std.stateCode"]} vs ${m.sig.std.stateCode}`);
  const cm = await api("POST", "/api/bsf/command", { id: "BS-TGR-05", cmd: "order", order: "WO-T-0001", part: "BS-3210-1000-C5", qty: 3, recipe: 12, msgId: "t-" + uuid() });
  ok("command: FC16 + handshake → ACK result 0", cm.data.ok && cm.data.result === 0 && cm.data.steps.length >= 5, `${cm.data.ms} ms, ${cm.data.steps.length} frames`);
  const cm2 = await api("POST", "/api/bsf/command", { id: "BS-TGR-05", cmd: "order", order: "WO-T-0002", part: "X", qty: 3, msgId: cm.data.msgId });
  ok("idempotency: same msgId → replay, no second write", cm2.data.replay === true && cm2.data.ackSeq === cm.data.ackSeq);
  const cm3 = await api("POST", "/api/bsf/command", { id: "BS-TGR-05", cmd: "order", order: "WO-T-0003", part: "X", qty: 3, msgId: "t-" + uuid() });
  ok("busy machine rejects a 2nd order (result 4)", cm3.data.result === 4, `result ${cm3.data.result} ${cm3.data.resultText}`);
  const p1 = await api("POST", "/api/bsf/control", { action: "probe", kind: "badunit" }); ok("wrong unit id → exception 0B", p1.data.resp && p1.data.resp.exception === 11);
  const p2 = await api("POST", "/api/bsf/control", { action: "probe", kind: "badaddr" }); ok("register out of range → exception 02", p2.data.resp && p2.data.resp.exception === 2);
  const p3 = await api("POST", "/api/bsf/control", { action: "probe", kind: "cdab" }); const va = p3.data.resp.values["grind.oilTemp_C"], vc = p3.data.respCDAB.values["grind.oilTemp_C"];
  ok("wrong word order → garbage REAL, CDAB decode correct", Math.abs(vc - 20) < 2 && !(Math.abs(va - 20) < 2), `ABCD ${va} vs CDAB ${vc}`);
  await api("POST", "/api/bsf/control", { action: "fault", id: "BS-TGR-01", fault: "offline" }); await sleep(2600);
  const d1 = await api("GET", "/api/bsf/machine?id=BS-TGR-01"); ok("offline device → time-out + stale flag", d1.data.status === "timeout" && d1.data.quality.stale, `${d1.data.status}, age ${d1.data.quality.ageMs} ms`);
  await api("POST", "/api/bsf/control", { action: "fault", id: "all", fault: "none" });
  const raw = await api("POST", "/api/bsf/control", { action: "raw", hex: hex(reqRead(77, 15, 0, 12)) }); ok("frame builder → simulator → decoded values", raw.data.ok && raw.data.resp.values && raw.data.resp.values["hdr.unitId"] === 15);
  const w1 = await api("POST", "/api/bsf/mes/workorders", { product: "BS", qty: 40 }, { "Idempotency-Key": "k-" + uuid() });
  const w2 = await api("POST", "/api/bsf/mes/workorders", { product: "BS", qty: 40 }, { "Idempotency-Key": "k-" + uuid() });
  ok("MES work order 201 + new id each key", w1.status === 201 && w2.status === 201 && w1.data.id !== w2.data.id, `${w1.data.id}, ${w2.data.id}`);
  const nf = await api("GET", "/api/bsf/mes/workorders/WO-99999"); ok("unknown resource → 404 problem+json", nf.status === 404 && /problem\+json/.test(nf.ct) && nf.data.title);
  const ev = await api("GET", "/api/bsf/events?since=0&wait=1"); ok("report-by-exception events available", ev.data.events.length > 0, `${ev.data.events.length} events, seq ${ev.data.seq}`);
  await sleep(1300); ok("SSE live stream reached the page", !!live && !live.demo && live.status && live.status.online > 0);
  if (!wasRunning) { const r = await stopBackend(); ok("stop (POST /api/bsf/control stop) → nothing runs", r.ok && r.data.running === false); }
  return finish();
  function finish() {
    const card = $("bfCard4"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : [];
    imgs.forEach((i) => { i.loading = "eager"; });
    setTimeout(() => {
      ok("card bfCard4", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
      chk("card drawings loaded", imgs.filter((i) => i.complete && i.naturalWidth > 0).length, 12, 0);
      ok("device table 73 rows", $("bf4DevTbl").querySelectorAll("tbody tr").length === 73);
      log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
      const d = $("bf4Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = out.join("\n"); d.prepend(pre);
    }, 2500);
  }
}

window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "4") build(); });
if (window.bfCtl && window.bfCtl.current() === "4" && window.bfCtl.tabVisible()) build();
