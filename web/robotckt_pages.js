/* ROBOT tab – item 3 "Control circuits": the SCHEMATIC PAGES (SVG strings). Pure drawing – the live state S comes from robotckt.js.
 * Page 1 mains · 2 servo drive · 3 24 V supply · 4 safety (safety PLC) · 5 I/O wiring · 6 fieldbus · 7 earthing + EMC · 8 cabinet layout
 * · 9 safety relay variant. Device tags IEC 81346 (-Q1, -F2, -K1 …), cross-references "/page.column".
 * All ratings are EXAMPLES (see robotckt_calc.js).
 */
import { frame, esc } from "./robotckt_sym.js";

const f = (v, d = 1) => (+v).toFixed(d);
const V = (P, x, y1, y2, c, st, o) => P.w([[x, y1], [x, y2]], c, st, o);
const H = (P, y, x1, x2, c, st, o) => P.w([[x1, y], [x2, y]], c, st, o);
// point on a circle (cx, cy, r) straight above/below x
const cy0 = (cx, cy, r, x, top = true) => cy + (top ? -1 : 1) * Math.sqrt(Math.max(0, r * r - (x - cx) * (x - cx)));

export const PAGE_TITLES = ["Mains supply + power distribution", "Servo drive power stage (axis 1 of 6)", "24 V DC control supply", "Safety circuits – safety PLC (dual channel)",
  "I/O wiring – sensors, valves, machine handshake", "Fieldbus + network", "Earthing, shielding, EMC", "Cabinet layout + heat", "Safety circuits – classic safety relay (variant)"];

/* =================================================================== PAGE 1 – mains */
function page1(P, S, K) {
  const on = S.q1, rf = K.rbFeed, M = K.main, cv = K.conv, ps = K.psu;
  const X = { L1: 70, L2: 90, L3: 110, N: 130, PE: 150 }, BUS = { L1: 220, L2: 230, L3: 240, N: 250 };
  // incoming supply
  ["L1", "L2", "L3", "N", "PE"].forEach((k) => { P.t(X[k], 48, k, { a: "middle", s: 10, b: 1 }); P.term(X[k], 60); });
  P.t(62, 64, "-X0", { a: "end", b: 1, s: 11 });
  P.t(175, 50, "Supply 3/N/PE AC 400/230 V 50 Hz – TN-S system", { b: 1, s: 11 });
  P.t(175, 63, `-W1 5G${M.A} mm² Cu, ${M.L} m from the factory distribution (example)`, { s: 10, c: "mut" });
  ["L1", "L2", "L3"].forEach((k) => V(P, X[k], 63, 90, k, on, { flow: false }));
  // -Q1 main switch
  ["L1", "L2", "L3"].forEach((k) => P.contact(X[k], 90, { type: "NO", fn: "dis", act: on, hl: false }));
  P.link(52, X.L3 - 5, 110).act(52, 110, "turn");
  P.raw(`<g class="ck-sym"><rect x="37" y="124" width="12" height="9" rx="1" class="ck-fill"/><path d="M39.5,124 V120 A3.5,3.5 0 0 1 46.5,120 V124"/></g>`);
  P.tag(175, 98, "-Q1", [`main switch 3-pole, ${M.Q1} A`, "lockable in OFF (padlock), red/yellow", "IEC 60204-1 §5.3"]);
  P.hit("Q1", 34, 86, 90, 50);
  // -F1 fuses
  ["L1", "L2", "L3"].forEach((k) => { V(P, X[k], 130, 150, k, on, { flow: false }); P.fuse(X[k], 150); V(P, X[k], 190, BUS[k], k, on, { flow: false }); P.dot(X[k], BUS[k]); });
  P.tag(175, 160, "-F1", [`fuses gG 3 × ${M.In} A`, "short-circuit protection of the cabinet"]);
  P.hit("F1", 58, 148, 64, 46);
  V(P, X.N, 63, BUS.N, "N", on, { flow: false }); P.dot(X.N, BUS.N);
  V(P, X.PE, 63, 720, "PE");
  // busbars
  ["L1", "L2", "L3", "N"].forEach((k) => { H(P, BUS[k], X[k], 1110, k, on, { flow: false }); P.t(1116, BUS[k] + 3.5, k, { s: 9, c: "mut" }); });
  P.t(175, 212, "busbars / distribution block (example: 63 A)", { s: 9.5, c: "mut" });

  // ---- branch 1: robot controller feed
  const poles = rf.ph === 3 ? [[200, "L1"], [220, "L2"], [240, "L3"]] : [[200, "L3"], [220, "N"]];
  const rbOn = on && S.k40;
  poles.forEach(([x, k]) => { V(P, x, BUS[k], 290, k, on, { flow: false }); P.dot(x, BUS[k]); P.contact(x, 290, { type: "NO", fn: k === "N" ? "" : "brk", act: on, hl: false }); V(P, x, 330, 440, k, on, { flow: rbOn }); P.term(x, 380); });
  if (poles.length > 1) P.link(195, poles[poles.length - 1][0] - 5, 310);
  P.tag(255, 298, "-F2", [`MCB C${rf.In} A, ${rf.ph === 3 ? 3 : 2}-pole`, `I_b = ${f(rf.Ib, 1)} A`]);
  P.t(255, 384, "-X1", { b: 1, s: 11 });
  P.t(255, 412, `-W2 ${rf.ph === 3 ? 5 : 3}G${rf.A} · ${rf.L} m`, { s: 9.5, c: "mut" });
  P.box(180, 440, 130, 76, { on: rbOn });
  P.tag(188, 458, "-A1", ["robot controller", `${rf.S} kVA, ${rf.ph === 3 ? "3/PE AC 400 V" : "1/N/PE AC 230 V"}`, "own cabinet (supplier)"]);
  P.xref(188, 509, "power stage → /2.1");
  V(P, 290, 516, 720, "PE"); P.dot(290, 720);
  P.hit("F2", 186, 286, 66, 48); P.hit("A1", 180, 440, 130, 76);
  P.reg("A1:feed", 240);

  // ---- branch 2: conveyors (safety contactors -K1/-K2 common, then -Q11/-K11 and -Q12/-K12)
  const c1 = [360, 380, 400], c2 = [520, 540, 560], ph3 = ["L1", "L2", "L3"];
  const pK1 = on && S.k1c, pK2 = pK1 && S.k2c, run1 = pK2 && S.k11, run2 = pK2 && S.k12, anyRun = run1 || run2;
  c1.forEach((x, i) => { V(P, x, BUS[ph3[i]], 290, ph3[i], on, { flow: false }); P.dot(x, BUS[ph3[i]]); });
  c1.forEach((x, i) => P.contact(x, 290, { type: "NO", fn: "ctr", act: S.k1c, t1: i === 0 ? "1" : null, t2: i === 0 ? "2" : null }));
  P.link(355, 395, 310);
  c1.forEach((x, i) => { V(P, x, 330, 340, ph3[i], pK1, { flow: false }); P.contact(x, 340, { type: "NO", fn: "ctr", act: S.k2c, t1: i === 0 ? "1" : null, t2: i === 0 ? "2" : null }); });
  P.link(355, 395, 360);
  if (S.weld) P.t(380, 284, "-K1 welded!", { a: "middle", s: 10, c: "bad", b: 1 });
  P.tag(415, 300, "-K1", ["safety contactor", "coil " + P.ref("K1:coil")]);
  P.tag(415, 350, "-K2", ["safety contactor", "coil " + P.ref("K2:coil")]);
  P.reg("K1:main", 380); P.reg("K2:main", 380);
  // split
  c1.forEach((x, i) => { V(P, x, 380, 440, ph3[i], pK2, { flow: anyRun }); P.dot(x, 400 + i * 10); H(P, 400 + i * 10, x, c2[i], ph3[i], pK2, { flow: false }); V(P, c2[i], 400 + i * 10, 440, ph3[i], pK2, { flow: false }); });
  const motor = (xs, tq, tk, tm, k11) => {
    const p = pK2, run = p && k11;
    xs.forEach((x, i) => { P.contact(x, 440, { type: "NO", fn: "brk", act: on, hl: false }); V(P, x, 480, 490, ph3[i], p, { flow: false }); P.contact(x, 490, { type: "NO", fn: "ctr", act: k11 }); V(P, x, 530, cy0(xs[1], 625, 24, x), ph3[i], run); P.term(x, 565); });
    P.link(xs[0] - 5, xs[2] - 5, 460); P.link(xs[0] - 5, xs[2] - 5, 510);
    P.raw(`<g class="ck-sym"><rect x="${xs[0] - 24}" y="456" width="10" height="8" class="ck-fill"/><path d="M${xs[0] - 22},462 h2.5 v-4 h3.5"/></g>`); P.link(xs[0] - 14, xs[0] - 5, 460);  // thermal overload mark
    P.motor(xs[1], 625, 24, { on: run });
    V(P, xs[1], 649, 720, "PE"); P.dot(xs[1], 720);
    const tx = xs[2] + 16;
    P.tag(tx, 450, tq, [`MPCB ${cv.mpcb}`.replace(" A", ""), `set ${f(cv.set, 2)} A`]);
    P.tag(tx, 503, tk, [tk === "-K11" ? "infeed conveyor" : "outfeed conveyor", "coil (PLC)"]);
    P.tag(tx, 612, tm, [`${cv.P} kW, ${f(cv.In, 2)} A`, `cable 4G${cv.A}, ${cv.L} m`]);
    P.hit(tq.slice(1), xs[0] - 12, 436, 66, 48); P.hit(tk.slice(1), xs[0] - 12, 488, 66, 46); P.hit("M11", xs[1] - 26, 598, 52, 54);
  };
  motor(c1, "-Q11", "-K11", "-M11", S.k11); motor(c2, "-Q12", "-K12", "-M12", S.k12);
  P.t(c1[0] - 8, 569, "-X1", { a: "end", s: 9.5, c: "mut" });
  P.hit("K1", 348, 286, 66, 48); P.hit("K2", 348, 336, 66, 48);

  // ---- branch 3: 24 V power supply
  V(P, 680, BUS.L1, 290, "L1", on, { flow: false }); P.dot(680, BUS.L1); V(P, 700, BUS.N, 290, "N", on, { flow: false }); P.dot(700, BUS.N);
  P.contact(680, 290, { type: "NO", fn: "brk", act: on, hl: false }); P.contact(700, 290, { type: "NO", act: on, hl: false }); P.link(675, 695, 310);
  V(P, 680, 330, 400, "L1", on); V(P, 700, 330, 400, "N", on);
  P.tag(715, 298, "-F3", [`MCB C${ps.mcb} A, 1P+N`, `I_in = ${f(ps.IinRated, 1)} A`]);
  P.box(660, 400, 100, 70, { on });
  P.raw(`<path d="M660,470 L760,400" class="ck-thin"/>`);
  P.t(673, 420, "~", { s: 15 }); P.t(742, 462, "=", { s: 15 });
  P.tag(768, 418, "-T1", [`24 V DC`, `${ps.A} A`, "→ /3.1"]);
  V(P, 740, 470, 720, "PE"); P.dot(740, 720);
  P.hit("T1", 660, 400, 100, 70); P.hit("F3", 668, 286, 44, 48);
  P.reg("T1:in", 700);

  // ---- branch 4: cabinet light, socket, fan (RCBO 30 mA)
  const xL = 830, xN = 850, yL = 380, yN = 660;
  V(P, xL, BUS.L2, 290, "L2", on, { flow: false }); P.dot(xL, BUS.L2); V(P, xN, BUS.N, 290, "N", on, { flow: false }); P.dot(xN, BUS.N);
  P.contact(xL, 290, { type: "NO", fn: "brk", act: on, hl: false }); P.contact(xN, 290, { type: "NO", act: on, hl: false }); P.link(825, 845, 310);
  P.tag(865, 298, "-F4", ["RCBO B10 A, 1P+N", "IΔn = 30 mA (type A)"]);
  V(P, xL, 330, yL, "L2", on, { flow: false }); H(P, yL, xL, 1070, "L2", on, { flow: false });
  V(P, xN, 330, yN, "N", on, { flow: false }); H(P, yN, xN, 1070, "N", on, { flow: false });
  // socket
  V(P, 880, yL, 450, "L2", on, { flow: false }); P.dot(880, yL); P.box(866, 450, 34, 40); P.t(883, 474, "230 V", { a: "middle", s: 8.5 });
  V(P, 892, 490, yN, "N", on, { flow: false }); P.dot(892, yN); P.tag(860, 465, "-XD1", ["socket"], { a: "end" });
  V(P, 874, 490, 700, "PE"); P.dot(874, 700); H(P, 700, 874, 1130, "PE");
  // lamp with door switch
  V(P, 960, yL, 410, "L2", on, { flow: false }); P.dot(960, yL); P.contact(960, 410, { type: "NO", act: S.doorOpen }); P.link(946, 955, 430).act(946, 430, "pos");
  V(P, 960, 450, 480, "L2", on && S.doorOpen); P.lamp(960, 480, { on: on && S.doorOpen }); V(P, 960, 520, yN, "N", on, { flow: false }); P.dot(960, yN);
  P.tag(974, 432, "-S9", ["door switch"]); P.tag(974, 505, "-E1", ["LED light"]);
  // fan with thermostat
  V(P, 1070, yL, 410, "L2", on, { flow: false }); P.contact(1070, 410, { type: "NO", act: S.fanOn && on }); P.link(1056, 1065, 430); P.t(1052, 435, "ϑ", { a: "end", s: 13 });
  V(P, 1070, 450, 486, "L2", on && S.fanOn); P.motor(1070, 500, 14, { sub: "1~", on: on && S.fanOn }); V(P, 1070, 514, yN, "N", on, { flow: false });
  V(P, 1130, 500, 720, "PE"); H(P, 500, 1084, 1130, "PE"); P.dot(1130, 720); P.dot(1130, 700);
  P.tag(1084, 432, "-B9", ["thermostat", "35 °C"]); P.tag(1086, 532, "-E2", ["fan"]);
  P.hit("F4", 818, 286, 44, 48); P.hit("XD1", 860, 446, 46, 48); P.hit("E2", 1040, 404, 60, 112);

  // ---- machine interface note + summary (top right)
  P.box(880, 40, 270, 56, { dash: 1 });
  P.tag(888, 56, "-A50 machine tool (CNC)", ["own supply – not from this cabinet", "signals /5 · interlock /4 · orange = external V"]);
  P.hit("A50", 880, 40, 270, 56);
  P.box(880, 104, 270, 108, { cls: "ck-note" });
  [[`phase currents (example): ${f(M.ph[0], 1)} / ${f(M.ph[1], 1)} / ${f(M.ph[2], 1)} A`, 0], [`-F1 ${M.In} A gG · -Q1 ${M.Q1} A · -W1 5G${M.A} (I_z ${M.Iz} A)`, 0],
    [`ΔU -W1 ${f(M.dU, 2)} % + -W2 ${f(rf.dU, 2)} % = ${f(M.dUtot, 2)} % (limit 5 %)`, 0], [`loop: Z_s ${f(K.loop.Zs, 2)} Ω ≤ ${f(K.loop.Zmax, 2)} Ω ${K.loop.ok ? "✓" : "✗"} (C${rf.In}: I_a = ${K.loop.Ia} A)`, 0],
    ["TN-S: separate N and PE from the supply", 0], ["sizes: see card C (calculations)", 0]]
    .forEach(([t, b], i) => P.t(888, 120 + i * 16, t, { s: 9.6, b }));
  // PE bar
  P.raw(`<rect x="60" y="716" width="1080" height="8" class="ck-pebar"/>`);
  P.t(60, 744, "-PE main earth bar: every PE conductor in star · bonded to the mounting plate", { s: 10, c: "mut" });
  P.t(640, 744, "equipotential bonding: robot base, fence, conveyors, machine (16 mm²) → /7.6", { s: 10, c: "ref" });
  P.hit("PE", 60, 712, 1080, 16);
}
/* =================================================================== PAGE 2 – servo drive */
function rotC(P, x, y, o) { P.raw(`<g transform="rotate(-90 ${x} ${y})">`); P.contact(x, y, o); P.raw("</g>"); }
function page2(P, S, K) {
  const ph = S.servo.phase, live = S.k40 && S.q1, sto = S.sto;
  const regen = live && (ph === "regen" || ph === "chop"), chop = live && ph === "chop", runP = live && !sto && (ph === "mot" || ph === "run" || ph === "regen" || ph === "chop");
  const inF = live && (ph === "mot" || ph === "run"), Y = [120, 140, 160], ph3 = ["L1", "L2", "L3"];
  P.xref(40, 106, "from /1.2 (-F2)");
  if (K.rbFeed.ph === 1) P.t(40, 548, "small controller: 1-phase input (B2 bridge) – drawn 3-phase to show the principle", { s: 9.5, c: "warnTx" });
  // -K40 drive contactor (horizontal)
  ph3.forEach((k, i) => { H(P, Y[i], 40, 100, k, live, { flow: inF }); rotC(P, 100, Y[i], { type: "NO", fn: "ctr", act: S.k40 }); H(P, Y[i], 140, 170, k, live, { flow: false }); });
  P.raw(`<path d="M120,108 V172" class="ck-mech"/>`);
  P.tag(96, 192, "-K40", ["drive contactor"]);
  P.hit("K40", 96, 104, 48, 70);
  // -Z1 EMC filter
  P.box(170, 100, 70, 80, { on: live });
  P.raw(`<g class="ck-sym"><path d="M182,120 q4,-6 8,0 q4,6 8,0 q4,-6 8,0 M182,140 q4,-6 8,0 q4,6 8,0 q4,-6 8,0 M182,160 q4,-6 8,0 q4,6 8,0 q4,-6 8,0"/><path d="M214,120 V172 M222,140 V172 M230,160 V172"/><path d="M210,172 H234"/></g>`);
  P.tag(170, 62, "-Z1", ["EMC line filter"]);
  P.hit("Z1", 170, 100, 70, 80);
  // -V1 rectifier (3 legs) between rails +DC (y 80) and −DC (y 260)
  const L = [310, 340, 370];
  ph3.forEach((k, i) => { H(P, Y[i], 240, L[i], k, live, { flow: inF }); P.dot(L[i], Y[i]); });
  L.forEach((x) => { P.diode(x, 80, { up: true }); V(P, x, 120, 220, "DC", undefined); P.diode(x, 220, { up: true }); });
  P.tag(176, 214, "-V1", ["diode rectifier (B6)", "V_DC = √2 · 400 V", "= 565 V"]);
  P.hit("V1", 296, 76, 90, 190);
  // rails
  const dc = live, fl = inF || regen;
  P.w([[310, 80], [390, 80]], "DC", dc, { rev: regen, flow: inF });
  P.w([[310, 260], [1130, 260], [1130, 520]], "DC", dc, { rev: !regen, flow: fl });
  // precharge
  P.w([[390, 80], [400, 80]], "DC", dc, { flow: false }); P.resH(400, 80); P.w([[440, 80], [450, 80]], "DC", dc, { flow: false });
  P.w([[390, 80], [390, 50], [400, 50]], "DC", dc, { flow: false }); rotC(P, 400, 50, { type: "NO", act: S.k40 }); P.w([[440, 50], [450, 50], [450, 80]], "DC", dc, { flow: false });
  P.dot(390, 80); P.dot(450, 80);
  P.t(420, 100, "-R41 47 Ω", { a: "middle", s: 10, b: 1 }); P.t(420, 112, "precharge", { a: "middle", s: 9.5, c: "mut" });
  P.t(458, 46, "-K41 bypass", { s: 10, b: 1 });
  P.hit("R41", 386, 40, 70, 78);
  P.w([[450, 80], [1150, 80], [1150, 440]], "DC", dc, { rev: regen, flow: fl });
  P.t(1112, 74, "+DC", { s: 10, b: 1 }); P.t(1092, 254, "−DC", { s: 10, b: 1 });
  // -C1 capacitors + bleed resistor
  V(P, 490, 80, 150, "DC"); P.cap(490, 150, { pol: 1 }); V(P, 490, 190, 260, "DC"); P.dot(490, 80); P.dot(490, 260);
  P.tag(506, 168, "-C1", ["2 mF"]);
  V(P, 550, 80, 150, "DC"); P.res(550, 150); V(P, 550, 190, 260, "DC"); P.dot(550, 80); P.dot(550, 260);
  P.tag(564, 168, "-R42", ["22 kΩ"]);
  P.hit("C1", 474, 140, 64, 56); P.hit("R42", 540, 140, 60, 56);
  // DC voltage measurement
  V(P, 640, 80, 154, "DC"); P.raw(`<circle cx="640" cy="170" r="16" class="ck-box"/>`); P.t(640, 175, "V", { a: "middle", s: 13, b: 1 }); V(P, 640, 186, 260, "DC");
  P.dot(640, 80); P.dot(640, 260);
  P.t(662, 166, "V_DC", { s: 10, c: "mut" }); P.t(662, 181, f(S.servo.vdc, 0) + " V", { s: 12, b: 1, id: "ckVdc" });
  // brake chopper
  V(P, 740, 80, 100, "DC", chop, { flow: chop }); P.res(740, 100, { on: chop }); V(P, 740, 140, 160, "DC", chop); P.igbt(740, 160, { on: chop }); V(P, 740, 200, 260, "DC", chop);
  P.dot(740, 80); P.dot(740, 260);
  P.tag(758, 118, "-R43", [`${K.regen.R} Ω`]); P.tag(762, 182, "-V3", ["chopper", "on > 750 V", "off < 730 V"]);
  P.hit("R43", 726, 96, 80, 50); P.hit("V3", 720, 156, 100, 70);
  // inverter -A11 (3 legs)
  const IL = [870, 920, 970], out = [150, 170, 190];
  IL.forEach((x, i) => {
    V(P, x, 80, 90, "DC"); P.igbt(x, 90, { on: runP && i !== 1, blocked: sto });
    V(P, x, 130, 210, "DC"); P.igbt(x, 210, { on: runP && i === 1, blocked: sto }); V(P, x, 250, 260, "DC");
    P.dot(x, 80); P.dot(x, 260); P.dot(x, out[i]);
  });
  P.raw(`<rect x="844" y="86" width="156" height="170" class="ck-box ck-dash"/>`);
  P.t(844, 62, "-A11", { s: 12, b: 1 }); P.t(844, 74, "inverter axis 1 (IGBT 6-pack), PWM 8 kHz", { s: 10, c: "mut" });
  P.hit("A11", 844, 86, 156, 170);
  // outputs U V W -> current sensors -> shielded cable -> motor
  const mx = 1095, my = 170, mr = 22;
  ["U", "V", "W"].forEach((n, i) => {
    const x2 = mx - Math.sqrt(mr * mr - (out[i] - my) ** 2);
    P.w([[IL[i], out[i]], [x2, out[i]]], ["L1", "L2", "L3"][i], live && !sto && ph !== "idle", { rev: regen });
    P.t(1006, out[i] - 3, n, { s: 9, c: "mut" });
  });
  [150, 190].forEach((y) => P.raw(`<circle cx="1028" cy="${y}" r="6" class="ck-box"/>`));
  P.t(1028, 214, "-B11", { a: "middle", s: 9.5, b: 1 });
  P.raw(`<ellipse cx="1052" cy="170" rx="6" ry="30" class="ck-shield"/>`);
  V(P, 1052, 200, 226, "PE"); P.gnd(1052, 226);
  P.motor(mx, my, mr, { on: live && !sto && ph !== "idle" });
  V(P, mx, 192, 204, "PE"); P.pe(mx, 204);
  P.t(mx, 140, "-M1", { a: "middle", s: 11, b: 1 });
  P.t(1052, 128, "-W11", { a: "middle", s: 9.5, c: "mut" });
  P.hit("M1", mx - 24, 130, 50, 66); P.hit("B11", 1018, 140, 22, 80); P.hit("W11", 1044, 120, 18, 110);
  // gate drivers + STO
  P.box(850, 300, 170, 52, { on: !sto && live, cls: sto ? "ck-boxbad" : "" });
  P.t(858, 317, "-A11.G gate drivers (6×)", { s: 10.5, b: 1 });
  P.t(858, 332, sto ? "STO ACTIVE – no gate pulses" : "gate pulses ON", { s: 10, c: sto ? "bad" : "ok", b: 1 });
  P.t(858, 345, "STO-A upper · STO-B lower drivers", { s: 9, c: "mut" });
  P.raw(`<path d="M935,300 V262" class="ck-arrow ${sto ? "ck-dead" : ""}"/>`);
  P.hit("STO", 850, 300, 170, 52);
  [["STO-A", 312], ["STO-B", 340]].forEach(([n, y]) => {
    H(P, y, 480, 850, "24", !sto, { flow: !sto });
    P.xref(476, y + 4, `${n} ← ${P.ref("STO:out")}`, { a: "end" });
  });
  P.reg("STO:in", 600);
  // axis computer
  P.box(560, 366, 220, 48, {});
  P.t(570, 384, "-A10 axis computer", { s: 10.5, b: 1 }); P.t(570, 397, "current loop 62.5 µs → PWM", { s: 9.5, c: "mut" }); P.t(570, 409, "← i_U, i_W (-B11) · positions (-A20)", { s: 8.5, c: "mut" });
  P.raw(`<path d="M780,390 H900 V352" class="ck-arrow"/>`); P.t(800, 386, "PWM", { s: 9, c: "mut" });
  P.hit("A10", 560, 366, 220, 48);
  // encoder + SMB (inside the robot base)
  P.box(1036, 300, 84, 38, {}); P.t(1042, 315, "-B1 encoder", { s: 9.5, b: 1 }); P.t(1042, 329, "in motor -M1", { s: 8.5, c: "mut" });
  P.raw(`<path d="M1078,338 V360" class="ck-shield2"/>`);
  P.box(1036, 360, 84, 56, {}); P.t(1042, 375, "-A20 SMB", { s: 9.5, b: 1 }); P.t(1042, 388, "rev. counter", { s: 8.5, c: "mut" }); P.t(1042, 409, "-G1", { s: 8.5, c: "mut" });
  P.raw(`<g class="ck-sym"><path d="M1066,404 h18 M1070,410 h10 M1075,404 v-4 M1075,410 v4"/></g>`);
  P.hit("B1e", 1036, 300, 84, 38); P.hit("A20", 1036, 360, 84, 56);
  // axes 2–6 on the same DC bus
  H(P, 440, 560, 1150, "DC", dc, { flow: false }); H(P, 520, 560, 1130, "DC", dc, { flow: false });
  K.axes.slice(1).forEach((a, i) => {
    const x = 580 + i * 110;
    V(P, x + 45, 440, 456, "DC"); V(P, x + 45, 504, 520, "DC"); P.dot(x + 45, 440); P.dot(x + 45, 520);
    P.box(x, 456, 92, 48, { on: live && !sto });
    P.t(x + 6, 472, `-A1${a.j} axis ${a.j}`, { s: 10, b: 1 }); P.t(x + 6, 485, `-M${a.j} î ${f(a.iPeak, 1)} A`, { s: 9.5 }); P.t(x + 6, 497, `≤ ${f(a.P, 1)} kW`, { s: 9, c: "mut" });
  });
  P.t(560, 434, `DC bus to axes 2–6 (same as axis 1). Axis 1: î = ${f(K.axes[0].iPeak, 1)} A peak, K_t = ${f(K.axes[0].Kt, 2)} N·m/A (estimates, item 2)`, { s: 9.5, c: "mut" });
  P.hit("A12", 580, 456, 550, 48);
  // brake circuit (SBC)
  P.t(40, 572, "Holding brake -Y1 of motor -M1 (spring brake: 24 V = released) – safe brake control", { s: 10.5, b: 1 });
  const br = S.brakeOpen;
  P.xref(40, 592, `+24 V from -F25 ${P.ref("F25:out")}`);
  H(P, 596, 40, 140, "24", true, { flow: false }); P.dot(120, 596);
  V(P, 120, 596, 600, "24", true); P.contact(120, 600, { type: "NO", act: br, t1: "13", t2: "14" }); V(P, 120, 640, 650, "24", br, { flow: false });
  P.coil(120, 650, { kind: "brake", on: br, t: ["B1", "B2"] }); V(P, 120, 690, 696, "0V", br, { flow: false }); P.contact(120, 696, { type: "NO", act: br, t1: "13", t2: "14" }); V(P, 120, 736, 746, "0V", true, { flow: false });
  P.w([[120, 650], [160, 650]], "24", br, { flow: false }); P.diode(160, 650, { up: true }); P.w([[160, 690], [120, 690]], "0V", br, { flow: false }); P.dot(120, 650); P.dot(120, 690);
  H(P, 746, 40, 470, "0V", true, { flow: false }); P.dot(120, 746);
  P.t(98, 624, "-K42", { a: "end", b: 1, s: 11 }); P.t(98, 674, "-Y1", { a: "end", b: 1, s: 11 }); P.t(98, 720, "-K43", { a: "end", b: 1, s: 11 });
  P.t(172, 674, "suppressor", { s: 9, c: "mut" });
  [["-K42", 380, "SBC-A"], ["-K43", 440, "SBC-B"]].forEach(([n, x, sbc]) => {
    P.t(x, 604, sbc + " ↓", { a: "middle", s: 9, c: "ref" });
    V(P, x, 610, 626, "24", br, { flow: false }); P.coil(x, 626, { on: br, t: false }); V(P, x, 666, 746, "0V", br, { flow: false }); P.dot(x, 746);
    P.t(x - 16, 650, n, { a: "end", s: 10, b: 1 });
  });
  P.t(186, 616, br ? "brake RELEASED (servo holds)" : "brake APPLIED (spring)", { s: 10.5, b: 1, c: br ? "ok" : "warnTx" });
  P.t(186, 630, "both -K42 and -K43 must close", { s: 9, c: "mut" });
  P.hit("K42", 90, 596, 380, 150);
  // DC bus chart
  P.box(490, 566, 660, 184, { cls: "ck-note" });
  P.t(500, 584, "Live: DC bus voltage (3 main axes: accelerate – run – brake)", { s: 10.5, b: 1 });
  const bp = S.bus, cx0 = 540, cx1 = 1130, cyT = 600, cyB = 728, vlo = 520, vhi = Math.max(800, Math.ceil((bp.vmax + 15) / 50) * 50);
  const yv = (v) => cyB - (v - vlo) / (vhi - vlo) * (cyB - cyT);
  for (let v = 550; v <= vhi; v += 50) { P.raw(`<path d="M${cx0},${f(yv(v), 1)} H${cx1}" class="ck-grid"/>`); P.t(cx0 - 4, yv(v) + 3, v, { a: "end", s: 9, c: "mut" }); }
  P.raw(`<path d="M${cx0},${yv(750)} H${cx1}" class="ck-limit"/>`); P.t(cx0 + 4, yv(750) - 3, "chopper on 750 V", { s: 9, c: "bad" });
  P.raw(`<path d="M${cx0},${yv(565)} H${cx1}" class="ck-limit2"/>`); P.t(cx1 - 4, yv(565) + 11, "565 V = √2 · 400 V", { a: "end", s: 9, c: "mut" });
  const xt = (t) => cx0 + t / bp.T * (cx1 - cx0);
  let chopRects = "", st = null;
  bp.t.forEach((t, i) => { if (bp.chop[i] && st === null) st = t; if ((!bp.chop[i] || i === bp.t.length - 1) && st !== null) { chopRects += `<rect x="${f(xt(st), 1)}" y="${cyT}" width="${f(Math.max(1.5, xt(t) - xt(st)), 1)}" height="${cyB - cyT}" class="ck-chopband"/>`; st = null; } });
  P.raw(chopRects);
  P.raw(`<polyline points="${bp.t.map((t, i) => `${f(xt(t), 1)},${f(cyB - bp.w[i] * 40, 1)}`).join(" ")}" class="ck-speedline"/>`);
  P.raw(`<polyline points="${bp.t.map((t, i) => `${f(xt(t), 1)},${f(yv(bp.v[i]), 1)}`).join(" ")}" class="ck-vline"/>`);
  P.raw(`<path id="ckCur" d="M${cx0},${cyT} V${cyB}" class="ck-cursor"/>`);
  P.t(cx0, 744, "0 s", { s: 9, c: "mut" }); P.t(cx1, 744, bp.T + " s", { a: "end", s: 9, c: "mut" });
  P.t(640, 744, "blue = V_DC · grey = axis speed · red band = chopper ON", { s: 9, c: "mut" });
  P.t(1140, 584, "", { a: "end", s: 10, b: 1, id: "ckPh" });
}
/* =================================================================== PAGE 3 – 24 V supply */
function page3(P, S, K) {
  const on = S.q1, ps = K.psu;
  P.xref(40, 50, "from /1.5 (-F3)");
  [["L1", 60], ["N", 80]].forEach(([k, x]) => V(P, x, 56, 100, k, on));
  V(P, 100, 56, 100, "PE");
  P.box(46, 100, 130, 90, { on });
  P.raw(`<path d="M46,190 L176,100" class="ck-thin"/>`); P.t(60, 122, "~", { s: 16 }); P.t(150, 180, "=", { s: 16 });
  P.tag(240, 112, "-T1", [`24 V DC, ${ps.A} A (${24 * ps.A} W)`, `load ${f(ps.I, 1)} A = ${ps.load} %`, `losses ${f(ps.loss, 0)} W (η 92 %)`]);
  P.hit("T1", 46, 100, 130, 90);
  // +24 V and 0 V rails
  P.t(176, 130, "+", { s: 11, b: 1 }); P.w([[176, 140], [210, 140], [210, 240], [1130, 240]], "24", on, { flow: false });
  P.w([[130, 190], [130, 700], [1130, 700]], "0V", on, { flow: false });
  P.t(1134, 244, "+24 V", { s: 9.5, b: 1 }); P.t(1134, 704, "0 V", { s: 9.5, b: 1 });
  // 0 V earthed at ONE point (PELV) via a removable link
  H(P, 650, 80, 130, "0V", on, { flow: false }); P.dot(130, 650);
  V(P, 80, 650, 660, "0V"); P.raw(`<g class="ck-sym"><path d="M74,660 h12 M74,676 h12"/><path d="M80,660 V676" class="${S.zeroLink === false ? "ck-dead" : ""}"/></g>`);
  V(P, 80, 676, 712, "PE"); P.pe(80, 712);
  P.t(92, 671, "-X3 link 0V–PE", { s: 9.5, b: 1 }); P.t(92, 684, "(open for insulation test)", { s: 9, c: "mut" });
  P.hit("X3", 66, 640, 130, 60);
  // buffer module
  V(P, 260, 240, 300, "24", on); P.dot(260, 240); P.box(236, 300, 48, 60, { on }); P.t(260, 326, "-G2", { a: "middle", b: 1, s: 10.5 }); P.t(260, 340, "buffer", { a: "middle", s: 9, c: "mut" }); V(P, 260, 360, 700, "0V", on, { flow: false }); P.dot(260, 700);
  P.hit("G2", 236, 300, 48, 60);
  // branches
  ps.branches.forEach((b, i) => {
    const x = 340 + i * 132, trip = b.tag === "-F24" && S.f24trip, live = on && !trip;
    V(P, x, 240, 270, "24", on); P.dot(x, 240);
    P.box(x - 16, 270, 32, 52, { on: live, cls: trip ? "ck-boxbad" : "" });
    P.t(x, 292, "I>", { a: "middle", s: 11, b: 1 }); P.led(x, 309, trip ? "bad" : live);
    P.tag(x + 22, 284, b.tag, [`ECB ${b.set} A`, trip ? "TRIPPED" : `${f(b.I, 2)} A`]);
    V(P, x, 322, 400, "24", live, { flow: live });
    P.box(x - 62, 400, 124, 150, { on: live });
    P.t(x - 56, 416, b.n, { s: 10, b: 1 });
    b.items.forEach((it, k) => { P.t(x - 56, 434 + k * 15, it[0], { s: 8.8, c: "mut" }); P.t(x + 56, 434 + k * 15, f(it[1], 2), { s: 8.8, a: "end" }); });
    P.t(x - 56, 542, `Σ ${f(b.I, 2)} A · ${f(b.P, 0)} W`, { s: 9.5, b: 1 });
    V(P, x, 550, 700, "0V", live, { flow: false }); P.dot(x, 700);
    P.hit(b.tag.slice(1), x - 58, 268, 116, 284);
    P.reg(b.tag.slice(1) + ":out", x);
  });
  if (S.f24trip) P.t(340 + 3 * 132 + 6, 572, "short circuit!", { s: 9.5, c: "bad", b: 1 });
  P.t(340 + 4 * 132 + 6, 572, "→ brakes /2.1", { s: 9.5, c: "ref" });
  P.t(40, 744, `Σ ${f(ps.I, 2)} A = ${ps.Pout} W of ${24 * ps.A} W (${ps.load} %) – rule: PSU loaded ≤ 80 %. dark blue = +24 V DC, blue/white = 0 V (PELV, earthed at ONE point -X3).`, { s: 10, c: "mut" });
}

/* =================================================================== PAGE 4 – safety (safety PLC) */
function page4(P, S, K) {
  const sp = S.sp;
  const yPLC = 400, hPLC = 80;
  // --- e-stop chains (T1 = channel A, T2 = channel B)
  const xa = 110, xb = 170, dev = [["-S1", "pendant e-stop", 90, S.es.tp], ["-S2", "cabinet e-stop", 170, S.es.cab], ["-S3", "cell-door e-stop", 250, S.es.door]];
  P.t(xa, 56, "T1", { a: "middle", s: 10, b: 1, c: "ref" }); P.t(xb, 56, "T2", { a: "middle", s: 10, b: 1, c: "ref" });
  let aOn = true, bOn = true;
  const segA = [], segB = [];
  let ya = 62;
  dev.forEach(([tag, n, y, pressed]) => {
    segA.push([ya, y, aOn]); segB.push([ya, y, bOn]);
    P.contact(xa, y, { type: "NC", act: pressed, t1: "11", t2: "12" }); P.contact(xb, y, { type: "NC", act: pressed, t1: "21", t2: "22" });
    P.link(56, xb - 5, y + 20).act(56, y + 20, "mush").forced(84, y + 20);
    if (pressed) { aOn = false; bOn = false; }
    ya = y + 40;
    P.tag(186, y + 16, tag, [n]);
    P.hit(tag.slice(1), 34, y - 4, 150, 48);
  });
  segA.push([ya, yPLC, aOn]); segB.push([ya, yPLC, bOn]);
  segA.forEach(([a, b, o]) => V(P, xa, a, b, "24", o, { fcls: "ck-pulse" })); segB.forEach(([a, b, o]) => V(P, xb, a, b, "24", o, { fcls: "ck-pulse2" }));
  P.term(xa, 340, "X4:1", { left: true }); P.term(xb, 340, "X4:2");
  if (S.fault.cross) { P.raw(`<path d="M${xa},360 l10,-6 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-6" class="ck-faultw"/>`); P.t(140, 384, "short A–B!", { a: "middle", s: 10, c: "bad", b: 1 }); }
  P.reg("S1:es", xa);
  // --- gate switch -B1 (coded, guard locking, OSSD)
  P.t(340, 56, "+24V", { a: "middle", s: 9, c: "mut" }); P.t(400, 56, "0V", { a: "middle", s: 9, c: "mut" });
  V(P, 340, 62, 90, "24", true, { flow: false }); V(P, 400, 62, 90, "0V", true, { flow: false });
  P.box(310, 90, 136, 92, { on: S.gate, cls: S.fault.gateStuck ? "ck-boxbad" : "" });
  P.t(318, 106, "-B1 gate switch", { s: 10.5, b: 1 }); P.t(318, 119, "coded RFID + guard lock", { s: 9, c: "mut" }); P.t(318, 131, "2 OSSD, own test pulses", { s: 9, c: "mut" });
  P.t(318, 148, S.gate ? (S.locked ? "gate CLOSED + LOCKED" : "gate closed, unlocked") : "gate OPEN", { s: 10, b: 1, c: S.gate ? "ok" : "bad" });
  P.t(318, 162, S.fault.gateStuck ? "OSSD2 stuck at 1 (fault)" : "", { s: 9, c: "bad" });
  const o1 = S.gate, o2 = S.gate || S.fault.gateStuck;
  V(P, 330, 182, yPLC, "24", o1, { fcls: "ck-pulse" }); V(P, 370, 182, yPLC, "24", o2, { fcls: "ck-pulse2" });
  P.t(334, 196, "OSSD1", { s: 8.5, c: "mut" }); P.t(374, 196, "OSSD2", { s: 8.5, c: "mut" });
  V(P, 420, 182, 210, "24", S.unlock); P.xref(424, 222, `lock ← ${P.ref("Y10:coil")}`, { a: "middle" });
  P.term(330, 340, "X4:3", { left: true }); P.term(370, 340, "X4:4");
  P.hit("B1", 310, 90, 130, 92);
  // --- enabling device -S4 (3 positions, contacts closed only in the middle)
  const en = S.en === 1;
  P.t(500, 56, "T1", { a: "middle", s: 10, b: 1, c: "ref" }); P.t(560, 56, "T2", { a: "middle", s: 10, b: 1, c: "ref" });
  V(P, 500, 62, 170, "24", true, { fcls: "ck-pulse" }); V(P, 560, 62, 170, "24", true, { fcls: "ck-pulse2" });
  P.contact(500, 170, { type: "NO", act: en, t1: "1", t2: "2" }); P.contact(560, 170, { type: "NO", act: en, t1: "3", t2: "4" });
  P.link(470, 555, 190).act(470, 190, "hand");
  P.t(470, 166, ["released", "middle", "panic"][S.en], { a: "middle", s: 9, b: 1, c: en ? "ok" : "mut" });
  V(P, 500, 210, yPLC, "24", en, { fcls: "ck-pulse" }); V(P, 560, 210, yPLC, "24", en, { fcls: "ck-pulse2" });
  P.tag(586, 186, "-S4", ["enabling device", "3-position (pendant)"]);
  P.term(500, 340, "X4:5", { left: true }); P.term(560, 340, "X4:6");
  P.hit("S4", 452, 160, 200, 60);
  // --- mode selector -S5 (key): AUTO / T1 (1-of-2)
  const auto = S.mode === "AUTO";
  P.t(750, 56, "+24V", { a: "middle", s: 9, c: "mut" }); H(P, 62, 720, 780, "24", true, { flow: false }); V(P, 750, 56, 62, "24", true, { flow: false });
  V(P, 720, 62, 170, "24", true, { flow: false }); V(P, 780, 62, 170, "24", true, { flow: false }); P.dot(750, 62);
  P.contact(720, 170, { type: "NO", act: auto, t1: "13", t2: "14" }); P.contact(780, 170, { type: "NO", act: !auto, t1: "23", t2: "24" });
  P.link(694, 775, 190).act(694, 190, "key");
  P.t(720, 230, "AUTO", { a: "middle", s: 9, b: 1, c: auto ? "ok" : "mut" }); P.t(780, 230, "T1", { a: "middle", s: 9, b: 1, c: auto ? "mut" : "ok" });
  V(P, 720, 210, 222, "24", auto, { flow: false }); V(P, 720, 236, yPLC, "24", auto, { flow: false }); V(P, 780, 210, 222, "24", !auto, { flow: false }); V(P, 780, 236, yPLC, "24", !auto, { flow: false });
  P.tag(806, 186, "-S5", ["mode selector", "key, 1-of-2"]);
  P.hit("S5", 676, 160, 180, 80);
  // --- reset -S6 + request entry -S7
  [["-S6", 890, "reset", S.resetBtn, "S6"], ["-S7", 990, "request entry", S.reqBtn, "S7"]].forEach(([tag, x, n, pr, key]) => {
    P.t(x, 56, "+24V", { a: "middle", s: 9, c: "mut" }); V(P, x, 62, 260, "24", true, { flow: false });
    P.contact(x, 260, { type: "NO", act: pr, t1: "13", t2: "14" }); P.link(x - 24, x - 5, 280).act(x - 24, 280, "push");
    V(P, x, 300, yPLC, "24", pr, { flow: false });
    P.tag(x + 22, 276, tag, [n]);
    P.hit(key, x - 34, 250, 100, 56);
  });
  P.t(890, 330, "outside the cell,", { a: "middle", s: 9, c: "mut" }); P.t(890, 341, "sees the whole cell", { a: "middle", s: 9, c: "mut" });
  // --- EDM feedback loop: -K1 21-22 + -K2 21-22 in series
  P.t(1090, 56, "T1", { a: "middle", s: 10, b: 1, c: "ref" });
  const k1nc = !S.k1c, k2nc = !S.k2c;
  V(P, 1090, 62, 90, "24", true, { fcls: "ck-pulse" });
  P.contact(1090, 90, { type: "NC", act: S.k1c, t1: "21", t2: "22" }); V(P, 1090, 130, 170, "24", k1nc, { fcls: "ck-pulse" });
  P.contact(1090, 170, { type: "NC", act: S.k2c, t1: "21", t2: "22" }); V(P, 1090, 210, yPLC, "24", k1nc && k2nc, { fcls: "ck-pulse" });
  P.t(1076, 108, "-K1", { a: "end", s: 10.5, b: 1 }); P.t(1076, 120, P.ref("K1:coil"), { a: "end", s: 9, c: "ref" });
  P.t(1076, 188, "-K2", { a: "end", s: 10.5, b: 1 }); P.t(1076, 200, P.ref("K2:coil"), { a: "end", s: 9, c: "ref" });
  P.t(1076, 232, "EDM loop", { a: "end", s: 9.5, b: 1 }); P.t(1076, 244, "(mirror contacts)", { a: "end", s: 9, c: "mut" });
  if (S.weld) P.t(1076, 150, "K1 welded → NC stays open", { a: "end", s: 9, c: "bad", b: 1 });
  P.reg("K1:aux", 1090); P.reg("K2:aux", 1090);
  P.hit("EDM", 1040, 86, 110, 130);
  // --- safety PLC box
  P.box(40, yPLC, 1110, hPLC, { cls: sp.fault ? "ck-boxbad" : "" });
  const din = [[xa, "F-DI0", S.in.a0], [xb, "F-DI1", S.in.b0], [330, "F-DI2", o1], [370, "F-DI3", o2], [500, "F-DI4", en], [560, "F-DI5", en], [720, "F-DI6", auto], [780, "F-DI7", !auto], [890, "DI8", S.resetBtn], [990, "DI9", S.reqBtn], [1090, "F-DI10", k1nc && k2nc]];
  din.forEach(([x, n, v]) => { P.led(x, yPLC + 11, v ? true : false, { r: 3.5 }); P.t(x, yPLC + 26, n, { a: "middle", s: 8.5 }); });
  P.t(50, yPLC + 44, "-A2 safety PLC (F-CPU, PL e) + F-DI / F-DQ – also runs the line program", { s: 10.5, b: 1 });
  P.t(560, yPLC + 44, sp.fault ? "FAULT: " + sp.fault : sp.msg, { s: 10, b: 1, c: sp.fault ? "bad" : sp.need ? "warnTx" : "ok" });
  P.hit("A2", 40, yPLC + 32, 500, 18);
  P.reg("A2", 300);
  // --- outputs
  const yo = yPLC + hPLC;
  const dq = [[110, "F-DQ0", sp.es], [170, "F-DQ1", sp.es], [250, "F-DQ2", sp.as], [310, "F-DQ3", sp.as], [470, "F-DQ4", sp.k1], [560, "F-DQ5", sp.k2], [660, "F-DQ6", S.unlock], [790, "F-DQ7", sp.mach], [870, "F-DQ8", sp.mach], [970, "DQ9", sp.need]];
  dq.forEach(([x, n, v]) => { P.t(x, yo - 20, n, { a: "middle", s: 8.5 }); P.led(x, yo - 8, v ? true : false, { r: 3.5 }); V(P, x, yo, x === 110 || x === 170 || x === 250 || x === 310 ? 560 : 560, "24", !!v, { flow: !!v }); });
  // robot controller safety inputs
  P.box(60, 560, 300, 92, { on: S.robot !== "STO", cls: S.robot === "STO" ? "ck-boxbad" : "" });
  P.t(68, 576, "-A1 robot controller – safety inputs", { s: 10.5, b: 1 });
  P.t(68, 590, "ES = e-stop · AS = auto (protective) stop", { s: 9, c: "mut" });
  P.t(68, 604, `→ SS1 (cat 1) → STO ${P.ref("STO:in")} + brakes`, { s: 9, c: "ref" });
  P.t(68, 624, "robot: " + S.robotTxt, { s: 11, b: 1, c: S.robot === "RUNNING" ? "ok" : S.robot === "STO" ? "bad" : "warnTx" });
  P.t(68, 640, S.catTxt || "", { s: 9.5, c: "mut" });
  P.reg("STO:out", 200);
  [[110, "ES1"], [170, "ES2"], [250, "AS1"], [310, "AS2"]].forEach(([x, n]) => P.t(x + 4, 552, n, { s: 8.5, c: "mut" }));
  P.term(110, 520, "X5:1", { left: true }); P.term(310, 520, "X5:4");
  P.hit("A1s", 60, 560, 300, 92);
  // -K1 -K2 coils, lock, machine relays, lamp
  const coil = (x, tag, on, kind, lines, key, regk) => {
    P.coil(x, 560, { on, kind }); V(P, x, 600, 700, "0V", on, { flow: false }); P.dot(x, 700);
    P.t(x - 18, 578, tag, { a: "end", s: 11, b: 1 });
    lines.forEach((l, i) => P.t(x, 616 + i * 11, l, { a: "middle", s: 9, c: i ? "ref" : "mut" }));
    P.hit(key, x - 40, 556, 80, 48);
    if (regk) P.reg(regk, x);
  };
  coil(470, "-K1", sp.k1, "safety", ["contacts:", "1–6 " + P.ref("K1:main"), "21–22 " + P.ref("K1:aux")], "K1", "K1:coil");
  coil(560, "-K2", sp.k2, "safety", ["contacts:", "1–6 " + P.ref("K2:main"), "21–22 " + P.ref("K2:aux")], "K2", "K2:coil");
  coil(660, "-Y10", S.unlock, "lock", ["guard lock of -B1", "power = unlock"], "Y10", "Y10:coil");
  coil(790, "-K5", sp.mach, "safety", ["13–14", P.ref("K5:c") + " ch A"], "K5", "K5:coil");
  coil(870, "-K6", sp.mach, "safety", ["13–14", P.ref("K5:c") + " ch B"], "K6", null);
  V(P, 970, 560, 580, "24", sp.need); P.lamp(970, 580, { on: sp.need && S.blink }); V(P, 970, 620, 700, "0V", sp.need, { flow: false }); P.dot(970, 700);
  P.t(986, 600, "-P1", { s: 11, b: 1 }); P.t(986, 612, "reset", { s: 9, c: "mut" });
  P.hit("P1", 950, 576, 80, 48);
  H(P, 700, 440, 1000, "0V", true, { flow: false });
  // machine interlock contacts (potential-free, external voltage)
  P.box(1040, 520, 112, 160, { dash: 1 });
  P.t(1046, 536, "to machine -A50", { s: 9.5, b: 1 }); P.t(1046, 548, "safety input (its 24 V)", { s: 8.5, c: "mut" });
  [[1070, "-K5"], [1124, "-K6"]].forEach(([x, n]) => { V(P, x, 556, 580, "ext", sp.mach, { flow: false }); P.contact(x, 580, { type: "NO", act: sp.mach, t1: "13", t2: "14" }); V(P, x, 620, 650, "ext", sp.mach, { flow: false }); P.t(x - 4, 646, n, { a: "end", s: 9, b: 1 }); });
  P.t(1046, 664, "closed = robot out", { s: 8.5, c: "mut" }); P.t(1046, 675, "of the machine", { s: 8.5, c: "mut" });
  P.reg("K5:c", 1090);
  P.hit("K5c", 1040, 520, 112, 160);
  P.t(40, 744, "Channel A = T1 pulses, channel B = T2 pulses (different timing) → a short circuit between A and B or to +24 V is detected (cross-fault detection). E-stops: 2 NC contacts with positive opening (⊖).", { s: 9.5, c: "mut" });
}

/* =================================================================== PAGE 5 – I/O wiring */
function page5(P, S, K) {
  const io = S.io, on = S.q1, r24 = on && !S.f24trip;
  const yP = 70, yZ = 100, yT = 260, yM = 320, hM = 80;
  H(P, yP, 40, 1150, "24", on, { flow: false }); H(P, yZ, 40, 1150, "0V", on, { flow: false });
  P.t(44, yP - 5, "+24 V (-F23 inputs) " + P.ref("F23:out"), { s: 9.5, c: "ref" }); P.t(44, yZ + 13, "0 V", { s: 9.5, c: "mut" });
  // sensor helper (3-wire): BN to +24, BU to 0 V, BK = signal
  const sensor = (x, tag, name, sig, kind, key) => {
    const v = io[sig];
    V(P, x - 10, yP, 150, "L1", on); P.dot(x - 10, yP); V(P, x + 10, yZ, 150, "N", on); P.dot(x + 10, yZ);
    P.box(x - 20, 150, 40, 44, { on: on && v });
    P.raw(`<path d="M${x - 8},${172} l8,-8 l8,8 l-8,8 z" class="ck-thin"/>`);
    P.t(x, 190, kind, { a: "middle", s: 8, b: 1 });
    P.t(x - 14, 145, "BN", { a: "end", s: 7.5, c: "mut" }); P.t(x + 14, 145, "BU", { s: 7.5, c: "mut" }); P.t(x + 4, 206, "BK", { s: 7.5, c: "mut" });
    V(P, x, 194, yM, "L2", on && v, { flow: on && v });
    P.tag(x + 24, 160, tag, [], { s: 10.5 });
    P.hit(key, x - 22, 140, 64, 60);
  };
  const contactIn = (x, tag, sig, kind, key, ext) => {
    const v = io[sig];
    V(P, x, yP, 150, "24", on); P.dot(x, yP);
    P.contact(x, 150, { type: "NO", act: !!v });
    if (kind === "pos") P.link(x - 18, x - 5, 170).act(x - 18, 170, "pos");
    V(P, x, 190, yM, "24", on && v, { flow: on && v });
    if (ext) { P.box(x - 26, 140, 52, 58, { dash: 1 }); P.t(x, 136, "in -A50", { a: "middle", s: 8, c: "mut" }); }
    P.tag(x + 8, 216, tag, [], { s: 10 });
    P.hit(key, x - 26, 136, 60, 70);
  };
  const cols = [
    [80, "sens", "-B11", "diPartReady", "PNP", "B11s"], [160, "sens", "-B12", "diGripClosed", "PNP", "B12"], [240, "sens", "-B13", "diGripOpen", "PNP", "B13"],
    [320, "cont", "K31", "diMachDone", "", "A50c", true], [400, "cont", "K32", "diDoorOpen", "", "A50c", true], [480, "cont", "K33", "diDoorClosed", "", "A50c", true],
    [560, "cont", "-B15", "diOutfeedFree", "pos", "B15"],
  ];
  cols.forEach((c, i) => {
    if (c[1] === "sens") sensor(c[0], c[2], "", c[3], c[4], c[5]); else contactIn(c[0], c[2], c[3], c[4], c[5], c[6]);
    P.term(c[0], yT, "X2:" + (i + 1));
    P.t(c[0] + 6, yT + 34, c[3], { s: 8.5, c: "ref" });
  });
  P.t(84, 236, "≈ 6 mA", { s: 8.5, c: "mut" });
  // NPN for comparison
  const xn = 650;
  V(P, xn - 10, yP, 150, "L1", on); P.dot(xn - 10, yP); V(P, xn + 10, yZ, 150, "N", on); P.dot(xn + 10, yZ);
  P.box(xn - 20, 150, 40, 44, { dash: 1 }); P.t(xn, 190, "NPN", { a: "middle", s: 8, b: 1 }); P.raw(`<path d="M${xn - 8},172 l8,-8 l8,8 l-8,8 z" class="ck-thin"/>`);
  P.raw(`<path d="M${xn},194 V250" class="ck-w ck-w-L2 ck-dash2"/><path d="M${xn - 7},236 l14,14 M${xn + 7},236 l-14,14" class="ck-faultw"/>`);
  P.tag(xn + 24, 160, "-B14", ["NPN: switches 0 V"], { s: 10.5 });
  P.t(xn - 20, 276, "does NOT work on this", { s: 8.5, c: "bad" }); P.t(xn - 20, 287, "PNP (sinking) input card", { s: 8.5, c: "bad" });
  P.hit("B14", xn - 22, 140, 120, 150);
  // analog 4–20 mA (2-wire transmitter)
  const xa = 800;
  V(P, xa, yP, 130, "24", on); P.dot(xa, yP); P.box(xa - 24, 130, 48, 50, { on }); P.t(xa, 150, "p", { a: "middle", s: 12, b: 1 }); P.t(xa, 166, "4–20 mA", { a: "middle", s: 8 });
  V(P, xa, 180, 230, "sig", on, { flow: on }); P.tag(xa + 8, 198, "-B16", ["0–10 bar, 2-wire"]);
  P.box(780, 230, 140, 40, {}); P.t(786, 246, "-A4 AI0 (4–20 mA)", { s: 9.5, b: 1 }); P.t(786, 260, "250 Ω shunt inside", { s: 8.5, c: "mut" });
  P.w([[908, 230], [908, yZ]], "0V", on, { flow: false }); P.dot(908, yZ);
  P.t(806, 225, "AI+", { s: 8, c: "mut" }); P.t(890, 225, "AI−", { s: 8, c: "mut" });
  P.box(930, 130, 220, 140, { cls: "ck-note" });
  P.t(938, 146, "p = (I − 4 mA) / 16 mA × 10 bar", { s: 10, b: 1 });
  P.t(938, 162, `now: I = ${f(S.ai, 1)} mA → p = ${f((S.ai - 4) / 16 * 10, 1)} bar`, { s: 10, id: "ckAI" });
  P.t(938, 178, "U_shunt = I · 250 Ω = 1–5 V", { s: 9.5, c: "mut" });
  P.t(938, 194, "I < 3.6 mA = wire break", { s: 9.5, c: "mut" }); P.t(938, 208, "I > 21 mA = short circuit (NE 43)", { s: 9.5, c: "mut" });
  P.t(938, 224, "why 4 mA, not 0: a broken wire", { s: 9.5, c: "mut" }); P.t(938, 238, "is seen (0 mA ≠ 0 bar)", { s: 9.5, c: "mut" });
  P.t(938, 256, "cable shielded, shield on PE in cabinet", { s: 9.5, c: "mut" });
  P.hit("B16", 776, 126, 150, 150);
  // module -A3
  P.box(40, yM, 740, hM, {});
  cols.forEach((c, i) => { P.led(c[0], yM + 12, on && !!io[c[3]], { r: 3.5 }); P.t(c[0], yM + 27, "DI" + i, { a: "middle", s: 8.5 }); });
  P.t(630, yM + 18, "-A3 robot I/O board", { s: 10.5, b: 1 }); P.t(630, yM + 32, "16 DI type 1 (sinking)", { s: 9, c: "mut" }); P.t(630, yM + 45, "16 DO 0.5 A (sourcing, PNP)", { s: 9, c: "mut" });
  P.hit("A3", 620, yM + 4, 160, 46);
  // outputs
  const yo = yM + hM, yZ2 = 610;
  P.t(44, yZ2 + 14, "0 V", { s: 9.5, c: "mut" }); H(P, yZ2, 40, 740, "0V", on, { flow: false });
  P.t(44, yZ2 + 40, "Flyback diode across every DC coil: it takes the coil current at switch-off and limits the voltage spike", { s: 9.5, c: "mut" });
  P.t(44, yZ2 + 54, "(without it ≈ −300 … −1000 V → destroys the output transistor and disturbs other signals).", { s: 9.5, c: "mut" });
  P.xref(656, yo + 20, "DO supply +24 V"); P.xref(656, yo + 32, "from -F24 " + P.ref("F24:out"));
  const outs = [[100, "doGripClose", "valve", "-Y11", "gripper valve", "Y11"], [220, "doDoorOpen", "relay", "-K21", "relay → machine", "K21"], [340, "doCycleStart", "relay", "-K22", "relay → machine", "K21"], [460, "doRobotClear", "relay", "-K23", "relay → machine", "K21"], [580, "doInHome", "lamp", "-P11", "lamp 'robot home'", "P11"]];
  outs.forEach(([x, sig, kind, tag, n, key], i) => {
    const v = r24 && !!io[sig];
    P.led(x, yo - 12, v, { r: 3.5 }); P.t(x + 8, yo - 9, "DO" + i, { s: 8.5 });
    V(P, x, yo, 450, "24", v); P.term(x, 426, "X2:" + (11 + i));
    if (kind === "lamp") P.lamp(x, 450, { on: v }); else P.coil(x, 450, { on: v, kind: kind === "valve" ? "valve" : "relay" });
    V(P, x, 490, yZ2, "0V", v, { flow: false }); P.dot(x, yZ2);
    if (kind !== "lamp") { P.w([[x, 450], [x + 34, 450], [x + 34, 450]], "24", v, { flow: false }); P.diode(x + 34, 450, { up: true }); P.w([[x + 34, 490], [x, 490]], "0V", v, { flow: false }); P.dot(x, 450); P.dot(x, 490); }
    P.t(x - 18, 466, tag, { a: "end", s: 10.5, b: 1 }); P.t(x - 18, 478, n.split(" ")[0], { a: "end", s: 8.5, c: "mut" });
    P.t(x + 6, 520, sig, { s: 8.5, c: "ref" });
    P.hit(key, x - 50, 440, 100, 56);
  });
  // potential-free relay contacts to the machine
  P.box(780, 400, 370, 300, { dash: 1 });
  P.t(790, 418, "machine control -A50 (its own 24 V supply)", { s: 10.5, b: 1 });
  P.t(790, 432, "orange = external voltage: still live when our -Q1 is OFF!", { s: 9, c: "bad" });
  H(P, 460, 800, 1120, "ext", true, { flow: false }); P.t(800, 454, "+24 V of -A50", { s: 8.5, c: "mut" });
  [[860, "-K21", "doDoorOpen", "door open request"], [960, "-K22", "doCycleStart", "cycle start"], [1060, "-K23", "doRobotClear", "robot clear"]].forEach(([x, tag, sig, n]) => {
    const v = r24 && !!io[sig];
    V(P, x, 460, 490, "ext", true, { flow: false }); P.dot(x, 460); P.contact(x, 490, { type: "NO", act: v, t1: "13", t2: "14" });
    V(P, x, 530, 640, "ext", v, { flow: false }); P.term(x, 560, "X3:" + (x === 860 ? 1 : x === 960 ? 2 : 3));
    P.t(x - 14, 512, tag, { a: "end", s: 10, b: 1 }); P.t(x, 656, n, { a: "middle", s: 8.5 }); P.t(x, 668, "→ machine input", { a: "middle", s: 8.5, c: "mut" });
    P.reg(tag.slice(1) + ":c", x);
  });
  P.t(790, 684, "why a relay: potential-free contact – no electrical", { s: 8.5, c: "mut" }); P.t(790, 695, "connection between the two 24 V / 0 V systems", { s: 8.5, c: "mut" });
  P.hit("K21c", 780, 400, 370, 300);
  P.t(40, 744, `Live: ${S.ioMode}. Input = 1 when > 15 V (type 1), = 0 when < 5 V. Wire colours of sensor cables (IEC 60947-5-2): BN brown = +24 V, BU blue = 0 V, BK black = signal.`, { s: 9.5, c: "mut" });
}

/* =================================================================== PAGE 6 – fieldbus + network */
export const NET_LINKS = [
  // [from xy, to xy, kind]
  { p: [[600, 110], [600, 150]], k: "it" }, { p: [[600, 195], [600, 260]], k: "it" },
  { p: [[460, 300], [460, 340], [160, 340], [160, 400]], k: "pn" }, { p: [[540, 300], [540, 360], [380, 360], [380, 400]], k: "pn" },
  { p: [[600, 300], [600, 400]], k: "pn" }, { p: [[660, 300], [660, 360], [820, 360], [820, 400]], k: "pn" }, { p: [[740, 300], [740, 340], [1040, 340], [1040, 400]], k: "pn" },
  { p: [[160, 470], [160, 560]], k: "pn" }, { p: [[380, 470], [380, 560]], k: "pn" },
];
function page6(P, S, K) {
  const dev = (x, y, w, h, tag, lines, key, on) => { P.box(x, y, w, h, { on }); P.t(x + 8, y + 17, tag, { s: 11, b: 1 }); lines.forEach((l, i) => P.t(x + 8, y + 31 + i * 12, l, { s: 9.5, c: "mut" })); P.hit(key, x, y, w, h); };
  dev(440, 60, 320, 50, "MES / ERP (factory network)", ["OPC UA client, 100–1000 ms (example)"], "MES", true);
  dev(500, 150, 200, 45, "-A90 firewall / router", ["only OPC UA 4840 open, NAT"], "A90", true);
  dev(420, 260, 360, 40, "-A80 managed switch (PROFINET, 8 ports)", [], "A80", true);
  dev(80, 400, 170, 70, "-A2 line + safety PLC", ["PROFINET IO controller", "PROFIsafe F-host"], "A2n", true);
  dev(300, 400, 170, 70, "-A1 robot controller", ["PROFINET device (I-device)", "PROFIsafe F-device"], "A1n", true);
  dev(520, 400, 160, 70, "-A7 HMI panel", ["PROFINET / OPC UA", "operator screens"], "A7", true);
  dev(740, 400, 160, 70, "-A50 machine CNC", ["PROFINET device", "or coupler"], "A50n", true);
  dev(960, 400, 170, 70, "-X80 service port", ["engineering laptop", "(locked when not used)"], "X80", true);
  dev(80, 560, 170, 70, "-A6 remote I/O conveyor", ["IP67, M12 D-coded", "16 DI/DO, IO-Link"], "A6", true);
  dev(300, 560, 170, 70, "-A5 remote I/O gripper", ["IP67 on the robot arm", "via the arm cable"], "A5", true);
  NET_LINKS.forEach((l) => P.w(l.p, l.k === "it" ? "it" : "bus", undefined));
  P.t(470, 352, "Cat 6 S/FTP, RJ45", { s: 8.5, c: "mut" }); P.t(168, 534, "M12 D-coded", { s: 8.5, c: "mut" });
  P.w([[80, 700], [120, 700]], "bus", undefined); P.t(126, 704, "PROFINET (Cat 5e/6 shielded, green)", { s: 9.5 });
  P.w([[80, 722], [120, 722]], "it", undefined); P.t(126, 726, "IT Ethernet (office network)", { s: 9.5 });
  P.raw(`<path d="M80,744 H120" class="ck-safe"/>`); P.t(126, 748, "PROFIsafe – logical safe connection (same cable)", { s: 9.5 });
  P.raw(`<path d="M250,450 C 270,500 290,500 300,450" class="ck-safe"/>`); P.t(275, 512, "PROFIsafe", { a: "middle", s: 9.5, b: 1, c: "bad" });
  P.t(608, 132, "office / IT network", { s: 9, c: "mut" }); P.t(608, 232, "cell network (OT)", { s: 9, c: "mut" });
  P.t(168, 520, "line", { s: 9, c: "mut" }); P.t(388, 520, "arm cable", { s: 9, c: "mut" }); P.t(470, 336, "star", { s: 9, c: "mut" });
  P.raw(`<g id="ckPk"></g>`);
  // info block
  P.box(560, 520, 590, 220, { cls: "ck-note" });
  const L = [["PROFINET (example; EtherNet/IP and EtherCAT work the same way)", 1], ["cable: industrial Ethernet Cat 5e/6, shielded, green sheath (PROFINET type A/B/C)", 0], ["plugs: RJ45 in the cabinet, M12 D-coded (4-pin) in the field, IP67", 0],
    ["max. 100 m per link (switch → device), more with fibre (FO)", 0], ["topology: star from the switch + line through 2-port devices (each adds ≈ 1–10 µs)", 0], ["cycle: PROFINET RT 1–4 ms (here 2 ms), IRT < 1 ms (motion)", 0],
    ["PROFIsafe: safety telegram (CRC + counter + watchdog) on the same cable", 0], ["  → \"black channel\": the bus may fail, the safety layer detects it", 0], ["F-monitoring time e.g. 100 ms → part of the safety response time", 0],
    ["names: every device has a PROFINET name + IP (e.g. 192.168.10.x)", 0], ["OT/IT separation: the firewall allows only what is needed (OPC UA)", 0], ["link LEDs + switch diagnostics (SNMP, LLDP topology) find faults", 0]];
  L.forEach(([t, b], i) => P.t(570, 538 + i * 16.5, t, { s: b ? 10.5 : 9.8, b }));
}

/* =================================================================== PAGE 7 – earthing, shielding, EMC */
function page7(P, S, K) {
  const F = S.emc || "";
  // cabinet + mounting plate
  P.box(50, 50, 650, 650, {}); P.box(70, 80, 610, 560, { cls: "ck-plate" });
  P.t(80, 98, "galvanised mounting plate = reference potential (large-area contact, no paint)", { s: 9.5, c: "mut" });
  P.raw(`<path d="M380,112 V560" class="ck-zone"/>`);
  P.t(90, 130, "DIRTY zone: power, filter, drive", { s: 10.5, b: 1, c: "warnTx" }); P.t(396, 130, "CLEAN zone: PLC, I/O, 24 V, network", { s: 10.5, b: 1, c: "ok" });
  const d = (x, y, w, h, t, key) => { P.box(x, y, w, h, {}); t.split("|").forEach((l, i, a) => P.t(x + w / 2, y + h / 2 + 4 + (i - (a.length - 1) / 2) * 13, l, { a: "middle", s: 10, b: i === 0 })); if (key) P.hit(key, x, y, w, h); };
  d(110, 150, 70, 60, "-Q1|-F1 -F2", null); d(190, 150, 60, 60, "-K1|-K2", null); d(265, 150, 95, 110, "-A11|drive|(PWM)", "A11e");
  d(400, 150, 60, 60, "-A2|PLC", null); d(470, 150, 60, 60, "-A3|I/O", null); d(540, 150, 60, 60, "-T1|24 V", "T1e"); d(610, 150, 60, 60, "-A80|switch", null);
  d(90, 450, 70, 50, "-Z1|filter", "Z1e");
  P.w([[110, 640], [110, 500]], "L1", undefined); P.t(116, 630, "mains in (unfiltered)", { s: 8.5, c: "mut" });
  P.raw(`<path d="M140,450 V410" class="ck-arrow"/>`); P.t(146, 420, "filtered → -A11 (short, apart)", { s: 8.5, c: "mut" });
  // PE in star: every device has its own PE wire to the bar
  const yb = 590;
  [[175, 210], [245, 210], [350, 260], [455, 210], [525, 210], [595, 210], [665, 210], [150, 500]].forEach(([x, y]) => P.w([[x, y], [x, yb]], "PE", undefined));
  P.raw(`<rect x="90" y="${yb - 4}" width="195" height="8" class="ck-pebar"/><rect x="315" y="${yb - 4}" width="355" height="8" class="ck-pebar"/>`);
  P.t(500, yb + 20, "-PE bar (star point)", { a: "middle", s: 9.5, b: 1 });
  P.w([[670, yb], [720, yb], [720, 676]], "PE", undefined); P.pe(720, 676); P.t(708, 692, "main earthing terminal → building earth", { a: "end", s: 9, c: "mut" });
  P.hit("PEstar", 90, yb - 8, 580, 16);
  if (F === "peloop") { P.raw(`<path d="M455,300 C 480,340 560,340 595,300" class="ck-faultw"/>`); P.t(525, 360, "2nd PE link = loop!", { a: "middle", s: 10, c: "bad", b: 1 }); }
  // 0 V of the 24 V supply earthed at one point (link)
  P.w([[555, 210], [555, 530]], "0V", undefined); P.raw(`<g class="ck-sym"><path d="M549,530 h12 M549,546 h12"/><path d="M555,530 V546" class="${F === "zero" ? "ck-dead" : ""}"/></g>`); P.w([[555, 546], [555, yb]], "PE", undefined);
  P.t(549, 526, F === "zero" ? "0 V NOT earthed!" : "0 V – PE link (ONE point)", { a: "end", s: 9, c: F === "zero" ? "bad" : "mut", b: F === "zero" });
  // motor cable: drive -> 360° clamp on the plate -> EMC gland -> motor (shield both ends)
  const path = [[300, 260], [300, 722], [820, 722], [820, 652]];
  P.raw(`<path d="M${path.map((p) => p.join(",")).join(" L")}" class="ck-braid"/>`);
  P.w(path, "L3", undefined, { cls: "ck-thick" });
  if (F === "pigtail") { P.raw(`<path d="M300,540 q-40,0 -46,46" class="ck-faultw"/><rect x="226" y="520" width="110" height="74" class="ck-faultbox"/>`); P.t(222, 534, "pigtail!", { a: "end", s: 10, c: "bad", b: 1 }); }
  else { P.raw(`<rect x="286" y="533" width="28" height="14" rx="3" class="ck-clamp"/>`); P.t(320, 544, "360° shield clamp", { s: 9, c: "mut" }); }
  P.raw(`<rect x="286" y="694" width="28" height="12" class="ck-clamp"/>`); P.t(320, 690, "EMC cable gland", { s: 9, c: "mut" });
  P.motor(820, 624, 26, {}); P.raw(`<rect x="806" y="652" width="28" height="10" class="ck-clamp"/>`);
  P.t(854, 618, "-M1 motor: shield 360° in the", { s: 9.5 }); P.t(854, 631, "EMC gland of the terminal box", { s: 9.5 }); P.t(854, 644, "→ shield on BOTH ends", { s: 9.5, b: 1 });
  P.t(320, 300, "-W11 shielded motor cable", { s: 9, c: "mut" });
  P.hit("W11e", 284, 260, 34, 470);
  // cable tray section
  P.box(760, 60, 390, 196, { cls: F === "parallel" ? "ck-faultbox" : "ck-note" }); P.t(770, 78, "Cable tray (section): separate power and signals", { s: 10.5, b: 1 });
  P.raw(`<path d="M790,100 V196 H1120 V100" class="ck-tray"/>`);
  if (F !== "parallel") P.raw(`<path d="M955,100 V196" class="ck-tray"/>`);
  for (let i = 0; i < 4; i++) P.raw(`<circle cx="${822 + i * 30}" cy="182" r="11" class="ck-cpow"/>`);
  for (let i = 0; i < 5; i++) P.raw(`<circle cx="${F === "parallel" ? 945 + i * 22 : 985 + i * 26}" cy="187" r="7" class="ck-csig"/>`);
  P.t(800, 216, "motor + power cables", { s: 9 }); P.t(968, 216, "signal, bus, encoder", { s: 9 }); P.t(960, 96, F === "parallel" ? "separator missing!" : "metal separator", { s: 9, c: F === "parallel" ? "bad" : "mut", b: F === "parallel" });
  P.t(770, 242, "≥ 200 mm without separator · cross at 90° only", { s: 9.5, b: 1 });
  P.hit("tray", 760, 60, 390, 196);
  // equipotential bonding
  P.box(760, 276, 390, 150, {}); P.t(770, 294, "Equipotential bonding (protective + functional)", { s: 10.5, b: 1 });
  [["robot base", 806], ["fence", 884], ["conveyor", 962], ["machine", 1040], ["controller", 1112]].forEach(([n, x]) => { P.box(x - 34, 312, 68, 30, {}); P.t(x, 331, n, { a: "middle", s: 9 }); P.w([[x, 342], [x, 392]], "PE", undefined); });
  P.w([[772, 392], [1140, 392]], "PE", undefined); P.t(770, 414, "16 mm² Cu (example) to the building earth grid, short + direct", { s: 9.5, c: "mut" });
  P.hit("bond", 760, 276, 390, 150);
  // flyback diode detail
  P.box(760, 446, 390, 120, { cls: F === "diode" ? "ck-faultbox" : "" }); P.t(770, 464, "Valve coil at a DO: flyback diode", { s: 10.5, b: 1 });
  V(P, 800, 474, 486, "24", undefined); P.coil(800, 486, { kind: "valve", t: false }); V(P, 800, 526, 540, "0V", undefined);
  if (F !== "diode") { P.w([[800, 486], [840, 486]], "24", undefined); P.diode(840, 486, { up: true }); P.w([[840, 526], [800, 526]], "0V", undefined); P.dot(800, 486); P.dot(800, 526); }
  P.t(866, 492, F === "diode" ? "diode missing: −300 … −1000 V spike when" : "the diode takes the coil current at", { s: 9.5, c: F === "diode" ? "bad" : "" });
  P.t(866, 506, F === "diode" ? "the output switches off → output dies, noise" : "switch-off: no spike, no interference", { s: 9.5, c: F === "diode" ? "bad" : "" });
  P.t(866, 526, "(the valve drops out 2–5× slower; use a", { s: 9, c: "mut" }); P.t(866, 539, "Zener / varistor when fast release is needed)", { s: 9, c: "mut" });
  P.hit("Y11e", 760, 446, 390, 120);
  P.t(40, 756, "Rules: PE in star · large-area metal contact · shields 360° at BOTH ends (motor, bus, encoder) · power and signals apart · filter at the cabinet entry, input and output cables apart.", { s: 9.5, c: "mut" });
}
/* =================================================================== PAGE 8 – cabinet layout + heat */
function page8(P, S, K) {
  const sc = 0.5, ox = 60, oy = 80, Wp = 600, Hp = 1200;   // plate 600 × 1200 mm at 0.5 px/mm
  const X = (mm) => ox + mm * sc, Yy = (mm) => oy + mm * sc;
  P.t(ox, 62, "Mounting plate, front view (scale 1:4 on A3, mm) – wall cabinet 600 × 1200 × 300", { s: 10.5, b: 1 });
  P.box(X(0), Yy(0), Wp * sc, Hp * sc, { cls: "ck-plate" });
  const duct = (x, y, w, h) => P.raw(`<rect x="${X(x)}" y="${Yy(y)}" width="${w * sc}" height="${h * sc}" class="ck-duct"/>`);
  duct(20, 20, 560, 60); duct(20, 80, 40, 1040); duct(540, 80, 40, 1040);
  [300, 520, 760, 980].forEach((y) => duct(60, y, 480, 60));
  duct(20, 1120, 560, 60);
  const dv = (x, y, w, h, t, key, cls = "") => { P.raw(`<rect x="${X(x)}" y="${Yy(y)}" width="${w * sc}" height="${h * sc}" class="ck-dev ${cls}"/>`); const rot = w * sc < t.length * 5.2 + 4; P.t(X(x + w / 2) + (rot ? 3 : 0), Yy(y + h / 2) + (rot ? 0 : 3), t, { a: "middle", s: 8.5, b: 1, rot: rot ? -90 : 0 }); if (key) P.hit(key, X(x), Yy(y), w * sc, h * sc); };
  [190, 440, 655, 885].forEach((y) => P.raw(`<rect x="${X(60)}" y="${Yy(y) - 4}" width="${480 * sc}" height="8" class="ck-rail"/>`));
  // rail 1 power (y 100–280)
  dv(70, 110, 90, 150, "-Q1", "Q1"); dv(170, 130, 54, 110, "-F1", "F1"); dv(234, 130, 54, 110, "-F2", "F2"); dv(298, 130, 36, 110, "-F3", "F3"); dv(344, 130, 36, 110, "-F4", "F4");
  dv(390, 130, 45, 110, "-Q11", "Q11"); dv(445, 130, 45, 110, "-Q12", "Q12");
  // rail 2 contactors + PSU
  dv(70, 380, 45, 110, "-K1", "K1"); dv(125, 380, 45, 110, "-K2", "K2"); dv(180, 380, 45, 110, "-K11", "K11"); dv(235, 380, 45, 110, "-K12", "K12");
  dv(300, 360, 90, 140, "-T1", "T1"); dv(400, 370, 72, 120, "-F21…26", "F21"); dv(480, 380, 50, 110, "-G2", "G2");
  // rail 3 control
  dv(70, 580, 80, 150, "-A2", "A2"); dv(155, 590, 140, 130, "F-DI/F-DQ", "A2"); dv(305, 590, 60, 130, "-A80", "A80"); dv(375, 600, 72, 110, "-K21…23", "K21");
  dv(455, 600, 36, 110, "-K5", "K5"); dv(495, 600, 36, 110, "-K6", "K6");
  // rail 4 terminals
  dv(70, 830, 140, 110, "-X1 power", "X1"); dv(220, 830, 160, 110, "-X2 I/O", "X2"); dv(390, 830, 140, 110, "-X4 safety", "X4");
  // bottom: cable entry + PE
  P.raw(`<rect x="${X(60)}" y="${Yy(1060)}" width="${480 * sc}" height="${16 * sc}" class="ck-pebar"/>`); P.t(X(300), Yy(1052), "-PE bar", { a: "middle", s: 8.5, b: 1 });
  for (let i = 0; i < 9; i++) P.raw(`<circle cx="${X(90 + i * 52)}" cy="${Yy(1150)}" r="${8 * sc + 3}" class="ck-gland"/>`);
  P.t(X(300), Yy(1210) + 8, "cable entry: EMC glands (360° shield contact)", { a: "middle", s: 8.5, c: "mut" });
  // zone labels on the right of the plate
  const zx = X(Wp) + 10;
  [["POWER (dirty): 400 V, contactors", 100, 280], ["POWER / 24 V supply", 360, 500], ["CONTROL (clean): PLC, safety, relays", 580, 740], ["TERMINALS: field wiring", 830, 940]].forEach(([t, a, b]) => {
    P.raw(`<path d="M${zx},${Yy(a)} V${Yy(b)}" class="ck-zonebar"/>`); P.t(zx + 6, Yy((a + b) / 2) + 3, t, { s: 9, c: "mut" });
  });
  P.hit("ducts", X(20), Yy(20), 560 * sc, 60 * sc);
  // door view
  const dx = 590, dy = 90;
  P.t(dx, 80, "Door (outside)", { s: 10.5, b: 1 });
  P.box(dx, dy, 160, 320, {});
  P.raw(`<circle cx="${dx + 40}" cy="${dy + 50}" r="22" class="ck-qhandle"/><rect x="${dx + 30}" y="${dy + 30}" width="20" height="40" rx="3" class="ck-qbar"/>`); P.t(dx + 70, dy + 54, "-Q1 handle", { s: 9 });
  P.raw(`<circle cx="${dx + 40}" cy="${dy + 120}" r="14" class="ck-estopc"/>`); P.t(dx + 62, dy + 124, "-S2 e-stop", { s: 9 });
  P.raw(`<circle cx="${dx + 40}" cy="${dy + 165}" r="9" class="ck-resetc"/>`); P.t(dx + 62, dy + 169, "-S6 reset", { s: 9 });
  P.box(dx + 20, dy + 190, 120, 70, {}); P.t(dx + 80, dy + 229, "-A7 HMI", { a: "middle", s: 9.5, b: 1 });
  P.raw(`<rect x="${dx + 20}" y="${dy + 275}" width="50" height="30" class="ck-grille"/><rect x="${dx + 90}" y="${dy + 20}" width="50" height="20" class="ck-grille"/>`);
  P.t(dx + 76, dy + 294, "fan + filter IN", { s: 8.5, c: "mut" }); P.t(dx + 88, dy + 16, "outlet filter", { s: 8.5, c: "mut" });
  P.hit("door", dx, dy, 160, 320);
  // heat calculation block
  const h = K.heat;
  P.box(780, 80, 370, 660, { cls: "ck-note" });
  const L = [["Heat calculation (example)", 1], ["Losses inside the cabinet P_loss:", 0]];
  h.loss.forEach(([n, w]) => L.push([`  ${n}: ${f(w, 1)} W`, 0]));
  L.push([`  Σ P_loss = ${f(h.P, 0)} W`, 1], ["", 0], ["Surface (IEC/TR 60890, wall-mounted):", 0], [`  A = 1.4·W·(H+D) + 1.8·D·H = ${f(h.Ae, 2)} m²`, 0],
    [`Through the walls at ΔT = ${h.TiMax} − ${h.Ta} = ${h.dT} K:`, 0], [`  P_wall = k·A·ΔT = ${h.k} · ${f(h.Ae, 2)} · ${h.dT} = ${f(h.Psurf, 0)} W`, 0],
    [`Fan must remove P = ${f(h.P, 0)} − ${f(h.Psurf, 0)} = ${f(h.Pfan, 0)} W:`, 0], [`  V̇ = 3.1 · P / ΔT = 3.1 · ${f(h.Pfan, 0)} / ${h.dT} = ${f(h.Vdot, 0)} m³/h`, 1],
    [`  → filter fan ${h.fan} m³/h (filter halves the flow)`, 0], ["", 0], [`If the hall is hotter than the cabinet (T_amb ${h.TaHot} °C > 35 °C):`, 0],
    ["  a fan cannot cool → air-conditioner (or heat exchanger)", 0], [`  Q_AC = P_loss + k·A·(T_amb − T_in) = ${f(h.Qac, 0)} W`, 1], ["", 0],
    [`Robot controller -A1: own cooling, ≈ ${h.ctrlLoss} W into the hall`, 0], ["(≈ 5 % of the rated power, estimate)", 0], ["k = 5.5 W/(m²·K) painted sheet steel", 0], ["3.1 m³·K/(W·h) = 3600/(ρ·c_p), air at sea level", 0]);
  L.forEach(([t, b], i) => P.t(790, 98 + i * 15.5, t, { s: b ? 10.5 : 9.6, b }));
}

/* =================================================================== PAGE 9 – classic safety relay */
function page9(P, S, K) {
  const sr = S.sr, yR = 360;
  H(P, 70, 40, 1000, "24", true, { flow: false }); P.t(44, 64, "+24 V (-F22) " + P.ref("F22:out"), { s: 9.5, c: "ref" });
  H(P, 720, 40, 1000, "0V", true, { flow: false }); P.t(1006, 724, "0 V", { s: 9.5, c: "mut" });
  // relay box
  P.box(420, yR, 360, 100, { on: sr.out, cls: sr.fault ? "ck-boxbad" : "" });
  P.t(430, yR + 46, "-K10 safety relay (e-stop / gate), Cat 4 / PL e", { s: 10.5, b: 1 });
  P.t(430, yR + 60, "2 force-guided relays · cross-fault detection · monitored reset", { s: 9, c: "mut" });
  P.t(430, yR + 76, sr.fault ? "FAULT: " + sr.fault : sr.out ? "outputs 13-14 / 23-24 CLOSED" : sr.need ? "waiting for reset (S33-S34)" : "outputs open", { s: 10, b: 1, c: sr.fault ? "bad" : sr.out ? "ok" : "warnTx" });
  const top = [["A1", 430], ["S11", 500], ["S12", 540], ["S21", 600], ["S22", 640], ["S33", 700], ["S34", 740]];
  top.forEach(([n, x]) => P.t(x, yR + 14, n, { a: "middle", s: 8.5 }));
  V(P, 430, 70, yR, "24", true, { flow: false }); P.dot(430, 70);
  P.hit("K10", 420, yR, 360, 100);
  // channel 1: S11 -> up through S1/S2 -> across -> down to S12 ; channel 2: S21 -> S22
  const ch = (xu, xd, label, on) => {
    const pr = [S.es.tp, S.es.cab];
    let st = on;
    V(P, xu, yR, 290, "24", st, { fcls: "ck-pulse" });
    P.contact(xu, 250, { type: "NC", act: pr[0] }); if (pr[0]) st = false;
    V(P, xu, 250, 210, "24", st, { fcls: "ck-pulse" }); P.contact(xu, 170, { type: "NC", act: pr[1] }); if (pr[1]) st = false;
    P.w([[xu, 170], [xu, 130], [xd, 130], [xd, yR]], "24", st, { fcls: "ck-pulse" });
    return st;
  };
  const c1 = ch(500, 540, "ch1", true), c2 = ch(600, 640, "ch2", true);
  P.raw(`<g transform="translate(0,0)"></g>`);
  [[250, "-S1", "pendant"], [170, "-S2", "cabinet"]].forEach(([y, t, n]) => { P.link(470, 595, y + 20).act(470, y + 20, "mush").forced(490, y + 20); P.tag(400, y + 16, t, [n], { a: "end" }); });
  P.t(500, 120, "channel 1", { s: 9, c: "mut" }); P.t(600, 120, "channel 2", { s: 9, c: "mut" });
  if (S.fault.cross) { P.raw(`<path d="M540,320 l10,-6 l10,12 l10,-12 l10,12 l10,-12 l10,12 l10,-6" class="ck-faultw"/>`); P.t(580, 344, "short ch1–ch2", { a: "middle", s: 9.5, c: "bad", b: 1 }); }
  // reset loop S33 -> K1 NC -> K2 NC -> S6 -> S34
  V(P, 700, yR, 290, "24", true, { flow: false });
  P.contact(700, 250, { type: "NC", act: S.k1c }); V(P, 700, 250, 210, "24", !S.k1c, { flow: false });
  P.contact(700, 170, { type: "NC", act: S.k2c }); V(P, 700, 170, 160, "24", !S.k1c && !S.k2c, { flow: false });
  P.w([[700, 160], [700, 130], [740, 130], [740, 170]], "24", !S.k1c && !S.k2c, { flow: false });
  P.contact(740, 170, { type: "NO", act: S.resetBtn }); P.link(716, 735, 190).act(716, 190, "push");
  V(P, 740, 210, yR, "24", !S.k1c && !S.k2c && S.resetBtn, { flow: false });
  P.t(686, 270, "-K1", { a: "end", s: 10, b: 1 }); P.t(686, 190, "-K2", { a: "end", s: 10, b: 1 }); P.t(756, 186, "-S6", { s: 10, b: 1 }); P.t(756, 198, "reset", { s: 9, c: "mut" });
  P.t(760, 290, "feedback loop:", { s: 9, c: "mut" }); P.t(760, 301, "K1, K2 NC (mirror)", { s: 9, c: "mut" }); P.t(760, 312, "must be closed", { s: 9, c: "mut" });
  // outputs
  const bot = [["13", 500], ["23", 530], ["14", 600], ["24", 660], ["41", 710], ["42", 740], ["A2", 770]];
  bot.forEach(([n, x]) => P.t(x, yR + 96, n, { a: "middle", s: 8.5 }));
  P.w([[400, 70], [400, 490], [530, 490], [530, yR + 100]], "24", true, { flow: false }); P.dot(400, 70); P.w([[500, 490], [500, yR + 100]], "24", true, { flow: false }); P.dot(500, 490);
  [[600, "-K1", S.sr.out], [660, "-K2", S.sr.out]].forEach(([x, n, on]) => { V(P, x, yR + 100, 560, "24", on); P.coil(x, 560, { on, kind: "safety" }); V(P, x, 600, 720, "0V", on, { flow: false }); P.dot(x, 720); P.t(x - 18, 578, n, { a: "end", s: 10.5, b: 1 }); });
  V(P, 770, yR + 100, 720, "0V", true, { flow: false }); P.dot(770, 720);
  P.w([[710, yR + 100], [710, 520]], "24", true, { flow: false }); P.w([[740, yR + 100], [740, 520]], "24", !sr.out, { flow: false }); P.t(725, 536, "41-42 → PLC", { a: "middle", s: 8.5, c: "mut" }); P.t(725, 547, "(status, not safe)", { a: "middle", s: 8.5, c: "mut" });
  // motor via K1 + K2
  [860, 880, 900].forEach((x, i) => {
    const k = ["L1", "L2", "L3"][i];
    V(P, x, 470, 500, k, S.q1); P.contact(x, 500, { type: "NO", fn: "ctr", act: S.k1c }); V(P, x, 540, 560, k, S.q1 && S.k1c); P.contact(x, 560, { type: "NO", fn: "ctr", act: S.k2c });
    V(P, x, 600, cy0(880, 650, 24, x), k, S.q1 && S.k1c && S.k2c);
  });
  P.link(855, 895, 520); P.link(855, 895, 580); P.motor(880, 650, 24, { on: S.q1 && S.k1c && S.k2c });
  P.t(910, 486, "L1 L2 L3 (as /1.3)", { s: 9, c: "mut" }); P.t(912, 524, "-K1", { s: 10, b: 1 }); P.t(912, 584, "-K2", { s: 10, b: 1 }); P.t(912, 654, "-M11", { s: 10, b: 1 });
  // notes
  P.box(40, 520, 340, 190, { cls: "ck-note" });
  [["Classic variant (small cell, 1–2 e-stops)", 1], ["+ simple, cheap, no programming", 0], ["+ Cat 4 / PL e possible (device), fixed logic", 0], ["− one relay per function, much wiring", 0],
    ["− no diagnosis WHICH button / which fault", 0], ["− several e-stops in series: one fault can be", 0], ["   masked by pressing another button", 0], ["   (ISO/TR 24119) → lower DC, max. PL d", 0], ["− robot STO + conveyor + machine = many relays", 0],
    ["→ for the robot cell: safety PLC (page 4)", 1]].forEach(([t, b], i) => P.t(50, 538 + i * 17, t, { s: b ? 10.5 : 9.8, b, c: b ? "" : t.startsWith("+") ? "ok" : "" }));
  P.t(40, 744, "S11/S21 send different test pulses; S12/S22 read them back. A short ch1–ch2 makes the pulses equal → fault, outputs stay open. Reset S34 on the falling edge (monitored manual reset).", { s: 9.5, c: "mut" });
}

const DRAW = [page1, page2, page3, page4, page5, page6, page7, page8, page9];
export const NPAGES = DRAW.length;
export function drawPage(P, n, S, K, rbRef) {
  frame(P, { title: PAGE_TITLES[n - 1], robot: rbRef, page: n, of: NPAGES });
  DRAW[n - 1](P, S, K);
}
