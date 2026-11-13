/* Ball screw + linear guide factory tab – item switch (shared by the bsf*.js item modules).
 * Each item module listens to window event "bfitemshow" (detail = "1".."5") and builds its item lazily
 * the first time it becomes visible. Deep link: /?bfitem=3#bsf  (also works before the modules load:
 * modules check window.bfCtl.current() at load). */
const $ = (id) => document.getElementById(id);
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-bfitem]").forEach((b) => b.classList.toggle("active", b.dataset.bfitem === n));
  [...document.querySelectorAll("[data-bfitem]")].map((b) => b.dataset.bfitem).forEach((i) => {
    const el = $("bfItem" + i), it = $("bfIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new CustomEvent("bfitemshow", { detail: n }));
}
document.querySelectorAll("[data-bfitem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.bfitem); }));
const tabVisible = () => { const p = $("tab-bsf"); return !!(p && p.classList.contains("active")); };
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "bsf") window.dispatchEvent(new CustomEvent("bfitemshow", { detail: current })); };
window.bfCtl = { showItem, current: () => current, tabVisible };
const Q = new URLSearchParams(location.search);
if (Q.get("bfitem") && Q.get("bfitem") !== "1") showItem(Q.get("bfitem"));
