/* Ball screw + guide factory – item 8 "PLC control programs" (#bfItem8).  Guide: docs/47_bsf_plc_programs.md
 * Live ladder (LAD) of six programs, Delta AS332T-A (ISPSoft) and Siemens S7-1200 / S7-1500 (TIA Portal) side by side, shared core web/ladder.js.
 * Every program = machine networks + the STANDARD MACHINE INTERFACE (bsfplc_lib.js buildIF: status word, counters, heartbeat, MES order handshake,
 * Modbus holding-register image of item 4's map V1.1, 227 registers 0 – 226). A simulated gateway (Modbus TCP client) polls the image and sends MES orders – the registers
 * update live next to the ladder. Files: bsfplc.js (page, self-check) · bsfplc_lib.js · bsfplc_p1 … p6.js (programs + plant models) ·
 * bsfplc_data.js (PLC selection for all 41 machine types, BOM, commissioning) · bsfplc_card.js (catalogue card) · bsfplc.css.
 * Lazy: built on window event "bfitemshow" (detail "8"). URL: /?bfitem=8#bsf · &bf8prog=std|ind|str|tgr|trq|run · &ladview=delta|siemens|both ·
 *   &bf8test (self-check, console "BF8TEST …" + #bf8Debug) · &bf8hold (headless: keep the load pending, show the item) · &bf8dump (console listings
 *   for the guide) · card: &bf8tab=draw|buy|shop. Offline. ALL ADDRESSES AND VALUES ARE EXAMPLES – check with your PLC configuration. */
import { mountLadder, createEngine, checkProgram, ilText, genSCL, ioRows } from "./ladder.js";
import { makeCard } from "./robotref.js";
import { assemble, statusWord, STATUS_TXT, HS_TXT, realToRegs, regsToReal, MAPV, typeCode } from "./bsfplc_lib.js";
import { adu, hex } from "./bsfcomm_map.js";
import * as P1 from "./bsfplc_p1.js";
import * as P2 from "./bsfplc_p2.js";
import * as P3 from "./bsfplc_p3.js";
import * as P4 from "./bsfplc_p4.js";
import * as P5 from "./bsfplc_p5.js";
import * as P6 from "./bsfplc_p6.js";
import { PLC_ROWS, plcBom, CHECKLIST, ARCH, SERVER_SETUP } from "./bsfplc_data.js";
import { CARD8 } from "./bsfplc_card.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const host = $("bfItem8");
const errs = [];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PROGS = [P1, P2, P3, P4, P5, P6];
const h4 = (v) => "0x" + (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
if (Q.has("bf8test")) { window.addEventListener("error", (e) => errs.push(e.message || String(e))); window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason))); }
if (Q.has("bf8hold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?bf8hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("bsf"); else { const b = document.querySelector('[data-tab="bsf"]'); if (b) b.click(); } if (window.bfCtl) window.bfCtl.showItem("8"); }, 300); }

let built = false, ctl = null, cur = null, A = null, lastPaint = 0, prevHR = null, flash = new Map();

/* ------------------------------------------------------------------ static HTML */
function headerHtml() {
  return `
  <div class="card">
    <div class="card-head"><h2>PLC control programs – Delta + Siemens, live ladder with the Modbus register image</h2>
      <span class="sub">Delta AS332T-A (ISPSoft) · Siemens S7-1200 CPU 1215C / S7-1500 (TIA Portal) · Modbus TCP server in every PLC · all values are examples</span></div>
    <div class="bf8-grid3">
      <div><h3>What you see</h3>Six PLC programs of the factory in <b>ladder diagram (LAD)</b>, IEC 61131-3. Every program = the machine networks
        (step chain, interlocks, analog values) + the <b>standard machine interface</b> I1 – I14 (the same in every machine): status word, counters,
        cycle time, alarm code, heartbeat, gateway watchdog, MES order handshake and the filling of the <b>Modbus holding registers</b> of item 4's map.</div>
      <div><h3>How to read it</h3>Left rail → right: <span class="bf8-mono">–| |–</span> NO contact, <span class="bf8-mono">–|/|–</span> NC contact,
        P / N = edge (one scan), boxes = timers, counters, compare, MOVE, CALCULATE; coils ( ), (S), (R). <b>Green = energised.</b>
        Each network is drawn for <b>Delta</b> (X0.0, D4.0, T0) and <b>Siemens</b> (%I0.0, "MB_HR".std_status.%X0, IEC timers). Switch with Delta / Siemens / Both.</div>
      <div><h3>How to use it</h3>Choose a program. It runs at once: the plant model moves the machine, the <b>simulated gateway</b> (right) sees READY,
        writes an order (FC16) and toggles REQ (FC06) – watch ACK, BUSY, the counters and DONE in the register table. Click inputs, force sensors,
        tick "gateway lost", send commands by hand. Guide: <code>docs/47_bsf_plc_programs.md</code>.</div>
    </div>
    <p class="bf8-safe"><b>Safety rule:</b> the standard ladder program never does the safety function itself (e-stop, guard locking, STO, safe
      generator off). That is the job of the hard-wired <b>safety relay</b> (Pilz PNOZ, Schmersal SRB-E, Phoenix PSRmini) or the <b>F-program</b> of a
      fail-safe CPU – ISO 13849-1, IEC 62061, IEC 60204-1 §9.4. The programs here only <b>read</b> the safety status. Safety is never sent over Modbus or HTTP.</p>
    <div class="bf8-progs" role="tablist">${PROGS.map((p) => `<button type="button" data-prog="${p.KEY}" role="tab">${esc(p.BTN)}</button>`).join("")}</div>
    <div id="bf8Info"></div>
  </div>`;
}
function liveHtml() {
  return `
  <div class="card" id="bf8Live">
    <div class="card-head"><h2>Live ladder + Modbus holding registers</h2><span class="sub">plant model · ladder (Run / Stop / 1 scan / Reset) · register image 0 – 226 of the map V1.1 · simulated gateway · example</span></div>
    <div class="bf8-plant" id="bf8Plant"></div>
    <div class="bf8-live">
      <div class="bf8-lad" id="bf8LadHost"></div>
      <aside class="bf8-side">
        <div class="bf8-box"><div class="bf8-bh">Status word <span id="bf8SwVal" class="bf8-mono"></span></div><div id="bf8Sw" class="bf8-chips"></div>
          <div class="bf8-bh">hs.status <span id="bf8HsVal" class="bf8-mono"></span></div><div id="bf8Hs" class="bf8-chips"></div></div>
        <div class="bf8-box"><div class="bf8-bh">Gateway (simulated Modbus TCP client)</div>
          <div class="bf8-gw">
            <label><input type="checkbox" id="bf8Auto" checked> auto MES orders</label>
            <label><input type="checkbox" id="bf8Lost"> gateway lost</label>
            <label title="an old V1.0 gateway: it still polls, but never writes register 226 – the PLC watchdog reports 'gateway lost' after 5 s"><input type="checkbox" id="bf8NoHb"> no heartbeat 226 (V1.0 gateway)</label>
            <label>qty <input type="number" id="bf8Qty" min="0" max="200000" value="4" class="bf8-num"></label>
            <label>recipe <input type="number" id="bf8Rec" min="0" max="999" value="12" class="bf8-num"></label>
          </div>
          <div class="bf8-cmds">
            <button type="button" class="btn" data-cmd="1">1 load order</button><button type="button" class="btn" data-cmd="2">2 start</button>
            <button type="button" class="btn" data-cmd="3">3 stop</button><button type="button" class="btn" data-cmd="4">4 ack alarm</button>
            <button type="button" class="btn" data-cmd="5">5 recipe</button><button type="button" class="btn" data-cmd="9">9 (unknown)</button>
          </div>
          <div class="bf8-log" id="bf8Log"></div>
          <div class="bf8-frame"><b>FC03 response, fast block 0 – 11</b><code id="bf8Frame"></code></div>
        </div>
        <div class="bf8-box"><div class="bf8-bh">Holding registers (0-based) <span class="bf8-sub2" id="bf8RegHdr"></span></div>
          <div class="bf8-regs" id="bf8Regs"></div></div>
      </aside>
    </div>
  </div>`;
}
function tbl(cols, rows, cls = "") {
  return `<div class="table-wrap"><table class="bf8-tbl ${cls}"><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function detailsHtml() {
  return `<div class="card" id="bf8Detail"><div class="card-head"><h2>Program details – I/O, wiring, timing, safety</h2><span class="sub" id="bf8DetSub"></span></div><div id="bf8Det"></div></div>`;
}
function overviewHtml() {
  const B = plcBom();
  return `
  <div class="card" id="bf8Over">
    <div class="card-head"><h2>PLC selection for all 41 machine types + PLC bill of materials</h2><span class="sub">73 machines · which control, I/O estimate, Modbus TCP server type · prices = estimate – ask for a quote</span></div>
    <p class="bf8-p">Rule of the plant (guide 43): every machine offers a <b>Modbus TCP server</b> with the map V1.1. Bought CNC machines bring the maker's control –
      the maker implements the map in the CNC's PLC (purchase specification, guide 43 §8.6). Our own stations, presses, test stands and benches get <b>our PLC</b>:
      Delta AS332T-A (lower cost, ISPSoft free) or Siemens S7-1200 (wide service network, TIA Portal) – one family per plant is cheaper to maintain.
      The induction lines get an <b>S7-1500 F-CPU</b> (integrated safety for generator + door + servo STO, more motion and memory) or a Delta AS + safety controller.</p>
    ${tbl(["Type", "Machine", "Qty", "Control", "PLC (Delta / Siemens)", "DI / DO / AI / AO (estimate)", "Modbus TCP server", "Program here"], PLC_ROWS.map((r) => [`<b>${esc(r.type)}</b>`, esc(r.n), r.qty, esc(r.ctl), esc(r.plc), r.io.join(" / "), esc(r.srv), r.prog ? `<a href="#" data-goprog="${r.prog}">${esc(r.prog)}</a>` : "–"]), "bf8-small")}
    <h3 class="bf8-h3">PLC bill of materials – our PLCs only (CNC machines excluded), two options</h3>
    ${tbl(["Option", "PLCs", "CPUs", "I/O modules", "24 V PSU", "safety relays", "HMI", "Total (estimate)"], B.rows.map((r) => [`<b>${esc(r.opt)}</b>`, r.n, esc(r.cpu), esc(r.mod), esc(r.psu), esc(r.saf), esc(r.hmi), `<b>${esc(r.total)}</b>`]))}
    <p class="bf8-note">${esc(B.note)}</p>
    <h3 class="bf8-h3">How one machine is connected</h3>
    <figure class="bf8-fig"><img class="bf8-img" src="img/47_machine_connection.svg" alt="sensors to PLC to Modbus TCP to gateway to HTTP to MES" loading="lazy" width="1200" height="830">
      <figcaption>Sensors / actuators (24 V, 4 – 20 mA) → PLC (program + Modbus TCP server, port 502) → managed switch, machine VLAN → gateway (Modbus TCP client, polls 100 ms – 10 s) → HTTP REST + SSE → MES / twin / andon. Safety: hard-wired to the safety relay, never over the network.</figcaption></figure>
    ${tbl(["Level", "What", "Who / what talks", "Protocol"], ARCH.map((r) => r.map(esc)), "bf8-small")}
  </div>`;
}
function serverHtml() {
  return `
  <div class="card" id="bf8Srv">
    <div class="card-head"><h2>Modbus TCP server in the PLC – Delta AS and Siemens MB_SERVER</h2><span class="sub">how the 227 registers (0 – 226) of item 4's map V1.1 live in the PLC memory · check with the PLC manual</span></div>
    <div class="bf8-two">
      <div><h3 class="bf8-h3">Delta AS332T-A – built-in Modbus TCP server</h3>${tbl(["Point", "Setting / rule"], SERVER_SETUP.delta.map((r) => r.map(esc)), "bf8-small")}</div>
      <div><h3 class="bf8-h3">Siemens S7-1200 / S7-1500 – MB_SERVER</h3>${tbl(["Point", "Setting / rule"], SERVER_SETUP.siemens.map((r) => r.map(esc)), "bf8-small")}</div>
    </div>
    <h3 class="bf8-h3">REAL into 2 registers, word order ABCD – worked example</h3>
    <p class="bf8-p" id="bf8Real"></p>
  </div>`;
}
function checklistHtml() {
  return `
  <div class="card" id="bf8Chk">
    <div class="card-head"><h2>Commissioning checklist – Modbus interface of one machine</h2><span class="sub">tick while you test (kept only in this browser) · guide 47 §16</span></div>
    ${tbl(["#", "Test", "How", "Expected (example)", "OK"], CHECKLIST.map((r, i) => [String(i + 1), `<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2]), `<input type="checkbox" data-chk="${i}" aria-label="done">`]), "bf8-small")}
  </div>`;
}

/* ------------------------------------------------------------------ program info + details */
function infoHtml(p) {
  const pr = A.program, w = checkProgram(pr);
  const nI = pr.tags.filter((t) => /^(I|AI)$/.test(t.dir) && !t.sys).length, nQ = pr.tags.filter((t) => /^(Q|AQ)$/.test(t.dir)).length;
  return `<p class="bf8-p"><b>${esc(pr.title)}</b> – ${pr.networks.length} networks (${A.meta.networks.length} machine + ${pr.networks.length - A.meta.networks.length} interface),
    ${nI} inputs, ${nQ} outputs · machine <b>${esc(p.MID)}</b> (type ${esc(p.TYPE)}, type code ${typeCode(p.TYPE)}, unit id ${A.img.unit}) · Delta ${esc(pr.plc.delta.cpu)} · Siemens ${esc(pr.plc.siemens.cpu)}<br>
    <span class="bf8-sub2">basis: ${esc(p.BASIS)}</span></p>
    <b class="bf8-small">What to try</b><ol class="bf8-try">${p.TRY.map((t) => `<li>${t}</li>`).join("")}</ol>
    ${w.length ? `<p class="bf8-warn">Program check: ${w.map(esc).join(" · ")}</p>` : `<p class="bf8-ok">Program check: no double coils, addresses OK.</p>`}`;
}
function detHtml(p) {
  const n = p.NOTES, rows = ioRows(A.program).filter((r) => /^(I|Q|AI|AQ)$/.test(r[1]));
  return `<div class="bf8-two">
      <div><h3 class="bf8-h3">I/O list – Delta + Siemens addresses</h3>${tbl(["Tag", "Dir", "Delta", "Siemens", "Comment", "Wiring / device", "Range"], rows.map((r) => r.map((c, i) => i < 4 ? `<span class="bf8-mono">${esc(c)}</span>` : esc(c))), "bf8-small")}
        <p class="bf8-note">${esc(n.io)}</p></div>
      <div><h3 class="bf8-h3">Timing (example)</h3>${tbl(["What", "Value"], n.timing.map((r) => r.map(esc)), "bf8-small")}
        ${n.wiring ? `<h3 class="bf8-h3">Wiring notes</h3><ul class="bf8-ul">${n.wiring.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <h3 class="bf8-h3">Safety</h3><p class="bf8-safe">${esc(n.safety)}</p>
        ${n.plcWhy ? `<h3 class="bf8-h3">PLC choice</h3><p class="bf8-p">${esc(n.plcWhy)}</p>` : ""}</div>
    </div>`;
}

/* ------------------------------------------------------------------ live panels */
const bar = (v, lo, hi, marks = []) => `<div class="bf8-bar"><i style="width:${Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1)}%"></i>${marks.map((m) => `<s style="left:${((m - lo) / (hi - lo) * 100).toFixed(1)}%"></s>`).join("")}</div>`;
const onoff = (b, t1, t0 = "off") => `<span class="${b ? "bf8-on" : ""}">${b ? t1 : t0}</span>`;
const gauge = (title, val, extra = "") => `<div class="bf8-g"><b>${title}</b><span class="v">${val}</span>${extra}</div>`;
function plantPanel(st) {
  const p = cur, info = A.plant.info ? A.plant.info() : {};
  const lot = `${A.img.HR[11]} / ${st.LOT_QTY || 0}`;
  const common = gauge("MES lot", `${esc(A.img.order || "–")}`, `<small>part ${esc(A.img.part || "–")} · done ${lot} · recipe ${st.RECIPE || 0} · ${onoff(st.HS_BUSY, "BUSY", "not busy")}</small>`)
    + gauge("Counters", `${st.GOOD || 0} good · ${st.SCRAP || 0} scrap`, `<small>last cycle ${(+st.LASTCYC || 0).toFixed(1)} s · energy ${(+st.E_KWH || 0).toFixed(3)} kWh</small>`);
  return (p.panel ? p.panel(st, info, { bar, onoff, gauge, esc }) : "") + common;
}
function paintRegs() {
  const img = A.img, HR = img.HR, now = performance.now();
  if (!prevHR) prevHR = HR.slice();
  for (let i = 0; i < HR.length; i++) if (HR[i] !== prevHR[i]) { flash.set(i, now); prevHR[i] = HR[i]; }
  const vals = img.values();
  const blk = { fast: "FAST 0 – 11 (100 – 500 ms)", counters: "COUNTERS + PROCESS 20 – 99 (1 s)", energy: "ENERGY 100 – 103 (10 s)", command: "COMMAND 200 – 226 (written by the gateway; 226 = gateway heartbeat, +1 per s)" };
  let last = "", html = "";
  for (const r of vals) {
    if (r.block !== last) { html += `<div class="bf8-rblk">${esc(blk[r.block] || r.block)}</div>`; last = r.block; }
    const hot = [...Array(r.n).keys()].some((k) => now - (flash.get(r.addr + k) || -1e9) < 700);
    let v = r.value; if (typeof v === "number" && r.type === "REAL") v = (+v).toFixed(3); if (r.name === "hdr.mapVersion") v = h4(+v) + ` = V${(+v) >> 8}.${(+v) & 255}`;
    if (r.name === "std.status") v = `${r.value} (${STATUS_TXT.filter((_, b) => r.value & (1 << b)).join(", ") || "–"})`;
    if (r.name === "hs.status") v = `${r.value} (${HS_TXT.filter((_, b) => r.value & (1 << b)).join(", ") || "–"})`;
    html += `<div class="bf8-r${hot ? " hot" : ""}"><span class="a">${r.addr}${r.n > 1 ? "–" + (r.addr + r.n - 1) : ""}</span><span class="n" title="${esc(r.meaning || "")}">${esc(r.name)}</span><span class="x">${r.raw.map(h4).join(" ")}</span><span class="d">${esc(v)}</span></div>`;
  }
  $("bf8Regs").innerHTML = html;
  $("bf8RegHdr").textContent = `type ${img.type} · unit ${img.unit} · ${vals.length} fields · ${HR.length} registers 0 – ${HR.length - 1} · gateway heartbeat 226 = ${HR[226]}`;
  $("bf8Sw").innerHTML = STATUS_TXT.map((t, b) => `<span class="bf8-chip${HR[4] & (1 << b) ? " on" : ""}">${b} ${esc(t)}</span>`).join("");
  $("bf8Hs").innerHTML = HS_TXT.map((t, b) => `<span class="bf8-chip${HR[8] & (1 << b) ? " on" : ""}">${b} ${esc(t)}</span>`).join("");
  $("bf8SwVal").textContent = `= ${HR[4]} (${h4(HR[4])})`; $("bf8HsVal").textContent = `= ${HR[8]} (${h4(HR[8])})`;
  const regs = HR.slice(0, 12), bytes = regs.flatMap((w) => [(w >> 8) & 255, w & 255]);
  $("bf8Frame").textContent = hex(adu(A.gw.polls & 0xffff, img.unit, [3, 24, ...bytes]));
  $("bf8Log").innerHTML = A.gw.log.slice(0, 14).map((e) => `<div><span class="bf8-mono">${e.t.toFixed(2)} s</span> ${esc(e.s)}</div>`).join("") || "<div>–</div>";
}

/* ------------------------------------------------------------------ mount a program */
function mountProg(key) {
  const p = PROGS.find((x) => x.KEY === key) || PROGS[0];
  cur = p;
  host.querySelectorAll("[data-prog]").forEach((b) => b.classList.toggle("on", b.dataset.prog === p.KEY));
  if (ctl) { try { ctl.destroy(); } catch (e) { /* ignore */ } ctl = null; }
  A = assemble(p);
  $("bf8Info").innerHTML = infoHtml(p);
  $("bf8Det").innerHTML = detHtml(p); $("bf8DetSub").textContent = `${p.TITLE} · example – check with your PLC configuration`;
  const lad = $("bf8LadHost"); lad.innerHTML = ""; const div = document.createElement("div"); lad.appendChild(div);
  prevHR = null; flash = new Map();
  A.gw.auto = $("bf8Auto").checked; A.gw.lost = $("bf8Lost").checked; A.gw.noHb = $("bf8NoHb").checked; $("bf8Qty").value = A.gw.qty; $("bf8Rec").value = A.gw.recipe;
  const pv = $("bf8Plant");
  ctl = mountLadder(div, A.program, {
    plant: A.plant, height: 900,
    onScan: (st, E) => { A.onScan(st, E); const now = performance.now(); if (now - lastPaint > 200) { lastPaint = now; pv.innerHTML = plantPanel(st); paintRegs(); } },
    onReset: (E) => { A.onScan(E.state, E); pv.innerHTML = plantPanel(E.state); paintRegs(); },
  });
  A.onScan(ctl.state, ctl.engine);
  pv.innerHTML = plantPanel(ctl.state); paintRegs();
  window.bf8Ctl = { ctl, A, prog: p.KEY, select: mountProg };
}

function realExample() {
  const v = 212.5, w = realToRegs(v), u = 70000;
  return `Last cycle time 212.5 s (induction, 850 mm / 4 mm/s) as IEEE 754 single = <b>0x43548000</b> → register 24 = <b class="bf8-mono">${h4(w[0])}</b> (high word "AB"), register 25 = <b class="bf8-mono">${h4(w[1])}</b> (low word "CD").
    Read back: ${regsToReal(w[0], w[1]).toFixed(1)} s. Wrong order (CDAB) would give ${regsToReal(w[1], w[0]).toExponential(3)} – a nonsense number is the typical sign of swapped words.
    UINT32 good = 70 000 → <b class="bf8-mono">0x0001 0x1170</b> (high word first). <b>Siemens:</b> one MOVE of the Real into the non-optimized DB "MB_HR" (big-endian) – done.
    <b>Delta:</b> the float D1014/D1015 has the LOW word in D1014 → MOV D1015 D24 + MOV D1014 D25 (network I13).`;
}

function build() {
  if (built || !host) return;
  built = true;
  host.innerHTML = `<div class="bf8-wrap">${headerHtml()}${liveHtml()}${detailsHtml()}${serverHtml()}${overviewHtml()}${checklistHtml()}<div class="bf8-debug" id="bf8Debug" hidden></div></div>`;
  host.querySelectorAll("[data-prog]").forEach((b) => b.addEventListener("click", () => mountProg(b.dataset.prog)));
  host.querySelectorAll("[data-goprog]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); mountProg(a.dataset.goprog); $("bf8Live").scrollIntoView({ block: "start" }); }));
  $("bf8Auto").addEventListener("change", (e) => { if (A) A.gw.auto = e.target.checked; });
  $("bf8Lost").addEventListener("change", (e) => { if (A) A.gw.lost = e.target.checked; });
  $("bf8NoHb").addEventListener("change", (e) => { if (A) A.gw.noHb = e.target.checked; });
  host.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("click", () => {
    if (!A) return; const c = +b.dataset.cmd, qty = Math.max(0, +$("bf8Qty").value || 0), rec = Math.max(0, +$("bf8Rec").value || 0);
    if (c === 1) A.gw.loadOrder(qty, rec); else if (c === 5) A.gw.send(5, { recipe: rec }); else A.gw.send(c);
  }));
  host.querySelectorAll("[data-chk]").forEach((c) => { const k = "bf8chk" + c.dataset.chk; try { c.checked = localStorage.getItem(k) === "1"; } catch (e) { /* no storage */ } c.addEventListener("change", () => { try { localStorage.setItem(k, c.checked ? "1" : "0"); } catch (e) { /* no storage */ } }); });
  $("bf8Real").innerHTML = realExample();
  mountProg(Q.get("bf8prog") || "std");
  try { makeCard(CARD8, host.querySelector(".bf8-wrap"), { card: "bfCard8", q: "bfQ8", g: "bfG8", cnt: "bfCnt8", buy: "bfBuy8" }, "bf8"); } catch (e) { console.error(e); }
  host.querySelector(".bf8-wrap").appendChild($("bf8Debug"));
  if (Q.has("bf8test")) setTimeout(selfTest, 700);
  if (Q.has("bf8dump")) setTimeout(dump, 300);
}

/* ------------------------------------------------------------------ listings for the guide (&bf8dump) */
function dump() {
  const out = [];
  for (const p of PROGS) {
    const a = assemble(p);
    const mach = { ...a.program, networks: a.program.networks.slice(0, a.meta.networks.length) };
    out.push(`#### PROGRAM ${p.KEY}`);
    out.push(`## IL-MACHINE\n${ilText(mach)}`);
    out.push(`## SCL-MACHINE\n${genSCL(mach)}`);
    out.push(`## IO\n${ioRows(a.program).filter((r) => /^(I|Q|AI|AQ|T|C)$/.test(r[1])).map((r) => r.join(" | ")).join("\n")}`);
    if (p.KEY === "std") { const itf = { ...a.program, networks: a.program.networks.slice(a.meta.networks.length) }; out.push(`## IL-IF\n${ilText(itf)}`); out.push(`## SCL-IF\n${genSCL(itf)}`); }
    out.push(`## NETS\n${a.program.networks.map((n, i) => `${i + 1}. ${n.title}`).join("\n")}`);
  }
  window.bf8DumpText = out.join("\n");
  console.log("BF8DUMP ready " + window.bf8DumpText.length + " chars");
}

/* ------------------------------------------------------------------ self-check (&bf8test) */
function runEngine(p, opts = {}) {
  const a = assemble(p, opts);
  const E = createEngine(a.program, { plant: a.plant, onScan: (st, e) => a.onScan(st, e) });
  E.reset();
  return { a, E, until: (f, max) => { const t0 = E.time; while (!f() && E.time - t0 < max) E.scan(); return f() ? E.time - t0 : NaN; } };
}
function selfTest() {
  const outL = [], log = (s) => { outL.push(s); console.log("BF8TEST " + s); };
  let pass = 0, fail = 0;
  const ok = (name, cond, txt = "") => { cond ? pass++ : fail++; log(`${cond ? "PASS" : "FAIL"} ${name}${txt ? " – " + txt : ""}`); };
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  try {
    for (const p of PROGS) { const a = assemble(p); const w = checkProgram(a.program); ok(`${p.KEY}: program check + ≥ 10 networks`, w.length === 0 && a.program.networks.length >= 10 && a.meta.networks.length >= 6, `${a.program.networks.length} networks (${a.meta.networks.length} machine)${w.length ? " · " + w.join(" | ") : ""}`); }
    /* REAL ABCD + status word (hand values) */
    const w = realToRegs(212.5); ok("REAL 212.5 → ABCD registers 0x4354 0x8000", w[0] === 0x4354 && w[1] === 0x8000, `${h4(w[0])} ${h4(w[1])}`);
    const w2 = realToRegs(-1.5); ok("REAL −1.5 → 0xBFC0 0x0000", w2[0] === 0xbfc0 && w2[1] === 0, `${h4(w2[0])} ${h4(w2[1])}`);
    ok("status word: RUN = 1, STARVED = 64, ALARM + E-STOP = 24", statusWord([0]) === 1 && statusWord([6]) === 64 && statusWord([3, 4]) === 24);
    /* program 1: handshake timing, status words, counters */
    {
      const { a, E, until } = runEngine(P1, { auto: false });
      const acks = () => a.gw.results.filter((r) => r.kind === "ack" || r.kind === "timeout");
      E.run(1.0);
      const HR = a.img.HR;
      ok("std: header map version 0x0101 (V1.1), type code 1, unit 1", HR[0] === MAPV && MAPV === 0x0101 && HR[1] === 1 && HR[2] === 1, `${h4(HR[0])} ${HR[1]} ${HR[2]}`);
      ok("std: register image 227 registers, 226 = cmd.gwHeartbeat (D226 / \"MB_HR\".cmd_gwHeartbeat)", HR.length === 227 && a.img.regs.some((r) => r.addr === 226 && r.name === "cmd.gwHeartbeat") && a.program.tags.some((t) => t.name === "GW_HB" && t.delta === "D226" && t.siemens === "\"MB_HR\".cmd_gwHeartbeat"), `${HR.length} registers, 226 = ${HR[226]}`);
      ok("std: idle, ready → status 2 (IDLE), hs.status 16 (READY), stateCode 1", HR[4] === 2 && HR[8] === 16 && HR[6] === 1, `status ${HR[4]}, hs ${HR[8]}, state ${HR[6]}`);
      E.run(0.25); const hb0 = HR[3], g0 = HR[226]; E.run(5.0); ok("std: heartbeat +5 in 5 s", HR[3] - hb0 === 5, `${hb0} → ${HR[3]}`);
      ok("std: gateway heartbeat 226 +5 in 5 s (FC06 every 1 s), watchdog OK", HR[226] - g0 === 5 && E.bit("M_GWOK") && !E.bit("H_GW"), `${g0} → ${HR[226]}, ${a.gw.hbWrites} writes`);
      a.gw.loadOrder(2, 7, "WO-TEST-1"); const tq = E.time;
      until(() => acks().length >= 1, 3);
      const r1 = acks()[0];
      ok("std: handshake – data (FC16) → REQ next scan → ACK seen at the next 100 ms poll", r1 && r1.result === 0 && near(r1.dt, 0.1, 0.021) && near(r1.t - tq, 0.62, 0.52), r1 ? `REQ→ACK seen ${Math.round(r1.dt * 1000)} ms, total ${Math.round((r1.t - tq) * 1000)} ms after queueing (wait for the 500 ms poll + 20 ms + 100 ms)` : "no result");
      ok("std: after load: BUSY, order + part copied (registers 26 – 45), lotDone 0", (HR[8] & 2) && a.img.get("std.order") === "WO-TEST-1" && a.img.get("std.part") === P1.PART && HR[11] === 0, `hs ${HR[8]} order ${a.img.get("std.order")} part ${a.img.get("std.part")}`);
      a.gw.send(1, { order: "WO-X", part: "P", recipe: 1, qty: 5 }); until(() => acks().length >= 2, 3);
      ok("std: second load while busy → result 4 (busy), REJECT bit", acks()[1] && acks()[1].result === 4 && (HR[8] & 8), `result ${acks()[1] && acks()[1].result}, hs ${HR[8]}`);
      a.gw.send(9); until(() => acks().length >= 3, 3); ok("std: unknown code 9 → result 1", acks()[2] && acks()[2].result === 1);
      a.gw.send(2); until(() => acks().length >= 4, 3); ok("std: start (2) → result 0, REJECT cleared", acks()[3] && acks()[3].result === 0 && !(HR[8] & 8));
      const tRun = until(() => HR[4] === 1, 3); ok("std: running → status word 1 (RUN), stateCode 2", HR[4] === 1 && HR[6] === 2, `after ${tRun.toFixed(2)} s`);
      const tP = until(() => E.state.GOOD + E.state.SCRAP >= 1, 60);
      ok("std: first part ≈ 29 s (clamp 0.6 + cut 25 + up 3 + unclamp 0.4)", near(tP, 29.1, 0.6), `${tP.toFixed(2)} s, last cycle register ${a.img.get("std.lastCycle_s")} s`);
      until(() => (HR[8] & 4), 80);
      ok("std: lot of 2 done → DONE toggled, BUSY 0, lotDone 2, good + scrap = 2", (HR[8] & 4) && !(HR[8] & 2) && HR[11] === 2 && a.img.get("std.good") + a.img.get("std.scrap") === 2, `hs ${HR[8]}, good ${a.img.get("std.good")}, scrap ${a.img.get("std.scrap")}`);
      a.gw.loadOrder(0, 7); until(() => acks().length >= 5, 3); ok("std: quantity 0 → result 3 (bad data)", acks()[4] && acks()[4].result === 3);
      E.set("B_DOOR", false); E.run(0.1); ok("std: guard open while idle → no alarm (only in cycle)", HR[7] === 0);
      E.set("B_DOOR", true); E.set("ESTOP_OK", false); E.run(0.1); ok("std: e-stop chain open → status 24 (ALARM + E-STOP copy), stateCode 4, READY 0", HR[4] === 24 && HR[6] === 4 && !(HR[8] & 16), `status ${HR[4]}`);
      E.set("ESTOP_OK", true); E.run(0.2);
      a.gw.lost = true; until(() => E.bit("H_GW"), 8); const tL = E.time - a.gw.lastHb; ok("std: gateway lost → H_GW 5 s after the last change of 226 (TOF), READY 0", near(tL, 5.0, 0.03) && !(HR[8] & 16), `${tL.toFixed(2)} s after the last heartbeat write`);
      a.gw.lost = false; E.run(1); ok("std: gateway back → READY again", !!(HR[8] & 16));
      a.gw.noHb = true; const p0 = a.gw.polls; until(() => E.bit("H_GW"), 8); const tN = E.time - a.gw.lastHb;
      ok("std: V1.0 gateway (polls, no 226 writes) → Delta-style watchdog reports gateway lost after 5 s", near(tN, 5.0, 0.03) && a.gw.polls > p0 + 5 && !(HR[8] & 16), `${tN.toFixed(2)} s, ${a.gw.polls - p0} polls meanwhile`);
      a.gw.noHb = false; E.run(1.2); ok("std: heartbeat back → GwOk, READY again", E.bit("M_GWOK") && !!(HR[8] & 16));
      HR[226] = 65535; a.gw.lastHb = E.time - 1; E.run(0.05); ok("std: 226 wraps 65535 → 0 and still counts as a change", HR[226] === 0 && E.bit("M_GWOK"), `226 = ${HR[226]}`);
      E.set("S_ON", false); E.run(0.1); ok("std: key switch off → status 128 (no shift), stateCode 0", HR[4] === 128 && HR[6] === 0);
    }
    for (const p of PROGS.slice(1)) if (p.selfTest) p.selfTest({ runEngine, ok, near, log, h4 });
  } catch (ex) { fail++; log("FAIL exception " + (ex && ex.stack || ex)); }
  const card = $("bfCard8"), imgs = card ? [...card.querySelectorAll(".rr-fig img")] : []; imgs.forEach((i) => { i.loading = "eager"; });
  host.querySelectorAll(".bf8-img").forEach((i) => { i.loading = "eager"; });
  setTimeout(() => {
    ok("page: ladder networks shown", host.querySelectorAll(".ld-net").length === A.program.networks.length, `${host.querySelectorAll(".ld-net").length} networks of ${A.program.id}`);
    ok("page: register table + overview (41 types) + checklist", host.querySelectorAll(".bf8-r").length > 20 && PLC_ROWS.length === 41 && host.querySelectorAll("[data-chk]").length === CHECKLIST.length, `${host.querySelectorAll(".bf8-r").length} register rows`);
    ok("card bfCard8", !!card, `buyRows ${card ? card.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} shopRows ${card ? card.querySelectorAll('[data-rrp="shop"] tbody tr').length : 0}`);
    ok("card drawings loaded", imgs.length === CARD8.drawings.length && imgs.every((i) => i.complete && i.naturalWidth > 0), `${imgs.filter((i) => i.complete && i.naturalWidth > 0).length} / ${CARD8.drawings.length}`);
    ok("page images loaded", [...host.querySelectorAll(".bf8-img")].every((i) => i.complete && i.naturalWidth > 0));
    log(`DONE pass=${pass} fail=${fail} errors=${errs.length ? errs.join(" | ") : "none"}`);
    const d = $("bf8Debug"); d.hidden = false; const pre = document.createElement("pre"); pre.textContent = outL.join("\n"); d.prepend(pre);
  }, 3000);
}

window.bf8Lib = { assemble, createEngine, PROGS, PLC_ROWS, runEngine: (p, o) => runEngine(p, o) };
window.addEventListener("bfitemshow", (e) => { if (String(e.detail) === "8") build(); });
if (window.bfCtl && window.bfCtl.current() === "8" && window.bfCtl.tabVisible()) build();
