/* AS/RS tab – item 3 "PLC + electrical circuits" (UI + live circuit state from the shared twin window.ASRS.sim).
 * Files: asrsckt_calc.js (numbers) · asrsckt_sym.js (frame, symbols on top of robotckt_sym.js) · asrsckt_pages.js (8 pages)
 *        · asrsckt_data.js (texts, BOM, tests) · asrsckt_card.js (catalogue card data, generated from guide 33) · asrs3.css.
 * Guide: docs/33_asrs_control_circuits.md. Built lazily on the first "sritemshow" event with detail "3".
 * URL (tests + deep links): /?sritem=3#asrs · &sr3page=1..8 · &sr3estop (e-stop -SF52 pressed) · &sr3door (access request → door open)
 *   · &sr3lc (person in the light curtain) · &sr3slack (slack rope) · &sr3over (overload) · &sr3chain (energy chain instead of rail)
 *   · &sr3centre (rail fed in the centre) · &sr3regen (active infeed) · &sr3info=KEY · &sr3card=calc|bom|test|legend|ref
 *   · &sr3test (self-check, console "SR3TEST …") · &sr3back (switch items 1 → 2 → 4 → 3, report errors) · &sr3hold (headless screenshots)
 *   · &sr3svg=all (export the 8 pages as print SVG into textarea#sr3svgout – used to make docs/img/33_*.svg)
 *   · makeCard: &sr3tab=draw|buy|shop · &sr3q=text · &sr3box=N · &sr3scroll
 * Offline, no libraries. All values are EXAMPLES – the real design follows IEC 60204-1/-32, EN 528, ISO 13849 and a qualified designer.
 */
import { getASRS, CRANE } from "./asrscore.js";
import { calc, axisPower, DEF } from "./asrsckt_calc.js";
import { mkPen, REG, PW, PH, esc } from "./asrsckt_sym.js";
import { drawPage, NPAGES, PAGE_TITLES } from "./asrsckt_pages.js";
import { WHY, info, bom, TESTS, LETTERS } from "./asrsckt_data.js";
import { makeCard } from "./robotref.js";
import { CARD } from "./asrsckt_card.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const f = (v, d = 1) => (+v).toFixed(d);
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
window.addEventListener("unhandledrejection", (e) => errs.push("promise: " + (e.reason && e.reason.message || e.reason)));
if (Q.has("sr3hold")) {
  const fr = document.createElement("iframe"); fr.src = "/api/stream?sr3hold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { const b = document.querySelector('[data-tab="asrs"]'); if (b && !$("tab-asrs").classList.contains("active")) b.click(); }, 300);
}
const ALIAS = { TA12: "TA11", MA12: "MA11", MB11: "MB13", MB12: "MB13", MB14: "MB13", BG62: "BG61", BG63: "BG61", BG65: "BG64", SF52: "SF51", SF53: "SF51", SF54: "SF51", SF55: "SF51", SF77: "SF76",
  MA72: "MA71", MA73: "MA71", QA72: "QA71", QA73: "QA71", KF75: "KF74", BG36: "BG37", BG38: "BG39" };

function build(box) {
  const A = getASRS(), sim = A.sim;
  let inp = { ...DEF };
  if (Q.has("sr3chain")) inp.feedType = "chain";
  if (Q.has("sr3centre")) inp.feed = "centre";
  if (Q.has("sr3regen")) inp.regen = true;
  let K = calc(inp);
  const T = {
    page: Math.max(1, Math.min(NPAGES, +Q.get("sr3page") || 1)), q1: true, qb2: true, qb10: true,
    es: { cr: false, io: false, d1: false, d2: false, cv: false },
    door: { closed: true, locked: true, req: false, unlockOut: false }, lc: { person: false, tPerson: 0 },
    slack: false, overspeed: false, limHz: "", limTr: "", need: false, own: false, convLatch: false,
    info: Q.get("sr3info") || "", prevEstop: sim.estop, prev: { vx: 0, vz: 0, t: sim.t, ax: 0, az: 0 }, log: [], blink: false,
  };
  const log = (ev, res) => { T.log.unshift({ t: sim.t, ev, res }); if (T.log.length > 40) T.log.pop(); };

  /* ---------------- safety logic (local devices + shared twin faults) */
  const localTrip = () => !T.door.closed || (T.lc.person && !muting()) || T.slack || T.overspeed || !!T.limHz || !!T.limTr;
  function muting() { return sim.outConv.some((l) => sim.t - l.t < 8); }
  function trip(why) {
    T.need = true;
    if (!sim.faults.crane) { T.own = true; sim.setFault("crane", true); }
    sim.logMsg(`item 3: ${why} – crane safety stop (STO + brakes)`, "alarm");
    log(why, "F-PLC: STO to all crane drives, SBC brakes, -QA10 off; reset needed");
  }
  const act = {
    es(k) {
      T.es[k] = !T.es[k];
      const any = Object.values(T.es).some(Boolean);
      if (T.es[k]) { if (!sim.estop) sim.setEstop(true); log(`e-stop -SF5${"cr io d1 d2 cv".split(" ").indexOf(k) + 1} pressed`, "SS1: crane brakes (ramp) → STO + brakes; conveyors STO"); }
      else { if (!any && sim.estop) sim.setEstop(false); log(`e-stop -SF5${"cr io d1 d2 cv".split(" ").indexOf(k) + 1} released`, any ? "other e-stop still pressed" : "reset needed (-SF58)"); }
    },
    req() {
      if (!T.door.closed) return;
      T.door.req = true; log("access request -SF57", "crane finishes the move, stops (SS1), waits for standstill");
      if (!sim.faults.crane) { T.own = true; sim.setFault("crane", true); sim.logMsg("item 3: access request – crane stops, door unlocks at standstill", "warn"); }
      T.need = true;
      setTimeout(() => { T.door.locked = false; T.door.unlockOut = true; log("standstill (SSM -KF33)", "guard lock -MB56 released – door may open"); render(true); }, 900);
    },
    door() {
      if (T.door.closed) { if (T.door.locked) { log("door handle pulled", "REFUSED – door locked (request entry first)"); return; } T.door.closed = false; log("aisle door opened", "crane stays in STO; aisle light on"); }
      else { T.door.closed = true; T.door.locked = true; T.door.req = false; T.door.unlockOut = false; log("aisle door closed", "guard lock engages; reset needed"); }
    },
    person() {
      T.lc.person = true; T.lc.tPerson = sim.t;
      if (muting()) log("person in the light curtain DURING muting", "not detected! – muting must be short and sequence-checked (IEC 62046)");
      else { T.convLatch = true; trip("light curtain -BG59 interrupted (no muting)"); }
      setTimeout(() => { T.lc.person = false; render(true); }, 2500);
    },
    reset() {
      if (sim.estop) { log("reset -SF58", "REFUSED – e-stop still pressed"); return; }
      if (localTrip()) { log("reset -SF58", "REFUSED – cause still present (door / slack rope / limit / light curtain)"); return; }
      T.need = false; T.convLatch = false;
      if (T.own && sim.faults.crane) { sim.setFault("crane", false); }
      T.own = false; log("reset -SF58", "safety outputs ON – crane continues");
    },
    toggle(k) {
      if (k === "slack" || k === "overspeed") { T[k] = !T[k]; if (T[k]) trip(k === "slack" ? "slack-rope switch -BG34 opened" : "overspeed: governor -BG30 / -KF33 tripped"); else log(k + " repaired", "press reset"); }
      if (k === "limHz") { T.limHz = T.limHz ? "" : "up"; if (T.limHz) trip("hoist upper final limit -BG37 reached"); else log("hoist driven back from the final limit (manual, key)", "press reset"); }
      if (k === "limTr") { T.limTr = T.limTr ? "" : "rear"; if (T.limTr) trip("travel final limit -BG43 reached"); else log("crane driven back from the final limit (manual, key)", "press reset"); }
      if (k === "over") sim.setFault("overload", !sim.faults.overload);
      if (k === "scanner") sim.setFault("scanner", !sim.faults.scanner);
      if (k === "convJam") sim.setFault("convJam", !sim.faults.convJam);
      if (k === "crane") { sim.setFault("crane", !sim.faults.crane); T.own = false; }
    },
  };

  /* ---------------- live state */
  function state(print) {
    const c = sim.crane, dt = Math.max(1e-3, sim.t - T.prev.t);
    if (sim.t !== T.prev.t) {
      const ax = (c.vx - T.prev.vx) / dt, az = (c.vz - T.prev.vz) / dt;
      T.prev.ax = Math.abs(ax) < 2 ? ax : T.prev.ax; T.prev.az = Math.abs(az) < 2 ? az : T.prev.az;
      T.prev.vx = c.vx; T.prev.vz = c.vz; T.prev.t = sim.t;
    }
    if (T.prevEstop && !sim.estop) T.need = true;
    T.prevEstop = sim.estop;
    if (sim.estop && !Object.values(T.es).some(Boolean)) T.es.cr = true;           // e-stop from another item → show it at the crane panel
    if (!sim.estop && Object.values(T.es).some(Boolean)) Object.keys(T.es).forEach((k) => (T.es[k] = false));
    const sto = print ? false : (sim.estop || sim.faults.crane), plan = !!c.plan && !print;
    const forkMoving = !print && (c.phase === "forkOut" || c.phase === "forkIn");
    const loadKg = print ? 0 : c.carrying ? c.carrying.kg : 0;
    const P = print ? { tr: 0, hz: 0, fk: 0, net: 0 } : axisPower(K, { vx: c.vx, vz: c.vz, ax: plan ? T.prev.ax : 0, az: plan ? T.prev.az : 0, loadKg, forkMoving });
    const en = { tr: plan && !sto, hz: plan && !sto, fk: forkMoving && !sto };
    const live = T.q1 && T.qb2 && T.qb10;
    const net = sto ? 0 : P.net;
    const chop = live && !K.I.regen && net < -300 && !sto;
    const vdc = !live ? 0 : K.I.regen ? 600 : chop ? 750 : net < -300 ? 690 : 565 - 20 * Math.max(0, net) / 25000;
    const muted = !print && muting();
    return {
      print, q1: T.q1, qb2: T.qb2, qb10: T.qb10, qa10: live && !sto, feedType: K.I.feedType, feed: K.I.feed, regen: K.I.regen,
      x: print ? 20 : c.x, z: print ? 3.0 : c.z, vx: print ? 0 : c.vx, vz: print ? 0 : c.vz, fork: print ? 0 : c.fork, phase: print ? "idle" : c.phase, mode: c.mode, loadKg,
      sto, estop: !print && sim.estop, faults: print ? { crane: false, scanner: false, convJam: false, overload: false } : sim.faults,
      es: print ? {} : T.es, door: print ? { closed: true, locked: true } : T.door, lc: { person: !print && T.lc.person, muting: muted },
      slack: !print && T.slack, overspeed: !print && T.overspeed, limHz: print ? "" : T.limHz, limTr: print ? "" : T.limTr,
      hoistTrip: !print && (T.slack || T.overspeed || !!T.limHz), over: !print && sim.faults.overload, need: !print && T.need, blink: T.blink,
      axes: { tr: { en: en.tr, P: P.tr }, hz: { en: en.hz, P: P.hz }, fk: { en: en.fk, P: P.fk }, netP: net }, crPow: net, chop, vdc,
      convSto: !print && (sim.estop || T.convLatch), doorOpen: !print && !T.door.closed,
      fork0: Math.abs(print ? 0 : c.fork) < 0.05, forkL: !print && c.fork < -0.95, forkR: !print && c.fork > 0.95, loadL: !!loadKg, loadR: !!loadKg,
      slotRef: !print && c.phase === "pos", slotOcc: !print && (c.phase === "pos" || c.phase === "forkOut") && !c.carrying && c.x > 0.5, moving: Math.abs(c.vx) + Math.abs(c.vz) > 0.01,
      inN: print ? 2 : sim.inConv.length, outN: print ? 1 : sim.outConv.length, jam: !print && sim.faults.convJam, scanFault: !print && sim.faults.scanner, lift: !print && c.x < 0.3 && (c.phase === "lift" || c.phase === "lower"),
      safeFault: "",
    };
  }

  /* ---------------- skeleton */
  box.innerHTML = `
  <div class="rc-wrap ck-wrap sr3-wrap">
    <div class="card ck-bar">
      <div class="ck-row">
        <button class="btn warn" id="sr3Es" title="e-stop -SF52 at the I/O station"></button>
        <button class="btn" id="sr3Req" title="access request -SF57 at the aisle door">Request entry -SF57</button>
        <button class="btn" id="sr3Door"></button>
        <button class="btn" id="sr3Lc" title="a person walks into the I/O light curtain">Person into light curtain</button>
        <button class="btn primary" id="sr3Reset" title="reset -SF58">Reset -SF58</button>
        <span class="ck-sep"></span>
        <span id="sr3Chips" class="ck-chips"></span>
      </div>
      <div class="ck-pages" role="group" aria-label="Drawing page">${PAGE_TITLES.map((t, i) => `<button class="ck-pg" data-srpg="${i + 1}" title="${esc(t)}"><b>${i + 1}</b> ${esc(["Mains + power rail", "Crane drives (DC link)", "Hoist safety", "Travel + positioning", "Safety circuit", "Crane PLC I/O", "Conveyor + I/O", "Cabinet + heat"][i])}</button>`).join("")}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 id="sr3Title"></h2><span class="sub">schematic drawing · live from the AS/RS twin · click a device for its information · EXAMPLE values – the real design follows IEC 60204-1/-32, EN 528, ISO 13849 and a qualified electrical designer</span></div>
      <p class="rc-why" id="sr3Why"></p>
      <div class="ck-sheet" id="sr3Sheet"></div>
      <div class="ck-under">
        <div id="sr3Ctl" class="ck-ctl"></div>
        <div class="rc-info" id="sr3Info"></div>
      </div>
    </div>
    <div class="card" id="sr3CardCalc"><div class="card-head"><h2>C · Calculations (live with these inputs)</h2><span class="sub">formula → numbers → result · all inputs are examples · same formulas as guide 33</span></div>
      <p class="rc-why"><b>What you see:</b> supply current of the AS/RS, cable + rail sizing and voltage drop, DC link braking energy and resistor, 24 V budget, safety distance at the I/O light curtain, PL example, cabinet heat. <b>Why it matters:</b> these are the checks before you order the rail, the drives and the safety parts – change an input and watch the result.</p>
      <div class="sr3-inp" id="sr3Inp"></div>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="sr3Calc"></table></div>
      <h3>PL verification (ISO 13849-1, example subsystem values)</h3>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="sr3Pl"></table></div></div>
    <div class="card" id="sr3CardBom"><div class="card-head"><h2>D · Component list (BOM)</h2><span class="sub">tags as in the drawings · ratings follow the inputs of card C · example product families – see the buy list below</span></div>
      <p class="rc-why"><b>What you see:</b> every device of the drawing set with tag, rating and example product family. <b>Why it matters:</b> the BOM links drawing, cabinet, spare parts and purchasing.</p>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="sr3Bom"></table></div></div>
    <div class="card" id="sr3CardTest"><div class="card-head"><h2>E · Test + commissioning (IEC 60204-1 §18, EN 528)</h2><span class="sub">order: without power → with power → safety functions → performance · example limits</span></div>
      <p class="rc-why"><b>What you see:</b> the tests before the store is handed over. <b>Why it matters:</b> a crane carries 1.2 t at 8 m height – only measured and documented tests prove it is safe (needed for the CE marking).</p>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="sr3Test"></table></div></div>
    <div class="card" id="sr3CardLegend"><div class="card-head"><h2>F · Symbol legend, device letters, wire colours</h2><span class="sub">IEC 60617 symbols · IEC 81346-2 two-letter classes (project rule, guide 15 §17.3) · IEC 60204-1 colours</span></div>
      <div id="sr3Legend"></div></div>
  </div>`;
  const wrap = box.querySelector(".sr3-wrap");

  /* ---------------- render */
  let lastKey = "";
  function draw(n, S, reg) { const P = mkPen(n, { reg }); drawPage(P, n, S, K); return P.out(); }
  function fullPass() { REG.clear(); const S = state(true); for (let n = 1; n <= NPAGES; n++) draw(n, S, true); }
  function renderKey(S) {
    const b = [T.page, S.sto, S.estop, JSON.stringify(S.es), JSON.stringify(S.door), S.lc.person, S.lc.muting, S.slack, S.overspeed, S.limHz, S.limTr, S.over, S.need, S.blink && S.need, S.faults.crane, S.faults.scanner, S.faults.convJam,
      S.axes.tr.en, S.axes.hz.en, S.axes.fk.en, S.chop, T.q1, T.qb2, T.qb10, K.I.feedType, K.I.feed, K.I.regen, T.info, S.convSto];
    if (T.page === 1 || T.page === 4) b.push(Math.round(S.x * 10));
    if (T.page === 2) b.push(Math.round(S.axes.netP / 200), Math.round(S.axes.tr.P / 200), Math.round(S.axes.hz.P / 200));
    if (T.page === 3) b.push(Math.round(S.z * 20), Math.round(S.vz * 20), S.loadKg);
    if (T.page === 6) b.push(Math.round(S.fork * 20), S.loadKg, S.phase, S.slotRef, S.slotOcc, Math.round(S.x));
    if (T.page === 7) b.push(S.inN, S.outN, S.lift);
    return b.join("|");
  }
  function render(force) {
    const S = state(false);
    const key = renderKey(S);
    if (!force && key === lastKey) return;
    lastKey = key;
    $("sr3Sheet").innerHTML = `<svg class="ck-svg sr3-svg" viewBox="0 0 ${PW} ${PH}" role="img" aria-label="${esc(PAGE_TITLES[T.page - 1])}">${draw(T.page, S)}</svg>`;
    $("sr3Title").textContent = `Page ${T.page} / ${NPAGES} · ${PAGE_TITLES[T.page - 1]}`;
    $("sr3Why").innerHTML = `<b>What you see:</b> ${esc(WHY[T.page - 1][0])} <b>Why it matters:</b> ${esc(WHY[T.page - 1][1])}`;
    document.querySelectorAll("[data-srpg]").forEach((b) => b.classList.toggle("active", +b.dataset.srpg === T.page));
    renderBar(S); renderCtl(S); renderInfo();
  }
  function renderBar(S) {
    $("sr3Es").textContent = T.es.io ? "Release e-stop -SF52" : "E-stop -SF52 (I/O station)";
    $("sr3Door").textContent = T.door.closed ? "Open aisle door" : "Close aisle door";
    const chip = (t, c) => `<span class="rc-chip ${c}">${esc(t)}</span>`;
    $("sr3Chips").innerHTML = chip("crane: " + (S.sto ? (S.estop ? "E-STOP" : "safety stop / fault") : S.phase), S.sto ? "rc-bad" : S.moving ? "rc-ok" : "") +
      chip(S.need ? "reset needed" : "safety OK", S.need ? "rc-warn" : "rc-ok") + chip(`DC ${f(S.vdc, 0)} V`, S.chop ? "rc-warn" : "") + chip(S.lc.muting ? "muting" : "LC free", S.lc.muting ? "rc-warn" : "");
  }
  /* ---------------- controls under the drawing */
  const btn = (id, txt, cls = "") => `<button class="btn ${cls}" data-sract="${id}">${esc(txt)}</button>`;
  const seg = (name, opts, cur) => `<span class="seg">${opts.map(([v, t]) => `<button class="seg-btn${String(v) === String(cur) ? " active" : ""}" data-srseg="${name}" data-v="${v}">${esc(t)}</button>`).join("")}</span>`;
  const chk = (k, t, v) => `<label class="rc-sl"><input type="checkbox" data-srchk="${k}"${v ? " checked" : ""}> ${esc(t)}</label>`;
  function logTable() {
    return `<div class="table-wrap ck-log"><table class="rb-tbl"><tr><th>t (s)</th><th>event</th><th>what the safety system does</th></tr>${T.log.map((l) => `<tr><td>${f(l.t, 1)}</td><td>${esc(l.ev)}</td><td>${esc(l.res)}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">press a button – the events appear here</td></tr>`}</table></div>`;
  }
  function renderCtl(S) {
    const esRow = `<div class="rc-ctlrow"><b>E-stops:</b> ${[["cr", "-SF51 crane"], ["io", "-SF52 I/O"], ["d1", "-SF53 door 1"], ["d2", "-SF54 end door"], ["cv", "-SF55 conveyor"]].map(([k, t]) => btn("es:" + k, (T.es[k] ? "release " : "press ") + t, T.es[k] ? "warn" : "")).join(" ")}</div>`;
    const faults = `<div class="rc-ctlrow"><b>Shared twin faults:</b> ${chk("crane", "crane fault", sim.faults.crane)} ${chk("over", "overload", sim.faults.overload)} ${chk("scanner", "scanner no-read", sim.faults.scanner)} ${chk("convJam", "conveyor jam", sim.faults.convJam)}</div>`;
    let h = "";
    const p = T.page;
    if (p === 1) h = `<div class="rc-ctlrow"><b>Feed to the crane:</b> ${seg("feedType", [["rail", "conductor rail"], ["chain", "energy chain"]], K.I.feedType)} ${K.I.feedType === "rail" ? `<b>feed point:</b> ${seg("feed", [["end", "I/O end"], ["centre", "rail centre"]], K.I.feed)}` : ""}</div>
      <div class="rc-ctlrow">${btn("q1", "main switch -QB1 " + (T.q1 ? "OFF" : "ON"))} ${btn("qb2", "rail isolator -QB2 " + (T.qb2 ? "OFF (lock-out)" : "ON"))}</div>
      <p class="rc-note">The collector trolley follows the crane of the twin. With the feed at the I/O end the voltage drop is highest at the far end (28 m); a centre feed halves the length. Card C has the numbers.</p>`;
    else if (p === 2) h = `<div class="rc-ctlrow"><b>Infeed:</b> ${seg("regen", [["0", "diode + brake resistor"], ["1", "active infeed (regenerative)"]], K.I.regen ? "1" : "0")} ${btn("qb10", "crane main switch -QB10 " + (T.qb10 ? "OFF" : "ON"))}</div>` + esRow +
      `<p class="rc-note"><b>Now:</b> travel ${S.axes.tr.en ? f(S.axes.tr.P / 1000, 1) + " kW" : "off"} · hoist ${S.axes.hz.en ? f(S.axes.hz.P / 1000, 1) + " kW" : "off"} · fork ${S.axes.fk.en ? "moving" : "off"} · net ${f(S.axes.netP / 1000, 1)} kW. Negative = the axis brakes or lowers and feeds energy into the DC link. One full lowering of ${K.hz.mh} kg over ${K.I.H} m gives ${f(K.brk.Elow / 1000, 1)} kJ.</p>`;
    else if (p === 3) h = `<div class="rc-ctlrow"><b>Hoist tests:</b> ${chk("slack", "slack rope -BG34", T.slack)} ${chk("overspeed", "overspeed -BG30/-KF33", T.overspeed)} ${chk("limHz", "upper final limit -BG37", !!T.limHz)} ${chk("over", "overload (shared)", sim.faults.overload)} ${btn("reset", "Reset -SF58", "primary")}</div><p class="rc-note">Each test opens a safety contact: the F-PLC switches STO on all crane drives and closes both hoist brakes. Reset is refused while the cause is present. Overload blocks lifting only (lowering stays allowed).</p>` + logTable();
    else if (p === 4) h = `<div class="rc-ctlrow"><b>Travel tests:</b> ${chk("limTr", "travel final limit -BG43", !!T.limTr)} ${btn("reset", "Reset -SF58", "primary")}</div><p class="rc-note">Watch the slow-down switches -BG40 / -BG41 actuate when the crane enters an end zone (the I/O end is a slow-down zone, too). The laser distance updates with the crane position.</p>` + logTable();
    else if (p === 5) h = esRow + `<div class="rc-ctlrow"><b>Door:</b> ${btn("req", "request entry -SF57")} ${btn("door", T.door.closed ? "open door" : "close door")} <span class="muted">${T.door.closed ? (T.door.locked ? "closed + locked" : "unlocked – may open") : "open"}</span> <b>Light curtain:</b> ${btn("person", "person walks in")} ${btn("reset", "Reset -SF58", "primary")}</div>` + faults + logTable();
    else if (p === 6) h = `<p class="rc-note">The LEDs follow the fork and the load of the twin crane. Fork centre must be ON before the crane may travel or lift – this interlock is in the PLC program and checked again in item 2.</p>` + faults;
    else if (p === 7) h = faults + `<p class="rc-note">Scanner fault: every crate is rejected at the ID point. Overload: the scale sees more than ${K.I.mL} kg. Jam: a photo-eye stays blocked.</p>`;
    else h = `<p class="rc-note">Static page – the heat balance and the 24 V budget follow the inputs of card C.</p>`;
    $("sr3Ctl").innerHTML = h;
  }
  function renderInfo() {
    const I = info(K), k = T.info, it = k && (I[k] || I[ALIAS[k]]);
    if (!it) { $("sr3Info").innerHTML = `<h3>Information</h3><p class="muted">Click a device in the drawing (e.g. the conductor rail, the brake resistor, the safe speed monitor, the light curtain) – here you see what it is, its rating, why it is there, what to check and how it typically fails.</p>`; return; }
    $("sr3Info").innerHTML = `<h3>${esc(it.t)}</h3><p>${esc(it.w)}</p><p><b>Rating (example):</b> ${esc(it.r)}</p><p><b>Why:</b> ${esc(it.y)}</p><p><b>Check:</b> ${esc(it.c)}</p><p><b>Typical failure:</b> ${esc(it.f)}</p>`;
  }

  /* ---------------- cards */
  const tbl = (head, rows) => `<tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>` + rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("");
  const INP = [["mL", "load (crate) kg", 1], ["mH", "carriage + fork kg", 1], ["mC", "moving mass crane kg", 1], ["vx", "travel speed m/s", 0.1], ["ax", "travel accel. m/s²", 0.05], ["vz", "hoist speed m/s", 0.1], ["az", "hoist accel. m/s²", 0.05], ["H", "lowering height m", 0.1],
    ["Lrail", "rail length m", 1], ["Lsup", "supply cable m", 1], ["dLC", "light curtain d mm", 1], ["tStop", "stopping time at I/O s", 0.01], ["Uon", "chopper on V", 10]];
  function renderInputs() {
    $("sr3Inp").innerHTML = INP.map(([k, t, st]) => `<label class="sr3-in">${esc(t)} <input type="number" step="${st}" data-srinp="${k}" value="${inp[k]}"></label>`).join("") +
      `<label class="sr3-in">feed <select data-srinp="feedType"><option value="rail"${inp.feedType === "rail" ? " selected" : ""}>conductor rail</option><option value="chain"${inp.feedType === "chain" ? " selected" : ""}>energy chain</option></select></label>` +
      `<label class="sr3-in">feed point <select data-srinp="feed"><option value="end"${inp.feed === "end" ? " selected" : ""}>I/O end</option><option value="centre"${inp.feed === "centre" ? " selected" : ""}>centre</option></select></label>` +
      `<label class="sr3-in"><input type="checkbox" data-srinp="regen"${inp.regen ? " checked" : ""}> active infeed (regenerative)</label> <button class="btn" data-sract="defaults">defaults</button>`;
  }
  function renderCalc() {
    const I = K.I, C = K.cur, M = K.sup, R = K.rail, B = K.brk, Sf = K.saf, Ht = K.heat;
    const rows = [
      ["<b>Travel force + power</b>", "F = m·a + m·g·w_r ; P = F·v / η", `(${K.tr.m} · ${I.ax} + ${K.tr.m} · 9.81 · ${I.wr}) · ${I.vx} / ${I.etaT}`, `F = ${f(K.tr.Facc + K.tr.Froll, 0)} N · P_pk = <b>${f(K.tr.Ppk / 1000, 2)} kW</b> → 2 × ${K.tr.Pmot} kW`],
      ["<b>Hoist power</b>", "P = m·(g + a)·v / η (lifting)", `${K.hz.mh} · (9.81 + ${I.az}) · ${I.vz} / ${I.etaH}`, `P_pk <b>${f(K.hz.Ppk / 1000, 2)} kW</b>, run ${f(K.hz.Prun / 1000, 2)} kW → ${K.hz.Pmot} kW motor`],
      ["<b>Fork power</b>", "P = (m·a + m·g·μ)·v / η", `${K.fk.mf} kg · ${I.af} m/s² + μ 0.05, η 0.8`, `${f(K.fk.P, 0)} W → ${K.fk.Pmot} kW`],
      ["<b>Crane peak current</b>", "I = P / (η_c·√3·U·λ) + I_aux", `(${f(K.tr.Ppk / 1000, 2)} + ${f(K.hz.Ppk / 1000, 2)}) kW / (${I.etaC} · √3 · ${I.U} · ${I.lam}) + ${f(C.Iaux, 2)}`, `I_pk = <b>${f(C.Ipk, 2)} A</b>`],
      ["<b>Crane thermal current</b>", "I_th = √(0.15·I_pk² + 0.35·I_run² + 0.5·I_aux²)", `I_run = ${f(C.Irun, 2)} A (constant travel + lifting)`, `<b>${f(C.Ith, 2)} A</b>`],
      ["<b>AS/RS supply current</b>", "I_b = I_th + I_conv + I_24V/misc", `${f(C.Ith, 2)} + ${f(C.Iconv, 2)} + ${f(C.Istat, 2)}`, `I_b = <b>${f(C.Ib, 2)} A</b> · peak ${f(C.IpkT, 2)} A`],
      ["<b>Fuse + supply cable</b>", "I_n ≥ I_b and ≥ I_pk/1.5 ; gG: 1.6·I_n ≤ 1.45·I_z ; I_z = I_tab·k_θ", `I_n ${M.In} A → I_z ≥ ${f(M.Izreq, 1)} A ; k_θ = ${I.kT} (40 °C)`, `gG <b>${M.In} A</b>, <b>5G${M.A}</b> (I_z ${f(M.Iz, 1)} A), -QB1 ${M.Q1} A`],
      ["<b>ΔU supply cable</b>", "ΔU = √3·I·L·(R cosφ + X sinφ)/U", `√3 · ${f(C.IpkT, 1)} · ${M.L} m · (R_70 of ${M.A} mm²)`, `<b>${f(M.dU, 2)} %</b>`],
      [R.type === "rail" ? "<b>Conductor rail</b>" : "<b>Energy chain cable</b>", R.type === "rail" ? "size ≥ 1.25·I_th and ≥ I_pk/1.5 ; ΔU with R', X' (datasheet)" : "chain cable: I_z·0.8 ≥ 1.25·I_th", R.type === "rail" ? `L = ${R.L} m (${I.feed === "centre" ? "centre feed: L/2" : "end feed"}), R' ${R.R} Ω/km, X' ${R.X} Ω/km` : `L = ${R.L} m (half travel + 10 m)`, R.type === "rail" ? `<b>${R.size} A</b> rail · ΔU <b>${f(R.dU, 2)} %</b>` : `<b>4G${R.size}</b> · ΔU ${f(R.dU, 2)} %`],
      ["<b>Total voltage drop</b>", "ΔU_cable + ΔU_rail at peak current", `${f(M.dU, 2)} + ${f(R.dU, 2)}`, `<b>${f(K.dUtot, 2)} %</b> ${K.dUtot <= 5 ? "≤ 5 % ✓" : "> 5 % ✗ – bigger cable / centre feed"}`],
      ["<b>Energy per hoist lowering</b>", "E = m·g·h·η", `${K.hz.mh} · 9.81 · ${I.H} · ${I.etaH}`, `E_pot ${f(B.Epot / 1000, 1)} kJ → <b>${f(B.Elow / 1000, 1)} kJ</b> into the DC link`],
      ["<b>Peak braking power</b>", "P = m_h·(g+a)·v·η + (m·a − F_roll)·v·η", `${f(K.hz.PlowDec / 1000, 2)} + ${f(K.tr.Pbrk / 1000, 2)} kW`, `<b>${f(B.Pbrk / 1000, 2)} kW</b>`],
      ["<b>Brake resistor</b>", "R ≤ U_on² / (1.2·P_brk) ; P_cont ≥ 1.25·E_cycle / t_cycle", `${I.Uon}² / (1.2 · ${f(B.Pbrk, 0)}) ; E_cycle ${f(B.Ecyc / 1000, 1)} kJ / ${I.tSC} s`, I.regen ? "active infeed – no resistor" : `<b>${B.R} Ω</b> (≤ ${f(B.Rmax, 1)}), peak ${f(B.PpkR / 1000, 1)} kW, <b>${B.Pcont} kW</b> cont.`],
      ["<b>Energy saved with an active infeed</b>", "E_cycle · jobs/h", `${f(B.Ecyc / 1000, 1)} kJ · ${I.jobsH} /h`, `${f(B.kWhH, 2)} kWh per hour of full operation · ≈ ${f(B.kWhY, 0)} kWh/year (4 000 h, 50 %)`],
      ["<b>24 V budget crane</b>", "I = Σ I_i ; PSU ≥ 1.25·I", `${K.v24.list.length} consumers`, `${f(K.v24.I, 2)} A → ${f(K.v24.Ires, 2)} A → <b>${K.v24.A} A PSU</b> (${K.v24.load} %)`],
      ["<b>Safety response time</b>", "T = t_LC + t_logic + t_STO + t_stop", `${I.tLC} + ${I.tLog} + ${I.tSTO} + ${I.tStop}`, `<b>${f(Sf.T, 3)} s</b>`],
      ["<b>Safety distance light curtain</b>", "S = 2000·T + 8·(d − 14); > 500 → 1600·T + C, min 500 mm (ISO 13855)", `2000 · ${f(Sf.T, 3)} + ${Sf.C} = ${f(Sf.S2000, 0)} ${Sf.S2000 > 500 ? `> 500 → 1600 · ${f(Sf.T, 3)} + ${Sf.C} = ${f(Sf.S1600, 0)}` : "≤ 500"}`, `<b>S = ${Sf.S} mm</b>`],
      ["<b>Door switch MTTF_D</b>", "MTTF_D = B10_D / (0.1·n_op)", `${K.pl.door.B10d.toExponential(0)} / (0.1 · ${K.pl.door.nop})`, `${f(K.pl.door.mttfd, 0)} years → capped at ${K.pl.door.cap} years (high)`],
      ["<b>Crane cabinet heat</b>", "P_wall = k·A·ΔT ; V̇ = 3.1·(P − P_wall)/ΔT", `${Ht.k} · ${f(Ht.Ae, 2)} m² · ${Ht.dT} K ; P = ${f(Ht.P, 0)} W`, `wall ${f(Ht.Pw, 0)} W · fan <b>${f(Ht.Vdot, 0)} m³/h</b> or cooling unit ${Ht.cool} W`],
    ];
    $("sr3Calc").innerHTML = tbl(["Check", "Formula", "Numbers", "Result"], rows);
    $("sr3Pl").innerHTML = tbl(["Safety function", "Subsystem", "PFH_D (1/h)", "Basis"], K.pl.sf.flatMap((s) => [...s.rows.map((r, i) => [i ? "" : `<b>${esc(s.n)}</b>`, esc(r[0]), r[1].toExponential(1), esc(r[2])]),
      ["", "<b>sum</b>", `<b>${s.sum.toExponential(2)}</b>`, `<b>PL ${s.pl}</b> (required PL ${s.plr}) ${s.ok ? "✓" : "✗"}`]]));
  }
  function renderBom() { $("sr3Bom").innerHTML = tbl(["Tag", "Description", "Rating (example)", "Example product family", "Qty"], bom(K).map((r) => [`<b>${esc(r[0])}</b>`, esc(r[1]), esc(r[2]), esc(r[3]), r[4]])); }
  function renderTest() { $("sr3Test").innerHTML = tbl(["#", "Test", "How", "Accept (example)", "Standard"], TESTS.map((r) => [r[0], `<b>${esc(r[1])}</b>`, esc(r[2]), esc(r[3]), esc(r[4])])); }
  function renderLegend() {
    const sym = (fn, w = 70, h = 56) => { const P = mkPen(0); fn(P); return `<svg class="ck-svg ck-mini" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${P.out()}</svg>`; };
    const L = [
      [(P) => P.contact(35, 8, { type: "NO" }), "NO contact (normally open)"], [(P) => P.contact(35, 8, { type: "NC" }), "NC contact (normally closed)"],
      [(P) => P.contact(35, 8, { type: "NO", act: true }), "actuated contact (live, highlighted)"], [(P) => P.contact(35, 8, { type: "NO", fn: "ctr" }), "contactor main contact"],
      [(P) => P.contact(35, 8, { type: "NO", fn: "brk" }), "circuit breaker (MCB / MCCB)"], [(P) => { P.contact(35, 8, { type: "NO", fn: "dis" }); P.link(18, 30, 28).act(18, 28, "turn"); }, "main switch / isolator"],
      [(P) => P.fuse(35, 8), "fuse"], [(P) => P.coil(35, 8), "relay / contactor coil"], [(P) => P.coil(35, 8, { kind: "safety" }), "safety contactor coil"],
      [(P) => P.coil(35, 8, { kind: "brake" }), "spring-applied brake (24 V)"], [(P) => P.coil(35, 8, { kind: "lock" }), "guard-locking solenoid"],
      [(P) => { P.contact(45, 8, { type: "NC" }); P.link(14, 40, 28).act(14, 28, "mush").forced(28, 28); }, "e-stop, NC with positive opening"],
      [(P) => { P.contact(45, 8, { type: "NC" }); P.link(24, 40, 28).act(24, 28, "pos").forced(32, 28); }, "limit switch, forced NC"],
      [(P) => { P.contact(45, 8, { type: "NO" }); P.link(22, 40, 28).act(22, 28, "push"); }, "push button (NO)"],
      [(P) => P.motor(35, 28, 18), "motor 3~"], [(P) => P.inv(12, 10, 46, 36), "inverter / infeed (= / ~)"], [(P) => P.res(35, 8), "resistor (brake resistor)"],
      [(P) => P.igbt(40, 8), "IGBT (brake chopper)"], [(P) => P.lamp(35, 8), "lamp"], [(P) => P.sens(15, 12, "prox"), "inductive sensor"], [(P) => P.sens(15, 12, "photo"), "light sensor / photo-eye"],
      [(P) => P.sens(15, 12, "laser"), "laser distance sensor"], [(P) => P.sens(15, 12, "bar"), "bar-code reader / positioning"], [(P) => P.sens(15, 12, "grid"), "light curtain / light grid"],
      [(P) => P.sens(15, 12, "cell"), "load cell"], [(P) => P.sens(15, 12, "enc"), "encoder"],
      [(P) => P.rail(20, 62, 16, ["L1", "PE"], { dy: 22 }), "conductor rail (enclosed)"], [(P) => P.raw(`<path d="M10,28 H60" class="sr-optic"/>`), "optical data link (DDLS)"],
      [(P) => P.pe(35, 8), "protective earth"], [(P) => P.t(8, 32, "/5.7", { s: 14, c: "ref" }), "cross-reference page.column"],
    ];
    const WC = [["L1 / L2 / L3", "brown / black / grey", "IEC 60445; inside the cabinet IEC 60204-1 recommends black", "L1"], ["N", "light blue", "never for anything else", "N"], ["PE", "green-yellow", "only for PE", "PE"],
      ["DC link", "black (thick in the drawing)", "dangerous: up to 750 V DC – wait for discharge", "DC"], ["24 V DC control", "dark blue", "IEC 60204-1: DC control circuits", "24"], ["PROFINET", "green cable", "shielded, 4-wire, M12 D-coded / RJ45", "bus"]];
    $("sr3Legend").innerHTML = `<div class="sr3-legend">${L.map(([fn, t]) => `<div class="sr3-legi">${sym(fn)}<span>${esc(t)}</span></div>`).join("")}</div>
      <div class="rb-grid2"><div><h3>Device letters (IEC 81346-2:2019, two-letter, project rule)</h3><div class="table-wrap"><table class="rb-tbl ck-tbl">${tbl(["Code", "Meaning (example)"], LETTERS.map((r) => [`<b>-${r[0]}</b>`, esc(r[1])]))}</table></div></div>
      <div><h3>Wire colours</h3><div class="table-wrap"><table class="rb-tbl ck-tbl">${tbl(["Conductor", "Colour", "Note", "In the drawing"], WC.map((r) => [esc(r[0]), esc(r[1]), esc(r[2]), `<svg width="60" height="12"><path d="M2,6 H58" class="ck-w ck-w-${r[3]}"/>${r[3] === "PE" ? '<path d="M2,6 H58" class="ck-w ck-w-PEy"/>' : ""}</svg>`]))}</table></div>
      <p class="rc-note">Tag format: <b>=LOG.ASRSRAW+CRN01-QA10:13</b> = function AS/RS raw, location crane cabinet, device QA10, terminal 13. The robot pages (guide 24) still use single letters – this project uses two-letter codes (guide 15 §17.3). Cross-reference <b>/5.7</b> = page 5, column 7.</p></div></div>`;
  }
  function renderCards() { renderCalc(); renderBom(); renderTest(); }
  function recalc() { K = calc(inp); fullPass(); renderCards(); lastKey = ""; render(true); }

  /* ---------------- events */
  $("sr3Sheet").addEventListener("click", (e) => { const h = e.target.closest("[data-ck]"); if (h) { T.info = h.dataset.ck; renderInfo(); } });
  wrap.addEventListener("click", (e) => {
    const pg = e.target.closest("[data-srpg]"); if (pg) { T.page = +pg.dataset.srpg; render(true); return; }
    const a = e.target.closest("[data-sract]");
    if (a) {
      const [k, v] = a.dataset.sract.split(":");
      if (k === "es") act.es(v); else if (k === "q1") T.q1 = !T.q1; else if (k === "qb2") T.qb2 = !T.qb2; else if (k === "qb10") T.qb10 = !T.qb10;
      else if (k === "defaults") { inp = { ...DEF }; renderInputs(); recalc(); return; }
      else if (act[k]) act[k]();
      render(true); return;
    }
    const s = e.target.closest("[data-srseg]");
    if (s) { const n = s.dataset.srseg, v = s.dataset.v; if (n === "regen") inp.regen = v === "1"; else inp[n] = v; renderInputs(); recalc(); }
  });
  wrap.addEventListener("change", (e) => {
    const c = e.target.closest("[data-srchk]"); if (c) { act.toggle(c.dataset.srchk); render(true); return; }
    const i = e.target.closest("[data-srinp]");
    if (i) { const k = i.dataset.srinp; inp[k] = i.type === "checkbox" ? i.checked : i.tagName === "SELECT" ? i.value : (+i.value || DEF[k]); recalc(); }
  });
  $("sr3Es").addEventListener("click", () => { act.es("io"); render(true); });
  $("sr3Req").addEventListener("click", () => { act.req(); render(true); });
  $("sr3Door").addEventListener("click", () => { act.door(); render(true); });
  $("sr3Lc").addEventListener("click", () => { act.person(); render(true); });
  $("sr3Reset").addEventListener("click", () => { act.reset(); render(true); });

  /* ---------------- loop: 10 Hz like the sim clock, only while visible */
  let timer = 0;
  function tick() { if (!box.offsetParent) { stop(); return; } T.blink = Math.floor(performance.now() / 500) % 2 === 0; render(false); }
  function show() { if (!timer) { timer = setInterval(tick, 100); } render(true); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }

  /* ---------------- initial state from the URL */
  if (Q.has("sr3estop")) act.es("io");
  if (Q.has("sr3slack")) act.toggle("slack");
  if (Q.has("sr3over")) sim.setFault("overload", true);
  if (Q.has("sr3lc")) setTimeout(() => { act.person(); render(true); }, 200);
  if (Q.has("sr3door")) { act.req(); setTimeout(() => { act.door(); render(true); }, 1200); }
  renderInputs(); fullPass(); renderCards(); renderLegend(); render(true);
  try { makeCard(CARD, wrap, { card: "srCard3", q: "srQ3", g: "srG3", cnt: "srCnt3", buy: "srBuy3" }, "sr3"); } catch (e) { console.error(e); }
  if (Q.get("sr3card")) setTimeout(() => { const c = $({ calc: "sr3CardCalc", bom: "sr3CardBom", test: "sr3CardTest", legend: "sr3CardLegend", ref: "srCard3" }[Q.get("sr3card")]); if (c) c.scrollIntoView(); }, 400);
  if (Q.has("sr3test")) setTimeout(() => selfTest(), 600);
  if (Q.get("sr3svg")) setTimeout(() => exportSvg(), 300);
  if (Q.has("sr3back")) setTimeout(() => {
    const rep = (tag) => console.log(`SR3BACK ${tag} item3 hidden=${box.hidden} svg=${!!document.querySelector("#sr3Sheet svg")} timer=${!!timer} errors=${errs.length ? errs.join(" | ") : "none"}`);
    window.srCtl.showItem("1"); setTimeout(() => { rep("item1"); window.srCtl.showItem("2"); setTimeout(() => { rep("item2"); window.srCtl.showItem("4"); setTimeout(() => { rep("item4"); window.srCtl.showItem("3"); setTimeout(() => rep("item3 again"), 1500); }, 1500); }, 1500); }, 1500);
  }, 2500);

  /* ---------------- print SVG export (docs/img/33_*.svg) */
  function exportSvg() {
    fullPass();
    const S = state(true), out = [];
    for (let n = 1; n <= NPAGES; n++) {
      const body = draw(n, S).replace(/<rect[^>]*class="ck-hit"[^>]*>(<title>[^<]*<\/title>)?<\/rect>/g, "").replace(/<path[^>]*class="ck-flow[^"]*"[^>]*\/>/g, "");
      out.push(`=====PAGE ${n}=====\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}" height="${PH}" font-family="Arial, Helvetica, sans-serif"><style>${PRINT_CSS}</style>${body}</svg>`);
    }
    const ta = document.createElement("textarea"); ta.id = "sr3svgout"; ta.hidden = true; ta.textContent = out.join("\n"); document.body.appendChild(ta);
    console.log("SR3SVG pages=" + NPAGES + " chars=" + ta.textContent.length);
  }

  /* ---------------- self-check (&sr3test) */
  function selfTest() {
    const out = (s) => console.log("SR3TEST " + s);
    const k = calc(DEF);
    out(`travel: Froll=${k.tr.Froll}N Facc=${k.tr.Facc}N Ppk=${k.tr.Ppk}W Prun=${k.tr.Prun}W Pbrk=${k.tr.Pbrk}W motor=2x${k.tr.Pmot}kW`);
    out(`hoist: m=${k.hz.mh}kg Ppk=${k.hz.Ppk}W Prun=${k.hz.Prun}W Plow=${k.hz.Plow}W PlowDec=${k.hz.PlowDec}W motor=${k.hz.Pmot}kW fork=${k.fk.P}W/${k.fk.Pmot}kW`);
    out(`currents: Ipk=${k.cur.Ipk} Irun=${k.cur.Irun} Iaux=${k.cur.Iaux} Ith=${k.cur.Ith} Iconv=${k.cur.Iconv} Istat=${k.cur.Istat} Ib=${k.cur.Ib} IpkT=${k.cur.IpkT}`);
    out(`supply: gG${k.sup.In} Izreq=${k.sup.Izreq} A=${k.sup.A}mm2 Iz=${k.sup.Iz} dU=${k.sup.dU}% Q1=${k.sup.Q1}A`);
    out(`rail end: ${k.rail.size}A dU=${k.rail.dU}% total=${k.dUtot}%`);
    const kc = calc({ ...DEF, feed: "centre" }), kch = calc({ ...DEF, feedType: "chain" });
    out(`rail centre: ${kc.rail.size}A dU=${kc.rail.dU}% total=${kc.dUtot}% | chain: 4G${kch.rail.size} L=${kch.rail.L} Iz=${kch.rail.Iz} dU=${kch.rail.dU}%`);
    out(`braking: Epot=${k.brk.Epot}J Elow=${k.brk.Elow}J Pbrk=${k.brk.Pbrk}W Rmax=${k.brk.Rmax} R=${k.brk.R} PpkR=${k.brk.PpkR}W Etr=${k.brk.Etr}J Ecyc=${k.brk.Ecyc}J Pavg=${k.brk.Pavg}W Pcont=${k.brk.Pcont}kW kWh/h=${k.brk.kWhH} kWh/y=${k.brk.kWhY}`);
    out(`24V: I=${k.v24.I}A res=${k.v24.Ires}A PSU=${k.v24.A}A load=${k.v24.load}%`);
    out(`safety: T=${k.saf.T}s C=${k.saf.C} S2000=${k.saf.S2000} S1600=${k.saf.S1600} S=${k.saf.S}mm | d=14: ${calc({ ...DEF, dLC: 14 }).saf.S}mm | tStop=0.1: ${calc({ ...DEF, tStop: 0.1 }).saf.S}mm`);
    out(`PL: ${k.pl.sf.map((s) => s.sum.toExponential(2) + " PL" + s.pl + (s.ok ? " ok" : " NOK")).join(" | ")} door MTTFd=${k.pl.door.mttfd}`);
    out(`heat: Ae=${k.heat.Ae} P=${k.heat.P}W Pw=${k.heat.Pw}W Pnet=${k.heat.Pnet}W Vdot=${k.heat.Vdot} cool=${k.heat.cool}W`);
    out(`hand: Ipk=${f((9707 + 14555) / 0.97 / (Math.sqrt(3) * 400 * 0.9) + 1500 / (Math.sqrt(3) * 400), 2)} Elow=${f(1200 * 9.81 * 7.2 * 0.85, 0)} R=${f(750 ** 2 / (1.2 * 14803), 2)} S=${f(Math.max(500, 1600 * 0.264 + 128), 1)}`);
    // logic scenarios on the live twin (restored afterwards)
    const sc = (name, fn) => { fn(); const S = state(false); out(`logic ${name}: sto=${S.sto} estop=${S.estop} need=${S.need} door=${JSON.stringify(S.door)} convSto=${S.convSto} hoistTrip=${S.hoistTrip} craneFault=${sim.faults.crane} log0="${T.log[0] ? T.log[0].res : ""}"`); };
    sc("estop", () => act.es("io")); sc("reset while pressed", () => act.reset()); sc("release", () => act.es("io")); sc("reset", () => act.reset());
    sc("door pull while locked", () => act.door());
    sc("slack", () => act.toggle("slack")); sc("reset slack present", () => act.reset()); sc("slack repaired", () => act.toggle("slack")); sc("reset", () => act.reset());
    sc("travel limit", () => act.toggle("limTr")); sc("limit cleared+reset", () => { act.toggle("limTr"); act.reset(); });
    out(`refs: ${[...REG.entries()].map(([k2, v]) => k2 + "=" + v.map((e) => e.p + "." + e.c).join(",")).join(" ")}`);
    out(`card: ${$("srCard3") ? "ok" : "missing"} drawings=${CARD.drawings.length} groups=${CARD.groups.length} rows=${CARD.groups.reduce((s, g) => s + g.rows.length, 0)}`);
    out(`errors=${errs.length ? errs.join(" | ") : "none"}`);
    out("DONE");
    render(true);
  }
  return { show, hide: stop, T, calc: () => K };
}

const PRINT_CSS = `text{font-family:Arial,Helvetica,sans-serif;font-size:11px;fill:#000}.ck-mut{fill:#333}.ck-ref,.ck-bad,.ck-warnTx{fill:#1a56b0}.ck-ok{fill:#000}.ck-b{font-weight:700}
.sr-page{fill:#fff}.ck-frame{fill:none;stroke:#000;stroke-width:1.4}.ck-frame2{fill:none;stroke:#000;stroke-width:.8}
.ck-sym{stroke:#000;fill:none;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}.ck-fill,.ck-bg{fill:#fff}.ck-fillt{fill:#000}.ck-estop{fill:#1a56b0;stroke:#000}
.ck-dot{fill:#000}.ck-term{fill:#fff;stroke:#000;stroke-width:1.2}.ck-mech{fill:none;stroke:#000;stroke-width:1;stroke-dasharray:4 3}
.ck-box{fill:none;stroke:#000;stroke-width:1.2}.ck-dash{stroke-dasharray:6 4}.ck-note{fill:#f3f5f9;stroke:#9aa3b0}.ck-plate{fill:#f0f0f0;stroke:#555}.ck-boxon,.ck-boxbad,.sr-boxregen{fill:none}
.ck-thin{fill:none;stroke:#000;stroke-width:1}.ck-led{fill:#fff;stroke:#000;stroke-width:1}
.ck-w{fill:none;stroke:#000;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round}.ck-w-N{stroke-dasharray:10 3}.ck-w-PE{stroke-width:2.2}.ck-w-PEy{stroke:#fff;stroke-width:1.2;stroke-dasharray:6 6}
.ck-w-DC{stroke-width:2.6}.ck-w-24,.ck-w-sig,.ck-w-0V{stroke:#1a56b0}.ck-w-0Vs{stroke:#fff;stroke-width:1;stroke-dasharray:6 6}.ck-w-bus{stroke:#1a56b0;stroke-width:3}.ck-dead{opacity:1}
.ck-pebar{fill:#000}.ck-shield{fill:none;stroke:#000;stroke-width:1;stroke-dasharray:3 2}.ck-vline{fill:none;stroke:#1a56b0;stroke-width:2}.ck-duct{fill:#e6e6e6;stroke:#777;stroke-width:.8}.ck-dev{fill:#fff;stroke:#000;stroke-width:1.1}.ck-gland{fill:#eee;stroke:#000}
.sr-fill,.sr-arr,.sr-arrp,.sr-arrg{fill:#000}.sr-arrg{fill:#1a56b0}.sr-parrow{fill:none;stroke:#000;stroke-width:2}.sr-dash{stroke-dasharray:4 3}.sr-railc{fill:#fff;stroke:#000;stroke-width:1}.sr-railpe{fill:#ccc}
.sr-railhouse{fill:none;stroke:#000;stroke-width:1;stroke-dasharray:2 2}.sr-trolley{fill:none}.sr-coll{fill:#1a56b0;stroke:#000}.sr-collon{fill:#1a56b0}.sr-trough{fill:#eee;stroke:#000}.sr-chain{fill:none;stroke:#000;stroke-width:6;stroke-dasharray:6 3}
.sr-dotlive{fill:#1a56b0}.sr-rope{fill:none;stroke:#000;stroke-width:1.4}.sr-zone{fill:#e8eef8;stroke:none}.sr-buffer{fill:#999;stroke:#000}.sr-railline{fill:none;stroke:#000;stroke-width:3}
.sr-laser{fill:none;stroke:#1a56b0;stroke-width:1.4;stroke-dasharray:6 3}.sr-refl{fill:#1a56b0}.sr-optic{fill:none;stroke:#1a56b0;stroke-width:3;stroke-dasharray:3 4}.sr-zonebox{fill:#fff;stroke:#000;stroke-width:1}.sr-occ{fill:#cfdcf0}.sr-jam{fill:#fff}.sr-mount{fill:#555}`;

/* ------------------------------------------------------------------ lazy build on the first show of item 3 */
const box = $("srItem3");
let UI = null, tried = false;
function onShow(n) {
  if (!box) return;
  if (String(n) !== "3") { if (UI) UI.hide(); return; }
  if (!window.srCtl || !window.srCtl.tabVisible()) return;
  if (!tried) { tried = true; try { UI = build(box); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="rc-bad">Item 3 could not start: ${esc(e.message)}</p></div>`; } }
  if (UI) UI.show();
}
window.addEventListener("sritemshow", (e) => onShow(e.detail));
if (window.srCtl && window.srCtl.current() === "3" && window.srCtl.tabVisible()) onShow("3");
window.srCkt = { ui: () => UI };
