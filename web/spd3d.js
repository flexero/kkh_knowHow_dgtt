/* 3D view of the SPINDLE SHAFT manufacturing twin (HMC build item 4).  Follows the 2D twin (operation + progress u,
   read every frame from getState()).  The shaft is a LATHE solid built from the same profile functions as the 2D side
   view (outer radius r_o(x) and inner radius r_i(x) for the current operation + progress: allowances, gun-drilled bore,
   taper stock, pre-ground / ground / nitrided surfaces).  "Cut" removes a quarter so the hollow bore, the HSK taper and
   the drill / internal grinding wheel inside can be seen.  Machines are simplified but show the real set-ups (chuck +
   tailstock, steady rest, gun-drilling machine with whip guides, pit / bell furnaces, cylindrical + internal grinder,
   balancing machine, roundness tester).  Offline: local three.js + view3d.js niceControls. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? 0.35, roughness: o.r ?? 0.5, side: o.ss ? THREE.FrontSide : THREE.DoubleSide, transparent: !!o.op, opacity: o.op ?? 1, emissive: o.em || 0x000000 });
const M = {
  steel: mat(0xb4bec7, { m: 0.25, r: 0.45 }), nit: mat(0x6f7c8a, { m: 0.25, r: 0.5 }), preg: mat(0xd0d8de, { m: 0.3, r: 0.3 }), ground: mat(0xf2f6f9, { m: 0.4, r: 0.15 }),
  cutF: mat(0xd98a6b, { m: 0.1, r: 0.8 }), carbide: mat(0xe0a030, { m: 0.4, r: 0.4 }), abrasive: mat(0xc9b48f, { m: 0.05, r: 0.9 }), body: mat(0xd5dbe1, { m: 0.2, r: 0.7 }),
  dark: mat(0x5c6670, { m: 0.3, r: 0.6 }), black: mat(0x24282c, { m: 0.2, r: 0.7 }), red: mat(0xd03b3b), green: mat(0x2f9e5f), glass: mat(0x9fc6e6, { op: 0.28, r: 0.1 }),
  hot: mat(0xe8742a, { em: 0x000000 }), mask: mat(0xb5651d, { r: 0.8 }), blue: mat(0x2f6fb0, { op: 0.75 }), granite: mat(0x3d4247, { m: 0.1, r: 0.8 }), vci: mat(0x7fb37f, { op: 0.3 }), oil: mat(0xd9c27a, { op: 0.5 }),
};
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };
const cyl = (r, h, m, x = 0, y = 0, z = 0, seg = 32) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); return o; };
const cylX = (r, h, m, x = 0, y = 0, z = 0, seg = 32) => { const o = cyl(r, h, m, x, y, z, seg); o.rotation.z = Math.PI / 2; return o; };
const cone = (r, h, m) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 24), m);
function sample(fn, B, L) {
  const xs = [...new Set([0, L, ...B.filter((x) => x > 0 && x < L)])].sort((a, b) => a - b), o = [];
  for (let i = 0; i < xs.length - 1; i++) { const a = xs[i], b = xs[i + 1]; if (b - a < 1e-3) continue; const e = Math.min(0.05, (b - a) / 3); o.push([a, fn(a + e)], [b, fn(b - e)]); }
  return o;
}

/* ------------------------------------------------------------------ the shaft as a lathe solid along +X (nose at x = 0) */
function shaftObj(G, cut) {
  const grp = new THREE.Group(), inner = new THREE.Group(); inner.rotation.z = -Math.PI / 2; grp.add(inner);   // lathe Y axis → world +X
  const phiS = 0, phiL = cut ? Math.PI * 1.5 : TAU; let sig = "";
  const lathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts, 96, phiS, phiL), m);
  const band = (r0, r1, x0, x1, m) => lathe([new THREE.Vector2(r0, x0), new THREE.Vector2(r1, x0), new THREE.Vector2(r1, x1), new THREE.Vector2(r0, x1), new THREE.Vector2(r0, x0)], m);
  grp.userData.set = (pr, hot) => {
    const ri = pr.ri || (() => 0), po = sample(pr.ro, pr.B, pr.L), pi = sample(ri, pr.B, pr.L);
    const key = [pr.L.toFixed(1), po.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(2)).join(";"), pi.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(2)).join(";"), pr.nitr, (pr.grDone || []).join(), (pr.preDone || []).join(), pr.thr, Math.floor((pr.holes || 0) * 16), pr.mask, hot ? 1 : 0].join("|");
    if (key === sig) return; sig = key;
    inner.children.slice().forEach((c) => { inner.remove(c); if (c.geometry) c.geometry.dispose(); });
    const pts = [...po.map(([x, r]) => new THREE.Vector2(Math.max(r, 0.01), x)), ...pi.slice().reverse().map(([x, r]) => new THREE.Vector2(Math.max(r, 0.01), x))]; pts.push(pts[0].clone());
    inner.add(lathe(pts, hot ? M.hot : pr.nitr ? M.nit : M.steel));
    if (cut) { const sh = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y))), sg = new THREE.ShapeGeometry(sh);
      [phiS, phiS + phiL].forEach((ph) => { const c = new THREE.Mesh(sg, M.cutF); c.rotation.y = ph - Math.PI / 2; inner.add(c); }); }
    const seg = (k) => G.segs.find((q) => q.k === k);
    (pr.preDone || []).forEach((k) => { if ((pr.grDone || []).includes(k)) return; const s = seg(k), r = pr.ro(s.x0 + s.L / 2); inner.add(band(r - 0.4, r + 0.15, s.x0 + 0.3, s.x1 - 0.3, M.preg)); });
    (pr.grDone || []).forEach((k) => { const s = seg(k), r = pr.ro(s.x0 + s.L / 2); inner.add(band(r - 0.4, r + 0.15, s.x0 + 0.3, s.x1 - 0.3, M.ground)); });
    if (pr.mask) G.segs.filter((q) => q.thread || q.k === "b1" || q.k === "b2").forEach((s) => inner.add(band(s.d / 2 - 0.3, s.d / 2 + 0.6, s.x0 + 0.2, s.x1 - 0.2, M.mask)));
    if (pr.thr) G.segs.filter((q) => q.thread).forEach((s) => { for (let x = s.x0 + 0.5; x < s.x1 - 1.5; x += 1.5) inner.add(lathe([new THREE.Vector2(s.d / 2 - 0.9, x), new THREE.Vector2(s.d / 2 + 0.15, x + 0.75), new THREE.Vector2(s.d / 2 - 0.9, x + 1.5)], pr.thr === 2 ? M.ground : M.steel)); });
    const nH = Math.floor((pr.holes || 0) * 16);
    [seg("b1"), seg("b2")].forEach((s, j) => { for (let i = 0; i < 8 && i + j * 8 < nH; i++) { const ph = (i + 0.5) * TAU / 8; if (cut && ph > phiL) continue; const r = s.d / 2 - 1.5, o = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), M.black); o.position.set(r * Math.sin(ph), s.x0 + s.L / 2, r * Math.cos(ph)); inner.add(o); } });
  };
  return grp;
}

/* ------------------------------------------------------------------ machine parts */
const bedUnder = (x0, x1, y, z = -40, w = 300) => box(x1 - x0, 50, w, M.body, (x0 + x1) / 2, y, z);
function chuckAt(x, r, dir = 1) { const g = new THREE.Group(); g.add(cylX(r + 45, 90, M.dark, x + dir * 60, 0, 0, 48)); for (let i = 0; i < 3; i++) { const a = i * TAU / 3, j = box(40, 24, 24, M.dark, x + dir * 5, (r + 12) * Math.cos(a), (r + 12) * Math.sin(a)); j.rotation.x = a; g.add(j); } g.add(box(220, 300, 300, M.body, x + dir * 205, -20, -20)); return g; }
function centreAt(x, dir = 1, lab = true) { const g = new THREE.Group(), c = cone(14, 34, M.dark); c.rotation.z = dir > 0 ? -Math.PI / 2 : Math.PI / 2; c.position.x = x - dir * 17; g.add(c); g.add(cylX(28, 160, M.body, x - dir * 110)); if (lab) g.add(box(180, 220, 240, M.body, x - dir * 270, -40, -20)); return g; }
function steadyAt(x, r) { const g = new THREE.Group(), t = new THREE.Mesh(new THREE.TorusGeometry(r + 40, 14, 10, 48, Math.PI * 1.3), M.jig || M.dark); t.rotation.y = Math.PI / 2; t.rotation.x = -Math.PI * 0.15; t.position.x = x; g.add(t);
  [Math.PI / 2, -Math.PI / 6, Math.PI * 7 / 6].forEach((a) => { const rr = cylX(8, 18, M.black, x, (r + 8) * Math.sin(a), (r + 8) * Math.cos(a), 16); g.add(rr); }); g.add(box(40, 120, 200, M.body, x, -r - 100, -40)); return g; }
const toolPost = () => { const g = new THREE.Group(); g.add(box(14, 30, 14, M.carbide, 0, 15, 0), box(30, 30, 160, M.dark, 0, 45, 0)); return g; };

/* ------------------------------------------------------------------ scenes */
function build(st) {
  const G = st.G, P = st.P, k = st.k, root = new THREE.Group(), L = G.L, cut = !!st.cut;
  let upd = () => {};
  const part = shaftObj(G, cut); root.add(part); root.userData.focus = part;
  const rB = G.rB, spin = (t, s = 3) => { if (!cut) part.rotation.x = t * s; };
  let cs = st; const pr = () => cs.prof;
  if (k === "saw") {
    part.userData.set(pr()); const rest = cylX(rB, 500, M.steel, G.Lsaw + 255, 0, 0, 48); root.add(rest);
    const blade = box(4, 320, 200, M.dark, G.Lsaw + 2, 0, 0); root.add(blade, box(70, 30, 180, M.dark, G.Lsaw + 50, -rB - 18, 0), box(70, 30, 180, M.dark, G.Lsaw + 50, rB + 18, 0), box(G.Lsaw + 700, 40, 300, M.body, G.Lsaw / 2 + 250, -rB - 60, 0));
    upd = (u) => { const p = clamp((u - 0.12) / 0.68, 0, 1); blade.position.y = rB + 170 - p * (2 * rB + 30); part.position.x = u > 0.84 ? -(u - 0.84) / 0.16 * 40 : 0; };
  } else if (k === "face" || k === "rough" || k === "semi" || k === "mill" || k === "thread") {
    root.add(bedUnder(-500, L + 400, -rB - 140));
    const ch = chuckAt(L - 40, k === "face" || k === "rough" ? rB : 30); root.add(ch);
    if (k === "rough") root.add(centreAt(0, 1));
    if (k === "semi" || k === "thread") root.add(steadyAt(G.segs[1].x0 + 40, G.M.dF / 2 + P.aS / 2));
    const tool = toolPost(); root.add(tool);
    let bar = null, mill = null, nut = null, dial = null;
    if (k === "semi") { bar = cylX(9, 260, M.dark, -130, 0, 0); const ins = box(8, 8, 8, M.carbide, 0, 9, 0); bar.add(ins); ins.position.set(0, 9, 0); root.add(bar); }
    if (k === "mill") { mill = new THREE.Group(); mill.add(box(90, 200, 90, M.dark, 0, 160, 0), cyl(5, 60, M.carbide, 0, 30, 0, 16)); root.add(mill); tool.visible = false; }
    if (k === "thread") { nut = new THREE.Group(); const rr = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(G.M.dF / 2, 0), new THREE.Vector2(G.M.dF / 2 + 16, 0), new THREE.Vector2(G.M.dF / 2 + 16, 14), new THREE.Vector2(G.M.dF / 2, 14), new THREE.Vector2(G.M.dF / 2, 0)], 48), M.dark); rr.rotation.z = -Math.PI / 2; nut.add(rr); nut.position.x = G.segs[2].x0 + 2; root.add(nut);
      dial = new THREE.Group(); dial.add(cyl(18, 10, M.body, 0, 0, 0), box(3, 50, 3, M.black, 0, -30, 0)); dial.rotation.z = Math.PI / 2; dial.position.set(G.segs[2].x0 - 26, G.M.dF / 2 + 10, 0); root.add(dial); }
    upd = (u, t) => {
      const p = pr(); part.userData.set(p);
      if (k === "face") { ch.position.x = p.L - L; tool.position.set(u < 0.6 ? -8 : -60 + clamp((u - 0.62) / 0.3, 0, 1) * 50, u < 0.6 ? rB + 10 - (u % 0.3) / 0.3 * (rB + 10) : 0, 0); tool.rotation.z = u < 0.6 ? 0 : Math.PI / 2; spin(t, 4); }
      else if (k === "rough") { if (u < 1) tool.position.set(p.xt, p.ro(p.xt + 0.01), 0); tool.visible = u < 1; spin(t, 4); }
      else if (k === "semi") { tool.visible = u < 0.5 || u >= 0.8; bar.visible = u >= 0.5 && u < 0.8;
        if (u < 0.5) tool.position.set(p.xt, p.ro(p.xt + 0.01), 0); else if (u < 0.8) bar.position.x = p.xt - 130; else { const th = u < 0.9 ? G.segs[2] : G.segs[7]; tool.position.set(th.x0 + (u * 10 % 1) * th.L, th.d / 2, 0); } spin(t, 4); }
      else if (k === "mill") { const ph = u < 0.3 ? 0 : u < 0.75 ? 1 : 2, s = ph === 1 ? (u < 0.52 ? G.segs[3] : G.segs[5]) : null, x = ph === 0 ? -20 : ph === 1 ? s.x0 + s.L / 2 : L - 30;
        mill.position.set(x, (ph === 0 ? 0 : p.ro(x)) + 2 + Math.abs(Math.sin(u * 30)) * 6, 0); if (ph === 0) { mill.rotation.z = Math.PI / 2; mill.position.set(-2, 40, 0); } else mill.rotation.z = 0;
        if (!cut) part.rotation.x = ph === 1 ? Math.floor((u - 0.3) / 0.45 * 16) * TAU / 8 : 0; }
      else if (k === "thread") { tool.visible = u < 0.6; nut.visible = dial.visible = u >= 0.6; if (u < 0.6) { const th = u < 0.3 ? G.segs[2] : G.segs[7]; tool.position.set(th.x0 + (u * 10 % 1) * th.L, th.d / 2, 0); } spin(t, u < 0.6 ? 4 : 1); if (u >= 0.6 && !cut) nut.rotation.x = part.rotation.x; }
    };
  } else if (k === "gun") {
    root.add(box(L + 1800, 60, 360, M.body, L / 2 - 600, -rB - 160, 0));
    root.add(chuckAt(L - 30, rB));
    root.add(box(40, 160, 160, M.dark, -24, 0, 0), box(60, 90, 220, M.body, -24, -110, 0));
    const dl = L + 60, drill = new THREE.Group(); drill.add(cylX(G.M.dBore / 2 - 0.3, dl, M.preg, -dl / 2, 0, 0, 24), box(110, 130, 160, M.dark, -dl - 55, 0, 0), box(260, 70, 70, M.dark, -dl - 230, 0, 0));
    const tipM = cylX(G.M.dBore / 2, 30, M.carbide, -15, 0, 0, 24); drill.add(tipM); root.add(drill);
    const whips = [0, 1].map(() => { const w = new THREE.Group(); w.add(box(30, 120, 140, M.dark, 0, 0, 0)); root.add(w); return w; });
    const pipe = cylX(6, 400, M.blue, 0, 70, 0, 12); root.add(pipe);
    upd = (u, t) => { const p = pr(); part.userData.set(p); const d = p.xt; drill.position.x = d; const carr = d - dl;
      whips.forEach((w, i) => { w.position.x = lerp(carr, -40, (i + 1) / 3); w.visible = w.position.x > carr + 60; }); pipe.position.x = carr - 300; spin(t, 3); drill.rotation.x = -t * 4; };
  } else if (k === "relief" || k === "nit") {
    const nit = k === "nit", fur = new THREE.Group(); root.add(fur);
    fur.add(cyl(380, 40, M.dark, 0, -20, 0, 48));
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(360, 360, L + 260, 48, 1, true), M.glass); wall.position.y = (L + 260) / 2; fur.add(wall);
    if (nit) { const lid = new THREE.Mesh(new THREE.SphereGeometry(360, 32, 12, 0, TAU, 0, Math.PI / 2), M.glass); lid.position.y = L + 260; fur.add(lid); fur.add(cylX(10, 300, M.blue, -500, 120, 0, 12)); }
    else fur.add(cyl(380, 40, M.dark, 0, L + 280, 0, 48));
    const shafts = [part];
    for (let i = 0; i < 2; i++) { const s = shaftObj(G, cut); root.add(s); shafts.push(s); }
    shafts.forEach((s, i) => { s.rotation.z = -Math.PI / 2; s.position.set((i - 1) * 180, L + 200, 0); });
    fur.add(box(500, 12, 40, M.dark, 0, L + 215, 0));
    root.userData.focus = null;
    const vb = new THREE.Group(); vb.add(box(60, 60, 120, M.dark, G.segs[1].x0 + 40, -rB - 30, 0), box(60, 60, 120, M.dark, G.segs[6].x0 + 20, -rB - 30, 0)); vb.visible = false; root.add(vb);
    upd = (u) => { const p = pr(); let T;
      if (nit) { const tTot = G.tN + 12, tu = clamp(u / 0.6, 0, 1) * tTot; T = tu < 5 ? 20 + tu / 5 * (P.Tn - 20) : tu < 5 + G.tN ? P.Tn : Math.max(40, P.Tn - (tu - 5 - G.tN) / 7 * (P.Tn - 40)); }
      else { const tu = clamp(u / 0.7, 0, 1) * 12; T = tu < 4 ? 20 + tu / 4 * 560 : tu < 6 ? 580 : tu < 10 ? 580 - (tu - 6) / 4 * 280 : 300 - (tu - 10) / 2 * 260; }
      const glow = clamp((T - 350) / 230, 0, 1); M.hot.emissive.setRGB(0.55 * glow, 0.18 * glow, 0);
      const out = !nit && u >= 0.7;
      shafts.forEach((s, i) => { s.userData.set(p, glow > 0.05); s.visible = !out || i === 0; });
      fur.visible = !out; vb.visible = out;
      if (out) { part.rotation.z = 0; part.position.set(0, 0, 0); } else { part.rotation.z = -Math.PI / 2; part.position.set(-180, L + 200, 0); } };
  } else if (k === "pre" || k === "grind") {
    root.add(bedUnder(-400, L + 400, -rB - 140, -60, 420), centreAt(0, 1), centreAt(L, -1));
    const whR = 200, wheel = new THREE.Group(); const wd = cylX(whR, P.bW, M.abrasive, 0, 0, 0, 64); wheel.add(wd, box(P.bW + 120, 260, 260, M.body, 0, 0, -whR - 140)); root.add(wheel);
    const gauge = new THREE.Group(); gauge.add(box(16, 60, 16, M.dark, 0, 50, 0), box(16, 60, 16, M.dark, 0, -50, 0), box(16, 16, 120, M.blue, 0, 80, -60)); root.add(gauge);
    const drive = new THREE.Group(); drive.add(box(12, 90, 30, M.dark, L - 25, 30, 0)); root.add(drive);
    upd = (u, t) => { const p = pr(); part.userData.set(p); spin(t, 2); const c = p.cur;
      wheel.visible = !!c; gauge.visible = !!c && c.k !== "nose";
      if (c) { const r = p.ro(c.x0 + c.L / 2), osc = Math.sin(u * 40) * Math.max(0, c.L / 2 - P.bW / 2);
        if (c.k === "nose") { wheel.position.set(-whR * 0.42 - 10, 0, -whR * 0.82 - 4); wheel.rotation.y = -0.45; } else { wheel.position.set(c.x0 + c.L / 2 + osc, 0, -(r + whR) + 0.5); wheel.rotation.y = 0; }
        wd.rotation.x = t * 12; gauge.position.set(c.x0 + c.L / 2, 0, 0); } };
  } else if (k === "taper") {
    root.add(bedUnder(-700, L + 400, -rB - 140, -40, 360), chuckAt(L - 40, 30), steadyAt(G.segs[1].x0 + 40, G.M.dF / 2));
    const q = new THREE.Group(), wR = P.dIw / 2 * 0.8; q.add(cylX(wR, 14, M.abrasive, 7, 0, 0, 32), cylX(7, 160, M.dark, -80, 0, 0, 16), cylX(45, 260, M.body, -290, 0, 0, 32)); q.rotation.y = G.half; root.add(q);
    const gaugeT = new THREE.Mesh(new THREE.CylinderGeometry(G.inner[0].d1 / 2 - 0.2, G.inner[0].d0 / 2 - 0.2, 32, 32), M.blue); gaugeT.rotation.z = Math.PI / 2; root.add(gaugeT);
    const gh = cylX(32, 80, M.body, -40, 0, 0); root.add(gh);
    upd = (u, t) => { const p = pr(); part.userData.set(p); spin(t, 2); const grindOn = u < 0.72; q.visible = grindOn; gaugeT.visible = gh.visible = !grindOn;
      if (grindOn) { const osc = Math.sin(u * 50) * 0.5 + 0.5; q.position.set(4 + osc * 14, 0, -(G.inner[0].d0 / 2 - P.aP / 2 - wR - 0.5)); q.children[0].rotation.x = t * 30; }
      else { const s = clamp((u - 0.72) / 0.12, 0, 1); gaugeT.position.x = lerp(-120, 16, s); gh.position.x = gaugeT.position.x - 56; } };
  } else if (k === "bal") {
    root.add(box(L + 500, 50, 360, M.body, L / 2, -rB - 160, 0));
    [G.segs[1].x0 + 45, G.segs[6].x0 + 20].forEach((x) => { const r = G.rOut(x); [-1, 1].forEach((sg) => root.add(cylX(16, 30, M.black, x, -r - 12, sg * (r * 0.5 + 8), 24))); root.add(box(60, 120, 160, M.dark, x, -r - 90, 0)); });
    const belt = box(14, 300, 6, M.black, G.segs[4].x0 + 80, G.M.dRot / 2 + 150, 0); root.add(belt, box(160, 120, 160, M.dark, G.segs[4].x0 + 80, G.M.dRot / 2 + 330, 0));
    const marks = new THREE.Group(); [G.segs[3], G.segs[5]].forEach((s) => { const t = new THREE.Mesh(new THREE.TorusGeometry(s.d / 2 + 4, 1.4, 6, 48), M.red); t.rotation.y = Math.PI / 2; t.position.x = s.x0 + s.L / 2; marks.add(t); }); root.add(marks);
    const screws = new THREE.Group(); [G.segs[3], G.segs[5]].forEach((s, j) => { const sc = cylX(3, 6, M.green, s.x0 + s.L / 2, 0, 0, 10); const a = (st.R.O.bal.U0[j].a + 180) * Math.PI / 180; sc.position.set(s.x0 + s.L / 2, (s.d / 2) * Math.sin(a), (s.d / 2) * Math.cos(a)); screws.add(sc); }); part.add(screws);
    upd = (u, t) => { part.userData.set(pr()); spin(t, 6); screws.visible = u > 0.6; };
  } else if (k === "insp") {
    const tester = new THREE.Group(); root.add(tester);
    tester.add(box(700, 120, 600, M.granite, 0, -60, 0), cyl(130, 30, M.dark, 0, 15, 0, 48), box(60, L + 300, 60, M.dark, 260, (L + 300) / 2, -150));
    const arm = new THREE.Group(); arm.add(box(200, 20, 20, M.dark, 100, 0, 0), new THREE.Mesh(new THREE.SphereGeometry(3, 12, 12), M.red)); arm.position.set(G.M.dR / 2 + 2, 0, 0); tester.add(arm);
    const vb = new THREE.Group(); vb.add(box(60, 60, 120, M.dark, G.segs[1].x0 + 40, -rB - 20, 0), box(60, 60, 120, M.dark, G.segs[6].x0 + 20, -rB - 20, 0), box(L + 800, 40, 300, M.granite, L / 2 - 200, -rB - 70, 0));
    const mand = cylX(18, 300, M.ground, -150, 0, 0, 32); vb.add(mand);
    [[-8, 0], [-290, 1]].forEach(([x]) => vb.add(cyl(14, 8, M.body, x, 50, 0), box(3, 30, 3, M.black, x, 28, 0))); root.add(vb);
    const laser = box(120, 120, 120, M.dark, G.segs[3].x0 + 20, 200, 0), bag = box(L + 120, 200, 200, M.vci, L / 2, 0, 0); root.add(laser, bag);
    upd = (u, t) => { part.userData.set(pr()); const ph = u < 0.45 ? 0 : u < 0.8 ? 1 : 2; tester.visible = ph === 0; vb.visible = ph === 1; laser.visible = ph === 2; bag.visible = u > 0.9;
      if (ph === 0) { part.rotation.set(0, t * 0.8, Math.PI / 2); part.position.set(0, 30, 0); arm.position.y = 30 + G.segs[6].x0 + 20; arm.rotation.y = 0; }
      else { part.rotation.set(cut ? 0 : t * 2, 0, 0); part.position.set(0, 0, 0); } };
  }
  return { root, upd: (u, t, s) => { if (s) cs = s; upd(u, t); } };
}

/* ------------------------------------------------------------------ the view */
export function create(el, getState, kind = "shaft") {
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0); el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1); if (window.dtTheme) window.dtTheme.scene(scene, "#e9edf1", "#1c2126");
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 2, 40000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(800, 1500, 1000); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement); const nice = niceControls(controls, camera, scene, { minDist: 30, maxDist: 20000 });
  const lbl = document.createElement("div"); lbl.className = "mf3d-lbl"; el.appendChild(lbl);
  const fitBtn = document.createElement("button"); fitBtn.className = "btn ghost mf3d-fit"; fitBtn.textContent = "Fit view"; el.appendChild(fitBtn);
  const cutBtn = document.createElement("button"); cutBtn.className = "btn ghost mf3d-fit"; cutBtn.style.right = "96px"; el.appendChild(cutBtn);
  let cur = null, key = "", t0 = performance.now();
  const fit = () => { if (!cur) return; const fo = cur.root.userData.focus, b = new THREE.Box3().setFromObject(fo || cur.root), fk = fo ? 1.15 : 0.9, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    if (nice && nice.stop) nice.stop(); controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0.45, 0.42, 0.79).normalize().multiplyScalar(s * fk)); camera.near = s / 200; camera.far = s * 60; camera.updateProjectionMatrix(); controls.update(); };
  fitBtn.addEventListener("click", fit);
  cutBtn.addEventListener("click", () => { const st = getState(); if (st && st.setCut) st.setCut(!st.cut); });
  const rebuild = (st) => { if (cur) { scene.remove(cur.root); cur.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    cur = build(st); scene.add(cur.root); cur.upd(st.u, 0, st); fit(); };
  const loop = () => {
    requestAnimationFrame(loop);
    if (!el.offsetParent) return;
    const st = getState(); if (!st) return;
    const w = el.clientWidth, h = el.clientHeight; if (w && h && (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const k = `${kind}|${st.k}|${st.cut}|${st.R && st.R.seed}|${JSON.stringify(st.F)}|${st.G && st.G.L}|${st.P && st.P.bW}`;
    if (k !== key) { key = k; rebuild(st); }
    const t = (performance.now() - t0) / 1000;
    cur.upd(st.u, t, st);
    cutBtn.textContent = st.cut ? "Close cut" : "Cut ¼ open";
    lbl.textContent = `Op ${st.no} · ${st.n}  —  progress ${Math.round(st.u * 100)} %${st.cut ? "  ·  cut view (bore + taper visible)" : ""}`;
    controls.update(); renderer.render(scene, camera);
  };
  loop();
  if (new URLSearchParams(location.search).has("shot3d")) setInterval(() => { let im = document.getElementById("shot3dimg"); if (!im) { im = document.createElement("img"); im.id = "shot3dimg"; im.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none"; el.appendChild(im); } im.src = renderer.domElement.toDataURL(); }, 800);
  return { fit };
}
