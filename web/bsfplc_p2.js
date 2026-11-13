/* Item 8 – program 2: INDUCTION SCAN HARDENING (+ quench) of the ball screw thread, BS-IND-01 (type code 6).
 * Data of item 2 route BS op 50: 30 kHz, generator 60 kW (used 35 kW), scan speed 4 mm/s, rotation 150 min⁻¹, polymer quench 10 % at 25 °C,
 * thread length 850 mm → heating time = 850 / 4 = 212.5 s. Vertical machine: the coil + spray ring move UP with the scan servo.
 * Tempering follows in the furnace HT-TMP (≤ 1 h after hardening – item 2). Energy monitor: kJ per part in a ± 5 % window, else reject (QG-BS-2).
 * PLC: Delta AS332T-A + AS04AD-A / AS04DA-A + ASDA-B3 servo · Siemens S7-1500 CPU 1513F-1 PN (F-CPU: door, generator safe-off, servo STO).
 * All addresses, times and values are EXAMPLES – check with your PLC configuration and the generator manual. */
import { I, Q, M, AI, AQ, W, T, NO, NC, PE, CMP, TON, S, P, OUT, SET, RST, CALC, MOV, R, N, lag, delayBit } from "./bsfplc_lib.js";

export const KEY = "ind", TYPE = "BS-IND", MID = "BS-IND-01", LOTQTY = 2, RECIPE = 50, PART = "BS-3210-1000-C5";
export const TITLE = "Induction scan hardening + quench – BS-IND-01 (850 mm thread, 4 mm/s, 35 kW)";
export const PLC = { delta: { cpu: "AS332T-A + AS04AD-A / AS04DA-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1500 CPU 1513F-1 PN", sw: "TIA Portal V19 + Safety" } };
export const BTN = "2 · Induction hardening BS-IND";
export const BASIS = "item 2 route BS op 50 (30 kHz, 35 kW, 4 mm/s, 150 min⁻¹, polymer 10 %) · QG-BS-2 energy monitor · alarms 301 / 302 / 303 (item 3)";
export const L_THREAD = 850, V_SCAN = 4, P_SET = 35, Z_START = 75, V_FAST = 50, V_RET = -100, T_PRE = 1.0, T_POSTQ = 8;
export const E_NOM = P_SET * (T_PRE + L_THREAD / V_SCAN);   // kJ = kW × s → 35 × 213.5 = 7472.5 kJ

export function build() {
  const G = "Machine sensors (from the plant – click = force)", F = "Faults + signals (click to simulate)";
  const tags = [
    I("B_PART", "X0.0", "%I0.0", "Screw loaded between the centres (-BG1)", "-BG1 PNP", true, { ui: "sensor", group: G }),
    I("B_TAIL", "X0.1", "%I0.1", "Tailstock clamped (-BG2)", "-BG2", false, { ui: "sensor", group: G }),
    I("B_DOOR", "X0.2", "%I0.2", "Door closed + locked – STATUS from the F-CPU / safety relay (the safety function switches the generator HV and the servo STO itself)", "F-DI / -KF1 13/14", true, { group: F }),
    I("AX_RDY", "X0.3", "%I0.3", "Scan servo ready (ASDA-B3 SRDY · V90 'ready' in telegram 1)", "-TA1 DO1", true, { group: F }),
    I("B_ROT", "X0.4", "%I0.4", "Work rotation at speed 150 min⁻¹ (VFD relay 'at frequency')", "-TA2 relay", false, { ui: "sensor", group: G }),
    I("GEN_RDY", "X0.5", "%I0.5", "Generator ready (inverter OK, HV available)", "generator I/O X10:1", true, { group: F }),
    I("GEN_FLT", "X0.6", "%I0.6", "Generator fault (inverter trip) – alarm 301", "generator I/O X10:2", false, { group: F }),
    I("B_QFLOW", "X0.7", "%I1.0", "Quench flow switch ≥ 40 l/min (-BF1)", "-BF1", false, { ui: "sensor", group: G }),
    I("B_QLVL", "X0.8", "%I1.1", "Quench tank level OK (-BL1)", "-BL1", true, { group: F }),
    AI("AX_POS", "D310 (ASDA-B3 position feedback, float)", "\"AxScan\".ActualPosition (TO)", "Scan axis position (coil height), 0 = home", "mm", 0, 1000, 0, "encoder / PROFINET", { ui: "sensor", inc: 0.1 }),
    AI("GEN_P", "D300 (AS04AD-A ch1, 0–10 V = 0–60 kW)", "%IW10 (AI 8 ch0) → \"Ind\".GenP", "Generator actual power (analog monitor output)", "kW", 0, 60, 0, "generator X11:1-2 → AI ch1", { ui: "sensor", inc: 0.1 }),
    AI("GEN_F", "D301 (AS04AD-A ch2)", "%IW12 (AI ch1)", "Generator frequency (resonance follows the load)", "kHz", 0, 50, 0, "generator X11:3-4", { ui: "sensor", inc: 0.1 }),
    AI("Q_FLOW", "D302 (AS04AD-A ch3)", "%IW14 (AI ch2)", "Quench flow (magnetic flow meter 4–20 mA)", "l/min", 0, 100, 0, "-BF2 4–20 mA", { ui: "sensor", inc: 0.5 }),
    AI("Q_TEMP", "D303 (AS04AD-A ch4)", "%IW16 (AI ch3)", "Quench temperature (PT100 transmitter) – window 15 … 35 °C", "°C", 0, 60, 25, "-BT1 4–20 mA", { ui: "sensor", inc: 0.1 }),
    AI("POLY", "D304 (HMI entry / refractometer)", "\"Ind\".Polymer", "Polymer concentration of the quench (checked per shift, refractometer)", "%", 0, 20, 10, "HMI"),
    Q("Y_TAIL", "Y0.0", "%Q0.0", "Tailstock clamp valve -MB1", "-MB1"),
    Q("Y_ROT", "Y0.1", "%Q0.1", "Work rotation VFD run (150 min⁻¹ preset)", "-TA2 DI1"),
    Q("Y_AXEN", "Y0.2", "%Q0.2", "Scan servo enable (SON) – the STO is the SAFETY function (F-DQ / safety relay)", "-TA1 DI1"),
    Q("Y_QPUMP", "Y0.3", "%Q0.3", "Quench pump contactor -QA3", "-QA3"),
    Q("Y_QSPRAY", "Y0.4", "%Q0.4", "Quench spray valve (integral spray ring below the coil)", "-MB2"),
    Q("Y_GEN", "Y0.5", "%Q0.5", "Generator HEAT ON (generator interface – the HV contactor is in the safety circuit)", "generator X10:5"),
    AQ("AX_SPD", "D320 → ASDA-B3 speed command (V-mode ±10 V via AS04DA-A ch2) or pulse output", "\"AxScan\" MC_MoveVelocity.Velocity", "Scan axis speed command (+ = up)", "mm/s", -100, 100, "-TA1 V-REF"),
    AQ("GEN_RAW", "D331 → AS04DA-A ch1 (0…32000 = 0…10 V)", "%QW20 (AQ 4 ch0, 0…27648 = 0…10 V)", "Generator power set point, raw counts (Siemens scaling shown: 27648 = 60 kW)", "counts", 0, 32767, "AQ ch0 → generator X11:5-6"),
    M("ST0", "M0", "\"Ind\".Step0", "Step 0 – wait", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Ind\".Step1", "Step 1 – clamp, rotate, quench pump", false, { step: true, stepLabel: "1 prepare" }),
    M("ST2", "M2", "\"Ind\".Step2", "Step 2 – coil to the thread start (75 mm)", false, { step: true, stepLabel: "2 approach" }),
    M("ST3", "M3", "\"Ind\".Step3", "Step 3 – preheat dwell 1.0 s at the start", false, { step: true, stepLabel: "3 preheat" }),
    M("ST4", "M4", "\"Ind\".Step4", "Step 4 – scan 4 mm/s with heat + spray", false, { step: true, stepLabel: "4 scan" }),
    M("ST5", "M5", "\"Ind\".Step5", "Step 5 – heat off, post-quench 8 s", false, { step: true, stepLabel: "5 post-quench" }),
    M("ST6", "M6", "\"Ind\".Step6", "Step 6 – coil back to home", false, { step: true, stepLabel: "6 return" }),
    M("ST7", "M7", "\"Ind\".Step7", "Step 7 – unclamp + part done", false, { step: true, stepLabel: "7 unload" }),
    M("M_INCYC", "M10", "\"Ind\".InCycle", "In cycle (steps 1 – 7)"),
    M("M_PDONE", "M11", "\"Ind\".PartDone", "Part done – one scan"),
    M("M_POK", "M12", "\"Ind\".PartOk", "Part OK (energy in window, no power deviation, no quench / generator fault)"),
    M("M_ALM", "M13", "\"Ind\".Alarm", "Any alarm"),
    M("M_QOK", "M14", "\"Ind\".QuenchOk", "Quench ready: pump ON, flow switch, level, temperature 15 … 35 °C"),
    M("M_HEAT", "M15", "\"Ind\".HeatAllowed", "Heat allowed: quench ready, door, rotation, generator ready, no alarm"),
    M("M_REJ", "M16", "\"Ind\".Reject", "Reject flag of the running part (latched until the next part)"),
    M("M_PDEV", "M17", "\"Ind\".PowerDev", "Actual power deviates > 10 % from the set point"),
    M("AL_GEN", "M20", "\"Ind\".AlGen", "Alarm 301 generator fault"),
    M("AL_QUENCH", "M21", "\"Ind\".AlQuench", "Alarm 302 quench flow low / quench not ready during heating"),
    M("AL_ENERGY", "M22", "\"Ind\".AlEnergy", "Alarm 303 energy monitor out of window (stop, check coil gap)"),
    M("AL_TO", "M23", "\"Ind\".AlTimeout", "Alarm 153 step time-out (clamp / rotation / quench start)"),
    W("GEN_PSET", "D1050 (float)", "\"Ind\".GenPset (Real)", "Generator power set point from the recipe", "kW", P_SET, "REAL"),
    W("GEN_PW", "D1052 (float)", "\"Ind\".GenP (Real)", "Generator actual power, scaled copy for the map", "kW", 0, "REAL"),
    W("SCAN_V", "D1054 (float)", "\"Ind\".ScanV (Real)", "Actual scan speed (only during the scan)", "mm/s", 0, "REAL"),
    W("QF_W", "D1056 (float)", "\"Ind\".QFlow (Real)", "Quench flow copy", "l/min", 0, "REAL"),
    W("QT_W", "D1058 (float)", "\"Ind\".QTemp (Real)", "Quench temperature copy", "°C", 0, "REAL"),
    W("GF_W", "D1060 (float)", "\"Ind\".GenF (Real)", "Generator frequency copy", "kHz", 0, "REAL"),
    W("PO_W", "D1062 (float)", "\"Ind\".Polymer (Real)", "Polymer % copy", "%", 0, "REAL"),
    W("P_HI", "D1068 (float)", "\"Ind\".PHi (Real)", "Power window high = set point × 1.1", "kW", 0, "REAL"),
    W("P_LO", "D1070 (float)", "\"Ind\".PLo (Real)", "Power window low = set point × 0.9", "kW", 0, "REAL"),
    W("E_PART", "D1040 (float)", "\"Ind\".EnergyPart (Real)", "Energy of this part = Σ P × 0.1 s (10 Hz clock)", "kJ", 0, "REAL"),
    W("E_LAST", "D1042 (float)", "\"Ind\".EnergyLast (Real)", "Energy of the last finished part", "kJ", 0, "REAL"),
    W("E_MIN", "D1064 (float)", "\"Ind\".EMin (Real)", "Energy window low = nominal − 5 % (recipe)", "kJ", +(E_NOM * 0.95).toFixed(1), "REAL"),
    W("E_MAX", "D1066 (float)", "\"Ind\".EMax (Real)", "Energy window high = nominal + 5 % (recipe)", "kJ", +(E_NOM * 1.05).toFixed(1), "REAL"),
    W("EOK", "D1044", "\"Ind\".EnergyOk", "ind.energyOK: 1 pass, 2 fail", "", 0, "INT"),
    W("ALM_CODE", "D1000", "\"Ind\".AlarmCode", "Alarm code for std.alarm", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Machine power = generator / 0.85 + auxiliaries (example)", "kW", 0, "REAL"),
    T("T_PREP", "T0", "\"IDB_T_Prep\" (TON)", "Prepare time-out (clamp, rotation, quench flow)", 10),
    T("T_PRE", "T1", "\"IDB_T_Pre\" (TON)", "Preheat dwell at the thread start", T_PRE),
    T("T_POSTQ", "T2", "\"IDB_T_PostQ\" (TON)", "Post-quench time after heat off", T_POSTQ),
    T("T_QLOSS", "T3", "\"IDB_T_QLoss\" (TON)", "Quench lost during heating → heat off + alarm (debounce)", 0.2),
    T("T_PDEV", "T4", "\"IDB_T_PDev\" (TON)", "Power deviation > 10 % longer than", 0.5),
    T("T_UNL", "T5", "\"IDB_T_Unl\" (TON)", "Unclamp time", 1.0),
  ];
  const networks = [
    N("Network 1 – First scan + step 0: wait for start",
      "A new part starts only with Enable from the standard interface (AUTO, MES lot, started), a screw between the centres, the coil at home (≤ 1 mm) and no alarm.",
      R(NO("FIRST"), SET("ST0"), RST("ST1"), RST("ST2"), RST("ST3"), RST("ST4"), RST("ST5"), RST("ST6"), RST("ST7")),
      R(S(NO("ST0"), NO("M_ENABLE"), NO("B_PART"), CMP("<=", "AX_POS", 1), NC("M_ALM")), SET("ST1"), RST("ST0"), RST("M_REJ"), MOV(0, "E_PART"))),
    N("Network 2 – Step 1: clamp, rotate 150 min⁻¹, quench pump – wait for 'quench ready'",
      "Heating must never start without quench: the pump runs and the flow switch must confirm before the coil moves. Time-out 10 s → alarm 153.",
      R(S(NO("ST1"), NO("B_TAIL"), NO("B_ROT"), NO("M_QOK")), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_PREP")), SET("AL_TO"))),
    N("Network 3 – Quench ready + heat allowed (interlocks)",
      "Quench ready = pump ON AND flow switch AND tank level AND 15 °C ≤ temperature ≤ 35 °C. Heat allowed = quench ready AND door closed AND rotation AND generator ready AND no fault AND no alarm. The door / HV interlock itself is the safety function (F-CPU) – this is the process interlock.",
      R(S(NO("Y_QPUMP"), NO("B_QFLOW"), NO("B_QLVL"), CMP(">=", "Q_TEMP", 15), CMP("<=", "Q_TEMP", 35)), OUT("M_QOK")),
      R(S(NO("M_QOK"), NO("B_DOOR"), NO("B_ROT"), NO("GEN_RDY"), NC("GEN_FLT"), NC("M_ALM")), OUT("M_HEAT"))),
    N("Network 4 – Step 2: coil to the thread start (75 mm at 50 mm/s)",
      "The journal (0 … 75 mm) stays soft – item 2: journals NOT hardened. Approach 75 mm / 50 mm/s = 1.5 s.",
      R(S(NO("ST2"), CMP(">=", "AX_POS", Z_START)), SET("ST3"), RST("ST2"))),
    N("Network 5 – Step 3: preheat dwell 1.0 s, then step 4 scan",
      "Generator ON at the start position for 1.0 s so the first millimetres reach the hardening temperature, then the scan starts.",
      R(S(NO("ST3"), TON("T_PRE")), SET("ST4"), RST("ST3"))),
    N("Network 6 – Step 4: scan 4 mm/s to the thread end (925 mm)",
      "Heating time = thread length / scan speed = 850 mm / 4 mm/s = 212.5 s. The spray ring below the coil quenches the hot zone (self-quench of the moving zone).",
      R(S(NO("ST4"), CMP(">=", "AX_POS", Z_START + L_THREAD)), SET("ST5"), RST("ST4"))),
    N("Network 7 – Step 5: heat off, post-quench 8 s · step 6: return · step 7: unload",
      "After the scan the generator switches off and the spray continues 8 s (the end zone must cool below Ms). Return to home at 100 mm/s (9.25 s), unclamp 1 s → part done (one scan).",
      R(S(NO("ST5"), TON("T_POSTQ")), SET("ST6"), RST("ST5")),
      R(S(NO("ST6"), CMP("<=", "AX_POS", 0.5)), SET("ST7"), RST("ST6")),
      R(S(NO("ST7"), TON("T_UNL")), OUT("M_PDONE"), SET("ST0"), RST("ST7"))),
    N("Network 8 – Scan servo speed command",
      "One speed value per step (MOVE – the last true rung wins): approach +50, scan +4, return −100, otherwise 0. Delta: ASDA-B3 in speed mode (analog ±10 V) or pulse train; Siemens: MC_MoveVelocity on the technology object \"AxScan\" (V90 PN).",
      R(NO("ON"), MOV(0, "AX_SPD")),
      R(S(NO("ST2"), NO("Y_AXEN")), MOV(V_FAST, "AX_SPD")),
      R(S(NO("ST4"), NO("Y_AXEN"), NO("M_HEAT")), MOV(V_SCAN, "AX_SPD")),
      R(S(NO("ST6"), NO("Y_AXEN")), MOV(V_RET, "AX_SPD"))),
    N("Network 9 – Outputs: clamp, rotation, servo enable, quench pump + spray, generator",
      "Generator HEAT ON only in steps 3 – 4 AND heat allowed. If the quench is lost the generator goes off in the same scan (M_HEAT drops) – no soft spots, no burnt part. Spray from step 3 to step 5.",
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6")), OUT("Y_TAIL"), OUT("Y_ROT")),
      R(S(P(NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6")), NO("AX_RDY")), OUT("Y_AXEN")),
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5")), OUT("Y_QPUMP")),
      R(S(P(NO("ST3"), NO("ST4"), NO("ST5")), NO("Y_QPUMP")), OUT("Y_QSPRAY")),
      R(S(P(NO("ST3"), NO("ST4")), NO("M_HEAT")), OUT("Y_GEN"))),
    N("Network 10 – Generator power set point (analog output, scaling)",
      "Recipe 35 kW. Siemens AQ: 0 … 27648 = 0 … 10 V = 0 … 60 kW → raw = P × 27648 / 60 = 16128 for 35 kW. Delta AS04DA-A: 0 … 32000 → 18667 (check the module range). Set point 0 when the generator is off.",
      R(NO("Y_GEN"), CALC("GEN_PSET*27648/60", "GEN_RAW")),
      R(NC("Y_GEN"), MOV(0, "GEN_RAW"))),
    N("Network 11 – Energy monitor: Σ P × 0.1 s, power deviation",
      "Every 100 ms (rising edge of the 10 Hz clock) while heating: E := E + P × 0.1 s (kW × s = kJ). Nominal = 35 kW × (1.0 + 212.5) s = 7472.5 kJ. Actual power more than 10 % away from the set point for 0.5 s → reject flag.",
      R(S(PE("CLK10"), NO("Y_GEN")), CALC("E_PART+GEN_P*0.1", "E_PART")),
      R(NO("ON"), CALC("GEN_PSET*1.1", "P_HI"), CALC("GEN_PSET*0.9", "P_LO")),
      R(S(NO("Y_GEN"), P(CMP(">", "GEN_P", "P_HI"), CMP("<", "GEN_P", "P_LO"))), OUT("M_PDEV")),
      R(S(NO("M_PDEV"), TON("T_PDEV")), SET("M_REJ"))),
    N("Network 12 – Quench lost / generator fault during heating → heat off, alarm, reject",
      "Quench not ready for 0.2 s while steps 3 – 4 run → alarm 302 + reject (the zone was heated without quench). Generator fault → alarm 301 + reject. Abort: with an alarm in steps 3 – 4 the chain jumps to step 5 (post-quench, return, unload) so the scrap part leaves the machine; the next part waits for the acknowledge.",
      R(S(P(NO("ST3"), NO("ST4")), NC("M_QOK"), TON("T_QLOSS")), SET("AL_QUENCH"), SET("M_REJ")),
      R(S(NO("GEN_FLT"), NO("M_INCYC")), SET("AL_GEN"), SET("M_REJ")),
      R(S(NO("ST4"), NC("M_HEAT")), SET("M_REJ")),
      R(S(P(NO("ST3"), NO("ST4")), NO("M_ALM")), SET("ST5"), RST("ST3"), RST("ST4"))),
    N("Network 13 – Part result at the end of the scan: energy window",
      "At the end of the post-quench (rising edge of step 6 – one scan; step 5 is already reset by network 7, rung order!) compare the energy with the window 7099 … 7846 kJ (± 5 %, recipe). Out of window → reject + alarm 303 (QG-BS-2: stop the machine, check the coil gap and the energy monitor). energyOK register: 1 pass, 2 fail.",
      R(S(PE("ST6"), P(CMP("<", "E_PART", "E_MIN"), CMP(">", "E_PART", "E_MAX"))), SET("AL_ENERGY"), SET("M_REJ")),
      R(PE("ST6"), MOV("E_PART", "E_LAST")),
      R(S(NO("ST7"), NC("M_REJ")), MOV(1, "EOK")),
      R(S(NO("ST7"), NO("M_REJ")), MOV(2, "EOK")),
      R(NC("M_REJ"), OUT("M_POK"))),
    N("Network 14 – Alarms: acknowledge + summary + code",
      "Alarms reset with the acknowledge pulse when the cause is gone. Code priority (last MOVE wins): 153 < 303 < 302 < 301.",
      R(S(NO("M_ACKP"), NC("GEN_FLT")), RST("AL_GEN")),
      R(S(NO("M_ACKP"), NO("M_QOK")), RST("AL_QUENCH")),
      R(NO("M_ACKP"), RST("AL_ENERGY"), RST("AL_TO")),
      R(P(NO("AL_GEN"), NO("AL_QUENCH"), NO("AL_ENERGY"), NO("AL_TO")), OUT("M_ALM")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")), R(NO("AL_TO"), MOV(153, "ALM_CODE")), R(NO("AL_ENERGY"), MOV(303, "ALM_CODE")), R(NO("AL_QUENCH"), MOV(302, "ALM_CODE")), R(NO("AL_GEN"), MOV(301, "ALM_CODE"))),
    N("Network 15 – In cycle, scan speed, process copies, machine power",
      "Copies of the analog values as REAL for the map (ind group, registers 46 – 61). Machine power = generator power / 0.85 (inverter + coil losses) + 3 kW base + 4.5 kW quench pump (example).",
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6"), NO("ST7")), OUT("M_INCYC")),
      R(NO("ON"), MOV(0, "SCAN_V"), MOV("GEN_P", "GEN_PW"), MOV("Q_FLOW", "QF_W"), MOV("Q_TEMP", "QT_W"), MOV("GEN_F", "GF_W"), MOV("POLY", "PO_W")),
      R(NO("ST4"), MOV("AX_SPD", "SCAN_V")),
      R(NC("Y_QPUMP"), CALC("GEN_P/0.85+3", "P_KW")),
      R(NO("Y_QPUMP"), CALC("GEN_P/0.85+7.5", "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "B_PART", power: "P_KW" };
  const process = [["ind.power_kW", "GEN_PW"], ["ind.freq_kHz", "GF_W"], ["ind.scan_mm_s", "SCAN_V"], ["ind.quenchFlow_l_min", "QF_W"], ["ind.quenchTemp_C", "QT_W"], ["ind.polymer_pct", "PO_W"], ["ind.energyPart_kJ", "E_LAST"], ["ind.energyOK", "EOK"]];
  let tail = delayBit(1.0, 0.5), rot = delayBit(2.0, 1.0), loadT = 0;
  const plant = {
    step(st, dt) {
      if (st.Y_AXEN && st.AX_RDY) st.AX_POS = Math.max(0, Math.min(1000, st.AX_POS + st.AX_SPD * dt));
      st.B_TAIL = tail(!!st.Y_TAIL, dt);
      st.B_ROT = rot(!!st.Y_ROT, dt);
      st.Q_FLOW = lag(st.Q_FLOW, st.Y_QPUMP ? 60 : 0, 0.8, dt);
      st.B_QFLOW = st.Q_FLOW >= 40;
      const on = st.Y_GEN && st.GEN_RDY && !st.GEN_FLT;
      st.GEN_P = on ? lag(st.GEN_P, (st.GEN_RAW || 0) * 60 / 27648, 0.15, dt) : 0;
      st.GEN_F = on ? 30 - 0.4 * (st.GEN_P / 35) : 0;
      st.Q_TEMP = lag(st.Q_TEMP, 25 + (st.Y_QSPRAY ? 3 * (st.GEN_P / 35) : 0), 60, dt);
      if (st.M_PDONE) { st.B_PART = false; loadT = 15; }
      if (loadT > 0) { loadT -= dt; if (loadT <= 0) st.B_PART = true; }
    },
    reset(st) { tail.reset(); rot.reset(); loadT = 0; Object.assign(st, { AX_POS: 0, GEN_P: 0, GEN_F: 0, Q_FLOW: 0, Q_TEMP: 25, B_PART: true }); },
    info: () => ({}),
  };
  return { tags, networks, hooks, process, plant };
}

export function panel(st, info, U) {
  const z = +st.AX_POS || 0, step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5", "ST6", "ST7"].find((s) => st[s]) || "–";
  return U.gauge("Scan axis (coil height)", `${z.toFixed(1)} mm`, `${U.bar(z, 0, 1000, [Z_START, Z_START + L_THREAD])}<small>${(+st.AX_SPD || 0).toFixed(0)} mm/s · thread 75 … 925 mm · step ${step}</small>`)
    + U.gauge("Generator", `${(+st.GEN_P || 0).toFixed(1)} kW`, `${U.bar(st.GEN_P, 0, 60, [P_SET])}<small>${(+st.GEN_F || 0).toFixed(1)} kHz · set ${(+st.GEN_PSET).toFixed(0)} kW (raw ${Math.round(st.GEN_RAW || 0)}) · ${U.onoff(st.Y_GEN, "HEAT ON")}</small>`)
    + U.gauge("Quench", `${(+st.Q_FLOW || 0).toFixed(0)} l/min`, `${U.bar(st.Q_FLOW, 0, 100, [40])}<small>${(+st.Q_TEMP || 0).toFixed(1)} °C · polymer ${(+st.POLY || 0).toFixed(1)} % · ${U.onoff(st.M_QOK, "ready", "not ready")} · spray ${U.onoff(st.Y_QSPRAY, "on")}</small>`)
    + U.gauge("Energy monitor", `${(+st.E_PART || 0).toFixed(0)} kJ`, `${U.bar(st.E_PART, 0, 8500, [st.E_MIN, st.E_MAX])}<small>window ${(+st.E_MIN).toFixed(0)} … ${(+st.E_MAX).toFixed(0)} kJ · last ${(+st.E_LAST || 0).toFixed(0)} kJ · ${st.EOK === 2 ? '<span class="bf8-bad">FAIL</span>' : st.EOK === 1 ? '<span class="bf8-on">pass</span>' : "–"}</small>`);
}

export const TRY = [
  "Run at speed 10×. Watch the steps: prepare → approach (1.5 s) → preheat 1.0 s → <b>scan 212.5 s</b> (850 mm / 4 mm/s) → post-quench 8 s → return 9.25 s → unload. The energy monitor ends near 7 470 kJ (window ± 5 %).",
  "Force <b>B_QFLOW</b> off during the scan: after 0.2 s the generator is OFF (M_HEAT drops), alarm 302, the part becomes scrap (energyOK = 2, std.scrap +1). Release the force and acknowledge.",
  "Click <b>GEN_FLT</b> (generator trip): alarm 301, no heat. Drag <b>Q_TEMP</b> above 35 °C: quench not ready → no start / heat off.",
  "Look at registers 46 – 61 (ind group): power, frequency, scan speed 4.000, flow, temperature, polymer, energy per part, energyOK.",
];
export const NOTES = {
  io: "Delta: on-board X0.0 … X0.8 / Y0.0 … Y0.5, analog AS04AD-A (4 ch) + AS04DA-A (generator set point, servo speed), ASDA-B3 servo. Siemens S7-1500: ET 200MP DI 32 / DQ 32 / AI 8 / AQ 4, F-DI 16 + F-DQ 8 for door, e-stop, generator HV, servo STO; V90 PN on PROFINET (telegram 1 / 3).",
  timing: [["approach 0 → 75 mm at 50 mm/s", "1.5 s"], ["preheat dwell", "1.0 s"], ["scan 850 mm at 4 mm/s", "212.5 s"], ["post-quench", "8.0 s"], ["return 925 mm at 100 mm/s", "9.25 s"], ["clamp + rotation ramp + quench flow", "≈ 2 s"], ["unclamp", "1.0 s"], ["cycle (hand)", "≈ 2 + 1.5 + 1 + 212.5 + 8 + 9.25 + 1 ≈ 235 s"], ["energy nominal", "35 kW × 213.5 s = 7472.5 kJ"], ["quench lost → heat off", "0.2 s debounce + 1 scan"], ["energy sample", "10 Hz clock, 0.1 s"]],
  wiring: ["Generator interface: HEAT ON as a 24 V signal to the generator I/O; power set point 0–10 V (AQ); actual power + frequency 0–10 V back (AI); ready / fault as contacts. The HV contactor / pulse block is in the SAFETY circuit (door, e-stop) – not in the PLC program.", "Scan servo: Delta ASDA-B3 (speed mode, analog ±10 V or pulse) / Siemens V90 PN (TO_SpeedAxis or positioning axis). STO terminals wired to the safety relay / F-DQ.", "Analog signals with shielded cable, shield on the cabinet side; 4–20 mA for the flow and temperature transmitters (wire-break detection).", "Quench flow: switch (fast, digital interlock) + flow meter (trend, register) – two independent signals."],
  safety: "Door, e-stop and generator HV off are SAFETY functions: F-CPU (S7-1500F, F-DI door switch with guard locking, F-DQ to the generator HV contactor / pulse inhibit and to the servo STO) or a safety relay / Pilz PNOZmulti 2 for the Delta. The ladder only reads B_DOOR and GEN_RDY. Induction: also EMF exposure (EN 50519 / EU 2013/35/EU) and quench polymer handling – check.",
  plcWhy: "S7-1500 F (CPU 1513F-1 PN) for the induction line: integrated safety for door + generator HV + servo STO in one F-program (PROFIsafe), motion technology objects for the scan axis, more memory for recipes and the energy trace, 3-shift heat treatment (availability). An S7-1200 1215FC also works for a single machine (check the safety + motion load). Delta alternative: AS332T-A + ASDA-B3 + a safety controller (Pilz PNOZmulti 2).",
};

/* self-check lines (called by bsfplc.js &bf8test) */
export function selfTest({ runEngine, ok, near }) {
  const T = runEngine({ KEY, TYPE, MID, LOTQTY: 1, RECIPE, PART, TITLE, PLC, build }, { auto: true });
  const { a, E, until } = T, HR = a.img.HR;
  until(() => E.bit("ST2"), 30);
  const tA = until(() => E.bit("ST3"), 5), tPre = until(() => E.bit("ST4"), 3), tScan = until(() => E.bit("ST5"), 260);
  ok("ind: approach 75 mm at 50 mm/s ≈ 1.5 s, preheat 1.0 s", near(tA, 1.5, 0.05) && near(tPre, 1.0, 0.03), `${tA.toFixed(2)} s, ${tPre.toFixed(2)} s`);
  ok(`ind: scan time = ${L_THREAD} mm / ${V_SCAN} mm/s = 212.5 s`, near(tScan, L_THREAD / V_SCAN, 0.05), `${tScan.toFixed(2)} s`);
  until(() => E.bit("ST6"), 10);
  ok(`ind: energy per part ≈ 35 kW × 213.5 s = ${E_NOM} kJ (± 1 %)`, near(E.num("E_LAST"), E_NOM, E_NOM * 0.01), `${E.num("E_LAST").toFixed(1)} kJ`);
  until(() => E.state.GOOD + E.state.SCRAP >= 1, 20);
  ok("ind: part good, energyOK 1, registers ind.energyPart_kJ + scan speed", E.state.GOOD === 1 && a.img.get("ind.energyOK") === 1 && near(a.img.get("ind.energyPart_kJ"), E.num("E_LAST"), 0.1), `good ${E.state.GOOD}, energyOK ${a.img.get("ind.energyOK")}, reg ${a.img.get("ind.energyPart_kJ")} kJ`);
  ok("ind: cycle ≈ 235 s (hand sum), lastCycle register", near(a.img.get("std.lastCycle_s"), 235, 3), `${a.img.get("std.lastCycle_s")} s`);
  until(() => !!(HR[8] & 2), 40); until(() => E.bit("ST4"), 40); E.run(20);
  E.force("B_QFLOW", false); const tOff = until(() => !E.bit("Y_GEN"), 2); const tAl = until(() => E.bit("AL_QUENCH"), 1) + tOff; E.scan();
  ok("ind: quench flow lost during the scan → generator OFF in the same scan (interlock), alarm 302 after 0.2 s", tOff <= 0.021 && near(tAl, 0.2, 0.03) && HR[7] === 302, `heat off ${(tOff * 1000).toFixed(0)} ms, alarm after ${(tAl * 1000).toFixed(0)} ms, std.alarm ${HR[7]}`);
  E.force("B_QFLOW", null);
  until(() => E.state.SCRAP >= 1, 60);
  ok("ind: that part is scrap, energyOK 2", E.state.SCRAP === 1 && a.img.get("ind.energyOK") === 2, `scrap ${E.state.SCRAP}`);
  ok("ind: generator set point 35 kW → raw 16128 (27648 = 60 kW)", Math.round(35 * 27648 / 60) === 16128);
}
