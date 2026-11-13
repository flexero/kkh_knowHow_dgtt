/* AS/RS item 5 – data for the card "Real components + drawings – catalogue examples" (makeCard in robotref.js), id #ldCardA.
 * GENERATED (scratch gen_card.py) from the same tables as docs/35_plc_ladder_basics_asrs.md §24 – edit both together.
 * Row format: [item, required spec, example maker + model, key data, price class (estimate), check in the datasheet]. */
export const CARD = {
 "drawings": [
  {
   "f": "35_scan_cycle.svg",
   "t": "PLC scan cycle + response time",
   "c": "read inputs → run the networks top to bottom → write outputs; scan 20 ms, worst-case reaction = filter + 2 scans + output delay (example numbers)",
   "g": "guide 35 §3"
  },
  {
   "f": "35_ladder_symbols.svg",
   "t": "Ladder symbols – Delta vs Siemens",
   "c": "contacts, coils, set / reset, edges, timer, counter, compare, move – the same element in ISPSoft and TIA Portal, with IL mnemonic",
   "g": "guide 35 §4 – §9"
  },
  {
   "f": "35_io_wiring.svg",
   "t": "PLC input + output wiring",
   "c": "PNP (sourcing) and NPN (sinking) sensors on Delta AS (S/S terminal) and Siemens (M terminal); transistor output with interposing relay + free-wheeling diode",
   "g": "guide 35 §12"
  },
  {
   "f": "35_seal_in_interlock.svg",
   "t": "Seal-in, interlock, alarm latch",
   "c": "start / stop with seal-in, forward / reverse interlock, alarm = cause OR (alarm AND NOT ack) – ladder + timing",
   "g": "guide 35 §5 – §6, §10"
  },
  {
   "f": "35_timing_diagram.svg",
   "t": "Timers, edges and the WCS handshake",
   "c": "TON / TOF / TP, rising / falling edge (one scan), 4-way handshake JOB – ACK – DONE – DACK, timer accuracy ± 1 scan",
   "g": "guide 35 §7 – §8, §20"
  },
  {
   "f": "35_asrs_step_chain.svg",
   "t": "AS/RS crane step chain (GRAFCET)",
   "c": "steps S10 … S160 with actions and transitions, abort branch (empty slot), time-outs A8sss – the ladder of networks 7 – 12",
   "g": "guide 35 §9, §18"
  },
  {
   "f": "35_asrs_io_map.svg",
   "t": "AS/RS PLC I/O map – Delta + Siemens",
   "c": "AS332T-A + AS16AM10N-A / AS16AN01T-A / AS04AD-A next to CPU 1515F-2 PN + ET 200SP: addresses, sensors, outputs (example)",
   "g": "guide 35 §16"
  },
  {
   "f": "35_cabinet_layout.svg",
   "t": "PLC cabinet layout",
   "c": "power supply, PLC + I/O, safety relay, interposing relays, terminals, ducts, 24 V distribution – Delta and Siemens variant (example)",
   "g": "guide 35 §22"
  }
 ],
 "groups": [
  {
   "id": "g1",
   "t": "PLC CPUs (Delta + Siemens)",
   "src": "guide 35 §24.1",
   "rows": [
    [
     "Delta mid-range PLC CPU",
     "16 DI / 16 DO on board, Ethernet, up to 32 modules, step relays S, ISPSoft",
     "Delta AS332T-A (NPN sinking outputs) · AS332P-A (PNP sourcing outputs)",
     "16 DI + 16 DO 24 V DC, 2 × RS-485, Ethernet, program memory see datasheet",
     "€€€",
     "output type T = sinking / P = sourcing, max. modules, program memory, CANopen / EtherCAT option"
    ],
    [
     "Delta small PLC (option)",
     "≈ 16 – 40 I/O, simple machines (APC, HPU)",
     "Delta DVP-ES3 (e.g. DVP32ES300T) · DVP-ES2 / DVP-SS2",
     "octal X0 – X17, Y0 – Y17, WPLSoft / ISPSoft",
     "€€",
     "octal addressing, high-speed inputs, Ethernet built in or not"
    ],
    [
     "Siemens fail-safe CPU for the AS/RS",
     "PROFINET + PROFIsafe, F-program for e-stop / door / muting / SLS, 2 PN interfaces",
     "Siemens S7-1500F CPU 1515F-2 PN (6ES7515-2FN03-0AB0)",
     "work memory see datasheet, 2 × PROFINET, Safety Integrated",
     "€€€€",
     "firmware V3.x, F-runtime, number of PROFIsafe devices, memory card size"
    ],
    [
     "Siemens compact CPU (APC / HPU)",
     "14 DI / 10 DQ / 2 AI on board, PROFINET",
     "Siemens S7-1200 CPU 1215C DC/DC/DC (6ES7215-1AG40-0XB0) · CPU 1215FC (fail-safe)",
     "14 DI / 10 DQ 24 V DC, 2 AI, 2 AQ",
     "€€€",
     "DC/DC/DC vs AC/DC/RLY, F-version for integrated safety"
    ],
    [
     "Memory card",
     "program + data on the card, spare card for each CPU",
     "Siemens SIMATIC Memory Card 24 MB (6ES7954-8LF03-0AA0) · Delta: SD card in the CPU slot",
     "24 MB / SD",
     "€€",
     "size for the project + recipes, Siemens: card is mandatory for S7-1500"
    ]
   ]
  },
  {
   "id": "g2",
   "t": "I/O modules and analog",
   "src": "guide 35 §24.2",
   "rows": [
    [
     "Delta digital input module",
     "16 DI 24 V DC sink / source",
     "Delta AS16AM10N-A",
     "16 DI, 24 V DC",
     "€€",
     "common terminal S/S, input filter time (ms)"
    ],
    [
     "Delta digital output module",
     "16 DO transistor",
     "Delta AS16AN01T-A (sinking) · AS16AN01P-A (sourcing)",
     "16 DO, 0.5 A per point (check)",
     "€€",
     "sink vs source, total current per common, short-circuit protection"
    ],
    [
     "Delta analog input",
     "4 AI, 4 – 20 mA for load cell + scale",
     "Delta AS04AD-A",
     "4 ch, voltage / current, resolution see datasheet",
     "€€€",
     "scaling range (e.g. 0 – 32 000), filter, wire-break detection"
    ],
    [
     "Delta analog output",
     "4 AO 0 – 10 V / 4 – 20 mA",
     "Delta AS04DA-A",
     "4 ch",
     "€€€",
     "resolution, load resistance"
    ],
    [
     "Siemens decentral I/O head",
     "ET 200SP interface on the crane and at the conveyor",
     "Siemens IM 155-6 PN HF (6ES7155-6AU01-0CN0) + BaseUnits + server module",
     "PROFINET, up to 64 modules",
     "€€€",
     "BaseUnit types (light / dark), shared device, PROFIsafe"
    ],
    [
     "Siemens digital input",
     "16 DI 24 V DC PNP",
     "Siemens DI 16×24VDC ST (6ES7131-6BH01-0BA0)",
     "16 DI, type 3",
     "€€",
     "input delay, sourcing (PNP), diagnostics"
    ],
    [
     "Siemens digital output",
     "16 DQ 24 V DC 0.5 A",
     "Siemens DQ 16×24VDC/0.5A ST (6ES7132-6BH01-0BA0)",
     "16 DQ, 0.5 A",
     "€€",
     "total current, load groups"
    ],
    [
     "Siemens analog input",
     "4 AI 4 – 20 mA",
     "Siemens AI 4×I 2-/4-wire ST (6ES7134-6GD01-0BA1)",
     "4 ch, 0 – 27 648 nominal range",
     "€€€",
     "2-wire / 4-wire, overflow 32 767, wire-break diagnostics"
    ],
    [
     "Siemens fail-safe input",
     "F-DI for e-stop / door / light curtain (2-channel)",
     "Siemens F-DI 8×24VDC HF (6ES7136-6BA01-0CA0)",
     "8 F-DI, PROFIsafe, up to PL e / SIL 3",
     "€€€",
     "pulse test, discrepancy time, F-address (DIP switch)"
    ]
   ]
  },
  {
   "id": "g3",
   "t": "Safety relays and safety controllers",
   "src": "guide 35 §24.3",
   "rows": [
    [
     "Safety relay e-stop + guard (Delta solution)",
     "2-channel e-stop / door, monitored manual reset, safety contacts + 1 auxiliary contact for the PLC",
     "Pilz PNOZ s4 · Schmersal SRB-E-301ST · Phoenix Contact PSRmini PSR-MS20",
     "up to Cat 4 / PL e (with suitable devices), 24 V DC",
     "€€",
     "reset type (monitored), stop category 0 / 1, number of contacts, feedback loop"
    ],
    [
     "Small safety controller (Delta solution, many functions)",
     "e-stops + door + muting + SLS signals in one device",
     "Pilz PNOZmulti 2 (base unit + I/O modules) · Schmersal PROTECT PSC1",
     "configurable, Ethernet / fieldbus status to the PLC",
     "€€€",
     "muting function block, number of inputs, status interface to the Delta PLC (Modbus TCP)"
    ],
    [
     "Siemens safety relay (if no F-CPU)",
     "e-stop / door, monitored start",
     "Siemens SIRIUS 3SK1 · 3SK2 safety relay with logic",
     "up to PL e / SIL 3",
     "€€",
     "3SK2 needs its configuration software"
    ],
    [
     "Safety software (Siemens)",
     "F-program in TIA Portal",
     "STEP 7 Safety Basic / Advanced V19",
     "Advanced = S7-1500F",
     "€€€€",
     "licence type (floating / single), version = TIA version"
    ]
   ]
  },
  {
   "id": "g4",
   "t": "HMI panels",
   "src": "guide 35 §24.4",
   "rows": [
    [
     "Delta HMI 10\"",
     "alarms, step number, manual jog, semi-auto job entry",
     "Delta DOP-110CS / DOP-110WS",
     "10.1\" touch, Ethernet, DOPSoft (free)",
     "€€€",
     "protocol to AS series (Delta Ethernet / Modbus TCP), alarm history"
    ],
    [
     "Siemens Comfort panel 7\"",
     "alarms (ProDiag), step display, recipes",
     "Siemens TP700 Comfort (6AV2124-0GC01-0AX0)",
     "7\" touch, PROFINET, WinCC Comfort",
     "€€€",
     "WinCC licence (Comfort / Advanced), PROFINET ports"
    ],
    [
     "Siemens Basic panel (cheaper)",
     "simple operation",
     "Siemens KTP700 Basic (6AV2123-2GB03-0AX0)",
     "7\" touch, PROFINET",
     "€€",
     "no scripts, fewer alarms"
    ]
   ]
  },
  {
   "id": "g5",
   "t": "Power supply, interface relays, terminals",
   "src": "guide 35 §24.5",
   "rows": [
    [
     "24 V DC power supply",
     "PLC + sensors + outputs, 10 A (check the load list)",
     "Delta DRL-24V240W1AA · Siemens SITOP PSU8200 10 A (6EP3334-8SB00-0AY0) · PULS QS10.241",
     "24 V, 10 A, efficiency > 90 %",
     "€€",
     "derating, buffer time, DC-OK contact to a PLC input"
    ],
    [
     "Electronic circuit breaker",
     "selective 24 V protection per group (PLC, sensors, outputs)",
     "Phoenix Contact CBMC E4 24DC/1-10A · Siemens SITOP SEL1400 · PULS PISA11",
     "4 channels, adjustable",
     "€€",
     "channel current, signal contact"
    ],
    [
     "Interposing relay",
     "for loads > 0.5 A or other voltages, with LED + diode",
     "Phoenix Contact PLC-RSC-24DC/21 · Finder 38.51 · Weidmüller TERMSERIES",
     "1 CO, 6 A",
     "€",
     "coil voltage 24 V DC, built-in free-wheeling diode"
    ],
    [
     "Terminals with test disconnect",
     "I/O terminals, 3-level sensor terminals",
     "Phoenix Contact PT 2.5 / PTTB · Weidmüller A2C 2.5 · WAGO TOPJOB S 2002",
     "push-in, 2.5 mm²",
     "€",
     "colour code (blue 24 V DC), marking"
    ]
   ]
  },
  {
   "id": "g6",
   "t": "Software, cables, tools",
   "src": "guide 35 §24.6",
   "rows": [
    [
     "Delta programming software",
     "ladder, IL, SFC, ST for AS / DVP",
     "Delta ISPSoft 3.x + COMMGR · WPLSoft (DVP only)",
     "free download from Delta",
     "€ (free)",
     "version for your CPU firmware, COMMGR driver"
    ],
    [
     "Siemens programming software",
     "LAD / FBD / SCL / GRAPH, S7-1200 + S7-1500",
     "TIA Portal STEP 7 Basic (S7-1200 only) · STEP 7 Professional V19 (S7-1500)",
     "Professional needed for S7-1500 and GRAPH",
     "€€€€",
     "licence type, update service (SUS), PLCSIM for offline tests"
    ],
    [
     "Simulation",
     "test the program without hardware",
     "Siemens S7-PLCSIM / PLCSIM Advanced · Delta ISPSoft simulation",
     "virtual PLC",
     "€€ – €€€",
     "PLCSIM Advanced for OPC UA / co-simulation"
    ],
    [
     "Programming cable",
     "PC ↔ PLC",
     "Delta: Ethernet or USB · Siemens: Ethernet (PROFINET cable)",
     "–",
     "€",
     "IP address of the PC in the same subnet"
    ],
    [
     "Sensor cables",
     "M12 A-coded, 4-pin, PUR for drag chains",
     "Phoenix Contact SAC-4P-…-PUR · Murrelektronik 7000-12 · Lapp UNITRONIC SENSOR",
     "M12, 5 m",
     "€",
     "bending cycles, LED in the connector, shield"
    ],
    [
     "Multimeter + loop calibrator",
     "I/O check, 4 – 20 mA loop test",
     "Fluke 87V + Fluke 789 ProcessMeter · Beha-Amprobe",
     "mA source / measure",
     "€€€",
     "CAT rating, mA simulation"
    ]
   ]
  }
 ],
 "shopCols": [
  "#",
  "Item",
  "Delta variant (example)",
  "Siemens variant (example)",
  "Qty",
  "Price class (estimate – ask for a quote)"
 ],
 "shop": [
  [
   "1",
   "PLC CPU",
   "AS332T-A (or AS332P-A for PNP outputs)",
   "CPU 1515F-2 PN + memory card 24 MB",
   "1",
   "€€€ / €€€€"
  ],
  [
   "2",
   "Digital inputs (≈ 45 DI incl. reserve)",
   "2 × AS16AM10N-A (+ 16 DI on board)",
   "4 × DI 16×24VDC ST in 2 ET 200SP stations",
   "2 / 4",
   "€€"
  ],
  [
   "3",
   "Digital outputs (≈ 30 DO incl. reserve)",
   "1 × AS16AN01T-A (+ 16 DO on board)",
   "2 × DQ 16×24VDC/0.5A ST",
   "1 / 2",
   "€€"
  ],
  [
   "4",
   "Analog inputs (load cell, scale)",
   "1 × AS04AD-A",
   "1 × AI 4×I 2-/4-wire ST",
   "1",
   "€€€"
  ],
  [
   "5",
   "Decentral I/O heads",
   "– (or Delta remote I/O on the crane)",
   "2 × IM 155-6 PN HF + BaseUnits + server modules",
   "0 / 2",
   "€€€"
  ],
  [
   "6",
   "Safety",
   "PNOZmulti 2 (e-stops, door, muting) + status to the PLC",
   "F-DI 8×24VDC HF + F-DQ module (F-program)",
   "1 set",
   "€€€"
  ],
  [
   "7",
   "HMI",
   "DOP-110CS",
   "TP700 Comfort",
   "1",
   "€€€"
  ],
  [
   "8",
   "24 V power supply + ECB",
   "DRL-24V240W1AA + CBMC 4 ch",
   "SITOP PSU8200 10 A + SEL1400",
   "1 + 1",
   "€€"
  ],
  [
   "9",
   "Interposing relays (beacon, horn, diverter)",
   "PLC-RSC-24DC/21",
   "PLC-RSC-24DC/21",
   "6",
   "€"
  ],
  [
   "10",
   "Software",
   "ISPSoft (free) + DOPSoft (free)",
   "STEP 7 Professional + Safety Advanced + WinCC Comfort",
   "1",
   "€ / €€€€"
  ],
  [
   "11",
   "Cables, terminals, ferrules, markers",
   "M12 sensor cables, push-in terminals",
   "same + PROFINET cables",
   "1 lot",
   "€€"
  ]
 ],
 "shopM": 1,
 "shopP": 5,
 "shopW": [
  4,
  20,
  27,
  29,
  8,
  12
 ],
 "guides": "guide 35",
 "shopTab": "Shopping list – AS/RS PLC (both variants)",
 "ph": "(e.g. AS332T-A, 1515F, PNOZ, TP700)",
 "buyNote": "Price classes: € < 50 € · €€ 50 – 300 € · €€€ 300 – 1 500 € · €€€€ > 1 500 € (rough estimates, without installation – ask 2 – 3 suppliers).",
 "shopLbl": "shopping list",
 "shopTitle": "PLC hardware for the AS/RS crane + conveyor control (guide 35 §24.7) – Delta variant and Siemens variant side by side. Choose ONE family.",
 "shopNote": "Example quantities for the I/O list of guide 35 §16 (≈ 45 DI, ≈ 30 DO, 2 AI + 20 % reserve). The AS/RS supplier normally delivers the crane control – use the list to compare offers and to plan spare parts.",
 "shopPrice": true
};
