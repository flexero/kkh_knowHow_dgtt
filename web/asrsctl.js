/* AS/RS tab – item 2 "Control system" (UI, #srItem2). Built lazily on window event "sritemshow" (detail "2").
 * Cards: 1 control architecture (click blocks, live) · 2 crane motion control (live profiles of the current move, S-curve
 * comparison, positioning, mast sway, cascade loop) · 3 job sequence + step chain + error handling + modes · 4 safety (live
 * safety state machine, fault injection, stopping distance) · 5 conveyor control at the I/O + handshake · 6 energy (DC link,
 * regeneration) · 7 KPIs + alarm / event log · card "Real components + drawings" (#srCard2, makeCard from robotref.js).
 * Live data: window.ASRS.sim (asrscore.js – shared with items 1, 3, 4; faults injected here are seen there).
 * Math: asrsctl_core.js · card data: asrsctl_data.js (generated from guide 32) · guide: docs/32_asrs_control_system.md
 * Test URL params: &sr2hold (headless: keep the load event pending + open the tab/item) · &sr2test (self-check, console "SR2TEST …")
 *   · &sr2safe=estop|door|overspeed (start with that safety demo) · &sr2blk=plc (open an architecture info box) · &sr2goto=s2Safe
 * Offline, no libraries. ALL VALUES ARE EXAMPLES – the AS/RS supplier's offer decides.
 */
import { getASRS, CRANE, RACK, IO, SKU, trapTime } from "./asrscore.js";
import * as K from "./asrsctl_core.js";
import { makeCard } from "./robotref.js";
import { CARD2 } from "./asrsctl_data.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const css = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
const f = (v, d = 1) => (v === null || v === undefined || !isFinite(v) ? "–" : (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d));
const box = $("srItem2");
const C_T = "#2a78d6", C_H = "#d0742a", C_S = "#7a5bd0", C_G = "#2f9e44";
let built = false, UI = null;
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message || String(e)));
window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));

/* ------------------------------------------------------------------ test hold (headless screenshots) */
if (Q.has("sr2hold")) {
  const fr = document.createElement("iframe"); fr.src = "/api/stream?sr2hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function") window.showTab("asrs"); else { const b = document.querySelector('[data-tab="asrs"]'); if (b) b.click(); }
    setTimeout(() => window.srCtl && window.srCtl.showItem("2"), 100); }, 300);
}

/* ------------------------------------------------------------------ canvas chart (envelope per pixel) */
function niceStep(range, n = 5) { const r = range / n, p = Math.pow(10, Math.floor(Math.log10(r || 1))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function chart(cv, o) {
  if (!cv || !cv.isConnected || !cv.clientWidth) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = +cv.getAttribute("height") || 150;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  cv.style.height = H + "px";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ml = 50, mr = 10, mt = 8, mb = 22, pw = W - ml - mr, ph = H - mt - mb;
  const [x0, x1] = o.xr; let lo = Infinity, hi = -Infinity;
  for (const s of o.series) for (const v of s.y) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (const h of o.hl || []) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < (o.minSpan || 1e-6)) { const c = (hi + lo) / 2, h = (o.minSpan || 1) / 2; lo = c - h; hi = c + h; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = (x) => ml + (x - x0) / ((x1 - x0) || 1) * pw, Y = (y) => mt + (hi - y) / (hi - lo) * ph;
  const cText = css("--text-2", "#555"), cGrid = css("--grid", "#ddd");
  g.font = "11px system-ui, sans-serif"; g.fillStyle = cText; g.strokeStyle = cGrid; g.lineWidth = 1;
  const ys = niceStep(hi - lo, Math.max(3, Math.floor(ph / 30)));
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(ml, y); g.lineTo(ml + pw, y); g.stroke(); g.fillText((Math.abs(v) < ys * 1e-6 ? 0 : +v.toPrecision(4)) + "", ml - 5, y); }
  const xs = niceStep(x1 - x0, Math.max(3, Math.floor(pw / 80)));
  g.textAlign = "center"; g.textBaseline = "top";
  for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + 1e-9; v += xs) { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, mt); g.lineTo(x, mt + ph); g.stroke(); g.fillText(+v.toPrecision(4) + (o.xu || ""), x, mt + ph + 5); }
  if (lo < 0 && hi > 0) { g.strokeStyle = css("--axis", "#bbb"); g.beginPath(); g.moveTo(ml, Y(0)); g.lineTo(ml + pw, Y(0)); g.stroke(); }
  for (const h of o.hl || []) { g.strokeStyle = h.c; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(ml, Y(h.y)); g.lineTo(ml + pw, Y(h.y)); g.stroke(); g.setLineDash([]);
    if (h.n) { g.fillStyle = h.c; g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText(h.n, ml + 4, Y(h.y) - 2); } }
  g.save(); g.beginPath(); g.rect(ml, mt, pw, ph); g.clip();
  for (const s of o.series) {
    g.strokeStyle = s.c; g.lineWidth = s.w || 1.7; g.setLineDash(s.dash || []); g.beginPath();
    const xx = s.x || o.x; let first = true;
    for (let i = 0; i < s.y.length; i++) { const px = X(xx[i]), py = Y(s.y[i]); if (s.step && !first) g.lineTo(px, Y(s.y[i - 1])); if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py); }
    g.stroke(); g.setLineDash([]);
  }
  if (o.cursor !== undefined && o.cursor !== null) { g.strokeStyle = css("--text", "#000"); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(o.cursor), mt); g.lineTo(X(o.cursor), mt + ph); g.stroke(); g.globalAlpha = 1; }
  g.restore();
  g.strokeStyle = css("--axis", "#bbb"); g.strokeRect(ml + 0.5, mt + 0.5, pw, ph);
  if (o.yu) { g.save(); g.fillStyle = cText; g.translate(11, mt + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.yu, 0, 0); g.restore(); }
}
const legend = (items) => `<div class="s2-leg">${items.map((i) => `<span><i style="background:${i.c}${i.dash ? `;background:repeating-linear-gradient(90deg,${i.c} 0 5px,transparent 5px 8px)` : ""}"></i>${esc(i.n)}</span>`).join("")}</div>`;

/* ------------------------------------------------------------------ static texts */
const BLK = {
  erp: { t: "ERP (level 4)", w: "Material master (SKU, unit load, weight), purchase orders, goods receipt posting, stock value, MRP / reorder point. Does NOT know slots – only the storage location ASRS-RAW and the quantity.", v: "VLAN 10 ENT-OFFICE, via the DMZ gateway vc-dmz-b2mml01 10.20.0.101 (guide 15) · messages: goods receipt, stock transfer, inventory difference (item 4)", f: "Interface down → WMS keeps working and buffers the postings (store-and-forward). Check: daily stock reconciliation ERP ↔ WMS." },
  mes: { t: "MES (level 3)", w: "Calls raw material to the line (kanban / call-off), links the casting lot to the compressor serial number (traceability). Sends retrieval requests to the WMS.", v: "vc-ops-mes01 10.30.0.100, VLAN 30 OT-L3-OPS · OPC UA / REST", f: "MES down → line call-offs by HMI at the WCS (manual request). Check: call-off to load-ready time (target e.g. < 10 min)." },
  wms: { t: "WMS (level 3)", w: "Stock per slot, lot and date; slotting rule (store near the front, ABC), FIFO by lot, inventory counts, blocked stock. Creates transport orders (store / retrieve) for the WCS.", v: "vc-ops-wms01 10.30.0.104 (guide 15) · twin: slots, lots and the FIFO rule of asrscore.js · item 4 of this tab", f: "Double storage / empty slot = WMS stock ≠ real stock → inventory count of that slot, correction booking." },
  wcs: { t: "WCS / material flow controller (level 2)", w: "Takes the WMS transport orders, builds crane jobs, pairs a store with a retrieval (dual command), decides the order of the jobs, sends fixed-length telegrams to the crane PLC and the conveyor PLC, tracks every load (load unit ID) on the conveyors. Watches telegram time-outs.", v: "WCS PC vc-log-wcsraw01 10.54.0.100 (decided 2026-11-13, guide 15 D-32) · TCP telegram or OPC UA method call · live: see 'queue' below", f: "Telegram time-out (A0011), sequence number gap, wrong checksum → telegram repeated, after 3 tries alarm. Check: life-bit every 1 s." },
  hmi: { t: "HMI + SCADA", w: "Crane HMI at the I/O point: mode selector (AUTO / SEMI / MANUAL), jog buttons with hold-to-run, alarm list, step chain display, slot map, manual telegram entry. SCADA shows the AS/RS overview and alarms for the whole factory.", v: "HMI vc-log-asrsraw-hmi 10.54.0.101 (proposal) · SCADA vc-sup-scada01/02 10.40.0.100/.101 · screen SCR3_LOG_L0_ASRSRAW (guide 15)", f: "Operator panel frozen → crane keeps the last mode; the e-stop at the panel is hard-wired, not via the HMI." },
  plc: { t: "Crane PLC (fail-safe) PLC-ASRS-RAW", w: "Runs the crane step chain (job steps 10 … 60, card 3), the axis positioning commands to the drives (PROFIdrive telegrams), and in the same CPU the fail-safe program (F-program): e-stop, door interlock, safe speed in the end zones, overspeed, slack rope, fork-centre interlock (card 4). Gets positions from the laser and bar-code sensors.", v: "Siemens S7-1515F-2 PN, 10.54.0.31, host vc-log-plcasrsraw (guides 05, 15) · cycle e.g. 4 ms, F-cycle e.g. 20 ms (example) · tags LOG_L0_ASRSRAW_…", f: "CPU STOP → all drives STO (PROFIsafe watchdog). Check: F-signature + collective signature recorded in the acceptance report." },
  conv: { t: "Conveyor control (I/O)", w: "Infeed + outfeed conveyors with zones (zero-pressure accumulation), ID point (bar-code / RFID), contour check, weighing, reject lane. Usually in the same F-CPU (own program block) with a remote I/O station at the conveyors.", v: "ET 200SP station vc-log-asrsraw-io1 10.54.0.153 (proposal) · RFID readers 10.54.0.150/.151 (guide 15) · scanner 10.54.0.152 (proposal)", f: "Zone time-out (jam, A7041), no-read (A7011), contour (A7021), overweight (A7031) → reject lane." },
  link: { t: "Optical data link to the moving crane", w: "Two infrared transceivers (one fixed at the aisle end, one on the crane) carry PROFINET + PROFIsafe without cables or slip rings. Line of sight along the aisle; the crane PLC talks to the drives and sensors on the crane through it.", v: "e.g. Leuze DDLS 500 or SICK ISD400 class, 100 Mbit/s, range ≥ aisle length 28 m (check) · a 66-byte telegram needs 66 × 8 / 100 Mbit/s = 5.3 µs", f: "Dirty lens or misalignment → link quality drops → PROFIsafe watchdog → SS1 stop (A0021). Check: link-quality bar graph, clean lenses every 3 months (example)." },
  drv: { t: "Drives on the crane (travel, hoist, fork)", w: "Servo / frequency inverters on one common DC link (shared supply module). Travel: 2 wheel motors (front + rear) with speed synchronisation; hoist: 1 motor with drum or belt; fork: 1 motor. Safety integrated: STO, SS1, SLS, SBC over PROFIsafe.", v: "e.g. SINAMICS S120 / S210, SEW MOVI-C, Lenze i950 class · travel ≈ 2 × 5.5 kW, hoist ≈ 15 kW, fork ≈ 1.5 kW (example sizing, card 6)", f: "Following error (A4011), overcurrent, DC-link overvoltage (braking resistor too small). Check: drive trace of current and DC voltage during a full-speed stop." },
  sens: { t: "Positioning sensors", w: "Travel: laser distance sensor at the crane measuring to a reflector at the aisle end (absolute, no homing). Hoist: bar-code positioning tape along the mast (absolute). Fork: absolute encoder. Fine positioning: reflex sensors on the fork find the slot reference mark (beam edge / reflector) – corrects rack tolerances.", v: "e.g. SICK DL100 Pro / Leuze AMS 300i (travel), Leuze BPS 300i / SICK OLM (hoist), slot reference sensor, encoder · tolerance ±3 mm (example)", f: "Laser beam interrupted, dirty reflector, bar-code tape damaged → position invalid → stop. Check: plausibility laser vs wheel encoder (difference < 20 mm)." },
  safe: { t: "Safety field devices", w: "E-stop buttons (HMI, crane, aisle doors), aisle door switches with guard locking (access permission), light curtains with muting at the I/O, end-of-aisle switches + buffers, hoist overspeed, slack-rope switch, load cell (overload), fork centre sensors.", v: "e.g. SICK, Pilz, Euchner, Schmersal, Leuze · PL d per function (risk assessment, card 4)", f: "Bridged door switch, muting sensors misaligned (forklift breaks through) → test every function at acceptance and once a year." },
  fld: { t: "I/O conveyor field devices", w: "Bar-code scanner / RFID reader at the ID point, light grid for the contour check (height, overhang left / right / front / back), platform scale in a conveyor zone, motor-roller zones (24 V MDR) or chain conveyor with VFD.", v: "contour tolerance e.g. ±20 mm per side · weight limit 300 kg per crate (RACK.maxLoad) · conveyor 0.2 m/s", f: "Wrong reading → load to the reject lane, operator relabels or repacks." },
};
const SF = [
  { id: "SF1", k: "estop", n: "Emergency stop", s: "E-stop buttons (HMI, aisle doors, crane), 2 channels", l: "F-CPU, PROFIsafe", a: "SS1 → STO travel, hoist, fork + SBC", pl: "d", cat: "1", alm: "A1011" },
  { id: "SF2", k: "door", n: "Aisle door interlock + access permission", s: "door switch with guard locking (e.g. Euchner MGB), request button", l: "F-CPU: crane to safe position, standstill monitored, then unlock", a: "SS1 → STO + SBC, door unlocked", pl: "d", cat: "1", alm: "A1021" },
  { id: "SF3", k: "sls", n: "Safe reduced speed near the aisle ends (SLS)", s: "safe position (laser 2-channel + wheel encoder)", l: "drive Safety Integrated or F-CPU", a: "SS1 if v > 1.0 m/s in the last 8 m", pl: "d", cat: "1", alm: "A1051" },
  { id: "SF4", k: "overrun", n: "End-of-aisle overrun protection", s: "safety limit switches + safe position, buffers", l: "F-CPU", a: "Stop Cat 0 + brakes; buffers absorb the rest", pl: "d", cat: "0", alm: "A1041" },
  { id: "SF5", k: "overspeed", n: "Hoist overspeed", s: "safe speed from encoder / governor", l: "drive SLS / SSM + F-CPU", a: "Stop Cat 0 + SBC; safety gear catches at 130 %", pl: "d", cat: "0", alm: "A1061" },
  { id: "SF6", k: "slack", n: "Slack rope / belt", s: "slack-rope switch (2 channels)", l: "F-CPU", a: "Stop Cat 0 + SBC on the hoist", pl: "c", cat: "0", alm: "A1071" },
  { id: "SF7", k: "overload", n: "Hoist overload", s: "load cell / load pin on the carriage", l: "F-CPU (110 % limit)", a: "no lift; crane stops (Cat 1)", pl: "c", cat: "1", alm: "A5011" },
  { id: "SF8", k: "fork", n: "Fork centre check before travel / hoist", s: "2 inductive sensors at fork centre", l: "F-CPU", a: "travel + hoist STO (no start)", pl: "d", cat: "1", alm: "A1081" },
  { id: "SF9", k: "curtain", n: "Light curtain at the I/O with muting for loads", s: "type 4 light curtain + 2 or 4 muting sensors", l: "F-CPU muting logic", a: "conveyor STO, crane fork blocked at I/O", pl: "d", cat: "0", alm: "A1031" },
  { id: "SF10", k: "link", n: "Communication watchdog (PROFIsafe over the optical link)", s: "F-telegram watchdog", l: "F-CPU + drives", a: "SS1 → STO all axes", pl: "d", cat: "1", alm: "A0021" },
];
const ERR = [
  { k: "noread", n: "Bar-code no-read at the infeed", d: "scanner gives no / unreadable code", alm: "A7011", r: "store job rejected, load to the reject lane (core: setFault scanner)", rec: "operator relabels, puts the load back on the infeed" },
  { k: "double", n: "Target slot occupied (double storage)", d: "fork-tip / slot occupancy sensor before fork out", alm: "A7051", r: "fork out blocked, slot blocked in the WMS, WCS sends a new target slot", rec: "inventory count of the slot, correction booking" },
  { k: "empty", n: "Slot empty at retrieval", d: "load sensor on the fork after lift / no load seen", alm: "A7061", r: "job aborted, stock correction to the WMS, MES informed", rec: "search the load (neighbour slots), count" },
  { k: "overweight", n: "Overweight crate (> 300 kg)", d: "scale at the infeed; load cell on the hoist", alm: "A5011", r: "infeed: reject lane; on the crane: stop, no lift (core: setFault overload)", rec: "repack the crate, check the material master weight" },
  { k: "contour", n: "Contour fault (overhang, height)", d: "light grid at the contour check", alm: "A7021", r: "load to the reject lane before the crane", rec: "straighten / repack the load" },
  { k: "collision", n: "Fork collision sensor", d: "bumper / force sensor at the fork tip or side", alm: "A4041", r: "fork stops, travel + hoist blocked (core: crane fault)", rec: "manual mode: retract the fork with hold-to-run, inspect" },
  { k: "jam", n: "Conveyor jam / zone time-out", d: "zone sensor not free after t_zone", alm: "A7041", r: "conveyor zone stops, crane does not pick at the I/O (core: convJam)", rec: "clear the jam, reset the zone" },
];
const SM = [["RUN", "Run (AUTO)"], ["SS1", "SS1 ramp (Stop Cat 1)"], ["STO", "STO + SBC (standstill, brakes)"], ["SAFE", "Safe – cause active"], ["RESET", "Reset required"]];
const HS = [   // I/O handshake signals (conveyor PLC block ↔ crane step chain, inside the same F-CPU or via PROFINET I-device)
  ["LoadReady_In", "conveyor → crane", "LOG_L0_ASRSRAW_IoIn_LoadReady", "load at the transfer position, ID + contour + weight OK, conveyor stopped"],
  ["TransferReq", "crane → conveyor", "LOG_L0_ASRSRAW_IoIn_TransferReq_Cmd", "crane fine-positioned at the I/O, asks for the transfer"],
  ["TransferEnable", "conveyor → crane", "LOG_L0_ASRSRAW_IoIn_TransferEnable", "conveyor drive locked off, muting active – fork may move out"],
  ["ForkOut_Fb", "crane → conveyor", "LOG_L0_ASRSRAW_ForkOut_Fb", "fork under the load"],
  ["LoadTaken", "crane → conveyor", "LOG_L0_ASRSRAW_IoIn_LoadTaken", "load lifted (load sensor on the fork ON)"],
  ["ForkCentre_Fb", "crane → conveyor", "LOG_L0_ASRSRAW_ForkCentre_Fb", "fork back in the centre – transfer finished"],
  ["PosFree", "conveyor → crane", "LOG_L0_ASRSRAW_IoIn_PosFree", "transfer position empty – next load may move in"],
];

/* ------------------------------------------------------------------ build */
function build() {
  const A = getASRS(), S = A.sim;
  const st = {
    lastMove: null, moveKey: "", prof: null, profS: null, sway: null, servo: null, energy: null,
    safety: { state: "RUN", cause: null, sf: null, cat: null, t0: 0, vTrip: 0, causeActive: false, alm: null },
    alarms: [], events: [], counts: { reads: 0, noread: 0, contour: 0, overweight: 0, rejects: 0 },
    plans: 0, dualPlans: 0, lastPlan: null, vPrev: 0, tFault: 0, tLast: S.t, energyTot: { inWh: 0, backWh: 0, moves: 0 }, finePos: null,
    ackOverload: null, tgSeq: 1, tg: null, semiArm: false, ref: null, blockedSlots: [], jog: 0, jogZ: 0, chart: 0,
  };
  const AL = (id, extra = "") => `${K.MACHINE}_${id}`;
  function raise(id, txt, lvl = "alarm") {
    const a = K.ALM[id], text = txt || (a ? a[1] : id);
    if (!st.alarms.find((x) => x.id === id && x.on)) st.alarms.unshift({ id, text, t: S.t, on: true, ack: false, lvl });
    st.events.unshift({ t: S.t, id, text, lvl }); if (st.events.length > 80) st.events.pop();
    S.logMsg(`${AL(id)} ${text}`, lvl === "alarm" ? "alarm" : "warn");
  }
  function clearAlarm(id) { st.alarms.forEach((a) => { if (a.id === id && a.on) { a.on = false; st.events.unshift({ t: S.t, id, text: "cleared – " + a.text, lvl: "info" }); } }); }

  const wrap = document.createElement("div"); wrap.className = "s2-wrap"; box.appendChild(wrap);
  wrap.innerHTML = `
  <div class="s2-strip" id="s2Strip"></div>
  <div class="card" id="s2Arch">
    <div class="card-head"><h2>1 · Control architecture – who decides what</h2><span class="sub">click a block · live values from the running twin · example network per guide 15 (VLAN 54 = OT-L1-LOG-ASRS)</span></div>
    <div class="s2-svgbox">${archSvg()}</div><div class="s2-info" id="s2ArchInfo"></div>
    <p class="s2-note">Rule of thumb: <b>WMS knows WHAT is where</b> (stock, lots, slots) · <b>WCS knows HOW it moves</b> (jobs, routes, telegrams, load tracking) · <b>PLC knows WHEN each axis moves and if it is SAFE</b> (step chain, positioning, safety functions, ms cycle) · <b>drives</b> close the position / speed / current loops (µs – ms).</p>
  </div>
  <div class="card" id="s2Motion">
    <div class="card-head"><h2>2 · Crane motion control – travel, hoist, fork</h2><span class="sub">profiles of the CURRENT move of the twin's crane (trapezoid, as the core) · S-curve comparison · positioning · sway · cascade loop</span></div>
    <div class="s2-row"><label><input type="checkbox" id="s2Sc" checked> show the S-curve (jerk-limited) profile for the same move</label>
      <label>travel jerk j <input type="range" id="s2J" min="0.2" max="3" step="0.1" value="${K.CC.jx}"> <b id="s2Jv"></b></label></div>
    <div class="s2-movehd" id="s2MoveHd"></div>
    <div class="s2-grid3">
      <div><h4>Position (m)</h4><canvas id="s2ChP" height="150"></canvas></div>
      <div><h4>Speed (m/s)</h4><canvas id="s2ChV" height="150"></canvas></div>
      <div><h4>Acceleration (m/s²)</h4><canvas id="s2ChA" height="150"></canvas></div>
    </div>
    ${legend([{ c: C_T, n: "travel x (trapezoid)" }, { c: C_H, n: "hoist z (trapezoid)" }, { c: C_T, n: "travel S-curve", dash: 1 }, { c: C_H, n: "hoist S-curve", dash: 1 }])}
    <div class="s2-formula" id="s2Form"></div>
    <h3 class="s2-h">Positioning – absolute measuring systems + fine positioning</h3>
    <div id="s2PosTbl" class="s2-tblwrap"></div><div id="s2Fine" class="s2-note"></div>
    <h3 class="s2-h">Mast sway – 2-mass model (base driven by the travel drive, mast top on a spring)</h3>
    <div class="s2-two"><div><canvas id="s2ChSw" height="170"></canvas>${legend([{ c: C_T, n: "trapezoid, no damping (ζ = 0.02)" }, { c: C_S, n: "S-curve, ramp = 1 mast period" }, { c: C_G, n: "trapezoid + active sway damping (ζ = 0.2)" }])}</div><div class="s2-formula" id="s2SwTxt"></div></div>
    <h3 class="s2-h">Positioning control loop – cascade position → speed → current (travel axis)</h3>
    <div class="s2-row"><label>K<sub>v</sub> <input type="range" id="s2Kv" min="0.5" max="4" step="0.1" value="${K.CC.Kv}"> <b id="s2KvV"></b> 1/s</label>
      <label>speed feedforward <select id="s2Ff"><option value="0">0 % (none)</option><option value="0.95" selected>95 %</option><option value="1">100 %</option></select></label></div>
    <div class="s2-two"><div><canvas id="s2ChSv" height="170"></canvas>${legend([{ c: C_T, n: "following error (mm)" }, { c: C_H, n: "drive force (kN)" }])}</div><div class="s2-formula" id="s2SvTxt"></div></div>
  </div>
  <div class="card" id="s2Seq">
    <div class="card-head"><h2>3 · Job sequence – WCS telegram → crane step chain</h2><span class="sub">active step highlighted live · dual command · error handling (inject) · modes · referencing</span></div>
    <div class="s2-two"><div><h4>WCS → crane telegram of the active job (fixed length, example)</h4><pre class="s2-tg" id="s2Tg"></pre><div id="s2TgTbl"></div></div>
      <div><h4>Crane step chain (GRAFCET numbers = timeout alarm A8sss)</h4><div id="s2Chain" class="s2-chain"></div></div></div>
    <h3 class="s2-h">Error handling – detection, alarm, reaction (buttons inject the fault into the shared twin)</h3>
    <div class="s2-tblwrap"><table class="s2-tbl"><thead><tr><th>Condition</th><th>Detected by</th><th>Alarm</th><th>Reaction (automatic)</th><th>Recovery</th><th></th></tr></thead><tbody>
      ${ERR.map((e) => `<tr><td>${esc(e.n)}</td><td>${esc(e.d)}</td><td><code>${AL(e.alm)}</code></td><td>${esc(e.r)}</td><td>${esc(e.rec)}</td><td><button class="btn s2-inj" data-err="${e.k}">inject</button></td></tr>`).join("")}
    </tbody></table></div>
    <h3 class="s2-h">Operating modes + referencing</h3>
    <div class="s2-two"><div><div class="s2-row" id="s2Modes">${["AUTO", "SEMI", "MANUAL"].map((m) => `<button class="btn s2-mode" data-mode="${m}">${m}</button>`).join("")}
      <button class="btn" id="s2Semi" title="SEMI: execute exactly one job, then stop">SEMI: run 1 job</button></div>
      <div class="s2-row" id="s2Jog"><span>MANUAL hold-to-run (0.3 m/s safe limited speed):</span>${[["x", -1, "travel −"], ["x", 1, "travel +"], ["z", 1, "hoist up"], ["z", -1, "hoist down"]].map(([a, d, n]) => `<button class="btn s2-jog" data-ax="${a}" data-d="${d}">${n}</button>`).join("")}</div>
      <div id="s2ModeTxt" class="s2-note"></div></div>
      <div><button class="btn" id="s2Ref">reference check (after power-on)</button><div id="s2RefTxt" class="s2-note"></div></div></div>
  </div>
  <div class="card" id="s2Safe">
    <div class="card-head"><h2>4 · Safety – EN 528 + ISO 13849 safety functions, live safety state machine</h2><span class="sub">inject a fault → watch the stop category, STO / SBC and the reset · shared with items 1, 3, 4</span></div>
    <div class="s2-tblwrap"><table class="s2-tbl"><thead><tr><th>ID</th><th>Safety function</th><th>Sensor</th><th>Logic</th><th>Reaction</th><th>PL<sub>r</sub></th><th>Stop cat.</th><th>Alarm</th><th></th></tr></thead><tbody>
      ${SF.map((s) => `<tr data-sf="${s.id}"><td>${s.id}</td><td>${esc(s.n)}</td><td>${esc(s.s)}</td><td>${esc(s.l)}</td><td>${esc(s.a)}</td><td>${s.pl}</td><td>${s.cat}</td><td><code>${AL(s.alm)}</code></td><td><button class="btn s2-sf" data-sf="${s.id}">trip</button></td></tr>`).join("")}
    </tbody></table></div>
    <div class="s2-two"><div>${smSvg()}<div class="s2-row"><button class="btn" id="s2Cause">remove cause / release</button><button class="btn primary" id="s2Reset">reset (acknowledge)</button></div><div id="s2SafeTxt" class="s2-note"></div></div>
      <div><h4>Stopping distance of the travel axis</h4><div class="s2-row"><label>speed <input type="range" id="s2Vs" min="0.5" max="3" step="0.1" value="3"> <b id="s2VsV"></b> m/s</label></div>
        <canvas id="s2ChSt" height="160"></canvas>${legend([{ c: C_T, n: "Stop Cat 1: drive ramp 1.0 m/s²" }, { c: C_H, n: "Stop Cat 0: mechanical brake 0.7 m/s²" }])}<div class="s2-formula" id="s2StTxt"></div></div></div>
  </div>
  <div class="card" id="s2Conv">
    <div class="card-head"><h2>5 · Conveyor control at the I/O – zones, ID point, contour, weighing, reject lane</h2><span class="sub">live loads on the infeed / outfeed · handshake with the crane</span></div>
    <div class="s2-svgbox" id="s2ConvSvg"></div>
    <div class="s2-two"><div><h4>I/O handshake signals (crane ↔ conveyor)</h4><div class="s2-tblwrap"><table class="s2-tbl"><thead><tr><th>Signal</th><th>Direction</th><th>Tag (guide 15)</th><th>Meaning</th><th>now</th></tr></thead><tbody id="s2HsBody"></tbody></table></div></div>
      <div><h4>Handshake timing – pick at the infeed (s from "crane at I/O")</h4><canvas id="s2ChHs" height="210"></canvas><div class="s2-note" id="s2HsTxt"></div></div></div>
  </div>
  <div class="card" id="s2Energy">
    <div class="card-head"><h2>6 · Energy – shared DC link, regenerative braking</h2><span class="sub">electrical power of travel + hoist for the current move (negative = energy fed back into the DC link)</span></div>
    <div class="s2-two"><div><canvas id="s2ChE" height="180"></canvas>${legend([{ c: C_T, n: "travel drive (kW)" }, { c: C_H, n: "hoist drive (kW)" }, { c: C_S, n: "DC link sum (kW)" }])}</div><div class="s2-formula" id="s2ETxt"></div></div>
  </div>
  <div class="card" id="s2Kpi">
    <div class="card-head"><h2>7 · KPIs + alarm / event log</h2><span class="sub">alarm numbers per guide 15: ${K.MACHINE}_A&lt;g&gt;&lt;dd&gt;&lt;n&gt; · group 8 = step time-out A8sss</span></div>
    <div class="s2-tiles" id="s2Tiles"></div>
    <div class="s2-two"><div><h4>Active alarms</h4><div id="s2Alm"></div></div><div><h4>Event log (newest first)</h4><div id="s2Log" class="s2-log"></div></div></div>
  </div>`;

  /* ---------------- architecture */
  let blkSel = Q.get("sr2blk") || "plc";
  const archInfo = () => {
    const b = BLK[blkSel]; if (!b) return;
    wrap.querySelectorAll("[data-blk]").forEach((g) => g.classList.toggle("on", g.dataset.blk === blkSel));
    $("s2ArchInfo").innerHTML = `<h4>${esc(b.t)}</h4><p>${esc(b.w)}</p><p><b>Example data:</b> ${esc(b.v)}</p><p><b>Faults / checks:</b> ${esc(b.f)}</p><p class="s2-live"><b>Live:</b> ${esc(liveOf(blkSel))}</p>`;
  };
  wrap.querySelectorAll("[data-blk]").forEach((g) => g.addEventListener("click", () => { blkSel = g.dataset.blk; archInfo(); }));
  function liveOf(k) {
    const c = S.crane, q = S.queue.filter((j) => j.state === "queued").length, act = S.queue.filter((j) => j.state === "active");
    switch (k) {
      case "erp": return `stock ${Object.entries(S.stock()).map(([s, v]) => `${s} ${v.loads}`).join(" · ")} loads`;
      case "mes": return `retrievals done ${S.stats.retrievals}, loads on the outfeed to the line ${S.outConv.length}`;
      case "wms": return `fill ${f(S.fill() * 100, 0)} % of ${RACK.slots} slots, blocked ${S.slots.filter((s) => s.blocked).length}`;
      case "wcs": return `queue ${q} jobs waiting · active ${act.map((j) => j.id + " " + j.type).join(", ") || "none"} · dual command ${S.rates.dual ? "ON" : "OFF"}`;
      case "hmi": return `mode ${c.mode} · safety ${st.safety.state} · alarms active ${st.alarms.filter((a) => a.on).length}`;
      case "plc": return `phase ${c.phase} · step ${curStep()} · e-stop ${S.estop ? "ON" : "off"} · crane fault ${S.faults.crane ? "ON" : "off"}`;
      case "conv": return `infeed ${S.inConv.length} loads · outfeed ${S.outConv.length} · jam ${S.faults.convJam ? "ON" : "off"}`;
      case "link": return S.estop || S.faults.crane ? "link OK, crane in safe state" : "link OK · PROFIsafe watchdog running";
      case "drv": return `travel v = ${f(c.vx, 2)} m/s · hoist v = ${f(c.vz, 2)} m/s · fork ${f(c.fork, 2)} (−1 L … +1 R) · ${S.estop || S.faults.crane ? "STO active" : "pulses enabled"}`;
      case "sens": return `laser ${f((c.x + K.CC.laserOff) * 1000, 0)} mm · bar-code ${f(c.z * 1000, 0)} mm · fork ${f(c.fork * (RACK.aisle / 2 + RACK.crateL / 2) * 1000, 0)} mm`;
      case "safe": return `safety state ${st.safety.state}${st.safety.cause ? " – cause " + st.safety.cause : ""}`;
      case "fld": return `reads OK ${st.counts.reads} · no-reads ${st.counts.noread} · rejects ${st.counts.rejects}`;
    }
    return "";
  }
  if (Q.get("sr2blk")) archInfo();

  /* ---------------- motion */
  const curMove = () => {
    const c = S.crane;
    if (c.plan) { for (let i = c.plan.i; i >= 0; i--) { const s = c.plan.segs[i]; if (s.ph === "toIO" || s.ph === "toSlot") return { seg: s, t: i === c.plan.i ? c.plan.segT : s.dur, live: i === c.plan.i, key: c.plan.t0 + ":" + i }; } }
    return st.lastMove || { seg: { ph: "example (no crane move yet)", x0: 0, z0: CRANE.zIO, x1: 26, z1: 5.75, dur: K.moveProfile(26, 5).T }, t: 0, live: false, key: "demo" };
  };
  function motionUpdate(force) {
    const m = curMove();
    if (m.key !== "demo") st.lastMove = { ...m, t: m.seg.dur, live: false };
    const key = m.key + ":" + $("s2J").value;
    const s = m.seg, dx = s.x1 - s.x0, dz = s.z1 - s.z0;
    if (key !== st.moveKey || force) {
      st.moveKey = key; K.CC.jx = +$("s2J").value;
      st.prof = K.moveProfile(dx, dz); st.profS = K.moveProfile(dx, dz, { scurve: true });
      const T = st.prof.T, Ts = st.profS.T, tx = trapTime(dx, CRANE.vx, CRANE.ax), tz = trapTime(dz, CRANE.vz, CRANE.az), lead = tx >= tz ? "travel" : "hoist";
      const vs = lead === "travel" ? K.syncSpeed(dz, tx) : null;
      $("s2Form").innerHTML = `<b>This move:</b> Δx = ${f(dx, 2)} m, Δz = ${f(dz, 2)} m · travel ${f(tx, 2)} s, hoist ${f(tz, 2)} s → move time = max = <b>${f(T, 2)} s</b> (${lead} axis leads; both axes start together).<br>
        Trapezoid (full speed reached when d ≥ v²/a): T = d/v + v/a; else triangle T = 2·√(d/a). Travel: v²/a = 3²/0.5 = 18 m.<br>
        S-curve (jerk j, a reached): T = d/v + v/a + a/j → extra time a/j = ${f(CRANE.ax, 1)}/${f(K.CC.jx, 1)} = ${f(CRANE.ax / K.CC.jx, 2)} s per travel move. This move: S-curve <b>${f(Ts, 2)} s</b>, difference <b>${f(Ts - T, 2)} s</b> (${f((Ts - T) / Math.max(T, 1e-6) * 100, 1)} %).<br>
        ${vs !== null && Math.abs(dz) > 0.01 ? `Synchronised axes option: the hoist could run at v' = ${f(vs, 3)} m/s instead of 1.0 m/s and still arrive with the travel (d = v'·(T − v'/a)) – less peak power, smoother load.` : "Hoist leads: the travel could run slower and still arrive together."}`;
    }
    const c = S.crane;
    $("s2MoveHd").innerHTML = `${m.live ? "<b class='s2-on'>LIVE</b>" : "last move"} · ${s.ph} · from x ${f(s.x0, 2)} / z ${f(s.z0, 2)} m to x ${f(s.x1, 2)} / z ${f(s.z1, 2)} m · t = ${f(m.t, 1)} / ${f(s.dur, 1)} s · crane now x ${f(c.x, 2)} m, z ${f(c.z, 2)} m, v<sub>x</sub> ${f(c.vx, 2)} m/s, v<sub>z</sub> ${f(c.vz, 2)} m/s`;
    const sc = $("s2Sc").checked, P = st.prof, PS = st.profS, xr = [0, Math.max(P.T, sc ? PS.T : 0)];
    const ser = (k1, k2) => [{ y: P[k1], c: C_T }, { y: P[k2], c: C_H }].concat(sc ? [{ y: PS[k1], x: PS.t, c: C_T, dash: [5, 4], w: 1.3 }, { y: PS[k2], x: PS.t, c: C_H, dash: [5, 4], w: 1.3 }] : []);
    chart($("s2ChP"), { x: P.t, xr, xu: " s", series: ser("x", "z"), cursor: m.t });
    chart($("s2ChV"), { x: P.t, xr, xu: " s", series: ser("vx", "vz"), cursor: m.t, minSpan: 0.5 });
    chart($("s2ChA"), { x: P.t, xr, xu: " s", series: ser("ax", "az"), cursor: m.t, minSpan: 0.5 });
  }
  function posUpdate() {
    const c = S.crane, fk = c.fork * (RACK.aisle / 2 + RACK.crateL / 2) * 1000;
    $("s2PosTbl").innerHTML = `<table class="s2-tbl"><thead><tr><th>Axis</th><th>Measuring system (example)</th><th>Live reading</th><th>Resolution / repeatability</th><th>Tolerance</th></tr></thead><tbody>
      <tr><td>Travel x</td><td>laser distance sensor on the crane → reflector at the aisle end (absolute)</td><td>${f((c.x + K.CC.laserOff) * 1000, 0)} mm</td><td>0.1 mm / ≈ ±1 mm (see datasheet)</td><td>±${K.CC.tolX} mm</td></tr>
      <tr><td>Hoist z</td><td>bar-code tape along the mast + reader on the carriage (absolute)</td><td>${f(c.z * 1000, 0)} mm</td><td>0.01–0.1 mm / ≈ ±0.5 mm</td><td>±${K.CC.tolZ} mm</td></tr>
      <tr><td>Fork y</td><td>multi-turn absolute encoder on the fork motor</td><td>${f(fk, 0)} mm</td><td>&lt; 0.1 mm</td><td>±5 mm, centre ±2 mm</td></tr>
      <tr><td>Fine pos.</td><td>reflex sensor on the carriage finds the slot reference mark</td><td>${st.finePos ? f(st.finePos.e, 1) + " mm" : "–"}</td><td>edge ≈ ±0.5 mm</td><td>window ±${K.CC.tolX} mm</td></tr></tbody></table>`;
    const fp = st.finePos;
    $("s2Fine").innerHTML = `<p><b>Fine positioning (phase "pos", ${CRANE.tPos} s in the twin):</b> the coarse move stops on the absolute value of the slot from the slot table (taught at commissioning). Then the slot reference sensor looks for the reference mark on the rack beam; the PLC corrects x and z with creep speed (e.g. 0.05 m/s) until the error is inside ±${K.CC.tolX} mm. Reason: the rack is not exact (EN 15620 tolerances, floor settlement, temperature) – the sensor measures the real slot.</p>
      <p class="s2-live">${fp ? `${fp.slot}: start error ${f(fp.e0, 1)} mm → now <b>${f(fp.e, 1)} mm</b> ${Math.abs(fp.e) <= K.CC.tolX ? "<b class='s2-ok'>IN WINDOW</b>" : "correcting …"}` : "no fine positioning active"}</p>
      <p><b>Accuracy budget travel (RSS):</b> laser repeatability ±1 + reflector / mounting ±1 + control error at standstill ±1 + residual mast sway ±2 + fine-position sensor ±0.5 → √(1²+1²+1²+2²+0.5²) = <b>±2.7 mm</b> &lt; ±${K.CC.tolMax} mm (worst-case sum 5.5 mm).</p>`;
  }
  function swayUpdate() {
    const m = st.lastMove; const dx = m ? m.seg.x1 - m.seg.x0 : 20, d = Math.abs(dx) > 0.5 ? dx : 20;
    const key = "sw" + f(d, 2) + K.CC.jx; if (st.sway && st.sway.key === key) return;
    const P = K.moveProfile(d, 0, { n: 600 }), PS = K.moveProfile(d, 0, { scurve: true, n: 600 }), jT = K.CC.jx;
    K.CC.jx = CRANE.ax * K.CC.fMast; const PT = K.moveProfile(d, 0, { scurve: true, n: 600 }); K.CC.jx = jT;
    const fn = (p) => (t) => p.ax[Math.min(p.t.length - 1, Math.round(t / p.T * (p.t.length - 1)))];
    const a = K.swaySim(fn(P), P.T), b = K.swaySim(fn(PT), PT.T), c = K.swaySim(fn(P), P.T, { zeta: K.CC.zetaActive });
    st.sway = { key, a, b, c, d, P, PS, PT };
    const w = 2 * Math.PI * K.CC.fMast;
    chart($("s2ChSw"), { x: a.t, xr: [0, a.t[a.t.length - 1]], xu: " s", yu: "mast top (mm)", series: [{ y: a.q, c: C_T, w: 1.4 }, { y: b.q, x: b.t, c: C_S, w: 1.4 }, { y: c.q, x: c.t, c: C_G, w: 1.4 }] });
    $("s2SwTxt").innerHTML = `<b>Model:</b> mast = spring + top mass; the drive moves the base. Relative top deflection q: q'' + 2ζω·q' + ω²·q = −a(t), ω = 2π·f.<br>
      Example first mast mode f = ${K.CC.fMast} Hz → ω = ${f(w, 2)} rad/s, period ${f(1 / K.CC.fMast, 3)} s.<br>
      Static deflection during acceleration: q = a/ω² = 0.5 / ${f(w * w, 1)} = <b>${f(a.static, 1)} mm</b>. Each JUMP of the acceleration (trapezoid) starts an oscillation of this size.<br>
      Move of ${f(d, 1)} m: residual sway (max from 1 s after the stop) – trapezoid <b>${f(a.residual, 1)} mm</b>, below ±2 mm only after ${a.settle2 >= 3.9 ? "&gt; 4" : f(a.settle2, 1)} s (ζ = ${K.CC.zeta}, needs ln(10)/(ζω) = ${f(Math.log(10) / (K.CC.zeta * w), 1)} s to fall to 10 %) · S-curve with ramp time = 1 period (j = a·f = ${f(CRANE.ax * K.CC.fMast, 2)} m/s³) <b>${f(b.residual, 1)} mm</b> · active damping (drive feeds back the mast-top acceleration, effective ζ = ${K.CC.zetaActive}) <b>${f(c.residual, 1)} mm</b>, below ±2 mm after ${f(c.settle2, 1)} s.<br>
      Residual factor after one ramp of time t<sub>r</sub>: |sin(π f t<sub>r</sub>)/(π f t<sub>r</sub>)| → 0 when t<sub>r</sub> = 1/f, 2/f … (input shaping). Fine positioning waits until |q| &lt; ±2 mm.`;
  }
  function servoUpdate() {
    const m = st.lastMove; const dx = m ? Math.abs(m.seg.x1 - m.seg.x0) : 20, d = dx > 0.5 ? dx : 20;
    const Kv = +$("s2Kv").value, ff = +$("s2Ff").value, key = `${f(d, 2)}:${Kv}:${ff}`; $("s2KvV").textContent = f(Kv, 1);
    if (st.servo && st.servo.key === key) return;
    const o = K.servoSim(d, { Kv, ff }); st.servo = { key, o };
    chart($("s2ChSv"), { x: o.t, xr: [0, o.t[o.t.length - 1]], xu: " s", series: [{ y: o.err, c: C_T }, { y: o.F, c: C_H, w: 1.2 }] });
    const w = 2 * Math.PI * K.CC.fMast;
    $("s2SvTxt").innerHTML = `<b>Cascade</b> (drive, outer to inner): position P-loop K<sub>v</sub> → speed PI-loop → current (force) loop → motor + crane mass m = ${K.CC.mTravel} kg.<br>
      Tuning (example): current loop T<sub>c</sub> = ${K.CC.Tc * 1000} ms · speed loop K<sub>p</sub> = m·ω<sub>v</sub> = ${K.CC.mTravel} × ${K.CC.wv} = <b>${f(o.Kp / 1000, 0)} kN·s/m</b>, T<sub>i</sub> = 4/ω<sub>v</sub> = ${K.CC.Ti} s · position K<sub>v</sub> ≤ 0.3·ω<sub>mast</sub> = 0.3 × ${f(w, 2)} = ${f(0.3 * w, 2)} 1/s (the soft mast limits the gain).<br>
      Following error at constant speed without feedforward: e = v/K<sub>v</sub> = 3 / ${f(Kv, 1)} = <b>${f(CRANE.vx / Kv * 1000, 0)} mm</b>; with ${f(ff * 100, 0)} % speed feedforward: e = (1 − ff)·v/K<sub>v</sub> = <b>${f(o.eStatic, 0)} mm</b>.<br>
      Simulated move ${f(d, 1)} m: max following error <b>${f(o.eMax, 0)} mm</b>, error at the end of the profile ${f(o.eEnd, 1)} mm, settled to &lt; 1 mm after ${o.settle === null ? "&gt; 3" : f(o.settle, 2)} s. Force limit ${f(o.Fmax / 1000, 1)} kN.`;
  }

  /* ---------------- step chain + telegram */
  const curStep = () => { const c = S.crane; if (!c.plan) return K.STEP[c.phase] ? K.STEP[c.phase].n : 10; const ps = K.planSteps(c.plan); return ps[c.plan.i] ? ps[c.plan.i].n : 10; };
  function seqUpdate() {
    const c = S.crane, act = S.queue.filter((j) => j.state === "active");
    if (c.plan && c.plan !== st.lastPlan) { st.lastPlan = c.plan; st.plans++; if (c.plan.jobs.length === 2) st.dualPlans++; st.tgSeq++; }
    const j = act[0] || (S.done[0] || null);
    const kg = j ? (c.carrying ? c.carrying.kg : j.slot && j.slot.load ? j.slot.load.kg : SKU[j.sku].perLoad * SKU[j.sku].kg + 45) : 0;
    const tg = K.telegram(j, st.tgSeq, kg); st.tg = tg;
    $("s2Tg").textContent = tg ? tg.str : "no job yet";
    $("s2TgTbl").innerHTML = tg ? `<table class="s2-tbl s2-small"><tr>${K.TG_FIELDS.map(([n, l]) => `<th>${n}<br><small>${l} B</small></th>`).join("")}</tr><tr>${K.TG_FIELDS.map(([n]) => `<td><code>${esc(tg.vals[n])}</code></td>`).join("")}</tr></table>
      <p class="s2-note">${tg.len} bytes ASCII · Type ST = store, RT = retrieve · location code per guide 15 (ASRS-RAW-<b>A01L-L5-S05</b>) · Check = XOR of the data bytes (hex) · answer telegram from the PLC: same JobId + Status 00 = done, 1x = error (e.g. 11 no-read, 12 occupied, 13 empty, 14 overweight). OPC UA alternative: method <code>LOG_L0_ASRSRAW_Store(LU-ID, Target)</code> + state variables in the style of OPC 40001-1 (Machinery: identification, MachineryItemState, operation mode).</p>` : "";
    const ps = K.planSteps(c.plan);
    let html = `<div class="s2-cs ${!c.plan ? "on" : ""}"><b>10</b> ${esc(K.STEP.idle.t)}${!c.plan ? ` <span>(${esc(c.phase)})</span>` : ""}</div>`;
    if (c.plan) {
      html += `<div class="s2-dc">${c.plan.jobs.length === 2 ? `<b>Dual command</b>: store ${c.plan.jobs[0].id} → slot ${c.plan.jobs[0].slot.id}, then retrieve ${c.plan.jobs[1].id} ← ${c.plan.jobs[1].slot.id} in one trip` : `<b>Single command</b>: ${c.plan.jobs[0].type} ${c.plan.jobs[0].id} (${c.plan.jobs[0].slot.id})`}</div>`;
      html += ps.map((p) => { const on = p.i === c.plan.i, done = p.i < c.plan.i, pr = on ? Math.min(1, c.plan.segT / p.dur) : done ? 1 : 0;
        const lim = K.STEP[p.ph] && K.STEP[p.ph].to ? (K.STEP[p.ph].to < 2 ? K.STEP[p.ph].to * p.dur + 2 : K.STEP[p.ph].to) : null;
        return `<div class="s2-cs ${on ? "on" : ""} ${done ? "done" : ""}"><b>${p.n}</b> ${esc(p.t)} <span>${p.job.id} ${p.what} · ${f(p.dur, 1)} s${lim ? ` · timeout ${f(lim, 0)} s → ${AL("A8" + String(p.n).padStart(3, "0"))}` : ""}</span><i style="width:${(pr * 100).toFixed(0)}%"></i></div>`; }).join("");
    }
    if (S.estop || S.faults.crane) html += `<div class="s2-cs on bad"><b>${S.estop ? 900 : 910}</b> ${esc(S.estop ? K.STEP.estop.t : K.STEP.fault.t)} – chain frozen, resumes from the same step after reset</div>`;
    $("s2Chain").innerHTML = html;
    wrap.querySelectorAll(".s2-mode").forEach((b) => b.classList.toggle("on", b.dataset.mode === c.mode));
    $("s2ModeTxt").innerHTML = { AUTO: "AUTO: the crane takes jobs from the WCS queue (dual command when a store and a retrieval wait).", SEMI: "SEMI-AUTOMATIC: the operator gives one job at the HMI (source → target); the crane executes it automatically with all interlocks, then stops. Used after a fault or for relocation.", MANUAL: "MANUAL: no jobs. Hold-to-run jog at safe limited speed (SLS 0.3 m/s), all safety functions active, door interlock still needed. Used for recovery (e.g. retract the fork), maintenance and teaching slot positions." }[c.mode] || c.mode;
    $("s2ModeTxt").innerHTML += c.plan && c.mode !== "AUTO" ? " <b>The running job is finished first.</b>" : "";
    if (st.semiArm && c.plan) { st.semiArm = false; c.mode = "SEMI"; }
  }

  /* ---------------- safety state machine */
  const sfBy = (id) => SF.find((s) => s.id === id);
  function trip(sfId, why) {
    const s = sfBy(sfId); if (!s) return;
    const sa = st.safety; if (sa.state !== "RUN" && sa.state !== "RESET") return;
    Object.assign(sa, { state: s.cat === "1" ? "SS1" : "STO", cause: why || s.n, sf: s.id, cat: s.cat, t0: S.t, vTrip: st.vPrev, causeActive: true, alm: s.alm });
    raise(s.alm);
    if (s.k === "estop") { if (!S.estop) S.setEstop(true); }
    else if (s.k === "curtain") { if (!S.faults.convJam) S.setFault("convJam", true); }
    else if (!S.faults.crane) S.setFault("crane", true);
  }
  function safetyTick() {
    const sa = st.safety;
    if (sa.state === "SS1" && S.t - sa.t0 >= sa.vTrip / K.CC.aStop1 + K.CC.tReact1) sa.state = "STO";
    if (sa.state === "STO" && S.t - sa.t0 >= Math.max(0.3, sa.vTrip / K.CC.aStop1 + 0.5)) sa.state = sa.causeActive ? "SAFE" : "RESET";
    if (sa.state === "SAFE" && !sa.causeActive) sa.state = "RESET";
    // shared faults set / cleared by other items
    if (sa.state === "RUN" && S.estop) { sa.state = "SS1"; Object.assign(sa, { cause: "E-stop (from another item)", sf: "SF1", cat: "1", t0: S.t, vTrip: st.vPrev, causeActive: true, alm: "A1011" }); raise("A1011"); }
    if (sa.state !== "RUN" && sa.sf === "SF1" && !S.estop) { clearAlarm("A1011"); sa.state = "RUN"; sa.cause = null; }
    if (sa.state !== "RUN" && sa.sf && sa.sf !== "SF1" && sfBy(sa.sf).k !== "curtain" && !S.faults.crane) { clearAlarm(sa.alm); sa.state = "RUN"; sa.cause = null; }
    if (sa.state !== "RUN" && sa.sf && sfBy(sa.sf).k === "curtain" && !S.faults.convJam) { clearAlarm(sa.alm); sa.state = "RUN"; sa.cause = null; }
  }
  function safetyUpdate() {
    const sa = st.safety;
    SM.forEach(([k]) => { const g = wrap.querySelector(`[data-sm="${k}"]`); if (g) g.classList.toggle("on", sa.state === k); });
    const v = sa.vTrip, cat1 = K.stopDist(v, K.CC.tReact1, K.CC.aStop1), cat0 = K.stopDist(v, K.CC.tReact0, K.CC.aStop0);
    $("s2SafeTxt").innerHTML = sa.state === "RUN" ? `All safety functions OK · drives enabled · mode ${S.crane.mode}. Trip a function in the table or press an inject button.`
      : `<b>${esc(sa.sf || "")} ${esc(sa.cause || "")}</b> · alarm <code>${AL(sa.alm || "")}</code> · stop category ${sa.cat} · since ${f(S.t - sa.t0, 1)} s<br>
        Travel speed at the trip v = ${f(v, 2)} m/s → ${sa.cat === "1" ? `SS1: ramp at ${K.CC.aStop1} m/s², stop distance ${f(cat1, 2)} m, then STO + SBC` : `Cat 0: STO at once + brakes, stop distance ${f(cat0, 2)} m`}.<br>
        ${sa.state === "SAFE" ? "Cause still active → remove the cause (release the e-stop, close the door …) first." : sa.state === "RESET" ? "Cause removed → <b>reset</b> needed (manual reset from outside the danger zone, ISO 13849-1 §5.2.2). No automatic restart." : "Stopping …"}`;
    const vs = +$("s2Vs").value; $("s2VsV").textContent = f(vs, 1);
    const pts = (tr, a) => { const x = [], y = []; const sTot = K.stopDist(vs, tr, a); for (let i = 0; i <= 100; i++) { const s = sTot * i / 100; x.push(s); y.push(s <= vs * tr ? vs : Math.sqrt(Math.max(0, vs * vs - 2 * a * (s - vs * tr)))); } return { x, y, sTot }; };
    const p1 = pts(K.CC.tReact1, K.CC.aStop1), p0 = pts(K.CC.tReact0, K.CC.aStop0);
    chart($("s2ChSt"), { x: p0.x, xr: [0, p0.sTot * 1.05], xu: " m", yu: "v (m/s)", series: [{ y: p1.y, x: p1.x, c: C_T }, { y: p0.y, x: p0.x, c: C_H }] });
    $("s2StTxt").innerHTML = `s = v·t<sub>r</sub> + v²/(2a) · Cat 1 (SS1, drive ramp): ${f(vs, 1)} × ${K.CC.tReact1} + ${f(vs, 1)}²/(2 × ${K.CC.aStop1}) = <b>${f(p1.sTot, 2)} m</b> in ${f(K.stopTime(vs, K.CC.tReact1, K.CC.aStop1), 2)} s · Cat 0 (brake, t<sub>r</sub> incl. brake closing ${K.CC.tReact0} s, a limited by wheel slip μ·g·share = 0.15 × 9.81 × 0.5 = ${f(K.brakeLimit(), 2)} m/s²): <b>${f(p0.sTot, 2)} m</b>.<br>
      At 3 m/s a Cat 0 stop needs 7.3 m → the crane must already be slow near the aisle ends: safe reduced speed ${K.CC.vSlow} m/s in the last ${K.CC.xSlow} m (normal slow-down 3 → 1 m/s at 0.5 m/s² = (9 − 1)/(2 × 0.5) = 8 m). At 1 m/s: Cat 0 stop ${f(K.stopDist(1, K.CC.tReact0, K.CC.aStop0), 2)} m; the buffer takes the rest: stroke v²/(2a<sub>buf</sub>) = 1/(2 × 5) = ${f(K.bufferStroke(1) * 1000, 0)} mm, energy ½·m·v² = ½ × 4 500 × 1² = 2 250 J (at full 3 m/s: 20 250 J, 0.9 m stroke). Buffer design for reduced speed only if the speed monitoring is a safety function – check EN 528.`;
  }

  /* ---------------- conveyor */
  function convUpdate() {
    const c = S.crane, atIO = Math.abs(c.x) < 0.3, ph = c.phase, inN = S.inConv.length, outN = S.outConv.length;
    const zone = (x, y, w, occ, lab, cls = "") => `<g class="s2-z ${occ ? "occ" : ""} ${cls}"><rect x="${x}" y="${y}" width="${w}" height="40" rx="3"/>${occ ? `<rect class="ld" x="${x + w / 2 - 22}" y="${y + 6}" width="44" height="28" rx="2"/>` : ""}<text x="${x + w / 2}" y="${y + 56}">${lab}</text></g>`;
    const inZ = [inN > 3, inN > 2, inN > 1, inN > 0], outZ = [outN > 0, outN > 1, outN > 2, outN > 3];
    const cr = (atIO && /pos|forkOut|lift|lower|forkIn/.test(ph)) ? "on" : "";
    $("s2ConvSvg").innerHTML = `<svg viewBox="0 0 1000 250" class="s2-svg" role="img" aria-label="I/O conveyors">
      <text x="10" y="20" class="s2-t">Infeed (side L) – loads from goods receipt</text><text x="560" y="20" class="s2-t">Outfeed (side R) – loads to the line (MES call-off)</text>
      ${zone(10, 40, 100, inZ[0], "Z1 entry")}${zone(115, 40, 100, inZ[1], "Z2 ID point")}${zone(220, 40, 100, inZ[2], "Z3 contour + scale")}${zone(325, 40, 100, inZ[3], "Z4 transfer")}
      <g class="s2-z rej"><rect x="115" y="140" width="210" height="34" rx="3"/><text x="220" y="162">reject lane (${st.counts.rejects})</text></g>
      <line x1="165" y1="80" x2="165" y2="140" class="s2-ln"/><text x="172" y="120" class="s2-s">no-read / contour / weight</text>
      <g class="s2-crane ${cr}"><rect x="445" y="30" width="90" height="150" rx="4"/><text x="490" y="60">crane</text><text x="490" y="78">${esc(ph)}</text><text x="490" y="96">x ${f(c.x, 2)} m</text><text x="490" y="114">fork ${f(c.fork, 2)}</text><text x="490" y="140">${c.carrying ? "load " + c.carrying.kg + " kg" : "empty"}</text></g>
      ${zone(560, 40, 100, outZ[0], "Z1 transfer")}${zone(665, 40, 100, outZ[1], "Z2")}${zone(770, 40, 100, outZ[2], "Z3")}${zone(875, 40, 100, outZ[3], "Z4 pick-up")}
      <text x="10" y="215" class="s2-s">ID point: bar-code / RFID reads OK ${st.counts.reads} · no-reads ${st.counts.noread} · contour faults ${st.counts.contour} · overweight ${st.counts.overweight}${S.faults.convJam ? " · <JAM / CONVEYOR STOP>" : ""}</text>
      <text x="10" y="238" class="s2-s">Light curtain + muting at both transfer points (SF9): muting sensors see the crate first, people are detected. Zero-pressure accumulation: one load per zone.</text></svg>`;
    const sig = hsState();
    $("s2HsBody").innerHTML = HS.map((h, i) => `<tr><td><code>${h[0]}</code></td><td>${h[1]}</td><td><code>${h[2]}</code></td><td>${esc(h[3])}</td><td class="${sig[i] ? "s2-hi" : ""}">${sig[i] ? "1" : "0"}</td></tr>`).join("");
    hsChart();
  }
  const HT = (() => { const tf = (A.lhdTime() - CRANE.tLift) / 2; return { pos: CRANE.tPos, fo: tf, lift: CRANE.tLift, fi: tf }; })();
  function hsTimes() { const t1 = 0.0, t2 = HT.pos, t3 = t2 + 0.2, t4 = t3 + HT.fo, t5 = t4 + HT.lift, t6 = t5 + HT.fi; return { t1, t2, t3, t4, t5, t6, end: t6 + 1.5 }; }
  function hsSig(t) { const T = hsTimes(); return [t < T.t5, t >= T.t2 && t < T.t5, t >= T.t3 && t < T.t6, t >= T.t4 && t < T.t5 + 0.2, t >= T.t5 && t < T.t6 + 0.3, t < T.t3 || t >= T.t6, t >= T.t6 + 0.3]; }
  function hsT() { const c = S.crane; if (!c.plan || Math.abs(c.x) > 0.3) return null; const seg = c.plan.segs[c.plan.i]; if (!seg || seg.ph === "toIO" || seg.ph === "toSlot") return null;
    let t = 0; for (let i = c.plan.i - 1; i >= 0; i--) { const s = c.plan.segs[i]; if (s.ph === "toIO" || s.ph === "toSlot") break; t += s.dur; } return t + c.plan.segT; }
  function hsState() { const t = hsT(); return t === null ? [S.inConv.length > 0, 0, 0, 0, 0, 1, 1].map(Boolean) : hsSig(t); }
  function hsChart() {
    const cv = $("s2ChHs"); if (!cv || !cv.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 210; if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); } cv.style.height = H + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const T = hsTimes(), ml = 110, pw = W - ml - 10, rowH = 26, X = (t) => ml + t / T.end * pw;
    g.font = "11px system-ui, sans-serif"; g.textBaseline = "middle";
    HS.forEach((h, i) => { const y0 = 8 + i * rowH; g.fillStyle = css("--text-2", "#555"); g.textAlign = "right"; g.fillText(h[0], ml - 6, y0 + 10);
      g.strokeStyle = i % 2 ? C_H : C_T; g.lineWidth = 1.6; g.beginPath(); let prev = null;
      for (let k = 0; k <= 400; k++) { const t = T.end * k / 400, v = hsSig(t)[i], y = y0 + (v ? 2 : 18); if (prev === null) g.moveTo(X(t), y); else { if (prev !== v) g.lineTo(X(t), y0 + (prev ? 2 : 18)); g.lineTo(X(t), y); } prev = v; } g.stroke(); });
    g.fillStyle = css("--text-2", "#555"); g.textAlign = "center";
    for (let t = 0; t <= T.end; t += 1) g.fillText(t + " s", X(t), H - 8);
    const tl = hsT(); if (tl !== null) { g.strokeStyle = css("--text", "#000"); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(tl), 4); g.lineTo(X(tl), H - 18); g.stroke(); g.globalAlpha = 1; }
    $("s2HsTxt").innerHTML = `Fine positioning ${f(HT.pos, 1)} s → TransferReq → TransferEnable (+0.2 s) → fork out ${f(HT.fo, 2)} s (s = 1.35 m, v 1.0 m/s, a 1.2 m/s²: T = 1.35/1.0 + 1.0/1.2 = ${f(HT.fo, 2)} s) → lift ${HT.lift} s → fork in ${f(HT.fo, 2)} s → PosFree. Total ${f(T.t6, 2)} s per transfer. Every wait has a time-out (e.g. TransferEnable 5 s → ${AL("A7071")}). A drop at the outfeed uses the mirror signals (…_IoOut_…). ${tl !== null ? `<b>Live: crane at the I/O, t = ${f(tl, 1)} s</b>` : "Cursor appears when the crane works at the I/O."}`;
  }

  /* ---------------- energy */
  function energyUpdate() {
    const m = st.lastMove; if (!m) return;
    const key = "e" + m.key; if (st.energy && st.energy.key === key) { drawE(m); return; }
    const s = m.seg, kg = S.crane.carrying ? S.crane.carrying.kg : 0;
    st.energy = { key, o: K.moveEnergy(s.x1 - s.x0, s.z1 - s.z0, kg), kg };
    const o = st.energy.o; st.energyTot.inWh += o.netIn; st.energyTot.backWh += o.back; st.energyTot.moves++;
    drawE(m);
  }
  function drawE(m) {
    const o = st.energy.o, E = st.energyTot, mL = K.CC.mCarriage + st.energy.kg;
    chart($("s2ChE"), { x: o.t, xr: [0, o.T], xu: " s", yu: "kW", series: [{ y: o.Pt, c: C_T }, { y: o.Ph, c: C_H }, { y: o.Pdc, c: C_S, w: 2.2 }], cursor: m.t });
    $("s2ETxt").innerHTML = `<b>This move</b> (load ${st.energy.kg} kg, travel mass ${CRANE.mass + st.energy.kg} kg, lifted mass ${mL} kg): travel takes ${f(o.inT, 2)} Wh and gives back ${f(o.regT, 2)} Wh when braking · hoist takes ${f(o.inH, 2)} Wh, gives back ${f(o.regH, 2)} Wh when lowering. Shared DC link: net from the supply ${f(o.netIn, 2)} Wh, surplus to resistor / regen unit ${f(o.back, 2)} Wh. Peak motoring ${f(o.peak, 1)} kW, peak regenerative ${f(o.regPeak, 1)} kW.<br>
      Formulas: P<sub>travel</sub> = (m·a + m·g·w)·v, w = ${K.CC.rolling}; P<sub>hoist</sub> = m<sub>L</sub>·(g + a)·v; electrical = mech / η when driving, mech · η when braking (η<sub>motor</sub> ${K.CC.etaMot}, inverter ${K.CC.etaInv}, gear ${K.CC.etaGear}, hoist ${K.CC.etaHoist}).<br>
      Kinetic energy at full travel speed ½·4 500·3² = 20 250 J = 5.6 Wh · lowering 1 150 kg by 5 m: m·g·h = 56 400 J = 15.7 Wh. The DC-link capacitors (example 4 mF, 565 → 760 V) store only ½·C·(U<sub>max</sub>² − U<sub>0</sub>²) = <b>${f(o.capJ, 0)} J</b> → the rest must go to a <b>braking resistor</b> (heat) or a <b>regenerative supply</b> (back to the grid) or a capacitor / storage module.<br>
      FEM dual cycle (guide 32 §12.3, verified): net with resistor ≈ 33 Wh, with regeneration ≈ 11.5 Wh → ≈ 65 % less · ≈ 1 700 kWh/year at 40 jobs/h, 16 h/day, 250 days (example).<br>
      <b>Since this page opened (energy model of this item):</b> ${E.moves} moves, ${f(E.inWh, 1)} Wh from the supply, ${f(E.backWh, 1)} Wh surplus braking energy (core's own counter: ${f(S.crane.energyWh, 1)} Wh – simpler model).`;
  }

  /* ---------------- KPIs + alarms */
  function kpiUpdate() {
    const k = S.kpi(), avail = S.t > 0 ? 1 - st.tFault / Math.max(1e-6, S.t - st.t0page) : 1, E = st.energyTot, jobs = S.stats.stores + S.stats.retrievals;
    const tile = (n, v, u) => `<div class="s2-tile"><span>${n}</span><b>${v}</b><small>${u}</small></div>`;
    $("s2Tiles").innerHTML = tile("throughput", f(k.jobsPerH, 1), "jobs/h (FEM SC " + f(A.fem.scPerH, 0) + ", DC " + f(A.fem.dcPerH, 0) + ")") + tile("crane utilisation", f(k.util * 100, 0), "% busy") + tile("avg job time", f(k.avgCycle, 1), "s request→done")
      + tile("fill level", f(k.fill * 100, 0), `% of ${RACK.slots} slots`) + tile("dual-command share", st.plans ? f(st.dualPlans / st.plans * 100, 0) : "–", `% of ${st.plans} trips`) + tile("availability", f(Math.max(0, avail) * 100, 1), "% (not in fault / e-stop)")
      + tile("energy per job", E.moves && jobs ? f(E.inWh / Math.max(1, jobs), 1) : "–", "Wh net (this item's model)") + tile("alarms active", st.alarms.filter((a) => a.on).length, `${S.stats.faults} faults since start`);
    const on = st.alarms.filter((a) => a.on || !a.ack).slice(0, 12);
    $("s2Alm").innerHTML = on.length ? `<table class="s2-tbl"><thead><tr><th>Alarm</th><th>Text</th><th>Since (sim s)</th><th>State</th><th></th></tr></thead><tbody>${on.map((a, i) => `<tr class="${a.on ? "s2-bad" : ""}"><td><code>${AL(a.id)}</code></td><td>${esc(a.text)}</td><td>${f(a.t, 0)}</td><td>${a.on ? "active" : "gone"}${a.ack ? ", ack" : ""}</td><td>${a.ack ? "" : `<button class="btn s2-ack" data-i="${st.alarms.indexOf(a)}">ack</button>`}</td></tr>`).join("")}</tbody></table>` : `<p class="s2-note">No active alarm.</p>`;
    const ev = st.events.slice(0, 14).map((e) => ({ t: e.t, m: `${AL(e.id)} ${e.text}`, l: e.lvl })).concat(S.log.slice(0, 14).map((l) => ({ t: l.t, m: l.msg, l: l.lvl })));
    ev.sort((a, b) => b.t - a.t);
    const seen = new Set(); $("s2Log").innerHTML = ev.filter((e) => { const k2 = e.m + f(e.t, 0); if (seen.has(k2)) return false; seen.add(k2); return true; }).slice(0, 22).map((e) => `<div class="s2-ev ${e.l}"><span>${f(e.t, 0)} s</span> ${esc(e.m)}</div>`).join("");
  }
  wrap.addEventListener("click", (e) => { const b = e.target.closest(".s2-ack"); if (b) { const a = st.alarms[+b.dataset.i]; if (a) a.ack = true; if (a && !a.on) st.alarms.splice(st.alarms.indexOf(a), 1); kpiUpdate(); } });

  /* ---------------- inject buttons */
  function injectErr(k) {
    if (k === "noread") { S.setFault("scanner", true); raise("A7011"); setTimeout(() => { S.setFault("scanner", false); clearAlarm("A7011"); }, 20000); }
    else if (k === "double") { const fr = S.slots.filter((s) => !s.load && !s.reserved && !s.blocked).sort((a, b) => a.x - b.x)[0]; if (fr) { fr.blocked = true; st.blockedSlots.push(fr.id); S.setFault("slotBlocked", fr.id); raise("A7051", `Double storage at slot ${fr.id} – slot blocked, new target slot from the WCS`); } }
    else if (k === "empty") { raise("A7061", "Empty slot at retrieval – job aborted, stock correction sent to the WMS"); setTimeout(() => clearAlarm("A7061"), 8000); }
    else if (k === "overweight") { S.setFault("overload", true); st.counts.overweight++; raise("A7031", "Overweight at the infeed scale – load to the reject lane; overload test on the hoist armed"); st.counts.rejects++; setTimeout(() => clearAlarm("A7031"), 8000); }
    else if (k === "contour") { st.counts.contour++; st.counts.rejects++; raise("A7021"); setTimeout(() => clearAlarm("A7021"), 8000); }
    else if (k === "collision") { st.safety.cause = null; raise("A4041"); trip("SF8", "Fork collision sensor"); }
    else if (k === "jam") { S.setFault("convJam", true); raise("A7041"); setTimeout(() => { S.setFault("convJam", false); clearAlarm("A7041"); }, 15000); }
  }
  wrap.querySelectorAll(".s2-inj").forEach((b) => b.addEventListener("click", () => injectErr(b.dataset.err)));
  wrap.querySelectorAll(".s2-sf").forEach((b) => b.addEventListener("click", () => trip(b.dataset.sf)));
  $("s2Cause").addEventListener("click", () => { st.safety.causeActive = false; });
  $("s2Reset").addEventListener("click", () => {
    const sa = st.safety; if (sa.state !== "RESET" && !(sa.state === "RUN")) { $("s2SafeTxt").insertAdjacentHTML("beforeend", "<br><b>Reset refused – the cause is still active or the axes are not stopped.</b>"); return; }
    if (sa.sf === "SF1" || S.estop) S.setEstop(false);
    if (sa.sf && sfBy(sa.sf).k === "curtain") S.setFault("convJam", false);
    else if (S.faults.crane) S.setFault("crane", false);
    if (S.faults.overload) { S.setFault("overload", false); st.ackOverload = S.crane.carrying; }
    clearAlarm(sa.alm || ""); clearAlarm("A4041"); clearAlarm("A5011");
    st.blockedSlots.forEach((id) => { const s = S.byId.get(id); if (s) s.blocked = false; }); if (st.blockedSlots.length) { S.setFault("slotBlocked", null); clearAlarm("A7051"); } st.blockedSlots = [];
    Object.assign(sa, { state: "RUN", cause: null, sf: null, cat: null });
  });
  wrap.querySelectorAll(".s2-mode").forEach((b) => b.addEventListener("click", () => { S.crane.mode = b.dataset.mode; st.semiArm = false; S.logMsg(`crane mode → ${b.dataset.mode} (HMI)`); seqUpdate(); }));
  $("s2Semi").addEventListener("click", () => { if (S.crane.plan) return; st.semiArm = true; S.crane.mode = "AUTO"; S.logMsg("SEMI: one job released by the operator"); });
  wrap.querySelectorAll(".s2-jog").forEach((b) => {
    const go = (on) => { if (S.crane.mode !== "MANUAL" || S.crane.plan) { $("s2ModeTxt").innerHTML = "Jog only in MANUAL with no job running."; return; } if (b.dataset.ax === "x") st.jog = on ? +b.dataset.d : 0; else st.jogZ = on ? +b.dataset.d : 0; };
    b.addEventListener("pointerdown", () => go(true)); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, () => { st.jog = 0; st.jogZ = 0; }));
  });
  $("s2Ref").addEventListener("click", () => {
    const c = S.crane, lz = (c.x + K.CC.laserOff) * 1000, enc = lz + (Math.random() - 0.5) * 6;
    $("s2RefTxt").innerHTML = `<ol><li>Laser travel ${f(lz, 0)} mm vs wheel encoder ${f(enc, 0)} mm → difference ${f(Math.abs(lz - enc), 1)} mm &lt; 20 mm: <b>OK</b></li><li>Bar-code hoist ${f(c.z * 1000, 0)} mm read, tape code valid: <b>OK</b></li><li>Fork at centre (2 sensors + encoder ${f(c.fork * 1350, 0)} mm): <b>${Math.abs(c.fork) < 0.02 ? "OK" : "NOT CENTRED – retract in MANUAL"}</b></li><li>Load sensor on the fork = ${c.carrying ? "load" : "empty"} → must match the WCS tracking (${c.carrying ? "load" : "empty"}): <b>OK</b></li><li>Safety: e-stop chain, doors locked, light curtains free: <b>${S.estop || S.faults.crane ? "NOT OK" : "OK"}</b></li></ol>
      With absolute measuring systems (laser, bar-code, multi-turn encoder) <b>no homing run</b> is needed after power-on – only this plausibility check. With incremental encoders the crane would have to drive to a reference switch at creep speed first (several minutes in a 28 m aisle).`;
  });
  $("s2Sc").addEventListener("change", () => motionUpdate(true));
  $("s2J").addEventListener("input", () => { $("s2Jv").textContent = f(+$("s2J").value, 1) + " m/s³"; motionUpdate(true); swayUpdate(); });
  $("s2Jv").textContent = f(K.CC.jx, 1) + " m/s³";
  $("s2Kv").addEventListener("input", servoUpdate); $("s2Ff").addEventListener("change", servoUpdate);
  $("s2Vs").addEventListener("input", safetyUpdate);

  /* ---------------- tick */
  st.t0page = S.t;
  const visible = () => !box.hidden && window.srCtl && window.srCtl.tabVisible();
  S.on("fault", (d) => { if (d.k === "crane" && d.v && st.safety.state === "RUN") { st.safety.state = "SS1"; Object.assign(st.safety, { cause: "crane fault (from another item / drive)", sf: "SF10", cat: "1", t0: S.t, vTrip: st.vPrev, causeActive: true, alm: "A4011" }); raise("A4011"); } });
  S.on("job", (j) => { if (j.state === "failed" && /no-read/.test(j.err || "")) { st.counts.noread++; st.counts.rejects++; } if (j.type === "store" && j.state === "active") st.counts.reads++; });
  S.on("tick", () => {
    const c = S.crane, dt = S.t - st.tLast; st.tLast = S.t;
    if (S.estop || S.faults.crane) st.tFault += Math.max(0, dt);
    if (Math.abs(c.vx) > 1e-3 || (!S.estop && !S.faults.crane)) st.vPrev = Math.abs(c.vx);
    // overload detection on the hoist load cell
    if (c.carrying && c.carrying.kg > RACK.maxLoad && st.ackOverload !== c.carrying && st.safety.state === "RUN") { st.ackOverload = c.carrying; raise("A5011", `Hoist overload ${c.carrying.kg} kg > ${RACK.maxLoad} kg – crane stopped`); trip("SF7", "Hoist overload (load cell)"); }
    // fine positioning simulation (display only): error decays during phase "pos"
    if (c.plan && c.plan.segs[c.plan.i] && c.plan.segs[c.plan.i].ph === "pos") {
      const seg = c.plan.segs[c.plan.i], id = c.plan.t0 + ":" + c.plan.i;
      if (!st.finePos || st.finePos.id !== id) { const e0 = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 6); const nx = c.plan.segs.slice(c.plan.i).find((s) => s.job); st.finePos = { id, e0, e: e0, slot: nx && nx.job && nx.job.slot && Math.abs(c.x) > 0.3 ? nx.job.slot.id : "I/O point" }; }
      st.finePos.e = st.finePos.e0 * Math.exp(-c.plan.segT / 0.45) + 0.6 * Math.sin(c.plan.segT * 7) * Math.exp(-c.plan.segT);
    }
    // MANUAL jog (hold-to-run, safe limited speed)
    if (c.mode === "MANUAL" && !c.plan && !S.estop && !S.faults.crane && (st.jog || st.jogZ)) {
      c.x = Math.max(0, Math.min(RACK.x0 + RACK.length - 0.5, c.x + st.jog * 0.3 * dt)); c.z = Math.max(0.35, Math.min(RACK.z1 + 6 * RACK.levelPitch + 0.1, c.z + st.jogZ * 0.3 * dt));
    }
    safetyTick();
    if (!visible()) return;
    st.chart++;
    seqUpdate(); stripUpdate();
    if (st.chart % 2 === 0) { motionUpdate(); posUpdate(); safetyUpdate(); convUpdate(); energyUpdate(); }
    if (st.chart % 5 === 0) { swayUpdate(); servoUpdate(); kpiUpdate(); archInfo(); }
  });
  function stripUpdate() {
    const c = S.crane, sa = st.safety;
    $("s2Strip").innerHTML = `<span><b>Crane</b> ${esc(c.phase)} · step ${curStep()}</span><span>x ${f(c.x, 2)} m · z ${f(c.z, 2)} m · fork ${f(c.fork, 2)}</span><span>v<sub>x</sub> ${f(c.vx, 2)} · v<sub>z</sub> ${f(c.vz, 2)} m/s</span><span>mode <b>${c.mode}</b></span><span class="${sa.state === "RUN" ? "s2-ok" : "s2-badt"}">safety <b>${sa.state}</b></span><span>queue ${S.queue.filter((j) => j.state === "queued").length}</span><span>sim t ${f(S.t, 0)} s × ${S.speed}</span>`;
  }

  /* ---------------- catalogue card (last element of the item) */
  let card = null;
  try { card = makeCard({ drawings: CARD2.drawings, groups: CARD2.groups, shops: CARD2.shops, guides: CARD2.guide, shopTab: CARD2.shopTab, ph: CARD2.ph, buyNote: CARD2.price, shopLbl: CARD2.shopLbl, shopTitle: CARD2.shopTitle, shopNote: CARD2.shopNote, shopPrice: true },
    wrap, { card: "srCard2", q: "srQ2", g: "srG2", cnt: "srCnt2", buy: "srBuy2" }, "sr2"); } catch (e) { console.error(e); }

  const show = () => { st.moveKey = ""; st.sway = null; st.servo = null; seqUpdate(); stripUpdate(); motionUpdate(true); posUpdate(); swayUpdate(); servoUpdate(); safetyUpdate(); convUpdate(); energyUpdate(); kpiUpdate(); archInfo(); };
  if (Q.get("sr2safe")) setTimeout(() => { const m = { estop: "SF1", door: "SF2", overspeed: "SF5", overload: "SF7", curtain: "SF9" }[Q.get("sr2safe")]; if (m) trip(m); }, 1500);
  if (Q.get("sr2goto")) setTimeout(() => { const el = $(Q.get("sr2goto")); if (el) el.scrollIntoView({ block: "start" }); }, 800);
  return { show, st, S, A, trip, injectErr, card: () => card, curStep };
}

/* ------------------------------------------------------------------ inline SVGs (themed by CSS) */
function archSvg() {
  const b = (k, x, y, w, h, l1, l2, l3) => `<g class="s2-b" data-blk="${k}" tabindex="0" role="button"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text x="${x + w / 2}" y="${y + 19}" class="b1">${l1}</text>${l2 ? `<text x="${x + w / 2}" y="${y + 36}">${l2}</text>` : ""}${l3 ? `<text x="${x + w / 2}" y="${y + 52}" class="b3">${l3}</text>` : ""}</g>`;
  const ln = (x1, y1, x2, y2, t, dx = 6) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="s2-ln"/>${t ? `<text x="${(x1 + x2) / 2 + dx}" y="${(y1 + y2) / 2 + 4}" class="s2-s" text-anchor="start">${t}</text>` : ""}`;
  return `<svg viewBox="0 0 1100 560" class="s2-svg s2-arch" role="img" aria-label="AS/RS control architecture">
    ${[["Level 4 – ERP", 30], ["Level 3 – MES / WMS", 110], ["Level 2 – WCS / HMI", 200], ["Level 1 – PLC", 290], ["Link to the crane", 375], ["Level 0 – field", 455]].map(([t, y]) => `<text x="8" y="${y}" class="s2-lv">${t}</text>`).join("")}<g transform="translate(95,0)">
    ${ln(500, 62, 330, 92, "B2MML via DMZ", -110)}${ln(500, 62, 670, 92, "goods receipt / stock")}${ln(330, 118, 670, 118, "", 0)}<text x="440" y="112" class="s2-s">retrieval order</text>
    ${ln(670, 148, 520, 178, "transport orders")}${ln(500, 236, 330, 266, "telegrams TCP / OPC UA", -150)}${ln(560, 236, 690, 266, "conveyor telegrams")}${ln(720, 205, 610, 205, "")}
    ${ln(330, 322, 330, 352, "PROFINET + PROFIsafe")}${ln(330, 410, 110, 440, "")}${ln(330, 410, 330, 440, "")}${ln(380, 410, 560, 440, "")}${ln(690, 322, 830, 440, "PROFINET", 0)}
    ${b("erp", 420, 10, 160, 52, "ERP", "material, receipt, MRP", "VLAN 10")}
    ${b("mes", 230, 92, 200, 56, "MES", "call-off, traceability", "10.30.0.100")}
    ${b("wms", 570, 92, 200, 56, "WMS", "slots, lots, FIFO", "10.30.0.104")}
    ${b("wcs", 390, 178, 220, 58, "WCS / material flow ctrl", "jobs, dual cmd, tracking", "10.54.0.100 vc-log-wcsraw01")}
    ${b("hmi", 720, 178, 200, 58, "HMI + SCADA", "modes, alarms, jog", "10.54.0.101 / VLAN 40")}
    ${b("plc", 210, 266, 240, 56, "Crane PLC S7-1515F-2 PN", "step chain + F-program", "10.54.0.31 vc-log-plcasrsraw")}
    ${b("conv", 580, 266, 220, 56, "Conveyor control", "zones, ID, contour, scale", "ET 200SP 10.54.0.153")}
    ${b("link", 210, 352, 240, 58, "Optical data link", "fixed ↔ on the crane", "100 Mbit/s, line of sight")}
    ${b("drv", 20, 440, 190, 62, "Drives + STO/SBC", "travel 2×, hoist, fork", "shared DC link")}
    ${b("sens", 230, 440, 200, 62, "Positioning sensors", "laser, bar-code, encoder", "slot reference sensor")}
    ${b("safe", 450, 440, 210, 62, "Safety devices", "e-stop, doors, overspeed", "slack rope, load cell")}
    ${b("fld", 690, 440, 230, 62, "I/O field devices", "scanner, contour grid", "scale, reject diverter")}
    <text x="500" y="540" class="s2-s" text-anchor="middle">VLAN 54 = 10.54.0.0/24 (AS/RS) · VLAN 30 OPS · VLAN 40 SUP · VLAN 10 office – guide 15 §3.13, example</text></g>
  </svg>`;
}
function smSvg() {
  const pos = { RUN: [20, 30], SS1: [220, 30], STO: [420, 30], SAFE: [420, 130], RESET: [220, 130] };
  const bx = SM.map(([k, t]) => { const [x, y] = pos[k]; return `<g class="s2-sm" data-sm="${k}"><rect x="${x}" y="${y}" width="170" height="54" rx="8"/><text x="${x + 85}" y="${y + 23}" class="b1">${k}</text><text x="${x + 85}" y="${y + 41}">${t.replace(/^[A-Z0-9]+ /, "")}</text></g>`; }).join("");
  const ar = (x1, y1, x2, y2, t, tx, ty) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="s2-ln" marker-end="url(#s2ar)"/><text x="${tx}" y="${ty}" class="s2-s">${t}</text>`;
  return `<svg viewBox="0 0 610 230" class="s2-svg" role="img" aria-label="safety state machine"><defs><marker id="s2ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="s2-arh"/></marker></defs>
    ${ar(190, 50, 218, 50, "Cat 1 trip", 186, 22)}${ar(390, 50, 418, 50, "v = 0", 392, 22)}${ar(190, 74, 418, 74, "", 0, 0)}<text x="250" y="102" class="s2-s">Cat 0 trip: STO at once</text>${ar(505, 86, 505, 128, "cause active", 512, 112)}${ar(418, 157, 392, 157, "cause gone", 330, 205)}${ar(220, 157, 105, 86, "reset", 120, 140)}
    ${bx}</svg>`;
}

/* ------------------------------------------------------------------ lazy build + self-check */
function ensure() {
  if (!box) return;
  if (!built) { built = true; try { UI = build(); window.sr2 = UI; } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p>Item 2 could not start: ${esc(e.message)}</p></div>`; return; } }
  if (UI) setTimeout(UI.show, 30);
}
window.addEventListener("sritemshow", (e) => { if (String(e.detail) === "2") ensure(); });
if (window.srCtl && window.srCtl.current() === "2" && window.srCtl.tabVisible()) ensure();

if (Q.has("sr2test")) setTimeout(() => {
  const out = (s) => console.log("SR2TEST " + s);
  try {
    if (!UI) { window.srCtl && window.srCtl.showItem("2"); }
    const A = getASRS(), S = A.sim;
    out(`core trap 26 m travel = ${f(trapTime(26, 3, 0.5), 2)} s (hand: 26/3 + 3/0.5 = 14.67) · hoist 7.5 m = ${f(trapTime(7.5, 1, 0.5), 2)} s (9.50)`);
    out(`S-curve 26 m j=0.5: ${f(K.scurveTime(26, 3, 0.5, 0.5), 2)} s (hand 15.67) · j=0.6: ${f(K.scurveTime(26, 3, 0.5, 0.6), 3)} (14.67 + 0.833 = 15.50) · hoist 7.5 m j=1: ${f(K.scurveTime(7.5, 1, 0.5, 1), 2)} (10.00)`);
    const pe = K.scurveAt(26, 3, 0.5, 0.6, K.scurveTime(26, 3, 0.5, 0.6) * 0.5); out(`S-curve midpoint p = ${f(pe.p, 3)} m (13.000) v = ${f(pe.v, 3)} (3.000)`);
    out(`sync hoist speed for 5 m in 14.67 s = ${f(K.syncSpeed(5, 14.667), 3)} m/s (0.358)`);
    const P = K.moveProfile(26, 0, { n: 1200 }), fn = (p) => (t) => p.ax[Math.min(p.t.length - 1, Math.round(t / p.T * (p.t.length - 1)))];
    const s1 = K.swaySim(fn(P), P.T, { after: 20 }); K.CC.jx = 0.6; const PS = K.moveProfile(26, 0, { scurve: true, n: 1200 }); const s2 = K.swaySim(fn(PS), PS.T); const s3 = K.swaySim(fn(P), P.T, { zeta: 0.2 });
    out(`sway static ${f(s1.static, 2)} mm (8.80) · residual trapezoid ${f(s1.residual, 2)} mm · S-curve tuned ${f(s2.residual, 2)} mm (≈0) · active ${f(s3.residual, 2)} mm settle2 trap ${f(s1.settle2, 2)} s active ${f(s3.settle2, 2)} s`);
    for (const ff of [0, 0.95]) { const o = K.servoSim(26, { ff }); out(`servo ff=${ff}: eMax ${f(o.eMax, 0)} mm (static ${f(o.eStatic, 0)}: ${ff ? 75 : 1500}) end ${f(o.eEnd, 1)} mm settle ${o.settle === null ? "-" : f(o.settle, 2)} s`); }
    out(`stop 3 m/s Cat1 ${f(K.stopDist(3, 0.15, 1), 2)} m (4.95) Cat0 ${f(K.stopDist(3, 0.3, 0.7), 2)} m (7.33) brake limit ${f(K.brakeLimit(), 3)} (0.736) buffer 1 m/s ${f(K.bufferStroke(1), 3)} m (0.100) ISO13855 S ${f(K.isoS(0.335), 0)} mm (1386)`);
    const e = K.moveEnergy(26, 0, 300); out(`energy 26 m full load: travel in ${f(e.inT, 2)} Wh regen ${f(e.regT, 2)} Wh peak ${f(e.peak, 1)} kW · cap ${f(e.capJ, 0)} J (517)`);
    const eh = K.moveEnergy(0, -5, 250); out(`energy hoist down 5 m 1150 kg: regen ${f(eh.regH, 2)} Wh (≈ 15.67 × 0.92 × 0.97 × 0.85 = 11.9) peak ${f(eh.regPeak, 1)} kW`);
    out(`PFH e-stop 1oo2 MTTFd 1000 a DC 0.9 β 0.05: ${K.pfh1oo2(1000, 0.9, 0.05, 20 * 8760, 8).toExponential(3)} (5.914e-9) → PL ${K.plFromPfh(2.79e-8)}`);
    const tg = K.telegram({ id: "J00012", type: "store", slot: { id: "L-03-1-5" } }, 12, 217); out(`telegram len ${tg.len} (66) "${tg.str}" check ${tg.check}`);
    out(`FEM from core: SC ${f(A.fem.sc, 1)} s ${f(A.fem.scPerH, 0)}/h (34.8/103) DC ${f(A.fem.dc, 1)} s ${f(A.fem.dcPerH, 0)}/h (57.8/125)`);
    setTimeout(() => {
      const u = window.sr2; if (!u) { out("UI not built"); out("DONE errors=" + (errs.join(" | ") || "none")); return; }
      const cards = box.querySelectorAll(".s2-wrap > .card").length, last = box.querySelector(".s2-wrap").lastElementChild;
      out(`UI cards=${cards} lastIsSrCard2=${last && last.id === "srCard2"} imgs=${last ? last.querySelectorAll("img").length : 0} buyRows=${last ? last.querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} phase=${S.crane.phase} step=${u.curStep()} chainActive=${box.querySelectorAll(".s2-cs.on").length}`);
      u.trip("SF2"); out(`trip SF2 → state ${u.st.safety.state} craneFault=${S.faults.crane} phase(next tick)…`);
      setTimeout(() => {
        out(`after 1.5 s: state ${u.st.safety.state} crane.phase=${S.crane.phase} alarm=${u.st.alarms.filter((a) => a.on).map((a) => a.id).join(",")}`);
        $("s2Cause").click(); setTimeout(() => { out(`cause removed: state ${u.st.safety.state}`); $("s2Reset").click();
          setTimeout(() => { out(`after reset: state ${u.st.safety.state} craneFault=${S.faults.crane} phase=${S.crane.phase}`);
            u.injectErr("collision"); out(`inject collision → state ${u.st.safety.state} sf=${u.st.safety.sf} alarms=${u.st.alarms.filter((a) => a.on).map((a) => a.id).join(",")}`);
            u.st.safety.causeActive = false; setTimeout(() => { $("s2Reset").click(); out(`reset → ${u.st.safety.state} craneFault=${S.faults.crane}`);
            S.crane.mode = "MANUAL"; const wait = () => { if (S.crane.plan) { setTimeout(wait, 300); return; } const x0 = S.crane.x; u.st.jog = 1;
              setTimeout(() => { u.st.jog = 0; out(`MANUAL jog 1.5 s: x ${f(x0, 2)} → ${f(S.crane.x, 2)} m (≈ +0.45 at 0.3 m/s × speed ${S.speed})`); S.crane.mode = "AUTO";
            out("item switch 2→1→3→4→2"); const seq = ["1", "3", "4", "2"]; let i = 0;
            const nx = () => { if (i >= seq.length) { out(`final item2 visible=${!box.hidden} cards=${box.querySelectorAll(".s2-wrap > .card").length} srCard2 count=${document.querySelectorAll("#srCard2").length}`); out("DONE errors=" + (errs.join(" | ") || "none")); return; }
              window.srCtl.showItem(seq[i++]); setTimeout(nx, 1200); }; nx(); }, 1500); }; wait(); }, 1500); }, 800); }, 600);
      }, 1500);
    }, 2500);
  } catch (e) { out("EXCEPTION " + e.message + " " + e.stack); }
}, +Q.get("sr2test") || 3500);
