/* Installation tab – item switch (shared by instmech.js, instelec.js, instseq.js).
 * Each item module listens to window event "initemshow" (detail = "1".."5") and builds its item lazily
 * the first time it becomes visible. Deep link: /?initem=3#inst  (also works before the modules load:
 * modules check window.inCtl.current() at load). */
const $ = (id) => document.getElementById(id);
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-initem]").forEach((b) => b.classList.toggle("active", b.dataset.initem === n));
  [...document.querySelectorAll("[data-initem]")].map((b) => b.dataset.initem).forEach((i) => {
    const el = $("inItem" + i), it = $("inIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new CustomEvent("initemshow", { detail: n }));
}
document.querySelectorAll("[data-initem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.initem); }));
const tabVisible = () => { const p = $("tab-inst"); return !!(p && p.classList.contains("active")); };
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "inst") window.dispatchEvent(new CustomEvent("initemshow", { detail: current })); };
window.inCtl = { showItem, current: () => current, tabVisible };
const Q = new URLSearchParams(location.search);
if (Q.get("initem") && Q.get("initem") !== "1") showItem(Q.get("initem"));
