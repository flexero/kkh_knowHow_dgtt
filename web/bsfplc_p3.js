/* Item 8 – program 3: STRAIGHTENING PRESS with run-out measurement, BS-STR-01 (type code 2; same program for BS-STH / LG-STR / LG-STH).
 * Item 2 route BS op 20: 3-point bending, V-blocks span 400 mm, press force ≈ 30 – 50 kN, run-out before ≈ 0.6 mm, target ≤ 0.10 mm.
 * Cycle: clamp → rotate one turn and measure the run-out (TIR = max − min) → if TIR > tolerance: turn the high point under the ram,
 * stroke beyond contact = K × TIR / 2 (simple rule, K = spring-back factor 6 from the recipe) → press → re-measure; max. 3 bends, then OK / NOK.
 * All addresses, times and values are EXAMPLES – check with your PLC configuration and the press maker. */
import { I, Q, M, AI, W, T, NO, NC, CMP, TON, S, P, OUT, SET, RST, CALC, MOV, R, N, delayBit } from "./bsfplc_lib.js";

export const KEY = "str", TYPE = "BS-STR", MID = "BS-STR-01", LOTQTY = 3, RECIPE = 20, PART = "BS-3210-1000-C5";
export const TITLE = "Straightening press with run-out measurement – BS-STR-01 (TIR ≤ 100 µm, ≤ 3 bends)";
export const PLC = { delta: { cpu: "AS332T-A + AS04AD-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1200 CPU 1215C DC/DC/DC + SM 1231", sw: "TIA Portal V19" } };
export const BTN = "3 · Straightening press BS-STR";
export const BASIS = "item 2 route BS op 20 (span 400 mm, 30 – 50 kN, 0.6 → ≤ 0.10 mm) · QG-BS-3 (max. 2 – 3 re-straightening) · alarms 501 / 502";
export const TOL = 100, NMAX = 3, KSB = 6, ROT_V = 72, RAM_DN = 4, RAM_UP = 15, CONTACT = 20, KBAR = 13;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function build() {
  const G = "Machine sensors (from the plant – click = force)", F = "Faults + signals (click to simulate)";
  const tags = [
    I("B_PART", "X0.0", "%I0.0", "Bar on the V-blocks (-BG1)", "-BG1", true, { ui: "sensor", group: G }),
    I("B_CLAMPED", "X0.1", "%I0.1", "Centres / rollers closed (-BG2)", "-BG2", false, { ui: "sensor", group: G }),
    I("B_PTOP", "X0.2", "%I0.2", "Ram at the top (-BG3)", "-BG3", true, { ui: "sensor", group: G }),
    I("B_LC", "X0.3", "%I0.3", "Light curtain clear – STATUS from the safety relay (the press is stopped by the safety relay / safety valve itself)", "-KF1 13/14", true, { group: F }),
    I("B_HPU", "X0.4", "%I0.4", "Hydraulic power unit ready (pressure ≥ set point)", "HPU -KF5", true, { group: F }),
    AI("RUNOUT", "D300 (AS04AD-A ch1, ±10 V = ±2000 µm)", "%IW96 (SM 1231 ch0) → \"Str\".Runout", "Run-out sensor (laser triangulation / LVDT) at the middle of the span, under the ram", "µm", -2000, 2000, 0, "-BG10 ±10 V", { ui: "sensor", inc: 1 }),
    AI("ANGLE", "D310 (high-speed counter → degrees, float)", "%ID1000 (HSC 1) → \"Str\".Angle", "Rotation angle of the bar (encoder on the roller drive, counts up)", "°", 0, 36000, 0, "-BG11 A/B 24 V → HSC", { ui: "sensor", inc: 1 }),
    AI("RAM_POS", "D302 (AS04AD-A ch2)", "%IW98 (SM 1231 ch1)", "Ram position (linear transducer 0 – 60 mm)", "mm", 0, 60, 0, "-BG12 4–20 mA", { ui: "sensor", inc: 0.01 }),
    AI("FORCE", "D303 (AS04AD-A ch3)", "%IW100 (SM 1231 ch2)", "Press force (load cell + amplifier 0 – 100 kN)", "kN", 0, 120, 0, "-BF1 0–10 V", { ui: "sensor", inc: 0.1 }),
    Q("Y_CLAMP", "Y0.0", "%Q0.0", "Close centres / rollers -MB1", "-MB1"),
    Q("Y_ROT", "Y0.1", "%Q0.1", "Roller drive (bar rotation) VFD run – 72 °/s", "-TA1 DI1"),
    Q("Y_PDN", "Y0.2", "%Q0.2", "Ram down valve -MB2 (4 mm/s near the part)", "-MB2"),
    Q("Y_PUP", "Y0.3", "%Q0.3", "Ram up valve -MB3", "-MB3"),
    M("ST0", "M0", "\"Str\".Step0", "Step 0 – wait", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Str\".Step1", "Step 1 – clamp", false, { step: true, stepLabel: "1 clamp" }),
    M("ST2", "M2", "\"Str\".Step2", "Step 2 – rotate 360° + measure", false, { step: true, stepLabel: "2 measure" }),
    M("ST3", "M3", "\"Str\".Step3", "Step 3 – decide (OK / bend / NOK)", false, { step: true, stepLabel: "3 decide" }),
    M("ST4", "M4", "\"Str\".Step4", "Step 4 – turn the high point under the ram", false, { step: true, stepLabel: "4 position" }),
    M("ST5", "M5", "\"Str\".Step5", "Step 5 – press down: contact + stroke", false, { step: true, stepLabel: "5 press" }),
    M("ST6", "M6", "\"Str\".Step6", "Step 6 – ram up", false, { step: true, stepLabel: "6 ram up" }),
    M("ST7", "M7", "\"Str\".Step7", "Step 7 – unclamp + part done", false, { step: true, stepLabel: "7 unload" }),
    M("M_INCYC", "M10", "\"Str\".InCycle", "In cycle"),
    M("M_PDONE", "M11", "\"Str\".PartDone", "Part done – one scan"),
    M("M_POK", "M12", "\"Str\".PartOk", "Part OK (TIR ≤ tolerance)"),
    M("M_ALM", "M13", "\"Str\".Alarm", "Any alarm"),
    M("M_CON", "M14", "\"Str\".Contact", "Ram touched the bar (force ≥ 2 kN) – contact position stored"),
    M("M_FIRST", "M15", "\"Str\".FirstMeas", "First measurement of this part (run-out before)"),
    M("AL_FORCE", "M20", "\"Str\".AlForce", "Alarm 501 press force limit 95 kN"),
    M("AL_SENS", "M21", "\"Str\".AlSensor", "Alarm 502 run-out sensor fault (signal out of range)"),
    M("AL_TO", "M22", "\"Str\".AlTimeout", "Alarm 153 step time-out"),
    W("A0", "D1040 (float)", "\"Str\".A0 (Real)", "Angle at the start of the measuring turn", "°", 0, "REAL"),
    W("REL", "D1042 (float)", "\"Str\".Rel (Real)", "Angle turned since A0", "°", 0, "REAL"),
    W("R_MAX", "D1044 (float)", "\"Str\".RMax (Real)", "Run-out maximum of the turn", "µm", 0, "REAL"),
    W("R_MIN", "D1046 (float)", "\"Str\".RMin (Real)", "Run-out minimum of the turn", "µm", 0, "REAL"),
    W("A_MAX", "D1048 (float)", "\"Str\".AMax (Real)", "Angle of the maximum (high point)", "°", 0, "REAL"),
    W("A_TGT", "D1050 (float)", "\"Str\".ATarget (Real)", "Target angle: high point under the ram = A_MAX + 360°", "°", 0, "REAL"),
    W("TIR", "D1052 (float)", "\"Str\".Tir (Real)", "Total indicated run-out = max − min", "µm", 0, "REAL"),
    W("RO_B", "D1054 (float)", "\"Str\".RunoutBefore (Real)", "Run-out before straightening (first turn)", "µm", 0, "REAL"),
    W("RO_A", "D1056 (float)", "\"Str\".RunoutAfter (Real)", "Run-out after (last turn)", "µm", 0, "REAL"),
    W("STROKE", "D1058 (float)", "\"Str\".Stroke (Real)", "Stroke beyond contact = K × TIR / 2 / 1000", "mm", 0, "REAL"),
    W("POS_C", "D1060 (float)", "\"Str\".PosContact (Real)", "Ram position at contact", "mm", 0, "REAL"),
    W("POS_T", "D1062 (float)", "\"Str\".PosTarget (Real)", "Ram target = contact + stroke", "mm", 0, "REAL"),
    W("F_MAX", "D1064 (float)", "\"Str\".ForceMax (Real)", "Maximum force of the part", "kN", 0, "REAL"),
    W("K_SB", "D1066 (float)", "\"Str\".K (Real)", "Spring-back factor K of the recipe (stroke / deflection)", "", KSB, "REAL"),
    W("TOL_UM", "D1068 (float)", "\"Str\".Tol (Real)", "Run-out tolerance (recipe)", "µm", TOL, "REAL"),
    W("BENDS", "D1070", "\"Str\".Bends", "Bends of this part", "", 0, "INT"),
    W("ALM_CODE", "D1000", "\"Str\".AlarmCode", "Alarm code for std.alarm", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Machine power (example: HPU 1.5 kW idle, 7.5 kW pressing)", "kW", 0, "REAL"),
    T("T_CLAMP", "T0", "\"IDB_T_Clamp\" (TON)", "Clamp time-out", 3.0),
    T("T_MEAS", "T1", "\"IDB_T_Meas\" (TON)", "Measuring turn time-out (normal 5 s)", 12),
    T("T_PRESS", "T2", "\"IDB_T_Press\" (TON)", "Press stroke time-out", 15),
    T("T_DEC", "T3", "\"IDB_T_Dec\" (TON)", "Settle time before the decision (signals stable)", 0.2),
    T("T_UNL", "T4", "\"IDB_T_Unl\" (TON)", "Unclamp time", 0.6),
  ];
  const ST = ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6", "ST7"];
  const networks = [
    N("Network 1 – First scan + step 0: wait for start",
      "Start with Enable from the interface, bar on the V-blocks, ram at the top, light curtain clear, HPU ready, no alarm. Bend counter and first-measurement flag are set for the new part.",
      R(NO("FIRST"), SET("ST0"), ...ST.map(RST)),
      R(S(NO("ST0"), NO("M_ENABLE"), NO("B_PART"), NO("B_PTOP"), NO("B_LC"), NO("B_HPU"), NC("M_ALM")), SET("ST1"), RST("ST0"), MOV(0, "BENDS"), SET("M_FIRST"), MOV(0, "F_MAX"))),
    N("Network 2 – Step 1: clamp → start the measuring turn",
      "When the bar is held: store the start angle A0 and the first run-out sample as max and min.",
      R(S(NO("ST1"), NO("B_CLAMPED")), MOV("ANGLE", "A0"), MOV("RUNOUT", "R_MAX"), MOV("RUNOUT", "R_MIN"), MOV("ANGLE", "A_MAX"), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_CLAMP")), SET("AL_TO"))),
    N("Network 3 – Step 2: rotate 360° and track max / min",
      "Every scan (20 ms = 1.44° at 72 °/s) compare the sample with max and min; store the angle of the maximum = high point. TIR = max − min after one full turn.",
      R(NO("ST2"), CALC("ANGLE-A0", "REL")),
      R(S(NO("ST2"), CMP(">", "RUNOUT", "R_MAX")), MOV("RUNOUT", "R_MAX"), MOV("ANGLE", "A_MAX")),
      R(S(NO("ST2"), CMP("<", "RUNOUT", "R_MIN")), MOV("RUNOUT", "R_MIN")),
      R(S(NO("ST2"), CMP(">=", "REL", 360)), CALC("R_MAX-R_MIN", "TIR"), CALC("A_MAX+360", "A_TGT"), SET("ST3"), RST("ST2")),
      R(S(NO("ST2"), TON("T_MEAS")), SET("AL_TO"))),
    N("Network 4 – Step 3: decide – run-out before / after, OK, bend or NOK",
      "First turn → run-out before. Every turn → run-out after. TIR ≤ tolerance → unload OK. TIR > tolerance and bends < 3 → compute the stroke and bend. Bends = 3 and still out → unload NOK (QG-BS-3: more bends = crack risk).",
      R(S(NO("ST3"), NO("M_FIRST")), MOV("TIR", "RO_B"), RST("M_FIRST")),
      R(NO("ST3"), MOV("TIR", "RO_A")),
      R(S(NO("ST3"), TON("T_DEC"), P(CMP("<=", "TIR", "TOL_UM"), CMP(">=", "BENDS", NMAX))), SET("ST7"), RST("ST3")),
      R(S(NO("ST3"), NO("T_DEC"), CMP(">", "TIR", "TOL_UM"), CMP("<", "BENDS", NMAX)), CALC("K_SB*TIR/2000", "STROKE"), SET("ST4"), RST("ST3"))),
    N("Network 5 – Step 4: turn the high point under the ram",
      "Keep rotating until the angle reaches A_MAX + 360° (the same angular position one turn later). The sensor sits in the same plane as the ram.",
      R(S(NO("ST4"), CMP(">=", "ANGLE", "A_TGT")), SET("ST5"), RST("ST4"), RST("M_CON"))),
    N("Network 6 – Step 5: press – find contact, then stroke beyond contact",
      "The ram goes down at 4 mm/s. Force ≥ 2 kN = contact: store the position, target = contact + stroke (e.g. TIR 600 µm, K 6 → 6 × 300 µm = 1.8 mm). At the target: bend counted, step 6 ram up.",
      R(S(NO("ST5"), CMP(">=", "FORCE", 2), NC("M_CON")), SET("M_CON"), MOV("RAM_POS", "POS_C"), CALC("RAM_POS+STROKE", "POS_T")),
      R(S(NO("ST5"), CMP(">", "FORCE", "F_MAX")), MOV("FORCE", "F_MAX")),
      R(S(NO("ST5"), NO("M_CON"), CMP(">=", "RAM_POS", "POS_T")), CALC("BENDS+1", "BENDS"), SET("ST6"), RST("ST5")),
      R(S(NO("ST5"), TON("T_PRESS")), SET("AL_TO"))),
    N("Network 7 – Step 6: ram up → measure again",
      "Back to step 2 with a new measuring turn (start angle and max / min again).",
      R(S(NO("ST6"), NO("B_PTOP")), MOV("ANGLE", "A0"), MOV("RUNOUT", "R_MAX"), MOV("RUNOUT", "R_MIN"), MOV("ANGLE", "A_MAX"), SET("ST2"), RST("ST6"))),
    N("Network 8 – Step 7: unclamp → part done (OK = last TIR ≤ tolerance)",
      "The part result is decided by the last measurement. NOK parts go to the rework / scrap rack (scrap counter).",
      R(CMP("<=", "RO_A", "TOL_UM"), OUT("M_POK")),
      R(S(NO("ST7"), TON("T_UNL")), OUT("M_PDONE"), SET("ST0"), RST("ST7"))),
    N("Network 9 – Outputs with interlocks",
      "Ram down only with light curtain clear, HPU ready, force below the limit and no alarm. Rotation never while the ram is in contact (M_CON in step 5).",
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6")), OUT("Y_CLAMP")),
      R(S(P(NO("ST2"), NO("ST4")), NC("M_ALM")), OUT("Y_ROT")),
      R(S(NO("ST5"), NO("B_LC"), NO("B_HPU"), NC("AL_FORCE"), NC("M_ALM")), OUT("Y_PDN")),
      R(P(NO("ST6"), S(NO("M_ALM"), NC("B_PTOP"))), OUT("Y_PUP"))),
    N("Network 10 – Alarms: force limit, sensor, acknowledge, code",
      "Force > 95 kN → stop down at once (alarm 501). Run-out signal beyond ± 1900 µm = sensor fault / wire break (502). Acknowledge resets when the cause is gone. With an alarm the ram goes up.",
      R(CMP(">", "FORCE", 95), SET("AL_FORCE")),
      R(S(NO("M_INCYC"), P(CMP(">", "RUNOUT", 1900), CMP("<", "RUNOUT", -1900))), SET("AL_SENS")),
      R(S(NO("M_ACKP"), CMP("<", "FORCE", 2)), RST("AL_FORCE")),
      R(NO("M_ACKP"), RST("AL_SENS"), RST("AL_TO")),
      R(P(NO("AL_FORCE"), NO("AL_SENS"), NO("AL_TO")), OUT("M_ALM")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")), R(NO("AL_TO"), MOV(153, "ALM_CODE")), R(NO("AL_SENS"), MOV(502, "ALM_CODE")), R(NO("AL_FORCE"), MOV(501, "ALM_CODE"))),
    N("Network 11 – In cycle + power",
      "Power example: HPU idle 1.5 kW, pressing 7.5 kW.",
      R(P(...ST.map(NO)), OUT("M_INCYC")),
      R(NO("ON"), MOV(1.5, "P_KW")),
      R(P(NO("Y_PDN"), NO("Y_PUP")), MOV(7.5, "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "B_PART", power: "P_KW" };
  const process = [["press.runoutBefore_um", "RO_B"], ["press.runoutAfter_um", "RO_A"], ["press.force_kN", "F_MAX"], ["press.stroke_mm", "STROKE"], ["press.bends", "BENDS"]];
  let lastPen = 0, R0 = rng(5), tir = 600, kt = 8, ph = 30, loadT = 0, pen = 0, cl = delayBit(0.5, 0.3), pressed = false;
  const fixed = [];   // test hook: [{ tir, k, ph }, …]
  const newPart = () => { const f = fixed.shift(); if (f) { tir = f.tir; kt = f.k; ph = f.ph; } else { tir = 350 + R0() * 500; kt = 7.2 + R0() * 1.6; ph = R0() * 360; } };
  const plant = {
    fixed,
    step(st, dt) {
      st.B_CLAMPED = cl(!!st.Y_CLAMP, dt);
      if (st.Y_ROT && !(st.RAM_POS > CONTACT)) st.ANGLE = (st.ANGLE || 0) + ROT_V * dt;
      if (!st.Y_CLAMP && st.ANGLE > 3600) st.ANGLE = st.ANGLE % 360;   // counter re-zeroed between parts
      st.RUNOUT = st.B_CLAMPED ? (tir / 2) * Math.sin(((st.ANGLE || 0) + ph) * Math.PI / 180) : 0;
      if (st.Y_PDN) st.RAM_POS = Math.min(60, st.RAM_POS + RAM_DN * dt);
      if (st.Y_PUP) st.RAM_POS = Math.max(0, st.RAM_POS - RAM_UP * dt);
      pen = Math.max(0, st.RAM_POS - CONTACT);
      st.FORCE = Math.min(48 + 4 * pen, KBAR * pen);
      if (pen > 0) pressed = Math.max(pressed || 0, pen);
      if (pen === 0 && pressed) { lastPen = pressed; tir = Math.abs(tir - 2000 * pressed / kt) + 2; pressed = false; }   // spring-back: plastic correction = 2 × stroke / k_true
      st.B_PTOP = st.RAM_POS <= 0.05;
      if (st.M_PDONE) { st.B_PART = false; loadT = 6; }
      if (loadT > 0) { loadT -= dt; if (loadT <= 0) { newPart(); st.B_PART = true; } }
    },
    reset(st) { R0 = rng(5); cl.reset(); loadT = 0; pen = 0; pressed = false; newPart(); Object.assign(st, { ANGLE: 0, RAM_POS: 0, FORCE: 0, RUNOUT: 0, B_PART: true, B_PTOP: true }); },
    info: () => ({ tir, kt, lastPen }),
  };
  return { tags, networks, hooks, process, plant };
}

export function panel(st, info, U) {
  const step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5", "ST6", "ST7"].find((s) => st[s]) || "–";
  return U.gauge("Run-out (sensor)", `${(+st.RUNOUT || 0).toFixed(0)} µm`, `${U.bar(+st.RUNOUT + 1000, 0, 2000, [1000])}<small>angle ${((+st.ANGLE || 0) % 360).toFixed(0)}° · TIR ${(+st.TIR || 0).toFixed(0)} µm · tol ${st.TOL_UM} µm · step ${step}</small>`)
    + U.gauge("Ram", `${(+st.RAM_POS || 0).toFixed(2)} mm`, `${U.bar(st.RAM_POS, 0, 30, [CONTACT, st.POS_T || 0])}<small>force ${(+st.FORCE || 0).toFixed(1)} kN · contact 20 mm · target ${(+st.POS_T || 0).toFixed(2)} mm</small>`)
    + U.gauge("Straightening", `bend ${st.BENDS || 0} / ${NMAX}`, `<small>before ${(+st.RO_B || 0).toFixed(0)} µm → after ${(+st.RO_A || 0).toFixed(0)} µm · stroke ${(+st.STROKE || 0).toFixed(2)} mm (K ${st.K_SB}) · F max ${(+st.F_MAX || 0).toFixed(1)} kN</small>`);
}

export const TRY = [
  "Watch one part: clamp → one turn (5 s) → TIR ≈ 350 … 850 µm → turn to the high point → press (stroke = 6 × TIR / 2) → ram up → measure again. Usually 2 bends to ≤ 100 µm.",
  "Registers 46 – 55 (press group): run-out before / after, force, stroke, bends – the MES gets them per part.",
  "Drag <b>K_SB</b>? It is a recipe word (HMI) – in the I/O table. Force <b>FORCE</b> above 95 kN: alarm 501, ram up.",
  "Force <b>RUNOUT</b> to 2000 µm: sensor fault 502 (wire break gives full scale on a ±10 V input).",
];
export const NOTES = {
  io: "Delta: X0.0 … X0.4, Y0.0 … Y0.3, AS04AD-A (run-out, ram position, force), high-speed counter for the encoder (on-board HSC – check the AS manual for the counter input X0.8 … and the C/HC device). Siemens 1215C: on-board HSC 1 for the encoder (%ID1000), SM 1231 AI 4 for the analog signals.",
  timing: [["measuring turn 360° at 72 °/s", "5.0 s (sample every 20 ms = 1.44°)"], ["turn to the high point", "0 … 5 s"], ["ram down 20 mm at 4 mm/s + stroke", "≈ 5 s + stroke / 4 mm/s"], ["ram up at 15 mm/s", "≈ 1.5 s"], ["stroke rule (example)", "TIR 600 µm, K 6 → 6 × 0.300 mm = 1.80 mm"], ["after bend 1 (k_true 8)", "600 × |1 − 6/8| = 150 µm → stroke 0.45 mm"], ["after bend 2", "150 × 0.25 = 37.5 µm ≤ 100 → OK"], ["force at 1.8 mm (bar stiffness 13 kN/mm)", "≈ 23 kN (+ plastic part)"]],
  wiring: ["Laser / LVDT run-out sensor ±10 V on a differential AI, shield on the cabinet side; mount it in the plane of the ram.", "Encoder A/B 24 V HTL on the high-speed counter inputs (Delta HSC inputs, Siemens HSC 1 %I0.0/%I0.1 – then move the other inputs!) – check the counter assignment of your CPU.", "Load cell with a measuring amplifier (0–10 V); calibrate with a reference load cell yearly."],
  safety: "The press danger zone is guarded by a light curtain (type 4, IEC 61496) and a two-hand / enabling device in set-up; the safety relay switches the safety valve of the press (EN ISO 16092-3 for hydraulic presses – check) and the e-stop. The ladder only reads B_LC. The force limit 95 kN here is a PROCESS limit; the hydraulic relief valve is the mechanical limit.",
  plcWhy: "S7-1200 1215C / Delta AS332T-A: few I/O (5 DI, 4 DO, 4 AI, 1 encoder), simple step chain – a compact PLC is enough; the press maker's own control is also fine if it offers the Modbus TCP server with our map.",
};

export function selfTest({ runEngine, ok, near }) {
  const def = { KEY, TYPE, MID, LOTQTY: 1, RECIPE, PART, TITLE, PLC, build };
  const T = runEngine(def, { auto: true });
  const { a, E, until } = T;
  a.meta.plant.fixed.push({ tir: 600, k: 8, ph: 30 });     // known part for the hand check
  E.reset();
  until(() => E.bit("ST3"), 30);
  ok("str: measuring turn → TIR = 600 µm (known part), run-out before", near(E.num("TIR"), 600, 2) && near(E.num("RO_B"), 600, 2), `TIR ${E.num("TIR").toFixed(1)} µm`);
  until(() => E.bit("ST4"), 2);
  ok("str: stroke = K × TIR / 2 = 6 × 0.300 = 1.80 mm", near(E.num("STROKE"), 1.8, 0.01), `${E.num("STROKE").toFixed(3)} mm`);
  until(() => E.bit("ST6"), 20);
  const pc = E.num("POS_C"), pt = E.num("POS_T");
  until(() => E.bit("ST2"), 20); const pen1 = a.meta.plant.info().lastPen;
  ok("str: contact at 20 mm + 2 kN threshold (0.15 mm) + ≤ 1 scan, target = contact + 1.80 mm, force ≈ 13 kN/mm × penetration", pc >= 20.1 && pc <= 20.25 && near(pt - pc, 1.8, 0.001) && near(E.num("F_MAX"), KBAR * pen1, 0.5), `contact ${pc.toFixed(3)} mm, target ${pt.toFixed(3)} mm, penetration ${pen1.toFixed(3)} mm, F ${E.num("F_MAX").toFixed(1)} kN`);
  until(() => E.bit("ST3"), 20); E.run(0.05);
  const exp1 = Math.abs(600 - 2000 * pen1 / 8) + 2;
  ok("str: after bend 1: TIR = |600 − 2000 × penetration / k_true 8| + 2 (spring-back model)", near(E.num("TIR"), exp1, 3), `${E.num("TIR").toFixed(1)} µm (hand ${exp1.toFixed(1)} µm)`);
  until(() => E.state.GOOD + E.state.SCRAP >= 1, 60);
  ok("str: after bend 2 ≤ 100 µm → OK, 2 bends, registers bends / run-out after", E.state.GOOD === 1 && a.img.get("press.bends") === 2 && a.img.get("press.runoutAfter_um") <= 100 && near(a.img.get("press.runoutBefore_um"), 600, 2), `bends ${a.img.get("press.bends")}, after ${(+a.img.get("press.runoutAfter_um")).toFixed(1)} µm`);
}
