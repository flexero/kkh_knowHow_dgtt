# FMS system design – guide book

General method to design, control and implement **any** flexible manufacturing system (FMS) in a real factory.
Web tab: **FMS engineering** (`http://localhost:8080/?feitem=1#fmse`). Offline programs: `tools/fmse/` (see
`tools/fmse/README.md`, check with `python tools/fmse/run_all_selftests.py`). All numbers in the guides are examples.

| No. | Guide | Status |
|---|---|---|
| 60 | [60_contract_fmse.md](60_contract_fmse.md) – plan of the 14 items, module standard, rules | living document |
| 61 | [61_fms_types_pipeline_modules.md](61_fms_types_pipeline_modules.md) – FMS types, project pipeline (owner + integrator), requirements, module standard | **textbook** (redo done) |
| 62 | [62_product_process_machines.md](62_product_process_machines.md) – product → process → machines | **textbook** (redo done) |
| 63 | [63_fms_elements_catalogue.md](63_fms_elements_catalogue.md) – elements of an FMS (20 elements) | **textbook** (redo done) |
| 64 | [64_capacity_layout_simulation.md](64_capacity_layout_simulation.md) – OEE, queueing, buffers, layout, simulation | **textbook** (redo done) |
| 65 | [65_control_architecture.md](65_control_architecture.md) – ISA-95, naming, ISA-88 / PackML, cell controller, alarms, message flows | **textbook** (redo done) |
| 66 | [66_communication.md](66_communication.md) – protocols, IP plan, security, module data block | **textbook** (redo done) |
| 67 | [67_electrical_safety.md](67_electrical_safety.md) – power distribution, cables, 24 V, cabinet, ISO 12100 / 13849 / 13855, safety zones | **textbook** |
| 68 | [68_module_circuits.md](68_module_circuits.md) – module library: 32 circuit patterns, complete circuits of M01–M22, kit, workflow (revised 2026-11-15: power cable sized per instance, zone safety outputs on SAFE01) | **textbook** |
| 69 | [69_plc_programming.md](69_plc_programming.md) – PLC programming principles: IEC 61131-3, scan and tasks (RTA), standard and device FBs, sequences inside PackML, data block, ISA-18.2 alarms, ST code generation from the circuit library, effort | **textbook** |
| 70A | [70_plc_library_A_standard_fbs.md](70_plc_library_A_standard_fbs.md) – PLC module library part A: program standard (decisions D1 command echo, D2 alarm numbers, D3 alarm classes, D4 homing) and the complete device FB library (real ST in tools/fmse/plc_lib, unit-tested with the soft PLC st_sim) | **textbook** (parts B modules and C cell controller follow) |

Drawings of the guides are in `img/`. Items 10–14 (PLC library, MES,
ERP, implementation, design kit) will be added to this folder as guides 70–74.
