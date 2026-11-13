/* Hydraulics item 4 – program 1: hydraulic power unit (HPU) of the HMC / APC (guide 25 §14 example 2, guide 09).
 * Pump 4 cm³/rev, 1.5 kW motor with star-delta start (5 s), unloading valve 0V5 (cut-in 10.8 / cut-out 11.5 MPa from
 * transmitter 0B2 0–16 MPa), relief 0V1 13 MPa, accumulator 4 L (p0 8.99 MPa gauge), discharge valve 0V6, tank 25 L with
 * level switch 0S3, temperature transmitter 0B3, heater 0E1, air-oil cooler 0E2, return filter 0Z1 with clogging switch.
 * Every address, time and threshold is an EXAMPLE – check with your PLC configuration and the HPU datasheet. */
import { I, Q, M, AI, W, T, C, NO, NC, PE, NE, CMP, TON, CTU, S, P, OUT, SET, RST, CALC, R, N, lag, delayBit } from "./hydlad_lib.js";

const tags = [
  // ---- bit inputs: Delta AS332T-A on-board X0.0 … X0.15 · Siemens CPU 1215C on-board %I0.0 … %I1.5 (14 DI)
  I("S_STOP", "X0.0", "%I0.0", "Pump stop push button -SF1 (NC contact: wire break = stop)", "-SF1 11/12", true),
  I("S_START", "X0.1", "%I0.1", "Pump start push button -SF2 (NO)", "-SF2 13/14"),
  I("S_ACK", "X0.2", "%I0.2", "Alarm acknowledge / reset push button -SF3 (NO)", "-SF3 13/14"),
  I("ESTOP_OK", "X0.3", "%I0.3", "Safety relay -KF1 (e.g. PNOZ s4) status: e-stop chain healthy (info only – the relay switches KM1 itself)", "-KF1 13/14", true),
  I("QM1_OK", "X0.4", "%I0.4", "Motor circuit breaker -QM1 auxiliary contact (closed = not tripped)", "-QM1 13/14", true),
  I("PTC_OK", "X0.5", "%I0.5", "Thermistor relay -KF2 (PTC in the motor winding) OK", "-KF2 13/14", true),
  I("KM1_FB", "X0.6", "%I0.6", "Feedback main contactor -QA1 (auxiliary NO)", "-QA1 13/14"),
  I("KM2_FB", "X0.7", "%I0.7", "Feedback delta contactor -QA2 (auxiliary NO)", "-QA2 13/14"),
  I("KM3_FB", "X0.8", "%I1.0", "Feedback star contactor -QA3 (auxiliary NO) – note %I0.8 does not exist", "-QA3 13/14"),
  I("LVL_OK", "X0.9", "%I1.1", "Tank level switch 0S3 – closed = level OK, opens at minimum level", "0S3 pin 4", true),
  I("FILT_OK", "X0.10", "%I1.2", "Return filter 0Z1 clogging switch – NC, opens at Δp ≈ 0.25 MPa", "0Z1 pin 4", true),
  I("CNC_MOVE", "X0.11", "%I1.3", "From the CNC / APC: a hydraulic movement is active (recharge after it)", "-KF6 from CNC"),
  // ---- analog inputs: Delta AS04AD-A (4–20 mA → 0…32000) · Siemens SM 1231 AI 4×13 bit in slot 2 (4–20 mA → 0…27648)
  AI("P_RAW", "D100 (AS04AD-A ch1)", "%IW96 (SM 1231 ch0)", "0B2 pressure transmitter 0–16 MPa, 4–20 mA, raw value (Siemens counts; Delta: use 32000 instead of 27648). The plant model writes it.", "counts", 0, 32767, 0, "0B2 → AI0+ / AI0−"),
  AI("T_OIL", "D101 (AS04AD-A ch2, scaled)", "%IW98 → \"DB_Hpu\".T_Oil", "0B3 oil temperature transmitter 0–100 °C, 4–20 mA, already scaled. Drag the slider to test heater / cooler / trip.", "°C", 0, 100, 18, "0B3 → AI1+ / AI1−"),
  // ---- bit outputs: Delta Y0.0 … · Siemens on-board %Q0.0 … %Q1.1 (10 DQ) + SM 1222 DQ16 from %Q8.0
  Q("KM1", "Y0.0", "%Q0.0", "Main contactor -QA1 (pump motor 0M1, 1.5 kW)", "-QA1 A1/A2"),
  Q("KM3", "Y0.1", "%Q0.1", "Star contactor -QA3 (hard-wired NC of -QA2 in series!)", "-QA3 A1/A2"),
  Q("KM2", "Y0.2", "%Q0.2", "Delta contactor -QA2 (hard-wired NC of -QA3 in series!)", "-QA2 A1/A2"),
  Q("Y_0V5", "Y0.3", "%Q0.3", "0Y5 solenoid of unloading valve 0V5 (2/2 NO): energised = closed = pump loads the accumulator", "0V5 coil 24 V DC"),
  Q("Y_0V6", "Y0.4", "%Q0.4", "0Y6 solenoid of accumulator discharge valve 0V6: energised = closed; de-energised = accumulator dumps to tank", "0V6 coil 24 V DC"),
  Q("HEATER", "Y0.5", "%Q0.5", "Contactor -QA5 of the tank heater 0E1 (1 kW)", "-QA5 A1/A2"),
  Q("COOLER", "Y0.6", "%Q0.6", "Contactor -QA4 of the air-oil cooler fan 0E2", "-QA4 A1/A2"),
  Q("HYD_RDY", "Y0.7", "%Q0.7", "To CNC / APC: hydraulics ready (relay -KF5)", "-KF5 A1/A2"),
  Q("H_RDY", "Y0.8", "%Q1.0", "Lamp green -PF1: pressure ready", "-PF1"),
  Q("H_FLT", "Y0.9", "%Q1.1", "Lamp red -PF2: fault (flashes)", "-PF2"),
  Q("H_WRN", "Y0.10", "%Q8.0 (SM 1222)", "Lamp amber -PF3: warning (filter, temperature, service, low pressure)", "-PF3"),
  // ---- internal bits
  { ...M("ON", "SM400 (AS) / M1000 (DVP)", "%M1.2 \"AlwaysTRUE\"", "Always-ON bit (Siemens: system memory byte MB1 – enable it in the CPU properties)", true), sys: "on" },
  { ...M("CLK1", "SM 1 s clock bit (see AS manual) / M1013 (DVP)", "%M0.5 \"Clock_1Hz\"", "1 Hz clock bit (Siemens: clock memory byte MB0 – enable it in the CPU properties)"), sys: "clk1" },
  M("M_TRIP", "M0", "%M10.0", "Summary trip: the pump must stop"),
  M("M_RUN", "M1", "%M10.1", "Pump run request (seal-in)"),
  M("M_YD", "M2", "%M10.2", "Star time over (5 s)"),
  M("M_GAP", "M3", "%M10.3", "Star contactor is open + 0.1 s dead time over → delta may close"),
  M("M_PUMP", "M4", "%M10.4", "Pump runs in delta (full torque) – loading allowed"),
  M("M_CHG", "M5", "%M10.5", "Accumulator charging (pump loads)"),
  M("M_P107", "M6", "%M10.6", "Pressure ≥ 10.7 MPa for 1 s"),
  M("M_RDY", "M7", "%M10.7", "Hydraulics ready"),
  M("M_ACK", "M8", "%M11.0", "Acknowledge pulse (one scan)"),
  M("M_PLS1S", "M9", "%M11.1", "1-second pulse while the pump runs (run-hour counter)"),
  M("M_FL", "M10", "%M11.2", "Flasher 1 Hz"),
  M("M_FL2", "M11", "%M11.3", "Flasher helper"),
  M("M_CRST", "M12", "%M11.4", "Reset of the start counter (from the HMI)"),
  M("W_FILT", "M20", "%M12.0", "Warning: filter clogged (oil warm)"),
  M("W_TEMP", "M21", "%M12.1", "Warning: oil > 55 °C"),
  M("W_SERV", "M22", "%M12.2", "Warning: service due (run hours)"),
  M("W_STARTS", "M23", "%M12.3", "Warning: many motor starts"),
  M("AL_MOT", "M30", "%M13.0", "Alarm: motor protection tripped (QM1 / PTC)"),
  M("AL_FB", "M31", "%M13.1", "Alarm: contactor feedback wrong (stuck / not pulled in)"),
  M("AL_LVL", "M32", "%M13.2", "Alarm: oil level low"),
  M("AL_TEMP", "M33", "%M13.3", "Alarm: oil temperature > 65 °C"),
  M("AL_FILT", "M34", "%M13.4", "Alarm: filter clogged for longer than 60 s"),
  M("AL_SENS", "M35", "%M13.5", "Alarm: pressure transmitter wire break / overflow"),
  M("AL_PLOW", "M36", "%M13.6", "Alarm: pressure < 10.0 MPa while running (warning)"),
  M("AL_CHG", "M37", "%M13.7", "Alarm: charging longer than 20 s (pump worn, leak, relief open)"),
  // ---- words
  W("P_SYS", "D200 (32-bit float)", "%MD100 (REAL)", "System pressure 0B2 in MPa (scaled)", "MPa"),
  W("RUN_S", "D210 (32 bit)", "%MD104 (DINT)", "Pump run time in seconds (retentive!)", "s", 7199940, "DINT"),
  W("RUN_H", "D212 (float)", "%MD108 (REAL)", "Pump run hours", "h", 1999.98),
  W("SERV_H", "D214 (float)", "%MD112 (REAL)", "Service interval: oil sample + filter element", "h", 2000),
  // ---- timers (Delta TMR, 100 ms base: K = seconds × 10) · Siemens IEC TON in an instance DB
  T("T_YD", "T0", "\"DB_T_YD\" (TON)", "Star → delta time", 5.0),
  T("T_GAP", "T1", "\"DB_T_Gap\" (TON)", "Dead time star off → delta on (no short circuit through the arc)", 0.1),
  T("T_FB", "T2", "\"DB_T_Fb\" (TON)", "Contactor feedback discrepancy time", 0.5),
  T("T_PRDY", "T3", "\"DB_T_Prdy\" (TON)", "Pressure ≥ 10.7 MPa must stay 1 s", 1.0),
  T("T_PLOW", "T4", "\"DB_T_Plow\" (TON)", "Delay of the low-pressure alarm", 3.0),
  T("T_TEMP", "T5", "\"DB_T_Temp\" (TON)", "Delay of the over-temperature trip", 2.0),
  T("T_LVL", "T6", "\"DB_T_Lvl\" (TON)", "Debounce of the level switch (oil sloshing)", 2.0),
  T("T_FILT", "T7", "\"DB_T_Filt\" (TON)", "Filter warning → stop after (example 60 s; real: end of shift / some hours)", 60),
  T("T_CHG", "T8", "\"DB_T_Chg\" (TON)", "Charging time-out (normal 10.8 → 11.5 MPa ≈ 2 s)", 20),
  T("T_FL1", "T10", "\"DB_T_Fl1\" (TON)", "Flasher on time", 0.5),
  T("T_FL2", "T11", "\"DB_T_Fl2\" (TON)", "Flasher off time", 0.5),
  C("C_STARTS", "C0", "\"DB_C_Starts\" (CTU)", "Motor starts (warning at 20 – an accumulator HPU should run, not start often)", 20),
];

const UI = { S_STOP: "push", S_START: "push", S_ACK: "push", KM1_FB: "sensor", KM2_FB: "sensor", KM3_FB: "sensor", P_RAW: "sensor" };
const GRP = { ESTOP_OK: "Faults + machine signals (click to simulate)", QM1_OK: "Faults + machine signals (click to simulate)", PTC_OK: "Faults + machine signals (click to simulate)",
  LVL_OK: "Faults + machine signals (click to simulate)", FILT_OK: "Faults + machine signals (click to simulate)", CNC_MOVE: "Faults + machine signals (click to simulate)" };
tags.forEach((t) => { if (UI[t.name]) t.ui = UI[t.name]; if (GRP[t.name]) t.group = GRP[t.name]; });

const networks = [
  N("Network 1 – Pressure transmitter: scaling + wire-break check",
    "0B2 sends 4–20 mA for 0–16 MPa. The analog card gives 0…27648 counts (Siemens) or 0…32000 (Delta). p = raw × 16 / 27648. A broken wire gives 32767 (overflow) → alarm, never 'pressure OK'.",
    R(NO("ON"), CALC("P_RAW*16/27648", "P_SYS")),
    R(P(CMP(">", "P_RAW", 32511), CMP("<", "P_RAW", -4864)), SET("AL_SENS"))),
  N("Network 2 – Summary trip (stop the pump)",
    "One bit collects every reason to stop. The e-stop itself is switched by the safety relay -KF1; the PLC only reads its status. Alarm bits are latched (SET) and need an acknowledge.",
    R(P(NC("ESTOP_OK"), NO("AL_MOT"), NO("AL_FB"), NO("AL_LVL"), NO("AL_TEMP"), NO("AL_FILT"), NO("AL_SENS")), OUT("M_TRIP"))),
  N("Network 3 – Motor protection feedback",
    "Motor circuit breaker -QM1 (overload / short circuit) and the PTC thermistor relay -KF2 both open their contact when they trip. The breaker switches the motor off by itself – the PLC must know it to stop the sequence and show the alarm.",
    R(P(NC("QM1_OK"), NC("PTC_OK")), SET("AL_MOT"))),
  N("Network 4 – Pump run request (start / stop with seal-in) + start counter",
    "Classic seal-in (self-holding): START sets, the NC stop button and the trip break it. The stop button is an NC contact wired to the PLC, so the input is TRUE when nobody presses it – the ladder uses a NO contact on it. A broken wire stops the pump (fail-safe wiring).",
    R(S(P(NO("S_START"), NO("M_RUN")), NO("S_STOP"), NC("M_TRIP")), OUT("M_RUN")),
    R(S(PE("M_RUN"), CTU("C_STARTS", "M_CRST")), OUT("W_STARTS"))),
  N("Network 5 – Main contactor, discharge valve, star time 5 s",
    "KM1 and KM3 (star) pull in together. The star timer starts only when the main contactor really closed (feedback KM1_FB). 0V6 closes so the accumulator can hold pressure; when the pump stops 0V6 opens and dumps the accumulator (EN ISO 4413).",
    R(NO("M_RUN"), OUT("KM1"), OUT("Y_0V6")),
    R(S(NO("M_RUN"), NO("KM1_FB"), TON("T_YD")), OUT("M_YD"))),
  N("Network 6 – Star contactor KM3 (interlocked with KM2)",
    "Star only while the star time runs, and never while the delta contactor is commanded or its feedback is closed. Wire the same interlock in hardware (NC auxiliary of -QA2 in the coil line of -QA3): the PLC interlock alone is not enough if an output transistor fails.",
    R(S(NO("M_RUN"), NC("M_YD"), NC("KM2"), NC("KM2_FB")), OUT("KM3"))),
  N("Network 7 – Change-over dead time + delta contactor KM2",
    "Delta closes only after the star contactor has really opened (KM3_FB = 0) plus 0.1 s, so the arc in KM3 is out. Without the gap: phase-to-phase short circuit through the star point.",
    R(S(NO("M_YD"), NC("KM3_FB"), TON("T_GAP")), OUT("M_GAP")),
    R(S(NO("M_RUN"), NO("M_GAP"), NC("KM3")), OUT("KM2"))),
  N("Network 8 – Pump runs in delta + contactor feedback monitoring",
    "Load the pump only in delta: in star the motor has 1/3 of the torque. If a command and its feedback disagree for 0.5 s (welded contact, broken coil, missing auxiliary contact) → alarm AL_FB, trip.",
    R(S(NO("KM1_FB"), NO("KM2_FB"), NC("KM3_FB")), OUT("M_PUMP")),
    R(S(P(S(NO("KM1"), NC("KM1_FB")), S(NC("KM1"), NO("KM1_FB")), S(NO("KM2"), NC("KM2_FB")), S(NC("KM2"), NO("KM2_FB")), S(NO("KM3"), NC("KM3_FB")), S(NC("KM3"), NO("KM3_FB"))), TON("T_FB")), SET("AL_FB"))),
  N("Network 9 – Accumulator charging with hysteresis (unloading valve 0V5)",
    "Cut-in 10.8 MPa, cut-out 11.5 MPa (0.7 MPa band). Below 10.8 the pump loads; it keeps loading (seal-in through M_CHG) until 11.5. After every movement of the machine (falling edge of CNC_MOVE) it recharges to the cut-out. Charging longer than 20 s = pump worn, leak or relief open.",
    R(S(P(CMP("<=", "P_SYS", 10.8), S(NO("M_CHG"), CMP("<", "P_SYS", 11.5)), NE("CNC_MOVE")), NO("M_PUMP"), NC("M_TRIP")), OUT("M_CHG"), OUT("Y_0V5")),
    R(S(NO("M_CHG"), TON("T_CHG")), SET("AL_CHG"))),
  N("Network 10 – Pressure ready (start interlock for the APC) + low pressure",
    "Ready = pump in delta, no trip, oil ≥ 20 °C and pressure ≥ 10.7 MPa for 1 s (guide 25 §14.5: a pallet change from 10.7 MPa ends ≥ 10.0 MPa). Once ready it stays ready down to 10.0 MPa (a movement takes oil). Below 10.0 MPa for 3 s → warning AL_PLOW.",
    R(S(CMP(">=", "P_SYS", 10.7), TON("T_PRDY")), OUT("M_P107")),
    R(S(NO("M_PUMP"), NC("M_TRIP"), CMP(">=", "T_OIL", 20), P(NO("M_P107"), S(NO("M_RDY"), CMP(">=", "P_SYS", 10.0)))), OUT("M_RDY"), OUT("HYD_RDY")),
    R(S(NO("M_PUMP"), CMP("<", "P_SYS", 10.0), TON("T_PLOW")), SET("AL_PLOW"))),
  N("Network 11 – Tank heater (on < 20 °C, off ≥ 25 °C)",
    "Hysteresis 5 K so the contactor does not chatter. The heater only runs when the oil level is OK – a heater in air burns out and can ignite oil vapour.",
    R(S(P(CMP("<", "T_OIL", 20), S(NO("HEATER"), CMP("<", "T_OIL", 25))), NO("LVL_OK"), NC("AL_TEMP")), OUT("HEATER"))),
  N("Network 12 – Cooler (on > 50 °C, off ≤ 45 °C), warning > 55 °C, trip > 65 °C",
    "The air-oil cooler sits in the return line: oil flows only while the pump runs, so the fan runs only then. 65 °C for 2 s → trip (seals, oil life: every +10 K above 60 °C halves the oil life).",
    R(S(P(CMP(">", "T_OIL", 50), S(NO("COOLER"), CMP(">", "T_OIL", 45))), NO("M_PUMP")), OUT("COOLER")),
    R(CMP(">", "T_OIL", 55), OUT("W_TEMP")),
    R(S(CMP(">", "T_OIL", 65), TON("T_TEMP")), SET("AL_TEMP"))),
  N("Network 13 – Oil level low → stop",
    "Debounce 2 s against sloshing. Low level = air in the suction line = cavitation and pump damage → stop the pump.",
    R(S(NC("LVL_OK"), TON("T_LVL")), SET("AL_LVL"))),
  N("Network 14 – Filter clogged → warning, stop after 60 s",
    "Cold oil is thick and gives a high Δp over a clean filter, so the switch is only valid when the oil is ≥ 30 °C. Warning first (change the element), stop if it is not done in time (example 60 s; real plants: end of the shift).",
    R(S(NC("FILT_OK"), CMP(">=", "T_OIL", 30)), OUT("W_FILT")),
    R(S(NO("W_FILT"), TON("T_FILT")), SET("AL_FILT"))),
  N("Network 15 – Pump run-hour counter + service warning",
    "The rising edge of the 1 Hz clock bit gives one pulse per second while the pump runs; each pulse adds 1 s, hours = seconds / 3600. (A self-resetting timer would lose 1–2 scans per pulse = 2–4 % error.) Keep RUN_S retentive (Delta: latched D range; Siemens: 'Retain' in the DB). Start value 1999.98 h → the service warning comes after about 1 minute.",
    R(S(NO("M_PUMP"), PE("CLK1")), OUT("M_PLS1S")),
    R(NO("M_PLS1S"), CALC("RUN_S+1", "RUN_S"), CALC("RUN_S/3600", "RUN_H")),
    R(CMP(">=", "RUN_H", "SERV_H"), OUT("W_SERV"))),
  N("Network 16 – Alarm acknowledge",
    "One rising edge makes a one-scan pulse M_ACK (one edge memory, used once). Each alarm is reset only if its cause is gone.",
    R(PE("S_ACK"), OUT("M_ACK")),
    R(S(NO("M_ACK"), NO("QM1_OK"), NO("PTC_OK")), RST("AL_MOT")),
    R(NO("M_ACK"), RST("AL_FB"), RST("AL_PLOW"), RST("AL_CHG")),
    R(S(NO("M_ACK"), NO("LVL_OK")), RST("AL_LVL")),
    R(S(NO("M_ACK"), CMP("<", "T_OIL", 60)), RST("AL_TEMP")),
    R(S(NO("M_ACK"), NO("FILT_OK")), RST("AL_FILT")),
    R(S(NO("M_ACK"), CMP("<=", "P_RAW", 32511)), RST("AL_SENS"))),
  N("Network 17 – Flasher + lamps + ready signal",
    "Two timers make a 1 Hz flasher (0.5 s on, 0.5 s off). Red flashes while there is a trip, amber shows a warning, green = pressure ready.",
    R(S(NC("T_FL2"), TON("T_FL1")), OUT("M_FL")),
    R(S(NO("M_FL"), TON("T_FL2")), OUT("M_FL2")),
    R(S(NO("M_TRIP"), NO("M_FL")), OUT("H_FLT")),
    R(NO("M_RDY"), OUT("H_RDY")),
    R(P(NO("W_FILT"), NO("W_TEMP"), NO("W_SERV"), NO("W_STARTS"), NO("AL_PLOW"), NO("AL_CHG")), OUT("H_WRN"))),
];

/* ---------------- plant model: pump + accumulator (gas law) + tank temperature + contactors ----------------
 * Oil stored in the pressure side Vs [L]. Below the pre-charge only the line volume is compressed (stiff);
 * above it the accumulator takes oil: p_abs = p0 · (V0 / (V0 − Vacc))^n   (n = 1.4, fast – guide 25 §7.8).
 * Flows [L/min]: pump 5.39 when the motor runs in delta (2.0 in star) AND 0V5 closed; leakage 0.15; machine 6.0 while
 * CNC_MOVE; discharge valve 0V6 open: k·√p; relief 0V1 caps the pressure at 13 MPa.
 * Temperature: heat balance of 25 L oil (C ≈ 41 kJ/K), shown 3 × faster so you can see it. */
export const HPU = { V0: 4.0, p0abs: 9.09, n: 1.4, Vline: 1.0, K: 1400, Qp: 5.39, leak: 0.15, Qcons: 6.0, relief: 13.0, Tamb: 18, speed: 3 };
export function pFromV(Vs) {
  const { V0, p0abs, n, Vline, K } = HPU;
  const Vc = Vline * (p0abs - 0.1) / K;                 // oil to compress the lines up to the pre-charge
  if (Vs <= Vc) return Math.max(0, Vs / Vline * K);
  const Vacc = Math.min(Vs - Vc, V0 * 0.95);
  return p0abs * Math.pow(V0 / (V0 - Vacc), n) - 0.1;
}
export function vFromP(p) {
  const { V0, p0abs, n, Vline, K } = HPU;
  const Vc = Vline * (p0abs - 0.1) / K;
  if (p <= p0abs - 0.1) return Math.max(0, p) * Vline / K;
  return Vc + V0 * (1 - Math.pow(p0abs / (p + 0.1), 1 / n));
}
export function makePlant() {
  let Vs = 0, rpm = 0;
  const d1 = delayBit(0.03), d2 = delayBit(0.03), d3 = delayBit(0.03);
  return {
    reset() { Vs = 0; rpm = 0; },
    info: () => ({ p: pFromV(Vs), rpm, Vacc: Math.max(0, Vs - vFromP(HPU.p0abs - 0.1)) }),
    step(io, dt) {
      const g = io.get;
      // contactors: the safety relay opens the motor circuit by itself (hard-wired), the breaker -QM1 too
      const power = g("ESTOP_OK") && g("QM1_OK");
      const k1 = d1(!!g("KM1") && !!g("ESTOP_OK"), dt), k2 = d2(!!g("KM2") && !!g("ESTOP_OK"), dt), k3 = d3(!!g("KM3") && !!g("ESTOP_OK"), dt);
      io.set("KM1_FB", k1); io.set("KM2_FB", k2); io.set("KM3_FB", k3);
      const target = power && k1 && (k2 || k3) ? (k2 ? 1450 : 1380) : 0;
      rpm = lag(rpm, target, target ? 0.4 : 0.8, dt);
      const p = pFromV(Vs);
      let Q = 0;
      const loading = !!g("Y_0V5");
      if (loading) Q += HPU.Qp * rpm / 1450 * (k2 ? 1 : 0.6) * (1 - 0.004 * p);   // volumetric efficiency falls with p
      Q -= HPU.leak * Math.min(1, p / 10);
      if (g("CNC_MOVE")) Q -= HPU.Qcons * Math.min(1, p / 2);
      if (!g("Y_0V6")) Q -= 12 * Math.sqrt(Math.max(0, p) / 11.5);              // discharge valve open
      Vs = Math.max(0, Vs + Q * dt / 60);
      if (pFromV(Vs) > HPU.relief) Vs = vFromP(HPU.relief);                      // relief valve 0V1
      const pn = pFromV(Vs);
      io.set("P_RAW", Math.round(pn / 16 * 27648));
      // temperature (kW): pump losses + heater − natural cooling − cooler
      const C = 25 * 0.87 * 1.9;                                                  // kJ/K
      const Tn = +g("T_OIL");
      let P = 0;
      if (rpm > 100) P += loading ? 0.18 : 0.06;
      if (g("HEATER")) P += 1.0;
      P -= 0.0067 * (Tn - HPU.Tamb);
      if (g("COOLER") && rpm > 100) P -= 0.06 * (Tn - HPU.Tamb);
      io.set("T_OIL", Math.round((Tn + P / C * dt * HPU.speed) * 1000) / 1000);
    },
  };
}

export const PROGRAM = {
  id: "hpu", title: "Hydraulic power unit (HPU) – pump, accumulator, oil care", scanMs: 20,
  plc: { delta: { cpu: "AS332T-A + AS04AD-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "CPU 1215C DC/DC/DC + SM 1231 AI4 + SM 1222 DQ16", sw: "TIA Portal V19" } },
  tags, networks,
};

/* short "what to try" lines for the page */
export const TRY = [
  "Press <b>Start</b>: KM1 + KM3 (star) → after 5.0 s KM3 opens, 0.1 s gap, KM2 (delta). Only then 0V5 closes and the pressure rises.",
  "Watch the pressure: the pump loads up to 11.5 MPa, unloads, the leakage lets it fall to 10.8 MPa, the pump loads again (hysteresis).",
  "Oil starts at 18 °C → heater on, <i>not ready</i> until 20 °C. Drag T_OIL to 52 °C (cooler), 56 °C (warning), 66 °C (trip after 2 s).",
  "Click CNC_MOVE on/off: the machine takes 6 L/min, the pressure falls, at the falling edge the pump recharges to 11.5 MPa.",
  "Open LVL_OK → stop after 2 s. Open FILT_OK with oil ≥ 30 °C → amber warning, trip after 60 s. Open QM1_OK → motor alarm.",
  "Press <b>Stop</b>: 0V6 opens and dumps the accumulator – the pressure falls to 0 in a few seconds.",
];
