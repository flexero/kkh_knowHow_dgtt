# fmsctl – FMS control system of the compressor factory

Real control software (not the twin's simulation) for the V-type compressor FMS: Modbus TCP to every machine PLC,
HTTP/JSON to MES, ERP and operator screens; Python standard library only (offline PC). Textbook guides: `Doctor paper/53_fms_control_system.md` (item 1), `Doctor paper/54_fms_cell_controller.md` (2), `Doctor paper/55_tool_management.md` (3), `Doctor paper/56_agv_asrs_logistics_control.md` (4).

```
fmsctl/
  spec/regmap.py        register map V1.2 (V1.1 + event block + device-type blocks)
  spec/plant.py         21 devices, IP plan, AGV nodes, design parameters (from config/factory.json)
  spec/out/*.csv        supplier register lists + device list (python -m fmsctl.tools.export_spec)
  core/modbus.py        Modbus TCP client + server
  core/device.py        typed access + toggle-bit job handshake
  sim/virtual_plant.py  21 simulated PLCs for virtual commissioning
  tests/test_item1.py   acceptance test of item 1 (20 checks)
  plc/*.scl, plc/*.st   PLC templates of the V1.2 interface: Siemens S7-1200/1500 (SCL) and Delta AS (ST) – not yet compiled
  cell/controller.py    FMS cell controller (item 2): polling, job completion, dispatching (EDD / FIFO), fixtures, recovery
  cell/db.py            SQLite persistence (pallet content, work orders, jobs, events)
  cell/server.py        HTTP API + operator screen (web/cell.html), port 8090
  tests/test_item2.py   acceptance test of item 2 (15 checks)
  spec/tooling.py       tool types, magazine, tool list per NC program [example]
  tooling/manager.py    tool management (item 3): tool check before a job, change requests, presetter import, command 14
  web/tools.html        setter screen (/tools)
  tests/test_item3.py   acceptance test of item 3 (11 checks, A/B with and without tool check)
  logistics/manager.py  AS/RS warehouse management + AGV fleet + castings kanban + finished goods (item 4)
  web/logistics.html    logistics screen (/logistics)
  tests/test_item4.py   acceptance test of item 4 (15 checks)
```

| Item | Content | Status |
|---|---|---|
| 1 | interface specification, Modbus driver, virtual plant | done – 20 / 20 checks |
| 2 | FMS cell controller + operator screen | done – 15 / 15 checks |
| 3 | tool management + setter screen | done – 11 / 11 checks |
| 4 | AGV fleet manager + AS/RS warehouse management | done – 15 / 15 checks |
| 5–10 | MES, ERP link, PLC programs + HIL, safety concept, commissioning, Roots blower | planned |

Windows console: set PYTHONIOENCODING=utf-8 before running the tests.

Run (from the project root): `python -m fmsctl.cell.server --virtual` then open http://localhost:8090/ · tests: `python -m fmsctl.tests.test_item1` … `test_item4`.
All values are examples until the machine suppliers confirm them.
