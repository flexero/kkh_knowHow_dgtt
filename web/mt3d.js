/* Machine tools tab – simplified, ANIMATED 3D models of the machine-tool types (one model per sketch key `sk` of mt_data.js).
 * Each model shows the working principle: structure + workpiece (blue) + tool (amber) + beam / hot zone (orange-red),
 * and moves like the real machine (spindles turn, tables tilt, pallets change, wheels follow the crank pin …).
 * Not to scale in detail – roughly real size in mm.  Offline: local three.js + view3d.js niceControls.
 *   create(el, getState) -> { fit, dispose }      getState() -> { sk, name, labels } | null */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (u) => u * u * (3 - 2 * u);

/* ------------------------------------------------------------------ shared materials (created once, reused by every model) */
let MT = null;
function mats() {
  if (MT) return MT;
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? 0.3, roughness: o.r ?? 0.6, transparent: o.op != null, opacity: o.op ?? 1,
    emissive: o.em ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op == null });
  MT = {
    frame: m(0xc9d0d6, { m: 0.2, r: 0.55 }), frame2: m(0x9aa4ae, { m: 0.4, r: 0.45 }), dark: m(0x3a4048, { m: 0.4, r: 0.5 }), steel: m(0xb7bfc6, { m: 0.75, r: 0.3 }),
    part: m(0x4f8fd6, { m: 0.35, r: 0.4 }), tool: m(0xe1a32a, { m: 0.5, r: 0.35 }), hot: m(0xe8542a, { em: 0xe8542a, ei: 0.9 }), glow: m(0xffd27a, { em: 0xffb030, ei: 1.5 }),
    beam: m(0xff4a1a, { em: 0xff3a10, ei: 2, op: 0.85 }), jet: m(0x9fd0ff, { em: 0x6fa8d6, ei: 0.6, op: 0.8 }), glass: m(0xbcd4e6, { op: 0.18, ds: true, m: 0, r: 0.1 }),
    water: m(0x6fa8d6, { op: 0.28, ds: true, m: 0, r: 0.1 }), granite: m(0x55595e, { m: 0.1, r: 0.8 }), cbn: m(0x7a5a3a, { m: 0.2, r: 0.8 }), stone: m(0x6a6a6a, { m: 0.1, r: 0.9 }),
    white: m(0xeef1f4, { m: 0.1, r: 0.5 }), diamond: m(0xd6ecff, { m: 0.9, r: 0.05, em: 0x8fb8e0, ei: 0.3 }), weld: m(0xa08060, { m: 0.6, r: 0.5 }),
  };
  return MT;
}

/* ------------------------------------------------------------------ geometry helpers (Y = up, floor y = 0, mm) */
const grp = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); if (p) p.add(g); return g; };
const box = (w, h, d, m, x, y, z, p) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); if (p) p.add(o); return o; };
const cylY = (r, h, m, x, y, z, p, seg = 32, rt = r) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, r, h, seg), m); o.position.set(x, y, z); if (p) p.add(o); return o; };
const cylX = (r, h, m, x, y, z, p, seg = 32) => { const o = cylY(r, h, m, x, y, z, p, seg); o.rotation.z = Math.PI / 2; return o; };
const cylZ = (r, h, m, x, y, z, p, seg = 32) => { const o = cylY(r, h, m, x, y, z, p, seg); o.rotation.x = Math.PI / 2; return o; };
const sph = (r, m, x, y, z, p) => { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); o.position.set(x, y, z); if (p) p.add(o); return o; };
// gear-like disc (axis Y): body + n teeth
function gear(r, h, n, m, p, toothH = 12) {
  const g = grp(p); cylY(r - toothH * 0.5, h, m, 0, 0, 0, g, 48);
  for (let i = 0; i < n; i++) { const a = i / n * TAU, t = box(toothH * 1.2, h, (TAU * r / n) * 0.5, m, Math.cos(a) * r, 0, Math.sin(a) * r, g); t.rotation.y = -a; }
  return g;
}
// a strut (cylinder) between two world-ish points inside the same parent
const _up = new THREE.Vector3(0, 1, 0);
function strut(o, a, b) { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); o.position.copy(a).addScaledVector(d, 0.5); o.scale.set(1, L, 1); o.quaternion.setFromUnitVectors(_up, d.normalize()); }
// common base: machine bed / enclosure floor plate
const bed = (w, h, d, p, M, x = 0, z = 0) => box(w, h, d, M.frame2, x, h / 2, z, p);

/* ------------------------------------------------------------------ builders: each returns { root, upd(t), lbl: [[text, object, dy]] } */
const B = {};

B.trunnion = (M) => { // 5-axis VMC with A/C trunnion table
  const root = grp(), L = [];
  bed(1800, 700, 1300, root, M); box(700, 2000, 600, M.frame, 0, 1700, -500, root);
  const head = grp(root, 0, 1650, -120); box(380, 520, 420, M.frame, 0, 0, 0, head); cylY(70, 140, M.steel, 0, -330, 0, head); const tool = cylY(18, 160, M.tool, 0, -470, 0, head, 12);
  [-400, 400].forEach((x) => box(90, 420, 360, M.frame2, x, 910, 120, root));
  const cradle = grp(root, 0, 1020, 120); box(700, 60, 380, M.dark, 0, -120, 0, cradle); [-330, 330].forEach((x) => box(50, 200, 380, M.dark, x, -40, 0, cradle));
  const tab = grp(cradle, 0, -70, 0); cylY(170, 40, M.steel, 0, 0, 0, tab, 40); box(200, 140, 160, M.part, 0, 90, 0, tab); cylY(40, 40, M.part, 50, 180, 0, tab);
  L.push(["Spindle", head, 300], ["A-axis cradle (tilt)", cradle, -180], ["C-axis rotary table", tab, 200]);
  return { root, lbl: L, upd: (t) => { cradle.rotation.x = 0.55 * Math.sin(t * 0.45); tab.rotation.y = t * 0.6; tool.rotation.y = t * 25; head.position.x = 120 * Math.sin(t * 0.7); head.position.y = 1650 + 40 * Math.sin(t * 1.1); } };
};

B.vmc = (M) => { // high-speed vertical machining centre
  const root = grp(), L = [];
  bed(1700, 750, 1100, root, M); box(650, 2100, 550, M.frame, 0, 1800, -420, root);
  const tab = grp(root, 0, 790, 80); box(1100, 60, 500, M.steel, 0, 0, 0, tab); box(500, 120, 300, M.part, 0, 90, 0, tab);
  const head = grp(root, 0, 1500, -90); box(340, 500, 380, M.frame, 0, 0, 0, head); cylY(60, 120, M.steel, 0, -310, 0, head); const tool = cylY(8, 120, M.tool, 0, -430, 0, head, 10);
  L.push(["Motor spindle 24 000–42 000 rpm", head, 300], ["Table (X / Y)", tab, 160]);
  return { root, lbl: L, upd: (t) => { tool.rotation.y = t * 60; tab.position.x = 300 * Math.sin(t * 1.4); tab.position.z = 80 + 90 * Math.sin(t * 2.1); head.position.y = 1500 - 20 + 15 * Math.sin(t * 3); } };
};

B.hmc = (M) => { // horizontal machining centre + 2-pallet rotary APC
  const root = grp(), L = [];
  bed(3200, 600, 1400, root, M, -300); box(650, 1900, 800, M.frame, 700, 1550, 0, root);
  const head = grp(root, 330, 1250, 0); box(420, 420, 420, M.frame, 0, 0, 0, head); const sp = cylX(70, 200, M.steel, -300, 0, 0, head); const tool = cylX(20, 180, M.tool, -480, 0, 0, head, 12);
  const arm = grp(root, -650, 640, 0); box(1300, 40, 140, M.dark, 0, 0, 0, arm); cylY(90, 80, M.dark, 0, -40, 0, arm);
  const pal = [450, -450].map((x) => { const g = grp(arm, x, 40, 0); box(500, 40, 500, M.steel, 0, 0, 0, g); const tb = grp(g, 0, 20, 0); box(260, 560, 260, M.frame2, 0, 280, 0, tb);
    [[0, 160, 131], [0, 400, 131], [0, 160, -131], [0, 400, -131]].forEach(([x2, y2, z2]) => box(180, 160, 30, M.part, x2, y2, z2, tb)); return tb; });
  box(600, 640, 600, M.frame, -1100, 320, 0, root);
  L.push(["Horizontal spindle", head, 300], ["Pallet changer (APC)", arm, 120], ["B-axis + tombstone", pal[0], 700], ["Load station", pal[1], 700]);
  return { root, lbl: L, view: [-0.85, 0.55, 0.9], upd: (t) => {
    tool.rotation.x = t * 25; sp.rotation.x = t * 25;
    const T = 16, n = Math.floor(t / T), ph = t - n * T, k = n % 2;
    if (ph < 12) { arm.rotation.y = n * Math.PI; arm.position.y = 640; pal[k].rotation.y = Math.floor(ph / 3) * Math.PI / 2 + ease(clamp((ph % 3) / 0.8, 0, 1)) * Math.PI / 2; head.position.x = 330 - 60 * Math.sin(ph * 2); }
    else { const u = (ph - 12) / 4; arm.position.y = 640 + 60 * Math.sin(Math.PI * u); arm.rotation.y = (n + ease(clamp((u - 0.15) / 0.7, 0, 1))) * Math.PI; head.position.x = 330; }
  } };
};

B.gantry = (M) => { // gantry 5-axis
  const root = grp(), L = [];
  box(4200, 500, 1700, M.frame2, 0, 250, 0, root); box(3000, 300, 1100, M.part, 0, 650, 0, root);
  [-1150, 1150].forEach((z) => box(4400, 300, 260, M.frame, 0, 1250, z, root));
  const g = grp(root, 0, 0, 0); [-1150, 1150].forEach((z) => box(350, 700, 300, M.frame, 0, 1750, z, g)); box(400, 380, 2600, M.frame, 0, 2280, 0, g);
  const car = grp(g, 0, 2280, 0); box(420, 900, 380, M.dark, 220, -250, 0, car); const hd = grp(car, 220, -760, 0); box(260, 240, 260, M.frame2, 0, 0, 0, hd); const tool = cylY(20, 200, M.tool, 0, -200, 0, hd, 12);
  L.push(["Bridge (gantry)", g, 2550], ["2-axis milling head", hd, -60], ["Large part", root, 900]);
  return { root, lbl: L, upd: (t) => { g.position.x = 1200 * Math.sin(t * 0.25); car.position.z = 350 * Math.sin(t * 0.4); hd.rotation.z = 0.4 * Math.sin(t * 0.6); tool.rotation.y = t * 25; } };
};

B.vtl = (M) => { // vertical turning lathe
  const root = grp(), L = [];
  cylY(900, 500, M.frame2, 0, 250, 0, root, 48); const tab = grp(root, 0, 560, 0); cylY(700, 100, M.steel, 0, 0, 0, tab, 48);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(550, 550, 350, 48, 1, true), M.part); ring.position.y = 230; tab.add(ring); cylY(560, 30, M.part, 0, 70, 0, tab, 48); [-200, 200].forEach((x) => box(60, 40, 60, M.dark, x, 70, 400, tab));
  [-1100, 1100].forEach((x) => box(350, 2600, 450, M.frame, x, 1300, -500, root)); box(2600, 350, 400, M.frame, 0, 2300, -500, root);
  const ram = grp(root, 300, 1700, -350); box(220, 1000, 220, M.dark, 0, 0, 0, ram); box(60, 60, 120, M.tool, 0, -530, 80, ram);
  L.push(["Rotating table", tab, 120], ["Ram + turning tool", ram, 600], ["Cross rail", root, 2520]);
  return { root, lbl: L, upd: (t) => { tab.rotation.y = t * 1.4; ram.position.y = 1530 + 120 * (0.5 + 0.5 * Math.sin(t * 0.5)); ram.position.x = 480 + 60 * Math.sin(t * 0.25); } };
};

B.lathe = (M) => { // turning centre with driven tools
  const root = grp(), L = [];
  box(2600, 900, 900, M.frame2, 0, 450, 0, root); box(700, 650, 700, M.frame, -1000, 1225, 0, root);
  const sp = grp(root, -560, 1200, 0); cylX(200, 180, M.steel, 0, 0, 0, sp, 6); const wp = cylX(60, 720, M.part, 450, 0, 0, sp, 32); box(30, 120, 20, M.dark, 450, 0, 70, sp);
  box(300, 300, 300, M.frame, 700, 1200, 0, root); cylX(40, 160, M.steel, 500, 1200, 0, root);
  const tur = grp(root, 0, 1050, 380); const disc = cylZ(230, 120, M.dark, 0, 0, 0, tur, 12); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; box(30, 60, 30, M.tool, Math.cos(a) * 250, Math.sin(a) * 250, -60, tur); }
  L.push(["Main spindle + chuck", sp, 260], ["Turret with driven tools", tur, 320], ["Tailstock", root, 1400]);
  return { root, lbl: L, upd: (t) => { sp.rotation.x = t * 12; tur.position.x = -150 + 300 * (0.5 + 0.5 * Math.sin(t * 0.35)); tur.position.z = 330 - 20 * Math.sin(t * 0.7); disc.rotation.z = Math.floor(t / 6) * TAU / 12; } };
};

B.swiss = (M) => { // Swiss-type sliding headstock lathe
  const root = grp(), L = [];
  box(2200, 900, 800, M.frame2, 0, 450, 0, root);
  const hs = grp(root, -600, 1150, 0); box(420, 400, 420, M.frame, 0, 0, 0, hs); const bar = cylX(16, 1300, M.part, 650, 0, 0, hs, 20);
  box(120, 420, 360, M.dark, 0, 1150, 0, root); cylX(40, 130, M.steel, 0, 1150, 0, root);
  const gang = grp(root, 120, 1150, 0); [-1, 1].forEach((s) => [0, 60, 120].forEach((x) => box(20, 140, 20, M.tool, x + 20, s * 90, 0, gang)));
  box(400, 380, 380, M.frame, 900, 1150, 0, root);
  L.push(["Guide bushing", root, 1400], ["Sliding headstock", hs, 260], ["Gang tools", gang, 180]);
  return { root, lbl: L, upd: (t) => { const ph = (t % 5) / 5; hs.position.x = -650 + 200 * ph; bar.rotation.x = t * 30; gang.children.forEach((c, i) => { c.position.y = (i < 3 ? -1 : 1) * (90 - (i % 3 === Math.floor(t / 5) % 3 ? 55 : 0)); }); } };
};

B.millturn = (M) => { // mill-turn: turning spindles + B-axis milling head
  const root = grp(), L = [];
  box(3400, 900, 1000, M.frame2, 0, 450, 0, root); box(600, 650, 700, M.frame, -1300, 1225, 0, root); box(500, 600, 650, M.frame, 1350, 1200, 0, root);
  const sp = grp(root, -900, 1200, 0); cylX(190, 160, M.steel, 0, 0, 0, sp, 6); const wp = cylX(80, 1900, M.part, 1050, 0, 0, sp, 32); [400, 800, 1300].forEach((x) => cylX(95, 80, M.part, x, 0, 0, sp, 32));
  box(3200, 200, 260, M.frame, 0, 2050, -450, root);
  const car = grp(root, 0, 2050, -300); box(420, 300, 300, M.dark, 0, 0, 0, car); const bh = grp(car, 0, -300, 120); box(220, 380, 220, M.frame, 0, -60, 0, bh); const tool = cylY(18, 160, M.tool, 0, -320, 0, bh, 12);
  const low = grp(root, 300, 950, 420); cylZ(200, 100, M.dark, 0, 0, 0, low, 10);
  L.push(["B-axis milling head", bh, 250], ["Main spindle (C-axis)", sp, 260], ["Lower turret", low, 260], ["Sub spindle", root, 1550]);
  return { root, lbl: L, upd: (t) => { const mill = Math.floor(t / 6) % 2 === 0; sp.rotation.x = mill ? Math.floor(t * 0.5) * 0.4 : t * 10; car.position.x = 500 * Math.sin(t * 0.3); bh.rotation.z = 0.9 * Math.sin(t * 0.4); tool.rotation.y = t * 25; low.position.x = 200 + 300 * Math.sin(t * 0.25); } };
};

B.grind = (M) => { // crankshaft pin-chasing grinding
  const root = grp(), L = [];
  box(3000, 900, 1400, M.frame2, 0, 450, 0, root); box(500, 500, 500, M.frame, -1200, 1200, 0, root); box(400, 400, 400, M.frame, 1200, 1200, 0, root);
  const cs = grp(root, 0, 1200, 0), e = 70; // crank throw
  [-800, -300, 200, 700].forEach((x) => cylX(45, 120, M.part, x, 0, 0, cs)); [-550, -50, 450].forEach((x, i) => { const a = i * TAU / 3; [-80, 80].forEach((d) => box(40, 230, 160, M.part, x + d, Math.cos(a) * e * 0.5, Math.sin(a) * e * 0.5, cs).rotation.x = a); cylX(40, 120, M.part, x, Math.cos(a) * e, Math.sin(a) * e, cs); });
  cylX(30, 1900, M.part, 0, 0, 0, cs, 16);
  const wh = grp(root, -550, 1200, -500); const wd = cylX(320, 40, M.cbn, 0, 0, 0, wh, 48); cylX(60, 200, M.steel, 0, 0, 0, wh); box(300, 300, 400, M.dark, 250, 0, -250, wh);
  L.push(["CBN wheel", wh, 380], ["Crankshaft (pin chasing)", cs, 220], ["Workhead", root, 1500]);
  return { root, lbl: L, upd: (t) => { const th = t * 0.8; cs.rotation.x = th; wd.rotation.x = -t * 30;
    const k = Math.floor(t / 10) % 3, a = th + k * TAU / 3, pz = Math.sin(a) * e; wh.position.x = [-550, -50, 450][k]; wh.position.z = pz - 365; wh.position.y = 1200 + Math.cos(a) * e * 0.15; } };
};

B.hone = (M) => { // honing a cylinder bore
  const root = grp(), L = [];
  box(1400, 800, 1200, M.frame2, 0, 400, 0, root); box(500, 2200, 500, M.frame, 0, 1900, -500, root);
  const blk = grp(root, 0, 800, 0); [[-1, 0], [1, 0]].forEach(([s]) => box(250, 400, 600, M.part, s * 225, 200, 0, blk)); [[-1], [1]].forEach(([s]) => box(200, 400, 250, M.part, 0, 200, s * 225, blk));
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(100, 100, 400, 40, 1, true), M.steel); bore.position.set(0, 200, 0); blk.add(bore);
  const hd = grp(root, 0, 1700, -250); box(260, 300, 300, M.dark, 0, 0, 0, hd);
  const tl = grp(root, 0, 1200, 0); cylY(30, 700, M.steel, 0, 300, 0, tl, 16); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; box(14, 180, 24, M.stone, Math.cos(a) * 88, -50, Math.sin(a) * 88, tl).rotation.y = -a; }
  L.push(["Honing tool (expanding stones)", tl, 120], ["Cylinder bore", blk, 450], ["Stroke + rotation drive", hd, 200]);
  return { root, lbl: L, upd: (t) => { tl.rotation.y = t * 4; tl.position.y = 1080 - 120 * (0.5 + 0.5 * Math.sin(t * 2.2)); } };
};

B.skiving = (M) => { // power skiving: gear + tilted cutter rotate in sync
  const root = grp(), L = [];
  box(1800, 800, 1400, M.frame2, 0, 400, 0, root); box(700, 1900, 600, M.frame, 0, 1750, -600, root);
  const tab = grp(root, 0, 900, 100); cylY(330, 80, M.dark, 0, -40, 0, tab, 48); const gw = gear(260, 120, 40, M.part, tab, 18); gw.position.y = 60;
  const sp = grp(root, 0, 1200, 100 - 260 - 70); sp.rotation.x = 0.35; box(200, 500, 220, M.dark, 0, 320, -120, sp);
  const cut = gear(70, 50, 14, M.tool, sp, 14); cut.position.y = 0;
  L.push(["Gear (workpiece)", tab, 160], ["Skiving cutter – crossing angle", sp, 120]);
  return { root, lbl: L, upd: (t) => { const w = t * 0.6; gw.rotation.y = w; cut.rotation.y = -w * 40 / 14; sp.position.y = 1015 - 20 * Math.sin(t * 0.3); } };
};

B.laser = (M) => { // fibre-laser cutting machine (also used for the ultrashort-pulse laser card)
  const root = grp(), L = [];
  box(3400, 700, 1800, M.frame2, 0, 350, 0, root); box(3000, 12, 1500, M.part, 0, 712, 0, root);
  [-950, 950].forEach((z) => box(3600, 160, 160, M.frame, 0, 880, z, root));
  const br = grp(root, 0, 0, 0); box(220, 260, 2100, M.frame, 0, 1100, 0, br);
  const hd = grp(br, 0, 1100, 0); box(180, 240, 200, M.dark, 160, 0, 0, hd); const cone = cylY(50, 160, M.steel, 160, -200, 0, hd, 16, 20);
  const beam = cylY(4, 1, M.beam, 160, 0, 0, hd, 8); const spot = sph(14, M.glow, 160, -386, 0, hd);
  const cut = []; for (let i = 0; i < 80; i++) { const c = box(14, 4, 14, M.dark, 0, 721, 0, root); c.visible = false; cut.push(c); }
  L.push(["Laser cutting head", hd, 180], ["Sheet", root, 760], ["Gantry with linear drives", br, 1300]);
  const path = (s) => { const u = s % 1, r = 380; return u < 0.5 ? [Math.cos(u * 2 * TAU) * r - 600, Math.sin(u * 2 * TAU) * r] : [ -200 + (u - 0.5) * 2 * 1200, (Math.floor((u - 0.5) * 8) % 2 ? 1 : -1) * 300]; };
  return { root, lbl: L, upd: (t) => { const [x, z] = path(t * 0.04); hd.position.z = z; br.position.x = x - 160;
    beam.scale.y = 300; beam.position.y = -270; spot.material.emissiveIntensity = 1.2 + 0.5 * Math.sin(t * 40);
    const i = Math.floor(t * 8) % cut.length; cut[i].visible = true; cut[i].position.set(x, 720, z); } };
};

B.wedm = (M) => { // wire EDM
  const root = grp(), L = [];
  box(2000, 800, 1600, M.frame2, 0, 400, 0, root); box(1200, 500, 1000, M.water, 0, 1050, 200, root); box(600, 2000, 600, M.frame, 0, 1800, -650, root);
  const tab = grp(root, 0, 900, 200); box(700, 40, 500, M.steel, 0, 0, 0, tab); const wp = box(400, 200, 300, M.part, 0, 120, 0, tab);
  box(120, 120, 700, M.dark, 0, 1450, -250, root); box(120, 120, 700, M.dark, 0, 820, -250, root);
  const wire = cylY(2, 520, M.tool, 0, 1135, 100, root, 6);
  const sparks = []; for (let i = 0; i < 10; i++) sparks.push(sph(6, M.glow, 0, 0, 0, root));
  L.push(["Wire Ø 0.25 mm", wire, 300], ["Upper + lower guides", root, 1550], ["Part in dielectric water", tab, 260]);
  return { root, lbl: L, upd: (t) => { tab.position.x = 120 * Math.sin(t * 0.3); tab.position.z = 200 + 80 * Math.sin(t * 0.21);
    sparks.forEach((s) => { s.visible = Math.random() < 0.6; s.position.set((Math.random() - 0.5) * 10, 1040 + Math.random() * 180, 100 + (Math.random() - 0.5) * 10); }); } };
};

B.waterjet = (M) => { // abrasive waterjet
  const root = grp(), L = [];
  box(3200, 750, 1800, M.water, 0, 375, 0, root); box(3200, 30, 1800, M.dark, 0, 760, 0, root); box(2600, 40, 1300, M.part, 0, 795, 0, root);
  [-950, 950].forEach((z) => box(3400, 160, 160, M.frame, 0, 900, z, root));
  const br = grp(root); box(220, 220, 2100, M.frame, 0, 1100, 0, br); const hd = grp(br, 160, 1100, 0); box(160, 220, 160, M.dark, 0, 0, 0, hd); cylY(20, 220, M.steel, 0, -220, 0, hd, 12, 10);
  const jet = cylY(4, 470, M.jet, 0, -565, 0, hd, 8);
  L.push(["Cutting head 4 000–6 000 bar", hd, 200], ["Catcher tank (water)", root, 500], ["Plate", root, 850]);
  return { root, lbl: L, upd: (t) => { br.position.x = 900 * Math.sin(t * 0.25); hd.position.z = 450 * Math.sin(t * 0.37); jet.scale.x = jet.scale.z = 1 + 0.3 * Math.sin(t * 50); } };
};

B.hybrid = (M) => { // hybrid DED + milling in one machine
  const root = grp(), L = [];
  bed(2000, 700, 1300, root, M); box(800, 2100, 600, M.frame, 0, 1750, -520, root);
  const tab = grp(root, 0, 780, 120); cylY(260, 60, M.steel, 0, 0, 0, tab, 40); box(300, 120, 300, M.part, 0, 90, 0, tab); const dep = box(200, 200, 200, M.part, 0, 250, 0, tab);
  const ded = grp(root, -200, 1500, 0); cylY(60, 260, M.steel, 0, 0, 0, ded, 16, 20); const melt = sph(22, M.glow, 0, -150, 0, ded); box(160, 200, 160, M.dark, 0, 220, 0, ded);
  const sp = grp(root, 220, 1500, 0); box(200, 300, 220, M.frame, 0, 120, 0, sp); const tool = cylY(18, 180, M.tool, 0, -100, 0, sp, 12);
  L.push(["DED head (laser + powder)", ded, 360], ["Milling spindle", sp, 320], ["Deposited metal", tab, 420]);
  return { root, lbl: L, upd: (t) => { const ph = (t % 12) / 12, add = ph < 0.5; tab.rotation.y = t * 0.5;
    const g = add ? 0.35 + 0.65 * (ph / 0.5) : 1; dep.scale.y = g; dep.position.y = 150 + 100 * g;
    ded.position.set(add ? 0 : -400, add ? 1050 + 200 * g : 1600, 120); melt.visible = add; sp.position.set(add ? 400 : 0, add ? 1600 : 1050 + 200 * 1, 120); tool.rotation.y = t * 30; } };
};

B.ultra = (M) => { // ultrasonic-assisted machining
  const root = grp(), L = [];
  bed(1600, 750, 1100, root, M); box(620, 2000, 520, M.frame, 0, 1750, -420, root);
  const tab = grp(root, 0, 790, 80); box(900, 50, 500, M.steel, 0, 0, 0, tab); box(400, 80, 300, M.white, 0, 65, 0, tab);
  const head = grp(root, 0, 1400, -60); box(320, 460, 360, M.frame, 0, 0, 0, head); const holder = grp(head, 0, -300, 0); cylY(55, 140, M.dark, 0, 0, 0, holder); const tool = cylY(10, 110, M.tool, 0, -125, 0, holder, 10);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(80, 4, 8, 32), M.glow); ring.rotation.x = Math.PI / 2; ring.position.y = -60; holder.add(ring);
  L.push(["Ultrasonic tool holder 20–50 kHz", holder, 140], ["Ceramic / glass part", tab, 140]);
  return { root, lbl: L, upd: (t) => { tool.rotation.y = t * 30; holder.position.y = -300 + 6 * Math.sin(t * 90); ring.scale.setScalar(1 + 0.25 * ((t * 3) % 1)); ring.material.opacity = 1; tab.position.x = 250 * Math.sin(t * 0.6); } };
};

B.diamond = (M) => { // ultra-precision diamond turning
  const root = grp(), L = [];
  box(2000, 900, 1300, M.granite, 0, 450, 0, root); box(2300, 1600, 1600, M.glass, 0, 900 + 800, 0, root);
  const sp = grp(root, -400, 1150, 0); cylX(150, 380, M.steel, 0, 0, 0, sp, 40); const disc = cylX(140, 40, M.part, 210, 0, 0, sp, 48);
  const sl = grp(root, 350, 980, 0); box(500, 80, 500, M.dark, 0, 0, 0, sl); box(100, 120, 60, M.frame2, -120, 100, 0, sl); const dt = new THREE.Mesh(new THREE.ConeGeometry(14, 40, 4), M.diamond); dt.rotation.z = Math.PI / 2; dt.position.set(-190, 170, 0); sl.add(dt);
  L.push(["Air-bearing spindle", sp, 220], ["Diamond tool on hydrostatic slide", sl, 240], ["Granite base", root, 980]);
  return { root, lbl: L, upd: (t) => { disc.rotation.x = t * 20; sp.rotation.x = t * 20; sl.position.z = 120 * Math.sin(t * 0.2); sl.position.x = 350 - 30 * (0.5 + 0.5 * Math.sin(t * 0.2)); } };
};

B.pkm = (M) => { // hexapod (parallel kinematics)
  const root = grp(), L = [];
  box(2000, 500, 1600, M.frame2, 0, 250, 0, root); box(700, 200, 500, M.part, 0, 600, 0, root);
  [[-900, -700], [900, -700], [-900, 700], [900, 700]].forEach(([x, z]) => box(160, 2400, 160, M.frame, x, 1450, z, root)); const top = cylY(650, 80, M.frame, 0, 2600, 0, root, 6);
  const plat = grp(root, 0, 1300, 0); cylY(220, 60, M.dark, 0, 0, 0, plat, 6); cylY(70, 220, M.steel, 0, -140, 0, plat); const tool = cylY(18, 160, M.tool, 0, -330, 0, plat, 12);
  const topA = [], botA = [], struts = [];
  for (let i = 0; i < 6; i++) { const a = (Math.floor(i / 2) * 120 + (i % 2 ? 15 : -15)) * Math.PI / 180, b = (Math.floor(((i + 1) % 6) / 2) * 120 + (i % 2 ? -45 : 45)) * Math.PI / 180;
    topA.push(new THREE.Vector3(Math.cos(a) * 580, 2560, Math.sin(a) * 580)); botA.push(new THREE.Vector3(Math.cos(b) * 200, 0, Math.sin(b) * 200));
    const s = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, 1, 12), i % 2 ? M.steel : M.frame2); root.add(s); struts.push(s); }
  L.push(["6 struts (variable length)", top, -300], ["Moving platform + spindle", plat, 160]);
  return { root, lbl: L, upd: (t) => { plat.position.set(260 * Math.sin(t * 0.5), 1350 + 80 * Math.sin(t * 0.9), 200 * Math.cos(t * 0.5)); plat.rotation.x = 0.15 * Math.sin(t * 0.7); plat.rotation.z = 0.15 * Math.cos(t * 0.6); plat.updateMatrix(); tool.rotation.y = t * 25;
    struts.forEach((s, i) => { const b = botA[i].clone().applyMatrix4(plat.matrix); strut(s, topA[i], b); }); } };
};

B.fsw = (M) => { // friction stir welding
  const root = grp(), L = [];
  box(3000, 700, 1400, M.frame2, 0, 350, 0, root); box(2400, 20, 500, M.part, 0, 710, -252, root); box(2400, 20, 500, M.part, 0, 710, 252, root);
  [-1, 1].forEach((s) => box(2400, 40, 80, M.dark, 0, 740, s * 460, root));
  const bead = box(1, 4, 30, M.weld, -1100, 722, 0, root);
  const g = grp(root); [-650, 650].forEach((z) => box(250, 900, 250, M.frame, 0, 1150, z, g)); box(300, 300, 1550, M.frame, 0, 1700, 0, g);
  const hd = grp(g, 0, 1300, 0); box(260, 500, 260, M.dark, 0, 120, 0, hd); const tl = grp(hd, 0, -200, 0); cylY(60, 120, M.steel, 0, 0, 0, tl, 24); cylY(14, 50, M.tool, 0, -85, 0, tl, 12); const heat = sph(50, M.hot, 0, -110, 0, hd); heat.scale.y = 0.3;
  L.push(["Rotating pin + shoulder", hd, -250], ["Aluminium plates", root, 760], ["Joint (no melting)", bead, 40]);
  return { root, lbl: L, upd: (t) => { const u = (t % 20) / 20, x = -1100 + 2200 * u; g.position.x = x; tl.rotation.y = t * 30; bead.scale.x = Math.max(1, 2200 * u); bead.position.x = -1100 + 1100 * u; } };
};

/* ------------------------------------------------------------------ the view */
export function create(el, getState) {
  const M = mats();
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 480;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0); el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xd8d6cf, metalness: 0, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20000, 20000), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -1; scene.add(floor);
  if (window.dtTheme) { window.dtTheme.scene(scene, "#e9edf1", "#1c2126"); window.dtTheme.floor(floorMat); }
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 5, 60000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(3000, 6000, 4000); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement); const nice = niceControls(controls, camera, scene, { minDist: 200, maxDist: 30000 });
  const css = "position:absolute;font-size:12px;background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:3px 8px;";
  const info = document.createElement("div"); info.style.cssText = css + "left:10px;bottom:10px;pointer-events:none;max-width:70%;"; el.appendChild(info);
  const fitBtn = document.createElement("button"); fitBtn.className = "btn ghost"; fitBtn.textContent = "Fit view"; fitBtn.style.cssText = "position:absolute;right:10px;top:8px;"; el.appendChild(fitBtn);
  const lblBox = document.createElement("div"); lblBox.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;"; el.appendChild(lblBox);
  let cur = null, key = "", lbls = [], dead = false; const t0 = performance.now();
  const fit = () => { if (!cur) return; const b = new THREE.Box3().setFromObject(cur.root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    if (nice && nice.stop) nice.stop(); controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(...(cur.view || [0.75, 0.5, 0.95])).normalize().multiplyScalar(s * 1.05)); camera.near = s / 100; camera.far = s * 40; camera.updateProjectionMatrix(); controls.update(); };
  fitBtn.addEventListener("click", fit);
  const disposeModel = () => { if (!cur) return; scene.remove(cur.root); cur.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); cur = null; };
  const rebuild = (st) => {
    disposeModel(); const fn = B[st.sk] || B.vmc; cur = fn(M); scene.add(cur.root); cur.upd(0);
    lblBox.innerHTML = ""; lbls = cur.lbl.map(([txt, obj, dy]) => { const d = document.createElement("div"); d.textContent = txt; d.style.cssText = css + "transform:translate(-50%,-100%);white-space:nowrap;"; lblBox.appendChild(d); return { d, obj, dy }; });
    fit();
  };
  const v = new THREE.Vector3();
  const loop = () => {
    if (dead) return; requestAnimationFrame(loop);
    if (!el.offsetParent) return;
    const st = getState(); if (!st || !st.sk) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (w && h && (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    if (st.sk !== key) { key = st.sk; rebuild(st); }
    cur.upd((performance.now() - t0) / 1000);
    info.textContent = st.name || st.sk;
    const show = st.labels !== false; lblBox.style.display = show ? "" : "none";
    if (show) lbls.forEach((l) => { l.obj.getWorldPosition(v); v.y += l.dy || 0; v.project(camera); const vis = v.z < 1; l.d.style.display = vis ? "" : "none"; l.d.style.left = ((v.x + 1) / 2 * w) + "px"; l.d.style.top = ((1 - v.y) / 2 * h) + "px"; });
    controls.update(); renderer.render(scene, camera);
  };
  loop();
  const dispose = () => { dead = true; disposeModel(); renderer.dispose(); el.innerHTML = ""; };
  return { fit, dispose };
}
export const MT3D_KEYS = Object.keys(B);
