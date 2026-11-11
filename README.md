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
CNC, pallet changer, mechanical interfaces, AGV build, HMC build, real-factory roadmap) are in [`docs/`](docs/00_INDEX.md).
Start with `docs/00_INDEX.md`.

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
| **Mechanical elements – 1. pallet transfer AGV / cart ↔ APC** | `web/mech.js` (Three.js, offline). Parts to manufacture for handing the machining pallet (data from the Pallet changer tab) between an AGV with lifting chain deck – or a manual cart – and the APC load station: station table with 4 locating receivers, lift-transfer unit with 2 roller chains (strands between or outside the pull studs), gear motor, hydraulic lift cylinder, retractable stop, docking post with conical pin, shock absorbers and PU pads, lead-in funnel rails, height reference plate for the AGV deck sensor, E84 optical I/O, light curtain with muting. Animated 7-step transfer (deliver / pick up, AGV / cart) with E84 handshake and sensor timing incl. APC interlock; interface drawings (side + plan); calculations (heights, chain selection, drive, transfer time, slip/tipping, lift cylinder, docking energy, anchors, pin, AGV and cart stability, cell timing); checks incl. clearance to the turning APC rails and swing circle; height and lateral tolerance chains; BOM (MAKE/BUY); guide: interface sheet for the AGV supplier, manufacturing, installation, commissioning tests, PLC interlocks, maintenance. AGV stop error ±5–10 mm is solved with a floating deck (ball transfer units, centring springs, conical lock pin) and lift docking on 2 cone pins + machined stop faces (comparison of 5 concepts, animated front view, forces rigid vs floating). Deep links `?mxveh=cart&mxtask=pickup&mxview=dock&mxt=6&mxpart=cpin#mech`. |
| **Mechanical elements – 2. crate docking stand** | `web/mech2.js` (Three.js, offline). Crate stand beside the load station for castings in / empty crates out, used by an underride AGV and by a forklift: open frame, 4 self-centring V-guides (flare catches AGV ±10 mm and forklift ±50 mm), PU pads, bollards, sensors + RFID; crate with fork tunnels and nests; jib crane + gripper for the >23 kg castings. Animation (deliver / pick up, AGV / forklift, jib loading), guide section, plan view, calculations (heights, AGV stroke and leg clearance, guide angle vs friction, centring force, rail stress with forklift impact, jib foot moment), checks, tolerances, BOM, guide. Deep link `?mxitem=2&cxveh=fork&cxview=stand#mech`. |
| **Mechanical elements – 3. AS/RS ↔ AGV interface** | `web/mech3.js` (Three.js, offline). Front end of the raw-material AS/RS: stacker crane + racks (crate on 2 support angles), 2 I/O chain conveyors (IN / OUT) leaving the fenced crane area sideways: P&D position, bridge through the fence opening (muting light curtain, no stop position in the opening), contour check (light grids, weight, barcode/RFID) on the IN lane, AGV transfer position open below with side V-guides and end stop. Fence distance from the ISO 13855 safety distance S = 1600·T + 850. Animation OUT / IN, signal timeline (WMS, AS/RS PLC, conveyor, safety, fleet manager, AGV), example messages (WMS telegrams, VDA 5050 order, E84), plan view, real-environment requirements (floor, fire, dust, temperature, network, standards EN 528 / EN 619 / ISO 3691-4 / IEC 62046), calculations (crane utilisation, buffers, conveyor drive, clearances), checks, BOM, responsibilities + FAT/SAT tests. Deep link `?mxitem=3&axtask=in&axview=agv#mech`. |
| **Mechanical elements – 4. load station ↔ APC** | `web/mech4.js` (2D SVG, offline). Connection of the load station to the rotary pallet changer: animated pallet change (top view + side section, times from the Pallet changer tab), station mounting A bolted + dowelled to the APC base vs B floor frame, accuracy chains station → machine zero-point (±1 mm) and back to the receivers (±3 mm), pallet on the fork rails, clearances, interlocks, signals, checks, formulas, BOM, alignment procedure with a master pallet. Deep links `?mxitem=4&m4mount=base|floor&m4t=6#mech`. |
| **HMC build – 1. rotary table (B-axis, worm drive)** | `web/hmc.js` (2D SVG, offline), tab `#hmc`. How to machine and assemble an HMC rotary table: cross-section with 14 animated assembly + measuring steps (click parts for data), duplex worm backlash setting (interactive), contact pattern, process plans (housing, table, worm wheel, worm, clamp, cartridges), calculations (worm geometry, efficiency / self-locking, motor, clamp, tooth load, bearing, accuracy with / without direct encoder), checks, BOM, acceptance tests (ISO 230-2 / ISO 10791-1). Deep links `?hrstep=6&hrshift=2.6&hrplan=worm#hmc`. |
| **HMC build – 2. worm manufacturing twin** | `web/wormmfg.js` (2D SVG, offline). Process twin of the duplex worm from item 1 (geometry via `window.HMCROT`): 12 animated operations (saw, face + centre, rough turn, rough thread – whirling / single-point / disc milling, case hardening with T–t, carbon + hardness profiles, hardness + centre holes, cylindrical grinding, duplex thread grinding with burn risk Q'w, nital etch, gear measuring machine, test bench with master wheel, finish). Each worm gets a simulated part record (random variation, JSON download); 7 switchable process faults show where a fault starts and which check finds it. Inspection + test bench charts, route time/cost, lot simulation of 50 worms with Cpk. Deep links `?hritem=2&wmop=80&wmu=0.4&wmf=burn,thermal&wmsn=3#hmc`. |
| **AGV build – 1. underride lifting AGV** | `web/agv.js` (Three.js, offline). Self-built latent AGV for the crates of mechanical items 2/3: welded chassis with pockets, 2 sprung drive modules (BLDC + planetary, PU wheel), 4 castors, 4 selectable lift types – eccentric cam (2 shafts + chain + worm gear motor, self-holding at dead centre), screw jack, scissor, hydraulic – each with its own calculation, 3D unit, force/torque curve, checks, BOM and guide, plus a comparison table, LiFePO4 battery, control box. 3D with drive-under / lift / drive-away animation, exploded view, covers and safety field toggles, part data. Stop accuracy budget (localisation, creep x cycle, odometry, backlash, scanner mount, floor tilt, guide play; RSS) with navigation methods table and the 30-run measuring procedure; lift drawing + torque curve; control system diagram + I/O list; speed-dependent safety fields (ISO 3691-4); calculations (mass, drive, grip/braking, stability, lift, energy, fields), 19 checks, BOM, guide (make/buy, manufacturing, commissioning, tests, maintenance). Deep links `?avlift=screw&avview=lift&avt=9&avex=60&avpart=jack#agv`. |
| **AGV build – 2. servo drive control** | `web/agvdrive.js` (offline, no libraries). Control of the two drive motors of item 1 (values via `window.AGV`): control layers (fleet manager → navigation PC → kinematics → CANopen CiA 402 → drive cascade → motor), cascade explanation, tunable control simulator (position / speed / current loop, feed-forward, encoder steps, floor-step disturbance, real inertia from the AGV mass; speed, following error and current plots with hover), power + signal wiring diagram (battery, fuse, main switch, precharge, contactor, DC bus, brake chopper, DC/DC, STO, CAN) with sized parts list, interactive CiA 402 state machine with controlword / statusword and CAN frames, example code (kinematics + CANopen in Python, enable sequence + watchdog in Structured Text, cascade controller + odometry in C), object dictionary, 14 checks, calculations (current, inertia ratio, gains, regeneration / brake resistor, precharge, fuse / cable, CAN load), commissioning + tuning guide, fault table. Deep link `?avitem=2&adcode=st#agv`. |
| **AGV build – 3. pallet AGV** | `web/agvpallet.js` (Three.js, offline). 1 t AGV that brings the machining pallet (Pallet changer tab) to the APC load station of mechanical item 1: deck low while driving, scissor lift (2 servo actuators, force curve by virtual work, low actuator mounting = ~3.5 × load at the start), floating deck on ball transfer units with centring springs + electric lock pin, docking bushes on 2 cone pins, push-up against stop faces (current limit), deck chains + retention pawl, E84. 3D animation deliver / pick up, height stack, concept comparison (low deck + scissor vs fixed high deck), signal list, interface sheet AGV ↔ station, calculations (masses, heights, scissor, docking, drive, stability, chains, battery), 18 checks, BOM, guide + acceptance tests. Deep link `?avitem=3&aptask=pickup&apview=dock&apt=12#agv`. |
| **AGV build – 4. docking accuracy** | `web/agvdock.js` (2D SVG, offline). Animated step-by-step: how an AGV that stops ±10 mm hands over exactly. A pallet AGV → APC station (floating deck, cone pins, stop faces, receivers ±0.02 mm), B crate AGV → AS/RS (V-flare guides, conveyor stop, fork clearance, rack), C AS/RS → AGV → crate stand (errors add up on the AGV, guides reset them). Overview + real-scale magnifier + error ladder, stop-error slider with fault cases, accuracy chain, checks, formulas, rules, acceptance tests. Deep links `?avitem=4&dkscn=A|B|C&dke=6&dkt=8#agv`. |
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

## Limits and next steps

* The machine models are simple box shapes, and the physics (temperature, vibration, wear) are first-order approximations. Tune them with real measurements. You can replace the 3D shapes with real CAD models (export to glTF/GLB and load them with Three.js `GLTFLoader`).
* The cycle times, MTBF and scrap rates in the config are reasonable example values, **not** data from your factory. Replace them with real measurements.
* AGVs follow fixed routes through one main aisle and do not block each other (no traffic control). The pallet-pool shuttle in 3D is illustrative; its time is part of the pallet change time.
* The ERP covers manufacturing only (no accounting, HR, payroll, quotations, invoices). MES/ERP data is kept in memory and restarts with **Reset**; finished units are also stored in `data/history.db` for traceability.
* The test-bench reject is scrapped (no rework loop yet).
* Not modelled yet: operators as a limited resource, shift calendars and breaks (this is where a bigger pallet pool helps), supplier delays. (Three product models VC10/VC20/VC30 ARE modelled – see FMS.)
* There is no login or security. Run it only on a trusted factory network.
