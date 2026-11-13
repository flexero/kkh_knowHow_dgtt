/* AS/RS tab – item switch (shared by asrs3d.js, asrsctl.js, asrsckt.js, asrswms.js).
 * Each item module listens to window event "sritemshow" (detail = "1".."5") and builds its item lazily
 * the first time it becomes visible. Deep link: /?sritem=3#asrs  (also works before the modules load:
 * modules check window.srCtl.current() at load). */
const $ = (id) => document.getElementById(id);
let current = "1";
function showItem(n) {
  n = String(n); current = n;
  document.querySelectorAll("[data-sritem]").forEach((b) => b.classList.toggle("active", b.dataset.sritem === n));
  [...document.querySelectorAll("[data-sritem]")].map((b) => b.dataset.sritem).forEach((i) => {
    const el = $("srItem" + i), it = $("srIntro" + i); if (el) el.hidden = i !== n; if (it) it.hidden = i !== n; });
  window.dispatchEvent(new Event("resize"));
  window.dispatchEvent(new CustomEvent("sritemshow", { detail: n }));
}
document.querySelectorAll("[data-sritem]").forEach((b) => b.addEventListener("click", () => { if (!b.disabled) showItem(b.dataset.sritem); }));
const tabVisible = () => { const p = $("tab-asrs"); return !!(p && p.classList.contains("active")); };
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "asrs") window.dispatchEvent(new CustomEvent("sritemshow", { detail: current })); };
window.srCtl = { showItem, current: () => current, tabVisible };
const Q = new URLSearchParams(location.search);
if (Q.get("sritem") && Q.get("sritem") !== "1") showItem(Q.get("sritem"));
