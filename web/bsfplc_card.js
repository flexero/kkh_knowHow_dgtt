/* Item 8 – catalogue card "Real components + drawings – catalogue examples" (#bfCard8, makeCard of web/robotref.js).
 * Same content as guide 47 §19 (buy list) + §20 (shopping list). Row format: [item, required spec, example maker + model, key data,
 * price class (estimate – ask for a quote), check in the datasheet]. Catalogue examples, not a recommendation. Offline – no links. */
import { plcBom, PLC_ROWS } from "./bsfplc_data.js";

const B = plcBom();
const own = PLC_ROWS.filter((r) => r.own).reduce((s, r) => s + r.qty, 0);
export const CARD8 = {
  guides: "guide 47", shopTab: "Shopping list (PLCs of the plant)", shopLbl: "shopping list", ph: "(e.g. AS332T-A, 1215C, PNOZ, V90, HBM)",
  buyNote: "Price classes: € < 0.5 k€, €€ 0.5 – 2 k€, €€€ 2 – 10 k€, €€€€ > 10 k€ (estimate – ask for a quote). Models change – check the current catalogue and the firmware / software version.",
  drawings: [
    { sec: "Architecture + interface", f: "47_factory_plc_architecture.svg", t: "PLC architecture of the factory", c: "73 machines: CNC machines with the maker's PLC, our PLCs (Delta AS / Siemens S7-1200 / S7-1500F) for presses, induction, benches, test stands and assembly; every one a Modbus TCP server → gateway → HTTP → MES. Safety hard-wired.", g: "guide 47 §3" },
    { sec: "Architecture + interface", f: "47_machine_connection.svg", t: "How one machine is connected", c: "Sensors / actuators → PLC (program + Modbus TCP server, port 502) → switch, machine VLAN → gateway (client, 100 ms – 10 s) → HTTP REST + SSE → MES / twin / andon.", g: "guide 47 §3.3" },
    { sec: "Architecture + interface", f: "47_register_image.svg", t: "Standard interface – register image 0 … 226 (map V1.1)", c: "FAST 0 – 11 (header, status, mode, state, alarm, handshake), COUNTERS 20 – 45 + process from 46, ENERGY 100 – 103, COMMAND 200 – 226 (226 = gateway heartbeat); which PLC tag fills which register (Delta D n · Siemens \"MB_HR\").", g: "guide 47 §4" },
    { sec: "Architecture + interface", f: "47_status_word_bits.svg", t: "Status word + hs.status bit map", c: "std.status bits 0 – 7 (RUN 1, IDLE 2, SET-UP 4, ALARM 8, E-STOP 16, BLOCKED 32, STARVED 64, NO SHIFT 128) and hs.status bits 0 – 4 (ACK, BUSY, DONE, REJECT, READY) with worked values.", g: "guide 47 §4.3" },
    { sec: "Architecture + interface", f: "47_handshake_timing.svg", t: "MES order handshake – timing diagram", c: "FC16 data → FC06 REQ toggle → ACK = REQ in ≤ 1 scan → gateway sees it at the next 100 ms poll → BUSY while the lot runs → DONE toggles at the end; result codes 0 – 4, time-out 3 s.", g: "guide 47 §5" },
    { sec: "Architecture + interface", f: "47_modbus_mapping_s7_delta.svg", t: "Modbus mapping – Siemens MB_SERVER vs Delta AS", c: "Holding register n = \"MB_HR\" word n (big-endian, Real = ABCD) vs Delta D n (32-bit low word first → word swap); FC01/02/04 areas; CONNECT parameters; port 502.", g: "guide 47 §7 – §9" },
    { sec: "Machine programs", f: "47_induction_io_sequence.svg", t: "Induction line BS-IND – I/O + sequence", c: "Prepare (clamp, rotation, quench) → approach 1.5 s → preheat 1 s → scan 850 mm at 4 mm/s = 212.5 s → post-quench 8 s → return; generator, quench and energy-monitor interlocks.", g: "guide 47 §11" },
    { sec: "Machine programs", f: "47_straightening_sequence.svg", t: "Straightening press – measure, bend, re-measure", c: "One turn: TIR = max − min, high point angle; stroke = K × TIR / 2 beyond contact (600 µm → 1.8 mm); max. 3 bends; worked example 600 → 102 → ≤ 100 µm.", g: "guide 47 §12" },
    { sec: "Machine programs", f: "47_tgr_chiller_loop.svg", t: "Thread grinder – oil chiller loop + CNC interface", c: "PT100 → PLC: hysteresis 19.9 / 20.2 °C, warning ± 0.5 K = no finish pass (M61), hold ± 1 K for 10 s; chiller trip timeline 25 s / 60 s; CNC bits.", g: "guide 47 §13" },
    { sec: "Machine programs", f: "47_torque_signal_chain.svg", t: "Preload torque stand – signal chain + evaluation", c: "Servo 100 min⁻¹ → screw → nut on the reaction arm → torque sensor → amplifier ±10 V → AI 16 bit → samples 50 … 650 mm → mean, band, %, OK / NOK → torque registers.", g: "guide 47 §14" },
    { sec: "Machine programs", f: "47_agv_e84_handshake.svg", t: "AGV transfer – E84-style handshake", c: "CS_0, VALID, L_REQ / U_REQ, TR_REQ, READY, BUSY, COMPT over time for a load; fleet manager HTTP → remote I/O / optical PIO → PLC DI / DQ.", g: "guide 47 §15" },
  ],
  groups: [
    { id: "cpu", t: "PLC CPUs", src: "guide 47 §19.1", rows: [
      ["PLC CPU – Delta", "≥ 16 DI / 16 DO, Ethernet with Modbus TCP server, IEC 61131-3", "Delta AS332T-A (NPN outputs) / AS332P-A (PNP outputs)", "16 DI + 16 DO, Ethernet + 2 × RS-485, ISPSoft (free)", "€", "output type T / P; Modbus TCP server connections; D-bit (Dn.b) support"],
      ["PLC CPU – Delta small", "≤ 12 I/O stations (incoming check, packing)", "Delta AS228T-A", "8 DI + 8 DO + Ethernet", "€", "same family, fewer I/O"],
      ["PLC CPU – Siemens", "14 DI / 10 DQ, PROFINET, MB_SERVER", "Siemens S7-1200 CPU 1215C DC/DC/DC (6ES7215-1AG40-0XB0)", "14 DI, 10 DQ, 2 AI 0–10 V, 2 AQ, 2 × PROFINET", "€€", "firmware for TIA V19; on-board AI only 0–10 V"],
      ["PLC CPU – Siemens F (induction)", "integrated safety + motion + memory", "Siemens S7-1500 CPU 1513F-1 PN (6ES7513-1FM03-0AB0)", "F-CPU SIL 3 / PL e, TO for servo axes, PROFIsafe", "€€€", "STEP 7 Safety Advanced licence; F-modules"],
      ["PLC CPU – Siemens F compact", "safety in a compact CPU (option for the presses)", "Siemens S7-1200 CPU 1215FC DC/DC/DC", "F-CPU up to SIL 3 with SM 1226 F-DI / F-DQ", "€€", "STEP 7 Safety Basic"],
    ] },
    { id: "io", t: "I/O + analog + RTD modules", src: "guide 47 §19.2", rows: [
      ["DI module – Delta", "16 DI 24 V", "Delta AS16AM10N-A", "sink / source inputs", "€", "addresses X1.0 … (slot order)"],
      ["DO module – Delta", "16 DO 24 V", "Delta AS16AN01T-A (NPN) / AS16AN01P-A (PNP)", "0.5 A per output", "€", "output type"],
      ["Analog input – Delta", "4 ch ±10 V / 4–20 mA, 16 bit", "Delta AS04AD-A", "value 0 … 32000 (check range setting)", "€", "D register mapping in HWCONFIG – keep D0 … D226 free!"],
      ["Analog output – Delta", "4 ch 0–10 V / 4–20 mA", "Delta AS04DA-A", "generator set point, servo speed", "€", "0 … 32000 = 0 … 10 V (check)"],
      ["RTD input – Delta", "PT100 4-wire, 0.01 °C", "Delta AS04RTD-A", "4 ch PT100 / PT1000", "€", "resolution / filter for ± 0.1 K control"],
      ["DI / DQ – Siemens", "8 DI + 8 DQ", "Siemens SM 1223 DI 8 / DQ 8 (6ES7223-1BH32-0XB0)", "%I8.0 … / %Q8.0 …", "€", "slot addresses in the device view"],
      ["Analog input – Siemens", "4 ch 16 bit (torque, run-out)", "Siemens SM 1231 AI 4 × 16 bit (6ES7231-5ND32-0XB0) / AI 4 × 13 bit", "0 … 27648 nominal", "€€", "16-bit module for the torque stand"],
      ["RTD – Siemens", "PT100 4-wire", "Siemens SM 1231 RTD 4 × 16 bit (6ES7231-5PD32-0XB0)", "0.1 °C (check the 'climate' range 0.01 °C)", "€€", "range setting"],
      ["ET 200MP – Siemens (induction)", "DI 32 / DQ 32 / AI 8 / AQ 4 + F-DI / F-DQ", "Siemens ET 200MP modules for S7-1500 (6ES7521… / 6ES7522… / 6ES7531… / 6ES7532… / F-modules 6ES7526…)", "central rack of the 1513F", "€€€", "power budget, F-addresses"],
    ] },
    { id: "pwr", t: "Power supplies + safety relays", src: "guide 47 §19.3", rows: [
      ["24 V DC power supply", "5 – 10 A, PELV, DIN rail", "PULS CS5.244 / Siemens SITOP PSU6200 / Phoenix QUINT4 / Delta DRP024V", "efficiency ≥ 90 %, hold-up ≥ 20 ms", "€", "derating, separate supply for outputs"],
      ["Safety relay – e-stop / guard", "Cat 3 / PL d, 2 NO + status contact", "Pilz PNOZ s4 / Schmersal SRB-E-301ST / Phoenix Contact PSRmini PSR-MS30", "feedback loop, manual reset", "€", "PL / SIL, contact rating, status output to the PLC"],
      ["Safety controller (configurable)", "several safety functions: door + light curtain + STO + generator", "Pilz PNOZmulti 2 / Schmersal PROTECT PSC1 / Phoenix PSR-TRISAFE", "graphic config, status bits to the PLC (I/O)", "€€", "no safety over Modbus – status only as I/O"],
      ["Light curtain (press)", "type 4, resolution 14 / 30 mm", "SICK deTec4 / Pilz PSENopt / Keyence GL-R", "with muting / blanking options", "€€", "safety distance EN ISO 13855"],
      ["Door switch with guard locking", "PL e, locking monitored", "Pilz PSENmlock / Schmersal AZM400 / Euchner CTP", "solenoid / power-to-unlock", "€", "locking principle for run-down times"],
    ] },
    { id: "drv", t: "Servo drives, motors, process interfaces", src: "guide 47 §19.4", rows: [
      ["Servo drive – Delta", "0.75 – 2 kW, speed / position mode, STO", "Delta ASDA-B3 (e.g. ASD-B3-0721-L) + ECM-B3 motor", "pulse / analog / EtherCAT variants, STO", "€€", "control mode, STO wiring, encoder"],
      ["Servo drive – Siemens", "0.4 – 2 kW, PROFINET, STO", "Siemens SINAMICS V90 PN + 1FL6 motor", "telegram 1 / 3 / 102, TO_SpeedAxis / PositioningAxis", "€€", "PROFINET IRT not needed for speed mode"],
      ["Induction generator interface", "digital + analog I/O: heat on, ready, fault, P set, P / f actual", "generator maker I/O option (EFD / EMA Indutec / eldec / SMS Elotherm – check)", "0–10 V set point and monitor outputs, contacts", "€€", "the HV / pulse block belongs to the SAFETY circuit"],
      ["Quench flow meter + switch", "4–20 mA flow + independent switch", "ifm SM / Endress+Hauser Promag / Siemens SITRANS FM + flow switch ifm SI", "magnetic-inductive, polymer quench", "€€", "minimum conductivity, response time"],
      ["Oil chiller (thread grinder)", "± 0.1 K, release / run / fault contacts, optional Modbus TCP", "Hyfra / Technotrans / Daikin / Riello (check)", "set point 20.0 °C, capacity for the grinding power", "€€€", "control stability ± 0.1 K, filter + condenser cleaning plan (NCR)"],
      ["Mist extractor", "for grinding oil, Δp monitoring", "Absolent / Filtermist / Losma (check)", "with fire damper option", "€€", "filter stages, Δp switch, fire protection"],
    ] },
    { id: "sens", t: "Sensors: torque, force, run-out, RFID", src: "guide 47 §19.5", rows: [
      ["Reaction torque sensor", "2 N·m, accuracy class 0.1 – 0.2", "HBM (HBK) T20WN / Kistler 4502A / Lorenz Messtechnik DR-2112 (check models)", "with amplifier ±10 V", "€€", "range 2 N·m for Tp 0.3 N·m (resolution!), overload"],
      ["Measuring amplifier", "strain gauge, ±10 V, tare input", "HBM ClipX / Kistler 5073 / Lorenz LCV", "filter, tare via digital input", "€€", "bandwidth, filter for 100 ms samples"],
      ["Load cell (press)", "100 kN, compression", "HBM C9C / Kistler 9351 / Lorenz K-1800", "+ amplifier 0–10 V", "€€", "mounting, side load"],
      ["Run-out sensor", "laser triangulation ± 2 mm or LVDT", "Keyence IL-S / Micro-Epsilon optoNCDT 1420 / Solartron LVDT", "±10 V or 4–20 mA, µm resolution", "€€", "surface (ground / black), temperature drift"],
      ["RFID reader with Modbus TCP", "HF 13.56 MHz, Ethernet, Modbus TCP (check option)", "Balluff BIS M / Pepperl+Fuchs IDENTControl / Siemens SIMATIC RF200 / Turck (check protocol)", "serial no. on the carrier tag", "€€", "protocol option, connection limits, tag memory"],
      ["E84 / PIO for the AGV", "8 + 8 bits, optical or via remote I/O", "Hokuyo DMS series (optical PIO) / Moxa ioLogik E1212 (REST API) – check with the AGV maker", "24 V DI / DO to the PLC", "€", "timing values, ES wiring, fleet manager integration"],
    ] },
    { id: "hmi", t: "HMIs, switches, software", src: "guide 47 §19.6", rows: [
      ["HMI 7\" – Delta", "touch, Ethernet, alarms", "Delta DOP-107EV / DOP-107BV (DOP-100 series)", "DOPSoft free", "€", "protocol to the AS (Ethernet)"],
      ["HMI 7\" – Siemens", "touch, PROFINET, alarms", "Siemens KTP700 Basic / TP700 Comfort", "WinCC Basic / Comfort in TIA", "€€", "WinCC version = TIA version"],
      ["Managed switch (cell)", "8 – 16 ports, VLAN, IGMP, ring (MRP / RSTP)", "Siemens SCALANCE XC208 / Phoenix FL SWITCH 2000 / Moxa EDS-G508E / Hirschmann BOBCAT", "DIN rail, 24 V", "€€", "VLAN plan of item 4, port mirroring for Wireshark"],
      ["Software – Delta", "LAD / ST / SFC, HWCONFIG", "Delta ISPSoft 3.x (+ DIADesigner for AS)", "free download", "– (free)", "version for the CPU firmware"],
      ["Software – Siemens", "S7-1200 / S7-1500 / Safety", "TIA Portal STEP 7 Basic / Professional + STEP 7 Safety Basic / Advanced", "floating licence", "€€ / €€€", "S7-1500F needs Professional + Safety Advanced"],
      ["Modbus test tool", "client for the commissioning checklist", "own gateway tools (tools/spst_gateway.py) / Modbus Poll (check licence) / Wireshark", "FC03 / FC06 / FC16, hex view", "– / €", "offline installers"],
    ] },
  ],
  shopTitle: `PLC side of the example plant: ${own} machines with OUR PLC (option A Delta or option B Siemens – choose one family), plus the cell PLCs of the thread grinders. CNC machines bring their own control.`,
  shopNote: "Quantities from the PLC selection table (item 8 page). Prices are rough estimates 2026 – ask for a quote. Add 10 % spare modules.",
  shops: [
    { title: "Shopping list – PLCs and accessories", cols: ["Pos", "Qty", "Item", "Option A – Delta", "Option B – Siemens", "Price class (estimate – ask for a quote)"], m: 3, p: 5, rows: [
      ["1", String(B.rows[0].n), "PLC CPU", "AS332T-A / AS228T-A", "CPU 1215C DC/DC/DC (2 × CPU 1513F-1 PN for the induction lines)", "A ≈ 0.45 k€ · B ≈ 0.65 k€ each (1513F ≈ 3 – 4 k€)"],
      ["2", B.rows[0].mod.replace(" modules", ""), "I/O modules (DI / DO / AI / AQ / RTD)", "AS16AM10N-A, AS16AN01T-A, AS04AD-A, AS04DA-A, AS04RTD-A", "SM 1221 / 1222 / 1223 / 1231 / 1232, ET 200MP", "€ each"],
      ["3", String(B.rows[0].n), "24 V power supply", "Delta DRP024V / PULS", "SITOP PSU6200 / PULS", "€"],
      ["4", String(B.rows[0].n), "Safety relay / safety controller", "Pilz PNOZ s4 / PNOZmulti 2", "Pilz / Schmersal / F-CPU", "€ – €€"],
      ["5", String(B.rows[0].n), "HMI 7\"", "DOP-107EV", "KTP700 Basic", "€ – €€"],
      ["6", "6", "Servo drive + motor (induction scan, torque stand, run-in …)", "ASDA-B3 + ECM-B3", "V90 PN + 1FL6", "€€ each"],
      ["7", "3", "Torque sensor + amplifier (AS-BSA, AS-RUN, QC-MAT)", "HBM / Kistler / Lorenz", "same", "€€ each"],
      ["8", "4", "Load cell + run-out sensor (straightening presses)", "HBM / Kistler + Keyence / Micro-Epsilon", "same", "€€ each"],
      ["9", "2", "Induction generator interface option", "generator maker", "generator maker", "€€"],
      ["10", "8", "Cell switch (managed, VLAN)", "Moxa / Phoenix / Hirschmann", "SCALANCE XC208", "€€ each"],
      ["11", "2", "RFID reader with Modbus TCP + E84 PIO (run-in + AGV port)", "Balluff / P+F + Hokuyo / Moxa ioLogik", "Siemens RF200 / same", "€€"],
      ["12", "1 set", "Software + spare parts", "ISPSoft / DOPSoft (free) + 1 CPU + 1 of each module", "TIA Portal Basic / Professional + Safety + spares", "– / €€€"],
      ["Σ", "–", `Total PLC hardware (from the BOM table)`, B.rows[0].total, B.rows[1].total, "estimate – ask for a quote"],
    ] },
  ],
};
