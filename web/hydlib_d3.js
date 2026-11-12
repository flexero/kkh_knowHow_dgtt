/* Hydraulics element data book – families acc, filt, line, sens, fluid (pure data, no imports).
 * Schema: see hydlib.js. All numbers are EXAMPLES – check the supplier's current catalogue. */
export const ELEMENTS = [
/* ================================================================ ACCUMULATORS */
{
  id: "acc_bladder", fam: "acc", name: "Bladder accumulator",
  short: "Steel pressure vessel with a rubber bladder filled with nitrogen; stores oil under pressure for short flow peaks, emergency functions and shock damping.",
  sym: [["acc", { type: "bladder" }]], draw: "bladder",
  how: [
    "A forged or welded steel shell holds a flexible <b>bladder</b> (NBR, ECO, FKM …). The bladder is filled with <b>nitrogen</b> through a gas valve on top to the <b>pre-charge pressure p0</b> with no oil in the shell.",
    "When system pressure rises above p0, oil flows in through the <b>poppet valve</b> at the bottom and squeezes the gas. The gas is a spring: higher pressure = less gas volume = more stored oil. When the system pressure falls, the gas pushes the oil out.",
    "The <b>anti-extrusion poppet</b> closes when the bladder is fully expanded, so the bladder cannot be pressed into the oil port. Bladders react very fast (little mass, no friction) – good for shock damping and fast flow peaks."
  ],
  types: [
    ["Standard (top repairable)", "Bladder changed from the top; most common, 0.2–50 L."],
    ["High-flow", "Large oil port and poppet, up to ≈ 30–40 L/s; for fast emergency strokes and presses."],
    ["Low-pressure (transfer barrier)", "For 1–3 MPa, e.g. suction pulsation damping or separating two fluids."],
    ["With back-up gas bottles", "Accumulator + extra N₂ bottles = bigger gas volume, flatter p–V curve (small pressure change)."],
    ["Pulsation damper (in-line)", "Flow passes through the body; damps pump ripple at the pump outlet."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Nominal gas volume V0", "0.2 · 0.5 · 1 · 2.5 · 4 · 5 · 6 · 10 · 20 · 32 · 50 L"],
    ["Max working pressure", "21 · 33 · 35 MPa (special up to 69 MPa)"],
    ["Pressure ratio p2 / p0", "≤ 4 : 1 (bladder stress)"],
    ["Pre-charge p0", "≥ 0.25 · p2 and ≈ 0.9 · p1 (energy storage)"],
    ["Max oil flow", "Standard ≈ 4 L/s (1 L) … 15 L/s (50 L); high-flow up to ≈ 30–40 L/s"],
    ["Usable oil volume", "≈ 30–60 % of V0 (depends on p0, p1, p2 and n)"],
    ["Temperature", "NBR −15 … +80 °C, ECO −40 … +120 °C, FKM −10 … +150 °C"],
    ["Response time", "< 25 ms (very fast)"],
    ["Mounting position", "Vertical, gas valve on top (allowed horizontal with less volume)"],
    ["Mass", "≈ 4 kg (1 L, 33 MPa) · 14 kg (4 L) · 45 kg (20 L) · 110 kg (50 L)"],
    ["Gas", "Nitrogen class 4.0 (99.99 %) only"],
    ["Approval", "PED 2014/68/EU (CE), ASME, …"]
  ] },
  sel: {
    f: ["V0 = ΔV / [ (p0/p1)^(1/n) − (p0/p2)^(1/n) ]  (absolute pressures)", "n = 1.4 for discharge < 1 min (adiabatic), n = 1 for slow (> 3 min, isothermal)", "Check p2/p0 ≤ 4 and Q_max ≤ catalogue flow of the oil valve"],
    ex: ["ΔV 0.62 L, p1 7.9 MPa abs, p2 10.1 MPa abs, p0 7.1 MPa abs", "(7.1/7.9)^(1/1.4) = 0.927 · (7.1/10.1)^(1/1.4) = 0.777", "V0 = 0.62 / (0.927 − 0.777) = 4.2 L → choose 5 L bladder", "p2/p0 = 10.1/7.1 = 1.42 ≤ 4 ✓ · flow 18.7 L/min = 0.31 L/s ≪ 4 L/s ✓"]
  },
  calc: "acc", chart: "accu",
  mount: [
    "Vertical, gas valve on top, so the oil can drain and the bladder is not trapped.",
    "Mount with clamps / brackets on the shell – never hang the accumulator only on the pipe.",
    "Always with a safety and shut-off block (relief, isolation, discharge) – see acc_safety.",
    "Keep 150–200 mm free above the gas valve for the charging tool.",
    "Mount close to the consumer for shock damping; away from heat (sun, furnace) – gas pressure rises with temperature."
  ],
  fail: [
    ["Cycle time slow, pressure drops fast", "Pre-charge lost (gas leak at the gas valve or bladder diffusion)", "Check p0 with the charging tool, refill N₂; change gas valve core"],
    ["Oil comes out of the gas valve", "Bladder torn", "Change bladder, find cause (p0 too low, p2/p0 > 4, high temperature, dirt)"],
    ["Hard knocks, bladder damage at the bottom", "p0 too low – bladder hits the poppet at every cycle", "Set p0 ≈ 0.9 · p1"],
    ["Little usable oil", "p0 too high (≥ p1) – no oil enters until p > p0", "Lower p0, check the calculation with absolute pressures and n = 1.4"],
    ["Pressure rises in hot weather", "Gas expands with temperature (p ∝ T abs)", "Set p0 at the working temperature or correct: p0,20 = p0,T · 293/(T+273)"]
  ],
  ask: ["Gas volume, max pressure, PED category and certificate (declaration of conformity)?", "Bladder material for my fluid and temperature (HLP / HFC / HEES)?", "Max oil flow of the oil valve (standard / high-flow)?", "Pre-charge as delivered – charged or transport pressure?", "Spare bladder kit and charging / testing tool included?"],
  std: "PED 2014/68/EU, EN 14359, EN ISO 4413, ISO 1219-1"
},
{
  id: "acc_piston", fam: "acc", name: "Piston accumulator",
  short: "Honed steel tube with a free piston between nitrogen and oil; for large volumes, high pressure ratios and with back-up gas bottles.",
  sym: [["acc", { type: "piston" }]], draw: "pistonAcc",
  how: [
    "A free <b>piston</b> with seals runs in a honed tube. Nitrogen is on one side, oil on the other. The piston separates them and moves with the pressure balance.",
    "Because there is no rubber bladder, the <b>pressure ratio p2/p0 can be up to 10 : 1</b> and the volume can be very big (up to ≈ 1000 L, or more with gas bottles).",
    "The piston seals have <b>friction</b> (≈ 0.1–0.3 MPa) and the piston has mass, so a piston accumulator reacts slower than a bladder. A position sensor (rod or magnet) can show the oil volume."
  ],
  types: [
    ["Standard", "0.1–100 L, both caps screwed or welded."],
    ["With piston position switch / sensor", "Rod through the gas cap or magnetic sensor – shows filling level, safety shut-off."],
    ["With gas back-up bottles", "Piston accumulator + N₂ bottles; large energy, small pressure change (presses, die casting)."],
    ["Large (die casting, steel mills)", "200–1000 L, 35 MPa."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Volume", "0.1 … 1000 L (bores ≈ 50 … 360 mm)"],
    ["Max working pressure", "21 · 35 MPa (special 50 MPa)"],
    ["Pressure ratio p2 / p0", "up to 10 : 1"],
    ["Pre-charge p0", "≈ 0.9 · p1, but ≥ 0.2 · p2"],
    ["Seal friction", "≈ 0.1 … 0.3 MPa pressure difference"],
    ["Max piston speed", "≈ 2–3 m/s (seal limit)"],
    ["Flow", "high – depends on bore and piston speed; e.g. bore 125 mm at 2 m/s ≈ 24.5 L/s"],
    ["Mounting", "Any position, preferably vertical gas side up"],
    ["Gas leakage", "Small; check p0 more often than bladder (every 6 months)"],
    ["Mass", "≈ 25 kg (5 L, 35 MPa) · 120 kg (50 L)"]
  ] },
  sel: {
    f: ["Same gas law as the bladder: V0 = ΔV / [ (p0/p1)^(1/n) − (p0/p2)^(1/n) ]", "Flow Q = A_piston · v_piston  (v ≤ 2–3 m/s)", "Friction: add ≈ 0.2 MPa to the minimum working pressure"],
    ex: ["Bore 125 mm: A = π/4 · 1.25² = 1.227 dm² → at 2 m/s = 20 dm/s: Q = 24.5 L/s", "With friction 0.2 MPa: p1 7.9 → use 8.1 MPa abs in the formula for the gas side"]
  },
  calc: "acc", chart: "accu",
  mount: ["Gas side up when possible (dirt settles on the oil side, away from the gas seal).", "Fix on the tube with clamps, allow for tube growth under pressure.", "Safety block with relief and discharge (acc_safety).", "With gas bottles: connect gas side with steel tube, gas safety valve on the bottle rack."],
  fail: [
    ["Gas in the oil (foam), p0 falls", "Piston seal worn", "Change seals, check oil cleanliness and honing"],
    ["Oil on the gas side (found when checking p0)", "Seal leakage oil → gas", "Drain via gas side, change seals"],
    ["Jerky discharge, pressure steps", "Stick-slip of the seals, dry piston, dirt", "Clean oil, PTFE seals with low friction"],
    ["Piston hits the gas cap", "p0 too low or too much oil volume", "Correct p0; position switch to stop the pump"]
  ],
  ask: ["Max pressure ratio and max piston speed?", "Seal type (PTFE / PU) and friction value?", "Position switch / sensor options?", "PED category, certificate, inspection intervals?", "Gas bottle connection sizes?"],
  std: "PED 2014/68/EU, EN 14359, EN ISO 4413"
},
{
  id: "acc_diaph", fam: "acc", name: "Diaphragm accumulator",
  short: "Small spherical or cylindrical steel vessel with a rubber diaphragm; for small volumes, pulsation damping and leak compensation (e.g. clamping circuits).",
  sym: [["acc", { type: "diaphragm" }]], draw: "bladder",
  how: [
    "Two steel half-shells (welded) or a screwed body hold a <b>diaphragm</b> that separates nitrogen and oil. A <b>valve button</b> in the centre of the diaphragm closes the oil port when the diaphragm is fully expanded.",
    "Welded diaphragm accumulators cannot be repaired – they are cheap and light. Screwed types allow diaphragm change.",
    "Typical uses: keep the pressure in a <b>clamping circuit</b> when the pump is off (leak compensation), damp pump pulsation, absorb thermal expansion in a closed line."
  ],
  types: [
    ["Welded", "0.075–4 L, not repairable, low cost."],
    ["Screwed (repairable)", "0.1–4 L, diaphragm can be changed, higher pressure."],
    ["Pre-charge fixed (no gas valve)", "Cheapest; p0 cannot be checked or corrected."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Volume", "0.075 · 0.16 · 0.32 · 0.5 · 0.75 · 1.0 · 1.4 · 2.0 · 2.8 · 4.0 L"],
    ["Max working pressure", "21 · 25 · 35 MPa (small sizes up to 50 MPa)"],
    ["Pressure ratio p2 / p0", "≤ 8 : 1 (welded), ≤ 10 : 1 (screwed)"],
    ["Max flow", "≈ 1–6 L/s"],
    ["Port", "G 1/2 … G 3/4 (BSPP), M18×1.5"],
    ["Mass", "≈ 1 kg (0.16 L) · 3.5 kg (1 L) · 10 kg (4 L)"],
    ["Temperature", "NBR −15 … +80 °C"],
    ["PED", "≤ 1 L: usually 'sound engineering practice' (Art. 4.3), no CE mark"]
  ] },
  sel: {
    f: ["Leak compensation (isothermal, slow): ΔV = Q_leak · t_hold", "V0 = ΔV / [ (p0/p1) − (p0/p2) ]  (n = 1, absolute)"],
    ex: ["Clamp circuit: leak 2 cm³/min, hold 30 min → ΔV = 60 cm³ = 0.06 L", "p2 7.1 MPa abs (pump off), p1 5.6 MPa abs (pressure switch 'clamp OK' at 5.5 MPa g), p0 = 0.9 · 5.6 = 5.0 MPa abs", "V0 = 0.06 / (5.0/5.6 − 5.0/7.1) = 0.06 / (0.893 − 0.704) = 0.06 / 0.189 = 0.32 L → 0.32 L or 0.5 L diaphragm"]
  },
  calc: "acc",
  mount: ["Any position; gas side up preferred.", "Close to the consumer for pulsation damping.", "Isolation valve + discharge screw or valve between accumulator and circuit (service).", "Protect against overpressure: relief valve in the circuit that the accumulator cannot isolate."],
  fail: [
    ["Clamp pressure falls too fast, pump restarts often", "Pre-charge lost / diaphragm porous", "Check p0 (if gas valve), change accumulator"],
    ["No damping, noisy line", "p0 wrong for pulsation damping (should be ≈ 0.6–0.7 · p mean)", "Correct p0"],
    ["Oil at the gas valve", "Diaphragm torn", "Change (welded: whole unit)"]
  ],
  ask: ["Welded or screwed, with or without gas valve?", "Max pressure ratio?", "PED category for my size?", "Diaphragm material for my fluid?"],
  std: "PED 2014/68/EU, EN 14359"
},
{
  id: "acc_size", fam: "acc", name: "Accumulator sizing (gas law)",
  short: "How to calculate the gas volume V0 from the oil volume you need – with absolute pressures, pre-charge rules and isothermal vs adiabatic change.",
  sym: [["acc", { type: "bladder" }], ["accBlock", {}]],
  how: [
    "Nitrogen follows the gas law <code>p · V^n = constant</code>. Three states: <b>0</b> = pre-charge (no oil), <b>1</b> = minimum working pressure (oil volume V1 of gas), <b>2</b> = maximum pressure (gas squeezed to V2). The useful oil is <b>ΔV = V1 − V2</b>.",
    "Always use <b>absolute pressure</b> = gauge + 0.1 MPa. With gauge pressure the result is wrong (too small at low pressure).",
    "<b>n = 1 (isothermal)</b> when the change is slow (> 3 min) and the gas keeps its temperature (leak compensation). <b>n = 1.4 (adiabatic)</b> for fast changes (< 1 min, normal machine cycles, emergency strokes). Adiabatic needs a <b>bigger</b> accumulator – the gas heats up when compressed and cools when expanding, so less oil comes out.",
    "Pre-charge rules: energy storage <b>p0 ≈ 0.9 · p1</b>; pulsation / shock damping <b>p0 ≈ 0.6–0.7 · p_mean</b>; bladder limit <b>p0 ≥ 0.25 · p2</b> (ratio 1 : 4)."
  ],
  types: [
    ["Energy storage (cycle peaks)", "n = 1.4 for discharge, p0 ≈ 0.9 · p1."],
    ["Leak compensation (holding)", "n = 1, slow; p0 ≈ 0.9 · p1."],
    ["Emergency stroke (power failure)", "n = 1.4, add 20–30 % margin; check that the pressure is still enough at the END of the stroke."],
    ["Pulsation damping", "Small volume, p0 ≈ 0.6–0.7 · p mean, mounted at the pump outlet."],
    ["Shock (pressure surge) damping", "Close to the fast-closing valve, p0 ≈ 0.6–0.9 · working pressure."],
    ["Thermal expansion", "Closed line heated by sun / process: ΔV = V_line · β_T · ΔT (β_T ≈ 0.0007 1/K for oil)."]
  ],
  data: { h: ["Rule", "Value (example)"], r: [
    ["Absolute pressure", "p_abs = p_gauge + 0.1 MPa"],
    ["Polytropic exponent n", "1.0 isothermal · 1.4 adiabatic (N₂ real gas at > 20 MPa: n ≈ 1.6 – use maker software)"],
    ["Pre-charge energy storage", "p0 ≈ 0.9 · p1 (abs)"],
    ["Pre-charge damping", "p0 ≈ 0.6–0.7 · p_mean"],
    ["Bladder ratio", "p2/p0 ≤ 4"],
    ["Diaphragm ratio", "p2/p0 ≤ 8 (welded)"],
    ["Piston ratio", "p2/p0 ≤ 10"],
    ["Temperature effect on p0", "p0,T2 = p0,T1 · (T2 + 273)/(T1 + 273)"],
    ["Usable oil vs V0", "Typical 30–60 % of V0"],
    ["Margin", "+10–25 % on V0, then next catalogue size"]
  ] },
  tables: [{ t: "Docs/25 example – isothermal vs adiabatic", h: ["Quantity", "n = 1 (isothermal)", "n = 1.4 (adiabatic)"], r: [
    ["p0 / p1 = 7.1 / 7.9", "0.899", "0.899^(0.714) = 0.927"],
    ["p0 / p2 = 7.1 / 10.1", "0.703", "0.703^(0.714) = 0.777"],
    ["Difference", "0.196", "0.149"],
    ["V0 = 0.62 / difference", "3.2 L", "4.2 L → 5 L"]
  ], note: "Adiabatic is the correct choice for a 2 s stroke. With the isothermal result (3.2 L) the pressure would fall below p1 before the stroke ends." }],
  sel: {
    f: ["p0 · V0^n = p1 · V1^n = p2 · V2^n  (absolute)", "ΔV = V1 − V2", "V0 = ΔV / [ (p0/p1)^(1/n) − (p0/p2)^(1/n) ]", "Check usable oil of a chosen size: ΔV = V0 · [ (p0/p1)^(1/n) − (p0/p2)^(1/n) ]"],
    ex: ["Docs/25: ΔV 0.62 L, p1 7.8 MPa g = 7.9 abs, p2 10 MPa g = 10.1 abs, p0 = 0.9 · 7.9 = 7.1 abs", "n = 1.4: V0 = 0.62 / (0.927 − 0.777) = 0.62 / 0.149 = 4.2 L → 5 L", "n = 1: V0 = 0.62 / (0.899 − 0.703) = 3.2 L (too small for a 2 s stroke)", "Check 5 L: ΔV = 5 · 0.149 = 0.75 L ≥ 0.62 L ✓ (21 % margin)"]
  },
  calc: "acc", chart: "accu",
  mount: ["Write p0 and the reference temperature on the label and in the hydraulic diagram.", "Put the gas law calculation in the machine documentation (needed for PED and service).", "Check p0 after the first week (bladder settles), then yearly."],
  fail: [
    ["Pressure falls below p1 before the stroke ends", "Sized isothermal or with gauge pressure", "Recalculate with n = 1.4 and absolute pressure"],
    ["Bladder life short", "p2/p0 > 4 or p0 far below 0.9 · p1", "Correct p0, choose larger volume to reduce the ratio"],
    ["Much less oil than calculated", "p0 set cold, works hot (or the reverse)", "Correct p0 to working temperature"]
  ],
  ask: ["Can you run your sizing software for my duty cycle (real gas, temperature)?", "Recommended p0 and tolerance at 20 °C?", "Max discharge flow for my emergency stroke?"],
  std: "EN 14359, EN ISO 4413, PED 2014/68/EU"
},
{
  id: "acc_safety", fam: "acc", name: "Accumulator safety and shut-off block",
  short: "Manifold block between accumulator and system with shut-off valve, relief valve, manual and solenoid discharge and gauge port – required by EN ISO 4413.",
  sym: [["accBlock", {}], ["pv", { type: "relief" }], ["dv", { ways: 2, pos: ["c22", "o22"], l: "sol", r: "spring" }]],
  how: [
    "An accumulator stores energy even when the pump is off. The <b>safety block</b> makes it safe: a <b>shut-off ball valve</b> separates it from the system, a <b>relief valve</b> (sealed, often type-tested) protects the vessel, a <b>manual discharge valve</b> drains the oil to tank, and a <b>solenoid discharge valve</b> (normally open 2/2) drains it automatically when the machine is switched off.",
    "EN ISO 4413: a machine with accumulators must <b>discharge them automatically</b> (or isolate them safely) when switched off, and carry a warning label. A gauge shows that the pressure is really zero before work.",
    "<b>PED 2014/68/EU</b> classifies the accumulator by the product <b>PS · V</b> (max allowable pressure in bar × gas volume in L). Nitrogen is a fluid of group 2: up to 50 bar·L = sound engineering practice (no CE); 50–200 = category I; 200–1000 = II; 1000–3000 = III; > 3000 = IV. (Group 1 dangerous fluids use the lower limits 25 / 50 / 200 / 1000.) Volumes ≤ 1 L are SEP unless PS > 1000 bar. The relief valve on the block is then a <b>safety accessory</b> with its own category."
  ],
  types: [
    ["Basic block", "Shut-off + relief + manual discharge + gauge port."],
    ["With solenoid discharge", "Plus normally-open 2/2 seat valve: pressure dumped at power-off."],
    ["With throttle in discharge", "Limits discharge flow (no oil jet, no shock in the tank line)."],
    ["Gas side safety", "Bursting disc or gas relief on large piston / bottle systems; fusible plug for fire."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Size", "DN 10 · 20 · 32 (flow ≈ 60 · 200 · 400 L/min)"],
    ["Max pressure", "35 MPa (block), relief set ≤ accumulator PS"],
    ["Relief valve", "Type-tested, sealed setting, ≤ PS of the vessel"],
    ["Discharge valve", "2/2 seat, normally open (de-energised = open), 24 V DC"],
    ["Ports", "Accumulator M33×1.5 / G 1¼, system, tank, gauge G 1/4"],
    ["PED example 1", "5 L bladder, PS 330 bar: 330 · 5 = 1650 bar·L → category III"],
    ["PED example 2", "0.75 L diaphragm, PS 250 bar: V ≤ 1 L → SEP (Art. 4.3)"],
    ["PED example 3", "1 L bladder, PS 210 bar: 210 bar·L → category II"],
    ["Inspection", "Pre-charge check yearly (EN ISO 4413 guidance), vessel inspection per national rule (e.g. Germany BetrSichV: by category / p·V)"]
  ] },
  tables: [{ t: "Pre-charge charging and checking – step by step", h: ["Step", "What to do"], r: [
    ["1", "Lock out the pump (LOTO). Discharge the oil side: open the manual discharge valve, gauge reads 0."],
    ["2", "Close the shut-off valve to the system."],
    ["3", "Fit the charging and testing tool on the gas valve (tool valve closed)."],
    ["4", "Open the tool spindle slowly: gauge shows p0. Compare with the label (correct for temperature)."],
    ["5", "Too low: connect a NITROGEN bottle with pressure reducer, fill slowly, wait 10 min (temperature), read again. NEVER oxygen or air (explosion)."],
    ["6", "Too high: let gas out through the tool bleed valve."],
    ["7", "Close tool, remove, check gas valve with leak spray, fit protective cap. Write date + p0 + temperature in the logbook."]
  ] }],
  sel: {
    f: ["Relief setting ≤ PS (accumulator) and ≥ 1.1 · p_max system", "Discharge time t ≈ V_oil / Q_throttle (choose 10–60 s)", "PED category from PS [bar] · V [L] (group 2)"],
    ex: ["System p2 10 MPa = 100 bar, accumulator PS 330 bar → relief set 120 bar (protects the system, far below PS)", "5 L, usable oil 0.75 L, discharge throttle 3 L/min → t ≈ 0.75/3 = 0.25 min = 15 s"]
  },
  mount: ["Block directly on the accumulator (no hose in between if possible).", "Discharge line to tank below oil level, with throttle.", "Warning label: 'Accumulator – pressure stored – discharge before work' + p0 + gas N₂.", "Gauge visible from the service position.", "Shut-off handle lockable."],
  fail: [
    ["Pressure stays after switch-off", "Solenoid discharge valve stuck / wired normally closed", "Use normally-open valve, test at every stop"],
    ["Relief opens during normal work", "Setting too low or temperature rise", "Check setting vs p2; check thermal expansion"],
    ["Oil jet / shock in tank at discharge", "No throttle in discharge", "Add orifice 0.8–1.5 mm"]
  ],
  ask: ["Type test certificate of the relief valve (PED safety accessory)?", "Normally-open discharge valve with which coil?", "Block rated for the accumulator PS?", "Documentation for my PED category (DoC, operating manual)?"],
  std: "EN ISO 4413, PED 2014/68/EU, EN 14359"
},
/* ================================================================ FILTRATION + CONDITIONING */
{
  id: "flt_suction", fam: "filt", name: "Suction strainer / suction filter",
  short: "Coarse screen on the pump suction line to catch big particles; must have very low pressure drop so the pump does not cavitate.",
  sym: [["filter", { kind: "strainer" }]], draw: "filter",
  how: [
    "A wire mesh (typ. <b>100–250 µm</b>) on the suction pipe in the tank, or a suction filter housing outside the tank. It catches big dirt (welding beads, rags) that could break a gear pump at once.",
    "It does <b>not</b> clean the oil well. Its pressure drop reduces the pump inlet pressure. If it clogs, the pump <b>cavitates</b> (noise, erosion, failure).",
    "Many piston pump makers say: <b>no suction strainer</b>, use a clean tank and a fine return / pressure filter instead. If used: big area, bypass valve (0.02–0.03 MPa) and vacuum indicator."
  ],
  types: [
    ["Tank strainer (screw-on)", "Mesh 125 / 250 µm, cheapest, cannot be checked without draining."],
    ["Suction filter housing (in-tank, removable)", "Element changed from the top without draining, with bypass + vacuum gauge."],
    ["Magnetic suction separator", "Magnet rods catch iron particles, very low Δp."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Mesh", "60 · 90 · 125 · 150 · 250 µm"],
    ["Max clean Δp", "≤ 0.005–0.01 MPa at nominal flow (cold oil ≤ 0.02 MPa)"],
    ["Sizing", "Nominal flow ≥ 2–4 × pump flow"],
    ["Bypass", "0.02–0.03 MPa"],
    ["Pump inlet pressure min", "Gear ≥ 0.08 MPa abs (−0.02 bar g … −0.2), piston ≥ 0.08–0.09 MPa abs"],
    ["Velocity in suction line", "0.5–1.2 m/s"],
    ["Size", "G 3/8 … G 3, flow 20–600 L/min"]
  ] },
  sel: {
    f: ["p_inlet,abs = p_atm + ρ·g·h_oil − Δp_line − Δp_strainer ≥ pump minimum", "Choose strainer nominal flow ≥ 3 · Q_pump"],
    ex: ["Q_pump 18.7 L/min → strainer for ≥ 60 L/min, 125 µm", "p_inlet = 0.100 + 870·9.81·0.2/1e6 (0.0017) − 0.005 (line) − 0.005 (strainer) = 0.092 MPa abs ≥ 0.08 ✓"]
  },
  mount: ["At least 50–100 mm above the tank bottom (sludge) and 100 mm below the minimum oil level (no vortex, no air).", "Far from the return line (behind the baffle).", "Pump below oil level (flooded suction) if possible."],
  fail: [
    ["Pump whines / rattles, more noise when cold", "Clogged strainer → cavitation", "Clean / change, check oil viscosity at start"],
    ["Pump destroyed by a big particle", "No strainer and dirty new tank", "Flush the tank, fit strainer for gear pumps"],
    ["Foam in tank", "Strainer too near the surface → air sucked in", "Lower it, add anti-vortex plate"]
  ],
  ask: ["Δp at my flow and at cold start viscosity (e.g. 300 mm²/s)?", "Bypass and vacuum indicator available?", "Does the pump maker allow a suction strainer?"],
  std: "ISO 2941, ISO 3968, EN ISO 4413"
},
{
  id: "flt_pressure", fam: "filt", name: "Pressure filter (high-pressure line filter)",
  short: "Fine filter in the pressure line after the pump; protects sensitive valves (servo, proportional) from pump wear particles.",
  sym: [["filter", { kind: "pressure", ind: true, bypass: true }]], draw: "filter",
  how: [
    "A pressure-rated housing (21–42 MPa) with a fine element (<b>3–10 µm, β ≥ 200 or 1000</b>) directly after the pump or before a servo / proportional valve.",
    "The element has a <b>differential pressure indicator</b> (visual / electrical) that switches at e.g. 0.5 MPa. A <b>bypass valve</b> (0.6 MPa) protects the element; for servo valves use a <b>non-bypass</b> element with a high collapse rating (21 MPa) – dirty oil must never bypass to a servo valve.",
    "Filter efficiency: <code>β_x(c) = particles ≥ x upstream / particles ≥ x downstream</code> (ISO 16889). β 200 = 99.5 % of particles ≥ x µm are caught."
  ],
  types: [
    ["Inline housing with bypass", "General protection after pumps, 5–10 µm."],
    ["Non-bypass, high-collapse element", "Before servo valves, 3–5 µm, collapse Δp ≥ 21 MPa."],
    ["Manifold-mounted (sandwich NG6/10)", "Directly under a proportional valve."],
    ["Duplex (change-over)", "Two housings, change element without stopping."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Pressure rating", "21 · 31.5 · 42 MPa"],
    ["Fineness", "3 · 5 · 10 · 20 µm, β_x(c) ≥ 200 / 1000"],
    ["Nominal flow", "30 … 600 L/min"],
    ["Clean Δp (housing + element)", "≤ 0.1–0.15 MPa at working viscosity"],
    ["Indicator switch", "0.5 MPa (bypass at 0.6 MPa, if fitted)"],
    ["Element collapse Δp", "2.1 MPa standard, 21 MPa high-collapse"],
    ["Dirt-holding capacity", "≈ 5–60 g (depends on size)"],
    ["Element life", "500–2000 h typical (by indicator, not by time only)"],
    ["Port", "G 1/2 … G 1½, SAE flange 3000/6000 psi"]
  ] },
  sel: {
    f: ["Clean Δp at max flow AND working viscosity ≤ 0.1 MPa (correct for viscosity: Δp_element ∝ ν)", "Choose fineness from the target ISO 4406 code of the most sensitive component"],
    ex: ["Proportional valve target 16/14/11 → pressure filter 5 µm β ≥ 200", "Element Δp 0.04 MPa at 30 mm²/s → at cold 300 mm²/s ≈ 0.4 MPa (×10) → indicator 0.5 MPa still OK, but suppress the electrical indicator below 30 °C"]
  },
  mount: ["Directly after the pump (after the relief valve tee) or directly before the protected valve.", "Allow space for element removal (bowl downward + 100 mm).", "Electrical indicator to the PLC: warning, with cold-start suppression (temperature switch).", "Pressure-test housing and indicator to 1.5 × p."],
  fail: [
    ["Indicator red at cold start only", "High viscosity", "Normal – suppress below 30 °C"],
    ["Indicator red soon after commissioning", "System not flushed", "Flush with off-line filter, change element"],
    ["Servo valve sticks although filter fitted", "Bypass open (dirty element) or element collapsed", "Use non-bypass high-collapse element, change in time"]
  ],
  ask: ["β_x(c) value per ISO 16889 and dirt-holding capacity?", "Δp curve housing + element vs flow and viscosity?", "Collapse pressure and bypass setting?", "Indicator switching point, electrical connector, cold-start suppression?"],
  std: "ISO 16889, ISO 2941, ISO 3968, ISO 4406"
},
{
  id: "flt_return", fam: "filt", name: "Return line filter",
  short: "Main system filter in the return line to the tank; catches the dirt made by cylinders and valves before it reaches the tank.",
  sym: [["filter", { kind: "return", ind: true, bypass: true }]], draw: "filter",
  how: [
    "Most industrial units use a <b>tank-top return filter</b> (10 µm, β ≥ 200). All return oil passes through it. Low pressure (≤ 1–2.5 MPa) → cheap housing.",
    "A <b>bypass valve (0.25–0.35 MPa)</b> opens when the element is clogged or the oil is cold, so the housing and the return line do not burst. The <b>indicator</b> switches just below the bypass (≈ 0.2 MPa).",
    "Size it for the <b>maximum return flow</b>, not the pump flow: a differential cylinder pushes out more oil from the piston side than the pump delivers (area ratio φ)."
  ],
  types: [
    ["Tank-top (in-tank) return filter", "Housing in the tank cover, outlet below oil level. Standard."],
    ["Inline return filter", "In the line, 1.6–2.5 MPa."],
    ["Return-suction filter (mobile)", "Return flow feeds the charge pump with filtered oil; 0.05 MPa preload."],
    ["Spin-on", "Small units, ≤ 100 L/min, 10–25 µm."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Pressure rating", "1 · 1.6 · 2.5 MPa"],
    ["Fineness", "10 µm β ≥ 200 (standard), 5 µm for prop. systems, 20 µm for simple gear pump units"],
    ["Nominal flow", "25 … 1500 L/min"],
    ["Clean Δp", "≤ 0.03–0.05 MPa at max return flow"],
    ["Bypass", "0.25 · 0.3 · 0.35 MPa"],
    ["Indicator", "0.2 MPa (before bypass opens)"],
    ["Outlet", "≥ 100 mm below minimum oil level (no foam)"]
  ] },
  sel: {
    f: ["Q_return,max = Q_pump · φ  (φ = A_piston / A_annulus, on retract)", "Choose nominal flow so that clean Δp ≤ 0.05 MPa at Q_return,max"],
    ex: ["Docs/25: Q_pump retract 12.6 L/min, φ = 31.2/21.0 = 1.49 → Q_return = 12.6 · 1.49 = 18.7 L/min", "Choose return filter 10 µm β ≥ 200, nominal ≈ 40–60 L/min (Δp clean ≈ 0.02 MPa)"]
  },
  mount: ["Outlet pipe below minimum oil level, away from the pump suction.", "Indicator visible / wired to the PLC.", "Collect return lines in one manifold before the filter; leakage (drain) lines of pumps/motors go direct to tank (no back pressure!)."],
  fail: [
    ["Oil foams in the tank", "Outlet above oil level", "Extend outlet tube"],
    ["Indicator never shows clogging but oil is dirty", "Bypass stuck open / element missing", "Check bypass seat and element seal"],
    ["Cylinder seal leaks / return line bursts", "Filter undersized → back pressure (×φ)", "Size for max return flow"]
  ],
  ask: ["Δp curve at my return flow and viscosity?", "Bypass + indicator settings, electrical switch?", "Element dirt-holding capacity and price?", "Outlet tube length for my tank?"],
  std: "ISO 16889, ISO 2941, ISO 3968"
},
{
  id: "flt_offline", fam: "filt", name: "Off-line filter (kidney loop)",
  short: "Separate small pump + fine filter (+ cooler) that cleans the tank oil all the time, independent of the machine cycle.",
  sym: [["pump", {}], ["filter", { kind: "pressure", ind: true }], ["cooler", {}]],
  how: [
    "A small motor-pump unit takes oil from the tank and pushes it through a very fine filter (3 µm, β ≥ 1000), often with a water-absorbing element and a cooler, and back to the tank.",
    "Because the flow is constant and the element sees no pressure shocks, it catches more and finer dirt than a main filter. Typical flow: <b>10–20 % of the tank volume per minute</b> (tank turned over every 5–10 min).",
    "Also used as a <b>mobile filter cart</b> for flushing new systems and for filling oil (new oil is often only 21/19/16!)."
  ],
  types: [
    ["Fixed kidney loop", "Built into the HPU, runs whenever the main switch is on."],
    ["Filter cart (mobile)", "Flushing, filling, cleaning of tanks."],
    ["With water absorbing / vacuum dehydrator", "Removes free and dissolved water."],
    ["Depth filter (cellulose, fine)", "Large dirt and water capacity, 1–3 µm."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Flow", "5 … 60 L/min"],
    ["Fineness", "3 µm β ≥ 1000 (glass fibre) or 1 µm depth"],
    ["Motor", "0.25 … 1.5 kW"],
    ["Pressure", "≤ 0.6–1 MPa"],
    ["Water removal", "Absorbing element ≈ 0.2–1 L per element"],
    ["Result", "1–3 ISO code steps cleaner than without"]
  ] },
  sel: {
    f: ["Q_offline ≈ 0.1–0.2 · V_tank per minute"],
    ex: ["Tank 90 L → kidney loop 9–18 L/min → choose 15 L/min, 3 µm"]
  },
  mount: ["Suction and return at opposite ends of the tank.", "Sample point after the pump, before the filter (oil analysis).", "Electrical interlock: filter cart only with tank level OK."],
  fail: [
    ["Code does not improve", "Ingress bigger than removal (bad breather, rod wiper)", "Fix the source first"],
    ["Element clogs in days", "Water (gel) or varnish", "Oil analysis; dehydrate or change oil"]
  ],
  ask: ["β value, dirt and water capacity of the element?", "Flow at cold oil?", "Option with particle counter?"],
  std: "ISO 16889, ISO 4406, ISO 23309 (flushing)"
},
{
  id: "flt_breather", fam: "filt", name: "Tank breather filter",
  short: "Air filter on the tank: when the oil level goes down, air flows in – the breather stops dust (and water) from coming in with it.",
  sym: [["filter", { kind: "breather" }]],
  how: [
    "Every cylinder stroke changes the oil level in the tank – air flows in and out. Without a good breather, dust from the factory enters with every stroke. The <b>breather is often the biggest dirt entry point</b>.",
    "Use a breather with the same fineness as the system filter (3–10 µm). <b>Desiccant breathers</b> (silica gel) also dry the incoming air (colour change shows saturation).",
    "Size it for the maximum air flow = maximum change of oil volume per second (sum of cylinder flows) – otherwise the tank sees vacuum."
  ],
  types: [
    ["Screw-on breather 10 µm", "Standard, with filler strainer."],
    ["Desiccant breather", "Wet / humid areas, coolant mist (machine tools)."],
    ["Breather with check valves", "Tank slightly pressurised (0.03 MPa), less air exchange."],
    ["Filler-breather combination", "Filling basket 0.5 mm + air filter; fill only via filter cart."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Air fineness", "3 · 10 · 40 µm"],
    ["Air flow", "≈ 200 … 2000 L/min"],
    ["Clean Δp", "≤ 0.002–0.005 MPa"],
    ["Desiccant", "0.2 … 2 kg silica gel"],
    ["Connection", "Flange 6-hole (DIN 24557), G 1/2 … G 2"]
  ] },
  sel: {
    f: ["Air flow ≥ max (Q_out − Q_in) of the tank, with factor 2"],
    ex: ["Docs/25: retract 18.7 L/min out, extend 18.7 in → design air flow ≥ 2 · 18.7 ≈ 40 L/min → smallest size OK"]
  },
  mount: ["On the tank cover, protected against coolant splash.", "Desiccant: check colour weekly.", "Never remove the filler basket to fill faster."],
  fail: [
    ["Oil code bad although filters OK", "Breather coarse / missing", "Fit 3–10 µm (desiccant) breather"],
    ["Tank vacuum, pump cavitates", "Breather clogged", "Change"],
    ["Water in oil", "Humid air, temperature cycling", "Desiccant breather"]
  ],
  ask: ["Air fineness and β?", "Air flow at 0.005 MPa?", "Desiccant amount / life?"],
  std: "ISO 4406, DIN 24557"
},
{
  id: "flt_clean", fam: "filt", name: "Cleanliness: ISO 4406, β ratio, filter selection",
  short: "How oil cleanliness is measured (ISO 4406 code), how a filter is rated (β ratio, ISO 16889) and which code each component needs.",
  sym: [["filter", { kind: "pressure", ind: true, bypass: true }]],
  how: [
    "<b>ISO 4406</b> counts particles per 1 mL of oil in three size classes: <b>≥ 4 µm(c) / ≥ 6 µm(c) / ≥ 14 µm(c)</b>. Each count is turned into a code number; each step +1 = double the particles. Example 18/16/13 = 1300–2500 / 320–640 / 40–80 particles per mL.",
    "<b>β ratio (ISO 16889, multi-pass test):</b> <code>β_x(c) = N_up / N_down</code> for particles ≥ x µm. Efficiency <code>E = (1 − 1/β) · 100 %</code>: β 2 = 50 %, β 75 = 98.7 %, β 200 = 99.5 %, β 1000 = 99.9 %.",
    "<b>Dirt-holding capacity</b> (grams of test dust until Δp limit) = life of the element. <b>Clogging indicator</b> shows Δp across the element; <b>bypass valve</b> opens above it (then the oil is NOT filtered).",
    "Most failures of hydraulic components (≈ 70–80 %) come from dirty oil. The cheapest fix: right filters + good breather + oil samples."
  ],
  types: [
    ["Glass fibre (multi-layer)", "Standard for β ≥ 200; 3–25 µm."],
    ["Cellulose (paper)", "Cheaper, low β, sensitive to water; return filters on simple units."],
    ["Wire mesh", "Coarse 25–250 µm, cleanable – strainers."],
    ["Water absorbing", "Polymer that binds free water."]
  ],
  data: { h: ["Component", "Target ISO 4406 (example)"], r: [
    ["Servo valve", "15/13/10 … 16/14/11"],
    ["Proportional valve", "16/14/11 … 17/15/12"],
    ["Variable piston pump", "17/15/12 … 18/16/13"],
    ["Standard directional / pressure valves", "18/16/13"],
    ["Vane pump", "18/16/13"],
    ["Gear pump, cylinders", "19/17/14 … 20/18/15"],
    ["New oil from the barrel (typical!)", "21/19/16 … 23/21/18 – filter when filling"],
    ["Required filter fineness", "16/14/11 → 3–5 µm β ≥ 200 · 18/16/13 → 10 µm β ≥ 200 · 19/17/14 → 10–20 µm"]
  ] },
  tables: [
    { t: "ISO 4406 code table (particles per mL)", h: ["Code", "More than", "Up to and including"], r: [
      ["22", "20 000", "40 000"], ["21", "10 000", "20 000"], ["20", "5 000", "10 000"], ["19", "2 500", "5 000"],
      ["18", "1 300", "2 500"], ["17", "640", "1 300"], ["16", "320", "640"], ["15", "160", "320"],
      ["14", "80", "160"], ["13", "40", "80"], ["12", "20", "40"], ["11", "10", "20"], ["10", "5", "10"], ["9", "2.5", "5"]
    ], note: "Each code step doubles the particle count. 18/16/13 → 16/14/11 = 4 × fewer particles." },
    { t: "β ratio and efficiency", h: ["β_x(c)", "Efficiency", "1 particle passes out of"], r: [
      ["2", "50 %", "2"], ["10", "90 %", "10"], ["75", "98.7 %", "75"], ["200", "99.5 %", "200"], ["1000", "99.9 %", "1000"]
    ] },
    { t: "Rough equivalence ISO 4406 ↔ NAS 1638 (old US class)", h: ["ISO 4406", "NAS 1638 ≈"], r: [
      ["15/13/10", "4"], ["16/14/11", "5"], ["17/15/12", "6"], ["18/16/13", "7"], ["19/17/14", "8"], ["20/18/15", "9"], ["21/19/16", "10"]
    ], note: "Only a rough guide – the counting methods differ." }
  ],
  sel: {
    f: ["Code from count: code = smallest n with count ≤ upper limit of n (see table)", "E = (1 − 1/β) · 100 %", "Choose the target code of the MOST sensitive component in the circuit"],
    ex: ["Sample: 1 900 / 450 / 60 particles per mL → 18 / 16 / 13", "β_10(c) = 200 → E = (1 − 1/200) · 100 = 99.5 %", "System with one proportional valve → whole system 16/14/11 → pressure filter 5 µm + return 10 µm, breather 3 µm"]
  },
  mount: ["Sample point (Minimess) in a turbulent line before the return filter, flush 0.5 L before taking the sample.", "Clean bottle (ISO 3722), label with machine, date, hours.", "Flush new systems until the target code is reached (ISO 23309) – write it in the FAT report."],
  fail: [
    ["Valves stick, pump wears fast", "Code 2–3 steps above target", "Find source (breather, wiper, new oil), better filter, kidney loop"],
    ["Sample results jump", "Bad sampling (dead line, dirty bottle)", "Sampling procedure ISO 4021"],
    ["Element clogs fast after commissioning", "Built-in dirt not flushed", "Flushing at high velocity (Re > 4000) with flushing filter"]
  ],
  ask: ["β_x(c) per ISO 16889 (not 'nominal µm')?", "Dirt-holding capacity in grams?", "Expected ISO code with your filter set in my system?", "Particle counter / oil-condition sensor option?"],
  std: "ISO 4406, ISO 16889, ISO 4021, ISO 3722, ISO 23309, ISO 11500"
},
{
  id: "cooler", fam: "filt", name: "Oil cooler (air/oil and water/oil)",
  short: "Heat exchanger that removes the power loss of the hydraulic system so the oil stays at 40–55 °C.",
  sym: [["cooler", {}], ["cooler", { water: true }]],
  how: [
    "All hydraulic power that does no useful work becomes <b>heat</b>: throttling, relief valve flow, pump and motor losses, pipe friction. <code>P_loss [kW] = Δp [bar] · Q [L/min] / 600</code> for each throttled flow.",
    "The tank surface removes only a little (≈ 10–15 W/m²K). If the loss is bigger, a cooler is needed. Catalogues give the <b>specific cooling capacity P01 [kW/K]</b> = power per 1 K difference between oil inlet and air (or water) inlet temperature.",
    "<b>Air/oil coolers</b> (fan + aluminium core) need no water but need clean air and space. <b>Water/oil (plate or shell-and-tube)</b> are small and strong but need cooling water and can mix water into the oil if they leak."
  ],
  types: [
    ["Air/oil with AC motor fan", "Most HPUs, 0.5–60 kW, fan on/off by thermostat."],
    ["Air/oil with hydraulic motor fan", "Mobile machines."],
    ["Water/oil plate (brazed)", "Compact, high capacity, needs clean water (filter), Cu-brazed – no ammonia."],
    ["Water/oil shell-and-tube", "Robust, cleanable, sea water version (CuNi)."],
    ["Off-line cooler circuit", "Own pump + cooler + filter: cooler sees no pressure peaks; recommended."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Air/oil capacity", "0.05 … 3 kW/K (P01), fan 0.1 … 4 kW"],
    ["Water/oil capacity", "2 … 500 kW"],
    ["Oil pressure max", "Air core 1.6–2.5 MPa static, dynamic ≤ 1 MPa; plate 3 MPa"],
    ["Oil Δp", "≤ 0.05–0.15 MPa at nominal flow"],
    ["Oil temperature target", "40–55 °C, max 60–70 °C"],
    ["Ambient design", "Air 35–40 °C (summer!), water 25–30 °C"],
    ["Noise (air)", "65–80 dB(A) at 1 m"],
    ["Bypass", "Check valve 0.2–0.5 MPa around the cooler (cold start)"]
  ] },
  sel: {
    f: ["P_loss [kW] = Δp [bar] · Q [L/min] / 600", "P_cooler = P_loss − P_tank   (P_tank = k · A · ΔT)", "P01 [kW/K] = P_cooler / (T_oil,in − T_air,in)  · margin 1.2", "Water flow: Q_w [kg/s] = P / (4.18 · ΔT_w)", "Oil temperature drop in the cooler: ΔT_oil = P / (ρ · c · Q) (c ≈ 1.9 kJ/kgK)"],
    ex: ["Docs/25 bad design (fixed pump + closed centre): 90 bar · 18.7 L/min / 600 = 2.8 kW heat", "Tank 60 L removes 0.36 kW → cooler 2.8 − 0.36 = 2.44 kW", "Oil 55 °C, air 35 °C: P01 = 2.44 / 20 = 0.122 kW/K · 1.2 = 0.15 kW/K", "Water cooler: 2.8 kW, water +5 K → 2.8 / (4.18 · 5) = 0.134 kg/s = 8.0 L/min", "Oil ΔT in cooler = 2800 / (870 · 1900 · 18.7/60000) = 2800 / 515 = 5.4 K", "Better: tandem centre → 5 bar · 18.7 / 600 = 0.16 kW → no cooler needed"]
  },
  calc: "cooler",
  mount: ["Air cooler: free air in/out (≥ 1 × core height distance to the wall), not in the hot exhaust of other machines; clean fins regularly.", "In the return line (low pressure) with bypass check valve, or in an off-line circuit – never in the pressure line.", "Water cooler: water filter, water valve controlled by thermostat, oil pressure > water pressure (leak goes oil→water)."],
  fail: [
    ["Oil too hot in summer", "Cooler sized for 20 °C air, dirty fins", "Size for 35–40 °C, clean core"],
    ["Cooler core bursts", "Pressure peaks in return line (big cylinder dump)", "Bypass check, off-line circuit"],
    ["Water in oil (milky)", "Leaking water cooler", "Pressure test cooler, oil pressure > water pressure"]
  ],
  ask: ["P01 curve vs oil flow and viscosity?", "Max static and dynamic pressure of the core?", "Noise level, fan motor data?", "Water quality requirements (plate cooler)?"],
  std: "EN ISO 4413, EN 1048 (plate HX test)"
},
{
  id: "heater", fam: "filt", name: "Tank heater",
  short: "Electric heater in the tank to warm cold oil before start (cold halls, outdoor units) – with low surface load so the oil does not burn.",
  sym: [["heater", {}]],
  how: [
    "Cold oil is thick (VG 46 at 0 °C ≈ 600 mm²/s): pump cavitation, filter bypass, slow valves. A heater with thermostat brings the oil to ≥ 20–25 °C before the machine starts.",
    "Oil must not be heated too strongly at one spot (cracking, varnish). <b>Surface load ≤ 0.7–1 W/cm²</b> for mineral oil (≤ 0.5 W/cm² for low flow). Use a heater in a protection tube so it can be changed without draining.",
    "Heater must be switched off when the level is low (heater out of oil = fire risk)."
  ],
  types: [
    ["Screw-in heater with protection tube", "0.3–6 kW, with thermostat."],
    ["Flange heater", "Large tanks, 3–30 kW."],
    ["Pad heater (outside)", "Small tanks, no penetration."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Power", "0.3 · 0.5 · 1 · 2 · 3 · 6 kW"],
    ["Surface load", "≤ 0.7–1 W/cm² (mineral oil)"],
    ["Voltage", "230 V / 400 V"],
    ["Thermostat", "Set 20–30 °C, safety limiter 80 °C"],
    ["Protection", "IP65, interlocked with level switch"]
  ] },
  sel: {
    f: ["E = m · c · ΔT,  P = E / t  (+ 20–50 % losses)", "Heater area A ≥ P / q_max"],
    ex: ["Tank 100 L = 87 kg, 10 → 30 °C in 1 h: E = 87 · 1.9 · 20 = 3306 kJ → P = 3306 / 3600 = 0.92 kW → with losses 1.5 kW", "A ≥ 1500 W / 0.8 W/cm² = 1875 cm²"]
  },
  mount: ["Horizontal, low in the tank, fully covered at minimum oil level.", "Not near the suction (local hot oil).", "Interlock: heater off at low level and above thermostat setting."],
  fail: [
    ["Black deposits on heater, oil darkens", "Surface load too high", "Lower W/cm², bigger heater area"],
    ["Heater burnt out", "Ran dry (low level)", "Level interlock"]
  ],
  ask: ["Surface load W/cm²?", "Protection tube version?", "Built-in safety limiter?"],
  std: "EN 60335 / EN 60519, EN ISO 4413"
},
{
  id: "tank", fam: "filt", name: "Hydraulic tank (reservoir)",
  short: "Stores the oil, lets air and dirt settle, removes some heat and carries pump, motor, filters and valves of the power unit.",
  sym: [["tank", {}]], draw: "tank",
  how: [
    "Rule of thumb: tank volume <b>V ≈ 3–5 × pump flow per minute</b> for industrial units (1–2 × for mobile machines). The oil needs time to release air (≈ 1–3 min) and to settle dirt.",
    "Inside: a <b>baffle</b> separates return side and suction side so the oil travels a long way. <b>Return lines end below the oil level</b> (≥ 100 mm) and point away from the suction (45° cut). Suction 50–100 mm above the bottom. Sloped bottom with drain plug, cleaning covers, sight glass with thermometer, breather filter, level and temperature switch.",
    "The tank must also hold the oil that comes back from all cylinders (rod volumes, accumulators) at standstill without overflowing, plus 10–15 % air space."
  ],
  types: [
    ["Rectangular steel tank (welded)", "Standard HPU, painted inside with oil-resistant paint or bare and pickled."],
    ["Stainless steel", "Water glycol, food, clean rooms, no paint flakes."],
    ["Aluminium / cast", "Small compact units."],
    ["Pressurised / sealed (bladder tank)", "Mobile, no air contact."],
    ["L-type / V-type / overhead tank", "Pump below oil level (flooded suction) for big piston pumps."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Volume rule", "3–5 × Q_pump [L/min] (industrial), 1–2 × (mobile)"],
    ["Air space", "10–15 % above max level"],
    ["Return outlet", "≥ 100 mm below min level, ≥ 2 × pipe Ø from wall"],
    ["Suction", "50–100 mm above bottom, ≥ 100 mm below min level"],
    ["Velocity in return outlet", "≤ 1 m/s (diffuser) to avoid foam"],
    ["Surface cooling", "A [m²] ≈ 0.065 · V[L]^(2/3), k ≈ 10–15 W/m²K"],
    ["Bottom", "Sloped 3–5° to drain, on feet ≥ 150 mm (air below)"],
    ["Cleaning covers", "1 per chamber, size to reach all corners"],
    ["Material", "S235 steel 3–5 mm, stainless 1.4301 / 1.4571"],
    ["Standard units", "25 · 40 · 63 · 100 · 160 · 250 · 400 · 630 · 1000 L"]
  ] },
  sel: {
    f: ["V = (3 … 5) · Q_pump", "A ≈ 0.065 · V^(2/3)", "P_tank = k · A · ΔT", "Check: V_min level − ΔV (all cylinders out) ≥ suction cover"],
    ex: ["Docs/25 option A: Q 18.7 L/min → V = 60 … 90 L", "60 L: A = 0.065 · 60^(2/3) = 0.065 · 15.3 = 1.0 m²", "P_tank = 12 · 1.0 · 30 = 0.36 kW (oil 55 °C, air 25 °C)", "Option B (pump + accumulator, 2 L/min): 20–30 L – set by rod volume + accumulator oil + air release, not by pump flow"]
  },
  mount: ["Level the tank, free air around the walls for cooling.", "Drip tray / bund under the unit (≥ 110 % of tank volume where required by environmental law).", "Clean and flush the inside before filling (welding beads, paint, rust).", "Fill only through a filter cart."],
  fail: [
    ["Foam, noisy pump", "Return above oil level, too small tank (no air release)", "Lengthen return pipes, bigger tank / diffuser"],
    ["Oil too hot", "Tank too small for the losses", "Reduce losses first, then cooler"],
    ["Sludge at the bottom, dirty oil", "No cleaning covers, no slope", "Clean at every oil change, improve design"]
  ],
  ask: ["Tank volume, usable volume between min and max level?", "Inside treatment (paint / pickled / stainless)?", "Baffle, cleaning covers, drain, sight glass included?", "Bund / drip tray?"],
  std: "EN ISO 4413, ISO 1219-1"
},
{
  id: "level_temp", fam: "filt", name: "Level and temperature switches",
  short: "Switches / sensors on the tank that stop the pump at low oil level and warn or stop at high oil temperature.",
  sym: [["level", {}], ["temp", {}]], also: ["sens"],
  how: [
    "A <b>float switch</b> (reed contact in a guide tube) or a combined <b>level-temperature sensor</b> switches at minimum level (warning) and minimum-minimum (pump off). A bimetal or PT100 element in the same tube measures temperature.",
    "Typical logic: <b>T &lt; 20 °C</b> heater on / no full load; <b>T &gt; 50 °C</b> cooler fan on; <b>T &gt; 60 °C</b> warning; <b>T &gt; 70 °C</b> stop. <b>Level min</b> warning, <b>min-min</b> pump stop (before the pump sucks air).",
    "Analog sensors (4–20 mA) let the PLC see trends (slow leak, cooler getting dirty)."
  ],
  types: [
    ["Float switch, 1–3 contacts", "Simple, reliable."],
    ["Combined level + temperature (PT100 / switch)", "One flange opening."],
    ["Analog level transmitter (magnetostrictive / float chain)", "Continuous level, leak detection."],
    ["Sight glass with thermometer", "Visual check (always fit one in addition)."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Contacts", "NO / NC / change-over, 24 V DC, 0.5 A"],
    ["Switching accuracy", "± 3–5 mm level, ± 2–3 K temperature"],
    ["Length", "150 … 1000 mm"],
    ["Temperature switch points", "e.g. 20 / 50 / 60 / 70 °C"],
    ["Electrical", "M12 connector, IP65/67"]
  ] },
  sel: { f: ["Min-min level ≥ suction inlet + 100 mm (no vortex)"], ex: ["Suction 80 mm above bottom → min-min ≥ 180 mm above bottom; min warning 20–30 mm higher"] },
  mount: ["Calm zone of the tank (suction side, away from return turbulence).", "Wire NC contacts for 'level OK' (wire break = stop, fail-safe).", "Test the min-min switch at commissioning by draining."],
  fail: [
    ["Pump runs with low level and sucks air", "Float stuck by sludge / wired NO", "Clean, wire NC (fail-safe)"],
    ["Nuisance trips", "Switch in turbulent zone", "Move to calm zone, add damping tube"]
  ],
  ask: ["Switching points adjustable?", "Contact rating, connector, IP?", "Analog output option?"],
  std: "EN ISO 4413, IEC 60947-5"
},
/* ================================================================ LINES */
{
  id: "ln_tube", fam: "line", name: "Steel tube (precision seamless)",
  short: "Cold-drawn seamless precision steel tube EN 10305-4 for fixed hydraulic lines; sized by flow velocity and wall thickness.",
  sym: [["line", { kind: "work" }], ["line", { kind: "pilot" }], ["line", { kind: "drain" }]],
  how: [
    "Inside diameter from the allowed <b>velocity</b>: <code>d [mm] = 4.61 · √(Q [L/min] / v [m/s])</code>. Suction 0.5–1.2 m/s, return 2–4 m/s, pressure 3–6 m/s.",
    "Wall from the pressure (thin wall / Barlow): <code>s = p · D / (2 · σ_allow) + c1 + c2</code> (c1 tube tolerance ≈ 10–15 % of s, c2 corrosion / bending ≈ 0.5 mm). Check: <code>σ = p · D / (2 · s) ≤ σ_allow</code>. Static design (DIN 2413) allows σ ≈ 157 MPa for E235; for pulsating pressure use a lower value (docs/25 uses 60 MPa – conservative, fatigue).",
    "Materials: <b>E235+N</b> (Rm ≥ 340 MPa), <b>E355+N</b> (Rm ≥ 490 MPa), stainless 1.4571. Surface: phosphated + oiled, zinc-nickel (Cr VI free) or stainless."
  ],
  types: [
    ["E235+N (St 37.4)", "Standard up to ≈ 25 MPa for small sizes."],
    ["E355+N (St 52.4)", "Higher pressure, larger sizes."],
    ["Stainless 1.4571 / 1.4401", "Water glycol, outdoor, food."],
    ["Pre-bent / CNC bent", "Fewer fittings = fewer leaks."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Standard", "EN 10305-4 (hydraulic), metric OD"],
    ["Sizes OD", "6 · 8 · 10 · 12 · 15 · 16 · 18 · 20 · 22 · 25 · 28 · 30 · 35 · 38 · 42 mm"],
    ["Velocity suction / return / pressure", "0.5–1.2 / 2–4 / 3–6 m/s"],
    ["σ allowed static (E235 / E355)", "≈ 157 / 235 MPa (DIN 2413 style, K/1.5)"],
    ["σ allowed pulsating (conservative)", "≈ 60–80 MPa (E235)"],
    ["Bend radius", "≥ 2.5–3 × OD (machine bending)"],
    ["Support distance", "≈ 1 m (OD 6–12), 1.5 m (15–22), 2 m (25–42)"],
    ["Flushing velocity", "Re ≥ 4000 (turbulent)"]
  ] },
  tables: [{ t: "Tube table (E235+N): ID, flow at 4 m/s, static max pressure p = 2 · 157 · s / D (example)", h: ["OD × wall [mm]", "ID [mm]", "Q at 4 m/s [L/min]", "p static [MPa]", "p at σ 60 MPa"], r: [
    ["6 × 1", "4", "3.0", "52", "20"], ["8 × 1", "6", "6.8", "39", "15"], ["10 × 1.5", "7", "9.2", "47", "18"],
    ["12 × 1.5", "9", "15.2", "39", "15"], ["15 × 2", "11", "22.8", "42", "16"], ["15 × 2.5", "10", "18.8", "52", "20"],
    ["16 × 2", "12", "27.1", "39", "15"], ["18 × 2", "14", "36.9", "35", "13"], ["20 × 2.5", "15", "42.3", "39", "15"],
    ["22 × 2", "18", "61.0", "29", "11"], ["25 × 3", "19", "67.9", "38", "14"], ["28 × 3", "22", "91.1", "34", "13"],
    ["30 × 4", "22", "91.1", "42", "16"], ["35 × 3", "29", "158", "27", "10"], ["38 × 4", "30", "169", "33", "13"], ["42 × 4", "34", "218", "30", "11"]
  ], note: "Q = (ID/4.61)² · v. The fitting (ISO 8434-1 L / S series) often limits the pressure more than the tube – check both." }],
  sel: {
    f: ["d = 4.61 · √(Q / v)", "s = p · D / (2 · σ_allow) + c1 + c2", "σ = p · D / (2 · s)", "Re = v · d / ν; laminar (< 2300): λ = 64/Re; Δp = λ · (L/d) · ρ · v² / 2"],
    ex: ["Docs/25: 18.7 L/min at 4 m/s → d = 4.61 · √4.68 = 10.0 mm → tube 15 × 2.5 (ID 10)", "Check v = 18.7/60000 / (π/4 · 0.010²) = 3.97 m/s ✓", "Wall: s = 10 · 15 / (2 · 60) = 1.25 mm + c1 0.15 + c2 0.5 = 1.9 mm ≤ 2.5 ✓", "Barlow: σ = 10 · 15 / (2 · 2.5) = 30 MPa ≤ 60 ✓", "Δp 3 m: Re = 3.97 · 0.010 / 46e-6 = 863 → λ = 0.074 → Δp = 0.074 · 300 · 870 · 3.97² / 2 = 0.15 MPa"]
  },
  calc: "pipe",
  mount: ["Clamp with plastic tube clamps (DIN 3015) – damps vibration, prevents fretting.", "Straight length before a fitting ≥ 2 × nut height; no fitting in a bend.", "Expansion and vibration: hose between pump and fixed tube.", "Pickle / clean after bending and welding; flush to the cleanliness class.", "Pressure test 1.5 × max working pressure."],
  fail: [
    ["Tube cracks at the fitting", "Vibration, no clamps near the fitting, wrong assembly", "Clamps ≤ 100–200 mm from fitting, check assembly"],
    ["Hot oil, high Δp", "Tube too small (v > 6 m/s)", "Bigger tube"],
    ["Pump cavitation", "Suction tube too small (v > 1.2 m/s)", "Bigger suction line, short and straight"]
  ],
  ask: ["Material certificate EN 10204 3.1?", "Surface (zinc-nickel / phosphated / stainless)?", "Cleanliness of delivered tubes (capped, oiled)?", "CNC bending service with fitting pre-assembly?"],
  std: "EN 10305-4, DIN 2413, ISO 10771-1, EN ISO 4413, DIN 3015"
},
{
  id: "ln_hose", fam: "line", name: "Hydraulic hose",
  short: "Flexible rubber or thermoplastic line with steel wire reinforcement; for moving parts, vibration isolation and short connections.",
  sym: [["line", { kind: "hose" }]], draw: "hose",
  how: [
    "Inner tube (oil-resistant rubber), <b>reinforcement</b> (1 or 2 steel wire braids = 1SN / 2SN; 4 or 6 spiral layers = 4SP / 4SH / R13 / R15) and outer cover (abrasion, ozone). The reinforcement decides the pressure.",
    "Hose assemblies are crimped with fittings of the <b>same system</b> (hose + fitting from the same maker). Safety factor <b>4 : 1</b> (burst / working pressure) for dynamic use.",
    "Hoses age: rubber hardens, wires corrode. Guidance (DIN 20066 / EN ISO 4413 + national rules): <b>max 6 years including max 2 years storage</b>, inspect yearly, exchange earlier under high load. Every assembly carries the maker, pressure and production date."
  ],
  types: [
    ["EN 853 1SN / 2SN", "1 or 2 wire braids – standard industrial up to ≈ 40 MPa (small sizes)."],
    ["EN 856 4SP / 4SH", "4 spirals – high pressure, high impulse (mobile, presses)."],
    ["EN 856 R13 / R15", "4–6 spirals, 35 / 42 MPa all sizes, high impulse."],
    ["EN 854 / SAE 100R6 textile", "Low pressure: return, suction (with helix)."],
    ["Thermoplastic (EN 855, SAE 100R7/R8)", "Light, non-conductive, small bend radius."],
    ["Compact / multi-spiral 'constant pressure' classes", "ISO 18752 classes (e.g. 28 MPa / 35 MPa / 42 MPa across sizes)."]
  ],
  data: { h: ["Property", "Range (example)"], r: [
    ["Sizes", "DN 5 · 6 · 8 · 10 · 12 · 16 · 19 · 25 · 31 · 38 · 51"],
    ["Safety factor", "4 : 1 (burst / working)"],
    ["Temperature", "−40 … +100 °C (oil, standard rubber)"],
    ["Impulse test", "1SN/2SN 200 000 cycles, 4SP/4SH 400 000 cycles, R15 500 000 (at 125–133 % pressure, 100 °C)"],
    ["Service life guidance", "≤ 6 years incl. ≤ 2 years storage"],
    ["Velocity limits", "Same as tubes (suction 0.5–1.2, return 2–4, pressure 3–6 m/s)"],
    ["Hose whip restraint", "Required above ≈ 5 MPa near people (EN ISO 4413)"]
  ] },
  tables: [{ t: "Max working pressure [MPa] by size and type (example)", h: ["DN", "Inch", "1SN", "2SN", "4SP", "4SH", "Min bend radius 2SN [mm]"], r: [
    ["6", "1/4", "22.5", "40.0", "–", "–", "100"], ["8", "5/16", "21.5", "35.0", "–", "–", "115"], ["10", "3/8", "18.0", "33.0", "44.5", "–", "130"],
    ["12", "1/2", "16.0", "27.5", "41.5", "–", "180"], ["16", "5/8", "13.0", "25.0", "35.0", "–", "200"], ["19", "3/4", "10.5", "21.5", "35.0", "42.0", "240"],
    ["25", "1", "8.8", "16.5", "28.0", "38.0", "300"], ["31", "1¼", "6.3", "12.5", "21.0", "32.5", "420"], ["38", "1½", "5.0", "9.0", "18.5", "29.0", "500"], ["51", "2", "4.0", "8.0", "16.5", "25.0", "630"]
  ], note: "R13 = 35 MPa for DN 19–51, R15 = 42 MPa for DN 10–31 (example). The fitting must have at least the same rating." }],
  sel: {
    f: ["DN from velocity: d = 4.61 · √(Q / v)", "Working pressure of hose ≥ max system pressure incl. peaks (and rod-side intensification!)", "Length: allow for movement and 2 % shrinkage under pressure; bend radius ≥ catalogue"],
    ex: ["Docs/25 return line 18.7 L/min at 2.5 m/s → 12.6 mm → DN 16 hose", "Rod-side line: intensification 14.9 MPa → 2SN DN 12 (27.5 MPa) ✓, 1SN DN 12 (16.0 MPa) is too close → use 2SN"]
  },
  mount: ["No twisting (check the lay line), no bending at the fitting (straight length ≥ 1.5 × OD).", "Bend radius ≥ catalogue, also when moving.", "Protect against abrasion (spiral guard), heat (sleeve), sharp edges.", "Hose whip restraint (cable) at both ends near operator positions; protective cover where a burst could hit people.", "Label: date, pressure, ID number; record in the hose register."],
  fail: [
    ["Burst at the fitting", "Bent too close to the fitting / wrong crimp", "Use elbow fitting, correct crimp diameter"],
    ["Cover cracks (ozone / age)", "Too old, UV, ozone", "Replace, keep the 6-year rule"],
    ["Burst in the middle after short time", "Pressure peaks above rating, twisting", "Higher class (4SP), install without twist"],
    ["Oil mist / pinhole leak", "Abrasion through cover", "Guard, re-route — NEVER feel for leaks with the hand (oil injection injury)"]
  ],
  ask: ["Hose type, standard (EN 853/856, ISO 18752) and impulse class?", "Fitting system matched to the hose (crimp data)?", "Production date marking and test report?", "Hose whip restraints and guards available?"],
  std: "EN 853, EN 856, EN 857, ISO 18752, ISO 17165-2, DIN 20066, EN ISO 4413"
},
{
  id: "ln_fitting", fam: "line", name: "Fittings: 24° cone (ISO 8434-1), ports",
  short: "Tube connections: 24° cone fittings with cutting ring, flared or welded nipple; O-ring face seal; port threads BSPP, metric, UNF.",
  sym: [["line", { kind: "junction" }], ["line", { kind: "cross" }], ["line", { kind: "plug" }]], draw: "fitting24",
  how: [
    "<b>24° cone fitting (ISO 8434-1, 'DIN 2353'):</b> body with 24° cone, nut and a <b>cutting ring</b> that bites into the tube when the nut is tightened. Version with <b>elastomeric seal</b> (soft seal ring in the cone, e.g. 'DKO' style) is leak-free and preferred.",
    "Two series: <b>L (light)</b> and <b>S (heavy)</b> – different nut / cone sizes, different pressure. Do not mix L and S parts, do not mix makers.",
    "<b>Port (stud end) threads:</b> ISO 1179 BSPP (G thread, sealed with ED ring / bonded washer), ISO 6149 metric (O-ring, marked with a ring groove), ISO 11926 SAE UNF (O-ring). Taper threads (NPT, R) are <b>not</b> recommended – they leak and can crack housings."
  ],
  types: [
    ["Cutting ring (single / double)", "Standard, assembled with pre-assembly tool or by hand (turns)."],
    ["Elastomeric seal cone (soft seal)", "Leak-free, can be reassembled more often."],
    ["Flared (37° JIC, SAE J514 / ISO 8434-2)", "US machines."],
    ["O-ring face seal (ORFS, ISO 8434-3)", "Flat face + O-ring, very leak-free, high vibration, up to 40–63 MPa."],
    ["Welded nipple (ISO 8434-1 cone + weld)", "Large sizes, high pressure."],
    ["Flareless 'formed' tube end (orbital forming)", "Formed tube end + soft seal, leak-free."]
  ],
  data: { h: ["Series / tube OD", "Max pressure (example, ISO 8434-1 style; catalogue steel often higher)"], r: [
    ["L series 6–15 mm", "25 MPa (catalogue often 31.5)"],
    ["L series 18–22 mm", "16–25 MPa"],
    ["L series 28–42 mm", "16 MPa"],
    ["S series 6–14 mm", "63 MPa (catalogue up to 80)"],
    ["S series 16–20 mm", "40 MPa"],
    ["S series 25–30 mm", "40 MPa"],
    ["S series 38 mm", "31.5 MPa"],
    ["ORFS ISO 8434-3", "40 … 63 MPa (by size)"],
    ["Assembly", "Cutting ring: hand tight + 1½ turns (example, by maker) or pre-assembly machine"],
    ["Material", "Steel Zn-Ni (Cr VI free), stainless 1.4571"]
  ] },
  tables: [{ t: "Port threads", h: ["Standard", "Thread", "Seal", "Note"], r: [
    ["ISO 1179 (BSPP)", "G 1/8 … G 2", "ED ring / bonded seal / metal edge", "Most common in Europe"],
    ["ISO 6149-1 (metric)", "M8×1 … M60×2", "O-ring in thread undercut", "Preferred new standard; port has a marking ring"],
    ["ISO 9974 (metric)", "M10×1 … M48×2", "ED ring / edge", "Older metric"],
    ["ISO 11926 (SAE)", "7/16-20 UNF … 2-1/2-12 UN", "O-ring", "US machines"],
    ["NPT / R (taper)", "–", "Thread sealant", "Avoid in hydraulics"]
  ] }],
  sel: { f: ["Fitting rating (series, size) ≥ max pressure incl. peaks", "Tube OD and wall must match the fitting (support sleeve for thin walls / stainless)"], ex: ["Pressure line 15 × 2.5 at 10 MPa (peak 14.9 MPa rod side) → L15 (25 MPa) ✓", "21 MPa press line 20 × 2.5 → S20 (40 MPa)"] },
  mount: ["Cut tube square (saw / tube cutter, no pipe cutter wheel), deburr, clean.", "Oil threads and ring; assemble with the maker's turns or machine; mark the nut.", "Do not over-tighten (ring crushes) – leak afterwards.", "Elbows with adjustable stud (banjo / locknut) for orientation."],
  fail: [
    ["Weeping at the nut", "Under / over-tightened ring, tube not square", "Re-make with new ring, use pre-assembly tool"],
    ["Tube pulls out of fitting", "Ring not bitten (no pre-assembly), wrong series", "Pre-assemble correctly, check the cut collar"],
    ["Leak at the port", "Taper thread or wrong seal", "Change to ISO 1179 / ISO 6149 with proper seal"]
  ],
  ask: ["Pressure rating by size and series?", "Assembly instruction and tool (pre-assembly)?", "Soft-seal option?", "Surface coating, salt-spray hours?"],
  std: "ISO 8434-1/-2/-3, ISO 1179, ISO 6149, ISO 9974, ISO 11926"
},
{
  id: "ln_flange", fam: "line", name: "SAE flanges (ISO 6162 code 61 / 62)",
  short: "4-bolt flange connections with O-ring for big lines (≥ 1/2\" to 5\"): pump outlets, cylinders, manifolds.",
  sym: [["line", { kind: "work" }]],
  how: [
    "A flange half (welded, threaded or with a 24° tube connection) is clamped to a flat port face with 4 bolts. The <b>O-ring</b> in the flange face seals. No twisting, easy to dismantle.",
    "<b>Code 61</b> (3000 psi class, ISO 6162-1) and <b>code 62</b> (6000 psi, ISO 6162-2) have different bolt patterns and flange thickness. Port faces per ISO 6164 (square flanges, 25–40 MPa) are also used in Europe.",
    "Split flange (two halves) or one-piece flange; bolt grade ≥ 8.8 (10.9 for code 62)."
  ],
  types: [["Code 61 (ISO 6162-1)", "Up to 35 MPa small sizes, 16 MPa at 3\"."], ["Code 62 (ISO 6162-2)", "42 MPa all sizes 1/2\"–2\"."], ["ISO 6164 square flange", "40 MPa, compact (Europe)."], ["Flange adaptor / elbow / blind flange", "Change direction, close a port."]],
  data: { h: ["Size (DN)", "Code 61 p max", "Code 61 bolts", "Code 62 p max", "Code 62 bolts"], r: [
    ["1/2\" (13)", "35 MPa", "M8", "42 MPa", "M8"], ["3/4\" (19)", "35 MPa", "M10", "42 MPa", "M10"], ["1\" (25)", "35 MPa", "M10", "42 MPa", "M12"],
    ["1¼\" (32)", "28 MPa", "M10", "42 MPa", "M14"], ["1½\" (38)", "21 MPa", "M12", "42 MPa", "M16"], ["2\" (51)", "21 MPa", "M12", "42 MPa", "M20"],
    ["2½\" (64)", "17.5 MPa", "M12", "–", "–"], ["3\" (76)", "14–16 MPa", "M16", "–", "–"]
  ] },
  sel: { f: ["Choose size by velocity (d = 4.61 · √(Q/v)), then code by pressure"], ex: ["Pump outlet 160 L/min at 5 m/s → d = 4.61 · √32 = 26 mm → 1\" flange; 21 MPa → code 61 (35 MPa) ✓"] },
  mount: ["Clean flat port face (Ra ≤ 1.6 µm), new O-ring, grease lightly.", "Tighten bolts crosswise in 2–3 steps to the maker's torque.", "Do not use the flange to pull a misaligned pipe into place."],
  fail: [["O-ring extruded, leak", "Uneven bolt tightening, gap", "Tighten crosswise, check flatness"], ["Bolt failure", "Wrong grade / code 61 bolts on code 62", "Correct bolts"]],
  ask: ["Code 61 or 62 port on the pump / valve?", "Bolt torque, O-ring material (NBR / FKM)?", "Weld or threaded flange material?"],
  std: "ISO 6162-1/-2, SAE J518, ISO 6164"
},
{
  id: "ln_qc", fam: "line", name: "Quick couplings",
  short: "Couplings that connect / disconnect a hose without tools and close both sides (check valves) – for test equipment, tools, exchangeable units.",
  sym: [["qc", {}]],
  how: [
    "Two halves (male nipple + female coupler) each with a <b>check valve</b>. When connected, the valves push each other open. When disconnected, both close – little oil loss.",
    "<b>ISO 7241 A / B</b>: poppet or ball valves, cheap, more spill and dirt entry. <b>Flat-face ISO 16028</b>: flat faces, almost no spill, no air inclusion, easy to clean – preferred in industry.",
    "Most couplings must <b>not be connected under pressure</b>. Special types (connect under residual pressure, screw-to-connect) exist for trapped pressure."
  ],
  types: [["ISO 7241-A / -B", "Poppet / ball, general use."], ["Flat-face ISO 16028", "Clean, low spill, standard for tools and test."], ["Screw-type (threaded) coupling", "High pressure 45–70 MPa, impulse, connect under pressure."], ["Multi-couplings (plate)", "Several lines at once – exchangeable tools / pallets."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Sizes", "DN 6.3 · 10 · 12.5 · 19 · 25"], ["Working pressure", "25 … 35 MPa (flat face), screw-type 45–70 MPa"],
    ["Rated flow", "DN 6.3 ≈ 12 L/min · DN 10 ≈ 23 · DN 12.5 ≈ 45 · DN 19 ≈ 100 · DN 25 ≈ 190 L/min"],
    ["Δp at rated flow", "≈ 0.1–0.3 MPa (connected)"], ["Spillage per disconnect", "Flat-face ≈ 0.01–0.02 mL, poppet ≈ 1–5 mL"], ["Seals", "NBR, FKM, PU"]
  ] },
  sel: { f: ["Δp ≈ Δp_rated · (Q / Q_rated)²"], ex: ["DN 10 flat face: Δp 0.2 MPa at 23 L/min → at 18.7 L/min: 0.2 · (18.7/23)² = 0.13 MPa"] },
  mount: ["Dust caps on both halves when disconnected.", "Mark / code halves so P and T cannot be swapped (different sizes or colours).", "Relieve pressure before disconnecting (thermal expansion in a closed hose!)."],
  fail: [["Cannot connect", "Trapped pressure in the hose (heat)", "Pressure-release coupling or relieve"], ["Dirt in system after tool change", "Unclean couplings (poppet type)", "Flat-face, clean and cap"], ["Flow restriction, hot oil", "Coupling undersized or partly engaged", "Bigger size, check engagement"]],
  ask: ["Connect under pressure possible?", "Δp curve, spill volume?", "Interchangeability standard (ISO 16028 / 7241)?"],
  std: "ISO 7241, ISO 16028, ISO 14540 (screw)"
},
{
  id: "ln_manifold", fam: "line", name: "Manifolds and subplates (ISO 4401 patterns)",
  short: "Machined blocks that carry valves and connect them with drilled channels instead of pipes – fewer leaks, compact, clean.",
  sym: [["dv", { ways: 4, pos: ["par", "closed", "cross"], l: "sol", r: "sol" }], ["line", { kind: "junction" }]],
  how: [
    "Valves with standard mounting faces (<b>ISO 4401</b> for directional valves, ISO 5781 pressure valves, ISO 6263 flow valves, cartridge cavities ISO 7789 / 7368) sit on a <b>subplate</b> (one valve, side ports) or a <b>manifold block</b> (many valves, internal drillings).",
    "<b>Sandwich (modular) valves</b> – pressure, flow, check valves with the same ISO 4401 pattern – are stacked between the subplate and the directional valve: a full axis without pipes.",
    "Design rules: wall between drillings ≥ 3–5 mm (more for high pressure), cross drillings with plugs (ball / screw plugs), avoid dead ends (air, dirt), deburr and clean all intersections (flush, inspect with endoscope), test 1.5 × p."
  ],
  types: [["Single subplate", "One valve, side or bottom ports."], ["Bar manifold (multi-station)", "2–10 NG6/NG10 stations with common P and T."], ["Custom manifold block", "Whole circuit in one block, cartridges + ISO 4401 faces."], ["Sandwich stack", "Directional valve + modular valves on one station."]],
  data: { h: ["ISO 4401 pattern", "Size", "Port Ø max", "Bolts", "Flow (example)"], r: [
    ["4401-03 (CETOP 03)", "NG6", "7.5 mm", "4 × M5", "60–80 L/min"],
    ["4401-05 (CETOP 05)", "NG10", "11.2 mm", "4 × M6", "100–120 L/min"],
    ["4401-07 (CETOP 07)", "NG16", "20 mm", "4 × M10 + 2 × M6", "300 L/min"],
    ["4401-08 (CETOP 08)", "NG25", "24 mm", "6 × M12", "650 L/min"],
    ["4401-10 (CETOP 10)", "NG32", "32 mm", "6 × M20", "1100 L/min"]
  ] },
  tables: [{ t: "Manifold materials (example)", h: ["Material", "Max pressure", "Note"], r: [
    ["Steel C45 / S355 / 1.0503", "35 MPa", "Standard, phosphated or nickel plated"],
    ["Ductile iron EN-GJS-400 / 500", "31.5 MPa", "Good machinability, damping, check porosity"],
    ["Aluminium 6082 / 2007", "≈ 21 MPa", "Light, low pressure, anodised"],
    ["Stainless 1.4404", "35 MPa", "Water glycol, food"]
  ] }],
  sel: { f: ["Channel diameter by velocity (pressure 4–6 m/s, return 2–4 m/s)", "Min wall between drillings: s ≥ p · d / (2 · σ_allow) and ≥ 3–5 mm", "Mounting face: flatness ≤ 0.01 mm / 100 mm, Ra ≤ 0.8 µm"], ex: ["NG6 station, 18.7 L/min at 4 m/s → channel 10 mm; wall at 10 MPa: 10 · 10 / (2 · 60) = 0.8 mm → use ≥ 4 mm (machining tolerance, cross drillings)"] },
  mount: ["Mount the block on a stiff plate, valve faces accessible for change.", "Label every station and port with the circuit diagram codes (e.g. 1V1).", "Gauge / test points (Minimess) on P, A, B of each station.", "Flush block before valves are fitted (flushing plates instead of valves)."],
  fail: [["Leak between stations / cross-talk", "Wall too thin, porosity (cast)", "Pressure test, redesign drillings"], ["Valve malfunctions after start", "Burrs / chips in drillings", "Deburr, high-pressure wash, endoscope"], ["Leak at valve face", "Face not flat, O-ring missing", "Lap face, correct O-rings"]],
  ask: ["Drilling drawing / 3D model and pressure test report?", "Cleanliness after manufacture (ISO 16232 / ISO 4406 of flushing)?", "Material and coating?", "Sandwich valve availability for my NG?"],
  std: "ISO 4401, ISO 5781, ISO 6263, ISO 7368, ISO 7789, ISO 16232"
},
{
  id: "ln_rotary", fam: "line", name: "Rotary unions (rotary joints)",
  short: "Transfers oil from a fixed part to a rotating part (rotary table, clamping on a turning spindle, index tables) through several separate passages.",
  sym: [["rotary", {}]],
  how: [
    "A rotor turns inside a stator. Each passage has a ring groove; <b>seals</b> between the grooves separate the passages. Oil enters the stator, fills the groove all round, and leaves through a drilling in the rotor.",
    "Seal types: <b>PTFE rotary seals</b> (almost leak-free, friction torque, limited speed), <b>gap seals</b> (no contact, high speed, constant leakage → drain line needed).",
    "For a rotary table (low speed, high pressure, clamping 5 MPa + unclamping) PTFE seals are standard; leak drain to tank between passages. Leakage between passages is critical: a leaking union can unclamp a part!"
  ],
  types: [["PTFE-sealed, 2–12 passages", "Rotary / index tables, low speed, low leakage."], ["Gap-seal (hydrodynamic)", "High speed (spindle clamping cylinders), leak oil drained."], ["Combined hydraulic + air + electric (slip ring)", "Rotary tables with sensors."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Passages", "1 … 12 (more special)"], ["Pressure", "PTFE 21–35 MPa, gap seal ≈ 10 MPa"], ["Speed", "PTFE ≈ 10–300 rpm (by pv value), gap seal up to 3000–10000 rpm"],
    ["Leakage", "PTFE ≈ 0–1 drop/min per seal; gap ≈ 0.1–1 L/min per passage at 10 MPa"], ["Friction torque", "≈ 2 … 30 N·m (PTFE, many passages)"], ["Passage size", "≈ 3 … 25 mm"]
  ] },
  sel: { f: ["Seal limit: p · v (MPa · m/s) ≤ catalogue (e.g. 10–20 for PTFE)", "v = π · d · n / 60000 (d mm, n rpm)"], ex: ["Rotor Ø 80 mm, 30 rpm → v = π · 80 · 30 / 60000 = 0.126 m/s; at 5 MPa p·v = 0.63 ✓"] },
  mount: ["Drive the rotor with a flexible driver (no radial forces on the union).", "Leak / drain port to tank without back pressure.", "Filter oil well (16/14/11) – seals hate dirt."],
  fail: [["Clamp pressure drops / unclamps", "Worn seal between passages (cross leak)", "Pressure-hold test each passage, change seals"], ["Leakage increases, oil on table", "Seal wear, drain blocked", "Clear drain, change seals"], ["Union rotates with table, hoses twist", "Bearing seized / friction too high", "Check bearings, torque arm"]],
  ask: ["Leakage per passage at my pressure and speed?", "Friction torque?", "Seal life in revolutions / hours?", "Drawings of the rotor interface?"],
  std: "Maker standard; EN ISO 4413"
},
/* ================================================================ SENSORS */
{
  id: "sn_ptrans", fam: "sens", name: "Pressure transducer (transmitter)",
  short: "Electronic sensor that turns pressure into an analog signal (4–20 mA / 0–10 V) or IO-Link for the PLC – for monitoring, closed loop control and diagnostics.",
  sym: [["ptrans", {}]],
  how: [
    "A thin steel diaphragm with <b>strain gauges</b> (thin-film or piezo-resistive) bends with pressure. Electronics turn this into a standard signal.",
    "<b>4–20 mA (2-wire)</b> is preferred in factories: robust against noise, <b>wire break = 0 mA</b> is detected (live zero). Scaling: <code>p = (I − 4) / 16 · p_range</code>.",
    "Choose the range ≈ <b>1.5–2 × working pressure</b> (accuracy is in % of full scale) but check the overpressure limit against pressure peaks."
  ],
  types: [["4–20 mA 2-wire", "Standard."], ["0–10 V 3-wire", "Short cables, simple."], ["IO-Link / switch outputs", "Digital, with 2 switch points + analog."], ["Ratiometric 0.5–4.5 V", "Mobile machines."]],
  data: { h: ["Property", "Range (example)"], r: [
    ["Ranges", "0–10 · 16 · 25 · 40 · 60 · 100 · 160 · 250 · 400 · 600 bar"], ["Accuracy", "± 0.25 … 0.5 % FS (incl. non-linearity, hysteresis)"],
    ["Overpressure", "2–3 × range"], ["Burst", "≥ 4–10 × range"], ["Response time", "≤ 1–4 ms"], ["Temperature error", "± 0.1–0.2 % FS / 10 K"],
    ["Supply", "8–30 V DC"], ["Connection", "G 1/4 (ISO 1179), M12 plug, IP67"], ["Load (4–20 mA)", "R_L ≤ (U_b − 8 V) / 0.02 A"]
  ] },
  sel: { f: ["p = (I − 4) / 16 · p_range", "Range ≈ 1.5–2 × working pressure; overpressure ≥ peak", "Max loop resistance R_L = (U_b − U_min) / 0.02 A"], ex: ["Range 0–250 bar, I = 12 mA → p = (12 − 4)/16 · 250 = 125 bar", "Docs/25: 10 MPa system, rod side 14.9 MPa → range 0–250 bar (overpressure 500 bar) ✓", "24 V supply, U_min 8 V: R_L ≤ (24 − 8)/0.02 = 800 Ω"] },
  mount: ["On a test point or with a damping orifice (0.5–0.8 mm) where pressure peaks occur.", "Shielded cable, shield at the PLC side.", "Not at the highest point of a line (air) or directly at a fast valve (peaks).", "PLC: wire break check (I < 3.6 mA) and over-range (I > 20.5 mA)."],
  fail: [["Signal jumps / noise", "Pressure peaks, EMC", "Damping orifice, shielded cable, filter in PLC"], ["Sensor dead after peak", "Overpressure (cavitation peaks, water hammer)", "Higher overpressure rating, snubber"], ["Offset at 0 bar", "Diaphragm damaged / temperature", "Calibrate, check against gauge"]],
  ask: ["Accuracy total error band over temperature?", "Overpressure / burst?", "Response time, output options (IO-Link)?", "Calibration certificate?"],
  std: "IEC 60770, IEC 61131-2, EN 61326 (EMC)"
},
{
  id: "sn_temp", fam: "sens", name: "Temperature sensor (PT100 / PT1000 / switch)",
  short: "Measures oil temperature for heater / cooler control, alarms and viscosity compensation.",
  sym: [["temp", {}]],
  how: [
    "<b>PT100</b> = platinum resistance, 100 Ω at 0 °C, rises ≈ 0.385 Ω/K: <code>R ≈ 100 · (1 + 0.00385 · T)</code>. PT1000 = 10 × higher, less error from cable resistance. Use 3- or 4-wire or a head transmitter 4–20 mA.",
    "Bimetal switches (fixed point, cheap) for simple alarms; thermocouples are rare in hydraulics.",
    "Mount in a thermowell so the sensor can be changed without draining."
  ],
  types: [["PT100 / PT1000 with transmitter 4–20 mA", "Standard measurement."], ["Bimetal switch", "Fixed alarm points."], ["Combined with level switch", "See level_temp."], ["Electronic with display + outputs", "Set points free, IO-Link."]],
  data: { h: ["Property", "Range (example)"], r: [["Range", "−20 … +120 °C"], ["Accuracy", "Class B ± (0.3 + 0.005·|T|) K; class A ± (0.15 + 0.002·|T|) K"], ["Response t90", "3 … 15 s (thermowell slower)"], ["Connection", "G 1/4 – G 1/2, M12, IP67"], ["Pressure", "Thermowell up to 40 MPa"]] },
  sel: { f: ["R(T) ≈ R0 · (1 + 0.00385 · T)"], ex: ["PT100 at 50 °C: R = 100 · (1 + 0.00385 · 50) = 119.25 Ω", "Class B error at 50 °C: 0.3 + 0.005 · 50 = 0.55 K"] },
  mount: ["In the tank suction zone or in the return line (fastest response to heat).", "Immersion depth ≥ 10 × sensor diameter."],
  fail: [["Reading too low / slow", "Sensor in dead zone / not immersed", "Move to flowing oil"], ["Jumps", "2-wire long cable, loose contact", "3/4-wire or transmitter"]],
  ask: ["Accuracy class, response time?", "Thermowell pressure rating?", "Output (PT100 / 4–20 mA / IO-Link)?"],
  std: "IEC 60751"
},
{
  id: "sn_level", fam: "sens", name: "Level sensors and sight glass",
  short: "Shows / measures the oil level in the tank: sight glass (visual), float switch, continuous level transmitter.",
  sym: [["level", {}]],
  how: [
    "<b>Sight glass</b> with min / max marks (and often a thermometer) – always fit one, it is the operator's first check.",
    "<b>Float switches</b> (magnet float + reed contacts) give min / min-min signals. <b>Continuous</b> sensors (magnetostrictive, float chain with resistors, ultrasonic, capacitive) give 4–20 mA for leak detection and trends.",
    "A slow level drop over days = external leak; level drop when cylinders extend is normal (rod volumes) – the PLC must know the expected volume."
  ],
  types: [["Sight glass / level gauge", "Visual."], ["Float switch", "Alarms."], ["Magnetostrictive transmitter", "± 1 mm, continuous."], ["Ultrasonic (top-mounted)", "No contact, foam disturbs."]],
  data: { h: ["Property", "Range (example)"], r: [["Sight glass length", "76 · 127 · 254 mm (screw spacing)"], ["Float switch accuracy", "± 3–5 mm"], ["Continuous accuracy", "± 1 mm (magnetostrictive), ± 0.5 % (ultrasonic)"], ["Output", "Contacts / 4–20 mA / IO-Link"], ["Temperature", "−20 … +100 °C"]] },
  sel: { f: ["ΔV = A_tank · Δh"], ex: ["Tank 600 × 400 mm floor: A = 0.24 m² → 1 mm level = 0.24 L; all cylinders out (0.62 L) → level drop 2.6 mm"] },
  mount: ["Calm zone, with damping tube.", "Visible from the operator side.", "Mark min / max with oil at the right temperature."],
  fail: [["False alarm low level", "Foam, waves", "Damping tube, calm zone"], ["Sight glass leaks / broken", "Impact, over-tightened", "Guard, correct torque"]],
  ask: ["Output and accuracy?", "Mounting length, flange?", "Material compatible with my fluid?"],
  std: "EN ISO 4413"
},
{
  id: "sn_flow", fam: "sens", name: "Flow meter",
  short: "Measures oil flow – for commissioning, diagnostics (pump wear, internal leakage) and closed-loop speed control.",
  sym: [["flowmeter", {}]],
  how: [
    "<b>Gear-type (positive displacement)</b>: two gears turn with the flow, a sensor counts teeth – very accurate, also at low flow and high viscosity. <b>Turbine</b>: rotor speed ∝ flow, needs straight pipe, viscosity sensitive. <b>Vortex / ultrasonic</b>: no moving parts, for larger flows.",
    "Portable <b>hydraulic testers</b> combine flow + pressure + temperature and a loading valve: you can measure a pump's flow at pressure and see its volumetric efficiency.",
    "Pump wear test: <code>η_v = Q_measured at p / Q_measured at ~0 bar</code>."
  ],
  types: [["Gear (oval gear) meter", "0.01–600 L/min, ± 0.3–0.5 %."], ["Turbine", "1–750 L/min, ± 1 %, viscosity matters."], ["Variable-area (float / spring)", "Simple indicator, ± 2–5 %."], ["Hydraulic tester (portable)", "Commissioning and diagnostics."]],
  data: { h: ["Property", "Range (example)"], r: [["Flow ranges", "0.05–10 · 1–60 · 5–300 · 15–600 L/min"], ["Accuracy", "Gear ± 0.3–0.5 % of reading, turbine ± 1 % FS"], ["Pressure", "31.5–42 MPa"], ["Δp", "≤ 0.1–0.5 MPa at full flow"], ["Output", "Pulse, 4–20 mA, display"]] },
  sel: { f: ["η_v = Q(p) / Q(0)", "Pump: Q_theor = V_g · n / 1000"], ex: ["Gear pump 14 cm³ at 1450 rpm: Q_theor = 20.3 L/min; measured 18.7 L/min at 10 MPa → η_v = 0.92 (OK); < 0.85 → worn"] },
  mount: ["Install in the line with tester valve downstream (loading valve).", "Turbine: ≥ 10 × d straight inlet, 5 × d outlet.", "Pulse sensors: shielded cable."],
  fail: [["Reading too high / unstable", "Air in oil, pulsation", "Bleed, damping"], ["Turbine reads wrong", "Viscosity different from calibration", "Gear meter or viscosity correction"]],
  ask: ["Accuracy across my viscosity range?", "Max Δp and pressure?", "Calibration certificate?"],
  std: "ISO 4409 (pump test), ISO 9110"
},
{
  id: "sn_test", fam: "sens", name: "Test points (Minimess-style) and measuring hoses",
  short: "Small check-valve ports where you connect a gauge or transducer under pressure – needed on every pump, valve station and actuator.",
  sym: [["testpoint", {}]],
  how: [
    "A test point is a small fitting with a <b>check valve</b> and a dust cap. You screw a measuring hose (with a pin) onto it – even under pressure up to 40–63 MPa – and read the pressure with a gauge or transducer.",
    "Threads: <b>M16 × 2</b> (most common), <b>M16 × 1.5</b>, M14 × 1.5 (smaller). Do not mix systems.",
    "Without test points, fault finding means opening lines (oil, dirt, time). Rule: P, A, B of every station, pump outlet, LS line, accumulator, pilot lines, before / after filters."
  ],
  types: [["Screw-on test point (M16×2)", "Standard, connect under pressure."], ["Push-in / plug type", "Faster, lower pressure."], ["Test point with bleed", "Bleeding air from high points."], ["Micro-bore measuring hose", "2 mm bore, 0.5–4 m, up to 63 MPa."]],
  data: { h: ["Property", "Range (example)"], r: [["Thread", "M16 × 2 · M16 × 1.5 · M14 × 1.5"], ["Pressure", "40 … 63 MPa"], ["Port", "G 1/8 … G 1/2, M10 … M22 (ISO 1179 / ISO 6149)"], ["Hose", "Micro-bore 2 mm, 40–63 MPa, lengths 0.4–4 m"], ["Seals", "NBR / FKM"]] },
  sel: { f: ["Pressure rating of point + hose ≥ max pressure incl. peaks"], ex: ["21 MPa unit, peaks 28 MPa → 40 MPa test points ✓"] },
  mount: ["Easy access, labelled (e.g. 'MP1 pump P'), listed in the hydraulic diagram.", "Caps on – dirt entry point otherwise.", "Use as oil sample point (with sampling valve)."],
  fail: [["Leak at test point", "Check valve dirty / damaged", "Replace insert"], ["Cannot connect", "Wrong thread system", "Standardise on M16 × 2"]],
  ask: ["Thread system, pressure rating?", "Measuring hose kit with gauges?"],
  std: "ISO 15171-1/-2"
},
{
  id: "sn_gauge", fam: "sens", name: "Pressure gauge",
  short: "Mechanical dial gauge (Bourdon tube) showing pressure on the machine; glycerin-filled and damped against pulsation.",
  sym: [["gauge", {}]],
  how: [
    "A curved <b>Bourdon tube</b> straightens with pressure and turns the pointer. <b>Glycerin filling</b> damps vibration and pointer fluttering; a <b>damping screw / snubber</b> (small orifice) protects against pressure peaks.",
    "Choose range ≈ <b>1.5–2 × working pressure</b>: the pointer then works in the middle third (best accuracy, longest life).",
    "<b>Gauge isolator</b> (push-button valve) connects the gauge only when you press it – the gauge sees no peaks in normal operation. A <b>gauge selector</b> lets one gauge read several points."
  ],
  types: [["Glycerin-filled Bourdon gauge, class 1.6", "Standard on HPUs."], ["Class 1.0 / 0.6", "More precise, test equipment."], ["Gauge with electrical contacts", "Simple switch function."], ["Digital gauge", "Peak memory, test sets."]],
  data: { h: ["Property", "Range (example)"], r: [["Dial", "Ø 40 · 63 · 100 · 160 mm"], ["Ranges", "0–16 · 25 · 40 · 60 · 100 · 160 · 250 · 400 · 600 bar"], ["Accuracy class", "1.0 / 1.6 / 2.5 (% of full scale)"], ["Connection", "G 1/4 bottom or back, M20×1.5"], ["Filling", "Glycerin (or silicone oil for cold)"], ["Overload", "≈ 1.3 × range (short)"]] },
  sel: { f: ["Range ≈ 1.5–2 × working pressure", "Error = class % · full scale"], ex: ["Docs/25: 10 MPa = 100 bar → range 0–160 bar (×1.6); class 1.6 error = 0.016 · 160 = ± 2.6 bar"] },
  mount: ["Vertical dial, readable from the operator position.", "With damping screw and isolator valve.", "Not directly on the pump outlet without damping."],
  fail: [["Pointer does not return to 0", "Bourdon tube over-stretched by peaks", "Replace, add snubber / isolator"], ["Pointer flutters", "No damping", "Snubber, glycerin filling"], ["Glycerin leaks", "Seal / temperature", "Replace gauge"]],
  ask: ["Accuracy class, range, dial size?", "Damping and isolator included?"],
  std: "EN 837-1"
},
/* ================================================================ FLUIDS */
{
  id: "fd_types", fam: "fluid", name: "Hydraulic fluid types (HLP, HVLP, HFC, HFD, HEES …)",
  short: "Which fluid for which machine: mineral oils, fire-resistant fluids and biodegradable fluids – with their limits on temperature, seals and components.",
  sym: [["tank", {}]],
  how: [
    "The fluid transmits power, lubricates, cools and protects against corrosion. Most industrial machines use <b>HLP</b> (mineral oil with anti-wear, anti-oxidation and anti-corrosion additives, DIN 51524-2 / ISO 6743-4 HM).",
    "<b>Fire-resistant</b> fluids (HF…) are used near hot metal, furnaces, die casting, mines. They have worse lubrication → pumps derated (pressure, speed), different seals and paints.",
    "<b>Biodegradable</b> fluids (HE…, ISO 15380) for outdoor / water areas. Changing a system to another fluid type needs flushing and a compatibility check of seals, paint, filters and hoses."
  ],
  types: [
    ["HL", "Mineral oil + anti-corrosion / anti-oxidation, no anti-wear – low-pressure systems."],
    ["HLP (HM)", "HL + anti-wear (zinc or ash-free). Standard industry."],
    ["HVLP (HV)", "HLP with high viscosity index (VI ≥ 140) – big temperature range, outdoor."],
    ["HLPD", "HLP with detergent / dispersant – holds water and dirt in suspension (machine tools with coolant ingress)."],
    ["HFAE", "Oil-in-water emulsion (> 80 % water) – mines, low pressure."],
    ["HFC", "Water glycol (35–50 % water) – die casting, steel mills."],
    ["HFD-R / HFD-U", "Phosphate ester / synthetic water-free – power stations, aviation-like."],
    ["HEES / HEPG / HETG", "Synthetic ester / polyglycol / vegetable – biodegradable."]
  ],
  data: { h: ["Fluid", "Temp. range [°C]", "Seals", "Fire res.", "Rel. cost", "Pump derating (example)"], r: [
    ["HLP", "−10 … +80 (90)", "NBR, PU, FKM", "no", "1", "none"],
    ["HVLP", "−30 … +90", "NBR, PU, FKM", "no", "1.3–1.5", "none"],
    ["HFAE", "+5 … +50", "NBR", "yes", "0.3", "strong: ≤ 10–16 MPa, low speed"],
    ["HFC", "−20 … +60", "NBR, FKM (no PU!)", "yes", "2–3", "p ≈ −30 %, n ≤ 1500 rpm, no Al/Zn"],
    ["HFD-R", "−20 … +100", "FKM (no NBR!)", "yes", "5–8", "small"],
    ["HFD-U", "−20 … +100", "FKM, check", "yes", "4–6", "small"],
    ["HEES", "−25 … +80", "FKM, NBR (check), PU (check hydrolysis)", "no", "2–3", "none to small"],
    ["HEPG", "−20 … +80", "FKM, NBR – not compatible with mineral oil", "no", "2–3", "small"]
  ] },
  sel: { f: ["Choose fluid by fire risk → environment risk → temperature range → component approvals"], ex: ["Indoor machine tool, 20–55 °C: HLP 46 (or HLPD if coolant ingress)", "Outdoor −20 … +40 °C: HVLP 46", "Die casting near melt: HFC with derated pumps"] },
  mount: ["Label tank and filler: fluid type and grade.", "Never mix fluid types (HFC + mineral oil = sludge).", "Fill only through a filter (new oil is dirty)."],
  fail: [["Seals swell / shrink, leaks", "Seal material incompatible with fluid", "Change seals (e.g. FKM for HFD)"], ["Pump wear with HFC", "Not derated, water content too low/high", "Derate, check water content 35–50 %"], ["Sludge in filters", "Mixed fluids", "Drain, flush, refill one type"]],
  ask: ["Are pumps / valves approved for this fluid (derating)?", "Seal and paint compatibility?", "Fluid data sheet: VI, pour point, air release, demulsibility?"],
  std: "ISO 6743-4, DIN 51524-1/-2/-3, ISO 11158, ISO 12922, ISO 15380, ISO 7745"
},
{
  id: "fd_visc", fam: "fluid", name: "Viscosity classes and temperature",
  short: "Viscosity grade (ISO VG), how viscosity changes with temperature, and the allowed viscosity range for pumps and the system.",
  sym: [["temp", {}]],
  how: [
    "<b>ISO VG</b> number = mean kinematic viscosity in mm²/s (cSt) at <b>40 °C</b>, ± 10 %. Example VG 46 = 41.4 … 50.6 mm²/s.",
    "Viscosity falls strongly with temperature. The <b>viscosity index (VI)</b> tells how strongly: VI 100 (normal HLP), VI ≥ 140 (HVLP, flatter). The Ubbelohde–Walther relation is a straight line in a special chart: <code>lg lg(ν + 0.7) = A − B · lg T</code> (T in K).",
    "Pump limits (typical): <b>optimum 16–36 mm²/s</b>, <b>min ≈ 10</b> (short 7), <b>max at cold start ≈ 800–1000 mm²/s</b>. Choose the grade so that the working temperature gives the optimum range."
  ],
  types: [["VG 22", "Cold climate, small clearances, low temperature."], ["VG 32", "Machine tools, indoor, 30–50 °C."], ["VG 46", "Standard industry 40–60 °C."], ["VG 68", "Hot environment, heavy loads, 50–70 °C."], ["VG 100", "Very hot / slow, rare in hydraulics."]],
  data: { h: ["ISO VG", "ν at 40 °C (mean)", "Range at 40 °C", "Optimum 16–36 mm²/s at ≈ (VI 100)"], r: [
    ["10", "10", "9.0 – 11.0", "≈ 12 … 29 °C"], ["15", "15", "13.5 – 16.5", "≈ 20 … 38 °C"], ["22", "22", "19.8 – 24.2", "≈ 29 … 49 °C"],
    ["32", "32", "28.8 – 35.2", "≈ 37 … 58 °C"], ["46", "46", "41.4 – 50.6", "≈ 45 … 68 °C"], ["68", "68", "61.2 – 74.8", "≈ 54 … 78 °C"], ["100", "100", "90 – 110", "≈ 63 … 89 °C"]
  ] },
  tables: [{ t: "VG 46 (VI 100) worked with the Walther line – example", h: ["Point", "ν [mm²/s]", "Temperature"], r: [
    ["Data 1", "46", "40 °C"], ["Data 2", "6.8", "100 °C"], ["Cold-start limit", "800", "≈ −4 °C"], ["Upper optimum", "36", "≈ 45 °C"], ["Working (docs/25)", "≈ 30", "50 °C"], ["Lower optimum", "16", "≈ 68 °C"], ["Minimum", "10", "≈ 84 °C"]
  ], note: "Line: B = (lglg 46.7 − lglg 7.5) / (lg 373.15 − lg 313.15) = (0.2225 + 0.0579) / 0.0761 = 3.685; A = 0.2225 + 3.685 · 2.4958 = 9.419." }],
  sel: { f: ["lg lg(ν + 0.7) = A − B · lg T  (T [K] = °C + 273.15)", "Two data points (40 and 100 °C) give A and B"], ex: ["VG 46: B = 3.685, A = 9.419", "ν = 36 → lglg 36.7 = 0.1944 → lg T = (9.419 − 0.1944)/3.685 = 2.5032 → T = 318.6 K = 45 °C", "ν = 800 → lglg 800.7 = 0.4629 → lg T = 2.4304 → T = 269.4 K = −4 °C (below: preheat)"] },
  chart: "visc",
  mount: ["Name the grade on the tank label and in the manual.", "Preheat (heater) or no-load warm-up below the cold-start limit."],
  fail: [["Pump noise at cold start", "Viscosity > 800–1000 (cavitation)", "Heater, lower VG, HVLP"], ["Leakage up, slow at hot", "Viscosity < 10–16", "Cooler, higher VG"], ["Viscosity dropped over time", "Shear loss of VI improver (HVLP) / contamination", "Oil analysis, shear-stable oil"]],
  ask: ["Viscosity limits of each pump / motor (min, optimum, max start)?", "VI of the oil, shear stability?", "Pour point?"],
  std: "ISO 3448, ISO 2909 (VI), DIN 51524"
},
{
  id: "fd_water", fam: "fluid", name: "Water content and oil analysis",
  short: "How much water an oil may contain and what an oil laboratory measures – the basis of condition-based oil change.",
  sym: [["testpoint", {}]],
  how: [
    "Mineral oil dissolves only a little water (<b>saturation ≈ 200–400 ppm at 40 °C</b> for HLP, more when hot). Above saturation the water is <b>free</b> (milky oil, drops in the tank bottom): rust, additive loss, cavitation, bearing fatigue, filter clogging.",
    "Limits (example): target <b>&lt; 200 ppm</b> (0.02 %); warning 300–500 ppm; servo systems &lt; 100–200 ppm. Water sensors measure relative saturation (%) online.",
    "<b>Oil analysis</b> (every 1000–2000 h or 6 months, and after problems): particle count ISO 4406, water (Karl Fischer), viscosity at 40 °C, acid number (TAN – oxidation), elements by ICP (wear metals Fe Cu Cr Al Pb Sn, contaminants Si Na, additives Zn P Ca). Trends matter more than one value."
  ],
  types: [["Laboratory analysis", "Full picture, 1–2 weeks."], ["Online particle / water sensor", "Continuous, trend in SCADA."], ["Crackle test / patch test", "Quick check on site."]],
  data: { h: ["Parameter", "Warning / change limit (example)"], r: [
    ["Cleanliness ISO 4406", "> target + 2 code steps"], ["Water (Karl Fischer)", "> 500 ppm (0.05 %); servo > 200 ppm"],
    ["Viscosity at 40 °C", "± 10 % from new oil"], ["TAN (acid number)", "+ 0.5–1 mg KOH/g over new oil"],
    ["Iron Fe", "> 20–50 ppm or sudden rise"], ["Copper Cu", "> 20–50 ppm (bronze parts, cooler)"],
    ["Silicon Si", "> 10–15 ppm (dust – check breather)"], ["Zinc / phosphorus (additive)", "−25 % from new oil"], ["Oil temperature history", "Every +10 K above 60 °C ≈ halves oil life"]
  ] },
  tables: [{ t: "Sampling procedure (ISO 4021 style)", h: ["Step", "What"], r: [
    ["1", "Machine running at working temperature, sample from a turbulent line (test point before return filter)."],
    ["2", "Flush the sampling point and hose with ≥ 0.5 L (or 5 × the dead volume) into a waste container."],
    ["3", "Fill a clean certified bottle (ISO 3722) to 80 %, do not open in dusty air."],
    ["4", "Label: machine, point, date, operating hours, oil type, hours since oil change."],
    ["5", "Same point and method every time (trend)."]
  ] }],
  sel: { f: ["ppm = mass fraction · 10⁶; 0.1 % = 1000 ppm", "Water in tank: m_w = ppm · 10⁻⁶ · m_oil"], ex: ["90 L tank (78 kg) at 500 ppm → 78 · 500e-6 = 0.039 kg = 39 mL of water"] },
  mount: ["Permanent sample point with valve and cap, labelled.", "Desiccant breather in humid halls; oil pressure > water pressure in coolers."],
  fail: [["Milky oil", "Free water (cooler leak, condensation, coolant ingress)", "Find source, vacuum dehydrator / change oil"], ["Rising Fe and Cu", "Pump / motor wear", "Plan repair before failure"], ["High silicon", "Dust ingress (breather, rod wiper)", "Better breather, wipers"]],
  ask: ["Laboratory test package and turnaround time?", "Trend report with limits?", "Bottle kit and online sensor options?"],
  std: "ISO 4406, ISO 4021, ISO 3722, ISO 12937 / ASTM D6304 (Karl Fischer), ASTM D5185 (ICP), ISO 6618 (TAN)"
}
];
