# 16 – Standards Register

> **This register is a guide, not legal advice.** Standards are updated every few years. Every entry marked
> **"verify current edition"** must be checked before use, and **all entries** must be checked against the
> current catalogue of ISO / IEC / your national standards body before you design to them.
> Key values given here are the well-known ones, shortened – **always read the standard itself** before you
> design, calculate or accept a machine.

---

## 1. Purpose

The guides 00–15 name many standards. This register collects all of them in one place and adds the
important ones that are missing for a compressor factory. For each standard you find:

* **what it covers** (in one line),
* **what it means for this project** (key values, typical clauses),
* **which guide uses it**,
* **where to get it**.

At the end: **which standards a small team should buy first** and **how to keep them current**.

---

## 2. Laws and standards – important note for the reader

| Level | What it is | Example | Binding? |
|---|---|---|---|
| **Law / regulation** | written by the state | EU: Machinery Directive 2006/42/EC, replaced by the **Machinery Regulation (EU) 2023/1230** (applies from 20 Jan 2027); Low Voltage and EMC Directives; national pressure-equipment and workplace-safety laws; outside the EU: the local equivalent (e.g. national machinery safety rules, OSHA rules in the USA) | **yes** |
| **Harmonised / designated standard** | a standard that the law refers to; if you follow it, the law assumes you meet the matching requirement ("presumption of conformity") | EN ISO 12100, EN ISO 13849-1, EN 60204-1 under EU machinery law | normally voluntary, but the easiest way to prove compliance |
| **Other standard** | technical rule (ISO, IEC, DIN, VDA …) | ISO 286, DIN 3974, VDA 5050 | voluntary, unless a contract or law requires it |
| **Contract / customer requirement** | what you agree with a customer or supplier | "test according to ISO 1217 Annex C", "labels GS1-128" | binding by contract |

**Laws differ by country.** This guide stays generic:

* Where the EU uses CE marking and the Machinery Regulation, your country may have its own conformity
  procedure, mark and list of designated standards. Find out **which law applies to machines you build or
  buy for your own factory** – in many countries a company that builds a machine for its own use is the
  "manufacturer" and must do the full conformity work (risk assessment, technical file, declaration).
* The **compressor product** (with its air tank) is a pressure-equipment product. **Check your local
  pressure-equipment law** before you design or sell it.
* Standards prefixed **EN** or **EN ISO** are European versions; the **ISO/IEC** version is usually the same
  technical text. National versions (e.g. DIN EN ISO, BS EN ISO) are again the same text with a national cover.

---

## 3. Where to get standards

| Publisher | Standards | Where (offline: download PDF and store in the document system) |
|---|---|---|
| ISO | ISO … | ISO Store (iso.org) or your national member body |
| IEC | IEC … | IEC Webstore (webstore.iec.ch) or national body |
| CEN / CENELEC | EN … | only through national bodies (e.g. DIN Media, BSI, AFNOR, UNI, …) |
| National bodies | DIN, BS, ANSI, BIS, SAC, … and national versions of ISO/IEC | national web shops |
| ISA | ISA-18.2, ISA-95, ISA-101 | isa.org (members get discounts) |
| VDA | VDA 5050 | **free**, published openly by VDA/VDMA (GitHub repository "VDA5050") |
| OPC Foundation | OPC UA specifications (= IEC 62541 content) | **free** online reference (reference.opcfoundation.org) after registration |
| OASIS | MQTT 3.1.1 / 5.0 | **free** (oasis-open.org) |
| CAN in Automation (CiA) | CiA 301, CiA 402 | can-cia.org (some free after registration, verify) |
| IEEE | IEEE 1588 | IEEE Xplore / IEEE standards store |
| FEM | FEM 9.851 | FEM (fem-eur.com) or national FEM member association |
| GS1 | GS1 General Specifications, EPC Tag Data Standard | **free** (gs1.org) |
| IATF / AIAG / VDA QMC | IATF 16949, AIAG-VDA FMEA, MSA, SPC manuals | AIAG, VDA QMC shops |

Tip: the **ISO Online Browsing Platform (OBP)** and the IEC Webstore show **free** the title, scope, current
edition and whether a standard is withdrawn – use them to check editions.

---

## 4. The register

Column "Guide" = number of the guide in this folder that uses the standard. "new" = not yet named in the
guides, added here because it is important for this factory.

### 4.1 Management and quality

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 9001 | Quality management systems – Requirements | QMS: processes, documented information, control of changes, suppliers, nonconformity, improvement | document control (guide 15 numbering, ECR/ECN), supplier evaluation, NCR process (guide 04), calibration of measuring equipment, management review. Edition 2015 + Amd 1:2024; **a new edition is expected – verify current edition** | new (04, 13, 15) | ISO / national |
| IATF 16949 | Quality management system requirements for automotive production and relevant service parts organizations | ISO 9001 + automotive extras (APQP, PPAP, control plans, MSA, SPC) | **only if you supply the automotive industry.** For air compressors normally not required – but its "core tools" (FMEA, control plan, MSA, SPC) are good practice for machining | new | IATF / AIAG / VDA QMC |
| ISO 14001 | Environmental management systems – Requirements with guidance for use | environmental aspects, legal compliance | coolant, oils, paint shop solvents (VOC), chips, waste water from the washer | new | ISO / national |
| ISO 45001 | Occupational health and safety management systems – Requirements with guidance for use | OH&S management | risk assessment of workplaces (not machines – that is ISO 12100), training, incident reporting, AGV traffic in shared areas | new | ISO / national |
| ISO 50001 | Energy management systems – Requirements with guidance for use | energy baseline, energy performance indicators | the twin already measures kW per machine (guide 01) → energy per compressor (kWh/unit) as EnPI; compressed-air leaks; test-bench energy | new (01) | ISO / national |
| ISO/IEC 17025 | General requirements for the competence of testing and calibration laboratories | accredited calibration | buy calibration of gauges, flow meters, pressure transducers of the test bench from an accredited lab (calibration certificate with uncertainty) | new | ISO / national |
| ISO 22514 (series) | Statistical methods in process management – Capability and performance | Cp, Cpk, Pp, Ppk calculation | machine/process capability of critical bores (cylinder bore, crankshaft journals), typical target Cpk ≥ 1.33 (customer may require 1.67) – verify parts | new (04 SPC) | ISO / national |
| AIAG-VDA FMEA Handbook | (handbook, not ISO) | design and process FMEA method | PFMEA for crankcase machining and assembly; action priority (AP) instead of RPN | new | AIAG / VDA QMC |

### 4.2 Machinery safety

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 12100 | Safety of machinery – General principles for design – Risk assessment and risk reduction | method of risk assessment | for every machine you build or modify (APC, AGVs, rotary table, test bench, interfaces): limits → hazards → risk estimation → **3-step risk reduction** (1 inherently safe design, 2 safeguards, 3 information for use). Record in `VC-<area>-RA-…` | 05, new for 09–12 | ISO / national (EN ISO) |
| ISO 13849-1 | Safety of machinery – Safety-related parts of control systems – Part 1: General principles for design | design of safety functions, **Performance Level PL a–e**, categories B, 1, 2, 3, 4, MTTFD, DCavg, CCF | determine PLr per safety function (risk graph: S, F, P); typical results: E-stop, guard interlock, light curtain at APC load station **PLr d** (example – your risk assessment decides). Edition 2023 – verify current edition | 03, 05, 09, 10, 11, 13 | ISO / national |
| ISO 13849-2 | Safety of machinery – Safety-related parts of control systems – Part 2: Validation | validation of safety functions | validation plan + test of every safety function at SAT (fault insertion, e.g. remove a channel of a door switch) | 05, 13 | ISO / national |
| IEC 62061 | Safety of machinery – Functional safety of safety-related control systems | alternative to ISO 13849-1, uses **SIL 1–3** | use **either** ISO 13849-1 **or** IEC 62061 per safety function; small teams usually use ISO 13849-1 + SISTEMA-type tool. Edition 2021 – verify | 05, 13 | IEC / national |
| ISO 13850 | Safety of machinery – Emergency stop function – Principles for design | E-stop | E-stop is a **complementary** measure (not a replacement for guards); stop category **0 or 1**; red actuator on yellow background; latching; reset must not start the machine | 05 | ISO / national |
| IEC 60947-5-5 | Low-voltage switchgear and controlgear – Part 5-5: Control circuit devices and switching elements – Electrical emergency stop device with mechanical latching function | E-stop push-buttons | buy E-stop buttons that conform (direct opening action, latching) | 11 | IEC / national |
| ISO 13855 | Safety of machinery – Positioning of safeguards with respect to the approach of the human body | **safety distance** of light curtains, scanners, two-hand controls, interlocked guards | basic formula **S = K · T + C**; for light curtains detecting fingers/hands: K = 2 000 mm/s (if S ≤ 500 mm), otherwise K = 1 600 mm/s with S ≥ 500 mm; C = 8 · (d − 14) mm for resolution d ≤ 40 mm. T = machine stopping time + sensor response time (measure the stopping time!). **New edition 2024 changed parts of the method – verify current edition** | 00, 03, 05, 09, 10, 13 | ISO / national |
| ISO 13857 | Safety of machinery – Safety distances to prevent hazard zones being reached by upper and lower limbs | reach over / through / around guards | mesh size vs. distance to the hazard (tables); fence height around APC, AS/RS and robot cell | 03, 10 | ISO / national |
| ISO 13854 | Safety of machinery – Minimum gaps to avoid crushing of parts of the human body | minimum gaps | well-known values: body 500 mm, head 300, leg 180, foot 120, arm 120, hand 100, finger 25 mm – e.g. AGV lift unit, APC arm vs. frame. Planned to be merged into a revision of ISO 13857 – verify | 11 | ISO / national |
| ISO 14119 | Safety of machinery – Interlocking devices associated with guards – Principles for design and selection | door switches, guard locking, defeat prevention | coded switches (low / high coding), **measures against defeating**; guard locking if the hazard does not stop before access (spindle run-down, APC rotation). Edition 2024 – verify | 05, 09, 10 | ISO / national |
| ISO 14120 | Safety of machinery – Guards – General requirements for the design and construction of fixed and movable guards | guards | fixed guards must need a **tool** to open and the fixings should stay attached (captive); strength vs. ejected parts (machine-tool guards) | 09, 10 | ISO / national |
| IEC 61496-1 / -2 / -3 | Safety of machinery – Electro-sensitive protective equipment – Part 1 General requirements and tests; Part 2 AOPD (light curtains); Part 3 AOPDDR (laser scanners) | light curtains, safety laser scanners | buy only ESPE of **Type 4** (light curtains, PL e capable) or **Type 3** (scanners, PL d) according to the PLr; scanner on AGV and at AGV stations | 03 | IEC / national |
| IEC 62046 | Safety of machinery – Application of protective equipment to detect the presence of persons | how to apply ESPE / pressure mats | muting of light curtains at AGV/pallet passages (guide 10); detection zone, restart | 05, 10 | IEC / national |
| IEC 60204-1 | Safety of machinery – Electrical equipment of machines – Part 1: General requirements | electrical equipment of machines | main switch (lockable), protective bonding, control circuits (24 V DC), stop categories 0/1/2, wire colours (3.12 of guide 15), documentation, verification tests (continuity of PE, insulation resistance, voltage test, residual voltage). Edition 2016 + A1:2021 – verify | 05, 15 | IEC / national |
| ISO 16090-1 | Machine tools safety – Machining centres, milling machines, transfer machines – Part 1: Safety requirements | type-C standard for machining centres | for the HMCs, VMC and when you modify them (own rotary table, APC): guards, spindle speeds in setting mode, enabling device, door interlocking | 09 | ISO / national |
| ISO 23125 | Machine tools – Safety – Turning machines | type-C standard for lathes | LATHE-01: guards, chuck guard, setting mode | new | ISO / national |
| ISO 10218-1 / -2 | Robotics – Safety requirements – Part 1: Industrial robots; Part 2: Industrial robot applications and robot cells | robot safety | ROBOT-01 cell: safeguarding, collaborative operation if planned. **New editions 2025 – verify** | new | ISO / national |
| ISO 3864-1 / ISO 7010 | Graphical symbols – Safety colours and safety signs / Registered safety signs | safety colours and signs | warning signs on AGV routes, APC, hydraulics, pressure vessels | 10 | ISO / national |
| IEC 60848 | GRAFCET specification language for sequential function charts | step-chain drawings | APC and handshake sequences (guide 05) | 05 | IEC / national |

### 4.3 Electrical

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| IEC 61439-1 / -2 | Low-voltage switchgear and controlgear assemblies – Part 1: General rules; Part 2: Power switchgear and controlgear assemblies | control cabinets | cabinet builder must do **design verification** (incl. temperature rise – heat calculation for drives) and **routine verification** of every cabinet; rated current and short-circuit rating on the nameplate | new (05) | IEC / national |
| IEC 60529 | Degrees of protection provided by enclosures (IP Code) | IP code | cabinet in the hall typically **IP54**; sensors near coolant **IP67** (IP69K for high-pressure washing); test bench outdoors? check | new | IEC / national |
| IEC 61800-5-2 | Adjustable speed electrical power drive systems – Part 5-2: Safety requirements – Functional | safety functions in drives | **STO** (safe torque off), SS1, SS2, SOS, SLS, SBC – AGV drives and APC servo use STO / SLS; choose drives with certified functions (SIL/PL in data sheet) | 11, 13 | IEC / national |
| IEC 81346-1 / -2 | Industrial systems, installations and equipment and industrial products – Structuring principles and reference designations – Part 1: Basic rules; Part 2: Classification of objects and codes for classes | reference designations `=` `+` `-`, letter codes | device designations in guide 15 (3.12); **letter codes changed between editions – verify current edition of Part 2** | 15 | IEC / national |
| IEC 61082-1 | Preparation of documents used in electrotechnology – Part 1: Rules | schematics layout | supplier schematics | new | IEC / national |
| IEC 60617 | Graphical symbols for diagrams | electrical symbols | schematics (database standard) | new | IEC |
| IEC 60445 | Basic and safety principles for man-machine interface, marking and identification – Identification of equipment terminals, conductor terminations and conductors | conductor and terminal identification, colours | PE green-yellow, N light blue | new | IEC / national |
| IEC 61000-6-2 / -6-4 | Electromagnetic compatibility (EMC) – Generic standards – Immunity / Emission standard for industrial environments | EMC | drives with filters, shielded motor cables, EMC-correct cabinet layout; AGV Wi-Fi vs. drives | new | IEC / national |
| IEC 60364 (series) | Low-voltage electrical installations | building installation | hall power distribution to the machines (or your national wiring code – **check local law**) | new | IEC / national |
| IEC 60034-30-1 | Rotating electrical machines – Part 30-1: Efficiency classes of line operated AC motors (IE code) | motor efficiency classes | compressor motors and factory motors: minimum IE class is often set by law (e.g. IE3) – **check local law** | new | IEC / national |
| IEC 61131-9 | Programmable controllers – Part 9: Single-drop digital communication interface for small sensors and actuators (SDCI) | **IO-Link** | vibration and pressure sensors on IO-Link (guide 05/06) | 05 | IEC / national |

### 4.4 Automation and IT

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| IEC 61131-3 | Programmable controllers – Part 3: Programming languages | PLC languages: ST, LD, FBD, SFC (IL removed in ed. 3) | write PLC code in ST/SFC, structured with function blocks; naming per guide 15. **New edition published 2025 – verify** | 05, 13 | IEC / national |
| ISA-95 / IEC 62264 | Enterprise-control system integration (Parts 1–6) | levels 0–4, object models (orders, material, equipment, personnel), MES activities | ERP ↔ MES interface objects (guide 04, 07); B2MML messages are the XML implementation (MESA) | 00, 02, 04, 05, 07, 13 | ISA / IEC |
| IEC 62541 | OPC Unified Architecture (series) | OPC UA: information model, services, security | PLC ↔ MES/SCADA, machine interface; use security mode Sign&Encrypt, certificates; companion specs (e.g. OPC 40501 machine tools / umati – verify) | 04, 07 | IEC; free reading at OPC Foundation |
| ISO/IEC 20922 | Information technology – Message Queuing Telemetry Transport (MQTT) v3.1.1 | MQTT 3.1.1 | broker in L3, AGV VDA 5050 messages; **MQTT 5.0 is an OASIS standard only** (not ISO) | 07 | ISO; free text at OASIS |
| IEC 62443 (series) | Security for industrial automation and control systems | OT security: zones and conduits, security levels SL 1–4; 2-1 security programme, 3-2 risk assessment, 3-3 system requirements, 4-1 secure development, 4-2 component requirements | zone/VLAN plan (guide 07, guide 15 3.13), firewall between IT/DMZ/OT, user accounts per person, patch management, remote access via jump host; ask suppliers for 4-2 / 4-1 conformity | 05, 06, 07, 13 | IEC / ISA |
| ISO/IEC 27001 | Information security, cybersecurity and privacy protection – Information security management systems – Requirements | IT security management | office IT, ERP, backups – company level, complements IEC 62443 | new | ISO / national |
| ISA-18.2 / IEC 62682 | Management of alarm systems for the process industries | alarm life cycle | alarm philosophy, rationalisation, priorities (~80/15/5 %), ≈ 6 alarms/h per operator target, shelving, bad-actor review (guide 06); alarm IDs per guide 15 | 00, 06, 07, 13 | ISA / IEC |
| ISA-101.01 | Human Machine Interfaces for Process Automation Systems | HMI design life cycle, high-performance HMI | grey background, colour only for abnormal states, display hierarchy (guide 06) | 06, 13 | ISA |
| VDA 5050 | Interface for the communication between automated guided vehicles (AGV) and a master control | AGV ↔ fleet manager over MQTT/JSON: topics `order`, `instantActions`, `state`, `visualization`, `connection`, `factsheet` | specify for every AGV bought or built; version **2.x – verify current version** (a 3.0 is in preparation / published) | 00, 03, 04, 05, 06, 07, 10, 11, 13 | free (VDA / GitHub) |
| CiA 301 | CANopen application layer and communication profile | CANopen: object dictionary, PDO/SDO, NMT, heartbeat | AGV drive bus (guide 11) | new (11) | CiA |
| CiA 402 | CANopen device profile for drives and motion control (also IEC 61800-7-201) | drive state machine, controlword 0x6040, statusword 0x6041, modes of operation 0x6060 (profile position, velocity, homing, cyclic sync.) | AGV and APC servo drives; same profile on EtherCAT (CoE) | 05, 11, 13 | CiA / IEC |
| IEC 61158 / IEC 61784 | Industrial communication networks – Fieldbus specifications / Profiles | PROFINET, EtherCAT, etc. | PROFINET between PLC, I/O, drives; PROFIsafe for safety I/O | new | IEC |
| IEEE 1588 | IEEE Standard for a Precision Clock Synchronization Protocol for Networked Measurement and Control Systems (PTP) | µs time synchronisation | only where needed (motion, high-speed data); otherwise NTP. Edition 2019 – verify | 07 | IEEE |
| ISO 8601-1 | Date and time – Representations for information interchange – Part 1: Basic rules | date/time formats | all data: `2026-11-11T07:30:00Z`, ISO week (guide 15) | 07, 15 | ISO / national |
| ISO 20022 | Financial services – Universal financial industry message scheme | bank messages | ERP payments (guide 07) – only if your bank uses it | 07 | ISO (free message catalogue) |
| ANSI X12 / UN/EDIFACT | (EDI message standards) | EDI orders, delivery notes | customer/supplier EDI (guide 07); agree the message set per partner | 07 | ASC X12 / UNECE (free) |
| ISO/IEC 15693 / ISO/IEC 18000-63 | Identification cards – Contactless vicinity cards / Radio frequency identification for item management – Part 63: UHF Type C (EPC Gen2) | HF and UHF RFID air interfaces | HF tags in fixture pallets and tool holders, UHF for crates (guide 15 3.16) | 07, 15 | ISO / national |
| ISO 13399 (series) | Cutting tool data representation and exchange | tool data model | tool data between presetter, CAM and CNC (guide 15 tool numbers) – verify tool supplier support | new | ISO |

### 4.5 Material handling (AGV, AS/RS, conveyors, racks)

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 3691-4 | Industrial trucks – Safety requirements and verification – Part 4: Driverless industrial trucks and their systems | AGV / AMR safety, **including the system and the operating zones** | personnel detection (scanner fields switching with speed), braking, warning signals, zones (restricted / hazard / confined zones), load handling at stations, verification. Edition 2023 – verify. USA: ANSI/ITSDF B56.5 | 00, 03, 10, 11, 13 | ISO / national |
| EN 528 | Rail dependent storage and retrieval equipment – Safety requirements for S/R machines | stacker cranes | ASRS-RAW / ASRS-FG: access protection of the aisle, maintenance platforms, overspeed / end stops, rescue of persons. Verify current edition | 03, 10 | national body (CEN) |
| EN 619 | Continuous handling equipment and systems – Safety and EMC requirements for equipment for mechanical handling of unit loads | conveyors for unit loads, transfer stations | AS/RS I/O conveyors, AGV transfer stations, pallet pool shuttle | 03, 10 | national body |
| EN 15512 | Steel static storage systems – Adjustable pallet racking systems – Principles for structural design | rack design | rack supplier calculates; you give loads (unit load mass, e.g. 4 crankcases + pallet), seismic zone, floor | 03, 10 | national body |
| EN 15620 | Steel static storage systems – Adjustable pallet racking – Tolerances, deformations and clearances | rack tolerances | especially for automated (AS/RS) racks: tighter tolerance classes; floor flatness requirement → specify to the building contractor | 03, 10 | national body |
| EN 15635 | Steel static storage systems – Application and maintenance of storage equipment | use and inspection | named "person responsible for storage equipment safety", rack inspection at least **every 12 months by a competent person**, damage classes green / amber / red, load signs | 03, 10 | national body |
| FEM 9.851 | Performance data of S/R machines – Cycle times (title as commonly used – verify) | reference cycle for AS/RS throughput | single cycle reference points at about (1/5 L, 2/3 H) and (2/3 L, 1/5 H); used to compare supplier cycle time claims with the twin's `crane_cycle_s` | 03 | FEM / national FEM member |
| EN 13698-1 | Pallet production specification – Part 1: Construction specification for 800 mm × 1200 mm flat wooden pallets | EUR pallet | finished goods pallets, AS/RS-FG unit load | new | national body |

### 4.6 Mechanical design and manufacturing

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 286-1 / -2 | Geometrical product specifications (GPS) – ISO code system for tolerances on linear sizes – Part 1: Basis of tolerances, deviations and fits; Part 2: Tables of standard tolerance classes and limit deviations for holes and shafts | fits (H7/g6 …) | example Ø50: IT7 = 25 µm, IT6 = 16 µm → **H7 = +0 / +25 µm, g6 = −9 / −25 µm**; centring fits of APC hub, bearing seats | 00, 09, 12 | ISO / national |
| ISO 1101 | Geometrical product specifications (GPS) – Geometrical tolerancing – Tolerances of form, orientation, location and run-out | GD&T symbols | flatness of pallets (≤ 0.01 mm), position of locating bores, run-out of worm journals | 09, 10, 12 | ISO / national |
| ISO 2768-1 / -2 | General tolerances – Part 1: Tolerances for linear and angular dimensions without individual tolerance indications; Part 2: Geometrical tolerances for features without individual tolerance indications | general tolerances | class **m** for linear sizes: 6–30 mm ±0.2, 30–120 mm ±0.3, 120–400 mm ±0.5; title block e.g. "ISO 2768-mK". **Part 2 may be withdrawn / replaced by ISO 22081 – verify** | 15 (title block) | ISO / national |
| ISO 21920 (series) | Geometrical product specifications (GPS) – Surface texture: Profile | surface roughness indication (replaces ISO 1302, ISO 4287) | Ra/Rz on drawings; verify which version your CAD and suppliers use | new | ISO / national |
| ISO 128 / ISO 7200 | Technical product documentation – General principles of representation / Data fields in title blocks and document headers | drawing rules, title block | title block fields (guide 15 3.2) | new (15) | ISO / national |
| ISO 5817 | Welding – Fusion-welded joints in steel, nickel, titanium and their alloys (beam welding excluded) – Quality levels for imperfections | weld quality levels **B (stringent), C (intermediate), D (moderate)** | APC arm, AGV chassis, base frames: typically level **C**, level B for highly loaded / fatigue welds (engineering decision). Verify current edition | new (09, 11) | ISO / national |
| ISO 13920 | Welding – General tolerances for welded constructions – Dimensions for lengths and angles – Shape and position | weld construction tolerances, classes A–D (lengths/angles) and E–H (straightness, flatness, parallelism) | frames before machining: e.g. **B F** (example); machine critical faces after welding + stress relief. Verify current edition | new (09, 10) | ISO / national |
| ISO 3834 (series) | Quality requirements for fusion welding of metallic materials | welding quality system: Part 2 comprehensive, Part 3 standard, Part 4 elementary | ask welding suppliers for ISO 3834-3 (or -2); welders qualified (ISO 9606-1), welding procedures (ISO 15614-1) | new | ISO / national |
| ISO 2553 | Welding and allied processes – Symbolic representation on drawings – Welded joints | weld symbols | all welded drawings | new | ISO / national |
| ISO 4762 | Hexagon socket head cap screws | cap screws dimensions | standard screws in all MAKE designs, BUY description per guide 15 | new | ISO / national |
| ISO 898-1 | Mechanical properties of fasteners made of carbon steel and alloy steel – Part 1: Bolts, screws and studs with specified property classes – Coarse thread and fine pitch thread | property classes | **8.8:** Rm ≥ 800 N/mm², Rp0.2 ≥ 640 (d ≤ 16 mm; 830/660 above 16 mm); **10.9:** 1 040 / 940; **12.9:** 1 220 / 1 100 | new (09, 12) | ISO / national |
| ISO 8734 | Parallel pins, of hardened steel and martensitic stainless steel (Dowel pins) | dowel pins | pinning of APC hub, lifting ledges; pin tolerance m6, hole H7 (or as designed) | new (09) | ISO / national |
| ISO 1219-1 / -2 | Fluid power systems and components – Graphical symbols and circuit diagrams – Part 1: Graphical symbols…; Part 2: Circuit diagrams | hydraulic/pneumatic symbols, diagrams | APC hydraulic circuit (`VC-HYD-CIR-…`), component designations matching the electrical schematic | 09, 13 | ISO / national |
| ISO 4413 | Hydraulic fluid power – General rules and safety requirements for systems and their components | hydraulic safety | pressure relief valve on every pump, accumulator discharge on shutdown, hoses with restraint, clamping holds pressure on power loss (check valve + pressure switch) | new (09) | ISO / national |
| ISO 4414 | Pneumatic fluid power – General rules and safety requirements for systems and their components | pneumatic safety | exhaust (dump) valve to release stored energy, lockable shut-off, soft start | new | ISO / national |
| ISO 4406 | Hydraulic fluid power – Fluids – Method for coding the level of contamination by solid particles | oil cleanliness code `x/y/z` (particles ≥ 4 / ≥ 6 / ≥ 14 µm(c) per mL) | specify cleanliness at commissioning and in maintenance, e.g. **18/16/13** for standard valves, cleaner (e.g. 17/15/12 or better) for proportional/servo valves – **follow the valve manufacturer** | new (09) | ISO / national |
| ISO 8573-1 | Compressed air – Part 1: Contaminants and purity classes | air quality classes **[particles : water : oil]** | factory air for tools and pneumatics e.g. class **[2:4:2]** (example); water class 4 = pressure dew point ≤ +3 °C, class 2 = ≤ −40 °C; oil class 1 ≤ 0.01 mg/m³, class 2 ≤ 0.1 mg/m³. Also relevant for your product datasheet | new | ISO / national |
| ISO 12944 (series) | Paints and varnishes – Corrosion protection of steel structures by protective paint systems | corrosivity categories **C1–C5, CX**; durability L / M / H / VH | factory steel structures: indoor heated hall ≈ C1–C2; compressor tank / outdoor products: specify category with sales (e.g. C3 durability M – example); paint shop process | new | ISO / national |
| ISO 281 | Rolling bearings – Dynamic load ratings and rating life | bearing life | L10 = (C/P)^p million revolutions, p = 3 ball, 10/3 roller – APC slewing bearing, AGV wheels, compressor crankshaft bearings | new | ISO / national |
| ISO 21940-11 | Mechanical vibration – Rotor balancing – Part 11: Procedures and tolerances for rotors with rigid behaviour | balance quality grades G | crankshaft / flywheel / fan of the compressor, spindles (e.g. G6.3, G2.5 – example) | new | ISO / national |
| ISO 20816-3 | Mechanical vibration – Measurement and evaluation of machine vibration – Part 3: Industrial machinery with a power rating above 15 kW and operating speeds between 120 r/min and 30 000 r/min | vibration zones A–D | **replaces ISO 10816-3** named in guide 01 – vibration limits for monitoring (twin `vib_h`). For machines below 15 kW the limits are guidance only | 01 (as ISO 10816-3) | ISO / national |
| ISO 6020-2 / ISO 6022 | Hydraulic fluid power – Mounting dimensions for single rod cylinders, 16 MPa (160 bar) series – Part 2: Compact series / … 25 MPa (250 bar) series | hydraulic cylinder interchangeability | APC lift cylinder: buy to ISO dimensions → second source possible | 09, 10 | ISO / national |
| ISO 606 | Short-pitch transmission precision roller and bush chains, attachments and associated chain sprockets | roller chains | chain drives in interfaces (guide 10) | 10 | ISO / national |
| ISO 3448 | Industrial liquid lubricants – ISO viscosity classification | ISO VG grades | worm gear oil ISO VG 220 (guide 12) | 12 | ISO / national |
| EN 12464-1 | Light and lighting – Lighting of work places – Part 1: Indoor work places | illuminance | assembly and inspection workplaces need more lux than the hall (values in the standard tables) | 10 | national body |

### 4.7 Machine tools, gears, NC

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 230-1 | Test code for machine tools – Part 1: Geometric accuracy of machines operating under no-load or quasi-static conditions | geometric tests | straightness, squareness, table flatness – acceptance of HMCs and of your rotary table | new (12) | ISO / national |
| ISO 230-2 | Test code for machine tools – Part 2: Determination of accuracy and repeatability of positioning of numerically controlled axes | positioning accuracy **A**, repeatability **R**, systematic deviation **E**, reversal value **B** | laser / rotary measurement: targets spread over the travel, **5 runs in each direction**; rotary table indexing accuracy in arc seconds (guide 12). Verify current edition | 12, 13 | ISO / national |
| ISO 10791 (series) | Test conditions for machining centres (Part 1: geometric tests for horizontal spindle machines; Part 4: positioning of linear and rotary axes; Part 7: accuracy of a finished test piece; …) | acceptance tests of machining centres | HMC acceptance at FAT/SAT; test piece cut at SAT. Part titles – verify | 12, 13 | ISO / national |
| DIN 3974-1 / -2 | Accuracy of worm gears (Part 1 general; Part 2 tolerances) – verify titles | worm gear accuracy grades | worm / wheel quality for the rotary table (guide 12) | 12, 13 | DIN Media |
| DIN 3975-1 / -2 | Terms and definitions for cylindrical worm gears with shaft angle 90° – verify titles | worm gear geometry terms | worm drawing data (module, lead angle, flank form) | new (12) | DIN Media |
| DIN 3996 | Calculation of load capacity of cylindrical worm gear pairs with rectangular crossing axes – verify title | worm gear load capacity (wear, pitting, temperature, tooth root) | rotary table worm drive calculation; ISO/TS 14521 is the ISO equivalent – verify | 12 | DIN Media |
| DIN 332-1 | Center holes 60° – Forms R, A, B and C (verify title) | centre holes | worm and shaft centre holes, form B (guide 12) | 12, 13 | DIN Media |
| ISO 14104 | Gears – Surface temper etch inspection after grinding, chemical method | grinding burn detection (nital etch) | inspection of ground worms and gears; classes of acceptable indications agreed with design | 12, 13 | ISO / national |
| ISO 6983-1 | Automation systems and integration – Numerical control of machines – Program format and definitions of address words – Part 1: Data format for positioning, line motion and contouring control systems | G-code basics | NC programs (guide 08); real controllers add their own cycles – use the control manual | 07, 08 | ISO / national |
| ISO 1328-1 | Cylindrical gears – ISO system of flank tolerance classification – Part 1: Definitions and allowable values of deviations relevant to flanks of gear teeth | spur/helical gear accuracy | APC ring gear and pinion (guide 09) | new (09) | ISO / national |
| ISO 6336 (series) | Calculation of load capacity of spur and helical gears | gear strength | APC ring gear / pinion calculation | new (09) | ISO / national |
| ISO 12164-1 / -2 | Hollow taper interface with flange contact surface (HSK) – Part 1: shanks, Part 2: receivers – verify titles + edition | HSK taper geometry | spindle nose HSK-A63 receiver: taper, face, drive keys (guides 18, 19) | new (18, 19) | ISO / national |
| ISO 1947 | System of cone tolerances for conical workpieces (AT classes) – verify | taper tolerance classes | HSK taper grinding + taper gauge (guide 18) | new (18) | ISO / national |
| ISO 492 | Rolling bearings – Radial bearings – Geometrical product specifications (GPS) and tolerance values | bearing tolerance classes (P4 etc.) | spindle bearings P4 or better (guides 18, 19) | new (18, 19) | ISO / national |
| ISO 21940-21 | Mechanical vibration – Rotor balancing – Part 21: Description and evaluation of balancing machines – verify | balancing machine capability | balancing of the spindle shaft / rotor unit (guides 18, 19) | new (18, 19) | ISO / national |
| ISO 230-7 | Test code for machine tools – Part 7: Geometric accuracy of axes of rotation | spindle error motion | spindle final test (guide 19) | new (19) | ISO / national |
| DIN EN 16983 / DIN EN 16984 | Disc springs – quality requirements / calculation – verify titles | disc springs | drawbar spring pack (guides 18, 19) | new (18, 19) | DIN Media |

### 4.8 Materials and testing

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| EN 10085 | Nitriding steels – Technical delivery conditions | nitriding steel grades (31CrMoV9) | spindle shaft material (guide 18) | new (18) | CEN / national |
| EN ISO 683-3 / -17 | Heat-treatable steels – Part 3: case-hardening steels; Part 17: ball and roller bearing steels | 18CrNiMo7-6, 100Cr6 | alternative shaft steel, spacers (guide 18) | new (18) | ISO / national |
| ISO 6506-1 | Metallic materials – Brinell hardness test – Part 1: Test method | Brinell hardness | QT bar + stress relief check (guide 18) | new (18) | ISO / national |
| ISO 14644-1 | Cleanrooms and associated controlled environments – Part 1: Classification of air cleanliness by particle concentration | clean-room class | spindle assembly room (guide 19) | new (19) | ISO / national |
| EN 10083-1 / -2 / -3 | Steels for quenching and tempering – Part 1: General technical delivery conditions; Part 2: Non alloy steels; Part 3: Alloy steels | C45 (1.0503), 42CrMo4 (1.7225) | hubs, ledges, shafts (guides 09, 12) | 09, 12 (materials) | national body |
| EN 10084 | Case hardening steels – Technical delivery conditions | 16MnCr5 (1.7131), 20MnCr5 (1.7147), 18CrNiMo7-6 (1.6587) | worm, locating receivers, pinion (case hardened 58–62 HRC) | 09, 12 (materials) | national body |
| EN 10025-2 | Hot rolled products of structural steels – Part 2: Technical delivery conditions for non-alloy structural steels | S235, S355J2 (1.0577) | welded frames, APC arm, AGV chassis | 09, 10, 11 (materials) | national body |
| EN 1561 | Founding – Grey cast irons | EN-GJL-250, EN-GJL-300 | crankcase castings (product), machine bases | 08, 12 (materials) | national body |
| EN 1563 | Founding – Spheroidal graphite cast irons | EN-GJS-600-3 | rotary table top, pallets | 12 (materials) | national body |
| EN 1982 | Copper and copper alloys – Ingots and castings | CuSn12Ni2-C (worm wheel bronze) – verify designation | worm wheel rim | 12 (materials) | national body |
| ISO 6506-1 | Metallic materials – Brinell hardness test – Part 1: Test method | HBW | castings incoming inspection (HB) | new | ISO / national |
| ISO 6507-1 | Metallic materials – Vickers hardness test – Part 1: Test method | HV | case depth profiles, thin layers | new | ISO / national |
| ISO 6508-1 | Metallic materials – Rockwell hardness test – Part 1: Test method | HRC | hardened parts (58–62 HRC) | new | ISO / national |
| ISO 18265 | Metallic materials – Conversion of hardness values | HB ↔ HV ↔ HRC ↔ tensile strength (approximate) | conversion is **only approximate and material dependent** – specify the method on the drawing, do not accept converted values for acceptance unless agreed | new | ISO / national |
| ISO 18203 | Steel – Determination of the thickness of surface-hardened layers | case hardening depth (CHD at 550 HV), nitriding depth | worm case depth on the drawing (e.g. CHD 0.8–1.2 mm – example). Replaced older ISO 2639 – verify | new | ISO / national |
| ISO 6892-1 | Metallic materials – Tensile testing – Part 1: Method of test at room temperature | tensile test | values in 3.1 certificates | new | ISO / national |
| EN 10204 | Metallic products – Types of inspection documents | certificates 2.1, 2.2, **3.1**, 3.2 | order all safety- and function-relevant material with **3.1** (specific inspection, issued by the manufacturer's inspection representative independent of production); store with the lot (guide 15 3.7) | 12, 15 | national body |

### 4.9 Compressor product

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| ISO 1217 | Displacement compressors – Acceptance tests | measurement of **free air delivery (FAD)**, power, specific energy; **Annex C** for electrically driven packaged compressors | test bench design (guide 04 test, TEST-01/02); tolerances in Annex C depend on flow size – for the smallest class (≤ 0.5 m³/min, i.e. all VC models 10–30 m³/h) commonly **±7 % FAD** and **±8 % specific energy** – **verify current edition and table**. Bench measurement uncertainty must be much smaller than the tolerance | new (01, 04 test limits) | ISO / national |
| ISO 1217 vs. production test | – | – | the 100 % end-of-line test is a short test with limits derived from ISO 1217 type tests; document the relation (type test vs. routine test) | – | – |
| EN 1012-1 | Compressors and vacuum pumps – Safety requirements – Part 1: Air compressors (verify title / edition) | type-C safety standard for air compressors | guards on belt/fan, hot surfaces, pressure relief, noise information, instructions | new | national body |
| ISO 2151 | Acoustics – Noise test code for compressors and vacuum pumps – Engineering method (Grade 2) | noise measurement | declared sound power level on the datasheet / type plate if required by law | new | ISO / national |
| ISO 4126-1 | Safety devices for protection against excessive pressure – Part 1: Safety valves | safety valves | buy certified safety valves for the tank; set pressure ≤ maximum allowable pressure of the tank | new | ISO / national |
| EN 286-1 | Simple unfired pressure vessels designed to contain air or nitrogen – Part 1: Pressure vessels for general purposes | design of simple air tanks | the 100 / 300 / 500 L tanks (VC10/20/30). In the EU: Simple Pressure Vessels Directive 2014/29/EU (or Pressure Equipment Directive 2014/68/EU for other vessels). **CHECK LOCAL LAW** – many countries have their own pressure-vessel code, registration and periodic inspection rules; buying tanks from a certified tank manufacturer is the usual solution | new | national body / **local law** |

### 4.10 Labelling and identification

| Standard | Title | Covers | Requirements for this project | Guide | Get it |
|---|---|---|---|---|---|
| GS1 General Specifications | (GS1 standard, updated yearly) | GTIN, SSCC, Application Identifiers, check digits, label layout | label formats in guide 15 (3.16); join GS1 for a company prefix | 04, 07, 15 | free (gs1.org) |
| GS1 EPC Tag Data Standard | (GS1 standard) | EPC encoding (SGTIN-96, SSCC-96, GRAI-96, GIAI-96) | UHF RFID on crates and finished goods | 15 | free (gs1.org) |
| ISO/IEC 15417 | Information technology – Automatic identification and data capture techniques – Code 128 bar code symbology specification | Code 128 (base of GS1-128) | label printers | new | ISO / national |
| ISO/IEC 16022 | Information technology – Automatic identification and data capture techniques – Data Matrix bar code symbology specification | Data Matrix | part marking, labels | new | ISO / national |
| ISO/IEC 15415 / 15416 | … Bar code symbol print quality test specification – Two-dimensional symbols / Linear symbols | print quality grading | verify labels (grade C or better is common for GS1 – agree with customers) | new | ISO / national |
| ISO/IEC TR 29158 | … Direct Part Mark (DPM) quality guideline | DPM grading | laser / dot-peen DataMatrix on the cast crankcase | new | ISO / national |
| ISO 15394 / ISO 28219 | Packaging – Bar code and two-dimensional symbols for shipping, transport and receiving labels / … for product packaging and labelling of products – verify titles | shipping and product labels | if customers require ISO labels instead of GS1 logistic label (automotive: VDA 4902 / Odette) | new | ISO / national |

---

## 5. Which standards to buy first (priority list for a small team)

Buy in this order. Many are available as a **collection / subscription** from the national body – often
cheaper than single copies when you need more than ~10.

| Priority | Standards | Why first |
|---|---|---|
| **1 – before any machine design or purchase** | ISO 12100, ISO 13849-1, ISO 13849-2, IEC 60204-1, ISO 13855, ISO 14119, ISO 14120, ISO 13857 (+ ISO 13854), ISO 13850 | safety must be designed in; needed to write the specifications and check suppliers |
| **2 – material handling** | ISO 3691-4, EN 528, EN 15635 (EN 15512 / EN 15620 – the rack supplier has them; ask for their calculation), EN 619 | AGVs and AS/RS are the most complex safety interfaces in this factory |
| **3 – product** | ISO 1217, EN 1012-1, local pressure-vessel law + EN 286-1 (or local code), ISO 4126-1 | you cannot sell the compressor without them; test bench design depends on ISO 1217 |
| **4 – drawings and manufacturing** | ISO 286-1/-2, ISO 1101, ISO 2768-1, ISO 5817, ISO 13920, ISO 898-1, EN 10204 | every drawing and every purchase order uses them |
| **5 – free documents (download now)** | VDA 5050, OPC UA specs (OPC Foundation), MQTT (OASIS), GS1 General Specifications, EPC TDS | free – no reason to wait |
| **6 – automation and IT** | IEC 61131-3 (or the PLC maker's manual is often enough), IEC 62443-3-3 + 2-1 (or a guideline summary), ISA-18.2 | before writing PLC/SCADA specifications |
| **7 – machine-tool acceptance** | ISO 230-1, ISO 230-2, ISO 10791 relevant parts, ISO 16090-1 | before HMC FAT; before building the rotary table (with DIN 3974/3996, ISO 14104) |
| **8 – management systems** | ISO 9001 (then ISO 45001, ISO 14001, ISO 50001 when you plan certification) | needed for certification and supplier approval, not for the first design |

Rough rule for a small team: priorities 1–5 cover about 80 % of what you need in the planning phase.

---

## 6. How to keep the register current

1. **One owner** (e.g. quality engineer) keeps this register as a controlled document
   (`VC-QA-SPEC-0002`, numbering per guide 15) and the PDF library on the offline document server.
2. **Add two columns** when you buy a standard: *edition bought* (e.g. `ISO 13855:2024`) and *date last
   checked*.
3. **Check every 6 months** (and before every big order / FAT): look up each standard in the ISO OBP, IEC
   Webstore or national shop – is there a newer edition, an amendment, a withdrawal?
   If your country uses a list of designated / harmonised standards (EU: Official Journal), check that list too.
4. **When a new edition appears:** read the foreword ("this edition cancels and replaces … the main changes
   are …"), write a short gap note, and if designs or procedures are affected, open an **ECR** (guide 15 3.3).
5. **Keep old editions** that were used for a machine already built – the technical file must show which
   edition the machine was designed to.
6. **Write the edition into contracts**: "according to ISO 13849-1:2023" – or "latest edition at the date of
   order" – so the supplier knows the reference.
7. **Licence rules:** standards are copyrighted. Store them in a protected folder; check how many users the
   licence allows.

Register template (copy for your own list):

| Standard | Edition bought | Date checked | Newer edition? | Owner | Used in |
|---|---|---|---|---|---|
| ISO 13855 | 2024 | 2026-11-11 | no | QA | 05, 09, 10 |

---

## 7. Common mistakes / lessons learned

| Mistake | Effect | Avoid by |
|---|---|---|
| Designing to an old edition found on the internet | safety function or acceptance test not valid | buy from the official source, check edition |
| Thinking "machine for own use needs no conformity work" | legal risk after an accident | check local law – usually you are the manufacturer |
| Using ISO 13849-1 and IEC 62061 mixed inside one safety function without method | calculation not traceable | one method per safety function |
| Converting HRC ↔ HB ↔ strength with ISO 18265 tables for acceptance | wrong decisions | measure with the method on the drawing |
| Relying on ISO 10816-3 values for small machines | false alarms or missed damage | use ISO 20816 series, trend-based limits |
| Assuming EN 286-1 is enough everywhere for the tank | product cannot be sold | check local pressure-equipment law |
| Buying all standards at once | high cost, many unread | priority list (section 5) |

---

## 8. Limits of this register

* Titles were written carefully but **must be checked** against the publisher's catalogue; entries marked
  "verify" are known to have new editions, title changes or uncertainty.
* Key values are **shortened** – the standards contain conditions, exceptions and tables not shown here.
* Laws, designated standards and certification rules are country specific and are not covered in detail.
* Industry-specific customer standards (e.g. automotive customer specifics) are not included.

---

## 9. Glossary

| Term | Meaning |
|---|---|
| Amendment (Amd) | an official change to a standard without a full new edition |
| CE marking | EU conformity marking; other countries have their own marks |
| Designated / harmonised standard | standard listed by the authority; following it gives presumption of conformity |
| Edition | the year version of a standard, e.g. ISO 13849-1:2023 |
| EN / EN ISO | European standard / ISO standard adopted as European standard |
| OBP | ISO Online Browsing Platform – free check of titles and editions |
| PL / PLr | Performance Level (achieved) / required Performance Level (ISO 13849-1) |
| SIL | Safety Integrity Level (IEC 62061) |
| Type-A / B / C standard | A = basic safety (ISO 12100), B = generic safety aspects (ISO 13855, ISO 14119 …), C = specific machine type (ISO 16090-1, ISO 3691-4, EN 528) – a C-standard has priority for its machine type |
| Withdrawn | no longer valid; a replacement is usually named |
