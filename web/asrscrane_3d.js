/* AS/RS item 6 – 3D build twin of the single-mast stacker crane (Three.js, offline).
 * SAME geometry + dimensions as item 1 (asrs3d_scene.js): bottom frame 2.9 m, wheels Ø400 at x = −1.05 / +1.35 (wheelbase 2.4 m), mast 500 × 350 at x = −0.75
 * (z 0.28 … 9.0), top rail z = 9.31, carriage + 3-stage fork (tines 1.0 m, stroke 1.35 m). Here every assembly is a separate group (colour + label + explode vector)
 * and the welded parts are built from their plates (mast plates + 6 diaphragms, box beam flanges / webs / diaphragms) so X-ray and section show the inside.
 *   createCrane3D(el, { mode: "structure" | "assembly", onPick(partKey), carrZ }) →
 *     { setView(v), setExplode(f), playExplode(), focus(asm), flow(on, F), labels(on), setStep(i), playSteps(), counts(), snapshot(), resize(), state }
 * Rendering on demand only; nothing is drawn while the canvas is hidden / off-screen. ALL VALUES ARE EXAMPLES – the crane maker's drawings decide.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { RACK } from "./asrscore.js";
import { ASM, ASM_KEYS, PARTS6, ASSY } from "./asrscrane_data.js";

const W = (x, y, z, o = new THREE.Vector3()) => o.set(x, z, -y);          // crane coords (x, y, z-up) → world
const ease = (t) => t * t * (3 - 2 * t);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const GEO = { xM: -0.75, mastZ0: 0.36, mastTop: 9.0, TOPZ: RACK.height - 0.19, xD: -1.05, xI: 1.35, PRY: -(RACK.aisle / 2 - 0.08), IOY: RACK.aisle / 2 + RACK.crateL / 2 };
const { xM, mastZ0, mastTop, TOPZ, xD, xI, PRY, IOY } = GEO;

const bx = (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cyl = (r, len, ax = "z", x = 0, y = 0, z = 0, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); if (ax === "z") g.rotateX(Math.PI / 2); else if (ax === "x") g.rotateZ(-Math.PI / 2); return g.translate(x, y, z); };

export function createCrane3D(el, opts = {}) {
  const MODE = opts.mode || "structure";
  el.classList.add("sr6-v");
  const W0 = el.clientWidth || 800, H0 = el.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
  renderer.localClippingEnabled = false;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8ecf0);
  const camera = new THREE.PerspectiveCamera(38, W0 / H0, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(8, 16, 10); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-8, 6, -10); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene, { minDist: 0.3, maxDist: 60 });
  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2; scene.add(root);
  let dirty = true; const mark = () => { dirty = true; };
  controls.addEventListener("change", mark);

  /* ---------------- materials: one per (assembly, colour) so focus / X-ray can fade one assembly */
  const matCache = new Map(), allMats = [];
  const mat = (a, c, rough = 0.5, metal = 0.25) => { const k = a + ":" + c; if (!matCache.has(k)) { const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal }); m.userData.asm = a; allMats.push(m); matCache.set(k, m); } return matCache.get(k); };
  const C = { steel: 0x8a929a, rubber: 0x1d1f21, motor: 0x2f5a8a, gear: 0x6c757d, rope: 0x2b2f33, sensor: 0x26313b, copper: 0xb87333, red: 0xc0392b, lens: 0xd02020, dark: 0x30363c, rail: 0x50565c, grout: 0x8d9296, inner: 0x2e8b57 };

  /* ---------------- groups */
  const crane = new THREE.Group(); root.add(crane);
  const G = {}; ASM_KEYS.forEach((k) => { const g = new THREE.Group(); g.name = k; g.userData.ex = ASM[k].ex; crane.add(g); G[k] = g; });
  const ctx = new THREE.Group(); ctx.name = "context"; root.add(ctx);
  const meshes = [];
  const mk = (geo, part, color, parent, o = {}) => {
    const p = PARTS6[part], a = p ? p.a : "bottom";
    const m = new THREE.Mesh(geo, mat(parent === ctx ? "ctx" : a, color ?? ASM[a].c, o.r, o.m));
    m.userData.part = part; if (o.inner) m.userData.inner = true;
    (parent || G[a]).add(m); meshes.push(m); return m;
  };
  const CZ = opts.carrZ ?? 2.6;               // carriage (fork) level in the structure view

  /* context: floor, grout, bottom rail with clamps, top rail, conductor rail */
  const RX = [-2.2, 2.8];
  mk(bx(9, 5, 0.02, 0.3, 0, -0.01), "rail", 0xd0d4d8, ctx, { r: 0.95, m: 0 });
  mk(bx(RX[1] - RX[0], 0.3, 0.02, (RX[0] + RX[1]) / 2, 0, 0.01), "rail", C.grout, ctx, { r: 0.9, m: 0 });
  mk(bx(RX[1] - RX[0], 0.05, 0.03, (RX[0] + RX[1]) / 2, 0, 0.035), "rail", C.rail, ctx, { r: 0.35, m: 0.85 });
  for (let x = RX[0] + 0.2; x < RX[1]; x += 0.6) mk(bx(0.06, 0.12, 0.02, x, 0, 0.03), "rail", C.dark, ctx);
  mk(bx(RX[1] - RX[0], 0.02, 0.1, (RX[0] + RX[1]) / 2, 0, TOPZ), "rail", C.rail, ctx, { r: 0.35, m: 0.85 });
  mk(bx(RX[1] - RX[0], 0.06, 0.1, (RX[0] + RX[1]) / 2, PRY - 0.02, 0.2), "collector", 0x47505a, ctx);

  /* bottom carriage – welded box beam from plates (z 0.12 … 0.28) + diaphragms + mast pad */
  const BX = 0.2, BL = 2.9;
  mk(bx(BL, 0.42, 0.015, BX, 0, 0.2725), "beam");
  mk(bx(BL, 0.42, 0.015, BX, 0, 0.1275), "beam");
  for (const s of [-1, 1]) mk(bx(BL, 0.01, 0.13, BX, s * 0.205, 0.2), "beam");
  for (const s of [-1, 1]) mk(bx(0.015, 0.42, 0.16, BX + s * BL / 2, 0, 0.2), "beam");
  for (let x = -1.05; x <= 1.46; x += 0.5) mk(bx(0.01, 0.39, 0.13, x, 0, 0.2), "diaphragmB", C.inner, null, { inner: true });
  mk(bx(0.62, 0.48, 0.04, xM, 0, 0.30), "beam");
  /* wheel blocks: 2 side plates + top plate (wheel visible), wheel, axle, guide rollers */
  for (const [x, k] of [[xD, "wheelD"], [xI, "wheelI"]]) {
    for (const s of [-1, 1]) mk(bx(0.42, 0.03, 0.42, x, s * 0.155, 0.30), k);
    mk(bx(0.42, 0.34, 0.03, x, 0, 0.495), k);
    mk(cyl(0.2, 0.06, "y", x, 0, 0.25, 32), k, C.steel, null, { r: 0.3, m: 0.85 });
    mk(cyl(0.04, 0.4, "y", x, 0, 0.25, 16), k, C.gear);
    for (const s of [-1, 1]) mk(cyl(0.0625, 0.04, "z", x + 0.14, s * 0.0875, 0.045, 18), "guideR", C.rubber, null, { r: 0.85, m: 0 });
  }
  /* travel drive on the drive wheel shaft (−y side) + torque arm */
  mk(bx(0.28, 0.22, 0.3, xD, -0.3, 0.28), "travelM", C.gear);
  mk(cyl(0.11, 0.42, "x", xD - 0.33, -0.32, 0.36, 22), "travelM", C.motor);
  mk(cyl(0.115, 0.08, "x", xD - 0.57, -0.32, 0.36, 22), "travelM", C.dark);
  mk(bx(0.04, 0.04, 0.2, xD + 0.16, -0.3, 0.48), "travelM", C.dark);
  /* buffers at both ends */
  for (const x of [BX - BL / 2 - 0.09, BX + BL / 2 + 0.09]) mk(cyl(0.06, 0.18, "x", x, 0, 0.2, 18), "buffer", 0x222222);
  /* mast: 4 plates + 6 diaphragms + foot flange + gussets + 12 bolts + 2 guide rails */
  const Hm = mastTop - mastZ0, zc = (mastZ0 + mastTop) / 2;
  for (const s of [-1, 1]) mk(bx(0.5, 0.006, Hm, xM, s * 0.172, zc), "mastBox");
  for (const s of [-1, 1]) mk(bx(0.006, 0.338, Hm, xM + s * 0.247, 0, zc), "mastBox");
  for (let i = 0; i < 6; i++) mk(bx(0.488, 0.338, 0.01, xM, 0, 1.0 + i * 1.45), "diaphragmM", C.inner, null, { inner: true });
  mk(bx(0.62, 0.48, 0.04, xM, 0, 0.34), "flange", 0xb9c0c7);
  for (const [dx, dy, sx, sy] of [[0.31, 0, 0.12, 0.015], [-0.31, 0, 0.12, 0.015], [0, 0.22, 0.015, 0.09], [0, -0.22, 0.015, 0.09]]) mk(bx(sx, sy, 0.2, xM + dx * 0.82, dy * 0.93, 0.46), "flange", 0xb9c0c7);
  const boltPos = []; for (const dx of [-0.285, 0.285]) for (const dy of [-0.19, -0.065, 0.065, 0.19]) boltPos.push([dx, dy]); for (const dx of [-0.12, 0.12]) for (const dy of [-0.215, 0.215]) boltPos.push([dx, dy]);
  boltPos.forEach(([dx, dy]) => mk(cyl(0.014, 0.12, "z", xM + dx, dy, 0.33, 8), "flange", C.dark));
  for (const s of [-1, 1]) mk(bx(0.06, 0.04, Hm - 0.2, xM + 0.28, s * 0.13, zc), "mastRail", C.dark, null, { r: 0.3, m: 0.8 });
  /* top carriage: frame, pulleys, top guide rollers + arms */
  mk(bx(0.7, 0.45, 0.18, xM + 0.05, 0, mastTop + 0.09), "topFrame");
  for (const dx of [0.25, -0.25]) mk(cyl(0.16, 0.06, "y", xM + dx, 0.06, mastTop + 0.12, 28), "topFrame", C.steel, null, { r: 0.35, m: 0.8 });
  for (const dx of [-0.25, 0.15]) for (const s of [-1, 1]) {
    mk(cyl(0.075, 0.08, "z", xM + dx, s * 0.085, TOPZ, 20), "topRoller", C.rubber, null, { r: 0.85, m: 0 });
    mk(bx(0.04, 0.04, TOPZ - mastTop - 0.14, xM + dx, s * 0.085, (mastTop + 0.18 + TOPZ) / 2 - 0.06), "topRoller");
  }
  /* hoist: drum (on the bottom carriage, +y side), gearbox, motor, brake; ropes (back run fixed, front run follows the carriage) */
  mk(cyl(0.125, 0.36, "x", xM, 0.36, 0.46, 28), "drum", 0x5b7fa8);
  for (let i = 0; i < 6; i++) mk(new THREE.TorusGeometry(0.127, 0.004, 6, 28).rotateY(Math.PI / 2).translate(xM - 0.15 + i * 0.06, 0.36, 0.46), "drum", C.rope);
  mk(bx(0.24, 0.26, 0.3, xM - 0.33, 0.36, 0.45), "hoistM", C.gear);
  mk(cyl(0.12, 0.4, "x", xM - 0.66, 0.36, 0.46, 22), "hoistM", C.motor);
  mk(cyl(0.125, 0.07, "x", xM - 0.9, 0.36, 0.46, 22), "hoistM", C.dark);
  for (const dy of [0.02, 0.1]) mk(cyl(0.006, mastTop + 0.12 - 0.5, "z", xM - 0.28, dy, (0.5 + mastTop + 0.12) / 2, 6), "rope", C.rope);
  const ropeGeo = cyl(0.006, 1, "z", 0, 0, 0.5, 6), ropes = [];
  for (const dy of [0.02, 0.1]) { const r = mk(ropeGeo.clone(), "rope", C.rope); r.userData.dy = dy; r.position.set(xM + 0.3, dy, 0); ropes.push(r); }
  /* lifting carriage (frame on the mast rails), rollers, safety catch, load pins; fork as its own group */
  const carr = G.carriage;
  mk(bx(0.06, 0.62, 1.0, -0.33, 0, 0.42), "carrFrame");
  for (const s of [-1, 1]) { mk(bx(0.86, 0.06, 0.1, 0.03, s * 0.36, -0.12), "carrFrame"); mk(bx(0.06, 0.06, 0.95, 0.46, s * 0.36, 0.4), "carrFrame"); mk(bx(0.14, 0.04, 1.0, -0.41, s * 0.2, 0.42), "carrFrame"); }
  mk(bx(0.06, 0.78, 0.06, 0.46, 0, 0.9), "carrFrame");
  for (const z of [0.0, 0.8]) for (const s of [-1, 1]) { mk(cyl(0.05, 0.04, "y", -0.39, s * 0.13, z, 18), "carrRoller", C.steel, null, { r: 0.3, m: 0.85 }); mk(cyl(0.035, 0.03, "x", -0.47, s * 0.175, z + 0.1, 14), "carrRoller", C.rubber); }
  for (const s of [-1, 1]) mk(bx(0.07, 0.07, 0.14, -0.43, s * 0.2, -0.02), "catch", C.red);
  for (const dy of [0.02, 0.1]) mk(cyl(0.018, 0.08, "y", -0.45, dy, 0.95, 10), "overload", 0xd9dde1);
  mk(bx(0.08, 0.06, 0.08, 0.46, -0.3, 0.6), "carrFrame", C.sensor); mk(bx(0.08, 0.06, 0.08, 0.46, 0.3, 0.6), "carrFrame", C.sensor);
  const fork = G.fork, fB = new THREE.Group(), fMid = new THREE.Group(), fTop = new THREE.Group(); fork.add(fB); fB.add(fMid); fMid.add(fTop);
  const fm = (geo, part, color, par) => { const m = mk(geo, part, color); par.add(m); return m; };
  for (const fx of [-0.25, 0.25]) {
    fm(bx(0.17, 1.0, 0.03, fx, 0, -0.065), "fork1", 0x8b939a, fB);
    fm(bx(0.14, 1.0, 0.025, fx, 0, -0.0375), "fork2", 0xa7aeb5, fMid);
    fm(bx(0.11, 1.0, 0.025, fx, 0, -0.0125), "fork3", 0xc3c9ce, fTop);
  }
  fm(bx(0.1, 0.12, 0.12, 0.0, 0.42, -0.12), "forkDrive", C.motor, fB);
  fm(cyl(0.015, 0.5, "x", 0, 0.42, -0.1, 8), "forkDrive", C.dark, fB);
  /* cabinet, sensors, collector */
  mk(bx(0.55, 0.45, 1.75, 1.15, 0, 0.52 + 0.875), "cab", 0xd8dadc);
  mk(bx(0.005, 0.4, 1.6, 1.428, 0, 1.39), "cab", 0xc8cbce);
  mk(bx(0.03, 0.12, 0.05, 1.44, -0.12, 2.04), "cab", C.red);
  mk(cyl(0.035, 0.08, "z", 1.25, -0.12, 2.48, 14), "cab", 0x2e9e57);
  mk(bx(0.16, 0.12, 0.14, 1.72, -0.12, 0.62), "laser", C.sensor); mk(cyl(0.03, 0.02, "x", 1.81, -0.12, 0.62, 14), "laser", C.lens);
  mk(bx(0.1, 0.08, 0.06, 0.9, 0.16, 0.22), "ddls", C.sensor);
  mk(bx(0.12, 0.12, 0.14, 1.72, 0.16, 1.25), "ddls", C.sensor); mk(bx(0.1, 0.1, 0.5, 1.72, 0.16, 0.95), "ddls");
  mk(bx(0.08, 0.5, 0.06, 0.3, PRY / 2 - 0.1, 0.22), "collector", C.dark); mk(bx(0.14, 0.06, 0.1, 0.3, PRY + 0.05, 0.2), "collector", C.copper, null, { r: 0.35, m: 0.8 });
  /* ladder + platform (as item 1) */
  for (const s of [-1, 1]) mk(bx(0.03, 0.03, mastTop - 0.4, xM - 0.38, s * 0.2, (0.4 + mastTop) / 2), "ladder");
  const rungG = []; for (let z = 0.5; z < mastTop - 0.2; z += 0.28) rungG.push(bx(0.025, 0.4, 0.025, xM - 0.38, 0, z));
  rungG.forEach((g) => mk(g, "ladder"));
  mk(bx(0.03, 0.03, mastTop - 0.4, xM - 0.38, 0, (0.4 + mastTop) / 2), "ladder", C.dark);
  for (const s of [-1, 1]) mk(bx(0.22, 0.03, 0.03, xM - 0.31, s * 0.2, 4.6), "ladder");
  mk(bx(0.6, 0.8, 0.04, xM - 0.55, 0, mastTop - 0.25), "platform", C.dark);
  for (const [x, y, sx, sy] of [[xM - 0.85, 0, 0.03, 0.8], [xM - 0.55, 0.4, 0.6, 0.03], [xM - 0.55, -0.4, 0.6, 0.03]]) mk(bx(sx, sy, 0.03, x, y, mastTop + 0.85), "platform");
  for (const [x, y] of [[xM - 0.85, 0.4], [xM - 0.85, -0.4], [xM - 0.25, 0.4], [xM - 0.25, -0.4]]) mk(bx(0.03, 0.03, 1.1, x, y, mastTop + 0.3), "platform");
  /* energy chain (hanging, fixed at mid mast height, loop moves with the carriage) */
  const EC = { x1: -0.62, x2: -0.42, y: -0.42, zf: 4.6, L: 4.25, r: 0.1 };
  mk(bx(0.24, 0.06, 0.06, (EC.x1 + EC.x2) / 2 - 0.1, EC.y, EC.zf + 0.03), "echainP", C.dark);
  const ecLeg1 = mk(bx(0.05, 0.08, 1, EC.x1, EC.y, 0.5), "echainP", 0x2b2e32), ecLeg2 = mk(bx(0.05, 0.08, 1, EC.x2, EC.y, 0.5), "echainP", 0x2b2e32);
  const ecLoop = mk(new THREE.TorusGeometry(EC.r, 0.03, 6, 16, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI), "echainP", 0x2b2e32);

  /* explode base positions */
  crane.children.forEach((g) => { g.userData.base = new THREE.Vector3(); });
  const S = { view: "assembled", ex: 0, focus: null, flow: false, labels: true, carrZ: CZ, fork: 0, step: ASSY.length - 1, selected: null };
  let exAnim = null, stepAnim = null, testT = 0;

  function placeMoving() {
    const z = S.carrZ, e = S.ex;
    for (const k of ASM_KEYS) { const ex = ASM[k].ex; G[k].position.set(ex[0] * e, ex[1] * e, ex[2] * e); }
    carr.position.z += z; fork.position.z += z;
    const s = S.fork * IOY; fMid.position.y = s / 2; fTop.position.y = s / 2;
    const hp = G.hoist.position, rb = carr.position.z + 0.95 - hp.z, rt = mastTop + 0.12 + G.top.position.z - hp.z;
    ropes.forEach((r) => { r.position.z = rb; r.scale.set(1, 1, Math.max(0.05, rt - rb)); r.position.x = xM + 0.3 + carr.position.x - hp.x; r.position.y = r.userData.dy + carr.position.y - hp.y; });
    // energy chain legs: fixed leg from zf down to the loop, moving leg from the loop up to the carriage (leg geometry spans z 0..1)
    const zc2 = z + 0.35, zl = Math.max(0.35, (EC.zf + zc2 - EC.L) / 2);
    const l1 = Math.max(0.02, EC.zf - zl), l2 = Math.max(0.02, zc2 - zl);
    ecLeg1.scale.z = l1; ecLeg1.position.z = zl; ecLeg2.scale.z = l2; ecLeg2.position.z = zl;
    ecLoop.position.set((EC.x1 + EC.x2) / 2, EC.y, zl);
    mark();
  }
  placeMoving();

  /* ---------------- camera */
  const box3 = new THREE.Box3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  let glide = null;
  function frame(obj, dir = [1.0, -1.6, 0.55], smooth = true) {
    scene.updateMatrixWorld(true); box3.setFromObject(obj); if (box3.isEmpty()) return;
    const c = box3.getCenter(new THREE.Vector3()), r = box3.getSize(v1).length() / 2;
    const d = W(dir[0], dir[1], dir[2], v2).normalize(), dist = r / Math.sin(camera.fov * Math.PI / 360) * 1.12;
    const P = c.clone().addScaledVector(d, dist);
    if (smooth) glide = { t: 0, a: controls.target.clone(), b: c, pa: camera.position.clone(), pb: P }; else { controls.target.copy(c); camera.position.copy(P); controls.update(); }
    nice.stop(); mark();
  }
  frame(crane, MODE === "assembly" ? [1.2, -1.8, 0.5] : [1.0, -1.6, 0.55], false);

  /* ---------------- views: assembled / exploded / X-ray / section */
  const clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);          // keeps world z ≥ 0 = crane y ≤ 0 (half towards side L)
  function applyMats() {
    const xr = S.view === "xray", sec = S.view === "section";
    renderer.clippingPlanes = sec ? [clip] : [];
    for (const m of allMats) {
      const a = m.userData.asm, faded = S.focus && a !== S.focus && a !== "ctx";
      let op = 1;
      if (xr) op = a === "ctx" ? 0.25 : 0.22;
      if (faded) op = Math.min(op, 0.1);
      m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1; m.side = sec ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true;
    }
    meshes.forEach((o) => { if (o.userData.inner) { o.material.transparent = false; o.material.opacity = S.focus && o.material.userData.asm !== S.focus ? 0.1 : 1; o.material.transparent = o.material.opacity < 1; o.material.depthWrite = !o.material.transparent; } });
    mark();
  }
  function setView(v) {
    S.view = v;
    if (v === "exploded" && S.ex < 0.99) animEx(1); else if (v !== "exploded" && S.ex > 0.01) animEx(0);
    applyMats();
    if (v === "section") frame(crane, [0.35, 1.0, 0.25]);
  }
  function animEx(to) { exAnim = { from: S.ex, to, t: 0 }; mark(); }
  function setExplode(f) { exAnim = null; S.ex = Math.max(0, Math.min(1, f)); placeMoving(); updLabels(true); }
  function focus(a) { S.focus = a && G[a] ? a : null; applyMats(); frame(S.focus ? G[S.focus] : crane, S.focus === "mast" || S.focus === "access" ? [1.0, -1.6, 0.3] : [1.0, -1.6, 0.55]); updLabels(true); }

  /* ---------------- picking + selection highlight */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const selBox = new THREE.BoxHelper(undefined, 0xff3b30); selBox.visible = false; scene.add(selBox);
  function pickAt(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(meshes, false);
    for (const h of hits) {
      const o = h.object; if (!visibleChain(o)) continue;
      if (o.material.transparent && o.material.opacity < 0.3 && !(S.view === "xray")) continue;
      if (S.view === "section" && h.point.z < -1e-3) continue;
      return o;
    }
    return null;
  }
  const visibleChain = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  function select(part, obj) {
    S.selected = part || null;
    if (obj) { selBox.setFromObject(obj); selBox.visible = true; } else selBox.visible = false;
    mark(); if (opts.onPick) opts.onPick(part || null);
  }
  function selectPart(part) { const o = meshes.find((m) => m.userData.part === part && visibleChain(m)); select(part, o || null); }
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return; } down = null;
    const o = pickAt(e.clientX, e.clientY); select(o ? o.userData.part : null, o);
  });

  /* ---------------- labels (HTML overlay) */
  const tags = document.createElement("div"); tags.className = "sr6-tags"; el.appendChild(tags);
  const ANCH = { bottom: [0.9, 0.2, 0.35], wheels: [xI, 0.25, 0.1], travel: [xD - 0.4, -0.35, 0.55], buffers: [BX + BL / 2 + 0.1, 0, 0.28], mast: [xM, 0.18, 5.6], top: [xM, 0.2, 9.4],
    carriage: [0.46, 0.4, 1.0], hoist: [xM - 0.6, 0.4, 0.62], fork: [0, 0.6, 0], cabinet: [1.15, 0.25, 2.3], power: [1.72, -0.15, 0.8], access: [xM - 0.55, 0.3, 9.95], echain: [EC.x1, EC.y, 3.0] };
  const tagEls = {};
  ASM_KEYS.forEach((k) => { const d = document.createElement("span"); d.className = "sr6-tag"; d.innerHTML = `<i style="background:#${ASM[k].c.toString(16).padStart(6, "0")}"></i>${esc(ASM[k].n)}`; tags.appendChild(d); tagEls[k] = d; });
  const flowTags = []; for (let i = 0; i < 8; i++) { const d = document.createElement("span"); d.className = "sr6-ftag"; d.hidden = true; tags.appendChild(d); flowTags.push(d); }
  let lastLbl = 0;
  function updLabels(force) {
    const now = performance.now(); if (!force && now - lastLbl < 60) return; lastLbl = now;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    const proj = (p) => { v1.set(p[0], p[1], p[2]).applyMatrix4(root.matrixWorld); v1.project(camera); return v1.z < 1 ? [(v1.x + 1) / 2 * w, (1 - v1.y) / 2 * h] : null; };
    root.updateMatrixWorld();
    for (const k of ASM_KEYS) {
      const el2 = tagEls[k], on = S.labels && G[k].visible && (!S.focus || S.focus === k) && !S.flow;
      if (!on) { el2.hidden = true; continue; }
      const a = ANCH[k], g = G[k].position;
      const q = proj([a[0] + g.x, a[1] + g.y, a[2] + g.z]);
      if (!q) { el2.hidden = true; continue; }
      el2.hidden = false; el2.style.transform = `translate(${q[0].toFixed(0)}px, ${q[1].toFixed(0)}px)`;
    }
    flowTags.forEach((d, i) => { const ft = FLOWTAG[i]; if (!S.flow || !ft) { d.hidden = true; return; } const q = proj(ft.p); if (!q) { d.hidden = true; return; } d.hidden = false; d.textContent = ft.t; d.style.transform = `translate(${q[0].toFixed(0)}px, ${q[1].toFixed(0)}px)`; });
  }

  /* ---------------- load path (animated balls along the force paths) */
  const flowG = new THREE.Group(); flowG.visible = false; root.add(flowG);
  let FLOWTAG = [];
  const PATHS = () => { const z = S.carrZ; return [
    { c: 0xd62828, pts: [[0, 0, z], [-0.1, 0, z + 0.3], [-0.39, 0.13, z + 0.8], [-0.47, 0.13, z + 0.4], [xM, 0, z * 0.5], [xM, 0, 0.36], [xM, 0, 0.2], [xD, 0, 0.25], [xD, 0, 0.04]] },
    { c: 0xd62828, pts: [[xM, 0, 0.2], [0.2, 0, 0.2], [xI, 0, 0.25], [xI, 0, 0.04]] },
    { c: 0x1f6fd1, pts: [[-0.45, 0.06, z + 0.95], [xM + 0.3, 0.06, mastTop + 0.12], [xM - 0.28, 0.06, mastTop + 0.12], [xM - 0.28, 0.06, 0.5], [xM, 0.36, 0.46]] },
    { c: 0x2e9e57, pts: [[xM, 0, mastTop], [xM - 0.05, 0.085, TOPZ]] },
  ]; };
  let flowBalls = [];
  function buildFlow() {
    flowG.clear(); flowBalls = [];
    const sg = new THREE.SphereGeometry(0.045, 10, 8);
    for (const P of PATHS()) {
      const pts = P.pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const lm = new THREE.LineBasicMaterial({ color: P.c, transparent: true, opacity: 0.55, depthTest: false });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm); line.renderOrder = 10; flowG.add(line);
      const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
      const bm = new THREE.MeshBasicMaterial({ color: P.c, depthTest: false });
      const n = Math.max(3, Math.round(lens[lens.length - 1] / 0.7));
      for (let i = 0; i < n; i++) { const b = new THREE.Mesh(sg, bm); b.renderOrder = 11; flowG.add(b); flowBalls.push({ b, pts, lens, off: i / n }); }
    }
  }
  function flow(on, F) {
    S.flow = !!on; flowG.visible = S.flow;
    if (S.flow) {
      buildFlow(); const z = S.carrZ, f1 = (v, d = 1) => Number(v).toFixed(d);
      FLOWTAG = F ? [
        { p: [0, 0.75, z + 0.05], t: `① load ${f1(F.load, 2)} kN (300 kg)` }, { p: [-0.39, 0.3, z + 0.8], t: `② rollers ${f1(F.roller, 2)} kN per level` },
        { p: [xM, 0.3, z * 0.5], t: `③ mast: N ${f1(F.N)} kN, M ${f1(F.Mn)} kN·m (${f1(F.Mem)} emergency)` }, { p: [xM, 0.3, 0.36], t: `④ flange: 12 × M24, ${f1(F.bolt)} kN per bolt` },
        { p: [0.2, 0.3, 0.12], t: `⑤ box beam M ${f1(F.beam)} kN·m` }, { p: [xD, -0.3, 0.0], t: `⑥ drive wheel ${f1(F.Rd)} kN (max ${f1(F.Rmax)})` },
        { p: [xI, -0.3, 0.0], t: `⑦ idler wheel ${f1(F.Ri)} kN` }, { p: [xM, 0.3, TOPZ + 0.2], t: `⑧ top guide ≈ ${f1(F.top)} kN (cross-aisle only)` },
      ] : [];
    }
    updLabels(true); mark();
  }

  /* ---------------- assembly mode (crane hook lifts each assembly in) */
  const hook = new THREE.Group(); hook.visible = false; root.add(hook);
  const hookCable = new THREE.Mesh(cyl(0.012, 1, "z", 0, 0, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x222222 })); hook.add(hookCable);
  const hookBlock = new THREE.Mesh(bx(0.22, 0.12, 0.3, 0, 0, 0), new THREE.MeshStandardMaterial({ color: 0xf0c419 })); hook.add(hookBlock);
  const slings = new THREE.Mesh(cyl(0.006, 0.6, "z", 0, 0, -0.3, 4), new THREE.MeshStandardMaterial({ color: 0x2e9e57 })); hook.add(slings);
  const marker = new THREE.Group(); root.add(marker); marker.visible = false;
  const laserM = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.85 });
  const surveyLine = new THREE.Mesh(bx(RX[1] - RX[0], 0.008, 0.008, (RX[0] + RX[1]) / 2, 0.06, 0.07), laserM); marker.add(surveyLine);
  const plumb = new THREE.Mesh(bx(0.008, 0.008, mastTop, xM - 0.28, -0.3, mastTop / 2), laserM); marker.add(plumb);
  const testLoad = new THREE.Mesh(bx(0.8, 1.2, 0.5, 0, 0, 0.3), new THREE.MeshStandardMaterial({ color: 0x6f87a6, roughness: 0.6 })); testLoad.visible = false; fTop.add(testLoad);
  const LIFT = { bottom: [0, 0, 2.5], mast: [0, 0, 3.0], carriage: [0, 0, 7.5], top: [0, 0, 2.2], fork: [0, 0.8, 1.6], cabinet: [0, 0.6, 2.0] };
  const HOOKZ = { bottom: 0.6, mast: mastTop + 0.25, carriage: 1.25, top: mastTop + 0.45, fork: 0.25, cabinet: 2.4 };
  const HOOKX = { bottom: [0.2, 0], mast: [xM, 0], carriage: [0.0, 0], top: [xM, 0], fork: [0, 0], cabinet: [1.15, 0] };
  function stepVisible(i) { const vis = new Set(); for (let k = 0; k <= i; k++) (ASSY[k].show || []).forEach((a) => vis.add(a)); return vis; }
  function setStep(i, animate = true) {
    i = Math.max(0, Math.min(ASSY.length - 1, i)); S.step = i;
    const vis = stepVisible(i); ASM_KEYS.forEach((k) => { G[k].visible = vis.has(k); });
    // groups that always come with another: wheels/travel/buffers/hoist with the bottom carriage (pre-assembled in the shop), ropes (hoist) once step 6
    const st = ASSY[i]; stepAnim = st.lift && animate ? { k: st.lift, t: 0 } : null; testT = 0;
    S.carrZ = 0.75; S.fork = 0; testLoad.visible = false;
    marker.visible = st.k === "survey" || st.k === "align"; surveyLine.visible = st.k === "survey"; plumb.visible = st.k === "align";
    ropes.forEach((r) => { r.visible = i >= 5; });
    placeMoving(); if (!stepAnim) hook.visible = false; updLabels(true); mark();
  }
  let stepPlay = null;
  function playSteps(on) { stepPlay = on ? { i: 0, t: 0 } : null; if (on) setStep(0); }

  /* ---------------- loop: render on demand, only when visible */
  let visIO = true;
  try { new IntersectionObserver((en) => { visIO = en[0].isIntersecting; if (visIO) mark(); }).observe(el); } catch (e) { /* old browser: always visible */ }
  let last = performance.now(), flowT = 0, raf = 0, frames = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent || !visIO || document.hidden) return;
    resize();
    let anim = false;
    if (controls.update()) dirty = true;
    if (glide) { glide.t = Math.min(1, glide.t + dt * 1.6); const s = ease(glide.t); controls.target.lerpVectors(glide.a, glide.b, s); camera.position.lerpVectors(glide.pa, glide.pb, s); if (glide.t >= 1) glide = null; anim = true; }
    if (exAnim) { exAnim.t = Math.min(1, exAnim.t + dt / 1.6); S.ex = exAnim.from + (exAnim.to - exAnim.from) * ease(exAnim.t); placeMoving(); if (exAnim.t >= 1) exAnim = null; anim = true; if (opts.onExplode) opts.onExplode(S.ex); }
    if (S.flow) { flowT += dt * 0.35; for (const f of flowBalls) { const L = f.lens[f.lens.length - 1], d = ((flowT + f.off) % 1) * L; let i = 1; while (i < f.lens.length - 1 && f.lens[i] < d) i++; const u = (d - f.lens[i - 1]) / Math.max(1e-9, f.lens[i] - f.lens[i - 1]); f.b.position.lerpVectors(f.pts[i - 1], f.pts[i], Math.min(1, u)); } anim = true; }
    if (MODE === "assembly") {
      const st = ASSY[S.step];
      if (stepAnim) {
        stepAnim.t = Math.min(1, stepAnim.t + dt / 2.6); const k = stepAnim.k, off = LIFT[k] || [0, 0, 2], u = 1 - ease(stepAnim.t);
        placeMoving(); G[k].position.x += off[0] * u; G[k].position.y += off[1] * u; G[k].position.z += off[2] * u;
        hook.visible = stepAnim.t < 1; const hz = HOOKZ[k] + (k === "fork" || k === "carriage" ? S.carrZ : 0) + off[2] * u, hx = HOOKX[k];
        hook.position.set(hx[0] + off[0] * u, hx[1] + off[1] * u, hz + 0.6); hookCable.scale.z = Math.max(0.1, 14 - hz); hookCable.position.z = 0.15;
        if (stepAnim.t >= 1) { stepAnim = null; hook.visible = false; placeMoving(); }
        anim = true;
      } else if (st.test) {
        testT += dt; const T = 12, u = (testT % T) / T; testLoad.visible = true;
        // test cycle: hoist up to 6 m, fork out L, in, out R, in, lower
        if (u < 0.3) S.carrZ = 0.75 + 5.25 * ease(u / 0.3); else if (u < 0.75) { S.carrZ = 6.0; const v = (u - 0.3) / 0.45; S.fork = v < 0.25 ? -ease(v / 0.25) : v < 0.5 ? -1 + ease((v - 0.25) / 0.25) : v < 0.75 ? ease((v - 0.5) / 0.25) : 1 - ease((v - 0.75) / 0.25); } else S.carrZ = 6.0 - 5.25 * ease((u - 0.75) / 0.25);
        placeMoving(); anim = true;
      } else if (st.k === "survey") { laserM.opacity = 0.5 + 0.4 * Math.sin(now / 200); anim = true; }
      if (stepPlay) { stepPlay.t += dt; const need = ASSY[stepPlay.i].test ? 12 : 3.4; if (stepPlay.t > need) { stepPlay.t = 0; stepPlay.i++; if (stepPlay.i >= ASSY.length) stepPlay = null; else { setStep(stepPlay.i); if (opts.onStep) opts.onStep(stepPlay.i); } } anim = true; }
    }
    if (anim) dirty = true;
    if (!dirty) return;
    dirty = false;
    if (selBox.visible) { const o = meshes.find((m) => m.userData.part === S.selected && visibleChain(m)); if (o) selBox.setFromObject(o); }
    renderer.render(scene, camera); frames++;
    updLabels(anim);
  }
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; const cv = renderer.domElement, pr = renderer.getPixelRatio(); if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); mark(); } }
  loop();
  if (MODE === "assembly") setStep(ASSY.length - 1, false);
  applyMats();

  function counts() {
    const byPart = {}, byAsm = {}; meshes.forEach((m) => { const p = m.userData.part; byPart[p] = (byPart[p] || 0) + 1; const a = PARTS6[p] ? PARTS6[p].a : "?"; byAsm[a] = (byAsm[a] || 0) + 1; });
    return { meshes: meshes.length, byPart, byAsm, groups: ASM_KEYS.filter((k) => G[k].children.length > 0).length, frames, bolts: boltPos.length,
      diaphragmM: byPart.diaphragmM || 0, diaphragmB: byPart.diaphragmB || 0, partsWithInfo: Object.keys(byPart).filter((k) => PARTS6[k]).length, partsNoInfo: Object.keys(byPart).filter((k) => !PARTS6[k]) };
  }
  /* test helper: world point of a part (centre of its first mesh) → screen → pick */
  function pickTest(part) {
    const o = meshes.find((m) => m.userData.part === part && visibleChain(m)); if (!o) return "none";
    root.updateMatrixWorld(); new THREE.Box3().setFromObject(o).getCenter(v1); const p = v1.clone().project(camera);
    const r = renderer.domElement.getBoundingClientRect(); const hit = pickAt(r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height);
    return hit ? hit.userData.part : "none";
  }
  return {
    S, setView, setExplode, animEx, focus, flow, labels: (on) => { S.labels = on; updLabels(true); }, select: selectPart, setStep, playSteps, counts, pickTest,
    setCarriage: (z, f) => { S.carrZ = z; S.fork = f || 0; placeMoving(); }, frameAll: () => frame(crane), resize: () => { resize(); mark(); },
    snapshot: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); }, isAnimating: () => !!(exAnim || stepAnim || stepPlay || glide),
  };
}
