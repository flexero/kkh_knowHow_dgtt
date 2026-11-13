/* AS/RS tab – item 3: drawing helpers on top of the robot symbol library (web/robotckt_sym.js, IEC 60617 symbols).
 * - own cross-reference registry (the robot page clears its own REG; ours must not collide)
 * - every text ≥ 11 px (the drawings are also exported as docs/img/33_*.svg)
 * - own frame + title block for the AS/RS ("EXAMPLE – not for manufacture")
 * - extra symbols: sensor, inverter module, conductor rail with current collectors, encoder, I/O module, filled arrow.
 */
import { pen as basePen, PW, PH, colOf, esc } from "./robotckt_sym.js";

export { PW, PH, esc };
export const X0 = 30, X1 = 1160, NCOL = 8, CW = (X1 - X0) / NCOL;
export const REG = new Map();                       // key -> [{p, c}]
export const colX = (c) => X0 + (c - 0.5) * CW;     // centre x of column c

export function mkPen(page, opt = {}) {
  const P = basePen(page);
  P.reg = (key, x) => { if (!opt.reg) return P; const l = REG.get(key) || []; if (!l.some((e) => e.p === page && e.c === colOf(x))) l.push({ p: page, c: colOf(x) }); REG.set(key, l); return P; };
  P.ref = (key) => { const l = REG.get(key); return l && l.length ? l.map((e) => `/${e.p}.${e.c}`).join(" ") : ""; };
  P.tag = (x, y, tag, lines = [], o = {}) => {
    P.t(x, y, tag, { b: 1, a: o.a, s: o.s || 12.5 });
    (Array.isArray(lines) ? lines : [lines]).forEach((l, i) => l && P.t(x, y + 13 + i * 12.5, l, { a: o.a, s: 11, c: o.c || "mut" }));
    return P;
  };
  P.xref = (x, y, txt, o = {}) => P.t(x, y, txt, { a: o.a || "start", s: 11, c: "ref" });
  const w0 = P.w;
  P.w = (pts, cls, st, o = {}) => w0(pts, cls, st, { flow: false, ...o });     // no animated flow unless asked for
  const term0 = P.term;
  P.term = (x, y, lab, o = {}) => { term0(x, y, "", o); if (lab) P.t(x + (o.left ? -6 : 6), y + 4, lab, { a: o.left ? "end" : "start", s: 11, c: "mut" }); return P; };
  const coil0 = P.coil;
  P.coil = (x, y, o = {}) => coil0(x, y, { ...o, t: false });
  P.motor = (x, y, rr, o = {}) => {
    P.raw(`<g class="ck-sym${o.on ? " ck-on" : ""}${o.regen ? " sr-regen" : ""}"><circle cx="${x}" cy="${y}" r="${rr}" class="ck-fill"/></g>`);
    P.t(x, y - 1, "M", { a: "middle", s: rr > 20 ? 15 : 13, b: 1 }); P.t(x, y + 13, o.sub || "3~", { a: "middle", s: 11 });
    return P;
  };
  /* sensor box (IEC 60617 style square): kind prox | photo | laser | bar | grid | cell | enc | speed */
  P.sens = (x, y, kind, o = {}) => {
    const w = o.w || 40, h = o.h || 30, on = o.on, bad = o.bad;
    P.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="ck-box${on ? " ck-boxon" : ""}${bad ? " ck-boxbad" : ""}"/>`);
    const cx = x + w / 2, cy = y + h / 2;
    if (kind === "prox") P.raw(`<path d="M${cx},${cy - 9} L${cx + 9},${cy} L${cx},${cy + 9} L${cx - 9},${cy} Z" class="ck-thin"/>`);
    else if (kind === "photo") P.raw(`<path d="M${cx - 12},${cy - 4} L${cx + 4},${cy - 4} M${cx - 12},${cy + 4} L${cx + 4},${cy + 4}" class="ck-thin"/><path d="M${cx + 4},${cy - 7} L${cx + 10},${cy - 4} L${cx + 4},${cy - 1} Z M${cx + 4},${cy + 1} L${cx + 10},${cy + 4} L${cx + 4},${cy + 7} Z" class="sr-fill"/>`);
    else if (kind === "laser") P.raw(`<path d="M${cx - 13},${cy} H${cx + 6}" class="ck-thin"/><path d="M${cx + 6},${cy - 4} L${cx + 13},${cy} L${cx + 6},${cy + 4} Z" class="sr-fill"/><circle cx="${cx - 13}" cy="${cy}" r="3" class="sr-fill"/>`);
    else if (kind === "bar") P.raw(`<path d="M${cx - 12},${cy - 8} V${cy + 8} M${cx - 8},${cy - 8} V${cy + 8} M${cx - 3},${cy - 8} V${cy + 8} M${cx + 1},${cy - 8} V${cy + 8} M${cx + 6},${cy - 8} V${cy + 8} M${cx + 11},${cy - 8} V${cy + 8}" class="ck-thin"/>`);
    else if (kind === "grid") P.raw(`<path d="M${cx - 12},${cy - 9} H${cx + 12} M${cx - 12},${cy - 3} H${cx + 12} M${cx - 12},${cy + 3} H${cx + 12} M${cx - 12},${cy + 9} H${cx + 12}" class="ck-thin sr-dash"/>`);
    else if (kind === "cell") P.t(cx, cy + 4, "kg", { a: "middle", s: 12, b: 1 });
    else if (kind === "enc") P.t(cx, cy + 4, "ENC", { a: "middle", s: 11, b: 1 });
    else if (kind === "speed") P.t(cx, cy + 4, "n >", { a: "middle", s: 12, b: 1 });
    else if (kind) P.t(cx, cy + 4, kind, { a: "middle", s: 11, b: 1 });
    return P;
  };
  /* inverter / infeed module (rectangle with diagonal, ~ and = marks) */
  P.inv = (x, y, w, h, o = {}) => {
    P.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="ck-box${o.on ? " ck-boxon" : ""}${o.bad ? " ck-boxbad" : ""}${o.regen ? " sr-boxregen" : ""}"/><path d="M${x},${y + h} L${x + w},${y}" class="ck-thin"/>`);
    P.t(x + 8, y + 17, o.top || "=", { s: 14 }); P.t(x + w - 8, y + h - 7, o.bot || "~", { s: 14, a: "end" });
    return P;
  };
  /* I/O module box with pins: pins = [{y, l}] on side "l" or "r" */
  P.mod = (x, y, w, h, title, pins = [], o = {}) => {
    P.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="ck-box${o.on ? " ck-boxon" : ""}${o.bad ? " ck-boxbad" : ""}${o.dash ? " ck-dash" : ""}"/>`);
    if (title) P.t(x + w / 2, y + 15, title, { a: "middle", s: 11.5, b: 1 });
    pins.forEach((p) => { const px = p.side === "r" ? x + w : x; P.t(px + (p.side === "r" ? -5 : 5), p.y + 4, p.l, { a: p.side === "r" ? "end" : "start", s: 11, c: "mut" }); if (p.led !== undefined) P.led(px + (p.side === "r" ? -4 - (p.l.length * 6 + 8) : 4 + p.l.length * 6 + 8), p.y, p.led, { r: 3.5, bad: p.bad }); });
    return P;
  };
  /* filled arrow head pointing dir (r|l|u|d) at (x, y) – used instead of arrow characters */
  P.arr = (x, y, dir = "r", o = {}) => {
    const s = o.s || 6, d = { r: [[x, y], [x - s * 1.6, y - s], [x - s * 1.6, y + s]], l: [[x, y], [x + s * 1.6, y - s], [x + s * 1.6, y + s]], d: [[x, y], [x - s, y - s * 1.6], [x + s, y - s * 1.6]], u: [[x, y], [x - s, y + s * 1.6], [x + s, y + s * 1.6]] }[dir];
    P.raw(`<path d="M${d.map((p) => p.join(",")).join(" L")} Z" class="${o.cls || "sr-arr"}"/>`);
    return P;
  };
  /* power-flow arrow along a line from (x1,y1) to (x2,y2) with label */
  P.flowArrow = (x1, y1, x2, y2, o = {}) => {
    P.raw(`<path d="M${x1},${y1} L${x2},${y2}" class="${o.cls || "sr-parrow"}"/>`);
    const dir = Math.abs(x2 - x1) > Math.abs(y2 - y1) ? (x2 > x1 ? "r" : "l") : (y2 > y1 ? "d" : "u");
    P.arr(x2, y2, dir, { cls: o.head || "sr-arrp", s: 7 });
    return P;
  };
  /* conductor rail: n horizontal conductors from xa to xb at y (spacing dy), labels at left; collector at xc */
  P.rail = (xa, xb, y, labels, o = {}) => {
    const dy = o.dy || 16;
    labels.forEach((l, i) => {
      const yy = y + i * dy;
      P.raw(`<rect x="${xa}" y="${yy - 3}" width="${xb - xa}" height="6" rx="2" class="sr-railc${l === "PE" ? " sr-railpe" : ""}"/>`);
      P.t(xa - 6, yy + 4, l, { a: "end", s: 11, b: 1 });
    });
    P.raw(`<rect x="${xa - 2}" y="${y - 10}" width="${xb - xa + 4}" height="${(labels.length - 1) * dy + 20}" rx="4" class="sr-railhouse"/>`);
    return P;
  };
  return P;
}

/* frame: border, columns 1–8, rows A–F, title block (AS/RS) */
export function frame(P, o) {
  const s = [];
  s.push(`<rect x="0" y="0" width="${PW}" height="${PH}" class="sr-page"/>`);
  s.push(`<rect x="16" y="16" width="${PW - 32}" height="${PH - 32}" class="ck-frame"/>`);
  s.push(`<rect x="${X0}" y="32" width="${X1 - X0}" height="${764 - 32}" class="ck-frame2"/>`);
  for (let i = 0; i < NCOL; i++) {
    const x = X0 + i * CW;
    s.push(`<path d="M${x},16 V32" class="ck-frame2"/><text x="${x + CW / 2}" y="28.5" text-anchor="middle" class="ck-tx ck-mut" font-size="11">${i + 1}</text>`);
  }
  "ABCDEF".split("").forEach((L, i) => { const y = 32 + i * 122; s.push(`<path d="M16,${y} H${X0}" class="ck-frame2"/><text x="23" y="${y + 65}" text-anchor="middle" class="ck-tx ck-mut" font-size="11">${L}</text>`); });
  const y = 764, h = PH - 16 - y;
  const cells = [[X0, 230, "Project", "Compressor factory – AS/RS raw materials"], [X0 + 230, 300, "Page title", o.title], [X0 + 530, 190, "Function / location", o.loc || "=LOG.ASRSRAW"],
    [X0 + 720, 170, "Drawn to", "IEC 60617 · 81346 · 60204-1/-32"], [X0 + 890, 180, "Status", "EXAMPLE – not for manufacture"], [X0 + 1070, X1 - X0 - 1070, "Page", `${o.page} / ${o.of}`]];
  cells.forEach(([x, w, k, v]) => {
    s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="ck-frame2"/>`);
    s.push(`<text x="${x + 5}" y="${y + 14}" class="ck-tx ck-mut" font-size="11">${esc(k)}</text>`);
    s.push(`<text x="${x + 5}" y="${y + 33}" class="ck-tx${k === "Status" ? " ck-warnTx" : ""}" font-size="${k === "Page" ? 16 : 12}"${k === "Page title" || k === "Page" || k === "Status" ? ' font-weight="700"' : ""}>${esc(v)}</text>`);
    if (k === "Status") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="11">check the AS/RS supplier's docs</text>`);
    if (k === "Project") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="11">PLC-ASRS-RAW · S7-1515F-2 PN</text>`);
    if (k === "Function / location") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="11">${esc(o.loc2 || "+CAB01 · +CRN01 · +CAB02")}</text>`);
    if (k === "Drawn to") s.push(`<text x="${x + 5}" y="${y + 50}" class="ck-tx ck-mut" font-size="11">EN 528 · ISO 13849</text>`);
  });
  P.raw(s.join(""));
}
