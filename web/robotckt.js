/* ROBOT tab – item 3 "Control circuits – electrical schematics" (UI + live simulation of the circuits).
 * Files: robotckt_calc.js (numbers) · robotckt_sym.js (symbols, frame, cross-references) · robotckt_pages.js (9 schematic pages) · this file.
 * Guide: docs/24_robot_control_circuits.md. Built lazily on the first "rbitemshow" event with detail "3" (fired by robotctl.js).
 * URL (tests + deep links): &rbitem=3 · &ckpage=1..9 · &ckrb=irb4600 · &ckestop (pendant e-stop pressed) · &ckgate (gate opened after a request)
 *   · &ckcross (short A–B) · &ckweld (K1 welded, then e-stop) · &ckstuck (gate OSSD2 stuck, gate opened) · &ckshort (valve short circuit, -F24 trips)
 *   · &ckt1 (mode T1) · &ckq1off · &ckemc=pigtail|peloop|zero|diode|parallel · &ckinfo=K1 (open an info box) · &cktest (numbers + logic self-check in the console)
 *   · &ckback (switch to item 1, 2, back to 3 and report errors) · &ckhold (test: keep the load event pending for headless screenshots) · &ckdbg (loop timing) · &ckcard=calc|bom|test|legend (scroll to a card)
 * Offline, no libraries. All values are EXAMPLES / ESTIMATES – the real design follows IEC 60204-1, the supplier's manuals and a qualified designer.
 */
import { ROBOTS, robotById, fk } from "./robotkin.js";
import { SIM } from "./robotsim.js";
import { CTL } from "./robotctl_core.js";
import { calc, busProfile, EX, CTRL, AMP_C } from "./robotckt_calc.js";
import { pen, REG, esc, PW, PH } from "./robotckt_sym.js";
import { drawPage, NPAGES, PAGE_TITLES, NET_LINKS } from "./robotckt_pages.js";

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const f = (v, d = 1) => (+v).toFixed(d);
const errs = [];
window.addEventListener("error", (e) => errs.push(e.message));
// test only (&ckhold): an image on the never-ending SSE stream keeps the load event pending, so headless screenshots wait for --timeout
if (Q.has("ckhold")) { const fr = document.createElement("iframe"); fr.src = "/api/stream?ckhold=" + Date.now(); fr.title = "test"; fr.style.display = "none"; document.body.appendChild(fr); setTimeout(() => { if (typeof window.showTab === "function") window.showTab("robot"); }, 300); }

/* ------------------------------------------------------------------ texts per page: what you see / why it matters */
const WHY = [
  ["the 400 V supply from the main switch -Q1 to every consumer: robot controller, conveyor motors (with the safety contactors -K1/-K2), the 24 V power supply, light and socket, and the PE bar.", "every cable and protective device is sized from these currents. The main switch is the place where you switch off and LOCK the whole cell before work."],
  ["one servo axis inside the robot controller: rectifier → DC bus (565 V) → IGBT inverter → motor, plus precharge, brake chopper, STO and the 24 V holding brake. The chart shows the DC bus during a motion: when the axes brake, energy flows back and the chopper burns it.", "this explains alarms like 'DC bus over-voltage', why the capacitors are dangerous after switch-off, and how STO removes the torque without opening the power."],
  ["the 24 V DC control supply: one power supply -T1, electronic circuit breakers per branch, 0 V earthed at ONE point (PELV).", "a short circuit at one valve must not switch off the safety PLC or the brakes. The power budget shows if the supply is big enough."],
  ["the safety circuits, dual channel: e-stops, gate switch with guard locking, enabling device, mode selector, reset, the safety PLC and its outputs to the robot (ES/AS → STO), the conveyor contactors -K1/-K2 with feedback (EDM) and the machine interlock.", "this is the most important page: it decides if a person is safe. Two channels + test pulses + feedback = one fault never removes the safety function (Category 3, PL d)."],
  ["the wiring of the robot I/O: PNP sensors (3-wire), machine contacts, a limit switch, NPN for comparison, outputs to a valve (flyback diode), interposing relays to the machine (potential-free contacts) and a 4–20 mA analog sensor.", "most faults in a real cell are I/O faults (wrong sensor type, missing diode, wire break). The signal names are the same as in item 2."],
  ["the network of the cell: PROFINET star + line, safety over the bus (PROFIsafe), HMI, machine, and the uplink to the MES through a firewall.", "cycle times, cable types and the OT/IT separation decide if the cell is fast, robust and secure."],
  ["earthing and EMC: PE star point, mounting plate as reference, 360° shield clamps, separation of power and signal cables, filter at the entry, 0 V earthed at one point, flyback diodes. Choose a typical fault to see where it is and what it causes.", "EMC faults give random, hard-to-find errors (encoder errors, bus errors, sensor flicker). Most come from a few wiring mistakes."],
  ["the front view of the mounting plate (where each device sits, cable ducts, zones) and the door, with the heat calculation of the cabinet.", "a good layout separates power and control, keeps the wiring short and lets the heat out. Too hot = short life of the electronics."],
  ["the classic variant of the e-stop circuit with a safety relay (fixed logic), feedback loop and monitored reset. It reacts to the same e-stop buttons.", "for a very small cell this is enough; the comparison shows why a robot cell normally uses a safety PLC."],
];

/* ------------------------------------------------------------------ component information (what, rating, why, check, failure) */
const I = (t, w, r, y, c, fl) => ({ t, w, r, y, c, f: fl });
const INFO = {
  Q1: I("-Q1 main switch (supply disconnecting device)", "Switches off all phases of the cell cabinet. Rotary handle on the door, red handle on yellow background when it is also the emergency switching-off device.", (K) => `${K.main.Q1} A, 3-pole, AC-23 rating, lockable in OFF with padlocks`, "IEC 60204-1 §5.3: one disconnecting device per machine; lock-out / tag-out (LOTO) before any work.", "Handle locks only in OFF? Door interlock works? Label 'main switch'.", "Burnt contacts after switching under overload; missing padlock → someone switches on during work."),
  F1: I("-F1 main fuses", "Protect the busbars and cables in the cabinet against short circuits.", (K) => `gG ${K.main.In} A (≥ 1.25 × ${f(K.main.Imax, 1)} A max. phase current and ≥ 1.6 × biggest MCB for selectivity)`, "Without selectivity a short circuit in one branch switches off the whole cell.", "Fuse rating = drawing; the upstream fuse in the factory distribution must be bigger.", "Aged fuse blows at start-up current; wrong (fast) fuse type."),
  F2: I("-F2 MCB robot controller", "Miniature circuit breaker (thermal + magnetic trip) for the robot controller feed.", (K) => `C${K.rbFeed.In} A, I_b = ${f(K.rbFeed.Ib, 2)} A, cable ${K.rbFeed.A} mm²`, "C-curve because the controller charges its DC-bus capacitors at power-on (precharge limits the inrush). The supplier manual gives the exact fuse.", "Rating from the controller manual; loop impedance measured (Z_s ≤ U0/I_a).", "Trips at power-on (precharge relay defective) or after a short circuit in the drives."),
  A1: I("-A1 robot controller", "The supplier's controller cabinet: main computer, axis computer, 6 servo drives, safety controller, I/O. Fed with 400 V from -F2.", (K) => `${K.c.S} kVA (example), ${K.c.ph === 3 ? "3/PE AC 400 V" : "1/N/PE AC 230 V"}, ${K.rb.ctrl}`, "All robot power goes through this feed; page 2 shows the power stage inside.", "Supply voltage ±10 %, phase sequence, PE connection, distance to heat sources.", "Mains dips → 'DC bus under-voltage'; missing phase."),
  K1: I("-K1 safety contactor 1 (conveyor power)", "Contactor with mirror contacts (IEC 60947-4-1 Annex F): its auxiliary NC 21-22 is always open when a main contact is closed – even if a main contact is welded.", "AC-3 ≥ 4 kW, coil 24 V DC 3 W, 1 NC mirror contact", "Two contactors in series (-K1 + -K2) = redundancy: if one welds, the other still stops the motor. The safety PLC reads both NC contacts (EDM) and blocks the restart.", "Coil voltage, mirror contact wired to F-DI10, switching test every shift (automatic by the PLC at each stop).", "Welded main contact after a short circuit or too many switching cycles (B10d)."),
  K2: I("-K2 safety contactor 2", "Second, independent contactor in series with -K1, own safety output F-DQ5.", "same as -K1", "Category 3: a single fault (welded K1) does not remove the safety function.", "Both contactors must drop when F-DQ4/5 switch off – check the EDM input.", "Same as -K1; also wiring both coils from ONE output (wrong: then one fault drops the redundancy)."),
  Q11: I("-Q11 / -Q12 motor-protective circuit breaker (MPCB)", "Thermal overload + magnetic short-circuit trip + manual switch for a small motor.", (K) => `range ${K.conv.mpcb}, set to the motor rated current ${f(K.conv.In, 2)} A`, "Protects the motor winding (overload) and the cable (short circuit).", "Setting = name-plate current; trip class 10.", "Set too high → motor burns; set too low → trips at every start."),
  K11: I("-K11 / -K12 conveyor contactor (function)", "Switches the conveyor ON/OFF for the process (PLC output). Not a safety device – safety is -K1/-K2.", "AC-3 4 kW, coil 24 V DC with suppressor diode", "Separates the normal function from the safety function.", "Coil suppressor fitted, LED on the PLC output.", "Contact wear (many cycles)."),
  Q12: null, K12: null,
  M11: I("-M11 / -M12 conveyor motor", "3-phase asynchronous motor with gearbox, star connection (400 V).", (K) => `${K.conv.P} kW, I_n ≈ ${f(K.conv.In, 2)} A, η ${K.conv.eta}, cos φ ${K.conv.cos}, start ≈ ${K.conv.kStart} × I_n`, "Small motors are switched directly (DOL); for soft start or speed control use a VFD (then: shielded motor cable, page 7).", "Direction of rotation, current at full load, PE connected.", "Bearing wear, winding insulation (measure > 1 MΩ)."),
  T1: I("-T1 24 V DC power supply", "Switched-mode power supply 230 V AC → 24 V DC (SELV/PELV), with power-factor correction.", (K) => `24 V, ${K.psu.A} A, load ${f(K.psu.I, 1)} A = ${K.psu.load} % (rule: ≤ 80 %), input ${f(K.psu.IinRated, 1)} A`, "Feeds all control circuits; 0 V is earthed at one point (PELV) so an earth fault is a short circuit that trips, not a hidden danger.", "Output voltage 24.0–24.5 V at the farthest load ≥ 21.6 V (IEC 61131-2 allows 19.2–30 V).", "Fan / capacitor ageing (heat!) → ripple, drop-outs."),
  F3: I("-F3 MCB for the power supply", "Protects the PSU feed (1P+N).", (K) => `C${K.psu.mcb} A (PSU inrush current), cable 1.5 mm²`, "Inrush of switched-mode supplies can be 30–60 A for a few ms → C curve.", "Rating from the PSU datasheet.", "Nuisance trip at switch-on with B curve."),
  F4: I("-F4 RCBO (MCB + residual current device 30 mA)", "Protects the cabinet light, the service socket and the fan. Trips when current leaks to earth (e.g. through a person).", "B10 A, IΔn = 30 mA, type A", "IEC 60364-4-41: sockets for general use need 30 mA RCD protection. The robot controller feed normally has NO 30 mA RCD (drive leakage currents; if an RCD is required: type B, check the manual).", "Test button every 6 months, trip time measured at commissioning (≤ 300 ms at IΔn).", "Trips because of a wet cable / a defective tool."),
  XD1: I("-XD1 service socket 230 V", "For a laptop or a hand lamp during service.", "16 A socket, behind -F4 (30 mA)", "Must stay live when -Q1 is off? Then it needs its own supply ahead of -Q1, orange wires and a warning label (IEC 60204-1 §5.3.5).", "Label, RCD test.", "Overload by heaters."),
  E2: I("-E2 filter fan + -B9 thermostat", "Blows cool air into the cabinet when the inside temperature is above 35 °C.", (K) => `${K.heat.fan} m³/h free-blowing (with filter ≈ half), needed ${f(K.heat.Vdot, 0)} m³/h (page 8)`, "Electronics live ~ half as long for every 10 K more (rule of thumb).", "Filter clean, air flow direction (in at the bottom, out at the top).", "Clogged filter → over-temperature alarms in summer."),
  A50: I("-A50 machine tool interface", "The CNC machine has its own cabinet and supply. The cell talks to it with signals (page 5) and safety interlocks (page 4).", "potential-free contacts, external voltage = orange wires", "Separate supplies: our main switch does not switch off the machine → orange wires + warning label for voltages that stay on.", "All interface signals tested in both directions, labels for external voltage.", "Mixed 0 V references between two controllers → use relays (potential-free)."),
  PE: I("-PE main earth bar", "Collects all protective earth conductors (star) and connects them to the incoming PE and the mounting plate.", "Cu bar, PE conductor ≥ phase cross-section up to 16 mm²", "In TN-S a fault L→housing becomes a short circuit L→PE that trips the MCB within 0.4 s (protection against electric shock).", "Continuity test ≤ 0.1 Ω (example) from the bar to each housing.", "Loose PE screw → dangerous touch voltage in a fault."),
  K40: I("-K40 drive contactor (in the robot controller)", "Switches the 400 V to the drive rectifier. Opens after an e-stop when the robot is in STO (cat 1: stop first, then power off).", "AC-3, controlled by the robot controller", "Separates the drives from the mains for longer stops; the fast safety function is STO, not this contactor.", "Contact state in the controller diagnosis.", "Contact wear."),
  Z1: I("-Z1 EMC line filter", "Inductors + capacitors that keep the high-frequency noise of the PWM inverters out of the mains.", "rated current ≥ drive input, leakage current to PE several mA", "Without filter the PWM noise disturbs other machines and the factory network.", "Mounted on the bare mounting plate near the inverter, input and output cables apart (page 7).", "High leakage current → 30 mA RCDs trip (do not use them on drives)."),
  V1: I("-V1 3-phase diode rectifier (B6 bridge)", "6 diodes turn the 3-phase AC into DC: the bus charges to the peak of the line-line voltage.", "V_DC = √2 · 400 V = 565 V (no load)", "Diodes conduct only one way: braking energy cannot go back to the mains → chopper needed.", "Mains voltage, phase loss detection.", "Diode failure after over-voltage (lightning, mains switching)."),
  R41: I("-R41 precharge resistor + -K41 bypass", "At power-on the empty capacitors would draw a huge current. The resistor limits it; when the bus is charged, -K41 shorts the resistor.", (K) => `47 Ω → peak ${f(K.bus.Ipre, 0)} A, τ = R·C = ${K.bus.tau} ms, charged after ≈ 5τ = ${f(K.bus.tau * 5 / 1000, 2)} s`, "Protects the rectifier, the fuses and the capacitors.", "'Precharge fault' alarm in the drive.", "Bypass relay does not close → resistor burns at the first motion."),
  C1: I("-C1 DC-bus capacitors", "Store energy and keep the DC voltage stiff while the inverter switches.", (K) => `2 mF, energy ½·C·U² = ${K.bus.E} J at 565 V, ${K.bus.E750} J at 750 V`, "The 6 axes share the bus: a braking axis feeds the accelerating ones.", "DANGER: wait until < 60 V (label, e.g. 5 min) and MEASURE before you touch.", "Capacitor ageing (heat) → ripple, 'DC bus' alarms."),
  R42: I("-R42 bleed resistor", "Discharges the capacitors after switch-off.", (K) => `22 kΩ: P = U²/R = ${K.bus.Pbl} W, time to 60 V: t = R·C·ln(565/60) = ${K.bus.tBl} s`, "IEC 60204-1 §6.2.4: < 60 V within 5 s, OR a warning label with the waiting time.", "Measure the bus voltage after switch-off.", "Open resistor → the bus stays charged for a long time."),
  R43: I("-R43 brake resistor", "Turns braking energy into heat when the chopper switches it on.", (K) => `${K.regen.R} Ω: peak P = 750²/${K.regen.R} = ${f(K.regen.Pchop, 1)} kW ≥ 1.2 × ${f(K.regen.Ppk, 1)} kW braking peak (J1–J3); average ≈ ${K.regen.Pavg} W for one full stop every 10 s. Item 2 shows one axis with 40 Ω.`, "Without it the DC bus voltage rises at every stop → over-voltage trip.", "Resistance value, temperature, free air around it.", "Broken resistor → 'DC bus over-voltage' at fast stops."),
  V3: I("-V3 brake chopper (IGBT)", "Electronic switch: on above 750 V, off below 730 V (hysteresis).", "IGBT 1200 V class", "Keeps the bus below the IGBT voltage limit.", "Chopper diagnosis in the drive.", "IGBT short → resistor always on, overheats."),
  A11: I("-A11 inverter axis 1 (IGBT 6-pack)", "3 half-bridges switch the DC bus to the motor phases with PWM (8 kHz). The current loop (field-oriented control) sets the torque current.", (K) => `peak ${f(K.axes[0].iPeak, 1)} A, rated ≈ ${f(K.axes[0].iRated, 1)} A, K_t ≈ ${f(K.axes[0].Kt, 2)} N·m/A (estimates, item 2)`, "Motor torque τ = K_t · I_q.", "Drive event log, IGBT temperature.", "IGBT failure after overload or over-temperature."),
  M1: I("-M1 servo motor axis 1", "Permanent-magnet AC servo motor with holding brake -Y1 and absolute encoder -B1.", (K) => `n_mot ${K.axes[0].nMot} rpm, peak torque ${f(K.axes[0].tm, 1)} N·m (estimate), gear ${K.axes[0].n}:1`, "Its PE + shield must be connected at both ends (page 7).", "Insulation of the motor cable, brake function (brake test).", "Encoder or brake failure, bearing noise."),
  B11: I("-B11 current sensors", "Hall / shunt sensors measure the phase currents (2 are enough: i_V = −i_U − i_W).", "bandwidth > 10 kHz", "The current loop needs the real current every 62.5 µs; also over-current protection.", "Offset calibration at power-on.", "Sensor drift → torque ripple."),
  W11: I("-W11 motor cable (shielded)", "4 cores + shield (+ brake pair). The shield carries the high-frequency PWM noise back to the drive.", "length e.g. 7–30 m, robot-cable class (flexible)", "Shield 360° at BOTH ends; without it: encoder errors, bus errors, noisy sensors.", "Shield clamps, no pigtails (page 7).", "Damaged by fork-lifts or sharp edges."),
  STO: I("STO – safe torque off (gate driver supply)", "Two independent channels (STO-A, STO-B) switch off the supply of the IGBT gate drivers. Without gate pulses the inverter cannot make a rotating field → no torque. Power stays on the DC bus.", "IEC 61800-5-2, PL e / SIL 3 drive function (robot supplier: PL d Cat 3 for the whole robot safety)", "Fast (ms), no contactor wear, used at the end of every cat 0 / cat 1 stop. STO is NOT isolation: the motor terminals are still live (565 V)!", "Test: STO with the motor running → the motor coasts / brake holds; discrepancy between A and B detected.", "Discrepancy fault after a wiring fault; never use STO for electrical work – use -Q1."),
  A10: I("-A10 axis computer", "Calculates the current setpoints for all axes (position + speed loops 0.5 ms) and sends PWM commands to the gate drivers.", "current loop 62.5 µs, PWM 8 kHz", "See item 2 (servo loops).", "Communication to the drives / SMB.", "Encoder communication error."),
  B1e: I("-B1 encoder (in the motor)", "Absolute single-turn encoder (e.g. 20 bit) on the motor shaft, serial interface.", "shielded twisted pairs to the SMB", "Gives the motor position for commutation and the position loop.", "Shield, plugs.", "EMC noise → 'encoder communication error'."),
  A20: I("-A20 serial measurement board (SMB) + -G1 battery", "In the robot base: reads the 6 encoders, counts motor revolutions and keeps them with a battery when the power is off.", "battery life e.g. 2–3 years (check the manual)", "Without the battery the robot forgets its position → re-calibration.", "Battery warning in the pendant – change it in time (with power ON).", "Empty battery → 'revolution counter not updated'."),
  A12: I("-A12 … -A16 inverters axes 2–6", "Same as axis 1, all on the same DC bus.", (K) => K.axes.slice(1).map((a) => `J${a.j} î ${f(a.iPeak, 1)} A`).join(" · "), "Common DC bus: braking energy of one axis is used by the others.", "Drive diagnosis per axis.", "—"),
  K42: I("-K42 / -K43 brake release (SBC – safe brake control)", "The holding brake is a spring brake: 24 V = released, 0 V = applied. Two switches (one in +24 V, one in 0 V), controlled by two channels of the safety controller.", (K) => `brake current ≈ ${K.c.brake} A per motor (estimate), suppressor across the coil`, "If one switch welds, the other still applies the brake (redundancy). The brake also holds the arm when the power fails.", "Cyclic brake test (item 2): the drive applies torque against the closed brake.", "Worn brake (oil, wear) → arm sags at power-off."),
  X3: I("-X3 link 0 V – PE (PELV)", "The only connection between 0 V of the 24 V system and PE.", "removable link terminal", "An earth fault on +24 V then becomes a short circuit (ECB trips) instead of a hidden fault that could start a valve. Open it only for the insulation test.", "Exactly ONE link in the whole 24 V system (also check the robot controller manual).", "0 V not earthed: a 2nd earth fault can switch on an output by itself."),
  G2: I("-G2 buffer module", "Capacitor buffer: keeps 24 V for ~0.2–1 s during short mains dips.", "24 V, 20 A, 0.5 s (example)", "Avoids PLC restarts and lost network connections at a mains dip.", "Function test: switch off -F3 briefly.", "Capacitor ageing."),
  S1: I("-S1 emergency stop – teach pendant", "Red mushroom button on yellow, 2 NC contacts with positive opening (⊖: the contacts are forced open mechanically, even if welded). Latching: stays pressed until turned.", "IEC 60947-5-5, ISO 13850, B10d e.g. 100 000", "One NC per channel. Pressing it opens BOTH channels → safety PLC → ES1/ES2 off → robot stop cat 1 → STO.", "Test each e-stop monthly (example); each channel separately at commissioning.", "Contact block loose from the button (dangerous!) – use buttons with self-monitoring contact blocks."),
  S2: I("-S2 emergency stop – cabinet door", "Same type as -S1.", "2 NC positive opening", "Every operator station needs an e-stop (IEC 60204-1 §10.7).", "Same as -S1.", "—"),
  S3: I("-S3 emergency stop – cell door station", "At the cell door / operator panel.", "2 NC positive opening", "Reachable from where the hazard is seen.", "Same as -S1.", "Damaged cable to the field station."),
  B1: I("-B1 coded safety gate switch with guard locking", "RFID-coded actuator on the gate (cannot be cheated with a simple magnet), 2 OSSD outputs (semiconductor, own test pulses), lock solenoid -Y10 (power to unlock).", "ISO 14119 type 4, high coding, PL e, holding force e.g. 2000 N", "Gate open in AUTO → protective stop. Locking keeps the gate closed until the robot is stopped (needed when the stopping time is longer than the time to reach the hazard).", "Gate test every shift (opening must stop the robot), locking test, actuator fixed with one-way screws.", "Actuator misaligned → nuisance stops; bypassing (tampering) → ISO 14119 requires to prevent it."),
  S4: I("-S4 enabling device (3-position, in the pendant)", "Released (1) = off · middle (2) = enable · pressed through (3, panic) = off. 2 contacts, closed only in the middle.", "IEC 60947-5-8, 2 channels", "In T1 a person may be in the cell: motion only while the enabling device is in the middle (people release or squeeze it in panic).", "Test all 3 positions daily (example).", "Worn switch → no enable; never tape it in the middle!"),
  S5: I("-S5 operating mode selector (key)", "AUTO / T1 (T2), 1-of-2 contacts read by the safety PLC (exactly one must be closed).", "key switch, removable key per mode", "Mode change = protective stop. In T1 the speed is limited to 250 mm/s and the gate may be open (with enabling).", "Both contacts never 1 or 0 at the same time (else fault).", "Wire break → 'mode fault'."),
  S6: I("-S6 reset button (manual reset)", "Blue illuminated push button, OUTSIDE the cell, where the whole cell can be seen. Reset on release (falling edge).", "1 NO, lamp -P1 flashes when a reset is needed", "ISO 13849-1 §5.2.2: a reset must not start the machine; it only allows a new start. A person inside the cell must not be overlooked.", "Reset impossible from inside; reset with the gate open impossible (in AUTO).", "Button inside the cell or out of sight (wrong design)."),
  S7: I("-S7 request entry", "Asks the safety PLC to stop the robot and unlock the gate.", "1 NO, illuminated", "Guard locking: the gate opens only after the robot has stopped (stopping time + monitoring).", "Gate opens only after standstill.", "—"),
  EDM: I("EDM – external device monitoring (feedback loop)", "The NC mirror contacts of -K1 and -K2 in series to F-DI10. When the outputs are off, the loop must be closed; when on, open.", "test pulse T1, read by F-DI10", "Detects a welded contactor at the next stop → no restart (Category 3: fault detected at or before the next demand).", "Simulate: weld fault – reset is refused.", "Wire to the NO contact by mistake (then EDM does nothing)."),
  A2: I("-A2 safety PLC (F-CPU + F-I/O)", "A PLC with two processors / diverse software that runs the safety program (certified function blocks: E-stop, safety door, enabling, feedback monitoring) and the normal line program.", "PL e / SIL 3 capable, F-DI with test pulses (T1/T2), F-DQ switching P/M, cycle e.g. 10 ms", "Flexible logic, diagnosis WHICH button and WHICH fault, PROFIsafe to the robot.", "Safety program signature (CRC) documented; validation after every change.", "Discrepancy faults from wiring; changed program without re-validation (organisational fault)."),
  A1s: I("-A1 robot controller safety inputs (ES / AS)", "Dual-channel inputs of the robot safety controller. ES = emergency stop, AS = automatic (protective) stop – active only in AUTO.", "2 × 24 V per function, or the same signals over PROFIsafe", "The robot does the stop itself: SS1 (cat 1: ramp on the path, then STO + brakes). Same states as item 2.", "Test each channel separately: open one → discrepancy fault.", "Wiring both channels in one cable without protection (short circuit A–B) – test pulses detect it."),
  Y10: I("-Y10 guard locking solenoid", "Inside -B1. Power to unlock (fail-safe: the lock stays closed when the power fails).", "24 V DC, ≈ 0.5 A", "ISO 14119: locking needed when the person could reach the hazard before the robot stops.", "Gate cannot open while the robot moves.", "Emergency release from inside the cell must exist (escape release)."),
  K5: I("-K5 / -K6 safety relays to the machine", "Relays with force-guided contacts (IEC 61810-3): NO and NC can never be closed at the same time.", "1 NO + 1 NC, 24 V DC coil", "Give the machine a potential-free, dual-channel signal 'robot out of the machine' (door may close / machine may start).", "Machine safety input sees both channels; NC feedback can be read.", "Welded contact (detected via the NC by the machine)."),
  K6: null,
  K5c: I("Machine interlock contacts", "Two potential-free contacts in the machine's own safety circuit (orange = machine voltage).", "dual channel, external 24 V", "The machine never closes the door or starts while the robot is inside (item 2: soRobotInZone / siMachDoorSafe).", "Test: robot inside → machine cannot close the door.", "—"),
  P1: I("-P1 reset lamp", "Flashes when a reset is needed (standard output).", "24 V LED", "Tells the operator what to do.", "—", "—"),
  B11s: I("-B11 PNP sensor diPartReady (3-wire)", "Optical / inductive sensor with a PNP (sourcing) output: switches +24 V to the black wire.", "10–30 V DC, 200 mA max output, own consumption ≈ 10–25 mA, M12 4-pin", "PNP is the European standard: the input reads +24 V = 1, a broken wire = 0 (safe for 'part present' signals).", "LED on the sensor AND on the input card; switching distance.", "Wrong type (NPN), dirty optics, loose M12 plug."),
  B12: I("-B12 gripper sensor diGripClosed", "Magnetic cylinder sensor (PNP, 3-wire) in the slot of the gripper cylinder.", "10–30 V DC, PNP NO", "Confirmation: the gripper really closed + part present (item 2 handshake).", "Position in the slot, cable strain relief on the robot arm.", "Cable break in the arm (moving cable!)."),
  B13: I("-B13 gripper sensor diGripOpen", "Same as -B12 for the open end position.", "PNP NO", "Only move when the gripper is really open.", "—", "—"),
  A50c: I("Machine contacts diMachDone / diDoorOpen / diDoorClosed", "Potential-free relay contacts inside the machine, supplied with OUR 24 V (dark blue).", "relay contact rating ≥ 24 V 0.1 A, gold-plated for low currents", "Clear separation of the two controllers.", "Each signal tested from the machine side.", "Contact oxidation at very low current (use gold contacts)."),
  B15: I("-B15 mechanical limit switch diOutfeedFree", "Roller lever switch, 1 NO (mechanical contact, 2-wire).", "IP67, 10 A / 24 V DC-13", "Simple and robust for 'place position free'.", "Switching point.", "Mechanical wear of the lever."),
  B14: I("-B14 NPN sensor (comparison)", "Switches 0 V to the black wire (current sinking output).", "needs an input card with common +24 V (sourcing input)", "Common in Asia; on a European PNP card it never switches the input. Do not mix types on one card.", "Order the right type!", "Input never 1 → 'part not detected'."),
  B16: I("-B16 pressure transmitter 4–20 mA (2-wire)", "Supplied by the loop itself: the transmitter sets the loop current from 4 mA (0 bar) to 20 mA (10 bar).", "0–10 bar, 4–20 mA, 2-wire, U_supply 10–30 V", "Current signals are insensitive to cable resistance and noise; 'live zero' 4 mA detects a broken wire.", "Check at 0 bar = 4.0 mA, then at a reference pressure.", "Wire break (I = 0) → treated as an alarm, not as 0 bar."),
  A3: I("-A3 robot I/O board", "Digital inputs (sinking, IEC 61131-2 type 1) and outputs (sourcing, PNP, short-circuit proof).", "16 DI / 16 DO 24 V, 0.5 A per output", "The item-2 signals (diMachDone, doDoorOpen, …) are wired here.", "I/O test with the pendant (force outputs carefully).", "Output destroyed by a coil without diode or by a short circuit."),
  Y11: I("-Y11 gripper solenoid valve (doGripClose)", "5/2-way valve, solenoid 24 V DC.", "2.5 W (0.1 A), plug with LED + suppressor", "The flyback diode takes the coil current when the output switches off – without it a high voltage spike destroys the output and causes EMC noise.", "LED on the plug, diode polarity (cathode to +).", "Missing diode, burnt coil (wrong voltage)."),
  K21: I("-K21 … -K23 interposing relays", "Small relays (24 V DC coil with diode + LED) driven by robot outputs; their potential-free contacts go to the machine.", "1 CO, 6 A contact, 24 V DC coil 0.5 W", "Potential-free: the robot and the machine keep separate 24 V systems (no current loops, no mixing of 0 V, the machine can use any voltage).", "Contact state with a meter, LED.", "Relay wear (millions of cycles OK)."),
  K21c: I("Relay contacts to the machine", "Contacts of -K21…-K23 in the machine's input circuit, supplied by the machine (orange).", "external voltage", "Orange wires warn: still live when our main switch is off.", "Label at the terminals -X3.", "—"),
  P11: I("-P11 lamp 'robot home'", "Indicator lamp driven by doInHome.", "24 V LED 0.1 A", "Shows the robot status to the operator.", "—", "—"),
  MES: I("MES / ERP (factory level)", "Reads production data from the cell (counts, alarms, cycle times) and sends orders.", "OPC UA, 100–1000 ms", "Never directly into the real-time network: through the firewall.", "—", "—"),
  A90: I("-A90 firewall / router", "Separates the factory IT network from the cell OT network (IEC 62443 zones + conduits).", "only the needed ports open (e.g. OPC UA 4840)", "A virus in the office must not stop the robot.", "Rule list documented, remote access only via a secure gateway.", "Open 'any-any' rules after a service visit."),
  A80: I("-A80 managed industrial switch", "Connects the PROFINET devices in a star, with diagnostics (port status, LLDP topology).", "8 ports, 100 Mbit/s, PROFINET conformance class B, 24 V", "A managed switch shows WHICH cable is bad.", "Port LEDs, diagnosis in the PLC.", "Unmanaged office switch → no diagnosis, broadcast storms."),
  A2n: I("-A2 PLC as PROFINET IO controller + PROFIsafe F-host", "Owns the cyclic I/O data of all devices.", "RT cycle 2 ms (example)", "—", "Device names / IPs as planned.", "Duplicate device names."),
  A1n: I("-A1 robot controller as PROFINET device", "Exchanges the handshake signals and safety signals with the PLC.", "I-device, PROFIsafe F-device", "Replaces many wires; safety over the bus with PROFIsafe.", "—", "—"),
  A7: I("-A7 HMI", "Operator panel: status, alarms, recipes.", "10 inch, PROFINET / OPC UA", "—", "—", "—"),
  A50n: I("-A50 machine CNC on the network", "Via PROFINET (device) or a PN/PN coupler between two networks.", "—", "A coupler keeps two IO controllers independent.", "—", "—"),
  X80: I("-X80 service port", "Ethernet socket on the cabinet for the engineering laptop.", "RJ45 in the door", "Keep it disabled / locked when not used (security).", "—", "—"),
  A6: I("-A6 remote I/O on the conveyor", "IP67 I/O block close to the sensors – short sensor cables, one bus cable to the cabinet.", "M12, 16 DI/DO, IO-Link master", "Less wiring, better diagnosis (IO-Link).", "—", "—"),
  A5: I("-A5 remote I/O on the gripper", "Small IP67 block on the robot arm for the gripper sensors and valves.", "via the robot arm cable (Ethernet + 24 V)", "Few cores through the moving arm.", "—", "—"),
  Z1e: I("Filter placement", "Directly at the cabinet entry, on the bare plate, unfiltered input cable short and away from the output.", "—", "Otherwise the noise couples around the filter.", "—", "—"),
  A11e: I("Drive in the dirty zone", "Inverters, motor cables, brake resistors = noise sources.", "—", "Keep them apart from PLC and signal cables.", "—", "—"),
  T1e: I("24 V in the clean zone", "Power supply, PLC, I/O, switch.", "—", "—", "—", "—"),
  PEstar: I("PE star point", "Each device has its own PE conductor to the PE bar (star), no daisy chains, no loops.", "—", "Loops pick up magnetic fields → noise currents on PE and shields.", "—", "—"),
  W11e: I("Motor cable shield 360°", "The shield must be clamped all around (360°) on the mounting plate and in the EMC gland of the motor.", "—", "A pigtail (shield twisted into a wire) has a high impedance at MHz – the shield stops working.", "Visual check of every shield clamp.", "Pigtails, paint under the clamp."),
  tray: I("Separation of cables", "Power and signal cables in separate trays or with a metal separator; at least 200 mm apart without separator; cross at 90°.", "—", "Capacitive + inductive coupling falls quickly with the distance.", "—", "—"),
  bond: I("Equipotential bonding", "Robot base, fence, conveyors, machine and controller connected with short, thick copper to the earth grid.", "e.g. 16 mm² Cu", "No voltage between parts a person can touch; low-impedance return path for noise.", "Continuity measurement.", "—"),
  Y11e: I("Flyback diode", "Across every DC coil (valve, relay, contactor).", "—", "Limits the switch-off voltage spike.", "—", "—"),
  ducts: I("Cable ducts", "Slotted plastic ducts between the DIN rails; separate ducts for power and control where possible.", "60 × 60 mm (example), fill ≤ 70 %", "Tidy wiring, room for changes.", "—", "—"),
  door: I("Door devices", "Main switch handle, e-stop, reset, HMI, fan inlet + outlet filter.", "—", "The handle is coupled to -Q1 and locks the door when ON.", "—", "—"),
  X1: I("-X1 / -X2 / -X4 terminal strips", "Every field cable lands on a numbered terminal (wire number = terminal number in the drawing).", "spring-clamp terminals, PE terminals green-yellow", "Clear interface for testing and replacing field devices.", "Terminal numbers match the drawing (as-built!).", "Loose screw terminals (use spring clamps / torque)."),
  X2: null, X4: null,
  K10: I("-K10 safety relay", "Fixed-logic safety module: 2 force-guided relays, monitors the e-stop channels (S11-S12, S21-S22), the reset with feedback loop (S33-S34) and switches 13-14 / 23-24.", "24 V DC, 2 NO safe + 1 NC aux, Cat 4 / PL e (device)", "Simple variant for a small machine.", "Function test of each channel; reset only with the feedback loop closed.", "Several e-stops in series: fault masking (ISO/TR 24119)."),
};
["Q12", "K12", "K6", "X2", "X4"].forEach((k) => { INFO[k] = INFO[{ Q12: "Q11", K12: "K11", K6: "K5", X2: "X1", X4: "X1" }[k]]; });
["F21", "F22", "F23", "F24", "F25", "F26"].forEach((k) => {
  INFO[k] = { t: `-${k} electronic circuit breaker (24 V branch)`, w: "Electronic current limiter per branch: limits the current to ≈ 1.5 × setting and switches the branch off after a short time; the other branches keep their 24 V.",
    r: (K) => { const b = K.psu.branches.find((x) => x.tag === "-" + k); return b ? `${b.n}: setting ${b.set} A, load ${f(b.I, 2)} A (${b.items.map((i) => i[2] || i[0]).join(", ")})` : ""; },
    y: "A normal fuse needs a high current to blow – a 24 V supply cannot deliver it quickly (it limits), so the whole 24 V would collapse. ECBs switch off selectively.", c: "Status LED / signal contact to the PLC; trip test at commissioning.", f: "Setting too low → trips at the inrush of valves / brakes." };
});

/* ------------------------------------------------------------------ item-2 handshake demo (same signals + times as robotctl.js) */
const DEMO = [
  [0, { diMachDone: 0, diMachRun: 1, doDoorOpen: 0, diDoorOpen: 0, diDoorClosed: 1, doRobotClear: 1, doInHome: 1, doGripClose: 0, diGripClosed: 0, diGripOpen: 1, diPartReady: 1, doCycleStart: 0, diOutfeedFree: 1 }],
  [1.0, { diMachDone: 1, diMachRun: 0 }], [1.2, { doDoorOpen: 1 }], [1.3, { diDoorClosed: 0 }], [2.8, { diDoorOpen: 1 }], [3.0, { doInHome: 0 }], [3.6, { doRobotClear: 0 }],
  [4.2, { doGripClose: 1, diGripOpen: 0 }], [4.6, { diGripClosed: 1 }], [5.4, { doRobotClear: 1 }], [6.4, { diOutfeedFree: 1 }], [6.6, { doGripClose: 0 }], [6.9, { diGripClosed: 0, diGripOpen: 1, diOutfeedFree: 0 }],
  [7.8, { doGripClose: 1, diGripOpen: 0 }], [8.2, { diGripClosed: 1 }], [8.5, { diPartReady: 0 }], [9.4, { doRobotClear: 0 }], [10.0, { doGripClose: 0 }], [10.3, { diGripClosed: 0, diGripOpen: 1 }],
  [10.6, { doRobotClear: 1 }], [10.7, { doDoorOpen: 0 }], [10.8, { diDoorOpen: 0 }], [11.0, { diPartReady: 1, diOutfeedFree: 1 }], [12.3, { diDoorClosed: 1 }], [12.4, { doCycleStart: 1 }],
  [12.5, { diMachRun: 1, diMachDone: 0 }], [12.9, { doCycleStart: 0 }], [13.6, { doInHome: 1 }],
];
const DEMO_T = 14.5;
function demoAt(t) { const v = {}; for (const e of DEMO) { if (e[0] > t) break; Object.assign(v, e[1]); } return v; }
function liveIO() {
  const s = window.rbSim; if (!s || !s.S || !s.run || !s.run.on) return null;
  try {
    const S1 = s.S, C = S1.C, M1 = s.mach, p = fk(S1.rb, S1.q, S1.tool).p;
    const xh = Math.max(C.machine.x0, fk(S1.rb, C.home, S1.tool).p[0]), xIn = xh + 0.5 * (C.machine.load[0] - xh);
    return {
      diMachDone: s.di("diMachDone") ? 1 : 0, diMachRun: M1.state === "run" ? 1 : 0, doDoorOpen: M1.doorCmd ? 1 : 0, diDoorOpen: s.di("diDoorOpen") ? 1 : 0,
      diDoorClosed: s.di("diDoorClosed") ? 1 : 0, doRobotClear: p[0] < xIn ? 1 : 0, doInHome: S1.q.every((v, i) => Math.abs(v - C.home[i]) < 1) ? 1 : 0,
      doGripClose: (s.gripAct ? s.gripAct.to : S1.grip > 0.5) ? 1 : 0, diGripClosed: S1.grip >= 0.999 && S1.parts.some((q) => q.held) ? 1 : 0, diGripOpen: S1.grip <= 0.001 ? 1 : 0,
      diPartReady: s.di("diPartReady") ? 1 : 0, doCycleStart: M1.state === "run" && M1.tLeft > SIM.machTime - 0.5 ? 1 : 0, diOutfeedFree: 1,
    };
  } catch (e) { return null; }
}

/* ------------------------------------------------------------------ signal list (page 5 table) – names from item 2 */
const SIGLIST = [
  ["A3.DI0", "diPartReady", "-B11 (PNP, optical)", "-X2:1", "201", "-W21 M12 4×0.34", "raw part at the pick position (conveyor → robot)"],
  ["A3.DI1", "diGripClosed", "-B12 (PNP, magnetic)", "-X2:2", "202", "arm cable", "gripper closed + part present"],
  ["A3.DI2", "diGripOpen", "-B13 (PNP, magnetic)", "-X2:3", "203", "arm cable", "gripper fully open"],
  ["A3.DI3", "diMachDone", "-A50 relay K31", "-X2:4", "204", "-W30 12×0.75", "machine finished, in load position"],
  ["A3.DI4", "diDoorOpen", "-A50 relay K32", "-X2:5", "205", "-W30", "confirmation: machine door fully open"],
  ["A3.DI5", "diDoorClosed", "-A50 relay K33", "-X2:6", "206", "-W30", "confirmation: machine door closed"],
  ["A3.DI6", "diOutfeedFree", "-B15 (limit switch)", "-X2:7", "207", "-W22 3×0.75", "place position on the outfeed free"],
  ["A3.DI7", "diMachRun", "-A50 relay K34", "-X2:8", "208", "-W30", "machine cycle running (status)"],
  ["A3.DO0", "doGripClose", "-Y11 valve", "-X2:11", "211", "arm cable", "gripper close (1) / open (0)"],
  ["A3.DO1", "doDoorOpen", "-K21 → -A50", "-X2:12", "212", "—", "command: open the machine door"],
  ["A3.DO2", "doCycleStart", "-K22 → -A50", "-X2:13", "213", "—", "pulse: start machining (door closed + robot clear)"],
  ["A3.DO3", "doRobotClear", "-K23 → -A50", "-X2:14", "214", "—", "interlock: robot outside the machine"],
  ["A3.DO4", "doInHome", "-P11 lamp", "-X2:15", "215", "—", "robot in home position"],
  ["A4.AI0", "aiPressure", "-B16 4–20 mA", "-X2:21/22", "221", "-W23 2×0.5 shielded", "air pressure 0–10 bar"],
  ["A2.F-DI0/1", "siEstop A/B", "-S1…-S3", "-X4:1/2", "401/402", "-W40 4×0.75", "e-stop chain, channel A (T1) / B (T2)"],
  ["A2.F-DI2/3", "siGateClosed A/B", "-B1 OSSD1/2", "-X4:3/4", "403/404", "-W41 M12 8-pin", "safety gate closed + locked"],
  ["A2.F-DI4/5", "siEnable A/B", "-S4 (pendant)", "-X4:5/6", "405/406", "pendant cable", "enabling device in the middle position"],
  ["A2.F-DQ0/1", "soEstopRobot A/B", "→ -A1 ES1/ES2", "-X5:1/2", "501/502", "-W50 4×0.75", "robot e-stop (SS1 → STO)"],
  ["A2.F-DQ2/3", "soAutoStop A/B", "→ -A1 AS1/AS2", "-X5:3/4", "503/504", "-W50", "robot protective stop (gate, AUTO)"],
  ["A2.F-DQ7/8", "soRobotOutMach A/B", "-K5/-K6 → -A50", "-X3:5/6", "505/506", "-W31", "safe: robot out of the machine (siMachDoorSafe on the machine side)"],
];

/* ------------------------------------------------------------------ live state + safety logic */
function makeState() {
  return {
    q1: true, es: { tp: false, cab: false, door: false }, gate: true, locked: true, unlock: false, en: 1, mode: "AUTO",
    fault: { cross: false, weld: false, gateStuck: false }, f24short: false, emc: "", doorOpen: false,
    latES: true, latAS: true, faultTxt: "", need: false, robot: "RUNNING", tStopEnd: 0, cat: "", catTxt: "", log: [], resetBtn: false, reqBtn: false, reqPending: false,
    k11: true, k12: false, offT: null, now: 0, servoT: 0, ioT: 0, netT: 0, blink: false, page: 1, zeroLink: true,
  };
}
function stopTime(K) { return K.resp.stop; }

function evalOut(T) {
  const fault = !!T.faultTxt;
  const es = T.latES && !fault && T.q1, as = T.latAS && !fault && T.q1;
  const conv = es && as && T.gate;
  const k1 = conv, k2 = conv;
  const k1c = (k1 || T.fault.weld) && T.q1 ? true : k1, k2c = k2;
  return { oES: es, oAS: as, k1, k2, k1c: T.fault.weld ? true : k1c, k2c, mach: es && as && !!(T.io && T.io.doRobotClear), need: T.need || fault };
}

/* ------------------------------------------------------------------ build */
function build(box) {
  const T = makeState();
  const sim1 = window.rbSim;
  let rbId = ROBOTS.some((r) => r.id === Q.get("ckrb")) ? Q.get("ckrb") : (sim1 && sim1.S ? sim1.S.rb.id : "irb2600");
  let K = calc(robotById(rbId)), BP = busProfile(robotById(rbId));
  T.page = Math.min(NPAGES, Math.max(1, +Q.get("ckpage") || 1));
  T.info = Q.get("ckinfo") || null;
  T.io = demoAt(0);
  const log = (ev, res, cat) => { T.log.unshift({ t: T.now, ev, res, cat: cat || "—" }); if (T.log.length > 14) T.log.pop(); };

  /* ---------------- safety actions */
  function robotStop(cat, why) {
    if (T.robot === "RUNNING" || T.robot === "MOTORS_ON") {
      if (cat === 1 && T.robot === "RUNNING") { T.robot = "STOPPING"; T.tStopEnd = T.now + stopTime(K); T.servoT = 2.5; T.catTxt = `stop category 1 (SS1): ramp ${f(stopTime(K) * 1000, 0)} ms, then STO + brakes`; }
      else { T.robot = "STO"; T.catTxt = "stop category 0: STO at once, brakes close (~60 ms)"; }
      T.cat = cat;
    }
    T.offT = T.now;
  }
  function apply() {
    const chain = !(T.es.tp || T.es.cab || T.es.door);
    if (!T.q1) { if (T.latES || T.latAS) log("main switch -Q1 OFF", "24 V lost → all safety outputs off, robot STO", "0"); T.latES = false; T.latAS = false; T.robot = "STO"; T.need = true; T.catTxt = "no power"; return; }
    // faults
    if (T.fault.cross && !T.faultTxt) { T.faultTxt = "cross-circuit A–B (input A sees the T2 pulses)"; log("short circuit channel A ↔ B", "F-DI0/1 see the same pulses → FAULT, all outputs off", "0"); robotStop(0); T.latES = T.latAS = false; T.need = true; }
    if (!T.gate && T.fault.gateStuck && !T.faultTxt) { T.faultTxt = "discrepancy gate OSSD1 = 0 / OSSD2 = 1 (> 100 ms)"; log("gate opened, OSSD2 stuck", "discrepancy time exceeded → FAULT", "0"); robotStop(0); T.latES = T.latAS = false; T.need = true; }
    // e-stop
    if (!chain && T.latES) { T.latES = false; T.latAS = false; T.need = true; const c = T.robot === "RUNNING" ? 1 : 0; robotStop(c); log("E-STOP pressed (both channels open)", "F-DQ0/1 (ES) off, -K1/-K2 off", String(c)); }
    // gate / enabling / mode
    const asOK = T.mode === "AUTO" ? T.gate : T.en === 1;
    if (!asOK && T.latAS) { T.latAS = false; T.need = true; const c = T.robot === "RUNNING" ? 1 : 0; robotStop(c); log(T.mode === "AUTO" ? "safety gate opened (AUTO)" : "enabling device " + ["released", "middle", "pressed through (panic)"][T.en], "F-DQ2/3 (AS) off → protective stop", String(c)); }
    if (!T.gate && T.latAS && T.mode === "T1") { /* T1: gate may be open, conveyors stay off (see evalOut) */ }
  }
  function tick(dt) {
    T.now += dt;
    if (T.robot === "STOPPING" && T.now >= T.tStopEnd) { T.robot = "STO"; log("standstill reached", "STO + brakes (SBC)", String(T.cat)); if (T.reqPending) { T.unlock = true; T.reqPending = false; log("request entry: robot stopped", "-Y10 energised → gate unlocked", "—"); } }
    if (T.reqPending && T.robot === "STO") { T.unlock = true; T.reqPending = false; log("request entry", "robot stands still → gate unlocked", "—"); }
    // EDM supervision: outputs off but K1 still closed after 0.3 s -> fault
    const O = evalOut(T);
    if (!O.k1 && T.fault.weld && !T.faultTxt && T.offT !== null && T.now - T.offT > 0.3) { T.faultTxt = "EDM: -K1 did not drop (welded) – -K2 stopped the conveyor"; log("feedback -K1 21-22 stays open", "EDM fault → restart blocked (K2 has opened the motor circuit)", "—"); T.need = true; }
    if (O.k1) T.offT = null; else if (T.offT === null) T.offT = T.now;
  }
  function reset() {
    T.resetBtn = true; setTimeout(() => { T.resetBtn = false; render(true); }, 350);
    const chain = !(T.es.tp || T.es.cab || T.es.door);
    if (!T.q1) { log("Reset", "refused – main switch OFF", "—"); return; }
    if (T.faultTxt) {
      const still = T.fault.cross || (T.fault.gateStuck && !T.gate) || (T.fault.weld && /EDM/.test(T.faultTxt));
      if (still) { log("Reset", "refused – fault still present: " + T.faultTxt, "—"); return; }
      log("Reset", "fault cleared (" + T.faultTxt + ")", "—"); T.faultTxt = "";
    }
    if (!chain) { log("Reset", "refused – e-stop still pressed", "—"); return; }
    if (T.mode === "AUTO" && !T.gate) { log("Reset", "refused – gate open in AUTO", "—"); return; }
    if (T.mode === "T1" && T.en !== 1) { log("Reset", "refused – T1 needs the enabling device in the middle", "—"); return; }
    const O = evalOut(T);
    if (O.k1c || O.k2c) { log("Reset", "refused – EDM loop open (contactor welded?)", "—"); if (T.fault.weld) T.faultTxt = "EDM: -K1 did not drop (welded)"; return; }
    T.latES = true; T.latAS = true; T.need = false; T.robot = "RUNNING"; T.catTxt = T.mode === "T1" ? "T1: ≤ 250 mm/s while the enabling device is held" : "AUTO: program runs";
    if (T.gate) { T.locked = true; T.unlock = false; }
    log("Reset (released)", "all inputs OK, EDM closed → outputs ON, robot " + (T.mode === "AUTO" ? "started" : "jog in T1"), "—");
  }
  const act = {
    q1() { T.q1 = !T.q1; if (T.q1) log("main switch -Q1 ON", "24 V back – reset needed", "—"); apply(); },
    es(k) { T.es[k] = !T.es[k]; if (!T.es[k]) log("e-stop " + k + " released (turned)", "still off – reset needed", "—"); apply(); },
    gate() {
      if (T.gate) {
        if (T.locked && !T.unlock) { log("open gate", "refused – gate LOCKED (press request entry first)", "—"); return; }
        T.gate = false; T.locked = false; log("safety gate opened", "OSSD1/2 off", "—");
      } else { T.gate = true; T.locked = true; T.unlock = false; log("safety gate closed", "locked again – reset needed", "—"); }
      apply();
    },
    req() {
      T.reqBtn = true; setTimeout(() => { T.reqBtn = false; render(true); }, 350);
      if (!T.gate) return;
      if (T.robot === "RUNNING" || T.robot === "MOTORS_ON" || T.robot === "STOPPING") { T.reqPending = true; if (T.latAS) { T.latAS = false; T.need = true; const c = T.robot === "RUNNING" ? 1 : 0; robotStop(c); log("request entry -S7", "protective stop, waiting for standstill", String(c)); } }
      else { T.unlock = true; log("request entry -S7", "robot stands still → unlock", "—"); }
      apply();
    },
    en(v) { T.en = v; apply(); },
    mode(v) { if (T.mode === v) return; T.mode = v; if (T.latAS) { T.latAS = false; T.need = true; robotStop(T.robot === "RUNNING" ? 1 : 0); } log("mode " + v, "mode change = protective stop, reset needed", "—"); apply(); },
    reset,
    fault(k) { T.fault[k] = !T.fault[k]; log((T.fault[k] ? "FAULT ON: " : "repaired: ") + { cross: "short circuit A–B", weld: "-K1 main contact welded", gateStuck: "gate OSSD2 stuck at 1" }[k], T.fault[k] ? "watch what the safety PLC detects" : "press reset", "—"); apply(); },
    f24() { T.f24short = !T.f24short; },
    conv(k) { T[k] = !T[k]; },
  };

  /* ---------------- skeleton */
  box.innerHTML = `
  <div class="rc-wrap ck-wrap">
    <div class="card ck-bar">
      <div class="ck-row">
        <label class="rb-lbl">Robot <select id="ckRb">${ROBOTS.map((r) => `<option value="${r.id}">${esc(r.ref)} – ${CTRL[r.id].S} kVA (example)</option>`).join("")}</select></label>
        <span class="ck-sep"></span>
        <button class="btn" id="ckQ1"></button>
        <button class="btn warn" id="ckEs" title="emergency stop on the teach pendant (-S1)"></button>
        <button class="btn" id="ckGate"></button>
        <button class="btn" id="ckReset" title="reset -S6 (outside the cell)">Reset -S6</button>
        <span class="ck-sep"></span>
        <span id="ckChips" class="ck-chips"></span>
      </div>
      <div class="ck-pages" role="group" aria-label="Drawing page">${PAGE_TITLES.map((t, i) => `<button class="ck-pg" data-ckpg="${i + 1}" title="${esc(t)}"><b>${i + 1}</b> ${esc(i === 8 ? "Safety relay variant" : t.split(/ [–(+]/)[0].replace("Safety circuits", "Safety").replace(" + power distribution", ""))}</button>`).join("")}</div>
    </div>
    <div class="card">
      <div class="card-head"><h2 id="ckTitle"></h2><span class="sub">schematic drawing · click a device for its information · EXAMPLE values – the real design follows IEC 60204-1, the supplier's manuals and a qualified electrical designer</span></div>
      <p class="rc-why" id="ckWhy"></p>
      <div class="ck-sheet" id="ckSheet"></div>
      <div class="ck-under">
        <div id="ckCtl" class="ck-ctl"></div>
        <div class="rc-info" id="ckInfo"></div>
      </div>
      <div id="ckExtra"></div>
    </div>
    <div class="card" id="ckCardCalc"><div class="card-head"><h2>C · Calculations (live with the selected robot)</h2><span class="sub">formula → numbers → result · all inputs are examples</span></div>
      <p class="rc-why"><b>What you see:</b> the sizing of the supply, protection, cables, 24 V, drive energy and safety distance for the selected robot. <b>Why it matters:</b> these are the checks an electrical designer makes; change the robot and see which values change.</p>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="ckCalc"></table></div></div>
    <div class="card" id="ckCardBom"><div class="card-head"><h2>D · Component list (BOM)</h2><span class="sub">generic product types – choose real products with the electrical designer</span></div>
      <p class="rc-why"><b>What you see:</b> every device of the drawing with its tag, rating and a generic product type. <b>Why it matters:</b> the BOM is the purchase list and the link between drawing, cabinet and spare parts.</p>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="ckBom"></table></div></div>
    <div class="card" id="ckCardTest"><div class="card-head"><h2>E · Test + commissioning procedure</h2><span class="sub">IEC 60204-1 §18 · IEC 60364-6 · ISO 13849-2 · example limits</span></div>
      <p class="rc-why"><b>What you see:</b> the tests before the cell is used, in the right order (first without power, then with power, then the safety functions). <b>Why it matters:</b> only measured and documented tests prove that the cell is safe – and you need the report for the CE marking.</p>
      <div class="table-wrap"><table class="rb-tbl ck-tbl" id="ckTest"></table></div></div>
    <div class="card" id="ckCardLegend"><div class="card-head"><h2>F · Symbol legend + wire colours</h2><span class="sub">IEC 60617 symbols · IEC 81346 device letters · IEC 60204-1 / IEC 60445 colours</span></div>
      <p class="rc-why"><b>What you see:</b> every symbol used in the drawings with a one-line explanation, the device letters and the wire colours. <b>Why it matters:</b> you can read any real electrical drawing set with these.</p>
      <div id="ckLegend"></div></div>
  </div>`;

  /* ---------------- render */
  let lastKey = "", rbRef = "";
  const rb = () => robotById(rbId);
  function state() {
    const O = evalOut(T);
    const sto = T.robot === "STO";
    let phase = "idle", vdc = CTL.vdc0;
    const k40 = T.q1 && !(sto && !T.latES);
    if (!sto && k40 && (T.robot === "RUNNING" || T.robot === "STOPPING")) {
      const i = Math.min(BP.t.length - 1, Math.round(T.servoT / (BP.T / (BP.t.length - 1))));
      const t = BP.t[i]; vdc = BP.v[i];
      const P = BP.P[i];
      phase = BP.chop[i] ? "chop" : P < -50 ? "regen" : P > 50 ? (t < 0.5 + BP.tA + 0.01 ? "mot" : "run") : "run";
      if (T.robot === "RUNNING" && Math.abs(BP.w[i]) < 1e-3) phase = "idle";
    }
    return {
      ...T, ...O, sp: { es: O.oES, as: O.oAS, k1: O.k1, k2: O.k2, mach: O.mach, need: O.need, fault: T.faultTxt, msg: T.faultTxt ? "" : T.need ? "reset needed (-S6)" : "all safety inputs OK – outputs ON" },
      in: { a0: !(T.es.tp || T.es.cab || T.es.door) || T.fault.cross, b0: !(T.es.tp || T.es.cab || T.es.door) || T.fault.cross },
      k40, sto, brakeOpen: !sto && T.q1, servo: { phase, vdc }, bus: BP, f24trip: T.f24short && T.q1,
      robotTxt: { RUNNING: T.mode === "T1" ? "RUNNING (T1, ≤ 250 mm/s)" : "RUNNING (AUTO)", MOTORS_ON: "MOTORS ON", STOPPING: "STOPPING (ramp, cat 1)", STO: "STO – torque off, brakes applied" }[T.robot],
      k11: T.k11 && O.k1c && O.k2c && T.q1 ? T.k11 : T.k11, k12: T.k12, fanOn: K.heat.Pfan > 0, weld: T.fault.weld,
      ioMode: T.ioLive ? "following the item-1 program (window.rbSim)" : T.robot === "RUNNING" ? "demo handshake (start the item-1 program to follow it live)" : "frozen – robot stopped",
      ai: 4 + 16 * (6 + 0.25 * Math.sin(T.now * 0.8) - (T.io.doGripClose ? 0.3 : 0)) / 10,
      sr: { out: O.oES && !T.fault.cross, need: T.need, fault: T.fault.cross ? "cross fault ch1–ch2" : "" },
      emc: T.emc, zeroLink: T.zeroLink,
    };
  }
  function draw(n, S) { const P = pen(n); drawPage(P, n, S, K, rbRef); return P.out(); }
  function fullPass() { REG.clear(); const S = state(); for (let n = 1; n <= NPAGES; n++) draw(n, S); }
  function renderKey(S) {
    const base = [T.page, rbId, S.q1, S.es.tp, S.es.cab, S.es.door, S.gate, S.locked, S.unlock, S.en, S.mode, S.faultTxt, S.need, S.robot, S.fault.cross, S.fault.weld, S.fault.gateStuck, S.f24trip, S.k11, S.k12, S.doorOpen, S.resetBtn, S.reqBtn, S.emc, S.zeroLink, S.info];
    if (T.page === 2) base.push(S.servo.phase);
    if (T.page === 4) base.push(S.blink && S.sp.need, S.mach);
    if (T.page === 5) base.push(JSON.stringify(S.io));
    return base.join("|");
  }
  function render(force) {
    const S = state();
    const key = renderKey(S);
    if (!force && key === lastKey) { frameUpdate(S); return; }
    const pageChanged = !lastKey || lastKey.split("|")[0] !== String(T.page) || lastKey.split("|")[1] !== rbId;
    lastKey = key;
    $("ckSheet").innerHTML = `<svg class="ck-svg" viewBox="0 0 ${PW} ${PH}" role="img" aria-label="${esc(PAGE_TITLES[T.page - 1])}">${draw(T.page, S)}</svg>`;
    $("ckTitle").textContent = `Page ${T.page} / ${NPAGES} · ${PAGE_TITLES[T.page - 1]}`;
    $("ckWhy").innerHTML = `<b>What you see:</b> ${esc(WHY[T.page - 1][0])} <b>Why it matters:</b> ${esc(WHY[T.page - 1][1])}`;
    document.querySelectorAll("[data-ckpg]").forEach((b) => b.classList.toggle("active", +b.dataset.ckpg === T.page));
    renderBar(S); renderCtl(S);
    if (pageChanged) renderExtra(S); else if (T.page === 4 || T.page === 9 || T.page === 3) renderExtra(S);
    renderInfo();
    frameUpdate(S);
  }
  function renderBar(S) {
    $("ckQ1").textContent = "Main switch -Q1: " + (T.q1 ? "ON" : "OFF"); $("ckQ1").classList.toggle("primary", T.q1);
    $("ckEs").textContent = T.es.tp ? "Release e-stop -S1" : "E-stop -S1 (pendant)";
    $("ckGate").textContent = T.gate ? "Open safety gate" : "Close safety gate";
    const chip = (t, c) => `<span class="rc-chip ${c}">${esc(t)}</span>`;
    $("ckChips").innerHTML = chip("robot: " + { RUNNING: "running", MOTORS_ON: "motors on", STOPPING: "stopping (cat 1)", STO: "STO" }[T.robot], T.robot === "RUNNING" ? "rc-ok" : T.robot === "STO" ? "rc-bad" : "rc-warn") +
      chip(T.faultTxt ? "safety FAULT" : T.need ? "reset needed" : "safety OK", T.faultTxt ? "rc-bad" : T.need ? "rc-warn" : "rc-ok") + chip(T.mode, "");
  }
  function frameUpdate(S) {
    if (T.page === 2) {
      const cur = $("ckCur"), x0 = 540, x1 = 1130;
      if (cur) { const x = x0 + Math.min(1, T.servoT / BP.T) * (x1 - x0); cur.setAttribute("d", `M${x},600 V728`); cur.style.display = S.sto ? "none" : ""; }
      const v = $("ckVdc"); if (v) v.textContent = f(S.servo.vdc, 0) + " V";
      const p = $("ckPh"); if (p) p.textContent = S.sto ? "STO – no motion" : { idle: "standstill", mot: "accelerating: energy from the mains", run: "constant speed", regen: "braking: energy flows back into the DC bus", chop: "CHOPPER ON: brake resistor burns the energy" }[S.servo.phase];
    }
    if (T.page === 6) {
      const g = $("ckPk"); if (!g) return;
      let s = "";
      NET_LINKS.forEach((l, i) => {
        const segs = []; let L = 0;
        for (let k = 1; k < l.p.length; k++) { const d = Math.hypot(l.p[k][0] - l.p[k - 1][0], l.p[k][1] - l.p[k - 1][1]); segs.push(d); L += d; }
        const per = l.k === "it" ? 2.0 : 0.9, u = ((T.netT + i * 0.13) % per) / per, back = Math.floor((T.netT + i * 0.13) / per) % 2 === 1;
        let d = (back ? 1 - u : u) * L, k = 0; while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; }
        const a = l.p[k], b = l.p[k + 1], r = segs[k] ? d / segs[k] : 0;
        s += `<circle cx="${a[0] + (b[0] - a[0]) * r}" cy="${a[1] + (b[1] - a[1]) * r}" r="4" class="${l.k === "it" ? "ck-pkit" : "ck-pk"}"/>`;
      });
      g.innerHTML = s;
    }
    if (T.page === 5) { const a = $("ckAI"); if (a) a.textContent = `now: I = ${f(S.ai, 1)} mA → p = ${f((S.ai - 4) / 16 * 10, 1)} bar`; }
  }
  /* ---------------- controls under the drawing */
  function btn(id, txt, cls = "") { return `<button class="btn ${cls}" data-ckact="${id}">${esc(txt)}</button>`; }
  function seg(name, opts, cur) { return `<span class="seg">${opts.map(([v, t]) => `<button class="seg-btn${String(v) === String(cur) ? " active" : ""}" data-ckseg="${name}" data-v="${v}">${esc(t)}</button>`).join("")}</span>`; }
  function logTable() {
    return `<div class="table-wrap ck-log"><table class="rb-tbl"><tr><th>t (s)</th><th>event</th><th>what the safety system does</th><th>stop cat.</th></tr>${T.log.map((l) => `<tr><td>${f(l.t, 1)}</td><td>${esc(l.ev)}</td><td>${esc(l.res)}</td><td>${esc(l.cat)}</td></tr>`).join("") || `<tr><td colspan="4" class="muted">press a button above – the events appear here</td></tr>`}</table></div>`;
  }
  function renderCtl(S) {
    let h = "";
    const safetyBtns = () => `<div class="rc-ctlrow"><b>E-stops:</b> ${btn("es:tp", (T.es.tp ? "release " : "press ") + "-S1 pendant", T.es.tp ? "warn" : "")} ${btn("es:cab", (T.es.cab ? "release " : "press ") + "-S2 cabinet", T.es.cab ? "warn" : "")} ${btn("es:door", (T.es.door ? "release " : "press ") + "-S3 cell door", T.es.door ? "warn" : "")}</div>
      <div class="rc-ctlrow"><b>Gate:</b> ${btn("req", "request entry -S7")} ${btn("gate", T.gate ? "open gate" : "close gate")} <span class="muted">${T.gate ? (T.unlock ? "unlocked – may open" : "locked") : "open"}</span></div>
      <div class="rc-ctlrow"><b>Enabling -S4:</b> ${seg("en", [[0, "released"], [1, "middle"], [2, "panic"]], T.en)} <b>Mode -S5:</b> ${seg("mode", [["AUTO", "AUTO"], ["T1", "T1"]], T.mode)} ${btn("reset", "Reset -S6", "primary")}</div>
      <div class="rc-ctlrow"><b>Inject a fault:</b> <label class="rc-sl"><input type="checkbox" data-ckfault="cross"${T.fault.cross ? " checked" : ""}> short circuit channel A–B</label> <label class="rc-sl"><input type="checkbox" data-ckfault="weld"${T.fault.weld ? " checked" : ""}> -K1 welded</label> <label class="rc-sl"><input type="checkbox" data-ckfault="gateStuck"${T.fault.gateStuck ? " checked" : ""}> gate OSSD2 stuck</label></div>`;
    if (T.page === 4 || T.page === 9) h = safetyBtns() + `<p class="rc-note">${esc(S.catTxt || "")}</p>` + logTable();
    else if (T.page === 1) h = `<div class="rc-ctlrow">${btn("q1", "main switch -Q1 " + (T.q1 ? "OFF" : "ON"))} ${btn("conv:k11", "infeed conveyor -K11 " + (T.k11 ? "off" : "on"))} ${btn("conv:k12", "outfeed conveyor -K12 " + (T.k12 ? "off" : "on"))} ${btn("door", "cabinet door " + (T.doorOpen ? "close" : "open"))}</div>
      <div class="rc-ctlrow">${btn("es:cab", (T.es.cab ? "release" : "press") + " e-stop -S2", T.es.cab ? "warn" : "")} ${btn("reset", "Reset -S6", "primary")} <label class="rc-sl"><input type="checkbox" data-ckfault="weld"${T.fault.weld ? " checked" : ""}> -K1 welded</label></div>
      <p class="rc-note">The conveyor motors run only when -K1 AND -K2 (safety, page 4) AND -K11/-K12 (function, PLC) are closed. Press the e-stop: -K1 and -K2 drop. With "-K1 welded" the motor still stops because -K2 opens – this is the redundancy.</p>` + logTable();
    else if (T.page === 2) h = `<div class="rc-ctlrow">${btn("es:tp", (T.es.tp ? "release" : "press") + " e-stop -S1", T.es.tp ? "warn" : "")} ${btn("reset", "Reset -S6", "primary")} <span class="muted">e-stop → SS1: the axes brake (energy back into the bus, chopper) → STO → brake applied</span></div>
      <p class="rc-note"><b>Now:</b> robot ${esc(S.robotTxt)} · DC bus ${f(S.servo.vdc, 0)} V · ${S.servo.phase === "chop" ? "chopper ON" : "chopper off"}. Same bus model as item 2: C = 2 mF, chopper on at ${CTL.chopOn} V / off at ${CTL.chopOff} V. Item 2 brakes ONE axis with R = ${CTL.rChop} Ω; here J1–J3 brake together, so R = ${K.regen.R} Ω (U²/R ≥ 1.2 × peak braking power).</p>`;
    else if (T.page === 3) h = `<div class="rc-ctlrow">${btn("f24", T.f24short ? "repair valve short circuit" : "short circuit at a valve (-F24 branch)", T.f24short ? "warn" : "")} ${btn("zl", T.zeroLink ? "open link -X3 (insulation test)" : "close link -X3")} ${btn("q1", "main switch -Q1 " + (T.q1 ? "OFF" : "ON"))}</div>
      <p class="rc-note">${T.f24short ? "-F24 has switched off its branch in a few ms: valves, relays and lamps are off (the robot outputs see no voltage). Safety PLC, sensors, brakes and the robot I/O keep their 24 V – the cell stops in a controlled way with a clear message." : "Each branch has its own electronic circuit breaker. Try the short circuit."} ${T.zeroLink ? "" : "Link -X3 open: 0 V floats – only allowed during the insulation test, close it again!"}</p>`;
    else if (T.page === 5) h = `<div class="rc-ctlrow"><span class="muted">${esc(S.ioMode)}</span> ${btn("f24", T.f24short ? "repair -F24 short" : "short circuit at a valve", T.f24short ? "warn" : "")}</div>
      <p class="rc-note">Inputs: LED in the module = 1. Outputs: the coil / lamp lights when the robot sets the signal. Start the program in item 1 (Run) and the signals follow the real program.</p>`;
    else if (T.page === 7) h = `<div class="rc-ctlrow"><b>Show a typical fault:</b> ${seg("emc", [["", "none"], ["pigtail", "shield on pigtail"], ["peloop", "PE loop"], ["zero", "0 V not earthed"], ["diode", "missing flyback diode"], ["parallel", "no separation"]], T.emc)}</div><p class="rc-note">${esc(EMCF[T.emc] || "Choose a fault: it is drawn in red, and the symptom is explained here and in the table below.")}</p>`;
    else if (T.page === 6) h = `<p class="rc-note">The dots are the cyclic telegrams: green = PROFINET (every 2 ms in reality, here slowed down), grey = OPC UA to the MES (every 0.5–1 s). The red curve = PROFIsafe safety telegrams on the same cable.</p>`;
    else h = `<p class="rc-note">Static page – click a device for its information. The heat calculation updates with the 24 V load of the selected robot.</p>`;
    $("ckCtl").innerHTML = h;
  }
  const EMCF = {
    pigtail: "Shield twisted into a wire (pigtail) and screwed to PE: at MHz frequencies a few cm of wire have a high impedance → the shield does not work. Symptoms: encoder errors, bus errors, sensors flicker when the robot moves fast.",
    peloop: "A second PE connection between two devices makes a loop: magnetic fields of the power cables induce currents in it. Symptoms: noise on analog signals, bus errors at random times.",
    zero: "0 V not earthed (floating): an earth fault on +24 V is not detected; a second earth fault can switch on a valve or a contactor by itself. Also noise on the 0 V. Rule: PELV – earth 0 V at ONE point.",
    diode: "No flyback diode: when the output switches off, the coil makes a voltage spike of several hundred volts. Symptoms: robot / PLC outputs die after weeks, random resets, noise on neighbouring cables.",
    parallel: "Signal cables in the same tray next to motor cables without a separator: PWM noise couples into encoder and sensor cables. Symptoms: position errors, 'encoder communication error' under load.",
  };
  function renderInfo() {
    const k = T.info, it = k && INFO[k];
    if (!it) { $("ckInfo").innerHTML = `<h3>Information</h3><p class="muted">Click a device in the drawing (e.g. a contactor, a fuse, the safety PLC) – here you see what it is, its rating, why it is there, what to check and how it typically fails.</p>`; return; }
    const r = typeof it.r === "function" ? it.r(K) : it.r;
    $("ckInfo").innerHTML = `<h3>${esc(it.t)}</h3><p>${esc(it.w)}</p><p><b>Rating (example):</b> ${esc(r)}</p><p><b>Why:</b> ${esc(it.y)}</p><p><b>Check:</b> ${esc(it.c)}</p><p><b>Typical failure:</b> ${esc(it.f)}</p>`;
  }
  /* ---------------- page-specific tables */
  function tbl(head, rows, cls = "") { return `<div class="table-wrap"><table class="rb-tbl ck-tbl ${cls}"><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</table></div>`; }
  function renderExtra(S) {
    let h = "";
    const p = T.page, rf = K.rbFeed, M = K.main, cv = K.conv;
    if (p === 1) h = `<h3>Branches of the distribution (example values)</h3>` + tbl(["Branch", "Load", "I_b", "Protection", "Cable (method C, × 0.8)", "ΔU"], [
      ["robot controller -A1", `${rf.S} kVA, ${rf.ph === 3 ? "3~ 400 V" : "1~ 230 V"}`, `${f(rf.Ib, 2)} A`, `-F2 MCB C${rf.In}`, `${rf.ph === 3 ? 5 : 3}G${rf.A}, I_z = ${rf.Iz} A, ${rf.L} m`, `${f(rf.dU, 2)} %`],
      ["conveyor -M11 / -M12", `2 × ${cv.P} kW`, `${f(cv.In, 2)} A each (start ${f(cv.Istart, 1)} A)`, `-Q11/-Q12 MPCB ${cv.mpcb}, -K1+-K2, -K11/-K12`, `4G${cv.A}, ${cv.L} m`, `${f(cv.dU, 2)} % (start ${f(cv.dUstart, 2)} %)`],
      ["24 V power supply -T1", `${K.psu.A} A × 24 V`, `${f(K.psu.IinRated, 2)} A (rated input)`, `-F3 MCB C${K.psu.mcb}, 1P+N`, "3G1.5 (inside)", "—"],
      ["light, socket, fan", "≈ 0.5 kW", `${f(EX.socket + EX.light + EX.fan, 2)} A (assumed)`, "-F4 RCBO B10, 30 mA", "3G1.5", "—"],
      ["<b>cabinet supply</b>", "sum, max. phase", `<b>${f(M.Imax, 2)} A</b>`, `-F1 gG ${M.In} A, -Q1 ${M.Q1} A`, `-W1 5G${M.A}, I_z = ${M.Iz} A, ${M.L} m`, `${f(M.dU, 2)} % (total ${f(M.dUtot, 2)} %)`]]);
    if (p === 2) h = `<h3>Servo axes of the ${esc(rb().ref)} (estimates from item 2: K_t from 400 V, peak current from the torque limit)</h3>` + tbl(["Axis", "Gear n", "Motor rpm", "K_t (N·m/A)", "Peak motor torque (N·m)", "Peak current î (A)", "Rated ≈ î/3 (A)", "T_peak · n_max (kW, upper bound)"],
      K.axes.map((a) => [`J${a.j}`, a.n, a.nMot, f(a.Kt, 3), f(a.tm, 2), f(a.iPeak, 1), f(a.iRated, 1), f(a.P, 2)])) +
      `<h3>Braking energy (J1–J3 stop together from full speed)</h3>` + tbl(["Step", "Formula", "Value"], [
        ["kinetic energy", "E_k = Σ ½·J·ω² (J = link + motor inertia, joint side)", `${K.regen.Ek} J`], ["into the DC bus", `E_bus = η·E_k, η = 0.85 · 0.9 = ${f(K.regen.eta, 3)}`, `${K.regen.Ebus} J`],
        ["capacitors can take", "E_cap = ½·C·(750² − 565²) = ½ · 0.002 · (562 500 − 319 225)", `${K.regen.Ecap} J`], ["to the brake resistor", "E_chop = E_bus − E_cap", `${K.regen.Echop} J`],
        ["ramp time (synchronised)", "t_A = max(ω_j / a_j)", `${f(K.regen.tA, 3)} s`], ["peak braking power", "P = Σ J·(ω/t_A)·ω · η = 2·E_k·η / t_A", `${f(K.regen.Ppk, 2)} kW`],
        ["brake resistor", "R ≤ U² / (1.2 · P_peak), U = 750 V", `${K.regen.R} Ω → U²/R = ${f(K.regen.Pchop, 2)} kW (40 Ω of item 2 = ${f(K.regen.P40, 2)} kW)`], ["resistor average power", "P_avg = E_chop / 10 s (one full stop every 10 s)", `${K.regen.Pavg} W`]]);
    if (p === 3) h = `<h3>24 V power budget (example)</h3>` + tbl(["Branch", "ECB", "Loads", "I (A)", "P (W)"], K.psu.branches.map((b) => [b.n, `${b.tag} ${b.set} A`, b.items.map((i) => `${esc(i[2] || i[0])} (${f(i[1], 2)} A)`).join("<br>"), f(b.I, 2), f(b.P, 0)]).concat([["<b>Sum</b>", "", `PSU -T1 ${K.psu.A} A (${24 * K.psu.A} W)`, `<b>${f(K.psu.I, 2)}</b>`, `<b>${K.psu.Pout}</b>`], ["<b>Loading</b>", "", "rule: ≤ 80 % (reserve for inrush, ageing, extensions)", `<b>${K.psu.load} %</b>`, `losses ${f(K.psu.loss, 0)} W`]]));
    if (p === 4) {
      const pl = K.pl;
      h = `<h3>What each contact does (step by step)</h3><ol class="ck-steps">
        <li><b>T1 / T2:</b> the safety PLC sends two different pulse patterns (test pulses, ≈ 1 ms low every few ms). Channel A of every device is fed by T1, channel B by T2.</li>
        <li><b>-S1 … -S3 (e-stops):</b> two NC contacts per button, in series per channel. Positive opening (⊖): pressing the button forces the contacts open, even if a contact is welded. Pressing opens both channels → F-DI0 and F-DI1 go to 0.</li>
        <li><b>-B1 (gate):</b> the coded switch gives two OSSD signals (its own test pulses). Gate open → both 0. If only one goes to 0 for more than the discrepancy time (e.g. 100 ms) → fault (wire break, stuck output).</li>
        <li><b>-S4 (enabling):</b> both contacts closed only in the middle position. Only used in T1.</li>
        <li><b>-S5 (mode):</b> 1-of-2: exactly one contact (AUTO or T1) must be closed.</li>
        <li><b>-K1/-K2 NC (EDM):</b> the mirror contacts of both safety contactors in series: closed = both contactors really dropped. Checked before every reset and after every switch-off.</li>
        <li><b>-S6 (reset):</b> after any stop the outputs stay off until reset (manual reset, on release). Reset is accepted only if all inputs are OK and the EDM loop is closed.</li>
        <li><b>Outputs:</b> F-DQ0/1 → robot ES1/ES2 (e-stop, cat 1: SS1 then STO), F-DQ2/3 → robot AS1/AS2 (protective stop in AUTO), F-DQ4/5 → -K1/-K2 (conveyor power, cat 0), F-DQ6 → guard lock -Y10 (power = unlock), F-DQ7/8 → -K5/-K6 (machine: robot out of the machine).</li></ol>
        <h3>What happens – overview (same states as item 2)</h3>` + tbl(["Event", "Detected by", "Outputs off", "Robot stop", "Conveyor", "Restart"], [
        ["e-stop pressed", "F-DI0 + F-DI1 = 0", "ES, AS, K1, K2, K5/K6", "cat 1 (SS1 → STO) if moving, else STO", "cat 0 (contactors)", "release + reset"],
        ["gate opened (AUTO)", "F-DI2 + F-DI3 = 0", "AS, K1, K2, K5/K6", "cat 1 → STO", "cat 0", "close + reset"],
        ["enabling released / panic (T1)", "F-DI4 + F-DI5 = 0", "AS", "cat 1 (or 0 when standing)", "already off in T1 with gate open", "middle + reset"],
        ["short circuit A–B", "test pulses (T2 seen on F-DI0)", "all", "cat 0", "cat 0", "repair + reset"],
        ["-K1 welded", "EDM loop open after switch-off", "(already off)", "—", "stopped by -K2", "repair, then reset"],
        ["gate OSSD2 stuck", "discrepancy OSSD1 ≠ OSSD2 > 100 ms", "all", "cat 0", "cat 0", "repair + reset"]]) +
        `<h3>PL verification example (ISO 13849-1, SISTEMA-style) – example values</h3>
        <p class="rc-note"><b>Category 3</b> = (1) redundancy: two channels, a single fault does not remove the safety function; (2) monitoring: the fault is detected at or before the next demand (test pulses, discrepancy, EDM); (3) DC_avg ≥ 60 % (here ≈ 90–99 %), MTTF_D ≥ 30 years per channel, CCF ≥ 65 points (separate cables, different contactors, over-voltage protection …). <b>PL d</b> needs PFH_D &lt; 10⁻⁶ /h; PL e &lt; 10⁻⁷ /h.</p>` +
        pl.sf.map((s) => tbl(["Subsystem (" + esc(s.n) + ")", "PFH_D (1/h)", "Basis"], s.rows.map((r) => [esc(r[0]), r[1].toExponential(2), esc(r[2])]).concat([[`<b>Sum = PFH_D of the function</b>`, `<b>${s.sum.toExponential(2)}</b>`, `PL by PFH_D: ${s.plPfh} · achieved PL ${s.pl} (lowest subsystem PL limits) · required PL_r ${s.plr} → <b class="${s.ok ? "rc-ok" : "rc-bad"}">${s.ok ? "OK" : "NOT OK"}</b>`]]))).join("") +
        `<p class="rc-note">Contactor example (SF2 output): MTTF_D = B10_D / (0.1 · n_op), n_op = d_op · h_op · 3600 / t_cycle = ${pl.K.d} · ${pl.K.h} · 3600 / ${pl.K.tc} s = ${pl.K.nop.toLocaleString("en")} switchings/year → MTTF_D = 1 000 000 / (0.1 · ${pl.K.nop.toLocaleString("en")}) = ${pl.K.mttfd} years (capped at 100 years for one channel in Cat 3). T10_D = B10_D / n_op = ${pl.K.T10d} years → change the contactors before 20 years (mission time).</p>`;
    }
    if (p === 5) h = `<h3>Signal list (names as in item 2) – address, tag, terminal, wire number, cable</h3>` + tbl(["Address", "Signal", "Device", "Terminal", "Wire no.", "Cable", "Description"], SIGLIST.map((r) => [r[0], `<code>${r[1]}</code>`, r[2], r[3], r[4], r[5], esc(r[6])])) +
      `<h3>Input / output electrical data (examples)</h3>` + tbl(["Item", "Value", "Note"], [["Digital input (IEC 61131-2 type 1)", "1: 15–30 V, ≥ 2 mA · 0: −3…5 V · typical 6 mA at 24 V (R_in ≈ 4 kΩ)", "type 3 accepts 2-wire sensors (lower current)"], ["PNP (sourcing) sensor", "switches +24 V to the signal wire; load = input to 0 V", "standard in Europe; broken wire = 0"], ["NPN (sinking) sensor", "switches 0 V; needs an input with common +24 V", "never mix on one card"], ["Digital output", "24 V, 0.5 A, short-circuit proof, PNP", "inductive load: flyback diode or the output's own clamp"], ["4–20 mA input", "R_shunt 250 Ω → 1–5 V; 16 bit", "p = (I − 4)/16 · range"], ["Interposing relay", "coil 24 V 20 mA, contact 6 A", "potential-free interface to other controllers"]]);
    if (p === 6) h = `<h3>Network plan (example)</h3>` + tbl(["Device", "PROFINET name", "IP (example)", "Data / cycle", "Cable / plug", "Length"], [
      ["-A2 PLC", "plc-r1", "192.168.10.1", "IO controller, RT 2 ms, F-host", "Cat 6 S/FTP, RJ45", "in cabinet"], ["-A1 robot controller", "robot-r1", "192.168.10.10", "64 bytes in/out, 2 ms + PROFIsafe (F-monitoring 100 ms)", "Cat 5e shielded, RJ45", "≈ 10 m"],
      ["-A7 HMI", "hmi-r1", "192.168.10.20", "OPC UA / PN, 100 ms", "Cat 5e, RJ45", "in door"], ["-A50 CNC", "cnc-r1", "192.168.10.30", "handshake, 4 ms", "Cat 5e, M12 D", "≈ 15 m"],
      ["-A6 remote I/O conveyor", "io-conv", "192.168.10.40", "16 DI/DO + IO-Link, 2 ms", "M12 D-coded, PUR", "≈ 20 m"], ["-A5 remote I/O gripper", "io-grip", "192.168.10.41", "8 DI/8 DO, 4 ms", "robot arm cable", "≈ 12 m"],
      ["-A90 firewall (cell side)", "—", "192.168.10.254", "OPC UA 4840 to the MES, 500 ms", "Cat 6", "—"]]) + `<p class="rc-note">Rules: max. 100 m copper per link; shield on both ends (via the plugs); green PROFINET cables separate from power cables (page 7); keep 20–30 % reserve of the cycle time; document names + IPs (as-built).</p>`;
    if (p === 7) h = `<h3>Common EMC / earthing faults and their symptoms</h3>` + tbl(["Fault", "Symptom", "Correct"], [
      ["shield on a pigtail", "encoder / bus errors at fast motions", "360° clamp on the plate + EMC gland"], ["PE loops / daisy-chained PE", "noise on analog signals, random bus errors", "PE in star to the PE bar, short and thick bonding"],
      ["0 V not earthed", "undetected earth faults, outputs switch by themselves after a 2nd fault, noise", "PELV: 0 V – PE at ONE point (-X3)"], ["missing flyback diode", "dead outputs, resets, noise", "diode / suppressor at every DC coil"],
      ["signal + motor cables together", "position errors, sensor flicker under load", "≥ 200 mm or metal separator, cross at 90°"], ["filter far from the entry / cables mixed", "filter has no effect, other machines disturbed", "filter at the entry, input and output cables apart"],
      ["painted mounting plate", "shields + filter not earthed at high frequency", "galvanised plate, contact washers, remove paint"]]);
    if (p === 8) h = `<h3>Layout rules (example)</h3>` + tbl(["Rule", "Why"], [["power top / control middle / terminals bottom, cable entry at the bottom", "short wiring, heat rises away from the electronics"], ["≥ 30–50 mm free above and below the PSU and the PLC", "convection cooling (datasheet)"], ["ducts filled ≤ 70 %, 20 % free rail space", "room for changes"], ["contactors and the drive in the 'dirty' part, PLC and network in the 'clean' part", "EMC (page 7)"], ["all terminals numbered as in the drawing, wire markers at both ends", "testing and fault finding"], ["main switch handle on the door, door locked when ON", "IEC 60204-1 §5.3"], ["filter fan at the bottom (in), outlet at the top", "warm air rises"]]);
    if (p === 9) h = `<h3>Safety relay or safety PLC?</h3>` + tbl(["Topic", "Safety relay (page 9)", "Safety PLC (page 4)"], [["logic", "fixed (one function per device)", "programmable (certified blocks)"], ["diagnosis", "LEDs only", "which button, which channel, which fault – on the HMI"], ["several e-stops in series", "fault masking possible (ISO/TR 24119) → limited DC", "each button can have its own input pair"], ["robot STO + conveyor + machine + locking", "many relays + expansion modules", "one system + PROFIsafe"], ["changes", "rewiring", "software change + re-validation"], ["cost", "low for 1–2 functions", "lower for a robot cell"]]);
    $("ckExtra").innerHTML = h;
  }

  /* ---------------- calculation card, BOM, tests, legend */
  function renderCalc() {
    const rf = K.rbFeed, M = K.main, cv = K.conv, v = K.v24, ps = K.psu, rg = K.regen, bu = K.bus, rs = K.resp, lp = K.loop, ls = K.loopSock, ht = K.heat;
    const rows = [
      ["1 Robot controller current", rf.ph === 3 ? "I_b = S / (√3 · U)" : "I_b = S / U0", rf.ph === 3 ? `${rf.S * 1000} / (1.732 · 400)` : `${rf.S * 1000} / 230`, `<b>${f(rf.Ib, 2)} A</b>`],
      ["2 Protective device", "I_b ≤ I_n ≤ I_z, here I_n ≥ 1.25 · I_b (continuous load)", `1.25 · ${f(rf.Ib, 2)} = ${f(1.25 * rf.Ib, 2)} A → next size`, `<b>MCB C${rf.In} A</b> (check the controller manual)`],
      ["3 Cable cross-section", "I_z = I_table(method C) · f_group", `${rf.A} mm²: ${rf.Itab} A · ${EX.fGroup} = ${rf.Iz} A ≥ ${rf.In} A`, `<b>${rf.ph === 3 ? 5 : 3}G${rf.A} mm²</b>`],
      ["4 Voltage drop robot feed", rf.ph === 3 ? "ΔU% = √3·I·L·cosφ / (κ·A·U) · 100" : "ΔU% = 2·I·L·cosφ / (κ·A·U0) · 100", `${rf.ph === 3 ? "1.732" : "2"} · ${f(rf.Ib, 2)} · ${rf.L} · ${rf.cos} / (56 · ${rf.A} · ${rf.ph === 3 ? 400 : 230}) · 100`, `<b>${f(rf.dU, 2)} %</b>`],
      ["5 Cabinet supply", "max. phase current → gG fuse ≥ 1.25·I and ≥ 1.6 × biggest MCB", `L1 ${f(M.ph[0], 2)} / L2 ${f(M.ph[1], 2)} / L3 ${f(M.ph[2], 2)} A`, `<b>-F1 ${M.In} A gG, -Q1 ${M.Q1} A, -W1 5G${M.A} (I_z ${M.Iz} A)</b>`],
      ["6 Voltage drop supply", "ΔU% (main cable, cos φ 0.9) + ΔU% robot feed ≤ 5 % (IEC 60204-1 §12.4)", `${f(M.dU, 2)} % + ${f(rf.dU, 2)} %`, `<b>${f(M.dUtot, 2)} % ${M.dUtot <= 5 ? "✓" : "✗"}</b>`],
      ["7 Conveyor motor", "I_n = P / (√3·U·η·cosφ)", `${cv.P * 1000} / (1.732 · 400 · ${cv.eta} · ${cv.cos})`, `<b>${f(cv.In, 2)} A</b> → MPCB ${cv.mpcb}, set ${f(cv.set, 2)} A`],
      ["8 Motor cable + start", "ΔU% run (cosφ 0.73) and at start (6·I_n, cosφ 0.4), 4G1.5, 25 m", `run ${f(cv.dU, 2)} %, start ${f(cv.dUstart, 2)} %`, "<b>1.5 mm² OK</b> (start drop < 10 %)"],
      ["9 24 V branch drop", "ΔU = 2·L·I / (κ·A)", `2 · ${v.L} · ${v.I} / (56 · 0.75) = ${f(v.dU075, 2)} V (${v.p075} %) · with 1.5 mm²: ${f(v.dU15, 2)} V (${v.p15} %)`, `<b>use 1.5 mm²</b> (aim ≤ 5 %; device min. ${v.Umin} V)`],
      ["10 24 V power supply", "ΣI of all branches ≤ 80 % of the PSU", `${f(ps.I, 2)} A / ${ps.A} A`, `<b>${ps.A} A PSU, ${ps.load} %</b>`],
      ["11 DC bus energy", "E = ½·C·U²; bleed time t = R·C·ln(U0/60 V)", `½ · 0.002 · 565² = ${bu.E} J · 22 kΩ: ${bu.tBl} s to 60 V`, `<b>${bu.E} J – DANGER, wait + measure</b>`],
      ["12 Precharge", "I_peak = U/R, τ = R·C", `565 / 47 = ${bu.Ipre} A · 47 · 0.002 = ${bu.tau} ms`, `<b>bypass after ≈ 5τ = ${f(bu.tau * 5 / 1000, 2)} s</b>`],
      ["13 Braking resistor", "E_chop = η·Σ½Jω² − ½·C·(U₂² − U₁²); R ≤ U²/(1.2·P_peak)", `${rg.Ebus} J − ${rg.Ecap} J = ${rg.Echop} J · P_peak ${f(rg.Ppk, 2)} kW → 750²/${rg.R} Ω = ${f(rg.Pchop, 2)} kW`, `<b>R = ${rg.R} Ω, ${rg.Echop} J per stop, ${rg.Pavg} W average</b> (1 stop / 10 s)`],
      ["14 Safety response time", "T = t_sensor + t_safetyPLC + t_robot + t_stop (cat 1, J1 full speed)", `${rs.sensor} + ${rs.plc} + ${rs.robot} + ${rs.stop} s`, `<b>T = ${f(rs.T, 3)} s</b> (arm moves ${rs.dist} mm at the TCP during the ramp)`],
      ["15 Safety distance", "S = K·T + C (ISO 13855), K = 1600 mm/s, C = 0 (interlocked gate, no reach-through)", `1600 · ${f(rs.T, 3)} + 0`, `<b>S = ${rs.S} mm</b> (light curtain d = 30 mm: C = 8·(30−14) = ${rs.lcC}; K = 2000, if S > 500 then K = 1600 but S ≥ 500 → ${rs.Slc} mm)`],
      ["16 Loop impedance (TN-S)", "Z_s = Z_e + 1.2·2·L/(κ·A) (main + feed) ≤ U0 / I_a, I_a = 10·I_n (C-curve)", `${lp.Ze} + … = ${f(lp.Zs, 3)} Ω ≤ 230 / ${lp.Ia} = ${f(lp.Zmax, 3)} Ω`, `<b>${lp.ok ? "OK" : "NOT OK"}</b>: I_k ≈ ${lp.Ik} A → disconnects in < 0.1 s (required 0.4 s)`],
      ["17 Sockets (RCD)", "sockets ≤ 32 A: 30 mA RCD (IEC 60364-4-41); Z_s ≤ 230 / (5 · 10 A)", `Z_s ${f(ls.Zs, 3)} Ω ≤ ${f(ls.Zmax, 2)} Ω`, `<b>${ls.ok ? "OK" : "NOT OK"}</b> · robot feed: no 30 mA RCD (drive leakage) – if required: type B`],
      ["18 Cabinet heat", "P_wall = k·A·ΔT; V̇ = 3.1·(P_loss − P_wall)/ΔT", `${f(ht.P, 0)} W − ${f(ht.Psurf, 0)} W = ${f(ht.Pfan, 0)} W`, `<b>V̇ = ${f(ht.Vdot, 0)} m³/h → fan ${ht.fan} m³/h</b> (page 8)`],
      ["19 Contactor reliability", "MTTF_D = B10_D / (0.1·n_op)", `1 000 000 / (0.1 · ${K.pl.K.nop.toLocaleString("en")})`, `<b>${K.pl.K.mttfd} years</b> (capped 100) → PL check page 4`],
    ];
    $("ckCalc").innerHTML = `<tr><th>Check</th><th>Formula</th><th>Numbers (${esc(rb().ref)})</th><th>Result</th></tr>` + rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join("");
  }
  function renderBom() {
    const rf = K.rbFeed, M = K.main, cv = K.conv, ps = K.psu;
    const B = [
      ["-Q1", "main switch (rotary disconnector) with door handle, lockable", `3-pole, ${M.Q1} A, AC-23`, "rotary disconnector 3P with red/yellow handle + padlock", 1],
      ["-F1", "fuse holder + fuses", `gG ${M.In} A`, "3-pole fuse holder 10×38 / NH00 + gG fuses", 1],
      ["-F2", "MCB robot controller", `C${rf.In} A, ${rf.ph === 3 ? 3 : 2}-pole, 10 kA`, "miniature circuit breaker C-curve (or as in the robot manual)", 1],
      ["-F3", "MCB 24 V power supply", `C${ps.mcb} A, 1P+N`, "miniature circuit breaker C-curve", 1],
      ["-F4", "RCBO light + socket + fan", "B10 A, 30 mA, type A", "residual current breaker with overcurrent protection", 1],
      ["-Q11, -Q12", "motor-protective circuit breaker", `${cv.mpcb}`, "MPCB with thermal + magnetic trip, aux contact", 2],
      ["-K1, -K2", "safety contactor", "AC-3 4 kW, coil 24 V DC, 3 NO + 1 NC mirror contact", "contactor with mirror contact (IEC 60947-4-1 Annex F)", 2],
      ["-K11, -K12", "conveyor contactor", "AC-3 4 kW, coil 24 V DC + diode", "mini contactor with suppressor", 2],
      ["-M11, -M12", "conveyor gear motor", `${cv.P} kW, 400 V, IE2`, "3-phase gear motor 4-pole", 2],
      ["-T1", "24 V power supply", `24 V DC, ${ps.A} A, 1-phase, PFC`, "DIN-rail switched-mode PSU with DC-OK contact", 1],
      ["-G2", "buffer module", "24 V, 20 A, 0.5 s", "capacitor buffer module", 1],
      ["-F21 … -F26", "electronic circuit breakers", "6 channels, 1–10 A adjustable, signal contact", "multi-channel ECB for 24 V DC", 1],
      ["-A2", "safety PLC", "F-CPU + F-DI 16 (test pulses) + F-DQ 10 (PM) + DI/DO, PROFINET/PROFIsafe", "safety PLC (PL e / SIL 3)", 1],
      ["-A3", "robot I/O board", "16 DI / 16 DO 24 V", "robot supplier option", 1],
      ["-A4", "analog input", "4–20 mA, 2 ch, 16 bit", "robot or remote I/O analog module", 1],
      ["-A5, -A6", "remote I/O IP67", "16 DI/DO, IO-Link, M12", "PROFINET IP67 I/O block", 2],
      ["-A7", "HMI", "10 inch, PROFINET", "operator panel", 1],
      ["-A80", "managed switch", "8 ports, PROFINET class B", "industrial managed switch", 1],
      ["-A90", "firewall / router", "NAT, OPC UA port only", "industrial firewall", 1],
      ["-S2, -S3", "emergency-stop buttons", "2 NC positive opening, red/yellow, IEC 60947-5-5", "e-stop push button 40 mm with monitored contact block", 2],
      ["-S1, -S4", "e-stop + enabling device", "in the teach pendant", "robot supplier", 1],
      ["-B1", "safety gate switch with guard locking", "RFID coded, 2 OSSD, PL e, holding force ≥ 2000 N, power to unlock", "coded safety switch with guard locking (ISO 14119)", 1],
      ["-S5", "mode selector", "key, 1-of-2 contacts", "key switch (often on the robot controller)", 1],
      ["-S6, -S7", "reset + request entry buttons", "1 NO, illuminated blue / white", "push button with LED", 2],
      ["-P1, -P11", "indicator lamps", "24 V LED", "pilot light", 2],
      ["-K5, -K6", "safety relays (force-guided contacts)", "1 NO + 1 NC, 24 V DC", "relay with force-guided contacts IEC 61810-3", 2],
      ["-K21 … -K23", "interposing relays", "24 V DC coil with diode + LED, 1 CO 6 A", "plug-in relay with socket", 3],
      ["-B11", "optical sensor (PNP)", "10–30 V DC, PNP NO, M12", "diffuse sensor", 1],
      ["-B12, -B13", "cylinder sensors (PNP)", "PNP NO, 3-wire", "magnetic slot sensor", 2],
      ["-B15", "limit switch", "roller lever, 1 NO", "position switch IP67", 1],
      ["-B16", "pressure transmitter", "0–10 bar, 4–20 mA, 2-wire", "pressure transmitter G1/4", 1],
      ["-Y11", "gripper solenoid valve", "24 V DC 2.5 W, plug with LED + diode", "5/2-way valve", 1],
      ["-X1, -X2, -X3, -X4, -X5", "terminal strips", "spring clamp, 2.5 / 4 mm², PE green-yellow, link terminal -X3", "DIN-rail terminals + markers", 1],
      ["-W1", "supply cable", `5G${M.A} mm² Cu, ${M.L} m`, "power cable (e.g. NYY / H07RN-F)", 1],
      ["-W2", "robot controller feed", `${rf.ph === 3 ? 5 : 3}G${rf.A} mm², ${rf.L} m`, "power cable", 1],
      ["-W11 …", "robot motor + SMB cables", "shielded, robot class", "robot supplier", 1],
      ["—", "PROFINET cables", "Cat 5e/6 shielded, green, RJ45 / M12 D-coded", "industrial Ethernet cable", 1],
      ["—", "cabinet", "600 × 1200 × 300 mm, IP54, galvanised mounting plate", "wall cabinet sheet steel", 1],
      ["-E2, -B9", "filter fan + outlet filter + thermostat", `${K.heat.fan} m³/h, thermostat 35 °C`, "filter fan 230 V", 1],
      ["-E1, -S9, -XD1", "cabinet light + door switch + socket", "LED 230 V, socket 16 A", "cabinet accessories", 1],
      ["—", "EMC accessories", "EMC cable glands, shield clamps, PE bar, ducts 60×60, DIN rails", "—", 1],
    ];
    $("ckBom").innerHTML = `<tr><th>Tag</th><th>Description</th><th>Typical rating (example)</th><th>Example product type (generic)</th><th>Qty</th></tr>` + B.map((r) => `<tr><td><b>${esc(r[0])}</b></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${r[4]}</td></tr>`).join("");
  }
  function renderTest() {
    const R = [
      ["1", "Visual inspection (no power)", "drawing = installation, tags, wire colours, terminal torque, cable glands, covers, warning labels (DC bus waiting time, external voltage), IP rating", "all points OK, red-marked drawing", "IEC 60204-1 §18.1"],
      ["2", "PE continuity", "test current ≥ 0.2 A from the PE bar to every housing (robot base, fence, conveyor, doors, motor)", "≤ 0.1 Ω (example; depends on length + cross-section)", "§18.2.2"],
      ["3", "Insulation resistance", "500 V DC between all power conductors (L1–L3, N connected) and PE; drives, filters, PSU and surge protectors disconnected; 24 V: open -X3, test at 250 V DC", "≥ 1 MΩ (power), ≥ 0.5 MΩ (PELV 24 V)", "§18.3, IEC 60364-6"],
      ["4", "Fault loop impedance", `measure Z_s at -F2 and at the socket`, `Z_s ≤ U0/I_a (here ≤ ${f(K.loop.Zmax, 2)} Ω for C${K.rbFeed.In})`, "§18.2.3"],
      ["5", "RCD test", "test button + tester at IΔn", "trips ≤ 300 ms at 30 mA (≤ 40 ms at 5 × IΔn)", "IEC 60364-6"],
      ["6", "Supply + phase sequence", "voltage L–L, L–N, N–PE; rotary field clockwise; conveyor direction", "400 V ± 10 %, N–PE < 2 V", "§18.6"],
      ["7", "24 V system", "polarity, voltage at the farthest device, ECB trip test per branch, 0 V–PE link in place", "≥ 21.6 V at the device (example), only the shorted branch trips", "IEC 61131-2"],
      ["8", "Residual voltage", "DC bus voltage after switch-off (drive manufacturer data)", "< 60 V within 5 s, else warning label with time", "§18.5, §6.2.4"],
      ["9", "I/O check", "every input: actuate sensor → LED → signal in the pendant; every output: force → valve / relay moves; analog 4 / 12 / 20 mA", "signal list ticked line by line", "—"],
      ["10", "Fieldbus", "device names, topology, cable certification (Cat 5e), diagnostic counters after 24 h", "no errors, cycle time as planned", "PROFINET guideline"],
      ["11", "Safety functions – functional test", "each e-stop, EACH CHANNEL SEPARATELY (open one wire → discrepancy fault, no reset); gate + locking; enabling 3 positions incl. panic; mode selector; reset only from outside; EDM (bridge / weld simulation); cross-fault (short A–B)", "every expected reaction + stop category happens", "IEC 60204-1 §18.6, ISO 13849-2"],
      ["12", "Safety validation", "validation plan, FMEA of the circuits, fault-injection list, SISTEMA report (PL ≥ PL_r for every safety function), CCF score", "PL achieved ≥ PL_r, report signed", "ISO 13849-2"],
      ["13", "Stopping time + distance", "stop-time meter at max. speed + payload; compare with the calculation", `T ≤ ${f(K.resp.T, 3)} s → safety distance ≥ ${K.resp.S} mm (ISO 13855)`, "ISO 13855, ISO 10218-2"],
      ["14", "Robot safety configuration", "brake test, safe zones, safe speed, configuration checksum, user rights", "checksum documented", "ISO 10218-1/2"],
      ["15", "Documentation", "as-built drawings, test reports, parameter backups, safety validation report, operating instructions, CE declaration", "complete before hand-over", "Machinery Regulation (EU) 2023/1230"],
    ];
    $("ckTest").innerHTML = `<tr><th>#</th><th>Test</th><th>How</th><th>Accept (example)</th><th>Standard</th></tr>` + R.map((r) => `<tr><td>${r[0]}</td><td><b>${esc(r[1])}</b></td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td></tr>`).join("");
  }
  function renderLegend() {
    const sym = (fn, w = 70, h = 56) => { const P = pen(0); fn(P); return `<svg class="ck-svg ck-mini" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${P.out()}</svg>`; };
    const L = [
      [(P) => P.contact(35, 8, { type: "NO" }), "NO contact (normally open): closes when actuated"],
      [(P) => P.contact(35, 8, { type: "NC" }), "NC contact (normally closed): opens when actuated"],
      [(P) => P.contact(35, 8, { type: "NO", act: true }), "actuated contact (live view, highlighted)"],
      [(P) => P.contact(35, 8, { type: "NO", fn: "ctr" }), "contactor main contact (semicircle)"],
      [(P) => P.contact(35, 8, { type: "NO", fn: "brk" }), "circuit breaker (MCB, MPCB): × = trips"],
      [(P) => { P.contact(35, 8, { type: "NO", fn: "dis" }); P.link(18, 30, 28).act(18, 28, "turn"); }, "disconnector / main switch (bar), rotary handle"],
      [(P) => P.fuse(35, 8), "fuse"],
      [(P) => P.coil(35, 8, { t: false }), "coil of a relay / contactor (A1–A2)"],
      [(P) => P.coil(35, 8, { kind: "safety", t: false }), "coil of a safety contactor / relay (thick edge)"],
      [(P) => P.coil(35, 8, { kind: "valve", t: false }), "solenoid valve coil"],
      [(P) => P.coil(35, 8, { kind: "brake", t: false }), "motor holding brake (spring brake)"],
      [(P) => P.coil(35, 8, { kind: "lock", t: false }), "guard locking solenoid"],
      [(P) => { P.contact(45, 8, { type: "NC" }); P.link(14, 40, 28).act(14, 28, "mush").forced(28, 28); }, "emergency-stop button, NC with positive opening (⊖)"],
      [(P) => { P.contact(45, 8, { type: "NO" }); P.link(22, 40, 28).act(22, 28, "push"); }, "push button (NO)"],
      [(P) => { P.contact(45, 8, { type: "NO" }); P.link(24, 40, 28).act(24, 28, "key"); }, "key switch (mode selector)"],
      [(P) => { P.contact(45, 8, { type: "NO" }); P.link(24, 40, 28).act(24, 28, "pos"); }, "position / limit switch (roller, cam)"],
      [(P) => { P.contact(45, 8, { type: "NO" }); P.link(24, 40, 28).act(24, 28, "hand"); }, "enabling device (hand operated, 3 positions)"],
      [(P) => P.motor(35, 28, 18), "motor, 3-phase (M 3~)"],
      [(P) => P.lamp(35, 8), "indicator lamp"],
      [(P) => P.diode(35, 8), "diode (conducts in the arrow direction)"],
      [(P) => P.res(35, 8), "resistor"],
      [(P) => P.cap(35, 8), "capacitor"],
      [(P) => P.igbt(40, 8), "IGBT transistor with free-wheeling diode"],
      [(P) => P.pe(35, 8), "protective earth (PE)"],
      [(P) => P.gnd(35, 14), "functional earth / shield earth"],
      [(P) => { P.term(35, 28, ""); P.dot(55, 28); }, "terminal (-X2:5) · connection dot (wires joined)"],
      [(P) => P.raw(`<path d="M10,28 H60" class="ck-mech"/>`), "mechanical link (parts of one device)"],
      [(P) => P.raw(`<ellipse cx="35" cy="28" rx="7" ry="20" class="ck-shield"/><path d="M20,18 H50 M20,28 H50 M20,38 H50" class="ck-w ck-w-L2"/>`), "cable shield"],
      [(P) => P.t(8, 32, "/4.6", { s: 14, c: "ref" }), "cross-reference: page 4, column 6"],
      [(P) => { P.box(10, 10, 50, 36); P.raw(`<path d="M10,46 L60,10" class="ck-thin"/>`); P.t(14, 24, "~", { s: 12 }); P.t(50, 42, "=", { s: 12 }); }, "power supply / rectifier (AC → DC)"],
    ];
    const LET = [["A", "assembly, PLC, controller, drive (-A2)"], ["B", "sensor, transmitter, encoder (-B11)"], ["C", "capacitor (-C1)"], ["E", "light, heater, fan (-E1)"], ["F", "protective device: fuse, MCB, ECB (-F2)"], ["G", "battery, buffer (-G1)"], ["K", "relay, contactor, safety relay (-K1)"], ["M", "motor (-M11)"], ["P", "lamp, display, meter (-P1)"], ["Q", "power switch: main switch, MPCB, contactor for power (-Q1)"], ["R", "resistor (-R43)"], ["S", "push button, switch, e-stop (-S1)"], ["T", "transformer, power supply (-T1)"], ["V", "semiconductor: rectifier, IGBT (-V1)"], ["W", "cable (-W2)"], ["X", "terminal, plug, socket (-X2)"], ["Y", "valve, brake, lock solenoid (-Y11)"], ["Z", "filter (-Z1)"]];
    const WC = [["L1 / L2 / L3", "brown / black / grey", "IEC 60445 (cable cores); inside the cabinet IEC 60204-1 recommends black for all AC/DC power", "ck-sw-L1"], ["N (neutral)", "light blue", "never use light blue for anything else", "ck-sw-N"], ["PE (protective earth)", "green-yellow", "only for PE – never for anything else", "ck-sw-PE"], ["DC power (DC bus)", "black", "IEC 60204-1 §13.2.4", "ck-sw-DC"], ["AC control", "red", "e.g. 230 V AC control circuits", "ck-sw-red"], ["DC control +24 V / 0 V", "dark blue (0 V often blue-white)", "IEC 60204-1 §13.2.4", "ck-sw-24"], ["external voltage (interlock from outside)", "orange", "stays live when the main switch is OFF", "ck-sw-ext"], ["sensor cable", "BN brown +24 V, BU blue 0 V, BK black signal, WH white 2nd signal", "IEC 60947-5-2 (M12)", "ck-sw-L1"], ["PROFINET", "green sheath", "industrial Ethernet", "ck-sw-bus"]];
    $("ckLegend").innerHTML = `<div class="ck-legend">${L.map(([fn, t]) => `<div class="ck-legi">${sym(fn)}<span>${esc(t)}</span></div>`).join("")}</div>
      <div class="rb-grid2"><div><h3>Device letters (IEC 81346-2, simplified)</h3>${tbl(["Letter", "Meaning (example)"], LET.map((r) => [`<b>-${r[0]}</b>`, esc(r[1])]))}</div>
      <div><h3>Wire colours</h3>${tbl(["Conductor", "Colour", "Note", "In the drawing"], WC.map((r) => [esc(r[0]), esc(r[1]), esc(r[2]), `<svg width="60" height="12"><path d="M2,6 H58" class="ck-w ${r[3].replace("ck-sw-", "ck-w-")}"/>${r[3] === "ck-sw-PE" ? '<path d="M2,6 H58" class="ck-w ck-w-PEy"/>' : ""}${r[3] === "ck-sw-24" ? '<path d="M30,6 H58" class="ck-w ck-w-0V"/><path d="M30,6 H58" class="ck-w ck-w-0Vs"/>' : ""}</svg>`]))}
      <p class="rc-note">Tag format: <b>=R1+CC1-K1:13</b> = plant R1, location cabinet CC1, device K1, terminal 13 (IEC 81346). Cross-reference <b>/4.6</b> = page 4, column 6.</p></div></div>`;
  }
  function renderCards() { renderCalc(); renderBom(); renderTest(); renderLegend(); }

  /* ---------------- events */
  const sheet = $("ckSheet");
  sheet.addEventListener("click", (e) => { const h = e.target.closest("[data-ck]"); if (h) { T.info = h.dataset.ck; renderInfo(); render(true); } });
  box.addEventListener("click", (e) => {
    const pg = e.target.closest("[data-ckpg]"); if (pg) { T.page = +pg.dataset.ckpg; render(true); return; }
    const a = e.target.closest("[data-ckact]");
    if (a) {
      const [k, v] = a.dataset.ckact.split(":");
      if (k === "es") act.es(v); else if (k === "conv") act.conv(v); else if (k === "door") T.doorOpen = !T.doorOpen; else if (k === "zl") T.zeroLink = !T.zeroLink; else act[k]();
      render(true); return;
    }
    const s = e.target.closest("[data-ckseg]");
    if (s) { const n = s.dataset.ckseg, v = s.dataset.v; if (n === "en") act.en(+v); else if (n === "mode") act.mode(v); else if (n === "emc") T.emc = v; render(true); }
  });
  box.addEventListener("change", (e) => { const c = e.target.closest("[data-ckfault]"); if (c) { act.fault(c.dataset.ckfault); render(true); } });
  $("ckRb").value = rbId;
  $("ckRb").addEventListener("change", (e) => { rbId = e.target.value; K = calc(rb()); BP = busProfile(rb()); rbRef = rb().ref + " · " + rb().ctrl.split(" / ")[0]; fullPass(); renderCards(); lastKey = ""; render(true); });
  $("ckQ1").addEventListener("click", () => { act.q1(); render(true); });
  $("ckEs").addEventListener("click", () => { act.es("tp"); render(true); });
  $("ckGate").addEventListener("click", () => { if (T.gate && T.locked && !T.unlock) act.req(); act.gate(); render(true); });
  $("ckReset").addEventListener("click", () => { act.reset(); render(true); });

  /* ---------------- animation loop */
  let raf = 0, lastTs = 0, running = false;
  function loop(ts) {
    raf = 0;
    if (Q.has("ckdbg") && !loop.n) { loop.n = 1; console.log("CKDBG loop first call offsetParent=" + (box.offsetParent && box.offsetParent.id) + " hidden=" + box.hidden + " tab=" + document.querySelector("#tab-robot").className); }
    if (!box.offsetParent) { running = false; sheet.classList.add("ck-paused"); poll(); return; }
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0; lastTs = ts;
    tick(dt);
    if (T.robot === "RUNNING") { T.servoT = (T.servoT + dt) % BP.T; }
    else if (T.robot === "STOPPING") T.servoT = Math.min(BP.T, T.servoT + dt);
    T.netT += dt * 0.5;
    const live = liveIO();
    T.ioLive = !!live;
    if (live) T.io = live;
    else if (T.robot === "RUNNING") { T.ioT = (T.ioT + dt) % DEMO_T; T.io = demoAt(T.ioT); }
    T.blink = Math.floor(T.now * 2) % 2 === 0;
    render(false);
    raf = requestAnimationFrame(loop);
  }
  // item 3 selected but the Robot tab not visible yet (or another tab): check every 0.5 s, restart the loop when visible again
  let pollT = 0;
  function poll() { if (pollT || box.hidden) return; pollT = setTimeout(() => { pollT = 0; if (box.hidden) return; if (box.offsetParent) show(); else poll(); }, 500); }
  function show() { if (Q.has("ckdbg")) console.log("CKDBG show running=" + running); sheet.classList.remove("ck-paused"); if (!running) { running = true; lastTs = 0; raf = requestAnimationFrame(loop); } }

  /* ---------------- initial state from the URL (tests, deep links) */
  rbRef = rb().ref + " · " + rb().ctrl.split(" / ")[0];
  if (Q.has("ckt1")) { T.mode = "T1"; }
  if (Q.has("ckweld")) { T.fault.weld = true; }
  if (Q.has("ckestop")) act.es("tp");
  if (Q.has("ckgate")) { act.req(); T.robot = "STO"; tick(0); T.unlock = true; act.gate(); }
  if (Q.has("ckcross")) act.fault("cross");
  if (Q.has("ckstuck")) { T.fault.gateStuck = true; T.unlock = true; act.gate(); }
  if (Q.has("ckshort")) T.f24short = true;
  if (Q.has("ckq1off")) act.q1();
  if (Q.get("ckemc")) T.emc = Q.get("ckemc");
  if (Q.has("ckweld")) { tick(0.5); tick(0.5); }
  fullPass(); renderCards(); render(true);
  if (Q.get("ckcard")) setTimeout(() => { const c = $({ calc: "ckCardCalc", bom: "ckCardBom", test: "ckCardTest", legend: "ckCardLegend" }[Q.get("ckcard")]); if (c) c.scrollIntoView(); }, 300);
  if (Q.has("cktest")) setTimeout(() => selfTest(), 200);
  if (Q.has("ckdbg")) [1000, 5000, 9000, 13000].forEach((ms) => setTimeout(() => console.log(`CKDBG t=${ms} simT=${T.now.toFixed(2)} running=${running} raf=${raf} offsetParent=${box.offsetParent && (box.offsetParent.id || box.offsetParent.tagName)} h=${box.getBoundingClientRect().height} tabdisp=${getComputedStyle($("tab-robot")).display} vis=${document.visibilityState}`), ms));
  const whenVisible = (fn) => { const w = () => (box.offsetParent ? fn() : setTimeout(w, 200)); w(); };
  if (Q.has("ckback")) whenVisible(() => setTimeout(() => {
    window.rbCtl && window.rbCtl.showItem("1");
    setTimeout(() => {
      const c3 = document.querySelector("#rb3d canvas");
      console.log(`CKBACK simT=${T.now.toFixed(2)} item1 visible=${!$("rbItem1").hidden} item3 hidden=${box.hidden} 3D canvas=${c3 ? c3.clientWidth + "x" + c3.clientHeight : "none"} loop running=${running} errors=${errs.length ? errs.join(" | ") : "none"}`);
      window.rbCtl.showItem("2");
      setTimeout(() => { console.log(`CKBACK item2 visible=${!$("rbItem2").hidden} built=${$("rbItem2").children.length > 0} errors=${errs.length ? errs.join(" | ") : "none"}`); window.rbCtl.showItem("3"); setTimeout(() => console.log(`CKBACK item3 again visible=${!box.hidden} svg=${!!document.querySelector("#ckSheet svg")} loop=${running} simT=${T.now.toFixed(2)} errors=${errs.length ? errs.join(" | ") : "none"}`), 600); }, 1000);
    }, 1000);
  }, 1500));

  /* ---------------- self test (&cktest): numbers for every robot + safety logic scenarios */
  function selfTest() {
    const out = (s) => console.log("CKTEST " + s);
    ROBOTS.forEach((r) => {
      const k = calc(r), b = busProfile(r);
      out(`${r.id} feed: S=${k.c.S}kVA ph=${k.c.ph} Ib=${f(k.rbFeed.Ib, 2)}A In=C${k.rbFeed.In} A=${k.rbFeed.A}mm2 Iz=${k.rbFeed.Iz} dU=${f(k.rbFeed.dU, 3)}%`);
      out(`${r.id} main: ph=${k.main.ph.map((v) => f(v, 2)).join("/")} Imax=${f(k.main.Imax, 2)} F1=${k.main.In}A Q1=${k.main.Q1}A W1=${k.main.A}mm2 Iz=${k.main.Iz} dU=${f(k.main.dU, 3)}% tot=${f(k.main.dUtot, 3)}%`);
      out(`${r.id} loop: Zs=${f(k.loop.Zs, 3)} Zmax=${f(k.loop.Zmax, 3)} Ik=${k.loop.Ik} ok=${k.loop.ok} sock Zs=${f(k.loopSock.Zs, 3)} ok=${k.loopSock.ok}`);
      out(`${r.id} psu: I=${f(k.psu.I, 2)}A PSU=${k.psu.A}A load=${k.psu.load}% Pout=${k.psu.Pout}W loss=${f(k.psu.loss, 1)}W IinRated=${f(k.psu.IinRated, 2)} branches=${k.psu.branches.map((x) => x.tag + ":" + f(x.I, 2) + "/" + x.set).join(" ")}`);
      out(`${r.id} axes: ${k.axes.map((a) => `J${a.j} n=${a.n} Kt=${f(a.Kt, 3)} ipk=${f(a.iPeak, 1)} P=${f(a.P, 2)}`).join(" | ")}`);
      out(`${r.id} regen: Ek=${k.regen.Ek}J tA=${k.regen.tA} Ebus=${k.regen.Ebus}J Ecap=${k.regen.Ecap}J Echop=${k.regen.Echop}J Ppk=${k.regen.Ppk}kW R=${k.regen.R} Pchop=${k.regen.Pchop}kW Pavg=${k.regen.Pavg}W | profile vmax=${f(b.vmax, 0)}V vmin=${f(b.vmin, 0)}V Echop=${f(b.Echop, 0)}J R=${b.R}`);
      out(`${r.id} resp: ${JSON.stringify(k.resp)}`);
      out(`${r.id} pl: ${k.pl.sf.map((s) => `${s.sum.toExponential(2)} PLpfh=${s.plPfh} PL=${s.pl} ok=${s.ok}`).join(" | ")} K=${JSON.stringify(k.pl.K)}`);
      out(`${r.id} heat: P=${k.heat.P}W Ae=${k.heat.Ae} Psurf=${k.heat.Psurf} Pfan=${k.heat.Pfan} Vdot=${k.heat.Vdot} fan=${k.heat.fan} Qac=${k.heat.Qac} ctrlLoss=${k.heat.ctrlLoss}`);
      out(`${r.id} conv: In=${k.conv.In} Istart=${k.conv.Istart} dU=${k.conv.dU} dUs=${k.conv.dUstart} | v24 ${JSON.stringify(k.v24)} | bus ${JSON.stringify(k.bus)}`);
    });
    // hand checks of the formulas
    const h1 = 4500 / (Math.sqrt(3) * 400), h2 = Math.sqrt(3) * h1 * 10 * 0.95 / (56 * 1.5 * 400) * 100, h3 = 0.5 * 0.002 * (750 ** 2 - 565 ** 2);
    out(`hand: I(4.5kVA)=${f(h1, 3)}A dU(10m,1.5mm2)=${f(h2, 3)}% Ecap=${f(h3, 1)}J chopper=${f(750 ** 2 / 40, 0)}W 24V drop=${f(2 * 25 * 1.5 / (56 * 0.75), 3)}V Vdot(38W,5K)=${f(3.1 * 38 / 5, 1)}`);
    // safety logic scenarios (on a fresh copy of the state)
    const save = JSON.stringify(T), restore = () => Object.assign(T, JSON.parse(save));
    const sc = (name, fn) => { Object.assign(T, makeState(), { io: T.io }); fn(); const O = evalOut(T); out(`logic ${name}: robot=${T.robot} es=${O.oES} as=${O.oAS} k1=${O.k1} k2=${O.k2} k1c=${O.k1c} k2c=${O.k2c} fault="${T.faultTxt}" need=${T.need} cat=${T.cat} log0="${T.log[0] ? T.log[0].res : ""}"`); };
    sc("estop", () => { act.es("tp"); });
    sc("estop+run-out", () => { act.es("tp"); tick(5); });
    sc("estop reset while pressed", () => { act.es("tp"); tick(5); reset(); });
    sc("estop release+reset", () => { act.es("tp"); tick(5); act.es("tp"); reset(); });
    sc("gate locked", () => { act.gate(); });
    sc("request entry", () => { act.req(); tick(0.01); });
    sc("request entry+stop", () => { act.req(); tick(5); act.gate(); });
    sc("cross", () => { act.fault("cross"); });
    sc("cross reset", () => { act.fault("cross"); reset(); });
    sc("cross repaired reset", () => { act.fault("cross"); act.fault("cross"); reset(); });
    sc("weld+estop", () => { T.fault.weld = true; act.es("cab"); tick(0.2); tick(0.2); });
    sc("weld reset", () => { T.fault.weld = true; act.es("cab"); tick(0.5); act.es("cab"); reset(); });
    sc("stuck gate", () => { T.fault.gateStuck = true; T.unlock = true; act.gate(); });
    sc("T1 enabling released", () => { act.mode("T1"); act.en(1); reset(); act.en(0); });
    sc("T1 gate open + enabling", () => { act.mode("T1"); act.en(1); T.unlock = true; act.gate(); reset(); });
    sc("panic", () => { act.mode("T1"); act.en(1); reset(); act.en(2); });
    sc("q1 off", () => { act.q1(); });
    restore();
    out(`xrefs: ${[...REG.entries()].map(([k, v]) => k + "=" + v.map((e) => e.p + "." + e.c).join(",")).join(" ")}`);
    out(`errors=${errs.length ? errs.join(" | ") : "none"}`);
    out("DONE");
    render(true);
  }
  return { show, hide() { /* loop stops itself when hidden */ sheet.classList.add("ck-paused"); }, T, calc: () => K };
}

/* ------------------------------------------------------------------ lazy build on the first show of item 3 */
const box = $("rbItem3");
let UI = null, tried = false;
function onShow(n) {
  if (!box) return;
  if (String(n) !== "3") { if (UI) UI.hide(); return; }
  if (!tried) { tried = true; try { UI = build(box); } catch (e) { console.error(e); box.innerHTML = `<div class="card"><p class="rc-bad">Item 3 could not start: ${esc(e.message)}</p></div>`; } }
  if (UI) UI.show();
}
window.addEventListener("rbitemshow", (e) => onShow(e.detail));
const prevTab = window.onTabShown;
window.onTabShown = (name) => { if (prevTab) prevTab(name); if (name === "robot" && box && !box.hidden && UI) UI.show(); };
if (box && !box.hidden) onShow("3");
window.rbCkt = { ui: () => UI };
