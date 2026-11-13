/* AS/RS item 7 – 3D simulation of the 3-stage telescopic fork on the lifting carriage (Three.js, offline).
 * Same fork as items 1 / 6: 2 tines at ± 0.25 m, 3 stages × 1.0 m (widths 170 / 140 / 110 mm), stroke ± 1.35 m.
 * Drive (default): gear motor → synchronising shaft → 2 pinions → racks on the middle stages (s); 2 chains per tine anchored on the base
 * and on the top stage, running over sprockets on the middle stage → top stage 2·s ("pulley block" stroke doubling).
 * World = item-7 coordinates: X = fork direction (L = −X), Y = up, Z = along the aisle. Carriage space: tine top = Y 0.
 *   createFork3D(el, opts) → { setState(st), setView(v), setDesign(d), follow(on), forces(on), labels(on), setFault(f), counts(), snapshot(), resize(), S }
 * Rendering on demand only. ALL VALUES ARE EXAMPLES – the fork maker's data decides.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { FG, CR, RK, POS } from "./asrsfork_calc.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const bx = (sx, sy, sz, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const cylZ = (r, len, seg = 20) => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2);   // axis along Z
const cylX = (r, len, seg = 20) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2);   // axis along X
const ease = (t) => t * t * (3 - 2 * t);

export function createFork3D(el, opts = {}) {
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 560;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0);
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8ecf0);
  const camera = new THREE.PerspectiveCamera(36, W0 / H0, 0.02, 120);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9096, 1.35));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5); sun.position.set(5, 9, 7); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-6, 4, -5); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene, { minDist: 0.08, maxDist: 30 });
  let dirty = true; const mark = () => { dirty = true; };
  controls.addEventListener("change", mark);

  /* ---------------- materials (grouped by role so X-ray can fade the structure and keep the drive train) */
  const allMats = [];
  const M = (c, role, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.5, metalness: o.m ?? 0.3 }); m.userData.role = role; allMats.push(m); return m; };
  const MAT = {
    upright: M(0x3d6fb6, "rack"), beam: M(0xe2731c, "rack"), guide: M(0xc9ced3, "rack", { m: 0.6 }), floor: M(0xb9bec4, "floor", { r: 0.9, m: 0 }),
    crate: M(0x8fa3b8, "crate", { r: 0.6, m: 0.4 }), crateHi: M(0xd9a441, "crate", { r: 0.55, m: 0.35 }), runner: M(0x5c6670, "crate", { m: 0.6 }), cast: M(0x6f87a6, "crate", { r: 0.7, m: 0.4 }),
    mast: M(0xd5d9dd, "carr"), carr: M(0xf0b323, "carr"), carrDark: M(0x6b7178, "carr"),
    base: M(0x7f8890, "stage", { m: 0.55 }), mid: M(0xa9b1b8, "stage", { m: 0.55 }), top: M(0xc9ced3, "stage", { m: 0.55 }), strip: M(0x2e3338, "strip", { r: 0.35, m: 0.8 }), pad: M(0x3a3f44, "strip", { r: 0.8, m: 0 }),
    rack: M(0x2e8b57, "drive", { m: 0.7, r: 0.35 }), pinion: M(0xd62828, "drive", { m: 0.7, r: 0.35 }), shaft: M(0x8a2be2, "drive", { m: 0.7 }), motor: M(0x2f5a8a, "drive"), brake: M(0x1d1f21, "drive"),
    spr: M(0x1f6fd1, "drive", { m: 0.7, r: 0.3 }), chain: M(0x23272b, "chain", { m: 0.85, r: 0.3 }), belt: M(0x111111, "chain", { r: 0.8, m: 0 }), anchor: M(0xff7f0e, "drive"),
    roller: M(0xf2c200, "drive", { m: 0.6, r: 0.35 }), rubber: M(0x1d1f21, "drive", { r: 0.9, m: 0 }),
    sensor: M(0x26313b, "sens"), lens: M(0x3fbf5f, "sens"), red: M(0xd62828, "sens"), obst: M(0xc0392b, "crate"), flag: M(0xf5f5f5, "rack"),
  };
  const meshes = [];
  const add = (geo, mat, parent, part) => { const m = new THREE.Mesh(geo, mat); m.userData.part = part || ""; parent.add(m); meshes.push(m); return m; };

  /* ---------------- rack (both sides, 3 bays × 2 crates × 3 levels) + floor */
  const rackG = new THREE.Group(); scene.add(rackG);
  const z0 = RK.bayZ[0], z1 = RK.bayZ[RK.bayZ.length - 1];
  add(bx(5.6, 0.02, z1 - z0 + 2.4, 0, -0.01, (z0 + z1) / 2), MAT.floor, rackG, "floor");
  add(bx(0.12, 0.03, z1 - z0 + 2.4, 0, 0.015, (z0 + z1) / 2), MAT.carrDark, rackG, "rail");
  const crateGeo = { body: bx(CR.Lx - 0.01, CR.H - CR.runH - 0.01, CR.W - 0.01, 0, (CR.H - CR.runH) / 2, 0), floor: bx(CR.Lx, 0.008, CR.W, 0, 0.004, 0),
    run: bx(CR.Lx, CR.runH, CR.runW, 0, -CR.runH / 2, 0), cast: new THREE.CylinderGeometry(0.11, 0.13, 0.26, 14) };
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x3b4650, transparent: true, opacity: 0.7 });
  const crateEdges = new THREE.EdgesGeometry(crateGeo.body);
  function makeCrate(hi) {
    const g = new THREE.Group();
    add(crateGeo.body, hi ? MAT.crateHi : MAT.crate, g, "crate"); add(crateGeo.floor, MAT.runner, g, "crate");
    const e = new THREE.LineSegments(crateEdges, edgeMat); e.userData.noPick = true; g.add(e);
    for (const s of [-1, 1]) add(crateGeo.run, MAT.runner, g, "runner").position.z = s * CR.runZ;
    for (const [x, z] of [[-0.32, -0.18], [0, 0.18], [0.32, -0.18]]) { const c = add(crateGeo.cast, MAT.cast, g, "crate"); c.position.set(x, 0.14, z); }
    return g;
  }
  const levels = RK.levels, upH = levels[2] + 0.85;
  for (const sg of [-1, 1]) {
    for (const zu of RK.bayZ) for (const xu of [RK.xF, RK.xR]) add(bx(0.07, upH, 0.10, sg * xu, upH / 2, zu), MAT.upright, rackG, "upright");
    for (let b = 0; b < RK.bayZ.length - 1; b++) {
      const za = RK.bayZ[b] + 0.05, zb = RK.bayZ[b + 1] - 0.05, span = zb - za;
      for (const yb of levels) {
        for (const xu of [RK.xF, RK.xR]) add(bx(RK.beamW, RK.beamH, span, sg * xu, yb - RK.beamH / 2, (za + zb) / 2), MAT.beam, rackG, "beam");
        for (const zc of [RK.crateZ[2 * b], RK.crateZ[2 * b + 1]]) {
          for (const dz of [-1, 1]) {   // load guides (centring) on the front beam with a 45° lead-in
            const zg = zc + dz * (CR.W / 2 + CLRg + 0.01);
            add(bx(0.30, 0.07, 0.02, sg * (RK.xF + 0.12), yb + 0.035, zg), MAT.guide, rackG, "loadGuide");
            const lead = add(bx(0.06, 0.07, 0.02, 0, 0, 0), MAT.guide, rackG, "loadGuide"); lead.position.set(sg * (RK.xF - 0.04), yb + 0.035, zg - dz * 0.012); lead.rotation.y = sg * dz * Math.PI / 4;
          }
          add(bx(0.02, 0.10, 0.20, sg * (RK.xR + 0.085), yb + 0.05, zc), MAT.guide, rackG, "rearStop");   // rear stop
          add(bx(0.004, 0.05, 0.05, sg * (RK.xF - 0.04), yb - 0.06, zc - 0.43), MAT.flag, rackG, "flag");   // positioning flag
        }
      }
    }
  }
  /* static crates: all slots except the pick slot (L, z = 0, level 2) and the target slot (R, z = 1.925, level 3) */
  const staticCr = [];
  for (const sg of [-1, 1]) for (let li = 0; li < 3; li++) for (const zc of RK.crateZ) {
    if (sg < 0 && li === 1 && zc === POS.zL) continue;
    if (sg > 0 && li === 2 && zc === POS.zR) continue;
    if ((li === 0 && zc === RK.crateZ[0] && sg < 0) || (li === 2 && zc === RK.crateZ[5] && sg < 0) || (li === 1 && zc === RK.crateZ[3] && sg > 0)) continue;  // a few empty slots
    const c = makeCrate(false); c.position.set(sg * FG.stroke, levels[li] + CR.runH, zc); rackG.add(c); staticCr.push(c);
  }
  /* fault props: crate in the target slot (double storage), fallen casting in slot L */
  const extraCrate = makeCrate(false); extraCrate.position.set(FG.stroke, POS.bR + CR.runH, POS.zR); extraCrate.visible = false; scene.add(extraCrate);
  const obst = new THREE.Group(); scene.add(obst); obst.visible = false;
  add(bx(0.16, 0.10, 0.30, -1.48, POS.bL + 0.05 + 0.03, FG.tineZ), MAT.obst, obst, "obstacle");
  add(bx(1.2, 0.006, 0.40, -1.35, POS.bL + 0.03, FG.tineZ), MAT.guide, obst, "obstacle");

  /* ---------------- crane: mast + lifting carriage + fork */
  const crane = new THREE.Group(); scene.add(crane);
  add(bx(0.35, 4.6, 0.5, 0, 2.3 + 0.2, -0.75), MAT.mast, crane, "mast");
  for (const s of [-1, 1]) add(bx(0.03, 4.6, 0.02, s * 0.12, 2.5, -0.49), MAT.carrDark, crane, "mast");
  add(bx(0.9, 0.18, 2.9, 0, 0.12, -0.5), MAT.carr, crane, "mast");
  const carr = new THREE.Group(); crane.add(carr);
  /* carriage frame */
  add(bx(0.62, 1.0, 0.04, 0, 0.25, -0.44), MAT.carr, carr, "carriage");
  for (const s of [-1, 1]) {
    add(bx(0.06, 0.10, 0.96, s * 0.36, -0.20, 0.02), MAT.carr, carr, "carriage");
    add(bx(0.06, 1.0, 0.06, s * 0.36, 0.25, 0.50), MAT.carr, carr, "carriage");
    for (const zc of [-FG.tineZ, FG.tineZ]) add(bx(0.06, 0.07, FG.wB, s * 0.36, -0.115, zc), MAT.carrDark, carr, "carriage");
    for (const y of [-0.2, 0.6]) { const r = add(cylX(0.045, 0.04, 16), MAT.rubber, carr, "carriage"); r.position.set(s * 0.13, y, -0.485); }
  }
  add(bx(0.78, 0.06, 0.06, 0, 0.75, 0.50), MAT.carr, carr, "carriage");
  /* fork: 2 tines */
  const midG = new THREE.Group(), topG = new THREE.Group(); carr.add(midG); carr.add(topG);
  const rot = { pin: [], spr: [], rollB: [], rollM: [], shaft: [] };
  const L = FG.L, half = L / 2;
  const drv = { rack: [], pin: [], fw: [], dchain: [], dspr: [] };
  for (const zc of [-FG.tineZ, FG.tineZ]) {
    const out = Math.sign(zc);
    /* base stage = U-channel: bottom plate + 2 side rails, hardened guide strips on top */
    add(bx(L, 0.008, FG.wB, 0, -0.076, zc), MAT.base, carr, "base");
    for (const s of [-1, 1]) { add(bx(L, 0.018, 0.045, 0, -0.063, zc + s * 0.0625), MAT.base, carr, "base"); add(bx(L, 0.002, 0.03, 0, -0.053, zc + s * 0.0625), MAT.strip, carr, "strip"); }
    for (const x of [-half + 0.0125, half - 0.0125]) for (const s of [-1, 1]) { const r = add(cylZ(0.011, 0.016, 14), MAT.roller, carr, "roller"); r.position.set(x, -0.058, zc + s * 0.0625); rot.rollB.push(r); }
    for (const D of [1, -1]) { const zp = zc + (D > 0 ? out : -out) * FG.chainDz; add(bx(0.03, 0.012, 0.012, -D * FG.anc, -0.054 + 0.0, zp), MAT.anchor, carr, "anchorB"); }
    for (const x of [-half + 0.02, half - 0.02]) add(bx(0.02, 0.02, 0.02, x, -0.09, zc + out * 0.07), MAT.sensor, carr, "endSwitch");
    /* middle stage */
    add(bx(L, 0.024, FG.wM, 0, -0.040, zc), MAT.mid, midG, "mid");
    add(bx(L, 0.002, 0.024, 0, -0.027, zc - 0.045), MAT.strip, midG, "strip"); add(bx(L, 0.002, 0.024, 0, -0.027, zc + 0.045), MAT.strip, midG, "strip");
    const rk = add(bx(L, 0.010, 0.02, 0, -0.057, zc), MAT.rack, midG, "rack"); drv.rack.push(rk);
    const nT = Math.floor(L / (Math.PI * 0.002));
    const teeth = new THREE.InstancedMesh(bx(0.0028, 0.0045, 0.02), MAT.rack, nT); const mm = new THREE.Matrix4();
    for (let k = 0; k < nT; k++) { mm.makeTranslation(-half + (k + 0.5) * Math.PI * 0.002, -0.0642, zc); teeth.setMatrixAt(k, mm); }
    teeth.userData.part = "rack"; midG.add(teeth); meshes.push(teeth); drv.rack.push(teeth);
    for (const D of [1, -1]) {
      const zp = zc + (D > 0 ? out : -out) * FG.chainDz;
      const sp = new THREE.Group(); sp.position.set(D * FG.spr, FG.chainY, zp); midG.add(sp);
      add(cylZ(FG.sprR - 0.002, 0.006, 18), MAT.spr, sp, "sprocket");
      for (let k = 0; k < 9; k++) { const t = add(bx(0.006, 0.006, 0.006), MAT.spr, sp, "sprocket"); const a = k / 9 * Math.PI * 2; t.position.set(Math.cos(a) * FG.sprR, Math.sin(a) * FG.sprR, 0); t.rotation.z = a; }
      add(cylZ(0.004, Math.abs(zp - zc) - 0.06, 8).translate(0, 0, -(zp - zc) / 2 + Math.sign(zp - zc) * 0.03), MAT.carrDark, sp, "sprocket");
      rot.spr.push(sp);
    }
    for (const x of [-half + 0.0125, half - 0.0125]) for (const s of [-1, 1]) { const r = add(cylZ(0.009, 0.014, 14), MAT.roller, midG, "roller"); r.position.set(x, -0.026, zc + s * 0.045); rot.rollM.push(r); }
    add(bx(0.03, 0.012, 0.004, 0, -0.045, zc + out * 0.072), MAT.flag, midG, "centreFlag");
    /* top stage = tine */
    add(bx(L, 0.026, FG.wT, 0, -0.013, zc), MAT.top, topG, "top");
    for (const s of [-1, 1]) add(bx(L - 0.06, 0.003, 0.03, 0, 0.0015, zc + s * 0.035), MAT.pad, topG, "pad");
    for (const s of [-1, 1]) { const tip = add(bx(0.03, 0.02, FG.wT, s * (half + 0.012), -0.016, zc), MAT.top, topG, "top"); tip.scale.y = 0.8; }
    for (const D of [1, -1]) { const zp = zc + (D > 0 ? out : -out) * FG.chainDz; const sz = Math.sign(zp - zc);
      add(bx(0.03, 0.006, 0.032, -D * FG.anc, -0.010, zc + sz * 0.068), MAT.anchor, topG, "anchorT"); add(bx(0.03, 0.022, 0.008, -D * FG.anc, -0.020, zp), MAT.anchor, topG, "anchorT"); }
    /* 2 pinions per tine at x = ± 0.30 m (rack 1 000 mm, middle stroke 675 mm → one central pinion would lose mesh; one of the two is always in mesh) */
    for (const px of [-FG.pinX, FG.pinX]) {
      const pg = new THREE.Group(); pg.position.set(px, FG.pinY, zc); carr.add(pg); rot.pin.push(pg);
      const pin = new THREE.Group(); pg.add(pin); drv.pin.push(pin);
      add(cylZ(FG.pinR - 0.003, 0.02, 20), MAT.pinion, pin, "pinion");
      for (let k = 0; k < 20; k++) { const t = add(bx(0.004, 0.005, 0.02), MAT.pinion, pin, "pinion"); const a = k / 20 * Math.PI * 2; t.position.set(Math.cos(a) * (FG.pinR - 0.001), Math.sin(a) * (FG.pinR - 0.001), 0); t.rotation.z = a; }
      const fw = add(cylZ(0.020, 0.03, 24), MAT.rubber, pg, "frictionWheel"); fw.visible = false; drv.fw.push(fw);
      const ds = new THREE.Group(); pg.add(ds); ds.visible = false; drv.dspr.push(ds);
      add(cylZ(0.014, 0.008, 18), MAT.spr, ds, "driveSprocket");
    }
  }
  /* 2 synchronising shafts (x = ± 0.30) coupled by a short chain; helical-bevel gear motor (hollow shaft) on the shaft at − 0.30 */
  for (const px of [-FG.pinX, FG.pinX]) {
    const shaft = new THREE.Group(); shaft.position.set(px, FG.pinY, 0); carr.add(shaft); rot.shaft.push(shaft);
    add(cylZ(0.009, 2 * FG.tineZ + 0.04, 14), MAT.shaft, shaft, "shaft"); add(bx(0.004, 0.022, 0.03, 0, 0, 0.16), MAT.anchor, shaft, "shaft");
    add(cylZ(0.024, 0.008, 18).translate(0, 0, 0.10), MAT.spr, shaft, "couplingChain");
  }
  for (const dy of [-0.024, 0.024]) add(bx(2 * FG.pinX, 0.006, 0.007, 0, FG.pinY + dy, 0.10), MAT.chain, carr, "couplingChain");
  add(bx(0.11, 0.10, 0.10, -FG.pinX, -0.105, 0), MAT.motor, carr, "gearbox");
  const mot = add(cylX(0.055, 0.17, 22), MAT.motor, carr, "motor"); mot.position.set(-FG.pinX + 0.145, -0.12, 0);
  add(cylX(0.058, 0.04, 22).translate(-FG.pinX + 0.25, -0.12, 0), MAT.brake, carr, "brake"); add(cylX(0.035, 0.03, 16).translate(-FG.pinX + 0.285, -0.12, 0), MAT.sensor, carr, "encoder");
  /* all-chain / belt drive strand (fixed to the middle stage of both tines) + idlers */
  for (const zc of [-FG.tineZ, FG.tineZ]) {
    const dch = new THREE.InstancedMesh(bx(FG.pitch * 0.85, 0.006, 0.008), MAT.chain, Math.floor(L / FG.pitch)); const mm = new THREE.Matrix4();
    for (let k = 0; k < dch.count; k++) { mm.makeTranslation(-half + (k + 0.5) * FG.pitch, -0.066, zc); dch.setMatrixAt(k, mm); }
    dch.visible = false; dch.userData.part = "driveChain"; midG.add(dch); meshes.push(dch); drv.dchain.push(dch);
  }
  /* sensors on the carriage */
  const sensG = new THREE.Group(); carr.add(sensG);
  for (const s of [-1, 1]) {
    add(bx(0.03, 0.04, 0.03, s * (CR.Lx / 2 + 0.03), 0.12, -0.40), MAT.sensor, sensG, "overhang"); add(bx(0.03, 0.04, 0.03, s * (CR.Lx / 2 + 0.03), 0.12, 0.47), MAT.sensor, sensG, "overhang");
    add(bx(0.05, 0.05, 0.05, s * 0.40, 0.30, 0.47), MAT.sensor, sensG, "occupancy"); add(cylX(0.012, 0.01).translate(s * 0.428, 0.30, 0.47), MAT.lens, sensG, "occupancy");
    add(bx(0.04, 0.04, 0.04, s * 0.30, -0.06, 0), MAT.sensor, sensG, "loadOnFork");
    add(bx(0.04, 0.05, 0.04, s * 0.33, -0.20, -0.40), MAT.sensor, sensG, "finePos");
  }
  add(bx(0.03, 0.02, 0.03, 0, -0.05, FG.tineZ + 0.072 + 0.022), MAT.sensor, sensG, "centreSensor");
  /* sensor beams (lines) */
  const lineM = (c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthTest: true });
  const mkLine = (p, q, c) => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p), new THREE.Vector3(...q)]); const l = new THREE.Line(g, lineM(c)); l.userData.noPick = true; sensG.add(l); return l; };
  const ovL = mkLine([-(CR.Lx / 2 + 0.03), 0.12, -0.40], [-(CR.Lx / 2 + 0.03), 0.12, 0.47], 0x2e9e57), ovR = mkLine([CR.Lx / 2 + 0.03, 0.12, -0.40], [CR.Lx / 2 + 0.03, 0.12, 0.47], 0x2e9e57);
  const occL = mkLine([-0.43, 0.30, 0.47], [-1.95, 0.25, 0.0], 0x2e9e57), occR = mkLine([0.43, 0.30, 0.47], [1.95, 0.25, 0.0], 0x2e9e57);
  occL.visible = occR.visible = false;
  /* chains: 4 chains (2 tines × 2 directions), instanced links; belts = same paths, continuous strip */
  const CH = []; for (const zc of [-FG.tineZ, FG.tineZ]) for (const D of [1, -1]) { const out = Math.sign(zc); CH.push({ zc, D, z: zc + (D > 0 ? out : -out) * FG.chainDz }); }
  const NL = Math.ceil((2 * (FG.spr + FG.anc) + Math.PI * FG.sprR + 0.06) / FG.pitch) + 2;
  const linkGeo = bx(FG.pitch * 0.92, 0.0075, 0.006), beltGeo = bx(FG.pitch * 1.02, 0.0025, 0.012);
  const chainIM = new THREE.InstancedMesh(linkGeo, MAT.chain, NL * CH.length), beltIM = new THREE.InstancedMesh(beltGeo, MAT.belt, NL * CH.length);
  chainIM.userData.part = "chain"; beltIM.userData.part = "belt"; beltIM.visible = false;
  [chainIM, beltIM].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); carr.add(m); meshes.push(m); });
  const hiLink = add(new THREE.BoxGeometry(FG.pitch * 1.2, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0xffd400 }), carr, "chainLink"); hiLink.visible = false;
  const hiRing = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0025, 8, 24), new THREE.MeshBasicMaterial({ color: 0xffd400 })); hiRing.visible = false; carr.add(hiRing);
  const HI = { chain: 2, k: 48 };   // the highlighted link: tine +Z, chain that pulls to R (outer side), link no. 48 – goes over the sprocket when the fork extends to L
  function chainPt(c, u, sMid, sTop, o) {
    const r = FG.sprR, ab = -c.D * FG.anc, xs = sMid + c.D * FG.spr, at = sTop - c.D * FG.anc, yl = FG.chainY - r, yh = FG.chainY + r;
    const l1 = Math.max(0, c.D * (xs - ab)), arc = Math.PI * r;
    if (u < l1) { o.x = ab + c.D * u; o.y = yl; o.a = 0; o.st = "lower"; }
    else if (u < l1 + arc) { const p = (u - l1) / r; o.x = xs + c.D * r * Math.sin(p); o.y = FG.chainY - r * Math.cos(p); o.a = c.D * p; o.st = "arc"; }
    else { const w = u - l1 - arc; o.x = xs - c.D * w; o.y = yh; o.a = Math.PI; o.st = "upper"; }
    o.len = l1 + arc + Math.max(0, c.D * (xs - at));
    return o;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), P0 = {};
  function updChains(sMid, sTop) {
    const IM = S.design === "belt" ? beltIM : chainIM; let n = 0;
    CH.forEach((c, ci) => {
      chainPt(c, 0, sMid, sTop, P0); const len = P0.len, step = FG.pitch;
      for (let k = 0; k < NL; k++) {
        const u = (k + 0.5) * step;
        if (u > len) { _m.makeScale(0, 0, 0); IM.setMatrixAt(n++, _m); continue; }
        chainPt(c, u, sMid, sTop, P0); _e.set(0, 0, P0.a); _q.setFromEuler(_e); _p.set(P0.x, P0.y, c.z); _m.compose(_p, _q, _s); IM.setMatrixAt(n++, _m);
        if (ci === HI.chain && k === HI.k) { hiLink.position.set(P0.x, P0.y, c.z); hiLink.rotation.z = P0.a; hiRing.position.set(P0.x, P0.y, c.z); S.linkState = P0.st; }
      }
    });
    IM.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- moving crate */
  const crateM = makeCrate(true); scene.add(crateM);

  /* ---------------- forces (arrows in carriage space, tine +Z) */
  const forceG = new THREE.Group(); forceG.visible = false; carr.add(forceG);
  const arrows = {}; const mkArrow = (k, c) => { const a = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.1, c, 0.03, 0.018); a.traverse((o) => { o.userData.noPick = true; if (o.material) { o.material.depthTest = false; o.material.transparent = true; } o.renderOrder = 20; }); forceG.add(a); arrows[k] = a; };
  [["F", 0xd62828], ["R1f", 0x1f6fd1], ["R1r", 0x1f6fd1], ["R2f", 0x2e9e57], ["R2r", 0x2e9e57], ["T", 0xff7f0e], ["Fr", 0x8a2be2]].forEach(([k, c]) => mkArrow(k, c));
  const KN = 0.12;   // m of arrow per kN
  function setArrow(k, x, y, dirY, kN, dirX = 0) { const a = arrows[k]; const len = Math.max(0.02, Math.abs(kN) * KN); const d = new THREE.Vector3(dirX, dirX ? 0 : dirY, 0).normalize();
    a.setDirection(d); a.setLength(len, Math.min(0.035, len * 0.35), 0.02); a.position.set(x - d.x * len, y - d.y * len, FG.tineZ + 0.11); a.visible = true; }

  /* ---------------- labels (HTML overlay) */
  const tags = document.createElement("div"); tags.className = "sr7-tags"; el.appendChild(tags);
  const LBL = [];
  const lbl = (txt, obj, off, cls = "") => { const a = new THREE.Object3D(); a.position.set(...off); obj.add(a); const d = document.createElement("span"); d.className = "sr7-tag " + cls; d.textContent = txt; tags.appendChild(d); LBL.push({ a, d, cls }); return d; };
  lbl("base stage (fixed on the carriage)", carr, [-0.42, -0.07, FG.tineZ + 0.09]);
  lbl("middle stage – moves s", midG, [0.32, -0.035, FG.tineZ + 0.08]);
  lbl("top stage = tine – moves 2·s", topG, [0.38, 0.0, FG.tineZ + 0.06]);
  lbl("rack (on the middle stage)", midG, [-0.25, -0.064, -FG.tineZ - 0.03], "drv");
  lbl("pinion (2 per tine)", carr, [FG.pinX, FG.pinY - 0.02, -FG.tineZ - 0.01], "drv");
  lbl("synchronising shaft", carr, [FG.pinX, FG.pinY, -0.08], "drv");
  lbl("coupling chain", carr, [0, FG.pinY + 0.03, 0.10], "drv");
  lbl("gear motor + brake + encoder", carr, [-0.05, -0.17, 0], "drv");
  lbl("chain – pulls the tine to R", carr, [0.2, -0.026, FG.tineZ + FG.chainDz], "chn");
  lbl("chain – pulls the tine to L", carr, [-0.12, -0.054, FG.tineZ - FG.chainDz], "chn");
  lbl("sprocket (on the middle stage)", midG, [FG.spr, -0.04, FG.tineZ + FG.chainDz + 0.01], "chn");
  lbl("chain anchor on the base", carr, [-FG.anc, -0.054, FG.tineZ + FG.chainDz], "chn");
  lbl("chain anchor on the top stage", topG, [-FG.anc, -0.02, FG.tineZ + FG.chainDz], "chn");
  lbl("rollers / cam followers", carr, [half - 0.0125, -0.058, FG.tineZ + 0.0625], "drv");
  lbl("lifting carriage", carr, [-0.36, 0.55, 0.5]);
  lbl("crate runner (foot)", crateM, [0.45, -0.08, CR.runZ]);
  lbl("load guide (centring)", rackG, [-(RK.xF + 0.1), POS.bL + 0.08, POS.zL + CR.W / 2 + 0.03]);
  lbl("beam", rackG, [-(RK.xF), POS.bL - 0.08, POS.zL + 0.6]);
  lbl("overhang light barrier", carr, [CR.Lx / 2 + 0.03, 0.14, 0.2], "sen");
  lbl("occupancy sensor", carr, [0.40, 0.34, 0.47], "sen");
  lbl("centre-position sensor (safe)", carr, [0, -0.05, FG.tineZ + 0.1], "sen");
  const linkTag = lbl("followed chain link", carr, [0, 0, 0], "hl"); const linkAnchor = LBL[LBL.length - 1];
  const _v = new THREE.Vector3();
  function updLabels() {
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    scene.updateMatrixWorld();
    linkAnchor.a.position.copy(hiLink.position);
    for (const L of LBL) {
      const on = L.cls === "hl" ? S.follow : S.labels && (S.view === "section" || (S.view === "xray" ? L.cls === "drv" || L.cls === "chn" : L.cls === "" || L.cls === "sen"));
      if (!on) { L.d.hidden = true; continue; }
      L.a.getWorldPosition(_v); _v.project(camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.05 || Math.abs(_v.y) > 1.05) { L.d.hidden = true; continue; }
      L.d.hidden = false; L.d.style.transform = `translate(${((_v.x + 1) / 2 * w).toFixed(0)}px, ${((1 - _v.y) / 2 * h).toFixed(0)}px)`;
    }
    if (S.follow) linkTag.textContent = S.linkState === "lower" ? "link: lies still on the base (v = 0)" : S.linkState === "arc" ? "link: runs over the sprocket" : "link: moves with the tine (2·v_mid)";
  }

  /* ---------------- state + views */
  const S = { view: "iso", design: "rack", follow: false, forces: false, labels: true, fault: null, st: null, linkState: "", Fcalc: null };
  const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.12);   // keeps X ≤ 0.12 (cut through all 3 stages)
  function applyMats() {
    const xr = S.view === "xray", sec = S.view === "section";
    renderer.clippingPlanes = sec ? [clip] : [];
    for (const m of allMats) {
      const r = m.userData.role; let op = 1;
      if (xr) op = r === "stage" ? 0.18 : r === "strip" ? 0.3 : r === "crate" ? 0.08 : r === "rack" || r === "floor" ? 0.07 : r === "carr" ? 0.10 : r === "sens" ? 0.6 : 1;
      m.transparent = op < 1; m.opacity = op; m.depthWrite = op >= 1; m.side = sec ? THREE.DoubleSide : THREE.FrontSide; m.needsUpdate = true;
    }
    edgeMat.opacity = xr ? 0.15 : 0.7; mark();
  }
  const VIEW = { iso: [[0.45, 0.85, 2.7], [-0.25, 0.05, 0]], front: [[0, 0.30, 3.9], [0, 0.05, 0]], top: [[0, 3.4, 0.02], [0, 0, 0]], xray: [[0.30, 0.32, 1.05], [-0.15, -0.05, 0.22]], section: [[0.95, 0.10, 0.0], [0.12, -0.05, 0.0]] };
  let glide = null; const carrW = new THREE.Vector3();
  function carrPos() { return carrW.set(0, carr.position.y, crane.position.z); }
  let needView = true;
  function setView(v, smooth = true) {
    if (!VIEW[v]) return; S.view = v; applyMats();
    if (!S.st) { needView = true; return; }
    needView = false;
    const c = carrPos().clone(), [p, t] = VIEW[v];
    const tgt = new THREE.Vector3(c.x + t[0], c.y + t[1], c.z + t[2]), pos = new THREE.Vector3(c.x + p[0] + t[0], c.y + p[1] + t[1], c.z + p[2] + t[2]);
    if (smooth) glide = { t: 0, a: controls.target.clone(), b: tgt, pa: camera.position.clone(), pb: pos }; else { controls.target.copy(tgt); camera.position.copy(pos); controls.update(); }
    nice.stop(); mark(); updLabels();
  }
  function setDesign(d) {
    S.design = d;
    drv.rack.forEach((m) => (m.visible = d === "rack")); drv.pin.forEach((m) => (m.visible = d === "rack"));
    drv.fw.forEach((m) => (m.visible = d === "friction")); drv.dspr.forEach((m) => (m.visible = d === "chain" || d === "belt"));
    drv.dchain.forEach((m) => { m.visible = d === "chain" || d === "belt"; m.material = d === "belt" ? MAT.belt : MAT.chain; });
    chainIM.visible = d !== "belt"; beltIM.visible = d === "belt";
    if (S.st) setState(S.st); mark();
  }
  function setFault(f) { S.fault = f; extraCrate.visible = f === "occupied"; obst.visible = f === "obstacle"; mark(); }
  let lastCarr = null;
  function setState(st) {
    S.st = st;
    crane.position.z = st.z; carr.position.y = st.y;
    midG.position.x = st.sMid; topG.position.x = st.sTop;
    rot.pin.forEach((p) => { p.rotation.z = -st.sMid / FG.pinR * (S.design === "friction" ? FG.pinR / 0.02 : 1); });
    rot.shaft.forEach((p) => (p.rotation.z = -st.sMid / FG.pinR));
    rot.spr.forEach((p) => (p.rotation.z = -st.sMid / FG.sprR));
    rot.rollB.forEach((r) => (r.rotation.z = -st.sMid / 0.011)); rot.rollM.forEach((r) => (r.rotation.z = -(st.sTop - st.sMid) / 0.009));
    updChains(st.sMid, st.sTop);
    const c = st.crate; crateM.position.set(c.x, c.y, c.z);
    /* sensor lamps in 3D */
    ovL.material.color.setHex(st.sens.ovL ? 0xd62828 : 0x2e9e57); ovR.material.color.setHex(st.sens.ovR ? 0xd62828 : 0x2e9e57);
    const k = st.g.k; occL.visible = k === "pos1"; occR.visible = k === "pos2" || (k === "out2" && S.fault === "occupied");
    occR.material.color.setHex(st.sens.occ ? 0xd62828 : 0x2e9e57); occL.material.color.setHex(0x1f6fd1);
    hiLink.visible = hiRing.visible = S.follow;
    /* forces (live with the current geometry; load only when the crate is on the fork) */
    if (S.forces) updForces(st);
    /* camera follows the carriage */
    const cp = carrPos().clone();
    if (lastCarr && S.followCam !== false) { const d = cp.clone().sub(lastCarr); if (d.lengthSq() > 0) { camera.position.add(d); controls.target.add(d); if (glide) { glide.b.add(d); glide.pb.add(d); } } }
    lastCarr = cp; mark();
    if (needView) setView(S.view, false);
  }
  function updForces(st) {
    Object.values(arrows).forEach((a) => (a.visible = false));
    const Fk = st.crate.on ? (st.sens.kg || 300) * 9.81 / 2 / 1000 : 0, D = Math.sign(st.sTop) || 1, a = Math.abs(st.sTop), sm = Math.abs(st.sMid);
    const R = { F: Fk };
    if (Fk > 0) {
      const xbF = half - FG.rollIn, xmR = sm - half + FG.rollIn, xmF = sm + half - FG.rollIn, xtR = a - half + FG.rollIn, e = xbF - xmR;
      R.R1f = Fk * (a - xmR) / e; R.R1r = Fk * (a - xbF) / e; R.R2f = Fk * (a - xtR) / e; R.R2r = Fk * (a - xmF) / e;
      setArrow("F", D * a, 0.0, -1, Fk);
      setArrow("R1f", D * xbF, -0.053, R.R1f >= 0 ? 1 : -1, R.R1f); setArrow("R1r", D * xmR, -0.053, R.R1r >= 0 ? -1 : 1, R.R1r);
      setArrow("R2f", D * xmF, -0.026, R.R2f >= 0 ? 1 : -1, R.R2f); setArrow("R2r", D * xtR, -0.026, R.R2r >= 0 ? -1 : 1, R.R2r);
    }
    const acc = st.vS !== 0 ? 1 : 0, T = S.Fcalc ? S.Fcalc.T / 1000 : 0.38;
    if (Math.abs(st.vS) > 0.01) { setArrow("T", st.sTop - D * 0.32, FG.chainY + FG.sprR, 0, T * 2.5, Math.sign(st.vS)); setArrow("Fr", 0.0, FG.pinY + FG.pinR, 0, T * 4 * 1.0, Math.sign(st.vS)); R.T = T; R.Fr = 2 * T; }
    S.R = R; forceG.visible = true; mark();
  }

  /* ---------------- camera + loop */
  controls.target.set(0, 1, 0); camera.position.set(2, 2.5, 3);
  let raf = 0, last = performance.now(), frames = 0, visIO = true;
  try { const io = new IntersectionObserver((en) => { visIO = en[0].isIntersecting; if (visIO) mark(); }); io.observe(el); } catch (e) { /* old browser */ }
  function loop() {
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent || !visIO || document.hidden) return;
    resize();
    if (controls.update()) dirty = true;
    if (glide) { glide.t = Math.min(1, glide.t + dt * 1.8); const s = ease(glide.t); controls.target.lerpVectors(glide.a, glide.b, s); camera.position.lerpVectors(glide.pa, glide.pb, s); if (glide.t >= 1) glide = null; dirty = true; }
    if (!dirty) return;
    dirty = false; renderer.render(scene, camera); frames++; updLabels();
  }
  function resize() { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; const pr = renderer.getPixelRatio(), cv = renderer.domElement; if (cv.width !== Math.round(w * pr) || cv.height !== Math.round(h * pr)) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); mark(); } }
  loop();
  setDesign("rack");
  return {
    S, setState, setView, setDesign, setFault,
    follow: (on) => { S.follow = !!on; hiLink.visible = hiRing.visible = S.follow; if (S.st) updChains(S.st.sMid, S.st.sTop); mark(); updLabels(); },
    forces: (on, F) => { S.forces = !!on; S.Fcalc = F || S.Fcalc; forceG.visible = S.forces; if (S.forces && S.st) updForces(S.st); mark(); },
    labels: (on) => { S.labels = !!on; updLabels(); mark(); },
    counts: () => ({ meshes: meshes.length, links: NL * CH.length, chains: CH.length, frames, staticCrates: staticCr.length, sprockets: rot.spr.length, rollers: rot.rollB.length + rot.rollM.length }),
    chainCheck: (sMid, sTop) => CH.map((c) => { chainPt(c, 0, sMid, sTop, P0); return P0.len; }),
    linkAt: () => ({ x: hiLink.position.x, y: hiLink.position.y, st: S.linkState }),
    snapshot: () => { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); },
    resize: () => { resize(); mark(); }, mark,
  };
}
const CLRg = 0.0275;   // crate ↔ load guide clearance (asrsfork_calc CLR.guide)
