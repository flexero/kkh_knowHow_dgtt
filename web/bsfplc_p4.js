/* Item 8 – program 4: THREAD GRINDER AUXILIARIES, BS-TGR-03 (type code 12, unit id 15 – the machine of the item-5 NCR "oil-chiller trip").
 * Our PLC does the cell around the CNC: door, loader exchange, tailstock clamping, coolant pump, oil chiller control (20.0 °C, ± 0.5 K band),
 * mist extraction, wheel-dressing counter and the bit interface to the CNC (cycle start, M61 finish-pass permission, feed hold, dress request).
 * NCR action (item 5): "alarm 213 → interlock: no finish pass when |oil − 20 °C| > 0.5 K (PLC, item 8)"; > 1 K for 10 s → feed hold + alarm 213.
 * The temperature loop is simulated faster than reality (0.02 K/s heat input) so the effects are visible in seconds.
 * All addresses, times and values are EXAMPLES – check with your PLC configuration and the CNC maker (M-codes, interface signals). */
import { I, Q, M, AI, W, T, C, NO, NC, PE, CMP, TON, TOF, CTU, S, P, OUT, SET, RST, CALC, MOV, R, N, delayBit, lag } from "./bsfplc_lib.js";

export const KEY = "tgr", TYPE = "BS-TGR", MID = "BS-TGR-03", LOTQTY = 3, RECIPE = 112, PART = "BS-3210-1000-C5";
export const TITLE = "Thread grinder auxiliaries – BS-TGR-03 (loader, door, clamping, oil chiller ± 0.5 K, mist, dressing, CNC interface)";
export const PLC = { delta: { cpu: "AS332T-A + AS16AM10N-A + AS04RTD-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1200 CPU 1215C + SM 1223 + SM 1231 RTD", sw: "TIA Portal V19" } };
export const BTN = "4 · Thread grinder auxiliaries BS-TGR";
export const BASIS = "item 5 NCR 'oil-chiller trip BS-TGR-03' (alarm 213) · item 2 thread grinding · grind + tgr signal groups of item 4 (registers 46 – 75)";
export const SP = 20.0, WARN = 0.5, HOLD = 1.0, T_HOLD = 10, HEAT = 0.02, COOL = 0.05, ROUGH = 40, FINISH = 20, DRESS_N = 5;

export function build() {
  const G = "Machine + CNC signals (from the plant – click = force)", F = "Faults + signals (click to simulate)";
  const tags = [
    I("B_LDDONE", "X0.0", "%I0.0", "Loader: exchange finished (finished part out, raw part between the centres, loader out of the machine)", "loader -KF20 DO1", false, { ui: "sensor", group: G }),
    I("B_DOOR_CL", "X0.1", "%I0.1", "Machine door closed (-BG1)", "-BG1", true, { ui: "sensor", group: G }),
    I("B_DOOR_OP", "X0.2", "%I0.2", "Machine door open (-BG2)", "-BG2", false, { ui: "sensor", group: G }),
    I("B_CLAMPED", "X0.3", "%I0.3", "Tailstock clamped (-BP1 pressure switch)", "-BP1", false, { ui: "sensor", group: G }),
    I("CH_RUN", "X0.4", "%I0.4", "Oil chiller running (feedback contact)", "chiller X1:3", false, { ui: "sensor", group: G }),
    I("CH_FLT", "X0.5", "%I0.5", "Oil chiller fault / trip (e.g. dirty condenser, HP switch) – item 5 NCR", "chiller X1:5", false, { group: F }),
    I("B_MIST", "X0.6", "%I0.6", "Mist extractor running OK (Δp switch)", "-BP2", false, { ui: "sensor", group: G }),
    I("CNC_RDY", "X0.7", "%I0.7", "CNC ready (auto mode, no alarm) – CNC PLC output", "CNC -X20.0", true, { group: F }),
    I("CNC_CYC", "X0.8", "%I1.0", "CNC cycle running", "CNC -X20.1", false, { ui: "sensor", group: G }),
    I("CNC_FINREQ", "X0.9", "%I1.1", "CNC M61: 'finish pass – permission?' (the CNC waits for FIN_OK)", "CNC -X20.2", false, { ui: "sensor", group: G }),
    I("CNC_END", "X0.10", "%I1.2", "CNC M30 program end (pulse ≥ 200 ms)", "CNC -X20.3", false, { ui: "sensor", group: G }),
    I("CNC_DRESSED", "X0.11", "%I1.3", "CNC: dressing sub-program finished", "CNC -X20.4", false, { ui: "sensor", group: G }),
    I("B_FLOW", "X0.12", "%I1.4", "Grinding oil flow OK (flow switch)", "-BF1", true, { group: F }),
    I("B_RAW", "X0.13", "%I1.5", "Raw part ready in the loader buffer", "loader -KF20 DO2", true, { ui: "sensor", group: G }),
    AI("OIL_T", "D300 (AS04RTD-A ch1, 0.01 °C)", "%IW96 (SM 1231 RTD ch0) → \"Tgr\".OilT", "Grinding oil temperature at the machine inlet (PT100, 4-wire)", "°C", 15, 30, SP, "-BT1 PT100 4-wire", { ui: "sensor", inc: 0.01 }),
    Q("Y_LDREQ", "Y0.0", "%Q0.0", "Loader: start exchange (unload finished part, load raw part)", "loader -KF20 DI1"),
    Q("Y_DOPEN", "Y0.1", "%Q0.1", "Door open valve -MB1", "-MB1"),
    Q("Y_DCLOSE", "Y0.2", "%Q0.2", "Door close valve -MB2 (door safety: guard locking on the safety relay)", "-MB2"),
    Q("Y_CLAMP", "Y0.3", "%Q0.3", "Tailstock clamp valve -MB3", "-MB3"),
    Q("Y_CHILL", "Y0.4", "%Q0.4", "Oil chiller cooling ON (compressor release)", "chiller X1:1"),
    Q("Y_PUMP", "Y0.5", "%Q0.5", "Grinding oil pump contactor -QA1", "-QA1"),
    Q("Y_MIST", "Y0.6", "%Q0.6", "Mist extractor contactor -QA2", "-QA2"),
    Q("Y_CYSTART", "Y0.7", "%Q0.7", "To CNC: cycle start (pulse)", "CNC -X21.0"),
    Q("Y_FINOK", "Y0.8", "%Q1.0", "To CNC: finish pass permitted (answer to M61 = MFIN)", "CNC -X21.1"),
    Q("Y_FHOLD", "Y0.9", "%Q1.1", "To CNC: feed hold (oil temperature out of ± 1 K)", "CNC -X21.2"),
    Q("Y_DRESS", "Y0.10", "%Q8.0", "To CNC: dress the wheel before the next part (M62 sub-program)", "CNC -X21.3"),
    M("ST0", "M0", "\"Tgr\".Step0", "Step 0 – wait", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Tgr\".Step1", "Step 1 – open door", false, { step: true, stepLabel: "1 door open" }),
    M("ST2", "M2", "\"Tgr\".Step2", "Step 2 – loader exchange", false, { step: true, stepLabel: "2 loader" }),
    M("ST3", "M3", "\"Tgr\".Step3", "Step 3 – clamp + close door", false, { step: true, stepLabel: "3 clamp + close" }),
    M("ST4", "M4", "\"Tgr\".Step4", "Step 4 – dress (if requested)", false, { step: true, stepLabel: "4 dress" }),
    M("ST5", "M5", "\"Tgr\".Step5", "Step 5 – CNC cycle start", false, { step: true, stepLabel: "5 start" }),
    M("ST6", "M6", "\"Tgr\".Step6", "Step 6 – grinding (rough, M61, finish)", false, { step: true, stepLabel: "6 grinding" }),
    M("M_INCYC", "M10", "\"Tgr\".InCycle", "In cycle"),
    M("M_PDONE", "M11", "\"Tgr\".PartDone", "Part done – one scan (rising edge of CNC_END)"),
    M("M_POK", "M12", "\"Tgr\".PartOk", "Part OK (no hold during the finish pass, gauge OK)"),
    M("M_ALM", "M13", "\"Tgr\".Alarm", "Any alarm"),
    M("M_DRQ", "M14", "\"Tgr\".DressReq", "Dressing requested (every 5 parts)"),
    M("W_OIL", "M15", "\"Tgr\".WarnOil", "Warning 213: |oil − 20.0 °C| > 0.5 K → no finish pass (NCR action)"),
    M("W_CHILL", "M16", "\"Tgr\".WarnChiller", "Warning: chiller tripped – temperature will drift"),
    M("W_MIST", "M17", "\"Tgr\".WarnMist", "Warning: mist extractor not OK → no new cycle"),
    M("M_HOLDP", "M18", "\"Tgr\".HoldInPart", "Feed hold happened during this part → part to inspection (NOK)"),
    M("M_OILHI", "M19", "\"Tgr\".OilOut1K", "|oil − 20.0 °C| > 1.0 K"),
    M("AL_OIL", "M20", "\"Tgr\".AlOil", "Alarm 213: oil temperature > ± 1 K for 10 s → feed hold"),
    M("AL_FLOW", "M21", "\"Tgr\".AlFlow", "Alarm 203: grinding oil flow low"),
    M("AL_TO", "M22", "\"Tgr\".AlTimeout", "Alarm 153: door / loader / clamp / CNC time-out"),
    W("DEV", "D1040 (float)", "\"Tgr\".Dev (Real)", "Oil temperature deviation = OIL_T − 20.0", "K", 0, "REAL"),
    W("SP_OIL", "D1042 (float)", "\"Tgr\".SpOil (Real)", "Oil temperature set point (= measuring room 20 °C)", "°C", SP, "REAL"),
    W("OIL_W", "D1044 (float)", "\"Tgr\".OilT (Real)", "Oil temperature copy for the map", "°C", SP, "REAL"),
    W("DRESS_CNT", "D1046", "\"Tgr\".DressCount", "grind.dressCount – dressing cycles of this wheel", "", 0, "INT"),
    W("WHEEL_D", "D1048 (float)", "\"Tgr\".WheelDia (Real)", "Wheel diameter (−0.05 mm per dressing, example)", "mm", 400, "REAL"),
    W("WSPD", "D1050 (float)", "CNC interface DB / PMC D", "grind.wheelSpeed_ms from the CNC", "m/s", 0, "REAL"),
    W("SPWR", "D1052 (float)", "CNC interface DB / PMC D", "grind.spindlePower_pct from the CNC", "%", 0, "REAL"),
    W("GDEV", "D1054 (float)", "CNC interface DB / PMC D", "grind.gaugeDev_um in-process gauge", "µm", 0, "REAL"),
    W("PASS", "D1056", "CNC interface DB / PMC D", "tgr.pass current pass", "", 0, "INT"),
    W("PASSES", "D1057", "CNC interface DB / PMC D", "tgr.passes per part (5 rough + 1 finish)", "", 6, "INT"),
    W("WRPM", "D1058 (float)", "CNC interface DB / PMC D", "tgr.workSpeed_rpm", "min⁻¹", 0, "REAL"),
    W("LCOMP", "D1060 (float)", "CNC interface DB / PMC D", "tgr.leadComp_um_m lead compensation", "µm/m", -12, "REAL"),
    W("STEMP", "D1062 (float)", "CNC interface DB / PMC D", "tgr.screwTemp_C", "°C", 20, "REAL"),
    W("WTILT", "D1064 (float)", "CNC interface DB / PMC D", "tgr.wheelTilt_deg (lead angle 10 / (π × 32) → 5.68°)", "°", 5.68, "REAL"),
    W("ALM_CODE", "D1000", "\"Tgr\".AlarmCode", "Alarm code for std.alarm", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Machine power (example)", "kW", 0, "REAL"),
    T("T_DOOR", "T0", "\"IDB_T_Door\" (TON)", "Door time-out", 5),
    T("T_LOAD", "T1", "\"IDB_T_Load\" (TON)", "Loader exchange time-out (normal 12 s)", 30),
    T("T_CLMP", "T2", "\"IDB_T_Clmp\" (TON)", "Clamp + door close time-out", 6),
    T("T_DRS", "T3", "\"IDB_T_Drs\" (TON)", "Dressing time-out", 30),
    T("T_START", "T4", "\"IDB_T_Start\" (TON)", "CNC must report 'cycle running' within", 3),
    T("T_OILH", "T5", "\"IDB_T_OilH\" (TON)", "Oil out of ± 1 K longer than → feed hold + alarm 213", T_HOLD),
    T("T_MIST", "T6", "\"IDB_T_Mist\" (TOF)", "Mist extractor run-on after the cycle", 60),
    T("T_MISTOK", "T7", "\"IDB_T_MistOk\" (TON)", "Mist Δp switch must be OK within", 5),
    C("C_DRESS", "C0", "\"IDB_C_Dress\" (CTU)", "Parts since the last dressing (dress every 5)", DRESS_N),
  ];
  const ST = ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"];
  const networks = [
    N("Network 1 – First scan + step 0: wait for start",
      "New part only with Enable (interface), raw part ready, CNC ready, oil flow, mist OK and no alarm. The temperature is NOT a start condition – the CNC roughs anyway; only the finish pass needs the ± 0.5 K band.",
      R(NO("FIRST"), SET("ST0"), ...ST.map(RST)),
      R(S(NO("ST0"), NO("M_ENABLE"), NO("B_RAW"), NO("CNC_RDY"), NO("B_FLOW"), NC("W_MIST"), NC("M_ALM")), SET("ST1"), RST("ST0"), RST("M_HOLDP"))),
    N("Network 2 – Step 1: open the door · step 2: loader exchange",
      "Door open (5 s time-out), then the loader takes the finished screw out and puts the raw screw between the centres (its own controller; handshake REQ / DONE).",
      R(S(NO("ST1"), NO("B_DOOR_OP")), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_DOOR")), SET("AL_TO")),
      R(S(NO("ST2"), NO("B_LDDONE")), SET("ST3"), RST("ST2")),
      R(S(NO("ST2"), TON("T_LOAD")), SET("AL_TO"))),
    N("Network 3 – Step 3: clamp + close the door → dress or start",
      "Tailstock clamps, door closes. If the dressing counter asks for it → step 4 dress, else step 5 start.",
      R(S(NO("ST3"), NO("B_CLAMPED"), NO("B_DOOR_CL"), NO("M_DRQ")), SET("ST4"), RST("ST3")),
      R(S(NO("ST3"), NO("B_CLAMPED"), NO("B_DOOR_CL"), NC("M_DRQ")), SET("ST5"), RST("ST3")),
      R(S(NO("ST3"), TON("T_CLMP")), SET("AL_TO"))),
    N("Network 4 – Step 4: dress the wheel (every 5 parts)",
      "The CNC runs its dressing sub-program (M62). When done: dressing counter +1 (grind.dressCount), wheel Ø −0.05 mm, the part counter of the counter box is reset.",
      R(S(NO("ST4"), NO("CNC_DRESSED")), CALC("DRESS_CNT+1", "DRESS_CNT"), CALC("WHEEL_D-0.05", "WHEEL_D"), RST("M_DRQ"), RST("C_DRESS"), SET("ST5"), RST("ST4")),
      R(S(NO("ST4"), TON("T_DRS")), SET("AL_TO"))),
    N("Network 5 – Step 5: CNC cycle start · step 6: grinding",
      "Cycle start as a pulse until the CNC reports 'cycle running' (3 s time-out). The part is finished at the rising edge of M30 (CNC_END).",
      R(S(NO("ST5"), NO("CNC_CYC")), SET("ST6"), RST("ST5")),
      R(S(NO("ST5"), TON("T_START")), SET("AL_TO")),
      R(S(NO("ST6"), PE("CNC_END")), OUT("M_PDONE"), SET("ST0"), RST("ST6"))),
    N("Network 6 – Oil chiller: on / off control with hysteresis (19.9 … 20.2 °C)",
      "The chiller compressor runs above 20.2 °C and stops below 19.9 °C (band 0.3 K – inside the ± 0.5 K process band). A good chiller has its own PID; the PLC then gives the release and monitors. Chiller trip → warning, the temperature will drift.",
      R(S(P(CMP(">", "OIL_T", 20.2), S(NO("Y_CHILL"), CMP(">", "OIL_T", 19.9))), NO("Y_PUMP"), NC("CH_FLT")), OUT("Y_CHILL")),
      R(NO("CH_FLT"), OUT("W_CHILL"))),
    N("Network 7 – Oil temperature band: warning 0.5 K (no finish pass), hold 1 K for 10 s",
      "DEV = OIL_T − 20.0. |DEV| > 0.5 K → warning 213: the finish pass is NOT permitted (item 5 NCR action – lead error 1 µm per 0.1 K over 1 m of steel, α = 11.5 µm/(m·K)). |DEV| > 1.0 K for 10 s → alarm 213 + feed hold.",
      R(NO("ON"), CALC("OIL_T-SP_OIL", "DEV"), MOV("OIL_T", "OIL_W")),
      R(P(CMP(">", "DEV", WARN), CMP("<", "DEV", -WARN)), OUT("W_OIL")),
      R(P(CMP(">", "DEV", HOLD), CMP("<", "DEV", -HOLD)), OUT("M_OILHI")),
      R(S(NO("M_OILHI"), TON("T_OILH")), SET("AL_OIL"))),
    N("Network 8 – CNC interface: finish-pass permission (M61), feed hold, dress request",
      "M61 in the CNC program waits for FIN_OK. FIN_OK only inside ± 0.5 K and no alarm. Feed hold with alarm 213 or oil flow low; a hold during the part → part to inspection (NOK).",
      R(S(NO("CNC_FINREQ"), NC("W_OIL"), NC("M_ALM")), OUT("Y_FINOK")),
      R(P(NO("AL_OIL"), NO("AL_FLOW")), OUT("Y_FHOLD")),
      R(S(NO("Y_FHOLD"), NO("ST6")), SET("M_HOLDP")),
      R(NO("ST4"), OUT("Y_DRESS"))),
    N("Network 9 – Dressing counter (every 5 parts)",
      "CTU counts the part-done pulses; at 5 the request bit is set, the dressing happens in step 4 before the next part.",
      R(S(NO("M_PDONE"), CTU("C_DRESS", "FIRST")), SET("M_DRQ"))),
    N("Network 10 – Outputs: door, loader, clamp, pump, cycle start",
      "Door opens only in step 1 – 2 and when the CNC cycle is not running. Loader only with the door open. Pump runs in AUTO (oil circulates through the chiller all the time – stable temperature).",
      R(S(P(NO("ST1"), NO("ST2")), NC("CNC_CYC")), OUT("Y_DOPEN")),
      R(P(NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6")), OUT("Y_DCLOSE")),
      R(S(NO("ST2"), NO("B_DOOR_OP")), OUT("Y_LDREQ")),
      R(P(NO("ST3"), NO("ST4"), NO("ST5"), NO("ST6")), OUT("Y_CLAMP")),
      R(S(NO("S_ON"), NO("S_AUTO")), OUT("Y_PUMP")),
      R(S(NO("ST5"), NC("CNC_CYC"), NO("CNC_RDY")), OUT("Y_CYSTART"))),
    N("Network 11 – Mist extraction (run-on 60 s, Δp monitoring)",
      "The extractor runs with the grinding cycle and 60 s after it (oil mist settles). Δp switch not OK within 5 s → warning, no new cycle (the running part is finished).",
      R(S(NO("CNC_CYC"), TOF("T_MIST")), OUT("Y_MIST")),
      R(S(NO("Y_MIST"), NC("B_MIST"), TON("T_MISTOK")), SET("W_MIST")),
      R(S(NO("M_ACKP"), NO("B_MIST")), RST("W_MIST"))),
    N("Network 12 – Alarms + part result + code",
      "Oil flow low (alarm 203) after 1 scan in cycle. Part OK = no feed hold during the part. Code priority: 153 < 203 < 213.",
      R(S(NO("M_INCYC"), NC("B_FLOW")), SET("AL_FLOW")),
      R(S(NO("M_ACKP"), NC("M_OILHI")), RST("AL_OIL")),
      R(S(NO("M_ACKP"), NO("B_FLOW")), RST("AL_FLOW")),
      R(NO("M_ACKP"), RST("AL_TO")),
      R(P(NO("AL_OIL"), NO("AL_FLOW"), NO("AL_TO")), OUT("M_ALM")),
      R(NC("M_HOLDP"), OUT("M_POK")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")), R(NO("AL_TO"), MOV(153, "ALM_CODE")), R(NO("AL_FLOW"), MOV(203, "ALM_CODE")), R(NO("AL_OIL"), MOV(213, "ALM_CODE"))),
    N("Network 13 – In cycle + power",
      "Power example: base 4 kW (pump, chiller fan, hydraulics), + chiller 5 kW, + grinding 18 kW.",
      R(P(...ST.map(NO)), OUT("M_INCYC")),
      R(NO("ON"), MOV(4, "P_KW")),
      R(NO("Y_CHILL"), MOV(9, "P_KW")),
      R(S(NO("CNC_CYC"), NC("Y_CHILL")), MOV(22, "P_KW")),
      R(S(NO("CNC_CYC"), NO("Y_CHILL")), MOV(27, "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "B_RAW", power: "P_KW" };
  const process = [["grind.wheelSpeed_ms", "WSPD"], ["grind.spindlePower_pct", "SPWR"], ["grind.dressCount", "DRESS_CNT"], ["grind.wheelDia_mm", "WHEEL_D"], ["grind.oilTemp_C", "OIL_W"], ["grind.gaugeDev_um", "GDEV"],
    ["tgr.pass", "PASS"], ["tgr.passes", "PASSES"], ["tgr.workSpeed_rpm", "WRPM"], ["tgr.leadComp_um_m", "LCOMP"], ["tgr.screwTemp_C", "STEMP"], ["tgr.wheelTilt_deg", "WTILT"]];
  let dpos = 0, cl = delayBit(1, 0.5), ldT = 0, cnc = 0, cT = 0, endT = 0, drT = 0, chRun = delayBit(1, 1), mist = delayBit(2, 1);
  const plant = {
    freeze: false,
    step(st, dt) {
      if (st.Y_DOPEN) dpos = Math.min(1, dpos + dt / 2); else if (st.Y_DCLOSE) dpos = Math.max(0, dpos - dt / 2);
      st.B_DOOR_OP = dpos >= 0.999; st.B_DOOR_CL = dpos <= 0.001;
      st.B_CLAMPED = cl(!!st.Y_CLAMP, dt);
      if (st.Y_LDREQ) { ldT += dt; if (ldT >= 12) st.B_LDDONE = true; } else { ldT = 0; st.B_LDDONE = false; }
      st.CH_RUN = chRun(!!st.Y_CHILL && !st.CH_FLT, dt);
      st.B_MIST = mist(!!st.Y_MIST, dt);
      // CNC: 0 idle, 1 rough, 2 waiting for FIN_OK, 3 finish
      if (cnc === 0 && st.Y_CYSTART && st.CNC_RDY) { cnc = 1; cT = 0; }
      if (cnc === 1) { cT += dt; st.PASS = Math.min(5, 1 + Math.floor(cT / (ROUGH / 5))); if (cT >= ROUGH) { cnc = 2; } }
      if (cnc === 2) { st.CNC_FINREQ = true; if (st.Y_FINOK) { cnc = 3; cT = 0; st.CNC_FINREQ = false; st.PASS = 6; } }
      if (cnc === 3 && !st.Y_FHOLD) { cT += dt; if (cT >= FINISH) { cnc = 0; endT = 0.3; } }
      if (endT > 0) { endT -= dt; st.CNC_END = true; } else st.CNC_END = false;
      st.CNC_CYC = cnc > 0;
      if (st.Y_DRESS && !st.CNC_CYC) { drT += dt; if (drT >= 8) st.CNC_DRESSED = true; } else { drT = 0; st.CNC_DRESSED = false; }
      const grinding = cnc === 1 || cnc === 3;
      st.WSPD = grinding ? 45 : 0; st.SPWR = grinding ? (cnc === 1 ? 62 : 28) : 0; st.WRPM = grinding ? (cnc === 1 ? 24 : 12) : 0;
      st.GDEV = grinding ? (cnc === 1 ? 20 - 4 * (st.PASS || 0) : 0.8) : 0; st.STEMP = lag(st.STEMP || 20, st.OIL_T + (grinding ? 0.3 : 0), 30, dt);
      // oil temperature: + HEAT K/s while the pump runs, chiller removes COOL K/s (simulated ≈ 20 × faster than a real 300 l tank)
      if (!plant.freeze) st.OIL_T = st.OIL_T + ((st.Y_PUMP ? HEAT : 0) - (st.CH_RUN ? COOL : 0) + (21 - st.OIL_T) * 0.0005) * dt;
    },
    reset(st) { dpos = 0; cl.reset(); chRun.reset(); mist.reset(); ldT = 0; cnc = 0; cT = 0; endT = 0; drT = 0; Object.assign(st, { OIL_T: SP, B_DOOR_CL: true, B_DOOR_OP: false, STEMP: 20 }); },
    info: () => ({ cnc }),
  };
  return { tags, networks, hooks, process, plant };
}

export function panel(st, info, U) {
  const step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5", "ST6"].find((s) => st[s]) || "–";
  const dev = (+st.OIL_T || 0) - SP;
  return U.gauge("Grinding oil temperature", `${(+st.OIL_T || 0).toFixed(2)} °C`, `${U.bar(st.OIL_T, 18.5, 21.5, [19.0, 19.5, 19.9, 20.2, 20.5, 21.0])}<small>Δ ${dev >= 0 ? "+" : ""}${dev.toFixed(2)} K · chiller ${U.onoff(st.Y_CHILL, "cooling")} ${st.CH_FLT ? '<span class="bf8-bad">TRIP</span>' : ""} · ${st.W_OIL ? '<span class="bf8-bad">> 0.5 K: no finish</span>' : "in band"}${st.AL_OIL ? ' · <span class="bf8-bad">HOLD</span>' : ""}</small>`)
    + U.gauge("CNC", ["idle", "rough", "M61 waiting", "finish"][info.cnc] || "–", `<small>pass ${st.PASS || 0} / ${st.PASSES} · FIN_OK ${U.onoff(st.Y_FINOK, "1", "0")} · feed hold ${U.onoff(st.Y_FHOLD, "1", "0")} · step ${step}</small>`)
    + U.gauge("Wheel + dressing", `Ø ${(+st.WHEEL_D || 0).toFixed(2)} mm`, `<small>dressings ${st.DRESS_CNT || 0} · parts since ${st.C_DRESS ? st.C_DRESS.CV : 0} / ${DRESS_N} · ${U.onoff(st.M_DRQ, "dress requested", "no request")} · mist ${U.onoff(st.Y_MIST, "on")}</small>`);
}

export const TRY = [
  "Watch a part: door open → loader 12 s → clamp + close → CNC rough 40 s → <b>M61</b> asks for the finish pass → FIN_OK (oil in band) → finish 20 s → M30. The chiller cycles between 19.9 and 20.2 °C.",
  "Click <b>CH_FLT</b> (chiller trip – the item-5 NCR): the oil warms 0.02 K/s. After ≈ 25 s |Δ| > 0.5 K → warning 213, M61 waits (no finish pass). After ≈ 50 s > 1 K + 10 s → alarm 213, feed hold, the part goes to inspection.",
  "Every 5 parts the wheel is dressed before the next part (dressCount, wheel Ø −0.05 mm) – registers grind.dressCount / wheelDia_mm.",
  "Registers 46 – 75: grind + tgr groups (oil temperature, passes, lead compensation …) for the MES trend (item 6).",
];
export const NOTES = {
  io: "Delta: X0.0 … X0.13, Y0.0 … Y0.10 (AS332T-A 16 DI / 16 DO on board), AS04RTD-A for the PT100. Siemens 1215C: 14 DI on board + SM 1223 DI 8 / DQ 8 (%I8.x / %Q8.x), SM 1231 RTD 4 × 16 bit for the PT100 (0.1 °C – choose the 'climate' range 0.01 °C if available, check). CNC interface: 24 V bits to the CNC's PLC (Fanuc PMC X/Y, SINUMERIK PLC) – agree the M-codes with the machine maker.",
  timing: [["door open / close", "2 s each"], ["loader exchange", "12 s"], ["clamp", "1 s"], ["rough (5 passes)", "40 s (example – real ≈ minutes)"], ["finish (1 pass)", "20 s"], ["dressing", "8 s every 5 parts"], ["cycle (hand)", "2 + 12 + 1 + 2 + 40 + 20 ≈ 77 s + scan delays"], ["chiller hysteresis", "19.9 … 20.2 °C"], ["drift after a chiller trip", "0.02 K/s (simulated) → 0.5 K after 25 s, 1 K after 50 s, hold at 60 s"], ["lead error per K (1 m steel)", "11.5 µm/(m·K) × 1 m × 1 K = 11.5 µm"]],
  wiring: ["PT100 4-wire to the RTD module (no transmitter: better resolution and no drift); sensor in the oil inlet of the machine.", "Chiller: release (contact) + running + fault contacts; a chiller with Modbus TCP gives set point and actual value as registers (the PLC is then a Modbus client – MB_CLIENT / Delta Modbus TCP client, check).", "CNC interface: opto-coupled 24 V bits both ways, common 0 V; the M-code answer (MFIN) only after the condition is true."],
  safety: "The machine door has guard locking on the CNC's safety system / safety relay (spindle and axes in safe stop before the door opens); the loader zone has its own fence + safety relay. The PLC only commands door open / close and reads the position switches. Oil mist: fire risk (grinding oil, sparks) – CO₂ extinguishing system in the enclosure (check with the insurer).",
  plcWhy: "S7-1200 1215C / Delta AS332T-A as the 'cell PLC' next to the CNC (the CNC maker's PLC keeps the machine functions). Alternative: put this logic into the CNC's PLC – then the CNC maker programs it and the Modbus TCP server of the map (purchase specification, guide 43 §8.6).",
};

export function selfTest({ runEngine, ok, near }) {
  const T = runEngine({ KEY, TYPE, MID, LOTQTY: 3, RECIPE, PART, TITLE, PLC, build }, { auto: true });
  const { a, E, until } = T, HR = a.img.HR;
  E.run(1); ok("tgr: header unit 15, type 12", HR[2] === 15 && HR[1] === 12, `unit ${HR[2]}, type ${HR[1]}`);
  until(() => E.state.GOOD + E.state.SCRAP >= 1, 200); E.scan();
  const c1 = a.img.get("std.lastCycle_s");
  ok("tgr: cycle ≈ 77 s (door 2 + loader 12 + clamp 1 + door 2 + rough 40 + finish 20) = std.lastCycle_s", near(c1, 77, 1), `${(+c1).toFixed(2)} s`);
  /* chiller trip from exactly 20.00 °C during the next cycle */
  until(() => E.bit("ST6"), 40);
  a.meta.plant.freeze = false; E.state.OIL_T = 20.0; E.set("CH_FLT", true);
  const tW = until(() => E.bit("W_OIL"), 60), tH = until(() => E.bit("AL_OIL"), 60) + tW;
  ok("tgr: chiller trip at 20.00 °C, +0.02 K/s → warning 213 (> 0.5 K) after ≈ 25 s", near(tW, 25, 0.6), `${tW.toFixed(2)} s, oil ${E.num("OIL_T").toFixed(2)} °C`);
  ok("tgr: > 1 K at ≈ 50 s + 10 s → alarm 213 + feed hold at ≈ 60 s", near(tH, 60, 1.2) && E.bit("Y_FHOLD") && HR[7] === 213, `${tH.toFixed(2)} s, std.alarm ${HR[7]}`);
  ok("tgr: no finish pass permission while > 0.5 K", !E.bit("Y_FINOK"));
  E.set("CH_FLT", false); E.state.OIL_T = 20.0; E.run(0.2); E.set("S_ACK", true); E.run(0.1); E.set("S_ACK", false);
  until(() => E.state.GOOD + E.state.SCRAP >= 2, 120);
  ok("tgr: the held part is NOK (scrap / inspection), oil back in band, alarm cleared", E.state.SCRAP === 1 && HR[7] === 0, `good ${E.state.GOOD}, scrap ${E.state.SCRAP}`);
  ok("tgr: register grind.oilTemp_C = PLC value", near(a.img.get("grind.oilTemp_C"), E.num("OIL_T"), 0.05), `${a.img.get("grind.oilTemp_C")}`);
}
