/* Installation tab – item 5: texts, checklists and tables (no DOM). Used by instseq.js.
 * All values are EXAMPLES – check with the machine maker's installation manual. */

/* ------------------------------------------------------------------ tickable checklists, one per phase */
export const PHASES = [
  { id: "p1", title: "1 · Planning + site preparation", items: [
    "Pre-installation meeting held; layout drawing signed by buyer + maker (machine, APC, chip conveyor, coolant tank, cabinet)",
    "Certified foundation / installation drawing received (loads, anchor + pad positions, CoG, lifting points)",
    "Access route measured: door ≥ machine width + 200 mm, height ≥ transport height + 200 mm (example HMC: ≥ 3.0 m × 3.4 m)",
    "Floor load along the WHOLE route checked (skate point loads, forklift axle load, trenches, drain covers, ramps)",
    "Crane / forklift capacity checked for the heaviest part incl. load centre and radius; lifting plan signed",
    "Foundation poured ≥ 28 days before placing; surface flat (±5 mm), anchor sleeves at the drawing positions",
    "Area clean, dry, roof tight; no welding / grinding / painting dust when the machine is opened",
    "Room temperature 20 ± 2 °C possible (precision), no direct sun, no door draught, gradient ≤ 1 K/m",
    "Lighting ≥ 500 lx at the work area (EN 12464-1 class for machining), plus a hand lamp for service",
    "Free space ≥ 800–1000 mm around the machine for maintenance + full opening of the electrical cabinet door (≥ 700 mm)",
    "Chip + coolant handling planned: conveyor discharge height, chip bin place, floor drain / bund, no coolant into the sewer",
    "Compressed-air drop (0.5–0.6 MPa, dry) and network point (RJ45, labelled) at the planned connection side",
    "Power cable + breaker ready and tested (item 3), main switch reachable",
    "Storage place for packing, VCI film, transport locks (keep them!)",
  ] },
  { id: "p2", title: "2 · Transport, delivery, rigging", items: [
    "Incoterms + insurance clear: who carries the risk until the machine stands on the foundation",
    "Machine packed with VCI film + desiccant bags; transport locks on all axes, spindle head + APC secured",
    "Shock + tilt indicators fixed on the crate; photos at loading",
    "Delivery: check indicators BEFORE signing; note damage on the delivery note ('accepted with reservation') + photos",
    "Count boxes against the packing list (accessories, tools, manuals, keys, spare parts)",
    "Lifting points + CoG taken from the maker's drawing (never guess)",
    "Sling force calculated, slings + shackles WLL ≥ required, inspected (label readable, no cuts)",
    "Spreader beam used where slings would touch covers / sheet metal",
    "Forklift actual capacity checked at the real load centre (not the rated one)",
    "Skates / rollers / air pads rated for the load; steel plates over joints and soft floor",
    "Exclusion zone during the lift; one person gives signals; no one under the load",
    "Machine not stored outside; if stored: dry, ventilated, ≥ 10 °C, covered, check VCI weekly",
  ] },
  { id: "p3", title: "3 · Placing + utilities", items: [
    "Machine set on the levelling pads; shims / pads under all levelling bolts; anchors loosely set (item 1 + 2)",
    "Rough levelling done (≤ 0.04 mm/m) before connecting anything rigid",
    "Transport locks removed only after placing – painted red, stored with the machine for later moves",
    "Electrical connection by a qualified electrician: PE first, insulation test, phase sequence (item 3)",
    "Compressed air: drop from the TOP of the ring main, shutoff valve, filter-regulator, quick coupling; condensate drain at low points",
    "Air quality checked at the machine inlet (dew point, no oil/water) – class 1.4.1 example",
    "Coolant tank cleaned, first fill premixed (concentrate INTO water), concentration 6–8 % checked with refractometer",
    "Chip conveyor aligned to the bin / central chip channel, discharge height correct",
    "Oil-mist collector connected, duct sealed, condensate return to the tank",
    "Network cable connected, IP address set, connection to MES tested (Communication tab)",
    "All flexible hoses free of tension; no pipes or cables across walkways (or covered ramps)",
  ] },
  { id: "p4", title: "4 · Commissioning (maker + buyer)", items: [
    "All transport locks removed and counted (axis brackets, spindle head, APC, door) – axes free by hand where possible",
    "Oil levels checked: way lube tank, hydraulic unit, spindle cooler (chiller), gearbox; correct oil types",
    "Main switch ON with the e-stop pressed; check supply voltage at the cabinet (400 V ± 10 %), control voltage 24 V",
    "Release e-stop, CNC boots; alarm list read and cleared; battery alarms (absolute encoders) checked",
    "Phase sequence: coolant + hydraulic pump direction correct (pressure builds up)",
    "Reference / home all axes (absolute encoders: check the zero point marks)",
    "Axis run-in at low speed (10–25 % rapid) over the full stroke, listen for noise, check soft limits",
    "Lubrication check: way lube pulses arrive at every point; pressure switch alarm tested",
    "Spindle run-in program: step-up speeds with times, temperature watched (card G)",
    "ATC + APC cycle test (empty, then with tools / pallets)",
    "Safety test: door interlock (no spindle/axes with door open in AUTO), every e-stop, enabling device, light curtain/APC guard",
    "Coolant: flood, through-spindle pressure (e.g. 7 MPa), chip flush, filter; no leaks",
    "Levelling re-checked after the first warm run; geometry checks (item 2)",
    "Backups made: CNC parameters, PLC/ladder, pitch-error + backlash compensation, macros, tool table – 2 copies, one off the machine",
    "Commissioning report signed by maker + buyer; open points list with dates",
  ] },
  { id: "p5", title: "5 · Acceptance (SAT) + handover", items: [
    "FAT protocol from the maker's plant available; open FAT points closed",
    "Test cut: first crankcase measured completely on the CMM (first article inspection)",
    "Capability run: 50 consecutive parts, critical features, Cmk ≥ 1.67 (example: bore Ø62 H7)",
    "Cycle-time proof: 10 cycles measured, mean ≤ quoted cycle time",
    "Continuous run 8–24 h without machine-caused stop (availability target agreed in the contract)",
    "Documentation: operating + maintenance manuals (language of the users), electrical drawings (as built), hydraulic/pneumatic diagrams",
    "Documentation: parameter + PLC backup, spare + wear parts list, lubrication plan",
    "Documentation: EU declaration of conformity + CE marking (or local equivalent), test reports (geometry, laser, ballbar, safety)",
    "Training done and signed: operators, maintenance (mechanical + electrical), programmers",
    "Spare parts on site (filters, wipers, fuses, encoder battery, way-lube oil) as agreed",
    "Final acceptance certificate signed; warranty start date written down",
    "Production ramp-up plan: target cycle time + OEE per week, who watches it",
  ] },
];

/* ------------------------------------------------------------------ site requirements table */
export const SITE = [
  ["Access route + door", "door ≥ machine width + 200 mm; height ≥ transport height + 200 mm (example ≥ 3.0 × 3.4 m)", "a machine that does not fit must be split → extra days of the maker's fitters"],
  ["Floor load along the route", "skate point load = m / 3 (4 skates, one may lift); e.g. 12 000 kg → 39 kN per skate; steel plates 20 mm to spread it", "trench covers and old slabs crack; drain pipes break"],
  ["Crane / forklift", "rated capacity ≥ 1.25 × heaviest lift at the real radius / load centre", "overturning or dropping the machine"],
  ["Clean + dry area", "roof tight, no condensation, no grinding / welding dust nearby", "rust on ways + ball screws, dirt in the spindle taper"],
  ["Room temperature", "20 ± 2 °C for precision, gradient ≤ 1 K/m, change ≤ 1 K/h (example)", "thermal growth: 1 m steel grows 11.5 µm per K"],
  ["Lighting", "≥ 500 lx general at machining areas (EN 12464-1), task light in the machine", "measuring and setting errors"],
  ["Service space", "≥ 800–1000 mm free on all service sides; cabinet door opens fully (≥ 90°); APC and conveyor can be pulled out", "service needs dismantling of fences; unsafe work"],
  ["Chip / coolant drainage", "chip bin place, floor bund / drain to separator, oil-proof floor coating", "coolant into the soil / sewer is illegal; slippery floor"],
  ["Compressed-air point", "0.5–0.6 MPa at the machine, ISO 8573-1 class 1.4.1 (example), ≥ 300 NL/min peak", "pressure-switch alarms, wet air kills valves + spindle air seal"],
  ["Network point", "RJ45 Cat 6 (or fibre), labelled, IP from the IT plan, firewall rule", "MES connection late by weeks"],
  ["Power", "3×400 V ±10 %, 50 Hz, TN-S, 45 kVA, cable + breaker from item 3", "first power-on delayed"],
];

/* ------------------------------------------------------------------ air quality classes (ISO 8573-1:2010, extract) */
export const AIR_CLASSES = [
  ["1", "particles 0.1–0.5 µm ≤ 20 000, 0.5–1 µm ≤ 400, 1–5 µm ≤ 10 per m³", "pressure dew point ≤ −70 °C", "oil ≤ 0.01 mg/m³"],
  ["2", "≤ 400 000 / 6 000 / 100", "≤ −40 °C", "≤ 0.1 mg/m³"],
  ["3", "– / 90 000 / 1 000", "≤ −20 °C", "≤ 1 mg/m³"],
  ["4", "– / – / 10 000", "≤ +3 °C (refrigeration dryer)", "≤ 5 mg/m³"],
  ["5", "– / – / 100 000", "≤ +7 °C", "–"],
];

/* ------------------------------------------------------------------ commissioning steps (order matters) */
export const COMM_STEPS = [
  ["Unlock transport locks", "Remove all axis shipping brackets (usually painted red / yellow), spindle-head support, APC lock, door straps. Count them against the list in the manual.", "Moving an axis against a lock bends the bracket, the ball screw or the coupling; overload alarm."],
  ["Check oil levels", "Way-lube tank, hydraulic unit (e.g. 7 MPa clamping), spindle cooler / chiller coolant, gearbox. Only the oil types in the lubrication plan.", "Dry start of the hydraulic pump; wrong oil type foams or attacks seals."],
  ["First power-on sequence", "E-stop pressed → main switch ON → measure 3×400 V and 24 V → release e-stop → CNC boots → read the alarm list.", "Wrong supply voltage destroys power supplies; a dropped phase stops the pumps."],
  ["Alarm check", "Clear each alarm only when its cause is understood (battery, air pressure, lube level, door). Keep the list in the report.", "Alarms hidden by parameter change come back in production."],
  ["Reference / home", "Home each axis at low speed (or check the absolute zero). Check soft limits and stroke ends.", "Wrong zero → crash into the table or the APC."],
  ["Axis run-in", "Each axis over the full stroke at 10 → 25 → 50 % rapid, 10–15 min each, listen; then all axes together.", "Damage hidden by transport (dented guide, loose coupling) shows here – before a part is on the table."],
  ["Spindle run-in", "Step-up program (chart below): low speed first so the grease spreads; watch the housing temperature and noise; next step only when the temperature is stable.", "Running straight at maximum speed with fresh grease overheats the bearings → damage of a 15 000–40 000 € spindle."],
  ["Lubrication check", "Way lube: pulses reach every carriage + ball nut (look for oil film); low-level and pressure switches give alarms when tested.", "One blocked lube line = one dry carriage = guide damage after weeks."],
  ["Safety function test", "Door interlock (AUTO: no spindle / axes with the door open), each e-stop, enabling device in setup mode, APC guard, spindle stop time. Record each test.", "A bypassed interlock injures an operator; legal liability."],
  ["Backups", "CNC parameters, PLC program / ladder, pitch-error + backlash compensation, macros, tool data, offset tables → 2 copies (USB + server). Write the date.", "Battery or board failure without backup = days or weeks of downtime."],
];

/* ------------------------------------------------------------------ FAT vs SAT */
export const FAT_SAT = [
  ["Where", "at the maker's plant, before shipping", "at the buyer's site, after installation"],
  ["Purpose", "prove the machine meets the spec before it leaves (cheap to fix)", "prove it still meets the spec after transport, on the real foundation, with the real utilities"],
  ["Geometry", "full ISO 10791 test set, laser positioning, ballbar", "selected checks (item 2) – after final levelling"],
  ["Parts", "test part (often a standard test piece) or the real part with the maker's fixture", "the REAL crankcase on the real fixture, real tools, real material"],
  ["Capability", "Cmk on the test part (if agreed)", "Cmk ≥ 1.67 on 50 consecutive real parts"],
  ["Cycle time", "proved with the real program", "proved again with the real line logistics (APC, robot, MES)"],
  ["Run time", "e.g. 4–8 h dry or cutting run", "8–24 h continuous production run"],
  ["Payment", "often 10–30 % after FAT", "often 10–20 % after SAT / final acceptance"],
];

export const DOCS = [
  ["Operating manual", "language of the operators, safety instructions", "Machinery Regulation (EU) 2023/1230 / Machinery Directive 2006/42/EC"],
  ["Maintenance + lubrication plan", "intervals, oil types, quantities", "needed for warranty"],
  ["Electrical drawings (as built)", "with all changes made during commissioning", "IEC 60204-1 §17"],
  ["Hydraulic + pneumatic diagrams", "ISO 1219 symbols", "fault finding"],
  ["Parameter + PLC backup", "CNC parameters, ladder, compensation tables, macros", "2 copies, dated"],
  ["Spare + wear parts list", "part numbers, recommended stock", "with prices if agreed"],
  ["EU declaration of conformity + CE", "and risk assessment summary", "legal to operate"],
  ["Test reports", "FAT, SAT, geometry, laser, ballbar, capability, safety test", "baseline for later checks"],
  ["Foundation + installation drawing", "as built, with levelling values", "for re-levelling after 3–6 months"],
  ["Training records", "names, contents, signatures", "proof of instruction"],
];

export const TRAINING = [
  ["Operators (all shifts)", "2–3 days", "panel, modes, part change, tool offsets, alarms, daily checks, safety"],
  ["Setters / programmers", "3–5 days", "programming (G-code/CAM post), work offsets, probing, tool management, optimisation"],
  ["Maintenance – mechanical", "2–3 days", "lubrication, filters, wipers, belts, levelling check, spindle care, APC adjustment"],
  ["Maintenance – electrical", "2–3 days", "drawings, diagnosis pages, drive alarms, battery change, backup + restore, safety tests"],
];

/* ------------------------------------------------------------------ typical mistakes + cost (EXAMPLE money values) */
export const MISTAKES = [
  ["Foundation started late (curing forgotten in the plan)", "machine waits in storage 2–4 weeks; maker's fitter re-booked", "storage + re-booking 5 000–15 000 €, production loss"],
  ["Door / route too small, floor load not checked", "machine dismantled or wall opened; cracked floor or broken drain", "10 000–40 000 €, 1–2 weeks"],
  ["Lifting at the wrong points / no spreader beam", "bent covers, cracked guards, in the worst case a dropped machine", "2 000 € … total loss"],
  ["Transport locks removed before moving / placing", "axis moves during transport → ball screw, guides, coupling damaged", "5 000–25 000 €"],
  ["Power-on with transport locks still mounted", "axis overload alarm, bent bracket, damaged coupling or servo", "1 000–10 000 €"],
  ["Machine stored outside / no VCI check", "rust on ways, table, spindle taper → regrinding", "5 000–30 000 €"],
  ["Shock indicator triggered but delivery note signed 'OK'", "insurance does not pay for the damage", "full repair cost"],
  ["Wrong phase sequence", "coolant / hydraulic pump runs backwards: no pressure, pump damage", "500–5 000 €"],
  ["Wet / oily compressed air", "sticking valves, spindle air-seal contamination, rust in the taper", "2 000–20 000 € per year"],
  ["Coolant mixed water INTO concentrate, or wrong %", "unstable emulsion, bacteria, smell, skin problems, rust", "tank cleaning 1 000–3 000 € each time"],
  ["Spindle run-in skipped", "bearing overheats with fresh grease → spindle rebuild", "15 000–40 000 €, 2–6 weeks"],
  ["No parameter / PLC backup", "board or battery failure = machine dead until the maker rebuilds the data", "days–weeks of downtime"],
  ["Levelling not re-checked after 1–3 months", "foundation settles, geometry drifts, bores out of tolerance", "scrap + re-levelling"],
  ["Run-off with a test part instead of the real crankcase", "capability problems appear only in production, warranty arguments", "weeks of rework"],
  ["Network / MES not planned", "machine runs but no data, no OEE, manual work-arounds", "IT project 2–8 weeks late"],
];

export const QUESTIONS = [
  "Certified foundation drawing: static + dynamic loads per pad, anchor type and positions, minimum slab thickness, isolation joint?",
  "Transport dimensions + mass of each package; lifting points, CoG, required spreader beam; can the machine be split?",
  "Which transport locks are fitted, where, how many – and the order to remove them?",
  "Who unloads and places (Incoterms, rigging company)? Who is liable for damage during rigging?",
  "Utility list: power (kVA, fuse, cable), air (pressure, quality class, NL/min peak + average), coolant (type, tank volume), exhaust (m³/h)?",
  "Room conditions for the guaranteed accuracy: temperature range, gradient, humidity, vibration limit of the floor?",
  "Commissioning: how many days, how many people, which tools/instruments do they bring, what must the buyer provide (crane, oil, coolant, helpers)?",
  "Spindle run-in program and temperature limits; warm-up program for every morning?",
  "FAT + SAT content: which geometry tests (ISO 10791 / ISO 230), which part, how many parts for Cmk, cycle time, run time, acceptance limits?",
  "Which documents are delivered (list), in which language, when (before delivery for planning)?",
  "Training: content, days, number of people, at the maker or on site?",
  "Recommended spare parts for 2 years; delivery time of the spindle and the main drives?",
  "Network: which interface is included (OPC UA, MTConnect, PROFINET), which data points, licences needed?",
  "Warranty start (delivery, SAT or final acceptance?) and response time of the service?",
];
