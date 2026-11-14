# V-Compressor Smart Factory: Digital Twin

A digital twin of a factory that makes **V-type, 2-cylinder piston air compressors (20 m³/h FAD at 8 bar, 4 kW, 300 L tank)**.
It includes:
- a live 3D factory
- material handling: AS/RS warehouses with stacker cranes, an AGV fleet, a pallet pool and pallet changers
- an **MES**: work orders, serial numbers and traceability, quality (SPC, Cpk), maintenance orders
- an **ERP** (manufacturing part): sales orders, BOM, MRP, purchasing, inventory, cost
- OEE and bottleneck detection, including cranes and AGVs
- predictive maintenance and alarms
- a data history (historian)
- what-if simulation

It needs only **Python 3.10+**. You don't need to install anything, and it works without internet. The 3D library (Three.js) is included in `web/vendor/`.

**Guide book:** detailed guides for every topic (twin, FMS, material handling, MES/ERP, PLC, SCADA, communication,
CNC, pallet changer, mechanical interfaces, AGV build, HMC build, robot, hydraulic design method, real-factory roadmap) are in [`docs/`](docs/00_INDEX.md).
Start with `docs/00_INDEX.md`. Doctoral research plan built on this project: `Doctor paper/51_doctoral_research_roadmap.md`; thesis working folder `thesis/` (see `thesis/README.md`; assembled draft `thesis/build/thesis.pdf` + `thesis.docx`), methods in plain English `Doctor paper/52_thesis_methods_guide.md`. Real FMS control software (Modbus TCP + HTTP): `fmsctl/` – textbook guides `Doctor paper/53_fms_control_system.md` (item 1 interface + PLC code), `Doctor paper/54_fms_cell_controller.md` (item 2 cell controller), `Doctor paper/55_tool_management.md` (item 3 tools), `Doctor paper/56_agv_asrs_logistics_control.md` (item 4 AGV + AS/RS). CAD / CAE / CAM software overview: `docs/52_cad_cae_cam_software.md`; connecting the tools (co-simulation, FMI): `docs/53_cosimulation_tool_coupling.md`; 63 coupled tool chains + modules: `docs/54_coupling_catalogue.md`. Machine design reference + calculation programs: folder `machine+program_software+control_system design/` (start with its README); in the twin: tab **M_P_C tools** (`#mpc`, `web/mpc.js`, backend `twin/mpc_tools.py`, `/api/mpc/...`). SOLIDWORKS model → 3D twin (GLB, Three.js, live data): `docs/55_solidworks_to_threejs_twin.md`. General method for any FMS (tab FMS engineering, 14 items, one by one): `docs/FMS system design/60_contract_fmse.md`, item 1 `docs/FMS system design/61_fms_types_pipeline_modules.md` (textbook) with offline programs in `tools/fmse/` (see `tools/fmse/README.md`, run `python tools/fmse/run_all_selftests.py`).

**Dark mode:** the button **◐ Auto / ☀ Light / ☾ Dark** at the right of the top bar switches the colour theme (saved on this PC; deep link `/?theme=dark`). See `docs/01_digital_twin_core.md` §2.2.

## Start

```
python server.py
```
Then open **http://localhost:8080** in your browser. On Windows you can also double-click `start.bat`.
To allow other PCs on the factory network to open it, run: `python server.py --host 0.0.0.0`

## The factory

```
Raw AS/RS --AGV--> [Load station: fixture pallet + serial no.] -> pallet pool -> [Machining Center 1 / 2 / 3] -> [Washer] --\
Raw AS/RS --AGV--> [Boring Center] -> [Honing] -> cylinder supermarket (kanban) ------ 2 per unit ----------------+-> [Pump Assembly: kit check]
Raw AS/RS --AGV--> [CNC Lathe] -> [Grinder] -> crankshaft supermarket (kanban) ---------------------------------/        |
                                                                              [Robot Head Bolting] -> [Test Bench 1 + 2] (FAD >= 97% of nominal)
                                                                                                             |
   Finished-goods AS/RS <--AGV-- [Packaging] <- [Final Assembly + tank + motor of the model] <- [Powder Coating] <--------+
```
The ERP creates work orders (MRP, per model) and purchase orders; the MES releases work orders to the load station,
follows every serial number and ships finished units from the AS/RS to the customer.

### Flexible manufacturing (FMS): three models on the same machines

| Model | Flow | Motor | Tank | Price | Mix | Work content |
|---|---|---|---|---|---|---|
| VC10-100 | 10 m³/h | 2.2 kW | 100 L | $890 | 30% | 46 min |
| VC20-300 | 20 m³/h | 4 kW | 300 L | $1,450 | 50% | 56 min |
| VC30-500 | 30 m³/h | 5.5 kW | 500 L | $2,150 | 20% | 68 min |

(example values)

* **Flexible machines**: 3 machining centers; each tool magazine holds the tools of 2 models, the third model costs a
  10-minute tool-set exchange. Other stations have a changeover time (`setup_s`) when the model changes. New machine state **SETUP**.
* **Flexible routing**: any pallet to any free machining center (`"pick": "rule"`); assembly starts only complete kits (`"pick": "kit"`).
* **Kanban supermarkets** per model for cylinders and crankshafts (`"kanban": {"buffer", "target", "trigger"}`).
* **Dispatching rule** (FMS tab, or `{"action": "rule", "value": "EDD"}`): FIFO, EDD (default), SPT, SETUP (batching in due-date windows).
* Per-model castings, tanks and motors (`"variant"` on a store, `"alt"` on a station input); the AGV brings castings only for released work orders.
* Config: `products`, `fms`, `setup_s`, `tool_magazine`, `pick`, `kanban`, `per_variant`, `variant`, `alt` in `config/factory.json`.

## What you see

| Screen | What it shows |
|---|---|
| **3D factory** | The whole factory hall: CNC machines, washer, honing machine, grinder, robot cell, test cells, paint booth, final assembly, stretch wrapper, warehouse. Everything moves from **live twin data**: andon light towers show the state, spindles and the robot move only while a machine is running, conveyors carry the real parts, test-bench screens show the measured air flow, and crates in the racks are finished compressors. |
| Camera / color | Camera presets (overview, machining, assembly, final, walk-in). **Color by machine state** or **by health** turns the 3D factory into a heat map. |
| **Material handling** | AGVs (state, battery, load, task), AS/RS (slots, crane utilization, queue, stock), pallet pool, transport loops |
| **Line schematic** | The same factory as 2D cards, grouped by production line |
| **FMS & products** | The three models (mix, backlog, WIP, stock, output), the dispatching rule and the queue it creates, the FMS cell (load station, pallet pool, 3 machining centers with their tool magazines), kanban supermarket levels per model, and every changeover per station with its share of time. |
| **FMS – PLC control** | `twin/plc.py` + `web/plc.js`, in the FMS tab. One PLC per line and per AS/RS crane (or a `"plc"` field per station in the config). Live network diagram: plant network (OPC UA) to MES / SCADA / AGV fleet manager, PLC-to-PLC hand-overs of the buffers between lines (PN/PN coupler), PROFINET to the stations, AGVs (MQTT / VDA 5050). Per PLC: CPU, IP, scan time, live I/O image (%I / %Q / %IW with raw values), live ladder logic with power flow, field devices, and a real **E-stop** (stations stop, start interlocked also in SCADA until reset). Communication log of every handshake (cycle start / M30, part ready / taken, AGV docking E84 style, recipes from MES, part done, alarms). `GET/POST /api/plc`, deep link `/?plc=PLC-02#fms`. Example PLC types and addresses. |
| **Order flow** | Follow **one customer order** from the ERP to the machines and back, step by step: 1 order → 2 plan work order → 3 material check / purchase → 4 release → 5 production → 6 finished-goods AS/RS → 7 ship. A route map shows every serial number in its machine (with progress), in queues, on AGVs and in the AS/RS. **Manual mode** (you click each step, time steps +1 min / +10 min / +1 h) or **automatic** (the system does it), per factory and per order. |
| **MES** | Work orders (release / hold / close), traceability by serial number (route, component lots, test result, customer), SPC chart and Cpk of the air-flow test, non-conformance records, maintenance work orders, actual MTBF/MTTR |
| **ERP** | Sales orders, MRP with the full calculation shown, purchase orders, inventory (with coverage hours), BOM and standard cost, revenue / profit / on-time delivery |
| **SCADA** | `twin/scada.py` + `web/scadatab.js`. Overview mimic of all lines, storage and AGVs; machine faceplates with **real** operator commands (start, stop, maintenance, speed set point, training bearing fault, start/stop whole line); alarm management after ISA-18.2 (scan every 2 s, deadbands, acknowledge, shelve, comment, cleared-but-unacknowledged, standing and chattering alarms, alarm rate vs. 6/h benchmark, bad actors, journal); tag database (161 tags with PLC address, signal, quality, time stamp; writable `SpeedSetpoint`); historian trends (4 pens, small multiples, 30 min–24 h); audit trail (operator name on every action); shift report with OEE and CSV download; editable SCADA alarm limits. `GET/POST /api/scada`, `GET /api/scada/trend`. Addresses and limits are example values. |
| **CNC / G-code** | `web/gcode.js` (browser only, no server change). Small CAM: stock, tool table and operations (face milling, rectangular pocket, helical circular pocket, outside contour, holes with G81/G83/G84/G85) generate G-code for Fanuc/Haas or Siemens 840D. A simulated CNC controller reads the program block by block (modal state, arcs, canned cycles) and raises alarms: feed zero, spindle off while cutting, rapid move into material (crash), below part bottom, over-travel, arc radius error, missing decimal point (Fanuc). 3D preview with Three.js/WebGL: the tool cuts a height-map stock, play / step / scrub, DRO, click a line to explain each word, cutting-data formulas (n, F, Q, Pc), cycle time vs twin cycle time, edit code by hand, download `.nc` / `.MPF`. Deep link `/?gctpl=cc&gcctrl=siemens#cnc`. Example data. |
| **Pallet changer (APC)** | `web/apc.js`. Design page for a 2-pallet rotary automatic pallet changer of the HMCs (typical 500 mm class example values). Inputs (pallet, load, arm, servo + gearbox, lift hydraulics, zero-point clamping, sequence times) → calculations with formulas: moment of inertia, trapezoid motion, torque, motor torque/speed, servo choice with inertia ratio, backlash position error, lift cylinder bore (standard sizes), oil flow, pump power, slip and tilt checks of the clamping, arm stress/deflection, bearing loads, swing circle, light-curtain distance (ISO 13855), change time and cell output. Animated top + side view with timing, PLC step chain with sensors and interlocks, PLC I/O list, bill of materials (CSV), safety notes. **Use in twin** sets the HMC pallet change time in the running simulation (`POST /api/command {"action":"pallet_change_s","value":8.8}`, until reset). |
| **Pallet changer – 3D structure** | `web/apc3d.js` (Three.js, parametric from the APC design inputs). Base frame, 4 guide columns, hydraulic lift cylinder, lift carriage with slewing bearing, ring gear (m 4) + pinion, right-angle planetary gearbox + servo, rotor with hub, arm, cross beams, fork rails under the pallet lifting ledges, turning partition wall; pallets with pull studs and tombstone fixtures; B-axis table with receiver plate, 4 zero-point modules (red clamped / green open), rotary union; load station with locating cones, light curtain, operator panel; hydraulic power unit (tank, motor-pump, bladder accumulator, filter, valve manifold, pressure switches) and pipes with animated flow (pressure / tank / air). Follows the step animation. Views (overview, clamping, lift + drive, hydraulic unit, load station), exploded view, cut view, guards, labels; click a part for function, specification, material, MAKE/BUY and manufacturing notes. Plus a live section through a zero-point module and an ISO 1219 style hydraulic circuit (1V1 4/3 lift valve, 1V2 pilot check, 1V3 throttles, 2V1 3/2 release valve, 2S1, 3V1/3S1 seating air). |
| **Pallet changer – PLC ladder program** | `web/apclad.js` + `apclad_prog.js` + `apclad_data.js` (shared core `web/ladder.js`). The APC step chain of the page (M60 → door open → unclamp → lift → rotate 180° → lower → clamp → seating air → door close → FIN) as 18 live LAD networks for Delta AS332T-A (ISPSoft) and Siemens S7-1200 CPU 1215C (TIA Portal) side by side: modes auto / single step / manual, start conditions of guide 09 §24.2 (≥ 10.7 MPa, oil ≥ 20 °C), accumulator charging 10.8 / 11.5 MPa with SET/RST hysteresis, low-pressure alarm < 10.0 MPa, 8 step watchdogs (2 × nominal) with alarm numbers, Ack = one retry, manual jog + Home, counters; plant model (page times, 4 L accumulator, servo with STO, simulated NC), status strip, fault buttons, I/O table, Delta IL, SCL, catalogue card (7 drawings). Guide `docs/36_plc_ladder_apc.md`. Deep link `/#apc` (last card), self-check `&ladBtest`. |
| **Mechanical elements – 1. pallet transfer AGV / cart ↔ APC** | `web/mech.js` (Three.js, offline). Parts to manufacture for handing the machining pallet (data from the Pallet changer tab) between an AGV with lifting chain deck – or a manual cart – and the APC load station: station table with 4 locating receivers, lift-transfer unit with 2 roller chains (strands between or outside the pull studs), gear motor, hydraulic lift cylinder, retractable stop, docking post with conical pin, shock absorbers and PU pads, lead-in funnel rails, height reference plate for the AGV deck sensor, E84 optical I/O, light curtain with muting. Animated 7-step transfer (deliver / pick up, AGV / cart) with E84 handshake and sensor timing incl. APC interlock; interface drawings (side + plan); calculations (heights, chain selection, drive, transfer time, slip/tipping, lift cylinder, docking energy, anchors, pin, AGV and cart stability, cell timing); checks incl. clearance to the turning APC rails and swing circle; height and lateral tolerance chains; BOM (MAKE/BUY); guide: interface sheet for the AGV supplier, manufacturing, installation, commissioning tests, PLC interlocks, maintenance. AGV stop error ±5–10 mm is solved with a floating deck (ball transfer units, centring springs, conical lock pin) and lift docking on 2 cone pins + machined stop faces (comparison of 5 concepts, animated front view, forces rigid vs floating). Deep links `?mxveh=cart&mxtask=pickup&mxview=dock&mxt=6&mxpart=cpin#mech`. |
| **Mechanical elements – 2. crate docking stand** | `web/mech2.js` (Three.js, offline). Crate stand beside the load station for castings in / empty crates out, used by an underride AGV and by a forklift: open frame, 4 self-centring V-guides (flare catches AGV ±10 mm and forklift ±50 mm), PU pads, bollards, sensors + RFID; crate with fork tunnels and nests; jib crane + gripper for the >23 kg castings. Animation (deliver / pick up, AGV / forklift, jib loading), guide section, plan view, calculations (heights, AGV stroke and leg clearance, guide angle vs friction, centring force, rail stress with forklift impact, jib foot moment), checks, tolerances, BOM, guide. Deep link `?mxitem=2&cxveh=fork&cxview=stand#mech`. |
| **Mechanical elements – 3. AS/RS ↔ AGV interface** | `web/mech3.js` (Three.js, offline). Front end of the raw-material AS/RS: stacker crane + racks (crate on 2 support angles), 2 I/O chain conveyors (IN / OUT) leaving the fenced crane area sideways: P&D position, bridge through the fence opening (muting light curtain, no stop position in the opening), contour check (light grids, weight, barcode/RFID) on the IN lane, AGV transfer position open below with side V-guides and end stop. Fence distance from the ISO 13855 safety distance S = 1600·T + 850. Animation OUT / IN, signal timeline (WMS, AS/RS PLC, conveyor, safety, fleet manager, AGV), example messages (WMS telegrams, VDA 5050 order, E84), plan view, real-environment requirements (floor, fire, dust, temperature, network, standards EN 528 / EN 619 / ISO 3691-4 / IEC 62046), calculations (crane utilisation, buffers, conveyor drive, clearances), checks, BOM, responsibilities + FAT/SAT tests. Deep link `?mxitem=3&axtask=in&axview=agv#mech`. |
| **Mechanical elements – 4. load station ↔ APC** | `web/mech4.js` (2D SVG, offline). Connection of the load station to the rotary pallet changer: animated pallet change (top view + side section, times from the Pallet changer tab), station mounting A bolted + dowelled to the APC base vs B floor frame, accuracy chains station → machine zero-point (±1 mm) and back to the receivers (±3 mm), pallet on the fork rails, clearances, interlocks, signals, checks, formulas, BOM, alignment procedure with a master pallet. Deep links `?mxitem=4&m4mount=base|floor&m4t=6#mech`. |
| **HMC build – 1. rotary table (B-axis, worm drive)** | `web/hmc.js` (2D SVG, offline), tab `#hmc`. How to machine and assemble an HMC rotary table: cross-section with 14 animated assembly + measuring steps (click parts for data), duplex worm backlash setting (interactive), contact pattern, process plans (housing, table, worm wheel, worm, clamp, cartridges), calculations (worm geometry, efficiency / self-locking, motor, clamp, tooth load, bearing, accuracy with / without direct encoder), checks, BOM, acceptance tests (ISO 230-2 / ISO 10791-1). Deep links `?hrstep=6&hrshift=2.6&hrplan=worm#hmc`. |
| **HMC build – 2. worm manufacturing twin** | `web/wormmfg.js` (2D SVG, offline). Process twin of the duplex worm from item 1 (geometry via `window.HMCROT`): 12 animated operations (saw, face + centre, rough turn, rough thread – whirling / single-point / disc milling, case hardening with T–t, carbon + hardness profiles, hardness + centre holes, cylindrical grinding, duplex thread grinding with burn risk Q'w, nital etch, gear measuring machine, test bench with master wheel, finish). Each worm gets a simulated part record (random variation, JSON download); 7 switchable process faults show where a fault starts and which check finds it. Inspection + test bench charts, route time/cost, lot simulation of 50 worms with Cpk. Every operation lists its **equipment** (machine with the required capability, tooling, workholding, gauges, consumables) plus a full equipment list, and a **3D view** (`web/mfg3d.js`) where the worm is generated from the thread equations and changes with every operation. Deep links `?hritem=2&wmop=80&wmu=0.4&wmf=burn,thermal&wmsn=3#hmc`. |
| **HMC build – 3. worm wheel manufacturing twin** | `web/wheelmfg.js` (2D SVG, offline, shares helpers with `wormmfg.js`). 11 animated operations: C45 hub, centrifugal-cast CuSn12Ni2 rim + incoming inspection (HB, dye penetrant), fit turning, shrink fit (Lamé pressure, holding torque, heating temperature, warm-gear loosening) + torque test, finish turning in one set-up (bore H6, throat radius), drill + ream, hobbing with a duplex hob (radial / tangential / radial+tangential / fly cutter; speeds, times, hob centre-distance setting for the resharpened hob), deburr, gear measuring machine (fp, Fp, runout, flank), double-flank roll test with master worm + contact pattern, pairing with the worm from item 2 (uses its part record). Equipment per operation, 7 faults, part record (JSON), lot simulation with Cpk, time/cost. **3D view** (`web/mfg3d.js`): hobbing with growing tooth depth + tangential hob motion and all other operations. Deep links `?hritem=3&wwop=70&wwu=0.5&wwf=hobWrong&wwsn=2#hmc` (`&show3d` opens 3D). |
| **HMC build – 4. spindle manufacturing twin** | `web/spdmfg.js` + `web/spd3d.js` (shared design model `web/spindle.js`). Motor spindle HSK-A63, 10 000 rpm / 18 kW S1 (project standard, decided 2026-11-12), 4 × 7014 front / 2 × 7012 rear hybrid bearings, built-in motor, drawbar with disc springs. Shaft in 14 animated operations: saw, face + centre, rough turn, gun drilling (drift curve), stress relief, semi-finish turn (+ spring bore), C-axis milling, pre-grind, gas nitriding (furnace curve, hardness traverse), OD grinding, internal grinding of the HSK taper (contact print), thread finishing, balancing (vectors), inspection + laser marking. Equipment per operation, 7 faults, part record (JSON), lot of 50 with Cpk, time/cost, 8 calculation blocks; process plans for housing, cooling sleeve, spacers, drawbar + springs, covers. **3D** with machines and a quarter-cut shaft. Guide `docs/18_spindle_manufacturing.md`. Deep link `?hritem=4&smop=40&smu=0.5&smf=drift&show3d&smcut#hmc`. |
| **Assembly – 1. rotary table** | `web/asmrt.js` (2D SVG, offline), tab `#asm`. Assembly twin of the HMC rotary table in 18 steps (kit check + traceability, washing + 20 °C soak, housing on a rotatable stand, main bearing, table, worm wheel, worm cartridges, contact pattern, backlash with the duplex worm + spacer grinding, hydraulic clamp pressure + torque test, encoder centring, rotary union, seals + oil, zero-point modules, grinding the table top in its own bearing, run-in, ISO 230-2 acceptance). Jigs drawn on the item-1 cross-section; equipment to BUY (E1–E20) and jigs to MAKE (J1–J12) per step; torque table with sequence; simulated checks with limits; 7 assembly faults; assembly record (JSON) with the worm/wheel serials of items 2–3; labour time/cost; room layout. **3D view** (`web/mfg3d.js`) with quarter cut, parts moving into place and blue jigs. Guide `docs/17_assembly_rotary_table.md`. Deep link `/?arst=5&aru=0.5&arf=enc#asm` (add `&show3d` to open the 3D view). |
| **Assembly – 2. motor spindle** | `web/asmsp.js` + `web/asmsp3d.js`. Spindle assembly in 21 steps in the clean room: kit + traceability, cleaning + soak, measuring bearings, grinding spacers to the preload offset, grease dosing, heating + mounting the front TBT set, front lock nut with runout correction, front bearing housing, rotor shrink fit, rear set, drawbar + disc-spring pack, balancing, stator + cooling sleeve, inserting the shaft unit, covers, unclamp cylinder, clamping-force test, sensors, run-in program, final test, record. Equipment E1–E26, jigs J1–J12, torque table, 8 faults, assembly record (JSON) with the shaft serial of HMC item 4, key calculations, room layout. **3D** with quarter cut (bearings with balls, every disc spring, stands, crane, balancing machine, run-in cradle). Guide `docs/19_spindle_assembly.md`. Deep link `/?asitem=2&asst=9&asu=0.6&asf=spacer&show3d#asm`. |
| **Assembly – 3. motor spindle LIVE station twin** | Backend `twin/spstation.py` + `twin/spdevices.py` (own database `data/spstation.db`), page `web/spst.js`, 3D `web/asmsp3d.js`. Real digital twin of the spindle assembly station ASSY-SP1: work orders + serials, operator terminal with login/roles, step interlocks (no check can be skipped, inspector sign-off for balance / clamp / run-in / final test), NCR (rework / scrap / concession), audit trail, device connection (HTTP ingest `/api/spst/ingest`, Modbus TCP poller with register maps, MQTT 3.1.1 client), built-in device simulator + auto operator, live run-in with thermal model and stop rules, final test, unit history, SPC with Cpk, CSV export, 3D that follows the station (exploded view, click a part). Test tools `tools/spst_gateway.py`, `tools/spst_modbus_sim.py`, `tools/spst_mqtt_broker.py`. API `/api/spst`, `/api/spst/stream`, `/api/spst/units`, `/api/spst/unit?sn=`, `/api/spst/spc?id=`, `/api/spst/runin?sn=`, `/api/spst/export.csv`. Guide `docs/20_spindle_station_live_twin.md`. **Restart the server after updating.** Deep link `/?asitem=3#asm`. |
| **AGV build – 1. underride lifting AGV** | `web/agv.js` (Three.js, offline). Self-built latent AGV for the crates of mechanical items 2/3: welded chassis with pockets, 2 sprung drive modules (BLDC + planetary, PU wheel), 4 castors, 4 selectable lift types – eccentric cam (2 shafts + chain + worm gear motor, self-holding at dead centre), screw jack, scissor, hydraulic – each with its own calculation, 3D unit, force/torque curve, checks, BOM and guide, plus a comparison table, LiFePO4 battery, control box. 3D with drive-under / lift / drive-away animation, exploded view, covers and safety field toggles, part data. Stop accuracy budget (localisation, creep x cycle, odometry, backlash, scanner mount, floor tilt, guide play; RSS) with navigation methods table and the 30-run measuring procedure; lift drawing + torque curve; control system diagram + I/O list; speed-dependent safety fields (ISO 3691-4); calculations (mass, drive, grip/braking, stability, lift, energy, fields), 19 checks, BOM, guide (make/buy, manufacturing, commissioning, tests, maintenance). Deep links `?avlift=screw&avview=lift&avt=9&avex=60&avpart=jack#agv`. |
| **AGV build – 2. servo drive control** | `web/agvdrive.js` (offline, no libraries). Control of the two drive motors of item 1 (values via `window.AGV`): control layers (fleet manager → navigation PC → kinematics → CANopen CiA 402 → drive cascade → motor), cascade explanation, tunable control simulator (position / speed / current loop, feed-forward, encoder steps, floor-step disturbance, real inertia from the AGV mass; speed, following error and current plots with hover), power + signal wiring diagram (battery, fuse, main switch, precharge, contactor, DC bus, brake chopper, DC/DC, STO, CAN) with sized parts list, interactive CiA 402 state machine with controlword / statusword and CAN frames, example code (kinematics + CANopen in Python, enable sequence + watchdog in Structured Text, cascade controller + odometry in C), object dictionary, 14 checks, calculations (current, inertia ratio, gains, regeneration / brake resistor, precharge, fuse / cable, CAN load), commissioning + tuning guide, fault table. Deep link `?avitem=2&adcode=st#agv`. |
| **AGV build – 3. pallet AGV** | `web/agvpallet.js` (Three.js, offline). 1 t AGV that brings the machining pallet (Pallet changer tab) to the APC load station of mechanical item 1: deck low while driving, scissor lift (2 servo actuators, force curve by virtual work, low actuator mounting = ~3.5 × load at the start), floating deck on ball transfer units with centring springs + electric lock pin, docking bushes on 2 cone pins, push-up against stop faces (current limit), deck chains + retention pawl, E84. 3D animation deliver / pick up, height stack, concept comparison (low deck + scissor vs fixed high deck), signal list, interface sheet AGV ↔ station, calculations (masses, heights, scissor, docking, drive, stability, chains, battery), 18 checks, BOM, guide + acceptance tests. Deep link `?avitem=3&aptask=pickup&apview=dock&apt=12#agv`. |
| **AGV build – 4. docking accuracy** | `web/agvdock.js` (2D SVG, offline). Animated step-by-step: how an AGV that stops ±10 mm hands over exactly. A pallet AGV → APC station (floating deck, cone pins, stop faces, receivers ±0.02 mm), B crate AGV → AS/RS (V-flare guides, conveyor stop, fork clearance, rack), C AS/RS → AGV → crate stand (errors add up on the AGV, guides reset them). Overview + real-scale magnifier + error ladder, stop-error slider with fault cases, accuracy chain, checks, formulas, rules, acceptance tests. Deep links `?avitem=4&dkscn=A|B|C&dke=6&dkt=8#agv`. |
| **Industrial robot – 1. 6-axis robot twin** | `web/robot.js` (page, teach pendant, charts) + `web/robotsim.js` (motion engine, program, part flow) + `web/robotkin.js` (kinematics, catalogue data, cell layout) + `web/robot3d.js` (Three.js, offline), tab `#robot`. 4 reference robots (3 / 20 / 60 / 200 kg, public catalogue data): catalogue card with to-scale arm dimensions, axis table with live angle, limit bar and speed, mechanical structure (click → highlight in 3D). Motion engine with synchronised PTP trapezoid (MoveJ) and LIN (MoveL) on the real axis speeds, speed override, sim speed 1/2/5×, alarms (axis limit, out of reach, singularity, no part in gripper, door, safety gate). Teach pendant: T1 (TCP ≤ 250 mm/s, enabling device = hold button / Space) / AUTO, joint + linear jog in BASE / TOOL, increments, gripper, Go home, live TCP X Y Z A B C + configuration. Machine-tending cell (infeed / outfeed conveyors, machine with door + 25 s cycle timer, part flow): program in a robot-language-like syntax, teach points with touch up, run / step / stop / loop; cycle-time table, parts/h, double-gripper estimate; live charts (joint angles, joint speed %, TCP speed); work envelope side view; payload check. Guide `docs/21_industrial_robot.md`. Deep links `/?rb=irb4600&rbrun&rbspeed=5#robot`, `&rbff=60` (fast-forward), `&rbtest` (self test in the console). Example values. |
| **Industrial robot – mathematics + dynamics (live card)** | `web/robotdyn.js` (Newton–Euler inverse dynamics, estimated mass model, balancer, Jacobian, det, singularity indicators, τ = Jᵀ·F, gear ratio / motor side) + `web/robotdynui.js` (card in the Robot tab: per joint q̇, q̈, gravity / inertia + Coriolis / balancer / net torque, motor torque + rpm + power, peak + RMS over 25 s, torque chart, Jacobian + singularity table, static force calculator, mass model). Checked by an energy balance (Σ τ·q̇ = dE/dt within 0.05 %) and hand lever sums. Guide `docs/22_robot_math_dynamics.md`. Link masses are estimates. |
| **Industrial robot – 2. robot control system** | `web/robotctl.js` (item 2 of the Robot tab, also handles the item switch 1 ↔ 2) + `web/robotctl_core.js` (pure simulation core) + `web/robotctl_test.js` (self-checks, `&rctest`, runs in a web worker). 7 cards: (1) clickable controller architecture (main computer, axis computer, 6 drives on one DC bus, brake chopper, safety controller, I/O, 24 V, cooling, pendant, motors, SMB) with live values; (2) motion pipeline + cycle-time table; (3) joint servo simulator: position P → speed PI → current lag + torque limit → two-mass plant (motor – elastic gear – link inertia + gravity from `robotdyn.invDyn`), physics ≤ 0.1 ms, loops 0.5 ms, IPO 4 ms with quadratic fine interpolation, velocity / torque feedforward, jerk filter, gear-twist compensation, encoder resolution, gains + stiffness sliders, auto-tune rule, KPIs (following error in arc-min and mm, settling, overshoot, sag, resonance, bandwidth, stability status); (4) model-based collision detection (momentum observer, threshold, with vs without model, contact force, stop timeline, wrong-payload false alarm); (5) safety state machine (e-stop, gate, 3-position enabling, T1/T2/AUTO, motors on, start/stop, dual-channel discrepancy, stop categories 0/1/2 with speed curves, safe zones live from item 1, brake test, standards table); (6) signal list + animated handshake timing diagram (follows the item-1 program live), timeout demo, OPC UA note; (7) program structure, modes, restart, backup, maintenance. Guide `docs/23_robot_control_system.md`. Deep links `/?rbitem=2#robot`, `&rcrb=irb4600`, `&rcj=2`, `&rckp=25`, `&rcwrong`, `&rcsafe=estop`, `&rcio=8`, `&rcblk=inv`. Estimates – check with the supplier. |
| **Industrial robot – 3. control circuits (electrical schematics)** | `web/robotckt.js` (item 3 of the Robot tab: live state, safety logic, info boxes, cards) + `web/robotckt_pages.js` (9 SVG drawing pages) + `web/robotckt_sym.js` (IEC 60617 symbol library, drawing frame with columns + title block, automatic cross-references /page.column) + `web/robotckt_calc.js` (all sizing calculations, reuses item-2 numbers). Pages: (1) mains TN-S, main switch -Q1, fuses, robot feed, conveyors with safety contactors -K1/-K2 + MPCB, 24 V PSU, RCBO, PE bar; (2) servo drive: filter, rectifier, DC bus 565 V, precharge, brake chopper (live DC-bus chart during a J1–J3 stop), IGBT inverter, STO, SBC brake, encoder/SMB; (3) 24 V supply with ECBs, PELV link, power budget, valve short circuit demo; (4) dual-channel safety with a safety PLC: e-stops (positive opening), coded gate switch with guard locking, enabling device, mode selector, reset, request entry, EDM, outputs to robot ES/AS → STO, -K1/-K2, machine -K5/-K6; live faults (short A–B, welded K1, stuck OSSD) with stop categories matching item 2; (5) I/O wiring PNP/NPN, flyback diodes, interposing relays, 4–20 mA, signal list (follows the item-1 program); (6) PROFINET/PROFIsafe network; (7) earthing + EMC with fault selector; (8) cabinet layout + heat; (9) classic safety-relay variant. Cards: calculations (live per robot), BOM, test + commissioning, symbol legend + wire colours. Guide `docs/24_robot_control_circuits.md`. Deep links `/?rbitem=3&ckpage=4#robot`, `&ckrb=irb4600`, `&ckestop`, `&ckcross`, `&ckweld`, `&ckshort`, `&ckemc=pigtail`, `&ckinfo=K1`, `&cktest` (self-checks in the console). Example values – the real design follows IEC 60204-1 and a qualified designer. |
| **Industrial robot – real components + drawings (items 1, 2, 3)** | `web/robotref.js` + `web/robotref_data.js`, drawings in `web/img/` (copies of `docs/img/`): one card at the end of each robot item. Item 1: 12 drawings (`21_*`, `22_*`: robot structure, joint drive train, reducers, payload diagram, gripper, cell layout + ISO 13855 distance, handshake, DH frames, IK geometry, motion profiles, Lagrange, J2 sizing), 59 catalogue rows in 8 groups, 25-position shopping list (guides 21 + 22). Item 2: 8 drawings (`23_*`: controller architecture, cascade loop, two-mass model, Bode, FOC drive, safety timing, handshake timing, stop categories), 31 catalogue rows (controllers, safety options, servo drives, safety PLCs, fieldbus I/O, tools), 17-position shopping list (guide 23). Item 3: 8 IEC-style circuit drawings (`24_*`: mains, MCB curves, servo power stage, 24 V, Cat 3 safety, safety relay, I/O, cabinet layout), 62 catalogue rows in 14 groups, 44-line cabinet BOM (guide 24). Drawings enlarge on click; buy lists have a filter and group selector. Test switches `?rrtab=draw|buy|shop`, `&rrq=`, `&rrbox=N`, `&rrchk`. Catalogue examples – ask the supplier for the current datasheet and a quote. |
| **AS/RS raw materials – 1. mechanical system (3D twin)** | `web/asrscore.js` (shared core: rack 392 slots, crane motion, jobs, stock, ONE live simulation `window.ASRS` for all 4 items, shared faults) + `web/sr.js` (item switch) + `web/asrs3d.js` + `asrs3d_view.js` + `asrs3d_scene.js` + `asrs3d_calc.js` + `asrs3d_parts.js` + `asrs3d_data.js` + `asrs1.css`. Live 3D twin of ASRS-RAW: steel high-bay rack (perforated uprights, bracing, 392 beams, base plates, load guides, slot plates) with crates and castings per material, single-mast stacker crane (rails, wheel blocks, travel + hoist drives, box mast, carriage with 3-stage telescopic fork, cabinet, laser + bar-code positioning, optical data link, power rail, buffers), I/O conveyors with scale, contour gate, ID scanner, fence, light curtains; views Iso / Front / Side / Top / Follow / Explode, colour by SKU / fill / age, click 34 parts or any slot; live panel (crane x/z/v, phase, jobs, KPIs, FEM 9.851); engineering calculations (rack beam + upright, floor, wheel loads, mast deflection + natural frequency 2.55 Hz, drives 7.5 / 11 / 1.1 kW, FEM SC 34.8 s / DC 57.8 s, capacity, positioning budget, energy); catalogue card (9 drawings, 69 rows, 34-line list). Guide `docs/31_asrs_mechanical_3d.md`. Deep link `/?sritem=1#asrs`, self-check `&sr1test`. |
| **AS/RS raw materials – 2. control system** | `web/asrsctl.js` + `asrsctl_core.js` + `asrsctl_data.js` + `asrs2.css`. Control architecture (ERP → MES / WMS → WCS → fail-safe crane PLC PLC-ASRS-RAW → drives), live crane motion profiles + S-curve comparison, positioning (laser / bar code / encoder) + accuracy budget, mast sway (2-mass), cascade loop + feedforward, live 66-byte WCS telegram + step chain (alarm = A8 + step), 7 injectable errors, AUTO / SEMI / MANUAL + jog, safety state machine (10 safety functions, EN 528 / ISO 13849, stopping distance), I/O conveyor handshake, DC-link energy (regen −65 %), KPIs + alarms, catalogue card (10 drawings, 47 rows, 23-line list). Guide `docs/32_asrs_control_system.md`. Deep link `/?sritem=2#asrs`, self-check `&sr2test`. |
| **AS/RS raw materials – 3. PLC + electrical circuits** | `web/asrsckt.js` + `asrsckt_calc.js` + `asrsckt_sym.js` + `asrsckt_pages.js` + `asrsckt_data.js` + `asrsckt_card.js` (generated by `tools/gen_asrsckt_card.py`) + `asrs3.css`. 8 live IEC schematic pages (two-letter IEC 81346 tags): mains + conductor rail (collector follows the crane, voltage drop chart, rail vs energy chain), shared DC link (motoring / regenerating per axis, chopper, active infeed option), hoist safety (slack rope, final limits, overspeed governor, safe speed monitor, load cell, 2 brakes + SBC), travel limits + positioning, F-PLC safety circuit Cat 3 / PL d (e-stops, door with guard locking, light curtain with muting, STO / SBC / main contactor + EDM), crane I/O + optical data link, conveyor + ID point, crane cabinet + heat + 24 V budget; calculations (drives 2 × 5.5 / 15 / 1.1 kW, supply gG 40 A 5G10, rail 40 A, brake resistor 27 Ω, light curtain 550 mm), BOM, tests, legend, catalogue card (8 drawings, 55 rows, 42-line list). Guide `docs/33_asrs_control_circuits.md`. Deep link `/?sritem=3#asrs`, self-check `&sr3test`. |
| **AS/RS raw materials – 4. WMS / ERP / MES** | `web/asrswms.js` + `asrswms_core.js` + `asrswms_erp.js` + `asrswms_data.js` + `asrs4.css`. System landscape ERP → MES → WMS → WCS → crane PLC with 13 messages, live counters and example payloads (B2MML, REST / MQTT JSON, EDIFACT, 82-char TO telegram, OPC UA job record); WMS live stock per SKU (value, coverage, ROP status), 392-cell rack map (material / age / ABC / stock category), slot detail (location ASRS-RAW-A01L-L3-S05, lot, SSCC, heat, inspection) + quality hold; slotting by COI (37.1 → 30.3 s); goods receipt with ISO 2859-1 sampling + goods issue flows; cycle counting + stock accuracy; ERP material master (guide 15 part numbers), valuation, MRP record, SS / ROP / EOQ, PO + "post inbound delivery" → store jobs in the sim; MES kanban call-off, availability check + WO release (20 × VC20 → 21 / 41 / 21), genealogy heat → serial; KPIs; catalogue card (9 drawings, 47 rows, 14-line list). Guide `docs/34_asrs_wms_erp_mes.md`. Deep link `/?sritem=4#asrs`, self-check `&sr4test`. |
| **AS/RS raw materials – 5. PLC ladder program** | `web/asrslad.js` + `asrslad_prog.js` + `asrslad_plant.js` + `asrslad_card.js` + shared ladder core `web/ladder.js` + `ladder.css` (used by AS/RS, APC and hydraulics: live SVG rungs, Delta / Siemens / both views, input panel, run / 1 scan / reset, I/O table, generated Delta IL + Siemens SCL, program check, `&ladtest`). Live LAD of the stacker crane + conveyors for Delta AS332T-A (ISPSoft) and Siemens CPU 1515F-2 PN (TIA Portal) side by side: 18 networks, 155 tags: modes, safety status read only, drive enable + brake + STO feedback, jog interlock, WCS life watchdog + 4-way handshake, step chain S10…S160 with SET/RST, time-outs, conveyor ID point / contour / scale / reject, crane ↔ conveyor handshake with muting enable, 15 alarms, counters; plant model + fault injection, optional mirror of the live AS/RS twin, catalogue card (8 drawings). Guide `docs/35_plc_ladder_basics_asrs.md` (also the ladder textbook). Deep link `/?sritem=5#asrs`, self-check `&ladAtest`. |
| **AS/RS raw materials – 6. stacker crane: structure + manufacturing** | `web/asrscrane.js` + `asrscrane_3d.js` + `asrscrane_calc.js` + `asrscrane_mfg.js` + `asrscrane_data.js` + `asrscrane.css`. 3D build twin of the single-mast stacker crane (same geometry as item 1): 13 assemblies / 32 clickable parts (function, size, material, tolerances, weight, failure, checks), views assembled / exploded / X-ray / section / focus, animated load path; live calcs (mast f₁ 2.55 Hz, δ 1.86 mm, wheel 30.2 kN, rope Z_p 8.6, D/d 31 / 40, fork tip 4.9 mm, weld 16.7 MPa, flange 12 × M24 10.9); manufacturing twin: 7 parts, 56 animated operations (cut, bevel, jig + tack, balanced weld sequence, distortion check, straightening, stress relief, machining with datums + H7 bores, MT/UT, Sa 2½ + paint, marking) with route sheets; animated site assembly in 8 steps + load and cycle tests; BOM make / buy (27 positions, 4 166 kg); catalogue card (12 drawings). Guide `docs/38_asrs_stacker_crane_manufacturing.md`. Deep link `/?sritem=6#asrs`, self-check `&sr6test`. |
| **AS/RS raw materials – 7. telescopic fork** | `web/asrsfork.js` + `asrsfork_3d.js` + `asrsfork_calc.js` + `asrsfork_data.js` + `asrsfork.css`. 3D simulation of the 3-stage telescopic fork on the lifting carriage (same fork as items 1 and 6): 2 tines, 2 pinions per tine on racks under the middle stages, 4 roller chains with moving links (stroke doubling s_top = 2·s_mid), rollers, guide strips, sensors; animated pick + store cycle (11 steps, 23.58 s) with a synced timeline (fork position, speed, carriage height) and sensor states; views Iso / Front / Top / X-ray / Section; drive designs (rack + chain, all-chain, belt, friction); follow-one-link and live force arrows; 6 fault cases (offset, slot occupied, chain slip, obstacle, not centred, overload); live calcs (gear ratio 5.86, 761 N, 1.1 kW, deflection 4.9 mm, roller couple 5.7 kN, clearances); manufacturing, chain tensioning, maintenance, BOM; catalogue card (8 drawings). Guide `docs/39_asrs_telescopic_fork.md`. Deep link `/?sritem=7#asrs`, self-check `&sr7test`. |
| **Installation – 1. foundation / vibration · 2. levelling / alignment / acceptance** | `web/instmech.js` (entry, lazy build) + `web/instmech_i1.js` (item 1) + `web/instmech_i2.js` (item 2) + `web/instmech_calc.js` (all numbers) + `web/instmech_ui.js` + `web/instmech.css`. Item 1: live floor / slab check (pad pressure vs f_cd, punching, ground pressure), isolated foundation block calculator + SVG foundation plan (top view + section A–A, clickable parts), mounting options (anchored + grouted / levelling bolts / rubber mounts / springs), vibration sources, 1-DOF isolation calculator (f_n, δ, T(r) chart, presets), moving-column reaction + rocking, unbalance, ISO 10816-3 / 20816-3 + floor limits + site survey, floor plan of the crankcase line with draggable vibration sources (simple model, pass/fail per HMC). Item 2: instruments, levelling procedure, **levelling simulator** (bed on 6 elastic M30 × 1.5 bolts with twist + bow, readings X/Z at 4 positions, twist, bolt loads, next-step hints, random installed state), alignment to the floor datum (12 interface checks, shaft alignment by rpm), geometric acceptance G1–G17 (ISO 10791-1 / 230-1), ISO 230-2 A/B/E/M/R with compensation, ballbar, ISO 10791-7. Guide `docs/26_installation_foundation_alignment.md`. Deep links `/?initem=2&imsolve#inst`, `&imseed=5`, `&imsrc=press,-12,-22`, `&iminfo=grout`, `&imtest`. Example values – the maker's installation manual decides. |
| **Installation – 3. electrical installation · 4. EMC / cable routing / signal wiring** | `web/instelec.js` (entry, lazy build, self-check) + `web/instelec_calc.js` (IEC 60364-5-52 cable tables, IEC 60909 short circuit, harmonics, noise formulas, tray rules) + `web/instelec_i3.js` + `web/instelec_i4.js` + `web/instelec_ui.js` + `web/instelec.css`. Item 3: clickable single-line diagram (20 kV → 1000 kVA Dyn11 → main board → SD-ML1 → HMC-01/02/03, VMC, washer, robot cell, pallet pool, compressor) with live sizing per machine (I_b, breaker, cable with derating, ΔU, Ik3, Ik1/disconnection, inrush), worked example, selectivity, RCD type B + leakage + reinforced PE, SPD 1/2/3, harmonics/THD/PF/unbalance, TN-S earthing + bonding drawing, machine connection + transformer tap, tickable IEC 60364-6 / IEC 60204-1 §18 test checklist. Item 4: common-mode noise calculator (dv/dt, I_cm, M, induced V), cable categories + live tray checker (place cables, earthed dividers, pass/fail + why), shielding / pigtail / reflected-wave calculators, signal wiring (4–20 mA budget, 24 V drop, networks, fibre), animated fault simulator (7 wiring mistakes → scope trace → fix), troubleshooting table. Guide `docs/27_installation_electrical_emc.md`. Deep links `/?initem=3&iem=HMC-02#inst`, `&ieinfo=T1`, `/?initem=4&ietray=good&iefault=net&iefix#inst`, `&ietest`. Example values – real design by a qualified electrician. |
| **Installation – 5. sequence, rigging, utilities, commissioning, run-off** | `web/instseq.js` + `web/instseq_calc.js` (CPM, sling, air, coolant, capability – no DOM) + `web/instseq_text.js` + `web/instseq.css`. Time plan with real CPM (critical path, float, editable durations, 1 machine / 3-machine line), RACI, site preparation, transport + rigging (sling force, WLL, spreader beam, forklift), utilities (air demand + pressure drop, coolant, chips, mist, network), commissioning + spindle run-in, FAT/SAT, run-off with Cm/Cmk/Cpk, tickable checklists (saved per browser), mistakes + cost, questions for the maker. Guide `docs/28_installation_sequence_commissioning.md`. Deep links `/?initem=5&isscope=line#inst`, `&isdur=MFG:60`, `&isangle=45`, `&isdata=B`, `&istest`. Example values. |
| **Installation – real components + drawings (items 1–5)** | `web/instref.js` + `web/instref_data.js` (card builder `makeCard` shared with `web/robotref.js`; data generated from the guide tables). Item 1: 4 drawings (`img/26_*`: foundation plan + section, transmissibility, vibration layout, anchor + grout), 29 catalogue rows (grout, anchors, levelling elements / mounts / isolation, vibration meters), 11 consumables. Item 2: 4 drawings (level positions, levelling bolt, geometry tests, shaft alignment), 25 rows (levels, granite / mandrel / indicators, interferometer / ballbar / tracker, shaft alignment), 16 instruments + services. Item 3: 5 drawings (`img/27_*`: single-line diagram, short-circuit impedances, SPD zones, TN-S earthing, test sequence), 46 rows (transformer, switchboards, breakers, busbar trunking, SPDs, RCD type B / RCM, meters, testers, thermal cameras). Item 4: 3 drawings (common-mode path, tray segregation, shield connection), 22 rows (cables, trays, PFC + harmonics, EMC parts); items 3 + 4 show the 17-line shopping list. Item 5: 8 drawings (`img/28_*`: Gantt + critical path, lift plan, sling angle factor, crane outrigger pressure, air ring main, central coolant, commissioning sequence, capability histogram), 68 rows in 14 groups (slings / shackles, spreader beams, skates / jacks, air pads, forklifts / cranes, transport monitoring, compressed air, coolant, filtration / chips, mist collectors, network, capability measurement, software, run-in), 32-line shopping list (24 buy + 8 rent / service). Drawings enlarge on click; filter + group selector. Test switches `?irtab=draw|buy|shop`, `&irq=`, `&irbox=N`, `&irchk`. Catalogue examples – ask the supplier for current data and a quote. |
| **Hydraulics – 1. element data book** | `web/hydlib.js` + `web/hydlib_sym.js` (ISO 1219 symbols + principle drawings) + `web/hydlib_calc.js` + `web/hydlib_d1/d2/d3.js` (data) + `web/hydlib.css`. 93 hydraulic elements in 13 families (pumps, motors, cylinders + rotary actuators, directional / pressure / flow / check + lock / cartridge valves, proportional + servo, accumulators, filters, coolers, tanks, pipes, hoses, fittings, manifolds, sensors, fluids): ISO 1219 symbol, principle drawing, how it works, types, real data ranges, selection formula with worked example, 11 live calculators (pump, motor, cylinder, buckling, accumulator, orifice, counterbalance, pilot check, valve Δp, pipe, cooler), 6 charts, mounting, failures, supplier questions; search + symbol legend. Guide `docs/29_hydraulic_elements_data.md`. Deep links `/?hyitem=1&hlel=pr_cbv#hyd`, `&hltest`. Example values – check the supplier's catalogue. |
| **Hydraulics – 2. standard circuits · 3. system sizing** | `web/hydckt.js` + `web/hydckt_sim.js` (lumped simulation: orifice equation, β 1.4 GPa, leakage) + `web/hydckt_sym.js` + `web/hydckt_c1.js` + `web/hydckt_c2.js` + `web/hydckt_size.js` + `web/hydckt.css`. Item 2: 9 live ISO 1219 circuits (hydraulic lock, counterbalance, meter-in/out/bleed-off, sequence + reducing valve, regenerative, accumulator + unloading, motor + brake valve, supply types / load sensing, synchronising + intensifier) with valve buttons, demo cycle, "what goes wrong without it" switches, charts, formulas, settings, failures. Item 3: complete system sizing from the load list to cylinder (ISO 3320 + buckling), flows, supply option by energy, pump + IEC motor, accumulator, valve NG + settings, pipes, heat / tank / cooler, filter, circuit summary and BOM (presets guide 25, APC, HMC clamp, press 200 kN, motor drive). Guide `docs/30_hydraulic_circuits_sizing.md`. Deep links `/?hyitem=2&hcckt=cbv&hcwrong=cbv#hyd`, `/?hyitem=3&hcpreset=press#hyd`, `&hctest`. |
| **Hydraulics – real components + drawings (items 1–3)** | `web/hydref.js` + `web/hydref_data.js` (card builder `makeCard` shared with `web/robotref.js`; data generated from the guide tables). Item 1: 15 drawings in two groups (method `img/25_*` 7: design flow, example circuit, APC clamp circuit, duty cycle, HPU layout, losses, stiffness; elements `img/29_*` 8: ISO 1219 symbol sheet, pump types, cylinder, directional valve, Δp–Q curves, pressure valves, check / lock, accumulator + safety block), 100 catalogue rows in 13 element families (guide 29 §17), 24-row element shopping list. Item 2: 9 ISO 1219-2 circuit drawings (`img/30_*`), 56 catalogue rows per circuit (guide 30 §20). Item 3: 4 drawings (sizing flow, duty cycle, HPU layout, losses), 53 rows (guide 25 §18) and three shopping lists – guide-25 job 18, press 200 kN 18, APC + clamp unit 31. Drawings enlarge on click; filter + group selector. Test switches `?hrtab=draw|buy|shop`, `&hrq=`, `&hrbox=N`, `&hrchk`. Catalogue examples – ask the supplier for current data and a quote. |
| **Hydraulics – 4. PLC ladder program** | `web/hydlad.js` + `hydlad_lib.js` + `hydlad_p1.js` + `hydlad_p2.js` + `hydlad_p3.js` + `hydlad_card.js` (shared core `web/ladder.js` + `ladder.css`). Hydraulic power unit + circuits as live LAD, Delta AS332T-A (ISPSoft) and Siemens S7-1200 CPU 1215C (TIA Portal) side by side. 3 programs: HPU (17 networks: star-delta 5 s with interlocks + feedback check, accumulator 10.8 / 11.5 MPa, ready ≥ 10.7 MPa, oil heater / cooler / trip, level, filter, run hours, alarms), clamp-then-work step chain (15), vertical lift lock + counterbalance + valve test (14). Plant model with gas law, I/O table, Delta IL, SCL, catalogue card (8 drawings). Guide `docs/37_plc_ladder_hydraulics.md`. Deep links `/?hyitem=4&hlprog=hpu|seq|lock#hyd`, self-check `&ladCtest`. |
| **Ball screw + guide factory – 1. products** | `web/bsf.js` (item switch) + `web/bsfprod.js` + `bsfprod_data.js` (shared product data for items 2–8) + `bsfprod_calc.js` + `bsfprod_geo.js` + `bsfprod_3dcore.js` + `bsfprod_3dbs.js` + `bsfprod_3dlg.js` + `bsfprod.css`. New tab for a ball screw + profiled linear guide factory (communication only Ethernet + Modbus TCP + HTTP, contract `docs/40_contract_bsf.md`). 3D ball screw (gothic-arch thread, balls circulating, internal deflector / end cap / tube return, ball-oversize or double-nut preload, fixed + floating supports) and 3D profiled linear guide (4 rows 45°, O / X arrangement, rollers), views assembled / cut-away / X-ray / exploded, click-info per part; 7 live calculators (torque, efficiency, L10, buckling, critical speed, DN, rigidity, thermal, ISO 3408-3 grades, guide loads + moments + life, preload, mounting tolerances); HMC X-axis selection example; parts lists (make / buy); catalogue card (13 drawings). Guide `docs/40_ballscrew_linear_guide_products.md`. Deep link `/?bfitem=1#bsf`, self-check `&bf1test`. |
| **Ball screw + guide factory – 2. manufacturing** | `web/bsfmfg.js` + `bsfmfg_data.js` (shared process data for items 3–8: routings, machine types + 73 instances, Modbus signal groups, quality gates, capacity()) + `bsfmfg_calc.js` + `bsfmfg_3d.js` + `bsfmfg_3dm.js` + `bsfmfg.css`. Every operation of screw shaft, ball nut, rail, carriage and final assembly as a live 3D machine (27 modules: saw, straightening press, lathe, induction scanning, furnace, cylindrical / thread / internal thread / profile / raceway grinders, whirling, rolling, lead laser, assembly, run-in …), clickable process flow with G / W / R thread variants, routing sheets with totals, machine list, capacity calculator (72 machines, bottleneck thread grinding), process-physics calculators, 17 quality gates, catalogue card (13 drawings). Guide `docs/41_ballscrew_guide_manufacturing.md`. Deep link `/?bfitem=2#bsf`, self-check `&bf2test`. |
| **Ball screw + guide factory – 3. layout + live twin** | `web/bsflay.js` + `bsflay_data.js` + `bsflay_3d.js` + `bsflay_svg.js` + `bsflay.css` + shared simulation `web/bsfsim.js` (`getBSF()` → one `window.BSF` for items 4–8: orders, lots on the routings, machine states OFF / IDLE / STARVED / SETUP / RUN / BLOCKED / DOWN, MTBF/MTTR, scrap, batch furnaces, AGVs, raw + FG stores, energy, events, JSON `snapshot()`, `SIGFIELDS` = Modbus register map 1:1). Hall 80 × 48 m + annex, zones in Z-flow (raw store → saw → soft machining → heat treatment → grinding room 20 ± 1 °C → measuring room 20 ± 0.5 °C → assembly → packing + FG), 73 machines placed, from–to matrix (93 AGV trips, 2 073 m per day), AGV sizing; live 3D twin (colour by state / utilisation / WIP / OEE / power, click a machine → lot, OEE = A × P × Q, alarm, Modbus preview), controls (speed to ×3600, shifts, mix, AGVs, orders, breakdowns), KPIs + charts, what-if (10 scenarios), catalogue card (12 drawings). Guide `docs/42_bsf_layout_digital_twin.md`. Deep link `/?bfitem=3#bsf`, self-check `&bf3test`. |
| **Ball screw + guide factory – 4. communication (Modbus TCP + HTTP only)** | `web/bsfcomm.js` + `bsfcomm_map.js` + `bsfcomm_data.js` + `bsfcomm.css`; server `twin/bsf_comm.py` (gateway + HTTP routes `/api/bsf/...`, inert until started), `twin/bsf_comm_modbus.py` (stdlib Modbus TCP server for 73 machines + client), `twin/bsf_comm_map.py` (register maps, IP plan), `twin/bsf_comm_api.py` (MES / ERP / AGV / printer demo APIs); tools `tools/bsf_modbus_sim.py`, `tools/bsf_gateway.py`. Network 10.60.0.0/16 with 10 VLANs, unit id 1–73, register map per type (fast 0–11, counters 20–99, energy 100–103, command 200–226 incl. gateway heartbeat 226 (map V1.1), REAL ABCD), gateway polling 500 ms / 1 s / 10 s + heartbeat write 1 s (299 req/s, 0.5 % of 100 Mbit/s), stale flags, report-by-exception + SSE, MES → machine toggle-bit handshake (FC16 + FC06), live frames, device table, decoder / builder, load calculator, 9 fault injections, HTTP try-it, catalogue card (12 drawings). Guide `docs/43_bsf_communication_modbus_http.md`. Deep link `/?bfitem=4#bsf`, self-check `&bf4test`. |
| **Ball screw + guide factory – 5. quality + inspection** | `web/bsfqa.js` + `bsfqa_data.js` (shared quality data for MES / ERP) + `bsfqa_calc.js` + `bsfqa_meas.js` + `bsfqa_chart.js` + `bsfqa_card.js` + `bsfqa.css`; optional server `twin/bsf_qa.py` (routes `/api/bsf/qa/...`, in-memory, inert until used). Control plan with 55 characteristics (21 critical) linked to the 17 quality gates, live laser lead bench (ISO 3408-3: T, E, e_p, v_up, v_300p, v_2πp, C3/C5/C7, 20 °C compensation), 11 live stations (run-out, hardness + CHD, gothic-arch profile, ball classes, preload torque band, rigidity / lost motion, rail parallelism, carriage H / W2, Ra / Rz, noise, cleanliness), SPC on live twin data (X̄-R / X̄-s / I-MR, Western Electric rules, Cp / Cpk / Pp / Ppk), gauge R&R (average + range and ANOVA), GUM uncertainty + ISO 14253-1, ISO 2859-1 sampling, NCR / 8D, traceability per serial, results to the MES by HTTP JSON and Modbus TCP registers, catalogue card (12 drawings). Guide `docs/44_bsf_quality_inspection.md`. Deep link `/?bfitem=5#bsf`, self-check `&bf5test`. |
| **Ball screw + guide factory – 6. MES** | `web/bsfmes.js` + `bsfmes_data.js` (shared MES data model for ERP / PLC) + `bsfmes_core.js` (scheduler, OEE, MES state + local router = browser copy of the server) + `bsfmes_view.js` + `bsfmes_card.js` + `bsfmes.css`; optional server `twin/bsf_mes.py` + `twin/bsf_mes_core.py` (routes `/api/bsf/mes/...`, SQLite `bsf_mes.sqlite` next to `--db`, written only after the first POST). Work orders → lots → operations from the item-2 routings, readiness check (heat lots, wheel / dresser sets, gauges), finite-capacity scheduling of 73 machines (EDD / SPT / CR / FIFO / set-up families, furnace loads, drum-buffer-rope at the thread grinders, re-schedule on breakdown, Gantt), dispatch lists, order download via the gateway (FC16 + FC06 toggle + FC03 ACK), automatic confirmations, downtime reason codes, andon, quality holds / NCR / SPC stop, AGV transport, kanban, FG booking, serials + GS1 labels, genealogy heat → assembly, OEE (ISO 22400), Pareto, shift report, API try-it, build vs buy, catalogue card (12 drawings). Guide `docs/45_bsf_mes.md`. Deep link `/?bfitem=6#bsf`, self-check `&bf6test`. |
| **Ball screw + guide factory – 7. ERP** | `web/bsferp.js` + `bsferp_data.js` (master data `MD`, read also by Python; shared with item 8) + `bsferp_core.js` (browser copy of the ERP + demo MES) + `bsferp_view.js` + `bsferp_card.js` + `bsferp.css`; optional server `twin/bsf_erp.py` + `twin/bsf_erp_core.py` (58 routes `/api/bsf/erp/...`, SQLite after the first change, env `BSF_ERP_DB`). Master data (7 customers, 9 suppliers, 45 materials + 12 variants, multi-level BOMs, routings, 41 work centres with machine hour rates), configurator (code + price), sales quotation → order → ATP / CTP on the thread-grinder capacity → delivery → invoice, MRP (low-level codes, net requirements, lot-for-lot / fixed / EOQ / POQ, lead-time offset, exception messages), purchasing via supplier portal (HTTP) + goods receipt to blocked stock + AQL inspection, stock per heat lot, valuation, ABC/XYZ, ROP / SS, production orders ↔ MES (release, sync, backflush, settlement), standard cost roll-up, variances, P&L, cash, break-even, KPI dashboard, API try-it, build vs buy, catalogue card (12 drawings). Guide `docs/46_bsf_erp.md`. Deep link `/?bfitem=7#bsf`, self-check `&bf7test`. |
| **Ball screw + guide factory – 8. PLC programs** | `web/bsfplc.js` + `bsfplc_lib.js` (standard interface, register image, gateway simulation) + `bsfplc_p1.js` … `bsfplc_p6.js` + `bsfplc_data.js` + `bsfplc_card.js` + `bsfplc.css` (shared ladder core `web/ladder.js`). Live LAD for Delta AS332T-A and Siemens S7-1200 / S7-1500 F side by side: standard machine interface I1–I14 (status word, state, alarm + ack, 32-bit counters, cycle time, energy, heartbeat, gateway watchdog 5 s, toggle-bit MES handshake, filling of the 226 holding registers of item 4, REAL ABCD), 6 programs with plant models (bandsaw template, induction scan hardening, straightening press, thread-grinder auxiliaries + chiller, preload torque stand, run-in + E84 AGV port), live register image + simulated gateway, Delta Modbus server + Siemens MB_SERVER setup, PLC selection + BOM for all 41 machine types, commissioning checklist, catalogue card (11 drawings). Guide `docs/47_bsf_plc_programs.md`. Deep link `/?bfitem=8#bsf`, self-check `&bf8test`. |
| **Additive manufacturing – 1. technology map + 2. metal LPBF process twin + 3. industry map** | `web/am.js` (item switch + item 1) + `web/amind.js` + `web/amind_data.js` (item 3: dossier per field with case studies / numbers / standards, 50-application catalogue with CSV, sweet-spot + timeline charts, 16 industry fields with realistic maturity, public examples, outlook, revenue-share bar chart, field × process matrix, `/?amitem=3#am`) + `web/amlpbf_model.js` (pure model) + `web/amlpbf.js` (item 2 page) + `web/am3d.js` (3D build chamber, offline) + `web/am.css`, tab `#am`. Item 1: 7 ISO/ASTM 52900 process families with schematic, data, real industrial uses and use in this factory, process selector, where AM pays, digital thread. Item 2: LPBF build job (4 parts, 5 materials, 3 machine classes, orientation, P/v/h/t, powder reuse, HIP) → energy density, nesting, build time, powder, gas, energy, cost per part vs conventional; 12 operations with player, live powder-bed camera + melt-pool + O2 charts, 3D chamber (lowering plate, recoater, lasers, gas flow), 9 faults, build record + JSON download, lot Cpk, equipment list, safety + standards. Guide `docs/48_additive_manufacturing.md`. Deep links `/?amitem=2&ampart=insert&ammach=m400&show3d#am`, self test `&amtest`. Example values. |
| **Machine tools – types, trends, selection** | `web/mt.js` (page, item switch, animated principle sketches) + `web/mt_data.js` (data) + `web/mt.css`, tab `#mt`. Item 1: 20 modern machine-tool types with category filter, animated principle sketch, animated 3D model (`web/mt3d.js`, button "Show 3D model", `&show3d`), purpose, principle, components, typical values, parts, makers (examples), meaning for the compressor factory, comparison table. Item 2: 14 trends on a maturity × impact map with principle, typical gain, examples and questions for the supplier. Item 3: machine types per compressor part (route, key features) + buying checklist with ticks saved per PC. Guide `docs/49_modern_machine_tools.md`. Deep links `/?mtt=millturn#mt`, `/?mtitem=2&mttr=conn#mt`, `/?mtitem=3&mtp=crankshaft#mt`. Example values. |
| **Standards library** | `web/std.js` + `web/std_data.js` (GENERATED from `docs/16_standards_register.md` by `python tools/build_standards.py` – run it after editing guide 16) + `web/std_extra.js` (hand-written: 94 standards from guides 30–49, 24 longer explainers, "Standards in 1 minute"), tab `#std`. Offline search over all 679 standards, guidelines and EU laws cited in the project: plain-language title, what it requires (key values), project requirements, group, binding type (law / harmonised / voluntary), edition, status, guides that use it; explainers with main content, key numbers and how to apply them; buy-first list of 25. Summaries are our own words, not the official texts. Guide `docs/16_standards_register.md` §23. Deep links `/?std=ISO%2013855#std`, `/?stdq=hydraulic#std`. |
| **AI in industry** | `web/ai.js` (page, item switch) + `web/ai_data.js` (content) + `web/ailab.js` (live labs, pure JS, offline) + `web/ai.css`, tab `#ai`. Item 1: AI explained (flow, 6 kinds, can / cannot, roles, 6-question "is AI right?" check). Item 2: 20 AI use cases for the fields of this twin on an area × role matrix and value × effort chart, detail with data / method / benefit range / pitfalls and links to the tabs. Item 3: live labs – predictive maintenance (logistic regression + cost-based threshold), visual inspection (classifier on synthetic images), cutting-data optimisation (grid / random / surrogate / Nelder–Mead), demand forecasting (moving average / Holt-Winters / regression → safety stock), retrieval assistant (TF-IDF over the standards library). Item 4: roadmap, offline architecture, team, pilot cost, risks, EU AI Act / Machinery Regulation, first 3 projects. Guide `docs/50_ai_in_industry.md`. Deep links `/?aiitem=2&aiuse=pdm#ai`, `/?aiitem=3&ailab=opt#ai`. Benefits = typical reported ranges; lab data simulated. |
| **Doctoral research** | `web/phd.js` (page, item switch) + `web/phd_calc.js` (pure calculation core – JavaScript port of `thesis/code/bayes.py`, `flowline.py`, `rampup_experiment.py`, `discrepancy.py` and the chapter 5 sizing formulas; seeded RNG) + `web/phd_data.js` (thesis results, GENERATED by `python thesis/code/export_web.py`) + `web/phd.css`, tab `#phd`. Item 1: thesis map (gap → contributions C1–C4, chapters + progress, hypotheses H1–H4 with status, paper 1 numbers). Item 2: editable capacity / bottleneck table (Eq. 4.1–4.2) and Bayesian updater (Gamma–Poisson failures, Gamma–exponential repairs, Normal-Inverse-Gamma cycle time, Beta–binomial scrap) with prior / posterior density and 90 % interval. Item 3: virtual ramp-up results of 30 hidden factories (7 predictors, prior weight sensitivity, bottleneck identification, epistemic share) + live lab running one hidden factory month by month in the browser. Item 4: Modbus TCP + HTTP sizing calculator (Eq. 5.1–5.6, H1 check) + table of the 15 measured runs. Item 5: stepwise FMS introduction – thesis results of 40 hidden factories (6 policies) + investment-plan calculator (6 options × 4 stages, Eq. 7.1–7.3, "Suggest plan" with the thesis rule). Item 6: reference design cases (chapter 9) – compressor FMS frozen design prediction P0 + robustness of the first investments, ball screw shaft line capacities, transfer test and data path. Guide `Doctor paper/51_doctoral_research_roadmap.md` §2b. Deep links `/?phditem=2#phd`, `/?phditem=3&phdrun#phd`, `/?phditem=4#phd`, `/?phditem=5&phdsuggest#phd`, `/?phditem=6#phd`. Labels design / calculated / simulated / measured. |
| **Factory tabs – real components + drawings (Live factory, FMS, Order flow, MES, ERP, SCADA, PLC, Communication, CNC, HMC build, Pallet changer, Assembly, Mechanical elements, AGV build)** | `web/machref.js` + `web/machref_data.js` (card builder `makeCard` shared with `web/robotref.js`; data generated from the guide tables). Live factory: 8 drawings (`img/01_*`), 38 catalogue rows (simulation, virtual commissioning, IIoT platforms, AAS tools, data infrastructure, twin hardware), 16-line list for running the twin offline. FMS & products (end of the tab): 6 drawings (`img/02_*`), 40 rows (FMS / pallet pools, cell control, pallets + fixtures, tool management, APS, simulation), 18-line FMS cell list. Order flow: 3 drawings (order flow, VSM, CONWIP), 6 scheduling / APS rows. MES: 5 drawings (`img/04_*`), 33 rows (MES, CMMS, QMS / CAQ, terminals). ERP: 3 drawings, 20 rows (ERP, PLM / PDM, servers); MES + ERP share the 22-line MES / ERP / IT list. SCADA: 8 drawings (`img/06_*`), 47 rows, 20-line list. PLC section (FMS tab): 8 drawings (`img/05_*`), 48 rows, 22-line list. Communication: 8 drawings (`img/07_*`), 71 rows, 30-line network list. CNC / G-code: 8 drawings (`img/08_*`), 57 rows, 20-line list. HMC build item 1: 8 drawings (`img/12_*`), 54 rows, 34-line BOM; item 4: 8 drawings (`img/18_*`), 54 rows, 20-line list + make-or-buy. Pallet changer: 8 drawings (`img/09_*`), 50 rows, 24-line list. Assembly item 1: 8 drawings (`img/17_*`), 61 rows, 26-line list; item 2: 8 drawings (`img/19_*`), 47 rows, 26-line list. Mechanical elements item 1: 8 drawings (`img/10_*`), 63 rows, 31-line list. AGV build item 1: 8 drawings (`img/11_*`), 69 rows, 20-line fleet list. HMC items 2–3 have no card (equipment buy specs only). Drawings enlarge on click; filter + group selector. Test switches `&mrhold=<tab>`, `?mrtab=`, `&mrq=`, `&mrbox=N`, `&mrchk`. Catalogue examples – ask the supplier for current data and a quote. |
| Machine detail | Sensors, health index, remaining tool life, vibration-trend prediction, OEE breakdown, controls, charts |
| **Communication – step-by-step simulation** | Teaching mode (`web/commsim.js`): one order (23 × VC20-300) in 20 animated steps. Envelopes fly between Customer, ERP, MES, SCADA and the PLCs while the truck, AS/RS crane, AGV and the part move on the shop floor. Each step shows the real message (EDIFACT, B2MML, OPC UA, VDA 5050, MQTT, 4–20 mA, IO-Link, G-code, REST) colour-coded by grammar part: envelope, verb, object, data, answer. Play / Next / Back / speed; deep link `/?csstep=13#comm`. |
| **Communication – protocols by layer** | Reference view (`web/commproto.js`): the 5 communication types (request/response, publish/subscribe, document exchange, cyclic real-time I/O, signal on a wire) and, for every neighbour-layer link, 3–4 typical protocols with type, data format, transport/port, speed, use and a colour-coded example message; plus a quick overview table and cross-layer connections (MES→PLC direct, machine↔robot, barcode/RFID, cloud). Deep link `/?cmmode=proto#comm` (`&cpopen=1` opens all examples). |
| **Communication – SCADA explained** | `web/scada.js`: what SCADA is (5 jobs, place between MES and PLC, comparison table) and a working SCADA screen on the live twin data: line mimic, machine faceplate with tags, PLC addresses, signals and the 4–20 mA → raw → engineering-unit scaling, alarm list with ISA-18.2 life cycle (active / acknowledged / cleared, deadband), historian trend, operator command previews (OPC UA Write/Call, not sent) and an animated scan cycle. Teaching switch simulates bearing damage on the selected machine. Deep link `/?cmmode=scada#comm`. Addresses, ranges and alarm rules are examples. |
| **Communication – live monitor** | ISA-95 layers (customer/supplier, ERP, MES, SCADA/twin, PLC/CNC/AGV, sensors) with typical protocols on each link (EDI, B2MML, OPC UA, MQTT, VDA 5050, IO-Link), live message counts, the 14-step end-to-end workflow as a swimlane with real example messages (JSON), and a live message log. `GET /api/comm`, code in `twin/comm.py`. |
| **What-if simulation** | Change cycle times, changeover times, reliability (MTBF/MTTR), scrap rates and buffer sizes; FMS: rule, batch size, product mix, switch a machining center off, tool sets per magazine, kanban size. The twin simulates whole shifts in seconds and compares the result with the current design. |
| **How it works** | Explains the concepts and includes a 10-minute exercise |

Mouse in 3D: drag to rotate, right-drag to move (pan over the floor), scroll to zoom, click to select a machine,
double-click to fly to it. **Mouse drag: Move** swaps the buttons (left-drag moves).
Keyboard in 3D (mouse over the view, or click it first): **W A S D** walk, **← →** turn, **Q / E** down / up, **Shift** 3x faster.
Units move visibly: a finished part is lifted from the machine onto the conveyor, rides it, and is picked into the next machine.
Units of the order followed in the Order-flow tab carry a blue serial-number tag, and their machines are outlined.
Direct links: `/?cam=assembly`, `/?cam=logistics`, `/?focus=HMC-01`, `/?color=health`, `/?view=2d`, `/?building=0`, `/#order`, `/#mes`, `/#erp`.

### Order flow: manual and automatic simulation

| | Automatic factory | Manual factory |
|---|---|---|
| Customer orders | random demand (units/day) + your orders | only your orders |
| Planning (MRP) | every hour | only when you press a button |
| Work-order release | automatic | you press *Release* |
| Shipping | automatic | you press *Ship* |

Orders created in the **Order flow** tab are *make-to-order*: they get their own work order, and their units are reserved
for that customer (pegging); MRP does not touch them. Tick **automatic steps** to let the system do the steps of that one order.

Example, 50 compressors by hand: *Start empty factory (manual)* → Qty 50 → *Create order* → *Create work order* →
(if material is missing: *Buy missing material*, then wait or *Deliver now*) → *Release* → *+10 min* a few times and watch
the units move → when all 50 are in the finished-goods store: *Ship order*.

## Project structure

```
config/factory.json            <- YOUR factory: machines, flows, cycle times, limits, 3D positions
config/example_flange_line.json<- a simpler serial line example
twin/model.py                  <- machines, material flow, physics (the "virtual copy")
twin/handling.py               <- AGV fleet, AS/RS cranes, pallet pools, transport (kanban) loops
twin/mes.py                    <- MES: work orders, traceability, quality, maintenance orders
twin/erp.py                    <- ERP: sales orders, BOM, MRP, purchasing, shipping, cost
twin/analytics.py              <- OEE, bottleneck, health/RUL, alarms, what-if
twin/historian.py              <- time-series storage (SQLite: data/history.db)
twin/engine.py                 <- runs the twin in real time, receives commands and live data
server.py                      <- web server + HTTP API
web/factory3d.js               <- 3D factory (Three.js)
web/app.js, index.html, style.css <- dashboard
web/ops.js                     <- material handling panel, MES and ERP pages
tools/verify_engine.py         <- checks the engine against hand calculations (run after code changes)
tools/gateway_example.py       <- example of a machine sending real data to the twin
```

## Adapting it to your real factory: `config/factory.json`

**Stations**

| key | meaning |
|---|---|
| `inputs` | list of `{"buffer": id, "qty": n}`. The station takes n parts from **each** input (assembly: 1 crankcase + 2 cylinders + 1 crankshaft) |
| `output` | buffer that receives the finished part. Stations with the same inputs and output work **in parallel** |
| `type` | physics: `cnc`, `washer`, `assembly`, `robot`, `test`, `paint`, `packaging` |
| `model` | 3D look: `hmc`, `vmc`, `hone`, `lathe`, `grinder`, `washer`, `assembly`, `robot`, `testbench`, `paint`, `final`, `pack` |
| `pos`, `rot` | position `[x, z]` in metres on the floor plan and rotation in degrees. Conveyors are drawn automatically |
| `line` | name used to group cards in the schematic |
| `cycle_time_s` | ideal time per part |
| `idle_power_kw`, `run_power_kw` | power when idle / working |
| `temp_limit_c`, `vibration_warn_mm_s`, `vibration_alarm_mm_s` | alarm limits |
| `tool_wear_per_part_pct`, `base_scrap_rate` | tool wear per part and scrap with a new tool |
| `mtbf_h`, `mttr_min` | mean time between failures / mean time to repair |
| `spec_flow_m3_h`, `flow_tolerance_pct`, `test_pressure_bar` | test bench pass/fail spec (default 20 m³/h, −3%, 8 bar) |
| `external` | `true` = this machine is driven by real data instead of the simulator |
| `pallet_changer` | `{"change_s": 15}` = automatic pallet changer (only the change time is lost per part). Without it, `load_unload_s` is lost per part |
| `seize`, `release` | pallet pool id: the station takes a fixture pallet when it starts / gives it back when it finishes |
| `serial` | serial-number prefix (e.g. `"VC20"`): this station marks each new unit and only starts when the MES has a released work order |

**Buffers**: `capacity`, `part` (3D shape: `crankcase`, `cylinder`, `crankshaft`, `pump`, `compressor`, `tank`, `motor`, `crate`), `prefix` (part ID prefix).
* `asrs: "ASRS-RAW"` = this stock is kept in that AS/RS (`stock` = start quantity)
* `store: true` = floor storage of purchased parts (`stock`, `pos`)
* `finished: true` = the finished-goods store (with `asrs` it lives in the AS/RS)
* `infinite: true` = endless raw material (simple examples)
* a buffer with `pos` that is filled by an AGV is drawn as a line-side flow rack

**Material handling**
| key | meaning |
|---|---|
| `pools` | `[{"id", "name", "count"}]` fixture pallets that circulate |
| `pallet_pools` | 3D rack of a pool: `pool`, `buffer` (loaded pallets), `pos`, `length`, `levels`, `shuttle_x` |
| `asrs` | `[{"id", "name", "pos", "rot", "length", "height", "levels", "crane_cycle_s", "io", "io_capacity", "unit_load"}]`. `io` = AGV pick-up/drop point, `unit_load` = parts per pallet/basket |
| `agv` | `count`, `speed_m_s`, `load_s`, `unload_s`, `battery_h`, `charge_h`, `low_battery_pct`, `aisle_z` (main aisle), `park`, `chargers` |
| `transports` | `[{"id", "from", "to", "batch", "from_pt", "to_pt"}]` kanban loops served by the AGVs |

**ERP** (`erp` section): `product` (sku, price, other_parts_cost, wo_lot, safety_stock), `items` (purchased items: sku, buffer, cost, supplier,
`lead_time_h`, `lot`, `safety_stock`), `rates_per_h` (machine + labour cost per station type), `energy_price_kwh`, `mrp_interval_h`,
`demand` (random customer orders for training), `customers`, `initial_orders`. The BOM is calculated from the factory flow.

**Layout**: `layout.hall` sets the hall size (metres), and `layout.zones` sets the coloured areas painted on the floor.

Restart the server after editing.

## Connect a real machine

1. Set `"external": true` for that machine, then restart.
2. Send its data with HTTP POST to `http://<twin-pc>:8080/api/ingest`. Send a message at least every 30 s, or the machine shows **OFFLINE**:

```json
{
  "machine_id": "TEST-01",
  "state": "RUNNING",
  "sensors": {"temperature_c": 55, "vibration_mm_s": 2.1, "power_kw": 4.4,
              "spindle_rpm": 0, "tool_wear_pct": 0, "flow_m3_h": 20.4, "pressure_bar": 8.0},
  "part_done": {"good": true, "cycle_time_s": 355, "flow_m3_h": 20.4}
}
```
Send `part_done` only when a part is finished. The twin then takes the inputs from the upstream buffers and puts the part into the output buffer.
To try it without a machine, run: `python tools/gateway_example.py --machine LATHE-01`

Typical hardware paths:
* **CNC / PLC**: OPC UA (`asyncua`), MTConnect, or Modbus TCP (`pymodbus`)
* **Old machines**: current clamp on the motor (running / idle), proximity sensor (part count), accelerometer on the spindle, read by an ESP32 or Raspberry Pi that posts JSON
* **Test bench**: the flow meter and pressure transmitter (4–20 mA) are probably already in the test PLC, so read them with OPC UA or Modbus
* **Many machines**: MQTT broker (Mosquitto) + a small bridge script to `/api/ingest`

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | current snapshot |
| GET | `/api/stream` | live snapshots (Server-Sent Events, about 2 per second) |
| GET | `/api/trend?machine=ID` | recent temperature / vibration / power |
| GET | `/api/config` | factory configuration |
| GET | `/api/export.csv` | history of the current run |
| POST | `/api/command` | `{"action":"stop/start/maintenance/inject_bearing_fault/set_speed","machine":"VMC-01","value":110}` or `{"action":"pause/resume/reset/time_scale","value":60}` |
| POST | `/api/ingest` | live machine data (see above) |
| POST | `/api/whatif` | `{"changes":{"stations":{"VMC-01":{"cycle_time_s":80},"HMC-01":{"pallet_changer":0}},"buffers":{"B_CYL":{"capacity":20}},"agv":{"count":3},"asrs":{"ASRS-FG":{"crane_cycle_s":45}},"pools":{"PAL-CC":{"count":10}}},"hours":8,"replications":3}` |
| GET | `/api/mes` | work orders, units, quality (SPC), maintenance orders, reliability |
| GET | `/api/mes/unit?sn=VC20-000012` | genealogy of one compressor |
| POST | `/api/mes` | `{"action":"create_wo","qty":40,"due_h":24,"release":true}`, `{"action":"release/hold/close","id":"WO-0003"}`, `{"action":"mwo_start/mwo_close","id":"MWO-0002"}` |
| GET | `/api/erp` | sales orders, purchase orders, inventory, MRP log, cost, finance |
| POST | `/api/erp` | `{"action":"create_so","customer":"...","qty":20,"due_h":48}`, `{"action":"create_po","sku":"CC-CAST","qty":120}`, `{"action":"run_mrp"}`, `{"action":"ship","id":"SO-0004"}`, `{"action":"settings","settings":{"auto_demand":false}}` |

**Connecting a real ERP** (Odoo, ERPNext, SAP Business One…): let a small script read new sales orders from the ERP and POST them
to `/api/erp`, and read `/api/erp` + `/api/mes` back for stock, shipments and production confirmations. Or switch off the twin's
MRP and create work orders directly with `POST /api/mes`.

## Industrial robot: mathematical and dynamics principles

These are the principles behind the **Industrial robot** tab, in short form. The full explanation with derivations is in
[docs/21_industrial_robot.md](docs/21_industrial_robot.md) §9 and [docs/22_robot_math_dynamics.md](docs/22_robot_math_dynamics.md).
The code is in `web/robotkin.js` (geometry, motion) and `web/robotdyn.js` (forces, torques).
Example robot: IRB 2600 (catalogue data), tool 180 mm, load 13 kg. All values are examples, and the link masses are estimates.

| # | Principle | Formula | Example (IRB 2600) |
|---|---|---|---|
| 1 | Pose = position + orientation | T = [R p; 0 1], R⁻¹ = Rᵀ, A B C: R = Rz(A)·Ry(B)·Rx(C) | tool down = (A, B, C) = (0, 180°, 0) |
| 2 | Forward kinematics: angles → tool | T = Rz(q1)·Tz(h1)·Tx(a1)·Ry(q2)·Tz(a2)·Ry(q3)·Tz(a3)·Tx(d4)·Rx(q4)·Ry(q5)·Rx(q6)·Tx(d6)·T_tool | q = (30, 20, 10, 0, 40, 0)° → wrist centre (983.3, 567.7, 804.9) mm |
| 3 | Inverse kinematics: tool → angles | wrist centre p_w = p − (d6 + L_tool)·z_tool; q1 = atan2(y, x); J2/J3 by the law of cosines; J4–J6 from R₃₆ | back to q2 = 20.00°, q3 = 10.00°; up to 8 configurations |
| 4 | Jacobian: joint speed → tool speed | v = J·q̇, column i = [z_i × (p − o_i); z_i] | J1 at 20°/s, r = 1226 mm → 428 mm/s |
| 5 | Singularity | det J = 0 (wrist q5 = 0, arm stretched, wrist centre on the J1 axis) | MoveL slows down or stops; MoveJ is fine |
| 6 | Statics (virtual work) | τ = Jᵀ·F | 100 N down → J2 107.6 N·m, J3 83.7 N·m |
| 7 | Motion planning (trapezoid) | T = Δq/v_max + t_a (or 2√(T_c·t_a) for short moves); PTP: the slowest axis leads | home → pick: 66.9°/175°/s + 0.3 s = 0.682 s |
| 8 | Equation of motion | τ = M(q)·q̈ + C(q,q̇)·q̇ + g(q) (Newton–Euler in the code) | J1 inertia 25.6 kg·m² folded → 141 kg·m² stretched |
| 9 | Gravity torque | τ_g = Σ m·g·(horizontal lever) | J2 603 N·m, J3 301 N·m at the example pose |
| 10 | Coupling (Coriolis / centrifugal) | C(q,q̇)·q̇ ∝ speed² | J1 at a constant 175°/s → −393 N·m on J2 |
| 11 | Balancing device | τ_net = τ − τ_spring | J2: −603 → −413 N·m (32 % less) |
| 12 | Drive train | τ_m = τ/(n·η), n_m = q̇·n/6, P = τ·ω, I_m = I/n² | J1: 429 N·m → 4.21 N·m, 1750 rpm, 655 W |
| 13 | Motor sizing | peak \|τ_m\| ≤ max torque; τ_RMS = √(Σ τ²·Δt/T) ≤ rated torque | J2 loop: peak ≈ 780, RMS ≈ 315 N·m at the joint |
| 14 | Load diagram | wrist torque M = m·g·L | 13 kg at 221 mm → 28 N·m on J5 |
| 15 | Stiffness / accuracy | θ = τ/k, δ ≈ θ·r | ≈ 0.45 mm sag; repeatability ±0.04 mm is much better than absolute accuracy |

How they were checked: FK → IK → FK on 1,600 random poses (error < 1·10⁻¹⁰ mm), Jacobian against a numerical derivative (< 2·10⁻⁶),
energy balance Σ τ·q̇ = dE/dt (within 0.05 %), and the gravity torque against a hand sum of mass × lever (identical).
See them live: tab **Industrial robot** → card **"Mathematics + dynamics – live"**.

## Industrial robot: control system principles

The principles behind item **2 · Robot control system** of the Industrial robot tab. Full explanation with worked numbers:
[docs/23_robot_control_system.md](docs/23_robot_control_system.md). Code: `web/robotctl_core.js` (simulation), `web/robotctl.js` (page).
Example: IRB 2600, J1 at the cell home pose, 13 kg load. Motor inertia, gear stiffness, friction and torque limits are estimates.

| # | Principle | Formula | Example (IRB 2600 J1) |
|---|---|---|---|
| 1 | DC bus of the drives | V_DC = √2·V_LL; chopper P = V²/R | 1.41 × 400 = 565 V; on at 750 V, 750²/40 Ω = 14 kW |
| 2 | Cascade loops (joint side) | ω_cmd = K_v·e_θ + ω_FF; τ = K_p·(e_ω + ∫e_ω/T_i) + τ_FF; current loop ≈ lag 0.3 ms, \|τ\| ≤ τ_max | K_v = 21.3 1/s, K_p = 9 749 N·m·s/rad (motor side K_p/n² = 0.677), T_i = 47 ms |
| 3 | Cycle times | IPO 4 ms → loops 0.5 ms → FOC current loop 62.5 µs, PWM 8 kHz | 175°/s → 0.70° = 14.3 mm per IPO cycle |
| 4 | Two-mass resonance | f_res = (1/2π)·√(k·(1/J_L + 1/J_M)), f_lock = (1/2π)·√(k/J_L) | k = 8·10⁵ N·m/rad, J_L = 46.6, J_M = J_m·n² = 68.1 kg·m² → 27.1 / 20.9 Hz |
| 5 | Bandwidth + tuning rule | ω_v = 0.5·ω_res; K_p = (J_L + J_M)·ω_v; T_i = 4/ω_v; K_v = ω_v/4 | ω_v = 85 rad/s (13.5 Hz), position loop 3.4 Hz; K_p × 25 → oscillation |
| 6 | Feedforward | ω_FF = θ̇_set; τ_FF = J·θ̈_set + τ_g + τ_f (dynamic model) | max following error 311′ → 22′ (velocity FF) → 6.9′ = 2.3 mm (both) |
| 7 | Gear twist | θ = τ/k (the motor encoder cannot see it) | J2 static sag 305 N·m / 8·10⁵ = 1.31′ = 0.47 mm |
| 8 | Collision detection (residual) | r = τ_meas − τ_model; momentum observer r = K_O·(p − ∫(τ − τ_g − τ_f + r)dt) | normal 1.6 % of τ_max; threshold 8 % → stop at 1 653 N vs 3 333 N without model (20 kN/m, 50 % speed) |
| 9 | Stop categories (IEC 60204-1) | cat 0 = STO + brake; cat 1 = ramp then STO (SS1); cat 2 = ramp, SOS; φ = ω²/(2a) | from 175°/s: cat 1 150 ms / 267 mm, cat 0 161 ms / 393 mm at the TCP |
| 10 | Safety distance (ISO 13855) | S = K·T + C | 2 000 mm/s × 0.18 s = 360 mm (example) |

How they were checked (`/?rctest#robot`): steady state with gravity (motor-side error 0.0000′), all 24 joints stable with the
auto-tuned gains, resonance of the simulation = formula (0.0 %), torque feedforward 1.9–3.7× better (J1–J3), K_p × 60 oscillates
on all 12 main axes, collision force with model lower than without on all 4 robots, wrong payload → false alarm.

## Industrial robot: control circuit principles

The principles behind item **3 · Control circuits** of the Industrial robot tab. Full explanation with worked numbers:
[docs/24_robot_control_circuits.md](docs/24_robot_control_circuits.md). Code: `web/robotckt_calc.js` (numbers), `web/robotckt_pages.js` (drawings).
Example: IRB 2600 with an assumed 4.5 kVA controller, 3/N/PE AC 400/230 V TN-S. All values are examples.

| # | Rule / principle | Formula | Example (IRB 2600) |
|---|---|---|---|
| 1 | Supply current | I = S / (√3·U) | 4500 / (1.732·400) = 6.50 A |
| 2 | Protection + cable | I_b ≤ I_n ≤ I_z; I_z = I_table·f | C10 A; 1.5 mm²: 17.5·0.8 = 14 A |
| 3 | Voltage drop (≤ 5 %, IEC 60204-1) | ΔU% = √3·I·L·cos φ/(κ·A·U)·100; DC: ΔU = 2·L·I/(κ·A) | 1.22 % + 0.32 % = 1.54 %; 24 V, 25 m: 1.79 V → use 1.5 mm² (0.89 V) |
| 4 | Automatic disconnection (TN-S) | Z_s ≤ U0 / I_a (I_a = 10·I_n, C-curve), 0.4 s | 1.22 Ω ≤ 2.30 Ω; sockets: 30 mA RCD |
| 5 | DC bus + braking | V = √2·U_LL; E_cap = ½·C·(U₂² − U₁²); R ≤ U²/(1.2·P_peak) | 565 V; 243 J; J1–J3 stop: 1 691 J to a 33 Ω resistor |
| 6 | STO / SBC | 2 channels remove gate-driver supply / brake current | STO is not isolation – 565 V stays; brake 24 V = released |
| 7 | 24 V supply | ECB per branch, PSU ≤ 80 %, 0 V earthed at ONE point (PELV) | 9.08 A of 20 A = 45 % |
| 8 | Dual-channel safety (Cat 3, PL d) | redundancy + test pulses + discrepancy + EDM; PFH_D = Σ subsystems | SF1 8.0·10⁻⁸ /h → PL d (robot PL d) |
| 9 | Safety distance (ISO 13855) | S = K·T + C, K = 1600 mm/s | T = 0.215 s → S = 344 mm |
| 10 | I/O | PNP sensor switches +24 V; flyback diode at every DC coil; 4–20 mA: p = (I−4)/16·range | 13.6 mA → 6.0 bar |
| 11 | EMC | PE in star, shields 360° both ends, power ≥ 200 mm from signals | pigtail → encoder errors |
| 12 | Cabinet heat | P_wall = k·A·ΔT; V̇ = 3.1·(P_loss − P_wall)/ΔT | 88.5 W − 52.5 W → 22 m³/h → fan 55 m³/h |

How they were checked (`/?rbitem=3&cktest#robot`): hand formulas = code, 17 safety-logic scenarios (e-stop cat 1, faults cat 0,
EDM, locking, T1/enabling), 24 automatic cross-references, item switch 1 ↔ 2 ↔ 3 without errors.

## Installation: foundation, vibration and levelling principles

The principles behind items **1 · Foundation, anchoring, vibration isolation** and **2 · Levelling, alignment,
geometric acceptance** of the Installation tab. Full explanation with worked numbers:
[docs/26_installation_foundation_alignment.md](docs/26_installation_foundation_alignment.md). Code: `web/instmech_calc.js`.
Example: HMC 500, 12 000 kg + 510 kg on 6 levelling bolts M30 × 1.5, total with APC / coolant / chips 16 170 kg. All values are examples.

| # | Rule / principle | Formula | Example (HMC 500) |
|---|---|---|---|
| 1 | Floor load | W = Σm·g; F_pad = k·W_pads/n | 158.6 kN; 1.5 · 122.7 / 6 = 30.7 kN |
| 2 | Pad pressure | p = F/A ≤ f_cd = 0.85·f_ck/1.5 | Ø160: 1.53 MPa ≤ 14.2 MPa (C25/30) |
| 3 | Punching (simplified) | v = F/(u₁·d), u₁ = 2π(a+2d) ≤ 0.035·k^1.5·√f_ck | 0.034 ≤ 0.456 MPa (h 300) |
| 4 | Isolated block | m_block = 1.5…3 × m_machine; H = m/(ρ·A) | 25 t → 5.8 × 3.4 × 0.60 m; cure 28 d (≥ 7 d) |
| 5 | Natural frequency | f_n = (1/2π)·√(k/m) ≈ 15.76/√δ[mm] | 150 kN/mm → δ 0.82 mm → 17.4 Hz |
| 6 | Transmissibility | T = √(1+(2ζr)²)/√((1−r²)²+(2ζr)²), r = f/f_n | 50 Hz: r 2.87 → T 0.152 (85 % isolated); isolation only when r > √2 |
| 7 | Wrong mount | r ≈ 1 → T ≈ 1/(2ζ) | grinder on rubber vs 12.3 Hz compressor: T = 2.39 (amplified!) |
| 8 | Axis reaction + rocking | F = m·a; ΔF = F·h/span/n | 10.6 kN; ±2.25 kN/pad; tilt 0.002 (rigid) vs 0.082 mm/m (rubber) → HMC rigid |
| 9 | Vibration with distance (simple) | v = v₀·(1/r)^0.5·e^(−α(r−1)); v = √Σvᵢ² | press 12 mm/s → 2.99 mm/s at 8 m; floor limit 1.0 / 0.5 / 0.25 mm/s |
| 10 | Level | 0.02 mm/m = 4″; bolt Δh = turns · pitch | 1/32 turn = 0.047 mm; order Z → X → twist → auxiliary bolts |
| 11 | Bed on 6 bolts | Fᵢ = k(eᵢ − wᵢ); w = w₀ + a_x x + a_z z + c xz + b(z²−s) | twist = max−min of X readings ≤ 0.02 mm/m |
| 12 | ISO 230-2 | B = x̄↑ − x̄↓; R = max(2s↑+2s↓+abs(B), 4s); A = max(x̄+2s) − min(x̄−2s) | A 13.7 → 4.9 µm after pitch compensation |

Self-checks: `/?initem=1&imtest#inst`, `/?initem=2&imtest#inst` (console lines).

## Installation: electrical supply, protection, earthing and EMC principles

Tab **Installation**, items 3 + 4 (guide [docs/27_installation_electrical_emc.md](docs/27_installation_electrical_emc.md)).
Example line: 3 × HMC 45 kVA connected / 18 kW run, VMC 30 kVA, washer 30 kVA, robot cell 10 kVA, pallet pool 8 kVA,
fed from a 1000 kVA 20/0.4 kV Dyn11 transformer (u_k 6 %) via the main board and sub-distribution SD-ML1. TN-S.

| # | Topic | Formula / rule | Example |
|---|---|---|---|
| 1 | Design current | I_b = S/(√3·U) | 45 kVA → 64.95 A → breaker 80 A |
| 2 | Cable | I_b ≤ I_n ≤ I_z, I_z = I_tab·k_θ·k_group | 127 A × 0.96 × 0.73 = 89.0 A → 5G25 Cu XLPE |
| 3 | Line load | S_d = k_s·ΣS | 0.6 × 213 kVA = 127.8 kVA → 184.5 A → feeder 200 A, 4×95+50 |
| 4 | Voltage drop | ΔU% = √3·I·L·(R cosφ + X sinφ)/U·100 | 0.62 % + feeder 1.24 % = 1.86 % ≤ 4 % |
| 5 | Short circuit | Ik3 = c·U/(√3·Z), Z_T = u_k·U²/S | 24.4 kA (main board) · 12.3 kA (SD) · 6.8 kA (HMC) |
| 6 | Earth fault | Ik1 = 0.95·U0/Z_s ≥ I_a (TN-S, 0.4 s / 5 s) | Z_s 95 mΩ → 2.3 kA ≥ 960 A → instant trip |
| 7 | Selectivity | I_n,up/I_n,down ≥ 1.6 + short-time delay (LSI) | 200/80 = 2.5, t_sd 0.1 s |
| 8 | RCD / PE | drives → type B (or none in TN-S); leakage > 10 mA → PE ≥ 10 mm² | 28 mA → no 30 mA RCD |
| 9 | Harmonics | U_h = h·X·I_h, λ = cosφ/√(1+THDi²) | 3–4 % reactor: THDi 37 %, THDu 4.0 % (286.5 kW of drives), λ 0.91 |
| 10 | Unbalance | max deviation/mean ≤ 2 % | 402/398/405 V → 0.91 % |
| 11 | Common-mode noise | I_cm = C·dv/dt | 6 nF × 2.83 kV/µs = 17 A peak |
| 12 | Inductive coupling | U = M·di/dt, M = μ0/(2π)·l·ln((r+w)/r) | 191 nH → 16 V spike; twisted pair < 2 V |
| 13 | Pigtail | X = 2π·f·L, L ≈ 1 nH/mm | 50 mm at 10 MHz = 3.1 Ω → use 360° clamps |
| 14 | Long motor cable | l_c = v·t_r/2, U_pk ≈ U_DC·(1+Γ) | 15 m; 25 m cable → 1045 V at the motor |
| 15 | Segregation | motor ↔ signal/network ≥ 300 mm or earthed divider, cross at 90° | tray checker: bad layout 12 of 19 pairs fail |

Earthing: one meshed earthing system, N–PE link only at the MET, machine bases / trays / pipes bonded – no separate
"clean earth". Tests before switch-on (IEC 60364-6, IEC 60204-1 §18): PE continuity, insulation 500 V DC ≥ 1 MΩ,
phase sequence, voltage, loop impedance, RCD, earth resistance, power analyser. Code: `web/instelec_calc.js`.
Self-checks: `/?initem=3&ietest#inst`, `/?initem=4&ietest#inst`.
All values are examples – the real design and tests are made by a qualified electrician.

## Installation: sequence, rigging, utilities and run-off principles

Tab **Installation**, item 5 (guide [docs/28_installation_sequence_commissioning.md](docs/28_installation_sequence_commissioning.md)).
Self-check: `/?initem=5&istest#inst`. All values are examples – follow the maker's installation manual.

**Time plan = critical path method.** Forward pass ES = max(EF of predecessors), EF = ES + d; backward pass LF = min(LS of successors),
LS = LF − d; total float TF = LS − ES; TF = 0 → critical. HMC-01 example: machine build 110 d + FAT 5 + transport 21 → delivery day 136;
foundation drawings 21 + design 14 + pour 10 + curing 28 → ready day 87 → float 49 d. End: day 190
(2027-07-12 for an order on 2027-01-04). A 60-day stock machine makes the foundation critical (end day 141).
3-machine line (machines one week apart, one install team, line run-off): end day 212.

**Sling force** (θ from vertical): F = m·g / (n·cos θ). 12 000 kg, 4 legs, 30° → 117.72 / (4 × 0.866) = 33.98 kN.
A 4-leg sling is rated like 3 legs: 117.72 / (3 × 0.866) = 45.31 kN = 4.62 t → 5 t by the exact angle, but the EN 1492-2 marking table (angle band 0–45°, M = 2.1) gives 12.12 t / 2.1 = 5.77 t → **round sling 6 t** (the app now shows both and picks 6 t), shackle 4.75 t.
Keep θ ≤ 45° (60° = double force); use a spreader beam when the slings touch covers.
Forklift at a bigger load centre: Q_act = Q·c₀/c = 16 000 × 1 900 / 2 300 = 13 217 kg.
Transport locks: remove only after placing, and keep them. Check shock indicators before signing the delivery note.

**Compressed air** ISO 8573-1 class 1.4.1, 0.5–0.6 MPa at the machine. Line demand 910 NL/min × 1.1 leakage × 1.2 reserve
= 1 201 NL/min = 20 l/s. Pressure drop Δp = 450·q^1.85·L/(d^5·p) [bar, l/s, m, mm, bar abs]: 130 m, 32 mm → 0.056 bar (OK ≤ 0.1);
25 mm → 0.19 bar (too small). Ring main, drops from the TOP, drains at low points.
**Coolant** 800 L at 7 % = 56 L concentrate + 744 L water, oil INTO water; concentration = k × °Brix.
**Mist** Q = V_enclosure × air changes = 6 m³ × 5/min × 60 = 1 800 m³/h per machine.

**Commissioning order:** transport locks off → oil levels → power-on with e-stop pressed, measure voltages → alarms → home →
axis run-in → spindle run-in (500 → 6 000 rpm in 7 steps, 100 min) → lubrication → safety tests → backups.
**Acceptance:** FAT at the maker, SAT at site with the real crankcase. Cm = T/(6s), Cmk = min(USL − x̄, x̄ − LSL)/(3s) ≥ 1.67 on
50 consecutive parts; example Ø62 H7 (T = 30 µm), s = 2.064 µm → Cm 2.42, Cmk 2.24. Process Cpk ≥ 1.33.
Cycle-time proof (356.6 s vs 360 s quote), 8–24 h continuous run, documents (as-built drawings, backups, CE declaration).


## Hydraulics: element data book principles

Tab **Hydraulics → 1 · Element data book** (`web/hydlib*.js`, guide [docs/29_hydraulic_elements_data.md](docs/29_hydraulic_elements_data.md)).
All values are catalogue-class EXAMPLES – check the supplier's current catalogue. Reference job (docs/25): F 20 kN, bore 63 / rod 36,
p_sys 10 MPa, A 31.2 cm², annulus 21.0 cm², 18.7 L/min.

- **Pressure makes force, flow makes speed:** F = p·A, v = Q/A, power = p·Q. Every bar of throttling costs Q/600 kW of heat (Q in L/min).
- **Pump:** Q = V·n·η_v/1000; P = p[bar]·Q/(600·η_t). Gear 14 cm³ × 1450 × 0.92 = 18.7 L/min → 78 bar × 18.7 / 510 = 2.86 kW → 3 kW motor.
  Gear (cheap, 16–25 MPa) → vane (quiet) → axial piston (variable, 28–35 MPa; pressure compensator, load sensing, power limiter, EP).
- **Motor:** T = V·Δp·η_hm/(20π), n = Q·1000·η_v/V. Orbit 200 cm³, 140 bar → 379 N·m; 40 L/min → 180 rpm. Hold with a spring-applied brake.
- **Cylinder:** rod-side intensification p·A/A_ann (14.9 MPa in the example); buckling F_k = π²·E·I/(K·L)², safety ≥ 3.5
  (rod 36 at 1.9 m only 2.4 → rod 45: 5.8). Mounting codes ISO 6099; tie-rod ISO 6020-2, mill type ISO 6022.
- **Directional valves:** ISO 4401 NG6–NG32 (≈ 60–1100 L/min). Δp ∝ Q² (NG10: 0.6 MPa at 60 → 1.35 MPa at 90 L/min). The centre type decides
  pump unloading and load holding. Spool valves always leak (5–50 cm³/min) → never hold a load with a spool alone.
- **Pressure valves:** relief (direct = steep override, pilot-operated = flat), reducing (normally open), sequence, counterbalance:
  p_set ≥ 1.3·p_load (6.41 → 8.5 MPa), pilot to open = (p_set − p_load)/ratio = 0.52 MPa at 4:1.
- **Flow valves:** throttle Q = Cd·A·√(2Δp/ρ) (Ø2 mm, Δp 5 MPa → 13.1 L/min) changes with load and viscosity; pressure-compensated keeps Q constant
  above Δp_min ≈ 0.6–1 MPa. Meter-out for running-away loads, meter-in for resistive loads, bleed-off for low heat.
- **Lock valves:** pilot-operated check p_X ≥ (p_load − p_back)/φ (6.4 MPa, 4:1 → 1.48 MPa); double POC = hydraulic lock for clamps and vertical
  axes, needs float centre (A, B → T). Mount lock / counterbalance / hose-rupture valves directly on the cylinder port.
- **Accumulator:** V0 = ΔV/[(p0/p1)^(1/n) − (p0/p2)^(1/n)] with ABSOLUTE pressures, n = 1.4 for fast discharge (0.62 L → 4.2 L → 5 L bladder).
  Pre-charge 0.9·p1, N₂ only, safety block, PED by bar·L.
- **Conditioning:** ISO 4406 16/14/11 servo / proportional, 18/16/13 standard valves; β ≥ 200 (99.5 %). Tank 3–5 × pump flow per minute.
- **Lines:** d = 4.61·√(Q/v) (suction 0.5–1.2, return 2–4, pressure 3–6 m/s; 18.7 L/min at 4 m/s → 10 mm → tube 15×2.5);
  wall s = p·D/(2σ) + allowance; 24° cone ISO 8434-1, SAE flanges ISO 6162, hoses EN 853/856 (4:1 burst factor, ~6-year life).
- **Fluids:** HLP 46 standard; keep 16–36 mm²/s in operation, ≤ 800–1000 mm²/s at cold start.

Self-check `/?hyitem=1&hltest#hyd` (console lines HLTEST).

## Hydraulics: circuit and sizing principles

Tab **Hydraulics → 2 · Standard circuits, 3 · System sizing** (guide [docs/30_hydraulic_circuits_sizing.md](docs/30_hydraulic_circuits_sizing.md)).

- A spool valve always leaks (5–15 µm clearance): a held load needs a seat valve – pilot-operated check (clamps, slow axes)
  or counterbalance valve (moving vertical loads), mounted on the cylinder port. Example drift without it: ≈ 20 mm/min.
- Pilot check opens at p_X ≥ p_load / k; the valve centre must vent the pilot lines (open H or float Y), else the load drifts.
- Counterbalance: setting 1.3 × load pressure, opens when p_load + k·p_pilot ≥ p_set; lowering speed = pump flow / A2, no runaway.
  Ratio 3:1 for unstable loads, 8:1 for stiff machines.
- Speed control: meter-in v = Q/A1, meter-out v = Q/A2 with rod-side intensification p·A1/A2 (14.5 MPa in the example),
  bleed-off v = (Q_P − Q)/A1 (efficient, cannot hold pulling loads). Pulling loads → meter-out.
- Sequence: clamp via reducing valve (5 MPa from 10), work via sequence valve set ≥ clamp + 1–1.5 MPa, or pressure switch + PLC.
- Regenerative: v = Q/A_rod, F = p·A_rod – switch it off before the work stroke.
- Accumulator: absolute pressures, p0 = 0.9·p_min, n = 1.4 fast / 1 slow; hold time = ΔV / leakage (≈ 72 s in the example);
  pump unloading + check valve saves almost all idle power.
- Motor: n = Q·η_v/V, T = Δp·V·η_hm/(2π); brake valve for overrunning loads, anti-cavitation checks, cross-port reliefs,
  spring brake released by a shuttle – brake release pressure below the lowering pilot pressure.
- Supply: energy per 10 s example cycle – fixed pump + closed centre 28.5 kJ, tandem centre 15.7, pressure compensator 9.0, load sensing 7.8 kJ.
- Synchronising: flow divider (± 1–3 %, re-synchronise at the stroke end), mechanical link, or servo position control.
- Sizing (item 3): load list → p_sys → bore from F/(p_eff·η) + buckling (Euler/Tetmajer, K by mounting, safety 3.5) → flows → duty cycle →
  supply option by energy (motor ≥ RMS and ≥ peak/1.5) → accumulator → valve NG by flow → pipes d = 4.61·√(Q/v) + Barlow + Δp →
  heat vs tank cooling k·A·ΔT → cooler → filter by ISO 4406 target → BOM. Guide-25 job: Ø63/36, 6.75 MPa, 18.7 L/min, NG6, tube 15×2.5, 5 L bladder.

Self-check `/?hyitem=2&hctest#hyd`, `/?hyitem=3&hctest#hyd`. All values are examples – the supplier's catalogue and calculation decide.


## AS/RS raw materials: principles (tab "AS/RS raw materials", guides 31–34)

One raw-material store ASRS-RAW feeds the crankcase, cylinder and crankshaft lines. All four items of the tab show the SAME live
simulation (`web/asrscore.js`, `window.ASRS`): a fault injected in item 2 stops the crane in item 1, opens contacts in item 3 and makes
jobs wait in item 4. All values are examples – the AS/RS supplier's offer, the rack maker's EN 15512 calculation and the FEM 9.851
acceptance test decide.

**1 · Mechanical system (guide 31).** Rack 2 sides × 14 bays × 2 crates × 7 levels = **392 slots**; bay 100 + 75 + 800 + 75 + 800 + 75 =
1 925 mm, rack 27.05 m × 9.5 m, aisle 1.5 m, crate 1 200 × 800 × 600 mm ≤ 300 kg. Rack beam M = 699 N·m, δ = 1.04 mm ≤ L/200; inner upright
N = 20.6 kN; floor 21.8 kN per base plate. Single-mast stacker crane 4 200 kg: travel 3 m/s / 0.5 m/s² (P = (m·a + w·m·g)·v/η → 7.5 kW),
hoist 1 m/s (P = m·g·v/η → 11 kW), telescopic fork ± 1.35 m (1.1 kW). Wheel load max 30.2 kN. Mast = cantilever: δ = 1.9 mm, f₁ = 2.5 Hz.
FEM 9.851 (P1 = L/5, 2H/3; P2 = 2L/3, H/5; the slower axis decides): single cycle **34.8 s (103 jobs/h)**, dual cycle **57.8 s (125 jobs/h)**;
peak demand 40 jobs/h → about 35 % utilisation. Positioning budget ± 8.7 mm (x) / ± 8.2 mm (z).

**2 · Control system (guide 32).** WMS knows WHAT is where, WCS knows HOW loads move (job order, dual command, telegrams), the fail-safe crane
PLC PLC-ASRS-RAW (S7-1515F-2 PN, 10.54.0.31) knows WHEN each axis moves and IF it is safe. Trapezoid T = d/v + v/a (or 2√(d/a)); an S-curve
adds a/j but a ramp of one mast period cancels sway (8.8 mm static → 0.17 mm residual). Absolute positioning (laser for travel, bar code for the
hoist), fine positioning ± 3 mm. Mast is soft → K_v ≈ 2 1/s, speed feedforward essential (following error 1.5 m without, 75 mm with). Safety
(EN 528, ISO 13849): e-stops, aisle door with guard locking, safe reduced speed near aisle ends (stop at 3 m/s: Cat 1 4.95 m, Cat 0 7.33 m),
hoist overspeed / slack rope / overload, fork centre check, I/O light curtains with muting. Shared DC link: regen saves ≈ 65 % per dual cycle.

**3 · PLC + electrical circuits (guide 33).** Power to the moving crane over a conductor rail (4-pole + PE, two PE collectors) or energy chain;
size on the thermal current, check ΔU = √3·I·L·(R' cos φ + X' sin φ)/U at the far end (40 A rail: 0.78 % end feed / 0.39 % centre feed; supply
gG 40 A, 5G10). All axes on one DC link; braking rest to a resistor (R ≤ U_on²/(1.2·P_brk) → 27 Ω, 4 kW) or an active infeed (≈ 2.8 kWh per
operating hour back). Hoist: two brakes + SBC, overspeed governor, safe speed with two sensors, slack rope, load cell (stop at 110 %).
Safety circuit Cat 3 / PL d with PROFIsafe over the optical data link; I/O light curtain S = 2000·T + 8(d − 14), > 500 mm → 1600·T + 8(d − 14),
≥ 500 mm → **550 mm** in the example. Crane cabinet 382 W loss → ≈ 500 W cooling unit.

**4 · WMS / ERP / MES (guide 34).** One master per field: ERP = items + money, MES = orders + serials, WMS = slots + crates + lots, WCS = moves,
PLC = axes. Data model item → lot → quant → handling unit (crate, SSCC) → location ASRS-RAW-A01L-L3-S05. Retrieval FIFO by lot, never QI /
blocked stock; slotting by COI puts fast movers in front (37.1 → 30.3 s mean cycle). Inventory: SS = z·√(LT·σd² + d²·σLT²), ROP = d·LT + SS
(crankcase VC20: 62 / 200), EOQ = √(2DS/H) with the AS/RS slot cost (590 → 246). The lot is smaller than the lead-time demand → order on the
stock POSITION (on hand + open POs). Goods receipt: ASN → ID point → ISO 2859-1 sample (lot 120 → n = 13, Ac 0) → QI → release. Goods issue:
kanban → MES call-off → WMS FIFO → telegram → crane → outfeed → AGV. Release gate: 20 × VC20 needs 21 / 41 / 21 crates. Traceability:
heat → supplier batch → lot → crate SSCC → slot → job → work order → compressor serial.


**6 · Stacker crane – structure + manufacturing (guide 38).** Bottom carriage = welded box beam 2 900 × 420 × 160 (S355J2+N) on 2 wheel
blocks (Ø400, 42CrMo4, wheelbase 2.4 m, guide rollers); welded box mast 500 × 350 × 6 mm, 9.3 m, 6 diaphragms, bolted with 12 × M24 10.9
(≈ 770 N·m); top carriage with pulleys + guide rollers on the top rail; lifting carriage on 8 rollers with safety catch and load pins;
rope hoist (drum Ø250, 2 ropes Ø8; toothed belt = alternative); 3-stage telescopic fork. The mast is designed for **stiffness**, not
strength: δ 1.86 mm, f₁ 2.55 Hz, σ only 17.7 MPa. Wheel R_max 30.2 kN; rope Z_p 8.6, D/d 31 / 40; fork tip 4.9 mm (≤ ± 5 mm budget).
Manufacturing: CNC plasma / laser nesting → bevel → jig + tacks → MAG welding in a balanced (diagonal backstep) sequence (one corner
alone bows the mast ≈ 4 mm) → distortion check → flame straightening ≤ 650 °C → stress relief 580–620 °C **before** machining → boring mill
with datums A/B/C, H7 bearing bores → MT/UT → Sa 2½ + C3 paint 160 µm → marking (ISO 3834, EN 1090-2 EXC2 as practice, ISO 5817 C/B).
Site: rail survey → bottom carriage → mast erection, plumb ± 2 mm → top carriage → lifting carriage + reeving → fork → cabinet → load test
375 / 330 kg → FEM 9.851 cycle test.

**7 · Telescopic fork (guide 39).** One gear motor (1.1 kW, i = 1 400 / 238.7 = 5.86) drives 2 coupled shafts with 2 pinions per tine
(m 2, z 20, d 40 mm) on racks under the middle stages: s_mid = 675 mm at v = π·d·n/60 = 0.5 m/s. In each tine 2 roller chains (06B) are
anchored on the base and on the top stage and wrap a sprocket on the middle stage, like a pulley block: s_top = 2·s_mid = 1 350 mm,
v_top = 1.0 m/s. Chain force T = F_top/2 = 380 N per tine. F = m·a + μ·m·g = 450·1.2 + 0.05·450·9.81 = 761 N; P = 761·1.0/0.8 = 951 W →
1.1 kW. One stroke 1.35/1.0 + 1.0/1.2 = 2.18 s; load handling 2·2.18 + 0.5 = 4.87 s. Deflection = 3 cantilevers in series 2.64 mm + roller
play 2.27 mm = 4.9 mm; overlap L − s_mid = 325 mm, roller couple up to 5.70 kN. One central pinion needs L ≥ 2·s_mid → 2 pinions per tine
at ± 300 mm. The tines run between the crate runners (± 375 mm) with 40 mm under the floor, 28 mm over the beam, 30 mm at the side; lift
100 mm (40 mm to touch + 60 mm free).

## Ball screw + guide factory: principles (tab "Ball screw + guide factory", guides 40–47)

A new product line, built item by item. **Communication rule:** only Ethernet + Modbus TCP (machines, PLCs, test stands ↔ gateway) +
HTTP (gateway, MES, ERP, twin, AGV fleet, browser – REST / JSON, live push by Server-Sent Events). No MQTT, no OPC UA. Safety is
hard-wired. Reference products (shared data `web/bsfprod_data.js`): `BS-3210-1000-C5` ground ball screw Ø32 × 10, grade C5;
`BN-3210-FL` flanged nut (DIN 69051-5 style, internal deflector 4 × 1 turn, balls Ø6.35, C_a 38 kN / C_0a 76 kN, preload P1 = 3 % C_a);
`LG-25-1000` rail size 25 (4 raceways 45°, O arrangement); `LB-25-FL` flange carriage (C 34.9 kN / C0 52.8 kN, Z1). All values are examples.

**1 · Products (guide 40).** Feed v = n·P_h; drive torque T = F·P_h/(2π·η) (η ≈ 0.9); life L10 = (C_a/F_m)³·10⁶ rev with the cubic mean
load of the load cycle; buckling F_k and critical speed n_cr depend on the mounting (fixed-free … fixed-fixed); DN = d₀·n limits the nut
speed. Ball orbit speed = (1 − D_w·cos α/d_pw)/2 = 0.432 × screw speed. Guide: equivalent load with moments, L = (f_c·C/(f_w·P))³·50 km,
static safety f_s = C0/P_max. Selection HMC X axis (600 kg, 30 m/min, 3 m/s², 4 kN): Ø32 × 10 at 3 000 rpm → DN 99 000 → high-speed nut
needed; L10h 124 573 h, F_k 59 970 N, n_cr 4 921 rpm, peak torque 10.3 N·m; guide size 25: 112 776 h, f_s 10.5. Preload P1 opens at
F > 2.83·F_pr (3 226 N) → P2 for heavy cutting.

**2 · Manufacturing processes (guide 41).** Screw shaft (C5 ground): saw → straighten → face + centre → CNC turning → induction hardening
(30 kHz, 4 mm/s, case 2–3 mm, 58–62 HRC) → temper 170 °C → straighten ≤ 0.02 mm → cylindrical grinding → thread grinding with a single-rib
wheel tilted 5.51° (3 + 2 + 2 passes = 33.75 min) → laser lead check (C5: e_p ± 35 µm, v_300 18 µm). Variants W (hard whirling + finish
grinding) and R (rolled, C7). Nut: turning → holes + deflector windows → carburising → hard turning → internal thread grinding (Ø25 CBN wheel,
22 918 min⁻¹). Rail: cut → straighten → drill → induction-harden raceways → straighten → profile grinding. Carriage: HMC → carburising →
raceway form grinding → assembly → preload matching. Capacity: machines = Σ(cycle × quantity)/(available min × OEE); 120 screws + 120 nuts
+ 200 rails + 400 carriages per day (2 shifts, OEE 0.75) → 72 machines, bottleneck 8 thread grinders at 95.8 %; takt 7.5 / 4.5 / 2.25 min.
Physics: δ = 503·√(ρ/(μr·f)) (3.18 mm hot at 30 kHz); grinding burn (358 °C OK, 602 °C burn at double infeed); ΔL = α·L·ΔT = 10 µm/K.

**3 · Layout + live twin (guide 42).** Hall area = machine footprint 930.8 m² × space factor 2.75 + stores / aisle ≈ 3 480 m² → hall
80 × 48 m (columns 10 × 24 m, 9 m clear) + 80 × 8 m annex. From–to matrix: 93 AGV trips, 2 073 m loaded per day → 1 AGV + 1 spare.
Grinding room ≈ 126 kW heat to the air → ≈ 75 000 m³/h; transformer 1 600 kVA (≈ 1 265 kW demand with diversity). The live simulation
(`web/bsfsim.js`) gives ≈ 120 screw sets + 200 guide sets per day, plant OEE ≈ 0.69, bottleneck thread grinding (97 % busy), lead time
≈ 6 days (large transfer lots; half lots → 4.4 days, 3 shifts → 4.2 days). Little's law WIP = throughput × lead time (76.0 vs 73.7 lots).
7 instead of 8 thread grinders → 111 screws per day (hand value 109.6).

**4 · Communication (guide 43).** Every machine, PLC, test stand and energy meter is a Modbus TCP server (port 502); one gateway
(`vc-bsf-sup-gw01`, 10.60.30.10, standby gw02) is the only Modbus client. Above it everything is HTTP (REST + JSON, Server-Sent Events, long
polling). Network 10.60.0.0/16, VLAN 6xx ↔ 10.60.xx.0/24 (DMZ 610, OPS 620, SUP 630, cells 641–645, AGV Wi-Fi 650, utilities 660); e.g.
BS-TGR-03 = 10.60.43.16, unit 15. Register map per machine type: fast 0–11, counters + process 20–99, energy 100–103, command 200–226 (226 = gateway heartbeat, map V1.1, written by FC06 every 1 s); REAL /
UINT32 = 2 registers ABCD on even offsets. Polling 500 ms / 1 s / 10 s + heartbeat writes → 226.3 + 73 = 299.3 requests/s ≈ 62.0 kB/s = 0.5 % of 100 Mbit/s; time-out 300 ms,
1 retry, stale after 3 × 500 + 300 × 2 = 2 100 ms. MES order → machine: FC16 data block → FC06 toggle REQ → FC03 poll ACK / BUSY / DONE
(≈ 0.3 s, idempotent by `msgId`). Nothing starts until "Start Modbus sim + gateway" (`POST /api/bsf/control`); stand-alone
`python tools/bsf_modbus_sim.py --port 1502` + `python tools/bsf_gateway.py --target 127.0.0.1:1502 --http 8091`.

**5 · Quality + inspection (guide 44).** Control plan: 55 characteristics (21 critical), each with spec, gauge, sample / frequency, owner
and reaction plan, linked to the 17 quality gates. Lead of every C5 screw on a laser bench (1 mm steps over l_u 700 mm), ISO 3408-3: travel
line by least squares, E − T within ± 35 µm, v_up ≤ 25, v_300p ≤ 18, v_2πp ≤ 8 µm; corrected to 20 °C with α = 11.5 µm/(m·K) (1 K on 700 mm
= 8.05 µm). Preload torque Tp = 0.292 N·m inside ± 40 % (C5); rail class H running parallelism ≤ 16 µm; carriage height 36 ± 0.04 mm, pair
ΔH ≤ 15 µm. Capability example Cp 1.49 / Cpk 1.44; gauge R&R %GRR 9.5 %, ndc 14; lead uncertainty U = 1.57 µm (k = 2) → guard band
(ISO 14253-1). Results: PLCs → Modbus TCP registers (`meas`, `torque`) → gateway → HTTP; instrument PCs → `POST /api/bsf/qa/results`
(JSON, Idempotency-Key); MES confirmation `POST /api/bsf/mes/confirmations`.

**6 · MES (guide 45).** HTTP only (ERP, AGV fleet, print server, QA, browsers); machines only through the Modbus TCP gateway. One data model in
the browser (`web/bsfmes_core.js`, demo mode) and in the server (`twin/bsf_mes.py`, same paths, problem+json, Idempotency-Key). Work order
40 × BS-3210-1000-C5: route yield 0.938 → start 43 → lots 20 + 20 + 3; release checks heat lots, wheel + dresser set and gauge calibration
(missing → HTTP 422). Scheduler: forward, finite capacity, 2 shifts × 7.5 h (heat treatment 3), furnace loads, EDD / SPT / CR / FIFO / families,
drum-buffer-rope at the 8 thread grinders (release = drum start − upstream work − 16 h buffer); hand cases EDD Σ lateness 360 min, SPT 480,
CR 600; grinder EDD 580 vs families 520 min. Order download → FC16 200–225 + FC06 toggle + FC03 ACK; counter deltas → automatic confirmations
(idempotent). QA: gate NOK → hold, NCR → block, 2 of 3 NOK → SPC stop (423). OEE = A × E × Q (0.900 × 0.889 × 0.889 = 0.711); kanban
N = ceil(D × LT × (1 + α)/C) = 9 boxes of balls.

**7 · ERP (guide 46).** HTTP only (MES, supplier portals, customer order APIs, browsers) – never a machine. Machine hour rate =
(depreciation + interest + space + energy + maintenance)/hours: thread grinder 217 080 € / 3 750 h = 57.89 €/h. MRP: net = gross − on hand −
scheduled receipts + safety stock; EOQ = √(2DS/H) = √(2·60 000·80/0.18) = 7 303; SS = z·σ·√LT = 1.65·30·√9 = 148.5, ROP = 2 308.5. CTP on
the 8 thread grinders: 5 400 min/day capacity − 5 259 min planned. Standard cost: BS-3210-1000-C5 230.07 €, BN 104.71 €, LG 58.12 €,
LB 49.04 €, ball screw set 374.41 €, guide set 168.63 € (thread grinding op: 42.25 min → 54.35 € machine + 19.72 € labour). Example plan year:
EBIT 10.2 %, break-even at 17.4 of 20.25 working days per month. ERP → MES release with Idempotency-Key `erp-rel-<PO>`; MES books finished goods
back; sync pulls confirmations + serials and backflushes material. The finance part is a planning model, not legal bookkeeping.

**8 · PLC programs (guide 47).** Every PLC carries the standard machine interface: status word (RUN 1, IDLE 2, SET-UP 4, ALARM 8, E-STOP copy
16, BLOCKED 32, STARVED 64, NO SHIFT 128), 32-bit counters, heartbeat +1 per second, gateway watchdog (TOF 5 s: the machine finishes its lot,
READY = 0), toggle-bit MES handshake (FC16 data → FC06 REQ; PLC checks, answers result 0–4 and ACK = REQ in the same scan; BUSY while the lot
runs; DONE at the end), REAL in ABCD (212.5 → 0x4354 0x8000). Programs: induction scan 850 mm / 4 mm/s = 212.5 s at 35 kW, heat off in the same
scan when the quench is lost; straightening stroke = K × TIR/2, ≤ 3 bends; thread-grinder chiller ± 0.5 K → no finish pass, ± 1 K for 10 s → feed
hold + alarm; torque stand 360 samples → Tp, ΔTp, OK/NOK; run-in + E84 AGV port. PLC BOM for 38 machines ≈ 68.5 k€ (Delta) / 96.3 k€ (Siemens),
estimates. Delta: 32-bit values need the D-instructions (DMOV, DADD, DMUL, DLD>) – the generated listings do this.

## PLC ladder programs: principles (Delta + Siemens, guides 35–37)

Tabs **AS/RS raw materials → 5**, **Pallet changer → last card**, **Hydraulics → 4**. Each program is written for a **Delta AS332T-A**
(ISPSoft; small option DVP-ES3 with octal addresses) and a **Siemens** S7-1500 / S7-1200 (TIA Portal) side by side. **Safety rule:** the
standard ladder never does the safety function (e-stop, guard locking, light curtain / muting, STO, safe speed) – that is the safety
relay (Delta) or the F-program (Siemens) (ISO 13849-1, IEC 62061, IEC 60204-1); the PLC program only reads the status.
Addresses: Siemens byte.bit 0–7 (%I0.7 → %I1.0), Delta AS word.bit 0–15, DVP octal. Analog 4–20 mA: Siemens 0…27 648, Delta 0…32 000.
All addresses and values are examples – check with your PLC configuration.

### Shared core + AS/RS (guide 35)
- One ladder core (`web/ladder.js`) serves all three programs. A program = tags (name, Delta address, Siemens address, comment, wiring) +
  networks of rungs (series / parallel contacts, edges, compares, TON/TOF/TP, CTU/CTD → OUT / SET / RST, MOVE, CALCULATE).
- Every rung is written once and drawn for Delta (X0.0, Y0.0, M, S, "TMR T0 K20", C0) or Siemens (%I0.0, DB bits, TON PT T#2S) or both;
  the Delta instruction list and a Siemens SCL version are generated from it.
- The engine works like a real PLC: fixed scan 20 ms, read inputs (plant model) → networks top to bottom → write outputs.
  Timers count in scans (accuracy + 0 … 1 scan); each edge contact has its own memory bit; counters count rising edges.
- Classic mistakes found by the program check: double coils, unknown tags, Siemens bit > 7 (%I0.8 does not exist), octal DVP X8 / X9,
  writing to an input.
- AS/RS: step chain S10…S160 with SET next / RST own step, written from the last step to the first; actions written once; time-out →
  alarm 8000 + step (T_MOVE = 1.5 × 15.22 s + 2 s ≈ 25 s); WCS life bit lost → A0011 after 3 s; brake release 0.24 s after enable
  (STO feedback 0.05 s + 0.2 s); alarm = cause OR (alarm AND NOT ack).

### APC (guide 36)
- One step bit per step (S0 … S9). Transition = S(n) AND condition AND M_TrEn → SET S(n+1), RST S(n); written from the last step to the first,
  so the chain moves at most one step per scan. Each output written in ONE place; step actions need M_Auto, in manual the jog buttons take over.
- M_TrEn = (auto AND NOT single step) OR (single step AND rising edge of "Next"), AND NOT fault.
- M60 / FIN handshake: M60 read as a level; FIN stays ON until the NC drops M60 – never a fixed-time FIN pulse.
- Start interlock (guide 09 §24.2) in one rung: accumulator ≥ 10.7 MPa, oil ≥ 20 °C, arm down at 0° / 180°, clamped, both pallets present,
  station READY, curtain / doors OK, no fault. Charge request SET < 10.8 MPa, RST at 11.5 MPa; < 10.0 MPa for 0.5 s = F_PLow.
- Watchdog per step = 2 × nominal; step number into AlarmNo; Ack resets faults AND watchdogs = one retry.
- Timing: twin 20 ms scan → change 8.80 s (= page value); real PLC ≈ +30 ms per step ≈ 9.05 s. Delta 100 ms timers → K = s × 10.
- Analog 4–20 mA → Siemens 0…27 648, Delta 0…32 000: 10.7 MPa = raw 18 490 / 21 400. Wire break reads 0 MPa → F_PLow (safe direction).

### Hydraulics item 4 – HPU and circuits (guide 37)
- Pump start: KM1 + KM3 (star). T_YD 5 s starts from the KM1 feedback; KM3 opens; 0.1 s gap after the KM3 feedback; then KM2 (delta).
  Star and delta interlocked in software, by NC auxiliary contacts and mechanically. Feedback mismatch 0.5 s → alarm. Load only in delta (star torque = 1/3).
- Accumulator: cut-in 10.8 / cut-out 11.5 MPa with seal-in (hysteresis), recharge after every movement, charge time-out 20 s.
  Gas law p·V^1.4 = const: 0.153 L between the limits → charge 1.8 s, hold 61 s at 0.15 L/min leakage (simulated 1.84 s / 61.7 s).
- Ready = pump in delta, no trip, oil ≥ 20 °C, pressure ≥ 10.7 MPa for 1 s; stays ready down to 10.0 MPa; < 10.0 MPa for 3 s → alarm.
- 4–20 mA transmitter: p = raw · 16 / 27648 (Siemens); overflow 32767 = wire break → trip.
- Oil care: heater < 20 / ≥ 25 °C only with level OK; cooler > 50 / ≤ 45 °C; warning 55 °C; trip 65 °C after 2 s; level low → stop after 2 s;
  filter clogged (counts only ≥ 30 °C) → warning, stop after 60 s. Run hours from the 1 Hz clock edge, 32-bit, retentive.
- Step chains with SET next / RST own step; each valve output written once; two coils of one valve never together; watchdog per step.
- Vertical axis: float-centre 4/3 valve, pilot check + counterbalance (9.6 MPa = 1.3 × 7.39 MPa) + monitored seat valve; lock opens first,
  1Y2 waits 0.2 s after the lock feedback, lock closes 0.3 s after the stop (TOF).

Self-checks: `/?ladtest`, `/?sritem=5&ladAtest#asrs`, `/?ladBtest#apc`, `/?hyitem=4&ladCtest#hyd` (console, errors=0).


## Project design decisions (2026-11-12)

Three open conflicts were decided by the user (log: [docs/15](docs/15_numbering_and_identification.md) §8b D-29 … D-36). All values are examples – the supplier's datasheet decides.

| Topic | Decision | Main effects |
|---|---|---|
| HMC motor spindle | **10 000 rpm, 18 kW S1** (115 N·m S1 up to base speed 1 500 rpm; 22 kW / 140 N·m S6-40 %), HSK-A63, 18 kN | guides 08, 12, 18, 19, 20 re-calculated: n·dm 0.90·10⁶, balancing limit 7.64 g·mm per plane, run-in 1 250 … 10 000 rpm, BPFO 1 468 Hz; CNC tab limits power by torque below 1 500 rpm (P = min(18 kW, T·n/9550)) |
| APC lift hydraulics | **cylinder Ø50/28 at 10 MPa** | guide 09: accumulator 4 L, band 10.0 / 10.8 / 11.5 MPa, start ≥ 10.7 MPa, pump 1.5 kW, relief 13 MPa; real lifted mass 1 480 kg needs 9.4 MPa → reserve only **+7 %** (fixes in 09 §20.2) |
| Raw-material AS/RS | **392 slots** = 2 sides × 14 bays × 2 crates × 7 levels | config `bays: 28, slots: 392`; the start stock of 325 loads now fits (guide 03) |
| Finished-goods AS/RS crane (2026-11-13) | **60 s single cycle** (config unchanged) | shipping peak 50 retrievals in ≤ 50 min (guide 03) |
| AS/RS WCS host (2026-11-13) | **10.54.0.100**, `vc-log-wcsraw01`, VLAN 54 next to the crane PLC | guides 32, 34, AS/RS items 2 + 4 (guide 15 D-32) |
| Ball screw factory ERP economics (2026-11-13) | **accepted**: overhead 60 %, SG&A 15 %, list prices screw 420 € / nut 190 € / rail 110 € / carriage 68 € (examples) | margins 17–39 %, plan EBIT ≈ 10 % (guide 46) |
| Ball screw factory Modbus map (2026-11-13) | **V1.1**: gateway heartbeat at register 226, written every 1 s | Delta PLC watchdog (guides 43, 47) |

## Limits and next steps

* The machine models are simple box shapes, and the physics (temperature, vibration, wear) are first-order approximations. Tune them with real measurements. You can replace the 3D shapes with real CAD models (export to glTF/GLB and load them with Three.js `GLTFLoader`).
* The cycle times, MTBF and scrap rates in the config are reasonable example values, **not** data from your factory. Replace them with real measurements.
* AGVs follow fixed routes through one main aisle and do not block each other (no traffic control). The pallet-pool shuttle in 3D is illustrative; its time is part of the pallet change time.
* The ERP covers manufacturing only (no accounting, HR, payroll, quotations, invoices). MES/ERP data is kept in memory and restarts with **Reset**; finished units are also stored in `data/history.db` for traceability.
* The test-bench reject is scrapped (no rework loop yet).
* Not modelled yet: operators as a limited resource, shift calendars and breaks (this is where a bigger pallet pool helps), supplier delays. (Three product models VC10/VC20/VC30 ARE modelled – see FMS.)
* There is no login or security. Run it only on a trusted factory network.
