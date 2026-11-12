/* INSTALLATION tab – items 3 + 4 (builder B): entry module. Builds each item lazily on the first "initemshow" event (inst.js).
 * Files: instelec_calc.js (numbers) · instelec_ui.js (helpers) · instelec_i3.js (item 3 electrical installation) · instelec_i4.js (item 4 EMC) · instelec.css
 * Guide: docs/27_installation_electrical_emc.md
 * URL (deep links + tests), all with /?initem=3#inst or /?initem=4#inst:
 *   item 3: &ieinfo=T1|Q0|MET|MDB|SPD1|Q1|W1|Q10|SD|SPD2|Q2|COMP|Q3|Q4|Qb:HMC-01|Wb:HMC-01|Lb:HMC-01 · &iem=HMC-02 · &iefeed=bus · &iet=40 · &ieks=0.8 · &ietrafo
 *   item 4: &ietray=bad|good|nodiv · &iefault=pigtail|tray|ferrite|peloop|zero|net|analog · &iefix
 *   both:   &iecard=sld|calc|work|prot|rcd|pq|earth|conn|test|ask|noise|seg|shield|signal|sim|trouble (scroll to a card)
 *           &ietest (self-check lines "IETEST ok/FAIL …" in the console and in <pre id="ieTestOut" hidden>) · &ieback (item switch test)
 *           &iehold (test only: keeps the load event pending so headless screenshots wait for --timeout)
 * Offline, no libraries. All values are EXAMPLES – the real design and tests are made by a qualified electrician.
 */
import { $, Q, esc, tlog } from "./instelec_ui.js";
import { calcLine, harmonics, noise, unbalance, bestTap, leakage, loop420, drop24, checkTray, TRAY_PRESETS } from "./instelec_calc.js";
import { build3 } from "./instelec_i3.js";
import { build4 } from "./instelec_i4.js";

const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
if (Q.has("iehold")) {
  const fr = document.createElement("iframe"); fr.src = "/api/stream?iehold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr);
  setTimeout(() => { if (typeof window.showTab === "function" && location.hash === "#inst") window.showTab("inst"); }, 300);
}

const UI = { 3: null, 4: null }, tried = { 3: false, 4: false };
const BUILD = { 3: build3, 4: build4 };
const CARDS = { sld: "ieCardSld", calc: "ieCardCalc", work: "ieCardWork", prot: "ieCardProt", rcd: "ieCardRcd", pq: "ieCardPq", earth: "ieCardEarth", conn: "ieCardConn", test: "ieCardTest", ask: "ieCardAsk",
  noise: "ieCardNoise", seg: "ieCardSeg", shield: "ieCardShield", signal: "ieCardSignal", sim: "ieCardSim", trouble: "ieCardTrouble" };
let scrolled = false;
function onShow(n) {
  n = String(n);
  if (UI[4] && n !== "4") UI[4].hide();
  if (n !== "3" && n !== "4") return;
  const box = $("inItem" + n); if (!box) return;
  if (!tried[n]) {
    tried[n] = true;
    try { UI[n] = BUILD[n](box); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="ie-bad">Item ${n} could not start: ${esc(e.message)}</p></div>`; }
  }
  if (n === "4" && UI[4]) UI[4].show();
  const c = Q.get("iecard");
  if (c && CARDS[c] && !scrolled && $(CARDS[c])) { scrolled = true; setTimeout(() => $(CARDS[c]).scrollIntoView({ block: "start" }), 150); }
}
window.addEventListener("initemshow", (e) => onShow(e.detail));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name !== "inst" && UI[4]) UI[4].hide(); };
if (window.inCtl && (window.inCtl.current() === "3" || window.inCtl.current() === "4")) onShow(window.inCtl.current());
window.ieCtl = { ui: (n) => UI[n] };

/* ------------------------------------------------------------------ self-check (&ietest): hand-checked numbers of the guide */
function selfTest() {
  const R = calcLine();
  const h = R.br.find((b) => b.id === "HMC-01"), v = R.br.find((b) => b.id === "VMC-01");
  tlog("source X (MV + trafo) mΩ", R.src.X, 9.8021, 0.001);
  tlog("Ik3 at MDB kA", R.mdb.Ik3 / 1000, 24.37, 0.02);
  tlog("line S_d = 0.6 × 213 kVA", R.line.Sd, 127.8, 0.01);
  tlog("line I_b A", R.line.Ib, 184.5, 0.1);
  tlog("feeder breaker A", R.feed.In, 200);
  tlog("feeder cable mm²", R.feed.A, 95);
  tlog("feeder I_z = 298 × 0.96 × 0.82", R.feed.Iz, 234.6, 0.1);
  tlog("feeder ΔU %", R.feed.dU, 1.235, 0.003);
  tlog("Ik3 at SD-ML1 kA", R.sd.Ik3 / 1000, 12.28, 0.02);
  tlog("HMC-01 I_b = 45000/(√3·400)", h.Ib, 64.95, 0.01);
  tlog("HMC-01 breaker A", h.In, 80);
  tlog("HMC-01 cable mm²", h.A, 25);
  tlog("HMC-01 I_z = 127 × 0.96 × 0.73", h.Iz, 89.0, 0.1);
  tlog("HMC-01 ΔU branch %", h.dUb, 0.622, 0.002);
  tlog("HMC-01 ΔU total %", h.dUt, 1.857, 0.003);
  tlog("HMC-01 Ik3 kA", h.Ik3 / 1000, 6.815, 0.01);
  tlog("HMC-01 Z_s mΩ", h.Zs, 95.3, 0.2);
  tlog("HMC-01 Ik1 A", h.Ik1, 2302, 5);
  tlog("HMC-01 trips instantly (Ik1 ≥ 960 A)", h.discOk, true);
  tlog("VMC-01 I_b A", v.Ib, 43.30, 0.01);
  tlog("VMC-01 cable mm²", v.A, 10);
  tlog("all branches OK with defaults", R.br.every((b) => b.ok), true);
  tlog("selectivity (LSI) OK", R.sel.ok, true);
  const Rtm = calcLine({ feedTrip: "TM" }); tlog("selectivity thermal-magnetic → not full", Rtm.sel.ok, false);
  const Rtr = calcLine({ trafoMach: true }); const ht = Rtr.br[0]; tlog("input transformer: HMC-01 MCCB Im = 14·In", ht.brk.Im, 1120); tlog("input transformer: inrush 12×I_b < 0.8·Im", ht.inrOk, true);
  const Rb = calcLine({ feedType: "bus" }); tlog("busbar feeder rating A", Rb.feed.rating, 250);
  tlog("MDB peak ip kA", R.mdb.ip / 1e3, 55.1, 0.3); tlog("MDB Icu kA (peak check: 2.1·25 = 52.5 < ip → 36)", R.mdbIcu, 36);
  const H = harmonics("reactor", 286.5, R.src.X); tlog("THDi with 3–4 % reactor %", H.THDi, 36.7, 0.1); tlog("THDu % (286.5 kW = card E default)", H.THDu, 4.03, 0.03); tlog("true PF", H.PF, 0.911, 0.002);
  const H0 = harmonics("none", 286.5, R.src.X); tlog("THDu without reactor > 5 %", H0.THDu > 5, true);
  const N = noise(); tlog("dv/dt kV/µs", N.dvdt_kVus, 2.825, 0.001); tlog("I_cm A", N.Icm, 16.95, 0.01); tlog("M nH", N.M_nH, 190.6, 0.2); tlog("U induced V", N.Uind, 16.15, 0.05);
  tlog("pigtail 50 mm @ 10 MHz Ω", N.Zpig, 3.14, 0.01); tlog("critical length m", N.lc, 15, 0.01); tlog("peak at motor V", N.Upk, 1045, 1);
  tlog("unbalance 402/398/405 %", unbalance(402, 398, 405).pct, 0.91, 0.01);
  tlog("best tap at 408 V", bestTap(408).best.tap, 415);
  tlog("leakage 3×6+10 mA", leakage(3, 6, 10).I, 28); tlog("RCD I_Δn needed → 100 mA", leakage(3, 6, 10).rcd, 100);
  tlog("4–20 mA max length m", loop420().Lmax, 4916, 2); tlog("24 V drop 2 A 30 m 0.75 mm² V", drop24().dU, 2.857, 0.002);
  tlog("tray 'bad' fails", checkTray(TRAY_PRESETS.bad.pos, TRAY_PRESETS.bad.div).fails.length > 3, true);
  tlog("tray 'good' (divider) fails", checkTray(TRAY_PRESETS.good.pos, TRAY_PRESETS.good.div).fails.length, 0);
  tlog("tray 'nodiv' (distance) fails", checkTray(TRAY_PRESETS.nodiv.pos, TRAY_PRESETS.nodiv.div).fails.length, 0);
  tlog("tray 'good' without its divider fails", checkTray(TRAY_PRESETS.good.pos, []).fails.length > 0, true);
  const n = window.inCtl ? window.inCtl.current() : "?";
  const click = (sel) => { const el = document.querySelector(sel); if (el) el.dispatchEvent(new MouseEvent("click", { bubbles: true })); return !!el; };
  const change = (id, v) => { const el = $(id); if (el) { el.value = v; el.dispatchEvent(new Event("change", { bubbles: true })); } return !!el; };
  if (UI[3]) {
    tlog("item 3 DOM: SLD has 7 machines", document.querySelectorAll("#ieSld [data-ie^='Lb:']").length, 7); tlog("item 3 DOM: test rows", document.querySelectorAll("#ieTest tbody tr").length, 18);
    click("#ieSld [data-ie='Q1']"); tlog("item 3 click -Q1 → info box", ($("ieInfo3").textContent.match(/-Q1 feeder breaker/) || [""])[0], "-Q1 feeder breaker");
    click("#ieSld [data-ie='Lb:VMC-01']"); tlog("item 3 click VMC-01 → selected", UI[3].S.selM, "VMC-01");
    change("ieKs", "0.8"); tlog("item 3 k_s 0.8 → S_d kVA", UI[3].R().line.Sd, 170.4, 0.01); change("ieKs", "0.6");
    click("[data-ieact='tickall']"); tlog("item 3 tick all → 18/18 passed", ($("ieTest").textContent.match(/(\d+) \/ 18 steps/) || [0, 0])[1], "18"); click("[data-ieact='untick']");
    click("#ieSld [data-ie='Lb:HMC-01']");
  }
  if (UI[4]) {
    tlog("item 4 DOM: 7 faults", document.querySelectorAll("[data-iefault]").length, 7); const c = $("ieScope"); tlog("item 4 scope canvas width > 300", c && c.width > 300, true);
    click("[data-tpre='good']"); tlog("item 4 preset good → fails", UI[4].checkTray().fails.length, 0);
    click("[data-tdiv='4']"); tlog("item 4 remove divider → fails > 0", UI[4].checkTray().fails.length > 0, true);
    click("[data-tslot='3']"); tlog("item 4 take MX out of the tray", UI[4].S.tray.pos.MX == null && UI[4].S.tray.selC === "MX", true);
    click("[data-tslot='11']"); tlog("item 4 place MX in slot 12", UI[4].S.tray.pos.MX, 11);
    click("[data-iefault='net']"); tlog("item 4 fault 'net' → info", /Network dropouts/.test($("ieSimInfo").textContent), true);
    click("#ieFixBtn"); tlog("item 4 apply fix", UI[4].S.fix, true);
    click("[data-tpre='bad']"); click("[data-iefault='pigtail']");
  }
  tlog("console errors so far (item " + n + ")", errs.length, 0);
}
if (Q.has("ietest")) setTimeout(selfTest, 1200);
if (Q.has("ieback")) {
  setTimeout(async () => {
    const w = (ms) => new Promise((r) => setTimeout(r, ms));
    const seq = ["3", "4", "1", "2", "5", "3", "4"];
    for (const s of seq) { if (window.inCtl) window.inCtl.showItem(s); await w(400); }
    const c = $("ieScope");
    tlog("ieback: item 3 built", !!UI[3], true); tlog("ieback: item 4 built", !!UI[4], true);
    tlog("ieback: scope visible + sized", !!(c && c.offsetParent && c.width > 300), true);
    tlog("ieback: errors", errs.length, 0);
    if (errs.length) tlog("ieback: first error", errs[0], "");
  }, 1500);
}
