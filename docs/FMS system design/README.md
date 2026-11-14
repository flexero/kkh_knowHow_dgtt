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
| 64 | [64_capacity_layout_simulation.md](64_capacity_layout_simulation.md) – OEE, queueing, buffers, layout, simulation | first version – textbook redo planned |
| 65 | [65_control_architecture.md](65_control_architecture.md) – ISA-95, hierarchy, PackML, message flow | first version – textbook redo planned |
| 66 | [66_communication.md](66_communication.md) – protocols, IP plan, security, module data block | first version – textbook redo planned |

Drawings of the guides are in `img/`. Items 7–14 (electrical and safety, circuit library, PLC principles, PLC library, MES,
ERP, implementation, design kit) will be added to this folder as guides 67–74.
