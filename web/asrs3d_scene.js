/* AS/RS item 1 – Three.js scene of the raw-material AS/RS: steel high-bay rack (392 slots), stacker crane, I/O conveyors, fence.
 * Built in the core coordinates of asrscore.js inside one group (rotation.x = −90°): x along the aisle, y across (L = −y), z up, metres.
 * buildScene(M) → { root, P (part key → objects), side {L, R}, crane {...}, picks, update(sim, view), counts }
 * Offline: local three.js only. Geometry = the real rack / crane design of guide 31 (example values).
 */
import * as THREE from "three";
import { RACK, CRANE, SKU, SKUS } from "./asrscore.js";

const TAU = Math.PI * 2;
export const IOY = RACK.aisle / 2 + RACK.crateL / 2;     // 1.35 m: crate centre at the I/O (= fork stroke)
export const CONV_TOP = CRANE.zIO - 0.05;                // conveyor top: the fork lifts the crate 5 cm off it
export const SEAT = 0.05;                                 // crate stands 5 cm below the fork level of its slot (beam top)
export const X_END = RACK.x0 + RACK.length;               // 28.25 m rear end of the rack
export const RAIL = [-1.9, 29.9];                         // bottom rail ends
export const UP_Y = [RACK.aisle / 2 + 0.06, RACK.aisle / 2 + RACK.crateL - 0.06];   // front / rear upright centre (|y|)

/* ------------------------------------------------------------------ materials (generated textures, no image files) */
export function makeMats() {
  const S = (c, r = 0.55, m = 0.1, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  const canvas = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d")); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  // perforated upright: blue face, slot pairs every 50 mm (texture = 100 mm of upright)
  const perf = canvas(32, 64, (g) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, 32, 64); g.fillStyle = "#1a2433"; [[5, 6], [5, 38], [23, 6], [23, 38]].forEach(([x, y]) => g.fillRect(x, y, 4, 16)); g.fillStyle = "#c9d3dd"; g.fillRect(0, 0, 2, 64); g.fillRect(30, 0, 2, 64); });
  perf.repeat.set(1, RACK.height / 0.1);
  // crate mesh (wire grid with holes → alphaTest)
  const mesh = canvas(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = "#ffffff"; g.lineWidth = 3; for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } });
  mesh.repeat.set(4, 3);
  // bar-code tape
  const code = canvas(256, 16, (g) => { g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 256, 16); g.fillStyle = "#111"; let x = 0, s = 7; while (x < 256) { s = (s * 1103515245 + 12345) & 0x7fffffff; const w = 1 + (s % 4); g.fillRect(x, 2, w, 12); x += w + 1 + ((s >> 4) % 3); } });
  code.repeat.set(60, 1);
  const chain = canvas(64, 16, (g) => { g.fillStyle = "#2b2e32"; g.fillRect(0, 0, 64, 16); g.fillStyle = "#5a6068"; for (let i = 0; i < 64; i += 8) g.fillRect(i, 3, 5, 10); });
  chain.repeat.set(40, 1);
  const fenceT = canvas(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = "#ffffff"; g.lineWidth = 3; for (let i = 0; i <= 64; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); } });
  fenceT.repeat.set(6, 6);
  return {
    upright: S(0x2f62a8, 0.5, 0.25, { map: perf }), upEnd: S(0x2a5794, 0.5, 0.25, { map: perf.clone() }),
    brace: S(0xb7c0c8, 0.45, 0.6), beam: S(0xe2731c, 0.5, 0.2), plate: S(0x5e666e, 0.6, 0.4), anchor: S(0x9aa1a8, 0.35, 0.8),
    guide: S(0xc9d0d6, 0.4, 0.6), slotPlate: S(0xffffff, 0.6, 0.0), tie: S(0x2f62a8, 0.5, 0.25),
    crateMesh: new THREE.MeshStandardMaterial({ color: 0xffffff, map: mesh, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }),
    crateFrame: S(0xffffff, 0.45, 0.55),
    cast: S(0xffffff, 0.75, 0.3),
    floor: S(0xc5c9cc, 0.92, 0.0), grout: S(0x8d9296, 0.9, 0.0), rail: S(0x50565c, 0.35, 0.85),
    crane: S(0xf0b323, 0.5, 0.15), mast: S(0xd9dde1, 0.45, 0.35), dark: S(0x2c3136, 0.45, 0.45), motor: S(0x2f5a8a, 0.45, 0.35), gear: S(0x6c757d, 0.45, 0.5),
    fork1: S(0x8b939a, 0.35, 0.75), fork2: S(0xa7aeb5, 0.3, 0.8), fork3: S(0xc3c9ce, 0.3, 0.8), rope: S(0x3b3f43, 0.5, 0.8), wheel: S(0x7a8188, 0.35, 0.85),
    cabinet: S(0xd8dadc, 0.55, 0.1), cabDoor: S(0xc8cbce, 0.5, 0.1), red: S(0xc0392b, 0.5, 0.1), green: S(0x2e9e57, 0.5, 0.1), amber: S(0xd99a1e, 0.5, 0.1),
    rubber: S(0x1d1f21, 0.85, 0.0), sensor: S(0x26313b, 0.4, 0.3), lens: S(0xd02020, 0.2, 0.1, { emissive: new THREE.Color(0x801010), emissiveIntensity: 0.6 }),
    reflector: S(0xe8e8e8, 0.15, 0.6), code: S(0xffffff, 0.6, 0.0, { map: code }), yellowB: S(0xf0c419, 0.5, 0.1), powerRail: S(0x47505a, 0.5, 0.3), copper: S(0xb87333, 0.35, 0.8),
    conv: S(0x9aa3ab, 0.45, 0.5), chain: S(0xffffff, 0.6, 0.4, { map: chain }), roller: S(0xb9c0c6, 0.3, 0.8), leg: S(0x6f7880, 0.5, 0.4), transfer: S(0x5f8fbf, 0.45, 0.4),
    gate: S(0xf0c419, 0.5, 0.1), grid: S(0x30363c, 0.4, 0.3, { emissive: new THREE.Color(0x330000), emissiveIntensity: 0.3 }), scaleM: S(0x6d8fa8, 0.5, 0.3),
    fence: new THREE.MeshStandardMaterial({ color: 0x3a3f44, map: fenceT, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }), post: S(0xf0c419, 0.55, 0.15),
    curtain: new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }),
    dim: new THREE.LineBasicMaterial({ color: 0x1f4f8a }),
    pickVol: new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    beamLaser: new THREE.LineDashedMaterial({ color: 0xff2a2a, dashSize: 0.3, gapSize: 0.25, transparent: true, opacity: 0.8 }),
  };
}

/* ------------------------------------------------------------------ geometry helpers */
function mergeGeos(list) {   // list of BufferGeometry already transformed → one non-indexed geometry (position, normal, uv)
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; parts.forEach((g) => (n += g.attributes.position.count));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  parts.forEach((g) => { const c = g.attributes.position.count; pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += c; });
  const out = new THREE.BufferGeometry(); out.setAttribute("position", new THREE.BufferAttribute(pos, 3)); out.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  list.forEach((g) => g.dispose()); parts.forEach((g) => g.dispose());
  return out;
}
const bx = (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cyl = (r, len, ax = "z", x = 0, y = 0, z = 0, seg = 20, r2 = r) => { const g = new THREE.CylinderGeometry(r2, r, len, seg); if (ax === "z") g.rotateX(Math.PI / 2); else if (ax === "x") g.rotateZ(-Math.PI / 2); return g.translate(x, y, z); };
/* upright: tall box with the height along geometry y (so the side faces map v along the height), then turned to z */
const uprightGeo = (h) => new THREE.BoxGeometry(RACK.upright, h, 0.07).rotateX(Math.PI / 2).translate(0, 0, h / 2);

/* castings (local: origin at the bottom centre of one piece, m) */
function castingGeo(k) {
  const L = [];
  if (k === "RAW_CYL") { L.push(cyl(0.085, 0.18, "z", 0, 0, 0.09, 18), cyl(0.11, 0.025, "z", 0, 0, 0.0125, 18), cyl(0.11, 0.025, "z", 0, 0, 0.1675, 18)); }
  else if (k === "RAW_CS") { L.push(cyl(0.035, 0.55, "y", 0, 0, 0.07, 12)); [-0.16, 0, 0.16].forEach((y) => L.push(bx(0.13, 0.03, 0.14, 0, y, 0.07))); }
  else {
    const s = k === "RAW_CC10" ? [0.30, 0.26, 0.22, 2] : k === "RAW_CC" ? [0.34, 0.42, 0.26, 2] : [0.58, 0.34, 0.30, 3];
    L.push(bx(s[0], s[1], s[2], 0, 0, s[2] / 2), bx(s[0] + 0.04, s[1] + 0.04, 0.03, 0, 0, 0.015));
    for (let i = 0; i < s[3]; i++) L.push(cyl(0.07, 0.07, "z", (i - (s[3] - 1) / 2) * (s[0] / s[3]), 0, s[2] + 0.035, 16));
  }
  return mergeGeos(L);
}
/* piece positions inside a crate (crate local: x 0.8 along the aisle, y 1.2 deep, z from the crate floor) */
export const LAYOUT = {
  RAW_CC10: [[-0.18, -0.38], [0.18, -0.38], [-0.18, 0], [0.18, 0], [-0.18, 0.38], [0.18, 0.38]].map(([x, y]) => [x, y, 0.04]),
  RAW_CC: [[-0.19, -0.27], [0.19, -0.27], [-0.19, 0.27], [0.19, 0.27]].map(([x, y]) => [x, y, 0.04]),
  RAW_CC30: [[0, -0.38], [0, 0], [0, 0.38]].map(([x, y]) => [x, y, 0.04]),
  RAW_CYL: [0.04, 0.27].flatMap((z) => [[-0.18, -0.38], [0.18, -0.38], [-0.18, 0], [0.18, 0], [-0.18, 0.38], [0.18, 0.38]].map(([x, y]) => [x, y, z])),
  RAW_CS: [[-0.24, -0.29], [0, -0.29], [0.24, -0.29], [-0.24, 0.29], [0, 0.29], [0.24, 0.29]].map(([x, y]) => [x, y, 0.04]),
};

/* ------------------------------------------------------------------ build */
export function buildScene(M) {
  const root = new THREE.Group(); root.rotation.x = -Math.PI / 2;
  const P = {}, counts = {}, disposables = [];
  const tag = (o, k) => { o.userData.part = k; (P[k] = P[k] || []).push(o); return o; };
  const mesh = (geo, mat, k, parent, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; if (k) tag(m, k); if (parent) parent.add(m); disposables.push(geo); return m; };
  const inst = (geo, mat, mats, k, parent, shadow = true) => { const m = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((x, i) => m.setMatrixAt(i, x)); m.instanceMatrix.needsUpdate = true;
    m.castShadow = shadow; m.receiveShadow = true; if (k) tag(m, k); if (parent) parent.add(m); disposables.push(geo); counts[k || "inst"] = (counts[k || "inst"] || 0) + mats.length; return m; };
  const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const between = (a, b, th) => {   // matrix for a unit box (1 along z) from point a to b
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    return new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(th, th, L));
  };

  /* ---------------- floor, rail zone */
  const floorG = new THREE.PlaneGeometry(46, 16); const floor = mesh(floorG, M.floor, "floor", root, false); floor.position.set(12, 0, -0.001);
  mesh(bx(RAIL[1] - RAIL[0] + 0.6, 0.30, 0.02, (RAIL[0] + RAIL[1]) / 2, 0, 0.01), M.grout, "rail", root, false);
  // floor markings (yellow lines along the fence)
  mesh(bx(0.08, 4.6, 0.003, -2.32, 0, 0.0015), M.yellowB, "floor", root, false);

  /* ---------------- rack, one group per side */
  const side = {};
  const span = RACK.bayPitch - RACK.upright;
  for (const sd of ["L", "R"]) {
    const sg = sd === "L" ? -1 : 1, g = new THREE.Group(); g.name = "rack" + sd; root.add(g); side[sd] = g;
    const upM = [], endM = [], brM = [], beamM = [], plM = [], anM = [], guM = [];
    for (let j = 0; j <= RACK.bays; j++) {
      const x = RACK.x0 + j * RACK.bayPitch + RACK.upright / 2, isEnd = j === 0 || j === RACK.bays;
      for (const yy of UP_Y) { (isEnd ? endM : upM).push(T(x, sg * yy, 0)); plM.push(T(x, sg * yy, 0.004)); anM.push(T(x - 0.05, sg * yy, 0.02), T(x + 0.05, sg * yy, 0.02)); }
      // frame bracing: horizontals + zig-zag diagonals (y-z plane)
      const zs = []; for (let z = 0.15; z <= RACK.height - 0.3; z += 0.9) zs.push(z); zs.push(RACK.height - 0.15);
      const yF = sg * (UP_Y[0] + 0.035), yR = sg * (UP_Y[1] - 0.035);
      brM.push(between(new THREE.Vector3(x, yF, zs[0]), new THREE.Vector3(x, yR, zs[0]), 0.035), between(new THREE.Vector3(x, yF, zs[zs.length - 1]), new THREE.Vector3(x, yR, zs[zs.length - 1]), 0.035));
      for (let i = 0; i < zs.length - 1; i++) { const a = i % 2 ? yR : yF, b = i % 2 ? yF : yR; brM.push(between(new THREE.Vector3(x, a, zs[i]), new THREE.Vector3(x, b, zs[i + 1]), 0.03)); }
    }
    // rear down-aisle X-bracing in bays 1, 7, 14
    for (const b of [0, 6, 13]) { const x0 = RACK.x0 + b * RACK.bayPitch + RACK.upright, x1 = x0 + span, y = sg * (UP_Y[1] + 0.045);
      for (let z = 0.2; z < RACK.height - 1.0; z += 2.3) { const z2 = Math.min(z + 2.3, RACK.height - 0.2); brM.push(between(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z2), 0.025), between(new THREE.Vector3(x1, y, z), new THREE.Vector3(x0, y, z2), 0.025)); } }
    for (let b = 0; b < RACK.bays; b++) for (let l = 0; l < RACK.levels; l++) {
      const xc = RACK.x0 + b * RACK.bayPitch + RACK.upright + span / 2, zt = RACK.z1 + l * RACK.levelPitch - SEAT;
      for (const yy of UP_Y) beamM.push(T(xc, sg * yy, zt - RACK.beamH / 2));
      for (let k = 0; k < RACK.perBay; k++) { const xs = RACK.x0 + RACK.upright + b * RACK.bayPitch + RACK.gap + RACK.crateW / 2 + k * (RACK.crateW + RACK.gap);
        guM.push(T(xs - RACK.crateW / 2 - 0.02, sg * (RACK.aisle / 2 + 0.1), zt + 0.04), T(xs + RACK.crateW / 2 + 0.02, sg * (RACK.aisle / 2 + 0.1), zt + 0.04)); }
    }
    inst(uprightGeo(RACK.height), M.upright, upM, "upright", g);
    inst(uprightGeo(RACK.height), M.upEnd, endM, "endframe", g);
    inst(new THREE.BoxGeometry(1, 1, 1), M.brace, brM, "bracing", g);
    inst(new THREE.BoxGeometry(span, 0.05, RACK.beamH), M.beam, beamM, "beam", g);
    inst(new THREE.BoxGeometry(0.15, 0.12, 0.008), M.plate, plM, "baseplate", g, false);
    inst(cyl(0.008, 0.04, "z", 0, 0, 0, 8), M.anchor, anM, "baseplate", g, false);
    inst(mergeGeos([bx(0.004, 0.2, 0.08, 0, 0, 0), bx(0.04, 0.2, 0.004, sg * 0, 0, -0.04)]), M.guide, guM, "loadGuide", g, false);
  }
  // top ties across the aisle (every 2nd frame) + front / rear portals for the top guide rail
  const tieM = [];
  for (let j = 0; j <= RACK.bays; j += 2) tieM.push(T(RACK.x0 + j * RACK.bayPitch + RACK.upright / 2, 0, RACK.height - 0.06));
  inst(new THREE.BoxGeometry(0.1, 2 * UP_Y[0] + 0.07, 0.12), M.tie, tieM, "topTie", root);
  const PY = 0.62;   // front / rear portal columns inside the aisle (the I/O conveyors pass outside them)
  inst(new THREE.BoxGeometry(0.1, 2 * PY + 0.07, 0.12), M.tie, [T(RAIL[0] + 0.15, 0, RACK.height - 0.06), T(RAIL[1] - 0.15, 0, RACK.height - 0.06)], "topTie", root);
  const portM = []; for (const x of [RAIL[0] + 0.15, RAIL[1] - 0.15]) for (const s of [-1, 1]) portM.push(T(x, s * PY, 0));
  inst(uprightGeo(RACK.height), M.tie, portM, "topTie", root);
  const TOPZ = RACK.height - 0.19;   // top guide rail centre (hangs under the ties)
  mesh(bx(RAIL[1] - RAIL[0], 0.02, 0.1, (RAIL[0] + RAIL[1]) / 2, 0, TOPZ), M.rail, "topTie", root);
  // end-of-aisle mesh at the rack rear + maintenance access cage
  const fenceP = (x0, y0, x1, y1, h, k, parent, door) => {
    const L = Math.hypot(x1 - x0, y1 - y0), a = Math.atan2(y1 - y0, x1 - x0), gF = new THREE.PlaneGeometry(L, h - 0.1).rotateX(Math.PI / 2).rotateZ(a).translate((x0 + x1) / 2, (y0 + y1) / 2, h / 2 + 0.05);
    mesh(gF, door ? M.fence : M.fence, k, parent, false);
    const n = Math.max(1, Math.round(L / 1.5)); for (let i = 0; i <= n; i++) { const t = i / n; mesh(bx(0.05, 0.05, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, h / 2), M.post, k, parent, false); }
    if (door) mesh(bx(Math.abs(Math.cos(a)) * L + 0.04, Math.abs(Math.sin(a)) * L + 0.04, 0.05, (x0 + x1) / 2, (y0 + y1) / 2, h - 0.03), M.amber, k, parent, false);
  };
  const xe = RAIL[1] + 0.25;
  fenceP(xe, -2.1, xe, -0.7, 2.2, "endAccess", root); fenceP(xe, -0.7, xe, 0.7, 2.2, "endAccess", root, true); fenceP(xe, 0.7, xe, 2.1, 2.2, "endAccess", root);
  fenceP(xe, -2.1, xe + 1.6, -2.1, 2.2, "endAccess", root); fenceP(xe, 2.1, xe + 1.6, 2.1, 2.2, "endAccess", root); fenceP(xe + 1.6, -2.1, xe + 1.6, 2.1, 2.2, "endAccess", root, true);
  // reflector + data transmission at the aisle end (on a post)
  mesh(bx(0.08, 0.08, 2.0, RAIL[1] + 0.1, 0, 1.0), M.post, "laserX", root);
  mesh(bx(0.02, 0.35, 0.35, RAIL[1] + 0.05, -0.12, 0.62), M.reflector, "laserX", root);
  mesh(bx(0.12, 0.12, 0.14, RAIL[1] + 0.04, 0.16, 1.25), M.sensor, "ddls", root); mesh(cyl(0.04, 0.02, "x", RAIL[1] - 0.03, 0.16, 1.25, 16), M.lens, "ddls", root);

  /* ---------------- bottom rail, buffers, bar-code tape, power rail */
  mesh(bx(RAIL[1] - RAIL[0], 0.05, 0.03, (RAIL[0] + RAIL[1]) / 2, 0, 0.035), M.rail, "rail", root);
  const clampM = []; for (let x = RAIL[0] + 0.2; x < RAIL[1]; x += 0.6) for (const s of [-1, 1]) clampM.push(T(x, s * 0.05, 0.03));
  inst(new THREE.BoxGeometry(0.06, 0.05, 0.02), M.dark, clampM, "rail", root, false);
  for (const [x, s] of [[RAIL[0] + 0.12, 1], [RAIL[1] - 0.12, -1]]) {
    mesh(bx(0.25, 0.4, 0.5, x - s * 0.02, 0, 0.27), M.dark, "buffer", root);
    mesh(cyl(0.08, 0.28, "x", x + s * 0.24, 0, 0.35, 18), M.yellowB, "buffer", root); mesh(cyl(0.1, 0.06, "x", x + s * 0.4, 0, 0.35, 18), M.rubber, "buffer", root);
  }
  mesh(bx(RAIL[1] - RAIL[0] - 0.6, 0.004, 0.03, (RAIL[0] + RAIL[1]) / 2, 0.16, 0.14), M.code, "barcode", root, false);
  const brk = []; for (let x = RAIL[0] + 0.4; x < RAIL[1] - 0.3; x += 1.5) brk.push(T(x, 0.14, 0.07));
  inst(new THREE.BoxGeometry(0.03, 0.04, 0.12), M.dark, brk, "barcode", root, false);
  const PRY = -(RACK.aisle / 2 - 0.08);
  mesh(bx(RAIL[1] - RAIL[0] - 0.4, 0.06, 0.09, (RAIL[0] + RAIL[1]) / 2, PRY, 0.16), M.powerRail, "powerRail", root);
  const prb = []; for (let x = RAIL[0] + 0.5; x < RAIL[1] - 0.3; x += 1.925) prb.push(T(x, PRY, 0.06));
  inst(new THREE.BoxGeometry(0.04, 0.04, 0.12), M.dark, prb, "powerRail", root, false);
  // power feed box at the front
  mesh(bx(0.3, 0.2, 0.4, RAIL[0] + 0.5, PRY - 0.2, 0.4), M.cabinet, "powerRail", root);

  /* ---------------- stacker crane */
  const crane = new THREE.Group(); crane.name = "crane"; root.add(crane);
  const sub = (name, ex) => { const g = new THREE.Group(); g.name = name; g.userData.ex = ex; crane.add(g); return g; };
  const gFrame = sub("frame", [0, 0, 0]), gTravel = sub("travel", [0, -1.4, 0]), gHoist = sub("hoist", [0, 1.4, 0]), gMast = sub("mast", [-1.0, 0, 0]),
    gTop = sub("top", [-1.0, 0, 1.4]), gCab = sub("cabinet", [1.2, 1.2, 0]), gPlat = sub("platform", [-2.0, 0, 0]), gSens = sub("sensors", [1.6, 0, 0.6]);
  const xM = -0.75, mastZ0 = 0.28, mastTop = 9.0;
  // bottom frame: low middle section + wheel blocks
  mesh(bx(2.9, 0.42, 0.16, 0.2, 0, 0.2), M.crane, "wheel", gFrame);
  for (const [x, k] of [[-1.05, "travelDrive"], [1.35, "wheel"]]) {
    mesh(bx(0.42, 0.34, 0.42, x, 0, 0.3), M.crane, "wheel", gFrame);
    mesh(cyl(0.2, 0.08, "y", x, 0, 0.25, 28), M.wheel, "wheel", gFrame);
    for (const s of [-1, 1]) mesh(cyl(0.06, 0.05, "z", x + 0.14, s * 0.09, 0.07, 16), M.rubber, "wheel", gFrame);
    void k;
  }
  // travel drive (motor + gearbox + brake) on the drive wheel, −y side
  mesh(bx(0.28, 0.22, 0.3, -1.05, -0.3, 0.28), M.gear, "travelDrive", gTravel);
  mesh(cyl(0.11, 0.42, "x", -1.38, -0.32, 0.36, 22), M.motor, "travelDrive", gTravel);
  mesh(cyl(0.115, 0.08, "x", -1.62, -0.32, 0.36, 22), M.dark, "travelDrive", gTravel);
  // hoist drive (motor + gearbox + drum) on +y side near the mast
  mesh(cyl(0.125, 0.36, "x", xM, 0.36, 0.46, 26), M.gear, "hoist", gHoist);
  mesh(bx(0.24, 0.26, 0.3, xM - 0.33, 0.36, 0.45), M.gear, "hoist", gHoist);
  mesh(cyl(0.12, 0.4, "x", xM - 0.66, 0.36, 0.46, 22), M.motor, "hoist", gHoist);
  mesh(cyl(0.125, 0.07, "x", xM - 0.9, 0.36, 0.46, 22), M.dark, "hoist", gHoist);
  // mast (box 500 × 350) + carriage guide rails
  mesh(bx(0.5, 0.35, mastTop - mastZ0, xM, 0, (mastZ0 + mastTop) / 2), M.mast, "mast", gMast);
  for (const s of [-1, 1]) mesh(bx(0.06, 0.04, mastTop - mastZ0 - 0.2, xM + 0.26, s * 0.13, (mastZ0 + mastTop) / 2), M.dark, "mast", gMast);
  mesh(bx(0.62, 0.48, 0.12, xM, 0, mastZ0 + 0.06), M.crane, "mast", gMast);
  // top frame: head, pulleys, top guide rollers
  mesh(bx(0.7, 0.45, 0.18, xM + 0.05, 0, mastTop + 0.09), M.crane, "pulley", gTop);
  mesh(cyl(0.16, 0.06, "y", xM + 0.25, 0.06, mastTop + 0.12, 26), M.wheel, "pulley", gTop);
  mesh(cyl(0.16, 0.06, "y", xM - 0.25, 0.06, mastTop + 0.12, 26), M.wheel, "pulley", gTop);
  for (const dx of [-0.25, 0.15]) for (const s of [-1, 1]) { mesh(cyl(0.075, 0.08, "z", xM + dx, s * 0.085, TOPZ, 20), M.rubber, "pulley", gTop); mesh(bx(0.04, 0.04, TOPZ - mastTop - 0.1, xM + dx, s * 0.085, (mastTop + 0.18 + TOPZ) / 2 - 0.04), M.crane, "pulley", gTop); }
  // ropes: static run (drum → pulley on the mast back) + moving run (pulley → carriage)
  const ropeBack = mesh(cyl(0.006, mastTop - 0.46, "z", xM - 0.28, 0.06, (0.46 + mastTop) / 2, 6), M.rope, "hoist", gHoist, false); void ropeBack;
  const ropeGeo = cyl(0.006, 1, "z", 0, 0, 0.5, 6); const ropes = [];
  for (const dy of [0.02, 0.1]) { const r = mesh(ropeGeo.clone(), M.rope, "hoist", gTop, false); r.position.set(xM + 0.3, dy, 0); ropes.push(r); }
  // control cabinet + operator terminal
  mesh(bx(0.55, 0.45, 1.75, 1.15, 0, 0.52 + 0.875), M.cabinet, "cabinet", gCab);
  mesh(bx(0.005, 0.4, 1.6, 1.15 + 0.278, 0, 1.39), M.cabDoor, "cabinet", gCab);
  mesh(bx(0.02, 0.08, 0.08, 1.15 + 0.29, 0.12, 1.49), M.dark, "cabinet", gCab);
  mesh(bx(0.03, 0.12, 0.05, 1.15 + 0.29, -0.12, 2.04), M.red, "cabinet", gCab);
  mesh(cyl(0.02, 0.18, "z", 1.25, -0.12, 2.36, 10), M.dark, "cabinet", gCab); const beacon = mesh(cyl(0.035, 0.08, "z", 1.25, -0.12, 2.48, 14), M.green, "cabinet", gCab, false);
  // ladder on the mast back + platform at the mast head
  const rungs = []; for (let z = 0.5; z < mastTop - 0.2; z += 0.28) rungs.push(T(xM - 0.38, 0, z));
  for (const s of [-1, 1]) mesh(bx(0.03, 0.03, mastTop - 0.4, xM - 0.38, s * 0.2, (0.4 + mastTop) / 2), M.crane, "platform", gPlat, false);
  inst(new THREE.BoxGeometry(0.025, 0.4, 0.025), M.crane, rungs, "platform", gPlat, false);
  mesh(bx(0.03, 0.03, mastTop - 0.4, xM - 0.38, 0, (0.4 + mastTop) / 2), M.dark, "platform", gPlat, false);   // fall-arrest rail
  mesh(bx(0.6, 0.8, 0.04, xM - 0.55, 0, mastTop - 0.25), M.dark, "platform", gPlat);
  for (const [x, y, sx, sy] of [[xM - 0.85, 0, 0.03, 0.8], [xM - 0.55, 0.4, 0.6, 0.03], [xM - 0.55, -0.4, 0.6, 0.03]]) mesh(bx(sx, sy, 0.03, x, y, mastTop + 0.85), M.crane, "platform", gPlat, false);
  for (const [x, y] of [[xM - 0.85, 0.4], [xM - 0.85, -0.4], [xM - 0.25, 0.4], [xM - 0.25, -0.4]]) mesh(bx(0.03, 0.03, 1.1, x, y, mastTop + 0.3), M.crane, "platform", gPlat, false);
  // sensors on the crane: travel laser (to the aisle-end reflector), bar-code reader, data link, current collector
  mesh(bx(0.16, 0.12, 0.14, 1.72, -0.12, 0.62), M.sensor, "laserX", gSens); mesh(cyl(0.03, 0.02, "x", 1.81, -0.12, 0.62, 14), M.lens, "laserX", gSens);
  mesh(bx(0.1, 0.08, 0.06, 0.9, 0.16, 0.22), M.sensor, "barcode", gSens);
  mesh(bx(0.12, 0.12, 0.14, 1.72, 0.16, 1.25), M.sensor, "ddls", gSens); mesh(bx(0.1, 0.1, 0.5, 1.72, 0.16, 0.95), M.crane, "ddls", gSens);
  mesh(bx(0.08, 0.5, 0.06, 0.3, PRY / 2 - 0.1, 0.22), M.dark, "powerRail", gSens); mesh(bx(0.14, 0.06, 0.1, 0.3, PRY + 0.05, 0.18), M.copper, "powerRail", gSens);
  // laser beam to the reflector (dashed line, local to the crane: length updated each frame)
  const lgeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)]);
  const laser = new THREE.Line(lgeo, M.beamLaser); laser.position.set(1.82, -0.12, 0.62); laser.userData.noPick = true; gSens.add(laser); disposables.push(lgeo);

  // lifting carriage + telescopic fork (group moves in z with crane.z; fork stages in y)
  const carr = new THREE.Group(); carr.name = "carriage"; carr.userData.ex = [1.3, 0, 0.2]; crane.add(carr);
  mesh(bx(0.12, 0.62, 1.0, -0.47, 0, 0.42), M.crane, "carriage", carr);                       // back plate on the mast face
  for (const s of [-1, 1]) { mesh(bx(0.96, 0.06, 0.1, -0.02, s * 0.36, -0.12), M.crane, "carriage", carr); mesh(bx(0.06, 0.06, 0.95, 0.46, s * 0.36, 0.4), M.crane, "carriage", carr); }
  mesh(bx(0.06, 0.78, 0.06, 0.46, 0, 0.9), M.crane, "carriage", carr);
  for (const z of [0.0, 0.8]) for (const s of [-1, 1]) mesh(cyl(0.05, 0.05, "y", -0.55, s * 0.13, z, 16), M.rubber, "carriage", carr);
  mesh(bx(0.08, 0.06, 0.08, 0.46, -0.3, 0.6), M.sensor, "carriage", carr);   // occupancy / contour sensors
  mesh(bx(0.08, 0.06, 0.08, 0.46, 0.3, 0.6), M.sensor, "carriage", carr);
  const forkBase = new THREE.Group(), forkMid = new THREE.Group(), forkTop = new THREE.Group(); carr.add(forkBase); forkBase.add(forkMid); forkMid.add(forkTop);
  for (const fx of [-0.25, 0.25]) {
    mesh(bx(0.17, 1.0, 0.025, fx, 0, -0.0625), M.fork1, "fork", forkBase);
    mesh(bx(0.14, 1.0, 0.025, fx, 0, -0.0375), M.fork2, "fork", forkMid);
    mesh(bx(0.11, 1.0, 0.025, fx, 0, -0.0125), M.fork3, "fork", forkTop);
  }
  mesh(bx(0.1, 0.12, 0.12, 0.0, 0.42, -0.12), M.motor, "fork", forkBase);
  mesh(bx(0.08, 0.06, 0.06, -0.47, 0.34, 0.85), M.sensor, "carriage", carr);   // hoist laser on the carriage

  /* ---------------- I/O conveyors, check gate, scanner, scale, fence, light curtains */
  const io = new THREE.Group(); io.name = "io"; root.add(io);
  const conveyor = (sg, k) => {
    const y = sg * IOY, x0 = -6.6, x1 = -0.5, L = x1 - x0;
    mesh(bx(L, 1.3, 0.12, (x0 + x1) / 2, y, CONV_TOP - 0.08), M.conv, k, io);
    for (const dy of [-0.4, 0.4]) mesh(bx(L, 0.08, 0.02, (x0 + x1) / 2, y + dy, CONV_TOP - 0.01), M.chain, k, io, false);
    for (const dy of [-0.67, 0.67]) mesh(bx(L, 0.03, 0.12, (x0 + x1) / 2, y + dy, CONV_TOP + 0.04), M.conv, k, io, false);
    const lg = []; for (let x = x0 + 0.3; x < x1; x += 1.5) for (const dy of [-0.55, 0.55]) lg.push(T(x, y + dy, (CONV_TOP - 0.14) / 2));
    inst(new THREE.BoxGeometry(0.06, 0.06, CONV_TOP - 0.14), M.leg, lg, k, io, false);
    mesh(cyl(0.12, 0.28, "y", x0 + 0.5, y - 0.5, CONV_TOP - 0.2, 18), M.motor, k, io);
    // transfer station at x = 0 (chain transfer with centring guides)
    mesh(bx(0.95, 1.3, 0.12, 0, y, CONV_TOP - 0.08), M.transfer, "transfer", io);
    for (const dy of [-0.3, 0.3]) mesh(bx(0.95, 0.08, 0.02, 0, y + dy, CONV_TOP - 0.01), M.chain, "transfer", io, false);
    for (const dx of [-0.43, 0.43]) mesh(bx(0.03, 1.1, 0.1, dx, y, CONV_TOP + 0.05), M.guide, "transfer", io, false);
    const tl = []; for (const dx of [-0.4, 0.4]) for (const dy of [-0.55, 0.55]) tl.push(T(dx, y + dy, (CONV_TOP - 0.14) / 2));
    inst(new THREE.BoxGeometry(0.06, 0.06, CONV_TOP - 0.14), M.leg, tl, "transfer", io, false);
    mesh(bx(0.05, 0.05, 0.12, 0.47, y + sg * 0.62, CONV_TOP + 0.08), M.sensor, "transfer", io);
  };
  conveyor(-1, "infeed"); conveyor(1, "outfeed");
  const yIn = -IOY;
  // weighing section (load cells) on the infeed
  mesh(bx(1.0, 1.36, 0.05, -5.8, yIn, CONV_TOP - 0.17), M.scaleM, "scale", io); for (const dx of [-0.4, 0.4]) for (const dy of [-0.55, 0.55]) mesh(cyl(0.05, 0.08, "z", -5.8 + dx, yIn + dy, CONV_TOP - 0.24, 14), M.dark, "scale", io, false);
  mesh(bx(0.3, 0.06, 0.4, -5.8, yIn - 0.85, 1.2), M.sensor, "scale", io); mesh(bx(0.05, 0.05, 1.0, -5.8, yIn - 0.85, 0.5), M.leg, "scale", io, false);
  // contour / height check gate
  for (const dy of [-0.8, 0.8]) { mesh(bx(0.1, 0.1, 1.7, -4.6, yIn + dy, 0.85), M.gate, "contour", io); mesh(bx(0.05, 0.03, 1.2, -4.6, yIn + dy * 0.93, 1.05), M.grid, "contour", io, false); }
  mesh(bx(0.1, 1.7, 0.1, -4.6, yIn, 1.75), M.gate, "contour", io); mesh(bx(0.05, 1.2, 0.03, -4.6, yIn, 1.68), M.grid, "contour", io, false);
  mesh(bx(0.03, 1.5, 1.0, -4.6, yIn, 1.2), M.curtain, "contour", io, false);
  // ID scanner on a post
  mesh(bx(0.06, 0.06, 1.5, -3.6, yIn - 0.85, 0.75), M.leg, "scanner", io, false); mesh(bx(0.14, 0.16, 0.12, -3.6, yIn - 0.75, 1.15), M.sensor, "scanner", io);
  mesh(cyl(0.03, 0.02, "y", -3.6, yIn - 0.66, 1.15, 14), M.lens, "scanner", io);
  // safety fence with door across the aisle front + sides, light curtains at the conveyor openings
  const xf = -2.3, yo = 2.35;
  fenceP(xf, -yo, xf, -2.05, 2.2, "fence", io); fenceP(xf, -0.65, xf, 0.65, 2.2, "fence", io, true); fenceP(xf, 2.05, xf, yo, 2.2, "fence", io);
  fenceP(xf, -yo, RACK.x0 - 0.1, -yo, 2.2, "fence", io); fenceP(xf, yo, RACK.x0 - 0.1, yo, 2.2, "fence", io);
  for (const sg of [-1, 1]) { const y = sg * IOY;
    mesh(bx(0.05, 0.05, 2.2, xf, y - 0.7, 1.1), M.post, "fence", io, false); mesh(bx(0.05, 0.05, 2.2, xf, y + 0.7, 1.1), M.post, "fence", io, false);
    mesh(bx(1.36, 0.04, 1.3, xf, y, CONV_TOP + 0.85), M.fence, "fence", io, false);   // panel above the opening
    for (const dy of [-0.62, 0.62]) mesh(bx(0.05, 0.04, 0.95, xf + 0.05, y + dy, CONV_TOP + 0.5), M.yellowB, "lightCurtain", io);
    mesh(bx(0.02, 1.2, 0.9, xf + 0.05, y, CONV_TOP + 0.5), M.curtain, "lightCurtain", io, false);
    for (const dx of [-0.6, 0.6]) mesh(bx(0.05, 0.05, 0.05, xf + dx, y + sg * 0.66, CONV_TOP + 0.3), M.sensor, "lightCurtain", io, false);   // muting sensors
  }
  mesh(bx(0.1, 0.1, 0.12, xf - 0.04, 0.5, 1.1), M.red, "fence", io);   // door switch

  /* ---------------- crates + castings (instanced, updated from the sim) */
  const CAP = RACK.slots + 1 + 8 + 14;
  const crateMeshG = new THREE.BoxGeometry(RACK.crateW - 0.02, RACK.crateL - 0.02, RACK.crateH - 0.04).translate(0, 0, RACK.crateH / 2);
  const fr = [], w = RACK.crateW, l = RACK.crateL, h = RACK.crateH, e = 0.03;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) fr.push(bx(e, e, h, sx * (w / 2 - e / 2), sy * (l / 2 - e / 2), h / 2));
  for (const z of [0.015, h - 0.015]) for (const sy of [-1, 1]) { fr.push(bx(w, e, e, 0, sy * (l / 2 - e / 2), z)); }
  for (const z of [0.015, h - 0.015]) for (const sx of [-1, 1]) { fr.push(bx(e, l, e, sx * (w / 2 - e / 2), 0, z)); }
  for (const sx of [-0.375, 0.375]) fr.push(bx(0.05, l, 0.04, sx, 0, -0.0));   // runners (feet) at ± 375 mm – the fork tines run between them (guide 39 §9.1)
  const crateFrameG = mergeGeos(fr);
  const crMesh = new THREE.InstancedMesh(crateMeshG, M.crateMesh, CAP), crFrame = new THREE.InstancedMesh(crateFrameG, M.crateFrame, CAP);
  [crMesh, crFrame].forEach((m) => { m.castShadow = true; m.receiveShadow = true; m.count = 0; m.userData.crate = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(m); });
  crFrame.setColorAt(0, new THREE.Color(1, 1, 1)); crMesh.setColorAt(0, new THREE.Color(1, 1, 1));
  disposables.push(crateMeshG, crateFrameG);
  const castMesh = {};
  for (const k of SKUS) { const gC = castingGeo(k), m = new THREE.InstancedMesh(gC, M.cast, CAP * LAYOUT[k].length); m.castShadow = true; m.count = 0; m.userData.crate = true; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(SKU[k].color)); root.add(m); castMesh[k] = m; disposables.push(gC); }
  // slot label plates on the front beams (colour = state) + invisible pick volumes
  const plate = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.006, 0.06), M.slotPlate, RACK.slots); tag(plate, "slotPlate"); root.add(plate); disposables.push(plate.geometry);
  const pickVol = new THREE.InstancedMesh(new THREE.BoxGeometry(RACK.crateW - 0.04, RACK.crateL - 0.1, RACK.crateH - 0.05), M.pickVol, RACK.slots); pickVol.visible = false; pickVol.userData.noPick = true; root.add(pickVol); disposables.push(pickVol.geometry);
  counts.slotPlates = RACK.slots; counts.pickVolumes = RACK.slots;

  /* ---------------- dimension lines (shown with "Dims") */
  const dims = new THREE.Group(); dims.visible = false; root.add(dims); const dimLabels = [];
  const dl = (a, b, txt, at) => { const gg = new THREE.BufferGeometry().setFromPoints([a, b]); const ln = new THREE.Line(gg, M.dim); ln.userData.noPick = true; dims.add(ln); disposables.push(gg);
    const tk = (p, d) => { const g2 = new THREE.BufferGeometry().setFromPoints([p.clone().add(d), p.clone().sub(d)]); const t2 = new THREE.Line(g2, M.dim); t2.userData.noPick = true; dims.add(t2); disposables.push(g2); };
    const dir = new THREE.Vector3().subVectors(b, a).normalize(), perp = Math.abs(dir.z) > 0.9 ? new THREE.Vector3(0.15, 0, 0) : new THREE.Vector3(0, 0, 0.15); tk(a, perp); tk(b, perp);
    dimLabels.push({ p: at || a.clone().add(b).multiplyScalar(0.5), t: txt }); };
  const yD = RACK.depthY + 0.5;
  dl(new THREE.Vector3(RACK.x0, yD + 0.6, 0.02), new THREE.Vector3(X_END, yD + 0.6, 0.02), `rack length ${RACK.length.toFixed(2)} m (14 bays × 1.925 + 0.10)`);
  dl(new THREE.Vector3(RACK.x0 - 0.6, yD, 0), new THREE.Vector3(RACK.x0 - 0.6, yD, RACK.height), `rack height ${RACK.height} m`);
  for (let l2 = 0; l2 < RACK.levels; l2++) { const z = RACK.z1 + l2 * RACK.levelPitch; dl(new THREE.Vector3(X_END + 0.3, yD - 0.3, z), new THREE.Vector3(X_END + 0.3, yD + 0.3, z), `L${l2 + 1} ${z.toFixed(2)} m`, new THREE.Vector3(X_END + 0.3, yD + 0.35, z)); }
  const xa = X_END - 0.4;
  dl(new THREE.Vector3(xa, -RACK.aisle / 2, RACK.height + 0.25), new THREE.Vector3(xa, RACK.aisle / 2, RACK.height + 0.25), `aisle ${RACK.aisle} m`, new THREE.Vector3(xa, -0.3, RACK.height + 0.5));
  dl(new THREE.Vector3(xa, RACK.aisle / 2, RACK.height + 0.25), new THREE.Vector3(xa, RACK.depthY, RACK.height + 0.25), `crate depth ${RACK.crateL} m`, new THREE.Vector3(xa, RACK.depthY, RACK.height + 0.5));
  dl(new THREE.Vector3(RACK.x0 + 2 * RACK.bayPitch + 0.05, yD, 0.05), new THREE.Vector3(RACK.x0 + 3 * RACK.bayPitch + 0.05, yD, 0.05), `bay pitch ${RACK.bayPitch} m = 2 × (75 + 800) + 75 + 100 mm`);
  dl(new THREE.Vector3(0, -IOY, 1.6), new THREE.Vector3(0, IOY, 1.6), `fork stroke ± ${IOY.toFixed(2)} m`);
  dl(new THREE.Vector3(RAIL[0], -0.6, 0.02), new THREE.Vector3(RAIL[1], -0.6, 0.02), `crane rail ${(RAIL[1] - RAIL[0]).toFixed(1)} m`, new THREE.Vector3(14, -0.6, 0.05));

  /* ---------------- explode targets: rack sides apart in y, crane sub-groups along their ex vectors */
  crane.children.forEach((c) => { c.userData.base = c.position.clone(); });

  /* ---------------- per-frame update */
  const mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), v3 = new THREE.Vector3(), col = new THREE.Color();
  const crateRef = new Array(CAP);
  const inDisp = new Map();        // infeed load object → displayed x
  let lastT = null;
  const heat = (t) => col.setHSL(0.33 * (1 - Math.max(0, Math.min(1, t))), 0.75, 0.48);
  function update(sim, view, dt) {
    const S = sim, c = S.crane, ex = view.ex || 0, mode = view.mode || "sku";
    // explode
    side.L.position.y = -2.6 * ex; side.R.position.y = 2.6 * ex;
    crane.position.set(c.x, 0, 0);
    crane.children.forEach((g) => { const e2 = g.userData.ex; if (e2 && g !== carr) g.position.set(e2[0] * ex, e2[1] * ex, e2[2] * ex); });
    carr.position.set(1.3 * ex, 0, c.z + 0.2 * ex);
    const s = c.fork * IOY; forkMid.position.y = s / 2; forkTop.position.y = s / 2;
    const ropeLen = Math.max(0.05, mastTop + 0.12 - (c.z + 0.9)); ropes.forEach((r) => { r.position.z = c.z + 0.9 + 0.2 * ex; r.scale.set(1, 1, ropeLen); });
    const lp = laser.geometry.attributes.position; lp.setX(1, Math.max(0.1, RAIL[1] + 0.03 - (c.x + 1.82))); lp.needsUpdate = true; laser.geometry.computeBoundingSphere(); laser.computeLineDistances();
    beacon.material = S.estop || S.faults.crane ? M.red : c.phase === "idle" ? M.green : M.amber;
    // crates
    let n = 0; const cnt = {}; SKUS.forEach((k) => (cnt[k] = 0));
    let maxAge = 1; for (const sl of S.slots) if (sl.load) maxAge = Math.max(maxAge, S.t - sl.load.inDate);
    const putCrate = (x, y, z, load, ref, tint) => {
      if (n >= CAP) return; mtx.makeTranslation(x, y, z); crMesh.setMatrixAt(n, mtx); crFrame.setMatrixAt(n, mtx);
      let fc = 0xb9c0c6; if (tint != null) fc = tint;
      else if (mode === "fill" && load) fc = heat(load.kg / RACK.maxLoad).getHex();
      else if (mode === "age" && load) fc = col.setHSL(0.6 - 0.6 * Math.min(1, (S.t - load.inDate) / maxAge), 0.7, 0.5).getHex();
      col.setHex(fc); crFrame.setColorAt(n, col); col.setHex(mode === "sku" ? 0xc8cdd2 : fc); crMesh.setColorAt(n, col);
      crateRef[n] = ref; n++;
      if (load && SKU[load.sku]) { const k = load.sku, cm = castMesh[k], lay = LAYOUT[k], q = Math.min(lay.length, load.qty || lay.length);
        for (let i = 0; i < q; i++) { const p = lay[i]; if (cnt[k] >= cm.instanceMatrix.count) break; mtx.makeTranslation(x + p[0], y + p[1], z + p[2]); cm.setMatrixAt(cnt[k]++, mtx); } }
    };
    S.slots.forEach((sl, i) => {
      const zb = sl.z - SEAT;
      // plate on the front beam
      const sg = sl.side === "L" ? -1 : 1, yy = sg * (UP_Y[0] - 0.03) + (sl.side === "L" ? -2.6 : 2.6) * ex;
      mtx.compose(v3.set(sl.x, yy, zb - 0.06), q0, one); plate.setMatrixAt(i, mtx); pickVol.setMatrixAt(i, mtx.makeTranslation(sl.x, sl.y + (sl.side === "L" ? -2.6 : 2.6) * ex, zb + RACK.crateH / 2));
      col.setHex(sl.blocked ? 0xd0302a : sl.reserved ? 0xe0a020 : sl.load ? (mode === "sku" ? parseInt(SKU[sl.load.sku].color.slice(1), 16) : 0x3b8a52) : 0xeeeeee); plate.setColorAt(i, col);
      if (sl.load) putCrate(sl.x, sl.y + (sl.side === "L" ? -2.6 : 2.6) * ex, zb, sl.load, { kind: "slot", slot: sl }, sl.blocked ? 0xd0302a : null);
    });
    plate.instanceMatrix.needsUpdate = true; if (plate.instanceColor) plate.instanceColor.needsUpdate = true; pickVol.instanceMatrix.needsUpdate = true;
    if (c.carrying) putCrate(c.x + 1.3 * ex, s, c.z + 0.2 * ex, c.carrying, { kind: "crane" });
    // infeed queue: first load at the transfer point, the next ones 1.0 m apart, moving at the conveyor speed
    const step = (lastT == null ? 0 : Math.max(0, S.t - lastT)) * 0.2 * 3, seen = new Set(); lastT = S.t;
    S.inConv.slice(0, 7).forEach((it, i) => { const tx = -i * 1.0; let x = inDisp.has(it) ? inDisp.get(it) : -6.4; x = Math.min(tx, x + step); if (x > tx) x = tx; inDisp.set(it, x); seen.add(it);
      putCrate(x, -IOY, CONV_TOP, { sku: it.sku, qty: SKU[it.sku] ? SKU[it.sku].perLoad : 0, kg: 0 }, { kind: "in", item: it }); });
    for (const k of [...inDisp.keys()]) if (!seen.has(k)) inDisp.delete(k);
    S.outConv.forEach((it) => { const x = -Math.min(6.3, (S.t - it.t) * 0.2); putCrate(x, IOY, CONV_TOP, it, { kind: "out", item: it }); });
    crMesh.count = n; crFrame.count = n; crMesh.instanceMatrix.needsUpdate = true; crFrame.instanceMatrix.needsUpdate = true;
    if (crMesh.instanceColor) crMesh.instanceColor.needsUpdate = true; if (crFrame.instanceColor) crFrame.instanceColor.needsUpdate = true;
    SKUS.forEach((k) => { const m = castMesh[k]; m.count = cnt[k]; m.instanceMatrix.needsUpdate = true; m.visible = cnt[k] > 0; });
    crMesh.computeBoundingSphere(); crFrame.computeBoundingSphere(); SKUS.forEach((k) => castMesh[k].computeBoundingSphere()); pickVol.computeBoundingSphere();
    counts.cratesShown = n; counts.castingsShown = SKUS.reduce((a, k) => a + cnt[k], 0);
  }
  // castings colour per SKU (instance colours, fixed)
  SKUS.forEach((k) => { const m = castMesh[k], c2 = new THREE.Color(SKU[k].color); for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, c2); m.instanceColor.needsUpdate = true; });
  for (let i = 0; i < CAP; i++) { crFrame.setColorAt(i, col.setHex(0xb9c0c6)); crMesh.setColorAt(i, col.setHex(0xc8cdd2)); }
  for (let i = 0; i < RACK.slots; i++) plate.setColorAt(i, col.setHex(0xeeeeee));

  function dispose() { disposables.forEach((g) => g.dispose && g.dispose()); [crMesh, crFrame, plate, pickVol, ...Object.values(castMesh)].forEach((m) => m.dispose && m.dispose()); }
  return { root, P, side, crane, carr, counts, update, dispose, crateRef, crMesh, crFrame, castMesh, pickVol, plate, dims, dimLabels,
    focus: () => new THREE.Vector3(0, 0, 0) };
}
