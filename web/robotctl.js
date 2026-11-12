/* ROBOT tab – item 2 "Robot control system" (UI). Also handles the item switch 1 <-> 2 of the Robot tab.
 * Cards: 1 controller architecture (click blocks, live values) · 2 motion pipeline · 3 joint servo simulator (cascade loops,
 * two-mass plant, feedforward, tuning) · 4 model-based collision detection · 5 safety system (live state machine, stop categories)
 * · 6 I/O + handshake with the cell (follows item 1 when its program runs) · 7 programming + operation + maintenance.
 * Simulation core: robotctl_core.js (pure math) · self-checks: robotctl_test.js (&rctest) · guide: docs/23_robot_control_system.md
 * URL: &rbitem=2 (open item 2) · &rcback (test: back to item 1) · &rcrb=irb4600 · &rcj=2 (joint 1–6) · &rckp=20 (Kp × factor, stability demo) · &rcwrong (wrong payload)
 *      · &rcsafe=estop|gate|t1|fault (safety demo state) · &rcio=8 (handshake demo at t = 8 s) · &rcblk=inv (open an info box)
 *      · &rctest (self-checks in a web worker, console) · &rctest=8086 also POSTs the lines to http://127.0.0.1:8086 (local test sink)
 *      · &rcquick=none (skip the checks) · &rcchk=ms (report the item-2 state) · &rcback=ms (switch back to item 1, report the 3D size)
 * Offline, no libraries. All values are EXAMPLES / ESTIMATES – check with the robot supplier.
 */
import { ROBOTS, robotById, fk, cellLayout, D2R } from "./robotkin.js";
import { CTL, sizing, jointModel, autoTune, jerkN, simulate, stopCurves } from "./robotctl_core.js";
import { SIM } from "./robotsim.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const AM = 180 / Math.PI * 60;                       // rad -> arc-min
const fx = (v, d = 1) => (Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d));
const css = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;
const JN = ["J1 rotation", "J2 lower arm", "J3 upper arm", "J4 forearm roll", "J5 wrist bend", "J6 flange roll"];

/* ------------------------------------------------------------------ self test (&rctest[=port]) */
if (Q.has("rctest")) {
  const port = Q.get("rctest");
  const post = (s) => { console.log(s); if (/^\d+$/.test(port || "")) fetch("http://127.0.0.1:" + port + "/", { method: "POST", mode: "no-cors", body: s }).catch(() => {}); };
  try {
    const w = new Worker("robotctl_testw.js", { type: "module" });
    w.onmessage = (e) => post(e.data); w.onerror = (e) => post("worker error " + e.message);
    if (Q.get("rcquick") !== "none") w.postMessage({ quick: Q.has("rcquick") && (Q.get("rcquick") || "1,0") });
  } catch (e) { post("RCTEST worker failed " + e.message); }
  // item-switch check: &rcback=ms -> after the switch back to item 1, report the size of the item-1 3D canvas + charts and all page errors
  const errs = [];
  window.addEventListener("error", (e) => errs.push(e.message));
  window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message)));
  if (Q.has("rcback")) setTimeout(() => {
    const c3 = document.querySelector("#rb3d canvas"), ch = $("rbChA"), i2 = $("rbItem2");
    post(`RCBACK item1 visible=${!$("rbItem1").hidden} item2 hidden=${i2.hidden} item2 built=${i2.children.length > 0} 3D canvas=${c3 ? c3.clientWidth + "x" + c3.clientHeight : "none"} chartA=${ch ? ch.clientWidth + "x" + ch.clientHeight : "none"} rbSim.t=${window.rbSim ? window.rbSim.simT : "-"} errors=${errs.length ? errs.join(" | ") : "none"}`);
    post("RCDONE");
  }, (+Q.get("rcback") || 0) + 1500);
  // state check: &rcchk=ms -> report the item-2 state (I/O live mode, servo status, safety state) after ms
  if (Q.has("rcchk")) setTimeout(() => {
    const u = window.rbCtl && window.rbCtl.ui(), st = u && u.state(), s1 = window.rbSim;
    if (!st) { post("RCCHK item 2 not built"); post("RCDONE"); return; }
    const h = st.IO.hist, v = h.length ? h[h.length - 1].v : null;
    const ch = {}; for (let i = 1; i < h.length; i++) for (const k in h[i].v) if (h[i].v[k] !== h[i - 1].v[k]) ch[k] = (ch[k] || 0) + 1;
    post(`RCCHK io=${st.IO.mode} samples=${h.length} span=${h.length ? (h[h.length - 1].t - h[0].t).toFixed(1) : 0}s changes=${JSON.stringify(ch)} last=${JSON.stringify(v)} item1 line=${s1 ? s1.run.pc + 1 : "-"} running=${s1 ? s1.run.on : "-"} servo=${st.R ? st.R.status : "-"} safety=${st.SF.st} errors=${errs.length ? errs.join(" | ") : "none"}`);
    post("RCDONE");
  }, +Q.get("rcchk") || 3000);
}

/* ------------------------------------------------------------------ item switch of the Robot tab */
const box = $("rbItem2"), pane = $("tab-robot");
let built = false, visible = false, UI = null;
function showItem(n) {
  n = String(n);
  document.querySelectorAll("[data-rbitem]").forEach((b) => b.classList.toggle("active", b.dataset.rbitem === n));
  [...document.querySelectorAll("[data-rbitem]")].map((b) => b.dataset.rbitem).forEach((i) => { const el = $("rbItem" + i), it = $("rbIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  visible = n === "2";
  if (visible && !built && box) { built = true; try { UI = build(); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="rc-bad">Item 2 could not start: ${esc(e.message)}</p></div>`; } }
  if (visible && UI) UI.show();
  if (!visible) window.dispatchEvent(new Event("resize"));     // item 1: 3D + charts get their size back
  window.dispatchEvent(new CustomEvent("rbitemshow", { detail: n }));   // other robot items (3, 4 …) listen to this
}
document.querySelectorAll("[data-rbitem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.rbitem); }));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "robot" && visible && UI) UI.show(); };
window.rbCtl = { showItem, ui: () => UI };

/* ------------------------------------------------------------------ canvas chart (envelope per pixel, no dual axes) */
function niceStep(range, n = 5) { const r = range / n, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function chart(cv, o) {
  if (!cv || !cv.isConnected) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 500, H = +cv.getAttribute("height") || 160;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  cv.style.height = H + "px";
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const ml = 54, mr = 10, mt = 8, mb = 22, pw = W - ml - mr, ph = H - mt - mb;
  const xs = o.x, [x0, x1] = o.xr || [xs[0], xs[xs.length - 1]];
  let lo = Infinity, hi = -Infinity;
  for (const s of o.series) for (let i = 0; i < s.y.length; i++) { const v = s.y[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  for (const h of o.hl || []) { lo = Math.min(lo, h.y); hi = Math.max(hi, h.y); }
  if (o.yr) { lo = o.yr[0] ?? lo; hi = o.yr[1] ?? hi; }
  if (!isFinite(lo)) { lo = 0; hi = 1; }
  if (hi - lo < (o.minSpan || 1e-9)) { const c = (hi + lo) / 2, h = (o.minSpan || 1) / 2; lo = c - h; hi = c + h; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = (x) => ml + (x - x0) / (x1 - x0) * pw, Y = (y) => mt + (hi - y) / (hi - lo) * ph;
  const cText = css("--text-2", "#555"), cGrid = css("--grid", "#ddd");
  g.font = "11px system-ui, sans-serif"; g.fillStyle = cText; g.strokeStyle = cGrid; g.lineWidth = 1;
  const ys = niceStep(hi - lo, Math.max(3, Math.floor(ph / 32)));
  g.textAlign = "right"; g.textBaseline = "middle";
  for (let v = Math.ceil(lo / ys) * ys; v <= hi; v += ys) { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(ml, y); g.lineTo(ml + pw, y); g.stroke(); g.fillText(+v.toPrecision(4) + "", ml - 5, y); }
  const xsT = niceStep(x1 - x0, Math.max(3, Math.floor(pw / 80)));
  g.textAlign = "center"; g.textBaseline = "top";
  for (let v = Math.ceil(x0 / xsT) * xsT; v <= x1 + 1e-9; v += xsT) { const x = Math.round(X(v)) + 0.5; g.beginPath(); g.moveTo(x, mt); g.lineTo(x, mt + ph); g.stroke(); g.fillText(+v.toPrecision(4) + (o.xu || ""), x, mt + ph + 5); }
  if (o.zero && lo < 0 && hi > 0) { g.strokeStyle = css("--axis", "#bbb"); g.beginPath(); g.moveTo(ml, Y(0)); g.lineTo(ml + pw, Y(0)); g.stroke(); }
  for (const h of o.hl || []) {
    g.strokeStyle = h.c; g.setLineDash(h.dash || [5, 4]); g.lineWidth = 1.2; g.beginPath(); g.moveTo(ml, Y(h.y)); g.lineTo(ml + pw, Y(h.y)); g.stroke(); g.setLineDash([]);
    if (h.n) { g.fillStyle = h.c; g.textAlign = "left"; g.textBaseline = "bottom"; g.fillText(h.n, ml + 4, Y(h.y) - 2); }
  }
  g.save(); g.beginPath(); g.rect(ml, mt, pw, ph); g.clip();
  for (const s of o.series) {
    g.strokeStyle = s.c; g.lineWidth = s.w || 1.6; g.setLineDash(s.dash || []); g.beginPath();
    let px = -1, mn = 0, mx = 0, first = true, last = 0;
    const flush = () => { if (px < 0) return; const a = Y(mn), b = Y(mx); if (first) { g.moveTo(px, Y(last)); first = false; } g.lineTo(px, a); g.lineTo(px, b); g.lineTo(px, Y(last)); };
    const xx = s.x || xs;
    for (let i = 0; i < s.y.length; i++) {
      const x = xx[i]; if (x < x0 || x > x1) continue;
      const p = Math.round(X(x)), v = s.y[i];
      if (p !== px) { flush(); px = p; mn = v; mx = v; } else { if (v < mn) mn = v; if (v > mx) mx = v; }
      last = v;
    }
    flush(); g.stroke(); g.setLineDash([]);
  }
  if (o.cursor !== undefined && o.cursor !== null) { g.strokeStyle = css("--text", "#000"); g.globalAlpha = 0.45; g.lineWidth = 1; g.beginPath(); g.moveTo(X(o.cursor), mt); g.lineTo(X(o.cursor), mt + ph); g.stroke(); g.globalAlpha = 1; }
  for (const m of o.marks || []) { g.strokeStyle = m.c; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X(m.x), mt); g.lineTo(X(m.x), mt + ph); g.stroke(); g.setLineDash([]); if (m.n) { g.fillStyle = m.c; g.textAlign = "left"; g.textBaseline = "top"; g.fillText(m.n, X(m.x) + 3, mt + 2 + (m.dy || 0)); } }
  g.restore();
  g.strokeStyle = css("--axis", "#bbb"); g.strokeRect(ml + 0.5, mt + 0.5, pw, ph);
  if (o.yu) { g.save(); g.fillStyle = cText; g.translate(11, mt + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.yu, 0, 0); g.restore(); }
}
const legend = (items) => `<div class="rc-leg">${items.map((i) => `<span><i style="background:${i.c}${i.dash ? ";background:repeating-linear-gradient(90deg," + i.c + " 0 4px,transparent 4px 7px)" : ""}"></i>${esc(i.n)}</span>`).join("")}</div>`;

/* ------------------------------------------------------------------ static texts */
const BLK = {
  main: { t: "Main computer (controller CPU)", w: "Runs the robot program (interpreter with look-ahead), the path planner (corner blending, speed + acceleration limits checked with the dynamic model) and the interpolator (IPO): every IPO cycle it calculates a new setpoint for all 6 axes (for MoveL with the inverse kinematics). Also: teach-pendant user interface, program + backup files, event log, network (OPC UA, FTP).", v: "Industrial PC with a real-time operating system (example) · IPO cycle 4 ms = 250 setpoints/s (2–12 ms typical) · look-ahead of several program lines", f: "Fan / filter clogged → over-temperature; flash memory wear; lost programs without backup. Check: event log, fan, backup." },
  axis: { t: "Axis computer (servo control)", w: "Closes the position and speed loops of all axes every 0.5 ms (fine interpolation from the 4 ms IPO setpoints), adds the feedforward from the dynamic model (velocity + torque), reads the motor positions from the SMB over a serial link and sends torque (current) setpoints to the drives over a fast drive bus.", v: "Position + speed loop 0.5 ms (0.125–1 ms typical) · feedforward velocity + torque · following-error supervision", f: "Encoder communication error (cable, plug, SMB), following-error alarm after a collision or a wrong load. Check: SMB cable, plugs, revolution counters." },
  safety: { t: "Safety controller (dual channel)", w: "Two processors that cross-check each other. Reads e-stop, safety gate and enabling device on two channels each. Monitors safe speed, safe zones and joint limits with its own position values. Switches STO (removes the IGBT gate drive) and controls the brakes (SBC). Runs the cyclic brake test.", v: "PL d / Category 3 (ISO 13849-1) typical, ISO 10218-1 · reaction time ≈ 10–20 ms (example) · examples of options: ABB SafeMove, KUKA SafeOperation, FANUC DCS", f: "Channel discrepancy (welded contact, wiring fault) → fault, no restart. Check: e-stop + gate test (e.g. monthly), safety-configuration checksum after every change." },
  io: { t: "I/O + fieldbus", w: "Digital I/O (24 V DC) and fieldbus adapter/scanner to the line PLC, the machine and the gripper valves. Safety signals go over a safe fieldbus (PROFIsafe, CIP Safety, FSoE) or hard-wired dual channel.", v: "PROFINET / EtherNet/IP / EtherCAT (examples) · I/O cycle 1–8 ms (PROFINET RT e.g. 2–4 ms) · 16 DI / 16 DO boards (example)", f: "Wire break, short circuit on outputs, IP / device-name conflict, too many devices for the cycle time. Check: LEDs, I/O diagnosis in the pendant." },
  psu: { t: "Power supply 24 V DC", w: "Logic power for computers, I/O and the motor brakes (spring brakes open with 24 V). A buffer (capacitor / UPS) lets the controller save its data at power loss.", v: "24 V DC ± 10 %, e.g. 10–20 A (example)", f: "Overload from gripper valves → undervoltage → brakes do not open / controller restarts. Check: voltage, fuses." },
  cool: { t: "Cooling", w: "Fans + heat exchanger (or an air-conditioner in hot or dusty plants). The electronics stay in a closed clean part, the heat sinks of the drives are cooled from the back.", v: "Ambient e.g. 0–45 °C (check the datasheet) · drive losses ≈ 3–5 % of the power", f: "Dirty filter → over-temperature → drives reduce power or stop. Check: clean / replace every 6–12 months." },
  rect: { t: "Rectifier (main power)", w: "3-phase 400 V AC → DC bus. Main contactor + soft-charge resistor at power-on.", v: "V_DC = √2 · 400 V = 1.41 × 400 = 565 V without load (peak of the line-to-line voltage), a little less under load", f: "Phase missing, mains dips → 'DC bus under-voltage'. Check: incoming voltage, main fuses." },
  bus: { t: "DC bus capacitors", w: "Store energy and smooth the DC voltage. All 6 inverters share one DC bus: an axis that brakes (motor = generator) gives its energy to the axes that accelerate.", v: "Example 2 mF; energy ½·C·V² = ½ · 0.002 · 565² ≈ 320 J", f: "DANGER: stays charged after power-off → wait (e.g. 5 min, see the label) and measure before you open." },
  chop: { t: "Brake chopper + resistor", w: "When axes brake, energy flows back and the DC voltage rises. Above a threshold an IGBT switches the brake resistor on and turns the energy into heat. (Some drives feed it back to the grid instead.)", v: "On at ≈ 750 V, off at 730 V; 40 Ω → P = V²/R ≈ 14 kW peak (examples)", f: "Resistor too small / broken → 'DC bus over-voltage' alarm during fast stops. Check: resistor value, temperature." },
  inv: { t: "Servo inverter (one per axis)", w: "IGBT bridge that makes a 3-phase voltage for the motor with pulse-width modulation (PWM). Current loop with field-oriented control (FOC): it measures the phase currents, transforms them (Clarke: 3 phases → α/β; Park: → d/q in the rotor frame), keeps I_d = 0 and sets I_q ∝ torque (τ = K_t · I_q).", v: "PWM 8 kHz · current loop 62.5 µs (16 kHz) · protections: over-current, short circuit, I²t, IGBT temperature · STO input removes the gate pulses", f: "IGBT failure after many over-loads or over-temperature; motor cable short circuit. Check: drive event log, insulation of the motor cable." },
  tp: { t: "Teach pendant (FlexPendant / smartPAD / iPendant are examples)", w: "Touch screen + jog keys, emergency-stop button (dual channel, hard-wired), 3-position enabling device (released – middle = enable – pressed through = panic), mode selector (T1 / T2 / AUTO, often a key switch on the cabinet).", v: "Cable 10–30 m (or wireless with safe communication)", f: "Damaged cable, worn enabling device. Check: daily visual check, enabling + e-stop test." },
  motor: { t: "Servo motor with brake + encoder (6×)", w: "Permanent-magnet synchronous motor (AC servo). Spring-applied holding brake (opens with 24 V). Absolute encoder on the motor shaft (single-turn); the revolutions are counted on the SMB.", v: "", f: "Brake wear (see brake test), encoder failure, bearing noise. Check: brake test result, temperature, noise." },
  smb: { t: "Serial measurement board (SMB) + battery", w: "In the robot base. Reads the 6 motor encoders, counts motor revolutions (multi-turn absolute position) and sends the positions over a serial link to the axis computer. A battery keeps the revolution counters when the power is off.", v: "Battery life e.g. 2–3 years (check the manual) · encoder e.g. 20 bit per motor revolution (example)", f: "Empty battery → 'revolution counter not updated' → move each axis to its sync mark and update the counters (calibration). Change the battery in time!" },
  cable: { t: "Robot cables", w: "Motor power cable (shielded), SMB signal cable, customer cables (air + signals) from the cabinet to the robot base.", v: "Length e.g. 7–30 m (example)", f: "Damage by fork-lifts, sharp edges, too tight bending. Check: visual inspection every 6 months." },
  plc: { t: "Line PLC / machine / conveyor", w: "Exchanges signals with the robot over the fieldbus (card 6): commands + confirmations, robot status, safety signals on the safe fieldbus or hard-wired.", v: "PROFINET cycle e.g. 2–4 ms (example)", f: "Missing confirmation → timeout alarm (good design) instead of a crash (bad design)." },
};

/* ------------------------------------------------------------------ build item 2 */
function build() {
  const sim1 = window.rbSim;
  const S = {
    rbId: ROBOTS.some((r) => r.id === Q.get("rcrb")) ? Q.get("rcrb") : (sim1 && sim1.S ? sim1.S.rb.id : "irb2600"),
    j: Math.min(5, Math.max(0, (+Q.get("rcj") || 1) - 1)), dq: 30, ovr: 100, m: null, kScale: 1,
    ffv: true, fft: true, jerk: true, twc: false, bits: 20, gains: null, q: null,
    coll: { ovr: 50, frac: 60, kc: 20, thr: 8, wrong: Q.has("rcwrong") },
    replay: true, cur: 0, blk: Q.get("rcblk") || "main",
  };
  let M = null, R = null, RC = null, slowT = 0, raf = 0, lastTs = 0, built2 = false;
  const rb = () => robotById(S.rbId);
  function poseDefault() {
    if (sim1 && sim1.S && sim1.S.rb.id === S.rbId) return sim1.S.q.slice();
    return cellLayout(rb()).home.slice();
  }
  function loadDefault() { const C = cellLayout(rb()); return +(C.gripMass + C.part.mass).toFixed(1); }

  box.innerHTML = `
  <div class="rb-wrap rc-wrap">
    <div class="card rc-bar">
      <div class="rb-row">
        <label class="rb-lbl">Robot <select id="rcRb">${ROBOTS.map((r) => `<option value="${r.id}">${esc(r.ref)} – ${r.payload} kg / ${r.reach} mm</option>`).join("")}</select></label>
        <span class="rb-sep"></span>
        <span class="rc-pose" id="rcPose"></span>
        <button class="btn" id="rcPose1" title="use the present joint angles of the robot in item 1 for the dynamic model">Take pose from item 1</button>
        <button class="btn ghost" id="rcPoseH" title="home pose of the machine-tending cell">Home pose</button>
        <span class="rb-sep"></span>
        <label class="rb-lbl" title="gripper + part on the flange">Load <input type="range" id="rcLoad" min="0" max="20" step="0.5"> <b id="rcLoadV"></b></label>
      </div>
      <p class="hint">The same 4 reference robots as item 1 (catalogue data). Motor inertia, gear stiffness, friction and torque limits are <b>estimates</b> from simple sizing rules (shown in card 3) – check with the supplier.</p>
    </div>

    <div class="card" id="rcC1">
      <div class="card-head"><h2>1 · Controller architecture</h2><span class="sub">click a block · live values from the simulations below · example values</span></div>
      <p class="rc-why"><b>What you see:</b> the inside of a robot controller cabinet and the robot it drives. <b>Why it matters:</b> when you buy, install or repair a robot cell you must know which box does what – and what to check when it fails.</p>
      <div class="rc-arch"><div id="rcArch"></div><div class="rc-info" id="rcInfo"></div></div>
    </div>

    <div class="card" id="rcC2">
      <div class="card-head"><h2>2 · Motion pipeline – from a program line to motor current</h2><span class="sub">what happens every few milliseconds</span></div>
      <p class="rc-why"><b>What you see:</b> the chain of calculations from <code>MoveL p20, v500, z10, tGripper;</code> to the current in the motor. <b>Why it matters:</b> path accuracy, cycle time and vibration are decided in this chain – each stage has its own cycle time.</p>
      <div id="rcPipe"></div>
      <div class="rb-grid2">
        <div class="table-wrap"><table class="rb-tbl rc-wrapt" id="rcPipeT"></table></div>
        <div class="rc-note" id="rcPipeN"></div>
      </div>
    </div>

    <div class="card" id="rcC3">
      <div class="card-head"><h2>3 · Joint servo simulator – cascade control of one axis</h2><span class="sub">two-mass model · physics at ≤ 0.1 ms · loops at 0.5 ms · IPO 4 ms · estimates</span></div>
      <p class="rc-why"><b>What you see:</b> one robot joint moving 30° and back (PTP with the real axis speed), controlled like in a real controller: position loop → speed loop → current loop → motor → elastic gear → arm. <b>Why it matters:</b> the tuning and the feedforward decide the path accuracy and vibration; too high gains make the robot shake.</p>
      <div class="rc-ctl">
        <div class="rc-ctlrow">
          <label class="rb-lbl">Joint <select id="rcJ">${JN.map((n, i) => `<option value="${i}">${n}</option>`).join("")}</select></label>
          <label class="rb-lbl">Move <select id="rcDq">${[5, 10, 30, 60, 90].map((v) => `<option value="${v}">${v}°</option>`).join("")}</select></label>
          <label class="rb-lbl">Speed <select id="rcOvr">${[10, 25, 50, 100].map((v) => `<option value="${v}">${v} %</option>`).join("")}</select></label>
          <label class="rb-chk"><input type="checkbox" id="rcFfv"> velocity feedforward</label>
          <label class="rb-chk"><input type="checkbox" id="rcFft"> torque feedforward (dynamic model)</label>
          <label class="rb-chk" title="moving-average filter of the IPO setpoints over one period of the locked-motor frequency"><input type="checkbox" id="rcJerk"> jerk limit (setpoint filter)</label>
          <label class="rb-chk" title="motor setpoint + expected gear twist τ/k (stiffness model, like an 'absolute accuracy' option)"><input type="checkbox" id="rcTwc"> gear-twist compensation</label>
        </div>
        <div class="rc-ctlrow rc-sliders">
          <label class="rc-sl">Kv <input type="range" id="rcKv" min="0" max="100"><b id="rcKvV"></b></label>
          <label class="rc-sl">Kp <input type="range" id="rcKp" min="0" max="100"><b id="rcKpV"></b></label>
          <label class="rc-sl">Ti <input type="range" id="rcTi" min="0" max="100"><b id="rcTiV"></b></label>
          <label class="rc-sl">gear stiffness <input type="range" id="rcK" min="0" max="100"><b id="rcKV"></b></label>
          <label class="rc-sl">encoder <input type="range" id="rcBits" min="12" max="24" step="1"><b id="rcBitsV"></b></label>
          <button class="btn primary" id="rcTune">Auto-tune (rule of thumb)</button>
          <label class="rb-chk"><input type="checkbox" id="rcReplay" checked> replay cursor</label>
        </div>
      </div>
      <div class="rc-status" id="rcStat"></div>
      <div class="rb-kpis rc-kpis" id="rcKpi"></div>
      <div class="rb-grid2">
        <div>
          <div class="rb-cht">Position: setpoint vs actual (link) <span class="muted">deg, joint</span></div>${legend([{ n: "setpoint (IPO)", c: "var(--muted)", dash: 1 }, { n: "link (arm) actual", c: "var(--rb-c1)" }, { n: "motor ÷ n", c: "var(--rb-c2)" }])}
          <canvas id="rcChP" height="170"></canvas>
          <div class="rb-cht">Following error <span class="muted">arc-min (1° = 60′) · right: mm at the TCP</span> <span class="muted small" id="rcEmm"></span></div>${legend([{ n: "link (true error, incl. gear twist)", c: "var(--rb-c1)" }, { n: "motor encoder (what the controller sees)", c: "var(--rb-c2)" }])}
          <canvas id="rcChE" height="170"></canvas>
        </div>
        <div>
          <div class="rb-cht">Motor torque vs limit <span class="muted">N·m on the motor shaft</span> <span class="muted small" id="rcIa"></span></div>${legend([{ n: "motor torque", c: "var(--rb-c3)" }, { n: "± limit", c: "var(--critical)", dash: 1 }])}
          <canvas id="rcChT" height="170"></canvas>
          <div class="rb-cht">Gear twist = motor ÷ n − link <span class="muted">arc-min (spring of the reducer)</span></div>${legend([{ n: "twist", c: "var(--rb-c4)" }])}
          <canvas id="rcChW" height="170"></canvas>
        </div>
      </div>
      <details class="rc-det" open><summary>The model, the formulas and the numbers of this joint</summary><div id="rcModel"></div></details>
    </div>

    <div class="card" id="rcC4">
      <div class="card-head"><h2>4 · Collision detection with the dynamic model</h2><span class="sub">residual r = τ_measured − τ_model · same joint, pose, load and gains as card 3</span></div>
      <p class="rc-why"><b>What you see:</b> the arm hits an obstacle (a spring) during the move. The controller compares the measured motor torque with the torque the dynamic model expects. <b>Why it matters:</b> with a good model the threshold can be low → the robot stops earlier, with less force and less damage. Wrong load data → false alarms.</p>
      <div class="rc-ctlrow">
        <label class="rb-lbl">Speed <select id="rcCo">${[25, 50, 100].map((v) => `<option value="${v}">${v} %</option>`).join("")}</select></label>
        <label class="rc-sl">obstacle at <input type="range" id="rcCf" min="20" max="90" step="5"><b id="rcCfV"></b></label>
        <label class="rc-sl">contact stiffness <input type="range" id="rcCk" min="5" max="200" step="5"><b id="rcCkV"></b></label>
        <label class="rc-sl">threshold <input type="range" id="rcCt" min="4" max="40" step="1"><b id="rcCtV"></b></label>
        <label class="rb-chk"><input type="checkbox" id="rcCw"> wrong payload data (declared 0 kg)</label>
      </div>
      <div class="rb-grid2">
        <div>
          <div class="rb-cht">Residual (estimated external torque) <span class="muted">N·m, joint side</span></div>${legend([{ n: "with model", c: "var(--rb-c1)" }, { n: "threshold", c: "var(--warning)", dash: 1 }, { n: "no-model limit (current limit)", c: "var(--critical)", dash: 1 }])}
          <canvas id="rcChR" height="170"></canvas>
          <div class="rb-cht">Motor torque, both runs <span class="muted">N·m, joint side</span></div>${legend([{ n: "with model", c: "var(--rb-c1)" }, { n: "without model", c: "var(--rb-c2)" }])}
          <canvas id="rcChRT" height="150"></canvas>
        </div>
        <div>
          <div class="rb-cht">Contact force at the TCP <span class="muted">N</span></div>${legend([{ n: "with model", c: "var(--rb-c1)" }, { n: "without model (current limit / following error only)", c: "var(--rb-c2)" }])}
          <canvas id="rcChF" height="170"></canvas>
          <div class="table-wrap"><table class="rb-tbl rc-wrapt" id="rcCtab"></table></div>
        </div>
      </div>
      <div id="rcCtl"></div>
      <div class="rc-note" id="rcCnote"></div>
    </div>

    <div class="card" id="rcC5">
      <div class="card-head"><h2>5 · Safety system – live state machine</h2><span class="sub">IEC 60204-1 stop categories · IEC 61800-5-2 safe stop functions · ISO 10218-1 · ISO 13849-1</span></div>
      <p class="rc-why"><b>What you see:</b> the safety logic of the controller. Press the buttons like an operator. <b>Why it matters:</b> every stop has a category and a stopping time/distance – this decides the safety distance of fences and light curtains (ISO 13855) and how fast you can restart.</p>
      <div class="rc-safe">
        <div class="rc-safeL">
          <div class="rc-state" id="rcSt"></div>
          <div class="rc-inp" id="rcInp"></div>
          <div class="rc-btns">
            <button class="btn rc-estop" id="rcEs">E-STOP</button>
            <button class="btn" id="rcRst">Reset</button>
            <button class="btn" id="rcGate">Open safety gate</button>
            <span class="seg" role="group" aria-label="enabling device"><button class="seg-btn" data-rcen="0">released</button><button class="seg-btn" data-rcen="1">middle (enable)</button><button class="seg-btn" data-rcen="2">pressed through (panic)</button></span>
            <span class="seg" role="group" aria-label="mode"><button class="seg-btn" data-rcmode="T1">T1</button><button class="seg-btn" data-rcmode="T2">T2</button><button class="seg-btn" data-rcmode="AUTO">AUTO</button></span>
            <button class="btn" id="rcMon">Motors ON</button>
            <button class="btn primary" id="rcStart">Start</button>
            <button class="btn" id="rcStop">Stop</button>
          </div>
          <div class="rc-btns small">
            <button class="btn ghost" id="rcZone" title="the safety controller sees the TCP / tool outside the allowed zone">Simulate: tool leaves safe zone</button>
            <button class="btn ghost" id="rcSls" title="in T1 the TCP is faster than 250 mm/s">Simulate: T1 speed &gt; 250 mm/s</button>
            <label class="rb-chk"><input type="checkbox" id="rcStuck"> fault: gate channel B welded (discrepancy)</label>
          </div>
          <div class="rc-msg" id="rcSmsg"></div>
        </div>
        <div class="rc-safeR">
          <div class="rb-cht">Last stop – speed of J1 vs time <span class="muted">°/s · grey = the other categories for comparison</span></div>
          <canvas id="rcChS" height="170"></canvas>
          <div id="rcStl"></div>
        </div>
      </div>
      <div class="table-wrap rc-log"><table class="rb-tbl" id="rcLog"></table></div>
      <div class="rb-grid2">
        <div><h3>Safe zones (top view, live TCP of item 1)</h3><div id="rcZoneSvg"></div></div>
        <div><h3>Cyclic brake test</h3><div class="rc-ctlrow"><button class="btn" id="rcBt">Run brake test</button><label class="rb-chk"><input type="checkbox" id="rcBw"> worn brake on J2 (example fault)</label></div><div class="table-wrap"><table class="rb-tbl" id="rcBtT"></table></div><p class="hint" id="rcBtN"></p></div>
      </div>
      <h3>Stop categories and safe functions</h3>
      <div class="table-wrap"><table class="rb-tbl rc-wrapt" id="rcSfT"></table></div>
    </div>

    <div class="card" id="rcC6">
      <div class="card-head"><h2>6 · I/O + communication with the cell</h2><span class="sub">signals of the item-1 machine-tending program · handshake timing</span></div>
      <p class="rc-why"><b>What you see:</b> the signals between robot, machine, conveyor, gripper and line PLC, and their timing. <b>Why it matters:</b> most stops in a real cell are not robot faults but signal / handshake problems. Good handshakes (command + confirmation + timeout + interlock) make them safe and easy to find.</p>
      <div class="rc-ctlrow">
        <span class="rc-chip" id="rcIoMode"></span>
        <button class="btn" id="rcIoPrev">◀ step</button><button class="btn primary" id="rcIoPlay">▶ play</button><button class="btn" id="rcIoNext">step ▶</button><button class="btn ghost" id="rcIoRst">restart</button>
        <label class="rb-chk"><input type="checkbox" id="rcIoFault"> door sensor broken (diDoorOpen never comes)</label>
      </div>
      <canvas id="rcChIO" height="330"></canvas>
      <div class="rc-msg" id="rcIoTxt"></div>
      <div class="table-wrap"><table class="rb-tbl rc-wrapt" id="rcSig"></table></div>
      <div class="rc-note" id="rcIoNote"></div>
    </div>

    <div class="card" id="rcC7">
      <div class="card-head"><h2>7 · Programming + operation in short</h2><span class="sub">syntax similar to real robot languages (ABB RAPID style) – not a real controller program</span></div>
      <p class="rc-why"><b>What you see:</b> how a real robot program is organised, how the operator runs and restarts it, and what the controller needs for maintenance. <b>Why it matters:</b> wrong tool / load / work-object data are the most common cause of bad accuracy, false collision alarms and crashes.</p>
      <div id="rcProg"></div>
    </div>
  </div>`;

  box.querySelectorAll("canvas").forEach((c) => { c.style.height = c.getAttribute("height") + "px"; });
  /* ---------------- controls */
  $("rcRb").value = S.rbId;
  const logMap = (x, base, dec = 1) => base * Math.pow(10, (x - 50) / 50 * dec);    // slider 0..100 -> ×0.1 .. ×10
  const logInv = (v, base, dec = 1) => Math.max(0, Math.min(100, 50 + 50 * Math.log10(v / base) / dec));
  function setRobot(id, keepPose) {
    S.rbId = id; $("rcRb").value = id;
    if (!keepPose) S.q = poseDefault();
    S.m = loadDefault(); $("rcLoad").max = rb().payload; $("rcLoad").step = rb().payload <= 5 ? 0.1 : 0.5; $("rcLoad").value = S.m;
    S.gains = null; S.kScale = 1; $("rcK").value = 50;
    recompute(true, false, !built2);
  }
  function poseTxt() { $("rcPose").innerHTML = "Pose for the dynamic model: J = " + S.q.map((v) => fx(v, 0)).join(" / ") + "°"; }
  $("rcRb").addEventListener("change", (e) => setRobot(e.target.value));
  $("rcPose1").addEventListener("click", () => {
    if (!sim1 || !sim1.S) return;
    if (sim1.S.rb.id !== S.rbId) setRobot(sim1.S.rb.id, true);
    S.q = sim1.S.q.slice(); S.gains = null; recompute(true);
  });
  $("rcPoseH").addEventListener("click", () => { S.q = cellLayout(rb()).home.slice(); S.gains = null; recompute(true); });
  $("rcLoad").addEventListener("input", (e) => { S.m = +e.target.value; recompute(false); });
  $("rcJ").value = S.j; $("rcJ").addEventListener("change", (e) => { S.j = +e.target.value; S.gains = null; recompute(true); });
  $("rcDq").value = S.dq; $("rcDq").addEventListener("change", (e) => { S.dq = +e.target.value; recompute(false); });
  $("rcOvr").value = S.ovr; $("rcOvr").addEventListener("change", (e) => { S.ovr = +e.target.value; recompute(false); });
  [["rcFfv", "ffv"], ["rcFft", "fft"], ["rcJerk", "jerk"], ["rcTwc", "twc"]].forEach(([id, k]) => { $(id).checked = S[k]; $(id).addEventListener("change", (e) => { S[k] = e.target.checked; recompute(false); }); });
  $("rcBits").value = S.bits; $("rcBits").addEventListener("input", (e) => { S.bits = +e.target.value; recompute(false); });
  $("rcK").value = 50; $("rcK").addEventListener("input", (e) => { S.kScale = logMap(+e.target.value, 1, 0.5); S.gainsKeep = true; recompute(false, true); });
  $("rcKv").addEventListener("input", (e) => { S.gains.Kv = logMap(+e.target.value, S.gains.base.Kv); recompute(false); });
  $("rcKp").addEventListener("input", (e) => { S.gains.Kp = logMap(+e.target.value, S.gains.base.Kp, 2); recompute(false); });
  $("rcTi").addEventListener("input", (e) => { S.gains.Ti = logMap(+e.target.value, S.gains.base.Ti); recompute(false); });
  $("rcTune").addEventListener("click", () => { S.gains = null; recompute(false); });
  $("rcReplay").addEventListener("change", (e) => { S.replay = e.target.checked; });
  // collision controls
  const C4 = S.coll;
  $("rcCo").value = C4.ovr; $("rcCo").addEventListener("change", (e) => { C4.ovr = +e.target.value; runColl(); });
  [["rcCf", "frac", " % of the move"], ["rcCk", "kc", " kN/m"], ["rcCt", "thr", " % of τ_max"]].forEach(([id, k, u]) => {
    $(id).value = C4[k]; $(id + "V").textContent = C4[k] + u;
    $(id).addEventListener("input", (e) => { C4[k] = +e.target.value; $(id + "V").textContent = C4[k] + u; runCollSoon(); });
  });
  $("rcCw").checked = C4.wrong; $("rcCw").addEventListener("change", (e) => { C4.wrong = e.target.checked; runColl(); });

  /* ---------------- servo simulation */
  let tmr = 0;
  function recompute(newModel, keepGains, now) {
    clearTimeout(tmr);
    const run = () => {
      if (!S.q) S.q = poseDefault();
      if (S.m === null) { S.m = loadDefault(); $("rcLoad").max = rb().payload; $("rcLoad").value = S.m; }
      M = jointModel(rb(), S.j, S.q, S.m, S.kScale);
      if (!S.gains) {
        const G = autoTune(M);
        S.gains = { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, base: { ...G } };
        if (Q.has("rckp") && !S.kpDone) { S.kpDone = true; S.gains.Kp *= +Q.get("rckp") || 10; }
      }
      const G = S.gains;
      $("rcKv").value = logInv(G.Kv, G.base.Kv); $("rcKp").value = logInv(G.Kp, G.base.Kp, 2); $("rcTi").value = logInv(G.Ti, G.base.Ti);
      $("rcKvV").textContent = fx(G.Kv, 1) + " 1/s"; $("rcKpV").textContent = fx(G.Kp, G.Kp < 100 ? 1 : 0) + " N·m·s/rad"; $("rcTiV").textContent = fx(G.Ti * 1000, 1) + " ms";
      $("rcKV").textContent = M.k.toExponential(2).replace("e+", "·10^") + " N·m/rad"; $("rcBitsV").textContent = S.bits + " bit/rev";
      $("rcLoadV").textContent = fx(S.m, 1) + " kg";
      poseTxt();
      const t0 = performance.now();
      R = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: S.ffv, fft: S.fft, jerk: S.jerk, twc: S.twc, bits: S.bits, dq: S.dq, ovr: S.ovr / 100 });
      R.ms = performance.now() - t0;
      // comparison runs for the KPI "with / without feedforward"
      R.noFF = simulate(M, { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: false, fft: false, jerk: S.jerk, twc: false, bits: S.bits, dq: S.dq, ovr: S.ovr / 100 });
      S.cur = 0;
      drawServo(); modelBox(); runColl(); drawPipeNote(); archLive();
      if (newModel) buildStopCurves();
    };
    if (now) run(); else tmr = setTimeout(run, 60);
  }
  function drawServo() {
    if (!R) return;
    const o = R.out, G = S.gains, L = R.lever * 1000, cur = S.replay ? o.t[S.cur] : null;
    const st = R.status, sCls = st === "stable" ? "rc-ok" : st === "poorly damped" ? "rc-warn" : "rc-bad";
    const wv = G.Kp / (M.JL + M.JM), stab = st === "unstable" ? "UNSTABLE – the simulation diverged. Lower Kp / Kv." : st === "oscillating" ? "OSCILLATING – the axis does not come to rest (see the torque and twist charts). Gains too high for this gear resonance → lower Kp or Kv, or press Auto-tune." : st === "poorly damped" ? "Poorly damped – small vibration remains after the move. Lower the gains a little." : "Stable – the axis comes to rest inside the repeatability band.";
    $("rcStat").innerHTML = `<span class="rc-chip ${sCls}">${st.toUpperCase()}</span> <span>${stab}</span> <span class="muted small">· ${R.out.t.length} loop cycles + ${R.out.t.length * R.sub} physics steps computed in ${R.ms.toFixed(0)} ms</span>`;
    const k = (l, v, n, cls = "") => `<div class="kpi ${cls}"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`;
    const ratio = R.noFF.maxE / Math.max(1e-12, R.maxE);
    $("rcKpi").innerHTML = [
      k("Max following error (link)", fx(R.maxE * AM, 2) + "′", `= ${fx(R.maxE * L, 2)} mm at the TCP (lever ${fx(L, 0)} mm)`),
      k("Without feedforward", fx(R.noFF.maxE * AM, 1) + "′", `${fx(R.noFF.maxE * L, 1)} mm · FF reduces it ${fx(ratio, 0)}×`),
      k("Settling time", R.settle === null ? "—" : fx(R.settle * 1000, 0) + " ms", `to ±${rb().rep} mm (repeatability) after the setpoint stops`),
      k("Overshoot", fx(R.over * L, 3) + " mm", fx(R.over * AM, 2) + "′ past the final position"),
      k("Static gear sag", fx(R.sag * L, 2) + " mm", `τ_g/k = ${fx(M.hold0, 0)} N·m / k (motor side holds 0.000′)`),
      k("Peak motor torque", fx(R.peakTau / M.tauLim * 100, 0) + " %", `${fx(R.peakTau / (M.n * M.eta), 1)} of ${fx(M.tmMax, 1)} N·m motor`),
      k("Resonance f_res", fx(M.fRes, 1) + " Hz", `locked motor f_lock = ${fx(M.fLock, 1)} Hz`),
      k("Bandwidth (estimate)", fx(wv / (2 * Math.PI), 1) + " Hz", `speed loop ω_v = Kp/J; position ${fx(G.Kv / (2 * Math.PI), 1)} Hz`),
    ].join("");
    $("rcEmm").textContent = `1′ = ${fx(L / AM, 3)} mm at the TCP`;
    $("rcIa").textContent = `K_t ≈ ${fx(M.Kt, 2)} N·m/A → max ≈ ${fx(M.iMax, 1)} A (estimate)`;
    const xr = [0, R.tTot], deg = (v) => (M.q[M.j] + v / D2R);
    const c1 = css("--rb-c1", "#2a78d6"), c2 = css("--rb-c2", "#eb6834"), c3 = css("--rb-c3", "#1baf7a"), c4 = css("--rb-c4", "#eda100"), cm = css("--muted", "#888"), cc = css("--critical", "#d03b3b");
    const marks = [{ x: R.t0, c: cm, n: "move" }, { x: R.tStart2, c: cm, n: "back" }];
    chart($("rcChP"), { x: o.t, xr, xu: " s", yu: "deg", cursor: cur, marks, series: [{ y: o.ref.map(deg), c: cm, dash: [5, 4] }, { y: o.xM.map(deg), c: c2, w: 1.2 }, { y: o.xL.map(deg), c: c1 }] });
    chart($("rcChE"), { x: o.t, xr, xu: " s", yu: "arc-min", cursor: cur, zero: true, minSpan: 0.5, series: [{ y: o.eM.map((v) => v * AM), c: c2, w: 1.2 }, { y: o.eL.map((v) => v * AM), c: c1 }] });
    const tl = M.tmMax;
    chart($("rcChT"), { x: o.t, xr, xu: " s", yu: "N·m motor", cursor: cur, zero: true, hl: [{ y: tl, c: cc, n: "limit " + fx(tl, 1) }, { y: -tl, c: cc }], series: [{ y: o.tm, c: c3 }] });
    chart($("rcChW"), { x: o.t, xr, xu: " s", yu: "arc-min", cursor: cur, zero: true, minSpan: 0.2, series: [{ y: o.twist.map((v) => v * AM), c: c4 }] });
  }
  function modelBox() {
    const G = S.gains, r = rb(), sz = sizing(r)[S.j], A = autoTune(M);
    const rows = [
      ["Gear ratio n", M.n, "drive(rb) of robotdyn.js: n = motor rpm × 6 / axis speed (°/s) = " + sz.nMot + " × 6 / " + r.vmax[S.j]],
      ["Link inertia J_L at this pose", fx(M.JL, 3) + " kg·m²", "from the dynamic model: J_L = τ(q̈_j = 1 rad/s²) − τ(q̈ = 0) (invDyn, load " + fx(S.m, 1) + " kg)"],
      ["Motor inertia J_m (estimate)", M.Jm.toExponential(2) + " kg·m²", "sized so that J_L,max / (J_m·n²) = " + CTL.inertiaRatio + " (J_L,max = " + fx(sz.Imax, 2) + " kg·m² over the work space, full payload)"],
      ["Motor inertia at the joint J_M = J_m·n²", fx(M.JM, 3) + " kg·m²", "inertia ratio now J_L/J_M = " + fx(M.JL / M.JM, 2)],
      ["Gear stiffness k (estimate)", M.k.toExponential(2) + " N·m/rad", "= " + fx(M.k / AM, 0) + " N·m/arc-min (RV / strain-wave reducer + arm structure)"],
      ["Gear damping c", fx(M.c, 1) + " N·m·s/rad", "damping ratio ζ = " + CTL.zeta + " of the gear mode (estimate)"],
      ["Resonance (free–free)", fx(M.fRes, 2) + " Hz", "f_res = (1/2π)·√(k·(1/J_L + 1/J_M)) = (1/2π)·√(" + M.k.toExponential(2) + "·(1/" + fx(M.JL, 2) + " + 1/" + fx(M.JM, 2) + "))"],
      ["Locked-motor frequency", fx(M.fLock, 2) + " Hz", "f_lock = (1/2π)·√(k/J_L) – the arm swings at this frequency when the motor is held stiff"],
      ["Gravity torque here", fx(M.hold0, 0) + " N·m", "invDyn at the pose (gravity − balancer) → load torque on the gear"],
      ["Joint torque limit", fx(M.tauLim, 0) + " N·m", "= " + CTL.reserve + " × (max gravity " + fx(sz.Hmax, 0) + " + J_L,max · a_max " + fx(sz.Imax * sz.aMax, 0) + ") → motor max torque τ_m = τ/(n·η) = " + fx(M.tmMax, 2) + " N·m"],
      ["Friction (estimate)", fx(M.fc, 1) + " N·m + " + fx(M.bv, 1) + " N·m·s/rad", "Coulomb " + CTL.fricC * 100 + " % of the limit + viscous " + CTL.fricV * 100 + " % at max speed; the controller model knows " + CTL.fricModel * 100 + " %"],
      ["Encoder", S.bits + " bit/rev on the motor", "→ resolution at the joint 2π/(2^bits·n) = " + fx(R.res * AM * 60, 4) + " arc-sec = " + fx(R.res * R.lever * 1e6, 3) + " µm at the TCP"],
      ["Jerk filter", S.jerk ? jerkN(M) + " × 4 ms = " + fx(jerkN(M) * 4, 0) + " ms" : "off", "moving average of the IPO setpoints over ≈ 1/f_lock → the acceleration ramps up smoothly, the arm does not ring"],
    ];
    $("rcModel").innerHTML = `
      <div class="rc-eq">
        <div><b>Cascade control</b> (all values on the joint side: rad, rad/s, N·m)</div>
        <div>position loop (P): ω_cmd = K_v · (θ_set − θ_motor) + ω_FF &nbsp;·&nbsp; speed loop (PI): τ_cmd = K_p · (e_ω + (1/T_i)∫e_ω dt) + τ_FF &nbsp;·&nbsp; current loop: τ = τ_cmd /(1 + s·${CTL.tCur * 1000} ms), |τ| ≤ τ_max</div>
        <div>feedforward: ω_FF = dθ_set/dt &nbsp;·&nbsp; τ_FF = (Ĵ_L + J_M)·θ̈_set + τ̂_gravity(θ_set) + τ̂_friction(ω_set)</div>
        <div><b>Plant (two-mass):</b> J_M·θ̈_M = τ − k(θ_M − θ_L) − c(θ̇_M − θ̇_L) − τ_fric &nbsp;·&nbsp; J_L(θ)·θ̈_L + ½J_L′θ̇_L² = k(θ_M − θ_L) + c(θ̇_M − θ̇_L) − τ_gravity(θ_L) − τ_contact</div>
        <div><b>Units:</b> K_v in 1/s · K_p in N·m·s/rad <i>at the joint</i> (motor side: K_p/n² = ${(G.Kp / M.n / M.n).toExponential(2)} N·m·s/rad) · T_i in s · integration: semi-implicit Euler, dt = ${fx(R.dt * 1e6, 0)} µs</div>
        <div><b>Auto-tune rule of thumb:</b> ω_v = min(0.5·ω_res, 2π·80 Hz) = ${fx(A.wv, 1)} rad/s → K_p = (J_L + J_M)·ω_v = ${fx(A.Kp, 0)}, T_i = 4/ω_v = ${fx(A.Ti * 1000, 1)} ms, K_v = ω_v/4 = ${fx(A.Kv, 1)} 1/s</div>
      </div>
      <div class="table-wrap"><table class="rb-tbl rc-wrapt"><tr><th>Value</th><th class="num">This joint</th><th>How it is found</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td class="num">${r[1]}</td><td class="muted">${esc(r[2])}</td></tr>`).join("")}</table></div>
      <p class="hint">Try: switch off the torque feedforward (error ×2–3), switch off both feedforwards (error ×20–60), press the Kp slider to the right (oscillation), lower the gear stiffness (lower resonance, more vibration), set the encoder to 12 bit (torque noise). Gear-twist compensation removes the static sag and halves the link error (the motor encoder cannot see the twist).</p>`;
  }

  /* ---------------- collision detection */
  let collT = 0;
  function runCollSoon() { clearTimeout(collT); collT = setTimeout(runColl, 80); }
  function runColl() {
    if (!M || !S.gains) return;
    const G = S.gains, base = { Kv: G.Kv, Kp: G.Kp, Ti: G.Ti, ffv: true, fft: true, jerk: S.jerk, twc: S.twc, bits: S.bits, dq: S.dq, ovr: C4.ovr / 100 };
    const coll = { on: true, frac: C4.frac / 100, kc: C4.kc * 1000, thr: C4.thr / 100 };
    const mDecl = C4.wrong ? 0 : S.m;
    const a = simulate(M, { ...base, mDecl, coll: { ...coll, mode: "model" } });
    const b = simulate(M, { ...base, coll: { ...coll, mode: "none" } });
    const f = simulate(M, { ...base, mDecl, coll: { ...coll, kc: 0, frac: 2, mode: "model" } });     // no obstacle: false alarm?
    RC = { a, b, f };
    drawColl();
  }
  function drawColl() {
    if (!RC) return;
    const { a, b, f } = RC, lim = M.tauLim, thr = C4.thr / 100 * lim, L = a.lever * 1000;
    const c1 = css("--rb-c1", "#2a78d6"), c2 = css("--rb-c2", "#eb6834"), cw = css("--warning", "#fab219"), cc = css("--critical", "#d03b3b"), cm = css("--muted", "#888");
    const tEnd = Math.min(a.tTot, (a.contact ? a.contact.t : a.tEnd1) + 0.6);
    const xr = [Math.max(0, (a.contact ? a.contact.t : a.t0) - 0.35), tEnd];
    const mk = (r, c, dy) => { const m = []; if (r.contact) m.push({ x: r.contact.t, c: cm, n: "contact" }); if (r.det) m.push({ x: r.det.t, c, n: "detected", dy }); return m; };
    chart($("rcChR"), { x: a.out.t, xr, xu: " s", yu: "N·m", zero: true, hl: [{ y: thr, c: cw, n: "threshold " + C4.thr + " %" }, { y: -thr, c: cw }, { y: 0.95 * lim, c: cc, n: "current limit (no-model detection)" }],
      marks: mk(a, c1, 12), series: [{ y: a.out.res, c: c1 }] });
    chart($("rcChRT"), { x: a.out.t, xr, xu: " s", yu: "N·m", zero: true, hl: [{ y: lim, c: cc }, { y: -lim, c: cc }], series: [{ y: b.out.tau, x: b.out.t, c: c2, w: 1.2 }, { y: a.out.tau, c: c1 }] });
    chart($("rcChF"), { x: a.out.t, xr, xu: " s", yu: "N", marks: [...mk(a, c1, 12), ...mk(b, c2, 24).filter((m) => m.n !== "contact")], series: [{ y: b.out.F, x: b.out.t, c: c2 }, { y: a.out.F, c: c1 }] });
    const row = (n, r) => {
      if (!r.contact) return `<tr><td>${n}</td><td colspan="5">no contact – ${r.det ? "stopped BEFORE the obstacle (false alarm at " + fx(r.det.t, 3) + " s)" : "obstacle not reached"}</td></tr>`;
      const dT = r.det ? (r.det.t - r.contact.t) * 1000 : null;
      return `<tr><td>${n}</td><td class="num">${dT === null ? "— (never)" : fx(dT, 1) + " ms"}</td><td class="num"><b>${fx(r.Fmax, 0)} N</b></td><td class="num">${r.stopDist !== null ? fx(r.stopDist * 1000, 1) + " mm" : "—"}</td><td class="num">${r.stop && r.stop.tStand ? fx((r.stop.tStand - r.contact.t) * 1000, 0) + " ms" : "—"}</td><td>${r.det ? esc(r.det.why) : "not detected – the motor pushes at its limit"}</td></tr>`;
    };
    $("rcCtab").innerHTML = `<tr><th>Detection</th><th class="num">contact → detected</th><th class="num">max force</th><th class="num">push-in after contact</th><th class="num">contact → standstill</th><th>trigger</th></tr>` + row("with model (residual)", a) + row("without model", b);
    // timeline of the model-based stop
    const r = a;
    let tl = "";
    if (r.contact && r.det) {
      const t0 = r.contact.t, ev = [["contact", 0], ["residual > threshold → stop", (r.det.t - t0) * 1000]];
      if (r.stop.tStand) ev.push(["standstill (ramp done)", (r.stop.tStand - t0) * 1000]);
      if (r.stop.tBrake) ev.push(["brakes closed → STO", (r.stop.tBrake - t0) * 1000]);
      const tMax = ev[ev.length - 1][1] || 1;
      tl = `<h3>Timeline of the model-based stop (ms after contact)</h3><div class="rc-tl">${ev.map((e, i) => `<div class="rc-tle" style="left:${Math.max(0, Math.min(92, e[1] / tMax * 92)).toFixed(1)}%"><i></i><span class="${i % 2 ? "rc-tld" : ""}">${fx(e[1], 0)} ms<br>${esc(e[0])}</span></div>`).join("")}<div class="rc-tlbar"></div></div>`;
    }
    $("rcCtl").innerHTML = tl;
    const fa = f.falseAlarm;
    $("rcCnote").innerHTML = `
      <p><b>Without obstacle</b> (same move, ${C4.wrong ? "<b>declared load 0 kg</b>, real load " + fx(S.m, 1) + " kg" : "correct load data"}): max residual = <b>${fx(f.maxRes / lim * 100, 1)} %</b> of τ_max (threshold ${C4.thr} %) → ${fa ? `<span class="rc-bad">FALSE ALARM at ${fx(fa.t, 3)} s – the robot stops without a collision.</span> The model expects less torque than the motor really needs (gravity + inertia of the missing ${fx(S.m, 1)} kg). Enter the correct load data (or run the load identification) – do not just raise the threshold.` : `<span class="rc-ok">no false alarm.</span>`}</p>
      <p><b>How it works:</b> the controller cannot measure the external force – it estimates it. Generalised-momentum observer (1 axis): p = Ĵ·ω, &nbsp; r = K_O · (p − p₀ − ∫(τ_meas − τ̂_g − τ̂_f + ½Ĵ′ω² + r) dt), K_O = ${CTL.kO} 1/s → r ≈ external torque, filtered with 1/K_O ≈ ${fx(1000 / CTL.kO, 0)} ms. τ_meas comes from the motor current (τ = K_t·I_q·n·η). Without a model the controller only sees "motor at the current limit for 10 ms" or "following error > 1°" – both need a much bigger force.</p>
      <p><b>Reaction:</b> stop like category 1 (controlled ramp with max torque, then STO + brakes, brake closes ≈ ${CTL.brakeDelay * 1000} ms after the command). Many controllers then move back a few mm to release a clamped person or part. Contact model: spring ${C4.kc} kN/m at ${C4.frac} % of the move (a hard fixture ≈ 100–1000 kN/m; a human hand / arm is much softer – ISO/TS 15066 gives limits for collaborative robots).</p>`;
  }

  /* ---------------- architecture SVG */
  function archSvg() {
    const B = (k, x, y, w, h, title, lines = [], cls = "") => `<g class="rc-blk ${cls}" data-rcblk="${k}" tabindex="0"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="rc-bt" x="${x + 8}" y="${y + 17}">${title}</text>${lines.map((l, i) => `<text class="rc-bl" x="${x + 8}" y="${y + 33 + i * 14}">${l}</text>`).join("")}<text class="rc-live" id="rcL_${k}" x="${x + 8}" y="${y + h - 7}"></text></g>`;
    let inv = "";
    for (let i = 0; i < 6; i++) inv += B("inv", 262 + i * 61, 332, 55, 96, "J" + (i + 1), ["IGBT", "PWM", "8 kHz"], "rc-small");
    let mot = "";
    const mp = [[858, 448], [858, 360], [880, 268], [930, 170], [968, 196], [990, 150]];
    mp.forEach((p, i) => { mot += `<g class="rc-blk rc-mot" data-rcblk="motor" tabindex="0"><circle cx="${p[0]}" cy="${p[1]}" r="13"/><text class="rc-bl" x="${p[0]}" y="${p[1] + 4}" text-anchor="middle">M${i + 1}</text></g>`; });
    return `<svg class="rc-svg" viewBox="0 0 1010 540" role="img" aria-label="robot controller architecture">
      <rect class="rc-cab" x="8" y="8" width="636" height="524" rx="10"/><text class="rc-cabt" x="20" y="28">Controller cabinet (e.g. ABB IRC5 / OmniCore, KUKA KR C5, FANUC R-30iB – examples)</text>
      ${B("main", 22, 40, 200, 126, "Main computer", ["program interpreter (look-ahead)", "path planner + dynamic model", "interpolator IPO 4 ms", "kinematics FK / IK"])}
      ${B("axis", 234, 40, 180, 126, "Axis computer", ["position loop 0.5 ms", "speed loop 0.5 ms", "feedforward v + τ", "following-error check"])}
      ${B("safety", 426, 40, 206, 126, "Safety controller", ["2 channels (A + B), cross-check", "STO · SS1 · SS2 · SOS · SLS", "safe zones · brake test (SBC)", "PL d / Cat 3"], "rc-safeblk")}
      ${B("io", 22, 180, 200, 84, "I/O + fieldbus", ["DI/DO 24 V · safe I/O", "PROFINET / EtherNet/IP / EtherCAT"])}
      ${B("psu", 234, 180, 180, 84, "Power supply 24 V DC", ["logic, I/O, brake release"])}
      ${B("cool", 426, 180, 206, 84, "Cooling", ["fans + heat exchanger", "clean side / heat-sink side"])}
      <rect class="rc-drv" x="22" y="278" width="610" height="242" rx="8"/><text class="rc-cabt" x="34" y="296">Drive module – 6 servo drives on one DC bus</text>
      ${B("rect", 34, 332, 104, 96, "Rectifier", ["400 V AC → DC", "diodes"])}
      ${B("chop", 150, 332, 100, 96, "Brake chopper", ["+ resistor", "on > 750 V"])}
      ${inv}
      <line class="rc-dcbus" x1="86" y1="316" x2="628" y2="316"/><text class="rc-bl" x="390" y="311" text-anchor="middle">DC bus + capacitors (≈ 565 V DC = 1.41 × 400 V)</text>
      <g class="rc-blk rc-busblk" data-rcblk="bus" tabindex="0"><rect x="34" y="440" width="216" height="70" rx="6"/><text class="rc-bt" x="42" y="458">DC bus capacitors</text><text class="rc-bl" x="42" y="474">shared by all 6 axes</text><text class="rc-live" id="rcL_bus" x="42" y="500"></text></g>
      <g class="rc-blk" data-rcblk="inv" tabindex="0"><rect x="262" y="440" width="360" height="70" rx="6"/><text class="rc-bt" x="270" y="458">Current loop (FOC) in every drive</text><text class="rc-bl" x="270" y="474">62.5 µs (16 kHz) · Clarke/Park · I_d = 0 · I_q ∝ torque · STO input</text><text class="rc-live" id="rcL_inv" x="270" y="500"></text></g>
      <path class="rc-wire" d="M8 380 L34 380"/><text class="rc-bl" x="12" y="372">3~</text>
      <path class="rc-wire" d="M86 316 L86 332 M200 316 L200 332 ${[0, 1, 2, 3, 4, 5].map((i) => `M${289 + i * 61} 316 L${289 + i * 61} 332`).join(" ")}"/>
      <path class="rc-sig" d="M222 100 L234 100 M414 100 L426 100 M228 166 L228 278 M420 166 L420 278"/>
      ${B("tp", 660, 400, 130, 120, "Teach pendant", ["e-stop (2 ch.)", "enabling device", "3 positions", "mode T1 / T2 / AUTO"])}
      ${B("plc", 660, 190, 130, 84, "Line PLC / CNC", ["conveyor, machine", "fieldbus + safe bus"])}
      <path class="rc-sig" d="M120 264 L120 271 L652 271 L652 232 L660 232 M632 150 L648 150 L648 440 L660 440"/>
      <g class="rc-robot"><path class="rc-arm" d="M840 520 L880 520 L870 470 L850 470 Z"/><path class="rc-armline" d="M858 470 L858 360 L880 268 L960 182 L992 150"/></g>
      ${mot}
      <g class="rc-blk" data-rcblk="smb" tabindex="0"><rect x="896" y="470" width="104" height="48" rx="6"/><text class="rc-bt" x="904" y="488">SMB + battery</text><text class="rc-bl" x="904" y="504">encoders, rev. counter</text></g>
      <g class="rc-blk rc-cable" data-rcblk="cable" tabindex="0"><path class="rc-cab2" d="M632 490 C 720 530, 800 530, 846 508"/><path class="rc-cab2 rc-cab3" d="M632 508 C 720 548, 820 548, 896 506"/><text class="rc-bl" x="700" y="538">motor power + SMB signal cables</text></g>
      <text class="rc-cabt" x="830" y="40">Robot (6 axes)</text>
    </svg>`;
  }
  $("rcArch").innerHTML = archSvg();
  function showBlk(k) {
    S.blk = k; const b = BLK[k]; if (!b) return;
    $("rcArch").querySelectorAll(".rc-blk").forEach((g) => g.classList.toggle("on", g.dataset.rcblk === k));
    let v = b.v;
    if (k === "motor" && M) { const z = sizing(rb()); v = `This robot (estimates): ${z.map((s, i) => `J${i + 1} τ_m,max ${fx(s.tmMax, s.tmMax < 10 ? 2 : 1)} N·m, n = ${s.n}`).join(" · ")} · motor speed ${z[0].nMot} rpm`; }
    $("rcInfo").innerHTML = `<h3>${esc(b.t)}</h3><p>${esc(b.w)}</p><p><b>Typical values:</b> ${esc(v)}</p><p><b>What fails / what to check:</b> ${esc(b.f)}</p><div class="rc-livebox" id="rcInfoLive"></div>`;
    archLive();
  }
  $("rcArch").addEventListener("click", (e) => { const g = e.target.closest("[data-rcblk]"); if (g) showBlk(g.dataset.rcblk); });
  $("rcArch").addEventListener("keydown", (e) => { if (e.key === "Enter") { const g = e.target.closest("[data-rcblk]"); if (g) showBlk(g.dataset.rcblk); } });
  function archLive() {
    if (!R) return;
    const o = R.out, i = Math.min(o.t.length - 1, S.cur), set = (k, t) => { const el = $("rcL_" + k); if (el) el.textContent = t; };
    const r1 = sim1 && sim1.run, line = r1 && r1.on ? "item 1: line " + (r1.pc + 1) + " running" : "item 1: program stopped";
    set("main", "▶ " + line);
    set("axis", `J${S.j + 1}: error ${fx(o.eM[i] * AM, 2)}′ · t = ${fx(o.t[i], 2)} s`);
    set("safety", "state: " + SF.st.replace("_", " ") + " · " + SF.mode);
    set("bus", `V_DC = ${fx(o.vdc[i], 0)} V ${o.chop[i] ? "· CHOPPER ON" : ""}`);
    set("inv", `J${S.j + 1}: τ_m ${fx(o.tm[i], 2)} N·m · I_q ≈ ${fx(o.tm[i] / M.Kt, 1)} A · P = ${fx(o.P[i] / 1000, 2)} kW`);
    set("chop", o.chop[i] ? "ON – burning energy" : "off");
    set("tp", SF.mode + " · enabling " + ["released", "middle", "panic"][SF.en]);
    set("io", sim1 && sim1.run && sim1.run.on ? "cycle running" : "");
    const lb = $("rcInfoLive");
    if (lb) lb.innerHTML = `<b>Live (servo replay of card 3, J${S.j + 1}):</b> V_DC ${fx(o.vdc[i], 0)} V${o.chop[i] ? " (chopper ON)" : ""} · motor torque ${fx(o.tm[i], 2)} N·m · power ${fx(o.P[i] / 1000, 2)} kW · following error ${fx(o.eM[i] * AM, 2)}′ · safety state ${SF.st.replace("_", " ")} · ${esc(line)}`;
  }

  /* ---------------- motion pipeline */
  function pipeSvg() {
    const st = [["Interpreter", "reads program lines", "look-ahead 2–5 lines"], ["Path planner", "blending (zones), v + a limits", "dynamic model, S-curve"], ["Interpolator (IPO)", "setpoint every 4 ms", "LIN: IK every cycle"],
      ["Axis computer", "position + speed loops", "0.5 ms + feedforward"], ["Drive", "current loop FOC", "62.5 µs, PWM 8 kHz"], ["Motor → gear → arm", "τ = K_t·I_q · n · η", "elastic gear"], ["Encoder", "20 bit/rev on the motor", "back to the axis computer"]];
    const w = 132, gap = 12;
    return `<svg class="rc-svg rc-pipe" viewBox="0 0 ${st.length * (w + gap)} 120" role="img" aria-label="motion pipeline">${st.map((s, i) => {
      const x = i * (w + gap);
      return `<g class="rc-blk${i === 6 ? " rc-fb" : ""}"><rect x="${x}" y="10" width="${w}" height="74" rx="6"/><text class="rc-bt" x="${x + 7}" y="28">${s[0]}</text><text class="rc-bl" x="${x + 7}" y="46">${s[1]}</text><text class="rc-bl" x="${x + 7}" y="61">${s[2]}</text></g>${i < st.length - 1 ? `<path class="rc-arrow" d="M${x + w} 47 L${x + w + gap} 47"/>` : ""}`;
    }).join("")}<path class="rc-arrow rc-fbline" d="M${6 * (w + gap) + w / 2} 84 L${6 * (w + gap) + w / 2} 106 L${3 * (w + gap) + w / 2} 106 L${3 * (w + gap) + w / 2} 86"/><text class="rc-bl" x="${4.6 * (w + gap)}" y="102" text-anchor="middle">feedback: motor position every 0.5 ms (serial link from the SMB)</text></svg>`;
  }
  $("rcPipe").innerHTML = pipeSvg();
  $("rcPipeT").innerHTML = `<tr><th>Stage</th><th>Cycle (example)</th><th>Per second</th><th>Output</th></tr>` + [
    ["Interpreter + planner", "event-driven, ahead of the motion", "—", "path segments with speed, zone, tool, load"],
    ["Interpolator (IPO)", "4 ms (2–12 ms)", "250", "joint setpoints θ_set for 6 axes"],
    ["Fine interpolation", "0.5 ms", "2 000", "θ_set between two IPO points (quadratic in the app; linear or spline in real controllers)"],
    ["Position + speed loop", "0.5 ms (0.125–1 ms)", "2 000", "torque (current) setpoint"],
    ["Current loop (FOC)", "62.5 µs (16 kHz)", "16 000", "phase voltages"],
    ["PWM", "125 µs (8 kHz)", "8 000", "IGBT switching"],
    ["Fieldbus I/O (PROFINET)", "2–4 ms", "250–500", "DI/DO to the PLC"],
    ["Safety controller", "≈ 2–4 ms cycle, reaction 10–20 ms", "—", "STO, SBC, safe outputs"],
  ].map((r) => `<tr>${r.map((c, i) => `<td${i === 2 ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`).join("");
  function drawPipeNote() {
    if (!M) return;
    const r = rb(), v = r.vmax[S.j], d = v * CTL.tIpo;
    $("rcPipeN").innerHTML = `<p><b>Example with this robot:</b> J${S.j + 1} at its max speed ${v}°/s moves ${fx(d, 2)}° per 4 ms IPO cycle = ${fx(d * D2R * M.lever * 1000, 1)} mm at the TCP (lever ${fx(M.lever * 1000, 0)} mm). The axis computer cuts each step into 8 steps of 0.5 ms.</p>
      <p><b>Field-oriented control in short words:</b> the 3 phase currents are measured and turned into 2 values in the rotor frame (Clarke: a,b,c → α,β; Park: α,β → d,q with the rotor angle from the encoder). I_d (along the magnet field) is kept at 0, I_q (across) makes the torque: τ_m = K_t · I_q. Here K_t ≈ ${fx(M.Kt, 2)} N·m/A (estimate) → the motor of J${S.j + 1} needs ≈ ${fx(M.iMax, 1)} A for its max torque ${fx(M.tmMax, 2)} N·m.</p>
      <p><b>Look-ahead:</b> the planner must know the next points to blend a corner (zone z50 = start turning 50 mm before the point) and to slow down in time. That is why a <code>WaitDI</code> inside a zone movement makes the robot stop at the point (fine) – the planner cannot look past it.</p>`;
  }

  /* ---------------- safety state machine */
  const SF = { st: "MOTORS_OFF", mode: "AUTO", estop: false, gate: true, en: 0, stuck: false, fault: "", log: [], last: null, t0: performance.now(), brakeWorn: false };
  let curves = null;
  function buildStopCurves() {
    const r = rb(), C = cellLayout(r);
    const Mj1 = jointModel(r, 0, S.q || C.home.slice(), S.m === null ? loadDefault() : S.m);
    curves = { M: Mj1, s: stopCurves(Mj1, 1) };
    drawStop(); drawBrake(); drawZones();
  }
  const FUN = {
    STO: "Safe torque off – no energy to the motor (IGBT gate drive off)", SS1: "Safe stop 1 – controlled ramp, then STO", SS2: "Safe stop 2 – controlled ramp, then SOS",
    SOS: "Safe operating stop – power on, standstill is monitored", SLS: "Safely limited speed", SBC: "Safe brake control – brake closed safely",
  };
  function logEv(ev, cat, funcs, res) {
    const t = (performance.now() - SF.t0) / 1000;
    SF.log.unshift({ t, ev, cat, funcs, res }); SF.log = SF.log.slice(0, 12);
  }
  function stopNow(cause, cat) {                    // cat 0 | 1 | 2
    const was = SF.st, moving = was === "RUNNING";
    const v0f = moving ? (SF.mode === "AUTO" ? 1 : SF.mode === "T2" ? 1 : 0.12) : 0;
    const funcs = cat === 0 ? ["STO", "SBC"] : cat === 1 ? ["SS1", "STO", "SBC"] : ["SS2", "SOS"];
    SF.last = { cause, cat, v0f, t: performance.now() };
    logEv(cause, "cat " + cat, funcs.join(" → "), moving ? "robot was moving – stopped" : was === "MOTORS_ON" ? "drives were on, robot standing" : "no motion");
    drawStop();
  }
  function msgS(t, bad) { $("rcSmsg").innerHTML = t ? `<span class="${bad ? "rc-bad" : ""}">${esc(t)}</span>` : ""; }
  function sev(kind, val) {
    msgS("");
    switch (kind) {
      case "estop":
        if (!SF.estop) { SF.estop = true; if (SF.st !== "MOTORS_OFF" || true) { const c = SF.st === "RUNNING" ? 1 : 0; stopNow("EMERGENCY STOP pressed (both channels open)", c); } SF.st = "EMERGENCY_STOP"; msgS("Emergency stop: stop category 1 if the robot moves (SS1: ramp, then STO + brakes) – category 0 is also allowed by ISO 10218-1. Release the button (turn), then press Reset."); }
        else { SF.estop = false; logEv("E-stop released (turned back)", "—", "—", "still stopped – Reset needed (no automatic restart, ISO 13849 / IEC 60204-1)"); msgS("Released. The robot does NOT restart by itself. Press Reset, then Motors ON."); }
        break;
      case "reset":
        if (SF.fault) { if (SF.stuck) { msgS("Reset refused: channel B of the gate switch is still closed while A is open (discrepancy). Repair the switch / wiring first.", true); logEv("Reset", "—", "—", "refused – discrepancy fault still present"); return draw(); } SF.fault = ""; }
        if (SF.estop) { msgS("Reset refused: the emergency stop is still pressed.", true); logEv("Reset", "—", "—", "refused – e-stop pressed"); break; }
        if (SF.mode === "AUTO" && !SF.gate) { msgS("Reset refused: the safety gate is open (AUTO).", true); logEv("Reset", "—", "—", "refused – gate open"); break; }
        if (SF.st === "EMERGENCY_STOP" || SF.st === "PROTECTIVE_STOP" || SF.st === "SAFETY_FAULT") { SF.st = "MOTORS_OFF"; logEv("Reset", "—", "—", "stop acknowledged → MOTORS OFF"); }
        break;
      case "gate":
        if (SF.gate) {
          SF.gate = false;
          if (SF.stuck) {
            SF.fault = "discrepancy"; const c = SF.st === "RUNNING" ? 1 : 0;
            if (SF.st !== "MOTORS_OFF" && SF.st !== "EMERGENCY_STOP") stopNow("Gate opened – channel A open, channel B stays closed", c);
            SF.st = "SAFETY_FAULT";
            logEv("Discrepancy time (e.g. 100 ms) exceeded", "cat 0", "STO → SBC", "SAFETY FAULT – channel B welded? no reset until repaired");
            msgS("Dual-channel check: A opened, B did not within the discrepancy time (e.g. 100 ms) → fault. This is why safety inputs have 2 channels: one welded contact is detected (Category 3).", true);
          } else if (SF.mode === "AUTO" && (SF.st === "RUNNING" || SF.st === "MOTORS_ON")) {
            stopNow("Safety gate opened in AUTO (protective stop)", SF.st === "RUNNING" ? 1 : 0); SF.st = "PROTECTIVE_STOP";
            msgS("Protective stop (guard stop). Close the gate, press Reset, Motors ON, Start.");
          } else logEv("Safety gate opened", "—", "—", SF.mode === "AUTO" ? "motors were off – no effect" : "manual mode: gate is not used, the enabling device protects you");
        } else { SF.gate = true; logEv("Safety gate closed", "—", "—", SF.st === "PROTECTIVE_STOP" ? "Reset needed" : "ok"); }
        break;
      case "en": {
        const prev = SF.en; SF.en = val;
        if (SF.mode === "AUTO") { logEv("Enabling device " + ["released", "middle", "pressed through"][val], "—", "—", "AUTO: the enabling device has no function"); break; }
        if (val === 1 && prev === 0) {
          if (SF.st === "MOTORS_OFF" && !SF.estop && !SF.fault) { SF.st = "MOTORS_ON"; logEv("Enabling device → middle", "—", SF.mode === "T1" ? "SLS 250 mm/s active" : "T2: full speed!", "drives ON, brakes open (manual mode)"); }
          else logEv("Enabling device → middle", "—", "—", "no effect – " + SF.st.replace("_", " "));
        } else if (val !== 1 && prev === 1) {
          if (SF.st === "MOTORS_ON" || SF.st === "RUNNING") { stopNow(val === 2 ? "Enabling device pressed through (panic)" : "Enabling device released", SF.st === "RUNNING" ? 1 : 0); SF.st = "MOTORS_OFF"; }
        } else if (val === 2 && prev === 0) logEv("Enabling device pressed through", "—", "—", "no enable (panic position)");
        break;
      }
      case "mode":
        if (val === SF.mode) break;
        if (SF.st === "MOTORS_ON" || SF.st === "RUNNING") { stopNow("Operating mode changed " + SF.mode + " → " + val, SF.st === "RUNNING" ? 1 : 0); SF.st = "MOTORS_OFF"; }
        else logEv("Mode " + SF.mode + " → " + val, "—", "—", "ok");
        SF.mode = val;
        if (val === "T2") msgS("T2 = manual full speed: only with the enabling device, and only if the risk assessment allows it (not allowed in all applications / countries).");
        if (val === "T1") msgS("T1 = manual reduced speed: the safety controller limits the TCP (and the flange) to 250 mm/s (SLS, ISO 10218-1).");
        break;
      case "mon":
        if (SF.mode !== "AUTO") { msgS("Manual mode: the drives switch on with the enabling device (middle position)."); break; }
        if (SF.st !== "MOTORS_OFF") { msgS("Motors ON only from MOTORS OFF (" + SF.st.replace("_", " ") + " now).", true); break; }
        if (!SF.gate || SF.estop || SF.fault) { msgS("Motors ON refused: " + (!SF.gate ? "gate open" : SF.estop ? "e-stop pressed" : "safety fault"), true); logEv("Motors ON", "—", "—", "refused"); break; }
        SF.st = "MOTORS_ON"; logEv("Motors ON", "—", "—", "main contactor on, STO released, brakes open, servo holds");
        break;
      case "start":
        if (SF.st !== "MOTORS_ON") { msgS("Start needs MOTORS ON (" + SF.st.replace("_", " ") + " now).", true); break; }
        if (SF.mode !== "AUTO" && SF.en !== 1) { msgS("Manual: hold the enabling device in the middle position (hold-to-run).", true); break; }
        SF.st = "RUNNING"; logEv("Start", "—", SF.mode === "T1" ? "SLS 250 mm/s" : "—", "program runs" + (SF.mode === "T1" ? " (hold-to-run, ≤ 250 mm/s)" : ""));
        break;
      case "stop":
        if (SF.st === "RUNNING") { stopNow("Stop button (program stop)", 2); SF.st = "MOTORS_ON"; msgS("Category 2 stop: ramp on the path, power stays on, standstill monitored (SOS). Start continues the program."); }
        break;
      case "zone":
        if (SF.st === "RUNNING" || SF.st === "MOTORS_ON") { stopNow("Safe zone violated (tool outside the allowed cartesian zone)", SF.st === "RUNNING" ? 1 : 0); SF.st = "PROTECTIVE_STOP"; msgS("The safety controller computes the tool position from its own encoder values (independent of the main computer). Zone violated → protective stop. In real cells the zone is set so the robot stops BEFORE the fence (stopping distance included)."); }
        else msgS("Start the robot first (Motors ON + Start) to see the zone stop.");
        break;
      case "sls":
        if (SF.mode !== "T1") { msgS("This check is for T1 (manual reduced speed)."); break; }
        if (SF.st === "RUNNING") { stopNow("SLS: TCP speed > 250 mm/s in T1", 0); SF.st = "PROTECTIVE_STOP"; msgS("Safely limited speed violated → stop category 0 (STO + brakes). The main computer normally limits the speed itself – the safety controller is the independent second check."); }
        else msgS("Run in T1 first: enabling middle + Start.");
        break;
    }
    draw();
  }
  function drawStop() {
    if (!curves) return;
    const sC = curves.s, last = SF.last, cv = $("rcChS");
    const cm = css("--grid", "#ddd"), cc = [css("--critical", "#d03b3b"), css("--rb-c1", "#2a78d6"), css("--rb-c3", "#1baf7a")];
    const R2 = 180 / Math.PI;
    const catSel = last ? last.cat : 1, v0f = last ? Math.max(last.v0f, 0) : 1;
    const series = sC.c.map((c) => ({ x: c.pts.map((p) => p[0] * 1000), y: c.pts.map((p) => p[1] * R2 * (v0f || 1)), c: c.cat === catSel ? cc[c.cat] : cm, w: c.cat === catSel ? 2.4 : 1.2 }));
    series.sort((a, b) => (a.w > b.w ? 1 : -1));
    const tMax = Math.max(...sC.c.map((c) => c.tStop)) * 1000 + 40;
    chart(cv, { x: series[0].x, xr: [0, tMax], xu: " ms", yu: "°/s", series, yr: [0, null], marks: [{ x: CTL.brakeDelay * 1000, c: css("--muted", "#888"), n: "brake closes (cat 0)" }] });
    const c = sC.c[catSel], f = v0f || 1;
    const names = ["Category 0 – uncontrolled: STO at once, motor coasts until the brake closes, the brake stops the arm", "Category 1 – controlled ramp with max torque on the path, then STO + brakes (SS1)", "Category 2 – controlled ramp, power stays on, standstill monitored (SS2 → SOS)"];
    $("rcStl").innerHTML = `<p class="rc-msg"><b>${last ? esc(last.cause) : "Example: category 1 from full speed"}</b>${last && !last.v0f ? " – robot was not moving (curve shown for full speed)" : ""}<br>${names[catSel]}.<br>
      J1 of the ${esc(rb().ref)} from ${fx(sC.v0 * R2 * f, 0)}°/s: stop time <b>${fx(c.tStop * 1000, 0)} ms</b>, angle ${fx(c.dist * R2 * f * f, 1)}° = <b>${fx(c.distTcp * 1000 * f * f, 0)} mm</b> at the TCP (lever ${fx(curves.M.lever * 1000, 0)} mm).
      Ramp ${fx(sC.aRamp, 1)} rad/s² (servo, limited by the motor torque) · brake ${fx(sC.aBrake, 1)} rad/s² after ${CTL.brakeDelay * 1000} ms (estimates).</p>
      <div class="rc-tl rc-tl2">${(catSel === 0 ? [["STO, motor free", 0], ["brake closed (SBC)", CTL.brakeDelay * 1000], ["standstill", c.tStop * 1000]] : catSel === 1 ? [["ramp starts", 10], ["standstill → STO", c.tStop * 1000], ["brakes closed", c.tStop * 1000 + CTL.brakeDelay * 1000]] : [["ramp starts", 10], ["standstill, SOS monitored", c.tStop * 1000]]).map((e, i, a) => `<div class="rc-tle" style="left:${(e[1] / (a[a.length - 1][1] || 1) * 90).toFixed(1)}%"><i></i><span class="${i % 2 ? "rc-tld" : ""}">${fx(e[1], 0)} ms<br>${e[0]}</span></div>`).join("")}<div class="rc-tlbar"></div></div>`;
  }
  function draw() {
    const st = SF.st, cls = { MOTORS_OFF: "", MOTORS_ON: "rc-ok", RUNNING: "rc-ok", PROTECTIVE_STOP: "rc-warn", EMERGENCY_STOP: "rc-bad", SAFETY_FAULT: "rc-bad" }[st];
    const steps = ["MOTORS_OFF", "MOTORS_ON", "RUNNING"];
    $("rcSt").innerHTML = `<div class="rc-sm">${steps.map((s) => `<span class="rc-sn${s === st ? " on " + cls : ""}">${s.replace("_", " ")}</span>`).join('<span class="rc-sa">→</span>')}</div>
      <div class="rc-sm">${["PROTECTIVE_STOP", "EMERGENCY_STOP", "SAFETY_FAULT"].map((s) => `<span class="rc-sn rc-snb${s === st ? " on " + cls : ""}">${s.replace("_", " ")}</span>`).join("")}</div>
      <div class="small muted">Mode <b>${SF.mode}</b>${SF.mode === "T1" ? " · SLS 250 mm/s" : ""} · state <b>${st.replace("_", " ")}</b></div>`;
    const lamp = (n, a, b) => `<span class="rc-lamp"><b>${n}</b> A <i class="${a ? "ok" : "off"}"></i> B <i class="${b ? "ok" : "off"}"></i></span>`;
    $("rcInp").innerHTML = lamp("E-stop chain", !SF.estop, !SF.estop) + lamp("Gate switch", SF.gate, SF.gate || SF.stuck) + lamp("Enabling", SF.en === 1, SF.en === 1) +
      `<span class="small muted">lamp on = contact closed (OK) · both channels must agree</span>`;
    $("rcEs").textContent = SF.estop ? "E-STOP pressed – release" : "E-STOP"; $("rcEs").classList.toggle("on", SF.estop);
    $("rcGate").textContent = SF.gate ? "Open safety gate" : "Close safety gate";
    box.querySelectorAll("[data-rcen]").forEach((b) => b.classList.toggle("active", +b.dataset.rcen === SF.en));
    box.querySelectorAll("[data-rcmode]").forEach((b) => b.classList.toggle("active", b.dataset.rcmode === SF.mode));
    $("rcLog").innerHTML = `<tr><th class="num">t s</th><th>Event</th><th>Stop category</th><th>Safe functions</th><th>Result</th></tr>` + (SF.log.length ? SF.log.map((l) => `<tr><td class="num">${fx(l.t, 1)}</td><td>${esc(l.ev)}</td><td>${l.cat}</td><td>${esc(l.funcs)}</td><td class="muted">${esc(l.res)}</td></tr>`).join("") : `<tr><td colspan="5" class="muted">Press the buttons: e.g. AUTO → Motors ON → Start → Open safety gate.</td></tr>`);
    archLive();
  }
  $("rcEs").addEventListener("click", () => sev("estop"));
  $("rcRst").addEventListener("click", () => sev("reset"));
  $("rcGate").addEventListener("click", () => sev("gate"));
  $("rcMon").addEventListener("click", () => sev("mon"));
  $("rcStart").addEventListener("click", () => sev("start"));
  $("rcStop").addEventListener("click", () => sev("stop"));
  $("rcZone").addEventListener("click", () => sev("zone"));
  $("rcSls").addEventListener("click", () => sev("sls"));
  $("rcStuck").addEventListener("change", (e) => { SF.stuck = e.target.checked; draw(); });
  box.querySelectorAll("[data-rcen]").forEach((b) => b.addEventListener("click", () => sev("en", +b.dataset.rcen)));
  box.querySelectorAll("[data-rcmode]").forEach((b) => b.addEventListener("click", () => sev("mode", b.dataset.rcmode)));
  $("rcSfT").innerHTML = `<tr><th>Function</th><th>What it does</th><th>Standard</th><th>Typical use in a robot cell</th></tr>` + [
    ["Stop category 0", "Power removed at once (STO) + brakes; uncontrolled stop", "IEC 60204-1 §9.2.2", "e-stop (option), SLS / zone violation, faults"],
    ["Stop category 1", "Controlled stop with power, then power removed (SS1)", "IEC 60204-1", "e-stop (usual), gate opened in AUTO"],
    ["Stop category 2", "Controlled stop, power stays on (SS2 → SOS)", "IEC 60204-1", "program stop, light-curtain muting, short interruptions"],
    ["STO – safe torque off", "No torque-producing energy to the motor", "IEC 61800-5-2", "end of every cat 0/1 stop; work inside the cell"],
    ["SS1 / SS2 / SOS", "Safe stop 1 / 2, safe operating stop (standstill monitored)", "IEC 61800-5-2", "protective stops, operator loading at a station"],
    ["SLS – safely limited speed", "Speed monitored below a limit", "IEC 61800-5-2; ISO 10218-1 (T1 ≤ 250 mm/s)", "T1, reduced speed when a person is near (laser scanner)"],
    ["SBC – safe brake control + brake test", "Brake output safe; brakes tested cyclically", "IEC 61800-5-2; ISO 13849-1", "every stop with STO; automatic brake test e.g. every 24–48 h (example)"],
    ["Safe zones / axis limits", "Cartesian zones for tool + arm, safe joint ranges", "ISO 10218-1/-2 (e.g. ABB SafeMove, KUKA SafeOperation, FANUC DCS)", "smaller fence, protect the machine, keep the robot out of the operator side"],
    ["Enabling device", "3-position switch, middle = enable", "IEC 60204-1 §10.9, ISO 10218-1", "every manual movement (T1/T2)"],
    ["Performance level", "Required for robot safety functions: PL d, Category 3 (2 channels + diagnosis), or SIL 2", "ISO 13849-1, IEC 62061, ISO 10218-1", "e-stop, gate, enabling, SLS, zones (check the risk assessment)"],
    ["Collaborative operation", "Power + force limiting, speed + separation monitoring", "ISO/TS 15066 (in ISO 10218-2:2025)", "only with a risk assessment; force/pressure limits per body region"],
    ["Safety distance", "S = K·T + C (approach speed × stopping time + extra)", "ISO 13855", "position of light curtains / fences from the stopping time above"],
  ].map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");

  /* ---------------- safe zones (top view) */
  function drawZones() {
    const r = rb(), C = cellLayout(r), fn = C.fence, m = C.machine, k = C.k;
    const zone = { x0: fn.x0 + 150 * k, x1: m.load[0] + 250 * k, y0: fn.y0 + 150 * k, y1: fn.y1 - 150 * k };   // the tool may enter the machine through the door
    const W = 460, H = 300, xs = [fn.x0 - 200 * k, m.x1 + 200 * k], ys = [fn.y0 - 200 * k, fn.y1 + 200 * k];
    const s = Math.min(W / (xs[1] - xs[0]), H / (ys[1] - ys[0]));
    const X = (x) => (x - xs[0]) * s, Y = (y) => H - (y - ys[0]) * s;       // +Y up on screen? we draw +Y to the left: screen x = robot X, screen y = −Y
    const Yy = (y) => (ys[1] - y) * s;
    const rect = (a, cls, t) => `<rect class="${cls}" x="${X(a.x0)}" y="${Yy(a.y1)}" width="${(a.x1 - a.x0) * s}" height="${(a.y1 - a.y0) * s}"/>${t ? `<text class="rc-bl" x="${X(a.x0) + 4}" y="${Yy(a.y1) + 13}">${t}</text>` : ""}`;
    let tcp = null, st = "";
    if (window.rbSim && window.rbSim.S && window.rbSim.S.rb.id === r.id) { const p = fk(r, window.rbSim.S.q, window.rbSim.S.tool).p; tcp = p; }
    else tcp = fk(r, C.home, C.tool).p;
    const tz = C.toolLen * 0.6 + C.part.h / 2;                      // tool zone radius (sphere around the TCP, estimate)
    const inside = tcp[0] - tz > zone.x0 && tcp[0] + tz < zone.x1 && tcp[1] - tz > zone.y0 && tcp[1] + tz < zone.y1;
    const margin = Math.min(tcp[0] - tz - zone.x0, zone.x1 - tcp[0] - tz, tcp[1] - tz - zone.y0, zone.y1 - tcp[1] - tz);
    st = inside ? `<span class="rc-ok">tool zone inside the allowed zone</span> (closest distance ${fx(margin, 0)} mm)` : `<span class="rc-bad">tool zone outside → the safety controller stops the robot</span>`;
    $("rcZoneSvg").innerHTML = `<svg class="rc-svg rc-zone" viewBox="0 0 ${W} ${H}" role="img" aria-label="safe zone top view">
      ${rect({ x0: fn.x0, x1: fn.x1, y0: fn.y0, y1: fn.y1 }, "rc-fence", "fence")}
      ${rect({ x0: m.x0, x1: m.x1, y0: m.y0, y1: m.y1 }, "rc-mach", "machine")}
      ${rect({ x0: C.infeed.x0 - C.infeed.w / 2, x1: C.infeed.x0 + C.infeed.w / 2, y0: C.infeed.y0, y1: C.infeed.y1 }, "rc-conv", "")}
      ${rect({ x0: C.outfeed.x0 - C.outfeed.w / 2, x1: C.outfeed.x0 + C.outfeed.w / 2, y0: C.outfeed.y1, y1: C.outfeed.y0 }, "rc-conv", "")}
      ${rect(zone, "rc-szone", "")}
      <text class="rc-bl" x="${X(zone.x0) + 4}" y="${Yy(zone.y0) - 5}">allowed tool zone (safety controller)</text>
      <circle class="rc-base" cx="${X(0)}" cy="${Yy(0)}" r="${Math.max(6, r.base[0] / 2 * s)}"/>
      <circle class="${inside ? "rc-tz" : "rc-tz bad"}" cx="${X(tcp[0])}" cy="${Yy(tcp[1])}" r="${Math.max(4, tz * s)}"/>
      <circle class="rc-tcp" cx="${X(tcp[0])}" cy="${Yy(tcp[1])}" r="3"/>
      <text class="rc-bl" x="${X(tcp[0]) + 8}" y="${Yy(tcp[1]) - 6}">TCP ${fx(tcp[0], 0)} / ${fx(tcp[1], 0)}</text>
    </svg><p class="hint">${st}. The zone is drawn smaller than the fence by the stopping distance (example 150 mm × scale). Tool zone = sphere r = ${fx(tz, 0)} mm around the TCP (gripper + part, estimate). Live from item 1 when the same robot is selected.</p>`;
  }

  /* ---------------- brake test */
  let bt = null;
  function drawBrake() {
    const r = rb(), z = sizing(r), C = cellLayout(r), worn = $("rcBw").checked;
    const rows = z.map((s, i) => {
      const hold = 1.2 * s.tauLim * (worn && i === 1 ? 0.45 : 1);       // brake holding torque, joint side (estimate)
      const test = Math.max(0.9 * s.Hmax, 0.6 * s.tauLim);              // test torque the drive applies against the closed brake
      const done = bt && bt.i > i, run = bt && bt.i === i, ok = hold > test;
      const move = ok ? 0 : (test - hold) / (z[i].Imax + z[i].Jm * z[i].n * z[i].n) * 0.5 * 0.2 * 0.2 / D2R;  // slip over 200 ms (estimate)
      return `<tr class="${run ? "rb-sel" : ""}"><td>J${i + 1}</td><td class="num">${fx(test / (s.n * s.eta), 2)}</td><td class="num">${fx(hold / (s.n * s.eta), 2)}</td><td class="num">${done ? (ok ? "0.00" : fx(Math.min(move, 9.9), 2)) : run ? "…" : "—"}</td><td>${done ? (ok ? '<span class="rc-ok">PASS</span>' : '<span class="rc-bad">FAIL – brake slips</span>') : run ? "testing …" : "—"}</td></tr>`;
    }).join("");
    $("rcBtT").innerHTML = `<tr><th>Axis</th><th class="num">test torque N·m (motor)</th><th class="num">brake holds N·m (motor)</th><th class="num">movement °</th><th>Result</th></tr>${rows}`;
    $("rcBtN").innerHTML = `How it works: the robot stops at a safe position, the brake closes, the drive applies a test torque (here max(0.9 × max gravity torque, 0.6 × torque limit), estimate) against the brake and the safety controller checks that the motor does not move (e.g. &lt; 0.5° motor). The test runs automatically at an interval set in the safety configuration (e.g. every 24–48 h – example, check the manual). A failed test → warning, then the robot may only run at reduced speed / must be repaired. ${worn ? "<b>Worn brake on J2:</b> holding torque only 45 % → J2 fails." : ""}`;
  }
  $("rcBw").addEventListener("change", () => { bt = null; drawBrake(); });
  $("rcBt").addEventListener("click", () => {
    bt = { i: 0 }; drawBrake();
    const stepB = () => { if (!bt) return; bt.i++; drawBrake(); if (bt.i < 6) setTimeout(stepB, 450); };
    setTimeout(stepB, 450);
  });

  /* ---------------- I/O + handshake */
  const SIG = [
    ["diMachDone", "DI", "machine → robot", "part finished, machine in load position", "yes"],
    ["diMachRun", "DI", "machine → robot", "machine cycle running", "status"],
    ["doDoorOpen", "DO", "robot → machine", "command: open (1) / close (0) the door", "yes"],
    ["diDoorOpen", "DI", "machine → robot", "confirmation: door fully open (sensor)", "yes"],
    ["diDoorClosed", "DI", "machine → robot", "confirmation: door closed (sensor)", "yes"],
    ["doRobotClear", "DO", "robot → machine", "interlock: robot outside the machine (door may close, cycle may start)", "recommended"],
    ["doInHome", "DO", "robot → PLC", "robot in home position", "recommended"],
    ["doGripClose", "DO", "robot → valve", "gripper close (1) / open (0)", "yes"],
    ["diGripClosed", "DI", "gripper → robot", "confirmation: gripper closed + part present", "recommended"],
    ["diPartReady", "DI", "conveyor → robot", "raw part at the pick position (sensor)", "yes"],
    ["doCycleStart", "DO", "robot → machine", "pulse: start machining (only with door closed + robot clear)", "yes"],
  ];
  const SIG2 = [
    ["diGripOpen", "DI", "gripper → robot", "gripper fully open (end-position sensor)"], ["doPartTaken", "DO", "robot → conveyor PLC", "pulse: part taken, index the next part"],
    ["diOutfeedFree", "DI", "conveyor → robot", "place position free"], ["doProgRunning / doAutoOn / doMotorsOn", "DO", "robot → PLC", "status of the robot"],
    ["doError + goErrorNo", "DO / GO", "robot → PLC", "robot alarm + alarm number (group output)"], ["diStart / diStop / diResetError / giProgNo", "DI / GI", "PLC → robot", "remote commands in AUTO (only from the line PLC)"],
    ["siEstopLine / soEstopRobot", "safe in / out", "PLC ↔ robot (PROFIsafe / CIP Safety or hard-wired)", "e-stop of the line ↔ e-stop of the robot (both ways)"],
    ["siGateClosed (2 channels)", "safe in", "gate switch → robot", "protective stop in AUTO"], ["siMachDoorSafe / soRobotInZone", "safe in / out", "machine ↔ robot", "safe interlock: machine door may only move when the robot is out (safe zone)"],
  ];
  $("rcSig").innerHTML = `<tr><th>Signal</th><th>Type</th><th>Direction</th><th>Meaning</th><th>In the item-1 program</th></tr>` +
    SIG.map((s) => `<tr><td><code>${s[0]}</code></td><td>${s[1]}</td><td>${s[2]}</td><td>${esc(s[3])}</td><td>${s[4]}</td></tr>`).join("") +
    SIG2.map((s) => `<tr><td><code>${esc(s[0])}</code></td><td>${s[1]}</td><td>${esc(s[2])}</td><td>${esc(s[3])}</td><td class="muted">real cell</td></tr>`).join("");
  // demo sequence: [t, {signal: value}, text]
  const DEMO = [
    [0, { diMachDone: 0, diMachRun: 1, doDoorOpen: 0, diDoorOpen: 0, diDoorClosed: 1, doRobotClear: 1, doInHome: 1, doGripClose: 0, diGripClosed: 0, diPartReady: 1, doCycleStart: 0 }, "Start: machine is cutting, robot waits at home (holds a raw part in a double gripper cell – here: empty single gripper)."],
    [1.0, { diMachDone: 1, diMachRun: 0 }, "Machine finished: diMachDone = 1 (spindle stopped, axes in the load position)."],
    [1.2, { doDoorOpen: 1 }, "Robot (WaitDI diMachDone → OK) sends the COMMAND doDoorOpen = 1."],
    [1.3, { diDoorClosed: 0 }, "Door leaves the closed position: diDoorClosed = 0."],
    [2.8, { diDoorOpen: 1 }, "Door fully open: CONFIRMATION diDoorOpen = 1. The robot waits for this sensor – not for a fixed time."],
    [3.0, { doInHome: 0 }, "Robot leaves home (MoveJ pMachApp)."],
    [3.6, { doRobotClear: 0 }, "Robot enters the machine: doRobotClear = 0 → interlock: the machine must not close the door or start."],
    [4.2, { doGripClose: 1 }, "At the finished part: doGripClose = 1."],
    [4.6, { diGripClosed: 1 }, "Gripper closed + part present: diGripClosed = 1 (otherwise: alarm 'no part')."],
    [5.4, { doRobotClear: 1 }, "Robot out of the machine with the finished part: doRobotClear = 1."],
    [6.6, { doGripClose: 0 }, "Finished part on the outfeed: doGripClose = 0."],
    [6.9, { diGripClosed: 0 }, "Gripper open (confirmation)."],
    [7.8, { doGripClose: 1 }, "At the infeed: diPartReady = 1 → pick the raw part."],
    [8.2, { diGripClosed: 1 }, "Raw part gripped."],
    [8.5, { diPartReady: 0 }, "Part lifted: the pick sensor goes off; the conveyor brings the next part."],
    [9.4, { doRobotClear: 0 }, "Robot enters the machine with the raw part."],
    [10.0, { doGripClose: 0 }, "Part in the fixture – the fixture clamps (machine signal not shown), gripper opens."],
    [10.3, { diGripClosed: 0 }, "Gripper open."],
    [10.6, { doRobotClear: 1 }, "Robot out of the machine."],
    [10.7, { doDoorOpen: 0 }, "COMMAND close the door: doDoorOpen = 0 (allowed only with doRobotClear = 1)."],
    [10.8, { diDoorOpen: 0 }, "Door leaves the open position."],
    [11.0, { diPartReady: 1 }, "Next raw part has arrived at the pick position."],
    [12.3, { diDoorClosed: 1 }, "CONFIRMATION door closed: diDoorClosed = 1."],
    [12.4, { doCycleStart: 1 }, "Pulse doCycleStart (door closed AND robot clear → interlock OK)."],
    [12.5, { diMachRun: 1, diMachDone: 0 }, "Machine starts cutting: diMachRun = 1, diMachDone = 0."],
    [12.9, { doCycleStart: 0 }, "End of the start pulse (e.g. 500 ms)."],
    [13.6, { doInHome: 1 }, "Robot back home, waits for the next diMachDone. Cycle complete."],
  ];
  const IO = { t: 0, play: false, mode: "demo", hist: [], last: 0, fault: false, alarm: "", startPulse: 0 };
  if (Q.has("rcio")) IO.t = +Q.get("rcio") || 8;
  const ioNames = SIG.map((s) => s[0]);
  function demoState(t) {
    const v = {}; let txt = "", idx = 0;
    for (let i = 0; i < DEMO.length; i++) {
      const e = DEMO[i];
      if (e[0] > t + 1e-9) break;
      if (IO.fault && e[0] >= 2.8) {                         // door sensor broken: diDoorOpen never comes -> timeout 5 s after the command
        if (t >= 1.2 + 5) { txt = "TIMEOUT: diDoorOpen did not come within 5 s after doDoorOpen (WaitDI ... \\MaxTime:=5). The robot does NOT move into the machine – alarm to the operator / PLC: 'door not open'."; IO.alarm = txt; }
        else txt = "Robot waits for diDoorOpen … (timeout 5 s, " + fx(1.2 + 5 - t, 1) + " s left)";
        idx = i; break;
      }
      Object.assign(v, e[1]); txt = e[2]; idx = i;
    }
    return { v, txt, idx };
  }
  function demoChanges() {                                  // [t, signal, value] list for the chart
    const ev = [];
    for (const e of DEMO) { if (IO.fault && e[0] >= 2.8) break; for (const k in e[1]) ev.push([e[0], k, e[1][k]]); }
    return ev;
  }
  function liveSample() {                                    // follow the item-1 cell (read only)
    const s = window.rbSim; if (!s || !s.S || !s.run) return null;
    const S1 = s.S, C = S1.C, M1 = s.mach, p = fk(S1.rb, S1.q, S1.tool).p;
    const inHome = S1.q.every((v, i) => Math.abs(v - C.home[i]) < 1);
    // robot "in the machine" = TCP beyond the half-way point between the door plane (or home TCP, if further) and the load point (approximation)
    const xh = Math.max(C.machine.x0, fk(S1.rb, C.home, S1.tool).p[0]), xIn = xh + 0.5 * (C.machine.load[0] - xh);
    if (M1.state === "run" && IO.prevRun === false) IO.startPulse = s.simT || performance.now() / 1000;
    IO.prevRun = M1.state === "run";
    return {
      diMachDone: s.di("diMachDone") ? 1 : 0, diMachRun: M1.state === "run" ? 1 : 0, doDoorOpen: M1.doorCmd ? 1 : 0, diDoorOpen: s.di("diDoorOpen") ? 1 : 0,
      diDoorClosed: s.di("diDoorClosed") ? 1 : 0, doRobotClear: p[0] < xIn ? 1 : 0, doInHome: inHome ? 1 : 0,
      doGripClose: (s.gripAct ? s.gripAct.to : S1.grip > 0.5) ? 1 : 0, diGripClosed: S1.grip >= 0.999 && S1.parts.some((q) => q.held) ? 1 : 0,
      diPartReady: s.di("diPartReady") ? 1 : 0, doCycleStart: M1.state === "run" && M1.tLeft > SIM.machTime - 0.5 ? 1 : 0,
    };
  }
  function drawIO() {
    const live = IO.mode === "live";
    const rows = ioNames, cv = $("rcChIO");
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 800, H = +cv.getAttribute("height");
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    cv.style.height = H + "px";
    const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const ml = 110, mr = 10, mt = 6, mb = 20, rh = (H - mt - mb) / rows.length, pw = W - ml - mr;
    const cT = css("--text-2", "#555"), cG = css("--grid", "#ddd"), cDO = css("--rb-c2", "#eb6834"), cDI = css("--rb-c1", "#2a78d6");
    let t0, t1, val;
    if (live) {
      t1 = IO.hist.length ? IO.hist[IO.hist.length - 1].t : 0; t0 = t1 - 40;
      val = (k, t) => { let v = 0; for (const h of IO.hist) { if (h.t > t) break; v = h.v[k]; } return v; };
    } else {
      t0 = 0; t1 = 14.5;
      const ch = demoChanges();
      val = (k, t) => { let v = DEMO[0][1][k] || 0; for (const c of ch) { if (c[0] > t) break; if (c[1] === k) v = c[2]; } return v; };
    }
    const X = (t) => ml + (t - t0) / (t1 - t0) * pw;
    g.font = "11.5px system-ui, sans-serif"; g.textBaseline = "middle";
    rows.forEach((k, r) => {
      const y0 = mt + r * rh, yH = y0 + rh * 0.22, yL = y0 + rh * 0.78, isDO = k.startsWith("do");
      g.fillStyle = cT; g.textAlign = "right"; g.fillText(k, ml - 6, y0 + rh / 2);
      g.strokeStyle = cG; g.lineWidth = 1; g.beginPath(); g.moveTo(ml, y0 + rh); g.lineTo(ml + pw, y0 + rh); g.stroke();
      const N = Math.max(2, Math.round(pw));
      const trace = (tEnd, alpha) => {
        g.strokeStyle = isDO ? cDO : cDI; g.lineWidth = 2; g.globalAlpha = alpha; g.beginPath();
        let prev = null; const n = Math.max(2, Math.round(N * (tEnd - t0) / (t1 - t0)));
        for (let i = 0; i <= n; i++) {
          const t = t0 + (tEnd - t0) * i / n;
          const v = val(k, t), y = v ? yH : yL, x = X(t);
          if (prev === null) g.moveTo(x, y); else if (v !== prev) { g.lineTo(x, prev ? yH : yL); g.lineTo(x, y); } else g.lineTo(x, y);
          prev = v;
        }
        g.stroke(); g.globalAlpha = 1;
      };
      const tEnd = live ? t1 : Math.min(t1, IO.t);
      if (!live) trace(IO.fault ? Math.min(t1, 6.2) : t1, 0.22);
      if (tEnd > t0) trace(tEnd, 1);
      if (!live) { g.fillStyle = isDO ? cDO : cDI; g.globalAlpha = 0.08; for (let i = 0; i < N; i++) { const t = t0 + (tEnd - t0) * i / N; if (val(k, t)) g.fillRect(X(t), yH, pw / N + 0.5, yL - yH); } g.globalAlpha = 1; }
    });
    g.fillStyle = cT; g.textAlign = "center"; g.textBaseline = "top";
    for (let t = Math.ceil(t0); t <= t1; t += live ? 5 : 1) g.fillText((live ? fx(t - t1, 0) : t) + " s", X(t), H - mb + 4);
    if (!live) { g.strokeStyle = css("--text", "#000"); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(X(IO.t), mt); g.lineTo(X(IO.t), H - mb); g.stroke(); g.globalAlpha = 1; }
    if (!live && IO.fault && IO.t >= 6.2) { g.fillStyle = css("--critical", "#d03b3b"); g.globalAlpha = 0.15; g.fillRect(X(6.2), mt, X(14.5) - X(6.2), H - mt - mb); g.globalAlpha = 1; }
    let txt;
    if (live) { const s = window.rbSim, ins = s.prog[s.run.pc]; txt = `<b>LIVE – follows the item-1 program</b> (line ${s.run.pc + 1}: <code>${esc(ins ? (ins.op === "WaitDI" ? "WaitDI " + ins.sig + ", 1;" : ins.op + " " + (ins.pt || ins.sig || "")) : "")}</code> – ${esc(ins ? ins.c : "")}). Orange = robot outputs (DO), blue = inputs (DI). Last 40 s.`; }
    else { const d = demoState(IO.t); txt = `<b>t = ${fx(IO.t, 1)} s:</b> ${esc(d.txt)}`; if (IO.fault && IO.t >= 6.2) txt = `<span class="rc-bad"><b>t = ${fx(IO.t, 1)} s:</b> ${esc(d.txt)}</span>`; }
    $("rcIoTxt").innerHTML = txt;
    $("rcIoMode").textContent = live ? "LIVE (item 1 runs)" : "DEMO sequence"; $("rcIoMode").className = "rc-chip " + (live ? "rc-ok" : "");
    $("rcIoPlay").textContent = IO.play ? "❚❚ pause" : "▶ play";
    ["rcIoPrev", "rcIoNext", "rcIoPlay", "rcIoRst", "rcIoFault"].forEach((id) => { $(id).disabled = live; });
  }
  const evTimes = () => DEMO.map((e) => e[0]);
  $("rcIoPlay").addEventListener("click", () => { IO.play = !IO.play; if (IO.t >= 14.4) IO.t = 0; drawIO(); });
  $("rcIoRst").addEventListener("click", () => { IO.t = 0; IO.play = false; drawIO(); });
  $("rcIoNext").addEventListener("click", () => { IO.play = false; const n = evTimes().find((t) => t > IO.t + 1e-6); IO.t = n === undefined ? 14.5 : n; if (IO.fault && IO.t > 2.8) IO.t = Math.max(IO.t, 6.2); drawIO(); });
  $("rcIoPrev").addEventListener("click", () => { IO.play = false; const p = evTimes().filter((t) => t < IO.t - 1e-6); IO.t = p.length ? p[p.length - 1] : 0; drawIO(); });
  $("rcIoFault").addEventListener("change", (e) => { IO.fault = e.target.checked; IO.t = 0; drawIO(); });
  $("rcIoNote").innerHTML = `
    <p><b>Why command AND confirmation?</b> A command (doDoorOpen) only says what the robot wants. Only the sensor (diDoorOpen) says what really happened. If the robot used a fixed wait time, a slow or blocked door would be hit. With a confirmation + a <b>timeout</b> (WaitDI … \\MaxTime) a fault becomes a clear alarm ("door not open") instead of a crash. <b>Interlocks</b> (doRobotClear, door closed) are checked by BOTH sides: the machine never closes the door or starts while the robot is inside, the robot never enters while the door is not open. Safety-relevant interlocks go over safe I/O (PROFIsafe / CIP Safety) or SafeMove-like zones, not only normal I/O.</p>
    <p><b>Fieldbus timing:</b> PROFINET RT cycle e.g. 2–4 ms + PLC cycle 5–10 ms + robot I/O scan → a signal needs ≈ 10–30 ms from one side to the other (example). For a robot moving 1 m/s that is 10–30 mm – this is why the robot waits at an exact point (fine) for critical signals.</p>
    <p><b>OPC UA (Robotics companion specification, OPC 40010):</b> a standard information model of the robot (motion devices, axes, controllers, safety states, operation mode, power-on time, load) for the MES and the digital twin – read-only monitoring every 0.1–1 s, not for the real-time handshake. Many controllers offer it as an option (check). This twin shows the same values (mode, state, axes, cycle) from simulation.</p>`;

  /* ---------------- programming + operation */
  $("rcProg").innerHTML = `
    <div class="rb-grid2">
      <div>
        <h3>Example program (RAPID-like syntax – KUKA KRL, FANUC TP use other words, same ideas)</h3>
        <pre class="rc-code">MODULE MainModule                     <span>! module = one file: data + routines</span>
  <span>! ---- data: taught or calculated once ----</span>
  PERS tooldata tGripper := [TRUE, [[0,0,180],[1,0,0,0]],
                [3,[0,0,90],[1,0,0,0],0,0,0]];  <span>! TCP 180 mm, gripper 3 kg, COG 90 mm</span>
  PERS loaddata lPart := [10,[0,0,80],[1,0,0,0],0,0,0.05]; <span>! part 10 kg</span>
  PERS wobjdata wMachine := [FALSE,TRUE,"",[[1200,0,650],[1,0,0,0]],[[0,0,0],[1,0,0,0]]];
  CONST robtarget pMachLoad := [[0,0,0],[0.707,0,0.707,0],[0,0,0,0],[9E9,9E9,9E9,9E9,9E9,9E9]];
  CONST speeddata vFast := [1000,500,5000,1000]; <span>! TCP mm/s, orientation °/s</span>

  PROC main()                         <span>! main routine</span>
    rInit;                            <span>! home check, gripper open, signals reset</span>
    WHILE TRUE DO
      rUnloadMachine;
      rLoadMachine;
    ENDWHILE
  ENDPROC

  PROC rUnloadMachine()
    WaitDI diMachDone, 1 \\MaxTime:=120;
    SetDO doDoorOpen, 1;
    WaitDI diDoorOpen, 1 \\MaxTime:=5;  <span>! confirmation + timeout</span>
    MoveJ pMachApp, vFast, z50, tGripper \\WObj:=wMachine;
    MoveL pMachLoad, v300, fine, tGripper \\WObj:=wMachine;
    SetDO doGripClose, 1;
    WaitDI diGripClosed, 1 \\MaxTime:=2;
    GripLoad lPart;                   <span>! tell the dynamic model the new load!</span>
    MoveL pMachApp, v500, z20, tGripper \\WObj:=wMachine;
  ERROR
    IF ERRNO = ERR_WAIT_MAXTIME THEN
      ErrWrite "Door / gripper timeout", "check sensor";
      Stop;                           <span>! operator fixes it, then RETRY</span>
      RETRY;
    ENDIF
  ENDPROC
ENDMODULE</pre>
      </div>
      <div>
        <h3>Program structure</h3>
        <div class="table-wrap"><table class="rb-tbl rc-wrapt"><tr><th>Part</th><th>What it is</th><th>Why it matters</th></tr>
          <tr><td>Module</td><td>A file with data and routines (main module + library modules)</td><td>Re-use (gripper routines, error handling)</td></tr>
          <tr><td>Routine (PROC)</td><td>A sub-program: main, rUnload, rLoad …</td><td>Short, readable program; restart from a routine</td></tr>
          <tr><td>Tool data</td><td>TCP position + orientation, mass, centre of gravity, inertia of the gripper</td><td>Wrong TCP → wrong path; wrong mass → bad dynamics, false collision alarms (card 4)</td></tr>
          <tr><td>Work object</td><td>Coordinate frame of the fixture / machine</td><td>Move the fixture → measure 3 points, all positions follow</td></tr>
          <tr><td>Load data</td><td>Payload (part) mass + centre of gravity; set with GripLoad when gripping</td><td>Dynamic model, torque feedforward, collision detection</td></tr>
          <tr><td>Speed data</td><td>TCP speed (mm/s), orientation speed (°/s): v300, v1000 …</td><td>Cycle time vs. accuracy; T1 limits to 250 mm/s anyway</td></tr>
          <tr><td>Zone data</td><td>Corner blending: fine = exact stop, z10, z50 = start turning 10 / 50 mm before</td><td>Cycle time (no stop); use fine at grip / place points</td></tr>
          <tr><td>Signals</td><td>Names of DI/DO in the I/O configuration</td><td>Same names on PLC and robot side → easy debugging</td></tr>
        </table></div>
        <h3>Operating modes</h3>
        <div class="table-wrap"><table class="rb-tbl rc-wrapt"><tr><th>Mode</th><th>Speed</th><th>Who / how</th></tr>
          <tr><td>T1 manual reduced</td><td>TCP ≤ 250 mm/s (SLS)</td><td>teaching, testing; enabling device held; person may be inside the cell</td></tr>
          <tr><td>T2 manual full speed</td><td>programmed speed</td><td>program test only; enabling device; only if allowed by the risk assessment</td></tr>
          <tr><td>AUTO</td><td>programmed speed</td><td>production; gates closed, nobody inside; start from the pendant or the line PLC</td></tr>
        </table></div>
      </div>
    </div>
    <div class="rb-grid2">
      <div>
        <h3>Restart after an error (typical steps)</h3>
        <ol class="rc-ol">
          <li>Read the alarm text + number on the pendant (event log). Fix the cause (sensor, part, door).</li>
          <li>Acknowledge the alarm; reset the safety stop (Reset, Motors ON).</li>
          <li>The <b>program pointer (PP)</b> stays at the line where it stopped. Check where the robot is.</li>
          <li>If the robot was moved by hand or stopped off the path: the controller first returns to the path ("regain path", slow, ask to confirm) – watch for collisions.</li>
          <li>If the part state is unclear (part in gripper? in machine?): use a recovery routine (PP to routine "rRecover"), never just "PP to main" with a part in the gripper.</li>
          <li>Start in T1 first if unsure, then AUTO.</li>
        </ol>
        <h3>Backup</h3>
        <p class="small">A backup = all programs + system parameters (I/O configuration, tool/load data, safety configuration checksum, calibration data, revolution-counter offsets). Make one after every change and automatically e.g. weekly to a server (FTP / network share). Keep the safety configuration report with its checksum signed in the cell documentation.</p>
      </div>
      <div>
        <h3>Maintenance from the controller (example intervals – follow the supplier manual)</h3>
        <div class="table-wrap"><table class="rb-tbl rc-wrapt"><tr><th>Item</th><th>Interval (example)</th><th>What / why</th></tr>
          <tr><td>Cabinet fans + filter</td><td>6–12 months (dusty: 3)</td><td>Clean / replace → no over-temperature</td></tr>
          <tr><td>SMB battery</td><td>2–3 years or at the low-battery warning</td><td>Keeps the revolution counters; empty → re-calibration</td></tr>
          <tr><td>Brake test</td><td>automatic e.g. every 24–48 h + at each service</td><td>Brake holds the arm with power off (card 5)</td></tr>
          <tr><td>Gear oil / grease</td><td>check yearly; change e.g. 20 000 h or 3–5 years (duty dependent)</td><td>Reducer life (RV / harmonic)</td></tr>
          <tr><td>Cable harness + dress pack</td><td>visual every 6 months</td><td>Wear at bending points → encoder / power faults</td></tr>
          <tr><td>Balancing device</td><td>inspect yearly</td><td>Spring / bearings; never open without the tool</td></tr>
          <tr><td>E-stop + enabling + gate test</td><td>monthly or per risk assessment</td><td>Proves the safety chain works (both channels)</td></tr>
          <tr><td>Mechanical stops, bolts</td><td>yearly</td><td>Bent stop pin = there was a collision</td></tr>
          <tr><td>TCP / calibration check</td><td>after any crash, motor or gear change</td><td>Accuracy; update revolution counters</td></tr>
          <tr><td>Backup</td><td>after every change + weekly</td><td>Fast recovery</td></tr>
        </table></div>
        <p class="hint">The controller counts operating hours, motor-on time, gear load (duty) and can show a service plan (e.g. ABB "Service Information System" – example). Use it to plan service, not to wait for failures.</p>
      </div>
    </div>`;

  /* ---------------- animation / live loop */
  function frame(ts) {
    raf = 0;
    if (!visible || !pane.classList.contains("active")) { lastTs = 0; return; }      // paused while hidden
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
    if (R && S.replay) {
      const tNow = R.out.t[S.cur] + dt * 0.5;                                         // replay at half speed
      let i = S.cur; while (i < R.out.t.length - 1 && R.out.t[i] < tNow) i++;
      S.cur = i >= R.out.t.length - 1 ? 0 : i;
    }
    // I/O: live when the item-1 program runs, else the demo
    const s1 = window.rbSim, live = !!(s1 && s1.run && s1.run.on);
    if (live !== (IO.mode === "live")) { IO.mode = live ? "live" : "demo"; IO.hist = []; }
    if (live) { const tt = (s1.simT !== undefined ? s1.simT : ts / 1000); const v = liveSample(); if (v && (!IO.hist.length || tt - IO.hist[IO.hist.length - 1].t >= 0.1)) { IO.hist.push({ t: tt, v }); if (IO.hist.length > 600) IO.hist.shift(); } }
    else if (IO.play) { IO.t += dt; const lim = IO.fault ? 7.5 : 14.5; if (IO.t >= lim) { IO.t = lim; IO.play = false; } }
    if (ts - slowT > 120) { slowT = ts; if (S.replay) drawServo(); archLive(); drawIO(); }
    if (ts - (frame.zt || 0) > 500) { frame.zt = ts; drawZones(); }
    raf = requestAnimationFrame(frame);
  }
  function show() {
    if (!raf) { lastTs = 0; raf = requestAnimationFrame(frame); }
    setTimeout(() => { drawServo(); drawColl(); drawStop(); drawIO(); }, 30);
  }

  /* ---------------- start */
  setRobot(S.rbId); built2 = true;
  S.coll.thr = C4.thr;
  showBlk(BLK[S.blk] ? S.blk : "main");
  draw(); drawIO();
  // demo states from the URL (screenshots / tests)
  const sd = Q.get("rcsafe");
  if (sd) {
    (() => {
      if (sd === "estop") { sev("mode", "AUTO"); sev("mon"); sev("start"); sev("estop"); }
      if (sd === "gate") { sev("mode", "AUTO"); sev("mon"); sev("start"); sev("gate"); }
      if (sd === "t1") { sev("mode", "T1"); sev("en", 1); sev("start"); sev("sls"); }
      if (sd === "fault") { SF.stuck = true; $("rcStuck").checked = true; sev("mode", "AUTO"); sev("mon"); sev("start"); sev("gate"); }
    })();
  }
  if (Q.get("rcblk")) setTimeout(() => { const el = $("rcC1"); if (el) el.scrollIntoView(); }, 300);
  return { show, state: () => ({ S, M, R, RC, SF, IO }) };
}

/* deep link: &rbitem=2 opens item 2 at load (after all definitions above) */
if (Q.get("rbitem") && Q.get("rbitem") !== "1") showItem(Q.get("rbitem"));
if (Q.has("rcback")) { const d = +Q.get("rcback") || 0; if (d) setTimeout(() => showItem("1"), d); else showItem("1"); }          // test: build item 2, then switch back to item 1 (3D + charts must still work)
