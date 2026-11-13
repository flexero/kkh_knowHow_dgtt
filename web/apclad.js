/* APC tab – card "PLC ladder program – Delta + Siemens side by side" (#apcLadder inside #apcLadderCard).
 * The step chain of the APC page (#apcSeq: M60 → door open → unclamp → lift → rotate 180° → lower → clamp → seating → door close → FIN)
 * as 18 LAD networks for a Delta AS332T-A (ISPSoft) and a Siemens S7-1200 CPU 1215C (TIA Portal), live, with a plant model.
 * Files: apclad_prog.js (program data + plant model), apclad_data.js (catalogue card), shared core ladder.js (builder A).
 * Lazy: built the first time the APC tab is shown (chains window.onTabShown like apc.js) or at load if #tab-apc is active.
 * Guide: docs/36_plc_ladder_apc.md. Test: ?ladBtest#apc → console "LADBTEST …" (headless engine, hand-checkable numbers).
 * All addresses and values are EXAMPLES – check with your PLC configuration. Safety stays in the safety relay / F-program. */
import { mountLadder, createEngine, checkProgram } from "./ladder.js";
import { PROGRAM, STEPS, PLANT_TIMES, makePlant } from "./apclad_prog.js";
import { CARD } from "./apclad_data.js";
import { makeCard } from "./robotref.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const pane = $("tab-apc");
let built = false, ctl = null, plant = null;
const f1 = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");

const CSS = `
#apcLadder .al-head { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin: 0 0 12px; }
#apcLadder .al-box { border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; background: var(--surface); font-size: 12.5px; line-height: 1.45; color: var(--text); }
#apcLadder .al-box b { color: var(--text); }
#apcLadder .al-box.al-safe { border-left: 3px solid var(--bad-text, #c62828); }
#apcLadder .al-stat { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
#apcLadder .al-k { border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; background: var(--surface); color: var(--text-2); }
#apcLadder .al-k b { color: var(--text); font-variant-numeric: tabular-nums; }
#apcLadder .al-k.al-bad { border-color: var(--bad-text, #c62828); color: var(--bad-text, #c62828); }
#apcLadder .al-k.al-good b { color: var(--good-text); }
#apcLadder .al-faults { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 10px; font-size: 12.5px; color: var(--text-2); }
#apcLadder .al-faults button { font: inherit; font-size: 12.5px; padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; }
#apcLadder .al-faults button.on { border-color: var(--bad-text, #c62828); color: var(--bad-text, #c62828); font-weight: 600; }
#apcLadder details.al-det { margin: 10px 0 0; border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; background: var(--surface); }
#apcLadder details.al-det summary { cursor: pointer; font-weight: 600; font-size: 13px; color: var(--text); }
#apcLadder details.al-det pre { font-size: 12px; overflow: auto; max-height: 420px; margin: 8px 0 0; color: var(--text); }
#apcLadder .al-tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 8px 0 0; }
#apcLadder .al-tbl th, #apcLadder .al-tbl td { border: 1px solid var(--border); padding: 4px 6px; text-align: left; vertical-align: top; color: var(--text); }
#apcLadder .al-tbl th { background: var(--surface-2, var(--surface)); }
`;

/* ---------------------------------------------------------------- static texts */
const HEAD = `
<div class="al-head">
  <div class="al-box"><b>Which PLC?</b> The same program twice: <b>Delta AS332T-A</b> (AS300 series, ISPSoft 3.x, I/O AS16AM10N-A / AS16AN01T-A / AS04AD-A)
    and <b>Siemens S7-1200 CPU 1215C DC/DC/DC</b> (TIA Portal V19, SM 1221 / SM 1222 / SM 1231, addresses of the I/O list above: %I20.0 …).
    Small option: Delta DVP-ES3 with octal addresses X0 – X17.</div>
  <div class="al-box"><b>How to read LAD:</b> power flows from the left rail through closed contacts to the coils on the right.
    –| |– = TRUE when the signal is 1, –|/|– = TRUE when it is 0, –( )– = output, (S) / (R) = latch / unlatch, TON = on-delay timer, CMP = compare.
    <b>Green</b> = energised path / TRUE. The switch <b>Delta / Siemens / Both</b> shows the addresses of one PLC or both side by side.</div>
  <div class="al-box"><b>Try it:</b> Run → press <b>OperatorReady</b> → switch <b>NC_M60</b> on. The steps S1 … S9 run with the times of the page
    (1.5 + 0.8 + 0.8 + 2.5 + 0.8 + 0.8 + 0.4 + 1.2 = 8.8 s); the simulated NC drops M60 after FIN. Then try the fault buttons, <b>S_Ack</b>, the AccuPressure slider
    (drag = force, double-click = release).</div>
  <div class="al-box al-safe"><b>Safety rule:</b> the standard ladder program never does the safety function itself (e-stop, guard locking, light curtain, STO, safe speed).
    That is the safety relay or the F-program (ISO 13849-1, IEC 62061, IEC 60204-1 §9.4). The program only reads the status (SafetyOK, door, curtain) and holds the chain.</div>
</div>`;

const NOTES = `
<details class="al-det"><summary>Siemens notes – DB structure, FB / FC split, OB1 / OB100 / OB35 (TIA Portal V19)</summary>
<table class="al-tbl"><thead><tr><th>Block</th><th>Content (example)</th></tr></thead><tbody>
<tr><td>OB1 "Main"</td><td>calls "FB_Apc" (instance "IDB_Apc") every cycle; the HPU part can be its own FB "FB_Hpu" (guide 37)</td></tr>
<tr><td>OB100 "Startup"</td><td>"DB_Apc".S0 := TRUE; all other step bits FALSE (the program also does this itself: Network 8 "no step active → S0")</td></tr>
<tr><td>OB30 … OB38 (e.g. OB35, 100 ms)</td><td>not needed for the sequence; use it for a fixed-time pressure trend / logging</td></tr>
<tr><td>OB82 / OB86 / OB121</td><td>diagnostics (wire break of 0B2 4–20 mA), station failure, programming errors – keep the CPU in RUN and set an alarm</td></tr>
<tr><td>"FB_Apc" (LAD)</td><td>Networks 1 – 18 of this card; IEC timers / counters as multi-instances (#T_Wd1 : TON_TIME …)</td></tr>
<tr><td>"DB_Apc" (global, non-retain)</td><td>Auto, Manual, StepMode, TrEn, Charge, PressOK, OilWarm, FilterWarn, StnReady, StartOK, NoStartMsg, Dir180, S0 … S9, F_Wd … F_Safety, Fault, StepNo : INT, AlarmNo : INT</td></tr>
<tr><td>"DB_C_Changes", "DB_C_Faults"</td><td>CTU instances with <b>Retain</b> ticked (the service counters survive a power failure)</td></tr>
<tr><td>Analog</td><td>%IW64 → NORM_X (0 … 27 648) → SCALE_X (0 … 16 MPa) → #AccuPressure_MPa (REAL); same for %IW66 → °C</td></tr>
<tr><td>Servo</td><td>library block SINA_POS (DriveLib) with telegram 111: EnableAxis = ServoEnable, Position = 0.0 / 180.0, ExecuteMode = ServoStart, AxisPosOk → Servo_InPos, Error → Servo_Fault</td></tr>
<tr><td>Safety</td><td>external safety relay (status bits only) – or CPU 1215FC with an F-program (ESTOP1, SFDOOR, FDBACK) in its own F-runtime group; the standard FB only reads the F-status</td></tr>
</tbody></table></details>
<details class="al-det"><summary>Delta notes – ISPSoft project, special relays, timers, analog scaling</summary>
<table class="al-tbl"><thead><tr><th>Item</th><th>Delta AS300 (example – check the manual)</th></tr></thead><tbody>
<tr><td>Project</td><td>ISPSoft 3.x, HWCONFIG: AS332T-A + AS16AM10N-A (X1.x) + AS16AN01T-A (Y1.x) + AS04AD-A (ch1 → D100, ch2 → D101); one cyclic POU "APC_Main" in LD</td></tr>
<tr><td>Special relays</td><td>M1000 always ON, M1002 ON in the first scan only (start-up), M1013 1 s clock</td></tr>
<tr><td>Timers</td><td>T0 … T199 100 ms base: TMR T1 K30 = 3.0 s; the watchdogs use T1 … T8, T10 low-pressure debounce, T11 pump feedback, T12 "M60 waits"</td></tr>
<tr><td>Counters</td><td>CNT C0 K20000 (16 bit, max. 32 767), set C0 / C1 as latched in HWCONFIG</td></tr>
<tr><td>Analog</td><td>4–20 mA → 0 … 32 000 (check the range setting); MPa = raw × 16 / 32 000 (FLT + DEMUL / DEDIV or the module's scaling); compare REAL with FLD&gt;= / FLD&lt;</td></tr>
<tr><td>Servo</td><td>ASDA-B3 in PR mode: Y0.8 → SON, Y0.9 → CTRG, Y0.10 → POS0 (PR1 = 0°, PR2 = 180°); TPOS → X1.7, ALRM → X1.8</td></tr>
<tr><td>DVP option</td><td>DVP-ES2 / ES3: octal inputs X0 … X7, X10 … X17 (no X8, X9) – same tag names, new addresses</td></tr>
</tbody></table></details>`;

/* ---------------------------------------------------------------- live status strip */
const trk = { t1: null, last: null, changes: 0, pMin: null, prevS1: false, prevS9: false };
function track(st, E) {
  const s1 = !!st.S1, s9 = !!st.S9;
  if (s1 && !trk.prevS1 && trk.t1 === null) { trk.t1 = E.time; trk.pMin = st.AccuPressure; }
  if (trk.t1 !== null) trk.pMin = Math.min(trk.pMin, st.AccuPressure);
  if (s9 && !trk.prevS9 && trk.t1 !== null) { trk.last = { t: E.time - trk.t1, pMin: trk.pMin }; trk.t1 = null; trk.changes++; }
  trk.prevS1 = s1; trk.prevS9 = s9;
}
function statusHtml() {
  if (!ctl) return "";
  const st = ctl.state, sim = plant.sim;
  const step = st.StepNo, f = !!st.M_Fault;
  const k = (l, v, cls = "") => `<span class="al-k ${cls}">${l} <b>${v}</b></span>`;
  return [
    k("step", `S${step}${st.S0 ? " idle" : ""}`, st.S0 ? "" : "al-good"),
    k("door", `${Math.round(sim.door * 100)} % open`),
    k("lift", `${Math.round(sim.lift * 60)} / 60 mm`),
    k("arm", `${f1(sim.ang, 0)}°`),
    k("modules", st.MachineClamped ? "clamped" : st.MachineUnclamped ? "open" : "moving"),
    k("accumulator", `${f1(st.AccuPressure, 2)} MPa`, st.AccuPressure < 10.0 ? "al-bad" : st.AccuPressure >= 10.7 ? "al-good" : ""),
    k("pump", st.UnloadValve ? "loading" : st.PumpMotorOK ? "idling" : "off"),
    k("last change", trk.last ? `${f1(trk.last.t, 2)} s (min ${f1(trk.last.pMin, 2)} MPa)` : "–"),
    k("changes", String(st.C_Changes ? st.C_Changes.CV : 0)),
    k("alarm", f ? `YES${st.AlarmNo ? " – step " + st.AlarmNo : ""}` : "none", f ? "al-bad" : ""),
  ].join("");
}

/* ---------------------------------------------------------------- build */
function build() {
  const host = $("apcLadder");
  if (!host || built) return;
  built = true;
  if (!$("apcLadStyle")) { const s = document.createElement("style"); s.id = "apcLadStyle"; s.textContent = CSS; document.head.appendChild(s); }
  host.innerHTML = HEAD + `
    <div class="al-stat" id="apcLadStat" aria-live="off"></div>
    <div class="al-faults"><span>Fault buttons (simulation):</span>
      <button type="button" data-f="chip">Chip under the pallet</button>
      <button type="button" data-f="sensorUpBroken">Arm-up sensor broken</button>
      <button type="button" data-f="curtain">Break light curtain</button>
      <button type="button" data-f="pumpTrip">Pump trip (-FC1)</button>
      <button type="button" data-f="cold">Cold oil 15 °C</button></div>
    <div id="apcLadCore"></div>` + NOTES;
  plant = makePlant();
  try {
    ctl = mountLadder($("apcLadCore"), PROGRAM, { plant, onScan: track, onReset: () => { Object.assign(trk, { t1: null, last: null, changes: 0, pMin: null, prevS1: false, prevS9: false }); }, height: 720 });
  } catch (e) { console.error("apclad: mountLadder failed", e); host.insertAdjacentHTML("beforeend", `<p class="hint">Ladder core could not start: ${String(e.message || e)}</p>`); return; }
  window.apcLadCtl = ctl;
  const stat = $("apcLadStat");
  setInterval(() => { if (host.offsetParent !== null && !document.hidden) stat.innerHTML = statusHtml(); }, 250);
  stat.innerHTML = statusHtml();
  host.querySelector(".al-faults").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-f]"); if (!b) return;
    const k = b.dataset.f;
    if (k === "curtain") { const v = !ctl.get("LightCurtainFree"); ctl.setInput("LightCurtainFree", v); b.classList.toggle("on", !v); return; }
    if (k === "cold") { const cold = ctl.get("OilTemp") >= 20; ctl.setInput("OilTemp", cold ? 15 : 35); b.classList.toggle("on", cold); return; }
    plant.sim[k] = !plant.sim[k]; b.classList.toggle("on", plant.sim[k]);
  });
  // catalogue card right after the ladder card
  try {
    const wrap = document.createElement("div");                      // makeCard needs its wrap in the document (it looks up ids)
    wrap.id = "apcLadCardWrap"; wrap.style.marginTop = "16px";
    const anchor = $("apcLadderCard");
    if (anchor) anchor.after(wrap); else host.appendChild(wrap);
    makeCard(CARD, wrap, { card: "ldCardB", q: "ldQB", g: "ldGB", cnt: "ldCntB", buy: "ldBuyB" }, "ldB");
  } catch (e) { console.error("apclad: catalogue card", e); }
}

function ensure() { if (!built && pane && pane.classList.contains("active")) build(); }
const _prev = window.onTabShown;
window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "apc") ensure(); };
ensure();

/* ---------------------------------------------------------------- self-test (&ladBtest) */
function selfTestB(log = (s) => console.log(s)) {
  let bad = 0;
  const ok = (c, m) => { if (!c) bad++; log(`LADBTEST ${c ? "ok  " : "FAIL"} ${m}`); };
  const pl = makePlant();
  const E = createEngine(PROGRAM, { plant: pl });
  const dt = E.dt;
  let both = 0;                                             // lift up + down together (must stay 0)
  const scan = (n = 1) => { for (let i = 0; i < n; i++) { E.scan(); if (E.bit("LiftUpValve") && E.bit("LiftDownValve")) both++; } };
  const until = (cond, maxS) => { const n0 = E.scans; while (!cond() && (E.scans - n0) * dt < maxS) scan(); return cond() ? (E.scans - n0) * dt : null; };
  const press = (tag) => { E.set(tag, true); scan(); E.set(tag, false); scan(); };
  const ready = () => { press("OperatorReady"); };
  const warns = checkProgram(PROGRAM);
  ok(warns.length === 0, `program check: ${warns.length} warning(s)${warns.length ? " – " + warns.join(" | ") : ""} (18 networks, ${PROGRAM.networks.reduce((k, n) => k + n.rungs.length, 0)} rungs, ${PROGRAM.tags.length} tags)`);

  // 1 – start-up: S0, pump on, feedback
  scan();
  ok(E.bit("S0") && E.bit("PumpContactor"), "first scan → S0 set by Network 8, pump contactor on");
  const tFb = until(() => E.bit("PumpMotorOK"), 2);
  ok(tFb !== null && Math.abs(tFb - 0.2) <= 2 * dt + 1e-9, `pump feedback after ${f1(tFb, 2)} s (plant run-up 0.2 s)`);
  scan(5);
  ok(!E.bit("M_StartOK"), "start conditions FALSE while the load station is not READY");
  ready();
  ok(E.bit("M_StnReady") && E.bit("StationLamp") && E.bit("M_StartOK"), "OperatorReady → M_StnReady (seal-in) + green lamp → M_StartOK");

  // 2 – one complete change, step entry times
  const tStep = {}; const p0 = E.num("AccuPressure"); let pMin = p0, unloadInS2 = false;
  E.set("NC_M60", true);
  const t0 = E.time;
  let n = 0;
  while (n < 1000) {
    scan(); n++;
    for (let k = 1; k <= 9; k++) if (E.bit("S" + k) && tStep[k] === undefined) tStep[k] = E.time - t0;
    pMin = Math.min(pMin, E.num("AccuPressure"));
    if (E.bit("S2") && E.bit("UnloadValve")) unloadInS2 = true;
    if (tStep[9] !== undefined && E.bit("S0")) break;
  }
  const tBack = E.time - t0;
  const line = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `S${k} ${f1(tStep[k], 2)}`).join(" · ");
  ok(Object.keys(tStep).length === 9, `step entry times [s]: ${line}`);
  const nominal = STEPS.reduce((a, s) => a + s[2], 0);
  const tChange = tStep[9] - tStep[1];
  ok(Math.abs(nominal - 8.8) < 1e-9 && tChange >= 8.8 - 1e-6 && tChange <= 8.8 + 18 * dt + 1e-9, `M60 → FIN: S1 → S9 = ${f1(tChange, 2)} s (page 8.8 s; + ${Math.round((tChange - 8.8) / dt)} scans – the plant runs before the logic, so a step ends in the scan its sensor comes), M60 → S1 ${f1(tStep[1], 2)} s`);
  const dur = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => tStep[k + 1] - tStep[k]);
  ok(dur.every((d, i) => d >= STEPS[i][2] - 1e-9 && d <= STEPS[i][2] + 3 * dt + 1e-9), `step durations [s]: ${dur.map((d) => f1(d, 2)).join(" / ")} (page ${STEPS.map((s) => s[2]).join(" / ")})`);
  ok(tBack - tStep[9] <= 0.1 + 3 * dt + 1e-9 && !E.bit("NC_FIN") && !E.bit("NC_M60"), `FIN handshake: NC drops M60 0.1 s after FIN, back in S0 ${f1(tBack - tStep[9], 2)} s after FIN, FIN off`);
  ok(unloadInS2 && pMin >= 10.0, `accumulator ${f1(p0, 2)} MPa at start, minimum ${f1(pMin, 2)} MPa during the change (≥ 10.0), pump loads from S2`);
  ok(E.bit("Arm180deg") && E.bit("ArmDown") && E.bit("MachineClamped") && E.state.C_Changes.CV === 1 && !E.bit("M_StnReady"), "after the change: arm down at 180°, clamped, C_Changes = 1, station READY cleared");

  // 3 – second change goes back to 0°
  scan(5); ready(); E.set("NC_M60", true);
  const t2 = until(() => E.bit("S9"), 12);
  scan(10);
  ok(t2 !== null && E.bit("Arm0deg") && !E.bit("M_Dir180"), `2nd change back to 0° in ${f1(t2, 2)} s (M_Dir180 = 0, Arm0deg = 1)`);

  // 4 – low pressure: no start + message, alarm after 0.5 s
  scan(5); ready();
  E.force("AccuPressure", 10.5); E.set("NC_M60", true);
  const tMsg = until(() => E.bit("M_NoStartMsg"), 4);
  ok(E.bit("S0") && !E.bit("M_PressOK") && tMsg !== null && Math.abs(tMsg - 2.0) <= 2 * dt + 1e-9, `10.5 MPa: M_PressOK = 0, M60 waits in S0, "M60 waits" message after ${f1(tMsg, 2)} s (T_NoStart 2.0 s)`);
  E.force("AccuPressure", 9.9);
  const tLow = until(() => E.bit("F_PLow"), 2);
  ok(tLow !== null && Math.abs(tLow - 0.5) <= 2 * dt + 1e-9 && E.bit("AlarmLamp") && E.bit("NC_Alarm"), `9.9 MPa: F_PLow after ${f1(tLow, 2)} s (debounce 0.5 s) → red lamp + NC alarm`);
  E.force("AccuPressure", null); E.set("AccuPressure", 11.2); scan(); press("S_Ack"); scan(2);
  ok(!E.bit("M_Fault"), "pressure back to 11.2 MPa + Ack → fault cleared");
  const tGo = until(() => E.bit("S1"), 1);
  ok(tGo !== null, `start conditions TRUE again → S0 → S1 after ${f1(tGo, 2)} s (M60 still on = level, not edge)`);
  until(() => E.bit("S0"), 12);

  // 5 – chip under the pallet → seating watchdog, then retry after Ack
  scan(5); ready(); pl.sim.chip = true; E.set("NC_M60", true);
  until(() => E.bit("S7"), 12);
  const tSeat = until(() => E.bit("F_Seat"), 2);
  scan();
  ok(tSeat !== null && Math.abs(tSeat - 0.8) <= 2 * dt + 1e-9 && E.num("AlarmNo") === 7 && !E.bit("SeatingAir") && !E.bit("NC_FIN"), `chip: seating watchdog T_Wd7 → F_Seat after ${f1(tSeat, 2)} s, AlarmNo = 7, seating air off, no FIN`);
  pl.sim.chip = false; press("S_Ack");
  const tFin = until(() => E.bit("NC_FIN"), 3);
  ok(tFin !== null, `chip removed + Ack → watchdog restarted, seating OK, FIN ${f1(tFin, 2)} s after Ack (0.4 s air + door 1.2 s)`);
  until(() => E.bit("S0"), 2);

  // 6 – light curtain broken while rotating → F_Safety, servo stops (STO by the safety relay in the plant), continue after Ack
  scan(5); ready(); E.set("NC_M60", true);
  until(() => E.bit("S4"), 6); scan(25);
  const angA = pl.sim.ang;
  E.set("LightCurtainFree", false); scan(); scan();
  ok(E.bit("F_Safety") && E.bit("M_Fault"), `curtain broken in S4 at ${f1(angA, 0)}° → F_Safety in the same scan, chain holds`);
  scan(20);
  ok(Math.abs(pl.sim.ang - angA) < 4, `arm stopped by STO (simulated): ${f1(angA, 1)}° → ${f1(pl.sim.ang, 1)}° in 0.4 s`);
  E.set("LightCurtainFree", true); scan(); press("S_Ack");
  const tRest = until(() => E.bit("S5"), 4);
  ok(tRest !== null, `curtain free + Ack → rotation continues, S5 after ${f1(tRest, 2)} s`);
  until(() => E.bit("S0"), 8);

  // 7 – arm-up sensor broken → lift watchdog 1.6 s, AlarmNo 3
  scan(5); ready(); pl.sim.sensorUpBroken = true; E.set("NC_M60", true);
  until(() => E.bit("S3"), 4);
  const tUp = until(() => E.bit("F_Wd"), 3);
  scan();
  ok(tUp !== null && Math.abs(tUp - 1.6) <= 2 * dt + 1e-9 && E.num("AlarmNo") === 3 && !E.bit("LiftUpValve"), `arm-up sensor broken: F_Wd after ${f1(tUp, 2)} s in S3, AlarmNo = 3, lift valve to centre`);
  // recovery: manual + Home
  pl.sim.sensorUpBroken = false; E.set("S_Auto", false); scan(); press("S_Ack");
  E.set("S_JogDown", true); until(() => E.bit("ArmDown"), 2); E.set("S_JogDown", false);
  press("S_Home"); scan(2);
  ok(E.bit("S0") && !E.bit("S3"), "recovery: MANUAL, jog down, Home → all step bits reset, Network 8 sets S0");
  E.set("NC_M60", false);              // NC reset by the operator (else the change starts again when AUTO comes back – M60 is a level)
  // modules still open after the abort? clamp happens because UnclampValve is off in S0
  scan(50); E.set("S_Auto", true); scan(2);

  // 8 – single-step mode: one press = one step
  ready(); E.set("S_Step", true); E.set("NC_M60", true); scan(5);
  const s0still = E.bit("S0");
  const why = ["M_Auto", "NC_SpindleHome", "NC_InPos", "M_PressOK", "M_OilWarm", "PumpMotorOK", "M_StnReady", "StationDoorClosed", "LightCurtainFree", "ArmDown", "PalletInMachine", "PalletAtStation", "MachineClamped"].filter((t) => !E.bit(t)).concat(["M_Fault", "Servo_Fault"].filter((t) => E.bit(t)));
  press("S_Next"); scan(2);
  const inS1 = E.bit("S1");
  scan(100);                                                     // door open done, but no Next → stays in S1
  const stay = E.bit("S1") && !E.bit("F_Wd");
  press("S_Next"); scan(2);
  ok(s0still && inS1 && stay && E.bit("S2"), `single step: waits in S0 (${s0still}), Next → S1 (${inS1}), stays in S1 without watchdog (${stay}) until Next → S2 (${E.bit("S2")})${why.length ? " – missing: " + why.join(", ") : ""}`);
  E.set("S_Step", false);
  until(() => E.bit("S0"), 12);

  // 9 – pump trip → F_Hyd after 1.0 s
  scan(5); pl.sim.pumpTrip = true;
  const tHyd = until(() => E.bit("F_Hyd"), 3);
  scan();
  ok(tHyd !== null && tHyd <= 1.0 + 3 * dt + 1e-9 && !E.bit("PumpContactor"), `pump trip: no feedback → F_Hyd after ${f1(tHyd, 2)} s (T_PumpFb 1.0 s), contactor off`);
  pl.sim.pumpTrip = false; press("S_Ack"); scan(20);

  // 10 – hysteresis: from the current pressure down to 10.8 by leakage, load to 11.5
  E.force("AccuPressure", 10.85); scan(); E.force("AccuPressure", null);
  const tIn = until(() => E.bit("UnloadValve"), 20);
  const pIn = E.num("AccuPressure");
  const tOut = until(() => !E.bit("UnloadValve"), 10);
  ok(tIn !== null && pIn < 10.8 && pIn > 10.79 && tOut !== null && E.num("AccuPressure") >= 11.5, `hysteresis: leakage 10.85 → 10.8 MPa in ${f1(tIn, 1)} s, pump loads 10.8 → 11.5 MPa in ${f1(tOut, 2)} s (calc 1.8 s), then unloads`);

  ok(both === 0, `interlock: LiftUpValve and LiftDownValve never on together (${E.scans} scans checked)`);
  log(`LADBTEST times: scan ${dt * 1000} ms, plant ${JSON.stringify(PLANT_TIMES)}`);
  log(`LADBTEST DONE errors=${bad}`);
  return bad;
}
window.apcLadSelfTest = selfTestB;

if (Q.has("ladBtest")) {
  setTimeout(() => {
    try { selfTestB(); } catch (e) { console.log("LADBTEST FAIL exception " + (e && e.stack || e)); }
    // UI check: open the APC tab and look at the DOM
    if (typeof window.showTab === "function") window.showTab("apc"); else { const b = document.querySelector('[data-tab="apc"]'); if (b) b.click(); }
    setTimeout(() => {
      const nets = document.querySelectorAll("#apcLadder .ld-net").length;
      const card = $("ldCardB"), imgs = card ? card.querySelectorAll("img").length : 0;
      console.log(`LADBTEST ui: built=${built} networks=${nets} steps=${document.querySelectorAll("#apcLadder .ld-step").length} inputs=${document.querySelectorAll("#apcLadder [data-in]").length} card=${!!card} drawings=${imgs} afterLadderCard=${!!card && $("apcLadderCard").nextElementSibling === card.parentNode}`);
      console.log(`LADBTEST ui DONE ${built && nets === 18 && !!card && imgs === 7 ? "ok" : "FAIL"}`);
    }, 1500);
  }, 800);
}
