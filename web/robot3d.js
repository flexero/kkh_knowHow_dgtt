/* 3D view of the INDUSTRIAL ROBOT tab (6-axis articulated robot + machine-tending cell).
 *
 *   createRobot3D(el, getState, opts) → { rebuild, fit, setView, explode, select, resize, dispose, onPick }
 *
 * getState() is called every frame (see docs/21_contract_robot.md):
 *   { rb, q[6] deg, tool{x,y,z}, C (cellLayout), grip 0..1, parts[{id,p,ax,done,held}], door 0..1, conv mm,
 *     show{cell,env,frames,trail,ghost}, trail[[x,y,z]], targets[{n,p}], ghostQ, sel, live{moving,alarm} }
 *
 * Every link is placed on the kinematic frames of fk() (robotkin.js), so the drawn flange is exactly fk().flange:
 *   F0 column (turns with J1) · F1 lower arm (J2 axis = local Y, arm along +Z) · F2 upper arm (J3 axis = local Y)
 *   F3 forearm (J4 roll about local X) · F4 wrist (J5 axis = local Y) · F5 flange (Z out of the flange, J6 applied).
 * All sizes come from rb.dims / rb.base / rb.mass, so IRB 120 … IRB 6700 all get the right proportions.
 * Robot coordinates (X forward, Y left, Z up, mm) are used inside one root group (rotation.x = −90°, scale 0.001).
 * Offline: local three.js + view3d.js only.  Every value is an EXAMPLE.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { fk, PARTS, envelope, cellLayout } from "./robotkin.js";

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = (v) => Math.round(v * 10) / 10;
const PART_BY_K = Object.fromEntries(PARTS.map((p) => [p.k, p]));

/* ------------------------------------------------------------------ materials */
function makeMats() {
  const S = (c, r = 0.55, m = 0.05, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  const M = {
    cast: S(0xd5d8db, 0.55, 0.05, { envMapIntensity: 0.35 }),   // robot castings (light grey / white)
    cast2: S(0xbcc1c6, 0.5, 0.08, { envMapIntensity: 0.4 }),    // joint covers, bosses
    castB: S(0xb5bbc1, 0.6, 0.05, { envMapIntensity: 0.35 }),   // base foot
    motor: S(0x2b2f34, 0.42, 0.45),        // servo motors
    motorCap: S(0x3d434a, 0.38, 0.5),
    metal: S(0x9ea6ad, 0.3, 0.85),         // reducers, flange, rings
    bolt: S(0x50555b, 0.4, 0.7),
    cable: S(0x16181a, 0.75, 0.05),
    hose: S(0x3f6f9f, 0.5, 0.05),
    alu: S(0xb8bfc6, 0.35, 0.6),
    finger: S(0x8a949d, 0.4, 0.6),
    rubber: S(0x1f2123, 0.8, 0.0),
    conn: S(0x5b6168, 0.5, 0.4),
    // cell
    floor: S(0xd3d6d8, 0.9, 0.0),
    ped: S(0x67727c, 0.6, 0.2),
    profile: S(0xa9b2ba, 0.4, 0.55),
    belt: S(0xffffff, 0.85, 0.0),
    leg: S(0x7d8892, 0.5, 0.4),
    panel: S(0xe6e8ea, 0.55, 0.05),
    panelD: S(0x3d454c, 0.6, 0.1),
    inner: new THREE.MeshStandardMaterial({ color: 0x4a5259, roughness: 0.8, side: THREE.BackSide }),
    frame: S(0xc6cbd0, 0.5, 0.2),
    glass: S(0x9fc3d6, 0.1, 0.1, { transparent: true, opacity: 0.32, depthWrite: false }),
    screen: S(0x27435c, 0.3, 0.1, { emissive: new THREE.Color(0x1d4a70), emissiveIntensity: 0.6 }),
    red: S(0xc0392b, 0.5, 0.1), amber: S(0xd99a1e, 0.5, 0.1), green: S(0x2e9e57, 0.5, 0.1),
    post: S(0xd8a400, 0.55, 0.15),
    rail: S(0x3a3f44, 0.6, 0.3),
    chuck: S(0x8d969e, 0.35, 0.75),
    partRaw: S(0x6c7074, 0.75, 0.25),
    partMach: S(0xc9ced3, 0.3, 0.8),
    ghost: new THREE.MeshStandardMaterial({ color: 0x3a6ea8, roughness: 0.6, transparent: true, opacity: 0.22, depthWrite: false }),
    envFill: new THREE.MeshBasicMaterial({ color: 0x2a78d6, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    envOut: new THREE.LineBasicMaterial({ color: 0x2a78d6 }),
    envLine: new THREE.LineDashedMaterial({ color: 0x2a78d6, dashSize: 60, gapSize: 40, transparent: true, opacity: 0.7 }),
    trail: new THREE.LineBasicMaterial({ color: 0xd0561e }),
    target: S(0xd0561e, 0.5, 0.1, { emissive: new THREE.Color(0x6a2008), emissiveIntensity: 0.5 }),
  };
  // fence mesh + belt textures (generated, no image files)
  const cv = document.createElement("canvas"); cv.width = cv.height = 64; let g = cv.getContext("2d");
  g.clearRect(0, 0, 64, 64); g.strokeStyle = "#3a4046"; g.lineWidth = 2.5;
  for (let i = 0; i <= 64; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const mt = new THREE.CanvasTexture(cv); mt.wrapS = mt.wrapT = THREE.RepeatWrapping; mt.colorSpace = THREE.SRGBColorSpace;
  M.mesh = new THREE.MeshStandardMaterial({ map: mt, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.2 });
  M.meshF = new THREE.MeshStandardMaterial({ map: mt, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6 });
  M.panelF = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, roughness: 0.6, transparent: true, opacity: 0.16, depthWrite: false });
  M.panelDF = new THREE.MeshStandardMaterial({ color: 0x3d454c, roughness: 0.6, transparent: true, opacity: 0.25, depthWrite: false });
  M.postF = new THREE.MeshStandardMaterial({ color: 0xd8a400, roughness: 0.55, transparent: true, opacity: 0.28, depthWrite: false });
  M.railF = new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.6, transparent: true, opacity: 0.2, depthWrite: false });
  const cb = document.createElement("canvas"); cb.width = cb.height = 64; g = cb.getContext("2d");
  g.fillStyle = "#2d3034"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#4a5056"; g.fillRect(0, 0, 64, 8); g.fillStyle = "#34383c"; g.fillRect(0, 32, 64, 3);
  const bt = new THREE.CanvasTexture(cb); bt.wrapS = bt.wrapT = THREE.RepeatWrapping; bt.colorSpace = THREE.SRGBColorSpace;
  M.beltTex = bt;
  return M;
}

/* ------------------------------------------------------------------ geometry helpers (robot coords, Z up) */
function GeoCache() {
  const m = new Map();
  return {
    get(k, f) { let g = m.get(k); if (!g) { g = f(); g.userData.cached = true; m.set(k, g); } return g; },
    dispose() { m.forEach((g) => g.dispose()); m.clear(); },
  };
}
const kf = (...a) => a.map((v) => (typeof v === "number" ? v.toFixed(1) : String(v))).join("|");
function hullPts(circles, n = 36) {
  const pts = [];
  for (const [x, y, r] of circles) {
    if (r <= 0.01) { pts.push([x, y]); continue; }
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push([x + r * Math.cos(a), y + r * Math.sin(a)]); }
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
function Geo(G) {
  return {
    // cylinder along axis "x" | "y" | "z", centred at the origin; rTop at the + end
    cyl: (r, len, ax = "z", seg = 32, rTop = r) => G.get(kf("c", r, len, ax, seg, rTop), () => {
      const g = new THREE.CylinderGeometry(rTop, r, len, seg);
      if (ax === "z") g.rotateX(Math.PI / 2); else if (ax === "x") g.rotateZ(-Math.PI / 2);
      return g;
    }),
    box: (sx, sy, sz) => G.get(kf("b", sx, sy, sz), () => new THREE.BoxGeometry(sx, sy, sz)),
    // profile in the (x, z) plane = convex hull of circles [x, z, r], extruded along Y (depth, centred at y = 0)
    hull: (circles, depth, bevel) => G.get(kf("h", JSON.stringify(circles.map((c) => c.map((v) => Math.round(v)))), depth, bevel), () => {
      const P = hullPts(circles), sh = new THREE.Shape();
      sh.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) sh.lineTo(P[i][0], P[i][1]); sh.closePath();
      const b = Math.min(bevel, depth * 0.3);
      const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(1, depth - 2 * b), bevelEnabled: b > 0.5, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 3, curveSegments: 4 });
      g.translate(0, 0, -(depth - 2 * b) / 2); g.rotateX(Math.PI / 2); g.computeVertexNormals();
      return g;
    }),
    // lathe about Z: pts [[r, z], ...]
    lathe: (pts, seg = 48) => G.get(kf("l", JSON.stringify(pts.map((p) => p.map((v) => Math.round(v)))), seg), () => {
      const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(Math.max(0.001, r), z)), seg); g.rotateX(Math.PI / 2); return g;
    }),
    // rounded rectangle plate in XY, z = 0..t
    plate: (L, W, rad, t) => G.get(kf("p", L, W, rad, t), () => {
      const s = new THREE.Shape(), x = L / 2, y = W / 2;
      s.moveTo(-x + rad, -y); s.lineTo(x - rad, -y); s.quadraticCurveTo(x, -y, x, -y + rad); s.lineTo(x, y - rad); s.quadraticCurveTo(x, y, x - rad, y);
      s.lineTo(-x + rad, y); s.quadraticCurveTo(-x, y, -x, y - rad); s.lineTo(-x, -y + rad); s.quadraticCurveTo(-x, -y, -x + rad, -y);
      const b = Math.min(t * 0.25, 8);
      return new THREE.ExtrudeGeometry(s, { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 6 }).translate(0, 0, b);
    }),
  };
}

/* ------------------------------------------------------------------ the robot */
function buildRobot(rb, C, M, G, ghost) {
  const g3 = Geo(G);
  const d = rb.dims, h1 = d.h1, a1 = d.a1, a2 = d.a2, a3 = d.a3, d4 = d.d4, d6 = d.d6;
  const S = Math.cbrt(rb.mass / 272), rs = 150 * S, small = rb.payload < 10, sL = -1;   // sL: lower arm on the −Y (right) side
  const BL = rb.base[0], BW = rb.base[1], bm = Math.min(BL, BW), rc = 0.42 * bm;
  const hb = 0.3 * h1, hubH = 0.12 * h1, z0c = hb + hubH;
  const wc = 1.05 * rs, gap = 0.06 * rs, wl = 0.75 * rs, yl = wc + gap + wl / 2, rL0 = 0.72 * rs, rL1 = 0.5 * rs;
  const rw = clamp(0.7 * d6, 0.3 * rs, 0.45 * rs), rf1 = Math.max(0.42 * rs, 1.45 * rw), rf0 = Math.max(0.5 * rs, rf1 * 1.06);
  const rU = Math.max(0.6 * rs, rf0 * 1.22), rE = Math.max(0.72 * rs, rU * 1.1), rear = Math.max(0.27 * d4, 1.25 * rs), front = 0.2 * d4, wu = wc;
  const forkL = 1.7 * rw, pt = 0.34 * rw, tf = 0.2 * rw, rfl = 0.72 * rw;
  const pd = C.part.d, ph = C.part.h, TL = C.toolLen;
  const xa = front + 0.9 * rU, xb = d4 - forkL;
  const mat = (n) => (ghost ? M.ghost : M[n]);
  const root = new THREE.Group(), L = {}, P = {}, sub = {};
  const link = (n) => { const g = new THREE.Group(); g.matrixAutoUpdate = false; root.add(g); L[n] = g; return g; };
  const part = (parent, k) => { const g = new THREE.Group(); if (!ghost) g.userData.part = k; parent.add(g); (P[k] || (P[k] = [])).push(g); return g; };
  const add = (parent, geo, mn, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat(mn)); m.position.set(x, y, z); m.castShadow = !ghost; if (ghost) m.userData.noPick = true; parent.add(m); return m;
  };
  const motor = (parent, r, len, ax, x, y, z, dir) => {        // servo motor: body + finned end + cap + connector box. dir = +1/−1 along ax
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const v = (s) => (ax === "x" ? [s * dir, 0, 0] : ax === "y" ? [0, s * dir, 0] : [0, 0, s * dir]);
    add(g, g3.cyl(r, len * 0.82, ax, 28), "motor", ...v(len * 0.41));
    add(g, g3.cyl(r * 1.04, len * 0.06, ax, 28), "motorCap", ...v(len * 0.05));
    add(g, g3.cyl(r * 0.92, len * 0.18, ax, 28), "motorCap", ...v(len * 0.91));
    const cb = ax === "z" ? g3.box(r * 0.7, r * 0.55, r * 0.5) : g3.box(ax === "x" ? r * 0.5 : r * 0.55, ax === "y" ? r * 0.5 : r * 0.55, r * 0.45);
    const cpos = v(len * 0.62); if (ax === "z") cpos[0] -= r * 1.05; else cpos[2] += r * 1.08;
    add(g, cb, "conn", ...cpos);
    return g;
  };

  /* ---- base (static) */
  const base = link("base"); base.matrix.identity();
  const gB = part(base, "base"), tb = 0.24 * hb;
  add(gB, g3.plate(BL, BW, 0.14 * bm, tb), "castB");
  add(gB, g3.lathe([[0, tb], [rc * 1.13, tb], [rc * 1.11, tb + 0.12 * (hb - tb)], [rc * 1.02, hb - 0.06 * hb], [rc * 0.99, hb], [0, hb]]), "castB");
  for (let i = 0; i < 4; i++) {                                // 4 ribs between plate and body
    const a = (i + 0.5) / 4 * TAU, rr = rc * 1.12 + 0.08 * bm;
    const rib = add(gB, g3.hull([[0, 0, 0.01], [0.16 * bm, 0, 0.01], [0, 0.55 * (hb - tb), 0.01]], 0.035 * bm, 2), "castB", Math.cos(a) * rc * 1.05, Math.sin(a) * rc * 1.05, tb);
    rib.rotation.z = a; void rr;
  }
  const ins = 0.09 * bm;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {        // anchor bolts with washer + nut
    const x = sx * (BL / 2 - ins), y = sy * (BW / 2 - ins);
    add(gB, g3.cyl(0.055 * bm, 0.012 * bm, "z", 20), "bolt", x, y, tb + 0.006 * bm);
    add(gB, g3.cyl(0.036 * bm, 0.03 * bm, "z", 6), "bolt", x, y, tb + 0.027 * bm);
    add(gB, g3.cyl(0.018 * bm, 0.035 * bm, "z", 12), "metal", x, y, tb + 0.05 * bm);
  }
  // cable inlet at the rear (power, encoder, customer air + signals)
  const ib = { x: -(rc * 1.1 + 0.12 * rc), sx: 0.26 * rc, sy: 0.75 * rc, sz: 0.62 * (hb - tb) };
  add(gB, g3.box(ib.sx, ib.sy, ib.sz), "cast2", ib.x, 0, tb + ib.sz / 2);
  add(gB, g3.cyl(0.12 * rc, 0.12 * rc, "x", 20), "conn", ib.x - ib.sx / 2 - 0.06 * rc, 0.18 * rc, tb + ib.sz * 0.55);
  add(gB, g3.cyl(0.09 * rc, 0.12 * rc, "x", 20), "conn", ib.x - ib.sx / 2 - 0.06 * rc, -0.2 * rc, tb + ib.sz * 0.55);
  if (!ghost) {
    // power + signal cables from the base inlet to the controller (on the floor; down the pedestal if there is one)
    const gc = part(base, "cable"), lc = 0.5 * BL, xe = ib.x - ib.sx / 2 - 0.12 * rc - lc, ped = C.pedestal || 0;
    [[0.075 * rc, 0.18 * rc], [0.055 * rc, -0.2 * rc]].forEach(([r, y]) => {
      add(gc, g3.cyl(r, lc, "x", 12), "cable", xe + lc / 2, y, r + 1);
      if (ped > 0) add(gc, g3.cyl(r, ped, "z", 12), "cable", xe - r, y, -ped / 2 + r);
      else add(gc, g3.cyl(r, 0.6 * BL, "x", 12), "cable", xe - 0.3 * BL, y, r + 1);
    });
  }
  // J1 reducer: housing on the base, output ring turns with the column (drawn in the base, it is the bearing ring)
  const gJ1r = part(base, "j1");
  add(gJ1r, g3.cyl(rc * 0.985, 0.22 * hubH, "z", 48), "metal", 0, 0, hb + 0.11 * hubH);

  /* ---- column (F0, turns with J1) */
  const col = link("col"), gC = part(col, "j1");
  add(gC, g3.cyl(rc * 0.95, 0.78 * hubH, "z", 48), "cast2", 0, 0, hb + 0.22 * hubH + 0.39 * hubH);
  const cz = z0c + 0.5 * rc;
  add(gC, g3.hull([[-0.86 * rc, z0c, 0.01], [0.86 * rc, z0c, 0.01], [-0.45 * rc, cz, 0.5 * rc], [0.36 * rc, cz, 0.5 * rc], [a1, h1, rs * 1.02]], 2 * wc, 0.08 * rs), "cast");
  add(gC, g3.cyl(rs * 0.86, 2 * wc + 0.04 * rs, "y", 40), "cast2", a1, 0, h1);      // shoulder boss (J2 bearing seat)
  // J1 motor (vertical, at the column rear) – small robots: hidden inside
  if (!small) {
    sub.j1m = new THREE.Group(); gC.add(sub.j1m);
    motor(sub.j1m, 0.2 * rs, 0.9 * rs, "z", -(0.93 * rc + 0.04 * rs), 0, z0c + 0.02 * rs, 1);
  }
  // J2 drive: RV reducer ring between column and lower arm + servo motor on the opposite side of the column
  sub.j2r = part(col, "j2");
  add(sub.j2r, g3.cyl(rs * 0.8, gap * 1.6, "y", 40), "metal", a1, sL * (wc + gap / 2), h1);
  sub.j2m = part(col, "j2");
  add(sub.j2m, g3.cyl(rs * (small ? 0.72 : 0.66), 0.16 * rs, "y", 40), "cast2", a1, -sL * (wc + 0.08 * rs), h1);
  if (!small) motor(sub.j2m, 0.38 * rs, 0.95 * rs, "y", a1, -sL * (wc + 0.16 * rs), h1, -sL);
  else add(sub.j2m, g3.cyl(rs * 0.5, 0.08 * rs, "y", 40), "cast", a1, -sL * (wc + 0.2 * rs), h1);
  // balancing device: lug on the column rear (pin C)
  const pinC = new THREE.Vector3(a1 - 0.55 * a2, sL * yl, h1 - 0.15 * a2), pinA = new THREE.Vector3(-0.45 * rL0, sL * yl, 0.12 * a2 + 0.25 * rL0);
  if (rb.balancer) {
    const gl = part(col, "bal"), y0 = sL * wc * 0.5, y1 = sL * (yl + wl * 0.35);
    add(gl, g3.hull([[pinC.x, pinC.z, 0.24 * rs], [-0.4 * rc, pinC.z - 0.25 * rs, 0.3 * rs], [-0.1 * rc, pinC.z + 0.1 * rs, 0.2 * rs]], Math.abs(y1 - y0), 0.04 * rs), "cast", 0, (y0 + y1) / 2, 0);
    for (const s of [-1, 1]) add(gl, g3.cyl(0.13 * rs, 0.1 * rs, "y", 24), "metal", pinC.x, sL * yl + s * 0.33 * rs, pinC.z);
  }

  /* ---- lower arm (F1, J2 axis = local Y) */
  const larm = link("larm"), gA = part(larm, "larm");
  const armC = [[0, 0, rL0], [0, a2, rL1]];
  add(gA, g3.hull(armC, wl, 0.1 * rs), "cast", 0, sL * yl, 0);
  add(gA, g3.hull([[0, 0.22 * a2, 0.55 * rL0], [0, 0.78 * a2, 0.55 * rL1]], 0.05 * rs, 0.015 * rs), "cast2", 0, sL * (yl + wl / 2 + 0.02 * rs), 0);   // raised rib
  add(gA, g3.cyl(rL0 * 0.72, wl + 0.06 * rs, "y", 40), "cast2", 0, sL * yl, 0);
  add(gA, g3.cyl(rL1 * 0.78, wl + 0.05 * rs, "y", 40), "cast2", 0, sL * yl, a2);
  if (rb.balancer) {
    const gp = part(larm, "bal");
    add(gp, g3.cyl(0.1 * rs, wl * 1.08, "y", 20), "metal", pinA.x, sL * yl, pinA.z);
  }
  // J3 drive: reducer + motor on the outer side of the lower arm top, reducer ring between arm and upper-arm housing
  sub.j3m = part(larm, "j3");
  add(sub.j3m, g3.cyl(rL1 * 0.95, 0.14 * rs, "y", 40), "cast2", 0, sL * (yl + wl / 2 + 0.07 * rs), a2);
  if (!small) motor(sub.j3m, 0.3 * rs, 0.75 * rs, "y", 0, sL * (yl + wl / 2 + 0.14 * rs), a2, sL);
  else add(sub.j3m, g3.cyl(rL1 * 0.6, 0.06 * rs, "y", 40), "cast", 0, sL * (yl + wl / 2 + 0.17 * rs), a2);
  sub.j3r = part(larm, "j3");
  add(sub.j3r, g3.cyl(rE * 0.82, gap * 1.6, "y", 40), "metal", 0, sL * (wu + gap / 2), a2);

  /* ---- upper arm housing (F2, J3 axis = local Y; forearm axis at z = a3 along +X) */
  const uarm = link("uarm"), gU = part(uarm, "uarm");
  add(gU, g3.hull([[0, 0, rE], [-rear, a3, rU], [front, a3, rU * 0.92]], 2 * wu, 0.1 * rs), "cast");
  add(gU, g3.cyl(rE * 0.7, 2 * wu + 0.05 * rs, "y", 40), "cast2", 0, 0, 0);
  add(gU, g3.cyl(rf0 * 1.1, 0.05 * d4, "x", 40), "cast2", front + 0.85 * rU - 0.025 * d4, 0, a3);    // J4 bearing collar
  if (!small) {                                                // J4 / J5 / J6 motors at the rear
    sub.rear = part(uarm, "motor"), sub.rearX = 0;
    const xm = -rear - 0.55 * rU, mr = 0.19 * rs, ml = 0.7 * rs;
    motor(sub.rear, mr, ml, "x", xm, 0, a3 + 0.42 * rU, -1);
    motor(sub.rear, mr * 0.9, ml * 0.9, "x", xm, -0.5 * wu, a3 - 0.32 * rU, -1);
    motor(sub.rear, mr * 0.9, ml * 0.9, "x", xm, 0.5 * wu, a3 - 0.32 * rU, -1);
  } else add(gU, g3.cyl(rU * 0.75, 0.06 * rs, "x", 36), "cast2", -rear - rU + 0.01 * rs, 0, a3);

  /* ---- forearm tube (F3, rotates with J4) + wrist fork */
  const farm = link("farm"), gF = part(farm, "farm");
  add(gF, g3.cyl(rf0, xb - xa, "x", 40, rf1), "cast", (xa + xb) / 2, 0, 0);
  add(gF, g3.cyl(rf1 * 1.03, 0.035 * d4, "x", 40), "cast2", xb, 0, 0);
  add(gF, g3.cyl(rf0 * 1.02, 0.03 * d4, "x", 40), "metal", xa + 0.012 * d4, 0, 0);
  if (!ghost) add(part(farm, "cable"), g3.box(0.1 * d4, 0.3 * rw, 0.12 * rw), "cast2", 0.72 * d4, 0, rf1 + 0.02 * rw);
  const gW = part(farm, "wrist"), py = rw * 1.04 + pt / 2;
  for (const s of [-1, 1]) {
    add(gW, g3.hull([[xb - 0.15 * rw, 0, rf1 * 0.82], [d4, 0, rw * 0.95]], pt, 0.06 * rw), "cast", 0, s * py, 0);
    add(gW, g3.cyl(rw * 0.55, 0.08 * rw, "y", 28), "cast2", d4, s * (py + pt / 2 + 0.03 * rw), 0);
  }

  /* ---- wrist (F4, J5 bend) */
  const wrist = link("wrist"), gWr = part(wrist, "wrist");
  add(gWr, g3.cyl(rw * 0.93, 2 * rw, "y", 36), "cast2");
  add(gWr, g3.cyl(rw * 0.8, d6 - tf, "x", 36, rw * 0.66), "cast", (d6 - tf) / 2, 0, 0);
  add(gWr, g3.cyl(rw * 0.69, 0.06 * rw, "x", 36), "rubber", d6 - tf - 0.03 * rw, 0, 0);

  /* ---- flange (F5, Z out of the flange, J6) */
  const fl = link("flange"), gFl = part(fl, "flange");
  add(gFl, g3.cyl(rfl, tf, "z", 40), "metal", 0, 0, -tf / 2);
  add(gFl, g3.cyl(rfl * 0.3, 0.02 * rw, "z", 24), "bolt", 0, 0, 0.005 * rw);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(gFl, g3.cyl(rfl * 0.075, 0.02 * rw, "z", 10), "bolt", Math.cos(a) * rfl * 0.74, Math.sin(a) * rfl * 0.74, 0.005 * rw); }
  add(gFl, g3.cyl(rfl * 0.06, 0.12 * rw, "z", 10), "alu", Math.cos(TAU / 12) * rfl * 0.55, Math.sin(TAU / 12) * rfl * 0.55, 0.04 * rw);   // dowel pin

  /* ---- gripper (on the flange frame) */
  const grip = link("grip"), gG = part(grip, "grip");
  const zb1 = TL - 0.12 * ph, zA = Math.max(0.1 * zb1, 6), bw = 1.3 * pd, bd = 0.6 * pd;
  add(gG, g3.cyl(Math.max(rfl * 1.05, 0.33 * pd), zA, "z", 36), "alu", 0, 0, zA / 2);
  add(gG, g3.box(bw, bd, zb1 - zA - 0.06 * ph), "alu", 0, 0, (zA + zb1 - 0.06 * ph) / 2);
  add(gG, g3.box(bw * 1.04, bd * 0.55, 0.06 * ph), "metal", 0, 0, zb1 - 0.03 * ph);            // finger guide
  for (const s of [-1, 1]) add(gG, g3.cyl(0.07 * pd, 0.08 * pd, "y", 12), "conn", s * 0.3 * bw, bd / 2 + 0.04 * pd, (zA + zb1) / 2);  // air fittings
  add(gG, g3.box(0.12 * pd, 0.1 * pd, 0.16 * pd), "motor", -bw / 2 + 0.1 * pd, -bd / 2 - 0.05 * pd, zb1 - 0.12 * pd);  // position sensor
  const fingers = [];
  const ft = 0.14 * pd, fw = 0.42 * pd, f0 = zb1 - 0.06 * ph, f1 = TL + 0.45 * ph, padT = 0.035 * pd;
  for (const s of [-1, 1]) {
    const fg = new THREE.Group(); gG.add(fg); fg.userData.s = s;
    add(fg, g3.box(ft, fw, f1 - f0), "finger", s * (padT + ft / 2), 0, (f0 + f1) / 2);
    add(fg, g3.box(ft * 1.1, fw * 1.15, 0.08 * ph), "finger", s * (padT + ft * 0.55), 0, f0 + 0.04 * ph);
    add(fg, g3.box(padT, fw * 0.9, 0.42 * ph), "rubber", s * padT / 2, 0, TL + 0.22 * ph);
    fingers.push(fg);
  }

  /* ---- balancing device (between pin C on the column and pin A on the lower arm) */
  let bal = null;
  if (rb.balancer) {
    const loc = (q2) => { const c = Math.cos(q2), s = Math.sin(q2); return new THREE.Vector3(a1 + c * pinA.x + s * pinA.z, 0, h1 - s * pinA.x + c * pinA.z); };
    let Lmin = 1e9, Lmax = 0;
    for (let q = rb.lim[1][0]; q <= rb.lim[1][1]; q += 2) { const p = loc(q * Math.PI / 180); const l = Math.hypot(p.x - pinC.x, p.z - pinC.z); Lmin = Math.min(Lmin, l); Lmax = Math.max(Lmax, l); }
    // trunnion-mounted spring cylinder: tube from −t0 (behind pin C) to t1, piston rod from pin A back into the tube
    const rb0 = 0.2 * rs, t1 = Math.max(0.5 * rs, 0.85 * Lmin - 0.2 * rs), rodL = Lmax - t1 + 0.12 * Lmax, t0 = Math.max(0.15 * rs, rodL - Lmin + 0.1 * rs), tl = t0 + t1;
    const gb = link("bal"), gBp = part(gb, "bal");
    add(gBp, g3.cyl(rb0, tl, "y", 32), "cast2", 0, (t1 - t0) / 2, 0);
    add(gBp, g3.cyl(rb0 * 1.12, 0.07 * tl, "y", 32), "cast", 0, -t0 + 0.035 * tl, 0);
    add(gBp, g3.cyl(rb0 * 1.12, 0.07 * tl, "y", 32), "cast", 0, t1 - 0.035 * tl, 0);
    for (let i = 1; i < 6; i++) add(gBp, g3.cyl(rb0 * 1.04, 0.015 * tl, "y", 32), "motorCap", 0, -t0 + tl * i / 6, 0);
    add(gBp, g3.cyl(0.26 * rs, 0.5 * rs, "z", 24), "cast", 0, 0, 0);            // trunnion at pin C (pin along robot Y = local z)
    const rod = new THREE.Group(); gBp.add(rod);
    add(rod, g3.cyl(rb0 * 0.42, rodL, "y", 20), "metal", 0, -rodL / 2 - 0.1 * rs, 0);
    add(rod, g3.cyl(0.15 * rs, 0.3 * rs, "z", 24), "cast", 0, 0, 0);            // eye at pin A
    bal = { g: gb, rod, L: 0 };
  }

  /* ---- cable harness + customer air hose (bezier segments, instanced cylinders) */
  let cables = null;
  if (!ghost) {
    const unit = G.get("unitcyl", () => new THREE.CylinderGeometry(1, 1, 1, 10, 1));
    const mk = (mn, n, r) => { const im = new THREE.InstancedMesh(unit, M[mn], n); im.frustumCulled = false; im.castShadow = true; im.userData.part = "cable"; im.userData.r = r; root.add(im); (P.cable || (P.cable = [])).push(im); return im; };
    const rh = 0.1 * rs;
    const ox = sL * (yl + wl / 2 + rh + 0.02 * rs);
    cables = {
      harness: mk("cable", 30, rh), hose: mk("hose", 16, Math.max(3, 0.035 * rs)),
      p: {   // control points in link frames
        P2: ["col", new THREE.Vector3(a1 - 1.05 * rs, sL * 0.55 * wc, h1 + 0.25 * rs)],
        P3: ["larm", new THREE.Vector3(-0.5 * rL0, ox, 0.22 * a2)],
        P4: ["larm", new THREE.Vector3(-0.35 * rL1, ox, 0.86 * a2)],
        P5: ["uarm", new THREE.Vector3(-rear * 0.55, sL * 0.55 * wu, a3 + rU * 0.98)],
        H0: ["uarm", new THREE.Vector3(-rear * 0.15, sL * 0.25 * wu, a3 + rU * 1.02)],
        Hc: ["farm", new THREE.Vector3(0.3 * d4, 0, rf0 + 0.15 * rw)],
        H1: ["farm", new THREE.Vector3(0.72 * d4, 0, rf1 + 0.12 * rw)],
        Hd: ["wrist", new THREE.Vector3(-0.2 * rw, 0, 2.4 * rw)],
        H2: ["grip", new THREE.Vector3(0, bd / 2 + 0.1 * pd, (zA + zb1) / 2)],
      },
    };
    // a clamp on the column top where the harness comes out of the hollow J1 / column
    const gcl = part(col, "cable");
    add(gcl, g3.box(0.35 * rs, 0.3 * rs, 0.3 * rs), "cast2", a1 - 1.05 * rs, sL * 0.55 * wc, h1 + 0.08 * rs);
    const gcu = part(uarm, "cable");
    add(gcu, g3.box(0.3 * rs, 0.26 * rs, 0.12 * rs), "cast2", -rear * 0.55, sL * 0.55 * wu, a3 + rU * 0.93);
  }

  const R = { root, L, P, sub, fingers, bal, cables, dim: { rs, sL, h1, a2, d4, rw, wc, wl, yl, rc, hb, TL, pd, ph, rear, rU, small } };
  const ex = { col: 0.3 * h1, larm: 1.5 * wl + 0.3 * rs, uarm: 1.3 * wc, uarmZ: 0.12 * a2, farm: 0.25 * d4, wrist: 2.4 * rw, flange: 1.6 * rw, grip: 1.6 * rw + 0.25 * ph };
  const o = Array.from({ length: 7 }, () => new THREE.Vector3()), tv = new THREE.Vector3();
  const axv = (F, j) => tv.set(F[j], F[4 + j], F[8 + j]);
  const setM = (g, F, v) => { g.matrix.set(F[0], F[1], F[2], F[3] + v.x, F[4], F[5], F[6], F[7] + v.y, F[8], F[9], F[10], F[11] + v.z, 0, 0, 0, 1); g.matrixWorldNeedsUpdate = true; };
  const pC = new THREE.Vector3(), pA = new THREE.Vector3(), bx = new THREE.Vector3(), by = new THREE.Vector3(), bz = new THREE.Vector3();
  // cable helpers
  const q0 = new THREE.Vector3(), q1 = new THREE.Vector3(), q2 = new THREE.Vector3(), qa = new THREE.Vector3(), qb = new THREE.Vector3(), qd = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0), qq = new THREE.Quaternion(), sc = new THREE.Vector3(), m4 = new THREE.Matrix4();
  const wp = (key, out) => { const [ln, v] = cables.p[key]; return out.copy(v).applyMatrix4(L[ln].matrix); };
  const bez = (t, a, c, b, out) => { const u = 1 - t; return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z); };
  const seg = (im, i0, n, a, c, b) => {
    const r = im.userData.r;
    for (let i = 0; i < n; i++) {
      bez(i / n, a, c, b, qa); bez((i + 1) / n, a, c, b, qb);
      qd.subVectors(qb, qa); const len = qd.length() || 1; qd.multiplyScalar(1 / len);
      qq.setFromUnitVectors(UP, qd); sc.set(r, len * 1.04, r); qa.add(qb).multiplyScalar(0.5);
      m4.compose(qa, qq, sc); im.setMatrixAt(i0 + i, m4);
    }
  };
  R.update = (f, e, grip, holding) => {
    const F = f.frames;
    o[0].set(0, 0, e * ex.col);
    o[1].copy(o[0]).addScaledVector(axv(F[1], 1), sL * e * ex.larm);
    o[2].copy(o[1]).addScaledVector(axv(F[2], 1), -sL * e * ex.uarm).addScaledVector(axv(F[2], 2), e * ex.uarmZ);
    o[3].copy(o[2]).addScaledVector(axv(F[3], 0), e * ex.farm);
    o[4].copy(o[3]).addScaledVector(axv(F[3], 0), e * ex.wrist);
    o[5].copy(o[4]).addScaledVector(axv(F[5], 2), e * ex.flange);
    o[6].copy(o[5]).addScaledVector(axv(F[5], 2), e * ex.grip);
    setM(L.col, F[0], o[0]); setM(L.larm, F[1], o[1]); setM(L.uarm, F[2], o[2]); setM(L.farm, F[3], o[3]);
    setM(L.wrist, F[4], o[4]); setM(L.flange, F[5], o[5]); setM(L.grip, F[5], o[6]);
    if (sub.j1m) sub.j1m.position.x = -e * 0.6 * rs;
    sub.j2m.position.y = -sL * e * 1.1 * rs; sub.j2r.position.y = sL * e * 0.5 * ex.larm;
    sub.j3m.position.y = sL * e * 1.0 * rs; sub.j3r.position.y = -sL * e * 0.5 * ex.uarm;
    if (sub.rear) sub.rear.position.x = -e * 0.9 * rs;
    // gripper fingers
    const gOpen = pd * 1.4, gClose = holding ? pd : pd * 0.72, gw = lerp(gOpen, gClose, clamp(grip, 0, 1));
    for (const fg of fingers) fg.position.x = fg.userData.s * gw / 2;
    // balancer
    if (bal) {
      pC.copy(pinC).applyMatrix4(L.col.matrix); pA.copy(pinA).applyMatrix4(L.larm.matrix);
      by.subVectors(pA, pC); const Lb = by.length(); by.multiplyScalar(1 / (Lb || 1)); bal.L = Lb;
      bz.set(F[0][1], F[0][5], F[0][9]); bx.crossVectors(by, bz).normalize(); bz.crossVectors(bx, by);
      bal.g.matrix.makeBasis(bx, by, bz); bal.g.matrix.setPosition(pC.x - e * 0.4 * rs * F[0][0], pC.y - e * 0.4 * rs * F[0][4], pC.z);
      bal.g.matrixWorldNeedsUpdate = true; bal.rod.position.y = Lb;
    }
    // cables (hidden in the exploded view)
    if (cables) {
      const on = e < 0.03; cables.harness.visible = on; cables.hose.visible = on;
      if (on) {
        const H = cables.harness;
        wp("P2", q0); wp("P3", q2); q1.addVectors(q0, q2).multiplyScalar(0.5).addScaledVector(axv(F[0], 2), 0.55 * rs).addScaledVector(axv(F[0], 0), -0.35 * rs);
        seg(H, 0, 10, q0, q1, q2);
        wp("P4", q0); q1.addVectors(q0, q2).multiplyScalar(0.5); seg(H, 10, 8, q2, q1, q0);
        wp("P5", q2); q1.addVectors(q0, q2).multiplyScalar(0.5).addScaledVector(axv(F[1], 2), 0.3 * rs).addScaledVector(axv(F[1], 0), -0.45 * rs).addScaledVector(axv(F[1], 1), sL * 0.2 * rs);
        seg(H, 18, 12, q0, q1, q2);
        H.instanceMatrix.needsUpdate = true;
        const Hs = cables.hose;
        wp("H0", q0); wp("Hc", q1); wp("H1", q2); seg(Hs, 0, 8, q0, q1, q2);
        wp("Hd", q1); wp("H2", q0); seg(Hs, 8, 8, q2, q1, q0); Hs.instanceMatrix.needsUpdate = true;
      }
    }
  };
  return R;
}

/* ------------------------------------------------------------------ the machine-tending cell */
function buildCell(rb, C, M, G, R) {
  const g3 = Geo(G), root = new THREE.Group(), zf = -C.pedestal, k = C.k, pd = C.part.d, ph = C.part.h;
  const add = (parent, geo, mn, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, typeof mn === "string" ? M[mn] : mn); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };
  const boxAt = (parent, mn, xa, xb, ya, yb, za, zb, cast = true) => add(parent, g3.box(Math.abs(xb - xa), Math.abs(yb - ya), Math.abs(zb - za)), mn, (xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2, cast);
  const Fc = C.fence, Mc = C.machine, dyn = {};
  // floor + grid
  const fx0 = Fc.x0 - 1500 * k - 800, fx1 = Mc.x1 + 1200 * k + 600, fy = Math.max(Math.abs(Fc.y0), Fc.y1) + 1400 * k + 600;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0, 2 * fy), M.floor); floor.position.set((fx0 + fx1) / 2, 0, zf); floor.receiveShadow = true; floor.userData.noPick = true; root.add(floor); if (window.dtTheme) window.dtTheme.floor(M.floor);
  const gs = Math.ceil(Math.max(fx1 - fx0, 2 * fy) / 500) * 500;
  const grid = new THREE.GridHelper(gs, gs / 500, 0x9ea6ad, 0xb7bdc2); grid.rotation.x = Math.PI / 2; grid.position.set(Math.round((fx0 + fx1) / 1000) * 500, 0, zf + 1);
  grid.material.transparent = true; grid.material.opacity = 0.55; grid.userData.noPick = true; root.add(grid);
  // safety marking on the floor inside the fence (yellow line)
  const lineM = new THREE.MeshStandardMaterial({ color: 0xd8a400, roughness: 0.8 }); dyn.lineM = lineM;
  const lw = 60, ins = 150;
  [[Fc.x0 + ins, Fc.x1 - 20, Fc.y0 + ins, Fc.y0 + ins + lw], [Fc.x0 + ins, Fc.x1 - 20, Fc.y1 - ins - lw, Fc.y1 - ins], [Fc.x0 + ins, Fc.x0 + ins + lw, Fc.y0 + ins, Fc.y1 - ins]].forEach(([a, b, c, d]) => { const m = boxAt(root, lineM, a, b, c, d, zf, zf + 2, false); m.castShadow = false; });
  // pedestal
  if (C.pedestal > 0) {
    const [BL, BW] = rb.base, p = C.pedestal;
    boxAt(root, "ped", -BL * 0.75, BL * 0.75, -BW * 0.75, BW * 0.75, zf, zf + 25);
    boxAt(root, "ped", -BL * 0.5, BL * 0.5, -BW * 0.5, BW * 0.5, zf + 25, -25);
    boxAt(root, "ped", -BL * 0.68, BL * 0.68, -BW * 0.68, BW * 0.68, -25, 0);
    void p;
  }
  // conveyors
  dyn.belts = []; dyn.rollers = [];
  const conveyor = (cv, isIn) => {
    const x = cv.x0, ya = Math.min(cv.y0, cv.y1), yb = Math.max(cv.y0, cv.y1), len = yb - ya, w = cv.w, zt = cv.z, fh = Math.max(90, 0.3 * w), ym = (ya + yb) / 2;
    const g = new THREE.Group(); root.add(g);
    for (const s of [-1, 1]) {
      boxAt(g, "profile", x + s * (w / 2 + 0.02 * w), x + s * (w / 2 + 0.09 * w), ya - 0.04 * w, yb + 0.04 * w, zt - fh, zt + 0.03 * w);
      // side guide rail for the parts
      boxAt(g, "profile", x + s * (pd / 2 + 0.12 * pd), x + s * (pd / 2 + 0.16 * pd), ya, yb, zt + 0.22 * ph, zt + 0.3 * ph);
      for (let y = ya + 200; y < yb - 100; y += 600) boxAt(g, "leg", x + s * (pd / 2 + 0.16 * pd), x + s * (w / 2 + 0.09 * w), y - 12, y + 12, zt + 0.24 * ph, zt + 0.28 * ph);
    }
    const tex = M.beltTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, len / 100);
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const belt = boxAt(g, bm, x - w / 2, x + w / 2, ya, yb, zt - 0.03 * w, zt); belt.castShadow = false;
    dyn.belts.push({ tex, mat: bm, dir: cv.dir });
    for (const y of [ya, yb]) { const r = 0.03 * w + 0.5 * 0.03 * w; const rl = add(g, g3.cyl(r, w, "x", 20), "metal", x, y, zt - r); dyn.rollers.push({ m: rl, r }); }
    const nl = Math.max(2, Math.ceil(len / 1000) + 1);
    for (let i = 0; i < nl; i++) {
      const y = lerp(ya + 80, yb - 80, i / (nl - 1));
      for (const s of [-1, 1]) boxAt(g, "leg", x + s * (w / 2 + 0.02 * w), x + s * (w / 2 + 0.02 * w) + s * 40, y - 20, y + 20, zf, zt - fh);
      boxAt(g, "leg", x - w / 2, x + w / 2, y - 15, y + 15, zf + 180, zf + 210);
      for (const s of [-1, 1]) boxAt(g, "rubber", x + s * (w / 2 + 0.02 * w) + s * 20 - 35, x + s * (w / 2 + 0.02 * w) + s * 20 + 35, y - 35, y + 35, zf, zf + 12);
    }
    // drive motor + gearbox at the far end
    const ym2 = yb - 0.03 * w - 60;
    add(g, g3.cyl(0.13 * w, 0.32 * w, "x", 20), "motor", x + w / 2 + 0.09 * w + 0.16 * w + 30, ym2, zt - fh * 0.45);
    boxAt(g, "leg", x + w / 2 + 0.09 * w, x + w / 2 + 0.09 * w + 40, ym2 - 0.12 * w, ym2 + 0.12 * w, zt - fh * 0.75, zt - fh * 0.15);
    if (isIn) {   // end stop + part sensor at the pick position
      const ys = cv.pick[1] - pd / 2 - 6;
      boxAt(g, "profile", x - w / 2 - 0.05 * w, x + w / 2 + 0.05 * w, ys - 18, ys, zt + 2, zt + 0.25 * ph);
      add(g, g3.box(40, 30, 30), "motor", x + w / 2 + 0.12 * w, ys + pd / 2, zt + 0.15 * ph);
    }
    void ym;
  };
  conveyor(C.infeed, true); conveyor(C.outfeed, false);
  // machine (CNC lathe – example) with sliding door on its −X face
  const mz1 = zf + Mc.h, D = Mc.door, tw = 40, mg = new THREE.Group(); root.add(mg);
  boxAt(mg, "panelD", Mc.x0, Mc.x1, Mc.y0, Mc.y1, zf, zf + 140);
  boxAt(mg, "panel", Mc.x0, Mc.x0 + tw, Mc.y0, D.y0, zf + 140, mz1);
  boxAt(mg, "panel", Mc.x0, Mc.x0 + tw, D.y1, Mc.y1, zf + 140, mz1);
  boxAt(mg, "panel", Mc.x0, Mc.x0 + tw, D.y0, D.y1, zf + 140, D.z0);
  boxAt(mg, "panel", Mc.x0, Mc.x0 + tw, D.y0, D.y1, D.z1, mz1);
  boxAt(mg, "panel", Mc.x1 - tw, Mc.x1, Mc.y0, Mc.y1, zf + 140, mz1);
  boxAt(mg, "panel", Mc.x0, Mc.x1, Mc.y0, Mc.y0 + tw, zf + 140, mz1);
  boxAt(mg, "panel", Mc.x0, Mc.x1, Mc.y1 - tw, Mc.y1, zf + 140, mz1);
  boxAt(mg, "panel", Mc.x0, Mc.x1, Mc.y0, Mc.y1, mz1 - tw, mz1);
  boxAt(mg, "panelD", Mc.x0 - 6, Mc.x0, Mc.y0, Mc.y1, mz1 - 260, mz1 - 200, false);          // dark band
  for (const s of [-1, 1]) {
    const yw = s > 0 ? Mc.y1 : Mc.y0, xw0 = Mc.x0 + 0.25 * (Mc.x1 - Mc.x0), xw1 = Mc.x0 + 0.7 * (Mc.x1 - Mc.x0);
    boxAt(mg, "panelD", xw0 - 30, xw1 + 30, yw - 4 * s, yw + 4 * s, D.z0 - 30, D.z1 + 30, false);
    boxAt(mg, "glass", xw0, xw1, yw + 5 * s, yw + 7 * s, D.z0, D.z1, false);
    boxAt(mg, "panelD", Mc.x0 - 6 + (Mc.x0 - Mc.x0), Mc.x1, yw - 3 * s, yw + 3 * s, mz1 - 260, mz1 - 200, false);
    boxAt(mg, "panelD", Mc.x0 + 0.85 * (Mc.x1 - Mc.x0), Mc.x0 + 0.85 * (Mc.x1 - Mc.x0) + 8, yw - 3 * s, yw + 3 * s, zf + 140, mz1 - 260, false);
  }
  const inner = new THREE.Mesh(g3.box(Mc.x1 - Mc.x0 - 2 * tw - 4, Mc.y1 - Mc.y0 - 2 * tw - 4, Mc.h - 140 - tw - 4), M.inner);
  inner.position.set((Mc.x0 + Mc.x1) / 2, 0, (zf + 140 + mz1 - tw) / 2); mg.add(inner);
  // inside: machine bed, headstock, chuck with 3 jaws gripping the part flange
  const fxp = Mc.fixture;
  boxAt(mg, "panelD", Mc.x0 + tw + 80, Mc.x1 - tw - 60, -0.6 * (D.y1 - D.y0) / 2, 0.6 * (D.y1 - D.y0) / 2, zf + 140, fxp[2] - 0.75 * pd - 60);
  const xc = fxp[0] + ph / 2, chL = 0.42 * pd, rch = 0.85 * pd;
  boxAt(mg, "panelD", xc + chL + 20, xc + chL + 20 + Math.max(300, 1.6 * pd), -rch * 1.3, rch * 1.3, fxp[2] - 0.75 * pd - 60, fxp[2] + rch * 1.25);
  add(mg, g3.cyl(rch, chL, "x", 36), "chuck", xc + chL / 2 + 20, fxp[1], fxp[2]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 2, rj = 0.62 * pd + 0.09 * pd;
    const j = add(mg, g3.box(0.24 * ph + 20, 0.16 * pd, 0.18 * pd), "metal", xc - 0.12 * ph + 10, fxp[1] + Math.cos(a) * rj, fxp[2] + Math.sin(a) * rj);
    j.rotation.x = a - Math.PI / 2;
  }
  // tool turret (example)
  add(mg, g3.cyl(0.6 * pd, 0.5 * pd, "z", 8), "chuck", fxp[0], fxp[1] - 0.9 * (D.y1 - D.y0) / 2, fxp[2] - 0.25 * pd);
  // sliding door (slides to −Y), frame + window + handle
  const dw = D.y1 - D.y0 + 80, dh = D.z1 - D.z0 + 80, dx = Mc.x0 - 32, door = new THREE.Group(); mg.add(door);
  boxAt(door, "frame", -14, 14, -dw / 2, -dw / 2 + 70, -dh / 2, dh / 2); boxAt(door, "frame", -14, 14, dw / 2 - 70, dw / 2, -dh / 2, dh / 2);
  boxAt(door, "frame", -14, 14, -dw / 2, dw / 2, -dh / 2, -dh / 2 + 70); boxAt(door, "frame", -14, 14, -dw / 2, dw / 2, dh / 2 - 70, dh / 2);
  const gl = boxAt(door, "glass", -6, 6, -dw / 2 + 70, dw / 2 - 70, -dh / 2 + 70, dh / 2 - 70, false); gl.userData.noPick = true;
  add(door, g3.cyl(14, 200, "z", 12), "metal", -40, dw / 2 - 40, 0); boxAt(door, "metal", -40, -14, dw / 2 - 52, dw / 2 - 28, -110, -90); boxAt(door, "metal", -40, -14, dw / 2 - 52, dw / 2 - 28, 90, 110);
  boxAt(mg, "metal", dx - 30, dx + 10, D.y0 - (D.y1 - D.y0) - 60, D.y1 + 60, D.z1 + 40, D.z1 + 80);     // door rail
  dyn.door = { g: door, y0: (D.y0 + D.y1) / 2, travel: D.y1 - D.y0 + 20, x: dx, z: (D.z0 + D.z1) / 2 };
  door.position.set(dx, dyn.door.y0, dyn.door.z);
  // operator panel (HMI) + signal tower
  const hy = (D.y1 + Mc.y1) / 2, hz = zf + 1250;
  boxAt(mg, "panelD", Mc.x0 - 90, Mc.x0, hy - 230, hy + 230, hz - 300, hz + 300);
  boxAt(mg, "screen", Mc.x0 - 94, Mc.x0 - 88, hy - 180, hy + 180, hz + 20, hz + 260, false);
  add(mg, g3.cyl(28, 30, "x", 16), "red", Mc.x0 - 105, hy + 150, hz - 200);
  const tx = Mc.x0 + 120, ty = Mc.y1 - 120;
  add(mg, g3.cyl(14, 240, "z", 10), "metal", tx, ty, mz1 + 120);
  ["green", "amber", "red"].forEach((c, i) => add(mg, g3.cyl(45, 90, "z", 20), c, tx, ty, mz1 + 260 + i * 95));
  // safety fence with mesh panels and a gate
  const fg = new THREE.Group(); root.add(fg);
  const H = Fc.h, post = 50, panelZ0 = zf + 120, panelZ1 = zf + H - 40;
  let sg = fg; const sides = [];
  const panel = (xa, ya, xb, yb) => {
    const len = Math.hypot(xb - xa, yb - ya); if (len < 30) return;
    const geo = new THREE.PlaneGeometry(len, panelZ1 - panelZ0); const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 100, uv.getY(i) * (panelZ1 - panelZ0) / 100);
    geo.rotateX(Math.PI / 2); dyn.geos.push(geo);
    const m = new THREE.Mesh(geo, M.mesh); m.position.set((xa + xb) / 2, (ya + yb) / 2, (panelZ0 + panelZ1) / 2); m.rotation.z = Math.atan2(yb - ya, xb - xa); sg.add(m);
    for (const z of [panelZ0, panelZ1]) { const r = add(sg, g3.box(len, 25, 25), "rail", (xa + xb) / 2, (ya + yb) / 2, z, false); r.rotation.z = m.rotation.z; }
  };
  dyn.geos = [];
  const newSide = (nx, ny, px, py) => { sg = new THREE.Group(); fg.add(sg); sides.push({ g: sg, nx, ny, px, py, faded: false }); };
  const side = (xa, ya, xb, yb) => {
    const len = Math.hypot(xb - xa, yb - ya), n = Math.max(1, Math.ceil(len / 1400));
    for (let i = 0; i <= n; i++) { const t = i / n; boxAt(sg, "post", lerp(xa, xb, t) - post / 2, lerp(xa, xb, t) + post / 2, lerp(ya, yb, t) - post / 2, lerp(ya, yb, t) + post / 2, zf, zf + H); }
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n, e = post / 2 / len; panel(lerp(xa, xb, t0 + e), lerp(ya, yb, t0 + e), lerp(xa, xb, t1 - e), lerp(ya, yb, t1 - e)); }
  };
  const gW = 900, g1 = Fc.y1 - 500 * k - 200, g0 = g1 - gW;
  newSide(0, 1, 0, Fc.y1); side(Fc.x0, Fc.y1, Fc.x1, Fc.y1);
  newSide(0, -1, 0, Fc.y0); side(Fc.x0, Fc.y0, Fc.x1, Fc.y0);
  newSide(1, 0, Fc.x1, 0);
  if (Fc.y1 - Mc.y1 > 100) side(Fc.x1, Mc.y1, Fc.x1, Fc.y1);
  if (Mc.y0 - Fc.y0 > 100) side(Fc.x1, Fc.y0, Fc.x1, Mc.y0);
  newSide(-1, 0, Fc.x0, 0); side(Fc.x0, Fc.y0, Fc.x0, g0); side(Fc.x0, g1, Fc.x0, Fc.y1);
  // gate: yellow frame + mesh, handle, interlock switch
  boxAt(sg, "post", Fc.x0 - 20, Fc.x0 + 20, g0 + 40, g1 - 40, zf + H - 70, zf + H - 30);
  boxAt(sg, "post", Fc.x0 - 20, Fc.x0 + 20, g0 + 40, g1 - 40, zf + 80, zf + 120);
  boxAt(sg, "post", Fc.x0 - 20, Fc.x0 + 20, g0 + 35, g0 + 75, zf + 80, zf + H - 30);
  boxAt(sg, "post", Fc.x0 - 20, Fc.x0 + 20, g1 - 75, g1 - 35, zf + 80, zf + H - 30);
  panel(Fc.x0, g0 + 75, Fc.x0, g1 - 75);
  boxAt(sg, "red", Fc.x0 - 70, Fc.x0 - 25, g1 - 150, g1 - 80, zf + 1050, zf + 1200);
  add(sg, g3.cyl(12, 160, "z", 10), "metal", Fc.x0 - 50, g1 - 190, zf + 1000);
  // fence sides between the camera and the robot are faded (see fade())
  const FADE = new Map([[M.mesh, M.meshF], [M.post, M.postF], [M.rail, M.railF], [M.red, M.railF], [M.metal, M.railF]]);
  let mFaded = false;
  const fade = (cx, cy) => {
    const fm = cx > Mc.x0 + 0.3 * (Mc.x1 - Mc.x0) && Math.abs(cy) < 0.9 * cx;     // camera behind the machine → machine see-through
    if (fm !== mFaded) {
      mFaded = fm; inner.visible = !fm;
      mg.traverse((o) => { if (!o.isMesh || o === inner) return; if (fm) { if (o.material !== M.glass && o.material !== M.chuck && o.material !== M.metal) { o.userData.mf = o.material; o.material = o.material === M.panel || o.material === M.frame ? M.panelF : M.panelDF; o.castShadow = false; } } else if (o.userData.mf) { o.material = o.userData.mf; o.userData.mf = null; o.castShadow = true; } });
    }
    for (const sd of sides) {
      const f = (cx - sd.px) * sd.nx + (cy - sd.py) * sd.ny > 0;
      if (f === sd.faded) continue; sd.faded = f;
      sd.g.traverse((o) => { if (!o.isMesh) return; if (f) { const m2 = FADE.get(o.material); if (m2) { o.userData.mf = o.material; o.material = m2; o.castShadow = false; } } else if (o.userData.mf) { o.material = o.userData.mf; o.userData.mf = null; o.castShadow = true; } });
    }
  };
  root.traverse((o) => { if (o.isMesh) o.userData.cell = true; });

  /* parts pool (compressor housing: cylinder + flange; part centre = origin, axis = local Z, flange at −Z) */
  dyn.pool = [];
  const partGeo = {
    body: g3.cyl(pd / 2, ph * 0.8, "z", 32), fl: g3.cyl(0.62 * pd, 0.14 * ph, "z", 32), boss: g3.cyl(0.32 * pd, 0.06 * ph, "z", 28),
    port: g3.cyl(0.13 * pd, 0.2 * pd, "x", 16), hole: g3.cyl(0.05 * pd, 0.15 * ph, "z", 8),
  };
  const partsRoot = new THREE.Group();
  const newPart = () => {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; partsRoot.add(g);
    const mk = (geo, mn, x, y, z) => { const m = new THREE.Mesh(geo, M[mn]); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    mk(partGeo.fl, "partRaw", 0, 0, -ph / 2 + 0.07 * ph);
    mk(partGeo.body, "partRaw", 0, 0, -ph / 2 + 0.14 * ph + 0.4 * ph);
    const boss = mk(partGeo.boss, "partRaw", 0, 0, ph / 2 - 0.03 * ph);
    const port = mk(partGeo.port, "partRaw", pd / 2 + 0.05 * pd, 0, 0.12 * ph);
    for (let i = 0; i < 4; i++) { const a = (i + 0.5) / 4 * TAU; mk(partGeo.hole, "bolt", Math.cos(a) * 0.54 * pd, Math.sin(a) * 0.54 * pd, -ph / 2 + 0.07 * ph); }
    const it = { g, boss, port, done: null }; dyn.pool.push(it); return it;
  };
  const mH = new THREE.Matrix4(), mT = new THREE.Matrix4(), mR = new THREE.Matrix4().makeRotationX(Math.PI), mY = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
  const update = (st) => {
    // belts + rollers
    const conv = st.conv || 0;
    for (const b of dyn.belts) b.tex.offset.y = ((-(b.dir ? b.dir[1] : -1) * conv / 100) % 1 + 1) % 1;
    for (const r of dyn.rollers) r.m.rotation.x = -conv / r.r;
    // door
    const dd = dyn.door; dd.g.position.y = dd.y0 - clamp(st.door || 0, 0, 1) * dd.travel;
    // parts
    const parts = st.parts || [];
    const cellOn = !st.show || st.show.cell !== false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], it = dyn.pool[i] || newPart();
      it.g.visible = cellOn || !!p.held;
      if (p.held) {
        const t = st.tool || C.tool;
        mT.makeTranslation(t.x || 0, t.y || 0, (t.z || 0) + ph / 2);
        mH.multiplyMatrices(R.L.grip.matrix, mT).multiply(mR); it.g.matrix.copy(mH);
      } else if (p.ax === "x") { it.g.matrix.copy(mY); it.g.matrix.setPosition(p.p[0], p.p[1], p.p[2]); }
      else { it.g.matrix.makeTranslation(p.p[0], p.p[1], p.p[2]); }
      it.g.matrixWorldNeedsUpdate = true;
      const dn = !!p.done; if (it.done !== dn) { it.done = dn; it.boss.material = dn ? M.partMach : M.partRaw; it.port.material = dn ? M.partMach : M.partRaw; }
    }
    for (let i = parts.length; i < dyn.pool.length; i++) dyn.pool[i].g.visible = false;
  };
  const dispose = () => { dyn.belts.forEach((b) => { b.tex.dispose(); b.mat.dispose(); }); dyn.geos.forEach((g) => g.dispose()); lineM.dispose(); floor.geometry.dispose(); grid.geometry.dispose(); grid.material.dispose(); };
  return { root, partsRoot, update, dispose, fade, parts: dyn.pool };
}

/* simple generated studio environment (for metal reflections, no image files) */
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

/* ------------------------------------------------------------------ main */
export function createRobot3D(el, getState, opts = {}) {
  const Q = new URLSearchParams(location.search);
  el.classList.add("rb3");
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.preserve || Q.has("shot3d") });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1); if (window.dtTheme) window.dtTheme.scene(scene, "#e9edf1", "#1c2126");
  const camera = new THREE.PerspectiveCamera(38, W0 / H0, 0.02, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x80868e, 0.55));
  scene.environment = makeEnv(renderer);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35); fill.position.set(-6, 4, -5); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene, { minDist: 0.08, maxDist: 60 });
  const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; world.scale.setScalar(0.001); scene.add(world);
  const M = makeMats(), G = GeoCache();

  // ---------------- DOM overlay
  const mk = (tag, cls, txt) => { const d = document.createElement(tag); d.className = cls; if (txt) d.textContent = txt; return d; };
  const cap = mk("div", "rb3-cap"); el.appendChild(cap);
  const bar = mk("div", "rb3-bar"); el.appendChild(bar);
  const btn = (t, title, fn) => { const b = mk("button", "btn ghost rb3-btn", t); b.type = "button"; b.title = title; b.addEventListener("click", fn); bar.appendChild(b); return b; };
  const tagL = mk("div", "rb3-tags"); el.appendChild(tagL);
  const info = mk("div", "rb3-info"); info.hidden = true; el.appendChild(info);
  const alarm = mk("div", "rb3-alarm"); alarm.hidden = true; el.appendChild(alarm);
  el.appendChild(mk("div", "rb3-hint", "click a part for its data · drag = turn · right-drag = move · wheel = zoom"));

  let cur = null, cell = null, ghost = null, key = "", exOn = Q.has("rbex"), ex = exOn ? 1 : 0, follow = false, glide = null, pendFit = false;
  let sel = null, hov = null, ptr = null, ptrMoved = false, down = null, lastStSel, pickCb = opts.onPick || null, lastF = null, lastSt = null;
  let visIO = true, raf = 0, disposed = false, lastInfo = 0, lastCap = 0, envObj = null, envKey = "", frames = null, trail = null, trailSig = "";
  const tgtPool = [];
  const tv = new THREE.Vector3(), tw = new THREE.Vector3(), bx = new THREE.Box3(), bb = new THREE.Box3();
  const r2t = (out, x, y, z) => out.set(x * 0.001, z * 0.001, -y * 0.001);   // robot mm → three m

  const btnFit = btn("Fit", "fit the robot / cell into the view", () => fit(true));
  const views = {};
  [["iso", "Iso", "3D view from the front right"], ["front", "Front", "view from the front (along −X)"], ["side", "Side", "side view (arm plane)"], ["top", "Top", "view from above"]]
    .forEach(([k, t, ti]) => { views[k] = btn(t, ti, () => setView(k)); });
  const btnFol = btn("Follow", "camera follows the tool (TCP)", () => setView("follow"));
  const btnEx = btn("Explode", "links move apart along their axes", () => explode());
  btnEx.classList.toggle("on", exOn);
  void btnFit;

  // ---------------- build / rebuild
  function disposeScene() {
    if (cur) { world.remove(cur.root); cur = null; }
    if (ghost) { world.remove(ghost.root); ghost = null; }
    if (cell) { world.remove(cell.root, cell.partsRoot); cell.dispose(); cell = null; }
    if (envObj) { world.remove(envObj); envObj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); envObj = null; envKey = ""; }
    if (frames) { world.remove(frames); frames.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); frames = null; }
    unHover(); HL.forEach((h) => h.dispose()); HL.clear();
    G.dispose();
  }
  function build(st) {
    disposeScene();
    const rb = st.rb, C = st.C || cellLayout(rb);
    cur = buildRobot(rb, C, M, G, false); cur.rb = rb; cur.C = C; world.add(cur.root);
    cell = buildCell(rb, C, M, G, cur); world.add(cell.root, cell.partsRoot);
    if (!trail) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); geo.setDrawRange(0, 0);
      trail = new THREE.Line(geo, M.trail); trail.frustumCulled = false; trail.userData.noPick = true;
    }
    world.add(trail); trailSig = "";
    // shadow camera covers the cell
    const Fc = C.fence, ext = Math.max(Fc.x1 - Fc.x0, Fc.y1 - Fc.y0, C.machine.x1 - Fc.x0) * 0.001 * 0.75 + 1;
    const sc = sun.shadow.camera; sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.5; sc.far = ext * 6; sc.updateProjectionMatrix();
    const cx = (Fc.x0 + C.machine.x1) / 2;
    r2t(sun.target.position, cx, 0, 0); r2t(sun.position, cx - 0.8 * ext * 1000, -1.1 * ext * 1000, 2.6 * ext * 1000);
    sel = null; info.hidden = true;
  }

  // ---------------- explode, views, fit
  function explode(on) { exOn = on === undefined ? !exOn : !!on; btnEx.classList.toggle("on", exOn); pendFit = true; }
  const DIRS = { iso: [0.4, -1, 0.85], front: [1, 0, 0.12], side: [0, -1, 0.1], top: [-0.03, 0, 1] };
  let viewName = Q.get("rbview") || "iso";
  function fitPose(name, outT, outP) {
    if (!cur) return;
    const st = lastSt, C = cur.C, rb = cur.rb, R = rb.reach;
    world.updateMatrixWorld(true);
    bx.makeEmpty();
    cur.root.traverseVisible((o) => { if (o.isMesh && !o.isInstancedMesh) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bx.union(bb); } });
    const cellFit = !!(st && st.show && st.show.cell !== false && ex < 0.05);
    if (cellFit) {
      const add = (x, y, z) => bx.expandByPoint(r2t(tv, x, y, z));
      add(-0.35 * R, C.infeed.y1, -C.pedestal); add(-0.35 * R, C.outfeed.y1, -C.pedestal);
      add(C.machine.x0 + 300 * C.k, C.machine.y1, C.machine.door.z1 + 200 * C.k); add(C.machine.x0 + 300 * C.k, C.machine.y0, -C.pedestal);
    }
    if (bx.isEmpty()) bx.set(r2t(tv, -R, -R, 0).clone(), r2t(tw, R, R, R));
    const c = bx.getCenter(outT);
    const dir = DIRS[name] || DIRS.iso; r2t(tv, dir[0], dir[1], dir[2]).normalize();
    // exact fit: camera basis, every box corner must lie inside the view frustum (+ margin)
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), tv); if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize();
    const up = new THREE.Vector3().crossVectors(tv, right);
    const tV = Math.tan(camera.fov * Math.PI / 360), tH = tV * camera.aspect;
    let dist = 0.1;
    for (let i = 0; i < 8; i++) {
      tw.set(i & 1 ? bx.max.x : bx.min.x, i & 2 ? bx.max.y : bx.min.y, i & 4 ? bx.max.z : bx.min.z).sub(c);
      const dz = tw.dot(tv); dist = Math.max(dist, dz + Math.abs(tw.dot(right)) / tH, dz + Math.abs(tw.dot(up)) / tV);
    }
    dist *= 1.12;
    outP.copy(c).addScaledVector(tv, dist);
    camera.near = Math.max(0.01, dist / 300); camera.far = dist * 40; camera.updateProjectionMatrix();
  }
  function goTo(name, smooth) {
    const T = new THREE.Vector3(), P = new THREE.Vector3(); fitPose(name, T, P); if (nice && nice.stop) nice.stop();
    if (smooth) glide = { t: 0, a: controls.target.clone(), b: T, pa: camera.position.clone(), pb: P };
    else { controls.target.copy(T); camera.position.copy(P); glide = null; controls.update(); }
  }
  function fit(smooth = true) { goTo(viewName, smooth); }
  function setView(name) {
    if (name === "follow") { follow = !follow; btnFol.classList.toggle("on", follow); return; }
    viewName = name; Object.entries(views).forEach(([k, b]) => b.classList.toggle("on", k === name)); goTo(name, true);
  }
  views[viewName] && views[viewName].classList.add("on");

  // ---------------- picking, hover, info
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), HL = new Map();
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  function pickAt(cx, cy) {
    if (!cur) return null;
    const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    if (cur.cables) { cur.cables.harness.boundingSphere = null; cur.cables.hose.boundingSphere = null; }
    const hits = ray.intersectObject(cur.root, true);
    for (const h of hits) { let o = h.object; if (!shown(o)) continue; for (; o && o !== cur.root; o = o.parent) if (o.userData.part) return o.userData.part; }
    return null;
  }
  const hlMat = (m) => { let h = HL.get(m); if (!h) { h = m.clone(); h.emissive = new THREE.Color(0x2a5a9a); h.emissiveIntensity = 0.6; HL.set(m, h); } return h; };
  const setHL = (k, on) => { if (!cur || !k || !cur.P[k]) return; cur.P[k].forEach((g) => g.traverse((m) => { if (!m.isMesh) return; if (on) { if (!m.userData.m0) { m.userData.m0 = m.material; m.material = hlMat(m.material); } } else if (m.userData.m0) { m.material = m.userData.m0; m.userData.m0 = null; } })); };
  function unHover() { if (hov && hov !== sel) setHL(hov, false); hov = null; }
  const axTxt = (rb, q, i) => `J${i + 1} = ${r1(q[i]).toFixed(1)}° (range ${rb.lim[i][0]}…${rb.lim[i][1]}°, max ${rb.vmax[i]}°/s)`;
  function liveText(k, st) {
    const rb = st.rb, q = st.q, d = rb.dims, C = cur.C, D = cur.dim, p = PART_BY_K[k];
    switch (k) {
      case "base": return `${rb.ref} · robot mass ${rb.mass} kg · payload ${rb.payload} kg · reach ${rb.reach} mm · foot ${rb.base[0]} × ${rb.base[1]} mm · mounting: ${rb.mount}`;
      case "bal": return `${axTxt(rb, q, 1)} · spring cylinder length now ≈ ${Math.round(cur.bal ? cur.bal.L : 0)} mm (pin to pin, model)`;
      case "larm": return `${axTxt(rb, q, 1)} · length a2 = ${d.a2} mm (J2 → J3)`;
      case "uarm": return `${axTxt(rb, q, 2)} · a3 = ${d.a3} mm (J3 → forearm axis)`;
      case "farm": return `${axTxt(rb, q, 3)} · d4 = ${d.d4} mm (J3 → wrist centre)`;
      case "wrist": return `${axTxt(rb, q, 4)} · wrist centre X ${Math.round(lastF.wc[0])} Y ${Math.round(lastF.wc[1])} Z ${Math.round(lastF.wc[2])} mm`;
      case "flange": return `${axTxt(rb, q, 5)} · d6 = ${d.d6} mm (wrist centre → flange) · flange Ø ≈ ${Math.round(2 * 0.72 * D.rw)} mm (model)`;
      case "motor": return q.map((v, i) => `J${i + 1} ${r1(v).toFixed(1)}°`).join(" · ") + ` · max speeds ${rb.vmax.join("/")} °/s`;
      case "cable": return "path: base inlet → hollow J1 → column top → lower arm → upper arm housing → (customer air) gripper";
      case "grip": { const g = clamp(st.grip || 0, 0, 1); return `${g < 0.05 ? "open" : g > 0.95 ? "closed" : "moving"} (${Math.round(g * 100)} %) · TCP ${C.toolLen} mm from the flange · gripper ≈ ${C.gripMass} kg · part Ø${C.part.d} × ${C.part.h} mm, ${C.part.mass} kg`; }
      default: return p && p.ax > 0 ? axTxt(rb, q, p.ax - 1) : "";
    }
  }
  function showInfo(k) {
    const p = PART_BY_K[k]; if (!p || !lastSt) { info.hidden = true; return; }
    info.innerHTML = `<div class="rb3-ih"><b>${esc(p.n)}</b><button class="rb3-x" type="button" title="close">×</button></div>` +
      `<div class="rb3-lv"></div><p>${esc(p.t)}</p><p class="rb3-m">Example values – check with the current datasheet.</p>`;
    info.hidden = false; info.querySelector(".rb3-x").addEventListener("click", () => select(null));
    info.querySelector(".rb3-lv").textContent = liveText(k, lastSt);
  }
  function select(k, fromUser = false) {
    if (k && !PART_BY_K[k]) k = null;
    if (sel && sel !== k) setHL(sel, false);
    sel = k || null;
    if (sel) { setHL(sel, true); showInfo(sel); } else info.hidden = true;
    if (fromUser && pickCb) { try { pickCb(sel); } catch (er) { console.error(er); } }
  }
  const cvs = renderer.domElement;
  cvs.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, b: e.button }; glide = null; });
  cvs.addEventListener("pointerup", (e) => { if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) select(pickAt(e.clientX, e.clientY), true); down = null; });
  cvs.addEventListener("pointermove", (e) => { ptr = { x: e.clientX, y: e.clientY }; ptrMoved = true; });
  cvs.addEventListener("pointerleave", () => { ptr = null; unHover(); cvs.style.cursor = ""; });
  cvs.addEventListener("wheel", () => { glide = null; }, { passive: true });

  // ---------------- optional overlays
  function updEnvelope(show) {
    if (!show) { if (envObj) envObj.visible = false; return; }
    const rb = cur.rb, k = rb.id;
    if (!envObj || envKey !== k) {
      if (envObj) { world.remove(envObj); envObj.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
      // outer outline of the wrist-centre envelope in the arm plane: max distance from the J2 axis per 2° sector
      const pts = envelope(rb, 2), cx = rb.dims.a1, cz = rb.dims.h1, NB = 180, rmaxB = new Array(NB).fill(0), pB = new Array(NB).fill(null);
      for (const [r, z] of pts) { const a = Math.atan2(z - cz, r - cx), b = Math.floor(((a + Math.PI) / TAU) * NB) % NB, dd = Math.hypot(r - cx, z - cz); if (dd > rmaxB[b]) { rmaxB[b] = dd; pB[b] = [r, z]; } }
      const ol = pB.filter(Boolean);
      const sh = new THREE.Shape(); ol.forEach(([r, z], i) => (i ? sh.lineTo(r, z) : sh.moveTo(r, z)));
      const fillG = new THREE.ShapeGeometry(sh); fillG.rotateX(Math.PI / 2);
      const pc = new THREE.Group(); pc.matrixAutoUpdate = false;
      pc.add(new THREE.Mesh(fillG, M.envFill));
      const lp = ol.map(([r, z]) => new THREE.Vector3(r, 0, z)); lp.push(lp[0].clone());
      pc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lp), M.envOut));
      envObj = new THREE.Group(); envObj.add(pc); envObj.userData.pc = pc;
      let rmax = 0; for (const [r] of pts) rmax = Math.max(rmax, r);
      const ring = []; for (let i = 0; i <= 128; i++) { const a = (i / 128) * TAU; ring.push(new THREE.Vector3(Math.cos(a) * rmax, Math.sin(a) * rmax, rb.dims.h1)); }
      const rl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), M.envLine); rl.computeLineDistances(); envObj.add(rl);
      envObj.traverse((o) => { o.userData.noPick = true; }); world.add(envObj); envKey = k;
    }
    envObj.visible = true; envObj.userData.pc.matrix.copy(cur.L.col.matrix); envObj.userData.pc.matrixWorldNeedsUpdate = true;
  }
  function updFrames(show, f) {
    if (!show) { if (frames) frames.visible = false; return; }
    if (!frames) {
      frames = new THREE.Group(); const s = cur.dim.rs * 1.1;
      for (let i = 0; i < 7; i++) { const a = new THREE.AxesHelper(i === 6 ? s * 0.8 : s); a.matrixAutoUpdate = false; a.material.depthTest = false; a.renderOrder = 10; a.userData.noPick = true; frames.add(a); }
      world.add(frames);
    }
    frames.visible = true;
    const F = [...f.frames, f.tcp];
    frames.children.forEach((a, i) => { const m = F[i]; a.matrix.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1); a.matrixWorldNeedsUpdate = true; });
  }
  function updTrail(show, pts) {
    trail.visible = !!show && pts && pts.length > 1; if (!trail.visible) return;
    const n = Math.min(600, pts.length), last = pts[pts.length - 1], sig = n + "|" + last[0] + "|" + last[1] + "|" + last[2];
    if (sig === trailSig) return; trailSig = sig;
    const a = trail.geometry.attributes.position, off = pts.length - n;
    for (let i = 0; i < n; i++) { const p = pts[off + i]; a.setXYZ(i, p[0], p[1], p[2]); }
    a.needsUpdate = true; trail.geometry.setDrawRange(0, n);
  }
  function updTargets(list, w, h) {
    list = list || [];
    while (tgtPool.length < list.length) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(1), M.target); m.userData.noPick = true; world.add(m);
      const lab = mk("div", "rb3-tag"); tagL.appendChild(lab); tgtPool.push({ m, lab, t: "" });
    }
    const s = cur.dim.rs * 0.16;
    tgtPool.forEach((it, i) => {
      const t = list[i]; it.m.visible = !!t; if (!t) { it.lab.style.display = "none"; return; }
      it.m.position.set(t.p[0], t.p[1], t.p[2]); it.m.scale.setScalar(s);
      if (it.t !== t.n) { it.t = t.n; it.lab.textContent = t.n; }
      r2t(tv, t.p[0], t.p[1], t.p[2]).project(camera);
      if (tv.z > 1 || Math.abs(tv.x) > 1.05 || Math.abs(tv.y) > 1.05) { it.lab.style.display = "none"; return; }
      it.lab.style.display = ""; it.lab.style.transform = `translate(${((tv.x + 1) / 2 * w + 8).toFixed(0)}px,${((1 - tv.y) / 2 * h - 9).toFixed(0)}px)`;
    });
  }

  // ---------------- resize + visibility
  function resize() {
    const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return;
    const pr = renderer.getPixelRatio();
    if (cvs.width !== Math.round(w * pr) || cvs.height !== Math.round(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  }
  let io = null, ro = null;
  if (window.IntersectionObserver) { io = new IntersectionObserver((en) => { visIO = en.some((e) => e.isIntersecting); }); io.observe(el); }
  if (window.ResizeObserver) { ro = new ResizeObserver(() => resize()); ro.observe(el); }

  // ---------------- loop
  let last = performance.now(), firstFit = true;
  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent || !visIO || document.hidden) return;        // tab hidden → no work
    const st = getState(); if (!st || !st.rb || !st.q) return;
    lastSt = st;
    resize();
    const C0 = st.C || null, k = `${st.rb.id}|${C0 ? C0.pedestal + "|" + C0.toolLen + "|" + C0.part.d : ""}`;
    if (k !== key) { key = k; build(st); firstFit = true; }
    const rb = cur.rb, f = fk(rb, st.q, st.tool || cur.C.tool); lastF = f;
    const exT = exOn ? 1 : 0; if (ex !== exT) { ex += (exT - ex) * Math.min(1, dt * 4); if (Math.abs(ex - exT) < 0.004) ex = exT; }
    const e = ease(ex), holding = (st.parts || []).some((p) => p.held);
    cur.update(f, e, st.grip || 0, holding);
    const show = st.show || {};
    cell.root.visible = show.cell !== false; cell.update(st);
    if (cell.root.visible) cell.fade(camera.position.x * 1000, -camera.position.z * 1000);
    if (show.ghost && st.ghostQ) {
      if (!ghost) { ghost = buildRobot(rb, cur.C, M, G, true); world.add(ghost.root); }
      ghost.root.visible = true; ghost.update(fk(rb, st.ghostQ, st.tool || cur.C.tool), 0, st.grip || 0, false);
    } else if (ghost) ghost.root.visible = false;
    updEnvelope(!!show.env); updFrames(!!show.frames, f); updTrail(show.trail !== false, st.trail);
    if (firstFit) { firstFit = false; goTo(viewName, false);
      const cm = (Q.get("rbcam") || "").split(",").map(Number); if (cm.length === 6 && cm.every(Number.isFinite)) { r2t(camera.position, cm[0], cm[1], cm[2]); r2t(controls.target, cm[3], cm[4], cm[5]); camera.near = 0.01; camera.updateProjectionMatrix(); controls.update(); } if (Q.get("rbpick")) setTimeout(() => select(Q.get("rbpick")), 200); }
    if (pendFit && Math.abs(ex - exT) < 0.03) { pendFit = false; fit(true); }
    // selection from the state (structure table in robot.js)
    if (st.sel !== lastStSel) { lastStSel = st.sel; if ((st.sel || null) !== sel) select(st.sel || null); }
    // camera: glide or follow the TCP
    if (glide) { glide.t = Math.min(1, glide.t + dt / 0.7); const s = ease(glide.t); controls.target.lerpVectors(glide.a, glide.b, s); camera.position.lerpVectors(glide.pa, glide.pb, s); if (glide.t >= 1) glide = null; }
    else if (follow && !down) { r2t(tv, f.p[0], f.p[1], f.p[2]); tv.sub(controls.target).multiplyScalar(1 - Math.exp(-dt * 3)); controls.target.add(tv); camera.position.add(tv); }
    // hover
    if (ptrMoved && ptr && !down) { ptrMoved = false; const h = pickAt(ptr.x, ptr.y); if (h !== hov) { unHover(); if (h) { hov = h; setHL(h, true); } cvs.style.cursor = h ? "pointer" : ""; } }
    // caption, live info, alarm
    if (now - lastCap > 120) {
      lastCap = now;
      const c = `${rb.ref} (example) · TCP X ${Math.round(f.p[0])} Y ${Math.round(f.p[1])} Z ${Math.round(f.p[2])} mm${st.live && st.live.moving ? " · moving" : ""}`;
      if (c !== cap._t) { cap._t = c; cap.textContent = c; }
      const al = st.live && st.live.alarm ? String(st.live.alarm) : "";
      if (al !== alarm._t) { alarm._t = al; alarm.textContent = al; alarm.hidden = !al; }
    }
    if (sel && !info.hidden && now - lastInfo > 150) { lastInfo = now; const lv = info.querySelector(".rb3-lv"); if (lv) lv.textContent = liveText(sel, st); }
    controls.update();
    renderer.render(scene, camera);
    updTargets(st.targets, el.clientWidth, el.clientHeight);
  }
  raf = requestAnimationFrame(loop);

  function dispose() {
    disposed = true; cancelAnimationFrame(raf); if (io) io.disconnect(); if (ro) ro.disconnect();
    disposeScene();
    if (trail) { trail.geometry.dispose(); trail = null; }
    tgtPool.forEach((t) => { t.m.geometry.dispose(); t.lab.remove(); });
    Object.values(M).forEach((m) => { if (m && m.dispose) m.dispose(); }); if (M.mesh && M.mesh.map) M.mesh.map.dispose();
    controls.dispose(); renderer.dispose(); el.innerHTML = ""; el.classList.remove("rb3");
  }
  return {
    rebuild: () => { key = ""; },
    fit: () => fit(true),
    setView,
    explode,
    select: (k) => select(k || null),
    resize,
    dispose,
    onPick: (cb) => { pickCb = cb; },
  };
}
