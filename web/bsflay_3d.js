/* Ball screw + guide factory – item 3: live 3D digital twin of the whole hall (offline three.js).
 * createLay3D(el, B, { onPick(id) }) → { setMode(m), setView(v), setLabels(level), select(id), snapshot(), resize(), frames(), counts(), V }
 *   B = the simulation (bsfsim.js createSim / getBSF). Machines = simplified models built from a few instanced primitives
 *   (one InstancedMesh for neutral pieces, one for state / heat-map coloured pieces, one for cylinders) → ≈ 10 draw calls for 73 machines.
 *   Renders only when the element is visible and something changed (bsfprod_3dcore createView).
 * Units: metres. Plan (x, y) → 3D (X = x, Y = up, Z = −y). Modes: state | util | wip | oee | energy. Views: iso | top | walk.
 */
import { createView, THREE } from "./bsfprod_3dcore.js";
import { MTYPES, ROUTES } from "./bsfmfg_data.js";
import { HALL, ZONES, ZONE_KEYS, DOORS, CHARGERS, RACKS, COLS, WALLS, footRect } from "./bsflay_data.js";

export const STATE_COL = { OFF: "#4b4f55", IDLE: "#a9aeb4", STARVED: "#f2c94c", SETUP: "#1590a8", RUN: "#27ae60", BLOCKED: "#e67e22", DOWN: "#d03b3b" };
export const MODES = [["state", "Machine state"], ["util", "Utilisation"], ["wip", "WIP (queue)"], ["oee", "OEE"], ["energy", "Power"]];
const KIND = {
  saw: ["MS-SAW", "LG-SAW", "LG-CUT"], press: ["BS-STR", "LG-STR", "BS-STH", "LG-STH"], lathe: ["BS-CTR", "BS-TRN", "BN-TRN", "BN-HTN", "BS-ROL"],
  mc: ["BN-MC", "LB-MC", "LG-DRL"], grind: ["BS-CLP", "BS-CGR", "BN-ITG", "LG-SGR", "LB-SGR", "LB-RGR"], tgr: ["BS-TGR", "BS-WHL"], pgr: ["LG-PGR"],
  car: ["HT-CAR"], tmp: ["HT-TMP"], ind: ["BS-IND"], lind: ["LG-IND"], meas: ["QC-LED", "QC-RAL"], lab: ["QC-LAB"], wash: ["AS-WSH"],
};
const kindOf = (type) => Object.keys(KIND).find((k) => KIND[k].includes(type)) || "bench";
const NC = { body: "#d9dde2", dark: "#5d6166", mid: "#8c939b", glass: "#36495c", wood: "#b08a5a", blue: "#2f6db3", copper: "#b87333", granite: "#4a4d52", orange: "#e67e22", white: "#f4f5f6" };
// sequential scale (light → dark blue) for heat maps
const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];
export const seqCol = (v) => { const x = Math.min(1, Math.max(0, v)) * (SEQ.length - 1), i = Math.floor(x), f = x - i; const a = new THREE.Color(SEQ[i]), b = new THREE.Color(SEQ[Math.min(SEQ.length - 1, i + 1)]); return a.lerp(b, f); };
export const SEQ_COLORS = SEQ;

/* piece list of one machine in local coords: u along the footprint length, v across, z up; [shape, u, v, z0, su, sv, sz, colour | "S"] */
function pieces(type, L, W) {
  const k = kindOf(type), P = [];
  const box = (u, v, z0, su, sv, sz, c) => P.push(["b", u, v, z0, su, sv, sz, c]);
  const cyl = (u, v, z0, r, h, c) => P.push(["c", u, v, z0, r * 2, r * 2, h, c]);
  let top = 1.9;
  if (k !== "bench" && k !== "lab") box(0, 0, 0, L, W, 0.12, NC.dark);
  if (k === "saw") { box(-0.2 * L, 0, 0.12, 0.45 * L, 0.8 * W, 1.0, NC.body); box(0.25 * L, 0, 0.12, 0.5 * L, 0.3 * W, 0.7, NC.mid); top = 1.12; box(-0.2 * L, 0, top, 0.45 * L, 0.8 * W, 0.08, "S"); }
  else if (k === "press") { box(0, 0, 0.12, L, 0.55 * W, 0.8, NC.mid); box(0, -0.05 * W, 0.92, 0.22 * L, 0.7 * W, 1.6, NC.body); box(0, 0.12 * W, 2.1, 0.3 * L, 0.35 * W, 0.35, NC.blue); top = 2.52; box(0, -0.05 * W, 2.52, 0.22 * L, 0.7 * W, 0.08, "S"); }
  else if (k === "lathe") { box(0, 0, 0.12, L, W, 1.8, NC.body); box(-0.05 * L, -0.5 * W + 0.02, 0.9, 0.55 * L, 0.04, 0.6, NC.glass); box(0.44 * L, -0.42 * W, 0.8, 0.1 * L, 0.18 * W, 0.9, NC.dark); top = 1.92; box(0, 0, top, L, W, 0.08, "S"); }
  else if (k === "mc") { box(0, 0, 0.12, L, W, 2.4, NC.body); box(-0.05 * L, -0.5 * W + 0.02, 1.0, 0.45 * L, 0.04, 0.9, NC.glass); if (type === "LB-MC") cyl(0.32 * L, 0, 2.52, 0.18 * W, 0.4, NC.blue); top = 2.52; box(0, 0, top, L, W, 0.08, "S"); }
  else if (k === "grind") { box(0, 0, 0.12, L, W, 0.85, NC.mid); box(0.08 * L, 0, 0.97, 0.72 * L, 0.9 * W, 0.95, NC.body); cyl(-0.32 * L, 0.15 * W, 0.97, Math.min(0.24 * W, 0.18 * L), 0.9, NC.dark); top = 1.92; box(0.08 * L, 0, top, 0.72 * L, 0.9 * W, 0.08, "S"); }
  else if (k === "tgr") { box(0, 0, 0.12, L, W, 0.85, NC.mid); box(0, 0.05 * W, 0.97, 0.92 * L, 0.85 * W, 1.25, NC.body); box(-0.1 * L, 0.1 * W, 2.22, 0.25 * L, 0.4 * W, 0.7, NC.blue); box(0.42 * L, -0.42 * W, 0.12, 0.14 * L, 0.14 * W, 1.2, NC.dark); top = 2.22; box(0.2 * L, 0.05 * W, top, 0.5 * L, 0.85 * W, 0.08, "S"); }
  else if (k === "pgr") { box(0, 0, 0.12, L, 0.7 * W, 0.8, NC.mid); box(0, 0, 0.92, 0.95 * L, 0.35 * W, 0.15, NC.dark); box(0.05 * L, -0.42 * W, 0.12, 0.05 * L, 0.12 * W, 2.9, NC.body); box(0.05 * L, 0.42 * W, 0.12, 0.05 * L, 0.12 * W, 2.9, NC.body); box(0.05 * L, 0, 2.8, 0.07 * L, W, 0.45, NC.blue); top = 3.25; box(0.05 * L, 0, top, 0.07 * L, W, 0.08, "S"); box(-0.2 * L, 0, 1.6, 0.06 * L, 0.6 * W, 1.0, NC.body); }
  else if (k === "car") { box(-0.15 * L, 0, 0.12, 0.35 * L, 0.8 * W, 4.4, NC.mid); box(0.13 * L, 0, 0.12, 0.15 * L, 0.6 * W, 2.2, NC.body); box(0.36 * L, 0, 0.12, 0.22 * L, 0.7 * W, 3.0, NC.mid); box(0, 0.45 * W, 0.12, 0.98 * L, 0.08 * W, 0.3, NC.dark); box(-0.42 * L, -0.3 * W, 0.12, 0.12 * L, 0.3 * W, 1.6, NC.copper); top = 4.52; box(-0.15 * L, 0, top, 0.35 * L, 0.8 * W, 0.1, "S"); }
  else if (k === "tmp") { box(0, 0, 0.12, L, W, 2.8, NC.mid); top = 2.92; box(0, 0, top, L, W, 0.08, "S"); }
  else if (k === "ind") { box(0.28 * L, 0, 0.12, 0.38 * L, 0.65 * W, 2.0, NC.body); box(-0.2 * L, 0, 0.12, 0.3 * L, 0.45 * W, 3.9, NC.mid); cyl(-0.2 * L, -0.3 * W, 1.6, 0.18, 0.15, NC.copper); top = 4.02; box(-0.2 * L, 0, top, 0.3 * L, 0.45 * W, 0.08, "S"); }
  else if (k === "lind") { box(0, 0, 0.12, L, 0.3 * W, 0.8, NC.mid); box(-0.05 * L, 0, 0.12, 0.14 * L, 0.65 * W, 1.7, NC.body); box(0.38 * L, 0.3 * W, 0.12, 0.16 * L, 0.35 * W, 2.0, NC.body); top = 1.82; box(-0.05 * L, 0, top, 0.14 * L, 0.65 * W, 0.08, "S"); }
  else if (k === "meas") { box(0, 0, 0.12, L, W, 0.75, NC.granite); box(0.1 * L, 0, 0.87, 0.12 * L, 0.9 * W, 0.45, NC.body); top = 1.32; box(0.1 * L, 0, top, 0.12 * L, 0.9 * W, 0.06, "S"); }
  else if (k === "lab") { for (const [u, v] of [[-0.3, -0.3], [0.1, -0.3], [-0.3, 0.25], [0.1, 0.25]]) box(u * L, v * W, 0, 0.32 * L, 0.18 * W, 0.9, NC.white); box(0.38 * L, 0, 0, 0.15 * L, 0.5 * W, 1.6, NC.granite); top = 1.6; box(0.38 * L, 0, top, 0.15 * L, 0.5 * W, 0.06, "S"); }
  else if (k === "wash") { box(0, 0, 0.12, L, W, 1.7, NC.body); box(0, -0.5 * W + 0.02, 0.9, 0.8 * L, 0.04, 0.12, NC.blue); top = 1.82; box(0, 0, top, L, W, 0.08, "S"); }
  else { box(0, 0, 0, L, W, 0.85, type === "AS-PCK" ? NC.wood : NC.white); box(0.25 * L, 0.2 * W, 0.85, 0.25 * L, 0.3 * W, 0.6, NC.mid); top = 0.9; box(-0.15 * L, 0, 0.85, 0.5 * L, 0.6 * W, 0.05, "S"); }
  P.push(["b", 0.5 * L - 0.12, 0.5 * W - 0.12, top, 0.12, 0.12, 0.6, "S"]);   // status lamp column
  return { P, top: top + 0.6 };
}

export function createLay3D(el, B, opts = {}) {
  const V = createView(el, { bg: 0xe9edf1, far: 1500, near: 0.1, maxDist: 260, minDist: 1.5, fov: 40 });
  const { scene, camera, controls, renderer } = V;
  const g = new THREE.Group(); scene.add(g);
  const P3 = (x, y, z = 0) => new THREE.Vector3(x, z, -y);
  const S = { mode: "state", labels: "zones", sel: null, walk: null, dirty: true };
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.85, metalness: o.m ?? 0.05, transparent: !!o.op, opacity: o.op ?? 1, depthWrite: o.op ? false : true, side: o.ds ? THREE.DoubleSide : THREE.FrontSide });

  /* ---------- floor, zones, aisle, annex */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), std(0xc7ccd1)); ground.rotation.x = -Math.PI / 2; ground.position.set(40, -0.02, -28); g.add(ground);
  const planeAt = (r, col, op, y = 0.005) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r[2] - r[0], r[3] - r[1]), std(col, { op })); m.rotation.x = -Math.PI / 2; m.position.set((r[0] + r[2]) / 2, y, -(r[1] + r[3]) / 2); g.add(m); return m; };
  planeAt([0, 0, HALL.L, HALL.W], 0xdfe3e7, 0, 0.002);
  for (const z of ZONE_KEYS) { const Z = ZONES[z]; planeAt(Z.rect, new THREE.Color(Z.c), z === "AISLE" ? 0.28 : Z.annex ? 0.22 : 0.16, 0.006); }
  // aisle edge lines + lane dashes
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd4a017 }), laneMat = new THREE.LineDashedMaterial({ color: 0x7a6a20, dashSize: 1.2, gapSize: 0.8 });
  for (const y of [24.1, 27.9]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([P3(0, y, 0.02), P3(HALL.L, y, 0.02)]), lineMat));
  for (const y of [HALL.lanes.east, HALL.lanes.west]) { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([P3(0.5, y, 0.02), P3(HALL.L - 0.5, y, 0.02)]), laneMat); l.computeLineDistances(); g.add(l); }
  // outer walls (low, transparent) + columns
  const wallMat = std(0x9aa5b1, { op: 0.22, ds: true }), wallMat2 = std(0x6f8fb0, { op: 0.2, ds: true });
  const wallSeg = (x0, y0, x1, y1, h, mat) => { const hz = Math.abs(y1 - y0) < 1e-6; const m = new THREE.Mesh(new THREE.BoxGeometry(hz ? Math.abs(x1 - x0) : 0.15, h, hz ? 0.15 : Math.abs(y1 - y0)), mat); m.position.set((x0 + x1) / 2, h / 2, -(y0 + y1) / 2); g.add(m); };
  const rectWalls = (r, h, mat) => { wallSeg(r[0], r[1], r[2], r[1], h, mat); wallSeg(r[0], r[3], r[2], r[3], h, mat); wallSeg(r[0], r[1], r[0], r[3], h, mat); wallSeg(r[2], r[1], r[2], r[3], h, mat); };
  rectWalls([0, 0, HALL.L, HALL.W + HALL.annex], 1.2, wallMat);
  for (const w of WALLS) rectWalls(w, w[4], wallMat2);
  const colGeo = new THREE.BoxGeometry(0.45, HALL.h, 0.45), colMesh = new THREE.InstancedMesh(colGeo, std(0x7d8792, { r: 0.6, m: 0.3 }), COLS.length);
  const mtx = new THREE.Matrix4(); COLS.forEach((c, i) => { mtx.makeTranslation(c[0], HALL.h / 2, -c[1]); colMesh.setMatrixAt(i, mtx); }); g.add(colMesh);
  // annex boxes (utilities)
  const annexBox = (x0, y0, x1, y1, h, col) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, y1 - y0), std(col, { r: 0.7 })); m.position.set((x0 + x1) / 2, h / 2, -(y0 + y1) / 2); g.add(m); };
  annexBox(1, 49, 15, 55, 0.9, 0xbac2cc); annexBox(17, 50, 20, 53, 1.8, 0x5d7590); annexBox(21, 50, 24, 53, 1.8, 0x5d7590); annexBox(25, 50, 27, 55, 2.6, 0x9aa5b1);
  annexBox(29, 49.5, 37, 54.5, 1.6, 0x6b8e9e); annexBox(38, 50, 43, 55, 2.0, 0x8c939b); annexBox(45, 49.5, 51, 54.5, 2.6, 0x7a8a99); annexBox(52, 50, 55, 55, 2.0, 0x99a3ad);
  annexBox(57, 49.5, 64, 54.5, 3.5, 0x8c939b); annexBox(66, 50, 71, 54, 2.5, 0xb87333); annexBox(73, 49.5, 79, 54.5, 4.0, 0x7d8792);

  /* ---------- racks + stock fill */
  const rackFill = {};
  for (const r of RACKS) {
    const [x0, y0, x1, y1, h, lbl, kind] = r;
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, h, y1 - y0)), new THREE.LineBasicMaterial({ color: kind === "lock" ? 0x2e9e57 : 0x445566 }));
    frame.position.set((x0 + x1) / 2, h / 2, -(y0 + y1) / 2); g.add(frame);
    if (["raw", "kit", "fg", "sm", "soak"].includes(kind)) {
      const col = kind === "fg" ? 0xc8a165 : kind === "raw" ? 0x8a8f96 : kind === "sm" ? 0x7aa6d6 : kind === "soak" ? 0x9cc9a6 : 0xd8c27a;
      const f = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.2, 1, y1 - y0 - 0.2), std(col, { r: 0.6 })); f.position.set((x0 + x1) / 2, 0.5, -(y0 + y1) / 2); f.scale.y = 0.01; g.add(f);
      rackFill[lbl] = { f, h: h - 0.2, kind };
    } else if (kind !== "lock") { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.1, h * 0.9, y1 - y0 - 0.1), std(kind === "oil" ? 0x6b8e9e : 0x9aa5b1, { op: kind === "aux" ? 0.5 : 0 })); m.position.set((x0 + x1) / 2, h * 0.45, -(y0 + y1) / 2); g.add(m); }
  }
  // chargers
  for (const c of CHARGERS) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.25), std(0x2e9e57)); m.position.set(c[0] - 1.0, 0.25, -c[1]); g.add(m); }

  /* ---------- machines (instanced) */
  const recs = []; let nN = 0, nS = 0, nC = 0;
  const M = B.M.filter((m) => footRect(m.id, m.type));
  for (const m of M) {
    const T = MTYPES[m.type], [L, W] = T.foot, pc = pieces(m.type, L, W);
    recs.push({ m, pc, rot: m.rot, L, W }); for (const p of pc.P) { if (p[0] === "c") nC++; else if (p[7] === "S") nS++; else nN++; }
  }
  const geoB = new THREE.BoxGeometry(1, 1, 1); geoB.translate(0, 0.5, 0);
  const geoC = new THREE.CylinderGeometry(0.5, 0.5, 1, 18); geoC.translate(0, 0.5, 0);
  const matI = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.15 });
  const meshN = new THREE.InstancedMesh(geoB, matI(), nN), meshS = new THREE.InstancedMesh(geoB, matI(), nS), meshC = new THREE.InstancedMesh(geoC, matI(), Math.max(1, nC));
  const pickN = [], pickS = [], pickC = [], sIdx = M.map(() => []);
  let iN = 0, iS = 0, iC = 0;
  const col = new THREE.Color(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  recs.forEach((R, mi) => {
    const { m, pc } = R, rot = R.rot === 90, ang = rot ? Math.PI / 2 : 0; q.setFromAxisAngle(up, ang);
    for (const p of pc.P) {
      const [sh, u, v, z0, su, sv, sz, c] = p;
      const dx = rot ? -v : u, dy = rot ? u : v;   // rot 90: local u (length) along plan y
      ps.set(m.x + dx, z0, -(m.y + dy)); sc.set(su, sz, sv);
      mtx.compose(ps, q, sc);
      if (sh === "c") { meshC.setMatrixAt(iC, mtx); meshC.setColorAt(iC, col.set(c)); pickC[iC] = mi; iC++; }
      else if (c === "S") { meshS.setMatrixAt(iS, mtx); meshS.setColorAt(iS, col.set(STATE_COL.OFF)); pickS[iS] = mi; sIdx[mi].push(iS); iS++; }
      else { meshN.setMatrixAt(iN, mtx); meshN.setColorAt(iN, col.set(c)); pickN[iN] = mi; iN++; }
    }
  });
  [meshN, meshS, meshC].forEach((x) => { x.instanceMatrix.needsUpdate = true; if (x.instanceColor) x.instanceColor.needsUpdate = true; g.add(x); });
  const pickMap = new Map([[meshN, pickN], [meshS, pickS], [meshC, pickC]]);

  /* face point (WIP rack position) of each machine */
  const faceOf = (m) => { const [L, W] = MTYPES[m.type].foot, rot = m.rot === 90, a = rot ? W : L, b = rot ? L : W; const d = 0.75;
    return m.face === "N" ? [m.x, m.y + b / 2 + d, 1, 0] : m.face === "E" ? [m.x + a / 2 + d, m.y, 0, 1] : m.face === "W" ? [m.x - a / 2 - d, m.y, 0, 1] : [m.x, m.y - b / 2 - d, 1, 0]; };
  const faces = M.map(faceOf);
  const mIndex = new Map(M.map((m, i) => [m.id, i]));

  /* ---------- lots (WIP boxes) */
  const LOTMAX = 900;
  const lotMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.36, 0.42).translate(0, 0.18, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), LOTMAX);
  lotMesh.count = 0; g.add(lotMesh);
  const RCOL = Object.fromEntries(Object.keys(ROUTES).map((r) => [r, new THREE.Color(ROUTES[r].color)])); RCOL.KIT = new THREE.Color("#d8c27a");

  /* ---------- AGVs */
  const agvObj = new Map();
  const agvMake = (a) => {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.95).translate(0, 0.2, 0), std(0xe67e22, { r: 0.5 })); grp.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 12).translate(0.62, 0.43, 0), std(0x222222)); grp.add(lid);
    const load = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.8).translate(0, 0.6, 0), std(0xffffff, { r: 0.6 })); load.visible = false; grp.add(load);
    grp.userData = { load, last: [a.x, a.y], head: 0 }; grp.position.copy(P3(a.x, a.y)); g.add(grp);
    const tg = V.tag(a.id, grp, [0, 1.2, 0], "bf3-tag-agv", () => S.labels !== "off");
    const o = { grp, tg }; agvObj.set(a.id, o); return o;
  };

  /* ---------- labels */
  for (const z of ZONE_KEYS) { if (z === "AISLE") continue; const r = ZONES[z].rect; const o = new THREE.Object3D(); o.position.copy(P3((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, z === "GRIND" || z === "HT" || z === "SOFT" ? 6.5 : 4)); g.add(o); V.tag(ZONES[z].s, o, [0, 0, 0], "bf3-tag-zone", () => S.labels !== "off"); }
  const mTags = M.map((m) => { const o = new THREE.Object3D(); o.position.copy(P3(m.x, m.y, recs[mIndex.get(m.id)].pc.top + 0.3)); g.add(o); return V.tag(m.id, o, [0, 0, 0], "bf3-tag-m", () => S.labels === "machines" || S.sel === m.id); });
  const stockTags = {};
  for (const r of RACKS) if (rackFill[r[5]]) { const o = new THREE.Object3D(); o.position.copy(P3((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, r[4] + 0.5)); g.add(o); stockTags[r[5]] = V.tag("", o, [0, 0, 0], "bf3-tag-stock", () => S.labels !== "off"); }

  /* ---------- selection frame */
  const selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.LineBasicMaterial({ color: 0x1f6fd1 }));
  selBox.visible = false; g.add(selBox);
  function select(id) {
    S.sel = id || null; const i = mIndex.get(id);
    if (i === undefined) { selBox.visible = false; V.mark(); return; }
    const m = M[i], r = footRect(m.id, m.type);
    selBox.position.set((r[0] + r[2]) / 2, 0, -(r[1] + r[3]) / 2); selBox.scale.set(r[2] - r[0] + 0.5, recs[i].pc.top + 0.3, r[3] - r[1] + 0.5); selBox.visible = true; V.mark();
  }

  /* ---------- picking (instanced) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; if (S.walk) stopWalk(); });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects([meshN, meshS, meshC], false);
    if (hits.length && hits[0].instanceId !== undefined) { const mi = pickMap.get(hits[0].object)[hits[0].instanceId]; const id = M[mi].id; select(id); if (opts.onPick) opts.onPick(id); }
  });

  /* ---------- colouring */
  function colourOf(m) {
    if (S.mode === "state") return col.set(STATE_COL[m.state] || "#999");
    if (S.mode === "util") return seqCol(m.util || 0);
    if (S.mode === "wip") return seqCol(Math.min(1, ((B.Q[m.type] || []).length) / 8));
    if (S.mode === "oee") return seqCol(m.oee ? m.oee.OEE : 0);
    return seqCol(m.kW > 0 ? Math.min(1, m.power_kW / 60) : 0);
  }
  function paint() {
    if (S.mode !== "state") for (const m of M) { /* refresh OEE / util */ const t = m.t, busy = t.run + t.setup + t.down; m.util = t.on > 0 ? (t.run + t.setup) / t.on : 0; if (!m.oee) m.oee = { OEE: 0 }; m.oee.OEE = busy > 0 && t.run > 0 ? (t.run / busy) * Math.min(1, m._ideal / t.run) * ((m.good - (m._g0 || 0)) / Math.max(1, m.good - (m._g0 || 0) + m.scrap - (m._s0 || 0))) : 0; }
    M.forEach((m, mi) => { const c = colourOf(m); for (const k of sIdx[mi]) meshS.setColorAt(k, c); });
    meshS.instanceColor.needsUpdate = true;
  }

  /* ---------- per-tick update (lots, AGVs, stocks) */
  const tmpQ = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  function place(i, x, y, z, c) { if (i >= LOTMAX) return i; ps.set(x, z, -y); mtx.compose(ps, tmpQ, one); lotMesh.setMatrixAt(i, mtx); lotMesh.setColorAt(i, c); return i + 1; }
  function update() {
    paint();
    // lots
    let n = 0; const slot = new Map(), doorSlot = {};
    const putAt = (mi, L) => { const k = slot.get(mi) || 0; slot.set(mi, k + 1); const [fx, fy, ax, ay] = faces[mi], m = M[mi];
      const ox = ay ? Math.sign(fx - m.x) : 0, oy = ax ? Math.sign(fy - m.y) : 0;   // outward from the machine
      const col4 = k % 4, lev = Math.floor(k / 4) % 4, row = Math.floor(k / 16), off = (col4 - 1.5) * 0.6;
      n = place(n, fx + ax * off + ox * row * 0.55, fy + ay * off + oy * row * 0.55, lev * 0.38, RCOL[L.route] || RCOL.KIT); };
    for (const L of B.lots) {
      if (L.state === "agv" || L.state === "move") continue;
      if (L.state === "raw") { const k = (doorSlot.RAWW = (doorSlot.RAWW || 0) + 1) - 1; n = place(n, 9 + (k % 4) * 0.6, 44.5 - Math.floor(k / 4) % 6 * 0.55, Math.floor(k / 24) * 0.38, RCOL[L.route]); continue; }
      if (L.state === "wait-agv") { const D = DOORS[L.zone]; if (!D) continue; const k = (doorSlot[L.zone] = (doorSlot[L.zone] || 0) + 1) - 1; const dir = D[1] >= 28 ? 1 : -1; n = place(n, D[0] - 2 + (k % 6) * 0.6, D[1] + dir * (1.0 + Math.floor(k / 6) * 0.55), 0, RCOL[L.route]); continue; }
      let mid = L.machine && mIndex.has(L.machine) ? mIndex.get(L.machine) : -1;
      if (mid < 0 && L.op) { // queued at the type: spread over the instances
        const type = L.kind === "kit" ? "QC-INC" : (B.routes[L.route] ? B.routes[L.route].ops[L.i].m : null); const list = type && B.byType[type] ? B.byType[type] : null;
        if (list && list.length) { const qi = (B.Q[type] || []).indexOf(L); mid = mIndex.get(list[Math.max(0, qi) % list.length].id) ?? -1; }
      }
      if (mid >= 0) putAt(mid, L);
    }
    lotMesh.count = n; lotMesh.instanceMatrix.needsUpdate = true; if (lotMesh.instanceColor) lotMesh.instanceColor.needsUpdate = true;
    // AGVs
    const seen = new Set();
    for (const a of B.agvs) {
      const o = agvObj.get(a.id) || agvMake(a); seen.add(a.id);
      const ud = o.grp.userData, dx = a.x - ud.last[0], dy = a.y - ud.last[1];
      if (Math.hypot(dx, dy) > 0.02) { ud.head = Math.atan2(dy, dx); ud.last = [a.x, a.y]; }
      o.grp.position.copy(P3(a.x, a.y)); o.grp.rotation.y = ud.head;
      ud.load.visible = !!a.lot; if (a.lot) ud.load.material.color.copy(RCOL[a.lot.route] || RCOL.KIT);
      o.tg.d.textContent = `${a.id} ${a.state === "CHARGING" ? "charging" : a.lot ? a.lot.route : a.state === "IDLE" ? "idle" : "empty"} ${Math.round(a.soc)} %`;
    }
    for (const [id, o] of agvObj) if (!seen.has(id)) { g.remove(o.grp); o.tg.d.remove(); o.tg.show = () => false; agvObj.delete(id); }
    // stocks
    const st = B.stores, smSum = (r) => Object.keys(st.sm).reduce((s, k) => s + (st.sm[k][r] || 0), 0);
    const fill = {
      "Cantilever rack – bars Ø36 + Ø85 (6 m)": [(st.raw.BS + st.raw.BN) / 1600, `bars: ${st.raw.BS} screw + ${st.raw.BN} nut blanks`],
      "Cantilever rack – rail + block profiles (4 m / 3 m)": [(st.raw.LG + st.raw.LB) / 4000, `profiles: ${st.raw.LG} rail + ${st.raw.LB} block blanks`],
      "Shelves – bought parts (balls, seals, end caps)": [(st.kits.BS + st.kits.LB) / 4000, `kits: ${st.kits.BS} screw + ${st.kits.LB} block`],
      "Component supermarket (screws, nuts, rails, blocks)": [(smSum("BS") + smSum("BN") + smSum("LG") + smSum("LB")) / 1200, `supermarket: ${smSum("BS")} S · ${smSum("BN")} N · ${smSum("LG")} R · ${smSum("LB")} B`],
      "FG rack A (screw sets, wooden boxes)": [st.fg.FABS / 500, `FG screw sets: ${st.fg.FABS}`],
      "FG rack B (guide sets)": [st.fg.FALG / 800, `FG guide sets: ${st.fg.FALG}`],
      "Soak buffer ≥ 4 h (shafts + rails)": [Math.min(1, ((B.Q["BS-CLP"] || []).length + (B.Q["LG-SGR"] || []).length) / 8), `soak buffer: ${(B.Q["BS-CLP"] || []).length + (B.Q["LG-SGR"] || []).length} lots`],
    };
    for (const [k, [f, txt]] of Object.entries(fill)) { const R = rackFill[k]; if (R) { const h = Math.max(0.02, Math.min(1, f)) * R.h; R.f.scale.y = h; R.f.position.y = h / 2; } if (stockTags[k]) stockTags[k].d.textContent = txt; }
    if (S.sel) { const i = mIndex.get(S.sel); if (i !== undefined) mTags[i].d.textContent = `${S.sel} · ${M[i].state}`; }
    V.mark();
  }
  let pend = true;
  B.on("tick", () => { pend = true; });
  B.on("machine", () => { pend = true; });

  /* ---------- views + walk-through */
  const VIEWS = { iso: [[40, 0, -22], [-14, 58, 40]], top: [[40, 0, -26], [40.01, 112, -25.5]], grind: [[21, 0, -11], [21, 26, 18]], ht: [[66, 0, -38], [52, 22, -10]] };
  const WALK = [[3, 26], [36.5, 26], [38.5, 23], [38.5, 15], [4, 15], [4, 8], [40, 8], [40, 15], [38.5, 23], [40, 26], [56, 26], [56, 31], [56, 26], [58, 26], [58, 20], [64, 15], [58, 11], [58, 26], [77, 26], [77, 25.5], [3, 25.5]];
  const walkLen = WALK.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - WALK[i - 1][0], p[1] - WALK[i - 1][1]) : 0), 0);
  const along = (d) => { d = ((d % walkLen) + walkLen) % walkLen; for (let i = 1; i < WALK.length; i++) { const a = WALK[i - 1], b = WALK[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L) return [a[0] + (b[0] - a[0]) * d / L, a[1] + (b[1] - a[1]) * d / L]; d -= L; } return WALK[0]; };
  function stopWalk() { S.walk = null; controls.enabled = true; }
  function setView(v) {
    if (v === "walk") { S.walk = { d: 0 }; controls.enabled = false; return; }
    stopWalk(); const w = VIEWS[v] || VIEWS.iso; V.glide(w[0], w[1]);
  }
  const look = new THREE.Vector3();
  V.onTick((dt) => {
    let ch = false;
    if (pend) { pend = false; update(); ch = true; }
    if (S.walk) {
      S.walk.d += dt * 2.2; const p = along(S.walk.d), t = along(S.walk.d + 5);
      camera.position.set(p[0], 1.75, -p[1]); look.set(t[0], 1.45, -t[1]); controls.target.copy(look); camera.lookAt(look); ch = true;
    }
    return ch;
  });
  V.glide(VIEWS.iso[0], VIEWS.iso[1], true);
  update();

  return {
    V, setMode: (m) => { S.mode = m; update(); }, setView, setLabels: (l) => { S.labels = l; V.setTags(l !== "off" || !!S.sel); V.mark(); }, select, update,
    snapshot: () => { update(); return V.snapshot(); }, resize: () => V.resize(), frames: () => V.frames(),
    counts: () => ({ machines: M.length, instN: nN, instS: nS, instC: nC, lots: lotMesh.count, agvs: agvObj.size, drawObjects: g.children.length }),
    mode: () => S.mode, walking: () => !!S.walk,
  };
}
