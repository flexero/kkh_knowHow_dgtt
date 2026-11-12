/* AGV build tab - item 1: underride (latent) lifting AGV for the crates of mechanical items 2 and 3.
   Everything you need to MAKE one in reality: chassis, drive rocker, sprung castors, castors, eccentric cam lift,
   battery, control system (safety controller, navigation PC, drives), safety fields (ISO 3691-4) and the stop accuracy
   (where the ±mm come from, how to measure it).  All values are examples - check them with catalogue data.
   Coordinates: mm, Y up, x = driving direction (front +x), z = sideways, origin = floor below the AGV centre.
   Fully offline: three.js from web/vendor, own mouse control from view3d.js. */
import * as THREE from "three";
import { OrbitControls } from "three/addons/OrbitControls.js";
import { niceControls } from "./view3d.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const f = (v, d = 1) => (Number.isFinite(v) ? (Math.round(v * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d }) : "–");
const G = 9.81, NMOT = 3000;
const STD_I = [5, 7, 10, 12, 15, 16, 20, 25, 30, 35, 40];               // planetary gearbox ratios
const LIFT_I = [40, 50, 60, 80, 100, 120, 150, 200];                     // worm gear motor ratios
const MOT = [[100, 0.32, 0.95], [200, 0.64, 1.9], [400, 1.27, 3.8], [750, 2.39, 7.1], [1000, 3.18, 9.5]]; // 48 V BLDC 3000 rpm: W, rated Nm, peak Nm
const ROLL = [["KR 22", 22, 3.3], ["KR 26", 26, 3.9], ["KR 30", 30, 6.0], ["KR 32", 32, 6.6], ["KR 35", 35, 7.6], ["KR 40", 40, 9.4]]; // track roller, Ø, C kN (approx.)
const CASTOR = [[100, 150], [125, 200], [150, 300]];                      // castor Ø, rated kg

const GROUPS = [
  ["Vehicle + load", [
    ["L", "AGV length", "mm", 1100, "drives under the crate along its length"],
    ["W", "AGV width", "mm", 560, "items 2/3: 680 mm clear between the rails"],
    ["H", "AGV height (lift plate down)", "mm", 300, "items 2/3: crate rails at H + 20"],
    ["mp", "Rated payload", "kg", 300, "crate 203 kg + reserve"],
    ["mcr", "Crate mass, full", "kg", 203, "item 2"],
    ["cl", "Crate length", "mm", 1200, ""], ["cw", "Crate width", "mm", 800, ""], ["ch", "Crate height", "mm", 600, ""],
    ["hcg", "Crate CoG above the crate bottom", "mm", 250, "castings lie low"],
    ["ecg", "Crate CoG off-centre (sideways)", "mm", 50, "uneven filling"]]],
  ["Drive (2 drive wheels in the middle + 4 castors)", [
    ["vmax", "Max. speed (free route)", "m/s", 1.2, ""],
    ["vst", "Speed near stations / under the stand", "m/s", 0.3, ""],
    ["acc", "Acceleration", "m/s²", 0.5, ""],
    ["dec", "Emergency deceleration (design)", "m/s²", 0.8, "limited by the wheel grip"],
    ["Dw", "Drive wheel Ø (PU tread)", "mm", 150, ""],
    ["crr", "Rolling resistance", "", 0.015, "PU on concrete + castors"],
    ["slope", "Max. floor slope / ramp", "%", 1, ""],
    ["mu", "Grip PU ↔ floor (dusty floor)", "", 0.35, "clean 0.5–0.6, foundry dust ~0.3"],
    ["shr", "Weight share on the 2 drive wheels", "%", 50, "set by the castor springs"],
    ["kc", "Spring rate per sprung castor", "N/mm", 40, ""],
    ["df", "Floor unevenness + castor wear", "± mm", 4, ""],
    ["vc", "Speed in curves", "m/s", 0.6, ""],
    ["rc", "Curve radius", "m", 1, ""]]],
  ["Lift – all types (choose the type above the 3D view)", [
    ["s", "Lift stroke", "mm", 50, "crate must rise ≥ 15 mm off the rails"],
    ["tl", "Lift time", "s", 1.3, "item 3: about 40 mm/s"],
    ["kdyn", "Dynamic / off-centre factor", "", 1.3, ""],
    ["etaw", "Cam: worm gear efficiency", "", 0.6, "self-locking below ~0.5 at standstill"],
    ["psc", "Screw jack: screw pitch", "mm", 6, "Tr 30 × 6"],
    ["esc", "Screw jack: efficiency (screw + worm)", "", 0.3, "trapezoidal ≈ 0.3 (self-locking), ball screw ≈ 0.75"],
    ["La", "Scissor: arm length (pivot to pivot)", "mm", 500, ""],
    ["h0", "Scissor: height when closed", "mm", 90, ""],
    ["ph", "Hydraulic: max. system pressure", "bar", 100, ""],
    ["ncy", "Hydraulic: number of cylinders", "", 4, ""]]],
  ["Battery + energy", [
    ["Ub", "Battery voltage (LiFePO4)", "V", 48, ""],
    ["Ah", "Battery capacity", "Ah", 60, ""],
    ["trips", "Transports per hour", "1/h", 8, ""],
    ["dtrip", "Route per transport (loaded + empty)", "m", 120, ""],
    ["stops", "Stops per transport", "", 6, "stations, crossings, doors"],
    ["Pel", "Electronics + idle losses (PC, scanners, Wi-Fi, drives)", "W", 150, ""],
    ["Pch", "Charger power", "kW", 1.5, "floor contacts, ~30 A"],
    ["dod", "Usable part of the capacity", "", 0.8, ""]]],
  ["Safety (ISO 3691-4)", [
    ["tsc", "Scanner response time", "s", 0.07, ""],
    ["tct", "Safety controller + STO + brake reaction", "s", 0.1, ""],
    ["Zs", "Scanner tolerance + reserve", "mm", 100, ""]]],
  ["Stop accuracy – error sources", [
    ["nav", "Localisation error (navigation)", "± mm", 8, "lidar contour – see the table"],
    ["navy", "Localisation angle error", "± °", 0.3, ""],
    ["vcr", "Final creep speed", "m/s", 0.05, ""],
    ["tcy", "Control cycle time", "s", 0.02, ""],
    ["dfix", "Last metres driven on wheel encoders only", "mm", 300, ""],
    ["dDw", "Wheel Ø tolerance / wear", "%", 0.5, ""],
    ["blash", "Gearbox backlash", "arcmin", 15, ""],
    ["smnt", "Scanner mount angle error", "°", 0.05, "bracket stiffness"],
    ["dcont", "Distance to the map contour", "m", 4, ""],
    ["gpl", "Lift plate guide play", "mm", 0.3, ""]]],
];
const DEF = {}; GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { DEF[k] = d; }));
DEF.lt = "cam";                                                       // lift type: cam | screw | scissor | hyd
const LIFT_NAMES = { cam: "Eccentric cam", screw: "Screw jack", scissor: "Scissor", hyd: "Hydraulic" };
const pickStd = (list, v) => { let r = list[0]; for (const x of list) if (x <= v) r = x; return r; };
const nearest = (list, v) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/* ------------------------------------------------------------------ calculation */
function calc(M) {
  const R = {};
  R.Lp = M.L - 60; R.Wp = M.W - 40;                                   // lift plate
  R.zw = M.W / 2 - 60; R.trk = 2 * R.zw;                              // drive wheels
  R.xc = M.L / 2 - 160; R.zc = M.W / 2 - 70;                          // castors
  R.xs = M.L / 2 - 170;                                               // cam shafts
  R.kWh = M.Ub * M.Ah / 1000;
  R.Lb = R.kWh * 1000 / 170 * 1e6 / (240 * 150);                      // battery length: 170 Wh/L, 240 wide, 150 high
  // ---- lift: all 4 types are calculated (comparison table); the chosen type M.lt is used for the design
  R.mpl = R.Lp * R.Wp * 15 * 2.7e-6 + R.Lp * R.Wp * 5 * 1.2e-6;
  R.Fl = (M.mp + R.mpl) * G * M.kdyn;                                  // design lift force (dynamic / off-centre factor)
  R.mlift = (M.mcr + R.mpl) * G;                                       // real weight lifted (energy)
  R.vl = M.s / M.tl; R.vpk = Math.PI / 2 * R.vl;                       // mm/s average / peak (soft start + stop)
  const LT = {};
  // cam: eccentric cam disc under a follower roller on the plate
  R.e = M.s / 2; R.Tcam = R.Fl * R.e / 1000;                           // Nm, both shafts, at 90°
  R.ilreq = NMOT / (30 / M.tl); R.il = nearest(LIFT_I, R.ilreq);
  R.tlc = 30 / (NMOT / R.il); R.wcam = Math.PI / R.tlc;
  R.Tlm = R.Tcam / (R.il * M.etaw); R.Plpk = R.Tcam * R.wcam / M.etaw;
  R.Frol = R.Fl / 4; R.roll = ROLL.find((r) => r[2] * 1000 >= R.Frol * 3) || ROLL[ROLL.length - 1];
  R.rr = R.roll[1] / 2; R.Rc = R.e + 25;
  R.ys = M.H - 70 - R.rr;                                              // cam shaft height
  LT.cam = { t: R.tlc, Pk: R.Plpk, Tm: R.Tlm, mot: MOT.find((m) => R.Tlm <= m[2] * 0.8 && R.Plpk <= m[0] * 2.5) || MOT[MOT.length - 1],
    E: R.mlift * M.s / 1000 / M.etaw, mass: 18, pos: "2 (down / up)", hold: "yes – dead centre + self-locking worm", maint: "low – grease cams + rollers",
    best: "fixed stroke 30–60 mm, fast, simple", cost: "low" };
  // screw jack: 2 worm screw jacks (front / rear) on one cross shaft
  { const n = R.vpk / M.psc * 60, i = NMOT / n, Tj = R.Fl / 2 * M.psc / (2 * Math.PI * M.esc) / 1000, Tm = 2 * Tj / (i * 0.95), Pk = R.Fl * R.vpk / 1000 / M.esc;
    LT.screw = { t: M.tl, Pk, Tm, n, i, Tj, self: M.esc <= 0.35, mot: MOT.find((m) => Tm <= m[2] * 0.8 && Pk <= m[0] * 2.5) || MOT[MOT.length - 1],
      E: R.mlift * M.s / 1000 / M.esc, mass: 24, pos: "any height (motor encoder)", hold: M.esc <= 0.35 ? "yes – trapezoidal screw is self-locking" : "NO – ball screw needs a brake",
      maint: "medium – grease screws, nut wear", best: "different heights, lift + turn units", cost: "medium" }; }
  // scissor: 2 scissor pairs, horizontal electric actuator on the rolling foot
  { const a0 = Math.asin(Math.min(0.98, M.h0 / M.La)), a1 = Math.asin(Math.min(0.99, (M.h0 + M.s) / M.La));
    const F0 = R.Fl / Math.tan(a0), F1 = R.Fl / Math.tan(a1), xa = M.La * (Math.cos(a0) - Math.cos(a1)), Pk = R.Fl * R.vpk / 1000 / 0.8;
    const act = [6, 10, 16, 25, 40, 63].find((x) => x * 1000 >= F0 * 1.2) || 63;
    LT.scissor = { t: M.tl, Pk, a0, a1, F0, F1, xa, act, lever: F0 / R.Fl, mot: MOT.find((m) => Pk <= m[0] * 2.5) || MOT[MOT.length - 1],
      E: R.mlift * M.s / 1000 / 0.72, mass: 26 + act * 0.4, pos: "any height (encoder)", hold: "yes – actuator self-locking or brake", maint: "medium – many pivots",
      best: "large strokes (> 150 mm)", cost: "medium" }; }
  // hydraulic: single-acting cylinders + 48 V power unit (pump, tank, check valve, lowering valve)
  { const n = Math.max(1, Math.round(M.ncy)), dreq = Math.sqrt(4 * R.Fl / (n * M.ph * 0.1) / Math.PI);
    const d = [20, 25, 32, 40, 50, 63].find((x) => x >= dreq) || 63, A = Math.PI * d * d / 4, p = R.Fl / (n * A) / 0.1;
    const Q = n * A * R.vl, Pk = p * 0.1 * Q / 1000 / 0.55, oil = n * A * (M.s + 20) / 1e6 + 0.5;
    const hm = [300, 500, 800, 1200, 2000].find((w) => w >= Pk * 1.2) || 2000;
    LT.hyd = { t: M.tl, Pk, n, d, dreq, p, Q: Q * 60 / 1e6, oil, mot: [hm, 0, 0], E: R.mlift * M.s / 1000 / 0.55, mass: 20 + n * 1.5,
      pos: "2 (any with a proportional valve)", hold: "check valve – sinks slowly by leakage", maint: "high – oil, seals, hoses, leaks", best: "heavy AGVs ≥ 1.5 t, forklift AGVs", cost: "medium–high" }; }
  for (const k in LT) LT[k].name = LIFT_NAMES[k];
  R.lifts = LT; R.lt = LT[M.lt] ? M.lt : "cam"; R.L = LT[R.lt];
  R.tlr = R.L.t; R.lmot = R.L.mot; R.Elift = R.L.E;
  R.mass = [
    ["Chassis frame (tube 80×40×3)", (2 * M.L + 2 * M.W + 600) / 1000 * 5.4],
    ["Floor plate 8 mm", M.L * 360 * 8 * 7.85e-6],
    ["Covers 2 mm", 2 * (M.L + M.W) * (M.H - 40) * 2 * 7.85e-6],
    ["Lift plate (Al 15 mm) + PU pad", R.Lp * R.Wp * 15 * 2.7e-6 + R.Lp * R.Wp * 5 * 1.2e-6],
    [`Lift mechanism (${R.L.name})`, R.L.mass],
    ["Drive modules 2 × (wheel, gearbox, motor, arm, spring)", 32],
    ["Castors 4 ×", 10],
    [`Battery LiFePO4 ${f(R.kWh, 1)} kWh + BMS`, R.kWh * 9],
    ["Electronics, scanners, cables", 16]];
  R.me = R.mass.reduce((s, r) => s + r[1], 0);
  R.mt = R.me + M.mp;
  // drive
  R.Froll = M.crr * R.mt * G; R.Fsl = R.mt * G * M.slope / 100; R.Facc = R.mt * M.acc; R.Fpk = R.Froll + R.Fsl + R.Facc;
  R.nw = M.vmax * 60 / (Math.PI * M.Dw / 1000);
  R.ireq = NMOT / R.nw; R.i = pickStd(STD_I, R.ireq / 0.97);            // largest ratio that still gives ≥ 97 % of v_max
  R.vreal = NMOT / R.i * Math.PI * M.Dw / 1000 / 60;
  R.Tw = R.Fpk / 2 * M.Dw / 2000; R.Tm = R.Tw / (R.i * 0.9);
  R.Tmc = (R.Froll + R.Fsl) / 2 * M.Dw / 2000 / (R.i * 0.9);
  R.Pc = (R.Froll + R.Fsl) * M.vmax / 0.9 / 2; R.Ppk = R.Fpk * M.vmax / 0.9 / 2;
  R.mot = MOT.find((m) => R.Tm <= m[2] * 0.8 && R.Tmc <= m[1] * 0.8 && R.Pc <= m[0] * 0.6) || MOT[MOT.length - 1];
  // grip, suspension, castors
  // drive wheels rigid in a rocker, castors sprung: the drive wheels carry a fixed SHARE of the weight (empty and loaded)
  R.dN = M.kc * M.df;                                                  // floor step at one castor shifts this force
  R.Ne = M.shr / 100 * R.me * G / 2; R.Nl = M.shr / 100 * R.mt * G / 2; // per drive wheel, empty / loaded
  R.Nmin = Math.min(R.Ne - R.dN, R.Nl - R.dN); R.Nmax = R.Nl + R.dN;
  R.Fpke = R.me * (M.crr * G + G * M.slope / 100 + M.acc);
  R.trSF = Math.min(M.mu * (R.Nl - R.dN) / (R.Fpk / 2), M.mu * (R.Ne - R.dN) / (R.Fpke / 2));
  R.abmax = Math.min(2 * M.mu * (R.Ne - R.dN) / R.me, 2 * M.mu * (R.Nl - R.dN) / R.mt);
  R.wrate = M.Dw >= 200 ? 500 : M.Dw >= 150 ? 350 : 250;              // PU drive wheel rating, kg (typ.)
  R.Fcast = (R.mt * G * (1 - M.shr / 100) / 4 * 1.25 + R.dN) / G;
  R.castor = CASTOR.find((c) => c[1] >= R.Fcast) || CASTOR[CASTOR.length - 1];
  // stability
  R.hcg = (R.me * 120 + M.mp * (M.H + M.s + M.hcg)) / R.mt;
  R.SFlong = G * R.xc / (M.dec * R.hcg);
  R.alat = M.vc ** 2 / M.rc;
  R.SFlat = (R.zc - M.ecg * M.mp / R.mt) * G / (R.alat * R.hcg);
  R.SFpad = 0.5 / (M.dec / G);
  R.liftoff = M.s - 20; R.under = 20 - M.df; R.vlift = M.s / R.tlr;
  // energy
  R.mavg = R.me + M.mcr / 2;
  R.Eroll = M.crr * R.mavg * G * M.dtrip; R.Eacc = M.stops * 0.5 * R.mavg * M.vmax ** 2;
  R.Etrip = (R.Eroll + R.Eacc) / 0.8 + R.Elift;
  R.Ph = M.trips * R.Etrip / 3600 + M.Pel;
  R.Ebat = M.Ub * M.Ah * M.dod; R.run = R.Ebat / R.Ph;
  R.chg = R.Ph / (M.Pch * 1000 * 0.92); R.tch = R.Ebat / (M.Pch * 1000 * 0.92);
  R.Ipk = (2 * R.Ppk / 0.9 + M.Pel) / M.Ub; R.Crate = R.Ipk / M.Ah;
  R.ttrip = M.dtrip / (0.7 * M.vmax) + M.stops * M.vmax / M.acc + 2 * R.tlr + 20;
  R.util = M.trips * R.ttrip / 3600 + R.chg;
  // safety fields
  R.tr = M.tsc + M.tct;
  const vs = [...new Set([M.vst, 0.6, 1.0, M.vmax].filter((v) => v <= M.vmax + 1e-9))].sort((a, b) => a - b);
  // braking downhill on the allowed slope: effective deceleration a_eff = a − g·slope (guide 11 §23.3)
  R.decEff = Math.max(0.05, M.dec - G * M.slope / 100);
  R.fields = vs.map((v) => { const Dp = v * R.tr * 1000 + v * v / (2 * R.decEff) * 1000 * 1.1 + M.Zs; return { v, Dp, Dw: Dp + v * 1000 }; });
  R.Dmax = R.fields[R.fields.length - 1].Dp;
  // stop accuracy
  R.acc = [
    ["Localisation (navigation)", M.nav, "how well the AGV knows where it is"],
    ["Stop control: creep speed × cycle", M.vcr * M.tcy * 1000 + M.vcr * 0.01 * 1000, `${M.vcr} m/s × (${M.tcy} s + 0.01 s brake scatter)`],
    ["Odometry on the last metres", M.dfix * M.dDw / 100, `${M.dfix} mm × ${M.dDw} %`],
    ["Gearbox backlash", M.Dw / 2 * M.blash / 60 * Math.PI / 180, `r × ${M.blash}′`],
    ["Scanner mount angle", M.smnt * Math.PI / 180 * M.dcont * 1000, `${M.smnt}° × ${M.dcont} m to the contour`],
    ["Floor tilt (plate top moves)", (M.H + M.s) * M.df / R.trk, `${M.H + M.s} mm × ${M.df}/${R.trk}`],
    ["Lift plate guide play", M.gpl, ""]];
  R.accRSS = Math.sqrt(R.acc.reduce((s, r) => s + r[1] ** 2, 0));
  R.accSum = R.acc.reduce((s, r) => s + r[1], 0);
  R.yaw = Math.hypot(M.navy, M.smnt, Math.atan2(R.acc[1][1] * 2, R.trk) * 180 / Math.PI);
  R.capt = R.accRSS + M.cl / 2 * Math.sin(R.yaw * Math.PI / 180);
  return R;
}

function steps(R, M) {
  return [
    ["in", `Drive under the stand at ${M.vst} m/s – field switches to the short docking field`, 2270 / (M.vst * 1000)],
    ["fine", `Final stop on creep speed ${M.vcr} m/s – stop error ±${f(R.accRSS, 1)} mm`, 1.2],
    ["lift", `Lift: ${{ cam: "cams turn 0 → 180°", screw: "2 screw jacks turn", scissor: "the scissor opens", hyd: "the pump fills the cylinders" }[R.lt]}, crate rises ${f(R.liftoff, 0)} mm off the rails`, R.tlr],
    ["out", "Drive away with the crate – normal fields again after the stand", 2300 / (M.vst * 1000)]];
}
function stateAt(T, ST, R, M) {
  let k = 0, t0 = 0;
  while (k < ST.length - 1 && T > t0 + ST[k][2]) { t0 += ST[k][2]; k++; }
  const u = Math.max(0, Math.min(1, (T - t0) / ST[k][2])), id = ST[k][0];
  let x = 0, th = 0;
  if (id === "in") x = -2300 + 2270 * u;
  else if (id === "fine") x = -30 + 30 * u;
  else if (id === "lift") th = Math.PI * u;
  else { th = Math.PI; x = 2300 * u * u * (3 - 2 * u); }
  const top = M.H + M.s * (1 - Math.cos(th)) / 2;
  const carry = id === "out";
  return { k, u, x, th, top, cx: carry ? x : 0, cy: Math.max(M.H + 20, top), field: id === "in" && x < -1300 ? "norm" : (id === "out" && x > M.cl / 2 + 300 ? "norm" : "dock"),
    dir: 1, v: id === "in" || id === "out" ? M.vst : id === "fine" ? M.vcr : 0 };
}

/* ------------------------------------------------------------------ part data */
function partInfo(key, R, M) {
  const I = {
    frame: ["Chassis frame", "MAKE", "S355 rectangular tube 80 × 40 × 3, welded", "Carries everything: castors, drive modules, battery, lift. Pockets around the drive wheels (bridge tubes above them).",
      `${M.L} × ${M.W} mm. After welding: machine the drive-module and castor mounting faces in one set-up (flat ±0.2 mm), bearing brackets of the cam shafts in line ±0.1 mm.`,
      "Weld in a jig, stress-relieve or weld symmetrically; zinc-rich primer + powder coat."],
    floor: ["Floor plate", "MAKE", "S235, 8 mm, laser cut", "Closes the frame from below, stiffens it (shear plate), carries battery and electronics.", "Cut-outs for drive wheels, castors and charging contacts.", "Laser cut, screwed + bonded to the frame."],
    cover: ["Covers", "MAKE", "sheet steel 2 mm (or Al 3 mm), powder coated", "Protect against crushing and dirt; windows for the scanners; carry E-stops and the LED strip.",
      `Gap to the floor ≤ 30 mm; no crushing points between cover and lift plate (gap ≥ 25 mm or ≤ 8 mm, ISO 13854).`, "Removable for service; side cover with quick release for the battery."],
    plate: ["Lift plate + PU pad", "MAKE", "Al 5083 15 mm, milled; PU pad 5 mm 80 ShA bonded on top", "Lifts the crate on its bottom plate; the PU pad gives the grip (μ ≈ 0.5) so the crate does not slide when the AGV brakes.",
      `${R.Lp} × ${R.Wp} mm, ${f(R.mpl, 1)} kg. Lift ${M.s} mm in ${f(R.tlr, 1)} s.`, "Guide pin holes reamed H7 in one set-up with the follower-roller brackets."],
    guide: ["Guide pins + bushes (4×)", "MAKE / BUY", "pin Ø20 h6 hardened, bronze or polymer bush", "Keep the lift plate in place sideways and lengthwise while it is lifted (the lift only pushes up).",
      `Play ${M.gpl} mm – this goes directly into the stop accuracy of the crate.`, "Bush brackets welded to the frame, pins pressed into the plate."],
    cam: ["Eccentric cam shafts (2×)", "MAKE", "C45 shaft Ø30, cam discs S355 / 42CrMo4 induction hardened", "Turning the shaft half a turn lifts the plate by 2 × eccentricity. At 180° (dead centre) the load gives NO torque → it holds itself without brake.",
      `Eccentricity e = ${f(R.e, 1)} mm, cam Ø${2 * R.Rc}, torque max ${f(R.Tcam, 0)} Nm (both shafts, at 90°).`, "Both shafts connected by a chain → same angle → plate stays level. Cam surface hardened 50 HRC, ground."],
    roll: ["Follower rollers (4×)", "BUY", `track roller ${R.roll[0]} (Ø${R.roll[1]}, C ≈ ${R.roll[2]} kN)`, "Fixed under the lift plate, roll on the cam discs.", `Load ${f(R.Frol, 0)} N each (with factor ${M.kdyn}).`, "Eccentric-bolt version for height adjustment (all 4 rollers touch)."],
    lgear: ["Lift worm gear motor", "BUY", `48 V BLDC ${R.lifts.cam.mot[0]} W + worm gear i = ${R.il}`, "Turns the front cam shaft (hollow shaft); the chain drives the rear shaft.",
      `Cam speed ${f(30 / R.tlc, 0)} rpm, motor torque max ${f(R.Tlm, 2)} Nm, peak power ${f(R.Plpk, 0)} W (short, at 90°).`, "Two inductive sensors on the cam disc: DOWN (0°) and UP (180°); absolute encoder for monitoring."],
    chain: ["Synchronising chain", "BUY", "roller chain 08B-1 + 2 sprockets + tensioner", "Couples the two cam shafts so both lift at the same time.", "1 : 1, guard over the chain.", "Mark both shafts at 0° before you put the chain on."],
    brg: ["Bearing blocks", "BUY", "UCP / flange bearings Ø30", "Hold the cam shafts on the frame.", "4 per AGV.", "Brackets machined after welding (line ±0.1 mm)."],
    jack: ["Screw jacks (2×)", "BUY", `worm screw jack, screw pitch ${M.psc} mm, efficiency ${M.esc}`, "Lift the plate at the front and rear; one cross shaft keeps both at the same height.",
      `Load ${f(R.Fl / 2, 0)} N each, screw ${f(R.lifts.screw.n, 0)} rpm at peak, ${f(R.lifts.screw.Tj, 1)} Nm per jack. Bellows over the screws (foundry dust).`,
      R.lifts.screw.self ? "Trapezoidal screw: self-locking, holds the load without power (a motor brake is still good practice)." : "Ball screw: NOT self-locking – a motor brake is required."],
    lshaft: ["Cross shaft + lift motor", "BUY", `48 V BLDC ${R.lifts.screw.mot[0]} W, total ratio ≈ ${f(R.lifts.screw.i, 1)}`, "Drives both jacks together.",
      `Motor torque ${f(R.lifts.screw.Tm, 2)} Nm, peak power ${f(R.lifts.screw.Pk, 0)} W.`, "Motor encoder → any height; limit switches at the bottom and the top."],
    sciss: ["Scissor frame (2 pairs)", "MAKE", "S355 flat bars, hardened pins, bronze bushes", "Opens like a pair of scissors and lifts the plate.",
      `Arm ${M.La} mm, angle ${f(R.lifts.scissor.a0 * 180 / Math.PI, 1)}° → ${f(R.lifts.scissor.a1 * 180 / Math.PI, 1)}°.`, "All pivot bores reamed H7 in pairs; one foot fixed, one foot on rollers; grease nipples."],
    sact: ["Scissor actuator", "BUY", `electric ball-screw actuator ${R.lifts.scissor.act} kN`, "Pushes the rolling foot of the scissor.",
      `Start force ${f(R.lifts.scissor.F0 / 1000, 1)} kN (scissor nearly closed!) → end ${f(R.lifts.scissor.F1 / 1000, 1)} kN; actuator stroke only ${f(R.lifts.scissor.xa, 1)} mm.`, ""],
    hcyl: ["Hydraulic cylinders", "BUY", `${R.lifts.hyd.n} × single-acting Ø${R.lifts.hyd.d}`, "Push the plate up; it goes down by its own weight through a throttle valve.",
      `Pressure ${f(R.lifts.hyd.p, 0)} bar at the rated load (max ${M.ph} bar).`, "Drip tray under the cylinders + leak sensor."],
    hpu: ["Hydraulic power unit", "BUY", `48 V DC motor ${R.lifts.hyd.mot[0]} W + gear pump + tank + check valve + lowering valve + relief valve`, "Makes the oil pressure for the lift.",
      `Flow ${f(R.lifts.hyd.Q, 1)} L/min, power ${f(R.lifts.hyd.Pk, 0)} W, oil ≈ ${f(R.lifts.hyd.oil, 1)} L.`, "Oil change, hose check; filter on the tank breather (foundry dust)."],
    drive: ["Drive module (2×)", "MAKE (or BUY complete)", "swing arm S355 + pivot bushes + spring + planetary gearbox + BLDC motor + PU wheel", "Drives and steers (differential drive: different wheel speeds = turning). Both drive wheels sit on one rocker (pivot along x), so both always touch the floor. Because the CASTORS are sprung, the drive wheels carry a fixed share of the weight – more load = more grip.",
      `Motor ${R.mot[0]} W, gear i = ${R.i}, wheel Ø${M.Dw}. Wheel load ${f(R.Ne, 0)} N empty … ${f(R.Nl, 0)} N loaded (±${f(R.dN, 0)} N on a ${M.df} mm floor step).`, "Set the share with the castor spring preload: AGV on 6 scales, adjust until the drive wheels carry " + M.shr + " % (empty AND loaded)."],
    wheel: ["Drive wheel PU", "BUY", `Ø${M.Dw} PU 92–95 ShA on Al hub`, "Gives the traction; PU wears → wheel Ø changes → odometry error.", `Grip ${M.mu} (dusty) → max. braking ${f(R.abmax, 2)} m/s².`, "Change both wheels together; recalibrate the wheel Ø in the software."],
    motor: ["Drive motor + gearbox", "BUY", `48 V BLDC ${R.mot[0]} W, 3000 rpm, holding brake, encoder; planetary i = ${R.i}`, "Moves the AGV; the brake holds it when parked or after a safety stop.",
      `Need ${f(R.Tm, 2)} Nm peak / ${f(R.Tmc, 2)} Nm continuous at the motor; speed ${f(R.vreal, 2)} m/s at 3000 rpm.`, ""],
    castor: ["Castors (4×)", "BUY", `Ø${R.castor[0]} PU, ball-bearing swivel, rated ${R.castor[1]} kg`, "Sprung castors: carry the rest of the weight and set how much the drive wheels get.", `Load ${f(R.Fcast, 0)} kg each incl. ×1.25.`, "Shim all 4 to the same height ±0.5 mm."],
    batt: ["Battery LiFePO4 + BMS", "BUY", `${M.Ub} V ${M.Ah} Ah (${f(R.kWh, 2)} kWh), BMS with CAN`, "Energy for ~" + f(R.run, 1) + " h; charged on floor contacts at stations (opportunity charging).",
      `${f(R.Lb, 0)} × 240 × 150 mm, ≈ ${f(R.kWh * 9, 0)} kg. Peak ${f(R.Ipk, 0)} A = ${f(R.Crate, 1)} C.`, "Fuse + main switch directly at the battery; side drawer for exchange."],
    elec: ["Control box", "MAKE / BUY", "navigation PC, safety controller, 2 servo drives, lift driver, DC/DC 48/24 V, fuses", "The brain – see the control system diagram.", "IP54, cooled through the floor plate.", "Wire to the drawing; label every wire; keep 48 V power and signal cables apart."],
    scan: ["Safety laser scanner (2×)", "BUY", "2D safety scanner, PL d, 275° view, measurement data output", "Front-left + rear-right corners → 360° around the AGV. Safety fields stop the AGV; the same data are used for navigation.",
      `Protective field at ${M.vmax} m/s: ${f(R.Dmax, 0)} mm. Response ${M.tsc} s.`, "Rigid, pinned bracket – an angle error of " + M.smnt + "° costs " + f(R.acc[4][1], 1) + " mm stop accuracy."],
    estop: ["E-stop buttons (2×)", "BUY", "mushroom button, 2 NC contacts, IEC 60947-5-5", "Stop the AGV from both sides.", "Wired to the safety controller (stop category 0/1).", ""],
    led: ["LED strip + buzzer", "BUY", "RGB LED strip 24 V", "Shows the state: blue = driving, orange = lifting / turning, red = fault, green = charging.", "", ""],
    charge: ["Charging contacts", "BUY", "spring-loaded floor contacts 30–60 A", "Charge at the stations while the AGV waits (opportunity charging).", `Charger ${M.Pch} kW → full charge ${f(R.tch, 1)} h, needed ${f(R.chg * 100, 0)} % of the time.`, ""],
    hmi: ["Display + mode key", "BUY", "small display, key switch AUTO / MANUAL, socket for the manual pendant", "Status, battery level, errors; manual driving with the pendant (3-position enabling switch).", "", ""],
    stand: ["Crate stand (item 2)", "", "", "The AGV drives under it between the rails and lifts the crate off.", `Rails at ${M.H + 20} mm, clear width 680 mm.`, ""],
    crate: ["Crate (item 2)", "", "", "", `${M.cl} × ${M.cw} × ${M.ch} mm, ${M.mcr} kg.`, ""],
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
  const under = new THREE.DirectionalLight(0xffffff, 0.35); under.position.set(500, -3000, 800); scene.add(under);
  const root = new THREE.Group(); scene.add(root);
  const cs = getComputedStyle(document.documentElement);
  scene.background = new THREE.Color((cs.getPropertyValue("--surface-2") || "#f2f1ed").trim() || "#f2f1ed"); if (window.dtTheme) window.dtTheme.scene(scene);
  let O = {}, labels = [], selBox = null, onPick = null, exG = [], explode = 0, covers = true, showField = true;
  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: o.m ?? 0.35, roughness: o.r ?? 0.55, transparent: !!o.op, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: !o.op });
  const C = { frame: mat(0x3c6e9e), dark: mat(0x3a4048), black: mat(0x23262a), steel: mat(0x9aa4ae, { m: 0.6, r: 0.35 }), alu: mat(0xc8ccd0, { m: 0.5, r: 0.4 }),
    pu: mat(0xd9832b, { m: 0, r: 0.7 }), pad: mat(0x2d2f33, { m: 0, r: 0.9 }), cover: mat(0xe8e6df, { op: 0.35, ds: true, m: 0.1 }), batt: mat(0x2f7d4f, { m: 0.2, r: 0.6 }),
    elec: mat(0x5b6470, { m: 0.3 }), yellow: mat(0xf2c200), red: mat(0xd03b3b), copper: mat(0xc07a3a, { m: 0.8, r: 0.3 }), led: mat(0x2a78d6, { m: 0, r: 0.4 }),
    crate: mat(0x6f7d58, { m: 0.3, r: 0.6 }), mesh: mat(0x6f7d58, { op: 0.35, ds: true }), cast: mat(0x67717b, { m: 0.2, r: 0.8 }), floor: mat(0xd8d6cf, { m: 0, r: 0.95 }),
    fieldR: new THREE.MeshBasicMaterial({ color: 0xd03b3b, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    fieldW: new THREE.MeshBasicMaterial({ color: 0xf2c200, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    fieldG: new THREE.MeshBasicMaterial({ color: 0x2fa84f, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }) };
  const box = (w, h, d, m, x, y, z, part, parent) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
  const cyl = (r, h, m, x, y, z, part, parent, axis = "y", seg = 24) => { const g = new THREE.CylinderGeometry(r, r, h, seg); if (axis === "x") g.rotateZ(-Math.PI / 2); else if (axis === "z") g.rotateX(Math.PI / 2);
    const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.userData.part = part; (parent || root).add(me); return me; };
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
  function crate(M) {                               // origin = bottom centre, length along x
    const g = new THREE.Group(); root.add(g); const B = 130;
    box(M.cl, 10, M.cw, C.crate, 0, 5, 0, "crate", g); box(M.cl, 20, M.cw, C.crate, 0, B - 10, 0, "crate", g);
    for (const sz of [1, -1]) box(M.cl, 100, 60, C.crate, 0, 60, sz * (M.cw / 2 - 40), "crate", g);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(50, M.ch, 50, C.crate, sx * (M.cl / 2 - 25), M.ch / 2, sz * (M.cw / 2 - 25), "crate", g);
    for (const sz of [1, -1]) box(M.cl - 50, M.ch - B, 4, C.mesh, 0, B + (M.ch - B) / 2, sz * (M.cw / 2 - 2), "crate", g);
    for (const sx of [1, -1]) box(4, M.ch - B, M.cw - 50, C.mesh, sx * (M.cl / 2 - 2), B + (M.ch - B) / 2, 0, "crate", g);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(300, 220, 260, C.cast, sx * M.cl / 4, B + 110, sz * M.cw / 4, "crate", g);
    return g;
  }
  function clear() {
    if (selBox) { scene.remove(selBox); selBox = null; }
    root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); });
    while (root.children.length) root.remove(root.children[0]);
    labels = []; exG = [];
  }
  function build(R, M) {
    clear(); O = { R, M };
    const L = M.L, W = M.W, H = M.H;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 4000), C.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = -1; root.add(floor); O.floor = floor; if (window.dtTheme) window.dtTheme.floor(C.floor);
    const grid = new THREE.GridHelper(8000, 40, 0xb9b6ad, 0xc9c6bd); grid.scale.z = 0.5; root.add(grid); O.grid = grid;
    // stand (item 2) at x = 0
    const S = new THREE.Group(); root.add(S);
    const zr = M.cw / 2 - 40, xp = M.cl / 2 - 60, Hr = H + 20;
    for (const sx of [1, -1]) for (const sz of [1, -1]) { box(60, Hr - 60, 60, C.frame, sx * xp, (Hr - 60) / 2, sz * zr, "stand", S); box(140, 10, 140, C.dark, sx * xp, 5, sz * zr, "stand", S); }
    for (const sz of [1, -1]) box(M.cl, 60, 60, C.frame, 0, Hr - 30, sz * zr, "stand", S);
    O.crate = crate(M); O.crate.position.set(0, Hr, 0);
    label("Crate stand (item 2)", [-xp, Hr, zr], [-500, 500, 400], S);
    // AGV
    const AG = new THREE.Group(); root.add(AG); O.agv = AG;
    const gx = (ex) => { const g = new THREE.Group(); g.userData.base = new THREE.Vector3(); g.userData.ex = new THREE.Vector3(...ex); AG.add(g); exG.push(g); return g; };
    // chassis
    const CH = gx([0, 0, 0]), zf = W / 2 - 22;
    for (const sz of [1, -1]) {
      for (const sx of [1, -1]) box(L / 2 - 120, 80, 40, C.frame, sx * (110 + (L / 2 - 120) / 2), 75, sz * zf, "frame", CH);
      box(260, 40, 40, C.frame, 0, 185, sz * zf, "frame", CH);                                    // bridge over the drive wheel
      for (const sx of [1, -1]) box(40, 90, 40, C.frame, sx * 110, 140, sz * zf, "frame", CH);
    }
    for (const sx of [1, -1]) box(40, 80, 2 * zf - 40, C.frame, sx * (L / 2 - 30), 75, 0, "frame", CH);
    box(L - 100, 8, 360, C.dark, 0, 39, 0, "floor", CH);
    for (const sx of [1, -1]) for (const sz of [1, -1]) box(90, 10, 90, C.frame, sx * R.xc, 158, sz * R.zc, "frame", CH);   // castor brackets (spring above)
    // castors
    const CA = gx([0, 0, 0]);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const cr = R.castor[0] / 2;
      box(80, 8, 80, C.steel, sx * R.xc, 119, sz * R.zc, "castor", CA);
      cyl(22, 30, C.yellow, sx * R.xc, 138, sz * R.zc, "castor", CA);                          // castor spring unit
      box(10, 115 - cr, 50, C.steel, sx * R.xc + 25, cr + (115 - cr) / 2, sz * R.zc, "castor", CA);
      cyl(cr, 40, C.pu, sx * R.xc + 25, cr, sz * R.zc, "castor", CA, "z");
    }
    // drive modules
    O.wheels = [];
    for (const sz of [1, -1]) {
      const D = gx([0, 0, sz * 260]), r = M.Dw / 2;
      const wg = new THREE.Group(); wg.position.set(0, r, sz * R.zw); D.add(wg); O.wheels.push(wg);
      cyl(r, 50, C.pu, 0, 0, 0, "wheel", wg, "z", 32); cyl(r - 18, 52, C.alu, 0, 0, 0, "wheel", wg, "z", 24);
      box(r * 1.2, 8, 54, C.dark, 0, 0, 0, "wheel", wg);
      box(70, 70, 60, C.dark, 0, r, sz * (R.zw - 60), "motor", D);
      cyl(40, 150, C.black, 110, r, sz * (R.zw - 60), "motor", D, "x");
      box(110, 24, 24, C.frame, 35, r + 30, sz * (R.zw - 100), "drive", D);               // rocker arm
    }
    { const rk = gx([0, 0, 0]); box(30, 24, 2 * R.zw - 200, C.frame, 35, M.Dw / 2 + 30, 0, "drive", rk); cyl(18, 60, C.steel, 35, M.Dw / 2 + 30, 0, "drive", rk, "x"); }  // rocker cross beam + pivot along x
    // battery + electronics
    const BT = gx([0, 140, -720]);
    const Lb = Math.min(R.Lb, L / 2 + 10);
    box(Lb, 150, 240, C.batt, -L / 2 + 50 + Lb / 2, 118, 0, "batt", BT);
    box(60, 20, 120, C.red, -L / 2 + 50 + 30, 203, 0, "batt", BT);
    const EL = gx([420, 120, 0]);
    box(190, 120, 240, C.elec, R.xs - 140, 103, 0, "elec", EL);
    for (const sz of [1, -1]) for (let i = 0; i < 4; i++) box(4, 90, 30, C.black, R.xs - 220 + i * 45, 103, sz * 60, "elec", EL);
    for (const sz of [1, -1]) box(60, 8, 30, C.copper, L / 2 - 150, 6, sz * 60, "charge", CH);   // floor charging contacts (front)
    // lift mechanism – depends on the chosen type
    const LM = gx([0, 340, 0]); O.cams = []; O.sc = null; const pb = H - 20;
    if (R.lt === "cam") {
    for (const sx of [1, -1]) {
      const xs = sx * R.xs, sh = new THREE.Group(); sh.position.set(xs, R.ys, 0); LM.add(sh); O.cams.push(sh);
      cyl(15, 2 * zf - 20, C.steel, 0, 0, 0, "cam", sh, "z");
      for (const sz of [1, -1]) {
        const d = cyl(R.Rc, 28, C.steel, 0, -R.e, sz * 150, "cam", sh, "z", 32);
        box(4, R.Rc * 0.8, 30, C.red, 0, -R.e + R.Rc * 0.55, sz * 150, "cam", sh);   // mark: shows the cam angle
        void d;
      }
      cyl(40, 10, C.dark, 0, 0, 200, "chain", sh, "z");
      for (const sz of [1, -1]) { box(70, 40, 40, C.dark, xs, R.ys, sz * (zf - 30), "brg", LM); box(60, R.ys - 135, 12, C.frame, xs, 115 + (R.ys - 135) / 2, sz * (zf - 30), "brg", LM); }
    }
    box(2 * R.xs, 8, 6, C.black, 0, R.ys + 40, 200, "chain", LM); box(2 * R.xs, 8, 6, C.black, 0, R.ys - 40, 200, "chain", LM);
    box(90, 90, 100, C.dark, R.xs, R.ys, 0, "lgear", LM); cyl(32, 130, C.black, R.xs - 110, R.ys, 0, "lgear", LM, "x");
    } else if (R.lt === "screw") {                    // 2 screw jacks on brackets above the battery, cross shaft, motor in the middle
      for (const sx of [1, -1]) { const x = sx * R.xs;
        box(60, 10, 2 * zf - 40, C.frame, x, 205, 0, "jack", LM);
        box(110, 60, 120, C.dark, x, 240, 0, "jack", LM); }
      cyl(9, 2 * R.xs - 110, C.steel, 0, 240, 0, "lshaft", LM, "x");
      box(80, 70, 80, C.dark, 0, 240, 0, "lshaft", LM); cyl(30, 130, C.black, 0, 240, 105, "lshaft", LM, "z");
    } else if (R.lt === "scissor") {                  // 2 scissor pairs at z = ±160, actuator in the middle
      const base = pb - M.h0, arms = [];
      for (const sz of [1, -1]) {
        box(M.La + 60, 10, 30, C.frame, 0, base - 5, sz * 160, "sciss", LM);
        for (const sg of [1, -1]) { const a = box(M.La, 14, 10, C.steel, 0, base, sz * 160 + sg * 8, "sciss", LM); a.userData.sg = sg; arms.push(a); }
      }
      const foot = box(20, 20, 340, C.dark, 0, base + 10, 0, "sciss", LM);
      cyl(24, 200, C.black, -120, base + 12, 0, "sact", LM, "x");
      const rod = cyl(9, 1, C.steel, 0, base + 12, 0, "sact", LM, "x");
      O.sc = { arms, foot, rod, base };
    } else {                                           // hydraulic: 4 cylinders + power unit
      const L4 = R.lifts.hyd, rb = L4.d / 2 + 7, pts = [[1, 1], [1, -1], [-1, 1], [-1, -1]].slice(0, Math.max(1, Math.min(4, L4.n)));
      for (const [sx, sz] of pts) { box(60, 10, 60, C.frame, sx * R.xs, 205, sz * 150, "hcyl", LM); cyl(rb, 60, C.red, sx * R.xs, 240, sz * 150, "hcyl", LM); }
      box(170, 70, 150, C.dark, R.xs - 150, 205, 0, "hpu", LM); cyl(30, 110, C.black, R.xs - 150, 205, 120, "hpu", LM, "z");
      O.hydPts = pts; O.hydR = L4.d / 4 + 3;
    }
    // lift plate (moves)
    const PL = gx([0, 640, 0]); O.plate = PL;
    box(R.Lp, 15, R.Wp, C.alu, 0, 7.5, 0, "plate", PL); box(R.Lp - 40, 5, R.Wp - 40, C.pad, 0, 17.5, 0, "plate", PL);
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      if (R.lt === "cam") { box(30, 25 + R.rr, 40, C.dark, sx * R.xs, -(25 + R.rr) / 2, sz * 150, "roll", PL); cyl(R.rr, 20, C.steel, sx * R.xs, -25, sz * 150, "roll", PL, "z"); }
      cyl(10, 80, C.steel, sx * (R.Lp / 2 - 60), -40, sz * (R.Wp / 2 - 50), "guide", PL);
    }
    if (R.lt === "screw") for (const sx of [1, -1]) { const ln = pb - 270 + M.s + 20; cyl(14, ln, C.steel, sx * R.xs, -ln / 2, 0, "jack", PL); }
    if (R.lt === "hyd") for (const [sx, sz] of O.hydPts) { const ln = pb - 270 + M.s + 20; cyl(O.hydR, ln, C.steel, sx * R.xs, -ln / 2, sz * 150, "hcyl", PL); }
    for (const sx of [1, -1]) for (const sz of [1, -1]) cyl(18, 40, C.pu, sx * (R.Lp / 2 - 60), H - 20 - 90, sz * (R.Wp / 2 - 50), "guide", CH);
    // covers
    const cvs = [];
    for (const sz of [1, -1]) { const g = gx([0, 0, sz * 560]); cvs.push(g); box(L, H - 50, 2, C.cover, 0, 20 + (H - 50) / 2, sz * W / 2, "cover", g);
      box(L - 40, 12, 3, C.led, 0, H - 45, sz * (W / 2 + 2), "led", g);
      cyl(20, 18, C.red, -L / 2 + 140, H - 90, sz * (W / 2 + 12), "estop", g, "z"); cyl(28, 6, C.yellow, -L / 2 + 140, H - 90, sz * (W / 2 + 4), "estop", g, "z"); }
    for (const sx of [1, -1]) { const g = gx([sx * 560, 0, 0]); cvs.push(g); box(2, H - 50, W, C.cover, sx * L / 2, 20 + (H - 50) / 2, 0, "cover", g);
      box(3, 12, W - 40, C.led, sx * (L / 2 + 2), H - 45, 0, "led", g); }
    box(3, 60, 120, C.black, -L / 2 - 3, H - 110, 0, "hmi", cvs[3]);
    O.covers = cvs;
    // scanners (front-left, rear-right)
    O.scan = [];
    for (const [sx, sz] of [[1, 1], [-1, -1]]) { const g = gx([sx * 260, 0, sz * 260]); cyl(45, 110, C.yellow, sx * (L / 2 - 50), 175, sz * (W / 2 - 50), "scan", g); cyl(46, 40, C.black, sx * (L / 2 - 50), 175, sz * (W / 2 - 50), "scan", g); O.scan.push(g); }
    // protective field (flat, in front)
    O.fR = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), C.fieldR); O.fR.rotation.x = -Math.PI / 2; AG.add(O.fR);
    O.fW = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), C.fieldW); O.fW.rotation.x = -Math.PI / 2; AG.add(O.fW);
    O.fG = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), C.fieldG); O.fG.rotation.x = -Math.PI / 2; AG.add(O.fG);
    [O.fR, O.fW, O.fG].forEach((m) => { m.userData.noPick = true; });
    // labels
    label("Lift plate + PU pad", [-R.Lp / 2 + 80, H + 20, R.Wp / 2], [-350, 450, 350], PL);
    label("Safety laser scanner", [L / 2 - 50, 230, W / 2 - 50], [450, 350, 300], O.scan[0]);
    label("Drive modules on a rocker", [0, M.Dw, R.zw + 30], [150, 500, 550], AG);
    label({ cam: "Eccentric cam lift", screw: "Screw jack lift", scissor: "Scissor lift", hyd: "Hydraulic lift" }[R.lt],
      R.lt === "scissor" ? [-150, pb - M.h0 + 40, 160] : [-R.xs, R.lt === "cam" ? R.ys : 240, 150], [-450, 420, 500], LM);
    label("Battery LiFePO4", [-L / 2 + 50 + Lb / 2, 190, -120], [-300, 350, -500], BT);
    label("Sprung castor", [R.xc, 60, -R.zc], [350, 150, -450], CA);
    label("Control box", [R.xs - 140, 160, -120], [400, 380, -400], EL);
    applyEx(); fit("overview");
  }
  function applyEx() {
    for (const g of exG) g.position.copy(g.userData.base).addScaledVector(g.userData.ex, explode);
    if (O.crate) O.crate.visible = explode < 0.15;
    if (O.covers) O.covers.forEach((g) => { g.visible = covers; });
  }
  const VIEWS = {
    overview: () => [[-3400, 2400, 3100], [-1000, 250, 0], true],     // fixed: AGV route + stand
    side: () => [[-200, 450, 3300], [-200, 250, 0]],
    under: () => [[700, -1500, 1300], [0, 120, 0]],
    top: () => [[0, 4200, 1], [0, 0, 0]],
    lift: () => { const R = O.R; return [[-R.xs - 700, 420, 950], [-R.xs, R.ys, 60]]; },
  };
  function fit(v) { if (!O.R) return; const [p, t, fixed] = VIEWS[v](), ax = O.agv && !fixed ? O.agv.position.x : 0; nice.stop(); camera.position.set(p[0] + ax, p[1], p[2]); controls.target.set(t[0] + ax, t[1], t[2]); controls.update(); O.view = v; if (O.floor) { O.floor.visible = v !== "under"; O.grid.visible = v !== "under"; } }
  function update(st) {
    if (!O.agv) return;
    const M = O.M, R = O.R;
    O.agv.position.x = st.x;
    O.wheels.forEach((w) => { w.rotation.z = -st.x / (M.Dw / 2); });
    O.cams.forEach((c) => { c.rotation.z = st.th; });
    if (O.sc) {                                        // scissor: arm angle from the plate height
      const h = M.h0 + (st.top - M.H), a = Math.asin(Math.min(0.99, h / M.La)), half = M.La / 2 * Math.cos(a);
      for (const arm of O.sc.arms) { arm.rotation.z = arm.userData.sg * a; arm.position.y = O.sc.base + h / 2; }
      O.sc.foot.position.x = half;
      const x0 = -20; O.sc.rod.scale.x = Math.max(1, half - x0); O.sc.rod.position.x = x0 + (half - x0) / 2;
    }
    O.plate.userData.base.y = st.top - 20;
    applyEx();
    O.crate.position.set(st.cx, st.cy + explode * 900, 0);
    // fields
    const fv = R.fields.find((x) => x.v >= M.vst - 1e-9) || R.fields[0], wF = M.W + 200;
    const dock = st.field === "dock";
    O.fR.visible = O.fW.visible = showField && !dock && explode < 0.15; O.fG.visible = showField && dock && explode < 0.15;
    O.fR.scale.set(fv.Dp, wF, 1); O.fR.position.set(M.L / 2 + fv.Dp / 2, 3, 0);
    O.fW.scale.set(fv.Dw - fv.Dp, wF + 200, 1); O.fW.position.set(M.L / 2 + fv.Dp + (fv.Dw - fv.Dp) / 2, 2, 0);
    O.fG.scale.set(150, M.W + 40, 1); O.fG.position.set(M.L / 2 + 75, 3, 0);
    for (const c of O.covers) for (const m of c.children) if (m.userData.part === "led") m.material = st.th > 0.01 && st.th < Math.PI - 0.01 ? C.yellow : C.led;
  }
  function frame() { if (selBox) selBox.update(); controls.update(); renderer.render(scene, camera); }
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const rc = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const vis = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hit = ray.intersectObjects(root.children, true).find((h) => h.object.isMesh && h.object.userData.part && vis(h.object) && !(h.object.material.transparent && h.object.material.opacity < 0.3 && h.object.userData.part === "cover"));
    if (selBox) { scene.remove(selBox); selBox = null; }
    if (!hit) { if (onPick) onPick(null); return; }
    selBox = new THREE.BoxHelper(hit.object, 0xff2a2a); scene.add(selBox); if (onPick) onPick(hit.object.userData.part);
  });
  return { build, update, fit, frame, canvas: renderer.domElement,
    setLabels(on) { labels.forEach((l) => { l.visible = on; }); }, onPick(fn) { onPick = fn; },
    setExplode(e) { explode = e; applyEx(); }, setCovers(on) { covers = on; applyEx(); }, setField(on) { showField = on; },
    resize() { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); } };
}

/* ------------------------------------------------------------------ 2D drawings */
function liftSVG(R, M, th) {
  const W = 760, H = 270, u = (1 - Math.cos(th)) / 2, lift = M.s * u, t = R.lt;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Lift mechanism and its force"><defs><marker id="avA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill="var(--text-2)"/></marker></defs>`;
  const plate = (y) => `<rect x="20" y="${y - 14}" width="300" height="14" fill="color-mix(in srgb, var(--accent) 35%, transparent)" stroke="var(--accent)"/><text x="324" y="${y - 3}" class="apc-t">lift plate</text>`;
  const part = "fill=\"color-mix(in srgb, var(--text-2) 18%, transparent)\" stroke=\"var(--text-2)\" stroke-width=\"1.5\"";
  if (t === "cam") {
    const sc = Math.min(1.9, 120 / (R.e + R.Rc + 40)), cx = 150, cy = 175, ox = cx + R.e * Math.sin(th) * sc, oy = cy + R.e * Math.cos(th) * sc, top = oy - R.Rc * sc, rr = R.rr * sc;
    g += `<text x="10" y="16" class="apc-t" style="font-weight:600">Side view of one cam (angle ${f(th * 180 / Math.PI, 0)}°)</text>`;
    g += `<circle cx="${ox}" cy="${oy}" r="${R.Rc * sc}" ${part}/><circle cx="${cx}" cy="${cy}" r="${15 * sc}" fill="var(--surface)" stroke="var(--text)" stroke-width="1.5"/>`;
    g += `<line x1="${cx}" y1="${cy}" x2="${ox}" y2="${oy}" stroke="var(--critical)" stroke-width="2"/><circle cx="${cx}" cy="${top - rr}" r="${rr}" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>`;
    g += `<rect x="${cx - 18}" y="${top - 2 * rr - 25 * sc}" width="36" height="${25 * sc}" fill="color-mix(in srgb, var(--accent) 25%, transparent)" stroke="var(--accent)"/>` + plate(top - 2 * rr - 25 * sc);
    g += `<text x="${cx + 18 + rr}" y="${top - rr + 4}" class="apc-t">follower roller ${R.roll[0]}</text><text x="${cx - 30}" y="${H - 10}" class="apc-t">shaft · eccentric e = ${f(R.e, 1)} mm · cam Ø${2 * R.Rc}</text>`;
  } else if (t === "screw") {
    const sc = 1.6, yb = 230, hy = 120 - lift * sc;
    g += `<text x="10" y="16" class="apc-t" style="font-weight:600">Side view of one screw jack (lift ${f(lift, 0)} mm)</text>`;
    g += `<rect x="110" y="${yb - 55}" width="90" height="55" ${part}/><text x="206" y="${yb - 24}" class="apc-t">worm screw jack</text>`;
    g += `<rect x="147" y="${hy}" width="16" height="${yb - 55 - hy + 30}" fill="var(--surface)" stroke="var(--text)"/>`;
    for (let y = hy + 4; y < yb - 55; y += 6) g += `<line x1="147" y1="${y}" x2="163" y2="${y + 4}" stroke="var(--text-2)"/>`;
    g += plate(hy) + `<line x1="60" y1="${yb - 28}" x2="110" y2="${yb - 28}" stroke="var(--text)" stroke-width="4"/><text x="20" y="${yb - 34}" class="apc-t">cross shaft</text>`;
    g += `<text x="20" y="${H - 10}" class="apc-t">pitch ${M.psc} mm · efficiency ${M.esc} · ${R.L.self ? "self-locking" : "NOT self-locking → brake"}</text>`;
  } else if (t === "scissor") {
    const L4 = R.L, k = 260 / M.La, h = M.h0 + lift, a = Math.asin(Math.min(0.99, h / M.La)), hx = M.La / 2 * Math.cos(a) * k, hp = h * k * 1.4, cx = 170, yb = 235;
    g += `<text x="10" y="16" class="apc-t" style="font-weight:600">Side view of the scissor (angle ${f(a * 180 / Math.PI, 1)}°)</text>`;
    g += `<line x1="20" y1="${yb}" x2="320" y2="${yb}" stroke="var(--text-2)" stroke-width="3"/>`;
    g += `<line x1="${cx - hx}" y1="${yb}" x2="${cx + hx}" y2="${yb - hp}" stroke="var(--text)" stroke-width="5"/><line x1="${cx - hx}" y1="${yb - hp}" x2="${cx + hx}" y2="${yb}" stroke="var(--text)" stroke-width="5"/>`;
    g += `<circle cx="${cx}" cy="${yb - hp / 2}" r="4" fill="var(--surface)" stroke="var(--text)"/><circle cx="${cx + hx}" cy="${yb}" r="6" fill="var(--surface)" stroke="var(--text)"/>`;
    g += `<rect x="${cx - 60}" y="${yb - 14}" width="${60 + hx - 6}" height="9" fill="color-mix(in srgb, var(--critical) 30%, transparent)" stroke="var(--critical)"/><text x="${cx + hx + 10}" y="${yb - 4}" class="apc-t">actuator → rolling foot</text>`;
    g += plate(yb - hp);
    g += `<text x="20" y="${H - 6}" class="apc-t">arm ${M.La} mm · start force ${f(L4.F0 / 1000, 1)} kN = ${f(L4.lever, 1)} × the load</text>`;
  } else {
    const L4 = R.L, sc = 1.6, yb = 230, hy = 125 - lift * sc;
    g += `<text x="10" y="16" class="apc-t" style="font-weight:600">One cylinder + power unit (lift ${f(lift, 0)} mm)</text>`;
    g += `<rect x="135" y="${yb - 75}" width="40" height="75" fill="color-mix(in srgb, var(--critical) 18%, transparent)" stroke="var(--critical)" stroke-width="1.5"/>`;
    g += `<rect x="135" y="${yb - 75 + 75 * (1 - 0.25 - 0.6 * u)}" width="40" height="${75 * (0.25 + 0.6 * u)}" fill="color-mix(in srgb, var(--warning) 45%, transparent)"/>`;
    g += `<rect x="149" y="${hy}" width="12" height="${yb - 75 - hy + 10}" fill="var(--surface)" stroke="var(--text)"/>` + plate(hy);
    g += `<rect x="215" y="${yb - 45}" width="80" height="45" ${part}/><circle cx="240" cy="${yb - 22}" r="12" fill="var(--surface)" stroke="var(--text)"/><path d="M234,${yb - 16} L240,${yb - 30} L246,${yb - 16} z" fill="var(--text)"/>`;
    g += `<text x="215" y="${yb - 52}" class="apc-t">pump, tank, valves</text>`;
    g += `<path d="M215,${yb - 10} H175" stroke="var(--critical)" stroke-width="2.5" fill="none"/>`;
    g += `<text x="20" y="${H - 10}" class="apc-t">${L4.n} × Ø${L4.d} · ${f(L4.p, 0)} bar · ${f(L4.Q, 1)} L/min · oil ${f(L4.oil, 1)} L</text>`;
  }
  // right: what the drive has to give during the lift
  const X0 = 410, X1 = W - 20, Y0 = 220, Y1 = 40;
  let pts, cur, xl, yl, xmax, note;
  if (t === "cam") { const Tm = R.Tlm; pts = Array.from({ length: 61 }, (_, i) => [i * 3, Tm * Math.sin(i * 3 * Math.PI / 180)]); cur = [th * 180 / Math.PI, Tm * Math.sin(th)]; xl = "cam angle °"; yl = "Motor torque (Nm)"; xmax = 180; note = "180° = dead centre: 0 Nm → holds itself"; }
  else if (t === "screw") { const Tm = R.L.Tm; pts = [[0, Tm], [M.s, Tm]]; cur = [lift, Tm]; xl = "lift mm"; yl = "Motor torque (Nm) – constant"; xmax = M.s; note = "same torque over the whole stroke"; }
  else if (t === "scissor") { const Fk = (x) => R.Fl / Math.tan(Math.asin(Math.min(0.99, (M.h0 + x) / M.La))) / 1000; pts = Array.from({ length: 41 }, (_, i) => [i * M.s / 40, Fk(i * M.s / 40)]); cur = [lift, Fk(lift)]; xl = "lift mm"; yl = "Actuator force (kN)"; xmax = M.s; note = "very high force at the start (scissor nearly closed)"; }
  else { const p = R.L.p; pts = [[0, p], [M.s, p]]; cur = [lift, p]; xl = "lift mm"; yl = "Oil pressure (bar)"; xmax = M.s; note = `max. allowed ${M.ph} bar`; }
  const ymax = Math.max(...pts.map((q) => q[1])) * 1.2 || 1;
  const X = (x) => X0 + x / xmax * (X1 - X0), Y = (y) => Y0 - y / ymax * (Y0 - Y1);
  g += `<text x="${X0}" y="16" class="apc-t" style="font-weight:600">${yl}</text>`;
  for (const v of [0, ymax / 2.4, ymax / 1.2]) g += `<line x1="${X0}" y1="${Y(v)}" x2="${X1}" y2="${Y(v)}" stroke="var(--grid)"/><text x="${X0 - 6}" y="${Y(v) + 4}" class="apc-t r">${f(v, v < 10 ? 2 : 0)}</text>`;
  for (let q = 0; q <= 4; q++) g += `<text x="${X(xmax * q / 4)}" y="${Y0 + 16}" class="apc-t c">${f(xmax * q / 4, 0)}</text>`;
  g += `<text x="${X1}" y="${Y0 + 30}" class="apc-t r">${xl}</text>`;
  g += `<path d="${pts.map((q, i) => `${i ? "L" : "M"}${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join("")}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  g += `<circle cx="${X(cur[0])}" cy="${Y(cur[1])}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/><text x="${X(xmax / 2)}" y="${Y1 - 4}" class="apc-t c">${esc(note)}</text>`;
  return g + `</svg>`;
}
/* lift-type specific texts for checks, calculations, BOM and guide */
function liftDetail(R, M) {
  const L = R.L, t = R.lt, mot = L.mot;
  const D = { checks: [], calc: [`Force       F = (m_p + plate)·g·${M.kdyn} = ${f(R.Fl, 0)} N`], bom: [], guide: [], hint: "" };
  if (t === "cam") {
    D.checks.push(["Lift motor", R.Tlm <= mot[2] * 0.8, R.Tlm <= mot[2], `${mot[0]} W, i = ${R.il}: ${f(R.Tlm, 2)} Nm ≤ ${f(mot[2] * 0.8, 2)} Nm`],
      ["Follower roller rating", R.roll[2] * 1000 >= R.Frol * 3, R.roll[2] * 1000 >= R.Frol * 2, `${R.roll[0]}: C ${R.roll[2]} kN ≥ 3 × ${f(R.Frol / 1000, 2)} kN`]);
    D.calc.push(`Eccentric   e = stroke/2 = ${f(R.e, 1)} mm`, `Torque      T = F·e·sin θ → max <b>${f(R.Tcam, 0)} Nm</b> at 90°`, `Cam speed   ½ turn in ${M.tl} s → i = ${f(R.ilreq, 0)} → <b>i = ${R.il}</b> (${f(R.tlc, 2)} s)`, `Motor       ${f(R.Tlm, 2)} Nm, peak ${f(R.Plpk, 0)} W → <b>${mot[0]} W</b>`);
    D.bom.push(["Cam shaft with 2 eccentric cam discs", "MAKE", 2, `Ø30 C45, e = ${f(R.e, 1)} mm, cam Ø${2 * R.Rc} hardened`, ""], ["Follower roller (track roller)", "BUY", 4, R.roll[0], "eccentric-bolt type for adjustment"],
      ["Bearing blocks Ø30", "BUY", 4, "UCP / UCF", ""], ["Worm gear motor 48 V BLDC", "BUY", 1, `${mot[0]} W, i = ${R.il}, hollow shaft Ø30`, ""], ["Roller chain 08B-1 + 2 sprockets + tensioner", "BUY", 1, "", "chain guard MAKE"],
      ["Lift sensors M12 inductive + absolute encoder", "BUY", 3, "DOWN 0°, UP 180°", ""]);
    D.guide.push("Turn both cam shafts to 0° (red marks down), then put the chain on – both shafts must have the same angle.", "Mount the plate; adjust the 4 eccentric follower rollers so all 4 touch the cams (feeler gauge 0.05 mm).",
      "Set the sensors: DOWN at 0°, UP at 180° (±3°).", "Check that the plate stays up when the motor power is switched off at 180° (dead centre + self-locking worm).");
    D.hint = "Two cam shafts (front + rear), connected by a chain. A worm gear motor turns them half a turn. At 180° the force goes straight through the shaft centre → no torque, no brake needed, and the worm gear is self-locking as a second safety.";
  } else if (t === "screw") {
    D.checks.push(["Lift motor", L.Tm <= mot[2] * 0.8 && L.Pk <= mot[0] * 2.5, L.Tm <= mot[2], `${mot[0]} W: ${f(L.Tm, 2)} Nm ≤ ${f(mot[2] * 0.8, 2)} Nm, peak ${f(L.Pk, 0)} W`],
      ["Holds the load without power", L.self, false, L.self ? `efficiency ${M.esc} ≤ 0.35 → trapezoidal screw is self-locking` : `efficiency ${M.esc}: ball screw runs back → motor brake required`]);
    D.calc.push(`Speed       v = ${M.s}/${M.tl} = ${f(R.vl, 1)} mm/s, peak ×π/2 = ${f(R.vpk, 1)} mm/s`, `Screw       n = v/P = ${f(L.n, 0)} rpm → total ratio ${f(L.i, 1)}`,
      `Torque      T = (F/2)·P/(2π·η) = ${f(L.Tj, 1)} Nm per jack`, `Motor       2·T/(i·0.95) = ${f(L.Tm, 2)} Nm, peak F·v/η = ${f(L.Pk, 0)} W → <b>${mot[0]} W</b>`);
    D.bom.push(["Worm screw jack, translating screw + bellows", "BUY", 2, `pitch ${M.psc} mm, ≥ ${f(R.Fl / 2 / 1000 * 1.5, 1)} kN`, ""], ["Cross shaft + 2 couplings", "MAKE / BUY", 1, `≈ ${2 * R.xs - 110} mm`, ""],
      ["Lift gear motor 48 V BLDC + encoder", "BUY", 1, `${mot[0]} W, ratio ≈ ${f(L.i, 1)} (with the jack worm)`, L.self ? "" : "with brake!"], ["Limit switches bottom / top", "BUY", 2, "M12 inductive", ""]);
    D.guide.push("Mount both jacks on their brackets; align the cross shaft (couplings ±0.1 mm).", "Set both screws to the same height before coupling them (plate level ±0.5 mm).",
      "Fit bellows over the screws; grease the screws.", "Teach the heights with the encoder; set the limit switches 2 mm beyond the end positions.");
    D.hint = "Two worm screw jacks (front + rear) on one cross shaft, one motor in the middle. Any height is possible (encoder). A trapezoidal screw holds the load by itself – but it wastes most of the energy as friction (efficiency ≈ 0.3).";
  } else if (t === "scissor") {
    D.checks.push(["Scissor lever at the start", L.lever <= 3, L.lever <= 6, `start force ${f(L.F0 / 1000, 1)} kN = ${f(L.lever, 1)} × the load – a scissor is a bad lever when nearly closed`],
      ["Actuator rating", L.act * 1000 >= L.F0 * 1.2, L.act * 1000 >= L.F0, `${L.act} kN ≥ 1.2 × ${f(L.F0 / 1000, 1)} kN`],
      ["Scissor fits in the AGV height", M.h0 <= M.H - 140, M.h0 <= M.H - 115, `closed height ${M.h0} mm ≤ ${M.H - 140} mm (above the frame)`],
      ["Lift motor", L.Pk <= mot[0] * 2.5, false, `${mot[0]} W, peak ${f(L.Pk, 0)} W`]);
    D.calc.push(`Angle       α = asin(h/L): ${f(L.a0 * 180 / Math.PI, 1)}° → ${f(L.a1 * 180 / Math.PI, 1)}° (L = ${M.La})`, `Force       F_act = F / tan α → <b>${f(L.F0 / 1000, 1)} kN</b> at the start, ${f(L.F1 / 1000, 1)} kN at the end`,
      `Act. stroke L·(cos α0 − cos α1) = ${f(L.xa, 1)} mm only`, `Motor       peak F·v/η = ${f(L.Pk, 0)} W → <b>${mot[0]} W</b>, actuator <b>${L.act} kN</b>`);
    D.bom.push(["Scissor arms (2 pairs) + pins + bushes", "MAKE", 1, `L = ${M.La} mm, S355`, ""], ["Base rails + rollers for the rolling foot", "MAKE", 2, "", ""],
      ["Electric ball-screw actuator + motor", "BUY", 1, `${L.act} kN, stroke ≥ ${f(L.xa + 10, 0)} mm, ${mot[0]} W`, ""], ["Height sensor (draw-wire or encoder)", "BUY", 1, "", ""]);
    D.guide.push("Ream the pivot bores of each arm pair together (H7) so both sides are equal.", "Fixed foot with pins, rolling foot on 2 rollers in the base rails.",
      "Adjust the actuator end positions; the scissor must never close fully (start force goes to infinity).", "Check the plate is level at bottom, middle and top (±1 mm).");
    D.hint = "Two scissor pairs; an actuator pushes the rolling foot. For a small stroke the scissor is a bad lever: almost closed, the actuator force is many times the load. Scissors are good for big strokes (lift tables, 150–1000 mm).";
  } else {
    D.checks.push(["Cylinder size + pressure", L.p <= M.ph, L.p <= M.ph * 1.1, `${L.n} × Ø${L.d} → ${f(L.p, 0)} bar ≤ ${M.ph} bar`],
      ["Power unit", true, true, `${mot[0]} W for ${f(L.Pk, 0)} W (${f(L.Q, 1)} L/min)`],
      ["Oil on the floor (grip!)", false, true, "drip tray + leak sensor under the cylinders and the power unit – oil under a drive wheel = no braking"],
      ["Load holds when up", false, true, "check valve holds, but the plate sinks slowly by leakage → automatic re-lift + height sensor"]);
    D.calc.push(`Bore        d ≥ √(4F/(n·π·p)) = ${f(L.dreq, 1)} mm → <b>${L.n} × Ø${L.d}</b>`, `Pressure    p = F/(n·A) = <b>${f(L.p, 0)} bar</b>`,
      `Flow        Q = n·A·v = ${f(L.Q, 2)} L/min`, `Power       p·Q/η(0.55) = ${f(L.Pk, 0)} W → <b>${mot[0]} W</b> pump motor`, `Oil         ≈ ${f(L.oil, 1)} L incl. tank`);
    D.bom.push(["Single-acting cylinder + mounting", "BUY", L.n, `Ø${L.d}, stroke ${M.s + 10} mm`, ""], ["Mini power unit 48 V (pump, tank, check valve, lowering valve, relief valve)", "BUY", 1, `${mot[0]} W, ${f(L.Q, 1)} L/min`, ""],
      ["Hoses + fittings", "BUY", 1, "", ""], ["Pressure + height sensors", "BUY", 2, "", ""], ["Drip trays + leak sensor", "MAKE / BUY", 1, "", "do not skip"]);
    D.guide.push("Mount the cylinders vertical (±0.5°) – side load destroys the seals; the plate is guided by the guide pins, not by the cylinders.", "Fill and bleed the system; set the relief valve to " + M.ph + " bar.",
      "Set the lowering speed with the throttle valve (no free fall if a hose bursts: hose-burst valve at each cylinder).", "Fit the drip trays and the leak sensor; check for leaks after 24 h.");
    D.hint = "Single-acting cylinders, a small 48 V power unit (motor + pump + tank + valves). High force in little space – but oil can leak onto the floor (no grip for the drive wheels), the load sinks slowly, and service is more work. Used for heavy AGVs.";
  }
  return D;
}
function ctrlSVG(R, M) {
  const W = 760, H = 490;
  const bx = (x, y, w, h, t, sub, cls = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="${cls === "safe" ? "color-mix(in srgb, var(--critical) 12%, var(--surface))" : cls === "pc" ? "color-mix(in srgb, var(--accent) 12%, var(--surface))" : "var(--surface)"}" stroke="${cls === "safe" ? "var(--critical)" : cls === "pc" ? "var(--accent)" : "var(--border)"}" stroke-width="1.4"/>
    <text x="${x + w / 2}" y="${y + (sub ? h / 2 - 2 : h / 2 + 4)}" class="apc-t c" style="font-weight:600;fill:var(--text)">${t}</text>${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 12}" class="apc-t c">${sub}</text>` : ""}`;
  const ln = (x1, y1, x2, y2, col, t, dash) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${col}" stroke-width="1.6" fill="none" marker-end="url(#avC)" ${dash ? 'stroke-dasharray="5 3"' : ""}/>${t ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" class="apc-t c" style="font-size:10px">${t}</text>` : ""}`;
  const red = "var(--critical)", blu = "var(--accent)", gry = "var(--text-2)";
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Control system of the AGV"><defs><marker id="avC" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 z" fill="context-stroke"/></marker></defs>`;
  g += bx(270, 8, 220, 40, "Fleet manager (server)", "VDA 5050 over MQTT");
  g += ln(380, 48, 380, 72, blu, "") + `<text x="388" y="64" class="apc-t" style="font-size:10px">Wi-Fi 5 GHz, roaming</text>`;
  // sensors left
  const L = [["2 × safety laser scanner", "FL + RR, 360°"], ["2 × E-stop + mode key", "AUTO / MANUAL"], ["Manual pendant", "3-position enable"], ["Lift sensors", "DOWN / UP + encoder"], ["Crate-on-plate sensor", "diffuse, upward"], ["Battery BMS", "CAN: SoC, temp."]];
  L.forEach(([a, b], i) => { g += bx(10, 80 + i * 56, 170, 44, a, b); });
  // centre
  g += bx(270, 80, 220, 120, "Navigation / vehicle PC", "map, path, VDA 5050 client", "pc");
  g += `<text x="380" y="168" class="apc-t c">localisation · motion control</text><text x="380" y="182" class="apc-t c">lift + charging logic</text>`;
  g += bx(270, 250, 220, 110, "Safety controller (PL d)", "field switching by speed", "safe");
  g += `<text x="380" y="330" class="apc-t c">safe speed (SLS) · STO · brakes</text><text x="380" y="344" class="apc-t c">E-stop stop cat. 0 / 1</text>`;
  // right actuators
  const Rr = [["2 × servo drive 48 V", "CANopen + STO"], ["2 × drive motor", "encoder + brake"], ["Lift motor driver", "worm gear motor"], ["LED strip, buzzer", "display"], ["Charging contactor", "floor contacts"], ["E84 optical I/O", "optional"]];
  Rr.forEach(([a, b], i) => { g += bx(580, 80 + i * 56, 170, 44, a, b); });
  // lines
  g += ln(180, 102, 268, 120, blu, "measurement data");
  g += ln(180, 108, 268, 270, red, "OSSD (2 ch)");
  g += ln(180, 158, 268, 290, red, ""); g += ln(180, 214, 268, 310, red, "");
  g += ln(180, 270, 268, 180, gry, ""); g += ln(180, 326, 268, 190, gry, ""); g += ln(180, 382, 268, 196, gry, "CAN");
  g += ln(490, 110, 578, 102, blu, "CANopen");
  g += ln(490, 290, 578, 112, red, "STO (2 ch)");
  g += ln(578, 158, 490, 320, red, "speed (encoder)", true);
  g += ln(490, 150, 578, 214, blu, ""); g += ln(490, 170, 578, 270, blu, ""); g += ln(490, 185, 578, 326, blu, ""); g += ln(490, 195, 578, 382, blu, "");
  g += ln(400, 250, 400, 202, red, "") + `<text x="406" y="232" class="apc-t" style="font-size:10px">field set, status</text>`;
  g += ln(460, 360, 578, 230, red, "lift enable");
  // power bar
  g += `<rect x="10" y="${H - 50}" width="${W - 20}" height="40" rx="7" fill="color-mix(in srgb, var(--warning) 14%, var(--surface))" stroke="var(--warning)"/>`;
  g += `<text x="${W / 2}" y="${H - 26}" class="apc-t c" style="fill:var(--text)">Power: battery ${M.Ub} V → fuse → main switch → precharge → 48 V bus (drives, lift) · DC/DC 48/24 V (PC, scanners, safety, I/O)</text>`;
  g += `<text x="10" y="${H - 60}" class="apc-t" style="font-size:10px"><tspan style="fill:var(--critical)">red = safety (wired, 2 channels)</tspan> · <tspan style="fill:var(--accent)">blue = control (bus)</tspan> · grey = monitoring</text>`;
  return g + `</svg>`;
}
function fieldSVG(R, M) {
  const W = 760, maxL = M.L + R.fields[R.fields.length - 1].Dw + 100, sc = (W - 140) / maxL, rows = R.fields.length, rh = 44, H = rows * rh + 40;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Safety fields for each speed">`;
  R.fields.forEach((fd, i) => {
    const y = 14 + i * rh, x0 = 120, ag = M.L * sc, wy = 26;
    g += `<text x="${x0 - 8}" y="${y + wy / 2 + 4}" class="apc-t r">${fd.v} m/s</text>`;
    g += `<rect x="${x0}" y="${y}" width="${ag}" height="${wy}" class="mx-agv"/>`;
    g += `<rect x="${x0 + ag}" y="${y - 2}" width="${fd.Dp * sc}" height="${wy + 4}" fill="color-mix(in srgb, var(--critical) 28%, transparent)" stroke="var(--critical)"/>`;
    g += `<rect x="${x0 + ag + fd.Dp * sc}" y="${y - 2}" width="${(fd.Dw - fd.Dp) * sc}" height="${wy + 4}" fill="color-mix(in srgb, var(--warning) 22%, transparent)" stroke="var(--warning)" stroke-dasharray="4 3"/>`;
    g += `<text x="${x0 + ag + 4}" y="${y + wy / 2 + 4}" class="apc-t" style="fill:var(--text)">${f(fd.Dp, 0)}</text>`;
    g += `<text x="${x0 + ag + fd.Dp * sc + 4}" y="${y + wy / 2 + 4}" class="apc-t">${f(fd.Dw, 0)}</text>`;
  });
  g += `<text x="120" y="${H - 6}" class="apc-t">AGV (${M.L} mm) · red = protective field (stop) · yellow = warning field (slow down) · values in mm</text>`;
  return g + `</svg>`;
}
function accSVG(R, M) {
  const items = [...R.acc.map((r) => [r[0], r[1], false]), ["Total (RSS = √ sum of squares)", R.accRSS, true]];
  const lims = [["item 3 flare", 40], ["item 2 V-guide", 55]];
  const W = 760, lw = 250, rh = 24, H = items.length * rh + 46, max = Math.max(R.accSum, 60) * 1.05, sc = (W - lw - 70) / max;
  let g = `<svg viewBox="0 0 ${W} ${H}" class="apc-svg" aria-label="Stop error budget">`;
  for (const [n, v] of lims) g += `<line x1="${lw + v * sc}" y1="4" x2="${lw + v * sc}" y2="${H - 30}" stroke="var(--good)" stroke-dasharray="4 3"/><text x="${lw + v * sc}" y="${H - 16}" class="apc-t c" style="fill:var(--good-text)">${n} ±${v}</text>`;
  items.forEach(([n, v, tot], i) => {
    const y = 6 + i * rh;
    g += `<text x="${lw - 8}" y="${y + 14}" class="apc-t r" style="${tot ? "font-weight:600;fill:var(--text)" : ""}">${esc(n)}</text>`;
    g += `<rect x="${lw}" y="${y + 3}" width="${Math.max(2, v * sc)}" height="${rh - 8}" rx="3" fill="${tot ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, transparent)"}"/>`;
    g += `<text x="${lw + Math.max(2, v * sc) + 6}" y="${y + 14}" class="apc-t" style="fill:var(--text)">±${f(v, 1)} mm</text>`;
  });
  g += `<text x="${lw}" y="${H - 2}" class="apc-t">worst case (all at once, very unlikely): ±${f(R.accSum, 1)} mm · at the crate corner with ±${f(R.yaw, 2)}°: ±${f(R.capt, 1)} mm</text>`;
  return g + `</svg>`;
}

/* ------------------------------------------------------------------ UI */
const boxA = $("avItem1");
if (boxA) {
  boxA.innerHTML = `
    <div class="kpis" id="avKpis"></div>
    <div class="card">
      <div class="card-head"><h2>3D – underride lifting AGV</h2><span class="sub">drag = turn · right-drag = move · wheel = zoom at the mouse · double-click = new turning point · click a part for its data</span></div>
      <div class="apc3d-bar"><button class="btn primary" id="avPlay">▶ Play</button><input type="range" id="avScrub" min="0" max="1000" value="0" aria-label="Time"><span id="avStep" class="small"></span></div>
      <div class="apc3d-bar">
        <span class="tb-label">View</span><div class="seg" role="group" aria-label="View">
          <button class="seg-btn" data-avview="overview">Overview</button><button class="seg-btn" data-avview="side">Side</button><button class="seg-btn" data-avview="under">From below</button>
          <button class="seg-btn" data-avview="lift">Lift detail</button><button class="seg-btn" data-avview="top">Top</button></div>
        <span class="tb-label">Lift</span><div class="seg" role="group" aria-label="Lift type">
          <button class="seg-btn" data-avlift="cam">Cam</button><button class="seg-btn" data-avlift="screw">Screw jack</button><button class="seg-btn" data-avlift="scissor">Scissor</button><button class="seg-btn" data-avlift="hyd">Hydraulic</button></div>
        <label class="tb-check">Exploded view <input type="range" id="avEx" min="0" max="100" value="0" style="width:110px;vertical-align:middle" aria-label="Exploded view"></label>
        <label class="tb-check"><input type="checkbox" id="avCov" checked> covers</label>
        <label class="tb-check"><input type="checkbox" id="avFld" checked> safety field</label>
        <label class="tb-check"><input type="checkbox" id="avLbl" checked> labels</label>
      </div>
      <div class="apc3d-grid"><div class="apc3d" id="av3d"></div><div class="apc3d-info" id="av3dInfo"></div></div>
      <div class="apc3d-legend small muted"><span><i style="background:#3c6e9e"></i>frame (MAKE)</span><span><i style="background:#c8ccd0"></i>lift plate (MAKE)</span><span><i style="background:#d9832b"></i>PU wheels / castors</span>
        <span><i style="background:#2f7d4f"></i>battery</span><span><i style="background:#f2c200"></i>scanners / springs</span><span><i style="background:#d03b3b"></i>protective field</span><span><i style="background:#2fa84f"></i>docking field</span></div>
    </div>
    <div class="card"><div class="card-head"><h2>Stop accuracy – where the ±mm come from</h2><span class="sub">your question: "how accurate is it?"</span></div>
      <div class="grid2 eq" style="margin-top:0"><div><div id="avAccSvg"></div><p class="hint" id="avAccNote"></p></div><div id="avAccTxt"></div></div>
      <h3 style="margin:14px 0 6px;font-size:14px">Navigation methods – what accuracy can you buy?</h3><div class="table-wrap"><table class="apc-bom" id="avNav"></table></div>
    </div>
    <div class="grid2 eq" style="margin-top:0">
      <div class="card"><div class="card-head"><h2 id="avLiftH">Lift</h2><span class="sub">moves with the animation · change the type above the 3D view</span></div><div id="avLift"></div>
        <p class="hint" id="avLiftHint"></p>
        <h3 style="margin:14px 0 6px;font-size:14px">Compare the 4 lift types (your numbers)</h3><div class="table-wrap"><table class="apc-bom" id="avLiftCmp"></table></div></div>
      <div class="card"><div class="card-head"><h2>Steps</h2></div><div class="table-wrap"><table class="apc-bom apc-seq"><thead><tr><th>#</th><th>Step</th><th>Time</th></tr></thead><tbody id="avSteps"></tbody></table></div>
        <h3 style="margin:14px 0 6px;font-size:14px">Mass budget</h3><div class="table-wrap"><table class="apc-bom" id="avMass"></table></div></div>
    </div>
    <div class="card"><div class="card-head"><h2>Control system</h2><span class="sub">what is inside the control box and how it is wired</span></div>
      <div class="grid2" style="margin-top:0"><div id="avCtrl"></div><div><h3 style="margin:0 0 6px;font-size:14px">Signal list (I/O)</h3><div class="table-wrap"><table class="apc-bom" id="avIO"></table></div></div></div></div>
    <div class="card"><div class="card-head"><h2>Safety fields (ISO 3691-4)</h2><span class="sub">field length = stopping distance + reserve, switched by speed</span></div>
      <div class="grid2" style="margin-top:0"><div id="avFields"></div><div><div class="table-wrap"><table class="apc-bom" id="avFieldTab"></table></div>
        <p class="hint">Under the stand the scanners see the posts and rails. There the AGV switches to a short <b>docking field</b>, but only at creep speed and only in the marked station area.
          This must be in the risk assessment – the station area must be marked and people kept out by the layout (ISO 3691-4, "restricted zone").</p></div></div></div>
    <div class="apc-main">
      <div class="card apc-incard"><div class="card-head"><h2>Design inputs</h2><button class="btn ghost" id="avReset">Example values</button></div><div id="avInputs"></div></div>
      <div class="apc-right">
        <div class="card"><div class="card-head"><h2>Checks</h2></div><div id="avChecks" class="apc-checks"></div></div>
        <div class="card"><div class="card-head"><h2>Calculations</h2><span class="sub">formulas with your numbers</span></div><div id="avCalc" class="apc-calc"></div></div>
      </div>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-head"><h2>Bill of materials</h2><span class="sub">MAKE = you manufacture · BUY = catalogue / supplier</span></div><div class="table-wrap"><table id="avBom" class="apc-bom"></table></div></div>
    <div class="card"><div class="card-head"><h2>Guide – make or buy, manufacturing, assembly, commissioning, tests, maintenance</h2></div><div id="avGuide" class="mx-guide"></div></div>`;

  let M = { ...DEF };
  try { Object.assign(M, JSON.parse(localStorage.getItem("agvState") || "{}")); } catch (e) { /* private window */ }
  let R = calc(M), ST = steps(R, M), T = 0, playing = false, last = performance.now(), view = null, geo = "";
  const tot = () => ST.reduce((s, r) => s + r[2], 0), pane = $("tab-agv"), cls = { ok: "apc-ok", warn: "apc-warn", bad: "apc-bad" };

  function inputs() {
    $("avInputs").innerHTML = GROUPS.map(([g, fs]) => `<fieldset class="apc-fs"><legend>${esc(g)}</legend>${fs.map(([k, l, u, d, n]) =>
      `<label class="apc-f" title="${esc(n || "")}"><span>${esc(l)}${n ? ` <i class="muted">${esc(n)}</i>` : ""}</span>
        <span class="apc-in"><input type="number" step="any" data-k="${k}" value="${M[k]}" aria-label="${esc(l)}"${M[k] !== d ? ' class="chg"' : ""}><em>${esc(u)}</em></span></label>`).join("")}</fieldset>`).join("");
  }
  function checks() {
    const c = [], add = (l, ok, warn, t) => c.push([l, ok ? "ok" : warn ? "warn" : "bad", t]);
    add("Drive motor", R.Tm <= R.mot[2] * 0.8 && R.Tmc <= R.mot[1] * 0.8, R.Tm <= R.mot[2], `${R.mot[0]} W: peak ${f(R.Tm, 2)} ≤ ${f(R.mot[2] * 0.8, 2)} Nm, continuous ${f(R.Tmc, 2)} ≤ ${f(R.mot[1] * 0.8, 2)} Nm`);
    add("Gear ratio reaches the speed", R.vreal >= M.vmax * 0.97, R.vreal >= M.vmax * 0.9, `i = ${R.i} → ${f(R.vreal, 2)} m/s at 3000 rpm (need ${M.vmax})`);
    add("Grip when accelerating (empty and loaded, floor step)", R.trSF >= 1.3, R.trSF >= 1, `weakest case ×${f(R.trSF, 2)} (μ ${M.mu}, wheel load ${f(R.Nmin, 0)} N min.)`);
    add("Emergency braking possible with the grip", M.dec <= R.abmax * 0.9, M.dec <= R.abmax, `need ${M.dec} m/s², grip allows ${f(R.abmax, 2)} m/s² (drive wheels only brake)`);
    add("Drive wheel load ≤ PU wheel rating", R.Nmax / G <= R.wrate * 0.8, R.Nmax / G <= R.wrate, `${f(R.Nmax / G, 0)} kg ≤ ${R.wrate} kg (Ø${M.Dw} PU)`);
    add("Castor load", R.Fcast <= R.castor[1], false, `${f(R.Fcast, 0)} kg ≤ ${R.castor[1]} kg (Ø${R.castor[0]})`);
    add("No tipping forward at emergency stop", R.SFlong >= 2, R.SFlong >= 1.5, `safety ×${f(R.SFlong, 1)} (CoG ${f(R.hcg, 0)} mm high)`);
    add("No tipping sideways in curves", R.SFlat >= 2, R.SFlat >= 1.5, `${M.vc} m/s at R ${M.rc} m: safety ×${f(R.SFlat, 1)}`);
    add("Crate does not slide on the pad", R.SFpad >= 2, R.SFpad >= 1.5, `PU μ 0.5 vs ${f(M.dec / G, 2)} needed (×${f(R.SFpad, 1)})`);
    for (const [l, ok, warn, t] of liftDetail(R, M).checks) add(`${l} (${R.L.name.toLowerCase()})`, ok, warn, t);
    add("Crate lifts off the rails", R.liftoff >= 15, R.liftoff >= 8, `stroke ${M.s} − 20 = ${f(R.liftoff, 0)} mm free under the crate`);
    add("AGV drives under the crate", R.under >= 10, R.under >= 5, `20 mm − floor ${M.df} mm = ${f(R.under, 0)} mm clearance`);
    add("Battery fits in the chassis", R.Lb <= M.L / 2 + 10, false, `${f(R.Lb, 0)} mm long, space ≈ ${f(M.L / 2 + 10, 0)} mm`);
    add("Battery runtime (one shift = 8 h)", R.run >= 8, R.run >= 3, `${f(R.run, 1)} h at ${f(R.Ph, 0)} W average; with opportunity charging ${f(R.chg * 100, 0)} % on the charger`);
    add("Battery peak current", R.Crate <= 2, R.Crate <= 3, `${f(R.Ipk, 0)} A = ${f(R.Crate, 1)} C (LiFePO4 ≤ 2 C)`);
    add("AGV busy (driving + charging)", R.util <= 0.75, R.util <= 0.9, `${f(R.util * 100, 0)} % (${M.trips} transports/h × ${f(R.ttrip, 0)} s)`);
    add("Stop accuracy vs station capture", R.capt <= 35, R.capt <= 40, `±${f(R.capt, 1)} mm at the crate corner ≤ flare 40 mm (item 3) / V-guide 55 mm (item 2)`);
    add("Protective field at full speed", R.Dmax <= 1500, R.Dmax <= 2200, `${f(R.Dmax, 0)} mm at ${M.vmax} m/s – long fields = many stops in narrow aisles`);
    return c;
  }
  const blk = (t, rows, note) => `<div class="apc-blk"><h3>${t}</h3><div class="gc-formula">${rows.join("\n")}</div>${note ? `<p class="hint">${note}</p>` : ""}</div>`;
  function formulas() {
    $("avCalc").innerHTML = [
      blk("1 · Mass", [`Empty AGV      m_e = ${f(R.me, 0)} kg (see mass budget)`, `Total          m = ${f(R.me, 0)} + ${M.mp} = <b>${f(R.mt, 0)} kg</b>`]),
      blk("2 · Drive force + motor", [`Rolling   F_r = c_rr·m·g = ${M.crr}·${f(R.mt, 0)}·9.81 = ${f(R.Froll, 0)} N`, `Slope     F_s = m·g·${M.slope} % = ${f(R.Fsl, 0)} N`,
        `Accel.    F_a = m·a = ${f(R.mt, 0)}·${M.acc} = ${f(R.Facc, 0)} N`, `Peak      F = <b>${f(R.Fpk, 0)} N</b> → ${f(R.Fpk / 2, 0)} N per wheel`,
        `Wheel     n = v·60/(π·D) = ${f(R.nw, 0)} rpm → i ≤ 3000/${f(R.nw, 0)} = ${f(R.ireq, 1)} → <b>i = ${R.i}</b>`,
        `Motor     T = F/2·r/(i·η) = ${f(R.Tm, 2)} Nm peak, ${f(R.Tmc, 2)} Nm cont. → <b>${R.mot[0]} W</b>`]),
      blk("3 · Grip + braking", [`Wheel load    N = ${M.shr} %·m·g/2 ± k_c·Δ = ${f(R.Ne, 0)} (empty) / ${f(R.Nl, 0)} (loaded) ± ${f(R.dN, 0)} N`, `Grip          μ·(N − ${f(R.dN, 0)}) → weakest ×${f(R.trSF, 2)} vs drive force`,
        `Max. braking  a = 2·μ·(N − Δ)/m = <b>${f(R.abmax, 2)} m/s²</b> (worst of empty / loaded)`, `Castor load   m·g·${100 - M.shr} %/4 ×1.25 + Δ = ${f(R.Fcast, 0)} kg`],
        "Only the 2 drive wheels can brake. Fixed drive springs fail here: strong enough for the loaded AGV = they lift the EMPTY AGV off its castors. Sprung castors keep the share constant."),
      blk("4 · Stability", [`CoG height   h = (m_e·120 + m_p·${M.H + M.s + M.hcg})/m = ${f(R.hcg, 0)} mm`, `Forward      g·${R.xc}/(a·h) = ×${f(R.SFlong, 1)}`,
        `Sideways     a_lat = v²/R = ${f(R.alat, 2)} m/s² → ×${f(R.SFlat, 1)}`]),
      blk(`5 · Lift – ${R.L.name.toLowerCase()}`, liftDetail(R, M).calc),
      blk("6 · Energy", [`Per transport  rolling ${f(R.Eroll / 1000, 1)} kJ + accel. ${f(R.Eacc / 1000, 1)} kJ + lift ${f(R.Elift / 1000, 2)} kJ`, `Average power  ${M.trips}/h × ${f(R.Etrip / 1000, 1)} kJ + ${M.Pel} W = <b>${f(R.Ph, 0)} W</b>`,
        `Battery        ${M.Ub} V × ${M.Ah} Ah × ${M.dod} = ${f(R.Ebat, 0)} Wh → <b>${f(R.run, 1)} h</b>`, `Charger        ${M.Pch} kW → ${f(R.chg * 100, 0)} % of the time`]),
      blk("7 · Safety field", [`Reaction  t = ${M.tsc} + ${M.tct} = ${f(R.tr, 2)} s`, `Field     D = v·t + v²/(2·a_eff)·1.1 + ${M.Zs},  a_eff = a − g·slope = ${M.dec} − 9.81·${M.slope / 100} = ${f(R.decEff, 3)} m/s² (downhill on the allowed slope)`, ...R.fields.map((x) => `  ${String(x.v).padEnd(4)} m/s → ${f(x.Dp, 0)} mm`)]),
      blk("8 · Stop accuracy", [...R.acc.map((r) => `${r[0].padEnd(36)} ±${f(r[1], 1)}`), `RSS = √(Σ e²) = <b>±${f(R.accRSS, 1)} mm</b>, angle ±${f(R.yaw, 2)}°`]),
    ].join("");
  }
  function accTxt() {
    $("avAccSvg").innerHTML = accSVG(R, M);
    const big = R.acc.slice().sort((a, b) => b[1] - a[1]);
    $("avAccNote").innerHTML = `Biggest sources: <b>${esc(big[0][0])}</b> (±${f(big[0][1], 1)}) and <b>${esc(big[1][0])}</b> (±${f(big[1][1], 1)}). The errors are independent, so they add as √(sum of squares), not simply.`;
    $("avAccTxt").innerHTML = `
      <p><b>Short answer:</b> with these example values this AGV stops <b>±${f(R.accRSS, 0)} mm</b> and <b>±${f(R.yaw, 1)}°</b> accurately (3σ, after teaching).
        At the corner of the crate that is ±${f(R.capt, 0)} mm. Items 2 and 3 catch ±40–55 mm mechanically, so <b>this is enough – do not pay for a ±2 mm AGV</b>.</p>
      <p><b>Accuracy ≠ repeatability.</b> The AGV has a constant offset (e.g. always 6 mm too far) plus a random scatter. The offset is removed by <b>teaching</b> the station
        (drive there, measure, correct the station coordinate). What stays is the scatter = <b>repeatability</b>. Supplier data "±10 mm" usually mean repeatability at taught points.</p>
      <p><b>How to measure it (do this at SAT):</b></p>
      <ol class="apc-list"><li>Fix a steel ruler or a dial gauge stand at the station; stick a target mark on the lift plate (front and rear → also the angle).</li>
        <li>Drive to the station <b>30 times</b>: from different directions, empty and loaded, at different battery levels.</li>
        <li>Write down x, z (and the angle from front/rear difference) every time.</li>
        <li>Mean = offset → correct it in the map. Spread: σ → <b>repeatability = ±3σ</b>. Accept if ±3σ ≤ ${f(R.accRSS * 1.2, 0)} mm.</li></ol>
      <p><b>What makes it better (cheap → expensive):</b> rigid, pinned scanner brackets · slow final creep (${M.vcr} m/s) · reflectors near the stations · re-calibrate the wheel Ø after wear · a fine-positioning sensor at the station.</p>`;
    const nav = [
      ["Lidar contour (natural features, SLAM)", "the scanners compare walls / columns / machines with the map", "±10 mm, ±0.5°", "enough fixed contour in view (not only crates that move); scanner windows clean", "lowest (software only)"],
      ["Lidar + reflectors", "reflector strips on columns, ≥ 3 in view", "±3–5 mm, ±0.2°", "reflectors at scanner height (~175 mm) or on posts; keep them clean", "low"],
      ["Floor codes (QR / data matrix) + camera", "camera under the AGV reads codes every ~1 m", "±3–5 mm, ±0.2° at a code", "clean floor – foundry sand and forklift tyres wear the codes", "medium"],
      ["Magnetic tape + RFID", "follows a tape, RFID tags for stops", "±5 sideways, ±10 along", "tape in the floor; changes = new tape; robust to dust", "low, but fixed routes"],
      ["Fine positioning at the station", "camera / laser on a target at the station, only for the last 100 mm", "±1–2 mm", "a target per station, extra sensor", "medium – only where needed"],
      ["Mechanical docking (items 1–3)", "V-guides, cones, floating deck catch the error", "station decides (±0.1 mm possible)", "your stations – you already have them", "cheapest overall ✓"]];
    $("avNav").innerHTML = `<thead><tr><th>Method</th><th>How it works</th><th>Stop accuracy (typ.)</th><th>Needs in the factory</th><th>Cost</th></tr></thead><tbody>${nav.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<b>${esc(c)}</b>` : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }
  function liftCard() {
    $("avLiftH").textContent = "Lift – " + R.L.name.toLowerCase();
    $("avLiftHint").textContent = liftDetail(R, M).hint;
    boxA.querySelectorAll("[data-avlift]").forEach((b) => b.classList.toggle("active", b.dataset.avlift === R.lt));
    const rows = [["Positions", (l) => l.pos], ["Holds the load without power", (l) => l.hold], ["Peak power", (l) => f(l.Pk, 0) + " W"], ["Lift motor", (l) => l.mot[0] + " W"],
      ["Energy per lift", (l) => f(l.E, 0) + " J"], ["Lift time", (l) => f(l.t, 2) + " s"], ["Mass (approx.)", (l) => f(l.mass, 0) + " kg"], ["Maintenance", (l) => l.maint], ["Cost", (l) => l.cost], ["Best for", (l) => l.best]];
    const ks = ["cam", "screw", "scissor", "hyd"];
    $("avLiftCmp").innerHTML = `<thead><tr><th></th>${ks.map((k) => `<th${k === R.lt ? ' style="color:var(--accent)"' : ""}>${R.lifts[k].name}${k === R.lt ? " ✓" : ""}</th>`).join("")}</tr></thead><tbody>${rows.map(([n, fn]) =>
      `<tr><td><b>${n}</b></td>${ks.map((k) => `<td${k === R.lt ? ' style="background:color-mix(in srgb, var(--accent) 8%, transparent)"' : ""}>${esc(fn(R.lifts[k]))}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }
  function massTab() {
    $("avMass").innerHTML = `<thead><tr><th>Part</th><th>kg</th></tr></thead><tbody>${R.mass.map(([n, m]) => `<tr><td>${esc(n)}</td><td>${f(m, 1)}</td></tr>`).join("")}
      <tr><td><b>Empty AGV</b></td><td><b>${f(R.me, 0)}</b></td></tr><tr><td>+ payload (rated)</td><td>${M.mp}</td></tr><tr><td><b>Total</b></td><td><b>${f(R.mt, 0)}</b></td></tr></tbody>`;
  }
  function ioTab() {
    const rows = [
      ["-B1, -B2", "Safety laser scanners FL / RR", "OSSD 2 ch → safety ctrl; field set ← safety ctrl; Ethernet → nav PC"],
      ["-S1, -S2", "E-stop left / right", "2 NC → safety ctrl (stop cat. 0 / 1)"],
      ["-S3", "Mode key AUTO / MANUAL", "→ safety ctrl"],
      ["-X5", "Manual pendant (3-position enable, joystick)", "enable → safety ctrl, joystick → nav PC"],
      ["-B10, -B11", "Lift DOWN (0°) / UP (180°), inductive M12", "→ nav PC I/O"],
      ["-B12", "Cam angle encoder (absolute)", "→ nav PC (plausibility with B10/B11)"],
      ["-B13", "Crate on plate (diffuse sensor, upward)", "→ nav PC"],
      ["-A1, -A2 / -M1, -M2", "Servo drives / drive motors", "CANopen ← nav PC; STO 2 ch ← safety ctrl; encoder → safety ctrl (safe speed)"],
      ["-Y1, -Y2", "Motor holding brakes", "safe brake control ← safety ctrl"],
      ["-A3 / -M3", "Lift driver / worm gear motor", "enable ← safety ctrl (lift only at standstill)"],
      ["-G1", "Battery + BMS", "CAN → nav PC (SoC, temperature, alarms)"],
      ["-K1, -X10", "Charging contactor + floor contacts", "← nav PC / BMS"],
      ["-P1…-P3", "LED strip, buzzer, display", "← nav PC"],
      ["-W1", "Wi-Fi client 5 GHz", "Ethernet ↔ nav PC; VDA 5050 / MQTT to the fleet manager"],
      ["-Q1, -F1", "Main switch + main fuse + precharge", "battery → 48 V bus"]];
    $("avIO").innerHTML = `<thead><tr><th>Tag</th><th>Device</th><th>Signal / connection</th></tr></thead><tbody>${rows.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join("")}</tbody>`;
  }
  function fieldTab() {
    $("avFields").innerHTML = fieldSVG(R, M);
    const use = (v) => (v <= M.vst + 1e-9 ? "stations, lanes near people" : v < M.vmax - 1e-9 ? "aisles, crossings" : "free main route");
    $("avFieldTab").innerHTML = `<thead><tr><th>Speed</th><th>Protective</th><th>Warning</th><th>Where</th></tr></thead><tbody>${R.fields.map((x) => `<tr><td>${x.v} m/s</td><td><b>${f(x.Dp, 0)} mm</b></td><td>${f(x.Dw, 0)} mm</td><td>${use(x.v)}</td></tr>`).join("")}
      <tr><td>≤ ${M.vcr} m/s</td><td><b>150 mm</b></td><td>–</td><td>docking field under the stand</td></tr></tbody>`;
  }
  function bom() {
    const rows = [
      ["Chassis frame, welded + machined", "MAKE", 1, `S355 tube 80×40×3, ${M.L} × ${M.W} mm, mounting faces ±0.2 mm`, "welding jig"],
      ["Floor plate", "MAKE", 1, "S235 8 mm laser cut", ""],
      ["Drive rocker (pivot along x) + gearbox flanges", "MAKE", 1, "carries both drive modules", "or BUY a complete drive unit"],
      ["Castor spring unit (spring + guide + preload screw)", "MAKE / BUY", 4, `${M.kc} N/mm, share ${M.shr} % on the drive wheels`, "or BUY sprung castors"],
      ["Drive wheel PU", "BUY", 2, `Ø${M.Dw}, 92–95 ShA, Al hub`, ""],
      ["BLDC servo motor 48 V + brake + encoder + planetary gearbox", "BUY", 2, `${R.mot[0]} W, i = ${R.i}`, ""],
      ["Servo drive 48 V, CANopen, STO", "BUY", 2, "", ""],
      ["Castor PU, ball-bearing swivel", "BUY", 4, `Ø${R.castor[0]}, ${R.castor[1]} kg`, ""],
      ["Lift plate Al 5083 + PU pad", "MAKE", 1, `${R.Lp} × ${R.Wp} × 15 mm + 5 mm PU`, ""],
      ...liftDetail(R, M).bom,
      ["Guide pins Ø20 h6 + bushes", "MAKE / BUY", 4, `play ≤ ${M.gpl} mm`, ""],
      ["Battery LiFePO4 with BMS (CAN)", "BUY", 1, `${M.Ub} V ${M.Ah} Ah`, ""],
      ["Main switch, main fuse, precharge, contactor, DC/DC 48/24 V", "BUY", 1, "", ""],
      ["Floor charging contacts + charger", "BUY", 1, `${M.Pch} kW`, "1 charger per station with charging"],
      ["Safety laser scanner with measurement data", "BUY", 2, "PL d, 275°", ""],
      ["Safety controller", "BUY", 1, "PL d, safe speed inputs", ""],
      ["Navigation controller / industrial PC + navigation software", "BUY", 1, "VDA 5050 client, offline map", "the hardest part – buy it"],
      ["Wi-Fi client, industrial, 5 GHz roaming", "BUY", 1, "", ""],
      ["E-stops, mode key, pendant socket", "BUY", 1, "set", ""],
      ["LED strip, buzzer, display", "BUY", 1, "set", ""],
      ["Covers 2 mm, powder coated, scanner windows", "MAKE", 1, "set", ""],
      ["Cable harness + control box", "MAKE", 1, "to the wiring diagram", ""]];
    $("avBom").innerHTML = `<thead><tr><th>#</th><th>Part</th><th>Make / buy</th><th>Qty</th><th>Specification</th><th>Note</th></tr></thead><tbody>${rows.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${esc(r[0])}</td><td><span class="apc-mb ${String(r[1]).split(" ")[0]}">${esc(r[1])}</span></td><td>${r[2]}</td><td>${esc(r[3])}</td><td class="muted">${esc(r[4])}</td></tr>`).join("")}</tbody>`;
  }
  function guide() {
    $("avGuide").innerHTML = `
      <h3>1 · Make or buy – and what it means for you</h3>
      <p>If you build the AGV yourself, <b>you are the manufacturer</b>: risk assessment, ISO 3691-4, safety functions validated to PL d (ISO 13849), CE marking and the operating manual are your job.
        A good split for a first AGV:</p>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Part</th><th>Recommendation</th><th>Why</th></tr></thead><tbody>
        <tr><td>Frame, lift plate, cam shafts, covers, drive arms</td><td><b>MAKE</b></td><td>normal machine shop work – your strength</td></tr>
        <tr><td>Drive wheels, motors, gearboxes, drives, castors, battery</td><td><b>BUY</b></td><td>catalogue parts; ask for a matched "AGV drive kit" (motor + gearbox + drive + wheel)</td></tr>
        <tr><td>Safety scanners + safety controller</td><td><b>BUY</b> (certified)</td><td>never self-made; the configuration is your job</td></tr>
        <tr><td>Navigation software + fleet manager</td><td><b>BUY</b></td><td>the hardest part (localisation, path planning, VDA 5050); years of work to make yourself</td></tr></tbody></table></div>
      <h3>2 · Manufacture the chassis</h3>
      <ol class="apc-list">
        <li>Cut tubes (80 × 40 × 3 S355), weld the frame in a <b>jig</b> – symmetric welding sequence, check the diagonal (±1 mm).</li>
        <li>Weld the bridge tubes over the drive wheels, the castor brackets and the bearing brackets.</li>
        <li><b>Machine after welding</b> in one set-up: castor mounting faces (all 4 in one plane ±0.2 mm), drive-arm pivot bores (in line ±0.05 mm), cam bearing brackets (in line ±0.1 mm), guide bush seats.</li>
        <li>Floor plate: laser cut, screwed + bonded (shear stiffness). Zinc-rich primer, powder coat RAL 5010.</li></ol>
      <h3>3 · Drive modules</h3>
      <ol class="apc-list">
        <li>Rocker with a central pivot along x (2 bronze bushes): both drive modules (wheel + gearbox + motor) on it, so both wheels always touch the floor.</li>
        <li>Castors on spring units. Put the AGV on <b>6 scales</b> (2 drive wheels + 4 castors) and adjust the castor spring preload until the drive wheels carry <b>${M.shr} %</b> – check empty (${f(R.Ne * 2 / G, 0)} kg) and loaded (${f(R.Nl * 2 / G, 0)} kg).</li>
        <li>Check: with a ${M.df} mm plate under one castor each drive wheel still carries ≥ ${f(R.Nmin, 0)} N.</li></ol>
      <h3>4 · Lift (${esc(R.L.name.toLowerCase())})</h3>
      <ol class="apc-list">${liftDetail(R, M).guide.map((x) => `<li>${esc(x)}</li>`).join("")}
        <li>Test 200 lift cycles with the rated load ${M.mp} kg, also with the load 100 mm off-centre; plate level ±2 mm.</li></ol>
      <h3>5 · Electrical + control</h3>
      <ol class="apc-list">
        <li>Control box after the diagram above; 48 V power cables (≥ 16 mm² for the battery line) apart from signal cables; all safety signals 2-channel.</li>
        <li>STO wiring from the safety controller to both drives; brake control; E-stop = stop category 0 or 1 (decided in the risk assessment).</li>
        <li>Label every wire and terminal like the I/O list (-B1, -S1 …).</li></ol>
      <h3>6 · Commissioning – in this order</h3>
      <ol class="apc-list">
        <li>AGV on blocks: drives jog, direction, encoder, brakes; lift up/down.</li>
        <li>Safety first: E-stops, mode key, pendant enable switch, STO test – before the AGV touches the floor in AUTO.</li>
        <li>Manual driving with the pendant; calibrate the wheel Ø (drive 10 m, measure).</li>
        <li>Configure the scanner fields (table above), measure the real stopping distance at every speed band, empty and loaded, on the dustiest floor area.</li>
        <li>Map the hall, teach the stations, set the docking field areas.</li>
        <li>Accuracy test (30 runs per station, see above), correct the offsets.</li>
        <li>Connect to the fleet manager (VDA 5050), test orders, charging, Wi-Fi loss.</li>
        <li>Validation of all safety functions, documentation, CE.</li></ol>
      <h3>7 · Acceptance tests</h3>
      <div class="table-wrap"><table class="apc-bom"><thead><tr><th>Test</th><th>How</th><th>Accept</th></tr></thead><tbody>
        <tr><td>Stopping distance</td><td>test body (Ø200 cylinder) in the path at ${M.vmax} m/s, loaded</td><td>stops before contact, distance ≤ ${f(R.Dmax - M.Zs, 0)} mm</td></tr>
        <tr><td>Field switching</td><td>drive through all speed bands, check the active field</td><td>always the field for the real speed</td></tr>
        <tr><td>Stop accuracy</td><td>30 runs per station</td><td>±3σ ≤ ${f(R.accRSS * 1.2, 0)} mm, angle ≤ ±${f(R.yaw * 1.2, 1)}°</td></tr>
        <tr><td>Lift</td><td>rated load, 100 mm off-centre, power off at 180°</td><td>level ±2 mm, stays up</td></tr>
        <tr><td>Grip</td><td>emergency stop on the dustiest floor, loaded</td><td>no sliding of the crate, distance as calculated</td></tr>
        <tr><td>Battery</td><td>8 h normal operation with opportunity charging</td><td>SoC never below 20 %</td></tr>
        <tr><td>Communication loss</td><td>Wi-Fi off while driving</td><td>AGV finishes the released path segment and stops safely</td></tr></tbody></table></div>
      <h3>8 · Maintenance</h3>
      <ul class="apc-list"><li>Daily: clean the scanner windows (foundry dust!), E-stop function check.</li>
        <li>Monthly: wheel wear (Ø), castor bearings, chain tension, cam surfaces + rollers (grease), spring preload.</li>
        <li>Every 6 months: stopping distance test, accuracy check at 2 stations, battery health from the BMS.</li>
        <li>Yearly: validation of the safety functions (documented), replace drive wheels when Ø −2 mm and recalibrate.</li></ul>`;
  }
  function info(key) {
    const el = $("av3dInfo"), p = key && partInfo(key, R, M);
    if (!p) {
      const rows = [["Size L × W × H", `${M.L} × ${M.W} × ${M.H} mm`], ["Empty / total mass", `${f(R.me, 0)} / ${f(R.mt, 0)} kg`], ["Drive", `2 × ${R.mot[0]} W, i = ${R.i}`], ["Speed", `${f(R.vreal, 2)} m/s max`],
        ["Lift", `${R.L.name}, ${M.s} mm in ${f(R.tlr, 1)} s`], ["Battery", `${M.Ub} V ${M.Ah} Ah, ${f(R.run, 1)} h`], ["Stop accuracy", `±${f(R.accRSS, 1)} mm / ±${f(R.yaw, 2)}°`], ["Field at full speed", `${f(R.Dmax, 0)} mm`]];
      el.innerHTML = `<div class="apc-pi-h"><b>Underride AGV – main values</b></div><table class="apc-dim"><tbody>${rows.map(([a, b]) => `<tr><td>${a}</td><td><b>${b}</b></td></tr>`).join("")}</tbody></table>
        <p class="hint">Click a part in the 3D view for its function, specification and manufacturing notes. Use "Exploded view" to see the inside.</p>`; return;
    }
    const [n, mb, matl, fn, spec, mfg] = p;
    el.innerHTML = `<div class="apc-pi-h"><b>${esc(n)}</b>${mb ? `<span class="apc-mb ${mb.split(" ")[0].replace("/", "")}">${esc(mb)}</span>` : ""}</div>
      ${fn ? `<p>${esc(fn)}</p>` : ""}${spec ? `<p><span class="muted">Specification</span><br>${esc(spec)}</p>` : ""}${matl ? `<p><span class="muted">Material / type</span><br>${esc(matl)}</p>` : ""}
      ${mfg ? `<p><span class="muted">Manufacturing / mounting</span><br>${esc(mfg)}</p>` : ""}<button class="btn ghost" id="avBack">◀ main values</button>`;
    $("avBack").onclick = () => info(null);
  }
  function render() {
    R = calc(M); ST = steps(R, M); T = Math.min(T, tot());
    const ch = checks();
    $("avKpis").innerHTML = [["Empty mass", f(R.me, 0) + " kg", `+ ${M.mp} kg payload`], ["Drive", `2 × ${R.mot[0]} W`, `i = ${R.i}, ${f(R.vreal, 2)} m/s`], ["Lift", `${M.s} mm / ${f(R.tlr, 1)} s`, `${R.L.name}, ${R.lmot[0]} W`],
      ["Battery", f(R.run, 1) + " h", `${M.Ub} V ${M.Ah} Ah`], ["Stop accuracy", "±" + f(R.accRSS, 1) + " mm", `angle ±${f(R.yaw, 2)}°`],
      ["Checks", ch.filter((x) => x[1] === "ok").length + " / " + ch.length + " OK", ch.some((x) => x[1] === "bad") ? "see the red lines" : ch.some((x) => x[1] === "warn") ? "some warnings" : "all fine"]]
      .map(([l, v, n]) => `<div class="kpi"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${esc(n)}</div></div>`).join("");
    $("avChecks").innerHTML = ch.map(([l, s, t]) => `<div class="apc-chk ${cls[s]}"><b>${s === "ok" ? "✓" : s === "warn" ? "!" : "✕"}</b><span>${esc(l)}</span><span class="muted">${esc(t)}</span></div>`).join("");
    window.AGV = { M, R }; window.dispatchEvent(new Event("agvchange"));      // item 2 (drive control) uses these values
    liftCard(); formulas(); accTxt(); massTab(); ioTab(); fieldTab(); bom(); guide(); $("avCtrl").innerHTML = ctrlSVG(R, M);
    const k = JSON.stringify(M);
    if (view && k !== geo) { geo = k; view.build(R, M); view.setLabels($("avLbl").checked); info(null); }
    draw();
  }
  function draw() {
    const s = stateAt(T, ST, R, M);
    if (view) view.update(s);
    $("avStep").innerHTML = `Step ${s.k + 1}/${ST.length}: <b>${esc(ST[s.k][1])}</b> <span class="muted">${f(T, 1)} / ${f(tot(), 1)} s</span>`;
    $("avScrub").value = Math.round(T / tot() * 1000); $("avPlay").textContent = playing ? "❚❚ Pause" : "▶ Play";
    $("avSteps").innerHTML = ST.map((r, i) => `<tr class="${i === s.k ? "on" : ""}"><td>${i + 1}</td><td>${esc(r[1])}</td><td>${f(r[2], 1)} s</td></tr>`).join("");
    $("avLift").innerHTML = liftSVG(R, M, s.th);
  }
  function init() {
    if (view) { view.resize(); return; }
    try { view = create3D($("av3d")); } catch (e) { $("av3d").innerHTML = `<p class="muted" style="padding:16px">3D could not start (${esc(e.message)}).</p>`; return; }
    new ResizeObserver(() => view.resize()).observe($("av3d")); view.resize(); view.onPick(info);
    geo = JSON.stringify(M); view.build(R, M); info(null); draw();
    const loop = (now) => { requestAnimationFrame(loop); const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!pane.classList.contains("active") || boxA.hidden) return;
      if (playing) { T += dt; if (T >= tot()) { T = tot(); playing = false; } draw(); }
      view.frame(); };
    requestAnimationFrame(loop);
  }
  inputs(); render();
  $("avInputs").addEventListener("change", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    const v = parseFloat(e.target.value); if (!Number.isFinite(v) || v <= 0) { e.target.value = M[k]; return; }
    M[k] = v; e.target.classList.toggle("chg", v !== DEF[k]);
    try { localStorage.setItem("agvState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render();
  });
  $("avReset").addEventListener("click", () => { if (!confirm("Back to the example values?")) return; M = { ...DEF }; try { localStorage.removeItem("agvState"); } catch (er) { /* ignore */ } inputs(); render(); });
  $("avPlay").addEventListener("click", () => { if (!playing && T >= tot()) T = 0; playing = !playing; last = performance.now(); draw(); });
  $("avScrub").addEventListener("input", (e) => { playing = false; T = tot() * e.target.value / 1000; draw(); });
  boxA.querySelectorAll("[data-avview]").forEach((b) => b.addEventListener("click", () => view && view.fit(b.dataset.avview)));
  $("avLbl").addEventListener("change", (e) => view && view.setLabels(e.target.checked));
  boxA.querySelectorAll("[data-avlift]").forEach((b) => b.addEventListener("click", () => {
    M.lt = b.dataset.avlift; try { localStorage.setItem("agvState", JSON.stringify(M)); } catch (er) { /* ignore */ }
    render(); if (view) view.setExplode($("avEx").value / 100);
  }));
  $("avCov").addEventListener("change", (e) => view && view.setCovers(e.target.checked));
  $("avFld").addEventListener("change", (e) => { if (view) { view.setField(e.target.checked); draw(); } });
  $("avEx").addEventListener("input", (e) => { if (view) { view.setExplode(e.target.value / 100); draw(); } });
  const prev = window.onTabShown;
  window.onTabShown = (name) => { if (prev) prev(name); if (name === "agv") init(); };
  if (pane && pane.classList.contains("active")) init();
  const q = new URLSearchParams(location.search);
  if (q.get("avlift")) { const b = boxA.querySelector(`[data-avlift="${q.get("avlift")}"]`); if (b) setTimeout(() => b.click(), 500); }
  if (q.get("avt")) setTimeout(() => { T = Math.min(tot(), parseFloat(q.get("avt")) || 0); draw(); }, 600);
  if (q.get("avview")) setTimeout(() => { view && view.fit(q.get("avview")); }, 700);
  if (q.get("avex")) setTimeout(() => { $("avEx").value = q.get("avex"); $("avEx").dispatchEvent(new Event("input")); }, 800);
  if (q.get("avpart")) setTimeout(() => info(q.get("avpart")), 850);
  }
