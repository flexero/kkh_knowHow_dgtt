# Machine + program software + control system design

Engineering reference and calculation programs for designing machines end to end:
**1. Mechanical design** → **2. Program software** (machine / PLC / HMI software) → **3. Control system design**.
Built one item at a time. Everything runs **offline** (Python standard library, MATLAB optional).
All numbers in the guides are **example values**.

## Field 1 – Mechanical design (`01_mechanical_design/`)

| Item | Guide | Program | Status |
|---|---|---|---|
| M1 Design method – Part A pipeline S0–S9 + Part B deep reference ch. 17–33 (requirements, TRIZ, AHP/FMEA, embodiment, materials, DFM/cost, tolerances, strength, fatigue/FKM, reliability, FEA/MBD V&V, optimisation, DOE, topology/robust, testing, release/quality) | `01_design_method.md` | `tools/dm_toolkit.py`, `dm_req.py`, `dm_embody.py`, `dm_strength.py`, `dm_opt.py` | done |
| M2 Crank mechanism – theory + program combined: geometry, exact kinematics, compressor p-V cycle + FAD, masses, forces, torque + flywheel, balancing + mounts, loads for shaft/bearings/rod/pins, manufacturing tolerances, SOLIDWORKS Motion / Adams verification, worked design to 20 m³/h | `02_crank_mechanism.md` | `tools/crank.py` (`run` → report + CSV + SVG charts; `selftest`), `tools/crank.m` (MATLAB mirror) | done |
| M2b Four-bar linkage – theory + program combined: Grashof / mobility / toggle, position (circle intersection + Freudenstein), velocity, acceleration, instant centres, transmission angle, coupler curves + cognates + straight-line + dwell, synthesis (3-position motion, quick return, Freudenstein function generation + defects + optimisation), **path generation for a required track** (exact 3 points with timing, N-point GA + Nelder–Mead with constraints → `fourbar.py path`), Newton–Euler dynamics, Berkof–Lowen balancing, link + joint design, tolerances, MBD verification, swing-arm application | `02b_four_bar_linkage.md` | `tools/fourbar.py` (`run` → report + CSV + SVG; `selftest`), `tools/fourbar.m`, `tools/examples/swing_arm.json` | done |
| M3 Shaft design – theory + program combined: layout + manufacturing route + drawing spec, loads (hand-over from M2, belt, gears), moments in two planes, stepped-shaft deflection / slope / twist, critical speed (Rayleigh, Dunkerley, bearing stiffness, Jeffcott), torsional 2-mass, notches (Kt fits, support number, keyway, press fit, cross hole, DIN 509), DIN 743 style static + fatigue proof, sensitivity + Shigley / FKM comparison, crank-web fillet, feather keys, interference fits (Lamé, fits, press-in / shrink), splines, inspection, FEA verification, lighter redesign | `03_shaft_design.md` | `tools/shaft.py` (`run` → report + CSV + SVG; `selftest`), `tools/shaft.m`, `tools/examples/shaft_redesign.json`; web item 6 | done |
| M4 Rolling bearings (ISO 281) | – | `bearing.py` | next |
| M5 Gears (ISO 6336 + manufacturing data) | – | `gear.py` | planned |
| M6 Cams (VDI 2143) | – | `cam.py` | planned |
| M7 Bolted joints (VDI 2230) | – | `bolt.py` | planned |
| M8 Springs (EN 13906) | – | `spring.py` | planned |
| M9 Belts, chains, couplings | – | `drive.py` | planned |
| M10 Tolerances, fits, stack-up | – | `tol.py` | planned |
| M11 Welds, frames, pressure parts | – | `weld.py`, `vessel.py` | planned |
| M12 Optimisation workflows with SOLIDWORKS / Ansys / Abaqus / Adams + MATLAB | – | scripts | planned |

## Field 2 – Program software (`02_program_software/`) – later
## Field 3 – Control system design (`03_control_system_design/`) – later

## In the digital twin – tab **M_P_C tools** (`#mpc`)
Start the twin (`python server.py`, open http://localhost:8080/#mpc). Items: 1 M1 calculators · 2 M2 crank mechanism (charts, CSV) ·
3 M2b four-bar analysis + animation · 4 M2b path generation (track editor, click to add points, exact 3-point or N-point search) ·
6 M3 shaft design (geometry, moments, deflection, strength table, key, press fit, hand-over from M2) · 5 guides (rendered, searchable) + self-test of all programs. The tab calls the same Python functions as the command line
(`twin/mpc_tools.py` → `/api/mpc/...`), so web and command-line numbers are identical. Deep links: `/?mpcitem=4#mpc`, `/?mpcitem=5&mpcguide=M2#mpc`.

## Use
```
cd "01_mechanical_design/tools"
python dm_toolkit.py examples     # worked examples of guide M1
python dm_toolkit.py selftest_all # self-tests of all modules (M1, crank, fourbar), must print ALL PASS
python dm_toolkit.py --help       # calculators: gci, rel, goodman, stack, shaftopt
python crank.py selftest          # M2 crank program checks
python crank.py run --out result  # M2 full calculation -> report.md, crank.csv, charts (.svg)
python fourbar.py run --in examples/swing_arm.json --out swing   # M2b four-bar worked application
python fourbar.py pathparams > track.json; python fourbar.py path --in track.json --out trk   # required track -> linkage
```
Related guides in `docs/`: 10, 14, 16, 52, 53, 54.
