/* AS/RS item 1 – data for the card "Real components + drawings – catalogue examples" (#srCard1, makeCard from robotref.js).
 * GENERATED from docs/31_asrs_mechanical_3d.md §18 (buy list), §19 (shopping list), §25 (drawings) – do not edit by hand; regenerate with tools/gen_asrs1_card.py.
 * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.
 */
export const CARD = {
 "drawings": [
  {
   "f": "31_rack_elevation.svg",
   "t": "Rack – front elevation + cross-section",
   "c": "Front elevation of rack L (bays 1–3, 14) with level heights + cross-section with aisle, crane, dimensions",
   "g": "guide 31 §5"
  },
  {
   "f": "31_slot_numbering.svg",
   "t": "Slot numbering scheme",
   "c": "Slot id scheme: plan view with bays / positions, front view of bay 03, coordinate formula",
   "g": "guide 31 §6.9"
  },
  {
   "f": "31_rack_load_diagram.svg",
   "t": "Rack loads – beam, upright, floor",
   "c": "Beam with 2 point loads, moment and deflection, upright load from 7 levels, base plate",
   "g": "guide 31 §6.2"
  },
  {
   "f": "31_crane_ga.svg",
   "t": "Stacker crane – general arrangement",
   "c": "Stacker crane general arrangement: side view + view across, main data",
   "g": "guide 31 §7.1"
  },
  {
   "f": "31_crane_drive_train.svg",
   "t": "Crane drive trains – travel + hoist",
   "c": "Travel and hoist drive trains with the worked numbers",
   "g": "guide 31 §7.4"
  },
  {
   "f": "31_mast_deflection.svg",
   "t": "Mast deflection model",
   "c": "Cantilever model of the mast, deflection, natural frequency",
   "g": "guide 31 §7.5"
  },
  {
   "f": "31_io_layout.svg",
   "t": "I/O area layout (plan)",
   "c": "I/O plan: conveyors, weighing, contour gate, scanner, fence, door, light curtains",
   "g": "guide 31 §7.11"
  },
  {
   "f": "31_fem9851_cycle.svg",
   "t": "FEM 9.851 cycle – P1 / P2",
   "c": "FEM 9.851 points P1 / P2, move table, SC / DC times",
   "g": "guide 31 §8"
  },
  {
   "f": "31_positioning_budget.svg",
   "t": "Positioning accuracy budget",
   "c": "Positioning accuracy budget x and z",
   "g": "guide 31 §9"
  }
 ],
 "groups": [
  {
   "id": "b18_1",
   "t": "Complete AS/RS suppliers (rack + crane + conveyors + controls + WMS)",
   "src": "guide 31 §18.1",
   "rows": [
    [
     "Complete unit-load AS/RS",
     "1 aisle, 392 crate slots, 9.5 m, 300 kg, FEM SC ≤ 35 s",
     "SSI Schäfer (unit-load stacker cranes, WAMAS WMS)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "FEM 9.851 times, Wh per cycle, references with crates, service network"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Dematic (unit-load AS/RS)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "crate handling, double-deep option, availability guarantee"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Swisslog (Vectura pallet stacker crane)",
     "heights up to ≈ 45 m (maker claim – check)",
     "€€€€ – ask for a quote",
     "energy recovery, SynQ software interface"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "TGW (unit-load stacker cranes – check current name)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "crane + conveyor portfolio, service"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Kardex Mlog (MSP pallet stacker cranes)",
     "single / twin mast – see datasheet",
     "€€€€ – ask for a quote",
     "modular crane, retrofit capability"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Jungheinrich (AS/RS + racking)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "combination with forklifts / VNA, WMS"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Mecalux (pallet stacker cranes, Easy WMS)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "rack-clad options, price level"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Stöcklin Logistik (pallet stacker cranes)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "compact cranes"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Vanderlande (pallet / unit-load systems)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "larger systems; check if 1 aisle is in scope"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "viastore (viapal stacker cranes, viadat WMS) – check",
     "see datasheet",
     "€€€€ – ask for a quote",
     "mid-size systems, software"
    ],
    [
     "Complete unit-load AS/RS",
     "as above",
     "Daifuku (unit-load AS/RS)",
     "see datasheet",
     "€€€€ – ask for a quote",
     "local service in your region"
    ]
   ]
  },
  {
   "id": "b18_2",
   "t": "Rack makers (crane racks, EN 15512)",
   "src": "guide 31 §18.2",
   "rows": [
    [
     "High-bay crane rack",
     "9.5 m, 14 bays × 2 crates × 7 levels × 2 sides, crane tolerance class",
     "SSI Schäfer (pallet racking / high-bay racks)",
     "see datasheet",
     "€€€ – ask for a quote",
     "EN 15512 calculation, tolerance table vs FEM 9.831, seismic"
    ],
    [
     "High-bay crane rack",
     "as above",
     "Mecalux (pallet racking for AS/RS)",
     "see datasheet",
     "€€€ – ask for a quote",
     "connector tests, anchors, load signs"
    ],
    [
     "High-bay crane rack",
     "as above",
     "Stow (pallet racking – check AS/RS references)",
     "see datasheet",
     "€€€ – ask for a quote",
     "EN 15635 inspection service"
    ],
    [
     "High-bay crane rack",
     "as above",
     "AR Racking / Nedcon / Jungheinrich – check",
     "see datasheet",
     "€€€ – ask for a quote",
     "supply + erection + survey"
    ],
    [
     "Rack inspection",
     "yearly expert inspection EN 15635",
     "rack maker service or independent inspector (e.g. SEMA approved in the UK, national equivalents)",
     "report with damage classes",
     "€ per year",
     "qualification of the inspector"
    ]
   ]
  },
  {
   "id": "b18_3",
   "t": "Travel wheels, rails, rail fixing, buffers",
   "src": "guide 31 §18.3",
   "rows": [
    [
     "Wheel block (drive)",
     "Ø400, ≈ 30 kN, steel, for a shaft-mounted gearbox",
     "Demag DRS wheel block system",
     "sizes – see datasheet",
     "€€ per block",
     "load table vs speed, rail width, flange or guide rollers"
    ],
    [
     "Wheel block",
     "as above",
     "Stahl CraneSystems / ABM / Gigant – check",
     "see datasheet",
     "€€ per block",
     "wheel material, hardness, bearing life"
    ],
    [
     "Guide rollers",
     "PU on steel, Ø100–150",
     "Blickle, Tente, Colson – check",
     "load per roller – see datasheet",
     "€ each",
     "PU hardness, temperature, flat spots after standstill"
    ],
    [
     "Bottom rail",
     "flat bar 50 × 30 S355J2 or crane rail A45 / A55",
     "steel stockholders; crane rails e.g. ArcelorMittal, Gantrex",
     "see datasheet",
     "€€",
     "straightness, joints (welded / step joint)"
    ],
    [
     "Rail fixing",
     "clamps + sole plates + pads + grout",
     "Gantrex (rail clamps, pads) – check",
     "clamp pitch per load",
     "€€",
     "adjustability ± 10 mm, grout type"
    ],
    [
     "Non-shrink grout",
     "under sole plates",
     "Pagel (V1 / V14), Sika (SikaGrout) – check",
     "compressive strength – see datasheet",
     "€",
     "flowability, curing time"
    ],
    [
     "Buffers",
     "½·m·v² at the reduced speed (2.25 kJ at 1 m/s)",
     "ACE (industrial shock absorbers), Enidine – check; PU buffers e.g. Demag DPZ",
     "stroke and energy – see datasheet",
     "€€",
     "energy capacity vs slowdown speed"
    ]
   ]
  },
  {
   "id": "b18_4",
   "t": "Drives (geared motors, inverters, safe motion)",
   "src": "guide 31 §18.4",
   "rows": [
    [
     "Travel geared motor",
     "7.5 kW, i ≈ 10, brake, encoder, shaft-mounted",
     "SEW-Eurodrive (K helical-bevel gear + DRN motor + BE brake)",
     "see datasheet",
     "€€",
     "output torque ≥ 561 N·m × service factor, brake torque, encoder"
    ],
    [
     "Travel geared motor",
     "as above",
     "Nord (SK helical-bevel gear units)",
     "see datasheet",
     "€€",
     "same"
    ],
    [
     "Travel geared motor",
     "as above",
     "Lenze (g500-B bevel gearbox + m550 / MCS servo)",
     "see datasheet",
     "€€",
     "same"
    ],
    [
     "Hoist geared motor",
     "11 kW, i ≈ 19, brake, encoder",
     "SEW / Nord / Lenze / Bauer (Danfoss)",
     "see datasheet",
     "€€",
     "brake work per stop, thermal class, IP"
    ],
    [
     "Fork drive",
     "1.1 kW servo / geared motor",
     "SEW (CMP + gear), Lenze, Siemens 1FK7 / 1FK2",
     "see datasheet",
     "€",
     "positioning accuracy, STO"
    ],
    [
     "Drive system with shared DC link",
     "7.5 + 11 + 1.1 kW, regenerative supply or braking resistor",
     "SEW MOVIDRIVE modular, Siemens SINAMICS S120 / S210, Lenze i950, Danfoss VLT – check",
     "see datasheet",
     "€€€",
     "regeneration, safety functions (STO, SS1, SLS), fieldbus"
    ],
    [
     "Safe speed / position",
     "SLS, SLP for end-of-aisle",
     "drive-integrated safety + safe encoder or safety PLC",
     "PL d / SIL 2 – see datasheet",
     "€€",
     "certified functions, encoder diagnostic coverage"
    ]
   ]
  },
  {
   "id": "b18_5",
   "t": "Laser distance sensors (x and z)",
   "src": "guide 31 §18.5",
   "rows": [
    [
     "Laser distance sensor travel",
     "≥ 35 m to a reflector, ≤ 2 mm repeatability, PROFINET / SSI",
     "SICK DL100 Pro",
     "range on reflector – see datasheet",
     "€€",
     "interface, heating, max speed, reflector size"
    ],
    [
     "Laser distance sensor travel",
     "as above",
     "Leuze AMS 300i / AMS 200",
     "see datasheet",
     "€€",
     "same"
    ],
    [
     "Laser distance sensor hoist",
     "≥ 10 m",
     "SICK DL100 / Dx100, Leuze AMS 200",
     "see datasheet",
     "€€",
     "mounting on the carriage, vibration"
    ],
    [
     "Short-range distance sensor (fine positioning, fork)",
     "0.2–10 m, natural surface",
     "SICK DT50 / Dx50, Leuze ODS – check",
     "see datasheet",
     "€",
     "response time, surface reflectivity"
    ],
    [
     "Reflector",
     "size per range",
     "from the sensor maker",
     "–",
     "€",
     "heated / anti-fog"
    ]
   ]
  },
  {
   "id": "b18_6",
   "t": "Bar-code positioning",
   "src": "guide 31 §18.6",
   "rows": [
    [
     "Bar-code positioning system",
     "absolute, tape along the rail, ≤ 0.1 mm",
     "Leuze BPS 300i (BPS 8 older)",
     "resolution – see datasheet",
     "€€ + tape per m",
     "tape length, max speed, interface"
    ],
    [
     "Optical positioning system",
     "absolute, code tape",
     "SICK OLV / OLM – check",
     "see datasheet",
     "€€",
     "tape type, curves"
    ],
    [
     "Code tape",
     "per metre, with fix points",
     "from the sensor maker",
     "–",
     "€ per m",
     "temperature expansion, adhesive vs clip"
    ]
   ]
  },
  {
   "id": "b18_7",
   "t": "Data transmission to the crane",
   "src": "guide 31 §18.7",
   "rows": [
    [
     "Optical data transmission",
     "PROFINET 100 Mbit/s, ≥ 35 m",
     "Leuze DDLS 500",
     "range – see datasheet",
     "€€ pair",
     "real-time / IRT support, alignment aid"
    ],
    [
     "Optical data transmission",
     "as above",
     "SICK ISD 400",
     "see datasheet",
     "€€ pair",
     "same"
    ],
    [
     "Slotted microwave / wireless",
     "alternative",
     "Vahle SMG, industrial WLAN (Siemens SCALANCE, Phoenix Contact) – check",
     "see datasheet",
     "€€",
     "latency, safety protocol approval"
    ]
   ]
  },
  {
   "id": "b18_8",
   "t": "Power rails and energy chains",
   "src": "guide 31 §18.8",
   "rows": [
    [
     "Enclosed conductor rail",
     "5-pole, ≈ 60 A, 32 m + collector",
     "Vahle KBH / U10",
     "see datasheet",
     "€€",
     "current at duty cycle, voltage drop, double PE brush"
    ],
    [
     "Enclosed conductor rail",
     "as above",
     "Conductix-Wampfler Program 0812 / 0813",
     "see datasheet",
     "€€",
     "same"
    ],
    [
     "Contactless power (option)",
     "no wear",
     "Vahle CPS, Conductix-Wampfler IPT",
     "see datasheet",
     "€€€",
     "efficiency, power per pickup"
    ],
    [
     "Energy chain (carriage / short aisle)",
     "mast height 9.3 m, cables + data",
     "igus E4.1 / E2 / e-loop",
     "see datasheet",
     "€€",
     "bending radius, hanging / standing application"
    ],
    [
     "Chain cables",
     "for the energy chain",
     "igus chainflex, Lapp ÖLFLEX CHAIN – check",
     "see datasheet",
     "€ per m",
     "cycles, bending radius"
    ]
   ]
  },
  {
   "id": "b18_9",
   "t": "Conveyors (crate / pallet)",
   "src": "guide 31 §18.9",
   "rows": [
    [
     "Chain conveyor for crates",
     "1 200 crates, 300 kg, 0.2 m/s, 6 m",
     "TGW / SSI Schäfer / Dematic (pallet conveyors)",
     "see datasheet",
     "€€ per section",
     "chain type, accumulation, transfer to the crane"
    ],
    [
     "Roller conveyor (option)",
     "runners must suit the rollers",
     "Interroll (pallet conveyor platform)",
     "see datasheet",
     "€€ per section",
     "roller pitch vs crate runners"
    ],
    [
     "Drive rollers / motors",
     "24 V / 400 V",
     "Interroll, Rulmeca – check",
     "see datasheet",
     "€",
     "power, control interface"
    ],
    [
     "Turntable / transfer (if needed)",
     "90° transfer",
     "from the conveyor maker",
     "–",
     "€€",
     "cycle time"
    ]
   ]
  },
  {
   "id": "b18_10",
   "t": "Contour check, ID point, scales",
   "src": "guide 31 §18.10",
   "rows": [
    [
     "Light grid (contour / height)",
     "1.2 m, resolution ≤ 10–20 mm",
     "SICK MLG-2",
     "see datasheet",
     "€€ per grid",
     "beam spacing, response time, IO-Link"
    ],
    [
     "Light grid (contour)",
     "as above",
     "Leuze CML 700i",
     "see datasheet",
     "€€ per grid",
     "same"
    ],
    [
     "Contour check station",
     "complete with PLC logic",
     "from the conveyor / AS/RS maker",
     "–",
     "€€",
     "which sides are checked, tolerance"
    ],
    [
     "Bar-code / DataMatrix reader",
     "label on the crate side, read rate > 99.9 %",
     "SICK Lector 6xx, Cognex DataMan, Keyence SR – check",
     "see datasheet",
     "€€",
     "code type, depth of field, PROFINET"
    ],
    [
     "RFID (option)",
     "UHF tag on the crate",
     "SICK RFU6xx, Balluff, Siemens SIMATIC RF600 – check",
     "see datasheet",
     "€€",
     "on-metal tags"
    ],
    [
     "Weighing conveyor / load cells",
     "4 cells, ≤ 500 kg, ± 0.5 kg",
     "HBK, Mettler Toledo, Flintec – check",
     "see datasheet",
     "€€",
     "accuracy class, overload protection"
    ]
   ]
  },
  {
   "id": "b18_11",
   "t": "Fences, light curtains, door interlocks",
   "src": "guide 31 §18.11",
   "rows": [
    [
     "Mesh fence",
     "2.2 m, ISO 13857 / ISO 14120",
     "Troax (machine guarding panels)",
     "see datasheet",
     "€ per m",
     "mesh size vs reach distance, impact rating"
    ],
    [
     "Mesh fence",
     "as above",
     "Axelent (X-Guard)",
     "see datasheet",
     "€ per m",
     "same"
    ],
    [
     "Door interlock with guard locking",
     "PL d, trapped-key option",
     "Pilz PSENmlock, Euchner MGB, Schmersal AZM",
     "see datasheet",
     "€€",
     "PL / category, escape release"
    ],
    [
     "Light curtain type 4 with muting",
     "conveyor opening 1.3 × 1.0 m",
     "SICK deTec4, Leuze MLC 530, Pilz PSENopt – check",
     "see datasheet",
     "€€",
     "muting function, resolution, safety distance"
    ],
    [
     "Safety laser scanner (option, aisle end)",
     "presence detection in the maintenance area",
     "SICK microScan3, Leuze RSL 400",
     "see datasheet",
     "€€",
     "fields, PL"
    ]
   ]
  },
  {
   "id": "b18_12",
   "t": "Hoist ropes, telescopic forks, carriage sensors",
   "src": "guide 31 §18.12",
   "rows": [
    [
     "Wire rope",
     "2 × Ø8 mm, MBF ≥ 40 kN each",
     "Teufelberger, Casar (WireCo), Pfeifer – check",
     "MBF – see datasheet",
     "€ per m",
     "grade, lay, D/d of pulleys, discard criteria"
    ],
    [
     "Toothed belt (alternative to ropes)",
     "steel-cord PU belt",
     "Gates, ContiTech, Brecoflex – check",
     "see datasheet",
     "€€",
     "tensile strength, elongation"
    ],
    [
     "Telescopic fork",
     "300 kg, ± 1 350 mm, 1 m/s",
     "usually from the crane maker; specialists e.g. Eurofork – check",
     "see datasheet",
     "€€€",
     "deflection at full stroke, chain life, double-deep option"
    ],
    [
     "Occupancy / overhang sensors",
     "reflex sensors on the carriage",
     "SICK W12 / W16, Leuze – check",
     "see datasheet",
     "€",
     "background suppression, dust"
    ],
    [
     "Overload / slack rope",
     "load pin or switch",
     "HBK, Tecsis – check",
     "see datasheet",
     "€€",
     "safety integration"
    ]
   ]
  },
  {
   "id": "b18_13",
   "t": "Floor, anchors, survey",
   "src": "guide 31 §18.13",
   "rows": [
    [
     "Heavy-duty anchors",
     "M12, cracked concrete, ETA",
     "Hilti HST3, fischer FAZ II, Würth – check",
     "see ETA",
     "€ each",
     "slab thickness, edge distance, torque"
    ],
    [
     "Floor flatness survey",
     "profilograph / levelling grid",
     "survey service with F-meter / digital level – check",
     "–",
     "€ service",
     "standard used (DIN 15185 / EN 15620 / TR 34)"
    ],
    [
     "Rack + rail survey",
     "total station / laser tracker",
     "Leica, Trimble – service provider",
     "–",
     "€ service",
     "report per slot for the teach-in"
    ]
   ]
  }
 ],
 "shops": [
  {
   "title": "",
   "cols": [
    "#",
    "Qty",
    "Item",
    "Spec (from this guide)",
    "Example maker / series",
    "Price class"
   ],
   "rows": [
    [
     "1",
     "1",
     "Turnkey AS/RS package",
     "392 slots, 1 crane, I/O, controls, WMS interface, FEM SC ≤ 35 s",
     "§18.1 suppliers",
     "€€€€ – ask for a quote"
    ],
    [
     "2",
     "60",
     "Uprights (52 inner + 8 end)",
     "perforated omega 100 × 70 × 2.5, S355, 9.5 m",
     "rack maker §18.2",
     "€€€ (set)"
    ],
    [
     "3",
     "30",
     "Frame bracing sets",
     "zig-zag C 40 × 30 × 2, ≈ 900 pitch + bolts",
     "rack maker",
     "included"
    ],
    [
     "4",
     "392",
     "Beams with connectors + safety locks",
     "box 120 × 50 × 2.0, span 1 825",
     "rack maker",
     "€€€ (set)"
    ],
    [
     "5",
     "6",
     "Rear down-aisle X-bracing sets",
     "bays 1, 7, 14 × 2 sides",
     "rack maker",
     "included"
    ],
    [
     "6",
     "60",
     "Base plates + shims",
     "150 × 120 × 8",
     "rack maker",
     "included"
    ],
    [
     "7",
     "120",
     "Heavy-duty anchors",
     "M12, ETA, cracked concrete",
     "Hilti / fischer",
     "€"
    ],
    [
     "8",
     "8 + 2",
     "Top ties + portals",
     "aisle-crossing ties, front / rear portals",
     "rack / crane maker",
     "€€"
    ],
    [
     "9",
     "784",
     "Load guides",
     "galvanised, lead-in 30–45°",
     "rack maker",
     "€€"
    ],
    [
     "10",
     "392",
     "Slot labels with bar code",
     "id SIDE-BAY-POS-LEVEL",
     "label supplier",
     "€"
    ],
    [
     "11",
     "400",
     "Steel mesh crates",
     "1 200 × 800 × 600, runners at ± 250, 300 kg",
     "crate maker (e.g. Schoeller Allibert, Heson, Walther – check)",
     "€€€"
    ],
    [
     "12",
     "1",
     "Stacker crane, single mast",
     "4 200 kg moving mass, 3 m/s / 1 m/s, fork ± 1 350",
     "§18.1",
     "€€€€"
    ],
    [
     "13",
     "2",
     "Wheel blocks (drive + idler)",
     "Ø400, ≈ 30 kN",
     "Demag DRS / crane maker",
     "€€"
    ],
    [
     "14",
     "1",
     "Travel geared motor + brake + encoder",
     "7.5 kW, i ≈ 10",
     "SEW / Nord / Lenze",
     "€€"
    ],
    [
     "15",
     "1",
     "Hoist geared motor + brake + drum",
     "11 kW, i ≈ 19, drum Ø250",
     "SEW / Nord / Lenze",
     "€€"
    ],
    [
     "16",
     "1",
     "Telescopic fork",
     "3-stage, 300 kg, 1.1 kW",
     "crane maker",
     "€€€"
    ],
    [
     "17",
     "2",
     "Hoist ropes",
     "Ø8, MBF ≥ 40 kN, 2 × 25 m",
     "Teufelberger / Casar",
     "€"
    ],
    [
     "18",
     "1",
     "Drive system",
     "shared DC link, regen, STO / SLS",
     "SEW / Siemens / Lenze",
     "€€€"
    ],
    [
     "19",
     "2",
     "Laser distance sensors + reflectors",
     "travel ≥ 35 m, hoist ≥ 10 m",
     "SICK DL100 Pro / Leuze AMS 300i",
     "€€"
    ],
    [
     "20",
     "1",
     "Bar-code positioning (option / redundancy)",
     "32 m tape + reader",
     "Leuze BPS 300i",
     "€€"
    ],
    [
     "21",
     "1",
     "Optical data transmission pair",
     "PROFINET 100 Mbit/s",
     "Leuze DDLS 500 / SICK ISD 400",
     "€€"
    ],
    [
     "22",
     "1",
     "Conductor rail + collector + feed box",
     "5-pole, ≈ 60 A, 32 m",
     "Vahle KBH / Conductix 0813",
     "€€"
    ],
    [
     "23",
     "32 m",
     "Bottom rail + clamps + sole plates + grout",
     "flat bar 50 × 30 S355J2",
     "Gantrex / stockholder",
     "€€"
    ],
    [
     "24",
     "32 m",
     "Top guide rail",
     "flat bar 100 × 20",
     "stockholder",
     "€"
    ],
    [
     "25",
     "2",
     "End buffers + end-of-aisle switches",
     "2.25 kJ at 1 m/s",
     "ACE / Demag",
     "€€"
    ],
    [
     "26",
     "2",
     "Chain conveyors with transfer stations",
     "6.1 m, 0.2 m/s, top 0.70 m",
     "TGW / Interroll / AS/RS maker",
     "€€€"
    ],
    [
     "27",
     "1",
     "Weighing section",
     "4 load cells, 500 kg",
     "HBK / Mettler Toledo",
     "€€"
    ],
    [
     "28",
     "1",
     "Contour + height check gate",
     "3–4 light grids",
     "SICK MLG-2 / Leuze CML 700i",
     "€€"
    ],
    [
     "29",
     "1",
     "ID reader",
     "bar code / DataMatrix",
     "SICK Lector / Cognex",
     "€€"
    ],
    [
     "30",
     "2",
     "Light curtains with muting",
     "type 4, 1.3 × 1.0 m opening",
     "SICK deTec4 / Leuze MLC",
     "€€"
    ],
    [
     "31",
     "≈ 30 m",
     "Safety fence + 2 doors with guard locking",
     "2.2 m",
     "Troax / Axelent + Pilz / Euchner",
     "€€"
    ],
    [
     "32",
     "1",
     "Maintenance platform, ladder with fall arrest (on the crane)",
     "EN ISO 14122-4",
     "crane maker",
     "included"
    ],
    [
     "33",
     "1",
     "Floor flatness survey + rack / rail survey",
     "before and after erection",
     "survey service",
     "€"
    ],
    [
     "34",
     "1",
     "Spare parts set",
     "fork chains, guide rollers, 1 wheel, collectors, 1 laser",
     "crane maker",
     "€€"
    ]
   ],
   "m": 4,
   "p": 5,
   "w": [
    4,
    7,
    21,
    27,
    26,
    15
   ]
  }
 ],
 "guides": "guide 31",
 "shopTab": "Shopping list – ASRS-RAW",
 "ph": "(e.g. SICK, Vahle, SEW, Troax, rail)",
 "buyNote": "Price classes: € < 1 k, €€ 1–10 k, €€€ 10–100 k, €€€€ > 100 k – rough estimates (Europe, 2020s, without installation); always ask 2–3 suppliers.",
 "shopLbl": "shopping list",
 "shopTitle": "Mechanical system of the raw-material AS/RS (392 slots, 1 stacker crane, I/O) – guide 31 §19. In practice bought as one turnkey package; the list shows what is inside to compare offers.",
 "shopNote": "Quantities follow the 3D twin and guide 31. Example – the AS/RS supplier's offer decides.",
 "shopPrice": true
};
