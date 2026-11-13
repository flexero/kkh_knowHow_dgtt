/* Ball screw + guide factory – item 3: SVG drawings from the layout data (page plan + the 12 drawings docs/img/42_*.svg).
 * planSVG({ ids, flow, agv, w, h }) → SVG string of the hall plan (block or detailed); DRAW[name]() → full drawing with title block.
 * Drawing rules: white background, black + ONE accent (#1f6fd1), text ≥ 11 px, title block "EXAMPLE – check with your planner".
 */
import { MTYPES, MACHINES, PLANT, ROUTES } from "./bsfmfg_data.js";
import { HALL, ZONES, ZONE_KEYS, PROD_ZONES, ZONE_OF, PLACE, DOORS, CHARGERS, RACKS, COLS, WALLS, LOT, AGV, footRect, flowMatrix, fleetSize, areaTable, doorDist, adjKey } from "./bsflay_data.js";

const A = "#1f6fd1", K = "#111", G = "#666", LG = "#bbb";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f0 = (v) => Math.round(v).toLocaleString("en").replace(/,/g, " ");
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const T = (x, y, s, o = {}) => `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.fs || 12}"${o.a ? ` text-anchor="${o.a}"` : ""}${o.b ? ' font-weight="700"' : ""}${o.c ? ` fill="${o.c}"` : ""}${o.r ? ` transform="rotate(${o.r} ${(+x).toFixed(1)} ${(+y).toFixed(1)})"` : ""}${o.i ? ' font-style="italic"' : ""}>${esc(s)}</text>`;
const Rc = (x, y, w, h, o = {}) => `<rect x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" width="${(+w).toFixed(1)}" height="${(+h).toFixed(1)}" fill="${o.f || "none"}" stroke="${o.s || K}" stroke-width="${o.sw || 1}"${o.d ? ` stroke-dasharray="${o.d}"` : ""}${o.op ? ` fill-opacity="${o.op}"` : ""}${o.rx ? ` rx="${o.rx}"` : ""}/>`;
const Ln = (x1, y1, x2, y2, o = {}) => `<line x1="${(+x1).toFixed(1)}" y1="${(+y1).toFixed(1)}" x2="${(+x2).toFixed(1)}" y2="${(+y2).toFixed(1)}" stroke="${o.s || K}" stroke-width="${o.sw || 1}"${o.d ? ` stroke-dasharray="${o.d}"` : ""}${o.m ? ' marker-end="url(#ar)"' : ""}${o.ma ? ' marker-end="url(#arA)"' : ""}/>`;
const PL = (pts, o = {}) => `<polyline points="${pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="none" stroke="${o.s || K}" stroke-width="${o.sw || 1}"${o.d ? ` stroke-dasharray="${o.d}"` : ""}${o.ma ? ' marker-end="url(#arA)"' : o.m ? ' marker-end="url(#ar)"' : ""}/>`;
const DEFS = `<defs><marker id="ar" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0,0 L9,3.5 L0,7 z" fill="${K}"/></marker><marker id="arA" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0,0 L9,3.5 L0,7 z" fill="${A}"/></marker><pattern id="hat" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="${G}" stroke-width="1"/></pattern></defs>`;
function frame(W, H, title, sub, body, no) {
  const tb = `<g>${Rc(W - 400, H - 74, 390, 64, { sw: 1.2 })}${Ln(W - 400, H - 50, W - 10, H - 50)}${T(W - 392, H - 57, "EXAMPLE – check with your planner", { b: true, fs: 13, c: A })}${T(W - 392, H - 34, "Ball screw + guide factory · item 3 · guide 42", { fs: 11 })}${T(W - 392, H - 18, `Drawing 42-${String(no).padStart(2, "0")} · all values are examples · 2026`, { fs: 11, c: G })}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Arial, Helvetica, sans-serif">${DEFS}<rect width="${W}" height="${H}" fill="#fff"/>${T(20, 30, title, { b: true, fs: 20 })}${sub ? T(20, 50, sub, { fs: 12, c: G }) : ""}${body}${tb}</svg>`;
}

/* ------------------------------------------------------------------ hall plan */
export function planSVG(o = {}) {
  const s = o.s || 11, x0 = o.x0 ?? 40, y0 = o.y0 ?? 70, Ht = HALL.W + HALL.annex;
  const X = (x) => x0 + x * s, Y = (y) => y0 + (Ht - y) * s;
  const rr = (r, op = {}) => Rc(X(r[0]), Y(r[3]), (r[2] - r[0]) * s, (r[3] - r[1]) * s, op);
  let g = "";
  // zones
  for (const z of ZONE_KEYS) {
    const Z = ZONES[z], r = Z.rect;
    const hot = z === "GRIND" || z === "METRO";
    g += rr(r, { f: z === "AISLE" ? "#f3f3f3" : hot ? A : z === "HT" ? "url(#hat)" : "none", op: hot ? 0.06 : undefined, s: hot ? A : K, sw: hot ? 2 : 1.2 });
  }
  // walls (thick) of closed rooms
  for (const w of WALLS) g += rr(w, { s: w[5] === "Grinding room" || w[5] === "Measurement room" ? A : K, sw: 3 });
  g += rr([0, 0, HALL.L, HALL.W + HALL.annex], { sw: 2.5 });
  // columns
  for (const c of COLS) g += Rc(X(c[0]) - 3, Y(c[1]) - 3, 6, 6, { f: K, s: K });
  if (!o.ids) {   // block layout: zone names + sizes
    for (const z of ZONE_KEYS) {
      const Z = ZONES[z], r = Z.rect, w = r[2] - r[0], d = r[3] - r[1], cx = X((r[0] + r[2]) / 2), cy = Y((r[1] + r[3]) / 2);
      if (z === "AISLE") { if (!o.agv) g += T(cx, cy + 4, `${Z.n} – ${w} × ${d} m`, { a: "middle", fs: 12, b: true }); continue; }
      const big = w * s > 150;
      const words = Z.s.split(" ");
      const l1 = big ? Z.s : words.slice(0, Math.ceil(words.length / 2)).join(" "), l2 = big ? "" : words.slice(Math.ceil(words.length / 2)).join(" ");
      g += T(cx, cy - (l2 ? 14 : 6), l1, { a: "middle", b: true, fs: 13 }) + (l2 ? T(cx, cy + 2, l2, { a: "middle", b: true, fs: 13 }) : "");
      g += T(cx, cy + (l2 ? 18 : 12), `${w} × ${d} m = ${f0(w * d)} m²`, { a: "middle", fs: 11 });
      if (Z.climate && /°C/.test(Z.climate) && !Z.annex) g += T(cx, cy + (l2 ? 33 : 27), Z.climate.split(" (")[0], { a: "middle", fs: 11, c: A, b: true });
    }
  } else {   // detailed: machine footprints + ids
    const RL = { raw: "bar rack", kit: "bought parts", soak: "soak buffer", lock: "airlock", sm: "supermarket", fg: "FG rack", ahu: "AHU", oil: "oil plant", aux: "buffer" };
    for (const r of RACKS) { const w = (r[2] - r[0]) * s, h = (r[3] - r[1]) * s, t = RL[r[6]] || ""; g += Rc(X(r[0]), Y(r[3]), w, h, { s: G, d: "4 3" });
      if (t && t.length * 6.4 < w) g += T(X(r[0]) + w / 2, Y(r[3]) + h / 2 + 4, t, { a: "middle", fs: 11, c: G }); else if (t && t.length * 6.4 < h) g += T(X(r[0]) + w / 2 + 4, Y(r[3]) + h / 2, t, { a: "middle", fs: 11, c: G, r: -90 }); }
    for (const m of MACHINES) {
      const r = footRect(m.id, m.type); if (!r) continue;
      const w = (r[2] - r[0]) * s, h = (r[3] - r[1]) * s, x = X(r[0]), y = Y(r[3]);
      const grind = ZONE_OF[m.type] === "GRIND" || ZONE_OF[m.type] === "METRO";
      g += Rc(x, y, w, h, { f: grind ? A : "#e9e9e9", op: grind ? 0.18 : undefined, s: K, sw: 1 });
      const id = m.id, cw = 6.4, fs = 11, tw = id.length * cw;
      if (tw + 4 <= w && h >= 14) g += T(x + w / 2, y + h / 2 + 4, id, { a: "middle", fs });
      else if (tw + 4 <= h && w >= 14) g += T(x + w / 2 + 4, y + h / 2, id, { a: "middle", fs, r: -90 });
      else { const [a, b] = [id.slice(0, -3), id.slice(-2)]; if (a.length * cw + 2 <= w && h >= 26) g += T(x + w / 2, y + h / 2 - 2, a, { a: "middle", fs }) + T(x + w / 2, y + h / 2 + 11, b, { a: "middle", fs });
        else g += T(x + w / 2, y + h + 12, a, { a: "middle", fs }) + T(x + w / 2, y + h + 24, b, { a: "middle", fs }); }
    }
    for (const z of ZONE_KEYS) { const Z = ZONES[z], r = Z.rect; if (z === "AISLE") { g += T(X(30), Y(26) + 4, "MAIN AGV AISLE 4 m – 2 one-way lanes", { a: "middle", fs: 12, b: true }); continue; }
      g += T(X(r[0]) + 4, Y(r[3]) + 13, Z.s, { fs: 12, b: true, c: /°C/.test(Z.climate) && !Z.annex ? A : K }); }
  }
  // doors + chargers + AGV lanes
  for (const [z, d] of Object.entries(DOORS)) { if (z === "METRO") continue; g += Rc(X(d[0]) - 9, Y(d[1]) - 3, 18, 6, { f: "#fff", s: A, sw: 2 }); if (o.ids) g += T(X(d[0]), Y(d[1]) + (d[1] > 26 ? 15 : -7), "P/D " + z, { a: "middle", fs: 11, c: A }); else if (o.agv) g += T(X(d[0]), Y(d[1]) + (d[1] > 26 ? -6 : 15), "P/D " + z, { a: "middle", fs: 11, c: A, b: true }); }
  if (o.agv || o.ids) for (const c of CHARGERS) g += Rc(X(c[0]) - 6, Y(c[1]) - 4, 12, 8, { f: A, s: A });
  if (o.agv) {
    g += Ln(X(0.5), Y(HALL.lanes.east), X(HALL.L - 1), Y(HALL.lanes.east), { s: A, sw: 2, ma: true });
    g += Ln(X(HALL.L - 0.5), Y(HALL.lanes.west), X(1), Y(HALL.lanes.west), { s: A, sw: 2, ma: true });
    for (const [z, d] of Object.entries(DOORS)) { if (z === "METRO") continue; const lane = d[1] > 26 ? HALL.lanes.west : HALL.lanes.east; g += Ln(X(d[0]), Y(d[1]), X(d[0]), Y(lane), { s: A, sw: 1.5, d: "4 3" }); }
  }
  // north arrow + scale bar
  const nx = x0 + HALL.L * s - 30, ny = y0 + 10;
  g += `<path d="M${nx},${ny + 30} L${nx + 8},${ny + 30} L${nx + 4},${ny + 4} z" fill="${K}"/>` + T(nx + 4, ny, "N", { a: "middle", b: true, fs: 12 });
  const sy = Y(0) + 22; g += Ln(x0, sy, x0 + 10 * s, sy, { sw: 2 }) + Ln(x0, sy - 4, x0, sy + 4) + Ln(x0 + 10 * s, sy - 4, x0 + 10 * s, sy + 4) + T(x0 + 5 * s, sy + 15, "10 m", { a: "middle", fs: 11 });
  g += T(x0 + 10 * s + 14, sy + 4, `hall ${HALL.L} × ${HALL.W} m = ${f0(HALL.L * HALL.W)} m² · annex ${HALL.L} × ${HALL.annex} m · columns ${HALL.colX} × ${HALL.colY} m`, { fs: 11 });
  return { svg: g, X, Y, w: HALL.L * s, h: Ht * s };
}
/* plan for the page (responsive, own svg element) */
export function pagePlan(ids) {
  const p = planSVG({ ids, s: ids ? 14 : 11, x0: 20, y0: 20 });
  const W = p.w + 40, H = p.h + 70;
  return `<svg class="bf3-plan" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif" role="img" aria-label="${ids ? "detailed layout with machine ids" : "block layout"}">${DEFS}<rect width="${W}" height="${H}" fill="#fff"/>${p.svg}</svg>`;
}

/* ------------------------------------------------------------------ drawings */
const ZN = { RAW: "Raw store", SAW: "Saw cell", SOFT: "Soft mach.", HT: "Heat treat.", GRIND: "Grinding", METRO: "Measuring", ASSY: "Assembly", PACK: "Pack + FG" };
export const DRAW = {
  "42_block_layout": () => { const p = planSVG({ s: 11, x0: 40, y0: 70 }); return frame(1200, 830, "Block layout – production hall 80 × 48 m + annex 80 × 8 m", "Zones in flow order: raw store → saw cell → soft machining → heat treatment → grinding room → measurement → assembly → packing + FG", p.svg + legendBlock(940, 90), 1); },
  "42_detailed_layout": () => { const p = planSVG({ s: 16, x0: 30, y0: 70, ids: true }); return frame(1400, 1080, `Detailed layout – ${MACHINES.length} machine instances of item 2 with their footprints`, "Blue = climate rooms (grinding 20 ± 1 °C, measurement 20 ± 0.5 °C). Dashed = racks, buffers, plant. P/D = AGV pick / drop point. Filled squares = columns.", p.svg, 2); },
  "42_area_calculation": () => areaDrawing(),
  "42_from_to_matrix": () => fromToDrawing(),
  "42_material_flow_sankey": () => sankeyDrawing(),
  "42_agv_routes": () => { const p = planSVG({ s: 11, x0: 40, y0: 70, agv: true }); const F = flowMatrix(), Fs = fleetSize(F);
    const L = [`Loaded trips: ${f0(F.agvTrips)} per day`, `Loaded: ${f0(F.dist)} m/day (+ 80 % empty)`, `Average loaded trip d = ${f1(Fs.avgD)} m`, `t = 1.8·d/v + 45 + 45 + 30 = ${f0(Fs.tTrip)} s`, `Busy: ${f1(Fs.busyH)} h per ${Fs.hours} h day`, `Need at 70 %: ${Fs.need.toFixed(2)} → ${Fs.n} + 1 spare = ${Fs.n + 1}`, `v ${AGV.v} m/s, battery ${AGV.battH} h, ${AGV.chargeRate} %/h`];
    return frame(1200, 830, "AGV routes, pick / drop points and charging", "Two one-way lanes in the 4 m main aisle (east y = 25 m, west y = 27 m); spurs to the P/D points; 4 charging bays at the west end", p.svg + `<g>${Rc(935, 90, 255, 200, { s: A })}${T(945, 110, "Fleet sizing (example)", { b: true, c: A })}${L.map((t, i) => T(945, 132 + i * 21, t, { fs: 11 })).join("")}</g>` + `<g>${Ln(945, 320, 985, 320, { s: A, sw: 2, ma: true })}${T(992, 324, "one-way lane", { fs: 11 })}${Rc(945, 335, 18, 6, { s: A, sw: 2 })}${T(992, 342, "P/D point (door)", { fs: 11 })}${Rc(948, 352, 12, 8, { f: A, s: A })}${T(992, 360, "charging bay", { fs: 11 })}</g>`, 6); },
  "42_grinding_room_hvac": () => hvacDrawing(),
  "42_grinder_foundation": () => foundationDrawing(),
  "42_utilities_single_line": () => utilDrawing(),
  "42_twin_data_flow": () => twinDrawing(),
  "42_planning_method": () => methodDrawing(),
  "42_sim_states_oee": () => statesDrawing(),
};
function legendBlock(x, y) {
  return `<g>${Rc(x, y, 250, 150, { s: K })}${T(x + 10, y + 20, "Legend", { b: true })}${Rc(x + 10, y + 32, 26, 14, { f: A, op: 0.06, s: A, sw: 2 })}${T(x + 44, y + 44, "climate room (20 ± 1 / ± 0.5 °C)", { fs: 11 })}${Rc(x + 10, y + 56, 26, 14, { f: "url(#hat)" })}${T(x + 44, y + 68, "heat treatment (fire wall, exhaust)", { fs: 11 })}${Rc(x + 10, y + 80, 26, 14, { f: "#f3f3f3" })}${T(x + 44, y + 92, "main AGV aisle 4 m", { fs: 11 })}${Rc(x + 17, y + 106, 12, 5, { f: "#fff", s: A, sw: 2 })}${T(x + 44, y + 113, "door / AGV P/D point", { fs: 11 })}${Rc(x + 20, y + 124, 6, 6, { f: K })}${T(x + 44, y + 132, "column (grid 10 × 24 m)", { fs: 11 })}</g>`;
}
function areaDrawing() {
  const at = areaTable(); let g = ""; const x0 = 230, w = 560, maxA = 1100, y0 = 110, rh = 48;
  g += T(40, 90, "Zone", { b: true }) + T(x0, 90, "area m² (bar = zone, blue = machine footprint)", { b: true }) + T(930, 90, "factor = zone / machines", { b: true });
  at.rows.forEach((r, i) => { const y = y0 + i * rh; g += T(40, y + 20, ZONES[r.z].s, { fs: 12 }) + T(40, y + 35, `${r.w} × ${r.d} m, ${r.k} machines`, { fs: 11, c: G });
    g += Rc(x0, y + 8, r.A / maxA * w, 24, { s: K }) + Rc(x0, y + 8, r.Am / maxA * w, 24, { f: A, s: A, op: 0.5 }) + T(x0 + r.A / maxA * w + 6, y + 25, `${f0(r.A)} m² / ${f0(r.Am)} m²`, { fs: 11 });
    g += T(930, y + 25, r.f ? r.f.toFixed(2) : "–", { fs: 12, b: r.f > 0 && r.f < 2.5 }); });
  const y = y0 + at.rows.length * rh + 20;
  const L = [`Machine footprint (MACHINES, 73 instances): ${f1(at.Am)} m², without the laboratory ${f1(at.Am72)} m²`, `Space factor for aisles, operator space, WIP racks, maintenance: 2.5 – 3.0 (example) → ${f0(at.Am72 * 2.5)} – ${f0(at.Am72 * 3)} m² for production`,
    "+ raw store 240 m² + packing / FG 240 m² + main aisle 320 m² + plant room 120 m² ≈ 920 m²", `→ ≈ ${f0(at.Am72 * 2.75 + 920)} m² needed → hall 80 × 48 m = ${f0(at.hall)} m² (columns 10 × 24 m) + annex 80 × 8 m = ${f0(at.annex)} m²`,
    "Factor < 2.5: heat treatment (dense furnace lines – check access for baskets + maintenance). Assembly + packing > 5: room for benches, run-in and growth."];
  g += Rc(40, y, 1120, 128, { s: A }) + L.map((t, i) => T(52, y + 24 + i * 23, t, { fs: 12, b: i === 3, c: i === 3 ? A : K })).join("");
  return frame(1200, 830, "Area calculation – machine footprint, space factor, hall size", "Footprint from MTYPES[…].foot of item 2 × number of machines; zone sizes from the block layout", g, 3);
}
function fromToDrawing() {
  const F = flowMatrix(), Z = F.zones, n = Z.length, c0 = 190, r0 = 110, cw = 100, rh = 50; let g = "";
  const mx = Math.max(...F.m.flat());
  g += T(c0 - 10, r0 - 40, "from \\ to", { a: "end", b: true, fs: 12 });
  Z.forEach((z, j) => { g += T(c0 + j * cw + cw / 2, r0 - 12, ZN[z], { a: "middle", b: true, fs: 12 }); });
  Z.forEach((zf, i) => { g += T(c0 - 10, r0 + i * rh + rh / 2 + 4, ZN[zf], { a: "end", b: true, fs: 12 });
    Z.forEach((zt, j) => { const v = F.m[i][j], x = c0 + j * cw, y = r0 + i * rh; const man = adjKey(zf, zt);
      g += Rc(x, y, cw, rh, { f: v > 0 ? A : "none", op: v > 0 ? 0.08 + 0.5 * v / mx : undefined, s: LG });
      if (i === j) g += Ln(x, y, x + cw, y + rh, { s: LG });
      if (v > 0) { g += T(x + cw / 2, y + 22, v.toFixed(1), { a: "middle", b: !man, i: !!man, fs: 13 }); g += T(x + cw / 2, y + 39, man ? "hand cart" : `AGV ${f0(doorDist(zf, zt))} m`, { a: "middle", fs: 11, c: G }); } }); });
  const y = r0 + n * rh + 30;
  const L = [`Lots per day (whole lots of one daily order): start qty = good qty / route yield, lot size BS ${LOT.BS} · BN ${LOT.BN} · LG ${LOT.LG} · LB ${LOT.LB} · sets ${LOT.FABS} / ${LOT.FALG} (example)`,
    `AGV trips (bold) ${f1(F.agvTrips)} per day · hand-cart moves (italic, neighbour rooms) ${f1(F.manual)} per day`,
    `Transport work = Σ trips × distance = ${f0(F.dist)} m/day loaded (+ ≈ 80 % empty runs) – distance between P/D points on the lanes`,
    "Read: row = from, column = to. Moves inside a zone (machine → machine) are by hand / roller conveyor and are not in the matrix."];
  g += L.map((t, i) => T(40, y + i * 22, t, { fs: 12, b: i === 1 })).join("");
  return frame(1200, 830, "From–to matrix – lots per day between the zones", "Design point 120 screw sets + 200 guide sets per day; cell colour = intensity", g, 4);
}
function sankeyDrawing() {
  const F = flowMatrix(), cols = ["RAW", "SAW", "SOFT", "HT", "GRIND", "METRO", "ASSY", "PACK"], x0 = 175, dx = 126, cw = 64, top = 110, k = 0.36; let g = "";
  const routes = ["BS", "BN", "LG", "LB"]; const bandY = {}; let yy = top;
  routes.forEach((r) => { bandY[r] = yy; yy += F.per[r].start * k + 24; });
  cols.forEach((z, i) => { const x = x0 + i * dx; const cl = z === "GRIND" || z === "METRO"; g += Rc(x, top - 22, cw, yy - top + 22, { s: cl ? A : K, sw: cl ? 2 : 1 }) + T(x + cw / 2, top - 30, ZN[z], { a: "middle", b: true, fs: 12 }); });
  const band = (xa, ya, ha, xb, yb, hb, blue) => `<path d="M${xa},${ya} C${(xa + xb) / 2},${ya} ${(xa + xb) / 2},${yb} ${xb},${yb} L${xb},${yb + hb} C${(xa + xb) / 2},${yb + hb} ${(xa + xb) / 2},${ya + ha} ${xa},${ya + ha} z" fill="${blue ? A : "#999"}" fill-opacity="0.3" stroke="${K}" stroke-width="0.8"/>`;
  routes.forEach((r) => {
    const zs = F.per[r].zones.filter((z, i, a) => i === 0 || z !== a[i - 1]); const h = F.per[r].start * k, y = bandY[r];
    for (let i = 0; i + 1 < zs.length; i++) { const a = cols.indexOf(zs[i]), b = cols.indexOf(zs[i + 1]); g += band(x0 + a * dx + cw, y, h, x0 + b * dx, y, h, r === "BS"); }
    zs.forEach((z) => { const x = x0 + cols.indexOf(z) * dx; g += Rc(x + 2, y, cw - 4, h, { f: r === "BS" ? A : "#777", op: 0.55, s: K, sw: 0.8 }); });
    g += T(20, y + 14, `${r} – ${ROUTES[r].n}`, { b: true, fs: 12 }) + T(20, y + 30, `${f0(F.per[r].start)} pcs/day start`, { fs: 11 }) + T(20, y + 45, `${F.per[r].lots} lots/day of ${LOT[r]}`, { fs: 11 });
  });
  // assembly → packing: sets
  const xa = x0 + 6 * dx + cw, xb = x0 + 7 * dx, hA = PLANT.qty.FABS * k, hB = PLANT.qty.FALG * k;
  const yA = (bandY.BS + bandY.BN + F.per.BN.start * k) / 2 - hA / 2, yB = (bandY.LG + bandY.LB + F.per.LB.start * k) / 2 - hB / 2;
  g += band(xa, bandY.BS, F.per.BS.start * k, xb, yA, hA, true) + band(xa, bandY.BN, F.per.BN.start * k, xb, yA, hA, false);
  g += band(xa, bandY.LG, F.per.LG.start * k, xb, yB, hB, false) + band(xa, bandY.LB, F.per.LB.start * k, xb, yB, hB, false);
  g += Rc(xb + 2, yA, cw - 4, hA, { f: A, op: 0.55, s: K }) + Rc(xb + 2, yB, cw - 4, hB, { f: "#777", op: 0.55, s: K });
  g += T(xb + cw + 6, yA + hA / 2 - 2, `${PLANT.qty.FABS} screw`, { fs: 11 }) + T(xb + cw + 6, yA + hA / 2 + 12, "sets / day", { fs: 11 }) + T(xb + cw + 6, yB + hB / 2 - 2, `${PLANT.qty.FALG} guide`, { fs: 11 }) + T(xb + cw + 6, yB + hB / 2 + 12, "sets / day", { fs: 11 });
  const y = yy + 22;
  g += T(40, y, "Band height = pieces per day (start quantity incl. scrap allowance). Blue = screw shaft (bottleneck route: 8 thread grinders). A band that jumps a column", { fs: 12 });
  g += T(40, y + 18, "passes that zone without an operation (nut + carriage go from the grinding room straight to assembly). In assembly 1 screw + 1 nut → 1 screw set, 1 rail + 2 blocks → 1 guide set.", { fs: 12 });
  return frame(1200, 830, "Material flow – Sankey style (pieces per day through the zones)", "Parts move zone by zone in lots from the raw store to the supermarket of the assembly; sets go to packing + FG", g, 5);
}
function hvacDrawing() {
  let g = ""; const x = 60, y = 140, w = 760, h = 300;
  g += Rc(x, y, w, h, { s: A, sw: 3 }) + T(x + 8, y + 30, "Grinding room 42 × 24 m, clear height 4.5 m, sandwich panels PIR 100 mm (U ≈ 0.22 W/m²K)", { fs: 12, b: true });
  for (let i = 0; i < 5; i++) { const mx = x + 70 + i * 140; g += Rc(mx, y + h - 80, 90, 70, { f: "#eee" }) + T(mx + 45, y + h - 40, i < 3 ? "thread grinder" : i === 3 ? "profile grinder" : "cyl. grinder", { a: "middle", fs: 11 });
    for (let k = 0; k < 3; k++) g += `<path d="M${mx + 25 + k * 20},${y + h - 85} q6,-12 0,-24 q-6,-12 0,-24" fill="none" stroke="${G}" stroke-width="1"/>`; }
  g += Rc(x + 20, y + 40, w - 40, 22, { f: "#fff" }) + T(x + w / 2, y + 56, "supply air duct over the ceiling – textile / perforated outlets, low velocity ≤ 0.2 m/s in the occupied zone", { a: "middle", fs: 11 });
  for (let i = 0; i < 6; i++) { const ax = x + 80 + i * 120; g += Ln(ax, y + 62, ax, y + 115, { s: A, sw: 1.5, ma: true }); }
  for (let i = 0; i < 3; i++) g += Rc(x + 140 + i * 230, y + 2, 60, 10, { f: G, s: K }) + T(x + 170 + i * 230, y - 4, "return grille", { a: "middle", fs: 11 });
  for (let i = 0; i < 6; i++) g += `<circle cx="${x + 60 + i * 130}" cy="${y + 150}" r="6" fill="#fff" stroke="${A}" stroke-width="2"/>` + T(x + 60 + i * 130, y + 170, "T" + (i + 1), { a: "middle", fs: 11, c: A });
  const ax = 870; g += Rc(ax, 150, 290, 120, { s: K }) + T(ax + 10, 170, "Air-handling unit (plant room)", { b: true, fs: 12 }) + T(ax + 10, 190, "filter F7 → cooling coil → reheat → fan (EC)", { fs: 11 }) + T(ax + 10, 208, "→ supply 16 – 18 °C, ΔT 4 – 6 K to the room", { fs: 11 }) + T(ax + 10, 226, "PID: mean of T1 … T6 → valve + fan speed", { fs: 11 }) + T(ax + 10, 244, "band ± 1 K, gradient ≤ 1 K/m height", { fs: 11 });
  g += Ln(ax, 200, x + w, 200, { s: A, sw: 2 }) + Ln(x + w, 170, x + w - 10, 170, { s: A, sw: 2 });
  g += Rc(ax, 300, 290, 90, { s: K }) + T(ax + 10, 320, "Chiller (glycol) + free cooling", { b: true, fs: 12 }) + T(ax + 10, 340, "≈ 150 kW for the AHU", { fs: 11 }) + T(ax + 10, 358, "+ central grinding-oil chiller ≈ 220 kW", { fs: 11 }) + T(ax + 10, 376, "oil 20 ± 0.5 °C (most grinding heat)", { fs: 11 });
  g += Ln(ax + 145, 270, ax + 145, 300, { sw: 1.5 });
  g += Rc(x + w - 120, y + h - 6, 110, 40, { s: A, sw: 2 }) + T(x + w - 65, y + h + 18, "airlock 2 doors", { a: "middle", fs: 11 });
  const Lr = ["Heat load to the room air (example, guide 42 §9.2):", "machines 572 kW installed × 0.5 average × 0.3 to air ≈ 86 kW (70 % goes into the oil)", "lights 1 008 m² × 8 W/m² ≈ 8 kW · people 10 × 120 W ≈ 1.2 kW", "walls + roof + doors ≈ 10 kW · margin 20 % → Q ≈ 126 kW → AHU ≈ 130 – 150 kW", "Air flow V = Q / (ρ · cp · ΔT) = 126 / (1.2 × 1.005 × 5) = 20.9 m³/s ≈ 75 000 m³/h", "Air change n = V / room volume = 75 000 / (1 008 × 4.5) ≈ 17 per hour"];
  g += Rc(60, 480, 1100, 160, { s: A }) + Lr.map((t, i) => T(72, 504 + i * 23, t, { fs: 12, b: i === 0 || i === 4 })).join("");
  g += T(60, 670, "Rules: no sun, no outside door, parts soak ≥ 4 h inside before thread grinding / measurement, machines run warm-up programs, log T1 … T6 every minute (Modbus TCP → twin).", { fs: 12 });
  return frame(1200, 830, "Grinding room HVAC – 20 ± 1 °C (thread grinding + measurement ± 0.5 °C)", "Displacement / low-velocity supply from above, return at ceiling, 6 room sensors, heat mostly removed by the oil chillers", g, 7);
}
function foundationDrawing() {
  let g = ""; const gx = 80, gy = 420;
  g += Rc(40, gy, 760, 230, { f: "url(#hat)", s: G }) + T(50, gy + 220, "soil (report: bearing capacity, ground water)", { fs: 11 });
  g += Rc(40, gy - 30, 760, 30, { f: "#ddd" }) + T(50, gy - 10, "hall floor slab 250 mm", { fs: 11 });
  g += Rc(gx + 120, gy - 30, 480, 200, { f: "#fff", s: K, sw: 1.5 }) + T(gx + 360, gy + 188, "pit with lean concrete 100 mm", { a: "middle", fs: 11 });
  g += Rc(gx + 150, gy - 10, 420, 130, { f: "#cfcfcf", s: K, sw: 1.5 }) + T(gx + 360, gy + 60, "isolated concrete block 6.5 × 3.6 × 0.9 m ≈ 50 t", { a: "middle", fs: 12, b: true });
  for (let i = 0; i < 5; i++) { const ex = gx + 175 + i * 90; g += Rc(ex, gy + 125, 50, 20, { f: A, s: A, op: 0.6 }); }
  g += T(gx + 360, gy + 162, "spring-damper elements (f0 ≈ 4 Hz) or PUR mat (f0 ≈ 8 – 12 Hz)", { a: "middle", fs: 11, c: A, b: true });
  g += Ln(gx + 140, gy - 30, gx + 140, gy + 170, { s: A, sw: 2, d: "5 3" }) + Ln(gx + 580, gy - 30, gx + 580, gy + 170, { s: A, sw: 2, d: "5 3" }) + T(gx + 590, gy - 40, "joint 30 – 50 mm, sealed", { fs: 11, c: A });
  g += Rc(gx + 190, gy - 150, 340, 140, { f: "#eee", s: K }) + T(gx + 360, gy - 80, "thread grinder ≈ 12 t", { a: "middle", fs: 12, b: true }) + T(gx + 360, gy - 62, "on 6 levelling elements", { a: "middle", fs: 11 });
  for (let i = 0; i < 6; i++) g += Rc(gx + 205 + i * 58, gy - 12, 20, 6, { f: K });
  const L = ["Why: presses, saws, HMCs, forklifts + AGVs make floor vibration; thread grinding needs < 1 µm relative motion.", "Mass ratio block / machine ≥ 2 – 4 (here 50 t / 12 t ≈ 4) → lower vibration amplitude, stable levelling.",
    "Natural frequency f0 = (1 / 2π) · √(k / m). Isolation from f / f0 > √2. Transmissibility T = 1 / |(f / f0)² − 1| (no damping).", "Example: press 25 Hz, f0 = 4 Hz → T = 1 / (39.1 − 1) = 0.026 → 97 % isolated. Mat f0 = 10 Hz → T = 1 / (6.25 − 1) = 0.19 → 81 %.",
    "Criteria: vibration velocity at the machine foot ≤ VC-B 25 µm/s rms (1/3 octave, 4 – 80 Hz) – generic VC curves (check), or the maker's limit.", "Measure the site BEFORE you build (accelerometers, 24 h), keep presses ≥ 15 – 20 m away, no AGV lane over the block."];
  g += Rc(840, 80, 330, 560, { s: A }) + T(852, 104, "Design notes (example)", { b: true, c: A });
  let yy = 128; for (const t of L) { const words = t.split(" "); let line = ""; for (const w of words) { if ((line + " " + w).length > 46) { g += T(852, yy, line.trim(), { fs: 11 }); yy += 16; line = ""; } line += " " + w; } g += T(852, yy, line.trim(), { fs: 11 }); yy += 26; }
  return frame(1200, 830, "Isolated foundation for a thread grinder (section)", "Concrete block in a pit on spring-damper elements or an elastomer mat, separated from the hall slab by a joint", g, 8);
}
function utilDrawing() {
  const zs = ["SAW", "SOFT", "HT", "GRIND", "METRO", "ASSY", "PACK"]; const kw = {}; MACHINES.forEach((m) => { const z = ZONE_OF[m.type]; kw[z] = (kw[z] || 0) + m.kW; });
  const extra = [["PLANT", "HVAC + oil chillers", 260, 0.7], ["AIR", "Compressed air 2 + 1", 90, 0.7], ["COOL", "Coolant + chips", 75, 0.6], ["OFFICE", "Offices, IT, lights", 80, 0.5]];
  const dz = { SAW: 0.4, SOFT: 0.45, HT: 0.6, GRIND: 0.5, METRO: 0.5, ASSY: 0.4, PACK: 0.4 };
  const rows = zs.map((z) => [z, ZONES[z].s, kw[z] || 0, dz[z]]).concat(extra);
  let g = ""; const bx = 520, by = 120;
  g += `<circle cx="150" cy="150" r="34" fill="none" stroke="${K}" stroke-width="1.5"/><circle cx="150" cy="200" r="34" fill="none" stroke="${K}" stroke-width="1.5"/>` + T(200, 160, "Transformer 20 kV / 0.4 kV", { b: true }) + T(200, 178, "1 600 kVA (example; or 2 × 800 kVA), Dyn11, uk 6 %", { fs: 11 }) + T(200, 196, "grid: utility 20 kV ring", { fs: 11 });
  g += Ln(150, 90, 150, 116) + Ln(150, 234, 150, 270) + Rc(60, 270, 1080, 14, { f: K }) + T(420, 262, "Main LV switchboard 400 / 230 V, 2 500 A busbar, power-factor correction, Modbus TCP energy meter per feeder (M)", { fs: 11 });
  let tot = 0, totD = 0;
  rows.forEach((r, i) => { const x = 80 + i * 96, y = 340; const d = r[2] * r[3]; tot += r[2]; totD += d;
    g += Ln(x + 40, 284, x + 40, y) + `<circle cx="${x + 40}" cy="${y + 12}" r="10" fill="#fff" stroke="${A}" stroke-width="1.5"/>` + T(x + 40, y + 16, "M", { a: "middle", fs: 11, c: A, b: true });
    g += Ln(x + 40, y + 22, x + 40, y + 40) + Rc(x, y + 40, 82, 130, { s: K }) + T(x + 41, y + 58, r[1].split(" ").slice(0, r[1].length > 13 ? 1 : 2).join(" "), { a: "middle", fs: 11, b: true }) + T(x + 41, y + 73, r[1].split(" ").slice(r[1].length > 13 ? 1 : 2).join(" ") || " ", { a: "middle", fs: 11, b: true });
    g += T(x + 41, y + 98, f0(r[2]) + " kW inst.", { a: "middle", fs: 11 }) + T(x + 41, y + 116, "g = " + r[3], { a: "middle", fs: 11 }) + T(x + 41, y + 136, f0(d) + " kW", { a: "middle", fs: 12, b: true, c: A }) + T(x + 41, y + 156, "demand", { a: "middle", fs: 11 }); });
  const S = totD / 0.93;
  const L = [`Installed: machines ${f0(MACHINES.reduce((s, m) => s + m.kW, 0))} kW + infrastructure ${f0(extra.reduce((s, e) => s + e[2], 0))} kW = ${f0(tot)} kW`, `Demand = Σ installed × diversity factor g (per sub-board, example) = ${f0(totD)} kW`, `Apparent power S = P / cos φ = ${f0(totD)} / 0.93 = ${f0(S)} kVA → transformer 1 600 kVA (≈ ${Math.round(S / 1600 * 100)} % load, room for growth)`,
    "Media (not electric): compressed air ring 8 bar DN 50 · emulsion central (soft) · grinding-oil central ≤ 5 µm 20 ± 0.5 °C · chip conveyors → briquetting · quench oil + gas (HT)", "All meters + utility PLCs on the machine VLAN, Modbus TCP, polled every 10 s by the gateway (energy KPIs in the twin)."];
  g += Rc(60, 560, 1100, 130, { s: A }) + L.map((t, i) => T(72, 584 + i * 23, t, { fs: 12, b: i === 2 })).join("");
  return frame(1200, 830, "Utilities – electrical single line (simplified) + media", "One transformer, main LV board, one sub-board per zone with its own energy meter; diversity factors are examples – check with the electrical planner", g, 9);
}
function twinDrawing() {
  let g = ""; const box = (x, y, w, h, t1, t2, acc) => Rc(x, y, w, h, { s: acc ? A : K, sw: acc ? 2 : 1.2, rx: 4 }) + T(x + w / 2, y + 22, t1, { a: "middle", b: true, fs: 13, c: acc ? A : K }) + (t2 || []).map((t, i) => T(x + w / 2, y + 42 + i * 17, t, { a: "middle", fs: 11 })).join("");
  const ms = [["CNC lathes + machining centres", "signal groups std + cnc"], ["Grinders (thread, cyl., profile)", "std + grind + tgr"], ["Furnaces + induction", "std + furn / ind"], ["Presses + measuring machines", "std + press / meas"], ["Assembly + test stands", "std + torque"], ["Energy meters, utilities, doors", "kW, kWh, air, oil temp."]];
  ms.forEach((m, i) => { g += box(40, 90 + i * 92, 280, 72, m[0], [m[1], "Modbus TCP server, unit id"]); g += Ln(320, 126 + i * 92, 400, 126 + i * 92, { m: true }); });
  g += box(400, 90, 170, 534, "Managed switch", ["machine VLAN", "1 Gbit star", "port 502 only", "", "", "", "", "", "", "", "", "", "", "", "Modbus TCP", "holding regs 4xxxx", "REAL = 2 regs ABCD", "ASCII 2 ch / reg"]);
  g += Ln(570, 300, 640, 300, { m: true, sw: 1.5 });
  g += box(640, 200, 230, 210, "Gateway (stdlib Python)", ["Modbus TCP client", "poll 100 ms status", "1 s counters", "10 s energy", "register map = SIGFIELDS", "→ JSON"], true);
  g += Ln(870, 300, 930, 300, { ma: true, sw: 2 }) + T(900, 290, "HTTP", { a: "middle", fs: 11, c: A, b: true });
  const rs = [["Twin server (item 3)", "GET /api/bsf/state · SSE"], ["MES (item 6)", "orders, dispatch, OEE"], ["ERP (item 7)", "MRP, cost, sales orders"], ["Browser / andon screens", "this page, HTTP only"], ["AGV fleet manager", "transport orders over HTTP"]];
  rs.forEach((r, i) => { g += box(930, 90 + i * 108, 240, 80, r[0], [r[1], "REST + JSON"], i === 0); });
  g += Rc(40, 650, 830, 46, { s: A, d: "6 4" }) + T(52, 670, "Safety is hard-wired (safety relays / F-PLC, E-stop, light curtains, door switches) – never over Modbus or HTTP.", { fs: 12, b: true }) + T(52, 688, "No MQTT, no OPC UA: machines ↔ gateway = Modbus TCP only; everything above the gateway = HTTP (REST, Server-Sent Events).", { fs: 12 });
  return frame(1200, 830, "Twin data flow – Modbus TCP → gateway → HTTP", "Item 4 builds the register maps from SIGFIELDS (web/bsfsim.js); the live twin of item 3 gives the same JSON in simulation mode", g, 10);
}
function methodDrawing() {
  const st = [["1 Demand", "120 screw sets + 200 guide sets / day, 250 days"], ["2 Routings", "51 operations, cycle + set-up + scrap (item 2)"], ["3 Capacity", "machines = Σ load / (avail × OEE) → 72 + lab"], ["4 Areas", "footprint × 2.5 – 3 + stores + aisles"], ["5 Block layout", "flow order, climate zones, HT apart"], ["6 Detailed layout", "machines, aisles 3 – 4 m, doors, utilities"], ["7 Flow check", "from–to matrix, m/day, AGV fleet"], ["8 Simulation", "live twin: WIP, lead time, bottleneck"], ["9 What-if", "7 vs 8 grinders, OEE, AGVs, lots"], ["10 Decision", "buy list, building, HVAC, foundations"]];
  let g = ""; st.forEach((s, i) => { const col = i % 5, row = Math.floor(i / 5); const x = 40 + col * 228, y = 120 + row * 230; const acc = i === 7 || i === 8;
    g += Rc(x, y, 200, 120, { s: acc ? A : K, sw: acc ? 2.2 : 1.2, rx: 6 }) + T(x + 100, y + 30, s[0], { a: "middle", b: true, fs: 15, c: acc ? A : K });
    const w = s[1].split(" "); let l1 = "", l2 = ""; for (const t of w) { if ((l1 + " " + t).length <= 26 && !l2) l1 += " " + t; else l2 += " " + t; } g += T(x + 100, y + 62, l1.trim(), { a: "middle", fs: 11 }) + T(x + 100, y + 80, l2.trim(), { a: "middle", fs: 11 });
    if (col < 4) g += Ln(x + 200, y + 60, x + 226, y + 60, { m: true }); });
  g += PL([[1052, 240], [1052, 300], [140, 300], [140, 348]], { m: true });
  g += PL([[940, 470], [940, 530], [600, 530], [600, 470]], { s: A, ma: true, d: "5 3" }) + T(770, 550, "loop: change the layout / machines / lots and simulate again", { a: "middle", fs: 11, c: A });
  g += T(40, 610, "Rule: capacity first (how many machines), then areas, then the layout, then check the flow – and only then buy. The twin is used again later with real data.", { fs: 12 });
  return frame(1200, 830, "Factory planning method – from demand to the decision", "Each step uses the result of the previous one; steps 8 and 9 are this page (live twin + what-if)", g, 11);
}
function statesDrawing() {
  let g = ""; const S = [["OFF", 80, 140, "no shift"], ["IDLE", 300, 140, "no order"], ["STARVED", 520, 140, "no parts"], ["SETUP", 300, 300, "change-over"], ["RUN", 520, 300, "producing"], ["BLOCKED", 740, 300, "out-buffer full"], ["DOWN", 520, 460, "alarm / repair"]];
  for (const [n, x, y, t] of S) g += Rc(x, y, 160, 64, { s: n === "RUN" ? A : K, sw: n === "RUN" ? 2.4 : 1.4, rx: 8 }) + T(x + 80, y + 28, n, { a: "middle", b: true, fs: 15, c: n === "RUN" ? A : K }) + T(x + 80, y + 48, t, { a: "middle", fs: 11 });
  const ar = (a, b, c, d) => Ln(a, b, c, d, { m: true });
  g += ar(240, 172, 300, 172) + ar(460, 172, 520, 172) + ar(380, 204, 380, 300) + ar(460, 332, 520, 332) + ar(600, 204, 600, 300) + ar(680, 332, 740, 332) + ar(600, 364, 600, 460) + ar(560, 460, 420, 364);
  g += T(270, 165, "shift", { fs: 11, a: "middle" }) + T(490, 165, "order", { fs: 11, a: "middle" }) + T(390, 255, "lot, new op", { fs: 11 }) + T(610, 255, "lot", { fs: 11 }) + T(612, 420, "failure", { fs: 11 }) + T(470, 430, "repaired", { fs: 11 });
  const L = ["OEE (ISO 22400 style, per machine):", "A = run / (run + set-up + down)", "P = Σ ideal cycle × pieces / run", "Q = good / (good + scrap)", "OEE = A × P × Q", "e.g. 0.95 × 0.78 × 0.99 = 0.73", "starved / blocked / idle = losses", "of the LINE (utilisation)",
    "", "Little's law (stable system):", "WIP = throughput × lead time", "L = λ · W, e.g. 1.39 lots/h × 53 h", "= 74 lots in the plant", "", "Bottleneck:", "highest (run + set-up + down)", "/ shift time", "", "Kingman (waiting in a queue):", "≈ (ca² + cs²)/2 · u/(1 − u) · t", "u > 0.9 → queues explode"];
  g += Rc(925, 80, 260, 560, { s: A }) + L.map((t, i) => T(937, 104 + i * 23, t, { fs: 12, b: /:$/.test(t), c: /:$/.test(t) ? A : K })).join("");
  g += T(60, 600, "Every machine of the twin has exactly one of these 7 states at any time; item 4 sends it as stateCode 0 … 6 + status bits (Modbus TCP).", { fs: 12 });
  return frame(1200, 830, "Machine states, OEE and Little's law in the simulation", "State machine of every machine in web/bsfsim.js; the KPI panel shows the same numbers live", g, 12);
}
export const DRAW_KEYS = Object.keys(DRAW);
