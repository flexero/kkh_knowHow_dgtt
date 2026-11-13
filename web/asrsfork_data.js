/* AS/RS item 7 – telescopic fork: texts, tables, fault cases, manufacturing + maintenance, parts list, catalogue card.
 * Guide: docs/39_asrs_telescopic_fork.md. ALL VALUES ARE EXAMPLES – the fork maker's data decides.
 */
export const NOTE7 = "Example values – the fork maker's data decides.";

/* drive-train designs (selector in the 3D card) */
export const DESIGNS = {
  rack: { n: "Rack + pinion + chains (default)", how: "Gear motor → 2 synchronising shafts (coupled by a short chain) → 2 pinions per tine → racks on the 2 middle stages (s). 2 roller chains per tine, anchored on the base and on the top stage, run over sprockets on the middle stage → top stage 2·s.",
    plus: "positive drive (no slip), stiff, accurate; standard for 300 – 1 500 kg", minus: "rack must be machined + hardened; chains need tension checks + oil; noise at high speed", where: "most unit-load cranes (crates, pallets)" },
  chain: { n: "All-chain drive", how: "The motor sprocket drives a chain that is fixed to both ends of the middle stage (omega wrap with 2 idlers). Stroke doubling with chains as above.",
    plus: "no rack machining; cheap; easy to replace", minus: "chain elongation adds to the middle stage too → more position error; more chains to tension", where: "simple / low-cost forks" },
  belt: { n: "Toothed belts", how: "Steel-cord PU toothed belts instead of chains – for the drive (omega) and for the stroke doubling.",
    plus: "no lubrication, quiet, low elongation, clean (food, pharma)", minus: "belt clamps + pulleys bigger; heat / oil sensitive; belt can jump teeth if tension is low", where: "mini-load / tote forks, light unit loads" },
  friction: { n: "Friction wheel", how: "A rubber (PU) wheel pressed by springs onto a strip under the middle stage drives it by friction. Chains or belts still double the stroke.",
    plus: "cheapest, protects against collisions (slips instead of breaking)", minus: "SLIPS: needs an absolute position sensor on the stage, not only the motor encoder; wear of the wheel; wet / oily strip = no drive", where: "light forks, retrofits; not for heavy or precise work" },
};

/* sensors shown in the lamp panel */
export const SENS = [
  ["inPos", "Fine positioning x / z in window ± 3 mm", "reflex sensor on a flag at each slot (or laser + teach-in)"],
  ["centre", "Fork in centre position (safe, 2 channels)", "2 inductive sensors on the base, flag on the middle stage – allows travel + hoist"],
  ["endL", "End of stroke L", "end switch / sensor; the PLC stops at the encoder position first"],
  ["endR", "End of stroke R", "same, side R"],
  ["loadOn", "Load on fork", "2 diffuse sensors look up between the tines"],
  ["ovL", "Overhang L", "light barrier along the carriage edge L (crate edge + 20 mm)"],
  ["ovR", "Overhang R", "light barrier along the carriage edge R"],
  ["occ", "Target slot occupied", "diffuse / distance sensor looks into the slot before the fork extends"],
  ["slip", "Slip / chain elongation", "encoder position vs. end switch on the top stage: > 10 mm = alarm"],
  ["torque", "Torque / current high", "drive monitors motor current: collision, jam, crate stuck"],
];

/* step table of the cycle (what happens + sensor states) – keyed by plan segment */
export const STEP_INFO = {
  travel1: { what: "The crane travels along the aisle and the carriage moves up together. Fork MUST be centred (safe sensor) – otherwise travel is blocked.", s: "centre = 1, load on fork = 0" },
  pos1: { what: "Slow fine positioning on the slot flag until x and z are within ± 3 mm. The tine top is 40 mm under the crate floor. The slot check sees a crate in slot L (correct for a pick).", s: "in position = 1 at the end, occupancy L = 1 (expected)" },
  out1: { what: "The fork extends 1 350 mm to side L. The tines run in the channels between the crate runners – 40 mm under the crate floor, 28 mm over the beams, 30 mm side clearance.", s: "centre = 0 after 5 mm, end L = 1 at the end, current normal" },
  lift1: { what: "The hoist lifts 100 mm in 0.5 s: after 40 mm the tines touch the crate floor, then the crate goes up 60 mm and is free of the beams and the load guides.", s: "load on fork = 1, hoist load pins: + 300 kg" },
  in1: { what: "The fork retracts with the crate. (A gentler profile – 0.8 m/s, 0.8 m/s² – is common with heavy loads; the core uses the same 1.0 / 1.2 both ways.)", s: "end L = 0, centre = 1 at the end" },
  chk1: { what: "Checks before travel: load on fork, no overhang, centre position, encoder count = switch position (slip check), weight ≤ 300 kg.", s: "centre = 1, load = 1, overhang L/R = 0, slip = 0" },
  travel2: { what: "Travel + hoist with the crate to the target slot, carriage 60 mm above the deposit level (crate runners 60 mm over the beams).", s: "centre = 1, load = 1" },
  pos2: { what: "Fine positioning ± 3 mm. The occupancy sensor looks into the target slot: it MUST be empty (no double storage).", s: "occupancy R = 0 (else stop)" },
  out2: { what: "The fork extends to side R with the crate. The load guides centre the crate if it is a few mm off.", s: "end R = 1 at the end, current normal" },
  lower2: { what: "The hoist lowers 100 mm: after 60 mm the runners sit on the beams, the tines go 40 mm further down and are free.", s: "load on fork = 0, load pins: − 300 kg" },
  in2: { what: "The fork retracts empty. Centre sensor = 1 → the crane may travel. The WMS books the crate into slot R-03-1-3.", s: "centre = 1, load = 0, job done" },
};

/* fault cases */
export const FAULT_INFO = {
  offset: { n: "Crate offset", see: "The crate stood 60 mm too far towards the aisle in slot L (pushed, or put down wrong). The fork picked it at its normal stroke, so on the carriage the crate sits 60 mm off-centre towards side R: the overhang light barrier R is interrupted.",
    plc: "Fork stops, travel + hoist blocked, alarm \"load overhang R 60 mm\". Small offsets (≤ 20 mm) are accepted – the load guides correct them at the next deposit.",
    fix: "Manual mode: put the crate back with a corrected stroke or take it out with a forklift; check the load guides and the last deposit position (teach-in)." },
  occupied: { n: "Slot occupied (double storage)", see: "The occupancy sensor sees a crate in target slot R-03-1-3 during fine positioning – before the fork extends.",
    plc: "Fork does NOT extend. Alarm \"target slot occupied\" to the WMS. The WMS blocks the slot and gives a new target slot; inventory check of that slot.",
    fix: "Find out why: WMS booking error, manual store, a crate stored twice. Correct the stock (guide 34). Never switch the occupancy check off." },
  chain: { n: "Chain elongation / slip", see: "At the end of the stroke the encoder says 1 350 mm, but the end switch on the top stage comes 25 mm late: the top stage lags behind 2·s_mid.",
    plc: "Alarm \"slip / chain elongation 25 mm > 10 mm\". Fork moves back slowly to the centre; crane stops after the job.",
    fix: "Measure chain elongation (gauge over 10 links), re-tension at the anchors, set both chains equal; replace at 2–3 % elongation. Friction drive: clean / replace the wheel." },
  obstacle: { n: "Obstacle in the slot", see: "Motor current rises steeply while the fork extends: the tine tip hits a fallen casting at about 1.40 m.",
    plc: "Torque monitoring stops the fork within a few mm (safe torque / current limit), fork retracts slowly, alarm \"fork collision L\", slot blocked.",
    fix: "Operator checks the slot (with lock-out!), removes the part, checks the tine tip for bending (deflection test) and the rack + chains." },
  notcentre: { n: "Fork not at centre before travel", see: "After retracting, the fork stops 30 mm before the centre (encoder offset, chain slack): the safe centre-position sensor stays OFF.",
    plc: "Interlock: travel and hoist are blocked (STO on travel + hoist). Alarm \"fork not centred\". Only the fork may move (slowly) to the centre.",
    fix: "Re-home the fork (reference run on the centre sensor), check encoder coupling, chain tension. The interlock is a safety function (EN 528 / EN ISO 13849, PL d typical – check)." },
  overload: { n: "Overload (360 kg)", see: "During the lift the hoist load pins (or the motor current) see 360 kg > 300 kg + 10 %.",
    plc: "Hoist stops lifting, lowers the crate back onto the beams, fork retracts EMPTY, alarm \"overload\", slot blocked for inspection.",
    fix: "Weigh the crate, correct the WMS master data. The infeed weighing station should have rejected it (guide 31 §10)." },
};

/* connection with the load */
export const IFACE = [
  ["Tines", "2 tines at ± 250 mm (500 mm apart), top stage 110 mm wide, middle 140 mm, base 170 mm; fork envelope 80 mm high", "same as items 1 + 6"],
  ["Crate", "1 200 × 800 × 600 mm, ≤ 300 kg, steel; 2 runners (feet) 50 × 120 mm at ± 375 mm along the fork direction", "the tines run in the 2 channels between the runners"],
  ["Clearance under the crate floor", "40 mm when the fork extends (approach height)", "≥ fork deflection 4.9 mm + z-budget 8.2 mm RSS (guide 31 §9) + crate floor sag"],
  ["Clearance middle stage ↔ beam top", "120 − 40 − 52 = 28 mm", "≥ worst case z 18 mm (guide 31 §9)"],
  ["Side clearance runner ↔ middle stage", "375 − 25 − (250 + 70) = 30 mm (top stage 45 mm)", "≥ worst case x 20 mm (guide 31 §9)"],
  ["Crate ↔ load guide", "27.5 mm each side (20 mm guide in the 75 mm gap between 2 crates)", "lead-in 45°: centres a crate that is up to ≈ 25 mm off"],
  ["Lift stroke", "100 mm in 0.5 s = 40 mm to touch + 60 mm free", "same as items 1 + 6 (asrscore liftDz, tLift)"],
  ["Deposit position", "crate centre at 1 350 mm ± 5 mm (depth), rear stop 30 mm behind the crate", "position error RSS 1.6 mm (calc F)"],
  ["Carry type", "lift carry (the crate sits on the tines, no sliding)", "friction carry (pull the crate on rollers) only for totes / cartons"],
];
export const PALLET = [
  ["Load", "crate with runners (our case)", "EUR pallet 1 200 × 800 (EN 13698-1)"],
  ["Where the tines go", "in the open channels between the 2 runners – under the crate floor", "into the pallet openings between the blocks (≈ 100 mm high)"],
  ["Tine spacing", "500 mm (fits the runners at ± 375)", "must fit the openings – ≈ 330 mm centres for the 800 side (check the pallet)"],
  ["Height budget", "runner 120 mm = 40 under floor + 52 fork + 28 over beam", "opening ≈ 100 mm = 25 + 52 + 23 mm – tight, needs a thin fork"],
  ["Risk", "crate is stiff, runners straight ± 2 mm", "broken boards, nails, sagging pallets, film hanging down → contour check before storing"],
  ["Rack", "2 beams (front + rear), crate runners across them", "2 beams, the pallet bottom boards across them"],
];
export const LHD = [
  ["Telescopic fork (ours)", "crates, pallets 100 – 1 500 kg", "lifts the load (lift carry), both sides, single or double deep", "robust, accurate, independent of the load bottom", "needs free channels under the load; slow-ish (2 × 2.2 s)"],
  ["Chain / roller conveyor on the carriage", "pallets, crates with flat bottom", "pulls / pushes the load on rollers into a conveyor-type slot (channel rack)", "fast, simple, no lift", "needs conveyors or rollers in every slot (channel rack) → expensive rack"],
  ["Shuttle with gripper arms (fingers)", "totes, cartons 20 – 50 kg (mini-load)", "arms go beside the tote, fingers fold behind it and pull it on a belt", "very fast, multi-deep, any tote size (adjustable width)", "light loads only; tote must be stiff"],
  ["Clamping arms", "cartons, trays, tyres", "2 belts / plates clamp the load from the sides and pull it", "no free space under the load needed", "load must take the clamping force"],
  ["Satellite (channel shuttle)", "pallets, many per SKU", "a battery car drives under the pallet deep into a channel", "very deep lanes (10 – 40 pallets)", "LIFO lanes; charging; slower per load"],
];

/* manufacturing + maintenance */
export const MFG = [
  ["Stage profiles", "cold-formed or laser-cut + welded S690QL / S355 (base, middle, top); or aluminium extrusions for light forks", "short intermittent welds, alternate sides; pre-camber ≈ 2 mm up at the tip (guide 38 §14.7)", "straightness 0.2 / 1 m, camber per drawing"],
  ["Guide strips", "hardened steel strips (C45 induction hardened 50 – 55 HRC, or bright drawn spring steel) screwed / bonded on the running faces", "ground or drawn, screwed every 100 mm, joints offset", "parallel ± 0.1 mm over the stage, no step at the joints"],
  ["Rollers / cam followers", "bought: stud-type cam followers or track rollers with needle bearings, some on eccentric studs to set the play", "press-fit / screw in reamed holes; eccentric rollers set to 0.1 – 0.2 mm play", "turn freely, no play at the tip > 0.4 mm per overlap"],
  ["Rack", "module 2, C45 or 42CrMo4, teeth induction hardened; bought as straight rack bars and machined to length", "screw + dowel to the middle stage; joints with a gauge pinion", "pitch error across a joint ≤ 0.02 mm; parallel to the guide strips ± 0.05"],
  ["Pinions + shafts", "4 pinions 20 teeth m 2 (bought or hobbed), shrink discs on 2 synchronising shafts, coupling chain", "all pinions set to the same tooth phase on the racks (tines synchronous, no fighting when 2 mesh)", "tines level ± 0.5 mm, same position ± 1 mm"],
  ["Chains + anchors", "roller chain 06B-1 (ISO 606) or leaf chain; anchors with threaded tension rods + lock nuts", "assemble in the centre position, both chains of a tine equal", "chain tension per procedure below"],
  ["Surface", "zinc-nickel or zinc-flake on small parts; paint on the base; running faces bare + oiled", "mask the running faces and rack", "DFT per paint system"],
];
export const TENSION = [
  "Lock out the crane (EN 528 maintenance mode), fork in the centre position, no load.",
  "Measure the chain sag in the middle of the free span (or the force with a spring scale): example target 2 – 3 mm sag at 20 N.",
  "Loosen the lock nut of the anchor on the top stage; turn the tension rod until the target is reached. Do the OTHER chain of the same tine the same amount – the top stage must stay in the centre (± 1 mm).",
  "Repeat on the second tine. Check both tines are at the same position (± 1 mm) and level (± 0.5 mm).",
  "Lock nuts, mark the nuts with paint, run the fork 10 × to both sides at slow speed, check again.",
  "Run a reference (homing) on the centre sensor; check the end positions L / R with the encoder (± 2 mm).",
  "Measure the elongation over 10 links with a gauge: replace the chain at 2 – 3 % (maker's limit) – always both chains of a tine, and check the sprockets.",
];
export const MAINT = [
  ["Daily", "visual: tine tips (bent? cracks?), crates on the fork centred, no oil leaks, no unusual noise", "operator"],
  ["Weekly", "end-position and centre-sensor function test (move fork, watch the lamp), clean sensor lenses", "operator / maintenance"],
  ["Monthly", "lubricate chains (oil, brush or drip) and the rack (adhesive grease); check rollers turn freely; wipe guide strips", "maintenance"],
  ["3-monthly", "chain tension + equal length; fork level (± 0.5 mm) and centre position; roller play (tip play test); gearbox oil level", "maintenance (guide 38 §17)"],
  ["Yearly", "chain elongation gauge; rack wear (tooth thickness, pitting); pinion; rollers + strips wear; deflection test with 300 kg at full stroke (≤ 4.9 mm); brake test of the fork motor", "maintenance + crane maker"],
  ["5 – 8 years / at limits", "replace chains (2 – 3 % elongation), rollers, guide strips, pinion; overhaul gear motor", "crane maker / service"],
];
export const FAILS = [
  ["Chain elongation", "wear in pins and bushes, no oil", "top stage lags, tines at different positions, slip alarm", "re-tension, oil, replace at 2 – 3 %"],
  ["Tine tip too low", "no pre-camber, roller play, overload", "tine hits the beam or the crate runner", "set roller play, pre-camber, deflection test"],
  ["Bent tine after collision", "crate offset, obstacle, teach-in wrong", "fork jams, deflection high", "torque monitoring, occupancy + overhang sensors; straighten or replace the stage"],
  ["Rack tooth wear / pitting", "no grease, dirt, overload", "noise, backlash, position error", "adhesive grease, covers, replace rack + pinion"],
  ["Roller flats / seized", "shock loads, dirt, no grease", "stage jerks, noise", "sealed cam followers, replace in sets"],
  ["Guide strip worn / loose", "screws loose, no hardening", "stage drops, play", "harden strips, thread lock, check torque"],
  ["Tines not synchronous", "pinion slipped on the shaft, chains of the 2 tines not equal", "crate twisted on the fork", "shrink disc / key, set chains equal, check level"],
  ["Sensor misaligned / dirty", "vibration, dust", "false overhang / occupancy alarms", "rigid brackets, weekly cleaning, function test"],
];

/* parts list of one fork (2 tines) */
export const BOM7 = [
  ["1", "Base stage (U-channel, guide strips)", "MAKE", "S690QL / S355 + hardened strips", 2, 45],
  ["2", "Middle stage (with rack seat + sprocket axles)", "MAKE", "S690QL, milled tracks ± 0.1", 2, 30],
  ["3", "Top stage = tine (wear pads, tip chamfer)", "MAKE", "S690QL, pre-camber 2 mm", 2, 22],
  ["4", "Rack m 2, L = 1 000 mm", "BUY + machine", "C45 / 42CrMo4, induction hardened", 2, 3],
  ["5", "Pinion m 2, z 20 (2 per tine)", "BUY", "hardened, with shrink disc", 4, 0.5],
  ["6", "Synchronising shafts Ø30 + bearings + coupling chain", "MAKE + BUY", "42CrMo4 +QT, 2 flange bearings each, 06B chain + 2 sprockets", 2, 4.5],
  ["7", "Gear motor 1.1 kW, helical-bevel, i ≈ 5.9, brake + encoder", "BUY", "servo or asynchronous + inverter", 1, 22],
  ["8", "Roller chain 06B-1 (ISO 606), ≈ 1.6 m", "BUY", "with tension rods + anchors", 4, 0.6],
  ["9", "Sprockets 06B z 9 with axles + bearings", "BUY + machine", "hardened teeth", 4, 0.2],
  ["10", "Cam followers / track rollers (some eccentric)", "BUY", "sealed, needle bearings", 16, 0.15],
  ["11", "Guide strips, wear pads, end stops", "MAKE + BUY", "hardened steel, PU pads", 1, 6],
  ["12", "Sensors: centre (safe, 2 ch), end L/R, load-on-fork, overhang, occupancy", "BUY", "SICK / Leuze / Pepperl+Fuchs – check", 1, 3],
  ["13", "Cable + energy chain on the carriage, terminal box", "BUY", "drag-chain cable", 1, 3],
];

/* catalogue card (makeCard config) */
export const CARD7 = {
  drawings: [
    { f: "39_fork_section.svg", t: "Telescopic fork – 3-stage section", c: "Nested stages, rollers, guide strips, rack, pinion, chain planes, sizes", g: "guide 39 §5" },
    { f: "39_stroke_doubling.svg", t: "Stroke doubling with chains", c: "Chain anchored on base + top stage, sprocket on the middle stage: s_top = 2·s_mid", g: "guide 39 §6" },
    { f: "39_drive_train.svg", t: "Drive train", c: "Gear motor + brake + encoder → 2 coupled shafts → 2 pinions per tine → racks; numbers", g: "guide 39 §7" },
    { f: "39_pickup_sequence.svg", t: "Pick-up sequence – 5 frames", c: "Position, extend, lift 100 mm, retract, check – heights + clearances", g: "guide 39 §10" },
    { f: "39_slot_clearances.svg", t: "Clearances at the slot", c: "40 mm under the floor, 28 mm over the beam, 30 mm side, load guides", g: "guide 39 §9" },
    { f: "39_timing_diagram.svg", t: "Timing diagram", c: "Fork position, speed, hoist z – 2.18 + 0.5 + 2.18 = 4.87 s", g: "guide 39 §10" },
    { f: "39_deflection_model.svg", t: "Deflection model", c: "3 cantilevers in series + roller play = 4.9 mm; roller reaction couple", g: "guide 39 §8" },
    { f: "39_sensor_layout.svg", t: "Sensor layout on the carriage", c: "Centre (safe), end L/R, load-on-fork, overhang, occupancy, fine positioning", g: "guide 39 §11" },
  ],
  groups: [
    { id: "fork", t: "Complete telescopic forks", src: "guide 39 §16", rows: [
      ["Telescopic fork, single deep", "300 – 1 500 kg, ± 1 350 mm, 1 m/s", "Eurofork (Italy) – check current range", "see datasheet", "€€€ – ask for a quote", "deflection at full stroke, double-deep option, drive included?"],
      ["Telescopic fork", "unit load / mini-load", "MIAS Group – check", "see datasheet", "€€€", "load, stroke, height of the fork envelope"],
      ["Fork as part of the crane", "–", "crane makers build in-house (e.g. Swisslog, Dematic, SSI Schaefer, Kardex Mlog, Stöcklin – check)", "–", "in the crane price", "spare parts + chain life"],
    ] },
    { id: "drive", t: "Gear motors, racks, pinions, chains, belts", src: "guide 39 §7 + §16", rows: [
      ["Helical-bevel gear motor 1.1 kW", "i ≈ 6, brake, encoder", "SEW-Eurodrive (K / KA gear + DRN motor + BE brake; or CMP servo)", "see datasheet", "€€", "torque ≥ 6.5 N·m × service factor, encoder interface"],
      ["Helical-bevel gear motor 1.1 kW", "as above", "Nord (SK helical-bevel + brake + encoder), Lenze (g500-B) – check", "see datasheet", "€€", "same"],
      ["Rack m 2 + pinion z 20", "hardened, quality 6–8", "Atlanta Antriebssysteme, WMH Herion, Güdel – check", "see datasheet", "€€", "quality class, joint gauge, hardened teeth"],
      ["Roller chain 06B-1", "ISO 606, F_B ≥ 8.9 kN (check)", "iwis, Renold, Tsubaki", "see datasheet", "€ per m", "breaking load, wear resistance, pre-stretched"],
      ["Sprocket 06B z 9 – 12", "hardened teeth", "chain makers or stock sprockets (e.g. Mädler – check)", "see datasheet", "€", "hardened, bore"],
      ["Toothed belt (belt version)", "steel cord PU", "Gates, ContiTech, Brecoflex – check", "see datasheet", "€€", "tensile strength, clamp plates"],
    ] },
    { id: "rollers", t: "Rollers, cam followers, guides", src: "guide 39 §12", rows: [
      ["Cam follower (stud type)", "needle bearing, eccentric option", "Schaeffler INA (KR / KRE / NUKR series)", "C₀ – see datasheet", "€ each", "static rating ≥ 2 × 2.85 kN, eccentric for play"],
      ["Cam follower", "as above", "McGill (Regal Rexnord) CAMROL, SKF, IKO, THK – check", "see datasheet", "€ each", "seals, lubrication"],
      ["Combined / track rollers", "radial + axial", "Winkel, Nadella – check", "see datasheet", "€€", "axial guidance of the stages"],
    ] },
    { id: "sens", t: "Encoders + sensors", src: "guide 39 §11", rows: [
      ["Motor encoder", "incremental / absolute, 4 096 counts", "SICK (DFS60 / AFS60), Kübler (Sendix), Heidenhain – check", "see datasheet", "€", "interface (HTL / SSI / HIPERFACE), shaft"],
      ["Safe centre-position sensor", "inductive, safety-rated", "SICK IN4000, Pepperl+Fuchs safety inductive – check", "PL – see datasheet", "€€", "2 channels, PL d / SIL 2"],
      ["Diffuse / distance sensor (occupancy, load on fork)", "background suppression", "SICK W16 / W12, Leuze HT / ODS, Pepperl+Fuchs R100 – check", "see datasheet", "€", "range, black / shiny surfaces"],
      ["Light barrier (overhang)", "through-beam", "SICK, Leuze, Pepperl+Fuchs – check", "see datasheet", "€", "length ≈ 1 m, alignment"],
      ["Reflex sensor (fine positioning)", "flag at each slot", "SICK, Leuze – check", "see datasheet", "€", "repeatability ± 1 mm"],
    ] },
  ],
  shopCols: ["Pos", "Qty", "Item", "Spec (from the guide)", "Example (choose one maker per item)", "Price class (estimate – ask for a quote)"],
  shop: [
    ["1", "1", "Gear motor 1.1 kW, i ≈ 5.9, brake + encoder", "helical-bevel, hollow shaft", "SEW / Nord / Lenze", "€€"],
    ["2", "2 + 4", "Rack m 2 L 1 000 + pinion z 20", "hardened", "Atlanta / WMH Herion", "€€"],
    ["3", "4 × 1.6 m", "Roller chain 06B-1 + tension rods", "ISO 606", "iwis / Renold / Tsubaki", "€"],
    ["4", "4", "Sprockets 06B z 9 + axles", "hardened", "chain maker / stock", "€"],
    ["5", "16", "Cam followers (8 eccentric)", "sealed", "Schaeffler INA / McGill", "€"],
    ["6", "≈ 200 kg", "Steel S690QL + S355 for 6 stages", "laser cut", "steel service centre", "€€"],
    ["7", "1 set", "Guide strips hardened + wear pads", "C45 50 – 55 HRC", "local / stock", "€"],
    ["8", "1 set", "Sensors (centre safe, end, load, overhang, occupancy)", "see buy list", "SICK / Leuze / P+F", "€€"],
    ["9", "1", "Chain gauge + spring scale + feeler gauges", "maintenance", "chain maker / tool shop", "€"],
  ],
  shopM: 4, shopP: 5, guides: "guide 39", shopTab: "Shopping list – one fork", ph: "(e.g. SEW, 06B, INA, SICK)", shopLbl: "shopping list", shopPrice: true,
  buyNote: "Price classes are rough estimates – always ask 2 – 3 suppliers for a quote.",
  shopTitle: "Purchased material for ONE telescopic fork with 2 tines (example, guide 39 §16). Labour and machining are not included. Buying the complete fork is the normal choice for a first crane.",
  shopNote: "Example list – the fork maker's BOM decides.",
};
