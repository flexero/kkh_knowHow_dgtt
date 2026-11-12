/* HMC build, Pallet changer, AGV build, Assembly, SCADA, PLC, Communication, CNC + Mechanical elements – data for the cards "Real components + drawings – catalogue examples" (machref.js).
 * GENERATED from the guide tables – do not edit by hand; regenerate with gen_mach.py.
 *   hmc1: docs/12_hmc_build.md §M16 (10 tables) + §M17 BOM; drawings 12_*
 *   apc:  docs/09_pallet_changer_apc.md §28.1 – 28.10 + §28.11 shopping list; drawings 09_*
 *   agv1: docs/11_agv_build.md §29.1 – 29.12 + §29.13 fleet shopping list; drawings 11_*
 *   asm1: docs/17_assembly_rotary_table.md §32.1 – 32.9 + §32.10 shopping list; drawings 17_*
 *   asm2: docs/19_spindle_assembly.md §32.1 – 32.11 + §33 shopping list; drawings 19_*
 *   hmc4: docs/18_spindle_manufacturing.md §28.1 – 28.10 + §28.11 shopping list + §28.12 make-or-buy; drawings 18_*
 *   scada: docs/06_scada.md §30.1 – 30.9 + §30.10 shopping list; drawings 06_*
 *   plc:  docs/05_plc_control.md §35.1 – 35.7 + §35.8 shopping list; drawings 05_*  (PLC section inside the FMS tab)
 *   comm: docs/07_communication.md §34.1 – 34.12 + §35 shopping list; drawings 07_*
 *   cnc:  docs/08_cnc_gcode.md §31.1 – 31.10 + §32 shopping list; drawings 08_*
 *   mech1: docs/10_mechanical_interfaces.md §36.1 – 36.14 + §37 shopping list; drawings 10_*
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]
 * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.
 */
export const ITEMS = {
 "hmc1": {
  "guide": "guide 12",
  "drawings": [
   {
    "f": "12_rotary_table_section.svg",
    "c": "Rotary table B-axis half section: housing, axial-radial bearing, table top Ø580, worm wheel z2 90 and duplex worm (a = 205 mm), hydraulic clamp …",
    "g": "guide 12 §3.1",
    "t": "Rotary table B-axis – half section"
   },
   {
    "f": "12_hmc_structure.svg",
    "c": "HMC 500 layout: side view and top view with bed, column, spindle head, Z table carrier, rotary table, APC, magazine and the X / Y / Z / B axes with strokes",
    "g": "guide 12 §M1",
    "t": "HMC 500 layout – side + top view"
   },
   {
    "f": "12_axis_drive_train.svg",
    "c": "Axis drive train: servo motor, bellows coupling, fixed bearing (angular contact pair 60°), ball screw Ø50 × 20, preloaded double nut, carriage on two roller guides …",
    "g": "guide 12 §M4",
    "t": "Axis drive train (ball screw)"
   },
   {
    "f": "12_ballscrew_selection.svg",
    "c": "Ball screw selection chart: allowed speed 0.8 · n_c and allowed buckling load against bearing span for Ø40 and Ø50, fixed–fixed and fixed–supported …",
    "g": "guide 12 §M4.4",
    "t": "Ball screw selection chart"
   },
   {
    "f": "12_lubrication_coolant_pid.svg",
    "c": "Coolant and lubrication P&ID: tank with chip conveyor and filter, flood pump, high-pressure through-spindle pump with fine filter, chiller …",
    "g": "guide 12 §M9",
    "t": "Coolant + lubrication P&ID"
   },
   {
    "f": "12_cnc_architecture.svg",
    "c": "CNC architecture: HMI and machine control panel, NC kernel, integrated PLC, safety integrated, drive bus to the drive line-up (infeed, X, Y, Z, B, spindle, magazine) …",
    "g": "guide 12 §M12",
    "t": "CNC architecture"
   },
   {
    "f": "12_accuracy_budget.svg",
    "c": "Accuracy budget: error contributions in µm with sum and RSS against the ±20 µm bore position tolerance",
    "g": "guide 12 §M13.2",
    "t": "Accuracy budget (±20 µm)"
   },
   {
    "f": "12_thermal_growth.svg",
    "c": "Thermal growth: spindle Z growth during warm-up and cooling (τ = 30 min, 46 µm), with model compensation residual; column bending from a front–rear temperature difference",
    "g": "guide 12 §M14",
    "t": "Thermal growth + compensation"
   }
  ],
  "groups": [
   {
    "id": "m16_1",
    "t": "Linear guides",
    "src": "guide 12 §M16.1",
    "rows": [
     [
      "Linear guides",
      "X: 2 rails size 45, roller, 4 blocks, preload medium/heavy, class P, length ≈ 1 600 mm",
      "THK SRG (caged roller)",
      "C, C0, moment ratings: see datasheet",
      "€€ per axis",
      "C/C0 basis (50 or 100 km), rail length in one piece, reference edge, seal kit"
     ],
     [
      "Linear guides",
      "Z: as X, length ≈ 1 400 mm",
      "HIWIN RGH (roller, high load flange/square block)",
      "see datasheet",
      "€€ per axis",
      "preload names (Z0/ZA/ZB), accuracy class P/SP, lubrication port"
     ],
     [
      "Linear guides",
      "Y: size 45 (or 35) roller, 4 blocks, length ≈ 1 300 mm",
      "Bosch Rexroth roller rail RSHP / ball rail BSHP",
      "see datasheet",
      "€€",
      "block type (flange/narrow), integrated wipers"
     ],
     [
      "Linear guides",
      "Ball alternative (light machines, auxiliary axes)",
      "THK SHS, HIWIN HGH",
      "see datasheet",
      "€ – €€",
      "life at 50 km basis, lower stiffness"
     ],
     [
      "Linear guides",
      "Option: integrated measuring system",
      "Schneeberger MONORAIL MR (roller) / BM (ball), AMS (with integrated scale)",
      "see datasheet",
      "€€ – €€€",
      "resolution, accuracy, connection to the CNC"
     ],
     [
      "Linear guides",
      "Guide clamps (Z, X option)",
      "Zimmer (MK/MKS, LBHS), HEMA (LinClamp)",
      "holding force: see datasheet",
      "€ – €€ per unit",
      "fits the rail profile and size, air or oil, fail-safe (spring) type"
     ]
    ]
   },
   {
    "id": "m16_2",
    "t": "Ball screws, support bearings, couplings",
    "src": "guide 12 §M16.2",
    "rows": [
     [
      "Ball screws, support bearings, couplings",
      "X / Z: Ø50 × 20, ground, class C3, preloaded double nut (≈ 5 % Ca), Ca ≥ 53 kN, high-speed (DN ≥ 125 000), fixed–fixed ends, length ≈ 1 400 mm",
      "THK (e.g. high-speed SBN type), HIWIN (precision ground, Super S high-speed), NSK (precision ground for machine tools), Bosch Rexroth (precision ball screw assemblies), Kuroda (precision ground)",
      "Ca, Coa, nut stiffness, DN limit: see datasheet",
      "€€ per axis",
      "DN limit, Ca, preload method (double nut / offset lead), end machining drawing, T-value (pretension), hollow core for cooling"
     ],
     [
      "Ball screws, support bearings, couplings",
      "Y: Ø40 × 20, as above, Ca ≥ 38 kN",
      "same makers",
      "see datasheet",
      "€€",
      "brake on the motor; screw life with counterbalance (M4.5)"
     ],
     [
      "Ball screws, support bearings, couplings",
      "Fixed bearings (both ends): 60° angular contact thrust ball bearings, set of 3–4 (DBD / DFD) or double-direction unit",
      "NSK TAC…B series (60°), FAG (Schaeffler) 7602 / 7603 series, ZKLF / ZKLN units",
      "axial stiffness, limiting speed: see datasheet",
      "€ – €€ per set",
      "bore = journal Ø, preload class, limiting speed ≥ 2 500 rpm with grease, lock nut"
     ],
     [
      "Ball screws, support bearings, couplings",
      "Precision lock nuts",
      "NSK, FAG, (or bearing maker)",
      "see datasheet",
      "€",
      "axial runout of the face, locking type"
     ],
     [
      "Ball screws, support bearings, couplings",
      "Couplings motor – screw: torsionally stiff, zero backlash, T_max ≥ 1.5 × motor T_max (≥ 150 N·m for X)",
      "R+W BK series (metal bellows), KTR RADEX-NC (steel lamina) or ROTEX GS (elastomer, damping)",
      "torsional stiffness, misalignment: see datasheet",
      "€",
      "torsional stiffness (adds to the axis spring), clamping hub for the motor shaft Ø"
     ]
    ]
   },
   {
    "id": "m16_3",
    "t": "Servo motors and drives",
    "src": "guide 12 §M16.3",
    "rows": [
     [
      "Servo motors and drives",
      "X: T_0 ≈ 36 N·m, T_max ≥ 90 N·m, 3 000 rpm, absolute encoder",
      "Siemens 1FK7 + SINAMICS S120 (or 1FT7 high dynamic)",
      "see datasheet / SIZER",
      "€€ per axis",
      "T–n curve at your DC voltage, J_motor, encoder type, brake"
     ],
     [
      "Servo motors and drives",
      "Z: T_0 ≈ 27 N·m",
      "Fanuc αiF / αiS + αi-B amplifiers (with 31i-B5 / 0i-F Plus)",
      "see datasheet / Fanuc sizing",
      "€€",
      "amplifier current rating, FSSB"
     ],
     [
      "Servo motors and drives",
      "Y: T_0 ≈ 20 N·m + holding brake",
      "Heidenhain QSY motors + Heidenhain inverters (with TNC7)",
      "see datasheet",
      "€€",
      "brake holding torque ≥ 1.3 × gravity torque without counterbalance"
     ],
     [
      "Servo motors and drives",
      "B (worm): 2.0–3.0 kW, T_n 6.4–9.6 N·m, brake",
      "Mitsubishi HG series + MDS-E drives (with M80 / M800); or same family as above",
      "see datasheet",
      "€ – €€",
      "same family as the CNC"
     ],
     [
      "Servo motors and drives",
      "Spindle drive module 15 kW S1 (≥ 30 kW peak)",
      "same family as the CNC",
      "see datasheet",
      "€€",
      "motor data match (from the spindle maker)"
     ],
     [
      "Servo motors and drives",
      "Line module / infeed with regenerative feedback",
      "same family",
      "see datasheet",
      "€€",
      "DC-link power for all axes + spindle braking"
     ]
    ]
   },
   {
    "id": "m16_4",
    "t": "CNC controls",
    "src": "guide 12 §M16.4",
    "rows": [
     [
      "CNC controls",
      "4–5 axes + spindle, B-axis kinematics, look-ahead, thermal + volumetric comp option, OPC UA",
      "Siemens SINUMERIK ONE (high end) / 828D (compact)",
      "see datasheet",
      "€€€",
      "number of axes, options (5-axis, VCS, Safety Integrated, OPC UA), PLC size"
     ],
     [
      "CNC controls",
      "",
      "Fanuc 0i-F Plus (compact) / 31i-B5 (5-axis, high end)",
      "see datasheet",
      "€€€",
      "options list (AI contour control, DCS safety), service in your country"
     ],
     [
      "CNC controls",
      "",
      "Heidenhain TNC7 (or TNC 640)",
      "see datasheet",
      "€€€",
      "shop-floor programming, KinematicsOpt, FS safety"
     ],
     [
      "CNC controls",
      "",
      "Mitsubishi M80 / M800",
      "see datasheet",
      "€€ – €€€",
      "options, drive family MDS"
     ]
    ]
   },
   {
    "id": "m16_5",
    "t": "Linear scales and rotary encoders",
    "src": "guide 12 §M16.5",
    "rows": [
     [
      "Linear scales and rotary encoders",
      "X / Y / Z: sealed absolute linear scale, measuring length 740 / 740 / 660 mm (≥ travel), grade ±3 or ±5 µm",
      "Heidenhain LC 415 (small profile) / LC 115 (full size)",
      "grade ±3 / ±5 µm (see datasheet for your length)",
      "€€ per axis",
      "interface (EnDat 2.2 / DRIVE-CLiQ / Fanuc / Mitsubishi), sealing air, mounting tolerances"
     ],
     [
      "Linear scales and rotary encoders",
      "",
      "Renishaw FORTiS (enclosed absolute) / RESOLUTE (open absolute)",
      "see datasheet",
      "€€",
      "open scales need clean environment"
     ],
     [
      "Linear scales and rotary encoders",
      "",
      "Fagor absolute linear encoders (sealed)",
      "see datasheet",
      "€€",
      "interface match"
     ],
     [
      "Linear scales and rotary encoders",
      "B: absolute angle encoder, hollow shaft ≥ Ø100, ±2.5″ (or better), 2 heads option",
      "Heidenhain RCN (e.g. RCN 2000 / 5000 / 8000 families)",
      "system accuracy per family – see datasheet",
      "€€ – €€€",
      "shaft coupling, mounting runout, interface"
     ],
     [
      "Linear scales and rotary encoders",
      "",
      "Renishaw RESOLUTE with REXA / RESA ring + 2 read heads",
      "see datasheet",
      "€€",
      "ring eccentricity, 2-head averaging in the control"
     ]
    ]
   },
   {
    "id": "m16_6",
    "t": "Rotary table, worm sets, torque motors",
    "src": "guide 12 §M16.6",
    "rows": [
     [
      "Rotary table, worm sets, torque motors",
      "Complete NC rotary table for 500 pallet (buy instead of make)",
      "Nikken, Tsudakoma, Kitagawa (NC rotary tables), Peiseler, Fibro",
      "see datasheet",
      "€€€",
      "clamping torque, table load, worm type (duplex), encoder, pallet interface"
     ],
     [
      "Rotary table, worm sets, torque motors",
      "Duplex worm gear set (matched)",
      "specialist worm gear makers; the table makers above sell spare sets",
      "see datasheet",
      "€€",
      "DIN 3974 class, Δp, centre distance, pairing protocol"
     ],
     [
      "Rotary table, worm sets, torque motors",
      "Axial-radial main bearing, bore ≈ 200 mm",
      "Schaeffler YRT / YRTC / YRTS (YRTS for higher speed), ZKLDF (for DD tables)",
      "M_k, C0a, friction torque: see datasheet",
      "€€",
      "tilting stiffness, friction torque (M6.1), fits + screw torques"
     ],
     [
      "Rotary table, worm sets, torque motors",
      "Torque motor (DD alternative) ≈ 500 N·m continuous / 1 000 N·m peak, water cooled",
      "Siemens 1FW6, ETEL (TMB / TMK), Kollmorgen (KBM frameless)",
      "see datasheet",
      "€€€",
      "cooling, cogging, drive current, encoder, magnetic forces at assembly"
     ],
     [
      "Rotary table, worm sets, torque motors",
      "Rotary clamp (hydraulic) 3 000 N·m",
      "HEMA RotoClamp, or clamp ring made in-house (Part 1)",
      "see datasheet",
      "€€",
      "holding torque vs pressure, release time"
     ],
     [
      "Rotary table, worm sets, torque motors",
      "Rotary union 4–6 passages (hydraulic + air)",
      "Deublin, OTT-JAKOB (rotary unions)",
      "see datasheet",
      "€€",
      "pressure, speed, leakage, passage count"
     ]
    ]
   },
   {
    "id": "m16_7",
    "t": "Spindle, tool interface, clamping",
    "src": "guide 12 §M16.7",
    "rows": [
     [
      "Spindle, tool interface, clamping",
      "Motor spindle HSK-A63, 12 000 rpm, 15 kW S1, 120 N·m S6 (buy instead of make, guides 18 / 19)",
      "Kessler, Fischer (Fischer Precise), GMN, Step-Tec",
      "power / torque curve: see datasheet",
      "€€€ – €€€€",
      "S1 / S6 curve, bearings, cooling flow, sensors (vibration, temperature, clamping), service network"
     ],
     [
      "Spindle, tool interface, clamping",
      "HSK-A63 clamping unit + drawbar",
      "OTT-JAKOB (HSK clamping systems), Röhm (clamping units)",
      "clamping force ≈ 18 kN class (guide 18) – see datasheet",
      "€€",
      "clamping force, release stroke, sensor for clamp states"
     ],
     [
      "Spindle, tool interface, clamping",
      "Tool holders HSK-A63 (ISO 12164-1), or SK40 / BT40",
      "tool holder makers (many)",
      "balance grade G 2.5 at speed",
      "€ each",
      "balancing, coolant channel form (A / B)"
     ],
     [
      "Spindle, tool interface, clamping",
      "Spindle chiller",
      "industrial chiller makers",
      "cooling power ≥ spindle losses + margin",
      "€€",
      "±0.5 K control, fluid type, flow"
     ]
    ]
   },
   {
    "id": "m16_8",
    "t": "Tool magazine and changer",
    "src": "guide 12 §M16.8",
    "rows": [
     [
      "Tool magazine and changer",
      "60-pocket chain magazine + cam double-gripper ATC, HSK-A63, Ø 80 / 160 mm, 400 mm, 8 kg, 2.5 s chip-to-chip",
      "specialist ATC / magazine makers (Taiwan, Japan, Europe) – ask your spindle supplier or integrator",
      "see datasheet",
      "€€€",
      "change time, tool size limits, pocket coding, sensors, interface to the PLC"
     ],
     [
      "Tool magazine and changer",
      "Tool presetter + RFID / data matrix (guide 15)",
      "presetter makers",
      "see datasheet",
      "€€",
      "data transfer format to the CNC"
     ],
     [
      "Tool magazine and changer",
      "Spindle probe + tool setter",
      "Renishaw (e.g. OMP / RMP spindle probes, NC4 laser / OTS tool setter), Blum (TC probes, LaserControl)",
      "see datasheet",
      "€€",
      "transmission (optical / radio), cycles for your control"
     ]
    ]
   },
   {
    "id": "m16_9",
    "t": "Covers, chips, coolant, lubrication, hydraulics",
    "src": "guide 12 §M16.9",
    "rows": [
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Telescopic steel way covers X, Z (50 m/min, 0.6 g); Y roll-up / bellows",
      "Hennig, Arno Arnold, Tsubaki Kabelschlepp",
      "see datasheet",
      "€€ per axis",
      "speed + acceleration rating, wipers, closed / open length"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Cable carriers X, Y, Z",
      "igus (e-chain), Tsubaki Kabelschlepp",
      "see datasheet",
      "€ per axis",
      "bending radius, fill, unsupported length"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Chip conveyor (cast iron → scraper + filter drum)",
      "Hennig, Mayfran, Tsubaki Kabelschlepp (conveyors)",
      "see datasheet",
      "€€",
      "chip type, height of discharge, filter fineness, tank interface"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Coolant tank 800 L + flood pump 100 L/min 4 bar + TSC 70 bar 20 L/min, 20 µm filter, chiller",
      "coolant system makers; central system per guide 28",
      "see datasheet",
      "€€ – €€€",
      "filter, pump type (screw pump for TSC), temperature control"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Mist extractor",
      "oil-mist filter makers",
      "airflow per enclosure volume",
      "€€",
      "filter stages, noise"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Central lubrication (single-line, piston distributors, 2 L, level + pressure switch)",
      "SKF (Lincoln / Vogel), Bijur Delimon",
      "see datasheet",
      "€ – €€",
      "distributor sizes per point, oil grade, PLC signals"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Hydraulic unit (5–7 MPa, accumulator, 0.75 kW) – APC, clamp, counterbalance",
      "Bosch Rexroth, HAWE, Parker, HYDAC – design guides 25 / 29 / 30",
      "see datasheet",
      "€€",
      "p–Q diagram (guide 25), heat, filter ISO 4406 class"
     ],
     [
      "Covers, chips, coolant, lubrication, hydraulics",
      "Counterbalance cylinder + accumulator (Y)",
      "hydraulic cylinder makers + HYDAC / Parker accumulators",
      "A ≈ 1 000 mm², stroke 750 mm, V_oil 0.73 L",
      "€ – €€",
      "pressure change over stroke ±10 %, seal friction"
     ]
    ]
   },
   {
    "id": "m16_10",
    "t": "Structure, enclosure, safety",
    "src": "guide 12 §M16.10",
    "rows": [
     [
      "Structure, enclosure, safety",
      "Bed, column, Z-saddle, head: EN-GJL-300 castings (≈ 6–8 t)",
      "machine-tool foundries (hand-moulded, furan sand)",
      "test bars, 3.1 certificate",
      "€€€ – €€€€",
      "pattern cost, stress relief, porosity at guide faces, delivery time"
     ],
     [
      "Structure, enclosure, safety",
      "Mineral casting bed (alternative)",
      "mineral casting makers (e.g. RAMPF, Schneeberger)",
      "E ≈ 30–45 GPa, cast-in inserts",
      "€€€",
      "insert accuracy, mould cost, lot size"
     ],
     [
      "Structure, enclosure, safety",
      "Welded steel structure (alternative)",
      "welding shops with annealing furnace",
      "stress-relief record",
      "€€ – €€€",
      "distortion, damping filling"
     ],
     [
      "Structure, enclosure, safety",
      "Enclosure sheet metal + doors",
      "sheet metal shops",
      "–",
      "€€ – €€€",
      "coolant tightness, door rails, ergonomics"
     ],
     [
      "Structure, enclosure, safety",
      "Vision panels: polycarbonate + inner safety glass, certified for ISO 16090-1 impact",
      "window makers (PC sheet e.g. Makrolon-type)",
      "impact test report",
      "€ – €€ each",
      "thickness for your spindle speed / tool, frame, replacement date"
     ],
     [
      "Structure, enclosure, safety",
      "Door interlock with guard locking (PL d), enabling switch, E-stop",
      "Euchner, Pilz, Schmersal, Siemens",
      "see datasheet",
      "€ each",
      "coded actuator, locking force, diagnostic, ISO 14119"
     ],
     [
      "Structure, enclosure, safety",
      "Electrical cabinet + cooling",
      "Rittal (or equal)",
      "–",
      "€€",
      "heat load of drives, IP54, EMC (guide 27)"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "Pos",
     "Item",
     "Qty",
     "Spec (example)",
     "Make / buy",
     "Section"
    ],
    "rows": [
     [
      "1",
      "Bed casting (T-bed) EN-GJL-300, machined",
      "1",
      "≈ 4 t, guide seats in one set-up",
      "BUY casting + MAKE machining",
      "M2"
     ],
     [
      "2",
      "Column casting, machined",
      "1",
      "box 700 × 700, ≈ 1.2 t",
      "BUY + MAKE",
      "M2.3"
     ],
     [
      "3",
      "Z-saddle casting",
      "1",
      "≈ 520 kg",
      "BUY + MAKE",
      "M1"
     ],
     [
      "4",
      "Spindle head casting",
      "1",
      "≈ 450 kg (+ spindle)",
      "BUY + MAKE",
      "M1"
     ],
     [
      "5",
      "Linear guides size 45 roller, class P, medium/heavy preload",
      "3 sets (6 rails, 12 blocks)",
      "X, Y, Z",
      "BUY",
      "M3, M16.1"
     ],
     [
      "6",
      "Ball screw Ø50 × 20 C3, high-speed, preloaded",
      "2",
      "X, Z",
      "BUY",
      "M4, M16.2"
     ],
     [
      "7",
      "Ball screw Ø40 × 20 C3, high-speed, preloaded",
      "1",
      "Y",
      "BUY",
      "M4"
     ],
     [
      "8",
      "Support bearing sets 60° + lock nuts + housings",
      "6 sets",
      "fixed–fixed, both ends",
      "BUY + MAKE housings",
      "M4.8"
     ],
     [
      "9",
      "Couplings (bellows / lamina)",
      "4",
      "X, Y, Z, B",
      "BUY",
      "M16.2"
     ],
     [
      "10",
      "Servo motors X (S36), Z (S27), Y (S20 + brake), B (2.0–3.0 kW + brake)",
      "4",
      "M5, M6",
      "BUY",
      "M5, M16.3"
     ],
     [
      "11",
      "Drive line-up: infeed + 4 axis modules + spindle module",
      "1",
      "same family as the CNC",
      "BUY",
      "M16.3"
     ],
     [
      "12",
      "CNC + HMI + machine control panel + handwheel + safety options",
      "1",
      "4–5 axes",
      "BUY",
      "M12, M16.4"
     ],
     [
      "13",
      "Linear scales (sealed absolute)",
      "3",
      "740 / 740 / 660 mm, ±3 / ±5 µm",
      "BUY",
      "M5.5"
     ],
     [
      "14",
      "Rotary table B (Parts 1–3) incl. RCN angle encoder, YRT bearing, clamp, union, 4 zero-point modules",
      "1",
      "Ø580, 1:90 duplex worm",
      "MAKE (or BUY complete)",
      "Parts 1–3, M16.6"
     ],
     [
      "15",
      "Motor spindle HSK-A63, 12 000 rpm, 15 kW (guides 18 / 19)",
      "1",
      "+ clamping unit",
      "MAKE (or BUY)",
      "M7, M16.7"
     ],
     [
      "16",
      "Spindle chiller",
      "1",
      "≥ 3 kW",
      "BUY",
      "M9"
     ],
     [
      "17",
      "Tool magazine 60 pockets + ATC arm",
      "1",
      "2.5 s",
      "BUY",
      "M8"
     ],
     [
      "18",
      "APC 2 pallets + 2 pallets 500 × 500 (guide 09)",
      "1",
      "hydraulic",
      "MAKE / BUY",
      "guide 09"
     ],
     [
      "19",
      "Hydraulic unit + valves + accumulator(s) + Y counterbalance cylinder",
      "1",
      "5–7 MPa",
      "BUY",
      "M10, guides 25 / 29 / 30"
     ],
     [
      "20",
      "Pneumatic panel (filter, regulator, sealing air for scales / spindle)",
      "1",
      "6 bar, 0.01 µm stage",
      "BUY",
      "M10"
     ],
     [
      "21",
      "Coolant tank 800 L, pumps (flood + TSC 70 bar), filter 20 µm, chiller",
      "1",
      "M9",
      "BUY",
      "M9, guide 28"
     ],
     [
      "22",
      "Chip conveyor (scraper + filter drum) + chip cart",
      "1",
      "cast iron",
      "BUY",
      "M9.2"
     ],
     [
      "23",
      "Telescopic way covers X, Z + Y cover",
      "3",
      "50 m/min",
      "BUY",
      "M9.3"
     ],
     [
      "24",
      "Cable carriers + cables (servo, encoder, I/O)",
      "3 axes",
      "",
      "BUY",
      "M9.3"
     ],
     [
      "25",
      "Central lubrication unit + distributors + tubing",
      "1",
      "15 points",
      "BUY",
      "M9.4"
     ],
     [
      "26",
      "Enclosure sheet metal, doors, roof, mist extractor",
      "1",
      "",
      "MAKE / BUY",
      "M11"
     ],
     [
      "27",
      "Vision panels PC + safety glass (certified)",
      "2–3",
      "ISO 16090-1",
      "BUY",
      "M11"
     ],
     [
      "28",
      "Safety components: door locks, E-stops, enabling device, light curtain (APC)",
      "1 set",
      "PL d",
      "BUY",
      "M11"
     ],
     [
      "29",
      "Electrical cabinet, cooling, main switch, transformer if needed",
      "1",
      "≈ 45–60 kVA",
      "BUY + MAKE wiring",
      "M12.4, guide 27"
     ],
     [
      "30",
      "Probing: spindle probe + tool setter",
      "1 set",
      "",
      "BUY",
      "M16.8"
     ],
     [
      "31",
      "Guide clamps (option)",
      "2–4",
      "Z, X",
      "BUY",
      "M3.5"
     ],
     [
      "32",
      "Levelling elements + anchors (guide 26)",
      "6",
      "",
      "BUY",
      "guide 26"
     ],
     [
      "33",
      "Fasteners, seals, pipes, fittings, paint, labels",
      "1 lot",
      "",
      "BUY",
      "–"
     ],
     [
      "34",
      "Acceptance equipment (rent or own): laser interferometer, ballbar, autocollimator + polygon",
      "–",
      "ISO 230",
      "BUY / RENT",
      "M15, guide 26"
     ]
    ],
    "m": 1,
    "p": -1,
    "w": [
     5,
     24,
     7,
     38,
     12,
     14
    ]
   }
  ],
  "shopTab": "Shopping list – one HMC 500 (BOM level)",
  "shopLbl": "BOM",
  "shopTitle": "Consolidated shopping list (BOM level) for one HMC 500 – guide 12 §M17. \"Make / buy\" shows what is bought and what is made in-house.",
  "price": "Price classes (guide 12, per item): € < 1 000 € · €€ 1 000 – 10 000 € · €€€ 10 000 – 50 000 € · €€€€ > 50 000 € – estimate, ask for a quote.",
  "shopNote": "Quantities and specs are examples from the design chapters of guide 12 – the machine builder's own BOM decides.",
  "ph": "(e.g. HIWIN, THK, 1FK7, SINUMERIK, HSK-A63)"
 },
 "apc": {
  "guide": "guide 09",
  "drawings": [
   {
    "f": "09_step_chain_timing.svg",
    "c": "APC step chain timing diagram with interlocks and accumulator pressure",
    "g": "guide 09 §4.10",
    "t": "Step chain timing (8.8 s change)"
   },
   {
    "f": "09_electrical_io.svg",
    "c": "APC electrical I/O overview",
    "g": "guide 09 §4.11",
    "t": "Electrical I/O overview"
   },
   {
    "f": "09_hydraulic_circuit.svg",
    "c": "APC hydraulic circuit with accumulator, ISO 1219-2 style",
    "g": "guide 09 §4.12",
    "t": "Hydraulic circuit (ISO 1219-2)"
   },
   {
    "f": "09_zero_point_module.svg",
    "c": "Zero-point module section – clamped and released",
    "g": "guide 09 §4.13",
    "t": "Zero-point module – clamped / released"
   },
   {
    "f": "09_apc_layout.svg",
    "c": "APC layout – top view and side view with the HMC",
    "g": "guide 09 §5.1",
    "t": "APC layout with the HMC"
   },
   {
    "f": "09_lift_rotate_section.svg",
    "c": "APC lift and rotation unit – section",
    "g": "guide 09 §5.1",
    "t": "Lift + rotation unit – section"
   },
   {
    "f": "09_positioning_budget.svg",
    "c": "APC positioning budget – capture and final position",
    "g": "guide 09 §10.11",
    "t": "Positioning budget"
   },
   {
    "f": "09_motion_law.svg",
    "c": "Motion law of the 180° APC turn",
    "g": "guide 09 §19.3",
    "t": "Motion law of the 180° turn"
   }
  ],
  "groups": [
   {
    "id": "a28_1",
    "t": "Zero-point clamping systems",
    "src": "guide 09 §28.1",
    "rows": [
     [
      "Zero-point clamping systems",
      "ball/slide lock, spring clamp, pneumatic release with turbo",
      "SCHUNK VERO-S NSE plus (and automation / hydraulic variants – check)",
      "repeatability < 0.005 mm (maker claim); pull-in with turbo, holding force – see datasheet",
      "medium per module",
      "release medium (air vs oil in the B-table), pull-in without turbo, air seating option, module height"
     ],
     [
      "Zero-point clamping systems",
      "spring clamp, hydraulic or pneumatic opening",
      "AMF Zero Point system K10 / K20 / K40 (number ≈ pull-in class in kN – check)",
      "pull-in, holding force, opening pressure – see datasheet",
      "medium",
      "opening pressure range vs 2V2 (5 MPa), max pressure, flush or surface mounting, seating check port"
     ],
     [
      "Zero-point clamping systems",
      "spring clamp, hydraulic / pneumatic release",
      "Stark Speedy (Roemheld group; e.g. \"classic\", \"metec\", \"airtec\" – check)",
      "see datasheet",
      "medium–high",
      "automation version with seating check and position monitoring, stud types"
     ],
     [
      "Zero-point clamping systems",
      "as Stark",
      "Roemheld (sells the Stark zero-point range; also pallet clamping elements)",
      "see datasheet",
      "medium–high",
      "one supplier for modules + fixture clamping"
     ],
     [
      "Zero-point clamping systems",
      "manual mechanical zero-point",
      "Lang Quick•Point (52 / 96 grid)",
      "see datasheet",
      "low–medium",
      "not for automatic APC change – use for fixture / subplate change on the pallet"
     ],
     [
      "Zero-point clamping systems",
      "zero-point chucks for machining, pneumatic",
      "EROWA MTS (check)",
      "see datasheet",
      "medium–high",
      "automation chuck version, pull-in force, compatibility with EROWA pallets"
     ]
    ]
   },
   {
    "id": "a28_2",
    "t": "Pallets and pallet systems",
    "src": "guide 09 §28.2",
    "rows": [
     [
      "machining pallet 500 × 500 for the HMC",
      "ISO 8526-style top (18H8 T-slots or M16 grid), stud pattern 400, 110 kg class",
      "the HMC builder's spare pallet (exact match to its APC and receivers)",
      "–",
      "high (per pallet)",
      "stud fits, top face, RFID pocket, interchangeability certificate"
     ],
     [
      "custom pallet (MAKE, §11.3 part 1)",
      "EN-GJS-600-3 or C45, ground ±0.01",
      "local foundry + own machining / grinding",
      "–",
      "medium–high",
      "casting quality, stress relief, jig-boring capacity"
     ],
     [
      "pallet subplate with zero-point level",
      "2nd zero-point level for fixture change",
      "Lang, SCHUNK, AMF zero-point plates",
      "–",
      "medium–high",
      "added height (Z travel, swing circle), clamping force"
     ],
     [
      "small pallet systems (5-axis, EDM, robot loading)",
      "50–320 mm pallets",
      "EROWA (UPC, ITS – check), System 3R (Delphin, Dynafix, GPS – check)",
      "–",
      "medium–high",
      "not for 500 mm HMC pallets; good for robot cells"
     ],
     [
      "master pallet (VC-APC-PAL-0030)",
      "ground studs + dial-gauge seats",
      "MAKE or the pallet supplier",
      "–",
      "high",
      "yearly calibration"
     ]
    ]
   },
   {
    "id": "a28_3",
    "t": "Hydraulic clamping elements",
    "src": "guide 09 §28.3",
    "rows": [
     [
      "Hydraulic clamping elements",
      "swing clamps, block cylinders, work supports, rotary couplings for pallets",
      "Roemheld",
      "many series for 5–50 MPa – see datasheet",
      "low–medium each",
      "operating pressure vs the 5 MPa branch (low-pressure series or an intensifier), position monitoring"
     ],
     [
      "Hydraulic clamping elements",
      "swing clamps, block cylinders, pallet couplings",
      "AMF (Andreas Maier)",
      "see datasheet",
      "low–medium",
      "same as above"
     ],
     [
      "Hydraulic clamping elements",
      "machine-tool / die clamping elements (check scope)",
      "Hilma (Roemheld group)",
      "see datasheet",
      "medium",
      "use for heavy fixtures / tombstones"
     ]
    ]
   },
   {
    "id": "a28_4",
    "t": "Lift cylinder and end-position sensing",
    "src": "guide 09 §28.4",
    "rows": [
     [
      "Lift cylinder and end-position sensing",
      "Ø63/36 × 60, cushions both ends, 16 MPa",
      "Bosch Rexroth CDT3 (tie-rod, ISO 6020-2)",
      "16 MPa nominal (series) – see datasheet",
      "medium",
      "cushion type + length (energy), inductive end switches option, mounting MF / MT, rod end for the self-aligning coupling"
     ],
     [
      "Lift cylinder and end-position sensing",
      "as above",
      "Parker HMI (ISO 6020-2 compact)",
      "16 MPa series – see datasheet",
      "medium",
      "as above, proximity switch option"
     ],
     [
      "Lift cylinder and end-position sensing",
      "compact, short stroke, position monitoring",
      "Roemheld block cylinders",
      "see datasheet",
      "low–medium",
      "for short strokes; check side load = 0"
     ],
     [
      "Lift cylinder and end-position sensing",
      "piston end position through the end cap",
      "Balluff pressure-rated inductive sensors (BES … pressure rated – check type)",
      "see datasheet",
      "low",
      "pressure rating, thread, switching distance"
     ]
    ]
   },
   {
    "id": "a28_5",
    "t": "Rotation drives",
    "src": "guide 09 §28.5",
    "rows": [
     [
      "servo motor + drive with STO / SS1 / SBC",
      "2.0 kW class, Tmax ≥ 7.1 N·m (mod. sine) – example 19 N·m, n ≥ 4 223 rpm, J motor ≥ 8.5 kg·cm² for ratio ≤ 10, absolute encoder, brake",
      "Siemens SIMOTICS S-1FK2 + SINAMICS S210; Beckhoff AM8000 + AX8000; Bosch Rexroth MS2N + ctrlX DRIVE (check)",
      "–",
      "high",
      "inertia ratio with the catalogue J, brake torque, safety functions, regenerative energy"
     ],
     [
      "planetary gearbox (inline or right angle)",
      "i ≈ 26.6, backlash ≤ 3′ (better ≤ 1′), output ≥ 1 230 N·m ÷ 7.53 ≈ 163 N·m nominal, emergency-stop torque ≥ 3 800 ÷ 7.53 ≈ 505 N·m (§25.3), torsional stiffness",
      "WITTENSTEIN alpha SP+ / TP+ (inline), SPK+ / TPK+ / HG+ (right angle); Neugart PLE / PLN (inline), WPLE / WPLN (right angle)",
      "–",
      "medium–high",
      "E-stop torque, torsional stiffness (N·m/arcmin), radial load on the output (pinion), lubrication for life"
     ],
     [
      "cam indexer (2 stops, modified sine)",
      "output ≥ 1 425 N·m at 2.5 s index, J = 338 kg·m², 2 stops",
      "Sankyo (indexers / roller drives – check series), Colombo Filippetti (indexers, also pallet-changer cam units – check), Weiss (TC rotary indexing tables – check)",
      "–",
      "high – very high",
      "index accuracy (″), lift-turn combination, input motor sizing by the maker"
     ],
     [
      "hydraulic rack-pinion rotary actuator",
      "≥ 1 025 N·m at 6 MPa, 180°, adjustable stops + cushions",
      "Parker HTR (hydraulic rack & pinion – check), Helac (helical – check)",
      "–",
      "medium–high",
      "oil per turn (0.78 L for double Ø63) vs accumulator, end-stop repeatability, backlash"
     ]
    ]
   },
   {
    "id": "a28_6",
    "t": "Slewing / crossed-roller bearings",
    "src": "guide 09 §28.6",
    "rows": [
     [
      "Slewing / crossed-roller bearings",
      "crossed roller bearing with mounting holes, compact",
      "INA (Schaeffler) XU",
      "–",
      "high",
      "C0, tilting stiffness, bolt pattern, preload class, seals"
     ],
     [
      "Slewing / crossed-roller bearings",
      "thin-section crossed roller bearing (needs a housing / clamping ring)",
      "INA (Schaeffler) SX",
      "–",
      "medium–high",
      "housing design, fits"
     ],
     [
      "Slewing / crossed-roller bearings",
      "cross-roller ring with mounting holes in inner + outer ring",
      "THK RU",
      "–",
      "medium–high",
      "sizes near Ø350, C0, rotation accuracy class"
     ],
     [
      "Slewing / crossed-roller bearings",
      "slewing ring / crossed roller with external gear",
      "IMO (slewing rings, with gear – check series)",
      "–",
      "high",
      "integrated ring gear m 4 (saves the separate ring gear), gear quality"
     ],
     [
      "Slewing / crossed-roller bearings",
      "slewing rings with gear (larger sizes)",
      "Rothe Erde (thyssenkrupp rothe erde)",
      "–",
      "high – very high",
      "minimum size / lead time; limit-load diagram method"
     ]
    ]
   },
   {
    "id": "a28_7",
    "t": "Sensors and identification",
    "src": "guide 09 §28.7",
    "rows": [
     [
      "arm up / down, 0° / 180°, pallet present",
      "PNP, Sn 4 mm (M12 non-flush) / 8 mm (M18), IP67/IP68, coolant resistant",
      "Balluff BES (M12 / M18, IO-Link versions); ifm IF / IG (check codes); Pepperl+Fuchs NBB / NBN",
      "–",
      "low",
      "Sn, flush / non-flush, cable vs connector, IO-Link"
     ],
     [
      "hydraulic pressure switch (2S1, 3S1)",
      "0–10 / 0–16 MPa, 2 switch points, hysteresis adjustable",
      "Hydac EDS 3000 (electronic switch); ifm PN7 (check)",
      "–",
      "low–medium",
      "range, switch points, IO-Link, port thread"
     ],
     [
      "accumulator transmitter 0B2",
      "0–16 MPa, 4–20 mA",
      "Hydac HDA 4000; WIKA S-20 / A-10",
      "–",
      "low",
      "accuracy, overpressure range"
     ],
     [
      "air-gap seating check (5S1)",
      "gap detection ≈ 0.01–0.03 mm class – see datasheet",
      "SMC ISA3 (air catch sensor / gap checker); Festo SOPA (air gap sensor)",
      "–",
      "low–medium",
      "supply pressure, nozzle size, analog output, number of channels"
     ],
     [
      "pallet ID (RFID HF)",
      "13.56 MHz, ISO 15693, metal-mount tags",
      "Balluff BIS (HF); ifm DTE (check); Pepperl+Fuchs IDENTControl (check); SICK RFH (check)",
      "–",
      "medium",
      "read distance on metal, tag temperature / coolant resistance"
     ]
    ]
   },
   {
    "id": "a28_8",
    "t": "Hydraulic power unit and valves",
    "src": "guide 09 §28.8",
    "rows": [
     [
      "Hydraulic power unit and valves",
      "0P1",
      "external gear pump AZPF size 4 (check smallest size)",
      "–",
      "low",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "0Z2 + 0V3",
      "Hydac SB330 bladder accumulator 2.5 L + Hydac SAF safety & shut-off block (with solenoid drain = AccuHold)",
      "–",
      "medium",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "1V1",
      "4WE 6 (NG6) 4/3 with the A,B→T centre (spool code from the catalogue – check)",
      "–",
      "low–medium",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "1V2",
      "Z2S 6 double pilot-operated check sandwich",
      "–",
      "low",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "1V3",
      "Z2FS 6 double throttle-check sandwich",
      "–",
      "low",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "2V2 / 3V2",
      "ZDR 6 DP sandwich pressure reducing valve (3-way)",
      "–",
      "low–medium",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "2V1",
      "4WE 6 used as 3/2 (port plugged) or a 3/2 spool valve",
      "–",
      "low",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "3V1",
      "M-3SEW 6 3/2 seat valve (leak-free)",
      "–",
      "medium",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "0V5",
      "2/2 solenoid poppet (cartridge) NO",
      "–",
      "low",
      "–"
     ],
     [
      "Hydraulic power unit and valves",
      "0R1",
      "rotary union – see §28.10",
      "–",
      "medium–high",
      "–"
     ]
    ]
   },
   {
    "id": "a28_9",
    "t": "PLC and safety",
    "src": "guide 09 §28.9",
    "rows": [
     [
      "safety PLC",
      "PROFINET + PROFIsafe, ≈ 40 I/O + 4 F-DI + 1 F-DQ",
      "Siemens S7-1500F (e.g. CPU 1513F / 1516F) + ET 200SP with F-DI / F-DQ",
      "–",
      "high",
      "–"
     ],
     [
      "alternative safety logic",
      "for a separate APC control",
      "Pilz PNOZmulti 2 (configurable safety relay) or PSS 4000",
      "–",
      "medium–high",
      "–"
     ],
     [
      "light curtain type 4",
      "14 mm resolution, height to cover the opening, response time ≤ 20 ms (as §4.7)",
      "SICK deTec4; Pilz PSENopt II; (others)",
      "–",
      "medium–high",
      "–"
     ],
     [
      "guard locking switch",
      "ISO 14119, PL d / e, locking force for the door",
      "Euchner MGB / CTM; Pilz PSENmlock; Schmersal AZM 300 (check)",
      "–",
      "medium",
      "–"
     ],
     [
      "E-stop, enabling device, stack light",
      "IEC 60947-5-5",
      "Siemens, Schneider, Eaton, Pilz",
      "–",
      "low",
      "–"
     ]
    ]
   },
   {
    "id": "a28_10",
    "t": "Rotary unions for pallet media",
    "src": "guide 09 §28.10",
    "rows": [
     [
      "Rotary unions for pallet media",
      "3–4 passages: release oil 10 MPa, table-clamp oil (if not separate), seating air 0.6 MPa, cleaning air",
      "Deublin (multi-passage rotary unions – check series)",
      "–",
      "medium–high",
      "leakage per passage, drain / leak port to tank, rotation speed (B-axis), friction torque, passage size for 3.5 L/min"
     ],
     [
      "Rotary unions for pallet media",
      "as above",
      "OTT-JAKOB (rotary unions for machine tools – check)",
      "–",
      "medium–high",
      "same"
     ],
     [
      "Rotary unions for pallet media",
      "as above",
      "GAT, Christian Maier (check)",
      "–",
      "medium–high",
      "same"
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
      "4",
      "zero-point modules (machine)",
      "20 kN pull-in, spring clamp, hydraulic release ≤ 5 MPa, air seating",
      "SCHUNK / AMF / Stark",
      "4 × medium"
     ],
     [
      "2",
      "12",
      "pull studs (3 pallets × 4)",
      "1 fit + 1 slot + 2 clearance per pallet",
      "module maker",
      "12 × low"
     ],
     [
      "3",
      "3",
      "pallets 500 × 500",
      "§11.3 part 1, RFID pocket",
      "HMC builder or MAKE",
      "3 × high"
     ],
     [
      "4",
      "4",
      "station locating receivers",
      "16MnCr5, 58–62 HRC",
      "MAKE (guide 10)",
      "4 × low"
     ],
     [
      "5",
      "1",
      "crossed roller bearing",
      "dp ≈ 350, C0 ≥ 53 kN",
      "INA XU / THK RU / IMO",
      "high"
     ],
     [
      "6",
      "1",
      "ring gear + pinion",
      "m 4, z 113 / 15",
      "gear shop (or bearing with gear)",
      "medium–high"
     ],
     [
      "7",
      "1",
      "planetary gearbox, right angle",
      "i ≈ 26.6, ≤ 3′, E-stop torque ≥ 505 N·m output",
      "WITTENSTEIN / Neugart",
      "medium–high"
     ],
     [
      "8",
      "1",
      "servo motor + drive",
      "2.0 kW class, STO / SS1 / SBC, abs. encoder, brake",
      "Siemens / Beckhoff / Rexroth",
      "high"
     ],
     [
      "9",
      "1",
      "lift cylinder",
      "Ø63/36 × 60, ISO 6020-2, 16 MPa, cushions (Ø80 if §20.2 decides)",
      "Rexroth CDT3 / Parker HMI",
      "medium"
     ],
     [
      "10",
      "4 + 4",
      "guide columns Ø50 h6 + flanged ball bushings (or tandem)",
      "§21.3",
      "linear-motion suppliers (e.g. Schaeffler, Bosch Rexroth, Misumi)",
      "8 × low–medium"
     ],
     [
      "11",
      "1",
      "HPU",
      "0.75 kW, 4 cm³/rev, 25 L, 0V1 8.5 MPa, filter 10 µm",
      "Rexroth / HAWE / Hydac / local builder",
      "high"
     ],
     [
      "12",
      "1",
      "accumulator + safety block",
      "2.5 L, p0 5.39 MPa, SAF with solenoid drain",
      "Hydac SB330 + SAF",
      "medium"
     ],
     [
      "13",
      "1 set",
      "NG6 valves 1V1, 1V2, 1V3, 2V1, 2V2 (+ 3V1–3V3 for the table clamp), manifold",
      "§28.8",
      "Rexroth / HAWE / Parker",
      "medium–high"
     ],
     [
      "14",
      "1",
      "rotary union",
      "3–4 passages",
      "Deublin / OTT-JAKOB",
      "medium–high"
     ],
     [
      "15",
      "3",
      "pressure switches + 1 transmitter",
      "§28.7",
      "Hydac / ifm / WIKA",
      "4 × low"
     ],
     [
      "16",
      "1",
      "air-gap sensor + FRL + 3/2 valve",
      "§23.3",
      "SMC ISA3 / Festo SOPA",
      "medium"
     ],
     [
      "17",
      "6",
      "inductive sensors (4 × M12, 2 × M18)",
      "§23.1",
      "Balluff / ifm / Pepperl+Fuchs",
      "6 × low"
     ],
     [
      "18",
      "1",
      "RFID reader + 3 tags",
      "HF 13.56 MHz",
      "Balluff / ifm / Pepperl+Fuchs",
      "medium"
     ],
     [
      "19",
      "1",
      "safety PLC / remote I/O share",
      "§24.4",
      "Siemens S7-1500F + ET 200SP",
      "high"
     ],
     [
      "20",
      "1",
      "light curtain type 4, 14 mm",
      "S ≥ 640 mm (or 958 mm with SS1 ramp)",
      "SICK / Pilz",
      "medium–high"
     ],
     [
      "21",
      "2",
      "door switches with guard locking",
      "ISO 14119",
      "Euchner / Pilz / Schmersal",
      "2 × medium"
     ],
     [
      "22",
      "1",
      "guards + APC door + partition wall",
      "§5.2",
      "MAKE / guarding supplier",
      "high"
     ],
     [
      "23",
      "1",
      "arm, cross beams, fork rails, locating blocks, hub, carriage, base",
      "§11.3",
      "MAKE",
      "high – very high (workshop hours)"
     ],
     [
      "24",
      "1 set",
      "hoses, tubes, fittings, cables, drag chain",
      "§11.7",
      "Parker / Rexroth / igus",
      "medium"
     ]
    ],
    "m": 4,
    "p": 5,
    "w": [
     4,
     6,
     22,
     28,
     26,
     14
    ]
   }
  ],
  "shopTab": "Shopping list – one APC",
  "shopLbl": "shopping list",
  "shopTitle": "Shopping list for one 2-pallet rotary APC (consolidated example) – guide 09 §28.11.",
  "price": "Price classes (guide 09, single unit): low < ≈ 300 € · medium ≈ 300 – 1 500 € · high ≈ 1 500 – 8 000 € · very high > 8 000 € – estimate, ask for a quote.",
  "shopNote": "Hydraulic elements in general (pumps, valves, accumulators, filters, hoses): guide 29 §17 and guide 25 §18 (Hydraulics tab).",
  "ph": "(e.g. SCHUNK VERO-S, Roemheld, Balluff, Rexroth, Pilz)"
 },
 "agv1": {
  "guide": "guide 11",
  "drawings": [
   {
    "f": "11_agv_layout.svg",
    "c": "AGV U300 – chassis plan (drive rocker, castors, battery, cam shafts, control box, scanners with fields) and side view with dimensions",
    "g": "guide 11 §4.1.2",
    "t": "AGV U300 – chassis plan"
   },
   {
    "f": "11_electrical_schematic.svg",
    "c": "AGV U300 electrical overview – battery, BMS, FC1, QB1, precharge, QA1, DC bus, branch fuses, drives, chopper, DC/DC, 24 V, safety controller, STO, scanners, E-stops, CAN …",
    "g": "guide 11 §11.7",
    "t": "AGV U300 – electrical overview"
   },
   {
    "f": "11_kinematics.svg",
    "c": "Drive kinematics – differential, tricycle and mecanum with formulas and example values",
    "g": "guide 11 §19",
    "t": "Drive kinematics (differential, tricycle, mecanum)"
   },
   {
    "f": "11_traction_forces.svg",
    "c": "Traction forces of the 1 t pallet AGV – free-body diagram, torque vs slope, step climbing",
    "g": "guide 11 §20",
    "t": "Traction forces of the 1 t pallet AGV"
   },
   {
    "f": "11_battery_sizing.svg",
    "c": "Battery sizing – energy per 8 h shift and state of charge over two shifts",
    "g": "guide 11 §22",
    "t": "Battery sizing (energy per shift)"
   },
   {
    "f": "11_safety_fields.svg",
    "c": "Safety laser scanner fields vs speed – field length curves (flat and 1 % downhill), components, field sets, curve field, docking field",
    "g": "guide 11 §23",
    "t": "Safety scanner fields vs speed"
   },
   {
    "f": "11_fleet_layout.svg",
    "c": "Fleet route plan for the crankcase line – AS/RS, load station, 3 HMCs, lanes, traffic zones, chargers",
    "g": "guide 11 §25",
    "t": "Fleet route plan – crankcase line"
   },
   {
    "f": "11_docking_budget.svg",
    "c": "Docking accuracy budget – RSS stop error and the coarse-to-fine catching chains A, B, C",
    "g": "guide 11 §27",
    "t": "Docking accuracy budget"
   }
  ],
  "groups": [
   {
    "id": "v29_1",
    "t": "Complete AGVs / AMRs",
    "src": "guide 11 §29.1",
    "rows": [
     [
      "Complete AGVs / AMRs",
      "omnidirectional (mecanum) mobile platform",
      "KUKA KMP 1500 (and successors – check)",
      "payload 1500 kg (maker); speed, accuracy – see datasheet",
      "very high",
      "floor quality for mecanum, top module for 1104 mm transfer height, VDA 5050, safety concept"
     ],
     [
      "Complete AGVs / AMRs",
      "AMR, differential, natural navigation",
      "MiR600 / MiR1350 (Mobile Industrial Robots)",
      "payload 600 kg / 1350 kg (maker)",
      "very high",
      "top modules (lift, rollers), docking accuracy with markers, MiR Fleet, ISO 3691-4 statement"
     ],
     [
      "Complete AGVs / AMRs",
      "AMR",
      "OMRON LD-90 / LD-250, HD-1500",
      "payload 90 / 250 / 1500 kg (maker)",
      "high – very high",
      "top modules, fleet manager (name – check), VDA 5050 support"
     ],
     [
      "Complete AGVs / AMRs",
      "automated pallet truck / reach truck / tugger",
      "Linde L-MATIC / R-MATIC / P-MATIC (check range)",
      "see datasheet",
      "very high",
      "pallet type, lift height, navigation, integration package"
     ],
     [
      "Complete AGVs / AMRs",
      "automated stacker / pallet truck",
      "Jungheinrich EKS 215a / ERC 215a / ERE 225a (check)",
      "see datasheet",
      "very high",
      "good for floor pallets, not for the APC deck"
     ],
     [
      "Complete AGVs / AMRs",
      "modular AGVs, assembly-line and logistics platforms",
      "SAFELOG (AGV M- / X-series – check)",
      "see datasheet",
      "high – very high",
      "fleet concept, custom deck options"
     ],
     [
      "Complete AGVs / AMRs",
      "autonomous pallet forklift, omnidirectional",
      "AGILOX ONE / OCF (check)",
      "see datasheet",
      "very high",
      "pallet handling only, own fleet logic"
     ],
     [
      "Complete AGVs / AMRs",
      "latent lifting robot, QR grid",
      "Geek+ P-series (e.g. P800 / P1200 – check)",
      "payload by model – see datasheet",
      "high",
      "QR grid needs clean floors – not for the casting area; rack format"
     ],
     [
      "Complete AGVs / AMRs",
      "latent lifting robot, QR / SLAM",
      "Hikrobot latent lifting robots (Q-series – check)",
      "see datasheet",
      "high",
      "as above; local support"
     ]
    ]
   },
   {
    "id": "v29_2",
    "t": "Drive units and traction motors",
    "src": "guide 11 §29.2",
    "rows": [
     [
      "Drive units and traction motors",
      "complete AGV drive (motor + gearbox + wheel + electronics), 24/48 V",
      "ebm-papst ArgoDrive",
      "see datasheet",
      "medium – high",
      "wheel load, top speed with the wheel Ø, brake, STO, CANopen"
     ],
     [
      "Drive units and traction motors",
      "drive / steer-drive units",
      "Framo Morat AGV drive units (check)",
      "see datasheet",
      "high",
      "load, steering option for a tricycle, motor interface"
     ],
     [
      "Drive units and traction motors",
      "low-voltage AC / PM traction motors",
      "Schabmüller traction motors (check)",
      "see datasheet",
      "medium – high",
      "voltage, cooling, encoder, matching controller (Curtis / ZAPI)"
     ],
     [
      "Drive units and traction motors",
      "AGV drive and steer-drive units",
      "MRT / Metalrota (check)",
      "see datasheet",
      "high",
      "as above"
     ],
     [
      "Drive units and traction motors",
      "drive units + servo",
      "Kollmorgen AGV drive solutions (check)",
      "see datasheet",
      "high",
      "low-voltage winding, CANopen, combination with NDC navigation"
     ],
     [
      "Drive units and traction motors",
      "–",
      "Ehrhardt / Schmidt-Kranz / BEUMER (check – not confirmed as AGV drive-unit makers)",
      "–",
      "–",
      "confirm before sending an enquiry"
     ],
     [
      "Drive units and traction motors",
      "planetary gearbox + BLDC + PU wheel on own bearings",
      "Own design (11.2)",
      "11.2",
      "medium",
      "cheapest, but you carry the design"
     ]
    ]
   },
   {
    "id": "v29_3",
    "t": "Servo motors and drives for 24/48 V",
    "src": "guide 11 §29.3",
    "rows": [
     [
      "Servo motors and drives for 24/48 V",
      "PMSM servo",
      "Kollmorgen AKM motors (AKD drives are mains-voltage drives – for 48 V ask for a low-voltage winding and a matching low-voltage drive – check)",
      "see datasheet",
      "medium – high",
      "low-voltage winding, brake, encoder, drive running at 48 V DC"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "servo",
      "Bosch Rexroth (low-voltage servo range – check)",
      "see datasheet",
      "medium – high",
      "48 V option, STO, CANopen"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "BLDC + controller up to ≈ 50 V",
      "Maxon EC motors + EPOS4 / ESCON",
      "see datasheet",
      "medium",
      "power class (strong up to a few 100 W), GP gearbox, encoder, STO version"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "24/48 V BLDC",
      "ebm-papst ECI (BLDC with integrated electronics)",
      "see datasheet",
      "low – medium",
      "CANopen version, gearbox, brake"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "dual-channel BLDC controller up to ≈ 60 V",
      "Roboteq (SBL / HBL / FBL brushless controllers – check)",
      "see datasheet",
      "medium",
      "CANopen; STO often not certified – check"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "truck AC / PM motor controllers 24–80 V",
      "Curtis (1232SE / 1236SE / 1212 – check)",
      "see datasheet",
      "medium",
      "CANopen, encoder, safety functions"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "truck motor controllers",
      "ZAPI (ACE2 / ACE0 – check), Sevcon / BorgWarner Gen4 (check)",
      "see datasheet",
      "medium",
      "as Curtis"
     ],
     [
      "Servo motors and drives for 24/48 V",
      "compact low-voltage servo drives",
      "Elmo (Gold Twitter / Gold Solo – check), Ingenia (Everest / Capitan – check), Kinco FD low-voltage servo (check)",
      "see datasheet",
      "low – medium",
      "STO SIL rating, CiA 402 CSV mode, DC bus rating ≥ 70 V (chopper 58 V, 4.2.3)"
     ]
    ]
   },
   {
    "id": "v29_4",
    "t": "Wheels and castors",
    "src": "guide 11 §29.4",
    "rows": [
     [
      "Wheels and castors",
      "drive Ø150 × 50 ≥ 350 kg; Ø200 × 60 ≥ 500 kg; castors Ø100 150 kg, Ø150 sprung",
      "Blickle (Extrathane / Besthane PU wheels, castor ranges – check series)",
      "see datasheet",
      "low – medium",
      "load at your speed (4–6 km/h), 92–95 ShA, hub bore and key, bond quality"
     ],
     [
      "Wheels and castors",
      "castors Ø100 / Ø150, sprung",
      "Tente (industrial and sprung castors – check)",
      "see datasheet",
      "low – medium",
      "spring rate (want 10–15 N/mm, 10.1.4), swivel bearing"
     ],
     [
      "Wheels and castors",
      "PU wheels and castors",
      "RADO (check)",
      "see datasheet",
      "low – medium",
      "as above"
     ],
     [
      "Wheels and castors",
      "high-load drive wheels",
      "Vulkollan-type cast PU (Covestro elastomer, used by many wheel makers)",
      "–",
      "medium",
      "ask for the PU type in writing"
     ]
    ]
   },
   {
    "id": "v29_5",
    "t": "Batteries and BMS",
    "src": "guide 11 §29.5",
    "rows": [
     [
      "Batteries and BMS",
      "LFP / NMC packs with BMS",
      "BMZ (industrial Li-ion systems – check range)",
      "see datasheet",
      "high",
      "custom size 471 × 240 × 150 mm, CAN protocol, IEC 62619"
     ],
     [
      "Batteries and BMS",
      "traction batteries",
      "Hoppecke (lithium traction range – check)",
      "see datasheet",
      "high",
      "AGV formats, chargers from the same maker"
     ],
     [
      "Batteries and BMS",
      "LFP modules / packs",
      "Ultralife (check), Super B (LFP modules – check)",
      "see datasheet",
      "medium – high",
      "series connection, BMS master, certificates"
     ],
     [
      "Batteries and BMS",
      "16s1p 60 Ah / 16s1p 105 Ah",
      "Custom pack from LFP cells (e.g. CATL / EVE / CALB – check) by a pack assembler",
      "see datasheet",
      "medium – high",
      "assembler's IEC 62619 test, BMS supplier, warranty"
     ],
     [
      "Batteries and BMS",
      "separate BMS for own packs",
      "Orion BMS / REC BMS (check)",
      "see datasheet",
      "medium",
      "CAN messages, contactor control, balancing current"
     ]
    ]
   },
   {
    "id": "v29_6",
    "t": "Chargers and charging contacts",
    "src": "guide 11 §29.6",
    "rows": [
     [
      "Chargers and charging contacts",
      "inductive, 1.5–3 kW class (e.g. etaLINK 3000 = 3 kW – check)",
      "Wiferion etaLINK (now part of the PULS group – check name)",
      "air gap, efficiency – see datasheet",
      "high",
      "position tolerance, LFP 48 V charge curve, CAN to the BMS"
     ],
     [
      "Chargers and charging contacts",
      "on-board / off-board chargers 48 V",
      "Delta-Q (IC650 / IC1200 – check)",
      "see datasheet",
      "medium",
      "LFP profile, CAN, IP rating"
     ],
     [
      "Chargers and charging contacts",
      "industrial truck chargers",
      "Fronius Selectiva (check)",
      "see datasheet",
      "medium – high",
      "LFP profile, communication"
     ],
     [
      "Chargers and charging contacts",
      "contact system ≥ 50 A",
      "Stäubli automatic charging connectors for AGVs (series – check)",
      "see datasheet",
      "medium",
      "misalignment tolerance, current, pilot contact"
     ],
     [
      "Chargers and charging contacts",
      "floor contacts / collectors, inductive",
      "Conductix-Wampfler, Schunk Transit Systems (check)",
      "see datasheet",
      "medium – high",
      "current, wear parts, dead-until-docked function"
     ]
    ]
   },
   {
    "id": "v29_7",
    "t": "Safety laser scanners",
    "src": "guide 11 §29.7",
    "rows": [
     [
      "Safety laser scanners",
      "–",
      "SICK nanoScan3",
      "275°, protective field ≈ 3 m (check variant), compact for AGVs",
      "high",
      "number of field sets, response time, data output for your navigation software"
     ],
     [
      "Safety laser scanners",
      "–",
      "SICK outdoorScan3",
      "outdoor-rated safety scanner (check)",
      "high",
      "only for outdoor routes"
     ],
     [
      "Safety laser scanners",
      "–",
      "SICK microScan3",
      "275°, longer protective-field variants (check)",
      "high",
      "size, field range"
     ],
     [
      "Safety laser scanners",
      "–",
      "Hokuyo UAM-01 (e.g. UAM-01LP – check)",
      "Type 3, ≈ 270°",
      "medium – high",
      "field sets, data output"
     ],
     [
      "Safety laser scanners",
      "–",
      "Leuze RSL 400 (RSL 410 … 445 – check)",
      "Type 3, 270°, long-range variants",
      "high",
      "measurement data, field sets"
     ],
     [
      "Safety laser scanners",
      "–",
      "Pilz PSENscan",
      "Type 3, 275° (check)",
      "medium – high",
      "data output for navigation (often not available)"
     ]
    ]
   },
   {
    "id": "v29_8",
    "t": "Navigation sensors and controllers",
    "src": "guide 11 §29.8",
    "rows": [
     [
      "Navigation sensors and controllers",
      "reflector navigation laser (position output)",
      "SICK NAV350",
      "–",
      "high",
      "reflector type, range, interface to your controller"
     ],
     [
      "Navigation sensors and controllers",
      "contour localisation software with SICK scanners",
      "SICK LiDAR-LOC",
      "–",
      "high",
      "licence, accuracy on your map"
     ],
     [
      "Navigation sensors and controllers",
      "complete navigation controller + fleet",
      "Kollmorgen NDC (NDC8 vehicle controller – check)",
      "–",
      "very high",
      "VDA 5050, supported vehicle types, engineering support"
     ],
     [
      "Navigation sensors and controllers",
      "natural navigation kit + fleet server",
      "BlueBotics ANT (ANT lite+ / ANT driven – check)",
      "–",
      "high – very high",
      "supported drives, VDA 5050, scanner pairing"
     ],
     [
      "Navigation sensors and controllers",
      "natural navigation for AGV builders",
      "NAVITEC Systems (Navitrol – check)",
      "–",
      "high",
      "as above"
     ],
     [
      "Navigation sensors and controllers",
      "camera reads floor Data-Matrix tape / codes",
      "Pepperl+Fuchs PGV (position guided vision)",
      "–",
      "medium",
      "durability (not in the casting area)"
     ],
     [
      "Navigation sensors and controllers",
      "magnetic / optical line sensor",
      "SICK MLS / OLS",
      "–",
      "low – medium",
      "simple tape routes, fine positioning"
     ],
     [
      "Navigation sensors and controllers",
      "software stack",
      "ROS 2 Nav2 (open source) on your PC",
      "–",
      "low licence, high engineering",
      "not certified – safety stays in KF1; prototypes only"
     ]
    ]
   },
   {
    "id": "v29_9",
    "t": "Safety controllers",
    "src": "guide 11 §29.9",
    "rows": [
     [
      "Safety controllers",
      "–",
      "SICK Flexi Soft (with drive monitor / motion control module – check FX3-MOC)",
      "PL e, safe speed from 2 encoders, scanner field switching",
      "medium – high",
      "encoder types, number of field sets switched, EFI link to SICK scanners"
     ],
     [
      "Safety controllers",
      "–",
      "SICK Flexi Compact (check)",
      "compact safety controller",
      "medium",
      "speed monitoring option"
     ],
     [
      "Safety controllers",
      "–",
      "Pilz PNOZmulti 2 (with speed monitoring modules – check)",
      "PL e, configurable",
      "medium – high",
      "safe speed modules, scanner integration"
     ],
     [
      "Safety controllers",
      "–",
      "Safety PLC (e.g. Siemens S7-1500F / ET 200SP F – check)",
      "PL e",
      "high",
      "size and 24 V power on a small AGV"
     ]
    ]
   },
   {
    "id": "v29_10",
    "t": "Fleet software",
    "src": "guide 11 §29.10",
    "rows": [
     [
      "Fleet software",
      "AGV fleet manager",
      "Kollmorgen fleet manager (NDC – check)",
      "–",
      "very high",
      "VDA 5050 master, mixed fleets, offline install"
     ],
     [
      "Fleet software",
      "for MiR robots (VDA 5050 – check)",
      "MiR Fleet",
      "–",
      "high",
      "mixed-fleet support"
     ],
     [
      "Fleet software",
      "fleet manager for its navigation",
      "NAVITEC fleet manager (check)",
      "–",
      "high",
      "VDA 5050"
     ],
     [
      "Fleet software",
      "VDA 5050 master, mixed fleets",
      "SYNAOS (intralogistics platform – check)",
      "–",
      "high – very high",
      "on-premise / offline possible?"
     ],
     [
      "Fleet software",
      "fleet control, VDA 5050 driver available (check)",
      "openTCS (Fraunhofer IML, open source, Java)",
      "–",
      "low (licence free)",
      "good for a first offline test with the twin; support by community / integrators"
     ]
    ]
   },
   {
    "id": "v29_11",
    "t": "Industrial Wi-Fi",
    "src": "guide 11 §29.11",
    "rows": [
     [
      "Industrial Wi-Fi",
      "APs + clients, iPCF fast roaming (check)",
      "Siemens SCALANCE W (W1700 / W700 APs, W721 / W722 / W734 clients – check)",
      "–",
      "medium – high",
      "roaming mode, 5 GHz non-DFS channels, M12 connectors"
     ],
     [
      "Industrial Wi-Fi",
      "client + AP, Turbo Roaming (check)",
      "Moxa AWK (AWK-1137C client, AWK-3252A AP – check)",
      "–",
      "medium",
      "roaming time, 24 V supply, IP rating"
     ],
     [
      "Industrial Wi-Fi",
      "APs + clients",
      "Phoenix Contact FL WLAN (1100 / 5100 – check)",
      "–",
      "medium",
      "as above"
     ],
     [
      "Industrial Wi-Fi",
      "industrial APs",
      "Cisco Catalyst IW, Hirschmann BAT (check)",
      "–",
      "high",
      "fast roaming (802.11r), management"
     ]
    ]
   },
   {
    "id": "v29_12",
    "t": "Lift units",
    "src": "guide 11 §29.12",
    "rows": [
     [
      "Worm gear motor for the cam lift (U300)",
      "48 V BLDC 200 W, i = 120, hollow shaft Ø30 (11.4)",
      "SEW-EURODRIVE, NORD, ebm-papst (worm + ECI)",
      "–",
      "–",
      "self-locking, 48 V version"
     ],
     [
      "Screw jacks (alternative B)",
      "Tr 30 × 6, ≥ 5 kN each (4.1.7)",
      "Pfaff-silberblau, ZIMM, NEFF",
      "–",
      "–",
      "self-locking, bellows, end switches"
     ],
     [
      "Electric actuators for the scissor (P1000)",
      "2 × 25 kN, stroke ≥ 187 mm, servo, brake, CANopen (4.3.12)",
      "Ewellix (CASM – check), Thomson, Servomech, Tolomatic",
      "–",
      "–",
      "force at 48 V, synchronisation, encoder, brake holding force"
     ],
     [
      "Ball transfer units, track rollers, chains",
      "1.5 kN BTU, KR 22, 10B-1 (4.3, 4.1.7)",
      "Alwayse / Omnitrack (BTU – check), INA / SKF (rollers), iwis / Renold (chains)",
      "–",
      "–",
      "catalogue load, sealing against dust"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "#",
     "Item",
     "Qty",
     "Spec",
     "Section"
    ],
    "rows": [
     [
      "1",
      "Navigation controller + licence (contour + reflectors)",
      "4",
      "VDA 5050 client, offline",
      "18, 29.8"
     ],
     [
      "2",
      "Fleet manager software + on-premise server + MQTT broker",
      "1",
      "VDA 5050 2.x, traffic zones, charging",
      "25, 29.10"
     ],
     [
      "3",
      "Safety laser scanner",
      "8",
      "Type 3, PL d, ≥ 16 field sets, Ethernet data",
      "23, 29.7"
     ],
     [
      "4",
      "Safety controller with safe speed",
      "4",
      "PL e, 2 encoder inputs",
      "11.9, 29.9"
     ],
     [
      "5",
      "Servo drive 48 V, CiA 402, STO",
      "4 (U300 drive) + 2 (U300 lift) + 4 (P1000 drive) + 2 (P1000 actuators, if not integrated) + 2 (P1000 chain)",
      "U300 10/30 A; P1000 size from the 400 W motor data",
      "4.2, 29.3"
     ],
     [
      "6",
      "BLDC servo motor + planetary gearbox + brake",
      "4 × 200 W i = 20 · 4 × 400 W i = 30",
      "4.1.4, 20.2",
      "29.2, 29.3"
     ],
     [
      "7",
      "Drive wheel PU 92–95 ShA",
      "4 × Ø150 · 4 × Ø200 (+ 4 spare)",
      "21.1",
      "29.4"
     ],
     [
      "8",
      "Castors (with own spring units 11.3 or sprung castors)",
      "8 × Ø100 · 8 × Ø150",
      "15 N/mm",
      "29.4"
     ],
     [
      "9",
      "LFP battery + BMS",
      "2 × 60 Ah · 2 × 105 Ah",
      "16s 51.2 V, IEC 62619",
      "22, 29.5"
     ],
     [
      "10",
      "Charging collector on the vehicle + floor contacts",
      "4 + 3 stations",
      "≥ 50 A, dead until docked",
      "22.5, 29.6"
     ],
     [
      "11",
      "Charger 48 V LFP 1.5 kW (or inductive 3 kW)",
      "3",
      "CAN to the BMS",
      "29.6"
     ],
     [
      "12",
      "Lift: worm gear motor + cams (U300) / actuators 25 kN (P1000)",
      "2 / 4",
      "4.1.7, 4.3.4",
      "29.12"
     ],
     [
      "13",
      "Main fuse, main switch, contactors, precharge, DC/DC, branch fuses",
      "4 sets",
      "11.7.1",
      "24"
     ],
     [
      "14",
      "E-stops, mode key, pendant, LED strip, buzzer",
      "4 sets",
      "11.9",
      "23"
     ],
     [
      "15",
      "E84-style optical I/O pairs",
      "2 (on P1000) + 4 (LOAD-CC + 3 APC stations)",
      "4.3.9",
      "27"
     ],
     [
      "16",
      "Industrial Wi-Fi APs + clients",
      "≈ 9 APs + 4 clients",
      "5 GHz, fast roaming",
      "26, 29.11"
     ],
     [
      "17",
      "Reflectors for the stations",
      "≈ 30",
      "at scanner height",
      "18.2"
     ],
     [
      "18",
      "Spare parts set",
      "1",
      "28.3",
      "28"
     ],
     [
      "19",
      "Measuring tools: 6 platform scales, Ø200 test body, laser distance meter, 1 kN load cell",
      "1 set",
      "5.5, 5.7",
      "–"
     ],
     [
      "20",
      "Safety tools: scanner + safety controller software, SISTEMA",
      "1",
      "offline installation",
      "11.9"
     ]
    ],
    "m": 1,
    "p": -1,
    "w": [
     5,
     30,
     10,
     40,
     15
    ]
   }
  ],
  "shopTab": "Shopping list – crankcase-line fleet",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list for the crankcase-line fleet (2 × pallet AGV P1000, 2 × crate AGV U300) – guide 11 §29.13.",
  "price": "Price classes (guide 11, per unit): low < ≈ 300 € · medium ≈ 300 – 1 500 € · high ≈ 1 500 – 8 000 € · very high > 8 000 € – estimate, ask for a quote.",
  "shopNote": "Compare a complete AGV / AMR (group 29.1) with the self-built AGVs of items 1 and 3 before you decide make or buy.",
  "ph": "(e.g. SICK nanoScan3, BMS, VDA 5050, Blickle, KUKA)"
 },
 "asm1": {
  "guide": "guide 17",
  "drawings": [
   {
    "f": "17_rotary_table_exploded.svg",
    "c": "Exploded view of the rotary table: part numbers, assembly directions and step numbers",
    "g": "guide 17 §3.1",
    "t": "Rotary table – exploded view"
   },
   {
    "f": "17_precedence_diagram.svg",
    "c": "Precedence diagram of the 18 assembly steps with the worm cartridge sub-assembly in parallel and the critical path",
    "g": "guide 17 §17.3",
    "t": "Precedence diagram (18 steps)"
   },
   {
    "f": "17_interference_fit.svg",
    "c": "Interference fit: ISO 286 fit zones, Lamé pressure and hoop stress, worked numbers for the worm bearing seat",
    "g": "guide 17 §18.6",
    "t": "Interference fit (ISO 286, Lamé)"
   },
   {
    "f": "17_bearing_mounting.svg",
    "c": "Bearing mounting: induction heating, correct and wrong force path for pressing, preload and friction torque measurement set-up",
    "g": "guide 17 §19.5",
    "t": "Bearing mounting (heating, force path)"
   },
   {
    "f": "17_bolt_torque_preload.svg",
    "c": "Bolt tightening: torque–angle–preload chart, preload scatter of the methods, torque split and the effect of thread friction",
    "g": "guide 17 §20.5",
    "t": "Bolt torque – angle – preload"
   },
   {
    "f": "17_worm_mesh_contact.svg",
    "c": "Worm mesh: contact pattern on the wheel flank, duplex worm shift with the spacer ring, backlash measurement",
    "g": "guide 17 §21.4",
    "t": "Worm mesh contact pattern"
   },
   {
    "f": "17_measurement_setup.svg",
    "c": "Measuring set-ups: radial and axial runout, flatness grid, worm axial play, friction torque at the worm and at the table",
    "g": "guide 17 §25.5",
    "t": "Measuring set-ups (runout, flatness, play)"
   },
   {
    "f": "17_assembly_station_layout.svg",
    "c": "Assembly station layout: rotatable stand, crane reach, sub-assembly bench, tool board, measuring corner, hydraulic test cart",
    "g": "guide 17 §26.3",
    "t": "Assembly station layout"
   }
  ],
  "groups": [
   {
    "id": "r32_1",
    "t": "Table bearings",
    "src": "guide 17 §32.1",
    "rows": [
     [
      "Table bearings",
      "Axial-radial bearing, bore 200, seat Ø300, M_k allowed ≥ 25 kN·m, preloaded, ≤ 20 rpm",
      "Schaeffler INA YRT 200",
      "d 200 / D 300 / H 45 mm; mass ≈ 9.7 kg (check); fixing screws, torques, friction torque, runout: see datasheet",
      "€€",
      "screw size + torque (vs twin 24 × M10), seat tolerances, friction torque, transport screws, delivery time"
     ],
     [
      "Table bearings",
      "as above",
      "Schaeffler YRTC (lower friction), YRTS (high speed, for direct-drive tables)",
      "see datasheet",
      "€€–€€€",
      "needed only if the B-axis speed rises (direct drive)"
     ],
     [
      "Table bearings",
      "as above",
      "Schaeffler YRTM / YRTSM (magnetic measuring system)",
      "see datasheet",
      "€€€",
      "accuracy vs the optical encoder of the twin (±2.5″)"
     ],
     [
      "Table bearings",
      "Direct-drive table bearing",
      "Schaeffler ZKLDF (axial angular contact ball bearing, double direction)",
      "see datasheet",
      "€€",
      "for torque-motor tables (guide 12 M6 comparison)"
     ],
     [
      "Table bearings",
      "Crossed roller bearing alternative",
      "IKO CRBH / CRBF / CRBS series (crossed roller); THK RU / RB series",
      "see datasheet",
      "€€",
      "tilting stiffness and runout class vs YRT; mounting holes"
     ],
     [
      "Table bearings",
      "Other makers",
      "NSK (ask the local office for rotary-table bearings – range differs by region), Timken (TXR crossed tapered), Rothe Erde (larger slewing bearings)",
      "see datasheet",
      "€€",
      "offer with drawing, friction torque guarantee"
     ]
    ]
   },
   {
    "id": "r32_2",
    "t": "Worm sets / precision gearing",
    "src": "guide 17 §32.2",
    "rows": [
     [
      "Worm sets / precision gearing",
      "Duplex worm + bronze wheel, m 4, z 1/90, a = 205, quality DIN 3974 grade ≈ 5–6 (check)",
      "custom precision worm gear makers, e.g. Framo Morat (DE), KHK Kohara Gear (JP, catalogue worm sets incl. duplex types – check), specialist rotary-table suppliers (worm sets as spare parts)",
      "see datasheet / offer",
      "€€ (pair)",
      "duplex lead difference, matched pair test report (single / double flank), contact pattern photo, bronze grade (CuSn12Ni2 or similar), hardness of the worm"
     ],
     [
      "Worm sets / precision gearing",
      "Whole rotary table instead of making it",
      "rotary table makers, e.g. Nikken, Tsudakoma, Kitagawa, Lehmann, Peiseler, Fibro",
      "see catalogue",
      "€€€",
      "make-or-buy decision (guide 12)"
     ],
     [
      "Worm sets / precision gearing",
      "Gear measuring service",
      "gear measuring machine owners (Klingelnberg, Gleason, Wenzel users), local labs",
      "–",
      "€ per part",
      "DIN 3974 / ISO 1328 report"
     ]
    ]
   },
   {
    "id": "r32_3",
    "t": "Induction heaters and mounting tools",
    "src": "guide 17 §32.3",
    "rows": [
     [
      "Induction heaters and mounting tools",
      "Heat worm bearing inner rings (bore 25, ≈ 0.2 kg) to 100–110 °C, temperature mode, demagnetise (E9)",
      "SKF TIH 030m",
      "portable; max workpiece ≈ 20 kg (check); temperature probe, auto demagnetisation",
      "€€",
      "smallest yoke fits bore 25? (else small yoke / hot plate)"
     ],
     [
      "Induction heaters and mounting tools",
      "as above",
      "SKF TIH 100m; Schaeffler HEATER10 / HEATER20 / HEATER35; Simatherm IH 025 / IH 045",
      "see datasheet",
      "€€",
      "yoke set, power supply (230 V / 400 V), magnetic probe"
     ],
     [
      "Induction heaters and mounting tools",
      "Small bearing hot plate (alternative for very small rings)",
      "e.g. SKF 729659 C electric hot plate (check)",
      "see datasheet",
      "€",
      "temperature control"
     ],
     [
      "Induction heaters and mounting tools",
      "Bearing fitting tool kit (impact-free sleeves)",
      "SKF TMFT 36, Schaeffler fitting tool set (check name)",
      "sleeves / rings for bores ≈ 10–50 mm",
      "€",
      "covers bore 25 / OD 52"
     ],
     [
      "Induction heaters and mounting tools",
      "Hydraulic nut / injector (big tapered seats – not needed here)",
      "SKF HMV..E hydraulic nuts, SKF 729124 pump",
      "see datasheet",
      "€€",
      "only for big spindles"
     ],
     [
      "Induction heaters and mounting tools",
      "Hydraulic press for dowels / small press fits (9.6 kN, 18.5)",
      "Enerpac RC-cylinder (e.g. RC-106) + P-392 hand pump in a press frame; or a manual arbor press 2–5 t",
      "10 t cylinder, 700 bar pump",
      "€–€€",
      "stroke, frame, force gauge"
     ],
     [
      "Induction heaters and mounting tools",
      "Bearing puller / extractor for service",
      "SKF TMMA, Kukko, Gedore",
      "see datasheet",
      "€",
      "inner-ring pulling only"
     ]
    ]
   },
   {
    "id": "r32_4",
    "t": "Torque tools",
    "src": "guide 17 §32.4",
    "rows": [
     [
      "Torque tools",
      "Click wrenches 5–60, 20–100, 60–340 N·m (E8), ISO 6789-1 type II",
      "Stahlwille Manoskop 730, Gedore Dremometer, Norbar Industrial / Pro, Hazet 5100",
      "±4 % (ISO 6789-1 class)",
      "€ each",
      "range, square drive, calibration certificate ISO 6789-2"
     ],
     [
      "Torque tools",
      "Electronic wrench with torque + angle + data output (precision joints)",
      "Atlas Copco STwrench (with controller), Stahlwille Manoskop 714 / 730D (Sensomaster), Norbar NorTronic, Gedore electronic",
      "±1–2 % reading (check), angle, memory, USB / wireless",
      "€€ (wrench + software)",
      "MES interface, joint programs, screw counting"
     ],
     [
      "Torque tools",
      "Torque screwdriver 1–5 N·m (encoder M4)",
      "Wera Click-Torque, Stahlwille Torsiomax / Torsiotronic, Tohnichi RTD",
      "±6 %",
      "€",
      "range, bits"
     ],
     [
      "Torque tools",
      "Torque multiplier (M16 285 N·m)",
      "Norbar HandTorque, Gedore DVV",
      "see datasheet",
      "€",
      "reaction arm fits the stand"
     ],
     [
      "Torque tools",
      "Torque tester / calibration bench",
      "Norbar Pro-Test / TTT, Stahlwille Perfectcontrol 7794, Atlas Copco ACTA",
      "1–400 N·m",
      "€€",
      "in-house check, not a replacement for accredited calibration"
     ],
     [
      "Torque tools",
      "DC nutrunner (series, later)",
      "Atlas Copco Tensor, Bosch Rexroth Nexo, Desoutter",
      "±3 % with control",
      "€€€",
      "only for higher volume"
     ]
    ]
   },
   {
    "id": "r32_5",
    "t": "Measuring tools",
    "src": "guide 17 §32.5",
    "rows": [
     [
      "Measuring tools",
      "Dial / test indicators 0.001 mm (E7)",
      "Mitutoyo 2109 series (dial 0.001), 513 series (test indicator), Mahr MarCator 1086, Tesa",
      "0.001 mm",
      "€",
      "measuring force, stems Ø8"
     ],
     [
      "Measuring tools",
      "Electronic probe 0.1 µm (bearing runout 3 µm)",
      "Mahr Millimar (C1208 / C1240 + P2004 inductive probe), Tesa GT21 / TT, Mitutoyo LGF / Digimatic ID-C (0.5 µm class)",
      "0.1 µm resolution",
      "€€",
      "probe force, amplifier, data output"
     ],
     [
      "Measuring tools",
      "Granite plate (E5 / measuring corner)",
      "Mitutoyo 517 series, Microplan, Eley, local makers",
      "grade 0 / 00 (ISO 8512-2 or DIN 876)",
      "€–€€",
      "flatness certificate, support stand"
     ],
     [
      "Measuring tools",
      "Height gauge (E13)",
      "Mitutoyo Linear Height LH-600, Trimos V series, Tesa Micro-Hite",
      "0.001 mm",
      "€€",
      "air bearing, data out"
     ],
     [
      "Measuring tools",
      "Gauge blocks grade 1 (E13)",
      "Mitutoyo, Tesa, Mahr",
      "ISO 3650 grade 1",
      "€€",
      "certificate"
     ],
     [
      "Measuring tools",
      "Micrometers + depth micrometer (E14)",
      "Mitutoyo 293 (outside), 329 (depth), Mahr Micromar",
      "0.001 mm",
      "€",
      "setting standards"
     ],
     [
      "Measuring tools",
      "Precision level 0.02 mm/m (E6) / electronic level",
      "machinist level (Mitutoyo, Starrett), Wyler BlueLEVEL / Zerotronic",
      "0.02 mm/m / 1 µm/m",
      "€–€€",
      "reversal test"
     ],
     [
      "Measuring tools",
      "Autocollimator + polygon (E12)",
      "Möller-Wedel ELCOMAT, Taylor Hobson, polygons from Möller-Wedel",
      "≤ 0.1″ resolution",
      "€€€",
      "certificate with face errors; or rent / service"
     ],
     [
      "Measuring tools",
      "Laser + rotary calibrator (alternative E12)",
      "Renishaw XL-80 + XR20(-W)",
      "see datasheet (XR20 ≈ ±1″, check)",
      "€€€",
      "software ISO 230-2 analysis"
     ],
     [
      "Measuring tools",
      "Torque gauge for friction torque (worm, J6)",
      "Tohnichi BTG dial torque gauge, Lorenz Messtechnik DR-series torque sensors, Kistler 4502A / 4503B, HBK T22",
      "0–1 / 0–2 N·m range",
      "€–€€",
      "running vs breakaway reading, adapters"
     ],
     [
      "Measuring tools",
      "Force gauge + lever (table friction torque)",
      "Sauter, Mark-10, Imada",
      "0–200 N",
      "€",
      "peak / track mode"
     ],
     [
      "Measuring tools",
      "Load cell 5 kN (E11)",
      "HBK (C9C / U9C), Kistler, Burster, ME-Meßsysteme",
      "0.5 % or better",
      "€€",
      "indicator, calibration ISO 376"
     ],
     [
      "Measuring tools",
      "Pressure transducer 0.1 % (E10)",
      "WIKA CPG1500 precision digital gauge, Keller, Hydac HDA transducers",
      "0–16 MPa",
      "€–€€",
      "logging the 10 min drop"
     ]
    ]
   },
   {
    "id": "r32_6",
    "t": "Thread lockers, adhesives, sealants",
    "src": "guide 17 §32.6",
    "rows": [
     [
      "Thread lockers, adhesives, sealants",
      "Medium thread locker (covers, brackets)",
      "Loctite 243 (Weicon AN 302-43, 3M TL42 equivalents – check)",
      "medium, oil tolerant, full cure ≈ 24 h",
      "€",
      "TDS: breakaway torque, μ change"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "High strength (rim set screws)",
      "Loctite 270 / 2701",
      "high, heat to remove",
      "€",
      "drawing note"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "Retaining compound (repair only)",
      "Loctite 638 / 648 / 603",
      "see TDS (gap, shear strength, temperature)",
      "€",
      "design guide factors (22.4)"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "Flange sealant",
      "Loctite 5910 (flexible), 518 / 574 (rigid flanges)",
      "see TDS",
      "€",
      "oil compatibility"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "Cleaner / activator",
      "Loctite 7063 (cleaner), 7649 (activator)",
      "–",
      "€",
      "passive surfaces"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "Marking paste (contact pattern)",
      "Prussian blue (e.g. Stewart's, Dykem, Diamant Tuschierpaste)",
      "thin, fine",
      "€",
      "thin layer ≤ 5 µm"
     ],
     [
      "Thread lockers, adhesives, sealants",
      "Torque marking",
      "Dykem Cross-Check, Loctite indicator lacquer (check number)",
      "paint",
      "€",
      "colour per stage"
     ]
    ]
   },
   {
    "id": "r32_7",
    "t": "Seals",
    "src": "guide 17 §32.7",
    "rows": [
     [
      "Seals",
      "O-rings NBR 70 / FKM, ISO 3601 sizes (clamp, union, modules)",
      "Freudenberg (Simrit), Trelleborg, Parker (O-ring handbook), SKF",
      "ISO 3601-1 / AS568 sizes",
      "€",
      "material vs oil / coolant, kits per table"
     ],
     [
      "Seals",
      "Rotary shaft seal worm shaft, type AS (dust lip)",
      "Freudenberg Simmerring (types BA / BASL), SKF HMSA10 / CRW1, Trelleborg TRA",
      "DIN 3760 / ISO 6194",
      "€",
      "shaft surface (23.2), material"
     ],
     [
      "Seals",
      "Rotary union seals (PTFE)",
      "Trelleborg Turcon Roto Glyd Ring, Freudenberg",
      "see datasheet",
      "€",
      "usually supplied with the union"
     ],
     [
      "Seals",
      "Clamp / piston seals",
      "Trelleborg Turcon Stepseal / Glyd Ring, Hallite, Parker",
      "see datasheet",
      "€",
      "per clamp supplier drawing"
     ],
     [
      "Seals",
      "Labyrinth / V-ring at the table top",
      "Freudenberg V-ring, SKF V-ring (VA / VS)",
      "see datasheet",
      "€",
      "axial space, coolant"
     ]
    ]
   },
   {
    "id": "r32_8",
    "t": "Cleaning and cleanliness inspection",
    "src": "guide 17 §32.8",
    "rows": [
     [
      "Cleaning and cleanliness inspection",
      "Aqueous spray-rinse-dry washer for housing / table (E2)",
      "Dürr Ecoclean (EcoCwave / EcoCbase), MAFAC, BvL Oberflächentechnik, local makers",
      "basket ≥ Ø800, ≥ 400 kg (check)",
      "€€€",
      "blind-hole cleaning, vacuum drying, filter fineness"
     ],
     [
      "Cleaning and cleanliness inspection",
      "Ultrasonic tank small parts (E2)",
      "Elma (Elmasonic), Bandelin (Sonorex), Branson",
      "25–40 kHz, heated",
      "€–€€",
      "size, rinse tank, basket"
     ],
     [
      "Cleaning and cleanliness inspection",
      "Extraction cabinet ISO 16232",
      "Jomesa HFD, Pall cleanliness extraction systems, CleanControlling",
      "pressure rinsing, filtered test liquid",
      "€€–€€€",
      "or use a cleanliness lab service first"
     ],
     [
      "Cleaning and cleanliness inspection",
      "Particle analysis",
      "Jomesa analysis microscope, Evident (Olympus) CIX series, Zeiss, Pall",
      "automatic counting per ISO 16232 classes",
      "€€–€€€",
      "or lab service"
     ],
     [
      "Cleaning and cleanliness inspection",
      "Analytical balance 0.1 mg",
      "Sartorius, Mettler Toledo",
      "0.1 mg",
      "€€",
      "draft shield, calibration"
     ],
     [
      "Cleaning and cleanliness inspection",
      "Membrane filters",
      "Pall, Merck Millipore, Sartorius",
      "5 µm (as the spec)",
      "€",
      "blank value"
     ]
    ]
   },
   {
    "id": "r32_9",
    "t": "Assembly workstations and lifting aids",
    "src": "guide 17 §32.9",
    "rows": [
     [
      "Assembly workstations and lifting aids",
      "Benches, tool boards, carts from profile systems",
      "item Industrietechnik (profile system, work benches), Bosch Rexroth manual production systems (ergonomic workstations), Bott, Treston",
      "modular, ESD options",
      "€–€€",
      "load per bench (cartridge, heater), height adjustment"
     ],
     [
      "Assembly workstations and lifting aids",
      "Jib crane ≥ 500 kg, radius ≈ 4 m (or bridge crane 1 t, E4)",
      "Demag (jib cranes, KBK light crane system), ABUS (LS / VS jib cranes, HB light crane system), Gorbel",
      "see datasheet",
      "€€",
      "foundation / building load, slew stops"
     ],
     [
      "Assembly workstations and lifting aids",
      "Chain hoist 2 speeds, slow ≤ 0.5 m/min",
      "Demag DC-Pro, ABUS ABUCompact GM, Liftket (frequency-controlled options)",
      "2-speed or variable speed",
      "€€",
      "slow speed value, inching, hook height"
     ],
     [
      "Assembly workstations and lifting aids",
      "Intelligent / servo hoist (precise lowering)",
      "Gorbel G-Force, Demag D-Bal (balancer)",
      "hands-on control",
      "€€–€€€",
      "for bearing and table lowering (very fine speed)"
     ],
     [
      "Assembly workstations and lifting aids",
      "Vacuum tube lifter for smooth parts (covers, plates)",
      "Schmalz JumboFlex / JumboErgo",
      "up to ≈ 50 / 300 kg (model)",
      "€€",
      "not for bearings (rings must not be held by vacuum on raceways)"
     ],
     [
      "Assembly workstations and lifting aids",
      "Spring / pneumatic balancer for tools (torque multiplier, grinder)",
      "Tecna, Kromer, Atlas Copco",
      "see datasheet",
      "€",
      "tool weight"
     ],
     [
      "Assembly workstations and lifting aids",
      "Rotatable assembly stand J1",
      "make (11.2) or buy a positioner / turnover stand from fixture makers",
      "500 kg, lock every 90°",
      "€€",
      "risk assessment, self-locking drive"
     ],
     [
      "Assembly workstations and lifting aids",
      "Round slings, shackles, eye bolts (DIN 580)",
      "RUD, Pewag, Crosby, Yoke",
      "WLL marked, EN 1492-2 / EN 13889",
      "€",
      "certificates, inspection register"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "#",
     "Item",
     "Qty",
     "Example (32.x)",
     "Price class"
    ],
    "rows": [
     [
      "1",
      "Jib crane 500 kg + 2-speed chain hoist (or share the room crane E4)",
      "1",
      "32.9",
      "€€"
     ],
     [
      "2",
      "Rotatable assembly stand J1 (make) + adapter plate",
      "1",
      "11.2 / 32.9",
      "€€"
     ],
     [
      "3",
      "Assembly plate / granite plate 1 000 × 1 000",
      "1",
      "32.5",
      "€€"
     ],
     [
      "4",
      "Lifting beam J2, bearing ring J4, guide studs J3 (make, proof tested)",
      "1 set",
      "11.2",
      "€"
     ],
     [
      "5",
      "Sub-assembly bench + tool board + 2 carts (profile system)",
      "1 set",
      "32.9",
      "€€"
     ],
     [
      "6",
      "Induction heater (temperature mode, demagnetise) + fitting tool kit",
      "1 + 1",
      "32.3",
      "€€"
     ],
     [
      "7",
      "Click torque wrenches 1–5 (screwdriver), 5–60, 20–100, 60–340 N·m",
      "4",
      "32.4",
      "€ each"
     ],
     [
      "8",
      "Electronic torque/angle wrench with data output 20–200 N·m + software",
      "1",
      "32.4",
      "€€"
     ],
     [
      "9",
      "Torque multiplier (M16)",
      "1",
      "32.4",
      "€"
     ],
     [
      "10",
      "Torque tester bench (in-house check)",
      "1 (per site)",
      "32.4",
      "€€"
     ],
     [
      "11",
      "Dial indicators 0.001 + test indicators + magnetic / articulating stands",
      "4 + 4",
      "32.5",
      "€"
     ],
     [
      "12",
      "Electronic probe 0.1 µm + amplifier",
      "1",
      "32.5",
      "€€"
     ],
     [
      "13",
      "Precision level 0.02 mm/m",
      "1",
      "32.5",
      "€"
     ],
     [
      "14",
      "Height gauge 0.001 + gauge block set grade 1",
      "1 + 1",
      "32.5",
      "€€"
     ],
     [
      "15",
      "Micrometers 0–25 / 25–50 + depth micrometer + feeler set",
      "1 set",
      "32.5",
      "€"
     ],
     [
      "16",
      "Torque gauge 0–1 N·m (J6) + force gauge 0–200 N",
      "1 + 1",
      "32.5",
      "€"
     ],
     [
      "17",
      "Hydraulic hand test pump 16 MPa + transducer 0.1 % + J10 plate",
      "1",
      "32.5 / 11.2",
      "€€"
     ],
     [
      "18",
      "Load cell 5 kN + indicator + lever J9",
      "1",
      "32.5 / 11.2",
      "€€"
     ],
     [
      "19",
      "Autocollimator + 24-face polygon or laser + rotary calibrator (or rent / service)",
      "1 (per site)",
      "32.5",
      "€€€"
     ],
     [
      "20",
      "Encoder diagnostic kit (from the encoder maker)",
      "1",
      "E18",
      "€€"
     ],
     [
      "21",
      "Hydraulic press frame 10 t + hand pump (dowels)",
      "1",
      "32.3",
      "€–€€"
     ],
     [
      "22",
      "Ultrasonic tank (small parts); washer for big parts (room level, E2)",
      "1 / (1 per room)",
      "32.8",
      "€€ / €€€"
     ],
     [
      "23",
      "Cleanliness: analytical balance + membranes (or lab service)",
      "1",
      "32.8",
      "€€"
     ],
     [
      "24",
      "Barcode / DataMatrix scanner + MES tablet + label printer",
      "1",
      "E20",
      "€"
     ],
     [
      "25",
      "Consumables per table: thread lockers, cleaner, marking paste, O-ring kits, assembly oil, grease, gloves, wipes, VCI",
      "per table",
      "11.4 / 32.6 / 32.7",
      "€"
     ],
     [
      "26",
      "Calibration of all gauges and wrenches (yearly service contract)",
      "1",
      "11.1",
      "€€ / year"
     ]
    ],
    "m": 3,
    "p": 4,
    "w": [
     5,
     36,
     8,
     37,
     14
    ]
   }
  ],
  "shopTab": "Shopping list – rotary-table assembly station",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list for one rotary-table assembly station (example) – guide 17 §32.10.",
  "price": "Price classes (guide 17): € low < ≈ 1 000 € · €€ medium ≈ 1 000 – 10 000 € · €€€ high > ≈ 10 000 € – estimate, ask for a quote.",
  "shopNote": "Check local availability, service and calibration in your country before you decide.",
  "ph": "(e.g. INA YRT, SKF TIH, Norbar, Mahr, Loctite)"
 },
 "asm2": {
  "guide": "guide 19",
  "drawings": [
   {
    "f": "19_spindle_assembly_section.svg",
    "c": "Section of the example motor spindle with all assembly parts numbered in assembly order",
    "g": "guide 19 §17",
    "t": "Motor spindle – section in assembly order"
   },
   {
    "f": "19_bearing_sets_marking.svg",
    "c": "DB, DF, DT and TBT arrangements with the V-line across the outer rings",
    "g": "guide 19 §19",
    "t": "Bearing sets DB / DF / DT / TBT + V-line"
   },
   {
    "f": "19_preload_stiffness.svg",
    "c": "Preload–deflection curves, rigid and spring preload, worked example",
    "g": "guide 19 §20",
    "t": "Preload – deflection curves"
   },
   {
    "f": "19_spacer_measurement.svg",
    "c": "Stand-out measurement of a bearing and the spacer comparison with the calculation",
    "g": "guide 19 §21",
    "t": "Stand-out + spacer measurement"
   },
   {
    "f": "19_shrink_fit_rotor.svg",
    "c": "Heating set-up and temperature calculation for the rotor sleeve shrink fit",
    "g": "guide 19 §23",
    "t": "Rotor sleeve shrink fit – heating"
   },
   {
    "f": "19_disc_spring_pack.svg",
    "c": "Disc-spring pack stacking and force–deflection curve with the clamped and unclamped points",
    "g": "guide 19 §24",
    "t": "Disc-spring pack + force curve"
   },
   {
    "f": "19_runout_balancing_setup.svg",
    "c": "Runout test with test mandrel and two-plane balancing set-up",
    "g": "guide 19 §25",
    "t": "Runout test + two-plane balancing"
   },
   {
    "f": "19_assembly_cell_layout.svg",
    "c": "Spindle assembly cell with clean zone, benches, heater, press, balancing machine and test stand",
    "g": "guide 19 §31",
    "t": "Spindle assembly cell layout"
   }
  ],
  "groups": [
   {
    "id": "s32_1",
    "t": "Spindle bearings and precision lock nuts",
    "src": "guide 19 §32.1",
    "rows": [
     [
      "Precision lock nut front",
      "M70 × 1.5, face runout ≤ 2 µm after correction, radial set screws",
      "SKF KMT / KMTA precision lock nuts; Schaeffler (INA) ZM / ZMA; Spieth MSR / MSW",
      "axial load capacity, tightening torque, set-screw torque, face runout",
      "€ each",
      "runout correction method in the leaflet, hook spanner / pin wrench type"
     ],
     [
      "Precision lock nut rear",
      "M60 × 1.5",
      "same series",
      "same",
      "€",
      "same"
     ],
     [
      "Hook / face spanners + torque adapter",
      "for the nut series",
      "maker accessory (e.g. SKF HN / pin spanners)",
      "–",
      "€",
      "effective length for the torque correction"
     ]
    ]
   },
   {
    "id": "s32_2",
    "t": "Heating equipment",
    "src": "guide 19 §32.2",
    "rows": [
     [
      "Bearing induction heater (E9)",
      "bores 50–120 mm, 110 °C max set, temperature probe, auto-demagnetising, small yoke for 7012 / 7014",
      "SKF TIH 030m / TIH 100m; Schaeffler HEATER10 / HEATER20",
      "max. workpiece mass, min. bore, power, temperature control mode",
      "€ – €€",
      "demagnetising residual (≤ 2 A/cm typical – see datasheet), smallest yoke fits Ø60 bore, set-point ≤ grease limit"
     ],
     [
      "Hot plate / oven for bearings (alternative)",
      "0–150 °C, even temperature",
      "laboratory ovens e.g. Memmert UF series, Binder FD / ED series; electric hot plates of bearing makers",
      "temperature uniformity, max. temperature",
      "€ – €€",
      "clean interior, timer"
     ],
     [
      "Rotor oven (E14)",
      "≤ 250 °C ±5 °C, inner space for Ø148 × 160 rotor, part thermocouple",
      "Memmert UF (up to 300 °C – check), Binder FED, Nabertherm (TR series ovens – check)",
      "max. temperature, uniformity, inner size",
      "€€",
      "forced air, door switch, data logging"
     ],
     [
      "Induction for the rotor sleeve (option)",
      "5–10 kW, coil around Ø148 sleeve, temperature-controlled ramp to the motor maker's limit",
      "EFD Induction (Minac mobile heaters), simatherm (Simatec – IH series, check), Ambrell (EKOHEAT – check)",
      "power, frequency, coil design, controller with probe",
      "€€ – €€€",
      "ask the motor maker first (magnets!); coil made for your part"
     ],
     [
      "Housing heater (E15)",
      "≤ 120 °C, Ø300 × 500",
      "oven as above or heating band / blanket with controller",
      "–",
      "€ – €€",
      "even heating, no hot spots on the bore"
     ],
     [
      "Contact thermometer + crayons",
      "type K, ±1 K; crayons 70 / 110 / 230 °C",
      "Fluke 54 II type; Tempilstik crayons",
      "accuracy, probe",
      "€",
      "calibration"
     ]
    ]
   },
   {
    "id": "s32_3",
    "t": "Clean zone and ESD",
    "src": "guide 19 §32.3",
    "rows": [
     [
      "Laminar-flow bench (E4)",
      "1.2–1.5 m wide, vertical flow 0.45 m/s, H14, class 5 at the work surface, low noise",
      "Spetec (laminar flow benches – check series), Kojair (laminar flow cabinets – check), Weiss Technik (clean benches – check)",
      "filter class, air speed, noise dB(A), work height",
      "€€",
      "ergonomic height for bearings work, stainless top, no UV needed"
     ],
     [
      "Modular clean room / tent (E1 option)",
      "class 7, 20 ±1 °C with the hall AHU",
      "Spetec clean-room tents (check), Schilling Engineering (check), Max Petek Reinraumtechnik (check)",
      "FFU number, class proof, temperature control",
      "€€€",
      "temperature stability is the hard part – ask for a 48 h test"
     ],
     [
      "Particle counter",
      "0.3 / 0.5 / 5 µm, 2.83 l/min (0.1 cfm)",
      "Lighthouse HANDHELD 3016, TSI AeroTrak 9306, Beckman Coulter MET ONE HHPC",
      "channels, flow, calibration ISO 21501-4",
      "€€",
      "calibration certificate"
     ],
     [
      "ESD workplace set",
      "mat + wrist strap 1 MΩ + common point + tester",
      "Desco, Wolfgang Warmbier, 3M (SCS)",
      "resistance values IEC 61340-5-1",
      "€",
      "daily tester for strap + shoes"
     ],
     [
      "Gloves + clothing",
      "powder-free nitrile clean-room gloves, low-lint coats",
      "Ansell BioClean, Kimtech Pure (Kimberly-Clark)",
      "particle release, size",
      "€ per box",
      "no latex, no powder"
     ],
     [
      "Temperature + humidity logger",
      "±0.2 K, 1 min interval",
      "Testo 176 / 184 type, any calibrated logger",
      "accuracy",
      "€",
      "calibration"
     ]
    ]
   },
   {
    "id": "s32_4",
    "t": "Measuring: preload, friction torque, dimensions",
    "src": "guide 19 §32.4",
    "rows": [
     [
      "Bearing stand-out stand (E5)",
      "granite, dead weights per catalogue, probe 0.1 µm",
      "no standard catalogue item – build with Mahr / Mitutoyo / Tesa probes (J-design) or ask the bearing maker",
      "–",
      "€€",
      "master for zero, temperature"
     ],
     [
      "Inductive probes + amplifier (0.1 µm)",
      "±200 µm range, 0.01–0.1 µm resolution",
      "Mahr Millimar C1200 / C1800 amplifier + P2000-type probes; Tesa TESATRONIC TT; Mitutoyo LVDT probes",
      "resolution, linearity, interface",
      "€ – €€",
      "probe force, USB output"
     ],
     [
      "Test indicators 0.001 mm",
      "lever type",
      "Mitutoyo 513 series, Mahr MarTest 800 series, Tesa TESATAST",
      "resolution, measuring force",
      "€",
      "–"
     ],
     [
      "Bore gauges + setting rings",
      "Ø60 / Ø95 / Ø110 / Ø65, 0.001 mm",
      "Mahr Marameter / Micromar, Mitutoyo, Tesa; setting rings grade 0",
      "repeatability",
      "€ – €€",
      "certificate"
     ],
     [
      "Dial comparator for spacers",
      "0.2 µm, rigid stand",
      "Mahr Extramess / Millimess + stand; gauge block 15 mm grade 0 / K",
      "resolution, stand stiffness",
      "€ – €€",
      "–"
     ],
     [
      "Small torque sensor (friction torque)",
      "0–2 N·m, ≤ 0.5 %",
      "HBK T22 (small ranges – check), Kistler 4502A / 4503B (check range)",
      "range, accuracy, speed",
      "€€",
      "adapter to the nut / shaft"
     ],
     [
      "Force gauge for cord method",
      "0–50 N, 0.01 N",
      "Mark-10, Sauter, Imada (series see catalogue)",
      "resolution",
      "€",
      "–"
     ]
    ]
   },
   {
    "id": "s32_5",
    "t": "Disc springs, drawbar, clamping",
    "src": "guide 19 §32.5",
    "rows": [
     [
      "Disc springs A 40 × 20.4 × 2.25",
      "DIN EN 16983 group 2, 51CrV4, shot-peened, 36 + spares per spindle",
      "Schnorr, Mubea, Christian Bauer (catalogue tables)",
      "F at 0.75 h0, l0, h0, tolerance class",
      "€ per pack",
      "fatigue data (24.4), surface protection (phosphated + oiled)"
     ],
     [
      "HSK-A63 clamping set (collet + drawbar head)",
      "18 kN clamping force, ratio ≈ 3, stroke data",
      "OTT-JAKOB HSK clamping sets; Röhm HSK clamping sets",
      "clamping force vs drawbar force, stroke, ejection, max. speed",
      "€ – €€",
      "drawing interface to your shaft (bore Ø36 cavity)"
     ],
     [
      "Complete clamping unit (option)",
      "ready drawbar + spring pack + clamping set",
      "OTT-JAKOB spindle clamping units; Röhm",
      "as above + pack length",
      "€€",
      "buy complete = maker guarantees fatigue life"
     ],
     [
      "Release (unclamp) unit",
      "hydraulic, piston ≥ Ø63 annular at 6 MPa, stroke 6 mm, position sensor",
      "OTT-JAKOB release units (check), own design with seals from Trelleborg / Freudenberg",
      "force, stroke, sensor",
      "€€",
      "rotating vs stationary type"
     ],
     [
      "Clamping-force gauge (E18)",
      "HSK-A63, 0–40 kN, ≤ 2 %",
      "OTT-JAKOB POWER-CHECK 2; Röhm F-senso spindle (check); Kemmler clamping-force gauges (check); Diebold (check)",
      "range, accuracy, display / data",
      "€€",
      "adapter HSK-A63, calibration"
     ],
     [
      "Spring tester / press with force gauge (J6)",
      "0–20 kN, length measure 0.01 mm",
      "own J6 + HBK / Kistler load cell, or a spring tester",
      "–",
      "€ – €€",
      "–"
     ]
    ]
   },
   {
    "id": "s32_6",
    "t": "Balancing",
    "src": "guide 19 §32.6",
    "rows": [
     [
      "Horizontal balancing machine (E16)",
      "rotors 5–50 kg, U_mar ≤ 1 g·mm, 2 planes, belt drive, own-bearing support",
      "Schenck horizontal universal machines; CEMB horizontal machines; Hofmann",
      "U_mar, unbalance reduction ratio (ISO 21940-21), speed range",
      "€€€ – €€€€",
      "proof rotor test, supports for J7"
     ],
     [
      "Field balancer (trim, test station)",
      "2 planes, phase reference",
      "Schenck SmartBalancer 4; CEMB N300 (check); SKF Microlog AX (guide 20 §37.7)",
      "channels, accuracy, export",
      "€€",
      "–"
     ],
     [
      "Balancing screws + scale",
      "M5 / M6 set screws, scale 0.01 g",
      "standard parts + laboratory scale",
      "–",
      "€",
      "stainless, thread locker"
     ]
    ]
   },
   {
    "id": "s32_7",
    "t": "Test mandrels and runout",
    "src": "guide 19 §32.7",
    "rows": [
     [
      "Test mandrel HSK-A63 × 300 mm (E21)",
      "runout on certificate ≤ 1–2 µm, balanced",
      "Kemmler (test mandrels / Prüfdorne); Haimer (check); Kelch (check)",
      "runout at 300 mm, balance grade",
      "€ – €€",
      "certificate, re-check interval (guide 20 §37.8)"
     ],
     [
      "Capacitive probes (E22)",
      "≤ 0.1 µm, ≥ 2 kHz",
      "Micro-Epsilon capaNCDT, Lion Precision (guide 20 §37.5)",
      "–",
      "€€ – €€€",
      "–"
     ]
    ]
   },
   {
    "id": "s32_8",
    "t": "Grease and dosing",
    "src": "guide 19 §32.8",
    "rows": [
     [
      "Spindle bearing grease",
      "synthetic, n·dm ≥ 1.1·10⁶, approved by the bearing maker",
      "Klüber Isoflex NBU 15; others see guide 20 §37.2",
      "base-oil viscosity, speed factor, density, shelf life",
      "€",
      "the bearing maker's approval for hybrid 7014"
     ],
     [
      "Dosing syringes",
      "3–10 ml barrels, blunt wide tips, clean",
      "Nordson EFD Optimum syringe barrels (check), laboratory syringes",
      "volume, cleanliness",
      "€",
      "one per grease type, labelled"
     ],
     [
      "Laboratory scale (E8)",
      "0.01 g, ≥ 200 g, draught shield",
      "Kern, Sartorius, Mettler Toledo (series see catalogue)",
      "readability, repeatability, calibration weight",
      "€",
      "interface USB / RS-232 for the record"
     ]
    ]
   },
   {
    "id": "s32_9",
    "t": "Electrical test",
    "src": "guide 19 §32.9",
    "rows": [
     [
      "Insulation tester (E24)",
      "250 / 500 / 1 000 V DC, PI function",
      "Megger MIT400/2 series (MIT420/2, MIT430/2); Fluke 1587 FC (insulation multimeter)",
      "test voltages, range up to GΩ, PI/DAR",
      "€",
      "calibration"
     ],
     [
      "Micro-ohmmeter (winding resistance)",
      "4-wire, 0.1 mΩ resolution",
      "Megger DLRO10HD; Hioki RM3545",
      "resolution, test current, temperature compensation",
      "€ – €€",
      "–"
     ],
     [
      "Surge / winding analyser (option)",
      "turn-to-turn insulation",
      "Megger Baker (check), Schleich (check)",
      "test voltage",
      "€€ – €€€",
      "needs training"
     ],
     [
      "Encoder tester",
      "1 Vpp sin/cos, Lissajous",
      "Heidenhain PWM 21 (check), oscilloscope",
      "signal types",
      "€€",
      "adapter cables"
     ],
     [
      "PT100 simulator / calibrator",
      "0–200 °C, 4-wire",
      "Fluke 712B type, Beamex (check)",
      "accuracy",
      "€",
      "–"
     ]
    ]
   },
   {
    "id": "s32_10",
    "t": "Leak / pressure test",
    "src": "guide 19 §32.10",
    "rows": [
     [
      "Hand test pump (water)",
      "0–16 bar, with valve + gauge",
      "Rothenberger RP 50-S, REMS Push (check)",
      "max. pressure, tank",
      "€",
      "connection to the jacket"
     ],
     [
      "Digital test gauge",
      "0–16 bar, 0.05 % with logging",
      "WIKA CPG1500, Keller LEO series",
      "accuracy, logging",
      "€",
      "calibration certificate"
     ],
     [
      "Pressure-decay leak tester (option, air)",
      "low pressure, automatic decay test",
      "ATEQ (F-series – check), Uson, InterTech",
      "resolution in Pa, test volume",
      "€€",
      "guard for air tests"
     ]
    ]
   },
   {
    "id": "s32_11",
    "t": "Lifting and mechanics",
    "src": "guide 19 §32.11",
    "rows": [
     [
      "Crane / jib crane (E13)",
      "500 kg, 2-speed or VFD ≤ 0.5 m/min fine speed",
      "Demag, ABUS, Stahl (series see catalogue)",
      "–",
      "€€",
      "inspection per local law"
     ],
     [
      "Hydraulic hand press (E12)",
      "0–50 kN, digital force",
      "Enerpac / Holmatro hand pump + cylinder; small workshop press",
      "–",
      "€ – €€",
      "force display"
     ],
     [
      "Torque tools (E10)",
      "ISO 6789, 2–25 / 20–100 / 60–340 N·m",
      "Gedore, Stahlwille, Norbar, Hazet (guide 17 §32.4)",
      "–",
      "€",
      "certificates"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "Pos",
     "Item",
     "Qty",
     "Key spec",
     "Price class"
    ],
    "rows": [
     [
      "1",
      "Clean room (modular, class 7) incl. AHU, HEPA, 20 ±1 °C",
      "1",
      "8 × 6 m, 2 880 m³/h, +10–15 Pa",
      "€€€ – €€€€"
     ],
     [
      "2",
      "Laminar-flow bench",
      "1",
      "1.2–1.5 m, class 5",
      "€€"
     ],
     [
      "3",
      "Particle counter + T/RH logger",
      "1 + 2",
      "0.5 / 5 µm",
      "€€"
     ],
     [
      "4",
      "ESD set (mats, straps, tester, floor in zone C/F)",
      "1",
      "IEC 61340-5-1",
      "€ – €€"
     ],
     [
      "5",
      "Solvent washer + ultrasonic tank",
      "1 + 1",
      "closed, filter 10 µm",
      "€€"
     ],
     [
      "6",
      "Bearing measuring stand (own design) + inductive probes",
      "1",
      "0.1 µm",
      "€€"
     ],
     [
      "7",
      "Measuring set (bore gauges, micrometers 50–225, setting rings, gauge blocks, comparator)",
      "1",
      "0.001 mm",
      "€€"
     ],
     [
      "8",
      "Lapping plate + pastes / precision surface grinder access",
      "1",
      "±1 µm",
      "€ (plate) / €€€ (grinder)"
     ],
     [
      "9",
      "Laboratory scale 0.01 g + syringes",
      "1",
      "–",
      "€"
     ],
     [
      "10",
      "Bearing induction heater",
      "1",
      "bores 50–120, 110 °C",
      "€ – €€"
     ],
     [
      "11",
      "Rotor oven ≤ 250 °C",
      "1",
      "inner space ≥ Ø200 × 250",
      "€€"
     ],
     [
      "12",
      "Housing heater / oven",
      "1",
      "≤ 120 °C",
      "€ – €€"
     ],
     [
      "13",
      "Torque tools set + hook spanners",
      "1",
      "ISO 6789",
      "€ – €€"
     ],
     [
      "14",
      "Test indicators + electronic probe",
      "3 + 1",
      "0.001 / 0.1 µm",
      "€ – €€"
     ],
     [
      "15",
      "Small torque sensor or cord + force gauge",
      "1",
      "0–2 N·m",
      "€ – €€"
     ],
     [
      "16",
      "Hydraulic hand press + force gauge",
      "1",
      "0–50 kN",
      "€ – €€"
     ],
     [
      "17",
      "Jib crane 500 kg",
      "1",
      "fine speed",
      "€€"
     ],
     [
      "18",
      "Balancing machine horizontal",
      "1",
      "5–50 kg, U_mar ≤ 1 g·mm",
      "€€€ – €€€€"
     ],
     [
      "19",
      "Pressure test pump + digital gauge",
      "1",
      "0–16 bar",
      "€"
     ],
     [
      "20",
      "Hydraulic test unit (unclamp)",
      "1",
      "0–10 MPa",
      "€€"
     ],
     [
      "21",
      "Clamping-force gauge HSK-A63",
      "1",
      "0–40 kN",
      "€€"
     ],
     [
      "22",
      "Electrical test set (insulation tester, micro-ohmmeter, encoder tester, PT100 simulator)",
      "1",
      "–",
      "€€"
     ],
     [
      "23",
      "Test mandrel HSK-A63 × 300",
      "1 (+1)",
      "certificate",
      "€ – €€"
     ],
     [
      "24",
      "Scanner + MES tablet + label printer",
      "1",
      "DataMatrix on metal",
      "€"
     ],
     [
      "25",
      "Jigs J1–J12 (make)",
      "1 set",
      "chapter 11.2",
      "€€ (material + work)"
     ],
     [
      "26",
      "Consumables first year (grease, gloves, coats, solvent, O-rings, thread locker, VCI)",
      "lot",
      "11.4",
      "€ – €€"
     ]
    ],
    "m": 1,
    "p": 4,
    "w": [
     6,
     38,
     10,
     34,
     12
    ]
   }
  ],
  "shopTab": "Shopping list – spindle assembly cell",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list for one spindle assembly cell (1 spindle per 2 days, 2 fitters) – guide 19 §33. Test station equipment: guide 20 §38; jigs J1 – J12 are made in-house (§11.2).",
  "price": "Price classes (guide 19, 2026, excl. VAT): € < 1 k€ · €€ 1 – 10 k€ · €€€ 10 – 50 k€ · €€€€ > 50 k€ – estimate, ask for a quote.",
  "shopNote": "Quantities and price classes are estimates – ask for quotes.",
  "ph": "(e.g. SKF KMT, TIH, Schenck, Klüber, Megger)"
 },
 "hmc4": {
  "guide": "guide 18",
  "drawings": [
   {
    "f": "18_heat_treatment_cycle.svg",
    "c": "Heat-treatment cycle: QT of the bar, stress relief 580 °C, gas nitriding 520 °C with Kn stages, and the hardness–depth profile with NHD",
    "g": "guide 18 §18.3",
    "t": "Heat-treatment cycle (QT, stress relief, nitriding)"
   },
   {
    "f": "18_cutting_data_chart.svg",
    "c": "Cutting data chart: v_c and feed per operation, cutting power from Kienzle and the theoretical Ra as a function of feed and nose radius",
    "g": "guide 18 §19.3",
    "t": "Cutting data chart (v_c, feed, power, Ra)"
   },
   {
    "f": "18_grinding_setup.svg",
    "c": "Grinding set-up: OD plunge grinding of the bearing seats between centre plugs with in-process gauge …",
    "g": "guide 18 §20.1",
    "t": "Grinding set-up (OD plunge, in-process gauge)"
   },
   {
    "f": "18_spindle_shaft_drawing.svg",
    "c": "Spindle shaft drawing: half section with HSK-A63 taper, gun-drilled bore, spring chamber, bearing seats js4, rotor seat p5, threads M70×1.5 / M60×1.5, datum A-B …",
    "g": "guide 18 §21.3",
    "t": "Spindle shaft drawing with GD&T"
   },
   {
    "f": "18_housing_drawing.svg",
    "c": "Housing drawing: cartridge with front bore Ø110 JS4, rear sleeve bore Ø120 H5, coaxiality to the common axis, faces square, cooling sleeve with grooves and O-rings",
    "g": "guide 18 §22.1",
    "t": "Housing drawing with GD&T"
   },
   {
    "f": "18_measurement_plan.svg",
    "c": "Measurement plan: shaft features mapped to the instruments – in-process gauge, roundness tester, taper gauge, test mandrel, CMM, roughness tester, balancing machine …",
    "g": "guide 18 §24.1",
    "t": "Measurement plan (features → instruments)"
   },
   {
    "f": "18_process_routing.svg",
    "c": "Process routing: 14 operations from saw to final inspection with machines, times and the quality gates",
    "g": "guide 18 §25.1",
    "t": "Process routing (14 operations)"
   },
   {
    "f": "18_defects_cures.svg",
    "c": "Defects and cures: grinding burn, cracks, chatter lobes, distortion, taper contact, thread squareness – what you see, cause, detection and cure",
    "g": "guide 18 §27.1",
    "t": "Defects and cures"
   }
  ],
  "groups": [
   {
    "id": "m28_1",
    "t": "CNC lathes, turn-mill centres, hard-turning lathes",
    "src": "guide 18 §28.1",
    "rows": [
     [
      "CNC lathes, turn-mill centres, hard-turning lathes",
      "E2, E6, E9 – swing ≥ Ø400, centres ≥ 750 mm, ≥ 22 kW, steady rest, C/Y axis; hard turning: spindle runout ≤ 1 µm",
      "DMG MORI CTX beta / CTX gamma TC (turn-mill with B-axis milling spindle), CLX (universal lathes)",
      "swing, turning length, spindle power + torque curve, C/Y travel, tailstock force",
      "€€€€ (estimate – ask for a quote)",
      "steady-rest range Ø30–150, programmable tailstock, thermal compensation"
     ],
     [
      "CNC lathes, turn-mill centres, hard-turning lathes",
      "E2, E6, E9 – swing ≥ Ø400, centres ≥ 750 mm, ≥ 22 kW, steady rest, C/Y axis; hard turning: spindle runout ≤ 1 µm",
      "EMAG VL series (vertical pick-up lathes), VSC (vertical turning + grinding)",
      "max. chuck Ø, part length, automation",
      "€€€€ (estimate)",
      "vertical machines suit discs / short parts – for the 480 mm shaft check the part length"
     ],
     [
      "CNC lathes, turn-mill centres, hard-turning lathes",
      "E2, E6, E9 – swing ≥ Ø400, centres ≥ 750 mm, ≥ 22 kW, steady rest, C/Y axis; hard turning: spindle runout ≤ 1 µm",
      "INDEX G series turn-mill (e.g. G200 / G220 class), C series",
      "bar / chuck capacity, Y/B axes, turret positions",
      "€€€€ (estimate)",
      "counter-spindle for complete machining, steady rest"
     ],
     [
      "CNC lathes, turn-mill centres, hard-turning lathes",
      "E2, E6, E9 – swing ≥ Ø400, centres ≥ 750 mm, ≥ 22 kW, steady rest, C/Y axis; hard turning: spindle runout ≤ 1 µm",
      "Hembrug Mikroturn (hydrostatic hard-turning lathes)",
      "spindle runout, form accuracy, R_a capability – see datasheet",
      "€€€€ (estimate)",
      "proof part in your hardened material (IT5, R_a 0.2), for threads + faces of Op 120"
     ],
     [
      "CNC lathes, turn-mill centres, hard-turning lathes",
      "E2, E6, E9 – swing ≥ Ø400, centres ≥ 750 mm, ≥ 22 kW, steady rest, C/Y axis; hard turning: spindle runout ≤ 1 µm",
      "Others (same class) Okuma, Mazak (INTEGREX), Weiler (precision lathes), Monforts",
      "see datasheet",
      "€€€ – €€€€",
      "service in your country, control type (guide 08)"
     ]
    ]
   },
   {
    "id": "m28_2",
    "t": "Cylindrical and internal grinders",
    "src": "guide 18 §28.2",
    "rows": [
     [
      "Cylindrical and internal grinders",
      "E7, E8 – centres ≥ 650 mm, roundness ≤ 0.5 µm, 0.1 µm resolution, B-axis, in-process gauge, chiller; internal: swivel table, HF spindle 30–60 krpm",
      "Studer (United Grinding) S33 (universal, centre distances 400 / 650 / 1000 mm – check), S41 (larger universal), S131 / S141 (universal internal grinders)",
      "centre height, distance between centres, wheel Ø / speed, B-axis resolution, internal spindle speeds",
      "€€€€ (estimate – ask for a quote)",
      "test piece roundness ≤ 0.5 µm, taper grinding with the swivel table, gauge interface"
     ],
     [
      "Cylindrical and internal grinders",
      "E7, E8 – centres ≥ 650 mm, roundness ≤ 0.5 µm, 0.1 µm resolution, B-axis, in-process gauge, chiller; internal: swivel table, HF spindle 30–60 krpm",
      "Kellenberger KEL-VITA, KEL-VARIA (universal / production) ; Voumard (internal) – check current names",
      "same",
      "€€€€ (estimate)",
      "combination of OD + ID in one set-up"
     ],
     [
      "Cylindrical and internal grinders",
      "E7, E8 – centres ≥ 650 mm, roundness ≤ 0.5 µm, 0.1 µm resolution, B-axis, in-process gauge, chiller; internal: swivel table, HF spindle 30–60 krpm",
      "Junker JUMAT / JUCENTER (CBN high-speed cylindrical)",
      "wheel speed up to high m/s, CBN, automation",
      "€€€€ (estimate)",
      "built for series – check whether flexible enough for small lots"
     ],
     [
      "Cylindrical and internal grinders",
      "E7, E8 – centres ≥ 650 mm, roundness ≤ 0.5 µm, 0.1 µm resolution, B-axis, in-process gauge, chiller; internal: swivel table, HF spindle 30–60 krpm",
      "Danobat cylindrical and internal grinders – see catalogue",
      "see datasheet",
      "€€€€ (estimate)",
      "hydrostatic guides, internal spindle options"
     ],
     [
      "Cylindrical and internal grinders",
      "E7, E8 – centres ≥ 650 mm, roundness ≤ 0.5 µm, 0.1 µm resolution, B-axis, in-process gauge, chiller; internal: swivel table, HF spindle 30–60 krpm",
      "Others Okamoto, Shigiya, Tschudin (centreless)",
      "see datasheet",
      "€€€ – €€€€",
      "service, spare wheels, chiller"
     ]
    ]
   },
   {
    "id": "m28_3",
    "t": "Jig grinding / taper grinding",
    "src": "guide 18 §28.3",
    "rows": [
     [
      "Universal internal grinder with swivel table",
      "HSK / SK taper in the shaft, held on the ground seats",
      "Studer S131 / S141, Voumard (check)",
      "–",
      "€€€€ (estimate)",
      "swivel accuracy, HF spindle, workhead runout ≤ 0.5 µm"
     ],
     [
      "Jig grinder",
      "housing bores, positions of holes",
      "Moore Tool (Moore jig grinders), Hauser (check current owner)",
      "–",
      "€€€€ (estimate)",
      "contour grinding of tapers (U-axis)"
     ],
     [
      "Spindle repair shops (service)",
      "taper re-grinding service – qualify with a test shaft",
      "regional spindle service companies, spindle makers' service",
      "–",
      "per part",
      "taper gauge certificate, blue contact report"
     ]
    ]
   },
   {
    "id": "m28_4",
    "t": "Heat treatment – furnaces and contract heat treaters",
    "src": "guide 18 §28.4",
    "rows": [
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "Nitrex gas nitriding furnaces with K_N control (Nitreg® process – check)",
      "usable Ø × height (height ≥ 700 mm for hanging shafts), K_N control, H₂ sensor",
      "€€€€ (estimate)",
      "coupon trial on 3 charges, software records"
     ],
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "Ipsen vacuum and atmosphere furnaces (nitriding, hardening) – see catalogue",
      "same",
      "€€€€ (estimate)",
      "uniformity survey ±5 K"
     ],
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "ALD Vacuum Technologies low-pressure carburising + gas quench (ModulTherm / SyncroTherm – check)",
      "for case hardening option",
      "€€€€ (estimate)",
      "distortion data, cycle time"
     ],
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "Aichelin atmosphere / nitriding furnaces – see catalogue",
      "same",
      "€€€€ (estimate)",
      "–"
     ],
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "Rübig, PlaTeG (plasma) plasma nitriding systems",
      "for plasma nitriding option",
      "€€€€ (estimate)",
      "masking by covers, hollow-part experience"
     ],
     [
      "Heat treatment – furnaces and contract heat treaters",
      "E4, E5, chapter 18",
      "Contract heat treaters (recommended for small numbers) Bodycote, Aalberts Surface Technologies, regional heat treaters (CQI-9 audited)",
      "process list, certifications",
      "per charge / per kg (ask for a quote)",
      "NHD + HV + white layer + coupon in the contract (18.10), K_N record, lead time"
     ]
    ]
   },
   {
    "id": "m28_5",
    "t": "Balancing machines",
    "src": "guide 18 §28.5",
    "rows": [
     [
      "Balancing machines",
      "E10 – rotors 5–50 kg, Ø ≤ 300, 2 planes, e_mar ≤ 0.1 g·mm/kg, proving rotor",
      "Schenck RoTec horizontal hard-bearing machines (HM series – check model for 5–50 kg), CAB measuring units",
      "rotor mass range, e_mar, URR, drive type (belt / end drive)",
      "€€€ – €€€€ (estimate)",
      "proving-rotor test per ISO 21940-21, roller supports for Ø60 / Ø70 seats"
     ],
     [
      "Balancing machines",
      "E10 – rotors 5–50 kg, Ø ≤ 300, 2 planes, e_mar ≤ 0.1 g·mm/kg, proving rotor",
      "CEMB horizontal balancing machines – see catalogue",
      "same",
      "€€€ (estimate)",
      "same"
     ],
     [
      "Balancing machines",
      "E10 – rotors 5–50 kg, Ø ≤ 300, 2 planes, e_mar ≤ 0.1 g·mm/kg, proving rotor",
      "Hofmann horizontal balancing machines – see catalogue; also in-machine wheel balancers for grinders",
      "same",
      "€€€ (estimate)",
      "same"
     ],
     [
      "Balancing machines",
      "E10 – rotors 5–50 kg, Ø ≤ 300, 2 planes, e_mar ≤ 0.1 g·mm/kg, proving rotor",
      "Grinder wheel auto-balancer Marposs (Dittel), SBS / Schmitt, Hofmann",
      "balancing resolution, speed range",
      "€€ (estimate)",
      "interface to the grinder CNC"
     ]
    ]
   },
   {
    "id": "m28_6",
    "t": "Measuring equipment",
    "src": "guide 18 §28.6",
    "rows": [
     [
      "CMM (MPE ≈ 1.5 + L/350 µm, E12)",
      "–",
      "Zeiss CONTURA / PRISMO / ACCURA; Hexagon (Leitz PMM-C, Leitz Reference, Global); Mitutoyo CRYSTA-Apex / LEGEX",
      "MPE_E per ISO 10360-2, scanning probe, temperature range",
      "€€€€ (estimate)",
      "room 20 ±1 °C, rotary table option for shafts"
     ],
     [
      "Roundness / form tester (≤ 0.02 µm + 0.0003 µm/mm, column ≥ 500 mm, E11)",
      "–",
      "Taylor Hobson Talyrond (e.g. 300 / 500 series – check); Mahr MarForm MMQ series; Mitutoyo Roundtest; Jenoptik form testers",
      "spindle accuracy radial / axial, column height, centring/levelling auto",
      "€€€€ (estimate)",
      "can it measure the two seats and build axis A-B? cylindricity, software filters"
     ],
     [
      "Surface roughness tester (R_a 0.05–0.4 µm)",
      "–",
      "Mahr MarSurf (PS 10 portable, GD / CD lab); Jenoptik Hommel-Etamic (Waveline W-series); Mitutoyo Surftest SJ-210 / SJ-410",
      "stylus 2 µm, λc 0.25 / 0.8, ISO 21920 parameters",
      "€ – €€€",
      "calibration standard, skid vs skidless for waviness"
     ],
     [
      "In-process gauging for grinders",
      "–",
      "Marposs (gauge heads + control, e.g. P7 family – check), Movomatic, Balance Systems",
      "resolution 0.1 µm, Ø range, interface to the CNC",
      "€€ – €€€ (estimate)",
      "master ring, gap eliminator (AE), wheel balancer in the same unit"
     ],
     [
      "Indicating micrometers / micrometers",
      "–",
      "Mitutoyo (e.g. Digimatic series 293 micrometers), Mahr (Micromar, Millimess comparators)",
      "resolution 0.5–1 µm, MPE",
      "€",
      "calibration, ceramic or carbide faces"
     ],
     [
      "Dial / probe comparators",
      "–",
      "Mahr Millimess / MarCator, Mitutoyo, Tesa",
      "0.2–0.5 µm",
      "€",
      "measuring force"
     ],
     [
      "HSK-A63 taper plug gauge, ring gauge, test mandrel HSK-A63 × 300",
      "–",
      "gauge makers and calibration labs; HSK clamping-set makers (e.g. Ott-Jakob, Röhm, Schunk – ask)",
      "gauge per ISO 12164-2, mandrel runout ≤ 1 µm, certificate",
      "€€ (estimate)",
      "calibration interval, blue contact master"
     ],
     [
      "SK40 taper gauges (ISO 7388-1 / DIN 69871) – if an SK variant is built",
      "–",
      "same",
      "AT class",
      "€ – €€",
      "–"
     ],
     [
      "HSK clamping-force gauge",
      "–",
      "Ott-Jakob POWER-CHECK (check current model), other makers",
      "range ≥ 25 kN for HSK-A63, interface",
      "€€",
      "adaptor for HSK-A63"
     ],
     [
      "UCI hardness tester",
      "–",
      "Waygate Technologies (Krautkrämer) MIC series; Screening Eagle / Proceq Equotip UCI",
      "load HV1–HV10, probe types",
      "€€",
      "calibration on nitrided reference blocks"
     ],
     [
      "Micro-hardness tester (HV0.5 traverses)",
      "–",
      "Struers Duramin, Buehler Wilson, Qness, EMCO-TEST DuraScan",
      "automatic traverse software",
      "€€€",
      "for the coupon lab (or buy as a service)"
     ],
     [
      "Barkhausen noise (MBN)",
      "–",
      "Stresstech Rollscan (check model), others",
      "probes for shafts / bores",
      "€€€",
      "calibration with good / burnt reference parts"
     ],
     [
      "Magnetic particle bench",
      "–",
      "Tiede, Magnaflux, Karl Deutsch",
      "bench length ≥ 600 mm, fluorescent, demagnetising",
      "€€€",
      "ISO 9934 compliance"
     ],
     [
      "UT wall-thickness gauge",
      "–",
      "Olympus / Evident, Waygate, others",
      "resolution 0.01 mm",
      "€ – €€",
      "probe for curved surfaces"
     ]
    ]
   },
   {
    "id": "m28_7",
    "t": "Grinding wheels and dressing",
    "src": "guide 18 §28.7",
    "rows": [
     [
      "Vitrified CBN wheels (Op 100, 110)",
      "1A1 400 × 40, B126 / B91, vitrified, ≥ 45 m/s; internal Ø32 B91 on quill",
      "Norton / Saint-Gobain (incl. Winter superabrasives), Tyrolit, Krebs & Riedel, 3M (Winterthur)",
      "–",
      "€€ per wheel (estimate)",
      "max. speed marking (EN 12413), bore fit, balance quality"
     ],
     [
      "Corundum wheels (Op 80 pre-grind)",
      "89A / sintered alumina, 60–80 grit, K–J grade, vitrified",
      "same makers",
      "–",
      "€",
      "speed marking"
     ],
     [
      "Rotary diamond dressers / dressing rolls",
      "for CBN: profile, Ø, speed ratio",
      "Dr. Kaiser, Saint-Gobain, Tyrolit",
      "–",
      "€€",
      "CNC dressing spindle on the grinder"
     ]
    ]
   },
   {
    "id": "m28_8",
    "t": "Cutting tools",
    "src": "guide 18 §28.8",
    "rows": [
     [
      "Roughing / finishing inserts (QT steel)",
      "P15–P25, CVD coated",
      "Sandvik Coromant T-Max P (CNMG …, GC4425 / GC4415 class grades), Kennametal (KCP grades), Iscar, Seco",
      "–",
      "€ per box",
      "chip breaker for 0.35 mm feed"
     ],
     [
      "CBN for hard turning (Op 120)",
      "low-CBN content for continuous, higher for interrupted cut",
      "Sandvik CB7015 / CB7025 (check), Kennametal KB-series, Seco Secomax CBN, Iscar CBN grades – see catalogue",
      "–",
      "€ – €€ per insert",
      "edge preparation (chamfer + hone), wiper option"
     ],
     [
      "Damped boring bars",
      "Ø16–32, L/D up to 10–14",
      "Sandvik Silent Tools, Kennametal, Seco Steadyline (check)",
      "–",
      "€€",
      "interface, coolant through"
     ],
     [
      "Threading",
      "1.5 ISO full profile",
      "Sandvik CoroThread 266, others",
      "–",
      "€",
      "grade for hardened steel"
     ],
     [
      "Gun drills Ø22 × ≥ 650",
      "carbide tip, coolant hole",
      "Botek, Gühring, Sandvik Coromant deep-hole program – see catalogue",
      "–",
      "€€ per drill",
      "regrinding service, pad geometry for 31CrMoV9"
     ],
     [
      "Fine-boring heads (housing)",
      "1–2 µm adjustment",
      "BIG KAISER (EWN digital – check), Wohlhaupter, Mapal",
      "–",
      "€€",
      "balancing for speed"
     ],
     [
      "Honing (housing)",
      "Ø95–120, diamond stones",
      "Nagel, Gehring, Sunnen",
      "–",
      "€€€ – €€€€",
      "if the bore route uses honing"
     ]
    ]
   },
   {
    "id": "m28_9",
    "t": "Gun-drilling machines",
    "src": "guide 18 §28.9",
    "rows": [
     [
      "Gun-drilling machines",
      "E3",
      "TBT (Tiefbohrtechnik) ML / BW series – check",
      "Ø range, depth, pump bar / l/min, counter-rotation",
      "€€€€ (estimate)",
      "test bore in your bar (drift)"
     ],
     [
      "Gun-drilling machines",
      "E3",
      "IMSA, Galbiati, Unisig, others see catalogue",
      "same",
      "€€€ – €€€€",
      "same"
     ],
     [
      "Gun-drilling machines",
      "E3",
      "Service (recommended for small numbers) deep-hole drilling job shops",
      "per bore",
      "quote",
      "drift report per shaft"
     ]
    ]
   },
   {
    "id": "m28_10",
    "t": "Coolant and filtration for grinding",
    "src": "guide 18 §28.10",
    "rows": [
     [
      "Grinding oil",
      "low-viscosity neat oil for CBN, low mist",
      "Blaser, Castrol, Fuchs, Oelheld",
      "–",
      "€ per drum",
      "approval by the grinder maker, flash point"
     ],
     [
      "Filtration",
      "≤ 5 µm, flow 50–150 l/min per machine",
      "Vomat (precoat filters for oil), Knoll, Mayfran, Losma",
      "–",
      "€€ – €€€",
      "sludge handling, temperature control included?"
     ],
     [
      "Chiller",
      "±0.5 K, cooling power from the grinder load (≈ 5–10 kW)",
      "Hyfra, Technotrans, others",
      "–",
      "€€",
      "stability spec, refrigerant"
     ],
     [
      "Mist separator",
      "for oil machines",
      "Absolent, Filtermist, Losma",
      "–",
      "€€",
      "fire protection"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "Shopping list – spindle-part manufacturing cell (option \"make everything\") – guide 18 §28.11",
    "cols": [
     "Pos",
     "Item",
     "Spec (guide section)",
     "Qty",
     "Price class"
    ],
    "rows": [
     [
      "1",
      "Automatic band saw",
      "E1",
      "1",
      "€€€"
     ],
     [
      "2",
      "CNC lathe with steady rest, 22 kW",
      "E2, 28.1",
      "1",
      "€€€€"
     ],
     [
      "3",
      "Turn-mill centre C/Y (or HMC with rotary table)",
      "E6, 28.1",
      "1 (or use the factory HMC)",
      "€€€€"
     ],
     [
      "4",
      "Precision / hard-turning lathe",
      "E9, 28.1",
      "1",
      "€€€€"
     ],
     [
      "5",
      "Gun-drilling machine",
      "E3, 28.9",
      "1",
      "€€€€"
     ],
     [
      "6",
      "Pit furnace for stress relief",
      "E4",
      "1",
      "€€€"
     ],
     [
      "7",
      "Gas nitriding furnace with K_N control",
      "E5, 28.4",
      "1",
      "€€€€"
     ],
     [
      "8",
      "CNC universal cylindrical grinder + chiller + filter",
      "E7, 28.2, 28.10",
      "1",
      "€€€€"
     ],
     [
      "9",
      "Universal internal grinder (taper)",
      "E8, 28.2 / 28.3",
      "1",
      "€€€€"
     ],
     [
      "10",
      "Balancing machine",
      "E10, 28.5",
      "1",
      "€€€ – €€€€"
     ],
     [
      "11",
      "Roundness / form tester",
      "E11, 28.6",
      "1",
      "€€€€"
     ],
     [
      "12",
      "CMM",
      "E12, 28.6",
      "1",
      "€€€€"
     ],
     [
      "13",
      "Roughness tester, micrometers, comparators, masters",
      "28.6",
      "1 set",
      "€€ – €€€"
     ],
     [
      "14",
      "HSK gauges, test mandrel, gauge nut, thread gauges",
      "E14, 28.6",
      "1 set",
      "€€"
     ],
     [
      "15",
      "Hardness testers (UCI + micro-HV)",
      "E13, 28.6",
      "1 each",
      "€€ – €€€"
     ],
     [
      "16",
      "Barkhausen + nital etch station, MPI bench",
      "24.8, 27",
      "1 each",
      "€€€"
     ],
     [
      "17",
      "Measuring room 20 ±0.5 °C (≈ 30 m²)",
      "E15",
      "1",
      "€€€ – €€€€"
     ],
     [
      "18",
      "Wheels, dressers, inserts, gun drills (start stock)",
      "28.7, 28.8",
      "1 set",
      "€€ – €€€"
     ],
     [
      "19",
      "Washing / cleanliness station",
      "26.3",
      "1",
      "€€ – €€€"
     ],
     [
      "20",
      "Laser marker",
      "5.15",
      "1",
      "€€"
     ]
    ],
    "m": 1,
    "p": 4,
    "w": [
     6,
     36,
     30,
     12,
     16
    ]
   },
   {
    "title": "Make-or-buy recommendation – guide 18 §28.12",
    "cols": [
     "Option",
     "What you do",
     "Suits",
     "Comment"
    ],
    "rows": [
     [
      "A. Buy complete motor spindles (recommended for a compressor factory building a few HMCs)",
      "specify (12 000 rpm or 10 000 rpm, 15 / 18 kW, HSK-A63, 18 kN, sensors) and buy from a spindle maker",
      "< 20 spindles / year",
      "makers e.g. GMN, Franz Kessler, Fischer Precise, Step-Tec, IBAG, Siemens Weiss Spindeltechnologie, Setco – ask for a quote and the datasheet; use guides 18–20 to judge the offer and to run the incoming test"
     ],
     [
      "B. Make the parts with bought operations",
      "turning + milling in-house; buy gun drilling, nitriding, precision grinding, balancing; assemble in-house (guide 19)",
      "20–100 spindles / year",
      "qualification list = 11.8 E-table; the critical know-how stays in-house (assembly, test)"
     ],
     [
      "C. Make everything",
      "cell of 28.11",
      "> 100–200 spindles / year",
      "high investment, long learning curve"
     ]
    ],
    "m": 0,
    "p": -1,
    "w": [
     18,
     34,
     22,
     26
    ]
   }
  ],
  "shopTab": "Shopping list + make-or-buy",
  "shopLbl": "shopping list",
  "shopTitle": "Equipment for making the spindle parts (shaft, housing, spacers, drawbar) in-house, and when it is better to buy an operation from a supplier.",
  "price": "Price classes (guide 18, 2026, excl. VAT): € < 1 k€ · €€ 1 – 10 k€ · €€€ 10 – 50 k€ · €€€€ > 50 k€ – estimate, ask for a quote.",
  "shopNote": "If you buy an operation (gun drilling, nitriding, precision grinding), use the equipment buy specs of guide 18 §11.8 as the supplier qualification list.",
  "ph": "(e.g. Studer, EMAG, Schenck, Mahr, Taylor Hobson)"
 },
 "scada": {
  "guide": "guide 06",
  "drawings": [
   {
    "f": "06_scada_architecture.svg",
    "c": "SCADA architecture of the factory: field, line PLCs, redundant SCADA servers, historian, clients, MES, with the network zones",
    "g": "guide 06 §17.2",
    "t": "SCADA architecture of the factory"
   },
   {
    "f": "06_tag_naming.svg",
    "c": "Tag naming scheme: Area_Line_Machine_Signal_Suffix with allowed values, the same signal in every system, ISA-5.1 and KKS compared",
    "g": "guide 06 §18.1",
    "t": "Tag naming scheme"
   },
   {
    "f": "06_hmi_hierarchy.svg",
    "c": "ISA-101 display hierarchy: Level 1 plant overview, Level 2 line, Level 3 machine faceplate, Level 4 diagnostics, 68 screens",
    "g": "guide 06 §19.3",
    "t": "ISA-101 display hierarchy"
   },
   {
    "f": "06_hp_hmi_example.svg",
    "c": "High-performance Level 2 screen of the crankcase line: grey cards with analog indicators; only HMC-02 vibration 4.8 mm/s is in alarm",
    "g": "guide 06 §19.4",
    "t": "High-performance Level 2 screen"
   },
   {
    "f": "06_alarm_lifecycle.svg",
    "c": "ISA-18.2 alarm management life cycle with stages A–J, and the state diagram of one alarm (normal, unacknowledged, acknowledged, returned-to-normal unacknowledged …",
    "g": "guide 06 §20.1",
    "t": "ISA-18.2 alarm life cycle"
   },
   {
    "f": "06_alarm_kpi_chart.svg",
    "c": "Alarm rate per hour of one operator over 24 h before and after rationalisation, with the 6 per hour and 12 per hour target lines",
    "g": "guide 06 §20.5",
    "t": "Alarm rate before / after rationalisation"
   },
   {
    "f": "06_historian_compression.svg",
    "c": "Swinging-door compression (7 of 61 points stored, E = 0.5 °C) and exception deadband (35 of 61 points) on a spindle warm-up curve",
    "g": "guide 06 §21.3",
    "t": "Historian compression (swinging door)"
   },
   {
    "f": "06_network_zones.svg",
    "c": "IEC 62443 zones and conduits of the factory with example target security levels and the firewall rule list",
    "g": "guide 06 §27.1",
    "t": "IEC 62443 zones and conduits"
   }
  ],
  "groups": [
   {
    "id": "c30_1",
    "t": "SCADA / HMI software",
    "src": "guide 06 §30.1",
    "rows": [
     [
      "SCADA / HMI software",
      "PowerTags (external tags) in steps + options",
      "Siemens WinCC Unified (TIA Portal)",
      "integrated with S7-1500 engineering, HTML5 web clients, redundancy option",
      "estimate – ask for a quote",
      "PowerTag step ≥ 2 500; redundancy and web client licences; audit option"
     ],
     [
      "SCADA / HMI software",
      "data points + options",
      "Siemens WinCC OA",
      "scalable, distributed, redundant, Windows + Linux, open API",
      "estimate – ask for a quote",
      "engineering effort, local integrator support"
     ],
     [
      "SCADA / HMI software",
      "tag steps / per platform + clients",
      "AVEVA InTouch HMI / AVEVA System Platform (formerly Wonderware)",
      "object templates (System Platform), redundancy (AppEngine)",
      "estimate – ask for a quote",
      "which edition; offline licence server"
     ],
     [
      "SCADA / HMI software",
      "per server, unlimited tags and clients, modules priced separately",
      "Inductive Automation Ignition",
      "Java-based, Windows/Linux, Perspective (web) and Vision clients, built-in OPC UA, redundancy",
      "estimate – ask for a quote",
      "modules needed (Perspective, Tag Historian, Alarm Notification, Reporting); offline activation"
     ],
     [
      "SCADA / HMI software",
      "tag steps + clients",
      "GE Vernova Proficy iFIX",
      "long history in process plants, redundancy",
      "estimate – ask for a quote",
      "current version and support"
     ],
     [
      "SCADA / HMI software",
      "by tag count + modules",
      "COPA-DATA zenon",
      "strong in energy and manufacturing, redundancy, audit trail (pharma heritage)",
      "estimate – ask for a quote",
      "modules (Extended Trend, Alarm Analysis, Audit)"
     ],
     [
      "SCADA / HMI software",
      "per server + display clients",
      "Rockwell FactoryTalk View SE (and FactoryTalk Optix)",
      "best with Allen-Bradley PLCs (EtherNet/IP), redundancy",
      "estimate – ask for a quote",
      "OPC UA client quality for Siemens PLCs"
     ],
     [
      "SCADA / HMI software",
      "open source (check licence and support)",
      "Rapid SCADA (open source – check)",
      "free, Windows/Linux, web interface, Modbus/OPC drivers",
      "free software; support/engineering cost",
      "maturity of alarm management, redundancy, audit – may not meet 11.1 fully"
     ]
    ]
   },
   {
    "id": "c30_2",
    "t": "Historians",
    "src": "guide 06 §30.2",
    "rows": [
     [
      "Historians",
      "–",
      "AVEVA PI System (PI Data Archive, formerly OSIsoft PI)",
      "swinging-door compression, very large installations, many interfaces",
      "estimate – ask for a quote",
      "point count licence; PI Vision / AF needed?"
     ],
     [
      "Historians",
      "–",
      "Ignition Tag Historian module",
      "stores in an SQL database (e.g. SQL Server, PostgreSQL, MySQL), partitioning",
      "module price (estimate – ask for a quote)",
      "database server licence and sizing"
     ],
     [
      "Historians",
      "–",
      "Canary Labs Historian",
      "process historian with store-and-forward collectors",
      "estimate – ask for a quote",
      "tag licence steps"
     ],
     [
      "Historians",
      "–",
      "Siemens WinCC / Proficy / COPA-DATA historians",
      "come with the SCADA product",
      "option price",
      "retention, export, performance at 4.5 M values/day"
     ],
     [
      "Historians",
      "–",
      "InfluxDB (open source core)",
      "time-series database",
      "free core; enterprise paid",
      "collectors, buffering, compression settings = own engineering"
     ],
     [
      "Historians",
      "–",
      "TimescaleDB (PostgreSQL extension)",
      "SQL, compression of old chunks",
      "free/community (check licence)",
      "backup, retention jobs, own collectors"
     ]
    ]
   },
   {
    "id": "c30_3",
    "t": "OPC UA servers and gateways",
    "src": "guide 06 §30.3",
    "rows": [
     [
      "OPC UA servers and gateways",
      "–",
      "PTC Kepware KEPServerEX",
      "very many device drivers (Modbus, S7, EtherNet/IP, FOCAS …), OPC UA server, IoT gateway",
      "per driver / suite (estimate – ask for a quote)",
      "drivers needed; tag limits; offline licence"
     ],
     [
      "OPC UA servers and gateways",
      "–",
      "Softing dataFEED OPC Suite / edgeConnector",
      "OPC UA server/client, protocol conversion, Siemens/Rockwell PLC access",
      "estimate – ask for a quote",
      "supported PLCs, MQTT output"
     ],
     [
      "OPC UA servers and gateways",
      "–",
      "Matrikon (Honeywell) OPC UA / OPC UA Tunneller",
      "DA → UA wrapping and tunnelling of legacy servers",
      "estimate – ask for a quote",
      "OS support of the old machine PC"
     ],
     [
      "OPC UA servers and gateways",
      "–",
      "Unified Automation UaGateway / SDKs",
      "DA ↔ UA gateway; SDKs for own OPC UA servers",
      "estimate – ask for a quote",
      "for own test-bench software"
     ],
     [
      "OPC UA servers and gateways",
      "–",
      "Moxa MGate series (hardware gateways)",
      "Modbus RTU/TCP ↔ other fieldbus",
      "hardware (estimate – ask for a quote)",
      "protocol pair, mapping capacity — see datasheet"
     ]
    ]
   },
   {
    "id": "c30_4",
    "t": "MQTT brokers",
    "src": "guide 06 §30.4",
    "rows": [
     [
      "MQTT brokers",
      "community free / enterprise paid",
      "HiveMQ (Enterprise; Community Edition open source)",
      "clustering, Sparkplug support, enterprise security extensions",
      "–",
      "clustering only in paid edition?"
     ],
     [
      "MQTT brokers",
      "open source / enterprise",
      "EMQX (open source + enterprise)",
      "clustering, rule engine, MQTT 5",
      "–",
      "current open-source licence terms"
     ],
     [
      "MQTT brokers",
      "open source (EPL/EDL)",
      "Eclipse Mosquitto",
      "small, simple, widely used, single node",
      "–",
      "no built-in clustering – plan a cold spare"
     ]
    ]
   },
   {
    "id": "c30_5",
    "t": "Edge devices",
    "src": "guide 06 §30.5",
    "rows": [
     [
      "Edge devices",
      "–",
      "Siemens Industrial Edge (on SIMATIC IPC / Edge devices)",
      "app platform with Siemens apps (S7 connectors, OPC UA)",
      "estimate – ask for a quote",
      "Industrial Edge Management can run on-premise (offline)?"
     ],
     [
      "Edge devices",
      "–",
      "Advantech UNO series (box IPCs)",
      "fanless DIN-rail PCs, Windows/Linux",
      "estimate – ask for a quote",
      "CPU, RAM, ports – see datasheet"
     ],
     [
      "Edge devices",
      "–",
      "Moxa UC series (Arm computers) / MGate",
      "Linux Arm gateways, low power",
      "estimate – ask for a quote",
      "software support for the chosen gateway"
     ],
     [
      "Edge devices",
      "–",
      "Beckhoff C6015 / C6030 (ultra-compact IPCs)",
      "small, fanless, TwinCAT or plain Windows",
      "estimate – ask for a quote",
      "OS licence, mounting"
     ]
    ]
   },
   {
    "id": "c30_6",
    "t": "Servers, industrial PCs, thin clients",
    "src": "guide 06 §30.6",
    "rows": [
     [
      "Rack server",
      "–",
      "Dell PowerEdge R660 / R760",
      "1U / 2U, redundant PSU, iDRAC remote management",
      "estimate – ask for a quote",
      "SCADA vendor's hardware compatibility list"
     ],
     [
      "Rack server",
      "–",
      "HPE ProLiant DL360 / DL380 Gen11",
      "1U / 2U, redundant PSU, iLO",
      "estimate – ask for a quote",
      "same"
     ],
     [
      "Industrial rack / box PC",
      "–",
      "Siemens SIMATIC IPC (rack and box series – check current model names)",
      "24/7 industrial, long availability",
      "estimate – ask for a quote",
      "availability years, spare parts"
     ],
     [
      "Industrial PC (cabinet)",
      "–",
      "Beckhoff C60xx (e.g. C6030) / C66xx",
      "compact, industrial",
      "estimate – ask for a quote",
      "OS, performance for SCADA server role"
     ],
     [
      "Operator workstation",
      "–",
      "industrial or business workstation + 2 × 24\" monitors",
      "quiet, 24/7",
      "estimate – ask for a quote",
      "GPU outputs for 2–3 screens"
     ],
     [
      "Thin client / panel PC (line)",
      "–",
      "Siemens SIMATIC ITC (industrial thin client), Beckhoff CP-series panels, Advantech TPC",
      "IP65 front, touch, web client",
      "estimate – ask for a quote",
      "browser / RDP support, screen size 15–22\""
     ]
    ]
   },
   {
    "id": "c30_7",
    "t": "Large-screen displays",
    "src": "guide 06 §30.7",
    "rows": [
     [
      "Large-screen displays",
      "–",
      "Samsung professional displays (e.g. QM / QB series)",
      "24/7 or 16/7 rating per model",
      "estimate – ask for a quote",
      "24/7 rating, brightness, anti-glare"
     ],
     [
      "Large-screen displays",
      "–",
      "LG professional displays (e.g. UH5 / UL3 series)",
      "signage-class panels",
      "estimate – ask for a quote",
      "same"
     ],
     [
      "Large-screen displays",
      "–",
      "Sharp/NEC MultiSync large-format displays",
      "control-room use common",
      "estimate – ask for a quote",
      "same"
     ],
     [
      "Large-screen displays",
      "–",
      "EIZO (desk monitors for operator stations)",
      "24/7 monitors",
      "estimate – ask for a quote",
      "warranty hours"
     ]
    ]
   },
   {
    "id": "c30_8",
    "t": "UPS",
    "src": "guide 06 §30.8",
    "rows": [
     [
      "UPS",
      "–",
      "APC Smart-UPS SRT (online double conversion)",
      "rack/tower, network management card option, extended battery packs",
      "estimate – ask for a quote",
      "VA/W rating, runtime at 800 W (runtime chart), shutdown software offline"
     ],
     [
      "UPS",
      "–",
      "APC Smart-UPS SMT / SMX (line-interactive)",
      "for operator stations, small loads",
      "estimate – ask for a quote",
      "transfer time"
     ],
     [
      "UPS",
      "–",
      "Eaton 9PX / 9SX (online)",
      "rack/tower, network card",
      "estimate – ask for a quote",
      "same"
     ],
     [
      "UPS",
      "–",
      "Eaton 5PX (line-interactive)",
      "small racks, clients",
      "estimate – ask for a quote",
      "same"
     ]
    ]
   },
   {
    "id": "c30_9",
    "t": "Backup and cybersecurity tools",
    "src": "guide 06 §30.9",
    "rows": [
     [
      "Backup / imaging software",
      "server images, file backups, bare-metal restore",
      "Veeam Backup & Replication, Acronis Cyber Protect, Windows Server Backup",
      "–",
      "–",
      "works offline; restore to different hardware"
     ],
     [
      "Backup storage",
      "NAS + offline disks/tapes (3-2-1, 29.3)",
      "Synology / QNAP NAS class, LTO tape",
      "–",
      "–",
      "≥ 2 TB RAID 1 + offline rotation"
     ],
     [
      "Industrial firewall",
      "conduits C1–C6 (27.2)",
      "Fortinet FortiGate Rugged, Cisco ISA-3000 / Secure Firewall, Phoenix Contact mGuard, Hirschmann EAGLE40, Siemens SCALANCE S",
      "–",
      "–",
      "deep packet inspection for OPC UA/Modbus; rule management offline"
     ],
     [
      "OT intrusion detection (passive)",
      "asset inventory, anomaly detection on SPAN port",
      "Nozomi Networks Guardian, Claroty, Dragos Platform, Cisco Cyber Vision",
      "–",
      "–",
      "on-premise (offline) operation; protocol support (S7, OPC UA, Modbus, PROFINET)"
     ],
     [
      "Application whitelisting / endpoint protection",
      "allow only known programs on SCADA PCs",
      "Windows Defender Application Control / AppLocker, Trellix Application Control, OT-approved antivirus",
      "–",
      "–",
      "SCADA vendor approval"
     ],
     [
      "Remote access gateway",
      "jump host with MFA and recording (27.3)",
      "Secomea, Siemens SINEMA Remote Connect (on-premise), Cisco Secure Equipment Access",
      "–",
      "–",
      "self-hosted / offline server possible"
     ],
     [
      "Time server",
      "2 NTP sources (10.10)",
      "Meinberg LANTIME, Microchip SyncServer (GPS)",
      "–",
      "–",
      "GPS antenna on the roof; holdover"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "Item",
     "Qty",
     "Spec from this guide",
     "Chapter"
    ],
    "rows": [
     [
      "SCADA software licence, server",
      "2 (A + B)",
      "≥ 2 500 external tags or unlimited; redundancy; offline activation",
      "18.5, 30.1"
     ],
     [
      "SCADA clients",
      "2 operator + 5 line (web)",
      "concurrent sessions ≥ 7 + 3 spare",
      "17.5"
     ],
     [
      "Historian licence",
      "1",
      "≥ 2 500 points, 4.5 M values/day, store-and-forward",
      "21.4, 30.2"
     ],
     [
      "OPC UA gateway software",
      "1 (+ 1 on edge spare)",
      "Modbus TCP (26 meters + utilities), DA → UA (legacy), FOCAS if needed",
      "25, 30.3"
     ],
     [
      "MQTT broker",
      "1 + cold spare (or 2-node cluster)",
      "TLS 8883, QoS 1",
      "30.4"
     ],
     [
      "Edge PC",
      "1–2",
      "DIN rail, fanless, 2 × Ethernet",
      "30.5"
     ],
     [
      "Rack servers",
      "3 + 1 spare (or 2 virtual hosts)",
      "8 cores / 32 GB / RAID, redundant PSU",
      "11.2, 30.6"
     ],
     [
      "Engineering station",
      "1",
      "workstation, SCADA + PLC engineering software",
      "17.1"
     ],
     [
      "Operator stations",
      "2 + 1 spare",
      "2 × 24\" each",
      "11.3"
     ],
     [
      "Wall display",
      "1",
      "65\"–75\", 24/7",
      "19.5, 30.7"
     ],
     [
      "Line panel PC / thin client",
      "5 + 1 spare",
      "IP65 front, 15–22\" touch",
      "30.6"
     ],
     [
      "UPS server rack",
      "1 (or 2 for A/B separation)",
      "≥ 1 500 VA, ≥ 280 Wh, online, network card",
      "10.9, 30.8"
     ],
     [
      "UPS control room",
      "1",
      "≥ 1 000 VA for 2 operator PCs + switch (size like 10.9)",
      "30.8"
     ],
     [
      "Firewalls",
      "2 (IT/DMZ, DMZ/OT) + per line zone (or 1 with VLAN interfaces)",
      "industrial, rule list 27.2",
      "30.9"
     ],
     [
      "OT intrusion detection",
      "1 sensor",
      "passive, on-premise",
      "30.9"
     ],
     [
      "Backup NAS + offline disks",
      "1 NAS ≥ 2 TB RAID 1 + 2 disks ≥ 1 TB",
      "3-2-1",
      "29.3"
     ],
     [
      "NTP time servers",
      "2 (or 1 GPS + domain controller)",
      "GPS, holdover",
      "10.10"
     ],
     [
      "Remote access gateway",
      "1",
      "on-premise, MFA, recording",
      "27.3"
     ],
     [
      "Training",
      "operators, shift leaders, maintenance, admin",
      "29.1 hours",
      "29.1"
     ],
     [
      "Integrator services",
      "rationalisation ≈ 70 h, SAT ≈ 2 weeks × 2 persons, plus engineering",
      "20.1, 28.3",
      ""
     ]
    ],
    "m": 0,
    "p": -1,
    "w": [
     34,
     10,
     44,
     12
    ]
   }
  ],
  "shopTab": "Shopping list – factory SCADA",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – factory SCADA (example quantities) – guide 06 §30.10.",
  "price": "Price class = estimate – ask for a quote (depends on tag count, options, country, year, discounts). Every product must work offline (no cloud account, no online licence check at runtime).",
  "shopNote": "Product names change often (companies are bought and renamed) – check the current name, version and licence model.",
  "ph": "(e.g. WinCC, Ignition, historian, OPC UA, MQTT, UPS)"
 },
 "plc": {
  "guide": "guide 05",
  "drawings": [
   {
    "f": "05_plc_architecture.svg",
    "c": "Control architecture of the crankcase line: PLC-01 F-CPU rack, HMI, PN/PN coupler, PROFINET MRP ring with 5 stations, PROFIsafe devices …",
    "g": "guide 05 §2.2",
    "t": "Control architecture of the crankcase line"
   },
   {
    "f": "05_scan_cycle.svg",
    "c": "Scan cycle timeline with PII, OB1, PIQ, communication; a sensor change at 2.5 ms reaches the valve after 13.75 ms; worst case 14.6 ms (example)",
    "g": "guide 05 §3.2",
    "t": "PLC scan cycle timeline"
   },
   {
    "f": "05_ladder_examples.svg",
    "c": "Five ladder patterns with HMC01 tags: start/stop seal-in, mutual interlock, TON debounce, CTU tool-life counter, set/reset alarm latch",
    "g": "guide 05 §3.5",
    "t": "Five ladder patterns"
   },
   {
    "f": "05_grafcet_cell.svg",
    "c": "GRAFCET of HMC01: initial step, wait for loaded pallet, macro-step APC change, AND branch machining / load-unload, part report, fault step (example)",
    "g": "guide 05 §3.6",
    "t": "GRAFCET of HMC01"
   },
   {
    "f": "05_analog_scaling.svg",
    "c": "4–20 mA to raw counts to °C: nominal range 0–27648, under/overrange, NE 43 fault limits, HMC01 example point 8.39 mA → 7594 → 41.2 °C",
    "g": "guide 05 §4.4",
    "t": "4–20 mA → counts → °C (NE 43)"
   },
   {
    "f": "05_pid_loop.svg",
    "c": "PID loop block diagram of the coolant temperature with anti-windup, and simulated step responses: lambda PI vs Ziegler–Nichols PID (example)",
    "g": "guide 05 §10.7",
    "t": "PID loop of the coolant temperature"
   },
   {
    "f": "05_cabinet_io_wiring.svg",
    "c": "Cabinet I/O wiring of HMC01: fused 24 V groups, DI card with key switch and PNP sensors, DQ card with lamp, solenoid and interposing relay with diodes …",
    "g": "guide 05 §14.2",
    "t": "Cabinet I/O wiring of HMC01"
   },
   {
    "f": "05_packml_states.svg",
    "c": "PackML state model with 17 states, Stop and Abort envelopes and the twin state mapping",
    "g": "guide 05 §20.1",
    "t": "PackML state model"
   }
  ],
  "groups": [
   {
    "id": "p35_1",
    "t": "PLCs",
    "src": "guide 05 §35.1",
    "rows": [
     [
      "PLCs",
      "Line PLC, 5 stations, ~15 000 instructions, PROFINET IO controller + 2nd interface for OPC UA, max cycle ≤ 20 ms (17.3)",
      "Siemens SIMATIC S7-1500 (CPU 1513-1 PN, 1515-2 PN, 1516-3 PN/DP)",
      "bit op 40 / 30 / 10 ns (17.3); integrated PROFINET (RT/IRT); OPC UA server (licence by CPU size)",
      "€€ – €€€",
      "number of interfaces, work memory, OPC UA licence, max IO devices"
     ],
     [
      "PLCs",
      "Small standalone station (washer, test bench, crane)",
      "Siemens S7-1200 (CPU 1214C / 1215C, new G2 generation)",
      "compact, integrated I/O, PROFINET",
      "€",
      "memory, number of PROFINET devices, OPC UA support of the version"
     ],
     [
      "PLCs",
      "Controller inside a remote I/O station (machine-mounted)",
      "Siemens ET 200SP CPU (CPU 1510SP / 1512SP, F versions)",
      "S7-1500 performance class in ET 200SP format",
      "€ – €€",
      "interfaces, F version, BusAdapter"
     ],
     [
      "PLCs",
      "PC-based control with EtherCAT, motion + PLC in one device",
      "Beckhoff CX embedded PCs (e.g. CX5100, CX7000 series) / C60xx IPCs + TwinCAT 3",
      "EtherCAT master; TwinCAT runtime licence per performance level",
      "€ – €€",
      "TwinCAT platform level, operating system, fanless / temperature range"
     ],
     [
      "PLCs",
      "Large controller in the Rockwell world, EtherNet/IP",
      "Rockwell ControlLogix 5580 (1756-L8x)",
      "EtherNet/IP integrated, Studio 5000",
      "€€€",
      "memory size, number of EtherNet/IP nodes, redundancy option"
     ],
     [
      "PLCs",
      "Medium controller, Rockwell",
      "Rockwell CompactLogix 5380 / 5480 (5069-L3xx)",
      "dual EtherNet/IP ports, DLR",
      "€€",
      "node count, memory, CIP Safety version (Compact GuardLogix)"
     ],
     [
      "PLCs",
      "Mitsubishi-based machines",
      "Mitsubishi MELSEC iQ-R (R04/R08/R16CPU …) / iQ-F (FX5U)",
      "CC-Link IE TSN, GX Works3",
      "€ – €€",
      "network module needed for PROFINET / EtherNet/IP"
     ],
     [
      "PLCs",
      "Machine controller with EtherCAT + EtherNet/IP",
      "Omron NX/NJ (NX1P2, NX102, NJ501, NX701)",
      "Sysmac Studio, motion + PLC",
      "€ – €€€",
      "number of axes, OPC UA server, safety CPU option (NX-SL)"
     ],
     [
      "PLCs",
      "Modular controller with POWERLINK / OPC UA",
      "B&R X20 CPUs (X20CP series – check current models)",
      "Automation Studio, openSAFETY (X20SL SafeLOGIC)",
      "€ – €€",
      "interfaces, PROFINET/EtherNet/IP via interface modules"
     ],
     [
      "PLCs",
      "Schneider-based plant",
      "Schneider Modicon M580 (ePAC, Ethernet backplane) / M262 (CODESYS-based Machine Expert)",
      "EcoStruxure Control Expert / Machine Expert",
      "€€ / €",
      "safety version M580 Safety, Ethernet services"
     ],
     [
      "PLCs",
      "Cheap CODESYS controller for utilities",
      "WAGO PFC200 (750-82xx) / CC100",
      "CODESYS V3 (e!COCKPIT / CODESYS), Modbus, MQTT, OPC UA",
      "€",
      "runtime included, PROFINET device/controller option, I/O 750 series"
     ],
     [
      "PLCs",
      "Open Linux-based PLC",
      "Phoenix Contact PLCnext Control (e.g. AXC F 2152)",
      "IEC 61131-3 + C++/Python, PROFINET",
      "€",
      "PLCnext Engineer licence, apps"
     ]
    ]
   },
   {
    "id": "p35_2",
    "t": "Safety PLCs and configurable safety controllers",
    "src": "guide 05 §35.2",
    "rows": [
     [
      "Safety PLCs and configurable safety controllers",
      "PL e / SIL 3, PROFIsafe master, F-runtime ≤ 20 ms, ≥ 16 F-DI / 8 F-DQ per line (14.4, 28)",
      "Siemens S7-1500F (CPU 1513F / 1515F / 1516F) + ET 200SP F-modules (F-DI 8×24VDC HF, F-DQ 4×24VDC PM HF)",
      "STEP 7 Safety (Advanced) in TIA Portal; certified to SIL 3 / PL e",
      "€€ – €€€",
      "safety licence, F-response time (maker tool), number of F-devices"
     ],
     [
      "Safety PLCs and configurable safety controllers",
      "Rockwell line",
      "Rockwell GuardLogix 5580 / Compact GuardLogix 5380",
      "CIP Safety over EtherNet/IP, SIL 3 / PL e (see certificate)",
      "€€ – €€€",
      "safety task period, safety I/O (1734/5069 Guard I/O)"
     ],
     [
      "Safety PLCs and configurable safety controllers",
      "Decentral safety, multi-vendor",
      "Pilz PSS 4000 (e.g. PSSu H PLC1 FS) + PSSu I/O",
      "PAS4000 software, SafetyNET p, PL e / SIL CL 3",
      "€€",
      "fieldbus coupling to the line PLC (PROFINET device)"
     ],
     [
      "Safety PLCs and configurable safety controllers",
      "EtherCAT / PC-based",
      "Beckhoff TwinSAFE (EL6910 logic, EL1904 / EL2904 safe I/O, EK1960 compact controller)",
      "FSoE, SIL 3 / PL e, programmed in TwinCAT",
      "€ – €€",
      "logic capacity, FSoE to drives, response time"
     ],
     [
      "Safety PLCs and configurable safety controllers",
      "Small cell, configurable (no programming)",
      "Pilz PNOZmulti 2, SICK Flexi Soft, Siemens SIRIUS 3SK2",
      "graphical configuration, PL e, gateway to PROFINET for diagnostics",
      "€ – €€",
      "number of I/O, gateway, link between units"
     ],
     [
      "Safety PLCs and configurable safety controllers",
      "Omron / Mitsubishi machines",
      "Omron NX-SL safety CPU; Mitsubishi iQ-R safety (R08SFCPU)",
      "FSoE / CIP Safety (Omron); CC-Link IE safety (Mitsubishi)",
      "€€",
      "compatibility with the line PLC"
     ]
    ]
   },
   {
    "id": "p35_3",
    "t": "Remote I/O",
    "src": "guide 05 §35.3",
    "rows": [
     [
      "Remote I/O",
      "IP20 station per machine, PROFINET, DI sinking type 1/3, DQ 0.5 A, AI 4–20 mA with wire break, F-modules in the same station (17.5)",
      "Siemens ET 200SP (IM 155-6 PN ST / HF / HS)",
      "8/16-channel modules, BaseUnits with integrated terminals, F-modules, shared device (HF)",
      "€ – €€ per station",
      "max modules per head, update time, power budget, HF needed for shared device"
     ],
     [
      "Remote I/O",
      "IP67 on the machine, PROFINET",
      "Siemens ET 200eco PN, ET 200AL",
      "M12 connectors, IO-Link master versions",
      "€",
      "IP rating, connector type, current per port"
     ],
     [
      "Remote I/O",
      "EtherCAT I/O",
      "Beckhoff EK1100 + EL terminals; EP box modules (IP67); EK9300 = PROFINET coupler for EL terminals",
      "E-bus, distributed clocks",
      "€",
      "E-bus current, DC support"
     ],
     [
      "Remote I/O",
      "Modular IP20 multi-protocol",
      "WAGO 750 / 753 (e.g. 750-375 PROFINET coupler, 750-352 Ethernet / Modbus TCP coupler)",
      "many I/O types, PROFIsafe modules",
      "€",
      "coupler protocol, max modules, conformance class"
     ],
     [
      "Remote I/O",
      "High-density IP20",
      "Phoenix Contact Axioline F (e.g. AXL F BK PN bus coupler)",
      "fast local bus, PROFINET / EtherNet/IP couplers",
      "€",
      "coupler version, update time"
     ],
     [
      "Remote I/O",
      "IP67 block I/O, multi-protocol",
      "Turck TBEN-S / TBEN-L (also IO-Link master versions), BL20 (IP20)",
      "PROFINET / EtherNet/IP / Modbus TCP in one device",
      "€",
      "protocol selection, port current, IO-Link class"
     ]
    ]
   },
   {
    "id": "p35_4",
    "t": "IO-Link masters and devices",
    "src": "guide 05 §35.4",
    "rows": [
     [
      "IO-Link masters and devices",
      "IO-Link master PROFINET, IP67, 8 ports, class A + some class B (11.7)",
      "ifm AL11xx series (e.g. AL1102 – check protocol version)",
      "8 ports, IoT port for parallel data access",
      "€",
      "protocol (PROFINET / EtherNet/IP / EtherCAT version), class B ports"
     ],
     [
      "IO-Link masters and devices",
      "as above",
      "Balluff BNI IO-Link masters (PROFINET versions)",
      "8 ports, port class A/B",
      "€",
      "see datasheet"
     ],
     [
      "IO-Link masters and devices",
      "as above",
      "Turck TBEN-S2-4IOL, TBEN-L…-8IOL",
      "multi-protocol, IP67",
      "€",
      "port current, class B"
     ],
     [
      "IO-Link masters and devices",
      "IO-Link master in the ET 200SP station",
      "Siemens CM 4×IO-Link (ET 200SP)",
      "4 ports in the same station as the DI/DQ",
      "€",
      "port class, PCT / IO-Link configuration tool"
     ],
     [
      "IO-Link masters and devices",
      "IO-Link master with REST / small systems",
      "SICK SIG200 (sensor integration gateway)",
      "IO-Link master with REST API, PROFINET versions",
      "€",
      "protocol version"
     ],
     [
      "IO-Link masters and devices",
      "Spindle vibration sensor with internal RMS (twin: raw × 0.1 mm/s)",
      "ifm VVB001 (IO-Link vibration sensor), Balluff BCM condition monitoring sensor",
      "v-RMS, a-peak, temperature (see datasheet)",
      "€",
      "measuring range and frequency range vs ISO 20816 class"
     ],
     [
      "IO-Link masters and devices",
      "Pressure / temperature sensors IO-Link",
      "ifm PN / PI series, SICK PBS, Balluff BSP; temperature transmitters ifm TA, Endress+Hauser TMT",
      "IO-Link + switching output",
      "€",
      "range, accuracy, process connection"
     ]
    ]
   },
   {
    "id": "p35_5",
    "t": "HMI panels",
    "src": "guide 05 §35.5",
    "rows": [
     [
      "HMI panels",
      "Line / station panel, 12″ touch, PROFINET, alarms, recipes, ISA-101 style (11.11)",
      "Siemens SIMATIC HMI Unified Comfort (e.g. MTP1200 Unified Comfort) / Comfort Panels (e.g. TP1200 Comfort)",
      "WinCC Unified / WinCC Comfort in TIA Portal",
      "€€",
      "runtime options, number of tags, OPC UA, web clients"
     ],
     [
      "HMI panels",
      "PC-based panel",
      "Beckhoff CP29xx / CP39xx multi-touch panels (with or without built-in PC)",
      "TwinCAT HMI (licence per client)",
      "€ – €€",
      "panel PC vs display only, TwinCAT HMI client licences"
     ],
     [
      "HMI panels",
      "Rockwell line",
      "Rockwell PanelView 5000 (5310 / 5510)",
      "FactoryTalk View ME / Optix",
      "€ – €€",
      "controller compatibility"
     ],
     [
      "HMI panels",
      "Multi-vendor, low cost",
      "Weintek cMT X series / MT8000 series",
      "EasyBuilder Pro (free), many PLC drivers incl. S7, Modbus, OPC UA",
      "€",
      "driver for your PLC, IP rating of the front"
     ]
    ]
   },
   {
    "id": "p35_6",
    "t": "Industrial switches",
    "src": "guide 05 §35.6",
    "rows": [
     [
      "Industrial switches",
      "Managed PROFINET switch, CC-B, MRP, VLAN, cabinet mounting (11.9)",
      "Siemens SCALANCE XC200 / XB200, Phoenix Contact FL SWITCH 2000, Hirschmann RSP / BOBCAT, Moxa EDS series",
      "PROFINET conformance class, MRP manager/client, port count",
      "€",
      "PROFINET certificate, MRP role, power supply redundancy"
     ],
     [
      "Industrial switches",
      "Cell firewall between zone L2 and SCADA zone (32.1)",
      "Siemens SCALANCE S series, Phoenix mGuard / FL mGuard, other industrial firewalls",
      "stateful firewall, VPN",
      "€ – €€",
      "throughput, rule management, IEC 62443-4-2"
     ]
    ]
   },
   {
    "id": "p35_7",
    "t": "Engineering software and licences",
    "src": "guide 05 §35.7",
    "rows": [
     [
      "Program S7-1500 / S7-1200 / ET 200SP CPU",
      "per seat (single or floating); activation with the Automation License Manager – offline activation possible; software update service yearly",
      "Siemens TIA Portal STEP 7 Professional",
      "–",
      "€€",
      "–"
     ],
     [
      "F-program (S7-1500F)",
      "additional licence per seat",
      "STEP 7 Safety Advanced (TIA Portal option)",
      "–",
      "€€",
      "–"
     ],
     [
      "HMI configuration",
      "engineering licence per seat; panel runtime included in the panel; PC runtime by tags/clients",
      "WinCC Unified / WinCC Comfort / Advanced (engineering) + runtime licences on PC stations",
      "–",
      "€ – €€€",
      "–"
     ],
     [
      "Simulation",
      "PLCSIM Advanced: separate licence, virtual controllers with Ethernet + API",
      "S7-PLCSIM (included with STEP 7 Professional), S7-PLCSIM Advanced",
      "–",
      "€€",
      "–"
     ],
     [
      "OPC UA server on the CPU",
      "per CPU – check your CPU class",
      "SIMATIC OPC UA S7-1500 runtime licence (small / medium / large by CPU class)",
      "–",
      "€",
      "–"
     ],
     [
      "Beckhoff",
      "7-day trial licences can be renewed for tests; runtime licence bound to the device (or a licence dongle)",
      "TwinCAT 3 XAE engineering (free download) + runtime licences per device (e.g. TC1200 PLC, TF6100 OPC UA server, TF6701 IoT/MQTT, NC PTP for motion)",
      "–",
      "€ per function",
      "–"
     ],
     [
      "Rockwell",
      "FactoryTalk Activation – offline activation possible (host-ID / dongle); editions differ in features",
      "Studio 5000 Logix Designer (editions Lite / Standard / Professional …), FactoryTalk View, FactoryTalk Logix Echo (emulation)",
      "–",
      "€€ – €€€",
      "–"
     ],
     [
      "CODESYS-based controllers",
      "runtime licence is on the device; add-ons per seat",
      "CODESYS Development System (free); runtime licence per device (often included by the device maker, e.g. WAGO); add-ons (Git, Static Analysis, Test Manager) from the CODESYS store",
      "–",
      "free – €",
      "–"
     ],
     [
      "Others",
      "per seat; some free (safety configurators often free)",
      "Mitsubishi GX Works3, Omron Sysmac Studio, B&R Automation Studio, Schneider Control Expert / Machine Expert, Pilz PAS4000, SICK Safety Designer",
      "–",
      "free – €€",
      "–"
     ],
     [
      "Safety calculation",
      "free download; runs offline",
      "SISTEMA (IFA, free) + maker libraries",
      "–",
      "free",
      "–"
     ],
     [
      "Version control",
      "server licence by number of devices",
      "Git server (free), change-management server (e.g. versiondog / octoplant)",
      "–",
      "free – €€€",
      "–"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "#",
     "Item",
     "Qty",
     "Spec (from this guide)",
     "Example",
     "Price class (estimate – ask for a quote)"
    ],
    "rows": [
     [
      "1",
      "Fail-safe CPU",
      "1 (+1 spare)",
      "PL e / SIL 3, 2 PROFINET interfaces + plant port, ~15 000 instructions, max cycle ≤ 20 ms",
      "S7-1516F-3 PN/DP",
      "€€€ each"
     ],
     [
      "2",
      "Memory cards",
      "2 (+1 spare)",
      "program + logs, ≥ 2 × project",
      "SIMATIC memory card (size see datasheet)",
      "€"
     ],
     [
      "3",
      "Load power supply + rack",
      "1",
      "230 V AC → 24 V, rail",
      "PM 70 W + mounting rail",
      "€"
     ],
     [
      "4",
      "Central I/O (line signals)",
      "1 set",
      "DI 32, DQ 32, AI 8 (main switch, PSU OK, reset, cabinet door, stack light)",
      "S7-1500 I/O modules",
      "€ – €€"
     ],
     [
      "5",
      "Remote I/O stations",
      "5",
      "per station: head HF, DI 16, DQ 16, AI 4, F-DI 8, F-DQ 4, server module, 20 % spare (11.12)",
      "ET 200SP",
      "€€ per station"
     ],
     [
      "6",
      "IO-Link masters",
      "4",
      "3 HMC (vibration, temperature), 1 load station (RFID)",
      "ifm / Balluff / Turck / Siemens CM 4×IO-Link",
      "€ each"
     ],
     [
      "7",
      "Spindle vibration sensors",
      "3",
      "IO-Link, v-RMS mm/s, ISO 20816 range",
      "ifm VVB001 or equal",
      "€ each"
     ],
     [
      "8",
      "Temperature + pressure transmitters",
      "6 + 3",
      "4–20 mA 2-wire or IO-Link, 0–150 °C / 0–16 bar, ±0.5 %",
      "maker choice (11.7)",
      "€ each"
     ],
     [
      "9",
      "Line HMI panel",
      "1",
      "12″ touch, PROFINET, ISA-101 screens",
      "Unified Comfort 12″ (or equal)",
      "€€"
     ],
     [
      "10",
      "Load station operator panel",
      "1",
      "7–9″ touch or push-button box with reset (blue), start, stop, E-stop",
      "panel + buttons (guide 24 §17.6)",
      "€ – €€"
     ],
     [
      "11",
      "Managed switches",
      "6",
      "PROFINET CC-B, MRP, 8 ports (1 cabinet + 5 stations)",
      "SCALANCE XC200 / FL SWITCH 2000 / equal",
      "€ each"
     ],
     [
      "12",
      "PN/PN coupler",
      "1",
      "link to PLC-04, transfer area 16 bytes + heartbeat",
      "PN/PN coupler (Siemens) or I-device",
      "€"
     ],
     [
      "13",
      "Cell firewall",
      "1",
      "zone L2 ↔ SCADA, OPC UA 4840 only (32.1)",
      "industrial firewall (guide 07)",
      "€ – €€"
     ],
     [
      "14",
      "24 V PSU + ECB modules + buffer",
      "1 set per cabinet",
      "sized by 11.2 (10 A example), ECB per group",
      "guide 24 §17.8",
      "€"
     ],
     [
      "15",
      "Safety devices (E-stop, door locks, light curtain, safety contactors)",
      "per station",
      "PL d, ISO 13850 / 14119 / IEC 61496 (11.8)",
      "guide 24 §17.6–17.7, guide 21 table 24.5",
      "€ – €€ each"
     ],
     [
      "16",
      "PROFINET cables + M12 connectors",
      "as layout",
      "type B/C, ≤ 100 m (11.9)",
      "any certified",
      "€"
     ],
     [
      "17",
      "Software: STEP 7 Professional + Safety Advanced + WinCC (engineering)",
      "2 seats",
      "offline activation",
      "TIA Portal",
      "€€ – €€€"
     ],
     [
      "18",
      "PLCSIM Advanced",
      "1",
      "virtual commissioning with the twin (30.2)",
      "S7-PLCSIM Advanced",
      "€€"
     ],
     [
      "19",
      "OPC UA runtime licence",
      "1",
      "per CPU",
      "SIMATIC OPC UA S7-1500 (class of the CPU)",
      "€"
     ],
     [
      "20",
      "Loop calibrator + multimeter",
      "1 + 1",
      "inject/measure 4–20 mA, 24 V checks (31.2)",
      "e.g. Fluke 709 / 789 class, Fluke 87V",
      "€ each"
     ],
     [
      "21",
      "PROFINET diagnostic tool / network tester",
      "1",
      "topology, port statistics, cable test",
      "maker tools / cable certifier (service)",
      "€ – €€"
     ],
     [
      "22",
      "Spare parts set",
      "1",
      "1 CPU (item 1), 1 head module, 1 of each I/O module, 2 sensors of each type, fuses",
      "from items above",
      "€€"
     ]
    ],
    "m": 4,
    "p": 5,
    "w": [
     5,
     26,
     8,
     27,
     22,
     12
    ]
   }
  ],
  "shopTab": "Shopping list – crankcase line controls",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – crankcase line controls (PLC-01, 5 stations, example) – guide 05 §35.8.",
  "price": "Price classes (guide 05, per item, without engineering): € < 1 k€ · €€ 1 – 5 k€ · €€€ 5 – 20 k€ · €€€€ > 20 k€ – estimate, ask for a quote. Choose one PLC family for the whole factory.",
  "shopNote": "Network design (switches, ring, segmentation): guide 07 (Communication tab).",
  "ph": "(e.g. S7-1500, CompactLogix, ET 200SP, IO-Link, TIA Portal)"
 },
 "comm": {
  "guide": "guide 07",
  "drawings": [
   {
    "f": "07_iec62443_zones.svg",
    "c": "IEC 62443 zones and conduits of the factory, DMZ, target security levels and firewall rules",
    "g": "guide 07 §5",
    "t": "IEC 62443 zones, conduits, DMZ"
   },
   {
    "f": "07_opcua_model.svg",
    "c": "OPC UA information model of HMC-02: Machinery + Machine Tools companion specification + factory extension",
    "g": "guide 07 §5",
    "t": "OPC UA information model of HMC-02"
   },
   {
    "f": "07_osi_frame.svg",
    "c": "Ethernet / VLAN / IPv4 / TCP frame layout with byte counts and the Modbus TCP overhead example",
    "g": "guide 07 §10.2",
    "t": "Ethernet / VLAN / IP / TCP frame layout"
   },
   {
    "f": "07_profinet_cycle.svg",
    "c": "PROFINET send clock, reduction ratio and IRT/RT/NRT time phases inside one cycle",
    "g": "guide 07 §10.4",
    "t": "PROFINET send clock + IRT / RT / NRT phases"
   },
   {
    "f": "07_ring_redundancy.svg",
    "c": "MRP ring of the crankcase cell – normal state, cable break, and recovery time",
    "g": "guide 07 §10.8",
    "t": "MRP ring – break and recovery"
   },
   {
    "f": "07_factory_network.svg",
    "c": "Factory network – core, distribution ring, cell rings, DMZ, Wi-Fi, VLANs and IP subnets",
    "g": "guide 07 §11.7",
    "t": "Factory network – rings, VLANs, subnets"
   },
   {
    "f": "07_fibre_link_budget.svg",
    "c": "Fibre link budget – power levels along the link, losses and margin for OM3 and OS2",
    "g": "guide 07 §18.4",
    "t": "Fibre link budget (OM3 / OS2)"
   },
   {
    "f": "07_ethercat_frame.svg",
    "c": "EtherCAT – one frame passes all slaves, processing on the fly, and distributed clocks",
    "g": "guide 07 §22.2",
    "t": "EtherCAT frame + distributed clocks"
   }
  ],
  "groups": [
   {
    "id": "n34_1",
    "t": "Industrial managed switches",
    "src": "guide 07 §34.1",
    "rows": [
     [
      "Industrial managed switches",
      "Cell switch: 8 × 100 Mbit/s or Gbit RJ45, DIN rail, 24 V redundant, PROFINET CC-B device, MRP client/manager, LLDP, SNMPv3, IGMP snooping, storm control, fault relay (20.3)",
      "Siemens SCALANCE XC-200 (e.g. XC208, XC216, XC224)",
      "managed L2, PROFINET diagnostics, MRP – see datasheet",
      "€",
      "PROFINET conformance class, MRP manager capability, ports (2 SFP versions for fibre), temperature range"
     ],
     [
      "Industrial managed switches",
      "as above",
      "Siemens SCALANCE XC-300 (e.g. XC316-8)",
      "Gigabit, SINEC OS – see datasheet",
      "€ – €€",
      "L3 licence option, TSN readiness (check)"
     ],
     [
      "Industrial managed switches",
      "Distribution switch: Gigabit, 4 – 8 SFP for the fibre ring, L3 option, MRP/HSR, PTP boundary clock (19, 21.4)",
      "Siemens SCALANCE XR-500 (19\", e.g. XR524-8C) / XM-400 (modular DIN, e.g. XM408-8C)",
      "modular media modules, L3 with licence – see datasheet",
      "€€ – €€€",
      "number of SFP slots, L3 licence, PTP, redundant power"
     ],
     [
      "Industrial managed switches",
      "Cell / distribution, Hirschmann family",
      "Hirschmann (Belden) RSP (rail, PRP/HSR/PTP versions), BOBCAT (compact managed, TSN-capable versions), MSP (modular rail, L3)",
      "HiOS firmware; PRP/HSR on RSP versions – see datasheet",
      "€ – €€€",
      "which firmware level (L2S/L2A/L3), redundancy protocols included, PROFINET support"
     ],
     [
      "Industrial managed switches",
      "19\" core / backbone, Hirschmann",
      "Hirschmann GREYHOUND (GRS), DRAGON MACH4500",
      "10 G uplinks, L3 – see datasheet",
      "€€€ – €€€€",
      "10 G ports, power supplies, L3 routing protocols"
     ],
     [
      "Industrial managed switches",
      "Cell switches, Moxa family",
      "Moxa EDS-500E / EDS-G500E (managed DIN), EDS-2000 (unmanaged – not for cells)",
      "Turbo Ring/Chain, MRP on PROFINET versions – see datasheet",
      "€",
      "PROFINET version (EDS-…-PN?), MRP vs Turbo Ring, IEC 62443-4-2 certificate"
     ],
     [
      "Industrial managed switches",
      "Rackmount, Moxa",
      "Moxa ICS-G7000, IKS-G6824A; TSN: TSN-G5000",
      "L3 options, 10 G uplinks – see datasheet",
      "€€ – €€€",
      "L3, redundancy, TSN features"
     ],
     [
      "Industrial managed switches",
      "Phoenix Contact family",
      "Phoenix Contact FL SWITCH 2000 (managed, e.g. 2200/2300 series), TSN range (check current)",
      "PROFINET CC-B versions, MRP – see datasheet",
      "€",
      "PROFINET/EtherNet/IP profile, PoE versions"
     ],
     [
      "Industrial managed switches",
      "IT-integrated plants (Cisco core)",
      "Cisco Catalyst IE3100 / IE3200 / IE3300 / IE3400 (DIN), IE9300 (rack)",
      "IE3400: PROFINET, MRP, CIP; IE9300 = rack backbone – see datasheet",
      "€ – €€€",
      "licence (Network Essentials/Advantage), PROFINET/MRP support per model, DNA/IOS-XE skills in the team"
     ],
     [
      "Industrial managed switches",
      "Core (OT server room): 2 × L3, 24+ Gigabit, 4 × 10 G SFP+, VRRP, redundant power",
      "any of: SCALANCE XR-500/XR-300, Hirschmann GREYHOUND/DRAGON, Cisco IE9300 or Catalyst 9300 (IT-grade in the server room)",
      "see datasheet",
      "€€€",
      "stacking/VRRP, 10 G, firmware lifecycle"
     ],
     [
      "Industrial managed switches",
      "IP67 switch on a machine",
      "Siemens SCALANCE XB-000 / X-200 IP65 versions, Hirschmann OCTOPUS, Phoenix FL SWITCH IP67, Murrelektronik (check)",
      "M12 D/X-coded ports",
      "€ – €€",
      "M12 coding, managed vs unmanaged, 24 V via 7/8\" or M12 L-coded"
     ],
     [
      "Industrial managed switches",
      "Unmanaged (only inside a supplier's machine, never in our cells)",
      "Siemens SCALANCE XB005, Phoenix FL SWITCH 1000, Moxa EDS-2000",
      "–",
      "€",
      "QoS priority support (PROFINET needs it), CC-A only"
     ]
    ]
   },
   {
    "id": "n34_2",
    "t": "Firewalls and security appliances",
    "src": "guide 07 §34.2",
    "rows": [
     [
      "Firewalls and security appliances",
      "Cell / conduit firewall: stateful, DIN rail, 24 V, ≥ 2 zones, VPN, IEC 62443-4-2 certified, logging (31)",
      "Siemens SCALANCE SC-600 (e.g. SC632-2C, SC636-2C, SC646-2C)",
      "firewall + NAT, VPN versions – see datasheet",
      "€ – €€",
      "number of ports, VPN, throughput with firewall rules, certificate"
     ],
     [
      "Firewalls and security appliances",
      "as above",
      "Siemens SCALANCE S615, SCALANCE M (4G/5G routers)",
      "VPN, firewall – see datasheet",
      "€",
      "SINEC RM (remote management) integration"
     ],
     [
      "Firewalls and security appliances",
      "Hirschmann",
      "Hirschmann (Belden) EAGLE40 (EAGLE40-03, -07), EAGLE20/30",
      "firewall, VPN, DPI options (Modbus, OPC) on some versions – see datasheet",
      "€ – €€",
      "DPI for which protocols, throughput"
     ],
     [
      "Firewalls and security appliances",
      "Moxa",
      "Moxa EDR secure routers (EDR-810, EDR-G9010), EDF-G1002-BP (industrial firewall with DPI)",
      "DPI for Modbus/others on some models – see datasheet",
      "€",
      "IEC 62443-4-2 certificate, DPI protocols"
     ],
     [
      "Firewalls and security appliances",
      "Phoenix Contact",
      "Phoenix Contact mGuard (FL MGUARD 2000 / 4000 series)",
      "firewall, VPN, mGuard device manager – see datasheet",
      "€",
      "throughput, central management"
     ],
     [
      "Firewalls and security appliances",
      "DMZ firewall pair (HA): high throughput, IPS, central management, 1/10 G",
      "Fortinet FortiGate (rugged: FortiGate Rugged FGR-60F/70F for the field; rack models for the DMZ), Cisco Secure Firewall (rack), Cisco ISA-3000 (industrial)",
      "IPS, OT application signatures – see datasheet",
      "€€ – €€€€",
      "throughput with IPS on, OT protocol signatures (OPC UA, S7, Modbus), licence per year"
     ],
     [
      "Firewalls and security appliances",
      "Passive OT intrusion detection / asset inventory (31.4)",
      "Claroty, Nozomi Networks Guardian, Dragos Platform, Cisco Cyber Vision, Microsoft Defender for IoT, Siemens SINEC Security Monitor (check)",
      "listens on SPAN/TAP; protocol decoding – see datasheet",
      "€€€ – €€€€ (licence)",
      "offline operation (no cloud!), supported protocols, sensor count"
     ]
    ]
   },
   {
    "id": "n34_3",
    "t": "Industrial Wi-Fi",
    "src": "guide 07 §34.3",
    "rows": [
     [
      "Industrial Wi-Fi",
      "AP: Wi-Fi 6 (802.11ax), 5 GHz, 802.11r/k/v, WPA3-Enterprise, PoE+, ceiling/mast mount, external antennas for halls (28)",
      "Siemens SCALANCE W1700 (e.g. W1788 AP, W1748 client); older W700 (W761/W774/W786 AP, W734 client) with iPCF fast roaming",
      "iPCF (proprietary fast roaming) on W700 – see datasheet",
      "€ – €€",
      "Wi-Fi 6 vs iPCF availability per model, antenna options, national approvals"
     ],
     [
      "Industrial Wi-Fi",
      "Moxa family",
      "Moxa AWK series (e.g. AWK-1137C client, AWK-3252A / AWK-4252A AP) with Turbo Roaming",
      "see datasheet",
      "€",
      "802.11ax availability, roaming time stated by maker"
     ],
     [
      "Industrial Wi-Fi",
      "Phoenix Contact",
      "Phoenix Contact FL WLAN (e.g. FL WLAN 1100 / 1101, 5100 series)",
      "see datasheet",
      "€",
      "standard (n/ac/ax), client mode for AGV"
     ],
     [
      "Industrial Wi-Fi",
      "Cisco",
      "Cisco Catalyst IW9165 / IW9167 (Wi-Fi 6/6E, URWB mode), IW6300 heavy-duty AP",
      "URWB = very fast handover for vehicles – see datasheet",
      "€€",
      "controller/licence model, URWB vs Wi-Fi mode"
     ],
     [
      "Industrial Wi-Fi",
      "Hirschmann",
      "Hirschmann (Belden) BAT series (check current)",
      "see datasheet",
      "€",
      "–"
     ],
     [
      "Industrial Wi-Fi",
      "AGV client",
      "normally specified by the AGV supplier (built into the vehicle)",
      "–",
      "–",
      "must match the AP family for proprietary fast roaming"
     ],
     [
      "Industrial Wi-Fi",
      "Site survey tool / service",
      "Ekahau (AI Pro + Sidekick), NetAlly AirCheck – or as a service",
      "–",
      "€€ (tool)",
      "before and after installation (T-N12)"
     ]
    ]
   },
   {
    "id": "n34_4",
    "t": "Private 5G",
    "src": "guide 07 §34.4",
    "rows": [
     [
      "Private 5G",
      "Complete private network (core + radios + management), on-premises, local spectrum",
      "Ericsson Private 5G, Nokia DAC / MX Industrial Edge, Siemens private 5G infrastructure (check availability)",
      "see offer",
      "€€€€ (plus licence, operation)",
      "offline operation of the core, spectrum licence, SLA, latency measured on site"
     ],
     [
      "Private 5G",
      "5G router / modem for AGV, machine",
      "Siemens SCALANCE MUM856-1 (5G router – check), Moxa / Phoenix 5G routers (check)",
      "see datasheet",
      "€ – €€",
      "bands (n78 etc.), SIM/eSIM, industrial temperature"
     ]
    ]
   },
   {
    "id": "n34_5",
    "t": "Cables",
    "src": "guide 07 §34.5",
    "rows": [
     [
      "Cables",
      "PROFINET type A/B, 2 × 2 AWG 22, shielded, green, oil-resistant, halogen-free (18.1)",
      "Lapp ETHERLINE PN (Cat.5 / Cat.5e, fixed and FD flexible versions)",
      "PROFINET certified versions – see datasheet",
      "€ per 100 m",
      "PROFINET type, sheath material (PUR for oil), bending radius"
     ],
     [
      "Cables",
      "PROFINET type C (drag chain, torsion – APC, AS/RS crane)",
      "Lapp ETHERLINE FD / TORSION, Igus chainflex CFBUS (Ethernet), Siemens IE FC Trailing Cable",
      "cycles / bending radius – see datasheet",
      "€ – €€ per 100 m",
      "number of bending cycles, minimum bending radius in the chain, torsion angle"
     ],
     [
      "Cables",
      "Siemens Fast Connect system (strip tool, no crimping)",
      "Siemens IE FC TP Standard Cable GP 2×2, IE FC Flexible, Marine; IE FC RJ45 Plug 180",
      "type A/B; FC stripping tool – see catalogue",
      "€",
      "fits only FC connectors; plug angle (90°/145°/180°)"
     ],
     [
      "Cables",
      "Cat 6A building / server room, shielded (S/FTP), LSZH",
      "Helukabel HELUKAT (Cat 6A / Cat 7 installation cable), Belden DataTuff industrial (Cat 5e/6/6A), Lapp ETHERLINE Cat.6A",
      "see datasheet",
      "€ per 100 m",
      "fire class (EN 50575 CPR, e.g. Cca), shielding, AWG"
     ],
     [
      "Cables",
      "Fibre backbone, OS2 single-mode, 12 fibres, armoured or rodent-protected, LSZH",
      "Lapp HITRONIC, Corning, R&M, Belden/Hirschmann fibre cables, Siemens FO Standard Cable (GP / Trailing)",
      "see datasheet",
      "€ – €€ per 100 m",
      "fibre count, tight vs loose tube, indoor/outdoor, minimum bend radius"
     ],
     [
      "Cables",
      "POF / PCF for short PROFINET fibre links in high-EMC areas",
      "Siemens POF / PCF FO cables, Lapp HITRONIC POF",
      "≤ 50 m POF / ≤ 100 m PCF (PROFINET)",
      "€",
      "connector system (SC RJ), device port type"
     ]
    ]
   },
   {
    "id": "n34_6",
    "t": "Connectors, patch and fibre accessories",
    "src": "guide 07 §34.6",
    "rows": [
     [
      "Connectors, patch and fibre accessories",
      "RJ45 field-assembly, metal, 360° shield, IP20, PROFINET",
      "Harting preLink / RJ Industrial, Phoenix Contact VS-08-RJ45 (check), Siemens IE FC RJ45 Plug, Murrelektronik RJ45 field plugs",
      "see datasheet",
      "€",
      "cable diameter range, AWG 22 solid/stranded, tool needed"
     ],
     [
      "Connectors, patch and fibre accessories",
      "RJ45 IP65/67 push-pull (variant 14) for cabinet walls",
      "Harting RJ Industrial PushPull, Phoenix, Siemens IE RJ45 Plug PRO",
      "see datasheet",
      "€",
      "matching panel feed-through"
     ],
     [
      "Connectors, patch and fibre accessories",
      "M12 D-coded (100 Mbit/s) / X-coded (Gbit) cordsets and field plugs",
      "Phoenix Contact SAC/SACC M12 (check), Murrelektronik M12 Ethernet, Harting M12, Lapp ETHERLINE cordsets, Binder",
      "see datasheet",
      "€",
      "coding (D vs X), straight/angled, cable type (PUR), shield on the coupling nut"
     ],
     [
      "Connectors, patch and fibre accessories",
      "Patch cords shielded, 0.5 – 3 m, Cat 6A, LSZH, coloured per VLAN function",
      "any quality brand (Belden, Lapp, Harting, Phoenix, R&M)",
      "–",
      "€",
      "shield (S/FTP), length, colour code agreed"
     ],
     [
      "Connectors, patch and fibre accessories",
      "Fibre patch panel DIN rail (splice box) for field cabinets",
      "Phoenix Contact FDX 20 (check), Lapp, Siemens, R&M DIN-rail boxes",
      "LC/SC duplex, splice cassettes",
      "€",
      "number of ports, splice cassettes, LC vs SC"
     ],
     [
      "Connectors, patch and fibre accessories",
      "Fibre patch cords LC–LC duplex OS2 / OM3, 1 – 5 m",
      "any quality brand",
      "insertion loss ≤ 0.3 dB (good LC – datasheet)",
      "€",
      "polarity A-B, end-face (UPC), dust caps; clean before plugging (inspection scope)"
     ]
    ]
   },
   {
    "id": "n34_7",
    "t": "Media converters and SFP transceivers",
    "src": "guide 07 §34.7",
    "rows": [
     [
      "Media converters and SFP transceivers",
      "Copper ↔ fibre converter, DIN, 24 V, 100 Mbit/s or 1 Gbit/s",
      "Moxa IMC-21A (100 Mbit/s) / IMC-21GA (Gbit, SFP), Phoenix Contact FL MC series (check), Siemens SCALANCE X101-1 (check)",
      "see datasheet",
      "€",
      "link-fault pass-through, SFP slot vs fixed optic, temperature"
     ],
     [
      "Media converters and SFP transceivers",
      "SFP 1000BASE-LX (OS2, 1 310 nm) / 1000BASE-SX (OM3, 850 nm), industrial temperature",
      "switch maker's own SFPs (Siemens SFP99x family, Hirschmann M-SFP, Moxa SFP-1G, Cisco GLC/ SFP)",
      "Tx power / sensitivity – datasheet (link budget 18.4)",
      "€",
      "use the switch maker's SFP (compatibility, support), temperature range, DDM (digital diagnostics)"
     ]
    ]
   },
   {
    "id": "n34_8",
    "t": "Gateways and protocol converters",
    "src": "guide 07 §34.8",
    "rows": [
     [
      "Gateways and protocol converters",
      "PROFINET ↔ EtherNet/IP / EtherCAT / Modbus TCP / PROFIBUS / CANopen (machine with a foreign fieldbus)",
      "HMS Anybus X-gateway, Anybus Communicator (serial/Modbus RTU ↔ PROFINET etc.)",
      "many protocol pairs – see datasheet",
      "€",
      "I/O data size per direction, cycle time, configuration tool"
     ],
     [
      "Gateways and protocol converters",
      "as above",
      "Hilscher netTAP NT 151 (check current), netTAP family",
      "protocol pairs by firmware – see datasheet",
      "€",
      "firmware for the needed pair"
     ],
     [
      "Gateways and protocol converters",
      "PROFINET ↔ PROFINET between two PLCs (line coupling)",
      "Siemens PN/PN coupler",
      "two separate PROFINET networks, I/O exchange – see datasheet",
      "€",
      "data size, MRP on both sides"
     ],
     [
      "Gateways and protocol converters",
      "PROFIBUS DP under PROFINET",
      "Siemens IE/PB LINK PN IO, or DP master in the PLC",
      "proxy function – see datasheet",
      "€",
      "number of DP slaves, baud rate"
     ],
     [
      "Gateways and protocol converters",
      "CANopen under PROFINET",
      "Siemens PN/CAN LINK, HMS Anybus",
      "see datasheet",
      "€",
      "CANopen master/slave mode"
     ],
     [
      "Gateways and protocol converters",
      "IO-Link master (PROFINET, IP67, class A/B ports)",
      "ifm (AL1xxx series – check), Balluff BNI IO-Link masters, Siemens ET 200eco PN IO-Link, Murrelektronik, Pepperl+Fuchs",
      "4 – 8 ports, IODD support – see datasheet",
      "€",
      "port class A/B, current per port, data storage, PROFINET CC-B"
     ],
     [
      "Gateways and protocol converters",
      "Edge gateway to OPC UA / MQTT (protocol conversion on site, offline)",
      "Softing uaGate (SI for Siemens, MB for Modbus), Softing dataFEED edgeConnector, Hilscher netFIELD, HMS Anybus Edge (check), Siemens SIMATIC IOT2050 / Industrial Edge",
      "see datasheet",
      "€ – €€",
      "runs fully offline, security updates, supported PLCs"
     ]
    ]
   },
   {
    "id": "n34_9",
    "t": "OPC UA servers, MTConnect adapters",
    "src": "guide 07 §34.9",
    "rows": [
     [
      "OPC UA servers, MTConnect adapters",
      "OPC UA server on Siemens CNC per OPC 40501-1",
      "Siemens SINUMERIK OPC UA option (\"Access MyMachine / OPC UA\" – check name and umati support for your version)",
      "–",
      "–",
      "licence per machine, companion spec version"
     ],
     [
      "OPC UA servers, MTConnect adapters",
      "OPC UA server on FANUC CNC",
      "FANUC OPC UA server function (option for 0i-F / 30i-B series – check)",
      "–",
      "–",
      "option number, model support, umati"
     ],
     [
      "OPC UA servers, MTConnect adapters",
      "OPC UA on HEIDENHAIN",
      "HEIDENHAIN OPC UA NC Server option (TNC 640 etc. – check)",
      "–",
      "–",
      "licence, security"
     ],
     [
      "OPC UA servers, MTConnect adapters",
      "MTConnect",
      "MTConnect cppagent (open source, MTConnect Institute) + maker adapter; many CNCs have native MTConnect (e.g. Mazak, Okuma – check)",
      "–",
      "–",
      "MTConnect version, data items supported"
     ],
     [
      "OPC UA servers, MTConnect adapters",
      "OPC UA on robot controller per OPC 40010-1",
      "robot maker option (check per maker)",
      "–",
      "–",
      "Robotics companion spec support"
     ]
    ]
   },
   {
    "id": "n34_10",
    "t": "Time servers",
    "src": "guide 07 §34.10",
    "rows": [
     [
      "Time servers",
      "GPS-locked NTP + PTP grandmaster, 1U or DIN, 2 network ports, OCXO for holdover (21.4)",
      "Meinberg LANTIME (M300, M600, M1000 …), Meinberg microSync (compact)",
      "NTP + PTP (profiles by licence), oscillator options – see datasheet",
      "€€ – €€€",
      "PTP profile licence (default, power, 802.1AS), oscillator (TCXO/OCXO), antenna + lightning protection"
     ],
     [
      "Time servers",
      "Siemens world (SIMATIC clocks)",
      "Siemens SICLOCK TC100 / TC400",
      "NTP / SIMATIC time – see datasheet",
      "€ – €€",
      "PTP support, redundancy"
     ],
     [
      "Time servers",
      "Network time appliance (IT style)",
      "Microchip SyncServer (S600 / S650)",
      "NTP + PTP – see datasheet",
      "€€ – €€€",
      "–"
     ],
     [
      "Time servers",
      "PTP in a PC (test bench DAQ with µs time)",
      "Oregano syn1588 NIC, Intel NICs with hardware time stamps",
      "hardware time stamping",
      "€",
      "driver support"
     ]
    ]
   },
   {
    "id": "n34_11",
    "t": "Test and diagnostic tools",
    "src": "guide 07 §34.11",
    "rows": [
     [
      "Test and diagnostic tools",
      "Copper certification ISO/IEC 11801 / TIA, Cat 5e – 8 (T-N1)",
      "Fluke Networks DSX CableAnalyzer (DSX-5000 / DSX-8000, Versiv platform)",
      "certification to Class EA/FA etc. – see datasheet",
      "€€€ – €€€€ (or rent / installer's tool)",
      "limit sets incl. industrial/PROFINET, M12 adapters, calibration date"
     ],
     [
      "Test and diagnostic tools",
      "Fibre loss (tier 1) and OTDR (tier 2) (T-N2, T-N3)",
      "Fluke Networks CertiFiber Pro, OptiFiber Pro (Versiv modules); EXFO, VIAVI",
      "see datasheet",
      "€€€",
      "SM + MM modules, reference cords"
     ],
     [
      "Test and diagnostic tools",
      "Qualification / troubleshooting (link, PoE, switch port, VLAN)",
      "Fluke Networks LinkIQ (cable + network tester), LinkRunner (NetAlly), MicroScanner",
      "not a certification",
      "€ – €€",
      "PoE load test, LLDP/CDP display"
     ],
     [
      "Test and diagnostic tools",
      "PROFINET diagnostics, permanent",
      "Indu-Sol PROmesh (diagnostic switches), PROFINET-INspektor NT",
      "permanent monitoring, alarms, load, jitter",
      "€€",
      "integration in SCADA (OPC UA/SNMP), number of ports"
     ],
     [
      "Test and diagnostic tools",
      "PROFINET topology, naming, quick check",
      "Siemens PRONETA (free)",
      "topology scan, device names, I/O test",
      "free",
      "offline download, version"
     ],
     [
      "Test and diagnostic tools",
      "Capture with hardware time stamps",
      "Hilscher netANALYZER, Profitap TAPs",
      "ns time stamps, full duplex",
      "€ – €€",
      "interface (USB/PCIe), speed"
     ],
     [
      "Test and diagnostic tools",
      "Protocol analysis",
      "Wireshark (free, with PROFINET, EtherCAT, EtherNet/IP, OPC UA, MQTT dissectors)",
      "–",
      "free",
      "install the offline installer on the service laptop"
     ],
     [
      "Test and diagnostic tools",
      "PROFIBUS diagnostics",
      "PROCENTEC ProfiTrace, Indu-Sol PROFIBUS-INspektor, Softing (check)",
      "oscilloscope + bus monitor",
      "€€",
      "–"
     ],
     [
      "Test and diagnostic tools",
      "Throughput, ping, port scan",
      "iperf3, fping, nmap (free)",
      "–",
      "free",
      "approved by IT for OT use"
     ]
    ]
   },
   {
    "id": "n34_12",
    "t": "Network management software",
    "src": "guide 07 §34.12",
    "rows": [
     [
      "Network management software",
      "topology (LLDP), monitoring, firmware and configuration management for SCALANCE (and others via SNMP)",
      "Siemens SINEC NMS",
      "–",
      "–",
      "licence by node count"
     ],
     [
      "Network management software",
      "as above",
      "Hirschmann (Belden) Industrial HiVision",
      "–",
      "–",
      "licence"
     ],
     [
      "Network management software",
      "as above",
      "Moxa MXview (One)",
      "–",
      "–",
      "licence"
     ],
     [
      "Network management software",
      "multi-vendor monitoring",
      "Generic: Zabbix, LibreNMS, PRTG (SNMP)",
      "–",
      "–",
      "IT support, offline install"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "#",
     "Item",
     "Spec (chapter)",
     "Qty",
     "Example series (34)",
     "Price class each"
    ],
    "rows": [
     [
      "1",
      "OT core switch, L3, 24 × 1 G + 4 × 10 G SFP+, redundant PSU",
      "34.1, VRRP pair",
      "2",
      "SCALANCE XR-500 / GREYHOUND / IE9300",
      "€€€"
     ],
     [
      "2",
      "DMZ firewall pair (IT side)",
      "31.2",
      "2",
      "FortiGate / Cisco Secure Firewall",
      "€€ – €€€"
     ],
     [
      "3",
      "OT firewall pair (DMZ ↔ OT, inter-zone routing)",
      "31.2",
      "2",
      "FortiGate / Cisco / SCALANCE SC-600 class (throughput!)",
      "€€ – €€€"
     ],
     [
      "4",
      "DMZ switch",
      "31.2",
      "1",
      "managed L2",
      "€"
     ],
     [
      "5",
      "Distribution switch in field cabinet, 4 – 8 SFP, MRP/HSR, PTP BC",
      "19, 21.4",
      "4 (MCH-west, MCH-lines, ASM-TST, LOG)",
      "XM-400 / MSP / IKS-G6824A",
      "€€"
     ],
     [
      "6",
      "Cell switch 8-port managed, CC-B, MRP",
      "20.6",
      "25 (FMS 6, cylinder 3, crankshaft 3, assembly/test 6, final/pack 3, AS/RS 4)",
      "XC-200 / RSP / EDS-500E / FL SWITCH 2000",
      "€"
     ],
     [
      "7",
      "Spare cell switch + spare distribution switch",
      "MTTR (T-N13)",
      "2 + 1",
      "as 5/6",
      "€ / €€"
     ],
     [
      "8",
      "PoE+ switch for access points (or PoE ports on distribution)",
      "18.5: 8 × 30 W = 240 W",
      "2 × 8-port, ≥ 240 W total",
      "XC-200 PoE / RSP PoE / EDS PoE",
      "€"
     ],
     [
      "9",
      "Wi-Fi 6 access points, industrial, external antennas",
      "28.2",
      "8",
      "SCALANCE W1700 / AWK / IW9165",
      "€ – €€"
     ],
     [
      "10",
      "AGV Wi-Fi clients (if not supplied with the AGV) + 1 spare",
      "28.3",
      "3",
      "same family as APs",
      "€"
     ],
     [
      "11",
      "Time server GPS, NTP + PTP, OCXO, antenna kit + surge protector",
      "21.4",
      "1 (+1 optional)",
      "LANTIME / SICLOCK",
      "€€"
     ],
     [
      "12",
      "Network management software",
      "34.12",
      "1 licence (≈ 40 nodes)",
      "SINEC NMS / HiVision / MXview",
      "€€"
     ],
     [
      "13",
      "OT intrusion detection sensor + licence (phase 2)",
      "31.4",
      "1 – 2 sensors",
      "Claroty / Nozomi / Cyber Vision",
      "€€€"
     ],
     [
      "14",
      "Fibre OS2 12-fibre backbone cable",
      "ring ≈ 2 × (96 + 50) = 292 m + drops + server-room links",
      "≈ 450 m",
      "HITRONIC / Corning",
      "€ per 100 m"
     ],
     [
      "15",
      "DIN fibre splice/patch boxes + server room fibre panel",
      "34.6",
      "4 + 2",
      "FDX / R&M",
      "€"
     ],
     [
      "16",
      "SFP 1000BASE-LX (industrial temperature)",
      "ring 4 × 2 + core links 4 × 2",
      "16 + 2 spare",
      "switch maker SFP",
      "€"
     ],
     [
      "17",
      "LC–LC OS2 patch cords 2 m",
      "",
      "24",
      "",
      "€"
     ],
     [
      "18",
      "PROFINET cable type B (green, PUR)",
      "≈ 100 devices × 20 m × 1.2",
      "≈ 2 500 m",
      "ETHERLINE PN / IE FC",
      "€ per 100 m"
     ],
     [
      "19",
      "PROFINET type C high-flex (APC, AS/RS crane chains)",
      "34.5",
      "≈ 200 m",
      "ETHERLINE FD / chainflex",
      "€ – €€ per 100 m"
     ],
     [
      "20",
      "Cat 6A S/FTP installation cable (server room, offices, APs)",
      "18.1",
      "≈ 900 m",
      "HELUKAT / DataTuff",
      "€ per 100 m"
     ],
     [
      "21",
      "RJ45 field plugs, metal, IP20",
      "2 per link + 15 %",
      "≈ 300",
      "preLink / IE FC Plug / VS-08",
      "€ (each small)"
     ],
     [
      "22",
      "M12 D-coded cordsets / plugs",
      "machine-mounted devices",
      "≈ 80",
      "Murrelektronik / Phoenix / Harting",
      "€"
     ],
     [
      "23",
      "M12 X-coded cordsets (cameras, Gbit)",
      "",
      "≈ 10",
      "",
      "€"
     ],
     [
      "24",
      "Shielded patch cords 0.5 – 3 m",
      "",
      "≈ 150",
      "",
      "€"
     ],
     [
      "25",
      "42U server racks (OT core, DMZ) with PDU",
      "",
      "2",
      "",
      "€€"
     ],
     [
      "26",
      "Field network cabinets IP54 with 24 V PSU + DC-UPS",
      "4 distribution points",
      "4",
      "Rittal / similar + PSU/UPS",
      "€€"
     ],
     [
      "27",
      "Cable certifier (rent) + fibre test (installer)",
      "32",
      "rent / service",
      "DSX / CertiFiber",
      "(service)"
     ],
     [
      "28",
      "PROFINET diagnostic switch for the FMS cell",
      "34.11",
      "1",
      "PROmesh",
      "€€"
     ],
     [
      "29",
      "Service laptop with Wireshark, PRONETA, iperf3, nmap, OPC UA client, MQTT client (offline installers)",
      "30",
      "1 – 2",
      "",
      "€"
     ],
     [
      "30",
      "Site survey (before and after)",
      "28.2, T-N12",
      "1 + 1",
      "service",
      "€€"
     ]
    ],
    "m": 4,
    "p": 5,
    "w": [
     4,
     24,
     24,
     8,
     26,
     14
    ]
   }
  ],
  "shopTab": "Shopping list – factory network",
  "shopLbl": "shopping list",
  "shopTitle": "Shopping list – factory network (example quantities) – guide 07 §35.",
  "price": "Price classes (guide 07, per item, without engineering): € < 1 k€ · €€ 1 – 5 k€ · €€€ 5 – 20 k€ · €€€€ > 20 k€ – estimate, ask for a quote. Prefer one switch family.",
  "shopNote": "Network design rules (zones, rings, VLANs, IP plan): guide 07 – the drawings of this card.",
  "ph": "(e.g. SCALANCE, Hirschmann, Moxa, fibre, OPC UA, Fluke)"
 },
 "cnc": {
  "guide": "guide 08",
  "drawings": [
   {
    "f": "08_cutter_compensation.svg",
    "c": "Cutter radius compensation G41 / G42 – outside contour 140 × 100 R10 with an end mill Ø16: part edge (programmed path) …",
    "g": "guide 08 §18.6",
    "t": "Cutter radius compensation G41 / G42"
   },
   {
    "f": "08_coordinate_systems.svg",
    "c": "Coordinate systems on the HMC – machine zero M, work zero W (G54 X −210.000, Z −640.000), tool length H1 185.220 from the gauge line …",
    "g": "guide 08 §18.7",
    "t": "Coordinate systems on the HMC (M, W, H)"
   },
   {
    "f": "08_canned_cycles.svg",
    "c": "Canned cycles – side view of the motion of G81 (drill Ø6.8 to Z−14.04), G83 (peck drill Ø8.5, Q5, Z−22.55), G84 (rigid tap M10 × 1.5, Z−16 …",
    "g": "guide 08 §18.9",
    "t": "Canned cycles G81 / G83 / G84"
   },
   {
    "f": "08_cutting_forces.svg",
    "c": "Cutting forces, power and torque – face milling the cylinder deck with a Ø100 face mill (engagement angle 97.2°, Pc 7.26 kW, 99 N·m), drilling Ø8.5 (1.39 kW, 3.9 N·m …",
    "g": "guide 08 §20.3",
    "t": "Cutting forces, power + torque"
   },
   {
    "f": "08_taylor_tool_life.svg",
    "c": "Taylor tool life chart – log-log plot of tool life against cutting speed for the face mill Ø100 in GG25: test points 180 m/min / 30 min and 250 m/min / 8 min …",
    "g": "guide 08 §22.3",
    "t": "Taylor tool life chart"
   },
   {
    "f": "08_fixture_321.svg",
    "c": "Fixture 3-2-1 for the crankcase – supports A1 A2 A3 under the part, side locators B1 B2, end locator C1, swing clamps over the supports, cutting force 2.4 kN …",
    "g": "guide 08 §23.1",
    "t": "Fixture 3-2-1 for the crankcase"
   },
   {
    "f": "08_cam_workflow.svg",
    "c": "CAM workflow – CAD model and drawing, process plan, CAM programming, post-processor, NC simulation of the G-code, release in PDM/DNC, DNC/OPC UA transfer, CNC machine …",
    "g": "guide 08 §24.1",
    "t": "CAM workflow – CAD to DNC"
   },
   {
    "f": "08_surface_finish.svg",
    "c": "Surface finish – feed marks of a boring insert (Rth = f² / 8r, bearing seat f 0.10 r 0.8 gives 1.56 µm, Ra about 0.40 µm), scallop of a ball-nose cutter (R5 …",
    "g": "guide 08 §27.1",
    "t": "Surface finish – feed marks + scallop"
   }
  ],
  "groups": [
   {
    "id": "g31_1",
    "t": "CNC controls",
    "src": "guide 08 §31.1",
    "rows": [
     [
      "CNC controls",
      "HMC 4 axes (X, Y, Z, B) + spindle, macro B / R parameters, look-ahead smoothing, probing cycles, OPC UA",
      "Siemens SINUMERIK ONE / 828D",
      "see datasheet",
      "€€€ (with the machine)",
      "options: measuring cycles, CYCLE800/TRAORI, tool management, OPC UA, Run MyVirtual Machine"
     ],
     [
      "CNC controls",
      "as above",
      "Fanuc 0i-F Plus / 31i-B5",
      "see datasheet",
      "€€€",
      "options: Custom Macro, AICC II (G05.1), G54.1 P48/P300, dynamic fixture offset, tool life management"
     ],
     [
      "CNC controls",
      "as above",
      "Heidenhain TNC7 / TNC 640",
      "see datasheet",
      "€€€",
      "Klartext + ISO, KinematicsOpt, touch probe cycles"
     ],
     [
      "CNC controls",
      "as above",
      "Mitsubishi M80 / M800",
      "see datasheet",
      "€€ – €€€",
      "ISO dialect options, macro, probing"
     ]
    ]
   },
   {
    "id": "g31_2",
    "t": "CAM software",
    "src": "guide 08 §31.2",
    "rows": [
     [
      "CAM software",
      "2.5D + 3D + 4-axis indexing (3+1) milling, adaptive roughing, drilling cycles, machine simulation, post for our HMC + VMC",
      "Siemens NX CAM",
      "integrated with NX CAD; machine-tool simulation module",
      "€€€ per seat",
      "post-processor for your exact control, simulation module included?, licence type"
     ],
     [
      "CAM software",
      "as above",
      "Autodesk Fusion (Manufacturing Extension) / PowerMill",
      "Fusion: cloud-based licence; PowerMill: strong 3D / 5-axis",
      "€€ – €€€",
      "offline use on the factory PC (offline rule!), post availability"
     ],
     [
      "CAM software",
      "as above",
      "Mastercam (CNC Software)",
      "Dynamic Motion (adaptive)",
      "€€ – €€€",
      "reseller support in your country, post quality"
     ],
     [
      "CAM software",
      "as above",
      "hyperMILL (OPEN MIND)",
      "strong 5-axis, feature technology",
      "€€€",
      "post + \"VIRTUAL Machining\" option"
     ],
     [
      "CAM software",
      "as above",
      "ESPRIT (ESPRIT EDGE, Hexagon) (check)",
      "machine-specific posts, mill-turn",
      "€€€",
      "post for your control"
     ],
     [
      "CAM software",
      "as above",
      "SolidCAM (iMachining)",
      "integrated in SOLIDWORKS / Inventor",
      "€€ – €€€",
      "needs the CAD host"
     ],
     [
      "CAM software",
      "Free / training",
      "FreeCAD CAM workbench (formerly \"Path\") (check)",
      "open source, offline",
      "free",
      "not for production without a validated post and simulation"
     ]
    ]
   },
   {
    "id": "g31_3",
    "t": "NC simulation and verification",
    "src": "guide 08 §31.3",
    "rows": [
     [
      "NC simulation and verification",
      "G-code simulation with machine kinematics, control emulation (Fanuc / Siemens cycles and macros), collision, stock compare, optimisation",
      "CGTech VERICUT",
      "machine model + control file per machine; optional force-based feed optimisation",
      "€€€",
      "machine model available from the builder? control emulation for your options"
     ],
     [
      "NC simulation and verification",
      "as above",
      "NCSIMUL (Hexagon) (check)",
      "G-code simulation, optimisation",
      "€€€",
      "as above"
     ],
     [
      "NC simulation and verification",
      "CAM-integrated simulation (often ModuleWorks-based kernels)",
      "inside NX / hyperMILL / Mastercam / Fusion",
      "simulates CAM output; some read the G-code",
      "(in the CAM licence or option)",
      "does it simulate the post output or only the tool path?"
     ],
     [
      "NC simulation and verification",
      "Virtual control (real NC kernel on a PC)",
      "Siemens SINUMERIK Run MyVirtual Machine / Create MyVirtual Machine (check); Fanuc NCGuide (check)",
      "real control software → exact cycles and times",
      "€€ – €€€",
      "licence, machine data from the builder"
     ],
     [
      "NC simulation and verification",
      "Training",
      "the twin's CNC tab (web/gcode.js)",
      "material-removal check, alarms, no fixture",
      "free (in house)",
      "see chapter 8 limits"
     ]
    ]
   },
   {
    "id": "g31_4",
    "t": "DNC, program management and tool data management",
    "src": "guide 08 §31.4",
    "rows": [
     [
      "DNC, program management and tool data management",
      "DNC server for ≈ 8 machines (3 HMC, VMC, hone, lathe …): Ethernet + RS-232, revision control, compare, release workflow",
      "CIMCO DNC-Max (+ CIMCO NC-Base for program management, CIMCO MDC-Max for machine data)",
      "see datasheet",
      "€€",
      "interfaces to your controls, user rights, MES interface"
     ],
     [
      "DNC, program management and tool data management",
      "as above",
      "Siemens SINUMERIK Integrate – Manage MyPrograms (check – product line changes)",
      "for SINUMERIK fleets",
      "€€ – €€€",
      "current product name and support"
     ],
     [
      "DNC, program management and tool data management",
      "as above",
      "Predator DNC / PDM",
      "see datasheet",
      "€€",
      "as above"
     ],
     [
      "DNC, program management and tool data management",
      "Tool data management (tool library, assemblies, ISO 13399 import, presetter link, CAM link)",
      "TDM Systems (Sandvik) TDM; Zoller TMS tool management",
      "see datasheet",
      "€€ – €€€",
      "CAM interface, presetter interface, MES interface"
     ]
    ]
   },
   {
    "id": "g31_5",
    "t": "Cutting tools",
    "src": "guide 08 §31.5",
    "rows": [
     [
      "Cutting tools",
      "Face mill Ø100, 45°, K-grade inserts, wiper option (21.3)",
      "Sandvik Coromant CoroMill 345; Seco Double Octomill; Iscar HELIDO / S845 family (check); Walter, Kennametal, Mitsubishi Materials 45° face mills",
      "inserts and grades: see catalogue",
      "€€ body, € inserts",
      "grade for GJL (K15–K25), pitch (coarse/close), wiper"
     ],
     [
      "Cutting tools",
      "Solid carbide end mills Ø12/Ø16, 4–6 flutes, variable helix (21.3)",
      "Sandvik CoroMill Plura; Seco Jabro; Kennametal HARVI; Walter, Iscar, Mitsubishi Materials, Guhring",
      "see catalogue",
      "€",
      "corner radius, flute length for adaptive (2 × D), coating"
     ],
     [
      "Cutting tools",
      "Solid carbide drills Ø6.8 / Ø8.5, internal coolant, 5 × D (21.4)",
      "Sandvik CoroDrill 860; Guhring RT 100 family; Walter (Xtreme family); Kennametal, Seco, Mitsubishi Materials, Iscar",
      "see catalogue",
      "€",
      "point angle (depth calculation!), coolant holes, length"
     ],
     [
      "Cutting tools",
      "Exchangeable-tip / indexable drills Ø12–40 (21.4)",
      "Sandvik CoroDrill 870 / 880; Iscar SUMOCHAM / CHAMDRILL; Kennametal KenTIP",
      "see catalogue",
      "€€ body",
      "stiffness / power needed"
     ],
     [
      "Cutting tools",
      "Taps M8 / M10 straight flute for GJL (21.5)",
      "Emuge (Rekord, Enorm families); Walter Prototyp; Guhring; OSG; Sandvik CoroTap",
      "see catalogue",
      "€",
      "tolerance 6H, coating, blind/through"
     ],
     [
      "Cutting tools",
      "Thread mills M8–M12 (20.7)",
      "Emuge, Sandvik CoroMill Plura thread mills, Walter Prototyp, Seco, Guhring",
      "see catalogue",
      "€ – €€",
      "min. hole Ø, thread length per pass"
     ],
     [
      "Cutting tools",
      "Rough boring heads Ø25–200, twin edge; fine boring heads with digital adjustment (21.6)",
      "BIG KAISER (EWN / EWD fine boring heads, rough boring heads); Sandvik CoroBore 820 / 825; Seco (EPB system); Kennametal (Romicron) (check)",
      "adjustment 1–2 µm on Ø",
      "€€ per head",
      "modular connection (one system), range, balancing"
     ],
     [
      "Cutting tools",
      "Damped boring bars (21.6)",
      "Sandvik Silent Tools; Seco Steadyline; Kennametal",
      "L/D up to 10–14 (see catalogue)",
      "€€",
      "interface, length"
     ],
     [
      "Cutting tools",
      "PCD tools for the Al variant (21.2)",
      "most makers above + specialist PCD grinders",
      "see quote",
      "€€",
      "tool life vs carbide, regrind service"
     ]
    ]
   },
   {
    "id": "g31_6",
    "t": "Tool holders",
    "src": "guide 08 §31.6",
    "rows": [
     [
      "Tool holders",
      "Shrink-fit chucks HSK-A63, Ø6–20, run-out ≤ 3 µm, balanced G2.5 @ 25 000 rpm-class",
      "Haimer (Power Shrink Chuck, Safe-Lock), Schunk CELSIO, BIG KAISER, Kennametal, Sandvik, Rego-Fix",
      "see catalogue",
      "€ each",
      "coolant (through / along the tool), length variants, balance grade"
     ],
     [
      "Tool holders",
      "Hydraulic chucks",
      "Schunk TENDO, BIG KAISER, Kennametal, Sandvik CoroChuck 930",
      "run-out ≤ 3 µm (see catalogue)",
      "€ each",
      "min. clamping length, torque"
     ],
     [
      "Tool holders",
      "Polygon chucks",
      "Schunk TRIBOS",
      "see catalogue",
      "€ each",
      "needs the polygon press"
     ],
     [
      "Tool holders",
      "Milling chucks / high-torque",
      "BIG KAISER (Mega / HMC chucks) (check), Haimer Power Mill Chuck (check)",
      "see catalogue",
      "€ each",
      "–"
     ],
     [
      "Tool holders",
      "ER collet chucks, tap collets",
      "Rego-Fix (ER, powRgrip), Schunk, BIG KAISER",
      "collet quality class",
      "€",
      "collet class (run-out)"
     ],
     [
      "Tool holders",
      "Shell mill arbors for Ø100 face mill",
      "all makers",
      "–",
      "€",
      "balancing, coolant"
     ],
     [
      "Tool holders",
      "Shrink machine (induction)",
      "Haimer Power Clamp, Zoller »redomatic«, Schunk, BIG KAISER",
      "see datasheet",
      "€€ – €€€",
      "cooling, length presetting combined"
     ],
     [
      "Tool holders",
      "Holder balancing machine",
      "Haimer Tool Dynamic, Schenck, Zoller (check)",
      "see datasheet",
      "€€€",
      "needed if > 8 000 rpm and long tools"
     ]
    ]
   },
   {
    "id": "g31_7",
    "t": "Tool presetting",
    "src": "guide 08 §31.7",
    "rows": [
     [
      "Tool presetting",
      "Presetter for HSK-A63 / BT40, Ø up to ≈ 400, length ≈ 400–600, camera, label / RFID / network output to the controls",
      "Zoller smile (entry/mid), Zoller venturion (high end)",
      "see datasheet",
      "€€ – €€€",
      "spindle adapters, post-processor to the control (offset file format), RFID (Balluff)"
     ],
     [
      "Tool presetting",
      "as above",
      "Haimer Microset (UNO, VIO)",
      "see datasheet",
      "€€",
      "–"
     ],
     [
      "Tool presetting",
      "as above",
      "Speroni presetters",
      "see datasheet",
      "€€ – €€€",
      "–"
     ],
     [
      "Tool presetting",
      "as above",
      "Kelch (Kenova) (check)",
      "see datasheet",
      "€€",
      "–"
     ]
    ]
   },
   {
    "id": "g31_8",
    "t": "Probes and tool setters",
    "src": "guide 08 §31.8",
    "rows": [
     [
      "Probes and tool setters",
      "Spindle probe, radio, strain gauge (HMC with tombstone – no line of sight)",
      "Renishaw RMP600",
      "repeatability: see datasheet",
      "€€",
      "receiver (RMI-QE), control interface, macro software (Inspection Plus / Productivity+)"
     ],
     [
      "Probes and tool setters",
      "Spindle probe, optical (VMC)",
      "Renishaw OMP400 / OMP60",
      "see datasheet",
      "€€",
      "receiver (OMI-2), line of sight"
     ],
     [
      "Probes and tool setters",
      "Spindle probe (other makers)",
      "Blum TC series (e.g. TC50/TC52/TC60) (check); Marposs WRP / VOP series (check); Heidenhain TS 460 / TS 760",
      "see datasheet",
      "€€",
      "interface to your control"
     ],
     [
      "Probes and tool setters",
      "Contact tool setter",
      "Renishaw OTS (wireless) / TS27R (cable); Blum Z-Nano (check); Heidenhain TT 460",
      "see datasheet",
      "€ – €€",
      "mounting on the HMC table (chips!), stylus"
     ],
     [
      "Probes and tool setters",
      "Laser tool setter / breakage",
      "Renishaw NC4, TRS2 (breakage); Blum LaserControl (NT / Nano NT); Marposs Mida Laser (check)",
      "see datasheet",
      "€€",
      "air supply, protection against coolant, cycle software"
     ],
     [
      "Probes and tool setters",
      "Ring gauges for probe calibration",
      "certified setting rings (e.g. Ø50) from gauge makers (Mahr, Bowers, …)",
      "certificate",
      "€",
      "calibration interval"
     ]
    ]
   },
   {
    "id": "g31_9",
    "t": "Fixtures and workholding",
    "src": "guide 08 §31.9",
    "rows": [
     [
      "Fixtures and workholding",
      "Hydraulic swing clamps, work supports, sequence valves, pressure switches, rotary unions",
      "Roemheld (with Hilma / Stark in the group); AMF (Andreas Maier); Kosmek; Enerpac (workholding)",
      "force diagrams in the catalogue",
      "€ each",
      "force at the arm vs pressure, stroke, swing direction, mounting type"
     ],
     [
      "Fixtures and workholding",
      "Zero-point clamping for fixture bases (guide 09)",
      "Schunk VERO-S; AMF Zero Point System; Lang Quick-Point; Roemheld Stark",
      "holding force: see datasheet",
      "€ – €€ per module",
      "repeatability, pull-in force, pneumatic / hydraulic release"
     ],
     [
      "Fixtures and workholding",
      "Tombstones (2- / 4-sided) for HMC 500 pallets",
      "Gerardi; Schunk; AMF; local fixture makers",
      "see datasheet",
      "€€ – €€€",
      "pallet interface, height vs HMC travel, mass"
     ],
     [
      "Fixtures and workholding",
      "Vices, modular fixtures (prototypes, small lots)",
      "Lang Makro-Grip; Schunk (KONTEC / TANDEM); Gerardi; Kurt",
      "see datasheet",
      "€ – €€",
      "jaw types, zero-point base"
     ],
     [
      "Fixtures and workholding",
      "Custom hydraulic fixture for the crankcase (3-2-1, 23.2)",
      "fixture builders (Roemheld / AMF engineering service, local builders)",
      "design to your calculation",
      "€€€ per fixture",
      "clamping force calculation, collision model (STEP), FAT with first casting"
     ],
     [
      "Fixtures and workholding",
      "Hydraulic power unit / pallet coupling",
      "Roemheld, AMF, Hydac",
      "see datasheet",
      "€€",
      "pressure, accumulator, guide 30 circuits"
     ]
    ]
   },
   {
    "id": "g31_10",
    "t": "Coolant, MQL and monitoring",
    "src": "guide 08 §31.10",
    "rows": [
     [
      "Coolant, MQL and monitoring",
      "Emulsion concentrate for GJL + steel + Al",
      "Blaser Swisslube, Fuchs (Ecocool), Castrol (Hysol / Alusol), Houghton (Quaker Houghton)",
      "refractometer factor on the product sheet",
      "€ per drum",
      "approvals of the machine builder, skin compatibility"
     ],
     [
      "Coolant, MQL and monitoring",
      "Refractometer (digital)",
      "gauge makers (e.g. Atago) (check)",
      "Brix scale",
      "€",
      "factor of the product"
     ],
     [
      "Coolant, MQL and monitoring",
      "MQL system (Al variant)",
      "SKF LubriLean; Bielomatik (check); Unist",
      "see datasheet",
      "€€",
      "one- or two-channel, through spindle"
     ],
     [
      "Coolant, MQL and monitoring",
      "Tool / process monitoring (spindle power)",
      "Marposs ARTIS / Genior Modular; Nordmann; control built-in functions",
      "see datasheet",
      "€€ per machine",
      "sensor type, teach-in, PLC interface"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "#",
     "Item",
     "Spec (chapter)",
     "Qty",
     "Price class",
     "Note"
    ],
    "rows": [
     [
      "1",
      "CAM seats with 3+1 milling, adaptive, machine simulation",
      "31.2",
      "2 (programmer + backup)",
      "€€€ each",
      "must run offline on the factory network"
     ],
     [
      "2",
      "Post-processors, verified (HMC type, VMC type)",
      "24.4",
      "2",
      "€€ each",
      "test program (Step 4) included in the order"
     ],
     [
      "3",
      "G-code simulation seat with HMC + VMC models",
      "31.3",
      "1",
      "€€€",
      "machine models from the builder"
     ],
     [
      "4",
      "DNC / program management server licence (≈ 8 machines)",
      "31.4",
      "1",
      "€€",
      "release workflow, compare"
     ],
     [
      "5",
      "Tool data management",
      "31.4",
      "1",
      "€€ – €€€",
      "link presetter ↔ CAM ↔ controls"
     ],
     [
      "6",
      "Presetter with network output + RFID option",
      "31.7",
      "1",
      "€€€",
      "in the tool room"
     ],
     [
      "7",
      "Induction shrink machine",
      "31.6",
      "1",
      "€€",
      "–"
     ],
     [
      "8",
      "Holder balancing machine (optional)",
      "31.6",
      "0–1",
      "€€€",
      "if > 8 000 rpm tools"
     ],
     [
      "9",
      "Spindle probes (radio for HMCs, optical for VMC) + receivers + macro software",
      "31.8",
      "3 + 1",
      "€€ each",
      "include probing training"
     ],
     [
      "10",
      "Tool setters (laser or contact) incl. breakage check",
      "31.8",
      "4",
      "€€ each",
      "one per machine"
     ],
     [
      "11",
      "HSK-A63 holders (shrink, hydraulic, arbors, tap holders)",
      "31.6",
      "≈ 105 (3 machines × ≈ 32 incl. sister tools + 10 % spare)",
      "€ each",
      "12 tools × 2 models × 1.3 sister factor ≈ 31–32 per HMC"
     ],
     [
      "12",
      "Cutting tools first fill (21.9 list × 2 models × 3 machines) + 3 months consumption",
      "31.5",
      "per tool list",
      "€€ – €€€ total",
      "blanket order with the tool supplier, consignment stock"
     ],
     [
      "13",
      "Fine boring heads + rough boring heads (bearing seats)",
      "31.5",
      "3 + 3 (one set per HMC) + 1 spare",
      "€€ each",
      "digital fine boring heads"
     ],
     [
      "14",
      "Hydraulic crankcase fixtures (3-2-1) per model",
      "31.9",
      "2 pallets × 3 HMC = 6 bases + model-specific locator sets",
      "€€€ each",
      "clamping calculation 23.2, FAT with castings"
     ],
     [
      "15",
      "Zero-point modules on pallets",
      "31.9",
      "per fixture (guide 09)",
      "€ – €€ each",
      "–"
     ],
     [
      "16",
      "Hydraulic power units / pallet couplings",
      "31.9",
      "per guide 09 / 30",
      "€€",
      "pressure switches to the PLC"
     ],
     [
      "17",
      "Setting rings, thread plug gauges M8 / M10 6H, bore gauges, air gauge Ø62 K7",
      "27.3",
      "per gauge list",
      "€ – €€ each",
      "calibration labels (chapter 12)"
     ],
     [
      "18",
      "Coolant concentrate first fill, refractometer, dip slides",
      "31.10",
      "1 set",
      "€ – €€",
      "–"
     ],
     [
      "19",
      "Tool / process monitoring (optional)",
      "31.10",
      "0–3",
      "€€ each",
      "start with the control's load monitoring"
     ],
     [
      "20",
      "Training: CAM, post, probing macros, simulation",
      "–",
      "1 package",
      "€€",
      "before the first prove-out"
     ]
    ],
    "m": 1,
    "p": 4,
    "w": [
     4,
     26,
     22,
     10,
     12,
     26
    ]
   }
  ],
  "shopTab": "Shopping list – tooling + software",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – tooling and software for the crankcase machining cell – guide 08 §32.",
  "price": "Price classes (guide 08, per item or licence): € < 1 000 € · €€ 1 000 – 10 000 € · €€€ 10 000 – 50 000 € · €€€€ > 50 000 € – estimate, ask for a quote.",
  "shopNote": "CNC controls in detail: guide 12 M12 / M16.4 (HMC build tab card).",
  "ph": "(e.g. Sandvik, HSK-A63, Zoller, Renishaw, Mastercam, VERICUT)"
 },
 "mech1": {
  "guide": "guide 10",
  "drawings": [
   {
    "f": "10_shaft_fatigue.svg",
    "c": "Sprocket shaft – loads, moment diagram, notch factors and Haigh / Goodman diagram",
    "g": "guide 10 §18.6",
    "t": "Sprocket shaft – fatigue (Haigh / Goodman)"
   },
   {
    "f": "10_gear_belt_drive.svg",
    "c": "Spur gear geometry and belt drive forces",
    "g": "guide 10 §22.1",
    "t": "Spur gear geometry + belt drive forces"
   },
   {
    "f": "10_bolted_welded_joint.svg",
    "c": "Bolted joint diagram (VDI 2230 idea), fillet weld throat and FAT fatigue curves",
    "g": "guide 10 §27",
    "t": "Bolted joint (VDI 2230) + weld fatigue"
   },
   {
    "f": "10_tolerance_stackup.svg",
    "c": "Tolerance stack-up – pull stud position over the receiver when the pallet stops",
    "g": "guide 10 §29",
    "t": "Tolerance stack-up – pull stud over the receiver"
   },
   {
    "f": "10_shock_absorber.svg",
    "c": "Shock absorber sizing – energy vs speed, force vs stroke",
    "g": "guide 10 §30",
    "t": "Shock absorber sizing"
   },
   {
    "f": "10_pneumatic_cylinder.svg",
    "c": "Pneumatic cylinder ISO 15552 – forces, air consumption and a basic circuit",
    "g": "guide 10 §31",
    "t": "Pneumatic cylinder ISO 15552"
   },
   {
    "f": "10_material_chart.svg",
    "c": "Material chart – yield strength vs density and relative cost",
    "g": "guide 10 §32",
    "t": "Material chart – strength vs density vs cost"
   },
   {
    "f": "10_station_assembly.svg",
    "c": "Typical station – pallet transfer station item 1, element map",
    "g": "guide 10 §35",
    "t": "Pallet transfer station – element map"
   }
  ],
  "groups": [
   {
    "id": "x36_1",
    "t": "Rolling bearings and housed units",
    "src": "guide 10 §36.1",
    "rows": [
     [
      "Rolling bearings and housed units",
      "housed insert bearing Ø25, square flange, sealed (sprocket shaft)",
      "SKF FY 25 TF (insert YAR 205-2F)",
      "YAR 205-2F: C = 14 kN, C₀ = 7.8 kN (SKF catalogue)",
      "€ – €€",
      "locking (set screw vs eccentric collar), seals for dust, relubrication"
     ],
     [
      "Rolling bearings and housed units",
      "as above",
      "NSK UCF205, NTN UCF205, Schaeffler (INA) flanged units RCJ / PCJ 25, Timken (Fafnir) housed units",
      "see datasheet",
      "€ – €€",
      "interchangeability of housings (UCF hole pattern)"
     ],
     [
      "Rolling bearings and housed units",
      "deep groove ball bearing 25 × 52 × 15",
      "SKF / Schaeffler (FAG) / NSK / NTN 6205-2RS",
      "6205: C = 14.8 kN, C₀ = 7.8 kN (SKF)",
      "€",
      "seal type, clearance C3 if hot"
     ],
     [
      "Rolling bearings and housed units",
      "tapered roller pair for heavy pivots",
      "Timken, SKF, Schaeffler 302.. / 322.. series",
      "see datasheet",
      "€ – €€",
      "adjustment method, preload"
     ],
     [
      "Rolling bearings and housed units",
      "stainless housed units near coolant",
      "SKF Food Line, NSK Molded-Line, NTN stainless UC",
      "see datasheet",
      "€€",
      "grease, IP rating"
     ],
     [
      "Rolling bearings and housed units",
      "track rollers / cam followers",
      "Schaeffler (INA) KR / NUTR, McGill, THK CF",
      "see datasheet",
      "€ – €€",
      "counter-surface hardness"
     ]
    ]
   },
   {
    "id": "x36_2",
    "t": "Linear guides, guide columns, ball screws",
    "src": "guide 10 §36.2",
    "rows": [
     [
      "Linear guides, guide columns, ball screws",
      "linear ball bushing Ø25, flanged, sealed (lift frame)",
      "Bosch Rexroth linear bushings, Ewellix (ex SKF linear) LBCR / LBBR, NB, Misumi flanged linear bushings",
      "see datasheet (C, C₀, seals)",
      "€ – €€",
      "shaft hardness ≥ 60 HRC, h6 shaft, seals"
     ],
     [
      "Linear guides, guide columns, ball screws",
      "hardened shaft Ø25 h6",
      "Bosch Rexroth, Ewellix, Misumi, HIWIN",
      "60 HRC typical",
      "€ – €€",
      "straightness, chrome option"
     ],
     [
      "Linear guides, guide columns, ball screws",
      "profile rail size 25",
      "THK HSR25, HIWIN HGH25, Bosch Rexroth ball rail size 25, Schaeffler KUVE25, NSK NH25",
      "see datasheet",
      "€€ – €€€",
      "preload class, accuracy class, C₅₀ vs C₁₀₀"
     ],
     [
      "Linear guides, guide columns, ball screws",
      "plain bush (dirty areas)",
      "igus iglidur, GGB (DU / DX), Schaeffler ELGES",
      "see datasheet",
      "€",
      "p·v value, shaft surface"
     ],
     [
      "Linear guides, guide columns, ball screws",
      "ball screw",
      "link guide 12 M16",
      "–",
      "–",
      "–"
     ]
    ]
   },
   {
    "id": "x36_3",
    "t": "Gear motors and gearboxes",
    "src": "guide 10 §36.3",
    "rows": [
     [
      "Gear motors and gearboxes",
      "helical-bevel gear motor 0.25 kW, ≈ 44 rpm, brake, IE3",
      "SEW-EURODRIVE K series (helical-bevel), NORD UNICASE helical-bevel, Bonfiglioli A series, Siemens SIMOGEAR",
      "see datasheet",
      "€€ – €€€",
      "service factor f_B ≥ 1.2, overhung load F_Ra, brake torque, IP65"
     ],
     [
      "Gear motors and gearboxes",
      "helical in-line / parallel shaft",
      "SEW R / F series, NORD SK helical, Bonfiglioli C / F series",
      "see datasheet",
      "€€ – €€€",
      "mounting position, oil quantity"
     ],
     [
      "Gear motors and gearboxes",
      "worm gear motor (cheap, low duty)",
      "SEW S series, NORD SMI universal worm, Bonfiglioli VF / W",
      "see datasheet",
      "€€",
      "efficiency 0.5–0.8, NOT a brake (§22.3)"
     ],
     [
      "Gear motors and gearboxes",
      "large industrial gear units",
      "Flender (FLENDER ONE, planetary), SEW X series",
      "see datasheet",
      "€€€€",
      "–"
     ],
     [
      "Gear motors and gearboxes",
      "low-backlash planetary for servo axes",
      "WITTENSTEIN alpha SP+ / TP+ / NP / CP, Neugart PLE / PLN / PLFE",
      "backlash classes from ≈ 1 arcmin (premium) to ≈ 8–15 arcmin (economy) – see datasheet",
      "€€ – €€€",
      "input speed, torsional stiffness, motor adapter"
     ]
    ]
   },
   {
    "id": "x36_4",
    "t": "Couplings and torque limiters",
    "src": "guide 10 §36.4",
    "rows": [
     [
      "Couplings and torque limiters",
      "jaw coupling gear motor ↔ shaft, T_KN ≥ 28 N·m",
      "KTR ROTEX (spider 92 / 98 Sh A), R+W EK, Mayr ROBA-ES",
      "see datasheet",
      "€ – €€",
      "T_KN, T_K,max, bores + clamping hubs, misalignment"
     ],
     [
      "Couplings and torque limiters",
      "bellows coupling (servo)",
      "R+W BK, KTR TOOLFLEX, Mayr ROBA-DS (disc)",
      "see datasheet",
      "€€",
      "torsional stiffness, moment of inertia"
     ],
     [
      "Couplings and torque limiters",
      "disc pack coupling (high torque)",
      "Mayr ROBA-DS, Rexnord (Regal Rexnord) Thomas disc couplings, KTR RADEX-N",
      "see datasheet",
      "€€ – €€€",
      "misalignment per pack, spacer length"
     ],
     [
      "Couplings and torque limiters",
      "elastomer tyre / Omega coupling",
      "Rexnord Omega, Fenner (Regal) tyre couplings",
      "see datasheet",
      "€€",
      "radial split for service"
     ],
     [
      "Couplings and torque limiters",
      "friction slip hub 42 N·m",
      "Mayr ROBA-slip hub, KTR SYNTEX FC (friction)",
      "see datasheet (setting range)",
      "€€",
      "setting, wear, slip monitor"
     ],
     [
      "Couplings and torque limiters",
      "ball-detent safety clutch",
      "Mayr EAS-compact, R+W SK, KTR SYNTEX",
      "see datasheet",
      "€€ – €€€",
      "re-engagement angle, switch"
     ]
    ]
   },
   {
    "id": "x36_5",
    "t": "Clamping elements",
    "src": "guide 10 §36.5",
    "rows": [
     [
      "Clamping elements",
      "taper locking element Ø20–Ø40 (sprockets in phase)",
      "Ringfeder RfN 7012 / 7013 / 7015, Tollok TLK series, KTR CLAMPEX (KTR 100 … 250 types), Fenner B-LOC",
      "T, F_a, p_shaft, p_hub, screw torque – see datasheet",
      "€ – €€",
      "hub wall thickness (p_hub vs hub yield), centring (self-centring type?), shaft/hub tolerance"
     ],
     [
      "Clamping elements",
      "shrink disc (hollow shaft gear motors)",
      "Ringfeder RfN 4071, Stüwe, Tollok",
      "see datasheet",
      "€€",
      "torque, hollow-shaft tolerance"
     ]
    ]
   },
   {
    "id": "x36_6",
    "t": "Belts, chains, sprockets",
    "src": "guide 10 §36.6",
    "rows": [
     [
      "Belts, chains, sprockets",
      "roller chain 10B-1 / 08B-1 ISO 606",
      "iwis (e.g. MEGALIFE lube-free), Renold Synergy / Syno, Tsubaki, Rexnord",
      "10B-1 breaking force ≈ 22.2 kN, 08B-1 ≈ 17.8 kN (ISO 606 minimum)",
      "€ (per m)",
      "breaking force of the exact chain, lube-free option for dust"
     ],
     [
      "Belts, chains, sprockets",
      "sprockets z17 / z19 hardened teeth",
      "iwis, Renold, Tsubaki, Misumi, Mädler",
      "see datasheet",
      "€",
      "hub type (pilot bore / taper bush), tooth hardening"
     ],
     [
      "Belts, chains, sprockets",
      "toothed belt HTD 8M / GT",
      "Gates PowerGrip HTD / GT3 / Poly Chain GT Carbon, ContiTech CONTI SYNCHROBELT HTD, Optibelt OMEGA",
      "see datasheet (power and tension tables)",
      "€ – €€",
      "width from the maker's program, pretension value, pulley flanges"
     ],
     [
      "Belts, chains, sprockets",
      "V-belts",
      "Gates, ContiTech, Optibelt SK",
      "see datasheet",
      "€",
      "tension, pulley groove"
     ],
     [
      "Belts, chains, sprockets",
      "chain guide strips UHMW-PE",
      "Murtfeldt, Röchling, igus",
      "–",
      "€",
      "profile for the chain size"
     ],
     [
      "Belts, chains, sprockets",
      "chain tensioners",
      "Rosta (rubber tensioners), SKF, Misumi",
      "see datasheet",
      "€",
      "force, range"
     ]
    ]
   },
   {
    "id": "x36_7",
    "t": "Brakes and clutches",
    "src": "guide 10 §36.7",
    "rows": [
     [
      "Brakes and clutches",
      "spring-applied brake on the gear motor",
      "built-in brake of the gear motor maker (SEW BE, NORD BRE)",
      "see datasheet",
      "(option)",
      "torque, release monitoring, manual release"
     ],
     [
      "Brakes and clutches",
      "separate spring-applied brake",
      "Mayr ROBA-stop-M, Kendrion spring-applied brakes, Warner Electric",
      "see datasheet",
      "€€",
      "friction work per stop and per hour, voltage, IP"
     ],
     [
      "Brakes and clutches",
      "safety brake for vertical axes (with test)",
      "Mayr ROBA-stop-silenzio / ROBA-linearstop, Kendrion",
      "see datasheet",
      "€€ – €€€",
      "certified for safety function, brake test"
     ],
     [
      "Brakes and clutches",
      "electromagnetic clutch / clutch-brake",
      "Warner Electric, Kendrion, Mayr ROBA-quick",
      "see datasheet",
      "€€",
      "switching work, response time"
     ]
    ]
   },
   {
    "id": "x36_8",
    "t": "Springs",
    "src": "guide 10 §36.8",
    "rows": [
     [
      "Springs",
      "compression spring d 4, D 32, n 8, L₀ 77 (deck centring)",
      "Lesjöfors stock springs, Gutekunst Federn (catalogue + online calculator), Associated Spring Raymond",
      "rate, L₀, solid length – see datasheet",
      "€",
      "wire grade (EN 10270-1 DH / stainless), ends ground, shot peening"
     ],
     [
      "Springs",
      "disc springs",
      "Schnorr (DIN EN 16983 / 16979), Mubea",
      "see datasheet",
      "€",
      "stacking, guide clearance, coating"
     ],
     [
      "Springs",
      "gas springs",
      "Stabilus, Bansbach, SUSPA",
      "see datasheet",
      "€ – €€",
      "force at 20 °C, end fittings"
     ],
     [
      "Springs",
      "spring plungers / ball plungers",
      "Kipp, Ganter, norelem, Misumi",
      "see datasheet",
      "€",
      "end force, locking thread"
     ]
    ]
   },
   {
    "id": "x36_9",
    "t": "Shock absorbers and buffers",
    "src": "guide 10 §36.9",
    "rows": [
     [
      "Shock absorbers and buffers",
      "self-compensating absorber ≥ 36 J/stroke, m_e ≥ 1450 kg, stroke 25 (retractable stop)",
      "ACE (MC / magnum series), Enidine (ECO / OEM series), Weforma (WE series)",
      "energy per stroke, energy per hour, m_e range – see datasheet",
      "€ – €€",
      "m_e range covers both creep and fault cases, side load, stop collar"
     ],
     [
      "Shock absorbers and buffers",
      "AGV buffer absorbers 2 × ≥ 33 J",
      "same makers, larger thread",
      "see datasheet",
      "€€",
      "mounting thread M25 / M33, PU pad behind"
     ],
     [
      "Shock absorbers and buffers",
      "PU / elastomer buffers",
      "ACE TUBUS, Enidine, Misumi urethane stoppers",
      "see datasheet",
      "€",
      "energy, compression set"
     ],
     [
      "Shock absorbers and buffers",
      "heavy-duty stop for pallet conveyors",
      "Bosch Rexroth stop gates VE (transfer systems), Asutec heavy-duty stoppers, Festo stopper cylinders DFST",
      "see datasheet (permitted impact mass × speed)",
      "€€",
      "impact energy incl. chain push, sensors"
     ]
    ]
   },
   {
    "id": "x36_10",
    "t": "Index and locating elements",
    "src": "guide 10 §36.10",
    "rows": [
     [
      "Index and locating elements",
      "index plunger Ø8–Ø12",
      "Ganter GN 617 (indexing plunger), Kipp indexing plungers, Halder indexing plungers, norelem indexing plungers",
      "see datasheet (lateral load)",
      "€",
      "lateral load of the body, rest position, locking"
     ],
     [
      "Index and locating elements",
      "locating pins, diamond pins, bushes",
      "Halder, norelem, Kipp, Misumi, Jergens",
      "see datasheet",
      "€",
      "tolerance class, hardness"
     ],
     [
      "Index and locating elements",
      "dowel pins ISO 8734 m6, ISO 8735 (internal thread)",
      "Würth, Bossard, Misumi, Fabory",
      "–",
      "€",
      "m6 vs h6, hardened"
     ],
     [
      "Index and locating elements",
      "zero-point modules, pallets",
      "link guide 09 §28 (SCHUNK, AMF, Stark, Röhm, Erowa)",
      "–",
      "–",
      "–"
     ],
     [
      "Index and locating elements",
      "ball transfer units (floating deck)",
      "Alwayse, Omnitrack, Misumi",
      "see datasheet (load per unit, counter surface)",
      "€",
      "counter-surface hardness (§10.4)"
     ]
    ]
   },
   {
    "id": "x36_11",
    "t": "Pneumatics",
    "src": "guide 10 §36.11",
    "rows": [
     [
      "Pneumatics",
      "ISO 15552 cylinder Ø50 × 100 with cushions and sensor slots",
      "Festo DSBC, SMC CP96, Parker P1F, AVENTICS (Emerson) PRA",
      "see datasheet",
      "€€",
      "cushion energy, sensor type, rod end"
     ],
     [
      "Pneumatics",
      "compact cylinder ISO 21287 (lock pin Ø32)",
      "Festo ADN, SMC C55, Parker P1P, AVENTICS CCI",
      "see datasheet",
      "€ – €€",
      "stroke, guided version if side load"
     ],
     [
      "Pneumatics",
      "5/2 valves / valve terminal",
      "Festo VUVG / VTUG, SMC SY / JSY, Parker Moduflex, AVENTICS ES05 / AV03",
      "standard flow ≥ 350 Nl/min for Ø50 at 0.5 s",
      "€€ – €€€",
      "fieldbus / IO-Link, manual override"
     ],
     [
      "Pneumatics",
      "one-way flow control (meter-out)",
      "Festo GRLA, SMC AS, Parker, AVENTICS",
      "see datasheet",
      "€",
      "thread, adjustment lock"
     ],
     [
      "Pneumatics",
      "FRL + soft-start / dump valve",
      "Festo MS series (MS6-SV safety dump valve), SMC AC + VP/VG safety valves, Parker Global, AVENTICS AS series",
      "see datasheet",
      "€€ – €€€",
      "safety-rated dump valve (PL), filter 5 µm"
     ],
     [
      "Pneumatics",
      "tubing PU / PA 6/4, 8/6",
      "Festo, SMC, Parker, Legris",
      "–",
      "€",
      "colour code, bend radius"
     ]
    ]
   },
   {
    "id": "x36_12",
    "t": "Standard machine parts",
    "src": "guide 10 §36.12",
    "rows": [
     [
      "Standard machine parts",
      "shafts, collars, pins, bushes, plates (configurable)",
      "Misumi (configurable \"economy\" and standard lines), norelem, Ganter, Kipp",
      "–",
      "€",
      "lead time, tolerance options"
     ],
     [
      "Standard machine parts",
      "levelling feet, handles, clamps, toggle clamps",
      "Ganter, Kipp, norelem, Elesa, DESTACO (toggle)",
      "see datasheet",
      "€",
      "load rating, thread"
     ],
     [
      "Standard machine parts",
      "hinges, latches, locks for guards",
      "Elesa+Ganter, Kipp, Pizzato, Schmersal (safety switches)",
      "–",
      "€",
      "guard-locking per ISO 14119"
     ],
     [
      "Standard machine parts",
      "fasteners ISO 4762 / 4017, washers, thread inserts",
      "Bossard, Würth, Fabory, Böllhoff (HELICOIL)",
      "–",
      "€",
      "property class 8.8 / 10.9, coating"
     ]
    ]
   },
   {
    "id": "x36_13",
    "t": "Aluminium profiles",
    "src": "guide 10 §36.13",
    "rows": [
     [
      "Aluminium profiles",
      "profile 40 × 40 / 45 × 45, T-slot",
      "item Profile 8 40×40, Bosch Rexroth strut profiles 45×45, MiniTec Profile 45",
      "I_x from the catalogue (see datasheet)",
      "€ per m",
      "system compatibility (slot 8 vs 10), connectors"
     ],
     [
      "Aluminium profiles",
      "guard panels + doors",
      "item, Bosch Rexroth, MiniTec, Axelent / Troax (mesh guards)",
      "–",
      "€€",
      "mesh size vs distance (ISO 13857), guard locking"
     ],
     [
      "Aluminium profiles",
      "profile connectors, feet, hinges",
      "same system maker",
      "–",
      "€",
      "stiffness of the joint (use gussets)"
     ]
    ]
   },
   {
    "id": "x36_14",
    "t": "Conveyor-specific parts",
    "src": "guide 10 §36.14",
    "rows": [
     [
      "Conveyor-specific parts",
      "chain conveyor modules for pallets (alternative to MAKE)",
      "Bosch Rexroth TS 5 / TS 7 transfer systems, Montech, mk Technology Group",
      "see datasheet (load per pallet)",
      "€€€ – €€€€",
      "510 kg pallet mass is heavy for standard modules – ask"
     ],
     [
      "Conveyor-specific parts",
      "inductive sensors M18 / M30, pressure switch (seat check)",
      "ifm, SICK, Balluff, Pepperl+Fuchs, Festo / SMC pressure switches",
      "see datasheet",
      "€",
      "IO-Link, switching distance, coolant resistance"
     ],
     [
      "Conveyor-specific parts",
      "UHMW-PE strips and guides",
      "Murtfeldt, Röchling, igus",
      "–",
      "€",
      "profile, fixing method"
     ]
    ]
   }
  ],
  "shops": [
   {
    "title": "",
    "cols": [
     "Pos",
     "Qty",
     "Item",
     "Spec (from this guide)",
     "Example makers",
     "M/B",
     "Price",
     "Check before ordering"
    ],
    "rows": [
     [
      "1",
      "1",
      "station table weldment",
      "S355J2 tubes 60×50×4 / 70×70×5, stress relieved, machined in one setup (§1.5, §11.1)",
      "own workshop / local fabricator",
      "MAKE",
      "€€€",
      "flatness 0.05, pads ±0.02, legs outside the APC base"
     ],
     [
      "2",
      "4",
      "locating receivers",
      "16MnCr5 CHD 0.8–1.2, 58–62 HRC, Ø60 k6, 15° lead-in (§11.1)",
      "own / Halder / norelem (similar)",
      "MAKE/BUY",
      "€ – €€",
      "stud diameter from the module maker"
     ],
     [
      "3",
      "1",
      "lift-transfer frame",
      "S355 C 50×40, strands at ±140 (§11.1)",
      "own",
      "MAKE",
      "€€",
      "chain-guide seats ±0.1"
     ],
     [
      "3a",
      "≈ 5.2 m",
      "roller chain 10B-1",
      "ISO 606, breaking ≥ 22.2 kN (§1.4)",
      "iwis, Renold, Tsubaki",
      "BUY",
      "€ – €€",
      "lube-free option, attachments"
     ],
     [
      "3b",
      "4",
      "chain guide strips",
      "C45 induction hardened or UHMW-PE (§11.1)",
      "own / Murtfeldt",
      "MAKE/BUY",
      "€",
      "–"
     ],
     [
      "4",
      "4 + 1",
      "sprockets 10B z17 + drive sprocket 08B z19",
      "hardened teeth; clamping elements for phase (§19.4)",
      "iwis, Renold, Misumi",
      "BUY",
      "€",
      "bore / hub type"
     ],
     [
      "4a",
      "1",
      "sprocket shaft",
      "42CrMo4+QT, Ø25 / Ø20, r = 1 fillets (§18.7)",
      "own",
      "MAKE",
      "€ – €€",
      "runout 0.03"
     ],
     [
      "4b",
      "2",
      "housed insert bearings Ø25",
      "FY 25 TF / UCF205 (§20.2)",
      "SKF, NSK, NTN, Schaeffler",
      "BUY",
      "€ – €€",
      "seals, locking"
     ],
     [
      "4c",
      "4",
      "clamping elements Ø20–25",
      "T ≥ 50 N·m each (generous) (§19.4)",
      "Ringfeder, Tollok, KTR CLAMPEX",
      "BUY",
      "€ – €€",
      "hub wall thickness"
     ],
     [
      "5",
      "4 + 4",
      "guide columns Ø25 h6 + flanged ball bushings",
      "sealed, parallel ≤ 0.05 (§21)",
      "Bosch Rexroth, Ewellix, Misumi",
      "BUY",
      "€ – €€",
      "column hardness, mounting"
     ],
     [
      "6",
      "1",
      "lift cylinder",
      "ISO 6020-2 compact Ø50/28 × 64, cushioning (§1.4)",
      "Bosch Rexroth, Parker, HYDAC, Hänchen",
      "BUY",
      "€€",
      "pressure 6 MPa, ports, sensors"
     ],
     [
      "6a",
      "1 set",
      "4/3 valve + pilot check + throttle (circuit 4)",
      "on the APC manifold (§12.2, guide 30)",
      "Bosch Rexroth, HAWE, Parker",
      "BUY",
      "€€",
      "lowering speed ≤ 20 mm/s at the end"
     ],
     [
      "7",
      "1",
      "helical-bevel gear motor 0.25 kW, 44 rpm, brake, encoder",
      "f_B ≥ 1.2, F_Ra ≥ 920 N (§22.4)",
      "SEW, NORD, Bonfiglioli, Siemens",
      "BUY",
      "€€ – €€€",
      "brake strategy §25 (ramp stop)"
     ],
     [
      "7a",
      "1",
      "inverter 0.37 kW with STO, torque limit",
      "ramp 0.67 s, creep 0.05 m/s (§1.4)",
      "SEW MOVITRAC, Danfoss, Siemens, Lenze",
      "BUY",
      "€€",
      "torque limit, STO wiring (guide 24)"
     ],
     [
      "8",
      "1",
      "drive chain 08B + slip hub 42 N·m (or toothed belt HTD 8M)",
      "§23, §24.3",
      "iwis / Gates + Mayr ROBA-slip hub",
      "BUY",
      "€ – €€",
      "slip monitor sensor"
     ],
     [
      "9",
      "1",
      "retractable heavy-duty stop + damper",
      "≥ 36 J/stroke (25 mm) incl. chain push, m_e range 1 450–15 500 kg (25 mm stroke), 1.36 kN, 2 sensors (§30)",
      "Bosch Rexroth VE, Asutec, ACE / Weforma damper",
      "BUY",
      "€€ – €€€",
      "stop DOWN before APC turns (interlock)"
     ],
     [
      "10",
      "–",
      "pallet (from the APC tab)",
      "chamfer 5 × 30° on the bottom edges",
      "guide 09",
      "–",
      "–",
      "–"
     ],
     [
      "11",
      "≈ 12",
      "sensors B11–B24 (inductive), pressure switch (seat check), air nozzles",
      "§1.5, §4.5",
      "ifm, SICK, Balluff, Festo / SMC",
      "BUY",
      "€ each",
      "coolant resistance, IO-Link"
     ],
     [
      "12",
      "2",
      "docking brackets (post 120×120×8 + arm) + cone pins (1 round, 1 diamond)",
      "§9.3, §14",
      "own",
      "MAKE",
      "€€",
      "stiffness test 200 N → ≤ 0.05 mm"
     ],
     [
      "13",
      "1 + 2",
      "buffer post + shock absorbers M25 class ≥ 33 J + PU pads",
      "§1.4, §30",
      "own + ACE / Enidine / Weforma",
      "MAKE + BUY",
      "€ – €€",
      "thread, stop collar"
     ],
     [
      "14",
      "–",
      "AGV floating deck with bushes, lock pin, springs",
      "§1.5 interface sheet, §26",
      "AGV supplier (+ Lesjöfors / Gutekunst springs, Alwayse BTUs)",
      "BUY",
      "–",
      "maximum deck lift force incl. stall (§15 #2)"
     ],
     [
      "15",
      "6 + 8",
      "bonded anchors M16 (+ M12 for brackets) + grout",
      "ETA, C25/30 (§1.5)",
      "Hilti, Fischer, Würth",
      "BUY",
      "€",
      "edge distance, torque"
     ],
     [
      "16",
      "4",
      "base plates + M20 levelling screws, stainless shims",
      "§1.5, §11.6",
      "own / Ganter levelling elements",
      "MAKE/BUY",
      "€",
      "–"
     ],
     [
      "17",
      "1",
      "protective guide rails (UHMW-PE faced)",
      "§1.5",
      "own + Murtfeldt",
      "MAKE",
      "€ – €€",
      "20 mm free per side"
     ],
     [
      "18",
      "1",
      "light curtain type 4 + muting sensors",
      "ISO 13855, IEC 62046 (§1.5)",
      "SICK, Pilz, Leuze, Keyence, Banner",
      "BUY",
      "€€ – €€€",
      "resolution, muting time-out"
     ],
     [
      "19",
      "1 pair",
      "E84 optical PIO",
      "§1.3",
      "Hokuyo, Funken, others (see AGV supplier)",
      "BUY",
      "€€",
      "match the AGV supplier"
     ],
     [
      "20",
      "1",
      "control box: safety PLC I/O, panel, cabling",
      "§1.5, guides 05 / 24",
      "Siemens, Pilz, Rockwell, Beckhoff",
      "BUY",
      "€€€",
      "PL d validation"
     ],
     [
      "21",
      "1 set",
      "guards (aluminium profile + mesh), chain guards",
      "ISO 13857, ISO 14120",
      "item, Bosch Rexroth, MiniTec, Troax",
      "BUY",
      "€€",
      "no reachable nip points"
     ],
     [
      "22",
      "1 set",
      "fasteners, dowels ISO 8734, thread locker",
      "§11, guide 14 §8",
      "Bossard, Würth",
      "BUY",
      "€",
      "10.9 where preload matters"
     ],
     [
      "23",
      "1",
      "paint system C3 + safety marking",
      "ISO 12944, ISO 3864 (§33)",
      "local",
      "BUY",
      "€",
      "mask machined faces"
     ],
     [
      "24",
      "1",
      "drip tray + chip guard (stainless)",
      "§4.5 (item 4)",
      "own",
      "MAKE",
      "€ – €€",
      "slope ≥ 2 %"
     ]
    ],
    "m": 4,
    "p": 6,
    "w": [
     4,
     5,
     15,
     26,
     16,
     7,
     8,
     19
    ]
   }
  ],
  "shopTab": "Shopping list – pallet transfer station",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – pallet transfer station (item 1) – guide 10 §37. Positions match the element map drawing; M/B = make or buy.",
  "price": "Price classes (guide 10, per piece): € < 50 € · €€ 50 – 500 € · €€€ 500 – 5 000 € · €€€€ > 5 000 € – estimate, ask for a quote.",
  "shopNote": "Quantities for one station; compare at least 2 makers for every bought part.",
  "ph": "(e.g. SKF, Bosch Rexroth, SEW, KTR, Festo, norelem)"
 }
};
