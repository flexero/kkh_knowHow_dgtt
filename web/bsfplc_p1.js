/* Item 8 – program 1: STANDARD MACHINE INTERFACE (template for every machine) on a simple example machine –
 * the automatic bandsaw MS-SAW-01 (type code 1, unit id 1, map V1.1 of item 4). The machine part is a 5-step chain
 * (wait → clamp → cut → saw up → unclamp + part done); the interface part (networks I1 – I14) is identical in every program.
 * All addresses, times and values are EXAMPLES – check with your PLC configuration. */
import { I, Q, M, W, T, NO, NC, CMP, TON, S, P, OUT, SET, RST, MOV, R, N, delayBit } from "./bsfplc_lib.js";

export const KEY = "std", TYPE = "MS-SAW", MID = "MS-SAW-01", LOTQTY = 4, RECIPE = 3, PART = "RAW-50CrMo4-D36";
export const TITLE = "Standard machine interface – template (example machine: bandsaw MS-SAW-01)";
export const PLC = { delta: { cpu: "AS332T-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "S7-1200 CPU 1215C DC/DC/DC", sw: "TIA Portal V19" } };
export const BTN = "1 · Standard interface (template)";
export const BASIS = "guide 43 §7.5 + §8 (register map V1.1, toggle-bit handshake, gateway heartbeat 226) · item 3 states · machine: bandsaw MS-SAW (item 2 op 10)";

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

export function build() {
  const G = "Machine sensors (from the plant – click = force)";
  const tags = [
    I("B_PART", "X0.0", "%I0.0", "Bar in the vice (photo sensor -BG1)", "-BG1 PNP, M12", false, { ui: "sensor", group: G }),
    I("B_CLAMPED", "X0.1", "%I0.1", "Vice clamped (pressure switch -BP1)", "-BP1", false, { ui: "sensor", group: G }),
    I("B_SAW_UP", "X0.2", "%I0.2", "Saw frame at the top (-BG2)", "-BG2 inductive", true, { ui: "sensor", group: G }),
    I("B_SAW_DN", "X0.3", "%I0.3", "Cut finished – saw frame at the bottom (-BG3)", "-BG3 inductive", false, { ui: "sensor", group: G }),
    I("B_BLADE", "X0.4", "%I0.4", "Blade monitor -BS1: band running, not broken", "-BS1 (speed monitor)", true, { group: "Faults + signals (click to simulate)" }),
    I("B_DOOR", "X0.5", "%I0.5", "Blade guard closed (-BG4 – the SAFETY function is the guard interlock on the safety relay; this is the status)", "-BG4 / -KF1", true, { group: "Faults + signals (click to simulate)" }),
    I("B_LENOK", "X0.6", "%I0.6", "Length gauge -BG5: cut length in tolerance (FALSE = scrap)", "-BG5", true, { ui: "sensor", group: G }),
    Q("Y_CLAMP", "Y0.0", "%Q0.0", "Vice clamp valve -MB1", "-MB1 24 V DC"),
    Q("Y_SAW", "Y0.1", "%Q0.1", "Band motor contactor -QA1 (2.2 kW)", "-QA1 A1/A2"),
    Q("Y_DOWN", "Y0.2", "%Q0.2", "Saw frame down (feed) valve -MB2 – feed speed set by the flow valve", "-MB2"),
    Q("Y_UP", "Y0.3", "%Q0.3", "Saw frame up valve -MB3", "-MB3"),
    M("ST0", "M0", "\"Saw\".Step0", "Step 0 – wait for start", true, { step: true, stepLabel: "0 wait" }),
    M("ST1", "M1", "\"Saw\".Step1", "Step 1 – clamp", false, { step: true, stepLabel: "1 clamp" }),
    M("ST2", "M2", "\"Saw\".Step2", "Step 2 – cut", false, { step: true, stepLabel: "2 cut" }),
    M("ST3", "M3", "\"Saw\".Step3", "Step 3 – saw up", false, { step: true, stepLabel: "3 up" }),
    M("ST4", "M4", "\"Saw\".Step4", "Step 4 – unclamp + part done", false, { step: true, stepLabel: "4 unclamp" }),
    M("M_INCYC", "M10", "\"Saw\".InCycle", "Machine in its cycle (steps 1 – 4) → status RUN"),
    M("M_PDONE", "M11", "\"Saw\".PartDone", "Part done – ONE scan pulse (counters, lot)"),
    M("M_POK", "M12", "\"Saw\".PartOk", "Part good (length gauge OK)"),
    M("M_ALM", "M13", "\"Saw\".Alarm", "Any alarm of the machine"),
    M("AL_TO", "M20", "\"Saw\".AlTimeout", "Alarm 153: clamp / cut time-out (feeder fault)"),
    M("AL_BLADE", "M21", "\"Saw\".AlBlade", "Alarm 151: blade broken / not running"),
    M("AL_DOOR", "M22", "\"Saw\".AlDoor", "Alarm 152: blade guard opened during the cycle (production stop)"),
    W("ALM_CODE", "D1000", "\"Saw\".AlarmCode", "Alarm code for std.alarm (0 = none, item 3 codes)", "", 0, "INT"),
    W("P_KW", "D1016 (float)", "\"BsfIf\".Power (Real)", "Electrical power (example: computed from the running loads; better an energy meter)", "kW", 0, "REAL"),
    T("T_CLAMP", "T0", "\"IDB_T_Clamp\" (TON)", "Clamp time-out", 3.0),
    T("T_CUT", "T1", "\"IDB_T_Cut\" (TON)", "Cut time-out (normal cut 25 s)", 60),
    T("T_UP", "T2", "\"IDB_T_Up\" (TON)", "Saw-up time-out", 10),
    T("T_BLADE", "T3", "\"IDB_T_Blade\" (TON)", "Blade monitor delay after motor start", 1.0),
  ];
  const networks = [
    N("Network 1 – First scan + step 0: wait for start",
      "Step chain with SET / RST: exactly one step bit is TRUE. Start a NEW cycle only when the interface says Enable (AUTO, started, MES lot loaded), a bar is in the vice, the saw is up, the guard is closed and no alarm.",
      R(NO("FIRST"), SET("ST0"), RST("ST1"), RST("ST2"), RST("ST3"), RST("ST4")),
      R(S(NO("ST0"), NO("M_ENABLE"), NO("B_PART"), NO("B_SAW_UP"), NO("B_DOOR"), NC("M_ALM")), SET("ST1"), RST("ST0"))),
    N("Network 2 – Step 1: clamp the bar (time-out 3 s)",
      "The vice valve is ON from step 1 to step 3. The pressure switch confirms the clamping force. No confirmation within 3 s → alarm 153.",
      R(S(NO("ST1"), NO("B_CLAMPED")), SET("ST2"), RST("ST1")),
      R(S(NO("ST1"), TON("T_CLAMP")), SET("AL_TO"))),
    N("Network 3 – Step 2: cut (band motor + feed down, time-out 60 s)",
      "The saw frame moves down with the feed set by the flow valve; the bottom sensor ends the cut. Cut time ≈ 25 s for a Ø36 mm bar (example).",
      R(S(NO("ST2"), NO("B_SAW_DN")), SET("ST3"), RST("ST2")),
      R(S(NO("ST2"), TON("T_CUT")), SET("AL_TO"))),
    N("Network 4 – Step 3: saw frame up",
      "Band motor off, frame up to the top sensor (time-out 10 s).",
      R(S(NO("ST3"), NO("B_SAW_UP")), SET("ST4"), RST("ST3")),
      R(S(NO("ST3"), TON("T_UP")), SET("AL_TO"))),
    N("Network 5 – Step 4: unclamp → part done (ONE scan pulse)",
      "When the vice is open the piece is finished: M_PDONE is TRUE for exactly one scan (the step bit ST4 is reset in the same rung) – the interface counts it (good / scrap from the length gauge) and adds it to the MES lot.",
      R(NO("B_LENOK"), OUT("M_POK")),
      R(S(NO("ST4"), NC("B_CLAMPED")), OUT("M_PDONE"), SET("ST0"), RST("ST4"))),
    N("Network 6 – Outputs",
      "One coil per output, written once (no double coils). The motion outputs have the interlocks in series: no feed without a running blade and a closed guard. The guard itself is monitored by the safety relay (hard-wired, STO / contactor) – this is only the standard program.",
      R(P(NO("ST1"), NO("ST2"), NO("ST3")), OUT("Y_CLAMP")),
      R(S(NO("ST2"), NC("M_ALM"), NO("B_DOOR")), OUT("Y_SAW")),
      R(S(NO("ST2"), NC("M_ALM"), NO("B_DOOR"), NO("B_BLADE")), OUT("Y_DOWN")),
      R(S(NO("ST3"), NC("M_ALM")), OUT("Y_UP"))),
    N("Network 7 – Alarms (latched) + acknowledge",
      "Each alarm is latched with SET and reset with the acknowledge pulse (local button OR MES command 4) only when its cause is gone. The blade monitor needs 1 s after the motor start.",
      R(S(NO("M_INCYC"), NC("B_DOOR")), SET("AL_DOOR")),
      R(S(NO("Y_SAW"), NC("B_BLADE"), TON("T_BLADE")), SET("AL_BLADE")),
      R(S(NO("M_ACKP"), NO("B_DOOR")), RST("AL_DOOR")),
      R(S(NO("M_ACKP"), NO("B_BLADE")), RST("AL_BLADE")),
      R(NO("M_ACKP"), RST("AL_TO"))),
    N("Network 8 – Alarm summary + alarm code (std.alarm)",
      "The LAST matching MOVE wins, so the most important alarm is written last.",
      R(P(NO("AL_TO"), NO("AL_BLADE"), NO("AL_DOOR")), OUT("M_ALM")),
      R(NC("M_ALM"), MOV(0, "ALM_CODE")),
      R(NO("AL_TO"), MOV(153, "ALM_CODE")),
      R(NO("AL_BLADE"), MOV(151, "ALM_CODE")),
      R(NO("AL_DOOR"), MOV(152, "ALM_CODE"))),
    N("Network 9 – In cycle + power (example)",
      "In cycle = any of the steps 1 – 4 (status RUN, cycle-time stopwatch). Power from the running loads: hydraulics 0.8 kW, band motor + hydraulics 4.6 kW (example – a Modbus energy meter is better).",
      R(P(NO("ST1"), NO("ST2"), NO("ST3"), NO("ST4")), OUT("M_INCYC")),
      R(NO("ON"), MOV(0.8, "P_KW")),
      R(NO("Y_SAW"), MOV(4.6, "P_KW"))),
  ];
  const hooks = { inCycle: "M_INCYC", partDone: "M_PDONE", partOk: "M_POK", alarm: "M_ALM", alarmCode: "ALM_CODE", partPresent: "B_PART", power: "P_KW" };
  /* plant: vice, saw frame, bar feed, length gauge */
  let R0 = rng(11), pos = 0, feedT = 0, cl = delayBit(0.6, 0.4);
  const plant = {
    step(st, dt) {
      st.B_CLAMPED = cl(!!st.Y_CLAMP, dt);
      if (st.Y_DOWN) pos = Math.min(1, pos + dt / 25);
      if (st.Y_UP) pos = Math.max(0, pos - dt / 3);
      st.B_SAW_UP = pos <= 0.001; st.B_SAW_DN = pos >= 0.999;
      if (st.Y_SAW && pos < 0.05 && st.Y_DOWN) st.B_LENOK = R0() > 0.08;   // length result decided at the start of the cut (8 % scrap, example)
      if (st.M_PDONE) { st.B_PART = false; feedT = 2.0; }                  // bar feed indexes the next section
      if (feedT > 0) { feedT -= dt; if (feedT <= 0) st.B_PART = true; }
    },
    reset(st) { R0 = rng(11); pos = 0; feedT = 0; cl.reset(); st.B_PART = true; st.B_SAW_UP = true; st.B_LENOK = true; },
    info: () => ({ pos }),
  };
  plant.reset({});
  const tagsInit = tags.find((t) => t.name === "B_PART"); tagsInit.init = true;
  return { tags, networks, hooks, process: [], plant };
}

export const TRY = [
  "Press <b>Run</b> (it starts by itself). The simulated gateway sees READY, writes an order (FC16 200 – 225) and toggles REQ (FC06 202): watch <b>hs.status</b> ACK and BUSY in the register table, then command 2 starts the saw.",
  "Follow the step strip 0 → 4. At every part-done pulse <b>std.good</b> (registers 20 – 21) or <b>std.scrap</b> counts and <b>hs.lotDone</b> (11) grows. After 4 pieces DONE toggles and BUSY drops – the gateway logs the MES confirmation.",
  "Open the blade guard <b>B_DOOR</b> during a cut: alarm 152 → std.status = 8 (bit 3 ALARM; bit 4 stays 0 – the guard is not the e-stop), std.stateCode = 4, std.alarm = 152. Close it and press <b>S_ACK</b> (or send command 4). Press <b>ESTOP_OK</b> instead: status = 8 + 16 = 24.",
  "Tick <b>gateway lost</b>: the gateway heartbeat 226 stops counting, after 5 s H_GW lights, READY = 0. (Tick <b>no heartbeat 226</b> = an old V1.0 gateway that still polls: same result – the PLC needs 226.) The saw finishes its lot; no new order comes. Untick: the gateway sees the changed DONE bit and continues.",
  "Send command 1 with quantity 0 → result 3 (bad data); send command 2 without a lot → result 2 (not ready). The REJECT bit (hs.status bit 3) shows it.",
];
export const NOTES = {
  io: "Machine I/O on the CPU (X0.0 … / %I0.0 …), operator panel of the standard interface on the first DI module (X1.0 … / %I8.0 …).",
  timing: [["scan time (example)", "20 ms"], ["gateway fast poll during a command", "100 ms"], ["gateway normal poll (fast block)", "500 ms"], ["ACK after REQ (PLC)", "≤ 1 scan = 20 ms"], ["ACK seen by the gateway", "≤ 100 ms (next poll)"], ["gateway heartbeat 226 (written by the gateway)", "+1 per s (FC06)"], ["gateway watchdog", "226 unchanged 5 s (TOF)"], ["heartbeat", "+1 per s (wraps 65535 → 0)"], ["cycle (example)", "clamp 0.6 s + cut 25 s + up 3 s + unclamp 0.4 s ≈ 29 s + scan delays"]],
  safety: "The blade guard and the e-stop are wired to the safety relay -KF1 (e.g. Pilz PNOZ s4, Schmersal SRB-E, Phoenix PSRmini): it switches the motor contactor / STO itself. The PLC only reads ESTOP_OK and B_DOOR to show the state and to stop the step chain cleanly.",
};

export function panel(st, info, U) {
  const step = ["ST0", "ST1", "ST2", "ST3", "ST4"].find((s) => st[s]) || "–";
  return U.gauge("Saw frame", `${((info.pos || 0) * 100).toFixed(0)} % of the cut`, `${U.bar(info.pos || 0, 0, 1)}<small>step ${step} · vice ${U.onoff(st.B_CLAMPED, "clamped", "open")} · band ${U.onoff(st.Y_SAW, "running")} · bar ${U.onoff(st.B_PART, "present", "feeding")}</small>`)
    + U.gauge("Interface", `${st.M_RUNREQ ? "run request" : "stopped"}`, `<small>enable ${U.onoff(st.M_ENABLE, "1", "0")} · gateway ${U.onoff(st.M_GWOK, "alive", "LOST")} · alarm ${st.ALM_CODE || 0}</small>`);
}
