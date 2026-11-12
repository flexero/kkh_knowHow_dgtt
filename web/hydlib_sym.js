/* Hydraulics – reusable ISO 1219-1 symbols (simplified, drawn as SVG strings) + principle / cut-away drawings.
 * Builder A (item 1 element data book). Builder B may import it.
 *   import { symbol, SYMBOL_KEYS, SYMBOL_INFO, drawing, DRAWING_KEYS } from "./hydlib_sym.js";
 *   symbol("dv", {ways:4, pos:["par","closed","cross"], l:"sol", r:"sol"})  → "<svg …>"   (stroke = currentColor → dark theme OK)
 *   drawing("spool") → "<svg …>" (uses CSS classes hl-m metal, hl-o oil, hl-h high pressure, hl-a accent from hydlib.css; falls back to currentColor)
 * Every symbol is a simplified teaching version of the ISO 1219-1 symbol – the real circuit diagram follows ISO 1219-1/-2.
 */
const f1 = (v) => Math.round(v * 10) / 10;
const L = (x1, y1, x2, y2, ex = "") => `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}"${ex}/>`;
const P = (d, ex = "") => `<path d="${d}"${ex}/>`;
const C = (cx, cy, r, ex = "") => `<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${r}"${ex}/>`;
const R = (x, y, w, h, ex = "") => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}"${ex}/>`;
const T = (x, y, t, ex = "") => `<text x="${f1(x)}" y="${f1(y)}" font-size="7" font-family="sans-serif" fill="currentColor" stroke="none"${ex}>${t}</text>`;
const DASH = ' stroke-dasharray="4 2.5"', DRN = ' stroke-dasharray="1.6 1.8"', DDOT = ' stroke-dasharray="8 2 1.5 2" stroke-width="0.9"';
const FILL = ' fill="currentColor" stroke="none"';
function head(x1, y1, x2, y2, s = 5) {
  const a = Math.atan2(y2 - y1, x2 - x1), c = Math.cos(a), si = Math.sin(a);
  const p1 = [x2 - s * c + s * 0.45 * si, y2 - s * si - s * 0.45 * c], p2 = [x2 - s * c - s * 0.45 * si, y2 - s * si + s * 0.45 * c];
  return `<path d="M${f1(x2)} ${f1(y2)}L${f1(p1[0])} ${f1(p1[1])}L${f1(p2[0])} ${f1(p2[1])}Z"${FILL}/>`;
}
const AR = (x1, y1, x2, y2, s = 5) => L(x1, y1, x2, y2) + head(x1, y1, x2, y2, s);
/* zig-zag spring from (x1,y1) to (x2,y2) */
function spring(x1, y1, x2, y2, n = 5, w = 4) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  let d = `M${f1(x1)} ${f1(y1)}`;
  for (let i = 1; i <= 2 * n; i++) { const t = (i - 0.5) / (2 * n), s = i % 2 ? w : -w; d += `L${f1(x1 + dx * t + nx * s)} ${f1(y1 + dy * t + ny * s)}`; }
  return P(d + `L${f1(x2)} ${f1(y2)}`);
}
const adj = (cx, cy, r = 14) => AR(cx - r, cy + r * 0.8, cx + r, cy - r * 0.8, 4.5); // "adjustable" diagonal arrow
const wrap = (w, h, body, label) => `<svg class="hl-sym" viewBox="0 0 ${w} ${h}" width="${Math.round(w * 1.5)}" height="${Math.round(h * 1.5)}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
const solBox = (x, y, right) => R(right ? x : x - 11, y, 11, 14) + L(right ? x : x - 11, y + 14, right ? x + 11 : x, y);
/* check valve (ball on seat). free flow from (x,y+..) towards dir. vertical, free flow upward if up=true */
function checkV(x, y, up = true, spr = false) {
  const s = up ? 1 : -1;
  let b = L(x, y + 7 * s, x - 6, y - 2 * s) + L(x, y + 7 * s, x + 6, y - 2 * s) + C(x, y - 3 * s, 4.5);
  if (spr) b += spring(x + 4, y - 8 * s, x + 11, y - 17 * s, 3, 2.5);
  return b;
}
function checkH(x, y, right = true) { // free flow to the right if right=true
  const s = right ? 1 : -1;
  return L(x - 7 * s, y, x + 2 * s, y - 6) + L(x - 7 * s, y, x + 2 * s, y + 6) + C(x + 3 * s, y, 4.5);
}

/* ------------------------------------------------------------------ pumps, motors */
function rotor(o, isMotor) {
  const cx = 50, cy = 45, r = 15;
  let b = C(cx, cy, r);
  const tri = (top) => {
    const yb = top ? cy - r : cy + r, s = top ? 1 : -1;
    return isMotor ? P(`M${cx - 5.5} ${yb + 1.2 * s}L${cx + 5.5} ${yb + 1.2 * s}L${cx} ${yb + 9 * s}Z`, FILL)
      : P(`M${cx} ${yb}L${cx - 5} ${yb + 8.5 * s}L${cx + 5} ${yb + 8.5 * s}Z`, FILL);
  };
  b += tri(true); if (o.bidir) b += tri(false);
  b += L(cx, cy - r, cx, 6) + L(cx, cy + r, cx, 84);
  b += T(cx + 3, 11, isMotor ? "A" : "P") + T(cx + 3, 83, isMotor ? "B" : (o.bidir ? "B" : "S"));
  if (o.hand) { b += L(cx - r, cy, 18, cy) + L(18, cy, 10, 32) + C(9, 30, 2.5); b += T(4, 62, "hand"); }
  else {
    b += L(cx - r, cy - 1.8, 20, cy - 1.8) + L(cx - r, cy + 1.8, 20, cy + 1.8);
    b += P(`M26 ${cy - 9}A10 10 0 0 0 26 ${cy + 9}`) + head(25, cy + 7, 26.5, cy + 9, 4);
  }
  if (o.var) b += AR(cx - 17, cy + 17, cx + 17, cy - 17);
  if (o.drain) b += L(cx + r, cy + 6, 86, cy + 6, DRN) + L(86, cy + 6, 86, 84, DRN) + T(88, 82, "L");
  if (o.brake) { // spring applied, hydraulically released brake on the shaft
    b += R(4, cy - 9, 12, 18) + spring(4, cy - 9, 4, cy + 9, 3, 2.5) + L(10, cy + 9, 10, 80, DASH) + T(1, 32, "brake");
  }
  if (o.ctrl) {
    b += R(70, 20, 14, 18); b += L(cx, 14, 77, 14, DASH) + L(77, 14, 77, 20, DASH) + head(77, 15, 77, 20, 4);
    b += spring(77, 38, 77, 54, 3, 3) + L(70, 29, cx + 9, 36);
    const lab = { pc: "pc", ls: "LS", pow: "P·Q", ep: "EP" }[o.ctrl] || o.ctrl;
    b += T(70, 64, lab);
    if (o.ctrl === "ls") b += L(84, 26, 96, 26, DASH) + T(90, 23, "X");
    if (o.ctrl === "ep") b += solBox(84, 22, true) + AR(84, 38, 96, 20, 3.5);
    if (o.ctrl === "pow") b += P("M86 40Q88 50 98 52");
  }
  return wrap(o.ctrl || o.drain ? 100 : 90, 90, b, isMotor ? "hydraulic motor" : "hydraulic pump");
}
const pump = (o = {}) => rotor(o, false);
const motor = (o = {}) => rotor(o, true);
const emotor = () => wrap(70, 60, C(30, 30, 15) + T(25, 33, "M", ' font-size="10"') + L(45, 28.2, 64, 28.2) + L(45, 31.8, 64, 31.8), "electric motor");

/* ------------------------------------------------------------------ cylinders */
function cyl(o = {}) {
  const t = o.type || "da"; let b = "";
  const portA = (x) => L(x, 41, x, 56) + T(x + 3, 55, "A"), portB = (x) => L(x, 41, x, 56) + T(x + 3, 55, "B");
  if (t === "dbl") {
    b += R(25, 15, 90, 26) + R(66, 15, 4, 26, FILL) + R(2, 25, 23, 6) + R(115, 25, 33, 6) + L(25, 28, 66, 28) + L(70, 28, 115, 28);
    b += portA(32) + portB(108);
  } else if (t === "plunger") {
    b += P("M110 15H10V41H110") + R(18, 19, 125, 18) + portA(14);
  } else if (t === "tele") {
    b += R(10, 11, 60, 34) + R(30, 16, 50, 24) + R(50, 20, 50, 16) + R(70, 24, 70, 8) + portA(16);
  } else {
    b += R(10, 15, 100, 26) + R(55, 15, 4, 26, FILL) + R(59, 25, 81, 6);
    b += portA(20);
    if (t === "sa") b += spring(64, 33, 106, 33, 6, 4) + T(103, 9, "vent") + L(100, 15, 100, 11);
    else b += portB(100);
    if (o.cush) { b += R(47, 23, 8, 10) + R(59, 23, 8, 10) + AR(14, 50, 28, 32, 3.5) + AR(94, 50, 108, 32, 3.5); }
    if (o.sensor) { b += R(25, 4, 70, 7, DASH) + T(98, 10, "position sensor"); }
  }
  const lab = { da: "double-acting cylinder", sa: "single-acting cylinder, spring return", plunger: "plunger cylinder", dbl: "double-rod cylinder", tele: "telescopic cylinder" }[t];
  return wrap(t === "da" && o.sensor ? 160 : 150, 60, b, lab);
}
function rotact() {
  let b = C(45, 35, 15) + P("M40.5 20.6L49.5 20.6L45 28Z", FILL) + P("M40.5 49.4L49.5 49.4L45 42Z", FILL);
  b += L(45, 20, 45, 6) + L(45, 50, 45, 64) + T(48, 11, "A") + T(48, 63, "B");
  b += L(60, 33.2, 78, 33.2) + L(60, 36.8, 78, 36.8) + P("M70 25A10 10 0 0 1 70 45") + head(71, 26, 70, 25, 4) + head(71, 44, 70, 45, 4);
  return wrap(90, 70, b, "semi-rotary actuator (limited angle)");
}

/* ------------------------------------------------------------------ directional valves */
const BX = 30;
function portXY(ways, name) {
  if (ways === 2) return { A: [0.5, 0], P: [0.5, 1] }[name];
  if (ways === 3) return { A: [0.5, 0], P: [0.3, 1], T: [0.7, 1] }[name];
  return { A: [0.3, 0], B: [0.7, 0], P: [0.3, 1], T: [0.7, 1] }[name];
}
function boxContent(key, ways, x0, y0) {
  const p = (n) => { const q = portXY(ways, n); return [x0 + q[0] * BX, y0 + q[1] * BX]; };
  const blk = (n) => { const [x, y] = p(n), d = y === y0 ? 1 : -1; return L(x, y, x, y + d * 8) + L(x - 4, y + d * 8, x + 4, y + d * 8); };
  const ar = (a, c) => { const [x1, y1] = p(a), [x2, y2] = p(c); return AR(x1, y1, x2, y2, 4.5); };
  const ln = (pts) => P("M" + pts.map((q) => f1(q[0]) + " " + f1(q[1])).join("L"));
  const ym = y0 + BX / 2;
  switch (key) {
    case "par": return ar("P", "A") + ar("B", "T");
    case "cross": return ar("P", "B") + ar("A", "T");
    case "closed": return blk("A") + blk("B") + blk("P") + blk("T");
    case "open": return ln([p("A"), p("P")]) + ln([p("B"), p("T")]) + ln([[p("A")[0], ym], [p("B")[0], ym]]);
    case "tandem": return ln([p("P"), [p("P")[0], ym], [p("T")[0], ym], p("T")]) + blk("A") + blk("B");
    case "float": return blk("P") + ln([p("B"), p("T")]) + ln([p("A"), [p("A")[0], ym], [p("B")[0], ym]]);
    case "regen": return blk("T") + ln([p("P"), p("A")]) + ln([[p("A")[0], ym], [p("B")[0], ym], p("B")]);
    case "o22": return ar("P", "A");
    case "c22": return blk("P") + blk("A");
    case "o32": return ar("P", "A") + blk("T");
    case "c32": return ar("A", "T") + blk("P");
    default: return T(x0 + 4, ym + 3, "?");
  }
}
function actuator(kind, x, yc, right) {
  const s = right ? 1 : -1;
  switch (kind) {
    case "sol": return solBox(x, yc - 7, right);
    case "prop": return solBox(x, yc - 7, right) + AR(x + s * 1, yc + 10, x + s * 14, yc - 10, 3.5);
    case "servo": return R(right ? x : x - 16, yc - 9, 16, 18) + L(right ? x + 4 : x - 12, yc - 9, right ? x + 4 : x - 12, yc + 9) + L(right ? x + 12 : x - 4, yc - 9, right ? x + 12 : x - 4, yc + 9) + T(right ? x + 1 : x - 16, yc - 12, "torque motor");
    case "man": return L(x, yc, x + s * 8, yc) + P(`M${x + s * 8} ${yc - 5}A5 5 0 0 ${right ? 1 : 0} ${x + s * 8} ${yc + 5}Z`);
    case "lever": return L(x, yc, x + s * 7, yc) + L(x + s * 7, yc, x + s * 13, yc - 10) + C(x + s * 13.5, yc - 11.5, 2);
    case "pilot": return L(x + s * 18, yc, x + s * 7, yc, DASH) + P(`M${x} ${yc}L${x + s * 7} ${yc - 4}L${x + s * 7} ${yc + 4}Z`, FILL);
    case "solpilot": return solBox(x + s * 8, yc - 7, right) + P(`M${x} ${yc}L${x + s * 7} ${yc - 4}L${x + s * 7} ${yc + 4}Z`, FILL);
    case "spring": return spring(x, yc, x + s * 16, yc, 4, 4);
    case "detent": return R(right ? x : x - 12, yc - 13, 12, 6) + P(`M${right ? x + 2 : x - 10} ${yc - 7}l2 -3l2 3l2 -3l2 3`) + L(x, yc, x + s * 6, yc);
    default: return "";
  }
}
function dv(o = {}) {
  const ways = o.ways || 4, pos = o.pos || ["par", "closed", "cross"], n = pos.length;
  const left = 30, y0 = 18, W = left + n * BX + 34, H = 72;
  let b = "";
  pos.forEach((k, i) => { const x0 = left + i * BX; b += R(x0, y0, BX, BX) + boxContent(k, ways, x0, y0); });
  const ni = n === 3 ? 1 : n - 1, xn = left + ni * BX;
  const names = ways === 2 ? ["A", "P"] : ways === 3 ? ["A", "P", "T"] : ["A", "B", "P", "T"];
  names.forEach((nm) => { const q = portXY(ways, nm), x = xn + q[0] * BX, y = y0 + q[1] * BX, d = q[1] ? 1 : -1; b += L(x, y, x, y + d * 11) + T(x + 2, q[1] ? y + 17 : y - 6, nm); });
  b += actuator(o.l || "sol", left, y0 + BX / 2, false) + actuator(o.r || "spring", left + n * BX, y0 + BX / 2, true);
  if (o.seat) b += T(left, H - 2, "seat (poppet) type – leak-free");
  return wrap(W, H, b, `${ways}/${n} directional valve`);
}
function servo() {
  let s = dv({ ways: 4, pos: ["par", "closed", "cross"], l: "servo", r: "none" });
  return s.replace("</svg>", L(30, 52, 120, 52, DASH) + T(60, 64, "mechanical / electrical feedback") + "</svg>").replace(/aria-label="[^"]*"/, 'aria-label="servo valve"');
}

/* ------------------------------------------------------------------ pressure valves */
function pv(o = {}) {
  const t = o.type || "relief"; let b = "", W = 100, H = 82;
  const bx = 32, by = 24; // box 32..62, 24..54
  const NO = t === "reduce" || t === "reduce3";
  b += R(bx, by, BX, BX);
  b += L(47, by + BX, 47, 78) + L(47, by, 47, 4);
  const outLab = { relief: "T", reliefPilot: "T", reliefProp: "T", unload: "T", seq: "B", cbv: "B", brake: "B", charge: "T", reduce: "A", reduce3: "A" }[t];
  b += T(50, 77, NO ? "P" : t === "cbv" || t === "brake" || t === "seq" ? "A" : "P") + T(50, 9, outLab);
  if (NO) b += AR(47, by + BX, 47, by, 4.5); else b += AR(54, by + BX - 2, 54, by + 2, 4.5);
  // spring or proportional solenoid on the right
  if (t === "reliefProp") b += solBox(62, 32, true) + AR(62, 50, 76, 30, 3.5);
  else b += spring(62, 39, 78, 39, 4, 4) + (t === "unload" || t === "cbv" || t === "brake" ? "" : adj(70, 39, 9));
  // pilot lines
  if (t === "unload") b += L(4, 39, 32, 39, DASH) + T(4, 35, "X (ext.)");
  else if (NO) b += L(47, 12, 18, 12, DASH) + L(18, 12, 18, 39, DASH) + L(18, 39, 32, 39, DASH);
  else b += L(47, 68, 18, 68, DASH) + L(18, 68, 18, 44, DASH) + L(18, 44, 32, 44, DASH);
  if (t === "cbv" || t === "brake") b += L(4, 32, 32, 32, DASH) + T(2, 29, "X pilot");
  if (t === "seq" || NO) b += L(74, 44, 74, 78, DRN) + T(77, 76, NO ? "Y" : "L");
  if (t === "reduce3") b += AR(40, by + 4, 40, by + BX - 4, 4) + T(20, 62, "A→T relief") ;
  if (t === "cbv" || t === "brake" || t === "charge") { // check valve bypass
    b += L(47, 72, 90, 72) + L(90, 72, 90, 52) + checkV(90, 44, t !== "charge", false) + L(90, 37, 90, 12) + L(90, 12, 47, 12);
    if (t === "charge") b += T(66, 9, "to accumulator");
  }
  if (t === "brake") b += T(4, 80, "one per motor port (dual)");
  if (t === "reliefPilot") { b += R(66, 52, 18, 16) + AR(78, 66, 78, 54, 3.5) + spring(84, 60, 94, 60, 3, 3) + L(66, 60, 52, 60, DASH) + T(66, 76, "pilot stage") + L(84, 54, 96, 54, DASH) + T(88, 51, "X"); W = 104; }
  if (t === "charge") W = 104;
  const lab = { relief: "pressure relief valve (direct)", reliefPilot: "pressure relief valve, pilot operated", reliefProp: "proportional pressure relief valve", reduce: "pressure reducing valve, 2-way", reduce3: "pressure reducing valve, 3-way", seq: "sequence valve", cbv: "counterbalance valve", brake: "brake valve (motor)", unload: "unloading valve", charge: "accumulator charging valve" }[t] || t;
  return wrap(W, H, b, lab);
}

/* ------------------------------------------------------------------ flow valves */
function throttle(o = {}) {
  let b = L(5, 34, 85, 34) + P("M35 26Q45 34 55 26") + P("M35 42Q45 34 55 42");
  if (o.adj) b += adj(45, 34, 13);
  if (o.check) { b += L(18, 34, 18, 10) + L(18, 10, 72, 10) + L(72, 10, 72, 34) + checkH(45, 10, false) + R(10, 2, 70, 50, DDOT); }
  return wrap(90, 56, b, o.check ? "one-way flow control (throttle + check)" : o.adj ? "throttle valve, adjustable" : "throttle");
}
const orifice = () => wrap(90, 50, L(5, 25, 40, 25) + L(50, 25, 85, 25) + P("M40 15L45 22L50 15") + P("M40 35L45 28L50 35") + T(28, 46, "sharp-edged"), "orifice (sharp-edged, viscosity independent)");
function fc(o = {}) {
  let b = R(25, 10, 50, 44) + L(5, 32, 25, 32) + L(75, 32, 95, 32) + L(25, 32, 75, 32);
  b += P("M38 25Q46 32 54 25") + P("M38 39Q46 32 54 39") + adj(46, 32, 11) + AR(66, 48, 66, 16, 4);
  if (o.three) b += L(50, 54, 50, 70) + T(53, 69, "T (bypass)");
  if (o.check) b += L(15, 32, 15, 66) + L(15, 66, 85, 66) + L(85, 66, 85, 32) + checkH(50, 66, false);
  if (o.prop) b += solBox(25, 2, false) + AR(13, 20, 27, 2, 3);
  return wrap(100, o.three || o.check ? 74 : 62, b, o.three ? "3-way flow control (bypass)" : o.prop ? "proportional flow control valve" : "2-way flow control, pressure compensated");
}
function divider() {
  let b = R(20, 18, 60, 34) + L(50, 52, 50, 70) + L(32, 18, 32, 4) + L(68, 18, 68, 4) + T(53, 68, "P") + T(35, 9, "A") + T(71, 9, "B");
  b += P("M26 30Q32 35 38 30") + P("M62 30Q68 35 74 30") + P("M50 52V42H32V18M50 42H68V18") + T(38, 49, "1 : 1");
  return wrap(100, 74, b, "flow divider");
}

/* ------------------------------------------------------------------ check + lock valves */
const check = (o = {}) => wrap(46, 70, L(20, 66, 20, 42) + checkV(20, 35, true, o.spring) + L(20, 27, 20, 4) + T(24, 64, "A") + T(24, 9, "B"), o.spring ? "check valve with spring" : "check valve");
function pocBody(x, y, lab) {
  return L(x, y + 66, x, y + 42) + checkV(x, y + 35, true, true) + L(x, y + 27, x, y + 4) + R(x - 12, y + 18, 26, 34, DDOT) + L(x + 22, y + 46, x + 6, y + 39, DASH) + head(x + 9, y + 40.5, x + 6, y + 39, 4) + (lab ? T(x + 3, y + 64, lab[0]) + T(x + 3, y + 9, lab[1]) : "");
}
const poc = () => wrap(60, 70, pocBody(20, 0, ["A", "B"]) + L(42, 46, 56, 46, DASH) + T(46, 43, "X"), "pilot-operated check valve");
function dpoc() {
  let b = pocBody(22, 0, ["A1", "B1"]) + pocBody(78, 0, ["A2", "B2"]).replace(/x1="100" y1="46" x2="84"/, 'x1="100" y1="46" x2="84"');
  b += L(44, 46, 44, 58, DASH) + L(44, 58, 78, 58, DASH) + L(100, 46, 100, 62, DASH) + L(100, 62, 22, 62, DASH) + R(4, 14, 112, 46, DDOT);
  return wrap(120, 72, b, "double pilot-operated check valve (hydraulic lock)");
}
function shuttle() {
  let b = L(5, 40, 30, 40) + L(70, 40, 95, 40) + R(30, 28, 40, 24) + L(30, 34, 36, 40) + L(30, 46, 36, 40) + L(70, 34, 64, 40) + L(70, 46, 64, 40) + C(50, 40, 5) + L(50, 28, 50, 6);
  return wrap(100, 56, b + T(8, 36, "P1") + T(84, 36, "P2") + T(53, 12, "A"), "shuttle valve (OR)");
}
const prefill = () => wrap(70, 90, P("M8 6V20H56V6") + L(32, 20, 32, 24) + pocBody(32, 20, null) + L(54, 66, 66, 66, DASH) + T(58, 63, "X") + T(36, 86, "to ram") + T(14, 4, "tank"), "prefill valve");
const hoseRupture = () => wrap(70, 72, L(20, 66, 20, 42) + checkV(20, 35, false, false) + spring(26, 44, 36, 56, 3, 2.5) + L(20, 28, 20, 4) + T(24, 64, "cyl") + T(24, 9, "line") + T(30, 30, "closes at Q > Q set"), "hose rupture valve");

/* ------------------------------------------------------------------ cartridge */
function logic() {
  let b = R(30, 20, 40, 40) + L(50, 60, 50, 82) + L(70, 46, 92, 46) + L(50, 20, 50, 2, DASH) + T(53, 80, "A") + T(84, 43, "B") + T(53, 8, "X");
  b += L(50, 54, 41, 42) + L(50, 54, 59, 42) + L(41, 42, 59, 42) + spring(50, 42, 50, 22, 4, 4);
  return wrap(100, 86, b, "2-way slip-in cartridge (logic valve)");
}
function cartScrew() {
  let b = P("M30 6H70V18H30Z") + P("M36 18V40") + P("M64 18V40");
  for (let y = 20; y < 40; y += 4) b += L(36, y, 64, y + 2);
  b += R(40, 40, 20, 28) + R(44, 68, 12, 10) + L(30, 54, 40, 54) + L(60, 54, 70, 54) + L(50, 78, 50, 86) + T(4, 57, "side port 2") + T(53, 86, "nose 1") + T(73, 14, "hex");
  return wrap(100, 90, b, "screw-in cartridge valve (outline)");
}

/* ------------------------------------------------------------------ accumulators */
function acc(o = {}) {
  const t = o.type || "bladder";
  let b = R(30, 10, 30, 60, ' rx="15"') + P("M45 14L41 21L49 21Z") + L(45, 70, 45, 86) + T(48, 84, "P");
  if (t === "bladder") b += P("M30 44Q45 30 60 44");
  else if (t === "piston") b += L(30, 40, 60, 40) + L(30, 45, 60, 45);
  else b += P("M30 42Q37.5 36 45 42T60 42");
  return wrap(90, 90, b + T(64, 24, "N₂") + T(64, 60, "oil"), `${t} accumulator`);
}
function accBlock() {
  let b = R(30, 4, 24, 40, ' rx="12"') + P("M42 8L38 14L46 14Z") + P("M30 30Q42 22 54 30") + L(42, 44, 42, 60);
  b += R(6, 52, 132, 40, DDOT) + L(42, 60, 120, 60) + L(42, 60, 42, 98) + T(45, 98, "P");
  b += R(64, 62, 16, 16) + AR(75, 77, 75, 63, 3.5) + spring(80, 70, 90, 70, 3, 3) + L(72, 60, 72, 62) + T(60, 88, "relief");
  b += R(98, 62, 16, 16) + L(102, 64, 102, 76) + L(110, 64, 110, 76) + L(114, 70, 122, 70) + C(124, 70, 2) + T(96, 88, "drain (manual)");
  b += C(20, 72, 7) + AR(15, 77, 25, 67, 3) + L(20, 65, 20, 60) + L(20, 60, 42, 60) + T(10, 86, "gauge");
  return wrap(142, 102, b, "accumulator safety and shut-off block");
}

/* ------------------------------------------------------------------ conditioning */
const diamond = (cx, cy, r) => P(`M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}Z`);
function filter(o = {}) {
  const k = o.kind || "pressure";
  let b = diamond(45, 40, 17) + L(45, 24, 45, 56, DASH);
  if (k === "breather") { b += L(45, 57, 45, 76) + P("M45 8L40 16H50Z") + L(45, 16, 45, 23); return wrap(90, 80, b + T(50, 74, "tank"), "air breather filter"); }
  b += L(5, 40, 28, 40) + L(62, 40, 85, 40);
  if (o.ind) b += L(45, 23, 45, 15) + C(45, 10, 5) + AR(41, 13, 49, 7, 3);
  if (o.bypass) b += L(14, 40, 14, 68) + L(14, 68, 76, 68) + L(76, 68, 76, 40) + checkH(45, 68, true) + spring(52, 60, 60, 54, 2, 2);
  if (k === "strainer") b += T(26, 74, "suction strainer");
  return wrap(90, o.bypass || k === "strainer" ? 78 : 62, b, `${k} filter`);
}
function cooler(o = {}) {
  let b = diamond(45, 38, 17) + L(5, 38, 28, 38) + L(62, 38, 85, 38) + L(45, 21, 45, 55);
  b += P("M45 21L41 28H49Z", FILL) + P("M45 55L41 48H49Z", FILL);
  if (o.water) b += L(45, 21, 45, 6) + L(45, 55, 45, 70) + T(48, 10, "water") + T(48, 70, "water");
  return wrap(90, 74, b, o.water ? "cooler, water/oil" : "cooler");
}
const heater = () => wrap(90, 74, diamond(45, 38, 17) + L(5, 38, 28, 38) + L(62, 38, 85, 38) + L(45, 21, 45, 55) + P("M45 30L41 23H49Z", FILL) + P("M45 46L41 53H49Z", FILL), "heater");
const tank = () => wrap(90, 70, P("M18 26V62H72V26") + L(45, 4, 45, 52) + L(18, 36, 72, 36, DRN) + T(50, 10, "return below oil level"), "tank (vented)");

/* ------------------------------------------------------------------ lines, couplings */
function line(o = {}) {
  const k = o.kind || "work", W = 100, H = 40;
  const lab = { work: "working line", pilot: "pilot line", drain: "drain / leakage line", hose: "flexible hose", cross: "lines crossing (not connected)", junction: "junction (connected)", plug: "closed port / plug" }[k];
  let b;
  switch (k) {
    case "pilot": b = L(8, 20, 92, 20, DASH); break;
    case "drain": b = L(8, 20, 92, 20, DRN); break;
    case "hose": b = L(8, 20, 24, 20) + P("M24 20C40 2 60 38 76 20") + L(76, 20, 92, 20); break;
    case "cross": b = L(8, 20, 92, 20) + L(50, 2, 50, 38); break;
    case "junction": b = L(8, 20, 92, 20) + L(50, 20, 50, 38) + C(50, 20, 2.8, FILL); break;
    case "plug": b = L(8, 20, 60, 20) + L(60, 13, 60, 27); break;
    default: b = L(8, 20, 92, 20);
  }
  return wrap(W, H, b, lab);
}
const qc = () => wrap(110, 44, L(4, 22, 30, 22) + checkH(38, 22, true) + L(46, 22, 50, 22) + L(50, 12, 50, 32) + L(60, 12, 60, 32) + L(60, 22, 64, 22) + checkH(72, 22, false) + L(80, 22, 106, 22) + T(36, 42, "quick coupling, both halves with check"), "quick coupling with checks");
const rotary = () => wrap(90, 70, C(45, 35, 16) + C(45, 35, 8) + L(45, 4, 45, 27) + L(45, 43, 45, 66) + P("M66 22A22 22 0 0 1 66 48") + head(67, 46, 66, 48, 4) + T(4, 66, "rotary union"), "rotary union (1 passage)");

/* ------------------------------------------------------------------ sensors */
const gauge = () => wrap(60, 70, C(30, 28, 14) + AR(21, 37, 39, 19, 4) + L(30, 42, 30, 66), "pressure gauge");
const ptrans = () => wrap(80, 70, C(30, 28, 14) + T(26, 31, "p", ' font-size="10"') + L(30, 42, 30, 66) + L(44, 28, 58, 28) + P("M58 22h12v12h-12z") + T(59, 31, "mA") , "pressure transducer (analog signal)");
function pswitch() {
  let b = R(20, 18, 40, 24) + L(40, 42, 40, 66, DASH) + spring(60, 30, 74, 30, 3, 3) + adj(67, 30, 8);
  b += L(28, 34, 36, 34) + L(36, 34, 48, 26) + L(48, 34, 54, 34) + L(30, 18, 30, 6) + L(50, 18, 50, 6) + T(4, 64, "pilot from P");
  return wrap(84, 70, b, "pressure switch");
}
const temp = () => wrap(60, 70, C(30, 28, 14) + L(30, 18, 30, 34) + C(30, 36, 3, FILL) + L(30, 42, 30, 66), "temperature sensor / switch");
const level = () => wrap(80, 70, P("M10 20V64H70V20") + L(10, 38, 70, 38, DRN) + C(40, 38, 5) + L(40, 33, 40, 6) + L(36, 12, 46, 6) + T(48, 12, "contact"), "level switch (float)");
const flowmeter = () => wrap(90, 56, L(5, 28, 85, 28) + C(45, 28, 13) + AR(37, 36, 53, 20, 4) + P("M38 22Q45 15 52 22"), "flow meter");
const testpoint = () => wrap(70, 50, L(5, 32, 40, 32) + L(40, 32, 40, 22) + C(40, 16, 6) + L(36, 12, 44, 20) + L(44, 12, 36, 20) + T(48, 44, "test point"), "test point (measuring coupling)");

const FUN = { pump, motor, emotor, cyl, rotact, dv, servo, pv, throttle, orifice, fc, divider, check, poc, dpoc, shuttle, prefill, hoseRupture, logic, cartScrew, acc, accBlock, filter, cooler, heater, tank, line, qc, rotary, gauge, ptrans, pswitch, temp, level, flowmeter, testpoint };
export const SYMBOL_KEYS = Object.keys(FUN);
export function symbol(key, opts = {}) { const f = FUN[key]; if (!f) return wrap(60, 30, T(4, 18, "? " + key), "unknown symbol"); return f(opts || {}); }

/* legend gallery: [key, opts, meaning] – used by the symbol legend page and by builder B */
export const SYMBOL_INFO = [
  ["line", { kind: "work" }, "Working line (pressure, return, suction)"], ["line", { kind: "pilot" }, "Pilot / control line (dashed)"],
  ["line", { kind: "drain" }, "Drain / leakage line (short dashes)"], ["line", { kind: "hose" }, "Flexible line (hose)"],
  ["line", { kind: "junction" }, "Junction – lines connected (dot)"], ["line", { kind: "cross" }, "Lines crossing – not connected"],
  ["line", { kind: "plug" }, "Closed port / plug"], ["tank", {}, "Tank open to air; return line ends below oil level"],
  ["pump", {}, "Fixed pump, one flow direction (filled triangle points OUT)"], ["pump", { var: true, drain: true }, "Variable pump with case drain (diagonal arrow = adjustable)"],
  ["pump", { var: true, ctrl: "pc", drain: true }, "Variable pump, pressure compensator"], ["pump", { hand: true }, "Hand pump"],
  ["motor", { bidir: true }, "Fixed motor, two directions (triangles point IN)"], ["motor", { var: true, drain: true }, "Variable motor with case drain"],
  ["motor", { bidir: true, brake: true }, "Motor with spring-applied, hydraulically released brake"], ["emotor", {}, "Electric motor"],
  ["cyl", { type: "da" }, "Double-acting cylinder (differential)"], ["cyl", { type: "da", cush: true }, "Double-acting cylinder, adjustable cushions both ends"],
  ["cyl", { type: "sa" }, "Single-acting cylinder, spring return"], ["cyl", { type: "dbl" }, "Double-rod cylinder (equal areas)"],
  ["cyl", { type: "plunger" }, "Plunger (ram) cylinder"], ["cyl", { type: "tele" }, "Telescopic cylinder"], ["rotact", {}, "Semi-rotary actuator"],
  ["dv", { ways: 4, pos: ["par", "closed", "cross"], l: "sol", r: "sol" }, "4/3 valve, closed centre, solenoids, spring centred"],
  ["dv", { ways: 4, pos: ["par", "tandem", "cross"], l: "sol", r: "sol" }, "4/3 valve, tandem centre (P→T: pump unloaded)"],
  ["dv", { ways: 4, pos: ["par", "float", "cross"], l: "sol", r: "sol" }, "4/3 valve, float centre (A, B → T) – for pilot-operated checks"],
  ["dv", { ways: 4, pos: ["par", "open", "cross"], l: "lever", r: "spring" }, "4/3 valve, open centre, manual lever"],
  ["dv", { ways: 4, pos: ["par", "regen", "cross"], l: "sol", r: "sol" }, "4/3 valve, regenerative centre"],
  ["dv", { ways: 4, pos: ["par", "cross"], l: "sol", r: "spring" }, "4/2 valve, solenoid, spring return"], ["dv", { ways: 4, pos: ["par", "cross"], l: "sol", r: "detent" }, "4/2 valve with detent"],
  ["dv", { ways: 3, pos: ["o32", "c32"], l: "sol", r: "spring" }, "3/2 valve, normally A→T"], ["dv", { ways: 2, pos: ["o22", "c22"], l: "sol", r: "spring", seat: true }, "2/2 seat valve, normally closed, leak-free"],
  ["dv", { ways: 4, pos: ["par", "closed", "cross"], l: "solpilot", r: "solpilot" }, "4/3 solenoid-pilot operated valve (NG16+)"],
  ["dv", { ways: 4, pos: ["par", "closed", "cross"], l: "prop", r: "prop" }, "Proportional directional valve (arrow through the solenoid)"], ["servo", {}, "Servo valve"],
  ["pv", { type: "relief" }, "Pressure relief valve (normally closed, pilot from inlet)"], ["pv", { type: "reliefPilot" }, "Pressure relief valve, pilot operated"],
  ["pv", { type: "reliefProp" }, "Proportional pressure relief valve"], ["pv", { type: "reduce" }, "Pressure reducing valve (normally open, pilot from outlet)"],
  ["pv", { type: "reduce3" }, "3-way pressure reducing valve"], ["pv", { type: "seq" }, "Sequence valve (external drain)"], ["pv", { type: "cbv" }, "Counterbalance valve with check"],
  ["pv", { type: "unload" }, "Unloading valve (external pilot)"], ["pv", { type: "charge" }, "Accumulator charging valve"], ["pv", { type: "brake" }, "Brake valve for a motor"],
  ["throttle", {}, "Throttle (fixed restriction)"], ["throttle", { adj: true }, "Throttle valve, adjustable"], ["throttle", { adj: true, check: true }, "One-way flow control (throttle + check)"],
  ["orifice", {}, "Orifice (sharp-edged)"], ["fc", {}, "2-way flow control, pressure compensated"], ["fc", { three: true }, "3-way flow control (bypass)"],
  ["fc", { prop: true }, "Proportional flow control"], ["divider", {}, "Flow divider"],
  ["check", {}, "Check valve (free flow from the seat tip to the ball)"], ["check", { spring: true }, "Check valve with spring (cracking pressure)"],
  ["poc", {}, "Pilot-operated check valve"], ["dpoc", {}, "Double pilot-operated check valve (hydraulic lock)"], ["shuttle", {}, "Shuttle valve (OR)"],
  ["prefill", {}, "Prefill valve"], ["hoseRupture", {}, "Hose rupture valve"], ["logic", {}, "2-way slip-in cartridge (logic) valve"], ["cartScrew", {}, "Screw-in cartridge (outline)"],
  ["acc", { type: "bladder" }, "Bladder accumulator (N₂)"], ["acc", { type: "piston" }, "Piston accumulator"], ["acc", { type: "diaphragm" }, "Diaphragm accumulator"],
  ["accBlock", {}, "Accumulator safety and shut-off block"], ["filter", { kind: "pressure", ind: true }, "Filter with clogging indicator"],
  ["filter", { kind: "return", bypass: true }, "Filter with bypass valve"], ["filter", { kind: "breather" }, "Air breather filter"], ["filter", { kind: "strainer" }, "Suction strainer"],
  ["cooler", {}, "Cooler (air)"], ["cooler", { water: true }, "Cooler with coolant lines (water/oil)"], ["heater", {}, "Heater"],
  ["qc", {}, "Quick coupling with checks"], ["rotary", {}, "Rotary union"], ["gauge", {}, "Pressure gauge"], ["ptrans", {}, "Pressure transducer (4–20 mA)"],
  ["pswitch", {}, "Pressure switch"], ["temp", {}, "Temperature sensor"], ["level", {}, "Level switch"], ["flowmeter", {}, "Flow meter"], ["testpoint", {}, "Test point"],
];

/* ------------------------------------------------------------------ principle / cut-away drawings (300 × 180) */
const M = ' class="hl-m"', O = ' class="hl-o"', HP = ' class="hl-h"', AC = ' class="hl-a"';
const TX = (x, y, t, a = "") => `<text x="${x}" y="${y}" font-size="7.6" font-family="sans-serif" fill="currentColor" stroke="none"${a}>${t}</text>`;
const dw = (body, label, h = 180) => `<svg class="hl-draw" viewBox="0 0 300 ${h}" width="420" height="${Math.round(h * 1.4)}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
function gear(cx, cy, ro, ri, n, ex = M) {
  let d = ""; for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * 2 * Math.PI, r = (i % 4 < 2) ? ro : ri; d += (i ? "L" : "M") + f1(cx + r * Math.cos(a)) + " " + f1(cy + r * Math.sin(a)); }
  return P(d + "Z", ex) + C(cx, cy, 5);
}
const DR = {
  gearExt: () => dw(R(40, 30, 220, 120, ' rx="40"' + M) + R(52, 42, 196, 96, ' rx="34"' + O) + gear(112, 90, 42, 34, 12) + gear(188, 90, 42, 34, 12) +
    R(140, 140, 20, 30, HP).replace(HP, O) + R(140, 6, 20, 26, HP) + AR(150, 176, 150, 150) + AR(150, 30, 150, 6) + P("M80 60A42 42 0 0 1 112 46", "") + head(105, 47, 112, 46) + P("M220 60A42 42 0 0 0 188 46") + head(195, 47, 188, 46) +
    TX(166, 20, "outlet P (high pressure)") + TX(166, 172, "inlet S (suction)") + TX(4, 96, "oil carried in") + TX(4, 108, "the tooth gaps") + TX(230, 172, "gears mesh in the middle:") + TX(230, 160, "oil cannot go back"), "external gear pump principle"),
  gearInt: () => dw(C(150, 90, 78, M) + C(150, 90, 66, O) + gear(150, 104, 40, 32, 11) + P("M96 70Q150 20 204 70Q150 48 96 70Z", M) + TX(122, 52, "crescent") + TX(4, 30, "ring gear (internal teeth)") + TX(170, 120, "pinion (driven)") + AR(40, 140, 72, 120) + AR(228, 120, 262, 140) + TX(4, 160, "inlet (low p)") + TX(232, 160, "outlet P") + TX(4, 176, "low noise ≈ 55–65 dB(A)"), "internal gear pump principle"),
  vane: () => dw(C(160, 90, 70, M) + C(160, 90, 62, O) + C(148, 90, 42, M) + Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4, x1 = 148 + 30 * Math.cos(a), y1 = 90 + 30 * Math.sin(a); const dx = Math.cos(a), dy = Math.sin(a); const bq = (148 - 160) * dx, cc = (148 - 160) ** 2 - 62 * 62; const t = -bq + Math.sqrt(bq * bq - cc); return L(x1, y1, 148 + t * dx, 90 + t * dy, ' stroke-width="3"'); }).join("") + C(148, 90, 6) + L(148, 90, 160, 90) + TX(150, 106, "e") + TX(4, 20, "stator ring (moves → e changes = variable flow)") + TX(4, 172, "vanes slide out (centrifugal + pressure); chambers grow at the inlet, shrink at the outlet") + TX(232, 60, "outlet") + TX(232, 130, "inlet"), "vane pump principle"),
  axial: () => dw(R(20, 84, 260, 10, M) + P("M70 20L95 160L105 160L80 20Z", M) + R(120, 30, 110, 120, M) + [45, 75, 105, 135].map((y, i) => R(110 - i * 0 + (y < 90 ? -(90 - y) * 0.18 : (y - 90) * 0.18), y - 9, 60, 14, O) + L(92 + (y - 90) * 0.18, y - 2, 112 + (y - 90) * 0.18, y - 2)).join("") + R(232, 30, 14, 120, M) + TX(60, 14, "swash plate, angle α") + TX(150, 26, "cylinder block turns with the shaft") + TX(250, 40, "valve") + TX(250, 52, "plate") + TX(20, 176, "V = z · A_piston · D · tan α   (α = 0 → no flow)") + TX(4, 80, "shaft"), "axial piston pump (swash plate) principle"),
  bentAxis: () => dw(R(10, 80, 70, 14, M) + C(90, 87, 22, M) + P("M120 40L250 10L270 90L140 120Z", M) + [0, 1, 2].map((i) => L(96, 75 + i * 12, 150 + i * 10, 42 + i * 26, ' stroke-width="3"')).join("") + TX(130, 150, "cylinder block at angle 25–45°") + TX(4, 120, "drive flange") + TX(4, 170, "pistons with ball-joint rods – high efficiency, high speed"), "bent-axis piston unit principle"),
  radialPiston: () => dw(C(150, 90, 22, M) + C(156, 90, 12, O) + [0, 1, 2, 3, 4].map((i) => { const a = i * 2 * Math.PI / 5 - Math.PI / 2, x = 150 + 50 * Math.cos(a), y = 90 + 50 * Math.sin(a); return `<g transform="rotate(${f1(a * 180 / Math.PI + 90)} ${f1(x)} ${f1(y)})">${R(x - 9, y - 22, 18, 40, M)}${R(x - 6, y - 4, 12, 20, O)}</g>`; }).join("") + TX(4, 20, "pistons in a star around an eccentric shaft") + TX(4, 172, "very high pressure (≈ 70 MPa), small flow; as a motor: cam ring with many lobes = high torque") + TX(166, 96, "e"), "radial piston principle"),
  screw: () => dw(R(20, 40, 260, 100, ' rx="10"' + M) + R(30, 70, 240, 40, O) + Array.from({ length: 12 }, (_, i) => L(40 + i * 20, 70, 52 + i * 20, 110, ' stroke-width="2"')).join("") + R(30, 48, 240, 20, O) + R(30, 112, 240, 20, O) + TX(20, 30, "power screw (driven) + 2 idler screws") + TX(20, 160, "oil moves axially, no pulsation → very quiet (≈ 50–65 dB(A))") + AR(8, 90, 28, 90) + AR(272, 90, 296, 90), "screw pump principle"),
  orbit: () => { let ring = "", star = ""; for (let i = 0; i < 7; i++) { const a = i * 2 * Math.PI / 7; ring += C(150 + 62 * Math.cos(a), 90 + 62 * Math.sin(a), 13, M); } for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; star += C(156 + 38 * Math.cos(a), 90 + 38 * Math.sin(a), 14, O); } return dw(C(150, 90, 80, M) + C(150, 90, 70, O) + ring + C(156, 90, 40, M) + star + C(156, 90, 8) + TX(4, 20, "gerotor set: ring with 7 rollers, star with 6 lobes orbits") + TX(4, 172, "star makes 6 orbits per turn → big displacement, low speed, high torque (LSHT)"), "orbit motor principle"); },
  cylinder: () => dw(R(20, 50, 210, 80, M) + R(26, 58, 198, 64, O) + R(110, 58, 18, 64, M) + R(128, 80, 160, 20, M) + R(224, 66, 26, 48, M) + R(104, 58, 6, 64, AC) + R(232, 76, 6, 6, AC) + R(232, 98, 6, 6, AC) + R(36, 34, 14, 16, M) + R(196, 34, 14, 16, M) +
    TX(32, 28, "port A") + TX(184, 28, "port B") + TX(92, 150, "piston + seals") + TX(196, 148, "gland: rod seal + wiper") + TX(4, 176, "F = p · A   v = Q / A   (A piston side, annulus = A − rod area)") + TX(260, 76, "rod"), "cylinder cut-away"),
  spool: () => dw(R(10, 60, 280, 60, M) + [40, 90, 140, 190, 240].map((x, i) => R(x, 50, 30, 80, i === 2 ? HP : O)).join("") + R(20, 80, 260, 20, M) + [70, 120, 170, 220].map((x) => R(x, 72, 20, 36, M)).join("") + R(0, 74, 14, 32, AC) + R(286, 74, 14, 32, AC) +
    ["T", "A", "P", "B", "T"].map((t, i) => TX(50 + i * 50, 44, t)).join("") + TX(4, 150, "spool lands open P→A and B→T when it moves; radial clearance 4–10 µm = leakage") + TX(4, 170, "solenoid each end, springs centre the spool") + L(155, 50, 155, 30) + L(105, 50, 105, 30), "spool valve cut-away"),
  poppetSeat: () => dw(R(60, 20, 180, 140, M) + R(130, 100, 40, 60, O) + P("M120 100L150 70L180 100Z", AC) + R(140, 30, 20, 40, O) + spring(150, 30, 150, 68, 5, 10) + R(60, 80, 70, 16, O) + TX(4, 92, "port B") + TX(176, 172, "port A") + TX(184, 60, "cone poppet on a sharp seat") + TX(184, 74, "→ zero leakage when closed"), "seat valve principle"),
  reliefDirect: () => dw(R(80, 20, 140, 140, M) + R(135, 120, 30, 40, HP) + P("M135 120L150 100L165 120Z", AC) + R(130, 30, 40, 70, O) + spring(150, 34, 150, 98, 6, 12) + R(140, 4, 20, 26, M) + R(165, 106, 55, 14, O) + TX(4, 150, "inlet P") + TX(225, 116, "to tank T") + TX(170, 14, "adjusting screw") + TX(4, 30, "opens when p · A_seat > F_spring") + TX(4, 44, "override: p rises with Q"), "direct relief valve principle"),
  reliefPilot: () => dw(R(40, 70, 160, 90, M) + R(90, 120, 40, 40, HP) + R(86, 80, 48, 40, AC) + C(110, 92, 3) + R(200, 20, 80, 60, M) + P("M225 60L240 46L255 60Z", AC) + spring(240, 24, 240, 46, 4, 8) + L(110, 80, 110, 50) + L(110, 50, 225, 50) + spring(110, 82, 110, 118, 3, 6) + TX(4, 176, "main poppet (weak spring) + small orifice; pilot cone sets the pressure → flat curve") + TX(205, 96, "pilot stage") + TX(140, 44, "vent X: remote / unload"), "pilot-operated relief valve principle"),
  reducing: () => dw(R(30, 60, 240, 60, M) + R(60, 50, 40, 80, HP) + R(160, 50, 40, 80, O) + R(40, 80, 200, 20, M) + R(100, 72, 60, 36, M) + spring(240, 90, 280, 90, 4, 8) + L(180, 50, 180, 30) + L(180, 30, 40, 30) + L(40, 30, 40, 80, DASH) + TX(56, 146, "inlet P") + TX(160, 146, "outlet A (reduced)") + TX(30, 20, "outlet pressure pushes the spool against the spring → closes when p_A = setting") + TX(240, 120, "drain Y"), "pressure reducing valve principle"),
  cbv: () => dw(R(20, 50, 260, 80, M) + R(60, 60, 60, 60, HP) + R(150, 60, 40, 60, O) + P("M120 90L140 74L140 106Z", AC) + R(140, 80, 90, 20, M) + spring(230, 90, 270, 90, 4, 8) + R(20, 80, 30, 20, AC) + TX(30, 40, "load side (cylinder)") + TX(140, 40, "to valve") + TX(4, 150, "pilot X") + TX(4, 166, "opens when p_load + ratio · p_pilot ≥ setting") + TX(4, 178, "check inside: free flow to the cylinder"), "counterbalance valve principle"),
  poc: () => dw(R(30, 40, 240, 100, M) + R(150, 50, 60, 80, HP) + P("M150 90L130 76L130 104Z", AC) + R(130, 80, 20, 20, AC) + R(40, 70, 70, 40, O) + R(40, 82, 90, 16, M) + spring(210, 90, 260, 90, 4, 8) + TX(160, 30, "load side B") + TX(40, 30, "pilot X") + TX(70, 160, "pilot piston area ≈ 3–13 × seat area (ratio φ)") + TX(110, 176, "small decompression poppet opens first"), "pilot-operated check valve principle"),
  needle: () => dw(R(30, 80, 240, 50, M) + R(40, 92, 220, 26, O) + P("M140 20L160 20L160 70L150 100L140 70Z", AC) + R(130, 6, 40, 14, M) + TX(176, 16, "hand wheel") + TX(4, 160, "annular gap A between needle and seat → Q = Cd · A · √(2Δp/ρ)") + TX(4, 176, "long narrow gap = viscosity dependent (cold oil = less flow)") + AR(14, 105, 38, 105) + AR(262, 105, 290, 105), "needle valve principle"),
  pcFlow: () => dw(R(20, 40, 260, 100, M) + R(40, 80, 40, 20, HP) + P("M100 80L110 90L100 100Z", AC) + R(130, 60, 70, 60, O) + R(150, 70, 30, 40, AC) + spring(180, 90, 220, 90, 4, 6) + TX(30, 30, "throttle (set)") + TX(130, 30, "compensator spool") + TX(4, 160, "the compensator keeps Δp across the throttle constant (≈ 0.4–1 MPa)") + TX(4, 176, "→ flow stays the same when the load pressure changes"), "pressure-compensated flow control principle"),
  bladder: () => dw(R(100, 10, 100, 160, ' rx="40"' + M) + P("M112 40Q112 20 150 20Q188 20 188 40V120Q150 150 112 120Z", AC) + R(140, 0, 20, 12, M) + R(110, 120, 80, 40, ' rx="10"' + O) + R(140, 162, 20, 18, M) + TX(4, 20, "gas valve (N₂ only)") + TX(205, 70, "bladder with N₂") + TX(205, 140, "oil") + TX(205, 172, "poppet valve keeps the bladder in"), "bladder accumulator cut-away"),
  pistonAcc: () => dw(R(30, 60, 240, 60, M) + R(40, 66, 120, 48, AC) + R(160, 64, 16, 52, M) + R(176, 66, 86, 48, O) + R(10, 80, 20, 20, M) + R(270, 80, 20, 20, M) + TX(60, 50, "N₂ side") + TX(190, 50, "oil side") + TX(150, 140, "piston + seals") + TX(4, 170, "big volumes, high flow; piston friction ≈ 0.1–0.2 MPa"), "piston accumulator cut-away"),
  filter: () => dw(R(80, 30, 140, 140, ' rx="8"' + M) + R(100, 50, 100, 110, O) + P("M110 55" + Array.from({ length: 10 }, (_, i) => `L${115 + i * 8} ${i % 2 ? 60 : 150}`).join(""), AC) + R(130, 10, 40, 20, M) + AR(20, 40, 80, 40) + AR(220, 40, 280, 40) + TX(4, 30, "in") + TX(250, 30, "out") + TX(180, 24, "Δp indicator + bypass valve") + TX(4, 176, "outside → in through the pleated element; β_x(c) ≥ 200"), "filter cut-away"),
  tank: () => dw(P("M20 40V170H280V40Z", M) + R(22, 80, 256, 88, O) + L(150, 60, 150, 168, ' stroke-width="3"') + L(60, 10, 60, 140) + R(50, 140, 20, 20, AC) + P("M230 10V130L245 145") + R(140, 20, 20, 20, M) + R(270, 90, 8, 30, AC) + TX(10, 30, "suction + strainer") + TX(166, 34, "breather") + TX(196, 54, "return: below oil level, 45° cut") + TX(160, 100, "baffle") + TX(256, 86, "sight glass"), "tank layout"),
  fitting24: () => dw(R(10, 60, 110, 60, M) + P("M120 60L160 76V104L120 120Z", M) + R(100, 80, 190, 20, O) + R(150, 74, 30, 32, AC) + R(170, 54, 60, 72, M) + TX(10, 40, "body with 24° cone (ISO 8434-1)") + TX(140, 150, "cutting ring bites into the tube") + TX(200, 46, "nut") + TX(230, 76, "tube"), "24° cone fitting cross-section"),
  logic: () => dw(R(80, 20, 140, 150, M) + R(110, 40, 80, 100, O) + P("M110 140L150 165L190 140Z", AC) + R(110, 100, 80, 40, AC) + spring(150, 44, 150, 98, 5, 10) + R(130, 165, 40, 15, HP) + R(220, 120, 60, 20, O) + TX(4, 176, "A (nose)") + TX(226, 114, "B (side)") + TX(4, 30, "X (control cover)") + TX(196, 90, "A_X = A_A + A_B"), "logic valve cross-section"),
  hose: () => dw(R(20, 70, 200, 40, M) + R(20, 76, 200, 28, AC) + R(20, 82, 200, 16, O) + R(220, 60, 60, 60, M) + TX(20, 50, "cover (rubber) · steel wire braid / spiral · inner tube") + TX(222, 50, "crimped fitting") + TX(20, 150, "1SN 1 braid · 2SN 2 braids · 4SP / 4SH 4 spirals") + TX(20, 166, "burst ≥ 4 × max working pressure"), "hose construction"),
};
export const DRAWING_KEYS = Object.keys(DR);
export function drawing(key) { const f = DR[key]; return f ? f() : ""; }
