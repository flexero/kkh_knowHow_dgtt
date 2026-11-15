/* FMS engineering – item 9, sections 9H–9N (used by fmse9.js):
 * 9H alarm state machine ISA-18.2 · 9I code generator (item 8 library → ST) · 9J coding standard · 9K testing + virtual commissioning
 * 9L effort estimator · 9M cases · 9N checklists.  Engine: fmse9x.js.  User data in localStorage "fmse.9.*". */
import { $, esc, fx, ul, card, tab, kpis, intro, useCase, csvDownload, calcKit } from "./fmse8x.js";
import { EX9, EX8, MODS, CODES, alarms, codegen, kitFb, kitQty, effort, motor, moduleRun, analog, limits, fbTrace, store9 as store, exBox, pre } from "./fmse9x.js";
import { CODING, TEST_UNIT, TEST_LEVELS, FAT_SW, SAT_SW, CASES9, CHECKS9 } from "./fmse9_data.js";
import { KITS } from "./fmse6_data.js";

export const S = {
  almEv: store.get("almEv", null), almRow: -1, mod: store.get("mod", "M02"),
  qty: store.get("qty", null), coef: store.get("coef", null), fac: store.get("fac", null), chk: store.get("chk", {}), fat: store.get("fat", {}),
};
if (!MODS[S.mod]) S.mod = "M02";
export const html = () => [html9H(), html9I(), html9J(), html9K(), html9L(), html9M(), html9N()].join("");
export function init() { [init9H, init9I, init9K, init9L, init9M, init9N].forEach((f) => { try { f(); } catch (e) { console.error("fmse9y " + f.name, e); } }); }

const L = (x1, y1, x2, y2, c = "f9-w") => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${c}"/>`;
const T = (x, y, t, a = "start", c = "f9-sm") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`;
const RC = (x, y, w, h, c = "f9-box", rx = 4) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${c}"/>`;

/* ================================================================== 9H alarms ISA-18.2 */
const APOS = { NORM: [90, 50], UNACK: [330, 50], ACKED: [330, 170], RTNUN: [90, 170], SHLVD: [520, 60], OOS: [520, 160] };
const AEDGES = [["NORM", "UNACK", "act", 0, -8], ["UNACK", "ACKED", "ack", 22, 0], ["UNACK", "RTNUN", "clr", 30, -10], ["ACKED", "NORM", "clr", -30, -6], ["RTNUN", "NORM", "ack", -20, 0], ["RTNUN", "UNACK", "act", -26, 22]];
const EVS = ["act", "clr", "ack", "shelve", "unshelve", "oos", "ios"];
const almEvents = () => S.almEv || EX9.alarms.events.map((x) => x.slice());
function html9H() {
  return card("f99H", "9H · Alarm handling – the ISA-18.2 state machine", "states NORM / UNACK / ACKED / RTNUN / SHLVD / OOS · first-out · chattering · standing alarms",
    intro(`<p>An <b>alarm</b> is not a bit; it is a small <b>state machine</b> (ISA-18.2 / IEC 62682). It follows the process condition
      (<b>act</b> / <b>clr</b>) and the operator (<b>ack</b>, <b>shelve</b>, out of service):</p>
      <p class="phd-eq">NORM —act→ UNACK (horn) —ack→ ACKED —clr→ NORM · UNACK —clr→ RTNUN —ack→ NORM · RTNUN —act→ UNACK · shelve → SHLVD · oos → OOS</p>
      <p><b>Annunciation</b> = every transition into UNACK (horn, flashing). <b>First-out</b>: in a group the first alarm that comes is marked –
      it usually is the cause, the others follow (air pressure low → many clamps "pressure low"). The group is re-armed when all its alarms are back in
      NORM. <b>Chattering</b>: ≥ 3 activations within 60 s – fix it with hysteresis / delay (9D) or shelve it. <b>Standing</b> alarms (UNACK or ACKED at
      the end of a shift) show bad alarm design or a real open problem. Target (EEMUA 191): ≤ 1 alarm per 10 min per operator in normal operation.</p>`) +
    `<div class="grid2 eq"><div><h3 class="fe-h3">Alarm list</h3><div id="f9HDefs"></div><div class="fe-scroll" id="f9HDia"></div></div>
      <div><h3 class="fe-h3">Result</h3><div id="f9HRes"></div>
        <h3 class="fe-h3">Add an event</h3><div class="fe-row"><label>t s <input type="number" id="f9HT" min="0" step="1"></label>
        <label>alarm <select id="f9HA" class="fe-sel">${EX9.alarms.defs.map((d) => `<option>${d[0]}</option>`).join("")}</select></label>
        <label>event <select id="f9HE" class="fe-sel">${EVS.map((e) => `<option>${e}</option>`).join("")}</select></label>
        <button class="mx-el" id="f9HAdd">Add</button><button class="mx-el" id="f9HRst">Reset to JSON</button></div></div></div>
    <h3 class="fe-h3">Event log (click a row to see the transition in the diagram)</h3><div id="f9HLog"></div>` +
    exBox("the alarm flood at t = 100 s", `<p>Air pressure drops (A1 act at 100 s) → 1 s later the pool travel faults (A2) and the APC clamp pressure is low (A3).
      All three annunciate, but only <b>A1</b> is marked <b>FIRST-OUT</b> in group CELL – the operator fixes the air, not the clamp. The washer level switch A4
      bounces at 200, 212 and 224 s → <b>chattering</b> (3 activations within 24 s ≤ 60 s); it is shelved at 240 s – while shelved, act/clr have no effect
      on the display. A2 is <b>not shelvable</b> (a travel fault must never be hidden): "shelve" at 310 s has no effect. A5 is out of service for
      maintenance at 500 s; when it returns to service (600 s) while the condition is still active, it annunciates again. At the end A3 and A5 are
      <b>standing</b> (acknowledged but active) → items for the shift hand-over.</p>`) +
    useCase(`the alarm list of every module (item 6: AlarmNo = range × 1000 + n) goes into one alarm database with tag, priority, group, shelvable flag
      and the operator action. SCADA (M20) implements this state machine; the PLC only sends the condition. The alarm rationalisation meeting
      (owner + integrator) removes chattering and standing alarms before SAT.`));
}
function init9H() {
  $("f9HAdd").addEventListener("click", () => {
    const t = Math.round(+$("f9HT").value); if (!(t >= 0)) return;
    S.almEv = almEvents(); S.almEv.push([t, $("f9HA").value, $("f9HE").value]); S.almEv.sort((a, b) => a[0] - b[0]);
    store.set("almEv", S.almEv); S.almRow = S.almEv.findIndex((e) => e[0] === t && e[1] === $("f9HA").value && e[2] === $("f9HE").value); draw9H();
  });
  $("f9HRst").addEventListener("click", () => { S.almEv = null; store.del("almEv"); S.almRow = -1; draw9H(); });
  draw9H();
}
function draw9H() {
  const evs = almEvents(), r = alarms({ defs: EX9.alarms.defs, events: evs }), defs = EX9.alarms.defs;
  const last = evs.length ? evs[evs.length - 1][0] : 0; $("f9HT").value = last + 10;
  const pr = { 1: "high", 2: "medium", 3: "low" };
  $("f9HDefs").innerHTML = tab(["Id", "Tag", "Prio", "Group", "Shelv.", "Final", "Annunc.", "Chatter", "Standing"], defs.map(([id, tag, p, g, sh]) =>
    `<tr><td><b>${id}</b></td><td class="f8-tag2">${esc(tag)}</td><td>${p} ${pr[p]}</td><td>${g}</td><td>${sh ? "yes" : "no"}</td><td><span class="f9-as f9-a${r.final[id]}">${r.final[id]}</span></td><td class="f8-r">${r.ann[id]}</td><td>${r.chatter.includes(id) ? '<b class="f9-warn">yes</b>' : ""}</td><td>${r.standing.includes(id) ? '<b class="f9-bad">yes</b>' : ""}</td></tr>`), "f8-small");
  const row = S.almRow >= 0 && S.almRow < r.rows.length ? r.rows[S.almRow] : null;
  // diagram
  let b = `<defs><marker id="f9hA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="f9-ah"/></marker></defs>`;
  const W = 110, H = 34;
  AEDGES.forEach(([a, c, lab, ox, oy]) => {
    const pa = APOS[a], pc = APOS[c], hot = row && row.from === a && row.to === c;
    const vx = pc[0] - pa[0], vy = pc[1] - pa[1], len = Math.hypot(vx, vy), nx = -vy / len * 8, ny = vx / len * 8;
    const sx = pa[0] + vx * (Math.abs(vx) > Math.abs(vy) ? W / 2 / Math.abs(vx) : H / 2 / Math.abs(vy)) + nx, sy = pa[1] + vy * (Math.abs(vx) > Math.abs(vy) ? W / 2 / Math.abs(vx) : H / 2 / Math.abs(vy)) + ny;
    const ex = pc[0] - vx * (Math.abs(vx) > Math.abs(vy) ? W / 2 / Math.abs(vx) : H / 2 / Math.abs(vy)) + nx, ey = pc[1] - vy * (Math.abs(vx) > Math.abs(vy) ? W / 2 / Math.abs(vx) : H / 2 / Math.abs(vy)) + ny;
    b += `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" class="${hot ? "f9-ehot" : "f9-edge"}" marker-end="url(#f9hA)"/>` + T((sx + ex) / 2 + ox, (sy + ey) / 2 + oy, lab, "middle", hot ? "f9-xs f9-b" : "f9-xs");
  });
  b += L(400, 20, 400, 200, "f9-grid2") + T(520, 112, "from NORM/UNACK/ACKED/RTNUN", "middle", "f9-xs") + T(520, 124, "shelve → SHLVD · oos → OOS", "middle", "f9-xs") + T(520, 214, "unshelve / ios → UNACK if active, else NORM", "middle", "f9-xs");
  Object.entries(APOS).forEach(([s, [x, y]]) => {
    const cur = row && row.to === s, from = row && row.from === s && row.to !== s;
    b += RC(x - W / 2, y - H / 2, W, H, cur ? "f9-stA" : from ? "f9-st f9-from" : "f9-st f9-a" + s, 8) + T(x, y + 4, s, "middle", cur ? "f9-lbl f9-b f9-inv" : "f9-lbl");
  });
  const cap = row ? `${row.t} s · ${row.a} ${row.ev}: ${row.from} → ${row.txt}` : "click a log row";
  b += T(10, 232, cap, "start", "f9-sm f9-b");
  $("f9HDia").innerHTML = `<svg viewBox="0 0 620 240" class="f9-adia" role="img" aria-label="ISA-18.2 alarm state diagram">${b}</svg>`;
  $("f9HRes").innerHTML = kpis([["events", evs.length], ["annunciations", Object.values(r.ann).reduce((s, x) => s + x, 0)], ["chattering", r.chatter.join(", ") || "none", r.chatter.length ? "f9-warn" : ""], ["standing at end", r.standing.join(", ") || "none", r.standing.length ? "f9-bad" : ""]]) +
    `<p class="am-note"><b>First-out per group at the end:</b> ${Object.entries(r.fo).map(([g, a]) => `${g}: ${a || "– (re-armed)"}`).join(" · ")}</p>`;
  $("f9HLog").innerHTML = tab(["#", "t s", "Alarm", "Event", "From", "To", "Annunciation", "First-out", "active"], r.rows.map((x, i) =>
    `<tr class="f8-click${i === S.almRow ? " f8-hl" : ""}${x.to === x.from ? " f8-dim" : ""}" data-ar="${i}"><td>${i + 1}</td><td class="f8-r">${x.t}</td><td><b>${x.a}</b></td><td>${x.ev}</td><td>${x.from}</td><td><span class="f9-as f9-a${x.to}">${esc(x.txt)}</span></td><td>${x.ann ? '<b class="f9-warn">ANN</b>' : ""}</td><td>${x.fo ? "<b>FIRST-OUT</b>" : ""}</td><td>${x.active ? 1 : 0}</td></tr>`), "f8-small");
  $("f9HLog").querySelectorAll("[data-ar]").forEach((tr) => tr.addEventListener("click", () => { S.almRow = +tr.dataset.ar; draw9H(); }));
}

/* ================================================================== 9I code generator */
function html9I() {
  return card("f99I", "9I · Code generator – from the item 8 circuit library to IEC 61131-3 ST", "IO symbols with addresses · device FB instances · call list · checksum",
    intro(`<p>The IO list of a module is already defined by the circuit library (item 8): every pattern instance gives its signals in a fixed order.
      So the <b>boring and error-prone part</b> of the PLC program can be generated: the IO symbol table and the device FB layer. Rules:</p>
      <p class="phd-eq">symbol = UNIT_Group_Signal · DI k → %IX(2·⌊k/16⌋ + ⌊(k mod 16)/8⌋).(k mod 8) · AI k → %IW(2·cards<sub>DI</sub> + 8·⌊k/4⌋ + 2·(k mod 4)) · DO / AO likewise with %QX / %QW (cards<sub>DO</sub>)</p>
      <p>One device FB instance per pattern instance that has IO (type from the table <code>fb_types</code>: VALVE_DOUBLE → FB_Valve2, DOL → FB_MotorDol …).
      Inputs are wired by name (x&lt;Signal&gt; for DI / F-DI, i&lt;Signal&gt; for AI), outputs are written from the FB (q / w). Safety outputs (F-DO) get
      <b>no</b> line – only the F-program writes them; F-DI are read-only copies. A checksum (Adler-32 of the UTF-8 text) proves that the guide, the
      Python tool and this page generate <b>the same bytes</b>.</p>`) +
    `<div class="fe-row"><label class="f8-msel">Module <select id="f9IMod" class="fe-sel f8-selw">${CODES.map((c) => `<option value="${c}">${c} · ${esc(MODS[c].title)}</option>`).join("")}</select></label>
      <button class="mx-el" id="f9ICopy">Copy</button><button class="mx-el" id="f9IDl">Download .st</button><span id="f9IMsg" class="sub"></span></div>
    <div id="f9IKpi"></div><div class="grid2 eq f9-gen"><div><h3 class="fe-h3">Generated structured text</h3><div id="f9ICode"></div></div>
      <div><h3 class="fe-h3">IO map</h3><div id="f9IIo"></div><h3 class="fe-h3">FB instances in this module</h3><div id="f9IFb"></div></div></div>
    <h3 class="fe-h3">Kit: FB instances per module (each module instance counts)</h3><div id="f9IKit"></div>` +
    exBox("M02 pallet changer APC01", `<p>Instances: Rotate (VALVE_DOUBLE), Clamp (VALVE_SINGLE), PalSideA/B (SENSOR), ClampPress (ANALOG_P) → 10 IO (DI 6, DO 3, AI 1).
      Cards with 20 % reserve: DI 1, DO 1, AI 1 → the first AI word is %IW2 (after 2 bytes of DI). The text has <b>32 lines, 1830 characters,
      Adler-32 0f66079f</b>; M03 (pallet pool, 13 FB instances): 70 lines, 5169 characters, b0c1f5f1; M10 (washer): 56 lines, 4004 characters, 5ab5ac95.
      Over the 18-module kit: <b>95 FB instances</b> – the input of the effort estimate (9L).</p>`) +
    useCase(`the integrator runs the generator after every change of the E-CAD IO list (item 8) and imports the .st file into the PLC project (TIA Openness,
      TwinCAT Automation Interface, CODESYS PLCopenXML or plain ST import). The programmer then writes only the module logic (PackML + sequence, 9F).
      The owner can compare the checksum in the FAT with the one of the released IO list – a changed IO list shows immediately.`));
}
function init9I() {
  $("f9IMod").value = S.mod;
  $("f9IMod").addEventListener("change", () => { S.mod = $("f9IMod").value; store.set("mod", S.mod); draw9I(); });
  $("f9ICopy").addEventListener("click", () => {
    const txt = codegen(S.mod).txt, ok = () => { $("f9IMsg").textContent = "copied"; }, fb = () => { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); ok(); } catch (e) { $("f9IMsg").textContent = "copy blocked – select the text"; } ta.remove(); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fb); else fb();
  });
  $("f9IDl").addEventListener("click", () => {
    const g = codegen(S.mod), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([g.txt], { type: "text/plain;charset=utf-8" })); a.download = `FB_${g.unit}_Devices.st`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  draw9I();
  const kf = kitFb(), kit = EX8.kit.modules, cnt = {}; kit.forEach((c) => { cnt[c] = (cnt[c] || 0) + 1; });
  const types = {}; kit.forEach((c) => { const g = codegen(c); Object.entries(g.fbc).forEach(([t, n]) => { types[t] = (types[t] || 0) + n; }); });
  $("f9IKit").innerHTML = `<div class="grid2 eq"><div>${tab(["Module", "×", "FB per module", "FB in kit"], Object.keys(cnt).map((c) => `<tr><td>${c} · ${esc(MODS[c].title)}</td><td class="f8-r">${cnt[c]}</td><td class="f8-r">${kf.per[c]}</td><td class="f8-r">${cnt[c] * kf.per[c]}</td></tr>`).concat([`<tr class="f8-tot"><td>Kit "${esc(EX8.kit.name)}" – ${kit.length} modules</td><td></td><td></td><td class="f8-r">${kf.kit}</td></tr>`]), "f8-small")}</div>
    <div>${tab(["FB type", "Instances in kit"], Object.entries(types).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<tr><td class="f9-mono">${t}</td><td class="f8-r">${n}</td></tr>`), "f8-small")}
    <p class="am-note">FB per module for all 22 library modules: ${CODES.map((c) => `${c} ${kf.per[c]}`).join(" · ")}. Modules M20/M21 have no IO (PC software).</p></div></div>`;
}
function draw9I() {
  const g = codegen(S.mod);
  $("f9IKpi").innerHTML = kpis([["lines", g.lines], ["characters (UTF-8 bytes)", g.bytes], ["Adler-32", `<span class="f9-mono">${g.adler}</span>`], ["IO points", g.vars.length], ["FB instances", g.fb]]) +
    `<p class="am-note">${g.ascii ? "All text is ASCII, so characters = bytes." : "The text contains non-ASCII characters: the UTF-8 byte count is used (" + g.chars + " JS characters)."} Unit ${g.unit} · cards DI ${g.cards.DI}, DO ${g.cards.DO}, AI ${g.cards.AI}, AO ${g.cards.AO} (item 8, 20 % reserve).</p>`;
  $("f9ICode").innerHTML = pre(g.txt, "f9ITxt", "f9-gencode");
  $("f9IIo").innerHTML = g.vars.length ? tab(["Symbol", "Type", "IEC addr.", "Card addr.", "Description"], g.vars.map((v) => `<tr><td class="f9-mono">${v.sym}</td><td><span class="f8-tt f8-t${v.t}">${v.t}</span></td><td class="f9-mono">${v.iec || "– (F)"}</td><td>${v.addr}</td><td>${esc(v.ds)}</td></tr>`), "f8-small") : `<p class="am-note">This module has no IO wires (PC software / network only).</p>`;
  $("f9IFb").innerHTML = g.inst.length ? tab(["Instance", "Pattern", "FB type"], g.inst.map(([pn, gname]) => `<tr><td class="f9-mono">${gname}</td><td>${pn}</td><td class="f9-mono">${EX9.codegen.fb_types[pn]}</td></tr>`), "f8-small") : `<p class="am-note">no FB instances</p>`;
}

/* ================================================================== 9J coding standard */
function html9J() {
  return card("f99J", "9J · Coding standard", "naming · prefixes · structure · one writer per output · comments · PLCopen – good and bad examples",
    intro(`<p>A <b>coding standard</b> makes code from different programmers and integrators look like one program. Maintenance at 3 a.m. depends
      on it. Most plant standards are based on the <b>PLCopen Coding Guidelines</b> and the PLC maker's style guide (Siemens Programming Style Guide,
      Beckhoff naming conventions). The most important rules:</p>
      <p class="phd-eq">one FB per device type · one state machine (PackML) for every module · one writer per output · every wait has a timeout · no loops that wait · names say type + meaning</p>`) +
    tab(["Topic", "Rule", "Good", "Bad"], CODING.map(([t, r, g, b]) => `<tr><td><b>${esc(t)}</b></td><td>${esc(r)}</td><td><code class="f9-good">${esc(g)}</code></td><td><code class="f9-badc">${esc(b)}</code></td></tr>`), "f8-small f9-coding") +
    exBox("one writer per output – why", `<p>The rotate solenoid SolB is set in step 20 of the sequence, reset in step 30, and also set in the manual-mode screen
      code. In manual mode an operator jogs the table, switches back to auto in step 30 – the manual code still holds SolB, the sequence does not
      write it any more → the table rotates while the clamp closes. With one writer the device FB alone writes <code>APC01_Rotate_SolB := Rotate.qSolB;</code>
      and decides between the auto request and the manual request in one place, with the interlocks. The generator of 9I enforces exactly this layer.</p>`) +
    useCase(`the owner attaches the coding standard to the purchase order; the integrator's code review before FAT checks it (cross-reference for one
      writer, static analysis tools such as CODESYS Static Analysis or TIA Project Check). Deviations are listed and approved in writing.`));
}

/* ================================================================== 9K testing and virtual commissioning */
function unitTests() {
  const m = EX9.motor.scenarios.map((s) => motor(s)), r = EX9.module_run.scenarios.map((s) => moduleRun(s)), an = EX9.analog;
  const fb = fbTrace(EX9.fb_trace), lim = limits(EX9.limits), A = (raw) => analog(raw, an.lo, an.hi);
  const ev = (k) => JSON.stringify(fb.events[k]);
  return [
    ["FB_MotorDol", "A normal: RUNNING at tick 4, STOPPED at end", m[0].log.includes("4 STARTING -> RUNNING") && m[0].final === "STOPPED"],
    ["FB_MotorDol", "B no feedback: FAULT alarm 1 at tick 7", m[1].log.some((l) => l.startsWith("7 STARTING -> FAULT alarm 1"))],
    ["FB_MotorDol", "C feedback lost: FAULT alarm 2 at tick 12", m[2].log.some((l) => l.startsWith("12 RUNNING -> FAULT alarm 2"))],
    ["FB_MotorDol", "D reset while tripped rejected, no restart after reset", m[3].log.includes("14 reset rejected (alarm 3)") && m[3].ticks[20].st === 0 && m[3].ticks[20].cmd],
    ["FB_MotorDol", "E welded: FAULT 4, reset rejected", m[4].final === "FAULT" && m[4].alarm === 4 && m[4].log.includes("25 reset rejected (alarm 4)")],
    ["FB_AnalogIn", "raw −6000 → BAD, substitute 0.0", A(-6000).q === "BAD" && A(-6000).vo === 0],
    ["FB_AnalogIn", "raw 28800 → UNCERTAIN, clamped 10.0", A(28800).q === "UNCERTAIN" && A(28800).vo === 10],
    ["FB_LimitAlarm", "H on 7 / off 11, L on 1 / off 3", JSON.stringify(lim.ev.slice(0, 4)) === JSON.stringify([[1, "L on"], [3, "L off"], [7, "H on"], [11, "H off"]])],
    ["TON", "Q events (7,1)(9,0)(20,1)(30,0)", ev("TON_Q") === "[[7,1],[9,0],[20,1],[30,0]]"],
    ["CTU", "Q at 15, reset at 33", ev("CTU_Q") === "[[15,1],[33,0]]"],
    ["FB_PackML", "E: Start in Stopped rejected", r[4].log.includes("2 cmd Start rejected in Stopped")],
    ["FB_ModuleAPC", "A: job complete, count 1, final Idle", r[0].count === 1 && r[0].final === "Idle"],
    ["FB_ModuleAPC", "B: rotate timeout alarm 12 at tick 70", r[1].log.some((l) => l.startsWith("70 ALARM 12"))],
    ["FB_ModuleAPC", "C: pressure low alarm 13 at tick 80", r[2].log.some((l) => l.startsWith("80 ALARM 13"))],
    ["FB_ModuleAPC", "D: hold keeps step S20, completes at 72", r[3].ticks[50].step === 20 && r[3].log.includes("72 step S30 -> S40")],
  ];
}
function html9K() {
  return card("f99K", "9K · Testing and virtual commissioning", "unit tests of FBs · simulation with plant models · software FAT / SAT",
    intro(`<p>PLC software is tested in <b>levels</b>, from the smallest part to the whole plant (V-model, item 1). The earlier a fault is found,
      the cheaper it is: a wrong timeout found in a unit test costs minutes, on site it costs a stopped line.</p>
      <p class="phd-eq">unit test (FB) → software-in-the-loop with plant models (module) → virtual commissioning (cell + cell controller + HMI) → software FAT → SAT</p>
      <p>A <b>plant model</b> is a small state model of the hardware – exactly what 9E (contactor + auxiliary contact) and 9F (double-solenoid valve,
      spring clamp, pressure) contain. With it the real PLC code runs against a "virtual machine" and every fault can be injected: jam, wire break,
      low pressure, welded contactor. The page runs the tests below live on the engine of this item.</p>`) +
    `<h3 class="fe-h3">Test levels</h3>${tab(["Level", "How", "Who", "When / scope"], TEST_LEVELS.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`), "f8-small")}
    <h3 class="fe-h3">Unit tests – run now on the FB models of 9C–9F</h3><div class="fe-row"><button class="mx-el" id="f9KRun">Run tests</button><span id="f9KSum" class="f8-pt"></span></div><div id="f9KTab"></div>
    <h3 class="fe-h3">Test specification (example)</h3>${tab(["FB", "Test", "Expected", "Where"], TEST_UNIT.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`), "f8-small")}
    <div class="grid2 eq"><div class="f8-sub"><h3 class="fe-h3">Software FAT checklist</h3>${FAT_SW.map((t, i) => `<label class="f8-ci"><input type="checkbox" data-kf="F${i}"> ${esc(t)}</label>`).join("")}</div>
      <div class="f8-sub"><h3 class="fe-h3">Software SAT checklist</h3>${SAT_SW.map((t, i) => `<label class="f8-ci"><input type="checkbox" data-kf="S${i}"> ${esc(t)}</label>`).join("")}</div></div>
    <div class="fe-row"><span id="f9KProg" class="f8-pt"></span><button class="mx-el" id="f9KClr">Clear ticks</button></div>` +
    exBox("virtual commissioning of the APC before the machine exists", `<p>The APC01 FB runs in a soft-PLC; the plant model of 9F answers its valves. The test engineer runs
      scenario A (normal job), then injects the faults of B (jam), C (low pressure), D (hold) and E (wrong commands) and compares the log with the
      expected log of the functional design – 23, 41, 42, 33 and 28 lines. The cell controller is connected over Modbus TCP to the same soft-PLC and
      sends real jobs. When the machine arrives, only the IO addresses change (generated, 9I) and the timeouts are adjusted.</p>`) +
    useCase(`the owner asks in the contract for "virtual commissioning of every module with plant models, 4 weeks before FAT, witnessed". Practice shows
      that 50–70 % of software faults are found there, and site commissioning time drops by about a third.`));
}
function init9K() {
  const run = () => { const t = unitTests(), ok = t.filter((x) => x[2]).length; $("f9KSum").innerHTML = `<b class="${ok === t.length ? "fe-ok" : "f9-bad"}">${ok} / ${t.length} passed</b>`; $("f9KTab").innerHTML = tab(["FB", "Assertion", "Result"], t.map(([f, a, p]) => `<tr><td>${f}</td><td>${esc(a)}</td><td class="${p ? "fe-ok" : "f9-bad"}">${p ? "PASS" : "FAIL"}</td></tr>`), "f8-small"); S.tests = { ok, n: t.length }; };
  $("f9KRun").addEventListener("click", run); run();
  const boxes = () => [...document.querySelectorAll("#f99K [data-kf]")];
  const prog = () => { const b = boxes(); $("f9KProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!S.fat[b.dataset.kf]; b.addEventListener("change", () => { if (b.checked) S.fat[b.dataset.kf] = 1; else delete S.fat[b.dataset.kf]; store.set("fat", S.fat); prog(); }); });
  $("f9KClr").addEventListener("click", () => { S.fat = {}; store.set("fat", S.fat); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}

/* ================================================================== 9L effort */
const QN = { io_std: "standard IO points (DI+DO+AI+AO)", io_safe: "safety IO points (F-DI+F-DO)", fb_instances: "FB instances (9I)", seq_steps: "sequence steps", safety_functions: "safety functions (item 7)", interfaces: "data-block interfaces", hmi_screens: "HMI screens", alarms: "alarms", recipes_params: "recipe parameters" };
const FN = { test_factor: "test factor", doc_factor: "documentation factor", pm_factor: "project management factor", contingency_factor: "contingency factor", hours_per_week: "hours per person-week" };
function html9L() {
  return card("f99L", "9L · Effort estimator for the PLC software", "quantities × coefficients → engineering, test, documentation, PM, contingency",
    intro(`<p>Integrators quote PLC software from <b>counts</b>: IO points, FB instances, sequence steps, interfaces, screens, alarms. Each count has an
      hour coefficient from their past projects. Test, documentation and project management are percentages; a contingency covers the unknown:</p>
      <p class="phd-eq">eng = Σ qty·coef · test = f<sub>t</sub>·eng · doc = f<sub>d</sub>·eng · pm = f<sub>pm</sub>·(eng + test + doc) · total = (eng + test + doc + pm)·(1 + f<sub>c</sub>) · person-weeks = total ÷ h/week</p>
      <p>The first three quantities come from the design itself: IO points from the item 8 kit (revised: <b>144</b> standard, <b>66</b> safety) and FB instances
      from the generator 9I (<b>95</b>). The rest are estimates. Edit any number; "Reset" brings the JSON example back.</p>`) +
    `<div class="fe-row"><button class="mx-el" id="f9LRst">Reset to JSON</button></div><div class="grid2 eq"><div id="f9LTab"></div><div><div id="f9LFac"></div><div id="f9LRes"></div></div></div>` +
    exBox("the 18-module machining kit", `<p>eng = 144·0.5 + 66·1.0 + 95·1.5 + 120·1.5 + 6·8 + 22·8 + 30·6 + 400·0.25 + 150·0.2 = <b>994.5 h</b>; test 0.4 → 397.8 h; documentation 0.15 →
      149.2 h; PM 0.1 of 1541.5 → 154.1 h; subtotal 1695.6 h; contingency 15 % → 254.3 h; <b>total 1950.0 h = 51.3 person-weeks</b> (38 h / week) – about
      one programmer for a year, or two for six months. With the generator (9I) and a tested library (item 10) the FB coefficient falls (e.g. 1.5 → 0.5 h).</p>`) +
    useCase(`the owner uses the same structure to check integrator quotes: same quantities, compare the coefficients. A quote far below the estimate usually
      means that tests or documentation are missing – ask for the hours per item.`));
}
function init9L() {
  const E = EX9.effort;
  const get = () => ({ qty: S.qty || kitQty(), coef: S.coef || Object.assign({}, E.coef_h), fac: S.fac || Object.assign({}, E.factors) });
  const draw = () => {
    const g = get(), r = effort(g.qty, g.coef, g.fac);
    $("f9LTab").innerHTML = tab(["Item", "Quantity", "h per unit", "Hours"], r.items.map(([k, q, c, h]) => `<tr><td>${QN[k] || k}${["io_std", "io_safe", "fb_instances"].includes(k) ? ' <span class="sub">(computed)</span>' : ""}</td><td><input type="number" min="0" step="any" data-lq="${k}" value="${q}"></td><td><input type="number" min="0" step="any" data-lc="${k}" value="${c}"></td><td class="f8-r">${fx(h, 1)}</td></tr>`).concat([`<tr class="f8-tot"><td>Engineering</td><td></td><td></td><td class="f8-r">${fx(r.eng, 1)}</td></tr>`]), "f8-small f9-tin");
    $("f9LFac").innerHTML = tab(["Factor", "Value"], Object.keys(FN).map((k) => `<tr><td>${FN[k]}</td><td><input type="number" min="0" step="any" data-lf="${k}" value="${g.fac[k]}"></td></tr>`), "f8-small f9-tin");
    $("f9LRes").innerHTML = kpis([["engineering h", fx(r.eng, 1)], ["test h", fx(r.test, 1)], ["documentation h", fx(r.doc, 1)], ["PM h", fx(r.pm, 1)], ["contingency h", fx(r.cont, 1)], ["total h", fx(r.total, 1), "f9-strong"], ["person-weeks", fx(r.weeks, 1), "f9-strong"]]) +
      `<div class="f9-ubar f9-ebar">${[["eng", r.eng, 1], ["test", r.test, 2], ["doc", r.doc, 3], ["PM", r.pm, 4], ["cont.", r.cont, 5]].map(([n, v, c]) => `<i class="fe-c${c}" style="width:${r.total ? (v / r.total * 100).toFixed(2) : 0}%" title="${n} ${fx(v, 1)} h"></i>`).join("")}</div><p class="am-note">Bar: share of eng / test / doc / PM / contingency in the total.</p>`;
    S.effort = r;
    const upd = (attr, dk, key) => document.querySelectorAll(`#f99L [${attr}]`).forEach((i) => i.addEventListener("change", () => {
      const v = +i.value, name = i.dataset[dk]; if (i.value === "" || !(v >= 0) || (name === "hours_per_week" && !(v > 0))) return;
      const cur = get(); cur[key][name] = v; S[key] = cur[key]; store.set(key, S[key]); draw();
    }));
    upd("data-lq", "lq", "qty"); upd("data-lc", "lc", "coef"); upd("data-lf", "lf", "fac");
  };
  $("f9LRst").addEventListener("click", () => { S.qty = S.coef = S.fac = null; ["qty", "coef", "fac"].forEach((k) => store.del(k)); draw(); });
  draw();
}

/* ================================================================== 9M cases */
function caseQty(list, base) {
  const q = kitQty(list), n0 = EX8.kit.modules.length, f = list.length / n0;
  Object.keys(EX9.effort.kit_qty).forEach((k) => { q[k] = Math.round(base[k] * f); });
  return q;
}
function html9M() {
  return card("f99M", "9M · Cases – machining kit, assembly line, robot welding", "same method, different weight: what changes in the PLC software",
    intro(`<p>The method of this item is the same for every FMS: device FBs from the circuit library, PackML + sequence per module, data block to the
      cell controller, alarms after ISA-18.2, generated IO layer, tests with plant models. What changes between domains is <b>where the effort
      goes</b>. The table computes IO and FB counts from the item 8 library for each case; the other quantities are scaled from the kit by the number
      of modules (a rough example – replace them with your counts).</p>`) +
    `<div id="f9MTab"></div><div id="f9MTxt"></div>` +
    exBox("reading the table", `<p>The assembly line has more FB instances per module than the machining kit (stations with many valves and sensors), the welding
      cells have few IO but a high share of safety IO (light curtains, doors, turntable zones) – there the safety functions and the PLC ↔ robot handshake
      dominate the effort, not the IO count.</p>`) +
    useCase(`in the concept phase (item 1, phase P3) the owner's engineer uses these numbers for the budget of the software package before any integrator
      quote exists; the same table is later filled with the real counts from the E-CAD and the FDS.`));
}
function init9M() {
  const base = EX9.effort.kit_qty;
  const rows = CASES9.map(([name, desc, how, focus, src]) => {
    const list = Array.isArray(src) ? src : KITS[src] || EX8.kit.modules, q = caseQty(list, base), e = effort(q), u = calcKit(list).tot.used;
    return { name, desc, how, focus, n: list.length, q, e, u };
  });
  S.cases = rows.map((r) => ({ name: r.name, n: r.n, io_std: r.q.io_std, io_safe: r.q.io_safe, fb: r.q.fb_instances, total: r.e.total }));
  $("f9MTab").innerHTML = tab(["Case", "Modules", "IO std", "IO safe", "safe share", "FB instances", "FB / module", "est. total h", "person-weeks"], rows.map((r) =>
    `<tr><td><b>${esc(r.name)}</b><br><span class="sub">${esc(r.desc)}</span></td><td class="f8-r">${r.n}</td><td class="f8-r">${r.q.io_std}</td><td class="f8-r">${r.q.io_safe}</td><td class="f8-r">${fx(r.q.io_safe / Math.max(1, r.q.io_std + r.q.io_safe) * 100, 0)} %</td><td class="f8-r">${r.q.fb_instances}</td><td class="f8-r">${fx(r.q.fb_instances / r.n, 1)}</td><td class="f8-r">${fx(r.e.total, 1)}</td><td class="f8-r">${fx(r.e.weeks, 1)}</td></tr>`), "f8-small");
  $("f9MTxt").innerHTML = `<div class="f9-cases">${rows.map((r) => `<div class="f8-sub"><h3 class="fe-h3">${esc(r.name)}</h3><p class="f8-pt"><b>Software structure:</b> ${esc(r.how)}</p><p class="f8-pt"><b>Focus:</b> ${esc(r.focus)}</p></div>`).join("")}</div>`;
}

/* ================================================================== 9N checklists */
function html9N() {
  return card("f99N", "9N · Checklists", "software design · coding · testing · hand-over – ticks saved in this browser",
    `<div class="fe-row"><span id="f9NProg" class="f8-pt"></span><button class="mx-el" id="f9NClr">Clear ticks</button></div>
    <div class="f8-chk">${CHECKS9.map(([h, a], i) => `<div class="f8-sub"><h3 class="fe-h3">${esc(h)}</h3>${a.map((t, j) => `<label class="f8-ci"><input type="checkbox" data-c="${i}.${j}"> ${esc(t)}</label>`).join("")}</div>`).join("")}</div>` +
    useCase(`"software design" is the gate before coding starts (FDS review), "coding" is the code review before FAT, "testing" closes the FAT, "hand-over" closes
      the SAT. Both owner and integrator sign each list.`));
}
function init9N() {
  const boxes = () => [...document.querySelectorAll("#f99N [data-c]")];
  const prog = () => { const b = boxes(); $("f9NProg").textContent = `${b.filter((x) => x.checked).length} / ${b.length} ticked`; };
  boxes().forEach((b) => { b.checked = !!S.chk[b.dataset.c]; b.addEventListener("change", () => { if (b.checked) S.chk[b.dataset.c] = 1; else delete S.chk[b.dataset.c]; store.set("chk", S.chk); prog(); }); });
  $("f9NClr").addEventListener("click", () => { S.chk = {}; store.set("chk", S.chk); boxes().forEach((b) => { b.checked = false; }); prog(); });
  prog();
}
