/* FMS engineering – item 9: PLC programming principles.  Loaded by fmse.js (build "9").
 * 9A IEC 61131-3 overview · 9B scan, reaction time, tasks (RTA), overflow · 9C standard FB lab (40-scan timing diagram)
 * 9D analog input (NE 43) + limit alarms · 9E FB_MotorDol simulator · 9F APC01 sequence inside PackML · 9G data block view.
 * 9H–9N (alarms ISA-18.2, code generator, coding standard, testing, effort, cases, checklists) live in fmse9y.js.
 * Engine: fmse9x.js (rules = EX9._rules of tools/fmse/examples/item9_examples.json, exactly; code generator re-uses fmse8x.js).
 * Offline; user choices in localStorage "fmse.9.*". Test hook: window.fe9.results() (always from the JSON). */
import { $, esc, fx, ul, card, tab, kv, kpis, intro, useCase } from "./fmse8x.js";
import {
  EX9, STATES, EDGES, response, tasks, overflow, fbTrace, FB_KEYS, analog, limits, motor, M_ALM, M_SN, moduleRun, R_ALM, DUR, allResults,
  store9 as store, exBox, pre, onoff, bin, parseRanges, fmtRanges,
} from "./fmse9x.js";
import { POU, LANGS, LANG_ST, LANG_IL, VENDOR, VENDOR_HEAD, ST_MOTOR, ST_APC } from "./fmse9_data.js";
import { POS } from "./fmse5_data.js";
import { BLOCK } from "./fmse6_data.js";
import * as Y from "./fmse9y.js";

const R = { errors: [] };
const S = {
  resp: store.get("resp", Object.assign({}, EX9.response_cases[1])), tset: store.get("tset", 0), tasks: store.get("tasks", null),
  fb: store.get("fb", null), raw: store.get("raw", 6912), lim: store.get("lim", null),
  msc: store.get("msc", 0), mk: 0, rsc: store.get("rsc", 0), rk: 12, a: { start: false, stop: false, lamp: false },
};
const timers = {};
const stopPlay = (k) => { if (timers[k]) { clearInterval(timers[k]); timers[k] = null; } };

export function mount(el) {
  el.innerHTML = htmlTop() + [html9A(), html9B(), html9C(), html9D(), html9E(), html9F(), html9G()].join("") + Y.html();
  [init9A, init9B, init9C, init9D, init9E, init9F, Y.init].forEach((f) => { try { f(el); } catch (e) { console.error("fmse9 " + f.name, e); R.errors.push(f.name + ": " + e.message); } });
  window.fe9 = { results: allResults, R, S, Y: Y.S, setMotor: (sc, k) => { S.msc = sc; S.mk = k; draw9E(); }, setRun: (sc, k) => { S.rsc = sc; S.rk = k; draw9F(); } };
}

function htmlTop() {
  return `<div class="card f8-warnbox"><p><b>Example values only.</b> The data on this page (file <code>tools/fmse/examples/item9_examples.json</code>,
    shared with guide 69 and the Python tools) are <b>teaching examples</b>: task times, timeouts, alarm lists, effort coefficients. The function
    blocks shown are simplified so that every rule can be checked by hand. <b>Safety functions are programmed only in the safety (F-) program</b>
    by qualified people with certified blocks; the standard program on this page only <b>reads</b> safety signals. Real programs follow the PLC
    maker's manual, IEC 61131-3, the plant software standard and are tested (9K) before use.</p></div>`;
}

/* ================================================================== SVG helpers */
const L = (x1, y1, x2, y2, c = "f9-w") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
const T = (x, y, t, a = "start", c = "f9-sm") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`;
const RC = (x, y, w, h, c = "f9-box", rx = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${c}"/>`;
const svg = (w, h, body, cls, label) => `<svg viewBox="0 0 ${w} ${h}" class="${cls}" role="img" aria-label="${esc(label)}">${body}</svg>`;
const arrowDefs = (id) => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="f9-ah"/></marker></defs>`;
/** box-edge to box-edge arrow between two centred boxes (w×h) */
function edge(a, b, w, h, cls, mk, bend = 0) {
  const dx = b[0] - a[0], dy = b[1] - a[1], cut = (px, py) => { const sx = Math.abs(px) * h, sy = Math.abs(py) * w; return sx > sy ? (w / 2) / Math.abs(px || 1e-9) : (h / 2) / Math.abs(py || 1e-9); };
  const ta = cut(dx, dy), x1 = a[0] + dx * Math.min(ta, 0.5) * 1, y1 = a[1] + dy * Math.min(ta, 0.5);
  const tb = cut(-dx, -dy), x2 = b[0] - dx * Math.min(tb, 0.5), y2 = b[1] - dy * Math.min(tb, 0.5);
  if (!bend) return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" class="${cls}" marker-end="url(#${mk})"/>`;
  const mx = (x1 + x2) / 2 - dy * bend, my = (y1 + y2) / 2 + dx * bend;
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" class="${cls}" marker-end="url(#${mk})"/>`;
}

/* ================================================================== 9A IEC 61131-3 overview */
function html9A() {
  return card("f99A", "9A · IEC 61131-3 – the common language of PLCs", "software model · POU types · 5 languages with the same example · vendor terms",
    intro(`<p><b>IEC 61131-3</b> is the international standard for PLC programming (edition 3, 2013; edition 4, 2025, removes IL). Every big PLC
      maker follows it more or less – the names differ (Siemens "FB + instance DB", Rockwell "AOI"), the ideas are the same. Knowing the standard
      means you can read and specify software for any brand.</p>
      <p><b>Software model:</b> a <b>configuration</b> (the PLC system) holds one or more <b>resources</b> (CPUs). A resource runs <b>tasks</b>
      (cyclic every T ms, or on an event). A task calls <b>programs</b>; programs call <b>function block instances</b> and <b>functions</b>.
      Data lives in variables: local, global (GVL), and the <b>IO image</b> (%I inputs, %Q outputs, %M memory).</p>
      <p class="phd-eq">Configuration ⊃ Resource ⊃ Task (period T, priority) → Program → FB instances (own memory) + Functions (no memory)</p>
      <p><b>Why FBs matter for an FMS:</b> a valve, a motor, a module state machine is written <b>once</b> as an FB and used as many instances
      as needed. Each instance keeps its own timer, step and alarm. That is how a standard library (item 10) is built – and how 9I can
      generate code from the item 8 circuit library.</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Software model</h3><div class="fe-scroll">${svgModel()}</div></div>
      <div><h3 class="fe-h3">POU types (program organisation units)</h3>${tab(["POU", "What it is", "Examples (FMS)", "Vendor names"], POU.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td class="f9-mono">${esc(r[2])}</td><td class="sub">${esc(r[3])}</td></tr>`), "f8-small")}</div></div>
    <h3 class="fe-h3">The five languages – the same seal-in circuit (Start pushes the lamp on, it stays on until Stop)</h3>
    <div class="fe-row"><label><input type="checkbox" id="f9AStart"> xStart (NO push-button)</label><label><input type="checkbox" id="f9AStop"> xStop (pressed = TRUE)</label>
      <button class="mx-el" id="f9AScan">Run one scan</button><span id="f9ALamp" class="f8-pt"></span></div>
    <div class="f9-langs" id="f9ALangs"></div>
    ${tab(["Lang.", "Name", "When to use"], LANGS.map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${esc(r[2])}</td></tr>`), "f8-small")}
    <h3 class="fe-h3">Same idea, different words – vendor term table</h3>
    ${tab(VENDOR_HEAD, VENDOR.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<td><b>${esc(c)}</b></td>`)).join("")}</tr>`), "f8-small f9-vendor")}` +
    exBox("the APC01 module in the software model", `<p>Cell PLC = configuration "FMS1", one CPU = resource. Task <b>Main</b> (10 ms, priority 2)
      calls program <b>PRG_Cell</b>. PRG_Cell calls the instance <b>APC01 : FB_ModuleAPC</b>. Inside it: <b>PackML : FB_PackML</b> (state machine,
      item 5), <b>Rotate : FB_Valve2</b>, <b>Clamp : FB_Valve1</b>, <b>PalSideA/B : FB_Sensor</b>, <b>ClampPress : FB_AnalogIn</b> (exactly the
      instance list that 9I generates from item 8). Three pallet changers = three instances APC01–APC03 of the same FB – one code, three memories.</p>`) +
    useCase(`the owner writes in the specification: "IEC 61131-3 structured text for logic, FBD allowed in the F-program, no IL, one FB per device
      type from the plant library". Then any integrator (Siemens, Beckhoff, Rockwell …) delivers code that the plant's maintenance programmers can read.`));
}
function svgModel() {
  let b = RC(6, 6, 488, 288, "f9-cfg", 8) + T(16, 24, "<tspan class='f9-b'>Configuration</tspan> FMS1 (PLC system)", "start", "f9-lbl");
  b += RC(20, 34, 460, 218, "f9-res", 6) + T(30, 52, "<tspan class='f9-b'>Resource</tspan> CPU 1", "start", "f9-lbl");
  [["Task Fast_Motion", "2 ms · prio 1", 34], ["Task Main", "10 ms · prio 2", 184], ["Task Comm", "100 ms · prio 3", 334]].forEach(([n, s, x]) => {
    b += RC(x, 62, 138, 36, "f9-task") + T(x + 69, 77, n, "middle", "f9-sm f9-b") + T(x + 69, 91, s, "middle", "f9-xs");
  });
  b += RC(34, 110, 138, 30, "f9-prg") + T(103, 129, "PRG_Motion", "middle") + RC(184, 110, 138, 30, "f9-prg") + T(253, 129, "PRG_Cell", "middle") + RC(334, 110, 138, 30, "f9-prg") + T(403, 129, "PRG_Comm", "middle");
  b += L(103, 98, 103, 110) + L(253, 98, 253, 110) + L(403, 98, 403, 110);
  b += RC(184, 152, 138, 30, "f9-fb") + T(253, 166, "APC01 :", "middle", "f9-xs") + T(253, 177, "FB_ModuleAPC", "middle", "f9-xs f9-b") + L(253, 140, 253, 152);
  [["PackML", 30], ["Rotate", 112], ["Clamp", 194], ["ClampPress", 290], ["…", 380]].forEach(([n, x]) => { b += RC(x, 200, n === "…" ? 40 : 74, 24, "f9-fb", 3) + T(x + (n === "…" ? 20 : 37), 216, n, "middle", "f9-xs"); b += L(253, 182, x + (n === "…" ? 20 : 37), 200, "f9-thin"); });
  b += T(30, 244, "FB instances: code once, memory per instance", "start", "f9-xs");
  b += RC(20, 260, 220, 26, "f9-gvl") + T(130, 277, "GVL_IO  %IX / %QX / %IW (9I)", "middle", "f9-xs") + RC(260, 260, 220, 26, "f9-gvl") + T(370, 277, "Module data blocks (item 6)", "middle", "f9-xs");
  return svg(500, 300, b, "f9-model", "IEC 61131-3 software model: configuration, resource, tasks, programs, FB instances");
}
function init9A() {
  const draw = () => {
    const a = S.a, on = a.lamp;
    $("f9ALamp").innerHTML = `xLamp = <b class="${on ? "fe-ok" : ""}">${on ? "TRUE" : "FALSE"}</b>`;
    const c = (v) => (v ? "f9-hot" : "f9-w"), st = a.start, sp = a.stop;
    // LD
    let ld = L(10, 10, 10, 110, "f9-rail") + L(450, 10, 450, 110, "f9-rail");
    ld += L(10, 40, 70, 40, c(true)) + L(70, 30, 70, 50, c(true)) + L(90, 30, 90, 50, c(st)) + T(80, 22, "xStart", "middle", "f9-xs");
    ld += L(90, 40, 200, 40, c(st || on)) + L(200, 30, 200, 50, c(st || on)) + L(220, 30, 220, 50, c((st || on) && !sp)) + L(200, 50, 220, 30, c(st || on)) + T(210, 22, "xStop", "middle", "f9-xs");
    ld += L(220, 40, 360, 40, c((st || on) && !sp)) + `<path d="M360 30a10 10 0 0 0 0 20M384 30a10 10 0 0 1 0 20" class="${c(on)}"/>` + L(384, 40, 450, 40, c(on)) + T(372, 22, "xLamp", "middle", "f9-xs");
    ld += L(10, 80, 40, 80, c(true)) + L(40, 80, 70, 80, c(true)) + L(70, 70, 70, 90, c(true)) + L(90, 70, 90, 90, c(on)) + T(80, 104, "xLamp", "middle", "f9-xs") + L(90, 80, 140, 80, c(on)) + L(140, 80, 140, 40, c(on));
    // FBD
    let fb = RC(150, 20, 60, 50, "f9-blk") + T(180, 50, "≥1", "middle", "f9-lbl") + RC(270, 30, 60, 50, "f9-blk") + T(300, 60, "&amp;", "middle", "f9-lbl");
    fb += T(70, 34, "xStart", "end", "f9-xs") + L(74, 30, 150, 30, c(st)) + T(70, 64, "xLamp", "end", "f9-xs") + L(74, 60, 150, 60, c(on)) + L(210, 45, 270, 45, c(st || on));
    fb += T(190, 99, "xStop", "end", "f9-xs") + L(194, 95, 240, 95, c(sp)) + L(240, 95, 240, 68, c(sp)) + L(240, 68, 264, 68, c(sp)) + `<circle cx="267" cy="68" r="3" class="f9-sym"/>` + L(330, 55, 400, 55, c(on)) + T(404, 59, "xLamp", "start", "f9-xs");
    // SFC
    let sf = RC(30, 10, 70, 30, on ? "f9-box" : "f9-act", 0) + RC(34, 14, 62, 22, "f9-none", 0) + T(65, 30, "S0 Off", "middle") + L(65, 40, 65, 70) + L(50, 55, 80, 55, "f9-pw") + T(88, 59, "xStart AND NOT xStop", "start", "f9-xs");
    sf += RC(30, 70, 70, 30, on ? "f9-act" : "f9-box", 0) + T(65, 90, "S1 On", "middle") + RC(110, 74, 100, 22, "f9-box", 0) + T(160, 89, "N  xLamp", "middle", "f9-xs") + L(100, 85, 110, 85);
    sf += L(65, 100, 65, 120) + L(50, 112, 80, 112, "f9-pw") + T(88, 116, "xStop", "start", "f9-xs") + `<path d="M65 120H18V25H30" class="f9-w" marker-end="url(#f9aA)"/>`;
    $("f9ALangs").innerHTML = [
      ["LD – ladder diagram", `<div class="fe-scroll">${svg(460, 112, ld, "f9-lang", "Ladder diagram of the seal-in circuit")}</div>`],
      ["FBD – function block diagram", `<div class="fe-scroll">${svg(460, 112, fb, "f9-lang", "Function block diagram of the seal-in circuit")}</div>`],
      ["ST – structured text", pre(LANG_ST)],
      ["IL – instruction list (deprecated)", pre(LANG_IL)],
      ["SFC – sequential function chart", `<div class="fe-scroll">${svg(300, 130, arrowDefs("f9aA") + sf, "f9-lang f9-sfc", "Sequential function chart of the seal-in circuit")}</div>`],
    ].map(([h, b]) => `<div class="f9-langbox"><h4>${h}</h4>${b}</div>`).join("") +
      `<p class="am-note f9-span">Highlighted = TRUE (power flow). All five give the same result after a scan: xLamp := (xStart OR xLamp) AND NOT xStop. Tick the boxes, then press "Run one scan".</p>`;
  };
  const scan = () => { S.a.start = $("f9AStart").checked; S.a.stop = $("f9AStop").checked; S.a.lamp = (S.a.start || S.a.lamp) && !S.a.stop; draw(); };
  $("f9AScan").addEventListener("click", scan);
  ["f9AStart", "f9AStop"].forEach((id) => $(id).addEventListener("change", () => { S.a.start = $("f9AStart").checked; S.a.stop = $("f9AStop").checked; draw(); }));
  draw();
}

/* ================================================================== 9B scan, reaction time, tasks, overflow */
const RESP_F = [["t_in", "input filter / delay t<sub>in</sub> ms"], ["T_bus", "bus cycle T<sub>bus</sub> ms (0 = local IO)"], ["T_scan", "task period T<sub>scan</sub> ms"], ["t_out", "output delay t<sub>out</sub> ms"], ["v_mm_s", "speed of the moving part mm/s"]];
function html9B() {
  return card("f99B", "9B · Scan cycle, reaction time and tasks", "IPO cycle · worst-case reaction DI → DO · task utilisation · response-time analysis · counter overflow",
    intro(`<p>A PLC works in a <b>cycle</b> (scan): <b>1</b> read all inputs into the input image, <b>2</b> run the program with that image,
      <b>3</b> write the output image to the outputs, then again. An input that changes <i>just after</i> step 1 is seen only in the next scan.
      So the reaction time is not one scan but up to two – plus filters, bus cycles and the output delay:</p>
      <p class="phd-eq">t<sub>min</sub> = t<sub>in</sub> + T<sub>scan</sub> + t<sub>out</sub> &nbsp;·&nbsp; t<sub>max</sub> = t<sub>in</sub> + 2·T<sub>bus</sub> + 2·T<sub>scan</sub> + t<sub>out</sub> &nbsp;·&nbsp; distance = v · t<sub>max</sub> ÷ 1000 mm</p>
      <p>Modern PLCs run several <b>tasks</b> (cyclic with fixed period, higher priority interrupts lower). Each task i has period T<sub>i</sub>,
      execution time C<sub>i</sub> and priority. Check that all fit:</p>
      <p class="phd-eq">U = Σ C<sub>i</sub>/T<sub>i</sub> ≤ n·(2<sup>1/n</sup> − 1) (Liu–Layland, sufficient only) &nbsp;·&nbsp; exact: R<sub>k+1</sub> = C<sub>i</sub> + Σ<sub>j higher</sub> ⌈R<sub>k</sub>/T<sub>j</sub>⌉·C<sub>j</sub> until R stops changing; OK if R ≤ T<sub>i</sub></p>
      <p>R is the <b>worst-case response time</b>: the task's own work plus every interruption by higher-priority tasks. The bound test can fail
      although the set works (set "Tight"); the response-time analysis (RTA) decides. Keep the measured load below about 70 % for later changes.</p>`) +
    `<h3 class="fe-h3">Reaction time calculator</h3>
    <div class="fe-row"><label>Case <select id="f9BCase" class="fe-sel">${EX9.response_cases.map((c, i) => `<option value="${i}">${esc(c.name)}</option>`).join("")}<option value="-1">(own values)</option></select></label></div>
    <div class="fe-row">${RESP_F.map(([k, l]) => `<label>${l} <input type="number" step="any" min="0" data-rk="${k}"></label>`).join("")}</div>
    <div id="f9BResp"></div><div class="fe-scroll" id="f9BTl"></div>
    ${tab(["Case (JSON)", "t<sub>in</sub>", "T<sub>bus</sub>", "T<sub>scan</sub>", "t<sub>out</sub>", "t<sub>min</sub> ms", "t<sub>max</sub> ms", "distance at 500 mm/s"], EX9.response_cases.map((c) => { const r = response(c); return `<tr><td>${esc(c.name)}</td><td class="f8-r">${c.t_in}</td><td class="f8-r">${c.T_bus}</td><td class="f8-r">${c.T_scan}</td><td class="f8-r">${c.t_out}</td><td class="f8-r">${r.tmin}</td><td class="f8-r"><b>${r.tmax}</b></td><td class="f8-r">${r.dist} mm</td></tr>`; }), "f8-small")}
    <h3 class="fe-h3">Task set – utilisation and response-time analysis</h3>
    <div class="fe-row"><label>Task set <select id="f9BSet" class="fe-sel">${EX9.task_sets.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join("")}</select></label><button class="mx-el" id="f9BRst">Reset to JSON</button><span class="sub">edit T, C and priority (µs)</span></div>
    <div id="f9BTasks"></div><div id="f9BRta"></div>
    <h3 class="fe-h3">Counter and timer overflow</h3>
    <p class="phd-eq">time to overflow = max value ÷ increments per second &nbsp;·&nbsp; TIME = 32-bit signed ms → 2 147 483 647 ms = 24 d 20 h 31 min 23.647 s</p>
    ${tab(["Variable", "Max value", "Increments / s", "Seconds", "Days", "Years"], EX9.overflow.map((x) => { const r = overflow(x); return `<tr><td>${esc(r.name)}</td><td class="f8-r">${r.max.toLocaleString("en")}</td><td class="f8-r">${fx(r.rate, 4)}</td><td class="f8-r">${r.s.toLocaleString("en", { minimumFractionDigits: 1 })}</td><td class="f8-r"><b>${fx(r.d, 2)}</b></td><td class="f8-r">${fx(r.y, 2)}</td></tr>`; }), "f8-small")}
    <div class="fe-row"><label>Own: max value <input type="number" id="f9BOvM" value="65535"></label><label>increments / s <input type="number" step="any" id="f9BOvR" value="1"></label><span id="f9BOv" class="f8-pt"></span></div>` +
    exBox("is a 10 ms task fast enough for an AGV docking stop?", `<p>Remote IO on PROFINET (T<sub>bus</sub> 2 ms), input filter 3 ms, output 0.5 ms,
      task 10 ms → t<sub>max</sub> = 3 + 2·2 + 2·10 + 0.5 = <b>27.5 ms</b>. At 500 mm/s the carriage moves 0.5 × 27.5 = <b>13.8 mm</b> before the output
      even switches (plus the brake distance). If the stop must be within ±5 mm: use a 2 ms task with 0.1 ms filter (6.2 ms → 3.1 mm) or a hardware
      stop input of the drive. A signal that goes via the cell controller (Modbus poll 100 ms) needs 223.5 ms → <b>never</b> use it for a stop.</p>
      <p><b>Overflow:</b> a TIME accumulator wraps after 24.86 days – a machine running 4 weeks non-stop shows a negative run time. A UINT heartbeat
      (+1 / 100 ms) wraps every 6553.5 s: the partner must compare "changed?", not "greater?".</p>`) +
    useCase(`the integrator fills this table in the functional design (FDS) for every time-critical signal: stacker end-of-travel, APC clamp, light
      curtain muting, AGV position. The owner checks that no stop or interlock depends on the cell controller or SCADA cycle (item 5: "fast decisions low").`));
}
function init9B() {
  const inputs = () => [...document.querySelectorAll("#f99B [data-rk]")];
  const fill = () => inputs().forEach((i) => { i.value = S.resp[i.dataset.rk]; });
  const drawR = () => {
    const r = response(S.resp), c = S.resp;
    $("f9BResp").innerHTML = kpis([["t<sub>min</sub> ms", r.tmin], ["t<sub>max</sub> ms (worst case)", r.tmax, "f9-strong"], ["travel during t<sub>max</sub>", r.dist + " mm"]]) +
      `<p class="am-note">t<sub>max</sub> = ${c.t_in} + 2·${c.T_bus} + 2·${c.T_scan} + ${c.t_out} = <b>${r.tmax} ms</b> · distance = ${c.v_mm_s} × ${r.tmax} ÷ 1000 = <b>${r.dist} mm</b></p>`;
    // worst case timeline
    const segs = [["t_in", c.t_in, "f9-s1", "filter"], ["bus", c.T_bus, "f9-s2", "bus in"], ["wait", c.T_scan, "f9-s3", "waits for next scan"], ["scan", c.T_scan, "f9-s4", "processed"], ["bus", c.T_bus, "f9-s2", "bus out"], ["t_out", c.t_out, "f9-s1", "output"]];
    const tot = r.tmax || 1, W = 680; let x = 10, b = "";
    segs.forEach(([, v, cl, lab]) => { const w = (v / tot) * W; if (w > 0) { b += RC(x, 20, Math.max(w, 0.5), 26, cl, 0); if (w > 44) b += T(x + w / 2, 37, lab, "middle", "f9-xs"); x += w; } });
    b += T(10, 14, "input changes", "start", "f9-xs") + T(10 + W, 14, `output switched after ${r.tmax} ms`, "end", "f9-xs") + L(10, 50, 10 + W, 50, "f9-axis");
    for (let t = 0; t <= tot + 1e-9; t += niceStep(tot)) { const xx = 10 + (t / tot) * W; b += L(xx, 50, xx, 54, "f9-axis") + T(xx, 66, fx(t, t % 1 ? 1 : 0), "middle", "f9-xs"); }
    $("f9BTl").innerHTML = svg(700, 72, b, "f9-tl", "Worst-case reaction time line");
  };
  inputs().forEach((i) => i.addEventListener("input", () => { const v = parseFloat(i.value); if (Number.isFinite(v)) { S.resp[i.dataset.rk] = v; $("f9BCase").value = "-1"; store.set("resp", S.resp); drawR(); } }));
  $("f9BCase").addEventListener("change", () => { const i = +$("f9BCase").value; if (i >= 0) { S.resp = Object.assign({}, EX9.response_cases[i]); store.set("resp", S.resp); fill(); drawR(); } });
  const ci = EX9.response_cases.findIndex((c) => RESP_F.every(([k]) => c[k] === S.resp[k])); $("f9BCase").value = String(ci);
  fill(); drawR();
  // tasks
  const getTasks = () => S.tasks || EX9.task_sets[S.tset].tasks.map((x) => x.slice());
  const drawT = () => {
    const ts = getTasks(), r = tasks(ts);
    $("f9BSet").value = String(S.tset);
    $("f9BTasks").innerHTML = tab(["Task", "Period T µs", "Execution C µs", "Priority", "C/T"], ts.map((t, i) => `<tr><td>${esc(t[0])}</td><td><input type="number" min="1" data-ti="${i}" data-tc="1" value="${t[1]}"></td><td><input type="number" min="0" data-ti="${i}" data-tc="2" value="${t[2]}"></td><td><input type="number" min="1" data-ti="${i}" data-tc="3" value="${t[3]}"></td><td class="f8-r">${fx(t[2] / t[1], 4)}</td></tr>`), "f8-small f9-tin");
    const ok = r.rows.every((x) => x.ok);
    $("f9BRta").innerHTML = kpis([["utilisation U", fx(r.U, 4)], ["Liu–Layland bound", fx(r.bound, 4)], ["bound test", r.boundOk ? "passes" : "fails", r.boundOk ? "fe-ok" : "f9-warn"], ["RTA (exact)", ok ? "all deadlines met" : "deadline MISS", ok ? "fe-ok" : "f9-bad"]]) +
      `<div class="f9-ubar">${r.rows.map((x, i) => `<i class="fe-c${(i % 6) + 1}" style="width:${Math.min(100, x.u * 100).toFixed(2)}%" title="${esc(x.name)} ${fx(x.u * 100, 1)} %"></i>`).join("")}</div>
      <p class="am-note">Bar = share of CPU time per task (100 % = full). Bound test: U ${r.boundOk ? "≤" : ">"} bound → ${r.boundOk ? "schedulable for sure" : "no conclusion – use the RTA"}.</p>` +
      tab(["Task (priority order)", "Iterations R<sub>0</sub> → R<sub>k</sub> µs", "R µs", "R / T", "Result"], r.rows.map((x) => `<tr><td>${esc(x.name)}</td><td class="f9-mono">${x.iter.join(" → ")}</td><td class="f8-r"><b>${x.R.toLocaleString("en")}</b></td><td class="f8-r">${fx(x.RT, 3)}</td><td class="${x.ok ? "fe-ok" : "f9-bad"}">${x.ok ? "OK" : "MISS (R > T)"}</td></tr>`), "f8-small");
    document.querySelectorAll("#f9BTasks [data-ti]").forEach((inp) => inp.addEventListener("change", () => {
      const v = Math.round(+inp.value); if (!(v >= (inp.dataset.tc === "2" ? 0 : 1))) return;
      S.tasks = getTasks(); S.tasks[+inp.dataset.ti][+inp.dataset.tc] = v; store.set("tasks", S.tasks); drawT();
    }));
  };
  $("f9BSet").addEventListener("change", () => { S.tset = +$("f9BSet").value; S.tasks = null; store.set("tset", S.tset); store.del("tasks"); drawT(); });
  $("f9BRst").addEventListener("click", () => { S.tasks = null; store.del("tasks"); drawT(); });
  drawT();
  const ov = () => { const m = +$("f9BOvM").value, rr = +$("f9BOvR").value; if (!(m > 0 && rr > 0)) { $("f9BOv").textContent = "enter positive numbers"; return; } const r = overflow(["own", m, rr]); $("f9BOv").innerHTML = `→ ${r.s.toLocaleString("en")} s = <b>${fx(r.d, 2)} days</b> = ${fx(r.y, 2)} years`; };
  ["f9BOvM", "f9BOvR"].forEach((id) => $(id).addEventListener("input", ov)); ov();
}
function niceStep(t) { const raw = t / 8, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }

/* ================================================================== 9C standard FB lab */
const FB_ROWS = [["A", "A", "d"], ["B", "B", "d"], ["RST", "RST", "d"], ["LD", "LD", "d"], ["TON.Q", "TON_Q", "d"], ["TON.ET", "TON_ET", "t"], ["TOF.Q", "TOF_Q", "d"], ["TOF.ET", "TOF_ET", "t"], ["TP.Q", "TP_Q", "d"], ["TP.ET", "TP_ET", "t"],
  ["R_TRIG.Q", "RTRIG", "d"], ["F_TRIG.Q", "FTRIG", "d"], ["CTU.CV", "CTU_CV", "n"], ["CTU.Q", "CTU_Q", "d"], ["CTD.CV", "CTD_CV", "n"], ["CTD.Q", "CTD_Q", "d"], ["SR.Q1", "SR", "d"], ["RS.Q1", "RS", "d"]];
const fbDef = () => JSON.parse(JSON.stringify(EX9.fb_trace));
function html9C() {
  return card("f99C", "9C · Standard function block lab", "TON · TOF · TP · R_TRIG · F_TRIG · CTU · CTD · SR · RS – scan by scan (dt = 10 ms)",
    intro(`<p>IEC 61131-3 defines a small set of <b>standard FBs</b>. Every PLC has them; they are the bricks inside every device FB. Because they are
      FBs they have memory – each instance remembers its start time, its last input, its count. The lab runs them <b>scan by scan</b> exactly like a PLC:
      at every scan k (time t = k·10 ms) each FB reads its inputs once and computes its outputs.</p>
      <p class="phd-eq">TON: Q = IN for ≥ PT · TOF: Q stays TRUE for PT after IN falls · TP: pulse of PT on a rising edge · R_TRIG / F_TRIG: one scan on a rising / falling edge ·
      CTU: CV +1 per rising edge of CU, R → 0, Q = CV ≥ PV · CTD: CV −1 per edge, LD → PV, Q = CV ≤ 0 · SR: Q1 = S1 OR (NOT R AND Q1) (set wins) · RS: Q1 = NOT R1 AND (S OR Q1) (reset wins)</p>
      <p>Wiring in the lab: TON/TOF/TP IN = A · R_TRIG/F_TRIG CLK = A · CTU CU = A, R = RST · CTD CD = A, LD = LD · SR S1 = A, R = B · RS S = A, R1 = B.
      <b>Note:</b> F_TRIG here starts with "previous = FALSE" – some platforms give a pulse in the very first scan; check yours.</p>`) +
    `<div class="fe-row"><label>PT ms <input type="number" id="f9CPT" min="0" step="10"></label><label>PV <input type="number" id="f9CPV" min="0" step="1"></label><label>scans N <input type="number" id="f9CN" min="5" max="200" step="1"></label>
      <button class="mx-el" id="f9CRst">Reset to JSON</button></div>
    <div class="fe-row f9-sigin">${["A", "B", "RST", "LD"].map((k) => `<label>${k} TRUE on scans <input type="text" data-sig="${k}" placeholder="e.g. 2-8, 15-29"></label>`).join("")}</div>
    <div class="fe-scroll" id="f9CSvg"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Events (scans where an output changes)</h3><div id="f9CEv"></div></div>
      <div><h3 class="fe-h3">What to see</h3>${ul([
        "TON: A is TRUE for scans 2–8 (70 ms) → Q at scan 7 (50 ms after 2). The short pulse 11–12 never reaches PT – a TON <b>filters</b> short signals.",
        "TOF: Q goes TRUE with A and stays TRUE until 50 ms after the <b>last</b> falling edge – used for run-on of fans, conveyor gaps.",
        "TP: pulse on scans 2–6 (50 ms) although A stays TRUE until 8. The 2-scan signal at 11 gives a full 50 ms pulse (11–15) – a TP <b>stretches</b> short signals. The edge at 15 is ignored: that pulse is still running.",
        "CTU counts edges 2, 11, 15 → Q at 15; RST at 33 clears it. CTD is loaded with PV at scan 0 and 36.",
        "SR vs RS: at scans 6–7 A and B are both TRUE → SR keeps Q1 TRUE (set dominant), RS gives FALSE (reset dominant).",
      ])}</div></div>` +
    exBox("which standard FB for which job in a module?", `${ul([
      "<b>TON</b>: step timeout (APC rotate must reach the end position within 5 s), sensor debounce (part present 200 ms), \"air pressure low for 2 s\" alarm.",
      "<b>TOF</b>: chip conveyor runs 30 s after the spindle stops; light stays on 60 s after the door closes.",
      "<b>TP</b>: fixed 300 ms pulse for an impulse valve or a counter output to the ERP light tower.",
      "<b>R_TRIG</b>: a command is executed once per press (Start, Reset) – without it a held button would restart the motor every scan (see 9E).",
      "<b>CTU</b>: parts per pallet, tool life in cuts; <b>CTD</b>: remaining parts of a job.",
      "<b>SR/RS</b>: prefer RS (reset wins) for anything that must stop safely; better still: a state machine instead of loose latches.",
    ])}`) +
    useCase(`the FB library of item 10 is built from these bricks. A unit test (9K) of a device FB runs a scripted input trace like this one and compares
      every output with the expected trace – the same 40-scan table is used in the Python tool and the guide, so all three must give identical events.`));
}
function init9C() {
  if (!S.fb) S.fb = fbDef();
  const fill = () => {
    $("f9CPT").value = S.fb.PT_ms; $("f9CPV").value = S.fb.PV; $("f9CN").value = S.fb.N;
    document.querySelectorAll("#f99C [data-sig]").forEach((i) => { i.value = fmtRanges(S.fb.signals[i.dataset.sig] || []); });
  };
  const save = () => store.set("fb", S.fb);
  $("f9CPT").addEventListener("input", () => { const v = +$("f9CPT").value; if (v >= 0) { S.fb.PT_ms = v; save(); draw9C(); } });
  $("f9CPV").addEventListener("input", () => { const v = Math.round(+$("f9CPV").value); if (v >= 0) { S.fb.PV = v; save(); draw9C(); } });
  $("f9CN").addEventListener("input", () => { const v = Math.round(+$("f9CN").value); if (v >= 5 && v <= 200) { S.fb.N = v; save(); draw9C(); } });
  document.querySelectorAll("#f99C [data-sig]").forEach((i) => i.addEventListener("change", () => { S.fb.signals[i.dataset.sig] = parseRanges(i.value); i.value = fmtRanges(S.fb.signals[i.dataset.sig]); save(); draw9C(); }));
  $("f9CRst").addEventListener("click", () => { S.fb = fbDef(); store.del("fb"); fill(); draw9C(); });
  fill(); draw9C();
}
function draw9C() {
  const F = S.fb, r = fbTrace(F), N = F.N, x0 = 78, W = 820, dx = (W - x0 - 10) / N, rh = 22;
  let b = "";
  for (let k = 0; k <= N; k++) { const x = x0 + k * dx; b += L(x, 14, x, 14 + FB_ROWS.length * rh, k % 5 ? "f9-grid" : "f9-grid2"); if (k % 5 === 0 && k < N) b += T(x + 1, 11, String(k), "start", "f9-xs"); }
  FB_ROWS.forEach(([lab, key, kind], i) => {
    const y = 14 + i * rh, top = y + 4, bot = y + rh - 4;
    b += T(x0 - 6, y + rh / 2 + 4, lab, "end", i < 4 ? "f9-sm f9-b" : "f9-sm");
    if (kind === "d") {
      let d = "";
      r.rows.forEach((row, k) => { const yy = row[key] ? top : bot, x = x0 + k * dx; d += (k ? `L${x.toFixed(1)} ${yy}` : `M${x} ${yy}`) + `L${(x + dx).toFixed(1)} ${yy}`; if (row[key]) b += RC(x, top, dx, bot - top, i < 4 ? "f9-fin" : "f9-fout", 0); });
      b += `<path d="${d}" class="${i < 4 ? "f9-tin2" : "f9-tout"}"/>`;
    } else if (kind === "t") {
      const PT = Math.max(1, F.PT_ms); let d = "";
      r.rows.forEach((row, k) => { const yy = bot - (row[key] / PT) * (bot - top), x = x0 + k * dx; d += (k ? `L${x.toFixed(1)} ${yy.toFixed(1)}` : `M${x} ${yy.toFixed(1)}`) + `L${(x + dx).toFixed(1)} ${yy.toFixed(1)}`; });
      b += `<path d="${d}" class="f9-tet"/>` + T(W - 4, top + 8, `0…${F.PT_ms}`, "start", "f9-xs");
    } else {
      r.rows.forEach((row, k) => { const v = row[key], prev = k ? r.rows[k - 1][key] : null; if (k === 0 || v !== prev) b += T(x0 + k * dx + 2, y + rh / 2 + 4, String(v), "start", "f9-sm f9-b"); });
      b += L(x0, bot, W - 10, bot, "f9-grid");
    }
  });
  b += T(W - 10, 14 + FB_ROWS.length * rh + 14, "scan k (t = k·10 ms)", "end", "f9-xs");
  $("f9CSvg").innerHTML = svg(W + 40, 14 + FB_ROWS.length * rh + 20, b, "f9-timing", "Timing diagram of the standard function blocks over " + N + " scans");
  const names = { TON_Q: "TON.Q", TOF_Q: "TOF.Q", TP_Q: "TP.Q", RTRIG: "R_TRIG.Q", FTRIG: "F_TRIG.Q", CTU_Q: "CTU.Q", CTD_Q: "CTD.Q", SR: "SR.Q1", RS: "RS.Q1", CTU_CV: "CTU.CV", CTD_CV: "CTD.CV" };
  $("f9CEv").innerHTML = tab(["Output", "(scan, value) …"], FB_KEYS.map((k) => `<tr><td>${names[k]}</td><td class="f9-mono">${r.events[k].map(([a, v]) => `(${a}, ${v})`).join(" ") || "–"}</td></tr>`), "f8-small");
}

/* ================================================================== 9D analog + limits */
const limDef = () => JSON.parse(JSON.stringify(EX9.limits));
function html9D() {
  const an = EX9.analog;
  return card("f99D", "9D · Analog input FB and limit alarms", "raw → mA → value · NAMUR NE 43 signal status · substitute value · alarm with hysteresis and on-delay",
    intro(`<p>An analog card converts 4–20 mA into a number (<b>raw</b>). Siemens-style cards give 0…27648 for 4…20 mA (other makers: 0…32767,
      0…10000, or engineering units – check your card). The analog FB turns raw into a value <b>and a quality</b>:</p>
      <p class="phd-eq">mA = 4 + 16·raw ÷ 27648 &nbsp;·&nbsp; value = lo + (hi − lo)·(mA − 4) ÷ 16</p>
      <p><b>NAMUR NE 43</b> tells what a current outside 4–20 mA means: ≤ 3.6 mA <b>BAD</b> (wire break / sensor fault), 3.6–3.8 <b>UNCERTAIN</b>
      (under range), 3.8–20.5 <b>GOOD</b>, 20.5–21.0 <b>UNCERTAIN</b> (over range), ≥ 21.0 <b>BAD</b> (fault high). GOOD / UNCERTAIN values are
      clamped to [lo, hi]; a BAD value is replaced by a <b>substitute value</b> (here lo) and the module must not use it (alarm, no start).</p>
      <p><b>Limit alarms</b> need two tricks to stay quiet: an <b>on-delay</b> (the condition must be true for n samples) and a <b>hysteresis</b>
      (the alarm goes off only when the value is clearly back: below H − hyst, above L + hyst). Without them a value close to the limit chatters (9H).</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Try a raw value (${an.lo}…${an.hi} ${an.unit} transmitter)</h3>
      <div class="fe-row"><label>raw <input type="number" id="f9DRaw" step="1" min="-32768" max="32767"></label><input type="range" id="f9DRawR" min="-8000" max="32767" step="1" class="f9-range"></div>
      <div id="f9DOut"></div><div class="fe-scroll" id="f9DBand"></div></div>
      <div><h3 class="fe-h3">Test values (JSON)</h3>${tab(["raw", "mA", "quality", "status", "value", "value used"], an.raws.map((x) => { const a = analog(x, an.lo, an.hi); return `<tr data-raw="${x}" class="f8-click"><td class="f8-r">${x}</td><td class="f8-r">${fx(a.mA, 3)}</td><td class="f9-q${a.q}">${a.q}</td><td>${a.st}</td><td class="f8-r">${fx(a.v, 3)}</td><td class="f8-r"><b>${fx(a.vo, 3)}</b></td></tr>`; }), "f8-small")}
      <p class="am-note">Click a row to load it on the left.</p></div></div>
    <h3 class="fe-h3">Limit alarm with hysteresis and on-delay (one sample per second)</h3>
    <div class="fe-row"><label>H <input type="number" step="any" data-lm="H"></label><label>L <input type="number" step="any" data-lm="L"></label><label>hysteresis <input type="number" step="any" min="0" data-lm="hyst"></label><label>on-delay (samples) <input type="number" step="1" min="1" data-lm="delay"></label><button class="mx-el" id="f9DLRst">Reset to JSON</button></div>
    <div class="fe-row"><label class="f9-wide">values <input type="text" id="f9DVals"></label></div>
    <div class="fe-scroll" id="f9DChart"></div><div id="f9DEv"></div>` +
    exBox("clamp pressure of the APC (0–10 bar)", `<p>raw 13824 → 4 + 16·13824/27648 = <b>12.000 mA</b> → 0 + 10·(12 − 4)/16 = <b>5.000 bar</b>, GOOD. A broken
      wire gives raw ≈ −6000 → 0.528 mA → <b>BAD</b>: the FB outputs the substitute 0.0 bar <i>and</i> quality BAD, so step S30 of 9F waits and
      times out with alarm 13 instead of believing a wrong pressure. raw 28800 → 20.667 mA: UNCERTAIN (over range), value clamped to 10.0 bar – the
      transmitter is probably the wrong range. Limit alarm "pressure high" H = 8.0 bar, hysteresis 0.2, delay 2 s: the value 8.0 at sample 6
      does not alarm (only one sample), 8.1 at sample 7 does; 7.9 and 7.85 keep it on (above 7.8), 7.75 switches it off.</p>`) +
    useCase(`every analog signal in the item 8 IO lists (clamp pressure, washer temperature, hydraulic pressure, air pressure) uses the same FB_AnalogIn
      with parameters lo / hi / unit / limits. The cell controller and SCADA receive value <i>and</i> quality, the historian stores both.`));
}
function init9D() {
  const an = EX9.analog;
  const drawA = () => {
    const a = analog(S.raw, an.lo, an.hi);
    $("f9DRaw").value = S.raw; $("f9DRawR").value = S.raw;
    $("f9DOut").innerHTML = kpis([["mA", fx(a.mA, 3)], ["quality", a.q, "f9-q" + a.q], ["value " + an.unit, fx(a.v, 3)], ["value used " + an.unit, fx(a.vo, 3), "f9-strong"]]) +
      `<p class="am-note">${S.raw} → 4 + 16·${S.raw}/27648 = ${fx(a.mA, 3)} mA → ${a.st} → ${an.lo} + ${an.hi - an.lo}·(${fx(a.mA, 3)} − 4)/16 = ${fx(a.v, 3)} ${an.unit}${a.q === "BAD" ? ` → BAD: substitute ${an.lo}` : a.v !== a.vo ? ` → clamped to ${a.vo}` : ""}</p>`;
    const W = 460, mA2x = (m) => 20 + (Math.min(24, Math.max(0, m)) / 24) * (W - 40);
    const bands = [[0, 3.6, "f9-bBAD", "BAD"], [3.6, 3.8, "f9-bUNC", ""], [3.8, 20.5, "f9-bGOOD", "GOOD"], [20.5, 21, "f9-bUNC", ""], [21, 24, "f9-bBAD", "BAD"]];
    let b = bands.map(([p, q, c, t]) => RC(mA2x(p), 20, mA2x(q) - mA2x(p), 22, c, 0) + (t ? T((mA2x(p) + mA2x(q)) / 2, 35, t, "middle", "f9-xs") : "")).join("");
    [0, 3.6, 4, 12, 20, 21, 24].forEach((m) => { b += L(mA2x(m), 42, mA2x(m), 47, "f9-axis") + T(mA2x(m), 58, String(m), "middle", "f9-xs"); });
    const xm = mA2x(a.mA); b += `<path d="M${xm} 18l-5 -8h10z" class="f9-mark"/>` + L(xm, 18, xm, 44, "f9-markl") + T(W - 20, 12, "mA", "end", "f9-xs");
    $("f9DBand").innerHTML = svg(W, 62, b, "f9-band", "NAMUR NE 43 bands with the current value");
  };
  const setRaw = (v) => { if (Number.isFinite(v)) { S.raw = Math.max(-32768, Math.min(32767, Math.round(v))); store.set("raw", S.raw); drawA(); } };
  $("f9DRaw").addEventListener("input", () => setRaw(+$("f9DRaw").value));
  $("f9DRawR").addEventListener("input", () => setRaw(+$("f9DRawR").value));
  document.querySelectorAll("#f99D tr[data-raw]").forEach((tr) => tr.addEventListener("click", () => setRaw(+tr.dataset.raw)));
  drawA();
  if (!S.lim) S.lim = limDef();
  const fill = () => { document.querySelectorAll("#f99D [data-lm]").forEach((i) => { i.value = S.lim[i.dataset.lm]; }); $("f9DVals").value = S.lim.values.join(", "); };
  document.querySelectorAll("#f99D [data-lm]").forEach((i) => i.addEventListener("input", () => { const v = +i.value; if (i.value !== "" && Number.isFinite(v)) { S.lim[i.dataset.lm] = i.dataset.lm === "delay" ? Math.max(1, Math.round(v)) : v; store.set("lim", S.lim); drawL(); } }));
  $("f9DVals").addEventListener("change", () => { const v = $("f9DVals").value.split(/[,;\s]+/).map(Number).filter((x) => Number.isFinite(x)); if (v.length) { S.lim.values = v.slice(0, 200); store.set("lim", S.lim); } fill(); drawL(); });
  $("f9DLRst").addEventListener("click", () => { S.lim = limDef(); store.del("lim"); fill(); drawL(); });
  const drawL = () => {
    const lm = S.lim, r = limits(lm), n = lm.values.length, W = 720, H = 210, x0 = 40, y0 = 14, ph = 150;
    const lo = Math.min(...lm.values, lm.L - lm.hyst) - 0.5, hi = Math.max(...lm.values, lm.H + lm.hyst) + 0.5;
    const X = (i) => x0 + (i + 0.5) * ((W - x0 - 10) / n), Y = (v) => y0 + ph - ((v - lo) / (hi - lo)) * ph, dx = (W - x0 - 10) / n;
    let b = "";
    r.rows.forEach((row) => { if (row.H) b += RC(X(row.i) - dx / 2, y0, dx, ph, "f9-almH", 0); if (row.L) b += RC(X(row.i) - dx / 2, y0, dx, ph, "f9-almL", 0); });
    [[lm.H, "f9-limH", "H " + lm.H], [lm.H - lm.hyst, "f9-limHd", "H − hyst"], [lm.L, "f9-limL", "L " + lm.L], [lm.L + lm.hyst, "f9-limLd", "L + hyst"]].forEach(([v, c, t]) => { b += L(x0, Y(v), W - 10, Y(v), c) + T(W - 12, Y(v) - 3, t, "end", "f9-xs"); });
    b += `<path d="${r.rows.map((row, i) => (i ? "L" : "M") + X(i).toFixed(1) + " " + Y(row.v).toFixed(1)).join("")}" class="f9-val"/>`;
    r.rows.forEach((row) => { b += `<circle cx="${X(row.i).toFixed(1)}" cy="${Y(row.v).toFixed(1)}" r="3" class="f9-dot"/>` + T(X(row.i), y0 + ph + 14, String(row.i), "middle", "f9-xs"); });
    b += T(x0 - 4, y0 + ph + 30, "H alarm", "end", "f9-xs") + T(x0 - 4, y0 + ph + 44, "L alarm", "end", "f9-xs");
    r.rows.forEach((row) => { b += RC(X(row.i) - dx / 2 + 1, y0 + ph + 21, dx - 2, 10, row.H ? "f9-onH" : "f9-off", 1) + RC(X(row.i) - dx / 2 + 1, y0 + ph + 35, dx - 2, 10, row.L ? "f9-onL" : "f9-off", 1); });
    $("f9DChart").innerHTML = svg(W, H, b, "f9-lim", "Limit alarm chart with hysteresis lines");
    $("f9DEv").innerHTML = `<p class="am-note"><b>Events:</b> ${r.ev.map(([i, e]) => `sample ${i}: ${e}`).join(" · ") || "none"}</p>` +
      tab(["sample", ...r.rows.map((x) => x.i)], [`<tr><td>v</td>${r.rows.map((x) => `<td class="f8-r">${x.v}</td>`).join("")}</tr>`, `<tr><td>count ≥ H</td>${r.rows.map((x) => `<td class="f8-r">${x.nh}</td>`).join("")}</tr>`, `<tr><td>H alarm</td>${r.rows.map((x) => `<td class="f8-r">${x.H ? 1 : 0}</td>`).join("")}</tr>`, `<tr><td>count ≤ L</td>${r.rows.map((x) => `<td class="f8-r">${x.nl}</td>`).join("")}</tr>`, `<tr><td>L alarm</td>${r.rows.map((x) => `<td class="f8-r">${x.L ? 1 : 0}</td>`).join("")}</tr>`], "f8-small f9-dense");
  };
  fill(); drawL();
}

/* ================================================================== 9E FB_MotorDol */
const MPOS = { 0: [80, 90], 1: [250, 30], 2: [420, 90], 3: [250, 150], 9: [560, 150] };
const MEDGES = [[0, 1, "rising edge Cmd"], [1, 2, "RunFb"], [2, 3, "NOT Cmd"], [3, 0, "NOT RunFb"], [1, 9, "no fb 500 ms (1)"], [2, 9, "fb lost (2)"], [3, 9, "fb stays 500 ms (4)"], [0, 9, "fb w/o cmd (4)"], [9, 0, "Reset ok"]];
function html9E() {
  return card("f99E", "9E · Device FB: direct-on-line motor (FB_MotorDol)", "command · run feedback supervision · motor protection · no automatic restart – tick by tick",
    intro(`<p>A <b>device FB</b> wraps one piece of hardware from the item 8 circuit library: here the DOL pattern (motor protection breaker, contactor
      with auxiliary contact). It turns a simple <b>command</b> into a safe behaviour with a small <b>state machine</b>:</p>
      <p class="phd-eq">STOPPED —edge Cmd→ STARTING —RunFb→ RUNNING —NOT Cmd→ STOPPING —NOT RunFb→ STOPPED · any —Tripped→ FAULT 3 · FAULT —Reset (cause gone)→ STOPPED</p>
      <p>Supervision with T<sub>fb</sub> = 500 ms: no feedback after the start → <b>alarm 1</b>; feedback lost while running → <b>alarm 2</b>;
      motor protection tripped → <b>alarm 3</b>; feedback without command (contactor welded) → <b>alarm 4</b>. After a reset the FB goes to
      STOPPED – <b>never directly back to RUNNING</b>: a new <b>rising edge</b> of the command is needed (IEC 60204-1: no unexpected restart).
      Plant model: the contactor closes when Run was TRUE in the previous tick; the auxiliary contact reports after 2 ticks.</p>`) +
    `<div class="fe-row"><label>Scenario <select id="f9ESc" class="fe-sel">${EX9.motor.scenarios.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join("")}</select></label>
      <button class="mx-el" id="f9EPlay">▶ Play</button><label class="f9-scrub">tick <input type="range" id="f9EK" min="0" max="${EX9.motor.K - 1}" step="1"></label><b id="f9EKt"></b></div>
    <div class="grid2 eq"><div><div class="fe-scroll" id="f9EDia"></div><div id="f9ESig"></div></div><div><div class="fe-scroll" id="f9EStrip"></div><h3 class="fe-h3">Log</h3><div id="f9ELog" class="f9-log"></div></div></div>
    <details class="f9-det"><summary>ST code of FB_MotorDol (structured text, follows the rule above)</summary>${pre(ST_MOTOR)}</details>` +
    exBox("scenario D – trip and no restart", `<p>Tick 2 CMD_ON → STARTING, tick 4 feedback → RUNNING. Tick 10 the motor protection trips → <b>FAULT, alarm 3</b>,
      Run = FALSE. Tick 14 the operator presses Reset while the breaker is still tripped → <b>reset rejected</b>. Tick 16 the breaker is switched on again,
      tick 18 Reset → STOPPED although the command is still TRUE – the motor does <b>not</b> start by itself. Only the new command edge at tick 25 starts it
      (the cell controller or operator must decide). Scenario E: the contactor welds; after CMD_OFF the feedback stays → after 500 ms FAULT 4, and
      Reset is refused while feedback is present – a maintenance job, not a button.</p>`) +
    useCase(`the hydraulic pump of the pallet pool, the chip conveyor of every HMC, the washer pump and the coolant pumps are all DOL patterns in item 8
      → all use this one FB. The alarm numbers (module range × 1000 + n, item 6) appear in SCADA with the same texts in every module.`));
}
function init9E() {
  S.msc = Math.min(S.msc, EX9.motor.scenarios.length - 1);
  $("f9ESc").value = String(S.msc);
  $("f9ESc").addEventListener("change", () => { stopPlay("m"); $("f9EPlay").textContent = "▶ Play"; S.msc = +$("f9ESc").value; S.mk = 0; store.set("msc", S.msc); draw9E(); });
  $("f9EK").addEventListener("input", () => { S.mk = +$("f9EK").value; draw9E(); });
  $("f9EPlay").addEventListener("click", () => {
    if (timers.m) { stopPlay("m"); $("f9EPlay").textContent = "▶ Play"; return; }
    if (S.mk >= EX9.motor.K - 1) S.mk = 0;
    $("f9EPlay").textContent = "❚❚ Pause";
    timers.m = setInterval(() => { if (!document.getElementById("f9EK")) return stopPlay("m"); S.mk++; if (S.mk >= EX9.motor.K - 1) { S.mk = EX9.motor.K - 1; stopPlay("m"); $("f9EPlay").textContent = "▶ Play"; } draw9E(); }, 220);
  });
  draw9E();
}
let motorCache = {};
function draw9E() {
  const sc = EX9.motor.scenarios[S.msc], m = motorCache[S.msc] || (motorCache[S.msc] = motor(sc)), k = S.mk, t = m.ticks[k];
  $("f9ESc").value = String(S.msc); $("f9EK").value = k; $("f9EKt").textContent = `${k} (${k * EX9.motor.tick_ms} ms)`;
  const W = 120, H = 34; let b = arrowDefs("f9eA");
  MEDGES.forEach(([a, c, lab], i) => {
    const hot = t.st0 !== t.st && t.st0 === a && t.st === c, bend = (a === 9 && c === 0) ? 0.18 : (a === 0 && c === 9) ? 0.12 : 0;
    b += edge(MPOS[a], MPOS[c], W, H, hot ? "f9-ehot" : "f9-edge", "f9eA", bend);
    const mx = (MPOS[a][0] + MPOS[c][0]) / 2, my = (MPOS[a][1] + MPOS[c][1]) / 2;
    const off = [[0, -6], [0, -6], [0, 14], [0, 14], [-4, -4], [30, -4], [0, 14], [-20, 30], [-30, -26]][i];
    b += T(mx + off[0], my + off[1], lab, "middle", hot ? "f9-xs f9-b" : "f9-xs");
  });
  Object.entries(MPOS).forEach(([s, [x, y]]) => { const cur = +s === t.st; b += RC(x - W / 2, y - H / 2, W, H, cur ? (+s === 9 ? "f9-stF" : "f9-stA") : "f9-st", 8) + T(x, y + 4, M_SN[s], "middle", cur ? "f9-lbl f9-b f9-inv" : "f9-lbl"); });
  $("f9EDia").innerHTML = svg(640, 180, b, "f9-mdia", "FB_MotorDol state diagram, current state " + M_SN[t.st]);
  $("f9ESig").innerHTML = `<div class="f9-sigs">${[["Cmd", t.cmd], ["Reset", t.reset], ["Run (coil)", t.run], ["contactor", t.cont], ["RunFb", t.runfb], ["Tripped", t.trip], ["fb broken", t.fbb], ["welded", t.weld]].map(([n, v]) => `<span>${onoff(v)} ${n}</span>`).join("")}</div>` +
    `<p class="f8-pt">State <b>${M_SN[t.st]}</b> (${t.st}) · alarm <b class="${t.alarm ? "f9-bad" : ""}">${t.alarm}${t.alarm ? " – " + M_ALM[t.alarm] : ""}</b> · n = ${t.n} · nfb = ${t.nfb}${t.evs.length ? ` · event: <b>${t.evs.join(", ")}</b>` : ""}</p>` +
    `<p class="am-note">Final after ${EX9.motor.K} ticks: ${m.final}, alarm ${m.alarm}, Run ${m.run ? 1 : 0} · log ${m.log.length} lines.</p>`;
  // strip
  const rows = [["Cmd", "cmd"], ["Run", "run"], ["contactor", "cont"], ["RunFb", "runfb"], ["Tripped", "trip"], ["FAULT", null]], x0 = 70, Wd = 560, dx = (Wd - x0 - 6) / m.ticks.length, rh = 18;
  let s = "";
  rows.forEach(([lab, key], i) => {
    const y = 6 + i * rh; s += T(x0 - 5, y + 13, lab, "end", "f9-xs");
    m.ticks.forEach((q, j) => { const v = key ? q[key] : q.st === 9; if (v) s += RC(x0 + j * dx, y + 3, dx, rh - 6, i === 5 ? "f9-onH" : "f9-fout", 0); });
    s += L(x0, y + rh - 3, Wd - 6, y + rh - 3, "f9-grid");
  });
  m.ticks.forEach((q, j) => { if (q.evs.length) s += L(x0 + j * dx, 4, x0 + j * dx, 6 + rows.length * rh, "f9-evl"); });
  s += RC(x0 + k * dx, 2, dx, rows.length * rh + 6, "f9-cur", 0);
  for (let j = 0; j <= m.ticks.length; j += 5) s += T(x0 + j * dx, rows.length * rh + 18, String(j), "middle", "f9-xs");
  $("f9EStrip").innerHTML = svg(Wd, rows.length * rh + 22, s, "f9-strip", "Signal strip of the motor scenario");
  $("f9ELog").innerHTML = m.log.map((l) => { const tk = parseInt(l, 10); return `<div class="${tk === k ? "f9-lnow" : tk > k ? "f9-lfut" : ""}">${esc(l)}</div>`; }).join("");
}

/* ================================================================== 9F APC01 sequence inside PackML */
const STEPS = [[0, "S0 idle"], [10, "S10 unclamp"], [20, "S20 rotate"], [30, "S30 clamp + pressure"], [40, "S40 done → SC"]];
function html9F() {
  return card("f99F", "9F · Module sequence inside the PackML state machine (APC01)", "item 5 states + item 6 data block + item 8 IO – the pallet changer M02 tick by tick",
    intro(`<p>Every module runs the <b>same PackML state machine</b> (item 5). The machine-specific work is a <b>sequence</b> (step chain) that runs
      only in the state <b>Execute</b>. The cell controller commands the module only through the <b>data block</b> (item 6): it writes
      Command.CntrlCmd and sets CmdChangeRequest; the PLC accepts the command if the state table allows it, then clears both.</p>
      <p class="phd-eq">per tick (100 ms): events → plant model (outputs of the last tick) → (a) command → (b) state action / sequence → (c) outputs → (d) data block</p>
      <p><b>APC01 sequence</b> (IO names from item 8): <b>S10</b> unclamp (Clamp.Sol) until Clamp.PosB, timeout 3 s → alarm 11 · <b>S20</b> rotate to the
      other side (Rotate.SolA / SolB, double solenoid keeps its position) until PosA/PosB, timeout 5 s → alarm 12 · <b>S30</b> clamp (spring) until
      Clamp.PosA and ClampPress ≥ 4.5 bar, timeout 3 s → alarm 13 · <b>S40</b> done → State Complete (SC) → Completing → Complete. An alarm sets
      Admin.AlarmNo and makes an <b>internal Abort</b>. Hold freezes the sequence and keeps its outputs; Abort switches all outputs off – the clamp spring
      clamps, but the rotate valve keeps its spool (the motion continues: energy isolation is a safety valve, items 7/8).</p>`) +
    `<div class="fe-row"><label>Scenario <select id="f9FSc" class="fe-sel">${EX9.module_run.scenarios.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join("")}</select></label>
      <button class="mx-el" id="f9FPlay">▶ Play</button><label class="f9-scrub f9-scrubw">tick <input type="range" id="f9FK" min="0" max="${EX9.module_run.K - 1}" step="1"></label><b id="f9FKt"></b>
      <button class="mx-el f8-mini" data-fj="-1">◀ step</button><button class="mx-el f8-mini" data-fj="1">step ▶</button><button class="mx-el f8-mini" data-fj="ev">next event ▶</button></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">PackML state machine (item 5)</h3><div class="fe-scroll" id="f9FPack"></div></div>
      <div><h3 class="fe-h3">Sequence and plant</h3><div id="f9FSteps"></div><div class="fe-scroll" id="f9FPlant"></div><div id="f9FDb"></div></div></div>
    <div class="fe-scroll" id="f9FStrip"></div>
    <div class="grid2 eq"><div><h3 class="fe-h3">Log</h3><div id="f9FLog" class="f9-log f9-logT"></div></div><div><h3 class="fe-h3">The sequence in ST (simplified)</h3>${pre(ST_APC)}</div></div>` +
    exBox("scenario B – rotate jams", `<p>Reset (tick 2) → Resetting 5 ticks → Idle (7). Start (10) → Starting 2 ticks → Execute (12): the table is at A, so
      target = B, S10. The clamp opens in 8 ticks → S20 at tick 20, SolB on. At tick 30 the table jams (it stops at x = 9 of 30). After 50 ticks in S20
      (tick 70) the timeout gives <b>alarm 12 "rotate timeout"</b>, AlarmNo = 12, Bits = 106 = 0b1101010 (Busy + Fault + Auto + PartPresent), internal
      Abort → Aborting → Aborted (71). The operator frees the table (90), Clear (95) resets AlarmNo, Clearing → Stopped (97), Reset → Idle (105),
      Start (110): the rotate valve kept its spool at B during the abort, so after the unjam the table finished its travel to B – the new
      target is therefore <b>A</b>, and the job completes at tick 162 (count = 1).</p>`) +
    useCase(`the cell controller (item 10) never switches a valve; it only sends "Start job" to APC01 over Modbus TCP and waits for StateCurrent = 17
      (Complete). Every module looks the same from above – stacker, washer, APC – so one cell-controller program can drive them all.`));
}
function init9F() {
  S.rsc = Math.min(S.rsc, EX9.module_run.scenarios.length - 1);
  $("f9FSc").value = String(S.rsc);
  $("f9FSc").addEventListener("change", () => { stopPlay("r"); $("f9FPlay").textContent = "▶ Play"; S.rsc = +$("f9FSc").value; S.rk = 0; store.set("rsc", S.rsc); draw9F(); });
  $("f9FK").addEventListener("input", () => { S.rk = +$("f9FK").value; draw9F(); });
  const K = EX9.module_run.K;
  document.querySelectorAll("#f99F [data-fj]").forEach((bt) => bt.addEventListener("click", () => {
    const j = bt.dataset.fj, run = runOf(S.rsc);
    if (j === "ev") { const nx = run.ticks.find((q) => q.k > S.rk && q.log.length); S.rk = nx ? nx.k : K - 1; } else S.rk = Math.max(0, Math.min(K - 1, S.rk + +j));
    draw9F();
  }));
  $("f9FPlay").addEventListener("click", () => {
    if (timers.r) { stopPlay("r"); $("f9FPlay").textContent = "▶ Play"; return; }
    if (S.rk >= K - 1) S.rk = 0;
    $("f9FPlay").textContent = "❚❚ Pause";
    timers.r = setInterval(() => { if (!document.getElementById("f9FK")) return stopPlay("r"); S.rk++; if (S.rk >= K - 1) { S.rk = K - 1; stopPlay("r"); $("f9FPlay").textContent = "▶ Play"; } draw9F(); }, 120);
  });
  draw9F();
}
const runCache = {};
export const runOf = (i) => runCache[i] || (runCache[i] = moduleRun(EX9.module_run.scenarios[i]));
function svgPack(cur, prev) {
  const W = 104, H = 30, X = (c) => 62 + c * 124, Y = (r) => 24 + r * 58; let b = arrowDefs("f9pA");
  EDGES.forEach(([a, c, lab]) => {
    const pa = [X(POS[a][0]), Y(POS[a][1])], pc = [X(POS[c][0]), Y(POS[c][1])], hot = prev !== cur && a === prev && c === cur;
    const bend = (a === "Complete" && c === "Resetting") ? -0.12 : (a === "Execute" && (c === "Holding" || c === "Suspending")) ? 0.18 : (a === "Unholding" || a === "Unsuspending") ? 0.18 : 0;
    b += edge(pa, pc, W, H, hot ? "f9-ehot" : lab === "SC" ? "f9-edge f9-sc" : "f9-edge", "f9pA", bend);
  });
  Object.entries(POS).forEach(([s, [c, r]]) => {
    const on = s === cur, acting = DUR[s] != null;
    b += RC(X(c) - W / 2, Y(r) - H / 2, W, H, on ? (s === "Aborting" || s === "Aborted" ? "f9-stF" : "f9-stA") : acting ? "f9-st f9-acting" : "f9-st", acting ? 12 : 3) +
      T(X(c), Y(r) + 1, s, "middle", on ? "f9-sm f9-b f9-inv" : "f9-sm") + T(X(c), Y(r) + 11, String(STATES[s]), "middle", on ? "f9-xs f9-inv" : "f9-xs");
  });
  b += T(8, 300, "rounded = acting state (has a duration, ends with SC) · square = waiting state (needs a command) · dashed = SC", "start", "f9-xs");
  return svg(620, 306, b, "f9-pack", "PackML state machine, current state " + cur);
}
function draw9F() {
  const K = EX9.module_run.K, run = runOf(S.rsc), k = Math.max(0, Math.min(K - 1, S.rk)), t = run.ticks[k];
  S.rk = k; $("f9FSc").value = String(S.rsc); $("f9FK").value = k; $("f9FKt").textContent = `${k} (${(k * EX9.module_run.tick_ms / 1000).toFixed(1)} s)`;
  $("f9FPack").innerHTML = svgPack(t.state, t.s0);
  const inSeq = ["Execute", "Holding", "Held", "Unholding"].includes(t.state);
  $("f9FSteps").innerHTML = `<div class="f9-chain">${STEPS.map(([n, l]) => `<span class="f9-step${t.step === n && (n || !inSeq) ? (inSeq ? " f9-son" : " f9-sidle") : ""}">${l}</span>`).join("<i>→</i>")}</div>` +
    `<p class="f8-pt">State <b>${t.state}</b> · step <b>S${t.step}</b>${t.target ? ` · target <b>${t.target}</b>` : ""} · n = ${t.n} (×100 ms)${t.alarm ? ` · <b class="f9-bad">alarm ${t.alarm}: ${R_ALM[t.alarm]}</b>` : ""}${t.evs.length ? ` · event <b>${t.evs.join(", ")}</b>` : ""}${t.cmdRes ? ` · command ${t.cmdRes}` : ""}</p>`;
  // plant drawing
  const ang = (t.rx / 30) * 180, cx = 120, cy = 92, rad = 62;
  let b = `<g transform="translate(0 30)"><circle cx="${cx}" cy="${cy}" r="${rad + 8}" class="f9-plate"/>`;
  const px = (a) => cx + Math.cos((a - 180) * Math.PI / 180) * rad, py = (a) => cy + Math.sin((a - 180) * Math.PI / 180) * rad * 0.55;
  b += `<g transform="rotate(${ang.toFixed(1)} ${cx} ${cy})">${RC(cx - rad, cy - 8, rad * 2, 16, "f9-arm", 3)}${RC(cx - rad - 10, cy - 18, 26, 36, "f9-pal", 3)}${T(cx - rad + 3, cy + 4, "P1", "middle", "f9-xs")}${RC(cx + rad - 16, cy - 18, 26, 36, "f9-pal2", 3)}${T(cx + rad - 3, cy + 4, "P2", "middle", "f9-xs")}</g>`;
  b += `<circle cx="${cx}" cy="${cy}" r="6" class="f9-hub"/>` + T(cx - rad - 20, cy - 26, "A", "middle", t.PosA ? "f9-lbl f9-b f9-hotT" : "f9-lbl") + T(cx + rad + 20, cy - 26, "B", "middle", t.PosB ? "f9-lbl f9-b f9-hotT" : "f9-lbl");
  b += T(cx, 180, `Rotate x = ${t.rx}/30 · spool ${t.spool}${t.jam ? " · JAMMED" : ""}`, "middle", t.jam ? "f9-sm f9-bad" : "f9-sm");
  // clamp
  const ccx = 300, open = (t.cx / 8) * 26;
  b += RC(ccx - 40, 70, 80, 30, "f9-pal", 3) + T(ccx, 89, "pallet", "middle", "f9-xs") + RC(ccx - 30, 100 + open, 60, 14, t.CPA ? "f9-clampOn" : "f9-clamp", 2) + L(ccx, 114 + open, ccx, 150, "f9-w") + RC(ccx - 18, 150, 36, 18, "f9-cyl", 2);
  b += T(ccx, 60, `Clamp x = ${t.cx}/8`, "middle", "f9-sm") + T(ccx, 184, t.CPA ? "clamped (PosA)" : t.CPB ? "unclamped (PosB)" : "moving", "middle", "f9-xs");
  // pressure gauge
  const gx = 440, gy = 110, gr = 42, pa = -210 + (Math.min(10, t.press) / 10) * 240, rd = (d) => d * Math.PI / 180;
  b += `<path d="M${gx + gr * Math.cos(rd(-210))} ${gy + gr * Math.sin(rd(-210))}A${gr} ${gr} 0 1 1 ${gx + gr * Math.cos(rd(30))} ${gy + gr * Math.sin(rd(30))}" class="f9-gauge"/>`;
  const a45 = -210 + 0.45 * 240; b += L(gx + (gr - 8) * Math.cos(rd(a45)), gy + (gr - 8) * Math.sin(rd(a45)), gx + (gr + 4) * Math.cos(rd(a45)), gy + (gr + 4) * Math.sin(rd(a45)), "f9-limH") + T(gx + (gr + 12) * Math.cos(rd(a45)), gy + (gr + 12) * Math.sin(rd(a45)), "4.5", "middle", "f9-xs");
  b += L(gx, gy, gx + (gr - 6) * Math.cos(rd(pa)), gy + (gr - 6) * Math.sin(rd(pa)), t.press >= 4.5 ? "f9-needleOk" : "f9-needle") + `<circle cx="${gx}" cy="${gy}" r="4" class="f9-hub"/>`;
  b += T(gx, gy + 28, `${fx(t.press, 1)} bar`, "middle", "f9-sm f9-b") + T(gx, 184, `ClampPress${t.plow ? " (supply LOW)" : ""}`, "middle", t.plow ? "f9-xs f9-bad" : "f9-xs");
  b += "</g>";
  // outputs
  b += T(10, 16, "Outputs:", "start", "f9-xs") + [["Rotate.SolA", t.out.SolA], ["Rotate.SolB", t.out.SolB], ["Clamp.Sol", t.out.ClampSol]].map(([n, v], i) => `<circle cx="${70 + i * 100}" cy="12" r="6" class="${v ? "f9-ledOn" : "f9-ledOff"}"/>` + T(80 + i * 100, 16, n, "start", "f9-xs")).join("");
  b += T(10, 34, "Inputs:", "start", "f9-xs") + [["PosA", t.PosA], ["PosB", t.PosB], ["Clamp.PosA", t.CPA], ["Clamp.PosB", t.CPB]].map(([n, v], i) => `<circle cx="${70 + i * 90}" cy="30" r="5" class="${v ? "f9-ledOn" : "f9-ledOff"}"/>` + T(79 + i * 90, 34, n, "start", "f9-xs")).join("");
  $("f9FPlant").innerHTML = svg(520, 222, b, "f9-plant", "APC01 plant: rotate table, clamp and clamp pressure");
  $("f9FDb").innerHTML = `<table class="am-kv f9-db"><tbody>
    <tr><td>Status.StateCurrent (word 0)</td><td><b>${t.sc}</b> = ${t.state}</td></tr>
    <tr><td>Admin.AlarmNo (word 6)</td><td><b class="${t.alarm ? "f9-bad" : ""}">${t.alarm}</b></td></tr>
    <tr><td>Status.Bits (word 4)</td><td><b>${t.bits}</b> = <span class="f9-mono">${bitsHtml(t.bits)}</span></td></tr>
    <tr><td>Admin.ProdProcessedCount (8–9)</td><td>${t.count}</td></tr></tbody></table>`;
  // strip over the whole run
  const x0 = 76, Wd = 900, dx = (Wd - x0 - 6) / K, rows = [["state", null], ["step", null], ["Clamp.Sol", (q) => q.out.ClampSol], ["SolA", (q) => q.out.SolA], ["SolB", (q) => q.out.SolB], ["Fault", (q) => !!q.alarm]];
  let s = ""; const rh = 16;
  rows.forEach(([lab, f], i) => {
    const y = 4 + i * rh; s += T(x0 - 5, y + 12, lab, "end", "f9-xs");
    if (f) run.ticks.forEach((q, j) => { if (f(q)) s += RC(x0 + j * dx, y + 3, dx + 0.2, rh - 6, i === 5 ? "f9-onH" : "f9-fout", 0); });
  });
  let segStart = 0;
  run.ticks.forEach((q, j) => {
    const last = j === K - 1 || run.ticks[j + 1].state !== q.state;
    if (last) { const w = (j + 1 - segStart) * dx; s += RC(x0 + segStart * dx, 6, w, rh - 4, "f9-seg" + segCls(q.state), 0) + (w > 46 ? T(x0 + segStart * dx + w / 2, 15, q.state, "middle", "f9-xs") : ""); segStart = j + 1; }
  });
  segStart = 0;
  run.ticks.forEach((q, j) => {
    const sv = q.step, last = j === K - 1 || run.ticks[j + 1].step !== sv;
    if (last) { const w = (j + 1 - segStart) * dx; if (sv) s += RC(x0 + segStart * dx, 4 + rh + 2, w, rh - 4, "f9-segS", 0) + (w > 22 ? T(x0 + segStart * dx + w / 2, 4 + rh + 11, "S" + sv, "middle", "f9-xs") : ""); segStart = j + 1; }
  });
  s += RC(x0 + k * dx - 0.5, 2, Math.max(dx, 1.5), rows.length * rh + 4, "f9-cur", 0);
  for (let j = 0; j <= K; j += 20) s += T(x0 + j * dx, rows.length * rh + 16, String(j), j === K ? "end" : "middle", "f9-xs");
  $("f9FStrip").innerHTML = svg(Wd, rows.length * rh + 20, s, "f9-strip2", "State, step and output strip of the whole scenario");
  const lg = $("f9FLog");
  lg.innerHTML = run.log.map((l) => { const tk = parseInt(l, 10); return `<div class="${tk === k ? "f9-lnow" : tk > k ? "f9-lfut" : ""}" data-tk="${tk}">${esc(l)}</div>`; }).join("");
  lg.querySelectorAll("[data-tk]").forEach((d) => d.addEventListener("click", () => { S.rk = +d.dataset.tk; draw9F(); }));
  const now = lg.querySelector(".f9-lnow"); if (now) lg.scrollTop = now.offsetTop - lg.offsetTop - 40;
  drawDB(run, t);
}
const segCls = (s) => (s === "Execute" ? "E" : s === "Aborting" || s === "Aborted" ? "A" : s === "Complete" || s === "Idle" ? "C" : s === "Held" || s === "Holding" || s === "Unholding" ? "H" : "");
export const BITN = ["Ready", "Busy", "Done", "Fault", "Warning", "Auto", "PartPresent", "HS.Ready"];
export const bitsHtml = (v) => bin(v, 8).split("").map((c, i) => `<span class="${c === "1" ? "f9-b1" : "f9-b0"}" title="bit${7 - i} ${BITN[7 - i]}">${c}</span>`).join("");

/* ================================================================== 9G data block view (shares the tick of 9F) */
function html9G() {
  return card("f99G", "9G · Module data block – words 0–19 live", "the item 6 interface of APC01 at the tick selected in 9F",
    intro(`<p>The cell controller sees a module <b>only</b> through its data block (item 6): 20 standard words (state, mode, command, bits, alarm,
      counters, job, heartbeat) + module-specific words from word 20. The same words go to Modbus TCP holding registers (address = word), PROFINET
      bytes (2 × word) and OPC UA nodes. Below: the values at the tick chosen in 9F – move the scrubber there and watch the words change.</p>
      <p class="phd-eq">Status.Bits = Ready·2⁰ + Busy·2¹ + Done·2² + Fault·2³ + Warning·2⁴ + Auto·2⁵ + PartPresent·2⁶ + HS.Ready·2⁷ &nbsp;·&nbsp; DINT = 2 words · REAL = 2 words IEEE 754</p>`) +
    `<div id="f9GHead"></div><div id="f9GTab"></div>` +
    exBox("reading Bits = 97 and 106", `<p>97 = 64 + 32 + 1 = <b>0b01100001</b> → PartPresent + Auto + Ready: the module is Idle with a pallet and accepts Start.
      106 = 64 + 32 + 8 + 2 = <b>0b01101010</b> → PartPresent + Auto + Fault + Busy: it is Aborting with an alarm (AlarmNo tells which). The cell controller
      reads words 0–8 in <b>one</b> Modbus request (function 03, 9 registers) every poll cycle (item 6C), writes word 2 + word 3 for a command.</p>`) +
    useCase(`during virtual commissioning (9K) the cell controller is connected to the simulated module; this table is what the commissioning engineer
      watches in the Modbus client to prove the interface (item 6 / item 10) before the real machine arrives.`));
}

function f32words(v) { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, v); return [dv.getUint16(0), dv.getUint16(2)]; }
const hex4 = (v) => "16#" + (v & 0xffff).toString(16).toUpperCase().padStart(4, "0");
function drawDB(run, t) {
  if (!$("f9GTab")) return;
  const k = t.k, hb = Math.floor(k * EX9.module_run.tick_ms / 1000) % 65536, lc = f32words(t.lastCycle);
  const val = {
    0: [t.sc, `${t.state}`], 1: [1, "Production"], 2: [t.ccrIn ? t.cmdIn : 0, t.ccrIn ? `written this tick (${t.evs.find((e) => e.startsWith("CMD")) || ""}) → ${t.cmdRes} → PLC clears it to 0` : "0 = no command"],
    3: [t.ccrIn ? 1 : 0, t.ccrIn ? "bit0 CmdChangeRequest = 1 → cleared by the PLC" : "all 0"], 4: [t.bits, `<span class="f9-mono">${bitsHtml(t.bits)}</span> ${BITN.filter((n, i) => t.bits & (1 << i)).join(" + ")}`],
    5: [1, "Production requested"], 6: [t.alarm, t.alarm ? R_ALM[t.alarm] : "no alarm"], 7: [0, "no warning"], 8: [t.count, `hi ${hex4(0)} · lo ${hex4(t.count)}`], 10: [0, "hi 16#0000 · lo 16#0000"],
    12: [4711, "example job number (written by the cell controller with the Start)"], 14: [7, "example pallet P07"],
    16: [fx(t.lastCycle, 1), `IEEE 754: ${hex4(lc[0])} ${hex4(lc[1])} – time S10 → Complete of the last job`], 18: [hb, `+1 per second (tick ${k} → ${hb} s)`], 19: [(hb + 3) % 65536, "from the cell controller – the PLC checks that it changes (3 s)"],
  };
  $("f9GHead").innerHTML = `<p class="f8-pt">Scenario <b>${esc(run.name)}</b> · tick <b>${k}</b> (${(k / 10).toFixed(1)} s) · state ${t.state} – change the tick in 9F.</p>`;
  $("f9GTab").innerHTML = tab(["Word", "Name", "Type", "Dir.", "Value", "Hex", "Meaning / live note"], BLOCK.map(([w, n, ty, d, m]) => {
    const [v, note] = val[w] || ["", ""], num = typeof v === "number", changed = num && k > 0 && prevVal(run, k - 1, w) !== v;
    return `<tr class="${changed ? "f9-chg" : ""}"><td class="f8-r">${w}${ty === "DINT" || ty === "REAL" ? "–" + (w + 1) : ""}</td><td class="f9-mono">${n}</td><td>${ty}</td><td>${d}</td><td class="f8-r"><b>${v}</b></td><td class="f9-mono">${num ? hex4(v) : ""}</td><td><span class="sub">${esc(m)}</span><br>${note}</td></tr>`;
  }), "f8-small f9-dbt") + `<p class="am-note">Highlighted rows changed in this tick. Words 12–19 are example values (job, pallet, heartbeat); words 0–8 come from the simulation of 9F.</p>`;
}
function prevVal(run, k, w) { const q = run.ticks[k]; return { 0: q.sc, 1: 1, 2: q.ccrIn ? q.cmdIn : 0, 3: q.ccrIn ? 1 : 0, 4: q.bits, 5: 1, 6: q.alarm, 7: 0, 8: q.count, 10: 0, 12: 4711, 14: 7, 18: Math.floor(k / 10) % 65536, 19: (Math.floor(k / 10) + 3) % 65536 }[w]; }
