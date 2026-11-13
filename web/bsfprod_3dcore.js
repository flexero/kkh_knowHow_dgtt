/* Ball screw + guide factory – item 1: shared 3D core for bsfprod_3dbs.js and bsfprod_3dlg.js (offline three.js).
 * createView(el, opts) → { THREE, renderer, scene, camera, controls, mark, onTick(fn), tag(text, obj, local, cls), setTags(on), pickable(fn),
 *   glide(target, pos), snapshot(), resize(), frames() }. Renders only when something changed and the element is visible.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

export { THREE };
const ease = (t) => t * t * (3 - 2 * t);

export function createView(el, opts = {}) {
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
  renderer.localClippingEnabled = true;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(opts.bg ?? 0xe8ecf0);
  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, W0 / H0, opts.near ?? 1, opts.far ?? 20000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(400, 900, 700); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-600, 300, -500); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  niceControls(controls, camera, scene, { minDist: opts.minDist ?? 10, maxDist: opts.maxDist ?? 6000, floorY: opts.floorY ?? 0 });
  let dirty = true; const mark = () => { dirty = true; };
  controls.addEventListener("change", mark);

  /* overlay labels */
  const tagBox = document.createElement("div"); tagBox.className = "bf1-tags"; el.appendChild(tagBox);
  const tags = []; let tagsOn = true;
  const _p = new THREE.Vector3();
  function tag(text, obj, local = [0, 0, 0], cls = "", show = null) {
    if (!Array.isArray(local)) { show = cls || null; cls = local || ""; local = [0, 0, 0]; }   // tag(text, obj, cls, show)
    const d = document.createElement("div"); d.className = "bf1-tag " + cls; d.textContent = text; tagBox.appendChild(d);
    const t = { d, obj, local: new THREE.Vector3(...local), show }; tags.push(t); return t;
  }
  function updTags() {
    const w = el.clientWidth, h = el.clientHeight;
    for (const t of tags) {
      let vis = tagsOn && (!t.show || t.show());
      for (let o = t.obj; o && vis; o = o.parent) if (!o.visible) vis = false;
      if (vis) { _p.copy(t.local); t.obj.localToWorld(_p); _p.project(camera); vis = _p.z < 1 && Math.abs(_p.x) < 1.05 && Math.abs(_p.y) < 1.05; }
      t.d.hidden = !vis;
      if (vis) t.d.style.transform = `translate(${((_p.x + 1) / 2 * w).toFixed(1)}px, ${((1 - _p.y) / 2 * h).toFixed(1)}px) translate(-50%, -120%)`;
    }
  }

  /* click picking (only a click, not a drag) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let pickCb = null, down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || !pickCb || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(scene, true);
    for (const h of hits) {
      let o = h.object, vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false;
      if (!vis || !o.isMesh) continue;
      const m = o.material; if (m && m.transparent && m.opacity < 0.3) continue;
      if (m && m.clippingPlanes && m.clippingPlanes.length && m.clippingPlanes.some((pl) => pl.distanceToPoint(h.point) < -1e-6)) continue;   // clipped away
      for (; o && !o.userData.part; o = o.parent);
      if (o) { pickCb(o.userData.part, h.point); return; }
    }
  });

  /* loop */
  const ticks = []; let glideS = null, frames = 0, visIO = true, last = performance.now();
  try { const io = new IntersectionObserver((en) => { visIO = en[0].isIntersecting; if (visIO) mark(); }); io.observe(el); } catch (e) { /* old browser */ }
  function resize() {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    const pr = renderer.getPixelRatio(), cv = renderer.domElement;
    if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); mark(); }
  }
  function loop() {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent || !visIO || document.hidden) return;
    resize();
    for (const f of ticks) if (f(dt)) dirty = true;
    if (controls.update()) dirty = true;
    if (glideS) { glideS.t = Math.min(1, glideS.t + dt * 1.6); const s = ease(glideS.t); controls.target.lerpVectors(glideS.a, glideS.b, s); camera.position.lerpVectors(glideS.pa, glideS.pb, s); if (glideS.t >= 1) glideS = null; dirty = true; }
    if (!dirty) return;
    dirty = false; renderer.render(scene, camera); frames++; updTags();
  }
  loop();
  return {
    THREE, renderer, scene, camera, controls, mark,
    onTick: (f) => ticks.push(f), tag, setTags: (on) => { tagsOn = !!on; updTags(); }, pickable: (f) => { pickCb = f; },
    glide: (target, pos, now = false) => {
      const b = new THREE.Vector3(...target), pb = new THREE.Vector3(...pos);
      if (now) { controls.target.copy(b); camera.position.copy(pb); mark(); return; }
      glideS = { t: 0, a: controls.target.clone(), b, pa: camera.position.clone(), pb };
    },
    snapshot: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); },
    resize: () => { resize(); mark(); }, frames: () => frames,
  };
}

/* material helper: MeshStandardMaterial with a role; X-ray / clipping switch by role */
export function matKit() {
  const all = [];
  const M = (color, role, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.45, metalness: o.m ?? 0.35, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });
    m.userData.role = role; m.userData.base = { opacity: 1 }; all.push(m); return m;
  };
  // xray: roles in `fade` get transparent; clip: roles in `cut` get the clipping plane
  function apply({ fade = [], op = 0.16, cut = [], plane = null }) {
    for (const m of all) {
      const f = fade.includes(m.userData.role);
      m.transparent = f; m.opacity = f ? op : 1; m.depthWrite = !f;
      m.clippingPlanes = plane && cut.includes(m.userData.role) ? [plane] : [];
      m.needsUpdate = true;
    }
  }
  return { M, all, apply };
}
