/* Ball screw + guide factory – item 1 shared 2D geometry (no Three.js): thread profile, rail + carriage outlines.
 * Used by bsfprod_3dbs.js / bsfprod_3dlg.js (3D) and bsfprod.js (live SVG section). Units mm. EXAMPLE geometry – check the catalogue.
 */
import { BS, BN, LG, LB } from "./bsfprod_data.js";

/* ---------------- gothic-arch thread profile (axial section). x = axial offset from the groove centre, result = radius */
export const TH = (() => {
  const Dw = BN.Dw, r = BN.f * Dw, e = r - Dw / 2, c = e * Math.SQRT1_2, Rb = BS.dpw / 2, ro = BS.dOut / 2, riN = 17.3;
  return { Dw, r, e, c, Rb, ro, riN, Ph: BS.Ph };
})();
// shaft: groove = 2 arcs with centres (∓c, Rb + c), radius r (contact at 45° below the ball centre); land at ro
export function shaftR(x) {
  const k = Math.abs(x) + TH.c;
  if (k >= TH.r) return TH.ro;
  return Math.min(TH.ro, TH.Rb + TH.c - Math.sqrt(TH.r * TH.r - k * k));
}
// nut: mirrored arcs (centres (∓c, Rb − c)), land (nut bore) at riN
export function nutR(x) {
  const k = Math.abs(x) + TH.c;
  if (k >= TH.r) return TH.riN;
  return Math.max(TH.riN, TH.Rb - TH.c + Math.sqrt(TH.r * TH.r - k * k));
}
// u = position inside one lead (0 … Ph), groove centre at Ph / 2
export const wrapU = (z, phi) => { const u = (z - TH.Ph * phi / (2 * Math.PI)) % TH.Ph; return u < 0 ? u + TH.Ph : u; };
export const shaftRadius = (z, phi) => shaftR(wrapU(z, phi) - TH.Ph / 2);
export const nutRadius = (z, phi) => nutR(wrapU(z, phi) - TH.Ph / 2);

/* ---------------- linear guide size 25 – rail + block section (z lateral, y up; rail bottom y = 0). O = our design */
export const GD = {
  Dw: LB.Dw, rg: 0.52 * LB.Dw, W: LG.W, H: LG.H, Wb: LB.Wb, Hasm: LB.Hasm, H1: LB.H1, Ls: LB.Lsteel, Lb: LB.Lb,
  arr: {
    O: { balls: [[9.0, 23.5], [13.5, 12.5]], rail: [[0, 0], [11.5, 0], [11.5, 20.5], [10, 22], [0, 22]], ip: [16.75, 15.75],
      ret: [[18.5, 30.0], [19.5, 12.5]] },
    X: { balls: [[12.18, 22.68], [13.18, 13.0]], rail: [[0, 0], [11.5, 0], [11.5, 20], [9.5, 22], [0, 22]], ip: [7.9, 18.2],
      ret: [[19.5, 30.0], [19.5, 13.0]] },
  },
  // carriage half outline (flange type): bottom y = H1, top y = Hasm, width 70
  block: [[12.5, 5.5], [24, 5.5], [24, 24], [35, 24], [35, 36], [0, 36], [0, 23], [11, 23], [12.5, 21.5]],
};
const dens = (pts, step = 0.25, closed = true) => {
  const out = [], n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step));
    if (L < 1e-9) continue;
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
};
// push outline points that lie inside a groove circle out to the circle (makes the raceway notch)
const notch = (pts, centres, R) => pts.map(([x, y]) => {
  for (const [cx, cy] of centres) { const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d < R && d > 1e-6) return [cx + dx / d * R, cy + dy / d * R]; }
  return [x, y];
});
const ballsBoth = (arr) => { const b = GD.arr[arr].balls; return [...b, ...b.map(([x, y]) => [-x, y])]; };
// rail outline (closed, counter-clockwise) with 4 raceway notches
export function railOutline(arr = "O") {
  const half = GD.arr[arr].rail;                         // from (0,0) along the bottom, up the side, over the top to (0, H)
  // bottom-left → bottom-right → up the right side → over the top → down the left side
  const ordered = [[-11.5, 0], ...half.slice(1, -1), ...half.slice(1, -1).reverse().map(([x, y]) => [-x, y]).filter((p) => !(p[1] === 0 && p[0] === -11.5))];
  return notch(dens(ordered), ballsBoth(arr), GD.rg);
}
// block outline (closed) with 4 raceway notches
export function blockOutline(arr = "O") {
  const h = GD.block;   // half: starts at the inner bottom corner (12.5, 5.5), goes outside, over the top to the centre, back down the inside
  // full outline: right half from inner-bottom → outer → top centre, then left half mirrored back to the left inner-bottom, then inside the tunnel back
  const right = h.slice(0, 6), inner = h.slice(6);          // right outer part (to the top centre (0,36)), inner tunnel (0,23) → (12.5,21.5)
  const pts = [...right, ...right.slice(0, 5).reverse().map(([x, y]) => [-x, y]),        // (−35,36) … (−12.5,5.5)
    ...inner.slice().reverse().map(([x, y]) => [-x, y]), ...inner.slice(1)];             // tunnel: (−12.5,21.5) (−11,23) (0,23)… (11,23) (12.5,21.5)
  return notch(dens(pts), ballsBoth(arr), GD.rg);
}
// recirculation loop of one ball row (block frame): loaded line at the ball centre, return line, 2 half circles in the end caps
export function rowLoops(arr = "O") {
  const A = GD.arr[arr], loops = [];
  for (const sg of [1, -1]) A.balls.forEach((b, i) => {
    const p = [sg * b[0], b[1]], q = [sg * A.ret[i][0], A.ret[i][1]], R = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
    loops.push({ p, q, R, upper: i === 0, side: sg, len: 2 * GD.Ls + 2 * Math.PI * R });
  });
  return loops;
}
// position on a loop at arc length s (0 … len): returns [x, z, y] in the block frame (x along the rail) + loaded flag
export function loopPoint(L, s) {
  const Lh = GD.Ls / 2, len = L.len; s = ((s % len) + len) % len;
  const mz = (L.p[0] + L.q[0]) / 2, my = (L.p[1] + L.q[1]) / 2, ux = (L.p[0] - mz) / L.R, uy = (L.p[1] - my) / L.R;
  if (s < GD.Ls) return { x: -Lh + s, z: L.p[0], y: L.p[1], loaded: true };                         // loaded, +x
  s -= GD.Ls;
  const half = Math.PI * L.R;
  if (s < half) { const a = s / L.R; return { x: Lh + Math.sin(a) * L.R, z: mz + ux * Math.cos(a) * L.R, y: my + uy * Math.cos(a) * L.R, loaded: false }; }
  s -= half;
  if (s < GD.Ls) return { x: Lh - s, z: L.q[0], y: L.q[1], loaded: false };                          // return, −x
  s -= GD.Ls;
  const a = s / L.R; return { x: -Lh - Math.sin(a) * L.R, z: mz - ux * Math.cos(a) * L.R, y: my - uy * Math.cos(a) * L.R, loaded: false };
}
