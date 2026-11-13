/* AS/RS tab – item 2 'Control system' – data of the card 'Real components + drawings – catalogue examples' (#srCard2).
 * GENERATED from docs/32_asrs_control_system.md §17.1 – 17.8 (buy list), §17.9 (shopping list), §20 (drawings) – regenerate, do not edit by hand.
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet].
 * Makers and models are real catalogue EXAMPLES – data and prices change; ask the supplier for the current datasheet and a quote.
 */
export const CARD2 = {
 "guide": "guide 32",
 "drawings": [
  {
   "f": "32_control_architecture.svg",
   "t": "AS/RS control architecture – levels 0 – 4",
   "c": "ERP, MES, WMS, WCS, HMI, crane PLC, conveyor control, optical link, field devices; IPs, VLANs, response times",
   "g": "guide 32 §2"
  },
  {
   "f": "32_telegram_format.svg",
   "t": "WCS telegram format and sequence",
   "c": "66-byte layout with offsets, field rules, WCS ↔ PLC sequence incl. error case, OPC UA alternative",
   "g": "guide 32 §3"
  },
  {
   "f": "32_motion_profiles.svg",
   "t": "Motion profiles – trapezoid vs S-curve",
   "c": "position, speed, acceleration, jerk of a 26 m move; formulas; synchronised axes",
   "g": "guide 32 §5"
  },
  {
   "f": "32_positioning_sensors.svg",
   "t": "Positioning sensors – travel, hoist, fork, fine",
   "c": "laser + reflector, bar-code tape on the mast, slot reference sensor, fork encoder; accuracy budget",
   "g": "guide 32 §6"
  },
  {
   "f": "32_cascade_loop.svg",
   "t": "Cascade position / speed / current control",
   "c": "block diagram with feedforward and feedback paths, tuning numbers, following error",
   "g": "guide 32 §6.4"
  },
  {
   "f": "32_sway_model.svg",
   "t": "Mast sway – 2-mass model and damping",
   "c": "model sketch, equation, simulated response trapezoid / S-curve / active damping",
   "g": "guide 32 §7"
  },
  {
   "f": "32_step_chain.svg",
   "t": "Crane step chain, modes and error reactions",
   "c": "GRAFCET steps 10 – 160 with transitions, time-outs, modes, error reactions, referencing",
   "g": "guide 32 §8"
  },
  {
   "f": "32_safety_functions.svg",
   "t": "Safety functions and zones of the AS/RS aisle",
   "c": "plan view with SLS zones, limit switches, buffers, door, light curtains, e-stops; SF table; stopping distance",
   "g": "guide 32 §9"
  },
  {
   "f": "32_io_handshake.svg",
   "t": "I/O handshake timing crane ↔ conveyor",
   "c": "8 signals over time for one pick, rules, time-outs",
   "g": "guide 32 §10"
  },
  {
   "f": "32_dc_link_energy.svg",
   "t": "Common DC link and regenerative braking energy",
   "c": "supply, DC link, 4 inverters, chopper / resistor, power plot of a move, energy numbers",
   "g": "guide 32 §12"
  }
 ],
 "groups": [
  {
   "id": "g17_1",
   "t": "Crane PLCs and safety PLCs",
   "src": "guide 32 §17.1",
   "rows": [
    [
     "Fail-safe crane PLC",
     "F-CPU, PROFINET + PROFIsafe, step chain + F-program in one CPU, OPC UA server",
     "Siemens SIMATIC S7-1515F-2 PN (project standard, guides 05 / 15)",
     "2 PROFINET interfaces, F-program up to SIL 3 / PL e, TIA Portal + STEP 7 Safety",
     "estimate – ask for a quote",
     "work memory for the F-program, OPC UA runtime licence, F-signature handling"
    ],
    [
     "Larger F-CPU (option)",
     "more axes / second aisle in one CPU",
     "Siemens SIMATIC S7-1516F-3 PN/DP",
     "as above, more memory, PROFIBUS port",
     "estimate – ask for a quote",
     "cycle time with all axes, technology objects"
    ],
    [
     "Fail-safe I/O (crane + conveyor)",
     "2-channel F-DI for e-stops, doors, limit switches; F-DQ for brakes",
     "Siemens SIMATIC ET 200SP F-DI 8×24VDC HF, F-DQ 4×24VDC/2A PM HF",
     "PROFIsafe, SIL 3 / PL e (see datasheet)",
     "estimate – ask for a quote",
     "discrepancy time, test pulses, PM switching for brakes"
    ],
    [
     "Safety controller (alternative)",
     "EtherCAT + FSoE, PC-based",
     "Beckhoff TwinSAFE: EL6910 logic terminal, EL1904 / EL2904 safe I/O, CX / C60xx IPC with TwinCAT 3",
     "FSoE (Safety over EtherCAT), SIL 3 / PL e (see datasheet)",
     "estimate – ask for a quote",
     "TwinSAFE editor, safety-project checksum, offline licence"
    ],
    [
     "Safety controller (alternative)",
     "EtherNet/IP + CIP Safety",
     "Rockwell Automation GuardLogix 5580 (1756-L8xES) / Compact GuardLogix 5380 (5069-L3xxERMS2)",
     "CIP Safety, SIL 3 / PL e (see datasheet), Studio 5000",
     "estimate – ask for a quote",
     "safety task period, safety signature, licence"
    ],
    [
     "Configurable safety controller (conveyor only, option)",
     "e-stop + door + muting for a small conveyor",
     "Pilz PNOZmulti 2, SICK Flexi Soft",
     "configurable, muting function blocks",
     "estimate – ask for a quote",
     "number of I/O, muting blocks, diagnostics to the PLC"
    ]
   ]
  },
  {
   "id": "g17_2",
   "t": "Drives (travel, hoist, fork)",
   "src": "guide 32 §17.2",
   "rows": [
    [
     "Multi-axis drive with common DC link",
     "supply module + motor modules, Safety Integrated (STO, SS1, SLS, SBC, SDI), PROFIdrive",
     "Siemens SINAMICS S120 (Smart Line Module or Active Line Module = regenerative)",
     "booksize, DRIVE-CLiQ encoders, extended safety functions with licence",
     "estimate – ask for a quote",
     "regen (ALM) vs braking resistor (SLM), safety licence, cabinet on the crane"
    ],
    [
     "Single-axis servo (fork)",
     "≈ 1.5 kW, STO / SS1, PROFINET, one-cable motor",
     "Siemens SINAMICS S210 + 1FK2 motor",
     "servo up to ≈ 7 kW (see datasheet), one cable",
     "estimate – ask for a quote",
     "encoder type (multi-turn absolute), brake"
    ],
    [
     "Drive system (alternative)",
     "modular inverters on a DC link, intralogistics experience",
     "SEW-EURODRIVE MOVI-C (MOVIDRIVE modular / system, MOVI-C CONTROLLER)",
     "motion + safety options (MOVISAFE), PROFINET / EtherCAT",
     "estimate – ask for a quote",
     "application modules for S/R machines (ask), DC-link coupling, regen module"
    ],
    [
     "Servo inverter (alternative)",
     "multi-axis, safety, PLCopen",
     "Lenze i950 servo inverter",
     "EtherCAT / PROFINET, safety module (see datasheet)",
     "estimate – ask for a quote",
     "sway-damping function, safety options"
    ],
    [
     "Inverter (alternative)",
     "vector control, common DC bus",
     "Danfoss VLT AutomationDrive FC 302",
     "STO standard, DC-bus terminals, brake chopper option",
     "estimate – ask for a quote",
     "closed-loop encoder option, safety option card"
    ],
    [
     "Geared motors",
     "travel 2 × ≈ 5.5 kW with brake; hoist ≈ 15 kW with brake",
     "SEW-EURODRIVE, NORD, Siemens SIMOGEAR, Lenze g500",
     "brake with manual release, encoder",
     "estimate – ask for a quote",
     "brake torque, B10 of the brake, thermal class, IP"
    ],
    [
     "Braking resistor",
     "peak ≈ 10 kW, duty of the cycle",
     "resistor matched by the drive maker",
     "continuous + peak power, thermal switch",
     "estimate – ask for a quote",
     "energy per braking (kJ), temperature switch wired to the PLC"
    ]
   ]
  },
  {
   "id": "g17_3",
   "t": "Positioning sensors",
   "src": "guide 32 §17.3",
   "rows": [
    [
     "Laser distance sensor (travel)",
     "absolute 0.2 – ≥ 40 m on reflector, PROFINET or SSI, repeatability ≈ ±1 mm",
     "SICK DL100 Pro",
     "range classes on reflector (see datasheet), resolution down to 0.1 mm, PROFINET / SSI / EtherNet/IP",
     "estimate – ask for a quote",
     "range for 28 m + margin, output rate, heating option, reflector size"
    ],
    [
     "Laser distance sensor (alternative)",
     "as above, faster output",
     "SICK DL1000",
     "long range on reflector (see datasheet), fast data output",
     "estimate – ask for a quote",
     "as above"
    ],
    [
     "Laser distance sensor (alternative)",
     "as above",
     "Leuze AMS 300i series",
     "variants by range (see datasheet), PROFINET / SSI",
     "estimate – ask for a quote",
     "range variant, heating, reflector"
    ],
    [
     "Bar-code positioning (hoist)",
     "absolute, tape along the 9.3 m mast, ±1 mm",
     "Leuze BPS 300i (bar-code tape)",
     "resolution up to 0.01 mm (see datasheet), PROFINET",
     "estimate – ask for a quote",
     "tape length + expansion joints, reading distance"
    ],
    [
     "Code-tape positioning (alternative)",
     "as above",
     "SICK OLM200 (bar code) / OLV100 (Data Matrix tape) – check the current names",
     "absolute, SSI / RS-485 / PROFINET variants (see datasheet)",
     "estimate – ask for a quote",
     "tape type, interface, IP class"
    ],
    [
     "Absolute encoder (fork, plausibility)",
     "multi-turn, PROFINET / SSI",
     "SICK AFM60, Kübler Sendix F58 series, Baumer",
     "multi-turn absolute, shaft / hollow shaft",
     "estimate – ask for a quote",
     "resolution, multi-turn range, mechanical fit"
    ],
    [
     "Safety encoder (option)",
     "for SLS / SLP in the drive",
     "SICK DFS60S Pro / AFS60S Pro, drive-maker safety encoders",
     "SIL 2 / PL d (see datasheet)",
     "estimate – ask for a quote",
     "safety certificate, interface to the drive"
    ],
    [
     "Slot reference sensor",
     "detects the slot mark, ±0.5 mm edge",
     "SICK W12 / W16 reflex sensors, Leuze 46B series, Pepperl+Fuchs R100 / R200",
     "background suppression, small light spot (see datasheet)",
     "estimate – ask for a quote",
     "switching frequency, light spot size at the working distance"
    ]
   ]
  },
  {
   "id": "g17_4",
   "t": "Optical data transmission",
   "src": "guide 32 §17.4",
   "rows": [
    [
     "Optical data link (pair)",
     "PROFINET + PROFIsafe transparent, 100 Mbit/s, range ≥ 28 m + margin",
     "Leuze DDLS 500",
     "100 Mbit/s, range variants (see datasheet), link-quality output",
     "estimate – ask for a quote",
     "range variant, frequency pair (neighbour aisles!), heating, PROFINET diagnostics"
    ],
    [
     "Optical data link (alternative)",
     "as above",
     "SICK ISD400",
     "100 Mbit/s class, range variants (see datasheet)",
     "estimate – ask for a quote",
     "as above"
    ],
    [
     "Leaky-feeder WLAN (alternative)",
     "when line of sight is not possible",
     "Siemens SCALANCE W with RCoax cable",
     "IWLAN; PROFIsafe over WLAN (check)",
     "estimate – ask for a quote",
     "determinism, interference, safety approval"
    ]
   ]
  },
  {
   "id": "g17_5",
   "t": "Safety devices",
   "src": "guide 32 §17.5",
   "rows": [
    [
     "Light curtain with muting (I/O)",
     "type 4, muting for crates, 2 or 4 muting sensors",
     "Leuze MLC 530 (muting variants), SICK deTec4 + Flexi Soft muting, Pilz PSENopt II",
     "type 4 / PL e (see datasheet), resolution, protective height",
     "estimate – ask for a quote",
     "integrated or external muting, response time (ISO 13855), muting lamp"
    ],
    [
     "Safety laser scanner (option)",
     "area protection at the I/O or maintenance platform",
     "SICK microScan3, Leuze RSL 400, Pilz PSENscan",
     "protective fields, PROFIsafe variants (see datasheet)",
     "estimate – ask for a quote",
     "field sets, response time, PROFIsafe"
    ],
    [
     "Door lock with guard locking",
     "aisle door, interlocking device with guard locking (ISO 14119), lock monitoring",
     "Euchner MGB2, Pilz PSENmlock, Schmersal AZM400",
     "PL e (see datasheet), escape release, lockout bracket",
     "estimate – ask for a quote",
     "locking principle, escape release, PROFINET / PROFIsafe variant"
    ],
    [
     "E-stop buttons",
     "ISO 13850, 2 NC contacts",
     "Siemens SIRIUS ACT 3SU1, Eaton M22, Schneider Electric Harmony XB4 / XB5",
     "2 NC, positive opening",
     "estimate – ask for a quote",
     "B10D, illumination, IP"
    ],
    [
     "Safety limit switches (aisle ends)",
     "positive opening, robust actuator",
     "Schmersal, Bernstein, Euchner, Siemens SIRIUS 3SE",
     "positive opening (see datasheet)",
     "estimate – ask for a quote",
     "B10D, approach speed, cam design"
    ],
    [
     "Buffers (aisle ends)",
     "2 250 J at 1 m/s (reduced) or 20 250 J at 3 m/s, ≈ 22.5 kN",
     "ACE safety shock absorbers (SCS series) or PU elastomer buffers – check",
     "energy per stroke, stroke, force (see datasheet)",
     "estimate – ask for a quote",
     "design speed, stroke, return, temperature"
    ],
    [
     "Load cell / load pin (hoist)",
     "overload 110 %, 2 channels or with diagnostics",
     "load pins / load cells from crane-sensor makers (see datasheet)",
     "4–20 mA / CANopen, overload",
     "estimate – ask for a quote",
     "redundancy, accuracy at 300 kg, mounting"
    ],
    [
     "Slack-rope switch",
     "2 channels, positive opening",
     "crane-switch makers (supplier's choice)",
     "see datasheet",
     "estimate – ask for a quote",
     "actuation geometry, B10D"
    ]
   ]
  },
  {
   "id": "g17_6",
   "t": "Conveyor I/O equipment",
   "src": "guide 32 §17.6",
   "rows": [
    [
     "Bar-code scanner (ID point)",
     "1D / 2D code on the crate, read rate > 99.9 %",
     "SICK Lector6xx / CLV6xx, Cognex DataMan, Keyence SR series",
     "camera / laser scanner, PROFINET (see datasheet)",
     "estimate – ask for a quote",
     "depth of field, code size, read-rate statistics"
    ],
    [
     "RFID reader (option)",
     "UHF tags on the crates",
     "SICK RFU6xx, Siemens SIMATIC RF600",
     "UHF, PROFINET (see datasheet)",
     "estimate – ask for a quote",
     "tag on steel, reading zone"
    ],
    [
     "Contour check light grid",
     "height + overhang ±20 mm",
     "SICK MLG-2, Leuze CML 700i",
     "measuring light grid (see datasheet)",
     "estimate – ask for a quote",
     "beam spacing, response time"
    ],
    [
     "Conveyor scale",
     "≤ 300 kg in a conveyor zone",
     "Mettler Toledo, Bizerba, Minebea Intec (conveyor scale modules)",
     "capacity, resolution (see datasheet)",
     "estimate – ask for a quote",
     "dynamic or static weighing, interface"
    ],
    [
     "Motor-driven rollers (zones)",
     "24 V MDR or chain conveyor, 0.2 m/s, zero-pressure accumulation",
     "Interroll RollerDrive EC5000, Itoh Denki",
     "24 V DC, zone controllers (see datasheet)",
     "estimate – ask for a quote",
     "load per roller for 300 kg crates (else chain conveyor)"
    ],
    [
     "Remote I/O at the conveyors",
     "PROFINET + PROFIsafe",
     "Siemens SIMATIC ET 200SP (+ F-modules), ET 200eco PN",
     "IP20 cabinet / IP67 field",
     "estimate – ask for a quote",
     "F-modules, IO-Link master"
    ]
   ]
  },
  {
   "id": "g17_7",
   "t": "WCS / material-flow software",
   "src": "guide 32 §17.7",
   "rows": [
    [
     "WCS from the AS/RS supplier",
     "telegrams to the crane PLC, dual command, load tracking, interface to our WMS",
     "the crane maker's own material-flow controller (e.g. SSI Schäfer WAMAS, Swisslog SynQ, Kardex Mlog, viastore viadat) – check the current product names",
     "complete, tested with their crane",
     "estimate – ask for a quote",
     "interface to our WMS (guide 34), offline licence, source / escrow, local service"
    ],
    [
     "WMS with material flow control",
     "WMS + MFC in one, telegram interface to PLCs",
     "SAP EWM with Material Flow System (MFS)",
     "fixed-length telegrams to PLCs over TCP/IP",
     "estimate – ask for a quote",
     "MFS licence, telegram layout, SAP know-how in-house"
    ],
    [
     "Open-source WMS (check)",
     "small, self-hosted WMS for learning / tests",
     "myWMS (open-source WMS) – check project status and activity before use",
     "Java, self-hosted",
     "free licence (effort for integration)",
     "project activity, support, security updates"
    ],
    [
     "Telegram test tool",
     "send / receive fixed-length telegrams, log",
     "a TCP terminal program or a small Python script (stdlib socket)",
     "–",
     "free / low",
     "logging, checksum calculation"
    ],
    [
     "OPC UA client (test)",
     "browse the PLC server, call methods",
     "Unified Automation UaExpert",
     "free client (registration)",
     "free",
     "offline use"
    ]
   ]
  },
  {
   "id": "g17_8",
   "t": "Engineering and safety tools",
   "src": "guide 32 §17.8",
   "rows": [
    [
     "PLC engineering incl. safety",
     "S7-1500F programming, F-program",
     "Siemens TIA Portal STEP 7 Professional + STEP 7 Safety Advanced",
     "licence per engineer",
     "estimate – ask for a quote",
     "offline licence (Automation License Manager)"
    ],
    [
     "Drive commissioning",
     "trace, tuning, safety commissioning",
     "Siemens Startdrive, SEW MOVISUITE, Lenze EASY Starter, Danfoss MCT 10",
     "–",
     "estimate – ask for a quote",
     "safety acceptance test function"
    ],
    [
     "PL calculation",
     "ISO 13849-1",
     "IFA SISTEMA (free), Pilz PAScal, Siemens Safety Evaluation Tool",
     "–",
     "free / estimate – ask for a quote",
     "library of the chosen devices"
    ],
    [
     "Accelerometer for sway tests",
     "3-axis, 0.5 – 50 Hz, logger",
     "industrial vibration data logger",
     "–",
     "estimate – ask for a quote",
     "frequency range down to 0.5 Hz"
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
     "Fail-safe crane PLC S7-1515F-2 PN (or the crane maker's equivalent)",
     "1",
     "F-CPU, PROFINET + PROFIsafe, OPC UA server",
     "2, 17.1"
    ],
    [
     "ET 200SP station on the crane with F-DI / F-DQ",
     "1",
     "e-stops, fork centre, slack rope, limit switches, brakes",
     "9, 17.1"
    ],
    [
     "ET 200SP station at the conveyors with F-modules",
     "1",
     "zones, light curtains, muting, scale, scanner",
     "10, 17.6"
    ],
    [
     "Drive system with common DC link (supply + 4 axes)",
     "1",
     "travel 2 × ≈ 5.5 kW, hoist ≈ 15 kW, fork ≈ 1.5 kW, Safety Integrated",
     "4, 12, 17.2"
    ],
    [
     "Regenerative supply module (option) or braking resistor",
     "1",
     "peak ≈ 11 kW regenerative",
     "12, 17.2"
    ],
    [
     "Laser distance sensor + reflector (travel)",
     "1 + 1 spare",
     "≥ 40 m on reflector, ±1 mm, PROFINET",
     "6, 17.3"
    ],
    [
     "Bar-code positioning reader + tape (hoist)",
     "1 + 1 spare reader",
     "9.3 m tape, ±1 mm",
     "6, 17.3"
    ],
    [
     "Multi-turn absolute encoder (fork)",
     "1 + 1 spare",
     "PROFINET / SSI",
     "6, 17.3"
    ],
    [
     "Slot reference sensors",
     "2 + 2 spare",
     "reflex, small light spot",
     "6, 17.3"
    ],
    [
     "Optical data link pair",
     "1 pair + 1 spare pair",
     "100 Mbit/s, PROFINET + PROFIsafe, ≥ 40 m",
     "2, 17.4"
    ],
    [
     "Light curtains with muting (infeed + outfeed)",
     "2",
     "type 4, muting sensors",
     "9.7, 17.5"
    ],
    [
     "Door locks with guard locking (aisle doors)",
     "2",
     "PL e, escape release, lockout",
     "9.6, 17.5"
    ],
    [
     "E-stop buttons",
     "6",
     "HMI, 2 doors, crane, 2 conveyor stations",
     "9, 17.5"
    ],
    [
     "Safety limit switches aisle ends",
     "4",
     "positive opening",
     "9.4, 17.5"
    ],
    [
     "Buffers aisle ends",
     "2",
     "2 250 J at 1 m/s (or 20 250 J at 3 m/s)",
     "9.5, 17.5"
    ],
    [
     "Load cell / load pin hoist",
     "1",
     "110 % overload, 2 channels",
     "9, 17.5"
    ],
    [
     "Bar-code scanner ID point",
     "1 (+ RFID option)",
     "read rate > 99.9 %",
     "10, 17.6"
    ],
    [
     "Contour check light grid",
     "1 set",
     "±20 mm",
     "10, 17.6"
    ],
    [
     "Conveyor scale module",
     "1",
     "≤ 300 kg",
     "10, 17.6"
    ],
    [
     "Crane HMI panel (touch, 12 – 15\")",
     "1",
     "modes, jog, alarms, step chain",
     "8, 17.1"
    ],
    [
     "WCS software + industrial PC with UPS",
     "1",
     "telegrams, dual command, tracking",
     "3, 17.7"
    ],
    [
     "Engineering licences (PLC + safety + drives)",
     "1 set",
     "offline licences",
     "17.8"
    ],
    [
     "Spare-parts kit (drive module, brake, fork motor)",
     "1",
     "per supplier list",
     "8.7"
    ]
   ]
  }
 ],
 "shopTab": "Shopping list – AS/RS control",
 "shopLbl": "shopping list",
 "shopTitle": "Shopping list – AS/RS control system, one aisle, example quantities – guide 32 §17.9.",
 "price": "Price class = estimate – ask for a quote (country, year, quantity, discount). Every product must work offline (no cloud account, no online licence check at runtime). Usually the AS/RS supplier delivers the complete crane control – use the list to specify and to buy spare parts.",
 "shopNote": "Product names change (companies are bought and renamed) – check the current name, version and licence model.",
 "ph": "(e.g. S7-1515F, DL100, DDLS, MLC, SINAMICS)"
};
