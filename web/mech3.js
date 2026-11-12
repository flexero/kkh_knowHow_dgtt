/* Mechanical elements tab - item 3: interface between the AS/RS (stacker crane) and the AGVs.
   Front end of the raw-material AS/RS: two I/O chain conveyors (IN / OUT) leave the fenced crane area sideways.
     P&D position (crane fork puts / takes the crate)  ->  inside buffer(s)  ->  fence opening with muting light curtain
     ->  contour check (IN lane: profile, overhang, weight, barcode/RFID)  ->  AGV transfer position (V-side guides, open below).
   One support principle everywhere: the crate rests on its two long edges (rack angles, conveyor chains, stand rails),
   so the middle stays free for the crane fork AND the underride AGV.
   The fence distance comes from the safety distance S = K·T + C (ISO 13855) to the crane envelope; it decides how many
   conveyor positions are inside the fence.  All values are examples.  Coordinates: mm, Y up, x along the aisle
   (x = 0 = P&D position of the crane, racks at -x), z across the aisle (OUT lane -z, IN lane +z).  Offline (web/vendor). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, BAY = 1000, NB = 4, LV = 4, LVH = 850, BASE = 130;
const MOTORS = [0.12, 0.18, 0.25, 0.37, 0.55];

const GROUPS = [
  ["Unit load (crate from item 2)", [
    ["cl", "Crate length (across the aisle)", "mm", 1200, ""],
    ["cw", "Crate width (along the aisle)", "mm", 800, ""],
    ["ch", "Crate height", "mm", 600, ""],
    ["mcr", "Crate mass, full", "kg", 203, "item 2: 75 + 4 × 32"],
    ["mrat", "Rated load of the AS/RS", "kg", 250, "AS/RS supplier"]]],
  ["Stacker crane", [
    ["tdc", "Double cycle time (in + out)", "s", 50, "twin: crane_cycle_s 50"],
    ["tst", "Stop time of the crane axes near the P&D", "s", 0.5, "fork / lift / travel, from the supplier"],
    ["wf", "Telescopic fork width", "mm", 500, ""],
    ["hpd", "P&D accuracy of the crane", "± mm", 3, "laser positioning"]]],
  ["Flows", [
    ["qin", "Crates IN per hour (to the AS/RS)", "1/h", 12, "full crates from the foundry + empties"],
    ["qout", "Crates OUT per hour (to the cells)", "1/h", 12, "3 HMCs ≈ 8/h + reserve"]]],
  ["I/O chain conveyor", [
    ["vc", "Conveyor speed", "m/s", 0.2, "EN 619: low speed, nip guards"],
    ["ac", "Acceleration", "m/s²", 0.3, ""],
    ["muc", "Running resistance", "", 0.1, ""],
    ["pgap", "Gap between positions", "mm", 200, ""],
    ["tlc", "Light curtain response time", "s", 0.02, ""]]],
  ["Underride AGV (from item 2)", [
    ["hu", "AGV height", "mm", 300, ""],
    ["wu", "AGV width", "mm", 560, ""],
    ["nav3", "AGV stop accuracy", "± mm", 10, ""],
    ["yaw3", "AGV angle accuracy", "± °", 0.5, ""],
    ["vs3", "Speed under the conveyor", "m/s", 0.3, ""],
    ["vu3", "Lift speed", "mm/s", 40, ""],
    ["gfl3", "Side guide flare at the transfer position", "mm", 40, ""]]],
  ["Contour check", [
    ["ovh", "Allowed overhang / offset", "mm", 20, "more → reject"],
    ["hov", "Allowed height above the crate", "mm", 30, "parts sticking out"]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

/* ------------------------------------------------------------------ calculation */
function calc(M) {
  const R = {};
  R.Hc = M.hu + 20;                                  // chain top = crate bottom on the conveyor
  R.xc = M.cw / 2 - 40;                              // chain / side frame centre
  R.clear = 2 * (R.xc - 20);                         // clear width between the side frames
  R.cap3 = M.nav3 + M.cl / 2 * Math.sin(M.yaw3 * Math.PI / 180);
  R.needAGV = M.wu + 2 * (R.cap3 + 15); R.needFork = M.wf + 2 * 30;
  R.aw = M.cl + 200;                                 // aisle width (crate across the aisle)
  R.zP = R.aw / 2 + M.cl / 2 + 50;                   // P&D (and rack) centre
  R.pp = M.cl + M.pgap;
  R.T = M.tlc + M.tst; R.S = 1600 * R.T + 850;       // ISO 13855 (reaching through, C = 850 mm)
  R.zF = Math.ceil((R.aw / 2 + R.S) / 50) * 50;      // fence line
  // no crate may stop in the fence opening: inside positions end 100 mm before the fence, outside ones start 100 mm after it
  const zin = [R.zP]; while (zin[zin.length - 1] + R.pp + M.cl / 2 <= R.zF - 100) zin.push(zin[zin.length - 1] + R.pp);
  const z0 = Math.max(R.zF + 100 + M.cl / 2, zin[zin.length - 1] + R.pp);
  R.zs = [...zin, z0, z0 + R.pp]; R.kOut = zin.length; R.nPos = R.zs.length;   // contour / buffer at kOut, AGV transfer last
  R.zLast = R.zs[R.nPos - 1];
  R.bridge = (z0 - M.cl / 2) - (zin[zin.length - 1] + M.cl / 2);                // conveyor through the opening, no stop
  const mv = (d) => d / 1000 / M.vc + M.vc / M.ac;
  R.tOut = mv(R.zLast - R.zP); R.tChk = mv(R.zLast - R.zs[R.kOut]); R.tIn = mv(R.zs[R.kOut] - R.zP);
  R.openW = M.cw + 200; R.openH = R.Hc + M.ch + 150;
  R.tpos = R.pp / 1000 / M.vc + M.vc / M.ac;
  R.F = M.mcr * (M.muc * G + M.ac); R.P = R.F * M.vc / 0.8; R.motor = MOTORS.find((x) => x * 1000 >= R.P * 1.5) || 0.55;
  const dc = Math.min(M.qin, M.qout), sc = Math.abs(M.qin - M.qout);
  R.tCrane = dc * M.tdc + sc * M.tdc * 0.6; R.util = R.tCrane / 3600;
  R.lateOut = (R.nPos - 1) * 3600 / M.qout;          // how long the AGV may be late before the crane must wait
  R.lateIn = (R.nPos - 1) * 3600 / M.qin;
  R.gh = 100; R.carry = R.Hc + R.gh + 15; R.sReq = R.carry - M.hu;
  R.tAgv = 2 * (2400 / (M.vs3 * 1000)) + R.sReq / M.vu3;
  R.agvPerH = M.qin + M.qout;
  R.laneLen = R.zLast + M.cl / 2 - (R.zP - M.cl / 2);
  return R;
}

function steps(R, M, task) {
  if (task === "out") return [
    ["fetch", "WMS order → crane fetches the crate from the rack (fork under the crate, between the support angles)", 10],
    ["put", "Crane drives to the P&D position and sets the crate on the OUT conveyor (fork between the chains)", 8],
    ["conv", `Conveyor moves the crate out through the fence opening (light curtain muted by the crate) to the transfer position`, R.tOut],
    ["agv", "Load ready → fleet manager sends the AGV: it drives under the transfer position, lifts, drives away", R.tAgv]];
  return [
    ["agv", "AGV brings a crate, drives under the IN transfer position and lowers it (side guides centre it)", R.tAgv],
    ["chk", "Conveyor → contour check: profile, overhang, height, weight, barcode/RFID = OK", R.tChk + 2],
    ["conv", "Conveyor moves the crate through the fence opening (muting) into the P&D position", R.tIn],
    ["store", "Crane takes the crate (fork between the chains) and stores it in the rack", 14]];
}

const ease = (u) => u * u * (3 - 2 * u), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function stateAt(t, ST, R, M, task) {
  let k = 0, t0 = 0;
  while (k < ST.length - 1 && t >= t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = clamp((t - t0) / ST[k][2], 0, 1), key = ST[k][0], out = task === "out";
  const sg = out ? -1 : 1;                             // lane side
  const rackX = -(BAY + 1.5 * BAY), rackY = R.Hc + 2 * LVH, rackZ = out ? R.zP : -R.zP;
  const s = { k, u, t, crane: { x: 0, y: R.Hc - 30, fz: 0 }, crate: { x: 0, y: R.Hc, z: sg * R.zP }, agv: { z: sg * (R.zLast + 3000), plate: M.hu, vis: true },
    chain: 0, mute: false, chk: false, lane: sg };
  const lift = 50;
  // phases of a crane pick or put: [0..1] -> fork extend, lift/lower, retract
  const fork = (v, zT, yLow, pick) => {           // returns crane + crate on fork
    const c = { fz: 0, y: yLow, on: !pick };
    if (v < 0.35) { c.fz = zT * ease(v / 0.35); c.y = pick ? yLow : yLow + lift; c.on = !pick; }
    else if (v < 0.6) { c.fz = zT; const e = ease((v - 0.35) / 0.25); c.y = pick ? yLow + lift * e : yLow + lift * (1 - e); c.on = pick ? e >= 0.6 : e < 0.6; }
    else { c.fz = zT * (1 - ease((v - 0.6) / 0.4)); c.y = pick ? yLow + lift : yLow; c.on = pick; }
    return c;
  };
  if (out) {
    if (key === "fetch") {
      s.crane.x = rackX * Math.min(1, u * 4); const yl = rackY - 30;
      if (u < 0.25) { s.crane.y = (R.Hc - 30) + (yl - R.Hc + 30) * ease(u / 0.25); s.crate = { x: rackX, y: rackY, z: rackZ }; }
      else { const c = fork((u - 0.25) / 0.75, rackZ, yl, true); s.crane.y = c.y; s.crane.fz = c.fz;
        s.crate = c.on ? { x: rackX, y: c.y, z: c.fz } : { x: rackX, y: rackY, z: rackZ }; }
    } else if (key === "put") {
      const yl = R.Hc - 30;
      if (u < 0.4) { const e = ease(u / 0.4); s.crane.x = rackX * (1 - e); s.crane.y = (rackY + 20) + (yl + lift - rackY - 20) * e; s.crate = { x: s.crane.x, y: s.crane.y, z: 0 }; }
      else { const c = fork((u - 0.4) / 0.6, -R.zP, yl, false); s.crane.y = c.y; s.crane.fz = c.fz;
        s.crate = c.on ? { x: 0, y: c.y, z: c.fz } : { x: 0, y: R.Hc, z: -R.zP }; }
    } else if (key === "conv") {
      s.crate = { x: 0, y: R.Hc, z: -(R.zP + (R.zLast - R.zP) * ease(u)) }; s.chain = -1;
      s.mute = Math.abs(Math.abs(s.crate.z) - R.zF) < M.cl / 2 + 300;
    } else {   // agv picks up at the OUT transfer position
      const tIn = 2400 / (M.vs3 * 1000) / R.tAgv, tL = 1 - 2 * tIn;
      const zA = -R.zLast;
      if (u < tIn) { s.agv.z = zA - 2400 * (1 - ease(u / tIn)); s.crate = { x: 0, y: R.Hc, z: zA }; }
      else if (u < tIn + tL) { s.agv.z = zA; s.agv.plate = M.hu + (R.carry - M.hu) * ease((u - tIn) / tL); s.crate = { x: 0, y: Math.max(R.Hc, s.agv.plate), z: zA }; }
      else { s.agv.z = zA - 2400 * ease((u - tIn - tL) / tIn); s.agv.plate = R.carry; s.crate = { x: 0, y: R.carry, z: s.agv.z }; }
    }
    if (key !== "agv") s.agv.z = -(R.zLast + 3000);
  } else {
    if (key === "agv") {
      const tIn = 2400 / (M.vs3 * 1000) / R.tAgv, tL = 1 - 2 * tIn, zA = R.zLast, e0 = R.cap3 * 0.8;
      if (u < tIn) { s.agv.z = zA + 2400 * (1 - ease(u / tIn)); s.agv.plate = R.carry; s.crate = { x: e0, y: R.carry, z: s.agv.z }; }
      else if (u < tIn + tL) { s.agv.z = zA; s.agv.plate = R.carry - (R.carry - M.hu) * ease((u - tIn) / tL);
        const y = Math.max(R.Hc, s.agv.plate), c = clamp((R.Hc + R.gh - y) / (R.gh - 40), 0, 1); s.crate = { x: e0 * (1 - c), y, z: zA }; }
      else { s.agv.z = zA + 2400 * ease((u - tIn - tL) / tIn); s.crate = { x: 0, y: R.Hc, z: zA }; }
      s.agvX = e0;
    } else if (key === "chk") {
      s.crate = { x: 0, y: R.Hc, z: R.zLast - (R.zLast - R.zs[R.kOut]) * ease(Math.min(1, u * 1.4)) }; s.chain = -1; s.chk = u > 0.6;
      s.agv.z = R.zLast + 3000;
    } else if (key === "conv") {
      s.crate = { x: 0, y: R.Hc, z: R.zs[R.kOut] - (R.zs[R.kOut] - R.zP) * ease(u) }; s.chain = -1; s.chk = true;
      s.mute = Math.abs(s.crate.z - R.zF) < M.cl / 2 + 300; s.agv.z = R.zLast + 3000;
    } else {
      s.agv.z = R.zLast + 3000;
      const yl = R.Hc - 30, rx = -(BAY + 2.5 * BAY), ry = R.Hc + LVH;
      if (u < 0.5) { const c = fork(u / 0.5, R.zP, yl, true); s.crane.y = c.y; s.crane.fz = c.fz; s.crate = c.on ? { x: 0, y: c.y, z: c.fz } : { x: 0, y: R.Hc, z: R.zP }; }
      else if (u < 0.7) { const e = ease((u - 0.5) / 0.2); s.crane.x = rx * e; s.crane.y = (yl + lift) + (ry + 20 - yl - lift) * e; s.crate = { x: s.crane.x, y: s.crane.y, z: 0 }; }
      else { const c = fork((u - 0.7) / 0.3, -R.zP, ry - 30, false); s.crane.x = rx; s.crane.y = c.y; s.crane.fz = c.fz; s.crate = c.on ? { x: rx, y: c.y, z: c.fz } : { x: rx, y: ry, z: -R.zP }; }
    }
  }
  s.agv.x = s.agvX || 0;
  return s;
}

/* ------------------------------------------------------------------ part info */
function partInfo(key, R, M) {
  const I = {
    rack: ["Pallet rack (single deep)", "BUY (AS/RS supplier)", "cold-formed uprights + beams + support angles", "Stores the crates. The crate rests on 2 support angles under its long edges, so the fork can go under it.",
      `Bay ${BAY} mm, aisle ${R.aw} mm, real AS/RS: 7 levels, 9.5 m (twin). Shown: ${LV} levels.`, "Erected and load-tested by the AS/RS supplier (EN 15620 tolerances, EN 15512 design)."],
    crane: ["Stacker crane (single mast)", "BUY (AS/RS supplier)", "mast, lifting carriage, telescopic fork, travel drive", "Moves crates between the rack and the P&D positions.",
      `Double cycle ${M.tdc} s, P&D accuracy ±${M.hpd} mm, fork width ${M.wf} mm, rated load ${M.mrat} kg. Utilisation here ${f(R.util * 100, 0)} %.`, "EN 528 safety: overtravel buffers, slack-rope / overload protection, safe speed near the front end."],
    fork: ["Telescopic fork", "BUY", "double-deep capable telescopic fork", "Goes under the crate between the rack angles or the conveyor chains, lifts 50 mm, retracts.",
      `Width ${M.wf} mm in a clear width of ${R.clear} mm (needs ${R.needFork}).`, ""],
    rail: ["Crane rails (floor + top guide)", "BUY", "flat rail on the floor, top guide rail on the rack", "Carry and guide the crane.", "", "Floor rail on a levelled foundation strip, tolerances from the crane supplier (typ. ±2 mm over the length)."],
    conv: ["I/O chain conveyor section", "MAKE", "S355 side frames 120×40, 2 roller chains 3/4\" on UHMW-PE guides, legs on anchors",
      "Moves the crate between the crane P&D position and the AGV transfer position; every position is a buffer place.",
      `Chain top ${R.Hc} mm, chains at x = ±${R.xc} mm (under the long crate edges), section ${R.pp} mm, ${M.vc} m/s. Clear width between the frames ${R.clear} mm – no cross members low down.`,
      "Weld the 2 side frames, connect them only with cross ties at the floor (≤ 100 mm high). Chain guards over the return strand and at the sprockets (EN 619 nip points)."],
    motor: ["Gear motor per section", "BUY", "helical gear motor with brake + frequency inverter", "Each position has its own drive, so crates can wait (zero-pressure accumulation).",
      `${R.motor} kW (needed ${f(R.P, 0)} W × 1.5 for one ${M.mcr} kg crate).`, ""],
    sensor: ["Position sensors", "BUY", "photoelectric (retro-reflective) sensors", "Each position: 'occupied' and 'stop' sensors. Free / occupied go to the PLC and the WMS.", "2 per position.", "Mount them protected under the side frame edge."],
    guide: ["Side guides + V-flare (transfer position)", "MAKE", "S355 + UHMW-PE strip", "Centre the crate sideways when the AGV lowers it and guide it on the conveyor.",
      `Flare ${M.gfl3} mm per side catches the AGV error ±${f(R.cap3, 1)} mm.`, "In travel direction there is no guide – the conveyor positions the crate with its stop sensor."],
    stop: ["End stop + buffer", "MAKE", "steel stop with PU pad", "At the end of the transfer position: the conveyor can never push a crate off.", "", ""],
    contour: ["Contour check (inbound)", "BUY", "2 light grids (side + top), 5 mm resolution, + load cells + barcode / RFID",
      "Every incoming crate is checked BEFORE it enters the AS/RS: size, overhang, parts sticking up, weight and ID. A bad crate can jam or crash the crane.",
      `Reject if offset/overhang > ${M.ovh} mm, height > crate + ${M.hov} mm, weight > ${M.mrat} kg or no ID. Rejected crates go back to the AGV position.`, "Calibrate with a test crate with defined faults."],
    fence: ["Safety fence (crane area)", "BUY", "mesh panels 2.0 m, posts anchored (ISO 14120, ISO 13857)", "Keeps people out of the crane area.",
      `Side fence at z = ±${R.zF} mm = aisle edge + safety distance S = ${f(R.S, 0)} mm.`, "Gap to the floor ≤ 200 mm, mesh ≤ 40 mm at ≥ 200 mm distance from moving parts."],
    door: ["Maintenance door with guard locking", "BUY", "interlock switch with guard locking (ISO 14119)", "The only way into the crane area. Opens only when the crane is stopped and safe.", "", "Key / personal lock-out (LOTO) for maintenance."],
    curtain: ["Light curtain with muting at the fence opening", "BUY", "type 4 light curtain + 4 muting sensors (crossed beams)",
      "The crate may pass, a person may not: muting only when the sensors see a crate shape in the right order and for a limited time.",
      `Opening ${R.openW} × ${R.openH} mm. Safety distance S = 1600 × ${f(R.T, 2)} s + 850 = ${f(R.S, 0)} mm (ISO 13855).`, "IEC 62046 muting rules; test with a test rod and a person-size dummy."],
    cabinet: ["Control cabinet + HMI", "MAKE / BUY", "PLC (safety PLC) + drives + HMI", "AS/RS + conveyor control, connection to the WMS and the AGV fleet manager.", "", "Outside the fence, with the E-stop and the operating mode switch."],
    agv: ["Underride AGV (item 2)", "BUY", "latent lifting AGV", "Takes / brings crates at the transfer position; drives under the conveyor between the side frames.",
      `Width ${M.wu} mm in ${R.clear} mm clear (needs ${f(R.needAGV, 0)}), lift stroke ≥ ${f(R.sReq, 0)} mm.`, ""],
    crate: ["Crate (item 2)", "", "", "Same crate everywhere: rack, conveyor, AGV, stand at the cell.", `${M.cl} × ${M.cw} × ${M.ch} mm, ${M.mcr} kg.`, ""],
  };
  return I[key];
}

/* ------------------------------------------------------------------ 3D */
function create3D(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 10, 60000), controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(4000, 7000, 3000); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3000, 2000, -2500); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed"); if (window.dtTheme) window.dtTheme.scene(scene);
  let O = {}, labels = [], selBox = null, onPick = null, chainTex = [];
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !o.op });
  const C = { frame: mat(0x3c6e9e), rack: mat(0xe07a1f, { m: 0.3, r: 0.5 }), rackU: mat(0x2f5f8f), crane: mat(0xf2c200, { m: 0.25, r: 0.5 }), dark: mat(0x3a4048), black: mat(0x23262a),
    steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }), pe: mat(0xf4f4f0, { m: 0, r: 0.8 }), pu: mat(0xd9832b, { m: 0, r: 0.7 }), fence: mat(0x6b7480, { op: 0.28, ds: true, m: 0.1 }),
    fpost: mat(0xe8c100), crate: mat(0x6f7d58, { m: 0.3, r: 0.6 }), mesh: mat(0x6f7d58, { op: 0.35, ds: true }), cast: mat(0x67717b, { m: 0.2, r: 0.8 }),
    agv: mat(0xe8e6df, { m: 0.15, r: 0.6 }), agvDark: mat(0x4a5560), floor: mat(0xd8d6cf, { m: 0, r: 0.95 }), yellow: mat(0xf2c200), green: mat(0x2fa84f), red: mat(0xd03b3b),
    grid: mat(0x19a7c8, { op: 0.18, ds: true, m: 0 }), cab: mat(0xc9ccd0, { m: 0.3, r: 0.5 }) };
  const box = (w, h, d, m, x, y, z, part, parent) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  const cyl = (r, h, m, x, y, z, part, parent, axis = "y", seg = 20) => { const g = new THREE.CylinderGeometry(r, r, h, seg); if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  function chainBox(len, x, y, z, parent) {
    const c = document.createElement("canvas"); c.width = 4; c.height = 16; const g = c.getContext("2d");
    g.fillStyle = "#2b2f35"; g.fillRect(0, 0, 4, 16); g.fillStyle = "#8d969f"; g.fillRect(0, 9, 4, 7);
    const tex = new THREE.CanvasTexture(c); tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, len / 19.05);
    const me = new THREE.Mesh(new THREE.BoxGeometry(30, 12, len), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.45 }));
    me.position.set(x, y, z); me.userData.part = "conv"; parent.add(me); chainTex.push(tex); return me;
  }
  function label(text, anchor, off = [0, 0, 0], parent = root) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "600 30px system-ui, sans-serif";
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 46;
    g.font = "600 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.93)"; g.strokeStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.roundRect(1, 1, w - 2, 44, 10); g.fill(); g.stroke(); g.fillStyle = "#1b1f24"; g.fillText(text, 12, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
    const pos = [anchor[0] + off[0], anchor[1] + off[1], anchor[2] + off[2]];
    sp.scale.set(0.032 * w / 46, 0.032, 1); sp.position.set(...pos); sp.renderOrder = 20; parent.add(sp); labels.push(sp);
    if (off.some((v) => v)) { const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor), new THREE.Vector3(...pos)]), new THREE.LineBasicMaterial({ color: 0x30363d, depthTest: false, transparent: true, opacity: 0.8 })); ln.renderOrder = 19; parent.add(ln); labels.push(ln); }
  }
  function crate(M, parent, full = true) {    // origin = bottom centre, length along z
    const g = new THREE.Group(); parent.add(g);
    box(M.cw, 10, M.cl, C.crate, 0, 5, 0, "crate", g); box(M.cw, 20, M.cl, C.crate, 0, BASE - 10, 0, "crate", g);
    for (const xx of [-M.cw / 2 + 40, M.cw / 2 - 40]) box(60, 100, M.cl, C.crate, xx, 60, 0, "crate", g);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(50, M.ch, 50, C.crate, sx * (M.cw / 2 - 25), M.ch / 2, sz * (M.cl / 2 - 25), "crate", g);
    for (const sx of [1, -1]) box(4, M.ch - BASE, M.cl - 50, C.mesh, sx * (M.cw / 2 - 2), BASE + (M.ch - BASE) / 2, 0, "crate", g);
    for (const sz of [1, -1]) box(M.cw - 50, M.ch - BASE, 4, C.mesh, 0, BASE + (M.ch - BASE) / 2, sz * (M.cl / 2 - 2), "crate", g);
    if (full) for (const sz of [1, -1]) for (const sx of [1, -1]) box(260, 220, 300, C.cast, sx * M.cw / 4, BASE + 110, sz * M.cl / 4, "crate", g);
    return g;
  }

  function build(R, M) {
    while (root.children.length) { const o = root.children.pop(); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map) c.material.map.dispose(); }); }
    labels = []; chainTex = []; O = { R, M }; if (selBox) { scene.remove(selBox); selBox = null; }
    const xEnd = -(BAY + NB * BAY + 600);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(16000, 18000), C.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(-1500, 0, 0); root.add(fl); if (window.dtTheme) window.dtTheme.floor(C.floor);
    // ---- racks both sides
    const rD = M.cl + 100, top = R.Hc + (LV - 1) * LVH + M.ch + 300;
    for (const sz of [1, -1]) {
      const zc = sz * R.zP;
      for (let i = 0; i <= NB; i++) for (const dz of [-rD / 2, rD / 2]) box(90, top, 70, C.rackU, -BAY - i * BAY, top / 2, zc + dz, "rack", root);
      for (let l = 0; l < LV; l++) {
        const y = R.Hc + l * LVH;
        for (const dz of [-rD / 2, rD / 2]) box(NB * BAY, 100, 50, C.rack, -BAY - NB * BAY / 2, y - 60, zc + dz, "rack", root);
        for (let i = 0; i < NB; i++) for (const sx of [1, -1]) box(50, 10, rD, C.steel, -1.5 * BAY - i * BAY + sx * R.xc, y - 5, zc, "rack", root);
        for (let i = 0; i < NB; i++) if ((i + l + (sz > 0 ? 1 : 0)) % 3 !== 0) { const c = crate(M, root, true); c.position.set(-1.5 * BAY - i * BAY, y, zc); }
      }
    }
    label("Rack (crate on 2 support angles)", [-BAY - 2 * BAY, R.Hc + 3 * LVH, R.zP + rD / 2], [-400, 700, 900]);
    // ---- crane
    box(-xEnd + 900, 20, 120, C.steel, (xEnd + 900) / 2, 10, 0, "rail", root);
    box(-xEnd + 900, 60, 100, C.steel, (xEnd + 900) / 2, top + 150, 0, "rail", root);
    const CR = new THREE.Group(); root.add(CR); O.crane = CR;
    box(1300, 260, 700, C.crane, 0, 200, 0, "crane", CR);
    for (const sx of [1, -1]) box(180, top - 150, 300, C.crane, sx * 500, (top - 150) / 2 + 300, 0, "crane", CR);
    box(1200, 160, 400, C.crane, 0, top + 30, 0, "crane", CR);
    box(400, 700, 500, C.cab, 800, 700, 0, "crane", CR);
    const CA = new THREE.Group(); CR.add(CA); O.carr = CA;           // y = fork top
    box(1000, 260, 600, C.dark, 0, 100, 0, "crane", CA);
    const FK = new THREE.Group(); CA.add(FK); O.fork = FK;
    box(M.wf, 50, M.cl, C.steel, 0, -25, 0, "fork", FK);
    box(M.wf - 60, 30, M.cl - 100, C.dark, 0, -65, 0, "fork", CA);
    label("Stacker crane + telescopic fork", [500, top - 400, 150], [900, 300, 600], CR);
    // ---- conveyors (both lanes)
    O.secs = [];
    for (const sg of [-1, 1]) if (R.bridge > 60) {
      const zc = sg * ((R.zs[R.kOut - 1] + R.zs[R.kOut]) / 2), len = R.bridge + 120;
      for (const sx of [1, -1]) { box(40, 120, len, C.frame, sx * R.xc, R.Hc - 72, zc, "conv", root); chainBox(len - 20, sx * R.xc, R.Hc - 6, zc, root); box(10, 40, len, C.pe, sx * (M.cw / 2 + 12), R.Hc + 40, zc, "guide", root); }
    }
    for (const sg of [-1, 1]) for (let i = 0; i < R.nPos; i++) {
      const zc = sg * R.zs[i], len = M.cl + 120, S = new THREE.Group(); root.add(S);
      for (const sx of [1, -1]) {
        box(40, 120, len, C.frame, sx * R.xc, R.Hc - 72, zc, "conv", S);
        chainBox(len - 20, sx * R.xc, R.Hc - 6, zc, S);
        for (const dz of [-len / 2 + 60, len / 2 - 60]) { box(60, R.Hc - 130, 60, C.frame, sx * R.xc, (R.Hc - 130) / 2, zc + dz, "conv", S); box(120, 12, 120, C.dark, sx * R.xc, 6, zc + dz, "conv", S); }
      }
      if (i !== R.nPos - 1) box(2 * R.xc, 40, 60, C.frame, 0, 20, zc, "conv", S);       // floor tie (not at the AGV position)
      box(150, 140, 120, C.frame, R.xc + 110, R.Hc - 100, zc + sg * (len / 2 - 120), "motor", S);
      box(30, 30, 30, C.black, -(R.xc + 40), R.Hc + 10, zc + sg * (len / 2 - 60), "sensor", S);
      for (const sx of [1, -1]) box(10, 40, len, C.pe, sx * (M.cw / 2 + 12), R.Hc + 40, zc, "guide", S);   // side guides
      if (i === R.nPos - 1) {
        for (const sx of [1, -1]) { const p = box(10, 70, len, C.pe, sx * (M.cw / 2 + 12 + M.gfl3 / 2), R.Hc + 85, zc, "guide", S); p.rotation.z = -sx * Math.atan2(M.gfl3, 70); }
        box(2 * R.xc + 100, 160, 40, C.dark, 0, R.Hc + 60, zc + sg * (len / 2 + 30), "stop", S); box(200, 80, 20, C.pu, 0, R.Hc + 60, zc + sg * (len / 2), "stop", S);
      }
    }
    // contour check frame on the IN lane (+z) at kOut
    { const zc = R.zs[R.kOut], hh = R.Hc + M.ch + 250, bx = M.cw / 2 + 140;
      for (const sx of [1, -1]) { box(60, hh, 80, C.dark, sx * bx, hh / 2, zc, "contour", root); box(10, M.ch + 100, 900, C.grid, sx * (bx - 40), R.Hc + (M.ch + 100) / 2, zc, "contour", root); }
      box(2 * bx + 60, 60, 80, C.dark, 0, hh, zc, "contour", root); box(2 * bx - 80, 10, 900, C.grid, 0, R.Hc + M.ch + M.hov + 20, zc, "contour", root);
      box(80, 60, 60, C.black, bx - 60, R.Hc + 300, zc - 200, "contour", root);
      O.chkLamp = cyl(30, 60, C.dark, 0, hh + 60, zc, "contour", root);
      label("Contour check: profile, weight, ID", [0, hh, zc], [400, 500, 600]); }
    label("I/O chain conveyor (OUT)", [R.xc, R.Hc, -R.zs[1]], [700, 600, -400]);
    label("AGV transfer position (open below)", [0, R.Hc, R.zLast], [800, 700, 600]);
    // ---- fence
    const FH = 2000, fx0 = 1300;
    const fenceLine = (x1, z1, x2, z2, skip) => {
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.ceil(L / 1500);
      for (let i = 0; i < n; i++) {
        const a = i / n, b = (i + 1) / n, xa = x1 + (x2 - x1) * a, za = z1 + (z2 - z1) * a, xb = x1 + (x2 - x1) * b, zb = z1 + (z2 - z1) * b;
        const mx = (xa + xb) / 2, mz = (za + zb) / 2;
        if (skip && skip(mx, mz)) continue;
        const p = box(Math.hypot(xb - xa, zb - za), FH - 150, 8, C.fence, mx, 150 + (FH - 150) / 2, mz, "fence", root); p.rotation.y = -Math.atan2(zb - za, xb - xa);
        box(50, FH, 50, C.fpost, xa, FH / 2, za, "fence", root);
      }
    };
    for (const sg of [-1, 1]) {
      // side fence with an opening for the conveyor around x = 0
      fenceLine(fx0, sg * R.zF, R.openW / 2 + 100, sg * R.zF); fenceLine(-R.openW / 2 - 100, sg * R.zF, xEnd, sg * R.zF);
      box(R.openW + 200, FH - R.openH, 8, C.fence, 0, R.openH + (FH - R.openH) / 2, sg * R.zF, "fence", root);
      // light curtain + muting at the opening
      for (const sx of [1, -1]) { box(45, R.openH, 45, C.yellow, sx * (R.openW / 2 + 40), R.openH / 2, sg * R.zF, "curtain", root);
        for (const dz of [-400, 400]) box(40, 40, 40, C.black, sx * (R.openW / 2 + 40), R.Hc + 250, sg * (R.zF + dz), "curtain", root); }
      const pts = []; for (let y = 200; y < R.openH; y += 70) pts.push(-R.openW / 2 - 40, y, sg * R.zF, R.openW / 2 + 40, y, sg * R.zF);
      const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const ls = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35 })); root.add(ls); O["beams" + sg] = ls;
    }
    fenceLine(fx0, -R.zF, fx0, -900); fenceLine(fx0, 900, fx0, R.zF);
    box(30, FH, 1800, C.fence, fx0, FH / 2, 0, "door", root); box(60, 120, 60, C.red, fx0 + 40, 1100, 800, "door", root);
    label("Safety fence + door with guard locking", [fx0, FH, 0], [900, 400, 300]);
    label("Light curtain with muting", [R.openW / 2 + 40, R.openH, R.zF], [600, 500, 300]);
    // ---- cabinet + HMI
    box(1200, 2000, 500, C.cab, fx0 + 1200, 1000, 1700, "cabinet", root); box(400, 300, 80, C.dark, fx0 + 1200, 1400, 1430, "cabinet", root);
    label("Control cabinet + HMI", [fx0 + 1200, 2000, 1700], [300, 300, 300]);
    // floor marking for the AGV lanes
    for (const sg of [-1, 1]) for (const sx of [1, -1]) box(50, 2, 3500, C.yellow, sx * (M.cw / 2 + 300), 1, sg * (R.zLast + 2000), null, root);
    // ---- moving crate + AGV
    O.crate = crate(M, root, true);
    const AG = new THREE.Group(); root.add(AG); O.agv = AG;
    const lu = M.cl - 150;
    box(M.wu, M.hu - 60, lu, C.agv, 0, 30 + (M.hu - 60) / 2, 0, "agv", AG);
    for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(45, 40, C.black, sx * (M.wu / 2 - 50), 45, sz * (lu / 2 - 120), "agv", AG, "x", 18);
    const PL = new THREE.Group(); AG.add(PL); O.plate = PL;
    box(M.wu - 60, 16, lu - 100, C.agvDark, 0, -10, 0, "agv", PL);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(60, 400, 60, C.steel, sx * 150, -210, sz * 300, "agv", PL);
    label("Underride AGV", [M.wu / 2, M.hu, 0], [500, 400, 300], AG);
    fit("overview");
  }
  const VIEWS = {
    overview: (R) => [[7500, 6500, 7000], [-1200, 800, 0]],
    pd: (R) => [[2600, 2200, -1200], [0, 600, -R.zP]],
    fence: (R) => [[3200, 2000, -R.zF - 1200], [0, 700, -R.zF]],
    agv: (R) => [[2500, 1500, R.zLast + 2600], [0, 400, R.zLast]],
    top: (R) => [[-800, 15000, 1], [-800, 0, 0]],
  };
  function fit(v) { const R = O.R; if (!R) return; const [p, t] = VIEWS[v](R); nice.stop(); camera.position.set(...p); controls.target.set(...t); controls.update(); }
  function update(s) {
    if (!O.crane) return;
    O.crane.position.x = s.crane.x; O.carr.position.y = s.crane.y; O.fork.position.z = s.crane.fz;
    O.crate.position.set(s.crate.x, s.crate.y, s.crate.z);
    O.agv.position.set(s.agv.x, 0, s.agv.z); O.plate.position.y = s.agv.plate;
    O.chainDir = s.chain;
    for (const sg of [-1, 1]) O["beams" + sg].material.color.setHex(s.mute && s.lane === sg ? 0x2fa84f : 0xff3030);
    O.chkLamp.material = s.chk ? C.green : C.dark;
  }
  function frame(dt, vc) {
    if (O.chainDir) for (const t of chainTex) t.offset.y -= O.chainDir * dt * vc * 1000 / 19.05;
    if (selBox) selBox.update(); controls.update(); renderer.render(scene, camera);
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part);
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    selBox = new THREE.BoxHelper(hit.object, 0xff2a2a); scene.add(selBox); if (onPick) onPick(hit.object.userData.part);
  });
  return { build, update, fit, frame, canvas: renderer.domElement, setLabels(on) { labels.forEach((l) => { l.visible = on; }); }, onPick(fn) { onPick = fn; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
}

/* ------------------------------------------------------------------ 2D: plan / layout and signals */
function planSVG(R, M) {
  // turned: horizontal = z (across the aisle, lanes left / right), vertical = x (front fence at the top, racks below)
  const W = 760, xTop = 3000, xBot = -(BAY + NB * BAY + 700), zr = R.zLast + 2000;
  const sc = Math.min((W - 30) / (2 * zr), 470 / (xTop - xBot)), Hh = Math.round((xTop - xBot) * sc + 40);
  const SX = (z) => W / 2 + z * sc, SY = (x) => 20 + (xTop - x) * sc;
  const rect = (xa, za, xb, zb, cls, ex = "") => `<rect x="${SX(Math.min(za, zb))}" y="${SY(Math.max(xa, xb))}" width="${Math.abs(zb - za) * sc}" height="${Math.abs(xb - xa) * sc}" class="${cls}" ${ex}/>`;
  const T = (x, z, t, a = "c", st = "") => `<text x="${SX(z)}" y="${SY(x)}" class="apc-t ${a}" ${st}>${t}</text>`;
  let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Layout of the AS/RS front end">
    <defs><marker id="m3a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="currentColor"/></marker></defs>`;
  const rD = M.cl + 100, xr0 = -BAY, xr1 = -BAY - NB * BAY;
  for (const sg of [-1, 1]) g += rect(xr0, sg * (R.zP - rD / 2), xr1, sg * (R.zP + rD / 2), "mx-rack");
  g += rect(xr1, -R.aw / 2, 900, R.aw / 2, "mx-ghost") + T(xr1 + 300, 0, "aisle ↓");
  g += T((xr0 + xr1) / 2, R.zP, "rack") + T((xr0 + xr1) / 2, -R.zP, "rack");
  g += rect(-650, -350, 650, 350, "mx-craneS") + T(0, 0, "crane", "c", 'dy="4"');
  for (const sg of [-1, 1]) for (let i = 0; i < R.nPos; i++) {
    const zc = sg * R.zs[i];
    g += rect(-M.cw / 2, zc - M.cl / 2, M.cw / 2, zc + M.cl / 2, i === 0 ? "mx-pd" : i === R.nPos - 1 ? "mx-agvpos" : "mx-buf");
    const nm = i === 0 ? "P&D" : i === R.nPos - 1 ? "AGV transfer" : i === R.kOut ? (sg > 0 ? "contour check" : "buffer") : "buffer";
    g += T(-M.cw / 2 - 120, zc, nm, "c", 'dy="10"');
  }
  for (const sg of [-1, 1]) { g += rect(-M.wu / 2, sg * (R.zLast + 900), M.wu / 2, sg * (R.zLast + 750 + M.cl), "mx-agv"); g += T(M.wu / 2 + 150, sg * (R.zLast + 1300), sg > 0 ? "AGV (IN)" : "AGV (OUT)"); }
  const fx = 1300;
  g += `<path d="M${SX(-R.zF)},${SY(xr1 - 600)} V${SY(-R.openW / 2)} M${SX(-R.zF)},${SY(R.openW / 2)} V${SY(fx)} H${SX(R.zF)} V${SY(R.openW / 2)} M${SX(R.zF)},${SY(-R.openW / 2)} V${SY(xr1 - 600)}" class="mx-fence"/>`;
  for (const sg of [-1, 1]) g += `<line x1="${SX(sg * R.zF)}" y1="${SY(R.openW / 2)}" x2="${SX(sg * R.zF)}" y2="${SY(-R.openW / 2)}" class="apc-lc"/>` + T(R.openW / 2 + 250, sg * R.zF, "light curtain", "c", 'style="fill:var(--critical)"');
  g += `<line x1="${SX(-R.aw / 2)}" y1="${SY(-2600)}" x2="${SX(-R.zF)}" y2="${SY(-2600)}" class="mx-dim" marker-start="url(#m3a)" marker-end="url(#m3a)"/>` + T(-2450, -(R.aw / 2 + R.zF) / 2, `S = ${f(R.S, 0)} mm`);
  g += T(fx + 180, 0, "fence + door (guard locking)");
  g += rect(fx + 600, 1450, fx + 1300, 2650, "mx-st") + T(fx + 1450, 2050, "cabinet + HMI");
  return g + `</svg>`;
}
function sigSVG(ST, s, task) {
  const T = []; let acc = 0; ST.forEach((r) => { T.push(acc); acc += r[2]; });
  const tot = acc, at = (n) => T[ST.findIndex((r) => r[0] === n)], du = (n) => ST.find((r) => r[0] === n)[2];
  const out = task === "out", rows = [];
  if (out) rows.push(["WMS: transport order", "WMS", [[0, 0.8]]], ["Crane busy", "AS/RS", [[0.2, at("conv")]]], ["Fork in P&D (conveyor stop!)", "AS/RS", [[at("put") + du("put") * 0.45, at("put") + du("put") * 0.95]]],
    ["P1 P&D occupied", "conveyor", [[at("put") + du("put") * 0.7, at("conv") + du("conv") * 0.35]]], ["Conveyor running", "conveyor", [[at("conv"), at("agv")]]],
    ["Muting active", "safety", [[at("conv") + du("conv") * 0.35, at("conv") + du("conv") * 0.75]]], ["Load ready at transfer", "conveyor", [[at("agv"), at("agv") + du("agv") * 0.6]]],
    ["Fleet: AGV order (VDA 5050)", "fleet", [[at("agv") - 0.5, at("agv") + 0.5]]], ["AGV in position", "AGV", [[at("agv") + du("agv") * 0.3, at("agv") + du("agv") * 0.7]]],
    ["AGV lifting (BUSY)", "AGV", [[at("agv") + du("agv") * 0.32, at("agv") + du("agv") * 0.68]]], ["Transfer complete → WMS", "AGV", [[at("agv") + du("agv") * 0.7, at("agv") + du("agv") * 0.8]]]);
  else rows.push(["Fleet: AGV order (VDA 5050)", "fleet", [[0, 0.8]]], ["IN position free", "conveyor", [[0, at("agv") + du("agv") * 0.55]]], ["AGV in position", "AGV", [[du("agv") * 0.3, du("agv") * 0.7]]],
    ["AGV lowering (BUSY)", "AGV", [[du("agv") * 0.32, du("agv") * 0.68]]], ["Transfer complete", "AGV", [[du("agv") * 0.7, du("agv") * 0.8]]], ["Conveyor running", "conveyor", [[at("chk"), at("store")]]],
    ["Contour OK + ID read", "conveyor", [[at("chk") + du("chk") * 0.6, at("store")]]], ["WMS: storage location", "WMS", [[at("chk") + du("chk") * 0.8, at("chk") + du("chk") + 0.6]]],
    ["Muting active", "safety", [[at("conv") + du("conv") * 0.2, at("conv") + du("conv") * 0.7]]], ["P1 P&D occupied", "conveyor", [[at("store"), at("store") + du("store") * 0.3]]],
    ["Fork in P&D (conveyor stop!)", "AS/RS", [[at("store") + du("store") * 0.05, at("store") + du("store") * 0.45]]], ["Crane busy", "AS/RS", [[at("store"), tot]]]);
  const W = 760, rh = 19, lw = 200, H = rows.length * rh + 34, sx = (W - lw - 14) / tot;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Signals between WMS, AS/RS, conveyor, fleet manager and AGV">`;
  ST.forEach((r, i) => { g += `<rect x="${lw + T[i] * sx}" y="0" width="${r[2] * sx}" height="${H - 18}" class="${i % 2 ? "mx-band" : "mx-band2"}"/><text x="${lw + (T[i] + r[2] / 2) * sx}" y="${H - 5}" class="apc-t c">${i + 1}</text>`; });
  const col = { WMS: "#7a4fd0", "AS/RS": "#c98a0c", conveyor: "#3c6e9e", safety: "#d03b3b", fleet: "#2fa84f", AGV: "#2a78d6" };
  rows.forEach(([n, who, on], i) => {
    const y = i * rh + 6, hi = y + 3, lo = y + rh - 5;
    let d = `M${lw},${lo}`; for (const [a, b] of on) d += ` H${lw + Math.max(0, a) * sx} V${hi} H${lw + Math.min(tot, b) * sx} V${lo}`; d += ` H${W - 14}`;
    g += `<text x="4" y="${lo}" class="apc-t">${n}</text><text x="${lw - 6}" y="${lo}" class="apc-t r" style="opacity:.6">${who}</text><path d="${d}" fill="none" stroke="${col[who]}" stroke-width="2"/>`;
  });
  g += `<line x1="${lw + s.t * sx}" y1="0" x2="${lw + s.t * sx}" y2="${H - 18}" class="apc-head"/>`;
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const box3 = $("mxItem3");
if (box3) {
  box3.innerHTML = `
    <div class="kpis" id="axKpis"></div>
    <div class="card">
      <div class="card-head"><h2>3D – AS/RS front end, I/O conveyors, fence, AGV transfer</h2><span class="sub">drag = turn · right-drag = move · wheel = zoom at the mouse · double-click = new turning point · click a part for its data</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="axPlay">▶ Play</button><input type="range" id="axScrub" min="0" max="1000" value="0" aria-label="Time"><span id="axStep" class="small"></span></div>
      <div class="apc3d-bar">
        <span class="tb-label">Flow</span><div class="seg" role="group" aria-label="Flow">
          <button class="seg-btn active" data-axtask="out">OUT: AS/RS → AGV</button><button class="seg-btn" data-axtask="in">IN: AGV → AS/RS</button></div>
        <span class="tb-label">View</span><div class="seg" role="group" aria-label="View">
          <button class="seg-btn" data-axview="overview">Overview</button><button class="seg-btn" data-axview="pd">Crane P&amp;D</button>
          <button class="seg-btn" data-axview="fence">Fence opening</button><button class="seg-btn" data-axview="agv">AGV transfer</button><button class="seg-btn" data-axview="top">Top</button></div>
        <label class="tb-check"><input type="checkbox" id="axLbl" checked> labels</label>
      </div>
      <div class="apc3d-grid"><div class="apc3d" id="ax3d"></div><div class="apc3d-info" id="ax3dInfo"></div></div>
      <div class="apc3d-legend small muted"><span><i style="background:#f2c200"></i>stacker crane</span><span><i style="background:#e07a1f"></i>rack</span><span><i style="background:#3c6e9e"></i>I/O conveyor (MAKE)</span>
        <span><i style="background:#6b7480"></i>fence</span><span><i style="background:#19a7c8"></i>contour light grids</span><span><i style="background:#2fa84f"></i>muting active / check OK</span></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Steps</h2></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="axSteps"></tbody></table></div>
        <h3 style="margin:14px 0 6px;font-size:14px">Messages (examples)</h3><div class="table-wrap"><table class="apc-bom" id="axMsg"></table></div></div>
      <div class="card"><div class="card-head"><h2>Signals – WMS, AS/RS, conveyor, safety, fleet manager, AGV</h2></div><div id="axSig"></div>
        <p class="hint">Hard rule: the conveyor at the P&D position must not move while the crane fork is in it, and the crane may not put a crate on an occupied position.
          These two interlocks are wired PLC-to-PLC (PROFINET / safe I/O), not over the WMS.</p></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Layout (plan view)</h2><span class="sub">fence distance = safety distance S</span></div><div id="axPlan"></div></div>
      <div class="card"><div class="card-head"><h2>Real environment requirements</h2><span class="sub">what the building and the suppliers must provide</span></div><div id="axEnv"></div></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="axReset">Example values</button></div><div id="axInputs"></div></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="axChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="axCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Bill of materials</h2><span class="sub">MAKE = you manufacture · BUY = catalogue / supplier</span></div><div class="table-wrap"><table id="axBom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – responsibilities, manufacturing, installation, acceptance, maintenance</h2></div><div id="axGuide" class="mx-guide"></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("mech3State") || "{}")); } catch (e) { /* private window */ }
  let R = calc(M), task = "out", ST = steps(R, M, task), T = 0, playing = false, last = performance.now(), view = null, geo = "";
  const tot = () => ST.reduce((s, r) => s + r[2], 0), pane = $("tab-mech"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };

  function inputs() {
    $("axInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Crane capacity", R.util <= 0.7, R.util <= 0.85, `${f(R.util * 100, 0)} % busy (${M.qin} in + ${M.qout} out per hour, double cycle ${M.tdc} s)`);
    add("Crate weight ≤ rated load", M.mcr <= M.mrat, M.mcr <= M.mrat * 1.05, `${M.mcr} kg ≤ ${M.mrat} kg (the contour check weighs every crate)`);
    add("Crane fork fits between the chains", R.clear >= R.needFork, R.clear >= M.wf + 20, `clear ${R.clear} mm, fork ${M.wf} + 2 × 30 = ${R.needFork}`);
    add("AGV fits between the side frames", R.clear >= R.needAGV, R.clear >= M.wu + 2 * R.cap3, `clear ${R.clear} mm, needed ${f(R.needAGV, 0)} mm`);
    add("Side guide flare catches the AGV", M.gfl3 >= R.cap3 + 5, M.gfl3 >= R.cap3, `flare ${M.gfl3} mm ≥ ±${f(R.cap3, 1)} mm`);
    add("Fence at the safety distance", true, true, `S = 1600 × ${f(R.T, 2)} + 850 = ${f(R.S, 0)} mm → fence at ${R.zF} mm, ${R.kOut} position(s) inside`);
    add("No stop position in the fence opening", R.bridge >= 200, R.bridge >= 100, `bridge section ${f(R.bridge, 0)} mm through the opening – a waiting crate never blocks the light curtain`);
    add("Buffer: AGV may be late (OUT)", R.lateOut >= 300, R.lateOut >= 120, `${f(R.lateOut / 60, 1)} min before the crane has to wait`);
    add("Buffer: crane may be busy (IN)", R.lateIn >= 300, R.lateIn >= 120, `${f(R.lateIn / 60, 1)} min before an AGV has to wait`);
    add("Conveyor drive", true, true, `${R.motor} kW per position (${f(R.P, 0)} W needed)`);
    add("Crane P&D accuracy vs fork clearance", M.hpd <= (R.clear - M.wf) / 2 - 20, M.hpd <= (R.clear - M.wf) / 2, `±${M.hpd} mm, fork clearance ±${(R.clear - M.wf) / 2} mm`);
    add("Fence opening fits the crate", R.openW >= M.cw + 150, true, `${R.openW} × ${R.openH} mm for ${M.cw} × ${M.ch} mm`);
    return c;
  }
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  function formulas() {
    $("axCalc").innerHTML = [
      blk("1 · Safety distance (ISO 13855)", [`T = light curtain ${M.tlc} s + crane stop ${M.tst} s = ${f(R.T, 2)} s`, `S = K·T + C = 1600·${f(R.T, 2)} + 850 = <b>${f(R.S, 0)} mm</b>`,
        `Fence = aisle edge ${R.aw / 2} + S → <b>${R.zF} mm</b> from the aisle centre`, `→ ${R.kOut} position(s) inside, bridge ${f(R.bridge, 0)} mm, ${R.nPos} positions per lane`],
        "C = 850 mm: a person can reach through or over the beams. Faster stopping crane axes (smaller T) = shorter conveyors."),
      blk("2 · Crane capacity", [`Double cycles   min(${M.qin}, ${M.qout}) × ${M.tdc} s`, `Single cycles   |${M.qin} − ${M.qout}| × 0.6 × ${M.tdc} s`, `Busy            ${f(R.tCrane, 0)} s / 3600 s = <b>${f(R.util * 100, 0)} %</b>`]),
      blk("3 · Conveyor", [`Position pitch  ${M.cl} + ${M.pgap} = ${R.pp} mm`, `Time / position t = p/v + v/a = <b>${f(R.tpos, 1)} s</b>`, `Force           F = m·(μ·g + a) = ${M.mcr}·(${M.muc}·9.81 + ${M.ac}) = ${f(R.F, 0)} N`,
        `Power           P = F·v/η = ${f(R.P, 0)} W → <b>${R.motor} kW</b>`, `Lane length     ≈ ${f(R.laneLen / 1000, 1)} m`]),
      blk("4 · Buffers", [`OUT: (${R.nPos} − 1) positions × 3600/${M.qout} = <b>${f(R.lateOut / 60, 1)} min</b> AGV delay allowed`, `IN:  (${R.nPos} − 1) × 3600/${M.qin} = <b>${f(R.lateIn / 60, 1)} min</b> crane delay allowed`]),
      blk("5 · AGV transfer", [`Chain top       AGV height + 20 = <b>${R.Hc} mm</b>`, `AGV error       ${M.nav3} + ${M.cl / 2}·sin ${M.yaw3}° = ${f(R.cap3, 1)} mm`, `Clear width     2·(${R.xc} − 20) = ${R.clear} ≥ ${f(R.needAGV, 0)}`,
        `Lift stroke     ≥ ${f(R.sReq, 0)} mm, one transfer ≈ ${f(R.tAgv, 0)} s`, `AGV visits      ${R.agvPerH} per hour at this front end`]),
    ].join("");
  }
  function envHTML() {
    const rows = [
      ["Floor (crane)", "rail strip flat ±2 mm over the length, no joints under the rail, concrete ≥ C25/30, load per wheel from the supplier", "crane rail, EN 15620 / supplier"],
      ["Floor (AGV + conveyor)", "flatness ±2 mm over 2 m in the AGV lanes, no steps > 3 mm, slope < 1 %", "DIN 15185 / AGV supplier"],
      ["Building height", `AS/RS ${"9.5"} m + 0.5 m above the crane; sprinkler pipes outside the crane envelope`, "twin AS/RS height"],
      ["Fire protection", "in-rack sprinklers as required by the insurer; fire door / shutter where the conveyor crosses a fire wall", "local code, FM / VdS"],
      ["Temperature", "+5 … +40 °C; castings cooled below 50 °C before storing (sensors, plastics in the crates)", ""],
      ["Dust / dirt", "foundry sand: chain conveyors (not rollers), wipers on the crane rail, cleaning plan for sensors and light grids", ""],
      ["Lighting", "≥ 200 lx at the conveyors, ≥ 300 lx at the HMI, no glare into the light curtains", "EN 12464-1"],
      ["Power", "400 V 3~ 50 Hz for crane + conveyors, separate feeder, main switch lockable", ""],
      ["Network", "Ethernet WMS ↔ AS/RS PLC; Wi-Fi with seamless roaming over the whole AGV route (VDA 5050 over MQTT)", "VDA 5050"],
      ["Safety", "risk assessment, safety PLC PL d (ISO 13849), CE marking of the complete system (the integrator is responsible)", "EN 528, EN 619, ISO 3691-4, ISO 13855/13857, IEC 62046"],
      ["People", "walkways ≥ 800 mm outside the fence, AGV lanes marked, no storage in the AGV lanes", ""],
    ];
    $("axEnv").innerHTML = `<div class="table-wrap"><table class="apc-bom"><thead><tr><th>Topic</th><th>Requirement</th><th>Reference</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="muted">${esc(c)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function msgHTML() {
    const out = task === "out";
    const rows = out ? [
      ["ERP/MES → WMS", "TO 000123: RETRIEVE CC20-CAST (1 crate) → destination OUT-1, then cell HMC-01"],
      ["WMS → AS/RS PLC", "telegram: job 4711, source A-03-02-L (aisle 1, bay 3, level 2, left), target OUT-1-P1"],
      ["AS/RS PLC → WMS", "job 4711 done, crate C-0457 at OUT-1-P1"],
      ["Conveyor PLC → fleet manager", `station OUT-1-T (transfer) LOAD_READY, crate C-0457`],
      ["Fleet manager → AGV (VDA 5050 order)", `{"orderId":"o-981","nodes":[…,{"nodeId":"OUT-1-T","actions":[{"actionType":"pick","blockingType":"HARD"}]},{"nodeId":"HMC-01-STAND","actions":[{"actionType":"drop"}]}]}`],
      ["AGV ↔ conveyor (E84 / via fleet)", "VALID → U_REQ → TR_REQ → READY → BUSY → COMPT (conveyor keeps the chains stopped)"]] : [
      ["Fleet manager → AGV", `VDA 5050 order: drive to IN-1-T, action "drop"`],
      ["AGV ↔ conveyor", "VALID → L_REQ (position free) → TR_REQ → READY → BUSY (lowering) → COMPT"],
      ["Conveyor PLC → WMS", "crate at IN-1-C: contour OK, weight 203 kg, ID C-0457 (RFID)"],
      ["WMS → AS/RS PLC", "job 4712: STORE C-0457 from IN-1-P1 to A-05-01-R"],
      ["AS/RS PLC → WMS", "job 4712 done – stock booked (ERP: +1 crate CC20-CAST)"],
      ["If NOK", "contour / weight / ID fault → crate goes back to IN-1-T, HMI shows the reason, WMS calls an AGV to take it to the rework area"]];
    $("axMsg").innerHTML = `<thead><tr><th>From → to</th><th>Content</th></tr></thead><tbody>${rows.map(([a, b]) => `<tr><td><b>${esc(a)}</b></td><td><code style="white-space:normal">${esc(b)}</code></td></tr>`).join("")}</tbody>`;
  }
  function bom() {
    const n = 2 * R.nPos;
    const rows = [
      ["Stacker crane + racks + rails", "BUY", 1, `AS/RS supplier: rated ${M.mrat} kg, double cycle ≤ ${M.tdc} s, fork ${M.wf} mm, P&D ±${M.hpd} mm`, "incl. EN 528 safety"],
      ["I/O conveyor section (side frames, legs, floor ties)", "MAKE", n, `${R.pp} mm, chain top ${R.Hc} mm, frames at ±${R.xc} mm, clear ${R.clear} mm`, `${R.nPos} per lane × 2 lanes`],
      ["Roller chain 3/4\" + UHMW-PE guides + sprockets", "BUY", 2 * n, `${f((R.pp * 2 + 300) / 1000, 1)} m per strand`, "2 strands per section"],
      ["Gear motor with brake + inverter", "BUY", n, `${R.motor} kW`, "1 per position (accumulation)"],
      ["Position sensors", "BUY", 2 * n, "retro-reflective, IP67", ""],
      ["Chain guards / nip-point covers", "MAKE", n, "sheet steel 2 mm", "EN 619"],
      ["Side guides + V-flare at the transfer positions", "MAKE", 2, `flare ${M.gfl3} mm`, "UHMW-PE strips"],
      ["End stop with PU buffer", "MAKE", 2, "at the AGV transfer positions", ""],
      ["Contour check (2 light grids, load cells, barcode/RFID)", "BUY", 1, `overhang ±${M.ovh} mm, height +${M.hov} mm, ≤ ${M.mrat} kg`, "IN lane"],
      ["Safety light curtain + 4 muting sensors", "BUY", 2, `opening ${R.openW} × ${R.openH} mm`, "1 per lane"],
      ["Safety fence 2 m + posts", "BUY", "≈ " + f((2 * (NB * BAY + 2000) + 2 * R.zF) / 1000, 0) + " m", "mesh panels, ISO 14120", ""],
      ["Door with guard locking + LOTO", "BUY", 1, "ISO 14119", ""],
      ["Control cabinet (safety PLC, drives) + HMI", "MAKE / BUY", 1, "PROFINET to the crane, Ethernet to the WMS, fleet interface", ""],
      ["E84 optical I/O at the transfer positions (or VDA 5050 via fleet)", "BUY", 2, "", "agree with the AGV supplier"],
      ["Floor marking + anchors", "BUY", 1, "AGV lanes, walkways", ""],
    ];
    $("axBom").innerHTML = `<thead><tr><th>#</th><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r[0])}</td><td><span class="apc-mb ${String(r[1]).split(" ")[0]}">${esc(r[1])}</span></td><td>${r[2]}</td><td>${esc(r[3])}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}</tbody>`;
  }
  function guide() {
    $("axGuide").innerHTML = `
      <h3>1 · Who is responsible for what (write it into the contracts)</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Item</th><th>AS/RS supplier</th><th>Conveyor (you / integrator)</th><th>AGV supplier</th></tr></thead><tbody>
        <tr><td>P&D position</td><td>teach the fork ±${M.hpd} mm, interlock "fork in P&D"</td><td>chains + frames with ${R.clear} mm clear, "P&D occupied" signal</td><td>–</td></tr>
        <tr><td>Transfer position</td><td>–</td><td>side guides, end stop, "load ready / position free"</td><td>stop ±${M.nav3} mm, lift ≥ ${f(R.sReq, 0)} mm, E84 / VDA 5050 actions</td></tr>
        <tr><td>Safety</td><td>crane, door locking, EN 528</td><td>fence, light curtain + muting, safety PLC, EN 619</td><td>scanners, ISO 3691-4, speed in the lanes</td></tr>
        <tr><td>Software</td><td>WMS ↔ PLC telegrams</td><td>conveyor PLC, contour check, HMI</td><td>fleet manager ↔ WMS (VDA 5050)</td></tr>
        <tr><td>CE marking</td><td colspan="3">ONE responsible integrator for the complete system (crane + conveyor + AGV interface) – decide this before ordering.</td></tr></tbody></table></div>
      <h3>2 · Make the conveyors</h3>
      <ol class="apc-list">
        <li>Side frames: S355 rectangular tube 120 × 40, weld in a jig; chain-guide seats machined or shimmed to ±0.5 mm height over the section.</li>
        <li>Connect the 2 side frames ONLY with floor ties (≤ 100 mm high) – the fork and the AGV need the middle free. At the AGV transfer position: no floor tie, each frame anchored separately.</li>
        <li>Chains 3/4" on UHMW-PE guide strips, tensioner on every section, chain guards on the return strand and at every sprocket (no nip points reachable).</li>
        <li>One gear motor + inverter per position; 2 sensors per position (slow-down, stop).</li>
        <li>Paint: frames RAL 5010, guards yellow; label every position (IN-1-P1, … ) like in the WMS.</li>
      </ol>
      <h3>3 · Install</h3>
      <ol class="apc-list">
        <li>Floor survey before the rack is erected; the AS/RS supplier sets out the aisle axis – take all conveyor positions from it.</li>
        <li>Set the P&D conveyor sections on the crane axis ±2 mm, chain top ${R.Hc} mm ±1; then the other sections in line ±2 mm.</li>
        <li>Fence: side fence at ${R.zF} mm from the aisle axis (safety distance), gap to the floor ≤ 200 mm; light curtains centred in the openings; muting sensors as per the muting plan.</li>
        <li>Cabinet outside the fence; cables in trays, no cables in the AGV lanes.</li>
        <li>Teach: crane P&D positions, AGV stop points at the transfer positions (with an offset test).</li>
      </ol>
      <h3>4 · Acceptance tests (FAT at the supplier, SAT on site)</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Accept</th></tr></thead><tbody>
        <tr><td>P&D interlock</td><td>try to run the P&D chains with the fork in; try to put a crate on an occupied P&D</td><td>blocked every time</td></tr>
        <tr><td>Contour check</td><td>test crates: +${M.ovh + 5} mm offset, part ${M.hov + 10} mm too high, 10 % overweight, no label</td><td>all rejected, correct reason on the HMI</td></tr>
        <tr><td>Muting</td><td>crate passes; a person / test rod at the opening with and without crate; muting time-out</td><td>crate passes, person stops the system</td></tr>
        <tr><td>Door</td><td>open request while the crane moves</td><td>door stays locked until the crane is safe</td></tr>
        <tr><td>AGV transfer</td><td>AGV stopped ±${M.nav3 + 2} mm off, 20 transfers per lane</td><td>no fault</td></tr>
        <tr><td>Throughput</td><td>${M.qin} in + ${M.qout} out per hour for 4 h (mixed with rack moves)</td><td>no waiting AGV &gt; 2 min</td></tr>
        <tr><td>Communication loss</td><td>Wi-Fi off during a transfer; WMS link off</td><td>safe stop, recovery without manual handling</td></tr>
      </tbody></table></div>
      <h3>5 · Maintenance</h3>
      <ul class="apc-list"><li>Weekly: clean light grids, sensors and light curtains (foundry dust); check the chain guards.</li>
        <li>Monthly: chain tension + lubrication, side guide strips, end-stop buffers, muting function test.</li>
        <li>Yearly: crane inspection by the supplier (EN 528), rack inspection (EN 15635), safety functions validation.</li></ul>`;
  }
  function info(key) {
    const el = $("ax3dInfo"), p = key && partInfo(key, R, M);
    if (!p) {
      const rows = [["Chain top", `${R.Hc} mm`], ["Positions per lane", `${R.nPos} (${R.kOut} inside)`], ["Safety distance S", `${f(R.S, 0)} mm`], ["Fence from aisle axis", `${R.zF} mm`],
        ["Crane busy", `${f(R.util * 100, 0)} %`], ["Clear width", `${R.clear} mm`], ["Conveyor", `${M.vc} m/s, ${R.motor} kW/pos.`], ["AGV delay allowed", `${f(R.lateOut / 60, 1)} min`]];
      el.innerHTML = `<div class="apc-pi-h"><b>AS/RS ↔ AGV – main values</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
        <p class="hint">Click a part in the 3D view for its function, specification and notes.</p>`; return;
    }
    const [n, mb, matl, fn, spec, mfg] = p;
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b>${mb ? `<span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span>` : ""}</div>
      ${fn ? `<p>${esc(fn)}</p>` : ""}${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="axBack">◀ main values</button>`;
    $("axBack").onclick = () => info(null);
  }
  function render() {
    R = calc(M); ST = steps(R, M, task); T = Math.min(T, tot());
    const ch = checks();
    $("axKpis").innerHTML = [["Safety distance", f(R.S, 0) + " mm", `fence at ${R.zF} mm`], ["Positions / lane", String(R.nPos), `${R.kOut} inside the fence`], ["Crane busy", f(R.util * 100, 0) + " %", `${M.qin + M.qout} crates/h`],
      ["AGV may be late", f(R.lateOut / 60, 1) + " min", "OUT buffer"], ["Chain top", R.Hc + " mm", `clear ${R.clear} mm`], ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("axChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); envHTML(); bom(); guide(); msgHTML(); $("axPlan").innerHTML = planSVG(R, M);
    const k = JSON.stringify(M);
    if (view && k !== geo) { geo = k; view.build(R, M); view.setLabels($("axLbl").checked); info(null); }
    draw();
  }
  function draw() {
    const s = stateAt(T, ST, R, M, task);
    if (view) view.update(s);
    $("axStep").innerHTML = `Step ${s.k + 1}/${ST.length}: <b>${esc(ST[s.k][1])}</b> <span class="muted">${f(T, 1)} / ${f(tot(), 1)} s</span>`;
    $("axScrub").value = Math.round(T / tot() * 1000); $("axPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("axSteps").innerHTML = ST.map((r, i) => `<tr class="${i === s.k ? "on" : ""}"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
    $("axSig").innerHTML = sigSVG(ST, s, task);
  }
  function init() {
    if (view) { view.resize(); return; }
    try { view = create3D($("ax3d")); } catch (e) { $("ax3d").innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe($("ax3d")); view.resize(); view.onPick(info);
    geo = JSON.stringify(M); view.build(R, M); info(null); draw();
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active") || box3.hidden) return;
      if (playing) { T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); }
      view.frame(playing ? dt : 0, M.vc); };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("axInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = M[k]; return; }
    M[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("mech3State", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("axReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("mech3State"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("axPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("axScrub").addEventListener("input", (e) => { playing = false; T = tot() * e.target.value / 1000; draw(); });
  box3.querySelectorAll("[data-axtask]").forEach((b) => b.addEventListener("click", () => {
    box3.querySelectorAll("[data-axtask]").forEach((x) => x.classList.toggle("active", x === b)); task = b.dataset.axtask; T = 0; playing = false; ST = steps(R, M, task); msgHTML(); draw(); }));
  box3.querySelectorAll("[data-axview]").forEach((b) => b.addEventListener("click", () => view && view.fit(b.dataset.axview)));
  $("axLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  window.mech3 = { show() { init(); } };
  const q = new URLSearchParams(location.search);
  if (q.get("axtask")) setTimeout(() => { const b = box3.querySelector(`[data-axtask="${q.get("axtask")}"]`); if (b) b.click(); }, 400);
  if (q.get("axview")) setTimeout(() => { view && view.fit(q.get("axview")); }, 700);
  if (q.get("axt")) setTimeout(() => { T = Math.min(tot(), parseFloat(q.get("axt")) || 0); draw(); }, 750);
  if (q.get("axpart")) setTimeout(() => info(q.get("axpart")), 800);
}
