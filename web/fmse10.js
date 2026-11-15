/* FMS engineering – item 10 part A: PLC program standard + device function-block library.  Loaded by fmse.js (build "10").
 * 10A program standard · 10B the 4 decisions (D1 echo animation) · 10C one writer per word + alarm numbers · 10D FB library browser
 * 10E FB test bench (19 unit tests + live FB) · 10F valve lab · 10G safety mirror FBs · 10H command interface FB_CmdIf.
 * 10I–10N (alarm manager, signal tower, library engineering, commissioning tests, use cases, checklists) live in fmse10y.js.
 * Engine: fmse10x.js (rules = EX10A._rules of tools/fmse/examples/item10a_examples.json, exactly; FB_MotorDol / FB_AnalogIn from fmse9x.js).
 * Parts B (module programs M01–M22) and C (cell controller + virtual commissioning) follow.
 * Offline; user choices in localStorage "fmse.10.*". Test hook: window.fe10.results() (always from the JSON). */
import { $, esc, ul, card, tab, kpis, intro, useCase } from "./fmse8x.js";
import { exBox, pre } from "./fmse9x.js";
import {
  EX10A, EX9, DT, FBS, newFB, runTest, fmt, same, allowedWhy, STATES, SN, CMDS, CN, MODES10, MODE_N, almNo, usage, FBT9, DEVICE_TYPES, CODES, MODS,
  allResults, refLines, store10 as store, L, T, RC, svg, arrowDefs, ifOf, isBoolName, timingSvg, liveWidget, motor, M_ALM,
} from "./fmse10x.js";
import { TASKS10, NAMING10, STRUCT10, LIB_INFO, WRAP, IF_EXTRA, ALM10, ECHO_ACC, ECHO_REJ } from "./fmse10_data.js";
import { BLOCK, EXTRA } from "./fmse6_data.js";
import * as Y from "./fmse10y.js";

const R = { errors: [] };
const S = {
  echoV: store.get("echoV", "acc"), echoP: 0, almMod: store.get("almMod", "M02"), almI: 1, almA: 1, almDec: 2011, dbMod: store.get("dbMod", "M03"),
  lib: store.get("lib", "FB_Valve2"), test: store.get("test", 1), tk: null, live: store.get("live", "FB_Valve1"), safe: store.get("safe", "FB_Safe2Ch"),
  safeK: null, cmode: store.get("cmode", 1), ccell: null, c1k: null,
};
const timers = {};
const stopPlay = (k) => { if (timers[k]) { clearInterval(timers[k]); timers[k] = null; } };
const testCache = {};
export const testOf = (i) => testCache[i] || (testCache[i] = runTest(EX10A.fb_tests[i]));

export function mount(el) {
  el.innerHTML = htmlTop() + [html10A(), html10B(), html10C(), html10D(), html10E(), html10F(), html10G(), html10H()].join("") + Y.html();
  [init10A, init10B, init10C, init10D, init10E, init10F, init10G, init10H, Y.init].forEach((f) => { try { f(el); } catch (e) { console.error("fmse10 " + f.name, e); R.errors.push(f.name + ": " + e.message); } });
  window.fe10 = {
    results: allResults, refLines, R, S, Y: Y.S,
    setEcho: (v, p) => { S.echoV = v; S.echoP = p; drawEcho(); },
    setTest: (i, k) => { S.test = i; S.tk = k; draw10E(); },
    setLib: (t) => { S.lib = t; draw10D(); },
    setMode: (m) => { S.cmode = m; draw10H(); },
  };
}

function htmlTop() {
  return `<div class="card f8-warnbox"><p><b>Part A of 3 – example values only.</b> This page is the <b>program standard</b> and the <b>device function-block
    library</b> for every module of the FMS (data: <code>tools/fmse/examples/item10a_examples.json</code>, shared with guide <code>docs/FMS system design/70_plc_library_A_standard_fbs.md</code> and the Python tools; PLC source
    <code>tools/fmse/plc_lib/*.st</code>). Part B gives the complete module programs M01–M22, part C the cell controller and the virtual commissioning of the kit.
    The FBs are teaching versions: every rule can be checked by hand and every FB has a unit test. <b>Safety functions are programmed only in the safety
    (F-) program</b> with certified blocks by qualified people; the "safety mirror" FBs here only <b>read</b> F-copies for diagnosis and HMI.</p></div>`;
}

/* ================================================================== 10A program standard overview */
function html10A() {
  return card("f910A", "10A · The PLC program standard – one structure for every module", "module FB structure · call order · tasks · naming",
    intro(`<p>Item 9 explained the tools (IEC 61131-3, scan, FBs, PackML, data block). Item 10 turns them into a <b>standard</b>: every module of the
      FMS – pallet changer, stacker, washer, load station, robot cell – has the <b>same program structure</b>. Only the device list and the sequence
      change. A programmer who knows one module can read all 22.</p>
      <p><b>Module FB</b> = one function block per module (<code>FB_ModuleAPC</code>, <code>FB_ModuleStacker</code> …), one instance per real module
      (APC01, APC02 …). Inside, always in the <b>same call order</b> in the 10 ms Main task:</p>
      <p class="phd-eq">IO layer (generated) → device FBs → FB_CmdIf → FB_PackMLCore → sequence (only in Execute) → FB_AlarmMgr → outputs + data block</p>
      <p><b>Why this order?</b> Device FBs first, so every status (xAtB, iAlarm) is fresh in this scan. The command is checked against the state of
      <i>this</i> scan, the state machine reacts to the command and to the alarm class, the sequence sets the device commands, the alarm manager
      collects all alarms last so that AlarmNo in the data block is consistent with the outputs of the same scan. Reaction time = 2 × task period at most (9B).</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Module FB structure (example APC01, M02)</h3><div class="fe-scroll">${svgStruct()}</div></div>
      <div><h3 class="fe-h3">Parts of the module FB</h3>${tab(["Part", "What it does", "Where"], STRUCT10.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="sub">${esc(r[2])}</td></tr>`), "f8-small")}</div></div>
    <h3 class="fe-h3">Task layout</h3>
    ${tab(["Task", "Period", "Priority", "Content", "Calls"], TASKS10.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td class="sub">${esc(r[4])}</td></tr>`), "f8-small")}
    <h3 class="fe-h3">Naming rules</h3>
    ${tab(["Prefix / pattern", "Meaning", "Example"], NAMING10.map((r) => `<tr><td class="f9-mono"><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="f9-mono">${esc(r[2])}</td></tr>`), "f8-small")}
    <p class="phd-eq">task utilisation U = Σ C<sub>i</sub> ÷ T<sub>i</sub> ≤ 0.6 (design) · one module FB in Main: C ≈ n<sub>FB</sub> × 2–10 µs (typical CPU, example)</p>` +
    exBox("APC01 in the standard", `<p>Main task, 10 ms: <code>APC01(…)</code> calls the generated IO layer, then the 5 device FBs <b>Rotate : FB_Valve2</b>,
      <b>Clamp : FB_Valve1</b>, <b>PalSideA / PalSideB : FB_Sensor</b>, <b>ClampPress : FB_AnalogIn</b> (instance numbers i = 1 … 5 – they become part of the
      alarm number, 10C), then <b>CmdIf</b> (10H), <b>PackML</b> (part B), the 4-step sequence of item 9F, and <b>AlarmMgr</b> (10I). Three pallet changers =
      three instances of the same FB_ModuleAPC with module numbers M02 and unit names APC01 … APC03.</p>`) +
    useCase(`the owner writes "program standard item 10 + library version 1.x" into the URS. Every integrator who delivers a module must use the library FBs and
      the call order; the factory's maintenance team then finds the same structure, alarm numbers and signal tower behaviour on every machine.`));
}
function svgStruct() {
  let b = arrowDefs("f10sA");
  const box = (x, y, w, h, t, s, c) => RC(x, y, w, h, c) + T(x + w / 2, y + (s ? 15 : 19), t, "middle", "f9-sm f9-b") + (s ? T(x + w / 2, y + 28, s, "middle", "f9-xs") : "");
  const ar = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="f9-edge" marker-end="url(#f10sA)"/>`;
  b += RC(4, 4, 512, 312, "f9-cfg", 8) + T(14, 20, "<tspan class='f9-b'>APC01 : FB_ModuleAPC</tspan> – Main task 10 ms", "start", "f9-lbl");
  b += box(14, 34, 120, 36, "Data block in", "words 2, 3, 5, 12–15, 19", "f9-gvl");
  b += box(160, 34, 110, 36, "FB_CmdIf", "D1 echo (10H)", "f9-prg");
  b += box(296, 34, 110, 36, "FB_PackMLCore", "state (part B)", "f9-task");
  b += box(296, 96, 110, 36, "Sequence", "S10…S40 in Execute", "f9-task");
  b += ar(134, 52, 160, 52) + ar(270, 52, 296, 52) + ar(351, 70, 351, 96);
  const devs = [["Rotate", "FB_Valve2", 1], ["Clamp", "FB_Valve1", 2], ["PalSideA", "FB_Sensor", 3], ["PalSideB", "FB_Sensor", 4], ["ClampPress", "FB_AnalogIn", 5]];
  devs.forEach(([n, t, i], j) => { const x = 14 + j * 100; b += box(x, 166, 92, 36, `${i} ${n}`, t, "f9-fb"); b += ar(351, 132, x + 46, 166); });
  b += box(14, 104, 120, 36, "IO layer", "GVL_IO (9I)", "f9-res");
  b += ar(74, 140, 74, 166);
  b += box(160, 240, 130, 36, "FB_AlarmMgr", "D2 number · D3 class", "f9-prg");
  devs.forEach((d, j) => { b += `<line x1="${60 + j * 100}" y1="202" x2="225" y2="240" class="f9-thin"/>`; });
  b += box(316, 240, 90, 36, "Signal tower", "10J", "f9-fb");
  b += box(420, 166, 88, 36, "Data block out", "0–1, 4, 6–11, 16–18", "f9-gvl");
  b += ar(290, 258, 316, 258) + `<path d="M225 240V226H462V202" class="f9-edge" marker-end="url(#f10sA)"/>` + `<path d="M406 52H462V166" class="f9-edge" marker-end="url(#f10sA)"/>`;
  b += `<path d="M225 276V300H40V140" class="f9-edge f9-sc" marker-end="url(#f10sA)"/>` + T(130, 296, "class A / B → internal Abort / Hold", "middle", "f9-xs");
  b += `<path d="M225 276V292H351V132" class="f9-edge f9-sc"/>`;
  return svg(520, 320, b, "f10-struct", "Module FB structure: data block, command interface, PackML core, sequence, device FBs, alarm manager, signal tower");
}
function init10A() { /* static */ }

/* ================================================================== 10B the 4 decisions */
function html10B() {
  const D = EX10A.decisions;
  const dec = (d, extra) => `<div class="f10-dec"><h3 class="fe-h3">${d.id} · ${esc(d.topic)}</h3>
    ${tab(["#", "Option", ""], d.options.map((o, i) => `<tr class="${i === d.choice ? "f10-chosen" : ""}"><td>${i + 1}</td><td>${esc(o)}</td><td>${i === d.choice ? "<b>chosen</b>" : ""}</td></tr>`), "f8-small")}
    <p class="f8-pt"><b>Rule:</b> ${esc(d.rule)}</p><p class="am-note"><b>Why:</b> ${esc(d.why)}</p>${extra || ""}</div>`;
  return card("f910B", "10B · The four decisions of the program standard (D1–D4)", "problem → options → choice → rule → why · item 9 left these open",
    intro(`<p>While writing item 9 four questions came up where the guides gave different answers. A standard must decide them <b>once</b> for all modules,
      otherwise every programmer decides differently and the cell controller has to know 22 behaviours. Each decision below shows the problem, the options,
      the choice, the exact rule (the same text drives the FBs on this page) and the reason.</p>
      <p class="phd-eq">D1 command handshake · D2 alarm numbers · D3 alarm reaction by class · D4 homing in Resetting</p>`) +
    dec(D[0], `<h4 class="fe-h3">D1 animated – the 4-phase echo between cell controller (CC) and module</h4>
      <div class="fe-row"><label>Case <select id="f10BV" class="fe-sel"><option value="acc">Start in Idle – accepted (CmdAck)</option><option value="rej">Hold in Idle – rejected (CmdRej)</option></select></label>
        <button class="mx-el" id="f10BPrev">◀ phase</button><button class="mx-el" id="f10BNext">phase ▶</button><button class="mx-el" id="f10BPlay">▶ Play</button><b id="f10BPh"></b></div>
      <div class="grid2 eq"><div class="fe-scroll" id="f10BTim"></div><div><div class="fe-scroll" id="f10BSeq"></div><p class="f8-pt" id="f10BTxt"></p></div></div>
      <p class="phd-eq">phase 1 CC: CntrlCmd + CCR = 1 (one FC16) → phase 2 module: edge → CmdAck / CmdRej → phase 3 CC: CCR = 0 → phase 4 module: echo = 0 · CC time-out 2 s</p>`) +
    D.slice(1).map((d) => dec(d, d.id === "D3" ? tab(["Class", "Reaction", "Tower", "Horn"], Object.entries(EX10A.alarm_classes).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v.reaction)}</td><td>${esc(v.tower)}</td><td>${v.horn ? "yes" : "no"}</td></tr>`), "f8-small") :
      d.id === "D2" ? `<p class="phd-eq">AlarmNo = M × 1000 + 10 × i + a &nbsp;·&nbsp; M02, i = 1 (Rotate), a = 1 → 2 × 1000 + 10 + 1 = 2011 &nbsp;·&nbsp; rejection warning = M × 1000 + 900 + command</p>` :
      `<p class="phd-eq">Resetting → Idle only if: all device FBs at home ∧ not busy ∧ no class A/B alarm ∧ safety OK (else alarm M×1000 + 1, class B)</p>`)).join("") +
    exBox("D3 with the clamp pressure", `<p>Clamp step S30: pressure does not reach 4.5 bar within 3 s → alarm 2051 <b>class B</b> → internal Hold: the operator re-seats the
      pallet, Unhold repeats the step, nothing is lost. During machining the pressure falls below the limit → alarm 2052 <b>class A</b> → internal Abort + feed hold
      over the coupling: the part may be damaged, the job is lost and needs Clear + Reset (with homing, D4). Same sensor, two alarms, two classes – the class
      decides the reaction, not the device. 10I runs exactly this sequence.</p>`) +
    useCase(`the four rules go word by word into the functional design specification (FDS) of every module and into the cell controller specification. At the FAT the
      owner checks them with the tests of 10E / 10H / 10I.`));
}
const echoFrames = () => (S.echoV === "rej" ? ECHO_REJ : ECHO_ACC);
function init10B() {
  $("f10BV").value = S.echoV;
  $("f10BV").addEventListener("change", () => { S.echoV = $("f10BV").value; S.echoP = 0; store.set("echoV", S.echoV); drawEcho(); });
  $("f10BPrev").addEventListener("click", () => { stopPlay("e"); S.echoP = Math.max(0, S.echoP - 1); drawEcho(); });
  $("f10BNext").addEventListener("click", () => { stopPlay("e"); S.echoP = Math.min(4, S.echoP + 1); drawEcho(); });
  $("f10BPlay").addEventListener("click", () => {
    if (timers.e) { stopPlay("e"); $("f10BPlay").textContent = "▶ Play"; return; }
    $("f10BPlay").textContent = "❚❚ Pause"; if (S.echoP >= 4) S.echoP = 0;
    timers.e = setInterval(() => { if (!document.getElementById("f10BTim")) return stopPlay("e"); S.echoP = (S.echoP + 1) % 5; drawEcho(); }, 1400);
  });
  drawEcho();
}
function drawEcho() {
  const F = echoFrames(), p = S.echoP, f = F[p];
  $("f10BV").value = S.echoV; $("f10BPh").textContent = `phase ${f[0]}`;
  const rows = [["w2 CntrlCmd", 1, "CC", "n"], ["w3.0 CmdChangeRequest", 2, "CC", "b"], ["w4.8 CmdAck", 3, "M", "b"], ["w4.9 CmdRej", 4, "M", "b"], ["w0 StateCurrent", 5, "M", "n"], ["w7 WarningNo", 6, "M", "n"]];
  const x0 = 150, cw = 74, rh = 26, W = x0 + 5 * cw + 10;
  let s = "";
  F.forEach((fr, j) => { s += T(x0 + j * cw + cw / 2, 14, fr[0].split(" ")[0], "middle", j === p ? "f9-sm f9-b" : "f9-xs") + T(x0 + j * cw + cw / 2, 26, fr[7], "middle", "f9-xs"); });
  rows.forEach(([n, ix, who, kind], r) => {
    const y = 34 + r * rh;
    s += T(6, y + 16, n, "start", who === "CC" ? "f9-xs f10-tin" : "f9-xs f10-tout") + T(x0 - 6, y + 16, who, "end", "f9-xs f9-b");
    F.forEach((fr, j) => {
      const v = fr[ix], x = x0 + j * cw, vis = j <= p;
      if (!vis) return;
      if (kind === "b") { if (v) s += RC(x, y + 4, cw, rh - 8, who === "CC" ? "f9-fin" : "f9-fout", 0); s += L(x, y + (v ? 4 : rh - 4), x + cw, y + (v ? 4 : rh - 4), who === "CC" ? "f10-wi" : "f10-wo"); const pv = j ? F[j - 1][ix] : v; if (pv !== v) s += L(x, y + 4, x, y + rh - 4, who === "CC" ? "f10-wi" : "f10-wo"); }
      else { s += RC(x + 1, y + 4, cw - 2, rh - 8, v ? (who === "CC" ? "f10-nin" : "f10-nout") : "f10-n0", 3) + T(x + cw / 2, y + 17, ix === 5 ? `${v} ${SN[v] || ""}` : String(v), "middle", "f10-nv"); }
    });
    s += L(x0, y + rh, W - 10, y + rh, "f9-grid");
  });
  s += RC(x0 + p * cw, 2, cw, 34 + rows.length * rh, "f10-curE", 0);
  $("f10BTim").innerHTML = svg(W, 40 + rows.length * rh, s, "f10-echo", "Four-phase echo timing diagram, phase " + f[0]);
  // sequence picture
  let q = arrowDefs("f10bA"); q += RC(10, 20, 120, 120, "f9-task", 6) + T(70, 40, "Cell controller", "middle", "f9-sm f9-b") + RC(250, 20, 120, 120, "f9-fb", 6) + T(310, 40, "Module PLC", "middle", "f9-sm f9-b");
  q += T(70, 62, `w2 = ${f[1]}`, "middle", "f9-xs") + T(70, 78, `w3.0 = ${f[2]}`, "middle", "f9-xs") + T(310, 62, `w4.8 Ack = ${f[3]}`, "middle", "f9-xs") + T(310, 78, `w4.9 Rej = ${f[4]}`, "middle", "f9-xs") + T(310, 94, `w0 = ${f[5]} ${SN[f[5]]}`, "middle", "f9-xs") + T(310, 110, `w7 = ${f[6]}`, "middle", "f9-xs");
  const act = f[7];
  if (act === "CC") q += `<line x1="132" y1="80" x2="246" y2="80" class="f9-ehot" marker-end="url(#f10bA)"/>` + T(190, 70, p === 1 ? "FC16 write w2–w3" : "FC16 write (clear)", "middle", "f9-xs f9-b");
  else if (act === "Module") q += `<line x1="248" y1="100" x2="134" y2="100" class="f9-ehot" marker-end="url(#f10bA)"/>` + T(190, 118, "CC reads w0–w7 (FC3)", "middle", "f9-xs f9-b");
  q += T(190, 150, "Modbus TCP / OPC UA – one writer per word", "middle", "f9-xs");
  $("f10BSeq").innerHTML = svg(380, 160, q, "f10-seq", "Cell controller and module exchange in phase " + f[0]);
  $("f10BTxt").innerHTML = `<b>${esc(f[0])}:</b> ${esc(f[8])}`;
}

/* ================================================================== 10C one writer per word + alarm number calculator */
const WRITER = (w) => ([0, 1, 4, 6, 7, 8, 9, 10, 11, 16, 17, 18].includes(w) ? "M" : "CC");
function html10C() {
  return card("f910C", "10C · One writer per word – the data block and the alarm number", "who may write which word · module part · AlarmNo = M×1000 + 10·i + a and back",
    intro(`<p><b>Rule (D1):</b> every word of the module data block has exactly <b>one writer</b>. The module writes its status, the cell controller writes its
      commands. A word written by both sides is a race: Modbus has no "write once", a late write of one side silently erases the other side's value.
      That is why even the command echo uses <b>two</b> words: the request bit is in word 3 (CC), the answer bits CmdAck / CmdRej are in word 4 (module).</p>
      <p class="phd-eq">module writes: 0–1, 4, 6–11, 16–18 · cell controller writes: 2–3, 5, 12–15, 19 · module part ≥ 20: "out" = module, "in" = CC</p>
      <p><b>Alarm number (D2):</b> the number alone tells module, device and fault – no text table lookup needed to know where to go.</p>
      <p class="phd-eq">AlarmNo = M × 1000 + 10 × i + a &nbsp;·&nbsp; M = module number, i = instance (1–99, item 8 order, only devices with an FB), a = local code 1–9 &nbsp;·&nbsp; decode: M = ⌊N ÷ 1000⌋, r = N mod 1000, i = ⌊r ÷ 10⌋, a = r mod 10 (r ≥ 900 → rejected command r − 900)</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Standard words 0–19</h3>${tab(["Word", "Name", "Type", "Writer", "Meaning"], BLOCK.map(([w, n, t, , m]) => {
      const wr = WRITER(w), mm = w === 4 ? m + " · bit8 CmdAck · bit9 CmdRej (D1)" : w === 14 ? m + " – written by the CC only (D1)" : m;
      return `<tr><td class="f8-r">${w}${["DINT", "REAL"].includes(t) ? `–${w + 1}` : ""}</td><td class="f9-mono">${esc(n)}</td><td>${t}</td><td><span class="f10-wr f10-wr${wr}">${wr === "M" ? "module" : "cell ctrl"}</span></td><td>${esc(mm)}</td></tr>`; }), "f8-small")}</div>
      <div><h3 class="fe-h3">Module part (from word 20)</h3><div class="fe-row"><label>Module <select id="f10CMod" class="fe-sel">${Object.keys(EXTRA).map((m) => `<option value="${m}">${m} ${esc(MODS[m] ? MODS[m].title : "")}</option>`).join("")}</select></label></div><div id="f10CExt"></div>
        <h3 class="fe-h3">Alarm number calculator</h3>
        <div class="fe-row"><label>Module <select id="f10CAM" class="fe-sel">${CODES.map((c) => `<option value="${c}">${c} ${esc(MODS[c].title)}</option>`).join("")}</select></label></div>
        <div class="fe-row"><label>Instance i <select id="f10CAI" class="fe-sel"></select></label><label>Local code a <select id="f10CAA" class="fe-sel"></select></label></div>
        <div id="f10CAOut" class="f8-pt"></div>
        <div class="fe-row"><label>Decode a number <input type="number" id="f10CDec" min="0" max="99999" step="1" class="f10-num"></label></div><div id="f10CDecOut" class="f8-pt"></div></div></div>` +
    exBox("2011 and 2904", `<p><b>2011</b>: M = 2 (pallet changer M02), r = 11 → i = 1 (Rotate, FB_Valve2), a = 1 "end position not reached". <b>2904</b>: r = 904 ≥ 900 → a
      command was rejected, command 4 = Hold (a warning, class C). <b>22999</b> is the largest number (M22) – still inside the 16-bit INT range (32767), so word 6
      stays one INT.</p>`) +
    useCase(`SCADA shows "2011" on the overview; the maintenance technician knows without a manual: module M02, first device, end position not reached – he goes to
      the rotation cylinder of the pallet changer. The alarm text table for PLC, HMI and cell controller is generated from the same library (10D alarm tables).`));
}
function instOf(code) { return usage().mod[code].inst.map(([pn, g], j) => ({ i: j + 1, pn, g, fb: FBT9[pn] })); }
function init10C() {
  $("f10CMod").value = EXTRA[S.dbMod] ? S.dbMod : "M03";
  const ext = () => {
    const m = $("f10CMod").value; S.dbMod = m; store.set("dbMod", m);
    $("f10CExt").innerHTML = tab(["Word", "Name", "Type", "Writer", "Meaning"], EXTRA[m].map(([w, n, t, d, mm]) => { const wr = d === "in" ? "CC" : "M"; return `<tr><td class="f8-r">${w}</td><td class="f9-mono">${esc(n)}</td><td>${esc(t)}</td><td><span class="f10-wr f10-wr${wr}">${wr === "M" ? "module" : "cell ctrl"}</span></td><td>${esc(mm)}</td></tr>`; }), "f8-small");
  };
  $("f10CMod").addEventListener("change", ext); ext();
  $("f10CAM").value = S.almMod;
  const fillI = () => {
    const ins = instOf($("f10CAM").value);
    $("f10CAI").innerHTML = `<option value="0">0 – module level (sequence, homing, commands)</option>` + ins.map((x) => `<option value="${x.i}">${x.i} – ${esc(x.g)} (${x.fb})</option>`).join("");
    $("f10CAI").value = String(Math.min(S.almI, ins.length));
  };
  const fillA = () => {
    const i = +$("f10CAI").value, ins = instOf($("f10CAM").value), fb = i ? ins[i - 1].fb : "MODULE", base = WRAP[fb] || fb, list = (ALM10[base] || []).filter((x) => x[0] > 0);
    $("f10CAA").innerHTML = (list.length ? list : [[1, "(no alarm defined)", "-"]]).map(([a, t, c]) => `<option value="${a}">${a} – ${esc(t)} [${c}]</option>`).join("") + (i === 0 ? [2, 3, 4, 5, 6, 7, 8, 9].map((a) => `<option value="${a}">${a} – module alarm ${a} (sequence / communication)</option>`).join("") : "");
    if ([...$("f10CAA").options].some((o) => +o.value === S.almA)) $("f10CAA").value = String(S.almA);
  };
  const calc = () => {
    const M = +$("f10CAM").value.slice(1), i = +$("f10CAI").value, a = +$("f10CAA").value; S.almMod = $("f10CAM").value; S.almI = i; S.almA = a; store.set("almMod", S.almMod);
    const n = almNo(M, i, a), opt = $("f10CAA").selectedOptions[0];
    $("f10CAOut").innerHTML = `AlarmNo = ${M} × 1000 + 10 × ${i} + ${a} = <b class="f10-big">${n}</b> · ${esc(opt ? opt.textContent : "")}`;
  };
  $("f10CAM").addEventListener("change", () => { S.almI = 1; fillI(); fillA(); calc(); });
  $("f10CAI").addEventListener("change", () => { fillA(); calc(); });
  $("f10CAA").addEventListener("change", calc);
  fillI(); fillA(); calc();
  const dec = () => {
    const N = Math.round(+$("f10CDec").value || 0); S.almDec = N;
    const M = Math.floor(N / 1000), r = N % 1000, code = "M" + String(M).padStart(2, "0");
    if (!MODS[code]) { $("f10CDecOut").innerHTML = `<span class="f9-bad">module ${code} does not exist (M01–M22)</span>`; return; }
    if (r >= 901 && r <= 909) { const c = r - 900; $("f10CDecOut").innerHTML = `${code} ${esc(MODS[code].title)} · <b>rejected command</b> ${c} ${CN[c] || "(unknown)"} – warning, class C (D1)`; return; }
    const i = Math.floor(r / 10), a = r % 10, ins = instOf(code);
    if (i === 0) { $("f10CDecOut").innerHTML = `${code} ${esc(MODS[code].title)} · module-level alarm a = ${a}${a === 1 ? " – not in home position (D4, class B)" : " (sequence / communication)"}`; return; }
    const x = ins[i - 1]; if (!x) { $("f10CDecOut").innerHTML = `${code} has only ${ins.length} device FBs – instance ${i} does not exist`; return; }
    const base = WRAP[x.fb] || x.fb, al = (ALM10[base] || []).find((y) => y[0] === a);
    $("f10CDecOut").innerHTML = `${code} ${esc(MODS[code].title)} · instance ${i} <b>${esc(x.g)}</b> (${x.pn} → ${x.fb}) · alarm ${a}: <b>${al ? esc(al[1]) : "not defined for this FB"}</b>${al ? ` (typical class ${al[2]})` : ""}`;
  };
  $("f10CDec").value = S.almDec; $("f10CDec").addEventListener("input", dec); dec();
}

/* ================================================================== 10D FB library browser */
const LIB_ORDER = () => {
  const dev = DEVICE_TYPES.slice(), extra = ["FB_Safe2Ch", "FB_Edm", "FB_CmdIf", "FB_AlarmMgr", "FB_PackMLCore"];
  return dev.concat(extra);
};
const CATS = ["device", "operator", "interface", "supply", "safety mirror", "base", "module standard"];
function html10D() {
  const u = usage();
  return card("f910D", "10D · The device function-block library", `${Object.keys(FBT9).length} circuit patterns of item 8 → ${DEVICE_TYPES.length} device FB types + 2 bases + 3 module-standard FBs`,
    intro(`<p>The library is the software twin of the item 8 circuit library: <b>every circuit pattern has exactly one FB type</b>. The 9I code generator already
      wrote the instance list per module (<code>Rotate : FB_Valve2</code>); here every FB type gets its <b>interface</b>, its <b>rule</b> (the exact behaviour),
      its <b>ST source</b>, its <b>alarm table</b> and the list of modules that use it. Safety devices share two <b>bases</b>: <code>FB_Safe2Ch</code>
      (any 2-channel input) and <code>FB_Edm</code> (feedback of an F-output) – the wrappers only rename the signals.</p>
      <p class="phd-eq">library = ${Object.keys(FBT9).length} patterns → ${DEVICE_TYPES.length} device types (ANALOG_P + ANALOG_T share FB_AnalogIn) + FB_Safe2Ch, FB_Edm + FB_CmdIf, FB_AlarmMgr, FB_PackMLCore</p>
      <p class="phd-eq">FB instances in all 22 modules = ${Object.values(u.per).reduce((s, p) => s + p.total, 0)} (one of each module, item 9 code generator)</p>`) +
    `<div class="f10-lib"><div class="f10-liblist" id="f10DList">${CATS.map((c) => { const ts = LIB_ORDER().filter((t) => (LIB_INFO[t] || [])[0] === c); return ts.length ? `<div class="f10-cat">${c}</div>` + ts.map((t) => `<button class="mx-el f10-libbtn" data-lib="${t}">${t.replace("FB_", "")}<span class="sub">${u.per[t] ? " ×" + u.per[t].total : ""}</span></button>`).join("") : ""; }).join("")}</div>
      <div id="f10DDet" class="f10-libdet"></div></div>` +
    exBox("FB_Valve2 in the library", `<p>Pattern VALVE_DOUBLE (item 8) → FB_Valve2. Interface 5 inputs (two end switches, command, enable, reset), 7 outputs. Rule: a command change
      starts the move timer; end position reached → busy off; not reached in 2 s → alarm 1; leaves the end position without command for 0.3 s → alarm 2; both switches
      on for 0.2 s → alarm 3; xEnable FALSE → both solenoids off, the valve <b>holds</b> (bistable). Used in the pallet changers, stacker, load stations … – the counts
      on the left come from the 22 module instance lists.</p>`) +
    useCase(`the integrator imports the library (one file per FB, <code>tools/fmse/plc_lib/</code>) into the PLC project as a read-only library. New device type? It goes
      through the release process of 10K – never a private copy in one module.`));
}
function genST(t) {
  const IF = ifOf(t) || IF_EXTRA[t] || ifOf(WRAP[t]) || { in: [], out: [], cfg: {} }, rule = ruleOf(t);
  const ty = (n) => (/^[xqb]/.test(n) ? "BOOL" : n.startsWith("w") ? "WORD" : n.startsWith("r") ? "REAL" : n.startsWith("t") ? "INT (ms)" : "INT");
  const wrap = (s, w = 96) => { const out = []; let line = ""; String(s).split(" ").forEach((x) => { if ((line + " " + x).length > w) { out.push(line); line = x; } else line = line ? line + " " + x : x; }); if (line) out.push(line); return out; };
  return [`(* ${t} - generated listing: no file tools/fmse/plc_lib/${t}.st yet *)`, `(* ${(LIB_INFO[t] || [, , ""])[2]} *)`,
    `FUNCTION_BLOCK ${t}`, "VAR_INPUT", ...IF.in.map((n) => `  ${n} : ${ty(n)};`), "END_VAR", "VAR_OUTPUT", ...IF.out.map((n) => `  ${n} : ${ty(n)};`), "END_VAR",
    "VAR (* configuration *)", ...Object.entries(IF.cfg || {}).map(([k, v]) => `  ${k} : ${typeof v === "boolean" ? "BOOL" : ty(k)} := ${typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : v};`), "END_VAR",
    "(* RULE - implemented exactly in the .st file and in fmse10x.js:", ...wrap(rule).map((l) => "   " + l), "*)", "END_FUNCTION_BLOCK"].join("\n");
}
function ruleOf(t) {
  const Rr = EX10A._rules;
  if (Rr[t]) return Rr[t];
  if (t === "FB_Valve1" || t === "FB_Valve2") return Rr.FB_Valve;
  if (WRAP[t]) return `Wrapper of ${WRAP[t]}: ` + Rr[WRAP[t]];
  if (t === "FB_MotorDol") return EX9._rules.motor || "item 9 rule (9E)";
  if (t === "FB_AnalogIn") return [EX9._rules.analog, EX9._rules.limits].filter(Boolean).join(" ") || "item 9 rule (9D)";
  if (t === "FB_AlarmMgr") return Rr.alarm_manager;
  if (t === "FB_PackMLCore") return "Part B: PackML state machine of item 5 (17 states, SC by the sequence), executes iCmdExec of FB_CmdIf, class A → internal Abort, class B → internal Hold from Execute, homing in Resetting (decision D4). " + EX10A.decisions[3].rule;
  return "";
}
function init10D() {
  $("f10DList").addEventListener("click", (e) => { const b = e.target.closest("[data-lib]"); if (!b) return; S.lib = b.dataset.lib; store.set("lib", S.lib); draw10D(); });
  draw10D();
}
function draw10D() {
  if (!LIB_ORDER().includes(S.lib)) S.lib = "FB_Valve2";
  const t = S.lib, info = LIB_INFO[t] || ["", "", ""], u = usage(), use = u.per[t];
  document.querySelectorAll("#f10DList [data-lib]").forEach((b) => b.classList.toggle("active", b.dataset.lib === t));
  const IF = ifOf(t) || IF_EXTRA[t] || ifOf(WRAP[t]), base = WRAP[t] || t, alm = ALM10[base] || ALM10[t] || [];
  const ifRows = IF ? [...IF.in.map((n) => ["IN", n]), ...IF.out.map((n) => ["OUT", n]), ...Object.entries(IF.cfg || {}).map(([k, v]) => ["CFG", `${k} = ${v}`])] : [];
  let wu = "";
  if (t === "FB_Safe2Ch" || t === "FB_Edm") {
    const ws = Object.keys(WRAP).filter((w) => WRAP[w] === t), tot = ws.reduce((s, w) => s + ((u.per[w] || {}).total || 0), 0);
    wu = `<p class="f8-pt">Base of ${ws.join(", ")} → used <b>${tot}</b> times in the 22 modules through its wrappers.</p>`;
  } else if (use && use.total) {
    wu = `<p class="f8-pt">Patterns: <b>${(use.patterns || []).join(", ")}</b> · <b>${use.total}</b> instances in ${Object.keys(use.mods).length} modules:</p><div class="f10-chips">${Object.entries(use.mods).map(([m, n]) => `<span class="f10-chip">${m} ${esc(MODS[m].title.split(" ").slice(0, 3).join(" "))} <b>×${n}</b></span>`).join("")}</div>`;
  } else if (info[0] === "module standard") wu = `<p class="f8-pt">One instance in <b>every</b> module FB (22 modules).</p>`;
  else wu = `<p class="f8-pt">Pattern${use && use.patterns ? " " + use.patterns.join(", ") : ""} – no instance in the current module lists.</p>`;
  $("f10DDet").innerHTML = `<h3 class="fe-h3">${t} <span class="sub">${esc(info[0])} · ${esc(info[1])}</span></h3><p class="f8-pt">${esc(info[2])}</p>
    <div class="grid2 eq"><div><h4 class="fe-h3">Interface</h4>${IF ? tab(["Kind", "Name"], ifRows.map(([k, n]) => `<tr><td>${k}</td><td class="f9-mono">${esc(n)}</td></tr>`), "f8-small f9-dense") : "<p class='am-note'>–</p>"}</div>
      <div><h4 class="fe-h3">Alarms (local code a)</h4>${alm.length ? tab(["a", "Text", "typical class"], alm.map(([a, x, c]) => `<tr><td>${a}</td><td>${esc(x)}</td><td>${c}</td></tr>`), "f8-small") : "<p class='am-note'>no alarm (operator / indication FB)</p>"}
        <h4 class="fe-h3">Where used</h4>${wu}</div></div>
    <h4 class="fe-h3">Rule</h4><p class="f8-pt f10-rule">${esc(ruleOf(t))}</p>
    <h4 class="fe-h3">ST source <span class="sub" id="f10DSrc"></span></h4><div id="f10DST">${pre("loading …")}</div>`;
  loadST(t);
}
/** ST source: embedded copy of tools/fmse/plc_lib/*.st (fmse10_st.js, loaded on first use); generated listing only if a file is missing */
const ST_REL = { FB_AnalogIn: ["FB_LimitAlarm"], FB_CmdIf: ["F_CmdAllowed"], FB_AlarmMgr: ["F_CmdAllowed"] };
let stMod = null;
function loadST(t) {
  const show = () => {
    if (S.lib !== t || !$("f10DST")) return;
    const ST = (stMod && stMod.ST10A) || {}, files = [t, ...(ST_REL[t] || []), ...(WRAP[t] ? [WRAP[t]] : []), "TYPES"].filter((f, k, a) => a.indexOf(f) === k && (f === t || ST[f]));
    const pick = (f) => {
      const has = !!ST[f], txt = has ? ST[f] : genST(f);
      $("f10DST").innerHTML = (files.length > 1 ? `<div class="fe-row">${files.map((x) => `<button class="mx-el f10-pb${x === f ? " active" : ""}" data-stf="${x}">${x}.st</button>`).join("")}</div>` : "") + pre(txt, "f10DCode", "f9-gencode");
      $("f10DSrc").textContent = has ? `tools/fmse/plc_lib/${f}.st – ${txt.split("\n").length} lines (embedded copy, fmse10_st.js)` : "generated listing (no .st file yet – part B)";
      $("f10DST").querySelectorAll("[data-stf]").forEach((b) => b.addEventListener("click", () => pick(b.dataset.stf)));
    };
    pick(t);
  };
  if (stMod) return show();
  import("./fmse10_st.js").then((m) => { stMod = m; show(); }).catch((e) => { stMod = { ST10A: {} }; console.warn("fmse10_st.js", e); show(); });
}

/* ================================================================== 10E FB test bench */
function html10E() {
  return card("f910E", "10E · FB test bench – 19 unit tests and a live FB", "choose a test · scrub the ticks · inputs (orange) and outputs (blue) · change log = the test result",
    intro(`<p>Every FB of the library has a <b>unit test</b>: a list of input events at given ticks and the expected <b>change log</b> of the outputs. The test bench
      calls the FB once per tick (100 ms) exactly like the PLC task. The same 19 tests run in Python (<code>tools/fmse</code>), on this page and in the PLC
      simulator – identical logs prove that the three implementations are the same.</p>
      <p class="phd-eq">time reached when n × 100 ms ≥ t<sub>ms</sub> &nbsp;·&nbsp; edge e = x ∧ ¬x<sub>prev</sub> &nbsp;·&nbsp; log line = tick + outputs that changed (tick 0 = init)</p>`) +
    `<div class="fe-row"><label>Test <select id="f10ET" class="fe-sel">${EX10A.fb_tests.map((t, i) => `<option value="${i}">${t.fb} · ${esc(t.name)}</option>`).join("")}<optgroup label="from item 9 (FB_MotorDol, rules of 9E)">${EX9.motor.scenarios.map((s, i) => `<option value="m${i}">FB_MotorDol · ${esc(s.name)}</option>`).join("")}</optgroup></select></label>
      <button class="mx-el" id="f10EPlay">▶ Play</button><label class="f9-scrub">tick <input type="range" id="f10EK" min="0" max="20" step="1"></label><b id="f10EKt"></b></div>
    <div id="f10EInfo" class="f8-pt"></div>
    <div class="fe-scroll" id="f10ETim"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Values at the tick</h3><div id="f10EVal"></div></div><div><h3 class="fe-h3">Change log (= expected result)</h3><div id="f10ELog" class="f9-log f9-logT"></div></div></div>
    <h3 class="fe-h3">Live FB – toggle the inputs yourself</h3>
    <div class="fe-row"><label>FB <select id="f10ELF" class="fe-sel">${Object.keys(FBS).map((t) => `<option value="${t}">${t}</option>`).join("")}</select></label><span class="sub">inputs start with the defaults of the tests (_input_defaults)</span></div>
    <div id="f10ELive"></div>` +
    exBox("reading test V2 (valve jam)", `<p>Tick 2: command B, the cylinder leaves A (xPosA = 0) → qSol = 1, busy. B is never reached: at tick 21 the move counter reaches
      20 × 100 ms = 2000 ms → <b>xError, iAlarm 1</b>, busy off – the solenoid stays on (the module decides the reaction by class). Tick 30 reset edge → retry: busy again,
      tick 36 xPosB → done. Five log lines – exactly the reference.</p>`) +
    useCase(`before the FAT the integrator runs all unit tests in the PLC simulator and attaches the logs to the test report; after every library change (10K) the same
      tests run again – a changed line means a changed behaviour that must be explained.`));
}
const isMotor = () => String(S.test).startsWith("m");
const motorCacheE = {};
function curTest() {
  if (isMotor()) {
    const i = +String(S.test).slice(1), sc = EX9.motor.scenarios[i], m = motorCacheE[i] || (motorCacheE[i] = motor(sc));
    const trace = m.ticks.map((q) => ({ k: q.k, i: { xCmd: q.cmd, xReset: q.reset, xTripped: q.trip, xRunFb: q.runfb }, o: { qRun: q.run, iState: q.st, xError: q.st === 9, iAlarm: q.alarm }, ev: q.evs }));
    return { fb: "FB_MotorDol", name: sc.name, K: EX9.motor.K, trace, log: m.log, ins: ["xCmd", "xRunFb", "xTripped", "xReset"], outs: ["qRun", "iState", "xError", "iAlarm"], item9: true };
  }
  const i = Math.min(+S.test || 0, EX10A.fb_tests.length - 1), t = EX10A.fb_tests[i], r = testOf(i), IF = ifOf(t.fb);
  return { fb: t.fb, name: t.name, K: t.K, trace: r.trace, log: r.log, ins: IF.in, outs: IF.out, cfg: t.cfg, events: t.events };
}
function init10E() {
  $("f10ET").value = String(S.test);
  if (!$("f10ET").value) { S.test = 1; $("f10ET").value = "1"; }
  $("f10ET").addEventListener("change", () => { stopPlay("t"); $("f10EPlay").textContent = "▶ Play"; S.test = isNaN(+$("f10ET").value) ? $("f10ET").value : +$("f10ET").value; S.tk = null; store.set("test", S.test); draw10E(); });
  $("f10EK").addEventListener("input", () => { S.tk = +$("f10EK").value; draw10E(); });
  $("f10EPlay").addEventListener("click", () => {
    if (timers.t) { stopPlay("t"); $("f10EPlay").textContent = "▶ Play"; return; }
    const K = curTest().K; if (S.tk == null || S.tk >= K - 1) S.tk = 0;
    $("f10EPlay").textContent = "❚❚ Pause";
    timers.t = setInterval(() => { if (!document.getElementById("f10EK")) return stopPlay("t"); S.tk++; if (S.tk >= K - 1) { S.tk = K - 1; stopPlay("t"); $("f10EPlay").textContent = "▶ Play"; } draw10E(); }, 160);
  });
  $("f10ELog").addEventListener("click", (e) => { const d = e.target.closest("[data-tk]"); if (d) { S.tk = +d.dataset.tk; draw10E(); } });
  draw10E();
  $("f10ELF").value = S.live;
  const mk = () => { S.live = $("f10ELF").value; store.set("live", S.live); liveWidget($("f10ELive"), S.live, { selects: SELECTS }); };
  $("f10ELF").addEventListener("change", mk); mk();
}
export const SELECTS = {
  iState: Object.entries(STATES).map(([k, v]) => [v, `${v} ${k}`]), iMode: [[1, "1 Production"], [2, "2 Maintenance"], [3, "3 Manual"]],
  iCntrlCmd: [[0, "0 none"], ...Object.entries(CMDS).map(([k, v]) => [v, `${v} ${k}`])], iAlarmClass: [[0, "0 none"], [1, "1 A"], [2, "2 B"], [3, "3 C"]],
  iField: [[0, "0 (invalid)"], [1, "1 field set A"], [2, "2 field set B"], [3, "3 (invalid)"]], iLampMode: [[0, "0 off"], [1, "1 on"], [2, "2 blink"]],
};
function draw10E() {
  const c = curTest(), K = c.K, k = S.tk == null ? K - 1 : Math.min(S.tk, K - 1);
  $("f10ET").value = String(S.test); $("f10EK").max = K - 1; $("f10EK").value = k; $("f10EKt").textContent = `${k} (${k * DT} ms)`;
  $("f10EInfo").innerHTML = c.item9 ? `FB_MotorDol scenario from item 9 (rules of 9E, imported from fmse9x.js – not duplicated) · ${K} ticks · log ${c.log.length} lines`
    : `<b>${c.fb}</b> · ${K} ticks · cfg ${esc(JSON.stringify(c.cfg || {}))} · events: ${c.events.map(([t, ...s]) => `<span class="f10-ev">${t}: ${esc(s.join(", "))}</span>`).join(" ")} · log <b>${c.log.length}</b> lines`;
  $("f10ETim").innerHTML = timingSvg(c.trace, c.ins, c.outs, k, { K, label: c.fb + " test timing diagram" });
  const q = c.trace[k];
  $("f10EVal").innerHTML = tab(["Signal", "Kind", "Value"], [...c.ins.map((n) => [n, "IN", q.i[n]]), ...c.outs.map((n) => [n, "OUT", q.o[n]])].map(([n, kd, v]) => `<tr class="${kd === "OUT" && k > 0 && !same(c.trace[k - 1].o[n], v) ? "f9-chg" : ""}"><td class="f9-mono">${n}</td><td>${kd}</td><td><b>${fmt(v)}</b></td></tr>`), "f8-small f9-dense") + (q.ev && q.ev.length ? `<p class="f8-pt">events at this tick: <b>${esc(q.ev.join(", "))}</b></p>` : "");
  $("f10ELog").innerHTML = c.log.map((l) => { const tk = parseInt(l, 10); return `<div data-tk="${tk}" class="${tk === k ? "f9-lnow" : tk > k ? "f9-lfut" : ""}">${esc(l)}</div>`; }).join("");
}

/* ================================================================== 10F valve lab */
function html10F() {
  return card("f910F", "10F · Valve lab – FB_Valve1 (spring) and FB_Valve2 (bistable) side by side", "same command, same faults – different behaviour when disabled",
    intro(`<p>Both valve FBs follow <b>one rule</b> (FB_Valve); only the outputs differ. <b>FB_Valve1</b>: one solenoid, a spring pushes the spool back –
      no power = position A. <b>FB_Valve2</b>: two solenoids, the spool stays where it is – no power = <b>hold</b>. That decides what happens when
      xEnable goes FALSE (guard opened, safety stop): Valve1 moves back to A by itself, Valve2 stops and keeps its position.</p>
      <p class="phd-eq">Valve1: qSol = xCmdB ∧ xEnable · Valve2: qSolB = xCmdB ∧ xEnable, qSolA = ¬xCmdB ∧ xEnable · alarm 1 if n·100 ≥ 2000 ms while moving, 2 if position lost ≥ 300 ms, 3 if both switches ≥ 200 ms</p>
      <p>Plant model of this lab: travel A ↔ B = 10 ticks (1 s); the cylinder moves 1 step per tick when its solenoid is on (Valve1 also when the spring pushes).
      An error does <b>not</b> switch the outputs – the module decides by alarm class (D3). Note how the move timer pauses while disabled.</p>`) +
    `<div class="fe-row"><label><input type="checkbox" id="f10FCmd"> xCmdB (go to B)</label><label><input type="checkbox" id="f10FEn" checked> xEnable</label>
      <button class="mx-el" id="f10FRst">Reset (pulse)</button><label><input type="checkbox" id="f10FJam"> jam (cylinder blocked)</label><button class="mx-el" id="f10FPush">push rod by hand</button>
      <button class="mx-el" id="f10FPlay">❚❚ Pause</button><button class="mx-el" id="f10FStep">+1 tick</button><button class="mx-el" id="f10FNew">restart</button><b id="f10FK"></b></div>
    <div class="grid2 eq"><div id="f10FV1"></div><div id="f10FV2"></div></div>
    ${tab(["", "FB_Valve1 (single solenoid, spring)", "FB_Valve2 (double solenoid, bistable)"], [
      ["no power / xEnable FALSE", "spool springs back → cylinder goes to A", "spool stays → cylinder stops / holds"],
      ["power failure in mid-stroke", "moves to A – choose A = safe position", "stays – choose for clamps that must NOT open"],
      ["typical use", "clamp (opens / closes to a safe side), stopper, blow-off", "rotation of the pallet changer, gripper that must keep the part"],
      ["outputs", "1 DO", "2 DO"], ["home position (D4)", "A after power-on automatically", "must be driven to A in Resetting (homing)"]].map((r) => `<tr>${r.map((x, i) => (i ? `<td>${esc(x)}</td>` : `<td><b>${esc(x)}</b></td>`)).join("")}</tr>`), "f8-small")}` +
    exBox("disable while moving", `<p>Command B, after 0.4 s the guard is opened (xEnable FALSE). Valve1: qSol off, the spring drives the cylinder back to A, the FB's move timer
      stands still (n counts only while enabled). Valve2: both solenoids off, the cylinder stops in the middle, xAtA = xAtB = FALSE, xBusy stays TRUE. Guard closed
      again → Valve2 continues to B, the timer continues from where it stopped (test V4 of 10E shows the same: qSolB 0 at tick 6, 1 at tick 20, B reached at 24).</p>`) +
    useCase(`clamping of a fixture: a spring-return valve opens the clamp on a power failure – dangerous if the part must stay clamped; a bistable valve (or a clamp with
      a mechanical self-lock) keeps it. The valve type is a decision of the risk assessment (item 7), the FB follows automatically.`));
}
const VL = { k: 0, pos: [0, 0], cmd: false, en: true, rst: 0, jam: false, fb: null, log: [[], []] };
function vlNew() {
  VL.k = 0; VL.pos = [0, 0]; VL.fb = [newFB("FB_Valve1"), newFB("FB_Valve2")]; VL.log = [[], []]; VL.prevO = [null, null];
  VL.fb.forEach((f) => { f.i.xPosA = true; f.i.xPosB = false; });
}
function vlTick() {
  VL.fb.forEach((f, j) => {
    const o = f.o; let dir = 0;
    if (VL.k > 0) { if (j === 0) dir = o.qSol ? 1 : -1; else dir = o.qSolB && !o.qSolA ? 1 : o.qSolA && !o.qSolB ? -1 : 0; }
    if (!VL.jam) VL.pos[j] = Math.max(0, Math.min(10, VL.pos[j] + dir));
    f.i.xPosA = VL.pos[j] === 0; f.i.xPosB = VL.pos[j] === 10; f.i.xCmdB = VL.cmd; f.i.xEnable = VL.en; f.i.xReset = VL.rst === 1;
    f.run(); const cur = Object.assign({}, f.o), pv = VL.prevO[j];
    if (!pv) VL.log[j].push(`${VL.k} init ` + Object.entries(cur).map(([n, v]) => `${n}=${fmt(v)}`).join(" "));
    else { const ch = Object.entries(cur).filter(([n, v]) => !same(v, pv[n])).map(([n, v]) => `${n}=${fmt(v)}`); if (ch.length) VL.log[j].push(`${VL.k} ` + ch.join(" ")); }
    VL.prevO[j] = cur;
  });
  if (VL.rst === 1) VL.rst = 0;
  VL.k++;
}
function vlDraw() {
  $("f10FK").textContent = `tick ${VL.k}`;
  ["f10FV1", "f10FV2"].forEach((id, j) => {
    const f = VL.fb[j], o = f.o, x = 70 + VL.pos[j] * 16;
    let b = RC(40, 40, 220, 44, "f9-cyl", 3) + RC(x, 44, 12, 36, "f9-arm", 1) + RC(x + 12, 58, 230 - (x - 40) + 20, 8, "f9-arm", 1);
    b += T(40, 104, "A", "middle", "f9-sm f9-b") + T(260, 104, "B", "middle", "f9-sm f9-b");
    b += `<circle cx="56" cy="30" r="7" class="${f.i.xPosA ? "f9-ledOn" : "f9-ledOff"}"/>` + T(56, 18, "PosA", "middle", "f9-xs") + `<circle cx="244" cy="30" r="7" class="${f.i.xPosB ? "f9-ledOn" : "f9-ledOff"}"/>` + T(244, 18, "PosB", "middle", "f9-xs");
    if (j === 0) { b += RC(100, 112, 70, 22, o.qSol ? "f10-solOn" : "f9-box", 3) + T(135, 127, "Y1 qSol", "middle", "f9-xs") + `<path d="M20 123h20l6 -6 6 12 6 -12 6 12 6 -6h20" class="f9-w"/>` + T(30, 146, "spring", "middle", "f9-xs"); }
    else { b += RC(30, 112, 70, 22, o.qSolA ? "f10-solOn" : "f9-box", 3) + T(65, 127, "Y1 qSolA", "middle", "f9-xs") + RC(200, 112, 70, 22, o.qSolB ? "f10-solOn" : "f9-box", 3) + T(235, 127, "Y2 qSolB", "middle", "f9-xs"); }
    if (VL.jam) b += T(150, 34, "JAMMED", "middle", "f9-sm f9-b f10-red");
    const head = j === 0 ? "FB_Valve1 – spring return" : "FB_Valve2 – bistable";
    $(id).innerHTML = `<h3 class="fe-h3">${head}</h3><div class="fe-scroll">${svg(320, 150, b, "f10-valve", head)}</div>
      <div class="f9-sigs">${Object.entries(o).map(([n, v]) => (isBoolName(n) ? `<span><span class="f9-led${v ? (n === "xError" ? " f10-ledR" : " f9-on") : ""}"></span> ${n}</span>` : `<span>${n} = <b class="${v ? "f9-bad" : ""}">${v}${v ? " " + (ALM10.FB_Valve1.find((a) => a[0] === v) || [, ""])[1] : ""}</b></span>`)).join("")}</div>
      <p class="am-note">internal: moving = ${f.moving ? 1 : 0} · n = ${f.n} (${f.n * DT} ms of ${f.c.tMove_ms}) · nl = ${f.nl} · nb = ${f.nb} · cylinder at ${VL.pos[j] * 10} %</p>
      <div class="f9-log f10-slog">${VL.log[j].slice(-14).map((l) => `<div>${esc(l)}</div>`).join("")}</div>`;
  });
}
function init10F() {
  vlNew(); vlTick();
  const sync = () => { VL.cmd = $("f10FCmd").checked; VL.en = $("f10FEn").checked; VL.jam = $("f10FJam").checked; };
  ["f10FCmd", "f10FEn", "f10FJam"].forEach((id) => $(id).addEventListener("change", () => { sync(); vlDraw(); }));
  $("f10FRst").addEventListener("click", () => { VL.rst = 1; if (!timers.v) { vlTick(); vlDraw(); } });
  $("f10FPush").addEventListener("click", () => { VL.pos = VL.pos.map((p) => (p >= 5 ? p - 3 : p + 3)); vlDraw(); });
  $("f10FStep").addEventListener("click", () => { vlTick(); vlDraw(); });
  $("f10FNew").addEventListener("click", () => { vlNew(); sync(); vlTick(); vlDraw(); });
  const play = () => { $("f10FPlay").textContent = "❚❚ Pause"; timers.v = setInterval(() => { if (!document.getElementById("f10FV1")) return stopPlay("v"); vlTick(); vlDraw(); }, 200); };
  $("f10FPlay").addEventListener("click", () => { if (timers.v) { stopPlay("v"); $("f10FPlay").textContent = "▶ Run"; } else play(); });
  $("f10FPlay").textContent = "▶ Run";
  vlDraw();
}

/* ================================================================== 10G safety mirror FBs */
const SAFE = [
  ["FB_Safe2Ch", "E-stop, guard door, enabling switch, light curtain, safety coupling", "The F-program evaluates both channels with a certified block (e.g. ESTOP1 / F_SafetyDoor) and switches the F-outputs. The mirror shows WHY the machine stopped: which device, discrepancy (one channel open = wiring or switch fault), reset needed."],
  ["FB_Edm", "Zone contactors, contactor pairs, safety valves", "The F-program switches the contactors / safe valve and checks the feedback (EDM) itself before the next start. The mirror reports a welded contactor to the HMI with a clear alarm number."],
  ["FB_TwoHand", "Two-hand control of a press / manual station", "The two-hand function (type IIIC, EN ISO 13851) is a certified block in the F-program. The mirror tells the operator 'not simultaneous – release both'."],
  ["FB_DoorLock", "Guard locking of machine guards", "Locking and unlocking after standstill are done by the F-program (ISO 14119). The standard program only REQUESTS access (xUnlockReq) and shows door / lock states."],
  ["FB_Scanner", "Safety laser scanner of an AGV station / robot cell", "The scanner itself is the safety device; the F-program reads the OSSDs. The standard program selects the field set (production / loading) – the scanner checks that the combination is valid."],
  ["FB_ModeSwitch", "Mode selector (key switch)", "Mode selection with reduced speed / enabling switch is a safety function (ISO 10218, IEC 60204-1 9.2.3). The mirror only turns the key position into iMode for PackML and the HMI."],
];
const SAFE_TEST = { FB_Safe2Ch: "E1", FB_Edm: "Z1", FB_TwoHand: "W1", FB_DoorLock: "L1", FB_Scanner: "SC1", FB_ModeSwitch: "M1" };
function html10G() {
  return card("f910G", "10G · Safety mirror FBs – the F-program does the safety function", "Safe2Ch · Edm · TwoHand · DoorLock · Scanner · ModeSwitch – diagnosis, not protection",
    intro(`<p><b>Important:</b> the protection of people is done by the <b>safety (F-) program</b> in a safety PLC (or a safety relay) with certified
      function blocks, its own password and signature, validated after ISO 13849-2 (item 7). The standard program <b>must not</b> be part of a safety
      function. But it must <b>know</b> what the safety system does – for the HMI ("door 2 open"), for the PackML state (stop the sequence cleanly),
      for alarm numbers and for diagnosis (which channel failed?).</p>
      <p>The <b>mirror FBs</b> read <b>read-only copies</b> of the F-inputs / F-outputs and repeat the same diagnosis logic (discrepancy time, reset philosophy,
      EDM time) – with the same parameters as the F-program, so that both show the same picture.</p>
      <p class="phd-eq">F-program: protects (PL d / e) &nbsp;→ copies (read only) →&nbsp; mirror FB: explains (alarm, HMI, PackML) &nbsp;·&nbsp; the mirror never writes an F-signal</p>`) +
    `<div class="mx-nav fe-inline" id="f10GSel">${SAFE.map(([t]) => `<button class="mx-el" data-safe="${t}">${t}</button>`).join("")}</div>
    <div id="f10GTxt"></div>
    <div class="fe-row"><label class="f9-scrub">tick <input type="range" id="f10GK" min="0" max="20" step="1"></label><b id="f10GKt"></b></div>
    <div class="fe-scroll" id="f10GTim"></div><div id="f10GLog" class="f9-log"></div>
    <h3 class="fe-h3">Try it – live mirror</h3><div id="f10GLive"></div>` +
    exBox("e-stop discrepancy (test E1)", `<p>Tick 20: channel 2 opens alone (one contact of the e-stop broken or a wire off). After 500 ms (tick 24) → <b>discrepancy, alarm 1</b>.
      Channel 2 closes again at 28, reset at 30: <b>refused</b> – a discrepancy may only be reset after <b>both</b> channels were open (cross-fault test, as the safety
      PLC does). The operator presses the e-stop fully (33), releases (35), resets (37) → xOk. The F-program behaves the same – the mirror only explains it.</p>`) +
    useCase(`the HMI page "safety" of every module shows the mirror FBs: device name, both channels, discrepancy, reset required. 80 % of safety stops in practice
      are doors and e-stops used normally – the mirror makes them visible in SCADA with alarm numbers (10C) so the OEE losses can be analysed.`));
}
function init10G() {
  $("f10GSel").addEventListener("click", (e) => { const b = e.target.closest("[data-safe]"); if (!b) return; S.safe = b.dataset.safe; S.safeK = null; store.set("safe", S.safe); draw10G(true); });
  $("f10GK").addEventListener("input", () => { S.safeK = +$("f10GK").value; draw10G(false); });
  draw10G(true);
}
function draw10G(rebuild) {
  const t = SAFE.some((x) => x[0] === S.safe) ? S.safe : "FB_Safe2Ch", s = SAFE.find((x) => x[0] === t), ti = EX10A.fb_tests.findIndex((x) => x.name.startsWith(SAFE_TEST[t] + " ")), test = EX10A.fb_tests[ti], r = testOf(ti), IF = ifOf(t);
  const k = S.safeK == null ? test.K - 1 : Math.min(S.safeK, test.K - 1);
  document.querySelectorAll("#f10GSel [data-safe]").forEach((b) => b.classList.toggle("active", b.dataset.safe === t));
  if (rebuild) {
    const wr = Object.keys(WRAP).filter((w) => WRAP[w] === t);
    $("f10GTxt").innerHTML = `<div class="grid2 eq"><div><h3 class="fe-h3">${t}</h3><p class="f8-pt"><b>Devices:</b> ${esc(s[1])}${wr.length ? ` (wrappers ${wr.join(", ")})` : ""}</p>
      <p class="f8-pt"><b>Who protects:</b> ${esc(s[2])}</p></div><div><h4 class="fe-h3">Rule of the mirror</h4><p class="f8-pt f10-rule">${esc(EX10A._rules[t])}</p></div></div>
      <p class="f8-pt">Unit test <b>${esc(test.name)}</b> (${test.K} ticks, ${r.log.length} log lines):</p>`;
    liveWidget($("f10GLive"), t, { selects: SELECTS });
  }
  $("f10GK").max = test.K - 1; $("f10GK").value = k; $("f10GKt").textContent = `${k} (${k * DT} ms)`;
  $("f10GTim").innerHTML = timingSvg(r.trace, IF.in, IF.out, k, { K: test.K, label: t + " unit test timing" });
  $("f10GLog").innerHTML = r.log.map((l) => { const tk = parseInt(l, 10); return `<div class="${tk === k ? "f9-lnow" : tk > k ? "f9-lfut" : ""}">${esc(l)}</div>`; }).join("");
}

/* ================================================================== 10H command interface FB_CmdIf */
function html10H() {
  return card("f910H", "10H · Command interface FB_CmdIf – echo and acceptance matrix", "test C1 · state × command per mode · reject → warning 900 + command",
    intro(`<p><b>FB_CmdIf</b> is the module side of decision D1. It sees the <b>rising edge</b> of CmdChangeRequest (word 3 bit0), checks the command against
      the PackML tables of item 5 (edge from the current state with this command label, Stop from almost every state, Abort from every state except
      Aborting / Aborted) <b>and</b> against the unit mode (Maintenance has no Suspend / Unsuspend; Manual has no Hold / Unhold / Suspend / Unsuspend).
      Accepted → CmdAck and iCmdExec = command for <b>one scan</b> (the PackML core executes it). Rejected → CmdRej, reject counter + 1, warning
      M×1000 + 900 + command. Both echoes clear when the cell controller removes its request.</p>
      <p class="phd-eq">accepted ⇔ cmd ∈ MODES[mode] ∧ (∃ edge (state, cmd) ∨ cmd = Stop ∧ state ∉ {Stopped, Stopping, Aborting, Aborted, Clearing} ∨ cmd = Abort ∧ state ∉ {Aborting, Aborted})</p>`) +
    `<h3 class="fe-h3">Unit test C1 – 4-phase echo with accept and reject</h3>
    <div class="fe-row"><label class="f9-scrub">tick <input type="range" id="f10HK" min="0" max="29" step="1"></label><b id="f10HKt"></b><span id="f10HNow" class="f8-pt"></span></div>
    <div class="fe-scroll" id="f10HTim"></div>
    <div class="grid2 eq"><div id="f10HLog" class="f9-log"></div><div id="f10HExp" class="f8-pt"></div></div>
    <h3 class="fe-h3">Acceptance matrix</h3>
    <div class="fe-row"><div class="mx-nav fe-inline" id="f10HMode">${[1, 2, 3].map((m) => `<button class="mx-el" data-mode="${m}">${m} ${MODE_N[m]}</button>`).join("")}</div><span id="f10HCnt" class="f8-pt"></span></div>
    <div id="f10HMat"></div><p class="f8-pt" id="f10HWhy">Click a cell to see why.</p>` +
    exBox("C1 step by step", `<p>Tick 2: the CC sends Start while the module is <b>Stopped</b> → no edge Stopped --Start--> → <b>CmdRej</b>, counter 1. Tick 4 the CC clears, the echo clears.
      Tick 6: Reset in Stopped → <b>CmdAck</b>, iCmdExec = 1 for one tick (tick 7 back to 0). The module goes Resetting (10) → Idle (12). Tick 14 Start in Idle → accepted.
      Tick 18 the key switch goes to <b>Manual</b> (iMode 3), state Execute: tick 20 Hold → <b>rejected</b> (Hold is not allowed in Manual), tick 24 Stop → accepted. Note
      tick 27: the request is removed only 3 ticks later – the echo stays until then (no time limit on the module side; the CC has its 2 s time-out).</p>`) +
    useCase(`the cell controller (part C) sends every command through this interface and waits for the echo; a CmdRej is logged with the state and mode – this finds
      wrong cell logic during virtual commissioning instead of on the shop floor.`));
}
function init10H() {
  const i = EX10A.fb_tests.findIndex((t) => t.fb === "FB_CmdIf"), t = EX10A.fb_tests[i];
  $("f10HK").max = t.K - 1;
  $("f10HK").addEventListener("input", () => { S.c1k = +$("f10HK").value; drawC1(); });
  $("f10HMode").addEventListener("click", (e) => { const b = e.target.closest("[data-mode]"); if (!b) return; S.cmode = +b.dataset.mode; store.set("cmode", S.cmode); draw10H(); });
  $("f10HMat").addEventListener("click", (e) => { const c = e.target.closest("[data-st]"); if (!c) return; S.ccell = [+c.dataset.st, +c.dataset.cmd]; draw10H(); });
  drawC1(); draw10H();
}
function drawC1() {
  const i = EX10A.fb_tests.findIndex((t) => t.fb === "FB_CmdIf"), t = EX10A.fb_tests[i], r = testOf(i), IF = ifOf("FB_CmdIf"), k = S.c1k == null ? t.K - 1 : S.c1k, q = r.trace[k];
  $("f10HK").value = k; $("f10HKt").textContent = `${k}`;
  $("f10HNow").innerHTML = ` state <b>${N0(q.i.iState)} ${SN[N0(q.i.iState)]}</b> · mode <b>${MODE_N[N0(q.i.iMode)]}</b> · request ${q.i.xCmdChangeRequest ? "<b>1</b> cmd " + N0(q.i.iCntrlCmd) + " " + (CN[N0(q.i.iCntrlCmd)] || "") : "0"}`;
  $("f10HTim").innerHTML = timingSvg(r.trace, IF.in, IF.out, k, { K: t.K, label: "FB_CmdIf test C1" });
  $("f10HLog").innerHTML = r.log.map((l) => { const tk = parseInt(l, 10); return `<div class="${tk === k ? "f9-lnow" : tk > k ? "f9-lfut" : ""}">${esc(l)}</div>`; }).join("");
  const last = r.trace.slice(0, k + 1).reverse().find((x) => x.i.xCmdChangeRequest && !(x.k > 0 && r.trace[x.k - 1].i.xCmdChangeRequest));
  if (last) { const [ok, why] = allowedWhy(last.i.iCntrlCmd, last.i.iState, last.i.iMode); $("f10HExp").innerHTML = `Last request at tick <b>${last.k}</b>: ${CN[N0(last.i.iCntrlCmd)]} in ${SN[N0(last.i.iState)]} (${MODE_N[N0(last.i.iMode)]}) → <b class="${ok ? "fe-ok" : "f9-bad"}">${ok ? "accepted" : "rejected"}</b> – ${esc(why)}${ok ? "" : ` · WarningNo would be 2${900 + N0(last.i.iCntrlCmd)} for module M02`}`; }
  else $("f10HExp").textContent = "No request yet.";
}
const N0 = (v) => (typeof v === "boolean" ? (v ? 1 : 0) : v);
function draw10H() {
  const m = S.cmode;
  document.querySelectorAll("#f10HMode [data-mode]").forEach((b) => b.classList.toggle("active", +b.dataset.mode === m));
  let acc = 0;
  const rows = Object.entries(STATES).map(([s, sv]) => `<tr><td><b>${sv} ${s}</b></td>${Object.entries(CMDS).map(([c, cv]) => { const [ok] = allowedWhy(cv, sv, m); if (ok) acc++; const sel = S.ccell && S.ccell[0] === sv && S.ccell[1] === cv; return `<td class="f10-mc ${ok ? "f10-ok" : "f10-no"}${sel ? " f10-sel" : ""}" data-st="${sv}" data-cmd="${cv}" title="${s} + ${c}">${ok ? "✓" : "·"}</td>`; }).join("")}</tr>`);
  $("f10HMat").innerHTML = tab(["State \\ command", ...Object.entries(CMDS).map(([c, v]) => `${v} ${c}`)], rows, "f8-small f10-mat");
  $("f10HCnt").textContent = `${acc} of ${17 * 9} state × command pairs accepted in ${MODE_N[m]} mode`;
  if (S.ccell) { const [sv, cv] = S.ccell, [ok, why] = allowedWhy(cv, sv, m); $("f10HWhy").innerHTML = `<b>${SN[sv]} + ${CN[cv]}</b> in ${MODE_N[m]}: <b class="${ok ? "fe-ok" : "f9-bad"}">${ok ? "CmdAck" : "CmdRej"}</b> – ${esc(why)}${ok ? "" : ` → warning M×1000 + 900 + ${cv}`}`; }
}

export { S, R };
