/* AS/RS item 1 – 3D view: renderer, camera views, follow crane, explode, picking (parts + slots), info box, dimension labels.
 *   createASRS3D(el, A, opts) → { resize, setView, explode, dims, counts, select, pickSlot, dispose }
 * A = window.ASRS (shared core). opts: { getMode(), parts, dims, view, ex, pick, slot }.  Offline: local three.js + view3d.js.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { RACK, CRANE, SKU } from "./asrscore.js";
import { buildScene, makeMats, IOY, RAIL, X_END } from "./asrs3d_scene.js";
import { calcAll } from "./asrs3d_calc.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ease = (t) => t * t * (3 - 2 * t);
const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const W = (x, y, z, out = new THREE.Vector3()) => out.set(x, z, -y);     // core (x, y, z-up) → three world

function makeEnv(renderer) {
  const es = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
  const geo = new THREE.SphereGeometry(10, 32, 16), col = [], pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10, c = new THREE.Color().setHSL(0.58, 0.08, y > 0 ? 0.55 + 0.4 * y : 0.38 + 0.12 * y); col.push(c.r, c.g, c.b); }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  es.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const lm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [[0, 9, 0, 8, 0.3, 8], [7, 4, 5, 0.3, 4, 6], [-7, 3, -4, 0.3, 3, 5]].forEach(([x, y, z, a, b, c]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(a, b, c), lm); m.position.set(x, y, z); es.add(m); });
  const rt = pm.fromScene(es, 0.04);
  es.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); lm.dispose(); pm.dispose();
  return rt.texture;
}

export function createASRS3D(el, A, opts = {}) {
  const sim = A.sim, PARTS = opts.parts || {};
  el.classList.add("sr1-v");
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe6eaee);
  if (window.dtTheme) window.dtTheme.scene(scene, "#e6eaee", "#1b2025");
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 0.05, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7d848c, 0.6));
  scene.environment = makeEnv(renderer);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
  const sc = sun.shadow.camera; sc.left = -24; sc.right = 24; sc.top = 14; sc.bottom = -14; sc.near = 1; sc.far = 90; sc.updateProjectionMatrix();
  W(12, 0, 0, sun.target.position); W(-6, -14, 30, sun.position); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); W(30, 12, 10, fill.position); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene, { minDist: 0.3, maxDist: 120 });
  const M = makeMats(), B = buildScene(M); scene.add(B.root);
  if (window.dtTheme && window.dtTheme.floor) { try { window.dtTheme.floor(M.floor, "#3a3f44"); } catch (e) { /* older theme.js */ } }

  /* ---------------- DOM overlay */
  const mk = (tag, cls, txt) => { const d = document.createElement(tag); d.className = cls; if (txt) d.textContent = txt; return d; };
  const cap = mk("div", "sr1-cap"); el.appendChild(cap);
  const bar = mk("div", "sr1-bar"); el.appendChild(bar);
  const tags = mk("div", "sr1-tags"); el.appendChild(tags);
  const info = mk("div", "sr1-info"); info.hidden = true; el.appendChild(info);
  const alarm = mk("div", "sr1-alarm"); alarm.hidden = true; el.appendChild(alarm);
  el.appendChild(mk("div", "sr1-hint", "click a part or a crate · drag = turn · right-drag = move · wheel = zoom"));
  const btn = (t, title, fn) => { const b = mk("button", "btn ghost sr1-btn", t); b.type = "button"; b.title = title; b.addEventListener("click", fn); bar.appendChild(b); return b; };
  btn("Fit", "fit the whole AS/RS into the view", () => fit(true));
  const views = {};
  [["iso", "Iso", "3D view from the I/O end"], ["front", "Front", "view down the aisle from the I/O end"], ["side", "Side", "side view of rack L (front elevation of the rack)"], ["top", "Top", "plan view"]]
    .forEach(([k, t, ti]) => { views[k] = btn(t, ti, () => setView(k)); });
  const btnFol = btn("Follow crane", "camera follows the lifting carriage", () => setView("follow"));
  const btnEx = btn("Explode", "rack sides move apart, crane parts move out", () => explode());

  let viewName = ["iso", "front", "side", "top"].includes(opts.view) ? opts.view : "iso", follow = opts.view === "follow", exOn = !!opts.ex, ex = exOn ? 1 : 0, glide = null, pendFit = false;
  let sel = null, selSlot = null, hov = null, ptr = null, ptrMoved = false, down = null, raf = 0, disposed = false, visIO = true, lastCap = 0, lastInfo = 0;
  let prevVx = 0, prevT = sim.t, aNow = 0;
  btnEx.classList.toggle("on", exOn); btnFol.classList.toggle("on", follow);
  const tv = new THREE.Vector3(), tw = new THREE.Vector3();

  /* ---------------- views + fit */
  const DIRS = { iso: [-0.55, -1.0, 0.6], front: [-1, -0.02, 0.18], side: [0.0, -1, 0.12], top: [0.0, -0.02, 1] };
  function fitPose(name, outT, outP) {
    const e = ease(ex), yy = 2.6 + 2.6 * e;
    const pts = [[-7.2, -yy, 0], [RAIL[1] + 2.0, yy, RACK.height + 0.4]];
    const bx = new THREE.Box3(); for (const x of [pts[0][0], pts[1][0]]) for (const y of [pts[0][1], pts[1][1]]) for (const z of [pts[0][2], pts[1][2]]) bx.expandByPoint(W(x, y, z, tv));
    const c = bx.getCenter(outT), d = DIRS[name] || DIRS.iso; W(d[0], d[1], d[2], tv).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tv); if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize();
    const up = new THREE.Vector3().crossVectors(tv, right), tV = Math.tan(camera.fov * Math.PI / 360), tH = tV * camera.aspect;
    let dist = 1;
    for (let i = 0; i < 8; i++) { tw.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).sub(c); const dz = tw.dot(tv); dist = Math.max(dist, dz + Math.abs(tw.dot(right)) / tH, dz + Math.abs(tw.dot(up)) / tV); }
    dist *= ({ iso: 0.92, front: 0.8, side: 1.0, top: 1.0 })[name] || 1.0; outP.copy(c).addScaledVector(tv, dist);
  }
  function goTo(name, smooth) {
    const T = new THREE.Vector3(), P = new THREE.Vector3(); fitPose(name, T, P); if (nice && nice.stop) nice.stop();
    if (smooth) glide = { t: 0, a: controls.target.clone(), b: T, pa: camera.position.clone(), pb: P }; else { controls.target.copy(T); camera.position.copy(P); glide = null; controls.update(); }
  }
  const carriageWorld = (out) => W(sim.crane.x, sim.crane.fork * IOY * 0.5, sim.crane.z + 0.3, out);
  function fit(smooth = true) { follow = false; btnFol.classList.remove("on"); goTo(viewName, smooth); }
  function setView(name) {
    if (name === "follow") {
      follow = !follow; btnFol.classList.toggle("on", follow);
      if (follow) { const T = carriageWorld(new THREE.Vector3()), P = T.clone().add(W(6.0, 0.4, 6.0, new THREE.Vector3())); glide = { t: 0, a: controls.target.clone(), b: T, pa: camera.position.clone(), pb: P, follow: true }; }
      return;
    }
    follow = false; btnFol.classList.remove("on"); viewName = name; Object.entries(views).forEach(([k, b]) => b.classList.toggle("on", k === name)); goTo(name, true);
  }
  views[viewName].classList.add("on");
  function explode(on) { exOn = on === undefined ? !exOn : !!on; btnEx.classList.toggle("on", exOn); pendFit = !follow; }

  /* ---------------- picking + highlight */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), HL = new Map();
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const isCrate = (o) => o === B.crMesh || o === B.crFrame || Object.values(B.castMesh).includes(o);
  function pickAt(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(B.root, true);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i], o = h.object;
      if (o === B.pickVol) return { slot: sim.slots[h.instanceId] };
      if (!shown(o) || o.userData.noPick || o.isLine) continue;
      if (o.material && o.material.transparent && o.material.opacity < 0.3) continue;
      if (o === B.crMesh || o === B.crFrame) { const ref = B.crateRef[h.instanceId]; return ref ? { crate: ref } : null; }
      if (isCrate(o)) { const nx = hits.slice(i + 1).find((x) => x.object === B.crMesh || x.object === B.crFrame || x.object === B.pickVol);
        if (nx) return nx.object === B.pickVol ? { slot: sim.slots[nx.instanceId] } : { crate: B.crateRef[nx.instanceId] }; continue; }
      if (o === B.plate) return { slot: sim.slots[h.instanceId] };
      for (let p = o; p && p !== B.root; p = p.parent) if (p.userData.part) return { part: p.userData.part };
    }
    return null;
  }
  const hlMat = (m) => { let h = HL.get(m); if (!h) { h = m.clone(); h.emissive = new THREE.Color(0x2a5a9a); h.emissiveIntensity = 0.55; HL.set(m, h); } return h; };
  const setHL = (k, on) => { if (!k || !B.P[k]) return; B.P[k].forEach((m) => { if (!m.isMesh || !(m.material && (m.material.isMeshStandardMaterial || m.userData.m0))) return; if (on) { if (!m.userData.m0) { m.userData.m0 = m.material; m.material = hlMat(m.material); } } else if (m.userData.m0) { m.material = m.userData.m0; m.userData.m0 = null; } }); };
  function unHover() { if (hov && hov !== sel) setHL(hov, false); hov = null; }

  /* ---------------- info box */
  const R0 = calcAll({}, null).R;
  function liveText(k) {
    const c = sim.crane, kg = c.carrying ? c.carrying.kg : 0, mT = CRANE.mass + kg;
    switch (k) {
      case "travelDrive": { const F = mT * aNow * 1.05 + 0.01 * mT * 9.81; return `x = ${f(c.x, 3)} m · v = ${f(c.vx, 2)} m/s · a ≈ ${f(aNow, 2)} m/s² · F ≈ ${f(F, 0)} N · P ≈ ${f(Math.abs(F * c.vx) / 900, 2)} kW (motor 7.5 kW)`; }
      case "wheel": case "rail": return `crane at x = ${f(c.x, 2)} m · load on the fork ${kg} kg · design max wheel load ${f(R0.wRmax, 1)} kN · mean ${f(R0.wPmean, 1)} kN ≤ ${f(R0.wPal, 1)} kN`;
      case "mast": { const d = R0.mastTop * Math.abs(aNow) / CRANE.ax; return `travel a ≈ ${f(aNow, 2)} m/s² → mast top deflection now ≈ ${f(d, 2)} mm (static, at the top level) · f₁ ≈ ${f(R0.mastF, 2)} Hz`; }
      case "hoist": case "carriage": case "pulley": { const m = 600 + kg; return `z = ${f(c.z, 3)} m · v = ${f(c.vz, 2)} m/s · hoisted mass ${m} kg · rope force static ${f(m * 9.81 / 1000, 2)} kN · P now ≈ ${f(Math.max(0, m * 9.81 * c.vz) / 850, 2)} kW (motor 11 kW)`; }
      case "fork": return `fork stroke ${f(c.fork * IOY * 1000, 0)} mm (${c.fork < -0.05 ? "side L" : c.fork > 0.05 ? "side R" : "centre"}) · phase ${c.phase}${c.carrying ? ` · carrying ${c.carrying.kg} kg (${c.carrying.lot})` : ""}`;
      case "laserX": return `distance crane → reflector ${f(RAIL[1] + 0.05 - (c.x + 1.81), 3)} m → x = ${f(c.x, 3)} m`;
      case "barcode": return `BPS position ${f(c.x * 1000, 1)} mm (tape from ${RAIL[0]} m)`;
      case "ddls": return `link length ${f(RAIL[1] - (c.x + 1.72), 2)} m · crane mode ${c.mode} · ${sim.estop ? "E-STOP" : sim.faults.crane ? "crane fault" : "ok"}`;
      case "cabinet": case "platform": return `phase ${c.phase} · mode ${c.mode} · energy since start ${f(c.energyWh, 1)} Wh · ${sim.estop ? "E-STOP active" : sim.faults.crane ? "crane fault active" : "no crane fault"}`;
      case "buffer": return `distance to the front buffer ${f(c.x - 1.25 - (RAIL[0] + 0.12 + 0.43), 2)} m · to the rear buffer ${f(RAIL[1] - 0.12 - 0.43 - (c.x + 1.65), 2)} m`;
      case "infeed": case "scale": case "contour": case "scanner": case "transfer": return `infeed queue ${sim.inConv.length} crates · scanner ${sim.faults.scanner ? "FAULT (no-read)" : "ok"} · conveyor jam ${sim.faults.convJam ? "YES" : "no"} · overload ${sim.faults.overload ? "YES" : "no"}`;
      case "outfeed": return `outfeed ${sim.outConv.length} crates on the way to the line (0.2 m/s, 6 m)`;
      case "upright": case "baseplate": case "endframe": { const r = calcAll({}, sim).R; return `design upright load ${f(R0.upNk, 1)} kN · highest now ${f(r.liveUpKN, 1)} kN · stored ${f(r.liveT, 1)} t of ${f(R0.storedT, 1)} t`; }
      case "beam": return `per beam 2 × ${f(R0.beamP, 0)} N · M = ${f(R0.beamM, 0)} N·m · σ_d = ${f(R0.beamSigd, 1)} N/mm² · δ = ${f(R0.beamDefl, 2)} mm ≤ ${f(R0.beamDlim, 1)} mm`;
      case "slotPlate": case "crate": return `fill ${f(sim.fill() * 100, 1)} % · ${sim.slots.filter((s) => s.load).length} loads · ${sim.slots.filter((s) => s.reserved).length} reserved · ${sim.slots.filter((s) => s.blocked).length} blocked`;
      case "fence": case "lightCurtain": case "endAccess": return `${sim.estop ? "E-STOP active" : "safety circuit closed"} · crane ${c.phase}`;
      default: return "";
    }
  }
  function showPart(k) {
    const p = PARTS[k]; if (!p) { info.hidden = true; return; }
    info.innerHTML = `<div class="sr1-ih"><b>${esc(p.n)}</b><button class="sr1-x" type="button" title="close">×</button></div><div class="sr1-lv"></div>
      <p>${esc(p.t)}</p><p><b>Design data (example):</b> ${esc(p.d)}</p><p><b>Calculation:</b> ${esc(p.c)}</p><p><b>Typical failure:</b> ${esc(p.f)}</p>
      <p class="sr1-m">${p.g === "rack" ? "Rack" : p.g === "crane" ? "Stacker crane" : "I/O area"} · example values – check with the supplier's documentation.</p>`;
    info.hidden = false; info.querySelector(".sr1-x").addEventListener("click", () => select(null));
    const lv = info.querySelector(".sr1-lv"), t = liveText(k); lv.textContent = t; lv.hidden = !t;
  }
  function slotText(s) {
    const L = s.load, age = L ? (sim.t - L.inDate) / 60 : 0;
    return `<div class="sr1-ih"><b>Slot ${esc(s.id)}</b><button class="sr1-x" type="button" title="close">×</button></div>
      <table class="sr1-kv"><tr><th>location</th><td>side ${s.side} · bay ${s.bay + 1} · position ${s.k + 1} · level ${s.level + 1}</td></tr>
      <tr><th>coordinates</th><td>x ${f(s.x, 3)} m · y ${f(s.y, 2)} m · fork level z ${f(s.z, 2)} m</td></tr>
      <tr><th>state</th><td>${s.blocked ? "<b class='sr1-bad'>BLOCKED</b>" : s.reserved ? `reserved by ${esc(s.reserved)}` : L ? "occupied" : "empty"}</td></tr>
      ${L ? `<tr><th>load</th><td>${esc(SKU[L.sku] ? SKU[L.sku].name : L.sku)} (${esc(L.sku)})</td></tr><tr><th>quantity</th><td>${L.qty} pcs</td></tr><tr><th>gross mass</th><td>${L.kg} kg (design ≤ ${RACK.maxLoad} kg)</td></tr>
      <tr><th>lot</th><td>${esc(L.lot)}</td></tr><tr><th>in store</th><td>${f(age, 1)} min (sim time)</td></tr>` : ""}
      <tr><th>travel time</th><td>from I/O ${f(A.moveTime(0, CRANE.zIO, s.x, s.z), 1)} s (both axes together)</td></tr></table>
      <p class="sr1-m">Slot id = side-bay-position-level (guide 31 §6.9). Live from the shared simulation.</p>`;
  }
  function showCrate(ref) {
    if (ref.kind === "slot") return showSlot(ref.slot);
    const L = ref.kind === "crane" ? sim.crane.carrying : ref.item; if (!L) { info.hidden = true; return; }
    info.innerHTML = `<div class="sr1-ih"><b>Crate ${ref.kind === "crane" ? "on the fork" : ref.kind === "in" ? "on the infeed conveyor" : "on the outfeed conveyor"}</b><button class="sr1-x" type="button" title="close">×</button></div>
      <table class="sr1-kv"><tr><th>load</th><td>${esc(SKU[L.sku] ? SKU[L.sku].name : L.sku)}</td></tr>${L.qty ? `<tr><th>quantity</th><td>${L.qty} pcs</td></tr>` : ""}${L.kg ? `<tr><th>gross mass</th><td>${L.kg} kg</td></tr>` : ""}${L.lot ? `<tr><th>lot</th><td>${esc(L.lot)}</td></tr>` : ""}</table>
      <p class="sr1-m">${ref.kind === "in" ? "Weighed, contour-checked and scanned before the crane takes it; the WMS books the slot after the store." : ref.kind === "out" ? "Goes to the line / AGV pick-up point." : "Crane carrying the crate."}</p>`;
    info.hidden = false; info.querySelector(".sr1-x").addEventListener("click", () => select(null));
  }
  // outline of the selected slot / crate
  const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK.crateW + 0.06, RACK.crateL + 0.06, RACK.crateH + 0.06)), new THREE.LineBasicMaterial({ color: 0x1e90ff, depthTest: false, transparent: true }));
  selBox.renderOrder = 20; selBox.visible = false; selBox.userData.noPick = true; B.root.add(selBox);
  function showSlot(s) { selSlot = s; info.innerHTML = slotText(s); info.hidden = false; info.querySelector(".sr1-x").addEventListener("click", () => select(null)); }
  function select(hit) {
    if (sel) setHL(sel, false); sel = null; selSlot = null; selRef = null;
    if (!hit) { info.hidden = true; return; }
    if (hit.part) { sel = hit.part; setHL(sel, true); showPart(sel); }
    else if (hit.slot) showSlot(hit.slot);
    else if (hit.crate) { selRef = hit.crate; showCrate(hit.crate); }
  }
  let selRef = null;
  const cvs = renderer.domElement;
  cvs.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, b: e.button }; if (!follow) glide = null; });
  cvs.addEventListener("pointerup", (e) => { if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) select(pickAt(e.clientX, e.clientY)); down = null; });
  cvs.addEventListener("pointermove", (e) => { ptr = { x: e.clientX, y: e.clientY }; ptrMoved = true; });
  cvs.addEventListener("pointerleave", () => { ptr = null; unHover(); cvs.style.cursor = ""; });

  /* ---------------- dimension labels */
  const dimEls = B.dimLabels.map((d) => { const e = mk("div", "sr1-tag", d.t); tags.appendChild(e); return e; });
  let dimsOn = !!opts.dims; B.dims.visible = dimsOn;
  function updTags(w, h) {
    tags.hidden = !dimsOn; if (!dimsOn) return;
    B.dimLabels.forEach((d, i) => { const e = dimEls[i]; W(d.p.x, d.p.y, d.p.z, tv).project(camera);
      if (tv.z > 1 || Math.abs(tv.x) > 1.02 || Math.abs(tv.y) > 1.02) { e.style.display = "none"; return; }
      e.style.display = ""; e.style.transform = `translate(${((tv.x + 1) / 2 * w + 4).toFixed(0)}px,${((1 - tv.y) / 2 * h - 9).toFixed(0)}px)`; });
  }

  /* ---------------- resize, visibility, loop */
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; const pr = renderer.getPixelRatio(); if (cvs.width !== Math.round(w * pr) || cvs.height !== Math.round(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); } }
  let io = null, ro = null;
  if (window.IntersectionObserver) { io = new IntersectionObserver((en) => { visIO = en.some((e) => e.isIntersecting); }); io.observe(el); }
  if (window.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(el); }
  let last = performance.now(), first = true;
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent || !visIO || document.hidden) return;
    resize();
    if (first) { first = false; goTo(viewName, false); if (follow) { follow = false; setView("follow"); }
      const cm = (new URLSearchParams(location.search).get("sr1cam") || "").split(",").map(Number);
      if (cm.length === 6 && cm.every(Number.isFinite)) { W(cm[0], cm[1], cm[2], camera.position); W(cm[3], cm[4], cm[5], controls.target); controls.update(); }
      if (opts.pick && PARTS[opts.pick]) setTimeout(() => select({ part: opts.pick }), 150);
      if (opts.slot && sim.byId.get(opts.slot)) setTimeout(() => select({ slot: sim.byId.get(opts.slot) }), 150); }
    // acceleration estimate from the sim (for the live info)
    if (sim.t !== prevT) { const dts = sim.t - prevT; if (dts > 0) aNow = aNow * 0.6 + 0.4 * (sim.crane.vx - prevVx) / dts; prevVx = sim.crane.vx; prevT = sim.t; }
    const exT = exOn ? 1 : 0; if (ex !== exT) { ex += (exT - ex) * Math.min(1, dt * 3.5); if (Math.abs(ex - exT) < 0.003) ex = exT; }
    B.update(sim, { ex: ease(ex), mode: opts.getMode ? opts.getMode() : "sku" }, dt);
    if (pendFit && Math.abs(ex - exT) < 0.03) { pendFit = false; goTo(viewName, true); }
    // camera
    if (glide) { glide.t = Math.min(1, glide.t + dt / 0.8); const s = ease(glide.t);
      if (glide.follow) carriageWorld(glide.b);
      controls.target.lerpVectors(glide.a, glide.b, s); camera.position.lerpVectors(glide.pa, glide.pb, s); if (glide.t >= 1) glide = null; }
    else if (follow && !down) { carriageWorld(tv); tv.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 4)); controls.target.add(tv); camera.position.add(tv); }
    // hover
    if (ptrMoved && ptr && !down) { ptrMoved = false; const h = pickAt(ptr.x, ptr.y), k = h && h.part ? h.part : null;
      if (k !== hov) { unHover(); if (k) { hov = k; setHL(k, true); } } cvs.style.cursor = h ? "pointer" : ""; }
    // caption, alarm, live info
    if (now - lastCap > 150) {
      lastCap = now; const c = sim.crane;
      const t = `ASRS-RAW (example) · crane x ${f(c.x, 2)} m · z ${f(c.z, 2)} m · v ${f(c.vx, 2)} m/s · ${c.phase}${c.carrying ? " · carrying " + c.carrying.kg + " kg" : ""} · sim ${sim.running ? sim.speed + "×" : "paused"}`;
      if (t !== cap._t) { cap._t = t; cap.textContent = t; }
      const al = sim.estop ? "EMERGENCY STOP – crane, fork and conveyors stopped (reset in item 2)" : sim.faults.crane ? "CRANE FAULT – crane stopped, jobs wait (clear in item 2)" : sim.faults.convJam ? "Conveyor jam at the infeed" : "";
      if (al !== alarm._t) { alarm._t = al; alarm.textContent = al; alarm.hidden = !al; }
    }
    selBox.visible = !!selSlot && !info.hidden;
    if (selBox.visible) { const e2 = ease(ex) * (selSlot.side === "L" ? -2.6 : 2.6); selBox.position.set(selSlot.x, selSlot.y + e2, selSlot.z - 0.05 + RACK.crateH / 2); selBox.material.opacity = 0.6 + 0.4 * Math.sin(now / 180); }
    if (!info.hidden && now - lastInfo > 250) { lastInfo = now;
      if (sel) { const lv = info.querySelector(".sr1-lv"); if (lv) { const t = liveText(sel); lv.textContent = t; lv.hidden = !t; } }
      else if (selSlot) { info.innerHTML = slotText(selSlot); info.querySelector(".sr1-x").addEventListener("click", () => select(null)); } }
    controls.update();
    renderer.render(scene, camera);
    updTags(el.clientWidth, el.clientHeight);
  }
  raf = requestAnimationFrame(loop);

  function counts() {
    let meshes = 0, instanced = 0, instances = 0;
    B.root.traverse((o) => { if (o.isInstancedMesh) { instanced++; instances += o.count; } else if (o.isMesh) meshes++; });
    return { ...B.counts, meshes, instanced, instances, parts: Object.keys(B.P).length, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
  }
  function dispose() {
    disposed = true; cancelAnimationFrame(raf); if (io) io.disconnect(); if (ro) ro.disconnect();
    B.dispose(); HL.forEach((h) => h.dispose()); Object.values(M).forEach((m) => { if (m && m.dispose) { if (m.map) m.map.dispose(); m.dispose(); } });
    controls.dispose(); renderer.dispose(); el.innerHTML = "";
  }
  function pickWorld(x, y, z) {   // test helper: project a core point to the canvas and pick there
    W(x, y, z, tv).project(camera); const r = cvs.getBoundingClientRect();
    const h = pickAt(r.left + (tv.x + 1) / 2 * r.width, r.top + (1 - tv.y) / 2 * r.height);
    return h ? (h.part ? "part:" + h.part : h.slot ? "slot:" + h.slot.id : h.crate ? "crate:" + h.crate.kind + (h.crate.slot ? ":" + h.crate.slot.id : "") : "?") : "none";
  }
  return { pickWorld, resize, setView, explode, dims: (on) => { dimsOn = !!on; B.dims.visible = dimsOn; }, counts, select: (k) => select(k ? { part: k } : null), pickSlot: (id) => select({ slot: sim.byId.get(id) }), dispose,
    _internals: { camera, controls, B, X_END } };
}
