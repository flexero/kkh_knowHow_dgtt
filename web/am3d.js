/* Additive manufacturing tab – item 2: 3D view of a laser powder bed fusion (LPBF) build chamber.
 * Offline (local three.js). World units = mm, Y up. Plate coordinates (x, y) map to world (x, z).
 * The powder surface stays at world y = 0; the build plate (piston) goes DOWN by z while printing,
 * exactly like a real machine. Parts are clipped at the powder surface, so they "grow" layer by layer.
 *
 *   import { create } from "./am3d.js";
 *   const v = create(divElement, getState);   // getState() -> state object (see amlpbf.js) or null
 *   v.fit(); v.dispose();
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";   // vendor/OrbitControls.js (offline)
import { niceControls } from "./view3d.js";

const MACHINE_OPS = ["powder", "prep", "setup", "print", "depowder"];
const POST_TABLE = ["finish", "inspect", "release"];

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? 0.3, roughness: o.r ?? 0.6,
  transparent: o.op != null, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op == null });

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,240,1)"); r.addColorStop(0.25, "rgba(255,200,80,0.9)"); r.addColorStop(0.6, "rgba(255,90,20,0.35)"); r.addColorStop(1, "rgba(255,60,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

/* ---------------------------------------------------------------- part shapes (local base at y = 0) */
function makePart(p, M) {
  const g = new THREE.Group(), w = p.w, d = p.d, h = p.h;
  const box = (sx, sy, sz, x, y, z, m = M.part) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
  if (p.shape === "bracket") {
    box(w, h * 0.15, d, 0, h * 0.075, 0);                         // base flange
    box(w * 0.18, h, d, -w / 2 + w * 0.09, h / 2, 0);             // upright wall
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(w * 0.82, 0); sh.lineTo(0, h * 0.85); sh.lineTo(0, 0);
    [-0.3, 0.3].forEach((k) => {                                   // two triangular ribs
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d * 0.14, bevelEnabled: false });
      const o = new THREE.Mesh(geo, M.part); o.position.set(-w / 2 + w * 0.18, h * 0.15, k * d - d * 0.07); g.add(o);
    });
  } else if (p.shape === "insert") {
    box(w, h, d, 0, h / 2, 0);                                     // tool steel block
    const r = Math.min(w, d) * 0.06;
    [0.25, 0.5, 0.75].forEach((k, i) => {                          // conformal cooling channels (dark tubes)
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, (i === 1 ? d : w) * 1.02, 14), M.chan);
      if (i === 1) c.rotation.x = Math.PI / 2; else c.rotation.z = Math.PI / 2;
      c.position.set(0, h * k, (i - 1) * d * 0.2); g.add(c);
    });
  } else if (p.shape === "head") {
    box(w, h * 0.55, d, 0, h * 0.275, 0);                          // head body
    for (let i = 0; i < 6; i++) box(w, h * 0.45, d * 0.05, 0, h * 0.775, -d / 2 + d * (0.08 + i * 0.168));  // cooling fins
  } else {                                                         // impeller
    const R = Math.min(w, d) / 2;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, h * 0.15, 36), M.part); disc.position.y = h * 0.075; g.add(disc);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.3, h, 20), M.part); hub.position.y = h / 2; g.add(hub);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, b = box(R * 0.75, h * 0.8, R * 0.06, 0, h * 0.5, 0);
      b.position.set(Math.cos(a) * R * 0.58, h * 0.5, Math.sin(a) * R * 0.58); b.rotation.y = -a + 0.35;
    }
  }
  return g;
}

/* ---------------------------------------------------------------- build the whole scene for one state.key */
function build(st, M, glow) {
  const [W, D, Hmax] = st.plate, CW = W * 2.0, CD = D * 1.5, Hc = Math.max(220, W * 0.9);
  const root = new THREE.Group(), mach = new THREE.Group(), L = {};      // L = moving / switchable objects
  root.add(mach);
  const add = (geo, m, x, y, z, parent = mach) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const edges = (geo, x, y, z, parent = mach) => { const o = new THREE.LineSegments(new THREE.EdgesGeometry(geo), M.edge); o.position.set(x, y, z); parent.add(o); };

  // chamber (glass box) + working plane with the build opening
  const chG = new THREE.BoxGeometry(CW, Hc, CD); add(chG, M.glass, 0, Hc / 2, 0); edges(chG, 0, Hc / 2, 0);
  const t = 10, side = (CW - W) / 2, strip = (CD - D) / 2;
  add(new THREE.BoxGeometry(side, t, CD), M.frame, -(W + side) / 2, -t / 2, 0);
  add(new THREE.BoxGeometry(side, t, CD), M.frame, (W + side) / 2, -t / 2, 0);
  add(new THREE.BoxGeometry(W, t, strip), M.frame, 0, -t / 2, -(D + strip) / 2);
  add(new THREE.BoxGeometry(W, t, strip), M.cut, 0, -t / 2, (D + strip) / 2);   // front strip see-through (cut-away view into the build cylinder)
  // build cylinder below the working plane (transparent so the parts can be seen)
  const cyG = new THREE.BoxGeometry(W + 16, Hmax + 40, D + 16); add(cyG, M.glass2, 0, -(Hmax + 40) / 2 - t, 0); edges(cyG, 0, -(Hmax + 40) / 2 - t, 0);
  // overflow slot (right) + dosing hopper (top left)
  add(new THREE.BoxGeometry(W * 0.08, 60, D), M.dark, W / 2 + W * 0.12, -30, 0);
  const hop = add(new THREE.BoxGeometry(W * 0.22, Hc * 0.28, D * 0.9), M.hopper, -W * 0.78, Hc * 0.72, 0);
  add(new THREE.CylinderGeometry(W * 0.02, W * 0.1, Hc * 0.18, 4), M.hopper, -W * 0.78, Hc * 0.49, 0).rotation.y = Math.PI / 4;
  L.hopperPos = hop.position.clone();
  // gas inlet (left wall) + outlet (right wall)
  const gi = add(new THREE.BoxGeometry(12, 30, D * 0.9), M.gasIn, -CW / 2 + 8, 25, 0);
  const go = add(new THREE.BoxGeometry(12, 30, D * 0.9), M.gasOut, CW / 2 - 8, 25, 0);
  L.gasIn = gi.position.clone(); L.gasOut = go.position.clone();
  L.arrows = [];
  for (let k = 0; k < 6; k++) { const a = add(new THREE.ConeGeometry(W * 0.012 + 2, W * 0.04 + 6, 10), M.gasIn, 0, 18, -D * 0.4 + k * D * 0.16); a.rotation.z = -Math.PI / 2; L.arrows.push(a); }
  // scanner heads on the ceiling, one per laser, arranged in a grid above the plate
  const n = Math.max(1, st.lasers | 0), cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols);
  L.heads = [];
  for (let i = 0; i < n; i++) {
    const cx = -W / 2 + ((i % cols) + 0.5) * W / cols, cz = -D / 2 + (Math.floor(i / cols) + 0.5) * D / rows;
    add(new THREE.BoxGeometry(W * 0.06 + 12, 18, W * 0.06 + 12), M.frame, cx, Hc + 9, cz);
    add(new THREE.CylinderGeometry(5, 5, 10, 12), M.dark, cx, Hc - 5, cz);
    L.heads.push(new THREE.Vector3(cx, Hc - 10, cz));
  }
  L.beams = L.heads.map(() => { const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]); const l = new THREE.Line(geo, M.beam); root.add(l); return l; });
  L.pools = L.heads.map(() => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(W * 0.04 + 6); root.add(s); return s; });
  // spatter particles
  const NP = 90, pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  L.spat = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc060, size: Math.max(2, W * 0.008), transparent: true, opacity: 0.9 })); L.spatV = new Float32Array(NP * 4); root.add(L.spat);
  // recoater bar, streak groove, oxygen haze
  L.recoater = add(new THREE.BoxGeometry(W * 0.03 + 6, 20, D + 30), M.recoater, 0, 10, 0);
  L.streak = add(new THREE.BoxGeometry(2.5, 1, D), M.dark, -W / 2 + W * 0.15, 0.6, 0, root);
  L.haze = add(new THREE.BoxGeometry(CW - 4, Hc - 4, CD - 4), M.haze, 0, Hc / 2, 0);

  // piston (plate) group: everything here moves with plateTop
  const plateG = new THREE.Group(); root.add(plateG); L.plateG = plateG;
  add(new THREE.BoxGeometry(W, 20, D), M.plate, 0, -10, 0, plateG);
  L.rod = add(new THREE.CylinderGeometry(W * 0.08, W * 0.08, Hmax + 60, 20), M.frame, 0, -20 - (Hmax + 60) / 2, 0, plateG);
  // supports: one instanced mesh, thin walls in a grid under every part
  const sup = [];
  st.parts.forEach((p) => {
    const nx = Math.max(2, Math.round(p.w / 12)), nz = Math.max(2, Math.round(p.d / 12));
    for (let i = 0; i <= nx; i++) sup.push([p.x - p.w / 2 + i * p.w / nx, p.y, 1.2, p.d]);
    for (let j = 0; j <= nz; j++) sup.push([p.x, p.y - p.d / 2 + j * p.d / nz, p.w, 1.2]);
  });
  const supH = Math.max(0.5, st.supH || 0);
  L.sup = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.sup, Math.max(1, sup.length));
  const mtx = new THREE.Matrix4();
  sup.forEach(([x, z, sx, sz], i) => { mtx.compose(new THREE.Vector3(x, supH / 2, z), new THREE.Quaternion(), new THREE.Vector3(sx, supH, sz)); L.sup.setMatrixAt(i, mtx); });
  L.sup.count = sup.length; plateG.add(L.sup);
  // parts (base at supH above the plate)
  L.partsRoot = new THREE.Group(); L.partsRoot.position.y = supH; plateG.add(L.partsRoot);
  L.parts = st.parts.map((p) => { const g = makePart(p, M); g.position.set(p.x, 0, p.y); L.partsRoot.add(g); return g; });
  // fresh-layer caps (shown where a part crosses the powder surface) + curl marker
  L.caps = st.parts.map((p) => { const geo = p.shape === "impeller" ? new THREE.CylinderGeometry(Math.min(p.w, p.d) / 2, Math.min(p.w, p.d) / 2, 0.6, 32) : new THREE.BoxGeometry(p.w, 0.6, p.d);
    return add(geo, M.cap, p.x, 0.3, p.y, root); });
  const p0 = st.parts[0] || { x: 0, y: 0, w: 20, d: 20 };
  L.curl = add(new THREE.BoxGeometry(p0.w, 3, p0.d * 0.25), M.curl, p0.x, 1.5, p0.y + p0.d * 0.375, root);
  // powder bed block (from the plate top up to y = 0), semi-transparent
  L.powder = add(new THREE.BoxGeometry(1, 1, 1), M.powder, 0, 0, 0, root); L.powder.scale.set(W - 1, 1, D - 1);

  // post-process props: furnace, wire EDM, table, CT ring, floor
  const fG = new THREE.BoxGeometry(W * 1.35, Hmax * 0.6 + 120, D * 1.35);
  L.furnace = new THREE.Group(); root.add(L.furnace);
  add(fG, M.furnace, 0, (Hmax * 0.6 + 120) / 2 - 20, 0, L.furnace); edges(fG, 0, (Hmax * 0.6 + 120) / 2 - 20, 0, L.furnace);
  L.wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, -D * 0.7), new THREE.Vector3(0, 0, D * 0.7)]), M.wire); root.add(L.wire);
  L.table = add(new THREE.BoxGeometry(W * 1.6, 40, D * 1.6), M.table, 0, -40, 0, root);
  L.ct = new THREE.Group(); root.add(L.ct);
  const tor = new THREE.Mesh(new THREE.TorusGeometry(Math.max(W, D) * 0.75, 14, 12, 48), M.frame); tor.position.y = Math.max(40, Hmax * 0.25); L.ct.add(tor);
  add(new THREE.CylinderGeometry(Math.max(W, D) * 0.55, Math.max(W, D) * 0.55, 12, 40), M.dark, 0, -14, 0, L.ct);   // turntable on the table top (y -20 .. -8)
  const floor = add(new THREE.BoxGeometry(CW * 2.4, 4, CD * 3), M.floor, 0, -Hmax - 92, 0, root);
  L.floorY = floor.position.y;
  Object.assign(L, { W, D, Hmax, CW, CD, Hc, supH, mach });
  return { root, L };
}

/* ---------------------------------------------------------------- the view */
export function create(el, getState) {
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  const W0 = el.clientWidth || 900, H0 = el.clientHeight || 520;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(W0, H0); renderer.localClippingEnabled = true;
  el.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9edf1);
  if (window.dtTheme) window.dtTheme.scene(scene, "#e9edf1", "#1c2126");
  const camera = new THREE.PerspectiveCamera(40, W0 / H0, 2, 40000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9099, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(900, 1600, 1200); scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene, { minDist: 30, maxDist: 20000 });

  // clipping plane at the powder surface: keeps y <= constant
  const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  const M = {
    part: std(0xc4cad1, { m: 0.25, r: 0.45 }), chan: std(0x2a2f36, { m: 0.2, r: 0.8 }), sup: std(0x9aa1a8, { m: 0.2, r: 0.55 }),
    plate: std(0x8a929a, { m: 0.3, r: 0.4 }), cut: std(0x4a5560, { op: 0.25, ds: true, m: 0, r: 0.6 }), frame: std(0x4a5560, { m: 0.4, r: 0.5 }), dark: std(0x30343a, { m: 0.2, r: 0.8 }),
    hopper: std(0x6f8fae, { m: 0.3, r: 0.5 }), recoater: std(0xd0a020, { m: 0.4, r: 0.4 }), gasIn: std(0x2a78d6, { m: 0, r: 0.6 }), gasOut: std(0x35b4cc, { m: 0, r: 0.6 }),
    glass: std(0x9fc4e0, { op: 0.08, ds: true, m: 0, r: 0.1 }), glass2: std(0x9fc4e0, { op: 0.06, ds: true, m: 0, r: 0.1 }),
    powder: std(0x9a9a96, { op: 0.4, m: 0, r: 1 }), cap: std(0xe8b070, { m: 0.2, r: 0.5 }), curl: std(0xd03b3b, { m: 0, r: 0.6 }),
    haze: std(0xff3020, { op: 0.12, ds: true, m: 0, r: 1 }), furnace: std(0xd06020, { op: 0.12, ds: true, m: 0, r: 1 }),
    table: std(0x6b7178, { m: 0.3, r: 0.7 }), floor: std(0xd8d6cf, { m: 0, r: 0.95 }),
    edge: new THREE.LineBasicMaterial({ color: 0x5a6f84, transparent: true, opacity: 0.6 }),
    beam: new THREE.LineBasicMaterial({ color: 0xff4a1a, transparent: true, opacity: 1 }),
    wire: new THREE.LineBasicMaterial({ color: 0xffd23a }),
  };
  M.cap.emissive = new THREE.Color(0x6a3000); M.curl.emissive = new THREE.Color(0x601010);
  [M.part, M.chan, M.sup].forEach((m) => { m.clippingPlanes = [clip]; });
  if (window.dtTheme) window.dtTheme.floor(M.floor);
  const glow = glowTexture();

  // HTML labels (CSS variables -> readable in light and dark theme)
  const lblBox = document.createElement("div"); lblBox.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden"; el.appendChild(lblBox);
  const LABELS = ["Scanner (lasers)", "Recoater", "Powder bed", "Build plate", "Gas inlet (argon)", "Gas outlet + filter", "Powder dosing"];
  const tags = LABELS.map((t) => { const d = document.createElement("div"); d.textContent = t;
    d.style.cssText = "position:absolute;transform:translate(-50%,-120%);font:11.5px system-ui,sans-serif;padding:2px 6px;border-radius:5px;white-space:nowrap;background:var(--surface);color:var(--text);border:1px solid var(--border);opacity:.92";
    lblBox.appendChild(d); return d; });
  const info = document.createElement("div"); info.style.cssText = "position:absolute;left:8px;bottom:8px;font:12px system-ui,sans-serif;color:var(--text-2);pointer-events:none"; el.appendChild(info);
  const fitBtn = document.createElement("button"); fitBtn.className = "btn ghost"; fitBtn.textContent = "Fit view";
  fitBtn.style.cssText = "position:absolute;right:8px;top:8px"; el.appendChild(fitBtn);

  let cur = null, key = "", mode = "", raf = 0, alive = true;
  const t0 = performance.now(), v3 = new THREE.Vector3();
  const fit = () => {
    if (!cur) return;
    const b = new THREE.Box3();   // note: Box3 ignores visibility, so the long piston rod is never used here
    if (mode === "machine") b.setFromObject(cur.L.mach); else { b.setFromObject(cur.L.table); b.expandByObject(cur.L.partsRoot); }
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    if (nice && nice.stop) nice.stop();
    controls.target.copy(c); camera.position.copy(c).add(new THREE.Vector3(0.55, 0.45, 0.8).normalize().multiplyScalar(s * (mode === "machine" ? 0.95 : 1.2)));
    camera.near = Math.max(1, s / 300); camera.far = s * 60; camera.updateProjectionMatrix(); controls.update();
  };
  fitBtn.addEventListener("click", fit);
  const dispose3 = (o) => o.traverse((x) => { if (x.geometry) x.geometry.dispose(); if (x.isSprite && x.material) x.material.dispose(); });
  const rebuild = (st) => { if (cur) { scene.remove(cur.root); dispose3(cur.root); } cur = build(st, M, glow); scene.add(cur.root); };

  function update(st, t) {
    const L = cur.L, op = st.op || "print", u = Math.max(0, Math.min(1, st.u || 0)), H = st.H || 0, f = st.faults || {};
    const inMach = MACHINE_OPS.includes(op), onTable = POST_TABLE.includes(op), printing = op === "print";
    const z = printing ? Math.max(0, Math.min(H, st.z ?? u * H)) : H;
    // plate height (top face of the build plate, world y)
    let plateTop = 0;
    if (printing) plateTop = -z; else if (op === "depowder") plateTop = -H * (1 - u);
    L.plateG.position.y = plateTop;
    L.mach.visible = inMach; L.rod.visible = inMach;
    clip.constant = printing ? 0.05 : 1e6;
    // parts / supports visibility per op
    const hasParts = !["powder", "prep", "setup"].includes(op);
    // the plate is seen until wire EDM has cut the parts off; after that parts stand on the table (top at y = -20)
    const plateShown = inMach || op === "sr" || op === "edm";
    L.plateG.children[0].visible = plateShown;
    if (!plateShown) L.plateG.position.y = -20;
    L.partsRoot.visible = hasParts;
    L.sup.visible = hasParts && !onTable && op !== "ht" && !(op === "support" && u > 0.98);
    M.sup.transparent = op === "support"; M.sup.opacity = op === "support" ? 1 - u : 1; M.sup.depthWrite = op !== "support";
    let py = L.supH;
    if (op === "edm") py += 15 * Math.max(0, (u - 0.9) * 10);       // parts lift off once the wire has passed
    if (onTable || op === "ht") py = op === "inspect" ? 12 : 0;
    L.partsRoot.position.y = py;
    // warm tint for heat treatment
    const warm = op === "sr" || op === "ht" ? u : 0; M.part.emissive.setRGB(0.9 * warm, 0.3 * warm, 0); M.part.emissiveIntensity = 0.6;
    // powder block
    const pH = -plateTop; L.powder.visible = inMach && hasParts && pH > 0.5;
    if (L.powder.visible) { L.powder.scale.y = pH; L.powder.position.y = -pH / 2; M.powder.opacity = op === "depowder" ? 0.4 * (1 - u) : 0.4; }
    // fresh layer caps where a part crosses the powder surface
    st.parts.forEach((p, i) => { const base = plateTop + L.supH, top = base + p.h; L.caps[i].visible = printing && base < 0 && top > 0; });
    // recoater
    L.recoater.visible = inMach;
    L.recoater.position.x = printing || op === "setup" ? -L.W / 2 + (st.recoater ?? 0) * L.W : -L.W / 2 - L.W * 0.12;
    // gas arrows flow from inlet to outlet
    L.arrows.forEach((a, k) => { a.visible = inMach && (printing || op === "setup"); a.position.x = -L.W * 0.9 + ((t * 0.18 + k / 6) % 1) * L.W * 1.8; });
    // laser beams + melt pools
    const spots = printing ? (st.spots || []) : [];
    M.beam.opacity = f.lowP ? 0.3 : 1;
    L.beams.forEach((b, i) => { const s = spots[i]; b.visible = !!s; if (!s) return;
      const pos = b.geometry.attributes.position; const h = L.heads[i]; pos.setXYZ(0, h.x, h.y, h.z); pos.setXYZ(1, s[0], 0.4, s[1]); pos.needsUpdate = true; b.geometry.computeBoundingSphere(); });
    L.pools.forEach((s, i) => { const p = spots[i]; s.visible = !!p; if (!p) return; s.position.set(p[0], 1, p[1]); s.scale.setScalar((L.W * 0.04 + 6) * (f.lowP ? 0.6 : 1) * (0.85 + 0.3 * Math.random())); });
    // spatter particles around the spots
    L.spat.visible = spots.length > 0;   // always a little spatter; much more with the "spatter" fault
    if (L.spat.visible) {
      const pa = L.spat.geometry.attributes.position, V = L.spatV, NP = pa.count, amp = f.spatter ? 3 : 0.8;
      for (let k = 0; k < NP; k++) {
        if (V[k * 4 + 3] <= 0 || Math.random() < 0.02) { const s = spots[k % spots.length]; pa.setXYZ(k, s[0], 1, s[1]);
          V[k * 4] = (Math.random() - 0.5) * 2 * amp; V[k * 4 + 1] = Math.random() * 2 * amp; V[k * 4 + 2] = (Math.random() - 0.5) * 2 * amp; V[k * 4 + 3] = 20 + Math.random() * 30; }
        pa.setXYZ(k, pa.getX(k) + V[k * 4] + 0.6 * amp, Math.max(0, pa.getY(k) + V[k * 4 + 1]), pa.getZ(k) + V[k * 4 + 2]); V[k * 4 + 1] -= 0.08; V[k * 4 + 3] -= 1;
      }
      pa.needsUpdate = true; L.spat.material.opacity = f.spatter ? 1 : 0.5;
    }
    // fault cues
    L.streak.visible = printing && !!f.streak;
    L.curl.visible = printing && !!f.curl && L.caps[0] && L.caps[0].visible; if (L.curl.visible) L.curl.position.y = 1.5 + 1.2 * Math.sin(t * 6);
    L.haze.visible = inMach && !!f.o2;
    // post-process props
    L.furnace.visible = op === "sr" || op === "ht"; M.furnace.opacity = 0.08 + 0.18 * u;
    L.wire.visible = op === "edm"; L.wire.position.set(-L.W / 2 - 20 + u * (L.W + 40), 1.5, 0);
    L.table.visible = !inMach; L.ct.visible = op === "inspect";
    L.partsRoot.rotation.y = op === "inspect" ? t * 0.5 : 0;
    // labels
    const show = st.labels !== false && inMach;
    const anchors = [L.heads[0] ? v3.set(L.heads[0].x, L.Hc + 22, L.heads[0].z).clone() : null,
      new THREE.Vector3(L.recoater.position.x, 24, L.D / 2), new THREE.Vector3(L.W * 0.3, -8, L.D / 2), new THREE.Vector3(-L.W * 0.3, plateTop - 20, L.D / 2),
      new THREE.Vector3(L.gasIn.x, L.gasIn.y + 20, L.D * 0.3), new THREE.Vector3(L.gasOut.x, L.gasOut.y + 20, L.D * 0.3), new THREE.Vector3(L.hopperPos.x, L.hopperPos.y + L.Hc * 0.16, 0)];
    const cw = el.clientWidth, chh = el.clientHeight;
    tags.forEach((d, i) => { const a = anchors[i]; if (!show || !a) { d.style.display = "none"; return; }
      a.project(camera); if (a.z > 1 || Math.abs(a.x) > 1.05 || Math.abs(a.y) > 1.05) { d.style.display = "none"; return; }
      d.style.display = ""; d.style.left = ((a.x + 1) / 2 * cw) + "px"; d.style.top = ((1 - a.y) / 2 * chh) + "px"; });
    info.textContent = printing ? `Printing – height ${z.toFixed(1)} of ${H.toFixed(1)} mm (plate lowered ${z.toFixed(1)} mm)` : `Step: ${op}  —  ${Math.round(u * 100)} %`;
  }

  const loop = () => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!el.offsetParent) return;
    const st = getState(); if (!st || !st.plate || !st.parts) return;
    const w = el.clientWidth, h = el.clientHeight, pr = renderer.getPixelRatio();
    if (w && h && (renderer.domElement.width !== Math.round(w * pr) || renderer.domElement.height !== Math.round(h * pr))) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    let refit = false;
    if (st.key !== key) { key = st.key; rebuild(st); refit = true; }
    const m = MACHINE_OPS.includes(st.op || "print") ? "machine" : "post";
    if (m !== mode) { mode = m; refit = true; }
    update(st, (performance.now() - t0) / 1000);
    if (refit) fit();
    controls.update(); renderer.render(scene, camera);
  };
  loop();

  const dispose = () => {
    alive = false; cancelAnimationFrame(raf);
    if (cur) { scene.remove(cur.root); dispose3(cur.root); }
    Object.values(M).forEach((m) => m.dispose && m.dispose()); glow.dispose(); controls.dispose(); renderer.dispose();
    el.innerHTML = "";
  };
  return { fit, dispose };
}
