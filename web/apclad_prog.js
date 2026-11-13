/* APC ladder program (data) + plant model – used by apclad.js with the shared core ladder.js (contract docs/35_contract_ladder.md).
 * Machine: 2-pallet rotary APC of the HMC (APC tab, guide 09). The step chain is EXACTLY the table #apcSeq of web/apc.js:
 *   0 M60 from the NC → 1 door open → 2 unclamp → 3 lift → 4 rotate 180° → 5 lower → 6 clamp → 7 seating air → 8 door close → FIN.
 * Decided design (guide 09 §27, 2026-11-12): lift Ø50/28 at 10 MPa, accumulator band 10.0 / 10.8 / 11.5 MPa,
 * start interlock ≥ 10.7 MPa, alarm < 10.0 MPa, oil ≥ 20 °C. Times = APC page defaults (8.8 s change).
 * PLCs (examples – check with your PLC configuration):
 *   Delta AS300 series AS332T-A (ISPSoft 3.x): X0.0–X0.15 / Y0.0–Y0.15 on the CPU, X1.x / Y1.x on AS16AM10N-A / AS16AN01T-A,
 *     analog AS04AD-A → D100 / D101, timers T (100 ms base, TMR T1 K30 = 3.0 s), counters C, internal bits M.
 *   Siemens S7-1200 CPU 1215C DC/DC/DC (TIA Portal V19): addresses of the APC page (%I20.0 … %Q21.5 on signal modules / ET 200SP,
 *     start address 20), analog %IW64 / %IW66, step bits in "DB_Apc", IEC timers / counters in instance DBs.
 * Safety (e-stop, guard locking, light curtain, STO) is done by the safety relay / F-program – this program only READS the status.
 */

// ---- small helpers to write the trees (they produce exactly the contract format) ----
const NO = (t) => ({ c: "NO", t }), NC = (t) => ({ c: "NC", t }), PE = (t) => ({ c: "P", t });
const S = (...a) => ({ s: a }), P = (...a) => ({ p: a });
const CMP = (cmp, a, b) => ({ cmp, a, b });
const TON = (t) => ({ b: "TON", t }), CTU = (t, r) => ({ b: "CTU", t, r });
const OUT = (t) => ({ o: "OUT", t }), SET = (t) => ({ o: "SET", t }), RST = (t) => ({ o: "RST", t });
const MOV = (v, to) => ({ mov: v, to });
const STEP = (n) => "S" + n;

// ---- step data (from #apcSeq + guide 09 §24.3) ----
export const STEPS = [
  // n, name, nominal s (APC page), watchdog s (2 × nominal), Delta timer
  [1, "Axes to change position, door open", 1.5, 3.0, "T1"],
  [2, "Unclamp the pallet in the machine", 0.8, 1.6, "T2"],
  [3, "Lift the arm with both pallets", 0.8, 1.6, "T3"],
  [4, "Rotate 180°", 2.5, 5.0, "T4"],
  [5, "Lower the arm", 0.8, 1.6, "T5"],
  [6, "Clamp the new pallet", 0.8, 1.6, "T6"],
  [7, "Seating check with air", 0.4, 0.8, "T7"],
  [8, "Close the door, report FIN", 1.2, 2.4, "T8"],
];

const I = (name, delta, siemens, comment, wire, init = false) => ({ name, dir: "I", type: "BOOL", delta, siemens, comment, wire, init });
const Q = (name, delta, siemens, comment, wire) => ({ name, dir: "Q", type: "BOOL", delta, siemens, comment, wire, init: false });
const M = (name, delta, db, comment) => ({ name, dir: "M", type: "BOOL", delta, siemens: `"DB_Apc".${db}`, comment, init: false });

const TAGS = [
  // ---- inputs: APC sensors (guide 09 §4.11) ----
  I("ArmUp", "X0.0", "%I20.0", "Arm up – inductive sensor -BG1", "-BG1 PNP, M12, Sn 4 mm"),
  I("ArmDown", "X0.1", "%I20.1", "Arm down – inductive sensor -BG2", "-BG2 PNP, M12", true),
  I("Arm0deg", "X0.2", "%I20.2", "Arm at 0° – sensor -BG3 on the rotor cam", "-BG3 PNP, M12", true),
  I("Arm180deg", "X0.3", "%I20.3", "Arm at 180° – sensor -BG4 on the rotor cam", "-BG4 PNP, M12"),
  I("PalletInMachine", "X0.4", "%I20.4", "Pallet present on the machine table", "-BG5 PNP, M18", true),
  I("PalletAtStation", "X0.5", "%I20.5", "Pallet present at the load station", "-BG6 PNP, M18", true),
  I("MachineClamped", "X0.6", "%I20.6", "Zero-point modules clamped – 2S1 ≤ 0.5 MPa (vented)", "-BP1 (2S1 out 2)", true),
  I("MachineUnclamped", "X0.7", "%I20.7", "Zero-point modules open – 2S1 ≥ 4.5 MPa", "-BP2 (2S1 out 1)"),
  I("SeatingAirOK", "X0.8", "%I21.0", "Seating check OK – air pressure switch 5S1 (gap < 0.02 mm)", "-BP3 (5S1)"),
  I("APCDoorOpen", "X0.9", "%I21.1", "APC door open – limit switch", "-BG7"),
  I("APCDoorClosed", "X0.10", "%I21.2", "APC door closed + locked (status from the safety relay / F-DI)", "safety relay -KF5 aux. 13/14", true),
  I("StationDoorClosed", "X0.11", "%I21.3", "Load-station door closed (status from the safety relay / F-DI)", "-KF5 aux. 23/24", true),
  I("LightCurtainFree", "X0.12", "%I21.4", "Light curtain free (OSSD status via the safety relay)", "-KF6 aux. 13/14", true),
  I("OperatorReady", "X0.13", "%I21.5", "Operator 'pallet ready' push button (NO) at the load station", "+OP01-SF1 13/14"),
  I("PalletSeatedStation", "X0.14", "%I21.6", "Pallet seated at the load station (station air check)", "-BP4", true),
  I("PumpMotorOK", "X0.15", "%I21.7", "Pump motor running – aux. contact of -QA1 / motor protection -FC1", "-QA1 13/14"),
  I("OilLevelOK", "X1.0", "%I22.0", "Oil level OK – level switch -BL1 (NC = OK, wire-break safe)", "-BL1", true),
  I("FilterClogged", "X1.1", "%I22.1", "Return filter 0Z1 clogged (warning)", "0Z1 switch"),
  I("SafetyOK", "X1.3", "%I22.3", "E-stop chain + safety relay OK (status only – the relay does the safety)", "-KF5 aux. 33/34", true),
  // ---- inputs: CNC interface (M-code handshake) ----
  I("NC_M60", "X1.4", "%I23.0", "NC → PLC: M60 pallet change request (M-code strobe)", "CNC DO, 24 V"),
  I("NC_InPos", "X1.5", "%I23.1", "NC → PLC: axes at change position, B = 0°", "CNC DO", true),
  I("NC_SpindleHome", "X1.6", "%I23.2", "NC → PLC: spindle stopped + oriented (M19), tool retracted, coolant off", "CNC DO", true),
  // ---- inputs: servo drive (Delta: ASDA DO wired, Siemens: PROFIdrive telegram / SINA_POS) ----
  I("Servo_InPos", "X1.7", "%I25.0", "Servo in position (Delta ASDA DO TPOS / Siemens SINA_POS.AxisPosOk)", "-TA1 DO1", true),
  I("Servo_Fault", "X1.8", "%I25.1", "Servo drive fault (Delta ASDA DO ALRM / Siemens SINA_POS.Error)", "-TA1 DO5"),
  // ---- inputs: operator panel ----
  I("S_Auto", "X1.9", "%I24.0", "Mode switch: 1 = automatic, 0 = manual", "+OP01-SF2 key switch", true),
  I("S_Step", "X1.10", "%I24.1", "Single-step mode switch (commissioning / recovery)", "+OP01-SF3"),
  I("S_Next", "X1.11", "%I24.2", "Next step push button (single-step mode)", "+OP01-SF4"),
  I("S_Ack", "X1.12", "%I24.3", "Alarm acknowledge / reset push button", "+OP01-SF5"),
  I("S_Home", "X1.13", "%I24.4", "Abort the sequence (manual mode) – back to step 0", "+OP01-SF6"),
  I("S_JogUp", "X1.14", "%I24.5", "Manual: jog lift up (hold)", "+OP01-SF7"),
  I("S_JogDown", "X1.15", "%I24.6", "Manual: jog lift down (hold)", "+OP01-SF8"),
  I("S_CntReset", "X1.2", "%I24.7", "Key switch: reset the counters (maintenance)", "+OP01-SF9"),
  // ---- analog inputs ----
  { name: "AccuPressure", dir: "AI", type: "REAL", delta: "D100 (AS04AD-A ch1)", siemens: "%IW64", unit: "MPa", min: 0, max: 16, init: 11.2,
    comment: "Accumulator pressure 0B2, 0–16 MPa = 4–20 mA (Delta raw 0–32000, Siemens 0–27648)", wire: "0B2 transmitter, 2-wire" },
  { name: "OilTemp", dir: "AI", type: "REAL", delta: "D101 (AS04AD-A ch2)", siemens: "%IW66", unit: "°C", min: 0, max: 80, init: 35,
    comment: "Oil temperature in the tank, PT100 → 4–20 mA 0–100 °C", wire: "-BT1" },

  // ---- outputs: valves, door, servo, HPU, NC (guide 09 §4.11 + §24.4) ----
  Q("LiftUpValve", "Y0.0", "%Q20.0", "Lift up – 4/3 valve 1V1 solenoid a", "1V1-a 24 V DC, LED + diode"),
  Q("LiftDownValve", "Y0.1", "%Q20.1", "Lift down – 4/3 valve 1V1 solenoid b", "1V1-b 24 V DC"),
  Q("UnclampValve", "Y0.2", "%Q20.2", "Unclamp – 3/2 valve 2V1 (oil → zero-point modules = open)", "2V1 24 V DC"),
  Q("SeatingAir", "Y0.3", "%Q20.3", "Seating-check air – 3/2 valve 5V1", "5V1 24 V DC"),
  Q("DoorOpen", "Y0.4", "%Q20.4", "APC door drive – open", "door drive DI1"),
  Q("DoorClose", "Y0.5", "%Q20.5", "APC door drive – close", "door drive DI2"),
  Q("StationLamp", "Y0.6", "%Q21.1", "Load station green lamp: pallet ready, do not enter", "stack light green"),
  Q("AlarmLamp", "Y0.7", "%Q21.6", "Red lamp + buzzer: APC alarm", "stack light red"),
  Q("ServoEnable", "Y0.8", "%Q25.0", "Servo ON (Delta ASDA DI SON / Siemens SINA_POS.EnableAxis)", "-TA1 DI1"),
  Q("ServoStart", "Y0.9", "%Q25.1", "Start positioning (Delta ASDA DI CTRG / Siemens SINA_POS.ExecuteMode)", "-TA1 DI2"),
  Q("ServoTo180", "Y0.10", "%Q25.2", "Target select: 1 = 180°, 0 = 0° (Delta ASDA DI POS0 / Siemens Position)", "-TA1 DI3"),
  Q("PumpContactor", "Y0.11", "%Q21.2", "Pump motor contactor -QA1 (1.5 kW)", "-QA1 A1/A2 via coupling relay"),
  Q("UnloadValve", "Y0.12", "%Q21.3", "Unloading valve 0V5: energised = pump loads the accumulator", "0V5 24 V DC"),
  Q("BlowOffAir", "Y0.13", "%Q21.4", "Blow-off air: cleans the receiver cones while the arm lowers", "5V2 24 V DC"),
  Q("AccuHold", "Y0.14", "%Q21.5", "Accumulator hold valve: energised = closed, off = drains (ISO 4413)", "0V3 solenoid"),
  Q("NC_FIN", "Y0.15", "%Q23.0", "PLC → NC: FIN (M60 finished)", "CNC DI"),
  Q("NC_Alarm", "Y1.0", "%Q23.1", "PLC → NC: APC alarm (NC feed hold / message)", "CNC DI"),

  // ---- internal bits ----
  M("M_Auto", "M0", "Auto", "Automatic mode active"),
  M("M_Manual", "M1", "Manual", "Manual mode active"),
  M("M_StepMode", "M2", "StepMode", "Single-step mode (each step waits for 'Next')"),
  M("M_TrEn", "M3", "TrEn", "Transition enable: auto running, or 'Next' pressed in single-step mode"),
  M("M_Charge", "M10", "Charge", "Accumulator charging (hysteresis 10.8 / 11.5 MPa)"),
  M("M_PressOK", "M11", "PressOK", "Accumulator ≥ 10.7 MPa = start allowed"),
  M("M_OilWarm", "M12", "OilWarm", "Oil ≥ 20 °C"),
  M("M_FilterWarn", "M13", "FilterWarn", "Warning: filter clogged (change in the next stop)"),
  M("M_StnReady", "M14", "StnReady", "Load station ready (pallet seated + operator pressed 'ready')"),
  M("M_StartOK", "M15", "StartOK", "All start conditions of step 1 TRUE (guide 09 §24.2)"),
  M("M_NoStartMsg", "M16", "NoStartMsg", "Message: M60 waits > 2 s, a start condition is missing"),
  M("M_Dir180", "M17", "Dir180", "Rotation target 180° (arm started at 0°)"),
  M("S0", "M100", "S0", "Step 0 – idle, wait for M60"),
  M("S1", "M101", "S1", "Step 1 – door open, axes at change position"),
  M("S2", "M102", "S2", "Step 2 – unclamp"),
  M("S3", "M103", "S3", "Step 3 – lift"),
  M("S4", "M104", "S4", "Step 4 – rotate 180°"),
  M("S5", "M105", "S5", "Step 5 – lower"),
  M("S6", "M106", "S6", "Step 6 – clamp"),
  M("S7", "M107", "S7", "Step 7 – seating check"),
  M("S8", "M108", "S8", "Step 8 – door close"),
  M("S9", "M109", "S9", "Step 9 – FIN to the NC, wait until M60 is off"),
  M("F_Wd", "M200", "F_Wd", "Fault: step watchdog time-out"),
  M("F_PLow", "M201", "F_PLow", "Fault: accumulator < 10.0 MPa"),
  M("F_Seat", "M202", "F_Seat", "Fault: pallet seating (air check failed)"),
  M("F_Servo", "M203", "F_Servo", "Fault: servo drive"),
  M("F_Hyd", "M204", "F_Hyd", "Fault: hydraulic unit (oil level / pump feedback)"),
  M("F_Safety", "M205", "F_Safety", "Fault: safety stop during the move (curtain / door / e-stop)"),
  M("M_Fault", "M210", "Fault", "Any fault active (sum)"),

  // ---- timers (Delta 100 ms base: K = s × 10) ----
  ...STEPS.map(([n, name, , wd, dt]) => ({ name: "T_Wd" + n, dir: "T", delta: dt, siemens: `"DB_T_Wd${n}" (TON)`, comment: `Watchdog step ${n} (${name}): 2 × ${(wd / 2).toFixed(1)} s`, pt: wd })),
  { name: "T_PLow", dir: "T", delta: "T10", siemens: "\"DB_T_PLow\" (TON)", comment: "Low-pressure debounce (short dips during the lift are normal)", pt: 0.5 },
  { name: "T_PumpFb", dir: "T", delta: "T11", siemens: "\"DB_T_PumpFb\" (TON)", comment: "Pump contactor ON but no 'motor OK' feedback", pt: 1.0 },
  { name: "T_NoStart", dir: "T", delta: "T12", siemens: "\"DB_T_NoStart\" (TON)", comment: "M60 waits for the start conditions", pt: 2.0 },
  // ---- counters ----
  { name: "C_Changes", dir: "C", delta: "C0", siemens: "\"DB_C_Changes\" (CTU)", comment: "Pallet changes – service of lift seals / cones at PV", pv: 20000 },
  { name: "C_Faults", dir: "C", delta: "C1", siemens: "\"DB_C_Faults\" (CTU)", comment: "APC faults – call maintenance at PV", pv: 10 },
  // ---- words for the HMI ----
  { name: "StepNo", dir: "W", type: "INT", delta: "D200", siemens: "\"DB_Apc\".StepNo", comment: "Active step number for the HMI", init: 0 },
  { name: "AlarmNo", dir: "W", type: "INT", delta: "D201", siemens: "\"DB_Apc\".AlarmNo", comment: "Step number where the watchdog tripped (0 = none)", init: 0 },
];

// ---- panel layout for the core UI (ui / group / label / step strip) ----
const GRP = {
  sensor: "APC sensors + feedback (from the plant – click = force)",
  safety: "Load station + safety status (safety relay)",
  nc: "CNC interface (M-code handshake)",
  panel: "Operator panel",
  hpu: "Hydraulic unit",
};
const UIX = {
  ArmUp: ["sensor", "sensor"], ArmDown: ["sensor", "sensor"], Arm0deg: ["sensor", "sensor"], Arm180deg: ["sensor", "sensor"],
  PalletInMachine: ["sensor", "sensor"], PalletAtStation: ["sensor", "sensor"], MachineClamped: ["sensor", "sensor"], MachineUnclamped: ["sensor", "sensor"],
  SeatingAirOK: ["sensor", "sensor"], APCDoorOpen: ["sensor", "sensor"], APCDoorClosed: ["sensor", "sensor"],
  Servo_InPos: ["sensor", "sensor"], Servo_Fault: ["sensor", "sensor"], PumpMotorOK: ["sensor", "hpu"],
  StationDoorClosed: ["switch", "safety"], LightCurtainFree: ["switch", "safety"], SafetyOK: ["switch", "safety"],
  PalletSeatedStation: ["switch", "safety"], OperatorReady: ["push", "safety"],
  NC_M60: ["switch", "nc"], NC_InPos: ["switch", "nc"], NC_SpindleHome: ["switch", "nc"],
  S_Auto: ["switch", "panel"], S_Step: ["switch", "panel"], S_Next: ["push", "panel"], S_Ack: ["push", "panel"], S_Home: ["push", "panel"],
  S_JogUp: ["push", "panel"], S_JogDown: ["push", "panel"], S_CntReset: ["push", "panel"],
  OilLevelOK: ["switch", "hpu"], FilterClogged: ["switch", "hpu"],
  AccuPressure: ["sensor", "hpu"], OilTemp: ["switch", "hpu"],
};
const STEPLBL = ["S0 idle", "S1 door open", "S2 unclamp", "S3 lift", "S4 rotate", "S5 lower", "S6 clamp", "S7 seating", "S8 door close", "S9 FIN"];
for (const t of TAGS) {
  const u = UIX[t.name];
  if (u) { if (u[0] !== "switch") t.ui = u[0]; t.group = GRP[u[1]]; }
  if (/^S\d$/.test(t.name)) { t.step = true; t.stepLabel = STEPLBL[+t.name[1]]; }
}
TAGS.find((t) => t.name === "AccuPressure").inc = 0.05;
TAGS.find((t) => t.name === "OilTemp").inc = 1;

const ALLSTEPS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const go = (from, to, ...cond) => ({ in: S(NO(STEP(from)), ...cond), out: [SET(STEP(to)), RST(STEP(from))] });

const NETWORKS = [
  { title: "Network 1 – Operating modes",
    comment: "Automatic needs the key switch on AUTO and the safety relay OK. Single step is automatic, but each step waits for the 'Next' button. Manual = jog with interlocks.",
    rungs: [
      { in: S(NO("S_Auto"), NO("SafetyOK")), out: [OUT("M_Auto")] },
      { in: S(NC("S_Auto")), out: [OUT("M_Manual")] },
      { in: S(NO("M_Auto"), NO("S_Step")), out: [OUT("M_StepMode")] },
    ] },
  { title: "Network 2 – Hydraulic unit: pump and accumulator hold valve",
    comment: "The pump runs while the safety relay is OK and the oil level is OK. AccuHold closes the accumulator drain; when it drops, the accumulator empties to tank (ISO 4413). No motor feedback within 1 s = fault.",
    rungs: [
      { in: S(NO("SafetyOK"), NO("OilLevelOK"), NC("F_Hyd")), out: [OUT("PumpContactor"), OUT("AccuHold")] },
      { in: S(NO("PumpContactor"), NC("PumpMotorOK"), TON("T_PumpFb")), out: [SET("F_Hyd")] },
      { in: S(NC("OilLevelOK")), out: [SET("F_Hyd")] },
    ] },
  { title: "Network 3 – Accumulator charging with hysteresis (cut-in 10.8 / cut-out 11.5 MPa)",
    comment: "Below 10.8 MPa, and at the start of unclamp (S2) and of clamp (S6, after the lift oil was used), the charge request is SET; at 11.5 MPa it is RESET. SET below / RESET above = hysteresis, the valve cannot chatter. Energised 0V5 = the pump loads the accumulator.",
    rungs: [
      { in: S(P(CMP("<", "AccuPressure", 10.8), PE("S2"), PE("S6"))), out: [SET("M_Charge")] },
      { in: S(CMP(">=", "AccuPressure", 11.5)), out: [RST("M_Charge")] },
      { in: S(NO("M_Charge"), NO("PumpMotorOK")), out: [OUT("UnloadValve")] },
    ] },
  { title: "Network 4 – Pressure, oil temperature and filter monitoring",
    comment: "Start only at ≥ 10.7 MPa: the release + lift (0.165 L) must end above 10.0 MPa (the real lifted mass needs 9.4 MPa). Below 10.0 MPa for 0.5 s = alarm. Cold oil (< 20 °C) costs ≈ 0.5 MPa line loss = no start.",
    rungs: [
      { in: S(CMP(">=", "AccuPressure", 10.7)), out: [OUT("M_PressOK")] },
      { in: S(CMP("<", "AccuPressure", 10.0), TON("T_PLow")), out: [SET("F_PLow")] },
      { in: S(CMP(">=", "OilTemp", 20)), out: [OUT("M_OilWarm")] },
      { in: S(NO("FilterClogged")), out: [OUT("M_FilterWarn")] },
    ] },
  { title: "Network 5 – Load station ready (operator button with seal-in)",
    comment: "The operator presses 'ready' after loading: the pallet must be seated (air check) and the station door closed. Opening the station door or a finished change clears READY. The green lamp tells the operator: do not enter.",
    rungs: [
      { in: S(P(PE("OperatorReady"), NO("M_StnReady")), NO("PalletSeatedStation"), NO("StationDoorClosed"), NC("S9")), out: [OUT("M_StnReady")] },
      { in: S(NO("M_StnReady")), out: [OUT("StationLamp")] },
    ] },
  { title: "Network 6 – Start conditions of step 1 (guide 09 §24.2)",
    comment: "All must be TRUE, else the M60 waits: spindle home, axes in position, accumulator ≥ 10.7 MPa, oil warm, pump running, station ready, people protection OK, arm down at 0° or 180°, both pallets present, pallet clamped, no fault.",
    rungs: [
      { in: S(NO("M_Auto"), NO("NC_SpindleHome"), NO("NC_InPos"), NO("M_PressOK"), NO("M_OilWarm"), NO("PumpMotorOK"), NO("M_StnReady"),
        NO("StationDoorClosed"), NO("LightCurtainFree"), NO("ArmDown"), P(NO("Arm0deg"), NO("Arm180deg")),
        NO("PalletInMachine"), NO("PalletAtStation"), NO("MachineClamped"), NC("M_Fault"), NC("Servo_Fault")), out: [OUT("M_StartOK")] },
      { in: S(NO("S0"), NO("NC_M60"), NC("M_StartOK"), TON("T_NoStart")), out: [OUT("M_NoStartMsg")] },
    ] },
  { title: "Network 7 – Transition enable (automatic / single step)",
    comment: "In automatic every step goes on as soon as its sensor comes. In single-step mode only one step per press of 'Next' (rising edge = one scan). Any fault holds the chain where it is.",
    rungs: [
      { in: S(P(S(NO("M_Auto"), NC("M_StepMode")), S(NO("M_StepMode"), PE("S_Next"))), NC("M_Fault")), out: [OUT("M_TrEn")] },
    ] },
  { title: "Network 8 – Initial step and rotation direction",
    comment: "After power-up (or an abort) no step bit is on → step 0 is set. In step 1 the PLC remembers where the arm starts: at 0° it must turn to 180°, at 180° back to 0°.",
    rungs: [
      { in: S(...ALLSTEPS.map((n) => NC(STEP(n)))), out: [SET("S0")] },
      { in: S(NO("S1"), NO("Arm0deg")), out: [SET("M_Dir180")] },
      { in: S(NO("S1"), NO("Arm180deg")), out: [RST("M_Dir180")] },
    ] },
  { title: "Network 9 – Step chain: FIN handshake, door close, seating (written in REVERSE order)",
    comment: "Transitions are written from the last step to the first, so one step can never jump twice in the same scan. S9 → S0 waits until the NC drops M60 (M-code handshake: strobe → FIN → strobe off → FIN off).",
    rungs: [
      go(9, 0, NC("NC_M60")),
      go(8, 9, NO("APCDoorClosed"), NO("M_TrEn")),
      go(7, 8, NO("SeatingAirOK"), NO("M_TrEn")),
    ] },
  { title: "Network 10 – Step chain: clamp, lower, rotate",
    comment: "Clamp is done when 2S1 reads ≤ 0.5 MPa (springs pulled the studs). Lower is done at 'arm down'. Rotate is done when the servo reports 'in position' AND the cam sensor of the target angle is on.",
    rungs: [
      go(6, 7, NO("MachineClamped"), NO("M_TrEn")),
      go(5, 6, NO("ArmDown"), P(NO("Arm0deg"), NO("Arm180deg")), NO("M_TrEn")),
      go(4, 5, NO("Servo_InPos"), P(S(NO("M_Dir180"), NO("Arm180deg")), S(NC("M_Dir180"), NO("Arm0deg"))), NO("M_TrEn")),
    ] },
  { title: "Network 11 – Step chain: lift, unclamp, door open, start by M60",
    comment: "Lift needs 'unclamped' and the people protection OK. Unclamp needs the arm down (it carries the pallets). The start S0 → S1 is the M60 strobe AND all start conditions (Network 6).",
    rungs: [
      go(3, 4, NO("ArmUp"), NO("MachineUnclamped"), NO("LightCurtainFree"), NO("M_TrEn")),
      go(2, 3, NO("MachineUnclamped"), NO("ArmDown"), NO("M_TrEn")),
      go(1, 2, NO("APCDoorOpen"), NO("NC_InPos"), NO("StationDoorClosed"), NO("LightCurtainFree"), NO("M_TrEn")),
      go(0, 1, NO("NC_M60"), NO("M_StartOK"), NO("M_TrEn")),
    ] },
  { title: "Network 12 – Outputs: hydraulic valves (one coil per output)",
    comment: "Each output is written only ONCE (no double coil). Step actions only in AUTO (M_Auto) – in MANUAL the jog buttons take over. Lift up and lift down lock each other. After a fault the lift valve goes to centre (the pilot-operated check valves hold the arm); the modules stay open while the arm is up (also in manual).",
    rungs: [
      { in: S(P(S(NO("S2"), NC("M_Fault")), NO("S3"), NO("S4"), NO("S5"))), out: [OUT("UnclampValve")] },
      { in: S(P(S(NO("S3"), NO("M_Auto"), NC("M_Fault"), NC("ArmUp")), S(NO("M_Manual"), NO("S_JogUp"), NC("S_JogDown"), NO("MachineUnclamped"), NC("ArmUp"))), NC("LiftDownValve")), out: [OUT("LiftUpValve")] },
      { in: S(P(S(NO("S5"), NO("M_Auto"), NC("M_Fault"), NC("ArmDown")), S(NO("M_Manual"), NO("S_JogDown"), NC("S_JogUp"), NC("ArmDown"))), NC("LiftUpValve")), out: [OUT("LiftDownValve")] },
      { in: S(NO("S7"), NO("M_Auto"), NC("M_Fault")), out: [OUT("SeatingAir")] },
      { in: S(NO("S5"), NO("M_Auto")), out: [OUT("BlowOffAir")] },
    ] },
  { title: "Network 13 – Outputs: door, servo, FIN",
    comment: "The servo is enabled in steps 3–4 and only starts the move when the arm is up. The target (0° / 180°) comes from Network 8. FIN stays on until the NC drops M60.",
    rungs: [
      { in: S(NO("S1"), NO("M_Auto"), NC("APCDoorOpen")), out: [OUT("DoorOpen")] },
      { in: S(NO("S8"), NO("M_Auto"), NC("APCDoorClosed")), out: [OUT("DoorClose")] },
      { in: S(P(NO("S3"), NO("S4"))), out: [OUT("ServoEnable")] },
      { in: S(NO("S4"), NO("M_Auto"), NO("ArmUp"), NC("M_Fault")), out: [OUT("ServoStart")] },
      { in: S(NO("M_Dir180")), out: [OUT("ServoTo180")] },
      { in: S(NO("S9")), out: [OUT("NC_FIN")] },
    ] },
  { title: "Network 14 – Step watchdogs (2 × nominal time, guide 09 §24.3)",
    comment: "Each step bit starts its own timer (not in single-step mode). If the sensor does not come in time the fault is stored with the step number: the maintenance team sees at once which sensor or valve is wrong. Step 7 = seating alarm.",
    rungs: STEPS.map(([n]) => ({ in: S(NO(STEP(n)), NC("M_StepMode"), TON("T_Wd" + n)), out: [SET(n === 7 ? "F_Seat" : "F_Wd"), MOV(n, "AlarmNo")] })) },
  { title: "Network 15 – Safety status and drive fault (read only)",
    comment: "The safety relay / F-program already stops the servo (STO) and the valves. The standard program only notices it: if the curtain, a door or the e-stop chain opens during lift / rotate / lower, the chain is stopped with a message.",
    rungs: [
      { in: S(P(NO("S3"), NO("S4"), NO("S5")), P(NC("LightCurtainFree"), NC("StationDoorClosed"), NC("SafetyOK"))), out: [SET("F_Safety")] },
      { in: S(NO("Servo_Fault")), out: [SET("F_Servo")] },
    ] },
  { title: "Network 16 – Alarm sum, lamps and acknowledge",
    comment: "Any stored fault = M_Fault: red lamp, alarm to the NC, the chain holds. 'Ack' (rising edge) clears the stored faults and restarts the step watchdogs = one retry of the waiting step. A cause that is still there trips again (static causes at once, a missing sensor after the watchdog time).",
    rungs: [
      { in: S(P(NO("F_Wd"), NO("F_PLow"), NO("F_Seat"), NO("F_Servo"), NO("F_Hyd"), NO("F_Safety"))), out: [OUT("M_Fault"), OUT("AlarmLamp"), OUT("NC_Alarm")] },
      { in: S(PE("S_Ack")), out: [RST("F_Wd"), RST("F_PLow"), RST("F_Seat"), RST("F_Servo"), RST("F_Hyd"), RST("F_Safety"), MOV(0, "AlarmNo"),
        ...STEPS.map(([n]) => RST("T_Wd" + n))] },
    ] },
  { title: "Network 17 – Manual mode: abort the sequence",
    comment: "After an alarm the operator switches to MANUAL, brings the APC to a safe position with the jog buttons (Network 12), and presses 'Home': all step bits are reset, Network 8 sets step 0 again.",
    rungs: [
      { in: S(NO("M_Manual"), PE("S_Home")), out: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => RST(STEP(n))) },
    ] },
  { title: "Network 18 – Counters and step number for the HMI",
    comment: "C_Changes counts finished changes (rising edge of S9) for the service plan; C_Faults counts alarms. The step number is moved into a word for the HMI and the twin.",
    rungs: [
      { in: S(NO("S9"), CTU("C_Changes", "S_CntReset")), out: [] },
      { in: S(NO("M_Fault"), CTU("C_Faults", "S_CntReset")), out: [] },
      ...ALLSTEPS.map((n) => ({ in: S(NO(STEP(n))), out: [MOV(n, "StepNo")] })),
    ] },
];

export const PROGRAM = {
  id: "apc", title: "APC – automatic pallet changer control (step chain + HPU)", scanMs: 20,
  plc: { delta: { cpu: "AS332T-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "CPU 1215C DC/DC/DC", sw: "TIA Portal V19" } },
  tags: TAGS,
  networks: NETWORKS,
};

/* ---------------------------------------------------------------- plant model
 * plant(state, dt) is called every scan BEFORE the logic: it reads outputs and writes inputs.
 * Times = APC page defaults: door open 1.5 s, unclamp 0.8 s, lift 0.8 s, rotate 2.5 s, lower 0.8 s, clamp 0.8 s,
 * seating 0.4 s, door close 1.2 s. Accumulator: 4 L, ≈ 4.5 MPa per litre in the band 10–11.5 MPa (adiabatic, guide 09 §27):
 * pump 5.39 L/min → +0.40 MPa/s; release 0.047 L, lift 0.118 L, lower 0.081 L; leakage 0.15 L/min → −0.011 MPa/s.
 * The lift moves only at ≥ 9.4 MPa (real mass, guide 09 §20.2); the modules open only at ≥ 5 MPa (reducer 2V2).
 * makePlant() returns { sim, step(state, dt), reset() } in the shape the core expects (plant object). Every engine gets its own
 * plant, so the self-test engine and the page engine never share state. sim = plant state + fault injection flags. */
export const PLANT_TIMES = { door: 1.5, doorClose: 1.2, unc: 0.8, cl: 0.8, lift: 0.8, rot: 2.5, seat: 0.4 };
const KP = 4.5;                                // MPa per litre in the 10–11.5 MPa band (4 L accumulator, adiabatic)
const QPUMP = 5.39 / 60, QLEAK = 0.15 / 60;    // L/s
const VREL = 0.047, VUP = 0.118, VDOWN = 0.081;
const SIM0 = () => ({
  door: 0, lift: 0, ang: 0, unc: 0, seat: 0, pumpRun: 0, finSeen: 0, servoMove: false, servoFault: false,
  chip: false,            // chip under the pallet → seating check fails
  sensorUpBroken: false,  // "arm up" sensor broken → lift watchdog
  pumpTrip: false,        // motor protection -FC1 tripped → no PumpMotorOK
  ncAuto: true,           // the simulated NC drops M60 0.1 s after it sees FIN
});

export function makePlant() {
  const sim = SIM0();
  return {
    sim,
    step(state, dt) { plantStep(state, dt, sim); },
    reset() { Object.assign(sim, SIM0()); },
  };
}

function plantStep(st, dt, sim) {
  const T = PLANT_TIMES;
  const g = (n) => st[n];
  let p = +st.AccuPressure || 0;
  let use = 0;                                                          // litres used in this scan
  // pump motor + feedback (0.2 s run-up); trip of the motor protection
  sim.pumpRun = g("PumpContactor") && !sim.pumpTrip ? Math.min(1, sim.pumpRun + dt / 0.2) : 0;
  st.PumpMotorOK = sim.pumpRun >= 1;
  const safe = !!g("SafetyOK");                                         // safety relay contacts feed the motion valves + STO
  // door (1.5 s open / 1.2 s close)
  if (safe && g("DoorOpen") && !g("DoorClose")) sim.door = Math.min(1, sim.door + dt / T.door);
  if (safe && g("DoorClose") && !g("DoorOpen")) sim.door = Math.max(0, sim.door - dt / T.doorClose);
  st.APCDoorOpen = sim.door >= 1 - 1e-9; st.APCDoorClosed = sim.door <= 1e-9;
  // zero-point modules: open with oil ≥ 5 MPa (reducer 2V2), springs clamp when 2V1 is off
  if (g("UnclampValve") && p >= 5) { const d = Math.min(1 - sim.unc, dt / T.unc); sim.unc += d; use += VREL * d; }
  else if (!g("UnclampValve")) sim.unc = Math.max(0, sim.unc - dt / T.cl);
  st.MachineUnclamped = sim.unc >= 1 - 1e-9; st.MachineClamped = sim.unc <= 1e-9;
  // lift: 1V1 a / b, meter-out throttles → 0.8 s; up needs ≥ 9.4 MPa (real mass), down needs pilot pressure for the POC
  const up = safe && g("LiftUpValve") && !g("LiftDownValve"), down = safe && g("LiftDownValve") && !g("LiftUpValve");
  if (up && p >= 9.4) { const d = Math.min(1 - sim.lift, dt / T.lift); sim.lift += d; use += VUP * d; }
  if (down && p >= 2.5) { const d = Math.min(sim.lift, dt / T.lift); sim.lift -= d; use += VDOWN * d; }
  st.ArmUp = sim.lift >= 1 - 1e-9 && !sim.sensorUpBroken; st.ArmDown = sim.lift <= 1e-9;
  // the pallets sit on their receivers only when the arm is down
  st.PalletInMachine = sim.lift <= 0.05; st.PalletAtStation = sim.lift <= 0.05;
  // servo: 0 ↔ 180° in 2.5 s; STO when the safety relay / curtain opens; crash if the arm is not up; Ack resets the drive fault
  const target = g("ServoTo180") ? 180 : 0;
  if (sim.servoFault && g("S_Ack") && !g("ServoStart")) sim.servoFault = false;
  const run = safe && g("LightCurtainFree") && g("ServoEnable") && g("ServoStart") && !sim.servoFault;
  if (run && sim.lift < 0.98 && Math.abs(sim.ang - target) > 0.01) { sim.servoFault = true; sim.servoMove = false; }
  else if (run && Math.abs(sim.ang - target) > 1e-9) {
    const v = 180 / T.rot; sim.ang += Math.sign(target - sim.ang) * Math.min(Math.abs(target - sim.ang), v * dt); sim.servoMove = Math.abs(sim.ang - target) > 1e-9;
  } else sim.servoMove = false;
  st.Servo_Fault = sim.servoFault;
  st.Arm0deg = sim.ang <= 0.5; st.Arm180deg = sim.ang >= 179.5;
  st.Servo_InPos = !!g("ServoEnable") && !sim.servoMove && Math.abs(sim.ang - target) < 0.5;
  // seating check: air 0.4 s → the switch only comes if the pallet lies flat (no chip) and is clamped
  if (g("SeatingAir")) sim.seat = Math.min(1, sim.seat + dt / T.seat); else sim.seat = 0;
  st.SeatingAirOK = sim.seat >= 1 - 1e-9 && !sim.chip && sim.unc <= 1e-9;
  // simulated NC: drops M60 0.1 s after FIN (M-code handshake)
  if (sim.ncAuto && g("NC_FIN") && g("NC_M60")) { sim.finSeen += dt; if (sim.finSeen >= 0.1 - 1e-9) { st.NC_M60 = false; sim.finSeen = 0; } } else sim.finSeen = 0;
  // accumulator: the pump loads only with 0V5 energised and AccuHold closed; leakage always; relief 13 MPa
  if (!g("AccuHold")) p = Math.max(0, p - 2.0 * dt);                   // drain valve open → pressure falls
  else {
    const qIn = sim.pumpRun >= 1 && g("UnloadValve") ? QPUMP : 0;
    p = Math.min(13.0, p + KP * ((qIn - QLEAK) * dt - use));
  }
  st.AccuPressure = p;
}
