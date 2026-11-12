// Theme switch: Auto (follow Windows) / Light / Dark.  Offline, no libraries.
// Loaded in <head> (not a module) so the page never flashes the wrong theme.
// - Choice saved per PC in localStorage "twin.theme".
// - Sets <html data-theme="light|dark"> (no attribute = Auto, CSS follows the OS).
// - Fires window event "themechange" {detail:{dark}} after every change.
// - 3D views call dtTheme.scene(scene, lightBg?, darkBg?) so their background follows the theme.
(function () {
  const KEY = "twin.theme";
  const MODES = ["auto", "light", "dark"];
  const LABEL = { auto: "◐ Auto", light: "☀ Light", dark: "☾ Dark" };
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const scenes = [];   // {scene, light, dark}
  const floors = [];   // {mat, light, dark}  floor materials of 3D views
  let mode = "auto";
  try { mode = localStorage.getItem(KEY) || "auto"; } catch (e) { /* storage blocked */ }
  const q = new URLSearchParams(location.search).get("theme");   // deep link ?theme=dark
  if (MODES.includes(q)) mode = q;
  if (!MODES.includes(mode)) mode = "auto";

  function isDark() {
    if (mode === "dark") return true;
    if (mode === "light") return false;
    return !!(mq && mq.matches);
  }
  function cssVar(name, fb) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb;
  }
  function paintScene(s) {
    const bg = s.light == null ? cssVar("--surface-2", "#f2f1ed") : (isDark() ? s.dark : s.light);
    try {
      if (s.scene.background && s.scene.background.set) s.scene.background.set(bg);
      if (s.scene.fog && s.scene.fog.color) s.scene.fog.color.set(bg);
    } catch (e) { /* scene disposed */ }
  }
  function paintFloor(f) {
    try { f.mat.color.set(isDark() ? f.dark : f.light); } catch (e) { /* material disposed */ }
  }
  function apply() {
    const html = document.documentElement;
    if (mode === "auto") html.removeAttribute("data-theme"); else html.setAttribute("data-theme", mode);
    const btn = document.getElementById("themeBtn");
    if (btn) {
      btn.textContent = LABEL[mode];
      btn.title = "Colour theme: " + mode + " (click to change: Auto → Light → Dark)";
    }
    scenes.forEach(paintScene);
    floors.forEach(paintFloor);
    window.dispatchEvent(new CustomEvent("themechange", { detail: { dark: isDark(), mode } }));
  }
  function set(m) {
    mode = MODES.includes(m) ? m : "auto";
    try { localStorage.setItem(KEY, mode); } catch (e) { /* storage blocked */ }
    apply();
  }
  function addButton() {
    if (document.getElementById("themeBtn")) return;
    const host = document.querySelector(".topbar .controls");
    if (!host) return;
    const b = document.createElement("button");
    b.id = "themeBtn"; b.type = "button"; b.className = "btn ghost";
    b.addEventListener("click", () => set(MODES[(MODES.indexOf(mode) + 1) % MODES.length]));
    host.appendChild(b);
    apply();
  }

  window.dtTheme = {
    get mode() { return mode; },
    isDark, set,
    // Register a THREE.Scene. No colours given = use CSS --surface-2 (same as the cards).
    scene(scene, light, dark) {
      if (!scene) return;
      const s = { scene, light: light == null ? null : light, dark: dark == null ? light : dark };
      scenes.push(s); paintScene(s);
    },
    // Register a floor material (light concrete in Light, dark concrete in Dark).
    floor(mat, dark) {
      if (!mat || !mat.color || floors.some((f) => f.mat === mat)) return;
      const f = { mat, light: "#" + mat.color.getHexString(), dark: dark || "#3a3e42" };
      floors.push(f); paintFloor(f);
    },
  };

  apply();   // set data-theme before first paint
  if (mq) {
    const onOS = () => { if (mode === "auto") apply(); };
    if (mq.addEventListener) mq.addEventListener("change", onOS); else if (mq.addListener) mq.addListener(onOS);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton);
  else addButton();
})();
