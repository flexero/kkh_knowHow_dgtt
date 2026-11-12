/* Installation tab – items 1 + 2 (builder A): entry module, lazy build on "initemshow".
 * Files: instmech_calc.js (all numbers) · instmech_ui.js (helpers) · instmech_i1.js (item 1) · instmech_i2.js (item 2) · instmech.css.
 * Guide: docs/26_installation_foundation_alignment.md.
 * URL params (tests + deep links), e.g. /?initem=2&imcard=sim#inst
 *   &imcard=floor|block|mount|vib|lim|plan|ask (item 1) · inst|proc|sim|align|geo|pos|ask2 (item 2) → scroll to a card
 *   &iminfo=grout|joint|anchor|… (item 1 drawing) or lvl|laser|ballbar|… (item 2 instruments) → open an info box
 *   &imsrc=press,-20,-22;pcomp,-30,-24 → vibration sources on the floor plan (type,x,y; types press pcomp scomp fork hammer)
 *   &imseed=N → random installed state of the levelling simulator · &imsolve → apply the hint steps until levelled
 *   &imtest → self-check lines "IMTEST1 / IMTEST2" in the console · &imhold → keep the load event pending (headless screenshots)
 *   &imback → switch 1 → 2 → 3 → 1 and log errors ("IMBACK")
 * Offline, no libraries. All values are EXAMPLES – the machine maker's installation manual decides. */
import { buildItem1 } from "./instmech_i1.js";
import { buildItem2 } from "./instmech_i2.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
// test only (&imhold): a hidden iframe on the never-ending SSE stream keeps the load event pending, so headless screenshots wait for --timeout
if (Q.has("imhold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?imhold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr); setTimeout(() => { if (typeof window.showTab === "function") window.showTab("inst"); else { const b = document.querySelector('[data-tab="inst"]'); if (b) b.click(); } }, 300); }

const CARDS = { floor: "imFloor", block: "imBlock", mount: "imMount", vib: "imVib", lim: "imLimits", plan: "imPlan", ask: "imAsk",
  inst: "imInst", proc: "imProc", sim: "imSim", align: "imAlign", geo: "imGeo", pos: "imPos", ask2: "imAsk2" };
const UI = {}, tried = {};
function build(n) {
  const box = $("inItem" + n); if (!box || tried[n]) return; tried[n] = true;
  try { UI[n] = n === "1" ? buildItem1(box) : buildItem2(box); }
  catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="im-bt">Item ${n} could not start: ${String(e.message).replace(/</g, "&lt;")}</p></div>`; }
  const c = Q.get("imcard");
  if (c && CARDS[c] && box.querySelector("#" + CARDS[c])) setTimeout(() => $(CARDS[c]).scrollIntoView({ block: "start" }), 120);
}
function onShow(n) { n = String(n); if (n === "1" || n === "2") build(n); }
window.addEventListener("initemshow", (e) => onShow(e.detail));
if (window.inCtl) onShow(window.inCtl.current()); else if ($("inItem1") && !$("inItem1").hidden) onShow("1");
window.imCtl = { ui: () => UI };

if (Q.has("imback")) setTimeout(() => {
  const L = (s) => console.log("IMBACK " + s);
  const c = window.inCtl; if (!c) { L("no inCtl"); return; }
  c.showItem("1"); setTimeout(() => { L(`item1 visible=${!$("inItem1").hidden} built=${$("inItem1").children.length} errors=${errs.join(" | ") || "none"}`);
    c.showItem("2"); setTimeout(() => { L(`item2 visible=${!$("inItem2").hidden} built=${$("inItem2").children.length} item1 hidden=${$("inItem1").hidden} errors=${errs.join(" | ") || "none"}`);
      c.showItem("3"); setTimeout(() => { L(`item3 visible=${!$("inItem3").hidden} children=${$("inItem3").children.length} errors=${errs.join(" | ") || "none"}`);
        c.showItem("1"); setTimeout(() => L(`item1 again visible=${!$("inItem1").hidden} plan svg=${!!$("imPlanSvg")} errors=${errs.join(" | ") || "none"}`), 300); }, 400); }, 400); }, 400);
}, 800);
