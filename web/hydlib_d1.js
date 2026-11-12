/* Hydraulics tab – item 1 "Element data book", data module 1: PUMPS, HYDRAULIC MOTORS, CYLINDERS + ROTARY ACTUATORS.
 * Pure data (schema: see hydlib.js). Every number is an EXAMPLE of a catalogue-class value – check the supplier's current catalogue.
 * Units in the hand formulas: p in bar, Q in L/min, V in cm³/rev, n in rpm, T in N·m, P in kW, A in cm², F in N/kN.
 */
export const ELEMENTS = [
/* =============================================================== PUMPS */
{
  id: "pump_gear_ext", fam: "pump", name: "External gear pump",
  short: "Two meshing spur gears carry oil around the outside in the tooth gaps. Cheap, robust, fixed displacement – the standard pump for small power units and mobile machines.",
  sym: [["pump", {}], ["emotor", {}]], symNote: "Fixed displacement pump, one flow direction, driven by an electric motor",
  draw: "gearExt",
  how: [
    "The drive gear turns the driven gear. On the <b>suction side</b> the teeth come out of mesh – the tooth gaps open and fill with oil. The gaps carry the oil around the <b>outside</b> (between gear and housing) to the pressure side, where the teeth mesh again and push the oil out.",
    "One revolution always moves the same volume: <b>fixed displacement V</b> (cm³/rev). Flow is set by the speed: <code>Q = V · n · η_v / 1000</code>. Pressure is NOT made by the pump – it comes from the load resistance; the relief valve limits it.",
    "Leakage across the gear faces is reduced by <b>pressure-balanced bushings / side plates</b> that are pressed against the gears by the outlet pressure. This is why a gear pump has good volumetric efficiency when new and loses it when the side plates wear."
  ],
  types: [
    ["Aluminium body, group 1 / 2 / 3", "Light, cheap, 1–100 cm³/rev, up to 25–28 MPa. Most HPUs and mobile machines."],
    ["Cast-iron body", "Higher continuous pressure (25–30 MPa), less noise, longer life, heavier."],
    ["Helical / low-noise gear", "Helical or special tooth profile → less flow pulsation, 3–8 dB(A) quieter."],
    ["Tandem / multiple pump", "2–3 gear pumps on one shaft – separate circuits from one motor (e.g. high + low pressure)."],
    ["Reversible / bidirectional", "Works in both rotation directions (needs external drain or special bushings)."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V", "1 – 100 cm³/rev; series 4 6 8 11 14 16 19 23 26 32 40 50"],
    ["Continuous pressure", "16 – 25 MPa (aluminium), up to 28–30 MPa (cast iron)"],
    ["Peak pressure", "20 – 30 MPa (short, < 20 s)"],
    ["Speed", "500 – 3500 rpm (bigger sizes lower max); min ≈ 500–800 rpm"],
    ["Volumetric efficiency η_v", "0.90 – 0.95 (new), drops with wear and thin oil"],
    ["Hydro-mechanical efficiency η_hm", "0.85 – 0.90 → total η_t ≈ 0.80 – 0.85"],
    ["Noise", "65 – 75 dB(A) at 1 m, 1450 rpm, 10 MPa"],
    ["Inlet pressure", "min 0.07–0.08 MPa absolute (≈ −0.2…−0.3 bar g), max 0.3 MPa abs"],
    ["Viscosity", "operating 10 – 300 mm²/s, optimum 20 – 40, cold start ≤ 1000–2000"],
    ["Fluid temperature", "−20 … +80 °C (seals NBR); FKM to +110 °C"],
    ["Cleanliness", "ISO 4406 19/17/14 (≈ 20 µm filtration)"],
    ["Mass", "1 – 8 kg (aluminium group 2 ≈ 2–3 kg)"],
    ["Flow pulsation", "≈ 10 – 20 % (few teeth)"]
  ]},
  sel: {
    f: ["V = Q · 1000 / (n · η_v)        [cm³/rev, Q L/min, n rpm]",
        "Q = V · n · η_v / 1000",
        "P_drive = p · Q / (600 · η_t)      [kW, p bar, Q L/min]",
        "T_drive = V · p / (20 · π · η_hm)  [N·m, V cm³, p bar]"],
    ex: ["Need Q = 18.7 L/min (docs/25 cylinder extend), n = 1450 rpm, η_v = 0.92:",
         "V = 18.7 · 1000 / (1450 · 0.92) = 18 700 / 1334 = 14.0 cm³/rev → choose 14 cm³/rev",
         "Check: Q = 14 · 1450 · 0.92 / 1000 = 18.7 L/min ✓",
         "Power at 78 bar (6.75 MPa needed + losses), η_t 0.85: P = 78 · 18.7 / (600 · 0.85) = 1459 / 510 = 2.86 kW → 3 kW motor",
         "At the relief setting 100 bar: P = 100 · 18.7 / 510 = 3.67 kW (the motor runs above rating while the relief blows – avoid long times there)",
         "Drive torque at 100 bar, η_hm 0.88: T = 14 · 100 / (62.83 · 0.88) = 1400 / 55.3 = 25.3 N·m"]
  },
  calc: "pump",
  mount: [
    "Mount the pump BELOW the oil level (flooded suction) or keep the suction line short and large: v ≤ 0.6–1.2 m/s.",
    "Coupling: flexible jaw coupling in a bell housing (pump adaptor flange) – no radial load on the shaft unless the pump has an outboard bearing.",
    "Check rotation direction (arrow on the housing) before the first start; fill the pump with oil, open the vent.",
    "Suction strainer only if required, ≥ 2 × flow rating, 100–150 µm, with low Δp – a clogged strainer kills the pump by cavitation.",
    "First start: jog, then run without pressure 1–2 min to bleed air."
  ],
  fail: [
    ["Loud whining / rattling noise, foam in tank", "Cavitation (suction blocked, line too small, oil too cold) or air entry at suction fittings", "Check inlet pressure (≥ 0.08 MPa abs), clean strainer, tighten suction joints, warm oil"],
    ["Cylinder slower when oil is hot", "Internal leakage: worn side plates / housing (η_v falls)", "Measure flow at pressure vs new; replace pump when Q < 85–90 % of nominal"],
    ["Shaft seal leaks", "Case / inlet pressure too high, misalignment, radial load", "Align coupling, check inlet pressure ≤ 0.3 MPa abs, no belt drive without bearing"],
    ["Scored housing on suction side", "Gears pushed against housing by too high pressure (bearing wear) or dirt", "Check relief setting, filter, change bearings / pump"],
    ["Pump broken after first start", "Wrong rotation, started dry", "Follow commissioning: fill, vent, check direction"]
  ],
  ask: [
    "Continuous and peak pressure at my speed, and duty cycle limits?",
    "Flow at 0 and at rated pressure (η_v curve) at 46 mm²/s and at 20 mm²/s?",
    "Noise level dB(A) at my pressure and speed (low-noise version available)?",
    "Allowed inlet pressure, radial/axial shaft load, rotation direction?",
    "Shaft end (SAE splined / keyed / tapered) and flange (SAE A / B, ISO 3019-2)?"
  ],
  std: "ISO 3019-2 (flanges, shafts), ISO 4409 (performance test), ISO 4406, ISO 4413"
},
{
  id: "pump_gear_int", fam: "pump", name: "Internal gear pump",
  short: "A small pinion drives a ring gear inside it; a crescent separates suction and pressure. Very quiet and high pressure – used in machine tools, presses and injection moulding.",
  sym: [["pump", {}]], symNote: "Fixed displacement pump (variable-speed drive possible)",
  draw: "gearInt",
  how: [
    "The <b>pinion</b> (outer teeth) drives the <b>ring gear</b> (inner teeth), which sits off-centre. A crescent-shaped filler piece fills the gap between them. The tooth gaps open on the suction side over a long angle, so the oil enters slowly – low noise, good suction.",
    "Radial and axial gap compensation (pressure-loaded segments) keep the leakage low up to 30–35 MPa.",
    "Flow pulsation is only ≈ 2–3 % → the quietest positive displacement pump except the screw pump. Often combined with a <b>variable-speed servo motor</b> (servo pump) for energy saving."
  ],
  types: [
    ["Crescent type, gap compensated", "Standard internal gear pump, 3–250 cm³/rev, to 30–35 MPa."],
    ["Gerotor (no crescent)", "Inner rotor one tooth less than outer rotor; low pressure (lube, charge pumps, ≤ 10 MPa)."],
    ["Servo pump (with variable-speed drive)", "Speed changes flow, 4-quadrant operation, energy saving up to 50–70 % in presses."],
    ["Double pump", "Two internal gear pumps or internal gear + vane on one shaft."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V", "3 – 250 cm³/rev"],
    ["Continuous pressure", "25 – 31.5 MPa (small sizes 35 MPa)"],
    ["Peak pressure", "30 – 35 MPa"],
    ["Speed", "400 – 3000 rpm (servo drive: 0 / 100 – 3000)"],
    ["η_v / η_hm", "0.95 – 0.98 / 0.88 – 0.92 → η_t ≈ 0.85 – 0.90"],
    ["Noise", "55 – 65 dB(A) at 1 m, 1450 rpm, 20 MPa"],
    ["Flow pulsation", "≈ 2 – 3 %"],
    ["Inlet pressure", "min 0.08 MPa abs (−0.2 bar)"],
    ["Viscosity", "10 – 300 mm²/s, cold start ≤ 2000"],
    ["Cleanliness", "ISO 4406 18/16/13 (20/18/15 max)"],
    ["Mass", "5 – 70 kg"]
  ]},
  sel: {
    f: ["V = Q · 1000 / (n · η_v)", "P = p · Q / (600 · η_t)"],
    ex: ["Press: 44 L/min at 250 bar, n = 1450 rpm, η_v 0.95:",
         "V = 44 000 / (1450 · 0.95) = 44 000 / 1377.5 = 31.9 → 32 cm³/rev",
         "Q = 32 · 1450 · 0.95 / 1000 = 44.1 L/min",
         "P = 250 · 44.1 / (600 · 0.87) = 11 025 / 522 = 21.1 kW → 22 kW motor"]
  },
  calc: "pump",
  mount: [
    "Flooded suction preferred; suction line ≥ pump inlet size, v ≤ 1 m/s.",
    "With a servo drive: check minimum speed for lubrication at pressure (holding pressure at low rpm) – ask the supplier.",
    "Low noise needs elastic mounting of the motor-pump group (damping rails) and a hose at the pressure outlet."
  ],
  fail: [
    ["Noise rises after months", "Cavitation or worn crescent / pinion", "Check inlet pressure, oil level, viscosity; inspect pump"],
    ["Pressure cannot be held at low speed (servo pump)", "Internal leakage too large at low rpm", "Raise minimum speed, use smaller pump or holding accumulator"],
    ["Pressure peaks / vibrations", "Fast speed change of servo drive with air in oil", "Tune drive ramps, bleed system"]
  ],
  ask: [
    "Noise level at my operating point; pulsation?",
    "Minimum speed at holding pressure (servo-pump use)?",
    "4-quadrant operation (pump runs backwards as a motor) allowed?",
    "Life (bearing L10) at my pressure profile?"
  ],
  std: "ISO 3019-2, ISO 4409, ISO 4412-1 (noise test)"
},
{
  id: "pump_vane_fix", fam: "pump", name: "Vane pump, fixed displacement",
  short: "Vanes slide in slots of a rotor inside an oval cam ring. Quiet, medium pressure, easy to service (cartridge kit).",
  sym: [["pump", {}]],
  draw: "vane",
  how: [
    "A slotted <b>rotor</b> turns inside a <b>cam ring</b>. Vanes in the slots are pushed out by centrifugal force and pressure under the vanes, so they follow the ring. Between two vanes a chamber grows (suction) and shrinks (pressure).",
    "A <b>double-stroke (balanced)</b> pump has an oval ring: two suction and two pressure zones opposite each other – the radial forces on the shaft cancel → long bearing life.",
    "Wear parts (ring, rotor, vanes, side plates) come as a <b>cartridge kit</b> – a worn pump is repaired in 15 minutes."
  ],
  types: [
    ["Balanced, double-stroke", "Fixed displacement, 5–200 cm³/rev, to 21–28 MPa."],
    ["Double / triple vane pump", "Several cartridges on one shaft (high-low circuits)."],
    ["High-pressure vane (intra-vane)", "Special vane design to 30 MPa."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V", "5 – 200 cm³/rev; series 10 16 20 25 32 40 50 63"],
    ["Continuous pressure", "16 – 21 MPa (special to 28–30 MPa)"],
    ["Speed", "600 – 1800 rpm (min speed needed to throw the vanes out)"],
    ["η_v / η_hm", "0.90 – 0.95 / 0.88 – 0.92"],
    ["Noise", "60 – 70 dB(A) at 1 m"],
    ["Inlet pressure", "min 0.08 MPa abs"],
    ["Viscosity", "13 – 860 mm²/s operating; very sensitive to thin oil at high p"],
    ["Cleanliness", "ISO 4406 18/16/13"],
    ["Mass", "4 – 40 kg"]
  ]},
  sel: {
    f: ["Q = V · n · η_v / 1000", "P = p · Q / (600 · η_t)"],
    ex: ["V = 25 cm³/rev, n = 1450 rpm, η_v = 0.92 → Q = 25 · 1450 · 0.92 / 1000 = 33.4 L/min",
         "p = 140 bar, η_t = 0.85 → P = 140 · 33.4 / 510 = 9.2 kW → 11 kW motor"]
  },
  calc: "pump",
  mount: [
    "Keep above the minimum speed – below it the vanes do not seal (no flow at start in cold oil).",
    "Do not run dry; fill the housing before start.",
    "Check rotation direction – many vane pumps are one-direction only (cartridge can be turned)."
  ],
  fail: [
    ["No flow at start", "Vanes stuck in the slots (dirt, varnish, very cold oil) or wrong rotation", "Warm the oil, check rotation, clean / replace cartridge"],
    ["Chatter marks on cam ring, noise", "Cavitation or dirt", "Check inlet, filter to 18/16/13"],
    ["Flow drops with temperature", "Worn side plates / vane tips", "Replace cartridge kit"]
  ],
  ask: ["Minimum speed and minimum viscosity at my pressure?", "Cartridge kit part number and price?", "Noise at my point?", "Max pressure with water-glycol (HFC)?"],
  std: "ISO 3019-2, ISO 4409"
},
{
  id: "pump_vane_var", fam: "pump", name: "Vane pump, variable (pressure-compensated)",
  short: "Single-stroke vane pump whose cam ring moves to change displacement. It delivers full flow until the set pressure, then only the flow needed – ideal for clamping and holding.",
  sym: [["pump", { var: true, ctrl: "pc", drain: true }]], symNote: "Variable pump with pressure compensator and case drain",
  draw: "vane",
  how: [
    "The cam ring is round and sits <b>off-centre</b> (eccentricity e) to the rotor. Displacement ∝ e. A <b>spring</b> pushes the ring to maximum e; the outlet pressure acts on the ring (directly or through a control piston) against the spring.",
    "When the pressure reaches the set value (e.g. 6 MPa), the ring moves towards the centre: flow falls until it only covers the leakage of the system. The pump <b>holds pressure with almost no flow</b> – the drive power drops to ≈ 10–20 % of full power.",
    "Ideal for <b>machine-tool clamping</b>: long holding times at constant pressure without heating the oil. Response time from max flow to zero ≈ 30–100 ms → a relief valve is still required as safety (set above the compensator)."
  ],
  types: [
    ["Direct-acting compensator (spring on the ring)", "Simple, 2–10 MPa, small sizes; slight pressure drop with flow (2–5 bar)."],
    ["Pilot-operated compensator", "Flatter p–Q curve, up to 16–21 MPa, remote / proportional pressure possible."],
    ["With flow limiter (stroke stop)", "Max flow adjustable with a screw."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V", "8 – 125 cm³/rev"],
    ["Pressure range (compensator)", "1.5 – 10 MPa (direct) / up to 16–21 MPa (pilot)"],
    ["Speed", "1000 – 1800 rpm"],
    ["Response max → zero flow", "30 – 100 ms; zero → max 50 – 150 ms"],
    ["Pressure overshoot at stop", "≈ 1 – 3 MPa above setting (relief needed)"],
    ["η_t", "0.75 – 0.85"],
    ["Drive power at zero flow", "≈ 10 – 20 % of full power (friction + leakage)"],
    ["Noise", "58 – 68 dB(A)"],
    ["Cleanliness", "ISO 4406 18/16/13"],
    ["Case drain", "separate line to tank, below oil level, case pressure ≤ 0.1–0.2 MPa g"]
  ]},
  sel: {
    f: ["Q_max = V · n · η_v / 1000", "Holding power (fixed pump + relief, wrong) = p · Q / 600", "Holding power (compensated) ≈ 0.1…0.2 · full power"],
    ex: ["Clamp circuit 6 MPa, need 26 L/min to close fast: V = 20 cm³/rev, 1450 rpm, η_v 0.9 → Q = 20 · 1450 · 0.9 / 1000 = 26.1 L/min",
         "Fixed pump holding at 60 bar over the relief: P_heat = 60 · 26.1 / 600 = 2.6 kW all the time ✗",
         "Compensated vane pump holding: ≈ 0.3 – 0.5 kW drive power, flow = leakage only ✓"]
  },
  calc: "pump", chart: "pumpPQ",
  mount: [
    "Case drain line: separate, own line to tank, end below the oil level, short, no filter (or very low Δp).",
    "Relief valve set ≈ 1–2 MPa above the compensator (protects against overshoot).",
    "Set the compensator with the circuit dead-headed and a gauge at the pump outlet."
  ],
  fail: [
    ["Pressure hunts / pump 'sings' at holding", "Air in oil or too long pressure line (compensator instability)", "Bleed, use shorter line or small accumulator / damping orifice"],
    ["Oil heats up during holding", "Large internal leakage (worn) or relief set below compensator", "Check settings order (relief > compensator); measure case drain flow"],
    ["Shaft seal blown", "Case drain blocked / too long / filter in drain", "Free drain line, case pressure ≤ 0.1 MPa g"]
  ],
  ask: ["p–Q curve of the compensator; pressure drop between Q_max and zero flow?", "Response time and overshoot?", "Drive power at zero flow and holding pressure?", "Max case pressure; allowed drain line length?"],
  std: "ISO 3019-2, ISO 4409"
},
{
  id: "pump_axial_fix", fam: "pump", name: "Axial piston pump, swash plate, fixed",
  short: "Pistons in a rotating cylinder block run on an inclined plate. High pressure, high efficiency; the fixed version is used as a high-pressure constant pump or as a motor.",
  sym: [["pump", { drain: true }]],
  draw: "axial",
  how: [
    "Pistons (usually 7 or 9) sit in bores of a <b>cylinder block</b> that turns with the shaft. Their <b>slippers</b> slide on a <b>swash plate</b> inclined at angle α. During half a turn each piston moves out (suction through the kidney port of the valve plate), in the other half it moves in (pressure).",
    "Stroke per piston = d_k · tan α (d_k = pitch circle). Displacement <code>V = z · A_k · d_k · tan α</code>. Fixed swash plate = fixed V.",
    "Hydrostatic balance of slippers and valve plate keeps friction low → η_t up to 0.90–0.92. Needs clean oil and a case drain."
  ],
  types: [
    ["Open-circuit fixed pump", "Suction from tank, 10–125 cm³/rev, to 35–40 MPa."],
    ["Through-drive", "Second pump can be mounted behind."],
    ["Fixed motor version", "Same unit works as a motor (see hydraulic motors)."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V", "5 – 250 cm³/rev"],
    ["Continuous / peak pressure", "28 – 35 / 35 – 40 MPa"],
    ["Speed", "500 – 3000 rpm (self-priming limit at the inlet)"],
    ["η_v / η_hm", "0.95 – 0.97 / 0.92 – 0.95 → η_t 0.88 – 0.92"],
    ["Noise", "68 – 78 dB(A)"],
    ["Inlet pressure", "min 0.08 MPa abs (some 0.09)"],
    ["Case pressure", "≤ 0.2 MPa g continuous"],
    ["Cleanliness", "ISO 4406 18/16/13 (17/15/12 for long life)"],
    ["Viscosity", "operating 10 – 400 mm²/s, optimum 16 – 36"],
    ["Mass", "5 – 90 kg"]
  ]},
  sel: {
    f: ["V = z · (π·d²/4) · D_k · tan α", "Q = V · n · η_v / 1000", "P = p · Q / (600 · η_t)"],
    ex: ["V = 28 cm³/rev, 1450 rpm, η_v 0.95: Q = 28 · 1450 · 0.95 / 1000 = 38.6 L/min",
         "250 bar, η_t 0.90: P = 250 · 38.6 / 540 = 17.9 kW → 18.5 kW motor"]
  },
  calc: "pump",
  mount: [
    "Case drain from the HIGHEST drain port so the housing stays full of oil; drain line ends below oil level.",
    "Fill the housing with filtered oil before the first start.",
    "Horizontal mounting preferred; vertical shaft-up needs the special drain port at the top."
  ],
  fail: [
    ["Case drain flow rises", "Wear of valve plate / pistons", "Trend the drain flow (rule: > 3–5 % of rated flow = worn)"],
    ["Slipper failure, metal in filter", "Dirt, cavitation, running without case oil", "Filter 18/16/13, correct inlet, fill case"],
    ["Pressure pulsations, noise", "Cavitation, air", "Inlet line bigger, check oil level / temperature"]
  ],
  ask: ["Max speed at my inlet pressure (self-priming speed)?", "Case drain flow new vs worn limit?", "Bearing life at my load spectrum?", "Allowed fluids (HFC, HEES) and derating?"],
  std: "ISO 3019-2, ISO 4409, ISO 17559 (noise)"
},
{
  id: "pump_axial_var", fam: "pump", name: "Axial piston pump, variable (swash plate)",
  short: "The swash-plate angle is changed by a control piston – the pump gives only the flow (and power) the machine needs. The standard pump for big industrial and mobile systems.",
  sym: [["pump", { var: true, ctrl: "pc", drain: true }], ["pump", { var: true, ctrl: "ls", drain: true }]], symNote: "Variable pump with pressure compensator (left) and with load-sensing control (right)",
  draw: "axial",
  how: [
    "Same rotating group as the fixed pump, but the swash plate is in a <b>cradle</b>. A strong <b>control piston</b> swivels it against a bias spring/piston. α = 0 → no flow; α_max (≈ 15–18°) → full flow.",
    "The <b>controller</b> (a small valve on the pump) decides the angle from pressure, load signal, power or an electrical command (see 'Pump controls').",
    "Compared with a fixed pump + relief, a variable pump avoids most of the heat: at standby the drive power is only the friction and leakage power."
  ],
  types: [
    ["Open circuit, industrial", "18 – 250 cm³/rev, 28/35 MPa; series 18 28 45 71 100 140."],
    ["Closed circuit (over-centre)", "Swash plate tilts both ways → hydrostatic drives (travel, winch); with charge pump."],
    ["Mobile LS pump", "Load-sensing + power limiter; tractors, excavators, cranes."],
    ["Electro-proportional (EP / servo)", "Swash angle set by a current; with swivel-angle sensor."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement V_max", "18 – 500 cm³/rev; series 18 28 45 71 100 140"],
    ["Continuous / peak pressure", "28 – 35 / 35 – 42 MPa"],
    ["Speed (self-priming)", "1500 – 3000 rpm (smaller pumps higher)"],
    ["η_v / η_hm", "0.95 – 0.97 / 0.92 – 0.95"],
    ["Swivel time max → 0 / 0 → max", "≈ 30 – 80 ms / 60 – 150 ms"],
    ["Standby power (zero stroke)", "≈ 5 – 10 % of max power"],
    ["Noise", "65 – 78 dB(A)"],
    ["Case pressure", "≤ 0.2 MPa g (short peaks 0.6)"],
    ["Cleanliness", "ISO 4406 18/16/13 (EP control 17/15/12)"],
    ["Mass", "12 (V 18) – 70 kg (V 140)"]
  ]},
  sel: {
    f: ["V = Q · 1000 / (n · η_v)", "P_max = p · Q / (600 · η_t)", "T = V · p / (20 · π · η_hm)"],
    ex: ["Need 60 L/min at up to 210 bar, 1450 rpm, η_v 0.95: V = 60 000 / (1450 · 0.95) = 60 000 / 1377.5 = 43.6 → V 45",
         "Q_max = 45 · 1450 · 0.95 / 1000 = 62.0 L/min",
         "Full power: P = 210 · 62.0 / (600 · 0.88) = 13 020 / 528 = 24.7 kW → 30 kW motor, OR power limiter set to 18.5 kW (if full flow is only needed at low pressure)",
         "Max torque at 210 bar, η_hm 0.93: T = 45 · 210 / (62.83 · 0.93) = 9450 / 58.4 = 162 N·m"]
  },
  calc: "pump", chart: "pumpPQ",
  mount: [
    "Case drain from the highest port, own line, below oil level; housing filled before start.",
    "Suction line big: v ≤ 1 m/s, inlet ≥ 0.08 MPa abs at max speed; flooded suction is best.",
    "Set: first the relief valve (above compensator), then the compensator, then LS standby, then power limiter – with a gauge at the test point.",
    "Variable pumps need a pressure line volume / hose for stable control (follow the supplier's minimum)."
  ],
  fail: [
    ["Pump does not go back to zero flow, oil gets hot", "Controller spool stuck (dirt), orifice clogged", "Clean controller, check cleanliness 18/16/13"],
    ["Pressure oscillates", "Control unstable: air, too small pressure-line volume, wrong damping orifice", "Bleed, add hose volume, use supplier damping kit"],
    ["Motor overloaded at high pressure", "Power limiter not set / no limiter", "Set power limiter to the motor power (p·Q = const)"],
    ["High case drain flow", "Wear of valve plate, pistons", "Trend, overhaul"]
  ],
  ask: ["Control type and its p–Q curve, response times?", "Standby power at zero stroke and my pressure?", "Through-drive torque for a second pump?", "Swivel-angle sensor / EP control option?", "Noise at my point?"],
  std: "ISO 3019-2, ISO 4409, ISO 17559"
},
{
  id: "pump_ctrl", fam: "pump", name: "Pump controls (compensator, load-sensing, power limiter, EP)",
  short: "The small control valve on a variable pump decides how much flow it gives: limit pressure, follow the load, limit power or follow an electric signal.",
  sym: [["pump", { var: true, ctrl: "pc", drain: true }], ["pump", { var: true, ctrl: "ls", drain: true }], ["pump", { var: true, ctrl: "pow", drain: true }]],
  symNote: "Pressure compensator · load-sensing · power limiter",
  how: [
    "<b>Pressure compensator (DR / PC):</b> the pump gives full flow until p reaches the setting, then it reduces flow so that p stays constant. Good for clamping, accumulators, closed-centre systems.",
    "<b>Load-sensing (LS / DFR):</b> the LS line brings the highest load pressure to the controller. The pump keeps <code>p_pump = p_load + Δp_LS</code> (standby Δp 1.4–3 MPa). The directional valve opening then sets the flow – no relief losses, only Δp_LS · Q is lost.",
    "<b>Power (torque) limiter (LR):</b> keeps <code>p · Q ≈ const</code> (hyperbola). The electric motor is not overloaded at high pressure, but full flow is still possible at low pressure.",
    "<b>Electro-proportional (EP / EO):</b> a proportional solenoid sets the swash angle (flow) or the pressure; with angle sensor and electronics a complete p/Q control ('servo pump control')."
  ],
  types: [
    ["DR / PC – pressure compensator", "Constant pressure, flow on demand."],
    ["DRG / remote", "Pressure set by a remote (pilot) relief valve or proportional valve."],
    ["DFR / LS – load sensing", "Flow follows the valve opening; p = load + Δp_standby."],
    ["LR – power limiter", "Hyperbolic p–Q; combine with DR / LS."],
    ["EP / EO – electro-proportional", "Displacement or pressure from a 4–20 mA / PWM signal; PLC controls everything."],
    ["Torque limit + speed (mobile)", "Anti-stall for diesel engines."]
  ],
  data: { h: ["Control", "Setting range (example)", "Response", "Typical use"], r: [
    ["Pressure compensator", "2 – 35 MPa", "30 – 80 ms", "clamps, presses, accumulator charging"],
    ["Load-sensing", "Δp standby 1.4 – 3 MPa (factory 1.8–2.0)", "50 – 150 ms", "mobile, several actuators at once"],
    ["Power limiter", "start of curve set to motor kW at 1450 rpm", "100 – 200 ms", "big Q at low p and small Q at high p"],
    ["EP (displacement)", "200 – 600 mA (24 V) / 400 – 1200 mA (12 V)", "50 – 150 ms", "speed control from the PLC, energy saving"],
    ["EP p/Q (servo control)", "0 – 35 MPa, 0 – 100 % V", "≈ 50 ms", "injection moulding, presses"]
  ]},
  tables: [{ t: "Energy comparison at a part-load point (example: machine needs 20 L/min at 100 bar, pump max 60 L/min, relief 160 bar)", h: ["Supply", "Loss formula", "Loss (example)"], r: [
    ["Fixed pump + relief", "(p_relief·(Q_pump − Q_need) + Δp_valve·Q_need)/600", "(160·40 + 60·20)/600 = 12.7 kW"],
    ["Pressure compensated (160 bar)", "(160 − 100) · 20 / 600 (throttling in the valve)", "2.0 kW"],
    ["Load-sensing (Δp 20 bar)", "20 · 20 / 600", "0.67 kW"],
    ["EP / servo pump (p and Q exact)", "only pump + motor losses", "≈ 0.3 kW extra"]
  ]}],
  sel: {
    f: ["Pressure compensator: Q = Q_max for p < p_set − ≈ 1 MPa, then Q → leakage at p_set",
        "Load-sensing: p_pump = p_load,max + Δp_LS ; loss = Δp_LS · Q / 600 [kW]",
        "Power limiter: p · Q = P_set · 600 · η_t   [bar · L/min]",
        "Q at pressure p = P_set · 600 · η_t / p"],
    ex: ["Motor 11 kW, η_t 0.88: p · Q = 11 · 600 · 0.88 = 5808 bar·L/min",
         "at 250 bar → Q = 5808 / 250 = 23.2 L/min; at 100 bar → 58.1 L/min (or Q_max if smaller)",
         "LS with Δp 20 bar, Q 40 L/min: loss = 20 · 40 / 600 = 1.33 kW"]
  },
  chart: "pumpPQ",
  mount: [
    "LS line: small (6–8 mm), short, from the shuttle-valve chain of the directional valves; bleed it.",
    "Set the order: relief > compensator > LS standby; power limiter with flow meter + gauge at the hot oil temperature.",
    "EP controls need clean oil (17/15/12) and the electrical ramp settings from the supplier."
  ],
  fail: [
    ["LS pump stays at high pressure", "LS line not vented to tank in neutral (missing LS drain orifice)", "Check LS relief / bleed orifice in the valve block"],
    ["Pump hunts", "Long LS line, air, missing damping", "Shorten, bleed, damping orifice"],
    ["Motor trips at max pressure", "Power limiter set too high or not at all", "Re-set with measurement p · Q"]
  ],
  ask: ["p–Q curves of each control incl. hysteresis?", "Factory settings and adjustment method?", "Electrical data of EP solenoid (current, PWM frequency, dither)?", "Combination possibilities (DR + LS + LR)?"],
  std: "ISO 4409, ISO 1219-1"
},
{
  id: "pump_bent", fam: "pump", name: "Bent-axis piston pump / motor",
  short: "The cylinder block is inclined to the drive shaft; pistons are connected to the shaft flange by ball joints. Very high efficiency and robustness – common as motor and mobile pump.",
  sym: [["pump", { drain: true }], ["motor", { var: true, drain: true }]],
  draw: "bentAxis",
  how: [
    "Drive shaft and cylinder block are at an angle (fixed ≈ 25°–40°). Pistons with ball heads are held in the shaft flange; turning the shaft makes them stroke in the block.",
    "The torque is transmitted directly by the pistons to the flange → low side forces in the bores, high starting torque efficiency (≈ 0.90) – excellent as a <b>motor</b>.",
    "Variable versions swivel the whole block (0–25° or 7–25°) – the standard variable motor for hydrostatic travel drives."
  ],
  types: [
    ["Fixed pump / motor", "5 – 1000 cm³/rev, 40/45 MPa; truck PTO pumps, motors."],
    ["Variable motor", "High-speed motor with two-speed or proportional control (travel drives)."],
    ["Variable pump (rare)", "Open circuit, high pressure."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "5 – 1000 cm³/rev"],
    ["Continuous / peak pressure", "35 – 40 / 40 – 45 MPa"],
    ["Speed", "up to 6000 rpm (small) / 1500 rpm (large)"],
    ["η_v / η_hm", "0.96 – 0.98 / 0.93 – 0.96"],
    ["Starting torque efficiency (motor)", "≈ 0.85 – 0.92"],
    ["Cleanliness", "ISO 4406 18/16/13"],
    ["Mass", "5 – 200 kg"]
  ]},
  sel: {
    f: ["Q = V · n · η_v / 1000", "P = p · Q / (600 · η_t)"],
    ex: ["V = 45 cm³/rev, 1450 rpm, η_v 0.96 → Q = 45 · 1450 · 0.96 / 1000 = 62.6 L/min",
         "300 bar, η_t 0.90 → P = 300 · 62.6 / 540 = 34.8 kW → 37 kW motor"]
  },
  calc: "pump",
  mount: ["Case drain from highest port, case filled; check allowed shaft side load (bearings are strong – belt drive often allowed).", "Truck PTO: check rotation direction of the PTO."],
  fail: [["Noise, metal in oil", "Bearing failure (overload, dirt in oil, side load)", "Overhaul, check radial load and filtration"], ["Drop in speed (motor) under load", "Internal leakage (worn)", "Measure case drain"], ["Shaft seal leak", "Case pressure peaks", "Drain line bigger, shorter"]],
  ask: ["Allowed radial load on the shaft?", "Starting torque efficiency (motor use)?", "Max speed at my pressure?"],
  std: "ISO 3019-2, ISO 4409"
},
{
  id: "pump_radial", fam: "pump", name: "Radial piston pump",
  short: "Pistons arranged like a star, moved by an eccentric. Very high pressure (to 70 MPa) at small flow – for clamping, presses, test benches, tool unclamping.",
  sym: [["pump", {}]],
  draw: "radialPiston",
  how: [
    "An eccentric on the shaft pushes 3–10 radial pistons; each piston has its own <b>suction and pressure check valves</b> (valve-controlled) → no sliding valve plate, so very high pressure is possible.",
    "Flow is small and fairly smooth (odd number of pistons). Insensitive to dirt compared with axial pumps.",
    "Also built as combination pump (radial piston high pressure + gear pump low pressure in one housing)."
  ],
  types: [
    ["Valve-controlled, fixed", "0.4 – 64 cm³/rev, 35 – 70 MPa."],
    ["Combination high/low pressure", "Fast approach with gear stage, high force with piston stage."],
    ["Variable (stroke ring)", "Industrial, 20–35 MPa, larger flow."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "0.4 – 64 cm³/rev"],
    ["Pressure", "35 – 70 MPa continuous (small sizes)"],
    ["Speed", "1000 – 2000 rpm"],
    ["η_v / η_hm", "0.92 – 0.97 / 0.85 – 0.90"],
    ["Noise", "≈ 60 – 70 dB(A)"],
    ["Cleanliness", "ISO 4406 19/17/14"],
    ["Mass", "3 – 30 kg"]
  ]},
  sel: {
    f: ["Q = V · n · η_v / 1000", "P = p · Q / (600 · η_t)"],
    ex: ["V = 2 cm³/rev, 1450 rpm, η_v 0.95 → Q = 2 · 1450 · 0.95 / 1000 = 2.76 L/min",
         "500 bar, η_t 0.85 → P = 500 · 2.76 / 510 = 2.7 kW → 3 kW motor"]
  },
  calc: "pump",
  mount: ["Mostly mounted inside the tank (vertical, submerged) on small HPUs.", "Pressure line rated for 50–70 MPa (hoses 4SH / R15, cone fittings L/S series)."],
  fail: [["Pressure not reached", "Check valve of one piston leaks (dirt)", "Clean / replace valve inserts"], ["Pulsating pressure gauge", "One piston not working", "Inspect pistons / valves"]],
  ask: ["Max pressure continuous vs intermittent?", "Number of pistons, pulsation?", "Submerged mounting kit?"],
  std: "ISO 4409, ISO 4413"
},
{
  id: "pump_screw", fam: "pump", name: "Screw pump",
  short: "Three meshing screws push the oil axially without pulsation – the quietest pump, for lifts (elevators), large machine tools and lube systems.",
  sym: [["pump", {}]],
  draw: "screw",
  how: [
    "A drive screw and two idler screws mesh in a tight housing. The chambers between the threads move <b>axially</b> from suction to outlet like a nut on a turning screw – the volume never changes shape → almost no pulsation.",
    "Very quiet (≈ 55–65 dB(A)), long life, handles larger flows at high speed. Efficiency at low viscosity is lower (leakage along the screws)."
  ],
  types: [["3-screw, industrial", "to 20–30 MPa high-pressure versions; lifts, presses, injection moulding."], ["2-screw (low pressure)", "Lube / transfer pumps, high viscosity."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "10 – 1000 cm³/rev"],
    ["Pressure", "≤ 10 MPa (lube) / up to 20 – 30 MPa (hydraulic versions)"],
    ["Speed", "1000 – 3600 rpm"],
    ["η_v", "0.85 – 0.95 (strongly viscosity dependent)"],
    ["Noise", "55 – 65 dB(A)"],
    ["Pulsation", "< 1 %"],
    ["Viscosity", "min 10 – 20 mm²/s at high pressure"]
  ]},
  sel: { f: ["Q = V · n · η_v / 1000"], ex: ["V = 30 cm³/rev, 2900 rpm, η_v 0.90 → Q = 30 · 2900 · 0.90 / 1000 = 78.3 L/min"] },
  calc: "pump",
  mount: ["Often submerged in the tank (lift units) for low noise.", "Keep viscosity in range – η_v falls quickly with hot thin oil."],
  fail: [["Flow falls when oil hot", "Viscosity too low, wear of screws", "Cooler, oil with higher VI, check wear"], ["Noise", "Cavitation", "Inlet, oil level"]],
  ask: ["η_v versus viscosity curve?", "Noise at my point?", "Max pressure at min viscosity?"],
  std: "ISO 4409"
},
{
  id: "pump_hand", fam: "pump", name: "Hand pump",
  short: "Lever-operated piston pump for emergency lowering, test rigs, small presses and jacks – works without electricity.",
  sym: [["pump", { hand: true }]],
  how: [
    "A lever moves a small plunger; suction and pressure check valves make one-way flow. Single-acting (pumps on one stroke) or double-acting (both strokes). Many have two stages: large plunger for fast approach, small plunger for high pressure.",
    "Built-in relief valve and release (lowering) valve. Used as <b>emergency pump</b> to open brakes, lower a load or release clamps when the power fails."
  ],
  types: [["Single-acting", "Small jacks and tools."], ["Double-acting", "Flow on both strokes, test rigs."], ["Two-stage", "Low-pressure high-volume + high-pressure stage."], ["With tank / without tank (in-line)", "Stand-alone or in a hydraulic system as emergency pump."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement per stroke", "2 – 60 cm³"],
    ["Pressure", "10 – 70 MPa (jack pumps to 70)"],
    ["Hand force", "≤ 300 – 400 N at the lever end"],
    ["Lever ratio", "1 : 10 – 1 : 25"],
    ["Tank (if built in)", "0.5 – 10 L"],
    ["Mass", "2 – 15 kg"]
  ]},
  sel: {
    f: ["F_hand = p · A_plunger / i_lever", "strokes = V_needed / V_stroke"],
    ex: ["Plunger Ø 12 mm → A = 1.131 cm²; p = 400 bar → force on plunger = 40 MPa · 113.1 mm² = 4524 N",
         "Lever 1:15 → F_hand = 4524 / 15 = 302 N ✓ (≤ 300–400 N)",
         "Lift cylinder needs 0.62 L (docs/25), pump 20 cm³/stroke → 620 / 20 = 31 strokes"]
  },
  mount: ["Install with a check valve so the HPU cannot push oil back into the hand pump; integrated release valve to tank.", "Place at a safe position outside the danger zone; label 'emergency'."],
  fail: [["Pressure falls back after pumping", "Leaking pressure check or release valve", "Clean / replace valve seats"], ["Lever moves without resistance", "No oil in tank / suction valve dirty", "Fill, clean"]],
  ask: ["Max pressure of each stage and change-over pressure?", "Stroke volume per stage?", "Integrated relief and release valve?"],
  std: "ISO 4413, EN 1494 (jacks)"
},
/* =============================================================== HYDRAULIC MOTORS */
{
  id: "motor_gear", fam: "motor", name: "Gear motor",
  short: "A gear pump used backwards: oil drives the gears. Cheap motor for fans, conveyors, mixers at medium speed.",
  sym: [["motor", { bidir: true, drain: true }]],
  draw: "gearExt",
  how: [
    "Oil under pressure enters the tooth gaps and pushes on the teeth → torque on the shaft. Same construction as the gear pump, but bushings and seals are made for pressure on both ports (reversible) and usually an <b>external drain</b>.",
    "Torque <code>T = V · Δp · η_hm / (20π)</code>, speed <code>n = Q · 1000 · η_v / V</code>. Poor at low speed (< 300–500 rpm leakage and torque ripple)."
  ],
  types: [["Unidirectional (internal drain)", "Fans, pumps."], ["Bidirectional (external drain)", "Conveyors, winches with gear box."], ["With integrated relief / anti-cavitation", "Fan drives."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "4 – 50 cm³/rev (to 100)"],
    ["Pressure Δp", "16 – 25 MPa continuous"],
    ["Speed", "500 – 4000 rpm"],
    ["η_v / η_hm", "0.90 – 0.95 / 0.85 – 0.90"],
    ["Starting torque", "≈ 75 – 85 % of running torque"],
    ["Mass", "1 – 8 kg"]
  ]},
  sel: {
    f: ["T = V · Δp · η_hm / (20 · π)   [N·m; V cm³/rev; Δp bar]", "n = Q · 1000 · η_v / V", "Q = V · n / (1000 · η_v)"],
    ex: ["V = 11 cm³/rev, Δp = 150 bar, η_hm 0.85: T = 11 · 150 · 0.85 / 62.83 = 1402.5 / 62.83 = 22.3 N·m",
         "Q = 30 L/min, η_v 0.90: n = 30 · 1000 · 0.90 / 11 = 2455 rpm"]
  },
  calc: "motor",
  mount: ["Drain line to tank when reversible / back pressure > 0.5 MPa.", "Do not stop a large inertia by closing the valve – use a brake / anti-cavitation valve."],
  fail: [["Speed drops under load", "Wear, hot thin oil", "Measure drain flow, cooler"], ["Shaft seal leaks", "Return pressure too high without drain", "Add drain line"], ["Motor races / cavitates when stopping", "Inertia drives the motor as pump", "Anti-cavitation checks, brake valve"]],
  ask: ["Max back pressure without drain?", "Starting torque efficiency?", "Min speed for smooth running?"],
  std: "ISO 3019-2, ISO 4392 (motor test)"
},
{
  id: "motor_orbit", fam: "motor", name: "Gerotor / orbit motor (LSHT)",
  short: "Low-speed high-torque motor with an orbiting star (gerotor or roller). Drives wheels, augers, conveyors, winches directly – no gearbox.",
  sym: [["motor", { bidir: true, drain: true }]],
  draw: "orbit",
  how: [
    "A <b>star (rotor)</b> with N teeth orbits inside a <b>ring</b> with N+1 teeth (or rollers). While it orbits once, it turns only 1/N of a revolution → the motor has a <b>large displacement in a small size</b> (built-in gear ratio).",
    "A cardan shaft (dog bone) transmits the rotation of the star to the output shaft. A rotary or disc valve distributes oil to the chambers.",
    "Torque is high at low speed (10–800 rpm), cheap, compact. Efficiency is lower than piston motors and drops at very low speed."
  ],
  types: [["Spool-valve (shaft distribution)", "Small, cheap, 8–40 cm³ … 400 cm³; to 14–20 MPa."], ["Disc-valve", "Higher pressure, better efficiency, large sizes to 800 cm³."], ["Roller (geroler)", "Rollers in the ring → less friction, longer life, better start."], ["Wheel motor / with brake", "Bearing for wheel loads; integrated spring-applied brake."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "8 – 800 cm³/rev (typical 50 – 400)"],
    ["Δp continuous / intermittent", "10 – 20 / 17.5 – 30 MPa"],
    ["Speed", "5 – 800 rpm (larger = slower)"],
    ["Max torque", "100 – 2500 N·m"],
    ["η_v / η_hm", "0.85 – 0.95 / 0.80 – 0.90"],
    ["Max return pressure (no drain)", "≈ 7 – 14 MPa"],
    ["Mass", "5 – 35 kg"]
  ]},
  sel: {
    f: ["T = V · Δp · η_hm / (20 · π)", "n = Q · 1000 · η_v / V"],
    ex: ["V = 200 cm³/rev, Δp 140 bar, η_hm 0.85: T = 200 · 140 · 0.85 / 62.83 = 23 800 / 62.83 = 379 N·m",
         "Q = 40 L/min, η_v 0.90: n = 40 000 · 0.90 / 200 = 180 rpm",
         "Output power: P = T · n / 9550 = 379 · 180 / 9550 = 7.1 kW"]
  },
  calc: "motor",
  mount: ["Use the drain line when the return pressure is high or motors are in series.", "Check allowed side load on the shaft (wheel/sprocket) – heavy-duty bearing versions exist.", "Shaft with key/spline; no hammering."],
  fail: [["Jerky motion at low speed", "Stick-slip, below min speed, air", "Bigger motor at higher speed, roller type, bleed"], ["Shaft seal blown out", "Return pressure too high without drain", "Connect drain"], ["Load creeps down (winch)", "Motor leaks – a motor never holds", "Use brake + brake valve"]],
  ask: ["Max allowed back pressure without drain?", "Min speed for smooth running?", "Shaft side load diagram?", "Integrated brake / valve options?"],
  std: "ISO 4392, SAE J744 (flanges)"
},
{
  id: "motor_vane", fam: "motor", name: "Vane motor",
  short: "Vanes in a rotor, pressed out by springs. Smooth medium-speed motor with low torque ripple – machine tools, mixers, injection screws.",
  sym: [["motor", { bidir: true, drain: true }]],
  draw: "vane",
  how: ["Like the vane pump, but the vanes are pushed out by <b>springs</b> (no centrifugal force at start). Balanced double-stroke design → no radial bearing load.", "Smooth torque, low noise; good for constant medium speed."],
  types: [["Balanced, high speed", "100–3000 rpm."], ["Low-speed high-torque vane", "Large sizes, multi-lobe."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "10 – 300 cm³/rev"], ["Δp", "14 – 21 MPa"], ["Speed", "50 – 3000 rpm"], ["η_v / η_hm", "≈ 0.90 / 0.90"], ["Cleanliness", "ISO 4406 18/16/13"]
  ]},
  sel: { f: ["T = V · Δp · η_hm / (20 · π)"], ex: ["V = 50 cm³/rev, Δp 100 bar, η_hm 0.90: T = 50 · 100 · 0.90 / 62.83 = 71.6 N·m"] },
  calc: "motor",
  mount: ["External drain usually required.", "Keep oil clean – vanes stick with varnish."],
  fail: [["Motor does not start", "Vane springs broken / vanes stuck", "Overhaul"], ["Speed unstable", "Air, worn vanes", "Bleed, cartridge kit"]],
  ask: ["Starting torque?", "Drain requirement?", "Kit availability?"],
  std: "ISO 4392"
},
{
  id: "motor_radial", fam: "motor", name: "Radial piston motor (cam-lobe, LSHT)",
  short: "Pistons with rollers press against a multi-lobe cam ring. Very high torque at very low speed – winches, crushers, wheel drives, shredders, rotary tables.",
  sym: [["motor", { bidir: true, drain: true }]],
  draw: "radialPiston",
  how: [
    "Pistons (8–12) in a rotating block push <b>rollers</b> against a cam ring with 6–10 lobes. Each piston works several times per revolution (multi-stroke) → huge displacement in a compact housing.",
    "Smooth even at 1 rpm, starting torque efficiency ≈ 0.95. Often with two displacements (switchable: full / half) for two speeds.",
    "Shaft or housing can rotate (wheel motors), integrated parking brake and speed sensor available."
  ],
  types: [["Cam-lobe, rotating shaft", "Industrial: 200 – 6000 cm³/rev (series up to 200 000)."], ["Cam-lobe, rotating housing", "Wheel and track drives."], ["Eccentric crankshaft (star type)", "Single-stroke, 5-piston, very robust, 30–10 000 cm³."], ["Two-speed (displacement switch)", "Full / half displacement by a valve."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "200 – 6000 cm³/rev (industrial series)"],
    ["Δp continuous / peak", "25 – 35 / 35 – 45 MPa"],
    ["Speed", "0.5 – 300 rpm (big sizes 0.5 – 100)"],
    ["Torque", "1 – 100 kN·m"],
    ["η_v / η_hm", "0.95 – 0.97 / 0.93 – 0.96"],
    ["Starting torque efficiency", "≈ 0.93 – 0.95"],
    ["Mass", "30 – 1000 kg"],
    ["Boost pressure (return)", "min ≈ 0.3 – 1.5 MPa at high speed (rollers must stay on the cam)"]
  ]},
  sel: {
    f: ["T = V · Δp · η_hm / (20 · π)", "n = Q · 1000 · η_v / V"],
    ex: ["V = 1000 cm³/rev, Δp 200 bar, η_hm 0.95: T = 1000 · 200 · 0.95 / 62.83 = 190 000 / 62.83 = 3024 N·m",
         "Q = 30 L/min, η_v 0.95: n = 30 · 1000 · 0.95 / 1000 = 28.5 rpm"]
  },
  calc: "motor",
  mount: ["Keep the required boost (back) pressure – otherwise the rollers lift off the cam ('hammering').", "Case flushing for continuous high power (cooling).", "Torque arm / spline shaft; housing must take the reaction torque."],
  fail: [["Knocking noise at high speed", "Boost pressure too low, rollers lift off", "Raise return back pressure (check valve 0.5–1.5 MPa)"], ["Case hot", "No flushing at high power", "Add case flushing"], ["Leaks at shaft seal", "Case pressure too high", "Drain line bigger"]],
  ask: ["Min boost pressure vs speed?", "Case flushing flow?", "Two-speed and brake options?", "Allowed external loads on the shaft?"],
  std: "ISO 4392"
},
{
  id: "motor_axial", fam: "motor", name: "Axial piston motor, fixed / variable",
  short: "Swash-plate or bent-axis piston motor: high speed, high efficiency. Variable versions give a wide speed range (travel drives, winches, spindles).",
  sym: [["motor", { bidir: true, drain: true }], ["motor", { var: true, bidir: true, drain: true }]], symNote: "Fixed motor (left), variable motor (right)",
  draw: "axial",
  how: [
    "Same rotating group as the axial piston pump; oil pressure on the pistons pushes the slippers against the inclined plate → torque.",
    "<b>Variable motor:</b> smaller displacement = higher speed and lower torque at the same flow. Motor with α_min ≠ 0 (never zero – speed would go to infinity).",
    "Often combined with a gearbox (planetary) for winches and wheels."
  ],
  types: [["Fixed swash plate", "10 – 250 cm³/rev, 35 MPa."], ["Fixed bent-axis", "Higher start efficiency, high speed."], ["Variable (2-position or proportional)", "Travel drives, winches – automatic high-pressure override."], ["Plug-in motor", "Fits into gearboxes."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Displacement", "10 – 250 cm³/rev (series to 1000)"],
    ["Δp continuous / peak", "35 / 40 – 45 MPa"],
    ["Speed", "50 – 5000 rpm (small sizes up to 8000)"],
    ["η_v / η_hm", "0.95 – 0.97 / 0.92 – 0.95"],
    ["Starting torque efficiency", "0.80 – 0.90 (bent axis higher)"],
    ["Min smooth speed", "≈ 20 – 50 rpm"],
    ["Case pressure", "≤ 0.2 – 0.3 MPa g"],
    ["Mass", "5 – 60 kg"]
  ]},
  sel: {
    f: ["V = 20 · π · T / (Δp · η_hm)   [cm³/rev; T N·m; Δp bar]", "Q = V · n / (1000 · η_v)", "P_out = T · n / 9550   [kW]"],
    ex: ["Winch: T = 150 N·m at 300 rpm, Δp available 200 bar, η_hm 0.93:",
         "V = 62.83 · 150 / (200 · 0.93) = 9425 / 186 = 50.7 → choose 56 cm³/rev",
         "Real torque: T = 56 · 200 · 0.93 / 62.83 = 166 N·m ✓",
         "Flow: Q = 56 · 300 / (1000 · 0.95) = 17.7 L/min",
         "Power: P = 166 · 300 / 9550 = 5.2 kW"]
  },
  calc: "motor",
  mount: ["Case drain from highest port; housing full of oil.", "Flushing valve in closed circuits.", "Anti-cavitation / brake valve when the load can drive the motor."],
  fail: [["Speed drops under load", "Internal leakage / worn", "Measure drain flow"], ["Motor runs away (lowering)", "No brake valve", "Counterbalance / brake valve"], ["Variable motor does not shift", "Control pressure missing, spool stuck", "Check control pressure, clean"]],
  ask: ["Start-up torque efficiency?", "Min speed for smooth running?", "Control options of variable motor?", "Case flushing need?"],
  std: "ISO 3019-2, ISO 4392"
},
{
  id: "motor_brake", fam: "motor", name: "Motor brake (spring-applied, hydraulically released)",
  short: "Multi-disc brake on the motor shaft: springs close it, oil pressure opens it. Holds winches, wheels and slewing drives when the hydraulics are off – a motor alone never holds a load.",
  sym: [["motor", { bidir: true, brake: true, drain: true }]], symNote: "Motor with spring-applied, pressure-released brake (brake line from the brake valve / shuttle)",
  how: [
    "Steel and friction discs alternate on the shaft and in the housing. <b>Springs</b> press them together → static holding torque. A ring piston compresses the springs when <b>release pressure</b> (≈ 1.5–3 MPa) is applied.",
    "It is a <b>parking / holding brake</b> (static): it closes only after the motor stands still. Dynamic braking is done hydraulically by the <b>brake valve / counterbalance valve</b> (see pressure valves).",
    "Release pressure is taken from the working line through a <b>shuttle valve</b> and often a small orifice + check (fast closing, delayed opening) so the brake opens only when pressure has built up."
  ],
  types: [["Integrated in orbit / radial motor", "Compact wheel and winch drives."], ["Separate brake between motor and gearbox", "SAE flange, multi-disc, 50 – 50 000 N·m."], ["Negative brake in planetary gearbox", "Winches, slewing gear, track drives."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Static holding torque", "50 – 50 000 N·m (rule ≥ 1.3 – 1.5 × max load torque)"],
    ["Release start / full release", "≈ 1.0 – 1.5 / 1.8 – 3.0 MPa"],
    ["Max release pressure", "21 – 35 MPa (check!)"],
    ["Release volume", "1 – 20 cm³"],
    ["Closing time", "≈ 0.1 – 0.5 s (with orifice)"],
    ["Emergency braking energy", "limited – only a few stops (see catalogue)"]
  ]},
  sel: {
    f: ["T_brake ≥ S · T_load,max   (S = 1.3 … 1.5; lifting: ≥ 1.5 – 2 per standard)", "T_load = F · r_drum / (i_gear · η_gear)"],
    ex: ["Winch: rope force 5 kN, drum radius 0.15 m, gearbox i = 2, η 0.95 (holding: η helps → use 1.0, conservative):",
         "T_load at motor = 5000 · 0.15 / 2 = 375 N·m",
         "T_brake ≥ 1.5 · 375 = 563 N·m → choose 600 N·m brake",
         "Release line from shuttle valve, full release 2.5 MPa < lowest working pressure ✓"]
  },
  mount: [
    "Brake must release only AFTER the motor has torque (check + orifice, or sequence) and close BEFORE pressure is gone (fast drain to tank).",
    "Brake line drain: tank without back pressure – back pressure keeps the brake partly open (burns the discs).",
    "Combine with a brake/counterbalance valve – the brake alone must not stop a running load (except emergency)."
  ],
  fail: [["Load drops a little at start", "Brake opens before the motor has pressure", "Orifice + check / sequence in brake line"], ["Brake hot, worn discs", "Back pressure in release line, brake used dynamically", "Free drain, use brake valve for dynamic braking"], ["Brake does not release", "Release pressure too low / piston seal leaks", "Measure pressure at brake port, reseal"]],
  ask: ["Static and dynamic holding torque?", "Release pressure start / full / max?", "Allowed number of emergency stops and energy?", "Wear check method?"],
  std: "EN ISO 4413, EN 14492 (winches), ISO 12100"
},
/* =============================================================== CYLINDERS */
{
  id: "cyl_da", fam: "cyl", name: "Double-acting cylinder (differential)",
  short: "Piston with one rod: oil pushes in both directions. Extend force is bigger, retract speed is higher (area ratio φ). The most common actuator.",
  sym: [["cyl", { type: "da" }], ["cyl", { type: "da", cush: true }]], symNote: "Double-acting single-rod cylinder; with adjustable cushions at both ends",
  draw: "cylinder",
  how: [
    "Oil on the <b>piston side</b> (area A = π·D²/4) extends the rod; oil on the <b>rod side</b> (annulus A_r = π·(D²−d²)/4) retracts it. The ratio <code>φ = A / A_r</code> (1.25 / 1.4 / 1.6 / 2) means: retract is φ times faster, extend force φ times bigger at the same p and Q.",
    "Force <code>F = p · A · η_cyl</code> (η_cyl ≈ 0.90 – 0.95 seal friction). Speed <code>v = Q / A</code>.",
    "When retracting, the piston side sends <b>φ × the pump flow</b> back to tank – size the return line and valve for it. If the rod side is throttled (meter-out on extend), pressure is <b>intensified</b>: p_rod = p · φ."
  ],
  types: [["Tie-rod (ISO 6020-2)", "16 MPa, standard industrial."], ["Mill type (ISO 6020-1 / ISO 6022)", "16 / 25 MPa, heavy duty."], ["Welded / mobile", "Compact, 21–35 MPa."], ["Compact / short stroke (ISO 6020-3)", "Fixtures, clamping."], ["With end cushions, position sensor, valves on board", "Options."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Bore D (ISO 3320)", "25 32 40 50 63 80 100 125 140 160 180 200 250 mm"],
    ["Rod d", "12 – 140 mm; pairs 40/22, 40/28, 50/28, 50/36, 63/36, 63/45, 80/45, 80/56, 100/56, 100/70, 125/70, 125/90, 160/90, 160/110, 200/125, 200/140"],
    ["Area ratio φ", "≈ 1.25 / 1.4 / 2"],
    ["Nominal pressure", "16 MPa (tie-rod), 25 MPa (ISO 6022), 21–35 (mobile welded)"],
    ["Speed", "0.005 – 0.5 m/s standard seals (1 m/s with low-friction seals)"],
    ["Stroke", "up to ≈ 3 – 6 m (check buckling)"],
    ["Seal friction / η_cyl", "breakaway ≈ 0.2 – 0.5 MPa; η 0.90 – 0.95"],
    ["Internal leakage", "practically zero (PU seals); PTFE: a few drops / min"],
    ["Temperature", "−20 … +80 °C (NBR/PU); FKM to +150 °C"],
    ["Cleanliness", "ISO 4406 19/17/14 or better"]
  ]},
  tables: [{ t: "Areas and flows of the reference cylinder (docs/25)", h: ["Value", "Formula", "Result"], r: [
    ["Piston area A", "π · 6.3² / 4", "31.2 cm²"],
    ["Rod area", "π · 3.6² / 4", "10.2 cm²"],
    ["Annulus A_r", "31.2 − 10.2", "21.0 cm²"],
    ["φ", "31.2 / 21.0", "1.49"],
    ["Q extend at 0.1 m/s (6 m/min)", "31.2 · 6 / 10", "18.7 L/min"],
    ["Q retract (pump)", "21.0 · 6 / 10", "12.6 L/min"],
    ["Outflow piston side on retract", "31.2 · 6 / 10", "18.7 L/min"],
    ["Rod-side intensification (10 MPa)", "10 · 31.2 / 21.0", "14.9 MPa"]
  ]}],
  sel: {
    f: ["A = F / (p_eff · η_cyl)  → D = √(4·A/π) → next standard bore",
        "Q [L/min] = A [cm²] · v [m/min] / 10",
        "F_extend = p · A · η ; F_retract = p · A_r · η",
        "p_rod (intensification) = p · A / A_r"],
    ex: ["F = 20 kN, p_eff = 8.5 MPa (10 MPa − 15 % losses), η 0.95:",
         "A = 20 000 / (8.5 · 0.95) = 2477 mm² = 24.8 cm² → D = √(4 · 24.8 / π) = 5.6 cm → bore 63",
         "Rod 36 (φ 1.49): A = 31.2 cm², A_r = 21.0 cm²",
         "Pressure really needed: 20 000 / (3117 mm² · 0.95) = 6.75 MPa",
         "Stroke 200 mm in 2 s → v = 0.1 m/s = 6 m/min → Q = 31.2 · 6 / 10 = 18.7 L/min"]
  },
  calc: "cyl",
  mount: [
    "Load in the axis of the rod – side loads destroy guide and seals; use spherical bearings (MP5 + rod eye) for swinging movements.",
    "Check buckling for long strokes (see mountings / buckling).",
    "Ports up for self-bleeding; bleed screws at both ends; first strokes slow and at low pressure.",
    "Protect the rod (bellows) against chips, weld spatter, paint.",
    "Rate rod-side valves, hoses and fittings for intensification (p · φ)."
  ],
  fail: [
    ["Load drifts with valve closed", "Piston seal leaks OR spool valve leakage", "Test: pressurise one side, open other port – oil comes out = piston seal; else valve. Use pilot-operated check."],
    ["Rod seal leaks, scored rod", "Dirt, damaged chrome, side load", "Wiper, bellows, change rod + seals, align"],
    ["Seal extruded / nibbled", "Pressure peaks, intensification, gap too large (worn guide)", "Back-up rings, limit peaks, replace guide"],
    ["Jerky movement (stick-slip)", "Low speed + high seal friction, air", "Low-friction seals (PTFE), bleed, higher speed or stiffer oil column"],
    ["Bent rod", "Buckling, side load", "Check Euler with mounting factor, bigger rod, guide the load"]
  ],
  ask: ["Mounting code (ISO 6099), stroke, rod end thread?", "Seal system (PU / PTFE), max speed, temperature?", "Cushion type and cushion length?", "Buckling check for my mounting and stroke?", "Rod material and chrome thickness, sensor option?"],
  std: "ISO 3320, ISO 6020-1/-2, ISO 6022, ISO 6099, ISO 8132/8133 (mounting dims), ISO 10100 (acceptance test)"
},
{
  id: "cyl_sa", fam: "cyl", name: "Single-acting cylinder and plunger cylinder",
  short: "Oil pushes in one direction only; the load (gravity) or a spring brings it back. Plunger = the rod is the piston – simple, robust, for lifts, presses, jacks.",
  sym: [["cyl", { type: "sa" }], ["cyl", { type: "plunger" }]], symNote: "Single-acting with spring return · plunger (ram) cylinder",
  draw: "cylinder",
  how: [
    "<b>Single-acting:</b> one oil port; the other side is vented through a breather (filter!). Return by a spring (small strokes, clamps) or by the load weight.",
    "<b>Plunger (ram):</b> no piston seal – the rod seal at the head seals on the plunger. Force area = plunger area π·d²/4. Only gravity / external force retracts it. Long life, no internal leakage path.",
    "Lowering speed is set by a flow control valve (pressure-compensated) – the weight makes the pressure."
  ],
  types: [["Spring return", "Clamps, small presses, brakes (spring force falls with stroke!)."], ["Gravity return", "Lifting tables, elevators, tippers."], ["Plunger / ram", "Presses, lifts, jacks – very robust."], ["Hollow plunger", "Pull-through tools, bolt tensioners."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Plunger diameter", "20 – 500 mm (presses up to 1000+)"],
    ["Pressure", "10 – 35 MPa (jacks 70 MPa)"],
    ["Stroke", "5 mm (clamps) … 10 m (lifts)"],
    ["Spring force (spring return)", "≈ 5 – 15 % of hydraulic force"],
    ["Vent", "breather filter 10 µm on the dry side"]
  ]},
  sel: {
    f: ["A = F / (p · η) ; d = √(4·A/π)", "v_lowering = Q_valve / A ; Q_valve = A · v · 10 [L/min, A cm², v m/min]"],
    ex: ["Lift table 40 kN at 10 MPa, η 0.95: A = 40 000 / (10 · 0.95) = 4211 mm² = 42.1 cm² → d = √(4 · 42.1 / π) = 7.3 cm → plunger 80 mm (50.3 cm²)",
         "Pressure needed = 40 000 / (5027 mm² · 0.95) = 8.4 MPa",
         "Lower at 0.05 m/s (3 m/min): Q = 50.3 · 3 / 10 = 15.1 L/min through the flow control valve"]
  },
  calc: "cyl",
  mount: ["Plunger cylinders take no side load – guide the load.", "Vent port with breather filter, pointing down or protected from splash water.", "Pipe-break (hose-rupture) valve directly at the port for lifting loads."],
  fail: [["Water / dirt in the vented side → corrosion", "No breather filter", "Breather filter, drain"], ["Spring return too slow", "Return line throttled, spring weak", "Bigger return line, check spring"], ["Load falls when hose bursts", "No hose-rupture valve", "Fit pipe-break valve at the port"]],
  ask: ["Stroke stop inside (plunger needs a stop collar)?", "Spring force at start / end of stroke?", "Guide band length / side load capacity?"],
  std: "ISO 6020, EN 81-20 (lifts), ISO 4413"
},
{
  id: "cyl_tele", fam: "cyl", name: "Telescopic cylinder",
  short: "Several tubes inside each other give a long stroke from a short closed length – tippers, lifting platforms, compactors.",
  sym: [["cyl", { type: "tele" }]],
  draw: "cylinder",
  how: [
    "Stages extend one after the other, <b>largest area first</b> (lowest pressure). When a stage reaches its end, the next smaller one moves: pressure rises and speed rises at each change.",
    "Single-acting (gravity return, tippers) or double-acting (oil passages between the stages). Closed length ≈ stroke / number of stages + head length."
  ],
  types: [["Single-acting", "Tippers – retract by weight."], ["Double-acting", "Any position, horizontal use, compactors."], ["Synchronised (all stages together)", "Special, internal flow paths."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Stages", "2 – 6"], ["Largest stage", "Ø 60 – 250 mm"], ["Stroke", "1 – 10 m"], ["Pressure", "16 – 25 MPa"], ["Speed", "≤ 0.2 – 0.3 m/s"]
  ]},
  sel: {
    f: ["F_stage = p · A_stage · η", "v_stage = 10 · Q / A_stage   [m/min; Q L/min; A cm²]", "Smallest stage must still lift the load at its angle"],
    ex: ["Stages Ø 100 / 80 / 63 at 16 MPa: A = 78.5 / 50.3 / 31.2 cm²",
         "F = 125.6 / 80.4 / 49.9 kN (theoretical) – last stage 49.9 kN ≥ load 40 kN ✓",
         "Q = 30 L/min: v = 10 · 30 / 78.5 = 3.8 m/min … 10 · 30 / 31.2 = 9.6 m/min"]
  },
  mount: ["Mount with trunnion or clevis + spherical bearing; the long extended length must not take side load.", "Buckling check on the smallest stage over the full extended length."],
  fail: [["Stages extend in wrong order / jerk", "Friction differences, air", "Bleed, check seals"], ["Leaks between stages", "Worn stage seals (dirt)", "Reseal, wipers"], ["Bent last stage", "Side load / buckling (tipping on slope)", "Guide, mount correctly"]],
  ask: ["Force and speed of each stage?", "Extended length and buckling check?", "Single or double acting?"],
  std: "ISO 4413"
},
{
  id: "cyl_dbl", fam: "cyl", name: "Double-rod (through-rod) cylinder",
  short: "Rod on both sides: equal area, equal force and speed both ways. For machine-tool slides, steering, servo axes, test rigs.",
  sym: [["cyl", { type: "dbl" }]],
  draw: "cylinder",
  how: ["Both chambers have the same annulus area → symmetric for servo / proportional control (same gain in both directions), no flow difference.", "Needs space on both sides for the rods; one rod can carry a position sensor or be smaller (hollow)."],
  types: [["Equal rods", "Servo axes, test cylinders."], ["Hollow rod", "Sensor or cable through."], ["Hydrostatic bearings (servo test cylinders)", "Low friction, high frequency."]],
  data: { h: ["Property", "Range (example)"], r: [["Bore", "25 – 250 mm"], ["Pressure", "16 – 25 MPa (servo 21–28)"], ["Area", "A_r = π · (D² − d²) / 4 both sides"], ["Friction (servo version)", "breakaway < 0.1 MPa"]] },
  sel: {
    f: ["A_r = π · (D² − d²) / 4", "F = p · A_r · η ; Q = A_r · v · 10"],
    ex: ["63 / 36: A_r = 21.0 cm² both sides; F at 10 MPa = 21.0 kN · 0.95 = 20.0 kN",
         "v = 0.1 m/s (6 m/min): Q = 21.0 · 6 / 10 = 12.6 L/min in both directions"]
  },
  calc: "cyl",
  mount: ["Both rod ends free to move – guard both ends.", "For servo: valve on the cylinder (short lines = stiff = higher natural frequency)."],
  fail: [["Different speed directions", "Rods not equal / valve not symmetric", "Check valve spool type (servo: zero-lap, symmetric)"], ["Oscillation", "Soft oil column (long hoses, air)", "Valve on cylinder, bleed"]],
  ask: ["Friction (breakaway) for servo use?", "Integrated sensor?", "Max frequency / natural frequency?"],
  std: "ISO 6020, ISO 10100"
},
{
  id: "cyl_constr", fam: "cyl", name: "Cylinder construction: tie-rod, mill type, welded",
  short: "How the heads are fixed to the tube decides pressure, size, repair and cost.",
  sym: [["cyl", { type: "da", cush: true }]],
  draw: "cylinder",
  how: [
    "<b>Tie-rod:</b> square heads clamped to the tube by 4 tie rods. Standard industrial (ISO 6020-2, 16 MPa), easy to repair, many mounting options (MX codes).",
    "<b>Mill type:</b> heads bolted or screwed with flanges to a thick tube. Heavy duty, 16 / 25 MPa (ISO 6020-1, ISO 6022), steel mills, presses, long life.",
    "<b>Welded:</b> base welded to the tube, head screwed or with wire ring. Compact, cheap in series, mobile 21–35 MPa; repair harder."
  ],
  types: [["ISO 6020-2 tie-rod 16 MPa", "Bore 25–200, catalogue-class standard."], ["ISO 6020-1 / ISO 6022 mill type", "16 MPa / 25 MPa, bore 40–320 (500)."], ["Welded (mobile)", "21–35 MPa, custom sizes."], ["Compact (ISO 6020-3, short stroke)", "Fixtures."], ["Stainless / special", "Food, offshore, high temperature."]],
  data: { h: ["Feature", "Tie-rod ISO 6020-2", "Mill type ISO 6020-1 / 6022", "Welded"], r: [
    ["Nominal pressure", "16 MPa (test 24)", "16 / 25 MPa", "21 – 35 MPa"],
    ["Bores", "25 – 200 mm", "40 – 320 (500) mm", "any (mobile 32 – 200)"],
    ["Size / mass", "medium", "large, heavy", "compact, light"],
    ["Repair", "easy (tie rods)", "easy (bolted)", "harder (head screwed / ring)"],
    ["Mountings", "all ISO 6099, incl. MX", "flange, clevis, trunnion, foot", "clevis / eye, trunnion"],
    ["Cost", "low – medium", "high", "low in series"],
    ["Typical use", "machine tools, general industry", "steel, presses, heavy duty", "mobile, agriculture, cranes"]
  ]},
  sel: { f: ["Choose nominal pressure ≥ max working pressure incl. intensification and peaks", "Tube wall check (thin wall): s = p · D / (2 · σ_allow)"],
    ex: ["Reference cylinder 63 bore: max rod-side 14.9 MPa (intensification) → ISO 6020-2 (16 MPa) is just OK; if peaks occur → ISO 6022 (25 MPa)",
         "Tube Ø 63 inner, p 16 MPa, σ_allow 120 MPa (E355): s = 16 · 63 / 240 = 4.2 mm (+ margin → catalogue 7.5 mm for fatigue)"] },
  mount: ["Tie-rod nuts tightened crosswise to the catalogue torque.", "Mill-type: check head bolt torque after the first pressure test.", "Never weld on a finished cylinder (seals, distortion)."],
  fail: [["Leak between head and tube", "Tie-rods loose / stretched (pressure peaks)", "Re-torque; reduce peaks"], ["Tube bulged", "Intensification above rating", "Rate for p·φ, relief on rod side"], ["Fatigue crack at weld (welded type)", "Pressure cycles above design", "Design per ISO 10771-1 or mill type"]],
  ask: ["Nominal and test pressure; fatigue rating (ISO 10771-1)?", "Tube material and wall thickness?", "Repair kit availability?", "Dimension standard (interchangeable)?"],
  std: "ISO 6020-1/-2/-3, ISO 6022, ISO 10771-1, ISO 10100"
},
{
  id: "cyl_mount", fam: "cyl", name: "Cylinder mountings (ISO 6099) and buckling",
  short: "The mounting style decides how the force goes into the machine and the buckling length of the rod. Long thin rods must be checked with Euler.",
  sym: [["cyl", { type: "da" }]],
  draw: "cylinder",
  how: [
    "ISO 6099 gives each mounting a code: <b>MF</b> = flange, <b>MP</b> = pivot (clevis / eye), <b>MT</b> = trunnion, <b>MS</b> = foot / side lugs, <b>MX</b> = tie-rod ends, <b>MD</b> = double-rod versions.",
    "<b>Fixed mountings</b> (flange, foot) take the force in the cylinder axis – the load must be guided exactly in line. <b>Pivot mountings</b> (clevis, trunnion) allow the cylinder to swing – use spherical bearings at both ends.",
    "<b>Buckling:</b> a pushing rod is a column. Euler: <code>F_k = π² · E · I / L_k²</code>, <code>I = π · d⁴ / 64</code>. The free buckling length <code>L_k = K · L</code> (L = fully extended length, pin to pin or flange to rod end). Safety S = F_k / F ≥ 3.5 (often 2.5–4). Euler is valid for slender rods (λ = 4·L_k/d > ≈ 100); shorter rods → Tetmajer (catalogue tables)."
  ],
  types: [
    ["MF1 / MF3 front flange", "Push loads, rod end guided → shortest L_k."],
    ["MF2 / MF4 rear flange", "Pull loads; push only with short strokes."],
    ["MP1 rear clevis / MP3 rear eye / MP5 rear eye with spherical bearing", "Swinging loads; longest L_k (pin – pin)."],
    ["MT1 front / MT2 rear / MT4 intermediate trunnion", "Swinging; MT4 position chosen to balance."],
    ["MS2 side lugs (foot)", "Fixed, force in mounting plane causes tipping moment – use a key."],
    ["MX1–MX5 tie-rod ends / tapped holes", "Compact fixed mounting of tie-rod cylinders."]
  ],
  tables: [{ t: "Buckling length factor K (L_k = K · L), Euler cases – check the catalogue 'stroke factor' table", h: ["Mounting (cylinder) + rod end", "Euler case", "K", "Example codes"], r: [
    ["Fixed + rod end free (unguided)", "1", "2.0", "MF1/MS2 with free load (avoid!)"],
    ["Pivot + pivot (both ends pinned)", "2", "1.0", "MP1/MP3/MP5 + rod eye; MT1/MT2 + rod eye"],
    ["Fixed + rod end pinned and guided", "3", "0.7", "MF1/MF3, MS2 + guided pivoting load"],
    ["Fixed + rod end fixed and guided", "4", "0.5", "MF1 + rigidly guided load (slide)"]
  ], note: "Conservative practice: use the rod only (ignore the tube stiffness) and L = distance mounting point – rod end at full stroke." }],
  data: { h: ["Property", "Value (example)"], r: [
    ["Steel E", "210 000 N/mm²"],
    ["Safety factor S", "≥ 3.5 (Euler); 2.5 with exact calc / guided loads"],
    ["Slenderness limit", "λ = 4 · L_k / d ≥ ≈ 90 – 105 → Euler valid"],
    ["Pin / bearing tolerance", "pin f7, bore H7; spherical bearings ± 4 – 6° misalignment"],
    ["Rod-end thread", "ISO 4395 (e.g. 63/36 → M27×2 or M33×2)"]
  ]},
  sel: {
    f: ["I = π · d⁴ / 64", "F_k = π² · E · I / L_k²   (N, mm)", "S = F_k / F ≥ 3.5", "Needed d = (64 · S · F · L_k² / (π³ · E))^¼"],
    ex: ["Reference cylinder: rod 36, stroke 200, L ≈ 600 mm, pin–pin (K = 1): I = π · 36⁴ / 64 = 82 450 mm⁴",
         "F_k = 9.87 · 210 000 · 82 450 / 600² = 1.709e11 / 360 000 = 475 kN → S = 475 / 20 = 24 ✓",
         "Long stroke: stroke 1500, L = 1900 mm, pin–pin: F_k = 1.709e11 / 1900² = 47.3 kN → S = 2.4 ✗",
         "Rod 45 (63/45 pair): I = π · 45⁴ / 64 = 201 300 mm⁴ → F_k = 9.87 · 210 000 · 201 300 / 3.61e6 = 115.6 kN → S = 5.8 ✓",
         "Same cylinder fixed + free (K = 2, L_k = 3800): rod 36 F_k = 11.8 kN → S = 0.59 – would buckle!"]
  },
  calc: "buckle",
  mount: [
    "Clevis pins: hardened, greased, secured; spherical bearings for any misalignment.",
    "Flange / foot: dowel pins or a shear key take the force – not the screws in shear.",
    "Trunnions: support blocks close to the trunnion shoulders (bending!).",
    "Align a fixed-mounted cylinder to the guided load within ≈ 0.1–0.2 mm, or use a floating rod coupling."
  ],
  fail: [["Rod bent", "Buckling (K wrong), side load at full stroke", "Recalculate L_k with real K, bigger rod, stop tube / guide"], ["Trunnion pin worn / broken", "No lubrication, bending", "Grease, bearing blocks close"], ["Foot screws broken", "Shear on screws, no key", "Shear key / dowels"], ["Guide band worn on one side", "Misalignment of fixed mounting", "Floating coupling, spherical bearings"]],
  ask: ["Stroke factor / max stroke for my mounting and load?", "Stop tube needed (long strokes)?", "Rod end thread and rod eye type?", "Spherical bearing maintenance-free?"],
  std: "ISO 6099, ISO 8132, ISO 8133, ISO 4395, ISO 6982"
},
{
  id: "cyl_cushion", fam: "cyl", name: "End-position cushioning",
  short: "A spear on the piston enters a bore in the head near the end of stroke; the trapped oil escapes through an adjustable throttle and brakes the piston.",
  sym: [["cyl", { type: "da", cush: true }]],
  draw: "cylinder",
  how: [
    "In the last 15–40 mm of stroke the <b>cushion spear</b> (or cushion collar) closes the main outlet. The oil left in the cushion chamber must flow through a small <b>needle valve</b> → pressure rises → the piston slows down. A check valve gives free flow for the start in the other direction.",
    "The cushion must absorb the <b>kinetic energy</b> of the load AND the work of the still-pushing pump pressure (and gravity going down): <code>E = m·v²/2 + F_drive · s_c (+ m·g·s_c)</code>.",
    "Mean cushion pressure <code>p_c = E / (A_c · s_c)</code>; peak ≈ 1.5–2 × mean. It must stay below the cylinder rating."
  ],
  types: [["Fixed cushion", "No adjustment, small cylinders."], ["Adjustable (needle)", "Standard industrial."], ["Self-adjusting / progressive (grooved spear)", "Wide range of loads without setting."], ["Electronic (proportional valve ramp)", "With position sensor – no hard cushion needed."]],
  data: { h: ["Property", "Value (example)"], r: [["Cushion length s_c", "15 – 40 mm (by bore)"], ["Max speed without cushion", "≈ 0.1 m/s"], ["Max speed with cushion", "≈ 0.3 – 0.5 m/s (catalogue energy chart)"], ["Mean cushion pressure", "keep ≤ nominal pressure; peak ≤ test pressure"]] },
  sel: {
    f: ["E = m · v² / 2 + p_drive · A_drive · s_c (+ m · g · s_c going down)", "p_c,mean = E / (A_c · s_c)"],
    ex: ["Retract end of bore 63 (cushion on piston side): spear Ø 30 → A_c = 31.2 − 7.1 = 24.1 cm²; s_c = 25 mm",
         "m = 500 kg, v = 0.2 m/s: E_kin = 0.5 · 500 · 0.2² = 10 J",
         "Drive: 10 MPa on annulus 21.0 cm² = 21 000 N · 0.025 m = 525 J  → E = 535 J",
         "p_c = 535 / (24.1e-4 m² · 0.025 m) = 8.9 MPa mean (peak ≈ 13–18 MPa) – near the 16 MPa rating → reduce pump pressure during cushioning or use a longer cushion",
         "Lesson: the pump pressure work is often much bigger than the kinetic energy."]
  },
  mount: ["Set the needle at commissioning: start almost closed, open until the end position is reached smoothly without a bang.", "Seal / lock the needle after setting."],
  fail: [["Bang at end of stroke", "Needle too far open / no cushion / speed too high", "Adjust, slow down before end (prop valve ramp)"], ["Cylinder stops before the end", "Needle fully closed", "Open needle"], ["Seal / head damage", "Cushion pressure too high", "Calculate energy, longer cushion, lower speed"]],
  ask: ["Cushion length and energy diagram for my bore/speed/mass?", "Self-adjusting option?", "Cushion check valve for fast start?"],
  std: "ISO 6020, ISO 10100"
},
{
  id: "cyl_seals", fam: "cyl", name: "Cylinder seals and rod surface",
  short: "Seal materials and the rod surface decide leakage, friction, speed, temperature and life.",
  sym: [["cyl", { type: "da" }]],
  how: [
    "A rod seal system: <b>wiper</b> (keeps dirt out) → <b>rod seal</b> (often 2: primary PTFE + secondary PU lip, tandem) → <b>guide rings</b> (take side load, PTFE-bronze or fabric). Piston: <b>piston seal</b> (compact PU, PTFE step seal) + guide rings.",
    "<b>PU (polyurethane):</b> tough, wear resistant, very tight, up to 40–50 MPa, but max ≈ 0.5–1 m/s and ≈ 110 °C, not for HFC (water). <b>PTFE</b> (bronze/glass filled) with O-ring energiser: low friction, no stick-slip, high speed, wide temperature, a little leakage film. <b>NBR</b> O-rings / lips: cheap, −30…+100 °C. <b>FKM</b> (Viton): high temperature to 200 °C, HFD fluids.",
    "Rod: hardened steel (C45E induction hardened ≥ 50–55 HRC, or 20MnV6), <b>hard chrome 20–25 µm</b> (harsh environment 30–50 µm or nickel-chrome), <b>Ra 0.1–0.3 µm</b>, material ratio Rmr 50–90 %. Too smooth (Ra < 0.05) is also bad (no lubrication film)."
  ],
  types: [["PU U-cup / compact seal", "Standard industrial, tight, robust."], ["PTFE step seal / glyd ring + O-ring", "Servo, low friction, high speed."], ["NBR / FKM O-rings and back-up rings", "Static seals; back-up ring above ≈ 10 MPa / large gap."], ["Fabric-reinforced (chevron packs)", "Large presses, rough service."], ["Wipers (PU, double-lip)", "Single-lip or double-lip with sealing function."]],
  data: { h: ["Material", "Temperature", "Speed", "Pressure", "Fluids", "Notes"], r: [
    ["PU (TPU)", "−35 … +110 °C", "≤ 0.5 – 1 m/s", "≤ 40 – 50 MPa", "HLP, HEES (limited)", "best wear / extrusion; hydrolysis in water"],
    ["PTFE + bronze (with NBR/FKM O-ring)", "−50 … +200 °C", "≤ 4 – 15 m/s", "≤ 40 – 60 MPa", "all incl. HFC, HFD", "low friction, no stick-slip, small leakage film"],
    ["NBR", "−30 … +100 °C", "≤ 0.5 m/s", "≤ 16 MPa (with back-up 40)", "HLP, HFC", "cheap; no HFD"],
    ["FKM (Viton)", "−20 … +200 °C", "≤ 0.5 m/s", "≤ 16 MPa (with back-up 40)", "HLP, HFD, HEES", "high temperature; no HFC hot water / ammonia"],
    ["HNBR", "−30 … +150 °C", "≤ 0.5 m/s", "≤ 25 MPa", "HLP, HEES", "better ageing than NBR"]
  ]},
  tables: [{ t: "Surfaces (example)", h: ["Surface", "Value"], r: [
    ["Rod", "hard chrome 20 – 25 µm, Ra 0.1 – 0.3 µm, Rmax ≤ 2.5 µm, tolerance f7 / f8, ≥ 800–1000 HV chrome"],
    ["Rod base material", "C45E / 42CrMo4 induction hardened 50–60 HRC depth 1–2 mm, or 20MnV6 (welding-friendly)"],
    ["Bore", "honed or skived + roller burnished, Ra 0.2 – 0.4 µm, H8 / H9"],
    ["Seal groove", "Ra ≤ 1.6 µm, chamfer 15–20° lead-in"],
    ["Extrusion gap", "≤ 0.2 – 0.3 mm at 16 MPa for PU (smaller for higher p)"]
  ]}],
  sel: { f: ["Choose seal by: speed, temperature, pressure, fluid, friction (stick-slip?), leakage allowed", "Seal friction force ≈ p_contact · π · d · b · μ (catalogue: breakaway pressure)"],
    ex: ["Lift cylinder 0.1 m/s, 50 °C, HLP, 10 MPa → PU rod + piston seals ✓",
         "Servo axis 0.5 m/s, small movements → PTFE step seals (no stick-slip) ✓",
         "Hot press 150 °C → PTFE with FKM O-ring, FKM wiper ✓"] },
  mount: ["Use mounting sleeves over threads and grooves (sharp edges cut seals).", "Lubricate seals with the system oil before assembly.", "Store seals cool, dark, < 25 °C; PU max ≈ 5 years."],
  fail: [["Oil film on rod / drops", "Worn rod seal, scratched chrome", "Replace seal + polish / re-chrome rod"], ["Nibbled seal edge", "Extrusion: gap too large, pressure peaks", "Back-up ring, harder material, new guide"], ["Seal hardened / cracked", "Too hot (> 100 °C NBR) or wrong fluid", "FKM / PTFE, cooler"], ["Rust spots on rod", "Chrome too thin / porous, wet environment", "Thicker chrome 30–50 µm or nickel-chrome, bellows"]],
  ask: ["Seal system per position (wiper, rod, piston, guides)?", "Chrome thickness and Ra of the rod?", "Max speed and temperature of this seal set?", "Fluid compatibility (HFC, HEES)?"],
  std: "ISO 5597 (housings), ISO 6194, ISO 7425, ISO 3601 (O-rings), ISO 4406"
},
{
  id: "cyl_sensor", fam: "cyl", name: "Cylinder position sensors",
  short: "End switches tell the PLC 'end reached'; a continuous sensor (magnetostrictive) measures the whole stroke for positioning and servo control.",
  sym: [["cyl", { type: "da", sensor: true }]],
  how: [
    "<b>Inductive proximity end switches</b> in the heads detect the cushion spear (PNP, 24 V, pressure-proof to 50 MPa). <b>Reed / magnetic</b> switches (tie-rod or slot mounted) detect a magnet in the piston – only non-magnetic tubes (aluminium, stainless) or special.",
    "<b>Magnetostrictive</b> sensor: a rod in a gun-drilled hole in the piston rod; a ring magnet on the piston. A current pulse in the waveguide meets the magnet field → torsion wave → time of flight = position. Absolute, contact-free, 1–5 µm resolution.",
    "Other: LVDT (short strokes), potentiometer (cheap), draw-wire (external), external linear encoders."
  ],
  types: [["Inductive end switch (in head)", "Robust, 2 positions."], ["Reed / Hall on tube", "Small cylinders, low cost."], ["Magnetostrictive (in rod)", "Positioning, servo; 4–20 mA, SSI, CANopen, IO-Link, EtherCAT."], ["LVDT", "Short strokes, high temperature."], ["Draw-wire", "Retrofit, long strokes."]],
  data: { h: ["Property", "Magnetostrictive (example)", "Inductive end switch"], r: [
    ["Measuring length", "25 – 7600 mm", "end point only"],
    ["Resolution", "1 – 5 µm (digital) / 0.1 mm analog", "—"],
    ["Linearity", "≤ ± 0.01 – 0.02 % FS (min ± 50 µm)", "switching point ± 0.1–0.5 mm"],
    ["Pressure rating", "35 – 70 MPa (peak)", "50 MPa"],
    ["Output", "4–20 mA / 0–10 V / SSI / IO-Link / fieldbus", "PNP NO, 24 V"],
    ["Update time", "0.25 – 1 ms", "—"],
    ["Rod gun-drill", "Ø 10 – 13 mm → min rod Ø ≈ 22 – 28 mm", "—"]
  ]},
  sel: { f: ["Resolution needed ≈ 1/5 … 1/10 of positioning tolerance", "Rod with sensor: check strength with the bore (I_hollow = π·(d⁴ − d_i⁴)/64)"],
    ex: ["Position tolerance ± 0.1 mm → sensor resolution ≤ 0.02 mm → magnetostrictive SSI ✓",
         "Rod 36 drilled Ø 10: I = π · (36⁴ − 10⁴) / 64 = 81 960 mm⁴ (−0.6 %) – negligible"] },
  mount: ["Shielded cable, shield on the cabinet side, separate from motor cables.", "Magnet position and zero offset set at commissioning; protect the sensor head/connector at the cylinder base."],
  fail: [["Position jumps / noise", "EMC (shield), damaged cable", "Shield, re-route cable"], ["No signal after rod change", "Magnet missing / wrong", "Fit magnet ring"], ["Wrong end position signal", "Switch screwed too deep / loose", "Set gap per datasheet, lock nut"]],
  ask: ["Output interface and update rate?", "Linearity and temperature drift?", "Pressure rating of sensor housing?", "Replacement without opening the cylinder?"],
  std: "IEC 60947-5-2 (proximity switches), IEC 61131-2"
},
{
  id: "rot_act", fam: "cyl", name: "Rotary actuators (rack-and-pinion, vane)",
  short: "Turn oil pressure into a limited rotation (90°, 180°, 360°…) with high torque – swivel arms, valve actuators, tool changers, turning fixtures.",
  sym: [["rotact", {}]],
  how: [
    "<b>Rack-and-pinion:</b> one or two pistons with a toothed rack turn a pinion. Torque <code>T = p · A · r · η</code> (r = pitch radius of the pinion), double rack ×2. Any angle by stroke length; low leakage (piston seals); small backlash.",
    "<b>Vane:</b> one or two vanes on the shaft inside a cylindrical housing. Torque <code>T = p · b · (R² − r²) / 2 · η</code> per vane. Compact, but angle ≤ 280° (single vane) / ≤ 100° (double vane), more internal leakage (vane seals) – cannot hold a load alone.",
    "<b>Helical (spline) actuators:</b> a piston with helical splines – high torque, compact, mobile."
  ],
  types: [["Rack-pinion, single rack", "90–360°, 10 – 50 000 N·m."], ["Rack-pinion, double rack", "Double torque, balanced bearing load."], ["Vane, single / double", "Compact, ≤ 280° / ≤ 100°."], ["Helical spline", "Mobile, very high torque."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Torque", "5 N·m – 50 kN·m (special more)"], ["Angle", "90 / 180 / 270 / 360° (rack any)"], ["Pressure", "10 – 21 MPa"], ["Backlash", "rack: 0.1 – 0.5° (zero-backlash versions); vane: none"], ["Leakage", "rack ≈ zero / vane small"], ["End-position cushioning", "optional, adjustable"]
  ]},
  sel: {
    f: ["Rack: T = p · A_piston · r_pitch · η   (× 2 double rack)", "Vane: T = p · b · (R² − r²) / 2 · η   (× 2 double vane)", "Check also: J · ω² / 2 must be absorbed by the cushion / stop"],
    ex: ["Rack: bore 50 (19.63 cm²), r = 25 mm, 10 MPa: F = 10 · 1963 = 19 630 N → T = 19 630 · 0.025 = 491 N·m · 0.9 = 442 N·m",
         "Vane: b = 50, R = 60, r = 20 mm, 10 MPa: T = 10 · 50 · (3600 − 400) / 2 = 800 000 N·mm = 800 N·m · 0.9 = 720 N·m",
         "(check vane: force 10 · 50 · 40 = 20 kN at mean radius 40 mm = 800 N·m ✓)"]
  },
  mount: ["Large inertia: limit swing speed with meter-out flow control; check stopping energy (cushion chart).", "No axial/radial shaft load beyond the catalogue."],
  fail: [["Load drifts (vane type)", "Internal vane leakage", "Pilot-operated check + external brake, or rack type"], ["Broken teeth / stop", "Inertia not braked", "Cushions, flow control, deceleration valve"], ["Backlash grows", "Wear of rack / pinion", "Adjust or zero-backlash version"]],
  ask: ["Torque at my pressure, angle, backlash?", "Allowed inertia and swing time (energy chart)?", "Cushion and position sensor options?"],
  std: "ISO 1219-1, ISO 4413"
},
{
  id: "cyl_clamp", fam: "cyl", name: "Clamping cylinders for machine tools (swing clamps, block cylinders, work supports)",
  short: "Small high-pressure cylinders that clamp workpieces in fixtures: swing clamps turn the arm away for loading, block cylinders push, work supports lock in position.",
  sym: [["cyl", { type: "sa" }], ["cyl", { type: "da" }], ["dpoc", {}]], symNote: "Single-acting and double-acting clamp · hydraulic lock (double pilot-operated check) for each clamp group",
  how: [
    "<b>Swing clamp:</b> the piston first turns the arm 90° (helical groove + ball) and then pulls it down → clamps. Unclamping lifts and swings away so the robot / operator can load. Single-acting (spring return) or double-acting.",
    "<b>Block cylinder:</b> compact square body, screwed into the fixture, pushes directly. <b>Work support:</b> a plunger touches the part with low spring force and is then locked hydraulically (collet) – stops vibration without pushing the part.",
    "Pressure: low-pressure systems <b>5–7 MPa</b> (machine-tool HPU), compact clamps up to <b>25–50 MPa</b> (pressure intensifier or small HPU). Clamp sequence (sequence valves), pressure switch 'clamped' to the PLC, and a <b>hydraulic lock / accumulator</b> so the part stays clamped on pallets without supply (rotary coupling uncoupled)."
  ],
  types: [["Swing clamp (left/right, 90°)", "Pull-type, top-down clamping, 2 – 40 kN."], ["Block cylinder", "Push / pull, short stroke 8 – 50 mm."], ["Hollow-piston / pull cylinder", "Pull-down through the fixture."], ["Work support", "Locking force 2 – 40 kN, spring or hydraulic advance."], ["Link clamp / lever clamp", "Large clamping area."], ["Threaded-body cylinder", "Screws into fixture bores (M16–M48)."], ["Zero-point clamping module", "Spring clamped, hydraulically released (5–6 MPa)."]],
  data: { h: ["Type", "Piston Ø (example)", "Force at 6 MPa / 50 MPa", "Stroke"], r: [
    ["Swing clamp small", "Ø 16 – 25", "1.2 – 2.9 kN / 10 – 24 kN", "8 – 20 mm clamping + 90° swing"],
    ["Swing clamp large", "Ø 32 – 50", "4.8 – 11.8 kN (6 MPa)", "15 – 30 mm"],
    ["Block cylinder", "Ø 16 – 63", "1.2 – 18.7 kN / 10 – 156 kN", "8 – 50 mm"],
    ["Work support", "Ø 16 – 32 plunger", "locking load 2.5 – 12 kN (catalogue at 10–50 MPa)", "8 – 16 mm"],
    ["Pressure", "low-pressure 5 – 7 MPa; compact 25 – 50 MPa", "", ""],
    ["Oil volume per clamp", "1 – 20 cm³", "", ""]
  ]},
  sel: {
    f: ["Total clamp force F_clamp ≥ S · F_cutting / μ_total   (S 2 … 2.5)", "F_cyl = p · A · η_arm   (swing clamp arm efficiency ≈ 0.8–0.9, check arm length chart)"],
    ex: ["Cutting force 2000 N sideways, friction μ 0.15 at jaw AND table (μ_total 0.30), S = 2:",
         "F_clamp = 2 · 2000 / 0.30 = 13 330 N → 4 clamps × 3.4 kN",
         "Swing clamp Ø 32 at 6 MPa: F = 6 · 804 = 4.83 kN · 0.85 = 4.1 kN per clamp ✓ (Ø 25 gives only 2.5 kN ✗)",
         "Oil: 4 clamps × 8 cm³ = 32 cm³ → accumulator 0.16 L on the pallet holds pressure for leakage + temperature changes"]
  },
  mount: [
    "Clamp force on the part over a support point – never on an unsupported area (bending, vibration).",
    "Swing clamps: never stop the arm by hand during swing (helix breaks); use flow control to slow swinging (≤ 0.5 s per swing with heavy arms).",
    "Pallets: rotary coupling or self-sealing couplings + hydraulic lock + accumulator + pressure check at the loading station.",
    "Bleed every clamp; use manifold-mounted (O-ring) versions to avoid hoses in the chip area."
  ],
  fail: [["Part moves during cutting", "Clamp force too low, pressure dropped (leak, no accumulator)", "Calculate force, pressure switch interlock, accumulator"], ["Swing clamp arm broken", "Hit during swing, swing too fast", "Flow control, check loading clearance"], ["Clamp pressure decays on pallet", "Leaking couplings / seals, temperature drop", "Accumulator, coupling service, pressure monitoring before machining"], ["Chips jam the plunger", "No wiper / no metal scraper", "Clamp with metal wiper, coolant-proof"]],
  ask: ["Clamping force vs pressure and arm length chart?", "Swing time and max swing flow?", "Manifold-mount or threaded port version?", "Sensor for clamped / unclamped (pneumatic or inductive)?", "Accumulator / pallet coupling system?"],
  std: "ISO 4413, VDI 3371 (clamping), ISO 16156 (machine-tool safety, workholding)",
  also: ["check"]
}
];
