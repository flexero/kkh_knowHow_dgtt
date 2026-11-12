/* Hydraulics tab – item switch (shared by hydlib.js, hydckt.js).
 * Each item module listens to window event "hyitemshow" (detail = "1".."5") and builds its item lazily
 * the first time it becomes visible. Deep link: /?hyitem=3#hyd  (also works before the modules load:
 * modules check window.hyCtl.current() at load). */
const $ = (id) => document.getElementById(id);
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-hyitem]").forEach((b) => b.classList.toggle("active", b.dataset.hyitem === n));
  [...document.querySelectorAll("[data-hyitem]")].map((b) => b.dataset.hyitem).forEach((i) => {
    const el = $("hyItem" + i), it = $("hyIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new CustomEvent("hyitemshow", { detail: n }));
}
document.querySelectorAll("[data-hyitem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.hyitem); }));
const tabVisible = () => { const p = $("tab-hyd"); return !!(p && p.classList.contains("active")); };
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "hyd") window.dispatchEvent(new CustomEvent("hyitemshow", { detail: current })); };
window.hyCtl = { showItem, current: () => current, tabVisible };
const Q = new URLSearchParams(location.search);
if (Q.get("hyitem") && Q.get("hyitem") !== "1") showItem(Q.get("hyitem"));
