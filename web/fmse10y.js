/* FMS engineering – item 10 part A, second half: 10I alarm manager · 10J signal tower · 10K library engineering · 10L commissioning tests per FB
 * 10M use cases (FB counts per module from the item 9 code generator) · 10N checklists.  Engine: fmse10x.js.  Own localStorage keys "fmse.10.*". */
import { $, esc, ul, card, tab, kpis, intro, useCase, csvDownload, KITS } from "./fmse8x.js";
import { exBox, adler32 } from "./fmse9x.js";
import { CASES9 } from "./fmse9_data.js";
import { EX8 } from "./fmse8_data.js";
import {
  EX10A, DT, newFB, runTest, fmt, alarmMgr, almNo, CLS_N, REACT, STATES, SN, usage, FBT9, DEVICE_TYPES, CODES, MODS, store10 as store, L, T, RC, svg,
} from "./fmse10x.js";
import { ALM10, WRAP, VERSION10, RELEASE10, REVIEW10, UNITTEST10, COMM10, CHECKS10, LIB_INFO } from "./fmse10_data.js";

export const S = { almEv: store.get("almEv", null), almRow: null, twState: store.get("twState", 6), twCls: 0, clMod: store.get("clMod", "M02"), cl: store.get("cl", {}), rev: store.get("rev", {}), chk: store.get("chk", {}) };
const timers = {};
export const html = () => [html10I(), html10J(), html10K(), html10L(), html10M(), html10N()].join("");
export function init() { [init10I, init10J, init10K, init10L, init10M, init10N].forEach((f) => { try { f(); } catch (e) { console.error("fmse10y " + f.name, e); } }); }

/* ================================================================== 10I alarm manager */
const AM = EX10A.alarm_manager;
const almEvents = () => S.almEv || AM.events.map((x) => x.slice());
function html10I() {
  return card("f910I", "10I · Alarm manager FB_AlarmMgr – number, class, reaction", "decisions D2 + D3 · APC01 (M02) · edit the events",
    intro(`<p>Every device FB reports a local alarm code <code>iAlarm</code> (1–9). <b>FB_AlarmMgr</b> turns them into the module's alarm words of the data
      block and into the reaction of the PackML core:</p>
      <p class="phd-eq">number = M × 1000 + 10 × i + a &nbsp;·&nbsp; Admin.AlarmNo = active class A/B alarm with the best (class, activation order) &nbsp;·&nbsp; Admin.WarningNo = earliest active class C &nbsp;·&nbsp; AlarmClass = 1 / 2 / 3 of the most severe (0 none)</p>
      <p><b>Reaction:</b> class A → internal <b>Abort</b>; class B → internal <b>Hold</b> if the module is in Execute (else it stays); class C → no state change
      (warning). "A before B, earlier before later": the first severe alarm is the cause – later alarms are often only consequences (first-out idea of 9H).</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Instances of ${AM.unit} (M0${AM.module_code})</h3>${tab(["i", "Device", "FB"], AM.instances.map(([n, t], j) => `<tr><td>${j + 1}</td><td><b>${esc(n)}</b></td><td class="f9-mono">${t}</td></tr>`), "f8-small")}
        <h3 class="fe-h3">Alarm classes</h3>${tab(["Class", "Reaction", "Tower", "Horn"], Object.entries(EX10A.alarm_classes).map(([k, v]) => `<tr><td><b>${k}</b></td><td>${esc(v.reaction)}</td><td>${esc(v.tower)}</td><td>${v.horn ? "yes" : "no"}</td></tr>`), "f8-small")}</div>
      <div><h3 class="fe-h3">Class per (FB type, local alarm) in this module</h3>${tab(["FB type", "a", "Class", "Number (instances)"], AM.classes.map(([t, a, c]) => {
        const nums = t === "MODULE" ? [almNo(AM.module_code, 0, a)] : AM.instances.map(([, ft], j) => (ft === t ? almNo(AM.module_code, j + 1, a) : null)).filter(Boolean);
        return `<tr><td class="f9-mono">${t}</td><td>${a}</td><td><span class="f10-cls f10-cls${c}">${c}</span></td><td>${nums.join(", ")}</td></tr>`; }), "f8-small f9-dense")}
        <p class="am-note">${esc(AM._classes)}</p></div></div>
    <h3 class="fe-h3">Events (editable)</h3>
    <div class="fe-row f9-tin"><label>t <input type="number" id="f10IT" value="65" min="0" step="1"></label><label>event <select id="f10IE" class="fe-sel"><option>on</option><option>off</option></select></label>
      <label>instance <select id="f10II" class="fe-sel">${AM.instances.map(([n, t], j) => `<option value="${j + 1}">${j + 1} ${esc(n)} (${t})</option>`).join("")}</select></label>
      <label>local alarm a <select id="f10IA" class="fe-sel">${[1, 2, 3].map((a) => `<option>${a}</option>`).join("")}</select></label>
      <button class="mx-el" id="f10IAdd">Add event</button><button class="mx-el" id="f10IRst">Reset to the example</button></div>
    <div id="f10ILog"></div><div id="f10IAct" class="f8-pt"></div>` +
    exBox("the example sequence", `<p>t 10: clamp-pressure signal uncertain → 2053 class C → only a <b>warning</b>. t 20: clamp end position not reached (2021, class B) → AlarmNo 2021, Hold.
      t 25: rotation end position not reached (2011, class A) → <b>AlarmNo jumps to 2011</b> (A before B) → Abort. t 30 / 32 both clear → back to the warning. t 40 pressure not
      reached (2051, B) → Hold; t 45 pressure lost while clamped (2052, A) → Abort, AlarmNo 2052; t 50 the A alarm clears → AlarmNo falls back to 2051 (B). At t 60
      everything is clear: AlarmNo = WarningNo = 0, class 0.</p>`) +
    useCase(`SCADA needs only the three words AlarmNo, WarningNo, AlarmClass per module (plus the text table generated from the library) – the cell controller uses
      AlarmClass to decide whether to re-route pallets (class A: module out of service) or just wait (class B: operator is fixing it).`));
}
function init10I() {
  $("f10IAdd").addEventListener("click", () => {
    const ev = almEvents(); ev.push([Math.max(0, Math.round(+$("f10IT").value || 0)), $("f10IE").value, +$("f10II").value, +$("f10IA").value]); ev.sort((a, b) => a[0] - b[0]);
    S.almEv = ev; store.set("almEv", ev); $("f10IT").value = (+$("f10IT").value || 0) + 5; draw10I();
  });
  $("f10IRst").addEventListener("click", () => { S.almEv = null; store.del("almEv"); S.almRow = null; draw10I(); });
  $("f10ILog").addEventListener("click", (e) => {
    const d = e.target.closest("[data-del]"); if (d) { const ev = almEvents(); ev.splice(+d.dataset.del, 1); S.almEv = ev; store.set("almEv", ev); S.almRow = null; draw10I(); return; }
    const r = e.target.closest("[data-ar]"); if (r) { S.almRow = +r.dataset.ar; draw10I(); }
  });
  draw10I();
}
function draw10I() {
  const ev = almEvents(), A = Object.assign({}, AM, { events: ev }), res = alarmMgr(A);
  S.amLog = res.log;
  $("f10ILog").innerHTML = tab(["t", "event", "number", "class", "→ AlarmNo", "WarningNo", "AlarmClass", "reaction", ""], res.rows.map((r, j) => `<tr data-ar="${j}" class="${S.almRow === j ? "f9-chg" : ""}"><td>${r.t}</td><td>${r.ev}</td><td><b>${r.no}</b> <span class="sub">${esc(AM.instances[r.inst - 1] ? AM.instances[r.inst - 1][0] : "module")} a${r.alarm}</span></td><td><span class="f10-cls f10-cls${r.c}">${r.c}</span></td><td><b>${r.alarmNo}</b></td><td>${r.warnNo}</td><td>${r.cls}</td><td>${esc(r.reaction)}</td><td><button class="mx-el f10-pb" data-del="${j}" title="delete">✕</button></td></tr>`), "f8-small");
  const r = res.rows[S.almRow == null ? res.rows.length - 1 : S.almRow];
  $("f10IAct").innerHTML = r ? `Active list after t ${r.t} (activation order): ${r.active.length ? r.active.map(([n, c, o]) => `<span class="f10-chip">${n} <span class="f10-cls f10-cls${c}">${c}</span> #${o}</span>`).join(" ") : "<i>none</i>"}` : "";
}

/* ================================================================== 10J signal tower */
function towerPattern(state, cls) {
  const f = newFB("FB_SignalTower"); f.i.iState = state; f.i.iAlarmClass = cls; f.run(); const a = Object.assign({}, f.o); f.c_ = 5; f.run(); const b = f.o;
  const m = (k) => (a[k] && b[k] ? "on" : a[k] || b[k] ? "blink" : "off");
  return { red: m("qRed"), yellow: m("qYellow"), green: m("qGreen"), horn: a.qBuzzer };
}
function html10J() {
  const rows = Object.entries(STATES).map(([s, v]) => { const p = towerPattern(v, 0); return `<tr><td><b>${v} ${s}</b></td>${["red", "yellow", "green"].map((c) => `<td><span class="f10-lp f10-lp${c} f10-${p[c]}"></span> ${p[c]}</td>`).join("")}</tr>`; });
  return card("f910J", "10J · Signal tower FB_SignalTower – state and alarm class → lamps", "IEC 60204-1 10.3 / IEC 60073 colours · blink 1 Hz · horn with acknowledge",
    intro(`<p>The signal tower must mean the same on every module, so it is driven by the <b>standard signals</b> only: the PackML state and the alarm class
      from FB_AlarmMgr. Colours after IEC 60204-1 10.3 / IEC 60073: <b>red</b> = danger / fault, <b>yellow</b> = abnormal, attention, <b>green</b> = normal;
      <b>flashing green</b> = ready and waiting (Idle, Complete).</p>
      <p class="phd-eq">red = class A ∨ state ∈ {Aborting, Aborted} · yellow = class ∈ {B, C} ∨ state ∈ {Stopped, Suspended, Held} · green = state ∈ {Starting, Execute, Unholding, Unsuspending, Completing} ∨ (state ∈ {Idle, Complete} ∧ blink)</p>
      <p class="phd-eq">horn ON when the class changes to A or B · OFF on the rising edge of HornAck or when the class becomes 0 · blink = ⌊c ÷ 5⌋ mod 2 = 0 (1 Hz at 100 ms)</p>`) +
    `<div class="grid2 eq"><div><div class="fe-row"><label>PackML state <select id="f10JS" class="fe-sel">${Object.entries(STATES).map(([s, v]) => `<option value="${v}">${v} ${s}</option>`).join("")}</select></label>
        <label>Alarm class <select id="f10JC" class="fe-sel"><option value="0">0 none</option><option value="1">1 A</option><option value="2">2 B</option><option value="3">3 C</option></select></label>
        <button class="mx-el" id="f10JAck">Horn acknowledge</button></div>
      <div class="f10-towerbox"><div id="f10JTower"></div><div id="f10JOut" class="f8-pt"></div></div></div>
      <div><h3 class="fe-h3">Lamp pattern per state (no alarm)</h3>${tab(["State", "Red", "Yellow", "Green"], rows, "f8-small f9-dense")}</div></div>` +
    exBox("test T1", `<p>Stopped → yellow. Resetting (15) → all off. Idle → green blinking (on at tick 4, off 5, on 10 …). Execute → green steady. Class B at tick 15 → yellow + horn.
      Holding / Held → green off, yellow stays. Horn acknowledged at 19 → silent, yellow stays (the cause is still there). Class A at 22 → red + horn again (the class changed).
      Aborting / Aborted → red. Class 0 + Clearing → all off, Stopped → yellow.</p>`) +
    useCase(`an operator walking through the hall sees from 30 m: green = producing, flashing green = waiting for a pallet (a logistics problem, not a machine problem),
      yellow = needs attention, red = broken. The same colours on all 22 modules make the OEE losses visible without SCADA.`));
}
let tower = null;
function init10J() {
  tower = newFB("FB_SignalTower");
  $("f10JS").value = String(S.twState); $("f10JC").value = String(S.twCls);
  const sync = () => { S.twState = +$("f10JS").value; S.twCls = +$("f10JC").value; store.set("twState", S.twState); tower.i.iState = S.twState; tower.i.iAlarmClass = S.twCls; };
  ["f10JS", "f10JC"].forEach((id) => $(id).addEventListener("change", () => { sync(); stepTower(); }));
  $("f10JAck").addEventListener("click", () => { tower.i.xHornAck = true; stepTower(); tower.i.xHornAck = false; });
  sync(); stepTower();
  // run the 100 ms tower only while it is on screen (no work when the card is scrolled away or the tab is hidden)
  const run = (on) => { if (on && !timers.tw) timers.tw = setInterval(() => { if (!document.getElementById("f10JTower")) { clearInterval(timers.tw); timers.tw = null; return; } stepTower(); }, 100); else if (!on && timers.tw) { clearInterval(timers.tw); timers.tw = null; } };
  if ("IntersectionObserver" in window) new IntersectionObserver((es) => run(es.some((e) => e.isIntersecting))).observe($("f10JTower"));
}
function stepTower() {
  tower.run(); const o = tower.o;
  let b = RC(46, 6, 48, 4, "f9-arm", 1);
  [["qRed", "red", 12], ["qYellow", "yellow", 58], ["qGreen", "green", 104]].forEach(([k, c, y]) => { b += RC(40, y, 60, 44, `f10-tw f10-tw${c}${o[k] ? " f10-twOn" : ""}`, 6); });
  b += RC(52, 150, 36, 70, "f9-arm", 2) + RC(30, 220, 80, 8, "f9-arm", 2);
  b += `<path d="M120 40l14 -10v40l-14 -10z" class="${o.qBuzzer ? "f10-hornOn" : "f9-box"}"/>` + (o.qBuzzer ? `<path d="M140 36q6 14 0 28M146 30q10 20 0 40" class="f10-wave"/>` : "");
  $("f10JTower").innerHTML = svg(170, 232, b, "f10-tower", "Signal tower");
  $("f10JOut").innerHTML = `qRed ${o.qRed ? 1 : 0} · qYellow ${o.qYellow ? 1 : 0} · qGreen ${o.qGreen ? 1 : 0} · qBuzzer ${o.qBuzzer ? 1 : 0}<br><span class="sub">state ${S.twState} ${SN[S.twState]}, class ${S.twCls} – the FB runs every 100 ms (blink 1 Hz)</span>`;
}

/* ================================================================== 10K library engineering */
function html10K() {
  return card("f910K", "10K · Library engineering – version, release, unit tests, review", "a library is a product: it has versions, tests and a release process",
    intro(`<p>A library used in 22 modules and many plants must be handled like a product. A "small fix" in FB_Valve2 changes 30+ machines. Rules:
      <b>semantic versioning</b>, one place where the library is changed, <b>unit tests</b> as proof, a second person <b>reviews</b>, modules update on purpose.</p>
      <p class="phd-eq">version = MAJOR.MINOR.PATCH · interface change → MAJOR · compatible function → MINOR · bug fix → PATCH</p>`) +
    `<h3 class="fe-h3">Versioning</h3>${tab(["Step", "When", "Consequence"], VERSION10.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`), "f8-small")}
    <div class="grid2 eq"><div><h3 class="fe-h3">Release process</h3><ol class="f10-ol">${RELEASE10.map((x) => `<li>${esc(x)}</li>`).join("")}</ol></div>
      <div><h3 class="fe-h3">Unit test pattern (Arrange – Act – Assert)</h3>${tab(["Step", "What"], UNITTEST10.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td></tr>`), "f8-small")}</div></div>
    <h3 class="fe-h3">The 19 unit tests of library version 1.0 (run now in this browser)</h3><div id="f10KTab"></div>
    <h3 class="fe-h3">Code review checklist</h3><div class="fe-row"><span id="f10KProg" class="f8-pt"></span><button class="mx-el" id="f10KClr">Clear ticks</button></div>
    <div class="f8-chk">${REVIEW10.map((t, j) => `<label class="f8-ci"><input type="checkbox" data-rv="${j}"> ${esc(t)}</label>`).join("")}</div>` +
    exBox("a PATCH that is really a MAJOR", `<p>Someone "fixes" FB_Valve1 so that an error switches qSol off. The interface is the same – but the behaviour changed: the module
      expected the solenoid to stay on and the class to decide (D3). Test V2 now gives a different log line at tick 21 (qSol = 0). The test catches it, the review asks
      "why?", and the change becomes a MAJOR version with a module regression test – or it is rejected.</p>`) +
    useCase(`the owner keeps the released library in the plant's version control (or a write-protected library server); each PLC project records which library version
      it uses, so a spare-part replacement or a later extension uses exactly the tested FBs.`));
}
function init10K() {
  const rows = EX10A.fb_tests.map((t) => { const r = runTest(t), txt = r.log.join("\n") + "\n"; return { t, n: r.log.length, ad: adler32(new TextEncoder().encode(txt)).toString(16).padStart(8, "0"), last: r.log[r.log.length - 1] }; });
  S.unit = rows.map((r) => ({ fb: r.t.fb, name: r.t.name, lines: r.n, adler32: r.ad }));
  $("f10KTab").innerHTML = tab(["FB", "Test", "Ticks", "Log lines", "Last line", "Adler-32 of the log"], rows.map((r) => `<tr><td class="f9-mono">${r.t.fb}</td><td>${esc(r.t.name)}</td><td class="f8-r">${r.t.K}</td><td class="f8-r">${r.n}</td><td class="f9-mono">${esc(r.last)}</td><td class="f9-mono">${r.ad}</td></tr>`), "f8-small f9-dense") +
    `<p class="am-note">${rows.length} tests, ${rows.reduce((s, r) => s + r.n, 0)} log lines. The checksum lets you compare the log of the PLC simulator with this page and the Python tool without reading every line.</p>`;
  const boxes = () => [...document.querySelectorAll("#f910K [data-rv]")];
  const prog = () => { const b = boxes(); $("f10KProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!S.rev[b.dataset.rv]; b.addEventListener("change", () => { if (b.checked) S.rev[b.dataset.rv] = 1; else delete S.rev[b.dataset.rv]; store.set("rev", S.rev); prog(); }); });
  $("f10KClr").addEventListener("click", () => { S.rev = {}; store.set("rev", S.rev); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}

/* ================================================================== 10L commissioning tests per FB */
function html10L() {
  return card("f910L", "10L · Commissioning tests per FB – checklist generator", "choose a module → one test block per device FB instance + module standard FBs · CSV",
    intro(`<p>At the SAT every device is tested <b>on the real machine</b> through its FB: actuate, watch the FB outputs, provoke each alarm once and check the
      number + text in SCADA. Because every device uses a library FB, the test steps are the same for every instance – the generator writes them from the
      item 8 instance list of the module.</p>
      <p class="phd-eq">tests of a module = Σ over its FB instances (steps of the FB type) + FB_CmdIf + FB_AlarmMgr + signal tower</p>`) +
    `<div class="fe-row"><label>Module <select id="f10LMod" class="fe-sel">${CODES.map((c) => `<option value="${c}">${c} ${esc(MODS[c].title)}</option>`).join("")}</select></label>
      <button class="mx-el" id="f10LCsv">CSV download</button><button class="mx-el" id="f10LClr">Clear ticks</button><span id="f10LProg" class="f8-pt"></span></div>
    <div id="f10LTab"></div>` +
    exBox("M02 pallet changer", `<p>5 device FBs → Rotate (FB_Valve2, 4 steps), Clamp (FB_Valve1, 5 steps), PalSideA / B (FB_Sensor, 3 steps each), ClampPress (FB_AnalogIn,
      3 steps) + command interface, alarm manager and signal tower. Each alarm step names the expected number (e.g. Rotate alarm 1 → 2011) so the tester checks SCADA too.</p>`) +
    useCase(`the integrator fills the list during the SAT (date, name, OK / remark), the owner signs; the CSV goes into the hand-over documentation of item 13.`));
}
function clRows(code) {
  const mod = usage().mod[code], M = +code.slice(1), rows = [];
  mod.inst.forEach(([pn, g], j) => {
    const fb = FBT9[pn], base = WRAP[fb] || fb, alm = ALM10[base] || [];
    (COMM10[fb] || COMM10[base] || ["Function test of the device"]).forEach((s, k) => rows.push([j + 1, g, fb, k + 1, s, /alarm (\d)/.exec(s) ? `AlarmNo ${almNo(M, j + 1, +/alarm (\d)/.exec(s)[1])}` : ""]));
    if (alm.length) rows.push([j + 1, g, fb, "A", `Alarm list: ${alm.map(([a, t]) => `${almNo(M, j + 1, a)} ${t}`).join(" · ")}`, "check text in SCADA"]);
  });
  ["FB_CmdIf", "FB_AlarmMgr", "FB_SignalTower"].forEach((fb) => (COMM10[fb] || []).forEach((s, k) => rows.push(["–", "module", fb, k + 1, s, ""])));
  return rows;
}
function init10L() {
  $("f10LMod").value = S.clMod;
  $("f10LMod").addEventListener("change", () => { S.clMod = $("f10LMod").value; store.set("clMod", S.clMod); draw10L(); });
  $("f10LCsv").addEventListener("click", () => csvDownload(`commissioning_${S.clMod}.csv`, [["module", "i", "device", "FB", "step", "test", "expected", "OK"], ...clRows(S.clMod).map((r, j) => [S.clMod, ...r, S.cl[S.clMod + "." + j] ? "OK" : ""])]));
  $("f10LClr").addEventListener("click", () => { Object.keys(S.cl).filter((k) => k.startsWith(S.clMod + ".")).forEach((k) => delete S.cl[k]); store.set("cl", S.cl); draw10L(); });
  $("f10LTab").addEventListener("change", (e) => { const k = e.target.dataset.cl; if (!k) return; if (e.target.checked) S.cl[k] = 1; else delete S.cl[k]; store.set("cl", S.cl); prog(); });
  draw10L();
}
function prog() { const b = [...document.querySelectorAll("#f10LTab [data-cl]")]; $("f10LProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} done`; }
function draw10L() {
  const rows = clRows(S.clMod);
  S.clCount = rows.length;
  $("f10LTab").innerHTML = tab(["i", "Device", "FB", "Step", "Test", "Expected / check", "OK"], rows.map((r, j) => `<tr><td>${r[0]}</td><td><b>${esc(r[1])}</b></td><td class="f9-mono">${r[2]}</td><td>${r[3]}</td><td>${esc(r[4])}</td><td class="sub">${esc(r[5])}</td><td><input type="checkbox" data-cl="${S.clMod}.${j}"${S.cl[S.clMod + "." + j] ? " checked" : ""}></td></tr>`), "f8-small f9-dense");
  prog();
}

/* ================================================================== 10M use cases */
function html10M() {
  return card("f910M", "10M · Use cases – machining kit, assembly line, robot welding", "FB instances per type from the item 8 instance lists (item 9 code generator)",
    intro(`<p>The same library serves every domain; what changes is the <b>mix</b>. The table counts the device FB instances of each case from the module
      instance lists (each module of the case once per entry), plus the 3 module-standard FBs (CmdIf, PackMLCore, AlarmMgr) per module.</p>
      <p class="phd-eq">instances(type, case) = Σ<sub>modules m in case</sub> n(type, m) &nbsp;·&nbsp; standard FBs = 3 × number of modules</p>`) +
    `<div id="f10MTab"></div><div id="f10MTxt"></div>` +
    exBox("what the numbers say", `<p>The machining kit is dominated by valves, sensors and safety mirrors around the pallet handling; the assembly line by valves and sensors of many identical
      stations (one station FB type, many instances); the welding cells by safety mirrors (doors, light curtains, contactor pairs) and the hard-wired handshake to the robot –
      few FB types, but the safety part is large. The library makes the effort predictable: count the instances, multiply by the test steps of 10L.</p>`) +
    useCase(`for an offer, the integrator counts FB instances per type from the E-CAD instance list (item 8) and prices engineering + SAT per instance; the owner can check
      the offer with the same table.`));
}
function init10M() {
  const u = usage(), cases = CASES9.map(([name, desc, , , src]) => { const list = Array.isArray(src) ? src : KITS[src] || EX8.kit.modules; const per = {}; list.forEach((c) => Object.entries(u.mod[c].fbc).forEach(([t, n]) => { per[t] = (per[t] || 0) + n; })); return { name, desc, list, per, tot: Object.values(per).reduce((s, n) => s + n, 0) }; });
  const types = DEVICE_TYPES.filter((t) => cases.some((c) => c.per[t]));
  S.cases = cases.map((c) => ({ name: c.name, modules: c.list.length, devFb: c.tot, stdFb: 3 * c.list.length, types: Object.keys(c.per).length }));
  $("f10MTab").innerHTML = tab(["FB type", ...cases.map((c) => esc(c.name))], types.map((t) => `<tr><td class="f9-mono">${t}</td>${cases.map((c) => `<td class="f8-r">${c.per[t] || ""}</td>`).join("")}</tr>`).concat([
    `<tr class="f8-tot"><td><b>device FB instances</b></td>${cases.map((c) => `<td class="f8-r"><b>${c.tot}</b></td>`).join("")}</tr>`,
    `<tr><td>modules</td>${cases.map((c) => `<td class="f8-r">${c.list.length}</td>`).join("")}</tr>`,
    `<tr><td>module-standard FBs (3 / module)</td>${cases.map((c) => `<td class="f8-r">${3 * c.list.length}</td>`).join("")}</tr>`,
    `<tr><td>FB types used</td>${cases.map((c) => `<td class="f8-r">${Object.keys(c.per).length}</td>`).join("")}</tr>`,
    `<tr><td>device FBs / module</td>${cases.map((c) => `<td class="f8-r">${(c.tot / c.list.length).toFixed(1)}</td>`).join("")}</tr>`]), "f8-small f9-dense");
  $("f10MTxt").innerHTML = `<div class="f9-cases">${cases.map((c) => `<div class="f8-sub"><h3 class="fe-h3">${esc(c.name)}</h3><p class="f8-pt">${esc(c.desc)}</p><p class="f8-pt sub">modules: ${c.list.join(", ")}</p></div>`).join("")}</div>`;
}

/* ================================================================== 10N checklists */
function html10N() {
  return card("f910N", "10N · Checklists", "program standard · library · safety mirrors · commissioning – ticks saved in this browser",
    `<div class="fe-row"><span id="f10NProg" class="f8-pt"></span><button class="mx-el" id="f10NClr">Clear ticks</button></div>
    <div class="f8-chk">${CHECKS10.map(([h, a], i) => `<div class="f8-sub"><h3 class="fe-h3">${esc(h)}</h3>${a.map((t, j) => `<label class="f8-ci"><input type="checkbox" data-c="${i}.${j}"> ${esc(t)}</label>`).join("")}</div>`).join("")}</div>` +
    useCase(`"program standard" is signed before coding starts (FDS gate), "library" before the library release, "safety mirrors" together with the safety validation of
      item 7, "commissioning" at the end of the SAT.`));
}
function init10N() {
  const boxes = () => [...document.querySelectorAll("#f910N [data-c]")];
  const prog = () => { const b = boxes(); $("f10NProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!S.chk[b.dataset.c]; b.addEventListener("change", () => { if (b.checked) S.chk[b.dataset.c] = 1; else delete S.chk[b.dataset.c]; store.set("chk", S.chk); prog(); }); });
  $("f10NClr").addEventListener("click", () => { S.chk = {}; store.set("chk", S.chk); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}
