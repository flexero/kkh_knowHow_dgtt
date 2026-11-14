/* FMS engineering – item 2, deep sections 2F–2M (fmse2x.js). Data + texts.
 * EX2 = copy of tools/fmse/examples/item2_examples.json – keep in sync (guide docs/62 and tools/fmse/*.py use the same inputs + formulas).
 * All other tables here are typical values / examples written for teaching, not official texts; maker names are examples only (no model numbers). */

/* ================================================================ EX2: copy of tools/fmse/examples/item2_examples.json – keep in sync */
export const EX2 = {
 "_note": "Shared worked-example inputs for FMS engineering item 2 (product -> process -> machines): guide docs/62, tools/fmse/*.py, web/fmse2x*.js. All values are EXAMPLES. Every consumer uses exactly these inputs and the formulas in _formulas so the numbers match.",
 "_formulas": {
  "abc": "sort parts by annual volume (or revenue = volume*price if basis='revenue') descending; cumulative share; class A while cumulative share BEFORE adding the part < 80 %, B while < 95 %, else C",
  "jaccard": "s_jk = a/(a+b+c): a = parts using machine j AND k, b+c = parts using only one of them",
  "slca": "single linkage: join machines j,k when s_jk >= T (and s_jk > 0); cells = connected components; each part goes to the cell where it has most operations (tie -> lowest cell index)",
  "roc": "King's rank order clustering: rows read as binary numbers (leftmost column = highest bit), sort rows descending (stable); then columns read as binary (top row = highest bit), sort descending; repeat until no change (max 20 iterations)",
  "efficacy": "Gamma = (e - e_exc)/(e + e_void)",
  "efficiency": "eta = q*eta1 + (1-q)*eta2, q = 0.5; eta1 = ones inside blocks / cells inside blocks; eta2 = zeros outside blocks / cells outside blocks",
  "it_grade": "use the ISO 286-1 table it_table_um (size range by nominal D: lower < D <= upper; D <= 3 -> first range); required grade = largest k with IT_k <= tolerance width",
  "allowance": "per-side nominal allowance of step i: z_i = z_min_i + T_(i-1)/2  (T in mm on the diameter, T_(i-1) = tolerance of the step before; for i=1 the raw-part tolerance); diameter before step i: D_(i-1) = D_i - 2*z_i (bore) ; start from the mid-tolerance final diameter",
  "turning": "n = 1000*vc/(pi*D); vf = f*n; t_c = passes*L/vf; Pc = kc*ap*f*vc/60000 kW; M = 9550*Pc/n",
  "milling": "n = 1000*vc/(pi*Dc); vf = fz*z*n; t_c = passes*(L + Dc)/vf; Q = ap*ae*vf/1000 cm3/min; Pc = ap*ae*vf*kc/(60e6) kW; M = 9550*Pc/n",
  "drilling": "n = 1000*vc/(pi*D); t_hole = (H + 0.3*D)/(f*n); Pc = f*vc*D*kc/240000 kW",
  "tapping": "n = 1000*vc/(pi*D); t = 2*(H + 2*P)/(P*n)  (in + out at the same speed)",
  "spindle_curve": "available power P_av(n) = min(P_rated, M_max*n/9550); base speed n_b = 9550*P_rated/M_max; check Pc/eta <= P_av(n), eta = 0.8",
  "taylor": "v*T^n = C  -> T = (C/v)^(1/n)",
  "taylor_econ": "T_min_cost = (1/n - 1)*(t_ct + K_t/(M/60)); T_max_prod = (1/n - 1)*t_ct; v = C/T^n  (M = machine+labour rate EUR/h, K_t = tool cost per edge EUR, t_ct = tool change time min)",
  "cooling_time": "t_cool = s^2/(pi^2*alpha) * ln( (8/pi^2) * (T_m - T_w)/(T_e - T_w) )  [s; s in mm, alpha in mm2/s]",
  "clamp_force": "F = p_cav * A_proj * safety  (bar*cm2 -> kN: 1 bar*cm2 = 0.01 kN)",
  "mould_cycle": "t_cycle = t_inject + t_hold + t_cool + t_open_eject_close",
  "bending": "t = n_bends*t_bend + t_handling",
  "welding_arc": "t_arc = L_weld/v_weld",
  "available_hours": "days = 365 - weekend_days - holidays - shutdown_days; h = days*shifts*(shift_h - break_h); h_avail = h*(1 - planned_maint)",
  "load": "L_g = sum Q_i*t_ig/60 + sum ceil(Q_i/lot_i)*t_setup_g/60 ; machines = ceil(L_g/(h_avail*OEE)) ; util = L_g/(machines*h_avail*OEE)",
  "eoq": "Q* = sqrt(2*D*S/H); S = t_setup_h*rate + admin; H = holding_rate*unit_value; total cost = D/Q*S + Q/2*H",
  "takt": "takt = h_avail*3600/demand  [s]",
  "line_balance_rpw": "positional weight = own time + times of all (transitive) successors; assign tasks in descending weight (tie -> lower id) to the current station if all predecessors assigned and fits in takt, else open a new station; efficiency = sum t/(stations*takt); balance delay = 1 - efficiency; min stations = ceil(sum t/takt)",
  "ahp": "weights = normalised geometric means of the rows of the pairwise matrix; lambda_max = mean over i of (A w)_i / w_i; CI = (lambda_max - n)/(n - 1); CR = CI/RI(n); RI = {1:0,2:0,3:0.58,4:0.90,5:1.12,6:1.24,7:1.32}; CR < 0.10 acceptable; score_alt = sum w_k * s_alt,k",
  "lcc": "LCC = purchase + installation + sum_{t=1..years} (energy_t + maintenance_t + tooling_t)/(1+r)^t - residual/(1+r)^years ; energy_t = kW_avg*hours*price; maintenance_t = maint_pct*purchase"
 },
 "pq_parts": {
  "basis": "volume",
  "parts": [["P01 Crankcase VC20", 3000, 180], ["P02 Crankcase VC10", 4000, 150], ["P03 Crankcase VC30", 2000, 230], ["P04 Cylinder", 18000, 40], ["P05 Cylinder head", 9000, 55], ["P06 Crankshaft", 9000, 70], ["P07 Con-rod", 18000, 12], ["P08 Valve plate", 9000, 9], ["P09 Cover", 9000, 6], ["P10 Flywheel", 9000, 25], ["P11 Bracket", 2500, 14], ["P12 Pipe flange", 6000, 4], ["P13 Spacer", 1200, 2], ["P14 Oil sight glass holder", 800, 3], ["P15 Service part kit", 300, 30]]
 },
 "pfa": {
  "machines": ["LATHE", "HMC", "HONE", "DRILL", "GRIND", "VMC", "SAW", "WASH"],
  "parts": ["P01 crankcase A", "P02 shaft S1", "P03 cylinder C1", "P04 crankcase B", "P05 shaft S2", "P06 cylinder C2", "P07 cover K", "P08 pin", "P09 cylinder C3", "P10 bracket"],
  "m": [[0, 1, 0, 1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 1, 0], [0, 0, 1, 1, 0, 1, 0, 0], [0, 1, 0, 1, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0, 1, 0], [0, 0, 1, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0, 0, 1], [1, 0, 0, 0, 0, 0, 1, 0], [0, 0, 1, 0, 0, 1, 0, 0], [0, 1, 0, 0, 0, 0, 0, 1]],
  "T": 0.3,
  "_expected_from_item2_web": "3 cells, e = 27, exceptional 2 (P03->DRILL, P07->GRIND), voids 2, Gamma = 86.2 %"
 },
 "opitz_example": {
  "_note": "Simplified Opitz-style form code (5 digits, rotational parts). Always check the original Opitz tables; this example only shows the method.",
  "part": "Compressor crankshaft blank, L = 320 mm, D = 60 mm, stepped to both ends with thread, centre holes only, one keyway, two radial oil holes not on a pattern",
  "digits": [["1 part class", "L/D = 5.33 >= 3 -> rotational, long", 2], ["2 external shape", "stepped to both ends, with screw thread", 5], ["3 internal shape", "no bore (centre holes do not count)", 0], ["4 plane surface machining", "external groove / slot (keyway)", 3], ["5 auxiliary holes / teeth", "radial holes, not related by a pattern", 3]],
  "code": "25033"
 },
 "it_table_um": {
  "ranges_mm": [[0, 3], [3, 6], [6, 10], [10, 18], [18, 30], [30, 50], [50, 80], [80, 120], [120, 180], [180, 250], [250, 315], [315, 400], [400, 500]],
  "grades": [5, 6, 7, 8, 9, 10, 11, 12, 13],
  "values": [[4, 6, 10, 14, 25, 40, 60, 100, 140], [5, 8, 12, 18, 30, 48, 75, 120, 180], [6, 9, 15, 22, 36, 58, 90, 150, 220], [8, 11, 18, 27, 43, 70, 110, 180, 270], [9, 13, 21, 33, 52, 84, 130, 210, 330], [11, 16, 25, 39, 62, 100, 160, 250, 390], [13, 19, 30, 46, 74, 120, 190, 300, 460], [15, 22, 35, 54, 87, 140, 220, 350, 540], [18, 25, 40, 63, 100, 160, 250, 400, 630], [20, 29, 46, 72, 115, 185, 290, 460, 720], [23, 32, 52, 81, 130, 210, 320, 520, 810], [25, 36, 57, 89, 140, 230, 360, 570, 890], [27, 40, 63, 97, 155, 250, 400, 630, 970]],
  "_source": "ISO 286-1 standard tolerance grades (µm). Check against your copy of the standard."
 },
 "process_chain": {
  "feature": "Bore A Ø52 H7 (52.000 / +0.030), Ra 0.8, cast iron EN-GJL-250, length 60 mm",
  "final_D": 52.015,
  "raw_tol_mm": 2.0,
  "steps": [["Rough boring", 11, 0.3, 6.3], ["Semi-finish boring", 9, 0.1, 3.2], ["Fine boring", 7, 0.05, 0.8]],
  "_steps_cols": "name, IT grade reached, z_min per side [mm], Ra reached [µm]; tolerance T of each step = IT value for D 52 (range 50-80) from it_table_um, in mm"
 },
 "cutting": {
  "materials": [["Steel C45 / 42CrMo4", 1900], ["Cast iron EN-GJL-250", 1100], ["Stainless 1.4301", 2300], ["Aluminium AlSi10Mg", 750]],
  "turning": {"mat": 0, "D": 60, "L": 120, "ap": 2, "f": 0.25, "vc": 200, "passes": 3},
  "milling": {"mat": 1, "Dc": 80, "z": 6, "fz": 0.2, "vc": 160, "ap": 4, "ae": 60, "L": 300, "passes": 2},
  "drilling": {"mat": 1, "D": 10, "H": 30, "f": 0.25, "vc": 100, "holes": 12},
  "tapping": {"D": 10, "P": 1.5, "H": 20, "vc": 12, "holes": 12},
  "spindle": {"P_rated_kW": 18, "M_max_Nm": 120, "n_max": 10000, "eta": 0.8}
 },
 "taylor": {"n": 0.25, "C": 400, "rate_EUR_h": 90, "K_t_EUR": 6.0, "t_ct_min": 1.0},
 "moulding": {
  "s_mm": 2.5,
  "alpha_mm2_s": 0.09,
  "T_m": 230,
  "T_w": 40,
  "T_e": 90,
  "A_proj_cm2": 180,
  "p_cav_bar": 350,
  "safety": 1.2,
  "t_inject_s": 1.5,
  "t_hold_s": 4.0,
  "t_open_s": 5.0
 },
 "bending": {"n_bends": 6, "t_bend_s": 9, "t_handling_s": 20},
 "welding": {"L_weld_mm": 1800, "v_weld_m_min": 0.6},
 "calendar": {"weekend_days": 104, "holidays": 10, "shutdown_days": 10, "shifts": 2, "shift_h": 8.0, "break_h": 0.5, "planned_maint": 0.03},
 "capacity": {
  "groups": [["HMC", 0.75, 20], ["VMC", 0.75, 30], ["Lathe", 0.75, 25], ["Grinder", 0.7, 40], ["Washer", 0.85, 0]],
  "_groups_cols": "name, OEE, set-up min per lot",
  "parts": [["Crankcase VC20", 3000, 30, [36, 0, 0, 0, 2]], ["Crankcase VC10", 4000, 40, [28, 0, 0, 0, 2]], ["Crankcase VC30", 2000, 20, [44, 0, 0, 0, 2]], ["Cylinder", 18000, 120, [0, 6, 0, 0, 1.5]], ["Crankshaft", 9000, 60, [0, 4, 9, 7, 1.5]], ["Flywheel", 9000, 90, [0, 3, 5, 0, 1]]],
  "_parts_cols": "name, annual volume, lot size, minutes per part on each group (same order as groups)"
 },
 "eoq": {"D": 4000, "t_setup_h": 0.333333, "rate_EUR_h": 90, "admin_EUR": 20, "holding_rate": 0.25, "unit_value_EUR": 180},
 "line_balance": {
  "demand_per_year": 120000,
  "hours": 3840,
  "tasks": [["A", "Place housing on carrier", 45, []], ["B", "Press bearing 1", 30, ["A"]], ["C", "Insert crankshaft", 50, ["A"]], ["D", "Press bearing 2", 25, ["B"]], ["E", "Fit con-rods", 40, ["B", "C"]], ["F", "Insert pistons", 35, ["C"]], ["G", "Torque con-rod bolts", 60, ["D", "E"]], ["H", "Fit cylinders", 20, ["E", "F"]], ["I", "Fit valve plates", 45, ["G"]], ["J", "Fit heads", 30, ["H"]], ["K", "Torque head bolts", 55, ["I", "J"]], ["L", "Leak test + label", 25, ["K"]]]
 },
 "ahp": {
  "criteria": ["Technical fit", "Accuracy", "Local service", "Life-cycle cost"],
  "pairwise": [[1, 2, 3, 1], [0.5, 1, 2, 0.5], [0.333333, 0.5, 1, 0.333333], [1, 2, 3, 1]],
  "alternatives": [["Machine A", [8, 7, 6, 7]], ["Machine B", [9, 8, 9, 5]], ["Machine C", [7, 6, 8, 9]]],
  "_scores": "1..10 per criterion"
 },
 "lcc": {
  "years": 10,
  "rate": 0.08,
  "candidates": [["Machine A", 520000, 40000, 14, 0.035, 12000, 52000], ["Machine B", 610000, 45000, 12, 0.025, 11000, 70000], ["Machine C", 450000, 35000, 17, 0.05, 15000, 36000]],
  "_cols": "name, purchase EUR, installation EUR, average power kW, maintenance share of purchase per year, tooling EUR/year, residual EUR after 10 years",
  "hours_per_year": 4500,
  "energy_EUR_kWh": 0.18
 }
};

/* ================================================================ use cases per section: [domain, text] */
export const USES = {
  F: [["Compressor machining (this example)", "15 part numbers, 120 000 parts per year. 7 A-parts (cylinders, con-rods, heads, crankshafts …) carry 80 % of the volume → they justify dedicated or flexible cells with automation; the crankcases (B) run on a pallet FMS; spacers and kits (C) go to the job shop or a supplier."],
    ["Sheet-metal cabinets", "400 part numbers from a laser + press-brake shop. ABC by revenue shows 40 parts = 75 % of the turnover → these get fixed nesting programs and kanban; the long tail is cut on demand from the order list."],
    ["Spare-parts business", "A part can be C by volume but A by revenue (high price, low volume). Run ABC on both bases – volume decides the capacity design, revenue decides where to spend engineering time."]],
  G: [["Compressor shafts and pins", "All rotational parts with code 2x0xx (long, no bore) go to one turning + grinding cell; parts 1x4xx (short, stepped bore) go to a chucker cell. The code tells the planner the cell without reading the drawing."],
    ["Design retrieval", "Before a designer draws a new shaft, he searches the CAD / PLM for parts with the same first 3 digits – often a similar part exists and can be reused (fewer new part numbers, proven process)."],
    ["Fixture and tool families", "Parts with the same digits 2 and 3 can usually share chucks, collets and the same tool set → fewer set-ups when you run them one after the other."]],
  H: [["Bore Ø52 H7 in a crankcase", "Rough – semi-finish – fine boring on one HMC. The allowance chain gives the boring-bar diameters for the tool list and checks that the last step really reaches IT7 / Ra 0.8."],
    ["Bearing seat on a shaft", "Turning – rough grinding – finish grinding. Same method, but for a shaft the diameter becomes smaller after each step (D_before = D_after + 2·z)."],
    ["Routing sheet for a quotation", "Before you ask suppliers, you write the routing (operations, machine, tools, time) – it is the input for capacity (2J), for the RFQ and later for the MES work plan."]],
  I: [["Machining-centre purchase", "The supplier's spindle curve (power and torque over speed) is checked against your heaviest cut: a big face mill at low speed is torque-limited, a small drill at high speed is power-limited."],
    ["Tool cost reduction", "The Taylor economics show that running faster than v_min-cost increases the cost per part (more tool changes), running slower increases machine cost. Use it to set the default cutting data in the CAM library."],
    ["Plastic parts and sheet metal", "Cooling time decides 50–70 % of an injection-moulding cycle → wall thickness is the main design lever. Press-brake time = bends × time per bend + handling → the bend count decides the cost."]],
  J: [["Capacity study for an FMS", "Load per machine group from volumes, times and lot sizes → number of machines and the bottleneck. The HMC group at 99 % utilisation is the signal for a 3rd machine or for shorter set-ups."],
    ["Lot size for a pallet system", "With quick change-over (zero-point clamping, tools stay in the magazine) the set-up cost S falls → EOQ falls → smaller lots, less WIP, faster delivery."],
    ["Shift-model decision", "Change the calendar from 2 to 3 shifts and see how many machines you save – the cost of the night shift against the machine investment."]],
  K: [["Compressor assembly line", "12 tasks, takt 115 s → 5 stations with RPW. The fullest station decides the output; the balance delay (20 %) shows how much idle time the line has."],
    ["Electronics / small appliances", "Many short tasks (5–20 s) → good balancing is easy; the limit is often the test station, which you double in parallel."],
    ["Mixed-model line", "Use the weighted average task time of the models, then check each model separately: a station that is fine on average can overflow with the heavy model."]],
  L: [["Choosing one of three HMC offers", "AHP turns the team's opinions (technical fit vs. accuracy vs. service vs. cost) into numeric weights and checks their consistency; LCC shows the money over 10 years."],
    ["Selecting an AGV supplier", "Same method: criteria navigation, safety, fleet software, service, LCC. The CR check catches contradictory judgements made in the workshop."],
    ["Make or buy of a component", "Alternatives: own machining, supplier A, supplier B; LCC with your own machine hours against purchase price × volume."]],
  M: [["FMS with 3 HMCs", "Use the parameter list as the skeleton of the technical specification (URS chapter 'machine'); every supplier fills the same table → offers can be compared."],
    ["Assembly line", "Screwdriving and press-fit stations: the specification is mostly about the process signal (torque/angle, force/distance curve) and its transfer to the MES, not about the mechanics."],
    ["Sheet-metal shop", "Fibre laser + press brake: specify sheet size, thickness range per material, automation (load/unload, tower storage) and the offline programming software."]],
};

/* ================================================================ 2F: ABC class meaning for the system design */
export const ABC_MEAN = [
  ["A", "≈ 20 % of the parts, ≈ 80 % of volume / revenue", "Dedicated line, flexible transfer line or automated cell (FMC / FMS) – design the system around them; fixture per part; automation pays back.", "Short cycle, stable demand → flow / takt; spend engineering effort on cycle time, Cpk, OEE."],
  ["B", "≈ 30 % of the parts, ≈ 15 % of volume", "FMS / pallet pool shared by part families; group-technology cells; standard fixtures with change parts.", "Batch production; lot size from EOQ (2J); check the set-up time on the bottleneck."],
  ["C", "≈ 50 % of the parts, ≈ 5 % of volume", "Job shop (stand-alone CNC), outsourcing, buy-in or rationalise (merge variants, stop the part).", "Do not design automation for them; keep them out of the main system or run them in free capacity."],
];

/* ================================================================ 2F: BOM example – 2-cylinder compressor VC20: [name, qty per parent, make/buy, children] */
export const BOM = ["Compressor VC20 (end product)", 1, "make", [
  ["Crankcase assembly", 1, "make", [["P01 Crankcase VC20", 1, "make", []], ["Main bearing", 2, "buy", []], ["P14 Oil sight glass holder", 1, "make", []]]],
  ["Crank drive", 1, "make", [["P06 Crankshaft", 1, "make", []], ["P07 Con-rod", 2, "make", []], ["Piston + rings", 2, "buy", []], ["P10 Flywheel", 1, "make", []]]],
  ["Cylinder group", 1, "make", [["P04 Cylinder", 2, "make", []], ["P08 Valve plate", 1, "make", []], ["P05 Cylinder head", 1, "make", []], ["Head gasket", 1, "buy", []]]],
  ["P09 Cover", 1, "make", []],
  ["Bolt kit M8 / M10", 1, "buy", []],
]];

/* ================================================================ 2G: simplified Opitz-style code (rotational parts, digits 1–5) */
export const OPITZ = [
  ["1 · Part class", ["0 rotational, L/D ≤ 0.5 (disc)", "1 rotational, 0.5 < L/D < 3", "2 rotational, L/D ≥ 3 (long)", "3 rotational with deviation, L/D ≤ 2", "4 rotational with deviation, L/D > 2", "5 special rotational", "6 non-rotational, flat", "7 non-rotational, long", "8 non-rotational, cubic", "9 special non-rotational"]],
  ["2 · External shape", ["0 smooth, no shape elements", "1 stepped to one end, no shape elements", "2 stepped to one end, with screw thread", "3 stepped to one end, with functional groove", "4 stepped to both ends, no shape elements", "5 stepped to both ends, with screw thread", "6 stepped to both ends, with functional groove", "7 functional cone", "8 operating thread", "9 all others"]],
  ["3 · Internal shape", ["0 no bore, no breakthrough", "1 smooth bore or stepped to one end, no shape elements", "2 smooth / stepped to one end, with screw thread", "3 smooth / stepped to one end, with functional groove", "4 stepped to both ends, no shape elements", "5 stepped to both ends, with screw thread", "6 stepped to both ends, with functional groove", "7 functional cone", "8 operating thread", "9 all others"]],
  ["4 · Plane surface machining", ["0 no surface machining", "1 external plane surface / curved in one direction", "2 external plane surfaces related by graduation around a circle", "3 external groove and/or slot", "4 external spline / polygon", "5 external plane surface + slot + spline", "6 internal plane surface and/or slot", "7 internal spline / polygon", "8 internal and external polygon, groove, slot", "9 all others"]],
  ["5 · Auxiliary holes / gear teeth", ["0 no auxiliary holes", "1 axial holes, not related by a drilling pattern", "2 axial holes, related by a drilling pattern", "3 radial holes, not related by a pattern", "4 holes axial / radial / other directions, not related", "5 holes axial / radial / other, related by a pattern", "6 spur gear teeth", "7 bevel gear teeth", "8 other gear teeth", "9 all others"]],
];
/* shop-floor meaning of digit 1 and 2/3 (rules of thumb for the simplified code) */
export const OPITZ_CELL = ["disc / flange → chucker lathe (short work, jaws)", "short rotational → bar or chucker lathe", "long shaft → lathe with tailstock / steady rest, grinding between centres", "rotational with milled features → mill-turn centre", "long rotational with milled features → mill-turn with sub-spindle", "special rotational → decide by hand", "flat prismatic → VMC / laser / punch", "long prismatic → gantry or long-table VMC", "cubic prismatic → HMC (pallet FMS)", "special → decide by hand"];

/* ================================================================ 2H: routing sheet example – crankcase VC20 (HMC run times add up to 36 min = capacity table 2J) */
/* [op no., operation, machine, set-up / fixture, tools, set-up min per lot, time min per part] */
export const ROUTING = [
  ["10", "Mill base face, drill + ream 2 locating holes", "HMC", "Fixture A – raw casting, 3-2-1 on cast pads", "T01 face mill Ø80, T02 drill Ø9.8, T03 reamer Ø10 H7", 10, 9],
  ["20", "Mill top deck + cylinder faces, rough + semi-finish bores Ø52", "HMC", "Fixture B – on the locating holes, tombstone with 4 parts", "T04 face mill Ø63, T05 boring bar rough, T06 boring bar semi-finish", 10, 15],
  ["30", "Fine bore Ø52 H7, main bearing bores, drill + tap threads", "HMC", "Fixture B – same clamping as op 20", "T07 fine boring head, T08 line boring bar, T09 drill Ø8.5, T10 tap M10", 0, 12],
  ["40", "Wash + dry (chips, coolant)", "Washer", "Part carrier", "–", 0, 2],
  ["50", "Leak test (air 6 bar, pressure decay)", "Leak tester", "Test fixture with seals", "–", 5, 1.5],
  ["60", "Measure 1 in 20 – bores, positions, flatness", "CMM", "CMM fixture", "Star probe Ø3", 0, 0.75],
];

/* ================================================================ 2M: machine catalogue (typical values; makers = examples only, no model numbers; prices = rough estimate – always ask for a quote) */
/* fields: k, name, use, params [ [parameter, typical range] ], check [datasheet checks], makers, price, notes */
export const MACH = [
  { k: "hmc", n: "Horizontal machining centre (HMC)", use: "Cubic / prismatic parts machined from 4 sides in one clamping (crankcases, housings, valve bodies). Standard machine of a pallet FMS.",
    params: [["Pallet size", "400 × 400 … 1 000 × 1 000 mm"], ["Travels X / Y / Z", "560–1 700 / 560–1 400 / 560–1 400 mm"], ["Max. workpiece Ø × height / load", "Ø 600–1 800 × 900–1 600 mm / 400–3 000 kg"], ["Spindle taper / speed", "HSK-A63/A100, SK40/50 · 6 000–15 000 rpm"], ["Spindle power / torque (S1 / S6)", "18–50 kW / 120–1 000 Nm"], ["Rapid traverse / acceleration", "40–60 m/min / 0.5–1 g"], ["Tool magazine", "60–400 pockets, chain or rack; tool change 1–3 s chip-to-chip 2.5–5 s"], ["B axis", "indexing 1° or full NC rotary table 0.001°"], ["Positioning accuracy (ISO 230-2)", "± 2–5 µm"], ["Pallet changer / automation", "2-pallet APC; linear pallet pool interface"]],
    check: ["S1 and S6 power + torque curve against your heaviest cut (2I) – not only the peak value", "Interference circle and max. load per pallet with your fixture + tombstone", "Thermal compensation, spindle cooling, linear scales (direct measurement) on all axes", "Pallet interface to the pallet pool: height, clamping, air/hydraulic couplings through the pallet", "Control (Siemens / Fanuc / Heidenhain / own), OPC UA / MTConnect, tool-ID reading (RFID)", "Chip and coolant concept: through-spindle coolant pressure (20–70 bar), chip conveyor type for cast iron / steel / aluminium", "Local service: response time, spare-parts stock, training"],
    makers: "DMG MORI, Mazak, Okuma, Makino, Heller, Grob, DN Solutions, Kitamura", price: "€€€ – roughly 0.4–1.2 M€ per machine depending on size and automation (estimate – ask for a quote)" },
  { k: "vmc", n: "Vertical machining centre (VMC)", use: "Flat and smaller prismatic parts, mostly machined from one side; covers, plates, small housings; low-cost standard machine.",
    params: [["Table size", "700 × 400 … 2 000 × 800 mm"], ["Travels X / Y / Z", "500–2 000 / 400–800 / 450–700 mm"], ["Spindle taper / speed", "BT/SK40, HSK-A63 · 8 000–20 000 rpm"], ["Spindle power / torque", "11–30 kW / 70–250 Nm"], ["Tool magazine", "20–60 pockets, tool change 1–2 s"], ["Table load", "300–1 500 kg"], ["Optional 4th axis", "rotary table on the table"]],
    check: ["Spindle curve at the speed of your main tools", "Automation: robot door, zero-point clamping, interface for a pallet changer or robot", "Chip removal for deep pockets (vertical spindle keeps chips in the part)", "Control and data interface (OPC UA / MTConnect)", "Table load incl. vice / fixture"],
    makers: "Haas, Hermle, Brother, Chiron (and HMC makers above also offer VMCs)", price: "€ to €€ – roughly 0.07–0.4 M€ (estimate – ask for a quote)" },
  { k: "5ax", n: "5-axis machining centre", use: "Complex parts machined from 5 sides in one clamping (impellers, pump housings, moulds, medical parts); fewer set-ups, higher accuracy between features.",
    params: [["Kinematics", "swivel-rotary table (trunnion) or swivel head + rotary table"], ["Table Ø / load", "Ø 320–1 000 mm / 100–2 000 kg"], ["Travels X / Y / Z", "450–1 200 / 450–1 000 / 400–800 mm"], ["Swivel range A/B, C", "± 110–130°, 360°"], ["Spindle", "HSK-A63 · 12 000–20 000 rpm · 20–40 kW"], ["Simultaneous 5-axis", "yes / 3+2 only"]],
    check: ["Simultaneous vs. 3+2 machining – what do your parts need?", "Kinematic accuracy (centre of rotation calibration, e.g. with a measuring cycle)", "Collision model in the control and in the CAM post-processor", "Pallet automation available (pallet magazine or robot)", "Programmer skills / CAM licence costs"],
    makers: "DMG MORI, Hermle, Mazak, Okuma, Makino, Grob, Chiron", price: "€€ to €€€ – roughly 0.25–1.0 M€ (estimate – ask for a quote)" },
  { k: "lathe", n: "CNC lathe / mill-turn centre", use: "Rotational parts: shafts, flanges, pins, bushes; mill-turn adds driven tools + Y axis + sub-spindle to finish parts complete in one machine.",
    params: [["Max. turning Ø × length", "Ø 200–700 × 300–3 000 mm"], ["Bar capacity", "Ø 42–102 mm"], ["Chuck size", "6–15 inch"], ["Main spindle power / torque", "11–45 kW / 150–2 000 Nm"], ["Turret", "12–24 stations, driven tools 3–15 kW"], ["Axes", "X/Z (+C, Y, B, sub-spindle)"], ["Tailstock / steady rest", "for L/D > 3"]],
    check: ["Bar feeder or robot / gantry loader interface", "Torque at low speed for large diameters (2I)", "Sub-spindle for complete machining – avoids a 2nd set-up", "Thermal stability for tight diameters (IT6)", "Chip conveyor for long steel chips"],
    makers: "DMG MORI, Mazak, Okuma, DN Solutions, Index, EMAG", price: "€ to €€€ – lathe 0.08–0.3 M€, mill-turn 0.3–1.0 M€ (estimate – ask for a quote)" },
  { k: "grind", n: "Cylindrical / surface grinder", use: "Final operation for IT5–IT6 and Ra 0.2–0.8 on hardened shafts, bearing seats, pins; also non-round (crankpin, cam) grinding.",
    params: [["Grinding length / centre height", "400–2 000 mm / 125–250 mm"], ["Max. part weight", "50–250 kg"], ["Wheel type", "corundum or CBN, Ø 400–750 mm, 35–80 m/s"], ["Axes", "X/Z (+B swivel head, C for non-round)"], ["In-process gauging", "diameter measuring head (Marposs, etc.)"], ["Dressing", "diamond roller / single point"]],
    check: ["Achievable roundness / Ra in a test grind with your part", "In-process gauging and closed-loop size control", "Loading: gantry or robot interface", "Coolant filtration (≤ 10–20 µm) and mist extraction", "Dressing cycle time inside the cycle time"],
    makers: "Studer, Junker, Kellenberger (also EMAG, Okuma)", price: "€€ to €€€ – roughly 0.25–0.9 M€ (estimate – ask for a quote)" },
  { k: "hone", n: "Honing machine", use: "Final operation for bores: cylinder bores, con-rod eyes, valve bores; IT4–IT6, roundness and cylindricity 1–3 µm, cross-hatch surface.",
    params: [["Bore Ø range", "Ø 2–200 mm (machine dependent)"], ["Stroke length", "50–400 mm"], ["Spindles", "1–6 (rough – finish – plateau)"], ["Expansion", "mechanical / hydraulic / electro-mechanical"], ["Gauging", "air gauging in the tool, closed loop"], ["Cross-hatch angle", "20–60°, plateau honing"]],
    check: ["Test honing with your part: size scatter, cylindricity, Rz/Rk values", "Stock removal per stage and cycle time per spindle", "Tool cost per part (honing stones / CBN)", "Automation: rotary table, robot loading", "Oil filtration and fire protection (honing oil)"],
    makers: "Nagel, Gehring, Sunnen", price: "€€ – roughly 0.15–0.8 M€ (estimate – ask for a quote)" },
  { k: "wash", n: "Industrial parts washer", use: "Remove chips, coolant and particles before assembly, measuring or leak test; residual-dirt (technical cleanliness) limits per ISO 16232 / VDA 19.",
    params: [["Type", "spray chamber, immersion + ultrasonic, robot-guided wash, through-feed"], ["Basket / part size", "e.g. 670 × 480 × 300 mm basket or single part in a fixture"], ["Cycle time", "1–6 min per basket / part"], ["Media", "water-based + cleaner, or solvent (modified alcohol)"], ["Drying", "hot air, vacuum drying"], ["Cleanliness target", "max. particle size e.g. ≤ 400 µm, mg per part"]],
    check: ["Cleanliness test with your parts (particle analysis)", "Bath maintenance: filtration, oil separation, media life", "Energy use (heating, vacuum) – big share of the LCC", "Part carrier / fixture design for blind holes", "Interface to conveyor / robot and to the MES (cycle data)"],
    makers: "Dürr Ecoclean, MAFAC", price: "€ to €€ – roughly 0.05–0.6 M€ (estimate – ask for a quote)" },
  { k: "cmm", n: "Coordinate measuring machine (CMM)", use: "Dimensional inspection: first article, sampling inspection, SPC data; in the FMS often in a climate room or shop-floor version with pallet interface.",
    params: [["Measuring range X / Y / Z", "500 × 700 × 500 … 1 200 × 3 000 × 1 000 mm"], ["MPE_E (ISO 10360-2)", "≈ 1.5 + L/350 … 3 + L/250 µm"], ["Probe", "touch-trigger or scanning, probe changer"], ["Environment", "climate room 20 ± 1 °C or shop-floor with temperature compensation"], ["Software", "Calypso, PC-DMIS, MCOSMOS or similar; CAD-based programs"]],
    check: ["Measuring uncertainty vs. tolerance: rule of thumb U ≤ 10–20 % of the tolerance (gauge R&R)", "Temperature range of the specification and the real shop temperature", "Measuring time per part = capacity (often a bottleneck)", "Export of results to the MES / SPC (Q-DAS, CSV, QIF)", "Pallet / fixture interface for automatic loading"],
    makers: "Zeiss, Hexagon, Mitutoyo", price: "€ to €€ – roughly 0.08–0.5 M€ (estimate – ask for a quote)" },
  { k: "weld", n: "Robot welding cell", use: "Arc welding (MAG / MIG / TIG) of frames, brackets, housings; robot + positioner + torch + safety fence; laser welding for thin parts.",
    params: [["Robot reach / payload", "1.4–2.0 m / 6–20 kg (torch)"], ["Positioner", "1-axis, 2-axis or turntable with 2 stations (load while welding)"], ["Process", "MAG pulsed, CMT, tandem, TIG, laser"], ["Power source", "300–500 A"], ["Seam tracking", "touch sensing, arc sensing, laser seam tracking"], ["Weld length per part / speed", "e.g. 1 800 mm at 0.4–1.0 m/min"]],
    check: ["Part tolerances of the welded parts: gap ≤ ~ 0.5–1 mm, otherwise seam tracking needed", "Fixture concept (clamping, heat distortion)", "Fume extraction and safety (fence, light curtain, ISO 10218)", "Offline programming software and weld-data logging (current, voltage, wire feed) to the MES", "Torch cleaning, wire supply (drum), cycle time incl. positioner turn"],
    makers: "Fanuc, ABB, KUKA, Yaskawa, Cloos, Panasonic", price: "€€ – roughly 0.15–0.6 M€ per cell (estimate – ask for a quote)" },
  { k: "laser", n: "Fibre laser cutting machine", use: "2D cutting of sheet metal (steel, stainless, aluminium, copper); often with automatic load / unload and tower storage.",
    params: [["Sheet size", "3 000 × 1 500 / 4 000 × 2 000 / 6 000 × 2 000 mm"], ["Laser power", "3–20 kW (fibre)"], ["Max. thickness", "steel 20–30 mm, stainless 15–40 mm, aluminium 15–30 mm (power dependent)"], ["Positioning speed / acceleration", "100–170 m/min / 1–3 g"], ["Automation", "pallet changer, load/unload, sorting, tower storage"], ["Assist gas", "N₂, O₂, compressed air"]],
    check: ["Cutting speed table for YOUR thickness range and quality (burr, edge)", "Gas consumption and cost (nitrogen is a large running cost)", "Nesting / CAM software, remnant management, ERP interface", "Laser safety enclosure, fume extraction", "Service: laser source warranty (hours), nozzle / lens consumables"],
    makers: "Trumpf, Bystronic, Amada, Salvagnini", price: "€€ to €€€ – roughly 0.3–1.5 M€ incl. automation (estimate – ask for a quote)" },
  { k: "brake", n: "CNC press brake", use: "Bending of sheet-metal parts (cabinets, brackets, frames); manual, with automatic tool change or as robot cell.",
    params: [["Press force", "40–400 t (common 100–220 t)"], ["Bending length", "1 250–4 000 mm"], ["Back gauge axes", "2–6 axes (X, R, Z1, Z2 …)"], ["Stroke / open height", "200–400 mm / 400–600 mm"], ["Angle measuring", "laser or contact angle measuring, crowning"], ["Tool change", "manual, automatic tool changer"]],
    check: ["Force for your thickest bend: F ≈ 1.42·Rm·s²·L/V (V = die opening) – check with the maker's table", "Angle accuracy and repeatability (± 0.3° typical), angle measuring system", "Offline programming (3D, collision check)", "Tool system (standard / own), tool storage", "Robot cell option for high volume"],
    makers: "Trumpf, Bystronic, Amada, Salvagnini", price: "€ to €€ – roughly 0.1–0.5 M€ (robot cell more) (estimate – ask for a quote)" },
  { k: "imm", n: "Injection moulding machine", use: "Plastic parts (covers, housings, clips); hydraulic, hybrid or all-electric; with robot for removal and insert loading.",
    params: [["Clamp force", "250 kN … 10 000+ kN (2I: F = p_cav·A·safety)"], ["Shot volume / screw Ø", "10–3 000 cm³ / Ø 18–120 mm"], ["Tie-bar distance / mould height", "fits your mould"], ["Drive", "hydraulic, hybrid, all-electric (energy, precision)"], ["Dry cycle", "1–3 s"], ["Peripherals", "dryer, temperature control units, hot runner control, robot"]],
    check: ["Clamp force with safety factor and mould size between the tie bars", "Shot size: use 20–80 % of the screw capacity", "Energy per kg (all-electric often 30–60 % less)", "Euromap / OPC UA 40077/40082 interface to the MES", "Robot and mould change (quick mould change, magnetic platens)"],
    makers: "Engel, Arburg, KraussMaffei, Haitian", price: "€ to €€€ – roughly 0.05–1 M€ depending on clamp force (estimate – ask for a quote)" },
  { k: "screw", n: "Screwdriving station (nutrunner)", use: "Controlled tightening of bolted joints (con-rod bolts, head bolts) – torque + angle monitored, one curve per bolt saved to the MES.",
    params: [["Torque range", "0.5–1 000 Nm (spindle size per joint)"], ["Strategy", "torque control + angle monitoring, angle control, yield control"], ["Spindles", "1 spindle hand-held / fixtured, multi-spindle for patterns"], ["Accuracy", "Cm/Cmk ≥ 1.67 at ± 5–10 % torque"], ["Data", "curves torque/angle per bolt, OK/NOK, open protocol"]],
    check: ["Joint analysis (hard / soft joint) and tightening strategy with the bolt supplier", "Machine capability (Cm/Cmk) test in the acceptance", "Traceability: curve + serial number to the MES", "Reaction arm / fixture for operator safety", "Tool change for variants (socket tray, auto socket selection)"],
    makers: "Atlas Copco, Desoutter, Bosch Rexroth", price: "€ – roughly 5–60 k€ per spindle with controller (multi-spindle more) (estimate – ask for a quote)" },
  { k: "press", n: "Press-fit station (servo press)", use: "Pressing bearings, bushes, pins with force–distance monitoring; each press curve is evaluated with windows / envelopes and saved.",
    params: [["Press force", "0.5–300 kN"], ["Stroke", "50–500 mm"], ["Position resolution", "≤ 1–10 µm"], ["Force measurement", "strain-gauge or piezo sensor, accuracy ≤ 0.5 % FS"], ["Evaluation", "windows, envelope, block, threshold on the force–distance curve"]],
    check: ["Required force from interference fit (e.g. ISO 286 fit + friction) with 30–50 % margin", "Evaluation software and curve export to the MES", "Frame stiffness (C-frame bends) and parallelism", "Safety: two-hand control or light curtain, guarding", "Capability test (Cm/Cmk) on force and position"],
    makers: "Kistler, Promess, Schmidt", price: "€ – roughly 20–120 k€ per station (estimate – ask for a quote)" },
];
