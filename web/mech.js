/* Mechanical elements tab - item 1: transfer of the machining pallet between an AGV (or a manual cart) and the
   load station of the rotary pallet changer (APC).  Parametric 3D model + interface drawing + calculations +
   handshake + tolerance chains + bill of materials + manufacturing / installation guide.

   Principle (as built in the plants): LIFT-AND-TRANSFER chain unit in the APC load station.
     AGV docks (funnel rails -> docking pin -> shock absorbers), lifts its chain deck to the transfer height,
     E84 handshake, the station chains rise (pallet studs clear the locating receivers), both chains run,
     the pallet hits a retractable stop, the station chains lower and the pull studs drop into the receivers.
   Pick-up is the same in reverse.  A manual cart with free rollers can use the same interface (latch instead of E84).

   Pallet data (size, mass, load, module pitch, APC radius, lift stroke, oil pressure) come from the Pallet changer tab
   (window.APC), so both tabs always describe the same machine.  All other values are typical examples.
   Coordinates: mm, Y up, x = 0 / z = 0 at the centre of the load station, the APC rotation axis at x = -r,
   the AGV comes from +x.  Fully offline: only Three.js from web/vendor. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const H0 = 1050;          // pallet bottom = receiver top above the floor (same as the APC)
const G = 9.81;
const LS = 44;            // pull stud length below the pallet (catalogue 35-50 mm)
const RREC = 30;          // radius of a locating receiver (bush) at the station
const RODS = { 25: 12, 32: 18, 40: 22, 50: 28, 63: 36, 80: 45, 100: 56 };
const BORES = [25, 32, 40, 50, 63, 80, 100];
const MOTORS = [0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5];
// ISO 606 roller chains (typical catalogue values): pitch mm, breaking load kN, mass kg/m, allowed roller load N (on a hardened guide)
const CHAINS = [
  { id: "08B-1 (1/2\")", p: 12.7, Fb: 17.8, q: 0.70, Fr: 250 },
  { id: "10B-1 (5/8\")", p: 15.875, Fb: 22.2, q: 0.95, Fr: 350 },
  { id: "12B-1 (3/4\")", p: 19.05, Fb: 28.9, q: 1.25, Fr: 500 },
  { id: "16B-1 (1\")", p: 25.4, Fb: 60.0, q: 2.70, Fr: 900 }];
// industrial shock absorbers (energy per stroke, typical)
const SHOCK = [{ id: "M14", E: 10 }, { id: "M20", E: 25 }, { id: "M25", E: 60 }, { id: "M33", E: 150 }, { id: "M45", E: 350 }];

const GROUPS = [
  ["AGV (vehicle)", [
    ["mv", "AGV mass, empty (with lift deck)", "kg", 650, "AGV with lifting chain deck, 1 t class"],
    ["vnav", "Speed in the slow zone before the station", "m/s", 0.3, "safety-rated slow zone 1–2 m"],
    ["vd", "Docking (creep) speed", "m/s", 0.05, "last 60 mm"],
    ["hdrive", "Deck height while driving (chain top)", "mm", 650, "low = stable"],
    ["vdeck", "Deck lift speed", "mm/s", 80, "spindle or scissor lift"],
    ["ab", "Emergency stop deceleration", "m/s²", 1.0, "ISO 3691-4: typ. 0.5–1.5 m/s²"],
    ["nav", "AGV stop accuracy (x and z)", "± mm", 10, "AGV supplier: typ. ±5–10 mm"],
    ["yaw", "AGV angle accuracy", "± °", 0.5, "typ. ±0.3–1°"]]],
  ["Floating deck + lift docking (solves the AGV error)", [
    ["fl", "Float range of the deck (x and z)", "± mm", 20, "> stop error + angle effect (units ±15–25)"],
    ["mdk", "Floating deck mass (deck + chains + drive)", "kg", 150, ""],
    ["mub", "Friction of the ball transfer units", "", 0.01, "0.005–0.02"],
    ["ksp", "Centring spring rate (per axis)", "N/mm", 10, ""],
    ["dpn", "Cone docking pin diameter", "mm", 25, "2 pins: 1 round, 1 diamond"],
    ["fpre", "Deck push-up force against the stop faces", "N", 600, "lift motor torque limit"],
    ["mut", "Tyre friction (only to compare a rigid pin)", "", 0.6, "PU tyre on concrete 0.5–0.7"]]],
  ["Transfer chains", [
    ["vt", "Transfer speed", "m/s", 0.2, "0.15–0.3 m/s"],
    ["at", "Transfer acceleration", "m/s²", 0.3, ""],
    ["mu", "Running resistance of the chain", "", 0.1, "roller chain on steel guide 0.05–0.15"],
    ["mus", "Static friction pallet ↔ chain", "", 0.15, "steel on steel, oily"],
    ["zs", "Sprocket teeth", "", 17, "≥ 17 for quiet running"],
    ["gap", "Gap station chain ↔ AGV chain", "mm", 60, "the pallet bridges it"]]],
  ["Station lift unit", [
    ["mlf", "Lift frame + chains + drive mass", "kg", 120, ""],
    ["tl", "Lift time (up = down)", "s", 1.0, ""],
    ["clr", "Clearance under the studs / under the pallet", "mm", 10, ""]]],
  ["Docking + floor", [
    ["sb", "Shock absorber stroke", "mm", 25, ""],
    ["hb", "Height of the safety buffers + cart pin", "mm", 300, "bumper height"],
    ["dp", "Cart docking pin diameter", "mm", 30, "manual cart only"],
    ["na", "Floor anchors (whole station)", "", 6, "M16 bonded anchors"],
    ["Na", "Allowed load per anchor", "kN", 8, "anchor catalogue, cracked concrete C25/30"],
    ["step", "Allowed height step AGV ↔ station", "mm", 3, "with 5 mm × 30° chamfer on the pallet edges"]]],
  ["Manual cart (instead of the AGV)", [
    ["mc", "Cart mass", "kg", 160, ""],
    ["lc", "Cart wheelbase (castor centres, length)", "mm", 900, ""],
    ["ac", "Worst stop of the cart (castor hits a step)", "m/s²", 1.5, ""]]],
  ["Cell timing", [
    ["dpool", "AGV travel pallet pool ↔ cell (one way)", "m", 35, ""],
    ["vagv", "AGV travel speed", "m/s", 1.2, "twin: 1.2 m/s"],
    ["tpool", "Hand-over at the pallet pool (each)", "s", 20, "twin: load 20 s"],
    ["tcyc", "Machining time per pallet", "s", 1380, "4 crankcases × 345 s (example)"]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

function apcData() {
  const A = window.APC && window.APC.get();
  const P = A ? A.P : { a: 500, b: 500, mp: 110, mw: 400, hc: 250, pitch: 400, p: 6, s: 60, r: 480, dm: 350, secH: 160, secB: 100 };
  const swing = A && A.R && A.R.swing ? A.R.swing : 2 * P.r + Math.hypot(P.a, P.b);
  return { a: P.a, b: P.b, mp: P.mp, mw: P.mw, hc: P.hc, pitch: P.pitch, p: P.p, s: P.s, r: P.r, dm: P.dm, secH: P.secH, secB: P.secB, swing, Q: A && A.R ? A.R.Q : null };
}

/* ------------------------------------------------------------------ calculation */
function calc(M, A) {
  const a = A.a, b = A.b, R = { A };
  R.tp = Math.max(50, Math.round(Math.min(a, b) * 0.14));
  R.mpl = A.mp + A.mw; R.W = R.mpl * G;
  R.hg = (A.mp * R.tp / 2 + A.mw * (R.tp + A.hc)) / R.mpl;                 // centre of gravity above the pallet bottom
  // chain strands: outside the studs if there is room, else between the studs
  const zi = A.pitch / 2 + RREC + 10, zo = b / 2 - 25;
  if (zo - zi >= 40) { R.zc = Math.round((zi + zo) / 2); R.side = "outside"; } else { R.zc = Math.round(A.pitch / 2 - RREC - 10 - 20); R.side = "between"; }
  R.Ht = H0 + LS + M.clr; R.Hlow = H0 - M.clr; R.st = R.Ht - R.Hlow;     // transfer height, lowered chain top, lift stroke
  R.L = a + 40 + M.gap;                                                    // pallet travel station centre -> AGV deck centre
  R.XD = a / 2 + 85;                                                       // AGV bumper face when docked (x from station centre)
  R.lA = a + 450; R.wA = b + 220;                                          // AGV body
  R.XB = R.XD + 40;                                                        // nominal AGV stop: 40 mm before the safety buffers
  R.zPin = b / 2 + 100; R.xPin = R.XD + 60;                                // 2 cone pins hanging from the station brackets
  R.zPost = R.wA / 2 + 50; R.xPost = R.XD - 15;                            // bracket posts beside the AGV
  R.wi = R.wA / 2 + 10 + M.nav;                                            // funnel half width: rollers do not touch normally
  // chain selection: safety >= 10 on breaking load (service factor 1.5) and roller load with impact factor 2
  const loop = 2 * (a + 40) / 1000;
  R.chains = CHAINS.map((c) => {
    const mch = 2 * loop * c.q;
    const Ft = (R.mpl + mch / 2) * M.mu * G + R.mpl * M.at;
    const Fs = Ft / 2 * 1.2, SF = c.Fb * 1000 / (Fs * 1.5), n = Math.floor(a / c.p), Fr = R.W / (2 * n) * 2;
    return { ...c, mch, Ft, Fs, SF, n, Frl: Fr, ok: SF >= 10 && Fr <= c.Fr };
  });
  const start = R.mpl > 300 ? 1 : 0;                                       // practice: not below 5/8" for heavy pallets
  R.ch = R.chains.slice(start).find((c) => c.ok) || R.chains[R.chains.length - 1];
  const c = R.ch;
  R.d0 = c.p / Math.sin(Math.PI / M.zs);
  R.nOut = M.vt * 60 / (Math.PI * R.d0 / 1000);
  R.Tout = c.Ft * R.d0 / 2000;
  R.Pm = c.Ft * M.vt / 0.8;
  R.motor = MOTORS.find((x) => x * 1000 >= R.Pm * 1.3) || 1.5;
  R.igm = 1400 / R.nOut;
  // transfer time (trapezoid) + creep to the stop
  const Lm = R.L / 1000;
  R.ttr = (Lm >= M.vt * M.vt / M.at ? Lm / M.vt + M.vt / M.at : 2 * Math.sqrt(Lm / M.at)) + Math.max(0, 0.02 / 0.05 - 0.02 / M.vt);
  R.SFslip = M.mus * G / M.at;
  R.SFtip = (a / 2 / R.hg) / (M.at / G);
  R.Fstop = R.mpl * 0.05 * 0.05 / (2 * 0.003) + M.mus * R.W;              // creep 0.05 m/s into a 3 mm PU pad + chain sliding under the pallet
  R.Fpush = 0.03 * R.W;                                                    // manual push on free rollers
  // station lift
  R.Fl = (R.mpl + M.mlf) * G * 1.25;
  R.Dreq = Math.sqrt(4 * R.Fl / (Math.PI * A.p));
  R.D = BORES.find((x) => x >= R.Dreq) || 100; R.rod = RODS[R.D];
  R.Acyl = Math.PI * R.D * R.D / 4;
  R.Ql = R.Acyl * R.st / M.tl * 60 / 1e6;
  R.vlow = R.st / M.tl;
  // docking energy, shock absorbers, anchors, pin
  R.mt = M.mv + R.mpl;
  R.Ed = 0.5 * R.mt * M.vd * M.vd; R.Ef = 0.5 * R.mt * M.vnav * M.vnav;
  R.Eabs = R.Ef / 2 * 1.25; R.shock = SHOCK.find((x) => x.E >= R.Eabs) || SHOCK[SHOCK.length - 1];
  R.Fpk = (R.Ef / 2) / (0.85 * M.sb / 1000); R.Fh = 2 * R.Fpk;
  R.Lb = a / 2 + 85 + 80;                                                  // lever: docking face to the rear anchors
  R.Nanc = R.Fh * M.hb / R.Lb / Math.max(1, M.na / 3); R.Vanc = R.Fh / M.na;
  R.uAnc = Math.max(R.Nanc, R.Vanc) / (M.Na * 1000);
  R.Flat = 0.15 * R.mt * G; R.lp = 1.5 * M.dp;
  R.sigPin = 32 * R.Flat * R.lp / (Math.PI * M.dp ** 3); R.tauPin = 4 * R.Flat / (Math.PI * M.dp * M.dp);
  // AGV stability (driving height) and pallet on the AGV during an emergency stop
  const xb = R.XD + R.lA / 2, xp = R.L, xf = R.XD + 110;
  R.hCOG = (M.mv * 250 + R.mpl * (M.hdrive + R.hg)) / R.mt;
  R.lever = (M.mv * xb + R.mpl * xp) / R.mt - xf;
  R.SFagv = (R.lever / R.hCOG * G) / M.ab;
  R.SFpal = (a / 2 / R.hg) / (M.ab / G);
  R.Fpawl = R.mpl * M.ab * 1.5;
  // manual cart
  R.hCart = (M.mc * 450 + R.mpl * (R.Ht + R.hg)) / (M.mc + R.mpl);
  R.SFcart = (M.lc / 2 / R.hCart * G) / M.ac;
  // interaction with the APC: rotating fork rails / cross beam (bottom H0-50 when lowered) over the station parts
  R.railLift = H0 - 50 + A.s;
  R.clrRec = R.railLift - H0; R.clrChain = R.railLift - R.Hlow;
  R.studLift = A.s - 5 - LS;                                               // forks touch the ledges after 5 mm
  R.Rsw = A.swing / 2;
  R.zG = b / 2 + 50; R.xdn = a / 2 + 20 + M.gap;
  R.swingClr = Math.hypot(A.r + R.xdn, R.zG) - R.Rsw;
  // AGV stop error -> floating deck + lift docking
  const yr = M.yaw * Math.PI / 180, ta = Math.tan(15 * Math.PI / 180), mup = 0.15;
  R.dYaw = R.zPin * Math.sin(yr);                                          // x shift at a pin caused by the angle error
  R.cap = M.nav + R.dYaw;                                                  // worst error the cone pins must catch
  R.lead = Math.ceil(R.cap + 2);                                           // cone lead-in radius
  R.lcone = R.lead / ta;                                                   // cone length (15° half angle)
  R.Fscrub = M.mut * R.mt * G;                                             // rigid pin: push the whole AGV sideways
  R.sigScrub = 32 * R.Fscrub * R.lp / (Math.PI * M.dp ** 3);
  R.Ffric = M.mub * (M.mdk + R.mpl) * G;                                   // floating deck: ball transfer friction
  R.Ffloat = R.Ffric + M.ksp * R.cap;                                      // + centring springs
  R.Fv = R.Ffloat * (ta + mup) / (1 - mup * ta);                           // vertical force on the 15° cone
  R.xres = R.Ffric / M.ksp;                                                // offset the springs alone cannot return
  R.pinClr = Math.hypot(A.r + R.xPost - 30, R.zPost - 30) - R.Rsw;
  R.pinLoad = M.fpre / 2;
  // tolerance chains: [contributor, fixed deck, height sensor, floating deck on stop faces, note]
  R.tolH = [
    ["Floor flatness under the AGV wheels", 2, 0.5, 0, "stop faces: the floor drops out"],
    ["Tyre deflection empty ↔ loaded", 1.5, 0, 0, ""],
    ["AGV deck lift repeatability", 1, 0.5, 0, "stop faces: deck pushed against them"],
    ["Deck chain top ↔ deck reference", 0.5, 0.3, 0.2, "machined in one setup"],
    ["Height sensor + reference plate", 0, 0.5, 0, ""],
    ["Bracket stop faces (machined with the station)", 0, 0, 0.1, ""],
    ["Station chain top (mechanical end stop)", 0.3, 0.3, 0.3, ""],
    ["Chain + guide wear (AGV + station)", 1, 0.5, 0.5, "re-shim at 0.5 mm wear"]];
  const sum = (i) => R.tolH.reduce((s, r) => s + r[i], 0), rss = (i) => Math.sqrt(R.tolH.reduce((s, r) => s + r[i] * r[i], 0));
  R.hWC = [sum(1), sum(2), sum(3)]; R.hRSS = [rss(1), rss(2), rss(3)];
  R.tolZ = [
    ["AGV stop accuracy (navigation)", M.nav, `the floating deck takes it (±${M.fl} mm)`],
    [`AGV angle ±${M.yaw}° (shift at the pins)`, R.dYaw, "taken by the 2 pins (round + diamond)"],
    [`Cone pin Ø${M.dpn} g6 in bush H7, diamond pin`, 0.05, "after the lift docking"],
    ["Pin position on the bracket (machined)", 0.05, ""],
    ["Bush ↔ deck chains (machined in one setup)", 0.1, ""],
    ["Deck chain guides", 0.2, ""]];
  R.zWC = R.tolZ.slice(2).reduce((s, r) => s + r[1], 0);
  return R;
}

function steps(R, M, veh, task) {
  const del = task === "deliver";
  const lift = del ? "Station chains + stop rise" : "Station chains lift the pallet off the receivers";
  const move = del ? "Chains run: pallet AGV → station" : "Chains run: pallet station → AGV";
  const low = del ? "Chains lower, studs drop into the receivers, seat check" : "Station chains lower, AGV pawl closes";
  if (veh === "cart") return [
    ["app", "Operator pushes the cart to the station", 5],
    ["dock", "Docking pin in the bush, over-centre latch closed (sensor)", 2],
    ["deck", "Operator presses TRANSFER on the station panel", 1.5],
    ["lift", lift, M.tl], ["move", move + (del ? " (operator pushes the first 150 mm)" : ""), R.ttr + 0.8],
    ["low", low, M.tl + 1], ["away", "Latch open, operator pulls the cart away", 3]];
  return [
    ["app", `AGV drives in and stops – only ±${M.nav} mm / ±${M.yaw}° accurate`, 1.44 / M.vnav],
    ["dock", "E84 handshake, the deck lock pin opens: the deck floats", 1.5],
    ["deck", "Deck lifts: 2 cone pins centre the floating deck, stop faces set the height", Math.max(2, (R.Ht - M.hdrive) / M.vdeck + 1)],
    ["lift", lift, M.tl], ["move", move, R.ttr],
    ["low", low, M.tl + 1], ["away", "E84 complete, deck lowers, lock pin re-centres it, AGV leaves", 3.5]];
}

const ease = (u) => u * u * (3 - 2 * u);
function trap(t, T, M) {            // travelled fraction of a trapezoid move of duration T
  const ta = Math.min(M.vt / M.at, T / 2), a = 1, vmax = a * ta;
  const tot = vmax * (T - ta);
  if (t <= 0) return 0; if (t >= T) return 1;
  const s = t < ta ? 0.5 * a * t * t : t < T - ta ? 0.5 * a * ta * ta + vmax * (t - ta) : tot - 0.5 * a * (T - t) ** 2;
  return Math.max(0, Math.min(1, s / tot));
}
function stateAt(t, ST, R, M, veh, task) {
  let k = 0, t0 = 0;
  while (k < ST.length - 1 && t >= t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = Math.max(0, Math.min(1, (t - t0) / ST[k][2]));
  const key = ST[k][0], del = task === "deliver", cart = veh === "cart";
  const s = { k, u, t, x: 0, z: 0, yaw: 0, e: 0, deck: cart ? R.Ht : M.hdrive, lift: R.Hlow, stop: 0, pawl: 0, chain: 0, latch: 0, palX: 0, palY: H0, palOnVeh: false };
  const i = (n) => ST.findIndex((r) => r[0] === n);
  const before = (n) => k < i(n), after = (n) => k > i(n);
  // vehicle position
  // the AGV stops with an error (example: −0.6·nav in x, +0.8·nav in z, +yaw); the cart is pushed onto its pin
  const ex = cart ? 0 : -0.6 * M.nav, ez = cart ? 0 : 0.8 * M.nav, ey = cart ? 0 : M.yaw * Math.PI / 180;
  s.x = ex; s.z = ez; s.yaw = ey;
  if (key === "app") { const e = ease(u); s.x = 1500 * (1 - e) + (cart ? 60 : ex) * e; s.yaw = ey * e; }
  else if (key === "dock" && cart) s.x = 60 * (1 - ease(u));
  else if (key === "away") { s.x = ex + 1300 * ease(Math.max(0, u * 1.4 - 0.4)); s.yaw = ey * (1 - ease(u)); }
  // deck height (AGV)
  if (!cart) {
    if (key === "deck") s.deck = M.hdrive + (R.Ht - M.hdrive) * ease(Math.min(1, u * 1.25));
    else if (after("deck") && key !== "away") s.deck = R.Ht;
    else if (key === "away") s.deck = R.Ht - (R.Ht - M.hdrive) * ease(Math.min(1, u * 1.4));
    s.e = Math.max(0, Math.min(1, (s.deck - (R.Ht - 30 - R.lcone)) / R.lcone));   // cone pins engage over the cone length
  }
  // station lift + stop
  if (key === "lift") { s.lift = R.Hlow + R.st * ease(u); s.stop = del ? ease(u) : 0; }
  else if (key === "move") { s.lift = R.Ht; s.stop = del ? 1 : 0; s.chain = del ? -1 : 1; }
  else if (key === "low") { s.lift = R.Ht - R.st * ease(u); s.stop = del ? 1 : 0; }
  else if (key === "away" && del) s.stop = 1 - ease(Math.min(1, u * 2));
  // retention pawl (1 = down / open) and latch
  const open = (key === "dock" && u > 0.5) || (after("dock") && (del ? before("low") || (key === "low" && u < 0.1) : before("low")));
  s.pawl = open ? 1 : 0;
  s.latch = cart && (after("dock") && key !== "away" || (key === "dock" && u > 0.5)) ? 1 : 0;
  // pallet
  const onVeh = () => { s.palX = R.L + s.x; s.palY = s.deck; s.palZ = s.z; s.palOnVeh = true; };
  if (del) {
    if (before("move")) onVeh();
    else if (key === "move") { s.palX = R.L * (1 - trap(u * ST[k][2], ST[k][2], M)); s.palY = R.Ht; }
    else { s.palX = 0; s.palY = Math.max(H0, s.lift); }
  } else {
    if (before("move")) { s.palX = 0; s.palY = Math.max(H0, s.lift); }
    else if (key === "move") { s.palX = R.L * trap(u * ST[k][2], ST[k][2], M); s.palY = R.Ht; }
    else onVeh();
  }
  s.palZ = s.palZ || 0;
  return s;
}

/* ------------------------------------------------------------------ part information (click a part) */
function partInfo(key, R, M) {
  const A = R.A, c = R.ch;
  const I = {
    tframe: ["Station table (welded frame)", "MAKE", "S355J2 rectangular tube 60×50×4 and 70×70×5, stress relieved",
      "Carries the 4 locating receivers, the lift unit and the retractable stop at the APC load station.",
      `Top frame at 870–920 mm, legs at x = −80 / +150 mm (outside the APC base). Cantilever to x = −280 mm over the APC base.`,
      "Weld in a jig, anneal 580–620 °C, then machine the 4 receiver pads and the guide-column holes in ONE setup (flatness ≤ 0.05 mm, column holes ±0.02 mm)."],
    anchor: ["Floor anchor + levelling", "BUY", "M16 bonded (chemical) anchor, 8.8, + M20 levelling screws + non-shrink grout",
      "Fixes the station and the docking post to the floor; takes the AGV docking forces.",
      `${M.na} anchors. Load per anchor: tension ${f(R.Nanc / 1000, 2)} kN, shear ${f(R.Vanc / 1000, 2)} kN (allowed ${M.Na} kN → ${f(R.uAnc * 100, 0)} %).`,
      "Concrete ≥ C25/30, ≥ 200 mm thick, edge distance ≥ 100 mm. Level to 0.2 mm/m with the screws, grout 20–30 mm under the plates, tighten after 24 h with the catalogue torque."],
    post: ["Receiver pedestal", "MAKE", "S355 square tube 70×70 + top plate 20 mm",
      "Holds one locating receiver at the exact pallet height.", `4 pieces on pitch ${A.pitch} mm, top face at ${H0 - 30} mm.`,
      "Machine the top faces of all 4 in one setup after welding: same height ±0.02 mm."],
    receiver: ["Locating receiver (bush)", "MAKE / BUY", "case-hardened 16MnCr5, 58–62 HRC, ground",
      "The pull studs drop into the bush: the pallet is centred (±0.02 mm) and rests on the hardened face. No clamping – the APC forks pick it up from here.",
      `Ø${2 * RREC} mm, face at ${H0} mm (= machine receiver height), bore with 15° lead-in: catches ±3 mm.`,
      "One receiver with a round bore (reference), one with a slot (diamond) in x, two with clearance – like the zero-point modules, so the pallet is not over-determined. Air nozzle for seat check."],
    liftframe: ["Lift-transfer frame", "MAKE", "S355 C-profile 50×40 + 2 cross beams, welded and machined",
      "Carries the 2 chain strands and the drive. Lifts by " + R.st + " mm so the studs clear the receivers.",
      `Chain top lowered ${R.Hlow} mm / raised ${R.Ht} mm. Strands at z = ±${R.zc} mm (${R.side} the studs).`,
      "Machine both chain-guide seats in one setup: same height ±0.1 mm, parallel ±0.2 mm over the length."],
    guide: ["Guide column + ball bushing", "BUY", "Ø25 h6 hardened shafts, flanged ball bushings",
      "Guide the lift frame vertically; the cylinder only pushes.", "4 columns, stroke " + R.st + " mm.", "Press-fit in the top frame; parallel ≤ 0.05 mm over the stroke."],
    liftcyl: ["Lift cylinder (hydraulic)", "BUY", "ISO 6020-2 compact cylinder with end cushioning",
      "Lifts the transfer frame with the pallet; oil from the APC hydraulic unit.",
      `Ø${R.D}/${R.rod} × ${R.st} mm at ${A.p} MPa → ${f(R.Acyl * A.p / 1000, 1)} kN (needed ${f(R.Fl / 1000, 1)} kN incl. ×1.25). Flow ${f(R.Ql, 1)} L/min.`,
      `Mechanical end stops set the 2 heights (not the cylinder). Lowering: throttle to ≤ 20 mm/s in the last 10 mm so the pallet lands softly (average ${f(R.vlow, 0)} mm/s).`],
    chain: ["Transfer chain (roller chain on guide)", "BUY", `${c.id} roller chain, ISO 606, on hardened steel guide strips`,
      "Two strands carry and move the pallet. The pallet sits on the chain rollers; the studs pass beside the strands.",
      `Pull ${f(c.Ft, 0)} N, per strand ${f(c.Fs, 0)} N, safety ${f(c.SF, 0)} (≥ 10). ${c.n} rollers under the pallet per strand, ${f(c.Frl, 0)} N each incl. impact ×2 (allowed ${c.Fr} N).`,
      "Guide strips C45 induction hardened, screwed + pinned, joints chamfered. Chain tension: sag 1–2 % of the free length. Lubricate with conveyor-chain oil."],
    sprocket: ["Sprockets + common shaft", "BUY / MAKE", "C45 sprockets with hardened teeth, shaft 42CrMo4",
      "One shaft drives both strands, so the pallet cannot twist.", `z = ${M.zs}, d0 = ${f(R.d0, 1)} mm, ${f(R.nOut, 0)} rpm, torque ${f(R.Tout, 1)} N·m.`,
      "Sprockets with keyway or clamping bush; align both in one line ±0.2 mm. Idler end with chain tensioner (slotted bearing housing)."],
    gearmotor: ["Gear motor with brake", "BUY", "helical-bevel gear motor, IE3, brake, encoder",
      "Drives the station chains; the brake holds the pallet when stopped.",
      `${R.motor} kW (needed ${f(R.Pm, 0)} W ×1.3), output ${f(R.nOut, 0)} rpm (i ≈ ${f(R.igm, 0)}), ${f(R.Tout, 1)} N·m. Frequency inverter: ramp ${f(M.vt / M.at, 2)} s, creep 0.05 m/s at the end.`,
      "Hangs under the top frame, drives the shaft with a short 08B drive chain (tensioner)."],
    stop: ["Retractable pallet stop", "BUY", "heavy-duty conveyor stop with hydraulic damper (or Ø32 cylinder + guided head)",
      "Stops the pallet exactly over the receivers and keeps it from running into the APC. Goes DOWN before the APC turns.",
      `Force ${f(R.Fstop, 0)} N (creep 0.05 m/s + chain sliding under the pallet) → design 1.5× = ${f(R.Fstop * 1.5 / 1000, 1)} kN. Up: top at ${R.Ht + 30} mm, down: ${H0 - 20} mm.`,
      "PU face 90 Shore A. 2 sensors: up / down. PLC interlock: APC rotation only when the stop is down."],
    dpost: ["Buffer post + front plate", "MAKE", "S355 tube 60×60 + plate 15 mm",
      "Carries the 2 safety shock absorbers, 2 PU end pads and the docking pin of the manual cart. The AGV normally stops 40 mm before it and never touches it.",
      `Front face at x = ${R.XD - 20} mm from the station centre, PU pads 20 mm. Posts at z = ±280 mm, separate anchors.`,
      "Machine the pin bore and the absorber threads after welding. Align to the station axis ±0.5 mm."],
    pin: ["Docking pin for the manual cart", "MAKE", "16MnCr5 case hardened 58–62 HRC, ground f7",
      "Centres the MANUAL CART (castors can move sideways, the operator pushes). Not used by the AGV: the AGV bumper has a pocket around it.",
      `Ø${M.dp} × 60 mm, cone 15°, height ${M.hb} mm. Side load ${f(R.Flat / 1000, 2)} kN → bending ${f(R.sigPin, 0)} N/mm² (allowed ~200).`,
      "Flange with 4 × M8 + 2 dowel pins. Replaceable."],
    dbracket: ["Docking bracket (station, 2 pieces)", "MAKE", "S355 post 60×60 + arm 80×30, machined",
      "Holds the 2 cone pins above the AGV deck. Its machined underside is the HEIGHT STOP for the deck: the deck pushes up against it, so the deck chain is exactly at the station chain height – no sensor needed.",
      `Posts at z = ±${R.zPost} mm beside the AGV (outside the APC swing circle: ${f(R.pinClr, 0)} mm), stop faces at ${R.Ht + 40} mm. Load ${f(R.pinLoad, 0)} N per bracket.`,
      "Machine the stop faces + pin bores after setting the station chains UP: faces at chain top + 40 mm ±0.1, pins ±0.05 to the station axis. Then dowel."],
    cpin: ["Cone docking pin (round / diamond)", "MAKE", "16MnCr5 case hardened 58–62 HRC, ground g6",
      "Hangs down from the bracket. When the deck lifts, the cone enters the deck bush and pushes the floating deck into the exact position (x, z and angle).",
      `Ø${M.dpn} g6, cone 15° with lead-in ±${R.lead} mm (cone length ${f(R.lcone, 0)} mm) for the AGV error ±${f(R.cap, 1)} mm. One round pin (z = +${R.zPin}) + one diamond pin (z = −${R.zPin}) – not over-determined.`,
      "Polish the cone (Ra 0.4), grease lightly. Replaceable."],
    float: ["Floating plate with ball transfer units", "BUY (AGV supplier) / MAKE", "ball transfer units (hardened ball, 0.5–1 kN each) + 4 centring springs + conical lock pin",
      `Lets the deck move ±${M.fl} mm in x and z and turn ±1° on the AGV, with very little force – so the cone pins can align it while the AGV body stays where it stopped.`,
      `Friction ${f(R.Ffric, 0)} N + springs ${M.ksp} N/mm. Lock pin (pneumatic or electric) holds the deck centred while driving; it opens after the AGV stops and re-centres the deck when it closes.`,
      "Springs alone leave ±" + f(R.xres, 1) + " mm (friction), so the lock pin must have a cone (lead-in ≥ ±" + M.fl + " mm)."],
    darm: ["Docking arm + bush on the deck", "MAKE (AGV supplier builds it in)", "S355 arm + hardened bush 16MnCr5 H7",
      "Two arms on the floating deck carry the bushes for the cone pins; their top faces press against the bracket stop faces.",
      `Bush Ø${M.dpn} H7 at z = ±${R.zPin} mm, top face = deck chain top + 40 mm.`,
      "Machine the bush bores, the top faces and the deck chain guide seats in ONE setup (±0.1 mm)."],
    shock: ["Industrial shock absorber + PU end pad", "BUY", `${R.shock.id} self-compensating shock absorber`,
      "Safety only: the AGV stops 40 mm before them. They stop an AGV that is too fast or a cart pushed too hard.",
      `Normal ${f(R.Ed, 1)} J; fault (AGV at ${M.vnav} m/s): ${f(R.Ef, 0)} J → ${f(R.Eabs, 0)} J per absorber incl. ×1.25. Peak ${f(R.Fpk / 1000, 1)} kN each.`,
      `2 pieces at z = ±190 mm, body behind the plate, stroke ${M.sb} mm. The fixed stop is the PU pads (not the absorber).`],
    funnel: ["Protective guide rails", "MAKE", "S355 flat bar 15 mm + UHMW-PE wear strip 10 mm",
      "Do NOT centre the AGV (an AGV cannot be pushed sideways). They only stop an AGV that is far off its path and guide the manual cart.",
      `Inner width ${2 * R.wi} mm = AGV + ${M.nav + 5} mm per side, so the rollers do not touch in normal operation. Entry +50 mm per side, length 1300 mm.`,
      "Floor brackets with M12 anchors, slotted holes for alignment ±5 mm. Chamfer the entry ends."],
    curtain: ["Light curtain with muting", "BUY", "safety light curtain type 4, PL d / e, + muting sensors",
      "Stops the station if a person enters from the AGV side. Muted only while the AGV is docked and the transfer runs.",
      "Height 300–1800 mm, outside the APC swing circle.", "Safety distance per ISO 13855; muting per IEC 62046 (2 independent signals: docked + E84 VALID)."],
    e84: ["Optical I/O (E84 / PIO) transceiver", "BUY", "infrared 8-bit parallel I/O transceiver pair",
      "Exchanges the handshake bits between AGV and station without cables (VALID, L_REQ, TR_REQ, READY, BUSY, COMPT …).",
      "One on the docking post, one on the AGV, face to face, 0.1–1 m.", "Align at commissioning; keep the window clean."],
    panel: ["Station operator panel", "BUY / MAKE", "IP54 push-button box",
      "E-stop, mode AUTO (AGV) / MANUAL (cart), TRANSFER button, lamps.", "Outside the APC swing circle.", ""],
    agv: ["AGV with lifting chain deck", "BUY (AGV supplier)", "AGV 1 t class, laser navigation, safety scanners",
      "Carries the pallet between the pallet pool and the cells. The chain deck is the AGV supplier's part – but its interface follows THIS page.",
      `Body ${R.lA} × ${R.wA} mm, ${M.mv} kg empty, ${f(R.mt, 0)} kg loaded. Stability (emergency stop at driving height): safety ${f(R.SFagv, 1)}.`,
      `Stops ±${M.nav} mm / ±${M.yaw}° – this is normal for AGVs and is solved by the floating deck, not by the AGV. Give the supplier the interface sheet (guide section 1).`],
    deck: ["AGV lifting deck", "BUY (AGV supplier)", "spindle or scissor lift + chain conveyor",
      "Drives low, lifts at the station until the docking arms press against the bracket stop faces (torque limit).", `Driving ${M.hdrive} mm, transfer ${R.Ht} mm, speed ${M.vdeck} mm/s, push-up force ${M.fpre} N.`, "Creep speed for the last 50 mm (pins engaging)."],
    vchain: ["AGV deck chains", "BUY (AGV supplier)", `${c.id} – same chain and strand pitch as the station`,
      "Move the pallet on/off the AGV together with the station chains.", `Strands at z = ±${R.zc} mm, length ${A.a + 40} mm, ${M.vt} m/s, start/stop synchronous with the station (E84 BUSY).`, ""],
    vguide: ["Side guide rails on the AGV deck", "MAKE / supplier", "S355 + UHMW-PE strip",
      "Guide the pallet ledges (z ±1 mm) on the AGV and during the transfer; keep the pallet on the deck in curves.",
      `Inner width ${A.b + 50 + 4} mm over the ledges. Placed outside the APC swing circle (clearance ${f(R.swingClr, 0)} mm).`, ""],
    pawl: ["Retention pawl (AGV / cart)", "MAKE", "spring-loaded pawl, 42CrMo4",
      "Holds the pallet on the deck while driving. Opens only when the deck is docked on the pins (sensor B13) – interlocked by the AGV controller.",
      `Holds ${f(R.Fpawl / 1000, 2)} kN (emergency stop ×1.5). Far end: fixed stop.`, "Sensor: pawl up / down."],
    bush: ["Docking bush (manual cart)", "MAKE", "16MnCr5 case hardened, H8", "Receives the cart docking pin.", `Ø${M.dp} H8, 15° lead-in, at ${M.hb} mm.`, "Mount on the cart bumper with adjustment ±3 mm, then dowel."],
    groller: ["Guide roller (AGV)", "BUY", "PU-tyred cam follower Ø60", "Runs along the funnel rails.", "4 per AGV, vertical axis, at 200 mm height.", ""],
    cart: ["Manual transfer cart", "MAKE", "S355 welded frame, 4 castors Ø160 PU (2 swivel with brake)",
      "For cells without AGV or as a back-up: the operator pushes the pallet on free rollers into the station.",
      `${M.mc} kg, deck at ${R.Ht} mm (fixed). Stability at a hard stop: safety ${f(R.SFcart, 1)}. Push force on the rollers ≈ ${f(R.Fpush, 0)} N.`,
      "Deck height fixed by design ±1 mm, shims under the roller tracks. Floor in the cart path: flatness ±2 mm, no steps."],
    latch: ["Over-centre latch (cart)", "BUY", "toggle latch 5 kN + hook on the docking post",
      "Pulls the cart against the PU pads and holds it during the transfer.", "With a sensor: latch closed = transfer allowed.", ""],
    castor: ["Castor Ø160", "BUY", "PU tread, ball bearing, 400 kg each", "", "2 fixed, 2 swivel with brake.", ""],
    pallet: ["Machining pallet", "(APC tab)", "GGG-60 / C45", "The same pallet as in the Pallet changer tab.",
      `${A.a} × ${A.b} × ${R.tp} mm, ${A.mp} kg + load ${A.mw} kg; centre of gravity ${f(R.hg, 0)} mm above the pallet bottom.`,
      "Chamfer all bottom edges 5 mm × 30° (smooth run over the chain gap). Keep the strand tracks on the bottom free of T-slot burrs."],
    ledge: ["Lifting ledge on the pallet", "(APC tab)", "", "The APC fork rails lift under these; the AGV side guides run along them.", "", ""],
    stud: ["Pull stud", "(APC tab)", "", "Hangs " + LS + " mm below the pallet. At the station it centres the pallet in the receivers.", "", ""],
    fixture: ["Tombstone with parts", "", "", "Load on the pallet.", `${A.mw} kg, centre ${A.hc} mm above the pallet top.`, ""],
    apc: ["Rotary pallet changer (APC)", "(APC tab)", "", "Arm, cross beams and fork rails of the APC – see the Pallet changer tab.",
      `Fork rails bottom ${H0 - 50} mm lowered, ${R.railLift} mm lifted (stroke ${A.s} mm). Swing circle Ø${f(A.swing, 0)} mm.`,
      "During rotation the rails pass over the receivers (clearance " + R.clrRec + " mm) and the lowered station chains (" + R.clrChain + " mm)."],
    wall: ["APC partition wall", "(APC tab)", "", "Separates the machine from the load station.", "", ""],
    machine: ["Machine (HMC)", "", "", "", "", ""],
  };
  return I[key];
}

/* ------------------------------------------------------------------ 3D */
function create3D(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 10, 40000);
  const controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3000, 5000, 3500); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3000, 2000, -2500); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  let O = {}, selBox = null, labels = [], onPick = null, chainTex = [], M_SB = 25;
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed");

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op ? false : true });
  const C = {
    steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }), ground: mat(0xc9d0d6, { m: 0.65, r: 0.28 }), frame: mat(0x3c6e9e), arm: mat(0xe1a32a, { m: 0.25, r: 0.5 }),
    wall: mat(0xb9c2ca, { m: 0.3, r: 0.4, op: 0.22, ds: true }), dark: mat(0x3a4048, { m: 0.5, r: 0.5 }), machine: mat(0x5b6670, { op: 0.12, ds: true }),
    cast: mat(0x67717b, { m: 0.2, r: 0.8 }), black: mat(0x23262a), yellow: mat(0xf2c200), red: mat(0xd03b3b), green: mat(0x2fa84f),
    agv: mat(0xe8e6df, { m: 0.15, r: 0.6 }), agvDark: mat(0x4a5560), hpu: mat(0x2f5f8f), brass: mat(0xc49a3c, { m: 0.7, r: 0.3 }),
    pe: mat(0xf4f4f0, { m: 0, r: 0.8 }), pu: mat(0xd9832b, { m: 0, r: 0.7 }), floor: mat(0xd8d6cf, { m: 0, r: 0.95 }), cart: mat(0x2f8f6b),
    stud: mat(0xc49a3c, { m: 0.7, r: 0.3 }),
  };
  const box = (w, h, d, m, x, y, z, part, parent) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  function cyl(r, h, m, x, y, z, part, parent, axis = "y", seg = 28, r2) {
    const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg);
    if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me;
  }
  function chainBox(len, w, x, y, z, pitch, parent, part) {
    const c = document.createElement("canvas"); c.width = 16; c.height = 4; const g = c.getContext("2d");
    g.fillStyle = "#2b2f35"; g.fillRect(0, 0, 16, 4); g.fillStyle = "#8d969f"; g.fillRect(9, 0, 7, 4);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / pitch, 1);
    const m = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.45 });
    const me = box(len, 12, w, m, x, y, z, part, parent); chainTex.push({ tex, pitch, parent });
    return me;
  }
  function label(text, anchor, off = [0, 0, 0], parent = root) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "600 30px system-ui, sans-serif";
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 46;
    g.font = "600 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.93)"; g.strokeStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.roundRect(1, 1, w - 2, 44, 10); g.fill(); g.stroke(); g.fillStyle = "#1b1f24"; g.fillText(text, 12, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
    const pos = [anchor[0] + off[0], anchor[1] + off[1], anchor[2] + off[2]];
    sp.scale.set(0.032 * w / 46, 0.032, 1); sp.position.set(...pos); sp.renderOrder = 20; parent.add(sp); labels.push(sp);
    if (off.some((v) => v)) {
      const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor), new THREE.Vector3(...pos)]);
      const ln = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x30363d, depthTest: false, transparent: true, opacity: 0.8 }));
      ln.renderOrder = 19; parent.add(ln); labels.push(ln);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x30363d, depthTest: false }));
      dot.position.set(...anchor); dot.renderOrder = 19; parent.add(dot); labels.push(dot);
    }
    return sp;
  }
  function pallet(R, A, parent) {        // origin = centre of the pallet bottom
    const g = new THREE.Group(); parent.add(g);
    const a = A.a, b = A.b, tp = R.tp;
    box(a, tp, b, C.ground, 0, tp / 2, 0, "pallet", g);
    for (let k = -2; k <= 2; k++) box(a - 30, 3, 18, C.dark, 0, tp + 1, k * b / 6, "pallet", g);
    for (const sz of [1, -1]) box(a, 20, 25, C.steel, 0, 10, sz * (b / 2 + 12.5), "ledge", g);
    for (const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      cyl(16, 34, C.stud, i * A.pitch / 2, -17, j * A.pitch / 2, "stud", g, "y", 16);
      cyl(11, 10, C.stud, i * A.pitch / 2, -39, j * A.pitch / 2, "stud", g, "y", 16);
    }
    const th = Math.min(700, Math.max(300, A.hc * 2.2)), tw = Math.min(a, b) * 0.6;
    box(tw * 0.55, th, tw, C.cast, 0, tp + th / 2, 0, "fixture", g);
    const pm = new THREE.MeshStandardMaterial({ color: 0xc98a0c, metalness: 0.4, roughness: 0.5 });
    for (const sx of [1, -1]) for (const yy of [0.27, 0.73]) box(tw * 0.3, th * 0.36, tw * 0.75, pm, sx * tw * 0.42, tp + th * yy, 0, "fixture", g);
    return g;
  }
  // deck with 2 chain strands (AGV) or roller tracks (cart); origin x = deck centre, y = chain top
  function deckParts(R, A, M, parent, rollers) {
    const a = A.a, b = A.b, len = a + 40, zc = R.zc;
    box(len + 30, 16, b + 80, rollers ? C.cart : C.agvDark, 0, -78, 0, rollers ? "cart" : "deck", parent);
    for (const sz of [1, -1]) {
      box(len, 50, 40, C.steel, 0, -37, sz * zc, rollers ? "cart" : "vchain", parent);
      if (rollers) for (let x = -len / 2 + 30; x <= len / 2 - 20; x += 70) cyl(22, 34, C.ground, x, -22, sz * zc, "cart", parent, "z", 16);
      else {
        chainBox(len, 16, 0, -6, sz * zc, R.ch.p, parent, "vchain");
        for (const ex of [-1, 1]) cyl(R.d0 / 2, 18, C.dark, ex * (len / 2 - R.d0 / 2), -R.d0 / 2, sz * zc, "vchain", parent, "z", 24);
      }
      // side guide rails along the ledges
      const zg = b / 2 + 25 + 2 + 10;
      box(len + 20, 50, 20, rollers ? C.cart : C.agvDark, 0, 5, sz * (zg + 2), "vguide", parent);
      box(len + 20, 30, 4, C.pe, 0, 12, sz * (zg - 9), "vguide", parent);
    }
    // far-end fixed stop + near-end pawl
    box(20, 60, 2 * zc + 60, C.dark, len / 2 + 25, 10, 0, "pawl", parent);
    const pw = new THREE.Group(); pw.position.set(-len / 2 + 10, -10, 0); parent.add(pw);
    box(16, 56, 70, C.red, 0, 28, 0, "pawl", pw);
    if (!rollers) box(120, 50, 60, C.dark, len / 2 - 60, -110, 0, "deck", parent);         // deck drive motor
    return pw;
  }

  function build(R, M, A) {
    while (root.children.length) { const o = root.children.pop(); o.traverse((c) => { if (c.geometry) c.geometry.dispose(); if (c.material && c.material.map) c.material.map.dispose(); }); }
    labels = []; chainTex = []; O = {}; if (selBox) { scene.remove(selBox); selBox = null; }
    const a = A.a, b = A.b, zc = R.zc, r = A.r;
    O.R = R;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(8000, 6000), C.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(600, 0, 0); root.add(fl);
    // floor marking: AGV docking lane
    for (const sz of [1, -1]) box(2600, 2, 60, C.yellow, R.XD + 1300, 1, sz * (R.wA / 2 + 130), null, root);

    // ---------------- APC (context, at rest, lowered)
    const apc = new THREE.Group(); root.add(apc);
    const yArmTop = H0 - 5, yArmBot = yArmTop - A.secH, yc = yArmBot - 190, S = A.dm + 260;
    box(S, yc - 40, S, C.frame, -r, (yc - 40) / 2, 0, "apc", apc);
    cyl(A.dm / 2 + 40, yArmBot - yc, C.steel, -r, (yArmBot + yc) / 2, 0, "apc", apc);
    const xin = r - a / 2 - 40;
    box(2 * (xin - 50), A.secH, A.secB, C.arm, -r, yArmTop - A.secH / 2, 0, "apc", apc);
    for (const sx of [1, -1]) {
      box(100, 45, b + 110, C.arm, -r + sx * (xin - 50), yArmTop - 22.5, 0, "apc", apc);
      for (const sz of [1, -1]) box(a + 40, 45, 45, C.arm, -r + sx * (xin + (a + 40) / 2), yArmTop - 22.5, sz * (b / 2 + 12), "apc", apc);
    }
    const wallW = A.swing - 40;
    box(14, 950, wallW, C.wall, -r, yArmTop + 475, 0, "wall", apc);
    box(40, 40, wallW, C.arm, -r, yArmTop + 20, 0, "wall", apc);
    // the other pallet inside the machine + machine body (transparent)
    const pin = new THREE.Group(); pin.position.set(-2 * r, H0, 0); apc.add(pin); pallet(R, A, pin).traverse((m) => { if (m.isMesh) m.userData.part = "apc"; });
    box(1600, 2600, Math.max(1800, wallW + 200), C.machine, -r - 20 - 800, 1300, 0, "machine", apc);
    label("APC fork rails (lowered)", [-20, H0 - 25, b / 2 + 12], [-900, 350, 800]);
    label("APC partition wall", [-r, H0 + 800, wallW / 2 - 100], [0, 200, 300]);

    // ---------------- station table + receivers
    const T = new THREE.Group(); root.add(T);
    for (const lx of [-80, 150]) for (const sz of [1, -1]) {
      box(70, 870, 70, C.frame, lx, 435, sz * 200, "tframe", T);
      box(120, 15, 120, C.dark, lx, 7.5, sz * 200, "anchor", T);
      for (const dx of [-38, 38]) cyl(9, 30, C.black, lx + dx, 15, sz * 200 + (dx > 0 ? 38 : -38), "anchor", T, "y", 10);
    }
    for (const sz of [1, -1]) box(550, 50, 60, C.frame, -5, 895, sz * 200, "tframe", T);
    for (const x of [-265, -180, 0, 180, 250]) box(x === -265 ? 40 : 60, 50, 340, C.frame, x, 895, 0, "tframe", T);
    for (const sz of [1, -1]) box(230, 40, 50, C.frame, 35, 120, sz * 200, "tframe", T);
    for (const [i, j] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const x = i * A.pitch / 2, z = j * A.pitch / 2;
      box(70, H0 - 30 - 920, 70, C.frame, x, (920 + H0 - 30) / 2, z, "post", T);
      cyl(RREC, 30, C.ground, x, H0 - 15, z, "receiver", T, "y", 28);
      cyl(17, 31, C.black, x, H0 - 15, z, "receiver", T, "y", 16);
    }
    for (const x of [-180, 180]) for (const sz of [1, -1]) cyl(12, 115, C.ground, x, 977.5, sz * zc, "guide", T, "y", 16);
    // lift cylinder (body fixed, under the top frame)
    cyl(R.D / 2 + 10, 155, C.hpu, 0, 792.5, 0, "liftcyl", T);
    cyl(R.D / 2 + 22, 16, C.dark, 0, 862, 0, "liftcyl", T);
    // retractable stop body
    box(60, 220, 60, C.dark, -265, 810, 0, "stop", T);
    label("Locating receivers (4)", [A.pitch / 2, H0, -A.pitch / 2], [500, 650, -900]);
    label("Station table (anchored)", [150, 500, -200], [500, -150, -650]);

    // ---------------- lift-transfer unit (moves)
    const LF = new THREE.Group(); root.add(LF); O.lift = LF;
    const len = a / 2 + 20 - (-a / 2 + 10), cx = (a / 2 + 20 + (-a / 2 + 10)) / 2;
    for (const sz of [1, -1]) {
      box(len, 50, 40, C.steel, cx, R.Hlow - 37, sz * zc, "liftframe", LF);
      chainBox(len, 16, cx, R.Hlow - 6, sz * zc, R.ch.p, LF, "chain");
      for (const ex of [-1, 1]) cyl(R.d0 / 2, 18, C.dark, cx + ex * (len / 2 - R.d0 / 2), R.Hlow - R.d0 / 2, sz * zc, "sprocket", LF, "z", 24);
      for (const x of [-180, 180]) box(50, 40, 50, C.dark, x, R.Hlow - 82, sz * zc, "guide", LF);
    }
    for (const x of [cx - len / 2 + 15, 0, cx + len / 2 - 15]) box(40, 40, 2 * zc + 40, C.steel, x, R.Hlow - 82, 0, "liftframe", LF);
    const xs = cx + len / 2 - R.d0 / 2;
    cyl(15, 2 * zc + 60, C.ground, xs, R.Hlow - R.d0 / 2, 0, "sprocket", LF, "z", 16);
    const gmx = 90, gmy = R.Hlow - 150, shy = R.Hlow - R.d0 / 2;
    box(100, 100, 160, C.hpu, gmx, gmy, 0, "gearmotor", LF);
    cyl(55, 40, C.hpu, gmx, gmy, 100, "gearmotor", LF, "z");
    const dc = box(Math.hypot(xs - gmx, shy - gmy), 10, 12, C.dark, (xs + gmx) / 2, (shy + gmy) / 2, 0, "gearmotor", LF);
    dc.rotation.z = Math.atan2(shy - gmy, xs - gmx);
    cyl(R.rod / 2, 190, C.ground, 0, R.Hlow - 100 - 95, 0, "liftcyl", LF);
    label(`Lift-transfer unit: 2 × ${R.ch.id.split(" ")[0]} chains`, [cx, R.Hlow - 6, zc], [350, 800, 900], LF);
    label(`Gear motor ${R.motor} kW`, [90, R.Hlow - 150, 80], [-500, -450, 900], LF);

    // ---------------- retractable stop head (moves)
    const SG = new THREE.Group(); root.add(SG); O.stop = SG;
    box(20, 140, 90, C.dark, -267, H0 - 20 - 70, 0, "stop", SG);
    box(6, 60, 80, C.pu, -254, H0 - 20 - 30, 0, "stop", SG);
    label("Retractable stop", [-263, H0 - 20, 0], [-650, 750, 300], SG);

    // ---------------- docking post + front plate
    const XF = R.XD - 20;                   // plate front face
    for (const sz of [1, -1]) {
      box(60, 480, 60, C.frame, XF - 45, 240, sz * 280, "dpost", root);
      box(120, 15, 120, C.dark, XF - 45, 7.5, sz * 280, "anchor", root);
      for (const dz of [-38, 38]) cyl(9, 30, C.black, XF - 45 + dz, 15, sz * 280 + dz, "anchor", root, "y", 10);
    }
    box(60, 60, 620, C.frame, XF - 45, 30, 0, "dpost", root);
    box(15, 400, 620, C.frame, XF - 7.5, 280, 0, "dpost", root);
    O.shocks = [];
    for (const sz of [1, -1]) {
      box(20, 90, 90, C.pu, XF + 10, M.hb, sz * 100, "shock", root);                 // PU end pads (fixed stop)
      cyl(14, 70, C.dark, XF - 50, M.hb, sz * 190, "shock", root, "x", 16);          // absorber body behind the plate
      const rod = cyl(7, 1, C.ground, XF, M.hb, sz * 190, "shock", root, "x", 12);
      const cap = cyl(16, 10, C.pu, XF, M.hb, sz * 190, "shock", root, "x", 16);
      O.shocks.push({ rod, cap });
    }
    cyl(M.dp / 2 + 16, 12, C.steel, XF + 6, M.hb, 0, "pin", root, "x", 24);
    cyl(M.dp / 2, 42, C.ground, XF + 33, M.hb, 0, "pin", root, "x", 24);
    cyl(M.dp / 2, 22, C.ground, XF + 65, M.hb, 0, "pin", root, "x", 24, 4);
    // latch hooks + E84
    for (const sz of [1, -1]) box(30, 40, 30, C.dark, XF + 10, M.hb + 100, sz * 280, "latch", root);
    box(40, 50, 50, C.black, XF + 5, 430, -250, "e84", root);
    // docking brackets with cone pins (posts beside the AGV, outside the APC swing circle)
    const yF = R.Ht + 40;                    // stop face (underside of the bracket arm)
    for (const sz of [1, -1]) {
      box(60, yF + 60, 60, C.frame, R.xPost, (yF + 60) / 2, sz * R.zPost, "dbracket", root);
      box(120, 15, 120, C.dark, R.xPost, 7.5, sz * R.zPost, "anchor", root);
      box(R.xPin + 60 - (R.xPost - 30), 30, 70, C.frame, (R.xPin + 60 + R.xPost - 30) / 2, yF + 15, sz * R.zPost, "dbracket", root);
      box(80, 30, R.zPost - R.zPin + 45, C.frame, R.xPin, yF + 15, sz * (R.zPin + R.zPost) / 2, "dbracket", root);
      box(70, 4, 70, C.ground, R.xPin, yF - 2, sz * R.zPin, "dbracket", root);
      cyl(M.dpn / 2, 30, C.ground, R.xPin, yF - 15, sz * R.zPin, "cpin", root, "y", 20);
      cyl(4, R.lcone, C.ground, R.xPin, yF - 30 - R.lcone / 2, sz * R.zPin, "cpin", root, "y", 20, M.dpn / 2);
    }
    label("Shock absorbers (safety) + cart pin", [XF + 60, M.hb, 0], [700, 520, 900]);
    label("Docking bracket + cone pin", [R.xPin, yF + 30, R.zPin], [700, 350, 600]);
    label("E84 optical I/O", [XF + 5, 430, -250], [300, 300, -600]);

    // ---------------- funnel rails
    const X0 = R.XD + 50, wi = R.wi;
    for (const sz of [1, -1]) {
      box(600, 120, 15, C.frame, X0 + 300, 200, sz * (wi + 7.5 + 10), "funnel", root);
      box(600, 100, 10, C.pe, X0 + 300, 200, sz * (wi + 5), "funnel", root);
      const ang = Math.atan2(50, 700), lenF = Math.hypot(700, 50);
      const p1 = box(lenF, 120, 15, C.frame, X0 + 600 + 350, 200, sz * (wi + 17.5 + 25), "funnel", root); p1.rotation.y = -sz * ang;
      const p2 = box(lenF, 100, 10, C.pe, X0 + 600 + 350, 200, sz * (wi + 5 + 25), "funnel", root); p2.rotation.y = -sz * ang;
      for (const x of [X0 + 100, X0 + 500, X0 + 900, X0 + 1250]) box(60, 140, 80, C.frame, x, 70, sz * (wi + 70 + (x > X0 + 600 ? (x - X0 - 600) / 14 : 0)), "funnel", root);
    }
    label("Protective guide rails", [X0 + 900, 260, -(wi + 40)], [200, 450, -600]);

    // ---------------- light curtain + panel
    const cur = new THREE.Group(); root.add(cur); O.curtain = cur;
    const zc2 = R.zPost + 70;
    for (const sz of [1, -1]) { box(45, 1800, 45, C.yellow, a / 2 + 30, 900, sz * zc2, "curtain", cur); cyl(18, 30, C.green, a / 2 + 30, 1815, sz * zc2, "curtain", cur); }
    const pts = []; for (let y = 320; y <= 1780; y += 60) pts.push(a / 2 + 30, y, -zc2, a / 2 + 30, y, zc2);
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    cur.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.3 })));
    box(50, 1250, 50, C.dark, -50, 625, -820, "panel", root); box(280, 200, 110, C.dark, -50, 1330, -820, "panel", root);
    cyl(22, 30, C.red, -110, 1330, -760, "panel", root, "z"); cyl(16, 20, C.green, 20, 1330, -760, "panel", root, "z");

    // ---------------- AGV (origin = bumper face, x grows backwards)
    const AG = new THREE.Group(); root.add(AG); O.agv = AG;
    const lA = R.lA, wA = R.wA;
    box(lA, 300, wA, C.agv, lA / 2, 200, 0, "agv", AG);
    box(lA - 40, 8, wA - 40, C.agvDark, lA / 2, 352, 0, "agv", AG);
    box(15, 260, wA - 80, C.agvDark, 7, 240, 0, "agv", AG);
    for (const x of [110, lA - 110]) for (const sz of [1, -1]) cyl(75, 60, C.black, x, 75, sz * (wA / 2 - 70), "agv", AG, "z", 24);
    for (const x of [80, lA - 80]) for (const sz of [1, -1]) cyl(30, 40, C.dark, x, 200, sz * (wA / 2 - 25), "groller", AG, "y", 20);
    for (const [x, sz] of [[25, 1], [lA - 25, -1]]) cyl(28, 50, C.yellow, x, 140, sz * (wA / 2 - 35), "agv", AG, "y", 16);
    cyl(30, 60, C.yellow, lA - 80, 390, wA / 2 - 80, "agv", AG);
    cyl(45, 18, C.black, 6, M.hb, 0, "agv", AG, "x", 24);                     // pocket for the cart pin
    box(20, 120, 30, C.agvDark, 20, 400, -250, "e84", AG); box(40, 50, 50, C.black, -5, 430, -250, "e84", AG);
    const xd = R.L - R.XB;                    // deck centre in AGV coordinates (nominal stop)
    O.xd = xd;
    for (const dx of [-1, 1]) for (const sz of [1, -1]) box(70, 160, 70, C.agvDark, xd + dx * (a / 2 - 20), 430, sz * (b / 2 - 40), "deck", AG);
    const LG = new THREE.Group(); AG.add(LG); O.liftG = LG; LG.position.x = xd;      // lifting part (does not float)
    const tl = R.Ht - M.hdrive + 150;
    for (const dx of [-1, 1]) for (const sz of [1, -1]) box(50, tl, 50, C.steel, dx * (a / 2 - 20), -107 - tl / 2, sz * (b / 2 - 40), "deck", LG);
    box(a, 14, b - 40, C.hpu, 0, -100, 0, "float", LG);                           // lower plate of the floating unit
    for (const x of [-a / 2 + 60, 0, a / 2 - 60]) for (const sz of [1, -1]) cyl(9, 8, C.ground, x, -89, sz * (b / 2 - 80), "float", LG, "y", 12);
    for (const sz of [1, -1]) { box(30, 30, 30, C.hpu, 0, -100, sz * (b / 2 - 5), "float", LG); cyl(6, 40, C.yellow, 0, -100, sz * (b / 2 + 30), "float", LG, "z", 10); }
    cyl(16, 30, C.red, a / 2 - 120, -85, 0, "float", LG, "y", 16, 4);              // lock pin (cone)
    const DK = new THREE.Group(); LG.add(DK); O.deck = DK;                          // floating deck
    O.pawlV = deckParts(R, A, M, DK, false);
    const xa = R.xPin - R.L;
    for (const sz of [1, -1]) {
      box(80, 30, R.zPin - b / 2 + 15, C.agvDark, xa, 25, sz * (b / 2 + (R.zPin - b / 2 + 15) / 2 + 20), "darm", DK);
      cyl(M.dpn / 2 + 12, 32, C.ground, xa, 25, sz * R.zPin, "darm", DK, "y", 20);
      cyl(M.dpn / 2, 33, C.black, xa, 25, sz * R.zPin, "darm", DK, "y", 16);
    }
    label("Floating deck (ball transfer units)", [a / 2 - 60, -89, b / 2 - 80], [400, -350, 700], LG);
    label("AGV with lifting chain deck", [lA * 0.7, 350, wA / 2], [300, 300, 600], AG);
    label("Retention pawl", [-(a + 40) / 2 + 10, 30, 0], [250, 450, 700], DK);

    // ---------------- manual cart
    const CT = new THREE.Group(); root.add(CT); O.cart = CT;
    const lc = M.lc, wc = R.wA - 40;
    box(lc + 120, 60, wc, C.cart, (lc + 120) / 2, 190, 0, "cart", CT);
    for (const x of [60, lc + 60]) for (const sz of [1, -1]) { cyl(80, 45, C.black, x, 80, sz * (wc / 2 - 60), "castor", CT, "z", 20); box(60, 60, 60, C.dark, x, 170, sz * (wc / 2 - 60), "castor", CT); }
    box(15, 260, wc - 60, C.cart, 7, M.hb, 0, "cart", CT);
    cyl(M.dp / 2 + 16, 28, C.ground, 14, M.hb, 0, "bush", CT, "x", 24); cyl(M.dp / 2, 30, C.black, 14, M.hb, 0, "bush", CT, "x", 20);
    for (const sz of [1, -1]) box(60, 60, 40, C.dark, 40, M.hb + 100, sz * 280, "latch", CT);
    const xcd = R.L - R.XD;
    for (const dx of [-1, 1]) for (const sz of [1, -1]) box(60, R.Ht - 300, 60, C.cart, xcd + dx * (a / 2 - 10), 220 + (R.Ht - 300) / 2, sz * (b / 2 - 40), "cart", CT);
    const CD = new THREE.Group(); CD.position.set(xcd, R.Ht, 0); CT.add(CD);
    O.pawlC = deckParts(R, A, M, CD, true);
    const hx = xcd + a / 2 + 120;
    for (const sz of [1, -1]) box(35, 500, 35, C.dark, hx, R.Ht + 100, sz * (b / 2), "cart", CT);
    cyl(18, b + 35, C.dark, hx, R.Ht + 340, 0, "cart", CT, "z");
    label("Manual transfer cart", [hx, R.Ht + 340, 0], [400, 300, 500], CT);

    // ---------------- pallet
    const PG = new THREE.Group(); root.add(PG); O.pal = PG; pallet(R, A, PG);
    label("Machining pallet", [0, R.tp + 600, 0], [0, 180, 0], PG);
    fit("overview");
  }

  const VIEWS = {
    overview: () => [[3300, 2600, 3500], [250, 650, 0]],
    dock: () => [[850, 1250, 1500], [400, 1080, 330]],
    transfer: () => [[-250, 2050, -1300], [150, 1030, 0]],
    side: () => [[250, 950, 3600], [250, 900, 0]],
    top: () => [[250, 4800, 1], [250, 0, 0]],
  };
  function fit(v) { const [p, t] = VIEWS[v](); nice.stop(); camera.position.set(...p); controls.target.set(...t); controls.update(); }
  function update(s, veh) {
    if (!O.agv) return;
    const R = O.R, cart = veh === "cart";
    O.agv.visible = !cart; O.cart.visible = cart;
    const V = cart ? O.cart : O.agv;
    V.position.set((cart ? R.XD : R.XB) + s.x, 0, s.z || 0); V.rotation.y = cart ? 0 : s.yaw;
    if (!cart) {
      O.liftG.position.y = s.deck;
      // floating deck: at e = 1 the deck centre is exactly at (L, 0) with no angle, whatever the AGV error is
      const dx = R.L - (R.XB + s.x), dz = -(s.z || 0), c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      O.deck.position.set((lx - O.xd) * s.e, 0, lz * s.e); O.deck.rotation.y = -s.yaw * s.e;
    }
    O.lift.position.y = s.lift - R.Hlow;
    O.stop.position.y = s.stop * (R.Ht + 30 - (H0 - 20));
    for (const pw of [O.pawlV, O.pawlC]) pw.rotation.z = s.pawl ? -Math.PI / 2 * 0.98 : 0;
    if (s.palOnVeh && !cart) {
      O.deck.updateWorldMatrix(true, false);
      const v = new THREE.Vector3(), q = new THREE.Quaternion(); O.deck.getWorldPosition(v); O.deck.getWorldQuaternion(q);
      O.pal.position.set(v.x, s.palY, v.z); O.pal.quaternion.copy(q);
    } else { O.pal.position.set(s.palX, s.palY, 0); O.pal.quaternion.identity(); }
    const gp = cart ? s.x : R.XB - R.XD + s.x;
    const d = Math.max(0, Math.min(M_SB, M_SB - gp)), lenR = 20 + M_SB - d, XF = R.XD - 20;
    for (const sh of O.shocks) { sh.rod.scale.x = lenR; sh.rod.position.x = XF + lenR / 2; sh.cap.position.x = XF + lenR + 5; }
    O.chainDir = s.chain;
  }
  function frame(dt, vt) {
    if (O.chainDir) for (const c of chainTex) c.tex.offset.x -= O.chainDir * dt * vt * 1000 / c.pitch;
    if (selBox) selBox.update();
    controls.update(); renderer.render(scene, camera);
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part && h.object.visible && isVisible(h.object));
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    selBox = new THREE.BoxHelper(hit.object, 0xff2a2a); scene.add(selBox);
    if (onPick) onPick(hit.object.userData.part);
  });
  function isVisible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; }
  return {
    build(R, M, A) { M_SB = M.sb; build(R, M, A); setLabels(true); }, update, fit, frame,
    setLabels, setCurtain(on) { if (O.curtain) O.curtain.visible = on; },
    onPick(fn) { onPick = fn; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    canvas: renderer.domElement,
  };
  function setLabels(on) { labels.forEach((l) => { l.visible = on; }); }
}

/* ------------------------------------------------------------------ 2D drawings */
function sideSVG(R, M, A) {
  const W = 780, Hh = 560, x0 = -A.r - 330, x1 = R.XB + R.lA + 120, sc = Math.min((W - 90) / (x1 - x0), (Hh - 60) / 1900);
  const X = (x) => 20 + (x - x0) * sc, Y = (y) => Hh - 30 - y * sc;
  const rect = (xa, ya, xb, yb, cls, extra = "") => `<rect x="${X(Math.min(xa, xb))}" y="${Y(Math.max(ya, yb))}" width="${Math.abs(xb - xa) * sc}" height="${Math.abs(yb - ya) * sc}" class="${cls}" ${extra}/>`;
  const dimV = (x, ya, yb, t, left) => `<line x1="${X(x)}" y1="${Y(ya)}" x2="${X(x)}" y2="${Y(yb)}" class="mx-dim" marker-start="url(#mxa)" marker-end="url(#mxa)"/>
      <text x="${X(x) + (left ? -5 : 5)}" y="${(Y(ya) + Y(yb)) / 2 + 4}" class="apc-t ${left ? "r" : ""}">${t}</text>`;
  const dimH = (y, xa, xb, t) => `<line x1="${X(xa)}" y1="${Y(y)}" x2="${X(xb)}" y2="${Y(y)}" class="mx-dim" marker-start="url(#mxa)" marker-end="url(#mxa)"/>
      <text x="${(X(xa) + X(xb)) / 2}" y="${Y(y) - 5}" class="apc-t c">${t}</text>`;
  const a = A.a, tp = R.tp, yArmTop = H0 - 5;
  let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Interface drawing, side view">
    <defs><marker id="mxa" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="currentColor"/></marker></defs>`;
  g += `<line x1="10" y1="${Y(0)}" x2="${W - 10}" y2="${Y(0)}" class="mx-floor"/>`;
  // APC
  g += rect(-A.r - (A.dm + 260) / 2, 0, -A.r + (A.dm + 260) / 2, yArmTop - A.secH - 230, "mx-apc");
  g += rect(-A.r - 14, yArmTop, -A.r + 14, yArmTop + 950, "mx-wall");
  g += rect(-A.r - (A.r - a / 2 - 90), yArmTop - A.secH, -a / 2 - 40, yArmTop, "mx-arm");
  g += rect(-a / 2 - 40, H0 - 50, a / 2, H0 - 5, "mx-arm", 'opacity=".55"');
  g += `<text x="${X(-A.r)}" y="${Y(yArmTop + 980)}" class="apc-t c">APC axis · wall</text>`;
  // machine side pallet
  g += rect(-2 * A.r - a / 2, H0, -2 * A.r + a / 2, H0 + tp, "mx-pal", 'opacity=".5"');
  // station
  for (const lx of [-80, 150]) g += rect(lx - 35, 0, lx + 35, 870, "mx-st");
  g += rect(-280, 870, 270, 920, "mx-st");
  for (const x of [-A.pitch / 2, A.pitch / 2]) { g += rect(x - 35, 920, x + 35, H0 - 30, "mx-st"); g += rect(x - RREC, H0 - 30, x + RREC, H0, "mx-rec"); }
  g += rect(-a / 2 + 10, R.Hlow - 62, a / 2 + 20, R.Hlow, "mx-lift");
  g += rect(-a / 2 + 10, R.Ht - 62, a / 2 + 20, R.Ht, "mx-ghost");
  g += rect(-276, H0 - 160, -251, H0 - 20, "mx-stop") + rect(-276, R.Ht + 30 - 140, -251, R.Ht + 30, "mx-ghost");
  // docking post
  g += rect(R.XD - 20 - 75, 0, R.XD - 20, 480, "mx-st");
  g += rect(R.XD - 20, M.hb - 45, R.XD, M.hb + 45, "mx-pu");
  g += `<path d="M${X(R.XD - 20)},${Y(M.hb + M.dp / 2)} h${60 * sc} l${10 * sc},${M.dp / 2 * sc} l${-10 * sc},${M.dp / 2 * sc} h${-60 * sc} z" class="mx-rec"/>`;
  // pallet at the station (solid) and on the AGV (dashed)
  g += rect(-a / 2, H0, a / 2, H0 + tp, "mx-pal");
  const th = Math.min(700, Math.max(300, A.hc * 2.2)), tw = Math.min(a, A.b) * 0.6;
  g += rect(-tw * 0.3, H0 + tp, tw * 0.3, H0 + tp + th, "mx-fix");
  g += rect(R.L - a / 2, R.Ht, R.L + a / 2, R.Ht + tp, "mx-ghost") + rect(R.L - tw * 0.3, R.Ht + tp, R.L + tw * 0.3, R.Ht + tp + th, "mx-ghost");
  g += `<circle cx="${X(0)}" cy="${Y(H0 + R.hg)}" r="5" class="mx-cog"/><text x="${X(0) + 8}" y="${Y(H0 + R.hg) + 4}" class="apc-t">CoG</text>`;
  // AGV
  g += rect(R.XB, 50, R.XB + R.lA, 350, "mx-agv");
  for (const x of [110, R.lA - 110]) g += `<circle cx="${X(R.XB + x)}" cy="${Y(75)}" r="${75 * sc}" class="mx-wheel"/>`;
  g += rect(R.xPost - 30, 0, R.xPost + 30, R.Ht + 100, "mx-st", 'opacity=".45"') + rect(R.xPost - 30, R.Ht + 40, R.xPin + 60, R.Ht + 70, "mx-st");
  g += `<path d="M${X(R.xPin - M.dpn / 2)},${Y(R.Ht + 40)} V${Y(R.Ht + 10)} L${X(R.xPin - 4)},${Y(R.Ht + 10 - R.lcone)} H${X(R.xPin + 4)} L${X(R.xPin + M.dpn / 2)},${Y(R.Ht + 10)} V${Y(R.Ht + 40)} z" class="mx-rec"/>`;
  g += rect(R.xPin - 40, R.Ht + 10, R.xPin + 40, R.Ht + 40, "mx-agvd", 'opacity=".6"');
  g += `<text x="${X(R.xPin + 70)}" y="${Y(R.Ht + 75)}" class="apc-t">cone pin + stop face</text>`;
  g += rect(R.L - (a + 40) / 2, R.Ht - 86, R.L + (a + 40) / 2, R.Ht, "mx-agvd");
  g += rect(R.L - (a + 40) / 2, M.hdrive - 86, R.L + (a + 40) / 2, M.hdrive, "mx-ghost");
  g += `<text x="${X(R.XB + R.lA / 2)}" y="${Y(200) + 4}" class="apc-t c">AGV (stops ±${M.nav})</text>`;
  g += `<text x="${X(0)}" y="${Y(450)}" class="apc-t c">station table</text>`;
  // dimensions
  const xr = R.XB + R.lA + 40;
  g += dimV(xr, 0, R.Ht, `transfer ${R.Ht}`) + dimV(xr - 140, 0, M.hdrive, `driving ${M.hdrive}`, true);
  g += dimV(-A.r - (A.dm + 260) / 2 - 30, 0, H0, `H0 ${H0}`);
  g += dimV(a / 2 + 45, R.Hlow, R.Ht, `stroke ${R.st}`);
  g += dimV(R.XD - 130, 0, M.hb, `buffers ${M.hb}`, true);
  g += dimH(R.Ht + tp + th + 90, 0, R.L, `pallet travel L = ${R.L}`);
  g += dimH(R.Ht - 140, a / 2 + 20, a / 2 + 20 + M.gap, `gap ${M.gap}`);
  g += dimH(600, 0, R.XB, `AGV stop ${R.XB} ±${M.nav}`);
  g += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(0)}" y2="${Y(1900)}" class="mx-axis"/><text x="${X(0) + 4}" y="${Y(1880)}" class="apc-t">station centre</text>`;
  return g + `</svg>`;
}

function planSVG(R, M, A) {
  const W = 780, Hh = 520, x0 = -A.r - 380, x1 = R.XD + 1400, zr = Math.max(R.Rsw + 40, R.wA / 2 + 120), sc = Math.min((W - 40) / (x1 - x0), (Hh - 30) / (2 * zr));
  const X = (x) => 20 + (x - x0) * sc, Z = (z) => Hh / 2 + z * sc;
  const rect = (xa, za, xb, zb, cls, extra = "") => `<rect x="${X(Math.min(xa, xb))}" y="${Z(Math.min(za, zb))}" width="${Math.abs(xb - xa) * sc}" height="${Math.abs(zb - za) * sc}" class="${cls}" ${extra}/>`;
  const a = A.a, b = A.b;
  let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Interface drawing, plan view">
    <defs><marker id="mxb" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="currentColor"/></marker></defs>`;
  g += `<circle cx="${X(-A.r)}" cy="${Z(0)}" r="${R.Rsw * sc}" class="mx-swing"/><text x="${X(-A.r)}" y="${Z(-R.Rsw) + 14}" class="apc-t c">APC swing circle Ø${f(A.swing, 0)}</text>`;
  g += rect(-A.r - 7, -(A.swing - 40) / 2, -A.r + 7, (A.swing - 40) / 2, "mx-wall");
  g += rect(-A.r - (A.r - a / 2 - 90), -A.secB / 2, A.r - a / 2 - 90 - A.r, A.secB / 2, "mx-arm");
  for (const sz of [1, -1]) g += rect(-a / 2 - 40, sz * (b / 2 - 10), a / 2, sz * (b / 2 + 35), "mx-arm", 'opacity=".55"');
  g += rect(-a / 2, -b / 2, a / 2, b / 2, "mx-pal", 'opacity=".35"');
  for (const sz of [1, -1]) g += rect(-a / 2 + 10, sz * R.zc - 20, a / 2 + 20, sz * R.zc + 20, "mx-lift");
  for (const i of [1, -1]) for (const j of [1, -1]) g += `<circle cx="${X(i * A.pitch / 2)}" cy="${Z(j * A.pitch / 2)}" r="${RREC * sc}" class="mx-rec"/>`;
  g += rect(-276, -45, -251, 45, "mx-stop");
  // docking post, pin, shock absorbers
  g += rect(R.XD - 20 - 15, -310, R.XD - 20, 310, "mx-st");
  for (const sz of [1, -1]) { g += rect(R.XD - 20, sz * 190 - 10, R.XD + M.sb, sz * 190 + 10, "mx-pu"); g += rect(R.XD - 20, sz * 100 - 45, R.XD, sz * 100 + 45, "mx-pu"); }
  g += rect(R.XD - 20, -M.dp / 2, R.XD + 45, M.dp / 2, "mx-rec");
  // funnel
  const wi = R.wi, X0 = R.XD + 50;
  for (const sz of [1, -1]) g += `<polyline points="${X(X0)},${Z(sz * wi)} ${X(X0 + 600)},${Z(sz * wi)} ${X(X0 + 1300)},${Z(sz * (wi + 50))}" class="mx-funnel"/>`;
  // AGV (nominal stop, ± error band) + deck + pallet ghost
  g += rect(R.XB, -R.wA / 2, R.XB + R.lA, R.wA / 2, "mx-agv", 'opacity=".55"');
  g += rect(R.XB - M.nav, -R.wA / 2 - M.nav, R.XB + R.lA + M.nav, R.wA / 2 + M.nav, "mx-ghost");
  // docking brackets + cone pins
  for (const sz of [1, -1]) {
    g += rect(R.xPost - 30, sz * R.zPost - 30, R.xPost + 30, sz * R.zPost + 30, "mx-st");
    g += rect(R.xPost - 30, sz * R.zPin - 35, R.xPin + 60, sz * R.zPin + 35, "mx-st", 'opacity=".5"');
    g += `<circle cx="${X(R.xPin)}" cy="${Z(sz * R.zPin)}" r="${Math.max(3, M.dpn / 2 * sc)}" class="mx-rec"/>`;
  }
  g += `<text x="${X(R.xPin + 80)}" y="${Z(-R.zPost) - 8}" class="apc-t">docking bracket + cone pin (round / diamond)</text>`;
  for (const sz of [1, -1]) g += rect(R.L - (a + 40) / 2, sz * R.zc - 8, R.L + (a + 40) / 2, sz * R.zc + 8, "mx-lift");
  for (const sz of [1, -1]) g += rect(R.L - (a + 40) / 2, sz * (b / 2 + 37) - 10, R.L + (a + 40) / 2, sz * (b / 2 + 37) + 10, "mx-agvd");
  g += rect(R.L - a / 2, -b / 2, R.L + a / 2, b / 2, "mx-ghost");
  // light curtain
  g += `<line x1="${X(a / 2 + 30)}" y1="${Z(-(R.zPost + 70))}" x2="${X(a / 2 + 30)}" y2="${Z(R.zPost + 70)}" class="apc-lc"/>`;
  // dimensions
  const dz = (x, za, zb, t) => `<line x1="${X(x)}" y1="${Z(za)}" x2="${X(x)}" y2="${Z(zb)}" class="mx-dim" marker-start="url(#mxb)" marker-end="url(#mxb)"/><text x="${X(x) + 5}" y="${(Z(za) + Z(zb)) / 2 + 4}" class="apc-t">${t}</text>`;
  g += dz(a / 2 + 70, -R.zc, R.zc, `strands ${2 * R.zc}`);
  g += dz(A.pitch / 2 + 60, -A.pitch / 2, A.pitch / 2, ``);
  g += `<text x="${X(A.pitch / 2 + 40)}" y="${Z(A.pitch / 2) + 18}" class="apc-t">studs ${A.pitch}</text>`;
  g += `<line x1="${X(R.XD + 1340)}" y1="${Z(-(wi + 50))}" x2="${X(R.XD + 1340)}" y2="${Z(wi + 50)}" class="mx-dim" marker-start="url(#mxb)" marker-end="url(#mxb)"/><text x="${X(R.XD + 1330)}" y="${Z(wi + 50) + 16}" class="apc-t r">funnel ${2 * wi + 100} → ${2 * wi}</text>`;
  g += `<text x="${X(R.XB + R.lA / 2)}" y="${Z(R.wA / 2) + 24}" class="apc-t c">AGV stops ±${M.nav} mm (dashed band)</text>`;
  g += `<text x="${X(0)}" y="${Z(b / 2) + 26}" class="apc-t c">load station</text>`;
  g += `<text x="${X(a / 2 + 30)}" y="${Z(R.zPost + 70) + 14}" class="apc-t c">light curtain</text>`;
  return g + `</svg>`;
}

function sigSVG(ST, s, veh, task) {
  const T = []; let acc = 0; ST.forEach((r) => { T.push(acc); acc += r[2]; });
  const tot = acc, at = (n) => T[ST.findIndex((r) => r[0] === n)], dur = (n) => ST.find((r) => r[0] === n)[2];
  const del = task === "deliver", cart = veh === "cart";
  const hs = at("deck") + dur("deck") - 1.5;
  const rows = [];
  if (!cart) {
    rows.push(["VALID", "AGV", [[hs, at("away") + 1]]], ["CS_0", "AGV", [[hs, at("away") + 1]]],
      [del ? "L_REQ" : "U_REQ", "station", [[hs + 0.3, del ? at("away") - 0.3 : at("low") + 0.2]]],
      ["TR_REQ", "AGV", [[hs + 0.6, at("away") + 1]]], ["READY", "station", [[at("move"), at("away") + 0.6]]],
      ["BUSY", "AGV", [[at("move") + 0.2, at("away")]]], ["COMPT", "AGV", [[at("away") + 0.2, at("away") + 1]]],
      ["HO_AVBL", "station", [[0, tot]]], ["ES (no E-stop)", "station", [[0, tot]]]);
  } else rows.push(["S1 transfer button", "operator", [[at("deck") + 0.3, at("deck") + 1.2]]], ["B12 latch closed", "cart", [[at("dock") + 1, at("away") + 0.5]]]);
  if (!cart) rows.push(["B14 deck lock pin closed", "AGV", [[0, at("dock") + 0.6], [at("away") + dur("away") * 0.75, tot]]],
    ["B13 deck on the pins", "station", [[at("deck") + dur("deck") - 1.6, at("away") + 0.6]]]);
  rows.push([cart ? "B11 cart docked" : "B11 AGV in position", "station", [[at("dock") + dur("dock") * (cart ? 0.9 : 0.1), at("away") + 0.3]]],
    ["B21 chains up", "station", [[at("move"), at("low") + 0.15]]],
    ...(del ? [["B22 stop up", "station", [[at("lift") + dur("lift") * 0.9, at("away") + 0.5]]], ["B23 pallet at stop", "station", [[at("low") - 0.3, at("away") + 0.5]]]] : []),
    ["B24 pallet seated (4×)", "station", del ? [[at("low") + dur("low") - 0.6, tot]] : [[0, at("lift") + 0.3]]],
    ["M1 chains run", "station", [[at("move"), at("low")]]],
    ["APC may rotate", "PLC", del ? [[0, at("lift")], [at("away") + 0.6, tot]] : [[0, at("lift")], [at("low") + dur("low"), tot]]]);
  const W = 760, rh = 19, lw = 170, H = rows.length * rh + 34, sx = (W - lw - 14) / tot;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Handshake signals">`;
  ST.forEach((r, i) => { g += `<rect x="${lw + T[i] * sx}" y="0" width="${r[2] * sx}" height="${H - 18}" class="${i % 2 ? "mx-band" : "mx-band2"}"/><text x="${lw + (T[i] + r[2] / 2) * sx}" y="${H - 5}" class="apc-t c">${i + 1}</text>`; });
  rows.forEach(([n, who, on], i) => {
    const y = i * rh + 6, hi = y + 3, lo = y + rh - 5;
    let d = `M${lw},${lo}`;
    for (const [t0, t1] of on) d += ` H${lw + Math.max(0, t0) * sx} V${hi} H${lw + Math.min(tot, t1) * sx} V${lo}`;
    d += ` H${W - 14}`;
    const cls = n.startsWith("APC") ? "mx-sig apc" : who === "AGV" || who === "cart" || who === "operator" ? "mx-sig agv" : "mx-sig st";
    g += `<text x="4" y="${lo}" class="apc-t">${n}</text><text x="${lw - 6}" y="${lo}" class="apc-t r" style="opacity:.6">${who}</text><path d="${d}" class="${cls}"/>`;
  });
  g += `<line x1="${lw + s.t * sx}" y1="0" x2="${lw + s.t * sx}" y2="${H - 18}" class="apc-head"/>`;
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const pane = $("tab-mech");
if (pane) {
  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("mechState") || "{}")); } catch (e) { /* private window */ }
  let A = apcData(), R = calc(M, A), veh = "agv", task = "deliver", ST = steps(R, M, veh, task), T = 0, playing = false, last = performance.now();
  let view = null, raf = 0, geo = "";
  const tot = () => ST.reduce((s, r) => s + r[2], 0);
  const cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };

  function inputs() {
    $("mxInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("") +
      `<p class="hint">Pallet data (size ${A.a} × ${A.b} mm, ${A.mp} + ${A.mw} kg, module pitch ${A.pitch} mm, APC radius ${A.r} mm, APC lift ${A.s} mm, oil ${A.p} MPa) come from the <b>Pallet changer</b> tab.</p>`;
  }
  function checks() {
    const c = [];
    const add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Chain strength", R.ch.SF >= 10, R.ch.SF >= 7, `${R.ch.id}: safety ${f(R.ch.SF, 0)} on the breaking load (≥ 10)`);
    add("Chain roller load", R.ch.Frl <= R.ch.Fr, R.ch.Frl <= R.ch.Fr * 1.2, `${f(R.ch.Frl, 0)} N per roller incl. impact (allowed ${R.ch.Fr} N)`);
    add("Room for the chain strands", R.zc >= 60, R.zc >= 40, `strands at ±${R.zc} mm, ${R.side} the pull studs`);
    add("Pallet does not slip on the chains", R.SFslip >= 2, R.SFslip >= 1.3, `μ·g / a = ${f(R.SFslip, 1)} (≥ 2)`);
    add("Pallet does not tip at the transfer", R.SFtip >= 3, R.SFtip >= 2, `safety ${f(R.SFtip, 0)} (CoG ${f(R.hg, 0)} mm high)`);
    add("Float range ≥ AGV error", M.fl >= R.cap + 2, M.fl >= R.cap, `float ±${M.fl} mm, AGV error at the pins ±${f(R.cap, 1)} mm (stop ±${M.nav} + angle ${f(R.dYaw, 1)})`);
    add("Cone pins catch the AGV error", R.lcone <= 80, R.lcone <= 110, `lead-in ±${R.lead} mm → cone length ${f(R.lcone, 0)} mm`);
    add("Lift force engages the cone pins", R.Fv <= 0.5 * M.fpre, R.Fv <= M.fpre, `${f(R.Fv, 0)} N needed, deck pushes ${M.fpre} N`);
    add("Lock pin re-centres the deck", R.xres < M.fl, R.xres < M.fl * 1.5, `springs alone leave ±${f(R.xres, 1)} mm (friction) → conical lock pin, lead-in ±${M.fl} mm`);
    add("Height step (deck on the stop faces)", R.hWC[2] <= M.step, R.hRSS[2] <= M.step, `worst case ±${f(R.hWC[2], 1)} mm (a fixed deck would be ±${f(R.hWC[0], 1)})`);
    add("Docking brackets outside the APC swing circle", R.pinClr >= 10, R.pinClr >= 0, `clearance ${f(R.pinClr, 0)} mm`);
    add("Guide rails do not touch the AGV normally", true, true, `clearance ${M.nav + 10} mm per side (they protect, they do not centre)`);
    add("Receivers catch the pallet after transfer", R.zWC <= 3, R.zWC <= 4, `z error ±${f(R.zWC, 2)} mm, receiver lead-in ±3 mm`);
    add("APC rails over the receivers (rotating)", R.clrRec >= 5, R.clrRec >= 2, `clearance ${R.clrRec} mm (APC stroke ${A.s} mm)`);
    add("APC rails over the lowered station chains", R.clrChain >= 10, R.clrChain >= 5, `clearance ${R.clrChain} mm`);
    add("APC lift lifts the studs out of the receivers", R.studLift >= 5, R.studLift >= 2, `stud bottom ${R.studLift} mm above the receiver when lifted`);
    add("AGV deck outside the APC swing circle", R.swingClr >= 10, R.swingClr >= 0, `clearance ${f(R.swingClr, 0)} mm`);
    add("AGV stable at an emergency stop", R.SFagv >= 2, R.SFagv >= 1.5, `safety ${f(R.SFagv, 1)} (CoG ${f(R.hCOG, 0)} mm, driving height ${M.hdrive} mm)`);
    add("Pallet stays on the AGV (pawl)", R.SFpal >= 2, R.SFpal >= 1.5, `tipping safety ${f(R.SFpal, 1)}, pawl ${f(R.Fpawl / 1000, 2)} kN`);
    add("Floor anchors", R.uAnc <= 0.8, R.uAnc <= 1, `${f(R.uAnc * 100, 0)} % of the allowed load`);
    add("Cart docking pin", R.sigPin <= 200, R.sigPin <= 260, `bending ${f(R.sigPin, 0)} N/mm²`);
    add("Manual cart stability", R.SFcart >= 2, R.SFcart >= 1.5, `safety ${f(R.SFcart, 1)} at ${M.ac} m/s² (CoG ${f(R.hCart, 0)} mm)`);
    add("Manual push force", R.Fpush <= 200, R.Fpush <= 300, `${f(R.Fpush, 0)} N (ergonomic ≤ 200 N)`);
    const Q = A.Q;
    add("Oil flow from the APC hydraulic unit", Q == null || R.Ql <= Q, true, Q == null ? `${f(R.Ql, 1)} L/min` : `${f(R.Ql, 1)} L/min needed, APC pump ${f(Q, 1)} L/min (not at the same time as the APC lift)`);
    const tex = 2 * tot() + 2 * M.dpool / M.vagv + 2 * M.tpool;
    add("Pallet exchange faster than machining", tex <= 0.5 * M.tcyc, tex <= M.tcyc, `exchange ${f(tex, 0)} s vs machining ${M.tcyc} s per pallet`);
    R.tex = tex;
    return c;
  }
  function blk(title, rows, note) { return `<div class="apc-blk"><h3>${title}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`; }
  function formulas() {
    const c = R.ch;
    $("mxCalc").innerHTML = [
      blk("1 · Heights", [
        `Receiver top       H0 = ${H0} mm (= machine receiver)`,
        `Transfer height    Ht = H0 + stud ${LS} + clearance ${M.clr} = <b>${R.Ht} mm</b>`,
        `Chains lowered     H0 − ${M.clr} = ${R.Hlow} mm`,
        `Lift stroke        s = Ht − ${R.Hlow} = <b>${R.st} mm</b>`,
        `Pallet CoG         h = (mp·tp/2 + mw·(tp+hc)) / m = <b>${f(R.hg, 0)} mm</b> above the pallet bottom`]),
      blk("2 · Chain pull and drive", [
        `Mass               m = ${A.mp} + ${A.mw} = ${R.mpl} kg,  W = m·g = ${f(R.W, 0)} N`,
        `Pull               F = m·(μ·g + a) = ${R.mpl}·(${M.mu}·9.81 + ${M.at}) ≈ <b>${f(c.Ft, 0)} N</b>`,
        `Per strand         F/2 · 1.2 (uneven) = ${f(c.Fs, 0)} N → safety ${f(c.Fb * 1000, 0)} / (${f(c.Fs, 0)}·1.5) = <b>${f(c.SF, 0)}</b>`,
        `Sprocket           d0 = p / sin(180°/z) = ${c.p} / sin(${f(180 / M.zs, 1)}°) = ${f(R.d0, 1)} mm`,
        `Speed / torque     n = v·60/(π·d0) = <b>${f(R.nOut, 0)} rpm</b>,  T = F·d0/2 = <b>${f(R.Tout, 1)} N·m</b>`,
        `Motor              P = F·v/η = ${f(c.Ft, 0)}·${M.vt}/0.8 = ${f(R.Pm, 0)} W → <b>${R.motor} kW</b> (×1.3)`]),
      blk("3 · Transfer", [
        `Travel             L = a + 40 + gap = <b>${R.L} mm</b>`,
        `Time               t = L/v + v/a (+ creep) = <b>${f(R.ttr, 1)} s</b>`,
        `No slip            μs·g/a = ${M.mus}·9.81/${M.at} = <b>${f(R.SFslip, 1)}</b>`,
        `No tipping         (a/2 ÷ h) ÷ (acc/g) = (${A.a / 2}/${f(R.hg, 0)}) ÷ (${M.at}/9.81) = <b>${f(R.SFtip, 0)}</b>`,
        `Stop force         m·v²/(2·3 mm) + μs·W = <b>${f(R.Fstop, 0)} N</b>`]),
      blk("4 · Station lift cylinder", [
        `Force              F = (m + m_frame)·g·1.25 = (${R.mpl} + ${M.mlf})·9.81·1.25 = <b>${f(R.Fl, 0)} N</b>`,
        `Bore               D = √(4F/(π·p)) = √(4·${f(R.Fl, 0)}/(π·${A.p})) = ${f(R.Dreq, 1)} → <b>Ø${R.D}/${R.rod}</b>`,
        `Flow               Q = A·s/t = ${f(R.Acyl, 0)}·${R.st}/${M.tl} → <b>${f(R.Ql, 1)} L/min</b>`]),
      blk("5 · Safety buffers + cart pin", [
        `Mass               m = AGV ${M.mv} + pallet ${R.mpl} = ${R.mt} kg`,
        `Cart / creep       E = ½·m·v² = ½·${R.mt}·${M.vd}² = <b>${f(R.Ed, 1)} J</b>`,
        `Fault (too fast)   E = ½·${R.mt}·${M.vnav}² = <b>${f(R.Ef, 0)} J</b> → 2 × ${R.shock.id} (${R.shock.E} J)`,
        `Peak force         F = (E/2)/(0.85·stroke) = <b>${f(R.Fpk / 1000, 2)} kN</b> per absorber`,
        `Anchors            N = F·h/(lever·n/3) = ${f(R.Nanc / 1000, 2)} kN, V = F/n = ${f(R.Vanc / 1000, 2)} kN`,
        `Cart pin           σ = 32·F·l/(π·d³) = 32·${f(R.Flat, 0)}·${R.lp}/(π·${M.dp}³) = <b>${f(R.sigPin, 0)} N/mm²</b>`]),
      blk("6 · Stability", [
        `AGV CoG (driving)  h = ${f(R.hCOG, 0)} mm, lever to front wheels ${f(R.lever, 0)} mm`,
        `AGV tipping        (lever/h·g) / a_brake = <b>${f(R.SFagv, 1)}</b>`,
        `Pallet on AGV      (a/2 ÷ h) ÷ (a_brake/g) = <b>${f(R.SFpal, 1)}</b>, pawl ${f(R.Fpawl, 0)} N`,
        `Manual cart        CoG ${f(R.hCart, 0)} mm → (lc/2 ÷ h · g) / a = <b>${f(R.SFcart, 1)}</b>`]),
      blk(`8 · AGV stops only ±${M.nav} mm – floating deck`, [
        `Error at the pins  e = nav + z_pin·sin(yaw) = ${M.nav} + ${R.zPin}·sin(${M.yaw}°) = <b>${f(R.cap, 1)} mm</b>`,
        `Cone lead-in       r ≥ e + 2 → ±${R.lead} mm, length r / tan 15° = <b>${f(R.lcone, 0)} mm</b>`,
        `Rigid pin (no!)    F = μ_tyre·m·g = ${M.mut}·${R.mt}·9.81 = <b>${f(R.Fscrub, 0)} N</b>`,
        `Floating deck      F = μ_ball·(m_deck + m)·g + k·e = ${M.mub}·${M.mdk + R.mpl}·9.81 + ${M.ksp}·${f(R.cap, 1)} = <b>${f(R.Ffloat, 0)} N</b>`,
        `Push on the cone   Fv = F·(tan15° + μ)/(1 − μ·tan15°) = <b>${f(R.Fv, 0)} N</b> (deck pushes ${M.fpre} N)`,
        `→ ${f(R.Fscrub / R.Ffloat, 0)} × less force than pushing the AGV`,
        `Spring return      x = F_friction / k = ${f(R.Ffric, 0)} / ${M.ksp} = ${f(R.xres, 1)} mm → conical lock pin`],
        "Do not move the AGV – move only the light deck, with low friction, and let fixed station parts (cone pins + stop faces) decide the position."),
      blk("7 · Cell timing", [
        `One docking cycle  ${f(tot(), 1)} s (see the steps)`,
        `Exchange           2 dockings + 2 × ${M.dpool} m / ${M.vagv} m/s + 2 × ${M.tpool} s = <b>${f(R.tex, 0)} s</b>`,
        `Machining          ${M.tcyc} s per pallet → AGV busy ${f(R.tex / M.tcyc * 100, 0)} % for this cell`]),
    ].join("");
  }
  function accHTML() {
    const rows = [
      ["Rigid pin on the AGV body (first idea)", "funnel + pin push the whole AGV sideways",
        `${f(R.Fscrub / 1000, 1)} kN (tyres: ${M.mut} × ${R.mt} kg × g); pin bending ${f(R.sigScrub, 0)} N/mm²; differential-drive wheels cannot slide sideways → AGV jams or tyres scrub`, "±0.3 mm – only if it works", "bad", "fine for the MANUAL CART (castors move sideways) – kept for the cart"],
      ["Better AGV navigation (reflector / camera fine positioning, omni wheels)", "the AGV corrects itself", "–", "±1–3 mm", "warn", "expensive, sensitive to floor dirt – still not ±0.5 mm"],
      ["Sensors + servo X-Y table on the deck", "camera measures the offset, 2 servo axes shift the deck", "small", "±0.3–0.5 mm", "warn", "works, but 2 extra axes, sensors, software and power on every AGV"],
      ["Floating deck + lift docking on 2 cone pins (chosen)", `AGV stops anywhere within ±${M.nav} mm; deck floats on ball transfer units; lifting pushes it onto 2 cone pins; deck presses against machined stop faces`,
        `${f(R.Ffloat, 0)} N sideways, ${f(R.Fv, 0)} N push-up on the cones (${f(R.Fscrub / R.Ffloat, 0)} × less)`, `±${f(R.zWC, 2)} mm sideways, ±${f(R.hWC[2], 1)} mm height`, "ok", "passive – no sensor, no extra drive; common practice for AGV transfer stations"],
      ["Floating transfer unit on the station", "station chains float and dock to the AGV", "small", "good", "warn", "possible, but the station must stay exact to the APC receivers – not chosen"]];
    const ic = { ok: "✓", warn: "!", bad: "✕" };
    $("mxAcc").innerHTML = `<p class="intro">An AGV stops only <b>±${M.nav} mm</b> and <b>±${M.yaw}°</b> accurate (at the docking pins that is up to ±${f(R.cap, 1)} mm).
      The chain transfer needs about <b>±1 mm</b> sideways and a height step of max. <b>±${M.step} mm</b>. The AGV itself cannot be pushed into position: its drive wheels do not slide sideways,
      and pushing a ${R.mt} kg vehicle needs ≈ ${f(R.Fscrub / 1000, 1)} kN. <b>Solution: leave the AGV body where it stopped and let only the light deck float.</b>
      While the deck lifts, two cone pins on the station push it into position, and machined stop faces on the station set its height.</p>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th></th><th>Concept</th><th>How</th><th>Force to correct ±${f(R.cap, 0)} mm</th><th>Result</th><th>Note</th></tr></thead><tbody>
      ${rows.map(([n, h, F, r, st, no]) => `<tr><td><span class="apc-chk ${cls[st]}" style="border:0;padding:0;display:inline"><b>${ic[st]}</b></span></td><td><b>${esc(n)}</b></td><td>${esc(h)}</td><td>${esc(F)}</td><td>${esc(r)}</td><td class="muted">${esc(no)}</td></tr>`).join("")}
      </tbody></table></div>`;
  }
  function accSVG(s) {
    const W = 760, Hh = 560, EX = 5, cart = veh === "cart";
    if (cart) return `<p class="hint" style="padding:20px">The manual cart is pushed by hand: its castors can move sideways, so the funnel rails and the docking pin centre it directly. Choose <b>AGV</b> to see the floating deck.</p>`;
    const b = R.A.b, dy = s.deck, y0 = 300, y1 = R.Ht + 140, zr = R.zPost + 100, sc = Math.min((W - 40) / (2 * zr), (Hh - 40) / (y1 - y0));
    const X = (z) => W / 2 - z * sc, Y = (y) => Hh - 20 - (y - y0) * sc;
    const rz = (za, zb, ya, yb, cls, ex = "") => `<rect x="${Math.min(X(za), X(zb))}" y="${Y(Math.max(ya, yb))}" width="${Math.abs(zb - za) * sc}" height="${Math.abs(yb - ya) * sc}" class="${cls}" ${ex}/>`;
    const bz = (s.z || 0) * EX, dz = (s.z || 0) * (1 - s.e) * EX;
    let g = `<svg viewBox="0 0 ${W} ${Hh}" class="apc-svg" aria-label="Floating deck and cone pins, front view">`;
    // station brackets + cone pins
    for (const sz of [1, -1]) {
      g += rz(sz * R.zPost - 30, sz * R.zPost + 30, y0, R.Ht + 100, "mx-st");
      g += rz(sz * (R.zPin - 40), sz * (R.zPost + 30), R.Ht + 40, R.Ht + 70, "mx-st");
      const zp = sz * R.zPin, r = M.dpn / 2;
      g += `<path d="M${X(zp - r)},${Y(R.Ht + 40)} V${Y(R.Ht + 10)} L${X(zp - 4)},${Y(R.Ht + 10 - R.lcone)} H${X(zp + 4)} L${X(zp + r)},${Y(R.Ht + 10)} V${Y(R.Ht + 40)} z" class="mx-rec"/>`;
      g += `<line x1="${X(zp - 40)}" y1="${Y(R.Ht + 40)}" x2="${X(zp + 40)}" y2="${Y(R.Ht + 40)}" class="mx-face"/>`;
    }
    // AGV body + lift columns + lower floating plate (move with the body)
    g += rz(-R.wA / 2 + bz, R.wA / 2 + bz, y0, 350, "mx-agv");
    for (const sz of [1, -1]) g += rz(sz * (b / 2 - 65) + bz, sz * (b / 2 - 15) + bz, 350, dy - 107, "mx-lift");
    g += rz(-(b / 2 - 20) + bz, b / 2 - 20 + bz, dy - 107, dy - 93, "mx-flt");
    g += `<path d="M${X(bz - 16)},${Y(dy - 93)} L${X(bz)},${Y(dy - 70 + (s.e > 0.02 ? -14 : 0))} L${X(bz + 16)},${Y(dy - 93)} z" class="mx-lock"/>`;
    for (const z of [-(b / 2 - 80), -60, 60, b / 2 - 80]) g += `<circle cx="${X(z + (bz + dz) / 2)}" cy="${Y(dy - 89.5)}" r="${Math.max(2.5, 7 * sc)}" class="mx-ball"/>`;
    // centring springs between the body plate tabs and the deck
    for (const sz of [1, -1]) {
      const za = sz * (b / 2 - 10) + bz, zb = sz * (b / 2 + 40) + dz, yy = dy - 100, n = 7;
      let d = `M${X(za)},${Y(yy)}`; for (let i = 1; i <= n; i++) d += ` L${X(za + (zb - za) * i / n)},${Y(yy + (i % 2 ? 9 : -9))}`;
      g += `<path d="${d} L${X(zb)},${Y(yy)}" class="mx-spring"/>`;
    }
    // floating deck: plate, chains, side guides, docking arms with bushes
    g += rz(-(b / 2 + 40) + dz, b / 2 + 40 + dz, dy - 86, dy - 70, "mx-agvd");
    for (const sz of [1, -1]) {
      g += rz(sz * R.zc - 8 + dz, sz * R.zc + 8 + dz, dy - 12, dy, "mx-lift");
      g += rz(sz * 279 + dz, sz * 299 + dz, dy - 20, dy + 30, "mx-agvd");
      const zp = sz * R.zPin + dz, r = M.dpn / 2 + 0.5;
      g += rz(sz * 299 + dz, zp - sz * r, dy + 10, dy + 40, "mx-agvd") + rz(zp + sz * r, zp + sz * 28, dy + 10, dy + 40, "mx-agvd");
    }
    if (s.palOnVeh) {
      const tp = R.tp;
      g += rz(-b / 2 + dz, b / 2 + dz, dy, dy + tp, "mx-pal") + rz(-b * 0.18 + dz, b * 0.18 + dz, dy + tp, Math.min(y1, dy + tp + 260), "mx-fix");
      for (const sz of [1, -1]) g += rz(sz * (b / 2) + dz, sz * (b / 2 + 25) + dz, dy, dy + 20, "mx-pal");
    }
    const T = (x, y, t, a = "") => `<text x="${x}" y="${y}" class="apc-t ${a}">${t}</text>`;
    g += T(X(R.zPin), Y(R.Ht + 80), "cone pin (round)", "c") + T(X(-R.zPin), Y(R.Ht + 80), "cone pin (diamond)", "c");
    g += T(X(0), Y(R.Ht + 120), "machined stop faces = deck height", "c");
    g += T(X(bz), Y(y0 + 15), `AGV body: stopped ${f(s.z || 0, 1)} mm off (drawn ${EX}× larger)`, "c");
    g += T(X(-(b / 2 + 60)), Y(dy - 102), "springs", "") + T(X(0), Y(dy - 120), "ball transfer units + lock pin", "c");
    const st = s.e >= 0.99 ? "deck centred on the pins – chains aligned ±" + f(R.zWC, 1) + " mm" : s.e > 0.01 ? "cones push the deck sideways…" : (s.pawl || ST[s.k][0] === "deck") ? "deck floats free on the balls" : "lock pin closed – deck centred on the AGV";
    g += `<text x="16" y="24" class="apc-t" style="font-size:13px;font-weight:600">${st}</text>`;
    return g + `</svg>`;
  }
  function tolHTML() {
    const t = R.tolH;
    $("mxTol").innerHTML = `<h3>Height (step between AGV chain and station chain) – 3 ways compared</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Contributor</th><th>fixed deck ± mm</th><th>height sensor ± mm</th><th>deck on stop faces ± mm (chosen)</th><th></th></tr></thead><tbody>
      ${t.map((r) => `<tr><td>${esc(r[0])}</td><td>${f(r[1], 1)}</td><td>${f(r[2], 1)}</td><td>${f(r[3], 1)}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}
      <tr><td><b>Worst case (sum)</b></td><td><b>${f(R.hWC[0], 1)}</b></td><td><b>${f(R.hWC[1], 1)}</b></td><td><b>${f(R.hWC[2], 1)}</b></td><td class="muted">allowed ±${M.step} mm</td></tr>
      <tr><td><b>Statistical (RSS = √Σt²)</b></td><td>${f(R.hRSS[0], 1)}</td><td>${f(R.hRSS[1], 1)}</td><td>${f(R.hRSS[2], 1)}</td><td></td></tr></tbody></table></div>
      <p class="hint">A fixed deck (±${f(R.hWC[0], 1)} mm) does not work. A height sensor is borderline (±${f(R.hWC[1], 1)} mm). Pushing the deck against machined stop faces on the station gives ±${f(R.hWC[2], 1)} mm – mechanically, without a sensor.</p>
      <h3>Lateral (z) – each stage catches the error of the stage before</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Stage</th><th>error ± mm</th><th></th></tr></thead><tbody>
      ${R.tolZ.map((r) => `<tr><td>${esc(r[0])}</td><td>${f(r[1], 2)}</td><td class="muted">${esc(r[2])}</td></tr>`).join("")}
      <tr><td><b>Deck chains to station chains (after lift docking)</b></td><td><b>${f(R.zWC, 2)}</b></td><td class="muted">receiver lead-in catches ±3 mm</td></tr>
      <tr><td><b>Pallet seated in the receivers</b></td><td><b>0.02</b></td><td class="muted">stud in bush; final ±0.005 by the zero-point modules in the machine</td></tr></tbody></table></div>`;
  }
  function bom() {
    const c = R.ch;
    const rows = [
      ["Station table, welded + machined", "MAKE", 1, "S355 tube frame, 4 legs, machined receiver pads", "anneal before machining"],
      ["Receiver pedestal", "MAKE", 4, `70×70 tube + plate, top ${H0 - 30} mm`, "machine tops in one setup"],
      ["Locating receiver (bush)", "MAKE", 4, `Ø${2 * RREC}, 16MnCr5 58–62 HRC, 15° lead-in: 1 round, 1 slot, 2 clearance`, "with air nozzle"],
      ["Lift-transfer frame", "MAKE", 1, `2 chain beams at ±${R.zc} mm, 3 cross beams`, ""],
      ["Chain guide strips", "MAKE", 4, `C45 induction hardened, ${A.a + 40} mm`, "2 station + 2 AGV (or by AGV supplier)"],
      ["Roller chain", "BUY", 4, `${c.id}, ${f(2 * (A.a + 40) / 1000 + 0.2, 2)} m per strand`, ""],
      ["Sprockets + shaft + bearings", "BUY / MAKE", 1, `4 × z${M.zs}, shaft 42CrMo4, 4 × flange bearing UCF`, "+ chain tensioner"],
      ["Gear motor with brake + inverter", "BUY", 1, `${R.motor} kW, ${f(R.nOut, 0)} rpm, ${f(R.Tout, 0)} N·m, encoder`, "+ 08B drive chain"],
      ["Guide columns + ball bushings", "BUY", 4, "Ø25 h6, flanged bushings", ""],
      ["Hydraulic lift cylinder", "BUY", 1, `Ø${R.D}/${R.rod} × ${R.st}, ${A.p} MPa, cushioning`, "+ 4/3 valve + throttle on the APC manifold"],
      ["Retractable stop with damper", "BUY", 1, `${f(R.Fstop * 1.5 / 1000, 1)} kN, stroke ${R.Ht + 30 - (H0 - 20)} mm, 2 sensors`, ""],
      ["Docking post + front plate", "MAKE", 1, "S355, anchored separately", ""],
      ["Docking bracket (post + arm, machined stop face)", "MAKE", 2, `posts at z = ±${R.zPost} mm, stop faces at ${R.Ht + 40} mm ±0.1`, "machine with the station chains UP"],
      ["Cone docking pin (1 round, 1 diamond)", "MAKE", 2, `Ø${M.dpn} g6, cone 15°, lead-in ±${R.lead} mm, length ${f(R.lcone, 0)} mm, 16MnCr5 hardened`, "replaceable"],
      ["Floating deck unit (ball transfer units, 4 springs, conical lock pin)", "BUY", 2, `float ±${M.fl} mm / ±1°, ${M.mdk + R.mpl} kg, springs ${M.ksp} N/mm`, "1 per AGV – by the AGV supplier"],
      ["Docking arms with bushes H7 (on the deck)", "MAKE", 4, `Ø${M.dpn} H7 at z = ±${R.zPin} mm, top = chain top + 40 mm`, "2 per AGV, machined with the deck"],
      ["Cart docking pin + bush", "MAKE", 1, `Ø${M.dp} f7 / H8, cone 15°, 16MnCr5 hardened`, "manual cart only"],
      ["Shock absorber", "BUY", 2, `${R.shock.id}, ${R.shock.E} J/stroke, stroke ${M.sb} mm`, ""],
      ["PU end pads 90 Sh A", "BUY", 2, "90×90×20", ""],
      ["Protective guide rails with UHMW-PE strips", "MAKE", 2, `1300 mm, inner ${2 * R.wi} mm (AGV + ${M.nav + 10} mm/side)`, "do not centre the AGV"],
      ["Floor anchors M16 + levelling screws", "BUY", M.na + 8, "bonded anchors (station + post) + M12 for the funnel", ""],
      ["Safety light curtain + muting sensors", "BUY", 1, "type 4, 300–1800 mm", "ISO 13855 / IEC 62046"],
      ["E84 optical I/O pair", "BUY", 1, "IR parallel I/O 8 bit", "1 station + 1 per AGV"],
      ["Sensors (inductive, pressure, photoelectric)", "BUY", 12, "docked, latch, chains up/down, stop up/down, pallet at stop, 4 × seat, deck pallet present", ""],
      ["Operator panel", "BUY / MAKE", 1, "E-stop, AUTO/MANUAL, TRANSFER, lamps", ""],
      ["AGV with lifting chain deck", "BUY", 2, `deck ${M.hdrive}–${R.Ht} mm, strands ±${R.zc}, ${c.id}, side guides, pawl, floating unit, docking arms, E84`, "by the AGV supplier – interface sheet"],
      ["Manual transfer cart", "MAKE", 1, `deck ${R.Ht} mm, free rollers, latch, castors Ø160`, "back-up for AGV failure"],
    ];
    $("mxBom").innerHTML = `<thead><tr><th>#</th><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification (from your inputs)</th><th>Note</th></tr></thead><tbody>${rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r[0])}</td><td><span class="apc-mb ${r[1].split(" ")[0].replace("/", "")}">${esc(r[1])}</span></td><td>${r[2]}</td><td>${esc(r[3])}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}</tbody>`;
  }
  function guide() {
    const c = R.ch;
    const sheet = [
      ["Pallet", `${A.a} × ${A.b} mm, ${R.mpl} kg with load, CoG ${f(R.hg, 0)} mm above the pallet bottom, pull studs ${LS} mm below`],
      ["Transfer direction", "along the pallet ledges (x), AGV comes head-on to the load station"],
      ["Transfer height (chain top)", `${R.Ht} mm ±0.5 (closed loop with the height sensor)`],
      ["Driving height (chain top)", `≤ ${M.hdrive} mm`],
      ["Chain strands", `2 × ${c.id}, centre distance ${2 * R.zc} mm, length ${A.a + 40} mm, speed ${M.vt} m/s, ramps ${f(M.vt / M.at, 2)} s`],
      ["Free space under the pallet", `${2 * R.zc - 40} mm between the strands must stay free to ${R.Ht - LS - 10} mm (studs)`],
      ["Pallet guides on the deck", `side rails over the ledges, inner width ${A.b + 54} mm, retention pawl at the station end, released mechanically by the docking`],
      ["AGV stop", `bumper at ${R.XB} mm from the station centre, ±${M.nav} mm in x and z, ±${M.yaw}° – no contact with the station`],
      ["Floating deck", `deck floats ±${M.fl} mm (x, z) and ±1° on ball transfer units, 4 centring springs, conical lock pin closed while driving`],
      ["Lift docking", `2 arms with bushes Ø${M.dpn} H7 at z = ±${R.zPin} mm, x = ${R.xPin} mm; top faces = deck chain top + 40 mm; deck pushes ${M.fpre} N against the station stop faces (torque limit), creep speed for the last 50 mm`],
      ["Speeds", `slow zone ≤ ${M.vnav} m/s, docking ≤ ${M.vd} m/s; shock absorbers take ${f(R.Ef, 0)} J`],
      ["Handshake", "E84 optical I/O (VALID, CS_0, L_REQ/U_REQ, TR_REQ, READY, BUSY, COMPT, HO_AVBL, ES); transceiver at 760 mm, left side"],
      ["Guide rollers", `4 × Ø60 at 200 mm height (only for protection – guide rails ${2 * R.wi} mm apart)`],
    ];
    $("mxGuide").innerHTML = `
      <h3>1 · Interface sheet – agree this with the AGV supplier before any part is made</h3>
      <div class="table-wrap"><table class="apc-bom"><tbody>${sheet.map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join("")}</tbody></table></div>
      <h3>2 · Make the parts</h3>
      <ol class="apc-list">
        <li><b>Station table:</b> cut tubes, weld in a jig (tack all, then weld crosswise to keep it flat). Anneal 580–620 °C. Machine the 4 receiver pads and the 4 guide-column holes in ONE setup on a boring mill: pads same height ±0.02 mm, column holes ±0.02 mm, perpendicular 0.03/100.</li>
        <li><b>Receivers:</b> turn 16MnCr5, case-harden 0.8–1.2 mm, 58–62 HRC, grind the face and bore. Make 1 round bore (reference), 1 slot along x, 2 with +0.5 mm clearance. Drill the air channel for the seat check.</li>
        <li><b>Lift frame:</b> weld, anneal, machine the chain-guide seats in one setup (±0.1 mm height, ±0.2 mm parallel). Screw + pin the hardened guide strips; chamfer the strip ends 2 × 30°.</li>
        <li><b>Shaft + sprockets:</b> 42CrMo4 shaft, keyways or clamping bushes; mark the tooth position so both sprockets are in phase (the 2 chains must run synchronously).</li>
        <li><b>Docking post:</b> weld, machine the pin bore and the 2 shock-absorber threads in one setup. Pin 16MnCr5 hardened, ground f7, cone 15°.</li>
        <li><b>Funnel rails:</b> flat bar + UHMW-PE strip screwed with countersunk screws (heads 2 mm below the surface). Slotted floor brackets.</li>
        <li><b>Pallet:</b> chamfer all bottom edges 5 mm × 30°; deburr the strand tracks.</li>
        <li><b>Paint:</b> frames RAL 5010 (or your standard), funnel ends and stop yellow/black (ISO 3864), machined faces oiled, not painted.</li>
      </ol>
      <h3>3 · Install at the machine</h3>
      <ol class="apc-list">
        <li>Check the floor: concrete ≥ C25/30, ≥ 200 mm, flatness in the AGV lane ±2 mm over 2 m. No joints under the docking area.</li>
        <li>Mark the station centre from the APC axis: distance r = ${A.r} mm along the change direction (tape + plumb line or laser tracker), ±0.5 mm.</li>
        <li>Set the table: receiver faces at exactly the machine receiver height H0 = ${H0} mm ±0.1 (level with a precision level 0.02 mm/m), centred to the APC fork rails ±0.5 mm.</li>
        <li>Drill and set the bonded anchors, grout under the plates (non-shrink), tighten after curing.</li>
        <li>Test the APC by hand (slow mode): rotate with a pallet – check the clearance of the fork rails over the receivers (≥ ${Math.max(5, R.clrRec - 2)} mm) and over the lowered chains.</li>
        <li>Set the buffer post on the station axis ±1 mm, front face at x = ${R.XD - 20} mm; the guide rails symmetric to the axis ±2 mm.</li>
        <li>Set the 2 docking brackets: posts anchored at z = ±${R.zPost} mm. With the station chains UP, shim the stop faces to chain top + 40 mm ±0.1 and the pins to the station axis ±0.05 mm (gauge block + dial gauge), then drill and dowel.</li>
      </ol>
      <h3>4 · Commissioning tests</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Accept</th></tr></thead><tbody>
        <tr><td>AGV offset test</td><td>stop the AGV on purpose ${M.nav + 2} mm off in x and z and ${f(M.yaw * 1.4, 1)}° turned (both directions)</td><td>deck docks, transfer works every time</td></tr>
        <tr><td>Deck position after docking</td><td>20 dockings, dial gauge on the deck chain guide against the station chain guide</td><td>±${f(R.zWC, 1)} mm</td></tr>
        <tr><td>Height step</td><td>dial gauge across the chain gap, empty and with a 1.25 × load test pallet</td><td>±${f(R.hWC[2], 1)} mm (allowed ±${M.step})</td></tr>
        <tr><td>Lock pin</td><td>after 20 dockings with offset, the lock pin must close every time</td><td>no fault</td></tr>
        <tr><td>Transfer</td><td>50 transfers each way with the test pallet (1.25 × ${R.mpl} kg)</td><td>no stop error, seat check OK every time</td></tr>
        <tr><td>Stop + overrun</td><td>disable the creep speed (test mode): pallet must stop at the hard stop</td><td>no damage, pallet ±1 mm</td></tr>
        <tr><td>Interlocks</td><td>try to rotate the APC with chains up / stop up / AGV transfer active</td><td>APC does not move</td></tr>
        <tr><td>Safety</td><td>light curtain with and without AGV (muting), E-stop at the panel and on the AGV</td><td>stop in the calculated time</td></tr>
        <tr><td>Endurance</td><td>500 exchange cycles in automatic mode</td><td>no wear marks, chains tension OK</td></tr>
      </tbody></table></div>
      <h3>5 · PLC interlocks (safety-related parts per ISO 13849, PL d)</h3>
      <ul class="apc-list">
        <li>APC may lift / rotate only if: station chains DOWN (B21 off), stop DOWN, no transfer active (E84 BUSY off).</li>
        <li>Station chains may lift only if: APC lowered at 0°/180° + vehicle docked (B11) + E84 TR_REQ (AGV) or latch closed + button (cart).</li>
        <li>Chains run only if: chains UP, AGV/cart deck chains ready (READY / BUSY), light curtain clear or muted.</li>
        <li>Muting only while docked AND E84 VALID; any lost signal = chains stop + brake.</li>
        <li>Chains run only with B13 "deck on the pins" (both bushes on the stop faces). The AGV may not drive while its lock pin is open (B14 off).</li>
        <li>AGV may leave only after COMPT; the deck lowers only after leaving the docking post (pawl up first).</li>
      </ul>
      <h3>6 · Maintenance</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Interval</th><th>Work</th></tr></thead><tbody>
        <tr><td>Weekly</td><td>clean chips from the receivers and the strand tracks; check the seat-check air</td></tr>
        <tr><td>Monthly</td><td>chain tension (sag 1–2 %), lubricate the chains, check the PU pads and the funnel strips</td></tr>
        <tr><td>Every 6 months</td><td>shock absorbers, cone pins + bushes (wear marks), ball transfer units (free running), centring springs, lock pin, anchor torque, height step re-check</td></tr>
        <tr><td>Yearly</td><td>chain elongation (replace at 2 %), guide strips, guide bushings, receivers (wear marks)</td></tr>
      </tbody></table></div>`;
  }
  function interfaceInfo() {
    const c = R.ch;
    const rows = [["Transfer height", `${R.Ht} mm`], ["Receiver height H0", `${H0} mm`], ["Lift stroke (station)", `${R.st} mm`],
      ["Chain strands", `2 × ${c.id.split(" ")[0]}, ±${R.zc} mm`], ["Pallet travel", `${R.L} mm, ${f(R.ttr, 1)} s`],
      ["Drive", `${R.motor} kW, ${f(R.nOut, 0)} rpm`], ["Lift cylinder", `Ø${R.D}/${R.rod} × ${R.st}`],
      ["AGV stop accuracy", `±${M.nav} mm, ±${M.yaw}°`], ["Deck docking", `float ±${M.fl}, 2 cone pins Ø${M.dpn}`], ["Height step", `±${f(R.hWC[2], 1)} mm (stop faces)`], ["One docking cycle", `${f(tot(), 1)} s`]];
    return `<div class="apc-pi-h"><b>Interface – main values</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
      <p class="hint">Click any part in the 3D view for its function, specification, material and how to make or mount it.</p>`;
  }
  function info(key) {
    const el = $("mx3dInfo");
    if (!key) { el.innerHTML = interfaceInfo(); return; }
    const p = partInfo(key, R, M); if (!p) { el.innerHTML = interfaceInfo(); return; }
    const [n, mb, matl, fn, spec, mfg] = p;
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b>${mb ? `<span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span>` : ""}</div>
      ${fn ? `<p>${esc(fn)}</p>` : ""}${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="mx3dBack">◀ main values</button>`;
    $("mx3dBack").onclick = () => info(null);
  }
  function render() {
    A = apcData(); R = calc(M, A); ST = steps(R, M, veh, task); T = Math.min(T, tot());
    const ch = checks();
    $("mxKpis").innerHTML = [
      ["Transfer height", R.Ht + " mm", `receivers ${H0} mm, lift ${R.st} mm`],
      ["Chains", "2 × " + R.ch.id.split(" ")[0], `strands ±${R.zc} mm, safety ${f(R.ch.SF, 0)}`],
      ["Drive", R.motor + " kW", `${f(R.nOut, 0)} rpm, ${f(R.Tout, 0)} N·m`],
      ["Lift cylinder", "Ø" + R.D + " mm", `${f(R.Fl / 1000, 1)} kN at ${A.p} MPa`],
      ["Docking cycle", f(tot(), 1) + " s", `exchange ${f(R.tex, 0)} s per pallet`],
      ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"],
    ].map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("mxChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    formulas(); tolHTML(); bom(); guide(); accHTML();
    $("mxSide").innerHTML = sideSVG(R, M, A); $("mxPlan").innerHTML = planSVG(R, M, A);
    const k = JSON.stringify([A, M.clr, M.gap, M.hb, M.dp, M.sb, M.lc, M.zs]);
    if (view && k !== geo) { geo = k; view.build(R, M, A); view.setCurtain($("mxCurtain").checked); view.setLabels($("mxLbl").checked); info(null); }
    else if (!view) geo = "";
    draw();
  }
  function draw() {
    const s = stateAt(T, ST, R, M, veh, task);
    if (view) view.update(s, veh);
    $("mxStep").innerHTML = `Step ${s.k + 1}/${ST.length}: <b>${esc(ST[s.k][1])}</b> <span class="muted">${f(T, 1)} / ${f(tot(), 1)} s</span>`;
    $("mxScrub").value = Math.round(T / tot() * 1000);
    $("mxPlay").textContent = playing ? "❚❚ Pause" : "▶ Play transfer";
    $("mxSig").innerHTML = sigSVG(ST, s, veh, task);
    $("mxAccSvg").innerHTML = accSVG(s);
    $("mxSteps").innerHTML = ST.map((r, i) => `<tr class="${i === s.k ? "on" : ""}"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
  }
  function init() {
    if (view) return;
    try { view = create3D($("mx3d")); } catch (e) { $("mx3d").innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe($("mx3d"));
    view.resize(); view.onPick(info);
    geo = JSON.stringify([A, M.clr, M.gap, M.hb, M.dp, M.sb, M.lc, M.zs]);
    view.build(R, M, A); view.setCurtain($("mxCurtain").checked);
    info(null); draw();
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active") || $("mxItem1").hidden) return;
      if (playing) { T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); }
      view.frame(playing ? dt : 0, M.vt);
    };
    raf = requestAnimationFrame(loop);
  }

  inputs(); render();
  $("mxInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = M[k]; return; }
    M[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("mechState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("mxReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("mechState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("mxPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("mxScrub").addEventListener("input", (e) => { playing = false; T = tot() * e.target.value / 1000; draw(); });
  const seg = (attr, fn) => document.querySelectorAll(`[${attr}]`).forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(`[${attr}]`).forEach((x) => x.classList.toggle("active", x === b)); fn(b.getAttribute(attr));
  }));
  seg("data-mxveh", (v) => { veh = v; T = 0; playing = false; ST = steps(R, M, veh, task); draw(); });
  seg("data-mxtask", (v) => { task = v; T = 0; playing = false; ST = steps(R, M, veh, task); draw(); });
  document.querySelectorAll("[data-mxview]").forEach((b) => b.addEventListener("click", () => view && view.fit(b.dataset.mxview)));
  $("mxCurtain").addEventListener("change", (e) => view && view.setCurtain(e.target.checked));
  $("mxLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  const _prev = window.onTabShown;
  window.onTabShown = (name) => { if (_prev) _prev(name); if (name === "mech") { const k = JSON.stringify(apcData()); if (k !== JSON.stringify(A)) render(); init(); if (view) view.resize(); } };
  if (pane.classList.contains("active") || location.hash === "#mech") setTimeout(() => { if (pane.classList.contains("active")) init(); }, 50);
  const q = new URLSearchParams(location.search);
  document.querySelectorAll("[data-mxitem]").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("[data-mxitem]").forEach((x) => x.classList.toggle("active", x === b));
    const it = b.dataset.mxitem;
    ["1", "2", "3", "4"].forEach((n) => { const c = $("mxItem" + n), p = $("mxIntro" + n); if (c) c.hidden = n !== it; if (p) p.hidden = n !== it; });
    if (it !== "1") { playing = false; const m = window["mech" + it]; if (m) m.show(); } else { init(); if (view) view.resize(); }
  }));
  if (q.get("mxitem")) setTimeout(() => { const b = document.querySelector(`[data-mxitem="${q.get("mxitem")}"]`); if (b) b.click(); }, 250);
  if (q.get("mxveh")) setTimeout(() => { const b = document.querySelector(`[data-mxveh="${q.get("mxveh")}"]`); if (b) b.click(); }, 300);
  if (q.get("mxtask")) setTimeout(() => { const b = document.querySelector(`[data-mxtask="${q.get("mxtask")}"]`); if (b) b.click(); }, 320);
  if (q.get("mxview")) setTimeout(() => { init(); view && view.fit(q.get("mxview")); }, 400);
  if (q.get("mxt")) setTimeout(() => { T = Math.min(tot(), parseFloat(q.get("mxt")) || 0); draw(); }, 450);
  if (q.get("mxpart")) setTimeout(() => { init(); info(q.get("mxpart")); }, 500);
}
