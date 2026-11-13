/* Hydraulics item 4 – program 3: vertical axis with hydraulic lock + counterbalance (APC lift 1A1 Ø50/28, guide 25 §14,
 * guide 30 circuits 1 + 2). 4/3 valve 1V1 float centre (1Y1 up, 1Y2 down), double pilot check 1V2 + counterbalance 1V3
 * (hydraulic, no coil), plus an electrically operated leak-free seat valve 1V4 (1Y3, energised = open) with spool monitoring
 * switch 1S3 as the second holding element. Valve output test mode with key switch.
 * All addresses, times and set points are EXAMPLES – check with your PLC configuration and the valve datasheets. */
import { I, Q, M, AI, T, C, NO, NC, PE, CMP, TON, TOF, CTU, S, P, OUT, SET, RST, R, N } from "./hydlad_lib.js";

const tags = [
  I("S_STOP", "X0.0", "%I0.0", "Stop push button (NC)", "-SF1 11/12", true),
  I("S_UP", "X0.1", "%I0.1", "Push button UP (manual: hold to run · auto: one push · test mode: start the valve test)", "-SF2 13/14"),
  I("S_DOWN", "X0.2", "%I0.2", "Push button DOWN", "-SF3 13/14"),
  I("S_ACK", "X0.3", "%I0.3", "Acknowledge", "-SF4 13/14"),
  I("S_AUTO", "X0.4", "%I0.4", "Mode: 1 = auto (one push), 0 = manual (hold to run)", "-SF5"),
  I("S_TEST", "X0.5", "%I0.5", "Key switch: valve output test (pump OFF!)", "-SF6 key"),
  I("HPU_RDY", "X0.6", "%I0.6", "Hydraulics ready (pressure ≥ 10.7 MPa, from the HPU program)", "-KF5 13/14", true),
  I("B1_DOWN", "X0.7", "%I0.7", "1B1 lift at the bottom", "1B1 pin 4", true),
  I("B2_UP", "X0.8", "%I1.0", "1B2 lift at the top", "1B2 pin 4"),
  I("S3_OPEN", "X0.9", "%I1.1", "1S3 spool monitoring of seat valve 1V4: 1 = valve open", "1S3 pin 4"),
  AI("P_CAP", "D100 (AS04AD-A ch1, scaled)", "%IW96 → \"DB_Lift\".P_Cap", "1B3 cap-side pressure 0–16 MPa (between 1V4 and the cylinder). Plant model writes it.", "MPa", 0, 16, 0, "1B3 → AI0"),
  Q("Y1_UP", "Y0.0", "%Q0.0", "1Y1 solenoid 4/3 valve 1V1: lift up", "1V1-a"),
  Q("Y2_DN", "Y0.1", "%Q0.1", "1Y2 solenoid 4/3 valve 1V1: lift down", "1V1-b"),
  Q("Y3_LOCK", "Y0.2", "%Q0.2", "1Y3 seat valve 1V4: energised = open (lock released)", "1V4 coil"),
  Q("H_UP", "Y0.3", "%Q0.3", "Lamp: lift at the top", "-PF5"),
  Q("H_DN", "Y0.4", "%Q0.4", "Lamp: lift at the bottom", "-PF6"),
  Q("H_FLT", "Y0.5", "%Q0.5", "Lamp red: fault", "-PF2"),
  Q("H_TEST", "Y0.6", "%Q0.6", "Lamp blue: valve test mode", "-PF7"),
  M("M_UPREQ", "M0", "%M30.0", "Up request"),
  M("M_DNREQ", "M1", "%M30.1", "Down request"),
  M("M_LOCKOK", "M2", "%M30.2", "Lock valve commanded open AND feedback open"),
  M("M_DNOK", "M3", "%M30.3", "Lock open for 0.2 s → lowering allowed"),
  M("M_ATTOP", "M4", "%M30.4", "Lift reached the top and was not sent down (drift monitor armed)"),
  M("M_FLT", "M5", "%M30.5", "Summary fault"),
  M("M_ACK", "M6", "%M30.6", "Acknowledge pulse"),
  M("M_TST1", "M10", "%M31.0", "Valve test step 1: 1Y1 for 2 s"),
  M("M_TST2", "M11", "%M31.1", "Valve test step 2: 1Y2 for 2 s"),
  M("M_TST3", "M12", "%M31.2", "Valve test step 3: 1Y3 for 2 s"),
  M("M_SERV", "M13", "%M31.3", "Service: 1000 lift cycles"),
  M("M_CRST", "M14", "%M31.4", "Reset cycle counter (HMI)"),
  M("AL_TO", "M20", "%M32.0", "Alarm: travel time-out"),
  M("AL_LOCK", "M21", "%M32.1", "Alarm: lock valve feedback wrong"),
  M("AL_DRIFT", "M22", "%M32.2", "Alarm: lift drifted down from the top while locked"),
  M("AL_PCAP", "M23", "%M32.3", "Alarm: holding pressure out of range (overload > 8.5 MPa / load lost < 1.0 MPa)"),
  T("T_LCLOSE", "T0", "\"DB_T_Lclose\" (TOF)", "Lock stays open 0.3 s after the movement (closes without flow)", 0.3),
  T("T_LFB", "T1", "\"DB_T_Lfb\" (TON)", "Lock feedback discrepancy time", 0.5),
  T("T_LOPEN", "T2", "\"DB_T_Lopen\" (TON)", "Lock open → wait before 1Y2", 0.2),
  T("T_TO", "T3", "\"DB_T_To\" (TON)", "Travel time-out (normal stroke 60 mm in 0.8 s)", 2.0),
  T("T_DRIFT", "T4", "\"DB_T_Drift\" (TON)", "Drift debounce", 1.0),
  T("T_PCAP", "T5", "\"DB_T_Pcap\" (TON)", "Holding pressure check delay", 1.0),
  T("T_TST1", "T6", "\"DB_T_Tst1\" (TON)", "Valve test 1Y1 on-time", 2.0),
  T("T_TST2", "T7", "\"DB_T_Tst2\" (TON)", "Valve test 1Y2 on-time", 2.0),
  T("T_TST3", "T8", "\"DB_T_Tst3\" (TON)", "Valve test 1Y3 on-time", 2.0),
  C("C_CYC", "C0", "\"DB_C_Cyc\" (CTU)", "Lift cycles (service at 1000, example)", 1000),
];

const UI = { S_STOP: "push", S_UP: "push", S_DOWN: "push", S_ACK: "push", B1_DOWN: "sensor", B2_UP: "sensor", S3_OPEN: "sensor", P_CAP: "sensor" };
const STEP = { M_TST1: "test 1Y1", M_TST2: "test 1Y2", M_TST3: "test 1Y3" };
tags.forEach((t) => { if (UI[t.name]) t.ui = UI[t.name]; if (STEP[t.name]) { t.step = true; t.stepLabel = STEP[t.name]; } });

const networks = [
  N("Network 1 – Summary fault", "Any latched alarm blocks new movements.",
    R(P(NO("AL_TO"), NO("AL_LOCK"), NO("AL_DRIFT"), NO("AL_PCAP")), OUT("M_FLT"))),
  N("Network 2 – Up request (manual: hold to run · auto: one push, seal-in until the top)",
    "Up and down requests lock each other (NC M_DNREQ). Not in test mode, only with hydraulics ready, no fault, stop button not pressed.",
    R(S(P(S(NC("S_AUTO"), NO("S_UP")), S(NO("S_AUTO"), P(NO("S_UP"), NO("M_UPREQ")))), NC("S_DOWN"), NC("B2_UP"), NO("S_STOP"), NO("HPU_RDY"), NC("M_FLT"), NC("S_TEST"), NC("M_DNREQ")), OUT("M_UPREQ"))),
  N("Network 3 – Down request (same structure)",
    "Pressing both buttons = no movement (each button has the NC contact of the other one).",
    R(S(P(S(NC("S_AUTO"), NO("S_DOWN")), S(NO("S_AUTO"), P(NO("S_DOWN"), NO("M_DNREQ")))), NC("S_UP"), NC("B1_DOWN"), NO("S_STOP"), NO("HPU_RDY"), NC("M_FLT"), NC("S_TEST"), NC("M_UPREQ")), OUT("M_DNREQ"))),
  N("Network 4 – Lock valve 1V4 (1Y3): open before, close 0.3 s after the movement",
    "Off-delay timer TOF: the seat closes when the 4/3 valve is already in its float centre – no flow through the closing seat (no pressure peak, no seat wear). Test step 3 also switches it.",
    R(S(P(NO("M_UPREQ"), NO("M_DNREQ"), NO("M_TST3")), TOF("T_LCLOSE")), OUT("Y3_LOCK"))),
  N("Network 5 – Lock valve feedback (spool monitoring 1S3)",
    "Command and feedback must agree within 0.5 s. A seat valve that does not close is a dangerous failure for a vertical axis (ISO 13849-1 diagnostic coverage).",
    R(S(NO("Y3_LOCK"), NO("S3_OPEN")), OUT("M_LOCKOK")),
    R(S(P(S(NO("Y3_LOCK"), NC("S3_OPEN")), S(NC("Y3_LOCK"), NO("S3_OPEN"))), TON("T_LFB")), SET("AL_LOCK"))),
  N("Network 6 – Lowering only 0.2 s after the lock is confirmed open",
    "Otherwise 1Y2 pressurises the rod side against a closed seat: rod-side intensification p2 = p·A1/A2.",
    R(S(NO("M_DNREQ"), NO("M_LOCKOK"), TON("T_LOPEN")), OUT("M_DNOK"))),
  N("Network 7 – Solenoid 1Y1 UP (never together with 1Y2)",
    "Software interlock with the NC contact of the other coil. In test step 1 the coil is switched alone (pump off: you hear the click, the LED in the connector lights).",
    R(S(P(S(NO("M_UPREQ"), NO("M_LOCKOK")), NO("M_TST1")), NC("Y2_DN")), OUT("Y1_UP"))),
  N("Network 8 – Solenoid 1Y2 DOWN (never together with 1Y1)",
    "The counterbalance valve 1V3 and the pilot check 1V2 open only with pilot pressure from line B – so lowering is always 'driven', never free fall.",
    R(S(P(NO("M_DNOK"), NO("M_TST2")), NC("Y1_UP")), OUT("Y2_DN"))),
  N("Network 9 – Travel time-out",
    "A full stroke takes 0.8 s. If a coil is ON for 2 s the axis is stuck, a sensor is broken or the pressure is too low.",
    R(S(P(NO("Y1_UP"), NO("Y2_DN")), NC("S_TEST"), TON("T_TO")), SET("AL_TO"))),
  N("Network 10 – Drift monitor (hydraulic lock leaks)",
    "Armed when the lift reaches the top. If 1B2 goes off without a down command and with all valves off, oil leaks past the lock → alarm.",
    R(PE("B2_UP"), SET("M_ATTOP")),
    R(NO("M_DNREQ"), RST("M_ATTOP")),
    R(S(NO("M_ATTOP"), NC("B2_UP"), NC("Y1_UP"), NC("Y2_DN"), NC("Y3_LOCK"), TON("T_DRIFT")), SET("AL_DRIFT"))),
  N("Network 11 – Holding pressure check (load + counterbalance setting)",
    "At rest above the bottom stop the trapped cap-side pressure is the load pressure (real lifted mass: 7.39 MPa). > 8.5 MPa = overload (the counterbalance, set ≈ 1.3 × 7.39 = 9.6 MPa, would soon open); < 1.0 MPa = load lost or sensor fault.",
    R(S(NC("Y1_UP"), NC("Y2_DN"), NC("B1_DOWN"), NC("S_TEST"), P(CMP(">", "P_CAP", 8.5), CMP("<", "P_CAP", 1.0)), TON("T_PCAP")), SET("AL_PCAP"))),
  N("Network 12 – Valve output test (key switch, pump OFF, lift at the bottom)",
    "Push UP once: 1Y1 2 s → 1Y2 2 s → 1Y3 2 s. Check the click, the connector LED and the coil current (24 V DC, ≈ 1.25 A for a 30 W NG6 coil). Key switch off ends the test.",
    R(S(NO("S_TEST"), NC("HPU_RDY"), NO("B1_DOWN"), PE("S_UP"), NC("M_TST1"), NC("M_TST2"), NC("M_TST3")), SET("M_TST1")),
    R(S(NO("M_TST1"), TON("T_TST1")), SET("M_TST2"), RST("M_TST1")),
    R(S(NO("M_TST2"), TON("T_TST2")), SET("M_TST3"), RST("M_TST2")),
    R(S(NO("M_TST3"), TON("T_TST3")), RST("M_TST3")),
    R(NC("S_TEST"), RST("M_TST1"), RST("M_TST2"), RST("M_TST3"))),
  N("Network 13 – Cycle counter + lamps",
    "Every arrival at the top = one cycle (rising edge). 1000 cycles → service (check seals, pilot check leakage, hoses).",
    R(S(PE("B2_UP"), CTU("C_CYC", "M_CRST")), OUT("M_SERV")),
    R(NO("B2_UP"), OUT("H_UP")),
    R(NO("B1_DOWN"), OUT("H_DN")),
    R(NO("M_FLT"), OUT("H_FLT")),
    R(NO("S_TEST"), OUT("H_TEST"))),
  N("Network 14 – Acknowledge", "One edge memory, one pulse, reset all alarms (they come back at once if the cause is still there).",
    R(PE("S_ACK"), OUT("M_ACK")),
    R(NO("M_ACK"), RST("AL_TO"), RST("AL_LOCK"), RST("AL_DRIFT"), RST("AL_PCAP"))),
];

/* plant: stroke 60 mm, 75 mm/s; the lift moves only with pressure (HPU_RDY), lock open (S3_OPEN) and one coil.
 * Cap pressure: holding 7.39 MPa (1 480 kg on Ø50), lifting 8.9 MPa, lowering ≈ 9.6 MPa (counterbalance setting),
 * at the bottom stop 0.3 MPa. 1S3 follows 1Y3 after 40 ms. */
export function makePlant() {
  let x = 0, s3 = false, t3 = 0, p = 0.3;
  return {
    reset() { x = 0; s3 = false; t3 = 0; p = 0.3; },
    info: () => ({ x, p, s3 }),
    step(io, dt) {
      const g = io.get, hyd = !!g("HPU_RDY"), y3 = !!g("Y3_LOCK");
      if (y3 !== s3) { t3 += dt; if (t3 >= 0.04) { s3 = y3; t3 = 0; } } else t3 = 0;
      const up = hyd && s3 && g("Y1_UP") && !g("Y2_DN"), dn = hyd && s3 && g("Y2_DN") && !g("Y1_UP");
      if (up) x = Math.min(60, x + 75 * dt);
      if (dn) x = Math.max(0, x - 75 * dt);
      const target = up ? 8.9 : dn ? 9.6 : x > 0.5 ? 7.39 : 0.3;
      p += (target - p) * Math.min(1, dt / 0.05);
      io.set("S3_OPEN", s3); io.set("B1_DOWN", x <= 0.5); io.set("B2_UP", x >= 59.5);
      io.set("P_CAP", Math.round(p * 1000) / 1000);
    },
  };
}

export const PROGRAM = {
  id: "lock", title: "Vertical axis – hydraulic lock + counterbalance, valve test", scanMs: 20,
  plc: { delta: { cpu: "AS332T-A + AS04AD-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "CPU 1215C DC/DC/DC + SM 1231 AI4", sw: "TIA Portal V19" } },
  tags, networks,
};

export const TRY = [
  "Auto mode: push <b>S_UP</b> once: 1Y3 opens, 1S3 confirms (40 ms), 1Y1 → 60 mm in 0.8 s, 1B2 → 1Y1 off, 1Y3 closes 0.3 s later.",
  "Push <b>S_DOWN</b>: 1Y3 opens, 0.2 s after the feedback 1Y2 → down in 0.8 s. Manual mode (S_AUTO off): hold the button.",
  "Force <b>S3_OPEN</b> off: the lock seems closed → no movement, alarm AL_LOCK after 0.5 s.",
  "At the top force <b>B2_UP</b> off (simulated drift): AL_DRIFT after 1 s. Force P_CAP to 9 MPa at rest: AL_PCAP (overload).",
  "Valve test: HPU_RDY off, lift at the bottom, S_TEST on, push S_UP → 1Y1, 1Y2, 1Y3 each 2 s.",
];
