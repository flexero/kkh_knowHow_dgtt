/* INSTALLATION tab – data for the cards "Real components + drawings – catalogue examples" (instref.js).
 * GENERATED from the guide tables – do not edit by hand; regenerate with gen_inst.py (scratchpad / tools).
 *   items 1 + 2: docs/26_installation_foundation_alignment.md (buy list F3, shopping list F4; F3.7 split: vibration → 1, shaft alignment → 2)
 *   items 3 + 4: docs/27_installation_electrical_emc.md (buy list Part F: power/protection/meters/testers → 3, cables/trays/harmonics/EMC parts → 4; shopping list F.15 on both)
 *   item 5: docs/28_installation_sequence_commissioning.md (8 drawings 28_*, buy list G1.1–G1.14, shopping list G2.1 buy + G2.2 rent / service)
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]
 * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.
 */
export const ITEMS = {
 "1": {
  "guide": "guide 26",
  "drawings": [
   {
    "f": "26_foundation_plan_section.svg",
    "t": "Foundation plan + section A–A",
    "c": "foundation plan and section A–A of the isolated block for the HMC 500 (example)",
    "g": "guide 26 §A2"
   },
   {
    "f": "26_transmissibility.svg",
    "t": "Vibration isolation – transmissibility",
    "c": "SDOF model and transmissibility curves with the app presets",
    "g": "guide 26 §A4"
   },
   {
    "f": "26_vibration_layout.svg",
    "t": "Vibration sources around the line",
    "c": "vibration sources and attenuation around the crankcase line (app default)",
    "g": "guide 26 §A6"
   },
   {
    "f": "26_anchor_grout_detail.svg",
    "t": "Anchor + grout detail",
    "c": "anchor and grout detail: bonded anchor + epoxy grout, cast-in anchor + cementitious grout",
    "g": "guide 26 §C5"
   }
  ],
  "groups": [
   {
    "id": "f3_1",
    "t": "Grout and chocking compounds",
    "src": "guide 26 §F3.1",
    "rows": [
     [
      "Grout and chocking compounds",
      "Cementitious non-shrink flowable grout, 25–100 mm, under pads / base plates / anchor pockets",
      "Sika SikaGrout®-212 (and other SikaGrout grades for larger thickness)",
      "cement-based, shrinkage-compensated, pourable; strength, yield per bag: see datasheet",
      "€ (per 25 kg bag)",
      "strength 1/7/28 d, flow time, min / max thickness, expansion, yield (L/bag), temperature range"
     ],
     [
      "Grout and chocking compounds",
      "as above",
      "Fosroc Conbextra GP / Conbextra HF",
      "cementitious, non-shrink, flowable / high flow: see datasheet",
      "€",
      "as above + pot life"
     ],
     [
      "Grout and chocking compounds",
      "as above, precision machine bases",
      "Master Builders Solutions MasterFlow® 928",
      "cementitious precision grout: see datasheet",
      "€",
      "as above"
     ],
     [
      "Grout and chocking compounds",
      "Epoxy grout for dynamic machines, oily areas, anchor bolts",
      "Sika Sikadur®-42 (e.g. \"-42 HE\")",
      "3-component epoxy grout: see datasheet",
      "€–€€ (per kit)",
      "compressive strength, creep, max lift thickness, exotherm, min temperature, effective bearing area"
     ],
     [
      "Grout and chocking compounds",
      "as above",
      "Fosroc Conbextra EP range",
      "epoxy grouts, grades by pour thickness: see datasheet",
      "€–€€",
      "as above"
     ],
     [
      "Grout and chocking compounds",
      "as above",
      "Master Builders Solutions MasterFlow® 648",
      "epoxy grout: see datasheet",
      "€–€€",
      "as above"
     ],
     [
      "Grout and chocking compounds",
      "Epoxy chocks under feet (alternative to full grout)",
      "ITW Philadelphia Resins Chockfast® Orange",
      "epoxy chocking compound: allowable pressure, thickness: see datasheet",
      "€–€€",
      "allowable bearing pressure (creep), thickness range, temperature"
     ]
    ]
   },
   {
    "id": "f3_2",
    "t": "Anchors",
    "src": "guide 26 §F3.2",
    "rows": [
     [
      "Anchors",
      "Bonded anchor M24, h_ef ≈ 200 mm, cracked concrete, dynamic",
      "Hilti HIT-RE 500 V4 injection mortar + threaded rod (HAS-U or 8.8 rod)",
      "epoxy mortar with ETA (bonded anchors and rebar): τ_Rk, cure times: see ETA",
      "€ (cartridge + rods)",
      "ETA number, τ_Rk cracked / uncracked, temperature range, drill Ø, cleaning method, gel / cure time, torque, min edge / spacing, seismic C1/C2"
     ],
     [
      "Anchors",
      "as above",
      "fischer FIS EM Plus + threaded rod",
      "epoxy injection mortar with ETA: see ETA",
      "€",
      "as above"
     ],
     [
      "Anchors",
      "as above",
      "Würth WIT-PE 500 (epoxy) or WIT-VM 250 (vinylester)",
      "injection mortars with ETA: see ETA",
      "€",
      "as above"
     ],
     [
      "Anchors",
      "Heavy-duty mechanical anchor (no curing time)",
      "Hilti HSL-4 heavy-duty sleeve anchor",
      "sizes and loads: see ETA",
      "€",
      "size range (check M24 availability), h_ef, torque, cracked concrete approval"
     ],
     [
      "Anchors",
      "Undercut anchor for dynamic loads",
      "Hilti HDA (HDA-P / HDA-T)",
      "offered up to M20 (check catalogue) – for M24 use bonded or cast-in",
      "€",
      "size range, special drill bit, setting tool"
     ],
     [
      "Anchors",
      "Undercut anchor, smaller loads",
      "fischer Zykon FZA",
      "see ETA",
      "€",
      "size range"
     ],
     [
      "Anchors",
      "Cast-in foundation bolt in a sleeve",
      "foundation bolts (e.g. DIN 529 type) or anchor bolts with plate; corrugated steel sleeves",
      "bolt grade 8.8, length = h_ef + grout + plate + nut",
      "€",
      "material, thread length, sleeve Ø and length, template"
     ],
     [
      "Anchors",
      "Design software",
      "Hilti PROFIS Engineering, fischer FIXPERIENCE",
      "EN 1992-4 checks of all failure modes",
      "free / account",
      "use the ETA of the chosen product"
     ]
    ]
   },
   {
    "id": "f3_3",
    "t": "Levelling elements, mounts, isolation",
    "src": "guide 26 §F3.3",
    "rows": [
     [
      "Levelling elements, mounts, isolation",
      "Steel levelling pads Ø160 × 35 for M30 jack bolts",
      "usually supplied by the machine maker; else local machine shop (S355, centring recess)",
      "–",
      "€",
      "flatness, recess matching the bolt tip"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Wedge levelling elements (heavy machines, presses)",
      "AirLoc levelling wedges / mounts; NIVELL wedge levelling elements; Bilz levelling elements",
      "load range, height adjustment, adjustment per turn: see catalogue",
      "€ per element",
      "rated load, adjustment range, Δh per turn, anchoring option, elastomer or steel pad"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Anti-vibration levelling mounts (washer, conveyors, light machines)",
      "Fibet AV mounts; AirLoc; NIVELL; Bilz",
      "rated load, static deflection, f_n curves: see catalogue",
      "€",
      "load per mount within range, dynamic stiffness, oil resistance (NBR / CR), f_n at your load"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Steel spring units + viscous dampers (grinder on inertia block, press)",
      "GERB spring units + VISCODAMPER®",
      "load per unit, vertical / horizontal stiffness, damping: see catalogue",
      "€€–€€€ (package with design)",
      "example need: ≈ 30 kN, ≈ 1.9 kN/mm per unit (§C4.5); damper resistance; seismic stops"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Air springs / active levelling (CMM, measuring room)",
      "Bilz air spring isolators (e.g. BiAir® range)",
      "f_n ≈ 1–3 Hz class, levelling valves: see datasheet",
      "€€–€€€",
      "load, f_n, levelling accuracy, air supply quality"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Elastomer bearings under an inertia block / floating floor",
      "Getzner Sylomer® (lower loads), Sylodyn® (higher loads)",
      "static load range per type, dynamic stiffness, loss factor: see datasheet",
      "€ per m² (mat)",
      "choose the type for the actual static pressure; dynamic stiffness at the frequency; creep"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Levelling feet for conveyors / guards",
      "KIPP, Ganter, Elesa levelling feet",
      "load, thread, ball joint: see catalogue",
      "€",
      "load rating, thread, anti-slip pad"
     ],
     [
      "Levelling elements, mounts, isolation",
      "Precut stainless shims (motors, base plates)",
      "assortments from bearing / alignment tool suppliers (e.g. with the shaft-alignment tool)",
      "0.05–3 mm, slot sizes A–D",
      "€",
      "thickness tolerance, material 1.4301"
     ]
    ]
   },
   {
    "id": "f3_7v",
    "t": "Vibration meters + survey",
    "src": "guide 26 §F3.7",
    "rows": [
     [
      "Vibration",
      "Vibration meter for maintenance (overall mm/s, bearing condition)",
      "Fluke 805 FC; ADASH A4900 Vibrio M; PCE PCE-VT series",
      "velocity 10–1 000 Hz RMS, bearing parameter: see datasheet",
      "€",
      "ISO 20816 bands, sensor type, data export"
     ],
     [
      "Vibration",
      "Vibration tester with diagnosis",
      "Fluke 810",
      "automatic fault diagnosis: see datasheet",
      "€€",
      "as above"
     ],
     [
      "Vibration",
      "Route-based analyser + FFT (condition monitoring)",
      "SKF Microlog Analyzer (e.g. CMXA 80 / dBX); ADASH A4400 VA4 Pro",
      "channels, FFT lines, frequency range: see datasheet",
      "€€–€€€",
      "channels, 1/3 octave, time recording, software"
     ],
     [
      "Vibration",
      "Floor survey sensors (low level)",
      "seismic accelerometers: PCB 393B04 (≈ 1 V/g), PCB 393B31 (≈ 10 V/g); Brüel & Kjær seismic accelerometer (e.g. Type 8340)",
      "sensitivity, noise floor, frequency range: see datasheet",
      "€ per sensor",
      "noise floor ≪ 0.01 mm/s in the band, low-frequency limit, mounting"
     ],
     [
      "Vibration",
      "Field calibrator",
      "PCB 394C06 handheld shaker",
      "1 g at 159.2 Hz (reference) – see datasheet",
      "€",
      "reference level, frequency"
     ],
     [
      "Vibration",
      "Survey service",
      "vibration consultant (VDI / ISO qualified)",
      "1 shift + report",
      "€–€€",
      "instruments, criteria, report content (§D5.5)"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item",
   "Calculation",
   "Quantity (example)",
   "Price class"
  ],
  "shop": [
   [
    "1",
    "Steel levelling pads Ø160 × 35 (if not supplied)",
    "3 × 6 + 2 spare",
    "20",
    "€"
   ],
   [
    "2",
    "Threaded rods M24 × 330 8.8 (galvanised), nuts, washers",
    "3 × 4 + 2 spare",
    "14 sets",
    "€"
   ],
   [
    "3",
    "Injection mortar (epoxy, ETA)",
    "hole Ø28, rod M24, h_ef 200: π/4·(28² − 24²)·200 = 32.7 mL net per hole, × ≈ 1.8 waste → 59 mL; 12 holes → 0.71 L",
    "2–3 cartridges (≈ 500 mL each – check the maker's volume table) + mixers + dispenser",
    "€"
   ],
   [
    "4",
    "Hole cleaning kit (brushes Ø28, air nozzle, pump)",
    "per ETA",
    "1 kit",
    "€"
   ],
   [
    "5",
    "Grout for the pads (cementitious or epoxy)",
    "0.3 · 0.3 · 0.04 m = 3.6 L per pad; 18 pads = 64.8 L; +20 % = 77.8 L",
    "cementitious ≈ 7 bags of 25 kg (if ≈ 12.5 L per bag – check yield) or ≈ 78 L epoxy kits",
    "€"
   ],
   [
    "6",
    "Formwork material, foam strips, wax / foil",
    "–",
    "1 set",
    "€"
   ],
   [
    "7",
    "Stainless floor markers (datum bolts) + epoxy",
    "main axis 2 + 3 cross axes × 2 + 1 height datum = 9",
    "12 (with spare)",
    "€"
   ],
   [
    "8",
    "Precut stainless shim assortment",
    "motors, pumps, conveyors",
    "1 box",
    "€"
   ],
   [
    "9",
    "Floor paint / chalk lines for the reference lines",
    "–",
    "1",
    "€"
   ],
   [
    "10",
    "Joint sealant + backer rod (repair of slab joints near the machines)",
    "–",
    "as needed",
    "€"
   ],
   [
    "11",
    "Drip trays / coating repair around the machines",
    "–",
    "3",
    "€"
   ]
  ],
  "shopM": 3,
  "shopP": 4,
  "shopW": [
   4,
   30,
   38,
   18,
   10
  ],
  "shopTab": "Shopping list – consumables",
  "shopLbl": "consumables list",
  "shopTitle": "Consolidated shopping list for installing 3 HMCs – consumables (guide 26 §F4.1). Assumptions: 3 × HMC 500 on the existing 300 mm slab, 6 levelling bolts and 4 bonded anchors M24 each, grout pads 300 × 300 × 40 mm.",
  "price": "Price classes (guide 26): € < 1 k€ · €€ 1 – 10 k€ · €€€ 10 – 50 k€ · €€€€ > 50 k€ – estimate, ask for a quote.",
  "shopNote": "Instruments and services (levels, interferometer, ballbar, tracker, shaft alignment) are in the item-2 card.",
  "ph": "(e.g. Sikadur, HIT-RE 500, GERB, Fluke 805)"
 },
 "2": {
  "guide": "guide 26",
  "drawings": [
   {
    "f": "26_level_positions.svg",
    "t": "Level positions + order of work",
    "c": "level positions, bolt forces, reading signs and order of work",
    "g": "guide 26 §B2"
   },
   {
    "f": "26_levelling_bolt.svg",
    "t": "Levelling bolt M30 on a steel pad",
    "c": "levelling bolt M30 × 1.5 on a steel pad Ø160 (example)",
    "g": "guide 26 §B2"
   },
   {
    "f": "26_geometry_tests.svg",
    "t": "Geometric acceptance tests",
    "c": "set-ups for the geometric tests (sketches)",
    "g": "guide 26 §B5"
   },
   {
    "f": "26_shaft_alignment.svg",
    "t": "Shaft alignment + soft foot",
    "c": "shaft alignment: offset, angle, feet corrections, soft foot",
    "g": "guide 26 §E8"
   }
  ],
  "groups": [
   {
    "id": "f3_4",
    "t": "Precision levels and electronic levels",
    "src": "guide 26 §F3.4",
    "rows": [
     [
      "Precision levels and electronic levels",
      "Rough level 0.1 mm/m class (rough levelling, conveyors)",
      "Starrett No. 98 machinist level",
      "≈ 0.005 in/ft (≈ 0.42 mm/m) per graduation – too coarse for final levelling",
      "€",
      "graduation value, base length"
     ],
     [
      "Precision levels and electronic levels",
      "Precision level 0.02 mm/m, 200–300 mm (main tool)",
      "Mitutoyo 960 series precision levels (block / frame, 0.02 mm/m versions)",
      "sensitivity per division, base length: see catalogue",
      "€",
      "0.02 mm/m per division, base flat + V-groove, adjustable zero, certificate"
     ],
     [
      "Precision levels and electronic levels",
      "Precision level (inch shops)",
      "Starrett No. 199 master precision level",
      "≈ 0.0005 in/ft (≈ 0.042 mm/m) per graduation – see datasheet",
      "€",
      "graduation value"
     ],
     [
      "Precision levels and electronic levels",
      "Frame level 200 × 200, 0.02 mm/m",
      "Fowler / Wyler SPIRIT frame levels",
      "see catalogue",
      "€",
      "squareness of the frame faces, certificate"
     ],
     [
      "Precision levels and electronic levels",
      "Electronic level (2 sensors for differential + twist), PC software",
      "Wyler BlueLEVEL (+ Wyler software, e.g. LEVELSOFT / MT-SOFT)",
      "resolution, range, wireless: see datasheet",
      "€€",
      "resolution ≤ 1 µm/m, linearity, temperature drift, differential mode, logging"
     ],
     [
      "Precision levels and electronic levels",
      "Digital inclinometer (shaft, angles)",
      "Wyler Clinotronic (e.g. Clinotronic PLUS / S)",
      "range ± 45°, resolution: see datasheet",
      "€",
      "resolution, accuracy, reversal function"
     ]
    ]
   },
   {
    "id": "f3_5",
    "t": "Granite square, straight edge, test mandrel, indicators",
    "src": "guide 26 §F3.5",
    "rows": [
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Granite square, grade 00, ≈ 500 × 400 mm (G4, G6–G8)",
      "Starrett Tru-Stone granite squares; Mitutoyo granite products; local granite makers to DIN 875",
      "grade 00 per DIN 875: see certificate",
      "€–€€",
      "grade, size, certificate, lifting holes, weight (≈ 30–60 kg)"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Granite / steel straight edge 500–1 000 mm, grade 00 (G1, G2, G5)",
      "same makers, DIN 876",
      "see certificate",
      "€–€€",
      "grade, Bessel point marks"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Test mandrel HSK-A63 (or SK40 / BT40), 300 mm, run-out ≤ 2 µm (G12–G15)",
      "Haimer test mandrels; BIG Daishowa test bars; Kelch",
      "run-out of the cylinder to the taper: see certificate",
      "€–€€",
      "taper type = spindle, length, certificate, ball end for G14"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Digital indicator 0.001 mm",
      "Mitutoyo 543 series ABSOLUTE Digimatic (order no. by range – see catalogue)",
      "0.001 mm resolution, data output",
      "€",
      "resolution, error (µm), measuring force, data output"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Lever test indicator 0.001–0.002 mm",
      "Mitutoyo 513 series",
      "see catalogue",
      "€",
      "resolution, lever length"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Magnetic stand, fine adjustment",
      "Mitutoyo 7000 series magnetic stands; Noga",
      "holding force, arm length",
      "€",
      "stiffness (short arms!), fine adjust"
     ],
     [
      "Granite square, straight edge, test mandrel, indicators",
      "Torque wrench 60–340 N·m (anchors M24 ≈ 250 N·m)",
      "Norbar, Stahlwille, Gedore",
      "accuracy ±4 % (ISO 6789 class), calibration certificate",
      "€",
      "range, certificate"
     ]
    ]
   },
   {
    "id": "f3_6",
    "t": "Laser interferometer, ballbar, tracker, total station",
    "src": "guide 26 §F3.6",
    "rows": [
     [
      "Laser interferometer, ballbar, tracker, total station",
      "ISO 230-2 positioning, pitch / yaw, compensation tables",
      "Renishaw XL-80 + XC-80 environmental compensator",
      "linear accuracy ±0.5 ppm (with compensation), range 80 m, max speed 4 m/s, resolution 1 nm",
      "€€€ (buy) / service day €€",
      "optics set (linear, angular, straightness, rotary XR20), software, calibration certificate"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "as above, metrology labs",
      "Keysight 5530 dynamic calibrator",
      "see datasheet",
      "€€€",
      "as above"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "6-D in one set-up (positioning + straightness + angles)",
      "API XD Laser",
      "see datasheet",
      "€€€",
      "which errors at once, accuracy"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "Ballbar ISO 230-4, monthly checks",
      "Renishaw QC20-W (Bluetooth)",
      "sensor resolution 0.1 µm, accuracy ±1.25 µm (at 20 °C), standard length 100 mm, extensions 50 / 150 / 300 mm, measuring range ±1 mm",
      "€€",
      "software diagnosis, partial arc (220°) option, calibrator"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "Grid encoder for free-form and small circles",
      "Heidenhain KGM (e.g. KGM 182 / 282)",
      "see datasheet",
      "€€€",
      "radius range, dynamic tests"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "Line alignment (machines, APC, robot, conveyors, AGV docks)",
      "Leica Absolute Tracker AT960",
      "MPE ±(15 µm + 6 µm/m)",
      "€€€€ (buy) / service day €€",
      "range, SMR sizes, probe, software (e.g. SpatialAnalyzer / PolyWorks)"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "as above",
      "FARO Vantage laser tracker",
      "see datasheet",
      "€€€€",
      "as above"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "as above",
      "API Radian laser tracker",
      "see datasheet",
      "€€€€",
      "as above"
     ],
     [
      "Laser interferometer, ballbar, tracker, total station",
      "Floor markers, hall grid",
      "Leica Nova TS60 / TS16 total station (surveyor)",
      "angle accuracy class 0.5″ (TS60) – see datasheet",
      "€€€€ / surveyor day €",
      "angle + distance accuracy"
     ]
    ]
   },
   {
    "id": "f3_7s",
    "t": "Shaft alignment",
    "src": "guide 26 §F3.7",
    "rows": [
     [
      "Shaft alignment",
      "Laser shaft alignment (coolant pumps, HP pump, filters, hydraulics)",
      "Pruftechnik ROTALIGN touch; OPTALIGN touch / smart RS5",
      "sensor resolution / accuracy: see datasheet; soft foot, thermal growth, multi-coupling functions",
      "€€",
      "functions you need (soft foot, thermal growth, cardan), reports"
     ],
     [
      "Shaft alignment",
      "as above, entry / mid class",
      "SKF TKSA 31 / 41 / 51 / 71",
      "see datasheet",
      "€–€€",
      "as above"
     ],
     [
      "Shaft alignment",
      "as above",
      "Easy-Laser XT440 / XT660 / XT770",
      "see datasheet; XT660/770 also geometry (flatness, straightness)",
      "€€",
      "as above"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item",
   "Buy / rent / service",
   "Quantity",
   "Price class"
  ],
  "shop": [
   [
    "1",
    "Precision level 0.02 mm/m, 200 mm (two allow simultaneous X + Z or twist reading)",
    "buy",
    "2",
    "€ each"
   ],
   [
    "2",
    "Rough level 0.1 mm/m, 300 mm",
    "buy",
    "1",
    "€"
   ],
   [
    "3",
    "Electronic level set, 2 sensors + software",
    "buy (or rent for SAT)",
    "1 set",
    "€€"
   ],
   [
    "4",
    "Granite square grade 00 + straight edge 1 000 mm",
    "buy (or the maker brings them for SAT)",
    "1 + 1",
    "€–€€"
   ],
   [
    "5",
    "Test mandrel for the spindle taper, 300 mm",
    "buy",
    "1",
    "€–€€"
   ],
   [
    "6",
    "Digital indicators 0.001 mm + lever indicator + 2 magnetic stands",
    "buy",
    "2 + 1 + 2",
    "€"
   ],
   [
    "7",
    "Torque wrench 60–340 N·m with certificate",
    "buy",
    "1",
    "€"
   ],
   [
    "8",
    "Long wrench / socket for M30 jack bolts (≈ 72–91 N·m to turn, §C6.2)",
    "buy",
    "1",
    "€"
   ],
   [
    "9",
    "Ballbar (QC20-W class)",
    "buy – used monthly on 3 HMCs + VMC",
    "1",
    "€€"
   ],
   [
    "10",
    "Laser interferometer (XL-80 class)",
    "service provider / maker for SAT; buy only if many machines",
    "1 service visit",
    "€€ (service)"
   ],
   [
    "11",
    "Laser tracker (line alignment day)",
    "service provider",
    "1–2 days",
    "€€ (service)"
   ],
   [
    "12",
    "Total station – floor markers and grid",
    "surveyor",
    "1 day",
    "€"
   ],
   [
    "13",
    "Laser shaft-alignment tool",
    "buy (maintenance team)",
    "1",
    "€€"
   ],
   [
    "14",
    "Vibration meter (maintenance)",
    "buy",
    "1",
    "€"
   ],
   [
    "15",
    "Floor vibration survey (before and after)",
    "consultant",
    "2 visits",
    "€–€€"
   ],
   [
    "16",
    "Thermometers / data loggers (room, machine, 3 positions + gradient)",
    "buy",
    "4",
    "€"
   ]
  ],
  "shopM": 2,
  "shopP": 4,
  "shopW": [
   4,
   46,
   26,
   12,
   12
  ],
  "shopTab": "Shopping list – instruments + services",
  "shopLbl": "instrument list",
  "shopTitle": "Consolidated shopping list for installing 3 HMCs – instruments and services, buy or rent (guide 26 §F4.2).",
  "price": "Price classes (guide 26): € < 1 k€ · €€ 1 – 10 k€ · €€€ 10 – 50 k€ · €€€€ > 50 k€ – estimate, ask for a quote.",
  "shopNote": "Consumables (pads, rods, mortar, grout, markers, shims) are in the item-1 card.",
  "ph": "(e.g. Mitutoyo 960, XL-80, QC20-W, ROTALIGN)"
 },
 "3": {
  "guide": "guide 27",
  "drawings": [
   {
    "f": "27_single_line_diagram.svg",
    "t": "Single-line diagram of the supply",
    "c": "Single-line diagram of the example supply: 20 kV, transformer 1000 kVA Dyn11, MDB, feeder 4×95+50, SD-ML1, 7 machine branches with breaker, cable, voltage drop and earth-fault current",
    "g": "guide 27 §A.1"
   },
   {
    "f": "27_short_circuit_impedances.svg",
    "t": "Short-circuit impedances Ik3 / Ik1",
    "c": "Equivalent circuits for Ik3 max and Ik1 min with all impedances in mΩ",
    "g": "guide 27 §A.6"
   },
   {
    "f": "27_spd_zones.svg",
    "t": "Surge protection zones + SPD types",
    "c": "Lightning protection zones LPZ 0–3 with SPD type 1 at the MDB, type 2 at SD-ML1, type 3 at the CNC; lead-length rule",
    "g": "guide 27 §A.11"
   },
   {
    "f": "27_tn_s_earthing_bonding.svg",
    "t": "TN-S earthing + bonding",
    "c": "TN-S system with one N–PE link at the MET, bonding of machine base, tray, pipe and steel to the foundation mesh, and the earth-fault loop of HMC-01",
    "g": "guide 27 §A.13"
   },
   {
    "f": "27_test_sequence.svg",
    "t": "Test sequence (dead, live, function)",
    "c": "Test sequence: dead tests 1–6, live tests 7–12, function, power quality and records 13–18, with instruments and limits",
    "g": "guide 27 §A.15"
   }
  ],
  "groups": [
   {
    "id": "f_2",
    "t": "Distribution transformer",
    "src": "guide 27 §F.2",
    "rows": [
     [
      "Distribution transformer",
      "1000 kVA, 20 / 0.4 kV, Dyn11, u_k 6 %, cast resin, indoor E2-C2-F1, off-circuit taps ± 2 × 2.5 %, PT100 in each LV winding + temperature relay, Ecodesign Tier 2",
      "Siemens GEAFOL cast-resin transformer",
      "cast resin, class F insulation (see datasheet), IEC 60076-11 classes as ordered",
      "€€€€",
      "P₀ and P_k (Tier 2), noise L_WA, AF fan option, enclosure IP, terminal positions"
     ],
     [
      "Distribution transformer",
      "as above",
      "ABB RESIBLOC",
      "glass-fibre reinforced resin, high mechanical strength (see datasheet)",
      "€€€€",
      "climate class C2 / C3, P₀ / P_k, partial discharge ≤ 10 pC (routine test)"
     ],
     [
      "Distribution transformer",
      "as above",
      "Schneider Electric Trihal",
      "cast resin, E2-C2-F1 (see datasheet)",
      "€€€€",
      "losses class, temperature monitoring unit (type see datasheet), IP enclosure"
     ],
     [
      "Distribution transformer",
      "oil alternative (outdoor / kiosk)",
      "any maker, hermetically sealed, ONAN",
      "cheaper, quieter",
      "€€€ – €€€€",
      "oil pit / bund, fire separation, ester oil option"
     ]
    ]
   },
   {
    "id": "f_3",
    "t": "LV switchboards",
    "src": "guide 27 §F.3",
    "rows": [
     [
      "LV switchboard",
      "MDB: I_nA 1600 A, I_cw 36 kA 1 s, I_pk ≥ 75.6 kA, form 4b (or 3b), IP31 / IP54, ACB withdrawable, IEC TR 61641 arc test",
      "Siemens SIVACON S8",
      "busbar up to 7 000 A, I_cw up to 150 kA (see datasheet), forms up to 4b",
      "€€€€",
      "design-verification certificate, I_cw / I_pk of the chosen busbar, RDF"
     ],
     [
      "LV switchboard",
      "as above",
      "ABB MNS (MNS 3.0 / MNS Digital)",
      "modular withdrawable / plug-in technology, forms up to 4b (see datasheet)",
      "€€€€",
      "as above, arc-fault containment"
     ],
     [
      "LV switchboard",
      "as above",
      "Schneider Okken (large MDB) / PrismaSeT P (up to ≈ 4 000 A, see datasheet)",
      "Okken for MCC + PCC up to high currents (see datasheet)",
      "€€€ – €€€€",
      "busbar I_cw for 1 s, internal separation form"
     ],
     [
      "LV switchboard",
      "SD-ML1: I_nA 250–400 A, I_cw ≥ 15 kA (choose 25 kA), form 2b, 7 outgoing + 2 spare, SPD 2, meters",
      "Siemens SIVACON S4 / ALPHA, ABB System pro E power, Schneider PrismaSeT G/P",
      "wall or floor-standing distribution boards",
      "€€ – €€€",
      "I_cw / I_pk of the busbar, temperature rise verification, space for meters / CTs"
     ]
    ]
   },
   {
    "id": "f_4",
    "t": "Circuit breakers",
    "src": "guide 27 §F.4",
    "rows": [
     [
      "Circuit breaker",
      "-Q0 ACB 1600 A, 3 or 4 poles, I_cu ≥ 36 kA (I_cs = 100 %), I_cw 36 kA 1 s, withdrawable, LSIG trip unit with N sensor, maintenance mode (ERMS), Modbus / PROFINET",
      "Siemens 3WA air circuit breaker + ETU600 trip unit (see datasheet)",
      "630–6 300 A family",
      "€€€€",
      "I_cu / I_cs / I_cw at 415 V, trip unit functions (LSIG, ZSI, ERMS), communication module"
     ],
     [
      "Circuit breaker",
      "as above",
      "ABB Emax 2 (E2.2 for 1600 A) + Ekip Touch",
      "250–6 300 A family (E1.2 … E6.2)",
      "€€€€",
      "as above; Ekip Hi-Touch for ZSI / power quality"
     ],
     [
      "Circuit breaker",
      "as above",
      "Schneider MasterPact MTZ (MTZ1 / MTZ2) + MicroLogic X",
      "630–6 300 A family",
      "€€€€",
      "as above; digital modules"
     ],
     [
      "Circuit breaker",
      "-Q1 MCCB 200 A, electronic LSI, I_cu ≥ 25 kA (at the MDB 24.4 kA → choose 36 kA), t_sd adjustable 0.1 s, let-through curves for C.10.4",
      "Siemens 3VA2 with ETU5xx (LSI)",
      "100–1 000 A frames, breaking capacity classes (see datasheet)",
      "€€ – €€€",
      "I_cu at 415 V, I_sd / t_sd ranges, instantaneous override, I²t let-through curves"
     ],
     [
      "Circuit breaker",
      "as above",
      "ABB Tmax XT (XT4 250 A frame) + Ekip LSI",
      "XT1 – XT7 family 160–1 600 A",
      "€€ – €€€",
      "same"
     ],
     [
      "Circuit breaker",
      "as above",
      "Schneider ComPacT NSX250 + MicroLogic 5.2 (LSI)",
      "NSX 100–630 A family",
      "€€ – €€€",
      "same"
     ],
     [
      "Circuit breaker",
      "HMC branch MCCB 80 A, I_cu ≥ 15 kA at SD-ML1 (choose 25 kA), I_m adjustable 10–14 ×",
      "Siemens 3VA1 / 3VA2 (100 A frame), ABB Tmax XT2, Schneider ComPacT NSX100 (TM-D 80 A or MicroLogic)",
      "–",
      "€€",
      "adjustable I_m range, I_cu at 415 V, selectivity table with -Q1"
     ],
     [
      "Circuit breaker",
      "MCB C50 / C16, I_cn ≥ 15 kA at SD-ML1 (or back-up table)",
      "Siemens 5SY / 5SL, ABB S200 / S800 (high-performance), Schneider Acti9 iC60",
      "IEC 60898-1 / IEC 60947-2 ratings (see datasheet)",
      "€",
      "breaking capacity at 400 V by IEC 60947-2, energy class 3, back-up table with the upstream breaker"
     ]
    ]
   },
   {
    "id": "f_5",
    "t": "Busbar trunking",
    "src": "guide 27 §F.5",
    "rows": [
     [
      "Busbar trunking",
      "250 A (or 400 A for ML1 + ML2), Al or Cu, IP55, tap-off boxes with MCCB / fuse, housing as PE (check R_PE), I_cw ≥ 12.3 kA",
      "Siemens SIVACON 8PS – system BD2 (160–1 250 A range, see datasheet)",
      "plug-in tap-off units, IP54/55",
      "€€€ – €€€€ (per run)",
      "R / X per metre (hot), voltage drop table, I_cw, fire barriers, tap-off spacing"
     ],
     [
      "Busbar trunking",
      "as above",
      "Schneider Canalis KS (100–1 000 A range, see datasheet)",
      "tap-off every 0.5–1 m (see datasheet)",
      "€€€ – €€€€",
      "as above"
     ],
     [
      "Busbar trunking",
      "as above",
      "ABB / Zucchini MR / SCP families (see datasheet)",
      "–",
      "€€€ – €€€€",
      "as above"
     ]
    ]
   },
   {
    "id": "f_8",
    "t": "Surge protective devices",
    "src": "guide 27 §F.8",
    "rows": [
     [
      "Surge protective device",
      "MDB type 1+2, TN-S 4+0 (or 3+1), I_imp ≥ 12.5 kA/pole, U_p ≤ 1.5 kV, U_c ≥ 255 V, I_SCCR / I_fi ≥ 25 kA",
      "DEHN DEHNventil M2 TNS 255 (combined type 1+2, see datasheet)",
      "spark-gap based, I_imp per pole and U_p see datasheet",
      "€€",
      "I_imp per pole, U_p, follow-current extinguishing, max back-up fuse"
     ],
     [
      "Surge protective device",
      "as above",
      "Phoenix Contact FLASHTRAB SEC (T1+T2, see datasheet)",
      "–",
      "€€",
      "same"
     ],
     [
      "Surge protective device",
      "as above",
      "OBO V50 (type 1+2, 12.5 kA per pole class, see datasheet)",
      "–",
      "€€",
      "same"
     ],
     [
      "Surge protective device",
      "SD-ML1 type 2, I_n 20 kA, I_max 40 kA, U_p ≤ 1.5 kV, remote signalling contact",
      "DEHN DEHNguard M TNS 275 FM; Phoenix VALVETRAB SEC T2; OBO V20",
      "varistor based (see datasheet)",
      "€–€€",
      "U_c, I_n / I_max, U_p, back-up fuse, FM contact"
     ],
     [
      "Surge protective device",
      "type 3 at the CNC control supply",
      "DEHN DEHNrail M; Phoenix PLT-SEC / PT 2-PE; OBO ÜSM (see datasheet)",
      "–",
      "€",
      "U_p ≤ 1 kV, rated load current"
     ],
     [
      "Surge protective device",
      "data line SPD (copper Ethernet between buildings)",
      "DEHN DEHNpatch; Phoenix DT-LAN / BLOCKTRAB (see datasheet)",
      "–",
      "€",
      "category (Cat 5e / 6), PoE, U_p line–line"
     ]
    ]
   },
   {
    "id": "f_9",
    "t": "RCD type B and RCM",
    "src": "guide 27 §F.9",
    "rows": [
     [
      "RCD type B",
      "RCD type B (or B+), 4-pole, I_Δn 100 or 300 mA, short-time delayed (S) if upstream of other RCDs",
      "Doepke DFS 4 B (variants SK / NK, see datasheet)",
      "up to 125 A (see datasheet)",
      "€€",
      "I_n, I_Δn, type B / B+ frequency range, I_nc with back-up fuse"
     ],
     [
      "RCD type B",
      "as above",
      "Siemens 5SV3 type B / B+ (SIQUENCE, see datasheet)",
      "–",
      "€€",
      "same"
     ],
     [
      "RCD type B",
      "RCM type B (monitoring instead of tripping), pre-warning, relay outputs, Modbus",
      "Bender RCMA series (e.g. RCMA423, see datasheet); Bender RCMS (multi-channel)",
      "AC/DC-sensitive measuring current transformer + relay",
      "€€",
      "response range, frequency range, CT window size (5G25 / 4×95 must fit)"
     ],
     [
      "RCD type B",
      "electronic trip unit G function in the breaker (alternative)",
      "ACB / MCCB of F.4 with G",
      "–",
      "–",
      "N sensor, I_g range"
     ]
    ]
   },
   {
    "id": "f_12",
    "t": "Power meters",
    "src": "guide 27 §F.12",
    "rows": [
     [
      "Power meter",
      "machine / feeder meter, class 0.5S, x/5 A CT inputs, Modbus TCP",
      "Siemens SENTRON PAC3200",
      "class 0.5S active energy (see datasheet), Ethernet Modbus TCP",
      "€€",
      "accuracy class, communication options (PROFINET module?), harmonic values"
     ],
     [
      "Power meter",
      "incomer meter with power quality, class 0.2S, harmonics, PROFINET / Modbus",
      "Siemens SENTRON PAC4200",
      "class 0.2S (see datasheet), expansion modules",
      "€€",
      "harmonic orders, logging, PQ events"
     ],
     [
      "Power meter",
      "as above",
      "Janitza UMG 96-PA (machine) / UMG 509-PRO (incomer, with RCM channels)",
      "class 0.5S / 0.2S (see datasheet)",
      "€€ – €€€",
      "harmonic orders, memory, residual current inputs, OPC UA / Modbus"
     ],
     [
      "Power meter",
      "as above",
      "Schneider PowerLogic PM5000 series (e.g. PM5560)",
      "class 0.5S or 0.2S depending on model (see datasheet)",
      "€€",
      "as above"
     ],
     [
      "Power meter",
      "CTs",
      "100/5 A, 250/5 A, 1600/5 A, class 0.5S, 2.5–5 VA; split-core for retrofit",
      "–",
      "€",
      "ratio, class, burden, window size"
     ]
    ]
   },
   {
    "id": "f_13",
    "t": "Test instruments",
    "src": "guide 27 §F.13",
    "rows": [
     [
      "Test instrument",
      "multifunction installation tester: continuity 200 mA, insulation 250/500/1000 V, loop (high-current), RCD incl. type B, earth, phase sequence (IEC 61557)",
      "Fluke 1664 FC",
      "Fluke Connect, RCD type B test (see datasheet)",
      "€€",
      "type B RCD test, loop resolution (mΩ), CAT rating"
     ],
     [
      "Test instrument",
      "as above",
      "Metrel MI 3152 EurotestXC (or MI 3155 EurotestXD)",
      "–",
      "€€",
      "same"
     ],
     [
      "Test instrument",
      "as above",
      "Gossen Metrawatt PROFITEST MTECH+ / MXTRA / PRIME",
      "–",
      "€€",
      "same"
     ],
     [
      "Test instrument",
      "power-quality analyser IEC 61000-4-30 class A, 4 voltages + 4 currents, flexible CTs, 1-week logging",
      "Fluke 1777 / 1775 / 1773",
      "class A (1775/1777, see datasheet)",
      "€€€",
      "class A certificate, harmonics to 50th, transients, memory"
     ],
     [
      "Test instrument",
      "as above",
      "Hioki PQ3198",
      "class A (see datasheet)",
      "€€€",
      "same"
     ],
     [
      "Test instrument",
      "earth tester: 3-/4-pole, selective (clamp), stakeless, Wenner",
      "Fluke 1625-2 GEO",
      "–",
      "€€",
      "selective / stakeless kit included?"
     ],
     [
      "Test instrument",
      "insulation tester (motors, cables), up to 1 kV (5 kV for MV)",
      "Megger MIT400 series (MIT420/2) / MIT515 (5 kV)",
      "PI / DAR (see datasheet)",
      "€€",
      "test voltages, PI function"
     ],
     [
      "Test instrument",
      "leakage clamp meter (mA, true r.m.s., up to kHz)",
      "Fluke 368 FC / 369 FC; Hioki CM4002 (see datasheet)",
      "–",
      "€ – €€",
      "resolution, bandwidth, jaw size"
     ],
     [
      "Test instrument",
      "scope with differential probes (EMC troubleshooting)",
      "isolated-channel scope (e.g. Fluke ScopeMeter 190 series) or bench scope + differential probe",
      "CAT III isolated inputs",
      "€€ – €€€",
      "bandwidth ≥ 100 MHz, CAT rating"
     ]
    ]
   },
   {
    "id": "f_14",
    "t": "Thermal cameras",
    "src": "guide 27 §F.14",
    "rows": [
     [
      "Thermal camera",
      "electrical inspection: ≥ 160 × 120 px (better 320 × 240), NETD ≤ 0.05 K, focusable, report software",
      "FLIR E8 Pro / E54 / T540",
      "resolution increases with model (see datasheet)",
      "€€ – €€€",
      "detector resolution, NETD, lens options, IR windows compatible"
     ],
     [
      "Thermal camera",
      "as above",
      "Fluke TiS20+ / TiS60+",
      "(see datasheet)",
      "€€",
      "same"
     ],
     [
      "Thermal camera",
      "IR windows in MDB doors",
      "IRISS, FLIR IR windows (see datasheet)",
      "–",
      "€ – €€",
      "transmission, IP / arc rating"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item",
   "Spec (from this guide)",
   "Example",
   "Qty",
   "Class"
  ],
  "shop": [
   [
    "1",
    "feeder breaker -Q1 in the MDB",
    "MCCB 200 A LSI, I_cu 36 kA, t_sd 0.1 s, let-through proof C.10.4",
    "3VA2 / Tmax XT4 / NSX250",
    "1",
    "€€ – €€€"
   ],
   [
    "2",
    "feeder cable W1",
    "4×95+50 Cu XLPE 0.6/1 kV (or 5×95), 60 m + 10 %",
    "N2XY / NYCWY",
    "66 m",
    "€€€"
   ],
   [
    "3",
    "sub-distribution SD-ML1",
    "250–400 A, I_cw ≥ 15 kA (25 kA), main switch-disconnector 250 A, form 2b, IP54",
    "SIVACON / System pro E / PrismaSeT",
    "1",
    "€€€"
   ],
   [
    "4",
    "HMC breakers",
    "MCCB 80 A, I_cu ≥ 25 kA, I_m 10–14 ×",
    "3VA / XT2 / NSX100",
    "3 (+ 1 spare)",
    "€€"
   ],
   [
    "5",
    "VMC, WASH breakers",
    "MCB C50, I_cn ≥ 15 kA",
    "5SY / S200 / iC60",
    "2",
    "€"
   ],
   [
    "6",
    "robot, pallet pool breakers",
    "MCB C16",
    "5SY / S200 / iC60",
    "2",
    "€"
   ],
   [
    "7",
    "SPD type 2 in SD-ML1",
    "I_n 20 kA, U_p ≤ 1.5 kV, FM contact",
    "DEHNguard / VALVETRAB / V20",
    "1",
    "€–€€"
   ],
   [
    "8",
    "machine meters",
    "class 0.5S, Modbus TCP, CTs 100/5 A",
    "PAC3200 / UMG 96-PA / PM5560",
    "3 (+4 others)",
    "€€"
   ],
   [
    "9",
    "RCM type B (optional, per machine)",
    "AC/DC sensitive, pre-warning",
    "Bender RCMA",
    "3",
    "€€"
   ],
   [
    "10",
    "machine cables HMC",
    "5G25 flexible, 25 / 20 / 15 m + 10 %",
    "ÖLFLEX CLASSIC 110 / JZ-600",
    "66 m",
    "€€"
   ],
   [
    "11",
    "cable lugs, glands",
    "25 mm² tubular lugs M8, EMC glands for the cable OD",
    "–",
    "set",
    "€"
   ],
   [
    "12",
    "cable tray",
    "600 × 60 perforated, hot-dip galvanised, earthed divider, bends, supports",
    "OBO / Niedax",
    "≈ 60 m",
    "€€€"
   ],
   [
    "13",
    "signal tray level",
    "wire mesh 300 mm",
    "Cablofil",
    "≈ 60 m",
    "€€"
   ],
   [
    "14",
    "bonding",
    "16–25 mm² Cu braids for machine bases and tray joints; mesh connection lugs",
    "–",
    "set",
    "€"
   ],
   [
    "15",
    "network cable",
    "PROFINET type A + FastConnect plugs",
    "IE FC TP GP 2×2",
    "≈ 300 m",
    "€€"
   ],
   [
    "16",
    "test service",
    "IEC 60364-6 initial verification + 1-week PQ log + thermography after 1 month",
    "electrician / service company",
    "1",
    "€€ – €€€"
   ],
   [
    "17",
    "PFC (factory level, not only ML1)",
    "200 kvar detuned 7 %",
    "VarSet / TDK",
    "1",
    "€€€"
   ]
  ],
  "shopM": 3,
  "shopP": 5,
  "shopW": [
   4,
   18,
   32,
   20,
   14,
   12
  ],
  "shopTab": "Shopping list – supply of the 3-HMC line",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – supply of the 3-HMC line ML1 (guide 27 §F.15). The same list is shown in the item-4 card.",
  "price": "Price classes (guide 27, per piece, without installation): € < 300 € · €€ 300 – 3 000 € · €€€ 3 000 – 30 000 € · €€€€ > 30 000 € – estimate, ask for a quote.",
  "shopNote": "The machine makers supply the machine-internal parts (drives, filters, motor cables, encoder cables). Ask them which line filter, reactor and EMC category are built in – then you do not buy them twice.",
  "ph": "(e.g. Emax 2, NSX250, DEHNguard, Fluke 1664)"
 },
 "4": {
  "guide": "guide 27",
  "drawings": [
   {
    "f": "27_common_mode_path.svg",
    "t": "Common-mode current path of a drive",
    "c": "Common-mode current path of a PWM drive: planned return over the shield and the filter Y-capacitor, unplanned return over machine bed, building earth, encoder shield and bearing",
    "g": "guide 27 §B.1"
   },
   {
    "f": "27_cable_tray_segregation.svg",
    "t": "Cable tray segregation",
    "c": "Tray cross-sections: as found (12 failing pairs), good with earthed divider, good by distance; separation matrix, EN 50174-2 classes and tray levels",
    "g": "guide 27 §B.3"
   },
   {
    "f": "27_shield_connection.svg",
    "t": "Shield connection + cabinet EMC zones",
    "c": "Pigtail versus 360° clamp with the numbers, and the cabinet EMC zones: dirty zone with filter and drives, clean zone with CNC, PSU and I/O, ≥ 200 mm apart",
    "g": "guide 27 §B.4"
   }
  ],
  "groups": [
   {
    "id": "f_6",
    "t": "Cables",
    "src": "guide 27 §F.6",
    "rows": [
     [
      "Cable",
      "feeder 4×95+50 (or 5×95), Cu, XLPE, 0.6/1 kV, tray installation, CPR class per national rule",
      "Nexans / Prysmian / Lapp / Helukabel: N2XY (XLPE), NYCWY 4×95/50 (concentric PE screen), NYY-J 5×95 (PVC)",
      "IEC 60502-1 / national types",
      "€€€ (per 60 m)",
      "conductor class, R₂₀, outer diameter (tray fill), bending radius, CPR class"
     ],
     [
      "Cable",
      "machine feed 5G25 (HMC), flexible, oil-resistant",
      "Lapp ÖLFLEX CLASSIC 110 5G25; Helukabel JZ-600 5G25",
      "0.6/1 kV (see datasheet), fine-stranded class 5",
      "€€ (per 25 m)",
      "U0/U, oil resistance, temperature, outer diameter for the gland"
     ],
     [
      "Cable",
      "as above with overall screen (EMC at machine entry, if the maker asks)",
      "Lapp ÖLFLEX CLASSIC 110 CY; Helukabel JZ-600-Y-CY",
      "Cu braid (coverage see datasheet)",
      "€€",
      "screen coverage %, transfer impedance"
     ],
     [
      "Cable",
      "motor cable from drive (if supplied by you): symmetric 3 + 3 PE, overall screen",
      "Lapp ÖLFLEX SERVO 2YSLCY-JB; Helukabel TOPFLEX-EMV-2YSLCY-J / TOPFLEX-EMV-UV-2YSLCYK-J; Lapp ÖLFLEX EMV-FC (if in the current catalogue – check)",
      "PE/XLPE core insulation (low capacitance), symmetric design",
      "€€",
      "capacitance per metre, transfer impedance, drag-chain rating if moving"
     ],
     [
      "Cable",
      "encoder / feedback",
      "drive maker's cables only (e.g. Siemens MOTION-CONNECT 500 / 800PLUS, Heidenhain cables)",
      "pre-assembled, tested",
      "€€",
      "length, connector type, drag-chain rating"
     ],
     [
      "Cable",
      "PROFINET type A fixed",
      "Siemens IE FC TP Standard Cable GP 2×2 (6XV1840-2AH10); Lapp ETHERLINE PN Cat.5e",
      "100 Ω, star-quad, green",
      "€ (per 10 m)",
      "type A / B / C, outer diameter for FastConnect plugs"
     ],
     [
      "Cable",
      "4–20 mA analog",
      "2 × 0.5 mm² twisted pair, overall screen (e.g. Lapp UNITRONIC LiYCY (TP), Helukabel PAAR-TRONIC-CY)",
      "–",
      "€",
      "screen, pair twist, outer diameter"
     ]
    ]
   },
   {
    "id": "f_7",
    "t": "Cable trays and dividers",
    "src": "guide 27 §F.7",
    "rows": [
     [
      "Cable tray",
      "perforated steel tray 600 × 60 mm, hot-dip galvanised, continuous earthed divider, bonded joints, load per span",
      "OBO Bettermann RKS-Magic / MKS trays with separator (see catalogue)",
      "quick-connect joints with electrical continuity (see datasheet)",
      "€€ (per 3 m)",
      "load-span diagram, divider order code, electrical continuity of joints, corrosion class"
     ],
     [
      "Cable tray",
      "as above",
      "Niedax RL / MKR trays with divider (see catalogue)",
      "–",
      "€€",
      "same"
     ],
     [
      "Cable tray",
      "wire mesh tray for signal / network level",
      "Legrand Cablofil CF54 / CF105 series (see catalogue)",
      "light, open, good for short drops",
      "€–€€",
      "earth continuity accessory, dividers"
     ],
     [
      "Cable tray",
      "bonding straps / braids",
      "OBO, Niedax, Phoenix, Erico: flat Cu braid 16–25 mm² with lugs",
      "–",
      "€",
      "cross-section, length ≤ 5 × width for HF"
     ]
    ]
   },
   {
    "id": "f_10",
    "t": "Power-factor correction and harmonic mitigation",
    "src": "guide 27 §F.10",
    "rows": [
     [
      "Power-factor correction",
      "detuned PFC 200 kvar at 400 V, p = 7 % (f_r 189 Hz), capacitors 440/480 V, 4 × 50 kvar steps (or 25 + 25 + 50 + 50 + 50), controller, fans",
      "Schneider VarSet detuned (DR) cubicle (see datasheet)",
      "complete cubicle",
      "€€€",
      "effective kvar at 400 V, p %, capacitor voltage, losses, controller (THD alarm)"
     ],
     [
      "Power-factor correction",
      "components for a panel builder",
      "TDK (Epcos) PhaseCap capacitors + detuning reactors + BR6000 / BR7000 controller (see datasheet)",
      "–",
      "€€ – €€€",
      "capacitor voltage, inrush-limiting contactors, reactor linearity"
     ],
     [
      "Power-factor correction",
      "active harmonic filter ≥ 180 A (C.15.4)",
      "Schaffner ECOsine Active Sync; ABB PQF; Schneider AccuSine (see datasheet)",
      "parallel connection with CTs",
      "€€€ – €€€€",
      "compensation current, harmonic range, response time"
     ],
     [
      "Power-factor correction",
      "passive harmonic filter for a single large drive",
      "Schaffner ECOsine passive (FN 34xx series, see datasheet)",
      "THDi ≈ 5–10 % at full load (see datasheet)",
      "€€ – €€€",
      "THDi vs load, capacitive at low load?"
     ],
     [
      "Power-factor correction",
      "line reactor 3–4 % for a drive (if not built in)",
      "Siemens SINAMICS line reactor for the drive frame size; Schaffner RWK line reactors (see datasheet)",
      "u_k 2–4 %",
      "€–€€",
      "u_k at rated current, losses, rated current ≥ drive input"
     ]
    ]
   },
   {
    "id": "f_11",
    "t": "EMC parts",
    "src": "guide 27 §F.11",
    "rows": [
     [
      "EMC part",
      "3-phase filter for drives, ≥ 65 A at cabinet temperature, 480 V class, low leakage version if RCD",
      "Schaffner FN 3258 (sizes up to 180 A, choose 75 A or 100 A rating, see datasheet)",
      "book-style for drive cabinets",
      "€€",
      "rated current at 50 °C, leakage current (normal / phase loss), insertion loss curve"
     ],
     [
      "EMC part",
      "common-mode cores for motor cables",
      "VAC VITROPERM nanocrystalline cores; Würth WE-CMBNC / TDK ferrite rings (see datasheet)",
      "μr, A_e, l_e",
      "€",
      "impedance vs frequency, saturation current, inner diameter"
     ],
     [
      "EMC part",
      "snap-on ferrites for signal / network cables",
      "Würth WE-STAR-TEC / WE-AFB; TDK ZCAT (see datasheet)",
      "impedance at 100 MHz",
      "€",
      "cable diameter, impedance curve"
     ],
     [
      "EMC part",
      "EMC cable glands (360° shield contact)",
      "PFLITSCH blueglobe TRI; Lapp SKINTOP MS-SC-M; icotek EMC entry systems (see catalogue)",
      "metal, IP68 (see datasheet)",
      "€",
      "clamping range, shield contact type"
     ],
     [
      "EMC part",
      "shield clamps on a busbar / mounting plate",
      "Phoenix Contact SK 8 / SK 14 / SK 20 / SK 35 + NLS busbar; Weidmüller KLBÜ",
      "clamping range per size",
      "€",
      "clamping range vs cable outer diameter under the jacket"
     ],
     [
      "EMC part",
      "flyback diodes / RC suppressors",
      "contactor maker's plug-in modules (Siemens 3RT2 RC/varistor, ABB, Schneider)",
      "–",
      "€",
      "voltage, effect on release time"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item",
   "Spec (from this guide)",
   "Example",
   "Qty",
   "Class"
  ],
  "shop": [
   [
    "1",
    "feeder breaker -Q1 in the MDB",
    "MCCB 200 A LSI, I_cu 36 kA, t_sd 0.1 s, let-through proof C.10.4",
    "3VA2 / Tmax XT4 / NSX250",
    "1",
    "€€ – €€€"
   ],
   [
    "2",
    "feeder cable W1",
    "4×95+50 Cu XLPE 0.6/1 kV (or 5×95), 60 m + 10 %",
    "N2XY / NYCWY",
    "66 m",
    "€€€"
   ],
   [
    "3",
    "sub-distribution SD-ML1",
    "250–400 A, I_cw ≥ 15 kA (25 kA), main switch-disconnector 250 A, form 2b, IP54",
    "SIVACON / System pro E / PrismaSeT",
    "1",
    "€€€"
   ],
   [
    "4",
    "HMC breakers",
    "MCCB 80 A, I_cu ≥ 25 kA, I_m 10–14 ×",
    "3VA / XT2 / NSX100",
    "3 (+ 1 spare)",
    "€€"
   ],
   [
    "5",
    "VMC, WASH breakers",
    "MCB C50, I_cn ≥ 15 kA",
    "5SY / S200 / iC60",
    "2",
    "€"
   ],
   [
    "6",
    "robot, pallet pool breakers",
    "MCB C16",
    "5SY / S200 / iC60",
    "2",
    "€"
   ],
   [
    "7",
    "SPD type 2 in SD-ML1",
    "I_n 20 kA, U_p ≤ 1.5 kV, FM contact",
    "DEHNguard / VALVETRAB / V20",
    "1",
    "€–€€"
   ],
   [
    "8",
    "machine meters",
    "class 0.5S, Modbus TCP, CTs 100/5 A",
    "PAC3200 / UMG 96-PA / PM5560",
    "3 (+4 others)",
    "€€"
   ],
   [
    "9",
    "RCM type B (optional, per machine)",
    "AC/DC sensitive, pre-warning",
    "Bender RCMA",
    "3",
    "€€"
   ],
   [
    "10",
    "machine cables HMC",
    "5G25 flexible, 25 / 20 / 15 m + 10 %",
    "ÖLFLEX CLASSIC 110 / JZ-600",
    "66 m",
    "€€"
   ],
   [
    "11",
    "cable lugs, glands",
    "25 mm² tubular lugs M8, EMC glands for the cable OD",
    "–",
    "set",
    "€"
   ],
   [
    "12",
    "cable tray",
    "600 × 60 perforated, hot-dip galvanised, earthed divider, bends, supports",
    "OBO / Niedax",
    "≈ 60 m",
    "€€€"
   ],
   [
    "13",
    "signal tray level",
    "wire mesh 300 mm",
    "Cablofil",
    "≈ 60 m",
    "€€"
   ],
   [
    "14",
    "bonding",
    "16–25 mm² Cu braids for machine bases and tray joints; mesh connection lugs",
    "–",
    "set",
    "€"
   ],
   [
    "15",
    "network cable",
    "PROFINET type A + FastConnect plugs",
    "IE FC TP GP 2×2",
    "≈ 300 m",
    "€€"
   ],
   [
    "16",
    "test service",
    "IEC 60364-6 initial verification + 1-week PQ log + thermography after 1 month",
    "electrician / service company",
    "1",
    "€€ – €€€"
   ],
   [
    "17",
    "PFC (factory level, not only ML1)",
    "200 kvar detuned 7 %",
    "VarSet / TDK",
    "1",
    "€€€"
   ]
  ],
  "shopM": 3,
  "shopP": 5,
  "shopW": [
   4,
   18,
   32,
   20,
   14,
   12
  ],
  "shopTab": "Shopping list – supply of the 3-HMC line",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list – supply of the 3-HMC line ML1 (guide 27 §F.15; cables, trays, bonding and network cable are pos. 2, 10 – 15).",
  "price": "Price classes (guide 27, per piece, without installation): € < 300 € · €€ 300 – 3 000 € · €€€ 3 000 – 30 000 € · €€€€ > 30 000 € – estimate, ask for a quote.",
  "shopNote": "The machine makers supply the machine-internal parts (drives, filters, motor cables, encoder cables). Ask them which line filter, reactor and EMC category are built in – then you do not buy them twice.",
  "ph": "(e.g. FN 3258, SKINTOP, Cablofil, ÖLFLEX)"
 },
 "5": {
  "guide": "guide 28",
  "drawings": [
   {
    "f": "28_gantt_critical_path.svg",
    "t": "Gantt chart + critical path",
    "c": "Gantt chart with the critical path of the app's CPM plan (HMC-01 and 3-machine line)",
    "g": "guide 28 §A1"
   },
   {
    "f": "28_lift_plan.svg",
    "t": "Lift plan – 4-leg sling + spreader",
    "c": "Lift plan: 4-leg sling with CoG offset and spreader beam, with the lift data sheet",
    "g": "guide 28 §A4"
   },
   {
    "f": "28_commissioning_sequence.svg",
    "t": "Commissioning sequence with gates",
    "c": "Commissioning sequence – flow chart with gates",
    "g": "guide 28 §A6"
   },
   {
    "f": "28_capability_histogram.svg",
    "t": "Capability histogram (Cp / Cpk)",
    "c": "Capability histogram of data set A with LSL, USL, mean and ±3s",
    "g": "guide 28 §A7"
   },
   {
    "f": "28_sling_angle_factor.svg",
    "t": "Sling angle factor + leg force",
    "c": "Sling angle factor, leg force vs angle and mode factors",
    "g": "guide 28 §D4"
   },
   {
    "f": "28_crane_outrigger_ground_pressure.svg",
    "t": "Crane outrigger + ground pressure",
    "c": "Mobile crane outrigger force, mat size and ground pressure",
    "g": "guide 28 §D7"
   },
   {
    "f": "28_air_network_ring_main.svg",
    "t": "Compressed-air ring main",
    "c": "Compressed-air system: compressor room, treatment, ring main and drops",
    "g": "guide 28 §E1"
   },
   {
    "f": "28_coolant_central_system.svg",
    "t": "Central coolant system",
    "c": "Central coolant system with flume, filtration, clean tank, mixer, chips and mist",
    "g": "guide 28 §E2"
   }
  ],
  "groups": [
   {
    "id": "g1_1",
    "t": "Slings, chains, shackles, lifting points",
    "src": "guide 28 §G1.1",
    "rows": [
     [
      "Slings, chains, shackles, lifting points",
      "Round slings, polyester, EN 1492-2, WLL 6 t (band rule) or 5 t (controlled 30°), length so that θ ≈ 30°, 4 pcs",
      "SpanSet round slings (standard polyester and high-performance ranges)",
      "WLL by colour (red 5 t, brown 6 t), length: see catalogue",
      "€ per sling",
      "WLL straight / choke / basket, length tolerance, label, protective sleeve, edge protection system"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "as above",
      "Dolezych DoRo® round slings",
      "EN 1492-2, colour code: see catalogue",
      "€",
      "as above, cut-resistant sleeves"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "4-leg chain sling grade 8 16 mm (16.8 t at 0–45°) or grade 10 13 mm, with shorteners",
      "RUD chain systems (VIP grade 100, ICE grade 120)",
      "WLL per leg and assembly table: see catalogue",
      "€–€€",
      "grade, nominal size, WLL 1/2/3–4 legs by angle band, shortening hooks, ID tag / RFID"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "as above",
      "pewag winner chain systems (grade 10 / 12 ranges)",
      "see catalogue",
      "€–€€",
      "as above"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "Bow shackle 4.75 t, bolt type with nut + split pin, 4 pcs",
      "Crosby G-2130 (bolt type anchor shackle) / G-209 (screw pin)",
      "WLL 4¾ t size 3/4\": see datasheet",
      "€",
      "WLL, MBL (design factor), pin Ø, inside width / length (sling fits?), side-load table"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "as above",
      "Green Pin bolt-type / standard anchor shackles",
      "WLL 4.75 t class: see datasheet",
      "€",
      "as above, certificate"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "Rotating lifting points M24–M30 for parts without lugs",
      "RUD VLBG rotating load rings, RUD PowerPoint range",
      "WLL per thread, all directions: see datasheet",
      "€",
      "WLL at 0° / 90°, tightening torque, thread engagement, marking"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "as above",
      "JDT (J.D. Theile) lifting points",
      "see catalogue",
      "€",
      "as above"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "Eyebolts DIN 580 / eye nuts DIN 582 (light parts only)",
      "any DIN 580 maker",
      "axial WLL + angle table (D5.2)",
      "€",
      "material C15E, marking, angle table"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "Edge protection",
      "sleeves and corner protectors from the sling maker",
      "cut resistance: see datasheet",
      "€",
      "suitable for the sling type"
     ],
     [
      "Slings, chains, shackles, lifting points",
      "Load link / dynamometer to check the real weight",
      "Straightpoint (Crosby) load cells, Tractel Dynafor",
      "capacity e.g. 25 t: see datasheet",
      "€€",
      "capacity, accuracy, wireless display, certificate"
     ]
    ]
   },
   {
    "id": "g1_2",
    "t": "Spreader and lifting beams",
    "src": "guide 28 §G1.2",
    "rows": [
     [
      "Spreader and lifting beams",
      "Spreader beam ≥ 15 t, span 2.4 m, several hook holes / adjustable",
      "Modulift modular spreader beams (MOD range)",
      "capacity vs span tables: see catalogue",
      "€€ (buy) / € (rent)",
      "capacity at the span and sling angle, mass, top-leg angle, certificate EN 13155"
     ],
     [
      "Spreader and lifting beams",
      "Fixed beam for the HMC (made locally)",
      "local fabricator, design per EN 13155 / ASME BTH-1, proof test",
      "design calc + test certificate",
      "€€",
      "calculation, proof load test, marking (WLL, self-weight)"
     ]
    ]
   },
   {
    "id": "g1_3",
    "t": "Skates, jacks, cribbing",
    "src": "guide 28 §G1.3",
    "rows": [
     [
      "Skates, jacks, cribbing",
      "Machine skates 4 × ≥ 6 t (3 carry 39.2 kN each), 2 steerable",
      "Hilman Rollers roller sets",
      "capacity per roller, steel / polyurethane wheels: see catalogue",
      "€€ set",
      "capacity, roller material, swivel top, height, floor protection"
     ],
     [
      "Skates, jacks, cribbing",
      "as above",
      "GKS-Perfekt transport skates",
      "see catalogue",
      "€€",
      "as above"
     ],
     [
      "Skates, jacks, cribbing",
      "as above",
      "other European makers (e.g. Wagner, local rigging suppliers)",
      "see catalogue",
      "€–€€",
      "as above"
     ],
     [
      "Skates, jacks, cribbing",
      "Hydraulic jacks 10 t, 2–4 pcs + hand pump 700 bar",
      "Enerpac RC series cylinders (e.g. RC-106 10 t), hand pump P-392",
      "stroke, collapsed height: see datasheet",
      "€ each",
      "capacity, stroke, min height, saddle, lock nut, gauge"
     ],
     [
      "Skates, jacks, cribbing",
      "Toe jacks for low bases",
      "Enerpac toe jacks",
      "toe and head capacity: see datasheet",
      "€",
      "capacity on the toe (lower than on the head), min toe height"
     ],
     [
      "Skates, jacks, cribbing",
      "Cribbing / hardwood blocks, steel plates 20 mm (400 × 400 and larger)",
      "local supplier",
      "–",
      "€",
      "plate flatness, edges deburred"
     ]
    ]
   },
   {
    "id": "g1_4",
    "t": "Air pads",
    "src": "guide 28 §G1.4",
    "rows": [
     [
      "Air pads",
      "4-module air-caster set ≥ 15 t, for a sealed floor",
      "AeroGo air casters / rigging systems",
      "capacity per module, air pressure + flow: see datasheet",
      "€€–€€€ (often rented)",
      "air consumption at load (compressor needed?), floor requirements, steering"
     ],
     [
      "Air pads",
      "as above",
      "Solving air-film movers",
      "see datasheet",
      "€€–€€€",
      "as above"
     ]
    ]
   },
   {
    "id": "g1_5",
    "t": "Forklifts and cranes",
    "src": "guide 28 §G1.5",
    "rows": [
     [
      "Forklifts and cranes",
      "Heavy forklift 16 t at 1 200 mm (Q_act 13.2 t at 1 600 mm)",
      "Kalmar DCG160-12 class (similar classes from other heavy-truck makers)",
      "rated capacity / load centre: see datasheet",
      "hire per day",
      "capacity plate with attachments, front axle load laden, tyre type, mast height, fork length"
     ],
     [
      "Forklifts and cranes",
      "Mobile crane, chart ≥ 15.15 t at the needed radius",
      "Liebherr LTM 1060-3.1 / LTM 1090-4.2 class, Tadano, Grove",
      "load chart, outrigger base, counterweight: see load chart",
      "hire per day/hour",
      "chart value at radius incl. hook block, outrigger force (maker tool), access, set-up area, operator certificate"
     ],
     [
      "Forklifts and cranes",
      "Outrigger mats sized for 530 kN on 200 kPa ground (≥ 2.65 m²)",
      "composite outrigger pads (e.g. DICA), steel / timber crane mats",
      "rated load, size: see datasheet",
      "€–€€ (often supplied by the crane company)",
      "area, rated load, stiffness, handling weight"
     ]
    ]
   },
   {
    "id": "g1_6",
    "t": "Transport preservation and monitoring",
    "src": "guide 28 §G1.6",
    "rows": [
     [
      "Transport preservation and monitoring",
      "Shock indicator labels on the crate",
      "ShockWatch (e.g. ShockWatch 2 labels)",
      "g-ratings chosen by package mass: see datasheet",
      "€",
      "rating for the package mass, activation evidence, instructions label"
     ],
     [
      "Transport preservation and monitoring",
      "Tilt indicator",
      "TiltWatch (Plus / XTR)",
      "tilt angle: see datasheet",
      "€",
      "angle, tamper evident"
     ],
     [
      "Transport preservation and monitoring",
      "Electronic shock + tilt + climate logger",
      "ShockWatch ShockLog, testo 184 loggers (e.g. G1 with shock)",
      "ranges, memory, battery: see datasheet",
      "€–€€",
      "measured axes, g-range, time stamp, report software (offline use)"
     ],
     [
      "Transport preservation and monitoring",
      "VCI film for wrapping",
      "Cortec VpCI-126 film",
      "protection time, thickness: see datasheet",
      "€ per roll",
      "metals protected, time, size, recyclability"
     ],
     [
      "Transport preservation and monitoring",
      "Desiccant bags (DIN 55473 units) + humidity indicator cards",
      "packing suppliers",
      "units per bag",
      "€",
      "quantity per DIN 55474 calculation"
     ]
    ]
   },
   {
    "id": "g1_7",
    "t": "Compressed air",
    "src": "guide 28 §G1.7",
    "rows": [
     [
      "Compressed air",
      "Oil-injected screw, VSD, 11–15 kW, 7 bar, FAD range covering 0.5–2.2 m³/min",
      "Atlas Copco GA 11 VSD+ / GA 15 VSD+",
      "FAD vs pressure, specific power: see datasheet",
      "€€–€€€",
      "FAD at 7 bar (ISO 1217 Annex E), min/max flow of the VSD range, noise, integrated dryer option, heat recovery"
     ],
     [
      "Compressed air",
      "as above",
      "Kaeser SK / ASD series with SFC (VSD)",
      "see datasheet",
      "€€–€€€",
      "as above, control (SIGMA CONTROL)"
     ],
     [
      "Compressed air",
      "as above",
      "BOGE S-4 series (VSD versions)",
      "see datasheet",
      "€€–€€€",
      "as above"
     ],
     [
      "Compressed air",
      "Air receiver 500 L, 11 bar, galvanised, with safety valve and zero-loss drain",
      "any approved maker (EU Pressure Equipment Directive 2014/68/EU / simple pressure vessels 2014/29/EU)",
      "volume, PS: see datasheet",
      "€",
      "PS, test certificate, inspection rules (national)"
     ],
     [
      "Compressed air",
      "Refrigeration dryer PDP +3 °C for ≥ 1.2 m³/min (+ summer margin)",
      "Atlas Copco FX range, Kaeser Secotec, BEKO DRYPOINT RA",
      "flow at reference conditions + correction factors: see datasheet",
      "€–€€",
      "correction factors for 35 °C / 7 bar, Δp, refrigerant, energy"
     ],
     [
      "Compressed air",
      "Filters 1 µm + 0.01 µm (+ carbon for measuring air)",
      "Parker OIL-X, Atlas Copco UD+ / DD+ / PD+, Donaldson compressed-air filters",
      "flow, Δp, oil carry-over: see datasheet",
      "€",
      "grade, flow at 7 bar, Δp clean, element life, ISO 12500 test data"
     ],
     [
      "Compressed air",
      "Zero-loss drains + oil-water separator",
      "BEKO BEKOMAT drains, BEKO ÖWAMAT separators",
      "flow / compressor size: see datasheet",
      "€",
      "sized for summer condensate, discharge limit"
     ],
     [
      "Compressed air",
      "Aluminium ring main (32 mm ID class → check real ID), push-fit",
      "Parker Transair, Teseo (HBS/AP), Atlas Copco AIRnet",
      "inner diameters, pressure rating, fittings: see catalogue",
      "€€ (line)",
      "real ID (Δp!), max pressure / temperature, drop brackets, section valves"
     ],
     [
      "Compressed air",
      "Filter-regulator + lockable valve + pressure switch at each drop",
      "Festo MS6 series, SMC AW / AC series, Norgren Excelon",
      "flow at Δp, filter grade: see datasheet",
      "€ per drop",
      "flow at 0.1 bar Δp, auto drain, lockable shut-off (LOTO), gauge"
     ],
     [
      "Compressed air",
      "Portable dew-point meter",
      "Vaisala hand-held dew-point meters, CS Instruments (e.g. DP 400 mobile)",
      "range −60 … +20 °C class: see datasheet",
      "€€",
      "accuracy at +3 °C, response time, sampling cell"
     ],
     [
      "Compressed air",
      "Thermal mass flow meter in the main",
      "CS Instruments VA 500 / VA 520, SUTO S401",
      "range, pipe size: see datasheet",
      "€–€€",
      "pipe ID, range, output (4–20 mA, Modbus) for the energy monitoring"
     ],
     [
      "Compressed air",
      "Ultrasonic leak detector / acoustic camera",
      "Fluke ii900 / ii910, UE Systems Ultraprobe, SDT",
      "sensitivity: see datasheet",
      "€€–€€€",
      "distance, leak-rate estimate, report"
     ]
    ]
   },
   {
    "id": "g1_8",
    "t": "Coolant and its care",
    "src": "guide 28 §G1.8",
    "rows": [
     [
      "Coolant and its care",
      "Emulsion / semi-synthetic for grey cast iron, 5–8 %, boron- and formaldehyde-donor-free if required",
      "Blaser Swisslube (Blasocut, B-Cool, Vasco ranges), FUCHS ECOCOOL, Castrol Hysol / Alusol",
      "refractometer factor k, pH, recommended %: see datasheet",
      "€ per 200 L drum",
      "k factor, materials (cast iron!), water hardness range, foam, skin compatibility, SDS, approvals of the machine maker"
     ],
     [
      "Coolant and its care",
      "Digital refractometer 0–53 % Brix",
      "ATAGO PAL-1, ATAGO MASTER series (hand)",
      "resolution 0.1 % Brix, temp. compensation: see datasheet",
      "€",
      "range, ATC, IP rating"
     ],
     [
      "Coolant and its care",
      "as above",
      "other makers (some metrology suppliers sell refractometers – see catalogue)",
      "–",
      "€",
      "–"
     ],
     [
      "Coolant and its care",
      "pH meter / strips, nitrite strips, dip slides",
      "coolant supplier kits; e.g. Merck / MQuant test strips",
      "ranges: see datasheet",
      "€",
      "range, reading interval"
     ],
     [
      "Coolant and its care",
      "Proportional mixer (concentrate into water)",
      "Dosatron proportional dosing pumps, mixers from the coolant supplier",
      "dosing range %, flow: see datasheet",
      "€",
      "dosing range covers 5–8 %, flow L/min, materials"
     ],
     [
      "Coolant and its care",
      "Tramp-oil skimmer / coalescer",
      "Abanaki belt skimmers, coalescers from filter makers",
      "removal rate: see datasheet",
      "€",
      "removal rate, tank access"
     ]
    ]
   },
   {
    "id": "g1_9",
    "t": "Central coolant filtration, chip conveyors, briquetting",
    "src": "guide 28 §G1.9",
    "rows": [
     [
      "Central coolant filtration, chip conveyors, briquetting",
      "Central filtration ≈ 240 L/min, cast iron, 20 µm (TSC 10–25 µm), clean tank 2.4–3.6 m³",
      "Knoll (band / drum / vacuum filters), MAYFRAN (e.g. ConSep separators, filters), LiquidTool, LOSMA",
      "flow, fineness, tank volume: see datasheet",
      "€€€–€€€€",
      "fineness at flow, media cost per year, sludge discharge, standby pump, chiller, footprint, flume design"
     ],
     [
      "Central coolant filtration, chip conveyors, briquetting",
      "Chip conveyor for cast-iron fines (scraper / magnetic / with drum filter)",
      "MAYFRAN, Knoll, LNS (Turbo conveyors)",
      "type, capacity, discharge height: see datasheet",
      "€€",
      "type for cast iron, discharge height, filter integrated, coolant return"
     ],
     [
      "Central coolant filtration, chip conveyors, briquetting",
      "Briquetting press for cast-iron chips",
      "RUF, WEIMA",
      "throughput kg/h, briquette size / density: see datasheet",
      "€€€",
      "throughput ≫ 15 kg/h per machine, coolant recovery, noise"
     ]
    ]
   },
   {
    "id": "g1_10",
    "t": "Oil-mist collectors",
    "src": "guide 28 §G1.10",
    "rows": [
     [
      "Oil-mist collectors",
      "Per HMC ≈ 1 800 m³/h, emulsion mist, final stage H13 if air is recirculated",
      "Absolent multi-stage filter units",
      "flow, stages, filter classes: see datasheet",
      "€€",
      "flow at real Δp, filter classes (EN 1822 / ISO 16890), filter life, drain, noise, mounting on the roof of the HMC"
     ],
     [
      "Oil-mist collectors",
      "as above",
      "Filtermist FX range (centrifugal)",
      "flow: see datasheet",
      "€–€€",
      "efficiency on smoke, after-filter option"
     ],
     [
      "Oil-mist collectors",
      "as above",
      "LOSMA mist collectors",
      "see datasheet",
      "€–€€",
      "as above"
     ],
     [
      "Oil-mist collectors",
      "as above",
      "Nederman oil-mist filters",
      "see datasheet",
      "€–€€",
      "as above"
     ]
    ]
   },
   {
    "id": "g1_11",
    "t": "Network",
    "src": "guide 28 §G1.11",
    "rows": [
     [
      "Network",
      "Managed industrial switch, 8 ports, VLAN, DIN rail 24 V",
      "Siemens SCALANCE XC208, Hirschmann (Belden) RSP / BOBCAT, Moxa EDS-408A",
      "ports, VLAN, redundancy, PROFINET: see datasheet",
      "€",
      "VLAN, IGMP, ring redundancy, temperature range, PROFINET conformance class"
     ],
     [
      "Network",
      "Industrial firewall / secure router between OT and IT",
      "Siemens SCALANCE SC-600 (e.g. SC642-2C), Moxa EDR-810, Phoenix Contact mGuard",
      "throughput, VPN: see datasheet",
      "€–€€",
      "rule sets, VPN for remote service, logging"
     ],
     [
      "Network",
      "OPC UA test client",
      "Unified Automation UaExpert (free download, runs offline)",
      "–",
      "free",
      "–"
     ],
     [
      "Network",
      "MTConnect agent",
      "open-source cppagent (MTConnect Institute) on the edge PC",
      "–",
      "free",
      "adapter for the CNC brand"
     ]
    ]
   },
   {
    "id": "g1_12",
    "t": "Capability measurement",
    "src": "guide 28 §G1.12",
    "rows": [
     [
      "Capability measurement",
      "CMM for first-article and SAT (crankcase, bores 62 H7)",
      "Zeiss CONTURA / ACCURA, Mitutoyo CRYSTA-Apex S / V, Hexagon GLOBAL S",
      "measuring volume, MPE_E (ISO 10360-2): see datasheet",
      "€€€€",
      "volume for the crankcase, MPE at 20 °C, temperature range, software, probe system"
     ],
     [
      "Capability measurement",
      "Air plug gauge Ø62 H7 + digital column / electronic unit",
      "Marposs, Stotz, Mahr Millimar",
      "resolution 0.1 µm, range: see datasheet",
      "€€",
      "measuring range, nozzles at the right depth, master rings, air quality needed (class!)"
     ],
     [
      "Capability measurement",
      "Digital / dial bore gauge 50–100 mm",
      "Mitutoyo bore gauges (series 511 dial type), Mahr Micromar 844 N, Diatest",
      "resolution 1–2 µm: see datasheet",
      "€",
      "resolution (≤ 1.5 µm for T = 30 µm), repeatability, setting ring"
     ],
     [
      "Capability measurement",
      "Setting / master ring Ø62",
      "DIN 2250-C setting rings (many makers) with calibration certificate",
      "tolerance class: see datasheet",
      "€",
      "certificate, traceability"
     ]
    ]
   },
   {
    "id": "g1_13",
    "t": "Software",
    "src": "guide 28 §G1.13",
    "rows": [
     [
      "Software",
      "Project plan, CPM, Gantt",
      "GanttProject, ProjectLibre (free, offline); MS Project; Primavera P6",
      "–",
      "–",
      "CPM with floats, baselines"
     ],
     [
      "Software",
      "MSA, capability, SPC",
      "Minitab (desktop), Q-DAS solara.MP (MSA) + qs-STAT (capability)",
      "–",
      "–",
      "VDA 5 / AIAG MSA / ISO 22514 methods"
     ],
     [
      "Software",
      "Spreadsheet",
      "any",
      "–",
      "–",
      "the formulas of A1, F5–F7 fit in one sheet"
     ]
    ]
   },
   {
    "id": "g1_14",
    "t": "Temperatures, run-in",
    "src": "guide 28 §G1.14",
    "rows": [
     [
      "Temperatures, run-in",
      "Contact thermometer with surface probe (spindle housing)",
      "Fluke 54 II, testo thermometers",
      "accuracy: see datasheet",
      "€",
      "probe type, accuracy ± 0.5 K class"
     ],
     [
      "Temperatures, run-in",
      "Temperature / humidity loggers for the hall (1 week before delivery)",
      "testo 174H / 175, other loggers",
      "range, interval: see datasheet",
      "€",
      "export without cloud (offline)"
     ],
     [
      "Temperatures, run-in",
      "Thermal camera",
      "see guide 27 §F.14",
      "–",
      "–",
      "–"
     ]
    ]
   }
  ],
  "shopCols": [
   "#",
   "Item / service",
   "Qty / when",
   "Spec / note",
   "Buy or rent",
   "Price class"
  ],
  "shop": [
   [
    "1",
    "Round slings 6 t, length for θ ≈ 30°",
    "4",
    "EN 1492-2, with sleeves",
    "buy",
    "€"
   ],
   [
    "2",
    "Bow shackles 4.75 t, bolt type",
    "4",
    "EN 13889 / maker cert.",
    "buy",
    "€"
   ],
   [
    "3",
    "Edge protection set",
    "1",
    "for round slings",
    "buy",
    "€"
   ],
   [
    "4",
    "Steel plates 20 mm, 400 × 400 and 1 000 × 2 000",
    "8 + 4",
    "deburred",
    "buy",
    "€"
   ],
   [
    "5",
    "Hydraulic jacks 10 t + hand pump + hoses",
    "4 + 1",
    "700 bar",
    "buy",
    "€€"
   ],
   [
    "6",
    "Cribbing blocks (hardwood)",
    "1 set",
    "–",
    "buy",
    "€"
   ],
   [
    "7",
    "Compressor VSD 11–15 kW + standby",
    "1 + 1",
    "E1.3",
    "buy",
    "€€€"
   ],
   [
    "8",
    "Receiver 500 L + drains",
    "1",
    "E1.4",
    "buy",
    "€"
   ],
   [
    "9",
    "Refrigeration dryer + filters 1 µm / 0.01 µm",
    "1 set",
    "class 1.4.1",
    "buy",
    "€€"
   ],
   [
    "10",
    "Oil-water separator",
    "1",
    "E1.7",
    "buy",
    "€"
   ],
   [
    "11",
    "Aluminium ring main ≈ 100 m + 6 drops + section valves",
    "1",
    "32 mm class (check real ID)",
    "buy",
    "€€"
   ],
   [
    "12",
    "Filter-regulator + lockable valve + pressure switch",
    "6",
    "at each drop",
    "buy",
    "€€"
   ],
   [
    "13",
    "Thermal mass flow meter in the main",
    "1",
    "energy monitoring",
    "buy",
    "€–€€"
   ],
   [
    "14",
    "Coolant concentrate first fill (3 × 56 L individual or 210 L central) + reserve",
    "2–3 drums",
    "E2",
    "buy",
    "€–€€"
   ],
   [
    "15",
    "Refractometer, pH and nitrite strips, dip slides",
    "1 set",
    "E2.4",
    "buy",
    "€"
   ],
   [
    "16",
    "Proportional mixer",
    "1",
    "5–8 %",
    "buy",
    "€"
   ],
   [
    "17",
    "Central coolant system (if chosen) incl. flume",
    "1",
    "240 L/min, 20 µm",
    "buy",
    "€€€€"
   ],
   [
    "18",
    "Mist collectors",
    "3",
    "1 800 m³/h each",
    "buy",
    "€€–€€€"
   ],
   [
    "19",
    "Chip bins with drip tray / briquetting press (optional)",
    "3 / 1",
    "E3",
    "buy",
    "€ / €€€"
   ],
   [
    "20",
    "Managed switch + firewall + cabling",
    "1 set",
    "E5",
    "buy",
    "€€"
   ],
   [
    "21",
    "Air plug gauge Ø62 H7 + master ring",
    "1",
    "0.1 µm",
    "buy",
    "€€"
   ],
   [
    "22",
    "Bore gauge + setting ring (backup)",
    "1",
    "≤ 1.5 µm",
    "buy",
    "€"
   ],
   [
    "23",
    "Temperature loggers (hall)",
    "3",
    "20 ± 2 °C proof",
    "buy",
    "€"
   ],
   [
    "24",
    "Shock / tilt indicators (if the buyer arranges transport)",
    "3 sets",
    "by package mass",
    "buy",
    "€"
   ],
   [
    "S1",
    "Mobile crane with operator + mats (or heavy forklift 16 t)",
    "3 unloading days (UNL on day 137, 147, 157 of the line plan)",
    "lift plan, ground check",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S2",
    "Rigging company with skates / air pads",
    "3 × 1–2 days",
    "competent rigger, insurance",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S3",
    "Spreader beam ≥ 15 t (if the slings touch covers)",
    "with the crane",
    "EN 13155 certificate",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S4",
    "Load link to check the weight",
    "with the crane",
    "–",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S5",
    "Leak survey (ultrasonic)",
    "after commissioning + yearly",
    "–",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S6",
    "CMM measurement (if no own CMM)",
    "test cuts + SAT",
    "accredited lab or the maker",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S7",
    "Laser / ballbar (guide 26)",
    "SAT + yearly",
    "–",
    "rent / service",
    "ask for a quote"
   ],
   [
    "S8",
    "Coolant supplier start-up service",
    "first fill + 4 weeks",
    "water analysis, training",
    "rent / service",
    "ask for a quote"
   ]
  ],
  "shopM": 1,
  "shopP": 5,
  "shopW": [
   5,
   32,
   18,
   25,
   10,
   10
  ],
  "shopTab": "Shopping list – buy + rent / service",
  "shopLbl": "shopping list",
  "shopTitle": "Consolidated shopping list for installing the 3-HMC line (guide 28 §G2): G2.1 buy – stays in the plant (pos. 1 – 24); G2.2 rent or buy as a service (S1 – S8).",
  "price": "Price classes (guide 28): € < 1 k€ · €€ 1 – 10 k€ · €€€ 10 – 50 k€ · €€€€ > 50 k€ – estimate, ask for a quote. Cranes, heavy forklifts, air pads, skates and lasers are better rented or bought as a service with the operator.",
  "shopNote": "Rigging, lifting and the crane are work for a competent rigger with valid certificates – the lift plan (guide 28) is checked by the rigging company.",
  "ph": "(e.g. EN 1492-2, shackle, air pad, Minitab)"
 }
};
