/* FMS engineering – item 10 part B: complete module programs M01–M22 (one generic module program + module data).
 * B1 generic module program · B2 module browser · B3 module simulator (scenarios + interactive) · B4 fault explainer F1–F8
 * B5 generated ST + ALARMS.csv · B6 cycle-time and alarm statistics · B7 commissioning checklist generator.
 * Engine: fmse10bx.js (rules = EX10B._rules of tools/fmse/examples/item10b_examples.json, exactly; device FBs of fmse10x.js).
 * Mounted by fmse10.js inside the "Part B" switch; init() runs on the first switch to part B. Offline; user choices in localStorage "fmse.10.b*".
 * Test hook: window.fe10b (results() always from the JSON). ALL VALUES ARE EXAMPLES. */
import { $, esc, card, tab, kpis, intro, useCase, csvDownload } from "./fmse8x.js";
import { exBox, pre, bin } from "./fmse9x.js";
import { L, T, RC, svg, arrowDefs, store10 as store } from "./fmse10x.js";
import { EX10B, ST, Module, moduleDesc, CODES10B, normalOf, faultOf, faultId, allResults10B, refLines10B, stats, EDGES, DUR, SEQ } from "./fmse10bx.js";
import { TICK10B, ENTRY10B, FAULT10B, CHK10B } from "./fmse10b_data.js";

export const S = {
  mod: store.get("bMod", "M10"), simMod: store.get("bSim", "M02"), scen: store.get("bScen", "F1"), k: null, flt: store.get("bFlt", "F1"),
  stMod: store.get("bSt", null), chkMod: store.get("bChkMod", "M02"), chk: store.get("bChk", {}), inj: 0, live: null, inited: false, stFiles: null,
};
const R = { errors: [] };
const timers = {};
const stopPlay = (k) => { if (timers[k]) { clearInterval(timers[k]); timers[k] = null; } };
const FAULTS = EX10B.fault_scenarios;
const fltById = (id) => FAULTS.find((f) => faultId(f) === id);
const short = (t) => t.replace("FB_", "");
const CLS_R = { A: "Abort – every command safe, sequence stops", B: "Hold (only in Execute) – sequence frozen", C: "warning only – no reaction" };
const clsTag = (c) => `<span class="f10-cls f10-cls${c}">${c}</span>`;
const fmtV = (v) => (typeof v === "boolean" ? (v ? "1" : "0") : Number.isInteger(v) ? String(v) : typeof v === "number" ? String(Math.round(v * 100) / 100) : esc(v));
const tickOf = (l) => parseInt(l, 10);
const runCache = {};
function runOf(code, scen) {
  if (scen === "live") return S.live;
  const key = code + "|" + scen;
  if (!runCache[key]) runCache[key] = scen === "normal" ? normalOf(code, true) : faultOf(fltById(scen), true);
  return runCache[key];
}
const scenOf = (code) => ["normal", ...FAULTS.filter((f) => f.module === code).map(faultId), "live"];

/* ================================================================== html */
export function html() {
  return `<div class="card f8-warnbox"><p><b>Part B of 3 – example values only.</b> The <b>complete PLC programs</b> of all 22 module types M01–M22. Every module program is the
    <b>same generic module FB</b> (PackML core with the decisions D1–D4 of part A, the device FBs of the library, step sequences, alarm classes, monitors, data block)
    plus a small block of <b>module data</b> (data: <code>tools/fmse/examples/item10b_examples.json</code>, guide <code>docs/FMS system design/70_plc_library_B_modules.md</code>,
    generated ST <code>tools/fmse/plc_modules/</code>). Guide, Python tools and this page give <b>identical logs</b>. Safety functions only in the F-program.</p></div>` +
    [htmlB1(), htmlB2(), htmlB3(), htmlB4(), htmlB5(), htmlB6(), htmlB7()].join("");
}
export function init() {
  if (S.inited) return; S.inited = true;
  [initB1, initB2, initB3, initB4, initB5, initB6, initB7].forEach((f) => { try { f(); } catch (e) { console.error("fmse10b " + f.name, e); R.errors.push(f.name + ": " + e.message); } });
}
export function hook() {
  return {
    results: allResults10B, refLines: refLines10B, R, S,
    setMod: (c) => { S.mod = c; drawB2(); },
    setSim: (c, sc, k) => { S.simMod = c; S.scen = sc; S.k = k; if (sc === "live") newLive(); fillScen(); drawB3(); },
    setFault: (id) => { S.flt = id; drawB4(); },
    reactTick: (c, sc) => reactTick(runOf(c, sc)),
  };
}

/* ================================================================== B1 generic module program */
function svgStruct() {
  let b = arrowDefs("f10qA");
  const box = (x, y, w, h, t, s, c) => RC(x, y, w, h, c) + T(x + w / 2, y + h / 2 - (s ? 3 : -4), t, "middle", "f9-sm f9-b") + (s ? T(x + w / 2, y + h / 2 + 11, s, "middle", "f9-xs") : "");
  const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="f9-edge" marker-end="url(#f10qA)"/>`;
  b += box(20, 14, 150, 42, "Cell controller", "part C · writes CntrlCmd", "f9-task");
  b += box(220, 14, 170, 42, "Data block (DB)", "StateCurrent · AlarmNo · Bits", "f9-gvl");
  b += box(440, 14, 160, 42, "HMI / SCADA", "reads the same DB", "f9-task");
  b += ar(170, 28, 220, 28) + ar(220, 44, 170, 44) + ar(390, 35, 440, 35);
  b += RC(20, 78, 580, 252, "f9-none", 8) + T(30, 96, "Generic module FB  FB_Module_&lt;unit&gt;  (one program for every module, called every tick)", "start", "f9-sm f9-b");
  b += box(40, 108, 130, 42, "FB_CmdIf", "D1 command echo", "f9-fb") + box(200, 108, 160, 42, "PackML core", "17 states · entry actions", "f9-prg") + box(390, 108, 190, 42, "Sequence engine", "home · start · exec steps", "f9-prg");
  b += ar(170, 129, 200, 129) + ar(360, 129, 390, 129) + ar(305, 56, 105, 108);
  b += box(40, 176, 190, 42, "Alarm collector (D2, D3)", "M×1000+10·i+a · class A/B/C", "f9-fb") + box(260, 176, 150, 42, "Alarm reaction", "A → Abort · B → Hold", "f9-prg") + box(440, 176, 140, 42, "Monitors", "permanent conditions", "f9-fb");
  b += ar(230, 197, 260, 197) + ar(335, 176, 290, 150) + ar(440, 197, 410, 197);
  b += box(40, 244, 540, 42, "Device FB instances i = 1 … n  (library of part A: valves, motors, drives, sensors, safety mirrors, handshake …)", "commands from the steps · IO from the plant · iAlarm to the collector", "f9-blk");
  b += ar(485, 150, 485, 244) + ar(130, 244, 130, 218);
  b += box(40, 300, 540, 24, "", "", "f9-res") + T(310, 316, "IO layer (generated, item 9) ⇄ plant / machine  ·  F-program (safety) gives only read-only copies", "middle", "f9-xs");
  b += ar(310, 286, 310, 300);
  return svg(620, 340, b, "f10q-struct", "Structure of the generic module program");
}
const PPOS = { Idle: [0, 1], Starting: [1, 1], Execute: [2, 1], Completing: [3, 1], Complete: [4, 1], Unholding: [1, 0], Held: [2, 0], Holding: [3, 0],
  Unsuspending: [1, 2], Suspended: [2, 2], Suspending: [3, 2], Resetting: [0, 3], Stopped: [1, 3], Stopping: [3, 3], Clearing: [1, 4], Aborted: [2, 4], Aborting: [3, 4] };
function pedge(a, b, w, h, cls, mk, bend = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], cut = (px, py) => (Math.abs(px) * h > Math.abs(py) * w ? (w / 2) / Math.abs(px || 1e-9) : (h / 2) / Math.abs(py || 1e-9));
  const ta = Math.min(cut(dx, dy), 0.5), tb = Math.min(cut(-dx, -dy), 0.5), x1 = a[0] + dx * ta, y1 = a[1] + dy * ta, x2 = b[0] - dx * tb, y2 = b[1] - dy * tb;
  if (!bend) return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}" marker-end="url(#${mk})"/>`;
  const mx = (x1 + x2) / 2 - dy * bend, my = (y1 + y2) / 2 + dx * bend;
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" class="${cls}" marker-end="url(#${mk})"/>`;
}
/** PackML state diagram, current state highlighted, last transition hot */
function svgPackB(cur, prev, id) {
  const W = 104, H = 30, X = (c) => 62 + c * 124, Y = (r) => 24 + r * 58; let b = arrowDefs(id);
  EDGES.forEach(([a, c, lab]) => {
    const hot = prev && prev !== cur && a === prev && c === cur;
    const bend = (a === "Complete" && c === "Resetting") ? -0.12 : (a === "Execute" && (c === "Holding" || c === "Suspending")) ? 0.18 : (a === "Unholding" || a === "Unsuspending") ? 0.18 : 0;
    b += pedge([X(PPOS[a][0]), Y(PPOS[a][1])], [X(PPOS[c][0]), Y(PPOS[c][1])], W, H, hot ? "f9-ehot" : lab === "SC" ? "f9-edge f9-sc" : "f9-edge", id, bend);
  });
  Object.entries(PPOS).forEach(([s, [c, r]]) => {
    const on = s === cur, acting = DUR[s] != null || SEQ[s] != null || s === "Clearing";
    b += RC(X(c) - W / 2, Y(r) - H / 2, W, H, on ? (s === "Aborting" || s === "Aborted" ? "f9-stF" : (s === "Held" || s === "Holding") ? "f10q-stH" : "f9-stA") : acting ? "f9-st f9-acting" : "f9-st", acting ? 12 : 3) +
      T(X(c), Y(r) + 1, s, "middle", on ? "f9-sm f9-b f9-inv" : "f9-sm") + T(X(c), Y(r) + 11, String(ST[s]), "middle", on ? "f9-xs f9-inv" : "f9-xs");
  });
  b += T(8, 300, "rounded = acting state (sequence or duration, ends with SC) · square = waiting state (needs a command) · dashed = SC", "start", "f9-xs");
  return svg(620, 306, b, "f10q-pack", "PackML state machine, current state " + cur);
}
function htmlB1() {
  const tickRows = TICK10B.map(([n, a, b]) => `<tr><td><b>${n}</b></td><td><b>${a}</b></td><td>${b}</td></tr>`);
  const entryRows = ENTRY10B.map(([s, a, d]) => `<tr><td><b>${s}</b></td><td>${a}</td><td>${d}</td></tr>`);
  return card("f10qB1", "B1 · The generic module program – one FB, 22 data blocks", "structure · scan order of a tick · PackML core · sequence engine",
    intro(`<p>Part A gave the <b>standard</b> and the <b>device FBs</b>. Part B writes the <b>module programs</b>. The trick: we do <b>not</b> write 22 different programs.
      We write <b>one generic module FB</b> and describe every module by <b>data</b>: which device FBs it has, its step sequences (home, start, exec), its alarms with
      classes, its monitors and wires. A new module type = a new data block, no new logic.</p>
      <p class="phd-eq">module program = generic core (PackML + D1–D4 + sequence engine + alarm collector) + module data (instances, steps, alarms, monitors, wires)</p>
      <p><b>Why?</b> One core is tested once and used 22 times (or 200 times in a big plant). Errors are found in one place. Every module behaves the same for the
      cell controller, the HMI and the maintenance people: same states, same alarm numbers, same data block.</p>`) +
    `<div class="grid2 eq"><div class="fe-scroll">${svgStruct()}</div><div>
      <h3 class="fe-h3">What the module data contains</h3>
      <ul class="am-ul"><li><b>instances</b> – device FBs from the item 8 module expansion (only patterns with IO), i = 1 … n, plus an optional bus partner (FB_HandshakeHw) as the last instance</li>
      <li><b>home / start / exec</b> – step sequences (decision D4: homing is the 'home' sequence in Resetting)</li>
      <li><b>alarms</b> – module alarms a = 1…9 with text and class; device alarms come from the library with default classes, the module may <b>override</b> a class</li>
      <li><b>monitors</b> – permanent conditions (e-stop, level low, filter dirty) with the states where they count</li>
      <li><b>wires</b> – FB output → FB input with one tick delay (e.g. bath temperature → heater)</li>
      <li><b>keep</b> – commands that stay on in Stop (heater), switched off only by Abort</li>
      <li><b>cfg / plant</b> – FB configuration (ranges, move times) and the test plant (stroke ticks, job times)</li></ul></div></div>
    <h3 class="fe-h3">Scan order of one tick (100 ms) – 10 steps, always the same</h3>${tab(["#", "Step", "What happens"], tickRows, "f8-small")}
    <p class="f8-pt"><b>Why this order?</b> The plant moves with the outputs of the <i>last</i> tick (real machines react after the output is written). Device FBs run before
      the command check so that the alarms are fresh; the alarm reaction comes after the command so that an internal Abort always wins; the data block is written last so
      that StateCurrent, AlarmNo and Bits belong to the <b>same</b> tick. Reaction time from a sensor to the state change: <b>1 tick</b>; command to echo: <b>1 tick</b>.</p>
    <h3 class="fe-h3">PackML core with the entry actions D1–D4</h3>
    <div class="grid2 eq"><div class="fe-scroll">${svgPackB("Execute", null, "f10qP1")}</div><div>${tab(["Entering", "Entry action of the core", "Decision"], entryRows, "f8-small")}</div></div>
    <p class="f8-pt">Commands are accepted by FB_CmdIf (part A, decision D1) and executed <b>at once</b> (n<sub>state</sub> = 0). Duration states (Stopping, Aborting, Holding,
      Unholding, Suspending, Unsuspending) last 1 tick: <span class="phd-eq">SC ⇔ n<sub>state</sub> ≥ duration, n<sub>state</sub> += 1 per tick (not in the entry tick)</span>.
      Sequence states (Resetting, Starting, Execute, Completing) end with SC when their sequence ends; an <b>empty</b> sequence ends in the tick after entry.
      Clearing: next tick → Stopped if no class A/B alarm is active, else back to Aborted ("clear failed").</p>
    <h3 class="fe-h3">Sequence engine – a step and its rules</h3>
    <p class="f8-pt">A step is <code>{s, do, wait, to, al, next, skip_if}</code>: number, commands to write when the step is entered, the condition to go on, the time-out in ticks,
      the module alarm number for the time-out, an optional jump target and an optional skip condition.</p>
    <p class="phd-eq">enter step: skip_if TRUE → next step at once; else apply 'do', t = 0 &nbsp;·&nbsp; every tick: t += 1; wait TRUE → next step; else if to &gt; 0 ∧ t ≥ to → alarm 'al' (once)</p>
    <p class="f8-pt">Conditions: OR-groups with <code>|</code>, AND with <code>&amp;</code>, a term = optional <code>!</code> + operand + optional comparison
      (<code>&gt;= &lt;= = &gt; &lt;</code> number). Operands: <code>Inst.output</code> (FB output of this tick), <code>t</code> (ticks in the step), <code>T</code> / <code>F</code>.
      Time-out alarm class C → the sequence continues (warning); class A/B → it stays in the step, the reaction of step 7 follows in the next tick.</p>
    <div id="f10qB1Ex"></div>` +
    useCase(`a line builder delivers 3 new pallet changers and 2 washers: the PLC team copies the generic module FB, writes 2 data blocks (or reuses M02 and M10), the
      cell controller sees the same PackML interface for all 5 – commissioning time per module drops from days to hours.`));
}
function initB1() {
  const m = normalOf("M02"), md = m.md;
  const keyL = m.log.filter((l) => / step |SC: |cmd /.test(l)).slice(0, 18);
  $("f10qB1Ex").innerHTML = exBox("M02 pallet changer, normal cycle (generic core + M02 data)", `<p>Exec steps of M02: ${md.exec.map((s) => `<b>S${s.s}</b> ${esc(Object.entries(s.do || {}).map(([k, v]) => `${k} := ${v}`).join(", "))} → wait <code>${esc(s.wait)}</code> (to ${s.to})`).join(" · ")}.</p>
    <p>Log of the generic program with this data (first lines):</p>${pre(keyL.join("\n"))}
    <p>Cycle: Start accepted at tick ${tickOf(m.log.find((l) => /cmd Start/.test(l)))}, Complete at tick ${tickOf(m.log.find((l) => /state Complete /.test(l)))} →
      t<sub>cycle</sub> = ${tickOf(m.log.find((l) => /state Complete /.test(l))) - tickOf(m.log.find((l) => /cmd Start/.test(l)))} ticks × 100 ms =
      <b>${((tickOf(m.log.find((l) => /state Complete /.test(l))) - tickOf(m.log.find((l) => /cmd Start/.test(l)))) / 10).toFixed(1)} s</b>. The rotate step S20 takes 31 ticks: the rotate cylinder needs 30 ticks (plant T = 30) + 1 tick for the end switch to reach the FB.</p>`);
}

/* ================================================================== B2 module browser */
const modOpts = (sel) => CODES10B.map((c) => `<option value="${c}"${c === sel ? " selected" : ""}>${c} · ${esc(moduleDesc(c).unit)} · ${esc(moduleDesc(c).title)}</option>`).join("");
const doTxt = (st) => Object.entries(st.do || {}).map(([k, v]) => `${k} := ${v}`);
/** SFC (sequential function chart) of one sequence; cur = active step number */
export function svgSfc(D, seq, cur, id) {
  const steps = D.md[seq] || [], W = 640, x = 30; let y = 8, b = arrowDefs(id);
  const entry = { home: "Resetting", start: "Starting", exec: "Execute", complete: "Completing" }[seq];
  b += RC(x, y, 64, 26, cur === 0 ? "f9-act" : "f9-blk", 2) + RC(x + 3, y + 3, 58, 20, "f9-none", 1) + T(x + 32, y + 17, "S0", "middle", "f9-sm f9-b") + T(x + 80, y + 17, `initial step – entered with ${entry}`, "start", "f9-xs");
  y += 26;
  if (!steps.length) { b += L(x + 32, y, x + 32, y + 18) + T(x + 80, y + 14, "no steps → SC in the tick after entry", "start", "f9-sm"); return svg(W, y + 26, b, "f10q-sfc", `SFC ${seq} (empty)`); }
  steps.forEach((st) => {
    const lines = doTxt(st), on = cur === st.s;
    b += L(x + 32, y, x + 32, y + 12); y += 12;
    if (st.skip_if) { b += T(x + 44, y - 2, esc("skip if " + st.skip_if), "start", "f10q-skip"); }
    const h = Math.max(26, 14 * lines.length + 8);
    b += RC(x, y, 64, h, on ? "f9-act" : "f9-blk", 2) + T(x + 32, y + h / 2 + 4, `S${st.s}`, "middle", "f9-sm f9-b");
    if (lines.length) { b += L(x + 64, y + 13, x + 84, y + 13, "f9-thin") + RC(x + 84, y, 300, h, on ? "f10q-actOn" : "f10q-actBox", 2); lines.forEach((t, j) => { b += T(x + 92, y + 16 + j * 14, esc(t), "start", "f9-sm f10q-mono"); }); }
    else b += T(x + 84, y + h / 2 + 4, "(no command – wait only)", "start", "f9-xs");
    y += h; b += L(x + 32, y, x + 32, y + 14);
    b += `<line x1="${x + 18}" y1="${y + 14}" x2="${x + 46}" y2="${y + 14}" class="f10q-tr"/>`;
    b += T(x + 56, y + 13, esc(st.wait), "start", "f9-sm f10q-mono");
    const tos = st.to > 0 ? `time-out t ≥ ${st.to} (${(st.to / 10).toFixed(1)} s) → alarm ${D.M * 1000 + st.al} class ${D.malarm[st.al][1]}${D.malarm[st.al][1] === "C" ? " (go on)" : " (stay)"}` : "no time-out";
    b += T(x + 56, y + 26, esc(tos + (st.next != null ? ` · next → S${st.next}` : "")), "start", st.to > 0 ? "f10q-to" : "f9-xs");
    y += 32;
  });
  b += L(x + 32, y, x + 32, y + 12); y += 12;
  b += RC(x, y, 64, 22, "f9-res", 11) + T(x + 32, y + 15, "end", "middle", "f9-sm") + T(x + 80, y + 15, `sequence ends → SC: ${entry} → ${{ Resetting: "Idle", Starting: "Execute", Execute: "Completing", Completing: "Complete" }[entry]}`, "start", "f9-xs");
  return svg(W, y + 30, b, "f10q-sfc", `SFC of sequence ${seq}`);
}
const PLANT_TXT = {
  FB_Valve1: (p) => `cylinder 1 step per tick toward B while qSol, back to A without; stroke T = ${p.T != null ? p.T : 10} ticks`,
  FB_Valve2: (p) => `bistable: spool B if qSolB only, A if qSolA only, else kept; stroke T = ${p.T != null ? p.T : 10} ticks`,
  FB_MotorDol: () => "run feedback 2 ticks after qRun; trip = motor protection",
  FB_DriveSto: (p) => `axis 0…${p.L != null ? p.L : 20}, 1 per tick while running, turns at the ends; STO = NOT release`,
  FB_Heater: (p) => `temp +0.5 per tick heating, −0.1 cooling; start ${p.temp0 != null ? p.temp0 : 20} °C`,
  FB_AnalogIn: (p) => ("src" in p ? `value = temperature of ${p.src}` : "expr" in p ? `${p.v1} when '${p.expr}' for more than ${p.delay || 0} ticks, else ${p.v0}` : `constant ${p.value != null ? p.value : 0}`),
  FB_Sensor: (p) => ("expr" in p ? `ON while '${p.expr}'` : "set" in p ? `latch: set '${p.set}', reset '${p.reset}', start ${p.value || 0}` : `constant ${p.value || 0}`),
  FB_HandshakeHw: (p, D, pat) => `partner: Request → 2 ticks → Busy ${pat === "PARTNER" ? (p.job != null ? p.job : D.md.partner.job) : (p.job != null ? p.job : 30)} ticks → Done → Ack → idle`,
  FB_Door2Ch: (p) => ("expr2" in p ? `channels = '${p.expr2}'` : "healthy (closed)"),
};
function plantTxt(D, g, t, pat) {
  const p = (D.md.plant || {})[g] || {};
  if (PLANT_TXT[t]) return PLANT_TXT[t](p, D, pat);
  if (["FB_Estop", "FB_EnableSwitch", "FB_LightCurtain", "FB_SafetyCoupling", "FB_DoorLock"].includes(t)) return "healthy (both channels TRUE); SAFE event = both channels";
  if (["FB_ZoneOut", "FB_ContactorPair", "FB_SafeValve"].includes(t)) return "F-copy: command = release of the F-program, feedback follows 1 tick later";
  return { FB_Feeder: "supply ON", FB_Ups: "UPS OK, not on battery", FB_PushButton: "not pressed (operator events)", FB_ModeSwitch: "key in Auto", FB_TwoHand: "not pressed (operator events)", FB_Scanner: "field free", FB_SignalTower: "lamps (iState / class automatic)" }[t] || "–";
}
const CMDS_OF = { FB_Valve1: "xCmdB, xEnable", FB_Valve2: "xCmdB, xEnable", FB_MotorDol: "xCmd", FB_DriveSto: "xCmdRun", FB_Heater: "xEnable, rSp", FB_PushButton: "iLampMode", FB_HandshakeHw: "xStart", FB_Scanner: "iField", FB_SignalTower: "iState, iAlarmClass (auto)" };
function htmlB2() {
  return card("f10qB2", "B2 · Module browser – M01 … M22", "instances · SFC step tables · alarms · monitors · wires · plant",
    intro(`<p>Choose a module and see its <b>complete program data</b>: the device FB instances (with their alarm number range), the three sequences as <b>SFC</b>
      (sequential function chart, IEC 61131-3: step box, action box, transition bar with condition), all alarms with class and reaction, monitors, wires and the test plant.</p>
      <p class="phd-eq">alarm number = M × 1000 + 10 · i + a &nbsp; (i = instance 1…n, a = FB alarm 1…9; module alarms: i = 0)</p>`) +
    `<div class="fe-row"><label>Module <select id="f10qB2M" class="fe-sel">${modOpts(S.mod)}</select></label><span id="f10qB2K" class="f8-pt"></span></div>
    <div id="f10qB2Kp"></div>
    <h3 class="fe-h3">Device FB instances</h3><div id="f10qB2I"></div>
    <h3 class="fe-h3">Sequences (SFC)</h3><div class="mx-nav" id="f10qB2Q"></div><div class="fe-scroll" id="f10qB2S"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Alarms (class, reaction)</h3><div id="f10qB2A"></div></div>
    <div><h3 class="fe-h3">Monitors, wires, keep, cell controller script</h3><div id="f10qB2O"></div></div></div>
    <h3 class="fe-h3">Test plant behaviour</h3><div id="f10qB2P"></div>` +
    exBox("M10 washer read from the browser", `<p>10 instances; exec = 7 steps: conveyor in (S10, 20 ticks) → door down (S20, wait DoorCyl.xAtB, time-out 30 → alarm 10003 B) → spray 40 ticks
      → rinse 20 ticks → door up → conveyor out → stop. The heater is in <b>keep</b> (stays on in Stop, the bath must stay warm) and gets the bath temperature by a
      <b>wire</b> TankTemp.rValue → Heater.rTemp. Monitor 4 'LevelLow.xValue' in Execute → 10004 class <b>A</b>: the pumps must never run dry.</p>`) +
    useCase(`design review with the mechanical and process engineers: everybody reads the SFC of 'their' module, checks the steps and time-outs against the machine
      and signs the module data – before one line of PLC code is generated.`));
}
function initB2() {
  $("f10qB2M").addEventListener("change", () => { S.mod = $("f10qB2M").value; store.set("bMod", S.mod); S.mseq = null; drawB2(); });
  $("f10qB2Q").addEventListener("click", (e) => { const b = e.target.closest("[data-seq]"); if (!b) return; S.mseq = b.dataset.seq; drawB2(); });
  drawB2();
}
function drawB2() {
  if (!$("f10qB2M")) return;
  const D = moduleDesc(S.mod), md = D.md, st = stats(S.mod); $("f10qB2M").value = S.mod;
  $("f10qB2K").innerHTML = `unit <b>${D.unit}</b> · module number M = <b>${D.M}</b> · alarm numbers ${D.M * 1000 + 1} … ${D.M * 1000 + 10 * D.inst.length + 9}`;
  $("f10qB2Kp").innerHTML = kpis([["FB instances", D.inst.length], ["steps home/start/exec", `${st.home}/${st.start}/${st.exec}`], ["alarms defined", D.table.length], ["class A / B / C", `${st.clsA}/${st.clsB}/${st.clsC}`], ["monitors", st.monitors], [st.cont ? "continuous" : "cycle (normal)", st.cont ? "stays in Execute" : `${(st.cycle / 10).toFixed(1)} s`]]);
  $("f10qB2I").innerHTML = D.inst.length ? tab(["i", "Instance", "FB type", "pattern (item 8)", "alarm numbers", "commands written by the program"], D.inst.map(([g, t, p], ix) => {
    const n = Object.keys(D.table.filter((r) => r.i === ix + 1)).length;
    return `<tr><td>${ix + 1}</td><td><b>${esc(g)}</b></td><td>${short(t)}</td><td>${esc(p)}</td><td>${n ? `${D.M * 1000 + 10 * (ix + 1) + 1} … ${D.M * 1000 + 10 * (ix + 1) + 9}` : "–"}</td><td>${CMDS_OF[t] || "– (status only)"}</td></tr>`;
  }), "f8-small") : `<p class="f8-pt">No device FBs with IO: this module is pure software (PC / network); the generic core still runs PackML, monitors and the data block.</p>`;
  const seqs = ["home", "start", "exec"].filter((q) => (md[q] || []).length || q !== "start");
  if (!S.mseq || !seqs.includes(S.mseq)) S.mseq = "exec";
  $("f10qB2Q").innerHTML = seqs.map((q) => `<button class="mx-el${q === S.mseq ? " active" : ""}" data-seq="${q}">${q} · ${(md[q] || []).length} steps</button>`).join("");
  $("f10qB2S").innerHTML = svgSfc(D, S.mseq, null, "f10qS2");
  $("f10qB2A").innerHTML = tab(["No", "Source", "Text", "Class", "Reaction"], D.table.map((r) => `<tr><td><b>${r.no}</b></td><td>${r.i ? `i ${r.i} ${esc(r.inst)}` : "module"}</td><td>${esc(r.i ? r.text.split(": ").slice(1).join(": ") : r.text)}</td><td>${clsTag(r.cls)}${r.src === "module override" ? " <span class=\"sub\">override</span>" : ""}</td><td>${CLS_R[r.cls].split(" – ")[0]}</td></tr>`), "f8-small");
  const mon = (md.monitors || []).map(([a, e, s, d]) => `<tr><td><b>${D.M * 1000 + a}</b> ${clsTag(D.malarm[a][1])}</td><td><code>${esc(e)}</code></td><td>${esc([].concat(s).join(", "))}</td><td>${d}</td></tr>`);
  $("f10qB2O").innerHTML = (mon.length ? tab(["Alarm", "Condition", "States", "delay (ticks)"], mon, "f8-small") : `<p class="f8-pt">No monitors.</p>`) +
    `<p class="f8-pt"><b>Wires:</b> ${(md.wires || []).length ? md.wires.map(([a, b2]) => `<code>${esc(b2)} → ${esc(a)}</code>`).join(", ") + " (one tick delay)" : "none"}</p>
    <p class="f8-pt"><b>Keep (on in Stop, off in Abort):</b> ${(md.keep || []).length ? md.keep.map((x) => `<code>${esc(x)}</code>`).join(", ") : "none"}</p>
    <p class="f8-pt"><b>Cell controller script (normal):</b> ${md.cc.map(([c, s, k]) => `${c} in ${s}${k ? " from tick " + k : ""}`).join(" → ")}${md.ops ? ` · <b>operator actions:</b> ${md.ops.map(([k, ...a]) => `tick ${k}: ${esc(a.join(", "))}`).join("; ")}` : ""}</p>`;
  $("f10qB2P").innerHTML = D.inst.length ? tab(["Instance", "FB type", "Generic plant model + module parameters"], D.inst.map(([g, t, p]) => `<tr><td><b>${esc(g)}</b></td><td>${short(t)}</td><td>${esc(plantTxt(D, g, t, p))}</td></tr>`), "f8-small") : `<p class="f8-pt">No plant (software module).</p>`;
}

/* ================================================================== B3 module simulator */
function injList(m) {
  const L2 = [], D = m.D;
  D.inst.forEach(([g, t]) => {
    const pp = (D.md.plant || {})[g] || {};
    if (t === "FB_Valve1" || t === "FB_Valve2") L2.push({ g, lab: `${g}: cylinder jam`, key: "jam", on: "P " + g + ".jam=1", off: "P " + g + ".jam=0" });
    else if (t === "FB_MotorDol") L2.push({ g, lab: `${g}: motor protection trip`, key: "trip", on: "P " + g + ".trip=1", off: "P " + g + ".trip=0" });
    else if (t === "FB_DriveSto") L2.push({ g, lab: `${g}: drive fault`, key: "fault", on: "P " + g + ".fault=1", off: "P " + g + ".fault=0" });
    else if (t === "FB_Heater") L2.push({ g, lab: `${g}: over-temperature (thermostat)`, key: "overtemp", on: "P " + g + ".overtemp=1", off: "P " + g + ".overtemp=0" });
    else if (t === "FB_HandshakeHw") { L2.push({ g, lab: `${g}: partner dead (no answer)`, key: "dead", on: "P " + g + ".dead=1", off: "P " + g + ".dead=0" }); L2.push({ g, lab: `${g}: partner fault`, key: "fault", on: "P " + g + ".fault=1", off: "P " + g + ".fault=0" }); }
    else if (["FB_Estop", "FB_EnableSwitch", "FB_LightCurtain", "FB_SafetyCoupling", "FB_DoorLock"].includes(t) || (t === "FB_Door2Ch" && !("expr2" in pp))) {
      const w = { FB_Estop: "e-stop pressed", FB_EnableSwitch: "enable switch released", FB_LightCurtain: "light curtain interrupted", FB_SafetyCoupling: "neighbour e-stop / zone", FB_DoorLock: "guard door open", FB_Door2Ch: "door open" }[t];
      L2.push({ g, lab: `${g}: ${w}`, key: "ok", inv: true, on: "SAFE " + g + "=0", off: "SAFE " + g + "=1" });
    } else if (t === "FB_Sensor" && !("expr" in pp) && !("set" in pp)) { const v0 = pp.value || 0; L2.push({ g, lab: `${g}: sensor ${v0 ? "OFF" : "ON"} (e.g. level / filter / part)`, key: "value", base: v0, on: `P ${g}.value=${v0 ? 0 : 1}`, off: `P ${g}.value=${v0}` }); }
    else if (t === "FB_AnalogIn" && !("src" in pp)) {
      if ("expr" in pp) L2.push({ g, lab: `${g}: value low (${pp.v1} → ${Math.round(pp.v1 * 0.6 * 10) / 10})`, key: "v1", base: pp.v1, on: `P ${g}.v1=${Math.round(pp.v1 * 0.6 * 10) / 10}`, off: `P ${g}.v1=${pp.v1}` });
      else if (pp.value != null) L2.push({ g, lab: `${g}: value low (${pp.value} → ${Math.round(pp.value * 0.5 * 10) / 10})`, key: "value", base: pp.value, on: `P ${g}.value=${Math.round(pp.value * 0.5 * 10) / 10}`, off: `P ${g}.value=${pp.value}` });
    } else if (t === "FB_PushButton") L2.push({ g, lab: `${g}: operator presses the button`, pulse: [[0, `SET ${g}.xPb=1`], [1, `SET ${g}.xPb=0`]] });
    else if (t === "FB_TwoHand") L2.push({ g, lab: `${g}: operator two-hand start`, pulse: [[0, ...["xLeft", "xLeft2", "xRight", "xRight2"].map((x) => `SET ${g}.${x}=1`)], [5, ...["xLeft", "xLeft2", "xRight", "xRight2"].map((x) => `SET ${g}.${x}=0`)]] });
  });
  return L2;
}
const injActive = (m, x) => { if (x.pulse) return false; const v = m.pv[x.g][x.key]; return x.inv ? !v : x.base != null ? v !== x.base : !!v; };
function newLive() { S.live = new Module(S.simMod, [], [], 1e9, { trace: true }); S.k = null; }
function htmlB3() {
  return card("f10qB3", "B3 · Module simulator – the generic program running", "scenario or interactive · PackML · SFC · devices · plant · data block · alarms · log",
    intro(`<p>The generic program of B1 with the data of one module runs tick by tick against the generic plant. Choose a module and a scenario: <b>normal</b>
      (cell controller script Reset → Start → Reset), a <b>fault scenario</b> F1–F8 (where defined for the module) or <b>interactive</b>: you are the cell controller
      (send Reset, Start, Stop, Hold, Unhold, Abort, Clear) and you can break the plant (jam a valve, trip a motor, press the e-stop, open the curtain, level low,
      partner dead) and see how the program reacts.</p>
      <p class="phd-eq">Status.Bits = Ready·2⁰ + Busy·2¹ + Done·2² + Fault·2³ + Auto·2⁵ + CmdAck·2⁸ + CmdRej·2⁹</p>`) +
    `<div class="fe-row"><label>Module <select id="f10qB3M" class="fe-sel">${modOpts(S.simMod)}</select></label><label>Scenario <select id="f10qB3Sc" class="fe-sel"></select></label></div>
    <div class="fe-row" id="f10qB3Live"></div>
    <div class="fe-row"><button class="mx-el" id="f10qB3Prev">◀ tick</button><button class="mx-el" id="f10qB3Play">▶ Play</button><button class="mx-el" id="f10qB3Next">tick ▶</button>
      <label class="f9-scrub f9-scrubw">tick <input type="range" id="f10qB3K" min="0" max="399" step="1"></label><b id="f10qB3Kt"></b><button class="mx-el" id="f10qB3Re">jump to the reaction</button></div>
    <div id="f10qB3Now" class="f8-pt"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">PackML state</h3><div class="fe-scroll" id="f10qB3Pk"></div></div>
      <div><h3 class="fe-h3">Active sequence (SFC)</h3><div class="fe-scroll f10q-sfcbox" id="f10qB3Sf"></div></div></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Data block words</h3><div id="f10qB3Db"></div><h3 class="fe-h3">Active alarms</h3><div id="f10qB3Al"></div></div>
      <div><h3 class="fe-h3">Log (click a line = go to that tick)</h3><div id="f10qB3Log" class="f9-log f9-logT f10q-log"></div></div></div>
    <h3 class="fe-h3">Device FBs (outputs after the call of this tick)</h3><div id="f10qB3Dev" class="f10q-devs"></div>
    <h3 class="fe-h3">Plant (after the plant update of this tick)</h3><div id="f10qB3Pl" class="f10q-devs"></div>` +
    exBox("F1 at the abort tick (M02, tick 52)", `<p>Choose M02 · F1. At tick 52 the Rotate FB_Valve2 has waited 40 ticks (tMove 4000 ms) for its end position B – the plant shows the
      cylinder stuck at x = 18 of 30 with <b>jam</b> = 1. iAlarm = 1 → alarm <b>2011</b> class A (override) → AlarmNo = 2011, internal <b>Abort</b>. Data block:
      StateCurrent 8 (Aborting), Bits = Busy 2 + Fault 8 + Auto 32 = <b>42</b> = 0000101010₂. Next tick Aborted (9), every valve xEnable FALSE.</p>`) +
    useCase(`virtual commissioning before the machine exists: the PLC programmer runs every module against the test plant, provokes each alarm of the alarm list and
      checks the reaction – the same tests are repeated on the real machine (B7 checklist).`));
}
function fillScen() {
  const sel = $("f10qB3Sc"); if (!sel) return;
  const L2 = scenOf(S.simMod); if (!L2.includes(S.scen)) S.scen = "normal";
  sel.innerHTML = L2.map((s) => `<option value="${s}"${s === S.scen ? " selected" : ""}>${s === "normal" ? "normal cycle (cc: Reset → Start → Reset)" : s === "live" ? "interactive – you are the cell controller" : esc(fltById(s).name)}</option>`).join("");
  $("f10qB3M").value = S.simMod;
}
function reactTick(m) {
  const l = m.log.find((x) => /internal (Abort|Hold)|cmd \w+ rejected/.test(x)) || m.log.find((x) => / alarm ON /.test(x)) || m.log.find((x) => /state Complete /.test(x));
  return l ? tickOf(l) : m.trace.length - 1;
}
function initB3() {
  fillScen();
  $("f10qB3M").addEventListener("change", () => { stopPlay("b3"); S.simMod = $("f10qB3M").value; store.set("bSim", S.simMod); S.k = null; if (S.scen === "live") newLive(); fillScen(); drawB3(); });
  $("f10qB3Sc").addEventListener("change", () => { stopPlay("b3"); S.scen = $("f10qB3Sc").value; store.set("bScen", S.scen); S.k = null; if (S.scen === "live") newLive(); drawB3(); });
  $("f10qB3K").addEventListener("input", () => { S.k = +$("f10qB3K").value; drawB3(); });
  $("f10qB3Prev").addEventListener("click", () => { S.k = Math.max(0, curK() - 1); drawB3(); });
  $("f10qB3Next").addEventListener("click", () => { if (S.scen === "live" && curK() >= S.live.trace.length - 1) { S.live.tick(); S.k = null; } else S.k = curK() + 1; drawB3(); });
  $("f10qB3Re").addEventListener("click", () => { if (S.scen === "live") return; S.k = reactTick(runOf(S.simMod, S.scen)); drawB3(); });
  $("f10qB3Play").addEventListener("click", () => {
    if (timers.b3) { stopPlay("b3"); $("f10qB3Play").textContent = "▶ Play"; return; }
    $("f10qB3Play").textContent = "❚❚ Pause";
    timers.b3 = setInterval(() => {
      if (!document.getElementById("f10qB3K")) return stopPlay("b3");
      if (S.scen === "live") { S.live.tick(); S.k = null; if (S.live.trace.length > 3000) { stopPlay("b3"); $("f10qB3Play").textContent = "▶ Play"; } }
      else { const n = runOf(S.simMod, S.scen).trace.length; S.k = curK() + 1; if (S.k >= n - 1) { S.k = n - 1; stopPlay("b3"); $("f10qB3Play").textContent = "▶ Play"; } }
      drawB3();
    }, 90);
  });
  $("f10qB3Log").addEventListener("click", (e) => { const d = e.target.closest("[data-k]"); if (!d) return; S.k = +d.dataset.k; drawB3(); });
  $("f10qB3Live").addEventListener("click", (e) => {
    const m = S.live; if (!m) return;
    const c = e.target.closest("[data-cmd]"), j = e.target.closest("[data-inj]"), n = e.target.closest("[data-run]");
    if (c) { m.userQ.push(c.dataset.cmd); m.tick(); S.k = null; }
    else if (j) {
      const x = injList(m)[+$("f10qBInj").value]; if (!x) return; S.inj = +$("f10qBInj").value;
      if (x.pulse) x.pulse.forEach(([dk, ...ev]) => m.events.push([m.k + dk, ...ev])); else m.events.push([m.k, injActive(m, x) ? x.off : x.on]);
      m.tick(); S.k = null;
    } else if (n) { if (n.dataset.run === "new") newLive(); else for (let i = 0; i < +n.dataset.run; i++) m.tick(); S.k = null; }
    else return;
    drawB3();
  });
  $("f10qB3Live").addEventListener("change", (e) => { if (e.target.id === "f10qBInj") { S.inj = +e.target.value; drawB3(); } });
  if (S.scen === "live") newLive();
  drawB3();
}
const curK = () => { const m = runOf(S.simMod, S.scen); const n = m.trace.length; return S.k == null ? (S.scen === "live" ? n - 1 : reactTick(m)) : Math.min(Math.max(0, S.k), Math.max(0, n - 1)); };
function drawLiveBar(m) {
  const box = $("f10qB3Live");
  if (S.scen !== "live") { box.innerHTML = ""; box.hidden = true; return; }
  box.hidden = false;
  const inj = injList(m); if (S.inj >= inj.length) S.inj = 0; const x = inj[S.inj];
  box.innerHTML = `<span class="f8-pt"><b>Cell controller:</b></span>${["Reset", "Start", "Stop", "Hold", "Unhold", "Abort", "Clear"].map((c) => `<button class="mx-el f10-pb" data-cmd="${c}">${c}</button>`).join("")}
    <span class="f8-pt"><b>Plant / operator:</b></span>${inj.length ? `<select id="f10qBInj" class="fe-sel">${inj.map((y, i) => `<option value="${i}"${i === S.inj ? " selected" : ""}>${esc(y.lab)}${injActive(m, y) ? " (ACTIVE)" : ""}</option>`).join("")}</select>
    <button class="mx-el f10-pb" data-inj="1">${x.pulse ? "do it" : injActive(m, x) ? "remove fault" : "inject fault"}</button>` : `<span class="sub">no plant faults for this module</span>`}
    <button class="mx-el f10-pb" data-run="1">+1 tick</button><button class="mx-el f10-pb" data-run="10">+10 ticks</button><button class="mx-el f10-pb" data-run="new">new start</button>`;
}
function drawB3() {
  if (!$("f10qB3K")) return;
  if (S.scen === "live" && !S.live) newLive();
  const m = runOf(S.simMod, S.scen), D = m.D; drawLiveBar(m);
  const tr = m.trace;
  if (!tr.length) {
    $("f10qB3K").max = 0; $("f10qB3K").value = 0; $("f10qB3Kt").textContent = "–";
    $("f10qB3Now").innerHTML = "Interactive: press <b>Reset</b> (the module starts in Stopped), then <b>Start</b>. Each button runs one tick; +10 ticks or Play runs on.";
    $("f10qB3Pk").innerHTML = svgPackB("Stopped", null, "f10qP3"); $("f10qB3Sf").innerHTML = svgSfc(D, "home", null, "f10qS3");
    ["f10qB3Db", "f10qB3Al", "f10qB3Log", "f10qB3Dev", "f10qB3Pl"].forEach((id) => { $(id).innerHTML = ""; }); return;
  }
  const k = curK(), q = tr[k], pq = k > 0 ? tr[k - 1] : null;
  $("f10qB3K").max = tr.length - 1; $("f10qB3K").value = k; $("f10qB3Kt").textContent = `${k} (${(k / 10).toFixed(1)} s)`;
  $("f10qB3Now").innerHTML = `<b>${D.code} ${D.unit}</b> · state <b>${q.state}</b> (${ST[q.state]}) · sequence ${q.seq ? `<b>${q.seq}</b> step <b>${q.step != null ? "S" + q.step : "S0 (end)"}</b> t = ${q.t}` : "–"} · top alarm class <b>${q.top}</b>${q.lines.length ? ` · this tick: <i>${esc(q.lines.map((l) => l.replace(/^\d+ /, "")).join(" · "))}</i>` : ""}`;
  $("f10qB3Pk").innerHTML = svgPackB(q.state, pq ? pq.state : null, "f10qP3");
  const seq = q.seq || (SEQ[q.state] || "home");
  $("f10qB3Sf").innerHTML = `<div class="f8-pt">sequence <b>${seq}</b>${q.state === "Held" || q.state === "Holding" ? " – <b>frozen</b> (Hold)" : ""}</div>` + svgSfc(D, seq, q.seq ? (q.step != null ? q.step : null) : null, "f10qS3");
  const db = q.db, bits = bin(db.Bits, 10);
  const bitN = ["Ready", "Busy", "Done", "Fault", "–", "Auto", "–", "–", "CmdAck", "CmdRej"];
  $("f10qB3Db").innerHTML = tab(["Word", "Value", "Meaning"], [
    `<tr><td>StateCurrent</td><td><b>${db.State}</b></td><td>${q.state}</td></tr>`,
    `<tr><td>AlarmNo</td><td><b>${db.AlarmNo}</b></td><td>${db.AlarmNo ? esc(D.alarmText(db.AlarmNo)) + " " + clsTag(D.alarmClass(db.AlarmNo)) : "no class A/B alarm"}</td></tr>`,
    `<tr><td>WarningNo</td><td><b>${db.WarningNo}</b></td><td>${db.WarningNo ? (db.WarningNo % 1000 >= 900 ? "command rejected: " + (["", "Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"][db.WarningNo % 1000 - 900] || "") : esc(D.alarmText(db.WarningNo))) : "–"}</td></tr>`,
    `<tr><td>Status.Bits</td><td><b>${db.Bits}</b></td><td><span class="f10q-bits">${bits.split("").map((c, i) => `<span class="${c === "1" ? "f10q-b1" : ""}" title="bit ${9 - i} ${bitN[9 - i]}">${c}</span>`).join("")}</span> ₂ ${bitN.map((n, i) => ((db.Bits >> i) & 1 ? `b${i} ${n}` : "")).filter(Boolean).join(", ")}</td></tr>`,
    `<tr><td>CntrlCmd / CCR</td><td><b>${db.CntrlCmd}</b> / ${db.CCR ? 1 : 0}</td><td>${db.CntrlCmd ? (["", "Reset", "Start", "Stop", "Hold", "Unhold", "Suspend", "Unsuspend", "Abort", "Clear"][db.CntrlCmd]) + " requested" : "no request"}</td></tr>`,
  ], "f8-small");
  $("f10qB3Al").innerHTML = q.act.length ? tab(["No", "Class", "Text", "order"], q.act.slice().sort((a, b) => a[1] - b[1]).map(([n, o]) => `<tr${n === db.AlarmNo ? ' class="f10-chosen"' : ""}><td><b>${n}</b></td><td>${clsTag(D.alarmClass(n))}</td><td>${esc(D.alarmText(n))}</td><td>${o}</td></tr>`), "f8-small") : `<p class="f8-pt">No active alarm.</p>`;
  const lg = $("f10qB3Log");
  lg.innerHTML = m.log.map((l) => { const t = tickOf(l); return `<div data-k="${t}" class="${t === k ? "f9-lnow" : t > k ? "f9-lfut" : ""}">${esc(l)}</div>`; }).join("");
  const nowEl = lg.querySelector(".f9-lnow") || [...lg.querySelectorAll("[data-k]")].reverse().find((d) => +d.dataset.k <= k);
  if (nowEl) lg.scrollTop = Math.max(0, nowEl.offsetTop - lg.offsetTop - 60);
  $("f10qB3Dev").innerHTML = D.inst.map(([g, t]) => {
    const o = q.fo[g], cmd = q.cmd[g] || {};
    return `<div class="f10q-dev${o.iAlarm ? " f10q-devErr" : ""}"><div><b>${esc(g)}</b> <span class="sub">${short(t)}</span></div><div class="f10q-sig">${Object.entries(o).map(([n, v]) => (typeof v === "boolean" ? `<span><span class="f9-led${v ? (n === "xError" || n === "xDiscErr" ? " f9-on f10-ledR" : " f9-on") : ""}"></span> ${n}</span>` : `<span>${n} <b class="${n === "iAlarm" && v ? "f9-bad" : ""}">${fmtV(v)}</b></span>`)).join("")}</div>${Object.keys(cmd).length ? `<div class="f10q-cmd">cmd: ${Object.entries(cmd).map(([n, v]) => `${n}=${fmtV(v)}`).join(" ")}</div>` : ""}</div>`;
  }).join("") || `<p class="f8-pt">No device FBs.</p>`;
  $("f10qB3Pl").innerHTML = D.inst.filter(([g]) => Object.keys(q.pv[g]).length).map(([g, t, p]) => {
    const v = q.pv[g], pp = (D.md.plant || {})[g] || {}; let body = "";
    if (t === "FB_Valve1" || t === "FB_Valve2") { const T0 = pp.T != null ? pp.T : 10; body = bar(v.x, T0) + ` x = <b>${v.x}</b> / ${T0}${t === "FB_Valve2" ? ` · spool <b>${v.spool}</b>` : ""}${v.jam ? ' · <b class="f9-bad">JAM</b>' : ""}`; }
    else if (t === "FB_DriveSto") { const Lm = pp.L != null ? pp.L : 20; body = bar(v.pos, Lm) + ` pos <b>${v.pos}</b> / ${Lm} · dir ${v.dir > 0 ? "+" : "−"} · ${v.running ? "<b>running</b>" : "stopped"}${v.fault ? ' · <b class="f9-bad">FAULT</b>' : ""}`; }
    else if (t === "FB_Heater") body = `temperature <b>${fmtV(v.temp)} °C</b>${v.overtemp ? ' · <b class="f9-bad">OVER-TEMP</b>' : ""}`;
    else if (t === "FB_HandshakeHw") body = `partner phase <b>${v.ph}</b> (n ${v.n})${v.dead ? ' · <b class="f9-bad">DEAD</b>' : ""}${v.fault ? ' · <b class="f9-bad">FAULT</b>' : ""}${p === "PARTNER" ? " · bus partner" : ""}`;
    else if (t === "FB_MotorDol") body = `run counter <b>${v.run}</b>${v.trip ? ' · <b class="f9-bad">TRIPPED</b>' : ""}`;
    else if (t === "FB_Sensor") body = `value <b>${fmtV(v.value)}</b> · latch ${fmtV(v.latch)}${"expr" in pp ? ` · expr ${esc(pp.expr)}` : ""}`;
    else if (t === "FB_AnalogIn") body = `${"src" in pp ? "from " + esc(pp.src) : "expr" in pp ? `v1 ${fmtV(v.v1)} / v0 ${fmtV(v.v0)} · n ${v.n}` : `value <b>${fmtV(v.value)}</b>`} · FB rValue <b>${fmtV(q.fo[g].rValue)}</b>`;
    else if ("ok" in v) body = v.ok ? "healthy (channels TRUE)" : '<b class="f9-bad">TRIPPED (channels FALSE)</b>';
    return `<div class="f10q-dev"><div><b>${esc(g)}</b> <span class="sub">${short(t)}</span></div><div class="f10q-sig">${body}</div></div>`;
  }).join("") || `<p class="f8-pt">No plant variables.</p>`;
}
const bar = (v, mx) => `<span class="f10q-bar"><span style="width:${Math.round(100 * v / (mx || 1))}%"></span></span>`;

/* ================================================================== B4 fault explainer */
function svgBand(m, K, id) {
  const W = 640, x0 = 16, w = 604, X = (k) => x0 + (k / K) * w; let b = "";
  const grp = (s) => (s === "Execute" ? "f10q-sE" : ["Holding", "Held", "Unholding"].includes(s) ? "f10q-sH" : ["Aborting", "Aborted", "Clearing"].includes(s) ? "f10q-sA" : ["Idle", "Complete", "Completing", "Starting"].includes(s) ? "f10q-sI" : "f10q-sS");
  let s0 = 0; const tr = m.trace;
  for (let k = 1; k <= tr.length; k++) if (k === tr.length || tr[k].state !== tr[s0].state) { b += `<rect x="${X(s0).toFixed(1)}" y="30" width="${Math.max(0.8, X(k) - X(s0)).toFixed(1)}" height="22" class="${grp(tr[s0].state)}"><title>${tr[s0].state} ${s0}–${k - 1}</title></rect>`; s0 = k; }
  m.log.forEach((l) => {
    const k = tickOf(l), x = X(k).toFixed(1);
    if (/ event /.test(l)) b += `<path d="M${x} 28l-4 -7h8z" class="f10q-mEv"><title>${esc(l)}</title></path>`;
    else if (/ alarm ON /.test(l)) b += `<line x1="${x}" y1="24" x2="${x}" y2="58" class="f10q-mAl"><title>${esc(l)}</title></line>` + T(+x + 3, 16, esc(l.split(" ")[3]), "start", "f9-xs");
    else if (/ cc sends /.test(l)) b += `<circle cx="${x}" cy="62" r="2.6" class="f10q-mCc"><title>${esc(l)}</title></circle>`;
  });
  for (let k = 0; k <= K; k += 50) b += L(X(k), 66, X(k), 70, "f9-axis") + T(X(k), 80, String(k), "middle", "f9-xs");
  b += T(x0, 94, "green Execute · yellow Hold · red Abort/Clear · blue Idle/Starting/Complete · grey Stopped/Resetting · ▼ event · | alarm ON · • cc command", "start", "f9-xs");
  return svg(W, 100, b, "f10q-band", "State timeline " + id);
}
function htmlB4() {
  return card("f10qB4", "B4 · Fault scenarios F1–F8 explained", "what happened · why this class and reaction · what the operator does",
    intro(`<p>Eight fault scenarios run on the same generic program. Each one shows one rule of the alarm concept (decisions D2, D3 of part A):</p>
      <p class="phd-eq">class A → internal Abort (in every state except Aborting / Aborted / Clearing) · class B → internal Hold (only in Execute) · class C → warning, no reaction</p>
      <p>Recovery: after <b>Abort</b> always Clear → Stopped → Reset (homing!) → Start; after <b>Hold</b> fix the cause and Unhold – the frozen step continues with t = 0.</p>`) +
    `<div class="mx-nav" id="f10qB4Sel">${FAULTS.map((f) => `<button class="mx-el" data-f="${faultId(f)}">${faultId(f)} · ${f.module}</button>`).join("")}</div>
    <div id="f10qB4Out"></div>` +
    useCase(`training of operators and maintenance people: each scenario is one page of the machine manual ('the washer stops with 10004 – refill, Clear, Reset'),
      and the same list becomes the fault test list of the factory acceptance test.`));
}
function initB4() {
  $("f10qB4Sel").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b) return; S.flt = b.dataset.f; store.set("bFlt", S.flt); drawB4(); });
  $("f10qB4Out").addEventListener("click", (e) => {
    if (!e.target.closest("[data-sim]")) return;
    const f = fltById(S.flt); S.simMod = f.module; S.scen = S.flt; S.k = reactTick(runOf(f.module, S.flt)); fillScen(); drawB3();
    $("f10qB3").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  drawB4();
}
function drawB4() {
  if (!$("f10qB4Out")) return;
  const f = fltById(S.flt) || FAULTS[0], id = faultId(f), m = runOf(f.module, id), X = FAULT10B[id] || {}, D = m.D;
  document.querySelectorAll("#f10qB4Sel [data-f]").forEach((b) => b.classList.toggle("active", b.dataset.f === id));
  const key = m.log.filter((l) => / event | alarm | internal |cmd |clear failed/.test(l));
  const rt = reactTick(m);
  $("f10qB4Out").innerHTML = `<h3 class="fe-h3">${esc(f.name)}</h3>` +
    kpis([["module", `${f.module} ${D.unit}`], ["ticks", f.K], ["reaction at tick", rt], ["final state", m.state], ["AlarmNo / WarningNo", `${m.db.AlarmNo} / ${m.db.WarningNo}`], ["log lines", m.log.length]]) +
    `<div class="fe-scroll">${svgBand(m, f.K, id)}</div>
    <div class="grid2 eq"><div><div class="f10-dec"><h4 class="fe-h3">What happened</h4><p class="f8-pt">${X.what || ""}</p></div>
      <div class="f10-dec"><h4 class="fe-h3">Why this class and reaction</h4><p class="f8-pt">${X.why || ""}</p></div>
      <div class="f10-dec"><h4 class="fe-h3">Operator / maintenance action</h4><p class="f8-pt">${X.action || ""}</p></div>
      <p><button class="mx-el" data-sim="1">Open in the simulator (B3) at tick ${rt}</button></p></div>
      <div><h4 class="fe-h3">Key log lines (events, alarms, commands, reactions)</h4><div class="f9-log">${key.map((l) => `<div class="${/internal|rejected|failed/.test(l) ? "f9-lnow" : ""}">${esc(l)}</div>`).join("")}</div>
      <p class="f8-pt">Scenario: events ${f.events.length ? f.events.map(([k, ...a]) => `tick ${k}: ${esc(a.join(", "))}`).join(" · ") : "none"} · cell controller ${f.cc.map(([c, s, k]) => `${c} in ${s}${k ? " ≥ " + k : ""}`).join(" → ")}</p></div></div>`;
}

/* ================================================================== B5 generated ST + ALARMS.csv */
function htmlB5() {
  return card("f10qB5", "B5 · Generated PLC source – FB_Module_&lt;unit&gt;.st and ALARMS.csv", "code generator output · alarm list for HMI / SCADA",
    intro(`<p>The module data is not only simulated: a <b>code generator</b> (tools/fmse) writes one IEC 61131-3 Structured Text function block per module,
      <code>FB_Module_&lt;unit&gt;.st</code>, with the instances, the step sequences as CASE statements, the alarm table and the data-block mapping – plus one
      <code>ALARMS.csv</code> for the whole kit that the HMI / SCADA imports (number, module, text, class). Same data → simulator, PLC code and HMI texts can never differ.</p>
      <p class="phd-eq">one source (module data) → { simulation (this page), PLC code (.st), HMI alarm list (.csv), guide tables }</p>`) +
    `<div class="fe-row"><label>File <select id="f10qB5F" class="fe-sel"><option>loading …</option></select></label><span id="f10qB5Info" class="f8-pt"></span></div>
    <div id="f10qB5Src"></div>
    <h3 class="fe-h3">ALARMS.csv</h3><div class="fe-row"><label>Filter <input id="f10qB5Q" class="fe-sel" placeholder="module, number or text"></label><button class="mx-el" id="f10qB5Dl">download CSV (computed from the data)</button><span id="f10qB5N" class="f8-pt"></span></div>
    <div id="f10qB5A"></div>` +
    exBox("reading one generated step", `<p>The SFC step <b>S20</b> of M02 (do Rotate.xCmdB := 1, wait Rotate.xAtB, to 50, al 3) becomes in ST roughly:
      <code>20: Rotate.xCmdB := TRUE; IF Rotate.xAtB THEN step := 30; t := 0; ELSIF t &gt;= 50 THEN SetModAlarm(3); END_IF;</code> – the generic engine of this page and the
      generated code implement the same rule, the logs are compared line by line.</p>`) +
    useCase(`the PLC supplier receives the generated .st files + ALARMS.csv as the starting point; changes are made in the module data and regenerated, never by hand in the .st – so the
      documentation, the simulation model and the PLC stay identical through commissioning.`));
}
function parseCsv(txt) {
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === "," || c === ";") { row.push(cell); cell = ""; } else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; } else if (c !== "\r") cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x !== ""));
}
const computedAlarms = () => { const rows = [["number", "module", "unit", "instance", "fb_type", "local", "text", "class", "reaction"]]; CODES10B.forEach((c) => { const D = moduleDesc(c); D.table.forEach((r) => rows.push([r.no, c, D.unit, r.inst, r.type, r.a, r.text, r.cls, CLS_R[r.cls].split(" – ")[0]])); }); return rows; };
function initB5() {
  import("./fmse10b_st.js").then((mod) => {
    S.stFiles = mod.ST10B || {}; S.alarmsCsv = mod.ALARMS10B || "";
    const files = Object.keys(S.stFiles);
    const sel = $("f10qB5F");
    if (!files.length) {
      sel.innerHTML = `<option>(no generated files yet)</option>`; sel.disabled = true;
      $("f10qB5Src").innerHTML = `<p class="f8-pt am-note"><b>Not generated yet.</b> The files <code>tools/fmse/plc_modules/FB_Module_&lt;unit&gt;.st</code> do not exist on this PC yet. Run the code
        generator of tools/fmse, then the embedding step (web/fmse10b_st.js is generated from that folder, because the offline web server serves only web/). Until then the
        alarm list below is computed from the module data (same numbers, texts and classes).</p>`;
    } else {
      if (!S.stMod || !files.includes(S.stMod)) S.stMod = files.find((x) => x.includes(moduleDesc("M02").unit)) || files[0];
      sel.innerHTML = files.map((x) => `<option value="${esc(x)}"${x === S.stMod ? " selected" : ""}>${esc(x)}.st</option>`).join("");
      sel.addEventListener("change", () => { S.stMod = sel.value; store.set("bSt", S.stMod); drawB5(); });
    }
    drawB5(); drawB5A();
  }).catch((e) => { console.error("fmse10b B5", e); $("f10qB5Src").textContent = "could not load fmse10b_st.js: " + e.message; drawB5A(); });
  $("f10qB5Q").addEventListener("input", drawB5A);
  $("f10qB5Dl").addEventListener("click", () => csvDownload("ALARMS_computed.csv", computedAlarms()));
}
function drawB5() {
  const files = Object.keys(S.stFiles || {}); if (!files.length || !S.stMod) { $("f10qB5Info").textContent = `${files.length} files`; return; }
  const txt = S.stFiles[S.stMod] || "";
  $("f10qB5Info").innerHTML = `${files.length} generated files · this one ${txt.split("\n").length} lines, ${txt.length} characters`;
  $("f10qB5Src").innerHTML = pre(txt, "f10qB5Code", "f9-gencode f10q-code");
}
function drawB5A() {
  const csv = S.alarmsCsv ? parseCsv(S.alarmsCsv) : computedAlarms(), head = csv[0], body = csv.slice(1), qv = ($("f10qB5Q").value || "").toLowerCase().trim();
  const rows = body.filter((r) => !qv || r.join(" ").toLowerCase().includes(qv));
  $("f10qB5N").innerHTML = `${S.alarmsCsv ? "file ALARMS.csv" : "computed from the data"} · ${rows.length} of ${body.length} rows`;
  const ci = head.findIndex((h) => /^class$/i.test(h));
  $("f10qB5A").innerHTML = `<div class="f10q-tall">${tab(head.map(esc), rows.slice(0, 400).map((r) => `<tr>${r.map((c, i) => `<td>${i === ci && /^[ABC]$/.test(c) ? clsTag(c) : esc(c)}</td>`).join("")}</tr>`), "f8-small")}</div>${rows.length > 400 ? `<p class="f8-pt">first 400 rows shown – use the filter.</p>` : ""}`;
}

/* ================================================================== B6 statistics */
function htmlB6() {
  return card("f10qB6", "B6 · Cycle time and alarm statistics per module", "normal scenario · ticks Start → Complete · steps · alarms · kit totals",
    intro(`<p>From the <b>normal scenario</b> of every module (cell controller: Reset → Start → Reset) we read the cycle time and count the program size.
      Continuous modules (utilities, safety, network, PC) stay in Execute – they have no cycle.</p>
      <p class="phd-eq">t<sub>cycle</sub> = (k<sub>Complete</sub> − k<sub>Start accepted</sub>) × 100 ms &nbsp; · &nbsp; t<sub>home</sub> = (k<sub>Idle</sub> − k<sub>Reset accepted</sub>) × 100 ms</p>
      <p class="phd-eq">alarms of a module = module alarms + Σ<sub>instances</sub> library alarms of the FB type</p>`) +
    `<div id="f10qB6K"></div><div class="fe-scroll" id="f10qB6C"></div><div id="f10qB6T"></div>` +
    exBox("M02 and M10", `<p>M02: Start accepted at tick 2, Complete at tick 56 → 54 ticks = <b>5.4 s</b> (simulated plant: clamp open 9 ticks, rotate 31 ticks, clamp close + pressure 12 ticks).
      M10 washer: 10 s heating in Starting (the bath starts at 55 °C, +0.5 °C per tick to 58 °C) – a real washer cycle is minutes; the plant is shortened, the
      <b>structure</b> (number of steps, order, time-outs) is what is tested here.</p>`) +
    useCase(`the alarm count per module is the input of the HMI alarm-text translation effort and the FAT test effort (one fault test per class A/B alarm, see B7); the cycle
      times of the test plant check that no step waits longer than its time-out.`));
}
function initB6() {
  const st = CODES10B.map(stats), tot = { inst: 0, steps: 0, alarms: 0, A: 0, B: 0, C: 0, mon: 0 };
  st.forEach((x) => { tot.inst += x.inst; tot.steps += x.steps; tot.alarms += x.alarms; tot.A += x.clsA; tot.B += x.clsB; tot.C += x.clsC; tot.mon += x.monitors; });
  S.stats = { st, tot };
  $("f10qB6K").innerHTML = kpis([["module types", st.length], ["FB instances (1 of each)", tot.inst], ["steps", tot.steps], ["alarms defined", tot.alarms], ["class A / B / C", `${tot.A} / ${tot.B} / ${tot.C}`], ["monitors", tot.mon]]);
  const cyc = st.filter((x) => !x.cont), mx = Math.max(...cyc.map((x) => x.cycle)), H = 18 * st.length + 30; let b = "";
  st.forEach((x, i) => {
    const y = 8 + i * 18; b += T(4, y + 12, `${x.code} ${x.unit}`, "start", "f9-xs");
    if (x.cont) b += T(132, y + 12, "continuous – stays in Execute", "start", "f9-xs");
    else { const w = 420 * x.cycle / mx; b += RC(130, y + 2, w, 13, "f10q-barC", 2) + T(134 + w, y + 12, `${(x.cycle / 10).toFixed(1)} s (${x.cycle} ticks)`, "start", "f9-xs"); }
  });
  b += T(130, H - 4, "cycle time Start → Complete in the test plant (normal scenario)", "start", "f9-xs");
  $("f10qB6C").innerHTML = svg(640, H, b, "f10q-cyc", "cycle times per module");
  $("f10qB6T").innerHTML = tab(["Module", "Unit", "Title", "FB inst.", "steps h/s/e", "home t", "cycle t", "alarms", "A", "B", "C", "monitors", "wires", "log lines"],
    st.map((x) => `<tr><td><b>${x.code}</b></td><td>${x.unit}</td><td>${esc(x.title)}</td><td>${x.inst}</td><td>${x.home}/${x.start}/${x.exec}</td><td>${x.homeT != null ? (x.homeT / 10).toFixed(1) + " s" : "–"}</td><td>${x.cont ? "continuous" : (x.cycle / 10).toFixed(1) + " s"}</td><td><b>${x.alarms}</b></td><td>${x.clsA}</td><td>${x.clsB}</td><td>${x.clsC}</td><td>${x.monitors}</td><td>${x.wires}</td><td>${x.lines}</td></tr>`)
      .concat([`<tr class="f10-chosen"><td colspan="3"><b>kit (1 of each type)</b></td><td>${tot.inst}</td><td>${tot.steps}</td><td></td><td></td><td>${tot.alarms}</td><td>${tot.A}</td><td>${tot.B}</td><td>${tot.C}</td><td>${tot.mon}</td><td></td><td></td></tr>`]), "f8-small");
}

/* ================================================================== B7 commissioning checklist */
function checklist(code) {
  const D = moduleDesc(code), md = D.md, rows = [];
  D.inst.forEach(([g, t], ix) => (CHK10B[t] || ["IO signals checked one by one"]).forEach((x, j) => rows.push({ id: `io${ix}.${j}`, grp: "1 IO and device check", txt: `${g} (${short(t)}): ${x}` })));
  ["home", "start", "exec"].forEach((q) => (md[q] || []).forEach((st) => rows.push({ id: `st.${q}.${st.s}`, grp: "2 Step test (single step / slow run)", txt: `${q} S${st.s}: ${doTxt(st).join(", ") || "no command"} → expect '${st.wait}'${st.to ? ` within ${st.to} ticks (${(st.to / 10).toFixed(1)} s), else alarm ${D.M * 1000 + st.al}` : ""}${st.skip_if ? ` (skipped if '${st.skip_if}')` : ""}` })));
  D.table.forEach((r) => rows.push({ id: `al.${r.no}`, grp: "3 Fault tests (provoke every alarm)", txt: `${r.no} ${r.text} → class ${r.cls}: ${CLS_R[r.cls]}; AlarmNo/WarningNo and HMI text checked` }));
  [["Start in Stopped", `CmdRej, WarningNo ${D.M * 1000 + 902}`], ["Reset in Stopped", "homing, then Idle (Bits 33)"], ["Start in Idle", "Execute, cycle runs"], ["Hold in Execute, then Unhold", "step frozen, continues with t = 0"], ["Stop in Execute", "Stopped, commands safe (keep only in Stop)"], ["Abort, Clear, Reset", "Aborted → Stopped → Idle"]]
    .forEach(([a, b2], j) => rows.push({ id: `cc.${j}`, grp: "4 Command interface test (with the cell controller)", txt: `${a} → ${b2}` }));
  return rows;
}
function htmlB7() {
  return card("f10qB7", "B7 · Commissioning checklist generator", "IO check · step test · fault tests from the alarm table · command test",
    intro(`<p>The checklist is <b>generated</b> from the module data: one IO / device check per FB instance (from the FB type), one step test per SFC step, one fault test
      per alarm of the alarm table and the command tests of the PackML interface. Tick the items during commissioning; the state is kept in this browser.</p>
      <p class="phd-eq">items = Σ<sub>instances</sub> checks(FB type) + steps + alarms + 6 command tests</p>`) +
    `<div class="fe-row"><label>Module <select id="f10qB7M" class="fe-sel">${modOpts(S.chkMod)}</select></label><b id="f10qB7P"></b><button class="mx-el" id="f10qB7Clr">clear ticks</button><button class="mx-el" id="f10qB7Dl">download CSV</button></div>
    <div id="f10qB7L"></div>` +
    exBox("M02 checklist", `<p>M02 has 5 instances (Rotate, Clamp valves, 2 pallet sensors, clamp pressure), 4 steps, the module alarms 2001–2004 and the library alarms of the
      instances – every alarm is provoked once (e.g. jam the rotate → 2011 class A → Abort; close the pressure regulator → 2004 class B → Hold).</p>`) +
    useCase(`the commissioning engineer prints the list for the site acceptance test; the customer signs every line – the list is complete by construction because it comes from the same data as the PLC program.`));
}
function initB7() {
  $("f10qB7M").addEventListener("change", () => { S.chkMod = $("f10qB7M").value; store.set("bChkMod", S.chkMod); drawB7(); });
  $("f10qB7L").addEventListener("change", (e) => { const c = e.target.closest("[data-ck]"); if (!c) return; const d = S.chk[S.chkMod] || (S.chk[S.chkMod] = {}); if (c.checked) d[c.dataset.ck] = 1; else delete d[c.dataset.ck]; store.set("bChk", S.chk); progB7(); });
  $("f10qB7Clr").addEventListener("click", () => { delete S.chk[S.chkMod]; store.set("bChk", S.chk); drawB7(); });
  $("f10qB7Dl").addEventListener("click", () => { const d = S.chk[S.chkMod] || {}; csvDownload(`checklist_${S.chkMod}.csv`, [["group", "id", "check", "done"], ...checklist(S.chkMod).map((r) => [r.grp, r.id, r.txt, d[r.id] ? "x" : ""])]); });
  drawB7();
}
function drawB7() {
  const rows = checklist(S.chkMod), d = S.chk[S.chkMod] || {}; let g = "", h = "";
  rows.forEach((r) => { if (r.grp !== g) { h += (g ? "</div>" : "") + `<h4 class="fe-h3">${r.grp}</h4><div class="f10q-chk">`; g = r.grp; } h += `<label><input type="checkbox" data-ck="${esc(r.id)}"${d[r.id] ? " checked" : ""}> ${esc(r.txt)}</label>`; });
  $("f10qB7L").innerHTML = h + (g ? "</div>" : ""); S.chkCount = rows.length; progB7();
}
function progB7() { const b = [...document.querySelectorAll("#f10qB7L [data-ck]")]; $("f10qB7P").textContent = `${b.filter((x) => x.checked).length} / ${b.length} done`; }
