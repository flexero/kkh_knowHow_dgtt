/*
 * CAD models (glTF / GLB, e.g. exported from SOLIDWORKS) in the 3D factory view.  Guide: docs/55.
 *
 * A station in config/factory.json gets  "glb": "models/hmc_test.glb".  factory3d.js first builds the
 * simple box machine, then attachGLB() loads the file in the background and swaps it in. If the file is
 * missing or broken, the boxes stay (a warning is written to the browser console).  ?glb=0 turns it off.
 *
 * Moving parts are found by NODE NAME (set them in SOLIDWORKS / Blender, pivot on the joint axis):
 *   Door      slides +X while the machine does not cut   (extras/custom property "travel_m", default 0.9 m)
 *   Spindle   turns about its local Z axis while RUNNING
 *   Table     X axis, Head = Y axis, Column = Z axis      (visual tool path while RUNNING, back home otherwise)
 *   B_axis    rotary table, indexes 90 deg per quarter of the cycle
 *   Workpiece visible when a part is in the machine, scaled per product model
 *   Magazine  tool disc, turns slowly about X while RUNNING
 *   APC_Arm   pallet changer, turns 180 deg about Y at each new part
 *   Andon     empty marker: the twin's light tower is moved to this point
 * Material named "Body" (or starting with "Body"/"Paint") = machine paint -> tinted with the state colour.
 *
 * Real axis values (later, from the PLC / CNC): if a machine snapshot has  axes: {X: 412.5, B: 90, ...}
 * and the station has  "glb_axes": {"X": {"node": "Table", "axis": "x", "sign": 1},
 *                                   "B": {"node": "B_axis", "axis": "y", "sign": 1, "deg": true}}
 * then those nodes follow the real values (mm -> m, deg -> rad) instead of the script.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = {};                      // url -> Promise<THREE.Group>; HMC-01..03 share one download
const NODES = ["Door", "Spindle", "Table", "Head", "Column", "B_axis", "Workpiece", "Magazine", "APC_Arm", "Andon"];
const _v = new THREE.Vector3();
const loaded = {};                     // station id -> st (for the F12 helper below)
// F12 console helper:  twinGLB.list()  -> loaded stations;  twinGLB.pose("HMC-01") -> positions / angles of the moving parts
window.twinGLB = {
  list: () => Object.keys(loaded),
  pose(id) {
    const st = loaded[id]; if (!st) return null;
    const r = (x) => Math.round(x * 1000) / 1000, out = {};
    for (const [n, o] of Object.entries(st.glb.nodes)) out[n] = { pos: o.position.toArray().map(r), rot_deg: [o.rotation.x, o.rotation.y, o.rotation.z].map((a) => r(a * 180 / Math.PI)), visible: o.visible };
    return out;
  },
};

export const glbEnabled = (() => {
  try { return new URLSearchParams(location.search).get("glb") !== "0"; } catch (e) { return true; }
})();

function load(url) {
  if (!cache[url]) cache[url] = new Promise((ok, bad) => loader.load(url, (gltf) => ok(gltf.scene), undefined, bad));
  return cache[url];
}

// k = 1 - e^(-dt/tau): first-order smoothing, the part moves this share of the remaining distance per frame
const follow = (x, target, dt, tau) => x + (target - x) * (1 - Math.exp(-dt / tau));

/**
 * Load st.cfg.glb and replace the box model of station st (from factory3d.js).
 * onDone(st) is called after the swap (e.g. to re-apply the colour mode).
 */
export function attachGLB(st, onDone) {
  const url = st.cfg.glb;
  load(url).then((proto) => {
    const model = proto.clone(true);
    const paint = [];
    model.traverse((o) => {
      o.userData.stationId = st.cfg.id;
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      // own material copy per station, otherwise one red HMC turns all three red
      o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
        if (/^(body|paint)/i.test(m.name || "") && m.emissive) paint.push(m);
      });
    });
    model.updateMatrixWorld(true);
    const nodes = {}, home = {};
    const find = (n) => {                       // exact node name (loader may add _1 for duplicates: userData.name keeps the original)
      let hit = null;
      model.traverse((o) => { if (!hit && (o.name === n || o.userData.name === n)) hit = o; });
      return hit;
    };
    NODES.forEach((n) => {
      const o = find(n);
      if (o) { nodes[n] = o; home[n] = { p: o.position.clone(), r: o.rotation.clone() }; }
    });
    // keep the twin's light tower (andon), remove the boxes
    const g = st.g, lampSet = new Set(st.lamps || []);
    const isAndon = (c) => { let f = false; c.traverse((o) => { if (o.isMesh && lampSet.has(o.material)) f = true; }); return f; };
    [...g.children].forEach((c) => {
      if (isAndon(c)) { if (nodes.Andon) c.position.copy(nodes.Andon.getWorldPosition(_v)); }
      else g.remove(c);
    });
    g.add(model);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    st.labelY = size.y + 0.6;
    st.glb = { model, find, nodes, home, paint, travel: (nodes.Door && +nodes.Door.userData.travel_m) || 0.9,
               phase: 0, lastP: 0, doorX: 0, b: 0 };
    loaded[st.cfg.id] = st;
    console.info(`[glb] ${st.cfg.id}: loaded ${url} - moving parts found: ${Object.keys(nodes).join(", ") || "none"}`);
    if (onDone) onDone(st);
  }).catch((e) => console.warn(`[glb] ${st.cfg.id}: could not load ${url} - keeping the box model.`, e));
}

/** Per-frame animation of a GLB station. m = machine snapshot, size = workpiece scale of the product model. */
export function animGLB(st, t, dt, run, hasPart, progress, m, size) {
  const G = st.glb, N = G.nodes, H = G.home;
  if (N.Workpiece) { N.Workpiece.visible = hasPart; N.Workpiece.scale.setScalar(size || 1); }
  if (run && N.Spindle) N.Spindle.rotation.z = (N.Spindle.rotation.z + dt * 40) % (2 * Math.PI);                    // visual speed, not real rpm
  if (run && N.Magazine) N.Magazine.rotation.x = (N.Magazine.rotation.x + dt * 0.3) % (2 * Math.PI);

  // linear axes: a visual tool path while cutting, back to home otherwise
  const lin = { Table: ["x", run ? Math.sin(t * 0.7) * 0.35 : 0],
                Head: ["y", run ? Math.sin(t * 1.1) * 0.15 : 0],
                Column: ["z", run ? 0.12 + Math.sin(t * 0.5) * 0.08 : 0] };
  for (const n in lin) {
    const o = N[n]; if (!o) continue;
    const [ax, d] = lin[n];
    o.position[ax] = follow(o.position[ax], H[n].p[ax] + d, dt, 0.15);
  }
  // B axis: index 90 degrees per quarter of the cycle
  if (N.B_axis) {
    G.b = follow(G.b, run ? Math.floor(progress * 4) * Math.PI / 2 : 0, dt, 0.2);
    N.B_axis.rotation.y = H.B_axis.r.y + G.b;
  }
  // door: open at part change (start / end of the cycle) and whenever the machine does not cut
  if (N.Door) {
    const open = !run || progress < 0.04 || progress > 0.97;
    G.doorX = follow(G.doorX, open ? G.travel : 0, dt, 0.25);
    N.Door.position.x = H.Door.p.x + G.doorX;
  }
  // pallet changer: 180 degrees in the first 4.5 % of each cycle
  if (N.APC_Arm) {
    if (progress < G.lastP - 0.2) G.phase += Math.PI;                      // a new part started
    G.lastP = progress;
    N.APC_Arm.rotation.y = H.APC_Arm.r.y + G.phase + (run && progress < 0.045 ? (progress / 0.045) * Math.PI : 0);
  }
  // real axis values from the PLC / CNC override the script (mm -> m, deg -> rad)
  const map = st.cfg.glb_axes;
  if (map && m && m.axes) {
    for (const key in map) {
      const a = map[key], o = N[a.node] || G.find(a.node), val = m.axes[key];
      if (!o || typeof val !== "number") continue;
      const h = H[a.node] || (H[a.node] = { p: o.position.clone(), r: o.rotation.clone() });
      const ax = a.axis || "x", sign = a.sign || 1;
      if (a.deg) o.rotation[ax] = follow(o.rotation[ax], h.r[ax] + sign * val * Math.PI / 180, dt, 0.1);
      else o.position[ax] = follow(o.position[ax], h.p[ax] + sign * val / 1000, dt, 0.1);
    }
  }
}
