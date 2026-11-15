# thesis_final – final doctoral thesis: combined FMS for the VC20 compressor and the Roots blower family

The plan, the items and their status are in [00_final_thesis_plan.md](00_final_thesis_plan.md).

## Folder map

| Path | Item | Content |
|---|---|---|
| `00_final_thesis_plan.md` | – | title, research questions, items F1–F13, delivery standard, production programme, progress log |
| `design/01_products/` | F1 | `products.json` (master data), `products.py` (program), `out/` (BOMs, routings, machine minutes, report, product trees) |
| `design/02_fms/` | F2 | `fms_data.json` (programme + machine catalogue), `fms_design.py` (program), `out/` (report, machines, flows, layout, cell chart) |
| `design/03_asrs/` | F3 | AS/RS: `asrs_design.py` (sizing), `asrs_3d.py` (STL/SCAD + drawings), `asrs_elec.py` (I/O, cables, schematics, safety), `plc/` (SCL + Delta ST), `asrs_sim.py` (virtual crane, Modbus), `asrs_comm.py` (Case B: expansion comm. modules, RS-485/CANopen, firewall), `out/` |
| `design/04_conveyors/` | F4 | load stations + conveyors, in sub-items F4.1–F4.7: `conv_system.py` (F4.1 system definition, lane sizing, AS/RS front DES, assembly carriers, module list), `conv_mech.py` + `conv_3d.py` (F4.2 module mechanics, 3D, drawings), `load_stations.py` + `stations_3d.py` (F4.3 load stations), `asm_line.py` + `asm_3d.py` (F4.4 assembly line), `conv_elec.py` + `conv_elec_drw.py` (F4.5 electrics/safety/comm), `out/` |
| `design/05_…` | F5 … | *(planned)* AGV, barcode/RFID, … |

Guides (textbooks) for each item are in `../Doctor paper/` from number 58 on.

## Reproduce

Python 3 standard library only, fully offline:

```
cd thesis_final/design/01_products
python products.py selftest      # SELFTEST PASS (25/25)
python products.py run           # regenerates out/
cd ../02_fms
python fms_design.py selftest    # SELFTEST PASS (15/15)
python fms_design.py run         # regenerates out/ (report.md, layout.svg, ...)
cd ../03_asrs
python asrs_design.py selftest   # 16/16, then: python asrs_design.py run
python asrs_3d.py selftest       # 24/24, then run
python asrs_elec.py selftest     # 23/23, then run
python asrs_sim.py selftest      # 30/30 (virtual crane over Modbus)
python asrs_comm.py selftest     # 29/29 Case B: expansion communication modules, then run
cd ../04_conveyors
python conv_system.py selftest   # 22/22 F4.1, then: python conv_system.py run
python conv_mech.py selftest     # 19/19 F4.2 module mechanics, then run
python conv_3d.py selftest       # F4.2 3D models + drawings D11-D15, then run
python load_stations.py selftest # 29/29 F4.3 load stations, then run
python stations_3d.py selftest   # F4.3 station 3D + drawings D16-D20, then run
python asm_line.py selftest      # 19/19 F4.4 assembly carrier line, then run
python asm_3d.py selftest        # F4.4 3D + drawings D21-D25, then run
python conv_elec.py selftest     # 18/18 F4.5 electrics, safety, comm Case A/B, then run
python conv_elec_drw.py selftest # F4.5 schematic pages E01-E08, then run
```

## Data labels

- All values are **design values** or **reference estimates**. None is measured.
- Every part in `products.json` carries its label in the field `data`.
- Replace the values with quotations, CAM times and measured cycle times when you have them. The doctoral twin then
  updates them, using F1 as its prior.
