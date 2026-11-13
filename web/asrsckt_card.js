/* AS/RS item 3 – data for the card "Real components + drawings – catalogue examples" (makeCard in robotref.js).
 * GENERATED from docs/33_asrs_control_circuits.md (chapters 29, 30, 31) by tools/gen_asrsckt_card.py – do not edit by hand.
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]. */
export const CARD = {
 "drawings": [
  {
   "f": "33_supply_power_rail.svg",
   "t": "Supply + conductor rail",
   "c": "page 1 – mains supply, branches, conductor rail with collector trolley, ΔU along the rail (example values)",
   "g": "guide 33 §4 – §5"
  },
  {
   "f": "33_dc_link_drives.svg",
   "t": "Crane drives – shared DC link",
   "c": "page 2 – crane cabinet power: main switch, contactor, reactor, infeed, DC link, 4 inverters, motors, brakes, encoders, brake resistor (example values)",
   "g": "guide 33 §6 – §8"
  },
  {
   "f": "33_hoist_safety.svg",
   "t": "Hoist safety chain",
   "c": "page 3 – hoist safety chain (example values)",
   "g": "guide 33 §9"
  },
  {
   "f": "33_travel_limits_positioning.svg",
   "t": "Travel limits + positioning",
   "c": "page 4 – aisle plan, limits, buffers, laser, bar-code positioning (example values)",
   "g": "guide 33 §10"
  },
  {
   "f": "33_safety_circuit_cat3.svg",
   "t": "Safety circuit Cat 3 / PL d",
   "c": "page 5 – F-PLC safety circuit Cat 3 / PL d (example values)",
   "g": "guide 33 §11 – §13"
  },
  {
   "f": "33_crane_plc_io.svg",
   "t": "Crane PLC I/O + data link",
   "c": "page 6 – crane I/O and optical data link (example values)",
   "g": "guide 33 §14 – §15"
  },
  {
   "f": "33_conveyor_io_circuits.svg",
   "t": "Conveyor + I/O station",
   "c": "page 7 – conveyors and ID point (example values)",
   "g": "guide 33 §16"
  },
  {
   "f": "33_crane_cabinet_layout.svg",
   "t": "Crane cabinet layout + heat",
   "c": "page 8 – crane cabinet layout, heat, 24 V (example values)",
   "g": "guide 33 §17, §19"
  }
 ],
 "groups": [
  {
   "id": "g30_1",
   "t": "Conductor rails and current collectors",
   "src": "guide 33 §30.1",
   "rows": [
    [
     "Enclosed conductor rail 4-pole + PE",
     "≥ 40 A class (I_th 23.6 A, peak 42.3 A), 28 m, PE with 2 collectors, indoor IP2x touch-safe",
     "VAHLE U10 enclosed conductor system",
     "4 – 7 poles, enclosed housing, rating see datasheet",
     "€€€€ (complete 28 m system)",
     "R' and X' per conductor, max speed, collector rating, expansion units, hanger spacing"
    ],
    [
     "same, higher current / long aisles",
     "as above, ≥ 63 – 100 A",
     "VAHLE KBH compact enclosed conductor",
     "higher currents, see datasheet",
     "€€€€",
     "as above"
    ],
    [
     "Enclosed conductor rail (alternative maker)",
     "as above",
     "Conductix-Wampfler enclosed multipole conductor rail (Box Conductor / multipole programmes – see catalogue)",
     "see datasheet",
     "€€€€",
     "as above, collector trolley with towing arm"
    ],
    [
     "Current collector trolley",
     "double collectors for PE, ≥ I_pk per phase, towing arm with free play in both directions",
     "rail maker's trolley (VAHLE / Conductix-Wampfler)",
     "brushes per conductor, see datasheet",
     "€€€",
     "brush wear limit, spring force, speed"
    ],
    [
     "Data in the rail (option)",
     "PROFINET to the crane without optical link",
     "Conductix-Wampfler ProfiDAT (slotted waveguide)",
     "≈ 100 Mbit/s class, see datasheet",
     "€€€€",
     "latency, PROFIsafe approval, number of cranes"
    ],
    [
     "Rail feed box + isolator",
     "lockable isolator for the rail (-QB2)",
     "rail maker's feed box + Siemens 3KD / ABB OT isolator",
     "3-pole 63 A, padlock",
     "€€ – €€€",
     "aux contact, padlock, IP"
    ]
   ]
  },
  {
   "id": "g30_2",
   "t": "Energy chains and chain cables (variant)",
   "src": "guide 33 §30.2",
   "rows": [
    [
     "Energy chain for long travel",
     "gliding chain, 28 m travel (14 m chain, fixed point in the middle), 3 m/s, fill: 4G10 + PROFINET + 24 V",
     "igus E4.1 / E4.1L in a guide trough; igus rol e-chain (long travel)",
     "inner width / height see configurator",
     "€€€€",
     "max speed and acceleration for gliding, trough, sliding strips, cable fill ≤ 60–70 %"
    ],
    [
     "Energy chain (alternative maker)",
     "same",
     "Tsubaki Kabelschlepp (e.g. TKA / Quantum series – see catalogue); Murrplastik",
     "see datasheet",
     "€€€€",
     "as above"
    ],
    [
     "Chain-rated power cable",
     "4G10 + PE (or 5G10), 0.6/1 kV, travel ≥ 28 m, millions of cycles",
     "igus chainflex CF (e.g. CF270 / CF37 – see catalogue); Lapp ÖLFLEX FD 891 / FD 90",
     "bend radius see datasheet",
     "€€ per m",
     "bend radius, travel length class, oil / UV, approvals"
    ],
    [
     "Chain-rated PROFINET cable",
     "Cat 5e, 4-wire, shielded",
     "igus chainflex CFBUS PROFINET; Lapp ETHERLINE PN Cat.5 FD",
     "see datasheet",
     "€ per m",
     "cycles, bend radius"
    ],
    [
     "Crane / festoon cable (other cranes)",
     "reeling or festoon",
     "Lapp ÖLFLEX CRANE (e.g. ÖLFLEX CRANE F / NSHTÖU – see catalogue)",
     "see datasheet",
     "€€ per m",
     "torsion, cold, festoon / reel use"
    ]
   ]
  },
  {
   "id": "g30_3",
   "t": "Drive system (infeed, inverters, motors)",
   "src": "guide 33 §30.3",
   "rows": [
    [
     "Multi-axis drive system with shared DC link",
     "infeed ≈ 25 kW (diode + chopper or active), axis modules 2 × 5.5 kW travel, 15 kW hoist, 1.1 kW fork; STO + SBC, PROFINET / PROFIsafe",
     "SEW-EURODRIVE MOVIDRIVE modular (power supply module + axis modules)",
     "safety option for SLS / SSM / SBC see datasheet",
     "€€€€",
     "infeed type, overload 150–200 % for the acceleration time, safety functions, brake test"
    ],
    [
     "same (alternative)",
     "same",
     "Siemens SINAMICS S120 (Smart Line Module or Active Line Module + Motor Modules), Safety Integrated",
     "see datasheet",
     "€€€€",
     "Smart vs Active Line, extended safety (SLS, SSM, SBT) licence"
    ],
    [
     "same (alternative)",
     "same",
     "Lenze i700 servo inverter (multi-axis, DC bus) / Lenze i950",
     "see datasheet",
     "€€€€",
     "as above"
    ],
    [
     "Geared motors with brake + encoder",
     "travel 2 × 5.5 kW, hoist 15 kW, fork 1.1 kW; spring brake 24 V; encoder",
     "SEW (DR.. series with brake), Nord, Lenze g500",
     "see datasheet",
     "€€€ – €€€€ each",
     "brake torque, brake voltage, encoder type, IP, gear ratio"
    ],
    [
     "Line reactor",
     "4 %, ≥ 50 A",
     "drive maker's reactor",
     "see datasheet",
     "€€€",
     "loss (W) – heat in the cabinet"
    ],
    [
     "Drive fuses",
     "type per drive manual (gR / UL)",
     "Siemens SITOR 3NE / Bussmann / Mersen (per manual)",
     "see datasheet",
     "€€",
     "exact type from the drive manual"
    ]
   ]
  },
  {
   "id": "g30_4",
   "t": "Brake resistors and DC link options",
   "src": "guide 33 §30.4",
   "rows": [
    [
     "Brake resistor",
     "27 Ω (≤ 31.7 Ω, ≥ chopper minimum), peak 20.8 kW, continuous ≥ 4 kW, thermal switch, IP20 with guard",
     "Michael Koch (brake resistors, see catalogue); Frizlen; Cressall; drive maker's resistor",
     "see datasheet",
     "€€€",
     "continuous vs pulse power (duty cycle curve), thermal switch, mounting distance"
    ],
    [
     "DC link energy storage (option)",
     "stores ≈ 72 kJ per lowering",
     "capacitor modules of the drive maker (e.g. SEW / Siemens / Koch energy storage – see catalogue)",
     "see datasheet",
     "€€€€",
     "usable energy, voltage window, lifetime"
    ]
   ]
  },
  {
   "id": "g30_5",
   "t": "Brakes, overspeed governor, safety catch",
   "src": "guide 33 §30.5",
   "rows": [
    [
     "Drum / secondary safety brake",
     "spring-applied, 24 V DC, ≥ 1.6 × static torque, wear monitoring",
     "Mayr ROBA-stop (safety brakes); Kendrion; Pintsch Bubenzer (crane brakes)",
     "see datasheet",
     "€€€",
     "torque, switching times, release monitoring, wear monitoring"
    ],
    [
     "Overspeed governor + safety catch",
     "trip at ≈ 1.15–1.4 × v, for the carriage mass",
     "usually from the crane maker; lift-type governors (e.g. Wittur, Dynatech – check suitability)",
     "see datasheet",
     "€€€ – €€€€",
     "trip speed, test method, catch device for the mass"
    ]
   ]
  },
  {
   "id": "g30_6",
   "t": "Safe speed monitors and safety controllers",
   "src": "guide 33 §30.6",
   "rows": [
    [
     "Safe speed monitor",
     "2 encoder inputs (diverse), overspeed, SLS, standstill (SSM), up to PL e",
     "Pilz PNOZ s30",
     "see datasheet",
     "€€€",
     "encoder types (TTL / HTL / sin-cos), max frequency, response time"
    ],
    [
     "same (alternative)",
     "same",
     "SICK Speed Monitor MOC3SA; drive-integrated safety (Siemens Safety Integrated extended, SEW / Lenze safety options)",
     "see datasheet",
     "€€€",
     "as above"
    ],
    [
     "F-CPU",
     "standard + safety program, PROFINET / PROFIsafe",
     "Siemens S7-1515F-2 PN (PLC-ASRS-RAW)",
     "see datasheet",
     "€€€€",
     "F-runtime licence, memory, cycle time"
    ],
    [
     "F-I/O on the crane and in the cabinet",
     "F-DI 8 × 24 V, F-DQ 4 × 24 V 2 A PM",
     "Siemens ET 200SP F-DI 8×24VDC HF, F-DQ 4×24VDC/2A PM HF",
     "see datasheet",
     "€€€ each",
     "test pulses, PM vs PP switching vs drive STO input"
    ],
    [
     "Safety controller (alternative, small systems)",
     "modular safety controller",
     "Pilz PNOZmulti 2; SICK Flexi Soft",
     "see datasheet",
     "€€€",
     "gateways, speed modules"
    ]
   ]
  },
  {
   "id": "g30_7",
   "t": "Limit switches, slack-rope switches, door switches",
   "src": "guide 33 §30.7",
   "rows": [
    [
     "Final limit switches (travel, hoist)",
     "forced NC (positive opening), roller lever, IP67, robust for cams",
     "Schmersal heavy-duty position switches (e.g. T.335 / Z.335 family – see catalogue); Euchner NZ / NB series; Steute heavy-duty position switches",
     "see datasheet",
     "€€",
     "positive opening, actuating force, travel, temperature"
    ],
    [
     "Slow-down switches",
     "NO / NC, roller lever",
     "same families",
     "see datasheet",
     "€ – €€",
     ""
    ],
    [
     "Slack-rope switch",
     "2 NC with positive opening, lever for the rope anchor / spring pulley",
     "Schmersal / Euchner / Steute lever switches, or the crane maker's slack-rope device",
     "see datasheet",
     "€€",
     "lever geometry, force"
    ],
    [
     "Door switch with guard locking",
     "ISO 14119 type 4 (coded), power-to-unlock, escape release, OSSD",
     "Euchner MGB2; Schmersal AZM400; Pilz PSENmlock",
     "see datasheet",
     "€€€",
     "locking force, PL e, escape release, door hinge side"
    ]
   ]
  },
  {
   "id": "g30_8",
   "t": "Load cells and overload protection",
   "src": "guide 33 §30.8",
   "rows": [
    [
     "Load cell / force transducer in the rope",
     "≈ 2 t nominal, IP67, fatigue-rated",
     "HBK (HBM) U2B / U10M force transducers; Flintec load cells (see catalogue)",
     "see datasheet",
     "€€€",
     "accuracy class, overload limit, fatigue rating"
    ],
    [
     "Load pin (alternative)",
     "in a pulley axle",
     "WIKA (tecsis) load pins; crane maker",
     "see datasheet",
     "€€€",
     ""
    ],
    [
     "Load evaluation unit",
     "4–20 mA + 2 limit relays (warn 90 %, overload 110 %), 2-channel option",
     "HBK (HBM) ClipX; crane maker's overload unit",
     "see datasheet",
     "€€€",
     "relay contacts for the safety part, calibration"
    ],
    [
     "Infeed scale",
     "roller-conveyor scale ≤ 300 kg (+ crate), output to PLC",
     "Mettler-Toledo / Minebea Intec conveyor scales (see catalogue)",
     "see datasheet",
     "€€€€",
     "resolution, dynamic weighing, interface"
    ]
   ]
  },
  {
   "id": "g30_9",
   "t": "Light curtains with muting, e-stops",
   "src": "guide 33 §30.9",
   "rows": [
    [
     "Safety light curtain with muting",
     "type 4, d = 30 mm (or 14 mm), protective height for the conveyor opening, muting (2 or 4 sensors)",
     "SICK deTec4 (+ muting via Flexi Soft / muting set)",
     "see datasheet",
     "€€€",
     "response time (for S), muting principle, end caps"
    ],
    [
     "same (alternative)",
     "same",
     "Leuze MLC 500 / MLC 530 (integrated muting variants)",
     "see datasheet",
     "€€€",
     "as above"
    ],
    [
     "Multi-beam light barrier (body)",
     "for wide openings",
     "SICK M4000 (with muting variants)",
     "see datasheet",
     "€€€",
     "beam heights per ISO 13855"
    ],
    [
     "E-stop buttons",
     "2 NC positive opening, self-monitoring contact block, IP65",
     "Siemens SIRIUS ACT 3SU1; Eaton M22; Schneider Harmony XB5",
     "see datasheet",
     "€ – €€",
     "contact block monitoring, yellow enclosure"
    ]
   ]
  },
  {
   "id": "g30_10",
   "t": "Positioning sensors and data transmission",
   "src": "guide 33 §30.10",
   "rows": [
    [
     "Laser distance sensor (travel)",
     "range ≥ 30 m on reflector, resolution 0.1 mm, PROFINET",
     "SICK DL100 Pro; Leuze AMS 300i",
     "see datasheet",
     "€€€",
     "range vs reflector size, output rate, temperature"
    ],
    [
     "Bar-code positioning (hoist)",
     "absolute, mm resolution, PROFINET, tape ≥ 9 m",
     "Leuze BPS 300i; SICK OLM100",
     "see datasheet",
     "€€€",
     "tape type, max speed, reading distance"
    ],
    [
     "Optical data link",
     "100 Mbit/s PROFINET + PROFIsafe, ≥ 30 m",
     "Leuze DDLS 500",
     "see datasheet",
     "€€€ (pair)",
     "range, alignment tolerance, heater option"
    ],
    [
     "same (alternative)",
     "same",
     "SICK ISD400",
     "see datasheet",
     "€€€ (pair)",
     "as above"
    ],
    [
     "Fork / slot sensors",
     "inductive M18, light sensors with background suppression, PNP M12, IO-Link",
     "SICK (W16 / W12 families), Leuze, ifm",
     "see datasheet",
     "€ – €€",
     "switching distance, black / wet crates"
    ]
   ]
  },
  {
   "id": "g30_11",
   "t": "Conveyor and I/O station components",
   "src": "guide 33 §30.11",
   "rows": [
    [
     "Motor starter with STO",
     "0.55–0.75 kW, overload, fail-safe disconnection",
     "Siemens SIRIUS 3RM1 (failsafe variant); ET 200SP motor starter (fail-safe)",
     "see datasheet",
     "€€",
     "setting range, safety approval"
    ],
    [
     "24 V RollerDrive + controller",
     "≈ 50 W per zone, ZPA logic, PROFINET",
     "Interroll RollerDrive EC5000 + MultiControl; Pulseroller ConveyLinx",
     "see datasheet",
     "€€ per zone",
     "torque at the crate weight, start current"
    ],
    [
     "Bar-code scanner at the ID point",
     "Code 128 / DataMatrix on the crate label, read rate ≥ 99.5 %",
     "SICK CLV6xx / Lector; Cognex DataMan; Leuze BCL",
     "see datasheet",
     "€€€",
     "reading field, depth of field, PROFINET"
    ],
    [
     "Contour check light grid",
     "height / width / overhang",
     "SICK MLG-2; Leuze CSL / CML",
     "see datasheet",
     "€€€",
     "beam spacing, length, interface"
    ]
   ]
  },
  {
   "id": "g30_12",
   "t": "Power supplies, cabinets, cooling, cables",
   "src": "guide 33 §30.12",
   "rows": [
    [
     "24 V power supply crane",
     "24 V 20 A, DC-OK, efficiency ≥ 93 %, vibration-rated",
     "PULS QS20 / CP20; Phoenix Contact QUINT4-PS; Siemens SITOP PSU8200",
     "see datasheet",
     "€€ – €€€",
     "vibration / shock rating, hold-up time"
    ],
    [
     "24 V buffer module",
     "≈ 0.5 s at 15 A",
     "PULS UB / UC buffer modules; Phoenix QUINT4-BUFFER",
     "see datasheet",
     "€€",
     "energy, charge time"
    ],
    [
     "ECB channels",
     "4–8 channels, adjustable 1–10 A",
     "Phoenix Contact CBMC; Murrelektronik Mico; Siemens SITOP SEL1200",
     "see datasheet",
     "€€",
     "channel current, signalling"
    ],
    [
     "Main cabinet / conveyor cabinet",
     "800 × 2 000 × 600 / 600 × 1 200 × 300, IP54",
     "Rittal VX25 / AX",
     "see datasheet",
     "€€€",
     "depth for the drives, plinth"
    ],
    [
     "Crane cabinet",
     "800 × 1 200 × 400, IP54, vibration-proof mounting",
     "Rittal AX / VX25 with anti-vibration mounts",
     "see datasheet",
     "€€€",
     "mounts, door stops"
    ],
    [
     "Cooling unit (crane)",
     "≈ 500 W, suitable for mobile use / vibration",
     "Rittal Blue e+ (ask for mobile / crane suitability)",
     "see datasheet",
     "€€€",
     "vibration rating, condensate, mounting position"
    ],
    [
     "Supply cable",
     "5G10 Cu, 0.6/1 kV",
     "Lapp ÖLFLEX CLASSIC 110 / NYY-J / NYM-J (per site rules)",
     "see datasheet",
     "€€ per m",
     "method of installation"
    ],
    [
     "Motor cables (servo)",
     "shielded, chain-rated on the mast",
     "Lapp ÖLFLEX SERVO FD; igus chainflex CF27 / CF29 (see catalogue)",
     "see datasheet",
     "€€ per m",
     ""
    ]
   ]
  }
 ],
 "shopCols": [
  "#",
  "Tag",
  "Item",
  "Example product (chapter 30)",
  "Spec (example)",
  "Qty"
 ],
 "shop": [
  [
   "1",
   "-QB1",
   "main switch, lockable",
   "Siemens 3KD / ABB OT",
   "3P 63 A, AC-23B",
   "1"
  ],
  [
   "2",
   "-FC1",
   "fuse holder + gG fuses",
   "Siemens 3NW / ABB E 93",
   "gG 40 A",
   "1 (+ 3 spare)"
  ],
  [
   "3",
   "-FC2",
   "MCCB crane feed",
   "Siemens 3VA / ABB Tmax XT",
   "3P, I_r ≥ 24 A, peaks 42 A",
   "1"
  ],
  [
   "4",
   "-QB2",
   "rail isolator, lockable",
   "Siemens 3KD / ABB OT",
   "3P 63 A + aux",
   "1"
  ],
  [
   "5",
   "-WD10",
   "conductor rail 4-pole + PE, 28 m, feed box, end caps, hangers",
   "VAHLE U10 / Conductix-Wampfler",
   "40 A class",
   "1 set"
  ],
  [
   "6",
   "-XC10",
   "collector trolley, double PE collector",
   "rail maker",
   "≥ 42 A per phase",
   "1 (+ brush set spare)"
  ],
  [
   "7",
   "-FC3/-FC4/-FC5",
   "MCB / RCBO",
   "Siemens 5SY / ABB S200",
   "C10 3P · C6 1P+N · B10 30 mA",
   "3"
  ],
  [
   "8",
   "-TB1",
   "24 V supply (fixed)",
   "PULS / Phoenix QUINT4 / SITOP",
   "24 V 10 A",
   "1"
  ],
  [
   "9",
   "-QB10, -FC10, -QA10",
   "crane main switch, drive fuses, main contactor + mirror contact",
   "Siemens 3KD / 3NE / 3RT",
   "63 A · gR · 40 A AC-3",
   "1 each"
  ],
  [
   "10",
   "-RA10",
   "line reactor",
   "drive maker",
   "4 %, 50 A",
   "1"
  ],
  [
   "11",
   "-TA10",
   "infeed (diode + chopper or AFE)",
   "SEW MOVIDRIVE modular / SINAMICS S120 / Lenze i700",
   "≈ 25 kW",
   "1"
  ],
  [
   "12",
   "-TA11 … -TA14",
   "axis modules travel ×2, hoist, fork, STO + SBC",
   "same system",
   "5.5 / 5.5 / 15 / 1.1 kW",
   "4"
  ],
  [
   "13",
   "-RA11",
   "brake resistor with thermal switch",
   "Michael Koch / Frizlen / Cressall",
   "27 Ω, 4 kW cont.",
   "1 (0 with AFE)"
  ],
  [
   "14",
   "-MA11 … -MA14",
   "geared motors with brake + encoder",
   "SEW / Nord / Lenze",
   "as -TA11 … -TA14",
   "4"
  ],
  [
   "15",
   "-MB15",
   "drum safety brake",
   "Mayr ROBA-stop / crane maker",
   "spring-applied 24 V",
   "1"
  ],
  [
   "16",
   "-BG30",
   "overspeed governor + safety catch",
   "crane maker",
   "per carriage mass",
   "1"
  ],
  [
   "17",
   "-KF33",
   "safe speed monitor",
   "Pilz PNOZ s30 / SICK MOC3SA / drive safety",
   "2 encoders",
   "1"
  ],
  [
   "18",
   "-BG34",
   "slack-rope switch",
   "Schmersal / Euchner / Steute",
   "2 NC positive opening",
   "1"
  ],
  [
   "19",
   "-BW35, -KF35",
   "load cell + load monitor",
   "HBK U2B / ClipX; Flintec",
   "2 t, 2 relays + 4–20 mA",
   "1"
  ],
  [
   "20",
   "-BG36 … -BG43",
   "limit switches (slow-down + final), travel + hoist",
   "Schmersal / Euchner / Steute",
   "roller lever, forced NC",
   "8"
  ],
  [
   "21",
   "–",
   "buffers (travel ends)",
   "crane maker",
   "for 1.0 m/s residual speed, 2.25 kJ",
   "2"
  ],
  [
   "22",
   "-BG44",
   "laser distance sensor + reflector",
   "SICK DL100 Pro / Leuze AMS 300i",
   "≥ 30 m, PROFINET",
   "1"
  ],
  [
   "23",
   "-BG45",
   "bar-code positioning + tape",
   "Leuze BPS 300i / SICK OLM100",
   "PROFINET, tape 10 m",
   "1"
  ],
  [
   "24",
   "-KF2",
   "F-CPU",
   "Siemens S7-1515F-2 PN",
   "PLC-ASRS-RAW",
   "1"
  ],
  [
   "25",
   "-KF21 … -KF24",
   "F-DI / F-DQ modules",
   "Siemens ET 200SP F",
   "8 F-DI / 4 F-DQ",
   "4"
  ],
  [
   "26",
   "-KF30",
   "ET 200SP head + DI 16 + DQ 8",
   "Siemens IM 155-6 PN HF",
   "crane I/O",
   "1"
  ],
  [
   "27",
   "-KF70/-KF71",
   "optical data link pair",
   "Leuze DDLS 500 / SICK ISD400",
   "100 Mbit/s",
   "1 pair"
  ],
  [
   "28",
   "-SF51 … -SF55",
   "e-stop buttons + enclosures",
   "Siemens 3SU1 / Eaton M22 / Schneider XB5",
   "2 NC, self-monitoring",
   "5"
  ],
  [
   "29",
   "-SF57, -SF58, -PF58",
   "request button, reset button, reset lamp",
   "same families",
   "–",
   "1 set"
  ],
  [
   "30",
   "-BG56, -MB56",
   "door switch with guard locking + escape release",
   "Euchner MGB2 / Schmersal AZM400",
   "type 4, power-to-unlock",
   "2 (2 doors)"
  ],
  [
   "31",
   "-BG59, -BG60A/B, -PF60",
   "light curtain + muting sensors + muting lamp",
   "SICK deTec4 / Leuze MLC 530",
   "type 4, d = 30 mm",
   "2 (infeed + outfeed)"
  ],
  [
   "32",
   "-BG61 … -BG68",
   "fork, load, overhang, slot sensors",
   "SICK / Leuze / ifm",
   "PNP M12",
   "8 (+ 2 spare)"
  ],
  [
   "33",
   "-SF76, -PF75, -PF78 … -PF80",
   "mode key switch, 7\" panel, beacon, horn",
   "Siemens 3SU1 / TP700 or Unified panel",
   "–",
   "1 set"
  ],
  [
   "34",
   "-QA71 … -QA73",
   "motor starters with STO",
   "Siemens 3RM1 failsafe / ET 200SP MS",
   "0.55–0.75 kW",
   "3"
  ],
  [
   "35",
   "-MA71 … -MA73",
   "conveyor geared motors",
   "conveyor supplier",
   "0.55 / 0.55 / 0.75 kW",
   "3"
  ],
  [
   "36",
   "-TB71, -KF74/-KF75",
   "24 V supply + RollerDrive zone controllers",
   "PULS 20 A; Interroll MultiControl / ConveyLinx",
   "8 zones",
   "1 + 2"
  ],
  [
   "37",
   "-BG90, -BG91, -BW92, -QA93",
   "scanner, contour light grid, scale, reject diverter",
   "SICK CLV / Cognex; SICK MLG-2; Mettler-Toledo",
   "ID point",
   "1 each"
  ],
  [
   "38",
   "-TB10 + buffer + ECB",
   "24 V crane supply 20 A + buffer + ECB",
   "PULS / Phoenix / Siemens",
   "20 A, 0.5 s",
   "1 set"
  ],
  [
   "39",
   "+CAB01, +CAB02, +CRN01",
   "cabinets",
   "Rittal VX25 / AX",
   "see chapter 30.12",
   "3"
  ],
  [
   "40",
   "-EC1",
   "cooling unit crane cabinet",
   "Rittal Blue e+ (mobile-rated)",
   "500 W class",
   "1"
  ],
  [
   "41",
   "–",
   "cables: supply 5G10, rail feed, motor / chain cables, sensor cables, PROFINET",
   "Lapp ÖLFLEX / igus chainflex",
   "per cable list",
   "1 lot"
  ],
  [
   "42",
   "–",
   "test equipment: installation tester, stop-time meter, test weights 110 %",
   "Fluke / Gossen Metrawatt / Megger",
   "IEC 61557",
   "1 set (or rent)"
  ]
 ],
 "shopM": 3,
 "shopP": -1,
 "shopW": [
  4,
  13,
  27,
  26,
  20,
  10
 ],
 "guides": "guide 33",
 "shopTab": "Shopping list (BOM) – ASRS-RAW",
 "ph": "(e.g. VAHLE, deTec4, PNOZ s30, DDLS)",
 "buyNote": "Price classes: € < 50 € · €€ 50 – 300 € · €€€ 300 – 1 500 € · €€€€ > 1 500 € (rough estimates, without installation – ask 2 – 3 suppliers).",
 "shopLbl": "shopping list",
 "shopTitle": "Shopping list for one aisle with one stacker crane (guide 33 chapter 31) – same tags as the drawings and card D.",
 "shopNote": "Example quantities and ratings for the default inputs of card C. In most projects the AS/RS supplier delivers crane, drives and safety as one system – use the list to check the offer and for spare parts.",
 "shopPrice": true
};
