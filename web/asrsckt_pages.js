/* AS/RS tab – item 3: the 8 SCHEMATIC PAGES (SVG strings). Pure drawing – the live state S comes from asrsckt.js, numbers K from asrsckt_calc.js.
 * 1 mains + power rail · 2 crane drive power (DC link) · 3 hoist safety · 4 travel safety + positioning · 5 safety circuit (F-PLC)
 * · 6 crane PLC I/O + data link · 7 conveyor + I/O station · 8 crane cabinet layout + heat.
 * Device tags: IEC 81346-2 two-letter classes (project rule, guide 15 §17.3). Cross-references "/page.column".
 * All ratings are EXAMPLES. No arrow characters up/down in texts (they render as emoji) – arrows are drawn as paths.
 */
import { frame, colX } from "./asrsckt_sym.js";

const f = (v, d = 1) => (+v).toFixed(d);
const V = (P, x, y1, y2, c, st, o) => P.w([[x, y1], [x, y2]], c, st, o);
const H = (P, y, x1, x2, c, st, o) => P.w([[x1, y], [x2, y]], c, st, o);
const kW = (w) => (w >= 0 ? "+" : "−") + f(Math.abs(w) / 1000, 1) + " kW";
function rotC(P, x, y, o) { P.raw(`<g transform="rotate(-90 ${x} ${y})">`); P.contact(x, y, o); P.raw("</g>"); }

export const PAGE_TITLES = ["Mains supply + power rail to the crane", "Crane drive power – shared DC link", "Hoist safety – overspeed, slack rope, overload, limits",
  "Travel safety + positioning", "Safety circuit – F-PLC, e-stops, door, light curtain, STO", "Crane PLC I/O + optical data link", "Conveyor + I/O station circuits", "Crane cabinet layout + heat"];
export const NPAGES = PAGE_TITLES.length;
const LOC = ["+CAB01 main cabinet at the aisle end", "+CRN01 crane cabinet (on the crane)", "+CRN01 · +FLD.CRN hoist", "+CRN01 · +FLD.AISLE", "+CAB01 · +CRN01 · +FLD", "+CRN01 · +CAB01", "+CAB02 conveyor cabinet · +FLD.IO", "+CRN01"];

/* =================================================================== PAGE 1 – mains, branches, power rail */
function page1(P, S, K) {
  const on = S.q1, M = K.sup, C = K.cur, R = K.rail;
  const X = { L1: 70, L2: 90, L3: 110, N: 130, PE: 150 }, BUS = { L1: 230, L2: 240, L3: 250, N: 260 };
  ["L1", "L2", "L3", "N", "PE"].forEach((k) => { P.t(X[k], 50, k, { a: "middle", s: 11, b: 1 }); P.term(X[k], 62); });
  P.t(62, 66, "-XD0", { a: "end", b: 1, s: 12 });
  P.t(178, 50, "Supply 3/N/PE AC 400/230 V 50 Hz, TN-S", { b: 1, s: 12.5 });
  P.t(178, 64, `-W0001 5G${M.A} mm² Cu, ${M.L} m from the logistics sub-distribution`, { s: 11, c: "mut" });
  P.t(178, 77, `protected there by -FC0 gG ${M.In} A (I_z = ${f(M.Iz, 1)} A ≥ ${f(M.Izreq, 1)} A)`, { s: 11, c: "mut" });
  ["L1", "L2", "L3"].forEach((k) => V(P, X[k], 66, 96, k, on, { flow: false }));
  ["L1", "L2", "L3"].forEach((k) => P.contact(X[k], 96, { type: "NO", fn: "dis", act: on, hl: false }));
  P.link(50, X.L3 - 5, 116).act(50, 116, "turn");
  P.tag(178, 104, "-QB1", [`main switch 3-pole, ${M.Q1} A, AC-23`, "lockable in OFF · IEC 60204-1 §5.3"]);
  P.hit("QB1", 34, 92, 90, 50);
  ["L1", "L2", "L3"].forEach((k) => { V(P, X[k], 136, 156, k, on, { flow: false }); P.fuse(X[k], 156); V(P, X[k], 196, BUS[k], k, on, { flow: false }); P.dot(X[k], BUS[k]); });
  P.tag(178, 160, "-FC1", [`fuses gG 3 × ${M.In} A (cabinet)`, "back-up for the branch devices"]);
  P.hit("FC1", 58, 154, 64, 46);
  V(P, X.N, 66, BUS.N, "N", on, { flow: false }); P.dot(X.N, BUS.N);
  V(P, X.PE, 66, 724, "PE");
  ["L1", "L2", "L3", "N"].forEach((k) => { H(P, BUS[k], X[k], 1120, k, on, { flow: false }); P.t(1126, BUS[k] + 4, k, { s: 11, c: "mut" }); });

  /* ---- branch A: crane feed → conductor rail / energy chain */
  const ca = [220, 240, 260], ph3 = ["L1", "L2", "L3"], craneOn = on && S.qb2;
  ca.forEach((x, i) => { V(P, x, BUS[ph3[i]], 300, ph3[i], on, { flow: false }); P.dot(x, BUS[ph3[i]]); P.contact(x, 300, { type: "NO", fn: "brk", act: on, hl: false }); V(P, x, 340, 360, ph3[i], on, { flow: false }); P.contact(x, 360, { type: "NO", fn: "dis", act: S.qb2, hl: !S.qb2 }); V(P, x, 400, 470, ph3[i], craneOn, { flow: craneOn && S.crPow > 300 }); P.term(x, 440); });
  P.link(215, 255, 320); P.link(215, 255, 380).act(215, 380, "turn");
  P.tag(272, 306, "-FC2", [`MCCB 3P, I_r ${FUSE_C(K)} A`, `crane: I_th ${f(C.Ith, 1)} A, peak ${f(C.Ipk, 1)} A`]);
  P.tag(272, 368, "-QB2", [S.feedType === "rail" ? "rail isolator, lockable" : "crane feed isolator, lockable", "maintenance: isolate + lock"]);
  P.t(272, 444, "-XD1", { b: 1, s: 12 });
  P.hit("FC2", 206, 296, 66, 48); P.hit("QB2", 206, 356, 66, 48);
  if (S.feedType === "rail") {
    // feed cable to the rail feed point
    const yR = 560, xa = 190, xb = 880, lab = ["L1", "L2", "L3", "N", "PE"];
    const feedX = S.feed === "centre" ? (xa + xb) / 2 : xa + 12;
    ca.forEach((x, i) => P.w([[x, 470], [x, 490 + i * 6], [feedX - 20 + i * 10, 490 + i * 6], [feedX - 20 + i * 10, yR + i * 16]], ph3[i], craneOn, { flow: false }));
    P.w([[X.PE, 520], [feedX + 20, 520], [feedX + 20, yR + 64]], "PE"); P.dot(X.PE, 520);
    P.t(feedX + 140, 508, `-W0010 4G${M.A >= 10 ? 10 : M.A} · feed point at the ${S.feed === "centre" ? "rail centre" : "I/O end"}`, { s: 11, c: "mut" });
    P.rail(xa, xb, yR, lab, { dy: 16 });
    P.tag(xa, yR + 92, "-WD10", [`conductor rail 4-pole + PE (enclosed, Cu), ${R.size} A, ${K.I.Lrail} m`, "N = spare · PE with 2 collectors (EN 60204-32) · end caps, hangers"]);
    // current collector trolley at the crane position
    const cx = xa + 20 + Math.max(0, Math.min(1, (S.x + 0.5) / 29)) * (xb - xa - 40);
    P.raw(`<rect x="${cx - 30}" y="${yR - 24}" width="60" height="${4 * 16 + 34}" rx="4" class="ck-box ck-dash sr-trolley"/>`);
    lab.forEach((l, i) => P.raw(`<rect x="${cx - 8}" y="${yR + i * 16 - 5}" width="16" height="10" rx="2" class="sr-coll${craneOn ? " sr-collon" : ""}"/>`));
    P.raw(`<rect x="${cx + 10}" y="${yR + 4 * 16 - 5}" width="16" height="10" rx="2" class="sr-coll${craneOn ? " sr-collon" : ""}"/>`);
    V(P, cx + 22, yR - 24, 502, "L2", craneOn, { flow: craneOn && S.crPow > 300, rev: S.crPow < -300 && S.regen });
    P.tag(cx + 34, yR - 30, "-XC10", ["collector trolley"]);
    P.hit("WD10", xa, yR - 12, xb - xa, 84); P.hit("XC10", cx - 30, yR - 24, 60, 98);
    P.t(cx + 28, 506, `to +CRN01 /2.1 · x = ${f(S.x, 1)} m`, { s: 11, c: "ref" });
    P.reg("XC10:out", cx);
  } else {
    // energy chain (gliding chain in a guide trough, fixed point in the middle of the travel)
    const yC = 600, xa = 190, xb = 880, mid = (xa + xb) / 2, cx = xa + 20 + Math.max(0, Math.min(1, (S.x + 0.5) / 29)) * (xb - xa - 40);
    ca.forEach((x, i) => P.w([[x, 470], [x, 500 + i * 6], [mid - 10 + i * 10, 500 + i * 6], [mid - 10 + i * 10, yC + 28]], ph3[i], craneOn, { flow: false }));
    P.raw(`<rect x="${xa}" y="${yC + 30}" width="${xb - xa}" height="14" class="sr-trough"/>`);
    const lo = Math.min(mid, cx), hi = Math.max(mid, cx);
    P.raw(`<path d="M${mid},${yC + 28} H${(lo + hi) / 2} A26,26 0 0 1 ${(lo + hi) / 2},${yC - 24} H${cx}" class="sr-chain"/>`);
    V(P, cx, yC - 24, yC - 64, "L2", craneOn, { flow: craneOn && S.crPow > 300 });
    P.tag(xa, yC + 64, "-WD11", [`energy chain (e.g. igus E4 in a guide trough), flexible cable 4G${R.size} + PE`, `chain cable: I_z ${f(R.Iz, 1)} A · PROFINET cable in the same chain (data instead of DDLS)`]);
    P.hit("WD11", xa, yC - 30, xb - xa, 80);
    P.t(cx + 8, yC - 56, `to +CRN01 /2.1 · x = ${f(S.x, 1)} m`, { s: 11, c: "ref" });
    P.reg("XC10:out", cx);
  }

  /* ---- branch B: conveyor cabinet */
  const cb = [440, 460, 480];
  cb.forEach((x, i) => { V(P, x, BUS[ph3[i]], 300, ph3[i], on, { flow: false }); P.dot(x, BUS[ph3[i]]); P.contact(x, 300, { type: "NO", fn: "brk", act: on, hl: false }); V(P, x, 340, 420, ph3[i], on, { flow: on }); });
  V(P, 500, BUS.N, 420, "N", on, { flow: false }); P.dot(500, BUS.N);
  P.link(435, 475, 320);
  P.tag(492, 300, "-FC3", ["MCB C10 3P", `I_b = ${f(C.Iconv, 1)} A`]);
  P.box(420, 420, 120, 56, { on });
  P.tag(428, 438, "+CAB02", ["conveyor + I/O cabinet", "-W0020 5G2.5"]);
  P.xref(428, 489, "motors, 24 V → /7.1");
  P.hit("FC3", 428, 296, 64, 48);

  /* ---- branch C: 24 V PSU (stationary) */
  V(P, 620, BUS.L1, 300, "L1", on, { flow: false }); P.dot(620, BUS.L1); V(P, 640, BUS.N, 300, "N", on, { flow: false }); P.dot(640, BUS.N);
  P.contact(620, 300, { type: "NO", fn: "brk", act: on, hl: false }); P.contact(640, 300, { type: "NO", act: on, hl: false }); P.link(615, 635, 320);
  V(P, 620, 340, 400, "L1", on); V(P, 640, 340, 400, "N", on);
  P.tag(655, 306, "-FC4", ["MCB C6 1P+N"]);
  P.box(600, 400, 90, 60, { on }); P.raw(`<path d="M600,460 L690,400" class="ck-thin"/>`);
  P.t(610, 420, "~", { s: 15 }); P.t(676, 454, "=", { s: 15 });
  P.tag(698, 416, "-TB1", ["24 V DC 10 A", "F-PLC, DDLS, doors,", "light curtain"]);
  P.xref(698, 470, "→ /5.1");
  P.hit("TB1", 600, 400, 90, 60); P.hit("FC4", 608, 296, 44, 48);

  /* ---- branch D: aisle light + socket, RCBO */
  V(P, 800, BUS.L2, 300, "L2", on, { flow: false }); P.dot(800, BUS.L2); V(P, 820, BUS.N, 300, "N", on, { flow: false }); P.dot(820, BUS.N);
  P.contact(800, 300, { type: "NO", fn: "brk", act: on, hl: false }); P.contact(820, 300, { type: "NO", act: on, hl: false }); P.link(795, 815, 320);
  P.tag(835, 306, "-FC5", ["RCBO B10, 30 mA, type A", "aisle light + service socket"]);
  V(P, 800, 340, 410, "L2", on); P.lamp(800, 410, { on: on && S.doorOpen }); V(P, 800, 450, 470, "L2", on);
  P.tag(835, 430, "-EA5", ["aisle maintenance light", "on when the door is open"]);
  P.hit("FC5", 788, 296, 44, 48);

  /* ---- numbers box */
  P.box(900, 40, 250, 170, { cls: "ck-note" });
  [["Sizing (example, live with card C)", 1], [`crane peak ${f(C.Ppk / 1000, 1)} kW → I_pk ${f(C.Ipk, 1)} A`, 0], [`crane thermal I_th ${f(C.Ith, 1)} A`, 0], [`+ conveyor ${f(C.Iconv, 1)} A + 24 V/misc ${f(C.Istat, 1)} A`, 0],
    [`I_b = ${f(C.Ib, 1)} A · peak ${f(C.IpkT, 1)} A`, 0], [`-FC0 gG ${M.In} A · -W0001 5G${M.A}`, 0], [`ΔU cable ${f(M.dU, 2)} % + ${R.type === "rail" ? "rail" : "chain"} ${f(R.dU, 2)} %`, 0], [`= ${f(K.dUtot, 2)} % at peak (limit 5 %)`, 1], [`${R.type === "rail" ? `rail ${R.size} A, feed at ${S.feed === "centre" ? "centre" : "end"}` : `chain cable 4G${R.size}`}`, 0]]
    .forEach(([t, b], i) => P.t(908, 58 + i * 17, t, { s: 11, b }));
  /* ---- voltage drop along the rail (mini chart) */
  if (S.feedType === "rail") {
    const gx = 910, gy = 520, gw = 230, gh = 120, L = K.I.Lrail, cen = S.feed === "centre";
    P.raw(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" class="ck-box ck-note"/>`);
    P.t(gx + 6, gy - 6, "ΔU on the rail vs crane position", { s: 11, b: 1 });
    const dmax = Math.max(0.01, R.dU) * 1.25, px = (x) => gx + x / L * gw, py = (d) => gy + gh - d / dmax * (gh - 10);
    const du = (x) => (cen ? Math.abs(x - L / 2) / (L / 2) : x / L) * R.dU;
    let d = ""; for (let i = 0; i <= 40; i++) { const x = i / 40 * L; d += (i ? " L" : "M") + px(x) + "," + py(du(x)); }
    P.raw(`<path d="${d}" class="ck-vline"/>`);
    const xc = Math.max(0, Math.min(L, S.x)); P.raw(`<circle cx="${px(xc)}" cy="${py(du(xc))}" r="4.5" class="sr-dotlive"/>`);
    P.t(gx + 4, gy + 14, `max ${f(R.dU, 2)} %`, { s: 11 }); P.t(gx + gw - 4, gy + gh - 6, `${L} m`, { s: 11, a: "end", c: "mut" }); P.t(gx + 4, gy + gh - 6, "0", { s: 11, c: "mut" });
    P.t(gx, gy + gh + 16, `now ${f(du(xc), 2)} % at x = ${f(xc, 1)} m (I_pk)`, { s: 11, c: "ref" });
  }
  P.raw(`<rect x="60" y="720" width="1080" height="8" class="ck-pebar"/>`);
  P.t(60, 750, "-PE main earth bar · rail PE bonded at both rail ends · rack + rail steel bonded (16 mm²) → /8", { s: 11, c: "mut" });
  P.hit("PE", 60, 716, 1080, 16);
}
const FUSE_C = (K) => { const c = K.cur; return [25, 32, 40, 50, 63, 80].find((x) => x >= c.Ith && x >= c.Ipk / 1.5) || 80; };

/* =================================================================== PAGE 2 – crane drive power, shared DC link */
function page2(P, S, K) {
  const live = S.q1 && S.qb2 && S.qa10, A = S.axes, regenOpt = S.regen;
  const Y = [100, 120, 140], ph3 = ["L1", "L2", "L3"];
  P.xref(40, 86, "from -XC10 " + (P.ref("XC10:out") || "/1.3"));
  // -QB10 crane main switch, -FC10 fuses, -QA10 main contactor (horizontal)
  ph3.forEach((k, i) => { H(P, Y[i], 40, 80, k, S.q1 && S.qb2, { flow: false }); rotC(P, 80, Y[i], { type: "NO", fn: "dis", act: S.qb10, hl: false }); H(P, Y[i], 120, 140, k, S.q1 && S.qb2 && S.qb10, { flow: false });
    P.raw(`<g transform="rotate(-90 140 ${Y[i]})">`); P.fuse(140, Y[i]); P.raw("</g>"); H(P, Y[i], 180, 200, k, S.q1 && S.qb2 && S.qb10, { flow: false });
    rotC(P, 200, Y[i], { type: "NO", fn: "ctr", act: S.qa10 }); H(P, Y[i], 240, 270, k, live, { flow: live && A.netP > 300 }); });
  P.raw(`<path d="M100,88 V152 M220,88 V152" class="ck-mech"/>`);
  P.tag(40, 178, "-QB10", ["crane main switch", "at the crane access"]); P.tag(40, 222, "-FC10", ["gR fuses (drive)"]); P.tag(172, 178, "-QA10", ["main contactor", "coil " + (P.ref("QA10:coil") || "/5.8")]);
  P.reg("QA10:main", 200);
  P.hit("QB10", 66, 88, 46, 66); P.hit("FC10", 126, 88, 50, 66); P.hit("QA10", 186, 88, 46, 66);
  // line reactor
  P.box(270, 88, 50, 64); P.raw(`<path d="M278,100 q5,-6 10,0 q5,6 10,0 q5,-6 10,0 M278,120 q5,-6 10,0 q5,6 10,0 q5,-6 10,0 M278,140 q5,-6 10,0 q5,6 10,0 q5,-6 10,0" class="ck-thin"/>`);
  P.tag(272, 222, "-RA10", ["line reactor 4 %"]); P.hit("RA10", 270, 88, 50, 64);
  ph3.forEach((k, i) => H(P, Y[i], 320, 350, k, live, { flow: live && A.netP > 300 }));
  // infeed -TA10
  P.inv(350, 70, 90, 100, { on: live, regen: live && regenOpt && A.netP < -300, top: "~", bot: "=" });
  P.tag(350, 60, "-TA10", []);
  P.t(448, 120, regenOpt ? "active infeed" : "diode infeed", { s: 11, b: 1 }); P.t(448, 133, regenOpt ? "(AFE): energy" : "+ brake chopper", { s: 11, c: "mut" });
  P.t(448, 146, regenOpt ? "back to the mains" : "→ -RA11", { s: 11, c: "mut" });
  P.hit("TA10", 350, 70, 90, 100);
  // DC bus
  const yP = 240, yN = 262, xa = 395, xb = 1140, dc = live;
  P.w([[395, 170], [395, yP], [xb, yP]], "DC", dc, { flow: false }); P.w([[420, 170], [420, yN], [xb, yN]], "DC", dc, { flow: false });
  P.t(xb - 2, yP - 6, "DC+", { a: "end", s: 11, b: 1 }); P.t(xb - 2, yN + 16, "DC−", { a: "end", s: 11, b: 1 });
  P.t(470, yP - 8, "shared DC link (DC bus bars of the drive system)", { s: 11, c: "mut" });
  // braking resistor (outside the cabinet) – on the infeed / brake module
  if (!regenOpt) {
    V(P, 470, yP, 300, "DC", dc, { flow: S.chop }); P.dot(470, yP); P.res(470, 300, { on: S.chop }); V(P, 470, 340, 360, "DC", dc, { flow: S.chop }); P.igbt(470, 360, { on: S.chop }); P.w([[470, 400], [470, 412], [500, 412], [500, yN]], "DC", dc, { flow: false }); P.dot(500, yN);
    P.tag(512, 318, "-RA11", [`brake resistor ${K.brk.R} Ω`, `${K.brk.Pcont} kW cont. (outside)`]); P.tag(512, 382, "chopper", [`on > ${K.I.Uon} V`]);
    P.hit("RA11", 456, 296, 100, 50);
  } else { P.t(450, 320, "no brake resistor:", { s: 11, c: "ok" }); P.t(450, 333, "energy back to", { s: 11, c: "ok" }); P.t(450, 346, "the mains", { s: 11, c: "ok" }); }
  // DC values
  P.box(560, 60, 230, 150, { cls: "ck-note" });
  P.t(570, 80, "DC link now", { s: 12, b: 1 });
  P.t(570, 102, `V_DC = ${f(S.vdc, 0)} V`, { s: 13, b: 1, id: "srVdc" });
  P.t(570, 122, `net power ${kW(A.netP)}`, { s: 12, id: "srPnet" });
  P.t(570, 141, S.sto ? "STO – no torque, brakes applied" : A.netP < -300 ? (regenOpt ? "regenerating → mains (AFE)" : (S.chop ? "chopper ON → resistor hot" : "regenerating into the DC link")) : A.netP > 300 ? "motoring – energy from the mains" : "standstill / holding", { s: 11.5, c: S.sto ? "bad" : "mut", id: "srDcTxt" });
  P.t(570, 162, `peak braking ${f(K.brk.Pbrk / 1000, 1)} kW → R ≤ ${f(K.brk.Rmax, 1)} Ω`, { s: 11, c: "mut" });
  P.t(570, 178, `per lowering m·g·h·η = ${f(K.brk.Elow / 1000, 1)} kJ`, { s: 11, c: "mut" });
  P.t(570, 194, `axes share energy before it is burnt`, { s: 11, c: "mut" });
  // inverters
  const ax = [
    { k: "tr1", x: 640, tag: "-TA11", m: "-MA11", b: "-MB11", lab: "travel 1", P: K.tr.Pmot, a: A.tr, half: true },
    { k: "tr2", x: 780, tag: "-TA12", m: "-MA12", b: "-MB12", lab: "travel 2", P: K.tr.Pmot, a: A.tr, half: true },
    { k: "hz", x: 920, tag: "-TA13", m: "-MA13", b: "-MB13", lab: "hoist", P: K.hz.Pmot, a: A.hz },
    { k: "fk", x: 1060, tag: "-TA14", m: "-MA14", b: "-MB14", lab: "fork", P: K.fk.Pmot, a: A.fk },
  ];
  ax.forEach((d) => {
    const en = live && d.a.en && !S.sto, Pw = d.half ? d.a.P / 2 : d.a.P, reg = en && Pw < -200, mot = en && Pw > 200;
    V(P, d.x - 15, yP, 300, "DC", dc, { flow: mot, rev: false }); V(P, d.x + 15, yN, 300, "DC", dc, { flow: false }); P.dot(d.x - 15, yP); P.dot(d.x + 15, yN);
    if (reg) P.w([[d.x - 15, 300], [d.x - 15, yP]], "DC", true, { flow: true, fcls: "sr-flowregen" });
    P.inv(d.x - 40, 300, 80, 70, { on: en, regen: reg });
    P.tag(d.x - 40, 386, d.tag, [d.lab, `${d.P} kW`, en ? (reg ? "regen." : mot ? "motoring" : "holding") : S.sto ? "STO" : "disabled"]);
    P.t(d.x + 44, 316, "STO", { s: 11, c: S.sto ? "bad" : "mut" });
    // motor cable (right half of the module, the tag is on the left)
    const mx = d.x + 22;
    ph3.forEach((k, i) => V(P, mx - 9 + i * 9, 370, 512 - Math.abs(i - 1) * 3, k, en, { flow: mot }));
    P.raw(`<ellipse cx="${mx}" cy="${470}" rx="18" ry="6" class="ck-shield"/>`);
    P.motor(mx, 540, 26, { on: en });
    // brake
    const brOpen = en;
    P.w([[mx + 26, 540], [mx + 37, 540]], "24", brOpen); P.coil(mx + 50, 520, { kind: "brake", on: brOpen });
    P.raw(`<path d="M${mx + 26},${532} H${mx + 37}" class="ck-mech"/>`);
    P.t(mx - 34, 586, d.m, { s: 12, b: 1 }); P.t(mx + 32, 586, d.b, { s: 12, b: 1 });
    P.t(mx - 34, 600, brOpen ? "brake open" : "brake closed", { s: 11, c: brOpen ? "ok" : "mut" });
    P.sens(mx - 34, 612, "enc", { w: 36, h: 22 }); P.t(mx + 8, 628, `-BG${d.tag.slice(3)}`, { s: 11, c: "mut" });
    P.t(d.x - 40, 652, en ? kW(Pw) : "0 kW", { s: 13, b: 1, c: reg ? "ok" : mot ? "warnTx" : "mut", id: "srP" + d.k });
    if (en && Math.abs(Pw) > 200) P.flowArrow(d.x - 28, reg ? 490 : 438, d.x - 28, reg ? 438 : 490, { head: reg ? "sr-arrg" : "sr-arrp" });
    P.hit(d.tag.slice(1), d.x - 40, 300, 80, 70); P.hit(d.m.slice(1), mx - 26, 512, 52, 56); P.hit(d.b.slice(1), mx + 36, 516, 30, 50);
    P.reg(d.tag.slice(1) + ":sto", d.x);
  });
  P.t(560, 700, `motor cables: shielded (e.g. ÖLFLEX SERVO / chainflex), shield 360° at both ends · brakes 24 V DC via F-DQ (SBC) ${P.ref("SBC") || "/5.7"}`, { s: 11, c: "mut" });
  P.t(40, 700, "travel: 2 motors, master/slave (synchronous)", { s: 11, c: "mut" });
  P.t(40, 716, "hoist: 2 brakes (motor + drum)", { s: 11, c: "mut" });
  // legend for arrows
  P.flowArrow(40, 640, 70, 640, { head: "sr-arrp" }); P.t(78, 644, "energy from the DC link (motoring)", { s: 11 });
  P.flowArrow(40, 664, 70, 664, { head: "sr-arrg" }); P.t(78, 668, "energy into the DC link (braking)", { s: 11 });
  P.raw(`<rect x="60" y="730" width="1080" height="7" class="ck-pebar"/>`);
}

/* =================================================================== PAGE 3 – hoist safety */
function page3(P, S, K) {
  const z = S.z, zmax = 8.3, top = 70, bot = 700, pz = (v) => bot - (v / zmax) * (bot - top);
  // mast sketch
  P.raw(`<rect x="70" y="${top - 10}" width="26" height="${bot - top + 20}" class="ck-box ck-plate"/>`);
  P.t(60, top - 16, "mast (sketch)", { s: 11, c: "mut" });
  const cz = pz(z);
  P.raw(`<rect x="96" y="${cz - 26}" width="64" height="40" rx="2" class="ck-box${S.sto ? "" : " ck-boxon"}"/>`);
  P.t(100, cz - 10, "carriage", { s: 11 }); P.t(100, cz + 6, `z ${f(z, 2)} m`, { s: 11, b: 1 });
  // rope + pulley + drum
  P.raw(`<circle cx="120" cy="${top - 4}" r="10" class="ck-box"/><path d="M128,${top - 4} V${cz - 26} M112,${top - 4} V${bot - 8}" class="sr-rope${S.slack ? " sr-ropeslack" : ""}"/><circle cx="112" cy="${bot + 2}" r="12" class="ck-box"/>`);
  P.t(136, bot + 6, "drum -MA13 + -MB15", { s: 11, c: "mut" });
  // limit cams on the mast
  const cams = [[7.6, "-BG36", "upper slow-down (PLC)"], [8.2, "-BG37", "upper final limit (safety)"], [0.9, "-BG38", "lower slow-down (PLC)"], [0.3, "-BG39", "lower final limit (safety)"]];
  cams.forEach(([zz, t, l]) => { const y = pz(Math.min(zmax - 0.02, zz)); P.raw(`<path d="M62,${y} H70" class="ck-thin"/>`); P.t(58, y + 4, t, { a: "end", s: 11, b: 1 }); });
  P.t(40, 730, "cams: slow-down (PLC) + final limit (forced NC, F-DI)", { s: 11, c: "mut" });
  // governor
  P.raw(`<circle cx="176" cy="${top + 4}" r="11" class="ck-box"/><path d="M176,${top + 15} V${cz - 6}" class="sr-rope sr-dash"/>`);
  P.t(192, top + 8, "-BG30 overspeed governor", { s: 11, b: 1 }); P.t(192, top + 21, "rope to the safety catch", { s: 11, c: "mut" });

  // ---------- F-DI channels on the crane (-KF23)
  const y24 = 120, yIn = 330;
  P.t(400, 108, "test pulse outputs T1 / T2 of -KF23 (F-DI, crane)", { s: 11, c: "mut" });
  H(P, y24, 250, 700, "24", S.q1); H(P, y24 + 14, 250, 700, "24", S.q1);
  P.t(252, y24 - 4, "T1", { s: 11, b: 1 }); P.t(252, y24 + 28, "T2", { s: 11, b: 1 });
  const ch = [
    { x: 300, tag: "-BG34", l: ["slack-rope", "switch, 2 NC"], act: S.slack, key: "BG34", pos: true },
    { x: 410, tag: "-BG37", l: ["upper final", "limit, forced NC"], act: S.limHz === "up", key: "BG37", pos: true },
    { x: 520, tag: "-BG39", l: ["lower final", "limit, forced NC"], act: S.limHz === "down", key: "BG39", pos: true },
    { x: 630, tag: "-BG30", l: ["governor", "switch, 1.15 × v"], act: S.overspeed, key: "BG30", pos: true },
  ];
  ch.forEach((c) => {
    [0, 1].forEach((j) => { const x = c.x + j * 26, yy = y24 + j * 14; V(P, x, yy, 170, "24", S.q1); P.dot(x, yy); P.contact(x, 170, { type: "NC", act: c.act }); V(P, x, 210, yIn, "24", S.q1 && !c.act); P.term(x, yIn, j ? "" : ""); });
    P.link(c.x - 8, c.x + 22, 190).act(c.x - 8, 190, "pos"); P.forced(c.x + 13, 190);
    P.tag(c.x - 10, 232, c.tag, c.l);
    P.hit(c.key, c.x - 18, 166, 60, 50);
  });
  // F-DI module
  P.mod(280, yIn + 6, 420, 60, "-KF23 F-DI 8 × 24 V (ET 200SP F, on the crane)", [], { on: S.q1, bad: S.hoistTrip });
  ch.forEach((c, i) => { P.t(c.x - 2, yIn + 44, `DI${i * 2}/${i * 2 + 1}`, { s: 11 }); P.led(c.x + 40, yIn + 40, !c.act, { r: 4 }); });
  P.xref(560, yIn + 84, "PROFIsafe to -KF2 → /5.4");
  P.hit("KF23", 280, yIn + 6, 420, 60);
  // safe speed monitor -KF33 with 2 encoders
  const sx = 850, sy = 90;
  P.mod(sx, sy, 160, 120, "-KF33 safe speed", [{ y: sy + 44, l: "ENC1" }, { y: sy + 70, l: "ENC2" }, { y: sy + 44, l: "OSSD1", side: "r" }, { y: sy + 70, l: "OSSD2", side: "r" }], { on: S.q1, bad: S.overspeed });
  P.t(sx + 80, sy + 102, "monitor (e.g. PNOZ s30)", { a: "middle", s: 11, c: "mut" });
  P.sens(sx - 115, sy + 28, "enc", { w: 50, h: 28 }); P.t(sx - 115, sy + 20, "-BG13 motor enc.", { s: 11 });
  P.sens(sx - 115, sy + 74, "bar", { w: 50, h: 28 }); P.t(sx - 115, sy + 116, "-BG45 bar code (2nd ch.)", { s: 11 });
  P.w([[sx - 65, sy + 42], [sx, sy + 44]], "sig", S.q1); P.w([[sx - 65, sy + 88], [sx - 30, sy + 88], [sx - 30, sy + 70], [sx, sy + 70]], "sig", S.q1);
  P.w([[sx + 160, sy + 44], [1140, sy + 44], [1140, 300], [720, 300], [720, yIn + 20], [700, yIn + 20]], "24", S.q1 && !S.overspeed);
  P.t(sx + 4, sy + 140, `v_hoist now ${f(Math.abs(S.vz), 2)} m/s · limit ${f(K.I.vz * 1.1, 2)} m/s`, { s: 11, c: S.overspeed ? "bad" : "ref", id: "srVz" });
  P.t(sx + 4, sy + 156, "SLS in manual 0.25 m/s · SSM standstill for the door", { s: 11, c: "mut" });
  P.hit("KF33", sx, sy, 160, 120);
  // load cell
  const lx = 780, ly = 420;
  P.sens(lx, ly, "cell", { w: 50, h: 34, bad: S.over }); P.t(lx, ly - 8, "-BW35 load cell (rope anchor)", { s: 11, b: 1 });
  P.w([[lx + 50, ly + 17], [lx + 90, ly + 17]], "sig", S.q1);
  P.mod(lx + 90, ly + 8, 170, 110, "-KF35 load monitor", [{ y: ly + 44, l: "90 % warn", side: "r" }, { y: ly + 66, l: "110 % OVL", side: "r" }, { y: ly + 88, l: "4–20 mA", side: "r" }], { on: S.q1, bad: S.over });
  P.t(lx, ly + 136, `load now ${S.loadKg ? f(S.loadKg, 0) + " kg" : "no load"} · design ${K.I.mL} kg · trip at 110 %`, { s: 11, c: S.over ? "bad" : "ref" });
  P.t(lx, ly + 152, S.over ? "OVERLOAD: lifting blocked, lowering allowed" : "overload relay closed (2 ch to F-DI)", { s: 11, c: S.over ? "bad" : "mut" });
  P.hit("KF35", lx + 90, ly + 8, 170, 110); P.hit("BW35", lx, ly, 50, 34);
  // brakes (SBC) from F-DQ -KF24
  const bx = 300, by = 470;
  P.mod(bx - 20, by, 400, 50, "-KF24 F-DQ (crane) – PM switching", [], { on: S.q1 && !S.sto });
  P.reg("SBC", bx + 100);
  [["-MB13", "motor brake", 340], ["-MB15", "drum safety brake", 520]].forEach(([t, l, x]) => {
    const open = !S.sto && S.axes.hz.en && S.q1;
    V(P, x, by + 50, by + 90, "24", open); P.coil(x, by + 90, { kind: "brake", on: open }); V(P, x, by + 130, by + 160, "0V", S.q1);
    P.tag(x + 20, by + 108, t, [l, open ? "open (energised)" : "closed (spring)"]);
    P.hit(t.slice(1), x - 14, by + 90, 28, 40);
  });
  H(P, by + 160, 320, 560, "0V", S.q1);
  P.t(bx - 20, by + 190, "SBC: both brakes de-energised on STO; brake test every shift (torque test via drive)", { s: 11, c: "mut" });
  P.t(bx - 20, by + 206, `hoisted mass ${K.hz.mh} kg · brake torque ≥ 1.6 × static torque (example) · EN 528`, { s: 11, c: "mut" });
  P.box(780, 600, 360, 96, { cls: "ck-note" });
  [["What trips what (live)", 1], [`slack rope / final limit / overspeed: ${S.hoistTrip ? "TRIPPED → hoist STO + both brakes" : "OK"}`, 0], [`overload: ${S.over ? "lifting blocked" : "OK"}`, 0], [`hoist axis: ${S.sto ? "STO" : S.axes.hz.en ? (S.vz > 0.02 ? "lifting" : S.vz < -0.02 ? "lowering" : "holding") : "disabled, brakes closed"}`, 0], ["reset at the operator panel after the cause is cleared", 0]]
    .forEach(([t, b], i) => P.t(790, 618 + i * 17, t, { s: 11, b, c: !b && t.includes("TRIPPED") ? "bad" : "" }));
}

/* =================================================================== PAGE 4 – travel safety + positioning */
function page4(P, S, K) {
  const xa = 110, xb = 1080, Lr = 28.4, px = (x) => xa + (x + 0.6) / (Lr + 1.2) * (xb - xa), yA = 90;
  // plan view of the aisle
  P.t(xa, 54, "aisle plan view (x along the aisle, I/O end on the left)", { s: 11, b: 1 });
  P.raw(`<rect x="${xa}" y="${yA - 26}" width="${xb - xa}" height="80" class="ck-box ck-plate"/>`);
  P.raw(`<path d="M${xa},${yA + 14} H${xb}" class="sr-railline"/>`);
  // slow-down zones
  const sz = 2.0, s1 = px(-0.6), s2 = px(sz), e1 = px(26.4), e2 = px(Lr + 0.6);
  P.raw(`<rect x="${s1}" y="${yA - 26}" width="${s2 - s1}" height="80" class="sr-zone"/><rect x="${e1}" y="${yA - 26}" width="${e2 - e1}" height="80" class="sr-zone"/>`);
  P.t(s1 + 4, yA + 70, "slow-down zone", { s: 11, c: "mut" }); P.t(e2 - 4, yA + 70, "slow-down zone", { s: 11, c: "mut", a: "end" });
  // buffers
  P.raw(`<rect x="${xa - 18}" y="${yA + 2}" width="18" height="24" class="sr-buffer"/><rect x="${xb}" y="${yA + 2}" width="18" height="24" class="sr-buffer"/>`);
  P.t(xa - 20, yA + 46, "buffer", { s: 11, a: "end" }); P.t(xb + 20, yA + 46, "buffer", { s: 11 });
  // crane
  const cx = px(S.x);
  P.raw(`<rect x="${cx - 22}" y="${yA - 18}" width="44" height="58" rx="3" class="ck-box${S.sto ? " ck-boxbad" : " ck-boxon"}"/>`);
  P.t(cx, yA + 8, "crane", { a: "middle", s: 11, b: 1 }); P.t(cx, yA + 22, `${f(S.x, 1)} m`, { a: "middle", s: 11 });
  // laser beam to the reflector at the far end
  P.raw(`<path d="M${cx + 22},${yA - 8} H${xb - 6}" class="sr-laser"/><rect x="${xb - 6}" y="${yA - 16}" width="6" height="16" class="sr-refl"/>`);
  P.t(xb - 10, yA - 20, "reflector", { s: 11, a: "end" });
  P.t((cx + xb) / 2, yA - 12, `-BG44 laser: ${f(Math.max(0, 28.6 - S.x) * 1000, 0)} mm`, { a: "middle", s: 11, c: "ref", id: "srLas" });
  // cams for limit switches
  [[px(-0.3), "-BG42"], [px(sz), "-BG40"], [px(26.4), "-BG41"], [px(28.6), "-BG43"]].forEach(([x, t]) => { P.raw(`<path d="M${x},${yA + 54} V${yA + 62}" class="ck-thin"/>`); P.t(x, yA + 84, t, { a: "middle", s: 11, b: 1 }); });

  // ---------- wiring: slow-down switches (PLC DI) and final limits (F-DI)
  const y0 = 240;
  H(P, y0, 60, 560, "24", S.q1); P.t(62, y0 - 6, "+24 V (-TB10 crane)", { s: 11, c: "mut" });
  const inFront = S.x < sz, inRear = S.x > 26.4;
  [[100, "-BG40", "slow-down front", inFront, "BG40"], [220, "-BG41", "slow-down rear", inRear, "BG41"]].forEach(([x, t, l, act, k]) => {
    V(P, x, y0, 290, "24", S.q1); P.dot(x, y0); P.contact(x, 290, { type: "NO", act }); P.link(x - 18, x - 5, 310).act(x - 18, 310, "pos"); V(P, x, 330, 400, "24", S.q1 && act);
    P.tag(x + 10, 360, t, [l, "→ PLC DI"]); P.hit(k, x - 30, 286, 60, 50);
  });
  P.t(60, 452, "→ -KF30 DI 1.4 / 1.5 (speed limit) " + (P.ref("KF30") || "/6.4"), { s: 11, c: "ref" });
  // final limits (2 ch each)
  [[340, "-BG42", "final limit front", S.limTr === "front", "BG42"], [460, "-BG43", "final limit rear", S.limTr === "rear", "BG43"]].forEach(([x, t, l, act, k]) => {
    [0, 1].forEach((j) => { const xx = x + j * 26; V(P, xx, y0, 290, "24", S.q1); P.dot(xx, y0); P.contact(xx, 290, { type: "NC", act }); V(P, xx, 330, 400, "24", S.q1 && !act); });
    P.link(x - 8, x + 22, 310).act(x - 8, 310, "pos"); P.forced(x + 13, 310);
    P.tag(x - 10, 418, t, [l, "→ F-DI -KF23"]); P.hit(k, x - 18, 286, 60, 50);
  });
  P.t(330, 460, "final limit = travel STO + brakes (Cat 0); drive out only in manual with key", { s: 11, c: "mut" });
  // positioning sensors
  const qx = 620;
  P.sens(qx, 250, "laser", { w: 56, h: 36, on: S.q1 }); P.tag(qx + 66, 262, "-BG44 laser distance sensor (travel)", ["e.g. SICK DL100 Pro / Leuze AMS 300i, PROFINET", "range ≥ 30 m · resolution 0.1 mm · reflector at the end"]);
  P.sens(qx, 330, "bar", { w: 56, h: 36, on: S.q1 }); P.tag(qx + 66, 342, "-BG45 bar-code positioning (hoist)", ["e.g. Leuze BPS 300i / SICK OLM100, bar code on the mast", "absolute position, no reference run"]);
  P.sens(qx, 410, "photo", { w: 56, h: 36, on: S.q1 && S.slotRef }); P.tag(qx + 66, 422, "-BG67 slot-reference sensor (fine positioning)", ["reflects on a mark at each bay / level", "corrects rack tolerances"]);
  P.w([[qx + 28, 286], [qx + 28, 300], [600, 300], [600, 500]], "bus", S.q1); P.w([[qx + 28, 366], [qx + 28, 378], [600, 378]], "bus", S.q1); P.w([[qx, 428], [600, 428]], "24", S.q1);
  P.t(604, 520, "PROFINET (green) + 24 V to -KF30 → /6", { s: 11, c: "ref" });
  P.hit("BG44", qx, 250, 56, 36); P.hit("BG45", qx, 330, 56, 36); P.hit("BG67", qx, 410, 56, 36);
  // safe position concept box
  P.box(40, 540, 520, 160, { cls: "ck-note" });
  const vEmerg = 1.0, sStop = K.I.vx ** 2 / (2 * K.I.ax), sE = K.I.vx ** 2 / (2 * vEmerg);
  [["Safe end-of-aisle function (example values)", 1], [`normal stop from ${K.I.vx} m/s at ${K.I.ax} m/s²: s = v²/(2a) = ${f(sStop, 1)} m`, 0], [`emergency stop (SS1, ${vEmerg} m/s²): s = ${f(sE, 1)} m`, 0],
    ["slow-down zone starts ≥ braking distance + reaction (speed cam or safe position)", 0], ["safe position: laser -BG44 + motor encoder compared in the F-PLC (2 ch)", 0],
    ["buffer only for the monitored residual speed, e.g. 1.0 m/s:", 0], [`E = ½·m·v² = ½ · ${K.tr.m} · 1.0² = ${f(0.5 * K.tr.m / 1000, 2)} kJ · stroke at 5 m/s²: ${f(1 / (2 * 5) * 1000, 0)} mm`, 0], ["(the buffer data come from the crane maker – EN 528)", 0]]
    .forEach(([t, b], i) => P.t(50, 558 + i * 17, t, { s: 11, b }));
  P.box(600, 560, 540, 140, { cls: "ck-note" });
  [["Now (live)", 1], [`crane x = ${f(S.x, 2)} m · v_x = ${f(S.vx, 2)} m/s`, 0], [`slow-down front -BG40: ${inFront ? "actuated" : "free"} · rear -BG41: ${inRear ? "actuated" : "free"}`, 0], [`final limits: ${S.limTr ? "TRIPPED (" + S.limTr + ") → STO" : "closed (OK)"}`, 0], [`slot reference -BG67: ${S.slotRef ? "mark seen (fine positioning)" : "–"}`, 0], ["wiring: laser + BPS on PROFINET, shielded, cable in the drag chain of the carriage", 0]]
    .forEach(([t, b], i) => P.t(610, 578 + i * 18, t, { s: 11, b, c: !b && t.includes("TRIPPED") ? "bad" : "" }));
}

/* =================================================================== PAGE 5 – safety circuit (F-PLC) */
function page5(P, S, K) {
  const y24 = 64, yC = 120, yIn = 250, on = S.q1;
  H(P, y24, 40, 700, "24", on); H(P, y24 + 12, 40, 700, "24", on);
  P.t(42, y24 - 6, "T1 / T2 test pulses of -KF21 (stationary F-DI) and -KF23 (crane F-DI) – drawn as one pair", { s: 11, c: "mut" });
  const es = [["-SF51", "crane panel", "cr"], ["-SF52", "I/O station", "io"], ["-SF53", "aisle door 1", "d1"], ["-SF54", "aisle end door", "d2"], ["-SF55", "conveyor cab.", "cv"]];
  es.forEach(([t, l, k], i) => {
    const x = 70 + i * 92, act = S.es[k];
    [0, 1].forEach((j) => { const xx = x + j * 24; V(P, xx, y24 + j * 12, yC, "24", on); P.dot(xx, y24 + j * 12); P.contact(xx, yC, { type: "NC", act }); V(P, xx, yC + 40, yIn, "24", on && !act); });
    P.link(x - 22, x + 20, yC + 20).act(x - 22, yC + 20, "mush"); P.forced(x + 12, yC + 20);
    P.tag(x - 12, yC + 62, t, [l]);
    P.hit(t.slice(1), x - 34, yC - 4, 70, 50);
  });
  P.mod(40, yIn, 470, 54, "-KF21 / -KF23 F-DI (e-stop pairs, 1oo2 with discrepancy check)", [], { on, bad: S.estop });
  es.forEach(([, , k], i) => P.led(82 + i * 92, yIn + 38, !S.es[k], { r: 4 }));
  P.hit("KF21", 40, yIn, 470, 54);
  // door with guard locking + request + reset
  const dx = 560;
  P.sens(dx, yC - 20, "OSSD", { w: 60, h: 40, on: S.door.closed && S.door.locked, bad: !S.door.closed });
  P.t(dx, yC - 30, "-BG56 door switch + locking", { s: 11, b: 1 }); P.t(dx + 66, yC - 4, S.door.closed ? (S.door.locked ? "closed + locked" : "closed, unlocked") : "OPEN", { s: 11, c: S.door.closed ? "mut" : "bad" });
  P.t(dx + 66, yC + 10, "coded, type 4", { s: 11, c: "mut" });
  V(P, dx + 20, yC + 20, yIn, "24", on && S.door.closed && S.door.locked); V(P, dx + 40, yC + 20, yIn, "24", on && S.door.closed && S.door.locked);
  P.coil(dx + 110, yC + 30, { kind: "lock", on: on && !!S.door.unlockOut }); P.t(dx + 80, yC + 88, "-MB56 lock", { s: 11, b: 1 }); P.t(dx + 80, yC + 101, "power-to-unlock", { s: 11, c: "mut" });
  P.hit("BG56", dx, yC - 20, 60, 40); P.hit("MB56", dx + 96, yC + 30, 28, 40);
  P.mod(530, yIn, 170, 54, "-KF21 F-DI (door)", [], { on, bad: !S.door.closed });
  // request + reset buttons
  const bx = 760;
  [["-SF57", "access request", S.door.req, "SF57"], ["-SF58", "reset", S.need, "SF58"]].forEach(([t, l, act, k], i) => {
    const x = bx + i * 110; V(P, x, y24, yC, "24", on); P.dot(x, y24); P.contact(x, yC, { type: "NO", act: false }); P.link(x - 18, x - 5, yC + 20).act(x - 18, yC + 20, "push"); V(P, x, yC + 40, yIn, "24", on);
    P.tag(x + 10, yC + 62, t, [l]); P.hit(k, x - 30, yC - 4, 60, 50);
  });
  H(P, y24, 700, 900, "24", on);
  P.lamp(bx + 170, yC, { on: S.need && S.blink }); V(P, bx + 170, y24, yC, "24", on); P.dot(bx + 170, y24); V(P, bx + 170, yC + 40, yIn, "24", on);
  P.tag(bx + 182, yC + 16, "-PF58", ["reset", "lamp"]);
  P.mod(740, yIn, 240, 54, "-KF21 DI (standard) / -KF22 DQ", [], { on });
  // light curtain with muting
  const lx = 1020;
  P.sens(lx, yC - 50, "grid", { w: 50, h: 56, on: !S.lc.person || S.lc.muting, bad: S.lc.person && !S.lc.muting });
  P.t(lx, yC - 58, "-BG59 light curtain", { s: 11, b: 1 });
  P.sens(lx, yC + 16, "photo", { w: 36, h: 26, on: S.lc.muting }); P.sens(lx + 44, yC + 16, "photo", { w: 36, h: 26, on: S.lc.muting });
  P.t(lx, yC + 56, "-BG60A/B muting", { s: 11 });
  P.lamp(lx + 110, yC - 52, { on: S.lc.muting }); P.t(lx + 110, yC + 2, "-PF60", { s: 11, b: 1, a: "middle" });
  P.t(1012, yIn + 72, "type 4, d = " + K.I.dLC + " mm", { s: 11, c: "mut" });
  P.t(1012, yIn + 86, S.lc.muting ? "MUTING: crate passes" : S.lc.person ? "INTERRUPTED" : "free", { s: 11, c: S.lc.person && !S.lc.muting ? "bad" : S.lc.muting ? "ok" : "mut", id: "srLc" });
  V(P, lx + 15, yC + 6, yIn, "24", on && (!S.lc.person || S.lc.muting)); V(P, lx + 35, yC + 6, yIn, "24", on && (!S.lc.person || S.lc.muting));
  P.mod(990, yIn, 150, 54, "-KF21 F-DI (LC)", [], { on, bad: S.lc.person && !S.lc.muting });
  P.hit("BG59", lx, yC - 50, 50, 56); P.hit("BG60", lx, yC + 16, 80, 26);

  // F-CPU
  const cy = 360;
  P.mod(380, cy, 420, 96, "-KF2 F-CPU S7-1515F-2 PN (PLC-ASRS-RAW, 10.54.0.31)", [], { on, bad: !!S.safeFault });
  P.t(390, cy + 36, "safety program (F-blocks): ESTOP1, F-door + guard locking,", { s: 11 });
  P.t(390, cy + 52, "muting (2 sensors, time window), SLS/SSM, ACK = reset", { s: 11 });
  P.t(390, cy + 70, `state: ${S.sto ? "SAFE STATE (STO)" : S.need ? "reset needed" : "all OK – outputs ON"}`, { s: 12, b: 1, c: S.sto ? "bad" : S.need ? "warnTx" : "ok", id: "srFst" });
  P.t(390, cy + 87, "Cat 3 · PL d (ISO 13849-1) · PROFIsafe over PROFINET + DDLS", { s: 11, c: "mut" });
  P.hit("KF2", 380, cy, 420, 96);
  P.reg("KF2", 590);
  P.w([[275, yIn + 54], [275, cy + 30], [380, cy + 30]], "bus", on); P.w([[615, yIn + 54], [615, cy]], "bus", on);
  P.w([[865, yIn + 54], [865, cy + 48], [800, cy + 48]], "bus", on); P.w([[1000, yIn + 54], [1000, cy + 48], [865, cy + 48]], "bus", on);
  // outputs
  const oy = 520;
  P.w([[590, cy + 96], [590, oy - 30], [200, oy - 30], [200, oy]], "bus", on); P.w([[590, oy - 30], [880, oy - 30], [880, oy]], "bus", on);
  P.mod(60, oy, 290, 50, "-KF22 F-DQ (stationary, +CAB01)", [], { on });
  P.mod(740, oy, 400, 50, "-KF24 F-DQ (crane) via DDLS -KF70/-KF71", [], { on });
  const stoC = S.sto, stoV = S.convSto;
  // stationary outputs: conveyor STO, door lock
  [[100, "conveyor STO", "+CAB02 /7", !stoV], [220, "guard lock -MB56", "unlock request", S.door.unlockOut]].forEach(([x, t, l, st]) => { V(P, x, oy + 50, oy + 120, "24", on && st); P.arr(x, oy + 124, "d"); P.t(x, oy + 142, t, { s: 11, b: 1, a: "middle" }); P.t(x, oy + 156, l, { s: 11, c: "mut", a: "middle" }); });
  // crane outputs: STO each drive, SBC, main contactor -QA10
  [[780, "STO -TA11/12", P.ref("TA11:sto") || "/2.5"], [880, "STO -TA13/14", P.ref("TA13:sto") || "/2.7"], [980, "SBC brakes", P.ref("SBC") || "/3.3"]].forEach(([x, t, l]) => { V(P, x, oy + 50, oy + 120, "24", on && !stoC); P.arr(x, oy + 124, "d"); P.t(x, oy + 142, t, { s: 11, b: 1, a: "middle" }); P.t(x, oy + 156, l, { s: 11, c: "ref", a: "middle" }); });
  V(P, 1080, oy + 50, oy + 90, "24", on && S.qa10); P.coil(1080, oy + 90, { kind: "safety", on: on && S.qa10 }); V(P, 1080, oy + 130, oy + 150, "0V", on);
  P.t(1096, oy + 104, "-QA10", { s: 12, b: 1 }); P.t(1096, oy + 117, "coil", { s: 11, c: "mut" });
  P.t(1040, oy + 172, "EDM: mirror contact → F-DI", { s: 11, c: "mut", a: "middle" });
  P.reg("QA10:coil", 1080);
  P.hit("KF24", 740, oy, 400, 50); P.hit("KF22", 60, oy, 290, 50);
  // status
  P.box(360, 600, 360, 112, { cls: "ck-note" });
  [["Safety functions now", 1], [`SF1 e-stop: ${S.estop ? "PRESSED → STO all + brakes" : "OK"}`, 0], [`SF2 aisle door: ${S.door.closed ? (S.door.locked ? "closed + locked" : "closed, unlocked") : "OPEN → crane STO"}`, 0],
    [`SF3 light curtain: ${S.lc.person && !S.lc.muting ? "INTERRUPTED → stop I/O" : S.lc.muting ? "muted (crate)" : "free"}`, 0], [`SF4/5 hoist + travel limits: ${S.hoistTrip || S.limTr ? "TRIPPED" : "OK"}`, 0], [`crane fault (shared): ${S.faults.crane ? "ON" : "off"} · reset: ${S.need ? "needed" : "–"}`, 0]]
    .forEach(([t, b], i) => P.t(370, 618 + i * 17, t, { s: 11, b, c: !b && /PRESSED|OPEN|INTERRUPTED|TRIPPED| ON/.test(t) ? "bad" : "" }));
}

/* =================================================================== PAGE 6 – crane PLC I/O + data link */
function page6(P, S, K) {
  const on = S.q1, mx = 470, my = 70, mw = 230;
  const ins = [
    ["DI 0.0", "-BG61", "fork centre", S.fork0, "prox"], ["DI 0.1", "-BG62", "fork end left", S.forkL, "prox"], ["DI 0.2", "-BG63", "fork end right", S.forkR, "prox"],
    ["DI 0.3", "-BG64", "load present left", S.loadL, "photo"], ["DI 0.4", "-BG65", "load present right", S.loadR, "photo"], ["DI 0.5", "-BG66", "load overhang / collision", false, "photo"],
    ["DI 0.6", "-BG67", "slot reference mark", S.slotRef, "photo"], ["DI 0.7", "-BG68", "slot occupied (double-store check)", S.slotOcc, "photo"],
    ["DI 1.0", "-SF76", "mode AUTO (key switch)", S.mode === "AUTO", "key"], ["DI 1.1", "-SF77", "mode MANUAL", S.mode !== "AUTO", "key"],
    ["DI 1.4", "-BG40", "slow-down front (/4)", S.x < 2.0, "pos"], ["DI 1.5", "-BG41", "slow-down rear (/4)", S.x > 26.4, "pos"],
  ];
  P.mod(mx, my, mw, 40 + ins.length * 40, "-KF30 ET 200SP (crane)", [], { on });
  P.t(mx + 8, my + 34, "IM 155-6 PN HF + DI 16 × 24 V + DQ 8", { s: 11, c: "mut" });
  P.hit("KF30", mx, my, mw, 40 + ins.length * 40);
  P.reg("KF30", mx + 100);
  ins.forEach(([pin, tag, l, act, kind], i) => {
    const y = my + 62 + i * 40;
    P.t(mx + 8, y + 4, pin, { s: 11 }); P.led(mx + 70, y, on && !!act, { r: 4.5 });
    if (kind === "key" || kind === "pos") { P.w([[mx, y], [330, y]], "24", on && !!act); P.raw(`<g transform="rotate(-90 330 ${y})">`); P.contact(330, y, { type: "NO", act: !!act }); P.raw("</g>"); P.w([[290, y], [250, y]], "24", on); }
    else { P.w([[mx, y], [300, y]], "24", on && !!act); P.sens(250, y - 15, kind, { w: 50, h: 30, on: on && !!act }); }
    P.t(240, y - 2, tag, { s: 12, b: 1, a: "end" }); P.t(240, y + 12, l, { s: 11, c: "mut", a: "end" });
    P.hit(tag.slice(1), 236, y - 18, 70, 36);
  });
  // outputs
  const outs = [["DQ 0.0", "-PF78", "beacon green (AUTO)", S.mode === "AUTO" && !S.sto], ["DQ 0.1", "-PF79", "beacon red (fault)", S.sto || S.faults.crane], ["DQ 0.2", "-PF80", "horn (start warning)", S.moving && S.blink && false], ["DQ 0.3", "-EC1", "cabinet cooling enable", on]];
  outs.forEach(([pin, tag, l, act], i) => {
    const y = my + 80 + i * 60;
    P.t(mx + mw - 8, y + 4, pin, { s: 11, a: "end" }); P.w([[mx + mw, y], [780, y]], "24", on && !!act);
    P.lamp(800, y - 20, { on: on && !!act }); P.raw(`<g transform="rotate(-90 800 ${y - 20})"></g>`);
    P.t(830, y - 2, tag, { s: 12, b: 1 }); P.t(830, y + 12, l, { s: 11, c: "mut" });
  });
  // PROFINET + DDLS
  const ny = 400;
  P.w([[mx + mw, ny], [960, ny]], "bus", on);
  P.t(mx + mw + 8, ny - 8, "PROFINET (crane): drives, laser, BPS, panel", { s: 11, c: "mut" });
  P.mod(960, ny - 30, 80, 60, "-KF71", [], { on }); P.t(1000, ny + 44, "DDLS (crane)", { s: 11, a: "middle" });
  P.mod(960, ny + 160, 80, 60, "-KF70", [], { on }); P.t(1000, ny + 234, "DDLS (fixed, aisle end)", { s: 11, a: "middle" });
  P.raw(`<path d="M1000,${ny + 30} V${ny + 160}" class="sr-optic"/>`);
  P.t(1010, ny + 100, "infrared light, 100 Mbit/s", { s: 11, c: "ref" }); P.t(1010, ny + 114, `distance now ${f(Math.max(0.5, S.x + 1.0), 1)} m`, { s: 11, c: "mut", id: "srDdls" });
  P.w([[1040, ny + 190], [1120, ny + 190], [1120, ny + 300], [900, ny + 300]], "bus", on);
  P.t(900, ny + 292, "to -KF2 F-CPU + WCS (/5)", { s: 11, c: "ref" });
  P.hit("KF71", 960, ny - 30, 80, 60); P.hit("KF70", 960, ny + 160, 80, 60);
  // operator panel
  P.mod(760, ny + 40, 150, 90, "-PF75 panel 7\"", [], { on });
  P.t(770, ny + 74, "manual jog, fault text,", { s: 11 }); P.t(770, ny + 88, "reset, maintenance mode", { s: 11 }); P.t(770, ny + 104, `mode: ${S.mode}`, { s: 11, b: 1 });
  P.w([[835, ny], [835, ny + 40]], "bus", on);
  P.hit("PF75", 760, ny + 40, 150, 90);
  // explanation box
  P.box(40, 640, 680, 76, { cls: "ck-note" });
  [["Fork + slot sensors (live from the twin)", 1], [`fork position ${f(S.fork, 2)} (−1 left … 0 centre … +1 right) · carrying: ${S.loadKg ? f(S.loadKg, 0) + " kg" : "no load"} · phase ${S.phase}`, 0],
    ["load-present sensors check the load before the fork moves; overhang sensor stops the fork (collision)", 0], ["all sensors PNP, M12 4-pin, cable in the carriage drag chain · 24 V from -TB10 via ECB", 0]]
    .forEach(([t, b], i) => P.t(50, 658 + i * 17, t, { s: 11, b }));
}

/* =================================================================== PAGE 7 – conveyor + I/O station */
function page7(P, S, K) {
  const on = S.q1, BUS = [70, 80, 90], ph3 = ["L1", "L2", "L3"];
  P.xref(40, 56, "from -FC3 /1.4");
  ph3.forEach((k, i) => { H(P, BUS[i], 40, 700, k, on, { flow: false }); P.t(706, BUS[i] + 4, k, { s: 11, c: "mut" }); });
  // motor starters
  K.conv.Im.forEach(([t, p, In], j) => {
    const xs = [100 + j * 200, 120 + j * 200, 140 + j * 200], run = on && !S.convSto && (j === 0 ? S.inN > 0 : j === 1 ? S.outN > 0 : S.lift);
    xs.forEach((x, i) => { V(P, x, BUS[i], 120, ph3[i], on, { flow: false }); P.dot(x, BUS[i]); P.contact(x, 120, { type: "NO", fn: "brk", act: on, hl: false }); V(P, x, 160, 170, ph3[i], on); P.contact(x, 170, { type: "NO", fn: "ctr", act: run }); V(P, x, 210, 248, ph3[i], run, { flow: run }); });
    P.link(xs[0] - 5, xs[2] - 5, 140); P.link(xs[0] - 5, xs[2] - 5, 190);
    P.motor(xs[1], 272, 22, { on: run });
    const tq = `-QA${71 + j}`;
    P.tag(xs[2] + 14, 130, tq, ["motor starter", `${f(In, 2)} A`]);
    P.tag(xs[2] + 14, 268, t.split(" ")[0], [t.split(" ").slice(1).join(" "), `${p} kW`]);
    P.t(xs[2] + 14, 184, "STO input", { s: 11, c: S.convSto ? "bad" : "mut" });
    P.hit(tq.slice(1), xs[0] - 12, 116, 66, 96); P.hit(t.split(" ")[0].slice(1), xs[1] - 24, 248, 48, 48);
  });
  P.t(40, 320, "motor starters e.g. SIRIUS 3RM1 / ET 200SP motor starter with STO (fail-safe via F-DQ) – PL d", { s: 11, c: "mut" });
  // 24 V RollerDrive zones
  const ry = 360;
  P.box(760, 50, 120, 60, { on }); P.raw(`<path d="M760,110 L880,50" class="ck-thin"/>`); P.t(770, 70, "~", { s: 15 }); P.t(866, 104, "=", { s: 15 });
  P.tag(888, 66, "-TB71", ["24 V DC 20 A", `zones ${K.conv.zones} × ${K.conv.Pzone} W = ${f(K.conv.I24z, 1)} A`]);
  P.hit("TB71", 760, 50, 120, 60);
  P.w([[820, 110], [820, 140], [1140, 140]], "24", on); P.w([[840, 110], [840, 150], [1140, 150]], "0V", on);
  [0, 1].forEach((j) => {
    const x = 780 + j * 190;
    V(P, x + 20, 140, 180, "24", on); P.dot(x + 20, 140); V(P, x + 40, 150, 180, "0V", on); P.dot(x + 40, 150);
    P.mod(x, 180, 160, 70, `-KF${74 + j} zone controller`, [], { on });
    P.t(x + 8, 214, "4 × RollerDrive 24 V", { s: 11 }); P.t(x + 8, 230, "4 × photo-eye, ZPA logic", { s: 11 });
    P.hit("KF74", x, 180, 160, 70);
  });
  P.t(780, 274, "e.g. Interroll MultiControl / Pulseroller ConveyLinx", { s: 11, c: "mut" });
  P.t(780, 288, "zero-pressure accumulation (ZPA), PROFINET", { s: 11, c: "mut" });
  // conveyor plan with zones and loads
  const cx0 = 60, cw = 1080, zy = ry + 30, zn = 12;
  P.t(cx0, ry + 18, "I/O front end (plan): infeed lane (top) → crane transfer point → outfeed lane (bottom)", { s: 11, b: 1 });
  const inOcc = (i) => i >= zn - Math.min(zn - 2, S.inN) && i < zn, outOcc = (i) => i < Math.min(zn - 2, S.outN);
  for (let i = 0; i < zn; i++) {
    const x = cx0 + i * (cw / zn);
    P.raw(`<rect x="${x + 2}" y="${zy}" width="${cw / zn - 4}" height="34" class="sr-zonebox${inOcc(i) ? " sr-occ" : ""}${S.jam && i === zn - 3 ? " sr-jam" : ""}"/>`);
    P.raw(`<rect x="${x + 2}" y="${zy + 70}" width="${cw / zn - 4}" height="34" class="sr-zonebox${outOcc(i) ? " sr-occ" : ""}"/>`);
    P.raw(`<circle cx="${x + cw / zn - 10}" cy="${zy + 17}" r="4" class="ck-led ${inOcc(i) ? "ck-ledon" : ""}"/><circle cx="${x + cw / zn - 10}" cy="${zy + 87}" r="4" class="ck-led ${outOcc(i) ? "ck-ledon" : ""}"/>`);
  }
  P.t(cx0 + cw - 4, zy - 4, "to crane", { a: "end", s: 11, c: "ref" }); P.t(cx0 + 4, zy + 122, "from crane", { s: 11, c: "ref" });
  P.flowArrow(cx0 + 40, zy + 52, cx0 + 160, zy + 52); P.flowArrow(cx0 + cw - 40, zy + 56, cx0 + cw - 160, zy + 56);
  P.t(cx0 + 180, zy + 56, `infeed: ${S.inN} crate(s) waiting · outfeed: ${S.outN} crate(s) · photo-eyes -BG81 … -BG92`, { s: 11, id: "srConv" });
  P.hit("BG81", cx0, zy, cw, 34);
  // ID point: scanner, contour light grid, scale, reject
  const iy = 560;
  const ids = [
    [80, "-BG90", "bar-code scanner (ID point)", "bar", S.scanFault ? "NO READ → reject" : "read OK", S.scanFault, "BG90"],
    [330, "-BG91", "contour check light grid", "grid", "height / width / overhang", false, "BG91"],
    [580, "-BW92", "weighing scale (in the roller conveyor)", "cell", S.over ? `overweight ${f(K.I.mL + 40, 0)} kg → reject` : `max ${K.I.mL} kg`, S.over, "BW92"],
    [830, "-QA93", "reject diverter (to the reject lane)", "M", S.scanFault || S.over ? "ACTIVE" : "idle", S.scanFault || S.over, "QA93"],
  ];
  ids.forEach(([x, t, l, kind, st, bad, k]) => {
    P.sens(x, iy, kind, { w: 56, h: 38, on: on && !bad, bad });
    P.tag(x + 64, iy + 12, t, [l, st]);
    P.hit(k, x, iy, 56, 38);
  });
  P.w([[60, iy + 70], [1140, iy + 70]], "bus", on); P.t(64, iy + 88, "PROFINET / IO-Link to -KF2 (PLC-ASRS-RAW) – scanner + scale data go to the WCS / WMS (item 4)", { s: 11, c: "mut" });
  ids.forEach(([x]) => V(P, x + 28, iy + 38, iy + 70, "bus", on));
  P.box(40, 666, 1100, 56, { cls: "ck-note" });
  [["Live from the twin", 1], [`scanner fault (shared): ${S.faults.scanner ? "ON – every store job is rejected" : "off"} · conveyor jam: ${S.faults.convJam ? "ON – photo-eye blocked too long" : "off"} · overload: ${S.faults.overload ? "ON" : "off"} · light curtain: ${S.lc.person && !S.lc.muting ? "interrupted" : S.lc.muting ? "muted" : "free"}`, 0],
    ["contour check + scale reject a crate BEFORE it reaches the crane (no overhang into the rack, no overload of the crane)", 0]]
    .forEach(([t, b], i) => P.t(50, 684 + i * 17, t, { s: 11, b }));
}

/* =================================================================== PAGE 8 – crane cabinet layout + heat */
function page8(P, S, K) {
  const ox = 60, oy = 60, sc = 0.48, W = 800 * sc, Hh = 1200 * sc, Hc = K.heat;
  P.t(ox, oy - 12, `+CRN01 crane cabinet, front view, door removed (${K.heat.W * 1000} × ${K.heat.H * 1000} × ${K.heat.D * 1000} mm)`, { s: 11, b: 1 });
  P.raw(`<rect x="${ox}" y="${oy}" width="${W}" height="${Hh}" class="ck-box"/><rect x="${ox + 12}" y="${oy + 12}" width="${W - 24}" height="${Hh - 24}" class="ck-box ck-plate"/>`);
  const rows = [
    [oy + 26, [["-QB10", 52], ["-FC10", 56], ["-QA10", 56], ["-RA10", 66], ["-FC11…", 64]]],
    [oy + 140, [["-TA10", 70], ["-TA11", 50], ["-TA12", 50], ["-TA13", 64], ["-TA14", 40]]],
    [oy + 330, [["-KF30 ET 200SP + -KF23/-KF24", 200], ["-KF33", 50], ["-KF35", 50]]],
    [oy + 410, [["-TB10", 70], ["-FC21…26 ECB", 110], ["-KF71", 50], ["relays", 60]]],
    [oy + 490, [["-XD1 terminals (spring-cage)", 300]]],
  ];
  rows.forEach(([y, devs], ri) => {
    let x = ox + 24;
    P.raw(`<rect x="${ox + 18}" y="${y + (ri === 1 ? 150 : 46)}" width="${W - 36}" height="14" class="ck-duct"/>`);
    devs.forEach(([t, w]) => { const h = ri === 1 ? 140 : 40; P.raw(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" class="ck-dev"/>`); P.t(x + 3, y + 15, t, { s: 11 }); x += w + 6; });
  });
  P.t(ox + 24, oy + 320, "drives: push-through heat sinks", { s: 11, c: "mut" });
  // anti-vibration mounts
  [[ox - 8, oy + 20], [ox + W, oy + 20], [ox - 8, oy + Hh - 40], [ox + W, oy + Hh - 40]].forEach(([x, y]) => P.raw(`<rect x="${x}" y="${y}" width="8" height="20" class="sr-mount"/>`));
  P.t(ox, oy + Hh + 50, "anti-vibration mounts (wire-rope / rubber-metal) at the 4 corners", { s: 11, c: "mut" });
  // gland plate
  P.raw(`<rect x="${ox}" y="${oy + Hh}" width="${W}" height="16" class="ck-gland"/>`);
  for (let i = 0; i < 9; i++) P.raw(`<circle cx="${ox + 30 + i * 40}" cy="${oy + Hh + 8}" r="5" class="ck-box"/>`);
  P.t(ox, oy + Hh + 34, "gland plate: EMC glands (360° shield), strain relief, cables from the rail collector + drag chains", { s: 11, c: "mut" });
  // braking resistor on the roof
  // side notes + heat table
  const tx = 520;
  P.t(tx, 70, "Rules for a cabinet on a moving crane (example)", { s: 12.5, b: 1 });
  ["vibration + shock: devices tested to IEC 60068-2-6 / -27 (ask: 'suitable for crane use?')", "spring-cage or screw terminals with ferrules; no plug-in relays without clips",
    "heavy parts (reactor, drives) low on the plate; mounting rails screwed every 100 mm", "brake resistor outside (on the crane frame), with thermal switch to the PLC",
    "cooling unit rated for vibration and tilting; condensate drain; door seal IP54", "cable entry from below; drip loop; no water from the roof (indoor store)",
    "PE + HF bonding: cabinet ↔ crane frame with flat braid ≥ 16 mm²", "lighting + socket for service; documentation pocket in the door"].forEach((t, i) => P.t(tx, 92 + i * 16, "• " + t, { s: 11 }));
  const hy = 250;
  P.t(tx, hy, "Heat balance (IEC/TR 60890, example)", { s: 12.5, b: 1 });
  Hc.loss.forEach(([t, w], i) => { P.t(tx, hy + 20 + i * 16, t, { s: 11 }); P.t(1140, hy + 20 + i * 16, f(w, 1) + " W", { s: 11, a: "end" }); });
  const y2 = hy + 20 + Hc.loss.length * 16;
  P.raw(`<path d="M${tx},${y2 - 10} H1140" class="ck-thin"/>`);
  [[`total loss P_v`, f(Hc.P, 1) + " W", 1], [`surface A = 1.4·W·(H+D) + 1.8·D·H = ${f(Hc.Ae, 3)} m² (wall-mounted)`, "", 0], [`through the walls k·A·ΔT = ${Hc.k} · ${f(Hc.Ae, 2)} · ${Hc.dT} K`, f(Hc.Pw, 1) + " W", 0],
    [`to remove`, f(Hc.Pnet, 1) + " W", 1], [`filter fan: V = 3.1 · P / ΔT = ${f(Hc.Vdot, 0)} m³/h (dusty store: prefer a cooling unit)`, "", 0], [`cooling unit ≥ 1.3 × ${f(Hc.Pnet, 0)} W → ${Hc.cool} W class`, "", 1],
    ["ambient at the crane cabinet 35 °C, inside max 40 °C (ΔT = 5 K)", "", 0]]
    .forEach(([t, v, b], i) => { P.t(tx, y2 + 8 + i * 17, t, { s: 11, b }); if (v) P.t(1140, y2 + 8 + i * 17, v, { s: 11, a: "end", b }); });
  P.box(tx, 600, 620, 110, { cls: "ck-note" });
  [["24 V budget of the crane cabinet", 1], [`sum ${f(K.v24.I, 2)} A · × 1.25 reserve = ${f(K.v24.Ires, 2)} A → -TB10 ${K.v24.A} A PSU (load ${K.v24.load} %)`, 0],
    ["brakes have their own ECB channel; drives' 24 V on a separate ECB", 0], ["buffer module 24 V (e.g. 0.5 s) – no reset of the PLC when the collector bounces on the rail joints", 0], ["UPS for the PLC is not needed with DDLS + F-PLC in +CAB01 (example)", 0]]
    .forEach(([t, b], i) => P.t(tx + 10, 618 + i * 17, t, { s: 11, b }));
  P.hit("CAB", ox, oy, W, Hh);
}

const DRAW = [page1, page2, page3, page4, page5, page6, page7, page8];
export function drawPage(P, n, S, K) {
  frame(P, { title: PAGE_TITLES[n - 1], page: n, of: NPAGES, loc: "=LOG.ASRSRAW", loc2: LOC[n - 1] });
  DRAW[n - 1](P, S, K);
}
export { colX };
