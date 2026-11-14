# User Requirement Specification (URS) - DRAFT

**Project:** Example: crankcase FMS (VC10/20/30)  
**Questionnaire date:** 2027-02-01  
**Generated:** 2026-11-14 from `questionnaire_example.json` by tools/fmse/urs_generator.py  
**Status:** draft for review - 40 of 40 questions answered, 0 open points, 0 wording findings

| Rev | Date | Author | Change |
|---|---|---|---|
| 0 | 2026-11-14 | ___ | first draft from questionnaire |

> How to use: every requirement has a stable ID, one sentence with 'shall' and a verification method.
> Review each sentence, replace vague words (see chapter 14), add numbers with units, then hand
> the URS to the suppliers. The integrator answers in the FDS (traceability CSV: FDS reference).

Verification methods: **inspection** (look / check documents), **test** (measure under defined conditions), **analysis** (calculation / simulation), **demonstration** (show the function works).

## 1. Purpose & scope

This URS describes WHAT the owner needs from the flexible manufacturing system. HOW the supplier meets it is written in the supplier's Functional Design Specification (FDS).

**URS-SCO-001** The project shall remove this main problem (pain point): Set-up times eat 25 % of machine time.  
*Source:* q40 - Biggest pain point today (one sentence)  
*Verification:* analysis - Compare baseline KPIs before the project with KPIs after ramp-up

**URS-SCO-002** Role of the author company in this project: Integrator. The scope split shall be fixed in the scope matrix.  
*Source:* q38 - Role of our company in this project  
*Verification:* inspection - Check of the signed scope matrix

**URS-SCO-003** The system shall be expandable for: +2 product families in 3 years (reserve space, modular design, open software).  
*Source:* q39 - Future: new parts expected? Expansion planned?  
*Verification:* analysis - Review of layout reserve and module concept in the FDS

## 2. Products

**URS-PRD-001** The system shall manufacture these part families / products: Crankcases VC10/20/30 (cast iron).  
*Source:* q01 - Which part families / products shall the system make?  
*Verification:* inspection - First parts checked against the drawings (CMM report)

**URS-PRD-002** The system shall handle 12 different part numbers without hardware change.  
*Source:* q02 - Number of different part numbers (variety)  
*Verification:* demonstration - Run all part numbers (or a representative set) at FAT / SAT

**URS-PRD-003** The system shall accept parts up to this size and mass: 400 × 350 × 300 mm, 28 kg.  
*Source:* q03 - Largest part: size (mm) and mass (kg)  
*Verification:* test - Run with the largest and heaviest part

**URS-PRD-004** The system shall process these materials / raw-part conditions: EN-GJL-250 castings.  
*Source:* q04 - Material(s) and raw-part condition (casting, forging, bar, sheet …)  
*Verification:* inspection - Check of process plan and test cuts on real raw parts

**URS-PRD-005** The system shall reach these tolerances and surface values: Bore Ø52 H7, flatness 0.02, Ra 0.8.  
*Source:* q05 - Tightest tolerances and surface requirements  
*Verification:* test - CMM / roughness measurement; Cpk >= 1.33 on the key features over >= 50 parts

## 3. Volumes & capacity

**URS-VOL-001** The system shall be designed for these annual volumes (now -> in 5 years): VC20: 4 000 → 9 000 / year.  
*Source:* q06 - Annual volume per part number now and in 5 years  
*Verification:* analysis - Capacity calculation + simulation with >= 15 % reserve

**URS-VOL-002** The system shall run economically with these lot / order sizes and frequencies: 20–60 per order, weekly.  
*Source:* q07 - Typical lot / order size and order frequency  
*Verification:* demonstration - Mixed-lot run at FAT with the agreed lot sizes

**URS-VOL-003** The system shall support a delivery lead time of ≤ 5 working days.  
*Source:* q08 - Required delivery lead time  
*Verification:* analysis - Simulation of order flow (lead time, WIP) in the twin

**URS-VOL-004** The system shall be designed for this working time: 2 shifts + 1 unmanned, 240 days.  
*Source:* q09 - Working time: shifts / day, days / year, unmanned hours wanted  
*Verification:* demonstration - Unmanned shift run at SAT without operator action

## 4. Process

**URS-PRC-001** The system shall perform these process steps (routing, estimated times): OP10 rough 8 min, OP20 finish 6 min, wash 2 min.  
*Source:* q10 - Process steps per part (routing) with estimated times  
*Verification:* test - Time study of each operation at FAT

**URS-PRC-002** The process domain of the system is: Machining (prismatic).  
*Source:* q11 - Process domain  
*Verification:* inspection - Check of the concept / FDS

**URS-PRC-003** Changeover situation today (baseline): 90 min, 12 per week. The supplier shall state the guaranteed changeover time in the offer.  
*Source:* q12 - Set-up / changeover today (min) and number per week  
*Verification:* test - Timed changeover at FAT / SAT

**URS-PRC-004** The fixture concept shall be: Dedicated tombstones per model.  
*Source:* q13 - Fixtures: dedicated, modular, zero-point system?  
*Verification:* inspection - Design review of fixtures / pallets

**URS-PRC-005** The tool concept shall cover: 120 tools, 30 sister tools.  
*Source:* q14 - Tools: number of different tools, tool life, central tool store wanted?  
*Verification:* analysis - Tool pocket calculation for all parts + unmanned shifts in the FDS

## 5. Quality & traceability

**URS-QUA-001** Inspection shall be done as follows: CMM first part + 1 in 10.  
*Source:* q15 - Inspection: what, where, how often (100 %, sampling, in-process)?  
*Verification:* demonstration - Run of the inspection sequence incl. NOK handling at FAT

**URS-QUA-002** Traceability level: Serial + process data.  
*Source:* q16 - Traceability level: lot, serial, data per serial?  
*Verification:* test - Trace a test part from raw part to finished part in the data

**URS-QUA-003** The system and its documentation shall support these standards: ISO 9001.  
*Source:* q17 - Customer / sector standards (IATF 16949, ISO 9001, AS9100, medical …)  
*Verification:* inspection - Check of documentation against the standard

## 6. Existing technology & interfaces

**URS-TEC-001** These existing machines shall be integrated: 2 × HMC Fanuc 31i, 2015, Ethernet.  
*Source:* q18 - Existing machines to integrate (brand, control, age, interface)  
*Verification:* test - Interface test of each existing machine (signals + data block)

**URS-TEC-002** Only these company standard brands shall be used: Siemens S7-1500, Fanuc robots.  
*Source:* q19 - Company standard PLC / robot / CNC brands  
*Verification:* inspection - Check of parts lists and circuit diagrams

**URS-TEC-003** Only these networks and protocols shall be used: Ethernet + Modbus TCP + HTTP only.  
*Source:* q20 - Allowed networks and protocols  
*Verification:* test - Network scan + read / write test of all interfaces

**URS-TEC-004** The system shall connect to this existing software: ERP: Odoo; no MES.  
*Source:* q21 - Existing ERP / MES / software  
*Verification:* test - Message test with the test system of the ERP / MES

## 7. Logistics

**URS-LOG-001** Material flow in and out: Euro pallets by forklift.  
*Source:* q22 - How do raw parts arrive and finished parts leave (pallet, box, crane, AGV)?  
*Verification:* demonstration - Delivery and pick-up of real loads on site

**URS-LOG-002** Storage capacity shall be at least: 40 raw, 20 WIP pallets.  
*Source:* q23 - Storage needed: raw, WIP, finished (places / pallets)  
*Verification:* inspection - Count of storage places in the layout / on site

**URS-LOG-003** Internal transport: Forklift → AGV wanted.  
*Source:* q24 - Internal transport today and wanted (forklift, AGV/AMR, conveyor, RGV)  
*Verification:* demonstration - Transport run with the chosen system

## 8. Site & utilities

**URS-SIT-001** The layout shall fit into: 40 × 18 m, 8 m, 10 t crane.  
*Source:* q25 - Available floor area (m × m), height, crane  
*Verification:* inspection - Layout drawing check incl. service areas

**URS-SIT-002** Existing floor: 200 mm concrete, ±5 mm / 2 m. The supplier shall state any extra foundation requirement.  
*Source:* q26 - Floor / foundation (thickness, flatness)  
*Verification:* analysis - Foundation / floor check by the supplier (drawing + load calculation)

**URS-SIT-003** The system shall run with these utilities: 400 V 50 Hz, 400 kVA, 7 bar.  
*Source:* q27 - Power supply (V, Hz, kVA available), compressed air, cooling water  
*Verification:* test - Measurement of power, air and water consumption at SAT

**URS-SIT-004** The system shall keep accuracy and function in this climate: 15–35 °C, no air-con.  
*Source:* q28 - Climate: temperature range, dust, humidity  
*Verification:* analysis - Thermal / cabinet cooling calculation, IP class check

## 9. People & training

**URS-PPL-001** The system shall be operable by: 2 operators, CNC basic, local language; HMI language and training shall match.  
*Source:* q29 - Operators per shift, skill level, languages  
*Verification:* demonstration - Operators run the system after training (signed training records)

**URS-PPL-002** In-house skills: 1 electrician, no PLC programmer. The supplier shall provide training / service to cover the gaps.  
*Source:* q30 - Maintenance and programming skills in house  
*Verification:* inspection - Check of training plan and service contract

## 10. Safety & legal

**URS-SAF-001** The system shall comply with: EU – Machinery Regulation (EU) 2023/1230.  
*Source:* q31 - Country / legal framework (e.g. EU Machinery Regulation, local law)  
*Verification:* inspection - Risk assessment, PL verification, declaration of conformity

**URS-SAF-002** The safety concept shall cover these special risks: Parts 28 kg → no manual lifting.  
*Source:* q32 - Special risks (heavy parts, hot, explosive dust, robots with people)  
*Verification:* analysis - Risk assessment (ISO 12100) reviewed at 30 / 60 / 90 %

## 11. IT/OT & data

**URS-ITO-001** The system shall follow these IT security rules: No internet on shop floor; VPN by IT only.  
*Source:* q33 - IT security rules: internet allowed? remote access? network owner?  
*Verification:* test - Security check by IT (zones, conduits, remote access)

**URS-ITO-002** The system shall record and keep this data: OEE + alarms + energy, 2 years.  
*Source:* q34 - Data wanted: OEE, energy, tool life, quality, alarms, history period  
*Verification:* demonstration - Show data in the historian / MES for the agreed period

## 12. Commercial & schedule

**URS-COM-001** Budget range and payback target: 2.5–3.2 M€, payback ≤ 7 years.  
*Source:* q35 - Budget range and payback target  
*Verification:* analysis - Business case (NPV, IRR, payback)

**URS-COM-002** The project shall meet these target dates: Order 03/2027, full output 09/2028.  
*Source:* q36 - Target dates (order, FAT, SAT, full output)  
*Verification:* inspection - Master schedule (CPM) and milestone reports

## 13. Acceptance criteria

**URS-ACC-001** The supplier shall guarantee these KPIs: ≥ 14 parts/h, availability ≥ 95 %.  
*Source:* q37 - Guaranteed KPIs wanted (output, OEE, availability, scrap)  
*Verification:* test - Capacity run at FAT and availability run at SAT; A = (T_run - T_owner - T_supplier) / (T_run - T_owner)

Proposed standard acceptance tests (adapt and confirm):

- FAT: functions, sequences, fault reactions, E-stop, capacity run (e.g. 8 h) with real parts.
- SAT: availability run (e.g. 72 h); A = (T_run - T_owner - T_supplier) / (T_run - T_owner) >= agreed target; stops caused by the owner are removed from the base.
- Cycle time: mean of >= 10 measured cycles <= guaranteed cycle time.
- Quality: Cpk = min(USL - mean, mean - LSL) / (3 s) >= 1.33 on key features over >= 50 parts.
- Interfaces: read / write test of the standard data block words 0-19 of every module.

## 14. Open points

### 14.1 Open points (TBD)

No open points - all 40 questions are answered.

### 14.2 Wording findings (vagueness checker)

No vague words found and all numeric answers contain numbers.

---
*Draft generated offline. All requirements must be reviewed by the owner before release.*
