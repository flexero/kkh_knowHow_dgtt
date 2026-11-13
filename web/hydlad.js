/* HYDRAULICS tab – item 4 (#hyItem4): PLC ladder programs of the hydraulic power unit and its circuits,
 * Delta (AS332T-A, ISPSoft) and Siemens (S7-1200 CPU 1215C, TIA Portal) side by side, live simulation with a plant model.
 * Three selectable programs (data files): hydlad_p1.js HPU (17 networks) · hydlad_p2.js clamp-then-work (15) · hydlad_p3.js
 * vertical axis lock + counterbalance + valve test (14). Shared ladder core: ladder.js (builder A). Guide: docs/37.
 * Lazy: built on window event "hyitemshow" detail "4" (hyd.js) or at load when hyCtl.current() === "4".
 * URL: &hlprog=hpu|seq|lock (start program) · &ladview=delta|siemens|both · &ldCtab=draw|buy|shop, &ldCq=, &ldCbox=N, &ldCscroll (card)
 *      &ladCtest → headless self-test of all three programs, console lines "LADCTEST …" + "LADCTEST DONE errors=N".
 * All addresses, times and set points are EXAMPLES – check with your PLC configuration. */
import { mountLadder, createEngine, checkProgram } from "./ladder.js";
import { makeCard } from "./robotref.js";
import * as P1 from "./hydlad_p1.js";
import * as P2 from "./hydlad_p2.js";
import * as P3 from "./hydlad_p3.js";
import { CARD } from "./hydlad_card.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const PROGS = [
  { key: "hpu", mod: P1, btn: "1 · HPU – pump, accumulator, oil care", guide: "guide 25 §14 example 2 (APC / HMC power unit)" },
  { key: "seq", mod: P2, btn: "2 · Clamp, then work (pressure switch)", guide: "guide 30 §8 circuit 4, option pressure switch" },
  { key: "lock", mod: P3, btn: "3 · Vertical axis – lock + counterbalance", guide: "guide 30 §5–6 circuits 1 + 2, APC lift 1A1" },
];

/* plant adapter: the program files use io.get / io.set, the core passes the state object */
function plantFor(mod) {
  const pl = mod.makePlant();
  const io = (st) => ({ get: (n) => st[n], set: (n, v) => { st[n] = v; } });
  return { step(st, dt) { pl.step(io(st), dt); }, reset() { pl.reset(); }, info: pl.info };
}

const CSS = `
#hyItem4 .hl-wrap { display: flex; flex-direction: column; gap: 14px; }
#hyItem4 .hl-wrap > .card { width: 100%; box-sizing: border-box; min-width: 0; }
#hyItem4 .hl-progs { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 4px; }
#hyItem4 .hl-progs button { font: inherit; font-size: 13px; padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); cursor: pointer; }
#hyItem4 .hl-progs button.on { border-color: var(--accent); color: var(--accent); font-weight: 600; box-shadow: inset 0 -2px 0 var(--accent); }
#hyItem4 .hl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; font-size: 13px; line-height: 1.45; }
#hyItem4 .hl-grid > div { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--surface); }
#hyItem4 .hl-grid h3, #hyItem4 .hl-notes h3 { margin: 0 0 4px; font-size: 13.5px; }
#hyItem4 .hl-safe { border-left: 3px solid var(--bad-text, #b3261e); padding: 6px 10px; background: var(--surface); font-size: 13px; margin: 10px 0 0; }
#hyItem4 .hl-try { margin: 6px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.5; }
#hyItem4 .hl-plant { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin: 0 0 10px; }
#hyItem4 .hl-g { border: 1px solid var(--border); border-radius: 8px; padding: 6px 9px; background: var(--surface); font-size: 12.5px; }
#hyItem4 .hl-g b { display: block; font-size: 12px; color: var(--text-2); font-weight: 600; margin: 0 0 3px; }
#hyItem4 .hl-g .v { font: 600 17px/1.2 ui-monospace, Consolas, monospace; color: var(--text); }
#hyItem4 .hl-bar { position: relative; height: 10px; border-radius: 5px; background: var(--surface-2); border: 1px solid var(--border); margin: 5px 0 2px; overflow: hidden; }
#hyItem4 .hl-bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); }
#hyItem4 .hl-bar s { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--text-2); text-decoration: none; }
#hyItem4 .hl-g small { display: block; color: var(--text-2); }
#hyItem4 .hl-on { color: var(--good-text); font-weight: 600; }
#hyItem4 .hl-bad { color: var(--bad-text, #b3261e); font-weight: 600; }
#hyItem4 .hl-notes { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; font-size: 13px; line-height: 1.5; }
#hyItem4 .hl-notes > div { min-width: 0; }
#hyItem4 .hl-notes table { width: 100%; min-width: 0; table-layout: fixed; border-collapse: collapse; font-size: 12.5px; }
#hyItem4 .hl-notes td, #hyItem4 .hl-notes th { border: 1px solid var(--border); padding: 3px 6px; text-align: left; vertical-align: top; overflow-wrap: anywhere; white-space: normal; }
#hyItem4 .hl-notes td:first-child, #hyItem4 .hl-notes th:first-child { width: 36%; }
#hyItem4 .hl-notes code, #hyItem4 .hl-mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
#hyItem4 .hl-warn { font-size: 12px; color: var(--text-2); margin: 6px 0 0; }
`;

let built = false, ctl = null, cur = null, plant = null, lastPaint = 0;

function headerHtml() {
  return `
  <div class="card">
    <div class="card-head"><h2>PLC ladder programs – hydraulic power unit + circuits</h2>
      <span class="sub">Delta AS332T-A (ISPSoft) and Siemens S7-1200 CPU 1215C (TIA Portal) side by side · live simulation · all values are examples</span></div>
    <div class="hl-grid">
      <div><h3>What you see</h3>The control program of a hydraulic power unit (HPU) and two typical circuits, written in <b>ladder diagram (LAD)</b>,
        IEC 61131-3. Each network is drawn twice: left the <b>Delta</b> version (addresses X0.0, Y0.0, M0, T0 – ISPSoft), right the
        <b>Siemens</b> version (%I0.0, %Q0.0, %M10.0, IEC timers in instance DBs – TIA Portal). Use the Delta / Siemens / Both switch.</div>
      <div><h3>How to read LAD</h3>Power flows from the left rail to the right. <span class="hl-mono">–| |–</span> NO contact = TRUE when the bit is 1,
        <span class="hl-mono">–|/|–</span> NC contact = TRUE when the bit is 0, <span class="hl-mono">P</span> / <span class="hl-mono">N</span> = rising / falling edge (one scan),
        boxes = timers (TON, TOF), counters (CTU), compare (≥, &lt;), CALCULATE. Coils <span class="hl-mono">( )</span> write the bit, <span class="hl-mono">(S)</span> / <span class="hl-mono">(R)</span> set / reset it.
        <b>Green = energised</b>. Series = AND, parallel = OR. The PLC runs all networks from top to bottom every scan (20 ms here).</div>
      <div><h3>How to use it</h3>Choose a program below. It starts running. Click the push buttons and switches in the left panel; sensors are moved by the
        <b>plant model</b> (pump, accumulator with gas law, oil temperature, cylinders) – click a sensor to <b>force</b> it (marker F) and simulate a fault.
        The I/O table, the Delta instruction list and the Siemens SCL text are under the networks. Guide: <code>docs/37_plc_ladder_hydraulics.md</code>.</div>
    </div>
    <p class="hl-safe"><b>Safety rule:</b> the standard ladder program never does the safety function itself (e-stop, guard locking, safe holding of a vertical axis).
      That is the job of the hard-wired <b>safety relay</b> (e.g. Pilz PNOZ s4) or the <b>F-program</b> of a fail-safe CPU (S7-1200 F / 1215FC) –
      ISO 13849-1, IEC 62061, IEC 60204-1 §9.4. Here the PLC only reads the status of the safety relay (ESTOP_OK, GUARD).</p>
    <div class="hl-progs" role="tablist">${PROGS.map((p) => `<button type="button" data-prog="${p.key}" role="tab">${esc(p.btn)}</button>`).join("")}</div>
    <div id="hlInfo"></div>
  </div>`;
}

function notesHtml() {
  return `
  <div class="card">
    <div class="card-head"><h2>Program structure – Siemens and Delta notes</h2><span class="sub">how the same program is organised in TIA Portal and ISPSoft · example</span></div>
    <div class="hl-notes">
      <div><h3>Siemens S7-1200 (TIA Portal V19)</h3>
        <table><tr><th>Block</th><th>Use here</th></tr>
        <tr><td>OB1 Main (cyclic)</td><td>calls FB "Hpu" (program 1) and FB "Clamp" / FB "Lift" with their instance DBs</td></tr>
        <tr><td>OB30–38 Cyclic interrupt (OB35 in S7-300 terms)</td><td>100 ms: analog scaling + run-hour counter (constant time base)</td></tr>
        <tr><td>OB100 Startup</td><td>reset step chain, alarms stay latched (retentive), set default set points</td></tr>
        <tr><td>OB82 / OB83 / OB86</td><td>diagnostic / pull-plug / rack failure – without them the CPU may go to STOP on a module fault (S7-1200: alarms in the diagnostic buffer)</td></tr>
        <tr><td>FB "Hpu" + DB "Hpu_DB"</td><td>pump, accumulator, oil care; static: P_Sys, alarms; IEC timers as multi-instances</td></tr>
        <tr><td>FC "Scale"</td><td>NORM_X + SCALE_X (raw 0…27648 → 0…16 MPa), wire break &gt; 32511</td></tr>
        <tr><td>DB "Hpu_Par" (retain)</td><td>cut-in 10.8, cut-out 11.5, start 10.7, alarm 10.0 MPa, RUN_S</td></tr></table>
        <p>Enable the <b>system and clock memory</b> bytes in the CPU properties (MB1: FirstScan %M1.0, AlwaysTRUE %M1.2; MB0: Clock_1Hz %M0.5).
        Bit addresses are byte.bit with bit 0–7 only: after %I0.7 comes %I1.0. Every IEC timer / edge needs its own instance / memory bit.</p></div>
      <div><h3>Delta AS300 (ISPSoft 3.x)</h3>
        <table><tr><th>Item</th><th>Use here</th></tr>
        <tr><td>Cyclic task (main POU)</td><td>the networks in this order; one POU per program (HPU, Clamp, Lift)</td></tr>
        <tr><td>Timed interrupt I-task</td><td>100 ms task for scaling / hour counter (like OB3x)</td></tr>
        <tr><td>HWCONFIG</td><td>AS04AD-A range 4–20 mA → 0…32000, input filter 10 ms, D register mapping (D100 …)</td></tr>
        <tr><td>Latched devices</td><td>RUN_S (D210, 32 bit) and alarm bits in the latched range – set in HWCONFIG</td></tr>
        <tr><td>System bits</td><td>SM400 always ON, SM402 first scan (DVP: M1000 / M1002 / M1013 1 s clock)</td></tr>
        <tr><td>Timers</td><td>TMR T0 K50 = 5.0 s (100 ms base), TMRH for 10 ms resolution</td></tr></table>
        <p>AS series bits are word.bit with bit 0–15 (X0.0 … X0.15). The small DVP-ES2/ES3 use <b>octal</b> X0…X7, X10…X17 – there is no X8 or X9.
        AS332<b>T</b>-A outputs are NPN (sink); for PNP (Europe) take AS332<b>P</b>-A or interface relays.</p></div>
    </div>
  </div>`;
}

function infoHtml(p) {
  const m = p.mod, pr = m.PROGRAM;
  const w = checkProgram(pr);
  return `<p style="margin:6px 0 0;font-size:13px"><b>${esc(pr.title)}</b> – ${pr.networks.length} networks, ${pr.tags.filter((t) => /^(I|AI)$/.test(t.dir)).length} inputs,
    ${pr.tags.filter((t) => t.dir === "Q").length} outputs · basis: ${esc(p.guide)} · Delta ${esc(pr.plc.delta.cpu)} · Siemens ${esc(pr.plc.siemens.cpu)}</p>
    <b style="font-size:13px">What to try</b><ol class="hl-try">${m.TRY.map((t) => `<li>${t}</li>`).join("")}</ol>
    ${w.length ? `<p class="hl-warn">Program check: ${w.map(esc).join(" · ")}</p>` : ""}`;
}

/* small live "plant" panel above the ladder */
const bar = (v, lo, hi, marks = []) => `<div class="hl-bar"><i style="width:${Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)).toFixed(1)}%"></i>${marks.map((m) => `<s style="left:${((m - lo) / (hi - lo) * 100).toFixed(1)}%"></s>`).join("")}</div>`;
const onoff = (b, t1, t0 = "off") => `<span class="${b ? "hl-on" : ""}">${b ? t1 : t0}</span>`;
function plantHtml(st) {
  if (!cur || !plant) return "";
  const k = cur.key;
  if (k === "hpu") {
    const i = plant.info(), p = st.P_SYS || 0;
    const mode = st.KM2_FB ? "delta" : st.KM3_FB ? "star" : "stopped";
    return `<div class="hl-g"><b>0B2 system pressure</b><span class="v">${p.toFixed(2)} MPa</span>${bar(p, 0, 16, [10.0, 10.7, 10.8, 11.5, 13])}<small>marks 10.0 · 10.7 · 10.8 · 11.5 · relief 13</small></div>
      <div class="hl-g"><b>Accumulator 4 L (p0 8.99 MPa)</b><span class="v">${(i.Vacc * 1000).toFixed(0)} cm³ oil</span>${bar(i.Vacc, 0, 0.8)}<small>gas law p·V^1.4 = const · 0V5 ${onoff(st.Y_0V5, "loading", "unloaded")}</small></div>
      <div class="hl-g"><b>Pump motor 0M1</b><span class="v">${i.rpm.toFixed(0)} rpm</span>${bar(i.rpm, 0, 1500)}<small>${mode} · KM1 ${onoff(st.KM1, "on")} KM3 ${onoff(st.KM3, "on")} KM2 ${onoff(st.KM2, "on")}</small></div>
      <div class="hl-g"><b>0B3 oil temperature</b><span class="v">${(+st.T_OIL).toFixed(1)} °C</span>${bar(st.T_OIL, 0, 80, [20, 50, 55, 65])}<small>heater ${onoff(st.HEATER, "on")} · cooler ${onoff(st.COOLER, "on")} · shown 3 × faster</small></div>
      <div class="hl-g"><b>Status</b><span class="v ${st.M_TRIP ? "hl-bad" : st.M_RDY ? "hl-on" : ""}">${st.M_TRIP ? "TRIP" : st.M_RDY ? "READY" : st.M_PUMP ? "charging / waiting" : "stopped"}</span><small>run ${(+st.RUN_H).toFixed(3)} h · starts ${st.C_STARTS ? st.C_STARTS.CV : 0}</small></div>`;
  }
  if (k === "seq") {
    const i = plant.info();
    const step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5"].find((s) => st[s]) || "–";
    return `<div class="hl-g"><b>Clamp 1A1 Ø40/22</b><span class="v">${(i.x1 * 100).toFixed(0)} %</span>${bar(i.x1, 0, 1)}<small>1Y1 ${onoff(st.Y1_CLP, "clamp")} · 1Y2 ${onoff(st.Y2_UNC, "unclamp")}</small></div>
      <div class="hl-g"><b>1B3 clamp pressure (1V2 = 5 MPa)</b><span class="v">${i.p.toFixed(2)} MPa</span>${bar(i.p, 0, 10, [4.0, 4.5, 5.5])}<small>1S1 ${onoff(st.S1_CLP, "ON ≥ 4.5")} (off &lt; 4.0)</small></div>
      <div class="hl-g"><b>Work cylinder 2A1 Ø63/36</b><span class="v">${(i.x2 * 200).toFixed(0)} mm</span>${bar(i.x2, 0, 1)}<small>2Y1 ${onoff(st.Y3_EXT, "extend")} · 2Y2 ${onoff(st.Y4_RET, "retract")}</small></div>
      <div class="hl-g"><b>Step chain</b><span class="v ${st.M_FLT ? "hl-bad" : ""}">${step}${st.M_FLT ? " · FAULT" : ""}</span><small>parts ${st.C_PARTS ? st.C_PARTS.CV : 0} · CNC clamp OK ${onoff(st.CLP_OK, "yes", "no")}</small></div>`;
  }
  const i = plant.info();
  return `<div class="hl-g"><b>Lift 1A1 Ø50/28, stroke 60 mm</b><span class="v">${i.x.toFixed(1)} mm</span>${bar(i.x, 0, 60)}<small>1Y1 ${onoff(st.Y1_UP, "up")} · 1Y2 ${onoff(st.Y2_DN, "down")}</small></div>
    <div class="hl-g"><b>1B3 cap-side pressure</b><span class="v">${i.p.toFixed(2)} MPa</span>${bar(i.p, 0, 16, [1.0, 7.39, 8.5, 9.6])}<small>holding 7.39 · CBV ≈ 9.6 MPa</small></div>
    <div class="hl-g"><b>Lock valve 1V4 (1Y3)</b><span class="v">${st.S3_OPEN ? "open" : "closed"}</span><small>1Y3 ${onoff(st.Y3_LOCK, "energised")} · 1S3 ${onoff(st.S3_OPEN, "open", "closed")}</small></div>
    <div class="hl-g"><b>Status</b><span class="v ${st.M_FLT ? "hl-bad" : ""}">${st.M_FLT ? "FAULT" : st.S_TEST ? "TEST MODE" : st.B2_UP ? "at top" : st.B1_DOWN ? "at bottom" : "between"}</span><small>cycles ${st.C_CYC ? st.C_CYC.CV : 0}</small></div>`;
}

function mountProg(key) {
  const p = PROGS.find((x) => x.key === key) || PROGS[0];
  cur = p;
  document.querySelectorAll("#hyItem4 [data-prog]").forEach((b) => b.classList.toggle("on", b.dataset.prog === p.key));
  $("hlInfo").innerHTML = infoHtml(p);
  if (ctl) { try { ctl.destroy(); } catch (e) { /* ignore */ } ctl = null; }
  const host = $("hlLadHost");
  host.innerHTML = "";
  const div = document.createElement("div");
  host.appendChild(div);
  plant = plantFor(p.mod);
  const pv = $("hlPlant");
  ctl = mountLadder(div, p.mod.PROGRAM, {
    plant, height: 900,
    onScan: (st) => { const now = performance.now(); if (now - lastPaint > 150) { lastPaint = now; pv.innerHTML = plantHtml(st); } },
    onReset: (E) => { pv.innerHTML = plantHtml(E.state); },
  });
  pv.innerHTML = plantHtml(ctl.state);
  window.hlCtl = { ctl, prog: p.key, select: mountProg };
}

function build() {
  if (built) return;
  const box = $("hyItem4");
  if (!box) return;
  built = true;
  if (!$("hlStyle")) { const s = document.createElement("style"); s.id = "hlStyle"; s.textContent = CSS; document.head.appendChild(s); }
  box.innerHTML = `<div class="hl-wrap">${headerHtml()}
    <div class="card"><div class="card-head"><h2>Live ladder – Delta + Siemens</h2><span class="sub">plant model above, networks below · Run / Stop / 1 scan / Reset · example</span></div>
      <div class="hl-plant" id="hlPlant"></div><div id="hlLadHost"></div></div>
    ${notesHtml()}</div>`;
  box.querySelectorAll("[data-prog]").forEach((b) => b.addEventListener("click", () => mountProg(b.dataset.prog)));
  mountProg(Q.get("hlprog") || "hpu");
  try { makeCard(CARD, box.querySelector(".hl-wrap"), { card: "ldCardC", q: "ldCq", g: "ldCg", cnt: "ldCcnt", buy: "ldCbuy" }, "ldC"); } catch (e) { console.error(e); }
}

window.addEventListener("hyitemshow", (e) => { if (String(e.detail) === "4") build(); });
if (window.hyCtl && window.hyCtl.current() === "4") build();

/* ============================================================== &ladCtest – headless checks of all three programs */
function selfTestC(log = (s) => console.log(s)) {
  let bad = 0;
  const ok = (c, m) => { if (!c) bad++; log(`LADCTEST ${c ? "ok  " : "FAIL"} ${m}`); };
  const mk = (mod) => { const pl = plantFor(mod); const E = createEngine(mod.PROGRAM, { plant: pl }); return { E, pl }; };
  const until = (E, f, max) => { const t0 = E.time; while (!f() && E.time - t0 < max) E.scan(); return f() ? E.time - t0 : NaN; };
  const f2 = (x) => (Number.isNaN(x) ? "never" : x.toFixed(2) + " s");
  for (const p of PROGS) { const w = checkProgram(p.mod.PROGRAM); ok(w.length === 0, `${p.key}: program check ${w.length ? w.join(" | ") : "no warnings"} (${p.mod.PROGRAM.networks.length} networks)`); }

  /* ---- program 1 HPU */
  {
    const { E, pl } = mk(P1);
    let both = 0; E.onScan = (st) => { if (st.KM2 && st.KM3) both++; };
    E.run(0.2);
    E.set("S_START", true); E.scan(); const tS = E.time; E.run(0.2); E.set("S_START", false);
    const tK1 = E.bit("KM1") && E.bit("KM3") ? 0 : NaN;
    const tStarOff = until(E, () => !E.bit("KM3"), 10) + 0.2 + E.dt;
    const tDelta = until(E, () => E.bit("KM2"), 2) + tStarOff;
    ok(tK1 === 0 && Math.abs(tStarOff - 5.0) < 0.2 && tDelta > tStarOff + 0.09, `start → KM1 + KM3 (star) after 0 ms, star off after ${tStarOff.toFixed(2)} s (T_YD 5.0 s from KM1_FB + 30 ms), delta KM2 after ${tDelta.toFixed(2)} s (gap 0.1 s after KM3_FB off)`);
    const tLoad = until(E, () => E.bit("Y_0V5"), 2);
    ok(!Number.isNaN(tLoad), `0V5 loads ${f2(tLoad)} after KM2 (only with KM1_FB · KM2_FB · NOT KM3_FB)`);
    const tFull = until(E, () => E.num("P_SYS") >= 11.45, 20);
    ok(tFull > 5 && tFull < 10, `0 → 11.5 MPa in ${f2(tFull)} (4 L accumulator, p0 8.99 MPa, 5.39 L/min, gas law n = 1.4; hand: 0.64 L / 5.2 L/min ≈ 7.4 s)`);
    const tUnl = until(E, () => !E.bit("Y_0V5"), 2);
    ok(!Number.isNaN(tUnl) && E.num("P_SYS") >= 11.4, `cut-out: 0V5 opens at ${E.num("P_SYS").toFixed(2)} MPa`);
    const Tready = until(E, () => E.bit("M_RDY"), 60);
    ok(!Number.isNaN(Tready) && E.num("T_OIL") >= 20, `ready after the oil reached ${E.num("T_OIL").toFixed(1)} °C (heater on < 20 °C, simulated 3 × faster) – waited ${f2(Tready)}`);
    const tHold = until(E, () => E.bit("Y_0V5"), 120);
    const pIn = E.num("P_SYS");
    const tChg = until(E, () => !E.bit("Y_0V5"), 10);
    ok(tHold > 40 && tHold < 90 && pIn <= 10.81 && tChg > 1 && tChg < 3, `hysteresis: hold ${f2(tHold)} (leak 0.15 L/min, hand ≈ 61 s), cut-in at ${pIn.toFixed(2)} MPa, charge ${f2(tChg)} (hand 0.15 L / 5.2 L/min ≈ 1.8 s)`);
    E.run(5); const pStart = E.num("P_SYS");
    E.set("CNC_MOVE", true); let pMin = 99; for (let i = 0; i < 80; i++) { E.scan(); pMin = Math.min(pMin, E.num("P_SYS")); } E.set("CNC_MOVE", false); E.scan(); E.scan();
    ok(E.bit("Y_0V5") && pMin > 10.0, `movement 6 L/min × 1.6 s from ${pStart.toFixed(2)} MPa: minimum ${pMin.toFixed(2)} MPa (≥ 10.0), falling edge of CNC_MOVE → 0V5 recharges`);
    E.run(3);
    E.set("T_OIL", 52); E.scan(); ok(E.bit("COOLER"), "oil 52 °C → cooler ON (> 50 °C)");
    E.force("T_OIL", 66); const tTrip = until(E, () => E.bit("AL_TEMP"), 5); E.run(0.1); E.force("T_OIL", null);
    ok(Math.abs(tTrip - 2.0) < 0.1 && !E.bit("KM1"), `oil 66 °C (forced) → trip after ${f2(tTrip)} (T_TEMP 2 s), KM1 off`);
    E.set("T_OIL", 40); E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan(); ok(!E.bit("AL_TEMP") && !E.bit("M_TRIP"), "ack with oil 40 °C → alarm reset");
    E.set("S_START", true); E.run(0.1); E.set("S_START", false); E.run(6); E.run(8);
    E.set("LVL_OK", false); const tLvl = until(E, () => E.bit("AL_LVL"), 5); E.run(0.1);
    ok(Math.abs(tLvl - 2.0) < 0.1 && !E.bit("KM1") && !E.bit("HEATER"), `level low → stop after ${f2(tLvl)} (debounce 2 s), heater blocked`);
    E.set("LVL_OK", true); E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan();
    E.set("S_START", true); E.run(0.1); E.set("S_START", false); E.run(7);
    E.force("KM2_FB", false); const tFb = until(E, () => E.bit("AL_FB"), 3); E.force("KM2_FB", null); E.run(0.2);
    ok(Math.abs(tFb - 0.5) < 0.1 && !E.bit("KM1"), `KM2 feedback missing → AL_FB after ${f2(tFb)} (T_FB 0.5 s), pump stops`);
    E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan();
    E.set("S_START", true); E.run(0.1); E.set("S_START", false); E.run(7);
    E.set("T_OIL", 35); E.set("FILT_OK", false); E.scan(); const w = E.bit("W_FILT");
    const tF = until(E, () => E.bit("AL_FILT"), 70);
    ok(w && Math.abs(tF - 60) < 0.2, `filter clogged at 35 °C → warning at once, stop after ${f2(tF)} (T_FILT 60 s)`);
    E.set("FILT_OK", true); E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan();
    E.set("T_OIL", 25); E.set("FILT_OK", false); E.run(1); ok(!E.bit("W_FILT"), "filter switch ignored with cold oil 25 °C (< 30 °C)"); E.set("FILT_OK", true);
    ok(both === 0, `KM2 and KM3 never ON in the same scan (${E.scans} scans checked)`);
    E.reset(); E.set("S_START", true); E.run(0.1); E.set("S_START", false); E.set("T_OIL", 30);
    const h0 = E.num("RUN_S"); E.run(5.5 + 10); const dS = E.num("RUN_S") - h0;
    ok(Math.abs(dS - 10) <= 1, `run-hour counter: +${dS} s in 10 s of pump run (1 Hz clock edge, exact ± 1)`);
    const tServ = until(E, () => E.bit("W_SERV"), 80);
    ok(!Number.isNaN(tServ), `service warning at ${E.num("RUN_H").toFixed(3)} h (≥ 2000 h)`);
    E.reset(); E.scan(); ok(E.num("P_SYS") === 0 && !E.bit("KM1"), "reset → pressure 0, pump off"); void pl; void tS;
  }

  /* ---- program 2 clamp then work */
  {
    const { E } = mk(P2);
    let il = 0; E.onScan = (st) => { if ((st.Y1_CLP && st.Y2_UNC) || (st.Y3_EXT && st.Y4_RET) || (st.Y3_EXT && !st.S1_CLP)) il++; };
    E.run(0.1);
    E.set("S_CYC", true); E.scan(); E.set("S_CYC", false);
    const t1 = until(E, () => E.bit("ST2"), 3), t2 = until(E, () => E.bit("ST3"), 3), t3 = until(E, () => E.bit("ST4"), 3), t4 = until(E, () => E.bit("ST5"), 3), t5 = until(E, () => E.bit("ST0"), 3);
    ok([t1, t2, t3, t4, t5].every((x) => !Number.isNaN(x)) && E.state.C_PARTS.CV === 1,
      `cycle: clamp → 1S1 + 0.3 s ${f2(t1)} · extend ${f2(t2)} · dwell ${f2(t3)} · retract ${f2(t4)} · unclamp ${f2(t5)} · total ${(t1 + t2 + t3 + t4 + t5).toFixed(2)} s · parts = ${E.state.C_PARTS.CV}`);
    E.run(0.5);
    E.set("S_CYC", true); E.scan(); E.set("S_CYC", false);
    until(E, () => E.bit("ST3"), 5);
    E.force("S1_CLP", false); const tL = until(E, () => E.bit("AL_CLP"), 1); E.scan();
    ok(Math.abs(tL - 0.1) < 0.05 && E.bit("ST4") && E.bit("Y4_RET") && E.bit("Y1_CLP"), `clamp pressure lost in step 3 → AL_CLP after ${f2(tL)}, step 4 retract, clamp valve stays ON`);
    E.force("S1_CLP", null); until(E, () => E.bit("ST0"), 5);
    E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.run(0.3);
    E.set("PART", false); E.set("S_CYC", true); E.scan(); E.set("S_CYC", false); E.run(0.5);
    ok(E.bit("ST0") && !E.bit("Y1_CLP"), "no part → cycle does not start");
    E.set("PART", true); E.set("HPU_RDY", true);
    E.set("S_CYC", true); E.scan(); E.set("S_CYC", false); E.set("HPU_RDY", false);
    const tTo = until(E, () => E.bit("AL_TO"), 4);
    ok(Math.abs(tTo - 2.0) < 0.1, `no hydraulics in step 1 → time-out alarm after ${f2(tTo)} (T_TO1 2 s)`);
    E.set("HPU_RDY", true); E.set("S_AUTO", false); E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan();
    ok(E.bit("ST0") && !E.bit("M_FLT"), "manual + ack → step chain reset to step 0, alarm reset");
    ok(il === 0, `interlocks: 1Y1/1Y2 never together, 2Y1/2Y2 never together, 2Y1 never without 1S1 (${E.scans} scans)`);
  }

  /* ---- program 3 lock + counterbalance */
  {
    const { E } = mk(P3);
    let il = 0; E.onScan = (st) => { if (st.Y1_UP && st.Y2_DN) il++; if (st.Y2_DN && !st.S3_OPEN && !st.S_TEST) il++; };
    E.set("S_AUTO", true); E.run(0.1);
    E.set("S_UP", true); E.scan(); const y3 = E.bit("Y3_LOCK"), y1a = E.bit("Y1_UP"); E.run(0.2); E.set("S_UP", false);
    const tTop = until(E, () => E.bit("B2_UP"), 3) + 0.2 + E.dt;
    const tLc = until(E, () => !E.bit("Y3_LOCK"), 2);
    ok(y3 && !y1a && tTop > 0.8 && tTop < 1.0 && Math.abs(tLc - 0.3) < 0.05, `UP: 1Y3 first (1Y1 waits for 1S3), top 60 mm after ${f2(tTop)} (hand 40 ms + 0.8 s), lock closes ${f2(tLc)} after the stop (TOF 0.3 s)`);
    E.run(1.5); ok(!E.bit("AL_DRIFT") && !E.bit("AL_PCAP") && Math.abs(E.num("P_CAP") - 7.39) < 0.05, `holding at the top: cap pressure ${E.num("P_CAP").toFixed(2)} MPa, no drift alarm`);
    E.set("S_DOWN", true); E.scan(); E.set("S_DOWN", false);
    const tY2 = until(E, () => E.bit("Y2_DN"), 1) + E.dt;
    const tBot = until(E, () => E.bit("B1_DOWN"), 3) + tY2;
    ok(Math.abs(tY2 - 0.26) < 0.05 && tBot > 1.0 && tBot < 1.2, `DOWN: 1Y2 ${f2(tY2)} after the push (1S3 40 ms + T_LOPEN 0.2 s), bottom after ${f2(tBot)}`);
    E.run(1);
    E.force("S3_OPEN", false); E.set("S_UP", true); E.scan(); E.set("S_UP", false);
    const tLk = until(E, () => E.bit("AL_LOCK"), 2); const moved = !E.bit("B1_DOWN");
    ok(Math.abs(tLk - 0.5) < 0.1 && !moved, `lock feedback missing → AL_LOCK after ${f2(tLk)}, lift did not move`);
    E.force("S3_OPEN", null); E.run(0.5); E.set("S_ACK", true); E.scan(); E.set("S_ACK", false); E.scan();
    E.set("S_UP", true); E.scan(); E.set("S_UP", false); until(E, () => E.bit("B2_UP"), 3); E.run(1);
    E.force("B2_UP", false); const tD = until(E, () => E.bit("AL_DRIFT"), 3);
    ok(Math.abs(tD - 1.0) < 0.1, `drift at the top (1B2 lost, valves off) → AL_DRIFT after ${f2(tD)}`);
    E.force("B2_UP", null);
    E.reset(); E.set("HPU_RDY", false); E.set("S_TEST", true); E.run(0.1);
    E.set("S_UP", true); E.scan(); E.set("S_UP", false);
    const a = until(E, () => E.bit("Y2_DN"), 3), b = until(E, () => E.bit("Y3_LOCK") && !E.bit("Y2_DN"), 3), c = until(E, () => !E.bit("Y3_LOCK"), 3);
    ok(Math.abs(a - 2.0) < 0.1 && Math.abs(b - 2.0) < 0.1 && Math.abs(c - 2.3) < 0.1 && E.bit("B1_DOWN") && !E.bit("AL_LOCK"), `valve test: 1Y1 ${f2(a)} → 1Y2 ${f2(b)} → 1Y3 ${f2(c)} (2 s + TOF 0.3 s), no movement, lock feedback OK`);
    ok(il === 0, `1Y1 and 1Y2 never together, 1Y2 never with the lock closed outside the valve test (${E.scans} scans)`);
  }

  /* ---- page */
  const box = $("hyItem4");
  ok(!!(box && box.querySelector(".ld-net")) && box.querySelectorAll(".ld-net").length === P1.PROGRAM.networks.length, `page: item 4 shows ${box ? box.querySelectorAll(".ld-net").length : 0} networks of program 1`);
  ok(!!$("ldCardC") && $("ldCardC").querySelectorAll(".rr-fig img").length === CARD.drawings.length, `page: card #ldCardC with ${$("ldCardC") ? $("ldCardC").querySelectorAll(".rr-fig img").length : 0} drawings, ${$("ldCardC") ? $("ldCardC").querySelectorAll('[data-rrp="buy"] tbody tr').length : 0} buy rows`);
  log(`LADCTEST DONE errors=${bad}`);
  return bad;
}
if (Q.has("ladCtest")) {
  setTimeout(() => {
    try {
      if (!built && window.hyCtl) window.hyCtl.showItem("4");
      build();
      setTimeout(() => { try { selfTestC(); } catch (e) { console.error("LADCTEST exception " + e.message + " " + e.stack); } }, 600);
    } catch (e) { console.error("LADCTEST exception " + e.message); }
  }, +Q.get("ladCtest") || 1500);
}
