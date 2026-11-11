# Guide Book – V-Compressor Smart Factory

This folder is the **guide book** for the whole project: from the digital twin of the factory down to the
machine parts you will manufacture yourself. Each guide explains a topic so that you and your team can
**understand it** and **build it correctly in the real factory**.

> **All numbers in these guides are example values.** Replace them with real data from your suppliers,
> catalogues, drawings and measurements before you order, manufacture or program anything.

---

## 1. The guides

| No. | File | Topic | Where in the twin (browser tab) | Main source files |
|---|---|---|---|---|
| 00 | `00_INDEX.md` | This index, reading order, conventions | – | – |
| 01 | `01_digital_twin_core.md` | What the twin is, the simulation engine, OEE, historian, 3D view, what-if, adapting the twin to your factory, connecting real machines, API | Live factory, What-if simulation, How it works | `server.py`, `twin/engine.py`, `twin/model.py`, `twin/analytics.py`, `twin/historian.py`, `config/factory.json` |
| 02 | `02_fms_and_order_flow.md` | Flexible manufacturing (3 models on the same machines), changeovers, kanban, dispatching rules, one customer order from ERP to shipping | FMS & products, Order flow | `twin/fms.py`, `web/ops.js` |
| 03 | `03_material_handling.md` | AGVs, AS/RS, pallet pool, transport – sizing and implementation | Live factory (material handling) | `twin/handling.py` |
| 04 | `04_mes_and_erp.md` | MES (work orders, traceability, SPC, quality, maintenance) and ERP (sales, MRP, purchasing, stock, cost) | MES, ERP | `twin/mes.py`, `twin/erp.py` |
| 05 | `05_plc_control.md` | PLC network, I/O, ladder logic, handshakes, step chains, E-stop, safety | FMS → PLC control | `twin/plc.py`, `web/plc.js` |
| 06 | `06_scada.md` | SCADA: mimic, faceplates, tags, alarm management (ISA-18.2), trends, audit trail, shift report | SCADA | `twin/scada.py`, `web/scadatab.js`, `web/scada.js` |
| 07 | `07_communication.md` | How all layers talk: ISA-95, OPC UA, MQTT, VDA 5050, B2MML, EDI, 4–20 mA, IO-Link; real example messages | Communication | `twin/comm.py`, `web/comm.js`, `web/commsim.js`, `web/commproto.js` |
| 08 | `08_cnc_gcode.md` | CAM → G-code → CNC: operations, controller simulation, alarms, cutting data, prove-out on the real machine | CNC / G-code | `web/gcode.js` |
| 09 | `09_pallet_changer_apc.md` | Design and build of the 2-pallet rotary pallet changer (APC), hydraulics, zero-point clamping, PLC sequence | Pallet changer | `web/apc.js`, `web/apc3d.js` |
| 10 | `10_mechanical_interfaces.md` | Interfaces you manufacture: pallet transfer AGV/cart ↔ APC station, crate docking stand, AS/RS ↔ AGV, load station ↔ APC | Mechanical elements 1–4 | `web/mech.js`, `web/mech2.js`, `web/mech3.js`, `web/mech4.js` |
| 11 | `11_agv_build.md` | Build your own AGVs: underride crate AGV, servo drive control, 1 t pallet AGV, docking accuracy | AGV build 1–4 | `web/agv.js`, `web/agvdrive.js`, `web/agvpallet.js`, `web/agvdock.js` |
| 12 | `12_hmc_build.md` | HMC parts: rotary table with duplex worm drive (machining + assembly), worm manufacturing process twin (saw → inspection → test bench) | HMC build 1–2 | `web/hmc.js`, `web/wormmfg.js` |
| 13 | `13_real_factory_roadmap.md` | How to bring everything into the real factory: phases, responsibilities, standards, acceptance tests, master checklist | – | – |
| 14 | `14_engineering_reference_data.md` | Shared reference tables: materials (EN grades + properties), heat treatment, hardness conversion, ISO 286 fits with numbers, general tolerances, surface roughness, bolt torques, welding, cutting data, hydraulics, electrical, measuring, safety distances | – | – |
| 15 | `15_numbering_and_identification.md` | ONE project-wide scheme: drawing / document / part numbers, serial numbers, lots, work orders, machine IDs, storage locations, tag names, I/O addresses, device designations, labels + barcodes (GS1), traceability | – | – |
| 16 | `16_standards_register.md` | Register of all standards used (what each requires for this project, which guide uses it, priority list to buy) | – | – |

The main `README.md` in the project root is the short technical overview (how to start the server, all tabs, API).

---

## 2. Reading order

**If you are new to the project:**
1. `01_digital_twin_core.md` – the big picture and how to run the twin.
2. `13_real_factory_roadmap.md` – how the pieces fit into the real project.
3. Then the guide of the topic you are working on.

**By job:**

| You work on … | Read |
|---|---|
| Factory layout, capacity, investment decision | 01 → 02 → 03 |
| Production planning, IT systems | 04 → 07 → 02 |
| Automation, electrical, controls | 05 → 06 → 07 |
| Machining, NC programming | 08 → 12 |
| Mechanical design and manufacturing | 09 → 10 → 11 → 12 |
| Logistics, AGVs, warehouse | 03 → 10 → 11 |
| Commissioning and acceptance | 13 (master checklist) + section "Checklists" of every guide |
| Drawings, part lists, labels | 15 → 14 → 16 |

---

## 3. How every guide is built

All guides use the same chapters, so you always know where to look:

| Chapter | Content |
|---|---|
| 1 Purpose | What it is and why the real factory needs it |
| 2 Where in the twin | Tab, files, deep links, how to use the page |
| 3 Concepts | The ideas explained simply |
| 4 Model / calculations | Formulas written out with the example numbers |
| 5 Implementation in the real factory | Step by step: specify, make or buy, install, commission, test |
| 6 Checklists | Tick-off lists for design, installation, commissioning |
| 7 Common mistakes / lessons learned | Errors we found while building the twin – avoid them in reality |
| 8 Limits of the twin | What is simplified, what you must still check in reality |
| 9 Corrections / how to use 10–15 | Corrections of earlier text and errors found in the twin, or a short reading note for chapters 10–15 |
| 10 Science principles | The physics / engineering laws behind the topic, derived simply with numbers |
| 11 Detailed specification | Materials, heat treatment, fits with numbers, Ra, geometric tolerances, bolts + torques, welds, inspection – or for software: data fields, parameters, sequence tables |
| 12 Identification + numbering | Drawing, part, serial, tag and address numbers for this topic (scheme in guide 15) |
| 13 Standards | What each standard requires for this topic (full register in guide 16) |
| 14 Complete worked example | One end-to-end example with every number |
| 15 Data still needed | What you must still get from suppliers or measure yourself |
| last: Glossary | Short explanation of terms and abbreviations |

---

## 4. Conventions

- **Units:** SI (mm, N, N·m, kW, s, °C). Angles in degrees; rotary table accuracy in arc seconds (″).
- **Example values** are marked as such. The twin pages have a button **"Example values"** that restores them.
- **MAKE / BUY:** MAKE = you manufacture it; BUY = catalogue part or supplier.
- **Deep links** open a page in a given state, e.g. `http://localhost:8080/?hritem=2&wmop=80#hmc`.
- **Offline:** the twin runs on a factory PC without internet (stdlib Python, local libraries).
- **Standards** are named for orientation. Always work with the current edition of the standard and your
  local regulations; your safety engineer must approve all safety functions.

---

## 5. Most important rules (from the whole project)

1. **Ask first: "What accuracy does the real vehicle / machine have?"** before you design any mechanical
   interface. An AGV stops only ±5–10 mm – design coarse-to-fine catching (guides → cones → receivers).
2. **Rough → stress relief → finish.** One set-up for everything that must fit together. Measure at 20 °C.
3. **Every rule in planning and logistics must be per product model**, not global.
4. **Safety is designed, not added:** safety distances (ISO 13855), safety PLC, light curtains, E-stop,
   AGV safety fields (ISO 3691-4) – planned from the start and validated at commissioning.
5. **Write interface sheets** (mechanical, electrical, signals, messages) for every hand-over between
   suppliers – most problems in real factories happen at interfaces.
6. **Test with the twin before the real machine** (virtual commissioning), then FAT at the supplier and SAT
   in your factory.
7. **Keep a record for every part** (traceability: serial, material heat, measured values, test results).
