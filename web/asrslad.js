/* AS/RS tab – item 5 "PLC ladder program – Delta + Siemens side by side (live simulation)".
 * Files: ladder.js + ladder.css (shared ladder core) · asrslad_prog.js (the program: tags + 18 networks) · asrslad_plant.js (plant model:
 *        crane, fork, hoist, sensors, conveyors, WCS, drives, safety relay) · asrslad_card.js (catalogue card data, #ldCardA).
 * Guide: docs/35_plc_ladder_basics_asrs.md. Built lazily on the first "sritemshow" event with detail "5" (window.srCtl).
 * URL: /?sritem=5#asrs · &ladview=delta|siemens|both · &ladtest (core self-test "LADTEST …") · &ladAtest (AS/RS self-check "LADATEST …")
 *      · &ladAstart (press Start automatically) · makeCard: &ldAtab=draw|buy|shop · &ldAq=text · &ldAbox=N · &ldAscroll
 * Offline, no libraries. All addresses, times and products are EXAMPLES – check with your PLC configuration and the supplier.
 */
import { mountLadder, createEngine, ilText, genSCL, checkProgram } from "./ladder.js";
import { PROGRAM, STEPS, STEP_TEXT } from "./asrslad_prog.js";
import { createPlant, SLOTX, SLOTZ } from "./asrslad_plant.js";
import { CARD } from "./asrslad_card.js";
import { makeCard } from "./robotref.js";
import { trapTime, forkTime, CRANE, getASRS } from "./asrscore.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 2) => (+v).toFixed(d);
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));

const CSS = `
#srItem5 .la-grid { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 12px; }
@media (max-width: 1100px) { #srItem5 .la-grid { grid-template-columns: 1fr; } }
#srItem5 .la-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 12.5px; color: var(--text-2); margin: 6px 0 0; }
#srItem5 .la-legend code { font-family: ui-monospace, Consolas, monospace; color: var(--text); }
#srItem5 .la-safe { margin: 10px 0 0; padding: 8px 10px; border-left: 3px solid var(--critical); background: var(--surface-2); font-size: 12.5px; color: var(--text); }
#srItem5 .la-btns { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 0; align-items: center; }
#srItem5 .la-btns .lbl { font-size: 12px; color: var(--text-2); margin-right: 2px; }
#srItem5 .la-b { font: inherit; font-size: 12.5px; padding: 4px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; }
#srItem5 .la-b:hover { border-color: var(--accent); }
#srItem5 .la-b.on { border-color: var(--critical); color: var(--critical); font-weight: 600; }
#srItem5 .la-b.go { border-color: var(--good-text); color: var(--good-text); font-weight: 600; }
#srItem5 .la-svg { width: 100%; height: auto; display: block; background: var(--surface-2); border-radius: 6px; }
#srItem5 .la-svg text { font: 11px ui-monospace, Consolas, monospace; fill: var(--text-2); }
#srItem5 .la-svg .t1 { fill: var(--text); font-weight: 600; }
#srItem5 .la-rack { fill: var(--surface); stroke: var(--axis); }
#srItem5 .la-occ { fill: #8a9bb0; }
#srItem5 .la-tgt { stroke: var(--accent); stroke-width: 2.5; fill: none; }
#srItem5 .la-zone { fill: var(--surface); stroke: var(--axis); }
#srItem5 .la-zone.run { stroke: var(--good-text); stroke-width: 2.5; }
#srItem5 .la-load { fill: #a3a07a; stroke: #555; }
#srItem5 .la-load.bad { fill: var(--critical); }
#srItem5 .la-crane { fill: var(--accent); }
#srItem5 .la-fork { stroke: var(--text); stroke-width: 5; stroke-linecap: round; }
#srItem5 .la-rail { stroke: var(--axis); stroke-width: 3; }
#srItem5 .la-kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; font-size: 12.5px; margin: 8px 0 0; }
#srItem5 .la-kv b { font-weight: 600; color: var(--text); }
#srItem5 .la-kv span { color: var(--text-2); font-family: ui-monospace, Consolas, monospace; }
#srItem5 .la-log { font: 11.5px/1.45 ui-monospace, Consolas, monospace; max-height: 260px; overflow: auto; background: var(--surface-2); border-radius: 6px; padding: 6px 8px; margin: 8px 0 0; color: var(--text); }
#srItem5 .la-log .al { color: var(--critical); }
#srItem5 .la-log .st { color: var(--good-text); }
#srItem5 .la-tw { font-size: 12.5px; border: 1px dashed var(--border); border-radius: 6px; padding: 6px 8px; margin: 8px 0 0; color: var(--text-2); }
#srItem5 table.la-t { width: 100%; border-collapse: collapse; font-size: 12.5px; }
#srItem5 table.la-t th, #srItem5 table.la-t td { border: 1px solid var(--border); padding: 4px 6px; text-align: left; vertical-align: top; color: var(--text); }
#srItem5 table.la-t th { background: var(--surface-2); }
#srItem5 .la-alarms { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 0; }
#srItem5 .la-al { font: 11px ui-monospace, Consolas, monospace; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border); color: var(--muted); }
#srItem5 .la-al.on { color: #fff; background: var(--critical); border-color: var(--critical); }
#srItem5 .la-al.warn.on { background: var(--serious); border-color: var(--serious); }
`;
const ALARMS = ["A0011", "A1011", "A1021", "A1031", "A4011", "A4041", "A5011", "A7011", "A7021", "A7031", "A7041", "A7051", "A7061", "A7071", "A8000"];
const WARNS = new Set(["A7011", "A7021", "A7031", "A7061"]);

function build(box) {
  if (!$("laStyle")) { const s = document.createElement("style"); s.id = "laStyle"; s.textContent = CSS; document.head.appendChild(s); }
  const plant = createPlant({ seed: 5 });
  const tags = new Map(PROGRAM.tags.map((t) => [t.name, t]));
  box.innerHTML = `
  <div class="card">
    <div class="card-head"><h2>PLC ladder program – AS/RS crane + conveyor, Delta and Siemens side by side</h2>
      <span class="sub">Delta ${esc(PROGRAM.plc.delta.cpu)} (${esc(PROGRAM.plc.delta.sw)}) · Siemens ${esc(PROGRAM.plc.siemens.cpu)} (${esc(PROGRAM.plc.siemens.sw)}, PLC-ASRS-RAW 10.54.0.31) · ${PROGRAM.networks.length} networks · ${PROGRAM.tags.length} tags · scan ${PROGRAM.scanMs} ms · example – guide 35</span></div>
    <p style="margin:0 0 6px;font-size:13px">One program, two PLC families. The <b>same rung</b> is drawn twice: left with Delta addresses (X0.0, Y0.0, M10, S10 step relays, T0 with <code>TMR T0 K20</code>), right with Siemens addresses (%I0.0, %Q0.0, DB bits, IEC timers <code>TON</code> with an instance DB, <code>PT T#2S</code>). Use the buttons <b>Delta / Siemens / Both</b> above the networks.
      <b>How to read it:</b> power flows from the left rail to the right through closed contacts. A <b>green</b> wire = power (the condition is true), grey = no power. A contact is green when it is closed.
      The plant model moves the crane, the fork and the conveyor loads from the outputs and writes the sensors back – press <b>Start automatic</b> and the crane works on its own.</p>
    <div class="la-legend"><span><code>–| |–</code> NO contact (closed when the signal is 1)</span><span><code>–|/|–</code> NC contact (closed when 0)</span><span><code>–|P|–</code> rising edge (one scan)</span><span><code>–( )–</code> coil</span><span><code>–(S)– / –(R)–</code> set / reset</span><span><code>TON / TMR</code> on-delay timer</span><span><code>CTU / CNT</code> counter</span><span><code>CMP / LD&gt;=</code> compare</span><span><code>MOVE / MOV</code></span></div>
    <div class="la-safe"><b>Safety rule:</b> the standard ladder program never does the safety function itself (e-stop, guard locking, STO, safe speed, muting). That is the safety relay (Delta solution) or the F-program in the F-CPU (Siemens) – ISO 13849-1, IEC 62061, IEC 60204-1 §9.4. The program below only <b>reads</b> the safety status (network 2) and sends a muting <i>enable</i>.</div>
    <div class="la-btns"><span class="lbl">Operator:</span>
      <button class="la-b go" data-p="S_START" type="button">&#9654; Start automatic (-SF71)</button><button class="la-b" data-p="S_STOP" type="button">Stop (-SF72)</button><button class="la-b" data-p="S_RESET" type="button">Reset / acknowledge (-SF58)</button>
      <button class="la-b" data-k="semi" type="button">Semi-auto (HMI)</button><button class="la-b" data-p="HMI_JOB" type="button">HMI job start</button></div>
    <div class="la-btns"><span class="lbl">Safety (relay / F-program):</span>
      <button class="la-b" data-s="estop" type="button">E-stop -SF52</button><button class="la-b" data-s="door" type="button">Aisle door open</button><button class="la-b" data-s="person" type="button">Person in light curtain</button></div>
    <div class="la-btns"><span class="lbl">Inject a fault (next event):</span>
      ${[["noRead", "bar-code no-read"], ["contour", "contour fault"], ["overweight", "overweight 340 kg"], ["jam", "conveyor jam"], ["collision", "fork collision"], ["doubleStore", "double storage"], ["emptySlot", "empty slot"], ["overload", "hoist overload"], ["drive", "drive fault"], ["wcs", "WCS link lost"]].map(([k, t]) => `<button class="la-b" data-f="${k}" type="button">${t}</button>`).join("")}
      <label style="font-size:12px;color:var(--text-2)"><input type="checkbox" id="laMirror"> mirror the shared twin (e-stop + faults of items 1 – 4)</label>
      <label style="font-size:12px;color:var(--text-2)"><input type="checkbox" id="laFeed" checked> infeed loads arrive</label></div>
    <div class="la-alarms" id="laAlarms">${ALARMS.map((a) => `<span class="la-al ${WARNS.has(a) ? "warn" : ""}" data-al="${a}" title="${esc((tags.get(a) || {}).comment || "")}">${a === "A8000" ? "A8sss" : a}</span>`).join("")}</div>
  </div>
  <div class="la-grid">
    <div class="card"><div class="card-head"><h2>Plant – crane, fork, conveyors (live, driven by the PLC outputs)</h2><span class="sub">top view, not to scale · x along the aisle, z = fork height</span></div>
      <svg class="la-svg" id="laSvg" viewBox="0 0 960 250" role="img" aria-label="AS/RS plant top view"></svg>
      <div class="la-kv" id="laKv"></div></div>
    <div class="card"><div class="card-head"><h2>Events, steps and alarms</h2><span class="sub">plant events · step changes · alarms (sim time)</span></div>
      <div class="la-log" id="laLog"></div>
      <div class="la-tw" id="laTwin">Shared twin (items 1 – 4): –</div></div>
  </div>
  <div class="card"><div class="card-head"><h2>Ladder program – ${PROGRAM.networks.length} networks (live)</h2><span class="sub">click the inputs on the left · sensors from the plant: click = force (F) · search a tag or address · I/O table, Delta IL and Siemens SCL below</span></div>
    <div id="laLad"></div></div>
  <div class="card"><div class="card-head"><h2>Program structure – Siemens blocks and Delta tasks</h2><span class="sub">where each network goes in a real project (example)</span></div>
    <div class="table-wrap"><table class="la-t"><thead><tr><th>Part</th><th>Siemens S7-1500F (TIA Portal V19)</th><th>Delta AS332T-A (ISPSoft 3.x)</th></tr></thead><tbody>
      <tr><td>Cyclic program</td><td><b>OB1</b> Main (or cyclic OB with fixed cycle, e.g. 4 – 10 ms) calls FB_Modes (N1 – 5), FB_WcsComm (N6, N17), FB_CraneSeq (N7 – 12), FB_Conveyor (N13 – 15), FB_Alarms (N16), FC_Counters (N18)</td><td>Cyclic task with POUs in the same order (ladder POUs, function blocks possible); the whole program = one scan</td></tr>
      <tr><td>Start-up</td><td><b>OB100</b> Startup (initialise DBs, step 10) – or the system bit "FirstScan" %M1.0 in OB1 (network 1)</td><td>First-scan flag <b>M1002</b> (network 1); M1000 = always on; M1013 = 1 s clock</td></tr>
      <tr><td>Time-based tasks</td><td><b>OB30 – OB38</b> cyclic interrupts (the classic "OB35" = 100 ms) – e.g. watchdog, PID</td><td>Timed interrupt task (fixed interval, see the AS manual) for fast or periodic jobs</td></tr>
      <tr><td>Errors / diagnostics</td><td>OB82 diagnostic interrupt, OB86 rack / station failure (ET 200SP lost), OB121 programming error, OB122 I/O access error</td><td>Error flags + error log in the CPU (special M / SR registers), HWCONFIG diagnostics</td></tr>
      <tr><td>Safety</td><td><b>F-program</b> F_MAIN in an F-runtime group (cyclic interrupt OB, e.g. 20 ms): ESTOP1, SFDOOR, MUTING, ACK_GL – writes "DB_FStatus" (read by networks 2, 15)</td><td>Hard-wired safety relay (e.g. PNOZ s4) or safety controller (PNOZmulti 2); its auxiliary / status contacts go to X0.8 … X0.11</td></tr>
      <tr><td>Data</td><td>Global DBs: DB_Asrs (steps, modes), DB_Wcs (telegram), DB_Axis, DB_Drives, DB_Conv, DB_Alarm (or ProDiag), DB_FStatus; instance DBs for TON / CTU (better: multi-instances inside the FBs)</td><td>M bits (M0 …), step relays S0 …, data registers D0 … (16 bit, 32 bit = D + D+1), timers T0 …, counters C0 …; latched ranges set in HWCONFIG</td></tr>
      <tr><td>Step chain</td><td>LAD with SET / RST bits (as here), or GRAPH (SFC), or CASE in SCL (guide 32 §6.5)</td><td>LAD with SET / RST on S relays (as here), or SFC with S relays and STL / RET style</td></tr>
      <tr><td>Motion</td><td>Technology objects + MC_MoveAbsolute (PROFIdrive telegram 105 / 111) or SINAMICS EPOS via FB284</td><td>Drive position tables (e.g. ASDA-A3 PR mode, trigger + done bits) or a motion CPU (AS-M / AH-M series)</td></tr>
    </tbody></table></div></div>`;

  /* ---------------- the ladder */
  const evLog = [];
  let ctl = null;
  const logL = (msg, cls = "") => { evLog.unshift({ t: ctl ? ctl.engine.time : 0, msg, cls }); if (evLog.length > 120) evLog.pop(); };
  plant.onEvent = (m) => logL(m);
  const prev = { M_RUN: false };
  const onScan = (st, E) => {
    for (const n of STEPS) { const b = !!st["S" + n]; if (b && !prev["S" + n]) logL(`S${n} – ${STEP_TEXT[n]}`, "st"); prev["S" + n] = b; }
    for (const a of ALARMS) { const b = !!st[a]; if (b && !prev[a]) logL(`ALARM ${a === "A8000" ? "ASRSRAW_A" + st.D_ALNO : "ASRSRAW_" + a} – ${(tags.get(a).comment || "").replace(/^ASRSRAW_\w+ /, "")}`, "al"); if (!b && prev[a]) logL(`${a} cleared (acknowledged)`); prev[a] = b; }
    if (st.M_RUN !== prev.M_RUN) { logL(st.M_RUN ? "automatic RUNNING (seal-in M_RUN)" : "automatic stopped"); prev.M_RUN = st.M_RUN; }
  };
  ctl = mountLadder($("laLad"), PROGRAM, { plant, onScan, height: 760, onReset: () => { plant.reset(); evLog.length = 0; logL("PLC reset – all tags to initial values, plant reset"); } });
  window.ladA = { ctl, plant, program: PROGRAM };
  const pulse = (tag, ms = 300) => { const t = tags.get(tag); ctl.setInput(tag, !t.init); setTimeout(() => ctl.setInput(tag, !!t.init), ms); };
  box.querySelectorAll("[data-p]").forEach((b) => b.addEventListener("click", () => pulse(b.dataset.p)));
  box.querySelector('[data-k="semi"]').addEventListener("click", (e) => { const v = !ctl.get("HMI_SEMI"); ctl.setInput("HMI_SEMI", v); e.target.classList.toggle("on", v); logL(v ? "HMI: semi-automatic ON – jobs from the HMI (press 'HMI job start')" : "HMI: semi-automatic OFF – jobs from the WCS"); });
  box.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.s;
    if (k === "person") { plant.safety.person = true; logL("person enters the light curtain at the I/O"); setTimeout(() => { plant.safety.person = false; }, 2500); return; }
    plant.safety[k] = !plant.safety[k]; b.classList.toggle("on", plant.safety[k]);
    logL(`${k === "estop" ? "e-stop -SF52" : "aisle door"} ${plant.safety[k] ? (k === "estop" ? "PRESSED" : "OPENED") : (k === "estop" ? "released – press Reset, then Start" : "closed – press Reset, then Start")}`);
  }));
  box.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.f, level = ["jam", "collision", "drive", "wcs"].includes(k);
    plant.faults[k] = level ? !plant.faults[k] : true;
    if (level) b.classList.toggle("on", plant.faults[k]);
    logL(`fault injected: ${b.textContent}${level ? (plant.faults[k] ? " ON" : " OFF – press Reset, then Start") : " (next load / job)"}`, "al");
  }));
  $("laFeed").addEventListener("change", (e) => { plant.feed = e.target.checked; });

  /* ---------------- shared twin (optional live link) */
  let A = null, mir = { estop: false, scanner: false, convJam: false, overload: false, crane: false };
  function twinTick() {
    const on = $("laMirror").checked;
    if (!on && !A) return;
    A = A || getASRS();
    const s = A.sim, c = s.crane, carrying = !!c.carrying;
    const step = s.estop || s.faults.crane ? "stopped" : { idle: 10, toIO: carrying ? 120 : 20, toSlot: carrying ? 120 : 20, pos: carrying ? 130 : 30, forkOut: carrying ? 140 : 40, lift: 50, lower: 150, forkIn: carrying ? 60 : 160 }[c.phase] ?? "–";
    const job = c.plan ? c.plan.jobs.map((j) => `${j.id} ${j.type}`).join(" + ") : "none";
    $("laTwin").innerHTML = `<b>Shared twin (items 1 – 4)</b>: phase <code>${esc(c.phase)}</code> → ladder step <b>${typeof step === "number" ? "S" + step : step}</b> · x ${f(c.x)} m · z ${f(c.z)} m · job ${esc(job)} · ${s.estop ? "E-STOP" : "no e-stop"}${on ? " · mirroring e-stop + faults into this PLC" : ""}`;
    if (!on) return;
    if (s.estop !== mir.estop) { plant.safety.estop = s.estop; mir.estop = s.estop; logL(`shared twin: e-stop ${s.estop ? "PRESSED" : "released"} (mirrored)`, s.estop ? "al" : ""); }
    if (s.faults.scanner && !mir.scanner) plant.faults.noRead = true;
    if (s.faults.overload && !mir.overload) plant.faults.overload = true;
    if (s.faults.convJam !== mir.convJam) plant.faults.jam = s.faults.convJam;
    if (s.faults.crane !== mir.crane) plant.faults.drive = s.faults.crane;
    mir.scanner = s.faults.scanner; mir.overload = s.faults.overload; mir.convJam = s.faults.convJam; mir.crane = s.faults.crane;
  }
  $("laMirror").addEventListener("change", (e) => { if (!e.target.checked) { if (mir.estop) plant.safety.estop = false; plant.faults.jam = false; plant.faults.drive = false; mir = { estop: false, scanner: false, convJam: false, overload: false, crane: false }; } twinTick(); });

  /* ---------------- plant drawing */
  const X = (mm) => 330 + mm * 0.0215;
  function drawPlant() {
    const S = plant.view(), st = ctl.state, j = S.job;
    const lvl = j ? j.lvl : Math.max(1, Math.min(7, Math.round((S.z + 800) / 1250)));
    let s = `<line class="la-rail" x1="${X(0)}" y1="125" x2="${X(28000)}" y2="125"/>`;
    s += `<text x="${X(1200)}" y="14">side L – level ${lvl}</text><text x="${X(1200)}" y="246">side R – level ${lvl}</text>`;
    for (const side of ["L", "R"]) for (let b = 1; b <= 14; b++) for (let k = 1; k <= 2; k++) {
      const x = X(SLOTX(b, k)) - 8, y = side === "L" ? 22 : 186, occ = S.slots.get(`${side}-${b}-${k}-${lvl}`);
      s += `<rect class="${occ ? "la-occ" : "la-rack"}" x="${x}" y="${y}" width="16" height="42" rx="1"/>`;
      if (j && j.side === side && j.bay === b && j.k === k) s += `<rect class="la-tgt" x="${x - 3}" y="${y - 3}" width="22" height="48"/>`;
    }
    // conveyors
    const zx = [0, 70, 132, 194, 256];
    for (let z = 1; z <= 4; z++) s += `<rect class="la-zone ${st["Q_IZ" + z] ? "run" : ""}" x="${zx[z]}" y="60" width="60" height="40"/><text x="${zx[z] + 4}" y="56">IZ${z}</text>`;
    s += `<rect class="la-zone ${st.Q_REJECT ? "run" : ""}" x="194" y="6" width="60" height="34"/><text x="150" y="26">reject</text>`;
    s += `<rect class="la-zone ${st.Q_OZ1 ? "run" : ""}" x="256" y="150" width="60" height="40"/><rect class="la-zone ${st.Q_OZ2 ? "run" : ""}" x="194" y="150" width="60" height="40"/><text x="260" y="204">OZ1</text><text x="198" y="204">OZ2</text>`;
    s += `<text x="70" y="118">infeed (side L) – ID point IZ2, scale IZ3</text><text x="70" y="140">outfeed (side R)</text>`;
    for (const l of S.inz) { const x = zx[l.z] + 8 + (l.z < 4 ? l.prog * 62 : 0); s += `<rect class="la-load ${l.noRead || l.contour || l.kg > 300 ? "bad" : ""}" x="${x}" y="66" width="44" height="28" rx="2"><title>${esc(l.id)} ${l.kg} kg</title></rect>`; }
    if (S.rej) s += `<rect class="la-load bad" x="202" y="10" width="44" height="26" rx="2"/>`;
    for (const l of S.outz) { const x = (l.z === 1 ? 264 : 202) - (l.z === 1 ? l.prog * 62 : 0); s += `<rect class="la-load" x="${x}" y="156" width="44" height="28" rx="2"/>`; }
    // crane
    const cx = X(S.x);
    s += `<line class="la-fork" x1="${cx}" y1="125" x2="${cx}" y2="${125 + S.fork * 62}"/>`;
    s += `<rect class="la-crane" x="${cx - 9}" y="110" width="18" height="30" rx="2"/>`;
    if (S.carry) s += `<rect class="la-load" x="${cx - 14}" y="${125 + S.fork * 62 - 12}" width="28" height="24" rx="2"/>`;
    s += `<text class="t1" x="${cx + 12}" y="${S.fork > 0.2 ? 108 : 150}">${(S.x / 1000).toFixed(2)} m</text>`;
    // hoist bar
    s += `<rect x="935" y="20" width="12" height="210" class="la-rack"/><rect x="935" y="${230 - Math.max(0, Math.min(9500, S.z)) / 9500 * 210 - 3}" width="12" height="6" class="la-crane"/><text x="900" y="16">z ${(S.z / 1000).toFixed(2)} m</text>`;
    $("laSvg").innerHTML = s;
    const act = STEPS.filter((n) => st["S" + n]);
    $("laKv").innerHTML = [
      ["Step", act.length ? act.map((n) => `S${n} ${STEP_TEXT[n]}`).join(", ") : "none"],
      ["Job (WCS)", j ? `${j.id} ${j.store ? "STORE" : "RETRIEVE"} slot A01${j.side}-L${j.lvl}-S${String((j.bay - 1) * 2 + j.k).padStart(2, "0")} → x ${SLOTX(j.bay, j.k)} mm, z ${SLOTZ(j.lvl)} mm` : "waiting"],
      ["Targets D_TX / D_TZ", `${st.D_TX} mm / ${st.D_TZ} mm`],
      ["Crane", `x ${(S.x / 1000).toFixed(3)} m · z ${(S.z / 1000).toFixed(3)} m · fork ${S.fork.toFixed(2)} · ${S.carry ? `load ${S.carry.id} ${S.carry.kg} kg (${f(st.LOAD_PCT, 0)} %)` : "no load"}`],
      ["Drives", `${st.Q_DRV_EN ? "enabled" : "off"} · STO ${st.STO_FB ? "active" : "off"} · brakes ${st.BRK_FB ? "released" : "closed"} · safety relay ${st.SAF_OK ? "ON" : "OFF (reset needed)"}`],
      ["Counters", `jobs ${st.C_JOBS.CV} · operating ${st.D_HRS} h ${st.C_SEC.CV} s · last step alarm ${st.D_ALNO || "–"}`],
    ].map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join("");
    $("laLog").innerHTML = evLog.slice(0, 60).map((e) => `<div class="${e.cls}">${f(e.t, 1).padStart(7)} s  ${esc(e.msg)}</div>`).join("");
    box.querySelectorAll("[data-al]").forEach((el) => el.classList.toggle("on", !!st[el.dataset.al]));
  }
  let timer = 0, twinT = 0;
  function tick() { if (!box.offsetParent) return; drawPlant(); if (++twinT % 5 === 0) twinTick(); }
  timer = setInterval(tick, 100);
  drawPlant();

  /* ---------------- catalogue card */
  const wrap = document.createElement("div"); box.appendChild(wrap);
  try { makeCard(CARD, wrap, { card: "ldCardA", q: "ldAQ", g: "ldAG", cnt: "ldACnt", buy: "ldABuy" }, "ldA"); } catch (e) { console.error(e); }

  if (Q.has("ladAstart")) setTimeout(() => pulse("S_START"), 500);
  if (Q.has("ladAtest")) setTimeout(() => selfTest(), 400);
  return { show() {}, hide() {}, ctl, plant, stop: () => clearInterval(timer) };
}

/* ======================================================================= self-check (&ladAtest) – headless engine + fresh plant */
export function selfTest(out = (s) => console.log("LADATEST " + s)) {
  let bad = 0;
  const ok = (c, m) => { if (!c) bad++; out(`${c ? "ok  " : "FAIL"} ${m}`); };
  const prog = JSON.parse(JSON.stringify(PROGRAM));
  const plant = createPlant({ seed: 5 });
  const E = createEngine(prog, { plant });
  const rise = {}, hist = [];
  E.onScan = (st) => { for (const n of STEPS) { const b = !!st["S" + n]; if (b && !rise["S" + n]) hist.push({ n, t: E.time }); rise["S" + n] = b; } };
  const until = (cond, max) => { const t0 = E.time; while (!cond() && E.time - t0 < max) E.scan(); return cond() ? E.time - t0 : null; };
  const press = (tag) => { const t = E.tags.get(tag); E.set(tag, !t.init); E.scan(); E.set(tag, !!t.init); E.scan(); };
  const anyAlarm = () => ALARMS.filter((a) => E.state[a]);
  out(`program: ${prog.networks.length} networks, ${prog.networks.reduce((k, n) => k + n.rungs.length, 0)} rungs, ${prog.tags.length} tags, scan ${prog.scanMs} ms, check warnings = ${checkProgram(prog).length}`);
  ok(checkProgram(prog).length === 0, "program check: no unknown tags, no double coils, Siemens bits 0 … 7, Delta bits 0 … 15");
  const il = ilText(prog), scl = genSCL(prog);
  out(`Delta IL ${il.split("\n").length} lines, Siemens SCL ${scl.split("\n").length} lines`);
  E.run(0.5);
  ok(E.bit("S10") && !E.bit("M_RUN"), "after power-on: step S10 (first-scan M1002 / FirstScan), automatic not running");
  E.set("S_START", true); E.scan(); const run0 = E.bit("M_RUN"); E.set("S_START", false); E.scan();
  ok(run0 && E.bit("M_RUN"), "Start -SF71 → M_RUN in the same scan (0 ms after the input is read), seal-in holds after release");
  const tb = until(() => E.bit("Q_BRK"), 2);
  ok(tb !== null && Math.abs(tb - 0.24) < 0.03, `drive enable → brake release after ${tb !== null ? tb.toFixed(2) : "–"} s (STO feedback 0.05 s + T_BRK 0.20 s, ± 1 scan)`);
  const tJob = until(() => E.state.C_JOBS.CV >= 2, 400);
  ok(tJob !== null, `two jobs done in ${tJob !== null ? tJob.toFixed(1) : "–"} s, job counter C_JOBS = ${E.state.C_JOBS.CV}`);
  // durations of the first job
  const dur = (n) => { const i = hist.findIndex((h) => h.n === n); if (i < 0 || i + 1 >= hist.length) return null; return hist[i + 1].t - hist[i].t; };
  const d30 = dur(30), d40 = dur(40), d50 = dur(50), d60 = dur(60);
  out(`job 1 step times: S20 ${f(dur(20) || 0)} s · S30 ${f(d30 || 0)} s · S40 ${f(d40 || 0)} s · S50 ${f(d50 || 0)} s · S60 ${f(d60 || 0)} s · S120 ${f(dur(120) || 0)} s · S130 ${f(dur(130) || 0)} s · S140 ${f(dur(140) || 0)} s · S150 ${f(dur(150) || 0)} s · S160 ${f(dur(160) || 0)} s`);
  const ft = forkTime();
  ok(d30 !== null && Math.abs(d30 - (CRANE.tPos + 0.02)) <= 0.05, `fine positioning S30 = ${f(d30 || 0)} s (plant 3.00 s + 1 scan)`);
  ok(d40 !== null && Math.abs(d40 - ft) <= 0.06, `fork out S40 = ${f(d40 || 0)} s (forkTime ${f(ft)} s = 1.35 m / 1.0 m/s + 1.0 / 1.2, ± 2 scans)`);
  ok(d50 !== null && Math.abs(d50 - CRANE.tLift) <= 0.05, `lift S50 = ${f(d50 || 0)} s (0.5 s stroke, ± 2 scans)`);
  ok(anyAlarm().length === 0, `no alarm in normal operation (${anyAlarm().join(",") || "none"})`);
  // travel time check: next S20 / S120 against the trapezoid formula
  const tx = E.state.D_TX;
  out(`travel check: trapTime(27.675 m, 3 m/s, 0.5 m/s²) = ${f(trapTime(27.675, 3, 0.5))} s → T_MOVE preset 25 s ≥ 1.5 × ${f(trapTime(27.675, 3, 0.5))} + 2 = ${f(1.5 * trapTime(27.675, 3, 0.5) + 2)} s (last target D_TX ${tx} mm)`);
  // no-read at the ID point
  plant.faults.noRead = true; plant.view().nextFeed = 0;
  const tScan = until(() => E.bit("Q_SCAN"), 200), t7011 = tScan !== null ? until(() => E.bit("A7011"), 5) : null;
  ok(t7011 !== null && Math.abs(t7011 - 1.0) <= 0.03, `bar-code no-read: A7011 ${t7011 !== null ? t7011.toFixed(2) : "–"} s after the scanner trigger (T_SCAN 1.0 s), crane keeps running = ${E.bit("M_RUN")}`);
  const tRej = until(() => E.bit("Q_REJECT"), 60);
  ok(tRej !== null, `the no-read load reaches zone 3 and goes to the reject lane (diverter ON after ${tRej !== null ? tRej.toFixed(1) : "–"} s)`);
  press("S_RESET");
  // e-stop
  plant.safety.estop = true; E.scan(); E.scan();
  ok(E.bit("A1011") && !E.bit("Q_DRV_EN") && !E.bit("SAF_OK") && !E.bit("M_RUN"), "e-stop: A1011, safety relay OFF, drive enable OFF, automatic OFF within 1 scan (the relay already removed the torque)");
  plant.safety.estop = false; E.scan(); press("S_RESET");
  ok(E.bit("SAF_OK") && !E.bit("A1011"), "e-stop released + Reset -SF58: safety relay ON, A1011 acknowledged");
  press("S_START"); ok(E.bit("M_RUN"), "Start again → automatic running");
  // WCS link lost
  plant.faults.wcs = true; const tw = until(() => E.bit("A0011"), 6);
  ok(tw !== null && tw >= 2.0 && tw <= 4.05, `WCS life bit stops: A0011 ${tw !== null ? tw.toFixed(2) : "–"} s after the fault = 3.0 s (T_WCS) after the last toggle (the bit toggles every 1 s)`);
  plant.faults.wcs = false; until(() => !E.bit("M_WCSLOST"), 3); press("S_RESET"); press("S_START");
  ok(!E.bit("A0011") && E.bit("M_RUN"), "link back, acknowledged, automatic again");
  // step time-out: force "in position" off during a travel step
  const tt = until(() => E.bit("Q_MOVE"), 200);
  E.force("I_INPOS", false);
  const to = tt !== null ? until(() => E.bit("A8000"), 30) : null;
  ok(to !== null && Math.abs(to - 25) <= 0.05 && (E.num("D_ALNO") === 8020 || E.num("D_ALNO") === 8120), `step time-out: in-position never comes → A8sss after ${to !== null ? to.toFixed(2) : "–"} s, alarm number ${E.num("D_ALNO")} (T_MOVE 25 s)`);
  E.scan();
  ok(!E.bit("Q_MOVE") && !E.bit("M_RUN"), "one scan later (M_FAULT is written in network 16, read in networks 3 + 10): crane stays in the step, motion command OFF, automatic OFF the crane stays in the step, motion command OFF, automatic OFF");
  E.force("I_INPOS", null); press("S_RESET"); press("S_START");
  const done2 = until(() => E.state.C_JOBS.CV >= 4, 300);
  ok(done2 !== null, `recovery: the chain continues from its step after Reset + Start, jobs = ${E.state.C_JOBS.CV}`);
  // collision during a fork stroke
  const tf = until(() => E.bit("Q_FK_L") || E.bit("Q_FK_R"), 200);
  plant.faults.collision = true; E.scan(); E.scan();
  ok(tf !== null && E.bit("A4041") && E.bit("M_FAULT") && !E.bit("Q_FK_L") && !E.bit("Q_FK_R"), "fork collision (-BG66 beam broken): A4041 within 1 scan, fork outputs OFF");
  plant.faults.collision = false; E.scan(); press("S_RESET"); press("S_START");
  // empty slot at retrieval
  plant.faults.emptySlot = true;
  const te = until(() => E.bit("A7061"), 300);
  ok(te !== null && E.bit("A7061"), `empty slot at retrieval: A7061 + PLC_ERR (job aborted before the fork moves), automatic continues = ${E.bit("M_RUN")}`);
  out(`final: t = ${f(E.time, 1)} s, jobs = ${E.state.C_JOBS.CV}, operating time = ${E.num("D_HRS")} h ${E.state.C_SEC.CV} s, alarms = ${anyAlarm().join(",") || "none"}`);
  ok(errs.length === 0, `page errors: ${errs.length ? errs.join(" | ") : "none"}`);
  const ui = window.ladA ? document.querySelectorAll("#laLad .ld-svg").length : 0;
  out(`UI: ${ui} rung SVGs in "${window.ladA ? window.ladA.ctl.view() : "–"}" view, catalogue card ${$("ldCardA") ? "ok" : "missing"} (${CARD.drawings.length} drawings, ${CARD.groups.reduce((k, g) => k + g.rows.length, 0)} rows)`);
  out(`DONE errors=${bad}`);
  return bad;
}

/* ------------------------------------------------------------------ lazy build on the first show of item 5 */
const box = $("srItem5");
let UI = null, tried = false;
function onShow(n) {
  if (!box) return;
  if (String(n) !== "5") return;
  if (!window.srCtl || !window.srCtl.tabVisible()) return;
  if (!tried) { tried = true; try { UI = build(box); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p>Item 5 could not start: ${esc(e.message)}</p></div>`; } }
}
window.addEventListener("sritemshow", (e) => onShow(e.detail));
if (window.srCtl && window.srCtl.current() === "5" && window.srCtl.tabVisible()) onShow("5");
/* text form of the program (used to write the listings of guide 35) */
function dump() {
  const nm = (x) => typeof x === "number" ? String(x) : x;
  const tx = (n) => {
    if (n.s) return n.s.map(tx).join(" AND ");
    if (n.p) return "(" + n.p.map(tx).join(" OR ") + ")";
    if (n.c) return { NO: "", NC: "NOT ", P: "RISING ", N: "FALLING " }[n.c] + n.t;
    if (n.cmp) return `[${nm(n.a)} ${n.cmp} ${nm(n.b)}]`;
    return n.b ? `${n.b}(${n.t})` : "?";
  };
  const ox = (o) => o.o ? `${o.o} ${o.t}` : o.mov !== undefined ? `MOVE ${o.mov} → ${o.to}` : `${o.to} := ${o.calc}`;
  return JSON.stringify({
    il: ilText(PROGRAM), scl: genSCL(PROGRAM),
    nets: PROGRAM.networks.map((n) => ({ title: n.title, comment: n.comment, rungs: n.rungs.map((r) => ({ c: r.in ? tx(r.in) : "always", o: (r.out || []).map(ox).join(", ") || "(timer only)", k: r.comment || "" })) })),
    tags: PROGRAM.tags.map((t) => ({ n: t.name, d: t.dir, de: t.delta || "", si: t.siemens || "", c: t.comment || "", w: t.wire || "", pt: t.pt, pv: t.pv, u: t.unit || "", mn: t.min, mx: t.max })),
  });
}
window.srLad = { ui: () => UI, selfTest, dump };
