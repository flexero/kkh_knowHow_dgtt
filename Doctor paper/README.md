# Doctor paper – guides of the doctoral research

This folder holds the guides of the doctoral research and of the real FMS control system `fmsctl/` it is built on.
The thesis text itself stays in `../thesis/` (chapters, PDF, Word file, code, figures) and paper 1 in `../research/`.
All other guides of the project stay in `../docs/` (start with `../docs/00_INDEX.md`).

| Guide | Content |
|---|---|
| [51_doctoral_research_roadmap.md](51_doctoral_research_roadmap.md) | Doctoral research roadmap: 8 steps, timeline, world level, the "Doctoral research" tab of the twin |
| [51_concept_note_supervisor.md](51_concept_note_supervisor.md) | 1-page concept note for the supervisor |
| [51_slr_protocol.md](51_slr_protocol.md) + [51_slr_extraction_template.csv](51_slr_extraction_template.csv) | Systematic literature review protocol (PRISMA 2020) and data-extraction template |
| [52_thesis_methods_guide.md](52_thesis_methods_guide.md) | Thesis methods in plain English (capacity model, Bayesian twin, staging, design science) |
| [53_fms_control_system.md](53_fms_control_system.md) | Textbook – FMS control item 1: architecture, Modbus TCP, register map V1.2, handshake, network, PLC code (Siemens / Delta), virtual commissioning |
| [54_fms_cell_controller.md](54_fms_cell_controller.md) | Textbook – item 2: cell controller, dispatching, queueing model (MVA) of the cell, HMI, alarms, KPIs |
| [55_tool_management.md](55_tool_management.md) | Textbook – item 3: tool wear, Taylor, tool economics, life statistics and reserve, Bayesian tool life, tool data flow |
| [56_agv_asrs_logistics_control.md](56_agv_asrs_logistics_control.md) | Textbook – item 4: AS/RS crane cycle (FEM 9.851), storage policies, AGV fleet sizing, battery, kanban |

Drawings of these guides are in `img/`. Software: `../fmsctl/` (tests: `python -m fmsctl.tests.test_item1` … `test_item4`).
