/* Ball screw + guide factory – item 1: 3D profiled linear guide LG-25-1000 + carriage LB-25-FL.
 * Rail and carriage are extruded from the real section (bsfprod_geo.js: 4 raceways at 45°, O- or X-arrangement).
 * 4 recirculating ball rows: loaded line under the steel body, half circle in the end cap, return hole in the body.
 * When the carriage moves with v, the loaded balls roll with v/2 relative to the rail (= − v/2 relative to the carriage).
 * World: rail along X (x −500 … 500), Y up (rail bottom y = 0), Z lateral (z = − section x).
 *   createLG3D(el, { onPick, onState }) → { setView, setArr, setRoll, play, setSpeed, setPos, labels, counts, snapshot, resize, S }
 * EXAMPLE geometry – check the maker's catalogue.
 */
import { createView, matKit, THREE } from "./bsfprod_3dcore.js";
import { LG, LB } from "./bsfprod_data.js";
import { GD, railOutline, blockOutline, rowLoops, loopPoint } from "./bsfprod_geo.js";

const shapeOf = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
// extrude a section along world X from x0 to x1 (shape x → world −z, shape y → world y)
const extr = (pts, x0, x1) => new THREE.ExtrudeGeometry(shapeOf(pts), { depth: x1 - x0, bevelEnabled: false, curveSegments: 4 }).rotateY(Math.PI / 2).translate(x0, 0, 0);
const box = (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cylY = (r, h, x, y, z, seg = 20) => new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z);
const cylX = (r, x0, x1, y, z, seg = 16) => new THREE.CylinderGeometry(r, r, x1 - x0, seg).rotateZ(Math.PI / 2).translate((x0 + x1) / 2, y, z);

export function createLG3D(el, opts = {}) {
  const V = createView(el, { near: 1, far: 12000, minDist: 15, maxDist: 3000, floorY: 0 });
  const { scene } = V;
  const K = matKit(), M = K.M;
  const MAT = {
    rail: M(0xaeb6bf, "rail", { m: 0.75, r: 0.3, ds: true }), hole: M(0x1d2024, "rail", { m: 0.2, r: 0.8 }),
    block: M(0x7d91a8, "block", { m: 0.65, r: 0.32, ds: true }), bhole: M(0x1d2024, "block", { m: 0.2, r: 0.8 }),
    cap: M(0xb03a2e, "cap", { m: 0.05, r: 0.6, ds: true }), seal: M(0x1f2226, "seal", { m: 0.05, r: 0.85, ds: true }),
    ret: M(0xf0f0f0, "ret", { m: 0.05, r: 0.5, ds: true }), wire: M(0x3b4147, "wire", { m: 0.8, r: 0.3 }), nip: M(0xd4a017, "nip", { m: 0.8, r: 0.3 }),
    ball: new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.25 }), floor: M(0xc9ced3, "floor", { m: 0, r: 0.9 }),
    capR: M(0xd9dde2, "secR", { m: 0.1, r: 0.8, ds: true }), capB: M(0x9db4cf, "secB", { m: 0.1, r: 0.8, ds: true }),
  };
  MAT.ball.userData.role = "ball"; K.all.push(MAT.ball);
  const add = (geo, mat, parent, part, ex) => { const m = new THREE.Mesh(geo, mat); if (part) m.userData.part = part; if (ex) m.userData.ex = new THREE.Vector3(...ex); parent.add(m); return m; };
  const group = (parent, part, ex) => { const g = new THREE.Group(); if (part) g.userData.part = part; if (ex) g.userData.ex = new THREE.Vector3(...ex); parent.add(g); return g; };
  const S = { view: "asm", arr: "O", roll: "ball", x: 0, dir: 1, v: 40, play: false, ex: 0, exT: 0, rows: 0, balls: 0, perRow: [] };
  add(box(1100, 6, 160, 0, -3, 0), MAT.floor, scene, "base");

  const railG = group(scene, "rail"), blkG = group(scene, null), contactG = new THREE.Group(); scene.add(contactG);
  let parts = [], inst = null, loops = [];
  const C0 = new THREE.Color(0xdfe4ea), C1 = new THREE.Color(0xf2c200);
  const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);

  function build() {
    for (const o of parts) { o.parent.remove(o); o.traverse((q) => { if (q.geometry) q.geometry.dispose(); }); }
    parts = [];
    const P = (o) => { parts.push(o); return o; };
    const L2 = LG.L / 2, Ls2 = GD.Ls / 2, cap = 10.5, sl = 2.5;
    /* rail + 17 counterbores (pitch 60, E 20) */
    P(add(extr(railOutline(S.arr), -L2, L2), MAT.rail, railG, "rail"));
    for (let i = 0; i * LG.pitch <= LG.L - 2 * LG.E + 1e-6; i++) P(add(cylY(5.5, 0.6, -L2 + LG.E + i * LG.pitch, GD.H - 0.2, 0), MAT.hole, railG, "rail"));
    /* carriage */
    const bo = blockOutline(S.arr);
    const body = P(group(blkG, "block", [0, 60, 0]));
    add(extr(bo, -Ls2, Ls2), MAT.block, body, "block");
    for (const [x, z] of [[-22.5, -28.5], [22.5, -28.5], [-22.5, 28.5], [22.5, 28.5]]) add(cylY(4, 0.8, x, GD.Hasm + 0.1, z), MAT.bhole, body, "block");
    for (const s of [-1, 1]) {
      P(add(extr(bo, s > 0 ? Ls2 : -Ls2 - cap, s > 0 ? Ls2 + cap : -Ls2), MAT.cap, blkG, "gcap", [s * 40, 60, 0]));
      P(add(extr(bo, s > 0 ? Ls2 + cap : -Ls2 - cap - sl, s > 0 ? Ls2 + cap + sl : -Ls2 - cap), MAT.seal, blkG, "gseal", [s * 75, 60, 0]));
      P(add(box(GD.Ls + 2 * cap, 1.4, 3.5, 0, GD.H1 - 0.7, s * 14.2), MAT.seal, blkG, "gseal", [0, -14, s * 10]));
    }
    const nip = P(group(blkG, "nipple", [-100, 60, 0]));
    add(cylX(2.6, -Ls2 - cap - sl - 9, -Ls2 - cap - sl, 30, 0), MAT.nip, nip, "nipple");
    add(new THREE.CylinderGeometry(4, 4, 4, 6).rotateZ(Math.PI / 2).translate(-Ls2 - cap - sl - 2, 30, 0), MAT.nip, nip, "nipple");
    /* ball rows: return pipes, retainers, balls */
    loops = rowLoops(S.arr);
    const A = GD.arr[S.arr];
    const retG = P(group(blkG, "gret", [0, 60, 0])), wireG = P(group(blkG, "retainer", [0, 28, 0]));
    loops.forEach((L) => {
      add(cylX(GD.Dw / 2 + 0.45, -Ls2, Ls2, L.q[1], -L.q[0]), MAT.ret, retG, "gret");
      // retainer wire: beside the loaded row, on the side away from the contact line (it holds the balls when the block leaves the rail)
      const dx = A.ip[0] * L.side - L.p[0], dy = A.ip[1] - L.p[1], d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d, sg = (nx * L.side + ny) > 0 ? 1 : -1;
      add(cylX(0.55, -Ls2, Ls2, L.p[1] + sg * ny * 2.9, -(L.p[0] + sg * nx * 2.9)), MAT.wire, wireG, "retainer");
    });
    const per = loops.map((L) => Math.floor(L.len / (GD.Dw * 1.03))), tot = per.reduce((a, b) => a + b, 0);
    const geo = S.roll === "roller" ? new THREE.CylinderGeometry(GD.Dw / 2 * 0.95, GD.Dw / 2 * 0.95, GD.Dw * 0.9, 16) : new THREE.SphereGeometry(GD.Dw / 2 * 0.985, 14, 10);
    inst = new THREE.InstancedMesh(geo, MAT.ball, tot); inst.userData.part = S.roll === "roller" ? "rollers" : "gballs"; inst.frustumCulled = false; inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < tot; i++) inst.setColorAt(i, C0);
    blkG.add(inst); P(inst);
    S.rows = loops.length; S.balls = tot; S.perRow = per;
    /* contact lines + section faces (cut view) – the faces close the clipped rail and carriage */
    for (const c of contactG.children.slice()) { contactG.remove(c); c.geometry.dispose(); }
    const secShape = (pts, holes = []) => { const sh = shapeOf(pts); for (const [hx, hy, hr] of holes) { const h = new THREE.Path(); h.absarc(hx, hy, hr, 0, Math.PI * 2, true); sh.holes.push(h); } return new THREE.ShapeGeometry(sh, 24).rotateY(Math.PI / 2); };
    const mr = new THREE.Mesh(secShape(railOutline(S.arr)), MAT.capR); mr.position.x = -0.25; mr.userData.part = "rail"; contactG.add(mr);
    const holes = []; for (const sg of [1, -1]) A.ret.forEach(([x, y]) => holes.push([sg * x, y, GD.Dw / 2 + 0.45]));
    const mb = new THREE.Mesh(secShape(blockOutline(S.arr), holes), MAT.capB); mb.position.x = -0.2; mb.userData.part = "block"; contactG.add(mb);
    // the 4 loaded balls in the section plane (the moving balls behind the plane are hidden by the faces)
    const sbg = new THREE.SphereGeometry(GD.Dw / 2 * 0.985, 18, 12);
    for (const sg of [1, -1]) A.balls.forEach(([x, y]) => { const m = new THREE.Mesh(sbg, MAT.ball); m.position.set(-0.3, y, -sg * x); m.userData.part = "gballs"; contactG.add(m); });
    const lm = new THREE.LineBasicMaterial({ color: 0xd62828 });
    for (const sg of [1, -1]) A.balls.forEach((b) => {
      const p = [sg * b[0], b[1]], ip = [sg * A.ip[0], A.ip[1]], dx = ip[0] - p[0], dy = ip[1] - p[1], d = Math.hypot(dx, dy);
      const a = [p[0] - dx / d * 5, p[1] - dy / d * 5];
      contactG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.2, a[1], -a[0]), new THREE.Vector3(0.2, ip[1], -ip[0])]), lm));
    });
    collectEx(); applyEx(); applyView(false); placeBalls(); setPose(); V.mark();
  }
  let sig = 0;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _s0 = new THREE.Vector3(0, 0, 0), _p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  function placeBalls() {
    if (!inst) return;
    let k = 0;
    loops.forEach((L, r) => {
      const n = S.perRow[r];
      // roller axis = normal of the loop plane (x × (q − p))
      const dz = -(L.q[0] - L.p[0]), dy = L.q[1] - L.p[1], nrm = new THREE.Vector3(0, -dz, dy).normalize();
      _q.setFromUnitVectors(Y, nrm);
      for (let i = 0; i < n; i++) {
        const s = sig + i * L.len / n, pt = loopPoint(L, s);
        _p.set(pt.x, pt.y, -pt.z); _m.compose(_p, _q, S.view === "cut" && pt.x > GD.Dw / 2 ? _s0 : _s); inst.setMatrixAt(k, _m);   // cut view: balls in front of the section hidden
        inst.setColorAt(k, pt.loaded ? C0 : C1); k++;
      }
    });
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  let exList = [];
  function collectEx() { exList = []; blkG.traverse((o) => { if (o.userData.ex) { if (!o.userData.p0) o.userData.p0 = o.position.clone(); exList.push(o); } }); }
  function applyEx() { for (const o of exList) o.position.copy(o.userData.p0).addScaledVector(o.userData.ex, S.ex); }
  function applyView(cam = true) {
    const v = S.view;
    K.apply({ fade: v === "xray" ? ["block", "cap", "seal", "ret"] : [], op: 0.14, cut: v === "cut" ? ["rail", "block", "cap", "seal", "ret", "wire", "nip"] : [], plane: cutPlane });
    contactG.visible = v === "cut"; placeBalls();
    S.exT = v === "exploded" ? 1 : 0;
    if (cam) {
      const x = S.x;
      if (v === "cut") V.glide([x, 18, 0], [x + 150, 34, 26]);
      else if (v === "exploded") V.glide([x, 40, 0], [x + 210, 200, 260]);
      else if (v === "xray") V.glide([x, 20, 0], [x + 110, 120, 150]);
      else V.glide([x - 40, 10, 0], [x + 240, 190, 340]);
    }
    V.mark();
  }
  function setPose() {
    blkG.position.x = S.x; cutPlane.constant = S.x; contactG.position.x = S.x + 0.3;
    if (opts.onState) opts.onState({ x: S.x, v: S.v, play: S.play, dir: S.dir });
  }
  function move(dx) {
    let x = S.x + dx * S.dir;
    if (x > 400 || x < -400) { S.dir *= -1; x = S.x + dx * S.dir; }
    sig -= (x - S.x) / 2; S.x = x; setPose(); placeBalls();
  }
  V.onTick((dt) => {
    let ch = false;
    if (S.play) { move(S.v * dt); ch = true; }
    if (Math.abs(S.ex - S.exT) > 1e-4) { S.ex += Math.sign(S.exT - S.ex) * Math.min(Math.abs(S.exT - S.ex), dt * 1.6); applyEx(); ch = true; }
    return ch;
  });
  /* labels */
  const anc = (parent, p) => { const o = new THREE.Object3D(); o.position.set(...p); parent.add(o); return o; };
  V.tag("Rail LG-25-1000 (datum side marked)", anc(scene, [-300, 24, 0]), "", () => S.view !== "cut");
  V.tag("Carriage LB-25-FL (steel body)", anc(blkG, [0, 38, 0]), "hl", () => S.view !== "cut");
  V.tag("End cap – return path", anc(blkG, [36, 30, -30]), "chn", () => S.view !== "cut");
  V.tag("End seal (double lip)", anc(blkG, [-43, 18, 30]), "", () => S.view !== "cut");
  V.tag("Grease nipple M6 × 0.75", anc(blkG, [-56, 34, 0]), "drv", () => S.view !== "cut");
  V.tag("Bottom seal", anc(blkG, [0, 4, -16]), "", () => S.view === "exploded");
  V.tag("4 rows at 45° (loaded = grey, return = yellow)", anc(blkG, [0, 14, 24]), "drv", () => S.view === "xray" || S.view === "exploded");
  V.tag("Contact lines (red) meet " + "outside the rail = O", anc(blkG, [0.5, 2, 0]), "drv", () => S.view === "cut" && S.arr === "O");
  V.tag("Contact lines (red) meet inside the rail = X", anc(blkG, [0.5, 2, 0]), "drv", () => S.view === "cut" && S.arr === "X");
  V.tag("Retainer wire", anc(blkG, [20, 6, 20]), "", () => S.view === "exploded" || S.view === "xray");
  V.tag("Section: rail (grey) + carriage (blue), 4 return holes", anc(blkG, [0.5, 33, 0]), "hl", () => S.view === "cut");
  V.pickable((part) => { if (opts.onPick) opts.onPick(part); });

  build();
  V.glide([-40, 10, 0], [240, 190, 340], true);
  return {
    S, mark: V.mark,
    setView: (v, cam = true) => { S.view = v; applyView(cam); },
    setArr: (a) => { S.arr = a === "X" ? "X" : "O"; build(); },
    setRoll: (r) => { S.roll = r === "roller" ? "roller" : "ball"; build(); },
    play: (on) => { S.play = !!on; V.mark(); }, setSpeed: (v) => { S.v = v; },
    setPos: (x) => { const d = x - S.x; sig -= d / 2; S.x = x; setPose(); placeBalls(); V.mark(); },
    sigma: () => sig, _inst: () => inst,
    labels: (on) => { V.setTags(on); V.mark(); },
    counts: () => ({ rows: S.rows, balls: S.balls, perRow: S.perRow.slice(), holes: railG.children.length - 1, loops: loops.map((L) => +L.len.toFixed(2)), frames: V.frames() }),
    snapshot: V.snapshot, resize: V.resize,
  };
}
