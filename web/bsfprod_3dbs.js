/* Ball screw + guide factory – item 1: 3D ball screw BS-3210-1000-C5 + nut BN-3210-FL + end supports + coupling + motor.
 * Real thread form: gothic-arch groove (bsfprod_geo.js) swept along the helix (lead 10, right hand) on the shaft and inside the nut.
 * Nut return: internal deflector (main, 4 × 1 turn) · end cap (1 × 3.8 turns) · tube (2 × 2.5 turns). Preload: ball oversize or double nut + spacer.
 * Local frame: screw axis = z (mm), shaft z −500 … 500 (motor side −z); the assembly is turned so z → world X, y = up.
 * Kinematics: screw angle θ → nut travel s = −θ·Ph/2π (right hand); balls orbit in the nut at ω·(1 − Dw·cosα/dpw)/2.
 *   createBS3D(el, { onPick, onState }) → { setView, setNut, setPreload, play, setRpm, setTheta, labels, counts, travelCheck, snapshot, resize, S }
 * EXAMPLE geometry – check the maker's catalogue.
 */
import { createView, matKit, THREE } from "./bsfprod_3dcore.js";
import { BS, BN } from "./bsfprod_data.js";
import { TH, shaftRadius, nutRadius } from "./bsfprod_geo.js";

const TAU = Math.PI * 2;
const cylZ = (r, z0, z1, seg = 40) => new THREE.CylinderGeometry(r, r, z1 - z0, seg).rotateX(Math.PI / 2).translate(0, 0, (z0 + z1) / 2);
// lathe around z from [r, z] points (Lathe revolves around Y; rotateX(π/2) maps y → z)
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r, z)), seg).rotateX(Math.PI / 2);
const ring = (ri, ro, z0, z1, seg = 48) => lathe([[ri, z0], [ro, z0], [ro, z1], [ri, z1], [ri, z0]], seg);
const box = (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const smooth = (t) => t * t * (3 - 2 * t);

/* helical surface r = rFn(z, φ) between z0 and z1 (outward normals, or inward for the nut bore) */
function helical(z0, z1, rFn, nPhi = 64, dz = TH.Ph / 32, inward = false) {
  const nz = Math.ceil((z1 - z0) / dz) + 1, nv = nz * (nPhi + 1), pos = new Float32Array(nv * 3), idx = new Uint32Array((nz - 1) * nPhi * 6);
  for (let i = 0; i < nz; i++) {
    const z = z0 + (z1 - z0) * i / (nz - 1);
    for (let j = 0; j <= nPhi; j++) { const ph = TAU * j / nPhi, r = rFn(z, ph), k = (i * (nPhi + 1) + j) * 3; pos[k] = r * Math.cos(ph); pos[k + 1] = r * Math.sin(ph); pos[k + 2] = z; }
  }
  let q = 0;
  for (let i = 0; i < nz - 1; i++) for (let j = 0; j < nPhi; j++) {
    const a = i * (nPhi + 1) + j, b = a + 1, c = a + nPhi + 1, d = c + 1;
    if (!inward) { idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c; }
    else { idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
  return g;
}
/* polyline path with arc-length lookup */
function makePath(pts, loadedLen) {
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const len = cum[cum.length - 1] + pts[pts.length - 1].distanceTo(pts[0]);
  const at = (s, out) => {
    s = ((s % len) + len) % len;
    if (s >= cum[cum.length - 1]) { const t = (s - cum[cum.length - 1]) / (len - cum[cum.length - 1]); return out.lerpVectors(pts[pts.length - 1], pts[0], t); }
    let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    return out.lerpVectors(pts[lo], pts[hi], (s - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]));
  };
  return { pts, cum, len, loadedLen, at };
}
const hz = (phi, k) => TH.Ph * (phi / TAU + 0.5 + k);                     // groove centre z on the helix (nut frame = shaft frame at θ = 0)
const hp = (phi, k, r = TH.Rb) => new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), hz(phi, k));
const cyl = (phi, r, z) => new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z);
const kFor = (zTarget, phi0) => Math.round(zTarget / TH.Ph - phi0 / TAU - 0.5);
function helixPts(phi0, phi1, k, step = 0.04) { const out = []; const n = Math.max(2, Math.ceil((phi1 - phi0) / step)); for (let i = 0; i <= n; i++) out.push(hp(phi0 + (phi1 - phi0) * i / n, k)); return out; }

export function createBS3D(el, opts = {}) {
  const V = createView(el, { near: 2, far: 20000, minDist: 20, maxDist: 5000, floorY: -55 });
  const { scene } = V;
  const K = matKit(), M = K.M;
  const MAT = {
    shaft: M(0xb7bfc8, "shaft", { m: 0.75, r: 0.28 }), journal: M(0x9aa4ae, "shaft", { m: 0.7, r: 0.35 }),
    nut: M(0x6f86a0, "nut", { m: 0.6, r: 0.35, ds: true }), nutIn: M(0x8da3bb, "nut", { m: 0.6, r: 0.3, ds: true }),
    seal: M(0x1f2226, "seal", { m: 0.1, r: 0.8, ds: true }), defl: M(0xe67e22, "defl", { m: 0.3, r: 0.5, ds: true }),
    cap: M(0x2e8b57, "cap", { m: 0.1, r: 0.6, ds: true }), tube: M(0x555b62, "tube", { m: 0.7, r: 0.35, ds: true }), spacer: M(0xc79a3a, "spacer", { m: 0.7, r: 0.3, ds: true }),
    ball: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.25 }),
    house: M(0x3d6fb6, "house", { m: 0.3, r: 0.55, ds: true }), brg: M(0xc9ced3, "brg", { m: 0.8, r: 0.25, ds: true }), bball: M(0xe9ecef, "brg", { m: 0.8, r: 0.2 }),
    lock: M(0x2f3439, "brg", { m: 0.6, r: 0.4, ds: true }), cpl: M(0xb0b8c0, "cpl", { m: 0.8, r: 0.3, ds: true }), motor: M(0x2b2f33, "motor", { m: 0.4, r: 0.5, ds: true }),
    motorF: M(0x50565c, "motor", { m: 0.5, r: 0.45, ds: true }), sec: M(0x9db4cf, "sec", { m: 0.1, r: 0.8, ds: true }), secH: M(0x7f9fc9, "sec", { m: 0.1, r: 0.8, ds: true }), base: M(0xa7aeb5, "base", { m: 0.2, r: 0.8 }), hole: M(0x15181b, "nut", { m: 0.2, r: 0.9 }),
  };
  K.all.push(MAT.ball);
  const asm = new THREE.Group(); asm.rotation.y = Math.PI / 2; scene.add(asm);       // local z → world x
  const add = (geo, mat, parent, part, ex) => { const m = new THREE.Mesh(geo, mat); if (part) m.userData.part = part; if (ex) m.userData.ex = new THREE.Vector3(...ex); parent.add(m); return m; };
  const group = (parent, part, ex, pos) => { const g = new THREE.Group(); if (part) g.userData.part = part; if (ex) g.userData.ex = new THREE.Vector3(...ex); if (pos) g.position.set(...pos); parent.add(g); return g; };
  const anchor = (parent, p) => { const o = new THREE.Object3D(); o.position.set(...p); parent.add(o); return o; };

  /* ---------------- shaft (rotates) + coupling + motor shaft */
  const rotG = group(asm, null);
  const shaftG = group(rotG, "shaft");
  add(helical(-375, 475, shaftRadius), MAT.shaft, shaftG, "shaft");
  add(new THREE.CircleGeometry(TH.ro, 48).translate(0, 0, 475), MAT.journal, shaftG, "shaft");
  add(new THREE.CircleGeometry(TH.ro, 48).rotateY(Math.PI).translate(0, 0, -375), MAT.journal, shaftG, "shaft");
  add(cylZ(10, -500, -450), MAT.journal, shaftG, "shaft"); add(cylZ(12.5, -450, -390), MAT.journal, shaftG, "shaft");
  add(cylZ(15, -390, -375), MAT.journal, shaftG, "shaft"); add(cylZ(10, 475, 500), MAT.journal, shaftG, "shaft");
  add(box(6, 3, 20, 0, 10.5, -470), MAT.lock, shaftG, "shaft");                                  // key on the motor journal (shows the rotation)
  const cplG = group(rotG, "coupling", [0, 0, -90]);
  add(cylZ(20, -500, -478), MAT.cpl, cplG); add(cylZ(20, -545, -522), MAT.cpl, cplG);
  for (let i = 0; i < 6; i++) add(ring(9, i % 2 ? 17 : 21, -522 + i * 22 / 6, -522 + (i + 1) * 22 / 6), MAT.cpl, cplG);
  add(box(3, 6, 18, 0, 20, -489), MAT.lock, cplG); add(box(3, 6, 18, 0, 20, -533.5), MAT.lock, cplG);   // clamping slots
  const motorShaft = add(cylZ(9.5, -560, -522), MAT.journal, cplG, "motor");

  /* ---------------- motor, supports, base (fixed) */
  const motorG = group(asm, "motor", [0, 0, -170]);
  add(box(100, 100, 12, 0, 0, -566), MAT.motorF, motorG); add(box(92, 92, 168, 0, 0, -656), MAT.motor, motorG);
  add(cylZ(36, -770, -740), MAT.motorF, motorG); add(box(40, 30, 50, 0, 58, -640), MAT.motorF, motorG);   // encoder cap + connector box
  add(box(120, 9, 210, 0, -50.5, -665), MAT.base, asm, "base");
  add(box(170, 18, 1310, 0, -64, -125), MAT.base, asm, "base");
  const fixG = group(asm, "fixed", [0, 120, 0]);
  add(box(100, 95, 50, 0, -7.5, -416), MAT.house, fixG);
  const brgG = group(asm, "fixed", [0, 120, 40]);
  const bearing = (z0, z1, ri, ro, nb, rb, parent) => {
    add(ring(ri, ri + (ro - ri) * 0.32, z0, z1), MAT.brg, parent); add(ring(ro - (ro - ri) * 0.32, ro, z0, z1), MAT.brg, parent);
    const bi = new THREE.InstancedMesh(new THREE.SphereGeometry(rb, 14, 10), MAT.bball, nb), mm = new THREE.Matrix4();
    for (let i = 0; i < nb; i++) { const a = TAU * i / nb, rr = (ri + ro) / 2; mm.makeTranslation(rr * Math.cos(a), rr * Math.sin(a), (z0 + z1) / 2); bi.setMatrixAt(i, mm); }
    parent.add(bi); return bi;
  };
  bearing(-436, -421, 12.5, 31, 13, 4.6, brgG); bearing(-421, -406, 12.5, 31, 13, 4.6, brgG);
  add(ring(12.5, 20, -450, -442), MAT.lock, group(asm, "locknut", [0, 0, -60]));
  const floG = group(asm, "float", [0, 120, 0]);
  add(box(90, 90, 35, 0, -10, 482.5), MAT.house, floG);
  const fbrG = group(asm, "float", [0, 120, 40]);
  bearing(476, 488, 10, 21, 9, 3.2, fbrG); add(ring(10, 12.5, 490, 491.5), MAT.lock, fbrG);

  /* ---------------- nut (moves along z), rebuilt on option change */
  const nutG = group(asm, null);
  const ballInst = { mesh: null, paths: [], n: [] };
  const S = { view: "asm", nut: "deflector", pre: "oversize", theta: 0, s0: 50, dir: 1, rpm: 30, play: false, ex: 0, exT: 0, labels: true, circuits: 0, balls: 0 };
  let nutParts = [];
  const C0 = new THREE.Color(0xdfe4ea), C1 = new THREE.Color(0xf2c200);
  function buildNut() {
    for (const o of nutParts) { nutG.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); }); }
    nutParts = [];
    const P = (o) => { nutParts.push(o); return o; };
    const body = P(group(nutG, "nut", [0, 80, 0]));
    const segs = S.pre === "double" ? [[-50, -5, true], [5, 50, false]] : S.nut === "endcap" ? [[-24, 24, true]] : [[-45, 45, true]];
    for (const [z0, z1, fl] of segs) {
      const pts = fl ? [[TH.riN, z0], [BN.D4 / 2, z0], [BN.D4 / 2, z0 + BN.flangeT], [BN.D1 / 2, z0 + BN.flangeT], [BN.D1 / 2, z1], [TH.riN, z1]] : [[TH.riN, z0], [BN.D1 / 2, z0], [BN.D1 / 2, z1], [TH.riN, z1]];
      add(lathe(pts, 64), MAT.nut, body, "nut");
      add(helical(z0, z1, nutRadius, 64, TH.Ph / 32, true), MAT.nutIn, body, "nut");
      // section faces (shown in the cut-away view): inner = groove profile at φ = ±90°, outer = body / flange
      for (const sg of [1, -1]) {
        const ph = sg > 0 ? Math.PI / 2 : 3 * Math.PI / 2, sh = new THREE.Shape(), n = Math.ceil((z1 - z0) / 0.2);
        for (let i = 0; i <= n; i++) { const z = z0 + (z1 - z0) * i / n, r = nutRadius(z, ph); i ? sh.lineTo(z, sg * r) : sh.moveTo(z, sg * r); }
        pts.slice().reverse().forEach(([r, z]) => { if (r > TH.riN + 0.01) sh.lineTo(z, sg * r); });
        sh.closePath();
        const cap = add(new THREE.ShapeGeometry(sh).rotateY(-Math.PI / 2).translate(-0.05, 0, 0), MAT.sec, body, "nut"); cap.userData.sec = true;
      }
      if (fl) {
        for (let i = 0; i < 6; i++) { const a = TAU * i / 6 + Math.PI / 6; add(cylZ(4.6, z0 - 0.4, z0 + BN.flangeT + 0.4, 16).translate(BN.boltCircle / 2 * Math.cos(a), BN.boltCircle / 2 * Math.sin(a), 0), MAT.hole, body, "flange"); }
        const nip = add(new THREE.CylinderGeometry(3, 3, 14, 12).translate(0, BN.D4 / 2 + 6, z0 + BN.flangeT / 2), MAT.lock, body, "flange");
        nip.userData.part = "flange";
      }
    }
    if (S.pre === "double") add(ring(TH.riN + 0.3, BN.D1 / 2, -5, 5), MAT.spacer, P(group(nutG, "spacer", [0, 80, 0])), "spacer");
    const zEnd = S.pre === "double" ? 50 : S.nut === "endcap" ? 32 : 45;
    const seals = P(group(nutG, "seal", [0, 80, 0]));
    const sl = add(ring(TH.ro + 0.15, 23.5, -zEnd - 5, -zEnd), MAT.seal, seals, "seal"); sl.userData.ex = new THREE.Vector3(0, 0, -25);
    const sr = add(ring(TH.ro + 0.15, 23.5, zEnd, zEnd + 5), MAT.seal, seals, "seal"); sr.userData.ex = new THREE.Vector3(0, 0, 25);
    // circuits
    const paths = [];
    const retG = P(group(nutG, null, [0, 130, 0]));
    if (S.nut === "deflector" || S.pre === "double") {
      // circuits follow each other on the helix: + 1 turn + 90° stagger → Δz = 12.5 mm (no overlap)
      const Z = S.pre === "double" ? [-35, -22.5, 10, 22.5] : [-25, -12.5, 0, 12.5], D = 0.62;
      Z.forEach((zt, i) => {
        const phi0 = i * Math.PI / 2, k = kFor(zt, phi0), phiE = phi0 + TAU - D;
        const load = helixPts(phi0, phiE, k), zE = hz(phiE, k), zS = hz(phi0, k), ret = [];
        for (let j = 1; j < 24; j++) { const t = j / 24; ret.push(cyl(phiE + D * t, TH.Rb + 2.9 * Math.sin(Math.PI * t), zE + (zS - zE) * smooth(t))); }
        const loadLen = makePath(load, 0).cum[load.length - 1];
        paths.push(makePath(load.concat(ret), loadLen));
        const pm = phiE + D / 2, g = add(box(15, 7, 12), MAT.defl, retG, "deflector");
        g.position.copy(cyl(pm, TH.Rb + 3.4, (zE + zS) / 2)); g.rotation.z = pm + Math.PI / 2;
      });
    } else if (S.nut === "endcap") {
      const T = 3 + (TAU - 1.2) / TAU, phi0 = Math.PI, k = kFor(-20, phi0), phiE = phi0 + TAU * T, zS = hz(phi0, k), zE = hz(phiE, k), rr = 21.6;
      const load = helixPts(phi0, phiE, k), loadLen = makePath(load, 0).cum[load.length - 1];
      const phR = phiE + 0.6;
      const cr = new THREE.CatmullRomCurve3([hp(phiE, k), cyl(phiE + 0.25, TH.Rb + 0.8, zE + 3), cyl(phiE + 0.5, rr - 1.5, zE + 6), cyl(phR, rr, 28),
        cyl(phR, rr, 0), cyl(phR, rr, -28), cyl(phi0 - 0.5, rr - 1.5, zS - 6), cyl(phi0 - 0.25, TH.Rb + 0.8, zS - 3), hp(phi0, k)], false, "centripetal");
      const ret = cr.getSpacedPoints(120).slice(1, -1);
      paths.push(makePath(load.concat(ret), loadLen));
      for (const s of [-1, 1]) { const c = add(ring(TH.ro + 0.6, BN.D1 / 2, s > 0 ? 24 : -32, s > 0 ? 32 : -24), MAT.cap, retG, "endcap"); c.userData.ex = new THREE.Vector3(0, 0, s * 30); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([cyl(phR, rr, 28), cyl(phR, rr, -28)]), 4, TH.Dw / 2 + 0.7, 12, false), MAT.cap, retG, "endcap");
    } else {   // tube
      [[-27, 0], [3, 0]].forEach(([zt, phi0]) => {
        const k = kFor(zt, phi0), phiE = phi0 + TAU * 2.5, zS = hz(phi0, k), zE = hz(phiE, k);
        const load = helixPts(phi0, phiE, k), loadLen = makePath(load, 0).cum[load.length - 1];
        const cr = new THREE.CatmullRomCurve3([hp(phiE, k), cyl(phiE + 0.15, TH.Rb + 4, zE + 1.5), cyl(phiE + 0.05, 28.5, zE + 3), cyl(Math.PI * 0.75, 31, zE), cyl(Math.PI / 2, 32, (zE + zS) / 2),
          cyl(Math.PI * 0.25, 31, zS), cyl(phi0 - 0.05, 28.5, zS - 3), cyl(phi0 - 0.15, TH.Rb + 4, zS - 1.5), hp(phi0, k)], false, "centripetal");
        const ret = cr.getSpacedPoints(140).slice(1, -1);
        paths.push(makePath(load.concat(ret), loadLen));
        add(new THREE.TubeGeometry(cr, 120, TH.Dw / 2 + 0.8, 12, false), MAT.tube, retG, "tube");
      });
      add(box(46, 4, 70, 0, 38, 0), MAT.tube, retG, "tube");
    }
    // balls
    const step = TH.Dw * 1.03, n = paths.map((p) => Math.floor(p.len / step)), tot = n.reduce((a, b) => a + b, 0);
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(TH.Dw / 2 * 0.985, 16, 12), MAT.ball, tot);
    im.userData.part = "balls"; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < tot; i++) im.setColorAt(i, C0);
    nutG.add(im); P(im);
    Object.assign(ballInst, { mesh: im, paths, n });
    S.circuits = paths.length; S.balls = tot;
    // retG holds deflectors / end caps / tubes: its own exploded offset only for the deflectors
    retG.userData.ex = new THREE.Vector3(0, S.nut === "deflector" || S.pre === "double" ? 130 : 80, 0);
    collectEx(); applyEx(); applyView(false); placeBalls(); V.mark();
  }
  const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
  let sigma = 0;     // arc length the balls have moved (mm)
  function placeBalls() {
    const { mesh, paths, n } = ballInst; if (!mesh) return;
    let q = 0;
    paths.forEach((p, c) => {
      for (let i = 0; i < n[c]; i++) {
        const s = sigma + i * p.len / n[c], sm = ((s % p.len) + p.len) % p.len;
        p.at(s, _v); _m.makeTranslation(_v.x, _v.y, _v.z); mesh.setMatrixAt(q, _m);
        mesh.setColorAt(q, sm <= p.loadedLen ? C0 : C1); q++;
      }
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /* ---------------- exploded view: every object with userData.ex moves by ex · S.ex */
  let exList = [];
  function collectEx() { exList = []; asm.traverse((o) => { if (o.userData.ex) { if (!o.userData.p0) o.userData.p0 = o.position.clone(); exList.push(o); } }); }
  function applyEx() { for (const o of exList) o.position.copy(o.userData.p0).addScaledVector(o.userData.ex, S.ex); }

  /* ---------------- views */
  const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);      // keeps world z ≤ 0 (the back half)
  function applyView(cam = true) {
    const v = S.view;
    K.apply({ fade: v === "xray" ? ["nut", "seal", "house", "cpl", "motor", "spacer", "cap", "brg", "defl"] : [], op: 0.14,
      cut: v === "cut" ? ["nut", "seal", "house", "brg", "cpl", "motor", "spacer", "cap", "tube", "defl"] : [], plane: cutPlane });
    if (v === "xray") { MAT.defl.transparent = true; MAT.defl.opacity = 0.55; MAT.defl.depthWrite = false; }
    asm.traverse((o) => { if (o.userData.sec) o.visible = v === "cut"; });
    S.exT = v === "exploded" ? 1 : 0;
    if (cam) {
      const x = nutX();
      if (v === "asm") V.glide([-130, 0, 0], [120, 300, 980]);
      else if (v === "exploded") V.glide([-190, 40, 0], [80, 400, 1180]);
      else V.glide([x, 0, 0], [x + 130, 110, 260]);
    }
    V.mark();
  }
  const nutS = () => S.s0 - S.theta * TH.Ph / TAU;
  const nutX = () => nutS();
  function setPose() {
    rotG.rotation.z = S.theta;
    nutG.position.z = nutS();
    if (opts.onState) opts.onState({ theta: S.theta, s: nutS(), rpm: S.rpm, play: S.play, turns: S.theta / TAU });
  }
  // ball speed in the nut frame: ω_b = ω·(1 − γ)/2, γ = Dw·cosα / dpw; arc speed = ω_b · Rb / cos λ
  const gamma = TH.Dw * Math.cos(BN.alphaDeg * Math.PI / 180) / BS.dpw, lamC = Math.cos(Math.atan(TH.Ph / (Math.PI * BS.dpw)));
  const ballArc = (dTheta) => dTheta * (1 - gamma) / 2 * TH.Rb / lamC;
  function rotate(dTheta) {
    let th = S.theta + dTheta * S.dir, s = S.s0 - th * TH.Ph / TAU;
    if (s > 400 || s < -300) { S.dir *= -1; th = S.theta + dTheta * S.dir; }
    sigma += ballArc((th - S.theta)); S.theta = th; setPose(); placeBalls();
  }
  V.onTick((dt) => {
    let ch = false;
    if (S.play) { rotate(S.rpm / 60 * TAU * dt); ch = true; }
    if (Math.abs(S.ex - S.exT) > 1e-4) { S.ex += Math.sign(S.exT - S.ex) * Math.min(Math.abs(S.exT - S.ex), dt * 1.6); applyEx(); ch = true; }
    return ch;
  });

  /* ---------------- labels */
  const A = (p) => anchor(asm, p);
  V.tag("Servo motor", motorG, [0, 58, -660]);
  V.tag("Bellows coupling", cplG, [0, -30, -512]);
  V.tag("Lock nut", A([0, -26, -446]));
  V.tag("Fixed support – angular-contact pair 60°", fixG, [0, 64, -416], "drv");
  V.tag("Screw shaft Ø32 × 10 – gothic-arch groove, 58 – 62 HRC", A([0, -24, 200]));
  V.tag("Ball nut BN-3210-FL – flange DIN 69051-5 style", nutG, [0, 46, -30], "hl");
  V.tag("Wiper seal", nutG, [0, 26, 48], "", () => S.view !== "xray");
  V.tag("Balls in the return path (yellow)", nutG, [0, -28, 0], "drv", () => S.view === "xray" || S.view === "cut");
  V.tag("Deflector (1 per turn)", nutG, [0, 30, 6], "chn", () => (S.view === "xray" || S.view === "exploded") && (S.nut === "deflector" || S.pre === "double"));
  V.tag("End cap + axial return hole", nutG, [0, 28, 28], "chn", () => S.nut === "endcap" && S.pre !== "double");
  V.tag("Return tube", nutG, [0, 38, 0], "chn", () => S.nut === "tube" && S.pre !== "double");
  V.tag("Spacer (double-nut preload)", nutG, [0, -30, 0], "chn", () => S.pre === "double");
  V.tag("Floating support – deep-groove 6004", floG, [0, 60, 482]);
  V.pickable((part) => { if (opts.onPick) opts.onPick(part); });

  /* ---------------- start */
  buildNut(); setPose();
  V.glide([-130, 0, 0], [120, 300, 980], true);
  return {
    S, mark: V.mark,
    setView: (v, cam = true) => { S.view = v; applyView(cam); },
    setNut: (t) => { S.nut = t; if (t !== "deflector" && S.pre === "double") S.pre = "oversize"; buildNut(); },
    setPreload: (p) => { S.pre = p; if (p === "double") S.nut = "deflector"; buildNut(); },
    play: (on) => { S.play = !!on; V.mark(); }, setRpm: (r) => { S.rpm = r; },
    setTheta: (th) => { const d = th - S.theta; sigma += ballArc(d); S.theta = th; setPose(); placeBalls(); V.mark(); },
    labels: (on) => { S.labels = !!on; V.setTags(on); V.mark(); },
    counts: () => ({ circuits: S.circuits, balls: S.balls, perCircuit: ballInst.n.slice(), loops: ballInst.paths.map((p) => +p.len.toFixed(2)), frames: V.frames() }),
    // nut travel for Δθ (rad) and ball arc in the same time → test of s = Ph·θ/2π and of the ball speed ratio
    travelCheck: (dTheta) => ({ ds: -dTheta * TH.Ph / TAU, ballOrbit: (1 - gamma) / 2, arc: ballArc(dTheta) }),
    nutZ: () => nutG.position.z, rotate: (d) => { const s0 = S.dir; S.dir = 1; rotate(d); S.dir = s0; V.mark(); },
    sampleRadius: (z, phi) => ({ shaft: shaftRadius(z, phi), nut: nutRadius(z, phi) }),
    snapshot: V.snapshot, resize: V.resize,
  };
}
