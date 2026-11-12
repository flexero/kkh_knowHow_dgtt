/* Shared design model of the HMC MOTOR SPINDLE (used by the spindle manufacturing twin = HMC item 4 and the spindle
   assembly twin = Assembly item 2).  Design inputs, calculations with formulas, shaft profile (outside + inside), bearing
   arrangement, housing bores, part list.  All values are EXAMPLES for a 12 000 rpm HSK-A63 motor spindle of an HMC -
   replace with the data of the real bearings, motor, clamping set and drawings.  Offline, no libraries. */

export const SP_GROUPS = [
  ["Performance", [
    ["nmax", "Max. speed", "rpm", 12000, "HMC 40-taper class 10 000–15 000"],
    ["P", "Motor power S1", "kW", 15, "S6-40 % ≈ 22 kW"],
    ["Tmax", "Max. torque (S6)", "N·m", 120, "built-in synchronous motor"],
    ["Fclamp", "Tool clamping force HSK-A63", "kN", 18, "check the clamping-set catalogue"],
    ["iClamp", "Force ratio clamping set (tool : drawbar)", "", 3, "collet wedge"]]],
  ["Bearings (hybrid angular contact, ceramic balls)", [
    ["dF", "Front bearing bore", "mm", 70, "4 × 7014 C, arrangement TBT (tandem-O-tandem)"],
    ["DF", "Front bearing outside Ø", "mm", 110, ""],
    ["BF", "Front bearing width", "mm", 20, ""],
    ["dR", "Rear bearing bore", "mm", 60, "2 × 7012 C, DB, floating in a sliding sleeve"],
    ["DR", "Rear bearing outside Ø", "mm", 95, ""],
    ["BR", "Rear bearing width", "mm", 18, ""],
    ["Fpre", "Preload per bearing (light)", "N", 400, "bearing catalogue: light / medium"],
    ["cax", "Axial stiffness front set", "N/µm", 160, "catalogue, for the chosen preload"]]],
  ["Rotor + shaft", [
    ["dRot", "Rotor seat Ø on the shaft", "mm", 65, "must be < front bearing bore − 2 so the front bearings slide on from the rear"],
    ["LRot", "Rotor length", "mm", 160, ""],
    ["mRot", "Rotating mass (shaft + rotor + nuts)", "kg", 16, ""],
    ["dBore", "Drawbar bore (gun-drilled)", "mm", 22, "through"],
    ["Gbal", "Balancing grade", "mm/s", 1.0, "G1 (ISO 21940-11), G0.4 for very high quality"],
    ["dRotI", "Rotor shrink interference", "mm", 0.06, "on Ø65"]]],
  ["Thermal + cooling", [
    ["dT", "Shaft temperature rise in operation", "K", 15, "with cooling jacket"],
    ["Qw", "Cooling water flow", "l/min", 4, ""],
    ["Ploss", "Motor + bearing losses at nmax", "kW", 1.6, "example"]]],
];
export const SP_DEF = {}; SP_GROUPS.forEach(([, fs]) => fs.forEach(([k, , , d]) => { SP_DEF[k] = d; }));

/* ------------------------------------------------------------------ shaft profile: x = 0 at the spindle NOSE (front face), towards the rear */
export function spGeom(M = SP_DEF) {
  const g = { M };
  const seg = (k, n, d, L, tol, gr, extra = {}) => ({ k, n, d, L, tol, gr, ...extra });
  const nF = 4, sF = 15, nR = 2;
  g.segs = [
    seg("nose", "Nose flange (HSK face + labyrinth)", 120, 25, "face ⟂ 0.002", true),
    seg("fb", `Front bearing seat (${nF} × ${M.dF}×${M.DF}×${M.BF} + spacer ${sF})`, M.dF, nF * M.BF + sF, "js4", true),
    seg("th1", `Front lock-nut thread M${M.dF}×1.5`, M.dF, 18, "6g, ⟂ 0.003", false, { thread: true }),
    seg("b1", "Body (shoulder = axial stop of the rotor)", M.dF - 2, 40, "", false),   // shaft steps DOWN from the nose to the tail: every part slides on from the rear
    seg("rot", `Rotor seat Ø${M.dRot} (shrink fit)`, M.dRot, M.LRot, "p5 / interference", true),
    seg("b2", "Body", M.dR + 3, 40, "", false),
    seg("rb", `Rear bearing seat (${nR} × ${M.dR}×${M.DR}×${M.BR})`, M.dR, nR * M.BR + 6, "js4", true),
    seg("th2", `Rear lock-nut thread M${M.dR}×1.5`, M.dR, 15, "6g", false, { thread: true }),
    seg("tail", "Tail (encoder ring + unclamp piston)", M.dR - 10, 45, "h5", true),
  ];
  let x = 0; g.segs.forEach((s) => { s.x0 = x; s.x1 = x + s.L; x += s.L; s.dr = s.d + (s.gr ? 0.5 : 0); }); g.L = x;
  // inside: HSK-A63 taper (1:10), clamping-set cavity, drawbar bore, rear bore for the unclamp piston rod
  g.inner = [{ k: "taper", n: "HSK-A63 taper 1:10", x0: 0, x1: 32, d0: 48, d1: 44.8 }, { k: "cav", n: "Clamping-set cavity", x0: 32, x1: 75, d0: 36, d1: 36 },
    { k: "bore", n: `Drawbar bore Ø${M.dBore} (gun drilled)`, x0: 75, x1: 190, d0: M.dBore, d1: M.dBore },
    { k: "spring", n: "Disc-spring bore Ø41 (bored from the rear after gun drilling, for springs De 40)", x0: 190, x1: 300, d0: 41, d1: 41 },
    { k: "bore2", n: `Drawbar bore Ø${M.dBore}`, x0: 300, x1: x - 40, d0: M.dBore, d1: M.dBore }, { k: "rear", n: "Rear bore", x0: x - 40, x1: x, d0: 30, d1: 30 }];
  g.rOut = (xx) => { const s = g.segs.find((q) => xx >= q.x0 && xx <= q.x1) || g.segs[g.segs.length - 1]; return s.d / 2; };
  g.rIn = (xx) => { const s = g.inner.find((q) => xx >= q.x0 && xx <= q.x1) || g.inner[g.inner.length - 1]; return (s.d0 + (s.d1 - s.d0) * (xx - s.x0) / Math.max(1e-6, s.x1 - s.x0)) / 2; };
  // bearings (positions of each ring along x) - front TBT: pairs (tandem) back-to-back, spacer between the pairs
  const fb = g.segs[1], rb = g.segs[6];
  g.bearings = [];
  for (let i = 0; i < nF; i++) g.bearings.push({ set: "front", i, x0: fb.x0 + i * M.BF + (i >= 2 ? sF : 0), B: M.BF, d: M.dF, D: M.DF, dir: i < 2 ? -1 : 1 });
  for (let i = 0; i < nR; i++) g.bearings.push({ set: "rear", i, x0: rb.x0 + 3 + i * M.BR, B: M.BR, d: M.dR, D: M.DR, dir: i === 0 ? -1 : 1 });
  // housing (cartridge) - bores and outside
  g.hsg = { L: g.L - 30, Dout: 230, boreF: M.DF, boreR: M.DR + 25, statorD: 200, statorL: M.LRot + 30, xStator: g.segs[4].x0 - 15, sleeveR: M.DR + 25 };
  g.dmF = (M.dF + M.DF) / 2; g.dmR = (M.dR + M.DR) / 2;
  return g;
}

/* ------------------------------------------------------------------ calculations */
export function spCalc(M = SP_DEF) {
  const g = spGeom(M), R = { g };
  R.om = 2 * Math.PI * M.nmax / 60; R.Tn = M.P * 1000 / R.om;                                     // N·m at nmax (S1)
  R.nBase = M.P * 1000 / M.Tmax * 60 / (2 * Math.PI);                                              // base speed rpm
  R.ndmF = M.nmax * g.dmF; R.ndmR = M.nmax * g.dmR;                                                 // speed factor n·dm (mm/min)
  R.ndmOK = R.ndmF <= 1.4e6;                                                                       // hybrid + grease ≈ 1.2–1.4 ·10⁶ (catalogue!)
  R.Fdraw = M.Fclamp * 1000 / M.iClamp;                                                             // N needed at the drawbar
  R.Fspring = R.Fdraw * 1.15;                                                                       // spring pack force in clamped position (+15 % for wear / friction)
  R.Funclamp = R.Fspring * 1.88 * 1.1;                                                             // pack force at full stroke (+88 % for a 6 mm stroke, see asmsp.js) + 10 % reserve
  R.pUnclamp = 6; R.Apiston = R.Funclamp / R.pUnclamp; R.dPiston = Math.sqrt(4 * R.Apiston / Math.PI); // mm², mm at 6 MPa
  R.Uper = 9549 * M.Gbal * M.mRot / M.nmax;                                                         // g·mm (ISO 21940-11)
  R.UperPlane = R.Uper / 2;
  R.ecc = R.Uper / (M.mRot * 1000) * 1000;                                                          // µm centre-of-mass offset
  R.dLshaft = 11.5e-6 * (g.L - g.segs[1].x0) * M.dT;                                                // mm growth towards the rear (front is fixed)
  R.dLnose = 11.5e-6 * g.segs[1].x0 * M.dT;                                                         // mm growth at the nose (short!)
  R.dTw = M.Ploss * 1000 / (M.Qw / 60 * 4186);                                                      // K water temperature rise
  R.kaxSet = M.cax; R.dxCut = 2000 / R.kaxSet;                                                       // µm axial deflection at 2 kN
  R.rotHeat = (M.dRotI + 0.0015 * M.dRot) / (11.5e-6 * M.dRot); R.Trot = 20 + R.rotHeat;            // rotor heating for mounting
  // first bending critical speed (simply supported beam between the bearing centres, mass lumped at mid-span)
  const Ls = (g.segs[6].x0 + g.segs[6].L / 2 - (g.segs[1].x0 + g.segs[1].L / 2)) / 1000, dm = (M.dRot) / 1000, di = M.dBore / 1000;
  const I = Math.PI * (dm ** 4 - di ** 4) / 64, k = 48 * 210e9 * I / Ls ** 3;
  R.nCrit = Math.sqrt(k / (M.mRot * 0.6)) / (2 * Math.PI) * 60; R.critOK = R.nCrit >= 1.3 * M.nmax;
  R.preTot = M.Fpre * 2;                                                                            // preload of a back-to-back pair
  return R;
}

/* ------------------------------------------------------------------ parts (MAKE / BUY) */
export const SP_PARTS = [
  ["shaft", "Spindle shaft", "MAKE", "31CrMoV9 (1.8519) QT + gas nitrided (or 18CrNiMo7-6 case hardened)", "seats js4, taper AT3, runout ≤ 2 µm"],
  ["housing", "Spindle housing (cartridge)", "MAKE", "42CrMo4 QT or EN-GJS-600-3, cooling grooves outside", "bearing bores IT4, coaxial ≤ 3 µm"],
  ["sleeve", "Cooling sleeve", "MAKE", "S355 / stainless, shrunk on the housing, O-ring seals", "pressure test 1.5 × p"],
  ["spacers", "Bearing spacers (inner + outer)", "MAKE", "100Cr6 hardened, ground in pairs", "length difference inner/outer ±1 µm = preload"],
  ["nuts", "Precision lock nuts", "BUY", "precision nut with radial set screws (runout correction)", "face runout ≤ 2 µm"],
  ["covers", "Front cover with labyrinth, rear cover", "MAKE", "C45 / aluminium", "labyrinth gap 0.2–0.3 mm"],
  ["drawbar", "Drawbar + disc-spring pack + HSK clamping set", "MAKE + BUY", "42CrMo4 drawbar; disc springs DIN EN 16983 (50CrV4); clamping set BUY", "spring force at clamped position"],
  ["piston", "Unclamp cylinder (hydraulic)", "MAKE + BUY", "piston + cylinder, seals BUY", `piston Ø from the calculation`],
  ["bearings", "Front 4 × 7014 + rear 2 × 7012 hybrid angular-contact", "BUY", "matched (universal) sets, P4/ABEC 7 or better, ceramic balls", "keep the set order + marks"],
  ["motor", "Built-in synchronous motor (rotor + stator)", "BUY", "rotor sleeve shrunk on the shaft, stator in the housing", "kit from the motor maker"],
  ["sensors", "Sensors: clamp position, temperature (PT100/KTY), vibration, encoder", "BUY", "", ""],
  ["union", "Rotary union (coolant through the spindle) – option", "BUY", "", ""],
];
