/* AGV build tab - item 3: pallet AGV (1 t class) with scissor lift and floating chain deck.
   Brings the machining pallet (data from the Pallet changer tab) to the APC load station of mechanical item 1:
   drives with the deck low (stable) -> stops ±10 mm -> lock pin opens (deck floats ±20 mm on ball transfer units) ->
   scissor lifts the deck -> 2 cone pins of the station centre it -> deck pushes against machined stop faces (height exact)
   -> E84 -> chains move the pallet -> deck down, lock pin re-centres -> drive away.
   Coordinates: mm, Y up, station centre x = 0, the AGV comes from +x.  Example values.  Offline (three.js from web/vendor). */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, H0 = 1050, LS = 44, NMOT = 3000;
const STD_I = [10, 12, 15, 16, 20, 25, 30, 35, 40];
const MOT = [[200, 0.64, 1.9], [400, 1.27, 3.8], [750, 2.39, 7.1], [1000, 3.18, 9.5], [1500, 4.8, 14.3]];
const ACT = [10, 16, 25, 40, 63, 100];                 // electric actuator ratings, kN
const BTU = [0.5, 1, 1.5, 2.5, 4];                     // ball transfer unit ratings, kN
const CHAINS = [{ id: "08B-1", p: 12.7, Fb: 17.8, q: 0.7, Fr: 250 }, { id: "10B-1", p: 15.875, Fb: 22.2, q: 0.95, Fr: 350 },
  { id: "12B-1", p: 19.05, Fb: 28.9, q: 1.25, Fr: 500 }, { id: "16B-1", p: 25.4, Fb: 60, q: 2.7, Fr: 900 }];
const AB_X = 0.3, AB_Y = -80, AD = 0.55;               // actuator: base pivot (× La from the fixed foot, mm below the base), attach point on the arm (× La)
const STACK = 150;                                     // platform + ball units + floating deck + chain beams (mm)

const GROUPS = [
  ["Vehicle", [
    ["hdrive", "Deck height while driving (chain top)", "mm", 650, "mechanical item 1"],
    ["vmax", "Max. speed (loaded)", "m/s", 1.0, ""],
    ["vnav", "Slow zone before the station", "m/s", 0.3, ""],
    ["vd", "Docking creep speed (last 60 mm)", "m/s", 0.05, ""],
    ["acc", "Acceleration", "m/s²", 0.3, ""],
    ["ab", "Emergency deceleration", "m/s²", 0.8, ""],
    ["Dw", "Drive wheel Ø (PU)", "mm", 200, ""],
    ["shr", "Weight share on the drive wheels", "%", 50, "sprung castors"],
    ["mu", "Grip PU ↔ floor (dusty)", "", 0.35, ""],
    ["vc", "Speed in curves", "m/s", 0.5, ""],
    ["rc", "Curve radius", "m", 1.2, ""]]],
  ["Scissor lift", [
    ["La", "Scissor arm length (pivot to pivot)", "mm", 800, ""],
    ["h0", "Scissor height when closed", "mm", 170, "room under the deck at drive height"],
    ["vdeck", "Deck lift speed", "mm/s", 80, "mechanical item 1"],
    ["nact", "Number of electric actuators", "", 2, "one per scissor pair"],
    ["kdyn", "Dynamic / off-centre factor", "", 1.25, ""]]],
  ["Floating deck + docking (mechanical item 1)", [
    ["nav", "AGV stop accuracy", "± mm", 10, "item 1 of this tab: ±9.5 mm"],
    ["yaw", "AGV angle accuracy", "± °", 0.5, ""],
    ["fl", "Float range of the deck", "± mm", 20, ""],
    ["mdk", "Floating deck mass (deck, chains, drive)", "kg", 150, ""],
    ["mub", "Ball transfer unit friction", "", 0.01, ""],
    ["ksp", "Centring spring rate (per axis)", "N/mm", 10, ""],
    ["nbtu", "Number of ball transfer units", "", 8, ""],
    ["fpre", "Push-up force against the stop faces", "N", 600, "actuator current limit"]]],
  ["Transfer chains", [
    ["vt", "Transfer speed", "m/s", 0.2, ""],
    ["at", "Transfer acceleration", "m/s²", 0.3, ""],
    ["muc", "Running resistance of the chain", "", 0.1, ""],
    ["mus", "Static friction pallet ↔ chain", "", 0.15, ""],
    ["gap", "Gap station chain ↔ AGV chain", "mm", 60, ""]]],
  ["Battery", [
    ["Ub", "Battery voltage", "V", 48, ""],
    ["Ah", "Capacity", "Ah", 105, ""],
    ["trips", "Transports per hour", "1/h", 6, "3 HMCs"],
    ["dtrip", "Route per transport", "m", 80, ""],
    ["Pel", "Electronics + idle losses", "W", 200, ""]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));

function apc() {
  const A = window.APC && window.APC.get && window.APC.get();
  const P = A ? A.P : { a: 500, b: 500, mp: 110, mw: 400, hc: 250, pitch: 400 };
  return { a: P.a, b: P.b, mp: P.mp, mw: P.mw, hc: P.hc, pitch: P.pitch };
}

/* ------------------------------------------------------------------ calculation */
function calc(M, A) {
  const R = { A }, a = A.a, b = A.b;
  R.mpl = A.mp + A.mw; R.tp = Math.max(50, Math.round(Math.min(a, b) * 0.14));
  R.hg = (A.mp * R.tp / 2 + A.mw * (R.tp + A.hc)) / R.mpl;
  R.zc = Math.round(A.pitch / 2 - 60);                                     // chain strands between the studs (item 1)
  R.Ht = H0 + LS + 10; R.Hlow = H0 - 10; R.S = R.Ht - M.hdrive;            // transfer height, stroke
  R.L = a + 40 + M.gap; R.XD = a / 2 + 85; R.XB = R.XD + 40;
  R.lA = Math.max(a + 450, M.La + 160); R.wA = b + 220; R.xA = R.XB + R.lA / 2; R.dx = R.L - R.xA;   // body, body centre, deck offset
  R.zPin = b / 2 + 100; R.xPin = R.XD + 60; R.zPost = R.wA / 2 + 50; R.xPost = R.XD - 15;
  // scissor geometry (virtual work: F_act·dl = W·dh)
  R.ys = M.hdrive - STACK; R.base = R.ys - M.h0;                           // scissor top (closed) and base
  R.Wl = (R.mpl + M.mdk + 40) * G * M.kdyn;                                // lifted: pallet + floating deck + platform
  const La = M.La, Bx = AB_X * La, By = AB_Y, d = AD * La;
  const ang = (h) => Math.asin(Math.min(0.99, h / La));
  const len = (al) => Math.hypot(d * Math.cos(al) - Bx, d * Math.sin(al) - By);
  R.a0 = ang(M.h0); R.a1 = ang(M.h0 + R.S);
  R.Fcurve = []; let Fmax = 0;
  for (let i = 0; i <= 40; i++) {
    const h = M.h0 + R.S * i / 40, al = ang(h), e = 1e-4, dl = (len(al + e) - len(al - e)) / (2 * e), dh = La * Math.cos(al);
    const F = R.Wl * dh / Math.max(1e-6, dl); R.Fcurve.push([h - M.h0, F / 1000]); Fmax = Math.max(Fmax, F);
  }
  R.Fact = Fmax; R.Fper = Fmax / M.nact; R.act = ACT.find((x) => x * 1000 >= R.Fper * 1.2) || 100;
  R.astroke = len(R.a1) - len(R.a0); R.tlift = R.S / M.vdeck; R.vact = R.astroke / R.tlift;
  R.Plift = R.Wl * M.vdeck / 1000 / 0.65; R.lmot = [250, 400, 750, 1000, 1500].find((w) => w * M.nact >= R.Plift * 1.2) || 1500;
  R.foot = La * Math.cos(R.a0);
  // floating deck + docking
  const yr = M.yaw * Math.PI / 180, ta = Math.tan(15 * Math.PI / 180);
  R.dYaw = R.zPin * Math.sin(yr); R.cap = M.nav + R.dYaw; R.lead = Math.ceil(R.cap + 2); R.lcone = R.lead / ta;
  R.Ffric = M.mub * (M.mdk + R.mpl) * G; R.Ffloat = R.Ffric + M.ksp * R.cap; R.Fv = R.Ffloat * (ta + 0.15) / (1 - 0.15 * ta);
  R.xres = R.Ffric / M.ksp; R.lockLead = Math.ceil(R.xres + 2);       // lock-pin cone must catch what the springs leave
  R.Fbtu = (M.mdk + R.mpl) * G / M.nbtu * 1.5; R.btu = BTU.find((x) => x * 1000 >= R.Fbtu) || 4;
  // chains (same rule as the station in mechanical item 1)
  const loop = 2 * (a + 40) / 1000, start = R.mpl > 300 ? 1 : 0;
  R.chains = CHAINS.map((c) => { const mch = 2 * loop * c.q, Ft = (R.mpl + mch / 2) * M.muc * G + R.mpl * M.at, SF = c.Fb * 1000 / (Ft / 2 * 1.2 * 1.5), n = Math.floor(a / c.p), Fr = R.mpl * G / (2 * n) * 2;
    return { ...c, Ft, SF, Fr, ok: SF >= 10 && Fr <= c.Fr }; });
  R.ch = R.chains.slice(start).find((c) => c.ok) || R.chains[R.chains.length - 1];
  R.Pch = R.ch.Ft * M.vt / 0.7; R.chmot = [60, 90, 120, 200, 300].find((w) => w >= R.Pch * 1.3) || 300;
  const Lm = R.L / 1000; R.ttr = Lm >= M.vt * M.vt / M.at ? Lm / M.vt + M.vt / M.at : 2 * Math.sqrt(Lm / M.at);
  R.Fpawl = R.mpl * M.ab * 1.5; R.slip = M.mus * G / M.ab;
  // masses
  const kWh = M.Ub * M.Ah / 1000;
  R.mass = [["Chassis frame + floor plate + covers", R.lA * R.wA * 1e-6 * 190], ["Drive modules 2 × (Ø" + M.Dw + ", motor, gearbox)", 70], ["Castors 4 × (sprung)", 28],
    [`Battery LiFePO4 ${f(kWh, 1)} kWh`, kWh * 9], ["Scissor lift (arms, base, platform, actuators)", 60 + R.act * 1.2], ["Floating deck incl. chains + drive", M.mdk], ["Electronics, scanners, cables", 30]];
  R.mv = R.mass.reduce((s, r) => s + r[1], 0); R.mt = R.mv + R.mpl;
  // drive
  R.r = M.Dw / 2000;
  R.Fpk = R.mt * (0.015 * G + 0.01 * G + M.acc); R.nw = M.vmax * 60 / (Math.PI * M.Dw / 1000);
  R.i = (() => { let r = STD_I[0]; for (const x of STD_I) if (x <= NMOT / R.nw / 0.97) r = x; return r; })();
  R.vtop = Math.min(M.vmax, NMOT / R.i * Math.PI * M.Dw / 60000);
  R.Tm = R.Fpk / 2 * R.r / (R.i * 0.9); R.Tmc = R.mt * 0.025 * G / 2 * R.r / (R.i * 0.9); R.Pc = R.mt * 0.025 * G * R.vtop / 0.9 / 2;
  R.mot = MOT.find((m) => R.Tm <= m[2] * 0.8 && R.Tmc <= m[1] * 0.8 && R.Pc <= m[0] * 0.6) || MOT[MOT.length - 1];
  R.Nl = M.shr / 100 * R.mt * G / 2; R.Ne = M.shr / 100 * R.mv * G / 2;
  R.trSF = M.mu * Math.min(R.Nl / R.mt, R.Ne / R.mv) * 2 / (R.Fpk / R.mt);
  R.abmax = 2 * M.mu * Math.min(R.Ne / R.mv, R.Nl / R.mt);
  R.wrate = M.Dw >= 250 ? 800 : M.Dw >= 200 ? 500 : 350; R.Fcast = R.mt * (1 - M.shr / 100) / 4 * 1.25;
  // stability: concept A (deck low) and concept B (fixed deck at transfer height)
  R.xs = R.lA / 2 - 120; R.zs = R.wA / 2 - 80;
  const hc = (hdeck) => (R.mv * 300 + R.mpl * (hdeck + R.hg)) / R.mt;
  R.hA = hc(M.hdrive); R.hB = hc(R.Ht); R.hUp = hc(R.Ht);
  R.SFa = G * R.xs / (M.ab * R.hA); R.SFb = G * R.xs / (M.ab * R.hB);
  R.alat = M.vc ** 2 / M.rc; R.SFlat = G * R.zs / (R.alat * R.hA);
  R.abB = G * R.xs / (1.5 * R.hB);                                         // max. deceleration for safety 1.5 with a high deck
  R.sA = M.vmax ** 2 / (2 * M.ab) * 1000; R.sB = M.vmax ** 2 / (2 * Math.min(M.ab, R.abB)) * 1000;
  R.SFup = G * R.xs / (0.3 * R.hUp);
  // battery
  R.Etrip = (0.015 * R.mt * G * M.dtrip + 6 * 0.5 * R.mt * M.vmax ** 2) / 0.8 + 2 * R.Wl * R.S / 1000 / 0.65;
  R.Ph = M.trips * R.Etrip / 3600 + M.Pel; R.run = M.Ub * M.Ah * 0.8 / R.Ph;
  return R;
}

function steps(R, M, task) {
  const del = task === "deliver";
  return [
    ["app", "Drive into the slow zone and stop – only ±" + M.nav + " mm / ±" + M.yaw + "° accurate", 1.94 / M.vnav + 0.06 / M.vd],
    ["unl", "Lock pin opens – the deck can float ±" + M.fl + " mm on the ball transfer units", 0.6],
    ["lift", `Scissor lifts the deck ${f(R.S - 10, 0)} mm (${M.vdeck} mm/s)`, (R.S - 10) / M.vdeck],
    ["dock", "Last 10 mm slowly: 2 cone pins centre the deck, it pushes " + M.fpre + " N against the stop faces", 1.6],
    ...(del ? [] : [["raise", "Station chains lift the pallet off the receivers", 1.0]]),
    ["e84", "E84 handshake: VALID → TR_REQ → READY → BUSY", 1.0],
    ["xfer", del ? "Chains (AGV + station) move the pallet onto the station" : "Chains move the pallet from the station onto the AGV", R.ttr],
    ...(del ? [["lower", "Station chains lower – pull studs drop into the receivers", 1.0]] : [["pawl", "Retention pawl closes on the AGV", 0.6]]),
    ["down", "Deck goes down to drive height, COMPT", R.S / M.vdeck],
    ["lock", "Lock pin closes and re-centres the deck", 0.6],
    ["leave", "Drive away", 1.5 / M.vnav]];
}
function stateAt(T, ST, R, M, task) {
  let k = 0, t0 = 0;
  while (k < ST.length - 1 && T > t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = Math.max(0, Math.min(1, (T - t0) / ST[k][2])), id = ST[k][0], del = task === "deliver";
  const idx = (n) => ST.findIndex((r) => r[0] === n), past = (n) => k > idx(n), now = (n) => ST[k][0] === n;
  const ex = 6;                                                           // stop error, mm (the floating deck takes it)
  let x = R.xA + ex;
  if (now("app")) x = R.xA + ex + 2000 * (1 - u) ** 1.5;
  if (now("leave")) x = R.xA + ex + 1500 * u * u;
  let h = M.hdrive;
  if (now("lift")) h = M.hdrive + (R.S - 10) * u;
  if (now("dock")) h = R.Ht - 10 + 10 * Math.min(1, u * 1.5);
  if (past("dock") && !now("down") && !past("down")) h = R.Ht;
  if (now("down")) h = R.Ht - R.S * u;
  if (past("down")) h = M.hdrive;
  const xferU = now("xfer") ? u * u * (3 - 2 * u) : past("xfer") ? 1 : 0;
  let st = del ? R.Ht : R.Hlow;
  if (del && (now("lower") || past("lower"))) st = R.Ht - (R.Ht - R.Hlow) * (now("lower") ? u : 1);
  if (!del && (now("raise") || past("raise"))) st = R.Hlow + (R.Ht - R.Hlow) * (now("raise") ? u : 1);
  if (!del && past("xfer")) st = R.Hlow;
  const deckX = x + R.dx - ex * (past("dock") || now("dock") ? Math.min(1, now("dock") ? u * 2 : 1) : 0) * (past("lock") ? 0 : 1);
  let px, py;
  if (del) { if (xferU === 0) { px = deckX; py = h; } else if (xferU < 1) { px = R.L + (0 - R.L) * xferU; py = R.Ht; } else { px = 0; py = Math.max(H0, st); } }
  else { if (xferU === 0) { px = 0; py = Math.max(H0, st); } else if (xferU < 1) { px = R.L * xferU; py = R.Ht; } else { px = deckX; py = h; } }
  return { k, u, x, h, deckX, px, py, st, lock: !(past("unl") || now("unl")) || past("lock") || now("lock"), chain: now("xfer") ? (del ? -1 : 1) : 0, task };
}

/* ------------------------------------------------------------------ part data */
function partInfo(key, R, M) {
  const I = {
    body: ["Chassis + covers", "MAKE", "S355 tube frame, 8 mm floor plate, 2 mm covers", "Carries drive, castors, battery and the scissor base.", `${f(R.lA, 0)} × ${R.wA} mm, frame top ≈ 300 mm.`, "Machine the scissor base seats and castor faces after welding."],
    wheel: ["Drive wheels", "BUY", `Ø${M.Dw} PU on Al hub, rating ${R.wrate} kg`, "Differential drive, on a rocker; castors sprung (item 1 lesson).", `Load ${f(R.Nl / G, 0)} kg each (loaded).`, ""],
    castor: ["Sprung castors", "BUY", "Ø150 PU, spring unit", "Carry the rest of the weight; set the drive-wheel share.", `${f(R.Fcast, 0)} kg each incl. ×1.25.`, ""],
    sciss: ["Scissor lift (2 pairs)", "MAKE", "S355 rectangular tube arms, hardened pins, bronze bushes", "Lifts the deck from drive height to the transfer height.",
      `Arm ${M.La} mm, ${f(R.a0 * 180 / Math.PI, 1)}° → ${f(R.a1 * 180 / Math.PI, 1)}°, stroke ${f(R.S, 0)} mm.`, "Ream the pivot bores of each pair together; rolling feet on rollers in C-rails."],
    act: ["Electric actuators", "BUY", `${M.nact} × ball-screw actuator ${R.act} kN, 48 V, with encoder + brake`, "Push the scissor open; the encoder gives the deck height. Mounted low in the chassis (" + -AB_Y + " mm below the scissor base) – that keeps the start force small.",
      `Max. force ${f(R.Fper / 1000, 1)} kN each (at the start), stroke ${f(R.astroke, 0)} mm at ${f(R.vact, 1)} mm/s. Current limit = push-up force ${M.fpre} N at the stop faces.`, "Both actuators synchronised by the controller (encoder difference ≤ 2 mm)."],
    plat: ["Scissor top platform", "MAKE", "S355 plate 10 mm + stiffeners", "Carries the ball transfer units under the floating deck.", "", ""],
    btu: ["Ball transfer units", "BUY", `${M.nbtu} × ${R.btu} kN, ball facing up`, "The floating deck rolls on them with very little force (μ ≈ " + M.mub + ").", `Load ${f(R.Fbtu, 0)} N each incl. ×1.5.`, "Seats machined in one plane ±0.1 mm."],
    deck: ["Floating deck", "MAKE", "Al / S355 frame with 2 chain beams", "Floats ±" + M.fl + " mm in x and z (and ±1°) so the cone pins can align it while the AGV body stays where it stopped.",
      `Float force ${f(R.Ffloat, 0)} N (friction ${f(R.Ffric, 0)} + springs).`, ""],
    lock: ["Lock pin + centring springs", "BUY / MAKE", "electric lock pin (solenoid or mini actuator), conical; 4 springs " + M.ksp + " N/mm", "Holds the deck centred while driving; open only when the AGV stands at the station.",
      `Springs alone leave ${f(R.xres, 1)} mm offset → lock-pin cone with ${R.lockLead} mm lead-in pulls the deck back to centre.`, "Sensors: locked / unlocked."],
    bush: ["Docking bushes (2×)", "MAKE", "hardened bush 16MnCr5, Ø" + 25 + " H7 + 15° lead-in, on arms of the deck", "Take the 2 cone pins of the station (1 round, 1 diamond pin at the station).", `Catch ±${f(R.cap, 1)} mm (stop ±${M.nav} + angle ${f(R.dYaw, 1)}).`, "Inductive sensor: 'docked'."],
    chain: ["Deck chains + drive", "BUY", `2 × ${R.ch.id}, strands at ±${R.zc} mm, gear motor ${R.chmot} W 48 V`, "Move the pallet on/off together with the station chains.", `${M.vt} m/s, transfer ${f(R.ttr, 1)} s.`, "Same chain + pitch line as the station."],
    pawl: ["Retention pawl", "MAKE", "spring-loaded, released by a solenoid", "Holds the pallet on the deck while driving (chain friction alone is not enough at an emergency stop).", `Force ${f(R.Fpawl, 0)} N.`, "Interlock: opens only when docked."],
    scan: ["Safety scanners", "BUY", "2 × safety laser scanner, PL d", "360° protection; field switching by speed; docking field at the station.", "", ""],
    e84: ["E84 optical I/O", "BUY", "IR parallel I/O, 8 bit", "Handshake with the station (VALID, TR_REQ, READY, BUSY, COMPT).", "", "Face to face with the station sensor at docking."],
    stn: ["APC load station (mechanical item 1)", "", "", "Lift-transfer chains, receivers, cone pins + stop faces on 2 brackets.", `Transfer height ${R.Ht} mm.`, ""],
    pin: ["Cone pins + stop faces (station)", "MAKE (station)", "Ø25 g6 pins, 15° cone, machined stop faces", "Centre the floating deck and set its height: the deck pushes up against the faces.", `Stop faces at ${R.Ht + 40} mm.`, ""],
    pallet: ["Machining pallet", "", "", "", `${R.A.a} × ${R.A.b} mm, ${f(R.mpl, 0)} kg with the workpiece.`, ""],
  };
  return I[key];
}

/* ------------------------------------------------------------------ 3D */
function create3D(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 5, 40000), controls = new OrbitControls(camera, renderer.domElement);
  const nice = niceControls(controls, camera, scene);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5a5a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3000, 6000, 2500); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-2500, 1500, -2000); scene.add(fill);
  const root = new THREE.Group(); scene.add(root);
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed"); if (window.dtTheme) window.dtTheme.scene(scene);
  let O = {}, labels = [], selBox = null, onPick = null, chainTex = [], covers = true;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !o.op });
  const C = { frame: mat(0x3c6e9e), dark: mat(0x3a4048), black: mat(0x23262a), steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }), alu: mat(0xc8ccd0, { m: 0.5, r: 0.4 }), pu: mat(0xd9832b, { m: 0, r: 0.7 }),
    cover: mat(0xe8e6df, { op: 0.4, ds: true, m: 0.1 }), yellow: mat(0xf2c200), red: mat(0xd03b3b), green: mat(0x2fa84f), stn: mat(0x5b7a99), pal: mat(0x8d969f, { m: 0.6, r: 0.4 }),
    work: mat(0x67717b, { m: 0.2, r: 0.8 }), floor: mat(0xd8d6cf, { m: 0, r: 0.95 }), deck: mat(0x4f7fb0), batt: mat(0x2f7d4f) };
  const box = (w, h, d, m, x, y, z, part, parent) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  const cyl = (r, h, m, x, y, z, part, parent, axis = "y", seg = 24, r2) => { const g = new THREE.CylinderGeometry(r2 ?? r, r, h, seg); if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  function chainBox(len, x, y, z, parent, part) {
    const c = document.createElement("canvas"); c.width = 4; c.height = 16; const g = c.getContext("2d");
    g.fillStyle = "#2b2f35"; g.fillRect(0, 0, 4, 16); g.fillStyle = "#8d969f"; g.fillRect(0, 9, 4, 7);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(len / 16, 1); tex.rotation = Math.PI / 2; tex.center.set(0.5, 0.5);
    const me = new THREE.Mesh(new THREE.BoxGeometry(len, 14, 26), new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.45 }));
    me.position.set(x, y, z); me.userData.part = part; parent.add(me); chainTex.push(tex); return me;
  }
  function label(text, anchor, off, parent) {
    const c = document.createElement("canvas"), g = c.getContext("2d"); g.font = "600 30px system-ui, sans-serif";
    const w = Math.ceil(g.measureText(text).width) + 24; c.width = w; c.height = 46;
    g.font = "600 30px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.93)"; g.strokeStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.roundRect(1, 1, w - 2, 44, 10); g.fill(); g.stroke(); g.fillStyle = "#1b1f24"; g.fillText(text, 12, 33);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, sizeAttenuation: false }));
    const pos = [anchor[0] + off[0], anchor[1] + off[1], anchor[2] + off[2]];
    sp.scale.set(0.03 * w / 46, 0.03, 1); sp.position.set(...pos); sp.renderOrder = 20; parent.add(sp); labels.push(sp);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...anchor), new THREE.Vector3(...pos)]), new THREE.LineBasicMaterial({ color: 0x30363d, depthTest: false, transparent: true, opacity: 0.8 }));
    ln.renderOrder = 19; parent.add(ln); labels.push(ln);
  }
  function build(R, M) {
    if (selBox) { scene.remove(selBox); selBox = null; }
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    while (root.children.length) root.remove(root.children[0]);
    labels = []; chainTex = []; O = { R, M };
    const A = R.A, a = A.a, b = A.b;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(9000, 5000), C.floor); fl.rotation.x = -Math.PI / 2; fl.position.set(1200, -1, 0); root.add(fl); if (window.dtTheme) window.dtTheme.floor(C.floor);
    const grid = new THREE.GridHelper(9000, 45, 0xb9b6ad, 0xc9c6bd); grid.position.x = 1200; grid.scale.z = 5 / 9; root.add(grid);
    // ---- station (simplified, from mechanical item 1)
    const S = new THREE.Group(); root.add(S);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(70, H0 - 60, 70, C.stn, sx * (a / 2 + 10), (H0 - 60) / 2, sz * (b / 2 - 20), "stn", S);
    box(a + 90, 40, b + 30, C.stn, 0, H0 - 80, 0, "stn", S);
    for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(30, 40, C.steel, sx * A.pitch / 2, H0 - 20, sz * A.pitch / 2, "stn", S);
    O.stCh = new THREE.Group(); S.add(O.stCh);
    for (const sz of [1, -1]) chainBox(a + 40, 0, -7, sz * R.zc, O.stCh, "stn");
    for (const sz of [1, -1]) {                                     // docking brackets: post + arm + cone pin + stop face
      box(80, R.Ht + 120, 80, C.stn, R.xPost, (R.Ht + 120) / 2, sz * R.zPost, "pin", S);
      box(R.xPin - R.xPost + 90, 50, 70, C.stn, (R.xPin + R.xPost) / 2 + 20, R.Ht + 65, sz * (R.zPin + 30), "pin", S);
      box(80, 12, 70, C.steel, R.xPin, R.Ht + 46, sz * R.zPin, "pin", S);
      cyl(12.5, 50, C.steel, R.xPin, R.Ht + 15, sz * R.zPin, "pin", S, "y", 20, 4);
    }
    label("APC load station (mech. item 1)", [-a / 2, H0, b / 2], [-500, 500, 400], S);
    label("Cone pin + stop face", [R.xPin, R.Ht + 60, R.zPin], [200, 450, 400], S);
    // ---- pallet
    O.pal = new THREE.Group(); root.add(O.pal);
    box(a, R.tp, b, C.pal, 0, R.tp / 2, 0, "pallet", O.pal);
    box(a * 0.7, A.hc * 1.2, b * 0.6, C.work, 0, R.tp + A.hc * 0.6, 0, "pallet", O.pal);
    for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(12, LS, C.steel, sx * A.pitch / 2, -LS / 2, sz * A.pitch / 2, "pallet", O.pal);
    // ---- AGV
    const AG = new THREE.Group(); root.add(AG); O.agv = AG;
    const lA = R.lA, wA = R.wA;
    box(lA - 20, 80, wA - 40, C.frame, 0, 80, 0, "body", AG);
    box(lA - 60, 8, wA - 80, C.dark, 0, 40, 0, "body", AG);
    box(lA * 0.35, 150, wA * 0.4, C.batt, lA * 0.25, 125, 0, "body", AG);
    O.cov = [box(lA, 260, 2, C.cover, 0, 150, wA / 2, "body", AG), box(lA, 260, 2, C.cover, 0, 150, -wA / 2, "body", AG), box(2, 260, wA, C.cover, lA / 2, 150, 0, "body", AG), box(2, 260, wA, C.cover, -lA / 2, 150, 0, "body", AG)];
    O.wheels = [];
    for (const sz of [1, -1]) { const w = new THREE.Group(); w.position.set(0, M.Dw / 2, sz * (wA / 2 - 70)); AG.add(w); O.wheels.push(w); cyl(M.Dw / 2, 60, C.pu, 0, 0, 0, "wheel", w, "z", 32); box(M.Dw * 0.6, 8, 62, C.dark, 0, 0, 0, "wheel", w); }
    for (const sx of [1, -1]) for (const sz of [1, -1]) { cyl(75, 45, C.pu, sx * R.xs, 75, sz * R.zs, "castor", AG, "z"); cyl(25, 40, C.yellow, sx * R.xs, 175, sz * R.zs, "castor", AG); }
    for (const [sx, sz] of [[-1, 1], [1, -1]]) { cyl(45, 110, C.yellow, sx * (lA / 2 - 50), 230, sz * (wA / 2 - 50), "scan", AG); }
    box(30, 40, 80, C.black, -lA / 2 - 15, 230, -wA / 2 + 80, "e84", AG);
    // scissor (moves): base at R.base, top at R.base + h
    const SC = new THREE.Group(); SC.position.x = R.dx; AG.add(SC); O.sc = { g: SC, arms: [] };
    for (const sz of [1, -1]) {
      box(M.La + 80, 30, 50, C.frame, 0, R.base - 15, sz * (b / 2 + 10), "sciss", SC);
      for (const sg of [1, -1]) { const arm = box(M.La, 40, 22, C.steel, 0, R.base, sz * (b / 2 + 10) + sg * 16, "sciss", SC); arm.userData.sg = sg; O.sc.arms.push(arm); }
    }
    O.sc.act = [];
    for (const sz of [1, -1]) { const ac = cyl(28, 1, C.black, 0, 0, sz * (b / 2 - 40), "act", SC, "x"); O.sc.act.push(ac); }
    // lifted part: platform + ball units + floating deck (local y = 0 at scissor top)
    O.top = new THREE.Group(); O.top.position.x = R.dx; AG.add(O.top);
    box(M.La + 40, 20, b + 60, C.frame, 0, 10, 0, "plat", O.top);
    for (let i = 0; i < M.nbtu; i++) { const sx = i % 2 ? 1 : -1, k = Math.floor(i / 2), n = Math.ceil(M.nbtu / 2); cyl(18, 30, C.steel, (k - (n - 1) / 2) * (a / Math.max(1, n - 1 || 1)) * 0.85, 35, sx * (b / 2 - 40), "btu", O.top); }
    O.float = new THREE.Group(); O.top.add(O.float);
    box(a + 60, 30, b + 60, C.deck, 0, 65, 0, "deck", O.float);
    for (const sz of [1, -1]) box(a + 40, 66, 40, C.deck, 0, 113, sz * R.zc, "deck", O.float);
    O.dCh = new THREE.Group(); O.float.add(O.dCh);
    for (const sz of [1, -1]) chainBox(a + 40, 0, STACK - 7, sz * R.zc, O.dCh, "chain");
    for (const sz of [1, -1]) box(a + 40, 50, 12, C.alu, 0, STACK + 15, sz * (b / 2 + 10), "deck", O.float);   // side guides
    box(60, 60, 70, C.dark, a / 2, 100, 0, "chain", O.float);                                                     // chain gear motor
    O.lockPin = cyl(14, 50, C.red, 0, 40, 0, "lock", O.top);
    for (const sz of [1, -1]) {                                                                                       // docking arms + bushes + stop pads
      const xb = R.xPin - R.L;
      box(60, 30, R.zPin - b / 2 - 20, C.deck, xb, STACK - 10, sz * (b / 2 + 30 + (R.zPin - b / 2 - 20) / 2), "bush", O.float);
      cyl(24, 40, C.steel, xb, STACK + 20, sz * R.zPin, "bush", O.float);
    }
    O.pawl = box(16, 40, 60, C.yellow, -a / 2 - 10, STACK + 15, 0, "pawl", O.float);
    label("Floating deck (ball transfer units)", [0, STACK, b / 2 + 30], [400, 550, 500], O.top);
    label("Scissor lift + 2 actuators", [0, R.base + 60, b / 2 + 10], [600, 300, 600], AG);
    label("Pallet AGV", [lA / 2, 280, wA / 2], [500, 300, 500], AG);
    fit("overview");
  }
  const VIEWS = {
    overview: (R) => [[R.xA + 2600, 2300, 2900], [R.xA - 300, 650, 0]],
    side: (R) => [[R.xA * 0.6, 900, 3400], [R.xA * 0.6, 700, 0]],
    dock: (R) => [[R.xPin + 900, R.Ht + 500, R.zPin + 900], [R.xPin, R.Ht, R.zPin]],
    lift: (R) => [[R.xA + 300, 700, 1900], [R.xA + R.dx, 450, 0]],
    top: (R) => [[R.xA * 0.6, 5000, 1], [R.xA * 0.6, 0, 0]],
  };
  function fit(v) { const R = O.R; if (!R) return; const [p, t] = VIEWS[v](R); nice.stop(); camera.position.set(...p); controls.target.set(...t); controls.update(); }
  function update(s) {
    if (!O.agv) return;
    const R = O.R, M = O.M;
    O.agv.position.x = s.x;
    O.wheels.forEach((w) => { w.rotation.z = (s.x - R.xA) / (M.Dw / 2); });
    const hs = M.h0 + (s.h - M.hdrive);                                    // scissor height
    const al = Math.asin(Math.min(0.99, hs / M.La)), half = M.La / 2 * Math.cos(al);
    for (const arm of O.sc.arms) { arm.rotation.z = arm.userData.sg * al; arm.position.y = R.base + hs / 2; }
    for (const ac of O.sc.act) { const x0 = -half + AB_X * M.La, y0 = R.base + AB_Y, x1 = -half + AD * M.La * Math.cos(al), y1 = R.base + AD * M.La * Math.sin(al);
      const L = Math.hypot(x1 - x0, y1 - y0); ac.scale.x = L; ac.position.set((x0 + x1) / 2, (y0 + y1) / 2, ac.position.z); ac.rotation.z = Math.atan2(y1 - y0, x1 - x0); }
    O.top.position.y = s.h - STACK;
    O.float.position.x = s.deckX - (s.x + R.dx);                           // floating offset (mm, real size)
    O.lockPin.material = s.lock ? C.red : C.green;
    O.stCh.position.y = s.st;
    O.pal.position.set(s.px, s.py, 0);
    O.chainDir = s.chain;
  }
  function frame(dt, vt) {
    if (O.chainDir) for (const t of chainTex) t.offset.x -= O.chainDir * dt * vt * 1000 / 16;
    if (selBox) selBox.update(); controls.update(); renderer.render(scene, camera);
  }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part && vis(h.object) && h.object.material !== C.cover);
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    selBox = new THREE.BoxHelper(hit.object, 0xff2a2a); scene.add(selBox); if (onPick) onPick(hit.object.userData.part);
  });
  return { build, update, fit, frame, canvas: renderer.domElement,
    setLabels(on) { labels.forEach((l) => { l.visible = on; }); }, setCovers(on) { covers = on; (O.cov || []).forEach((c) => { c.visible = on; }); }, onPick(fn) { onPick = fn; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
}

/* ------------------------------------------------------------------ 2D */
function liftSVG(R, M, h) {
  const W = 760, H = 270, X0 = 420, X1 = W - 20, Y0 = 220, Y1 = 40, cur = h - M.hdrive;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Scissor lift: height and actuator force">`;
  // side view
  const k = 300 / (M.La + 100), hs = M.h0 + cur, al = Math.asin(Math.min(0.99, hs / M.La)), hx = M.La / 2 * Math.cos(al) * k, cx = 190, yb = 235, hp = hs * k;
  g += `<text x="10" y="16" class="apc-t" style="font-weight:600">Side view (deck ${f(h, 0)} mm, angle ${f(al * 180 / Math.PI, 1)}°)</text>`;
  g += `<line x1="20" y1="${yb}" x2="360" y2="${yb}" stroke="var(--text-2)" stroke-width="3"/>`;
  g += `<line x1="${cx - hx}" y1="${yb}" x2="${cx + hx}" y2="${yb - hp}" stroke="var(--text)" stroke-width="5"/><line x1="${cx - hx}" y1="${yb - hp}" x2="${cx + hx}" y2="${yb}" stroke="var(--text)" stroke-width="5"/>`;
  const x0 = cx - hx + AB_X * M.La * k, y0 = yb - AB_Y * k, x1 = cx - hx + AD * M.La * Math.cos(al) * k, y1 = yb - AD * M.La * Math.sin(al) * k;
  g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="var(--critical)" stroke-width="7" opacity=".75"/>`;
  g += `<rect x="${cx - hx - 10}" y="${yb - hp - 14}" width="${2 * hx + 20}" height="12" fill="color-mix(in srgb, var(--accent) 35%, transparent)" stroke="var(--accent)"/>`;
  g += `<text x="${cx + hx + 16}" y="${yb - hp - 4}" class="apc-t">platform + floating deck</text><text x="${x1 + 8}" y="${y1 + 18}" class="apc-t" style="fill:var(--critical)">actuator</text>`;
  g += `<text x="20" y="${H - 6}" class="apc-t">arm ${M.La} mm · stroke ${f(R.S, 0)} mm · actuator stroke ${f(R.astroke, 0)} mm</text>`;
  // force curve
  const ymax = Math.max(...R.Fcurve.map((p) => p[1])) * 1.15, X = (x) => X0 + x / R.S * (X1 - X0), Y = (v) => Y0 - v / ymax * (Y0 - Y1);
  g += `<text x="${X0}" y="16" class="apc-t" style="font-weight:600">Total actuator force (kN) over the lift</text>`;
  for (const v of [0, ymax / 2.3, ymax / 1.15]) g += `<line x1="${X0}" y1="${Y(v)}" x2="${X1}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${X0 - 6}" y="${Y(v) + 4}" class="apc-t r">${f(v, 0)}</text>`;
  for (let q = 0; q <= 4; q++) g += `<text x="${X(R.S * q / 4)}" y="${Y0 + 16}" class="apc-t c">${f(R.S * q / 4, 0)}</text>`;
  g += `<text x="${X1}" y="${Y0 + 30}" class="apc-t r">lift mm</text>`;
  g += `<path d="${R.Fcurve.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("")}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  const Fc = R.Fcurve[Math.max(0, Math.min(40, Math.round(cur / R.S * 40)))][1];
  g += `<line x1="${X0}" y1="${Y(R.Wl / 1000)}" x2="${X1}" y2="${Y(R.Wl / 1000)}" stroke="var(--text-2)" stroke-dasharray="4 3"/><text x="${X1}" y="${Y(R.Wl / 1000) - 4}" class="apc-t r">load ${f(R.Wl / 1000, 1)} kN</text>`;
  g += `<circle cx="${X(Math.max(0, Math.min(R.S, cur)))}" cy="${Y(Fc)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
  g += `<text x="${X(R.S / 2)}" y="${Y1 - 6}" class="apc-t c">start (closed) = highest force: ${f(R.Fact / 1000, 1)} kN = ${f(R.Fact / R.Wl, 1)} × the load</text>`;
  return g + `</svg>`;
}
function stackSVG(R, M) {
  const W = 760, H = 300, sc = 0.2, X = 60, Y = (y) => H - 20 - y * sc;
  const rows = [["floor", 0, 0], ["chassis frame top", 300, 300], ["scissor (closed " + M.h0 + ")", R.base, R.ys], ["platform + ball units", R.ys, R.ys + 70], ["floating deck + chain beams", R.ys + 70, M.hdrive],
    ["→ lift " + f(R.S, 0) + " mm →", M.hdrive, R.Ht], ["receivers / pallet bottom", H0, H0], ["transfer height (chain top)", R.Ht, R.Ht], ["stop faces", R.Ht + 40, R.Ht + 40]];
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Height stack of the pallet AGV">`;
  g += `<line x1="${X}" y1="${Y(0)}" x2="${X}" y2="${Y(1200)}" stroke="var(--text-2)"/>`;
  for (let y = 0; y <= 1200; y += 200) g += `<line x1="${X - 4}" y1="${Y(y)}" x2="${X}" y2="${Y(y)}" stroke="var(--text-2)"/><text x="${X - 8}" y="${Y(y) + 4}" class="apc-t r">${y}</text>`;
  g += `<rect x="${X + 20}" y="${Y(300)}" width="180" height="${300 * sc}" fill="color-mix(in srgb, #3c6e9e 25%, transparent)" stroke="#3c6e9e"/>`;
  g += `<rect x="${X + 40}" y="${Y(R.ys)}" width="140" height="${(R.ys - R.base) * sc}" fill="none" stroke="var(--text)" stroke-dasharray="4 3"/>`;
  g += `<rect x="${X + 30}" y="${Y(M.hdrive)}" width="160" height="${(M.hdrive - R.ys) * sc}" fill="color-mix(in srgb, var(--accent) 30%, transparent)" stroke="var(--accent)"/>`;
  g += `<rect x="${X + 30}" y="${Y(R.Ht)}" width="160" height="${STACK * sc}" fill="none" stroke="var(--accent)" stroke-dasharray="5 3"/>`;
  g += `<line x1="${X + 110}" y1="${Y(M.hdrive)}" x2="${X + 110}" y2="${Y(R.Ht)}" stroke="var(--accent)" stroke-width="2" marker-end="url(#apA)"/><defs><marker id="apA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="var(--accent)"/></marker></defs>`;
  g += `<rect x="${X + 240}" y="${Y(R.Ht + 40)}" width="120" height="${(R.Ht + 40 - H0 + 80) * sc}" fill="color-mix(in srgb, #5b7a99 25%, transparent)" stroke="#5b7a99"/><text x="${X + 300}" y="${Y(H0 - 120)}" class="apc-t c">station</text>`;
  const lab = rows.map(([n, y0, y1]) => ({ n, y0, y1, p: Y((y0 + y1) / 2) })).sort((p, q) => q.p - p.p);
  for (let i = 1; i < lab.length; i++) if (lab[i - 1].p - lab[i].p < 15) lab[i].p = lab[i - 1].p - 15;
  for (const l of lab) { g += `<text x="${X + 400}" y="${l.p + 4}" class="apc-t">${esc(l.n)}: ${l.y0 === l.y1 ? f(l.y0, 0) : f(l.y0, 0) + " – " + f(l.y1, 0)} mm</text><line x1="${X + 392}" y1="${l.p}" x2="${X + 370}" y2="${Y((l.y0 + l.y1) / 2)}" stroke="var(--grid)"/>`; }
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const boxP = $("avItem3");
if (boxP) {
  boxP.innerHTML = `
    <div class="kpis" id="apKpis"></div>
    <div class="card">
      <div class="card-head"><h2>3D – pallet AGV at the APC load station</h2><span class="sub">drag = turn · right-drag = move · wheel = zoom at the mouse · double-click = new turning point · click a part for its data</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="apPlay">▶ Play</button><input type="range" id="apScrub" min="0" max="1000" value="0" aria-label="Time"><span id="apStep" class="small"></span></div>
      <div class="apc3d-bar">
        <span class="tb-label">Task</span><div class="seg" role="group" aria-label="Task"><button class="seg-btn active" data-aptask="deliver">Deliver pallet</button><button class="seg-btn" data-aptask="pickup">Pick up pallet</button></div>
        <span class="tb-label">View</span><div class="seg" role="group" aria-label="View">
          <button class="seg-btn" data-apview="overview">Overview</button><button class="seg-btn" data-apview="side">Side</button><button class="seg-btn" data-apview="lift">Scissor</button><button class="seg-btn" data-apview="dock">Docking</button><button class="seg-btn" data-apview="top">Top</button></div>
        <label class="tb-check"><input type="checkbox" id="apCov" checked> covers</label><label class="tb-check"><input type="checkbox" id="apLbl" checked> labels</label>
      </div>
      <div class="apc3d-grid"><div class="apc3d" id="ap3d"></div><div class="apc3d-info" id="ap3dInfo"></div></div>
      <div class="apc3d-legend small muted"><span><i style="background:#3c6e9e"></i>AGV frame / scissor base</span><span><i style="background:#4f7fb0"></i>floating deck</span><span><i style="background:#d03b3b"></i>lock pin closed</span><span><i style="background:#2fa84f"></i>lock pin open (floating)</span><span><i style="background:#5b7a99"></i>station</span></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Scissor lift</h2><span class="sub">moves with the animation</span></div><div id="apLift"></div>
        <p class="hint">Here a scissor is the right choice (unlike the crate AGV): the deck must lift <b id="apS"></b> mm, and a screw jack or cam would not fit under a 650 mm deck.
          The price: the highest force is at the start, when the scissor is nearly closed. That is why the scissor does not close fully at drive height (the closed height is the room under the deck).</p></div>
      <div class="card"><div class="card-head"><h2>Steps</h2></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="apSteps"></tbody></table></div></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Height stack</h2><span class="sub">what sits where (mm above the floor)</span></div><div id="apStack"></div></div>
      <div class="card"><div class="card-head"><h2>Concept choice: low deck + lift, or fixed high deck?</h2></div><div class="table-wrap"><table class="apc-bom" id="apConcept"></table></div>
        <p class="hint" id="apConceptNote"></p></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2>Signals of this AGV (in addition to item 1)</h2></div><div class="table-wrap"><table class="apc-bom" id="apIO"></table></div></div>
      <div class="card"><div class="card-head"><h2>Interface sheet AGV ↔ station</h2><span class="sub">give it to the station builder and the AGV builder</span></div><div class="table-wrap"><table class="apc-bom" id="apIf"></table></div></div>
    </div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="apReset">Example values</button></div><div id="apInputs"></div>
        <p class="hint">Pallet size, mass and stud pitch come from the Pallet changer tab.</p></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="apChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="apCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Bill of materials</h2><span class="sub">MAKE = you manufacture · BUY = catalogue / supplier</span></div><div class="table-wrap"><table id="apBom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – manufacturing, assembly, commissioning, tests</h2></div><div id="apGuide" class="mx-guide"></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("agvPalState") || "{}")); } catch (e) { /* private window */ }
  let A = apc(), R = calc(M, A), task = "deliver", ST = steps(R, M, task), T = 0, playing = false, last = performance.now(), view = null, geo = "", started = false;
  const tot = () => ST.reduce((s, r) => s + r[2], 0), pane = $("tab-agv"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;

  function inputs() {
    $("apInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Drive motor", R.Tm <= R.mot[2] * 0.8, R.Tm <= R.mot[2], `2 × ${R.mot[0]} W, i = ${R.i}: ${f(R.Tm, 2)} Nm peak`);
    add("Grip when accelerating", R.trSF >= 1.3, R.trSF >= 1, `×${f(R.trSF, 2)}`);
    add("Emergency braking possible with the grip", M.ab <= R.abmax * 0.9, M.ab <= R.abmax, `need ${M.ab}, grip allows ${f(R.abmax, 2)} m/s²`);
    add("Drive wheel load", R.Nl / G <= R.wrate * 0.85, R.Nl / G <= R.wrate, `${f(R.Nl / G, 0)} kg ≤ ${R.wrate} kg (Ø${M.Dw})`);
    add("No tipping forward (driving, deck low)", R.SFa >= 2, R.SFa >= 1.5, `×${f(R.SFa, 1)} at ${M.ab} m/s², CoG ${f(R.hA, 0)} mm`);
    add("No tipping sideways in curves", R.SFlat >= 2, R.SFlat >= 1.5, `${M.vc} m/s at R ${M.rc} m: ×${f(R.SFlat, 1)}`);
    add("Deck up → no driving (interlock)", R.SFup >= 1.5, false, `with the deck up only creep is safe (×${f(R.SFup, 1)} at 0.3 m/s²) – speed = 0 above drive height + 20 mm`);
    add("Pallet on the deck at an emergency stop", R.slip >= 1.5, R.slip >= 1, R.slip >= 1.5 ? `friction holds (×${f(R.slip, 1)})` : `friction alone ×${f(R.slip, 2)} → retention pawl ${f(R.Fpawl, 0)} N needed`);
    add("Scissor fits under the deck", R.base >= 300, R.base >= 260, `base at ${f(R.base, 0)} mm ≥ frame top 300 mm`);
    add("Scissor end angle", R.a1 * 180 / Math.PI <= 55, R.a1 * 180 / Math.PI <= 62, `${f(R.a1 * 180 / Math.PI, 1)}° (≤ 55°: stable platform)`);
    add("Scissor fits in the AGV length", R.foot + 80 <= R.lA, false, `${f(R.foot + 80, 0)} mm ≤ ${f(R.lA, 0)} mm`);
    add("Actuator rating", R.act * 1000 >= R.Fper * 1.2, R.act * 1000 >= R.Fper, `${M.nact} × ${R.act} kN ≥ 1.2 × ${f(R.Fper / 1000, 1)} kN`);
    add("Float range catches the stop error", M.fl >= R.cap + 5, M.fl >= R.cap, `±${M.fl} ≥ ±${f(R.cap, 1)} mm + 5`);
    add("Ball transfer units", true, true, `${M.nbtu} × ${R.btu} kN (${f(R.Fbtu, 0)} N each)`);
    add("Lock pin re-centres the deck", R.xres <= 8, R.xres <= 12, `springs leave ${f(R.xres, 1)} mm → lock-pin cone with ${R.lockLead} mm lead-in pulls it back`);
    add("Push-up force (current limit)", M.fpre >= 300 && M.fpre <= R.Wl * 0.2, M.fpre <= R.Wl * 0.4, `${M.fpre} N: enough to sit firmly, small vs the lift force ${f(R.Wl / 1000, 1)} kN`);
    add("Deck chains", R.ch.ok, false, `${R.ch.id}: safety ×${f(R.ch.SF, 0)}, roller load ${f(R.ch.Fr, 0)} N`);
    add("Battery runtime", R.run >= 8, R.run >= 4, `${f(R.run, 1)} h at ${f(R.Ph, 0)} W`);
    return c;
  }
  function formulas() {
    $("apCalc").innerHTML = [
      blk("1 · Masses", [`Pallet + workpiece  ${f(R.mpl, 0)} kg (Pallet changer tab)`, `AGV empty          ${f(R.mv, 0)} kg`, `Total              <b>${f(R.mt, 0)} kg</b>`]),
      blk("2 · Heights", [`Transfer height  H0 + stud + 10 = ${H0} + ${LS} + 10 = <b>${R.Ht} mm</b>`, `Deck driving     ${M.hdrive} mm → stroke <b>${f(R.S, 0)} mm</b>`, `Scissor          top ${f(R.ys, 0)}, base ${f(R.base, 0)} mm`]),
      blk("3 · Scissor force (virtual work)", [`Load    W = (pallet + deck + platform)·g·${M.kdyn} = ${f(R.Wl / 1000, 1)} kN`, `F_act·dℓ = W·dh  →  F = W·(dh/dα)/(dℓ/dα)`,
        `Angle   ${f(R.a0 * 180 / Math.PI, 1)}° → ${f(R.a1 * 180 / Math.PI, 1)}°`, `Max     <b>${f(R.Fact / 1000, 1)} kN</b> at the start → ${M.nact} × ${R.act} kN`, `Power   W·v/η = ${f(R.Plift, 0)} W → ${M.nact} × ${R.lmot} W`]),
      blk("4 · Floating deck + docking", [`Error at the pins  ${M.nav} + ${R.zPin}·sin ${M.yaw}° = ±${f(R.cap, 1)} mm`, `Cone lead-in       ${R.lead} mm, cone length ${f(R.lcone, 0)} mm`,
        `Float force        μ·m·g + k·e = ${f(R.Ffric, 0)} + ${f(M.ksp * R.cap, 0)} = ${f(R.Ffloat, 0)} N`, `On the 15° cone    ${f(R.Fv, 0)} N vertical`]),
      blk("5 · Drive", [`Peak force  m·(c_rr·g + slope + a) = ${f(R.Fpk, 0)} N`, `Gear        i = ${R.i}, top speed ${f(R.vtop, 2)} m/s`, `Motor       ${f(R.Tm, 2)} Nm → <b>2 × ${R.mot[0]} W</b>`]),
      blk("6 · Stability", [`CoG driving   (m_v·300 + m_p·(${M.hdrive} + ${f(R.hg, 0)}))/m = ${f(R.hA, 0)} mm`, `Forward       g·${f(R.xs, 0)}/(a·h) = ×${f(R.SFa, 1)}`, `Sideways      a = v²/R = ${f(R.alat, 2)} → ×${f(R.SFlat, 1)}`]),
      blk("7 · Chains + pallet", [`Chain force  ${f(R.ch.Ft, 0)} N → ${R.ch.id}, motor ${R.chmot} W`, `Transfer     ${f(R.L, 0)} mm in ${f(R.ttr, 1)} s`, `Pawl         m·a·1.5 = ${f(R.Fpawl, 0)} N`]),
      blk("8 · Cycle at the station", [`One hand-over  <b>${f(tot(), 0)} s</b> (see steps)`, `Battery        ${f(R.run, 1)} h at ${f(R.Ph, 0)} W`]),
    ].join("");
  }
  function conceptTab() {
    const rows = [["Deck height while driving", `${M.hdrive} mm`, `${R.Ht} mm`], ["Lift stroke", `${f(R.S, 0)} mm (scissor)`, "40 mm (docking only)"], ["CoG height (loaded)", `${f(R.hA, 0)} mm`, `${f(R.hB, 0)} mm`],
      ["Tipping safety at " + M.ab + " m/s²", `×${f(R.SFa, 1)}`, `×${f(R.SFb, 1)}`], ["Max. braking for safety ×1.5", `${f(G * R.xs / (1.5 * R.hA), 2)} m/s²`, `${f(R.abB, 2)} m/s²`],
      ["Braking distance from " + M.vmax + " m/s", `${f(R.sA, 0)} mm`, `${f(R.sB, 0)} mm`], ["Sideways safety in curves", `×${f(R.SFlat, 1)}`, `×${f(G * R.zs / (R.alat * R.hB), 1)}`], ["Lift mass / cost", "high (scissor, 2 actuators)", "low"], ["Pallet visible / reachable for people", "low while driving", "at chest height – more risk"]];
    $("apConcept").innerHTML = `<thead><tr><th></th><th style="color:var(--accent)">A · low deck + scissor ✓</th><th>B · fixed high deck</th></tr></thead><tbody>${rows.map(([n, x, y]) => `<tr><td><b>${esc(n)}</b></td><td style="background:color-mix(in srgb, var(--accent) 8%, transparent)">${esc(x)}</td><td>${esc(y)}</td></tr>`).join("")}</tbody>`;
    $("apConceptNote").innerHTML = R.abB < M.ab
      ? `With the pallet at ${R.Ht} mm (B) the AGV may only brake with ${f(R.abB, 2)} m/s² → longer braking, longer safety fields, slower driving. Here <b>A</b> is clearly better.`
      : `With these values both concepts can brake with ${M.ab} m/s²; B keeps tipping safety ×${f(R.SFb, 1)}. So B is <b>possible</b> and simpler (no scissor). A is still chosen in mechanical item 1 because: more reserve (×${f(R.SFa, 1)}), a heavy pallet does not travel at chest height past people, and a heavier workpiece later (or a smaller AGV) does not make B unsafe. Decide with your real pallet weight and route.`;
  }
  function ioTab() {
    const rows = [["-B20", "Deck height (actuator encoders, 2×)", "→ vehicle PC; synchronise both actuators"], ["-B21, -B22", "Deck DOWN / UP end switches", "→ safety ctrl: driving only with DOWN"],
      ["-B23, -B24", "Lock pin locked / unlocked", "→ vehicle PC"], ["-B25, -B26", "Docked: bush on cone (inductive, left / right)", "→ vehicle PC + E84"],
      ["-B27", "Stop faces reached (actuator current + switch)", "→ vehicle PC"], ["-B28, -B29", "Pallet present front / rear on the deck", "→ vehicle PC"],
      ["-B30", "Retention pawl closed", "→ safety ctrl (no driving without pawl closed + pallet)"], ["-M20, -M21", "Scissor actuators (servo, CANopen node 4 / 5)", "STO from the safety ctrl"],
      ["-M22", "Deck chain gear motor (48 V, node 6)", "run fwd / rev with the station (BUSY)"], ["-Y20 / -Y21", "Lock pin / pawl solenoids", "← vehicle PC"], ["-A20", "E84 optical I/O", "VALID, CS_0, TR_REQ, BUSY, COMPT ↔ L_REQ, U_REQ, READY, HO_AVBL, ES"]];
    $("apIO").innerHTML = `<thead><tr><th>Tag</th><th>Device</th><th>Signal</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody>`;
    const ifr = [["Transfer height (chain top)", `${R.Ht} mm`, "station + AGV"], ["Stop faces (underside)", `${R.Ht + 40} mm, flat ±0.05`, "station"], ["Cone pins", `Ø25 g6, 15°, at x = ${f(R.xPin, 0)}, z = ±${R.zPin} (round + diamond)`, "station"],
      ["Docking bushes", `Ø25 H7, lead-in ≥ ${R.lead} mm`, "AGV"], ["Chain strands", `${R.ch.id} at z = ±${R.zc}, same pitch line`, "both"], ["Gap station ↔ AGV chain", `${M.gap} mm`, "both"],
      ["AGV stop", `±${M.nav} mm / ±${M.yaw}°, deck float ±${M.fl} mm`, "AGV"], ["Push-up force", `${M.fpre} N (current limit)`, "AGV"], ["Handshake", "E84 optical, sensor at the docking post", "both"], ["Transfer speed", `${M.vt} m/s, start / stop together`, "both"]];
    $("apIf").innerHTML = `<thead><tr><th>Item</th><th>Value</th><th>Who</th></tr></thead><tbody>${ifr.map(([a, b, c]) => `<tr><td><b>${esc(a)}</b></td><td>${esc(b)}</td><td class="muted">${esc(c)}</td></tr>`).join("")}</tbody>`;
  }
  function bom() {
    const rows = [["Chassis frame + floor plate + covers", "MAKE", 1, `${f(R.lA, 0)} × ${R.wA} mm`, ""], ["Drive module (rocker, BLDC + gearbox, PU wheel)", "BUY / MAKE", 2, `${R.mot[0]} W, i = ${R.i}, Ø${M.Dw}`, ""],
      ["Sprung castor", "BUY", 4, "Ø150 PU", ""], ["Battery LiFePO4 + BMS", "BUY", 1, `${M.Ub} V ${M.Ah} Ah`, ""], ["Scissor arms (2 pairs) + pins + bushes", "MAKE", 1, `L = ${M.La} mm, S355`, ""],
      ["Scissor base + C-rails + rollers", "MAKE", 1, "", ""], ["Electric actuator 48 V, encoder, brake", "BUY", M.nact, `${R.act} kN, stroke ≥ ${f(R.astroke + 20, 0)} mm, ${R.lmot} W`, "servo, CANopen"],
      ["Top platform", "MAKE", 1, "S355 10 mm + stiffeners", ""], ["Ball transfer units", "BUY", M.nbtu, `${R.btu} kN`, ""], ["Floating deck frame + chain beams", "MAKE", 1, `${R.A.a + 60} × ${R.A.b + 60} mm`, ""],
      ["Roller chain + sprockets + guides", "BUY", 2, `${R.ch.id}`, ""], ["Chain gear motor 48 V", "BUY", 1, `${R.chmot} W`, ""], ["Centring springs + electric lock pin", "BUY", 1, `${M.ksp} N/mm`, ""],
      ["Docking arms + hardened bushes", "MAKE", 2, `Ø25 H7, lead-in ${R.lead} mm`, ""], ["Retention pawl + solenoid", "MAKE / BUY", 1, `${f(R.Fpawl, 0)} N`, ""], ["Side guides UHMW-PE", "MAKE", 2, "", ""],
      ["Safety scanners, safety ctrl, navigation PC, drives", "BUY", 1, "as item 1 / item 2", ""], ["E84 optical I/O", "BUY", 1, "", ""], ["Sensors (deck, lock, docked, pallet, pawl)", "BUY", 11, "M12 inductive / diffuse", ""]];
    $("apBom").innerHTML = `<thead><tr><th>#</th><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r[0])}</td><td><span class="apc-mb ${String(r[1]).split(" ")[0]}">${esc(r[1])}</span></td><td>${r[2]}</td><td>${esc(r[3])}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}</tbody>`;
  }
  function guide() {
    $("apGuide").innerHTML = `
      <h3>1 · What is different from the crate AGV (item 1)</h3>
      <ul class="apc-list"><li>${f(R.mt, 0)} kg instead of ~500 kg → Ø${M.Dw} wheels, ${R.mot[0]} W drives, bigger battery.</li>
        <li>Big lift (${f(R.S, 0)} mm) → scissor with 2 servo actuators, synchronised by the encoders.</li>
        <li>The pallet must arrive at the station ±0.02 mm → the AGV only brings it ±${M.nav} mm; the <b>floating deck + cone pins + stop faces</b> do the rest (mechanical item 1).</li></ul>
      <h3>2 · Manufacture</h3>
      <ol class="apc-list"><li>Scissor arms: weld in a jig, ream the pivot bores of the two arms of a pair together (H7). Pins hardened, bronze bushes, grease nipples.</li>
        <li>Top platform: machine the ball-unit seats in one set-up (±0.1 mm).</li>
        <li>Floating deck: chain beams parallel ±0.2 mm; docking bushes at exactly x = ${f(R.xPin - R.L, 0)} mm from the deck centre, z = ±${R.zPin} mm (bore in one set-up with the chain-beam seats).</li>
        <li>Lock pin: conical, the hole in the deck with the same cone; centring springs pre-loaded equally on all 4 sides.</li></ol>
      <h3>3 · Commission</h3>
      <ol class="apc-list"><li>Actuators: set both encoders to zero at DOWN; test synchronous running (difference ≤ 2 mm), then limit switches.</li>
        <li>Current limit for the push-up: increase slowly until the deck sits on the stop faces with ${M.fpre} N (load cell under one face).</li>
        <li>Teach the station: drive in 10 ×, check that the cones always catch (offset test ±${M.nav + 2} mm by teaching wrong positions on purpose).</li>
        <li>Transfer: run the AGV and station chains together, check the pallet crosses the ${M.gap} mm gap without a step &gt; 3 mm.</li>
        <li>Interlocks: try to drive with the deck up, with the lock pin open, with the pawl open → all blocked by the safety controller.</li></ol>
      <h3>4 · Acceptance tests</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Accept</th></tr></thead><tbody>
        <tr><td>Docking</td><td>50 deliveries + 50 pick-ups, AGV stops anywhere within ±${M.nav} mm</td><td>no fault, pallet clamped every time</td></tr>
        <tr><td>Height</td><td>dial gauge on the deck chain top when docked</td><td>${R.Ht} ±0.2 mm</td></tr>
        <tr><td>Emergency stop loaded</td><td>${M.vmax} m/s, E-stop</td><td>pallet stays, no tipping, distance ≤ calculated</td></tr>
        <tr><td>Power loss with the deck up</td><td>switch off at the top</td><td>deck holds (actuator brakes), lowers only by command</td></tr></tbody></table></div>`;
  }
  function info(key) {
    const el = $("ap3dInfo"), p = key && partInfo(key, R, M);
    if (!p) {
      const rows = [["Pallet", `${A.a} × ${A.b} mm, ${f(R.mpl, 0)} kg`], ["AGV empty / total", `${f(R.mv, 0)} / ${f(R.mt, 0)} kg`], ["Body", `${f(R.lA, 0)} × ${R.wA} mm`], ["Drive", `2 × ${R.mot[0]} W`],
        ["Deck", `${M.hdrive} → ${R.Ht} mm (${f(R.S, 0)})`], ["Actuators", `${M.nact} × ${R.act} kN`], ["Float", `±${M.fl} mm (needs ±${f(R.cap, 1)})`], ["Hand-over", `${f(tot(), 0)} s`]];
      el.innerHTML = `<div class="apc-pi-h"><b>Pallet AGV – main values</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
        <p class="hint">Click a part for its data. The floating offset (${6} mm stop error) is real size – zoom in at the docking bushes to see the deck shift.</p>`; return;
    }
    const [n, mb, matl, fn, spec, mfg] = p;
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b>${mb ? `<span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span>` : ""}</div>
      ${fn ? `<p>${esc(fn)}</p>` : ""}${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material / type</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="apBack">◀ main values</button>`;
    $("apBack").onclick = () => info(null);
  }
  function render() {
    A = apc(); R = calc(M, A); ST = steps(R, M, task); T = Math.min(T, tot());
    const ch = checks();
    $("apKpis").innerHTML = [["Total mass", f(R.mt, 0) + " kg", `AGV ${f(R.mv, 0)} + pallet ${f(R.mpl, 0)}`], ["Lift stroke", f(R.S, 0) + " mm", `${M.hdrive} → ${R.Ht} mm`], ["Actuator force", f(R.Fact / 1000, 1) + " kN", `at the start, ${M.nact} × ${R.act} kN`],
      ["Tipping safety", "×" + f(R.SFa, 1), `deck low, ${M.ab} m/s²`], ["Float", "±" + M.fl + " mm", `needs ±${f(R.cap, 1)} mm`], ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("apChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    $("apS").textContent = f(R.S, 0);
    formulas(); conceptTab(); ioTab(); bom(); guide(); $("apStack").innerHTML = stackSVG(R, M);
    const k = JSON.stringify([M, A]);
    if (view && k !== geo) { geo = k; view.build(R, M); view.setLabels($("apLbl").checked); view.setCovers($("apCov").checked); info(null); }
    draw();
  }
  function draw() {
    const s = stateAt(T, ST, R, M, task);
    if (view) view.update(s);
    $("apStep").innerHTML = `Step ${s.k + 1}/${ST.length}: <b>${esc(ST[s.k][1])}</b> <span class="muted">${f(T, 1)} / ${f(tot(), 1)} s</span>`;
    $("apScrub").value = Math.round(T / tot() * 1000); $("apPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("apSteps").innerHTML = ST.map((r, i) => `<tr class="${i === s.k ? "on" : ""}"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
    $("apLift").innerHTML = liftSVG(R, M, s.h);
  }
  function init() {
    if (view) { view.resize(); return; }
    try { view = create3D($("ap3d")); } catch (e) { $("ap3d").innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe($("ap3d")); view.resize(); view.onPick(info);
    geo = JSON.stringify([M, A]); view.build(R, M); info(null); draw();
    if (started) return; started = true;
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active") || boxP.hidden) return;
      if (playing) { T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); }
      view.frame(playing ? dt : 0, M.vt); };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("apInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = M[k]; return; }
    M[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("agvPalState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("apReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("agvPalState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("apPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("apScrub").addEventListener("input", (e) => { playing = false; T = tot() * e.target.value / 1000; draw(); });
  boxP.querySelectorAll("[data-aptask]").forEach((b) => b.addEventListener("click", () => {
    boxP.querySelectorAll("[data-aptask]").forEach((x) => x.classList.toggle("active", x === b)); task = b.dataset.aptask; T = 0; playing = false; ST = steps(R, M, task); draw(); }));
  boxP.querySelectorAll("[data-apview]").forEach((b) => b.addEventListener("click", () => view && view.fit(b.dataset.apview)));
  $("apLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  $("apCov").addEventListener("change", (e) => view && view.setCovers(e.target.checked));
  window.agvPal = { show() { render(); init(); } };
  const prevShown = window.onTabShown;
  window.onTabShown = (name) => { if (prevShown) prevShown(name); if (name === "agv" && !boxP.hidden) init(); };
  const q = new URLSearchParams(location.search);
  if (q.get("aptask")) setTimeout(() => { const b = boxP.querySelector(`[data-aptask="${q.get("aptask")}"]`); if (b) b.click(); }, 500);
  if (q.get("apt")) setTimeout(() => { T = Math.min(tot(), parseFloat(q.get("apt")) || 0); draw(); }, 650);
  if (q.get("apview")) setTimeout(() => { view && view.fit(q.get("apview")); }, 700);
  if (q.get("appart")) setTimeout(() => info(q.get("appart")), 800);
}
