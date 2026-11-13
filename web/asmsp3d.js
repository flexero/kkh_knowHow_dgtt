/* 3D view of the MOTOR SPINDLE ASSEMBLY twin (Assembly tab item 2; also used by the LIVE station twin, item 3).
   create(el, getState): getState() returns { k, si, ori, no, n, u, M, R, PK, G, F, rec, ids, cut, visible } (asmsp.js
   api.state()) and optionally st.live = { rpm, T: {front, rear, stator}, vib, devices: {id: {state, last}} }.
   Every part is generated from the same geometry as the 2D section (spAsmGeom ← spGeom of web/spindle.js).
   Per step the hand actions are animated from the progress st.u (0..1): a low-poly operator carries the hot bearings
   from the induction heater, presses with the push sleeve, turns the nut with the torque wrench, measures with the
   indicator, lowers parts with the crane, balances, runs in, tests and packs.  Exploded view, click a part / tool for
   its data (hover = highlight), labels for the active part + tool, camera follows the action.
   Helpers (materials, operator, tools) in asmsp3dx.js.  Offline: local three.js + view3d.js. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { TAU, clamp, ease, ph, lerp, mat, MT, KEEP, box, cyl, cone, sph, torus, ballGeo, segMesh, placeSeg, latheGeo, lathe, rect, ringM, tube, heatColor, Operator, tool, led, table,
  heater, press, wrench, indicator, crane, oven, tongs, springTool, balancer, screwdriver, feeler, scanner, syringe, hskGauge, cart, EQS, DEVN, PART } from "./asmsp3dx.js";

const V3 = () => new THREE.Vector3();
const _v = V3(), _w = V3(), _c = V3(), _m4 = new THREE.Matrix4();
const num = (s) => { const m = String(s || "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };
const recRow = (st, k, i) => (st.rec && st.rec.out && st.rec.out[k] && st.rec.out[k][i]) || null;
const fx = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "–");
const DIRF = new THREE.Vector3(-0.45, 0, 0.89).normalize(), DIRB = new THREE.Vector3(-0.7, 0, -0.7).normalize();
const UNIT = ["shaft", "brgF", "spF", "nutF", "hsgF", "rotor", "brgR", "nutR", "bar", "springs"];

/* ------------------------------------------------------------------ the spindle parts (local: axis = +Y, y = distance from the nose) */
function buildParts(st) {
  const G = st.G, PK = st.PK, cut = st.cut, P = {};
  const grp = (k, cy, r) => { const g = new THREE.Group(); g.userData = { part: k, cy, r }; P[k] = g; return g; };
  grp("shaft", G.g.L / 2, 60).add(lathe(G.shaft, MT.shaft, cut, 96));
  const mkBrg = (b, i) => { const g = new THREE.Group(); g.add(ringM({ r0: b.ri[0], r1: b.ri[1], x0: b.x0, x1: b.x0 + b.B }, MT.ring, cut), ringM({ r0: b.ro[0], r1: b.ro[1], x0: b.x0, x1: b.x0 + b.B }, MT.ring, cut));
    g.add(ringM({ r0: b.rb - b.Dw * 0.12, r1: b.rb + b.Dw * 0.12, x0: b.x0 + 2, x1: b.x0 + b.B - 2 }, MT.cage, cut, 48));
    const vis = []; for (let j = 0; j < b.z; j++) { const a = j / b.z * TAU; if (cut && a < Math.PI / 2) continue; vis.push(a); }
    const im = new THREE.InstancedMesh(ballGeo(+(b.Dw / 2).toFixed(2)), MT.ball, vis.length);
    vis.forEach((a, j) => { _m4.makeTranslation(b.rb * Math.sin(a), b.x0 + b.B / 2, b.rb * Math.cos(a)); im.setMatrixAt(j, _m4); }); im.computeBoundingSphere(); g.add(im);
    const rev = st.F.mix && b.set === "front" && i === 2, dirn = (b.dir < 0 ? 1 : -1) * (rev ? -1 : 1), a = 160 * Math.PI / 180;   // V-line mark on the outer ring OD
    const mk = box(1.2, +(b.B * 0.9).toFixed(1), 1.2, MT.red); mk.position.set((b.ro[1] + 0.3) * Math.sin(a), b.x0 + b.B / 2, (b.ro[1] + 0.3) * Math.cos(a)); mk.rotation.order = "YXZ"; mk.rotation.y = a; mk.rotation.z = 0.5 * dirn; g.add(mk);
    g.userData = { i, seat: b.x0 + b.B / 2, R: b.D / 2, B: b.B, b }; return g; };
  const bF = G.bearings.filter((b) => b.set === "front"), bR = G.bearings.filter((b) => b.set !== "front");
  grp("brgF", (bF[0].x0 + bF[bF.length - 1].x0 + bF[0].B) / 2, G.M.DF / 2).userData.items = [];
  grp("brgR", (bR[0].x0 + bR[bR.length - 1].x0 + bR[0].B) / 2, G.M.DR / 2).userData.items = [];
  G.bearings.forEach((b, i) => { const g = mkBrg(b, i), w = new THREE.Group(), T = b.set === "front" ? P.brgF : P.brgR; w.add(g); T.add(w); T.userData.items.push(g); });
  grp("spF", (G.spIn.x0 + G.spIn.x1) / 2, G.spOut.r1).add(ringM(G.spIn, MT.spacer, cut), ringM(G.spOut, MT.spacer, cut));
  const nut = (g, q) => { g.add(ringM(q, MT.nut, cut)); for (let j = 0; j < 8; j++) { const a = (j + 0.5) / 8 * TAU; if (cut && a < Math.PI / 2) continue; const s = cyl(2.4, 6, MT.dark, (q.r1 + 0.5) * Math.sin(a), (q.x0 + q.x1) / 2, (q.r1 + 0.5) * Math.cos(a), 10); s.rotation.order = "YXZ"; s.rotation.y = a; s.rotation.x = Math.PI / 2; g.add(s); } };
  nut(grp("nutF", (G.nutF.x0 + G.nutF.x1) / 2, G.nutF.r1), G.nutF); nut(grp("nutR", (G.nutR.x0 + G.nutR.x1) / 2, G.nutR.r1), G.nutR);
  grp("hsgF", (G.hsgF[0][1] + G.hsgF[2][1]) / 2, G.Ro).add(lathe(G.hsgF, MT.hsgF, cut));
  const bolts = new THREE.Group(); for (let j = 0; j < 8; j++) { const a = (j + 0.5) / 8 * TAU; const o = cyl(8, 8, MT.dark, (G.Ro - 14) * Math.sin(a), G.hsgF[0][1] - 4, (G.Ro - 14) * Math.cos(a), 12); o.userData.a = a; if (cut && a < Math.PI / 2) o.visible = false; bolts.add(o); }
  bolts.visible = false; P.hsgF.add(bolts); P.hsgF.userData.bolts = bolts;
  grp("rotor", (G.rotor.x0 + G.rotor.x1) / 2, G.rotor.r1).add(ringM(G.rotor, MT.rotor, cut)); for (let y = G.rotor.x0 + 10; y < G.rotor.x1; y += 20) P.rotor.add(ringM({ r0: G.rotor.r1 - 0.2, r1: G.rotor.r1 + 0.3, x0: y, x1: y + 1 }, MT.dark, cut, 48));
  grp("stator", (G.stator.x0 + G.stator.x1) / 2, G.stator.r1).add(ringM(G.stator, MT.stator, cut)); G.wind.forEach((w) => P.stator.add(ringM(w, MT.copper, cut)));
  grp("sleeve", (G.sleeve.x0 + G.sleeve.x1) / 2, G.sleeve.r1).add(ringM(G.sleeve, MT.sleeve, cut)); for (let y = G.sleeve.x0 + 14; y < G.sleeve.x1 - 10; y += 14) P.sleeve.add(ringM({ r0: G.sleeve.r1 - 3, r1: G.sleeve.r1 - 0.1, x0: y, x1: y + 6 }, MT.jigD, cut, 48));
  G.orings.forEach((y) => P.sleeve.add(torus(G.sleeve.r1, 2.2, MT.oring, y, TAU, 64)));
  grp("hsgM", (G.xS + G.xE) / 2, G.Ro).add(lathe(G.hsgM, MT.hsg, cut));
  grp("coverF", G.hsgF[0][1] / 2, G.Ro).add(lathe(G.coverF, MT.cover, cut)); P.coverF.userData.screws = [];
  for (let j = 0; j < 6; j++) { const a = (j + 0.5) / 6 * TAU; const o = cyl(4.5, 3, MT.dark, (G.Ro - 12) * Math.sin(a), -1.5, (G.Ro - 12) * Math.cos(a), 12); o.userData.a = a; P.coverF.add(o); P.coverF.userData.screws.push(o); if (cut && a < Math.PI / 2) o.visible = false; }
  grp("sleeveR", (G.sleeveR.x0 + G.sleeveR.x1) / 2, G.sleeveR.r1).add(ringM(G.sleeveR, MT.cover, cut)); grp("coverR", (G.coverR.x0 + G.coverR.x1) / 2, G.coverR.r1).add(ringM(G.coverR, MT.cover, cut));
  const Q = G.cyl; grp("cyl", (Q.body.x0 + Q.end.x1) / 2, Q.body.r1).add(ringM(Q.body, MT.cyl, cut), ringM(Q.end, MT.cyl, cut)); const pist = ringM(Q.piston, MT.ring, cut); P.cyl.add(pist); P.cyl.userData.piston = pist;
  grp("bar", (G.collet.x0 + G.bar.x1) / 2, G.collet.r1).add(lathe(rect(0, G.bar.r, G.bar.x0, G.bar.x1), MT.bar, cut, 32), lathe(rect(0, G.head.r, G.head.x0, G.head.x1), MT.bar, cut, 32), lathe(rect(G.collet.r0, G.collet.r1, G.collet.x0, G.collet.x1), MT.collet, cut, 48));
  // disc springs: 2 instanced meshes (cone up / cone down), one instance per spring, positions updated by set(comp, base, spread)
  const S = PK.S, hh = S.h0 - PK.sc, sg = grp("springs", (G.springBore.x0 + G.springBore.x1) / 2, S.De / 2), list = [];
  G.springs.forEach((spr, i) => { for (let j = 0; j < S.np; j++) list.push({ y: spr.x + j * S.t, o: spr.o, red: st.F.spring && i % 5 === 2 }); });
  const cS = new THREE.Color(0xc0603a), cR = new THREE.Color(0xd03b3b), ims = [];
  [[1, [[S.Di / 2, 0], [S.De / 2, hh], [S.De / 2, hh + S.t], [S.Di / 2, S.t]]], [-1, [[S.Di / 2, hh], [S.De / 2, 0], [S.De / 2, S.t], [S.Di / 2, hh + S.t]]]].forEach(([o, pts]) => {
    const L = list.filter((q) => (o > 0 ? q.o > 0 : q.o <= 0)); if (!L.length) return; const im = new THREE.InstancedMesh(latheGeo(pts, cut, 40), MT.springI, L.length);
    L.forEach((q, j) => { q.im = im; q.j = j; im.setColorAt(j, q.red ? cR : cS); }); sg.add(im); ims.push(im); });
  const N = list.length; let last = "";
  sg.userData.set = (comp, base, spread) => { const kk = `${comp.toFixed(2)}|${base.toFixed(1)}|${spread.toFixed(2)}`; if (kk === last) return; last = kk;
    list.forEach((q, n) => { _m4.makeTranslation(0, q.y + base + comp * (n + 1) / N + spread * n, 0); q.im.setMatrixAt(q.j, _m4); }); ims.forEach((im) => { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }); };
  sg.userData.set(0, 0, 0);
  grp("sens", (G.xS + G.xR) / 2, G.Ro + 10); P.sens.userData.items = [];
  const sb = (r, y, m, a, n) => { const o = box(10, 10, 8, m, (r + 4) * Math.sin(a), y, (r + 4) * Math.cos(a)); o.rotation.y = a; o.userData = { a, r, y, n }; P.sens.add(o); P.sens.userData.items.push(o); };
  sb(G.Ro, 60, MT.sensor, 2.4, "PT100 front bearings"); sb(G.Ro, (G.xS + G.xR) / 2, MT.sensor, 2.0, "PT100 stator"); sb(G.cyl.body.r1, G.cyl.body.x0 + 20, MT.green, 2.4, "clamp-position sensor"); sb(G.nutR.r1, G.g.segs[8].x0 + 20, MT.blue, 3.0, "encoder head");
  return P;
}

/* ------------------------------------------------------------------ scene per step */
function build(st) {
  const steps = (window.asmSP && window.asmSP.steps) || st.steps, si = st.si, s = steps[si], k = s.k, G = st.G, M = st.M, PK = st.PK, R = st.R, L = G.Lall, gL = G.g.L;
  const root = new THREE.Group(), mats = [], tags = [], tools = [];
  const floor = box(2600, 20, 1800, MT.floor, 0, -10, 0); floor.userData.floor = true; root.add(floor); if (window.dtTheme) window.dtTheme.floor(MT.floor);
  const P = buildParts(st);
  const vis = new Set(); steps.slice(0, si + 1).forEach((q) => (q.add || []).forEach((p) => vis.add(p)));
  if (si >= 5) vis.add("shaft"); if (vis.has("unit")) UNIT.forEach((p) => vis.add(p));
  const newest = new Set(s.add || []); if (newest.has("unit")) UNIT.forEach((p) => newest.add(p));
  const spLift = new THREE.Group(), sp = new THREE.Group(), unit = new THREE.Group(), stat = new THREE.Group(); spLift.add(sp); sp.add(unit, stat); root.add(spLift);
  const W = {}; Object.entries(P).forEach(([kk, o]) => { const w = new THREE.Group(); w.add(o); W[kk] = w; (UNIT.includes(kk) ? unit : stat).add(w); o.visible = vis.has(kk); });
  const jig = new THREE.Group(); root.add(jig);
  const C = { st, s, k, si, G, M, PK, R, P, W, sp, spLift, unit, stat, root, jig, tags, tools, mats, fp: V3(), act: "", ex: 0, live: null, fitObjs: [sp], liftY: 0, explodable: true, op: null, rec: st.rec, x: (st.rec && st.rec.x) || {} };
  C.J = (o) => { jig.add(o); if (o.userData.tool) tools.push(o); return o; };
  C.tag = (o, t, kind, x = 0, y = 0, z = 0, extra = {}) => { const r = { o, p: new THREE.Vector3(x, y, z), t, kind, on: true, ...extra }; tags.push(r); return r; };
  C.tt = (g, t, x, y, z) => C.tag(g, t || `${g.userData.tool} ${EQS[g.userData.tool] || ""}`, "tool", x, y, z);
  C.val = (a, dev, t = "") => C.tag(a, t, "val", 0, 0, 0, { dev });
  C.ptag = (kk, t) => P[kk] && C.tag(P[kk], t || PART[kk][0], "part", 0, 0, 0, { part: kk });
  C.ax = (x, out) => sp.localToWorld(out.set(0, x, 0));
  C.toItem = (o, seat, wc) => { o.parent.worldToLocal(_c.copy(wc)); o.position.set(_c.x, _c.y - seat, _c.z); };
  C.hotMat = (base, em = 0xff5a00) => { const m = base.clone(); m.emissive = new THREE.Color(em); m.emissiveIntensity = 0; mats.push(m); return m; };
  C.swap = (o, from, to) => o.traverse((m) => { if (m.isMesh && m.material === from) m.material = to; });
  C.newOp = (x, z, heat) => (C.op = new Operator(root, x, z, heat));
  const hook = (x, y, z, len = 900) => { const g = new THREE.Group(); g.add(cyl(1.5, len, MT.dark, 0, len / 2, 0, 6), new THREE.Mesh(new THREE.TorusGeometry(10, 3, 8, 16, Math.PI * 1.4), MT.dark)); g.position.set(x, y, z); return g; };
  C.upL = s.ori === "u" ? -1 : 1;
  if (s.ori === "d") {   // nose down on the vertical stand J1: top plate at y = 750
    sp.position.y = 760; const j1 = tool(new THREE.Group(), "J1"); j1.add(cyl(110, 14, MT.jig, 0, 745, 0, 48), cyl(70, 8, MT.wood, 0, 755, 0, 48), cyl(160, 12, MT.jig, 0, 6, 0, 48)); [0, 1, 2].forEach((i) => { const a = i / 3 * TAU; j1.add(box(30, 740, 30, MT.jigD, 90 * Math.sin(a), 370, 90 * Math.cos(a))); });
    C.J(j1); C.tag(j1, "J1 vertical stand (nose down)", "tool", 130, 400, 0);
  } else if (s.ori === "u") {   // nose up, housing on its rear face on J8
    sp.rotation.z = Math.PI; sp.rotation.y = Math.PI / 2; sp.position.y = L + 330; C.liftY = 330;
    const j8 = tool(new THREE.Group(), "J8"); j8.add(cyl(150, 16, MT.jig, 0, 322, 0, 48)); [0, 1, 2, 3].forEach((i) => { const a = (i + 0.5) / 4 * TAU; j8.add(box(30, 314, 30, MT.jigD, 120 * Math.sin(a), 157, 120 * Math.cos(a))); }); C.J(j8);
    C.tag(j8, "J8 housing stand", "tool", 160, 160, 0);
  }
  if (k === "stator") UNIT.forEach((p) => { P[p].visible = false; });
  root.updateMatrixWorld(true);
  // generic mover (parts that arrive from above / below along the axis)
  const sgn = s.ori === "u" ? -1 : 1;
  const movers = [...newest].filter((p) => P[p] && !(s.fix || []).includes(p));
  C.placeMovers = (u, dist = 260) => { const d = (1 - ease(Math.min(1, u * 1.6))) * dist * -(s.from || -1) * sgn;
    if (k === "insert") { unit.position.y = d; return d; }
    movers.forEach((p) => { const o = P[p], dd = (s.below || []).includes(p) ? -d : d; o.position.y = dd; }); return d; };
  // explode layout: wrappers + (row, axial) captured BEFORE the script (bench steps re-parent parts), vectors after it
  const EXr = [], exItems = [...P.brgF.userData.items.slice(0, 2).map((o) => o.parent), W.spF, ...P.brgF.userData.items.slice(2).map((o) => o.parent), W.nutF, W.rotor, ...P.brgR.userData.items.map((o) => o.parent), W.nutR];
  exItems.forEach((w, i) => EXr.push([w, 0, (i + 1) * 40]));
  [[W.hsgF, 0, -170], [W.coverF, 0, -330], [W.bar, -0.75, 0], [W.springs, -0.75, 0], [W.hsgM, 1, 0], [W.sens, 1, 0], [W.sleeveR, 1, 260], [W.coverR, 1, 340], [W.cyl, 1, 430], [W.sleeve, 2, 0], [W.stator, 2, 280]].forEach((q) => EXr.push(q));
  const SC = SCRIPTS[k] || SCRIPTS.def;
  const sc = SC(C) || {};
  if (C.op) C.op.update(1);
  const explodable = C.explodable && s.ori !== "c" || ["balance", "runin", "test"].includes(k);
  const axW = V3().set(0, 1, 0).applyQuaternion(sp.quaternion), lat = V3().crossVectors(axW, V3().set(0.62, 0.38, 0.72).normalize()).normalize().applyQuaternion(sp.quaternion.clone().invert()); lat.y = 0; lat.normalize();
  const exList = EXr.map(([w, n, ax]) => [w, lat.clone().multiplyScalar(n * (G.Ro * 2 + 70)).add(V3().set(0, ax, 0))]);
  C.applyEx = (e) => { C.ex = e; if (explodable) { P.springs.userData.set(0, 0, 8 * e); exList.forEach(([w, o]) => { w.position.copy(o).multiplyScalar(e); }); spLift.position.y = e * C.liftY; } const show = e < 0.02; jig.visible = show; if (C.op) C.op.setVisible(show); };
  // tags of the newest parts (= active part)
  [...newest].filter((p) => P[p] && p !== "unit" && PART[p] && !C.noPartTags).forEach((p) => { if (!tags.some((t) => t.part === p)) C.ptag(p); });
  Object.keys(P).forEach((p) => { if (!tags.some((t) => t.part === p)) { const r = C.ptag(p); r.exOnly = true; } });
  tags.forEach((t) => { if ((t.part === "brgF" || t.part === "brgR") && t.o === P[t.part]) { const it = P[t.part].userData.items, m = it[Math.floor((it.length - 1) / 2)]; t.o = m; t.anchorBox = [m.userData.seat, m.userData.R]; } });
  return { root, C, upd: (u, t, dt) => { if (sc.upd) sc.upd(u, t || 0, dt || 0.016); if (C.op) C.op.update(dt || 0.016); }, explodable };
}

/* ------------------------------------------------------------------ shared action helpers */
/* carry items (bearings / spacers) from the heater onto their seats, one after the other in [a, b] */
function mountSeq(C, list, a, b, hTop) {
  const n = list.length, wc = V3(), p0 = V3(), p1 = V3(), p2 = V3(), seatW = V3(), G = C.G;
  list.forEach((it) => { it.hm = it.hot ? C.hotMat(MT.ring) : null; if (it.hm) C.swap(it.o, MT.ring, it.hm); });
  return (u) => { let cur = -1, cs = 0;
    list.forEach((it, i) => { const t0 = a + (b - a) * i / n, t1 = a + (b - a) * (i + 1) / n, s = ph(u, t0, t1);
      it.o.visible = u >= t0;
      if (it.hm) { const g = u < t0 ? 0 : s < 0.25 ? ease(s / 0.25) : 1 - ph(u, t1, t1 + 0.3); it.hm.emissiveIntensity = g * 0.7; }
      if (u < t0 || s >= 1) { it.o.position.set(0, 0, 0); if (u < t0) it.o.visible = false; return; }
      cur = i; cs = s; p0.copy(hTop); p0.y += it.B / 2; C.ax(gL(C) + 70 + it.B / 2, p2); p1.set(p0.x * 0.6, Math.max(p0.y, p2.y) + 140, p0.z * 0.6);
      if (s < 0.25) wc.copy(p0);
      else if (s < 0.62) { const q = ease((s - 0.25) / 0.37), r0 = (1 - q) * (1 - q), r1 = 2 * (1 - q) * q, r2 = q * q; wc.set(p0.x * r0 + p1.x * r1 + p2.x * r2, p0.y * r0 + p1.y * r1 + p2.y * r2, p0.z * r0 + p1.z * r1 + p2.z * r2); }
      else { C.ax(it.seat, seatW); wc.lerpVectors(p2, seatW, ease((s - 0.62) / 0.33)); }
      C.toItem(it.o, it.seat, wc); });
    return { cur, cs, wc, it: list[cur] }; };
}
const gL = (C) => C.G.g.L;
/* two hands holding an object of radius r at world centre c (left / right of it, seen from the operator) */
function hold(op, c, r, curl = 0.6, dy = 0) { if (!op) return; const fxx = c.x - op.g.position.x, fzz = c.z - op.g.position.z, fl = Math.hypot(fxx, fzz) || 1; _v.set(fzz / fl, 0, -fxx / fl);
  _w.copy(c).addScaledVector(_v, r + 30); _w.y += dy; op.reach(1, _w, c, curl); _w.copy(c).addScaledVector(_v, -(r + 30)); _w.y += dy; op.reach(0, _w, c, curl); }
/* nut: screw on by hand, torque wrench (seat, loosen, final), runout measurement + set-screw correction */
function nutSeq(C, kk, q, T, nr0, nr1, a, b) {
  const P = C.P, part = P[kk], op = C.op, cy = (q.x0 + q.x1) / 2, Wr = C.J(wrench(q.r1)), I = C.J(indicator("E11", 230)), sd = C.J(screwdriver()), c = V3(), tip = V3(), g = V3(), sV = V3();
  const tv = C.val(Wr.userData.scr, "TQ-01"), iv = C.val(I.userData.scr, "IND-01"), tw = C.tt(Wr, "E10 hook spanner + torque wrench", 0, 40, 0), ti = C.tag(I, kk === "nutF" ? "J3 fixture + E11 probe 0.1 µm" : "E11 probe 0.1 µm", "tool", 230, 120, 0);
  const st = { rot: 0 };
  return (u, dt) => { const s = ph(u, a, b); Wr.visible = s > 0.3 && s < 0.66; I.visible = s >= 0.62; sd.visible = s > 0.74 && s < 0.93; tw.on = Wr.visible; tv.on = Wr.visible; ti.on = I.visible; iv.on = I.visible;
    C.ax(cy, c);
    if (u < a) { part.visible = false; return null; } part.visible = true;
    if (s < 0.3) { const e = 1 - ease(s / 0.3); part.position.y = e * 220 * C.upL; part.rotation.y = -e * 14; C.ax(cy + e * 220 * C.upL, g); hold(op, g, q.r1, 0.7); C.fp.copy(g); C.act = `screw the precision nut on by hand (M${Math.round(q.r0 * 2)}×1.5)`; return; }
    part.position.y = 0; part.rotation.y = 0;
    if (s < 0.66) { const sub = (s - 0.3) / 0.36, k3 = Math.min(2, Math.floor(sub * 3)), f = sub * 3 - k3;
      Wr.position.copy(c); Wr.rotation.y = 2.3 + (k3 === 1 ? 1 : -1) * Math.sin(f * Math.PI) * 0.45; Wr.updateMatrixWorld(true); Wr.userData.grip.getWorldPosition(g); op.reach(0, g, null, 0.9);
      C.ax(gL(C) - 10, g); g.x += 40; op.reach(1, g, c, 0.6);
      const tq = k3 === 1 ? T * 2 * (1 - ease(f * 1.5)) : (k3 === 0 ? 2 * T : T) * ease(Math.min(1, f * 1.7)); tv.t = `${Math.round(tq)} N·m`;
      C.act = ["seat the nut with 2 × torque (hook spanner + torque wrench)", "loosen the nut", `final torque ≈ ${T} N·m (example – nut catalogue)`][k3]; C.fp.copy(c); return; }
    // runout: probe on the nut face, turn the shaft slowly, correct with the set screw at the high point
    C.ax(C.upL > 0 ? q.x1 : q.x0, tip); tip.addScaledVector(DIRF, q.r1 - 5); I.position.copy(tip); I.rotation.y = -0.6;
    st.rot += dt * (s > 0.74 && s < 0.93 ? 0.15 : 0.9); C.unit.rotation.y = st.rot;
    const r = lerp(nr0, nr1, ph(s, 0.76, 0.95)); iv.t = `TIR ${fx(r * (0.75 + 0.25 * Math.sin(st.rot * 3)), 1)} µm`;
    C.ax(cy, g); g.addScaledVector(DIRB, q.r1 + 70); sd.position.copy(g); sd.quaternion.setFromUnitVectors(_w.set(0, 1, 0), sV.copy(DIRB)); sd.position.addScaledVector(DIRB, -60);
    if (sd.visible) { g.copy(sd.position).addScaledVector(DIRB, 90); op.reach(0, g, c, 0.9); } else { C.ax(gL(C) - 10, g); g.x -= 40; op.reach(0, g, c, 0.6); }
    C.ax(cy + 30 * C.upL, g); g.addScaledVector(DIRF, q.r1 + 40); op.reach(1, g, c, 0.6);
    C.act = s > 0.74 && s < 0.93 ? "correct the runout: tighten the set screw at the HIGH point a little, measure again" : `measure the nut face runout with the 0.1 µm probe, turn the shaft slowly (target ≤ 2 µm)`; C.fp.copy(c); return; };
}
/* bench layout for the preparation steps (kit, clean, meas, spacer, grease) */
function bench(C) {
  const { P, G, root } = C, Lg = {};
  Object.values(P).forEach((o) => { o.visible = false; });
  const T = table(1800, 900, 780); root.add(T);
  const lay = (kk, x, z, horiz, y = 780) => { const o = P[kk]; o.visible = true; const g = new THREE.Group(); o.parent.remove(o); g.add(o); if (horiz) g.rotation.z = Math.PI / 2; g.position.set(x, y, z); root.add(g); Lg[kk] = g; return g; };
  lay("shaft", 520, 120, true, 840);
  const bI = []; P.brgF.userData.items.slice().forEach((b, i) => { const g = new THREE.Group(); b.parent.remove(b); g.add(b); b.position.y = -G.bearings[i].x0; g.position.set(-820 + i * 120, 780, -280); root.add(g); b.visible = true; bI.push(g); });
  P.brgR.userData.items.slice().forEach((b, i) => { const g = new THREE.Group(); b.parent.remove(b); g.add(b); b.position.y = -G.bearings[4 + i].x0; g.position.set(-340 + i * 115, 780, -280); root.add(g); b.visible = true; bI.push(g); });
  P.brgF.visible = true; P.brgR.visible = true;
  lay("spF", -720, 40, false).position.y = 780 - G.spIn.x0; lay("nutF", -560, 40, false).position.y = 780 - G.nutF.x0; lay("nutR", -420, 40, false).position.y = 780 - G.nutR.x0;
  lay("rotor", -120, 260, false).position.y = 780 - G.rotor.x0; lay("stator", 180, 260, false).position.y = 780 - G.stator.x0 + 16;
  C.fitObjs = [T]; C.explodable = false; C.newOp(0, -700); C.op.look.set(0, 0, 0);
  return { Lg, bI };
}

/* ------------------------------------------------------------------ the 21 step scripts: SCRIPTS[k](C) → { upd(u, t, dt) } */
const SCRIPTS = {
  def: (C) => ({ upd: (u) => C.placeMovers(u) }),
  kit: (C) => { const { Lg, bI } = bench(C), op = C.op, sc = C.J(scanner()), tab = C.J(box(260, 16, 180, MT.jigD, 680, 790, -300)); tool(tab, "E25");
    const scr = new THREE.Object3D(); scr.position.set(680, 830, -300); C.J(scr); C.J(box(230, 6, 150, MT.screen, 680, 800, -300));
    const tv = C.val(scr, "SCN-01"), beam = segMesh(MT.laser, 1.5); C.J(beam); C.tt(sc, "E25 DMC scanner", 0, 60, 0); C.tag(tab, "MES tablet (assembly record)", "tool", 0, 30, 0);
    const tg = [[Lg.shaft, 0, 0, 0, "shaft"], [bI[0], 0, 30, 0, "front set"], [bI[4], 0, 30, 0, "rear set"], [Lg.rotor, 0, 60, 0, "rotor (motor kit)"], [Lg.stator, 0, 60, 0, "stator (motor kit)"], [Lg.spF, 0, 30, 0, "spacers"], [Lg.nutF, 0, 30, 0, "nuts"]];
    const ids = C.st.ids || {}, codes = [ids.shaft, ids.setF, ids.setR, ids.motor, ids.motor, ids.spacer, ""], p = V3(), h = V3(), lt = C.tag(sc, "", "val", 0, 0, 0);
    return { upd: (u) => { const n = tg.length, i = Math.min(n - 1, Math.floor(u * n)), f = u * n - i, [o, x, y, z, nm] = tg[i];
      o.localToWorld(p.set(x, y, z)); if (o === Lg.shaft) { p.set(o.position.x - 150 + 300 * f, o.position.y + 70, o.position.z); }
      op.home.set(clamp(p.x, -700, 700), 0, -700); op.look.set(p.x, 0, p.z);
      h.set(p.x - 60, p.y + 260, p.z - 220); sc.position.copy(h); sc.lookAt(p); op.reach(0, _v.copy(h).add(_w.set(0, -40, -30)), null, 0.9);
      _v.set(-620 + 1300 * clamp((p.x + 700) / 1400, 0, 1) * 0 + 700, 830, -330); op.reach(1, _v.set(Math.min(p.x + 260, 650), 900, -420), null, 0.4);
      beam.visible = f > 0.2 && f < 0.85; placeSeg(beam, _v.copy(h).addScaledVector(_w.subVectors(p, h).normalize(), 80), p);
      tv.t = `✓ ${Math.min(5, i + (f > 0.8 ? 1 : 0))} / 5 scanned`; lt.t = f > 0.3 ? `${nm}: ${codes[i] || "ok"}` : `scan ${nm}`; lt.o = sc;
      C.fp.copy(p); C.act = `scan the serial of the ${nm} into the assembly record (matched sets: same set number, V-line continuous)`; } }; },
  clean: (C) => { const { Lg } = bench(C), op = C.op; const hood = new THREE.Group(); hood.add(box(1800, 60, 900, MT.hepa, 0, 1700, 0), box(1800, 900, 10, MT.glass, 0, 1250, -450)); C.J(tool(hood, "E4")); C.tag(hood, "E4 laminar-flow bench (HEPA)", "tool", -700, 1700, 0);
    const tank = tool(new THREE.Group(), "E2"); tank.add(box(300, 10, 220, MT.steel, 0, 0, 0), box(300, 160, 10, MT.steel, 0, 80, -110), box(300, 160, 10, MT.steel, 0, 80, 110), box(10, 160, 220, MT.steel, -150, 80, 0), box(10, 160, 220, MT.steel, 150, 80, 0), box(290, 120, 210, MT.liquid, 0, 65, 0));
    tank.position.set(120, 785, -300); C.J(tank); C.tt(tank, "E2 ultrasonic tank (solvent)", 0, 170, 0);
    const bk = tool(new THREE.Group(), "E2"); bk.add(box(200, 4, 140, MT.jig, 0, 0, 0), box(4, 90, 140, MT.jig, -100, 45, 0), box(4, 90, 140, MT.jig, 100, 45, 0), box(200, 90, 4, MT.jig, 0, 45, -70), box(200, 90, 4, MT.jig, 0, 45, 70), box(10, 140, 10, MT.jigD, 0, 160, 0), box(120, 10, 10, MT.jigD, 0, 230, 0));
    [[-50, 0], [40, 20]].forEach(([x, z]) => bk.add(torus(28, 7, MT.spacer, 15, TAU, 24).translateX(x).translateY(-z))); C.J(bk);
    const rack = tool(new THREE.Group(), "E3"); [0, 1, 2].forEach((i) => rack.add(box(500, 12, 300, MT.steel, 0, 300 + i * 350, 0))); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => rack.add(box(20, 1100, 20, MT.dark, a * 240, 550, b * 140)));
    rack.add(box(480, 120, 280, MT.film, 0, 375, 0), box(480, 120, 280, MT.film, 0, 725, 0)); rack.position.set(1250, 0, -200); C.J(rack); C.tt(rack, "E3 soak rack 20 °C ≥ 12 h", 0, 1150, 0);
    const th = new THREE.Object3D(); th.position.set(-850, 1450, -440); C.J(th); const thv = C.val(th, "TH-01"); const pc = new THREE.Object3D(); pc.position.set(-850, 1350, -440); C.J(pc); const pcv = C.val(pc, "PC-01");
    const r0 = recRow(C.st, "clean", 0), r1 = recRow(C.st, "clean", 1); const p = V3(), q = V3();
    return { upd: (u, t) => { thv.t = `room ${r1 ? num(r1[1]).toFixed(1) : "20.0"} °C`; pcv.t = `particles ${r0 ? r0[1].split(" ")[0] : "–"} /m³`;
      const t0 = V3; // basket path: bench (-600) → tank → out → rack
      if (u < 0.2) p.set(lerp(-620, 120, ease(u / 0.2)), 900 + Math.sin(u / 0.2 * Math.PI) * 120, lerp(40, -300, ease(u / 0.2)));
      else if (u < 0.55) p.set(120, 830 + (u < 0.25 ? (1 - ease((u - 0.2) / 0.05)) * 70 : u > 0.5 ? ease((u - 0.5) / 0.05) * 70 : Math.sin(t * 40) * 1.5), -300);
      else p.set(lerp(120, 1150, ease((u - 0.55) / 0.45)), 900 + Math.sin(ph(u, 0.55, 1) * Math.PI) * 150 + ph(u, 0.9, 1) * 160, lerp(-300, -200, ph(u, 0.55, 1)));
      bk.position.copy(p); q.copy(p); q.y += 230; op.reach(0, _v.copy(q).add(_w.set(-45, 0, 0)), q, 0.9); op.reach(1, _v.copy(q).add(_w.set(45, 0, 0)), q, 0.9);
      op.home.set(clamp(p.x, -650, 1000), 0, -720); op.look.set(p.x, 0, p.z); C.fp.copy(p);
      C.act = u < 0.2 ? "small parts in the basket → ultrasonic tank" : u < 0.55 ? "ultrasonic wash (shaft + housings in the solvent washer); blow bores with FILTERED air, never on bearings" : "covered parts onto the soak rack: ≥ 12 h at 20 ±1 °C before measuring"; } }; },
  meas: (C) => { const { bI } = bench(C), op = C.op, S = tool(new THREE.Group(), "E5", "BMS-01"); S.add(box(300, 70, 240, MT.granite, 0, 35, 0), box(40, 330, 40, MT.dark, 0, 235, -100), box(30, 30, 160, MT.jig, 0, 360, -30), cyl(10, 80, MT.jigD, 0, 320, 40, 12));
    const scr = new THREE.Object3D(); scr.position.set(200, 120, 0); S.add(scr, box(120, 70, 8, MT.screen, 200, 80, 0)); led(S, 250, 120, 0); S.position.set(120, 780, -300); C.J(S); C.tt(S, "E5 bearing measuring stand", 0, 400, 0);
    const v = C.val(scr, "BMS-01"), wt = C.J(cyl(40, 26, MT.jig, 0, 0, 0, 24)), x = C.x, top = V3(), p = V3(), home = V3();
    return { upd: (u) => { const n = 4, i = Math.min(3, Math.floor(u * n)), f = u * n - i, g = bI[i], b = C.G.bearings[i];
      bI.forEach((o, j) => { if (j !== i) o.position.set(j < 4 ? -820 + j * 120 : -340 + (j - 4) * 115, 780, -280); });
      home.set(-820 + i * 120, 780, -280); top.set(120, 780 + 70, -300);
      const q = f < 0.25 ? ease(f / 0.25) : f > 0.75 ? 1 - ease((f - 0.75) / 0.25) : 1; p.lerpVectors(home, top, q); p.y += Math.sin(q * Math.PI) * 120; g.position.copy(p);
      wt.visible = f > 0.3 && f < 0.7; wt.position.set(120, 780 + 70 + b.B + 13, -300);
      _c.set(p.x, p.y + b.B / 2, p.z); if (f < 0.3 || f > 0.7) hold(op, _c, b.D / 2, 0.6); else { op.reach(0, _v.set(120 + 200, 900, -300), null, 0.3); op.reach(1, _v.set(120 - 80, 780 + 70 + b.B + 40, -300), null, 0.4); }
      v.t = f > 0.35 ? `bearing ${i + 1}: stand-out ${fx(x.e ? x.e[i] : NaN, 1)} µm` : "measuring load …"; op.home.set(clamp(p.x, -600, 300), 0, -700); op.look.set(p.x, 0, p.z); C.fp.copy(p);
      C.act = `bearing ${i + 1} on the measuring stand under the catalogue measuring load: stand-out (face offset) + deviation marks`; } }; },
  spacer: (C) => { const { Lg } = bench(C), op = C.op, S = tool(new THREE.Group(), "E7", "CMP-01"); S.add(box(300, 70, 240, MT.granite, 0, 35, 0), box(40, 330, 40, MT.dark, 0, 235, -100), box(30, 30, 160, MT.jig, 0, 360, -30), cyl(6, 120, MT.jigD, 0, 300, 50, 12), cyl(50, 10, MT.steel, 0, 75, 0, 24));
    const scr = new THREE.Object3D(); scr.position.set(200, 120, 0); S.add(scr, box(120, 70, 8, MT.screen, 200, 80, 0)); led(S, 250, 120, 0); S.position.set(120, 780, -300); C.J(S); C.tt(S, "E7 comparator 0.1 µm", 0, 400, 0);
    const v = C.val(scr, "CMP-01"), x = C.x, sp = Lg.spF, G = C.G, home = V3().set(-720, 780 - G.spIn.x0, 40), top = V3().set(120, 780 + 80 - G.spIn.x0, -300), p = V3();
    return { upd: (u) => { const q = u < 0.15 ? ease(u / 0.15) : u > 0.85 ? 1 - ease((u - 0.85) / 0.15) : 1; p.lerpVectors(home, top, q); p.y += Math.sin(q * Math.PI) * 100; sp.position.copy(p);
      const pt = Math.min(3, Math.floor(ph(u, 0.15, 0.85) * 4)); sp.rotation.y = q >= 1 ? pt * Math.PI / 2 + ease(ph(u, 0.15 + pt * 0.175 + 0.12, 0.15 + (pt + 1) * 0.175)) * Math.PI / 2 : 0;
      _c.set(p.x, p.y + G.spIn.x0 + 8, p.z); hold(op, _c, G.spOut.r1, 0.7);
      v.t = q >= 1 ? `Lo − Li = ${fx(x.dsAct, 1)} µm (target ${fx(x.ds, 1)} ±1) · point ${pt + 1}/4` : "spacer pair"; op.home.set(clamp(p.x, -600, 300), 0, -700); op.look.set(p.x, 0, p.z); C.fp.copy(p);
      C.act = "measure the ground spacer pair on the 0.1 µm comparator at 4 points (Lo − Li = Δs ±1 µm)"; } }; },
  grease: (C) => { const { bI } = bench(C), op = C.op, S = tool(new THREE.Group(), "E8", "SCL-01"); S.add(box(220, 40, 200, MT.jigD, 0, 20, 0), cyl(80, 6, MT.steel, 0, 43, 0, 32)); const scr = new THREE.Object3D(); scr.position.set(0, 60, 110); S.add(scr, box(120, 30, 6, MT.screen, 0, 25, 102));
    S.position.set(120, 780, -300); C.J(S); C.tt(S, "E8 precision scale 0.01 g", 0, 60, -60); const v = C.val(scr, "SCL-01"), sy = C.J(syringe()); C.tt(sy, "E8 grease syringe", 0, 200, 0);
    const x = C.x, F = C.st.F, top = V3(), p = V3(), home = V3();
    return { upd: (u, t) => { const n = 6, i = Math.min(5, Math.floor(u * n)), f = u * n - i, g = bI[i], b = C.G.bearings[i];
      bI.forEach((o, j) => { if (j !== i) o.position.set(j < 4 ? -820 + j * 120 : -340 + (j - 4) * 115, 780, -280); });
      home.set(i < 4 ? -820 + i * 120 : -340 + (i - 4) * 115, 780, -280); top.set(120, 826, -300);
      const q = f < 0.2 ? ease(f / 0.2) : f > 0.85 ? 1 - ease((f - 0.85) / 0.15) : 1; p.lerpVectors(home, top, q); p.y += Math.sin(q * Math.PI) * 110; g.position.copy(p); g.rotation.y = q >= 1 ? f * 4 : 0;
      const tgt = i < 4 ? x.gF : x.gR, m = q >= 1 ? tgt * ease(ph(f, 0.25, 0.8)) : 0; v.t = F.grease ? "not weighed (by eye!)" : `${fx(m, 2)} g / ${fx(tgt, 2)} g`;
      _c.set(p.x, p.y + b.B / 2, p.z); sy.visible = q >= 1; const a = t * 3; sy.position.set(p.x + b.rb * Math.sin(a) * 0.3 - 30, p.y + b.B + 95, p.z + 40); sy.rotation.set(0.3, 0, 0.2);
      if (q < 1) hold(op, _c, b.D / 2, 0.6); else { op.reach(0, _v.copy(sy.position).add(_w.set(0, 60, 0)), null, 1); op.reach(1, _v.set(p.x + b.D / 2 + 25, p.y + b.B / 2, p.z), _c, 0.6); }
      op.home.set(clamp(p.x, -600, 300), 0, -700); op.look.set(p.x, 0, p.z); C.fp.copy(p);
      C.act = `grease bearing ${i + 1}: weighed quantity (15 % of the free volume – example) between the balls from both sides, turn by hand`; } }; },
  front: (C) => { const { G, P, op: _o } = C, op = C.newOp(-580, -170); const H = C.J(heater()); H.position.set(-460, 0, -720); H.updateMatrixWorld(true); C.tt(H, "E9 induction heater", 170, 1000, 0);
    const hTop = H.localToWorld(V3().set(0, H.userData.top, 0)), hv = C.val(H.userData.scr, "IH-01"), Th = num((recRow(C.st, "front", 0) || [])[1]) || 72;
    const it = P.brgF.userData.items.map((o, i) => ({ o, seat: o.userData.seat, R: o.userData.R, B: o.userData.B, hot: true, n: `bearing ${i + 1}` }));
    it.splice(2, 0, { o: P.spF, seat: (G.spIn.x0 + G.spIn.x1) / 2, R: G.spOut.r1, B: G.spIn.x1 - G.spIn.x0, hot: false, n: "inner + outer spacer" });
    const seq = mountSeq(C, it, 0, 0.8, hTop), b3 = G.bearings[3], top3 = b3.x0 + b3.B, Ls = gL(C) - top3 + 40;
    const ps = C.J(tool(new THREE.Group(), "J2")); ps.add(lathe(rect(b3.d / 2 + 0.6, b3.d / 2 + 10, 0, Ls), MT.jig, C.st.cut, 48)); const tps = C.tt(ps, "J2 push sleeve (inner ring only)", 0, Ls, 0);
    const top = 760 + gL(C) + 40 + 410, pr = C.J(press(top)); const pv = C.val(pr.userData.scr, "FG-01"), tpr = C.tt(pr, "E12 hand press + force gauge", 0, top + 60, 0);
    const sc = V3();
    return { upd: (u) => { const r = seq(u);
      const ti = r.cur >= 0 && r.it.hot && r.cs < 0.25 ? 20 + (Th - 20) * ease(r.cs / 0.25) : r.cur >= 0 && r.it.hot ? Th : 20; hv.t = r.cur >= 0 && r.it.hot ? `${Math.round(ti)} °C (≤ 110)` : "standby"; H.userData.coil.material = r.cur >= 0 && r.it.hot && r.cs < 0.25 ? MT.hot : MT.dark;
      ps.visible = u >= 0.8; pr.visible = u >= 0.8; tps.on = ps.visible; tpr.on = pr.visible; pv.on = pr.visible;
      const sd = 1 - ease(ph(u, 0.8, 0.88)); C.ax(top3 + sd * 260, sc); ps.position.copy(sc); const tr = ease(ph(u, 0.88, 0.95)) * 60 - sd * 0; pr.userData.ram.position.y = top - 150 - tr - 0; const F = 3.0 * ease(ph(u, 0.93, 1));
      pv.t = `${fx(F, 1)} kN (example – catalogue)`;
      if (r.cur >= 0) { hold(op, r.wc, r.it.R, 0.6); op.look.set(r.wc.x, 0, r.wc.z); op.home.set(-580, 0, -170 + clamp(r.wc.z, -500, 0) * 0.45); C.fp.copy(r.wc);
        C.act = r.cs < 0.25 ? (r.it.hot ? `heat ${r.it.n} in the induction heater to ≈ ${Math.round(Th)} °C` : `take the ${r.it.n} (not heated)`) : r.cs < 0.62 ? `carry the ${r.it.n} to the shaft (V-line → nose)` : `slide the ${r.it.n} down to its seat, hold it until it grips`; }
      else if (u >= 0.8) { op.home.set(-580, 0, -170); op.look.set(0, 0, 0); C.ax(gL(C) + 20, sc); op.reach(1, _v.copy(sc).add(_w.set(60, 0, -20)), sc, 0.6); op.reach(0, _v.set(280, top + 30, 0), null, 0.9); C.fp.copy(sc);
        C.act = u < 0.88 ? "after cooling: push sleeve J2 on the inner ring of bearing 4" : "press the set axially with the hand press (force from the catalogue)"; } } }; },
  nut: (C) => { const op = C.newOp(-580, -170), x = C.x; const f = nutSeq(C, "nutF", C.G.nutF, 125, x.nr0 || 5, x.nr1 || 1, 0, 1); return { upd: (u, t, dt) => { f(u, dt); op.look.set(0, 0, 0); } }; },
  fbh: (C) => { const { G, P } = C, op = C.newOp(-580, -170), cr = C.J(crane()); C.tt(cr, "E13 crane (slow speed)", 0, 2300, 0); const hm = C.hotMat(MT.hsgF, 0xff7a30); C.swap(P.hsgF, MT.hsgF, hm);
    const xs = G.hsgF[2][1], eyes = [0, 1, 2].map((i) => { const a = i / 3 * TAU + 0.5, e = torus(10, 3, MT.dark, xs + 8, TAU, 16); e.rotation.set(0, a, 0); e.position.set((G.Ro - 25) * Math.sin(a), xs + 10, (G.Ro - 25) * Math.cos(a)); P.hsgF.add(e); return e; });
    const sl = eyes.map(() => { const m = segMesh(MT.yel, 3); C.J(m); return m; }), I = C.J(indicator("E11", 220)), iv = C.val(I.userData.scr, "IND-01"), ti = C.tt(I, "E11 probe (axial play)", 220, 120, 0), hk = V3(), e = V3(), c = V3();
    const r0 = recRow(C.st, "fbh", 0), r1 = recRow(C.st, "fbh", 1), lab = C.tag(P.hsgF, "", "val", 0, 0, 0); lab.anchorPart = true;
    return { upd: (u) => { const d = (1 - ease(ph(u, 0, 0.7))) * 380; P.hsgF.position.y = d; hm.emissiveIntensity = 0.35 * (1 - ph(u, 0.6, 1)); C.root.updateMatrixWorld(true);
      const up = ph(u, 0.85, 1) * 500; C.ax(xs + d + 230 + up, hk); cr.userData.setHook(0, hk.y, 0); sl.forEach((m, i) => { m.visible = u < 0.86; eyes[i].getWorldPosition(e); placeSeg(m, _v.set(0, hk.y, 0), e); });
      C.ax((G.hsgF[0][1] + xs) / 2 + d, c); hold(op, c, G.Ro, 0.5); I.visible = u > 0.85; ti.on = iv.on = I.visible; C.ax(xs, e); e.addScaledVector(DIRF, G.Ro - 15); I.position.copy(e); iv.t = r1 ? r1[1] : "";
      lab.t = r0 ? `housing ${r0[1].split("(")[0]}` : ""; lab.on = u < 0.8; C.fp.copy(c);
      C.act = u < 0.7 ? "lower the warm front bearing housing slowly and level over the front set" : u < 0.85 ? "hold it down until it has cooled (5–10 min)" : "check: outer rings seated, no axial play (probe)"; } }; },
  rotor: (C) => { const { G, P } = C, op = C.newOp(-580, -170, true), ov = C.J(oven()); ov.position.set(-640, 0, -760); ov.updateMatrixWorld(true); C.tt(ov, "E14 rotor oven", 0, 1300, 0); const ovv = C.val(ov.userData.scr, "OV-01");
    const hm = C.hotMat(MT.rotor, 0xff4a00); C.swap(P.rotor, MT.rotor, hm); const tg = C.J(tongs(G.rotor.r1)); C.tt(tg, "J4 rotor tongs", 0, 340, 0);
    const j5 = C.J(tool(cone(G.M.dR / 2 + 2, 16, 110, MT.jig, 0, 0, 0, 32), "J5")); C.tag(j5, "J5 mounting cone (thread protector)", "tool", 30, 40, 0);
    const Tr = C.R.Trot || 180, cy = (G.rotor.x0 + G.rotor.x1) / 2, len = G.rotor.x1 - G.rotor.x0, p0 = V3().set(-640, 860, -760), p1 = V3().set(-420, 1550, -380), p2 = V3(), seat = V3(), wc = V3(), tt = V3();
    C.ax(gL(C) + 60 + len / 2, p2); C.ax(cy, seat); C.ax(gL(C) - 45 + 55, tt); j5.position.copy(tt); const tim = C.tag(P.rotor, "", "val", 0, 0, 0); tim.anchorPart = true;
    return { upd: (u) => { ov.userData.door.rotation.y = -1.8 * ease(ph(u, 0, 0.12)) * (1 - ph(u, 0.5, 0.6));
      if (u < 0.15) wc.copy(p0); else if (u < 0.45) { const q = ease((u - 0.15) / 0.3), a0 = (1 - q) * (1 - q), a1 = 2 * (1 - q) * q, a2 = q * q; wc.set(p0.x * a0 + p1.x * a1 + p2.x * a2, p0.y * a0 + p1.y * a1 + p2.y * a2, p0.z * a0 + p1.z * a1 + p2.z * a2); }
      else wc.lerpVectors(p2, seat, Math.pow(ph(u, 0.45, 0.62), 1.6));
      if (u < 0.62) C.toItem(P.rotor, cy, wc); else P.rotor.position.set(0, 0, 0); hm.emissiveIntensity = 0.75 * (1 - ph(u, 0.65, 1)); ovv.t = `${Math.round(Tr)} °C (magnet limit!)`;
      j5.visible = u < 0.85; tg.visible = u > 0.1 && u < 0.92; tg.position.set(wc.x, wc.y + len / 2 * C.upL + (u > 0.8 ? ph(u, 0.8, 0.92) * 200 : 0), wc.z);
      tg.updateMatrixWorld(true); op.reach(0, tg.localToWorld(_v.set(-110, 340, 0)), null, 1); op.reach(1, tg.localToWorld(_w.set(110, 340, 0)), null, 1);
      if (u > 0.62 && u < 0.85) { hold(op, _c.copy(wc), G.rotor.r1, 0.4, len / 2 + 10); } tim.on = u > 0.62 && u < 0.9; tim.t = `hold ≈ 1 min against the shoulder`;
      op.look.set(wc.x, 0, wc.z); op.home.set(-580, 0, -170 + clamp(wc.z, -500, 0) * 0.45); C.fp.copy(wc);
      C.act = u < 0.15 ? `rotor in the oven at ≈ ${Math.round(Tr)} °C (calculated, check magnet limit)` : u < 0.45 ? "lift the hot rotor with the tongs J4 (heat gloves)" : u < 0.62 ? "slide it down quickly and straight over the cone J5 to the shoulder" : "hold it against the shoulder until it grips; cool in air – never with water"; } }; },
  rear: (C) => { const { G, P } = C, op = C.newOp(-580, -170), H = C.J(heater()); H.position.set(-460, 0, -720); H.updateMatrixWorld(true); C.tt(H, "E9 induction heater", 170, 1000, 0);
    const hTop = H.localToWorld(V3().set(0, H.userData.top, 0)), hv = C.val(H.userData.scr, "IH-01"), j5 = C.J(tool(cone(G.M.dR / 2 + 2, 16, 110, MT.jig, 0, 0, 0, 32), "J5")), tt = V3(); C.ax(gL(C) - 45 + 55, tt); j5.position.copy(tt);
    const it = P.brgR.userData.items.map((o, i) => ({ o, seat: o.userData.seat, R: o.userData.R, B: o.userData.B, hot: true, n: `rear bearing ${i + 1}` })), seq = mountSeq(C, it, 0, 0.5, hTop), x = C.x;
    const nf = nutSeq(C, "nutR", G.nutR, 73, (x.rr || 1) * 3 + 2, x.rr || 1, 0.52, 1);
    return { upd: (u, t, dt) => { const r = seq(u); hv.t = r.cur >= 0 && r.cs < 0.25 ? `${Math.round(20 + 52 * ease(r.cs / 0.25))} °C` : r.cur >= 0 ? "72 °C" : "standby"; H.userData.coil.material = r.cur >= 0 && r.cs < 0.25 ? MT.hot : MT.dark; j5.visible = u < 0.5;
      if (r.cur >= 0) { hold(op, r.wc, r.it.R, 0.6); op.look.set(r.wc.x, 0, r.wc.z); op.home.set(-580, 0, -170 + clamp(r.wc.z, -500, 0) * 0.45); C.fp.copy(r.wc);
        C.act = r.cs < 0.25 ? `heat ${r.it.n} to ≈ 70 °C` : r.cs < 0.62 ? `carry ${r.it.n} over the cone J5 (back-to-back, V-line)` : `slide ${r.it.n} to its seat, hold until it grips`; nf(u, dt); P.nutR.visible = false; }
      else { op.home.set(-580, 0, -170); op.look.set(0, 0, 0); nf(u, dt); } } }; },
  draw: (C) => { const { G, P, PK } = C, op = C.newOp(-580, -170), q = G.nutR, J6 = C.J(springTool(q.r1 + 14, 150)); C.tt(J6, "J6 spring-pack tool + force gauge", 0, 200, 0); const fv = C.val(J6.userData.scr, "FG-01"), x = C.x;
    const extra = (PK.L0 - PK.Lc) * 6, base = V3(), hb = V3(), Fpk = (x.Fpk || PK.Fc) / 1000, st = { a: 0 };
    return { upd: (u, t, dt) => { const off = (1 - ease(ph(u, 0, 0.45))) * 520, comp = extra * (1 - ease(ph(u, 0.55, 0.9))); P.bar.position.y = off; P.springs.userData.set(comp, off, 8 * C.ex);
      J6.visible = u > 0.45; C.ax(q.x1 + (1 - ease(ph(u, 0.45, 0.55))) * 220, base); J6.position.copy(base); const sp = J6.userData.sp; if (u > 0.55 && u < 0.9) st.a += dt * 4; sp.rotation.y = st.a; sp.position.y = 150 + 20 - comp * 0.2;
      fv.t = `${fx(Fpk * ease(ph(u, 0.55, 0.9)), 2)} kN`; fv.on = J6.visible;
      if (u < 0.45) { C.ax(G.bar.x1 + off - 20, hb); hold(op, hb, 20, 0.8); C.fp.copy(hb); C.act = `insert drawbar + ${PK.n} disc springs (${PK.ns} groups × ${PK.S.np}) into the shaft bore – count them`; }
      else { J6.updateMatrixWorld(true); sp.localToWorld(hb.set(60, 110, 0)); op.reach(0, hb, null, 0.9); op.reach(1, J6.localToWorld(_v.set(q.r1 + 20, 80, 0)), null, 0.5); C.fp.copy(base);
        C.act = u < 0.55 ? "put the compression tool J6 on the tail" : u < 0.9 ? "turn the handwheel: compress the pack to the clamped length, read the force" : "fit the drawbar nut / collet, write the force down"; }
      op.look.set(0, 0, 0); } }; },
  balance: (C) => { const { G, P, sp, unit, stat } = C, ya = 560; Object.keys(P).forEach((p) => { P[p].visible = UNIT.includes(p); }); stat.visible = false; sp.rotation.z = Math.PI / 2; sp.position.set(260, ya, 0);
    const B = C.J(balancer(1100, ya)); B.position.x = -60; C.tt(B, "E16 balancing machine", -600, 1150, 0); const bv = C.val(B.userData.scr, "BAL-01");
    [[260 - (G.hsgF[0][1] + G.hsgF[2][1]) / 2, G.Ro], [260 - (G.bearings[4].x0 + 20), G.M.DR / 2 + 15]].forEach(([x0, r]) => { C.J(box(80, ya - r - 340, 120, MT.jig, x0, 340 + (ya - r - 340) / 2, 0)); [-1, 1].forEach((sd) => { const w = cyl(18, 30, MT.steel, x0, ya - r * 0.94, sd * r * 0.34, 16); w.rotation.x = Math.PI / 2; C.J(w); }); });
    const j7 = C.J(tool(new THREE.Group(), "J7")); const sl = lathe(rect(G.M.DR / 2, G.M.DR / 2 + 15, G.bearings[4].x0 - 6, G.bearings[5].x0 + G.bearings[5].B + 6), MT.jig, C.st.cut); j7.add(sl); j7.rotation.z = Math.PI / 2; j7.position.set(260, ya, 0); C.tag(j7, "J7 rear support sleeve", "tool", 0, G.bearings[4].x0, 0);
    const xt = 260 - gL(C) - 120, mot = C.J(box(160, 140, 160, MT.dark, xt, 410, 0)), pul = cyl(40, 30, MT.steel, xt, 520, 0, 24); pul.rotation.x = Math.PI / 2; C.J(pul); const belt = [segMesh(MT.rubber, 3), segMesh(MT.rubber, 3)]; belt.forEach((m) => C.J(m));
    C.tag(mot, "belt drive", "tool", 0, 80, 0);
    W2hsgF(C); const x = C.x, U0 = x.U0 || [[70, 30], [55, 200]], U1 = x.U1 || [[0.3, 0], [0.3, 0]], rc = x.rc || 38;
    const mkS = (part, q, a) => { const o = cyl(3, 10, MT.gold, (q.r1 - 3) * Math.sin(a), (q.x0 + q.x1) / 2, (q.r1 - 3) * Math.cos(a), 8); o.rotation.order = "YXZ"; o.rotation.y = a; o.rotation.x = Math.PI / 2; part.add(o); return o; };
    const a1 = (U0[0][1] + 180) * Math.PI / 180, a2 = (U0[1][1] + 180) * Math.PI / 180, s1 = mkS(P.nutF, G.nutF, a1), s2 = mkS(P.nutR, G.nutR, a2), arr = cone(5, 0, 14, MT.red, 0, 0, 0, 8);
    arr.position.set((G.nutF.r1 + 9) * Math.sin(a1 - Math.PI), (G.nutF.x0 + G.nutF.x1) / 2, (G.nutF.r1 + 9) * Math.cos(a1 - Math.PI)); arr.rotation.order = "YXZ"; arr.rotation.y = a1 - Math.PI; arr.rotation.x = -Math.PI / 2; P.nutF.add(arr);
    const op = C.newOp(150, -560), sd = C.J(screwdriver()), st = { a: 0, w: 0 }, pS = V3(), c = V3(), tS = C.tag(s1, "", "val", 0, 0, 0); C.fitObjs = [sp];
    return { upd: (u, t, dt) => { const live = C.live, meas = u < 0.3 || u > 0.66, wT = live && live.rpm != null ? live.rpm / 10000 * TAU * 3 : meas ? TAU * 2.2 : 0;
      st.w += (wT - st.w) * Math.min(1, dt * 2.5); if (!meas && Math.abs(st.w) < 0.5) { let tgt = Math.PI / 2 - (u < 0.5 ? a1 : a2), d = ((tgt - st.a) % TAU + TAU * 1.5) % TAU - Math.PI; st.a += d * Math.min(1, dt * 4); } else st.a += st.w * dt; unit.rotation.y = st.a;
      s1.visible = u > 0.45; s2.visible = u > 0.6; arr.visible = u < 0.66; tS.on = false;
      const tl = belt; _v.set(xt, 560, 0); _w.set(260 - gL(C) + 20, ya + 25, 0); placeSeg(tl[0], _v, _w); _v.set(xt, 480, 0); _w.set(260 - gL(C) + 20, ya - 25, 0); placeSeg(tl[1], _v, _w);
      bv.t = u < 0.3 ? `P1 ${fx(U0[0][0], 0)} g·mm ∠${fx(U0[0][1], 0)}° · P2 ${fx(U0[1][0], 0)} g·mm ∠${fx(U0[1][1], 0)}°` : u < 0.66 ? `add ${fx(U0[0][0] / rc, 2)} g ∠${fx((U0[0][1] + 180) % 360, 0)}° (P1) · ${fx(U0[1][0] / rc, 2)} g ∠${fx((U0[1][1] + 180) % 360, 0)}° (P2)` : `residual ${fx(U1[0][0], 1)} / ${fx(U1[1][0], 1)} g·mm (≤ ${fx(C.R.UperPlane, 1)})`;
      sd.visible = u > 0.36 && u < 0.64; const sN = u < 0.5 ? s1 : s2; sN.getWorldPosition(pS); sd.position.copy(pS).add(_w.set(0, 30, 0)); sd.rotation.set(0, 0, 0);
      if (sd.visible) { op.reach(0, _v.copy(pS).add(_w.set(0, 130, 0)), null, 1); op.reach(1, _v.copy(pS).add(_w.set(60, 40, -60)), pS, 0.5); op.home.set(pS.x - 60, 0, -520); C.fp.copy(pS); }
      else { op.rest(1); op.reach(0, _v.set(-660, 1000, -300), null, 0.3); op.home.set(-400, 0, -560); sp.getWorldPosition(c); C.fp.set(260 - gL(C) / 2, ya, 0); }
      op.look.set(sd.visible ? pS.x : -600, 0, sd.visible ? 0 : -150);
      C.act = u < 0.3 ? "measure the initial unbalance in plane 1 (front nut) + plane 2 (rear nut) – the unit turns in its own bearings" : u < 0.66 ? "stop; correction screws in the nut threads: m = U / r at the shown angle" : "measure again: residual unbalance ≤ Uper/2 per plane; lock the screws"; } }; },
  stator: (C) => { const { G, P } = C, op = C.newOp(-600, -170), cr = C.J(crane()); C.tt(cr, "E13 crane", 0, 2300, 0);
    const j9 = C.J(tool(new THREE.Group(), "J9")); j9.add(cyl(G.sleeve.r1 - 10, 14, MT.jig, 0, 0, 0, 3)); [0, 1, 2].forEach((i) => { const a = i / 3 * TAU; j9.add(box(14, 60, 14, MT.jigD, (G.sleeve.r1 - 14) * Math.sin(a), -30, (G.sleeve.r1 - 14) * Math.cos(a))); }); C.tt(j9, "J9 stator lifting fixture", 0, 30, 0);
    const pump = C.J(cart(300, 500, 260, "E17", "PRS-01")); pump.position.set(-470, 0, -640); C.tt(pump, "E17 pressure test unit", 0, 600, 0); const pv = C.val(pump.userData.scr, "PRS-01");
    const ins = C.J(cart(260, 420, 220, "E24", "INS-01")); ins.position.set(-880, 0, -300); C.tt(ins, "E24 insulation / winding tester", 0, 520, 0); const iv = C.val(ins.userData.scr, "INS-01");
    const yM = C.G.Lall + 330 - (G.xS + G.xR) / 2, hose = C.J(tube([[-420, 520, -640], [-300, 300, -400], [-260, yM - 40, -160], [-G.Ro * 0.5, yM, -G.Ro * 0.86]], 7, MT.hoseB)), lead = C.J(tube([[-800, 440, -300], [-500, 700, -250], [-120, C.G.Lall + 330 - G.xS + 40, -80], [-40, C.G.Lall + 330 - G.xS + 10, -30]], 4, MT.red));
    const r0 = recRow(C.st, "stator", 0), r1 = recRow(C.st, "stator", 1), hk = V3(), c = V3(), top = V3(), sx = (G.sleeve.x0 + G.sleeve.x1) / 2;
    return { upd: (u) => { const d = -(1 - ease(ph(u, 0, 0.6))) * 460; P.sleeve.position.y = d; P.stator.position.y = d; C.root.updateMatrixWorld(true);
      C.ax(G.sleeve.x0 + d, top); j9.position.copy(top); j9.position.y += 40; j9.visible = u < 0.62; cr.userData.setHook(0, u < 0.62 ? top.y + 70 : top.y + 70 + ph(u, 0.6, 0.7) * 500, 0);
      hose.visible = u > 0.6; pump.visible = u > 0.55; lead.visible = u > 0.84; ins.visible = u > 0.8;
      const p = 9 * ease(ph(u, 0.62, 0.7)); pv.t = u < 0.75 ? `${fx(p, 1)} bar (1.5 × p – example)` : r0 ? r0[1] : ""; iv.t = r1 ? r1[1].split("(")[0] : ""; pv.on = pump.visible; iv.on = ins.visible;
      C.ax(sx + d, c); if (u < 0.6) { hold(op, c, G.sleeve.r1, 0.5); op.home.set(-600, 0, -170); C.fp.copy(c); C.act = "lower cooling sleeve + stator (O-rings oiled) into the motor housing with J9 – leads out through the cable bore"; }
      else if (u < 0.82) { op.home.set(-480, 0, -210); op.look.set(-470, 0, -640); op.reach(0, _v.set(-470, 640, -490), null, 0.9); op.rest(1); C.fp.set(-250, 700, -300); C.act = "pressure test the cooling jacket: 1.5 × working pressure for 15 min, drop ≤ 0.1 bar"; }
      else { op.home.set(-640, 0, -120); op.look.set(-880, 0, -300); op.reach(1, _v.set(-800, 560, -300), null, 0.6); op.rest(0); C.fp.set(-400, 700, -200); C.act = "insulation test 500 V DC + winding resistance of the 3 phases"; }
      if (u < 0.6) op.look.set(0, 0, 0); } }; },
  insert: (C) => { C.noPartTags = true; const { G, P, unit } = C; C.tag(P.rotor, "Shaft unit (rotor unit)", "part", 0, 0, 0, { part: "rotor" }); const op = C.newOp(-600, -170), cr = C.J(crane()); C.tt(cr, "E13 crane (micro-lift)", 0, 2300, 0); const Lw = C.G.Lall + 330;
    [0, 1, 2].forEach((i) => { const a = (i / 3) * TAU + 0.3; C.J(tool(cyl(8, 260, MT.jig, (G.Ro - 22) * Math.sin(a), Lw - G.xS + 130, (G.Ro - 22) * Math.cos(a), 12), "J8")); }); C.tag(C.jig.children[C.jig.children.length - 1], "J8 guide rods (3 × Ø16)", "tool", 0, 130, 0);
    const ad = new THREE.Group(); ad.add(cyl(28, 40, MT.jig, 0, -20, 0, 24), torus(16, 5, MT.jigD, -52, TAU, 16)); ad.children[1].rotation.set(0, 0, 0); P.shaft.add(ad); C.tag(ad, "lifting adapter (nose)", "tool", 0, -40, 0);
    const bolts = P.hsgF.userData.bolts, order = [0, 4, 2, 6, 1, 5, 3, 7], Wr = C.J(wrench(9, 300)), wv = C.val(Wr.userData.scr, "TQ-01"), tw = C.tt(Wr, "E10 torque wrench", 0, 40, 0), nums = bolts.children.map((b, i) => C.tag(b, String(order.indexOf(i) + 1), "num", 0, 0, 0));
    const hk = V3(), c = V3(), b = V3(), r1 = recRow(C.st, "insert", 0), gv = C.tag(P.hsgF, "", "val", 0, 0, 0); gv.anchorPart = true;
    return { upd: (u) => { const d = C.placeMovers(ph(u, 0, 0.65) / 1.6 * 1.0 + 0, 650); unit.position.y = -(1 - ease(ph(u, 0, 0.65))) * 650; C.root.updateMatrixWorld(true);
      ad.visible = u < 0.7; ad.getWorldPosition(hk); cr.userData.setHook(0, hk.y + 20 + (u > 0.66 ? ph(u, 0.66, 0.72) * 400 : 0), 0);
      bolts.visible = u > 0.65; const bi = Math.min(7, Math.floor(ph(u, 0.72, 1) * 8)); bolts.children.forEach((o, i) => { o.position.y = G.hsgF[0][1] - 4 - (1 - ease(ph(u, 0.65 + i * 0.008, 0.69 + i * 0.008))) * 60; });
      nums.forEach((t) => { t.on = u > 0.7; }); Wr.visible = u > 0.72; tw.on = wv.on = Wr.visible;
      if (u < 0.65) { C.ax((G.hsgF[0][1] + G.hsgF[2][1]) / 2, c); unit.localToWorld(c.set(0, (G.hsgF[0][1] + G.hsgF[2][1]) / 2, 0)); C.sp.localToWorld(c.set(0, (G.hsgF[0][1] + G.hsgF[2][1]) / 2 + unit.position.y, 0)); hold(op, c, G.Ro, 0.5); C.fp.copy(c);
        gv.on = u > 0.5; gv.t = r1 ? `air gap ${r1[1].split("(")[0]}` : ""; C.act = "lower the shaft unit tail-first on slow speed: rotor into the stator WITHOUT touching (air gap ≈ 1 mm), housing on the guide rods"; }
      else { gv.on = false; const o = bolts.children[order[bi]]; o.getWorldPosition(b); Wr.position.copy(b); Wr.position.y += 10; Wr.rotation.y = -o.userData.a + Math.PI / 2 + 0.6 + Math.sin(u * 300) * 0.05; Wr.updateMatrixWorld(true);
        Wr.userData.grip.getWorldPosition(c); op.reach(0, c, null, 0.9); op.reach(1, _v.copy(b).add(_w.set(0, 40, 0)), null, 0.5); C.fp.copy(b); wv.t = `${Math.round(67 * ease(ph(u * 8 % 1, 0, 0.6)))} N·m`;
        C.act = `bolt the front bearing housing: 8 × M10, 67 N·m, crosswise ${order.map((q) => q + 1).join("-")} (3 stages 30 / 70 / 100 %)`; }
      op.look.set(0, 0, 0); } }; },
  cover: (C) => { const { G, P } = C, op = C.newOp(-600, -170), Lw = C.G.Lall + 330; const j10 = C.J(tool(new THREE.Group(), "J10")); j10.add(lathe(rect(G.g.segs[0].d / 2 + 0.5, G.g.segs[0].d / 2 + 14, 0, 18), MT.jig, false, 48)); j10.position.y = Lw; C.tt(j10, "J10 centring ring", 0, 20, 0);
    const scr = P.coverF.userData.screws.filter((o) => o.visible), order = [0, 3, 1, 4, 2, 5].filter((i) => i < scr.length), Wr = C.J(wrench(6, 220)), wv = C.val(Wr.userData.scr, "TQ-01"), tw = C.tt(Wr, "E10 small torque wrench", 0, 40, 0);
    const fe = C.J(feeler()), fv = C.tag(fe, "", "val", 0, 60, 0), tf = C.tt(fe, "J10 feeler gauge", 0, 90, 0), lab = C.x.lab || [0.25, 0.25, 0.25, 0.25], b = V3(), c = V3(), rN = G.g.segs[0].d / 2;
    return { upd: (u, t) => { C.placeMovers(ph(u, 0, 0.35)); j10.visible = u > 0.2 && u < 0.78; j10.position.y = Lw + (1 - ease(ph(u, 0.2, 0.3))) * 200; C.root.updateMatrixWorld(true);
      Wr.visible = u > 0.36 && u < 0.76; tw.on = wv.on = Wr.visible; fe.visible = u > 0.78; fv.on = tf.on = fe.visible;
      if (u < 0.36) { C.ax(10 + P.coverF.position.y, c); hold(op, c, G.Ro, 0.5); C.fp.copy(c); C.act = "front cover with the centring ring J10 (gap all round equal); floating sleeve + rear cover from below"; }
      else if (u < 0.77) { const i = Math.min(order.length - 1, Math.floor(ph(u, 0.36, 0.76) * order.length)), o = scr[order[i]]; o.getWorldPosition(b); Wr.position.copy(b); Wr.position.y += 6; Wr.rotation.y = -o.userData.a + Math.PI / 2 + 0.5; Wr.updateMatrixWorld(true);
        Wr.userData.grip.getWorldPosition(c); op.reach(0, c, null, 0.9); op.reach(1, _v.copy(b).add(_w.set(0, 30, 0)), null, 0.4); wv.t = `${fx(9.5 * ease((ph(u, 0.36, 0.76) * order.length) % 1 * 1.6), 1)} N·m`; C.fp.copy(b);
        C.act = "6 × M6, 9.5 N·m crosswise"; }
      else { const i = Math.min(3, Math.floor(ph(u, 0.78, 1) * 4)), a = 2.2 + i * Math.PI / 2 * 0.5; C.ax(0, b); b.x += (rN + 0.3) * Math.sin(a); b.z += (rN + 0.3) * Math.cos(a); fe.position.copy(b); fe.position.y += 30; fe.rotation.y = a;
        op.reach(0, _v.copy(b).add(_w.set(0, 90, 0)), null, 0.9); op.rest(1); fv.t = `gap ${fx(lab[i], 2)} mm (0.20–0.30)`; C.fp.copy(b); C.act = "check the labyrinth gap at 4 positions with the feeler gauges; sealing-air test"; }
      op.look.set(0, 0, 0); } }; },
  unclamp: (C) => clampLike(C, false),
  clamp: (C) => clampLike(C, true),
  sensors: (C) => { const { G, P, sp } = C, op = C.newOp(-600, -170), items = P.sens.userData.items, tester = C.J(cart(300, 520, 260, "E24", "INS-01")); tester.position.set(-470, 0, -640); C.tt(tester, "E24 electrical test set", 0, 620, 0); const tv = C.val(tester.userData.scr, "INS-01");
    C.root.updateMatrixWorld(true); const cab = items.map((o, i) => { const p = o.getWorldPosition(V3()); const m = C.J(tube([[p.x, p.y, p.z], [p.x * 1.6, p.y - 40, p.z * 1.6], [-200 - i * 30, 420, -400], [-420 + i * 20, 560, -640]], 3, MT.cable)); m.userData.n = m.geometry.index.count; m.geometry.setDrawRange(0, 0); return m; });
    items.forEach((o) => C.tag(o, o.userData.n, "part", 0, 0, 0)); const rows = (C.st.rec && C.st.rec.out && C.st.rec.out.sensors) || [], p = V3();
    return { upd: (u) => { const n = items.length; items.forEach((o, i) => { const s = ph(u, i / n * 0.6, (i + 1) / n * 0.6), q = ease(s); o.visible = u > i / n * 0.6; o.position.set((o.userData.r + 4 + (1 - q) * 120) * Math.sin(o.userData.a), o.userData.y, (o.userData.r + 4 + (1 - q) * 120) * Math.cos(o.userData.a)); const g = cab[i].geometry; g.setDrawRange(0, Math.floor(g.userData.n * ph(s, 0.5, 1) / 6) * 6 || Math.floor(cab[i].userData.n * ph(s, 0.5, 1) / 6) * 6); });
      const cur = Math.min(n - 1, Math.floor(ph(u, 0, 0.6) * n)); if (u < 0.6) { items[cur].getWorldPosition(p); op.reach(0, p, null, 0.8); op.rest(1); C.fp.copy(p); C.act = `fit the ${items[cur].userData.n}, route + label the cable (nothing may touch turning parts)`; }
      else { const r = rows[Math.min(rows.length - 1, Math.floor(ph(u, 0.6, 1) * rows.length))]; tv.t = r ? `${r[0].slice(0, 26)}: ${r[1]}` : ""; op.reach(0, _v.set(-470, 640, -490), null, 0.6); op.rest(1); C.fp.set(300, 650, -200); C.act = "electrical test: insulation, winding resistance, sensor values at 20 °C, encoder amplitude"; }
      op.home.set(u < 0.6 ? -600 : -480, 0, u < 0.6 ? -170 : -210); op.look.set(u < 0.6 ? 0 : -470, 0, u < 0.6 ? 0 : -640); } }; },
  runin: (C) => runTest(C, false),
  test: (C) => runTest(C, true),
  pack: (C) => { const { G, P, sp } = C, op = C.newOp(-600, -170), cr = C.J(crane()); C.tt(cr, "E13 crane", 0, 2300, 0); Object.values(P).forEach((o) => { o.visible = true; });
    const cap = new THREE.Group(); cap.add(lathe([[0, -26], [64, -26], [64, 10], [58, 10], [58, -20], [0, -20]], MT.capR, false, 48)); P.shaft.add(cap); C.tag(cap, "nose cap + taper cover", "part", 0, -30, 0);
    const crate = new THREE.Group(), cx = 760; crate.add(box(900, 100, 560, MT.wood, 0, 50, 0), box(900, 380, 20, MT.wood, 0, 290, -270), box(20, 380, 560, MT.wood, -440, 290, 0), box(20, 380, 560, MT.wood, 440, 290, 0));
    [-250, 250].forEach((x) => crate.add(box(80, 120, 300, MT.wood, x, 160, 0))); const front = box(900, 380, 20, MT.wood, 0, 290, 270); crate.add(front); const lid = box(920, 20, 580, MT.wood, 0, 0, 0); crate.add(lid); crate.position.set(cx, 0, 0); C.J(crate); C.tag(crate, "crate + shock indicator", "tool", -440, 480, 0);
    const film = C.J(box(L(C) + 80, 2 * G.Ro + 60, 2 * G.Ro + 60, MT.film, cx, 220 + G.Ro, 0)); film.userData.noFit = true; C.tag(film, "VCI film + desiccant", "part", 0, G.Ro + 30, 0);
    const pl = box(50, 30, 2, MT.white, 0, 0, 0); P.hsgM.add(pl); pl.position.set(0, (G.xS + G.xR) / 2, -(G.Ro + 1)); C.tag(pl, `type plate ${C.st.ids ? C.st.ids.spu : ""}`, "part", 0, 0, 0);
    const q0 = new THREE.Quaternion().copy(sp.quaternion), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), p0 = sp.position.clone(), p1 = V3().set(cx + L(C) / 2, 220 + G.Ro, 0), hk = V3(); C.fitObjs = [sp, crate]; C.explodable = false;
    return { upd: (u) => { cap.position.y = -(1 - ease(ph(u, 0, 0.2))) * 200; const m = ease(ph(u, 0.3, 0.6)); sp.quaternion.copy(q0).slerp(q1, m); sp.position.lerpVectors(p0, p1, m); sp.position.y += Math.sin(m * Math.PI) * 500;
      film.visible = u > 0.62; film.material = MT.film; front.visible = u > 0.75; lid.visible = u > 0.75; lid.position.set(0, 480 + (1 - ease(ph(u, 0.8, 0.95))) * 400, 0);
      C.root.updateMatrixWorld(true); sp.localToWorld(hk.set(0, L(C) / 2, 0)); cr.userData.setHook(hk.x, hk.y + G.Ro + 150 + (u > 0.62 ? ph(u, 0.62, 0.72) * 600 : 0), 0); C.fp.copy(hk);
      if (u < 0.25) { C.ax(-10, _c); op.reach(0, _v.copy(_c).add(_w.set(-70, 20, 0)), _c, 0.6); op.reach(1, _v.copy(_c).add(_w.set(70, 20, 0)), _c, 0.6); C.act = "transport lock: cap on the nose + taper cover, drawbar clamped, cooling channels blown empty + plugged"; }
      else if (u < 0.62) { hold(op, hk, G.Ro, 0.4, -G.Ro); C.act = "lift with the crane, turn horizontal: the spindle lies on its housing (never on the nose)"; }
      else { op.reach(0, _v.set(cx - 300, 520, 300), null, 0.5); op.rest(1); C.act = u < 0.8 ? "preservation (taper: special oil), desiccant, VCI film" : "close the crate, shock indicator, record closed + signed"; }
      op.home.set(u < 0.3 ? -600 : clamp(hk.x - 150, -60, cx - 400), 0, u < 0.3 ? -170 : -430); op.look.set(hk.x, 0, 0); } }; },
};
const L = (C) => C.G.Lall;
function W2hsgF(C) { const w = C.W.hsgF; w.parent.remove(w); C.sp.add(w); }

/* unclamp cylinder + stroke (16) and HSK clamping-force test (17) */
function clampLike(C, isClamp) {
  const { G, P, PK } = C, op = C.newOp(-600, -170), cartH = C.J(cart(340, 520, 280, "E19", "PRS-01")); cartH.position.set(-470, 0, -640); C.tt(cartH, "E19 hydraulic test unit", 0, 620, 0); const pv = C.val(cartH.userData.scr, "PRS-01");
  C.root.updateMatrixWorld(true); const cw = V3(); C.ax(G.cyl.end.x1 - 4, cw); const hose = C.J(tube([[-420, 560, -640], [-300, 300, -400], [200, cw.y - 30, -100], [cw.x + 20, cw.y + 6, cw.z - 20]], 6, MT.hoseR));
  const I = C.J(indicator("E11", 200)), iv = C.val(I.userData.scr, "IND-01"), ti = C.tt(I, "E11 indicator (stroke)", 200, 120, 0), x = C.x, pRel = x.pRel || 4, p = V3(), c = V3();
  const gauge = isClamp ? C.J(hskGauge()) : null, gv = gauge ? C.val(gauge.userData.scr, "HSK-01") : null; if (gauge) C.tt(gauge, "E18 HSK-A63 clamping-force gauge", 0, 100, 0);
  const Fcl = x.Fcl || [18, 18, 18], FclM = x.FclM || 18, Lw = C.G.Lall + 330;
  return { upd: (u, t) => { let frac = 0, pr = 0, txt = "";
    if (!isClamp) { C.placeMovers(ph(u, 0, 0.3)); const s = ph(u, 0.4, 1); pr = s < 0.4 ? PK.S.p * ease(s / 0.4) : s < 0.7 ? PK.S.p : PK.S.p * (1 - ease((s - 0.7) / 0.3)); frac = clamp((pr - pRel) / (PK.S.p * 0.12), 0, 1);
      txt = s > 0 ? `${fx(pr, 2)} MPa${frac > 0 && s < 0.4 ? ` – drawbar moves at ${fx(pRel, 2)}` : ""}` : "";
      C.act = u < 0.3 ? "fit the unclamp cylinder (piston, seals oiled), 6 × M8 crosswise" : u < 0.55 ? "raise the pressure slowly: note where the drawbar starts to move" : u < 0.82 ? "measure the drawbar stroke + tool ejection at the nose" : "release: springs clamp again; set the piston gap"; }
    else { const s = ph(u, 0.15, 1), cyc = Math.min(2, Math.floor(s * 3)), f = s * 3 - cyc; frac = u < 0.15 ? 0 : f < 0.15 ? ease(f / 0.15) : f < 0.35 ? 1 : 1 - ease((f - 0.35) / 0.15); pr = frac * PK.S.p;
      txt = `${fx(pr, 2)} MPa`; if (gv) gv.t = u < 0.15 ? "0.0 kN" : f < 0.5 ? (frac > 0.2 ? "unclamped" : "…") : `${fx(Fcl[cyc] * ease(ph(f, 0.5, 0.65)), 1)} kN (${cyc + 1}/3)${cyc === 2 && f > 0.8 ? ` → mean ${fx(FclM, 1)} kN` : ""}`;
      C.act = u < 0.15 ? "clean the taper, insert the HSK-A63 clamping-force gauge" : `cycle ${cyc + 1}/3: unclamp (pressure on) – clamp (pressure off, springs clamp) – read the force`; }
    pv.t = txt; const dx = frac * PK.S.stroke * 6; P.bar.position.y = -dx; P.cyl.userData.piston.position.y = -dx; P.springs.userData.set(-dx, 0, 8 * C.ex);
    C.root.updateMatrixWorld(true); C.ax(G.head.x0 - dx, p); I.position.copy(p); I.rotation.y = 2.5; I.visible = !isClamp && u > 0.4; ti.on = iv.on = I.visible; iv.t = `${fx(frac * (x.stroke || PK.S.stroke), 2)} mm stroke`;
    if (gauge) { gauge.position.set(0, Lw + (u < 0.15 ? (1 - ease(u / 0.15)) * 260 : 0) + dx * 0.3, 0); }
    if (u < 0.3 && !isClamp) { C.ax(G.cyl.body.x0 + P.cyl.position.y, c); hold(op, c, G.cyl.body.r1, 0.5); C.fp.copy(c); }
    else if (isClamp && u < 0.15) { gauge.getWorldPosition(c); c.y += 60; hold(op, c, 40, 0.8); C.fp.copy(c); }
    else { op.reach(0, _v.set(-470, 640, -490), null, 0.7); op.reach(1, _v.set(-120, Lw + 40, -60), null, 0.4); C.ax(isClamp ? -40 : G.head.x0, c); C.fp.copy(c); }
    const atC = !(u < 0.3 && !isClamp) && !(isClamp && u < 0.15); op.home.set(atC ? -480 : -600, 0, atC ? -210 : -170); op.look.set(atC ? -420 : 0, 0, atC ? -640 : 0); } };
}

/* run-in (19) and final test (20): horizontal in the run-in cradle J12 */
function runTest(C, isTest) {
  const { G, P, sp, unit, stat, M } = C; Object.values(P).forEach((o) => { o.visible = true; }); sp.rotation.z = Math.PI / 2; sp.position.set(300, 520, 0); C.liftY = 0;
  const base = C.J(tool(new THREE.Group(), "E20", "RUN-01")); base.add(box(1400, 80, 600, MT.dark, -100, 40, 0)); C.tag(base, "E20 run-in stand", "tool", -700, 90, 250);
  const j12 = C.J(tool(new THREE.Group(), "J12")); [300 - 80, 300 - 380].forEach((x) => { j12.add(box(90, 520 - G.Ro - 80, 300, MT.jig, x, 80 + (520 - G.Ro - 80) / 2, 0)); stat.add(lathe(rect(G.Ro, G.Ro + 14, 300 - x - 30, 300 - x + 30), MT.jigD, false)); }); C.tag(j12, "J12 run-in cradle", "tool", 220, 300, 160);
  const ch = C.J(cart(380, 520, 360, "E20", "RUN-01")); ch.position.set(-950, 0, 50); C.tag(ch, "chiller 20 ±0.5 °C", "tool", 0, 620, 0);
  const plc = C.J(tool(new THREE.Group(), "E20", "RUN-01")); plc.add(box(40, 800, 40, MT.dark, 0, 400, 0), box(420, 280, 40, MT.jigD, 0, 900, 20)); const ps = new THREE.Object3D(); ps.position.set(0, 1060, 50); plc.add(ps, box(380, 240, 6, MT.screen, 0, 900, 42)); led(plc, 180, 1020, 45);
  plc.position.set(-420, 0, -470); plc.rotation.y = 0.35; C.tag(plc, "run-in PLC + data logger", "tool", 230, 800, 0); const pv = C.val(ps, "RUN-01");
  const xW = (x) => 300 - x, yR = 520 + G.Ro;   // world x of local x, top of the housing
  C.J(tube([[-950, 470, 120], [-700, 300, 180], [xW(G.xS + 40), 300, 180], [xW(G.xS + 40), yR - 10, 60]], 9, MT.hoseB)); C.J(tube([[-950, 500, -10], [-700, 340, -150], [xW(G.xR - 40), 300, -150], [xW(G.xR - 40), yR - 10, -60]], 9, MT.hoseR));
  C.J(tube([[-760, 120, 260], [xW(L(C) - 40), 160, 220], [xW(L(C) - 30), 520 - 60, 100]], 5, MT.hoseY)); C.tag(C.jig.children[C.jig.children.length - 1], "unclamp + sealing air", "tool", xW(L(C) - 40), 160, 220);
  // temperature zones on the housing (front bearings / stator / rear bearings)
  const zones = [["front", G.hsgF[0][1], G.hsgF[2][1]], ["stator", G.stator.x0, G.stator.x1], ["rear", G.sleeveR.x0, G.sleeveR.x1]].map(([n, a, b]) => { const m = mat(0x5080c0, { em: 0x203050 }); C.mats.push(m); const o = ringM({ r0: G.Ro + 0.5, r1: G.Ro + 3, x0: a, x1: b }, m, C.st.cut, 64); stat.add(o); const tg = C.tag(o, "", "val", 0, 0, 0); tg.anchorBox = [(a + b) / 2, G.Ro + 3]; tg.anchorPart = true; tg.zone = n; return { n, m, tg, o }; });
  const mark = box(10, 3, 30, MT.red, 0, -1.5, 45); P.shaft.add(mark);
  const ri = C.x.ri || { tr: [[0, 0]], sp: [[0, 0]], Tlim: 25 }, op = C.newOp(-560, -820), st = { a: 0 }, col = new THREE.Color(), hd = V3();
  let probes = null, mdr = null, load = null, vm = null;
  if (isTest) { mdr = new THREE.Group(); mdr.add(cyl(16, 300, MT.mandrel, 0, -170, 0, 48), cyl(24, 40, MT.mandrel, 0, -10, 0, 48)); unit.add(mdr); C.tag(mdr, "E21 test mandrel 300 mm", "tool", 0, -320, 0);
    const fr = C.J(tool(new THREE.Group(), "J11", "PRB-01")); fr.add(box(30, 30, 380, MT.jig, 300 + 170, 520 + 120, -40), box(30, 160, 30, MT.jigD, 300 + 30, 520 + 70, 150), box(30, 160, 30, MT.jigD, 300 + 320, 520 + 70, 150)); [[300 + 30], [300 + 320]].forEach(([x]) => { const pr = cyl(6, 50, MT.dark, x, 520, 40, 12); pr.rotation.x = Math.PI / 2; fr.add(pr); }); C.tag(fr, "J11 + E22 capacitive probes", "tool", 300 + 320, 520 + 150, 150);
    const ax = cyl(6, 50, MT.dark, 300 + 25, 520 + 60, 0, 12); ax.rotation.z = Math.PI / 2; fr.add(ax); probes = fr;
    load = C.J(tool(new THREE.Group(), "E26")); load.add(box(160, 40, 160, MT.dark, 0, 20, 0), cyl(30, 280, MT.jig, 0, 180, 0, 20)); const rod = cyl(12, 120, MT.steel, 0, 360, 0, 12); load.add(rod); load.userData.rod = rod; load.position.set(300 + 290, 0, 0); C.tag(load, "E26 stiffness loading device", "tool", 0, 300, 0);
    vm = C.J(tool(new THREE.Group(), "E23")); vm.add(cyl(14, 30, MT.jigD, 0, 0, 0, 12)); vm.position.set(xW(G.xS / 2 + 20), yR + 15, 0); C.tag(vm, "E23 vibration sensor", "tool", 0, 20, 0); }
  const x = C.x, tests = C.st.rec && C.st.rec.out ? C.st.rec.out.test || [] : [];
  return { upd: (u, t, dt) => { const live = C.live; let rpm, Tf, Tr, Ts, txt;
    if (!isTest) { const i = clamp(Math.floor(u * (ri.sp.length - 1)), 0, ri.sp.length - 1); rpm = ri.sp[i][1]; const dT = ri.tr[i][1]; Tf = 20 + dT; Tr = 20 + dT * 0.75; Ts = 20 + dT * 1.25; }
    else { rpm = u < 0.4 ? 30 : u < 0.65 ? 0 : M.nmax; Tf = 20 + 12 * ph(u, 0.65, 1); Tr = 20 + 9 * ph(u, 0.65, 1); Ts = 20 + 15 * ph(u, 0.65, 1); }
    if (live) { if (live.rpm != null) rpm = live.rpm; if (live.T) { if (live.T.front != null) Tf = live.T.front; if (live.T.rear != null) Tr = live.T.rear; if (live.T.stator != null) Ts = live.T.stator; } }
    const w = isTest && u < 0.4 ? 0.8 : rpm / 10000 * TAU * 2.2; st.a += w * dt; unit.rotation.y = st.a;
    zones.forEach((z) => { const T = z.n === "front" ? Tf : z.n === "rear" ? Tr : Ts; heatColor(T, col); z.m.color.copy(col); z.m.emissive.copy(col).multiplyScalar(0.45); z.tg.t = `${z.n} ${fx(T, 1)} °C`; });
    const vib = live && live.vib != null ? live.vib : isTest ? x.vib : 0.3 + 0.2 * rpm / M.nmax;
    pv.t = `${Math.round(rpm)} rpm · ΔT front ${fx(Tf - 20, 1)} K · ${fx(vib, 2)} mm/s${live ? " · LIVE" : ""}`;
    if (!isTest) { op.home.set(-520, 0, -820); op.look.set(-420, 0, -470); op.reach(0, _v.set(-430 + Math.sin(t) * 40, 920, -430), null, 0.2); op.rest(1); sp.localToWorld(hd.set(0, G.g.L / 2, 0)); C.fp.copy(hd);
      C.act = `run-in: speed steps up to nmax, wait at each step until the bearing temperature is stable (stop at ΔT ${ri.Tlim} K) – now ${Math.round(rpm)} rpm`; }
    else { const s4 = Math.floor(ph(u, 0, 0.4) * 4); mdr.rotation.y = s4 * Math.PI / 2; load.visible = u > 0.38 && u < 0.7; const F = 1000 * ease(ph(u, 0.42, 0.6)) * (1 - ph(u, 0.62, 0.66)); load.userData.rod.position.y = 360 + (u > 0.38 ? 80 : 0);
      const r0 = tests[0], r1 = tests[1], r2 = tests[3], r3 = tests[4], r4 = tests[5];
      txt = u < 0.4 ? `mandrel pos ${s4 + 1}/4 · taper ${r0 ? r0[1].split("(")[0] : ""}· 300 mm ${r1 ? r1[1].split("(")[0] : ""}` : u < 0.65 ? `F ${Math.round(F)} N → δ ${fx(F / (x.krad || 200), 2)} µm · ${r2 ? r2[1].split("(")[0] : ""}` : `nmax · growth ${fx((x.grow || 10) * ph(u, 0.65, 1), 1)} µm · vib ${fx(vib, 2)} mm/s`;
      pv.t = txt; op.home.set(u < 0.65 ? 520 : -520, 0, u < 0.65 ? -560 : -820); op.look.set(u < 0.65 ? 450 : -420, 0, u < 0.65 ? 0 : -470);
      if (u < 0.65) { op.reach(0, _v.set(300 + 200, 640, -60), null, 0.4); op.rest(1); C.fp.set(300 + 170, 520, 0); } else { op.reach(0, _v.set(-430, 920, -430), null, 0.2); op.rest(1); sp.localToWorld(hd.set(0, G.g.L / 2, 0)); C.fp.copy(hd); }
      C.act = u < 0.4 ? "runout at the taper and at the 300 mm test mandrel – turn the mandrel 4 × 90° and average" : u < 0.65 ? "stiffness: load step by step, measure the displacement, k = ΔF / Δx" : "thermal growth at the nose (axial probe, 60 min at nmax) + vibration + noise"; } } };
}

/* ------------------------------------------------------------------ the view */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export function create(el, getState0) {
  const Q = new URLSearchParams(location.search);
  let getState = getState0;
  if (Q.has("as3live")) getState = () => { const s = getState0(); if (!s) return s; const tt = performance.now() / 1000; return { ...s, live: { rpm: 7500 + 500 * Math.sin(tt / 3), T: { front: 34 + Math.sin(tt / 5), rear: 29, stator: 41 }, vib: 0.44,
    devices: { "IH-01": { state: "online", last: { temp_c: 71.8 } }, "TQ-01": { state: "online", last: { torque_nm: 125.2 } }, "IND-01": { state: "offline", last: {} }, "RUN-01": { state: "online", last: { rpm: 9000 } }, "FG-01": { state: "sim", last: { force_kn: 2.9 } } } } }; };
  if (Q.has("as3nocut")) { const cb = document.getElementById("as3dCut"); if (cb) cb.checked = false; }
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0); el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1); if (window.dtTheme) window.dtTheme.scene(scene, "#e9edf1", "#1c2126");
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 2, 40000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(800, 1800, 1200); scene.add(sun); const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-900, 600, -600); scene.add(fill);
  const controls = new OrbitControls(camera, renderer.domElement); const nice = niceControls(controls, camera, scene, { minDist: 40, maxDist: 20000 });
  const mk = (tag, cls, txt) => { const d = document.createElement(tag); d.className = cls; if (txt) d.textContent = txt; return d; };
  const lbl = mk("div", "mf3d-lbl as3-cap"); el.appendChild(lbl);
  const bar = mk("div", "as3-bar"); el.appendChild(bar);
  const exBtn = mk("button", "btn ghost as3-btn", "Exploded view"), foBtn = mk("button", "btn ghost as3-btn on", "Follow"), fitBtn = mk("button", "btn ghost as3-btn", "Fit view"); bar.append(exBtn, foBtn, fitBtn);
  exBtn.title = "parts separate along the axis, with names"; foBtn.title = "camera follows the action";
  const tagL = mk("div", "as3-tags"); el.appendChild(tagL);
  const info = mk("div", "as3-info"); info.hidden = true; el.appendChild(info);
  const liveB = mk("div", "as3-live", "LIVE"); liveB.hidden = true; el.appendChild(liveB);
  const hint = mk("div", "as3-hint", "click a part or tool for its data · drag = turn · wheel = zoom"); el.appendChild(hint);
  let cur = null, key = "", t0 = performance.now(), last = performance.now(), ex = 0, exOn = Q.has("as3ex"), follow = true, glide = null, pendFit = false, sel = null, hov = null, ptr = null, ptrMoved = false, down = null, picked = false, lastLive = 0;
  const camR = V3(), tv = V3(), tw = V3(), tq = V3(), bx = new THREE.Box3(), bb = new THREE.Box3();
  const OPM = [MT.coat, MT.trouser, MT.skin, MT.cap, MT.mask, MT.shoe, MT.glove, MT.hglove]; OPM.forEach((m) => { m.transparent = true; m.needsUpdate = true; }); let opA = 1;
  const opFade = (dt) => { const op = cur.C.op; let tgt = 1; if (op && op.g.visible) { const dT = camera.position.distanceTo(controls.target);
      for (const dy of OPY) { tq.set(0, dy, 0); op.hip.localToWorld(tq); const dC = camera.position.distanceTo(tq); tq.project(camera); if (dC < dT - 80 && Math.abs(tq.x) < 0.5 && Math.abs(tq.y) < 0.7) tgt = 0.3; } }
    if (Math.abs(opA - tgt) > 0.005) { opA += (tgt - opA) * Math.min(1, dt * 5); OPM.forEach((m) => { m.opacity = opA; m.depthWrite = opA > 0.9; }); } };
  // ---------------- fit + glide
  const fitPose = (outT, outP) => { const C = cur.C; bx.makeEmpty();
    (C.ex > 0.02 ? [C.sp] : C.fitObjs).forEach((f) => f.traverseVisible((o) => { if (o.isMesh && !o.userData.floor && !o.userData.noFit && !o.userData.op) { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); bb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); if (o.isInstancedMesh) { o.computeBoundingSphere(); } bx.union(bb); } }));
    if (bx.isEmpty()) bx.setFromObject(cur.root); const fo = C.ex <= 0.02 && C.fitObjs.length === 1 && C.fitObjs[0] === C.sp, c = bx.getCenter(outT), s = bx.getSize(tw).length() * (fo ? 1.9 : 1.25) + (fo ? 450 : 250);
    outP.copy(c).add(tv.set(0.62, 0.38, 0.72).normalize().multiplyScalar(s)); camera.near = s / 200; camera.far = s * 60; camera.updateProjectionMatrix(); };
  const fit = (smooth) => { if (!cur) return; cur.root.updateMatrixWorld(true); const T = V3(), Pp = V3(); fitPose(T, Pp); if (nice && nice.stop) nice.stop();
    if (smooth) glide = { t: 0, a: controls.target.clone(), b: T, pa: camera.position.clone(), pb: Pp }; else { controls.target.copy(T); camera.position.copy(Pp); glide = null; } controls.update(); };
  fitBtn.addEventListener("click", () => fit(true));
  exBtn.addEventListener("click", () => { exOn = !exOn; exBtn.classList.toggle("on", exOn); pendFit = true; });
  foBtn.addEventListener("click", () => { follow = !follow; foBtn.classList.toggle("on", follow); });
  exBtn.classList.toggle("on", exOn);
  // ---------------- dispose
  const dispose = () => { if (!cur) return; scene.remove(cur.root); cur.root.traverse((o) => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.isInstancedMesh && o.dispose) o.dispose(); }); cur.C.mats.forEach((m) => { const h = HL.get(m); if (h) { h.dispose(); HL.delete(m); } m.dispose(); }); cur.C.tags.forEach((t) => t.el && t.el.remove()); };
  const rebuild = (st) => { dispose(); unHover(); sel = null; info.hidden = true; cur = build(st); scene.add(cur.root); cur.C.live = st.live || null;
    cur.C.tags.forEach((t) => { t.el = mk("div", `as3-tag as3-${t.kind}`); t.el.style.display = "none"; t._t = null; t._on = false; tagL.appendChild(t.el); });
    cur.C.applyEx(exOn && cur.explodable ? 1 : 0); ex = exOn && cur.explodable ? 1 : 0; cur.upd(st.u, 0, 1); cur.root.updateMatrixWorld(true); fit(false); exBtn.disabled = !cur.explodable; exBtn.title = cur.explodable ? "parts separate along the axis, with names" : "parts are already laid out on the bench";
    if (!picked && Q.get("as3pick")) { picked = true; setTimeout(() => { const p = Q.get("as3pick"); const o = cur.C.P[p] || cur.C.tools.find((tl) => tl.userData.tool === p); if (o) select(o); }, 300); } };
  // ---------------- picking, hover, info
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), HL = new Map();
  const shown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
  const pickAt = (cx, cy) => { if (!cur) return null; const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(cur.root, true); for (const h of hits) { let o = h.object; if (!shown(o) || o.userData.floor) continue; if (o.material && o.material.transparent && o.material.opacity < 0.35) continue;
      for (; o && o !== cur.root; o = o.parent) if (o.userData.part || o.userData.tool) return o; } return null; };
  const hlMat = (m) => { let h = HL.get(m); if (!h) { h = m.clone(); h.emissive = new THREE.Color(0x2a5a9a); h.emissiveIntensity = 0.55; HL.set(m, h); } return h; };
  const setHL = (o, on) => o.traverse((m) => { if (!m.isMesh) return; if (on) { if (!m.userData.m0) { m.userData.m0 = m.material; m.material = hlMat(m.material); } } else if (m.userData.m0) { m.material = m.userData.m0; m.userData.m0 = null; } });
  function unHover() { if (hov) { setHL(hov, false); hov = null; } }
  const rowsHtml = (rows) => rows.map(([l, v, r]) => `<tr><td>${esc(l)}</td><td class="as3-${r}">${esc(v)}</td></tr>`).join("");
  const eqName = (id, st) => (st.EQ && st.EQ[id] ? st.EQ[id][0] : st.JIG && st.JIG[id] ? st.JIG[id][0] : EQS[id] || id);
  function select(o) { sel = o; const st = getState(); if (!st) return; const steps = (window.asmSP && window.asmSP.steps) || st.steps || [], live = st.live; let h = "";
    if (o.userData.part) { const kk = o.userData.part, pi = PART[kk]; if (!pi) return; h += `<div class="as3-ih"><b>${esc(pi[0])}</b><button class="as3-x" title="close">×</button></div><table>`;
      h += `<tr><td>Material</td><td>${esc(pi[1])}</td></tr><tr><td>Key data</td><td>${esc(pi[2](st))}</td></tr>`;
      const ids = st.ids || {}, sn = { shaft: ids.shaft, brgF: ids.setF, brgR: ids.setR, rotor: ids.motor, stator: ids.motor, spF: ids.spacer, hsgF: ids.hsgF, hsgM: ids.hsgM }[kk]; if (sn) h += `<tr><td>Serial</td><td>${esc(sn)}</td></tr>`;
      h += `<tr><td>Equipment / jigs</td><td>${pi[4].map((id) => `${id} ${esc(eqName(id, st))}`).join("<br>")}</td></tr></table>`;
      pi[3].forEach((sk) => { const i = steps.findIndex((q) => q.k === sk), rows = st.rec && st.rec.out ? st.rec.out[sk] : null; if (i < 0 || !rows) return;
        h += `<div class="as3-sub">Step ${i + 1} · ${esc(steps[i].n)}</div>` + (i <= st.si ? `<table>${rowsHtml(rows)}</table>` : `<p class="as3-m">measured at step ${i + 1}</p>`); });
    } else { const id = o.userData.tool, dev = o.userData.dev; h += `<div class="as3-ih"><b>${esc(id)} ${esc(eqName(id, st))}</b><button class="as3-x" title="close">×</button></div><table>`;
      const cap = st.EQ && st.EQ[id] ? st.EQ[id][2] : st.JIG && st.JIG[id] ? st.JIG[id][1] : ""; if (cap) h += `<tr><td>Capability</td><td>${esc(cap)}</td></tr>`;
      h += `<tr><td>Type</td><td>${id[0] === "J" ? "jig – MAKE (blue)" : "equipment – BUY"}</td></tr>`;
      const used = steps.map((q, i) => ((q.eq || []).includes(id) || (q.jig || []).includes(id) ? i + 1 : 0)).filter(Boolean); if (used.length) h += `<tr><td>Used in step</td><td>${used.join(", ")}</td></tr>`;
      if (dev) { const d = live && live.devices ? live.devices[dev] : null; h += `<tr><td>Device</td><td>${esc(dev)} (${esc(DEVN[dev] || "")}) – ${d ? esc(d.state || "?") : live ? "not reported" : "simulated"}</td></tr>`; if (d && d.last) h += `<tr><td>Last values</td><td>${esc(Object.entries(d.last).map(([a, b]) => `${a} = ${b}`).join(", "))}</td></tr>`; }
      h += "</table>"; const rows = st.rec && st.rec.out ? st.rec.out[st.k] : null; if (rows && rows.length) h += `<div class="as3-sub">Checks of this step</div><table>${rowsHtml(rows)}</table>`; }
    info.innerHTML = h; info.hidden = false; info.querySelector(".as3-x").addEventListener("click", () => { info.hidden = true; sel = null; }); }
  const cvs = renderer.domElement;
  cvs.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, b: e.button }; if (e.button !== 0) { follow = false; foBtn.classList.remove("on"); } });
  cvs.addEventListener("pointerup", (e) => { if (down && down.b === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) { const o = pickAt(e.clientX, e.clientY); if (o) select(o); else { info.hidden = true; sel = null; } } down = null; });
  cvs.addEventListener("pointermove", (e) => { ptr = { x: e.clientX, y: e.clientY }; ptrMoved = true; });
  cvs.addEventListener("pointerleave", () => { ptr = null; unHover(); });
  cvs.addEventListener("dblclick", () => { follow = false; foBtn.classList.remove("on"); });
  cvs.addEventListener("wheel", () => { glide = null; }, { passive: true });
  // ---------------- tags (HTML labels)
  const placed = [], DYS = [0, -1, 1, -2, 2], OPY = [150, 420];
  let np = 0; const hitAt = (x, y, ww, hh) => { for (let i = 0; i < np; i++) { const p = placed[i]; if (x < p.x + p.w && x + ww > p.x && y < p.y + p.h && y + hh > p.y) return p; } return null; };
  const fmtLast = (l) => Object.entries(l).slice(0, 3).map(([a, b]) => `${a} ${typeof b === "number" ? +b.toFixed(2) : b}`).join(" · ");
  const updTags = (w, h, live) => { const C = cur.C; np = 0; camR.setFromMatrixColumn(camera.matrixWorld, 0); const yTop = lbl.offsetTop + lbl.offsetHeight + 4;
    const exM = C.ex > 0.3, now = performance.now(), doLive = live && now - lastLive > 250; if (doLive) lastLive = now;
    for (const t of C.tags) { let on = t.on && shown(t.o) && (exM ? t.kind === "part" && (t.exOnly || t.part) : !t.exOnly);
      if (on && t.kind === "val" && !t.t && !(live && t.dev)) on = false;
      if (on) { const ud = t.anchorBox ? { cy: t.anchorBox[0], r: t.anchorBox[1] } : (t.kind === "part" || t.anchorPart) && t.o.userData.part ? t.o.userData : null;
        if (ud) { t.o.localToWorld(tv.set(0, ud.cy, 0)); tw.copy(tv).addScaledVector(camR, -ud.r); tv.addScaledVector(camR, ud.r); tw.project(camera); t._lx = (tw.x + 1) / 2 * w; } else { t.o.localToWorld(tv.copy(t.p)); t._lx = null; }
        tv.project(camera); if (tv.z > 1 || tv.x < -1.1 || tv.x > 1.1 || tv.y < -1.1 || tv.y > 1.1) on = false; }
      if (t.dev && t.kind === "val") { if (doLive) { const d = live.devices && live.devices[t.dev]; t._live = d && d.last && Object.keys(d.last).length ? `${t.dev} · ${fmtLast(d.last)}` : null; } if (live && t._live) t.t = t._live; }
      if (!on) { if (t._on) { t.el.style.display = "none"; t._on = false; } continue; }
      if (!t._on) { t.el.style.display = ""; t._on = true; }
      if (t._t !== t.t) { t._t = t.t; t.el.textContent = t.t; t._w = 0; }
      if (!t._w) { t._w = t.el.offsetWidth || 80; t._h = t.el.offsetHeight || 18; }
      const ax = (tv.x + 1) / 2 * w, lx = t._lx != null ? t._lx : ax, y0 = (1 - tv.y) / 2 * h - t._h / 2, xr = t.kind === "num" ? ax - 8 : ax + 6, xl = (t.kind === "num" ? ax - 8 : lx - 6) - (t.kind === "num" ? 0 : t._w);
      let x = t.anchorPart ? xl : xr, y = y0, ok = false;
      for (let side = 0; side < 2 && !ok; side++) { const xx = (side === 0) === !t.anchorPart ? xr : xl; for (let k = 0; k < DYS.length; k++) { const yy = clamp(y0 + DYS[k] * (t._h + 1), yTop, h - t._h - 2), x2 = clamp(xx, 2, w - t._w - 2); if (!hitAt(x2, yy, t._w, t._h)) { x = x2; y = yy; ok = true; break; } } }
      if (!ok) { for (let pass = 0; pass < 6; pass++) { const p = hitAt(x, y, t._w, t._h); if (!p) break; y = p.y + p.h + 1; } }
      x = clamp(x, 2, w - t._w - 2); y = clamp(y, yTop, h - t._h - 2); const pp = placed[np] || (placed[np] = { x: 0, y: 0, w: 0, h: 0 }); pp.x = x; pp.y = y; pp.w = t._w; pp.h = t._h; np++; t.el.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`; } };
  // ---------------- loop
  const loop = () => {
    requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!el.offsetParent) return;
    const st = getState(); if (!st || !st.G) return;
    const w = el.clientWidth, h = el.clientHeight; if (w && h && (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const k = `${st.si}|${st.cut}|${JSON.stringify(st.F)}|${st.ids && st.ids.spu}`;
    if (k !== key) { key = k; rebuild(st); }
    const C = cur.C; C.live = st.live || null; liveB.hidden = !C.live;
    const exT = exOn && cur.explodable ? 1 : 0; if (Math.abs(ex - exT) > 1e-4) { ex += (exT - ex) * Math.min(1, dt * 4); if (Math.abs(ex - exT) < 0.004) ex = exT; C.applyEx(ex); }
    if (pendFit && Math.abs(ex - exT) < 0.03) { pendFit = false; fit(true); }
    C.root.updateMatrixWorld(true);
    cur.upd(st.u, (now - t0) / 1000, dt);
    // device LEDs (live only)
    for (const tl of C.tools) { const l = tl.userData.ledM; if (!l) continue; const d = C.live && C.live.devices && tl.userData.dev ? C.live.devices[tl.userData.dev] : null; l.visible = !!d; if (d) l.material = d.state === "online" || d.state === "sim" ? MT.ledOn : MT.ledOff; }
    // camera: glide (fit) or follow the action
    if (glide) { glide.t = Math.min(1, glide.t + dt / 0.7); const e = ease(glide.t); controls.target.lerpVectors(glide.a, glide.b, e); camera.position.lerpVectors(glide.pa, glide.pb, e); if (glide.t >= 1) glide = null; }
    else if (follow && ex < 0.02 && !down && C.fp.lengthSq() > 0) { tv.subVectors(C.fp, controls.target).multiplyScalar(1 - Math.exp(-dt * 1.6)); controls.target.add(tv); camera.position.add(tv); }
    if (ptrMoved && ptr && !down) { ptrMoved = false; const o = pickAt(ptr.x, ptr.y); if (o !== hov) { unHover(); if (o) { hov = o; setHL(o, true); } cvs.style.cursor = o ? "pointer" : ""; } }
    const cap = `Step ${st.no} · ${st.n} — ${Math.round(st.u * 100)} %${C.act ? "  ·  " + C.act : ""}`; if (cap !== lbl._t) { lbl._t = cap; lbl.textContent = cap; }
    controls.update(); opFade(dt); renderer.render(scene, camera); updTags(w, h, C.live);
  };
  loop();
  if (Q.has("shot3d")) { setTimeout(() => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -200); }, 1200); setInterval(() => { let im = document.getElementById("shot3dimgSP"); if (!im) { im = document.createElement("img"); im.id = "shot3dimgSP"; im.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none"; el.insertBefore(im, tagL); } im.src = renderer.domElement.toDataURL(); }, 800); }
  return { fit: () => fit(true), explode: (on) => { exOn = on !== undefined ? !!on : !exOn; exBtn.classList.toggle("on", exOn); pendFit = true; }, select: (p) => { const o = cur && (cur.C.P[p] || cur.C.tools.find((t) => t.userData.tool === p)); if (o) select(o); } };
}
