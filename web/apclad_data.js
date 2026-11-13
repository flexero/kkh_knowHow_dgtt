/* Catalogue card "Real components + drawings – catalogue examples" of the APC ladder card (id ldCardB, makeCard from robotref.js).
 * Source: docs/36_plc_ladder_apc.md §19 (buy list) + §23 (drawings 36_*.svg). Makers / models are catalogue EXAMPLES –
 * data and prices change; ask the supplier for the current datasheet and a quote. Row format:
 * [item, required spec, example maker + model, key data, price class (estimate – ask for a quote), check in the datasheet] */
export const CARD = {
  guides: "guide 36",
  ph: "(e.g. AS332T-A, 1215C, PNOZ, DOP)",
  buyNote: "Price classes: low < 500 €, medium 500 – 2 000 €, high > 2 000 € per item (2020s, Europe, without engineering) – estimate, ask for a quote.",
  shopTab: "Shopping list – APC control",
  shopLbl: "shopping list",
  shopTitle: "One APC control cabinet, both variants (guide 36 §19.3). Quantities for one APC; engineering, cabinet building and the safety validation are extra.",
  shopNote: "Quantities are an example for the I/O list of guide 36 §5 (32 DI, 17 DQ, 2 AI) with ≈ 20 % reserve.",
  drawings: [
    { f: "36_plc_wiring_inputs.svg", t: "PLC input wiring – PNP sensors", c: "PNP 3-wire sensors, pressure switch, safety-relay status contact, push button and CNC output on Delta AS332T-A (S/S → 0 V) and Siemens SM 1221 (1M → M); addressing rules.", g: "guide 36 §15.1", sec: "Wiring and cabinet" },
    { f: "36_plc_wiring_outputs.svg", t: "PLC output wiring – valves, relay, servo", c: "Delta sink outputs vs Siemens source outputs, free-wheel diodes, coupling relay for the pump contactor, motion valves fed through the safety relay, servo DI / PROFINET.", g: "guide 36 §15.2", sec: "Wiring and cabinet" },
    { f: "36_cabinet_layout.svg", t: "APC control cabinet layout", c: "800 × 1 000 mm mounting plate: power row, PLC + I/O + safety relays, network + fuses + terminals; device list for the Delta and the Siemens variant.", g: "guide 36 §15.3", sec: "Wiring and cabinet" },
    { f: "36_ladder_example.svg", t: "Ladder example – Delta vs Siemens", c: "Transition S3 → S4 with SET / RST and the interlocked LiftUpValve coil in ISPSoft and TIA Portal notation, with Delta IL and SCL.", g: "guide 36 §7, §12", sec: "Program" },
    { f: "36_step_chain_grafcet.svg", t: "Step chain as GRAFCET", c: "Steps 0 – 9 of the APC change with actions, transition conditions, watchdog times, fault handling and the reverse-order rule.", g: "guide 36 §7", sec: "Program" },
    { f: "36_timing_diagram.svg", t: "Timing – M60 / FIN handshake + watchdog", c: "Step bits, valves and FIN of one 8.8 s change; fault case chip under the pallet: seating watchdog 0.8 s → F_Seat.", g: "guide 36 §10, §11", sec: "Program" },
    { f: "36_accu_hysteresis.svg", t: "Accumulator charge control", c: "Accumulator pressure with cut-in 10.8 / cut-out 11.5 MPa, start ≥ 10.7, alarm < 10.0 MPa, UnloadValve signal during changes and pauses.", g: "guide 36 §9", sec: "Program" },
  ],
  groups: [
    { id: "dcpu", t: "Delta PLC (AS300 series)", src: "guide 36 §19.1", rows: [
      ["PLC CPU", "≥ 16 DI / 16 DO, Ethernet, ISPSoft", "Delta AS332T-A (sink outputs) / AS332P-A (source outputs)", "16 DI + 16 DO transistor, Ethernet + RS-485, up to 32 modules", "low", "output type NPN / PNP, max. current per output, number of modules"],
      ["Digital input module", "16 DI 24 V, sink / source", "Delta AS16AM10N-A", "16 DI, 24 V DC, spring terminals", "low", "input delay setting, common terminal"],
      ["Digital output module", "16 DO transistor 0.5 A", "Delta AS16AN01T-A (NPN) / AS16AN01P-A (PNP)", "16 DO, 0.5 A per point", "low", "sink or source – must match the CPU wiring concept"],
      ["Analog input module", "4 × 4–20 mA, 16 bit", "Delta AS04AD-A", "4 AI, voltage / current, ± 32 000 / 0 – 32 000", "low", "range setting for 4–20 mA, wire-break detection"],
      ["Small option", "≤ 32 I/O, simple machine", "Delta DVP-ES3 (e.g. DVP32ES311T) / DVP-ES2", "16 DI / 16 DO, octal addresses X0 – X17", "low", "octal numbering X0 – X7, X10 – X17"],
      ["Software", "programming + HMI design", "Delta ISPSoft + DOPSoft", "free download from Delta", "low", "version for the CPU firmware"],
    ] },
    { id: "scpu", t: "Siemens PLC (S7-1200)", src: "guide 36 §19.1", rows: [
      ["PLC CPU", "PROFINET, ≥ 100 kB, TIA Portal", "Siemens SIMATIC S7-1200 CPU 1215C DC/DC/DC (6ES7215-1AG40-0XB0, check)", "14 DI / 10 DQ / 2 AI / 2 AQ, 125 kB, 2 × PROFINET", "low – medium", "firmware version, number of SM slots (8)"],
      ["Fail-safe CPU (option)", "F-program for e-stop / doors / STO", "Siemens CPU 1215FC DC/DC/DC (6ES7215-1AF40-0XB0, check) + SM 1226 F-DI / F-DQ", "PROFIsafe, up to SIL 3 / PL e", "medium", "STEP 7 Safety Basic licence, F-I/O count"],
      ["Digital input module", "16 DI 24 V sinking", "Siemens SM 1221 DI 16 × 24 V DC (6ES7221-1BH32-0XB0, check)", "16 DI, type 1, 4 ms delay", "low", "start address (here 20, 22, 24)"],
      ["Digital output module", "16 DQ transistor 0.5 A", "Siemens SM 1222 DQ 16 × 24 V DC (6ES7222-1BH32-0XB0, check)", "16 DQ, 0.5 A, source", "low", "group current"],
      ["Analog input module", "4 × 4–20 mA", "Siemens SM 1231 AI 4 (6ES7231-4HD32-0XB0, check)", "4 AI, 0 – 27 648, diagnostics wire break", "low", "enable wire-break diagnostics (4–20 mA)"],
      ["Software", "programming + HMI", "Siemens TIA Portal STEP 7 Basic V19 (+ WinCC Basic); STEP 7 Professional for S7-1500 / F", "licence per seat", "medium", "Basic is enough for S7-1200; Safety needs STEP 7 Safety"],
    ] },
    { id: "safe", t: "Safety relays and safety devices", src: "guide 36 §19.2", rows: [
      ["Safety relay (e-stop + doors)", "2-channel, PL e, cat. 4, feedback loop", "Pilz PNOZ s4 / Schmersal SRB-E-301ST / Phoenix Contact PSRmini", "3 safe NO + 1 aux., 24 V DC", "low", "stop category 0 / 1, aux. contact for the PLC status"],
      ["Configurable safety relay", "several safety functions, logic", "Pilz PNOZmulti 2 (e.g. PNOZ m B0) / Schmersal PROTECT PSC1", "graphic configuration, Ethernet status", "medium", "status interface to the PLC"],
      ["Light curtain relay", "type 4 OSSD evaluation", "SICK UE10-3OS / Pilz PNOZ s3 / curtain with own muting box", "OSSD 2 × PNP", "low – medium", "response time (≤ 20 ms used in guide 09 §4.7)"],
      ["Guard locking switch", "ISO 14119, PL d / e", "Euchner CTM / MGB2; Pilz PSENmlock; Schmersal AZM300", "locking force ≥ 1 000 N", "medium", "power-to-lock / power-to-unlock"],
    ] },
    { id: "hmi", t: "HMI and operator panel", src: "guide 36 §19.2", rows: [
      ["HMI panel (Delta)", "7\" touch, Ethernet", "Delta DOP-107EV / DOP-107CV", "800 × 480, Ethernet, DOPSoft", "low", "driver for the AS series"],
      ["HMI panel (Siemens)", "7\" touch, PROFINET", "Siemens TP700 Comfort / KTP700 Basic", "800 × 480, PROFINET", "low – medium", "WinCC Comfort / Basic licence"],
      ["Push buttons + key switch", "IP65, 22 mm", "Siemens SIRIUS ACT / Schneider Harmony XB5 / Eaton M22", "NO / NC contact blocks", "low", "LED colours, key positions"],
      ["Stack light", "green / yellow / red + buzzer", "Werma KombiSIGN 71 / Patlite LR6 / Siemens 8WD44", "24 V DC LED", "low", "IO-Link version"],
    ] },
    { id: "drv", t: "Servo drive, power supply, wiring parts", src: "guide 36 §19.2", rows: [
      ["Servo drive + motor (Delta)", "2 kW, PR mode, STO", "Delta ASDA-B3 + ECM-B3 motor (or ASDA-A3)", "PR mode via DI (CTRG, POS0 …), TPOS output", "medium", "STO wiring, brake output, absolute encoder"],
      ["Servo drive + motor (Siemens)", "2 kW, PROFINET, STO", "Siemens SINAMICS V90 PN + 1FL6 / SINAMICS S210 + 1FK2", "telegram 111, SINA_POS (library)", "medium", "EPOS basic positioner, safety integrated"],
      ["24 V power supply", "10 A, PELV, ≥ 20 % reserve", "Siemens SITOP PSU8200 10 A / Phoenix Contact QUINT4-PS 10 A / Delta DRP024V240W1", "24 V DC 10 A, DC OK contact", "low", "inrush of the valves, DC OK to the PLC"],
      ["Coupling relays", "24 V DC coil, 6 A contact", "Phoenix Contact PLC-RSC 24DC/21 / Weidmüller TERMSERIES / Finder 38", "plug-in, LED, diode", "low", "contact rating AC-15 for the contactor coil"],
      ["Valve plugs with LED + suppressor", "M12 / DIN 43650 form A", "Murrelektronik / Hirschmann / Lapp", "LED + varistor or diode", "low", "polarity for DC diodes"],
      ["Terminals, cables", "push-in, M12 sensor cables, PROFINET cable", "Phoenix Contact PT / WAGO TOPJOB S; Lapp / Murrelektronik M12; Siemens PROFINET FC cable", "colours per IEC 60204-1 (DC control = dark blue)", "low", "drag-chain rating at the APC"],
    ] },
  ],
  shops: [
    { title: "Variant A – Delta", cols: ["#", "Qty", "Item", "Example", "Note", "Price class"], m: 3, p: 5, w: [4, 6, 26, 28, 24, 12], rows: [
      ["1", "1", "PLC CPU", "Delta AS332T-A", "16 DI / 16 DO", "low"],
      ["2", "2", "DI module", "Delta AS16AM10N-A", "1 for the 32 DI, 1 reserve", "low"],
      ["3", "1", "DO module", "Delta AS16AN01T-A", "Y1.x + reserve", "low"],
      ["4", "1", "AI module", "Delta AS04AD-A", "AccuPressure, OilTemp", "low"],
      ["5", "1", "HMI", "Delta DOP-107EV", "alarms, step number, counters", "low"],
      ["6", "1", "Servo drive + motor", "Delta ASDA-B3 2 kW + ECM-B3", "PR mode 0° / 180°", "medium"],
      ["7", "2", "Safety relay", "Pilz PNOZ s4 (e-stop + doors), PNOZ s3 (curtain)", "status contacts to the PLC", "low"],
      ["8", "1", "Power supply", "Delta DRP024V240W1 (24 V 10 A)", "", "low"],
      ["9", "1", "Software", "ISPSoft + DOPSoft", "free", "–"],
    ] },
    { title: "Variant B – Siemens", cols: ["#", "Qty", "Item", "Example", "Note", "Price class"], m: 3, p: 5, w: [4, 6, 26, 28, 24, 12], rows: [
      ["1", "1", "PLC CPU", "CPU 1215C DC/DC/DC (or 1215FC with F-I/O)", "", "low – medium"],
      ["2", "3", "DI module", "SM 1221 DI 16", "start addresses 20 / 22 / 24", "low"],
      ["3", "2", "DQ module", "SM 1222 DQ 16", "Q20 – Q23", "low"],
      ["4", "1", "AI module", "SM 1231 AI 4", "4–20 mA with wire-break diagnostics", "low"],
      ["5", "1", "HMI", "TP700 Comfort / KTP700 Basic", "", "low – medium"],
      ["6", "1", "Servo drive + motor", "SINAMICS V90 PN 2 kW + 1FL6", "SINA_POS, telegram 111", "medium"],
      ["7", "2", "Safety relay", "Pilz PNOZ s4 / s3 (or F-I/O with 1215FC)", "", "low"],
      ["8", "1", "Power supply", "SITOP PSU8200 24 V 10 A", "", "low"],
      ["9", "1", "Software", "TIA Portal STEP 7 Basic + WinCC Basic", "licence", "medium"],
    ] },
  ],
};
