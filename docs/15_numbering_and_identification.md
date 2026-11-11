# 15 – Numbering and Identification (one scheme for the whole project)

> **All numbers in this guide are example values** – but the **formats** are binding for the project.
> All other guides (01–14) use exactly these formats. If you change a format, change it here first
> (with an ECR, see 3.3) and then in all guides, the MES/ERP and the PLC/SCADA projects.

---

## 1. Purpose

A real factory has hundreds of thousands of "things" that need a name: drawings, parts, compressors,
casting lots, pallets, rack slots, PLC signals, wires, cables, IP addresses, NC programs, tools, gauges.

If every supplier and every department invents its own names, you get:

* the same machine called "HMC-01", "Machine 4" and "BAZ1" in three systems → data cannot be linked;
* two drawings with the same number, or one drawing with two numbers → wrong part manufactured;
* a compressor fails at the customer and nobody can find which casting heat it came from.

This guide gives **one identification scheme** for everything. Rules:

1. **One thing = one ID. One ID = one thing.** Never re-use a number, not even for scrapped parts.
2. **The ID is fixed for life.** A machine moved to another hall keeps its ID. A drawing keeps its number
   through all revisions.
3. **Same ID in every system**: drawing, ERP, MES, PLC, SCADA, label, digital twin.
4. **Machine-readable**: only `A–Z`, `0–9`, `-` (hyphen) and, where a system does not accept hyphens
   (PLC symbols, tag names), `_` (underscore). No spaces, no lower-case letters in IDs, no special
   characters (`/ \ . , ä ö ü ° Ø`), no leading spaces.
5. **Fixed length per field** with leading zeros (`0012`, not `12`) – so lists sort correctly.
6. **No meaning in sequence numbers.** The 4-digit or 5-digit sequence only counts. Meaning (area,
   type, week) is in the fixed fields before it.
7. **Avoid letters that look like digits** in free fields: do not use `I`, `O`, `Q` as revision letters
   (see 3.3).

---

## 2. Where in the twin

| Thing | Where in the twin | Note |
|---|---|---|
| Machine / station IDs (`HMC-01`, `VMC-01`, `LOAD-CC` …) | `config/factory.json` → `stations` | the real IDs; use them everywhere |
| Stores (`ASRS-RAW`, `ASRS-FG`), pallet pool (`PPS-1`), pallets (`PAL-CC`) | `config/factory.json` → `asrs`, `pallet_pools`, `pools` | |
| AGVs (`AGV-01`, `AGV-02`) | `config/factory.json` → `agv.count` | the twin numbers them 01, 02 … |
| Serial numbers of compressors | MES tab → Traceability | **the twin uses a short form** `VC20-000012`; the real factory uses `VC20-2546-00123` (3.6) |
| Lots, WO, PO, SO, NCR | MES / ERP tabs | the twin uses short forms (`WO-0012`, `CC20-L0009`, `NCR-00002`); the real factory uses the formats in 3.7–3.8 |
| Tag names | SCADA tab | the twin uses `<Station>.<Signal>` (`HMC-02.Temperature`); the real factory uses `MCH_L2_HMC02_SpindleTemp` (3.10) |
| Worm serial / matched pair | HMC build 2 (worm manufacturing) | twin: `W-0001` / `P-0001`; real factory: `WRM-2546-00017` / `P-2546-00004` (3.6) |

> The twin is a simulation and keeps its short IDs so that the code stays simple. When you connect the twin
> to the real MES (guide 01, "connecting real machines"), map the short IDs to the real IDs in one table.

---

## 3. The identification scheme

### 3.1 Overview – all formats on one page

| What | Format | Example |
|---|---|---|
| Drawing | `VC-<area>-<group>-<4 digits>-<rev>` | `VC-HMC-RT-0012-B` |
| Document (spec, calc, manual, test protocol) | `VC-<area>-<doc type>-<4 digits>-<rev>` | `VC-APC-SPEC-0001-A`, `VC-TST-FAT-0003-A` |
| Interface sheet | `VC-IF-<side A>-<side B>-<4 digits>-<rev>` | `VC-IF-AGV-APC-0001-A` |
| Change request / note | `ECR-<YYWW>-<4 digits>` / `ECN-<YYWW>-<4 digits>` | `ECR-2546-0007`, `ECN-2546-0007` |
| MAKE part number | = drawing number **without** revision | `VC-HMC-RT-0012` |
| BUY part number | `B-<class>-<5 digits>` | `B-BRG-00042` |
| Raw material item | `R-<class>-<5 digits>` | `R-BAR-00065` |
| Serial number | `<type code>-<YYWW>-<5 digits>` (+ optional `-<check digit>`) | `VC20-2546-00123`, `WRM-2546-00017-1` |
| Matched pair | `P-<YYWW>-<5 digits>` | `P-2546-00004` |
| Material lot (own) | `LOT-<item prefix>-<YYWW>-<3 digits>` | `LOT-CC20-2546-003` |
| Heat number (supplier) | exactly as on the 3.1 certificate | `H41137` |
| Orders | `<prefix>-<YYWW>-<4 digits>` | `WO-2546-0001`, `SO-…`, `PO-…`, `NCR-…`, `MWO-…` |
| Machine / equipment | `<type>-<2 digits>` or `<type>-<name>` | `HMC-01`, `AGV-01`, `ASRS-RAW` |
| Storage location | `<store>-A<2>-L<1>-S<2>` | `ASRS-RAW-A03-L2-S14` |
| Load carrier | `PAL-<4 digits>`, `CRT-<6 digits>` | `PAL-0007`, `CRT-000123` |
| Tag name | `<Area>_<Line>_<Machine>_<Signal>` | `MCH_L2_HMC01_SpindleTemp` |
| Alarm | `<Machine>_A<4 digits>` | `HMC01_A2105` |
| Device designation (IEC 81346 style) | `=<function> +<location> -<product>` | `=MCH.L2.HMC01 +CAB01 -QA3` |
| Cable | `-W<4 digits>` | `-W0123` |
| Host name | `vc-<area>-<device>` (lower case) | `vc-mch-plc01` |
| NC program | `O<4 digits>` + file name | `O2102` / `VC-PRD-CC-0020_OP20_HMC_B.nc` |
| Tool | `T<4 digits>` (+ `-<2>` for the individual tool assembly) | `T1203`, `T1203-02` |
| Gauge | `GA-<type>-<4 digits>` | `GA-PLG-0045` |
| Software version | `MAJOR.MINOR.PATCH` | `PLC-01 v2.3.1` |
| Date / time | ISO 8601 | `2026-11-11T08:30:00Z` |

`YYWW` everywhere = **ISO year (2 digits) + ISO week (2 digits)**, see 3.15. Example `2546` = year 2025,
week 46 = Monday 10 Nov 2025 to Sunday 16 Nov 2025.

---

### 3.2 Drawing numbers

**Format:** `VC-<area>-<group>-<nnnn>-<rev>`

| Field | Length | Meaning | Example |
|---|---|---|---|
| `VC` | 2 | project / company prefix (V-Compressor) | `VC` |
| `<area>` | 2–3 letters | area code (table below) | `HMC` |
| `<group>` | 2–3 letters | group inside the area (tables below) | `RT` |
| `<nnnn>` | 4 digits | running number inside area + group, starts at `0001` | `0012` |
| `<rev>` | 1 letter (or 0.1, 0.2 … before release) | revision (3.3) | `B` |

Example `VC-HMC-RT-0012-B` = project VC, HMC machine, rotary table group, drawing 12, revision B.

**Number ranges inside a group (recommended):**

| Range | Use |
|---|---|
| `0001`–`0009` | general assembly / main assembly drawings of the group |
| `0010`–`0499` | sub-assemblies and parts |
| `0500`–`0899` | welded assemblies and weld parts |
| `0900`–`0999` | schematics, diagrams, lists that belong to the group |

The ranges are a help only. The number itself still has no meaning – never "decode" it in software.

#### Area codes

| Area code | Area | Typical content |
|---|---|---|
| `FAC` | Factory / layout | hall layout, foundations, media, escape routes |
| `MCH` | Machining | fixtures, cell layouts, chip and coolant systems, washer |
| `ASM` | Assembly | assembly stations, press-fit units, screwing, robot cell |
| `TST` | Test | compressor test benches, test fixtures, piping, noise booth |
| `APC` | Pallet changer | the 2-pallet rotary APC (guide 09) |
| `MEC` | Mechanical interfaces | transfer stations, docking stands (guide 10) |
| `AGV` | Automated guided vehicles | own-built AGVs (guide 11) |
| `HMC` | Horizontal machining centre parts | rotary table, worm drive (guide 12) |
| `ELE` | Electrical | schematics, cabinet layouts, cable and terminal plans |
| `HYD` | Hydraulics | hydraulic circuits (ISO 1219), power units, manifolds |
| `PNE` | Pneumatics | pneumatic circuits, valve terminals, air supply |
| `ITS` | IT / software | network plans, server layout, data models |
| `QA` | Quality | gauges, inspection fixtures, control plans |
| `PRD` | Product (compressor) – **added in this guide** | crankcase, cylinder, crankshaft, tank drawings of VC10/20/30 |

#### Group codes per area

| Area | Group codes (examples) |
|---|---|
| `FAC` | `LAY` layout · `FND` foundations · `BLD` building/hall · `UTL` utilities (power, air, water) · `SAF` safety zones, escape routes |
| `MCH` | `FIX` fixtures · `PAL` machining pallets · `CEL` cell layout · `WSH` washer · `CHP` chip handling · `CLT` coolant · `TLG` special tool holders |
| `ASM` | `STN` assembly station · `PRS` press-fit unit · `SCR` screwing station · `ROB` robot cell, grippers · `JIG` assembly jigs |
| `TST` | `BEN` test bench · `FIX` test fixture/adapter · `PIP` piping · `INS` instrumentation · `ENC` noise enclosure |
| `APC` | `ASY` general assembly · `ARM` arm and cross beam · `LFT` lift unit · `ROT` rotary drive · `FRM` base frame · `PAL` pallet and clamping · `GRD` guards |
| `MEC` | `TRF` pallet transfer AGV/cart ↔ APC station · `DCK` crate docking stand · `ASR` AS/RS ↔ AGV · `LDS` load station ↔ APC |
| `AGV` | `CHS` chassis · `DRV` drive unit · `LFT` lift unit · `BAT` battery · `SAF` safety scanner mounts, bumpers · `BDY` covers · `CHG` charger |
| `HMC` | `RT` rotary table · `WRM` worm and wheel · `BAS` bed, column · `SPN` spindle · `ATC` tool changer · `GRD` guards · `LUB` lubrication |
| `ELE` | `SCH` schematics · `CAB` cabinet layout · `TRM` terminal plans · `CBL` cable plans · `PWR` power distribution · `GND` earthing / equipotential bonding |
| `HYD` | `CIR` circuit diagram · `PWR` power unit · `MAN` manifold · `PIP` piping |
| `PNE` | `CIR` circuit diagram · `VLV` valve terminal · `PIP` piping · `AIR` air supply and treatment |
| `ITS` | `NET` network plan · `SRV` servers, racks · `DAT` data model |
| `QA` | `GAU` gauges · `INS` inspection fixtures · `CMM` CMM fixtures |
| `PRD` | `CC` crankcase · `CYL` cylinder · `CS` crankshaft · `CR` connecting rod · `HD` cylinder head · `TNK` tank · `ASY` compressor assembly |

**Examples:**

| Drawing number | Content |
|---|---|
| `VC-FAC-LAY-0001-C` | hall layout, revision C |
| `VC-MCH-FIX-0014-A` | crankcase fixture for HMC, VC20 |
| `VC-APC-ASY-0001-B` | APC general assembly |
| `VC-APC-ARM-0510-A` | APC arm, welded assembly (weld range 05xx) |
| `VC-MEC-DCK-0003-A` | crate docking stand, main assembly |
| `VC-AGV-DRV-0021-A` | AGV drive wheel hub |
| `VC-HMC-RT-0012-B` | rotary table top |
| `VC-HMC-WRM-0011-A` | duplex worm |
| `VC-HYD-CIR-0901-A` | APC hydraulic circuit diagram |
| `VC-ELE-SCH-0901-D` | PLC-01 schematic |
| `VC-PRD-CC-0020-C` | crankcase VC20, machined |

**Title block (every drawing):** drawing number, revision, title (English), material, mass, scale, general
tolerance (e.g. ISO 2768-mK), projection symbol, drawn / checked / approved (name + date ISO 8601), sheet x of y,
MAKE/BUY, replaces / replaced by. File name = drawing number + revision: `VC-HMC-RT-0012-B.pdf`,
`VC-HMC-RT-0012-B.step`.

---

### 3.3 Revisions and change notes (ECR / ECN)

#### Revision rules

| Stage | Revision | Allowed use |
|---|---|---|
| Draft, internal review | `0.1`, `0.2`, `0.3` … | discussion, quotation only. Stamp "NOT FOR MANUFACTURING" |
| First release | `A` | manufacturing, ordering |
| Each released change | `B`, `C`, `D` … | |
| After `Z` | `AA`, `AB` … | |

Rules:

1. **Do not use `I`, `O`, `Q`, `S`, `X`, `Z`** as revision letters (they look like 1, 0, 5, 2 or are used as
   markers). So the sequence is `A B C D E F G H J K L M N P R T U V W Y`, then `AA`.
2. **Every change of a released document = new letter**, even a text correction. Only drafts use 0.x.
3. The revision table on the drawing shows: letter, ECN number, short description, date, name.
4. **Revision or new number?**

| Change | Old and new part interchangeable? | Action |
|---|---|---|
| Text, tolerance clarification, title block | yes | new revision letter |
| Dimension change, both versions fit and work | yes | new revision letter |
| Change of form, fit or function (old part does not fit or works differently) | **no** | **new drawing number / part number** |
| Material change with other strength | usually no | new number (unless engineering confirms interchangeable) |

Example: worm wheel bore changes from Ø60 H7 to Ø65 H7 → old wheels no longer fit the new hub → new number
`VC-HMC-WRM-0014-A` and the old `VC-HMC-WRM-0012` is marked "replaced by VC-HMC-WRM-0014".

#### Change process (ECR → ECN)

| Step | Who | Record |
|---|---|---|
| 1. Anybody finds a problem or wants a change | requester | **ECR** (Engineering Change Request) `ECR-2546-0007`: what, why, which documents, urgency |
| 2. Evaluate: cost, stock, parts in production, safety, other interfaces | design owner + production + quality + purchasing | impact list |
| 3. Decide | change board (weekly, 30 min) | approve / reject / postpone |
| 4. Make the change | design | new revisions of all documents |
| 5. Release | approver | **ECN** (Engineering Change Notice) `ECN-2546-0007` (same number as the ECR): list of new revisions, effective date or effective serial ("from VC20-2547-00001"), what to do with stock (use up / rework / scrap) |
| 6. Inform | document control | send ECN to all users, remove old copies from the shop floor |
| 7. Close | quality | check first part made to the new revision |

> One rule from real projects: **paper copies on the shop floor are the biggest risk.** Stamp printed
> drawings "UNCONTROLLED COPY – valid on print date only" or work from screens connected to the PDM.

---

### 3.4 Document numbers

**Format:** `VC-<area>-<doc type>-<nnnn>-<rev>` (area codes as in 3.2).

| Doc type | Meaning | Example |
|---|---|---|
| `SPEC` | technical specification / requirement specification | `VC-APC-SPEC-0001-A` |
| `CALC` | calculation (strength, cycle time, PL) | `VC-HMC-CALC-0003-B` |
| `RA` | risk assessment (ISO 12100) | `VC-APC-RA-0001-A` |
| `SRS` | safety requirements specification (safety functions, PLr) | `VC-APC-SRS-0001-A` |
| `IOL` | I/O list | `VC-ELE-IOL-0001-C` |
| `CBL` | cable list | `VC-ELE-CBL-0001-B` |
| `TAG` | tag list (SCADA/historian) | `VC-ITS-TAG-0001-A` |
| `ALM` | alarm list / alarm philosophy | `VC-ITS-ALM-0001-A` |
| `FAT` | factory acceptance test protocol (at supplier) | `VC-TST-FAT-0003-A` (FAT of test bench 3) |
| `SAT` | site acceptance test protocol (in our factory) | `VC-APC-SAT-0001-A` |
| `TP` | other test procedure / protocol | `VC-AGV-TP-0002-A` |
| `MAN` | operating manual | `VC-AGV-MAN-0001-A` |
| `MNT` | maintenance manual / plan | `VC-HMC-MNT-0001-A` |
| `WI` | work instruction | `VC-ASM-WI-0012-B` |
| `CP` | control plan | `VC-QA-CP-0004-A` |
| `FMEA` | process or design FMEA | `VC-MCH-FMEA-0001-A` |
| `BOM` | bill of material (if not only in ERP) | `VC-APC-BOM-0001-B` |
| `PLN` | plan (project, layout phase, commissioning) | `VC-FAC-PLN-0002-A` |
| `REP` | report (measurement, test result summary) | `VC-HMC-REP-0005-A` |

**Interface sheets** (rule 5 of the index: write an interface sheet for every hand-over):

`VC-IF-<side A>-<side B>-<nnnn>-<rev>` – side A and B are area codes, **in alphabetical order**, so the same
interface never gets two numbers.

| Example | Interface |
|---|---|
| `VC-IF-AGV-APC-0001-A` | AGV ↔ APC load station: mechanics (heights, catching), signals (handshake), safety |
| `VC-IF-AGV-ITS-0001-A` | AGV ↔ fleet manager: VDA 5050 messages, Wi-Fi |
| `VC-IF-APC-HMC-0001-A` | APC ↔ HMC: pallet position, clamping, door, signals |
| `VC-IF-ITS-MCH-0001-A` | MES ↔ machining PLCs: OPC UA interface DB |
| `VC-IF-ELE-HYD-0001-A` | electrical ↔ hydraulic unit: valves, pressure switches, power |

---

### 3.5 Part numbers and BOM structure

#### Part numbers

| Kind | Format | Example | Rule |
|---|---|---|---|
| **MAKE** part / assembly | drawing number without revision | `VC-HMC-RT-0012` | revision is a separate field in ERP/BOM (`B`) |
| **BUY** catalogue part | `B-<class>-<5 digits>` | `B-SCR-01234` | one number per exact catalogue item (manufacturer + order code in ERP) |
| Raw material | `R-<class>-<5 digits>` | `R-BAR-00065` (16MnCr5 Ø65 bar) | material + dimension in description |
| Product (sales item, SKU) | `<model>-<tank volume>` | `VC20-300` | as in `config/factory.json` |
| Purchased product parts (castings, forgings) | `<prefix>-<kind>` | `CC20-CAST` | as in `config/factory.json` (`erp.items`) |

BUY classes (examples): `BRG` bearings · `SCR` screws, nuts, washers · `PIN` pins · `SEL` seals, O-rings ·
`MOT` motors, servos · `GBX` gearboxes · `SEN` sensors · `VLV` valves · `CYL` cylinders · `ELE` electrical
components · `PNE` pneumatic parts · `HYD` hydraulic parts · `LUB` oils, greases · `TOL` cutting tools.

Raw material classes: `BAR` round bar · `PLT` plate · `TUB` tube/profile · `CST` casting blanks · `FRG` forgings.

**Description rule (ERP short text, max. 40 characters, English):** `NOUN, type, main size, standard, material/class`

| Item | Good description |
|---|---|
| `B-SCR-01234` | `SCREW, SOCKET HEAD, M10x30, ISO 4762, 8.8` |
| `B-PIN-00210` | `PIN, PARALLEL, 8m6x24, ISO 8734` |
| `B-BRG-00042` | `BEARING, CROSSED ROLLER, ID 350` |
| `R-BAR-00065` | `BAR, ROUND, D65, 16MnCr5 1.7131` |

> Two identical screws with two numbers cost stock and confusion. Before creating a BUY number, search the ERP
> for the standard and size.

#### BOM levels

| Level | Content | Example (APC) | Example (compressor) |
|---|---|---|---|
| 0 | finished equipment / product | `VC-APC-ASY-0001` APC complete | `VC20-300` compressor |
| 1 | main assemblies | `VC-APC-ARM-0001` arm assembly | `VC-PRD-ASY-0002` pump unit |
| 2 | sub-assemblies | `VC-APC-ARM-0510` arm, welded | `VC-PRD-CC-0020` crankcase, machined |
| 3 | parts | `VC-APC-ARM-0021` fork rail | `CC20-CAST` crankcase casting |
| 4 | raw material | `R-PLT-00030` plate 30 mm S355 | – (casting is bought) |

Indented BOM example (extract):

| Lvl | Item | Rev | Description | Qty | Unit | M/B |
|---|---|---|---|---|---|---|
| 0 | `VC-APC-ASY-0001` | B | APC 2-PALLET ROTARY, COMPLETE | 1 | pc | MAKE |
| .1 | `VC-APC-ARM-0001` | A | ARM ASSEMBLY | 1 | pc | MAKE |
| ..2 | `VC-APC-ARM-0510` | A | ARM, WELDED, S355J2 | 1 | pc | MAKE |
| ...3 | `R-TUB-00160` | – | TUBE, RECT, 160x100x10, S355J2 | 2.4 | m | BUY |
| ..2 | `VC-APC-ARM-0021` | A | FORK RAIL | 4 | pc | MAKE |
| ..2 | `B-SCR-01234` | – | SCREW, SOCKET HEAD, M10x30, ISO 4762, 8.8 | 16 | pc | BUY |
| .1 | `VC-APC-ROT-0001` | B | ROTARY DRIVE ASSEMBLY | 1 | pc | MAKE |
| ..2 | `B-MOT-00017` | – | SERVO MOTOR, 1.5 kW | 1 | pc | BUY |

Rules: the BOM always refers to a part number + revision; quantity with unit; a **phantom** assembly (only for
drawing, never stocked) is marked in ERP so MRP does not plan it.

---

### 3.6 Serial numbers

**Format:** `<type code>-<YYWW>-<nnnnn>` (optional check digit: `-<c>`)

| Field | Meaning |
|---|---|
| type code | what it is (table below) |
| `YYWW` | ISO year + ISO week in which the serial was **assigned** (= first operation, e.g. marking at the load station) |
| `nnnnn` | 5-digit sequence, **starts at `00001` every ISO week, separately for each type code** |

The full string is unique. Capacity: 99 999 per type per week – enough for this factory.

| Type code | Item | Marked where / how | Example |
|---|---|---|---|
| `VC10`, `VC20`, `VC30` | compressor (the product) | crankcase, DataMatrix + plain text, laser or dot-peen at load station `LOAD-CC` | `VC20-2546-00123` |
| `WRM` | duplex worm (HMC rotary table) | end face, laser | `WRM-2546-00017` |
| `WHL` | worm wheel | hub face, laser | `WHL-2546-00009` |
| `RT` | rotary table assembly | type plate | `RT-2546-00002` |
| `APC` | pallet changer assembly | type plate | `APC-2546-00001` |
| `AGV` | own-built AGV | type plate (the AGV also has its equipment ID `AGV-01`) | `AGV-2546-00001` |
| `HMC` | own-built / rebuilt HMC | type plate | `HMC-2546-00001` |
| `TNK` | air tank (if traced by own serial; supplier serial otherwise) | tank plate | `TNK-2546-00456` |

**Serial number ≠ equipment ID.** `AGV-2546-00001` is the physical vehicle (built week 46/2025). `AGV-01`
is its **role** in the factory (config, fleet manager, tags). If the vehicle is replaced by a new one,
`AGV-01` gets the new serial; the old vehicle keeps its serial forever. Same for `HMC-01`.

**Matched pairs:** parts that are only used together (worm + wheel, guide 12) get an additional pair number
`P-<YYWW>-<nnnnn>`.

| Pair | Contains | Marking |
|---|---|---|
| `P-2546-00004` | `WRM-2546-00017` + `WHL-2546-00009` | both parts carry their own serial **and** `P-2546-00004` |

Rule: never exchange only one part of a pair; the MES/maintenance record lists the pair.

#### Optional check digit (Luhn / mod 10)

A check digit finds typing errors when serials are entered by hand (wrong digit, two digits swapped).
Decide once for the whole project; if used, it is **added as a last field** and printed in plain text, but
scanners and the MES check it automatically.

**Luhn algorithm** over the digits of `YYWW` + `nnnnn` (9 digits):

1. Start at the **rightmost** digit. Double every second digit, starting with the rightmost one.
2. If a doubled value is > 9, subtract 9.
3. Add all values.
4. Check digit = (10 − (sum mod 10)) mod 10.

**Worked example** `VC20-2546-00123` → digits `2 5 4 6 0 0 1 2 3`

| Digit (left → right) | 2 | 5 | 4 | 6 | 0 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|---|---|---|
| Double? (from right: yes, no, yes …) | yes | no | yes | no | yes | no | yes | no | yes |
| Value | 4 | 5 | 8 | 6 | 0 | 0 | 2 | 2 | 6 |

Sum = 4 + 5 + 8 + 6 + 0 + 0 + 2 + 2 + 6 = **33** → 33 mod 10 = 3 → (10 − 3) mod 10 = **7**

Serial with check digit: **`VC20-2546-00123-7`**. Second example: `WRM-2546-00017` → `WRM-2546-00017-1`.

Check when reading: compute the Luhn sum over all 10 digits including the check digit → result must end in 0.
Luhn detects every single wrong digit and most swaps of two neighbour digits.

> In barcodes (DataMatrix) the check digit is not needed – the code has its own error correction. Use it for
> plain-text entry only.

---

### 3.7 Material lots and heat numbers

| ID | Format | Example | Given by |
|---|---|---|---|
| Own lot (goods receipt) | `LOT-<item prefix>-<YYWW of receipt>-<nnn>` | `LOT-CC20-2546-003` = 3rd lot of VC20 crankcase castings received in week 46/2025 | our goods receipt (ERP) |
| Supplier lot / batch | as printed by the supplier | `F-88213` | supplier |
| Heat number (melt / cast) | exactly as on the EN 10204 3.1 certificate | `H41137` | steel mill / foundry |

Item prefixes = buffer prefixes in `config/factory.json`: `CC10`, `CC20`, `CC30` (crankcase castings),
`CYL` (cylinder castings), `CS` (crankshaft forgings); add your own (`TNK`, `MOT` …) with the same rule.

Rules:

1. **One own lot = one delivery of one item from one heat (or one casting batch).** If a delivery contains
   two heats, create two lots.
2. The lot record links: own lot ↔ supplier lot ↔ heat number ↔ certificate file (scanned PDF, file name =
   lot ID: `LOT-CC20-2546-003_3.1.pdf`) ↔ PO number.
3. For bar stock that you cut yourself (worm blanks), **stamp the heat number on each blank** at sawing
   (guide 12, Op 10). After that the part serial carries the link.
4. The twin's short form `CC20-L0009` corresponds to `LOT-CC20-<YYWW>-<nnn>` in the real factory.

### 3.8 Orders and records

**Format:** `<prefix>-<YYWW>-<nnnn>` – 4-digit sequence, restarts at `0001` every ISO week per prefix.

| Prefix | Meaning | Created by | Example |
|---|---|---|---|
| `SO` | sales order | ERP | `SO-2546-0002` |
| `PO` | purchase order | ERP | `PO-2545-0011` |
| `WO` | work (production) order | ERP → MES | `WO-2546-0001` |
| `MWO` | maintenance work order | CMMS / MES | `MWO-2546-0012` |
| `NCR` | non-conformance record | MES / quality | `NCR-2546-0003` |
| `ECR` / `ECN` | engineering change request / notice | PDM / document control | `ECR-2546-0007` |
| `SHP` | shipment / delivery note | ERP | `SHP-2547-0021` |
| `CAL` | calibration record | quality | `CAL-2546-0031` |

Twin short forms (`WO-0012`, `PO-0009`, `NCR-00002`, `SO-0001`) map 1:1 to these.

---

### 3.9 Machines, equipment, storage locations, load carriers

#### Equipment IDs (as in `config/factory.json`)

Format: `<type>-<2 digits>` for machines that exist several times; `<type>-<name>` for unique systems.

| Type | Meaning | IDs in the example factory |
|---|---|---|
| `LOAD` | fixture load station | `LOAD-CC` |
| `HMC` | horizontal machining centre | `HMC-01`, `HMC-02`, `HMC-03` |
| `VMC` | vertical machining centre | `VMC-01` |
| `HONE` | honing machine | `HONE-01` |
| `LATHE` | CNC lathe | `LATHE-01` |
| `GRIND` | grinding machine | `GRIND-01` |
| `WASH` | parts washer | `WASH-01` |
| `ASSY` / `FINAL` | assembly stations | `ASSY-01`, `FINAL-01` |
| `ROBOT` | robot cell | `ROBOT-01` |
| `TEST` | compressor test bench | `TEST-01`, `TEST-02` |
| `PAINT` | paint booth | `PAINT-01` |
| `PACK` | packing station | `PACK-01` |
| `ASRS` | automatic storage and retrieval system | `ASRS-RAW`, `ASRS-FG` |
| `PPS` | linear pallet pool system | `PPS-1` |
| `AGV` | automated guided vehicle | `AGV-01`, `AGV-02` |
| `CHG` | AGV charging station | `CHG-01`, `CHG-02` |
| `APC` | pallet changer (belongs to a machine) | `APC-HMC01` |
| `PLC` | line PLC | `PLC-01` … `PLC-05`, `PLC-ASRS-RAW`, `PLC-ASRS-FG` |
| `CMP` | factory compressed-air station | `CMP-01` |

In systems that do not accept hyphens (PLC symbols, tags), drop the hyphen: `HMC-01` → `HMC01`,
`ASRS-RAW` → `ASRSRAW`.

#### Storage locations

**Format:** `<store>-A<aa>-L<l>-S<ss>`

| Field | Meaning | Example |
|---|---|---|
| `<store>` | store ID | `ASRS-RAW` |
| `A<aa>` | aisle / rack row (2 digits) | `A03` |
| `L<l>` | level, 1 = bottom (1 digit; use 2 digits `L12` if > 9 levels) | `L2` |
| `S<ss>` | slot / column, counted from the I/O point (2 digits) | `S14` |

`ASRS-RAW-A03-L2-S14` = raw-material AS/RS, aisle 3, level 2, slot 14. If a rack has two sides per aisle,
add `-L` / `-R` after the aisle: `ASRS-RAW-A03L-L2-S14`. Floor and supermarket locations:
`FLR-<area>-R<rr>-P<pp>`, example `FLR-ASM-R02-P05` (assembly floor store, row 2, position 5).
Print a location label (barcode + text) on every slot and scan it at every put-away / pick.

#### Load carriers

| Carrier | Format | Example | ID carrier on the object |
|---|---|---|---|
| Machining / fixture pallet (pool `PAL-CC`) | `PAL-<4 digits>` | `PAL-0007` | engraved + HF RFID tag in the pallet pocket (guide 09) |
| Crate / box | `CRT-<6 digits>` | `CRT-000123` | barcode label both sides, or UHF RFID |
| Transport pallet (wooden/plastic, internal) | `TPL-<5 digits>` | `TPL-00045` | label |
| Fixture (on pallet) | `FIX-<4 digits>` | `FIX-0003` | engraved |

The MES always knows **carrier ↔ content**: `PAL-0007` carries `VC20-2546-00123` on fixture `FIX-0003`.

---

### 3.10 Tag names (PLC, SCADA, historian, MQTT)

**Format:** `<Area>_<Line>_<Machine>_<Signal>`

| Field | Rule | Example |
|---|---|---|
| `<Area>` | plant area code, 3 letters (table) | `MCH` |
| `<Line>` | `L1`…`L9`, `L0` = equipment that serves the whole area | `L2` |
| `<Machine>` | equipment ID without hyphen | `HMC01` |
| `<Signal>` | CamelCase English, no units, positive logic, + suffix (table) | `SpindleTemp` |

Example: **`MCH_L2_HMC01_SpindleTemp`**

Plant area and line codes for the example factory:

| Area | Line | Equipment |
|---|---|---|
| `MCH` machining | `L1` crankshaft machining | `LATHE01`, `GRIND01` |
| `MCH` | `L2` crankcase FMS cell | `LOADCC`, `HMC01`–`HMC03`, `WASH01`, `PPS1`, `APCHMC01` … |
| `MCH` | `L3` cylinder machining | `VMC01`, `HONE01` |
| `ASM` assembly | `L1` pump assembly | `ASSY01`, `ROBOT01` |
| `TST` test | `L1` | `TEST01`, `TEST02` |
| `PNT` paint | `L1` | `PAINT01` |
| `FIN` final assembly + packing | `L1` | `FINAL01`, `PACK01` |
| `LOG` logistics | `L0` | `ASRSRAW`, `ASRSFG`, `AGV01`, `AGV02`, `CHG01` |
| `UTL` utilities | `L0` | `CMP01` (compressed air), power meters |

(`PNT`, `FIN`, `LOG`, `UTL` are plant-area codes for tags only; drawings use the codes of 3.2.)

**Signal names – fixed words** (use the same word on every machine; one faceplate template fits all):

| Word | Meaning | Unit (attribute, not in the name) |
|---|---|---|
| `Temp` | temperature | °C |
| `Press` | pressure | bar |
| `Flow` | flow | m³/h (air), L/min (liquid) |
| `Vib` | vibration velocity RMS | mm/s |
| `Power` | active power | kW |
| `Energy` | energy counter | kWh |
| `Speed` | rotational speed | 1/min |
| `Pos` | position | mm or ° |
| `Current` | current | A |
| `Level` | level | % |
| `Count` | counter | pcs |
| `State` | state code (0 RUNNING … 7 OFFLINE, guide 06) | – |

**Suffixes:**

| Suffix | Meaning | Example |
|---|---|---|
| (none) | measured value (process value) | `MCH_L2_HMC01_SpindleTemp` |
| `_Sp` | set point (writable) | `MCH_L2_HMC01_Speed_Sp` |
| `_Cmd` | command to an actuator (output) | `MCH_L2_APCHMC01_ArmLift_Cmd` |
| `_Fb` | feedback "actuator reached position" | `MCH_L2_APCHMC01_ArmUp_Fb` |
| `_Hi`, `_HiHi`, `_Lo`, `_LoLo` | alarm limits (parameter) | `MCH_L2_HMC01_Vib_HiHi` |
| `_Ok` | status OK (BOOL, 1 = good) | `MCH_L2_HMC01_HydPress_Ok` |
| `_Cnt` | counter | `MCH_L2_HMC01_Good_Cnt` |

Rules: positive logic (`DoorClosed`, never `DoorNotOpen`); BOOL names say the TRUE state; the unit, range,
scaling, deadband and alarm limits are **attributes in the tag list** (`VC-ITS-TAG-0001`), not in the name.

**Other systems use the same parts with other separators:**

| System | Form |
|---|---|
| PLC symbol / SCADA tag | `MCH_L2_HMC01_SpindleTemp` |
| OPC UA browse path | `MCH/L2/HMC01/SpindleTemp` |
| MQTT topic | `vc/MCH/L2/HMC01/SpindleTemp` |
| Twin (simplified) | `HMC-01.Temperature` |

#### Alarm IDs

**Format:** `<Machine>_A<gnnn>` – `g` = group digit, `nnn` = number inside the group.

| Group | Meaning | Example |
|---|---|---|
| `A0nnn` | system, communication, PLC | `HMC01_A0010` "OPC UA connection to MES lost" |
| `A1nnn` | safety (E-stop, doors, light curtain) | `HMC01_A1001` "E-stop pressed at operator panel" |
| `A2nnn` | hydraulics | `HMC01_A2105` "Clamping pressure low" |
| `A3nnn` | pneumatics | `HMC01_A3002` "Air pressure < 5 bar" |
| `A4nnn` | drives, axes | `HMC01_A4011` "Axis B following error" |
| `A5nnn` | process values (temp, vib) | `HMC01_A5101` "Spindle temperature high" |
| `A6nnn` | tool, NC program | `HMC01_A6020` "Tool life expired" |
| `A7nnn` | material handling, handshakes | `HMC01_A7003` "AGV handshake timeout" |
| `A8sss` | step-chain timeout, `sss` = step number | `APCHMC01_A8030` "Timeout step 30 (lift up)" |
| `A9nnn` | maintenance information | `HMC01_A9001` "Lubrication service due" |

Each alarm has in the alarm list: ID, text (English + local language), priority, cause, consequence, operator
action, limit, deadband, delay (guide 06, ISA-18.2 rationalisation).

---

### 3.11 PLC I/O addresses (Siemens style)

Rules (same as guide 05):

* Digital bits `.0`–`.7` only: after `%I21.7` comes `%I22.0`.
* Analog values are words, step 2 bytes: `%IW80`, `%IW82` …
* Each **station block** (one machine or one remote I/O station) gets its own byte range with spare.
* Safety (F-) I/O in its own range.

| Range | Use |
|---|---|
| `%I0.0`–`%I9.7` / `%Q0.0`–`%Q9.7` | main cabinet, line signals |
| `%I(10·b).0`–`%I(10·b+9).7` | station block `b` = 1 … 19, digital inputs (10 bytes = 80 inputs) |
| `%Q(10·b).0`–`%Q(10·b+9).7` | station block `b`, digital outputs |
| `%IW(64 + 16·(b−1))` … +14 | station block `b`, 8 analog inputs |
| `%I200.0`–`%I299.7` / `%Q200.0`–`%Q299.7` | fail-safe (F) I/O |
| `DB10`–`DB29` | station interface DBs (DB10 + b) |
| `DB90`–`DB99` | PLC-to-PLC and MES/SCADA interface DBs |

Inside a station block the modules are counted by **slot**: the first digital module uses the first bytes,
the next module continues (no gaps inside a block, the spare is at the end of the block).

**Example PLC-01, station block b = 2 = HMC-01:**

| Slot (in ET 200SP station of HMC-01) | Module | Addresses |
|---|---|---|
| 1 | DI 16 × 24 V DC | `%I20.0`–`%I21.7` |
| 2 | DI 8 × 24 V DC | `%I22.0`–`%I22.7` |
| 3 | DQ 16 × 24 V DC | `%Q20.0`–`%Q21.7` |
| 4 | AI 4 × 4–20 mA | `%IW80`, `%IW82`, `%IW84`, `%IW86` |
| 5 | F-DI 8 | `%I200.0`–`%I200.7` |
| spare | | `%I23.0`–`%I29.7`, `%IW88`–`%IW94` |

`MCH_L2_HMC01_SpindleTemp` → `%IW80` (4–20 mA = 0–150 °C). The I/O list `VC-ELE-IOL-0001` has one row per
signal: tag name, address, device designation, terminal, cable, wire, signal type, range, F yes/no.

> In the PLC program you work with symbols. The absolute address is still needed for wiring, FAT and
> diagnostics.

---

### 3.12 Device designations, terminals, wires, cables (IEC 81346 style)

A reference designation tells **what** (function), **where** (location), **which device** (product):

| Prefix | Aspect | Example | Meaning |
|---|---|---|---|
| `=` | function | `=MCH.L2.HMC01` | function "machine HMC-01 in line 2 of machining" |
| `+` | location | `+CAB01` | in main cabinet 01 |
| `-` | product (device) | `-QA3` | contactor/power switch no. 3 |

Full: **`=MCH.L2.HMC01 +CAB01 -QA3`**. On the device label in the cabinet the short form `-QA3` is enough
(the cabinet is `+CAB01`, the drawing header gives `=MCH.L2.HMC01`).

Location codes: `+CAB01` main cabinet · `+JB01` junction box · `+OP01` operator panel · `+FLD` field (on the
machine), e.g. `+FLD.APC`.

**Letter codes** (class letters after IEC 81346-2). The following are commonly used and safe to apply:

| Code | Device class | Examples in this project |
|---|---|---|
| `-BG` | sensor for position / presence | inductive proximity switch "arm up", limit switch |
| `-BP` | pressure sensor / switch | clamping pressure switch |
| `-BT` | temperature sensor | Pt100 spindle temperature |
| `-FC` | overcurrent protection | fuse, miniature circuit breaker, motor protection circuit breaker |
| `-KF` | electronic / relay signal processing | PLC CPU, I/O modules, safety relay, control relay |
| `-MA` | electric motor | spindle motor, servo motor, pump motor |
| `-QA` | switching of power circuits | contactor, power circuit breaker |
| `-QB` | disconnecting | main switch |
| `-SF` | manual operation | push-button, selector switch |
| `-XD` | terminal / connection for electric power and signals | terminal strip |

**Verify before use** (check against the current IEC 81346-2 edition and your E-CAD library – some codes
changed between the 2009 and 2019 editions):

| Code | Usually meant for |
|---|---|
| `-BF` | flow sensor |
| `-MB` | solenoid / electromagnetic actuator (valve coil) |
| `-QM` | valve in a fluid circuit (hydraulic / pneumatic directional valve) |
| `-PF` | indicator lamp, signal tower |
| `-TB` | power supply (AC/DC converter, 24 V DC) |
| `-TA` | transformer |
| `-WD`, `-WG` | cables (power / signal) |
| `-XG` | plug connector |

Numbering: running number per letter code inside one function: `-BG1`, `-BG2` … Use the **same designation**
in the schematic, the I/O list, the device label and the hydraulic/pneumatic circuit (valve `-QM4` in the
ISO 1219 diagram has coil `-MB4` in the electrical schematic).

**Terminals:** `<terminal strip>:<terminal number>` → `-XD1:12` = strip XD1, terminal 12. Separate strips per
voltage: `-XD1` 400 V AC, `-XD2` 24 V DC signals, `-XD3` safety circuits.

**Wire numbers:** potential/page based – `<page>.<column>` of the schematic where the wire starts, + running
letter if needed: `23.4`, `23.4a`. Print sleeve markers on both ends. Wire colours after IEC 60204-1 (usual
practice, verify in the standard):

| Conductor | Colour |
|---|---|
| Protective earth PE | green-yellow (only for PE!) |
| Neutral N | light blue |
| AC and DC power circuits | black |
| AC control circuits | red |
| DC control circuits | dark blue |
| Circuits that stay live when the main switch is off (external supply) | orange |

**Cable numbers:** `-W<nnnn>`, running number per cabinet/machine, with a cable list (`VC-ELE-CBL-0001`).

| Cable | From | To | Type | Length |
|---|---|---|---|---|
| `-W0123` | `=MCH.L2.HMC01 +CAB01 -XD2:31…34` | `+FLD.APC -BG12` (arm up sensor) | 4 × 0.34 mm², PUR, M12 | 8 m |

The cable label at **both ends** shows: cable number + "to" designation (`-W0123 → +FLD.APC-BG12`).

---

### 3.13 Network: IP addresses, host names, VLANs

The zone/VLAN plan is defined in guide 07 (5.x, IEC 62443 zones). The project scheme is:

**IP address:** `10.<VLAN>.0.<host>` – the second byte equals the VLAN number, so every technician can see the
zone from the address.

| VLAN | Name (switch config) | Zone | Subnet |
|---|---|---|---|
| 10 | `ENT-OFFICE` | enterprise IT (ERP, office) | 10.10.0.0/16 |
| 20 | `DMZ` | between IT and OT | 10.20.0.0/24 |
| 30 | `OT-L3-OPS` | MES, WMS, MQTT broker, historian | 10.30.0.0/24 |
| 40 | `OT-L2-SUP` | SCADA, HMI clients, fleet manager, twin | 10.40.0.0/24 |
| 51 | `OT-L1-MCH-L2` | crankcase FMS cell | 10.51.0.0/24 |
| 52 | `OT-L1-MCH-L1L3` | cylinder + crankshaft lines | 10.52.0.0/24 |
| 53 | `OT-L1-ASM-TST` | assembly, robot, test benches | 10.53.0.0/24 |
| 54 | `OT-L1-LOG-ASRS` | AS/RS crane PLCs | 10.54.0.0/24 |
| 60 | `OT-L1-AGV-WIFI` | AGVs (own SSID) | 10.60.0.0/24 |

**Host ranges inside each /24:**

| Host | Use |
|---|---|
| `.1` | gateway / firewall |
| `.2`–`.9` | switches, access points |
| `.10`–`.49` | PLCs, safety PLCs |
| `.50`–`.99` | CNCs, robot controllers, drives, AGVs |
| `.100`–`.149` | HMIs, industrial PCs, servers |
| `.150`–`.199` | I/O stations, cameras, printers, scanners, power meters |
| `.200`–`.239` | reserve |
| `.240`–`.254` | commissioning / service laptops (fixed, documented) |

No DHCP in OT cells – every device has a fixed, documented address (IP list in `VC-ITS-NET-0001`).

Examples: `PLC-01` → `10.51.0.11` (the twin example in guide 05 shows `192.168.10.11`; same host number),
`HMC-01` CNC → `10.51.0.51`, `AGV-01` → `10.60.0.51`, SCADA server → `10.40.0.100`.

**Host names (DNS / device name):** `vc-<area>-<device>` in **lower case** (DNS rule: letters, digits, hyphen;
max. 63 characters): `vc-mch-plc01`, `vc-mch-hmc01-cnc`, `vc-log-agv01`, `vc-ops-mes01`, `vc-sup-scada01`.
PROFINET device names follow the same text (`vc-mch-hmc01-io1`).

---

### 3.14 NC programs, tools, gauges, software versions

#### NC program numbers (Fanuc-style O-numbers + file name)

`O<p><k><oo>`: `p` = product family, `k` = part, `oo` = operation / 10.

| Digit | Values |
|---|---|
| `p` | `1` VC10 · `2` VC20 · `3` VC30 · `5` factory equipment parts (APC, AGV, HMC) · `8`–`9` subprograms, macros (often write-protected in the control) |
| `k` | `1` crankcase · `2` cylinder · `3` crankshaft · `4` cylinder head · `5`–`9` others |
| `oo` | operation number / 10: OP10 → `01`, OP20 → `02` |

Example **`O2102`** = VC20, crankcase, OP20. File name on the DNC server:
`<part number>_<OP>_<machine type>_<drawing rev>.nc` → `VC-PRD-CC-0020_OP20_HMC_C.nc`. The program header
comment repeats part number, drawing revision, program version (`v1.4.0`), author, date (ISO 8601).

#### Tool numbers

`T<f><nnn>` – 4 digits, `f` = tool family:

| `f` | Family | Example |
|---|---|---|
| 1 | drills | `T1203` drill Ø10.2 (for M12 thread) |
| 2 | end mills | `T2016` end mill Ø16 |
| 3 | face mills | `T3063` face mill Ø63 |
| 4 | taps, thread mills | `T4012` tap M12 |
| 5 | boring tools | `T5052` fine boring Ø52 |
| 6 | reamers | `T6020` reamer Ø20 H7 |
| 7 | turning tools | `T7001` |
| 8 | grinding wheels | `T8001` |
| 9 | probes, special tools | `T9001` spindle probe |

The **individual tool assembly** (one physical holder + cutter, with its measured length/radius) gets
`T<nnnn>-<nn>`: `T1203-01`, `T1203-02` (sister tools). Tool number ≠ magazine pocket (random tool change).
Tool data per ISO 13399 if your presetter/CAM supports it.

#### Gauge IDs

`GA-<type>-<nnnn>` – engraved or label, plus calibration label with the next due date.

| Type | Gauge | Example |
|---|---|---|
| `MIC` | micrometer | `GA-MIC-0012` |
| `CAL` | caliper | `GA-CAL-0031` |
| `PLG` | plug gauge | `GA-PLG-0045` (Ø52 H7) |
| `RNG` | ring gauge | `GA-RNG-0007` |
| `THR` | thread gauge | `GA-THR-0020` |
| `DIA` | dial / bore gauge | `GA-DIA-0004` |
| `TQW` | torque wrench / screwdriver | `GA-TQW-0009` |
| `PRS` | pressure gauge / transducer (test bench) | `GA-PRS-0015` |
| `FLW` | flow meter (test bench) | `GA-FLW-0002` |
| `THM` | thermometer | `GA-THM-0006` |
| `CMM` | coordinate measuring machine | `GA-CMM-0001` |

Every measured value in the MES stores the gauge ID → if a gauge is found out of tolerance, you know which
parts to re-check.

#### Software and firmware versions (semantic versioning)

`MAJOR.MINOR.PATCH`, example `2.3.1`:

| Part | Increase when | Example |
|---|---|---|
| MAJOR | change that is **not compatible** (interface DB changed, MES must also change) | `2.3.1` → `3.0.0` |
| MINOR | new function, compatible | `2.3.1` → `2.4.0` |
| PATCH | bug fix only | `2.3.1` → `2.3.2` |
| `-rc1` | release candidate (FAT/commissioning, not production) | `3.0.0-rc1` |

Applies to PLC programs, HMI/SCADA projects, MES configuration, AGV software, the twin, NC macros. Keep a
version list per device (`PLC-01 v2.3.1`, `HMC-01 CNC firmware` as supplier gives it, `AGV-01 v1.2.0`).
**A safety program change always needs a new version and re-validation** (record the safety checksum / signature).

---

### 3.15 Date and time, YYWW

| Use | Format (ISO 8601) | Example |
|---|---|---|
| Date | `YYYY-MM-DD` | `2026-11-11` |
| Date + time, local | `YYYY-MM-DDThh:mm:ss±hh:mm` | `2026-11-11T08:30:00+01:00` |
| Date + time in databases, logs, messages | UTC with `Z` | `2026-11-11T07:30:00Z` |
| Week | `YYYY-Www` | `2026-W46` |
| Duration | `PTnHnMnS` | `PT90S`, `PT1H30M` |

Never write `11/12/26` – it means 11 December in some countries and 12 November in others.

**ISO week rules** (used for every `YYWW`):

1. A week starts on **Monday**.
2. Week 01 is the week that contains the **first Thursday** of the year (= the week with 4 January).
3. A year has 52 or 53 weeks.
4. The **ISO year** can differ from the calendar year at the year end. Use the ISO year in `YYWW`.

| Date | Weekday | ISO week | `YYWW` |
|---|---|---|---|
| 2025-11-10 | Monday | 2025-W46 | `2546` |
| 2025-11-16 | Sunday | 2025-W46 | `2546` |
| 2024-12-30 | Monday | **2025**-W01 | `2501` (not 2453!) |
| 2026-01-01 | Thursday | 2026-W01 | `2601` |
| 2026-11-11 | Wednesday | 2026-W46 | `2646` |
| 2026-12-31 | Thursday | 2026-W53 | `2653` |
| 2027-01-01 | Friday | **2026**-W53 | `2653` |

In software use the ISO-week function (Python `date.isocalendar()`, Excel `ISOWEEKNUM()` + ISO year,
SQL `ISO_WEEK`) – never "day of year ÷ 7". All servers and PLCs get time from one time server
(NTP; PTP/IEEE 1588 where µs are needed), see guide 07.

---

### 3.16 Labels and barcodes (GS1)

#### Which code where

| Object | Code | Content |
|---|---|---|
| Compressor part (crankcase) | GS1 DataMatrix, direct part mark (laser / dot peen) + plain text | serial (`21`), optional GTIN (`01`) |
| Machined part in process | DataMatrix on part or on the carrier `PAL-…` | serial |
| Box / crate (trade unit) | GS1-128 (or DataMatrix) label | GTIN (`01`), lot (`10`), production date (`11`), quantity |
| Pallet (shipping unit) | GS1-128 logistics label | SSCC (`00`), content GTIN (`02`), count (`37`), customer PO (`400`) |
| Storage location, carrier, gauge | Code 128 or DataMatrix (internal, no GS1 needed) | the ID text, e.g. `ASRS-RAW-A03-L2-S14` |
| Incoming material | supplier GS1-128 label + our lot label | own lot `LOT-…`, item, quantity |

#### GS1 Application Identifiers (AI) used in this project

| AI | Data | Length | Example |
|---|---|---|---|
| `(00)` | SSCC – serial shipping container code (pallet) | 18 digits, fixed | `095212345000012349` |
| `(01)` | GTIN of the trade item | 14 digits, fixed | `19521234567896` |
| `(02)` | GTIN of the items contained in a logistics unit | 14 digits, fixed | `09521234567899` |
| `(10)` | batch / lot number | up to 20 characters, variable | `LOT-CC20-2546-003` |
| `(11)` | production date `YYMMDD` | 6 digits, fixed | `251112` |
| `(21)` | serial number | up to 20 characters, variable | `VC20-2546-00123` |
| `(37)` | count of trade items in the logistics unit | up to 8 digits, variable | `12` |
| `(240)` | additional product identification by the manufacturer (our part number) | up to 30 characters, variable | `VC-PRD-CC-0020` |
| `(400)` | customer purchase order number | up to 30 characters, variable | `PO4711` |

Rules:

* The parentheses are only in the human-readable text, **not** in the barcode data.
* Put **fixed-length** AIs first. After a **variable-length** AI that is not the last one, a separator
  (FNC1, transmitted as ASCII 29 "GS") is required.
* GTIN and SSCC need a **GS1 company prefix** – your company must join GS1 (national GS1 office). Below,
  the prefix `952` is the GS1 prefix reserved for **demonstration examples** – never print it on real labels.

#### Worked example – GTIN check digit (mod 10)

GTIN-13 of the compressor VC20-300 (example): first 12 digits `952123456789`, check digit = ?

Method: from the right, multiply the digits alternately by **3** and **1** (rightmost digit × 3), add,
check digit = number needed to reach the next multiple of 10.

| Digit | 9 | 5 | 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Weight | 1 | 3 | 1 | 3 | 1 | 3 | 1 | 3 | 1 | 3 | 1 | 3 |
| Product | 9 | 15 | 2 | 3 | 2 | 9 | 4 | 15 | 6 | 21 | 8 | 27 |

Sum = 9 + 15 + 2 + 3 + 2 + 9 + 4 + 15 + 6 + 21 + 8 + 27 = **121** → next multiple of 10 = 130 →
check digit = 130 − 121 = **9** → GTIN-13 = **`9521234567899`**.

As 14 digits in AI `(01)`: add a leading `0` → `09521234567899` (the check digit stays the same).
A box of the same item with **indicator digit 1**: `1` + `952123456789` + new check digit → the sum changes
(121 + 1 × 3 = 124) → check digit **6** → `19521234567896`.
The SSCC uses the same method: `0` + `9521234` + `500001234` → check digit `9` → `095212345000012349`.

#### Worked example – part label of one compressor

Data: GTIN `09521234567899`, serial `VC20-2546-00123`, production date 12 Nov 2025, our part number.

Human-readable line:
```
(01)09521234567899(11)251112(21)VC20-2546-00123(240)VC-PRD-ASY-0002
```
Encoded data in the GS1 DataMatrix (`<FNC1>` = start character, `<GS>` = ASCII 29):
```
<FNC1>0109521234567899 11251112 21VC20-2546-00123<GS>240VC-PRD-ASY-0002
```
(spaces only for reading – there are no spaces in the code). `(01)` and `(11)` are fixed length → no
separator. `(21)` is variable and not last → `<GS>` before `240`.

Box label (GS1-128): `(01)19521234567896(10)LOT-CC20-2546-003(11)251112` + plain text "VC20-300
V-COMPRESSOR 20 m³/h – 1 pc".

Pallet label (GS1-128 logistics label): `(00)095212345000012349` (big, bottom of the label) +
`(02)09521234567899(37)12(400)PO4711` + ship-to address, gross weight, `SHP-2547-0021`.

**What goes on which label:**

| Label | Must have | Nice to have |
|---|---|---|
| Part (DPM) | serial, DataMatrix (≥ 12 × 12 mm on cast surface, test readability) | GTIN |
| Type plate (compressor) | manufacturer, model, serial, year, max. pressure, FAD, power, voltage, mass, conformity mark if required by law | DataMatrix with serial |
| Box | item, GTIN, lot, quantity, date | serial list |
| Pallet | SSCC, ship-to, content, count, weight | customer PO |
| Internal (location, carrier, gauge) | ID as text + barcode | – |

Check print quality with a verifier (grade C or better is usual for GS1 – agree with the customer).

#### RFID (EPC) basics

| Topic | Short explanation |
|---|---|
| HF 13.56 MHz (ISO/IEC 15693) | short range (cm), works well on metal with special tags → **pallets `PAL-…`, tool holders, fixtures** |
| UHF 860–960 MHz, EPC Gen2 (ISO/IEC 18000-63) | range metres, many tags at once → **crates `CRT-…`, transport pallets, finished goods** |
| EPC (Electronic Product Code) | the ID in the tag memory, structure defined by GS1 EPC Tag Data Standard |
| SGTIN-96 | GTIN + serial (product) |
| SSCC-96 | shipping unit |
| GRAI-96 | returnable asset (crates, transport pallets) |
| GIAI-96 | individual asset (machine, tool, fixture) |

For internal carriers a simple rule works: write the ID text (`PAL-0007`) into the user memory of an HF tag;
use EPC/GS1 encoding only for items that leave the factory. Use metal-mount tags on steel; test the read
point before ordering many tags.

---

### 3.17 Traceability – what to record at each step

| Step (station) | Record | Link |
|---|---|---|
| Goods receipt | own lot, supplier lot, heat no., 3.1 certificate PDF, PO, quantity, incoming inspection result | lot ↔ heat ↔ PO |
| Load station `LOAD-CC` | serial assigned + marked, WO, casting lot, pallet `PAL-…`, fixture, time | **serial ↔ WO ↔ lot** |
| Each machining operation (`HMC-0x`, `VMC-01` …) | station, NC program + version, tools used (`T…-nn`), start/end time, alarms, operator | serial ↔ program ↔ tool |
| Washing | station, time, bath temperature/concentration (per shift) | serial |
| In-process measurement | characteristic, value, gauge ID, OK/NOK | serial ↔ gauge |
| Pump assembly `ASSY-01` | cylinder lot(s), crankshaft lot/serial, valve plate lot, torque values + tool ID | serial ↔ component lots |
| Test bench `TEST-0x` | FAD, pressure, power, temperature, noise, pass/fail, bench + gauge IDs, recipe version | serial ↔ test result |
| Paint | paint lot, booth, time | serial ↔ paint lot |
| Final assembly `FINAL-01` | tank serial/lot, motor serial, pressure switch, safety valve lot | serial ↔ tank/motor |
| Packing / shipping | box/pallet (SSCC), SO, customer, ship date | serial ↔ customer |
| NCR (any step) | NCR no., reason code, disposition (scrap/rework/use as is), approver | NCR ↔ serial/lot |

**Retention time (example – check customer contracts and local law):**

| Record | Keep for (example) |
|---|---|
| Product records per serial (genealogy, test results, NCR) | 10 years after delivery |
| Pressure-vessel related records (tank, safety valve, pressure test) | as required by the local pressure-equipment law – often ≥ 10 years |
| Material certificates 3.1 | 10 years after the last product made from the lot |
| Drawings and ECNs (all revisions) | life of the product + 10 years |
| Calibration records | 10 years |
| Raw machine data (high-frequency historian) | 1–2 years, aggregated data 10 years |
| Safety validation records of factory machines | life of the machine |

---

### 3.18 Full example – from a compressor serial back to the casting heat

A customer reports a crack in the crankcase of compressor **`VC20-2546-00123`**. Quality must find the casting
heat and all other compressors from the same heat.

| Step | Question | System / record | Answer (example) |
|---|---|---|---|
| 1 | Which product is this? | type plate / DataMatrix | `(21)VC20-2546-00123` → model VC20, serial assigned in week 2025-W46 |
| 2 | When and where was it shipped? | ERP shipment | `SHP-2547-0021`, pallet SSCC `095212345000012349`, sales order `SO-2546-0002` (customer Alpha Tools) |
| 3 | Which work order? | MES genealogy | `WO-2546-0004` (20 × VC20) |
| 4 | Which crankcase casting? | MES record of `LOAD-CC`, 2025-11-12T09:41:05Z | casting lot `LOT-CC20-2546-003`, pallet `PAL-0007`, fixture `FIX-0003` |
| 5 | Where did the lot come from? | ERP goods receipt | received 2025-11-10 on `PO-2545-0011` from Foundry A, supplier batch `F-88213`, 120 pcs |
| 6 | Which heat? | lot record + certificate `LOT-CC20-2546-003_3.1.pdf` (EN 10204 3.1) | heat **`H41137`**, EN-GJL-250, tensile strength and hardness values in the certificate |
| 7 | Was anything unusual in production? | MES: machining, test, NCR | HMC-02, `O2102 v1.4.0`, no alarms; test `TEST-01` FAD 20.3 m³/h pass; no NCR |
| 8 | Which other units contain heat `H41137`? | MES query: all lots with heat H41137 → all serials with these lots | lots `LOT-CC20-2546-003` and `LOT-CC20-2547-001` → 214 serials: 160 shipped (list of customers), 38 in finished-goods stock, 16 in production |
| 9 | Action | NCR + containment | `NCR-2548-0002`: block stock (`ASRS-FG` locations listed by MES), inform foundry (8D), decide on customer action |

The chain in one line:

```
VC20-2546-00123 → WO-2546-0004 → LOT-CC20-2546-003 → PO-2545-0011 → Foundry A batch F-88213 → heat H41137 (3.1)
            ↘ SHP-2547-0021 / SSCC 095212345000012349 → SO-2546-0002 → customer
```

If the MES can answer steps 1–8 in **less than one hour**, your traceability works. Test it with a
**recall drill** every 6 months (guide 04).

---

## 4. Model / calculations

| Calculation | Formula | Example |
|---|---|---|
| Capacity of a 5-digit weekly sequence | 99 999 per type per week | VC20 at 600 units/day × 6 days = 3 600/week → 3.6 % used |
| Capacity of a 4-digit order sequence | 9 999 per prefix per week | WO per week typically < 100 |
| Drawings per group | 9 999 per area + group | enough; if not, open a new group |
| GTIN check digit | (10 − (Σ digit·weight mod 10)) mod 10, weights 3,1,3 … from right | `952123456789` → 9 |
| Luhn check digit | double every 2nd digit from right, −9 if > 9, sum, (10 − sum mod 10) mod 10 | `254600123` → 7 |
| Analog address of station block b, channel c | `%IW(64 + 16·(b−1) + 2·c)` | b = 2, c = 0 → `%IW80` |
| First digital input byte of block b | 10·b | b = 2 → `%I20.0` |
| IP of a device | `10.<VLAN>.0.<host>` | PLC-01 in VLAN 51, host 11 → `10.51.0.11` |

---

## 5. Implementation in the real factory

1. **Freeze this guide** as `VC-QA-SPEC-0001-A` (numbering standard). Send it to every supplier with the
   order: "all drawings, labels, tags, designations according to VC-QA-SPEC-0001".
2. **Set up the number generators** in one place: PDM for drawings/documents, ERP for parts, lots and orders,
   MES for serials. Nobody creates numbers in Excel.
3. **Create the master lists**: equipment list (from `config/factory.json`), location list, IP list, tag list,
   alarm list, gauge list, tool list.
4. **Configure the label printers and laser markers** with the GS1 formats; verify the codes with a barcode
   verifier; test reading on the real cast surface.
5. **Join GS1** (national office) to get your company prefix before printing customer labels.
6. **E-CAD / PLC templates**: create the device designation and tag templates once; suppliers use them.
7. **Train** all designers, electricians, programmers and store staff (1 hour with this guide + examples).
8. **Audit** every new supplier delivery (drawings, schematics, PLC project) against this guide at FAT.
9. **Recall drill** before start of production: trace one serial back to the heat and one heat forward to
   all serials.

---

## 6. Checklists

**Design / documentation**
- [ ] Drawing number in title block and file name identical, revision correct
- [ ] Area and group codes from the tables, no invented codes
- [ ] Interface sheet `VC-IF-…` exists for every hand-over between suppliers
- [ ] Not-interchangeable change → new part number, not only new revision
- [ ] ECR/ECN recorded for every change after release

**Production / logistics**
- [ ] Serial assigned and marked at the **first** operation
- [ ] Lot record contains heat number and 3.1 certificate
- [ ] Every storage slot, carrier and gauge labelled and scannable
- [ ] GS1 check digits verified by the printer software, labels verified (grade)
- [ ] YYWW uses ISO year + ISO week

**Automation / IT**
- [ ] Equipment IDs identical in config, PLC, SCADA, MES, ERP, labels
- [ ] Tag names follow `<Area>_<Line>_<Machine>_<Signal>`, units in tag list
- [ ] Alarm IDs and texts in the alarm list
- [ ] Device designations identical in schematic, I/O list, device label, fluid circuit
- [ ] Cable labels at both ends; wire markers at both ends
- [ ] IP plan follows `10.<VLAN>.0.<host>`, no DHCP in cells
- [ ] Software versions recorded per device; safety program checksum recorded

---

## 7. Common mistakes / lessons learned

| Mistake | Effect | Avoid by |
|---|---|---|
| Re-using the serial of a scrapped part | two records for one number, traceability broken | serials are never re-used |
| Calendar year instead of ISO year in YYWW | `2453` and `2501` both appear for the same week, duplicates possible | ISO week function |
| Meaning in the running number ("0100–0199 = VC20") | numbering runs out, exceptions | meaning only in fixed fields |
| Hyphen in PLC symbol / tag name | not accepted by PLC or MQTT tools | drop hyphen (`HMC01`) |
| Letter `O` as revision | read as zero | skip I, O, Q, S, X, Z |
| Same screw with two BUY numbers | double stock, wrong reorder | search ERP before creating |
| Heat number not transferred when bar is cut | worm cannot be traced to the material | stamp heat no. at sawing |
| Labels printed with the GS1 demo prefix | customer scanners reject or mis-assign | own GS1 company prefix |
| Station named differently in PLC and MES | data cannot be linked | one equipment list |
| Variable-length GS1 field without separator in the middle | scanner merges two fields | fixed-length AIs first, `GS` after variable fields |

---

## 8. Limits of the twin

* The twin uses **short IDs** (`VC20-000012`, `WO-0012`, `CC20-L0009`, `NCR-00002`, `HMC-02.Temperature`).
  Map them to the real formats when connecting the twin to real systems.
* The twin does not print labels, does not encode GS1 or RFID data, and has no check digits.
* The twin has no PDM/ECR workflow, no BOM levels and no device designations.
* The twin does not model IP addresses or VLANs (guide 07 shows the plan only).

---

## 8a. Addenda – codes added while the topic guides were enriched (2026-11-11)

These codes were proposed by the topic guides (05, 06, 08, 10, 12) and are now **part of this scheme**.
They follow the same rules as chapter 3.

| Item | Format | Example | Used in guide |
|---|---|---|---|
| AS/RS area code (drawings, documents) | `LOG` area, group `ASR` | `VC-LOG-ASR-0001-A`, interface sheet `VC-IF-AGV-ASR-0001-A` | 03, 10 |
| Furnace charge (heat-treatment batch) | `HT-<YYWW>-<4 digits>` | `HT-2546-0012` | 12 |
| Bar material lot | `LOT-BAR<Ø>-<YYWW>-<3 digits>` | `LOT-BAR65-2546-002` | 12 |
| Matched worm pair | `P-<YYWW>-<5 digits>` = worm + wheel serials | `P-2546-00004` = `WRM-2546-00017` + `WHL-2546-00009` | 12 |
| Additional gauge types | `GA-AIR-`, `GA-WIR-` (3-wire set), `GA-HRD-` (hardness tester), `GA-GMM-` (gear measuring machine) + 4 digits | `GA-WIR-0003` | 12 |
| NC program for the worm | `O55<op/10, 2 digits>` | `O5508` = Op 80 thread grinding | 08, 12 |
| Cylinder product drawing / first program | `VC-PRD-CYL-0020-A` / `O2201` | – | 08 |
| Bus-device I/O address range | `%I(300 + 20·(b−1))` per station block b | block 2 → `%I320` | 05 |
| Alarm number ranges | `<Machine>_A<g><nn>`: group g = first digit; within a group, `xx` = device | `HMC01_A5104` | 05, 06 |
| SCADA screen IDs | `SCR-<Area>-<nn>` | `SCR-MCH-02` | 06 |
| SCADA client host / service accounts | `vc-sup-cl<nn>` / `svc-<system>` | `vc-sup-cl01`, `svc-historian` | 06 |
| Delivery notes | `SHP-<YYWW>-<4 digits>` | `SHP-2546-0031` | 04 |
| Kanban cards | `KB-<item>-<3 digits>` | `KB-CYL20-007` | 02 |
| Tool sets (HMC magazine set per model) | `TS-<machine>-<model>` | `TS-HMC01-VC20` | 02, 08 |
| Transport orders (AGV / crane) | `TO-<YYWW>-<4 digits>` | `TO-2546-0153` | 03 |
| VDA 5050 nodeId | = storage / station location code | `ASRS-RAW-A03-L2-S14`, `FLR-L2-LS01` | 03, 07 |

**Twin mapping:** the twin keeps its short IDs (`VC20-000012`, `WO-0012`, `CC20-L0009`, `W-0001`, `P-0001`, `O2001`).
In the real systems use the formats in this guide (`VC20-2546-00012`, `WO-2546-0012`, `LOT-CC20-2546-009`,
`WRM-2546-00001`, `P-2546-00001`, `O2102`).

## 9. Glossary

| Term | Meaning |
|---|---|
| AI | GS1 Application Identifier – number in parentheses that says what data follows, e.g. (10) = lot |
| BOM | bill of material – list of parts of an assembly, with levels |
| Check digit | extra digit calculated from the other digits to detect reading/typing errors |
| DPM | direct part marking – code laser-marked or dot-peened directly on the part |
| ECR / ECN | engineering change request / notice |
| EPC | Electronic Product Code – the ID stored in an RFID tag |
| GTIN | Global Trade Item Number – GS1 number for a product type (not a single unit) |
| Heat number | number of one melt of steel or iron; on the material certificate |
| ISO week | week Monday–Sunday; week 1 contains the first Thursday of the year |
| Lot | a group of parts with the same origin (one delivery, one heat) |
| Matched pair | two parts manufactured/adjusted together and only used together |
| MAKE / BUY | manufactured by us / bought from a supplier |
| Phantom | BOM level that exists only on the drawing, not in stock |
| Reference designation | IEC 81346 code for function (=), location (+) and product (−) |
| Semantic versioning | software version MAJOR.MINOR.PATCH |
| Serial number | unique number of one single unit |
| SSCC | Serial Shipping Container Code – GS1 number of one pallet / shipping unit |
| Tag | a named signal in PLC / SCADA / historian |
| YYWW | 2-digit ISO year + 2-digit ISO week, e.g. 2546 |
