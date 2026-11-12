/* Hydraulics tab – item 2: ISO 1219-1 SYMBOLS (simplified, own drawing; all names prefixed "hs" so they never clash).
 * Every function returns an SVG string. Stroke = currentColor (dark theme), pressure colours from hsPc().
 * Clickable symbols carry data-hcinfo="key" → info box. Coordinates in the 760 × 520 circuit viewBox.
 */
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const r1 = (v) => Math.round(v * 10) / 10;

/** pressure colour: blue (tank) → yellow → red (≥ pm); violet = cavitation (below −0.03 MPa) */
export function hsPc(p, pm) {
  if (p < -0.03e6) return "#b067ff";
  const r = Math.max(0, Math.min(1, p / pm));
  return `hsl(${Math.round(212 - 212 * r)} 78% ${r < 0.04 ? 58 : 50}%)`;
}
/** line with pressure colour + animated flow dashes. pts = [[x,y],…]; q > 0 = flow from first to last point */
export function hsLine(pts, p, pm, q = 0, anim = 0, qref = 2e-4) {
  const d = "M" + pts.map((v) => r1(v[0]) + "," + r1(v[1])).join(" L");
  let s = `<path d="${d}" class="hs-ln" style="stroke:${hsPc(p, pm)}"/>`;
  const aq = Math.abs(q);
  if (aq > 2e-7) {
    const op = Math.min(1, 0.35 + 0.65 * Math.log10(1 + 9 * aq / qref));
    s += `<path d="${d}" class="hs-fl" style="stroke-dashoffset:${r1(-(anim * 46 % 1000) * Math.sign(q))};opacity:${op.toFixed(2)}"/>`;
  }
  return s;
}
export const hsPilot = (pts) => `<path d="M${pts.map((v) => r1(v[0]) + "," + r1(v[1])).join(" L")}" class="hs-pil"/>`;
export const hsDrain = hsPilot;
export const hsDot = (x, y) => `<circle cx="${x}" cy="${y}" r="2.8" class="hs-dot"/>`;
export const hsTag = (x, y, t, a = "start") => `<text x="${x}" y="${y}" class="hs-tag" text-anchor="${a}">${esc(t)}</text>`;
export const hsTxt = (x, y, t, a = "start", cls = "hs-val") => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${a}">${esc(t)}</text>`;
const grp = (key, body, extra = "") => `<g class="hs-sym${key ? " hs-click" : ""}"${key ? ` data-hcinfo="${key}"` : ""} ${extra}>${body}</g>`;
function head(x, y, ang, s = 6) { // filled arrow head at (x,y) pointing at angle (rad)
  const a1 = ang + 2.7, a2 = ang - 2.7;
  return `<path d="M${r1(x)},${r1(y)} L${r1(x + s * Math.cos(a1))},${r1(y + s * Math.sin(a1))} L${r1(x + s * Math.cos(a2))},${r1(y + s * Math.sin(a2))} Z" class="hs-fill"/>`;
}
export function hsArrow(x1, y1, x2, y2) { return `<path d="M${x1},${y1} L${x2},${y2}" class="hs-s"/>` + head(x2, y2, Math.atan2(y2 - y1, x2 - x1)); }
function spring(x, y, len, vertical = false, adj = true) { // zigzag spring starting at x,y
  const n = 5, st = len / n; let d = `M${x},${y}`;
  for (let i = 0; i < n; i++) { const o = i % 2 ? -6 : 6; d += vertical ? ` L${x + o},${y + st * (i + 0.5)}` : ` L${x + st * (i + 0.5)},${y + o}`; }
  d += vertical ? ` L${x},${y + len}` : ` L${x + len},${y}`;
  let s = `<path d="${d}" class="hs-s"/>`;
  if (adj) s += vertical ? hsArrow(x - 9, y + len - 2, x + 9, y + 2) : hsArrow(x + 2, y + 9, x + len - 2, y - 9);
  return s;
}

/** tank (open reservoir) – line ends at x,y (top) */
export const hsTank = (x, y) => `<path d="M${x - 11},${y} L${x - 11},${y + 9} L${x + 11},${y + 9} L${x + 11},${y}" class="hs-s"/>`;
/** fixed pump at centre x,y, outlet up; with electric motor at left; variable = arrow through */
export function hsPump(x, y, o = {}) {
  let b = `<circle cx="${x}" cy="${y}" r="15" class="hs-s hs-bg"/><path d="M${x},${y - 15} L${x - 6},${y - 5} L${x + 6},${y - 5} Z" class="hs-fill"/>`;
  if (o.variable) b += hsArrow(x - 16, y + 14, x + 16, y - 14);
  b += `<path d="M${x - 15},${y - 2} H${x - 30} M${x - 15},${y + 2} H${x - 30}" class="hs-s"/><circle cx="${x - 42}" cy="${y}" r="12" class="hs-s hs-bg"/><text x="${x - 42}" y="${y + 4}" class="hs-sym-t" text-anchor="middle">M</text>`;
  if (o.on !== undefined) b += `<circle cx="${x - 42}" cy="${y - 17}" r="3" class="${o.on ? "hs-on" : "hs-off"}"/>`;
  return grp(o.info || "pump", b) + (o.tag ? hsTag(x + 18, y + 14, o.tag) : "");
}
/** relief valve (normally closed), inlet top (x, y−16), outlet bottom (x, y+16); open 0…1 shows the arrow moving onto the axis */
export function hsRelief(x, y, o = {}) {
  const op = o.open || 0, ax = x + 7 - 7 * Math.min(1, op);
  let b;
  b = `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-s hs-bg"/><path d="M${ax},${y - 11} L${ax},${y + 8}" class="hs-s"/>${head(ax, y + 11, Math.PI / 2)}`;
  b += hsPilot([[x, y - 18], [x - 22, y - 18], [x - 22, y], [x - 14, y]]) + spring(x + 14, y, 22, false, o.adj !== false);
  b += `<path d="M${x},${y - 14} V${y - 18} M${x},${y + 14} V${y + 18}" class="hs-s"/>`;
  if (op > 0.02) b += `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-act"/>`;
  return grp(o.info || "relief", b) + (o.tag ? hsTag(x + 18, y - 16, o.tag) : "") + (o.set ? hsTxt(x + 18, y + 26, o.set, "start", "hs-set") : "");
}
/** pressure reducing valve (normally open), inlet top, outlet bottom, pilot from outlet, drain to the right */
export function hsPRV(x, y, o = {}) {
  const op = o.open ?? 1, ax = x + 8 * (1 - op);
  let b = `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-s hs-bg"/><path d="M${ax},${y - 11} L${ax},${y + 8}" class="hs-s"/>${head(ax, y + 11, Math.PI / 2)}`;
  b += hsPilot([[x, y + 18], [x - 22, y + 18], [x - 22, y], [x - 14, y]]) + spring(x + 14, y, 22) + hsDrain([[x + 8, y + 14], [x + 8, y + 24]]);
  b += `<path d="M${x},${y - 14} V${y - 18} M${x},${y + 14} V${y + 18}" class="hs-s"/>`;
  return grp(o.info || "prv", b) + (o.tag ? hsTag(x + 18, y - 16, o.tag) : "") + (o.set ? hsTxt(x + 18, y + 28, o.set, "start", "hs-set") : "");
}
/** sequence valve (normally closed, pilot from inlet, external drain) with reverse check at the left */
export function hsSeq(x, y, o = {}) {
  const op = o.open || 0, ax = x + 7 - 7 * Math.min(1, op);
  let b = `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-s hs-bg"/><path d="M${ax},${y + 11} L${ax},${y - 8}" class="hs-s"/>${head(ax, y - 11, -Math.PI / 2)}`;
  b += hsPilot([[x, y + 18], [x - 22, y + 18], [x - 22, y], [x - 14, y]]) + spring(x + 14, y, 22) + hsDrain([[x + 8, y - 14], [x + 8, y - 22], [x + 40, y - 22]]);
  b += `<path d="M${x},${y - 14} V${y - 18} M${x},${y + 14} V${y + 18}" class="hs-s"/>`;
  if (o.check) b += hsCheck(x - 40, y, "down", {}) + `<path d="M${x},${y - 18} V${y - 26} H${x - 40} V${y - 12} M${x},${y + 18} V${y + 26} H${x - 40} V${y + 12}" class="hs-s"/>`;
  if (op > 0.02) b += `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-act"/>`;
  return grp(o.info || "seq", b) + (o.tag ? hsTag(x + 18, y - 26, o.tag) : "") + (o.set ? hsTxt(x + 18, y + 30, o.set, "start", "hs-set") : "");
}
/** check valve at x,y; dir = free flow direction "up"|"down"|"left"|"right"; ports ±12 */
export function hsCheck(x, y, dir = "up", o = {}) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  let b = `<g transform="rotate(${rot} ${x} ${y})"><path d="M${x},${y + 12} V${y + 6} M${x - 7},${y - 3} L${x},${y + 6} L${x + 7},${y - 3}" class="hs-s"/><circle cx="${x}" cy="${y - 3}" r="5" class="hs-s ${o.open ? "hs-actf" : "hs-bg"}"/><path d="M${x},${y - 8} V${y - 12}" class="hs-s"/>${o.spring ? `<path d="M${x},${y - 8} l4,-2 l-8,-2 l4,-1" class="hs-s"/>` : ""}</g>`;
  return o.raw ? b : grp(o.info || "check", b) + (o.tag ? hsTag(x + 10, y - 8, o.tag) : "");
}
/** pilot-operated check valve: check in a box, pilot X from the side (px,py) */
export function hsPOC(x, y, dir, o = {}) {
  let b = `<rect x="${x - 13}" y="${y - 13}" width="26" height="26" class="hs-s hs-bg hs-dash2"/>` + hsCheck(x, y, dir, { raw: true, open: o.open });
  if (o.px !== undefined) b += hsPilot([[o.px, o.py], [x + (o.px < x ? -13 : 13), o.py]]);
  return grp(o.info || "poc", b) + (o.tag ? hsTag(x + 16, y - 10, o.tag) : "");
}
/** counterbalance valve: relief-type valve, controlled flow inlet TOP (x, y−28) → outlet BOTTOM (x, y+28), internal pilot from the inlet,
 *  external pilot X from (px,py), free-flow check bottom → top; all enclosed */
export function hsCBV(x, y, o = {}) {
  const op = o.open || 0, ax = x + 7 - 7 * Math.min(1, op);
  let b = `<rect x="${x - 46}" y="${y - 28}" width="92" height="56" class="hs-encl"/>`;
  b += `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-s hs-bg"/><path d="M${ax},${y - 11} L${ax},${y + 8}" class="hs-s"/>${head(ax, y + 11, Math.PI / 2)}`;
  b += hsPilot([[x, y - 18], [x - 20, y - 18], [x - 20, y - 4], [x - 14, y - 4]]) + spring(x + 14, y, 20);
  b += `<path d="M${x},${y - 14} V${y - 22} H${x - 34} V${y - 12} M${x},${y + 14} V${y + 22} H${x - 34} V${y + 12}" class="hs-s"/>` + hsCheck(x - 34, y, "up", { raw: true, open: o.chk });
  b += `<path d="M${x},${y - 22} V${y - 28} M${x},${y + 22} V${y + 28}" class="hs-s"/>`;
  if (o.px !== undefined) b += hsPilot([[o.px, o.py], [x + 46, o.py], [x + 46, y + 6], [x + 14, y + 6]].slice(o.px > x ? 0 : 0));
  if (op > 0.02) b += `<rect x="${x - 14}" y="${y - 14}" width="28" height="28" class="hs-act"/>`;
  return grp(o.info || "cbv", b) + (o.tag ? hsTag(x + 50, y - 18, o.tag) : "") + (o.set ? hsTxt(x + 50, y + 24, o.set, "start", "hs-set") : "");
}
/** 2-way pressure-compensated flow control valve, inlet at bottom (x,y+18) → outlet top (x,y−18); optional bypass check */
export function hsFCV(x, y, o = {}) {
  let b = `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" class="hs-s hs-bg ${o.reg ? "hs-regbox" : ""}"/><path d="M${x - 5},${y - 9} Q${x},${y} ${x - 5},${y + 9} M${x + 5},${y - 9} Q${x},${y} ${x + 5},${y + 9}" class="hs-s"/>${hsArrow(x - 10, y + 10, x + 10, y - 10)}<path d="M${x - 11},${y - 13} v6 M${x - 13},${y - 11} h4" class="hs-s"/>`;
  b += `<path d="M${x},${y - 15} V${y - 20} M${x},${y + 15} V${y + 20}" class="hs-s"/>`;
  if (o.check) b += `<path d="M${x},${y - 20} V${y - 26} H${x + 32} V${y - 12} M${x},${y + 20} V${y + 26} H${x + 32} V${y + 12}" class="hs-s"/>` + hsCheck(x + 32, y, o.check, { raw: true, open: o.chkOpen });
  return grp(o.info || "fcv", b) + (o.tag ? hsTag(x - 18, y - 20, o.tag, "end") : "") + (o.set ? hsTxt(x - 18, y + 26, o.set, "end", "hs-set") : "");
}
/** fixed orifice (throttle) at x,y vertical */
export const hsOrif = (x, y, o = {}) => grp(o.info || "orif", `<path d="M${x},${y - 12} V${y + 12}" class="hs-s"/><path d="M${x - 6},${y - 7} Q${x},${y} ${x - 6},${y + 7} M${x + 6},${y - 7} Q${x},${y} ${x + 6},${y + 7}" class="hs-s"/>`) + (o.tag ? hsTag(x + 9, y - 6, o.tag) : "");
/** gauge at x,y (r 12) with value text */
export function hsGauge(x, y, p, o = {}) {
  const fs = o.fs || 16e6, a = (-225 + 270 * Math.max(0, Math.min(1, p / fs))) * Math.PI / 180;
  const b = `<circle cx="${x}" cy="${y}" r="12" class="hs-s hs-bg"/><path d="M${x},${y} L${r1(x + 9 * Math.cos(a))},${r1(y + 9 * Math.sin(a))}" class="hs-needle"/>`;
  const val = (p / 1e6).toFixed(Math.abs(p) < 10e6 ? 2 : 1);
  return grp("gauge", b) + hsTxt(x + (o.ta === "end" ? -15 : 15), y + 4, `${o.label ? o.label + " " : ""}${val} MPa`, o.ta || "start");
}
/** accumulator at x,y (bottom port at y+28) */
export function hsAcc(x, y, o = {}) {
  const fr = Math.max(0, Math.min(1, o.fill || 0));
  const b = `<rect x="${x - 13}" y="${y - 24}" width="26" height="48" rx="13" class="hs-s hs-bg"/><rect x="${x - 12}" y="${r1(y + 23 - 46 * fr * 0.9)}" width="24" height="${r1(46 * fr * 0.9)}" rx="4" class="hs-oil"/><path d="M${x - 13},${y} H${x + 13}" class="hs-s"/><path d="M${x},${y + 24} V${y + 28}" class="hs-s"/><text x="${x}" y="${y - 8}" class="hs-sym-t" text-anchor="middle">N₂</text>`;
  return grp(o.info || "acc", b) + (o.tag ? hsTag(x + 16, y - 16, o.tag) : "") + (o.set ? hsTxt(x + 16, y + 2, o.set, "start", "hs-set") : "");
}
/** hydraulic motor (bidirectional) at x,y: port A bottom (x, y+16), port B top (x, y−16), shaft to the right (x+16 … x+34); th = rotation marker */
export function hsMotor(x, y, o = {}) {
  const th = o.th || 0;
  const b = `<circle cx="${x}" cy="${y}" r="16" class="hs-s hs-bg"/><path d="M${x},${y - 16} L${x - 5},${y - 7} L${x + 5},${y - 7} Z M${x},${y + 16} L${x - 5},${y + 7} L${x + 5},${y + 7} Z" class="hs-tri"/><path d="M${x},${y} L${r1(x + 12 * Math.cos(th))},${r1(y + 12 * Math.sin(th))}" class="hs-rot"/><path d="M${x + 16},${y - 2} H${x + 34} M${x + 16},${y + 2} H${x + 34}" class="hs-s"/>`;
  return grp(o.info || "hmotor", b) + (o.tag ? hsTag(x - 20, y - 4, o.tag, "end") : "");
}
/** spring-applied brake on a shaft at x,y (release port at bottom x, y+22) */
export function hsBrake(x, y, o = {}) {
  const b = `<rect x="${x - 10}" y="${y - 16}" width="20" height="32" class="hs-s ${o.applied ? "hs-brk" : "hs-bg"}"/><path d="M${x - 10},${y - 16} L${x + 10},${y + 16}" class="hs-s"/>` + spring(x + 10, y - 8, 16, false, false) + `<path d="M${x},${y + 16} V${y + 22}" class="hs-s"/>`;
  return grp(o.info || "brake", b) + (o.tag ? hsTag(x + 12, y + 28, o.tag) : "") + hsTxt(x, y - 22, o.applied ? "APPLIED" : "released", "middle", o.applied ? "hs-warn" : "hs-ok");
}
/** shuttle valve: inputs left/right (x∓16, y), output top (x, y−10) */
export const hsShuttle = (x, y, o = {}) => grp(o.info || "shuttle", `<rect x="${x - 14}" y="${y - 7}" width="28" height="14" class="hs-s hs-bg"/><circle cx="${x + (o.side || 0) * 7}" cy="${y}" r="4.5" class="hs-s"/><path d="M${x - 14},${y} H${x - 16} M${x + 14},${y} H${x + 16}" class="hs-s"/>`) + (o.tag ? hsTag(x + 16, y - 9, o.tag) : "");
/** pressure switch at x,y (port at bottom y+12) */
export function hsPS(x, y, o = {}) {
  const b = `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" class="hs-s hs-bg ${o.on ? "hs-psOn" : ""}"/><path d="M${x - 6},${y + 6} L${x + 6},${y - 6}" class="hs-s"/>${head(x + 6, y - 6, -Math.PI / 4, 5)}<path d="M${x + 12},${y} h10 m-4,-4 l4,4 l-4,4" class="hs-el"/>`;
  return grp(o.info || "ps", b) + (o.tag ? hsTag(x - 14, y - 14, o.tag, "end") : "") + (o.set ? hsTxt(x + 26, y + 4, o.set, "start", "hs-set") : "");
}
/** filter (diamond) vertical, ports top/bottom */
export const hsFilter = (x, y, o = {}) => grp(o.info || "filter", `<path d="M${x},${y - 14} L${x + 11},${y} L${x},${y + 14} L${x - 11},${y} Z" class="hs-s hs-bg"/><path d="M${x - 11},${y} H${x + 11}" class="hs-pil"/>`) + (o.tag ? hsTag(x + 13, y + 4, o.tag) : "");
/** gear flow divider: inlet bottom (x, y+24), outlets (x−22, y−24) / (x+22, y−24) */
export function hsDivider(x, y, o = {}) {
  const b = `<rect x="${x - 34}" y="${y - 16}" width="68" height="32" class="hs-encl"/><circle cx="${x - 16}" cy="${y}" r="10" class="hs-s hs-bg"/><circle cx="${x + 16}" cy="${y}" r="10" class="hs-s hs-bg"/><path d="M${x - 6},${y} H${x + 6}" class="hs-mech"/><path d="M${x},${y + 16} V${y + 24} M${x - 16},${y + 10} V${y + 16} H${x + 16} V${y + 10} M${x - 16},${y - 10} V${y - 16} H${x - 22} V${y - 24} M${x + 16},${y - 10} V${y - 16} H${x + 22} V${y - 24}" class="hs-s"/>`;
  return grp(o.info || "divider", b) + (o.tag ? hsTag(x + 38, y - 4, o.tag) : "");
}
/** 4/3 or 4/2 directional valve. Centre box at x,y (box 36×30). Ports: A (x−9, y−15−8), B (x+9, …), P (x−9, y+15+8), T (x+9, …).
 *  s = −1…+1 spool position (+1 = left box "a" active = solenoid Y1). centre: closed | float | tandem | open | none (4/2). */
export function hsDcv(x, y, o = {}) {
  const w = 36, h = 30, s = o.s || 0, c = o.centre || "closed", two = c === "none";
  const off = s * w, boxes = two ? ["a", "b"] : ["a", "0", "b"];
  let inner = "";
  boxes.forEach((k, i) => {
    const X = two ? x - w / 2 + (i === 0 ? -w : 0) : x - w / 2 + (i - 1) * w, by = y - h / 2, L = X + 9, R = X + 27, top = by, bot = by + h;
    let g = `<rect x="${X}" y="${by}" width="${w}" height="${h}" class="hs-s hs-bg"/>`;
    const blk = (px, py, up) => `<path d="M${px},${py} v${up ? 7 : -7} M${px - 4},${py + (up ? 7 : -7)} h8" class="hs-s"/>`;
    if (k === "a") g += hsArrow(L, bot - 2, L, top + 3) + hsArrow(R, top + 2, R, bot - 3);
    else if (k === "b") g += hsArrow(L, bot - 2, R, top + 3) + hsArrow(L, top + 2, R, bot - 3);
    else if (c === "closed") g += blk(L, top, true) + blk(R, top, true) + blk(L, bot, false) + blk(R, bot, false);
    else if (c === "float") g += `<path d="M${L},${top} V${top + 10} H${R} M${R},${top} V${bot}" class="hs-s"/>` + blk(L, bot, false);
    else if (c === "tandem") g += blk(L, top, true) + blk(R, top, true) + `<path d="M${L},${bot} V${bot - 10} H${R} V${bot}" class="hs-s"/>`;
    else if (c === "open") g += `<path d="M${L},${top} V${bot} M${R},${top} V${bot} M${L},${y} H${R}" class="hs-s"/>`;
    inner += g;
  });
  // solenoids + springs at both ends (4/2: solenoid left, spring right)
  const left = x - w / 2 - w, right = two ? x + w / 2 : x + w / 2 + w;
  const sol = (sx, dirL, on, key, lab) => `<g class="hs-solb" data-hcact="${key}"><rect x="${dirL ? sx - 14 : sx}" y="${y - 9}" width="14" height="18" class="hs-s ${on ? "hs-solon" : "hs-bg"}"/><path d="M${dirL ? sx - 14 : sx},${y + 9} L${dirL ? sx : sx + 14},${y - 9}" class="hs-s"/><text x="${dirL ? sx - 7 : sx + 7}" y="${y - 13}" class="hs-tag" text-anchor="middle">${lab}</text></g>`;
  inner += sol(left, true, s > 0.5, o.keyA || "sol:1", o.solA || "Y1");
  if (!two) inner += sol(right, false, s < -0.5, o.keyB || "sol:-1", o.solB || "Y2");
  else inner += spring(right, y, 18, false, false);
  let b = `<g transform="translate(${r1(off)},0)">${inner}</g>`;
  // fixed port stubs
  b += `<path d="M${x - 9},${y - h / 2} v-8 M${x + 9},${y - h / 2} v-8 M${x - 9},${y + h / 2} v8 M${x + 9},${y + h / 2} v8" class="hs-s"/>`;
  b += `<text x="${x - 13}" y="${y - h / 2 - 2}" class="hs-port" text-anchor="end">A</text><text x="${x + 13}" y="${y - h / 2 - 2}" class="hs-port">B</text><text x="${x - 13}" y="${y + h / 2 + 9}" class="hs-port" text-anchor="end">P</text><text x="${x + 13}" y="${y + h / 2 + 9}" class="hs-port">T</text>`;
  return grp(o.info || "dcv", b) + (o.tag ? hsTag(x, y + h / 2 + 22, o.tag, "middle") : "");
}
/** cylinder. vertical: body x…x+40, y (top) … y+len, rod upward; horizontal: body x … x+len, y … y+34, rod to the right.
 *  frac = stroke fraction 0…1, pA/pB chamber pressures for the fill colour. Returns {svg, tip:[x,y], portA:[x,y], portB:[x,y]} */
export function hsCyl(x, y, o = {}) {
  const len = o.len || 150, fr = Math.max(0, Math.min(1, o.frac || 0)), pm = o.pm || 12e6;
  let svg, tip, pA, pB;
  if (o.vert) {
    const W = 40, yp = y + len - 6 - fr * (len - 14), rodL = len + 6;
    svg = `<rect x="${x + 1}" y="${r1(yp + 3)}" width="${W - 2}" height="${r1(y + len - yp - 4)}" style="fill:${hsPc(o.pA || 0, pm)}" class="hs-ch"/><rect x="${x + 1}" y="${y + 1}" width="${W - 2}" height="${r1(yp - y - 4)}" style="fill:${hsPc(o.pB || 0, pm)}" class="hs-ch"/>`;
    svg += `<rect x="${x}" y="${y}" width="${W}" height="${len}" class="hs-s hs-nofill"/><rect x="${x + 1}" y="${r1(yp - 3)}" width="${W - 2}" height="6" class="hs-piston"/><rect x="${x + W / 2 - 5}" y="${r1(yp - rodL)}" width="10" height="${rodL - 3}" class="hs-rod"/>`;
    tip = [x + W / 2, yp - rodL]; pA = [x + W, y + len - 8]; pB = [x + W, y + 8];
    svg += `<path d="M${x + W},${y + len - 8} h6 M${x + W},${y + 8} h6" class="hs-s"/>`;
    pA = [x + W + 6, y + len - 8]; pB = [x + W + 6, y + 8];
  } else {
    const H = 34, xp = x + 6 + fr * (len - 14), rodL = len + 6;
    svg = `<rect x="${x + 1}" y="${y + 1}" width="${r1(xp - x - 4)}" height="${H - 2}" style="fill:${hsPc(o.pA || 0, pm)}" class="hs-ch"/><rect x="${r1(xp + 3)}" y="${y + 1}" width="${r1(x + len - xp - 4)}" height="${H - 2}" style="fill:${hsPc(o.pB || 0, pm)}" class="hs-ch"/>`;
    svg += `<rect x="${x}" y="${y}" width="${len}" height="${H}" class="hs-s hs-nofill"/><rect x="${r1(xp - 3)}" y="${y + 1}" width="6" height="${H - 2}" class="hs-piston"/><rect x="${r1(xp + 3)}" y="${y + H / 2 - 5}" width="${rodL - 3}" height="10" class="hs-rod"/>`;
    tip = [xp + rodL, y + H / 2];
    svg += `<path d="M${x + 8},${y + H} v6 M${x + len - 8},${y + H} v6" class="hs-s"/>`;
    pA = [x + 8, y + H + 6]; pB = [x + len - 8, y + H + 6];
  }
  return { svg: grp(o.info || "cyl", svg) + (o.tag ? hsTag(o.vert ? x - 4 : x, o.vert ? y + len + 14 : y - 6, o.tag, o.vert ? "start" : "start") : ""), tip, portA: pA, portB: pB };
}
/** load mass block on a rod tip (vertical: block above the tip) */
export function hsLoad(tip, o = {}) {
  const [x, y] = tip, w = o.w || 90, h = o.h || 30;
  if (o.vert) return grp("load", `<rect x="${x - w / 2}" y="${y - h}" width="${w}" height="${h}" class="hs-load"/><text x="${x}" y="${y - h / 2 + 4}" class="hs-sym-t" text-anchor="middle">${esc(o.label || "")}</text>`) + (o.g ? hsArrow(x + w / 2 + 10, y - h, x + w / 2 + 10, y - h + 24) + hsTxt(x + w / 2 + 14, y - h + 18, "g", "start") : "");
  return grp("load", `<rect x="${x}" y="${y - h / 2}" width="${w}" height="${h}" class="hs-load"/><text x="${x + w / 2}" y="${y + 4}" class="hs-sym-t" text-anchor="middle">${esc(o.label || "")}</text>`) + (o.F ? hsArrow(x + w + 30, y, x + w + 4, y) + hsTxt(x + w + 6, y - 6, o.F, "start") : "");
}
/** electric signal line (dashed thin, e.g. pressure switch → PLC) */
export const hsElec = (pts) => `<path d="M${pts.map((v) => r1(v[0]) + "," + r1(v[1])).join(" L")}" class="hs-el"/>`;
