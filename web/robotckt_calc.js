/* ROBOT tab – item 3 "Control circuits": CALCULATIONS (pure math, no DOM). Used by robotckt.js (page) and its self-check (&cktest).
 * Every value here is an EXAMPLE or an ESTIMATE for teaching. The real design follows IEC 60204-1, IEC 60364, ISO 13849,
 * the robot supplier's manuals and is made by a qualified electrical designer.
 * Re-uses item 2 (robotctl_core.js): DC bus 565 V, C = 2 mF, chopper on 750 V / off 730 V, 40 Ω, motor sizing (K_t, peak current),
 * stop curves (cat 0 / cat 1) – so items 2 and 3 show the same numbers.
 */
import { cellLayout } from "./robotkin.js";
import { CTL, sizing, jointModel, stopCurves } from "./robotctl_core.js";

/* ISO 13855 light curtain (d <= 40 mm): S = 2000*T + C; if S > 500 mm recalculate with K = 1600, but S >= 500 mm; minimum 100 mm. */
function lcDist(T, C) { const s2 = 2000 * T + C; if (s2 <= 500) return Math.round(Math.max(100, s2)); return Math.round(Math.max(500, 1600 * T + C)); }
export const SQ3 = Math.sqrt(3);
// ---------------------------------------------------------------- fixed example data of the cell
export const EX = {
  U: 400, U0: 230, f: 50, kappa: 56,          // V line-line, V line-earth, Hz, copper conductivity m/(Ω·mm²)
  Ze: 0.25,                                   // Ω, loop impedance of the factory supply at the cell cabinet terminals (example, measure it!)
  rHot: 1.2,                                  // conductor resistance at 70 °C ≈ 1.2 × value at 20 °C
  Lmain: 40, Lrb: 10, Lconv: 25, L24: 25,     // m: factory distribution -> cell cabinet, cabinet -> robot controller, -> conveyor motor, 24 V to the gripper
  fGroup: 0.8, fTemp: 0.87,                   // derating: several cables in one tray, 40 °C ambient (PVC)
  dUmax: 5,                                   // % total voltage drop supply -> load (IEC 60204-1 §12.4)
  conv: { P: 0.37, eta: 0.69, cos: 0.73, kStart: 6, n: 2 },   // conveyor motors (IE2, 4-pole, example)
  psuEta: 0.92, psuPF: 0.98,                  // 24 V power supply efficiency + power factor (PFC)
  socket: 2.0, light: 0.2, fan: 0.15,         // A assumed load of socket (diversity), lamp, filter fan
};
// robot controller supply by robot (examples – take the real values from the controller manual / product specification)
export const CTRL = {
  irb120: { S: 1.0, ph: 1, cos: 0.95, brake: 0.3 },
  irb2600: { S: 4.5, ph: 3, cos: 0.95, brake: 0.5 },
  irb4600: { S: 7.5, ph: 3, cos: 0.95, brake: 0.8 },
  irb6700: { S: 12, ph: 3, cos: 0.95, brake: 1.2 },
};
export const STD_IN = [2, 4, 6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
// IEC 60364-5-52, copper, PVC, 30 °C, installation method C (on a wall / tray, one layer): [mm², 3 loaded conductors, 2 loaded conductors]
export const AMP_C = [[1.5, 17.5, 19.5], [2.5, 24, 27], [4, 32, 36], [6, 41, 46], [10, 57, 63], [16, 76, 85], [25, 96, 112], [35, 119, 138]];
export const ECB_STEPS = [1, 2, 3, 4, 6, 8, 10];   // A, electronic circuit breaker settings (example product range)
export const PSU_STEPS = [5, 10, 20, 40];          // A, 24 V power supplies

const pick = (list, v) => list.find((x) => x >= v - 1e-9) || list[list.length - 1];
const r = (v, d = 2) => +v.toFixed(d);

// voltage drop in % (3-phase: √3·I·L·cosφ/(κ·A·U)·100, 1-phase: 2·I·L·cosφ/(κ·A·U0)·100)
export function dU3(I, L, cos, A) { return SQ3 * I * L * cos / (EX.kappa * A * EX.U) * 100; }
export function dU1(I, L, cos, A) { return 2 * I * L * cos / (EX.kappa * A * EX.U0) * 100; }
// smallest cable with I_z = I_table·f ≥ I_n (and optional voltage drop limit)
export function cable(In, ph, f, dUfun, dUlim) {
  for (const row of AMP_C) {
    const Iz = (ph === 3 ? row[1] : row[2]) * f;
    if (Iz >= In && (!dUfun || dUfun(row[0]) <= dUlim)) return { A: row[0], Itab: ph === 3 ? row[1] : row[2], Iz: r(Iz, 1) };
  }
  const last = AMP_C[AMP_C.length - 1];
  return { A: last[0], Itab: last[1], Iz: r(last[1] * f, 1) };
}

// 24 V loads per branch (examples). brake current per motor depends on the robot.
export function loads24(rb) {
  const br = CTRL[rb.id].brake;
  return [
    { tag: "-F21", n: "Controller logic", items: [["PLC CPU -A2", 0.6, "line PLC CPU (-A2)"], ["HMI -A7", 0.7, "HMI panel (-A7)"], ["switch -A80", 0.3, "Ethernet switch (-A80)"]] },
    { tag: "-F22", n: "Safety", items: [["safety I/O -A2", 0.5, "safety I/O modules (-A2)"], ["gate -B1 + lock", 0.6, "gate switch -B1 + guard lock -Y10"], ["coils -K1, -K2", 0.25, "safety contactor coils -K1/-K2"]] },
    { tag: "-F23", n: "Inputs + sensors", items: [["16 sensors", 0.4, "16 sensors × 25 mA"], ["DI modules", 0.1, "DI modules (logic)"], ["24 inputs × 6 mA", 0.15, "input currents 24 × 6 mA"]] },
    { tag: "-F24", n: "Outputs", items: [["valves -Y11/-Y12", 0.21, "gripper valves -Y11/-Y12 (2 × 2.5 W)"], ["vacuum valves", 0.21, "vacuum / blow-off valves (2 × 2.5 W)"], ["relays -K21…23", 0.06, "interposing relays -K21…-K23 (3 × 0.5 W)"], ["lamps + tower", 0.4, "lamps + signal tower (4 × 2.4 W)"], ["gripper sensors", 0.6, "sensors on the gripper"]] },
    { tag: "-F25", n: "Motor brakes", items: [[`6 brakes × ${br} A`, 6 * br, `6 holding brakes × ${br} A (release current, estimate)`]] },
    { tag: "-F26", n: "Robot I/O -A3", items: [["DI/DO board", 1.0, "robot DI/DO board + outputs"]] },
  ].map((b) => {
    const I = b.items.reduce((a, it) => a + it[1], 0);
    return { ...b, I: r(I, 2), P: r(24 * I, 1), set: pick(ECB_STEPS, 1.25 * I) };
  });
}

// ---------------------------------------------------------------- everything for one robot
export function calc(rb) {
  const c = CTRL[rb.id], o = { rb, c };
  /* robot controller feed */
  const Ib = c.ph === 3 ? c.S * 1000 / (SQ3 * EX.U) : c.S * 1000 / EX.U0;
  const In = pick(STD_IN, 1.25 * Ib);
  const f = EX.fGroup;
  const dUrbF = (A) => (c.ph === 3 ? dU3(Ib, EX.Lrb, c.cos, A) : dU1(Ib, EX.Lrb, c.cos, A));
  const cb = cable(In, c.ph, f, dUrbF, 2);
  o.rbFeed = { Ib: r(Ib, 2), In, A: cb.A, Itab: cb.Itab, Iz: cb.Iz, dU: r(dUrbF(cb.A), 2), L: EX.Lrb, ph: c.ph, S: c.S, cos: c.cos };
  /* conveyor motors */
  const C = EX.conv, Im = C.P * 1000 / (SQ3 * EX.U * C.eta * C.cos);
  const dUm = dU3(Im, EX.Lconv, C.cos, 1.5), dUs = dU3(Im * C.kStart, EX.Lconv, 0.4, 1.5);  // start: cosφ ≈ 0.4
  o.conv = { ...C, In: r(Im, 2), set: r(Im * 1.0, 2), range: "0.63–1.0 A / 1.0–1.6 A", A: 1.5, dU: r(dUm, 2), dUstart: r(dUs, 2), Istart: r(Im * C.kStart, 1), L: EX.Lconv };
  o.conv.mpcb = Im <= 1.0 ? "0.63–1.0 A" : "1.0–1.6 A";
  /* 24 V supply */
  const L24 = loads24(rb), I24 = L24.reduce((a, b) => a + b.I, 0);
  const psu = PSU_STEPS.find((s) => I24 <= 0.8 * s) || 40;
  const Pout = 24 * I24, Pin = Pout / EX.psuEta, Iin = Pin / (EX.U0 * EX.psuPF);
  const IinRated = 24 * psu / EX.psuEta / (EX.U0 * EX.psuPF);
  o.psu = { branches: L24, I: r(I24, 2), A: psu, load: r(I24 / psu * 100, 0), Pout: r(Pout, 0), Pin: r(Pin, 0), loss: r(Pin - Pout, 1), Iin: r(Iin, 2), IinRated: r(IinRated, 2), mcb: IinRated * 1.25 <= 6 ? 6 : 10 };
  /* 24 V voltage drop example: gripper branch over the robot customer cable */
  const Ig = 1.5, d075 = 2 * EX.L24 * Ig / (EX.kappa * 0.75), d15 = 2 * EX.L24 * Ig / (EX.kappa * 1.5);
  o.v24 = { I: Ig, L: EX.L24, dU075: r(d075, 2), p075: r(d075 / 24 * 100, 1), dU15: r(d15, 2), p15: r(d15 / 24 * 100, 1), Umin: 19.2 };
  /* phase currents + main fuses */
  const ph = [0, 0, 0];
  if (c.ph === 3) for (let i = 0; i < 3; i++) ph[i] += Ib; else ph[2] += Ib;     // 1-phase robot controller on L3
  for (let i = 0; i < 3; i++) ph[i] += C.n * Im;
  ph[0] += IinRated;                                                            // PSU on L1 (rated input current)
  ph[1] += EX.socket + EX.light + EX.fan;                                       // light + socket + fan on L2
  const Imax = Math.max(...ph);
  const InMain = pick(STD_IN, Math.max(1.25 * Imax, 1.6 * In));                 // gG fuse: ≥ 1.6 × biggest downstream device (selectivity, rule of thumb)
  const dUmF = (A) => dU3(Imax, EX.Lmain, 0.9, A);
  const cm = cable(InMain, 3, f, dUmF, EX.dUmax - o.rbFeed.dU - 0.5);
  o.main = { ph: ph.map((v) => r(v, 2)), Imax: r(Imax, 2), In: InMain, Q1: pick([25, 40, 63, 80, 100, 125], InMain), A: cm.A, Iz: cm.Iz, Itab: cm.Itab, dU: r(dUmF(cm.A), 2), L: EX.Lmain };
  o.main.dUtot = r(o.main.dU + o.rbFeed.dU, 2);
  /* loop impedance (fault L–PE), TN-S, MCB C-curve: I_a = 10·I_n (trips magnetically in < 0.1 s, required 0.4 s for final circuits ≤ 32 A) */
  const Rloop = (L, A) => EX.rHot * 2 * L / (EX.kappa * A);                  // phase + PE of the same size
  const ZsRb = EX.Ze + Rloop(EX.Lmain, cm.A) + Rloop(EX.Lrb, cb.A);
  const IaRb = 10 * In;
  o.loop = { Ze: EX.Ze, Zs: r(ZsRb, 3), Ia: IaRb, Zmax: r(EX.U0 / IaRb, 3), Ik: r(EX.U0 / ZsRb, 0), ok: ZsRb <= EX.U0 / IaRb };
  const ZsSock = EX.Ze + Rloop(EX.Lmain, cm.A) + Rloop(3, 1.5);
  o.loopSock = { Zs: r(ZsSock, 3), Ia: 5 * 10, Zmax: r(EX.U0 / 50, 2), ok: ZsSock <= EX.U0 / 50 };        // B10 RCBO: I_a = 5·10 A
  /* servo drives (from item 2) */
  const SZ = sizing(rb);
  o.axes = SZ.map((s) => ({ j: s.j + 1, n: s.n, Kt: r(s.Kt, 3), iPeak: r(s.iMax, 1), iRated: r(s.iMax / 3, 1), tm: r(s.tmMax, 2), nMot: s.nMot, P: r(s.tmMax * s.nMot * 2 * Math.PI / 60 / 1000, 2) }));
  // braking energy: J1–J3 stop together from full speed (synchronised ramp like a real PTP stop), energy back into the DC bus
  const M3 = main3(rb), etaB = M3.eta;
  const Ebus = M3.Ek * etaB, Ecap = 0.5 * CTL.cdc * (CTL.chopOn ** 2 - CTL.vdc0 ** 2);
  o.regen = { Ek: r(M3.Ek, 0), eta: etaB, tA: r(M3.tA, 3), Ebus: r(Ebus, 0), Ecap: r(Ecap, 0), Echop: r(Math.max(0, Ebus - Ecap), 0), Ppk: r(M3.Ppk / 1000, 2),
    R: M3.R, Pchop: r(CTL.chopOn ** 2 / M3.R / 1000, 2), P40: r(CTL.chopOn ** 2 / CTL.rChop / 1000, 2), every: 10, Pavg: r(Math.max(0, Ebus - Ecap) / 10, 0) };
  o.bus = { C: CTL.cdc, U: CTL.vdc0, E: r(0.5 * CTL.cdc * CTL.vdc0 ** 2, 0), E750: r(0.5 * CTL.cdc * CTL.chopOn ** 2, 0), Rpre: 47, Ipre: r(CTL.vdc0 / 47, 1), tau: r(47 * CTL.cdc * 1000, 0),
    Rbl: 22000, tBl: r(22000 * CTL.cdc * Math.log(CTL.vdc0 / 60), 0), Pbl: r(CTL.vdc0 ** 2 / 22000, 1) };
  /* safety response time + safety distance (ISO 13855) */
  const Cl = cellLayout(rb), M = jointModel(rb, 0, Cl.home, Cl.gripMass + Cl.part.mass), sc = stopCurves(M, 1);
  const t = { sensor: 0.02, plc: 0.03, robot: 0.015, stop: sc.c[1].tStop, stop0: sc.c[0].tStop };
  const T = t.sensor + t.plc + t.robot + t.stop;
  o.resp = { ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, r(v, 3)])), T: r(T, 3), K: 1600, Cg: 0, S: Math.round(1600 * T), dist: r(sc.c[1].distTcp * 1000, 0),
    lcD: 30, lcC: 8 * (30 - 14), Slc: lcDist(T, 8 * (30 - 14)) };
  /* PL verification (ISO 13849-1), example values from datasheets / SISTEMA libraries */
  const nop = 220 * 16 * 3600 / 300, B10d = 1e6, mttfd = B10d / (0.1 * nop);
  o.pl = {
    K: { B10d, d: 220, h: 16, tc: 300, nop: Math.round(nop), mttfd: r(mttfd, 0), mttfdCap: Math.min(100, mttfd), T10d: r(B10d / nop, 1) },
    sf: [
      { n: "SF1 – emergency stop → robot stop (ES1/ES2 → SS1 → STO)", rows: [["Input: 3 e-stop buttons, 2 NC each (dual channel, test pulses)", 2.0e-8, "Cat 3, B10d 100 000, DC 90 %"], ["Logic: safety PLC CPU + F-DI + F-DQ", 2.0e-9, "datasheet, PL e"], ["Output: robot controller safety inputs + STO (supplier data)", 5.8e-8, "PL d, Cat 3"]], plr: "d" },
      { n: "SF2 – safety gate opened → conveyor stop (-B1 → -K1/-K2)", rows: [["Input: coded gate switch -B1 with OSSD", 1.5e-9, "datasheet, PL e"], ["Logic: safety PLC", 2.0e-9, "datasheet, PL e"], ["Output: -K1 + -K2 with EDM (B10d 1 000 000)", 2.5e-8, "Cat 3, DC 99 %"]], plr: "d" },
    ],
  };
  o.pl.sf.forEach((s) => {
    s.sum = s.rows.reduce((a, x) => a + x[1], 0);
    s.plPfh = s.sum < 1e-7 ? "e" : s.sum < 1e-6 ? "d" : s.sum < 3e-6 ? "c" : "b";
    s.pl = s.rows.some((x) => /PL d/.test(x[2])) && s.plPfh === "e" ? "d" : s.plPfh;   // a subsystem with PL d limits the function to PL d
    s.ok = "abcde".indexOf(s.pl) >= "abcde".indexOf(s.plr);
  });
  /* cabinet heat (wall cabinet 600 × 1200 × 300, sheet steel) */
  const W = 0.6, H = 1.2, D = 0.3, Ae = 1.4 * W * (H + D) + 1.8 * D * H;     // IEC/TR 60890: wall-mounted, effective surface
  const loss = [["24 V power supply -T1 (at its load)", o.psu.loss], ["safety PLC + I/O -A2", 14], ["Ethernet switch -A80", 6], ["contactor coils -K1 -K2 -K11 -K12 (4 × 3 W)", 12],
    ["motor-protection breakers -Q11 -Q12", 3.6], ["MCBs / fuses -F1 … -F4 (at load)", 9], ["electronic circuit breakers -F21 … -F26", 6], ["interposing relays + lamps", 4], ["terminals + wiring (estimate)", 15]];
  const Pl = loss.reduce((a, x) => a + x[1], 0), k = 5.5, Ti = 35, Ta = 35, dT = 5;
  const Psurf = k * Ae * dT, Pfan = Math.max(0, Pl - Psurf);
  const Vdot = 3.1 * Pfan / dT;
  const TaHot = 45, Qac = Pl + k * Ae * (TaHot - Ti);
  o.heat = { W, H, D, Ae: r(Ae, 3), loss, P: r(Pl, 1), k, Ti, Ta, TiMax: 40, dT, Psurf: r(Psurf, 1), Pfan: r(Pfan, 1), Vdot: r(Vdot, 1), fan: Vdot <= 0 ? 0 : Vdot * 2 <= 55 ? 55 : 105, TaHot, Qac: r(Qac, 0),
    ctrlLoss: r(c.S * 1000 * 0.05, 0) };
  return o;
}

// the 3 main axes J1–J3 braking together from full speed (synchronised: all axes need the same ramp time t_A = max(ω/a))
const R_SERIES = [40, 33, 27, 22, 18, 15, 12, 10, 8.2, 6.8, 5.6, 4.7, 3.9, 3.3];
export function main3(rb) {
  const SZ = sizing(rb), eta = 0.85 * 0.9;                          // gear × motor/inverter (estimate)
  const ax = [0, 1, 2].map((j) => { const s = SZ[j], J = s.Imax + s.Jm * s.n * s.n, w = rb.vmax[j] * Math.PI / 180; return { J, w, a: Math.min(2 * s.aMax, 0.9 * s.tauLim / J), fr: 0.04 * s.tauLim }; });
  const tA = Math.max(...ax.map((x) => x.w / x.a));
  const Ek = ax.reduce((a, x) => a + 0.5 * x.J * x.w * x.w, 0);
  const Ppk = 2 * Ek / tA * eta;                                     // electrical braking power at the start of the ramp: Σ J·(ω/t_A)·ω · η
  // brake resistor: item 2 uses 40 Ω (one axis); for 3 axes together choose R so that U²/R ≥ 1.2 · P_peak
  const R = R_SERIES.find((x) => CTL.chopOn ** 2 / x >= 1.2 * Ppk) || R_SERIES[R_SERIES.length - 1];
  return { ax, tA, Ek, Ppk, R, eta };
}

// DC bus demo (servo page animation): one axis profile accelerate – run – brake – stand still, uses the item-2 bus model.
export function busProfile(rb) {
  const M3 = main3(rb), tA = M3.tA, eta = M3.eta, R = M3.R;
  const T = 6, dt = 1e-3, out = { t: [], v: [], P: [], chop: [], w: [] };
  let vdc = CTL.vdc0, chop = false, E = 0;
  for (let i = 0; i <= T / dt; i++) {
    const t = i * dt;
    let u = 0, du = 0;                                                     // normalised speed 0..1 and its derivative (1/s)
    if (t < 0.5) u = 0;
    else if (t < 0.5 + tA) { du = 1 / tA; u = (t - 0.5) / tA; }
    else if (t < 2.5) u = 1;
    else if (t < 2.5 + tA) { du = -1 / tA; u = 1 - (t - 2.5) / tA; }
    const Pm = M3.ax.reduce((a, x) => a + x.J * x.w * du * x.w * u + x.fr * x.w * u, 0);   // Σ (J·α·ω + friction·ω)
    const Pe = Pm >= 0 ? Pm / eta : Pm * eta;
    const vSup = CTL.vdc0 - 0.5 * Math.max(0, Pe) / CTL.vdc0;              // rectifier + mains: ≈ 0.5 Ω equivalent source resistance (estimate)
    const Pc = chop ? vdc * vdc / R : 0;
    vdc -= (Pe + Pc + 150) / (CTL.cdc * vdc) * dt;                          // + 150 W drive electronics + bleed resistor (estimate)
    if (vdc < vSup) vdc = vSup;
    if (vdc > CTL.chopOn) chop = true; else if (vdc < CTL.chopOff) chop = false;
    if (chop) E += Pc * dt;
    if (i % 5 === 0) { out.t.push(t); out.v.push(vdc); out.P.push(Pe); out.chop.push(chop ? 1 : 0); out.w.push(u); }
  }
  out.R = R;
  out.T = T; out.tA = tA; out.Echop = E; out.vmax = Math.max(...out.v); out.vmin = Math.min(...out.v);
  return out;
}
