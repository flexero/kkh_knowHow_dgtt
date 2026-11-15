# Final doctoral thesis – combined FMS for the VC20 compressor and the Roots blower family

Started 2026-11-15. Plan of the work, items one by one. Status is updated after each item.

## 1 What this thesis is

**Working title.** *Design and implementation of a combined flexible manufacturing system for piston compressors and
Roots blowers in an emerging manufacturing industry – from part data to a ready-to-build material-flow system.*

**Products.**
- VC20 V-twin piston air compressor: 20 m³/h class, 8 bar, 300 L tank.
- Roots blower family RB50 / RB100 / RB150: tri-lobe, up to 500 mbar.

**Difference from editions 1 and 2** (`thesis/`, `thesis_modern/`). Those editions are about the twin, the communication
architecture and staged investment, with Roots only as Case 3. This final thesis is about **designing and building the
production system itself**:
- the products down to every part;
- the optimised FMS for a given production programme;
- AS/RS, load stations and conveyors, AGVs and barcode/RFID identification, each down to mechanics, 3D, circuits, PLC
  programs and communication.

The earlier editions are reused as sources: the Bayesian twin, the Modbus V1.2a interface and the fmsctl control
software. Any overlap must be declared.

> **One person defends one doctoral thesis.** Kenzo and the supervisor decide which thesis is defended. The earlier
> editions can also become the basis of the SCI papers.

**Research questions (draft).**
- **RQ1 – design method:** How can a multi-product FMS be dimensioned from part-level data with an optimisation method
  that remains valid when the production programme changes?
- **RQ2 – integrated material flow:** How should AS/RS, load stations, conveyors, AGVs and identification be designed and
  controlled as one system, so that the machining cell is never starved or blocked?
- **RQ3 – implementability:** How can such a system be proved ready to build and commission? This uses virtual
  commissioning against the real PLC programs, FAT/SAT procedures and documentation that a manufacturer can execute.

## 2 Items (one by one)

| Item | Content | Status |
|---|---|---|
| **F1** | **Products and parts**: full BOM of VC20 and RB50/100/150, part data (material, blank, mass, critical characteristics), routings with feature-based machining times, part families, performance checks, machine minutes per unit | **done** 2026-11-15 |
| F2 | **Production programme → optimised combined FMS**: editable programme (volumes, mix, ramp-up); machine counts by integer optimisation; cell formation; pallets and fixtures by queueing network (MVA); buffers; layout optimisation; investment and robustness; validation by discrete-event simulation | **done** 2026-11-15 |
| F3 | **AS/RS** for castings, finished parts and kits: rack (EN 15512), stacker crane, telescopic fork; drive sizing; 3D models; drawings; BOM; electrical schematics; I/O list; PLC program (S7-1500 SCL + Delta ST); WMS interface (Modbus V1.2a + HTTP); safety EN 528; commissioning (update of docs 31–39 + fmsctl logistics) | **done** 2026-11-15 |
| F4 (in work: F4.1–F4.5 done) | **Load stations and conveyors** (Case A + Case B comm.; sub-items F4.1–F4.7, guide 61): pallet load/unload stations (rotating / tilting table, clamping check), roller/chain conveyors, transfer units; drives; 3D; circuits; PLC; interface to the cell controller | planned |
| F5 | **AGVs**: vehicle design (chassis, drive, lift, battery, navigation, ISO 3691-4 safety); 3D; circuits; program; handshake with load stations and AS/RS; fleet control | planned |
| F6 | **Barcode and RFID identification**, one by one: numbering, GS1 / Data Matrix direct part marking, pallet RFID (ISO 15693), labels, readers, traceability database, encoder programs | planned |
| F7 | *(added)* **Fixtures and machine pallets**: modular / hydraulic fixtures FA, FC, FV1–FV6; zero-point system; clamping-force calculation; 3D | proposed |
| F8 | *(added)* **Safety system**: risk assessment ISO 12100, ISO 13849-1 PL calculation, safety PLC, fences / light curtains / scanners, emergency stop circuits | proposed |
| F9 | *(added)* **Factory and cell control integration**: fmsctl extended to both products (routings, recipes, kits), HMI, virtual commissioning / hardware-in-the-loop | proposed |
| F10 | *(added)* **Assembly lines and test benches**: VC20 and RB assembly stations, ISO 1217 test benches (instruments, program, report). Assembly and test are about **56 min per VC20** (31 assembly + 25 test), almost as much as all machining (64 min) | proposed |
| F11 | *(added)* **Utilities and installation**: power, compressed air, coolant and chips, foundations, network | proposed |
| F12 | *(added)* **Commissioning, FAT/SAT, maintenance, spare parts** | proposed |
| F13 | **Thesis text and build**: chapters from F1–F12, figures, PDF/DOCX (builder reused from `thesis/code/build_thesis.py`); papers from the results | at the end |

## 3 Delivery standard for every engineering item (F3–F12)

| Deliverable | Form (offline, open formats) |
|---|---|
| Textbook guide | `Doctor paper/5x_…md`: theory → formulas → standard → worked example from the program → manufacturing data → checks |
| Calculation program | `thesis_final/design/<item>/*.py`, Python standard library only, with `selftest` |
| Data | JSON (editable), CSV outputs |
| 3D models | parametric OpenSCAD source (`.scad`) + STL written by a standard-library Python generator. **SOLIDWORKS: import the STL as a reference, or rebuild natively from the dimension tables and drawings.** |
| Drawings | SVG, dimensioned, with title block, tolerances and material |
| BOM | CSV with make/buy, standard parts with norm designation, motor and drive type data |
| Electrical | SVG schematics (power, control, safety, PLC I/O), IEC 81346 device tags, I/O list CSV, cable list |
| PLC | IEC 61131-3 Structured Text: Siemens S7-1500 SCL + Delta AS ST; state machines; alarms |
| Communication | Modbus TCP register map V1.2a + HTTP JSON (edition 2: OPC UA / MQTT mapping) |
| Test | virtual device in `fmsctl/sim` style, test scripts, FAT/SAT check lists |
| Safety | risk table, required PL, safety functions |

**Honesty rule.**
- Every value is labelled design / reference estimate / calculated / simulated / measured.
- Drawings and circuits are engineering designs. They must be checked and released by the responsible engineer, and
  safety by a qualified person, before manufacturing.
- Prices and delivery times need real quotations.

## 4 Production programme (input of F2; Kenzo can change it)

Default, confirmed by Kenzo on 2026-11-15 ("continue with your values"). It is stored in `design/02_fms/fms_data.json`:

| Product | Volume per month at full rate | Mix | Ramp-up (months 1–4 of each stage) |
|---|---|---|---|
| VC20 | 3 000 | – | 40 % → 60 % → 80 % → 100 % |
| RB family | 400 | RB50 35 %, RB100 45 %, RB150 20 % | 40 % → 60 % → 80 % → 100 % |

Working time is the thesis assumption H = 330 h per month (two shifts). It will become a field in the F2 data file.

## 5 Progress log

- **2026-11-15 F1 done.**
  - `thesis_final/design/01_products/` holds `products.json`, `products.py` (25/25 self-test) and the `out/` folder:
    BOMs, routings, machine minutes, report, product trees.
  - The guide is `Doctor paper/58_final_products_and_parts.md`.
  - Findings that change earlier work:
    - RB100 needs a **3 kW** motor at 500 mbar, not 2.2 kW as in thesis Case 3.
    - The VC20 bore is **70 mm**, not Ø80 as in `fmsctl/spec/tooling.py`.
    - The VC20 dimension chain was corrected: deck 60, cylinder 85, piston compression height 31.9.
    - Machine minutes per unit (from `products.py minutes`):
      - VC20: HMC 11.9, VMC 27.6, lathe 9.0, assembly 31, test 25.
      - RB100: HMC 36.1, rotor milling 18.9, turn-mill 10.7, assembly 37, test 30.
- **2026-11-15 F2 done.**
  - `thesis_final/design/02_fms/` holds `fms_data.json`, `fms_design.py` (15/15 self-test) and the `out/` folder. Guide:
    `Doctor paper/59_final_fms_design.md`.
  - **Optimal design** (branch and bound + max-flow):
    - Machines: HMC 4, VMC 7, LATHE 2, TMILL 1, RMILL 1, 1 each of GRIND / HONE / LAP / IHARD / BAL / KEYS / WASH / CMM / PAINT.
    - Line: ASSY 8, TEST 6, PACK 2.
    - In total 40 machines and workplaces, 5.115 M EUR.
  - **Combined against two separate factories:** −7 machines, −1.215 M EUR (−19.2 %).
  - **HMC cell:** 1 load station, FA 4 + FC 2 pallets (MVA, confirmed by DES; recommend a 5th FA fixture).
  - **Robust design** (P ≥ 90 %): +ASSY, +TEST, +LATHE, +VMC = +305 kEUR.
  - **Layout:** spine 72 × 50 m = 3578 m² (−56 % transport). AGV estimate 4.
  - **People:** 23.8 direct operators per shift.
  - **Money:** total investment 16.8 M EUR (5.0 M EUR placeholders for F3–F12); NPV 51.8 M EUR; payback 2.0 years
    (reference estimates).
  - **Design-review corrections:**
    - Only real alternatives are kept (no rotor milling on the HMC, no VMC OP10 for tombstone parts).
    - MVA is only an approximation without product form, so the DES verifies it.
    - Dock node and the missing stores added to the layout.
    - Overheads, working capital and placeholders added to the economics.
- **2026-11-15 F3 done.**
  - `thesis_final/design/03_asrs/`:
    - `asrs_design.py` 16/16;
    - `asrs_3d.py` 24/24: STL + OpenSCAD, drawings D01–D05, dimension table;
    - `asrs_elec.py` 23/23: 57 devices, 140 I/O, 26 cables, P01–P10, safety SF1–SF7 PL d/c;
    - `plc/asrs_crane.scl` + `asrs_crane_delta.st` (not compiled – no TIA/ISPSoft here);
    - `asrs_sim.py` 30/30, the virtual crane over Modbus.
  - Guide: `Doctor paper/60_final_asrs.md`.
  - **Design:** one aisle RAW + KIT, 760 positions (19 bays × 10 levels × 2 sides), 14 m high-bay, rack
    36.7 × 12.6 × 4.1 m, crane 4419 kg, mast 600 × 400 × 6 (f₁ 1.93 Hz), SC 41.0 s / DC 67.9 s, utilisation 47 % at
    peak; drives 7.5 / 11 / 1.1 kW; supply 20 kVA.
  - **Decisions and corrections:**
    - one aisle instead of two (−360 kEUR incl. the 5th AGV);
    - high-bay 14 m, because the 3D model showed the top-rail ties at 13.35 m;
    - stiffer mast, because 500 × 350 was too soft at 13 m;
    - effective rail width in the wheel check;
    - layout optimiser now uses 6 restarts.
  - **Fed back into F2:** KIT merged into RAW, AS/RS cost 0.55 M EUR; F2 now has 5 AGVs, NPV 53.1 M EUR.
  - **fmsctl:**
    - register map V1.2b (commands 32/33, status 304–308, params 405–409);
    - `AllowedCmdsHi` in both PLC templates;
    - ASRS-RAW 38 × 10 with KIT/RAW zones;
    - tests still 21/15/11/15 (run as `python -m fmsctl.tests.test_itemN` with `PYTHONIOENCODING=utf-8`).
  - **Open:** the WMS does not yet use zones or relocate (F9); real-PLC test needs PLCSIM Advanced; the crane supplier
    must confirm z1 = 0.45 m.
- **2026-11-15 F3 Case B added (Kenzo: "another case when we use expansion communication modules").**
  - `03_asrs/asrs_comm.py` 29/29 + `comm_data.json`; outputs in `out/comm/` (report, CSVs, P11–P13).
  - PLC: `plc/asrs_comm_b.scl` (S7: MB_SERVER over the CP, FB_RtuPoller on the CM PtP) and `plc/asrs_comm_b_delta.st`
    (Delta: COM1 RTU poller, CANopen CiA 402 drives). Not compiled.
  - Guide: `Doctor paper/60_final_asrs.md` Part D.
  - **Results:**
    - Case A is enough with built-in ports.
    - B1 = CP 1543-1 + CM 1542-1 + CM PtP + **PS 60 W**, 4 270 EUR. The backplane is 13.7 W against 10 W from the CPU.
    - B2 = AS-FEN02 + AS-FCOPM + external firewall, 2 150 EUR. The PLC rides on the crane and the safety is hard-wired.
    - RS-485 at 19.2 kbit/s: worst round 153 ms. A dead device gives 277 ms, so a weighing window is used (34 ms).
    - CANopen load 33.5 %. The CP adds about 8 ms to the WMS latency.
    - **B1 is recommended for the real plant.** fmsctl does not change (same IP, same register map).
  - **Rule for F4–F13:** every item states its communication case, A (built-in ports) or B (expansion modules).
- **2026-11-15 F4 split into sub-items** (Kenzo: "in more detail one by one"):
  - F4.1 system definition and sizing; F4.2 conveyor module mechanics + 3D; F4.3 load stations (P&D, TU1 check, pick,
    HMC pallet load station); F4.4 assembly carrier line + tank feed; F4.5 electrics + safety (comm Case A/B);
    F4.6 PLC + virtual conveyor + fmsctl; F4.7 commissioning/FAT.
- **2026-11-15 F4.1 done.** `design/04_conveyors/conv_system.py` 22/22, `conv_data.json`, guide `Doctor paper/61` ch. 1–10.
  - **Crate flows:** 7 058 AGV crates/month instead of the F2 33 987 unit loads (real crate contents) -> F5 sizes the
    fleet with them.
  - **Tanks/motors** BUY -> ASY (3 200/month) do not fit a crate -> separate feed (F4.4).
  - **P&D stations** for FIN, VMC, ROT, HMC, QC, BUY, ASY by the Poisson 1 % rule; line-side crates 28, not 42 (one RB
    variant at a time).
  - **AS/RS front U-loop** (TU1 check + Z12–Z16, Z26–Z22 with TU3 + TU2, Z31 pick):
    - the DES found a deadlock -> rules R0–R4 (check on TU1);
    - one AGV pick-up place saturates -> TU3 added;
    - busiest hour: crane 49.9 %, AGV wait p95 14 s.
  - **Assembly:** 21 carriers, loop 100 m, Erlang C queue places.
  - **Modules and cost:** 584 kEUR (130 % of the 450 kEUR placeholder).
  - **Requirements for F5:** dispatch at crane start, arrival <= 240 s.
- **2026-11-15 F4.2 done.** `conv_mech.py` 19/19 (`conv_mech_data.json`) + `conv_3d.py` (3D STL/SCAD, drawings D11–D15);
  guide 61 ch. 11–21.
  - **Crate base:** 3 runners along 1200. Runners must cross the chains / rollers, so chain zones are 800-leading and
    roller zones 1200-leading at 1.4 m (F4.1 updated).
  - **CC:** 12B-1 (every chain passes; chosen for robustness), z15 d0 91.6, 0.18 kW i≈34, shaft d30 (torsion decides:
    strand synchronism), UCP206.
  - **RL/RCX:** rollers 60x2 (robustness minimum), 6204, chain-driven live roller 0.12 kW.
  - **TU:** eccentric lift 30 mm, 0.25 kW brake motor, self-locking.
  - **Frame:** C160, top 700 +-2. Stopping 44 mm.
- **2026-11-15 F4.3 done.** `load_stations.py` 29/29 (`ls_data.json`) + `stations_3d.py` (3D, D16–D20); F3 crate model now
  has 2 runners (crate base changed from 3 to 2 runners: F3 fork clash). Guide 61 ch. 22–35.
  - **A P&D station:** F5 needs deck levelling +-3 mm; handshake over an optical coupler, 4 interlock rules.
  - **B TU1 check:** limits 20 / 20 / 620 mm from the F3 rack; 500 kg cells; u 0.88 kg; guard band 298.2 kg; plausibility
    counts the heavy parts.
  - **C kitting:**
    - NIOSH sets the kit limit 5 kg and bins 8 kg;
    - 2 trolley places; crate visits 1 640/month (F3: 1 133); 94 s per visit;
    - AS/RS front simulated again: crane 56 %, stable.
  - **D flow racks:** one lane per part type (F4.1 single lane was not FIFO-usable), <= 3 places, entry 900 by the AGV lift, powered return, +57 kEUR.
  - **E HMC load station:** 0.12 kW index, Ø20 clamps, accumulator holds 655 min, utilisation 55.5 %, hoist (LI 1.62),
    light curtain S 680 mm.
- **2026-11-15 F4.4 done.** `asm_line.py` 19/19 (`asm_data.json`) + `asm_3d.py` (3D, D21–D25); guide 61 ch. 36–48.
  - **Carrier:** 1800 x 800, adapters VC20 / RB; the product slides first (3.9 m/s2), so the bumpers get 20 mm stroke
    (10 mm gave 4.0 m/s2).
  - **Working height:** P5 F..P95 M needs a carrier top of -90..705 mm, so the ASSY lift tables go in a 250 mm pit
    (100-800 mm, 25/27 cases).
  - **Accumulation chain:** 4 x 25 m sections, 0.75 kW each; stopper 910 N / 4.6 J; transfers 14 s, main line 9.6 %.
  - **Closed-loop DES:** N_min 18 carriers, decision 21, maximum 22 (queue space in front of ASSY and PACK).
  - **Feed:** tank rack 4 x 62 + 50 = 298 kg (AGV 300 kg); +2 550 AGV moves/month, so F5 sizes for ~9 600 moves/month.
  - **Balancers:** NIOSH gives 5 balancers (crankcase LI 1.50).
  - **Cost:** 488.6 kEUR incl. 2 personnel gate sections (the 3D model found the inner spurs enclosed by the loop); F4.1 had 300.7 kEUR.
- **2026-11-15 F4.5 done.** `conv_elec.py` 18/18 (`elec_data.json`, reuses F3 `asrs_elec` + `asrs_comm`) + `conv_elec_drw.py`
  (schematics E01–E08); guide 61 ch. 49–61.
  - **Drives:** DOL start too hard (light crate 31 m/s2, carrier 16 m/s2), so 165 decentralised drives with ramp + STO via
    PROFIsafe.
  - **Areas:** AF / PD (power bus 2.5 mm2, dU 1.65 %) / ASM (40 A, 5G10) / HMC.
  - **I/O:** DI 597, F-DI 130; 20 remote I/O stations.
  - **Comm:** Case A has no modules; Case B = CP 1543-1 + CM 1542-1 + CM PtP + PS 60 W (same set as the AS/RS); PN load
    15 % (B 7.5 %).
  - **Safety:** SF-C1..C7 all reach PLr; the AGV dock is a 1.4 m guarded tunnel (ISO 13855, requirement for F5); pit edge
    overrun 3 mm.
  - **Air:** about 9 NL/min.
  - **Cost:** Case A 320 kEUR, Case B +8.5 kEUR.
