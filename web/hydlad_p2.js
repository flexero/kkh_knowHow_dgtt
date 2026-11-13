/* Hydraulics item 4 – program 2: clamp, then work (sequence with a pressure switch) – guide 30 §8 (circuit 4,
 * option "pressure switch"), table clamp of guide 25 §14 / guide 12.
 * Clamp 1A1 Ø40/22 via reducing valve 1V2 5 MPa + pilot check 1V3, valve 1V1 4/3 (1Y1 clamp, 1Y2 unclamp);
 * work cylinder 2A1 Ø63/36, valve 2V1 4/3 (2Y1 extend, 2Y2 retract); pressure switch 1S1 4.5 MPa rising ("clamped");
 * step chain with SET / RST. All addresses, times and set points are EXAMPLES – check with your PLC configuration. */
import { I, Q, M, AI, T, C, NO, NC, PE, CMP, TON, CTU, S, P, OUT, SET, RST, R, N, lag } from "./hydlad_lib.js";

const tags = [
  I("S_STOP", "X0.0", "%I0.0", "Stop push button (NC): stops the cycle at a safe point (work retracts, clamp stays)", "-SF1 11/12", true),
  I("S_CYC", "X0.1", "%I0.1", "Cycle start push button (in manual: hold = unclamp)", "-SF2 13/14"),
  I("S_ACK", "X0.2", "%I0.2", "Acknowledge (in manual + ack: reset the step chain)", "-SF3 13/14"),
  I("S_AUTO", "X0.3", "%I0.3", "Mode selector: 1 = automatic, 0 = manual", "-SF4", true),
  I("HPU_RDY", "X0.4", "%I0.4", "Hydraulics ready (from the HPU program / relay -KF5)", "-KF5 13/14", true),
  I("GUARD", "X0.5", "%I0.5", "Guard door closed – status from the safety relay (information only)", "-KF1 23/24", true),
  I("PART", "X0.6", "%I0.6", "Part present -BG5 (inductive, PNP)", "-BG5 pin 4", true),
  I("B1_OPEN", "X0.7", "%I0.7", "1B1 clamp fully open (inductive on the clamp rod)", "1B1 pin 4", true),
  I("S1_CLP", "X0.8", "%I1.0", "1S1 pressure switch clamp branch: ON ≥ 4.5 MPa rising, OFF < 4.0 MPa", "1S1 pin 4"),
  I("B2_HOME", "X0.9", "%I1.1", "2B1 work cylinder retracted (cylinder switch)", "2B1 pin 4", true),
  I("B2_END", "X0.10", "%I1.2", "2B2 work cylinder extended (cylinder switch)", "2B2 pin 4"),
  AI("P_CLP", "D100 (AS04AD-A ch1, scaled)", "%IW96 → \"DB_Clamp\".P", "1B3 clamp pressure transmitter 0–10 MPa (behind reducing valve 1V2). Plant model writes it.", "MPa", 0, 10, 0, "1B3 → AI0"),
  Q("Y1_CLP", "Y0.0", "%Q0.0", "1Y1 solenoid valve 1V1: clamp", "1V1-a"),
  Q("Y2_UNC", "Y0.1", "%Q0.1", "1Y2 solenoid valve 1V1: unclamp", "1V1-b"),
  Q("Y3_EXT", "Y0.2", "%Q0.2", "2Y1 solenoid valve 2V1: work cylinder extend", "2V1-a"),
  Q("Y4_RET", "Y0.3", "%Q0.3", "2Y2 solenoid valve 2V1: work cylinder retract", "2V1-b"),
  Q("CLP_OK", "Y0.4", "%Q0.4", "To CNC: part clamped (spindle may cut) – relay -KF7", "-KF7 A1"),
  Q("H_RUN", "Y0.5", "%Q0.5", "Lamp white: cycle running", "-PF4"),
  Q("H_FLT", "Y0.6", "%Q0.6", "Lamp red: fault", "-PF2"),
  M("ST0", "M0", "%M20.0", "Step 0 – idle (no step active)"),
  M("ST1", "M1", "%M20.1", "Step 1 – clamp"),
  M("ST2", "M2", "%M20.2", "Step 2 – work cylinder extends"),
  M("ST3", "M3", "%M20.3", "Step 3 – machining (dwell 1.0 s)"),
  M("ST4", "M4", "%M20.4", "Step 4 – work cylinder retracts"),
  M("ST5", "M5", "%M20.5", "Step 5 – unclamp"),
  M("M_FLT", "M10", "%M21.0", "Summary fault"),
  M("M_ACK", "M11", "%M21.1", "Acknowledge pulse"),
  M("M_BATCH", "M12", "%M21.2", "Batch complete (counter ≥ preset)"),
  M("M_CRST", "M13", "%M21.3", "Reset part counter (from the HMI)"),
  M("AL_TO", "M20", "%M22.0", "Alarm: step time-out"),
  M("AL_CLP", "M21", "%M22.1", "Alarm: clamp pressure lost during work"),
  M("AL_PHI", "M22", "%M22.2", "Alarm: clamp pressure > 5.5 MPa (reducing valve fault)"),
  T("T_STAB", "T0", "\"DB_T_Stab\" (TON)", "Clamp pressure must stay ON 0.3 s (settled)", 0.3),
  T("T_DWELL", "T1", "\"DB_T_Dwell\" (TON)", "Machining / dwell time (example)", 1.0),
  T("T_TO1", "T2", "\"DB_T_To1\" (TON)", "Time-out step 1 clamp (normal ≈ 0.6 s)", 2.0),
  T("T_TO2", "T3", "\"DB_T_To2\" (TON)", "Time-out step 2 extend (normal ≈ 1.0 s)", 3.0),
  T("T_TO4", "T4", "\"DB_T_To4\" (TON)", "Time-out step 4 retract (normal ≈ 0.8 s)", 3.0),
  T("T_TO5", "T5", "\"DB_T_To5\" (TON)", "Time-out step 5 unclamp (normal ≈ 0.5 s)", 2.0),
  T("T_PLOST", "T6", "\"DB_T_Plost\" (TON)", "Debounce clamp pressure lost", 0.1),
  T("T_PHI", "T7", "\"DB_T_Phi\" (TON)", "Delay clamp pressure too high", 1.0),
  C("C_PARTS", "C0", "\"DB_C_Parts\" (CTU)", "Part counter (batch of 100)", 100),
];

const UI = { S_STOP: "push", S_CYC: "push", S_ACK: "push", B1_OPEN: "sensor", S1_CLP: "sensor", B2_HOME: "sensor", B2_END: "sensor", P_CLP: "sensor" };
const STEP = { ST0: "0 idle", ST1: "1 clamp", ST2: "2 extend", ST3: "3 dwell", ST4: "4 retract", ST5: "5 unclamp" };
tags.forEach((t) => { if (UI[t.name]) t.ui = UI[t.name]; if (STEP[t.name]) { t.step = true; t.stepLabel = STEP[t.name]; } });

const networks = [
  N("Network 1 – Summary fault", "Any latched alarm stops the start of a new cycle.",
    R(P(NO("AL_TO"), NO("AL_CLP"), NO("AL_PHI")), OUT("M_FLT"))),
  N("Network 2 – Step 0 = idle (no step active)",
    "Instead of a first-scan bit, step 0 is simply 'no other step is active'. After a power cut (non-retentive steps) the chain is always in step 0.",
    R(S(NC("ST1"), NC("ST2"), NC("ST3"), NC("ST4"), NC("ST5")), OUT("ST0"))),
  N("Network 3 – Start conditions → step 1 (clamp)",
    "Start only with a rising edge of the button (holding it does not restart), in automatic, with hydraulics ready, guard closed, part present, clamp open, work cylinder home and no fault.",
    R(S(NO("ST0"), NO("S_AUTO"), PE("S_CYC"), NO("S_STOP"), NO("HPU_RDY"), NO("GUARD"), NO("PART"), NO("B1_OPEN"), NO("B2_HOME"), NC("M_FLT")), SET("ST1"))),
  N("Network 4 – Step 1 → step 2 when the clamp pressure switch is ON for 0.3 s",
    "The transition uses the PRESSURE (1S1 ≥ 4.5 MPa) and the position (1B1 left) – a pressure switch alone also switches when the clamp hits an obstacle. 0.3 s lets the pressure settle.",
    R(S(NO("ST1"), NO("S1_CLP"), NC("B1_OPEN"), TON("T_STAB")), SET("ST2"), RST("ST1"))),
  N("Network 5 – Step 2 → step 3 when the work cylinder is extended (2B2)", "Set the next step, reset the own step: only one step bit is TRUE at a time.",
    R(S(NO("ST2"), NO("B2_END")), SET("ST3"), RST("ST2"))),
  N("Network 6 – Step 3 (machining / dwell 1.0 s) → step 4", "In the real machine this is the CNC program; here a timer.",
    R(S(NO("ST3"), TON("T_DWELL")), SET("ST4"), RST("ST3"))),
  N("Network 7 – Step 4 → step 5 when the work cylinder is home (2B1)", "The clamp opens only after the tool / work cylinder is back.",
    R(S(NO("ST4"), NO("B2_HOME")), SET("ST5"), RST("ST4"))),
  N("Network 8 – Step 5 → end (clamp open, pressure gone) + part counter",
    "The counter rung comes FIRST: it must see step 5 before the next rung resets it (rung order = execution order).",
    R(S(NO("ST5"), NO("B1_OPEN"), NC("S1_CLP"), CTU("C_PARTS", "M_CRST")), OUT("M_BATCH")),
    R(S(NO("ST5"), NO("B1_OPEN"), NC("S1_CLP")), RST("ST5"))),
  N("Network 9 – Clamp pressure lost during work / stop button → retract",
    "If 1S1 drops while the work cylinder is out, the part may move: retract at once (step 4), keep the clamp valve ON, alarm. The stop button also sends the cycle to 'retract' – never unclamp with the tool in the part.",
    R(S(P(NO("ST2"), NO("ST3")), NC("S1_CLP"), TON("T_PLOST")), SET("AL_CLP"), SET("ST4"), RST("ST2"), RST("ST3")),
    R(S(P(NO("ST2"), NO("ST3")), NC("S_STOP")), SET("ST4"), RST("ST2"), RST("ST3"))),
  N("Network 10 – Step time-outs (watchdog for every movement)",
    "Each step has a maximum time ≈ 2–3 × the normal time. A missing sensor signal then gives a clear alarm instead of a machine that waits for ever.",
    R(S(NO("ST1"), TON("T_TO1")), SET("AL_TO")),
    R(S(NO("ST2"), TON("T_TO2")), SET("AL_TO")),
    R(S(NO("ST4"), TON("T_TO4")), SET("AL_TO")),
    R(S(NO("ST5"), TON("T_TO5")), SET("AL_TO"))),
  N("Network 11 – Clamp pressure too high (reducing valve 1V2 stuck / drain blocked)",
    "1B3 > 5.5 MPa for 1 s → alarm: thin parts bend at 10 MPa (twice the force).",
    R(S(CMP(">", "P_CLP", 5.5), TON("T_PHI")), SET("AL_PHI"))),
  N("Network 12 – Clamp valve 1V1: 1Y1 clamp / 1Y2 unclamp – never together",
    "Each coil has the NC contact of the other coil in series (software interlock). In manual (S_AUTO = 0) holding S_CYC unclamps, only with the work cylinder home.",
    R(S(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4")), NC("Y2_UNC")), OUT("Y1_CLP")),
    R(S(P(NO("ST5"), S(NC("S_AUTO"), NO("ST0"), NO("B2_HOME"), NO("S_CYC"))), NC("Y1_CLP")), OUT("Y2_UNC"))),
  N("Network 13 – Work valve 2V1: 2Y1 extend only with clamp pressure / 2Y2 retract",
    "2Y1 has the pressure switch 1S1 directly in series: even a wrong step cannot extend without clamp pressure. 2Y1 and 2Y2 are interlocked like network 12.",
    R(S(NO("ST2"), NO("S1_CLP"), NC("Y4_RET")), OUT("Y3_EXT")),
    R(S(NO("ST4"), NC("Y3_EXT")), OUT("Y4_RET"))),
  N("Network 14 – Signals to the CNC + lamps", "CLP_OK = pressure switch ON and clamp not open: the CNC may start the spindle feed.",
    R(S(NO("S1_CLP"), NC("B1_OPEN")), OUT("CLP_OK")),
    R(NC("ST0"), OUT("H_RUN")),
    R(NO("M_FLT"), OUT("H_FLT"))),
  N("Network 15 – Acknowledge + reset of the step chain",
    "Ack resets the alarms (pressure-high only if the pressure is OK again). Manual mode + ack resets every step bit → step 0.",
    R(PE("S_ACK"), OUT("M_ACK")),
    R(NO("M_ACK"), RST("AL_TO"), RST("AL_CLP")),
    R(S(NO("M_ACK"), CMP("<=", "P_CLP", 5.5)), RST("AL_PHI")),
    R(S(NO("M_ACK"), NC("S_AUTO")), RST("ST1"), RST("ST2"), RST("ST3"), RST("ST4"), RST("ST5"))),
];

/* plant: clamp (stroke in 0.4 s, then pressure builds to 5 MPa behind the reducing valve, pilot check holds it),
 * pressure switch with hysteresis, work cylinder (extend 1.0 s, retract 0.8 s). Positions 0 … 1. */
export function makePlant() {
  let x1 = 0, x2 = 0, p = 0, s1 = false;
  return {
    reset() { x1 = 0; x2 = 0; p = 0; s1 = false; },
    info: () => ({ x1, x2, p }),
    step(io, dt) {
      const g = io.get, hyd = !!g("HPU_RDY");
      const clamp = hyd && g("Y1_CLP") && !g("Y2_UNC"), unclamp = hyd && g("Y2_UNC") && !g("Y1_CLP");
      if (clamp) {
        if (x1 < 1) { x1 = Math.min(1, x1 + dt / 0.4); p = lag(p, 0.6, 0.05, dt); }
        else p = lag(p, 5.0, 0.08, dt);
      } else if (unclamp) { p = lag(p, 0, 0.04, dt); if (p < 0.8) x1 = Math.max(0, x1 - dt / 0.4); }
      else if (!hyd && !g("Y1_CLP")) p = lag(p, 0, 2, dt);
      else p = Math.max(0, p - 0.01 * dt);                    // pilot check holds, tiny leak
      if (!s1 && p >= 4.5) s1 = true; else if (s1 && p < 4.0) s1 = false;
      if (hyd && g("Y3_EXT") && !g("Y4_RET")) x2 = Math.min(1, x2 + dt / 1.0);
      if (hyd && g("Y4_RET") && !g("Y3_EXT")) x2 = Math.max(0, x2 - dt / 0.8);
      io.set("B1_OPEN", x1 < 0.02); io.set("S1_CLP", s1); io.set("P_CLP", Math.round(p * 1000) / 1000);
      io.set("B2_HOME", x2 < 0.02); io.set("B2_END", x2 > 0.98);
    },
  };
}

export const PROGRAM = {
  id: "seq", title: "Clamp, then work – step chain with pressure switch", scanMs: 20,
  plc: { delta: { cpu: "AS332T-A + AS04AD-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "CPU 1215C DC/DC/DC + SM 1231 AI4", sw: "TIA Portal V19" } },
  tags, networks,
};

export const TRY = [
  "Press <b>S_CYC</b>: step 1 clamp (0.4 s stroke + pressure) → 1S1 ON → 0.3 s → step 2 extend (1.0 s) → step 3 dwell 1.0 s → step 4 retract → step 5 unclamp → idle, counter + 1.",
  "During step 2 / 3 force <b>S1_CLP</b> off (clamp pressure lost): the work cylinder retracts at once, alarm AL_CLP, the clamp stays.",
  "Switch <b>PART</b> off: the cycle does not start (start condition). Switch <b>HPU_RDY</b> off during step 1: no pressure → time-out after 2 s.",
  "Manual mode (S_AUTO off) + <b>S_ACK</b>: the step chain resets. In manual, hold S_CYC to unclamp (only with the work cylinder home).",
];
