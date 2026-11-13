/* Item 8 – program 5: PRELOAD TORQUE TEST STAND, AS-BSA-01 (ball screw assembly + preload torque tester, type code 36).
 * The servo turns the screw at 100 min⁻¹ (lead 10 mm → nut travel 16.7 mm/s), the nut is held by a reaction arm on a torque sensor.
 * Measure over the stroke 50 … 650 mm (start / end zones ignored), sample every 0.1 s, compute mean Tp, max, min, variation band
 * ΔTp = max(Tmax − Tp, Tp − Tmin) and ΔTp / Tp. OK: Tp = 0.29 N·m ± 40 % (QG-FA-1, P1 example) and ΔTp / Tp ≤ 40 % (example –
 * check the table of ISO 3408-3 / JIS B 1192 for your accuracy grade and length). Results go to the torque register group.
 * All addresses, times and values are EXAMPLES – check with your PLC configuration and the sensor data sheet. */
import { I, Q, M, AI, AQ, W, T, NO, NC, PE, CMP, TON, S, P, OUT, SET, RST, CALC, MOV, R, N, delayBit } from "./bsfplc_lib.js";

export const KEY = "trq", TYPE = "AS-BSA", MID = "AS-BSA-01", LOTQTY = 3, RECIPE = 10, PART = "FABS-3210-1000-C5";
export const TITLE = "Preload torque test stand – AS-BSA-01 (100 min⁻¹, stroke 50 … 650 mm, Tp 0.29 N·m ± 40 %)";
export const PLC = { delta: { cpu: "AS332T-A + AS04AD-A + ASDA-B3", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1200 CPU 1215C + SM 1231 + V90 PN", sw: "TIA Portal V19" } };
export const BTN = "5 · Preload torque test stand";
export const BASIS = "QG-FA-1 (Tp 0.29 N·m ± 40 %, P1 example) · ISO 3408-3 / JIS B 1192 torque variation (check) · torque register group of item 4";
export const RPM = 100, LEAD = 10, X_END = 700, X1 = 50, X2 = 650, TP_NOM = 0.29, TP_TOL = 0.4, VAR_LIM = 40;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function build() {
  const G = "Machine sensors (from the plant – click = force)", F = "Faults + signals (click to simulate)";
  const tags = [
    I("B_PART", "X0.0", "%I0.0", "Screw + nut in the fixture (-BG1)", "-BG1", true, { ui: "sensor", group: G }),
    I("B_CLAMPED", "X0.1", "%I0.1", "Screw clamped in the chuck + tailstock (-BG2)", "-BG2", false, { ui: "sensor", group: G }),
    I("B_ARM", "X0.2", "%I0.2", "Reaction arm engaged on the nut flange (-BG3)", "-BG3", false, { ui: "sensor", group: G }),
    I("AX_RDY", "X0.3", "%I0.3", "Servo ready (ASDA-B3 SRDY / V90 ready)", "-TA1 DO1", true, { group: F }),
    I("B_GUARD", "X0.4", "%I0.4", "Guard closed – STATUS from the safety relay (STO of the servo is the safety function)", "-KF1 13/14", true, { group: F }),
    I("B_HOME", "X0.5", "%I0.5", "Nut carriage at the start position (-BG4)", "-BG4", true, { ui: "sensor", group: G }),
    AI("TORQUE", "D300 (AS04AD-A ch1, ±10 V = ±2 N·m)", "%IW96 (SM 1231 ch0) → \"Trq\".Torque", "Torque sensor on the reaction arm (strain gauge + amplifier, e.g. HBM / Kistler / Lorenz)", "N·m", -2, 2, 0, "-BT1 ±10 V shielded", { ui: "sensor", inc: 0.001 }),
    AI("SV_POS", "D310 (ASDA-B3 position, float)", "\"AxTest\".ActualPosition (TO)", "Nut position along the screw (servo encoder × lead)", "mm", 0, 800, 0, "PROFINET / pulse", { ui: "sensor", inc: 0.1 }),
    Q("Y_CLAMP", "Y0.0", "%Q0.0", "Chuck + tailstock clamp -MB1", "-MB1"),
    Q("Y_ARM", "Y0.1", "%Q0.1", "Engage reaction arm -MB2", "-MB2"),
    Q("Y_SVON", "Y0.2", "%Q0.2", "Servo enable (SON)", "-TA1 DI1"),
    Q("Y_TARE", "Y0.3", "%Q0.3", "Torque amplifier: zero (tare) input", "-BT1 amp. TARE"),
    AQ("SV_SPD", "D320 → ASDA-B3 speed command", "\"AxTest\" MC_MoveVelocity.Velocity", "Screw speed command (+ = nut moves away from home)", "min⁻¹", -400, 400, "-TA1"),
    M("ST0", "M0", "\"Trq\".Step0", "Step 0 – wait", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Trq\".Step1", "Step 1 – clamp + reaction arm", false, { step: true, stepLabel: "1 clamp" }),
    M("ST2", "M2", "\"Trq\".Step2", "Step 2 – tare the torque sensor at standstill", false, { step: true, stepLabel: "2 tare" }),
    M("ST3", "M3", "\"Trq\".Step3", "Step 3 – turn at 100 min⁻¹ and measure", false, { step: true, stepLabel: "3 measure" }),
    M("ST4", "M4", "\"Trq\".Step4", "Step 4 – evaluate mean + band", false, { step: true, stepLabel: "4 evaluate" }),
    M("ST5", "M5", "\"Trq\".Step5", "Step 5 – return to the start", false, { step: true, stepLabel: "5 return" }),
    M("ST6", "M6", "\"Trq\".Step6", "Step 6 – unclamp + part done", false, { step: true, stepLabel: "6 unload" }),
    M("M_INCYC", "M10", "\"Trq\".InCycle", "In cycle"),
    M("M_PDONE", "M11", "\"Trq\".PartDone", "Part done – one scan"),
    M("M_POK", "M12", "\"Trq\".PartOk", "Torque result OK"),
    M("M_ALM", "M13", "\"Trq\".Alarm", "Any alarm"),
    M("M_WIN", "M14", "\"Trq\".InWindow", "Nut inside the measuring window 50 … 650 mm"),
    M("AL_SENS", "M20", "\"Trq\".AlSensor", "Alarm 701 torque sensor fault (over range / not zero at tare)"),
    M("AL_TO", "M21", "\"Trq\".AlTimeout", "Alarm 153 step time-out"),
    W("T_OFF", "D1040 (float)", "\"Trq\".Offset (Real)", "Sensor zero offset stored at tare", "N·m", 0, "REAL"),
    W("TQ", "D1042 (float)", "\"Trq\".Tq (Real)", "Torque minus offset", "N·m", 0, "REAL"),
    W("T_SUM", "D1044 (float)", "\"Trq\".Sum (Real)", "Sum of the samples", "N·m", 0, "REAL"),
    W("T_N", "D1046", "\"Trq\".N", "Number of samples", "", 0, "INT"),
    W("T_MAX", "D1048 (float)", "\"Trq\".TMax (Real)", "Maximum in the window", "N·m", 0, "REAL"),
    W("T_MIN", "D1050 (float)", "\"Trq\".TMin (Real)", "Minimum in the window", "N·m", 0, "REAL"),
    W("T_MEAN", "D1052 (float)", "\"Trq\".Mean (Real)", "Mean preload torque Tp = Σ / n", "N·m", 0, "REAL"),
    W("T_VP", "D1054 (float)", "\"Trq\".VarPlus (Real)", "Tmax − Tp", "N·m", 0, "REAL"),
    W("T_VM", "D1056 (float)", "\"Trq\".VarMinus (Real)", "Tp − Tmin", "N·m", 0, "REAL"),
    W("T_VAR", "D1058 (float)", "\"Trq\".Var (Real)", "Variation band ΔTp = max(Tmax − Tp, Tp − Tmin)", "N·m", 0, "REAL"),
    W("T_PCT", "D1060 (float)", "\"Trq\".VarPct (Real)", "ΔTp / Tp × 100", "%", 0, "REAL"),
    W("DRAG", "D1062 (float)", "\"Trq\".Drag (Real)", "Torque as an axial force F = 2π·Tp / lead (N·m → N, lead 0.010 m)", "N", 0, "REAL"),
    W("TP_LO", "D1064 (float)", "\"Trq\".TpLo (Real)", "Tp low limit = 0.29 × 0.6", "N·m", +(TP_NOM * (1 - TP_TOL)).toFixed(3), "REAL"),
    W("TP_HI", "D1066 (float)", "\"Trq\".TpHi (Real)", "Tp high limit = 0.29 × 1.4", "N·m", +(TP_NOM * (1 + TP_TOL)).toFixed(3), "REAL"),
    W("VARLIM", "D1068 (float)", "\"Trq\".VarLim (Real)", "Allowed ΔTp / Tp (example – check ISO 3408-3 / JIS B 1192)", "%", VAR_LIM, "REAL"),
    W("RES", "D1070", "\"Trq\".Result", "torque.result 1 OK, 2 NOK", "", 0, "INT"),
    W("CLS", "D1071", "\"Trq\".Class", "torque.cls preload class (1 = P1, recipe)", "", 1, "INT"),
    W("ALM_CODE", "D1000", "\"Trq\".AlarmCode", "Alarm code for std.alarm", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Power (example)", "kW", 0, "REAL"),
    T("T_CLAMP", "T0", "\"IDB_T_Clamp\" (TON)", "Clamp + arm time-out", 3),
    T("T_TARE", "T1", "\"IDB_T_Tare\" (TON)", "Tare time at standstill", 0.5),
    T("T_RUN", "T2", "\"IDB_T_Run\" (TON)", "Measuring run time-out (normal 42 s)", 60),
    T("T_UNL", "T3", "\"IDB_T_Unl\" (TON)", "Unclamp time", 0.5),
  ];
  const ST = ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"];
  const networks = [
    N("Network 1 – First scan + step 0: wait for start",
      "Start with Enable, part in the fixture, carriage at home, guard closed, servo ready, no alarm.",
      R(NO("FIRST"), SET("ST0"), ...ST.map(RST)),
      R(S(NO("ST0"), NO("M_ENABLE"), NO("B_PART"), NO("B_HOME"), NO("B_GUARD"), NO("AX_RDY"), NC("M_ALM")), SET("ST1"), RST("ST0"))),
    N("Network 2 – Step 1: clamp + reaction arm → step 2 tare",
      "The screw is held in the chuck, the arm engages the nut flange – the nut cannot turn, so the torque to drive the screw goes through the sensor.",
      R(S(NO("ST1"), NO("B_CLAMPED"), NO("B_ARM")), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_CLAMP")), SET("AL_TO"))),
    N("Network 3 – Step 2: tare at standstill (0.5 s), clear the sums",
      "Zero the amplifier and store the remaining offset. Offset > 0.05 N·m = sensor / amplifier fault (701). Sums, counter, max and min are cleared.",
      R(S(NO("ST2"), TON("T_TARE")), MOV("TORQUE", "T_OFF"), MOV(0, "T_SUM"), MOV(0, "T_N"), MOV(-99, "T_MAX"), MOV(99, "T_MIN"), SET("ST3"), RST("ST2")),
      R(S(NO("ST2"), NO("T_TARE"), P(CMP(">", "TORQUE", 0.05), CMP("<", "TORQUE", -0.05))), SET("AL_SENS"))),
    N("Network 4 – Step 3: turn at 100 min⁻¹, measuring window 50 … 650 mm",
      "Nut speed = 100 min⁻¹ × 10 mm = 1000 mm/min = 16.7 mm/s. The first and last 50 mm are ignored (acceleration, seal friction at the ends). TQ = torque − offset every scan.",
      R(NO("ON"), CALC("TORQUE-T_OFF", "TQ")),
      R(S(NO("ST3"), CMP(">=", "SV_POS", X1), CMP("<=", "SV_POS", X2)), OUT("M_WIN")),
      R(S(NO("ST3"), CMP(">=", "SV_POS", X_END)), SET("ST4"), RST("ST3")),
      R(S(NO("ST3"), TON("T_RUN")), SET("AL_TO"))),
    N("Network 5 – Sampling every 100 ms: sum, count, max, min",
      "At each rising edge of the 10 Hz clock inside the window: Σ += TQ, n += 1, track max and min. 600 mm / 16.7 mm/s = 36 s → ≈ 360 samples.",
      R(S(NO("M_WIN"), PE("CLK10")), CALC("T_SUM+TQ", "T_SUM"), CALC("T_N+1", "T_N")),
      R(S(NO("M_WIN"), CMP(">", "TQ", "T_MAX")), MOV("TQ", "T_MAX")),
      R(S(NO("M_WIN"), CMP("<", "TQ", "T_MIN")), MOV("TQ", "T_MIN"))),
    N("Network 6 – Step 4: mean, variation band, ratio, drag force",
      "Tp = Σ / n. ΔTp = the larger of (Tmax − Tp) and (Tp − Tmin) – the LAST MOVE wins. ΔTp / Tp in %. F = 2π · Tp / lead = 2π × 0.30 / 0.010 = 188.5 N for 0.30 N·m.",
      R(S(NO("ST4"), CMP(">", "T_N", 0)), CALC("T_SUM/T_N", "T_MEAN")),
      R(NO("ST4"), CALC("T_MAX-T_MEAN", "T_VP"), CALC("T_MEAN-T_MIN", "T_VM"), MOV("T_VP", "T_VAR")),
      R(S(NO("ST4"), CMP(">", "T_VM", "T_VP")), MOV("T_VM", "T_VAR")),
      R(S(NO("ST4"), CMP(">", "T_MEAN", 0)), CALC("T_VAR/T_MEAN*100", "T_PCT"), CALC("6.2832*T_MEAN/0.010", "DRAG"))),
    N("Network 7 – Step 4: result OK / NOK → step 5",
      "OK = Tp inside 0.174 … 0.406 N·m AND ΔTp / Tp ≤ 40 %. Result register 1 OK / 2 NOK. NOK sets go back to the assembly bench (re-ball with another ball class).",
      R(S(NO("ST4"), CMP(">=", "T_MEAN", "TP_LO"), CMP("<=", "T_MEAN", "TP_HI"), CMP("<=", "T_PCT", "VARLIM")), MOV(1, "RES")),
      R(S(NO("ST4"), P(CMP("<", "T_MEAN", "TP_LO"), CMP(">", "T_MEAN", "TP_HI"), CMP(">", "T_PCT", "VARLIM"))), MOV(2, "RES")),
      R(NO("ST4"), SET("ST5"), RST("ST4")),
      R(CMP("==", "RES", 1), OUT("M_POK"))),
    N("Network 8 – Step 5: return to the start · step 6: unload",
      "Back at −300 min⁻¹ (50 mm/s, 14 s), then unclamp and part done.",
      R(S(NO("ST5"), NO("B_HOME")), SET("ST6"), RST("ST5")),
      R(S(NO("ST6"), TON("T_UNL")), OUT("M_PDONE"), SET("ST0"), RST("ST6"))),
    N("Network 9 – Outputs + servo speed",
      "Speed per step (last MOVE wins): measure +100 min⁻¹, return −300 min⁻¹, else 0. Tare output only in step 2.",
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5")), OUT("Y_CLAMP"), OUT("Y_ARM")),
      R(S(P(NO("ST3"), NO("ST5")), NO("AX_RDY"), NO("B_GUARD")), OUT("Y_SVON")),
      R(NO("ST2"), OUT("Y_TARE")),
      R(NO("ON"), MOV(0, "SV_SPD")),
      R(S(NO("ST3"), NO("Y_SVON"), NC("M_ALM")), MOV(RPM, "SV_SPD")),
      R(S(NO("ST5"), NO("Y_SVON")), MOV(-300, "SV_SPD"))),
    N("Network 10 – Alarms + code",
      "Sensor over range (|T| > 1.9 N·m) = 701. Acknowledge resets. Code priority 153 < 701.",
      R(S(NO("M_INCYC"), P(CMP(">", "TORQUE", 1.9), CMP("<", "TORQUE", -1.9))), SET("AL_SENS")),
      R(NO("M_ACKP"), RST("AL_SENS"), RST("AL_TO")),
      R(P(NO("AL_SENS"), NO("AL_TO")), OUT("M_ALM")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")), R(NO("AL_TO"), MOV(153, "ALM_CODE")), R(NO("AL_SENS"), MOV(701, "ALM_CODE"))),
    N("Network 11 – In cycle + power",
      "Power example: 0.4 kW base, 1.2 kW while the servo turns.",
      R(P(...ST.map(NO)), OUT("M_INCYC")),
      R(NO("ON"), MOV(0.4, "P_KW")),
      R(NO("Y_SVON"), MOV(1.2, "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "B_PART", power: "P_KW" };
  const process = [["torque.torqueMean_Nm", "T_MEAN"], ["torque.torqueVar_Nm", "T_VAR"], ["torque.drag_N", "DRAG"], ["torque.result", "RES"], ["torque.cls", "CLS"]];
  let R0 = rng(3), tp = 0.3, amp = 0.06, spot = 0, off = 0.012, cl = delayBit(0.6, 0.3), arm = delayBit(0.4, 0.2), loadT = 0;
  const fixed = [];   // test hook: [{ tp, amp, spot }]
  const newPart = () => { const f = fixed.shift(); if (f) { tp = f.tp; amp = f.amp; spot = f.spot || 0; } else { tp = 0.29 + (R0() - 0.5) * 0.08; amp = 0.03 + R0() * 0.05; spot = R0() < 0.15 ? 0.2 : 0; } off = 0.01 + R0() * 0.02; };
  const curve = (x) => tp + amp * Math.sin(2 * Math.PI * x / 100) + (spot && x > 300 && x < 320 ? spot : 0);
  const plant = {
    fixed, curve: (x) => curve(x),
    step(st, dt) {
      st.B_CLAMPED = cl(!!st.Y_CLAMP, dt); st.B_ARM = arm(!!st.Y_ARM, dt);
      const v = st.Y_SVON && st.AX_RDY ? st.SV_SPD * LEAD / 60 : 0;
      st.SV_POS = Math.max(0, Math.min(800, st.SV_POS + v * dt));
      st.B_HOME = st.SV_POS <= 0.5;
      const turning = Math.abs(v) > 0.1;
      if (st.Y_TARE) off = 0.002;   // the amplifier zeroes (a small residual remains – the PLC stores and subtracts it)
      st.TORQUE = off + (turning && st.B_ARM ? Math.sign(v) * curve(st.SV_POS) : 0);
      if (st.M_PDONE) { st.B_PART = false; loadT = 8; }
      if (loadT > 0) { loadT -= dt; if (loadT <= 0) { newPart(); st.B_PART = true; } }
    },
    reset(st) { R0 = rng(3); cl.reset(); arm.reset(); loadT = 0; newPart(); Object.assign(st, { SV_POS: 0, TORQUE: 0, B_HOME: true, B_PART: true }); },
    info: () => ({ tp, amp, spot }),
  };
  return { tags, networks, hooks, process, plant };
}

export function panel(st, info, U) {
  const step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5", "ST6"].find((s) => st[s]) || "–";
  return U.gauge("Nut position", `${(+st.SV_POS || 0).toFixed(1)} mm`, `${U.bar(st.SV_POS, 0, 800, [X1, X2, X_END])}<small>${(+st.SV_SPD || 0).toFixed(0)} min⁻¹ · window ${X1} … ${X2} mm · ${U.onoff(st.M_WIN, "sampling", "not sampling")} · step ${step}</small>`)
    + U.gauge("Torque", `${(+st.TQ || 0).toFixed(3)} N·m`, `${U.bar(st.TQ, 0, 0.6, [+st.TP_LO, TP_NOM, +st.TP_HI])}<small>n ${st.T_N || 0} · max ${(+st.T_MAX > -9 ? +st.T_MAX : 0).toFixed(3)} · min ${(+st.T_MIN < 9 ? +st.T_MIN : 0).toFixed(3)} · offset ${(+st.T_OFF || 0).toFixed(3)}</small>`)
    + U.gauge("Result", `Tp ${(+st.T_MEAN || 0).toFixed(3)} N·m`, `<small>ΔTp ${(+st.T_VAR || 0).toFixed(3)} N·m = ${(+st.T_PCT || 0).toFixed(1)} % (≤ ${st.VARLIM} %) · F ${(+st.DRAG || 0).toFixed(0)} N · ${st.RES === 1 ? '<span class="bf8-on">OK</span>' : st.RES === 2 ? '<span class="bf8-bad">NOK</span>' : "–"}</small>`);
}

export const TRY = [
  "One test: clamp + arm → tare 0.5 s → measuring run 700 mm at 16.7 mm/s (42 s) → evaluation → return 14 s. Watch n grow to ≈ 360 samples.",
  "About 1 in 7 screws has a tight spot (+0.2 N·m at 300 … 320 mm): ΔTp / Tp > 40 % → NOK, result 2, std.scrap +1.",
  "Registers torque group: torqueMean_Nm, torqueVar_Nm, drag_N, result, cls – the MES stores them per serial number (item 6).",
  "Force <b>TORQUE</b> to 2 N·m: sensor alarm 701.",
];
export const NOTES = {
  io: "Delta: X0.0 … X0.5, Y0.0 … Y0.3, AS04AD-A ch1 for the torque amplifier (±10 V, 16 bit), ASDA-B3 servo. Siemens: 1215C + SM 1231 AI 4 × 16 bit (better resolution than the 13-bit module), V90 PN on PROFINET with TO_SpeedAxis.",
  timing: [["clamp + arm", "≈ 1 s"], ["tare", "0.5 s"], ["measuring run 0 → 700 mm at 100 min⁻¹ × 10 mm", "700 / 16.67 = 42 s"], ["samples (0.1 s) in 50 … 650 mm", "600 / 1.667 ≈ 360"], ["return at 300 min⁻¹ (50 mm/s)", "14 s"], ["cycle (hand)", "≈ 1 + 0.5 + 42 + 14 + 0.5 ≈ 58 s"], ["known curve 0.30 + 0.06·sin(2πx/100)", "Tp 0.300, ΔTp 0.060 = 20 % → OK"], ["drag force for 0.30 N·m", "2π × 0.30 / 0.010 = 188.5 N"]],
  wiring: ["Torque sensor: strain-gauge reaction torque sensor 2 N·m with an amplifier (±10 V) – shielded twisted pair, shield on the amplifier side only; analog input 16 bit.", "Tare input of the amplifier from a PLC output; the PLC also stores the residual offset (belt and braces).", "Servo STO from the safety relay (guard)."],
  safety: "Guard with interlock on the safety relay → servo STO (SIL 2 / PL d class – check). The PLC reads B_GUARD only. Low forces, but a rotating screw with a loose nut can throw balls – keep the guard closed.",
  plcWhy: "S7-1200 1215C / Delta AS332T-A: small I/O count, one servo axis in speed mode, 16-bit analog input. A PC-based test bench is also common – it then needs the Modbus TCP server with the map.",
};

export function selfTest({ runEngine, ok, near }) {
  const T = runEngine({ KEY, TYPE, MID, LOTQTY: 2, RECIPE, PART, TITLE, PLC, build }, { auto: true });
  const { a, E, until } = T;
  a.meta.plant.fixed.push({ tp: 0.30, amp: 0.06, spot: 0 }, { tp: 0.30, amp: 0.06, spot: 0.25 });
  E.reset();
  E.run(1); ok("trq: header unit id ≠ 0 (machine AS-BSA-01 in the IP plan)", a.img.HR[2] > 0, `unit ${a.img.HR[2]}`);
  until(() => E.bit("ST5"), 80);   // step 4 lives for one scan only (set + reset in the same scan) – wait for step 5
  ok("trq: known curve 0.30 + 0.06·sin → mean 0.300 N·m", near(E.num("T_MEAN"), 0.30, 0.002), `${E.num("T_MEAN").toFixed(4)} N·m, n ${E.num("T_N")}`);
  ok("trq: ≈ 360 samples (600 mm / 1.667 mm)", near(E.num("T_N"), 360, 3), `${E.num("T_N")}`);
  ok("trq: band ΔTp = 0.060 N·m = 20 % → OK, drag 188.5 N", near(E.num("T_VAR"), 0.06, 0.002) && near(E.num("T_PCT"), 20, 0.8) && E.num("RES") === 1 && near(E.num("DRAG"), 188.5, 1.5), `ΔTp ${E.num("T_VAR").toFixed(4)}, ${E.num("T_PCT").toFixed(2)} %, F ${E.num("DRAG").toFixed(1)} N`);
  until(() => E.state.GOOD + E.state.SCRAP >= 1, 30); E.scan();
  ok("trq: registers torque.torqueMean_Nm + result", near(a.img.get("torque.torqueMean_Nm"), 0.30, 0.002) && a.img.get("torque.result") === 1, `${a.img.get("torque.torqueMean_Nm")} N·m, result ${a.img.get("torque.result")}`);
  until(() => E.state.GOOD + E.state.SCRAP >= 2, 100);
  ok("trq: tight spot +0.25 N·m → ΔTp ≈ 0.31 N·m > 40 % → NOK (scrap)", E.state.SCRAP === 1 && E.num("RES") === 2 && E.num("T_PCT") > 40, `ΔTp ${E.num("T_VAR").toFixed(3)} N·m = ${E.num("T_PCT").toFixed(1)} %`);
}
