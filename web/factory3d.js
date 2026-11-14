/*
 * 3D view of the digital twin (Three.js r160, loaded locally from web/vendor).
 *
 * Everything you see is driven by live twin data:
 *  - andon light tower on every machine = machine state (green run, amber wait, red down, blue maintenance)
 *  - spindles / chucks / grinding wheels / robot / flywheels move only while the machine is RUNNING
 *  - parts on each conveyor = real buffer content
 *  - test bench screens show the measured air flow (FAD) and pressure
 *  - crates in the warehouse = finished compressors
 * Layout (positions, zones, hall size) comes from config/factory.json.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { attachGLB, animGLB, glbEnabled } from "./glbmodel.js";   // CAD models (GLB) - docs/55

const STATE_HEX = {
  RUNNING: 0x0ca30c, SETUP: 0x1590a8, STARVED: 0xfab219, BLOCKED: 0xec835a, DOWN: 0xd03b3b,
  MAINTENANCE: 0x6250d6, STOPPED: 0x898781, OFFLINE: 0x5a5a5a,
};
// product models (FMS): colour tag + size of the parts, filled from the config
const PROD = {};
const modelMats = {};
function modelMat(v) {
  if (!modelMats[v]) modelMats[v] = new THREE.MeshStandardMaterial({ color: (PROD[v] && PROD[v].color) || "#898781", roughness: 0.5, emissive: (PROD[v] && PROD[v].color) || "#000000", emissiveIntensity: 0.25 });
  return modelMats[v];
}
// small colour plate under a part (and the part a bit bigger / smaller per model)
function tagModel(obj, v, base = 1) {
  const u = obj.userData;
  if (u.model === (v || null)) return;
  u.model = v || null;
  obj.scale.setScalar(base * ((v && PROD[v] && PROD[v].size) || 1));
  if (!v) { if (u.vtag) u.vtag.visible = false; return; }
  if (!u.vtag) {
    u.vtag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.36), modelMat(v));
    u.vtag.position.y = 0.012;
    obj.add(u.vtag);
  }
  u.vtag.material = modelMat(v);
  u.vtag.visible = true;
}
const HEALTH_HEX = { good: 0x0ca30c, warning: 0xfab219, critical: 0xd03b3b };
const FOOT = { hmc: 2.4, vmc: 1.7, hone: 1.3, lathe: 2.6, grinder: 2.4, washer: 2.6, assembly: 2.1,
               robot: 2.4, testbench: 1.9, paint: 4.6, final: 2.2, pack: 1.9, loadst: 1.4 };
const AGV_LIGHT = { TO_PICKUP: 0x0ca30c, TO_DROP: 0x0ca30c, TO_PARK: 0x0ca30c, TO_CHARGE: 0x2a78d6,
                    CHARGING: 0x2a78d6, WAIT_CRANE: 0xfab219, LOADING: 0xfab219, UNLOADING: 0xfab219, IDLE: 0xcfd6dd };
const LOAD_COLOR = { crankcase: 0x6e5240, cylinder: 0x7d6650, crankshaft: 0x8c949c, crate: 0xb98a52, pump: 0x5c6166 };
const CONV_H = 0.8;

/* ------------------------------------------------------------ materials */
const std = (color, roughness = 0.55, metalness = 0.15, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const MAT = {
  white: std(0xe4e7ea), grey: std(0x9aa1a8, 0.5, 0.3), dark: std(0x2b3036, 0.6, 0.3),
  blue: std(0x1f5fa8, 0.45, 0.2), steel: std(0xb9c0c7, 0.35, 0.75), steelDark: std(0x5d646b, 0.4, 0.7),
  castIron: std(0x5c6166, 0.75, 0.45), rawCast: std(0x6e5240, 0.9, 0.2), fin: std(0x7c838a, 0.5, 0.6),
  red: std(0xb3262e, 0.45, 0.25), orange: std(0xf07c00, 0.45, 0.2), yellow: std(0xf2b705, 0.5, 0.2),
  motor: std(0x3c5a78, 0.5, 0.4), wood: std(0xb98a52, 0.85, 0.0), woodDark: std(0x8a6236, 0.85, 0.0),
  glass: std(0x9ec5f4, 0.1, 0.1, { transparent: true, opacity: 0.28, depthWrite: false }),
  fence: std(0xf2b705, 0.6, 0.2, { transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }),
  wrap: std(0xf4f6f8, 0.3, 0.0, { transparent: true, opacity: 0.55 }),
  rubber: std(0x1d1f22, 0.9, 0.0), wall: std(0xc7ced5, 0.8, 0.1), column: std(0x47617a, 0.6, 0.4),
  skin: std(0xd6a77a, 0.8, 0.0), vest: std(0xff7a1a, 0.7, 0.0), pants: std(0x283a52, 0.8, 0.0),
  screen: std(0x10202c, 0.3, 0.1, { emissive: 0x2a78d6, emissiveIntensity: 0.35 }),
  light: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  glow: std(0xffb070, 0.6, 0, { emissive: 0xff8a3d, emissiveIntensity: 0.6 }),
};

/* ---------------------------------------------------------------- helpers */
function mesh(geo, material, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d, mt, x, y, z, p, sh) => mesh(new THREE.BoxGeometry(w, h, d), mt, x, y, z, p, sh);
const cyl = (rt, rb, h, mt, x, y, z, p, seg = 20, sh) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mt, x, y, z, p, sh);
const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; };

/* -------------------------------------------------------------- products */
function makePump(s = 1, body = MAT.castIron) {
  const g = new THREE.Group();
  box(0.5 * s, 0.36 * s, 0.42 * s, body, 0, 0.18 * s, 0, g);
  [-1, 1].forEach((side) => {
    const cg = group(g, side * 0.1 * s, 0.34 * s, 0);
    cg.rotation.z = -side * Math.PI / 4;               // 90° V angle
    cyl(0.11 * s, 0.11 * s, 0.34 * s, body, 0, 0.17 * s, 0, cg, 16);
    for (let i = 0; i < 5; i++) cyl(0.155 * s, 0.155 * s, 0.018 * s, MAT.fin, 0, (0.07 + i * 0.06) * s, 0, cg, 16, false);
    box(0.3 * s, 0.07 * s, 0.3 * s, MAT.dark, 0, 0.38 * s, 0, cg);
  });
  const fw = group(g, 0, 0.2 * s, 0.25 * s);
  const disk = cyl(0.27 * s, 0.27 * s, 0.05 * s, MAT.steelDark, 0, 0, 0, fw, 24);
  disk.rotation.x = Math.PI / 2;
  box(0.48 * s, 0.05 * s, 0.012 * s, MAT.yellow, 0, 0, 0.03 * s, fw, false);
  return { group: g, flywheel: fw };
}
function makeCompressor(s = 1) {
  const g = new THREE.Group();
  const tank = mesh(new THREE.CapsuleGeometry(0.3 * s, 1.0 * s, 8, 20), MAT.red, 0, 0.42 * s, 0, g);
  tank.rotation.z = Math.PI / 2;
  [-0.45, 0.45].forEach((x) => box(0.08 * s, 0.14 * s, 0.5 * s, MAT.dark, x * s, 0.07 * s, 0, g));
  box(1.0 * s, 0.03 * s, 0.5 * s, MAT.dark, 0, 0.74 * s, 0, g);
  const p = makePump(0.85 * s, MAT.castIron);
  p.group.position.set(-0.22 * s, 0.755 * s, -0.03 * s); g.add(p.group);
  const mo = cyl(0.14 * s, 0.14 * s, 0.42 * s, MAT.motor, 0.32 * s, 0.9 * s, -0.02 * s, g, 18);
  mo.rotation.x = Math.PI / 2;
  box(0.78 * s, 0.34 * s, 0.05 * s, MAT.red, 0.05 * s, 0.93 * s, 0.25 * s, g);
  cyl(0.05 * s, 0.05 * s, 0.03 * s, MAT.white, 0.55 * s, 0.6 * s, 0.2 * s, g, 12).rotation.x = Math.PI / 2;
  return { group: g, flywheel: p.flywheel };
}
function makePart(type) {
  const g = new THREE.Group();
  switch (type) {
    case "crankcase":
      box(0.46, 0.3, 0.38, MAT.castIron, 0, 0.15, 0, g, false);
      cyl(0.09, 0.09, 0.4, MAT.steel, 0, 0.17, 0, g, 12, false).rotation.x = Math.PI / 2;
      break;
    case "cylinder":
      cyl(0.09, 0.09, 0.28, MAT.castIron, 0, 0.14, 0, g, 12, false);
      for (let i = 0; i < 3; i++) cyl(0.13, 0.13, 0.02, MAT.fin, 0, 0.06 + i * 0.08, 0, g, 12, false);
      break;
    case "crankshaft":
      cyl(0.035, 0.035, 0.55, MAT.steel, 0, 0.08, 0, g, 10, false).rotation.z = Math.PI / 2;
      box(0.06, 0.16, 0.12, MAT.steelDark, -0.08, 0.08, 0, g, false);
      box(0.06, 0.16, 0.12, MAT.steelDark, 0.08, 0.08, 0, g, false);
      break;
    case "pump": g.add(makePump(0.75).group); break;
    case "compressor": g.add(makeCompressor(0.62).group); break;
    case "tank": mesh(new THREE.CapsuleGeometry(0.3, 1.0, 6, 16), MAT.red, 0, 0.3, 0, g, false).rotation.z = Math.PI / 2; break;
    case "motor": cyl(0.15, 0.15, 0.42, MAT.motor, 0, 0.15, 0, g, 14, false).rotation.x = Math.PI / 2; break;
    case "crate":
      box(1.3, 1.05, 0.75, MAT.wood, 0, 0.6, 0, g, false);
      box(1.36, 0.08, 0.81, MAT.woodDark, 0, 0.05, 0, g, false);
      box(1.36, 0.06, 0.81, MAT.woodDark, 0, 1.12, 0, g, false);
      break;
    default: box(0.3, 0.3, 0.3, MAT.grey, 0, 0.15, 0, g, false);
  }
  return g;
}
function makeOperator(parent, x, z, rotY = 0) {
  const g = group(parent, x, 0, z);
  g.rotation.y = rotY;
  box(0.32, 0.85, 0.22, MAT.pants, 0, 0.43, 0, g);
  box(0.42, 0.6, 0.26, MAT.vest, 0, 1.15, 0, g);
  mesh(new THREE.SphereGeometry(0.12, 16, 12), MAT.skin, 0, 1.6, 0, g);
  mesh(new THREE.SphereGeometry(0.135, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.yellow, 0, 1.64, 0, g);
  const armL = group(g, -0.26, 1.4, 0), armR = group(g, 0.26, 1.4, 0);
  box(0.1, 0.55, 0.1, MAT.vest, 0, -0.27, 0, armL); box(0.1, 0.55, 0.1, MAT.vest, 0, -0.27, 0, armR);
  return { g, armL, armR };
}
function andon(parent, x, y, z) {
  const g = group(parent, x, y, z);
  cyl(0.025, 0.025, 0.4, MAT.steel, 0, 0.2, 0, g, 8);
  const lamps = [0xd03b3b, 0xfab219, 0x0ca30c, 0x2a78d6].map((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.04, roughness: 0.3 });
    cyl(0.075, 0.075, 0.12, m, 0, 0.46 + (3 - i) * 0.13, 0, g, 16, false);
    return m;
  });
  cyl(0.08, 0.08, 0.03, MAT.dark, 0, 0.99, 0, g, 16);
  return lamps;
}
function panel(parent, x, y, z) {
  const g = group(parent, x, y, z);
  box(0.55, 0.75, 0.14, MAT.dark, 0, 0, 0, g);
  box(0.42, 0.3, 0.01, MAT.screen, 0, 0.14, 0.075, g, false);
  return g;
}

/* ------------------------------------------------------- machine models */
// Local frame: material flows along +x, operator side is +z. Each builder
// returns { height, anim(t, dt, running), showPart(bool)?, screen? }.
const BUILD = {
  hmc(g, c) {
    box(3.8, 0.35, 2.9, MAT.dark, 0, 0.175, 0, g);
    box(3.8, 2.45, 2.9, c.body, 0, 1.575, 0, g);
    box(3.82, 0.22, 2.92, c.accent, 0, 0.75, 0, g);
    box(3.8, 0.25, 2.9, MAT.grey, 0, 2.92, 0, g);
    box(1.9, 1.35, 0.04, MAT.dark, -0.2, 1.75, 1.46, g);
    const door = group(g, 0, 0, 0);                                   // sliding door (opens at part change)
    box(0.95, 1.15, 0.03, MAT.glass, -0.67, 1.75, 1.5, door, false);
    box(0.95, 0.06, 0.05, MAT.grey, -0.67, 2.33, 1.5, door, false);
    box(0.95, 1.15, 0.03, MAT.glass, 0.28, 1.75, 1.49, g, false);
    const sp = group(g, -0.2, 1.85, 0.6);
    cyl(0.16, 0.16, 0.5, MAT.steel, 0, 0, 0, sp, 16).rotation.x = Math.PI / 2;
    box(0.05, 0.3, 0.05, MAT.yellow, 0, 0, 0.27, sp, false);
    const coolant = mesh(new THREE.ConeGeometry(0.12, 0.45, 10, 1, true),
      std(0x7ec8ff, 0.2, 0, { transparent: true, opacity: 0.45, depthWrite: false }), 0, -0.05, 0.45, sp, false);
    coolant.rotation.x = Math.PI / 2;
    const wp = box(0.7, 0.45, 0.6, MAT.castIron, -0.2, 1.15, 0.2, g);  // workpiece on table
    panel(g, 2.2, 1.6, 1.2);
    const mag = group(g, -2.05, 1.9, -0.5);
    cyl(0.75, 0.75, 0.3, MAT.grey, 0, 0, 0, mag, 24).rotation.z = Math.PI / 2;
    box(0.8, 0.7, 2.2, MAT.grey, 0.4, 0.55, -2.0, g);                // chip conveyor
    box(1.2, 0.6, 0.9, MAT.blue, -1.1, 0.3, -1.95, g);               // coolant tank
    c.lamps = andon(g, 1.7, 3.05, -1.25);
    // automatic pallet changer: two fixture pallets on a rotary table; the next part is
    // clamped outside while the machine cuts, then the table turns 180 degrees
    let changer = null, phase = 0, lastP = 0;
    if (c.cfg && c.cfg.pallet_changer) {
      const pc = group(g, -2.55, 0, 0.1);
      box(1.0, 0.75, 1.9, MAT.dark, 0, 0.375, 0, pc);
      cyl(0.55, 0.55, 0.08, MAT.steelDark, 0, 0.79, 0, pc, 24);
      changer = group(pc, 0, 0.83, 0);
      [-0.48, 0.48].forEach((dz) => {
        const pal = group(changer, 0, 0, dz);
        box(0.8, 0.08, 0.8, MAT.steel, 0, 0.04, 0, pal);
        box(0.18, 0.66, 0.46, MAT.steelDark, 0, 0.41, 0, pal);              // tombstone fixture
        box(0.36, 0.28, 0.32, MAT.castIron, 0.22, 0.3, 0, pal, false);      // crankcase
      });
    }
    let doorX = 0;
    return { height: 4.1, anim(t, dt, run, hasPart, progress) {
      wp.visible = hasPart;
      wp.scale.setScalar((c.model && PROD[c.model] && PROD[c.model].size) || 1);   // VC10 small, VC30 big crankcase
      coolant.visible = run;
      if (run) {
        sp.rotation.z += dt * 40; mag.rotation.x += dt * 0.3;
        sp.position.x = -0.2 + Math.sin(t * 0.7) * 0.35;               // X / Y axes follow the tool path
        sp.position.y = 1.75 + Math.sin(t * 1.1) * 0.15;
      }
      const open = !run || progress < 0.04 || progress > 0.97;
      doorX += ((open ? 0.95 : 0) - doorX) * Math.min(1, dt * 4);
      door.position.x = doorX;
      if (changer) {
        if (progress < lastP - 0.2) phase += Math.PI;                       // new part started
        lastP = progress;
        changer.rotation.y = phase + (run && progress < 0.045 ? (progress / 0.045) * Math.PI : 0);
      }
    } };
  },
  loadst(g, c) {
    // fixture load / unload station of the pallet pool: the operator clamps a raw
    // casting onto a fixture pallet; the station also laser-marks the serial number
    box(1.8, 0.8, 1.4, MAT.grey, 0, 0.4, 0, g);
    box(1.82, 0.1, 1.42, c.accent, 0, 0.82, 0, g);
    const pal = group(g, 0, 0.87, 0);
    box(0.9, 0.08, 0.9, MAT.steel, 0, 0.04, 0, pal);
    box(0.18, 0.7, 0.5, MAT.steelDark, 0, 0.43, 0, pal);
    const part = box(0.4, 0.28, 0.34, MAT.rawCast, 0.25, 0.27, 0, pal, false);
    [[-0.95, 0.75], [0.95, 0.75]].forEach(([x, z]) => box(0.06, 1.8, 0.06, MAT.yellow, x, 0.9, z, g));
    panel(g, 1.15, 1.4, -0.5);
    cyl(0.05, 0.05, 2.4, MAT.yellow, -0.9, 1.2, -0.7, g, 10);
    box(1.2, 0.08, 0.08, MAT.yellow, -0.35, 2.4, -0.7, g);
    const laser = box(0.25, 0.2, 0.2, MAT.dark, 0.5, 2.0, 0, g);
    const op = makeOperator(g, 0, 1.25, Math.PI);
    c.lamps = andon(g, 0.85, 0.85, -0.6);
    return { height: 2.9, anim(t, dt, run, hasPart, progress) {
      part.visible = hasPart;
      op.armL.rotation.x = run ? -0.9 + Math.sin(t * 3) * 0.3 : -0.1;
      op.armR.rotation.x = run ? -0.9 + Math.cos(t * 3.2) * 0.3 : -0.1;
      pal.rotation.y = run ? Math.sin(t * 0.6) * 0.5 : 0;
      laser.material = run && progress > 0.85 ? MAT.glow : MAT.dark;
    } };
  },
  vmc(g, c) {
    box(2.6, 0.3, 2.2, MAT.dark, 0, 0.15, 0, g);
    box(2.6, 2.3, 2.2, c.body, 0, 1.45, 0, g);
    box(2.62, 0.2, 2.22, c.accent, 0, 0.7, 0, g);
    box(1.4, 1.2, 0.03, MAT.glass, 0, 1.7, 1.12, g, false);
    box(1.6, 1.4, 0.03, MAT.dark, 0, 1.7, 1.1, g);
    const sp = group(g, 0, 1.95, 0.5);
    cyl(0.1, 0.1, 0.6, MAT.steel, 0, 0, 0, sp, 14);
    const blank = cyl(0.12, 0.12, 0.25, MAT.castIron, 0, 1.1, 0.5, g, 14);   // cylinder blank in vice
    const chips = mesh(new THREE.SphereGeometry(0.16, 8, 6), std(0xd9c27a, 0.4, 0.8, { transparent: true, opacity: 0.6 }), 0, 1.3, 0.5, g, false);
    panel(g, 1.6, 1.5, 0.9);
    box(0.9, 0.5, 0.8, MAT.blue, -0.6, 0.25, -1.55, g);
    c.lamps = andon(g, 1.1, 2.6, -0.9);
    return { height: 3.6, anim(t, dt, run, hasPart, progress) {
      blank.visible = hasPart;
      chips.visible = run;
      if (run) {
        sp.rotation.y += dt * 30;
        // boring cycle: rapid down, feed through the bore, rapid up
        const ph = (progress * 4) % 1;
        sp.position.y = ph < 0.15 ? 1.95 - ph / 0.15 * 0.25 : ph < 0.85 ? 1.7 - (ph - 0.15) / 0.7 * 0.18 : 1.52 + (ph - 0.85) / 0.15 * 0.43;
        chips.scale.setScalar(0.6 + 0.4 * Math.abs(Math.sin(t * 9)));
      }
    } };
  },
  hone(g, c) {
    box(1.8, 0.9, 1.6, c.body, 0, 0.45, 0, g);
    box(1.82, 0.15, 1.62, c.accent, 0, 0.8, 0, g);
    box(0.7, 2.8, 0.6, c.body, 0, 2.3, -0.5, g);
    const head = group(g, 0, 2.6, 0.05);
    box(0.7, 0.6, 0.6, MAT.grey, 0, 0, 0, head);
    const sp = cyl(0.05, 0.05, 0.7, MAT.steel, 0, -0.6, 0, head, 10);
    box(1.4, 1.2, 0.02, MAT.glass, 0, 1.5, 0.81, g, false);
    const blank = cyl(0.12, 0.12, 0.3, MAT.castIron, 0, 1.05, 0.05, g, 14);
    panel(g, 1.2, 1.4, 0.5);
    c.lamps = andon(g, 0.25, 3.7, -0.5);
    return { height: 4.8, anim(t, dt, run, hasPart) {
      blank.visible = hasPart;
      if (run) { sp.rotation.y += dt * 12; head.position.y = 2.6 + Math.sin(t * 3) * 0.25; }
    } };
  },
  lathe(g, c) {
    box(4.4, 0.4, 1.9, MAT.dark, 0, 0.2, 0, g);
    box(4.4, 1.7, 1.9, c.body, 0, 1.25, 0, g);
    box(4.42, 0.2, 1.92, c.accent, 0, 0.7, 0, g);
    box(4.4, 0.35, 1.5, MAT.grey, 0, 2.27, -0.2, g);
    box(2.4, 0.95, 0.03, MAT.glass, -0.3, 1.45, 0.97, g, false);
    box(2.6, 1.1, 0.03, MAT.dark, -0.3, 1.45, 0.95, g);
    box(0.6, 0.9, 0.9, MAT.grey, -1.7, 1.35, 0.1, g);                 // headstock
    const chuck = group(g, -1.3, 1.4, 0.3);
    cyl(0.28, 0.28, 0.22, MAT.steelDark, 0, 0, 0, chuck, 20).rotation.z = Math.PI / 2;
    box(0.24, 0.08, 0.08, MAT.yellow, 0.02, 0.2, 0, chuck, false);
    const blank = cyl(0.04, 0.04, 0.9, MAT.steel, -0.75, 1.4, 0.3, g, 10);   // crankshaft blank
    blank.rotation.z = Math.PI / 2;
    box(0.4, 0.5, 0.5, MAT.grey, 0.1, 1.3, 0.3, g);                   // tailstock
    // tool turret on the cross slide: travels along the shaft while turning
    const turret = group(g, -0.7, 1.4, 0.75);
    box(0.32, 0.32, 0.25, MAT.grey, 0, 0, 0, turret);
    box(0.06, 0.06, 0.2, MAT.yellow, 0, 0, -0.2, turret, false);
    panel(g, 2.5, 1.6, 0.8);
    box(1.8, 0.5, 0.7, MAT.grey, 1.2, 0.5, -1.3, g);
    c.lamps = andon(g, 2.0, 2.45, -0.7);
    return { height: 3.5, anim(t, dt, run, hasPart, progress) {
      blank.visible = hasPart;
      if (run) {
        chuck.rotation.x += dt * 25;
        const ph = (progress * 3) % 1;                                 // 3 roughing / finishing passes
        turret.position.x = -1.1 + ph * 0.95;
        turret.position.z = 0.75 - (ph < 0.9 ? 0.25 : 0);
      } else { turret.position.z += (0.75 - turret.position.z) * Math.min(1, dt * 3); }
    } };
  },
  grinder(g, c) {
    box(4.0, 0.5, 2.0, MAT.dark, 0, 0.25, 0, g);
    box(4.0, 1.7, 2.0, c.body, 0, 1.35, 0, g);
    box(4.02, 0.2, 2.02, c.accent, 0, 0.8, 0, g);
    box(2.0, 1.0, 0.03, MAT.glass, 0, 1.5, 1.02, g, false);
    box(2.2, 1.15, 0.03, MAT.dark, 0, 1.5, 1.0, g);
    const wheel = group(g, 0.2, 1.55, 0.2);
    cyl(0.5, 0.5, 0.1, std(0xc9b48a, 0.95, 0), 0, 0, 0, wheel, 28).rotation.x = Math.PI / 2;
    box(0.9, 0.06, 0.02, MAT.dark, 0, 0, 0.06, wheel, false);
    const shaft = cyl(0.04, 0.04, 1.0, MAT.steel, 0.2, 1.0, 0.5, g, 10);
    shaft.rotation.z = Math.PI / 2;
    const sparks = mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xffc070, 0.5, 0, { emissive: 0xff9a30, emissiveIntensity: 2 }), 0.2, 1.05, 0.48, g, false);
    box(1.0, 1.1, 0.8, MAT.blue, -2.5, 0.55, -0.4, g);
    panel(g, 2.25, 1.6, 0.9);
    c.lamps = andon(g, 1.7, 2.2, -0.8);
    return { height: 3.3, anim(t, dt, run, hasPart) {
      shaft.visible = hasPart;
      sparks.visible = run && Math.sin(t * 25) > -0.3;
      if (run) {
        wheel.rotation.z -= dt * 30;
        wheel.position.x = 0.2 + Math.sin(t * 0.8) * 0.35;            // table traverse: grinds journal after journal
        wheel.position.y = 1.55 - (0.5 + 0.5 * Math.sin(t * 2.2)) * 0.05;
        sparks.position.x = wheel.position.x;
        sparks.scale.setScalar(0.6 + Math.random() * 0.8);
      }
    } };
  },
  washer(g, c) {
    box(4.6, 2.0, 1.8, MAT.steel, 0, 1.0, 0, g);
    box(4.62, 0.2, 1.82, c.accent, 0, 1.6, 0, g);
    box(0.04, 0.8, 1.0, MAT.rubber, -2.31, 1.0, 0, g, false);          // openings
    box(0.04, 0.8, 1.0, MAT.rubber, 2.31, 1.0, 0, g, false);
    const doorIn = box(0.06, 0.82, 1.04, MAT.steelDark, -2.34, 1.0, 0, g);   // lifting doors
    const doorOut = box(0.06, 0.82, 1.04, MAT.steelDark, 2.34, 1.0, 0, g);
    cyl(0.18, 0.18, 2.5, MAT.steel, -1.4, 3.2, -0.4, g, 14);
    cyl(0.18, 0.18, 2.5, MAT.steel, 1.2, 3.2, -0.4, g, 14);
    box(0.9, 1.8, 0.5, c.body, 0.8, 0.9, 1.25, g);
    box(0.4, 0.25, 0.01, MAT.screen, 0.8, 1.4, 1.51, g, false);
    const steam = mesh(new THREE.SphereGeometry(0.35, 12, 8), std(0xffffff, 1, 0, { transparent: true, opacity: 0 }), -1.4, 4.6, -0.4, g, false);
    c.lamps = andon(g, -2.0, 2.0, 0.6);
    return { height: 4.6, anim(t, dt, run, hasPart, progress) {
      // inlet door lifts when a part goes in, outlet door when it comes out
      const up = (open, d) => { d.position.y += ((open ? 1.75 : 1.0) - d.position.y) * Math.min(1, dt * 5); };
      up(run && progress < 0.08, doorIn);
      up(run && progress > 0.9, doorOut);
      steam.material.opacity = run ? 0.25 + 0.15 * Math.sin(t * 3) : 0;
      steam.position.y = 4.6 + ((t * 0.6) % 1) * 0.6; steam.scale.setScalar(1 + ((t * 0.6) % 1));
    } };
  },
  assembly(g, c) {
    box(3.2, 0.06, 1.2, MAT.steel, 0, 0.9, 0, g);
    [[-1.5, -0.5], [1.5, -0.5], [-1.5, 0.5], [1.5, 0.5]].forEach(([x, z]) => box(0.06, 0.9, 0.06, MAT.grey, x, 0.45, z, g));
    box(3.2, 1.0, 0.05, c.body, 0, 1.45, -0.6, g);                     // back panel with tools
    box(3.22, 0.12, 0.07, c.accent, 0, 1.95, -0.6, g);
    for (let i = 0; i < 6; i++) box(0.05, 0.25, 0.05, MAT.dark, -1.2 + i * 0.45, 1.5, -0.55, g);
    // part bins (crankcases, cylinders, shafts)
    [[-1.0, MAT.castIron], [0, MAT.fin], [1.0, MAT.steel]].forEach(([x, m]) => {
      box(0.7, 0.3, 0.5, MAT.blue, x, 1.1, -1.05, g);
      box(0.6, 0.12, 0.4, m, x, 1.27, -1.05, g, false);
    });
    cyl(0.05, 0.05, 2.6, MAT.yellow, -1.7, 1.3, -0.9, g, 10);         // tool balancer post
    box(1.8, 0.08, 0.08, MAT.yellow, -0.85, 2.6, -0.9, g);
    const tool = cyl(0.04, 0.04, 0.6, MAT.dark, 0, 2.2, -0.4, g, 8);
    const prod = makePump(1.1); prod.group.position.set(0, 0.93, 0.05); g.add(prod.group);
    const op = makeOperator(g, 0, 1.0, Math.PI);
    c.lamps = andon(g, 1.55, 1.95, -0.6);
    return { height: 3.0, anim(t, dt, run, hasPart) {
      prod.group.visible = hasPart;
      op.armL.rotation.x = run ? -0.9 + Math.sin(t * 3) * 0.3 : -0.1;
      op.armR.rotation.x = run ? -0.9 + Math.cos(t * 3.4) * 0.3 : -0.1;
      tool.position.y = run ? 2.0 + Math.sin(t * 2) * 0.15 : 2.2;
    } };
  },
  robot(g, c) {
    // safety fence with openings on the flow sides
    const fw = 4.4, fh = 2.0;
    [[0, -fw / 2, fw, 0], [0, fw / 2, fw, 0], [-fw / 2, -1.3, 1.8, 1], [-fw / 2, 1.3, 1.8, 1], [fw / 2, -1.3, 1.8, 1], [fw / 2, 1.3, 1.8, 1]]
      .forEach(([x, z, len, vert]) => {
        const p = box(vert ? 0.02 : len, fh, vert ? len : 0.02, MAT.fence, x, fh / 2, z, g, false);
        p.renderOrder = 2;
      });
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, -0.4], [-1, 0.4], [1, -0.4], [1, 0.4], [0, -1], [0, 1]].forEach(([a, b]) =>
      box(0.06, fh, 0.06, MAT.yellow, a * fw / 2, fh / 2, b * fw / 2, g));
    box(1.0, 0.8, 0.8, MAT.grey, 0.9, 0.4, 0, g);                       // fixture table
    const prod = makePump(1.0); prod.group.position.set(0.9, 0.8, 0); g.add(prod.group);
    cyl(0.35, 0.4, 0.5, c.body, -0.6, 0.25, 0, g, 20);
    const base = group(g, -0.6, 0.5, 0);
    cyl(0.32, 0.32, 0.25, MAT.orange, 0, 0.12, 0, base, 20);
    const shoulder = group(base, 0, 0.35, 0);
    box(0.3, 0.3, 0.35, MAT.orange, 0, 0, 0, shoulder);
    const lower = group(shoulder, 0, 0, 0);
    box(0.2, 1.1, 0.22, MAT.orange, 0, 0.55, 0, lower);
    const elbow = group(lower, 0, 1.1, 0);
    box(0.25, 0.25, 0.28, MAT.orange, 0, 0, 0, elbow);
    const upper = group(elbow, 0, 0, 0);
    box(1.0, 0.16, 0.18, MAT.orange, 0.5, 0, 0, upper);
    const wrist = group(upper, 1.0, 0, 0);
    cyl(0.07, 0.07, 0.3, MAT.dark, 0, -0.15, 0, wrist, 12);
    c.lamps = andon(g, -fw / 2, fh, -fw / 2);
    return { height: 3.0, anim(t, dt, run, hasPart) {
      prod.group.visible = hasPart;
      if (!run) return;
      base.rotation.y = Math.sin(t * 1.3) * 0.5;
      lower.rotation.z = -0.35 + Math.sin(t * 1.9) * 0.2;
      upper.rotation.z = -0.5 + Math.sin(t * 2.3 + 1) * 0.25;
      wrist.rotation.y += dt * 8;
    } };
  },
  testbench(g, c) {
    // sound-insulated test cell (transparent walls)
    box(3.6, 2.4, 0.04, MAT.glass, 0, 1.2, -1.6, g, false);
    box(0.04, 2.4, 3.2, MAT.glass, -1.8, 1.2, 0, g, false);
    box(0.04, 2.4, 3.2, MAT.glass, 1.8, 1.2, 0, g, false);
    [[-1.8, -1.6], [1.8, -1.6], [-1.8, 1.6], [1.8, 1.6]].forEach(([x, z]) => box(0.08, 2.5, 0.08, MAT.grey, x, 1.25, z, g));
    box(3.68, 0.1, 3.28, MAT.grey, 0, 2.45, 0, g);
    box(1.8, 0.08, 1.0, MAT.steelDark, -0.2, 0.7, 0, g);
    [[-1, -0.4], [0.6, -0.4], [-1, 0.4], [0.6, 0.4]].forEach(([x, z]) => box(0.08, 0.7, 0.08, MAT.steelDark, x, 0.35, z, g));
    const prod = makePump(1.25); prod.group.position.set(-0.3, 0.74, 0); g.add(prod.group);
    cyl(0.3, 0.3, 1.3, MAT.red, 1.15, 0.85, -0.6, g, 18);              // test receiver
    cyl(0.04, 0.04, 1.2, MAT.steel, 0.5, 1.2, -0.6, g, 8).rotation.z = Math.PI / 2;
    cyl(0.08, 0.08, 0.03, MAT.white, 1.15, 1.4, -0.29, g, 16).rotation.x = Math.PI / 2;
    const needle = box(0.012, 0.07, 0.01, MAT.red, 1.15, 1.4, -0.27, g, false);   // pressure gauge needle
    needle.geometry.translate(0, 0.03, 0);
    // control cabinet with live screen
    box(0.8, 1.9, 0.45, c.body, -1.3, 0.95, -1.1, g);
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 160;
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = mesh(new THREE.PlaneGeometry(0.66, 0.41), new THREE.MeshBasicMaterial({ map: tex }), -1.3, 1.45, -0.87, g, false);
    scr.rotation.y = 0;
    c.lamps = andon(g, 1.75, 2.5, -1.55);
    return {
      height: 3.6,
      anim(t, dt, run, hasPart, progress) {
        prod.group.visible = hasPart;
        if (run) {
          prod.flywheel.rotation.z -= dt * 30;
          prod.group.position.x = -0.3 + Math.sin(t * 70) * 0.006;       // a running piston compressor shakes
        }
        // receiver is pumped up to 8 bar during the test, then blown down
        const p = run ? (progress < 0.8 ? progress / 0.8 : 1 - (progress - 0.8) / 0.2) : 0;
        needle.rotation.z = 2.2 - p * 4.0;
      },
      screen(m) {
        const x = cv.getContext("2d");
        x.fillStyle = "#0b1a24"; x.fillRect(0, 0, 256, 160);
        x.fillStyle = "#7fb4e8"; x.font = "bold 18px system-ui, sans-serif"; x.fillText(m.id + "  FAD TEST", 12, 26);
        const s = m.sensors, tst = m.test || {};
        x.fillStyle = "#ffffff"; x.font = "bold 34px system-ui, sans-serif";
        x.fillText((s.flow_m3_h ?? 0).toFixed(1) + " m³/h", 12, 70);
        x.font = "22px system-ui, sans-serif";
        x.fillText((s.pressure_bar ?? 0).toFixed(1) + " bar", 12, 102);
        if (tst.last_flow_m3_h != null) {
          const ok = tst.last_flow_m3_h >= tst.min_flow_m3_h;
          x.fillStyle = ok ? "#3ddc6a" : "#ff6b6b";
          x.fillText(`last ${tst.last_flow_m3_h.toFixed(2)} ${ok ? "PASS" : "FAIL"}`, 12, 140);
        }
        tex.needsUpdate = true;
      },
    };
  },
  paint(g, c) {
    // powder booth (left) + curing oven (right), overhead conveyor running through
    box(4.2, 3.4, 3.4, c.body, -1.9, 1.7, 0, g);
    box(4.22, 0.3, 3.42, c.accent, -1.9, 2.9, 0, g);
    box(3.6, 3.4, 3.4, MAT.grey, 2.1, 1.7, 0, g);
    box(3.62, 0.3, 3.42, MAT.red, 2.1, 2.9, 0, g);
    box(0.05, 1.6, 1.2, MAT.dark, -4.02, 1.6, 0, g);
    box(0.05, 1.6, 1.2, MAT.dark, 3.92, 1.6, 0, g);
    box(2.0, 1.4, 0.03, MAT.glass, -1.9, 1.6, 1.71, g, false);
    const inner = box(1.9, 1.3, 0.02, std(0xffffff, 1, 0, { emissive: 0xcfe6ff, emissiveIntensity: 0.2 }), -1.9, 1.6, 1.69, g, false);
    box(1.6, 1.0, 1.6, MAT.grey, -2.6, 3.9, 0, g);                       // filter house
    cyl(0.35, 0.35, 2.4, MAT.steel, -0.9, 4.6, -0.8, g, 16);
    cyl(0.3, 0.3, 2.0, MAT.steel, 2.6, 4.4, -0.8, g, 16);
    const ovenGlow = box(1.0, 0.25, 0.02, MAT.glow, 2.1, 2.2, 1.71, g, false);
    box(9.5, 0.12, 0.12, MAT.steelDark, 0, 3.1, 1.95, g);
    // overhead conveyor in front of the booth: hangers carry pumps through booth and oven
    const hangers = [];
    for (let i = 0; i < 7; i++) {
      const h = group(g, 0, 3.1, 1.95);
      box(0.03, 0.9, 0.03, MAT.dark, 0, -0.45, 0, h, false);
      const pmp = makePump(0.7); pmp.group.position.y = -1.25; h.add(pmp.group);
      hangers.push({ h, p: pmp.group });
    }
    let hOff = 0;
    c.lamps = andon(g, -3.8, 3.4, 1.5);
    return { height: 5.8, anim(t, dt, run, hasPart) {
      if (run) hOff = (hOff + dt * 0.35) % 1.3;
      hangers.forEach((x, i) => {
        x.h.position.x = -4.6 + ((i * 1.3 + hOff) % 9.1);
        x.p.visible = hasPart || run;
        x.h.rotation.z = run ? Math.sin(t * 2 + i) * 0.03 : 0;
      });
      inner.material.emissiveIntensity = run ? 0.6 : 0.15;
      ovenGlow.material.emissiveIntensity = run ? 1.2 + 0.2 * Math.sin(t * 2) : 0.15;
    } };
  },
  final(g, c) {
    box(3.0, 0.06, 1.4, MAT.steel, 0, 0.6, 0, g);
    [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(([x, z]) => box(0.08, 0.6, 0.08, MAT.grey, x, 0.3, z, g));
    const prod = makeCompressor(1.2); prod.group.position.set(0, 0.63, 0); g.add(prod.group);
    // jib crane
    cyl(0.1, 0.12, 3.6, MAT.yellow, -1.8, 1.8, -1.0, g, 12);
    const jib = group(g, -1.8, 3.4, -1.0);
    box(2.8, 0.18, 0.14, MAT.yellow, 1.4, 0, 0, jib);
    const hoist = group(jib, 1.8, -0.25, 0);
    box(0.25, 0.3, 0.25, MAT.dark, 0, 0, 0, hoist);
    const cable = cyl(0.012, 0.012, 1, MAT.dark, 0, -0.5, 0, hoist, 6, false);
    const hook = group(hoist, 0, -1, 0);
    const carried = cyl(0.15, 0.15, 0.42, MAT.motor, 0, -0.2, 0, hook, 14);   // electric motor on the hook
    carried.rotation.x = Math.PI / 2;
    // motor pallet next to the bench (where the hoist picks the motor up)
    const palX = -1.8 + 1.8 * Math.cos(0.9), palZ = -1.0 - 1.8 * Math.sin(0.9);
    box(0.9, 0.14, 0.9, MAT.wood, palX, 0.07, palZ, g);
    [-0.2, 0.2].forEach((dx) => { const mm = cyl(0.15, 0.15, 0.42, MAT.motor, palX + dx, 0.3, palZ, g, 14); mm.rotation.x = Math.PI / 2; });
    const op1 = makeOperator(g, 0.6, 1.2, Math.PI), op2 = makeOperator(g, -0.9, -1.1, 0);
    box(1.2, 1.2, 0.8, MAT.blue, 2.2, 0.6, -1.3, g);
    c.lamps = andon(g, 1.45, 0.65, 0.65);
    return { height: 3.8, anim(t, dt, run, hasPart, progress) {
      prod.group.visible = hasPart;
      if (run) {
        // cycle: swing to the motor pallet, lower + pick, lift, swing over the tank, lower + place
        const p = progress, ease = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
        const swing = p < 0.15 ? 0.9 * ease(p / 0.15) : p < 0.35 ? 0.9 : p < 0.5 ? 0.9 * (1 - ease((p - 0.35) / 0.15)) : 0;
        const drop = p < 0.15 ? 1.0 : p < 0.25 ? 1.0 + 1.5 * ease((p - 0.15) / 0.1) : p < 0.35 ? 2.5 - 1.5 * ease((p - 0.25) / 0.1)
          : p < 0.5 ? 1.0 : p < 0.62 ? 1.0 + 1.1 * ease((p - 0.5) / 0.12) : p < 0.75 ? 2.1 - 1.1 * ease((p - 0.62) / 0.13) : 1.0;
        jib.rotation.y = swing;
        hook.position.y = -drop; cable.scale.y = drop; cable.position.y = -drop / 2;
        carried.visible = p > 0.22 && p < 0.65;
      }
      op1.armL.rotation.x = op2.armR.rotation.x = run ? -0.8 + Math.sin(t * 3) * 0.3 : -0.1;
    } };
  },
  pack(g, c) {
    cyl(1.1, 1.1, 0.15, MAT.dark, 0, 0.075, 0, g, 32);
    const tt = group(g, 0, 0.15, 0);
    box(1.4, 0.12, 1.2, MAT.wood, 0, 0.06, 0, tt);
    const prod = makeCompressor(0.95); prod.group.position.set(0, 0.12, 0); tt.add(prod.group);
    const film = box(1.45, 1.1, 0.85, MAT.wrap, 0, 0.67, 0, tt, false);
    box(0.25, 2.6, 0.25, c.body, -1.4, 1.3, 0, g);
    box(0.27, 0.15, 0.27, c.accent, -1.4, 2.5, 0, g);
    const carriage = box(0.3, 0.3, 0.6, MAT.dark, -1.15, 0.6, 0, g);
    panel(g, -1.4, 1.3, 0.3).rotation.y = Math.PI / 2;
    c.lamps = andon(g, -1.4, 2.6, 0);
    return { height: 3.6, anim(t, dt, run, hasPart, progress) {
      prod.group.visible = hasPart; film.visible = hasPart && progress > 0.25;
      film.scale.y = Math.max(0.05, Math.min(1, (progress - 0.25) / 0.6));
      film.position.y = 0.12 + 0.55 * film.scale.y;
      if (run) { tt.rotation.y += dt * 2.5; carriage.position.y = 0.5 + Math.abs(Math.sin(t * 0.5)) * 1.2; }
    } };
  },
};

/* --------------------------------------------------------------- the view */
export function createFactory3D(container, config, ui) {
  const L = config.layout || {};
  const hall = Object.assign({ length: 96, width: 50, height: 11 }, L.hall || {});
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  const labelLayer = document.createElement("div");
  labelLayer.className = "labels3d";
  container.appendChild(labelLayer);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 600);
  camera.position.set(4, 44, 54);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, -1);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 4;
  controls.maxDistance = 160;

  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0x51606e, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-30, 60, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 40, bottom: -40, near: 10, far: 160 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  function applyTheme() {
    const page = getComputedStyle(document.documentElement).getPropertyValue("--page").trim() || "#f9f9f7";
    const dark = isDark(page);
    scene.background = new THREE.Color(dark ? 0x15181b : 0xdfe5ea);
    scene.fog = new THREE.Fog(scene.background, 120, 260);
  }
  applyTheme();
  window.addEventListener("themechange", applyTheme);

  (config.products || []).forEach((p) => (PROD[p.id] = p));
  const HL = config._handling || { transports: [], asrs: [], chargers: [], parks: [] };
  const hallParts = buildHall(scene, hall, L.zones || [], HL);

  /* ---------- stations */
  const stations = {};
  const clickable = [];
  config.stations.forEach((s) => {
    const kind = BUILD[s.model] ? s.model : "hmc";
    const [x, z] = s.pos || [0, 0];
    const g = group(scene, x, 0, z);
    g.rotation.y = ((s.rot || 0) * Math.PI) / 180;
    const ctx = { body: MAT.white.clone(), accent: MAT.blue.clone(), cfg: s };
    const built = BUILD[kind](g, ctx);
    g.traverse((o) => { o.userData.stationId = s.id; });
    clickable.push(g);
    const lbl = document.createElement("div");
    lbl.className = "lbl3d";
    lbl.innerHTML = `<b>${esc(s.name)}</b><span class="st"></span>`;
    lbl.addEventListener("click", () => ui.select(s.id));
    labelLayer.appendChild(lbl);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
    tag.scale.set(1.1, 0.42, 1); tag.position.set(x, Math.min(built.height, 3.2) - 0.4, z); tag.renderOrder = 5; tag.visible = false;
    scene.add(tag);
    stations[s.id] = { cfg: s, g, ctx, built, lamps: ctx.lamps, kind, label: lbl, snap: null, labelY: built.height + 0.6, tag };
    if (s.glb && glbEnabled) attachGLB(stations[s.id], (st) => tint(st));   // swap boxes for the CAD model when loaded
  });

  /* ---------- buffers: conveyors, raw material pallets, warehouse */
  const rollers = [];
  const conveyors = {};
  const producersOf = (id) => config.stations.filter((s) => s.output === id);
  const consumersOf = (id) => config.stations.filter((s) => (s.inputs || []).some((i) => i.buffer === id));
  const ppBuffers = new Set((config.pallet_pools || []).map((p) => p.buffer));
  config.buffers.forEach((b) => { bufInfinite[b.id] = !!(b.infinite || b.store || b.asrs); });

  /* ---------- AS/RS, pallet pools */
  const asrsObjs = (config.asrs || []).map((a) => {
    const lay = (HL.asrs || []).find((x) => x.id === a.id) || { bays: 10, levels: a.levels || 5, slots: 100 };
    const o = buildASRS(scene, a, lay, config.buffers.filter((b) => b.asrs === a.id), labelLayer);
    lay.buffers && lay.buffers.forEach((id) => (conveyors[id] = o.bufferProxy(id)));
    return o;
  });
  const ppObjs = (config.pallet_pools || []).map((pp) => buildPalletPool(scene, pp, labelLayer));

  config.buffers.forEach((b) => {
    if (b.asrs || ppBuffers.has(b.id)) return;
    if (b.infinite || b.store) { conveyors[b.id] = buildRawStock(scene, b, labelLayer); return; }
    if (b.finished) { conveyors[b.id] = buildWarehouse(scene, b); return; }
    const prods = producersOf(b.id), cons = consumersOf(b.id);
    if (!prods.length && cons.length) { conveyors[b.id] = buildFlowRack(scene, b, labelLayer); return; }
    if (prods.length && !cons.length) { conveyors[b.id] = buildOutStand(scene, b, labelLayer); return; }
    if (!prods.length || !cons.length) return;
    conveyors[b.id] = buildConveyor(scene, b, prods, cons, rollers, labelLayer);
  });

  /* ---------- AGV fleet + chargers */
  (HL.chargers || []).forEach((p) => buildCharger(scene, p));
  const fleet = buildFleet(scene, (config.agv && config.agv.count) || 0, HL.parks || [], labelLayer);
  if (rollers.length) {
    const im = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), MAT.steel, rollers.length);
    rollers.forEach((m, i) => im.setMatrixAt(i, m));
    im.receiveShadow = true;
    scene.add(im);
  }

  /* ---------- selection ring */
  const ring = mesh(new THREE.RingGeometry(1, 1.15, 48), new THREE.MeshBasicMaterial({ color: 0x2a78d6, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 0, 0.03, 0, scene, false);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  let selected = null;

  /* ---------- picking */
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let downAt = null;
  renderer.domElement.addEventListener("pointerdown", (e) => (downAt = [e.clientX, e.clientY]));
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 5) return;
    const id = pick(e);
    if (id) ui.select(id);
  });
  renderer.domElement.addEventListener("dblclick", (e) => { const id = pick(e); if (id) focus(id); });
  renderer.domElement.addEventListener("pointermove", (e) => {
    renderer.domElement.style.cursor = pick(e) ? "pointer" : "grab";
  });
  function pick(e) {
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(clickable, true)[0];
    return hit ? hit.object.userData.stationId : null;
  }

  /* ---------- camera moves */
  let fly = null;
  function flyTo(pos, target) {
    fly = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...target) };
  }
  const VIEWS = {
    overview: [[4, 44, 54], [0, 0, -1]],
    machining: [[-22, 20, 24], [-22, 0, -5]],
    assembly: [[12, 15, 19], [12, 0, -4]],
    final: [[26, 15, 36], [28, 0, 10]],
    logistics: [[-4, 24, 34], [-27, 0, 1]],
    walk: [[-44, 1.7, 13], [0, 1.5, 0]],
  };
  function setView(name) { const v = VIEWS[name]; if (v) flyTo(v[0], v[1]); }

  /* ---------- walk / fly with the keyboard, move with the mouse */
  // W/S or ↑/↓ forward/back · A/D sideways · ←/→ turn · Q/E (or PgDn/PgUp) down/up · Shift = 3x faster
  const MOVE_KEYS = new Set(["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", "pageup", "pagedown"]);
  const keys = new Set();
  let hover = false, fast = false;
  renderer.domElement.tabIndex = 0;                     // can take keyboard focus
  renderer.domElement.style.outline = "none";
  renderer.domElement.addEventListener("pointerenter", () => (hover = true));
  renderer.domElement.addEventListener("pointerleave", () => (hover = false));
  renderer.domElement.addEventListener("pointerdown", () => renderer.domElement.focus({ preventScroll: true }));
  window.addEventListener("keydown", (e) => {
    fast = e.shiftKey;
    const k = e.key.toLowerCase();
    if (!MOVE_KEYS.has(k) || !container.offsetParent || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (!hover && document.activeElement !== renderer.domElement) return;
    keys.add(k);
    e.preventDefault();                                 // arrows / space must not scroll the page
  });
  window.addEventListener("keyup", (e) => { fast = e.shiftKey; keys.delete(e.key.toLowerCase()); });
  window.addEventListener("blur", () => keys.clear());
  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _m = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function keyMove(dt) {
    if (!keys.size) return;
    fly = null;
    const k = (a, b) => (keys.has(a) || (b && keys.has(b)) ? 1 : 0);
    camera.getWorldDirection(_f); _f.y = 0;
    if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1);
    _f.normalize();
    _r.crossVectors(_f, UP).normalize();
    // speed grows with height: slow walk between machines, fast flight over the hall
    const sp = (fast ? 3 : 1) * Math.max(3, Math.min(25, camera.position.y * 0.7)) * dt;
    _m.set(0, 0, 0)
      .addScaledVector(_f, (k("w", "arrowup") - k("s", "arrowdown")) * sp)
      .addScaledVector(_r, (k("d") - k("a")) * sp);
    _m.y = (k("e", "pageup") - k("q", "pagedown")) * sp * 0.7;
    if (camera.position.y + _m.y < 0.8) _m.y = 0.8 - camera.position.y;
    camera.position.add(_m);
    controls.target.add(_m);
    const turn = (k("arrowleft") - k("arrowright")) * dt * 1.3;
    if (turn) {                                          // turn the head: rotate the target around the camera
      _m.subVectors(controls.target, camera.position).applyAxisAngle(UP, turn);
      controls.target.copy(camera.position).add(_m);
    }
  }
  controls.screenSpacePanning = false;                  // panning slides over the floor, like walking
  controls.keyPanSpeed = 0;
  function setMouseMode(mode) {
    controls.mouseButtons = mode === "move"
      ? { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = mode === "move"
      ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }
      : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  }
  function focus(id) {
    const st = stations[id]; if (!st) return;
    const p = st.g.position;
    flyTo([p.x + 6, 6 + st.built.height, p.z + 9], [p.x, 1.2, p.z]);
  }

  /* ---------- live data */
  let colorMode = "real";
  let showLabels = true;
  let snap = null;
  function update(s) {
    snap = s;
    s.machines.forEach((m) => {
      const st = stations[m.id]; if (!st) return;
      st.snap = m;
      if (st.built.screen) st.built.screen(m);
      const mv = m.item && m.item.v;
      st.ctx.model = mv || null;
      st.label.querySelector(".st").textContent = m.state === "RUNNING" ? `${mv ? mv + " · " : ""}${Math.round(m.progress * 100)}%`
        : m.state === "SETUP" ? `SETUP → ${mv || ""}${m.fms && m.fms.setup_left_s ? " " + Math.ceil(m.fms.setup_left_s / 60) + " min" : ""}` : m.state;
      st.label.dataset.state = m.state;
      const mine = !!(m.item && m.item.wo && tracked.has(m.item.wo));
      st.label.classList.toggle("tracked", mine);
      st.tag.visible = mine;
      if (mine) st.tag.material = tagMaterial(m.item.id);
      tint(st);
    });
    s.buffers.forEach((b) => conveyors[b.id] && conveyors[b.id].setCount(b.count, b, s));
    if (s.handling) {
      asrsObjs.forEach((o) => o.update(s.handling.asrs.find((a) => a.id === o.id), s));
      ppObjs.forEach((o) => o.update(s));
      fleet.update(s.handling.agvs, s.time_scale, s.paused);
    }
  }
  function tint(st) {
    const m = st.snap; if (!m) return;
    let hex = 0x000000, k = 0;
    if (colorMode === "state") { hex = STATE_HEX[m.state]; k = 0.55; }
    if (colorMode === "health") { hex = HEALTH_HEX[m.health.level]; k = 0.55; }
    [st.ctx.body, st.ctx.accent, ...(st.glb ? st.glb.paint : [])].forEach((mt) => { mt.emissive.setHex(hex); mt.emissiveIntensity = k; });
  }
  function setColorMode(m) { colorMode = m; Object.values(stations).forEach(tint); }
  function setLabels(on) { showLabels = on; labelLayer.style.display = on ? "" : "none"; }
  let showBuilding = true;
  function setBuilding(on) { showBuilding = on; hallParts.shell.visible = on; }
  // work orders of the customer order followed in the Order-flow tab: their machines get an outline
  let tracked = new Set();
  function setTracked(ids) {
    tracked = new Set(ids || []); TRACKED = tracked;
    if (snap) update(snap);
  }
  function select(id) {
    selected = id;
    const st = stations[id];
    ring.visible = !!st;
    if (st) {
      ring.position.set(st.g.position.x, 0.03, st.g.position.z);
      const r = (FOOT[st.kind] || 2) + 0.4;
      ring.scale.setScalar(r);
    }
    Object.values(stations).forEach((x) => x.label.classList.toggle("sel", x.cfg.id === id));
  }

  /* ---------- loop */
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  let running = true;
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!running || document.hidden || !container.offsetParent) return;
    const t = clock.elapsedTime;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 1.2);
      const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
      camera.position.lerpVectors(fly.p0, fly.p1, e);
      controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (fly.t >= 1) fly = null;
    }
    keyMove(dt);
    controls.update();
    // roof only when looking from high above (walk-in view under the roof also keeps it)
    hallParts.roof.visible = showBuilding && (camera.position.y > 30 || camera.position.y < hallParts.height - 2);
    const W = container.clientWidth, H = container.clientHeight;
    for (const id in stations) {
      const st = stations[id], m = st.snap;
      const state = m ? m.state : "OFFLINE";
      const run = state === "RUNNING" && !(snap && snap.paused);
      const hasPart = state === "RUNNING" || state === "BLOCKED" || state === "SETUP";
      if (st.glb) animGLB(st, t, dt, run, hasPart, m ? m.progress : 0, m, (st.ctx.model && PROD[st.ctx.model] && PROD[st.ctx.model].size) || 1);
      else st.built.anim(t, dt, run, hasPart, m ? m.progress : 0);
      setAndon(st.lamps, state, t);
      if (showLabels) {
        v.set(st.g.position.x, st.labelY, st.g.position.z).project(camera);
        const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        st.label.style.display = vis ? "" : "none";
        if (vis) st.label.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
      }
    }
    for (const id in conveyors) conveyors[id].tick(dt, camera, W, H, showLabels);
    asrsObjs.forEach((o) => o.tick(dt, camera, W, H, showLabels));
    ppObjs.forEach((o) => o.tick(dt, camera, W, H, showLabels));
    fleet.tick(dt, camera, W, H, showLabels);
    if (ring.visible) ring.material.opacity = 0.55 + 0.35 * Math.sin(t * 4);
    renderer.render(scene, camera);
  }
  frame();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);
  return { update, select, setView, focus, setColorMode, setLabels, setBuilding, setTracked, setMouseMode, applyTheme, pause: (p) => (running = !p) };
}

/* ------------------------------------------------------------- building */
function isDark(cssColor) {
  const m = cssColor.match(/^#([0-9a-f]{6})$/i);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 100;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function setAndon(lamps, state, t) {
  if (!lamps) return;
  const on = { RUNNING: 2, STARVED: 1, BLOCKED: 1, STOPPED: 1, DOWN: 0, MAINTENANCE: 3, SETUP: 3 }[state];
  const blink = state === "DOWN" || state === "BLOCKED" ? (Math.sin(t * 8) > 0 ? 1 : 0.15)
    : state === "SETUP" ? (Math.sin(t * 3) > 0 ? 1 : 0.2) : 1;          // changeover: slow blinking blue
  lamps.forEach((m, i) => (m.emissiveIntensity = i === on ? 2.6 * blink : 0.04));
}

function buildHall(scene, hall, zones, HL) {
  const Lx = hall.length, Wz = hall.width, H = hall.height;
  // floor texture: epoxy, zones, walkways, zone names
  const ppm = 24, cw = Math.round(Lx * ppm), ch = Math.round(Wz * ppm);
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const x = cv.getContext("2d");
  x.fillStyle = "#9aa3a9"; x.fillRect(0, 0, cw, ch);
  const px = (wx) => (wx + Lx / 2) * ppm, pz = (wz) => (wz + Wz / 2) * ppm;
  // subtle slab joints
  x.strokeStyle = "rgba(0,0,0,0.06)"; x.lineWidth = 1;
  for (let i = -Lx / 2; i <= Lx / 2; i += 6) { x.beginPath(); x.moveTo(px(i), 0); x.lineTo(px(i), ch); x.stroke(); }
  for (let i = -Wz / 2; i <= Wz / 2; i += 6) { x.beginPath(); x.moveTo(0, pz(i)); x.lineTo(cw, pz(i)); x.stroke(); }
  // walkways (green with yellow edges)
  const walk = (x1, z1, x2, z2) => {
    x.fillStyle = "#5f8f6e"; x.fillRect(px(x1), pz(z1), px(x2) - px(x1), pz(z2) - pz(z1));
    x.strokeStyle = "#f2c200"; x.lineWidth = 4; x.strokeRect(px(x1), pz(z1), px(x2) - px(x1), pz(z2) - pz(z1));
  };
  walk(-Lx / 2 + 1, 11.6, 20, 13.0);
  walk(-Lx / 2 + 1, -24.4, Lx / 2 - 1, -23.0);
  walk(-7.4, -23, -6.2, 11.6);
  zones.forEach((zn) => {
    const [x1, x2] = zn.x, [z1, z2] = zn.z;
    x.fillStyle = hexA(zn.color || "#888888", 0.22);
    x.fillRect(px(x1), pz(z1), px(x2) - px(x1), pz(z2) - pz(z1));
    x.setLineDash([18, 10]); x.strokeStyle = "#f2c200"; x.lineWidth = 3;
    x.strokeRect(px(x1), pz(z1), px(x2) - px(x1), pz(z2) - pz(z1));
    x.setLineDash([]);
    x.fillStyle = "rgba(255,255,255,0.85)";
    x.font = `bold ${Math.round(ppm * 0.9)}px system-ui, sans-serif`;
    x.fillText(zn.name, px(x1) + ppm * 0.5, pz(z2) - ppm * 0.5);
  });
  // AGV routes (blue dashed guide lines) and parking spots
  x.strokeStyle = "#2a78d6"; x.lineWidth = 5; x.setLineDash([16, 10]); x.lineCap = "round";
  (HL.transports || []).forEach((tr) => {
    x.beginPath();
    tr.path.forEach(([wx, wz], i) => (i ? x.lineTo(px(wx), pz(wz)) : x.moveTo(px(wx), pz(wz))));
    x.stroke();
  });
  x.setLineDash([]);
  x.strokeStyle = "#ffffff"; x.lineWidth = 3;
  (HL.parks || []).forEach(([wx, wz]) => x.strokeRect(px(wx - 0.9), pz(wz - 0.7), 1.8 * ppm, 1.4 * ppm));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const floor = mesh(new THREE.PlaneGeometry(Lx, Wz), std(0xffffff, 0.75, 0.05, { map: tex }), 0, 0, 0, scene, false);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  // outside ground
  const ground = mesh(new THREE.PlaneGeometry(600, 600), std(0x7d8a7a, 1, 0), 0, -0.02, 0, scene, false);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;

  // building shell (walls, windows, doors, kerb, columns, office): can be hidden with the "Building" switch
  const shell = group(scene);
  // walls (back + left), with window band; front and right are cut away so you can look in
  const wallH = H;
  box(Lx, wallH, 0.3, MAT.wall, 0, wallH / 2, -Wz / 2 - 0.15, shell);
  box(0.3, wallH, Wz, MAT.wall, -Lx / 2 - 0.15, wallH / 2, 0, shell);
  const win = std(0xbfdcf5, 0.1, 0.1, { emissive: 0x9cc7ee, emissiveIntensity: 0.25 });
  box(Lx - 4, 1.6, 0.05, win, 0, wallH - 2.5, -Wz / 2 + 0.02, shell, false);
  box(0.05, 1.6, Wz - 4, win, -Lx / 2 + 0.02, wallH - 2.5, 0, shell, false);
  // roller doors on the back wall
  [-30, 30].forEach((dx) => box(5, 5, 0.06, std(0x7f8b96, 0.6, 0.4), dx, 2.5, -Wz / 2 + 0.03, shell, false));
  // low kerb on open sides
  box(Lx, 0.25, 0.3, MAT.yellow, 0, 0.125, Wz / 2 + 0.15, shell);
  box(0.3, 0.25, Wz, MAT.yellow, Lx / 2 + 0.15, 0.125, 0, shell);

  // steel columns; roof trusses, lights and crane go in a group that hides when the camera is low
  const roof = group(scene);
  for (let cx = -Lx / 2; cx <= Lx / 2 + 0.01; cx += 8) {
    [-Wz / 2, Wz / 2].forEach((cz) => {
      box(0.45, H, 0.45, MAT.column, cx, H / 2, cz, shell);
      box(0.7, 0.3, 0.7, MAT.yellow, cx, 0.15, cz, shell);
    });
    box(0.25, 0.6, Wz, MAT.column, cx, H + 0.3, 0, roof, false);
    for (let k = -Wz / 2 + 3; k < Wz / 2; k += 6) box(0.1, 0.1, 6, MAT.column, cx, H - 0.2, k + 3, roof, false);
    for (let k = -Wz / 2 + 6; k < Wz / 2 - 2; k += 10) box(0.35, 0.08, 2.4, MAT.light, cx + 4, H - 0.6, k, roof, false);
  }
  for (let k = -Wz / 2; k <= Wz / 2; k += 12.5) box(Lx, 0.25, 0.2, MAT.column, 0, H + 0.6, k, roof, false);
  // overhead crane over the machining area (runway + bridge)
  const crY = H - 1.6;
  [-Wz / 2 + 1, 11].forEach((cz) => box(40, 0.5, 0.35, MAT.steelDark, -26, crY, cz, roof, false));
  box(0.6, 0.8, 11 + Wz / 2 - 1, MAT.yellow, -20, crY + 0.3, (11 + (-Wz / 2 + 1)) / 2, roof);
  box(1.0, 0.7, 1.0, MAT.dark, -20, crY - 0.3, -6, roof);
  cyl(0.02, 0.02, crY - 2.6, MAT.dark, -20, (crY + 2.6) / 2 - 0.3, -6, roof, 6, false);
  box(0.3, 0.3, 0.2, MAT.yellow, -20, 2.4, -6, roof);
  // offices / control room mezzanine in the corner
  box(10, 3.2, 6, std(0xd9dee3), Lx / 2 - 6, 1.6, -Wz / 2 + 4, shell);
  box(9.6, 1.2, 0.05, win, Lx / 2 - 6, 2.0, -Wz / 2 + 7.03, shell, false);
  return { roof, shell, height: H };
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function buildRawStock(scene, b, labelLayer) {
  const [x, z] = b.pos || [0, 0];
  const g = group(scene, x, 0, z);
  const kind = b.part;
  const pallets = [];
  for (let p = 0; p < 3; p++) {
    const pg = group(g, 0, 0, (p - 1) * 1.6);
    pallets.push(pg);
    box(1.2, 0.14, 1.2, MAT.wood, 0, 0.07, 0, pg);
    const n = kind === "tank" ? 1 : kind === "motor" ? 4 : kind === "crankcase" ? 4 : 9;
    const side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const part = makePart(kind);
      if (kind === "crankcase") part.traverse((o) => { if (o.material === MAT.castIron) o.material = MAT.rawCast; });
      if (kind === "cylinder") part.traverse((o) => { if (o.isMesh) o.material = MAT.rawCast; });
      const sp = 1.0 / side;
      part.position.set(kind === "tank" ? 0 : -0.5 + sp / 2 + (i % side) * sp, 0.14, kind === "tank" ? 0 : -0.5 + sp / 2 + Math.floor(i / side) * sp);
      pg.add(part);
    }
  }
  // pallet rack behind
  const rack = group(g, -2.6, 0, 0);
  [-2.4, 2.4].forEach((dz) => [-0.6, 0.6].forEach((dx) => box(0.1, 4.5, 0.1, MAT.blue, dx, 2.25, dz, rack)));
  [1.5, 3.0, 4.4].forEach((h) => [-0.6, 0.6].forEach((dx) => box(0.08, 0.12, 4.9, MAT.orange, dx, h, 0, rack)));
  const upper = [];
  [1.56, 3.06].forEach((h) => [-1.6, 0, 1.6].forEach((dz) => upper.push(box(1.1, 0.8, 1.1, MAT.woodDark, 0, h + 0.4, dz, rack))));
  const lbl = makeLabel(labelLayer);
  return {
    setCount(n, snapB) {
      if (b.infinite) { lbl.innerHTML = `${esc(b.name)} <b>∞</b>`; return; }
      // floor pallets show the stock level: 3 full pallets above 60 units
      pallets.forEach((p, i) => (p.visible = n > i * 30));
      upper.forEach((u, i) => (u.visible = n > 90 + i * 20));
      lbl.innerHTML = `${esc(snapB.name)} <b>${n}</b>`;
      lbl.classList.toggle("full", n === 0);
    },
    tick(dt, camera, W, H, show) { placeLabel(lbl, x, 2.2, z, camera, W, H, show, 40); },
  };
}

/* ------------------------------------------------- material handling */
function makeLabel(layer, extra = "") {
  const l = document.createElement("div");
  l.className = "lbl3d buf " + extra;
  l.style.display = "none";
  if (layer) layer.appendChild(l);
  return l;
}
const _pv = new THREE.Vector3();
function placeLabel(lbl, x, y, z, camera, W, H, show, maxDist) {
  let vis = show && camera.position.distanceTo(_pv.set(x, y, z)) < maxDist;
  if (vis) {
    _pv.project(camera);
    vis = _pv.z < 1 && Math.abs(_pv.x) < 1 && Math.abs(_pv.y) < 1;
  }
  lbl.style.display = vis ? "" : "none";
  if (vis) lbl.style.transform = `translate(-50%, -100%) translate(${((_pv.x + 1) / 2) * W}px, ${((1 - _pv.y) / 2) * H}px)`;
}
function seeded(n) {      // small deterministic shuffle so racks look naturally filled
  const a = [...Array(n).keys()];
  let s = 12345;
  for (let i = n - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Automated storage and retrieval system: two rack rows, a stacker crane in the
// aisle (travel + lift + telescopic fork) and an I/O conveyor where AGVs pick up / drop.
function buildASRS(scene, a, lay, bufs, labelLayer) {
  const Ln = a.length || 20, Ht = a.height || 8, levels = lay.levels, bays = lay.bays;
  const g = group(scene, a.pos[0], 0, a.pos[1]);
  g.rotation.y = ((a.rot || 0) * Math.PI) / 180;
  const bw = Ln / bays, lh = (Ht - 0.6) / levels, depth = 1.2, rowZ = 1.35;
  const upMat = std(0x2a5b8f, 0.5, 0.4), beamMat = MAT.orange;
  const upGeo = new THREE.BoxGeometry(0.09, Ht, 0.09);
  const ups = new THREE.InstancedMesh(upGeo, upMat, (bays + 1) * 4);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i <= bays; i++) for (const r of [-1, 1]) for (const d of [-0.5, 0.5]) {
    mtx.makeTranslation(-Ln / 2 + i * bw, Ht / 2, r * rowZ + d * depth); ups.setMatrixAt(k++, mtx);
  }
  ups.castShadow = true; g.add(ups);
  for (let l = 1; l <= levels; l++) for (const r of [-1, 1]) for (const d of [-0.5, 0.5])
    box(Ln, 0.1, 0.06, beamMat, 0, 0.1 + l * lh - 0.08, r * rowZ + d * depth, g, false);
  box(Ln + 2.4, 0.12, 0.2, MAT.steelDark, -0.6, 0.06, 0, g, false);                // floor rail
  box(Ln + 2.4, 0.12, 0.2, MAT.steelDark, -0.6, Ht + 0.15, 0, g, false);           // top guide rail
  // stored loads (instanced, coloured by part)
  const slots = 2 * bays * levels;
  const loadGeo = new THREE.BoxGeometry(bw * 0.78, lh * 0.62, depth * 0.82);
  const loads = new THREE.InstancedMesh(loadGeo, std(0xffffff, 0.8, 0.1), slots);
  const order = seeded(slots), pos = [];
  for (const r of [-1, 1]) for (let i = 0; i < bays; i++) for (let l = 0; l < levels; l++)
    pos.push([-Ln / 2 + (i + 0.5) * bw, 0.12 + l * lh + lh * 0.31, r * rowZ]);
  const col = new THREE.Color();
  loads.count = 0; loads.castShadow = true; g.add(loads);
  // stacker crane
  const crane = group(g, -Ln / 2 + 0.6, 0, 0);
  box(1.3, 0.4, 0.7, MAT.yellow, 0, 0.3, 0, crane);
  box(0.3, Ht - 0.2, 0.45, MAT.yellow, 0.35, Ht / 2, 0, crane);
  box(1.0, 0.25, 0.5, MAT.yellow, 0, Ht, 0, crane);
  box(0.4, 0.7, 0.3, MAT.dark, -0.45, 0.9, 0, crane);                              // control cabinet
  const lift = group(crane, -0.1, 0.6, 0);
  box(0.9, 0.12, 1.0, MAT.steelDark, 0, 0, 0, lift);
  const fork = box(0.7, 0.06, 0.9, MAT.steel, 0, 0.1, 0, lift);
  const carried = box(bw * 0.7, lh * 0.55, depth * 0.75, std(0xb98a52, 0.8, 0.1), 0, 0.1 + lh * 0.3, 0, lift);
  carried.visible = false;
  // I/O conveyor out of the aisle end towards the AGV pick-up point
  g.updateMatrixWorld(true);
  const endW = new THREE.Vector3(-Ln / 2, 0, 0).applyMatrix4(g.matrixWorld);
  const ioLen = Math.max(1.2, Math.hypot(a.io[0] - endW.x, a.io[1] - endW.z) - 0.9);
  box(ioLen, 0.65, 1.0, MAT.grey, -Ln / 2 - ioLen / 2, 0.33, 0, g);
  box(ioLen, 0.05, 0.9, MAT.steelDark, -Ln / 2 - ioLen / 2, 0.68, 0, g, false);
  const ioLoad = box(1.0, 0.6, 0.8, std(0xb98a52, 0.8, 0.1), -Ln / 2 - ioLen + 0.6, 1.0, 0, g);
  ioLoad.visible = false;
  // safety fence along the rack end
  box(0.04, 2.0, 2 * rowZ + depth, MAT.fence, -Ln / 2 - 0.25, 1.0, 0, g, false).renderOrder = 2;
  const lbl = makeLabel(labelLayer, "asrs");
  const top = new THREE.Vector3(0, Ht + 1.2, 0).applyMatrix4(g.matrixWorld);
  const counts = {};
  let snap = null, prog = 0, dirty = true;
  const partOf = Object.fromEntries(bufs.map((b) => [b.id, b.part]));
  return {
    id: a.id,
    bufferProxy(id) { return { setCount(n) { if (counts[id] !== n) { counts[id] = n; dirty = true; } }, tick() {} }; },
    update(s, full) {
      if (!s) return;
      // new crane job (progress went back) or idle: follow the twin; otherwise never go backwards
      prog = (!snap || !s.busy || s.progress < prog - 0.3) ? s.progress : Math.max(prog, s.progress);
      snap = s; snap.ts = full.time_scale; snap.paused = full.paused;
      if (dirty) {
        let n = 0;
        s.stock.forEach((st) => {
          const loadsN = Math.ceil(st.count / Math.max(1, st.unit_load));
          col.setHex(LOAD_COLOR[partOf[st.buffer]] || 0x999999);
          for (let i = 0; i < loadsN && n < slots; i++, n++) {
            const p = pos[order[n]];
            mtx.makeTranslation(p[0], p[1], p[2]); loads.setMatrixAt(n, mtx); loads.setColorAt(n, col);
          }
        });
        loads.count = n;
        loads.instanceMatrix.needsUpdate = true;
        if (loads.instanceColor) loads.instanceColor.needsUpdate = true;
        dirty = false;
      }
      lbl.innerHTML = `${esc(a.name)} <b>${s.used}/${s.slots}</b> slots · crane ${Math.round(s.util * 100)}%${s.queue ? ` · ${s.queue} waiting` : ""}`;
    },
    tick(dt, camera, W, H, show) {
      placeLabel(lbl, top.x, top.y, top.z, camera, W, H, show, 75);
      if (!snap) return;
      if (snap.busy && !snap.paused) prog = Math.min(1, prog + (dt * snap.ts) / snap.crane_cycle_s);
      const [bay, lev, side] = snap.target;
      const tx = -Ln / 2 + (bay + 0.5) * bw, ty = 0.6 + lev * lh, home = -Ln / 2 + 0.6;
      let x = home, y = 0.6, f = 0;
      if (snap.busy) {
        const p = prog;
        const e = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
        if (p < 0.4) { const u = e(p / 0.4); x = home + (tx - home) * u; y = 0.6 + (ty - 0.6) * u; }
        else if (p < 0.6) { x = tx; y = ty; f = Math.sin(((p - 0.4) / 0.2) * Math.PI); }
        else { const u = e((p - 0.6) / 0.4); x = tx + (home - tx) * u; y = ty + (0.6 - ty) * u; }
        // retrieval: carries a load on the way back; store: carries it on the way out
        carried.visible = snap.kind === "retrieve" ? p > 0.5 : p < 0.5;
      } else carried.visible = false;
      crane.position.x = x; lift.position.y = y;
      fork.position.z = f * (side ? 1 : -1) * 1.2;
      carried.position.z = fork.position.z;
      ioLoad.visible = snap.busy && ((snap.kind === "retrieve" && prog > 0.9) || (snap.kind === "store" && prog < 0.1));
    },
  };
}

// Linear pallet pool: a 2-level rack of fixture pallets and a rail-guided shuttle
// that brings loaded pallets to the machines' pallet changers.
function buildPalletPool(scene, pp, labelLayer) {
  const Ln = pp.length || 7, levels = pp.levels || 2;
  const g = group(scene, pp.pos[0], 0, pp.pos[1]);
  const bays = Math.max(2, Math.floor(Ln / 1.15)), bw = Ln / bays, lh = 1.15;
  for (let i = 0; i <= bays; i++) [-0.55, 0.55].forEach((dx) => box(0.08, levels * lh + 0.3, 0.08, MAT.blue, dx, (levels * lh + 0.3) / 2, -Ln / 2 + i * bw, g));
  for (let l = 0; l < levels; l++) [-0.55, 0.55].forEach((dx) => box(0.08, 0.1, Ln, MAT.orange, dx, 0.15 + l * lh, 0, g, false));
  const pallets = [];
  for (let l = 0; l < levels; l++) for (let i = 0; i < bays; i++) {
    const p = group(g, 0, 0.22 + l * lh, -Ln / 2 + (i + 0.5) * bw);
    box(0.85, 0.07, 0.85, MAT.steel, 0, 0.035, 0, p, false);
    box(0.16, 0.6, 0.44, MAT.steelDark, 0, 0.37, 0, p, false);
    const part = box(0.34, 0.26, 0.3, MAT.rawCast, 0.22, 0.25, 0, p, false);
    const tag = box(0.2, 0.12, 0.02, MAT.grey, 0.22, 0.25, 0.16, p, false);    // model colour label on the casting
    tag.visible = false;
    pallets.push({ p, part, tag });
  }
  // shuttle on a floor rail between the rack and the machines (rail_z = start / end of the rail)
  const sx = (pp.shuttle_x ?? pp.pos[0] + 2) - pp.pos[0];
  const rz = pp.rail_z ? [pp.rail_z[0] - pp.pos[1], pp.rail_z[1] - pp.pos[1]] : [2.6 - (Ln + 7) / 2, 2.6 + (Ln + 7) / 2];
  const railLen = rz[1] - rz[0];
  [-0.35, 0.35].forEach((d) => box(0.08, 0.06, railLen, MAT.steelDark, sx + d, 0.03, (rz[0] + rz[1]) / 2, g, false));
  const shuttle = group(g, sx, 0, 0);
  box(1.0, 0.45, 1.2, MAT.yellow, 0, 0.3, 0, shuttle);
  box(0.12, 2.6, 0.12, MAT.dark, -0.4, 1.5, -0.5, shuttle);
  box(0.12, 2.6, 0.12, MAT.dark, -0.4, 1.5, 0.5, shuttle);
  const lift = group(shuttle, 0, 0.6, 0);
  box(0.95, 0.07, 0.95, MAT.steel, 0, 0, 0, lift);
  const lp = box(0.34, 0.26, 0.3, MAT.rawCast, 0.22, 0.2, 0, lift, false);
  const lbl = makeLabel(labelLayer);
  let target = 0, lastSig = "", ty = 0.6;
  return {
    update(s) {
      const b = s.buffers.find((x) => x.id === pp.buffer);
      const pool = (s.handling.pools || []).find((x) => x.id === pp.pool);
      if (!b || !pool) return;
      const loaded = Math.min(pallets.length, b.count), empty = Math.min(pallets.length - loaded, pool.free);
      const vs = (b.units || []).map((u) => u[2]);
      pallets.forEach((x, i) => {
        x.p.visible = i < loaded + empty; x.part.visible = i < loaded;
        x.tag.visible = i < loaded && !!vs[i];
        if (x.tag.visible) x.tag.material = modelMat(vs[i]);
      });
      const sig = loaded + "/" + empty;
      if (sig !== lastSig) {                // a pallet moved: send the shuttle somewhere useful
        lastSig = sig;
        target = rz[0] + 0.6 + Math.random() * (railLen - 1.2);
        ty = 0.25 + Math.floor(Math.random() * levels) * lh;
        lp.visible = Math.random() > 0.4;
      }
      lbl.innerHTML = `Pallet pool <b>${loaded}</b> loaded · ${pool.free} empty · ${pool.in_use} in use`;
    },
    tick(dt, camera, W, H, show) {
      shuttle.position.z += Math.max(-dt * 2.5, Math.min(dt * 2.5, target - shuttle.position.z));
      lift.position.y += (ty - lift.position.y) * Math.min(1, dt * 2);
      placeLabel(lbl, pp.pos[0], levels * lh + 0.9, pp.pos[1], camera, W, H, show, 40);
    },
  };
}

// Gravity flow rack at the line side, filled by AGVs (kanban).
function buildFlowRack(scene, b, labelLayer) {
  const [x, z] = b.pos || [0, 0];
  const g = group(scene, x, 0, z);
  const len = 2.4, lv = 2;
  [[-0.5, -len / 2], [0.5, -len / 2], [-0.5, len / 2], [0.5, len / 2]].forEach(([dx, dz]) => box(0.07, 1.7, 0.07, MAT.blue, dx, 0.85, dz, g));
  const shelves = [];
  for (let l = 0; l < lv; l++) {
    const sh = group(g, 0, 0.45 + l * 0.7, 0);
    sh.rotation.x = 0; sh.rotation.z = -0.08;                 // inclined towards the machine (+x)
    box(1.05, 0.05, len, MAT.steelDark, 0, 0, 0, sh, false);
    shelves.push(sh);
  }
  const sp = { crankcase: 0.55, cylinder: 0.3, crankshaft: 0.32 }[b.part] || 0.5;
  const perRow = Math.max(1, Math.floor(len / sp)), cols = b.part === "crankcase" ? 1 : 2;
  const per = perRow * cols, items = [];
  for (let i = 0; i < Math.min(b.capacity || 8, per * lv); i++) {
    const l = Math.floor(i / per), j = i % per;
    const p = makePart(b.part);
    if (b.part !== "crankshaft") p.traverse((o) => { if (o.isMesh && o.material === MAT.castIron) o.material = MAT.rawCast; });
    p.position.set(cols === 1 ? 0 : (j % 2 ? 0.25 : -0.25), 0.03, -len / 2 + sp / 2 + Math.floor(j / cols) * sp);
    p.scale.setScalar(0.9);
    shelves[l].add(p); items.push(p);
  }
  const lbl = makeLabel(labelLayer);
  return {
    setCount(n, snapB) {
      // model of each place: oldest first, as in the twin buffer
      const vs = (snapB.units || []).map((u) => u[2]);
      items.forEach((p, i) => { p.visible = i < n; if (i < n) tagModel(p, vs[i], 0.9); });
      const byV = snapB.by_v && Object.keys(snapB.by_v).length > 1
        ? " · " + Object.entries(snapB.by_v).map(([v, k]) => `${esc(v)} ${k}`).join(" / ") : "";
      lbl.innerHTML = `${esc(snapB.name)} <b>${n}/${snapB.capacity}</b>${byV}${snapB.incoming ? ` · +${snapB.incoming} on AGV` : ""}`;
      lbl.classList.toggle("full", n === 0);
    },
    tick(dt, camera, W, H, show) { placeLabel(lbl, x, 2.1, z, camera, W, H, show, 38); },
  };
}

// Roller table where packed compressors wait for an AGV.
function buildOutStand(scene, b, labelLayer) {
  const [x, z] = b.pos || [0, 0];
  const g = group(scene, x, 0, z);
  const cap = Math.min(4, b.capacity || 3), len = cap * 1.0 + 0.4;
  box(1.2, 0.5, len, MAT.grey, 0, 0.25, 0, g);
  box(1.25, 0.06, len + 0.05, MAT.steelDark, 0, 0.53, 0, g, false);
  const crates = [];
  for (let i = 0; i < cap; i++) {
    const c = makePart("crate"); c.scale.setScalar(0.72);
    c.rotation.y = Math.PI / 2;
    c.position.set(0, 0.55, -len / 2 + 0.7 + i * 1.0); g.add(c); crates.push(c);
  }
  const lbl = makeLabel(labelLayer);
  return {
    setCount(n, snapB) {
      crates.forEach((c, i) => (c.visible = i < n));
      lbl.innerHTML = `${esc(snapB.name)} <b>${n}/${snapB.capacity}</b>`;
      lbl.classList.toggle("full", n >= snapB.capacity);
    },
    tick(dt, camera, W, H, show) { placeLabel(lbl, x, 1.9, z, camera, W, H, show, 38); },
  };
}

function buildCharger(scene, p) {
  const g = group(scene, p[0], 0, p[1]);
  box(1.6, 0.03, 2.0, std(0x1d4f86, 0.6, 0.1), 0, 0.015, 0, g, false);
  box(0.5, 1.3, 0.35, MAT.white, 0, 0.65, 1.15, g);
  box(0.36, 0.22, 0.02, MAT.screen, 0, 1.0, 0.96, g, false);
  box(0.5, 0.08, 0.37, MAT.blue, 0, 1.3, 1.15, g);
}

// AGV / AMR fleet: low vehicles with a lidar, status light and a load deck.
// Position comes from the twin; between updates the view drives the vehicle along
// its route itself (route + speed + time scale), so motion stays smooth.
function buildFleet(scene, n, parks, labelLayer) {
  const bodyMat = std(0x2b3036, 0.5, 0.3), deckMat = std(0xd9dde2, 0.6, 0.2);
  const list = [];
  for (let i = 0; i < n; i++) {
    const g = group(scene, ...(parks[i] ? [parks[i][0], 0, parks[i][1]] : [0, 0, 0]));
    box(1.3, 0.28, 0.85, bodyMat, 0, 0.2, 0, g);
    box(1.32, 0.05, 0.87, MAT.yellow, 0, 0.1, 0, g, false);
    box(1.2, 0.06, 0.8, deckMat, 0, 0.37, 0, g);
    cyl(0.07, 0.07, 0.08, MAT.dark, 0.58, 0.44, 0, g, 12);                 // lidar
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xcfd6dd, emissiveIntensity: 1.2 });
    box(0.04, 0.06, 0.6, lightMat, 0.66, 0.22, 0, g, false);
    box(0.04, 0.06, 0.6, lightMat, -0.66, 0.22, 0, g, false);
    [[-0.45, 0.43], [0.45, 0.43], [-0.45, -0.43], [0.45, -0.43]].forEach(([dx, dz]) => cyl(0.09, 0.09, 0.05, MAT.rubber, dx, 0.09, dz, g, 12).rotation.x = Math.PI / 2);
    const loads = {};
    list.push({ g, lightMat, loads, lbl: makeLabel(labelLayer, "agv"), path: null, dist: 0, speed: 0,
                tx: g.position.x, tz: g.position.z, heading: 0, snap: null });
  }
  function loadFor(a, part) {
    if (a.loads[part]) return a.loads[part];
    const lg = group(a.g, 0, 0.4, 0);
    if (part === "crate") { const c = makePart("crate"); c.scale.setScalar(0.62); lg.add(c); }
    else {
      box(1.0, 0.1, 0.75, MAT.wood, 0, 0.05, 0, lg, false);
      if (part === "cylinder") box(0.95, 0.45, 0.7, std(0x8f969c, 0.6, 0.5, { wireframe: true }), 0, 0.33, 0, lg, false);
      const n = part === "crankcase" ? 4 : part === "crankshaft" ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const p = makePart(part);
        p.traverse((o) => { if (o.isMesh && o.material === MAT.castIron) o.material = MAT.rawCast; });
        p.position.set(part === "crankshaft" ? 0 : -0.25 + (i % 2) * 0.5, 0.1 + (part === "crankshaft" ? i * 0.14 : 0),
                       part === "crankshaft" ? 0 : -0.25 + Math.floor(i / 2) * (n > 4 ? 0.25 : 0.5));
        lg.add(p);
      }
    }
    a.loads[part] = lg;
    return lg;
  }
  let ts = 20, paused = false;
  return {
    update(agvs, timeScale, isPaused) {
      ts = timeScale; paused = isPaused;
      agvs.forEach((s, i) => {
        const a = list[i]; if (!a) return;
        a.snap = s;
        if (s.path && s.path.length > 1) {
          const same = a.path && a.path.length === s.path.length && a.path.every((p, k) => p[0] === s.path[k][0] && p[1] === s.path[k][1]);
          a.path = s.path;
          // keep our own smooth progress unless we drifted far from the twin
          if (!same || Math.abs(a.dist - s.dist) > 3) a.dist = s.dist;
          a.speed = s.speed;
        } else { a.path = null; a.speed = 0; a.tx = s.x; a.tz = s.z; }
        Object.entries(a.loads).forEach(([k, lg]) => (lg.visible = !!(s.load && s.load.part === k)));
        if (s.load) loadFor(a, s.load.part).visible = true;
        a.lightMat.emissive.setHex(AGV_LIGHT[s.state] || 0xffffff);
        a.lbl.innerHTML = `${s.id} <b>${Math.round(s.battery)}%</b> · ${s.state.replace("_", " ").toLowerCase()}`;
        a.lbl.classList.toggle("full", s.battery < 25);
      });
    },
    tick(dt, camera, W, H, show) {
      list.forEach((a) => {
        let x = a.g.position.x, z = a.g.position.z, dx = 0, dz = 0;
        if (a.path) {
          let total = 0;
          const seg = [];
          for (let k = 1; k < a.path.length; k++) { const L = Math.hypot(a.path[k][0] - a.path[k - 1][0], a.path[k][1] - a.path[k - 1][1]); seg.push(L); total += L; }
          if (!paused) a.dist = Math.min(total, a.dist + a.speed * ts * dt);
          let d = a.dist;
          for (let k = 0; k < seg.length; k++) {
            if (d <= seg[k] || k === seg.length - 1) {
              const p0 = a.path[k], p1 = a.path[k + 1], f = seg[k] ? Math.min(1, d / seg[k]) : 1;
              x = p0[0] + (p1[0] - p0[0]) * f; z = p0[1] + (p1[1] - p0[1]) * f; dx = p1[0] - p0[0]; dz = p1[1] - p0[1];
              break;
            }
            d -= seg[k];
          }
        } else {
          const k = Math.min(1, dt * 4);
          dx = a.tx - x; dz = a.tz - z;
          x += dx * k; z += dz * k;
        }
        a.g.position.x = x; a.g.position.z = z;
        if (Math.hypot(dx, dz) > 0.05) {
          const want = -Math.atan2(dz, dx);
          let diff = want - a.heading;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          a.heading += diff * Math.min(1, dt * 8);
          a.g.rotation.y = a.heading;
        }
        placeLabel(a.lbl, x, 1.5, z, camera, W, H, show, 45);
      });
    },
  };
}

function buildWarehouse(scene, b) {
  const [x, z] = b.pos || [0, 0];
  const g = group(scene, x, 0, z);
  const bays = 6, levels = 3, rows = 2, bayW = 1.6, levH = 1.5;
  const slots = [];
  for (let r = 0; r < rows; r++) {
    const rz = (r - 0.5) * 3.2;
    for (let i = 0; i <= bays; i++) [-0.5, 0.5].forEach((d) => box(0.1, levels * levH + 0.3, 0.1, MAT.blue, (i - bays / 2) * bayW, (levels * levH + 0.3) / 2, rz + d * 1.0, g));
    for (let l = 0; l < levels; l++) {
      const y = l * levH + 0.12;
      if (l > 0) [-0.5, 0.5].forEach((d) => box(bays * bayW, 0.12, 0.08, MAT.orange, 0, y - 0.06, rz + d * 1.0, g));
      for (let i = 0; i < bays; i++) slots.push(new THREE.Vector3((i - bays / 2 + 0.5) * bayW, y, rz));
    }
  }
  const crates = slots.map((p) => { const c = makePart("crate"); c.scale.setScalar(0.85); c.position.copy(p); c.visible = false; g.add(c); return c; });
  // forklift
  const fl = group(g, 7, 0, 3.2);
  box(1.2, 0.8, 2.0, MAT.yellow, 0, 0.6, 0, fl);
  box(1.0, 1.2, 0.1, MAT.dark, 0, 1.6, 0.2, fl);
  box(1.0, 2.6, 0.1, MAT.dark, 0, 1.3, -1.05, fl);
  [-0.3, 0.3].forEach((dx) => box(0.12, 0.05, 1.1, MAT.steelDark, dx, 0.1, -1.6, fl));
  [[-0.55, 0.6], [0.55, 0.6], [-0.55, -0.6], [0.55, -0.6]].forEach(([dx, dz]) => cyl(0.25, 0.25, 0.2, MAT.rubber, dx, 0.25, dz, fl, 14).rotation.z = Math.PI / 2);
  return {
    setCount(n) { crates.forEach((c, i) => (c.visible = i < n)); },
    tick() {},
  };
}

const bufInfinite = {};
function buildConveyor(scene, b, prods, cons, rollers, labelLayer) {
  const cen = (arr) => arr.reduce((a, s) => [a[0] + s.pos[0] / arr.length, a[1] + s.pos[1] / arr.length], [0, 0]);
  const [sx, sz] = cen(prods);
  let [ex, ez] = cen(cons);
  // several inputs into the same station arrive side by side
  const c0 = cons[0];
  const ins = c0.inputs.filter((i) => !(bufInfinite[i.buffer]));
  const idx = ins.findIndex((i) => i.buffer === b.id);
  if (cons.length === 1 && ins.length > 1) ez += (idx - (ins.length - 1) / 2) * 1.3;
  const fs = FOOT[prods[0].model] || 2, fe = FOOT[c0.model] || 2;
  let pts;
  if (Math.abs(sz - ez) < 0.05) pts = [[sx, sz], [ex, ez]];
  else { const mx = (sx + ex) / 2; pts = [[sx, sz], [mx, sz], [mx, ez], [ex, ez]]; }
  const path = trim(pts, prods.length > 1 ? 0.0 : fs, cons.length > 1 ? 0.0 : fe);
  const g = group(scene);
  addConveyorPath(g, path, rollers);
  // stubs for parallel machines
  if (prods.length > 1) prods.forEach((p) => addConveyorPath(g, trim(stub(p.pos, [sx, sz]), FOOT[p.model] || 2, 0), rollers));
  if (cons.length > 1) cons.forEach((p) => addConveyorPath(g, trim(stub([ex, ez], p.pos), 0, FOOT[p.model] || 2), rollers));

  const segs = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], c = path[i], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    segs.push({ a, c, len, start: total }); total += len;
  }
  const spacing = { crankcase: 0.6, cylinder: 0.36, crankshaft: 0.35, pump: 0.85, compressor: 1.3 }[b.part] || 0.6;
  const slots = Math.max(1, Math.min(b.capacity, Math.floor((total - 0.3) / spacing)));
  const items = [];   // front (nearest consumer) first - same order as the twin buffer
  const leaving = []; // parts being picked into the next machine
  const pool = [];
  const lbl = document.createElement("div");
  lbl.className = "lbl3d buf";
  labelLayer.appendChild(lbl);
  const mid = pointAt(segs, total / 2);
  const v = new THREE.Vector3();
  const place = (obj, d) => {
    const p = pointAt(segs, d);
    obj.position.set(p.x, CONV_H + 0.04, p.z);
    obj.rotation.y = p.ang;
  };
  // transfer between machine and belt: a short lifted arc (unload / load by robot or operator)
  const startP = pointAt(segs, 0), endP = pointAt(segs, total);
  const arc = (obj, ax, az, ay, bx, bz, by, u) => {
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    obj.position.set(ax + (bx - ax) * e, ay + (by - ay) * e + Math.sin(Math.PI * u) * 0.7, az + (bz - az) * e);
  };
  const lastTotal = {}, lastItem = {};
  const newObj = () => pool.pop() || (() => { const o = makePart(b.part); g.add(o); return o; })();
  return {
    setCount(n, snapB, full) {
      const ms = full ? full.machines : [];
      // which machine just finished a part (it comes onto the belt from there) ...
      let origin = null, dest = null;
      prods.forEach((p) => {
        const m = ms.find((x) => x.id === p.id); if (!m) return;
        if (lastTotal[p.id] != null && m.counters.total > lastTotal[p.id]) origin = p;
        lastTotal[p.id] = m.counters.total;
      });
      // ... and which machine just took a new part (it leaves the belt there)
      cons.forEach((p) => {
        const m = ms.find((x) => x.id === p.id); if (!m) return;
        const id = m.item ? m.item.id : null;
        if (id && lastItem[p.id] !== undefined && id !== lastItem[p.id]) dest = p;
        lastItem[p.id] = id;
      });
      const vis = Math.min(n, slots);
      while (items.length > vis) {
        const it = items.shift();
        if (dest && leaving.length < 3) { it.t = 0; it.to = dest.pos; leaving.push(it); }
        else { it.obj.visible = false; setTag(it, null); pool.push(it.obj); }
      }
      while (items.length < vis) {
        const obj = newObj();
        obj.visible = true;
        const it = { obj, cur: 0, phase: origin ? "in" : "belt", t: 0, from: origin ? origin.pos : null };
        if (origin) obj.position.set(origin.pos[0], 1.0, origin.pos[1]); else place(obj, 0);
        items.push(it);
        origin = null;                          // only one part per update comes from the machine
      }
      items.forEach((it, i) => {
        const u = snapB.units && snapB.units[i];
        setTag(it, u && u[1] && TRACKED.has(u[1]) ? u[0] : null);
        tagModel(it.obj, u && u[2]);
      });
      lbl.innerHTML = `${esc(snapB.name)} <b>${n}/${snapB.capacity}</b>`;
      lbl.classList.toggle("full", n >= snapB.capacity);
    },
    tick(dt, camera, W, H, show) {
      items.forEach((it, i) => {
        if (it.phase === "in") {
          it.t = Math.min(1, it.t + dt / 0.8);
          arc(it.obj, it.from[0], it.from[1], 1.0, startP.x, startP.z, CONV_H + 0.04, it.t);
          it.obj.rotation.y = startP.ang;
          if (it.t >= 1) { it.phase = "belt"; it.cur = 0; }
          return;
        }
        const target = Math.max(0, total - 0.35 - i * spacing);
        if (it.cur < target) { it.cur = Math.min(target, it.cur + dt * 2.5); place(it.obj, it.cur); }
        else if (it.cur > target) { it.cur = target; place(it.obj, it.cur); }
      });
      for (let k = leaving.length - 1; k >= 0; k--) {
        const it = leaving[k];
        it.t = Math.min(1, it.t + dt / 0.8);
        arc(it.obj, endP.x, endP.z, CONV_H + 0.04, it.to[0], it.to[1], 1.0, it.t);
        if (it.t >= 1) { it.obj.visible = false; setTag(it, null); pool.push(it.obj); leaving.splice(k, 1); }
      }
      if (show) {
        const near = camera.position.distanceTo(v.set(mid.x, CONV_H, mid.z)) < 38;   // only when zoomed in
        v.set(mid.x, CONV_H + 0.9, mid.z).project(camera);
        const visible = near && v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1;
        lbl.style.display = visible ? "" : "none";
        if (visible) lbl.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * W}px, ${((1 - v.y) / 2) * H}px)`;
      }
    },
  };
}
// Blue serial-number tag above a unit of the order followed in the Order-flow tab
let TRACKED = new Set();
const tagCache = {};
function tagMaterial(sn) {
  if (tagCache[sn]) return tagCache[sn];
  const cv = document.createElement("canvas"); cv.width = 128; cv.height = 48;
  const x = cv.getContext("2d");
  x.fillStyle = "#2a78d6"; x.beginPath(); x.roundRect(2, 2, 124, 44, 10); x.fill();
  x.fillStyle = "#ffffff"; x.font = "bold 28px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText("#" + String(sn).split("-").pop().replace(/^0+(?=\d)/, ""), 64, 25);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return (tagCache[sn] = new THREE.SpriteMaterial({ map: tex, depthTest: false }));
}
function setTag(it, sn) {
  const u = it.obj.userData;          // parts are re-used, so the tag lives on the 3D object
  if ((u.tagSn || null) === (sn || null)) return;
  u.tagSn = sn || null;
  if (!sn) { if (u.tag) u.tag.visible = false; return; }
  if (!u.tag) {
    u.tag = new THREE.Sprite(tagMaterial(sn));
    u.tag.scale.set(0.8, 0.3, 1); u.tag.position.y = 0.9; u.tag.renderOrder = 5;
    it.obj.add(u.tag);
  }
  u.tag.material = tagMaterial(sn);
  u.tag.visible = true;
}
function stub(a, b) {
  if (Math.abs(a[0] - b[0]) < 0.05 || Math.abs(a[1] - b[1]) < 0.05) return [a, b];
  return [a, [a[0], b[1]], b];
}
function trim(pts, startCut, endCut) {
  const out = pts.map((p) => p.slice());
  const cut = (arr, d) => {
    while (d > 0 && arr.length > 1) {
      const [a, b] = arr, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > d + 0.3) { a[0] += ((b[0] - a[0]) / len) * d; a[1] += ((b[1] - a[1]) / len) * d; return; }
      if (arr.length === 2) { return; }
      arr.shift(); d -= len;
    }
  };
  cut(out, startCut);
  out.reverse(); cut(out, endCut); out.reverse();
  return out;
}
function pointAt(segs, d) {
  let s = segs[segs.length - 1];
  for (const x of segs) if (d <= x.start + x.len) { s = x; break; }
  const f = s.len ? Math.max(0, Math.min(1, (d - s.start) / s.len)) : 0;
  return { x: s.a[0] + (s.c[0] - s.a[0]) * f, z: s.a[1] + (s.c[1] - s.a[1]) * f, ang: -Math.atan2(s.c[1] - s.a[1], s.c[0] - s.a[0]) };
}
function addConveyorPath(g, pts, rollers) {
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.05) continue;
    const ang = -Math.atan2(bz - az, bx - ax);
    const seg = group(g, (ax + bx) / 2, 0, (az + bz) / 2);
    seg.rotation.y = ang;
    const ext = i < pts.length - 1 ? 0.45 : 0;   // overlap at corners
    [-0.42, 0.42].forEach((dz) => box(len + ext, 0.14, 0.06, MAT.steelDark, ext / 2, CONV_H - 0.05, dz, seg));
    for (let k = -len / 2 + 0.6; k < len / 2; k += 1.6)
      [-0.4, 0.4].forEach((dz) => box(0.06, CONV_H - 0.1, 0.06, MAT.grey, k, (CONV_H - 0.1) / 2, dz, seg, false));
    q.setFromEuler(new THREE.Euler(Math.PI / 2, ang, 0, "YXZ"));
    const dir = new THREE.Vector3(Math.cos(-ang), 0, Math.sin(-ang));
    for (let k = 0.15; k < len; k += 0.28) {
      const p = new THREE.Vector3(ax + dir.x * k, CONV_H - 0.03, az + dir.z * k);
      mtx.compose(p, q, sc);
      rollers.push(mtx.clone());
    }
  }
}
