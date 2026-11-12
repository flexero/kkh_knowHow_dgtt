/* ROBOT tab, item 1 – data for the card "Real components + drawings – catalogue examples" (robotref.js).
 * Copied from the buy lists of docs/21_industrial_robot.md (chapter 24) and docs/22_robot_math_dynamics.md (§17.10, §18.5, §19.4).
 * Makers and models are real catalogue EXAMPLES – not a recommendation. Data and prices change: ask the supplier for the current datasheet and a quote.
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]
 */

export const NOTE = "Examples from public catalogues – models and data change; ask the supplier for the current datasheet and a quote.";

export const DRAWINGS = [
  { f: "21_robot_structure.svg", t: "6-axis robot – structure and dimensions", c: "Side view of an IRB 2600 class robot: base, column, J2 motor + RV reducer, balancer, arms, wrist, ISO 9409-1 flange; h1 a1 a2 a3 d4 d6; parts list and axis data.", g: "guide 21 §3.1" },
  { f: "21_drive_train_joint.svg", t: "Drive train of one joint (J2)", c: "Section: encoder → brake → servo motor → input pinion → RV reducer (i = 121) → main bearings → arm; ratio, motor torque, stiffness and bearing tilt.", g: "guide 21 §4" },
  { f: "21_rv_vs_harmonic.svg", t: "Reducer principles", c: "RV (cycloidal), strain-wave (harmonic drive) and planetary gear: how they work, ratio formulas, comparison table.", g: "guide 21 §4.1.2" },
  { f: "21_payload_diagram.svg", t: "Load diagram Z–L", c: "Allowed mass vs. centre of gravity (generic 20 kg class), the 13 kg example point and why the wrist inertia is the real limit.", g: "guide 21 §8.2–8.4" },
  { f: "21_gripper_design.svg", t: "2-finger gripper with V-jaws", c: "Jaw force, friction, form fit under the collar, section A–A of the V-jaws, pneumatic force, parts list.", g: "guide 21 §13.2" },
  { f: "21_cell_layout.svg", t: "Machine-tending cell – plan", c: "Fence, sliding gate, light curtains, restricted space, safety distance S = 816 mm (ISO 13855), catalogue safety parts.", g: "guide 21 §17.5, §18.1" },
  { f: "21_signal_handshake.svg", t: "Robot ↔ CNC handshake timing", c: "I/O timing for unload + load: door, clamp, part seated, robot outside, cycle start – with waits and timeouts.", g: "guide 21 §19" },
  { f: "22_frames_dh.svg", t: "Joint frames + DH table", c: "Frames x_i, z_i on the IRB 2600 at q = 0 and the standard DH table; meaning of a, α, d, θ.", g: "guide 22 §5.4" },
  { f: "22_ik_geometry.svg", t: "Inverse kinematics geometry", c: "Wrist centre, J1 from the top view, J2/J3 from the law-of-cosines triangle, elbow up / down.", g: "guide 22 §7" },
  { f: "22_trapezoid_scurve.svg", t: "Speed profiles", c: "Trapezoid (0.682 s), triangle (0.518 s) and S-curve (0.732 s) – speed and acceleration over time.", g: "guide 22 §10" },
  { f: "22_two_link_lagrange.svg", t: "2-link arm – Lagrange", c: "Equation of motion τ = M·q̈ + C·q̇ + G with the worked example and the share of each term.", g: "guide 22 §13" },
  { f: "22_j2_sizing_flow.svg", t: "J2 drive sizing flow", c: "From the cycle to the chosen motor (Yaskawa SGM7A-20A) and reducer (Nabtesco RV-60N), with formulas.", g: "guide 22 §17.6" },
];

export const COLS = ["Item", "Required spec", "Example maker + model", "Key data", "Price class (estimate – ask for a quote)", "Check in the datasheet"];

export const GROUPS = [
  { id: "robot", t: "Robots", src: "guide 21 §24.1", rows: [
    ["Robot 20 – 25 kg class (Option A)", "payload ≥ 13 kg, wrist inertia ≥ 1.0 kg·m² at the gripper CoG; reach ≥ 1.4 m; IP67; floor mount", "ABB IRB 2600-20/1.65", "20 kg, 1.65 m, RP 0.04 mm, IP67 (app data)", "robot + controller ≈ 30 000 – 50 000 €", "load diagram (Z, L), J4/J5/J6 torque and inertia, axis speeds, stopping distances, foundation loads"],
    ["Robot 20 – 25 kg class", "as above", "FANUC M-20iD/25", "25 kg, reach ≈ 1831 mm, RP ±0.02 mm (check)", "same class", "as above; hollow wrist / dress pack"],
    ["Robot 20 – 25 kg class", "as above", "KUKA KR 20 R1810-2", "20 kg, reach ≈ 1813 mm, RP ±0.04 mm (check)", "same class", "as above"],
    ["Robot 20 – 25 kg class", "as above", "Yaskawa Motoman GP25", "25 kg, reach ≈ 1730 mm, RP ±0.02 mm (check)", "same class", "as above"],
    ["Robot 50 – 60 kg class (Option C, double gripper)", "payload ≥ 26 kg + inertia of 2 parts; reach ≥ 1.8 m", "ABB IRB 4600-60/2.05", "60 kg, 2.05 m, RP 0.06 mm (app data)", "≈ 45 000 – 75 000 €", "as above"],
    ["Robot 50 – 60 kg class", "as above", "FANUC M-710iC/50", "50 kg, see datasheet", "same class", "as above"],
    ["Robot 50 – 60 kg class", "as above", "KUKA KR 60 series (KR QUANTEC / KR 60-3 family)", "see datasheet", "same class", "as above"],
    ["Linear track (7th axis, 1 robot for 2 machines)", "stroke = machine distance + 1 m; repeatability ≤ ±0.1 mm", "ABB IRBT, KUKA KL, FANUC / partners, Güdel TMF", "see datasheet", "≈ 20 000 – 60 000 €", "load of the robot (E-stop!), speed, cable chain"],
  ] },
  { id: "ctrl", t: "Controller options + software", src: "guide 21 §24.2, guide 22 §19.4", rows: [
    ["Safe zones / safe speed", "PL d, Cat. 3; limit robot space at the machine door and fence", "ABB SafeMove · KUKA SafeOperation · FANUC DCS", "certified safety function in the robot controller", "≈ 3 000 – 8 000 €", "functions included (zones, tool orientation, standstill), safety bus (PROFIsafe / CIP Safety)"],
    ["Fieldbus", "PROFINET or EtherNet/IP to the cell PLC", "maker options (PROFINET device / controller, EtherNet/IP)", "–", "≈ 1 000 – 3 000 €", "device or controller role, number of I/O bytes"],
    ["Collision detection", "protects robot + gripper", "ABB Collision Detection · FANUC Collision Guard · KUKA collision detection", "software", "often included / small option", "sensitivity setting with load data"],
    ["Offline programming / simulation", "reach, cycle time, collision check before buying", "ABB RobotStudio · FANUC ROBOGUIDE · KUKA.Sim · Yaskawa MotoSim · RoboDK", "virtual controller of the same maker = realistic cycle times", "≈ 2 000 – 8 000 € per licence", "real controller kernel? export to the real robot? offline licence (dongle / file)?"],
    ["Load check tool", "wrist load (guide 21 §8.4)", "ABB RobotLoad · KUKA.Load · FANUC payload check in ROBOGUIDE", "gives the allowed acceleration for your load", "free / included", "–"],
    ["Kinematics / dynamics library", "FK, IK, Jacobian, RNEA for own software", "Robotics Toolbox for Python (P. Corke) · Pinocchio · Orocos KDL", "open source, runs offline", "free", "install wheels offline on the factory PC"],
    ["Engineering math tool", "rigidBodyTree, inverseKinematics, inverseDynamics", "MATLAB + Robotics System Toolbox", "node-locked licence works offline", "≈ 3 000 – 6 000 € per seat", "licence type"],
  ] },
  { id: "red", t: "Reducers + bearings", src: "guide 21 §24.3, guide 22 §17.10", rows: [
    ["Cycloidal (RV) reducer", "T_m ≤ rated, peaks ≤ acceleration torque, life ≥ 30 000 h, lost motion ≤ 1 arcmin", "Nabtesco RV-N (RV-42N / 60N / 80N / 100N); also RV-E, RV-C hollow", "412 / 600 / 784 / 1000 N·m at 15 rpm; ≤ 1 arcmin", "≈ 1 500 – 8 000 €", "rated torque at 15 rpm, momentary max, tilting moment of the main bearing, torsional rigidity, ratio list"],
    ["Cycloidal reducer", "as above", "Sumitomo Fine Cyclo", "≤ 1 arcmin class – see datasheet", "≈ 1 500 – 4 000 €", "as above"],
    ["Strain-wave gear", "zero backlash, small size, ratio 50 – 160", "Harmonic Drive CSG / SHG (sizes 14 – 65)", "ratios 50, 80, 100, 120, 160; lost motion < 1 arcmin class", "≈ 500 – 3 000 €", "rated / peak torque, K1/K2/K3 stiffness, life L10, lubrication"],
    ["Precision planetary gearbox", "track or gantry with rack and pinion; backlash ≤ 3 arcmin", "WITTENSTEIN alpha SP+ / TP+ · Neugart PLE / PLFE / PSFN", "1:3 – 1:100; ≤ 1 … 3 arcmin", "≈ 400 – 3 000 €", "backlash class, max acceleration torque, radial load on the output"],
    ["Crossed roller bearing", "moment load of a rotary table / own axis", "THK RU / RB series · IKO CRBH", "see datasheet", "≈ 200 – 2 000 €", "moment load capacity, preload, mounting tolerances"],
  ] },
  { id: "motor", t: "Servo motors + drives", src: "guide 22 §17.10, guide 21 §24.3", rows: [
    ["Servo motor, low inertia 3000 rpm (J2 example)", "rated ≥ 5.4 N·m, peak ≥ 10.8 N·m, ≥ 2680 rpm, brake ≥ 5.2 N·m, abs. multi-turn encoder", "Yaskawa Σ-7 SGM7A-20A (2.0 kW)", "rated 6.37 N·m (= P/ω), peak ≈ 3× (see datasheet)", "≈ 800 – 1 500 €", "peak torque, rotor inertia J_m with brake, k_T, then redo the sizing (guide 22 §17.6)"],
    ["Servo motor, medium inertia 1500 rpm", "as above", "Yaskawa Σ-7 SGM7G-13A (1.3 kW)", "rated 8.28 N·m (= P/ω)", "≈ 900 – 1 600 €", "as above"],
    ["Servo motor, low inertia 3000 rpm", "as above", "Panasonic MINAS A6 MSMF202 (2.0 kW)", "rated 6.37 N·m, peak ≈ 3×", "≈ 600 – 1 200 €", "as above"],
    ["Servo motor + drive (own axes)", "peak / RMS torque from guide 22", "Siemens SIMOTICS S-1FK7 / 1FT7 + SINAMICS S120 / S210", "see datasheet (M₀)", "≈ 1 000 – 3 500 €", "rated / peak torque, inertia, brake holding torque, encoder type"],
    ["Servo motor + drive (EtherCAT)", "as above", "Beckhoff AM8000 (one-cable) + AX5000 / AX8000", "see datasheet", "≈ 800 – 2 000 €", "as above"],
    ["Servo motor + drive", "as above", "Bosch Rexroth MS2N + ctrlX DRIVE", "see datasheet", "≈ 1 000 – 4 000 € per axis", "as above"],
  ] },
  { id: "enc", t: "Encoders + brakes", src: "guide 22 §17.10, guide 21 §4.4–4.5", rows: [
    ["Absolute multi-turn motor encoder", "absolute, multi-turn, digital interface", "HEIDENHAIN EQN 1300 / ECN 1100 with EnDat 2.2", "single-turn 19 – 25 bit class, multi-turn 12 bit (4096 rev)", "with the motor", "functional-safety version, interface to the drive"],
    ["Absolute encoder (servo makers)", "as above", "Tamagawa SmartAbs", "17 – 23 bit class, battery-backed multi-turn", "with the motor", "battery type and change interval"],
    ["Integral motor holding brake", "brake ≥ 1.5 – 2 × gravity torque at the motor", "option of the servo motor (24 V DC, spring-applied)", "holding torque ≈ rated torque – see datasheet", "option", "holding torque, release time; it is not a service brake"],
    ["Separate safety brake", "own axes, e.g. vertical gantry Z", "mayr ROBA-servostop · Kendrion permanent-magnet brakes", "see datasheet", "ask", "braking torque, number of emergency stops, brake test"],
  ] },
  { id: "grip", t: "Grippers + tool changers", src: "guide 21 §24.4", rows: [
    ["Pneumatic 2-jaw parallel gripper", "jaw force ≥ 1400 N with V-jaws at μ = 0.1 (≥ 1981 N flat jaws); stroke ≥ tolerance + 2 – 5 mm per jaw; IP for coolant", "SCHUNK PGN-plus-P · Zimmer GPP5000", "parts up to ≈ 30 kg – force and stroke see datasheet", "≈ 1 000 – 3 000 €", "force at YOUR finger length, per jaw or sum, jaw moments Mx/My/Mz, mass, spring-assisted version"],
    ["Pneumatic 3-jaw centric gripper", "round housings – centring", "SCHUNK PZN-plus · Zimmer GPD5000", "see datasheet", "≈ 1 200 – 3 500 €", "as above"],
    ["Electric (servo) gripper", "variable stroke, part check by position", "SCHUNK EGK / EGU · Zimmer GEP2000 / GEH6000", "see datasheet", "≈ 2 000 – 5 000 €", "force, IO-Link / fieldbus, holding on power loss"],
    ["Double gripper plate / swivel", "2 grippers at 90° or 180°; inside the 60 kg class load diagram", "in-house adapter or gripper makers' rotary modules", "–", "≈ 1 000 – 4 000 €", "mass, inertia, stiffness"],
    ["Compliance / float unit", "lateral float ≥ chamfer error", "SCHUNK AGE · ATI compliance devices", "see datasheet", "≈ 500 – 2 000 €", "lateral / angular play, locking for fast moves"],
    ["Collision protection", "protect gripper and robot at a crash", "ATI collision sensors · SCHUNK OPR", "see datasheet", "≈ 600 – 2 000 €", "trip force / moment, auto reset, signal to the controller"],
    ["Tool changer", "payload class ≥ gripper + part; air + signals", "ATI QC · SCHUNK SWS · Stäubli MPS", "repeatability ≈ ±0.01 – 0.015 mm, fail-safe lock", "≈ 2 000 – 6 000 € master + 1 000 – 2 500 € per tool plate", "static moment capacity, added height, air / electrical modules"],
    ["Vacuum cups + ejector", "Ø and number from guide 21 §13.4", "Schmalz (cups, SCPi ejectors) · Piab (piCOMPACT, cups)", "see datasheet", "≈ 100 – 1 000 € per circuit", "vacuum level, suction rate, air consumption, oil-resistant cup material"],
    ["Valve terminal for the gripper", "5/2 or 5/3 valves, pressure retention", "Festo VTUG / MPA-L · SMC SY / EX600", "see datasheet", "≈ 500 – 2 000 €", "fieldbus, closed centre or check valves for air loss"],
    ["Jaw and part sensors", "jaw open / closed, part present", "SCHUNK MMS · ifm · Balluff · SICK · Pepperl+Fuchs (M8 / M12, IP67)", "–", "≈ 50 – 300 € each", "switching distance, IP, torsion-proof cable"],
    ["Seating check in the fixture", "air-gap sensing 0.02 – 0.05 mm", "Festo SOPA air gap sensor", "see datasheet", "≈ 500 – 1 500 €", "measuring range, air quality"],
    ["Dress pack (upper arm → tool)", "torsion with J4 / J6, PUR, retraction", "igus triflex R · robot makers' dress packs", "see datasheet", "≈ 1 000 – 4 000 €", "bending radius, retraction system, fill level"],
  ] },
  { id: "safe", t: "Safety parts", src: "guide 21 §24.5", rows: [
    ["Fence system", "height 2000 – 2200 mm; mesh vs. distance (ISO 13857); impact strength", "Axelent X-Guard · Troax mesh panels", "modular panels and posts", "≈ 100 – 200 € per metre", "mesh size, impact test results, floor fixing"],
    ["Gate interlock with guard locking", "PL d / PL e, coded (ISO 14119), escape release", "Euchner MGB2 · Pilz PSENmlock · Schmersal AZM", "see datasheet", "≈ 300 – 1 200 €", "PL / category, locking force, escape release, handle module"],
    ["Light curtain", "resolution 14 or 30 mm; S from ISO 13855", "SICK deTec4", "type 4, PL e, 14 / 30 mm", "≈ 800 – 2 500 €", "response time t1, protective field height, muting"],
    ["Safety laser scanner", "protective field ≥ S (ISO 13855)", "SICK microScan3 · Keyence SZ-V", "PL d, type 3", "≈ 2 000 – 4 500 €", "field range, number of field sets, response time"],
    ["Safety controller", "all cell safety functions PL d", "Pilz PNOZmulti 2 · SICK Flexi Soft · Siemens S7-1500F (PROFIsafe)", "see datasheet", "≈ 600 – 3 000 €", "PL, number of safe I/O, safety bus to the robot"],
    ["E-stop and reset buttons", "ISO 13850, IEC 60947-5-5", "Schneider Harmony XB4/XB5 · Siemens SIRIUS ACT · Eaton RMQ", "–", "≈ 30 – 100 € each", "2 NC contacts, positive opening"],
    ["Air dump / soft-start valve", "lockable, safe exhaust", "Festo MS6-SV · SMC VP / safety exhaust valves", "see datasheet", "≈ 400 – 1 500 €", "PL rating, padlock for lock-out"],
    ["Force / pressure measuring device", "only for collaborative use – ISO/TS 15066 limits", "biomechanical measuring devices (safety test equipment makers)", "–", "rent or buy, ask", "calibration, measuring range"],
  ] },
  { id: "cal", t: "Installation + calibration tools", src: "guide 21 §24.6, guide 22 §18.5", rows: [
    ["Chemical anchors", "tension 5968 N and shear 3607 N per anchor with safety factors (example)", "Hilti HIT-RE 500 V4 or HIT-HY 200 with HAS-U · fischer FIS EM Plus", "see approval (ETA)", "≈ 10 – 30 € per anchor", "resistance in cracked concrete, edge distance, embedment"],
    ["Non-shrink grout", "20 – 50 mm layer under the base plate", "Pagel V1 · Sika SikaGrout · Hilti grout", "see datasheet", "small", "strength, pot life"],
    ["Laser tracker (buy, rent or service)", "robot calibration, absolute accuracy, cell frames", "Leica Absolute Tracker AT960 · FARO Vantage · API Radian", "AT960: MPE ±(15 µm + 6 µm/m) (check)", "≈ 80 000 – 200 000 €; service ≈ 2 000 – 6 000 € per robot", "accuracy, range, 6-DOF probe"],
    ["Laser interferometer", "7th axis track, gantry, machine axes", "Renishaw XL-80", "linear accuracy ±0.5 ppm", "≈ 20 000 – 35 000 €", "options for angle / straightness"],
    ["Ballbar", "circularity test of machine tools; small robot circles", "Renishaw QC20-W", "see datasheet", "≈ 8 000 – 15 000 €", "radius range, software"],
    ["Robot calibration software", "identification of the kinematic errors", "ABB Absolute Accuracy · KUKA absolute accuracy · RoboDK calibration", "–", "see supplier", "needs a tracker? which parameters?"],
    ["Dial indicator + magnetic stand", "backlash check 0.001 mm", "Mitutoyo · Käfer · Mahr", "0.001 mm resolution", "≈ 100 – 400 €", "resolution, range"],
    ["Push-pull gauge", "50 – 100 N for the backlash check", "Sauter · Mecmesin · IMADA", "–", "≈ 100 – 500 €", "range"],
    ["TCP check pin / TCP unit", "4-point method or automatic", "in-house pin; light-barrier TCP units (e.g. LEONI advintec TCP)", "–", "in-house / ≈ 3 000 – 8 000 €", "for welding / spindle tools mainly"],
  ] },
];

/* consolidated shopping list – compressor machine-tending cell, Option A (guide 21 §24.7) */
export const SHOP_COLS = ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (estimate – ask for a quote)"];
export const SHOP = [
  ["1", "1", "6-axis robot 20 – 25 kg, IP67, with controller, pendant, 10 m cables", "13 kg load, J5 inertia ≥ 1.0 kg·m² at gripper CoG, reach ≥ 1.4 m", "ABB IRB 2600-20/1.65 · FANUC M-20iD/25 · KUKA KR 20 R1810-2 · Yaskawa GP25", "30 000 – 50 000 €"],
  ["2", "1", "Safe-zone / safe-speed option", "PL d, Cat. 3", "SafeMove / DCS / SafeOperation", "3 000 – 8 000 €"],
  ["3", "1", "Fieldbus option", "PROFINET (or EtherNet/IP)", "maker option", "1 000 – 3 000 €"],
  ["4", "1", "Offline programming licence", "reach + cycle check", "RobotStudio / ROBOGUIDE / KUKA.Sim / MotoSim", "2 000 – 8 000 €"],
  ["5", "1", "Pneumatic 2-jaw (or 3-jaw) gripper, spring-assisted", "≥ 1400 N per jaw with V-jaws, TCP ≈ 130 mm", "SCHUNK PGN-plus-P / PZN-plus · Zimmer GPP5000 / GPD5000", "1 000 – 3 500 €"],
  ["6", "2 sets", "Gripper fingers (V-jaw, form fit under the flange) + 1 spare set", "hardened steel, POM inserts", "in-house / gripper maker", "500 – 1 500 €"],
  ["7", "1", "Adapter plate ISO 9409-1", "dowel pin + centring", "in-house", "200 – 600 €"],
  ["8", "1", "Compliance / float unit (optional)", "lateral float ≥ 0.5 mm", "SCHUNK AGE · ATI compliance", "500 – 2 000 €"],
  ["9", "1", "Collision protection (optional)", "trip at crash", "ATI collision sensor · SCHUNK OPR", "600 – 2 000 €"],
  ["10", "4", "Jaw / part sensors (2 jaw positions, 1 part present, 1 spare)", "M8 / magnetic, IP67", "SCHUNK MMS · ifm · Balluff", "200 – 1 000 €"],
  ["11", "1", "Valve terminal with pressure retention, fieldbus", "5/3 closed centre or check valves", "Festo VTUG / MPA-L · SMC SY / EX600", "500 – 2 000 €"],
  ["12", "1", "Dress pack upper arm → gripper", "air 2 × Ø8, sensor cables, retraction", "igus triflex R · robot maker", "1 000 – 4 000 €"],
  ["13", "1", "Air-gap seating sensor in the fixture", "0.02 – 0.05 mm", "Festo SOPA", "500 – 1 500 €"],
  ["14", "≈ 11 m", "Fence 2000 – 2200 mm, mesh ≤ 30 × 30 mm (10.4 m from the app layout)", "ISO 14120, ISO 13857", "Axelent X-Guard · Troax", "1 100 – 2 200 €"],
  ["15", "1", "Maintenance gate with guard-locking interlock + escape release", "PL d / e, ISO 14119", "Euchner MGB2 · Pilz PSENmlock · Schmersal AZM", "300 – 1 200 €"],
  ["16", "1 pair", "Light curtain at the operator loading tunnel (if conveyor ends are open)", "30 mm resolution, S = 816 mm (example)", "SICK deTec4", "800 – 2 500 €"],
  ["17", "1", "Safety controller (if not in the CNC / line safety PLC)", "PL d, PROFIsafe to the robot", "Pilz PNOZmulti 2 · SICK Flexi Soft · S7-1500F", "600 – 3 000 €"],
  ["18", "3 + 1", "E-stop buttons (gate, operator panel, conveyor end) + 1 reset button", "2 NC, ISO 13850", "Schneider · Siemens · Eaton", "150 – 400 €"],
  ["19", "1", "Air dump / soft-start valve, lockable", "safe exhaust", "Festo MS6-SV · SMC", "400 – 1 500 €"],
  ["20", "4 (+ 4)", "Chemical anchors M16 – M20 (+ 4 for a sole plate)", "≥ 6.0 kN tension, ≥ 3.6 kN shear per anchor with factors", "Hilti HIT-RE 500 V4 / HAS-U · fischer FIS EM Plus", "100 – 300 €"],
  ["21", "1", "Steel base plate 30 – 40 mm + grout", "flatness ≤ 0.3 – 0.5 mm", "in-house + Pagel V1 / SikaGrout", "500 – 1 500 €"],
  ["22", "2", "Conveyors in / out with centring stop and part-present sensor", "±0.1 mm centring, 200 mm/s", "conveyor makers (belt / roller)", "6 000 – 10 000 € total"],
  ["23", "1 set", "Maintenance tools: dial indicator + stand, push-pull gauge, TCP pin", "guide 21 §21.2, §14.2", "Mitutoyo / Mahr · Sauter / Mecmesin", "300 – 1 000 €"],
  ["24", "1 set", "Spare parts: encoder batteries, dress-pack hoses, gripper seals, fuses, filters, gear oil", "–", "robot maker", "1 000 – 3 000 €"],
  ["25", "–", "Integration: engineering, programming, CNC interface, installation, commissioning, CE", "–", "integrator or own team", "30 000 – 50 000 €"],
];
export const SHOP_NOTE = "Sum of the classes ≈ 120 000 € (same range as the cost example in guide 21 §23.1). Option C (double gripper): replace pos. 1 with a 50 – 60 kg robot (IRB 4600-60/2.05 · FANUC M-710iC/50 · KUKA KR 60 family) and pos. 5 with two grippers on a double-gripper plate.";

/* ==== items 2 + 3 (generated from guides 23 + 24 – gen_data23.py) ==== */
// Same row format as GROUPS above: [item, required spec, example maker + model, key data, price class, check in the datasheet]
export const ITEMS = {
 "2": {
  "guide": "guide 23 – robot control system",
  "drawings": [
   {
    "f": "23_controller_architecture.svg",
    "c": "Controller block diagram: main computer, axis computer, I/O, safety controller, power stage, motors, brakes, encoders (example)",
    "g": "guide 23 §1",
    "t": "Controller architecture"
   },
   {
    "f": "23_bode_example.svg",
    "c": "Bode diagram of the speed loop, rigid and two-mass plant, crossover and phase margin marked",
    "g": "guide 23 §4",
    "t": "Bode diagram – speed loop"
   },
   {
    "f": "23_cascade_block_diagram.svg",
    "c": "Cascade block diagram: position P, speed PI, current loop, two-mass plant, feedforward paths (example values IRB 2600 J1)",
    "g": "guide 23 §5",
    "t": "Cascade control loops"
   },
   {
    "f": "23_two_mass_model.svg",
    "c": "Two-mass model and motor-side frequency response with anti-resonance 20.86 Hz and resonance 27.07 Hz",
    "g": "guide 23 §6",
    "t": "Two-mass model + resonance"
   },
   {
    "f": "23_foc_drive.svg",
    "c": "FOC servo drive block diagram: PI d/q, inverse Park, SVPWM, inverter, motor, encoder, Clarke and Park feedback",
    "g": "guide 23 §9",
    "t": "FOC servo drive"
   },
   {
    "f": "23_safety_functions_timing.svg",
    "c": "Speed-time sketches of STO, SS1, SS2/SOS and SLS",
    "g": "guide 23 §15",
    "t": "Safety functions STO / SS1 / SS2 / SLS"
   },
   {
    "f": "23_stop_categories.svg",
    "c": "Speed of J1 vs time for stop categories 0, 1 and 2, with result table",
    "g": "guide 23 §16",
    "t": "Stop categories 0 / 1 / 2"
   },
   {
    "f": "23_handshake_timing.svg",
    "c": "Timing diagram of the robot-machine handshake, 11 signals over 13.6 s",
    "g": "guide 23 §19",
    "t": "Robot ↔ machine handshake timing"
   }
  ],
  "groups": [
   {
    "id": "g25_1",
    "t": "Robot controllers",
    "src": "guide 23 §25.1",
    "rows": [
     [
      "Robot controller",
      "Drives a 20 kg / 1.65 m robot; 400 V 3-ph supply; PROFINET + PROFIsafe; safe zones; ≥ 16 DI/DO",
      "ABB OmniCore V250XT (current) / IRC5 (previous generation)",
      "OmniCore family C30 / E10 / V250XT / V400XT; FlexPendant; RAPID; SafeMove option",
      "bundled with the robot, €€€€ – estimate, ask for a quote",
      "supply voltage range + kVA, ambient temperature, IP class, fieldbus options, additional-axis capacity"
     ],
     [
      "Robot controller",
      "as above",
      "FANUC R-30iB Plus (A- / B-cabinet, Mate); newer R-50iA",
      "iPendant touch; DCS option; integrated vision options",
      "bundled, €€€€ – estimate, ask for a quote",
      "which cabinet for your robot, fieldbus boards, DCS functions included"
     ],
     [
      "Robot controller",
      "as above",
      "KUKA KR C5 (KR C5 micro for small robots)",
      "smartPAD; KRL; SafeOperation option; PROFINET / EtherNet/IP",
      "bundled, €€€€ – estimate, ask for a quote",
      "power, cabinet dimensions, safety interface (PROFIsafe / X11 hard-wired)"
     ],
     [
      "Robot controller",
      "as above",
      "Yaskawa YRC1000 (YRC1000micro for small robots)",
      "programming pendant; INFORM; FSU (Functional Safety Unit) option",
      "bundled, €€€€ – estimate, ask for a quote",
      "FSU functions, I/O boards, cabinet size"
     ]
    ]
   },
   {
    "id": "g25_2",
    "t": "Robot safety options",
    "src": "guide 23 §25.2",
    "rows": [
     [
      "Robot safety option",
      "Safe zones (tool + arm), safe joint ranges, SLS 250 mm/s, SOS, safe I/O; PL d / Cat 3 (section 14)",
      "ABB SafeMove (OmniCore: SafeMove basic / pro – see datasheet)",
      "cartesian zones, tool speed / orientation supervision, standstill supervision, safe brake test, PROFIsafe",
      "€€ – €€€, estimate, ask for a quote",
      "number of zones, PL/SIL + PFH_D per function, reaction time, which functions need the \"pro\" level"
     ],
     [
      "Robot safety option",
      "as above",
      "FANUC DCS (Dual Check Safety: position/speed check, safe I/O connect)",
      "joint + cartesian position check, speed check, safe I/O",
      "€€ – €€€, estimate",
      "which DCS packages are included, PFH_D, stopping-distance prediction"
     ],
     [
      "Robot safety option",
      "as above",
      "KUKA SafeOperation / SafeRangeMonitoring",
      "cell area, workspaces, safe speed, safe tool",
      "€€ – €€€, estimate",
      "max number of zones, PROFIsafe / CIP Safety, reaction time"
     ],
     [
      "Robot safety option",
      "as above",
      "Yaskawa FSU",
      "axis/tool zones, speed limits, safe I/O",
      "€€ – €€€, estimate",
      "functions, PL/SIL, interface"
     ]
    ]
   },
   {
    "id": "g25_3",
    "t": "Servo drives",
    "src": "guide 23 §25.3",
    "rows": [
     [
      "Servo drive (extra axis)",
      "400 V 3-ph; current loop ≤ 125 µs (62.5 µs preferred); peak ≥ 3 × rated current; STO + SS1 (+ SLS if people work near); PROFINET IRT or EtherCAT; ≥ 20-bit encoder",
      "Siemens SINAMICS S210 with 1FK2 motors",
      "one-cable connection to the motor, PROFINET IRT, Safety Integrated STO / SS1 / SBC (basic), extended functions via the controller",
      "€€ per axis – estimate, ask for a quote",
      "power range, current-loop cycle, which safety functions need a licence, motor list"
     ],
     [
      "Servo drive (extra axis)",
      "multi-axis, modular, extended safety (SLS, SOS, SLP)",
      "Siemens SINAMICS S120 (booksize, CU320-2, DRIVE-CLiQ)",
      "common DC bus for many axes, Safety Integrated extended functions",
      "€€ – €€€ per axis",
      "current-controller cycle (servo default – see datasheet), safety licences, line module with energy recovery (Active Line Module)"
     ],
     [
      "Servo drive (extra axis)",
      "multi-axis on EtherCAT, PC-based control",
      "Beckhoff AX8000 (AX86xx supply + AX81xx/AX82xx axis modules)",
      "EtherCAT, one-cable technology (OCT), integrated TwinSAFE (STO/SS1; extended functions in the safety versions)",
      "€€ per axis",
      "control cycle times (see datasheet), safety version needed, DC-link capacity"
     ],
     [
      "Servo drive (extra axis)",
      "single/dual axis, high dynamics",
      "Yaskawa Sigma-7 SERVOPACK (SGD7S single, SGD7W dual)",
      "MECHATROLINK-III / EtherCAT versions, 24-bit encoder motors (SGM7), frequency response 3.1 kHz (catalogue claim)",
      "€ – €€ per axis",
      "interface version, safety module option (STO standard), successor Sigma-X"
     ],
     [
      "Servo drive (extra axis)",
      "multi-Ethernet, safety on board",
      "Bosch Rexroth IndraDrive (Cs compact, C/M) – newer ctrlX DRIVE",
      "sercos III / PROFINET / EtherNet/IP / EtherCAT, Safety on Board",
      "€€ per axis",
      "firmware for the bus, safety level, motor list (MS2N etc.)"
     ]
    ]
   },
   {
    "id": "g25_4",
    "t": "Safety PLCs and safety relays",
    "src": "guide 23 §25.4",
    "rows": [
     [
      "Safety PLC / safety relay",
      "PL e / SIL 3 logic; PROFIsafe master to robot + machine; ≥ 16 F-DI, ≥ 8 F-DQ; test pulses; response time fits S = K·T + C",
      "Siemens S7-1500F (e.g. CPU 1513F / 1515F) + ET 200SP F-DI 8×24VDC HF, F-DQ 4×24VDC PM",
      "TIA Portal + STEP 7 Safety, PROFIsafe, SIL 3 / PL e certified",
      "€€ – €€€",
      "F-CPU size, safety licence, F-module response times, F_WD_Time"
     ],
     [
      "Safety PLC / safety relay",
      "Small cell, configurable safety relay",
      "Pilz PNOZmulti 2 (base unit PNOZ m B0 / m B1) + expansion modules",
      "PL e / SIL CL 3, configured with PNOZmulti Configurator, fieldbus modules for diagnostics",
      "€ – €€",
      "number of inputs/outputs, fieldbus module (PROFINET), safe link between units"
     ],
     [
      "Safety PLC / safety relay",
      "EtherCAT cell (PC-based)",
      "Beckhoff TwinSAFE: EL6910 (logic), EL1904 (4 safe inputs), EL2904 (4 safe outputs)",
      "FSoE, SIL 3 / PL e, programmed in TwinCAT",
      "€ – €€",
      "logic capacity, FSoE to drives, response time"
     ],
     [
      "Safety PLC / safety relay",
      "Classic hard-wired variant (guide 24 §5)",
      "safety relays (e.g. Pilz PNOZ, Phoenix PSR, Siemens 3SK)",
      "dual channel, monitored reset",
      "€",
      "contacts, PL, stop category 0/1 (delayed)"
     ]
    ]
   },
   {
    "id": "g25_5",
    "t": "Fieldbus I/O",
    "src": "guide 23 §25.5",
    "rows": [
     [
      "Fieldbus I/O",
      "PROFINET RT I/O, 24 V PNP inputs type 1/3, 0.5 A outputs, input filter adjustable",
      "Siemens ET 200SP with IM 155-6 PN ST / HF",
      "modular, 8/16-channel DI/DQ modules, F-modules on the same station",
      "€ – €€",
      "update time, number of modules, shared device (two controllers)"
     ],
     [
      "Fieldbus I/O",
      "EtherCAT I/O",
      "Beckhoff EK1100 coupler + EL1008 (8 DI) / EL2008 (8 DO)",
      "E-bus terminals, distributed clocks",
      "€",
      "supply current of the E-bus, DC support of the terminals"
     ],
     [
      "Fieldbus I/O",
      "PROFINET I/O, other maker",
      "WAGO 750 series coupler (PROFINET version) / Beckhoff EK9300 (PROFINET coupler)",
      "modular I/O",
      "€",
      "conformance class, max cycle"
     ],
     [
      "Fieldbus I/O",
      "Sensors / gripper I/O near the tool",
      "IO-Link master (e.g. Balluff, ifm, Turck, Siemens ET 200SP CM 4×IO-Link)",
      "4–8 ports, PROFINET/EtherCAT",
      "€",
      "port class A/B (B = extra power for valves), IP67 version"
     ],
     [
      "Fieldbus I/O",
      "Machine interlock \"robot out of machine\"",
      "safe outputs on PROFIsafe or potential-free dual-channel contacts",
      "see 25.4",
      "€",
      "PL of the whole function"
     ]
    ]
   },
   {
    "id": "g25_6",
    "t": "Measurement and tuning tools",
    "src": "guide 23 §25.6",
    "rows": [
     [
      "Measurement / tuning tool",
      "Measure 24 V signals, PWM, encoder signals; ≥ 4 channels, ≥ 100 MHz, isolated or with differential probes for drive work",
      "e.g. PicoScope 4444 (differential inputs), Rohde & Schwarz RTB2000, Fluke ScopeMeter 190 series (isolated, handheld)",
      "4 channels, deep memory, FFT",
      "€€ – €€€",
      "isolation rating (CAT III for 400 V), bandwidth, FFT function"
     ],
     [
      "Measurement / tuning tool",
      "Differential voltage probe for DC bus / motor (≥ 1 000 V)",
      "e.g. Testec, PMK, Pico TA-series differential probes",
      "±700–1 400 V class",
      "€",
      "CAT rating, attenuation, bandwidth"
     ],
     [
      "Measurement / tuning tool",
      "Current clamp AC/DC for motor and 24 V currents",
      "e.g. Fluke i30s / i310s class, Chauvin Arnoux",
      "AC/DC, mV/A output to the scope",
      "€",
      "DC capability, bandwidth, range"
     ],
     [
      "Measurement / tuning tool",
      "Vibration at the tool (find f_lock, f_res)",
      "ICP accelerometer (e.g. PCB 352C33, 100 mV/g) + IEPE input DAQ or the scope",
      "0.5 Hz – 10 kHz",
      "€ – €€",
      "sensitivity, mounting (magnet), IEPE supply"
     ],
     [
      "Measurement / tuning tool",
      "Drive tuning software (Bode, trace, auto-tune)",
      "Siemens SINAMICS Startdrive (TIA Portal), Beckhoff TwinCAT Drive Manager 2, Yaskawa SigmaWin+, Rexroth IndraWorks Ds",
      "trace, FFT / frequency response, one-button tuning",
      "free – € (licence: see maker)",
      "runs offline on the service laptop, version vs. drive firmware"
     ],
     [
      "Measurement / tuning tool",
      "Robot PC tools",
      "ABB RobotStudio, FANUC ROBOGUIDE, KUKA WorkVisual / KUKA.Sim, Yaskawa MotoSim",
      "offline programming, backup, safety configuration",
      "€ – €€ per licence",
      "licence type (offline use on a factory PC), version vs. controller"
     ],
     [
      "Measurement / tuning tool",
      "Safety verification",
      "SISTEMA (IFA, free) + makers' libraries",
      "PL calculation ISO 13849-1",
      "free",
      "library versions"
     ],
     [
      "Measurement / tuning tool",
      "Electrical tests",
      "multimeter (e.g. Fluke 87V), insulation tester (e.g. Fluke 1587), loop-impedance tester",
      "IEC 60204-1 §18 tests",
      "€ each",
      "CAT rating, test voltages"
     ],
     [
      "Measurement / tuning tool",
      "Stopping-time measurement",
      "stopping-time meter (from safety-service suppliers) or the robot's own stop-distance log",
      "ms resolution",
      "€€ (or as a service)",
      "accuracy, accepted by your inspection body"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item",
   "Qty",
   "Spec (from the guide)",
   "Example",
   "Price class (estimate – ask for a quote)"
  ],
  "shop": [
   [
    "1",
    "Robot controller with pendant",
    "1",
    "for the chosen robot; 400 V; PROFINET + PROFIsafe",
    "OmniCore V250XT / R-30iB Plus / KR C5 / YRC1000",
    "€€€€ (with robot)"
   ],
   [
    "2",
    "Robot safety option",
    "1",
    "safe zones, SLS, SOS, safe I/O, PL d",
    "SafeMove / DCS / SafeOperation / FSU",
    "€€ – €€€"
   ],
   [
    "3",
    "Fieldbus option in the robot",
    "1",
    "PROFINET device + PROFIsafe F-device",
    "maker option",
    "€ – €€"
   ],
   [
    "4",
    "Brake resistor check / energy option",
    "1",
    "sized for J1–J3 together (guide 24 §2.1)",
    "included or option",
    "€"
   ],
   [
    "5",
    "Safety PLC",
    "1",
    "PL e, PROFIsafe, ≥ 16 F-DI / 8 F-DQ",
    "S7-1500F + ET 200SP F / PNOZmulti 2 / TwinSAFE",
    "€€ – €€€"
   ],
   [
    "6",
    "Fieldbus I/O station(s)",
    "1–2",
    "32 DI / 16 DQ, PROFINET",
    "ET 200SP / EK1100 + terminals",
    "€ – €€"
   ],
   [
    "7",
    "IO-Link master for the gripper",
    "1",
    "4–8 ports, class B",
    "from 25.5",
    "€"
   ],
   [
    "8",
    "E-stop buttons + reset button",
    "3 + 1",
    "2 NC, positive opening, ISO 13850",
    "any certified make",
    "€"
   ],
   [
    "9",
    "Coded gate switch with guard locking",
    "1",
    "PL e, RFID-coded, OSSD outputs",
    "any certified make (ISO 14119)",
    "€"
   ],
   [
    "10",
    "Light curtain (if open loading station)",
    "1",
    "14 mm or 30 mm, S = K·T + C from section 16.4",
    "any type-4 curtain (IEC 61496)",
    "€€"
   ],
   [
    "11",
    "Servo drive for an extra axis (if any)",
    "per axis",
    "400 V, current loop ≤ 125 µs, STO/SS1(/SLS), EtherCAT or PROFINET IRT",
    "S210 / AX8000 / Sigma-7 / IndraDrive",
    "€€ per axis"
   ],
   [
    "12",
    "Network switch (managed, industrial)",
    "1",
    "PROFINET-capable, ring redundancy if needed",
    "any industrial make",
    "€"
   ],
   [
    "13",
    "Oscilloscope + differential probe + current clamp",
    "1 set",
    "section 25.6",
    "from 25.6",
    "€€ – €€€"
   ],
   [
    "14",
    "Accelerometer + DAQ",
    "1",
    "100 mV/g, IEPE",
    "from 25.6",
    "€ – €€"
   ],
   [
    "15",
    "Software: robot PC tool, drive tool, PLC + safety, SISTEMA",
    "1 each",
    "offline use on the factory PC",
    "from 25.6",
    "€ – €€"
   ],
   [
    "16",
    "Stopping-time measurement (device or service)",
    "1",
    "ms resolution",
    "from 25.6",
    "€€"
   ],
   [
    "17",
    "Spare parts",
    "1 set",
    "SMB battery, fan filters, fuses, 1 pendant cable, 1 brake-motor for J2 (ask supplier)",
    "from the robot maker",
    "€€"
   ]
  ],
  "shopTitle": "Consolidated shopping list – robot cell control (one machine-tending cell) – guide 23 §25.7.",
  "shopM": 4,
  "shopP": 5,
  "price": "Price classes (guide 23): € < 1 k€ · €€ 1 – 5 k€ · €€€ 5 – 20 k€ · €€€€ > 20 k€ – estimate, ask for a quote.",
  "shopNote": "Robot controller and safety option are normally bought together with the robot arm (see the item-1 card)."
 },
 "3": {
  "guide": "guide 24 – control circuits",
  "drawings": [
   {
    "f": "24_mains_distribution.svg",
    "c": "Mains supply and power distribution of the cell cabinet: TN-S, main switch -Q1, main fuses -F1, branches, PE bar (example)",
    "g": "guide 24 §4",
    "t": "Mains supply + distribution"
   },
   {
    "f": "24_mcb_trip_curves.svg",
    "c": "Time-current characteristics of MCBs B, C and D (schematic, after IEC 60898-1) with the IRB 2600 fault current (example)",
    "g": "guide 24 §4",
    "t": "MCB trip curves B / C / D"
   },
   {
    "f": "24_servo_power_stage.svg",
    "c": "Servo drive power stage of one axis: rectifier, precharge, DC link, brake chopper, IGBT inverter, motor, holding brake, STO (example)",
    "g": "guide 24 §6",
    "t": "Servo drive power stage"
   },
   {
    "f": "24_24V_supply.svg",
    "c": "24 V DC control supply: PSU, buffer, electronic circuit breakers per branch, 0 V–PE link (example)",
    "g": "guide 24 §7",
    "t": "24 V DC control supply"
   },
   {
    "f": "24_safety_circuit_cat3.svg",
    "c": "Dual-channel safety circuit Category 3 with a safety PLC: e-stops, coded gate switch with guard locking, enabling device, -K1/-K2 with EDM, reset (example)",
    "g": "guide 24 §8",
    "t": "Safety circuit Cat. 3 (safety PLC)"
   },
   {
    "f": "24_safety_relay_variant.svg",
    "c": "Classic e-stop circuit with a safety relay, feedback loop and monitored reset (example)",
    "g": "guide 24 §9",
    "t": "Safety relay variant"
   },
   {
    "f": "24_io_wiring.svg",
    "c": "I/O wiring: PNP and NPN sensors, machine contact, valve with flyback diode, interposing relay, 4–20 mA transmitter (example)",
    "g": "guide 24 §10",
    "t": "I/O wiring (PNP, NPN, valve, 4–20 mA)"
   },
   {
    "f": "24_cabinet_layout.svg",
    "c": "Cabinet layout of the cell cabinet 600 × 1200 × 300 mm: zones, ducts, devices, cable entry (example)",
    "g": "guide 24 §13",
    "t": "Cabinet layout + heat"
   }
  ],
  "groups": [
   {
    "id": "c17_1",
    "t": "Main switch",
    "src": "guide 24 §17.1",
    "rows": [
     [
      "Main switch -Q1",
      "3-pole, ≥ 25 A, AC-23B at 400 V, door-coupling rotary handle red/yellow or black, lockable in OFF (3 padlocks), IEC 60947-3, suitable for isolation",
      "Siemens 3LD2 main / emergency-stop switch (25 A size)",
      "3-pole, rated operational current per size, padlockable handle",
      "€€",
      "I_e at AC-23 400 V; handle colour; door interlock; shaft length for the cabinet depth (300 mm)"
     ],
     [
      "Main switch -Q1",
      "as above",
      "Siemens 3KD switch disconnector (16 A … , with door handle)",
      "larger range, auxiliary contacts available",
      "€€",
      "as above"
     ],
     [
      "Main switch -Q1",
      "as above",
      "ABB OT25F3 (OT series switch disconnector 25 A, 3P) + door handle + shaft",
      "compact, padlockable handle kits",
      "€€",
      "I_e AC-23A / AC-23B at 400 V (see datasheet), handle kit order no."
     ],
     [
      "Main switch -Q1",
      "as above",
      "Schneider Vario / TeSys VCF (e.g. 25 A size), Eaton P1-25",
      "–",
      "€€",
      "as above"
     ]
    ]
   },
   {
    "id": "c17_2",
    "t": "Fuses, MCBs, RCBOs",
    "src": "guide 24 §17.2",
    "rows": [
     [
      "Fuses, MCBs, RCBOs -F1",
      "3-pole fuse holder 10 × 38, gG 16 A, 400 V AC, ≥ 50 kA",
      "Siemens 3NW7 cylindrical fuse holder + 3NW6 gG fuse links; ABB E 93 holder + E9F gG fuses; Mersen / Bussmann 10 × 38 gG",
      "10 × 38 up to 32 A, breaking capacity see datasheet",
      "€ (fuse), €€ (holder)",
      "gG (not aM), voltage 400/500 V, holder with blown-fuse indicator, touch protection"
     ],
     [
      "Fuses, MCBs, RCBOs -F2",
      "MCB C10, 3-pole, I_cn ≥ prospective I_k (6 kA or 10 kA)",
      "Siemens 5SY (5SY6 6 kA / 5SY4 10 kA, 3-pole C10); ABB S200 (S203-C10, S200M 10 kA); Schneider Acti9 iC60 (iC60N C10 3P)",
      "IEC 60898-1 + IEC 60947-2, energy class 3",
      "€ – €€",
      "curve C, I_cn / I_cu at 400 V, let-through I²t (cable check 4.12), auxiliary contact option"
     ],
     [
      "Fuses, MCBs, RCBOs -F3",
      "MCB C6, 1P+N for the PSU",
      "same families (1P+N version)",
      "–",
      "€",
      "PSU inrush within curve C (PSU datasheet)"
     ],
     [
      "Fuses, MCBs, RCBOs -F4",
      "RCBO B10, 30 mA, type A, 1P+N",
      "Siemens 5SU1; ABB DS201; Schneider iDPN N Vigi / iC60 RCBO",
      "IEC 61009",
      "€€",
      "type A (not AC), I_Δn 30 mA, curve B10, width (modules)"
     ]
    ]
   },
   {
    "id": "c17_3",
    "t": "Motor-protective circuit breakers",
    "src": "guide 24 §17.3",
    "rows": [
     [
      "Motor-protective circuit breakers -Q11, -Q12",
      "setting 1.06 A, trip class 10, I_cu ≥ prospective I_k, type-2 coordination with the contactor, auxiliary contact 1 NO + 1 NC",
      "Siemens 3RV2011 (size S00): range 0.9 – 1.25 A (choose the range whose middle holds 1.06 A) + auxiliary switch 3RV2901",
      "ranges differ by maker",
      "€€",
      "range, I_cu at 400 V, coordination table with 3RT2"
     ],
     [
      "Motor-protective circuit breakers -Q11, -Q12",
      "as above",
      "ABB MS132-1.6 (range 1.0 – 1.6 A)",
      "–",
      "€€",
      "I_cs / I_cu, coordination with AF09"
     ],
     [
      "Motor-protective circuit breakers -Q11, -Q12",
      "as above",
      "Eaton PKZM0-1,6 (range 1.0 – 1.6 A)",
      "–",
      "€€",
      "coordination with DILM"
     ],
     [
      "Motor-protective circuit breakers -Q11, -Q12",
      "as above",
      "Schneider GV2ME06 (range 1.0 – 1.6 A)",
      "TeSys Deca",
      "€€",
      "coordination with LC1D"
     ]
    ]
   },
   {
    "id": "c17_4",
    "t": "Contactors",
    "src": "guide 24 §17.4",
    "rows": [
     [
      "Contactors",
      "AC-3 ≥ 4 kW / 9 A at 400 V, coil 24 V DC (≈ 3 W), mirror contact NC (IEC 60947-4-1 Annex F) for -K1/-K2, suppressor module, B10_D for SISTEMA",
      "Siemens 3RT2016 (S00, 4 kW, 24 V DC coil, integrated auxiliary contact 1 NO or 1 NC) + surge suppressor 3RT2916",
      "S00, 45 mm wide",
      "€ – €€",
      "\"mirror contact\" statement, coil power, B10_D / SISTEMA library, suppressor type (diode + Zener for fast release)"
     ],
     [
      "Contactors",
      "as above",
      "ABB AF09 (AF09-30-10 / -01, electronic coil 24–60 V DC version)",
      "wide coil range, low coil power",
      "€€",
      "mirror contact, B10_D"
     ],
     [
      "Contactors",
      "as above",
      "Schneider TeSys Deca LC1D09BL (24 V DC low-consumption coil)",
      "4 kW AC-3",
      "€€",
      "mirror contact (aux block LADN), coil power"
     ],
     [
      "Contactors",
      "as above",
      "Eaton DILM9-10(24VDC) / DILM9-01",
      "4 kW AC-3",
      "€ – €€",
      "mirror contact, B10_D"
     ]
    ]
   },
   {
    "id": "c17_5",
    "t": "Safety controllers",
    "src": "guide 24 §17.5",
    "rows": [
     [
      "Safety controllers",
      "safety PLC: PL e / SIL 3, F-DI 16 with test pulses, F-DQ 10 (PM switching), PROFINET + PROFIsafe to the robot, standard I/O",
      "Siemens SIMATIC S7-1500F (e.g. CPU 1511F / 1513F) + ET 200SP F-DI 8×24 V DC HF (×2) + F-DQ 4×24 V DC/2 A PM HF (×3)",
      "TIA Portal + STEP 7 Safety license",
      "€€€€",
      "PFH_D per module, response time, test-pulse settings, license cost"
     ],
     [
      "Safety controllers",
      "smaller cell",
      "Siemens S7-1200F (CPU 1214FC / 1215FC) + SM 1226 F-DI / F-DQ",
      "PL e / SIL 3",
      "€€€",
      "number of F-I/O, PROFIsafe as F-host"
     ],
     [
      "Safety controllers",
      "without PROFINET-safety need",
      "SICK Flexi Soft FX3-CPU0/1 + FX3-XTIO (8 in / 4 out) + gateway",
      "free Flexi Soft Designer software",
      "€€€",
      "gateway for the robot fieldbus, PFH_D"
     ],
     [
      "Safety controllers",
      "as above",
      "Pilz PNOZmulti 2 (base unit PNOZ m B0 / m B1 + expansion modules)",
      "PNOZmulti Configurator",
      "€€€",
      "as above"
     ],
     [
      "Safety controllers",
      "as above",
      "Siemens 3SK2 (configurable safety relay, Safety ES software)",
      "20 F-DI class",
      "€€€",
      "inputs / outputs count"
     ],
     [
      "Safety controllers",
      "safety relay (page 9 variant): e-stop + gate, 2 channels, cross-fault detection, monitored reset, 3 NO safety contacts",
      "Pilz PNOZ s4 (24 V DC, 3 NO + 1 NC); Siemens 3SK1111 (basic) / 3SK1121 (advanced); Phoenix PSR-… ; Schmersal SRB-E",
      "PL e, Cat 4 (with suitable wiring)",
      "€€",
      "max. PL with your wiring, B10_D of contacts, reset mode (monitored), contact expansion"
     ],
     [
      "Safety controllers",
      "contact expansion",
      "Pilz PNOZ s7, Siemens 3SK1211",
      "force-guided",
      "€€",
      "–"
     ]
    ]
   },
   {
    "id": "c17_6",
    "t": "E-stops, enabling devices, push buttons, lamps",
    "src": "guide 24 §17.6",
    "rows": [
     [
      "E-stops, enabling devices, push buttons, lamps",
      "e-stop Ø 40 mm red mushroom, turn-to-release, yellow legend plate, 2 NC positive opening, self-monitoring contact block, IEC 60947-5-5 / ISO 13850",
      "Schneider Harmony XB4 / XB5 (XB4BS84… family) + NC blocks ZBE102; Siemens SIRIUS ACT 3SU1 e-stop actuator + holder + 2 NC (self-monitoring version); EAO Series 45 / 84",
      "Ø 22 mm mounting hole",
      "€ – €€",
      "B10_D (often 100 000 – see datasheet), positive opening mark ⊖, self-monitoring contact"
     ],
     [
      "E-stops, enabling devices, push buttons, lamps",
      "enclosure for -S3 at the cell door",
      "same makers, 1-hole yellow enclosure",
      "IP66/67",
      "€",
      "IP rating, cable entry"
     ],
     [
      "E-stops, enabling devices, push buttons, lamps",
      "external enabling device (if needed besides the pendant) 3-position, 2 contacts",
      "IDEC HE5B / HE2B; Euchner ZSA / ZSM",
      "IEC 60947-5-8",
      "€€",
      "contacts per channel, panic function, B10_D"
     ],
     [
      "E-stops, enabling devices, push buttons, lamps",
      "reset button blue illuminated 1 NO; request entry white",
      "same families as above (illuminated push button, 24 V LED)",
      "–",
      "€",
      "LED voltage 24 V DC, colour"
     ],
     [
      "E-stops, enabling devices, push buttons, lamps",
      "pilot lights 24 V LED",
      "same families",
      "–",
      "€",
      "–"
     ]
    ]
   },
   {
    "id": "c17_7",
    "t": "Safety door switches with guard locking",
    "src": "guide 24 §17.7",
    "rows": [
     [
      "Safety door switches with guard locking -B1 / -Y10",
      "RFID coded (high coding level), guard locking power to unlock, holding force ≥ 2 000 N (app BOM), 2 OSSD, PL e, lock monitoring, escape release",
      "Euchner MGB system (handle module + locking module, escape release option)",
      "holding force see datasheet (MGB: 2 000 N class)",
      "€€€",
      "F_Zh, coding level, escape release, cable/plug, series connection rules"
     ],
     [
      "Safety door switches with guard locking -B1 / -Y10",
      "as above",
      "Pilz PSENmlock",
      "high holding force (see datasheet)",
      "€€€",
      "F_Zh, PL with series connection"
     ],
     [
      "Safety door switches with guard locking -B1 / -Y10",
      "as above",
      "Schmersal AZM400 (high force) or AZM300 (compact)",
      "see datasheet",
      "€€ – €€€",
      "F_Zh ≥ 2 000 N? (AZM300 may be lower – check)"
     ],
     [
      "Safety door switches with guard locking -B1 / -Y10",
      "as above",
      "Euchner CTM (transponder with guard locking)",
      "compact",
      "€€",
      "F_Zh – check ≥ 2 000 N, else use a stronger type"
     ]
    ]
   },
   {
    "id": "c17_8",
    "t": "24 V power supply, buffer, ECBs",
    "src": "guide 24 §17.8",
    "rows": [
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "24 V, 20 A, 1-phase 100 – 240 V, PFC, η ≥ 92 %, boost ≥ 120 – 150 %, DC-OK contact, SELV/PELV",
      "PULS QS20.241 or CP20.241",
      "480 W class, DIN rail",
      "€€€",
      "derating vs. temperature, boost duration, DC-OK, width"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "as above",
      "Phoenix Contact QUINT4-PS/1AC/24DC/20",
      "SFB technology (high short-term current to trip breakers)",
      "€€€",
      "as above"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "as above",
      "Siemens SITOP PSU6200 / PSU8200 24 V 20 A",
      "–",
      "€€€",
      "as above"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "buffer 24 V 20 A, ≥ 0.5 s at 218 W (109 J)",
      "PULS UB series buffer; Phoenix QUINT-BUFFER/24DC/24DC/20; Siemens SITOP BUF8600",
      "capacitor based",
      "€€€",
      "hold-up time at your load, charging current"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "ECB: 6 channels (2 + 2 + 1 + 2 + 4 + 2 A settings), adjustable, signal contact",
      "Phoenix CBMC E4 24DC/1-10A (4 channels, 1 – 10 A) ×2",
      "–",
      "€€",
      "trip characteristic, capacitive load limit, sequential switch-on"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "as above",
      "Siemens SITOP PSE200U (4 channels, 3 – 12 A or 0.5 – 3 A versions) ×2",
      "–",
      "€€",
      "channel range per version"
     ],
     [
      "24 V power supply, buffer, ECBs -T1, -G2, -F21 … -F26",
      "as above",
      "E-T-A ESX10-T (plug-in, fixed ratings 0.5 – 12 A) ×6 on a socket module; Murrelektronik MICO",
      "–",
      "€€",
      "ratings available, signal contact"
     ]
    ]
   },
   {
    "id": "c17_9",
    "t": "Terminals and accessories",
    "src": "guide 24 §17.9",
    "rows": [
     [
      "Terminals and accessories -X1 … -X5",
      "push-in feed-through 2.5 mm² (24 V I/O), 4 mm² (400 V), PE terminals green-yellow, knife-disconnect terminal for the 0 V–PE link, markers, end plates, jumpers",
      "Phoenix PT 2,5 / PT 4 / PT 2,5-PE (push-in) or UT (screw)",
      "–",
      "€ per piece",
      "cross-section range, rated current/voltage, jumper system"
     ],
     [
      "Terminals and accessories -X1 … -X5",
      "as above",
      "WAGO TOPJOB S 2002 series (2002-1201 grey, 2002-1204 blue, 2002-1207 PE)",
      "–",
      "€",
      "–"
     ],
     [
      "Terminals and accessories -X1 … -X5",
      "as above",
      "Weidmüller A-series (A2C 2.5, A2C 2.5 PE)",
      "–",
      "€",
      "–"
     ],
     [
      "Terminals and accessories -X1 … -X5",
      "wire markers, cable markers",
      "same makers + label printer (e.g. Phoenix THERMOMARK, Weidmüller PrintJet, Brady)",
      "–",
      "€€ – €€€ (printer)",
      "marker size per wire size"
     ]
    ]
   },
   {
    "id": "c17_10",
    "t": "Relays",
    "src": "guide 24 §17.10",
    "rows": [
     [
      "Relays",
      "plug-in relay, coil 24 V DC with diode + LED, 1 CO 6 A, gold-plated contact option for small signals",
      "Phoenix PLC-RSC-24DC/21 (6.2 mm, 1 CO 6 A); Finder 38.51 (1 CO 6 A, 24 V DC)",
      "6.2 mm width",
      "€",
      "contact material (AgNi vs. AgNi + Au), min. switching load"
     ],
     [
      "Relays",
      "force-guided relay 1 NO + 1 NC, 24 V DC, IEC 61810-3",
      "Finder 7S series; ELESTA SIM/SIR; Phoenix PSR relay modules",
      "–",
      "€€",
      "force-guided per IEC 61810-3, B10_D"
     ]
    ]
   },
   {
    "id": "c17_11",
    "t": "Brake resistors",
    "src": "guide 24 §17.11",
    "rows": [
     [
      "Brake resistors",
      "33 Ω ±10 %, ≥ 300 W continuous, pulse ≥ 1 691 J every 10 s (≥ 17 kW for 0.1 s), ≥ 850 V DC, IP20–IP54, thermal switch",
      "Michael Koch braking resistor ranges; Danotherm braking resistors; Siemens SINAMICS braking resistors (drive-matched); Cressall, Frizlen",
      "wire-wound / steel-grid / aluminium-housed",
      "€€ – €€€",
      "pulse-load diagram, R tolerance, max. voltage, thermal switch rating, surface temperature, mounting distance"
     ]
    ]
   },
   {
    "id": "c17_12",
    "t": "Cabinets, cooling, cables",
    "src": "guide 24 §17.12",
    "rows": [
     [
      "Cabinets, cooling, cables",
      "wall cabinet 600 × 1200 × 300 mm, sheet steel, IP54+, galvanised mounting plate, gland plate",
      "Rittal AE compact enclosure (600 × 1200 × 300 size); Eldon, Schneider Spacial S3D",
      "–",
      "€€€",
      "IP / IK rating, door hinge side, mounting plate usable area"
     ],
     [
      "Cabinets, cooling, cables",
      "floor-standing option (bigger cells)",
      "Rittal VX25 (e.g. 800 × 2000 × 600)",
      "baying system",
      "€€€ – €€€€",
      "–"
     ],
     [
      "Cabinets, cooling, cables",
      "filter fan ≥ 22 m³/h with filter (55 m³/h free-blowing class) + outlet filter + thermostat 35 °C",
      "Rittal TopTherm filter fan (55 m³/h class – confirm flow with filter in the datasheet); Pfannenberg PF series filter fan; thermostat Rittal SK 3110 class / Pfannenberg FLZ",
      "–",
      "€€",
      "flow with filter, IP with filter mat, voltage 230 V"
     ],
     [
      "Cabinets, cooling, cables",
      "cooling unit ≥ 193 W (0.3 kW class) if the hall reaches 45 °C",
      "Rittal Blue e+ / TopTherm cooling unit (0.3 kW class); Pfannenberg DTS series",
      "–",
      "€€€",
      "cooling capacity at L35/L35 and at your hall temperature (e.g. L35/L45), condensate drain"
     ],
     [
      "Cabinets, cooling, cables",
      "supply cable 5G2.5 (40 m), robot feed 5G1.5 (10 m), motor 4G1.5 (25 m)",
      "Lapp ÖLFLEX CLASSIC 110 (PVC control/power cable), ÖLFLEX CLASSIC 110 CY (shielded); Helukabel JZ-500; NYY-J / H07RN-F for fixed / robust laying",
      "–",
      "€ per m",
      "cross-section, voltage 0.6/1 kV or 300/500 V, oil / UV resistance"
     ],
     [
      "Cabinets, cooling, cables",
      "shielded motor cable for VFD / servo (own drives)",
      "Lapp ÖLFLEX SERVO / VFD; Helukabel TOPFLEX-EMV; igus chainflex servo cables (drag chain)",
      "–",
      "€€ per m",
      "shield coverage, capacitance per m, bend radius, chain approval"
     ],
     [
      "Cabinets, cooling, cables",
      "drag-chain control / bus cables",
      "igus chainflex (control, PROFINET types); Lapp ÖLFLEX FD / ETHERLINE FD",
      "–",
      "€ – €€ per m",
      "cycles guaranteed, bend radius"
     ],
     [
      "Cabinets, cooling, cables",
      "PROFINET cable",
      "Siemens 6XV1840-2AH10 (FC Standard Cable GP 2×2); Lapp ETHERLINE PN Cat.5e; Helukabel PROFInet type A/B/C",
      "green, 4-core",
      "€ per m",
      "type A/B/C, fast-connect compatibility"
     ]
    ]
   },
   {
    "id": "c17_13",
    "t": "Test instruments",
    "src": "guide 24 §17.13",
    "rows": [
     [
      "Test instruments",
      "installation tester: continuity ≥ 0.2 A, insulation 250/500/1000 V, loop impedance, RCD (type A/B), IEC 61557",
      "Fluke 1664 FC; Metrel MI 3152 EurotestXC; Gossen Metrawatt PROFITEST MTECH+",
      "–",
      "€€€ – €€€€",
      "RCD type B test, loop resolution 0.01 Ω, memory / report software"
     ],
     [
      "Test instruments",
      "machine tester (IEC 60204-1: 10 A continuity, voltage test, residual voltage)",
      "Metrel MI 3394 CE MultiTesterXA; Gossen Metrawatt PROFITEST PRIME",
      "–",
      "€€€€",
      "test functions for IEC 60204-1 §18"
     ],
     [
      "Test instruments",
      "true-RMS multimeter CAT III 1000 V / CAT IV 600 V",
      "Fluke 87V; Fluke 1587 FC (insulation multimeter)",
      "–",
      "€€ – €€€",
      "CAT rating, LowZ / VFD filter mode"
     ],
     [
      "Test instruments",
      "clamp meter AC/DC + leakage clamp",
      "Fluke 376 FC; Fluke 368 FC (leakage)",
      "–",
      "€€ – €€€",
      "DC range (24 V branches), mA resolution for leakage"
     ],
     [
      "Test instruments",
      "mA loop clamp / calibrator",
      "Fluke 773 / Fluke 789",
      "–",
      "€€€",
      "–"
     ]
    ]
   },
   {
    "id": "c17_14",
    "t": "E-CAD software",
    "src": "guide 24 §17.14",
    "rows": [
     [
      "E-CAD software",
      "professional drawings, parts data, automatic reports",
      "EPLAN Electric P8 (+ Pro Panel for 3D cabinet)",
      "–",
      "€€€€ (license / subscription)",
      "offline license, data portal access"
     ],
     [
      "E-CAD software",
      "alternatives",
      "WSCAD SUITE, Zuken E3.series, AutoCAD Electrical",
      "–",
      "€€€ – €€€€",
      "file exchange with the integrator"
     ],
     [
      "E-CAD software",
      "free, offline, learning and small projects",
      "QElectroTech (open source)",
      "–",
      "free",
      "IEC symbol libraries, export to PDF/DXF"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Tag",
   "Description",
   "Rating (example)",
   "Example product (chapter 17)",
   "Qty"
  ],
  "shop": [
   [
    "1",
    "-Q1",
    "main switch with door handle, lockable",
    "3-pole, 25 A, AC-23",
    "Siemens 3LD2 / ABB OT25F3",
    "1"
   ],
   [
    "2",
    "-F1",
    "fuse holder + fuses",
    "gG 16 A, 10 × 38",
    "Siemens 3NW7 + 3NW6",
    "1 (+ 3 spare fuses)"
   ],
   [
    "3",
    "-F2",
    "MCB robot controller",
    "C10 A, 3-pole, 10 kA",
    "Siemens 5SY4 / ABB S200M / Schneider iC60",
    "1"
   ],
   [
    "4",
    "-F3",
    "MCB 24 V power supply",
    "C6 A, 1P+N",
    "same family",
    "1"
   ],
   [
    "5",
    "-F4",
    "RCBO light + socket + fan",
    "B10 A, 30 mA, type A",
    "Siemens 5SU1 / ABB DS201",
    "1"
   ],
   [
    "6",
    "-Q11, -Q12",
    "motor-protective circuit breaker",
    "1.06 A setting (range around 1.0 – 1.6 A)",
    "Siemens 3RV2011 / ABB MS132 / Eaton PKZM0",
    "2"
   ],
   [
    "7",
    "-K1, -K2",
    "safety contactor",
    "AC-3 4 kW, coil 24 V DC, NC mirror contact",
    "Siemens 3RT2016 / ABB AF09 / Eaton DILM9",
    "2"
   ],
   [
    "8",
    "-K11, -K12",
    "conveyor contactor",
    "AC-3 4 kW, coil 24 V DC + suppressor",
    "same",
    "2"
   ],
   [
    "9",
    "-M11, -M12",
    "conveyor gear motor",
    "0.37 kW, 400 V, IE2",
    "(conveyor supplier)",
    "2"
   ],
   [
    "10",
    "-T1",
    "24 V power supply",
    "24 V DC, 20 A, 1-phase, PFC, DC-OK",
    "PULS QS20.241 / Phoenix QUINT4 20 A / SITOP",
    "1"
   ],
   [
    "11",
    "-G2",
    "buffer module",
    "24 V, 20 A, 0.5 s",
    "PULS UB / QUINT-BUFFER 20 A / SITOP BUF8600",
    "1"
   ],
   [
    "12",
    "-F21 … -F26",
    "electronic circuit breakers",
    "6 channels, 1 – 10 A, signal contact",
    "Phoenix CBMC E4 (×2) / SITOP PSE200U (×2)",
    "1 set (2 modules)"
   ],
   [
    "13",
    "-A2",
    "safety PLC",
    "F-CPU + F-DI 16 + F-DQ 10 (PM) + DI/DO, PROFINET/PROFIsafe",
    "S7-1500F + ET 200SP F-modules",
    "1"
   ],
   [
    "14",
    "-A3",
    "robot I/O board",
    "16 DI / 16 DO 24 V",
    "robot supplier option",
    "1"
   ],
   [
    "15",
    "-A4",
    "analog input",
    "4–20 mA, 2 ch, 16 bit",
    "robot or remote I/O analog module",
    "1"
   ],
   [
    "16",
    "-A5, -A6",
    "remote I/O IP67",
    "16 DI/DO, IO-Link, M12, PROFINET",
    "e.g. Siemens ET 200eco PN / Balluff / Murrelektronik / Phoenix Axioline E",
    "2"
   ],
   [
    "17",
    "-A7",
    "HMI",
    "10 inch, PROFINET",
    "e.g. Siemens TP1000 Comfort / Unified Basic class",
    "1"
   ],
   [
    "18",
    "-A80",
    "managed switch",
    "8 ports, PROFINET CC-B",
    "e.g. Siemens SCALANCE XC208 / Phoenix FL SWITCH",
    "1"
   ],
   [
    "19",
    "-A90",
    "firewall / router",
    "NAT, OPC UA port only",
    "e.g. Siemens SCALANCE S / Phoenix mGuard",
    "1"
   ],
   [
    "20",
    "-S2, -S3",
    "e-stop buttons",
    "2 NC positive opening, self-monitoring",
    "Schneider XB4 / Siemens 3SU1 / EAO 45",
    "2 (+ 1 enclosure for -S3)"
   ],
   [
    "21",
    "-S1, -S4",
    "e-stop + enabling device",
    "in the teach pendant",
    "robot supplier",
    "1"
   ],
   [
    "22",
    "-B1",
    "safety gate switch with guard locking",
    "RFID high coding, 2 OSSD, PL e, ≥ 2 000 N, power to unlock, escape release",
    "Euchner MGB / Pilz PSENmlock / Schmersal AZM400",
    "1"
   ],
   [
    "23",
    "-S5",
    "mode selector",
    "key, 1-of-2 contacts",
    "often on the robot controller",
    "1"
   ],
   [
    "24",
    "-S6, -S7",
    "reset + request entry buttons",
    "1 NO, illuminated blue / white",
    "XB4 / 3SU1",
    "2"
   ],
   [
    "25",
    "-P1, -P11",
    "indicator lamps",
    "24 V LED",
    "XB4 / 3SU1",
    "2"
   ],
   [
    "26",
    "-K5, -K6",
    "relays with force-guided contacts",
    "1 NO + 1 NC, 24 V DC, IEC 61810-3",
    "Finder 7S / Phoenix PSR",
    "2"
   ],
   [
    "27",
    "-K21 … -K23",
    "interposing relays",
    "24 V DC coil + diode + LED, 1 CO 6 A",
    "Phoenix PLC-RSC / Finder 38.51",
    "3"
   ],
   [
    "28",
    "-B11",
    "optical sensor",
    "PNP NO, 10–30 V DC, M12",
    "e.g. SICK / ifm / Balluff / Pepperl+Fuchs diffuse sensor",
    "1"
   ],
   [
    "29",
    "-B12, -B13",
    "cylinder sensors",
    "PNP NO, 3-wire",
    "magnetic slot sensor (cylinder maker)",
    "2"
   ],
   [
    "30",
    "-B15",
    "limit switch",
    "roller lever, 1 NO, IP67",
    "e.g. Schmersal / Euchner / Siemens 3SE5",
    "1"
   ],
   [
    "31",
    "-B16",
    "pressure transmitter",
    "0–10 bar, 4–20 mA, 2-wire, G1/4",
    "e.g. ifm / WIKA / Danfoss",
    "1"
   ],
   [
    "32",
    "-Y11",
    "gripper solenoid valve",
    "24 V DC 2.5 W, plug with LED + suppressor",
    "e.g. Festo / SMC / Bosch Rexroth 5/2 valve",
    "1"
   ],
   [
    "33",
    "-X1 … -X5",
    "terminal strips",
    "push-in 2.5 / 4 mm², PE, knife-disconnect for -X3",
    "Phoenix PT / WAGO TOPJOB S / Weidmüller A",
    "1 set (≈ 80 terminals + 10 % spare)"
   ],
   [
    "34",
    "-W1",
    "supply cable",
    "5G2.5 mm² Cu, 40 m",
    "Lapp ÖLFLEX CLASSIC 110 / NYY-J",
    "40 m"
   ],
   [
    "35",
    "-W2",
    "robot controller feed",
    "5G1.5 mm², 10 m",
    "ÖLFLEX CLASSIC 110",
    "10 m"
   ],
   [
    "36",
    "-W11 …",
    "robot motor + SMB cables",
    "shielded, robot class",
    "robot supplier",
    "1 set"
   ],
   [
    "37",
    "—",
    "PROFINET cables",
    "Cat 5e/6 shielded, green, RJ45 / M12 D",
    "Siemens 6XV1840-2AH10 / Lapp ETHERLINE",
    "1 lot (≈ 80 m + connectors)"
   ],
   [
    "38",
    "—",
    "cabinet",
    "600 × 1200 × 300 mm, IP54, galvanised mounting plate",
    "Rittal AE",
    "1"
   ],
   [
    "39",
    "-E2, -B9",
    "filter fan + outlet filter + thermostat",
    "55 m³/h, thermostat 35 °C",
    "Rittal TopTherm / Pfannenberg PF",
    "1 set"
   ],
   [
    "40",
    "-E1, -S9, -XD1",
    "cabinet light + door switch + socket",
    "LED 230 V, socket 16 A",
    "Rittal / Pfannenberg accessories",
    "1 set"
   ],
   [
    "41",
    "—",
    "EMC accessories",
    "EMC cable glands, shield clamps, PE bar, ducts 60 × 60, DIN rails",
    "e.g. Lapp SKINTOP MS-M BRUSH, Icotek, Rittal",
    "1 lot"
   ],
   [
    "42",
    "(option)",
    "cooling unit instead of fan if hall > 35 °C",
    "≥ 0.3 kW",
    "Rittal Blue e+ / Pfannenberg DTS",
    "0 – 1"
   ],
   [
    "43",
    "(option)",
    "brake resistor for own drives",
    "per chapter 6.4",
    "Michael Koch / Danotherm / Siemens",
    "as needed"
   ],
   [
    "44",
    "(tools)",
    "test instruments",
    "chapter 17.13",
    "Fluke / Metrel / Gossen Metrawatt",
    "1 set (or rent / service company)"
   ]
  ],
  "shopTitle": "Consolidated BOM for the IRB 2600 cell cabinet (same tags and quantities as card D of item 3) – guide 24 chapter 18.",
  "shopM": 4,
  "shopP": -1,
  "price": "Price classes (guide 24, per piece, without installation): € < 50 € · €€ 50 – 300 € · €€€ 300 – 1 500 € · €€€€ > 1 500 € – estimate, ask for a quote.",
  "shopNote": "Spare parts to stock (example): 1 contactor of each type, 1 MPCB, fuses (3 × 16 A gG), 1 interposing relay, 1 ECB module, filter mats (4), 1 PSU (or a 24 V service unit), 1 e-stop contact block, 1 sensor of each type. Buy equivalent parts only after the electrical designer's release."
 }
};
/* ==== end items 2 + 3 ==== */
