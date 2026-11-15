/* FMS engineering – item 6: communication.  Loaded by fmse.js (build "6").
 * 6A protocol map · 6B protocol selector (rules) · 6C calculators (PROFINET load, EtherCAT cycle, Modbus TCP polling, historian / MQTT volume)
 * 6D IP / VLAN plan builder (+ CSV) · 6E zones & conduits IEC 62443 + flow tester · 6F standard module data block on Modbus / PROFINET / OPC UA / MQTT
 * Guide: docs/FMS system design/66_communication.md */
import { PROTO, PN0, EC0, MB0, HI0, ZONES, RANGES, MODDEV, KITS, ZBOX, CONDUITS, FLOWS, BLOCK, EXTRA } from "./fmse6_data.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f1 = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString("en", { maximumFractionDigits: d, minimumFractionDigits: d }) : "–");
export const UNIT = { M01: "MC", M02: "APC", M03: "POOL", M04: "LS", M05: "ROB", M06: "AGVST", M07: "CONV", M08: "ASRS", M09: "TOOL", M10: "WASH", M11: "CMM", M12: "MARK", M13: "ST", M14: "TEST", M15: "WELD", M16: "PRESS", M17: "UTIL", M18: "SAFE", M19: "CC", M20: "SCADA", M21: "MESCON", M22: "NET" };
export const MODN = { M01: "Machine tool interface", M02: "Pallet changer", M03: "Pallet pool + stacker", M04: "Load / unload station", M05: "Robot cell", M06: "AGV station", M07: "Conveyor", M08: "AS/RS", M09: "Tool management", M10: "Washer", M11: "Measuring", M12: "Marking & ID", M13: "Assembly station", M14: "Test station", M15: "Welding cell", M16: "Press", M17: "Utilities", M18: "Safety controller", M19: "Cell controller", M20: "SCADA", M21: "MES connector", M22: "Network" };
function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

export function mount(el) {
  el.innerHTML = `
  <div class="card"><div class="card-head"><h2>6A · Protocol map – which protocol for which job</h2><span class="sub">16 protocols · level = ISA-95 level (item 5) · typical values</span></div>
    <div class="fe-scroll"><table class="am-tab fe-proto"><thead><tr><th>Protocol</th><th>Level</th><th>Type</th><th>Cycle / latency</th><th>Data model</th><th>Ecosystem</th><th>Use in an FMS</th><th>+</th><th>−</th></tr></thead>
      <tbody>${PROTO.map((r) => `<tr>${r.map((c, i) => `<td>${i ? esc(c) : "<b>" + esc(c) + "</b>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="am-note"><b>Three families:</b> (1) <b>cyclic real-time fieldbuses</b> (PROFINET, EtherCAT, EtherNet/IP, CC-Link IE) move IO and drive data every few ms inside a machine / cell;
      (2) <b>client / server with a data model</b> (OPC UA, MTConnect, Modbus TCP without model) for jobs, states, values between controllers and supervisory systems;
      (3) <b>IT messaging</b> (MQTT, REST, B2MML) for MES, ERP, historian, cloud. Safety always rides on (1) with a certified safety layer – or hard-wired.</p>
  </div>

  <div class="card"><div class="card-head"><h2>6B · Protocol selector – recommendation per link for YOUR factory</h2><span class="sub">answer 7 questions · rules from practice · confirm with suppliers</span></div>
    <div class="grid2"><div id="fe6Sel"></div><div><table class="am-kv fe-calc"><tbody>
      <tr><td>Company PLC standard</td><td><select id="fe6Brand">${["Siemens", "Rockwell (Allen-Bradley)", "Beckhoff", "Mitsubishi", "Omron", "Delta", "Mixed / other"].map((b) => `<option>${b}</option>`).join("")}</select></td></tr>
      <tr><td>Company rule: only Ethernet + Modbus TCP + HTTP between systems</td><td><input type="checkbox" id="fe6Mb"></td></tr>
      <tr><td>Fast synchronised motion (&lt; 1 ms, many axes)</td><td><input type="checkbox" id="fe6Mo"></td></tr>
      <tr><td>Safety signals over the network wanted</td><td><input type="checkbox" id="fe6Sa"></td></tr>
      <tr><td>CNCs of several brands</td><td><input type="checkbox" id="fe6Cn" checked></td></tr>
      <tr><td>Dashboards / analytics / cloud users of the data</td><td><input type="checkbox" id="fe6Cl"></td></tr>
      <tr><td>ERP interface</td><td><select id="fe6Erp"><option>REST / JSON API</option><option>XML (B2MML / IDoc)</option><option>Files only (CSV)</option></select></td></tr></tbody></table></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>6C · Calculators – load, cycle time, polling, data volume</h2><span class="sub">first numbers for the network design · formulas shown</span></div>
    <div class="mx-nav" id="fe6Calc">${[["pn", "PROFINET load"], ["ec", "EtherCAT cycle"], ["mb", "Modbus TCP polling"], ["hi", "Historian / MQTT volume"]].map(([k, n], i) => `<button class="mx-el${i ? "" : " active"}" data-c="${k}">${n}</button>`).join("")}</div>
    <div class="grid2"><div id="fe6CIn"></div><div id="fe6COut"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>6D · IP address and VLAN plan</h2><span class="sub">one VLAN / subnet per zone and per cell · fixed address ranges per device type · export CSV</span></div>
    <div class="fe-row"><label>Site number (2nd octet) <input type="number" id="fe6Site" value="1" min="0" max="255"></label>
      <label>Cell kit <select id="fe6Kit">${Object.keys(KITS).map((k) => `<option>${esc(k)}</option>`).join("")}</select></label>
      <label>Cell code <input type="text" id="fe6Cell" value="FMS1" style="width:80px"></label>
      <label>Cell VLAN <input type="number" id="fe6Vlan" value="101" min="2" max="4094"></label>
      <button class="mx-el" id="fe6Csv">Export CSV</button></div>
    <div class="grid2"><div id="fe6Dev" class="fe-scroll"></div><div id="fe6Zon"></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>6E · Network security – zones and conduits (IEC 62443)</h2><span class="sub">click a conduit · test a data flow · offline factory: nothing in a cell talks to the internet</span></div>
    <div class="grid2"><div><svg id="fe6Z" class="fe-chart" viewBox="0 0 680 460" role="img" aria-label="Zones and conduits"></svg><div id="fe6ZD"></div></div>
      <div><h3 class="fe-h3">Is this flow allowed?</h3><select id="fe6Flow" style="max-width:100%">${FLOWS.map((f, i) => `<option value="${i}">${esc(f[0])} → ${esc(f[1])} (${esc(f[2])})</option>`).join("")}</select><div id="fe6FR"></div>
        <h4>Basic rules</h4><ul class="am-ul"><li>Default deny – every allowed flow is written in the conduit list (source, destination, port, reason, owner).</li>
          <li>Conduits only between neighbouring zones; office → cell never direct.</li><li>Remote service: jump host in the DMZ, MFA, time-limited, recorded.</li>
          <li>Write access to modules only through the cell controller; safety parameters never remote.</li><li>Accounts per person (no shared passwords), USB control, back-ups of every PLC / CNC / robot, patch plan.</li>
          <li>Security level per zone (SL1 casual … SL4 state-level attacker); cells usually SL2, safety SL3.</li></ul></div></div>
  </div>

  <div class="card"><div class="card-head"><h2>6F · The standard module data block – the same data on every protocol</h2><span class="sub">communication face of the module standard · words 0–19 identical in every module, 20+ module-specific</span></div>
    <div class="fe-row"><label>Module <select id="fe6Mod">${Object.keys(UNIT).filter((k) => !["M20", "M21", "M22"].includes(k)).map((k) => `<option value="${k}">${k} · ${esc(MODN[k])}</option>`).join("")}</select></label>
      <label>Unit tag <input type="text" id="fe6Unit" value="MC02" style="width:80px"></label>
      <span class="sub">Protocol</span><div class="mx-nav fe-inline" id="fe6P">${[["mb", "Modbus TCP"], ["pn", "PROFINET IO"], ["ua", "OPC UA"], ["mq", "MQTT Sparkplug B"]].map(([k, n], i) => `<button class="mx-el${i ? "" : " active"}" data-p="${k}">${n}</button>`).join("")}</div>
      <label id="fe6BaseL">Base register <input type="number" id="fe6Base" value="0" min="0" step="100"></label></div>
    <div id="fe6Map" class="fe-scroll"></div><div id="fe6MapN"></div>
  </div>`;

  initSel(); initCalc(); initIP(); initZones(); initMap();
  // 6G–6N: deep sections (guides + programs) live in fmse6x.js; they reuse UNIT and CALC exported here
  const deepEl = document.createElement("div"); deepEl.id = "feItem6x"; el.appendChild(deepEl);
  import("./fmse6x.js").then((m) => m.mount(deepEl)).catch((e) => { deepEl.innerHTML = `<div class="card"><p class="fe-no">Sections 6G–6N could not load: ${esc(e.message)}</p></div>`; });
}

/* ================================================================== 6B selector */
function initSel() { ["fe6Brand", "fe6Mb", "fe6Mo", "fe6Sa", "fe6Cn", "fe6Cl", "fe6Erp"].forEach((id) => $(id).addEventListener("input", drawSel)); drawSel(); }
function drawSel() {
  const b = $("fe6Brand").value, mb = $("fe6Mb").checked, mo = $("fe6Mo").checked, sa = $("fe6Sa").checked, cn = $("fe6Cn").checked, cl = $("fe6Cl").checked, erp = $("fe6Erp").value;
  const FB = { Siemens: "PROFINET RT", "Rockwell (Allen-Bradley)": "EtherNet/IP", Beckhoff: "EtherCAT", Mitsubishi: "CC-Link IE", Omron: "EtherNet/IP (EtherCAT for motion)", Delta: "EtherCAT / Modbus TCP", "Mixed / other": "PROFINET or EtherNet/IP (choose one plant-wide)" }[b];
  const SAFE = { Siemens: "PROFIsafe", "Rockwell (Allen-Bradley)": "CIP Safety", Beckhoff: "FSoE (Safety over EtherCAT)", Mitsubishi: "CC-Link IE Safety", Omron: "FSoE / CIP Safety", Delta: "FSoE", "Mixed / other": "PROFIsafe or CIP Safety (with the chosen bus)" }[b];
  const MO = { Siemens: "PROFINET IRT", "Rockwell (Allen-Bradley)": "CIP Motion", Beckhoff: "EtherCAT (distributed clocks)", Mitsubishi: "CC-Link IE TSN / SSCNET", Omron: "EtherCAT", Delta: "EtherCAT", "Mixed / other": "EtherCAT" }[b];
  const rows = [
    ["Sensors / actuators → IO", "IO-Link + simple 24 V IO", "Diagnosis and parameters down to the sensor; one cable type"],
    ["PLC ⇄ remote IO, valves, drives (inside a module)", mb ? `Machine builder's choice (e.g. ${FB}) – stays inside the module` : FB, mb ? "The company rule applies between systems; inside a machine the builder uses his standard bus" : "Company PLC standard → same tools, spare parts and skills"],
    ["Fast motion", mo ? MO : "Not needed – normal fieldbus / drive bus", mo ? "Sub-millisecond synchronisation of many axes" : ""],
    ["Safety between modules", sa && !mb ? SAFE : "Hard-wired dual-channel signals + safety PLC / relays", sa && !mb ? "Fewer wires, diagnostics; certified devices + validation" : "Simple, independent of networks; required if only Modbus TCP is allowed"],
    ["Module ⇄ cell controller (states, jobs, handshakes)", mb ? "Modbus TCP – standard data block (6F)" : `OPC UA (jobs, data) + ${FB.split(" (")[0]} PLC-PLC coupling for fast handshakes`, mb ? "Register map identical in every module; heartbeat words; word order written in the interface sheet" : "OPC UA gives a model; fieldbus coupling gives ms-level handshake"],
    ["CNC → cell controller / MES", mb ? "CNC → Modbus TCP gateway or HTTP agent (MTConnect-style JSON)" : cn ? "umati (OPC UA for machine tools) or MTConnect" : "CNC maker's OPC UA server", cn ? "One vocabulary for all CNC brands" : "Fewer adapters with one brand"],
    ["SCADA ⇄ PLCs", mb ? "Modbus TCP (read; writes only via the cell controller)" : "OPC UA (or native driver of the PLC brand)", "One owner of write commands: the cell controller"],
    ["MES ⇄ ERP", erp.startsWith("REST") ? "HTTP REST / JSON (orders down, confirmations up), B2MML content" : erp.startsWith("XML") ? "XML messages (B2MML / IDoc) via an integration service" : "File exchange (CSV) through a DMZ folder with checksums – plan an upgrade to REST", "ISA-95 objects: production order, material, performance"],
    ["Data to historian / dashboards / cloud", cl ? (mb ? "HTTP (SSE / REST) gateway → historian; MQTT only from the DMZ outwards" : "MQTT + Sparkplug B via a broker in the DMZ (unified namespace)") : "OPC UA → historian on level 3", cl ? "Many consumers without loading the PLCs; one outgoing connection" : "Keep it simple until there are consumers"],
  ];
  $("fe6Sel").innerHTML = `<table class="am-tab"><thead><tr><th>Link</th><th>Recommended</th><th>Why</th></tr></thead><tbody>${rows.map(([a, c, w]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(c)}</td><td class="sub">${esc(w)}</td></tr>`).join("")}</tbody></table>`;
}

/* ================================================================== 6C calculators */
export const CALC = {   // reused by 6N (fmse6x.js)
  pn: { v: { ...PN0 }, inp: [["dev", "Devices (IO stations, drives …)", ""], ["io", "Cyclic IO data per device and direction", "bytes"], ["cyc", "Update time", "ms"], ["spd", "Link speed", "Mbit/s"]],
    run(v) { const frame = Math.max(64, v.io + 10 + 22), wire = frame + 20, bps = v.dev * wire * 8 / (v.cyc / 1000), load = bps / (v.spd * 1e6);
      return [["Frame = max(64, data + 10 PN header + 22 Ethernet / VLAN / FCS)", frame, "bytes", 0], ["On the wire (+ 8 preamble + 12 gap)", wire, "bytes", 0], ["Bandwidth per direction = devices × wire × 8 ÷ cycle", bps / 1e6, "Mbit/s", 2], ["Cyclic load on the controller port", load * 100, "%", 1],
        ["Verdict", 0, load < 0.5 ? "OK – below 50 % (guideline for cyclic real-time traffic)" : "Too high – longer update time, fewer devices per port, 1 Gbit/s backbone, or split into lines", -1]]; } },
  ec: { v: { ...EC0 }, inp: [["dev", "Slaves", ""], ["bytes", "Process data per slave (in + out)", "bytes"], ["spd", "Link speed", "Mbit/s"], ["fwd", "Forwarding delay per slave", "µs"]],
    run(v) { const bytes = Math.max(84, 14 + 2 + 12 + v.dev * v.bytes + 4 + 20), tw = bytes * 8 / v.spd, t = tw + v.dev * v.fwd, cmin = t * 1.25;
      return [["Frame = Ethernet + EtherCAT header + datagram + data (all slaves in one frame)", bytes, "bytes", 0], ["Time on the wire = bytes × 8 ÷ speed", tw, "µs", 1], ["+ forwarding delay of all slaves", v.dev * v.fwd, "µs", 1], ["Frame round trip", t, "µs", 1], ["Shortest cycle (+ 25 % master margin)", cmin, "µs", 0],
        ["Verdict", 0, cmin < 250 ? "Fast enough for motion at 250 µs" : cmin < 1000 ? "1 ms cycle possible" : "Use several frames / segments or a longer cycle", -1]]; } },
  mb: { v: { ...MB0 }, inp: [["dev", "Devices (servers) to poll", ""], ["regs", "Registers per device", "words"], ["resp", "Device response time", "ms"], ["rtt", "Network round trip", "ms"], ["conn", "Parallel connections of the client", ""]],
    run(v) { const req = Math.ceil(v.regs / 125), tr = v.rtt + v.resp, cyc = Math.ceil(v.dev / Math.max(1, v.conn)) * req * tr, rq = 12, rs = 9 + 2 * Math.min(v.regs, 125);
      return [["Requests per device = ⌈registers ÷ 125⌉ (FC03 limit)", req, "", 0], ["Time per transaction = RTT + device response", tr, "ms", 1], ["Poll cycle = ⌈devices ÷ connections⌉ × requests × transaction", cyc, "ms", 0], ["Updates per second per device", 1000 / cyc, "/s", 1], ["Request / response size (TCP payload)", rq, `bytes / ${rs} bytes`, 0],
        ["Verdict", 0, cyc <= 100 ? "Good for states and handshakes (≤ 100 ms)" : cyc <= 500 ? "OK for monitoring, slow for handshakes – more parallel connections" : "Too slow – poll in parallel, read only changed blocks, or use a faster protocol for handshakes", -1]]; } },
  hi: { v: { ...HI0 }, inp: [["tags", "Tags", ""], ["rate", "Samples per second per tag", "/s"], ["bytes", "Bytes per stored value (time + value + quality)", "bytes"], ["days", "Keep history", "days"], ["comp", "Share really stored (deadband / compression)", ""]],
    run(v) { const vps = v.tags * v.rate, net = vps * v.bytes * 8 / 1000, day = vps * v.bytes * 86400 * v.comp / 1e9;
      return [["Values per second = tags × rate", vps, "/s", 0], ["Network (before compression)", net, "kbit/s", 0], ["Storage per day", day, "GB", 2], ["Storage for the whole period", day * v.days, "GB", 0],
        ["Verdict", 0, day * v.days < 500 ? "Fits a normal server disk (plan × 2 for back-up)" : "Large – lower rates for slow signals, deadband, aggregate old data", -1]]; } },
};
let calcK = "pn";
function initCalc() {
  $("fe6Calc").addEventListener("click", (e) => { const b = e.target.closest("[data-c]"); if (b) { calcK = b.dataset.c; document.querySelectorAll("#fe6Calc [data-c]").forEach((x) => x.classList.toggle("active", x === b)); drawCalcIn(); } });
  $("fe6CIn").addEventListener("input", (e) => { const t = e.target; if (t.dataset.v) { CALC[calcK].v[t.dataset.v] = +t.value; drawCalcOut(); } });
  drawCalcIn();
}
function drawCalcIn() { const c = CALC[calcK]; $("fe6CIn").innerHTML = `<table class="am-kv fe-calc"><tbody>${c.inp.map(([k, n, u]) => `<tr><td>${esc(n)}</td><td><input type="number" step="any" data-v="${k}" value="${c.v[k]}"> ${esc(u)}</td></tr>`).join("")}</tbody></table>`; drawCalcOut(); }
function drawCalcOut() { const r = CALC[calcK].run(CALC[calcK].v); $("fe6COut").innerHTML = `<table class="am-kv"><tbody>${r.map(([n, x, u, d]) => `<tr><td>${esc(n)}</td><td><b>${d < 0 ? esc(u) : f1(x, d) + " " + esc(u)}</b></td></tr>`).join("")}</tbody></table>`; }

/* ================================================================== 6D IP plan */
let devRows = [];
function initIP() { ["fe6Site", "fe6Kit", "fe6Cell", "fe6Vlan"].forEach((id) => $(id).addEventListener("input", drawIP)); $("fe6Csv").addEventListener("click", () => download(`ip_plan_${$("fe6Cell").value}.csv`, "Tag;Device;Module;IP;Subnet;Gateway;VLAN\n" + devRows.map((r) => r.join(";")).join("\n"), "text/csv")); drawIP(); }
function drawIP() {
  const site = Math.max(0, Math.min(255, +$("fe6Site").value || 0)), vlan = +$("fe6Vlan").value || 101, cell = ($("fe6Cell").value || "CELL").replace(/[^A-Za-z0-9]/g, "");
  const kit = KITS[$("fe6Kit").value], third = vlan % 256, net = `10.${site}.${third}.0/24`, gw = `10.${site}.${third}.1`;
  const next = RANGES.map((r) => r[0]), cnt = {}; devRows = [];
  kit.forEach((m) => {
    cnt[m] = (cnt[m] || 0) + 1; const unit = UNIT[m] + String(cnt[m]).padStart(2, "0");
    (MODDEV[m] || []).forEach(([dn, g]) => { const ip = next[g]++; devRows.push([`${cell}.${unit}`, dn, m, ip <= RANGES[g][1] ? `10.${site}.${third}.${ip}` : "range full!", net, gw, vlan]); });
  });
  $("fe6Dev").innerHTML = `<table class="am-tab"><thead><tr><th>Tag</th><th>Device</th><th>Module</th><th>IP address</th></tr></thead><tbody>${devRows.map((r) => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td><td>${r[2]}</td><td><code>${esc(r[3])}</code></td></tr>`).join("")}</tbody></table>`;
  $("fe6Zon").innerHTML = `<h3 class="fe-h3">Zones / VLANs</h3><table class="am-tab"><thead><tr><th>VLAN</th><th>Zone</th><th>Subnet</th><th>Content</th></tr></thead><tbody>
      ${ZONES.map(([v, n, c]) => `<tr><td>${v}</td><td>${esc(n)}</td><td><code>10.${site}.${v}.0/24</code></td><td class="sub">${esc(c)}</td></tr>`).join("")}
      <tr class="fe-sel"><td>${vlan}</td><td>Cell ${esc(cell)} (L1–2)</td><td><code>${net}</code></td><td class="sub">${devRows.length} devices, gateway ${gw} (firewall)</td></tr></tbody></table>
    <h4>Address ranges in every cell subnet</h4><table class="am-kv"><tbody>${RANGES.map(([a, b, n]) => `<tr><td>.${a} – .${b}</td><td>${esc(n)}</td></tr>`).join("")}</tbody></table>
    <p class="sub">.1 = gateway / firewall of the cell. Same last octet for the same device type in every cell makes service easy. Real-time fieldbus traffic (PROFINET / EtherCAT) stays inside the machine or the cell VLAN – never routed.</p>`;
}

/* ================================================================== 6E zones */
let condSel = 2;
function initZones() {
  $("fe6Z").addEventListener("click", (e) => { const g = e.target.closest("[data-cd]"); if (g) { condSel = +g.dataset.cd; drawZones(); } });
  $("fe6Flow").addEventListener("input", drawFlow); drawZones(); drawFlow();
}
function drawZones() {
  const B = Object.fromEntries(ZBOX.map((z) => [z[0], z]));
  const c = (id) => { const z = B[id]; return [z[2] + z[4] / 2, z[3] + z[5] / 2]; };
  let s = "";
  CONDUITS.forEach(([a, b], i) => { const [x1, y1] = c(a), [x2, y2] = c(b), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    s += `<g data-cd="${i}" class="fe-cd${i === condSel ? " fe-msel" : ""}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><rect x="${mx - 13}" y="${my - 10}" width="26" height="20" rx="4"/><text class="fe-tick" x="${mx}" y="${my + 4}" text-anchor="middle">FW</text></g>`; });
  ZBOX.forEach(([id, n, x, y, w, h, sl, mem]) => { s += `<g class="fe-zb fe-zb-${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8"/><text class="fe-mn" x="${x + 10}" y="${y + 20}" font-weight="600">${esc(n)}</text><text class="fe-tick" x="${x + 10}" y="${y + 38}">${esc(mem)}</text><text class="fe-tick" x="${x + w - 10}" y="${y + h - 8}" text-anchor="end">${sl}</text></g>`; });
  s += `<text class="fe-tick" x="360" y="400">FW = firewall on the conduit (default deny).</text><text class="fe-tick" x="360" y="416">Click a conduit for its allowed flows.</text>`;
  $("fe6Z").innerHTML = s;
  const [a, b, fl] = CONDUITS[condSel], N = (id) => B[id][1];
  $("fe6ZD").innerHTML = `<p><b>Conduit ${esc(N(a))} ⇄ ${esc(N(b))}:</b> ${esc(fl)}</p>`;
}
function drawFlow() {
  const f = FLOWS[+$("fe6Flow").value];
  $("fe6FR").innerHTML = `<p class="fe-big ${f[3] ? "fe-ok" : "fe-no"}">${f[3] ? "✓ Allowed" : "✗ Blocked"}</p><p>${esc(f[4])}</p>`;
}

/* ================================================================== 6F data block mapping */
let proto = "mb";
const UATYPE = { INT: "Int16", DINT: "Int32", REAL: "Float", WORD: "UInt16", UINT: "UInt16" };
function initMap() {
  $("fe6P").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { proto = b.dataset.p; document.querySelectorAll("#fe6P [data-p]").forEach((x) => x.classList.toggle("active", x === b)); drawMap(); } });
  $("fe6Mod").addEventListener("input", () => { const m = $("fe6Mod").value; $("fe6Unit").value = UNIT[m] + "01"; drawMap(); });
  ["fe6Unit", "fe6Base"].forEach((id) => $(id).addEventListener("input", drawMap));
  $("fe6Mod").value = "M01"; drawMap();
}
function drawMap() {
  const m = $("fe6Mod").value, unit = ($("fe6Unit").value || "UNIT").replace(/[^A-Za-z0-9]/g, ""), base = Math.max(0, +$("fe6Base").value || 0);
  const rows = [...BLOCK.map((r) => [...r, true]), ...(EXTRA[m] || []).map((r) => [...r, false])];
  const words = (t) => (/DINT|REAL/.test(t) ? 2 : /STRING\[20\]/.test(t) ? 10 : 1);
  $("fe6BaseL").style.display = proto === "mb" || proto === "pn" ? "" : "none";
  $("fe6BaseL").firstChild.textContent = proto === "pn" ? "Start byte address " : "Base register ";
  let head, body;
  if (proto === "mb") {
    head = "<th>Word</th><th>Holding register (1-based)</th><th>PDU address (0-based)</th><th>Name</th><th>Type</th><th>Access by cell controller</th><th>Meaning</th>";
    body = rows.map(([o, n, t, d, mn, std]) => `<tr${std ? "" : ' class="fe-sel"'}><td>${o}${words(t) > 1 ? "–" + (o + words(t) - 1) : ""}</td><td><code>4${String(base + o + 1).padStart(4, "0")}</code></td><td>${base + o}</td><td><code>${esc(n)}</code></td><td>${esc(t)}</td><td>${d === "in" ? "write (FC06 / FC16)" : d === "out" ? "read (FC03)" : "read + write"}</td><td class="sub">${esc(mn)}</td></tr>`).join("");
  } else if (proto === "pn") {
    head = "<th>Name</th><th>Type</th><th>Controller area</th><th>Byte address</th><th>Meaning</th>";
    let ib = base, qb = base;
    body = rows.map(([o, n, t, d, mn, std]) => { const len = 2 * words(t); let addr; if (d === "out") { addr = `%IB${ib}…${ib + len - 1}`; ib += len; } else if (d === "in") { addr = `%QB${qb}…${qb + len - 1}`; qb += len; } else { addr = `%IB${ib} / %QB${qb}`; ib += len; qb += len; }
      return `<tr${std ? "" : ' class="fe-sel"'}><td><code>${esc(n)}</code></td><td>${esc(t)}</td><td>${d === "out" ? "Input (module → controller)" : d === "in" ? "Output (controller → module)" : "both"}</td><td><code>${addr}</code></td><td class="sub">${esc(mn)}</td></tr>`; }).join("");
  } else if (proto === "ua") {
    head = "<th>Browse path</th><th>NodeId</th><th>Data type</th><th>Access</th><th>Meaning</th>";
    body = rows.map(([o, n, t, d, mn, std]) => { const [grp, nm] = n.includes(".") ? n.split(".") : ["Data", n]; return `<tr${std ? "" : ' class="fe-sel"'}><td><code>Objects/${esc(unit)}/${esc(grp)}/${esc(nm)}</code></td><td><code>ns=2;s=${esc(unit)}.${esc(n)}</code></td><td>${esc(UATYPE[t] || (t.startsWith("STRING") ? "String" : "UInt16"))}</td><td>${d === "in" ? "Read/Write" : d === "out" ? "Read (subscribe)" : "Read/Write"}</td><td class="sub">${esc(mn)}</td></tr>`; }).join("");
  } else {
    head = "<th>Metric name</th><th>Topic</th><th>Data type</th><th>Meaning</th>";
    body = rows.map(([o, n, t, d, mn, std]) => `<tr${std ? "" : ' class="fe-sel"'}><td><code>${esc(n.replace(".", "/"))}</code></td><td><code>spBv1.0/FMS1/${d === "in" ? "DCMD" : "DDATA"}/CC1/${esc(unit)}</code></td><td>${esc(UATYPE[t] || (t.startsWith("STRING") ? "String" : "UInt16"))}</td><td class="sub">${esc(mn)}</td></tr>`).join("");
  }
  $("fe6Map").innerHTML = `<table class="am-tab"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  const notes = {
    mb: `<p><b>Example frame</b> – cell controller reads words 0–19 of this module (unit id 1): <code>00 01 00 00 00 06 01 03 ${hex4(base)} 00 14</code> (transaction 1, protocol 0, length 6, unit 1, FC03, start ${base}, quantity 20). Response: <code>… 01 03 28</code> + 40 data bytes.</p>
      <p class="am-note"><b>Write into every interface sheet:</b> register numbering (1-based 4xxxx or 0-based), <b>32-bit word order</b> (this standard: high word first = big-endian, "ABCD"), REAL = IEEE 754, bit numbering (bit 0 = LSB), time-out (500 ms) and heartbeat check (3 s). Wrong word order is the most common Modbus commissioning error.</p>`,
    pn: `<p class="am-note">The module's outputs are the controller's <b>inputs</b> (%I) and the other way round. For PLC-to-PLC coupling use an I-device or a PN/PN coupler with exactly this byte layout; byte order on PROFINET is big-endian.</p>`,
    ua: `<p class="am-note">Use the PackML / companion-spec object types where they exist (e.g. umati for CNC, PackML companion spec). Security mode <b>Sign &amp; Encrypt</b> with certificates; the cell controller subscribes to Status (100–500 ms sampling) and writes Command / Job.</p>`,
    mq: `<p>Example DDATA payload (shown as JSON; Sparkplug B uses protobuf on the wire): <code>{"timestamp":1763112000000,"metrics":[{"name":"Status/StateCurrent","value":6},{"name":"Admin/ProdProcessedCount","value":1412}],"seq":17}</code></p>
      <p class="am-note">MQTT carries data <b>out</b> (historian, dashboards). Commands (DCMD) to machines only if your safety and security concept allows it – normally commands go through the cell controller on OPC UA / Modbus.</p>`,
  };
  $("fe6MapN").innerHTML = notes[proto] + `<p class="sub">Highlighted rows = module-specific part (from word 20)${EXTRA[m] ? "" : " – none defined yet for this module; added with the PLC library (item 10)"}.</p>`;
}
const hex4 = (n) => { const h = (n & 0xffff).toString(16).toUpperCase().padStart(4, "0"); return h.slice(0, 2) + " " + h.slice(2); };
