/* Item 8 – program 6: RUN-IN STATION + AGV TRANSFER PORT, AS-RUN-01 (run-in stand, type code 37).
 * The AGV brings an assembled ball screw on a carrier to the port (E84-style handshake), the station takes it in, lifts it, reads the
 * serial number from the RFID tag (RFID reader = Modbus TCP server, the PLC is the client: MB_CLIENT / Delta Modbus TCP client), clamps,
 * runs the nut in (±300 min⁻¹, 60 s) with torque monitoring, lowers and sends the carrier back to the port; the AGV picks it up.
 * E84 bits: the AGV talks HTTP to the fleet manager; at the station the handshake bits come from an optical PIO / a remote I/O module
 * with a REST API that the fleet manager switches – on the PLC side they are plain digital inputs / outputs (24 V). One port, one carrier.
 * All addresses, times and values are EXAMPLES – check with your PLC configuration, the AGV maker and SEMI E84 (timing values – check). */
import { I, Q, M, AI, AQ, W, T, NO, NC, PE, CMP, TON, S, P, OUT, SET, RST, CALC, MOV, R, N, delayBit } from "./bsfplc_lib.js";

export const KEY = "run", TYPE = "AS-RUN", MID = "AS-RUN-01", LOTQTY = 3, RECIPE = 30, PART = "FABS-3210-1000-C5";
export const TITLE = "Run-in station + AGV transfer port (E84-style handshake) – AS-RUN-01";
export const PLC = { delta: { cpu: "AS332T-A + AS04AD-A + ASDA-B3", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1200 CPU 1215C + SM 1223 + V90 PN", sw: "TIA Portal V19" } };
export const BTN = "6 · Run-in + AGV transfer (E84)";
export const BASIS = "item 3 AGV transport (fleet manager over HTTP, VDA 5050 ideas) · SEMI E84 handshake idea (check) · torque group of item 4 · run-in 60 s at ±300 min⁻¹ (example)";
export const T_RUNIN = 60, T_XFER = 3, T_CONV = 2.5, T_LIFT = 1.5;

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function build() {
  const G = "Station sensors (from the plant – click = force)", A = "AGV → station (E84 inputs)", F = "Faults + signals (click to simulate)";
  const tags = [
    I("B_PORT", "X0.0", "%I0.0", "Carrier on the AGV port (end of the port rollers, -BG1)", "-BG1", false, { ui: "sensor", group: G }),
    I("B_LIFTPOS", "X0.1", "%I0.1", "Carrier at the lift position (-BG2)", "-BG2", false, { ui: "sensor", group: G }),
    I("B_LIFTUP", "X0.2", "%I0.2", "Lift up (-BG3)", "-BG3", false, { ui: "sensor", group: G }),
    I("B_LIFTDN", "X0.3", "%I0.3", "Lift down (-BG4)", "-BG4", true, { ui: "sensor", group: G }),
    I("B_CLAMPED", "X0.4", "%I0.4", "Screw clamped in the run-in chuck (-BG5)", "-BG5", false, { ui: "sensor", group: G }),
    I("AX_RDY", "X0.5", "%I0.5", "Run-in servo ready", "-TA1 DO1", true, { group: F }),
    I("B_GUARD", "X0.6", "%I0.6", "Guard / light curtain of the station clear – STATUS from the safety relay", "-KF1 13/14", true, { group: F }),
    I("E_VALID", "X0.7", "%I0.7", "E84 VALID from the AGV (transfer request valid)", "PIO pin 1 (optical / remote I/O)", false, { ui: "sensor", group: A }),
    I("E_CS0", "X0.8", "%I1.0", "E84 CS_0 carrier stage 0 selected", "PIO pin 2", false, { ui: "sensor", group: A }),
    I("E_TRREQ", "X0.9", "%I1.1", "E84 TR_REQ transfer request", "PIO pin 4", false, { ui: "sensor", group: A }),
    I("E_BUSY", "X0.10", "%I1.2", "E84 BUSY – transfer in progress", "PIO pin 5", false, { ui: "sensor", group: A }),
    I("E_COMPT", "X0.11", "%I1.3", "E84 COMPT – transfer complete", "PIO pin 6", false, { ui: "sensor", group: A }),
    AI("TORQUE", "D300 (AS04AD-A ch1)", "%IW96 (SM 1231 ch0)", "Run-in torque (reaction torque sensor ±2 N·m)", "N·m", -2, 2, 0, "-BT1 ±10 V", { ui: "sensor", inc: 0.001 }),
    Q("Y_CONV_IN", "Y0.0", "%Q0.0", "Port + station rollers towards the lift", "-QA1 FWD"),
    Q("Y_CONV_OUT", "Y0.1", "%Q0.1", "Port + station rollers towards the port / AGV", "-QA1 REV"),
    Q("Y_LIFTUP", "Y0.2", "%Q0.2", "Lift up valve -MB1", "-MB1"),
    Q("Y_LIFTDN", "Y0.3", "%Q0.3", "Lift down valve -MB2", "-MB2"),
    Q("Y_CLAMP", "Y0.4", "%Q0.4", "Run-in chuck clamp -MB3", "-MB3"),
    Q("Y_SVON", "Y0.5", "%Q0.5", "Run-in servo enable", "-TA1 DI1"),
    Q("E_LREQ", "Y0.6", "%Q0.6", "E84 L_REQ – port ready to be LOADED by the AGV", "PIO pin 9"),
    Q("E_UREQ", "Y0.7", "%Q0.7", "E84 U_REQ – port ready to be UNLOADED by the AGV", "PIO pin 10"),
    Q("E_READY", "Y0.8", "%Q1.0", "E84 READY – station ready for the transfer", "PIO pin 12"),
    Q("E_HOAVBL", "Y0.9", "%Q1.1", "E84 HO_AVBL – hand-off available (station in AUTO, no alarm)", "PIO pin 14"),
    Q("E_ES", "Y0.10", "%Q8.0", "E84 ES – 1 = no emergency (0 → the AGV stops the transfer at once)", "PIO pin 15"),
    AQ("SV_SPD", "D320 → ASDA-B3 speed command", "\"AxRun\" MC_MoveVelocity.Velocity", "Run-in speed ±300 min⁻¹ (direction changes every 10 s)", "min⁻¹", -400, 400, "-TA1"),
    M("ST0", "M0", "\"Run\".Step0", "Step 0 – wait for a raw carrier on the port", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Run\".Step1", "Step 1 – carrier in to the lift", false, { step: true, stepLabel: "1 in" }),
    M("ST2", "M2", "\"Run\".Step2", "Step 2 – lift up", false, { step: true, stepLabel: "2 lift up" }),
    M("ST3", "M3", "\"Run\".Step3", "Step 3 – read RFID (serial no.)", false, { step: true, stepLabel: "3 RFID" }),
    M("ST4", "M4", "\"Run\".Step4", "Step 4 – clamp + run-in 60 s", false, { step: true, stepLabel: "4 run-in" }),
    M("ST5", "M5", "\"Run\".Step5", "Step 5 – unclamp + lift down", false, { step: true, stepLabel: "5 lift down" }),
    M("ST6", "M6", "\"Run\".Step6", "Step 6 – carrier out to the port → AGV pick-up", false, { step: true, stepLabel: "6 out" }),
    M("M_INCYC", "M10", "\"Run\".InCycle", "In cycle"),
    M("M_PDONE", "M11", "\"Run\".PartDone", "Part done – one scan"),
    M("M_POK", "M12", "\"Run\".PartOk", "Run-in torque OK"),
    M("M_ALM", "M13", "\"Run\".Alarm", "Any alarm"),
    M("M_RAW", "M14", "\"Run\".RawOnPort", "A raw carrier (from the AGV) is on the port"),
    M("M_FIN", "M15", "\"Run\".FinOnPort", "A finished carrier waits on the port for the AGV (→ status BLOCKED)"),
    M("M_PEMPTY", "M16", "\"Run\".PortEmpty", "Port empty and the station idle → may be loaded"),
    M("M_DIR", "M17", "\"Run\".Dir", "Run-in direction (toggles every 10 s)"),
    M("M_DIRP", "M18", "\"Run\".DirPulse", "Direction change pulse"),
    M("M_RFREQ", "M19", "\"MB_CLIENT_DB\".REQ / Delta Modbus client trigger", "RFID read request (Modbus TCP client, FC03 to the reader, 2 registers serial no.)"),
    M("RF_DONE", "M20", "\"MB_CLIENT_DB\".DONE", "RFID read done (from the Modbus client instruction)"),
    M("AL_E84", "M21", "\"Run\".AlE84", "Alarm 153: E84 transfer time-out (READY → COMPT > 30 s)"),
    M("AL_TQ", "M22", "\"Run\".AlTorque", "Alarm 701: run-in torque sensor over range"),
    M("AL_TO", "M23", "\"Run\".AlTimeout", "Alarm 153: step time-out (conveyor, lift, RFID)"),
    W("RF_SNIN", "D400 (Modbus client receive buffer)", "\"RfidData\".Serial", "Serial number read from the tag (2 words → DInt)", "", 0, "DINT"),
    W("SN", "D1072 (32 bit)", "\"Run\".Serial (DInt)", "Serial number of the screw on the station", "", 0, "DINT"),
    W("T_SUM", "D1044 (float)", "\"Run\".Sum (Real)", "Torque sum", "N·m", 0, "REAL"),
    W("T_N", "D1046", "\"Run\".N", "Samples", "", 0, "INT"),
    W("T_MAX", "D1048 (float)", "\"Run\".TMax (Real)", "Torque maximum (absolute)", "N·m", 0, "REAL"),
    W("TQA", "D1050 (float)", "\"Run\".TqAbs (Real)", "|torque| (direction changes)", "N·m", 0, "REAL"),
    W("T_MEAN", "D1052 (float)", "\"Run\".Mean (Real)", "Mean run-in torque", "N·m", 0, "REAL"),
    W("T_VAR", "D1054 (float)", "\"Run\".Var (Real)", "Max − mean", "N·m", 0, "REAL"),
    W("DRAG", "D1062 (float)", "\"Run\".Drag (Real)", "not used on this station (0)", "N", 0, "REAL"),
    W("RES", "D1070", "\"Run\".Result", "torque.result 1 OK, 2 NOK", "", 0, "INT"),
    W("CLS", "D1071", "\"Run\".Class", "torque.cls (preload class from the order)", "", 1, "INT"),
    W("ALM_CODE", "D1000", "\"Run\".AlarmCode", "Alarm code", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Power (example)", "kW", 0, "REAL"),
    T("T_IN", "T0", "\"IDB_T_In\" (TON)", "Conveyor time-out", 8),
    T("T_LIFTTO", "T1", "\"IDB_T_LiftTo\" (TON)", "Lift time-out", 5),
    T("T_RF", "T2", "\"IDB_T_Rf\" (TON)", "RFID time-out", 3),
    T("T_RUN", "T3", "\"IDB_T_Run\" (TON)", "Run-in time", T_RUNIN),
    T("T_DIR", "T4", "\"IDB_T_Dir\" (TON)", "Direction change period", 10),
    T("T_E84", "T5", "\"IDB_T_E84\" (TON)", "E84 transfer time-out READY → COMPT (example 30 s – check TP3 / TP4 of SEMI E84)", 30),
  ];
  const ST = ["ST1", "ST2", "ST3", "ST4", "ST5", "ST6"];
  const networks = [
    N("Network 1 – First scan + step 0: raw carrier on the port → take it in",
      "Start when a raw carrier is on the port, no E84 transfer is active (VALID = 0), Enable from the interface and no alarm.",
      R(NO("FIRST"), SET("ST0"), ...ST.map(RST)),
      R(S(NO("ST0"), NO("M_RAW"), NO("B_PORT"), NC("E_VALID"), NO("M_ENABLE"), NC("M_ALM")), SET("ST1"), RST("ST0"), RST("M_RAW"))),
    N("Network 2 – Step 1: carrier in · step 2: lift up",
      "Rollers towards the lift until the lift sensor, then lift up (the screw comes to the run-in centres).",
      R(S(NO("ST1"), NO("B_LIFTPOS")), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_IN")), SET("AL_TO")),
      R(S(NO("ST2"), NO("B_LIFTUP")), SET("ST3"), RST("ST2")),
      R(S(NO("ST2"), TON("T_LIFTTO")), SET("AL_TO"))),
    N("Network 3 – Step 3: read the serial number from the RFID tag (Modbus TCP client)",
      "The RFID reader is a small Modbus TCP server: the PLC reads 2 registers (FC03) with MB_CLIENT (Siemens) / the Delta Modbus TCP client instruction (check AS manual). DONE → copy the serial no. (it goes with the result to the MES).",
      R(NO("ST3"), OUT("M_RFREQ")),
      R(S(NO("ST3"), NO("RF_DONE")), MOV("RF_SNIN", "SN"), SET("ST4"), RST("ST3"), MOV(0, "T_SUM"), MOV(0, "T_N"), MOV(0, "T_MAX")),
      R(S(NO("ST3"), TON("T_RF")), SET("AL_TO"))),
    N("Network 4 – Step 4: clamp + run-in 60 s, direction change every 10 s",
      "The nut runs back and forth over the stroke (±300 min⁻¹ = ±50 mm/s with lead 10 mm). The direction toggles with a 10 s pulse (XOR rung).",
      R(S(NO("ST4"), NO("B_CLAMPED"), TON("T_RUN")), CALC("T_SUM/T_N", "T_MEAN"), SET("ST5"), RST("ST4")),
      R(S(NO("ST4"), NC("M_DIRP"), TON("T_DIR")), OUT("M_DIRP")),
      R(P(S(NO("M_DIR"), NC("M_DIRP")), S(NC("M_DIR"), NO("M_DIRP"))), OUT("M_DIR"))),
    N("Network 5 – Torque sampling during the run-in (10 Hz)",
      "|torque| because the sign follows the direction. Mean = Σ / n at the end; max − mean = variation. Running-in: the torque falls in the first seconds (grease spreads) – the first 5 s are not sampled.",
      R(NO("ON"), CALC("TORQUE", "TQA")),
      R(CMP("<", "TORQUE", 0), CALC("0-TORQUE", "TQA")),
      R(S(NO("ST4"), NO("B_CLAMPED"), CMP(">", "T_RUN", 5), PE("CLK10")), CALC("T_SUM+TQA", "T_SUM"), CALC("T_N+1", "T_N")),
      R(S(NO("ST4"), CMP(">", "T_RUN", 5), CMP(">", "TQA", "T_MAX")), MOV("TQA", "T_MAX"))),
    N("Network 6 – Step 5: result, unclamp, lift down",
      "OK = mean 0.17 … 0.41 N·m AND max ≤ 0.8 N·m (no tight spot after running in – example limits). Result register 1 / 2.",
      R(PE("ST5"), CALC("T_MAX-T_MEAN", "T_VAR")),
      R(S(PE("ST5"), CMP(">=", "T_MEAN", 0.17), CMP("<=", "T_MEAN", 0.41), CMP("<=", "T_MAX", 0.8)), MOV(1, "RES")),
      R(S(PE("ST5"), P(CMP("<", "T_MEAN", 0.17), CMP(">", "T_MEAN", 0.41), CMP(">", "T_MAX", 0.8))), MOV(2, "RES")),
      R(S(NO("ST5"), NO("B_LIFTDN"), NC("B_CLAMPED")), SET("ST6"), RST("ST5")),
      R(CMP("==", "RES", 1), OUT("M_POK"))),
    N("Network 7 – Step 6: carrier out to the port → part done, wait for the AGV",
      "Rollers towards the port until the port sensor: part done (one scan), the finished carrier waits → M_FIN = status BLOCKED → the MES orders the AGV pick-up over HTTP (fleet manager).",
      R(S(NO("ST6"), NO("B_PORT")), OUT("M_PDONE"), SET("M_FIN"), SET("ST0"), RST("ST6")),
      R(S(NO("ST6"), TON("T_IN")), SET("AL_TO"))),
    N("Network 8 – E84: hand-off available, ES, port empty",
      "HO_AVBL = AUTO, no alarm. ES = 1 means 'no emergency' (it drops with the e-stop chain or an E84 time-out: the AGV stops the transfer). Port empty = may be loaded.",
      R(S(NO("S_AUTO"), NO("S_ON"), NC("M_ALM")), OUT("E_HOAVBL")),
      R(S(NO("ESTOP_OK"), NC("AL_E84")), OUT("E_ES")),
      R(S(NC("B_PORT"), NO("ST0"), NC("M_FIN"), NC("M_RAW")), OUT("M_PEMPTY"))),
    N("Network 9 – E84: L_REQ (load) and U_REQ (unload)",
      "The AGV sets CS_0 + VALID. Port empty → L_REQ; finished carrier on the port → U_REQ. L_REQ goes off when the carrier ARRIVED (port sensor), U_REQ when it LEFT – that is the signal for the AGV to finish.",
      R(S(NO("E_VALID"), NO("E_CS0"), NO("M_PEMPTY"), NO("E_HOAVBL"), NC("E_COMPT")), SET("E_LREQ")),
      R(S(NO("E_LREQ"), NO("E_BUSY"), NO("B_PORT")), RST("E_LREQ"), SET("M_RAW")),
      R(S(NO("E_VALID"), NO("E_CS0"), NO("M_FIN"), NO("B_PORT"), NO("E_HOAVBL"), NC("E_COMPT")), SET("E_UREQ")),
      R(S(NO("E_UREQ"), NO("E_BUSY"), NC("B_PORT")), RST("E_UREQ"), RST("M_FIN")),
      R(NC("E_VALID"), RST("E_LREQ"), RST("E_UREQ"))),
    N("Network 10 – E84: READY and the transfer time-out",
      "READY when TR_REQ comes with L_REQ or U_REQ; READY off at COMPT (or when VALID drops). READY → COMPT longer than 30 s → alarm, ES = 0.",
      R(S(NO("E_TRREQ"), NO("E_VALID"), P(NO("E_LREQ"), NO("E_UREQ")), NC("AL_E84")), SET("E_READY")),
      R(P(NO("E_COMPT"), NC("E_VALID"), NO("AL_E84")), RST("E_READY")),
      R(S(NO("E_READY"), NC("E_COMPT"), TON("T_E84")), SET("AL_E84"))),
    N("Network 11 – Outputs: rollers, lift, clamp, servo, RFID",
      "Rollers in: step 1 OR an E84 load (BUSY + L_REQ + READY). Rollers out: step 6 OR an E84 unload. Never both (the out rung has NC of the in coil).",
      R(P(S(NO("ST1"), NC("E_VALID")), S(NO("E_BUSY"), NO("E_LREQ"), NO("E_READY"))), OUT("Y_CONV_IN")),
      R(S(P(NO("ST6"), S(NO("E_BUSY"), NO("E_UREQ"), NO("E_READY"))), NC("Y_CONV_IN")), OUT("Y_CONV_OUT")),
      R(P(NO("ST2"), NO("ST3"), NO("ST4")), OUT("Y_LIFTUP")),
      R(P(NO("ST5"), NO("ST0"), NO("ST1"), NO("ST6")), OUT("Y_LIFTDN")),
      R(NO("ST4"), OUT("Y_CLAMP")),
      R(S(NO("ST4"), NO("B_CLAMPED"), NO("AX_RDY"), NO("B_GUARD"), NC("M_ALM")), OUT("Y_SVON")),
      R(NO("ON"), MOV(0, "SV_SPD")),
      R(S(NO("Y_SVON"), NC("M_DIR")), MOV(300, "SV_SPD")),
      R(S(NO("Y_SVON"), NO("M_DIR")), MOV(-300, "SV_SPD"))),
    N("Network 12 – Alarms + code + in cycle + power",
      "Torque over range 701; E84 time-out and step time-outs 153. Acknowledge resets.",
      R(S(NO("ST4"), P(CMP(">", "TORQUE", 1.9), CMP("<", "TORQUE", -1.9))), SET("AL_TQ")),
      R(NO("M_ACKP"), RST("AL_TQ"), RST("AL_TO"), RST("AL_E84")),
      R(P(NO("AL_E84"), NO("AL_TQ"), NO("AL_TO")), OUT("M_ALM")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")), R(P(NO("AL_TO"), NO("AL_E84")), MOV(153, "ALM_CODE")), R(NO("AL_TQ"), MOV(701, "ALM_CODE")),
      R(P(...ST.map(NO)), OUT("M_INCYC")),
      R(NO("ON"), MOV(0.5, "P_KW")),
      R(NO("Y_SVON"), MOV(2.2, "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "M_RAW", power: "P_KW" };
  const process = [["torque.torqueMean_Nm", "T_MEAN"], ["torque.torqueVar_Nm", "T_VAR"], ["torque.drag_N", "DRAG"], ["torque.result", "RES"], ["torque.cls", "CLS"]];

  /* plant: carrier, lift, chuck, torque, RFID, and an AGV that follows the E84 sequence */
  let R0 = rng(9), loc = "agv", mvT = 0, lift = 0, cl = delayBit(0.6, 0.4), rfT = 0, sn = 260001, runT = 0, tight = false;
  const agv = { st: "away", t: 0, load: true, log: [] };
  const Lg = (E, s) => { agv.log.push([+E.time.toFixed(2), s]); if (agv.log.length > 200) agv.log.shift(); };
  const plant = {
    agv,
    step(st, dt, E) {
      // ---- carrier movement
      if (loc === "agv" && st.E_BUSY && st.Y_CONV_IN && agv.load) { mvT += dt; if (mvT >= T_XFER) { loc = "port"; mvT = 0; } }
      else if (loc === "port" && st.Y_CONV_IN && !st.E_BUSY) { mvT += dt; if (mvT >= T_CONV) { loc = "lift"; mvT = 0; } }
      else if (loc === "lift" && st.Y_CONV_OUT && lift <= 0.001) { mvT += dt; if (mvT >= T_CONV) { loc = "port"; mvT = 0; } }
      else if (loc === "port" && st.E_BUSY && st.Y_CONV_OUT && !agv.load) { mvT += dt; if (mvT >= 0.5) { loc = "agvx"; mvT = 0; } }
      else if (loc === "agvx") { mvT += dt; if (mvT >= T_XFER - 0.5) { loc = "agv"; mvT = 0; } }
      else if (!(st.Y_CONV_IN || st.Y_CONV_OUT)) mvT = 0;
      st.B_PORT = loc === "port"; st.B_LIFTPOS = loc === "lift";
      if (st.Y_LIFTUP && loc === "lift") lift = Math.min(1, lift + dt / T_LIFT); else if (st.Y_LIFTDN) lift = Math.max(0, lift - dt / T_LIFT);
      st.B_LIFTUP = lift >= 0.999; st.B_LIFTDN = lift <= 0.001;
      st.B_CLAMPED = cl(!!st.Y_CLAMP, dt);
      // ---- RFID reader (Modbus TCP server) answers 0.3 s after the request
      if (st.M_RFREQ) { rfT += dt; if (rfT >= 0.3) { st.RF_DONE = true; st.RF_SNIN = sn; } } else { if (rfT > 0) sn++; rfT = 0; st.RF_DONE = false; }
      // ---- run-in torque: falls while running in, tight spot on some screws
      if (st.Y_SVON) { runT += dt; const base = 0.30 + 0.12 * Math.exp(-runT / 8) + 0.02 * Math.sin(runT * 2.1) + (tight && runT > 30 && runT < 33 ? 0.6 : 0); st.TORQUE = Math.sign(st.SV_SPD || 1) * base; }
      else { st.TORQUE = 0; if (!st.Y_CLAMP) { if (runT > 0) tight = R0() < 0.15; runT = 0; } }
      // ---- AGV (active side of E84)
      agv.t += dt;
      const needLoad = loc === "agv" && st.ST0 && !st.M_FIN && !st.B_PORT, needUnload = loc === "port" && st.M_FIN;
      switch (agv.st) {
        case "away": if (!(needLoad || needUnload)) agv.t = 0; else if (agv.t > 5) { agv.load = needLoad; st.E_CS0 = true; agv.st = "cs"; agv.t = 0; Lg(E, `AGV docked (${agv.load ? "load raw carrier" : "unload finished carrier"}): CS_0 = 1`); } break;
        case "cs": if (agv.t > 0.2) { st.E_VALID = true; agv.st = "valid"; agv.t = 0; Lg(E, "VALID = 1"); } break;
        case "valid": if (agv.load ? st.E_LREQ : st.E_UREQ) { st.E_TRREQ = true; agv.st = "trreq"; agv.t = 0; Lg(E, `${agv.load ? "L_REQ" : "U_REQ"} seen → TR_REQ = 1`); } break;
        case "trreq": if (st.E_READY) { st.E_BUSY = true; agv.st = "busy"; agv.t = 0; Lg(E, "READY seen → BUSY = 1 (rollers run)"); } break;
        case "busy": if ((agv.load ? !st.E_LREQ : !st.E_UREQ) && loc === (agv.load ? "port" : "agv")) { st.E_BUSY = false; st.E_TRREQ = false; st.E_COMPT = true; agv.st = "compt"; agv.t = 0; Lg(E, `${agv.load ? "L_REQ" : "U_REQ"} off + carrier ${agv.load ? "on the port" : "on the AGV"} → BUSY 0, TR_REQ 0, COMPT 1`); } break;
        case "compt": if (!st.E_READY) { st.E_VALID = false; st.E_COMPT = false; st.E_CS0 = false; agv.st = "away"; agv.t = 0; Lg(E, "READY off → VALID 0, COMPT 0, CS_0 0 – AGV leaves"); } break;
        default: break;
      }
      st.B_OUTFULL = !!st.M_FIN;   // finished carrier waiting on the port = out-buffer full → status BLOCKED (the MES calls the AGV)
    },
    reset(st) { R0 = rng(9); loc = "agv"; mvT = 0; lift = 0; cl.reset(); rfT = 0; sn = 260001; runT = 0; tight = false; Object.assign(agv, { st: "away", t: 0, load: true }); agv.log.length = 0; Object.assign(st, { B_LIFTDN: true, B_PORT: false }); },
    info: () => ({ loc, agv: agv.st, lift }),
  };
  return { tags, networks, hooks, process, plant };
}

export function panel(st, info, U) {
  const step = ["ST0", "ST1", "ST2", "ST3", "ST4", "ST5", "ST6"].find((s) => st[s]) || "–";
  const e84 = [["VALID", st.E_VALID], ["CS_0", st.E_CS0], ["TR_REQ", st.E_TRREQ], ["BUSY", st.E_BUSY], ["COMPT", st.E_COMPT], ["L_REQ", st.E_LREQ], ["U_REQ", st.E_UREQ], ["READY", st.E_READY], ["HO_AVBL", st.E_HOAVBL], ["ES", st.E_ES]];
  return U.gauge("Carrier + AGV", `${U.esc(info.loc)} · AGV ${U.esc(info.agv)}`, `<small>port ${U.onoff(st.B_PORT, "occupied", "empty")} · ${st.M_RAW ? "raw carrier" : st.M_FIN ? "finished carrier – waiting for the AGV" : "–"} · lift ${(info.lift * 100).toFixed(0)} % · step ${step}</small>`)
    + U.gauge("E84 signals (AGV ⇄ station)", `${st.E_BUSY ? "transfer" : st.E_VALID ? "AGV docked" : "no AGV"}`, `<small>${e84.map(([n, v]) => `<span class="bf8-chip${v ? " on" : ""}">${n}</span>`).join(" ")}</small>`)
    + U.gauge("Run-in", `${(+st.TORQUE || 0).toFixed(3)} N·m`, `${U.bar(Math.abs(+st.TORQUE || 0), 0, 1, [0.17, 0.41, 0.8])}<small>${(+st.SV_SPD || 0).toFixed(0)} min⁻¹ · t ${st.T_RUN ? st.T_RUN.ET.toFixed(1) : 0} / ${T_RUNIN} s · mean ${(+st.T_MEAN || 0).toFixed(3)} · max ${(+st.T_MAX || 0).toFixed(3)} · SN ${st.SN || "–"} · ${st.RES === 1 ? '<span class="bf8-on">OK</span>' : st.RES === 2 ? '<span class="bf8-bad">NOK</span>' : "–"}</small>`);
}

export const TRY = [
  "Watch the E84 load: the AGV docks (CS_0, VALID) → the port is empty → <b>L_REQ</b> → TR_REQ → <b>READY</b> → BUSY (rollers run 3 s) → carrier on the port → L_REQ off → COMPT → READY off → VALID off, the AGV leaves.",
  "Then the station: in → lift up → RFID serial no. → run-in 60 s (direction every 10 s, torque falls while running in) → lift down → out to the port. The finished carrier = status BLOCKED (bit 5) until the AGV unloads it with <b>U_REQ</b>.",
  "Force <b>E_COMPT</b> off… or tick a sensor during BUSY: after 30 s the E84 time-out alarm drops ES – the AGV stops.",
  "About 1 in 7 screws has a tight spot after 30 s: max > 0.8 N·m → NOK (result 2).",
];
export const NOTES = {
  io: "Delta: X0.0 … X0.11 (station + E84 inputs), Y0.0 … Y0.10, AS04AD-A, ASDA-B3; the RFID reader on Ethernet (Modbus TCP client in the PLC). Siemens: 1215C + SM 1223 (more DQ), MB_CLIENT for the RFID reader (own connection ID!), V90 PN. E84: an optical PIO (8 + 8 bits) or a remote I/O module with REST API switched by the fleet manager – wired to plain DI / DQ of the PLC.",
  timing: [["E84 load: dock → VALID", "0.2 s"], ["L_REQ → TR_REQ → READY", "≤ 1 scan each on the station side (20 ms)"], ["transfer (rollers)", "3 s"], ["COMPT → READY off", "≤ 1 scan"], ["carrier in / out", "2.5 s each"], ["lift up / down", "1.5 s each"], ["RFID read (Modbus TCP)", "≈ 0.3 s"], ["run-in", "60 s, ±300 min⁻¹, direction every 10 s"], ["E84 time-out READY → COMPT (example)", "30 s – check TP3 / TP4 of SEMI E84"], ["cycle without AGV waiting (hand)", "2.5 + 1.5 + 0.3 + 0.6 + 60 + 1.5 + 2.5 ≈ 69 s"]],
  wiring: ["E84 / PIO: 24 V signals, AGV side active (VALID, CS_0, TR_REQ, BUSY, COMPT), station side passive (L_REQ, U_REQ, READY, HO_AVBL, ES). ES is wired NC-style: a broken wire = emergency.", "RFID reader (e.g. Balluff BIS / Pepperl+Fuchs / Siemens RF200 with Modbus TCP – check the protocol option) on the machine VLAN, fixed IP.", "Rollers with a reversing motor (contactor pair with mechanical interlock) or a small VFD."],
  safety: "Station guard / light curtain on the safety relay → servo STO, lift and rollers off. The AGV has its own safety laser scanner (ISO 3691-4). E84 ES is a process stop signal, not a safety function – the AGV's safety system and the station guard do the safety. Check the muting / zone concept at the port with the AGV maker.",
  plcWhy: "S7-1200 1215C / Delta AS332T-A: 12 DI, 11 DO, 1 AI, one servo; the RFID reader on Modbus TCP needs a Modbus CLIENT function in the PLC (MB_CLIENT / Delta Modbus TCP client – check the number of connections).",
};

export function selfTest({ runEngine, ok, near }) {
  const T = runEngine({ KEY, TYPE, MID, LOTQTY: 2, RECIPE, PART, TITLE, PLC, build }, { auto: true });
  const { a, E, until } = T, ag = a.meta.plant.agv;
  const ed = []; let last = {};
  const sig = ["E_CS0", "E_VALID", "E_TRREQ", "E_BUSY", "E_COMPT", "E_LREQ", "E_UREQ", "E_READY"];   // AGV side first (plant), then station side (logic) – the order inside one scan
  const prevOn = E.onScan; E.onScan = (st, e) => { prevOn(st, e); for (const s of sig) { if (!!st[s] !== !!last[s]) ed.push([s, !!st[s], +e.time.toFixed(2)]); last[s] = !!st[s]; } };
  until(() => E.bit("M_RAW"), 30);
  const seq = ed.map(([s, v]) => (v ? "+" : "-") + s.replace("E_", "")).join(" ");
  const tOf = (s, v, from = 0) => { const x = ed.find((e, i) => i >= from && e[0] === s && e[1] === v); return x ? x[2] : NaN; };
  ok("run: E84 load sequence +CS0 +VALID +LREQ +TRREQ +READY +BUSY -LREQ (carrier arrived)", /^\+CS0 \+VALID \+LREQ \+TRREQ \+READY \+BUSY -LREQ/.test(seq), seq);
  until(() => !E.bit("E_VALID"), 5);
  const seq2 = ed.map(([s, v]) => (v ? "+" : "-") + s.replace("E_", "")).join(" ");
  ok("run: … -LREQ, then -TRREQ -BUSY +COMPT, -READY (same scan), -CS0 -VALID -COMPT (AGV leaves)", /^\+CS0 \+VALID \+LREQ \+TRREQ \+READY \+BUSY -LREQ -TRREQ -BUSY \+COMPT -READY -CS0 -VALID -COMPT$/.test(seq2), seq2);
  const dReady = tOf("E_READY", true) - tOf("E_TRREQ", true), dOff = tOf("E_READY", false) - tOf("E_COMPT", true), dX = tOf("E_LREQ", false) - tOf("E_BUSY", true);
  ok("run: READY ≤ 1 scan after TR_REQ, READY off ≤ 1 scan after COMPT, transfer ≈ 3 s", dReady <= 0.021 && dOff <= 0.021 && near(dX, 3.0, 0.1), `${Math.round(dReady * 1000)} ms, ${Math.round(dOff * 1000)} ms, ${dX.toFixed(2)} s`);
  until(() => E.state.GOOD + E.state.SCRAP >= 1, 120); E.scan();
  ok("run: run-in cycle ≈ 69 s (in 2.5 + lift 1.5 + RFID 0.3 + clamp 0.6 + 60 + down 1.5 + out 2.5)", near(a.img.get("std.lastCycle_s"), 69, 1.5), `${(+a.img.get("std.lastCycle_s")).toFixed(2)} s, SN ${E.num("SN")}, mean ${E.num("T_MEAN").toFixed(3)} N·m`);
  E.run(0.1); ok("run: finished carrier waits on the port → std.status 32 (BLOCKED), stateCode 5", a.img.HR[4] === 32 && a.img.HR[6] === 5, `status ${a.img.HR[4]}, state ${a.img.HR[6]}`);
  const n0 = ed.length; until(() => !E.bit("M_FIN"), 30);
  const s3 = ed.slice(n0).map(([s, v]) => (v ? "+" : "-") + s.replace("E_", "")).join(" ");
  ok("run: E84 unload +CS0 +VALID +UREQ +TRREQ +READY +BUSY -UREQ (carrier left)", /^\+CS0 \+VALID \+UREQ \+TRREQ \+READY \+BUSY -UREQ/.test(s3), s3);
  ok("run: registers torque.result + mean", [1, 2].includes(a.img.get("torque.result")) && a.img.get("torque.torqueMean_Nm") > 0.2, `result ${a.img.get("torque.result")}, mean ${a.img.get("torque.torqueMean_Nm")}`);
  void ag;
}
