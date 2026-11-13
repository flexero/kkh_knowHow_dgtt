/* CNC tab: G-code generator (a small CAM) + CNC controller simulator + 3D cutting preview.

   1. generate(S)      : operations (face, pocket, helix pocket, contour, holes) -> G-code text
                         in Fanuc/Haas or Siemens 840D dialect.
   2. interpret(text)  : reads the program block by block like a CNC controller (modal state, canned
                         cycles, arcs), checks it (feed zero, spindle off, rapid into material, over-travel,
                         arc radius error ...) and builds the tool motion with times.
   3. 3D preview       : Three.js = WebGL (the browser version of OpenGL). The stock is a height map that
                         the tool "cuts" while the program plays.

   Everything runs in the browser; nothing is sent to the twin. Machine, tool and cutting data are EXAMPLE
   values - a real program must be checked by a CNC programmer before it runs on a machine. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r3 = (v) => { const x = Math.round(v * 1000) / 1000; return Object.is(x, -0) ? 0 : x; };
const num = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mmss = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m + ":" + String(s % 60).padStart(2, "0"); };
const fx = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US");

/* ------------------------------------------------------------------ example data */
const MACHINES = {
  "VMC-01": { kind: "vmc", name: "Cylinder Boring Center", maxRpm: 8000, rapid: 30000, maxFeed: 12000, powerKw: 11, tc: 3,
              travel: { x: [-300, 300], y: [-200, 200], z: [-350, 150] }, zHome: 150 },
  "HMC-01": { kind: "hmc", name: "Crankcase Machining Center 1", maxRpm: 10000, rapid: 50000, maxFeed: 20000, powerKw: 18, torqueNm: 115, tc: 2.5,
              travel: { x: [-365, 365], y: [-365, 365], z: [-450, 200] }, zHome: 200 },
};
/* Spindle power available at speed n (example S1 data): constant torque below the base speed,
   constant power above it.  P = min(P_S1, M_S1 · n / 9 550).  HMC: 115 N·m up to 1 500 rpm, then 18 kW. */
const availKw = (mach, n) => (mach.torqueNm && n > 0 ? Math.min(mach.powerKw, (mach.torqueNm * n) / 9550) : mach.powerKw);
MACHINES["HMC-02"] = { ...MACHINES["HMC-01"], name: "Crankcase Machining Center 2" };
MACHINES["HMC-03"] = { ...MACHINES["HMC-01"], name: "Crankcase Machining Center 3" };

const MATS = {
  gg25: { name: "Cast iron GG25 (EN-GJL-250)", kc: 1100,
          vc: { face: 200, end: 150, drill: 90, tap: 12, bore: 150 }, fz: { face: 0.15, end: 0.08, drill: 0.2, tap: 0, bore: 0.15 } },
  alsi: { name: "Aluminium AlSi9Cu3 (die-cast)", kc: 700,
          vc: { face: 600, end: 400, drill: 150, tap: 20, bore: 300 }, fz: { face: 0.12, end: 0.07, drill: 0.15, tap: 0, bore: 0.12 } },
  c45:  { name: "Steel C45 (crankshaft steel)", kc: 2000,
          vc: { face: 180, end: 120, drill: 70, tap: 10, bore: 140 }, fz: { face: 0.12, end: 0.06, drill: 0.12, tap: 0, bore: 0.1 } },
};
const TT = { face: "Face mill", end: "End mill", drill: "Twist drill", tap: "Tap", bore: "Boring bar" };
const TOOL_DEF = { face: { d: 63, z: 5 }, end: { d: 12, z: 3 }, drill: { d: 8.5, z: 2 }, tap: { d: 10, z: 1, pitch: 1.5 }, bore: { d: 30, z: 1 } };

const OPK = {
  face:    { label: "Face milling (top surface)", tools: ["face", "end"] },
  pocket:  { label: "Rectangular pocket", tools: ["end"] },
  circ:    { label: "Circular pocket (helical milling)", tools: ["end"] },
  contour: { label: "Outside contour", tools: ["end"] },
  holes:   { label: "Holes: drill / tap / bore cycle", tools: ["drill", "tap", "bore"] },
};
// [key, label, unit, default, options]
const F_CX = ["cx", "Centre X", "mm", 0], F_CY = ["cy", "Centre Y", "mm", 0], F_TOP = ["top", "Top Z of feature", "mm", 0];
const FIELDS = {
  face: [["ap", "Depth per pass ap", "mm", 1], ["step", "Step-over", "% of Ø", 70]],
  pocket: [F_CX, F_CY, ["w", "Width (X)", "mm", 60], ["l", "Length (Y)", "mm", 40], ["r", "Corner radius", "mm", 8], F_TOP,
           ["depth", "Depth", "mm", 10], ["ap", "Depth per pass ap", "mm", 2.5], ["ae", "Step-over ae", "% of Ø", 40]],
  circ: [F_CX, F_CY, ["d", "Pocket Ø", "mm", 40], F_TOP, ["depth", "Depth", "mm", 15], ["ap", "Helix pitch = ap", "mm", 2],
         ["ae", "Step-over ae", "% of Ø", 40]],
  contour: [["shape", "Shape", "", "rect", ["rect", "circle"]], F_CX, F_CY, ["w", "Width (X)", "mm", 100], ["l", "Length (Y)", "mm", 80],
            ["r", "Corner radius", "mm", 10], ["d", "Circle Ø", "mm", 80], F_TOP, ["depth", "Depth", "mm", 10], ["ap", "Depth per pass ap", "mm", 4]],
  holes: [["pattern", "Pattern", "", "circle", ["circle", "points"]], F_CX, F_CY, ["pcd", "Bolt circle Ø", "mm", 80], ["n", "Number of holes", "", 4],
          ["a0", "Start angle", "°", 45], ["pts", "Points  x,y; x,y", "", "0,0"], F_TOP, ["depth", "Hole depth", "mm", 15],
          ["q", "Peck Q (0 = no peck)", "mm", 0]],
};
function fieldVisible(op, key) {
  if (op.kind === "contour") { if (op.shape === "circle") return !["w", "l", "r"].includes(key); return key !== "d"; }
  if (op.kind === "holes") {
    if (["pcd", "n", "a0"].includes(key)) return op.pattern !== "points";
    if (key === "pts") return op.pattern === "points";
  }
  return true;
}

const TEMPLATES = {
  cyl: () => ({
    tpl: "cyl", machine: "VMC-01", ctrl: "fanuc", mat: "gg25", progNo: 1001, progName: "CYL VC20 OP10", nums: true,
    stock: { w: 110, l: 110, h: 90, top: 1.5 },
    tools: [{ t: 1, type: "face", d: 63, z: 5 }, { t: 2, type: "bore", d: 51.5, z: 1 }, { t: 3, type: "bore", d: 52, z: 1 },
            { t: 4, type: "drill", d: 6.8, z: 2 }, { t: 5, type: "tap", d: 8, z: 1, pitch: 1.25 }],
    ops: [
      { kind: "face", on: true, tool: 1, ap: 1.5, step: 70 },
      { kind: "holes", on: true, tool: 2, pattern: "points", pts: "0,0", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 40, q: 0, vc: 120, fz: 0.25 },
      { kind: "holes", on: true, tool: 3, pattern: "points", pts: "0,0", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 40, q: 0, vc: 180, fz: 0.12 },
      { kind: "holes", on: true, tool: 4, pattern: "circle", pts: "0,0", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 16, q: 4 },
      { kind: "holes", on: true, tool: 5, pattern: "circle", pts: "0,0", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 12, q: 0 },
    ],
  }),
  cc: () => ({
    tpl: "cc", machine: "HMC-01", ctrl: "fanuc", mat: "gg25", progNo: 2001, progName: "CC VC20 OP20", nums: true,
    stock: { w: 160, l: 120, h: 60, top: 1 },
    tools: [{ t: 1, type: "face", d: 63, z: 5 }, { t: 2, type: "end", d: 16, z: 4 }, { t: 3, type: "end", d: 12, z: 3 },
            { t: 4, type: "drill", d: 8.5, z: 2 }, { t: 5, type: "tap", d: 10, z: 1, pitch: 1.5 }],
    ops: [
      { kind: "face", on: true, tool: 1, ap: 1, step: 70 },
      { kind: "contour", on: true, tool: 2, shape: "rect", cx: 0, cy: 0, w: 140, l: 100, r: 10, d: 80, top: 0, depth: 12, ap: 4 },
      { kind: "pocket", on: true, tool: 3, cx: 0, cy: 0, w: 80, l: 50, r: 8, top: 0, depth: 10, ap: 2.5, ae: 40 },
      { kind: "circ", on: true, tool: 2, cx: 0, cy: 0, d: 36, top: -10, depth: 15, ap: 2.5, ae: 40 },
      { kind: "holes", on: true, tool: 4, pattern: "points", pts: "-55,-38; 55,-38; 55,38; -55,38", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 20, q: 5 },
      { kind: "holes", on: true, tool: 5, pattern: "points", pts: "-55,-38; 55,-38; 55,38; -55,38", cx: 0, cy: 0, pcd: 80, n: 4, a0: 45, top: 0, depth: 16, q: 0 },
    ],
  }),
  empty: () => ({
    tpl: "empty", machine: "VMC-01", ctrl: "fanuc", mat: "gg25", progNo: 1000, progName: "NEW PART", nums: true,
    stock: { w: 100, l: 80, h: 40, top: 1 }, tools: [{ t: 1, type: "end", d: 10, z: 3 }], ops: [],
  }),
};
const TPL_NAMES = { cyl: "Cylinder VC20 – OP10: face, bore, 4 × M8 (VMC-01)", cc: "Crankcase VC20 – OP20: face, contour, pockets, 4 × M10 (HMC)", empty: "Empty program" };

/* ------------------------------------------------------------------ cutting data */
function cutData(op, tool, mat, mach) {
  const type = tool.type;
  const vc = num(op.vc) > 0 ? num(op.vc) : mat.vc[type];
  const fz = type === "tap" ? num(tool.pitch, 1) : (num(op.fz) > 0 ? num(op.fz) : mat.fz[type]);
  let n = (1000 * vc) / (Math.PI * Math.max(0.1, tool.d)), limited = false;
  if (n > mach.maxRpm) { n = mach.maxRpm; limited = true; }
  n = Math.round(n);
  let F;
  if (type === "tap") F = r3(n * num(tool.pitch, 1));
  else if (type === "drill" || type === "bore") F = Math.round(n * fz);
  else F = Math.round(n * Math.max(1, num(tool.z, 1)) * fz);
  return { vc, fz, n, F, limited, vcReal: (Math.PI * tool.d * n) / 1000, plunge: Math.max(20, Math.round(F * 0.3)) };
}

function levels(top, bottom, ap) {
  const zs = []; let z = top, g = 0; ap = Math.max(0.05, ap);
  while (z > bottom + 1e-6 && g++ < 400) { z = Math.max(bottom, z - ap); zs.push(r3(z)); }
  return zs;
}
function holePoints(op) {
  if (op.pattern === "points") {
    return String(op.pts || "").split(/[;\n]/).map((s) => s.split(",").map((v) => parseFloat(v)))
      .filter((p) => p.length === 2 && p.every(Number.isFinite));
  }
  const n = clamp(Math.round(num(op.n, 4)), 1, 36), r = num(op.pcd, 80) / 2, a0 = num(op.a0, 0), cx = num(op.cx), cy = num(op.cy);
  return Array.from({ length: n }, (_, k) => { const a = ((a0 + (360 * k) / n) * Math.PI) / 180; return [r3(cx + r * Math.cos(a)), r3(cy + r * Math.sin(a))]; });
}
// rounded rectangle tool path, starting and ending at the middle of the right side
function rrect(cx, cy, hx, hy, rc, ccw) {
  const ex = hx - rc, ey = hy - rc;
  if (ccw) return [
    ["l", cx + hx, cy + ey], ["a", cx + ex, cy + hy, cx + ex, cy + ey, 3],
    ["l", cx - ex, cy + hy], ["a", cx - hx, cy + ey, cx - ex, cy + ey, 3],
    ["l", cx - hx, cy - ey], ["a", cx - ex, cy - hy, cx - ex, cy - ey, 3],
    ["l", cx + ex, cy - hy], ["a", cx + hx, cy - ey, cx + ex, cy - ey, 3],
    ["l", cx + hx, cy]];
  return [
    ["l", cx + hx, cy - ey], ["a", cx + ex, cy - hy, cx + ex, cy - ey, 2],
    ["l", cx - ex, cy - hy], ["a", cx - hx, cy - ey, cx - ex, cy - ey, 2],
    ["l", cx - hx, cy + ey], ["a", cx - ex, cy + hy, cx - ex, cy + ey, 2],
    ["l", cx + ex, cy + hy], ["a", cx + hx, cy + ey, cx + ex, cy + ey, 2],
    ["l", cx + hx, cy]];
}

/* ------------------------------------------------------------------ 1. generator */
function generate(S) {
  const mach = MACHINES[S.machine], mat = MATS[S.mat], fan = S.ctrl === "fanuc";
  const out = [], opInfo = [];
  let N = 0;
  const fmt = (v) => { let s = String(r3(v)); if (fan && !s.includes(".")) s += "."; return s; };
  const cm = (t) => out.push(fan ? "(" + String(t).toUpperCase().replace(/[()]/g, "") + ")" : "; " + t);
  const ln = (t) => { N += 10; out.push((S.nums ? "N" + N + " " : "") + t); };
  const E = { g: null, x: null, y: null, z: null, f: null };
  const resetPos = () => { E.g = null; E.x = E.y = E.z = null; };
  const mv = (g, p, f) => {
    const w = [];
    if (E.g !== g) w.push("G" + g);
    let moved = false;
    for (const a of ["x", "y", "z"]) {
      if (p[a] === undefined) continue;
      if (E[a] === null || Math.abs(r3(p[a]) - E[a]) > 1e-9) { w.push(a.toUpperCase() + fmt(p[a])); moved = true; }
    }
    if (!moved) return;
    if (g !== 0 && f !== undefined && f !== E.f) { w.push("F" + fmt(f)); E.f = f; }
    E.g = g; for (const a of ["x", "y", "z"]) if (p[a] !== undefined) E[a] = r3(p[a]);
    ln(w.join(" "));
  };
  const arc = (g, x, y, z, cx, cy, f) => {
    const w = [];
    if (E.g !== g) w.push("G" + g);
    w.push("X" + fmt(x), "Y" + fmt(y));
    if (z !== undefined && Math.abs(r3(z) - E.z) > 1e-9) w.push("Z" + fmt(z));
    w.push("I" + fmt(cx - E.x), "J" + fmt(cy - E.y));
    if (f !== E.f) { w.push("F" + fmt(f)); E.f = f; }
    E.g = g; E.x = r3(x); E.y = r3(y); if (z !== undefined) E.z = r3(z);
    ln(w.join(" "));
  };
  const runPath = (seq, f) => {
    for (const s of seq) {
      if (s[0] === "l") mv(1, { x: s[1], y: s[2] }, f);
      else if (Math.hypot(s[1] - E.x, s[2] - E.y) > 1e-4) arc(s[5], s[1], s[2], undefined, s[3], s[4], f);
    }
  };

  const name = String(S.progName || "PART").toUpperCase().replace(/[^A-Z0-9 _-]/g, "").trim().slice(0, 24) || "PART";
  const clearZ = Math.max(50, Math.ceil(S.stock.top + 20));
  const top0 = S.stock.top, W = S.stock.w, L = S.stock.l;
  if (fan) { out.push("%"); out.push(`O${String(S.progNo).padStart(4, "0").slice(-4)} (${name})`); }
  else { out.push(`%_N_${name.replace(/[ -]/g, "_")}_MPF`); out.push(";$PATH=/_N_MPF_DIR"); }
  cm("Generated by the digital twin - EXAMPLE values, check before use");
  cm(`Machine ${S.machine}, material ${mat.name}`);
  cm(`Stock ${W} x ${L} x ${S.stock.h} mm - work zero: X0 Y0 = stock centre, Z0 = finished top face`);
  ln(fan ? "G21 G17 G40 G49 G80 G90" : "G17 G40 G90 G71");

  let curTool = null, curS = null;
  const endTool = () => {
    mv(0, { z: clearZ }); ln("M9"); ln("M5");
    if (fan) { ln("G91 G28 Z0."); ln("G90"); }
    resetPos();
  };

  S.ops.forEach((op, k) => {
    const info = { k, start: out.length, end: out.length, warn: [] }; opInfo[k] = info;
    if (!op.on) return;
    const tool = S.tools.find((t) => String(t.t) === String(op.tool));
    if (!tool) { info.warn.push("No tool selected."); return; }
    if (!OPK[op.kind].tools.includes(tool.type)) { info.warn.push(`${TT[tool.type]} cannot do this operation. Use: ${OPK[op.kind].tools.map((t) => TT[t]).join(" / ")}.`); return; }
    const cd = cutData(op, tool, mat, mach); info.cd = cd; info.tool = tool;
    if (cd.limited) info.warn.push(`Speed limited to the machine maximum ${mach.maxRpm} rpm (real Vc = ${fx(cd.vcReal, 0)} m/min).`);
    if (cd.F > mach.maxFeed) info.warn.push(`Feed ${cd.F} mm/min is above the machine maximum ${mach.maxFeed}.`);
    const R = tool.d / 2, F = cd.F;
    cm(`OP${k + 1} ${OPK[op.kind].label} - T${tool.t} ${TT[tool.type]} D${tool.d}`);
    const start = (x, y) => {
      if (curTool !== tool.t) {
        if (curTool !== null) endTool();
        cm(`T${tool.t} = ${TT[tool.type]} D${tool.d}${tool.type === "tap" ? " x " + tool.pitch : ""}`);
        ln(`T${tool.t} M6`);
        resetPos();
        if (fan) { ln(`G0 G90 G54 X${fmt(x)} Y${fmt(y)} S${cd.n} M3`); ln(`G43 H${tool.t} Z${fmt(clearZ)} M8`); }
        else { ln(`G0 G90 G54 D1 X${fmt(x)} Y${fmt(y)} S${cd.n} M3`); ln(`Z${fmt(clearZ)} M8`); }
        E.g = 0; E.x = r3(x); E.y = r3(y); E.z = clearZ;
        curTool = tool.t; curS = cd.n;
      } else {
        mv(0, { z: clearZ });
        if (curS !== cd.n) { ln(`S${cd.n} M3`); curS = cd.n; }
        mv(0, { x, y });
      }
    };
    const P = {
      face() {
        if (top0 <= 0.0001) { info.warn.push("Top allowance of the stock is 0: nothing to face."); return; }
        const ap = Math.max(0.1, num(op.ap, 1)), s = (tool.d * clamp(num(op.step, 70), 10, 95)) / 100;
        const zs = levels(top0, 0, ap);
        const y1 = -L / 2 + 0.7 * R, y2 = L / 2 - 0.7 * R;
        let ys = [0];
        if (y2 > y1 + 0.01) { const n = Math.ceil((y2 - y1) / s) + 1; ys = Array.from({ length: n }, (_, i) => r3(y1 + ((y2 - y1) * i) / (n - 1))); }
        const xs = -W / 2 - R - 3, xe = W / 2 + R + 3;
        start(xs, ys[0]);
        zs.forEach((z, li) => {
          if (li > 0) { mv(0, { z: top0 + 2 }); mv(0, { x: xs, y: ys[0] }); }
          mv(0, { z });
          ys.forEach((y, i) => { if (i > 0) mv(1, { y }, F); mv(1, { x: i % 2 ? xs : xe }, F); });
        });
        mv(0, { z: top0 + 2 });
        info.ap = Math.min(ap, top0); info.ae = Math.min(s, L);
      },
      pocket() {
        const cx = num(op.cx), cy = num(op.cy), w = num(op.w), l = num(op.l), r = Math.max(0, num(op.r)), top = num(op.top);
        const depth = num(op.depth), ap = Math.max(0.1, num(op.ap, 2)), ae = Math.max(0.1, (tool.d * clamp(num(op.ae, 40), 5, 95)) / 100);
        if (w <= tool.d + 0.1 || l <= tool.d + 0.1) { info.warn.push(`Pocket ${w} × ${l} is too small for a Ø${tool.d} tool.`); return; }
        if (depth <= 0) { info.warn.push("Depth must be > 0."); return; }
        if (r > 0 && r < R) info.warn.push(`Corner radius ${r} is smaller than the tool radius ${R}: the corners will get radius ${R}.`);
        const hxM = w / 2 - R, hyM = l / 2 - R, maxO = Math.min(hxM, hyM);
        const os = [0]; for (let o = ae; o < maxO - 0.2; o += ae) os.push(r3(o));
        if (maxO > 0.2) os.push(r3(maxO));
        os.reverse();
        start(cx, cy);
        let zPrev = top;
        levels(top, top - depth, ap).forEach((z, li) => {
          if (li > 0) { mv(0, { z: top + 2 }); mv(0, { x: cx, y: cy }); }
          mv(0, { z: zPrev + 1 });
          mv(1, { z }, cd.plunge);
          for (const o of os) {
            const hx = hxM - o, hy = hyM - o, rc = Math.min(Math.max(0, r - R - o), hx, hy);
            mv(1, { x: cx + hx, y: cy }, F);
            runPath(rrect(cx, cy, hx, hy, rc, true), F);
          }
          zPrev = z;
        });
        mv(0, { z: clearZ });
        info.ap = ap; info.ae = ae;
      },
      circ() {
        const cx = num(op.cx), cy = num(op.cy), D = num(op.d), top = num(op.top), depth = num(op.depth);
        const ap = Math.max(0.1, num(op.ap, 2)), ae = Math.max(0.1, (tool.d * clamp(num(op.ae, 40), 5, 95)) / 100);
        if (D <= tool.d + 0.5) { info.warn.push(`Pocket Ø${D} must be bigger than the tool Ø${tool.d}.`); return; }
        if (depth <= 0) { info.warn.push("Depth must be > 0."); return; }
        const rh = D / 2 - R, r0 = r3(Math.min(rh, 0.8 * R));
        const radii = [r0]; for (let r = r0 + ae; r < rh - 0.2; r += ae) radii.push(r3(r));
        if (rh - r0 > 0.2) radii.push(r3(rh));
        start(cx + r0, cy);
        mv(0, { z: top + 1 }); mv(1, { z: top }, cd.plunge);
        levels(top, top - depth, ap).forEach((z) => {
          arc(3, cx + r0, cy, z, cx, cy, F);               // helix: one turn down
          arc(3, cx + r0, cy, undefined, cx, cy, F);       // flat turn at the bottom
          radii.slice(1).forEach((r) => { mv(1, { x: cx + r }, F); arc(3, cx + r, cy, undefined, cx, cy, F); });
          if (radii.length > 1) mv(1, { x: cx + r0 }, F);
        });
        mv(1, { x: cx }, F); mv(0, { z: clearZ });
        info.ap = ap; info.ae = ae;
      },
      contour() {
        const cx = num(op.cx), cy = num(op.cy), top = num(op.top), depth = num(op.depth), ap = Math.max(0.1, num(op.ap, 4));
        if (depth <= 0) { info.warn.push("Depth must be > 0."); return; }
        const circle = op.shape === "circle";
        const hx = circle ? num(op.d) / 2 + R : num(op.w) / 2 + R, hy = num(op.l) / 2 + R;
        const rc = Math.min(Math.max(0, num(op.r)) + R, hx, hy);
        const sx = cx + hx, lead = R + 2;
        start(sx + lead, cy);
        let zPrev = top;
        levels(top, top - depth, ap).forEach((z, li) => {
          if (li > 0) { mv(0, { z: top + 2 }); mv(0, { x: sx + lead, y: cy }); }
          mv(0, { z: zPrev + 1 }); mv(1, { z }, cd.plunge); mv(1, { x: sx }, F);
          if (circle) arc(2, sx, cy, undefined, cx, cy, F); else runPath(rrect(cx, cy, hx, hy, rc, false), F);
          mv(1, { x: sx + lead }, F);
          zPrev = z;
        });
        mv(0, { z: clearZ });
        info.ap = ap; info.ae = R; info.aeNote = "assumed ae = R";
      },
      holes() {
        const pts = holePoints(op);
        if (!pts.length) { info.warn.push("No hole positions."); return; }
        const top = num(op.top), depth = num(op.depth), q = Math.max(0, num(op.q));
        if (depth <= 0) { info.warn.push("Depth must be > 0."); return; }
        const tip = tool.type === "drill" ? r3(0.3 * tool.d) : 0;
        const zb = r3(top - depth - tip), Rz = r3(top + 2), init = r3(top + 10);
        info.tip = tip; info.zb = zb;
        start(pts[0][0], pts[0][1]);
        mv(0, { z: init });
        const code = tool.type === "tap" ? 84 : tool.type === "bore" ? 85 : q > 0 ? 83 : 81;
        info.cycle = code;
        if (fan) {
          if (code === 84) ln(`M29 S${cd.n}`);
          ln(`G98 G${code} X${fmt(pts[0][0])} Y${fmt(pts[0][1])} Z${fmt(zb)} R${fmt(Rz)}${code === 83 ? " Q" + fmt(q) : ""} F${fmt(F)}`);
          E.f = F;
          pts.slice(1).forEach((p) => ln(`X${fmt(p[0])} Y${fmt(p[1])}`));
          ln("G80");
          E.g = null; E.x = r3(pts[pts.length - 1][0]); E.y = r3(pts[pts.length - 1][1]); E.z = init;
        } else {
          cm(`a real 840D would use ${code === 84 ? "CYCLE84" : code === 85 ? "CYCLE85" : code === 83 ? "CYCLE83" : "CYCLE81"} here - written out move by move`);
          pts.forEach((p) => {
            mv(0, { x: p[0], y: p[1] }); mv(0, { z: Rz });
            if (code === 84) {
              ln("SPOS=0"); ln(`G331 Z${fmt(zb)} K${fmt(tool.pitch)} S${cd.n}`); ln(`G332 Z${fmt(Rz)} K${fmt(tool.pitch)}`);
              E.g = null; E.z = Rz; curS = null;
            } else if (code === 85) { mv(1, { z: zb }, F); mv(1, { z: Rz }, F); }
            else if (code === 83) {
              let cur = top, first = true;
              while (cur > zb + 1e-6) {
                const nx = Math.max(zb, cur - q);
                if (!first) mv(0, { z: cur + 0.5 });
                mv(1, { z: nx }, F); mv(0, { z: Rz }); cur = nx; first = false;
              }
            } else { mv(1, { z: zb }, F); }
            mv(0, { z: init });
          });
          if (code === 84) { ln(`M3 S${cd.n}`); curS = cd.n; }
        }
        mv(0, { z: clearZ });
        info.pts = pts.length;
      },
    };
    P[op.kind]();
    info.end = out.length;
  });

  if (curTool !== null) mv(0, { z: clearZ });
  ln("M9"); ln("M5");
  if (fan) { ln("G91 G28 Z0."); ln("G90"); }
  ln("M30");
  if (fan) out.push("%");
  return { code: out.join("\n"), opInfo };
}

/* ------------------------------------------------------------------ height map (stock material) */
class Heightmap {
  constructor(w, l, top, bot, cell) {
    this.w = w; this.l = l; this.top = top; this.bot = bot;
    this.nx = Math.max(2, Math.round(w / cell)); this.ny = Math.max(2, Math.round(l / cell));
    this.dx = w / this.nx; this.dy = l / this.ny; this.x0 = -w / 2; this.y0 = -l / 2;
    this.H = new Float32Array((this.nx + 1) * (this.ny + 1)).fill(top);
  }
  reset() { this.H.fill(this.top); }
  _scan(x, y, r, fn) {
    const { nx, ny, dx, dy, x0, y0 } = this, r2 = r * r;
    const j0 = Math.max(0, Math.ceil((y - r - y0) / dy)), j1 = Math.min(ny, Math.floor((y + r - y0) / dy));
    for (let j = j0; j <= j1; j++) {
      const py = y0 + j * dy - y, rr = r2 - py * py;
      if (rr < 0) continue;
      const rw = Math.sqrt(rr);
      const ia = Math.max(0, Math.ceil((x - rw - x0) / dx)), ib = Math.min(nx, Math.floor((x + rw - x0) / dx));
      for (let i = ia; i <= ib; i++) fn(j * (nx + 1) + i);
    }
  }
  stamp(x, y, z, r) {             // flat tool tip at z, radius r -> returns the deepest cut
    if (z >= this.top) return 0;
    const zz = Math.max(z, this.bot), H = this.H; let rem = 0;
    this._scan(x, y, r, (k) => { if (H[k] > zz) { if (H[k] - zz > rem) rem = H[k] - zz; H[k] = zz; } });
    return rem;
  }
  maxUnder(x, y, r) { let m = -Infinity; const H = this.H; this._scan(x, y, r, (k) => { if (H[k] > m) m = H[k]; }); return m; }
}
function sweep(pts, cum, d0, d1, step, fn) {
  for (let k = 0; k < pts.length - 1; k++) {
    const s0 = cum[k], s1 = cum[k + 1];
    if (s1 < d0 || s0 > d1) continue;
    const a = pts[k], b = pts[k + 1], L = s1 - s0, from = Math.max(d0, s0), to = Math.min(d1, s1);
    const n = Math.max(1, Math.ceil((to - from) / step));
    for (let q = 0; q <= n; q++) {
      const s = from + ((to - from) * q) / n, f = L > 0 ? (s - s0) / L : 1;
      if (fn(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f) === false) return false;
    }
  }
  return true;
}
function pointAt(m, d) {
  const p = m.pts, c = m.cum;
  for (let k = 0; k < p.length - 1; k++) {
    if (d <= c[k + 1] || k === p.length - 2) {
      const L = c[k + 1] - c[k], f = L > 0 ? clamp((d - c[k]) / L, 0, 1) : 1, a = p[k], b = p[k + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    }
  }
  return p[p.length - 1];
}

/* ------------------------------------------------------------------ 2. CNC controller simulator */
const GEX = {
  0: "Rapid move: go at full machine speed, NOT cutting. Modal = stays active until G1/G2/G3.",
  1: "Linear feed: cut in a straight line at feed rate F. Modal.",
  2: "Arc clockwise: cut a circle arc. I and J = arc centre, measured from the start point. With Z it is a helix.",
  3: "Arc counter-clockwise: like G2, other direction. With Z it is a helix (used to enter material softly).",
  4: "Dwell: wait a short time.",
  17: "Plane XY: arcs are in the XY plane (normal for milling).",
  21: "Units = millimetres (Fanuc).",
  28: "Return to machine home through the intermediate point. 'G91 G28 Z0.' = go straight up to home.",
  40: "Cancel cutter radius compensation (safety line at program start).",
  41: "Cutter radius compensation LEFT (not simulated here).",
  42: "Cutter radius compensation RIGHT (not simulated here).",
  43: "Tool length compensation ON with offset H: the control adds the tool length, so Z means the tool TIP.",
  49: "Cancel tool length compensation.",
  54: "Work offset no. 1: use work zero G54 (the operator measures it with a probe). Here X0 Y0 = stock centre, Z0 = finished top.",
  70: "Units = inch (Siemens) - not supported here.", 71: "Units = millimetres (Siemens).",
  75: "Siemens: go to a fixed point (home).",
  80: "Cancel the canned (drilling) cycle.",
  81: "Drilling cycle: rapid to R, feed to Z, rapid out. Then one short line per hole.",
  83: "Peck drilling cycle: drill Q mm, pull out to R to break and clear the chips, go back in, repeat until Z.",
  84: "Tapping cycle: feed in with F = S × pitch, the spindle reverses at the bottom, feed out.",
  85: "Boring cycle: feed in to Z and feed out again (good bore surface).",
  90: "Absolute coordinates: X/Y/Z are positions measured from work zero.",
  91: "Incremental coordinates: X/Y/Z are distances from where the tool is now.",
  94: "Feed in mm per minute.",
  98: "After each hole return to the INITIAL level (safe over clamps).",
  99: "After each hole return only to the R level (faster).",
  331: "Siemens rigid tapping IN: Z = depth, K = thread pitch.", 332: "Siemens rigid tapping OUT.",
};
const MEX = {
  0: "Program stop (operator must press Cycle Start).", 1: "Optional stop.", 2: "Program end.",
  3: "Spindle ON, clockwise.", 4: "Spindle ON, counter-clockwise.", 5: "Spindle STOP.",
  6: "Tool change: the tool changer puts tool T into the spindle (Z goes up to the change position first).",
  8: "Coolant ON.", 9: "Coolant OFF.", 29: "Rigid tapping mode: spindle rotation and Z feed are locked together.",
  30: "Program end, rewind to the start (ready for the next part).",
};
const IGNORE_G = new Set([15, 61, 64, 69, 500]);

function interpret(text, S) {
  const mach = MACHINES[S.machine], fan = S.ctrl === "fanuc";
  const W = S.stock.w, L = S.stock.l, top = S.stock.top, bot = S.stock.top - S.stock.h;
  const hm = new Heightmap(W, L, top, bot, Math.max(0.8, Math.max(W, L) / 150));
  const step = Math.min(hm.dx, hm.dy) * 0.9;
  const toolOf = (t) => S.tools.find((x) => String(x.t) === String(t)) || null;
  const src = text.split(/\r?\n/);
  const st = { x: 0, y: 0, z: mach.zHome, mot: 0, abs: true, F: 0, S: 0, sp: 0, spos: false, tool: 0, nextT: 0, H: !fan,
               cool: false, cyc: null, ret: 98, initZ: 0, cz: null, cr: null, cq: 0, wcs: 54, rigid: false };
  const moves = [], msgs = [], lines = new Array(src.length).fill(null);
  const once = new Set();
  let t = 0, stop = null, ended = false, i = 0, tinfo = { d: 0, type: "end" };
  const msg = (lvl, text, key) => {
    if (key) { if (once.has(key)) return; once.add(key); }
    msgs.push({ i, lvl, text });
    if (lvl === "alarm" || lvl === "crash") stop = i;
  };
  const mk = (kind, pts, F, dur) => {
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]));
    const len = cum[cum.length - 1];
    if (dur === undefined) dur = kind === "rapid" ? (len / mach.rapid) * 60 : (len / F) * 60;
    return { kind, pts, cum, len, F, dur, t0: t, i, tool: st.tool, r: st.tool ? tinfo.d / 2 : 0, tt: tinfo.type };
  };
  const push = (m) => { m.t0 = t; t += m.dur; moves.push(m); };

  function doMove(kind, pts, F) {
    if (stop !== null) return false;
    const end = pts[pts.length - 1];
    if (Math.hypot(end[0] - st.x, end[1] - st.y, end[2] - st.z) < 1e-6 && pts.length <= 2) return true;
    if (kind === "feed" && !(F > 0)) { msg("alarm", "PS0011 FEED ZERO: a cutting move (G1/G2/G3) needs a feed rate F. Without F the control stops (Fanuc-style alarm number)."); return false; }
    for (const ax of ["x", "y", "z"]) {
      const v = end[{ x: 0, y: 1, z: 2 }[ax]], lim = mach.travel[ax];
      if (v < lim[0] - 1e-6 || v > lim[1] + 1e-6) {
        msg("alarm", `Over-travel ${ax.toUpperCase()}${v > lim[1] ? "+" : "−"}: ${ax.toUpperCase()}${r3(v)} is outside the machine travel (${lim[0]} … ${lim[1]} mm from work zero, example). The axis stops at the soft limit.`);
        return false;
      }
    }
    const m = mk(kind, pts, F);
    const r = m.r;
    let crash = false, below = false, removed = 0;
    // a rapid move is checked against the material left by the EARLIER moves, before this move removes anything
    if (kind === "rapid" && r) sweep(m.pts, m.cum, 0, m.len, step, (x, y, z) => {
      if (z < top - 0.01 && hm.maxUnder(x, y, Math.max(0.2, r - 1.2 * hm.dx)) > z + 0.3) { crash = true; return false; }
      return true;
    });
    if (!crash) sweep(m.pts, m.cum, 0, m.len, step, (x, y, z) => {
      if (z < bot - 0.01 && Math.abs(x) <= W / 2 + r && Math.abs(y) <= L / 2 + r) { below = true; return false; }
      if (!r) return true;
      const d = hm.stamp(x, y, z, r); if (d > removed) removed = d;
      return true;
    });
    if (below) { msg("crash", `CRASH: the tool goes below the bottom of the part (Z${r3(bot)}) into the fixture / machine table.`); return false; }
    if (crash) { msg("crash", "CRASH: rapid move (G0) into the material. Rapid moves must stay in the air - cut with G1 and a feed, or go up first."); return false; }
    if (kind === "feed" && !st.tool) msg("warn", "No tool in the spindle (T.. M6 is missing) - the move cuts air.", "notool");
    if (removed > 0.05) {
      if (st.sp === 0 && !st.spos) { msg("alarm", "The tool cuts material but the spindle is NOT turning (M3 missing or M5 active). On a real machine the tool breaks."); return false; }
      if (fan && !st.H) msg("warn", "Cutting without G43 H (tool length compensation). On a real machine the control does not know the tool length: crash or air cut.", "g43");
      m.cut = true;
    }
    push(m);
    st.x = end[0]; st.y = end[1]; st.z = end[2];
    return true;
  }
  const lin = (kind, x, y, z, F) => doMove(kind, [[st.x, st.y, st.z], [x, y, z]], F);

  function doArc(g, x, y, z, I, J, R, F) {
    const sx = st.x, sy = st.y;
    let cx, cy;
    if (I !== undefined || J !== undefined) { cx = sx + (I || 0); cy = sy + (J || 0); }
    else if (R !== undefined) {
      const dx = x - sx, dy = y - sy, d = Math.hypot(dx, dy);
      if (d < 1e-6) { msg("alarm", "An arc with R cannot make a full circle - use I/J."); return false; }
      if (d > 2 * Math.abs(R) + 1e-3) { msg("alarm", `PS0020 OVER TOLERANCE OF RADIUS: R${R} is too small for this arc (distance ${r3(d)} mm).`); return false; }
      const h = Math.sqrt(Math.max(0, R * R - (d / 2) ** 2)), mx = (sx + x) / 2, my = (sy + y) / 2;
      let sgn = g === 3 ? 1 : -1; if (R < 0) sgn = -sgn;
      cx = mx - (sgn * h * dy) / d; cy = my + (sgn * h * dx) / d;
    } else { msg("alarm", "G2/G3 needs I/J (centre) or R (radius)."); return false; }
    const r0 = Math.hypot(sx - cx, sy - cy), r1 = Math.hypot(x - cx, y - cy);
    if (Math.abs(r0 - r1) > 0.02) { msg("alarm", `PS0020 OVER TOLERANCE OF RADIUS: start radius ${r3(r0)} ≠ end radius ${r3(r1)}. Check X/Y and I/J.`); return false; }
    const a0 = Math.atan2(sy - cy, sx - cx), a1 = Math.atan2(y - cy, x - cx);
    let sw = a1 - a0;
    const full = Math.hypot(x - sx, y - sy) < 1e-6;
    if (g === 3) { if (sw <= 1e-9) sw += 2 * Math.PI; } else if (sw >= -1e-9) sw -= 2 * Math.PI;
    if (full) sw = g === 3 ? 2 * Math.PI : -2 * Math.PI;
    const n = clamp(Math.ceil(Math.max((Math.abs(sw) * r0) / 0.8, Math.abs(sw) / (Math.PI / 36))), 4, 720);
    const pts = [[sx, sy, st.z]];
    for (let k = 1; k <= n; k++) {
      const a = a0 + (sw * k) / n;
      pts.push(k === n ? [x, y, z] : [cx + r0 * Math.cos(a), cy + r0 * Math.sin(a), st.z + ((z - st.z) * k) / n]);
    }
    return doMove("feed", pts, F);
  }

  function cycleAt(x, y) {
    const c = st.cyc;
    if (st.cz === null || st.cr === null) { msg("alarm", `G${c} needs Z (hole bottom) and R (start level).`); return; }
    if (c === 83 && !(st.cq > 0)) { msg("alarm", "G83 needs Q (peck depth)."); return; }
    if (c === 84) {
      const tt = toolOf(st.tool);
      if (tt && tt.pitch && Math.abs(st.F - st.S * tt.pitch) > 0.05 * st.F) msg("warn", `Tapping: F should be S × pitch = ${st.S} × ${tt.pitch} = ${r3(st.S * tt.pitch)} mm/min (now F${st.F}). Otherwise the thread is damaged.`, "tapF" + i);
    }
    const Rz = st.cr, Zb = st.cz, back = st.ret === 98 ? st.initZ : Rz;
    if (!lin("rapid", x, y, st.z)) return;
    if (!lin("rapid", x, y, Math.max(Rz, Math.min(st.z, Rz)))) return;
    if (c === 81) { if (lin("feed", x, y, Zb, st.F)) lin("rapid", x, y, back); }
    else if (c === 85 || c === 84) { if (lin("feed", x, y, Zb, st.F) && lin("feed", x, y, Rz, st.F)) lin("rapid", x, y, back); }
    else if (c === 83) {
      let cur = Rz, g = 0;
      while (cur > Zb + 1e-6 && g++ < 200) {
        const nx = Math.max(Zb, Math.min(cur, Rz - 0) - st.cq);
        if (cur < Rz && !lin("rapid", x, y, cur + 0.5)) return;
        if (!lin("feed", x, y, nx, st.F) || !lin("rapid", x, y, Rz)) return;
        cur = nx;
      }
      lin("rapid", x, y, back);
    }
  }

  for (i = 0; i < src.length; i++) {
    if (stop !== null || ended) break;
    const m0 = moves.length;
    let s = src[i];
    let comment = "";
    if (/^\s*%/.test(s)) { lines[i] = { m0, m1: m0, t, st: { ...st }, words: [], marker: true }; continue; }
    if (fan) s = s.replace(/\(([^)]*)\)/g, (_, c) => { comment += c; return " "; });
    const sc = s.indexOf(";"); if (sc >= 0) { comment += s.slice(sc + 1); s = s.slice(0, sc); }
    s = s.toUpperCase();
    const words = [];
    const re = /([A-Z]+)\s*=?\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;
    let mm;
    while ((mm = re.exec(s))) words.push({ a: mm[1], v: parseFloat(mm[2]), raw: mm[2], dot: mm[2].includes(".") });
    const left = s.replace(re, "").trim();
    if (left) msg("warn", `Cannot read "${left}" - ignored by this simulator.`);
    const Wd = {}, G = [], M = [];
    for (const w of words) {
      if (w.a === "G") G.push(w.v);
      else if (w.a === "M") M.push(w.v);
      else if (Wd[w.a] !== undefined) msg("warn", `The address ${w.a} appears twice in one block; the last one is used.`);
      if (w.a !== "G" && w.a !== "M") Wd[w.a] = w;
    }
    const known = fan ? "NOXYZIJRQPFSTHK" : "NXYZIJRQPFSTDK";
    for (const w of words) {
      if (w.a === "G" || w.a === "M" || w.a === "SPOS" || (w.a.length === 1 && known.includes(w.a))) continue;
      msg("warn", `Address ${w.a} is not supported by this simulator - ignored.`);
    }
    if (fan) for (const a of ["X", "Y", "Z", "I", "J", "R", "Q"]) {
      const w = Wd[a];
      if (w && !w.dot && w.v !== 0) msg("warn", `${a}${w.raw} has no decimal point. Many Fanuc controls read it as ${a}${w.v / 1000} (= ${w.v / 1000} mm)! Write ${a}${w.raw}. to mean ${w.v} mm.`, "dot" + i);
    }
    // ---- non-motion words, in the order a real control executes them
    if (Wd.F) { st.F = Wd.F.v; if (st.F > mach.maxFeed) { msg("warn", `F${st.F} is above the machine maximum ${mach.maxFeed} mm/min - limited.`); st.F = mach.maxFeed; } }
    if (Wd.S) { st.S = Wd.S.v; if (st.S > mach.maxRpm) { msg("warn", `S${st.S} is above the maximum spindle speed ${mach.maxRpm} rpm - limited.`); st.S = mach.maxRpm; } }
    if (Wd.T) st.nextT = Wd.T.v;
    if (M.includes(6)) {
      if (!st.nextT) msg("warn", "M6 without a T number - no tool changed.");
      else {
        if (st.z < mach.zHome) lin("rapid", st.x, st.y, mach.zHome);
        const tt = toolOf(st.nextT);
        if (!tt) msg("warn", `T${st.nextT} is not in the tool table - the simulator uses a Ø10 end mill.`);
        st.tool = st.nextT; tinfo = tt ? { d: tt.d, type: tt.type } : { d: 10, type: "end" };
        if (fan) st.H = false;
        if (stop === null) push(mk("tc", [[st.x, st.y, st.z], [st.x, st.y, st.z]], 0, mach.tc));
      }
    }
    if (Wd.SPOS) { st.sp = 0; st.spos = true; }
    for (const c of M) {
      if (c === 3 || c === 4) { st.sp = c; st.spos = false; if (!st.S) msg("warn", "Spindle started without an S speed."); }
      else if (c === 5) st.sp = 0;
      else if (c === 8) st.cool = true;
      else if (c === 9) st.cool = false;
      else if (c === 29) st.rigid = true;
      else if (![0, 1, 2, 6, 30].includes(c)) msg("warn", `M${c} is not known by this simulator - ignored.`);
    }
    if (Wd.D) st.H = Wd.D.v !== 0;
    let home = false, cycNew = false, dwell = 0;
    for (const g of G) {
      if (g === 0 || g === 1 || g === 2 || g === 3) { st.mot = g; st.cyc = null; }
      else if (g === 4) {
        dwell = fan ? (Wd.P ? Wd.P.v / 1000 : Wd.X ? Wd.X.v : 0) : (Wd.F ? Wd.F.v : 0);
      }
      else if (g === 17) { /* XY plane */ }
      else if (g === 18 || g === 19) msg("alarm", `G${g} (other plane) is not simulated - only G17 (XY).`);
      else if (g === 21 && fan) { /* mm */ }
      else if (g === 71 && !fan) { /* mm */ }
      else if ((g === 20 && fan) || (g === 70 && !fan)) msg("alarm", "Inch programs are not supported here - use millimetres.");
      else if (g === 28 || (g === 75 && !fan)) home = true;
      else if (g === 40) { /* comp off */ }
      else if (g === 41 || g === 42) msg("warn", `G${g} cutter radius compensation is not simulated: the preview shows the programmed path, not the offset path.`, "g41");
      else if (g === 43 && fan) { if (!Wd.H) msg("alarm", "G43 needs an H number (tool length offset)."); else { st.H = true; if (Wd.H.v !== st.tool) msg("warn", `G43 H${Wd.H.v} is used with tool T${st.tool}. Normally H = tool number - a wrong H means a wrong tool length = crash.`); } }
      else if (g === 49) st.H = false;
      else if (g >= 54 && g <= 59) { if (g !== 54) msg("info", `G${g}: this simulator has one work zero; G${g} is treated like G54.`, "wcs"); st.wcs = g; }
      else if (g === 80) { st.cyc = null; st.mot = 80; }
      else if (fan && (g === 81 || g === 83 || g === 84 || g === 85)) { if (st.cyc === null) { st.initZ = st.z; } st.cyc = g; st.mot = g; cycNew = true; if (g === 84 && !st.rigid) msg("info", "Rigid tapping normally needs M29 S.. before G84 (Fanuc).", "m29"); }
      else if (fan && [73, 76, 82, 86, 87, 88, 89].includes(g)) msg("alarm", `Canned cycle G${g} is not simulated here (supported: G81, G83, G84, G85).`);
      else if (g === 90) st.abs = true;
      else if (g === 91) st.abs = false;
      else if (g === 94) { /* mm/min */ }
      else if (g === 95) msg("warn", "G95 (feed per revolution) is not simulated - F is read as mm/min.", "g95");
      else if (g === 98) st.ret = 98;
      else if (g === 99) st.ret = 99;
      else if (!fan && (g === 331 || g === 332)) { st.mot = g; st.cyc = null; }
      else if (IGNORE_G.has(g)) { /* harmless */ }
      else msg("warn", `G${g} is not known by this simulator - ignored.`);
    }
    if (stop === null && st.cyc) { if (Wd.Z) st.cz = st.abs ? Wd.Z.v : st.z + Wd.Z.v; if (Wd.R) st.cr = Wd.R.v; if (Wd.Q) st.cq = Wd.Q.v; }
    // ---- motion
    const tgt = (a, cur) => (Wd[a] ? (st.abs ? Wd[a].v : cur + Wd[a].v) : cur);
    const hasXYZ = !!(Wd.X || Wd.Y || Wd.Z);
    if (stop === null) {
      if (dwell > 0) push(mk("dwell", [[st.x, st.y, st.z], [st.x, st.y, st.z]], 0, dwell));
      if (home) {
        const ix = tgt("X", st.x), iy = tgt("Y", st.y), iz = tgt("Z", st.z);
        if (lin("rapid", ix, iy, iz)) lin("rapid", Wd.X ? 0 : ix, Wd.Y ? 0 : iy, Wd.Z ? mach.zHome : iz);
      } else if (st.cyc && (Wd.X || Wd.Y || (cycNew && hasXYZ))) {
        if (!st.S || st.sp === 0) msg("warn", "Drilling cycle with the spindle stopped.", "cycsp");
        cycleAt(tgt("X", st.x), tgt("Y", st.y));
      } else if ((st.mot === 331 || st.mot === 332) && Wd.Z) {
        const k = Wd.K ? Wd.K.v : 0;
        if (!k) msg("alarm", "G331/G332 needs K (thread pitch).");
        else lin("feed", st.x, st.y, tgt("Z", st.z), Math.max(1, st.S * k));
      } else if (hasXYZ || ((st.mot === 2 || st.mot === 3) && (Wd.I || Wd.J))) {
        const x = tgt("X", st.x), y = tgt("Y", st.y), z = tgt("Z", st.z);
        if (st.mot === 2 || st.mot === 3) doArc(st.mot, x, y, z, Wd.I?.v, Wd.J?.v, Wd.R?.v, st.F);
        else if (st.mot === 1) lin("feed", x, y, z, st.F);
        else {
          if (st.mot !== 0) msg("warn", "Axis move without an active motion code (after G80). Write G0 or G1 - the simulator uses G0.");
          lin("rapid", x, y, z);
        }
      }
    }
    if (M.includes(30) || M.includes(2)) ended = true;
    lines[i] = { m0, m1: moves.length, t, st: { ...st }, words, comment };
  }
  if (stop === null && !ended) { i = src.length - 1; msg("warn", "The program has no end code (M30). The control would stop at the last line without rewinding."); }
  if (stop !== null) msgs.push({ i: stop, lvl: "info", text: `Program stopped at line ${stop + 1} by the alarm above. Lines after it were not executed.` });
  const sum = { total: t, cut: 0, rapid: 0, tc: 0, dwell: 0, cutLen: 0, rapidLen: 0, tcs: 0 };
  for (const m of moves) {
    if (m.kind === "feed") { sum.cut += m.dur; sum.cutLen += m.len; }
    else if (m.kind === "rapid") { sum.rapid += m.dur; sum.rapidLen += m.len; }
    else if (m.kind === "tc") { sum.tc += m.dur; sum.tcs++; }
    else sum.dwell += m.dur;
  }
  return { moves, msgs, lines, sum, stop, src };
}

/* ------------------------------------------------------------------ 3. 3D preview (WebGL via Three.js) */
function createView(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 20000);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(300, 600, 450); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(-400, 150, -300); scene.add(fill);
  const work = new THREE.Group(); scene.add(work);
  const C_RAW = new THREE.Color("#5a5f66"), C_CUT = new THREE.Color("#e8edf2"), C_FEED = new THREE.Color("#2a78d6"), C_DONE = new THREE.Color("#a7b0ba");
  let hm = null, perim = null, Nt = 0, stockGeo = null, stockMesh = null, rapidLines = null, feedLines = null, feedRanges = [];
  let sim = null, cursor = { mi: 0, d: 0 }, dirty = false, doneMi = -1, tool = null, toolKey = "", axes = null;
  const cache = new Map();

  function bg() {
    const cs = getComputedStyle(document.documentElement);
    scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed"); if (window.dtTheme) window.dtTheme.scene(scene);
  }
  function clear() {
    while (work.children.length) {
      const o = work.children.pop();
      o.traverse((c) => { if (c.geometry && !c.userData.keep) c.geometry.dispose(); });
    }
  }
  function textSprite(t, color) {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"); g.font = "bold 46px system-ui, sans-serif"; g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(t, 32, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    sp.renderOrder = 10; return sp;
  }
  function buildStock() {
    const { nx, ny, dx, dy, x0, y0, top, bot } = hm;
    Nt = (nx + 1) * (ny + 1);
    perim = [];
    for (let i = 0; i < nx; i++) perim.push(i);
    for (let j = 0; j < ny; j++) perim.push(j * (nx + 1) + nx);
    for (let i = nx; i > 0; i--) perim.push(ny * (nx + 1) + i);
    for (let j = ny; j > 0; j--) perim.push(j * (nx + 1));
    const P = perim.length, V = Nt + 2 * P + 4;
    const pos = new Float32Array(V * 3), col = new Float32Array(V * 3);
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { const k = j * (nx + 1) + i; pos[k * 3] = x0 + i * dx; pos[k * 3 + 1] = y0 + j * dy; pos[k * 3 + 2] = top; }
    perim.forEach((g, k) => {
      for (const [v, z] of [[Nt + k, top], [Nt + P + k, bot]]) { pos[v * 3] = pos[g * 3]; pos[v * 3 + 1] = pos[g * 3 + 1]; pos[v * 3 + 2] = z; }
    });
    const cb = Nt + 2 * P;
    [[x0, y0], [x0 + hm.w, y0], [x0 + hm.w, y0 + hm.l], [x0, y0 + hm.l]].forEach(([x, y], q) => { pos[(cb + q) * 3] = x; pos[(cb + q) * 3 + 1] = y; pos[(cb + q) * 3 + 2] = bot; });
    for (let v = 0; v < V; v++) { col[v * 3] = C_RAW.r; col[v * 3 + 1] = C_RAW.g; col[v * 3 + 2] = C_RAW.b; }
    const idx = new Uint32Array(nx * ny * 6 + P * 6 + 6); let q = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = d; idx[q++] = a; idx[q++] = d; idx[q++] = c;
    }
    for (let k = 0; k < P; k++) {
      const tA = Nt + k, tB = Nt + ((k + 1) % P), bA = Nt + P + k, bB = Nt + P + ((k + 1) % P);
      idx[q++] = bA; idx[q++] = bB; idx[q++] = tB; idx[q++] = bA; idx[q++] = tB; idx[q++] = tA;
    }
    idx[q++] = cb; idx[q++] = cb + 2; idx[q++] = cb + 1; idx[q++] = cb; idx[q++] = cb + 3; idx[q++] = cb + 2;
    stockGeo = new THREE.BufferGeometry();
    stockGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    stockGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    stockGeo.setIndex(new THREE.BufferAttribute(idx, 1));
    stockGeo.computeVertexNormals();
    stockMesh = new THREE.Mesh(stockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.6, transparent: false, opacity: 0.35 }));
    work.add(stockMesh);
  }
  function updateStock() {
    const pa = stockGeo.attributes.position.array, ca = stockGeo.attributes.color.array, H = hm.H, lim = hm.top - 0.01;
    const setC = (v, cut) => { const c = cut ? C_CUT : C_RAW; ca[v * 3] = c.r; ca[v * 3 + 1] = c.g; ca[v * 3 + 2] = c.b; };
    for (let k = 0; k < Nt; k++) { pa[k * 3 + 2] = H[k]; setC(k, H[k] < lim); }
    perim.forEach((g, k) => { pa[(Nt + k) * 3 + 2] = H[g]; setC(Nt + k, H[g] < lim); });
    stockGeo.attributes.position.needsUpdate = true; stockGeo.attributes.color.needsUpdate = true;
    stockGeo.computeVertexNormals();
  }
  function buildPaths() {
    const rp = [], fp = [];
    feedRanges = [];
    sim.moves.forEach((m, mi) => {
      if (m.kind !== "rapid" && m.kind !== "feed") return;
      const arr = m.kind === "rapid" ? rp : fp, v0 = fp.length / 3;
      for (let k = 0; k < m.pts.length - 1; k++) arr.push(...m.pts[k], ...m.pts[k + 1]);
      if (m.kind === "feed") feedRanges[mi] = [v0, fp.length / 3];
    });
    const rg = new THREE.BufferGeometry(); rg.setAttribute("position", new THREE.Float32BufferAttribute(rp, 3));
    rapidLines = new THREE.LineSegments(rg, new THREE.LineDashedMaterial({ color: 0xe0782f, dashSize: 3, gapSize: 2.5 }));
    rapidLines.computeLineDistances();
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.Float32BufferAttribute(fp, 3));
    const fc = new Float32Array(fp.length); for (let v = 0; v < fp.length / 3; v++) { fc[v * 3] = C_FEED.r; fc[v * 3 + 1] = C_FEED.g; fc[v * 3 + 2] = C_FEED.b; }
    fg.setAttribute("color", new THREE.BufferAttribute(fc, 3));
    feedLines = new THREE.LineSegments(fg, new THREE.LineBasicMaterial({ vertexColors: true }));
    work.add(rapidLines, feedLines);
    doneMi = -1;
  }
  function color(mi, c) {
    const r = feedRanges[mi]; if (!r) return;
    const a = feedLines.geometry.attributes.color.array;
    for (let v = r[0]; v < r[1]; v++) { a[v * 3] = c.r; a[v * 3 + 1] = c.g; a[v * 3 + 2] = c.b; }
  }
  function markDone(mi) {
    if (!feedLines) return;
    if (mi - 1 < doneMi) { for (let k = 0; k <= doneMi; k++) color(k, C_FEED); doneMi = -1; }
    for (let k = doneMi + 1; k < mi; k++) color(k, C_DONE);
    if (mi - 1 !== doneMi) feedLines.geometry.attributes.color.needsUpdate = true;
    doneMi = Math.max(doneMi, mi - 1);
  }
  function toolMesh(type, d) {
    const key = type + d;
    if (cache.has(key)) return cache.get(key);
    const g = new THREE.Group(), r = d / 2;
    const cutM = new THREE.MeshStandardMaterial({ color: type === "face" ? 0x9aa4ae : 0xd4a23c, metalness: 0.6, roughness: 0.35 });
    const holdM = new THREE.MeshStandardMaterial({ color: 0x3c4148, metalness: 0.5, roughness: 0.45 });
    const cyl = (rad, h, z, m, rt) => {
      const geo = new THREE.CylinderGeometry(rt ?? rad, rad, h, 32); geo.rotateX(Math.PI / 2);
      const me = new THREE.Mesh(geo, m); me.position.z = z; me.userData.keep = true; me.geometry.userData = {}; g.add(me); return me;
    };
    const Lc = type === "face" ? Math.max(12, d * 0.35) : Math.max(d * 2.5, 22);
    if (type === "drill") {
      const tipH = 0.3 * d, geo = new THREE.ConeGeometry(r, tipH, 32); geo.rotateX(-Math.PI / 2);
      const tip = new THREE.Mesh(geo, cutM); tip.position.z = tipH / 2; tip.userData.keep = true; g.add(tip);
      cyl(r, Lc - tipH, tipH + (Lc - tipH) / 2, cutM);
    } else if (type === "bore") {
      cyl(Math.max(3, r * 0.45), Lc, Lc / 2, holdM);
      const ins = new THREE.Mesh(new THREE.BoxGeometry(r - Math.max(3, r * 0.45) + 1, 4, 5), cutM);
      ins.position.set(r - (r - Math.max(3, r * 0.45) + 1) / 2, 0, 2.5); ins.userData.keep = true; g.add(ins);
    } else cyl(r, Lc, Lc / 2, cutM);
    const sh = type === "face" ? Math.max(11, r * 0.45) : Math.max(4, Math.min(r, 10));
    cyl(sh, 25, Lc + 12.5, holdM);
    const hr = Math.max(sh * 1.8, 22);
    cyl(hr, 35, Lc + 25 + 17.5, holdM, hr * 0.75);
    g.traverse((c) => { c.userData.keep = true; });
    cache.set(key, g);
    return g;
  }
  function setTool(type, d) {
    const key = type + d;
    if (key === toolKey) return;
    if (tool) work.remove(tool);
    tool = d > 0 ? toolMesh(type, d) : null;
    if (tool) work.add(tool);
    toolKey = key;
  }
  function sweepMove(mi, d0, d1) {
    const m = sim.moves[mi];
    if (!m || (m.kind !== "rapid" && m.kind !== "feed") || !m.r) return;
    const stp = Math.min(hm.dx, hm.dy) * 0.8;
    sweep(m.pts, m.cum, d0, d1, stp, (x, y, z) => { if (z < hm.top && hm.stamp(x, y, z, m.r) > 0) dirty = true; });
  }
  function advanceTo(mi, d) {
    if (mi < cursor.mi || (mi === cursor.mi && d < cursor.d - 1e-6)) { hm.reset(); cursor = { mi: 0, d: 0 }; dirty = true; }
    while (cursor.mi < mi) { sweepMove(cursor.mi, cursor.d, Infinity); cursor.mi++; cursor.d = 0; }
    if (d > cursor.d) { sweepMove(mi, cursor.d, d); cursor.d = d; }
  }
  function fit() {
    const box = new THREE.Box3().setFromObject(stockMesh);
    if (feedLines && feedLines.geometry.attributes.position.count) box.union(new THREE.Box3().setFromObject(feedLines));
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()).length();
    const dir = new THREE.Vector3(0.75, 0.85, 1.25).normalize();
    camera.position.copy(c).addScaledVector(dir, size * 1.35 + 40);
    camera.near = Math.max(0.5, size / 200); camera.far = size * 60; camera.updateProjectionMatrix();
    nice.stop(); controls.target.copy(c); controls.update();
  }
  return {
    load(simIn, S) {
      sim = simIn; clear(); bg(); tool = null; toolKey = "";
      const mach = MACHINES[S.machine];
      work.rotation.set(mach.kind === "hmc" ? 0 : -Math.PI / 2, 0, 0);
      const { w, l, h, top } = S.stock;
      hm = new Heightmap(w, l, top, top - h, Math.max(0.35, Math.max(w, l) / 220));
      buildStock();
      const fix = new THREE.Mesh(new THREE.BoxGeometry(w + 70, l + 70, 14), new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.3, roughness: 0.7 }));
      fix.position.z = top - h - 7; work.add(fix);
      buildPaths();
      axes = new THREE.Group();
      const L = Math.max(18, Math.min(w, l) * 0.22);
      [[1, 0, 0, 0xd03b3b, "X"], [0, 1, 0, 0x0ca30c, "Y"], [0, 0, 1, 0x2a78d6, "Z"]].forEach(([x, y, z, c, t]) => {
        const a = new THREE.ArrowHelper(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 0, 0), L, c, L * 0.22, L * 0.12);
        a.line.material.depthTest = false; a.cone.material.depthTest = false; a.renderOrder = 9; axes.add(a);
        const sp = textSprite(t, "#" + c.toString(16).padStart(6, "0")); sp.position.set(x * L * 1.2, y * L * 1.2, z * L * 1.2); sp.scale.set(L * 0.4, L * 0.4, 1); axes.add(sp);
      });
      work.add(axes);
      cursor = { mi: 0, d: 0 }; dirty = true;
      fit();
    },
    setTime(T) {
      const ms = sim.moves;
      if (!ms.length) { setTool("end", 0); return { mi: -1, p: null, m: null }; }
      let lo = 0, hi = ms.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ms[mid].t0 <= T) lo = mid; else hi = mid - 1; }
      const m = ms[lo], f = m.dur > 0 ? clamp((T - m.t0) / m.dur, 0, 1) : 1, d = f * m.len;
      const p = pointAt(m, d);
      advanceTo(lo, d); markDone(lo);
      const tt = m.tool ? m.tt : "end", td = m.tool ? m.r * 2 : 0;
      setTool(tt, td);
      if (tool) tool.position.set(p[0], p[1], p[2]);
      return { mi: lo, p, m };
    },
    show(o) { if (rapidLines) rapidLines.visible = o.path; if (feedLines) feedLines.visible = o.path; if (stockMesh) { stockMesh.material.transparent = o.xray; stockMesh.material.depthWrite = !o.xray; stockMesh.material.needsUpdate = true; } },
    fit,
    render() {
      if (dirty && stockGeo) { updateStock(); dirty = false; }
      controls.update(); renderer.render(scene, camera);
    },
    resize() {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    bg,
  };
}

/* ------------------------------------------------------------------ UI */
const pane = $("tab-cnc");
let S = null;
try { S = JSON.parse(localStorage.getItem("gcState") || "null"); } catch (e) { S = null; }
if (!S || !S.stock || !Array.isArray(S.ops) || !MACHINES[S.machine]) S = TEMPLATES.cyl();
let sel = 0, custom = null, gen = null, sim = null, view = null, T = 0, playing = false, speed = 10, curLine = -1, selLine = -1;
const save = () => { try { localStorage.setItem("gcState", JSON.stringify(S)); } catch (e) { /* private window */ } };
let twin = {};

function fillSelect(el, items, val) { el.innerHTML = items.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(val) ? " selected" : ""}>${esc(t)}</option>`).join(""); }
function renderSetup() {
  fillSelect($("gcTpl"), Object.entries(TPL_NAMES), S.tpl || "cyl");
  fillSelect($("gcMach"), Object.keys(MACHINES).map((k) => [k, `${k} – ${MACHINES[k].name} (${MACHINES[k].kind === "hmc" ? "horizontal" : "vertical"})`]), S.machine);
  fillSelect($("gcCtrl"), [["fanuc", "Fanuc / Haas (ISO)"], ["siemens", "Siemens Sinumerik 840D"]], S.ctrl);
  fillSelect($("gcMat"), Object.entries(MATS).map(([k, m]) => [k, m.name]), S.mat);
  $("gcProgNo").value = S.progNo; $("gcProgName").value = S.progName; $("gcNums").checked = !!S.nums;
  for (const k of ["w", "l", "h", "top"]) $("gcS_" + k).value = S.stock[k];
}
function renderTools() {
  $("gcTools").innerHTML = `<thead><tr><th>T</th><th>Type</th><th>Ø D (mm)</th><th>Flutes z</th><th>Pitch (tap)</th><th></th></tr></thead><tbody>` +
    S.tools.map((t, k) => `<tr data-k="${k}">
      <td><input type="number" min="1" max="99" step="1" data-tk="t" value="${t.t}" style="width:52px" aria-label="Tool number"></td>
      <td><select data-tk="type" aria-label="Tool type">${Object.entries(TT).map(([v, n]) => `<option value="${v}"${v === t.type ? " selected" : ""}>${n}</option>`).join("")}</select></td>
      <td><input type="number" min="0.5" step="any" data-tk="d" value="${t.d}" aria-label="Diameter"></td>
      <td><input type="number" min="1" step="1" data-tk="z" value="${t.z ?? 1}" aria-label="Flutes"></td>
      <td>${t.type === "tap" ? `<input type="number" min="0.2" step="any" data-tk="pitch" value="${t.pitch ?? 1}" aria-label="Pitch">` : '<span class="muted">–</span>'}</td>
      <td><button class="btn ghost" data-tdel="${k}" title="Remove tool" aria-label="Remove tool">✕</button></td></tr>`).join("") + "</tbody>";
}
function toolOptions(op) {
  const ok = OPK[op.kind].tools;
  return `<option value="">– choose –</option>` + S.tools.filter((t) => ok.includes(t.type))
    .map((t) => `<option value="${t.t}"${String(t.t) === String(op.tool) ? " selected" : ""}>T${t.t} ${TT[t.type]} Ø${t.d}${t.type === "tap" ? "×" + t.pitch : ""}</option>`).join("");
}
function renderOps() {
  $("gcOps").innerHTML = S.ops.map((op, k) => {
    const tool = S.tools.find((t) => String(t.t) === String(op.tool));
    const ty = tool ? tool.type : OPK[op.kind].tools[0];
    const fzLabel = ty === "tap" ? "" : ty === "drill" || ty === "bore" ? "f (mm/rev)" : "fz (mm/tooth)";
    const f = FIELDS[op.kind].filter(([key]) => fieldVisible(op, key)).map(([key, label, unit, def, opts]) => {
      const v = op[key] ?? def;
      if (opts) return `<label class="gc-f">${label}<select data-ok="${key}">${opts.map((o) => `<option${o === v ? " selected" : ""}>${o}</option>`).join("")}</select></label>`;
      if (key === "pts") return `<label class="gc-f gc-wide">${label}<input type="text" data-ok="${key}" value="${esc(v)}"></label>`;
      return `<label class="gc-f">${label}${unit ? ` <span class="muted">(${unit})</span>` : ""}<input type="number" step="any" data-ok="${key}" value="${esc(v)}"></label>`;
    }).join("");
    return `<div class="gc-op${op.on ? "" : " off"}${k === sel ? " sel" : ""}" data-k="${k}">
      <div class="gc-op-h"><b>OP${k + 1}</b><span class="gc-op-name">${OPK[op.kind].label}</span><span class="sp"></span>
        <label class="tb-check"><input type="checkbox" data-on${op.on ? " checked" : ""}> on</label>
        <button class="btn ghost" data-mv="-1" title="Move up" aria-label="Move up"${k === 0 ? " disabled" : ""}>↑</button>
        <button class="btn ghost" data-mv="1" title="Move down" aria-label="Move down"${k === S.ops.length - 1 ? " disabled" : ""}>↓</button>
        <button class="btn ghost" data-del title="Remove operation" aria-label="Remove operation">✕</button></div>
      <div class="gc-fields"><label class="gc-f gc-f2">Tool<select data-ok="tool">${toolOptions(op)}</select></label>${f}
        <label class="gc-f">Vc <span class="muted">(m/min)</span><input type="number" step="any" data-ok="vc" value="${op.vc ?? ""}" placeholder="auto"></label>
        ${fzLabel ? `<label class="gc-f">${fzLabel}<input type="number" step="any" data-ok="fz" value="${op.fz ?? ""}" placeholder="auto"></label>` : ""}
      </div>
      <div class="gc-calc" id="gcCalc${k}"></div></div>`;
  }).join("") || `<p class="muted">No operations yet. Add one below.</p>`;
}

function opCalc(k) {
  const info = gen && gen.opInfo[k], op = S.ops[k];
  if (!op || !op.on) return { html: '<span class="muted">switched off – not in the program</span>' };
  if (!info || !info.cd) return { html: (info && info.warn.length ? info.warn : ["–"]).map((w) => `<div class="gc-warn">⚠ ${esc(w)}</div>`).join("") };
  const cd = info.cd, tool = info.tool, mat = MATS[S.mat], mach = MACHINES[S.machine];
  let time = 0;
  if (sim) for (const m of sim.moves) if (m.i >= info.start && m.i < info.end) time += m.dur;
  let mrr = null, pc = null;
  if (tool.type === "face" || tool.type === "end") { if (info.ap && info.ae) { mrr = (info.ap * info.ae * cd.F) / 1000; pc = (info.ap * info.ae * cd.F * mat.kc) / 60e6; } }
  else if (tool.type === "drill") { mrr = (Math.PI * tool.d * tool.d / 4 * cd.F) / 1000; pc = (cd.fz * cd.vcReal * tool.d * mat.kc) / 240e3; }
  const parts = [`S = <b>${cd.n}</b> rpm`, `F = <b>${fx(cd.F, 2)}</b> mm/min`];
  if (info.cycle) parts.push(`cycle <b>G${info.cycle}</b>`);
  if (mrr !== null) parts.push(`Q = ${fx(mrr)} cm³/min`);
  if (pc !== null) parts.push(`Pc ≈ <b>${fx(pc, 2)}</b> kW`);
  parts.push(`time <b>${mmss(time)}</b>`);
  const warn = [...info.warn];
  const pav = availKw(mach, cd.n);
  if (pc !== null && pc > pav * 0.8) warn.push(`Needs ${fx(pc, 1)} kW but the spindle gives only about ${fx(pav, 1)} kW at ${cd.n} rpm (example${pav < mach.powerKw ? `, torque limit ${mach.torqueNm} N·m below the base speed` : ""}): reduce ap, ae or the feed.`);
  return { html: parts.join(" · ") + warn.map((w) => `<div class="gc-warn">⚠ ${esc(w)}</div>`).join(""), cd, tool, info, mrr, pc, time };
}
function renderCalcs() { S.ops.forEach((_, k) => { const el = $("gcCalc" + k); if (el) el.innerHTML = opCalc(k).html; }); renderFormula(); }

function renderFormula() {
  const el = $("gcFormula");
  const op = S.ops[sel];
  if (!op) { el.innerHTML = '<p class="muted">Add an operation to see its cutting data calculation.</p>'; return; }
  const c = opCalc(sel);
  if (!c.cd) { el.innerHTML = `<p class="muted">OP${sel + 1}: ${c.html}</p>`; return; }
  const { cd, tool, info } = c, mat = MATS[S.mat], mach = MACHINES[S.machine];
  const L = [];
  L.push(`<b>OP${sel + 1} ${OPK[op.kind].label}</b> – T${tool.t} ${TT[tool.type]} Ø${tool.d} – ${mat.name}`);
  L.push("");
  L.push(`Spindle speed   n = 1000 · Vc / (π · D) = 1000 · ${cd.vc} / (π · ${tool.d}) = <b>${fx((1000 * cd.vc) / (Math.PI * tool.d), 0)} rpm</b>${cd.limited ? `  → limited to machine max <b>${cd.n}</b>` : ""}`);
  if (tool.type === "tap") {
    L.push(`Feed (tapping)  F = n · pitch = ${cd.n} · ${tool.pitch} = <b>${fx(cd.F, 2)} mm/min</b>   (must be exact: 1 turn = 1 pitch)`);
  } else if (tool.type === "drill" || tool.type === "bore") {
    L.push(`Feed            F = n · f = ${cd.n} · ${cd.fz} = <b>${cd.F} mm/min</b>`);
  } else {
    L.push(`Feed            F = n · z · fz = ${cd.n} · ${tool.z} · ${cd.fz} = <b>${cd.F} mm/min</b>`);
  }
  if (tool.type === "drill") {
    L.push(`Drill point     tip = 0.3 · D = 0.3 · ${tool.d} = ${info.tip} mm  (118° point)  →  Z = top − depth − tip = <b>${info.zb}</b>`);
    if (c.pc !== null) L.push(`Power           Pc = f · Vc · D · kc / 240 000 = ${cd.fz} · ${fx(cd.vcReal, 0)} · ${tool.d} · ${mat.kc} / 240 000 = <b>${fx(c.pc, 2)} kW</b>  (machine ≈ ${fx(availKw(mach, cd.n), 1)} kW at ${cd.n} rpm)`);
  }
  if ((tool.type === "face" || tool.type === "end") && c.mrr !== null) {
    L.push(`Metal removal   Q = ap · ae · F / 1000 = ${fx(info.ap, 2)} · ${fx(info.ae, 2)} · ${cd.F} / 1000 = <b>${fx(c.mrr)} cm³/min</b>${info.aeNote ? `  (${info.aeNote})` : ""}`);
    L.push(`Cutting power   Pc = Q · kc / 60 000 = ${fx(c.mrr)} · ${mat.kc} / 60 000 = <b>${fx(c.pc, 2)} kW</b>  (machine ≈ ${fx(availKw(mach, cd.n), 1)} kW at ${cd.n} rpm, kc = specific cutting force)`);
  }
  L.push(`Time            t = path length / F · 60 + rapid moves  →  <b>${mmss(c.time)}</b> for this operation`);
  el.innerHTML = `<div class="gc-formula">${L.join("\n")}</div><p class="hint">Vc, fz and kc are example values for ${esc(mat.name)} with carbide tools. Real values come from the tool supplier's catalogue. Type your own Vc / fz in the operation card to override them.</p>`;
}

// ---- G-code listing
function wordClass(a) {
  if (a === "G") return "gw-g"; if (a === "M") return "gw-m"; if ("XYZ".includes(a)) return "gw-ax"; if ("IJKRQ".includes(a)) return "gw-ij";
  if (a === "F" || a === "S") return "gw-fs"; if (a === "T" || a === "H" || a === "D") return "gw-t"; if (a === "N") return "gw-n"; if (a === "O") return "gw-o";
  return "gw-x";
}
function colorLine(raw) {
  if (/^\s*%/.test(raw)) return `<span class="gw-o">${esc(raw)}</span>`;
  const fan = S.ctrl === "fanuc";
  let code = raw, com = "";
  const sc = raw.indexOf(";");
  if (sc >= 0) { code = raw.slice(0, sc); com = raw.slice(sc); }
  const segs = fan ? code.split(/(\([^)]*\))/) : [code];
  return segs.map((sg) => sg.startsWith("(") ? `<span class="gw-c">${esc(sg)}</span>` :
    esc(sg).replace(/([A-Za-z]+)(\s*=?\s*)([-+]?(?:\d+\.?\d*|\.\d+))/g, (m, a, eq, v) => `<span class="${wordClass(a.toUpperCase())}">${a}${eq}${v}</span>`)).join("") +
    (com ? `<span class="gw-c">${esc(com)}</span>` : "");
}
function renderCode() {
  const errLines = new Set(sim.msgs.filter((m) => m.lvl === "alarm" || m.lvl === "crash").map((m) => m.i));
  $("gcCode").innerHTML = sim.src.map((raw, i) => `<div class="gc-ln${sim.lines[i] ? "" : " dead"}${errLines.has(i) ? " err" : ""}" data-i="${i}"><span class="gc-no">${i + 1}</span><span class="gc-tx">${colorLine(raw) || " "}</span></div>`).join("");
  curLine = -1;
  $("gcBanner").hidden = custom === null;
}
function renderMsgs() {
  const m = sim.msgs, el = $("gcMsgs");
  if (!m.length) { el.innerHTML = `<div class="gc-ok">✓ No alarms and no warnings. The controller can run this program.</div>`; return; }
  el.innerHTML = m.map((x) => `<div class="gc-msg" data-i="${x.i}"><span class="gc-lvl ${x.lvl}">${{ alarm: "ALARM", crash: "CRASH", warn: "WARNING", info: "INFO" }[x.lvl]}</span><span class="gc-msg-l">line ${x.i + 1}</span><span>${esc(x.text)}</span></div>`).join("");
}
function renderKpis() {
  const s = sim.sum, mach = MACHINES[S.machine];
  const al = sim.msgs.filter((m) => m.lvl === "alarm" || m.lvl === "crash").length, wn = sim.msgs.filter((m) => m.lvl === "warn").length;
  const tw = twin[S.machine];
  const k = [
    ["Cycle time (program)", mmss(s.total), "min:s · rapid moves at " + mach.rapid / 1000 + " m/min, no acceleration"],
    ["Cutting time", mmss(s.cut), fx(s.cutLen / 1000, 2) + " m tool path at feed"],
    ["Rapid + tool change", mmss(s.rapid + s.tc), `${s.tcs} tool changes × ${mach.tc} s`],
    ["Program", sim.src.length + " lines", (gen ? S.ops.filter((o) => o.on).length : 0) + " operations · " + (S.ctrl === "fanuc" ? "Fanuc/Haas" : "Siemens 840D")],
    ["Controller check", al ? al + " alarm" + (al > 1 ? "s" : "") : wn ? wn + " warning" + (wn > 1 ? "s" : "") : "OK", al ? "program stops" : wn ? "runs, but check the messages" : "no problems found"],
  ];
  if (tw) k.push(["Twin cycle time (MES)", mmss(tw), `${S.machine} in the twin (example). Program = ${fx((s.total / tw) * 100, 0)} %`]);
  $("gcKpis").innerHTML = k.map(([l, v, n], q) => `<div class="kpi"><div class="label">${l}</div><div class="value${q === 4 ? (al ? " gc-bad" : wn ? " gc-mid" : " gc-good") : ""}">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
}

function explain(i) {
  const el = $("gcExplain");
  const L = sim.lines[i], raw = sim.src[i] ?? "";
  if (i < 0) { el.innerHTML = '<p class="muted">Click a line in the program to see what each word means.</p>'; return; }
  const head = `<div class="gc-ex-line"><span class="gc-no">${i + 1}</span>${colorLine(raw)}</div>`;
  if (!L) { el.innerHTML = head + '<p class="muted">This line was not executed (the program stopped before it, or it is after M30).</p>'; return; }
  if (L.marker) { el.innerHTML = head + `<p>${S.ctrl === "fanuc" ? "% = start / end of the program file (tape marker)." : "Siemens file header: program name and folder in the control's memory."}</p>`; return; }
  const before = i > 0 ? (sim.lines.slice(0, i).reverse().find((x) => x) || { st: {} }).st : {};
  const st = L.st, inCyc = st.cyc && L.words.some((w) => w.a === "G" && [81, 83, 84, 85].includes(w.v)) || (st.cyc && before.cyc);
  const rows = [];
  for (const w of L.words) {
    const a = w.a, v = w.v;
    let t = "";
    if (a === "G") t = GEX[v] || `G${v}: not known by this simulator.`;
    else if (a === "M") t = MEX[v] || `M${v}: machine function (not known here).`;
    else if (a === "N") t = `Line number ${v} – only a label, the control does not need it.`;
    else if (a === "O") t = `Program number O${w.raw}. The MES / DNC calls the program by this number.`;
    else if ("XYZ".includes(a)) {
      if (inCyc && a === "Z") t = `Bottom of the hole: Z = ${v} mm.`;
      else if (L.words.some((x) => x.a === "G" && (x.v === 28 || x.v === 75))) t = `Intermediate point ${a}${w.raw} (with G91: 0 = stay where you are).`;
      else t = st.abs ? `Target position ${a} = ${v} mm from work zero.` : `Move ${v} mm in ${a} (incremental).`;
    }
    else if (a === "I") t = `Arc centre is ${v} mm away in X from the start point.`;
    else if (a === "J") t = `Arc centre is ${v} mm away in Y from the start point.`;
    else if (a === "R") t = inCyc ? `R level = ${v} mm: rapid down to here, then start feeding.` : `Arc radius ${v} mm.`;
    else if (a === "Q") t = `Peck depth: drill ${v} mm, then pull out to clear the chips.`;
    else if (a === "F") t = `Feed rate ${v} mm/min – how fast the tool moves while it cuts. Modal.`;
    else if (a === "S") t = `Spindle speed ${v} rpm. Modal.`;
    else if (a === "T") t = `Tool number ${v}: the magazine prepares this tool (M6 puts it in the spindle).`;
    else if (a === "H") t = `Tool length offset no. ${v}: the length of tool ${v}, measured by the tool presetter.`;
    else if (a === "D") t = `Siemens tool offset D${v}: length and radius of the active tool.`;
    else if (a === "K") t = `Thread pitch ${v} mm (one spindle turn = ${v} mm in Z).`;
    else if (a === "P") t = `Dwell time ${v} ms.`;
    else if (a === "SPOS") t = `Siemens: stop the spindle at angle ${v}° – needed before rigid tapping.`;
    else t = "Not known by this simulator.";
    rows.push(`<div class="gc-ex-w"><span class="${wordClass(a.length > 1 ? "x" : a)} gc-chip">${esc(a)}${a.length > 1 ? "=" : ""}${esc(w.raw)}</span><span>${esc(t)}</span></div>`);
  }
  if (L.comment) rows.push(`<div class="gc-ex-w"><span class="gw-c gc-chip">( … )</span><span>Comment for people – the control ignores it.</span></div>`);
  const mv = sim.moves.slice(L.m0, L.m1);
  let what = "";
  if (mv.length) {
    const len = mv.reduce((a, m) => a + m.len, 0), dur = mv.reduce((a, m) => a + m.dur, 0);
    const kinds = new Set(mv.map((m) => m.kind));
    what = kinds.has("tc") ? `Tool change: ${fx(dur, 1)} s.` :
      mv.length > 1 ? `${mv.length} moves (${[...kinds].join(" + ")}), ${fx(len, 1)} mm, ${fx(dur, 1)} s.` :
      `${mv[0].kind === "rapid" ? "Rapid move" : mv[0].kind === "feed" ? "Cutting move" : "Wait"}: ${fx(len, 1)} mm in ${fx(dur, 1)} s${mv[0].kind === "feed" ? ` at F${fx(mv[0].F, 2)}` : ""}.`;
  }
  const modal = [`G${st.mot === 80 ? 80 : st.mot}`, "G17", st.abs ? "G90" : "G91", "G" + st.wcs, st.H ? (S.ctrl === "fanuc" ? "G43" : "D1") : (S.ctrl === "fanuc" ? "G49" : "D0"), st.cyc ? "G" + st.cyc : "G80", "G" + st.ret];
  el.innerHTML = head + rows.join("") + (what ? `<p class="gc-ex-what"><b>What happens:</b> ${what}</p>` : "") +
    `<div class="gc-ex-state"><span class="muted">Controller state after this line:</span> ${modal.map((m) => `<span class="gc-chip gw-g">${m}</span>`).join(" ")}
     <span class="gc-chip gw-fs">F${fx(st.F, 2)}</span> <span class="gc-chip gw-fs">S${st.S}</span> <span class="gc-chip gw-t">T${st.tool}</span>
     <span class="gc-chip">${st.sp === 3 ? "spindle CW" : st.sp === 4 ? "spindle CCW" : "spindle off"}</span> <span class="gc-chip">${st.cool ? "coolant on" : "coolant off"}</span></div>
     <p class="hint">"Modal" = the value stays active in the controller until another code changes it. That is why many lines are short.</p>`;
}

// ---- playback
function apply() {
  if (!view || !sim) return;
  const r = view.setTime(T);
  const total = sim.sum.total;
  $("gcScrub").value = total > 0 ? Math.round((T / total) * 1000) : 0;
  $("gcTime").textContent = `${mmss(T)} / ${mmss(total)}`;
  const line = r.m ? r.m.i : -1;
  const st = line >= 0 && sim.lines[line] ? sim.lines[line].st : null;
  const p = r.p || [0, 0, MACHINES[S.machine].zHome];
  const cell = (l, v) => `<div>${l}<b>${v}</b></div>`;
  $("gcDro").innerHTML = cell("X", p[0].toFixed(3)) + cell("Y", p[1].toFixed(3)) + cell("Z", p[2].toFixed(3)) +
    cell("Feed F", r.m && r.m.kind === "feed" ? fx(r.m.F, 0) : r.m && r.m.kind === "rapid" ? "rapid" : "–") +
    cell("Spindle S", st ? (st.sp ? st.S : "off") : "off") + cell("Tool", st && st.tool ? "T" + st.tool : "–") +
    cell("Line", line >= 0 ? line + 1 : "–") + cell("Active", st ? `G${st.cyc || st.mot} ${st.abs ? "G90" : "G91"}` : "–");
  if (line !== curLine) {
    const c = $("gcCode");
    c.querySelector(".gc-ln.cur")?.classList.remove("cur");
    const row = c.querySelector(`.gc-ln[data-i="${line}"]`);
    if (row) {
      row.classList.add("cur");
      if (playing && (row.offsetTop < c.scrollTop || row.offsetTop > c.scrollTop + c.clientHeight - 24)) c.scrollTop = row.offsetTop - c.clientHeight / 3;
    }
    curLine = line;
  }
}
function setPlaying(p) { playing = p; $("gcPlay").textContent = p ? "❚❚ Pause" : "▶ Run"; }
function seekLine(i) {
  const L = sim.lines[i]; if (!L) return;
  setPlaying(false); T = Math.max(0, L.t - 1e-6); apply();
}

let regenTimer = 0;
function regen(soon) {
  clearTimeout(regenTimer);
  if (soon) { regenTimer = setTimeout(() => regen(false), 300); return; }
  save();
  gen = generate(S);
  const code = custom ?? gen.code;
  sim = interpret(code, S);
  renderCode(); renderMsgs(); renderKpis(); renderCalcs();
  if (view) { view.load(sim, S); view.show({ path: $("gcShowPath").checked, xray: $("gcXray").checked }); }
  setPlaying(false); T = sim.sum.total; apply();
  explain(selLine >= 0 && selLine < sim.src.length ? selLine : -1);
}
function rebuild() { renderSetup(); renderTools(); renderOps(); regen(false); }

function addOp(kind) {
  const op = { kind, on: true };
  for (const [key, , , def] of FIELDS[kind]) op[key] = def;
  let tool = S.tools.find((t) => OPK[kind].tools.includes(t.type));
  if (!tool) {
    const type = OPK[kind].tools[0], tn = Math.max(0, ...S.tools.map((t) => +t.t || 0)) + 1;
    tool = { t: tn, type, ...TOOL_DEF[type] }; S.tools.push(tool);
  }
  op.tool = tool.t;
  S.ops.push(op); sel = S.ops.length - 1;
  renderTools(); renderOps(); regen(false);
}

// ---- events
function bind() {
  $("gcTplLoad").addEventListener("click", () => {
    if (!confirm("Load this example? Your current operations will be replaced.")) return;
    S = TEMPLATES[$("gcTpl").value](); custom = null; sel = 0; selLine = -1; rebuild();
  });
  $("gcMach").addEventListener("change", (e) => { S.machine = e.target.value; regen(false); });
  $("gcCtrl").addEventListener("change", (e) => { S.ctrl = e.target.value; if (custom !== null && !confirm("Switch the controller? Your edited code will be replaced by newly generated code.")) { e.target.value = S.ctrl === "fanuc" ? "siemens" : "fanuc"; S.ctrl = e.target.value; return; } custom = null; regen(false); });
  $("gcMat").addEventListener("change", (e) => { S.mat = e.target.value; regen(false); });
  $("gcProgNo").addEventListener("input", (e) => { S.progNo = Math.max(1, Math.min(9999, parseInt(e.target.value, 10) || 1)); regen(true); });
  $("gcProgName").addEventListener("input", (e) => { S.progName = e.target.value; regen(true); });
  $("gcNums").addEventListener("change", (e) => { S.nums = e.target.checked; regen(false); });
  for (const k of ["w", "l", "h", "top"]) $("gcS_" + k).addEventListener("input", (e) => { const v = num(e.target.value, NaN); if (!Number.isFinite(v)) return; S.stock[k] = k === "top" ? Math.max(0, v) : Math.max(5, v); regen(true); });

  const tools = $("gcTools");
  tools.addEventListener("input", (e) => {
    const tr = e.target.closest("tr[data-k]"), key = e.target.dataset.tk; if (!tr || !key) return;
    const t = S.tools[+tr.dataset.k];
    if (key === "type") { t.type = e.target.value; Object.assign(t, { ...TOOL_DEF[t.type], t: t.t }); renderTools(); renderOps(); regen(false); return; }
    const v = num(e.target.value, NaN); if (!Number.isFinite(v)) return;
    const old = t.t; t[key] = key === "t" ? Math.round(v) : v;
    if (key === "t") S.ops.forEach((o) => { if (String(o.tool) === String(old)) o.tool = t.t; });
    if (key === "t" || key === "d" || key === "pitch") { clearTimeout(tools._t); tools._t = setTimeout(renderOps, 600); }
    regen(true);
  });
  tools.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tdel]"); if (!b) return;
    const t = S.tools[+b.dataset.tdel];
    if (S.ops.some((o) => String(o.tool) === String(t.t)) && !confirm(`T${t.t} is used by an operation. Remove it anyway?`)) return;
    S.tools.splice(+b.dataset.tdel, 1); renderTools(); renderOps(); regen(false);
  });
  $("gcToolAdd").addEventListener("click", () => {
    const type = $("gcToolType").value, tn = Math.max(0, ...S.tools.map((t) => +t.t || 0)) + 1;
    S.tools.push({ t: tn, type, ...TOOL_DEF[type] }); renderTools(); renderOps(); regen(false);
  });

  const ops = $("gcOps");
  ops.addEventListener("input", (e) => {
    const card = e.target.closest(".gc-op"); if (!card) return;
    const k = +card.dataset.k, op = S.ops[k], key = e.target.dataset.ok;
    if (e.target.matches("[data-on]")) { op.on = e.target.checked; card.classList.toggle("off", !op.on); regen(false); return; }
    if (!key) return;
    if (e.target.tagName === "SELECT") {
      op[key] = key === "tool" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value;
      if (key === "shape" || key === "pattern" || key === "tool") renderOps();
      regen(false); return;
    }
    op[key] = e.target.type === "text" ? e.target.value : (e.target.value === "" ? "" : num(e.target.value, op[key]));
    regen(true);
  });
  ops.addEventListener("click", (e) => {
    const card = e.target.closest(".gc-op"); if (!card) return;
    const k = +card.dataset.k;
    const mvb = e.target.closest("[data-mv]");
    if (mvb) { const j = k + +mvb.dataset.mv; [S.ops[k], S.ops[j]] = [S.ops[j], S.ops[k]]; sel = j; renderOps(); regen(false); return; }
    if (e.target.closest("[data-del]")) { if (!confirm(`Remove OP${k + 1}?`)) return; S.ops.splice(k, 1); sel = Math.min(sel, S.ops.length - 1); renderOps(); regen(false); return; }
    if (k !== sel) {
      sel = k; ops.querySelectorAll(".gc-op").forEach((c) => c.classList.toggle("sel", +c.dataset.k === k)); renderFormula();
      const info = gen && gen.opInfo[k];
      if (info && custom === null) { const row = $("gcCode").querySelector(`.gc-ln[data-i="${info.start}"]`); if (row) $("gcCode").scrollTop = row.offsetTop - 8; }
    }
  });
  $("gcOpAdd").addEventListener("click", () => addOp($("gcOpKind").value));

  $("gcCode").addEventListener("click", (e) => {
    const row = e.target.closest(".gc-ln"); if (!row) return;
    selLine = +row.dataset.i;
    $("gcCode").querySelector(".gc-ln.sel")?.classList.remove("sel"); row.classList.add("sel");
    explain(selLine); seekLine(selLine);
  });
  $("gcMsgs").addEventListener("click", (e) => {
    const r = e.target.closest(".gc-msg"); if (!r) return;
    selLine = +r.dataset.i; explain(selLine); seekLine(selLine);
    const c = $("gcCode"), row = c.querySelector(`.gc-ln[data-i="${selLine}"]`);
    if (row) { c.querySelector(".gc-ln.sel")?.classList.remove("sel"); row.classList.add("sel"); c.scrollTop = row.offsetTop - c.clientHeight / 3; }
  });
  $("gcPlay").addEventListener("click", () => { if (!sim) return; if (!playing && T >= sim.sum.total - 1e-6) T = 0; setPlaying(!playing); });
  $("gcRestart").addEventListener("click", () => { T = 0; apply(); });
  $("gcSpeed").addEventListener("change", (e) => { speed = +e.target.value; });
  $("gcScrub").addEventListener("input", (e) => { setPlaying(false); T = (sim.sum.total * +e.target.value) / 1000; apply(); });
  const stepLine = (dir) => {
    if (!sim) return;
    const cur = curLine < 0 ? -1 : curLine;
    for (let i = cur + dir; i >= 0 && i < sim.lines.length; i += dir) {
      const L = sim.lines[i];
      if (L && L.m1 > L.m0) { selLine = i; explain(i); seekLine(i); return; }
    }
  };
  $("gcPrev").addEventListener("click", () => stepLine(-1));
  $("gcNext").addEventListener("click", () => stepLine(1));
  $("gcShowPath").addEventListener("change", () => view && view.show({ path: $("gcShowPath").checked, xray: $("gcXray").checked }));
  $("gcXray").addEventListener("change", () => view && view.show({ path: $("gcShowPath").checked, xray: $("gcXray").checked }));
  $("gcFit").addEventListener("click", () => view && view.fit());

  $("gcEditBtn").addEventListener("click", () => {
    const ed = $("gcEdit"), open = ed.hidden;
    if (open) { ed.value = custom ?? gen.code; ed.hidden = false; $("gcCode").hidden = true; $("gcEditBtn").textContent = "Run edited code"; $("gcEditCancel").hidden = false; ed.focus(); }
    else { custom = ed.value; closeEdit(); regen(false); }
  });
  $("gcEditCancel").addEventListener("click", closeEdit);
  $("gcBack").addEventListener("click", () => { custom = null; closeEdit(); regen(false); });
  $("gcDownload").addEventListener("click", () => {
    const code = custom ?? gen.code, fan = S.ctrl === "fanuc";
    const name = fan ? `O${String(S.progNo).padStart(4, "0")}.nc` : `${(S.progName || "PART").toUpperCase().replace(/[^A-Z0-9]+/g, "_")}.MPF`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([code.replace(/\n/g, "\r\n") + "\r\n"], { type: "text/plain" }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("gcCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(custom ?? gen.code); $("gcCopy").textContent = "Copied ✓"; setTimeout(() => ($("gcCopy").textContent = "Copy"), 1500); }
    catch (e) { alert("Copy is blocked by the browser. Use Download instead."); }
  });
}
function closeEdit() { $("gcEdit").hidden = true; $("gcCode").hidden = false; $("gcEditBtn").textContent = "Edit code"; $("gcEditCancel").hidden = true; }

function initView() {
  if (view) return;
  try {
    view = createView($("gcView"));
    new ResizeObserver(() => view.resize()).observe($("gcView"));
    view.resize();
    view.load(sim, S); view.show({ path: $("gcShowPath").checked, xray: $("gcXray").checked });
    apply();
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active")) return;
      if (playing && sim) {
        T += dt * speed;
        if (T >= sim.sum.total) { T = sim.sum.total; setPlaying(false); }
        apply();
      }
      view.render();    };
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e);
    $("gcView").innerHTML = `<p class="muted" style="padding:16px">3D preview could not start (${esc(e.message)}). WebGL may be switched off in this browser.</p>`;
  }
}

const q = new URLSearchParams(location.search);       // deep links, e.g. /?gctpl=cc&gcctrl=siemens#cnc
if (TEMPLATES[q.get("gctpl")]) S = TEMPLATES[q.get("gctpl")]();
if (q.get("gcctrl") === "siemens" || q.get("gcctrl") === "fanuc") S.ctrl = q.get("gcctrl");
if (MACHINES[q.get("gcmach")]) S.machine = q.get("gcmach");
fillSelect($("gcOpKind"), Object.entries(OPK).map(([k, o]) => [k, o.label]), "pocket");
fillSelect($("gcToolType"), Object.entries(TT), "end");
bind();
rebuild();
fetch("/api/config").then((r) => r.json()).then((cfg) => {
  const vc20 = (cfg.products || []).find((p) => p.id === "VC20");
  for (const m of cfg.stations || cfg.machines || []) {
    if (!MACHINES[m.id]) continue;
    if (m.run_power_kw) MACHINES[m.id].powerKw = m.run_power_kw;
    const key = m.id.split("-")[0];
    twin[m.id] = (vc20 && vc20.cycle_s && vc20.cycle_s[key]) || m.cycle_time_s;
  }
  if (sim) { renderKpis(); renderCalcs(); }
}).catch(() => { /* works without the server data */ });

const _prev = window.onTabShown;
window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "cnc") { initView(); if (view) { view.bg(); view.resize(); } } };
if (location.hash === "#cnc") setTimeout(() => window.onTabShown && pane.classList.contains("active") && initView(), 0);
if (q.get("gcplay")) { speed = +q.get("gcplay") || 20; setTimeout(() => { T = 0; setPlaying(true); }, 800); }
if (q.get("gct")) setTimeout(() => { setPlaying(false); T = (sim.sum.total * +q.get("gct")) / 100; apply(); }, 900);
if (q.get("gcline")) setTimeout(() => { selLine = +q.get("gcline") - 1; explain(selLine); seekLine(selLine); }, 900);
