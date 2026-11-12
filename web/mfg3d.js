/* 3D twins for HMC build item 2 (worm manufacturing), item 3 (worm wheel manufacturing) and the Assembly tab (rotary table).
   One shared Three.js view that follows the 2D twin: same operation / step and progress u (read every frame from getState()).
   The worm thread and the wheel teeth are generated from the SAME equations as the 2D twins (thrR, throat radius, depth),
   so the 3D shape changes with the process (roughing depth, stock, hobbing depth).  Machines and jigs are simplified.
   Offline: local three.js + view3d.js niceControls. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";
import { wormGeom, wormData, thrR, segAt, htCycle, thrStateAt, AL } from "./wormmfg.js";
import { HMC_PARTS } from "./hmc.js";

const TAU = Math.PI * 2, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), ease = (u) => u * u * (3 - 2 * u), lerp = (a, b, t) => a + (b - a) * t;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? 0.35, roughness: o.r ?? 0.5, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, transparent: !!o.op, opacity: o.op ?? 1, emissive: o.em || 0x000000 });
const M = {
  steel: mat(0xaab4bd, { m: 0.6, r: 0.35 }), hard: mat(0x7f8c9c, { m: 0.6, r: 0.3 }), ground: mat(0xdfe6ec, { m: 0.8, r: 0.18 }), bronze: mat(0xc08a4a, { m: 0.55, r: 0.35, ds: true }),
  cast: mat(0x9aa4ae, { m: 0.3, r: 0.6, ds: true }), carbide: mat(0xe0a030, { m: 0.4, r: 0.4 }), abrasive: mat(0xc9b48f, { m: 0.05, r: 0.9 }), jig: mat(0x3a6ea8, { m: 0.3, r: 0.5 }),
  body: mat(0xd5dbe1, { m: 0.2, r: 0.7 }), dark: mat(0x5c6670, { m: 0.3, r: 0.6 }), red: mat(0xd03b3b), green: mat(0x2f9e5f), oil: mat(0xd9c27a, { op: 0.45, r: 0.2 }), glass: mat(0x9fc6e6, { op: 0.35, r: 0.1 }),
  hot: mat(0xe8742a, { em: 0x7a2a00 }), water: mat(0x6fa8d6, { op: 0.4 }), floor: mat(0xc9ced3, { m: 0, r: 1 }),
};
const P = Object.fromEntries(Object.entries(HMC_PARTS || {}).map(([k, v]) => [k, v.col]));

/* ------------------------------------------------------------------ generic surfaces */
function grid(nu, nv) {   // (nu+1)·(nv+1) vertices, closed or open grid; positions written by setGrid
  const g = new THREE.BufferGeometry(), pos = new Float32Array((nu + 1) * (nv + 1) * 3), idx = [];
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.userData = { nu, nv }; return g;
}
function setGrid(g, fn) {
  const { nu, nv } = g.userData, p = g.attributes.position.array; let n = 0;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const v = fn(i / nu, j / nv); p[n++] = v[0]; p[n++] = v[1]; p[n++] = v[2]; }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
}
/* worm along +X from x = 0 to L, radius r(x, θ) */
function wormMesh(g, material) {
  const nu = Math.ceil(g.L / 0.8), nv = 64, geo = grid(nu, nv), mesh = new THREE.Mesh(geo, material);
  const capA = new THREE.Mesh(new THREE.CircleGeometry(1, 32), material), capB = capA.clone(); capA.rotation.y = -Math.PI / 2; capB.rotation.y = Math.PI / 2; capB.position.x = g.L;
  const grp = new THREE.Group(); grp.add(mesh, capA, capB);
  grp.userData.set = (rf) => { setGrid(geo, (a, b) => { const x = a * g.L, th = b * TAU, r = rf(x, th); return [x, r * Math.cos(th), r * Math.sin(th)]; }); const r0 = rf(0, 0), r1 = rf(g.L, 0); capA.scale.setScalar(r0); capB.scale.setScalar(r1); };
  return grp;
}
function wormR(g, o = {}) {   // o: { thread, q(x), sl, sr, ra, ph, final, base(x), seg{} }
  return (x, th) => {
    const s = segAt(g, x);
    if (s.k === "th" && o.thread) {
      const q = o.q ? o.q(x) : 1, ra = o.ra ?? (o.final ? g.da / 2 : s.dr / 2);
      if (q <= 0) return ra;
      return thrR(g, x - s.x0, (o.ph || 0) + g.lead * th / TAU, o.sl || 0, o.sr || 0, q, ra);
    }
    if (o.base) return o.base(x);
    if (o.seg && o.seg[s.k] != null) return o.seg[s.k];
    return o.final ? s.d / 2 : s.dr / 2;
  };
}
/* worm wheel around +Y, centred at y = 0: teeth from the throat geometry; q = tooth depth fraction */
function wheelG(W) {
  const m = W.m, d2 = m * W.z2, da2 = d2 + 2 * m, a = (W.d1 + d2) / 2;
  return { m, z2: W.z2, d2, da2, df2: d2 - 2.4 * m, de2: da2 + 1.5 * m, a, rk: a - da2 / 2, b2: (window.HMCROT && window.HMCROT.M.b2) || 36, gam: Math.atan(W.z1 * m / W.d1), h: 2.2 * m };
}
function wheelMesh(G, material) {
  const nu = G.z2 * 10, nv = 14, geo = grid(nu, nv), mesh = new THREE.Mesh(geo, material);
  const Rt = (w) => Math.min(G.de2 / 2, G.da2 / 2 + (G.rk - Math.sqrt(Math.max(0, G.rk * G.rk - w * w))));
  mesh.userData.set = (q, rot = 0) => setGrid(geo, (a, b) => {
    const w = (b - 0.5) * G.b2, ph = a * TAU, rt = Rt(w), rf = rt - G.h;
    let t = ((ph - w * Math.tan(G.gam) / (G.d2 / 2)) * G.z2 / TAU + rot) % 1; if (t < 0) t += 1;
    const s = clamp((0.27 - Math.abs(t - 0.5)) / 0.07, 0, 1), r = rt - q * (rt - rf) * (1 - s);
    return [r * Math.cos(ph), w, r * Math.sin(ph)];
  });
  mesh.userData.set(1);
  return mesh;
}
function ring(rIn, rOut, h, material, y = 0, seg = 64, phiStart = 0, phiLen = TAU) {   // axisymmetric rectangle section around Y
  const pts = [new THREE.Vector2(rIn, -h / 2), new THREE.Vector2(rOut, -h / 2), new THREE.Vector2(rOut, h / 2), new THREE.Vector2(rIn, h / 2), new THREE.Vector2(rIn, -h / 2)];
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, seg, phiStart, phiLen), material); m.position.y = y; return m;
}
const box = (w, h, d, material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); m.position.set(x, y, z); return m; };
const cyl = (r, h, material, x = 0, y = 0, z = 0, seg = 32) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material); m.position.set(x, y, z); return m; };

/* ------------------------------------------------------------------ machine primitives */
function latheBed(L, cy) {   // bed + headstock + tailstock + 2 centres along X (part from 0..L at height cy)
  const g = new THREE.Group();
  g.add(box(L + 700, 60, 260, M.body, L / 2, cy - 230, -40), box(240, 260, 260, M.body, -200, cy - 70, -40), box(160, 180, 200, M.body, L + 160, cy - 100, -40));
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(14, 30, 24), M.dark); c1.rotation.z = -Math.PI / 2; c1.position.set(-15, cy, 0);
  const c2 = c1.clone(); c2.rotation.z = Math.PI / 2; c2.position.set(L + 15, cy, 0); g.add(c1, c2);
  const dog = cyl(30, 18, M.dark, 12, cy, 0); dog.rotation.z = Math.PI / 2; g.add(dog);
  return g;
}

/* ------------------------------------------------------------------ WORM scenes */
function buildWorm(st) {
  const g = st.g, P = st.P, k = st.k, root = new THREE.Group(), cy = 0, L = g.L, R = st.R;
  let upd = () => {};
  const worm = (material) => { const w = wormMesh(g, material); w.position.y = cy; root.add(w); root.userData.focus = w; return w; };
  if (k === "saw") {
    const bar = cyl(g.Db / 2, 900, M.steel, 450, cy, 0, 48); bar.rotation.z = Math.PI / 2; root.add(bar); root.userData.focus = bar;
    const blade = box(4, 260, 160, M.dark, g.Lsaw, cy + 200, 0); root.add(blade, box(80, 30, 140, M.dark, g.Lsaw + 60, cy - g.Db / 2 - 20, 0));
    upd = (u) => { const p = clamp((u - 0.12) / 0.68, 0, 1); blade.position.y = cy + g.Db / 2 + 130 - p * (g.Db + 20); bar.position.x = 450 - (u > 0.84 ? ease((u - 0.84) / 0.16) * 40 : 0); };
  } else if (k === "face") {
    const part = cyl(g.Db / 2, g.Lsaw, M.steel, g.Lsaw / 2, cy, 0, 48); part.rotation.z = Math.PI / 2; root.add(part); root.userData.focus = part;
    const chuck = cyl(110, 90, M.dark, g.Lsaw + 60, cy, 0); chuck.rotation.z = Math.PI / 2; root.add(chuck);
    const tool = box(16, 60, 16, M.carbide, -10, cy + 60, 0); root.add(tool);
    upd = (u) => { const v = u < 0.5 ? u / 0.5 : (u - 0.5) / 0.5; tool.position.y = cy + g.Db / 2 + 20 - clamp(v / 0.45, 0, 1) * (g.Db / 2 + 20); chuck.position.x = u < 0.5 ? g.Lsaw + 60 : -60; tool.position.x = u < 0.5 ? -10 : g.Lsaw + 10; };
  } else if (k === "turn" || k === "thread" || k === "cyl" || k === "tg" || k === "prep" || k === "fin") {
    root.add(latheBed(L, cy));
    const material = k === "turn" || k === "thread" ? M.steel : M.hard, w = worm(material);
    const tool = new THREE.Group(); root.add(tool);
    if (k === "turn") {
      const rr = (x) => segAt(g, x).dr / 2, rmin = Math.min(...g.segs.map((q) => q.dr / 2)), ap = P.apT, Np = Math.max(1, Math.ceil((g.Db / 2 - rmin) / ap));
      tool.add(box(14, 40, 14, M.carbide, 0, 20, 0), box(30, 30, 120, M.dark, 0, 50, 0));
      upd = (u) => { const pu = clamp(u, 0, 0.9999) * Np, kk = Math.floor(pu) + 1, fr = pu - Math.floor(pu), xt = L * (1 - fr), lev = (j) => Math.max(rmin, g.Db / 2 - j * ap);
        w.userData.set(u >= 1 ? (x) => rr(x) : (x) => Math.max(rr(x), x >= xt ? lev(kk) : lev(kk - 1))); tool.position.set(xt, cy + Math.max(rr(xt), lev(kk)), 0); };
    } else if (k === "thread") {
      const th = g.th;
      if (P.thr === "whirl") { const t = new THREE.Mesh(new THREE.TorusGeometry(th.dr / 2 + 26, 9, 12, 48), M.carbide); t.rotation.y = Math.PI / 2 + g.gam * 2; tool.add(t); }
      else if (P.thr === "mill") { const d = cyl(60, 10, M.carbide, 0, th.dr / 2 + 62, 0, 48); d.rotation.x = Math.PI / 2; d.rotation.z = g.gam * 2; tool.add(d); }
      else tool.add(box(10, 30, 10, M.carbide, 0, th.dr / 2 + 15, 0), box(24, 24, 100, M.dark, 0, th.dr / 2 + 40, 0));
      let lastU = -1;
      upd = (u) => { const S = thrStateAt(g, u, P); tool.position.set(S.xt, cy, 0); if (Math.abs(u - lastU) < 0.004) return; lastU = u;
        w.userData.set(wormR(g, { thread: true, q: S.q, sl: R.s0, sr: R.s0, ph: 0 })); };
    } else if (k === "cyl") {
      const wh = cyl(160, 50, M.abrasive, 0, 0, 0, 64); wh.rotation.x = Math.PI / 2; tool.add(wh);
      const list = g.segs.filter((q) => q.gr); w.userData.set(wormR(g, { thread: true, sl: R.s0, sr: R.s0, final: false }));
      upd = (u, t) => { const n = list.length, i = Math.min(n - 1, Math.floor(u * n)), cur = list[i]; tool.position.set(cur.x0 + cur.L / 2 + (cur.k === "th" ? Math.sin(t * 2) * (cur.L / 2 - 20) : 0), cy + cur.dr / 2 + 160, 0); w.rotation.x = t * 3; };
    } else if (k === "tg") {
      const wh = cyl(175, 12, M.abrasive, 0, 0, 0, 72); wh.rotation.x = Math.PI / 2; const holder = new THREE.Group(); holder.add(wh); holder.rotation.y = -g.gam; tool.add(holder);
      upd = (u, t) => { const n = R.O.tg.passes.length, pi = Math.min(n - 1, Math.floor(u * n)), v = (u * n) % 1, dir = pi % 2 === 0;
        tool.position.set(g.th.x0 + (dir ? v : 1 - v) * g.th.L, cy + g.da / 2 + 175 - 4, 0); w.userData.set(wormR(g, { thread: true, final: true, ph: (t * 20) % g.px })); };
    } else if (k === "prep") {
      w.userData.set(wormR(g, { thread: true, sl: R.s0, sr: R.s0 })); const pts = new THREE.Group(); root.add(pts);
      for (let i = 0; i < 60; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2, 6, 6), M.dark); pts.add(s); }
      upd = (u, t) => pts.children.forEach((s, i) => { const a = (i * 0.37 + t) % 1; s.position.set((i / 60) * L, cy + 140 - a * 110, (i % 7 - 3) * 8); s.visible = u < 0.35; });
    } else {
      w.userData.set(wormR(g, { thread: true, final: true })); root.remove(root.children[0]);
      root.add(box(L + 600, 20, 200, M.dark, L / 2, cy - g.Db / 2 - 20, 0));
      upd = (u) => { w.position.x = -200 + u * 400; };
    }
    if (k !== "turn" && k !== "thread" && k !== "tg" && k !== "cyl" && k !== "prep" && k !== "fin") w.userData.set(wormR(g, { thread: true, final: true }));
  } else if (k === "ht") {
    const fur = box(600, 700, 600, M.glass, 0, 350, 0); root.add(fur, box(640, 20, 640, M.dark, 0, 0, 0)); const tank = box(600, 300, 600, M.oil, 900, 150, 0); root.add(tank);
    const ws = new THREE.Group(); root.add(ws);
    for (let i = 0; i < 4; i++) { const w = wormMesh(g, M.steel); w.userData.set(wormR(g, { thread: true, sl: R.s0, sr: R.s0 })); w.rotation.z = Math.PI / 2; w.position.set(-180 + i * 120, 120, 0); ws.add(w); }
    const cycle = htCycle(R.O.ht.tc), tEnd = cycle[cycle.length - 1][0];
    upd = (u) => { const tu = clamp(u / 0.8, 0, 1) * tEnd; let T = 20, seg = 0; for (let i = 1; i < cycle.length; i++) if (tu <= cycle[i][0] || i === cycle.length - 1) { const a = cycle[i - 1], b = cycle[i]; T = lerp(a[1], b[1], clamp((tu - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1)); seg = i; break; }
      const glow = clamp((T - 400) / 525, 0, 1); ws.children.forEach((w) => { w.children.forEach((m) => { m.material = glow > 0.05 && seg < 6 ? M.hot : seg >= 6 ? M.hard : M.steel; }); });
      M.hot.emissive.setRGB(0.6 * glow, 0.2 * glow, 0); ws.position.x = seg === 5 || seg === 6 ? 900 : 0; ws.position.y = seg === 5 || seg === 6 ? -60 : 0; };
  } else if (k === "etch") {
    for (let i = 0; i < 5; i++) root.add(box(220, 200, 300, i === 1 ? M.oil : M.water, i * 280, 100, 0));
    const w = wormMesh(g, M.hard); w.userData.set(wormR(g, { thread: true, final: true })); root.add(w);
    upd = (u) => { const ti = Math.min(4, Math.floor(clamp(u / 0.7, 0, 0.9999) * 5)), tv = (clamp(u / 0.7, 0, 0.9999) * 5) % 1; w.position.set(ti * 280 - L / 2, u < 0.7 ? 320 - Math.sin(tv * Math.PI) * 220 : 320, 0); };
  } else if (k === "gmm") {
    root.add(box(700, 40, 500, M.body, 0, -20, 0), box(80, 800, 80, M.body, -280, 400, 0));
    const w = wormMesh(g, M.hard); w.userData.set(wormR(g, { thread: true, final: true })); w.rotation.z = Math.PI / 2; w.position.set(0, 20, 0); root.add(w); root.userData.focus = w;
    const probe = new THREE.Group(); probe.add(box(260, 14, 14, M.dark, -130, 0, 0), new THREE.Mesh(new THREE.SphereGeometry(4, 16, 16), M.red)); root.add(probe);
    upd = (u, t) => { const z = g.th.x0 + g.m + (u < 0.44 ? (u % 0.22) / 0.22 * g.Lb : g.b1 / 2); probe.position.set(-(g.d1 / 2 + 4), 20 + z, 0); probe.rotation.y = Math.PI; w.rotation.y = u < 0.44 ? z / g.lead * TAU : t; };
  } else if (k === "bench") {
    const w = wormMesh(g, M.hard); w.userData.set(wormR(g, { thread: true, final: true })); root.add(w);
    const G = wheelG(wormData()), wh = wheelMesh(G, M.bronze); wh.rotation.x = Math.PI / 2; wh.position.set(g.th.x0 + g.th.L / 2, G.a, 0); root.add(wh);
    root.add(box(120, 120, 120, M.dark, -140, 0, 0), box(L + 500, 30, 400, M.body, L / 2, -120, 0));
    upd = (u, t) => { w.rotation.x = t * 4; wh.rotation.y = -t * 4 / G.z2 * 1; };
  }
  return { root, upd };
}

/* ------------------------------------------------------------------ WHEEL scenes */
function buildWheel(st) {
  const G = st.G, k = st.k, root = new THREE.Group(); let upd = () => {};
  const hub = (bore = G.dB, dj = G.dj) => ring(bore / 2, dj / 2, G.bh, M.steel);
  const rimBlank = (rIn = G.dj / 2, rOut = G.de2 / 2) => ring(rIn, rOut, G.b2, M.bronze);
  if (k === "hub") {
    const h = hub(); root.add(h, cyl(200, 80, M.dark, 0, -G.bh / 2 - 50, 0)); const tool = box(16, 16, 40, M.carbide, G.dj / 2 + 8, G.bh / 2, 0); root.add(tool);
    upd = (u, t) => { h.rotation.y = t * 5; tool.position.y = G.bh / 2 - (u % 0.3) / 0.3 * G.bh; };
  } else if (k === "cast") {
    const mould = ring(G.de2 / 2 + 6, G.de2 / 2 + 40, G.b2 + 30, M.dark); mould.rotation.x = Math.PI / 2; root.add(mould);
    const melt = ring(G.de2 / 2 - 2, G.de2 / 2 + 6, G.b2 + 8, M.hot); melt.rotation.x = Math.PI / 2; root.add(melt);
    upd = (u, t) => { mould.rotation.y = t * 8; const th = 2 + clamp(u / 0.55, 0, 1) * (G.de2 / 2 + 6 - G.dj / 2 + 8 - 2); melt.scale.set(1, 1, 1); melt.geometry.dispose(); melt.geometry = ring(G.de2 / 2 + 6 - th, G.de2 / 2 + 6, G.b2 + 8, M.hot).geometry; melt.material = u > 0.55 ? M.bronze : M.hot; };
  } else if (k === "rimturn" || k === "shrink") {
    const h = hub(); root.add(h); const r = rimBlank(G.dj / 2 - 0.1, G.de2 / 2 + 3); root.add(r);
    if (k === "shrink") root.add(ring(G.de2 / 2 + 10, G.de2 / 2 + 40, 50, M.dark, 300));
    upd = (u) => { if (k === "rimturn") { r.position.y = 260; r.rotation.y = u * 6; h.rotation.y = u * 6; } else { const slide = clamp((u - 0.42) / 0.18, 0, 1); r.position.y = lerp(300, 0, ease(slide)); r.material = u < 0.75 && u > 0.1 ? M.hot : M.bronze; M.hot.emissive.setRGB(0.25, 0.08, 0); } };
  } else if (k === "finish" || k === "drill") {
    root.add(hub(), ring(G.dj / 2, G.de2 / 2, G.b2, M.bronze), cyl(320, 40, M.dark, 0, -G.bh / 2 - 30, 0, 64));
    if (k === "drill") { const sp = cyl(5, 200, M.carbide, 0, 0, 0); root.add(sp); const holes = new THREE.Group(); root.add(holes);
      upd = (u) => { const n = Math.floor(u * 14.5), pr = st.P.pcd / 2; holes.clear(); for (let i = 0; i < Math.min(n, 12); i++) { const a = i * TAU / 12; holes.add(cyl(5.5, G.bh + 2, M.dark, pr * Math.cos(a), 0, pr * Math.sin(a), 16)); } const a = Math.min(n, 11) * TAU / 12; sp.position.set(pr * Math.cos(a), G.bh / 2 + 100 - (u * 14.5 % 1) * 60, pr * Math.sin(a)); }; }
    else { const tool = box(12, 40, 12, M.carbide, 0, 0, 0); root.add(tool); upd = (u, t) => { tool.position.set(G.de2 / 2 + 6, Math.sin(u * 8) * G.b2 / 2, 0); root.children[0].rotation.y = t; }; }
  } else if (["hob", "deburr", "gmm", "roll", "pair"].includes(k)) {
    const wh = wheelMesh(G, M.bronze); root.add(hub(), ring(G.dj / 2, G.dj / 2 + (G.df2 - G.dj) / 2 + 0.5, G.b2, M.bronze), wh);
    let tool = null, lastQ = -1;
    const W = wormData(), g = wormGeom(W), wormAt = (material) => { const w = wormMesh(g, material); w.userData.set(wormR(g, { thread: true, final: true })); w.rotation.order = "YXZ"; w.rotation.y = Math.PI / 2; const grp = new THREE.Group(); w.position.z = g.th.x0 + g.th.L / 2; grp.add(w); grp.position.set(G.a, 0, 0); root.add(grp); return grp; };
    if (k === "hob" || k === "roll" || k === "pair") tool = wormAt(k === "hob" ? M.steel : M.hard);
    if (k === "hob") root.add(box(500, 40, 500, M.dark, 0, -G.bh / 2 - 40, 0));
    if (k === "deburr") { tool = new THREE.Group(); tool.add(cyl(70, 40, M.green, 0, 0, 0)); tool.position.set(G.de2 / 2 + 60, 0, 0); root.add(tool); }
    if (k === "gmm") { tool = new THREE.Group(); tool.add(box(200, 10, 10, M.dark, 100, 0, 0), new THREE.Mesh(new THREE.SphereGeometry(4, 12, 12), M.red)); tool.position.set(G.de2 / 2 + 4, 0, 0); root.add(tool); }
    upd = (u, t) => {
      const P = st.P, q = k === "hob" ? (P.meth === "rad" ? clamp(u / 0.9, 0, 1) : P.meth === "rt" ? clamp(u / 0.6, 0, 1) : clamp(u / 0.3, 0, 1)) : 1;
      const rot = k === "hob" ? u * 3 : (t * 0.2) % 1;
      if (Math.abs(q - lastQ) > 0.01 || k !== "hob") { wh.userData.set(q, rot); lastQ = q; }
      wh.rotation.y = 0;
      if (tool && (k === "hob" || k === "roll" || k === "pair")) { const tan = k === "hob" && P.meth !== "rad" ? (clamp((u - (P.meth === "rt" ? 0.6 : 0.3)) / 0.4, 0, 1) - 0.5) * P.Lt : k === "pair" ? clamp(u / 0.6, 0, 1) * 5 : 0;
        tool.position.set(G.a + (k === "hob" ? (1 - q) * G.h + (P.dhNow - W.d1) / 2 : 0), 0, tan); tool.children[0].rotation.x = t * 6; }
    };
  }
  return { root, upd };
}

/* ------------------------------------------------------------------ ASSEMBLY scene (rotary table) */
const ASM_ORDER = [["housing"], ["bearing"], ["table"], ["wheel"], ["worm"], [], [], ["clamp"], ["encoder"], ["union"], ["seal"], ["zp"], [], ["pallet"]];
function buildAsm(st) {
  const root = new THREE.Group(), cut = st.cut, phiS = cut ? Math.PI / 2 : 0, phiL = cut ? Math.PI * 1.5 : TAU;
  const R1 = st.R1 || { a: 205 }, W = wormData(), G = wheelG(W), g = wormGeom(W), parts = {};
  const colMat = {}; const pm = (key) => (colMat[key] = colMat[key] || mat(new THREE.Color(P[key] || "#999"), { m: 0.45, r: 0.45, ds: true }));
  for (const key of ["housing", "bearing", "table", "clamp", "encoder", "union", "seal", "zp", "pallet"]) {
    const grp = new THREE.Group(); (HMC_PARTS[key].rects || []).forEach(([x0, y0, x1, y1]) => grp.add(ring(x0, x1, y1 - y0, pm(key), (y0 + y1) / 2, 72, phiS, phiL))); parts[key] = grp; root.add(grp);
  }
  const wg = new THREE.Group(); const wh = wheelMesh(G, M.bronze); wh.position.y = 120; wg.add(wh); (HMC_PARTS.wheel.rects || []).slice(0, 1).forEach(([x0, y0, x1, y1]) => wg.add(ring(x0, x1, y1 - y0, M.steel, (y0 + y1) / 2, 72, phiS, phiL))); parts.wheel = wg; root.add(wg);
  const wm = wormMesh(g, M.hard); wm.userData.set(wormR(g, { thread: true, final: true })); const wo = new THREE.Group(); wm.position.x = -(g.th.x0 + g.th.L / 2); wo.add(wm); wo.rotation.y = Math.PI / 2; wo.position.set(R1.a, 120, 0); parts.worm = wo; root.add(wo);
  root.add(box(900, 20, 900, M.floor, 0, -10, 0)); if (window.dtTheme) window.dtTheme.floor(M.floor);
  const jig = new THREE.Group(); root.add(jig);
  const shown = new Set(); ASM_ORDER.slice(0, st.hs + 1).forEach((a) => a.forEach((p) => shown.add(p)));
  const newest = ASM_ORDER[st.hs] || [];
  Object.entries(parts).forEach(([kk, o]) => { o.visible = shown.has(kk) && !(st.k === "kit" || st.k === "clean"); });
  // prep steps: parts laid out on the floor
  if (st.k === "kit" || st.k === "clean") {
    const keys = ["housing", "bearing", "table", "wheel", "worm", "clamp", "encoder", "union", "zp"];
    keys.forEach((kk, i) => { const o = parts[kk]; o.visible = true; o.position.set((i % 3 - 1) * 700, kk === "worm" ? -60 : -((HMC_PARTS[kk] && HMC_PARTS[kk].rects ? Math.min(...HMC_PARTS[kk].rects.map((r) => r[1])) : 100)), (Math.floor(i / 3) - 1) * 700); });
    root.children.find((c) => c.geometry && c.geometry.type === "BoxGeometry").scale.set(3, 1, 3);
    if (st.k === "clean") jig.add(box(900, 600, 700, M.water, 0, 300, -700));
  }
  // jigs per step
  const J = (o) => { jig.add(o); return o; };
  if (st.k === "level") { J(box(800, 40, 800, M.jig, 0, -40, 0)); J(box(200, 16, 30, M.carbide, -150, 33, 0)); }
  if (st.k === "bearing") { const r = J(new THREE.Mesh(new THREE.TorusGeometry(180, 6, 8, 48), M.jig)); r.rotation.x = Math.PI / 2; r.position.y = 300; J(cyl(2, 900, M.dark, 0, 750, 0, 8)); }
  if (st.k === "table") { J(box(700, 30, 60, M.jig, 0, 480, 0)); [-250, 0, 250].forEach((x) => J(cyl(2, 120, M.dark, x, 420, 0, 6))); [[150, 0], [-75, 130], [-75, -130]].forEach(([x, z]) => J(cyl(6, 180, M.jig, x, 340, z, 12))); J(cyl(2, 600, M.dark, 0, 800, 0, 6)); }
  if (st.k === "wheel") { const m = J(cyl(10, 420, M.jig, R1.a, 120, 0, 24)); m.rotation.x = Math.PI / 2; }
  if (st.k === "worm") J(box(80, 80, 80, M.jig, R1.a, 120, 300));
  if (st.k === "back" || st.k === "encoder") J(cyl(12, 20, M.jig, st.k === "back" ? 300 : -60, st.k === "back" ? 345 : 205, 0, 24));
  if (st.k === "clamp") { J(box(1000, 30, 60, M.jig, 500, 360, 0)); J(box(100, 80, 80, M.dark, 600, 40, 300)); }
  if (st.k === "grind") J(cyl(150, 60, M.abrasive, 0, 470, 0, 64));
  if (st.k === "iso") { J(cyl(60, 50, M.ground, 0, 440, 0, 24)); J(box(120, 60, 60, M.dark, 400, 440, 0)); }
  if (st.k === "runin") J(box(120, 120, 120, M.dark, R1.a, 120, -360));
  const upd = (u, t) => {
    newest.forEach((kk) => { const o = parts[kk]; if (!o) return; const d = (1 - ease(Math.min(1, u * 1.4))); if (kk === "worm") o.position.set(R1.a, 120, d * 500); else if (kk === "wheel") o.position.y = -d * 300; else o.position.y = d * 300; });
    if (st.k === "grind" && jig.children[0]) jig.children[0].position.x = -200 + u * 400;
    if (st.k === "runin" || st.k === "iso" || st.k === "mesh" || st.k === "back") { const ang = st.k === "iso" ? Math.floor(u * 24) * TAU / 24 : t * 0.3; ["table", "zp", "pallet", "wheel"].forEach((kk) => { if (parts[kk]) parts[kk].rotation.y = ang; }); wm.rotation.x = st.k === "iso" ? ang * G.z2 : t * 0.3 * G.z2; if (st.k === "iso" && jig.children[0]) jig.children[0].rotation.y = ang; }
  };
  return { root, upd };
}

/* ------------------------------------------------------------------ the view */
export function create(el, getState, kind) {
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0); el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1); if (window.dtTheme) window.dtTheme.scene(scene, "#e9edf1", "#1c2126");
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 2, 40000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 1.1)); const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(800, 1500, 1000); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement); const nice = niceControls(controls, camera, scene, { minDist: 50, maxDist: 20000 });
  const lbl = document.createElement("div"); lbl.className = "mf3d-lbl"; el.appendChild(lbl);
  const fitBtn = document.createElement("button"); fitBtn.className = "btn ghost mf3d-fit"; fitBtn.textContent = "Fit view"; el.appendChild(fitBtn);
  let cur = null, key = "", t0 = performance.now();
  const fit = () => { if (!cur) return; const fo = cur.root.userData.focus, b = new THREE.Box3().setFromObject(fo || cur.root), fk = fo ? 1.9 : 0.95, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    if (nice && nice.stop) nice.stop(); controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0.55, 0.45, 0.75).normalize().multiplyScalar(s * fk)); camera.near = s / 200; camera.far = s * 60; camera.updateProjectionMatrix(); controls.update(); };
  fitBtn.addEventListener("click", fit);
  const rebuild = (st) => { if (cur) { scene.remove(cur.root); cur.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    cur = kind === "worm" ? buildWorm(st) : kind === "wheel" ? buildWheel(st) : buildAsm(st); scene.add(cur.root); cur.upd(st.u, 0); fit(); };
  const loop = () => {
    requestAnimationFrame(loop);
    if (!el.offsetParent) return;
    const st = getState(); if (!st) return;
    const w = el.clientWidth, h = el.clientHeight; if (w && h && (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio()))) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const k = `${st.k}|${kind === "asm" ? st.cut + "|" + JSON.stringify(st.F) : JSON.stringify(st.P && st.P.thr) + (st.P && st.P.meth)}|${st.R && st.R.seed}`;
    if (k !== key) { key = k; rebuild(st); }
    const t = (performance.now() - t0) / 1000;
    cur.upd(st.u, t);
    lbl.textContent = `${kind === "asm" ? "Step" : "Op"} ${st.no} · ${st.n}  —  progress ${Math.round(st.u * 100)} %`;
    controls.update(); renderer.render(scene, camera);
  };
  loop();
  if (new URLSearchParams(location.search).has("shot3d")) setInterval(() => { let im = document.getElementById("shot3dimg"); if (!im) { im = document.createElement("img"); im.id = "shot3dimg"; im.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none"; el.appendChild(im); } im.src = renderer.domElement.toDataURL(); }, 800);
  return { fit };
}
