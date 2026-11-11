# 13 – Roadmap: from the Digital Twin to the Real Factory

This guide connects all other guides. It shows **in which order** you build the real factory, **who** does
what, **which documents** you need at each step, **how the digital twin helps** in every phase, and which
**tests** prove that the real factory works.

> All durations, quantities and limits here are examples. Your project plan, contracts and local laws decide.

---

## 1. Purpose

A factory project fails less often because of one bad machine and more often because of:
- missing or late decisions (layout, product data, capacity),
- unclear interfaces between suppliers (mechanics, signals, messages, safety),
- commissioning without a plan and without acceptance criteria,
- data (BOM, routings, cycle times) that is not ready when the IT systems go live.

This roadmap gives one common plan for the whole team. Use it together with the topic guides 01–12.

---

## 2. The phases at a glance

| Phase | Goal | Main results (deliverables) | Twin use | Guides |
|---|---|---|---|---|
| P0 Concept | Decide product mix, volume, make/buy, rough layout | Volume plan per model, process list, first layout, budget ±30 % | Capacity + bottlenecks with example data, what-if of the mix | 01, 02, 03 |
| P1 Basic engineering | Fix the technical concept | Machine list, cycle times, layout v1, material flow, automation concept, network concept, safety concept, MES/ERP scope | Replace example data with supplier data; what-if with ± uncertainty; size buffers, AGVs, AS/RS | 01–07 |
| P2 Detailed engineering | Make everything buildable / orderable | Specifications, drawings, I/O lists, interface sheets, alarm philosophy, tag list, master data, test plans | Check sequences and interlocks; virtual commissioning preparation | 05–12 |
| P3 Procurement + manufacturing | Order and make | Purchase orders, own manufacturing (APC, interfaces, AGVs, HMC parts), FAT plans | Process twins (e.g. worm) for own parts; supplier cycle times back into the twin | 08–12 |
| P4 FAT (Factory Acceptance Test) | Prove each machine at the supplier / in your workshop | Signed FAT protocols, open-point list | Compare FAT cycle times with the twin | 05, 09–12 |
| P5 Installation | Machines in place, connected | Foundations, alignment protocols, electrical + network installation, safety installation | Layout check (positions, clearances) | 03, 09–11 |
| P6 Commissioning + SAT | Machines + automation + IT work together | Loop checks, sequence tests, safety validation, interface tests, SAT protocols | Virtual commissioning; twin connected to real signals (gateway) | 05, 06, 07 |
| P7 Ramp-up | Reach target output and quality | OEE tracking, Cpk of key characteristics, problem list | Twin compares plan vs reality (live data) | 01, 04, 06 |
| P8 Operation | Stable, improving production | Maintenance plan, KPIs, change management | What-if for every change before you do it | all |

Rule: **do not start the next phase with open "red" points** from the previous phase unless the project
manager accepts the risk in writing.

---

## 3. Phase details

### P0 – Concept

1. Fix the **products**: models (VC10 / VC20 / VC30 in the twin), variants, yearly volume, peak month.
2. Write the **process list** per model: casting supply, machining, washing, honing, assembly, test, paint,
   packing (see `01`, `02`).
3. **Make or buy** for every part and every system (machines, APC, AGVs, software). The twin's HMC and AGV
   pages show what "make" really means (process plans, tests, cost per part).
4. **Rough capacity:** required output per hour = yearly volume ÷ (working days × hours per day × OEE).
   Example: 60 000 units ÷ (240 d × 16 h × 0.75) ≈ 21 units/h.
5. First **layout** and budget. Run the twin with example values to see the bottlenecks.

### P1 – Basic engineering

1. **Machine list** with supplier cycle times, changeover times, MTBF / MTTR (ask suppliers; use the twin's
   what-if with ± uncertainty if data is not certain).
2. **Material flow concept:** AS/RS, AGVs, pallet pool, buffers (guide `03`). Size them with the twin.
3. **Automation concept:** PLC per line / cell, safety PLC, field bus, E-stop zones (guide `05`).
4. **Network + communication concept:** ISA-95 levels, protocols per link, OT zones (guides `07`, `06`).
5. **IT concept:** MES and ERP scope, master data owners (guide `04`).
6. **Safety concept:** risk assessment per machine and per interface (e.g. AGV docking, light curtains at the
   APC load station with ISO 13855 safety distance).
7. Update the twin config (`config/factory.json`) with this data – the twin becomes your **planning model**.

### P2 – Detailed engineering

For every system create the documents in this table:

| Document | Content | Owner |
|---|---|---|
| Technical specification | Function, performance, accuracy, environment, standards, acceptance criteria | Project engineer |
| Layout drawing | Machine positions, foundations, media (power, air, coolant, network), escape routes | Layout planner |
| **Interface sheet** (one per hand-over) | Mechanical (heights, positions, tolerances), electrical (connectors, voltage), signals (I/O, timing diagram), messages (protocol, fields), safety (who stops what) | Both suppliers + you |
| I/O list | Every signal: tag name, address, type, range, device, cabinet, terminal | Controls engineer |
| Sequence description / step chain | Steps, transitions, timeouts, error reactions | Controls engineer |
| Alarm philosophy + alarm list | Priorities, limits, responses (ISA-18.2) | Controls + operations |
| Tag list for SCADA / historian | Names, units, scaling, logging rate | Controls + IT |
| Master data | Items, BOMs, routings, work centres, cycle times, lot sizes | Production planning |
| Test plans (FAT, SAT) | Test cases with expected results | Quality + engineering |

**Interface sheet template (use for every hand-over):**

| Item | Side A | Side B | Value / tolerance | Checked at |
|---|---|---|---|---|
| Transfer height | AGV deck | Station chains | e.g. 650 ± 2 mm | FAT + SAT |
| Position accuracy | AGV stop | Station guides catch range | e.g. ±10 mm → ±0.3 mm | SAT, 30 runs |
| Ready signal | Station PLC | AGV (E84 / VDA 5050) | signal name, timing | SAT |
| Safety | Light curtain muting | AGV presence | who mutes, max time | Safety validation |

### P3 – Procurement and own manufacturing

1. Order with the specification + interface sheets + test plan attached to the purchase order.
2. For own manufacturing (APC, interfaces, AGVs, HMC parts) follow guides `09`–`12`:
   - process plan per part, rough → stress relief → finish, one set-up for fitting features,
   - measuring plan (what, how, gauge, limit), part record for traceability,
   - first-article inspection before series.
3. Put real supplier cycle times back into the twin – check the capacity again.

### P4 – FAT

1. Test every machine **alone** at the supplier (or in your workshop for own parts) with your test parts.
2. Check: function, cycle time, accuracy (e.g. ISO 230-2 for axes), safety functions, documentation,
   spare parts list, software backup.
3. Sign the FAT protocol only with an **open-point list** that has owners and dates.

### P5 – Installation

1. Foundations and floor flatness as specified (AGV floors need tight flatness – ask the AGV supplier).
2. Set and level machines; alignment protocols (e.g. load station ↔ APC with a master pallet – guide `10`).
3. Electrical installation, cable labels = I/O list names; network installation with documented ports/VLANs.
4. Safety devices installed at the calculated distances.

### P6 – Commissioning and SAT

Work from the bottom up – never test the whole factory first:

| Step | Test | Pass when |
|---|---|---|
| 1 | Power, earthing, insulation | Measurements in limits, protocol |
| 2 | **Loop check** of every I/O | Each signal seen at the right address, right scaling |
| 3 | Drives, axes, directions, limits | Correct direction, limit switches + software limits work |
| 4 | **Safety validation** | Every safety function tested and documented (ISO 13849 / IEC 62061 by your safety engineer) |
| 5 | Single machine sequences | Automatic cycle runs, all error reactions tested |
| 6 | Interfaces between machines (AGV docking, APC, AS/RS) | Interface sheet values met; e.g. 30 docking runs without fault |
| 7 | SCADA: tags, alarms, commands, trends | Every tag has quality GOOD, alarms reach the right priority |
| 8 | MES / ERP integration | Order → work order → production → booking → shipment, end to end |
| 9 | Line run with real parts | Cycle time, quality, OEE target for the agreed time (e.g. 3 × 8 h) |
| 10 | SAT signature | Open points closed or accepted |

**Virtual commissioning with the twin:** before step 5, test PLC sequences and interlocks against the twin
(guide `05`), and connect real signals through the gateway (`tools/gateway_example.py`, guide `01`).

### P7 – Ramp-up

1. Track OEE (availability × performance × quality) per machine every shift (SCADA shift report, guide `06`).
2. Track Cpk of key characteristics (MES SPC, guide `04`; e.g. compressor air flow, worm lead). Target Cpk ≥ 1.33.
3. Daily problem-solving meeting with the top 3 losses (bad actors from SCADA alarms, scrap from MES).
4. Compare reality with the twin; correct the twin data (cycle times, MTBF) so it stays a true model.

### P8 – Operation

1. Maintenance plan from supplier data + real MTBF (MES maintenance work orders).
2. **Change management:** every change (new product, new rule, new machine) first in the twin's what-if,
   then in reality.
3. Backups of PLC, CNC, SCADA, MES configurations; versioned NC programs (guide `08`).
4. Cyber security updates and access reviews (IEC 62443 idea, guide `07`).

---

## 4. Responsibilities (example RACI)

R = responsible (does it), A = accountable (decides), C = consulted, I = informed.

| Task | Project manager | Production / process | Controls / automation | IT | Quality | Suppliers |
|---|---|---|---|---|---|---|
| Volume + product plan | A | R | I | I | C | – |
| Layout + material flow | A | R | C | I | I | C |
| Machine specification | A | R | C | I | C | C |
| Interface sheets | A | C | R | C | I | R |
| PLC / safety programs | I | C | A/R | I | I | R |
| SCADA / tags / alarms | I | C | A/R | C | I | C |
| MES / ERP + master data | A | R (data) | C | R (system) | C | C |
| Network + security | I | I | C | A/R | – | C |
| FAT / SAT | A | R | R | C | R | R |
| Own manufacturing (APC, AGV, HMC parts) | A | R | C | – | R | – |

---

## 5. Standards and rules named in the guides (for orientation)

| Topic | Standard / document | Used in guide |
|---|---|---|
| Enterprise / control integration levels | ISA-95 / IEC 62264 | 04, 07 |
| PLC programming languages | IEC 61131-3 | 05 |
| Functional safety of machinery | ISO 13849-1/-2, IEC 62061 | 05, 09–11 |
| Safety distance for protective devices | ISO 13855 | 09, 10 |
| Safety of driverless trucks (AGV) | ISO 3691-4 | 03, 11 |
| AGV ↔ fleet manager interface | VDA 5050 | 03, 07, 11 |
| Alarm management | ISA-18.2 / IEC 62682 | 06 |
| HMI design | ISA-101 | 06 |
| Industrial cyber security | IEC 62443 | 06, 07 |
| Servo drives on CANopen | CiA 402 | 11 |
| Safe torque off | IEC 61800-5-2 | 11 |
| Machine tool positioning accuracy | ISO 230-2 | 12 |
| Test conditions for machining centres | ISO 10791 series | 12 |
| Grinding burn detection by etching | ISO 14104 | 12 |
| Centre holes | DIN 332 | 12 |
| Worm gear tolerances | DIN 3974 | 12 |
| Hydraulic symbols | ISO 1219 | 09 |

Always check the **current edition** and your local legal requirements (e.g. machinery directive / local
equivalent, CE or local marking, electrical codes).

---

## 6. Data you must collect for the real factory

| Data | From | Used for |
|---|---|---|
| Cycle times, changeover times per operation and model | Machine suppliers, time studies | Twin, MES routings, capacity |
| MTBF / MTTR | Suppliers, later own MES data | Twin availability, maintenance plan |
| Scrap / rework rates | Process trials, later SPC | Twin, cost |
| BOMs, routings, lot sizes, lead times, safety stock | Engineering, purchasing | ERP MRP, kanban sizes |
| Floor plan with coordinates | Layout planner | Twin 3D, AGV routes |
| Accuracy of vehicles, machines, fixtures | Suppliers, measurements | Mechanical interfaces |
| I/O lists, PLC addresses | Controls engineers | SCADA tags, gateway to twin |
| Energy and media consumption | Suppliers | Utilities sizing |

---

## 7. Top risks and how the guides help

| Risk | Early sign | Countermeasure (guide) |
|---|---|---|
| Bottleneck not seen in planning | One machine near 100 % in the twin | What-if, extra machine or buffer (01, 02) |
| AGV docking unreliable | Stop error bigger than catch range | Coarse-to-fine catching, 30-run test (10, 11) |
| Jammed warehouse | AS/RS fill level rising every shift | Per-model rules, FG shipping logic (02, 03) |
| Alarm flood | > 6 alarms / h / operator | Alarm philosophy, deadbands, bad-actor list (06) |
| Interface misunderstanding | Different numbers in two suppliers' documents | One interface sheet signed by both (13 §3) |
| Master data late | MES / ERP test without real BOMs | Data owners + deadline in P2 (04) |
| Own precision parts out of tolerance | Cpk < 1.33 in first lot | Process plan, measuring plan, process twin (12) |
| Safety found late | Light curtain at wrong distance | ISO 13855 calculation in P2, validation in P6 (09, 10) |

---

## 8. Master checklist

**Before ordering (end of P2)**
- [ ] Volume plan per model approved
- [ ] Twin updated with supplier data; bottleneck and buffer sizes accepted
- [ ] Specification + interface sheets + test plan for every system
- [ ] I/O lists, sequence descriptions, alarm philosophy drafted
- [ ] Safety concept and risk assessments done
- [ ] Master data owners and deadlines set
- [ ] Network concept with zones approved by IT and OT

**Before FAT**
- [ ] Test parts and gauges available
- [ ] FAT test cases with expected results agreed with the supplier

**Before SAT**
- [ ] Installation and alignment protocols complete
- [ ] Loop check 100 % done
- [ ] Safety validation done and signed
- [ ] Interface tests (AGV, APC, AS/RS, MES) passed
- [ ] Operators and maintenance trained

**Before start of production**
- [ ] Line run with real parts passed (cycle time, quality, OEE)
- [ ] Cpk of key characteristics ≥ 1.33 (or action plan)
- [ ] Backups of all programs and configurations stored
- [ ] Maintenance plan and spare parts in place
- [ ] Twin connected to live data for plan-vs-actual

---

## 9. Glossary

| Term | Meaning |
|---|---|
| FAT | Factory Acceptance Test – test at the supplier before delivery |
| SAT | Site Acceptance Test – test in your factory after installation |
| Loop check | Test that each field signal arrives at the right PLC address with the right value |
| Virtual commissioning | Testing control software against a simulation (the twin) before the real machine is ready |
| Interface sheet | One document that fixes every value at a hand-over between two systems/suppliers |
| RACI | Responsible, Accountable, Consulted, Informed – who does what |
| OEE | Overall Equipment Effectiveness = availability × performance × quality |
| Cpk | Process capability index; ≥ 1.33 means the process is capable for that characteristic |
| Master data | Basic data the IT systems need: items, BOMs, routings, work centres |
| Ramp-up | The time from first production to stable target output |
