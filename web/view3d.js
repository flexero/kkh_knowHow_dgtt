/* Comfortable mouse control for the machine 3D views (offline, uses only the local three.js).
 *
 *  wheel            zoom toward the point under the mouse (smooth, ~18 % per notch, never gets "stuck")
 *  Shift + wheel    fine zoom (~5 % per notch)
 *  left drag        turn around the orbit point
 *  right / middle   move (pan)
 *  double-click     make the clicked point the new orbit point (view slides to it)
 *
 *  Page scrolling: if the page itself was just being scrolled with the wheel and the mouse
 *  passes over a 3D view, the view does NOT grab the wheel for 0.6 s - the page keeps scrolling.
 *
 *  Usage:  niceControls(controls, camera, scene, { minDist, maxDist, floorY })
 *  It wraps controls.update(), so the view's own render loop drives the smooth motion.
 */
import * as THREE from "three";

let lastPageWheel = -1e9;
window.addEventListener("wheel", (e) => {
  if (!(e.target instanceof Element) || !e.target.closest("canvas[data-nice3d]")) lastPageWheel = performance.now();
}, { passive: true, capture: true });

function shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }

export function niceControls(controls, camera, scene, opts = {}) {
  const el = controls.domElement;
  el.dataset.nice3d = "1";
  controls.enableZoom = false;                 // our own wheel zoom below
  controls.enableDamping = true;
  controls.dampingFactor = 0.15;
  controls.rotateSpeed = 0.8;
  controls.screenSpacePanning = true;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.PAN };

  const minD = opts.minDist ?? camera.near * 4;      // closest distance camera ↔ point under the mouse
  const maxD = opts.maxDist ?? camera.far * 0.5;     // farthest distance camera ↔ orbit point
  const floorY = opts.floorY ?? 0;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pivot = new THREE.Vector3(), _v = new THREE.Vector3();
  let pend = 0;                                      // zoom still to do, in "notches" (+ = out)
  let glide = null;                                  // double-click slide {t, p0, t0, p1, t1}

  function pick(x, y) {
    const r = el.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let hits = [];
    try { hits = ray.intersectObject(scene, true); } catch (er) { hits = []; }
    for (const h of hits) {
      const o = h.object, m = o.material;
      if (!o.isMesh || !shown(o) || o.userData.noPick) continue;
      if (m && (m.visible === false || (m.transparent && m.opacity < 0.35))) continue;
      return h.point.clone();
    }
    const o = ray.ray.origin, d = ray.ray.direction, dist = camera.position.distanceTo(controls.target);
    if (d.y < -1e-3) {                               // nothing hit: use the floor ...
      const t = (floorY - o.y) / d.y;
      if (t > 0 && t < dist * 3) return o.clone().addScaledVector(d, t);
    }
    return o.clone().addScaledVector(d, dist);       // ... or a point as far away as the orbit point
  }

  el.addEventListener("wheel", (e) => {
    if (performance.now() - lastPageWheel < 600) return;       // page is scrolling: let it scroll
    e.preventDefault();
    const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
    let n = Math.max(-3, Math.min(3, dy / 100));                // 1 mouse notch ≈ 1; touchpads give small steps
    if (e.shiftKey) n *= 0.28;
    pivot.copy(pick(e.clientX, e.clientY));
    pend += n;
    glide = null;
  }, { passive: false });

  el.addEventListener("dblclick", (e) => {
    const p = pick(e.clientX, e.clientY);
    const keep = camera.position.distanceTo(p) / Math.max(1e-6, camera.position.distanceTo(controls.target));
    _v.subVectors(camera.position, controls.target).multiplyScalar(Math.min(1, keep));
    glide = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p.clone().add(_v), t1: p };
  });

  const step = 0.82;                                 // camera distance × 0.82 per notch in
  const update = controls.update.bind(controls);
  controls.update = function (...a) {
    if (Math.abs(pend) > 1e-4) {
      const take = Math.abs(pend) < 0.03 ? pend : pend * 0.3;  // smooth: 30 % of the rest per frame
      pend -= take;
      let k = Math.pow(step, -take);
      const dc = camera.position.distanceTo(pivot);
      if (k < 1 && dc * k < minD) { k = Math.min(1, minD / Math.max(dc, 1e-9)); pend = 0; }
      const dt = camera.position.distanceTo(controls.target);
      if (k > 1 && dt * k > maxD) { k = Math.max(1, maxD / Math.max(dt, 1e-9)); pend = 0; }
      // scale camera AND orbit point about the point under the mouse: that point stays under the mouse
      camera.position.sub(pivot).multiplyScalar(k).add(pivot);
      controls.target.sub(pivot).multiplyScalar(k).add(pivot);
    }
    if (glide) {
      glide.t = Math.min(1, glide.t + 0.08);
      const s = glide.t * glide.t * (3 - 2 * glide.t);
      camera.position.lerpVectors(glide.p0, glide.p1, s);
      controls.target.lerpVectors(glide.t0, glide.t1, s);
      if (glide.t >= 1) glide = null;
    }
    return update(...a);
  };
  // a "view" button (fit) should cancel any running zoom / slide
  const stop = () => { pend = 0; glide = null; };
  return { stop };
}

export const NICE_HINT = "drag = turn · right-drag = move · wheel = zoom at the mouse (Shift = fine) · double-click = turn around that point";
