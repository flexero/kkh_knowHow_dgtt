/* FMS engineering – item 7, sections 7H–7N (loaded by fmse7.js at the end of item 7).
 * 7H safety zones cause & effect matrix (EX7.safety.zones, exact rule of EX7._formulas.safety_zones) + cell plan
 * 7I safe drive functions (IEC 61800-5-2) and stop categories 0/1/2 (IEC 60204-1) with speed–time sketches
 * 7J typical circuit patterns (simplified schematics)   7K standards map   7L commissioning tests (checklist)
 * 7M three cases with key numbers   7N checklists.
 * Offline; ticks / toggles in localStorage keys "fmse.7.x.*". Pure calculations come from fmse7.js. */
import { EX7 } from "./fmse7_data.js";
import { $, esc, fx, clone, store, card, tab, kv, kpis, intro, useCase, evalZones, evalOut, evalSF, ccfScore, distance, calcCable, calcCab, calcDC, calcLoad, calcMotor } from "./fmse7.js";

const Z = EX7.safety.zones;
const X = { zon: store.get("x.zon", []), latch: false, tests: store.get("x.tests", {}), chk: store.get("x.chk", {}) };
const R7x = {};

export function mount(el) {
  el.innerHTML = [html7H(), html7I(), html7J(), html7K(), html7L(), html7M(), html7N()].join("");
  [init7H, init7I, init7L, init7N].forEach((f) => { try { f(); } catch (e) { console.error("fmse7x " + f.name, e); R7x.errors = (R7x.errors || []).concat(f.name + ": " + e.message); } });
  if (window.fe7) window.fe7.R7x = R7x;
}

/* ================================================================== 7H safety zones cause & effect */
const ACOL = { RUN: "f7-aRUN", SLS: "f7-aSLS", SS1: "f7-aSS1", STO: "f7-aSTO", "-": "" };
const INLBL = { ESTOP_CELL: "E-stop of the cell pressed", LS01_LC: "Light curtain LS01 interrupted", POOL_DOOR_OPEN: "Pallet-pool door open", ENABLE_OK: "Maintenance mode + enabling device held", AGV_DOCK_FIELD: "Scanner field at the AGV dock occupied" };
function html7H() {
  return card("f77H", "7H · Safety zones – cause & effect matrix", "which input stops which output, and how · production keeps running where it is safe",
    intro(`<p>An FMS is split into <b>safety zones</b>. Opening the pallet-pool door must not stop the machines that keep cutting behind their own
      doors – only the stacker and the pallet changers next to the pool. The safety PLC holds a <b>cause & effect matrix</b>: each row is a condition
      (inputs), each column an output (drive, valve group, machine coupling) with the stop it gets.</p>
      <p class="phd-eq">row fires if all "all_of" inputs are true AND all "none_of" inputs are false · output = strongest action of all fired rows: RUN &lt; SLS &lt; SS1 &lt; STO · KPI = outputs still RUN</p>
      <p class="sub">${esc(Z._inputs)} · "latched" rows (e-stop) stay active after the input clears until the reset button is pressed.</p>`) +
    `<div class="grid2">
      <div><h3 class="fe-h3">Inputs (click to toggle)</h3><div id="f7HIn" class="f7-tog"></div>
        <div class="fe-row"><label>Scenario <select id="f7HSc" class="fe-sel f7-selw"><option value="">– choose –</option>${Z.scenarios.map(([n], i) => `<option value="${i}">${esc(n)}</option>`).join("")}</select></label>
          <button class="mx-el" id="f7HRst">Reset (acknowledge)</button></div>
        </div>
      <div><div id="f7HKpi"></div></div>
    </div>
    <h3 class="fe-h3">Cell plan – zones and output states</h3>
    <div class="fe-scroll"><svg id="f7HPlan" class="fe-chart f7-plan" viewBox="0 0 640 330" role="img" aria-label="Cell plan with safety zones"></svg></div>
    <div class="sub f7-lgd">${["RUN", "SLS", "SS1", "STO"].map((a) => `<span><i class="f7-sw ${ACOL[a]}"></i>${a}</span>`).join("")}</div>
    <div id="f7HMat"></div>
    <h3 class="fe-h3">All example scenarios</h3>
    ${tab(["Scenario", "Inputs", "Rows fired", "Outputs still RUN"], Z.scenarios.map(([n, a]) => { const r = evalZones(Z, a); return `<tr><td>${esc(n)}</td><td>${a.join(", ") || "–"}</td><td>${r.fired.join(", ") || "–"}</td><td><b>${r.run}</b> / ${Z.outputs.length}</td></tr>`; }), "f7-small")}` +
    useCase(`during maintenance in the pallet pool (door open, enabling device held) the stacker may move at safely-limited speed and the three
      machines keep machining – 6 of 12 outputs stay in RUN. Without zones the whole cell would stop every time somebody enters the pool. The
      matrix is part of the FDS, is programmed in the safety PLC and is tested row by row at validation (7L).`));
}
function init7H() {
  const draw = () => {
    const fired = Z.rows.filter((r) => r.all_of.every((i) => X.zon.includes(i)) && r.none_of.every((i) => !X.zon.includes(i))).map((r) => r.id);
    if (fired.includes("Z1")) X.latch = true;
    const eff = X.latch && !fired.includes("Z1") ? fired.concat("Z1") : fired;
    const r = evalOut(Z, eff);
    $("f7HIn").innerHTML = Z.inputs.map((i) => `<button class="mx-el${X.zon.includes(i) ? " active" : ""}" data-in="${i}" title="${esc(INLBL[i] || i)}">${i}</button>`).join("") +
      `<p class="sub">${Z.inputs.map((i) => `<b>${i}</b>: ${esc(INLBL[i] || "")}`).join(" · ")}</p>`;
    $("f7HKpi").innerHTML = kpis([["outputs still RUN", `${r.run} / ${Z.outputs.length}`, r.run === Z.outputs.length ? "fe-ok" : r.run <= 2 ? "fe-no" : ""], ["rows fired", eff.join(", ") || "–"]]) +
      (X.latch && !fired.includes("Z1") ? `<p class="fe-no">Z1 (e-stop) is latched – release is not enough, press Reset.</p>` : "");
    $("f7HMat").innerHTML = tab(["Row", "Condition", ...Z.outputs], Z.rows.map((row) => `<tr class="${eff.includes(row.id) ? "f7-fired" : "f7-dim"}"><td><b>${row.id}</b>${row.latched ? ' <span class="sub">(latched)</span>' : ""}</td>
        <td>${row.all_of.join(" AND ")}${row.none_of.length ? " AND NOT " + row.none_of.join(", ") : ""}</td>${Z.outputs.map((o) => { const a = row.act[o] || "-"; return `<td class="${ACOL[a]}">${a}</td>`; }).join("")}</tr>`)
      .concat(`<tr class="f7-resrow"><td><b>Result</b></td><td>strongest action</td>${Z.outputs.map((o) => `<td class="${ACOL[r.out[o]]}"><b>${r.out[o]}</b></td>`).join("")}</tr>`), "f7-small f7-mat");
    drawPlan(r.out);
  };
  $("f7HIn").addEventListener("click", (e) => { const b = e.target.closest("[data-in]"); if (!b) return; const i = b.dataset.in; X.zon = X.zon.includes(i) ? X.zon.filter((x) => x !== i) : X.zon.concat(i); store.set("x.zon", X.zon); $("f7HSc").value = ""; draw(); });
  $("f7HSc").addEventListener("change", () => { const v = $("f7HSc").value; if (v === "") return; X.zon = clone(Z.scenarios[+v][1]); X.latch = false; store.set("x.zon", X.zon); draw(); });
  $("f7HRst").addEventListener("click", () => { if (!X.zon.includes("ESTOP_CELL")) X.latch = false; draw(); });
  draw();
}
function drawPlan(out) {
  const box = (x, y, w, h, o, lbl) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" class="f7-mod ${ACOL[out[o]] || ""}"/><text x="${x + w / 2}" y="${y + h / 2 - 2}" text-anchor="middle" class="f7-sm">${lbl || o}</text><text x="${x + w / 2}" y="${y + h / 2 + 11}" text-anchor="middle" class="f7-sm"><tspan font-weight="600">${out[o]}</tspan></text>`;
  const on = (i) => X.zon.includes(i);
  let s = `<rect x="150" y="100" width="330" height="120" rx="6" class="f7-zone${on("POOL_DOOR_OPEN") ? " f7-zon" : ""}"/><text x="156" y="114" class="f7-sm">zone pallet pool (fence)</text>
    <rect x="300" y="214" width="40" height="12" class="f7-door${on("POOL_DOOR_OPEN") ? " f7-zon" : ""}"/><text x="346" y="240" class="f7-sm">door ${on("POOL_DOOR_OPEN") ? "OPEN" : "closed"}${on("ENABLE_OK") ? " · enabling ✓" : ""}</text>`;
  [0, 1, 2].forEach((i) => { const x = 170 + i * 105; s += box(x, 14, 90, 40, "MC0" + (i + 1)) + box(x, 60, 90, 34, "APC0" + (i + 1)); });
  s += `<line x1="165" y1="196" x2="465" y2="196" class="f7-rail"/><text x="440" y="210" class="f7-sm">rail</text>` + box(180, 136, 80, 46, "POOL_TRAVEL", "TRAVEL") + box(268, 136, 80, 46, "POOL_HOIST", "HOIST") + box(356, 136, 80, 46, "POOL_FORK", "FORK");
  s += `<rect x="20" y="240" width="170" height="80" rx="6" class="f7-zone${on("LS01_LC") ? " f7-zon" : ""}"/><text x="26" y="254" class="f7-sm">zone load station (light curtain)</text>
    <line x1="20" y1="320" x2="190" y2="320" class="f7-lc${on("LS01_LC") ? " f7-zon" : ""}"/>` + box(30, 262, 72, 46, "LS01_ROT", "ROT") + box(110, 262, 72, 46, "LS01_CLAMP", "CLAMP");
  s += `<path d="M490 240 L620 240 L620 320 L490 320 Z" class="f7-zone${on("AGV_DOCK_FIELD") ? " f7-zon" : ""}"/><text x="496" y="254" class="f7-sm">scanner field AGV dock</text>` + box(510, 262, 100, 46, "AGV_TRANSFER", "AGV TRANSFER");
  s += `<text x="20" y="20" class="f7-sm">${on("ESTOP_CELL") || X.latch ? '<tspan class="f7-red">E-STOP active</tspan>' : "e-stop: released"}</text><text x="20" y="36" class="f7-sm">machines MC: hard-wired</text><text x="20" y="50" class="f7-sm">safety coupling (7J)</text>`;
  $("f7HPlan").innerHTML = s;
}

/* ================================================================== 7I safe drive functions & stop categories */
const DRV = [
  ["STO", "Safe torque off", "Energy to the motor is cut safely (pulses blocked); the motor coasts. = stop category 0.", "Basis of every safe stop; door open on a conveyor, light curtain on a small axis."],
  ["SS1", "Safe stop 1", "Drive brakes under control (monitored ramp or time), then STO. = stop category 1.", "E-stop of stacker crane, robot, spindle – fast stop without coasting."],
  ["SS2", "Safe stop 2", "Drive brakes under control, then SOS – torque stays, position is held. = stop category 2.", "Vertical axis or hoist that must hold the load; fast restart after an intervention."],
  ["SOS", "Safe operating stop", "Standstill is monitored while the drive keeps control (torque on); leaving the window → STO/SS1.", "Operator loads a part while a servo axis holds its position."],
  ["SLS", "Safely-limited speed", "Speed is monitored below a limit (e.g. 250 mm/s in set-up); exceeded → SS1 / STO.", "Maintenance mode in the pallet pool with enabling device; set-up of a robot (T1)."],
  ["SBC", "Safe brake control", "The holding brake is switched by a safe output (two channels) together with STO.", "Hoist of the stacker crane, vertical axes – prevents the load falling after STO."],
];
const STOPCAT = [
  ["0", "Uncontrolled stop: power removed immediately (STO, contactor drops out). The machine coasts to standstill.", "Simple, very reliable; long run-down for big inertia → only where coasting is safe and short."],
  ["1", "Controlled stop with power available to brake, then power removed (SS1).", "Most common for e-stop in an FMS – fast and safe; needs a drive that brakes (with a time monitoring as back-up)."],
  ["2", "Controlled stop, power stays on at standstill (SS2 → SOS).", "Not allowed for e-stop (IEC 60204-1 / ISO 13850 allow cat 0 or 1 only); used for operational / protective stops with quick restart."],
];
function sketch(kind) {   // speed–time sketch 220 x 120
  const W = 220, H = 120, l = 26, b = 22, t = 12, x = (f) => l + f * (W - l - 10), y = (f) => H - b - f * (H - t - b);
  const ts = 0.3;   // stop request at 30 %
  let path = "", extra = "";
  const lim = 0.35;
  switch (kind) {
    case "STO": case "0": path = `M${x(0)} ${y(0.8)}L${x(ts)} ${y(0.8)}Q${x(0.55)} ${y(0.75)} ${x(0.95)} ${y(0)}`; extra = `<text x="${x(0.55)}" y="${y(0.85)}" class="f7-sm">coasting</text>`; break;
    case "SS1": case "1": path = `M${x(0)} ${y(0.8)}L${x(ts)} ${y(0.8)}L${x(0.55)} ${y(0)}L${x(1)} ${y(0)}`; extra = `<line x1="${x(0.55)}" y1="${t}" x2="${x(0.55)}" y2="${H - b}" class="f7-dash"/><text x="${x(0.57)}" y="${y(0.7)}" class="f7-sm">then STO</text>`; break;
    case "SS2": case "2": path = `M${x(0)} ${y(0.8)}L${x(ts)} ${y(0.8)}L${x(0.55)} ${y(0)}L${x(1)} ${y(0)}`; extra = `<rect x="${x(0.55)}" y="${y(0.06)}" width="${x(1) - x(0.55)}" height="${y(0) - y(0.06)}" class="f7-win"/><text x="${x(0.57)}" y="${y(0.3)}" class="f7-sm">${kind === "2" ? "power on, held" : "then SOS"}</text>`; break;
    case "SOS": path = `M${x(0)} ${y(0)}L${x(1)} ${y(0)}`; extra = `<rect x="${x(0)}" y="${y(0.08)}" width="${x(1) - x(0)}" height="${y(0) - y(0.08)}" class="f7-win"/><text x="${x(0.05)}" y="${y(0.35)}" class="f7-sm">standstill window monitored, torque on</text>`; break;
    case "SLS": path = `M${x(0)} ${y(0.8)}L${x(ts)} ${y(0.8)}L${x(0.42)} ${y(0.3)}L${x(1)} ${y(0.3)}`; extra = `<line x1="${x(0)}" y1="${y(lim)}" x2="${x(1)}" y2="${y(lim)}" class="f7-ialine"/><text x="${x(0.6)}" y="${y(lim) - 4}" class="f7-sm">limit</text>`; break;
    case "SBC": path = `M${x(0)} ${y(0.8)}L${x(ts)} ${y(0.8)}L${x(0.55)} ${y(0)}L${x(1)} ${y(0)}`; extra = `<line x1="${x(0.55)}" y1="${t}" x2="${x(0.55)}" y2="${H - b}" class="f7-dash"/><text x="${x(0.57)}" y="${y(0.7)}" class="f7-sm">brake closes</text><text x="${x(0.57)}" y="${y(0.55)}" class="f7-sm">safely</text>`; break;
  }
  return `<svg class="f7-sk" viewBox="0 0 ${W} ${H}" role="img" aria-label="speed-time sketch ${kind}"><line x1="${l}" y1="${t}" x2="${l}" y2="${H - b}" class="f7-ax"/><line x1="${l}" y1="${H - b}" x2="${W - 6}" y2="${H - b}" class="f7-ax"/>
    <text x="4" y="${t + 8}" class="f7-sm">v</text><text x="${W - 14}" y="${H - 6}" class="f7-sm">t</text>
    ${kind !== "SOS" ? `<line x1="${x(ts)}" y1="${t}" x2="${x(ts)}" y2="${H - b}" class="f7-req"/><text x="${x(ts) - 2}" y="${H - 8}" text-anchor="middle" class="f7-sm">stop request</text>` : ""}
    <path d="${path}" class="fx-ln fx-s1"/>${extra}</svg>`;
}
function html7I() {
  return card("f77I", "7I · Safe drive functions and stop categories", "IEC 61800-5-2 (safe drive functions) · IEC 60204-1 §9.2.2 (stop categories) · ISO 13850 (e-stop)",
    intro(`<p>Modern drives (VFDs, servo amplifiers) have <b>integrated safety functions</b> certified up to PL d/e – SIL 2/3. They replace motor
      contactors and external speed monitors. All of them build on <b>STO</b>: the drive blocks the pulses so the motor cannot make torque. The
      <b>stop category</b> says how the stop happens: 0 = cut power now, 1 = brake then cut, 2 = brake and keep power.</p>
      <p class="phd-eq">stop distance ≈ v·t<sub>reaction</sub> + v² ÷ (2·a<sub>brake</sub>) · the measured stop time goes into the safety distance (7G)</p>`) +
    `<h3 class="fe-h3">Safe drive functions</h3><div class="f7-skgrid">${DRV.map(([k, n, w, u]) => `<div class="f7-skc"><b>${k} – ${esc(n)}</b>${sketch(k)}<p>${esc(w)}</p><p class="sub"><b>FMS:</b> ${esc(u)}</p></div>`).join("")}</div>
    <h3 class="fe-h3">Stop categories (IEC 60204-1)</h3><div class="f7-skgrid">${STOPCAT.map(([k, w, u]) => `<div class="f7-skc"><b>Stop category ${k}</b>${sketch(k)}<p>${esc(w)}</p><p class="sub">${esc(u)}</p></div>`).join("")}</div>
    <p class="am-note">Wiring: STO is two-channel (STO1 / STO2) from safety outputs of the safety PLC (OSSD-type, test pulses allowed by the drive data sheet) or by
      PROFIsafe / CIP Safety / FSoE over the network. SBC needs a safe brake output; SLS / SOS need a safe encoder or encoder-less monitoring certified for the application.</p>` +
    useCase(`stacker crane: e-stop → SS1 on travel, hoist and fork (fast stop, no coasting into the rack end), hoist with SBC; maintenance with
      enabling device → SLS 250 mm/s; light curtain at the load station → STO on the rotary table (small inertia). The PL of the drive function
      (e.g. PL d) is one subsystem in 7F.`));
}
function init7I() { /* static content */ }

/* ================================================================== 7J typical circuit patterns */
const SV = (vb, body, lbl) => `<div class="fe-scroll"><svg class="fe-chart f7-sch" viewBox="${vb}" role="img" aria-label="${esc(lbl)}">${body}</svg></div>`;
const L_ = (x1, y1, x2, y2, c = "f7-w") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
const T_ = (x, y, t, a = "start", c = "f7-sm") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`;
const B_ = (x, y, w, h, t, c = "f7-box") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="${c}"/>` + T_(x + w / 2, y + h / 2 + 4, t, "middle");
const NO = (x, y, t) => L_(x, y, x, y + 10) + L_(x, y + 10, x + 9, y + 26) + L_(x, y + 30, x, y + 40) + T_(x + 12, y + 24, t);          // vertical NO contact
const NC = (x, y, t) => L_(x, y, x, y + 10) + L_(x, y + 10, x - 9, y + 30) + L_(x - 11, y + 30, x, y + 30) + L_(x, y + 30, x, y + 40) + T_(x + 6, y + 24, t);
const NCH = (x, y, t) => L_(x, y, x + 12, y) + L_(x + 12, y, x + 30, y + 7) + L_(x + 28, y, x + 28, y + 9) + L_(x + 28, y, x + 40, y) + T_(x + 20, y - 6, t, "middle");   // horizontal NC contact
const COIL = (x, y, t) => `<rect x="${x - 12}" y="${y}" width="24" height="16" class="f7-sym"/>` + T_(x + 16, y + 12, t);
const PATTERNS = [
  ["Main switch and feeder", `Every machine / module cabinet has a lockable main disconnect (IEC 60204-1 §5.3) at the incoming supply, then a breaker per feeder
    (motor-protection breaker or MCB), selected for I<sub>cu</sub> ≥ I<sub>k3</sub> at that point (7A). PE terminal and bonding bar next to the incoming terminals.`,
    SV("0 0 560 190", L_(40, 20, 520, 20) + T_(40, 14, "L1 L2 L3 from cell board (one line = three phases)") + L_(80, 20, 80, 50) + B_(60, 50, 40, 30, "Q0") + T_(106, 70, "main switch, lockable") + L_(80, 80, 80, 110) + L_(40, 110, 520, 110, "f7-bus") +
      [160, 280, 400].map((x, i) => L_(x, 110, x, 130) + B_(x - 18, 130, 36, 24, ["Q1", "Q2", "F3"][i]) + L_(x, 154, x, 176) + T_(x + 22, 146, ["motor breaker", "VFD fuse/MCB", "24 V PSU MCB"][i])).join("") + T_(40, 186, "PE bar + equipotential bonding · cabinet SCCR ≥ Ik3"), "main switch")],
  ["Motor starter: DOL, star-delta, VFD with STO", `<b>DOL</b> (direct on line): contactor + motor-protection breaker, start current ≈ 7·I<sub>n</sub> (7A). <b>Star-delta</b>: 3 contactors, start current ÷ 3,
    only for motors with low starting torque. <b>VFD</b>: soft start, speed control, integrated STO – today standard for conveyors, stackers, pumps.`,
    SV("0 0 640 200", [["DOL", 80], ["Star-delta", 280], ["VFD + STO", 470]].map(([n, x]) => T_(x, 16, n, "middle", "f7-lbl") + L_(x, 24, x, 44) + B_(x - 30, 44, 60, 24, "Q motor brk") + L_(x, 68, x, 88) +
      (n === "DOL" ? B_(x - 30, 88, 60, 24, "K1") : n === "Star-delta" ? B_(x - 70, 88, 40, 24, "K1 net") + B_(x - 20, 88, 40, 24, "K2 Δ") + B_(x + 30, 88, 40, 24, "K3 Y") : B_(x - 40, 88, 80, 34, "VFD") + L_(x + 40, 98, x + 70, 98, "f7-safe") + L_(x + 40, 110, x + 70, 110, "f7-safe") + T_(x + 72, 102, "STO1") + T_(x + 72, 114, "STO2")) +
      L_(x, n === "VFD + STO" ? 122 : 112, x, 150) + `<circle cx="${x}" cy="166" r="16" class="f7-sym"/>` + T_(x, 170, "M", "middle")).join("") + T_(20, 196, "red = safety wiring from the safety PLC (two channels)", "start", "f7-sm"), "motor starters")],
  ["Contactor pair with feedback (EDM)", `Two contactors in series (K1, K2) switch the hazardous motion: one welded contactor still lets the other one stop it (Cat 3). Their
    <b>mirror contacts</b> (NC, positively guided) go back to the safety PLC as <b>EDM</b> – before each start both must be dropped out, else no restart (DC 99 %).`,
    SV("0 0 560 200", L_(60, 20, 60, 40) + T_(70, 30, "+24 V safe output Q1") + COIL(60, 40, "K1") + L_(60, 56, 60, 80) + L_(200, 20, 200, 40) + T_(210, 30, "safe output Q2") + COIL(200, 40, "K2") + L_(200, 56, 200, 80) + L_(40, 80, 240, 80) + T_(250, 84, "0 V") +
      L_(360, 20, 360, 40) + T_(370, 30, "+24 V test pulse") + NC(360, 40, "K1 NC") + NC(360, 80, "K2 NC") + L_(360, 120, 360, 150) + B_(320, 150, 80, 26, "EDM input") + T_(20, 196, "mains: L1–L3 → K1 → K2 → motor (main contacts in series)"), "contactor EDM")],
  ["24 V distribution with electronic circuit breakers", `One PSU (7C) feeds an ECB module with channels; each channel is a branch (PLC / IO, sensors, valves, HMI). 0 V is earthed at one point (PELV).
    Safety outputs and STO get their own channel or are fed from the safety PLC. The ECB signals "tripped" to the PLC.`,
    SV("0 0 560 170", B_(30, 30, 90, 40, "PSU 24 V") + L_(120, 50, 170, 50) + B_(170, 20, 110, 110, "ECB 4 ch") + [0, 1, 2, 3].map((i) => L_(280, 36 + i * 26, 360, 36 + i * 26) + T_(366, 40 + i * 26, ["ch1 PLC + IO, safety IO", "ch2 sensors, RFID, tower", "ch3 valve coils", "ch4 HMI, light curtain"][i])).join("") +
      L_(75, 70, 75, 150) + T_(84, 150, "0 V → PE (one point)") + L_(225, 130, 225, 150) + T_(234, 150, "status → PLC"), "24 V distribution")],
  ["Two-channel door interlock to the safety PLC", `Interlock switch (with or without guard locking) with two NC contacts, each to its own safety input, each fed from its own test-pulse
    output T1 / T2 → cross-circuit and short to 24 V are detected. Cat 3 / PL d; with a coded RFID switch (ISO 14119 type 4) also protection against defeating.`,
    SV("0 0 560 170", B_(20, 60, 70, 40, "door") + L_(90, 80, 130, 80, "f7-dash") + NC(160, 40, "S1.1") + NC(260, 40, "S1.2") + L_(160, 20, 160, 40) + T_(166, 24, "T1") + L_(260, 20, 260, 40) + T_(266, 24, "T2") + L_(160, 80, 160, 120) + L_(260, 80, 260, 120) +
      B_(130, 120, 170, 30, "safety PLC I1 · I2") + T_(320, 140, "discrepancy time ≈ 50–500 ms monitored"), "door interlock")],
  ["Emergency-stop chain", `E-stop buttons (ISO 13850, red mushroom on yellow, latching, positive opening) with 2 NC contacts each, wired in series per channel to the safety PLC.
    Many buttons in series: fault masking reduces DC (ISO/TR 24119) – put groups on separate inputs. E-stop = stop category 0 or 1, reset is a separate deliberate action.`,
    SV("0 0 580 170", [50, 110].map((y, c) => T_(10, y + 4, "T" + (c + 1)) + L_(30, y, 70, y) + [0, 1, 2].map((i) => NCH(70 + i * 110, y, "S" + (i + 1) + "." + (c + 1)) + L_(110 + i * 110, y, 180 + i * 110, y)).join("") + L_(400, y, 430, y)).join("") +
      [0, 1, 2].map((i) => L_(90 + i * 110, 54, 90 + i * 110, 106, "f7-dash") + T_(90 + i * 110, 136, "S" + (i + 1), "middle")).join("") +
      B_(430, 36, 130, 90, "safety PLC I5 · I6") + T_(10, 160, "each channel in series through all buttons · dashed = same button · reset + lamp at the operator panel"), "e-stop chain")],
  ["Light curtain wiring", `Type 4 light curtain (IEC 61496): transmitter + receiver; the receiver has two <b>OSSD</b> outputs (self-tested semiconductor outputs) to two safety
    inputs. Muting (for pallets passing) and blanking only with the curtain's or the PLC's certified functions. Mount at the distance S from 7G.`,
    SV("0 0 560 160", B_(40, 20, 30, 120, "TX", "f7-box") + B_(220, 20, 30, 120, "RX", "f7-box") + [40, 60, 80, 100, 120].map((y) => L_(70, y, 220, y, "f7-beam")).join("") + L_(250, 60, 320, 60, "f7-safe") + L_(250, 90, 320, 90, "f7-safe") + T_(256, 54, "OSSD1") + T_(256, 84, "OSSD2") +
      B_(320, 50, 170, 50, "safety PLC I3 · I4") + T_(80, 156, "24 V + 0 V to TX and RX, test input / EDM optional"), "light curtain")],
  ["Safety coupling machine ↔ cell", `Each machine tool keeps its own CE and safety. The cell and the machine exchange safety signals <b>hard-wired two-channel</b> (or via a safety
    bus): cell e-stop → machine, machine e-stop → cell, "loading door closed and locked" → cell (before a pallet changer moves), "zone free" ↔ both.
    Never over Modbus TCP / HTTP – those carry only status and jobs (item 6).`,
    SV("0 0 600 200", B_(30, 40, 170, 120, "") + T_(115, 34, "cell safety PLC", "middle", "f7-lbl") + B_(400, 40, 170, 120, "") + T_(485, 34, "machine safety (CNC)", "middle", "f7-lbl") +
      [["e-stop cell → machine", 60, 1], ["e-stop machine → cell", 88, 0], ["door closed + locked → cell", 116, 0], ["zone free / release ↔", 144, 2]].map(([t, y, d]) => L_(200, y, 400, y, "f7-safe") + T_(300, y - 4, t, "middle") + (d === 1 ? `<path d="M392 ${y - 4}L400 ${y}L392 ${y + 4}" class="f7-safe"/>` : d === 0 ? `<path d="M208 ${y - 4}L200 ${y}L208 ${y + 4}" class="f7-safe"/>` : "")).join("") +
      L_(200, 186, 400, 186, "f7-dash") + T_(300, 182, "Modbus TCP / HTTP: status, jobs – NOT safety", "middle"), "safety coupling")],
];
function html7J() {
  return card("f77J", "7J · Typical circuit patterns", "simplified schematics of the patterns every module uses · item 8 gives the complete circuits per module (diagrams, IO lists)",
    intro(`<p>Every module cabinet of the library (M01–M22) is built from the same few circuit patterns. Learn them once, then the module circuits of
      <b>item 8</b> are combinations of these blocks. The drawings below are simplified (one line for three phases, no terminal numbers) – they
      show the principle, not a buildable schematic.</p>`) +
    `<div class="f7-pat">${PATTERNS.map(([t, txt, svg], i) => `<div class="f7-patc"><h3 class="fe-h3">${i + 1} · ${esc(t)}</h3><p class="f7-pt">${txt}</p>${svg}</div>`).join("")}</div>` +
    useCase(`the owner writes in the specification which patterns are mandatory (e.g. "STO via safety PLC, contactor pairs with EDM for non-drive
      hazards, coded interlocks, 4 ECB channels per cabinet, hard-wired safety coupling to every machine"). Then every integrator delivers cabinets
      that maintenance already knows. <b>Item 8</b> turns these patterns into full module circuits with IO lists.`));
}

/* ================================================================== 7K standards map */
const STD = [
  ["IEC 60204-1", "Electrical equipment of machines", "Main switch, protection, control circuits, stop categories, colours, wiring, documentation, tests.", "Every machine and every module cabinet."],
  ["IEC 60364 (series)", "Low-voltage installations (buildings)", "Earthing systems, cable sizing (-5-52), protective conductors (-5-54), automatic disconnection (-4-41), verification (-6).", "Feeders from the plant board to the cell and between cabinets."],
  ["IEC 61439-1/-2", "Low-voltage switchgear assemblies", "Design verification of panels: temperature rise, short-circuit withstand, clearances.", "Cell distribution board and big module cabinets."],
  ["IEC 60890", "Temperature rise of assemblies (calculation)", "Effective surface and heat dissipation method used in 7D.", "Thermal check of a cabinet without a test."],
  ["ISO 12100", "Risk assessment and risk reduction", "Limits, hazards, risk estimation, 3-step reduction.", "Every machine and every cell (assembly of machines)."],
  ["ISO 13849-1", "Safety-related parts of control systems – design", "PLr, categories, MTTFd, DCavg, CCF, PL (7E, 7F).", "Every safety function."],
  ["ISO 13849-2", "– validation", "Fault lists, well-tried principles, validation plan and tests.", "Before handover / CE (7L)."],
  ["IEC 62061", "Functional safety of machinery (SIL)", "Alternative to ISO 13849 using SIL and PFH; often for complex electronics.", "When suppliers give SIL/PFH or for programmable systems."],
  ["ISO 13855", "Positioning of safeguards (approach speeds)", "Safety distances for light curtains, scanners, two-hand controls (7G).", "Every electro-sensitive device and two-hand control."],
  ["ISO 13857", "Safety distances to prevent reaching hazard zones", "Fence heights, gaps, reach over / through / around.", "Fences around pallet pool, robot cell, conveyors."],
  ["ISO 14119", "Interlocking devices with guards", "Switch types 1–4, coding, defeating, guard locking (7G).", "Every interlocked door or cover."],
  ["ISO 13850", "Emergency stop function", "E-stop design, stop category 0/1, reset.", "Every machine and cell."],
  ["IEC 61800-5-2", "Adjustable-speed drives – safety functions", "STO, SS1, SS2, SOS, SLS, SBC … (7I).", "Drives with integrated safety."],
  ["IEC 61496-1/-2/-3", "Electro-sensitive protective equipment", "Type 2 / 4 light curtains, scanners (-3).", "Choosing light curtains and scanners."],
  ["2006/42/EC → (EU) 2023/1230", "Machinery Directive → Machinery Regulation", "Legal basis for CE marking in the EU. The Machinery Regulation (EU) 2023/1230 replaces the Directive and applies from 20 January 2027 (digital instructions, AI / software safety, cybersecurity of safety functions).", "Every machine or assembly placed on the EU market; plan projects that finish after 20 Jan 2027 with the Regulation."],
];
function html7K() {
  return card("f77K", "7K · Standards map", "which standard for which question · always use the edition valid for your project and country",
    intro(`<p>Three groups: <b>electrical</b> (how the power and the cabinets are built), <b>functional safety</b> (how good a safety function must be and
      how to prove it), <b>legal</b> (CE marking). Type-C machine standards (e.g. ISO 10218 robots, ISO 16090 machining centres, EN 528 stacker cranes,
      ISO 3691-4 driverless trucks) come first if they exist – they give ready-made answers for that machine type.</p>`) +
    tab(["Standard", "Title (short)", "What it is for", "When you need it"], STD.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`), "f7-small") +
    useCase(`the specification lists the standards the integrator must follow with edition year; the CE file of the cell (assembly of machines)
      references them. Outside the EU the same standards are used (or national adoptions such as NFPA 79 / UL 508A in North America, GB in China).`));
}

/* ================================================================== 7L commissioning tests */
const TESTS = [
  ["pe", "PE continuity", "Low-resistance test (≥ 0.2 A / 10 A per IEC 60204-1 §18.2) between PE terminal and every exposed conductive part.", "R ≈ ≤ 0.1–0.3 Ω depending on length / cross-section (compare with the calculated value)"],
  ["ins", "Insulation resistance", "500 V DC between power circuits and PE (drives / SPDs disconnected).", "≥ 1 MΩ (IEC 60204-1 §18.3)"],
  ["loop", "Fault-loop impedance Z<sub>s</sub>", "Loop tester at the end of each feeder; compare with Z<sub>s</sub> from 7B.", "I<sub>k1</sub> = U<sub>0</sub>/Z<sub>s</sub> ≥ I<sub>a</sub> (example MC02 feeder: Z<sub>s</sub> ≤ 0.2875 Ω)"],
  ["rcd", "RCD test", "Trip current and time of every RCD (sockets, service PCs).", "trip ≤ I<sub>Δn</sub>, time ≤ 300 ms at I<sub>Δn</sub>"],
  ["volt", "Voltage, phase sequence, 24 V", "Mains voltage and rotation at each cabinet, 24 V at the farthest consumer.", "U<sub>load</sub> ≥ 21.6 V (7C)"],
  ["fsv", "Functional safety validation (ISO 13849-2)", "Each safety function: test every input, each channel alone, cross faults, EDM, reset, restart; zone matrix row by row (7H).", "behaviour = specification, PL documentation complete"],
  ["stop", "Stop-time measurement", "Stop time meter at each light curtain / door: worst-case speed and load, 10 repetitions.", "measured T ≤ T used in 7G (else move the device or improve the brake)"],
  ["estop", "E-stop test", "Every e-stop button, stop category, no automatic restart, reset only at the panel.", "all stop, reset needed"],
  ["doc", "Documents", "As-built circuits, IO lists, safety calculation, validation report, parameter back-ups (drives, safety PLC checksum).", "complete and signed"],
];
function html7L() {
  return card("f77L", "7L · Commissioning tests – electrical and safety", "tick each test and write the measured value · saved in this browser only · print for the FAT / SAT file",
    intro(`<p>Before the cell is handed over, the electrical installation is <b>verified</b> (IEC 60204-1 §18, IEC 60364-6) and every safety function is
      <b>validated</b> (ISO 13849-2). Measured values go into the test report next to the calculated ones of this item – a big difference means a
      design or installation error.</p>`) +
    `<div class="fe-row"><span id="f7LProg" class="sub"></span><button class="mx-el" id="f7LClr">Clear all ticks</button></div><div id="f7LTab"></div>` +
    useCase(`the integrator does the tests at FAT (in his shop, cabinets + safety logic) and SAT (on site, complete cell); the owner's electrician
      witnesses them and repeats loop impedance, RCD and stop time in the periodic inspection (typically every year).`));
}
function init7L() {
  const draw = () => {
    $("f7LTab").innerHTML = tab(["✓", "Test", "Method", "Acceptance (example)", "Measured / note"], TESTS.map(([k, n, m, a]) => { const v = X.tests[k] || {};
      return `<tr><td><input type="checkbox" data-t="${k}"${v.ok ? " checked" : ""}></td><td><b>${n}</b></td><td>${m}</td><td>${a}</td><td><input type="text" data-tn="${k}" value="${esc(v.note || "")}" class="f7-t"></td></tr>`; }), "f7-small");
    prog();
  };
  const prog = () => { const n = TESTS.filter(([k]) => (X.tests[k] || {}).ok).length; $("f7LProg").innerHTML = `${n} / ${TESTS.length} tests done`; };
  $("f7LTab").addEventListener("input", (e) => { const t = e.target, k = t.dataset.t || t.dataset.tn; if (!k) return; X.tests[k] = X.tests[k] || {};
    if (t.dataset.t) X.tests[k].ok = t.checked; else X.tests[k].note = t.value; store.set("x.tests", X.tests); prog(); });
  $("f7LClr").addEventListener("click", () => { X.tests = {}; store.set("x.tests", X.tests); draw(); });
  draw();
}

/* ================================================================== 7M three cases */
function html7M() {
  const L = calcLoad(EX7.load_list), c = calcCable(EX7.cable), k = calcCab(EX7.cabinet), d = calcDC(EX7.dc24);
  const ccf = ccfScore(EX7.safety.ccf_cases[0].applied), sf = EX7.safety.functions.map((f) => evalSF(f, ccf));
  const ds = EX7.safety.distance_cases.map(distance);
  // case 2: robot assembly cell (own example inputs, same formulas)
  const robotLC = distance({ type: "aopd", d: 14, times: [["light curtain", 0.012], ["safety PLC", 0.016], ["robot stop cat 1", 0.25]] });
  const robotSc = distance({ type: "scanner", H: 0, Z: 100, times: [["scanner", 0.08], ["safety PLC", 0.016], ["robot stop", 0.35]] });
  const robotDoor = evalSF({ S: "S2", F: "F2", P: "P2", subsystems: [{ role: "input", pl: "e" }, { role: "logic", pl: "e" }, { role: "output", pl: "d" }] }, ccf);
  const robotCab = calcCab({ W: 0.8, H: 2.0, D: 0.6, mounting: "free", k: 5.5, Ti: 35, Ta_cases: [30], losses: [["robot controller", 450], ["PSU + PLC", 120], ["screwdriver controllers", 90]] });
  const robotMot = calcMotor({ P_kW: 1.5, U: 400, eta: 0.85, cosphi: 0.8, k_start: 6 });
  // case 3: small factory with safety relays, Modbus TCP + HTTP for data only
  const relaySF = evalSF({ S: "S2", F: "F1", P: "P2", subsystems: [{ role: "input", cat: "3", channels: [[["E-stop contact 1", 100000, 250, 8, 3600, 99]], [["E-stop contact 2", 100000, 250, 8, 3600, 99]]] }, { role: "logic", pl: "e" }, { role: "output", cat: "3", channels: [[["Contactor K1", 1300000, 250, 8, 600, 99]], [["Contactor K2", 1300000, 250, 8, 600, 99]]] }] }, ccf);
  const relayDoor = evalSF({ S: "S2", F: "F2", P: "P1", subsystems: [{ role: "input", cat: "1", channels: [[["Interlock switch", 2000000, 250, 8, 300, 0]]] }, { role: "logic", pl: "e" }, { role: "output", cat: "1", channels: [[["Contactor", 1300000, 250, 8, 300, 0]]] }] }, ccf);
  const relayDC = calcDC({ U_psu: 24, U_min: 21.6, reserve: 1.25, psu_sizes: [5, 10, 20, 40], ecb_ratings: [1, 2, 3, 4, 6, 8, 10], loads: [["PLC (Modbus TCP server)", 0.6, 1, 1, "ch1"], ["Safety relays", 0.1, 3, 1, "ch1"], ["Sensors", 0.03, 20, 1, "ch2"], ["Valves", 0.1, 6, 0.5, "ch3"]], line: { L: 25, I: 1.0, A: 0.75, rho: 0.0178 } });
  const box = (t, rows, txt) => `<div class="f7-case"><h3 class="fe-h3">${t}</h3>${kv(rows)}<p class="f7-pt">${txt}</p></div>`;
  return card("f77M", "7M · Three cases with key numbers", "same formulas as 7A–7H · case 1 = the shared example · cases 2 and 3 use their own example inputs (shown)",
    `<div class="f7-cases">` +
    box("Case 1 · Machining FMS (3 HMC, pallet pool, washer, CMM, AGV)", [
      ["Load / supply", `P ${fx(L.P, 1)} kW · S ${fx(L.S, 1)} kVA · I ${fx(L.I, 1)} A · own transformer would be ${L.T} kVA`],
      ["Short circuit", `I<sub>k3</sub> ${fx(L.Ik3 / 1000, 1)} kA → breakers ≥ 25 kA`],
      ["MC02 feeder", `${c.A} mm² + PE ${c.Ape} · ΔU ${fx(c.dUp, 2)} % · I<sub>k1</sub> ${fx(c.Ik1, 0)} A ≥ ${c.Ia} A · L<sub>max</sub> ${fx(c.Lmax, 1)} m`],
      ["24 V / cabinet", `PSU ${d.psu} A · stacker cabinet ${k.P} W → fan ${fx(k.cases[0].V, 0)} m³/h at 25 °C, cooling unit ${fx(k.cases[2].cool, 0)} W at 40 °C`],
      ["Safety", sf.map((r) => `${r.id} ${r.pl || "n/a"}/${r.plr} ${r.ok ? "✓" : "✗"}`).join(" · ")],
      ["Distances", ds.map((r) => fx(r.S, 0)).join(" · ") + " mm · zones keep 6 / 12 outputs running in pool maintenance"]],
      "Safety PLC with zones (7H), drives with STO / SS1 / SLS, hard-wired coupling to the three machines, SF6 must be redesigned two-channel before release.") +
    box("Case 2 · Robot assembly cell (robot, screwdrivers, conveyor, operator station)", [
      ["Inputs", "robot 2 kW controller, conveyor motor 1.5 kW, light curtain 14 mm at the operator port (T = 0.012 + 0.016 + 0.25 s), scanner field at the material side (T = 0.08 + 0.016 + 0.35 s, H = 0)"],
      ["Conveyor motor", `I<sub>n</sub> ${fx(robotMot.In, 2)} A → VFD with STO`],
      ["Light curtain distance", `S = ${fx(robotLC.S, 0)} mm (${esc(robotLC.note || "standard")})`],
      ["Scanner distance", `C = ${fx(robotSc.C, 0)} mm · S = ${fx(robotSc.S, 0)} mm`],
      ["Fence door → robot STO/SS1", `S2 F2 P2 → PLr ${robotDoor.plr} · coded switch PL e + safety PLC e + robot safe stop PL d → PL ${robotDoor.pl} ${robotDoor.ok ? "✓" : "✗ – needs a PL e robot interface or a second channel (contactors)"}`],
      ["Robot cabinet (free-standing)", `A ${fx(robotCab.A, 2)} m² · ${robotCab.P} W → at 30 °C ${robotCab.cases[0].kind === "fan" ? "fan " + fx(robotCab.cases[0].V, 0) + " m³/h" : robotCab.cases[0].kind === "cooling" ? "cooling unit " + fx(robotCab.cases[0].cool, 0) + " W" : "no active cooling"}`]],
      "Shows that a PLr e risk (robot, frequent access, hard to avoid) is not met by a PL d device chain – the type-C standard ISO 10218-2 and the robot maker's safety option decide.") +
    box("Case 3 · Small factory with safety relays and Modbus TCP / HTTP", [
      ["Concept", "4 stand-alone machines + conveyor, one safety relay per zone (certified PL e), PLC as Modbus TCP server, HTTP dashboard – data only, safety hard-wired"],
      ["E-stop zone (Cat 3)", `S2 F1 P2 → PLr ${relaySF.plr} · contacts + relay + 2 contactors with EDM → PL ${relaySF.pl} ${relaySF.ok ? "✓" : "✗"}`],
      ["Door, first design single channel", `S2 F2 P1 → PLr ${relayDoor.plr} · PL ${relayDoor.pl || "n/a"} ${relayDoor.ok ? "✓" : "✗ – add second switch + contactor"}`],
      ["24 V", `I ${fx(relayDC.total, 2)} A → PSU ${relayDC.psu} A · 25 m sensor line 0.75 mm² at 1 A: U ${fx(relayDC.Uload, 2)} V ${relayDC.lineOk ? "✓" : "✗"}`],
      ["Data link", "Modbus TCP holds status word, counters, alarms (item 6F); a 'safety OK' bit is information only, never part of a safety function"]],
      "Cheap and robust: safety relays are enough for a few simple zones; switch to a safety PLC when zones interact (like 7H) or more than ~4 safety functions share outputs.") +
    `</div>`);
}

/* ================================================================== 7N checklists */
const CHK = [
  ["Electrical design", ["Load list with k<sub>u</sub>, cos φ, k<sub>s</sub>, growth → supply agreed with plant electrical (7A)", "I<sub>k3</sub> known at each board → I<sub>cu</sub> of breakers, SCCR of cabinets", "Earthing system (TN-S) and equipotential bonding defined", "Every feeder: I<sub>b</sub> ≤ I<sub>n</sub> ≤ I<sub>z</sub>, ΔU, fault loop / L<sub>max</sub> (7B)", "Motor starters chosen (DOL / Y-D / VFD), harmonics and EMC of VFDs considered", "24 V budget, PSU, ECB channels, line drop (7C)", "Main switch lockable per machine/module, power-off for maintenance (LOTO)"]],
  ["Cabinet", ["Losses listed, IEC 60890 check, fan / cooling unit (7D)", "Heat sources high, electronics low, 100 mm free above drives", "IP rating for the hall (IP54 typical), condensate handling", "Separation power / 24 V / safety wiring, colours per IEC 60204-1", "20 % spare space and terminals, labels, cable ducts", "Panel built and verified per IEC 61439 (or IEC 60204-1 for machine cabinets)"]],
  ["Safety design", ["Risk assessment ISO 12100 for all life phases, PLr per safety function (7E)", "PL calculation for each function incl. CCF and T10d (7F)", "Safety distances calculated with real stop times (7G)", "Guard locking where run-down > access time, coded interlocks against defeating (ISO 14119)", "Safety zones and cause & effect matrix in the FDS (7H)", "Safe drive functions and stop categories chosen (7I), e-stop cat 0/1", "Safety coupling to every machine hard-wired / safety bus, never Modbus / HTTP (7J)", "Maintenance modes with enabling device and SLS"]],
  ["Validation", ["Validation plan ISO 13849-2 written before tests", "Each safety function tested incl. faults (one channel, cross, EDM)", "Stop times measured and ≤ design values", "PE, insulation, loop impedance, RCD measured (7L)", "Safety PLC program checksum + parameters archived", "Risk assessment, PL report, validation report signed by the responsible persons", "CE: declaration for the assembly of machines, instructions updated (Machinery Regulation from 20 Jan 2027)"]],
];
function html7N() {
  return card("f77N", "7N · Checklists", "tick what is done · saved in this browser only",
    `<div class="f7-chk">${CHK.map(([g, items], gi) => `<div><h4>${g}</h4>${items.map((t, i) => `<label class="f7-ci"><input type="checkbox" data-c="${gi}_${i}"> ${t}</label>`).join("")}</div>`).join("")}</div>
    <div class="fe-row"><span id="f7NProg" class="sub"></span><button class="mx-el" id="f7NClr">Clear all ticks</button></div>
    <p class="am-note">Reminder: these lists and all numbers in item 7 are teaching examples. The real project needs the current editions of the standards,
      the manufacturers' data and sign-off by qualified electrical and safety engineers.</p>`);
}
function init7N() {
  const boxes = () => document.querySelectorAll("#f77N [data-c]");
  const prog = () => { const all = boxes(), n = [...all].filter((b) => b.checked).length; $("f7NProg").textContent = `${n} / ${all.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!X.chk[b.dataset.c]; b.addEventListener("change", () => { X.chk[b.dataset.c] = b.checked; store.set("x.chk", X.chk); prog(); }); });
  $("f7NClr").addEventListener("click", () => { X.chk = {}; store.set("x.chk", X.chk); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}
