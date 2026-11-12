/* Helpers for the motor-spindle ASSEMBLY 3D view (web/asmsp3d.js): materials, cached primitive geometry, merged
   lathe bodies, a simple low-poly operator (clean-room coat, nitrile gloves) with 2-bone arm IK, the stylised
   equipment + jigs (blue) of the 21 steps, and the part / equipment info texts.  Only primitives - no external
   models.  Offline: local three.js. */
import * as THREE from "three";

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
export const ph = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ materials */
export const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: Math.min(0.3, (o.m ?? 0.4) * 0.4), roughness: Math.max(0.35, o.r ?? 0.45), side: THREE.DoubleSide,
  transparent: !!o.op, opacity: o.op ?? 1, depthWrite: o.op ? o.op > 0.5 : true, emissive: o.em || 0x000000 });
export const MT = {
  shaft: mat(0xb4bec7, { m: 0.7, r: 0.3 }), ring: mat(0xdfe6ec, { m: 0.85, r: 0.18 }), ball: mat(0x24292e, { m: 0.3, r: 0.25 }), cage: mat(0x8a5a2a, { m: 0.1, r: 0.6 }), spacer: mat(0x8fa3b8, { m: 0.6, r: 0.3 }),
  nut: mat(0x5f6f7f, { m: 0.6, r: 0.35 }), rotor: mat(0x6d8a5a, { m: 0.5, r: 0.4 }), stator: mat(0x7d8c7d, { m: 0.4, r: 0.5 }), copper: mat(0xc07a3a, { m: 0.7, r: 0.35 }), hsg: mat(0x9aa4ae, { m: 0.35, r: 0.55 }),
  hsgF: mat(0xa9b2bb, { m: 0.4, r: 0.5 }), sleeve: mat(0x7fa6c9, { m: 0.4, r: 0.4 }), cover: mat(0xbcc4cc, { m: 0.4, r: 0.45 }), bar: mat(0x767d84, { m: 0.6, r: 0.35 }), springI: mat(0xffffff, { m: 0.5, r: 0.4 }),
  collet: mat(0x9b8fb0, { m: 0.5, r: 0.4 }), cyl: mat(0x8d96a0, { m: 0.4, r: 0.45 }), oring: mat(0x1a1a1a, { m: 0, r: 0.8 }), jig: mat(0x3a6ea8, { m: 0.3, r: 0.5 }), jigD: mat(0x26486e, { m: 0.3, r: 0.5 }),
  dark: mat(0x4a5560, { m: 0.3, r: 0.6 }), floor: mat(0xc9ced3, { m: 0, r: 1 }), hot: mat(0xe8742a, { em: 0x6a2000 }), sensor: mat(0xd0a020), red: mat(0xd03b3b), green: mat(0x2f9e5f), blue: mat(0x3050c0),
  glass: mat(0x9fc6e6, { op: 0.3, r: 0.1 }), table: mat(0xd5dbe1, { m: 0.1, r: 0.8 }), mandrel: mat(0xe6ecf1, { m: 0.9, r: 0.12 }), wood: mat(0xb08a5a, { m: 0, r: 0.9 }),
  skin: mat(0xe0b48f, { m: 0, r: 0.8 }), glove: mat(0x7b6fd6, { m: 0, r: 0.7 }), hglove: mat(0x8d8577, { m: 0, r: 0.9 }), coat: mat(0xf1f3f5, { m: 0, r: 0.9 }), cap: mat(0x6a9bd8, { m: 0, r: 0.9 }),
  mask: mat(0xbfdcef, { m: 0, r: 0.9 }), trouser: mat(0x5a6470, { m: 0, r: 0.9 }), shoe: mat(0x2b3036, { m: 0, r: 0.8 }), screen: mat(0x0e1a22, { m: 0, r: 0.4, em: 0x06281a }),
  ledOn: mat(0x2fd06f, { em: 0x1fbf4f }), ledOff: mat(0x8a9095), laser: mat(0xff3030, { em: 0xff2020 }), liquid: mat(0x6fb0e0, { op: 0.45, r: 0.1 }), film: mat(0xcfe6f5, { op: 0.28, r: 0.2 }),
  gold: mat(0xd8b040, { m: 0.8, r: 0.3 }), rubber: mat(0x222428, { m: 0, r: 0.8 }), hoseB: mat(0x2c5fd0, { m: 0, r: 0.6 }), hoseR: mat(0xc83a3a, { m: 0, r: 0.6 }), hoseY: mat(0xe0c030, { m: 0, r: 0.6 }),
  granite: mat(0x3a3f45, { m: 0, r: 0.7 }), capR: mat(0xd04040, { m: 0, r: 0.6 }), steel: mat(0xc8d0d8, { m: 0.8, r: 0.25 }), grease: mat(0xe8d890, { m: 0, r: 0.5 }), cable: mat(0x30343a, { m: 0, r: 0.7 }),
  hepa: mat(0xe8ecef, { m: 0, r: 0.9 }), white: mat(0xf5f6f7, { m: 0, r: 0.8 }), yel: mat(0xf0c030, { m: 0, r: 0.6 }),
};
export const KEEP = new Set(Object.values(MT));

/* ------------------------------------------------------------------ cached primitive geometry (never disposed: userData.keep) */
const GC = new Map();
const cg = (k, fn) => { let g = GC.get(k); if (!g) { g = fn(); g.userData.keep = true; GC.set(k, g); } return g; };
export const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(cg(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); return o; };
export const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 32) => { const o = new THREE.Mesh(cg(`c${r}|${h}|${seg}`, () => new THREE.CylinderGeometry(r, r, h, seg)), m); o.position.set(x, y, z); return o; };
export const cone = (r0, r1, h, m, x = 0, y = 0, z = 0, seg = 32) => { const o = new THREE.Mesh(cg(`k${r0}|${r1}|${h}|${seg}`, () => new THREE.CylinderGeometry(r1, r0, h, seg)), m); o.position.set(x, y, z); return o; };
export const sph = (r, m, x = 0, y = 0, z = 0, seg = 16, half = false) => { const o = new THREE.Mesh(cg(`s${r}|${seg}|${half}`, () => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75), 0, TAU, 0, half ? Math.PI / 2 : Math.PI)), m); o.position.set(x, y, z); return o; };
export const torus = (R, r, m, y = 0, arc = TAU, seg = 48) => { const o = new THREE.Mesh(cg(`t${R}|${r}|${arc}|${seg}`, () => new THREE.TorusGeometry(R, r, 8, seg, arc)), m); o.rotation.x = Math.PI / 2; o.position.y = y; return o; };
export const ballGeo = (r) => cg(`ball${r}`, () => new THREE.SphereGeometry(r, 14, 10));
/* unit cylinder for limbs / ropes / beams placed between two points */
export const segMesh = (m, r) => { const o = new THREE.Mesh(cg("useg", () => new THREE.CylinderGeometry(1, 1, 1, 12)), m); o.scale.set(r, 1, r); return o; };
const _a = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
export function placeSeg(o, a, b) { _a.subVectors(b, a); const L = _a.length(); o.position.addVectors(a, b).multiplyScalar(0.5); if (L > 1e-6) o.quaternion.setFromUnitVectors(UP, _a.multiplyScalar(1 / L)); o.scale.y = Math.max(0.01, L); }

/* merge several geometries into ONE non-indexed geometry (position + normal) - one draw call per lathe body */
export function mergeGeo(list) {
  let n = 0; const q = list.map((g) => { const h = g.index ? g.toNonIndexed() : g; if (!h.attributes.normal) h.computeVertexNormals(); n += h.attributes.position.count; return h; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  q.forEach((h, i) => { pos.set(h.attributes.position.array, o * 3); nor.set(h.attributes.normal.array, o * 3); o += h.attributes.position.count; if (h !== list[i]) h.dispose(); list[i].dispose(); });
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.BufferAttribute(nor, 3)); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
}
/* lathe body from a closed (r, y) contour; every edge its own lathe strip (sharp edges) + planar caps on the cut faces */
export function latheGeo(pts, cut, seg = 72) {
  const phiS = cut ? Math.PI / 2 : 0, phiL = cut ? Math.PI * 1.5 : TAU, Q = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
  const P = Q[0][0] === Q[Q.length - 1][0] && Q[0][1] === Q[Q.length - 1][1] ? Q : [...Q, Q[0]], gs = [];
  for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; if (a[0] === b[0] && a[1] === b[1]) continue; if (a[0] < 0.01 && b[0] < 0.01) continue;
    gs.push(new THREE.LatheGeometry([new THREE.Vector2(Math.max(0.001, a[0]), a[1]), new THREE.Vector2(Math.max(0.001, b[0]), b[1])], seg, phiS, phiL)); }
  if (cut) { const g1 = new THREE.ShapeGeometry(new THREE.Shape(P.slice(0, -1).map(([r, y]) => new THREE.Vector2(r, y)))); gs.push(g1, g1.clone().rotateY(-Math.PI / 2)); }
  return mergeGeo(gs);
}
export const lathe = (pts, m, cut, seg = 72) => new THREE.Mesh(latheGeo(pts, cut, seg), m);
export const rect = (r0, r1, y0, y1) => [[r0, y0], [r1, y0], [r1, y1], [r0, y1]];
export const ringM = (q, m, cut, seg = 72) => lathe(rect(q.r0, q.r1, q.x0, q.x1), m, cut, seg);
/* tube (hose / cable) through world points */
export function tube(pts, r, m, seg = 48) { const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))); const o = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 8, false), m); o.userData.noFit = true; return o; }
/* heat colour: 20 °C blue-grey → 35 yellow → 50 °C+ red */
export function heatColor(T, out) { const t = clamp((T - 20) / 32, 0, 1); out.setHSL((1 - t) * 0.6, 0.85, 0.5); return out; }

/* ------------------------------------------------------------------ the operator (low poly, faces local +Z, feet at y = 0) */
export function handMesh(m, side) {
  const g = new THREE.Group(); g.add(box(78, 84, 30, m, 0, 0, 0));
  const f = new THREE.Group(); f.position.y = 40; f.add(box(74, 66, 24, m, 0, 33, 2)); g.add(f);
  const th = box(24, 56, 24, m, side * 44, 4, 14); th.rotation.z = -side * 0.45; g.add(th); g.userData.fing = f; return g;
}
const _s = new THREE.Vector3(), _t = new THREE.Vector3(), _e = new THREE.Vector3(), _w = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _m = new THREE.Vector3(), _f = new THREE.Vector3(),
  _x = new THREE.Vector3(), _z = new THREE.Vector3(), _M4 = new THREE.Matrix4();
function ik(S, T, pole, L1, L2, E, W) {
  _d.subVectors(T, S); let d = _d.length(); _d.multiplyScalar(1 / Math.max(d, 1e-6)); d = clamp(d, 80, L1 + L2 - 2);
  const ca = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _p.copy(pole).addScaledVector(_d, -pole.dot(_d)); if (_p.lengthSq() < 1e-6) _p.set(0, -1, 0); _p.normalize();
  E.copy(S).addScaledVector(_d, L1 * ca).addScaledVector(_p, L1 * sa); W.copy(S).addScaledVector(_d, d);
}
export class Operator {
  constructor(parent, x, z, heat = false) {
    const g = (this.g = new THREE.Group()); g.position.set(x, 0, z); g.scale.setScalar(0.93); parent.add(g); this.home = new THREE.Vector3(x, 0, z); this.look = new THREE.Vector3(0, 0, 0);
    this.yaw = Math.atan2(-x, -z); g.rotation.y = this.yaw; this.walkPh = 0; this.lean = 0;
    this.legs = [-1, 1].map((sd) => { const l = new THREE.Group(); l.position.set(sd * 95, 900, 0); l.add(box(130, 860, 150, MT.trouser, 0, -430, 0), box(130, 60, 250, MT.shoe, 0, -870, 40)); g.add(l); return l; });
    const hip = (this.hip = new THREE.Group()); hip.position.y = 900; g.add(hip);
    hip.add(box(400, 330, 250, MT.coat, 0, -70, 0), box(390, 540, 240, MT.coat, 0, 270, 0), cyl(52, 70, MT.skin, 0, 570, 0, 12), sph(108, MT.skin, 0, 675, 0), sph(114, MT.cap, 0, 700, -6, 16, true), box(150, 80, 40, MT.mask, 0, 640, 98));
    hip.add(box(26, 14, 8, MT.dark, -40, 700, 104), box(26, 14, 8, MT.dark, 40, 700, 104));   // eyes
    this.sh = [-1, 1].map((sd) => { const o = new THREE.Object3D(); o.position.set(sd * 222, 495, 0); hip.add(o); hip.add(sph(56, MT.coat, sd * 222, 495, 0, 12)); return o; });
    const gm = heat ? MT.hglove : MT.glove;
    this.arm = [0, 1].map((i) => { const up = segMesh(MT.coat, 42), fo = segMesh(MT.coat, 35), h = handMesh(gm, i ? 1 : -1); parent.add(up, fo, h); return { up, fo, h, t: new THREE.Vector3(), pal: new THREE.Vector3(), hasPal: false, on: false, curl: 0.3, cur: new THREE.Vector3(), init: false, c: 0.3 }; });
    this.all = [g, ...this.arm.flatMap((a) => [a.up, a.fo, a.h])];
    this.all.forEach((o) => o.traverse((m) => { m.userData.op = true; }));
  }
  /* i = 0 right hand, 1 left hand; p = world point for the palm centre; pal = world point the palm faces */
  reach(i, p, pal, curl = 0.5) { const a = this.arm[i]; a.on = true; a.t.copy(p); a.hasPal = !!pal; if (pal) a.pal.copy(pal); a.curl = curl; }
  rest(i) { this.arm[i].on = false; }
  setVisible(v) { this.all.forEach((o) => { o.visible = v; }); }
  update(dt) {
    const g = this.g, k = 1 - Math.exp(-dt * 5);
    _d.subVectors(this.home, g.position); _d.y = 0; const dist = _d.length(), step = Math.min(dist, 900 * dt); if (dist > 1) g.position.addScaledVector(_d, step / dist);
    const amp = clamp(step / Math.max(dt, 1e-3) / 400, 0, 1); this.walkPh += step * 0.012; this.legs[0].rotation.x = Math.sin(this.walkPh) * 0.35 * amp; this.legs[1].rotation.x = -Math.sin(this.walkPh) * 0.35 * amp;
    let yaw = Math.atan2(this.look.x - g.position.x, this.look.z - g.position.z), dy = yaw - this.yaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; this.yaw += dy * k; g.rotation.y = this.yaw;
    let n = 0; _m.set(0, 0, 0); this.arm.forEach((a) => { if (a.on) { _m.add(a.t); n++; } });
    let lt = 0; if (n) { _m.multiplyScalar(1 / n); const hd = Math.hypot(_m.x - g.position.x, _m.z - g.position.z); lt = clamp((hd - 260) / 520, 0, 0.6) * (_m.y < 1400 ? 1 : 0.3) + (_m.y < 950 ? clamp((950 - _m.y) / 500, 0, 0.35) : 0); }
    this.lean += (lt - this.lean) * k; this.hip.rotation.x = this.lean;
    g.updateMatrixWorld(true);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.arm.forEach((a, i) => {
      this.sh[i].getWorldPosition(_s); const sd = i ? 1 : -1;
      if (a.on) _t.copy(a.t); else { _t.set(sd * 250, -560, 90); this.hip.localToWorld(_t); }
      if (!a.init) { a.cur.copy(_t); a.init = true; } else a.cur.lerp(_t, Math.min(1, k * 1.6));
      a.c += ((a.on ? a.curl : 0.25) - a.c) * k;
      _q.set(sd * Math.cos(this.yaw) * 0.6 - fx * 0.25, -1, -sd * Math.sin(this.yaw) * 0.6 - fz * 0.25);   // elbow pole: out, down, back
      ik(_s, a.cur, _q, 285, 315, _e, _w);
      placeSeg(a.up, _s, _e); _f.subVectors(_w, _e).normalize(); _m.copy(_w).addScaledVector(_f, -40); placeSeg(a.fo, _e, _m);
      if (a.on && a.hasPal) _z.subVectors(a.pal, _w); else _z.set(-sd * Math.cos(this.yaw) * 0.3, -1, sd * Math.sin(this.yaw) * 0.3);
      _z.addScaledVector(_f, -_z.dot(_f)); if (_z.lengthSq() < 1e-6) _z.set(0, -1, 0).addScaledVector(_f, -_f.y); _z.normalize(); _x.crossVectors(_f, _z);
      _M4.makeBasis(_x, _f, _z); a.h.quaternion.setFromRotationMatrix(_M4); a.h.position.copy(_w).addScaledVector(_f, -10); a.h.userData.fing.rotation.x = a.c * 1.3;
    });
  }
}

/* ------------------------------------------------------------------ equipment + jigs (blue).  Every builder returns a Group with userData {tool, dev} */
export const tool = (g, id, dev) => { g.userData.tool = id; if (dev) g.userData.dev = dev; return g; };
const screen = (g, w, h, x, y, z, ry = 0) => { const s = box(w, h, 6, MT.screen, x, y, z); s.rotation.y = ry; g.add(s); const a = new THREE.Object3D(); a.position.set(x, y + h / 2 + 4, z); g.add(a); return a; };
export function led(g, x, y, z) { const o = sph(15, MT.ledOff, x, y, z, 10); o.visible = false; o.userData.led = true; g.add(o); g.userData.ledM = o; return o; }
export function table(w, d, top, m = MT.table) { const g = new THREE.Group(); g.add(box(w, 30, d, m, 0, top - 15, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(box(36, top - 30, 36, MT.dark, a * (w / 2 - 30), (top - 30) / 2, b * (d / 2 - 30)))); return g; }
/* E9 induction heater on its own small table: bearing lies flat around the vertical pole, top at y = top */
export function heater() { const g = tool(new THREE.Group(), "E9", "IH-01"), T = table(520, 420, 760); g.add(T);
  g.add(box(340, 230, 280, MT.jigD, 0, 760 + 115, 0), box(300, 12, 250, MT.dark, 0, 760 + 236, 0)); const coil = cyl(70, 8, MT.hot, 0, 760 + 244, 0, 32); g.add(coil); g.add(cyl(26, 220, MT.steel, 0, 760 + 350, 0, 16));
  const scr = screen(g, 130, 60, 0, 760 + 160, 142); led(g, 100, 760 + 160, 142); g.userData.top = 760 + 248; g.userData.coil = coil; g.userData.scr = scr; return g; }
/* E12 portable hand press with force gauge, frame standing on the J1 top plate, ram pointing down */
export function press(top) { const g = tool(new THREE.Group(), "E12", "FG-01"); [-1, 1].forEach((sd) => g.add(box(40, top, 40, MT.jigD, sd * 210, top / 2, 0))); g.add(box(480, 50, 70, MT.jig, 0, top + 25, 0));
  g.add(cyl(38, 150, MT.jig, 0, top - 75, 0, 20)); const ram = new THREE.Group(); ram.add(cyl(16, 200, MT.steel, 0, -100, 0, 16), cyl(30, 14, MT.jigD, 0, -200, 0, 20)); ram.position.y = top - 150; g.add(ram);
  g.add(cyl(18, 50, MT.jigD, 300, top + 25, 0, 12)); const scr = screen(g, 110, 60, 300, top + 80, 0); led(g, 360, top + 80, 0); g.userData.ram = ram; g.userData.scr = scr; return g; }
/* E10 hook spanner + torque wrench around a nut of radius r (origin on the axis, handle along +X) */
export function wrench(r, len = 420) { const g = tool(new THREE.Group(), "E10", "TQ-01"), arc = torus(r + 7, 6, MT.jig, 0, Math.PI * 1.25, 40); arc.rotation.z = -Math.PI * 0.62; g.add(arc);
  g.add(box(14, 14, 14, MT.jigD, r + 2, 0, 0)); g.add(box(len, 18, 18, MT.jig, r + 14 + len / 2, 0, 0), box(110, 30, 30, MT.jigD, r + len - 40, 0, 0)); const scr = screen(g, 60, 34, r + 120, 20, 0);
  const grip = new THREE.Object3D(); grip.position.set(r + len - 40, 0, 0); g.add(grip); led(g, r + 170, 20, 0); g.userData.grip = grip; g.userData.scr = scr; return g; }
/* E11 electronic indicator on a rigid arm (J3) - probe tip at the origin, pointing down */
export function indicator(id = "E11", armLen = 260) { const g = tool(new THREE.Group(), id, "IND-01"); g.add(cyl(3, 40, MT.steel, 0, 20, 0, 8), cyl(12, 70, MT.jigD, 0, 75, 0, 16), box(armLen, 20, 20, MT.jig, armLen / 2, 110, 0), box(20, 300, 20, MT.jig, armLen, -40, 0), box(70, 30, 70, MT.jigD, armLen, -190, 0));
  const scr = screen(g, 80, 46, 40, 160, 0); led(g, 90, 160, 0); g.userData.scr = scr; return g; }
/* E13 overhead crane: beam + trolley + chain + hook block; setHook(x, y, z) in world */
export function crane(beamY = 2300) { const g = tool(new THREE.Group(), "E13"); g.add(box(2600, 120, 90, MT.yel, 0, beamY, 0)); const tr = box(200, 90, 160, MT.dark, 0, beamY - 100, 0); g.add(tr);
  const ch = segMesh(MT.dark, 6); g.add(ch); const blk = new THREE.Group(); blk.add(box(70, 110, 50, MT.yel, 0, 55, 0)); const hk = torus(26, 7, MT.dark, -12, Math.PI * 1.4, 16); hk.rotation.set(0, 0, Math.PI * 0.8); blk.add(hk); g.add(blk);
  const a = new THREE.Vector3(), b = new THREE.Vector3(); g.userData.blk = blk;
  g.userData.setHook = (x, y, z) => { tr.position.set(x, beamY - 100, z); blk.position.set(x, y, z); a.set(x, beamY - 140, z); b.set(x, y + 110, z); placeSeg(ch, a, b); }; return g; }
/* E14 rotor oven with hinged door (origin on the floor) */
export function oven() { const g = tool(new THREE.Group(), "E14", "OV-01"); g.add(box(560, 560, 30, MT.dark, 0, 920, -265), box(30, 560, 530, MT.dark, -265, 920, 0), box(30, 560, 530, MT.dark, 265, 920, 0), box(560, 30, 530, MT.dark, 0, 655, 0), box(560, 30, 530, MT.dark, 0, 1185, 0));
  g.add(box(500, 6, 470, MT.hot, 0, 674, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => g.add(box(40, 640, 40, MT.dark, a * 240, 320, b * 230)));
  const door = new THREE.Group(); door.position.set(280, 920, 265); door.add(box(560, 560, 26, MT.jigD, -280, 0, 0)); g.add(door); const scr = screen(g, 160, 60, 0, 1240, 240); led(g, 110, 1240, 245); g.userData.door = door; g.userData.scr = scr; return g; }
/* J4 rotor tongs (origin = rotor top centre, jaws reach down to y = -grip) */
export function tongs(R, grip = 60) { const g = tool(new THREE.Group(), "J4"); [-1, 1].forEach((sd) => { g.add(box(14, grip + 120, 30, MT.jig, sd * (R + 14), 60 - grip / 2, 0), box(26, 14, 30, MT.jig, sd * (R + 4), -grip, 0)); }); g.add(box(2 * R + 44, 16, 30, MT.jig, 0, 120, 0), box(20, 220, 20, MT.jigD, 0, 230, 0), box(240, 22, 22, MT.jigD, 0, 340, 0)); return g; }
/* J6 spring-pack compression tool: bridge on the rear nut, screw spindle + handwheel + force gauge (origin on the rear nut face, +Y = away from the nut) */
export function springTool(r, h) { const g = tool(new THREE.Group(), "J6", "FG-01"); [-1, 1].forEach((sd) => g.add(box(26, h, 60, MT.jig, sd * (r - 6), h / 2, 0))); g.add(box(2 * r + 30, 26, 70, MT.jig, 0, h + 13, 0));
  const sp = new THREE.Group(); sp.add(cyl(10, 220, MT.steel, 0, 0, 0, 12), torus(60, 7, MT.jigD, 110, TAU, 32), box(120, 8, 8, MT.jigD, 0, 110, 0)); sp.position.y = h; g.add(sp); g.add(box(50, 40, 50, MT.jigD, 0, h - 30, 0));
  const scr = screen(g, 90, 50, r + 70, h + 20, 0); led(g, r + 120, h + 20, 0); g.userData.sp = sp; g.userData.scr = scr; return g; }
/* E16 balancing machine bed (x along the bed) */
export function balancer(len, ya) { const g = tool(new THREE.Group(), "E16", "BAL-01"); g.add(box(len, 300, 300, MT.dark, 0, 150, 0), box(len, 40, 360, MT.table, 0, 320, 0));
  const pole = box(40, 900, 40, MT.dark, -len / 2 - 120, 450, -150); g.add(pole); const scr = screen(g, 300, 200, -len / 2 - 120, 1000, -130, 0.4); led(g, -len / 2 - 10, 1120, -100); g.userData.scr = scr; return g; }
/* small hand tools */
export function screwdriver() { const g = tool(new THREE.Group(), "E10"); g.add(cyl(14, 100, MT.jig, 0, 90, 0, 12), cyl(3, 80, MT.steel, 0, 0, 0, 8)); return g; }
export function feeler() { const g = tool(new THREE.Group(), "J10"); g.add(box(2, 90, 14, MT.steel, 0, -30, 0), box(20, 70, 30, MT.jig, 0, 45, 0)); return g; }
export function scanner() { const g = tool(new THREE.Group(), "E25", "SCN-01"); g.add(box(50, 60, 150, MT.jig, 0, 0, 0), box(40, 110, 50, MT.jigD, 0, -70, -40), box(44, 44, 6, MT.laser, 0, 0, 78)); return g; }
export function syringe() { const g = tool(new THREE.Group(), "E8", "SCL-01"); g.add(cyl(14, 140, MT.glass, 0, 0, 0, 14), cyl(11, 90, MT.grease, 0, -20, 0, 12), cyl(5, 160, MT.jig, 0, 110, 0, 8), box(50, 8, 20, MT.jigD, 0, 190, 0), cone(3, 9, 40, MT.jigD, 0, -90, 0, 10)); return g; }
export function hskGauge() { const g = tool(new THREE.Group(), "E18", "HSK-01"); g.add(cone(21, 23.5, 32, MT.jig, 0, -16, 0, 32), cyl(31, 30, MT.jigD, 0, 15, 0, 32), cyl(40, 60, MT.jig, 0, 60, 0, 32), box(90, 50, 30, MT.jigD, 80, 70, 0));
  const scr = screen(g, 70, 40, 80, 70, 16); led(g, 115, 95, 0); g.userData.scr = scr; return g; }
export function cart(w, h, d, id, dev) { const g = tool(new THREE.Group(), id, dev); g.add(box(w, h, d, MT.jigD, 0, h / 2 + 60, 0)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const c = cyl(30, 20, MT.rubber, a * (w / 2 - 40), 30, b * (d / 2 - 30), 12); c.rotation.x = Math.PI / 2; g.add(c); });
  const scr = screen(g, w * 0.6, 90, 0, h * 0.75 + 60, d / 2 + 4); led(g, w / 2 - 30, h + 40, d / 2); g.userData.scr = scr; return g; }

/* ------------------------------------------------------------------ texts: equipment (short) + parts */
export const EQS = { E1: "Clean assembly room", E2: "Washing station", E3: "Soak rack 20 °C", E4: "Laminar-flow bench", E5: "Bearing measuring stand", E6: "Precision measuring set", E7: "Spacer grinder / comparator", E8: "Grease dosing + scale 0.01 g",
  E9: "Induction bearing heater", E10: "Torque wrench + hook spanner", E11: "Indicator 0.1 µm", E12: "Hand press + force gauge", E13: "Crane, slow speed", E14: "Rotor heating oven", E15: "Housing heater", E16: "Balancing machine",
  E17: "Pressure test unit", E18: "HSK clamping-force gauge", E19: "Hydraulic test unit", E20: "Run-in test stand", E21: "Test mandrel HSK-A63 300 mm", E22: "Capacitive probes", E23: "Vibration + sound meter", E24: "Electrical test set", E25: "DMC scanner + MES tablet", E26: "Stiffness loading device",
  J1: "Vertical stand (nose down)", J2: "Bearing push sleeve", J3: "Nut runout fixture", J4: "Rotor tongs", J5: "Mounting cone (thread protector)", J6: "Spring-pack tool", J7: "Balancing support sleeve", J8: "Housing stand + guide rods", J9: "Stator lifting fixture", J10: "Labyrinth gauge + centring ring", J11: "Probe frame", J12: "Run-in cradle" };
export const DEVN = { "SCN-01": "scanner", "PC-01": "particle counter", "TH-01": "room thermometer", "BMS-01": "bearing measuring stand", "CMP-01": "comparator", "SCL-01": "scale", "IH-01": "induction heater", "OV-01": "rotor oven", "TQ-01": "torque wrench",
  "IND-01": "indicator", "FG-01": "force gauge", "BAL-01": "balancing machine", "PRS-01": "pressure gauge", "HSK-01": "HSK force gauge", "INS-01": "insulation tester", "RUN-01": "run-in PLC", "PRB-01": "capacitive probes" };
/* part info: name, material, key dimension (fn of state), steps whose checks belong to it, equipment / jigs */
export const PART = {
  shaft: ["Main shaft", "nitriding steel, hardened + ground (example)", (s) => `front seat Ø${s.M.dF} js4, rear seat Ø${s.M.dR} js4, rotor seat Ø${s.M.dRot}, L = ${Math.round(s.G.g.L)} mm, runout ≤ 2 µm`, ["kit", "meas"], ["E6", "J1"]],
  brgF: ["Front bearing set 4 × 70xx C, TBT", "steel rings + ceramic (Si3N4) balls, hybrid", (s) => `d${s.M.dF} × D${s.M.DF} × B${s.M.BF}, preload ${s.M.Fpre} N per bearing (light), heat ≤ 110 °C`, ["meas", "grease", "front"], ["E5", "E8", "E9", "E12", "J2"]],
  spF: ["Spacers inner + outer (ground pair)", "hardened steel", (s) => `length difference Lo − Li = Δs ±1 µm, faces parallel ≤ 1 µm`, ["spacer"], ["E7", "E5"]],
  nutF: ["Front precision lock nut", "steel, radial set screws", (s) => `M${s.M.dF}×1.5, ≈ 125 N·m (example), face runout ≤ 2 µm after correction`, ["nut"], ["E10", "E11", "J3"]],
  hsgF: ["Front bearing housing", "steel (example)", (s) => `bore Ø${s.M.DF}, clearance to bearing OD 2–8 µm, heated +20 K for fitting, 8 × M10 67 N·m`, ["fbh", "insert"], ["E15", "E13", "E11"]],
  rotor: ["Rotor sleeve (motor kit)", "laminations + magnets on a steel sleeve", (s) => `seat Ø${s.M.dRot}, interference ${s.M.dRotI} mm, heat to ≈ ${Math.round(s.R.Trot)} °C (magnet limit!)`, ["rotor"], ["E14", "J4", "J5"]],
  brgR: ["Rear bearing set 2 × 70xx C, DB", "steel rings + ceramic balls", (s) => `d${s.M.dR} × D${s.M.DR} × B${s.M.BR}, floating in the sleeve`, ["meas", "grease", "rear"], ["E9", "J2", "J5"]],
  nutR: ["Rear precision lock nut", "steel, radial set screws", (s) => `M${s.M.dR}×1.5, ≈ 73 N·m (example), face runout ≤ 2 µm`, ["rear"], ["E10", "E11"]],
  bar: ["Drawbar + clamping set (collet)", "alloy steel, QT", (s) => `stroke ${s.PK.S.stroke} mm, drawbar force ${(s.R.Fdraw / 1000).toFixed(2)} kN → clamping ${s.M.Fclamp} kN`, ["unclamp", "clamp"], ["E18", "E19"]],
  springs: ["Disc-spring pack", "spring steel", (s) => `${s.PK.n} springs = ${s.PK.ns} groups × ${s.PK.S.np}; ${s.PK.S.name}; L0 ${s.PK.L0.toFixed(1)} mm, F clamped ${(s.PK.Fc / 1000).toFixed(2)} kN`, ["draw", "clamp"], ["J6", "E12"]],
  stator: ["Stator (laminations + winding)", "electrical steel, copper winding", (s) => `bore Ø${Math.round(s.G.rotorOD + 2)}, air gap ≈ 1 mm, insulation ≥ 100 MΩ (example)`, ["stator", "insert"], ["E15", "E24", "J9"]],
  sleeve: ["Cooling sleeve + O-rings", "steel / aluminium, FKM O-rings", (s) => `spiral grooves, pressure test 1.5 × p for 15 min, drop ≤ 0.1 bar`, ["stator"], ["E17", "J9"]],
  hsgM: ["Motor housing", "steel / cast (example)", (s) => `outside Ø${Math.round(s.G.Ro * 2)}, rear bore Ø${Math.round(s.G.sleeveR.r1 * 2)}`, ["insert"], ["J8", "E13"]],
  coverF: ["Front cover (labyrinth)", "steel", (s) => `labyrinth gap 0.20–0.30 mm, 6 × M6 9.5 N·m crosswise, sealing air`, ["cover"], ["J10", "E10"]],
  sleeveR: ["Floating sleeve (rear bearings slide)", "steel, ground bore", (s) => `bore Ø${s.M.DR}, clearance 5–12 µm, moves ≤ 150 N`, ["meas", "cover"], ["E6"]],
  coverR: ["Rear cover", "steel", (s) => `6 × M6 9.5 N·m crosswise`, ["cover"], ["E10"]],
  cyl: ["Unclamp cylinder", "steel, piston with seals", (s) => `annular piston Ø${Math.round(s.PK.Dp)}, supply ${s.PK.S.p} MPa, stroke ${s.PK.S.stroke} mm`, ["unclamp", "clamp"], ["E19"]],
  sens: ["Sensors (PT100, vibration, encoder, clamp position)", "electronic", (s) => `PT100 at the front bearings + stator, KTY / PT in the winding, encoder on the tail`, ["sensors", "runin"], ["E24"]],
};
