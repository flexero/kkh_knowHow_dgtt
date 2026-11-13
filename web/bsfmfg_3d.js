/* Ball screw + guide factory – item 2: ONE parametric 3D scene for every manufacturing operation (offline three.js).
 * createMfg3D(el, { onState }) → { setOp(op, ctx), play(on), setSpeed(x), setTags(on), S, read(), snapshot(), resize(), frames(), module() }
 * The machine modules live in bsfmfg_3dm.js (MODS[key](K, op, ctx) → { g, cam, dur, tick(T), read(), tags }).
 * The kit K gives materials, primitives, workpieces (shaft, nut, rail, block), particles (sparks, chips, coolant, spray) and helpers.
 * Units: mm. The animation is time-compressed (one loop ≈ 10 – 20 s at ×1); the info panel shows the real cycle time.
 */
import { createView, matKit, THREE } from "./bsfprod_3dcore.js";
import { BS, BN, LG, LB } from "./bsfprod_data.js";
import { shaftR, TH, railOutline, blockOutline } from "./bsfprod_geo.js";
import { MODS } from "./bsfmfg_3dm.js";

const PI = Math.PI;

export function createMfg3D(el, opts = {}) {
  const V = createView(el, { bg: 0xe8ecf0, far: 40000, maxDist: 15000, minDist: 50, fov: 35 });
  const { scene } = V;
  /* floor */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24000, 24000), new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.95, metalness: 0 }));
  floor.rotation.x = -PI / 2; floor.position.y = -1; scene.add(floor);
  const grid = new THREE.GridHelper(24000, 48, 0x9aa3ad, 0xb4bcc4); grid.position.y = 0; scene.add(grid);
  const K = kit(V);
  const S = { op: null, ctx: null, key: "", playing: true, speed: 1, t: 0, tags: true };
  let cur = null, curTags = [];

  function clear() {
    if (cur) { scene.remove(cur.g); cur.g.traverse((o) => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); }); }
    curTags.forEach((t) => { t.d.remove(); t.show = () => false; }); curTags = [];
    cur = null;
  }
  function setOp(op, ctx = {}) {
    clear();
    S.op = op; S.ctx = ctx; S.key = op.mod; S.t = 0;
    const f = MODS[op.mod] || MODS.bench;
    cur = f(K, op, ctx);
    scene.add(cur.g);
    (cur.tags || []).forEach(([txt, obj, local, cls]) => curTags.push(V.tag(txt, obj, local || [0, 0, 0], cls || "")));
    V.setTags(S.tags);
    const [tg, ps] = cur.cam || [[0, 600, 0], [2600, 1800, 3200]];
    const now = !S.glided || S.instant; V.glide(tg, ps, now); if (now) V.controls.update(); S.glided = true;
    tickCur(0); V.mark();
  }
  function tickCur(dt) {
    if (!cur) return false;
    const dur = cur.dur || 14;
    S.t += dt;
    const T = { t: S.t, dt, p: (S.t % dur) / dur, loop: Math.floor(S.t / dur), dur };
    cur.tick && cur.tick(T);
    K.updParticles(dt);
    return true;
  }
  let lastRead = 0;
  V.onTick((dt) => {
    if (!S.playing || !cur) return false;
    tickCur(dt * S.speed);
    lastRead += dt; if (lastRead > 0.2 && opts.onState) { lastRead = 0; opts.onState(); }
    return true;
  });
  return {
    V, S, K,
    setOp,
    play: (on) => { S.playing = !!on; V.mark(); },
    setSpeed: (x) => { S.speed = Math.max(0.1, +x || 1); },
    setTags: (on) => { S.tags = !!on; V.setTags(S.tags); },
    step: (sec) => { tickCur(sec); V.mark(); },              // test helper: advance the simulated time
    read: () => (cur && cur.read ? cur.read() : []),
    module: () => cur,
    snapshot: V.snapshot, resize: V.resize, frames: V.frames,
  };
}

/* ------------------------------------------------------------------ kit: materials, primitives, workpieces, particles */
function kit(V) {
  const { M } = matKit();
  const std = (c, o = {}) => { const m = M(c, o.role || "m", { r: o.r ?? 0.55, m: o.m ?? 0.25, ds: o.ds }); if (o.em) { m.emissive = new THREE.Color(o.em); m.emissiveIntensity = o.ei ?? 1; } if (o.op !== undefined) { m.transparent = true; m.opacity = o.op; m.depthWrite = false; } return m; };
  const C = {
    body: std(0xdfe3e8, { r: 0.6, m: 0.1 }), body2: std(0xb9c2cc, { r: 0.6, m: 0.15 }), blue: std(0x2f5d8a, { r: 0.5, m: 0.2 }), dark: std(0x2b3036, { r: 0.6, m: 0.3 }),
    iron: std(0x6d747c, { r: 0.7, m: 0.3 }), granite: std(0x3a3d42, { r: 0.4, m: 0.05 }), steel: std(0xc3c9cf, { r: 0.3, m: 0.75 }), hard: std(0x7f8892, { r: 0.35, m: 0.7 }),
    ground: std(0xe2e6ea, { r: 0.12, m: 0.9 }), copper: std(0xc87533, { r: 0.35, m: 0.8 }), wheel: std(0xd8ccb0, { r: 0.9, m: 0 }), wheelB: std(0xa47b4f, { r: 0.9, m: 0 }),
    cbn: std(0x5a4a7a, { r: 0.7, m: 0.1 }), insert: std(0xd4af37, { r: 0.3, m: 0.8 }), guard: std(0x8fb3d1, { op: 0.22, ds: true }), glass: std(0xa9c7de, { op: 0.18, ds: true }),
    hot: std(0xff6a00, { em: 0xff4400, ei: 1.4 }), glow: std(0xff8a00, { em: 0xff5a00, ei: 0.8, op: 0.55 }), cool: std(0x6fb7ff, { op: 0.35 }), oil: std(0x8a6a1f, { op: 0.6 }),
    red: std(0xd62828, { em: 0xd62828, ei: 0.8 }), green: std(0x2e9e57, { r: 0.5 }), yellow: std(0xf2c230, { r: 0.5 }), black: std(0x1c1c1c, { r: 0.5, m: 0.1 }),
    white: std(0xf4f4f4, { r: 0.6, m: 0 }), laser: std(0xff2a2a, { em: 0xff0000, ei: 2, op: 0.8 }), film: std(0x9ad0a0, { op: 0.35, ds: true }), wood: std(0xb98b55, { r: 0.85, m: 0 }),
    ball: std(0xe8ecf0, { r: 0.15, m: 0.95 }), pom: std(0x202020, { r: 0.6, m: 0 }),
  };
  const mesh = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); return o; };
  const box = (w, h, d, m, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const boxB = (w, h, d, m, x = 0, y = 0, z = 0) => box(w, h, d, m, x, y + h / 2, z);      // y = bottom
  const cylY = (r, h, m, x = 0, y = 0, z = 0, s = 32, r2) => mesh(new THREE.CylinderGeometry(r2 ?? r, r, h, s), m, x, y, z);
  const cylX = (r, len, m, x = 0, y = 0, z = 0, s = 32) => { const o = cylY(r, len, m, x, y, z, s); o.rotation.z = PI / 2; return o; };
  const cylZ = (r, len, m, x = 0, y = 0, z = 0, s = 32) => { const o = cylY(r, len, m, x, y, z, s); o.rotation.x = PI / 2; return o; };
  const torus = (R, r, m, s = 40) => new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, s), m);
  const grp = (...ch) => { const g = new THREE.Group(); ch.forEach((c) => c && g.add(c)); return g; };
  const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o; };
  const part = (o, k) => { o.userData.part = k; return o; };

  /* ---------- workpieces */
  const geoCache = {};
  const keep = (g) => { g.userData.keep = true; return g; };
  // ball-screw thread surface along X (x0 … x0 + L), gothic-arch profile from bsfprod_geo (helical grid → seamless)
  function threadGeo(L = BS.Lthread) {
    const key = "th" + L; if (geoCache[key]) return geoCache[key];
    const Ph = TH.Ph, nT = 20, nV = 14, turns = Math.ceil(L / Ph), NI = turns * nT;
    const pos = [], idx = [];
    for (let i = 0; i <= NI; i++) {
      const th = 2 * PI * i / nT;
      for (let j = 0; j <= nV; j++) {
        const v = j / nV * Ph, x = Ph * th / (2 * PI) + v - Ph, r = shaftR(v - Ph / 2);
        const xc = Math.min(L, Math.max(0, x));
        pos.push(xc, r * Math.cos(th), r * Math.sin(th));
      }
    }
    for (let i = 0; i < NI; i++) for (let j = 0; j < nV; j++) {
      const a = i * (nV + 1) + j, b = a + nV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return (geoCache[key] = keep(g));
  }
  // lathe profile along X: pts [[x, r], …]
  function latheX(pts, seg = 40) {
    const g = new THREE.LatheGeometry(pts.map(([x, r]) => new THREE.Vector2(r, x)), seg);   // around Y
    g.rotateZ(-PI / 2);                                                                      // Y → X
    return g;
  }
  /** screw shaft (axis X, centre at x = 0). stage: bar | turned | thread; hard: hardened colour; clip helpers for reveal */
  function shaft(stage = "turned", o = {}) {
    const g = new THREE.Group();
    const mPlain = o.mat || (o.hard ? C.hard : C.steel), jm = o.groundJ ? C.ground : mPlain;
    if (stage === "bar") { g.add(part(cylX(18, 1010, mPlain, 0, 0, 0, 40), "work")); g.userData.r = 18; return g; }
    g.add(part(mesh(latheX([[-500, 0], [-500, 9.4], [-499, 10], [-470, 10], [-470, 12.5], [-420, 12.5], [-420, 14], [-400, 14], [-400, 0]], 40), jm), "work"));
    g.add(part(mesh(latheX([[450, 0], [450, 10], [499, 10], [500, 9.4], [500, 0]], 40), jm), "work"));
    const thread = stage === "thread" || o.threadClip, plain = stage !== "thread" || o.threadClip;
    if (thread) {
      const thM = (o.hard ? C.ground : C.steel).clone();
      const th = part(mesh(threadGeo(), thM, -400, 0, 0), "work"); th.name = "thread"; g.add(th); g.userData.thread = th;
      g.add(cylX(13.2, 850, mPlain, 25));
    }
    if (plain) { const pl = part(cylX(15.75, 850, (o.groundOD ? C.ground : mPlain).clone(), 25, 0, 0, 48), "work"); g.add(pl); g.userData.plain = pl; }
    g.userData.r = 15.75;
    return g;
  }
  /** reveal a thread (made in this operation): thread visible where world x ≤ front, plain zone where x ≥ front. setFront(localX) */
  function threadReveal(sh, flip = false) {
    const th = sh.userData.thread, pl = sh.userData.plain;
    const s = flip ? -1 : 1, pA = new THREE.Plane(new THREE.Vector3(-s, 0, 0), 0), pB = new THREE.Plane(new THREE.Vector3(s, 0, 0), 0);
    th.material.clippingPlanes = [pA]; pl.material.clippingPlanes = [pB];
    const v = new THREE.Vector3();
    return (front) => { v.set(front, 0, 0); sh.localToWorld(v); pA.constant = s * v.x; pB.constant = -s * v.x; };
  }
  /** generic reveal along world x for two groups: A kept where x ≤ front, B where x ≥ front (materials are cloned) */
  function revealX(A, B) {
    const pA = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), pB = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const setP = (G, p) => G.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.clippingPlanes = [p]; } });
    setP(A, pA); setP(B, pB);
    return (xw) => { pA.constant = xw; pB.constant = -xw; };
  }
  /** ball nut (axis X, flange at −x end) */
  function nut(stage = "turned", o = {}) {
    const m = o.hard ? C.hard : C.steel, g = new THREE.Group();
    if (stage === "slug") { g.add(part(cylX(42.5, 108, m), "work")); return g; }
    const ri = 17.3;
    const prof = [[-50, ri], [-50, 40], [-38, 40], [-38, 25], [50, 25], [50, ri], [-50, ri]];
    g.add(part(mesh(latheX(prof, 48), m), "work"));
    {
      // flange holes (after milling)
      if (o.holes) for (let k = 0; k < 6; k++) { const a = k / 6 * 2 * PI + PI / 6, h = cylX(4.6, 13, C.dark, -44, 32.5 * Math.cos(a), 32.5 * Math.sin(a), 12); g.add(h); g.userData.holes = (g.userData.holes || []).concat(h); }
      if (o.windows) for (let k = 0; k < 4; k++) { const a = k * PI / 2, w = box(14, 8, 9, C.dark, -20 + k * 16, 22 * Math.cos(a), 22 * Math.sin(a)); w.rotation.x = a; g.add(w); g.userData.win = (g.userData.win || []).concat(w); }
    }
    // internal groove helix (visible from the ends)
    const pts = []; for (let i = 0; i <= 8 * 24; i++) { const t = i / 24 * 2 * PI; pts.push(new THREE.Vector3(-36 + 10 * t / (2 * PI), (ri + 0.6) * Math.cos(t), (ri + 0.6) * Math.sin(t))); }
    g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 192, 1.6, 6), C.dark));
    g.userData.ri = ri;
    return g;
  }
  const shapeOf = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
  const extrX = (pts, L, steps = 1) => new THREE.ExtrudeGeometry(shapeOf(pts), { depth: L, bevelEnabled: false, curveSegments: 4, steps }).rotateY(PI / 2).translate(-L / 2, 0, 0);
  /** rail (axis X, bottom at y = 0, centre x = 0) */
  function rail(L = 1000, o = {}) {
    const key = "rail" + L + (o.steps || 1); if (!geoCache[key]) geoCache[key] = keep(extrX(railOutline("O"), L, o.steps || 1));
    const g = new THREE.Group(), m = o.mat || (o.hard ? C.hard : C.steel);
    const r = part(mesh(geoCache[key], m), "work"); g.add(r); g.userData.mesh = r;
    if (o.holes) { const n = Math.floor((L - 2 * LG.E) / LG.pitch) + 1; for (let k = 0; k < n; k++) g.add(cylY(5.5, 2, C.dark, -L / 2 + LG.E + k * LG.pitch, LG.H + 0.1, 0, 16)); g.userData.nHoles = n; }
    if (o.stripes) { const s = []; for (const sx of [-1, 1]) for (const [y, z] of [[12.5, 11.2], [20.8, 9.3]]) { const b = box(L, 3.6, 1.6, C.hard, 0, y, sx * z); g.add(b); s.push(b); } g.userData.stripes = s; }
    return g;
  }
  /** carriage body (axis X, bottom at the rail-bottom datum like bsfprod_geo) */
  function block(o = {}) {
    const key = "blk"; if (!geoCache[key]) geoCache[key] = keep(extrX(blockOutline("O"), LB.Lsteel));
    const g = new THREE.Group(), m = o.mat || (o.hard ? C.hard : C.steel);
    g.add(part(mesh(geoCache[key], m), "work"));
    if (o.caps) { for (const s of [-1, 1]) { const c = mesh(new THREE.ExtrudeGeometry(shapeOf(blockOutline("O")), { depth: 12, bevelEnabled: false }).rotateY(PI / 2).translate(s > 0 ? LB.Lsteel / 2 : -LB.Lsteel / 2 - 12, 0, 0), C.pom); g.add(c); } }
    return g;
  }

  /* ---------- particles (sparks, chips, coolant, spray, bubbles) */
  const systems = [];
  function particles(n, color, size = 4, o = {}) {
    const pos = new Float32Array(n * 3).fill(-1e5), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: o.op ?? 0.9, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    let k = 0; const gy = o.g ?? -9810, drag = o.drag ?? 0, maxLife = o.life ?? 0.6;
    const sys = {
      obj: pts,
      emit(cnt, [x, y, z], fn) { for (let i = 0; i < cnt; i++) { const j = k++ % n, v = fn(i); pos[j * 3] = x; pos[j * 3 + 1] = y; pos[j * 3 + 2] = z; vel[j * 3] = v[0]; vel[j * 3 + 1] = v[1]; vel[j * 3 + 2] = v[2]; life[j] = maxLife * (0.5 + 0.5 * Math.random()); } },
      upd(dt) {
        for (let j = 0; j < n; j++) {
          if (life[j] <= 0) continue;
          life[j] -= dt; if (life[j] <= 0) { pos[j * 3 + 1] = -1e5; continue; }
          vel[j * 3 + 1] += gy * dt; if (drag) { vel[j * 3] *= 1 - drag * dt; vel[j * 3 + 1] *= 1 - drag * dt; vel[j * 3 + 2] *= 1 - drag * dt; }
          pos[j * 3] += vel[j * 3] * dt; pos[j * 3 + 1] += vel[j * 3 + 1] * dt; pos[j * 3 + 2] += vel[j * 3 + 2] * dt;
          if (o.floor !== undefined && pos[j * 3 + 1] < o.floor) life[j] = 0;
        }
        geo.attributes.position.needsUpdate = true;
      },
      clear() { life.fill(0); pos.fill(-1e5); geo.attributes.position.needsUpdate = true; },
    };
    systems.push(sys); pts.addEventListener("removed", () => { const i = systems.indexOf(sys); if (i >= 0) systems.splice(i, 1); });
    return sys;
  }
  const rnd = (a = 1) => (Math.random() * 2 - 1) * a;
  // standard emitters (world coordinates of the emitting point are given in the parent's local frame)
  const sparks = (n = 400) => particles(n, 0xffb020, 3.2, { life: 0.35, g: -6000 });
  const chips = (n = 200, c = 0x9a6a3a) => particles(n, c, 5, { life: 0.8, g: -9000, floor: 0 });
  const coolant = (n = 300) => particles(n, 0x5aa9ff, 5, { life: 0.5, g: -9810, op: 0.6 });

  /* ---------- machine building blocks */
  function bed(L, W, H, m = C.body) { const g = grp(boxB(L, H, W, m)); g.add(boxB(L - 40, 12, W - 60, C.iron, 0, H, 0)); return g; }
  function headstock(H = 260, m = C.body) { const g = grp(boxB(320, H, 360, m), boxB(330, 8, 370, C.blue, 0, H - 4, 0)); return g; }
  function centre(dir = 1) { const c = mesh(new THREE.ConeGeometry(18, 40, 20), C.steel); c.rotation.z = dir > 0 ? -PI / 2 : PI / 2; return c; }
  function chuck(r = 110, w = 70) { const g = grp(cylX(r, w, C.dark, 0, 0, 0, 40)); for (let k = 0; k < 3; k++) { const j = box(w * 0.6, 26, 30, C.steel, w * 0.2, 0, 0); const gg = grp(j); j.position.y = r * 0.55; gg.rotation.x = k * 2 * PI / 3; g.add(gg); } return g; }
  function wheel(R, w, m = C.wheel, hub = C.steel) { const g = grp(cylZ(R, w, m, 0, 0, 0, 56), cylZ(R * 0.32, w + 6, hub, 0, 0, 0, 24)); return g; }
  function guardHalf(R, w) { const g = new THREE.Mesh(new THREE.CylinderGeometry(R + 18, R + 18, w + 30, 40, 1, true, -PI * 0.15, PI * 1.1), C.body2); g.material = C.body2; g.rotation.x = PI / 2; return g; }
  function cabin(L, W, H) { const g = grp(boxB(L, H, W, C.glass)); g.add(boxB(L, 30, W, C.body2, 0, H, 0)); return g; }
  function dial(r = 26) {                     // dial gauge (face toward +z), returns { g, needle }
    const g = grp(cylZ(r, 14, C.white, 0, 0, 0, 32), torus(r, 2.5, C.dark)), needle = boxB(2, r * 0.85, 2, C.red, 0, 0, 9);
    const nn = grp(needle); nn.position.z = 0; g.add(nn); g.add(boxB(6, 60, 6, C.steel, 0, -r - 60, 0));   // stem
    return { g, needle: nn };
  }
  function lamp(state = "green") { return grp(cylY(10, 30, C.dark), cylY(9, 18, state === "green" ? C.green : C.yellow, 0, 24, 0), cylY(9, 18, C.red, 0, 42, 0)); }
  function panel() { const g = grp(boxB(260, 380, 60, C.dark, 0, 900, 0)); g.add(box(210, 150, 4, C.glass, 0, 1180, 32)); return g; }

  /* ---------- small helpers */
  const lerp = (a, b, s) => a + (b - a) * s;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = (s) => s * s * (3 - 2 * s);
  // piecewise schedule: phases [[name, dur], …] → { name, s (0..1 within phase), i }
  const phase = (p, list) => { const tot = list.reduce((a, b) => a + b[1], 0); let t = p * tot; for (let i = 0; i < list.length; i++) { if (t <= list[i][1] || i === list.length - 1) return { name: list[i][0], s: clamp(t / list[i][1]), i }; t -= list[i][1]; } };
  // bend a mesh along x (vertex displacement in y): returns setBow(amplitude mm, centre x, half-length)
  function bendable(m) {
    const g = m.geometry, pos = g.attributes.position, orig = pos.array.slice();
    return (amp, xc = 0, half = 500) => {
      for (let i = 0; i < pos.count; i++) { const x = orig[i * 3], u = clamp(1 - Math.abs(x - xc) / half, 0, 1); pos.array[i * 3 + 1] = orig[i * 3 + 1] + amp * (u * u * (3 - 2 * u)); }
      pos.needsUpdate = true; g.computeBoundingSphere();
    };
  }
  return {
    THREE, V, C, M: std, mesh, box, boxB, cylY, cylX, cylZ, torus, grp, at, part, latheX, threadGeo, threadReveal, revealX, extrX, shapeOf,
    shaft, nut, rail, block, particles, sparks, chips, coolant, rnd,
    bed, headstock, centre, chuck, wheel, guardHalf, cabin, dial, lamp, panel, lerp, clamp, ease, phase, bendable,
    updParticles: (dt) => { for (const s of systems) s.upd(dt); },
    D: { BS, BN, LG, LB, TH },
  };
}
