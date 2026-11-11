/* Mechanical elements tab - item 2: crate docking stand next to the APC load station.
   Castings come in a crate (steel box pallet with nests, Euro footprint) and finished / empty crates go out.
   ONE stand works for both vehicles:
     - underride (latent lifting) AGV: drives under the stand with the crate lifted, lowers it, drives out;
     - forklift: sets the crate down from the front (forks in the crate pockets).
   The AGV (±10 mm) and the forklift driver (±50 mm) are inaccurate: 4 self-centring V-guides at the crate corners
   centre the crate while it is lowered; the crate may shift on the AGV plate (retaining rim with play) or on the
   forks (pocket play).  The operator lifts the castings with a jib crane (casting > 23 kg -> lifting aid).
   Coordinates as item 1: mm, Y up, APC load station centre = origin, APC axis at x = -r.  Offline: Three.js from web/vendor. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, H0 = 1050;
const SX = 750, SZ = -1750;            // stand centre (beside the load station, outside the APC swing circle)
const JX = 150, JZ = -1250;            // jib crane column
const BASE = 130;                      // crate base height (bottom plate 10 + pockets 100 + deck 20)
const JIBS = [63, 80, 125, 250, 500];  // standard jib crane SWL (kg)

const GROUPS = [
  ["Crate (transport carrier)", [
    ["cl", "Crate length", "mm", 1200, "Euro footprint 1200 × 800"],
    ["cw", "Crate width", "mm", 800, ""],
    ["ch", "Crate height (base + walls)", "mm", 600, ""],
    ["cm", "Crate mass, empty", "kg", 75, "steel box pallet with nests"],
    ["np", "Castings per crate", "", 4, "twin: batch 4 = one pallet"],
    ["mc", "Casting mass (crankcase)", "kg", 32, "VC20 example"]]],
  ["Underride AGV", [
    ["hu", "AGV height (lift plate down)", "mm", 300, "latent lifting AGV"],
    ["wu", "AGV width", "mm", 560, ""],
    ["su", "AGV lift stroke", "mm", 150, ""],
    ["vu", "Lift speed", "mm/s", 40, ""],
    ["vs", "Speed under the stand", "m/s", 0.3, "slow zone"],
    ["nav2", "AGV stop accuracy", "± mm", 10, "typ. ±5–10 mm"],
    ["yaw2", "AGV angle accuracy", "± °", 0.5, ""],
    ["rim", "Play of the crate on the AGV plate (rim)", "± mm", 25, "the guides must be able to shift the crate"]]],
  ["Forklift", [
    ["fnav", "Driver placing accuracy", "± mm", 50, "typ. ±30–50 mm"],
    ["vlow", "Lowering speed (worst case)", "m/s", 0.3, "forklift 0.3–0.5 m/s"]]],
  ["Stand", [
    ["gh", "V-guide height", "mm", 100, "straight 40 mm + flare"],
    ["gfl", "V-guide flare per side", "mm", 55, "must catch the forklift error"],
    ["gcl", "Guide clearance per side (seated)", "mm", 5, ""],
    ["mug", "Friction crate ↔ guide strip", "", 0.15, "steel on UHMW-PE"],
    ["pad", "PU pad deflection at impact", "mm", 3, ""],
    ["Nan", "Allowed load per anchor", "kN", 8, "bonded anchor M12/M16"]]],
  ["Jib crane + operator", [
    ["mg", "Gripper mass", "kg", 15, "mechanical gripper in the cylinder bores"],
    ["rj", "Jib radius", "mm", 1600, ""],
    ["ma", "Jib arm mass", "kg", 60, ""],
    ["tj", "Time per casting with the crane", "s", 45, ""],
    ["tcyc2", "Machining time per pallet", "s", 1380, "4 crankcases × 345 s"]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

function apcCtx() {
  const A = window.APC && window.APC.get();
  const P = A ? A.P : { a: 500, b: 500, r: 480, hc: 250 };
  return { a: P.a, b: P.b, r: P.r, hc: P.hc, swing: A && A.R && A.R.swing ? A.R.swing : 2 * P.r + Math.hypot(P.a, P.b) };
}

/* ------------------------------------------------------------------ calculation */
function calc(M, X) {
  const R = { X };
  R.mcr = M.cm + M.np * M.mc; R.W = R.mcr * G;
  R.Hs = M.hu + 20;                                    // rail top = crate bottom when it rests
  R.top = R.Hs + M.ch;
  R.carry = R.Hs + M.gh + 15;                          // crate bottom while it is carried in (above the guides)
  R.sReq = R.carry - M.hu;
  R.zLeg = M.cw / 2 - 40; R.xLeg = M.cl / 2 - 40;      // legs under the rail ends
  R.clearW = M.cw - 160;                               // clear width between the legs
  R.cap2 = M.nav2 + M.cl / 2 * Math.sin(M.yaw2 * Math.PI / 180);
  R.needW = M.wu + 2 * (R.cap2 + 15);
  R.flareH = M.gh - 40;
  R.theta = Math.atan2(R.flareH, M.gfl) * 180 / Math.PI;      // guide face angle from horizontal
  R.phi = Math.atan(M.mug) * 180 / Math.PI;
  R.Fcen = R.W * Math.tan((R.theta - R.phi) * Math.PI / 180);  // sideways push when the crate weight is on the guides
  R.Eimp = 0.5 * R.mcr * M.vlow * M.vlow;
  R.Fimp = 2 * R.Eimp / (M.pad / 1000);                        // total peak force on the 4 pads
  R.Frail = (R.W + R.Fimp) / 2; R.Lr = M.cl - 80;
  const I = (50 * 100 ** 3 - 42 * 92 ** 3) / 12, Wb = I / 50;   // rail tube 100×50×4
  R.Mr = R.Frail * R.Lr / 8; R.sigR = R.Mr / Wb; R.defR = 5 * R.Frail * R.Lr ** 3 / (384 * 210000 * I);
  R.Fleg = (R.W + R.Fimp) / 4; R.Fanc = R.Fleg / 2;
  R.grip = R.Hs + BASE + 150;                                  // grip height of a casting in the crate
  R.lift = M.mc + M.mg; R.swl = JIBS.find((x) => x >= R.lift * 1.2) || 500;
  R.Mj = (R.swl * 1.25 * G * M.rj + M.ma * G * M.rj / 2) / 1000;                // N·m at the column foot
  const D = 168.3, d = 155.7, Wc = Math.PI * (D ** 4 - d ** 4) / (32 * D);       // column tube 168.3 × 6.3
  R.sigC = R.Mj * 1000 / Wc;
  R.Tb = 4 * R.Mj / (8 * 0.4);                                                   // 8 anchors on Ø400
  R.reachCrate = Math.hypot(SX - JX, SZ - JZ); R.reachFix = Math.hypot(JX, JZ);
  R.tload = M.np * M.tj;
  R.standClr = Math.hypot(SX - M.cl / 2 + X.r, -SZ - M.cw / 2) - X.swing / 2;    // nearest stand corner to the APC axis
  R.tol = [
    ["AGV stop accuracy", M.nav2, "caught by the V-guide flare"],
    [`AGV angle ±${M.yaw2}° over half the crate`, M.cl / 2 * Math.sin(M.yaw2 * Math.PI / 180), ""],
    ["Forklift driver", M.fnav, "caught by the V-guide flare"],
    ["Crate seated in the guides", M.gcl, "guide clearance – the crane operator does the rest"]];
  return R;
}

function steps(R, M, veh, task) {
  const del = task === "deliver", fk = veh === "fork";
  const tIn = 2400 / (M.vs * 1000), tLow = (R.carry - M.hu) / M.vu;
  const pick = ["pick", `Operator loads the ${M.np} castings onto the fixture with the jib crane (1 shown, fast)`, 9];
  if (fk) return del
    ? [["in", `Forklift brings the full crate, forks in the pockets, crate above the guides (driver ±${M.fnav} mm)`, 6],
       ["lower", "Driver lowers: the V-guides centre the crate – it shifts on the forks inside the pockets", 3],
       ["out", "Crate on the rails (sensor B1 + B2), forks free in the pockets, forklift reverses", 5], pick]
    : [["in", "Forklift drives the forks into the crate pockets (forks low)", 6],
       ["lower", "Driver lifts: the crate leaves the guides", 3], ["out", "Forklift reverses with the empty crate", 5]];
  return del
    ? [["in", `Underride AGV drives in under the stand, crate lifted above the guides (±${M.nav2} mm, ±${M.yaw2}°)`, tIn],
       ["lower", "AGV lowers: the crate corners slide down the V-guides – the crate is centred", tLow],
       ["out", "Crate rests on the rails (B1 + B2), AGV plate free below, AGV drives out", tIn], pick]
    : [["in", "Underride AGV drives in under the empty crate (lift plate down)", tIn],
       ["lower", "AGV lifts: the crate leaves the guides", tLow], ["out", "AGV drives out with the empty crate", tIn]];
}

const ease = (u) => u * u * (3 - 2 * u);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function stateAt(t, ST, R, M, veh, task) {
  let k = 0, t0 = 0;
  while (k < ST.length - 1 && t >= t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = clamp((t - t0) / ST[k][2], 0, 1), key = ST[k][0], del = task === "deliver", fk = veh === "fork";
  const err = fk ? M.fnav : M.nav2;
  const ex = -0.5 * err, ez = 0.8 * err, ey = fk ? 0.012 : M.yaw2 * Math.PI / 180;
  const s = { k, u, t, vx: SX + ex, vz: SZ + ez, vyaw: ey, plate: M.hu, cx: SX, cz: SZ, cyaw: 0, cy: R.Hs, onV: false, jib: null, c: 1 };
  const far = 2400;
  const lowY = fk ? R.Hs - 40 : M.hu;                 // vehicle height when the crate is free (AGV plate / crate bottom of forks)
  if (key === "in") { const e = ease(u); s.vx = SX + ex + far * (1 - e); s.vyaw = ey * e; s.plate = del ? R.carry : lowY; }
  else if (key === "lower") s.plate = del ? R.carry - (R.carry - lowY) * ease(u) : lowY + (R.carry - lowY) * ease(u);
  else if (key === "out") { const e = ease(u); s.vx = SX + ex + far * e; s.plate = del ? lowY : R.carry; }
  else if (key === "pick") { s.vx = SX + far + 2000; s.plate = lowY; }
  // crate
  const onVehicle = (del && (key === "in" || key === "lower")) || (!del && (key === "lower" || key === "out"));
  if (del) {
    if (key === "in" || key === "lower") {
      s.cy = Math.max(R.Hs, s.plate);
      s.c = clamp((R.Hs + M.gh - s.cy) / R.flareH, 0, 1);         // 0 = still where the vehicle put it, 1 = centred by the guides
      s.cx = SX + (s.vx - SX) * (1 - s.c); s.cz = SZ + (s.vz - SZ) * (1 - s.c); s.cyaw = s.vyaw * (1 - s.c); s.onV = s.cy > R.Hs + 0.5;
    }
  } else {
    if (key === "lower") s.cy = Math.max(R.Hs, s.plate);
    else if (key === "out") { s.cy = R.carry; s.cx = SX + (s.vx - (SX + ex)); s.onV = true; }
    else if (key === "in") s.cy = R.Hs;
  }
  s.onVehicle = onVehicle; s.empty = !del;
  if (key === "pick") s.jib = u;
  return s;
}

/* ------------------------------------------------------------------ part info */
function partInfo(key, R, M) {
  const I = {
    stand: ["Crate stand (pick-up / drop station)", "MAKE", "S355 tube: legs 80×80×5, rails 100×50×4, base plates 15 mm",
      "Holds the crate at a fixed place beside the load station. Open below and at the front: the underride AGV drives under it, the forklift sets the crate on it.",
      `Rails at ${R.Hs} mm (= AGV height + 20), clear width between the legs ${R.clearW} mm, rail length ${M.cl} mm. Rail stress ${f(R.sigR, 0)} N/mm², deflection ${f(R.defR, 2)} mm.`,
      "No cross members low down (AGV path). Weld the 2 side frames in a jig, then join them with the top end beams; anchor every leg with 2 bonded anchors."],
    vguide: ["Self-centring V-guide (corner)", "MAKE", "S355 angle 8 mm + UHMW-PE strip 10 mm, screwed",
      "Catches the crate corner while it is lowered and slides it into position – the crate weight itself does the centring.",
      `Height ${M.gh} mm: flare ${M.gfl} mm per side over ${R.flareH} mm (${f(R.theta, 0)}° from horizontal; friction angle ${f(R.phi, 0)}°), then straight 40 mm with ${M.gcl} mm clearance.`,
      "4 pieces, one on each corner, catching x and z. Slotted holes for setting ±5 mm; the guide strips are wear parts."],
    pad: ["PU support pad", "BUY", "PU 90 Shore A, 100 × 80 × 20", "The crate lands on these pads: no steel-on-steel impact, less noise.",
      `4 pads, peak ${f(R.Fimp / 4000, 2)} kN each if the forklift lowers at ${M.vlow} m/s.`, "Countersunk screws, replaceable."],
    anchor: ["Floor anchor + base plate", "BUY", "bonded anchor M12/M16 8.8, base plate 150 × 150 × 15", "Fixes the stand legs.", `${f(R.Fanc / 1000, 2)} kN per anchor (allowed ${M.Nan} kN).`, "Level the rails to ±1 mm with shims, grout."],
    bollard: ["Bollard (forklift protection)", "BUY", "steel tube Ø114, filled with concrete, yellow/black", "Protects the stand legs from forklift impact.", "2 pieces beside the entry, outside the vehicle path.", "Anchor with 4 × M16."],
    sensor: ["Crate sensors B1 / B2 + RFID", "BUY", "diffuse sensor + inductive sensor + RFID reader", "B1 crate present, B2 crate seated in the guides (down). RFID reads the crate number for the MES.", "", "Mount B2 at the bottom of a guide so it switches only when the crate is fully down."],
    crate: ["Crate (steel box pallet with nests)", "MAKE", "S235 welded, base with 2 fork tunnels, mesh walls",
      "Carries the castings from the AS/RS to the cell and the finished parts away. Same crate for AGV and forklift.",
      `${M.cl} × ${M.cw} × ${M.ch} mm, ${M.cm} kg empty, ${f(R.mcr, 0)} kg full. Base ${BASE} mm: closed bottom plate (AGV plate + rails), 2 fork tunnels 220 × 100 mm at z = ±200 mm.`,
      "Bottom corners square ±2 mm (they run in the guides). Number plate + RFID tag. Stackable corner cones."],
    nest: ["Nest (dunnage) for one casting", "MAKE", "PE-HD or wood with PU lining", "Holds each casting in a defined position, so the crane gripper finds it.", `${M.np} nests per crate.`, "Same position for all crates ±5 mm."],
    casting: ["Crankcase casting", "", "GG25", "Raw part for the HMC.", `${M.mc} kg – more than 23 kg (EN 1005-2 / NIOSH), so the operator must use a lifting aid.`, ""],
    uagv: ["Underride (latent lifting) AGV", "BUY (AGV supplier)", "low AGV with lift plate",
      "Drives under the crate stand, lifts the crate, carries it. It is the AGV type in the twin for castings and crates.",
      `${M.wu} mm wide, ${M.hu} mm high, stroke ${M.su} mm (needed ${f(R.sReq, 0)}), ±${M.nav2} mm / ±${M.yaw2}°.`,
      "Must fit between the legs with the stop error on both sides."],
    uplate: ["AGV lift plate with retaining rim", "BUY / MAKE", "steel plate + UHMW-PE top + rim",
      "Carries the crate. NO locating pins: the rim leaves ±" + M.rim + " mm play, so the V-guides can shift the crate when it is lowered.",
      `Play ±${M.rim} mm ≥ AGV error ±${f(R.cap2, 1)} mm.`, "Low-friction top (UHMW-PE) helps the crate slide."],
    fork: ["Forklift", "(existing)", "counterbalance forklift", "Alternative to the AGV, e.g. for the foundry delivery.", `Driver accuracy ±${M.fnav} mm – the guide flare ${M.gfl} mm catches it. Forks in the crate tunnels have ±60 mm play.`, "Bollards protect the stand."],
    jib: ["Column jib crane", "BUY", "column 168.3 × 6.3, slewing arm, 270°",
      "The operator lifts each casting from the crate onto the fixture with it – no manual lifting.",
      `SWL ${R.swl} kg (load ${R.lift} kg × 1.2), radius ${M.rj} mm. Foot moment ${f(R.Mj / 1000, 2)} kN·m, column stress ${f(R.sigC, 0)} N/mm², anchor ${f(R.Tb / 1000, 1)} kN each (8 on Ø400).`,
      "Foundation block or bonded anchors as per supplier; the floor must take the moment."],
    hoist: ["Chain hoist / balancer", "BUY", "electric chain hoist 2-speed or pneumatic balancer", "Lifts the gripper with the casting; a balancer makes the part 'weightless'.", `≥ ${R.swl} kg.`, ""],
    gripper: ["Casting gripper", "MAKE", "expanding mandrel into the cylinder bores + handle", "Grips the crankcase safely in a fixed position.", `${M.mg} kg.`, "Mechanical self-locking, cannot open under load."],
    station: ["APC load station (item 1)", "", "", "The fixture pallet at the load station – the castings go here.", "", ""],
    operator: ["Operator place", "", "", "Stands between the crate and the load station, outside the APC swing circle.", `Grip height in the crate ≈ ${f(R.grip, 0)} mm.`, "Anti-fatigue mat, light curtain of the load station."],
  };
  return I[key];
}

/* ------------------------------------------------------------------ 3D */
function create3D(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 10, 40000), controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3000, 5000, 3500); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3000, 2000, -2500); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed");
  let O = {}, labels = [], selBox = null, onPick = null;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !o.op });
  const C = { frame: mat(0x3c6e9e), pe: mat(0xf4f4f0, { m: 0, r: 0.8 }), pu: mat(0xd9832b, { m: 0, r: 0.7 }), dark: mat(0x3a4048), black: mat(0x23262a), yellow: mat(0xf2c200),
    crate: mat(0x6f7d58, { m: 0.3, r: 0.6 }), mesh: mat(0x6f7d58, { op: 0.35, ds: true }), nest: mat(0x8a6a45, { m: 0, r: 0.9 }), cast: mat(0x67717b, { m: 0.2, r: 0.8 }),
    agv: mat(0xe8e6df, { m: 0.15, r: 0.6 }), agvDark: mat(0x4a5560), fork: mat(0xe0a020, { m: 0.2, r: 0.6 }), steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }),
    floor: mat(0xd8d6cf, { m: 0, r: 0.95 }), ground: mat(0xc9d0d6, { m: 0.65, r: 0.28 }), wall: mat(0xb9c2ca, { op: 0.22, ds: true }), red: mat(0xd03b3b), skin: mat(0xd9a77a, { m: 0, r: 0.8 }), blue: mat(0x2a78d6, { m: 0, r: 0.8 }) };
  const box = (w, h, d, m, x, y, z, part, parent) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  const cyl = (r, h, m, x, y, z, part, parent, axis = "y", seg = 24, r2) => {
    const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg); if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me;
  };
  function label(text, anchor, off = [0, 0, 0], parent = root) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "600 30px system-ui, sans-serif";
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 46;
    g.font = "600 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.93)"; g.strokeStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.roundRect(1, 1, w - 2, 44, 10); g.fill(); g.stroke(); g.fillStyle = "#1b1f24"; g.fillText(text, 12, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
    const pos = [anchor[0] + off[0], anchor[1] + off[1], anchor[2] + off[2]];
    sp.scale.set(0.032 * w / 46, 0.032, 1); sp.position.set(...pos); sp.renderOrder = 20; parent.add(sp); labels.push(sp);
    if (off.some((v) => v)) {
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor), new THREE.Vector3(...pos)]), new THREE.LineBasicMaterial({ color: 0x30363d, depthTest: false, transparent: true, opacity: 0.8 }));
      ln.renderOrder = 19; parent.add(ln); labels.push(ln);
    }
  }
  function casting(parent, x, y, z) {   // simplified crankcase: block + 2 cylinder bosses (V)
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    box(300, 200, 260, C.cast, 0, 100, 0, "casting", g);
    for (const s of [1, -1]) { const b = cyl(70, 140, C.cast, s * 80, 230, 0, "casting", g); b.rotation.z = s * 0.6; }
    return g;
  }

  function build(R, M, X) {
    while (root.children.length) { const o = root.children.pop(); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map) c.material.map.dispose(); }); }
    labels = []; O = { R, M }; if (selBox) { scene.remove(selBox); selBox = null; }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(9000, 7000), C.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(800, 0, -900); root.add(fl);
    for (const sz of [1, -1]) box(3200, 2, 50, C.yellow, SX + 1500, 1, SZ + sz * (M.cw / 2 + 200), null, root);
    // ---- APC load station context (item 1)
    const a = X.a, b = X.b;
    box(a - 40, H0 - 30, b - 40, C.frame, 0, (H0 - 30) / 2, 0, "station", root);
    box(a, 70, b, C.ground, 0, H0 + 35, 0, "station", root);
    const th = Math.min(700, Math.max(300, X.hc * 2.2)), tw = Math.min(a, b) * 0.6;
    box(tw * 0.55, th, tw, C.cast, 0, H0 + 70 + th / 2, 0, "station", root);
    O.fixTarget = new THREE.Vector3(0, H0 + 70 + th * 0.27, -tw * 0.5 - 140);
    box(14, 950, X.swing - 40, C.wall, -X.r, H0 + 470, 0, "station", root);
    label("APC load station (item 1)", [0, H0 + 70 + th, 0], [-300, 250, 300]);
    // ---- stand
    const S = new THREE.Group(); S.position.set(SX, 0, SZ); root.add(S);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      box(80, R.Hs - 50, 80, C.frame, sx * R.xLeg, (R.Hs - 50) / 2, sz * R.zLeg, "stand", S);
      box(150, 15, 150, C.dark, sx * R.xLeg, 7.5, sz * R.zLeg, "anchor", S);
    }
    for (const sz of [1, -1]) {
      box(M.cl, 50, 100, C.frame, 0, R.Hs - 25 - 20, sz * R.zLeg, "stand", S);          // rail (tube lying flat, 100 wide)
      for (const sx of [1, -1]) box(100, 20, 80, C.pu, sx * (M.cl / 2 - 120), R.Hs - 10, sz * R.zLeg, "pad", S);
    }
    // 4 corner V-guides (L-shaped, flared top)
    const cg = M.gcl;
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const gx = sx * (M.cl / 2 + cg), gz = sz * (M.cw / 2 + cg);
      box(8, 40, 160, C.frame, gx + sx * 4, R.Hs + 20, gz - sz * 72, "vguide", S);
      box(160, 40, 8, C.frame, gx - sx * 72, R.Hs + 20, gz + sz * 4, "vguide", S);
      const fx = box(8, Math.hypot(R.flareH, M.gfl), 160, C.pe, gx + sx * (4 + M.gfl / 2), R.Hs + 40 + R.flareH / 2, gz - sz * 72, "vguide", S); fx.rotation.z = -sx * Math.atan2(M.gfl, R.flareH);
      const fz = box(160, Math.hypot(R.flareH, M.gfl), 8, C.pe, gx - sx * 72, R.Hs + 40 + R.flareH / 2, gz + sz * (4 + M.gfl / 2), "vguide", S); fz.rotation.x = sz * Math.atan2(M.gfl, R.flareH);
      box(40, R.Hs, 40, C.frame, gx + sx * 20, R.Hs / 2, gz + sz * 20, "stand", S);
    }
    box(30, 30, 40, C.black, -M.cl / 2 - 30, R.Hs + 10, 0, "sensor", S);
    for (const sz of [1, -1]) { cyl(57, 1100, C.yellow, M.cl / 2 + 150, 550, sz * (R.zLeg + 260), "bollard", S, "y", 20); }
    label("Self-centring V-guides (4 corners)", [M.cl / 2 + cg, R.Hs + M.gh, M.cw / 2 + cg], [450, 520, 600], S);
    label("Crate stand (open for AGV + forklift)", [-R.xLeg, R.Hs / 2, R.zLeg], [-600, 350, 700], S);
    label("Bollards", [M.cl / 2 + 150, 1100, R.zLeg + 260], [300, 200, 300], S);
    // ---- crate (origin = bottom centre)
    const CR = new THREE.Group(); root.add(CR); O.crate = CR;
    box(M.cl, 10, M.cw, C.crate, 0, 5, 0, "crate", CR);
    box(M.cl, 20, M.cw, C.crate, 0, BASE - 10, 0, "crate", CR);
    for (const zz of [-M.cw / 2 + 40, 0, M.cw / 2 - 40]) box(M.cl, 100, 60, C.crate, 0, 60, zz, "crate", CR);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(50, M.ch, 50, C.crate, sx * (M.cl / 2 - 25), M.ch / 2, sz * (M.cw / 2 - 25), "crate", CR);
    for (const sz of [1, -1]) box(M.cl - 50, M.ch - BASE, 4, C.mesh, 0, BASE + (M.ch - BASE) / 2, sz * (M.cw / 2 - 2), "crate", CR);
    for (const sx of [1, -1]) box(4, M.ch - BASE, M.cw - 50, C.mesh, sx * (M.cl / 2 - 2), BASE + (M.ch - BASE) / 2, 0, "crate", CR);
    O.casts = [];
    const n = Math.max(1, Math.round(M.np)), cols = Math.ceil(n / 2);
    for (let i = 0; i < n; i++) {
      const cx = (cols === 1 ? 0 : -M.cl / 2 + M.cl / cols * ((i % cols) + 0.5)), cz = n === 1 ? 0 : (Math.floor(i / cols) ? 1 : -1) * M.cw / 4;
      box(330, 40, 290, C.nest, cx, BASE + 20, cz, "nest", CR);
      O.casts.push({ g: casting(CR, cx, BASE + 40, cz), home: new THREE.Vector3(cx, BASE + 40, cz) });
    }
    label("Crate with castings", [0, M.ch, 0], [0, 260, 0], CR);
    // ---- underride AGV (origin = centre on the floor)
    const AG = new THREE.Group(); root.add(AG); O.agv = AG;
    const lu = M.cl - 150;
    box(lu, M.hu - 60, M.wu, C.agv, 0, 30 + (M.hu - 60) / 2, 0, "uagv", AG);
    for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(45, 40, C.black, sx * (lu / 2 - 120), 45, sz * (M.wu / 2 - 50), "uagv", AG, "z", 18);
    cyl(22, 30, C.yellow, lu / 2 - 40, M.hu - 45, M.wu / 2 - 40, "uagv", AG);
    const PL = new THREE.Group(); AG.add(PL); O.plate = PL;             // lift plate, y = plate top
    box(lu - 100, 16, M.wu - 60, C.agvDark, 0, -12, 0, "uplate", PL);
    box(lu - 100, 4, M.wu - 60, C.pe, 0, -2, 0, "uplate", PL);
    for (const sx of [1, -1]) box(12, 30, M.wu - 60, C.dark, sx * (M.cl / 2 + M.rim + 6), 5, 0, "uplate", PL);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(60, 400, 60, C.steel, sx * 300, -210, sz * 150, "uagv", PL);
    label("Underride AGV", [lu / 2, M.hu, M.wu / 2], [400, 400, 500], AG);
    // ---- forklift (origin = fork heel, forks point to -x)
    const FK = new THREE.Group(); root.add(FK); O.fork = FK;
    box(1300, 900, 1000, C.fork, 120 + 650 + 200, 600, 0, "fork", FK);
    box(1000, 60, 1000, C.dark, 970, 2150, 0, "fork", FK);
    for (const sz of [1, -1]) { box(60, 2100, 60, C.dark, 900, 1100, sz * 470, "fork", FK); box(60, 2100, 60, C.dark, 1450, 1100, sz * 470, "fork", FK);
      cyl(230, 180, C.black, 400, 230, sz * 420, "fork", FK, "z"); cyl(200, 180, C.black, 1600, 200, sz * 420, "fork", FK, "z"); }
    for (const sz of [1, -1]) box(80, 2400, 80, C.dark, 80, 1200, sz * 380, "fork", FK);
    const CA = new THREE.Group(); FK.add(CA); O.carr = CA;           // carriage, y = crate bottom
    box(60, 500, 900, C.dark, 40, 250, 0, "fork", CA);
    for (const sz of [1, -1]) { box(1150, 45, 100, C.steel, -575, 65 + 22, sz * 200, "fork", CA); box(45, 600, 100, C.steel, 12, 300, sz * 200, "fork", CA); }
    label("Forklift", [970, 2150, 500], [300, 250, 300], FK);
    // ---- jib crane + operator
    cyl(84, 2900, C.yellow, JX, 1450, JZ, "jib", root);
    box(400, 30, 400, C.dark, JX, 15, JZ, "jib", root);
    const JB = new THREE.Group(); JB.position.set(JX, 2800, JZ); root.add(JB); O.jib = JB;
    box(M.rj + 150, 160, 90, C.yellow, (M.rj + 150) / 2, 0, 0, "jib", JB);
    box(300, 60, 60, C.yellow, 150, -150, 0, "jib", JB).rotation.z = 0.5;
    const TR = new THREE.Group(); JB.add(TR); O.trolley = TR;
    box(180, 120, 160, C.dark, 0, -140, 0, "hoist", TR);
    const chain = box(10, 1, 10, C.black, 0, -200, 0, "hoist", TR); O.chain = chain;
    const HK = new THREE.Group(); root.add(HK); O.hook = HK;
    box(80, 120, 80, C.red, 0, 60, 0, "gripper", HK); cyl(30, 140, C.steel, 0, -10, 0, "gripper", HK); box(260, 20, 40, C.dark, 0, 130, 0, "gripper", HK);
    label("Jib crane (castings > 23 kg)", [JX, 2880, JZ], [-300, 250, -300]);
    const OP = new THREE.Group(); OP.position.set(380, 0, -1000); root.add(OP);
    cyl(170, 1050, C.blue, 0, 525, 0, "operator", OP, "y", 16, 150); cyl(110, 260, C.blue, 0, 1180, 0, "operator", OP, "y", 16); const hd = new THREE.Mesh(new THREE.SphereGeometry(110, 16, 12), C.skin); hd.position.y = 1450; hd.userData.part = "operator"; OP.add(hd);
    fit("overview");
  }

  const VIEWS = {
    overview: () => [[3900, 2700, -250], [450, 650, -1250]],
    stand: () => [[SX + 700, 1150, SZ - 2000], [SX + 100, 420, SZ]],
    jib: () => [[-1400, 2600, -3200], [300, 1200, -1000]],
    side: () => [[SX, 700, SZ + 3600], [SX, 600, SZ]],
  };
  function fit(v) { const [p, t] = VIEWS[v](); nice.stop(); camera.position.set(...p); controls.target.set(...t); controls.update(); }
  function update(s, veh) {
    if (!O.crate) return;
    const R = O.R, M = O.M, fk = veh === "fork";
    O.agv.visible = !fk; O.fork.visible = fk;
    if (fk) { O.fork.position.set(s.vx + M.cl / 2 + 30, 0, s.vz); O.fork.rotation.y = s.vyaw; O.carr.position.y = s.plate; }
    else { O.agv.position.set(s.vx, 0, s.vz); O.agv.rotation.y = s.vyaw; O.plate.position.y = s.plate; }
    O.crate.position.set(s.cx, s.cy, s.cz); O.crate.rotation.y = s.cyaw;
    O.casts.forEach((c) => { c.g.visible = !s.empty; });
    // jib: park position over the crate edge; in the pick step one casting travels to the fixture
    const c0 = O.casts[0], crTop = R.Hs + M.ch + 150;
    const P1 = new THREE.Vector3(SX + c0.home.x, R.Hs + BASE + 40 + 300, SZ + c0.home.z), P2 = O.fixTarget.clone().setY(O.fixTarget.y + 300);
    let hp = new THREE.Vector3(SX + c0.home.x, crTop + 400, SZ + c0.home.z), carry = false;
    if (s.jib != null) {
      const u = s.jib, top = Math.max(crTop, P2.y) + 250;
      const lerp = (a, b, t) => a.clone().lerp(b, t);
      if (u < 0.15) hp = lerp(new THREE.Vector3(P1.x, top, P1.z), P1, ease(u / 0.15));
      else if (u < 0.3) { hp = lerp(P1, new THREE.Vector3(P1.x, top, P1.z), ease((u - 0.15) / 0.15)); carry = true; }
      else if (u < 0.75) { // swing on the jib circle
        const a1 = Math.atan2(P1.z - JZ, P1.x - JX), a2 = Math.atan2(P2.z - JZ, P2.x - JX), r1 = Math.hypot(P1.x - JX, P1.z - JZ), r2 = Math.hypot(P2.x - JX, P2.z - JZ);
        const e = ease((u - 0.3) / 0.45), an = a1 + (a2 - a1) * e, rr = r1 + (r2 - r1) * e;
        hp = new THREE.Vector3(JX + rr * Math.cos(an), top, JZ + rr * Math.sin(an)); carry = true;
      } else if (u < 0.92) { hp = lerp(new THREE.Vector3(P2.x, top, P2.z), P2, ease((u - 0.75) / 0.17)); carry = true; }
      else { hp = P2.clone(); carry = u < 0.96; }
      if (u >= 0.96) { hp = P2.clone(); hp.y += 120 * (u - 0.96) / 0.04; }
    }
    const ang = Math.atan2(hp.z - JZ, hp.x - JX), rho = Math.hypot(hp.x - JX, hp.z - JZ);
    O.jib.rotation.y = -ang; O.trolley.position.x = rho;
    const len = Math.max(20, 2800 - 200 - (hp.y + 130));
    O.chain.scale.y = len; O.chain.position.y = -200 - len / 2;
    O.hook.position.copy(hp);
    // the first casting: in the crate, on the hook, or on the fixture
    const done = s.jib != null && s.jib >= 0.92;
    if (carry) { root.attach(c0.g); c0.g.position.set(hp.x, hp.y - 300, hp.z); c0.g.rotation.set(0, 0, 0); }
    else if (done) { root.attach(c0.g); c0.g.position.set(P2.x, P2.y - 300, P2.z); c0.g.rotation.set(0, 0, 0); }
    else { O.crate.attach(c0.g); c0.g.position.copy(c0.home); c0.g.rotation.set(0, 0, 0); }
  }
  function frame() { if (selBox) selBox.update(); controls.update(); renderer.render(scene, camera); }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const vis = (o) => { while (o) { if (!o.visible) return false; o = o.parent; } return true; };
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part && vis(h.object));
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    selBox = new THREE.BoxHelper(hit.object, 0xff2a2a); scene.add(selBox); if (onPick) onPick(hit.object.userData.part);
  });
  return { build, update, fit, frame, canvas: renderer.domElement,
    setLabels(on) { labels.forEach((l) => { l.visible = on; }); }, onPick(fn) { onPick = fn; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
}

/* ------------------------------------------------------------------ 2D: self-centring in a guide (section), interface drawings */
function guideSVG(R, M, s, veh) {
  const W = 760, Hh = 360, sc = 1.0, gx = 560, gy = 330;          // section through one long side of the stand (looking along x)
  const X = (z) => gx + z * sc, Y = (y) => gy - (y - R.Hs) * sc;
  const offs = ((s.cz - SZ)), cyrel = s.cy;
  let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Crate corner sliding into a V-guide">`;
  // rail + pad + guide (corner at z = cw/2 + clearance)
  const zG = M.gcl;                                                // guide inner face relative to the seated crate side
  g += `<rect x="${X(-200)}" y="${Y(R.Hs)}" width="${180 * sc}" height="${30 * sc}" class="mx-st"/>`;
  g += `<rect x="${X(-160)}" y="${Y(R.Hs) - 6}" width="${70 * sc}" height="6" class="mx-pu"/>`;
  g += `<path d="M${X(zG)},${Y(R.Hs)} V${Y(R.Hs + 40)} L${X(zG + M.gfl)},${Y(R.Hs + M.gh)} H${X(zG + M.gfl + 14)} L${X(zG + 14)},${Y(R.Hs + 40)} V${Y(R.Hs)} z" class="mx-st"/>`;
  g += `<path d="M${X(zG)},${Y(R.Hs + 40)} L${X(zG + M.gfl)},${Y(R.Hs + M.gh)}" class="mx-face" style="stroke:#9aa4ae;stroke-width:5"/>`;
  // crate side wall + base (moves): its outer face at z = offs (0 = seated against nothing, clearance gcl)
  const cz = offs, by = cyrel;
  g += `<rect x="${X(cz - 260)}" y="${Y(by + BASE)}" width="${260 * sc}" height="${BASE * sc}" class="mx-crate"/>`;
  g += `<rect x="${X(cz - 30)}" y="${Y(by + 210)}" width="${30 * sc}" height="${(210 - BASE) * sc}" class="mx-crate"/>`;
  // vehicle support under the crate (AGV plate or fork) when it still carries
  if (s.onVehicle && by > R.Hs + 0.5) g += `<rect x="${X(cz - 240)}" y="${Y(by)}" width="${150 * sc}" height="${12 * sc}" class="mx-agvd"/>`;
  const T = (x, y, t, a = "") => `<text x="${x}" y="${y}" class="apc-t ${a}">${t}</text>`;
  g += T(X(zG + M.gfl + 20), Y(R.Hs + M.gh) + 4, `flare ${M.gfl} mm, ${f(R.theta, 0)}°`);
  g += T(X(zG + 22), Y(R.Hs + 20) + 4, `straight 40 mm, clearance ${M.gcl}`);
  g += T(X(-190), Y(R.Hs) + 46, "rail + PU pad");
  g += T(X(cz - 130), Y(by + BASE) - 8, "crate base", "c");
  g += `<text x="16" y="24" class="apc-t" style="font-size:13px;font-weight:600">crate offset ${f(offs, 1)} mm · height above the rails ${f(by - R.Hs, 0)} mm</text>`;
  g += T(16, 44, `Weight on the ${f(R.theta, 0)}° face pushes the crate sideways: F = W·tan(θ − φ) = ${f(R.Fcen, 0)} N (φ = friction angle ${f(R.phi, 0)}°)`);
  g += T(16, 62, veh === "fork" ? "The crate shifts on the forks (tunnel play ±60 mm)." : `The crate shifts on the AGV plate (rim play ±${M.rim} mm, UHMW-PE top).`);
  return g + `</svg>`;
}
function planSVG(R, M, X) {
  const W = 760, Hh = 470, x0 = -X.r - 900, x1 = SX + 3000, z0 = SZ - 900, z1 = 900, sc = Math.min((W - 30) / (x1 - x0), (Hh - 30) / (z1 - z0));
  const PX = (x) => 15 + (x - x0) * sc, PZ = (z) => 15 + (z - z0) * sc;
  const rect = (xa, za, xb, zb, cls, ex = "") => `<rect x="${PX(Math.min(xa, xb))}" y="${PZ(Math.min(za, zb))}" width="${Math.abs(xb - xa) * sc}" height="${Math.abs(zb - za) * sc}" class="${cls}" ${ex}/>`;
  let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Plan view of the crate stand at the cell">`;
  g += `<circle cx="${PX(-X.r)}" cy="${PZ(0)}" r="${X.swing / 2 * sc}" class="mx-swing"/>`;
  g += rect(-X.a / 2, -X.b / 2, X.a / 2, X.b / 2, "mx-pal");
  g += `<text x="${PX(0)}" y="${PZ(X.b / 2) + 14}" class="apc-t c">APC load station</text>`;
  g += rect(X.a / 2 + 85, -X.b / 2 - 110, X.a / 2 + 1500, X.b / 2 + 110, "mx-ghost");
  g += `<text x="${PX(X.a / 2 + 800)}" y="${PZ(X.b / 2 + 110) + 14}" class="apc-t c">pallet AGV lane (item 1)</text>`;
  g += rect(SX - M.cl / 2 - M.gcl, SZ - M.cw / 2 - M.gcl, SX + M.cl / 2 + M.gcl, SZ + M.cw / 2 + M.gcl, "mx-crate");
  for (const sx of [1, -1]) for (const sz of [1, -1]) g += rect(SX + sx * R.xLeg - 40, SZ + sz * R.zLeg - 40, SX + sx * R.xLeg + 40, SZ + sz * R.zLeg + 40, "mx-st");
  g += rect(SX - M.cl / 2 + 75, SZ - M.wu / 2, SX + 2500, SZ + M.wu / 2, "mx-ghost");
  g += `<text x="${PX(SX + 1800)}" y="${PZ(SZ) + 4}" class="apc-t c">AGV / forklift lane →</text>`;
  g += `<circle cx="${PX(JX)}" cy="${PZ(JZ)}" r="${M.rj * sc}" class="mx-swing" style="stroke:#c98a0c"/><circle cx="${PX(JX)}" cy="${PZ(JZ)}" r="5" class="mx-cog"/>`;
  g += `<text x="${PX(JX) - 8}" y="${PZ(JZ) + 16}" class="apc-t r">jib crane (R ${M.rj})</text>`;
  g += `<circle cx="${PX(380)}" cy="${PZ(-1000)}" r="${170 * sc}" fill="#2a78d6" opacity=".6"/><text x="${PX(380) + 14}" y="${PZ(-1000) + 4}" class="apc-t">operator</text>`;
  g += `<text x="${PX(SX)}" y="${PZ(SZ - M.cw / 2) - 6}" class="apc-t c">crate stand ${M.cl} × ${M.cw}</text>`;
  g += `<text x="${PX(-X.r)}" y="${PZ(-X.swing / 2) - 4}" class="apc-t c">APC swing circle</text>`;
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const box2 = $("mxItem2");
if (box2) {
  box2.innerHTML = `
    <div class="kpis" id="cxKpis"></div>
    <div class="card">
      <div class="card-head"><h2>3D – crate stand, AGV / forklift, jib crane</h2><span class="sub">drag = turn · right-drag = move · wheel = zoom at the mouse · double-click = new turning point · click a part for its data</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="cxPlay">▶ Play</button>
        <input type="range" id="cxScrub" min="0" max="1000" value="0" aria-label="Time"><span id="cxStep" class="small"></span></div>
      <div class="apc3d-bar">
        <span class="tb-label">Vehicle</span><div class="seg" role="group" aria-label="Vehicle">
          <button class="seg-btn active" data-cxveh="agv">Underride AGV</button><button class="seg-btn" data-cxveh="fork">Forklift</button></div>
        <span class="tb-label">Task</span><div class="seg" role="group" aria-label="Task">
          <button class="seg-btn active" data-cxtask="deliver">Deliver full crate</button><button class="seg-btn" data-cxtask="pickup">Pick up empty crate</button></div>
        <span class="tb-label">View</span><div class="seg" role="group" aria-label="View">
          <button class="seg-btn" data-cxview="overview">Overview</button><button class="seg-btn" data-cxview="stand">Stand + guides</button>
          <button class="seg-btn" data-cxview="jib">Jib crane</button><button class="seg-btn" data-cxview="side">Side</button></div>
        <label class="tb-check"><input type="checkbox" id="cxLbl" checked> labels</label>
      </div>
      <div class="apc3d-grid"><div class="apc3d" id="cx3d"></div><div class="apc3d-info" id="cx3dInfo"></div></div>
      <div class="apc3d-legend small muted"><span><i style="background:#3c6e9e"></i>stand (MAKE)</span><span><i style="background:#f4f4f0;border:1px solid #bbb"></i>UHMW-PE guide strips</span>
        <span><i style="background:#6f7d58"></i>crate</span><span><i style="background:#d9832b"></i>PU pads</span><span><i style="background:#f2c200"></i>jib crane / bollards</span><span><i style="background:#e0a020"></i>forklift</span></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Steps</h2></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="cxSteps"></tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>How the V-guide centres the crate</h2><span class="sub">section through one guide · moves with the 3D</span></div><div id="cxGuideSvg"></div>
        <p class="hint">The vehicle only has to put the crate somewhere inside the flare. While it is lowered, the crate corner slides down the inclined UHMW-PE face
          into the straight part. The vehicle must let the crate shift: forks have play in the tunnels, the AGV plate has a rim with play – <b>no locating pins on the AGV</b>.</p></div>
    </div>
    <div class="card"><div class="card-head"><h2>Plan view at the cell</h2><span class="sub">stand outside the APC swing circle and the pallet AGV lane</span></div><div id="cxPlan" style="max-width:820px;margin:0 auto"></div></div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="cxReset">Example values</button></div><div id="cxInputs"></div></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="cxChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="cxCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Tolerance chain</h2></div><div id="cxTol"></div></div>
    <div class="card"><div class="card-head"><h2>Bill of materials</h2><span class="sub">MAKE = you manufacture · BUY = catalogue part</span></div><div class="table-wrap"><table id="cxBom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – interface, manufacturing, installation, tests, maintenance</h2></div><div id="cxGuide" class="mx-guide"></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("mech2State") || "{}")); } catch (e) { /* private window */ }
  let X = apcCtx(), R = calc(M, X), veh = "agv", task = "deliver", ST = steps(R, M, veh, task), T = 0, playing = false, last = performance.now(), view = null, geo = "";
  const tot = () => ST.reduce((s, r) => s + r[2], 0);
  const cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const pane = $("tab-mech");

  function inputs() {
    $("cxInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("AGV fits between the legs", R.clearW >= R.needW, R.clearW >= M.wu + 2 * R.cap2, `clear ${R.clearW} mm, needed ${f(R.needW, 0)} mm (AGV ${M.wu} + 2 × (${f(R.cap2, 1)} + 15))`);
    add("AGV lift stroke", M.su >= R.sReq, M.su >= R.sReq - 10, `needed ${f(R.sReq, 0)} mm (guides ${M.gh} + 15 + 20), AGV has ${M.su} mm`);
    add("Guide flare catches the AGV", M.gfl >= R.cap2 + 5, M.gfl >= R.cap2, `flare ${M.gfl} mm ≥ AGV error ±${f(R.cap2, 1)} mm`);
    add("Guide flare catches the forklift", M.gfl >= M.fnav + 5, M.gfl >= M.fnav, `flare ${M.gfl} mm ≥ driver ±${M.fnav} mm`);
    add("Crate can shift on the AGV plate", M.rim >= R.cap2 + 5, M.rim >= R.cap2, `rim play ±${M.rim} mm ≥ ±${f(R.cap2, 1)} mm`);
    add("Crate slides down the guide", R.theta - R.phi >= 20, R.theta - R.phi >= 10, `face ${f(R.theta, 0)}° − friction ${f(R.phi, 0)}° = ${f(R.theta - R.phi, 0)}° (≥ 20°)`);
    add("Rails", R.sigR <= 120 && R.defR <= 1, R.sigR <= 160, `σ = ${f(R.sigR, 0)} N/mm², deflection ${f(R.defR, 2)} mm (forklift impact incl.)`);
    add("PU pads", R.Fimp / 4 <= 5000, R.Fimp / 4 <= 8000, `${f(R.Fimp / 4000, 2)} kN per pad at ${M.vlow} m/s lowering`);
    add("Floor anchors (stand)", R.Fanc <= 0.8 * M.Nan * 1000, R.Fanc <= M.Nan * 1000, `${f(R.Fanc / 1000, 2)} kN per anchor`);
    add("Grip height in the crate", R.grip >= 600 && R.grip <= 1100, R.grip >= 450 && R.grip <= 1250, `≈ ${f(R.grip, 0)} mm (good: 600–1100 mm)`);
    add("Lifting aid", true, true, M.mc > 23 ? `casting ${M.mc} kg > 23 kg → jib crane is required (provided)` : `casting ${M.mc} kg – crane recommended`);
    add("Jib crane reaches crate + fixture", R.reachCrate <= M.rj - 100 && R.reachFix <= M.rj - 100, R.reachCrate <= M.rj && R.reachFix <= M.rj, `crate ${f(R.reachCrate, 0)} mm, fixture ${f(R.reachFix, 0)} mm, radius ${M.rj} mm`);
    add("Jib column + anchors", R.sigC <= 100 && R.Tb <= 0.8 * M.Nan * 1000, R.sigC <= 140, `σ = ${f(R.sigC, 0)} N/mm², ${f(R.Tb / 1000, 1)} kN per anchor`);
    add("Loading time vs machining", R.tload <= 0.5 * M.tcyc2, R.tload <= M.tcyc2, `${f(R.tload, 0)} s for ${M.np} castings vs ${M.tcyc2} s machining`);
    add("Stand outside the APC swing circle", R.standClr >= 300, R.standClr >= 0, `${f(R.standClr, 0)} mm`);
    return c;
  }
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  function formulas() {
    $("cxCalc").innerHTML = [
      blk("1 · Heights", [`Rail top          Hs = AGV height + 20 = ${M.hu} + 20 = <b>${R.Hs} mm</b>`, `Crate top         ${R.Hs} + ${M.ch} = ${R.top} mm`,
        `Carry height      Hs + guide ${M.gh} + 15 = ${R.carry} mm`, `AGV stroke        ${R.carry} − ${M.hu} = <b>${f(R.sReq, 0)} mm</b>`, `Grip height       Hs + base ${BASE} + 150 ≈ ${f(R.grip, 0)} mm`]),
      blk("2 · Catching the error", [`AGV error         e = nav + (L/2)·sin(yaw) = ${M.nav2} + ${M.cl / 2}·sin ${M.yaw2}° = <b>${f(R.cap2, 1)} mm</b>`, `Forklift          ±${M.fnav} mm → flare ${M.gfl} mm`,
        `Guide angle       θ = atan(${R.flareH}/${M.gfl}) = ${f(R.theta, 0)}°, φ = atan ${M.mug} = ${f(R.phi, 0)}°`, `Centring force    F = W·tan(θ − φ) = ${f(R.W, 0)}·tan ${f(R.theta - R.phi, 0)}° = <b>${f(R.Fcen, 0)} N</b>`,
        `Leg clearance     ${M.cw} − 160 = ${R.clearW} ≥ ${M.wu} + 2·(${f(R.cap2, 1)} + 15) = ${f(R.needW, 0)}`]),
      blk("3 · Stand", [`Crate mass        ${M.cm} + ${M.np}·${M.mc} = <b>${R.mcr} kg</b>`, `Impact            E = ½·m·v² = ${f(R.Eimp, 1)} J → F = 2E/s = ${f(R.Fimp, 0)} N`,
        `Rail              F = (W + F_imp)/2 = ${f(R.Frail, 0)} N, M = F·L/8 = ${f(R.Mr / 1000, 0)} N·m`, `                  σ = ${f(R.sigR, 0)} N/mm², δ = 5FL³/(384EI) = ${f(R.defR, 2)} mm`]),
      blk("4 · Jib crane", [`Load              casting ${M.mc} + gripper ${M.mg} = ${R.lift} kg → SWL <b>${R.swl} kg</b>`, `Foot moment       (SWL·1.25·g·R + m_arm·g·R/2) = <b>${f(R.Mj, 0)} N·m</b>`,
        `Column 168.3×6.3  σ = M/W = ${f(R.sigC, 0)} N/mm²`, `Anchors 8 × Ø400  T = 4M/(n·D) = ${f(R.Tb, 0)} N`]),
      blk("5 · Time", [`Loading           ${M.np} × ${M.tj} s = <b>${f(R.tload, 0)} s</b>`, `Machining         ${M.tcyc2} s per pallet → 1 crate per pallet`,
        `AGV trips         ${f(3600 / M.tcyc2 * 2, 1)} per hour for this cell (full in + empty out)`]),
    ].join("");
  }
  function tolHTML() {
    $("cxTol").innerHTML = `<div class="table-wrap"><table class="apc-bom"><thead><tr><th>Stage</th><th>error ± mm</th><th></th></tr></thead><tbody>
      ${R.tol.map((r) => `<tr><td>${esc(r[0])}</td><td>${f(r[1], 1)}</td><td class="muted">${esc(r[2])}</td></tr>`).join("")}</tbody></table></div>
      <p class="hint">Unlike the pallet transfer (item 1) the crate only needs ±${M.gcl} mm: the operator guides the casting with the crane. So simple passive V-guides are enough – no floating deck, no pins.</p>`;
  }
  function bom() {
    const rows = [
      ["Crate stand (2 side frames + end beams)", "MAKE", 1, `legs 80×80×5, rails 100×50×4 × ${M.cl}, rail top ${R.Hs} mm`, "no low cross members"],
      ["Self-centring V-guide with UHMW-PE strip", "MAKE", 4, `height ${M.gh}, flare ${M.gfl} mm, clearance ${M.gcl} mm`, "strips are wear parts"],
      ["PU support pad 90 Sh A", "BUY", 4, "100 × 80 × 20", ""],
      ["Base plate + bonded anchors", "BUY", "4 + 8", "150 × 150 × 15, M12/M16", ""],
      ["Bollard Ø114, concrete filled", "BUY", 2, "in front of the entry legs", "forklift protection"],
      ["Crate sensors B1, B2 + RFID reader", "BUY", 3, "present, seated, crate number", "to the MES"],
      ["Crate (steel box pallet) with nests", "MAKE", "fleet", `${M.cl} × ${M.cw} × ${M.ch}, ${M.cm} kg, 2 fork tunnels, closed bottom, ${M.np} nests`, "number per WIP calculation"],
      ["Underride AGV with lift plate + rim", "BUY", "fleet", `${M.wu} wide, ${M.hu} high, stroke ≥ ${f(R.sReq, 0)} mm, rim play ±${M.rim} mm, no pins`, "AGV supplier"],
      ["Column jib crane", "BUY", 1, `SWL ${R.swl} kg, radius ${M.rj} mm, 270° slewing`, "foundation per supplier"],
      ["Chain hoist or pneumatic balancer", "BUY", 1, `≥ ${R.swl} kg`, ""],
      ["Casting gripper (expanding mandrel)", "MAKE", 1, `${M.mg} kg, self-locking`, "per casting family"],
      ["Floor marking (AGV lane, forklift zone)", "BUY", 1, "yellow tape / paint", ""],
    ];
    $("cxBom").innerHTML = `<thead><tr><th>#</th><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r[0])}</td><td><span class="apc-mb ${r[1].split(" ")[0]}">${esc(r[1])}</span></td><td>${r[2]}</td><td>${esc(r[3])}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}</tbody>`;
  }
  function guide() {
    $("cxGuide").innerHTML = `
      <h3>1 · Interface sheet (crate, AGV, forklift)</h3>
      <div class="table-wrap"><table class="apc-bom"><tbody>
        <tr><td><b>Crate</b></td><td>${M.cl} × ${M.cw} × ${M.ch} mm, ${f(R.mcr, 0)} kg full; bottom plate closed and flat ±2 mm; corners square ±2 mm; 2 fork tunnels 220 × 100 mm at z = ±200 mm</td></tr>
        <tr><td><b>Stand</b></td><td>rail top ${R.Hs} mm, clear width between legs ${R.clearW} mm, open at the entry end, guides ${M.gh} mm high with ${M.gfl} mm flare</td></tr>
        <tr><td><b>Underride AGV</b></td><td>height ≤ ${M.hu} mm, width ≤ ${f(R.clearW - 2 * (R.cap2 + 15), 0)} mm, stroke ≥ ${f(R.sReq, 0)} mm, lift plate with rim (play ±${M.rim} mm), no locating pins, slow speed ${M.vs} m/s under the stand</td></tr>
        <tr><td><b>Forklift</b></td><td>enters from the AGV side, lowers ≤ ${M.vlow} m/s, forks fully into the tunnels</td></tr>
        <tr><td><b>Signals</b></td><td>B1 crate present, B2 crate seated, RFID crate number → MES; AGV gets its order from the fleet manager</td></tr></tbody></table></div>
      <h3>2 · Make the parts</h3>
      <ol class="apc-list">
        <li>Stand: weld the 2 side frames (legs + rail) flat in a jig, join them with end beams at rail height – nothing below ${R.Hs - 50} mm between the legs.</li>
        <li>V-guides: cut and bend (or weld) the 8 mm angles, flare ${M.gfl} mm over ${R.flareH} mm; screw the UHMW-PE strips with countersunk screws (heads 2 mm below the face).</li>
        <li>Crates: weld in a jig so all crates have the same outer size ±2 mm (they all must fit the same guides); fit nests in the same positions ±5 mm.</li>
        <li>Gripper: expanding mandrel for the cylinder bores, mechanical self-locking; proof test 2 × load.</li>
      </ol>
      <h3>3 · Install</h3>
      <ol class="apc-list">
        <li>Mark the stand position: outside the APC swing circle (≥ 300 mm), operator walkway ≥ 800 mm to the load station.</li>
        <li>Set the stand: rails level ±1 mm, parallel ±2 mm; anchor every leg; set the 4 guides with a master crate (clearance ${M.gcl} mm all round).</li>
        <li>Set the bollards; paint the AGV lane and the forklift zone; teach the AGV stop point (centre of the stand).</li>
        <li>Jib crane: foundation per supplier, column vertical ±1 mm/m; set the slewing stop so the arm cannot reach into the APC swing circle above the pallet changer.</li>
      </ol>
      <h3>4 · Tests</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Accept</th></tr></thead><tbody>
        <tr><td>AGV offset</td><td>stop the AGV ${f(R.cap2 + 3, 0)} mm off in both directions, 20 cycles</td><td>crate seated (B2) every time</td></tr>
        <tr><td>Forklift</td><td>3 drivers × 10 placements</td><td>crate seated without correction</td></tr>
        <tr><td>Load test</td><td>1.25 × full crate on the stand, forklift lowering at ${M.vlow} m/s</td><td>no permanent deformation</td></tr>
        <tr><td>Jib crane</td><td>proof load 1.25 × SWL (supplier certificate)</td><td>OK, slewing stops work</td></tr>
      </tbody></table></div>
      <h3>5 · Maintenance</h3>
      <ul class="apc-list"><li>Monthly: guide strips (wear, loose screws), PU pads, sensors clean.</li><li>Every 6 months: anchor torque, crate corners (bent crates out of service), gripper function.</li><li>Yearly: jib crane inspection by a competent person.</li></ul>`;
  }
  function info(key) {
    const el = $("cx3dInfo");
    const p = key && partInfo(key, R, M);
    if (!p) {
      const rows = [["Rail top", `${R.Hs} mm`], ["Crate full", `${f(R.mcr, 0)} kg`], ["AGV error", `±${f(R.cap2, 1)} mm`], ["Forklift error", `±${M.fnav} mm`],
        ["Guide flare", `${M.gfl} mm, ${f(R.theta, 0)}°`], ["Seated", `±${M.gcl} mm`], ["Jib crane", `SWL ${R.swl} kg, R ${M.rj}`], ["Loading", `${f(R.tload, 0)} s per crate`]];
      el.innerHTML = `<div class="apc-pi-h"><b>Crate stand – main values</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
        <p class="hint">Click a part in the 3D view for its function, specification, material and manufacturing notes.</p>`; return;
    }
    const [n, mb, matl, fn, spec, mfg] = p;
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b>${mb ? `<span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span>` : ""}</div>
      ${fn ? `<p>${esc(fn)}</p>` : ""}${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="cxBack">◀ main values</button>`;
    $("cxBack").onclick = () => info(null);
  }
  function render() {
    X = apcCtx(); R = calc(M, X); ST = steps(R, M, veh, task); T = Math.min(T, tot());
    const ch = checks();
    $("cxKpis").innerHTML = [["Rail top", R.Hs + " mm", `crate top ${R.top} mm`], ["Crate full", f(R.mcr, 0) + " kg", `${M.np} × ${M.mc} kg castings`],
      ["Guide flare", M.gfl + " mm", `catches AGV ±${f(R.cap2, 0)} / forklift ±${M.fnav}`], ["Jib crane", R.swl + " kg", `radius ${M.rj} mm`],
      ["Loading", f(R.tload, 0) + " s", `of ${M.tcyc2} s machining`], ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("cxChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); tolHTML(); bom(); guide(); $("cxPlan").innerHTML = planSVG(R, M, X);
    const k = JSON.stringify([X, M]);
    if (view && k !== geo) { geo = k; view.build(R, M, X); view.setLabels($("cxLbl").checked); info(null); }
    draw();
  }
  function draw() {
    const s = stateAt(T, ST, R, M, veh, task);
    if (view) view.update(s, veh);
    $("cxStep").innerHTML = `Step ${s.k + 1}/${ST.length}: <b>${esc(ST[s.k][1])}</b> <span class="muted">${f(T, 1)} / ${f(tot(), 1)} s</span>`;
    $("cxScrub").value = Math.round(T / tot() * 1000);
    $("cxPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("cxSteps").innerHTML = ST.map((r, i) => `<tr class="${i === s.k ? "on" : ""}"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
    $("cxGuideSvg").innerHTML = guideSVG(R, M, s, veh);
  }
  function init() {
    if (view) { view.resize(); return; }
    try { view = create3D($("cx3d")); } catch (e) { $("cx3d").innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe($("cx3d"));
    view.resize(); view.onPick(info);
    geo = JSON.stringify([X, M]); view.build(R, M, X); info(null); draw();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active") || box2.hidden) return;
      if (playing) { T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); }
      view.frame();
    };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("cxInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = M[k]; return; }
    M[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("mech2State", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("cxReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("mech2State"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("cxPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("cxScrub").addEventListener("input", (e) => { playing = false; T = tot() * e.target.value / 1000; draw(); });
  const seg = (attr, fn) => box2.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener("click", () => {
    box2.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle("active", x === b)); fn(b.getAttribute(attr)); }));
  seg("data-cxveh", (v) => { veh = v; T = 0; playing = false; ST = steps(R, M, veh, task); draw(); });
  seg("data-cxtask", (v) => { task = v; T = 0; playing = false; ST = steps(R, M, veh, task); draw(); });
  box2.querySelectorAll("[data-cxview]").forEach((b) => b.addEventListener("click", () => view && view.fit(b.dataset.cxview)));
  $("cxLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  window.mech2 = { show() { if (JSON.stringify(apcCtx()) !== JSON.stringify(X)) render(); init(); } };
  const q = new URLSearchParams(location.search);
  if (q.get("cxveh")) setTimeout(() => { const b = box2.querySelector(`[data-cxveh="${q.get("cxveh")}"]`); if (b) b.click(); }, 400);
  if (q.get("cxtask")) setTimeout(() => { const b = box2.querySelector(`[data-cxtask="${q.get("cxtask")}"]`); if (b) b.click(); }, 420);
  if (q.get("cxview")) setTimeout(() => { view && view.fit(q.get("cxview")); }, 700);
  if (q.get("cxt")) setTimeout(() => { T = Math.min(tot(), parseFloat(q.get("cxt")) || 0); draw(); }, 750);
  if (q.get("cxpart")) setTimeout(() => info(q.get("cxpart")), 800);
}
