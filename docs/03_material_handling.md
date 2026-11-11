# Guide 03 – Material Handling: AGVs, AS/RS, Pallet Pool, Transport Loops

> **All numbers in this guide are example values** taken from `config/factory.json`, from the twin code, or
> from example runs of the twin. They are not data from your real factory or from a supplier.
> Replace them with measured values and supplier data before you buy or build anything.

---

## 1. Purpose

Machines only produce if parts arrive on time and finished parts leave on time.
This guide explains the **material handling** of the twin:

- **AGVs** (automated guided vehicles): the fleet, vehicle states, battery and charging, how tasks are created and assigned.
- **AS/RS** (automated storage and retrieval system): rack slots, stacker crane cycle, job queue.
- **Pallet pool**: the fixture pallets that circulate in the crankcase machining cell.
- **Transport loops**: the kanban-type AGV routes between stores and machines.

For each part you get: how the twin models it, the formulas to size it (with the code's example numbers),
how to implement it in the real factory (fleet manager, VDA 5050, WMS, safety per ISO 3691-4),
commissioning tests, checklists, and mistakes to avoid.

Related guides and tabs: the FMS / order logic is in Guide 02. Mechanical interfaces (AGV ↔ station, AS/RS ↔ AGV,
docking accuracy) are designed in the tabs **Mechanical elements** and **AGV build**.

---

## 2. Where in the twin

### 2.1 Tabs and deep links

| What | Where | Deep link |
|---|---|---|
| Material handling panel (AGVs, AS/RS, pallet pool, transport loops) | Tab **Live factory**, card **Material handling** below the 3D view | `http://localhost:8080/` |
| 3D view of AS/RS, AGVs, chargers, routes | Live factory, camera **Logistics (AS/RS, AGV)** | `/?cam=logistics` |
| Castings per model at the load station, pallet pool in use | Tab **FMS & products**, card **FMS cell** | `/#fms` |
| Where each unit is (on AGV, at AS/RS entrance, in FG stock) | Tab **Order flow**, route map | `/#order` |
| AGV docking handshake (E84 style), AGV in the network diagram | Tab **FMS & products**, PLC section | `/#fms` |
| VDA 5050 / MQTT example messages | Tab **Communication** (step 10 "AGV brings castings to the load station") | `/?csstep=10#comm`, `/?cmmode=proto#comm` |
| Test AGV count, AGV speed, crane cycle, pallet count | Tab **What-if simulation**, table **Material handling** | `/#whatif` |
| Mechanical design of the interfaces | Tabs **Mechanical elements** (items 1–4) and **AGV build** (items 1–4) | `/?mxitem=3#mech`, `/?avitem=4#agv` |

### 2.2 Files

| File | What it contains |
|---|---|
| `twin/handling.py` | classes `Pool`, `ASRS`, `AGV`, `Transport`, `Handling` (dispatch, AGV step, receive, ship) |
| `twin/model.py` | `Buffer` (store / finished / per-model counts, `reserved`, `incoming`), machine `seize` / `release` of pallets |
| `twin/analytics.py` | bottleneck finder (crane / AGV fleet can be the bottleneck), battery alarm, what-if changes `agv`, `asrs`, `pools` |
| `twin/erp.py` | goods receipt → AS/RS put-away (`_receive`), shipping → crane retrieval (`_ship`) |
| `config/factory.json` | sections `pools`, `pallet_pools`, `asrs`, `agv`, `transports`; buffer keys `asrs`, `variant`, `per_variant`, `pos` |
| `web/ops.js` | `renderMH` – the Material handling panel |
| `web/factory3d.js` | 3D racks, cranes, AGVs, chargers, routes |

### 2.3 How to read the Material handling panel

| Card | Shows | Watch for |
|---|---|---|
| **AGV-01, AGV-02** | state in words, battery % (bar turns amber below 25 %), load (qty × part), current task, busy %, km driven | many minutes in "waiting for crane"; battery often low; busy % above about 75 % |
| **Raw material AS/RS** / **Finished goods AS/RS** | crane idle / storing / retrieving, slots used / slots, crane busy % (bar amber above 85 %), jobs waiting, stock per buffer | crane busy above 85 %; jobs waiting growing; FG slots near full |
| **Crankcase fixture pallets** | pallets in use / total, free pallets (bar amber at 0 free) | 0 free for a long time = pallets limit the cell |
| **Transport loops (kanban)** | per loop: trips, parts moved, active tasks | one loop with no trips while its line starves |

The card header shows the fleet size and the fleet busy share.
In 3D: AGV light **green** = driving, **amber** = loading or waiting for the crane, **blue** = charging. AGVs follow the **blue dashed routes**.

### 2.4 How to use it (10 minutes)

1. Open `/?cam=logistics`. Find the two AS/RS, the two chargers, the park positions, the main aisle.
2. Look at the Material handling card. Note AGV busy %, crane busy %, FG slots used.
3. Open **What-if**. In **Material handling** set **AGV fleet size = 1**. Run 8 h × 3 repetitions.
   Compare output and the bottleneck. (Expect the AGV fleet to become the bottleneck or very busy – see 4.2.)
4. Set the **Finished goods AS/RS crane cycle** to 120 s. Run again. Watch the FG crane utilisation (see 4.4).
5. Set **Crankcase fixture pallets = 4**. Run again. Watch the HMC utilisation (see 4.6).

---

## 3. Concepts explained simply

### 3.1 The material flow in this factory

```
Raw AS/RS ──AGV──> castings at load station (per model) ──> load station ──> pallet pool ──> HMC-01/02/03
Raw AS/RS ──AGV──> cylinder castings at boring ──> VMC ──> HONE ──> cylinder supermarket
Raw AS/RS ──AGV──> crankshaft forgings at lathe ──> LATHE ──> GRIND ──> crankshaft supermarket
Floor stores (tanks, motors per model) ──> final assembly (taken directly, no AGV in the twin)
Packaging ──> B_PK (3 places) ──AGV──> Finished goods AS/RS ──crane──> shipping
Supplier ──goods receipt──> crane put-away into Raw AS/RS
```

### 3.2 AGV fleet

Example fleet (`"agv"` in the config):

| Parameter | Value | Meaning |
|---|---|---|
| `count` | 2 | vehicles |
| `speed_m_s` | 1.2 m/s | driving speed (constant, no acceleration in the twin) |
| `load_s` / `unload_s` | 20 s / 20 s | time to take / give the load |
| `battery_h` | 8 h | battery time when driving or busy all the time |
| `charge_h` | 1.5 h | time to charge from 0 to 100 % |
| `low_battery_pct` | 25 % | go to the charger at or below this level |
| `aisle_z` | 12.3 m | position of the main aisle |
| `park` | 4 positions | where idle AGVs wait |
| `chargers` | 2 positions | charging stations |

**Route:** the twin drives "Manhattan" style: from the start point straight to the main aisle, along the aisle, then straight to the target (`Handling.route`).
If start and target are on one line, it drives directly.

**AGV states** (`handling.py`):

| State | Meaning | Counts as busy? |
|---|---|---|
| IDLE | no task, standing | no |
| TO_PICKUP | driving empty to the source | yes |
| WAIT_CRANE | at the AS/RS output, the crane has not yet brought the load | yes |
| LOADING | taking the load (20 s) | yes |
| TO_DROP | driving loaded to the destination | yes |
| UNLOADING | giving the load (20 s) | yes |
| TO_CHARGE | driving to a charger | no (but not available) |
| CHARGING | on the charger | no (available again from 60 %) |
| TO_PARK | driving to its park position after 45 s idle | no |

**When is an AGV available for a new task?**
- IDLE or TO_PARK **and** battery above 25 %, or
- CHARGING **and** battery at least 60 % (it leaves the charger early when work is waiting).

**Battery logic:**
- Driving or busy: battery drops by 100 % ÷ 8 h = **12.5 % per hour**.
- Standing (idle, parked): 15 % of that = **1.9 % per hour**.
- Charging: +100 % ÷ 1.5 h = **66.7 % per hour**, until 98 %, then IDLE.
- An IDLE AGV at or below 25 % goes to a **free** charger. If no charger is free, it waits (alarm below 10 %: "no free charger?").
- At start the batteries are 100 %, 93 %, 86 % … (7 % less per vehicle) so that not all vehicles need charging at the same time.

### 3.3 Transport loops (how AGV tasks are created)

A **transport** is a fixed loop "from buffer A to buffer B, batch n" (`"transports"` in the config):

| Loop | From | To | Batch |
|---|---|---|---|
| TR-CC10 / TR-CC / TR-CC30 | crankcase castings VC10 / VC20 / VC30 in Raw AS/RS | castings place at the load station `B_CC0` | 4 |
| TR-CYL | cylinder castings in Raw AS/RS | `B_CYL0` at boring | 12 |
| TR-CS | crankshaft forgings in Raw AS/RS | `B_CS0` at the lathe | 6 |
| TR-FG | `B_PK` packed compressors | Finished goods AS/RS | 1 |

Every **2 seconds** the dispatcher (`_dispatch`) checks every loop:

1. `q = min(batch, free space at destination, parts available at source)`. If q = 0 → no task.
2. If the destination is an **AS/RS** and its input conveyor is full (`io_capacity`, default 3 loads), no new delivery.
3. **Model-specific castings** (a source with `variant`) are brought **only if released work orders still need that model**
   (`variant_need` from the MES). Each model has its own places at the load station (`per_variant` = 4).
4. **No partial loads**, except when the line-side place is **completely empty** (then a smaller load is better than nothing).
5. All candidate tasks are sorted by **urgency**:
   - line side: `1 − (stock + incoming) ÷ capacity` (emptiest place first; per model for castings),
   - to a store: `(source stock − reserved) ÷ source capacity` (fullest source first – e.g. packaging output).
6. The most urgent task gets the **nearest available AGV** (shortest Manhattan distance to the source).

When a task is assigned, the source parts are **reserved** and the destination counts them as **incoming**.
So two AGVs never pick the same parts, and the destination is never over-filled.

If the source is in an AS/RS, a **crane retrieval job** is requested at the moment of assignment. The crane works while the AGV drives.
The AGV waits (WAIT_CRANE) only if the crane is not finished when it arrives.

### 3.4 AS/RS (automated storage and retrieval system)

Two AS/RS in the example:

| | Raw material AS/RS | Finished goods AS/RS |
|---|---|---|
| id | ASRS-RAW | ASRS-FG |
| Rack length | 28 m | 16 m |
| Levels | 7 | 5 |
| Bays (= length ÷ 1.4 m) | 20 | 11 |
| Slots (= 2 sides × bays × levels) | **280** | **110** |
| Crane cycle | 50 s per job | 60 s per job |
| Unit load (parts per slot) | VC10 casting 6, VC20 casting 4, VC30 casting 3, cylinder 12, crankshaft 6 | 1 compressor crate |
| I/O point (AGV pick-up / drop) | [−41, 9.6] | [−0.8, 18.5] |

**Crane logic** (`ASRS.step`):
- One crane per AS/RS. It does one job at a time. Every job (store or retrieve) takes the fixed `crane_cycle_s`.
- Jobs wait in a queue. **Retrievals go first** (production must not wait), then stores in arrival order.
- The slot position (bay, level, side) is chosen at random – it is only for the 3D animation.

**Which jobs exist:**
- **Goods receipt** (purchase order arrives): one **store** job per unit load. Example: 120 VC20 castings ÷ 4 per load = 30 store jobs = 30 × 50 s = 25 min of crane time.
- **AGV task from the raw AS/RS:** one **retrieve** job per AGV task.
- **AGV delivery to the FG AS/RS:** one **store** job per unit load (here 1 crate). It waits on the input conveyor until the crane takes it.
- **Shipping:** one **retrieve** job per unit.

**Stock in lots:** the raw stores keep stock in **lots** (FIFO). A withdrawal takes from the oldest lot first, and the part record keeps the lot number. That is how a finished compressor can be traced to its casting lot.

### 3.5 Pallet pool

The crankcase cell uses **10 fixture pallets** (`"pools": [{"id": "PAL-CC", "count": 10}]`).

- The load station **takes** a free pallet when it starts clamping (`"seize": "PAL-CC"`).
- The loaded pallet waits in `B_PAL` ("Pallet pool (loaded)", capacity 8).
- A machining center takes the pallet the dispatching rule chooses, machines the part, and **gives the pallet back** when it finishes (`"release": "PAL-CC"`).
- No free pallet → the load station waits ("No free fixture pallet").

**Why a pool:** the number of pallets is a hard **WIP limit** for the cell. Loaded pallets in front of the machines are a **buffer** that keeps the HMCs running while the load station stops (operator break, missing casting).

The 3D pallet rack (`"pallet_pools"`, 2 levels, 8 m) and its shuttle are only a picture; the shuttle time is inside the 15 s pallet change time of the HMC.

### 3.6 Buffers

| Buffer type | Config | Behaviour in the twin |
|---|---|---|
| normal | `capacity` | holds up to `capacity` parts; a full buffer **blocks** the station before it |
| supermarket | `capacity` + `per_variant` | in addition, max `per_variant` parts of each model |
| store in AS/RS | `asrs: "ASRS-RAW"`, `stock` | stock in lots; changed by goods receipts and AGV withdrawals |
| floor store | `store: true`, `stock`, `pos` | like above, but no crane (tanks, motors) |
| finished goods | `finished: true` (+ `asrs`) | counts everything that arrived; in an AS/RS the free space = slots − stock − incoming |
| line-side rack | a buffer with `pos` filled by an AGV | drawn as a flow rack in 3D |

---

## 4. Model and formulas (with example values)

### 4.1 Trip time of one AGV task

```
trip time = empty drive to source + crane wait + load time + loaded drive + unload time
drive time = route length ÷ speed
```

Route lengths in the example layout (Manhattan route through the aisle at z = 12.3 m):

| Loop | Loaded route | Loaded drive at 1.2 m/s |
|---|---|---|
| TR-CC10 / CC / CC30 (Raw AS/RS → load station) | 34.8 m | 29 s |
| TR-CYL (Raw AS/RS → boring) | 26.8 m | 22 s |
| TR-CS (Raw AS/RS → lathe) | 16.8 m | 14 s |
| TR-FG (packaging → FG AS/RS) | 34.5 m | 29 s |

**Example – FG trip:** AGV parked at [−7.2, 15.6] drives empty to packaging [24.6, 15.2]:
3.3 m + 31.8 m + 2.9 m = 38 m → 32 s. Then load 20 s + loaded 29 s + unload 20 s.

```
FG trip ≈ 32 + 20 + 29 + 20 = 101 s ≈ 100 s
```

**Example – casting trip:** empty drive park → Raw AS/RS ≈ 40 m → 33 s; crane needs 50 s, started at assignment → wait ≈ 50 − 33 = 17 s;
load 20 s; loaded 29 s; unload 20 s.

```
casting trip ≈ 33 + 17 + 20 + 29 + 20 = 119 s ≈ 120 s
```

### 4.2 AGV fleet size

```
trips per hour of a loop = parts needed per hour ÷ parts per trip
workload (vehicle-seconds per hour) = Σ (trips per hour × trip time)
AGVs needed = workload ÷ (3600 × target utilisation × availability)
```

Example at the **ideal factory rate of 17.2 units/h** (Guide 02, section 4.2):

| Loop | Parts per unit | Parts per trip | Trips/h | Trip time | Workload s/h |
|---|---|---|---|---|---|
| FG | 1 | 1 | 17.2 | 100 s | 1,720 |
| Castings (3 loops) | 1 | 4 (smaller loads happen) | ≈ 5.0 * | 120 s | 600 |
| Cylinders | 2 | 12 | 2.9 | 115 s | 334 |
| Crankshafts | 1 | 6 | 2.9 | 105 s | 305 |
| **Total** | | | **≈ 28** | | **≈ 2,960** |

\* In a 24 h twin run there were 100 casting trips for 345 units = 0.29 trips per unit (not 0.25), because per-model places hold only 4 and some loads are smaller. 0.29 × 17.2 ≈ 5.0.

```
availability (charging)   = 6 h work ÷ (6 h work + 1.1 h charging) ≈ 0.85   (see 4.3)
target utilisation         = 0.70  (leave room for peaks, traffic, blocked paths)
AGVs needed = 2,960 ÷ (3600 × 0.70 × 0.85) = 2,960 ÷ 2,142 = 1.38  → 2 AGVs
```

**Check against the twin:** 24 h run (EDD, 14.4 units/h): 582 trips = 24.3 trips/h, fleet busy 37 %.
Busy time per trip = 0.37 × 2 AGVs × 86,400 s ÷ 582 ≈ 110 s – close to the 100–120 s estimate.

**Redundancy:** with 2 AGVs, one breakdown leaves one AGV at about 2,960 ÷ 3,600 = 82 % workload (no charging reserve).
Decide whether you need **N + 1** vehicles, or a manual back-up (forklift / hand cart) for the FG loop. Note that the
FG loop is more than half of the workload: putting the FG AS/RS input **closer to packaging** (or a conveyor) is the cheapest way to save an AGV.

### 4.3 Battery and charging

```
drain while busy  = 100 % ÷ battery_h = 100 ÷ 8 = 12.5 %/h
drain while idle  = 0.15 × 12.5 = 1.9 %/h
charge rate       = 100 % ÷ charge_h = 100 ÷ 1.5 = 66.7 %/h
```

**Worst case (always busy):** 100 % → 25 % = 75 % ÷ 12.5 = **6 h of work**.
Charge 25 % → 98 % = 73 % ÷ 66.7 = **1.1 h**. Minimum charge to be available again (25 % → 60 %) = 35 ÷ 66.7 = 0.5 h.

```
availability = 6 ÷ (6 + 1.1) = 0.85
```

**At the twin's real load (busy 37 %):** average drain = 0.37 × 12.5 + 0.63 × 1.9 = 5.8 %/h → 75 ÷ 5.8 ≈ **13 h between charges**.

**Chargers needed:**

```
chargers ≥ AGVs × charging time ÷ (work time + charging time)  (+1 if the fleet is small)
2 × 1.1 ÷ 7.1 = 0.31 → 1 charger is enough on average; the config has 2 (no waiting, one spare)
```

Real batteries: use the supplier's energy data (Wh per metre, Wh per lift, standby power) and the battery's usable capacity
(LiFePO4 is often used between about 20 % and 90–100 %). Opportunity charging (short charges at stations) changes the calculation.

### 4.4 Crane utilisation and AS/RS throughput

```
crane utilisation = (stores per hour + retrievals per hour) × cycle time ÷ 3600
maximum moves per hour = 3600 ÷ cycle time
```

**Finished goods AS/RS** (cycle 60 s): every unit = 1 store + 1 retrieval (shipping) = 2 moves = 120 s.

```
max units/h through the FG AS/RS = 3600 ÷ 120 = 30 units/h  (at 100 %)
at 17.2 units/h: utilisation = 17.2 × 120 ÷ 3600 = 57 %
24 h twin run, 14.4 units/h: estimate 48 %, twin showed 45 %
```

Design rule: plan **≤ 80–85 %** crane utilisation (queues grow very fast above that). The panel turns the bar amber above 85 %.
The bottleneck finder names a crane (or the AGV fleet) as **bottleneck** when its recent busy share is above 88 % and above the busiest machine.

**Raw material AS/RS** (cycle 50 s), moves per finished unit (mix 30/50/20):

| Move | Per unit |
|---|---|
| retrieve castings (AGV trips) | 0.29 |
| retrieve cylinders (2 ÷ 12) | 0.17 |
| retrieve crankshafts (1 ÷ 6) | 0.17 |
| store castings from receipts (0.3/6 + 0.5/4 + 0.2/3) | 0.24 |
| store cylinders (2 ÷ 12) | 0.17 |
| store crankshafts (1 ÷ 6) | 0.17 |
| **Total** | **≈ 1.2 moves** |

```
at 17.2 units/h: 17.2 × 1.2 × 50 s ÷ 3600 ≈ 29 %
```

(The 24 h twin run showed 16 % because the start stock covered most of the day – few receipts were put away.)
Peaks matter more than averages: one receipt of 120 VC20 castings = 30 store jobs = 25 min of crane time in one block.
Because retrievals have priority, production is not stopped, but the put-away takes longer.

### 4.5 AS/RS slot sizing

```
slots needed = Σ over items ( maximum stock ÷ parts per unit load ) × (1 + reserve)
maximum stock ≈ safety stock + purchase lot   (just after a delivery)
```

**Raw AS/RS example** (safety stock and lot from the `erp.items` config):

| Item | Safety + lot | Unit load | Loads |
|---|---|---|---|
| CC10 casting | 60 + 120 = 180 | 6 | 30 |
| CC20 casting | 100 + 120 = 220 | 4 | 55 |
| CC30 casting | 40 + 60 = 100 | 3 | 34 |
| Cylinder casting | 300 + 240 = 540 | 12 | 45 |
| Crankshaft forging | 150 + 120 = 270 | 6 | 45 |
| **Total** | | | **209** |

```
with 15 % reserve: 209 × 1.15 ≈ 240 slots ≤ 280  → OK in steady state
```

**Warning (found while writing this guide):** the example **start stock** needs 240/6 + 360/4 + 120/3 + 900/12 + 480/6
= 40 + 90 + 40 + 75 + 80 = **325 loads**, more than the **280 slots**. The twin does **not** check raw AS/RS slots
(it only checks FG slots), so it runs anyway. In a real AS/RS this start stock would not fit. Reduce the start stock or add slots.

**FG AS/RS example (110 slots, 1 crate per slot):**

```
slots ≥ safety stocks + units waiting for incomplete orders + production between shipments
safety stocks = 6 + 10 + 4 = 20
hours of production the rest can hold = (110 − 20) ÷ 17.2 units/h ≈ 5.2 h
```

So if shipping stops for more than about **5 hours** at full output, the FG AS/RS is full and the line stops
(Guide 02, section 7.1 shows exactly this jam). If trucks leave once per shift (8 h), the FG store needs at least
20 + 17.2 × 8 ≈ 158 slots plus orders waiting for completion – or shipping must be more frequent.

### 4.6 Pallet pool size (Little's law)

```
Little's law:  pallets in the loop N = throughput λ × time a pallet spends in the loop W
```

Time per pallet without waiting: load station 89 s + HMC 343.5 s + pallet change 15 s = **447.5 s**.

| Situation | λ | N = λ × W |
|---|---|---|
| Cell runs at factory pace | 17.2/h = 0.00478/s | 0.00478 × 447.5 = **2.1 pallets** |
| All 3 HMCs fully busy | 30.1/h = 0.00836/s | 0.00836 × 447.5 = **3.7 pallets** |

That is the **minimum**. Add pallets as a buffer:

```
coverage time of loaded pallets = loaded pallets × HMC time per part ÷ number of HMCs
6 loaded pallets × 358.5 s ÷ 3 = 717 s ≈ 12 min of machining without the load station
```

Example design: 3 pallets in the machines + 1 at the load station + 6 loaded waiting = **10 pallets** (config value).
Too few pallets → HMCs starve when the load station stops. Too many → money in fixtures, floor space, and longer waiting (more WIP).
Use the what-if tab (pallet count 4, 6, 10, 14) to see the effect.

### 4.7 Buffer sizing

```
buffer to protect the downstream station ≥ consumption rate × time the supply can be interrupted
```

| Buffer | Example | Calculation |
|---|---|---|
| `B_PK` (packed, waiting for AGV), 3 places | AGV may need up to ~10 min to come (charging, other tasks) | at bottleneck pace 1 unit per 209 s: 3 × 209 s ≈ 10.5 min → **3 places** |
| `B_CC0` castings at load station, 4 per model | AGV casting trip ≈ 2 min + crane queue | 4 castings × 89 s ≈ 6 min of load-station work per model |
| `B_PAL` loaded pallets, 8 | load station stops (break, missing casting) | see 4.6: 6–8 pallets ≈ 12–16 min |

A buffer also protects **upstream**: when the downstream station is down, the upstream station can continue until the buffer is full.

```
time until the upstream station is blocked = free places × upstream cycle time
```

---

## 5. Implementing in the real factory – step by step

### Step 1 – Define the load units
1. For each material: container type (crate, pallet, bin), parts per container (the twin's `unit_load`), weight, dimensions with overhang.
2. One container standard for AS/RS **and** AGV **and** forklift if possible (the Mechanical elements tab uses a crate on its 2 long edges so a fork and an underride AGV both fit below).
3. Label every container (barcode / RFID): container ID, item, lot, quantity, model.

### Step 2 – Make a from–to matrix and calculate trips
1. List every transport: from, to, parts per hour per model, parts per trip.
2. Calculate trips per hour and trip time (section 4.1, 4.2) with the real layout.
3. Calculate AGV count, chargers, crane utilisation, slots (sections 4.2–4.5) for the **peak** hour, not only the average.
4. Put the real values into `config/factory.json` and run the what-if tab with 1, 2, 3 AGVs.

### Step 3 – Choose the vehicles
1. Load type decides the vehicle: crates → underride (latent) lifting AGV; machining pallets → pallet AGV with lift deck; finished crates → underride AGV or conveyor.
2. Navigation: natural-feature / laser-reflector / QR code floor grid / magnetic tape. Ask each supplier for **stop accuracy and repeatability** (typical claims are a few mm to ±10 mm; measure it – step 9).
3. Station interfaces must accept the vehicle's stop error (floating deck, cone pins, V-guides – see AGV build item 4 "docking accuracy").
4. Request the supplier's **VDA 5050** compliance and version, and a **factsheet** (dimensions, speeds, load, battery, safety fields).

### Step 4 – Fleet manager
The fleet manager is the "MES of the AGVs". It must do what the twin's `Handling` does, and more:

| Function | In the twin | Real fleet manager |
|---|---|---|
| Create transport orders | kanban loops every 2 s | from MES / WMS calls, or from its own kanban rules |
| Choose vehicle | nearest available AGV | nearest / lowest cost / battery-aware |
| Traffic control | **none** (AGVs pass through each other) | intersections, one-way aisles, deadlock prevention, waiting points |
| Charging | go to charger at ≤ 25 %, available from 60 % | charging strategy, opportunity charging |
| Station handshake | implicit | I/O handshake (E84 style) or messages per station |
| Error handling | none | blocked path, lost load, obstacle, timeouts, manual recovery |
| Reporting | busy %, km, trips | KPIs, order history, error log |

**VDA 5050** is the open interface between the fleet manager (master control) and the vehicles, published by VDA and VDMA.
It uses **MQTT** with **JSON** messages. Main topics: `order` (route as nodes and edges with actions), `instantActions`
(e.g. pause, cancel), `state` (position, battery, errors, load), `visualization`, `connection`, `factsheet`.
Benefit: vehicles of different suppliers under one fleet manager. Check the version (for example 2.x) both sides support.
The twin's Communication tab shows a **simplified** example of such an order message – not the full schema.

### Step 5 – WMS and AS/RS control
1. **WMS** (warehouse management system) knows every slot, container ID, item, lot, quantity, and reservations.
2. ERP → WMS: goods receipt expected (purchase order), shipping order.
3. WMS → AS/RS PLC (material flow controller): transport telegrams "store container X in slot Y" / "retrieve slot Y to output"; PLC → WMS: confirmation, faults.
4. MES → WMS: material call (castings of model VC20 for work order WO-0012) – like the twin's `variant_need`.
5. WMS → fleet manager: "container X ready at AS/RS output" → AGV order.
6. Rules to copy from the twin: **retrievals for production before put-away**, **FIFO by lot**, **reservations** (never promise the same container twice), **per-model counting**, **capacity alarm** for the FG store.
7. Front end: input conveyor with **contour check** (size), weight check, barcode/RFID read; reject lane for bad loads. Limit the input conveyor (the twin's `io_capacity` = 3 loads).

### Step 6 – Safety
**AGVs – ISO 3691-4** (driverless industrial trucks and their systems) is the main standard for AGV safety:
1. Do a **risk assessment** of the whole system (vehicles + routes + stations + people), not only of the vehicle.
2. Personnel detection: safety laser scanners (commonly type 3 per IEC 61496-3) with **speed-dependent protective fields**; bumpers where needed.
3. The standard defines zones of the operating area (for example restricted and confined zones) with rules for clearance, speed and marking. Mark routes on the floor; keep clearance to racks and machines as required.
4. Safety functions (emergency stop, speed limits, field switching, load handling) need the **required performance level (PLr)** given in ISO 3691-4; they are verified with ISO 13849-1/-2.
5. Warning lights and sounds when moving, turning, lifting.
6. Floor: flatness, slope, joints, cleaning, slippery spots. Ask the supplier for limits; measure the floor before go-live.
7. The **system integrator** is responsible for the whole system conformity (in the EU: CE marking under the machinery legislation). Agree in the contract who is the integrator.

**AS/RS:**
1. Stacker cranes: **EN 528** (safety of rail-dependent storage and retrieval equipment).
2. Fence and openings: safety distances per ISO 13857 (reach) and ISO 13855 (positioning of protective devices; e.g. S = 1600 × T + 850 mm for multi-beam light curtains, as used in the Mechanical elements item 3 tab). The 2024 edition of ISO 13855 changed parts of the method – verify the formula in the edition you use (guide 16).
3. Conveyors at the front end: EN 619. Muting light curtains at the AGV transfer: no stop position inside the fence opening.
4. Racks: design and tolerances by the rack supplier's standards (for example the EN 15512 / EN 15620 / EN 15635 family in Europe – check which apply).
5. Fire protection (sprinklers in high racks), maintenance access with lock-out, rescue of a person from the crane – follow local regulations and the insurer.

### Step 7 – Infrastructure
1. **Wi-Fi survey** along all AGV routes (roaming without loss of connection). Plan a separate network segment for AGVs.
2. Chargers: power supply, space, ventilation as the battery supplier requires, protection against collision.
3. Park positions out of the main aisle.
4. Floor marking and signs; pedestrian crossings.

### Step 8 – Connect to the twin
1. The twin can stay a **planning and training tool**: keep the config updated with real trip times, crane cycles, AGV count.
2. Optional: send real AGV positions and states from the fleet manager to a dashboard. (The current twin has no AGV ingest API – only machine data via `/api/ingest`. A bridge would need new code.)

### Step 9 – Commissioning tests

| # | Test | How | Pass criterion (set your own) |
|---|---|---|---|
| 1 | AGV stop accuracy | 30 dockings per station, measure x / y / angle | mean ± 3σ inside the station's capture range |
| 2 | Safety fields | test piece in the path at each speed and in curves; with max load | AGV stops before contact; matches the risk assessment |
| 3 | Emergency stop | E-stop at max speed, max load, on the steepest slope | braking distance ≤ the value in the risk assessment |
| 4 | Station handshake | every signal of the E84-style handshake, plus missing / late signal | nothing moves without the full handshake; timeouts give a clear fault |
| 5 | Communication loss | switch off Wi-Fi access point on the route | AGV stops safely and recovers; fleet manager shows the fault |
| 6 | Battery endurance | full shift at planned trips/h | no AGV below the low limit without a free charger |
| 7 | Throughput | run planned trips/h for 2 h, then +20 % | all transports done; no line starved by AGVs |
| 8 | Crane cycle time | measure single cycles to defined rack positions (FEM 9.851 describes a standard method) | ≤ the value used in the planning (twin: 50 s raw, 60 s FG) |
| 9 | Contour / weight check | oversized and overweight loads on the input conveyor | rejected, not stored |
| 10 | Inventory accuracy | count 100 random slots physically vs WMS | 100 % match (find the cause of every difference) |
| 11 | Pallet pool | run the cell with the planned pallet count for one shift | HMCs not starved by missing pallets |
| 12 | FG full test | simulate shipping stop | alarm before full; documented procedure |
| 13 | Recovery | person blocks an AGV, AGV loses load, crane fault mid-job | documented, trained recovery for each |

---

## 6. Checklists

### 6.1 Design checklist
- [ ] Load units defined (type, size, weight, parts per unit) and labelled.
- [ ] From–to matrix with parts per hour **per model**.
- [ ] Trip times calculated with real route lengths, speeds, load/unload times, crane waits.
- [ ] AGV count for the **peak** hour at ≤ 70–75 % utilisation, with charging availability; redundancy decided.
- [ ] Chargers: number, location, power.
- [ ] Crane utilisation ≤ 80–85 % at peak (including receipt put-away peaks).
- [ ] Slots: max stock ÷ unit load + reserve, for raw **and** FG; **start stock fits**.
- [ ] FG store holds the production between shipments (hours of output) + safety stock + orders waiting.
- [ ] Pallet pool: Little's law minimum + buffer; checked in what-if.
- [ ] Buffers: consumption rate × interruption time.

### 6.2 Interface checklist
- [ ] VDA 5050 version agreed with all vehicle suppliers and the fleet manager supplier.
- [ ] Station handshake signals listed (E84 style or similar), with timeouts.
- [ ] WMS ↔ AS/RS PLC telegrams defined (store, retrieve, confirm, fault).
- [ ] MES → WMS material call per model and work order.
- [ ] ERP → WMS goods receipt / shipping order; WMS → ERP confirmations.
- [ ] Lot and container ID kept through every move (traceability).

### 6.3 Safety checklist
- [ ] Risk assessment for the whole AGV system per ISO 3691-4 (routes, stations, people, other traffic).
- [ ] Safety fields per speed and per route section, documented and tested.
- [ ] Zones marked on the floor; clearances as required.
- [ ] AS/RS per EN 528; fence distances per ISO 13857 / ISO 13855; conveyors per EN 619.
- [ ] System integrator and CE / conformity responsibility written in the contract.
- [ ] Fire protection and rescue procedures approved locally.

### 6.4 Operation checklist (daily / weekly)
- [ ] AGV battery health, charger function, bumpers and scanner windows clean.
- [ ] Crane utilisation and jobs waiting trend (weekly).
- [ ] FG slots used vs alarm level.
- [ ] Pallet count physically = pallet count in the system; damaged pallets removed.
- [ ] Inventory spot check WMS vs physical.

---

## 7. Common mistakes and lessons learned

| Mistake | What happens | Better |
|---|---|---|
| FG store sized only for safety stock | a few hours without shipping → FG full → AGV cannot unload → packaging and the whole line block (Guide 02, 7.1) | size FG for production between shipments; FG capacity alarm; shipping rules **per model** |
| Average instead of peak | the crane is fine on average but a 120-casting receipt blocks it for 25 min | check peaks; split big receipts; retrievals first |
| Start stock larger than the AS/RS | material cannot be stored at go-live (example config: 325 loads for 280 slots) | calculate slots for the start stock too |
| AGVs bring material "to fill places" | line side full of a model nobody ordered; the needed model waits | bring model-specific material only for released work orders (twin: `variant_need`) |
| Partial loads all the time | many trips with few parts | full loads, partial only when the line-side place is empty |
| No reservations | two AGVs go for the same container; a place is over-filled | reserve source, count incoming at destination |
| AGV count from the average without charging | AGVs are "enough" on paper, but one is always charging | include availability (charging) and a target utilisation |
| FG input far from packaging | the FG loop takes more than half of all AGV time | short FG route or conveyor |
| Rigid docking for an AGV with ±10 mm stop error | jams, damage, operator calls | floating deck, cone pins, V-guides (AGV build item 4) |
| No plan for Wi-Fi | AGVs stop at dead spots | Wi-Fi survey before installation |
| Safety only for the vehicle | dangerous spots at stations and crossings | risk assessment of the whole system |
| Fixture pallets not tracked | lost or damaged pallets reduce the real pool | RFID on pallets; physical count = system count |

---

## 8. Limits of the twin

1. **No AGV traffic control.** AGVs follow fixed routes through one main aisle and pass through each other. No waiting at crossings, no deadlocks. Real trip times will be longer.
2. **Constant speed**, no acceleration, no curves, no slow zones, no lift time (only `load_s` / `unload_s`).
3. **Simple battery model:** linear drain and charge, no ageing, no temperature, no charge curve.
4. **No AGV breakdowns** and no maintenance of AGVs or cranes (machines have MTBF/MTTR, handling equipment has not).
5. **Crane cycle is fixed** per job, independent of slot position. No dual-command cycles (store + retrieve in one trip).
6. **One crane retrieval per AGV task**, even when the batch is more than one unit load (e.g. 4 VC30 castings = 2 loads of 3).
7. **Raw AS/RS slots are not enforced** (only shown). FG slots **are** enforced (AGV stops delivering when full).
8. **Slot position is random** and only for 3D.
9. **Floor stores (tanks, motors)** feed final assembly directly – no AGV, no forklift, no line-side stock.
10. **Pallet pool shuttle in 3D is illustrative**; its time is inside the 15 s pallet change.
11. **No forklifts, no manual carts, no operators.**
12. **No live AGV data input** – the twin cannot (yet) show the real fleet.
13. All values (speeds, cycles, battery, slots, unit loads) are **example values**.

---

## 9. Key formulas at a glance

| Formula | Meaning | Example | Section |
|---|---|---|---|
| `t = s/v + v/a` (if s ≥ v²/a), else `t = 2√(s/a)` | move time with acceleration (trapezoid / triangle profile) | AGV 25.4 m: 23.6 s | 10.1 |
| `t_move = max(t_x, t_y)` | crane: travel and hoist at the same time | 7.3 s to P1 | 10.2 |
| `t_SC = t(P1) + t(P2) + 2 t_LHD + 2 t_pos` | single-command cycle (FEM 9.851 points) | 35.6 s | 10.2 |
| `t_DC = t(P1) + t(P1→P2) + t(P2) + 4 t_LHD + 3 t_pos` | dual-command cycle | 58.8 s | 10.2 |
| `E(SC) = T (1 + b²/3)`, `E(DC) = T/30 (40 + 15b² − b³)` | Bozer–White travel time (constant speed) | 11.6 s / 15.7 s | 10.2 |
| `N = λ × W` | pallets in the loop (Little) | 3.7 pallets | 4.6, 10.3 |
| `E = V × Ah`, `C-rate = I / Ah` | battery energy, current ratio | 4.8 kWh, 0.5C = 50 A | 10.4 |
| `P = m g C_rr v / η + P_aux` | AGV driving power | ≈ 450 W | 10.4 |
| `AGVs = workload × traffic / (3600 × ρ_target × A_battery)` | fleet size | 1.77 → 2 (+1) | 10.5, 14 |
| `δ = 5 w L⁴ / (384 E I)` | beam deflection, uniform load | 0.25 mm | 10.6 |
| `s_stop = v t_r + v² / (2 a_b)` | AGV stopping distance | 0.96 m | 10.8 |
| `slots = Σ max stock / unit load × (1 + reserve)` | AS/RS size | 240 ≤ 280 | 4.5 |

---

## 10. Science principles

Queueing (utilisation, Kingman) is explained in guide `02`, chapter 10; reliability in guide `01`,
chapter 10. Here: the physics and maths of moving and storing loads.

### 10.1 Kinematics of a move – the trapezoid profile

A vehicle or crane axis accelerates with a (m/s²) to the top speed v (m/s), drives at v, and brakes
with a (same value assumed):

```
time to reach v:      t_a = v / a
distance needed:      s_a = v² / (2a)      (the same again for braking)
if s ≥ v²/a  (trapezoid):  t = 2 × v/a + (s − v²/a) / v  =  s/v + v/a
if s < v²/a  (triangle):   t = 2 × √(s / a),  top speed reached only √(s × a)
```

So acceleration adds **v/a** to every move (compared with constant speed). Example AGV with
v = 1.2 m/s, a = 0.5 m/s² (example values – ask the supplier): v/a = 2.4 s, v²/a = 2.88 m.

The twin uses **constant speed** (no acceleration, no turning, guide limit 8.2). Effect on the FG loaded
route (packaging → FG AS/RS, 34.5 m in 3 straight segments, AGV stops and turns at each corner):

| Segment | Length | Twin (s / 1.2) | With acceleration |
|---|---|---|---|
| packaging → aisle | 2.9 m | 2.4 s | 2.9/1.2 + 2.4 = 4.8 s |
| along the aisle | 25.4 m | 21.2 s | 21.2 + 2.4 = 23.6 s |
| aisle → FG I/O | 6.2 m | 5.2 s | 5.2 + 2.4 = 7.6 s |
| 2 turns on the spot (example 4 s each) | – | 0 | 8.0 s |
| **Total** | 34.5 m | **28.8 s** | **44.0 s (+53 %)** |

Lesson: enter in the config an **effective** speed = route length / real trip time measured or simulated
by the AGV supplier, not the top speed. Here 34.5 / 44 = 0.78 m/s instead of 1.2 m/s.

### 10.2 AS/RS crane cycle – single and dual command

A stacker crane moves **horizontally** (travel) and **vertically** (hoist) at the same time. The move ends
when the slower axis arrives:

```
t_move = max(t_travel, t_hoist)      (each axis with its own trapezoid, 10.1)
```

**Single command (SC):** I/O → slot → I/O, one store **or** one retrieval.
**Dual command (DC):** I/O → store in slot 1 → go to slot 2 → retrieve → I/O. Two jobs in one trip.

FEM 9.851 defines reference points for comparing cycle times: P1 at about (1/5 length, 2/3 height) and
P2 at (2/3 length, 1/5 height) from the I/O point (check the definition in the current FEM document).
Single cycle = mean of the cycles to P1 and P2; dual cycle = I/O → P1 → P2 → I/O.

**Example raw AS/RS** (rack 28 m, top load level 8 m above I/O; crane data are **example values**:
travel 3 m/s, 0.5 m/s²; hoist 1 m/s, 0.5 m/s²; load handling (fork in + out) t_LHD = 5 s; fine
positioning t_pos = 3 s per stop):

| Move | Travel x | t_travel | Hoist y | t_hoist | t_move |
|---|---|---|---|---|---|
| I/O → P1 | 5.6 m | triangle: 2√(5.6/0.5) = 6.7 s | 5.33 m | 5.33/1 + 1/0.5 = 7.3 s | **7.3 s** |
| I/O → P2 | 18.7 m | 18.7/3 + 3/0.5 = 12.2 s | 1.6 m | triangle: 2√(1.6/0.5) = 3.6 s | **12.2 s** |
| P1 → P2 | 13.1 m | triangle: 2√(13.1/0.5) = 10.2 s | 3.73 m | 3.73 + 2 = 5.7 s | **10.2 s** |

```
single cycle = (2 × 7.3 + 2 × 12.2) / 2 + 2 × 5 + 2 × 3 = 19.6 + 16 = 35.6 s  → 3600 / 35.6 = 101 jobs/h
dual cycle   = 7.3 + 10.2 + 12.2 + 4 × 5 + 3 × 3 = 29.8 + 29 = 58.8 s → 2 × 3600 / 58.8 = 122 jobs/h
```

Dual cycles give about 20 % more jobs per hour – but only when a store and a retrieval are waiting at the
same time. The twin does single cycles only, with a fixed 50 s (raw) / 60 s (FG) – conservative compared
with these example crane data.

**Quick estimate without acceleration (Bozer & White, 1984)** for random storage, I/O at the lower corner:

```
t_x,max = L / v_x,   t_y,max = H / v_y,   T = max of both,   b = min / max   (0 < b ≤ 1)
E(SC travel) = T × (1 + b²/3)
E(DC travel) = T / 30 × (40 + 15 b² − b³)
Example: t_x,max = 28/3 = 9.33 s, t_y,max = 8/1 = 8.0 s → T = 9.33 s, b = 0.857
E(SC) = 9.33 × (1 + 0.735/3) = 11.6 s     E(DC) = 0.311 × (40 + 11.0 − 0.63) = 15.7 s
+ fixed times: SC 11.6 + 16 = 27.6 s;  DC 15.7 + 29 = 44.7 s
```

This formula ignores acceleration, so it gives lower times than the FEM-point method above. Use it only for
first estimates; use the supplier's cycle time (measured per FEM 9.851) for the design.

### 10.3 Little's law for the pallet pool and for transport WIP

`N = λ × W` (derivation in guide 02, 10.1) works for any loop: fixture pallets (4.6), AGVs ("vehicles
busy = trips per hour × trip time / 3600"), and loads on the AS/RS input conveyor. Example AGVs:
24.3 trips/h × 110 s / 3600 = 0.74 vehicles busy on average = 37 % of 2 AGVs – exactly the twin's
fleet busy value (4.2).

### 10.4 Battery energy, C-rate and AGV energy use

```
energy      E [Wh] = nominal voltage V × capacity [Ah]
usable      E_use = E × (SoC_max − SoC_min)
C-rate      = current [A] / capacity [Ah]     (1C = full capacity in 1 h; 0.5C = in 2 h)
charge time ≈ ΔSoC × Ah / I_charge  (+ time for the constant-voltage end phase of lithium batteries)
```

**Example battery (example values):** LiFePO4, 48 V nominal (15 cells × 3.2 V), 100 Ah:

```
E = 48 × 100 = 4 800 Wh = 4.8 kWh
twin window 25 % → 98 %:  E_use = 4.8 × 0.73 = 3.50 kWh
charging at 0.5C = 50 A:  73 Ah / 50 A = 1.46 h ≈ the config charge_h = 1.5 h
grid energy per charge ≈ 3.50 / 0.9 (charger efficiency, example) = 3.9 kWh
```

**Power of a driving AGV** (example: vehicle 500 kg + load 500 kg = 1 000 kg; rolling resistance
coefficient C_rr = 0.015 for polyurethane wheels on concrete – example; drive efficiency η = 0.75;
auxiliary power for computer, scanners, Wi-Fi, lights P_aux = 150 W):

| Part | Calculation | Power |
|---|---|---|
| Rolling at 1.2 m/s | 1 000 × 9.81 × 0.015 × 1.2 / 0.75 | 235 W |
| Acceleration (6 starts per ≈ 100 s trip) | 6 × ½ × 1 000 × 1.2² / 0.75 / 100 s | 58 W |
| Lifting 500 kg by 60 mm, 1 lift per trip | 500 × 9.81 × 0.06 / 0.6 / 100 s | 5 W |
| Auxiliary | – | 150 W |
| **Driving** | | **≈ 450 W** |
| Busy average (70 % driving, 30 % loading / waiting at ≈ 160 W) | 0.7 × 450 + 0.3 × 160 | **≈ 363 W** |
| Standing idle (auxiliary only) | – | 150 W |

```
busy hours per charge   = 3.50 kWh / 0.363 kW = 9.6 h      (config: battery_h 8 h → conservative)
idle drain / busy drain = 150 / 363 = 41 %                 (twin assumes 15 % → optimistic for idle time)
peak current while accelerating ≈ (1 000 × 0.5 + 147) N × 1.2 m/s / 0.75 / 48 V ≈ 22 A = 0.22C
```

Lesson: on a real AGV the computer and safety scanners never sleep. Ask the supplier for the **standby
power** and correct the idle drain in your planning (in the twin it is the fixed factor 0.15 in
`twin/handling.py`).

### 10.5 AGV fleet sizing – the full formula

```
trip time   = empty drive + crane wait + load + loaded drive + unload       (10.1 for drive times)
workload    = Σ loops (trips/h × trip time)                                  [vehicle-s per h]
traffic     = factor for waiting at crossings, passing, blocked paths (1.1–1.3, example; ask supplier)
A_battery   = work time / (work time + charge time)
AGVs        = workload × traffic / (3600 × ρ_target × A_battery)            round UP, then N + 1 decision
```

ρ_target ≈ 0.70–0.75 keeps the waiting time for a vehicle short (guide 02, 10.3). Chapter 14 does the full
calculation with acceleration and turns.

### 10.6 Rack load physics

A rack beam pair carries the unit load. Simplified as a simply supported beam with uniform load w (N/m)
over the span L:

```
max. bending moment  M = w L² / 8
max. stress          σ = M / W_el            (W_el = section modulus)
max. deflection      δ = 5 w L⁴ / (384 E I)  (E = 210 000 N/mm² for steel, I = second moment of area)
```

Example (example values): design unit load 300 kg per slot (crate + castings), bay 1.4 m, 2 beams → each
beam 150 kg = 1 472 N → w = 1 472 / 1.4 = 1 051 N/m. Beam section with I = 1.0 × 10⁶ mm⁴,
W_el = 2.0 × 10⁴ mm³:

```
M = 1 051 × 1.4² / 8 = 257.5 N·m          σ = 257 500 N·mm / 20 000 mm³ = 12.9 N/mm²  (≪ 355 for S355)
δ = 5 × 1 051 × 1.4⁴ / (384 × 210 × 10⁹ × 1.0 × 10⁻⁶) = 0.25 mm
common limit L/200 (EN 15512 – check clause) = 1 400 / 200 = 7 mm  → OK
```

Upright and floor: each slot load goes to 4 beam ends (75 kg each). An inner upright gets beam ends from the
left and right bay on each level: 2 × 75 kg × 7 levels = 1 050 kg = 10.3 kN (+ rack weight). With a
150 × 150 mm base plate the contact pressure is 10 300 N / 22 500 mm² = 0.46 N/mm² – small; the slab
(punching, settlement) and anchors are checked by the structural engineer. Total stored mass of the raw
AS/RS at design load: 280 × 300 kg = 84 t.

Important for AS/RS: the rack also must meet **tight tolerances** (straightness, level, column plumb) so the
crane fork finds the slot – stricter than a manual pallet rack (EN 15620 and FEM 9.831 for crane racks;
check clauses). The rack supplier makes the full design (EN 15512); you give: unit load mass and size,
number of levels, seismic zone, floor data. Material values in guide 14.

### 10.7 Conveyors and accumulation (I/O front end)

```
drive force   F = μ × m × g        (μ = rolling resistance of the roller conveyor, often 0.02–0.05, example)
drive power   P = F × v / η
length for n waiting loads = n × (load length + gap)
transfer time per load = (load length + gap) / v
```

Example: 3 loads × 300 kg on the input conveyor (`io_capacity` = 3), μ = 0.03, v = 0.3 m/s, η = 0.7:
F = 0.03 × 900 × 9.81 = 265 N; P = 265 × 0.3 / 0.7 = 114 W. Length = 3 × (1.2 + 0.3) = 4.5 m;
transfer time = 1.5 / 0.3 = 5 s per load.

### 10.8 Stopping distance and protective field of an AGV

```
s_stop = v × t_r + v² / (2 × a_b)
t_r = response time of scanner + controller + brake; a_b = braking deceleration
protective field length ≥ s_stop + tolerances (scanner measurement tolerance, wheel slip, floor)
```

Example (example values – the supplier's data and ISO 3691-4 decide): t_r = 0.2 s, a_b = 1.0 m/s²:

| Speed | v × t_r | v²/(2 a_b) | s_stop | Field with + 0.2 m tolerance |
|---|---|---|---|---|
| 1.2 m/s | 0.24 m | 0.72 m | 0.96 m | ≈ 1.2 m |
| 0.6 m/s | 0.12 m | 0.18 m | 0.30 m | ≈ 0.5 m |
| 0.3 m/s (docking) | 0.06 m | 0.045 m | 0.11 m | ≈ 0.3 m |

The stopping distance grows with v²: half speed → about one third of the distance. That is why AGVs slow
down near stations and crossings (speed-dependent field switching).

### 10.9 Docking accuracy – statistics

Measure 30 or more dockings at a station: mean offset μ and standard deviation σ (x, y, angle).

```
capability index  C_pk = (capture range − |μ|) / (3 σ)
Example: capture ± 10 mm, μ = 1 mm, σ = 2 mm → C_pk = (10 − 1) / 6 = 1.5
```

C_pk ≥ 1.33 is a common target (it means the nearest limit is ≥ 4 σ away). With C_pk = 1.5 (4.5 σ) a
miss is a few-in-a-million event.

---

## 11. Detailed specification for implementation

### 11.1 Config keys of material handling (`config/factory.json`)

| Section.key | Unit | Default (code) | Range (recommendation) | Meaning |
|---|---|---|---|---|
| `pools[].id`, `.name` | text | – | – | fixture-pallet pool, e.g. `PAL-CC` |
| `pools[].count` | pallets | 6 | ≥ 1 (code, what-if) | number of fixture pallets |
| `pallet_pools[]` | m | – | – | 3D rack: `pool`, `buffer`, `pos`, `length`, `levels`, `shuttle_x`, `rail_z` (display only) |
| `asrs[].id`, `.name` | text | – | – | `ASRS-RAW`, `ASRS-FG` |
| `asrs[].pos`, `.rot` | m, ° | – | inside the hall | rack centre, orientation |
| `asrs[].length` | m | 20 | 5–150 | bays = max(4, int(length / 1.4)) |
| `asrs[].height` | m | – | 3–45 | 3D only |
| `asrs[].levels` | levels | 6 | 1–30 | |
| `asrs[].slots` | slots | 2 × bays × levels | ≥ 1 | override the calculated slot count |
| `asrs[].crane_cycle_s` | s per job | 60 | 20–180 | fixed time per store or retrieval |
| `asrs[].io` | m `[x, z]` | `pos` | – | AGV pick-up / drop point |
| `asrs[].io_capacity` | loads | 3 | 1–10 | loads that fit on the input conveyor |
| `asrs[].unit_load` | `{buffer: parts}` | 1 | ≥ 1 | parts per slot / per crane job |
| `agv.count` | vehicles | 0 | 0–20 | |
| `agv.speed_m_s` | m/s | 1.2 | 0.3–2.0 | use the **effective** speed (10.1) |
| `agv.load_s`, `agv.unload_s` | s | 20, 20 | 5–60 | |
| `agv.battery_h` | h | 8 | 2–24 | busy hours from 100 % to 0 % |
| `agv.charge_h` | h | 1.5 | 0.5–10 | 0 → 100 % |
| `agv.low_battery_pct` | % | 25 | 10–40 | go to charger at or below |
| `agv.aisle_z` | m | 0 | inside the hall | main aisle |
| `agv.park`, `agv.chargers` | list of `[x, z]` | `[[0,0]]`, `[]` | – | |
| `transports[].from`, `.to` | buffer id | – | must exist | loop source and destination |
| `transports[].batch` | parts | 1 | 1–unit load | parts per trip |
| `transports[].from_pt`, `.to_pt` | m | station or buffer `pos` | – | pick-up / drop point |
| buffer `asrs`, `variant`, `per_variant`, `pos` | – | – | – | store in an AS/RS, model, per-model limit, place |

**Fixed constants in `twin/handling.py`** (change in code only): dispatcher every 2 s; bay width 1.4 m;
idle battery drain 15 % of busy drain; charging stops at 98 %; a charging AGV is available again from 60 %;
idle AGV drives to park after 45 s; start batteries 100 %, 93 %, 86 % …; alarm below 10 %.

### 11.2 Data structures

**AGV snapshot** (`GET /api/state` → `handling.agvs[]`): `id, state, x, z (m), path, dist (m left),
speed (m/s), battery (%), load {part, qty, v}, task (loop name), util (busy share), km (odometer)`.
**AS/RS snapshot:** crane state, `slots`, `used`, `io_capacity`, jobs waiting, busy share, stock per buffer.
**Transport:** `id, name, from, to, trips, moved, open`.
**AGV task (internal):** `{tr: loop, qty, job: crane job, items: parts, t0: start time}`.

**WMS tables for the real factory (proposal):**

| Table | Key columns |
|---|---|
| `location` | location id (`ASRS-RAW-A01L-L2-S14`), store, aisle, side, level, slot, max mass kg, max height mm, status (free / occupied / blocked) |
| `carrier` | carrier id (`CRT-000123`), type, tare kg, current location |
| `stock` | carrier id, item / SKU, lot (`LOT-CC20-2546-003`), model, quantity, receipt time, reserved for (WO / SO) |
| `movement` | time (UTC, ISO 8601), carrier id, from location, to location, reason (receipt, call, ship), order id, user / system |
| `transport_order` | order id, from, to, carrier, priority, status, AGV id, created / started / done times |

### 11.3 Real equipment – specification tables to send to suppliers

All numbers are **examples** derived from the twin config; use your own final layout and loads.

**A) AS/RS (stacker crane + rack + front end)**

| Group | ASRS-RAW | ASRS-FG |
|---|---|---|
| Unit load | crate `CRT-…`, 1 200 × 800 mm footprint (example), max 300 kg (to define) | packed compressor on pallet, up to VC30 size (to define), max mass to define |
| Slots | ≥ 280 (≥ 240 steady state + start stock check, 4.5) | ≥ 110 now; ≥ 180 if trucks leave once per shift (4.5) |
| Throughput | ≥ 40 jobs/h at peak (receipt 30 loads + production calls) with single cycles; cycle per FEM 9.851 ≤ 50 s | ≥ 35 jobs/h (17.2 stores + 17.2 retrievals) + shipping peak 50 retrievals in ≤ 45 min; cycle ≤ 60 s |
| Strategy | retrievals before stores; FIFO by lot; dual cycles when possible | same; per-model stock limits |
| Accuracy | fork positioning per supplier; rack tolerances per EN 15620 / FEM 9.831 | same |
| Front end | input conveyor for 3 loads; contour check (height, width, overhang); weight check; barcode/RFID read; reject lane | same |
| AGV interface | transfer station at I/O point, handshake (E84 style or VDA 5050 actions) | same |
| Environment | hall 5–40 °C (ambient config 30 °C), dust from casting handling | same |
| Safety | EN 528 (crane), EN 619 (conveyors), fence ISO 13857, light curtains / muting ISO 13855, IEC 61496; rescue concept; fire protection with insurer | same |
| Interfaces | WMS ↔ material flow controller telegrams (store, retrieve, confirm, fault); OPC UA status to SCADA (crane state, faults, counts) | same |
| Documentation | rack calculation (EN 15512), layout, electrical drawings, signal list, manuals, spare parts, maintenance plan, rescue procedure | same |
| Acceptance | cycle-time test per FEM 9.851 (P1/P2, 10 cycles each); 2 h throughput test at planned peak; contour/weight reject test; 100 random slot inventory check = 100 % | same + FG-full alarm test |

**B) AGV fleet (vehicles)**

| Group | Requirement |
|---|---|
| Quantity | 2 + 1 (N + 1) or 2 + FG conveyor (chapter 14) |
| Load | crates up to 300 kg (to define); underride / lift deck; lift stroke ≥ 60 mm (example) |
| Speed | ≥ 1.2 m/s top; effective ≥ 0.8 m/s on the planned routes incl. turns (10.1) |
| Docking accuracy | ± 10 mm / ± 1° at stations with C_pk ≥ 1.33 (10.9) – or station capture range adapted |
| Battery | LiFePO4 (example) ≥ 4.8 kWh; ≥ 8 h busy between charges at planned duty; automatic charging; data: standby power, Wh/m, Wh/lift |
| Navigation | natural feature / reflector / QR grid – supplier proposal; route changes by our staff |
| Safety | ISO 3691-4 (system), safety laser scanners Type 3 (IEC 61496-3) with speed-dependent fields, bumpers where required, E-stops, warning light and sound; safety functions with PLr per ISO 3691-4, verified per ISO 13849-2; battery per IEC 62133-2 and EN 1175 (check which apply) |
| Interfaces | VDA 5050 (version 2.x – agree the exact version) over MQTT; Wi-Fi on own SSID / VLAN 60 |
| Environment | floor flatness and slope limits stated by supplier; 5–40 °C; dust |
| Documentation | VDA 5050 factsheet, risk assessment contribution, manuals, spare parts, training |
| Acceptance | commissioning tests 1–7 and 13 in chapter 5, step 9 |

**C) Fleet manager (master control)**

| Group | Requirement |
|---|---|
| Functions | transport orders from MES / WMS and own kanban rules (copy of the twin logic: reservations, incoming, per-model need, full loads, urgency sort); nearest-vehicle dispatch; traffic control and deadlock prevention; charging strategy |
| Performance | order assignment ≤ 2 s; ≥ 40 transport orders per hour |
| Interfaces | VDA 5050 to vehicles; REST / OPC UA / MQTT to MES and WMS; state of every AGV to SCADA (tags in 12.4) |
| Data | order history, KPIs (busy %, trips, km, battery), error log; export CSV |
| Acceptance | throughput test + 20 %; communication-loss test; recovery tests |

**D) Chargers**

| Group | Requirement |
|---|---|
| Number | ≥ 1 per 4 AGVs on average + 1 spare (calculation 4.3 / 14) – config has 2 |
| Power | e.g. 50 A at 48 V ≈ 2.4 kW DC (0.5C), supply ≈ 3 kW per charger (example) |
| Type | floor contacts or inductive, automatic docking |
| Safety | protection against collision; ventilation per battery supplier; electrical per IEC 60204-1 / local rules |
| Acceptance | 10 automatic docking + charging cycles without fault; charge time 25 → 98 % ≤ planned |

**E) Line-side places and buffers**

| Buffer | Requirement (config values) |
|---|---|
| `B_CC0` castings at LOAD-CC | 12 places, 4 per model, separate lanes per model, AGV drop by crate |
| `B_CYL0`, `B_CS0` | 24 cylinders / 12 crankshafts, FIFO flow rack, AGV drop point |
| `B_PK` packed units waiting for AGV | 3 places, roller conveyor with AGV transfer, sensor per place |
| Fixture pallet pool (PPS-1) | ≥ 10 pallets, 2 levels, shuttle; see guide 09 |
| All | place sensor (occupied / free) to PLC; marking per model; safe AGV transfer per EN 619 |

**F) Load carriers (crates)**

| Group | Requirement |
|---|---|
| Size | one footprint for AS/RS, AGV and forklift (e.g. 1 200 × 800 mm, ISO 6780 pallet size family – example) |
| Content per crate | castings VC10 6, VC20 4, VC30 3, cylinders 12, crankshafts 6 (config `unit_load`) |
| Mass | tare + content ≤ design unit load (300 kg example) |
| Protection | inserts so machined / cast surfaces do not touch |
| Identification | `CRT-<6 digits>`, label both sides + UHF RFID (guide 15) |

---

## 12. Identification and numbering

Scheme from `docs/15_numbering_and_identification.md` (guide 15) – if anything differs, **guide 15 wins**.

### 12.1 Equipment

| Object | Id (config / role) | Physical serial | Note |
|---|---|---|---|
| Raw / FG AS/RS | `ASRS-RAW`, `ASRS-FG` | supplier serial | tag form `ASRSRAW`, `ASRSFG` |
| AGV | `AGV-01`, `AGV-02` (role) | `AGV-2546-00001` (own-built) or supplier serial | the role keeps its id when the vehicle is exchanged |
| Charger | `CHG-01`, `CHG-02` | supplier serial | config `agv.chargers` order |
| Pallet pool system | `PPS-1` | – | config `pallet_pools` |
| Transport loop | `TR-CC10`, `TR-CC`, `TR-CC30`, `TR-CYL`, `TR-CS`, `TR-FG` | – | twin loop ids |

### 12.2 Storage locations

Format `<store>-A<aa>[L|R]-L<l>-S<ss>`; slot counted from the I/O point; two rack sides per aisle → `L` / `R`.

| Store | Range | Example |
|---|---|---|
| `ASRS-RAW` (1 aisle, 2 sides, 20 slots per side, 7 levels = 280) | `ASRS-RAW-A01L-L1-S01` … `ASRS-RAW-A01R-L7-S20` | `ASRS-RAW-A01L-L2-S14` |
| `ASRS-FG` (1 aisle, 2 sides, 11 slots, 5 levels = 110) | `ASRS-FG-A01L-L1-S01` … `ASRS-FG-A01R-L5-S11` | `ASRS-FG-A01R-L3-S07` |
| Floor stores and line-side places | `FLR-<area>-R<rr>-P<pp>` | `FLR-MCH-R01-P02` (castings VC20 at LOAD-CC), `FLR-FIN-R01-P01` (tanks 100 L) |

In the twin the slot position is random and only for 3D; the real WMS must use these codes.

### 12.3 Carriers, transport orders, VDA 5050 ids

| Object | Format | Example |
|---|---|---|
| Crate | `CRT-<6 digits>` | `CRT-000123` |
| Fixture pallet | `PAL-<4 digits>` | `PAL-0007` |
| Shipping pallet of a finished compressor | GS1 SSCC (18 digits) label + compressor serial | see guide 15, 3.16 |
| Transport order (fleet manager) | `TO-<YYWW>-<4 digits>` (proposal, same pattern as other orders) | `TO-2546-0147` |
| VDA 5050 `orderId` | = transport order id | `TO-2546-0147` |
| VDA 5050 `nodeId` | location id of the stop point (proposal) | `ASRS-RAW-IO`, `FLR-MCH-R01-P02` |
| VDA 5050 `serialNumber` | vehicle serial | `AGV-2546-00001` |

### 12.4 Tags (area `LOG`, line `L0`)

| Tag | Meaning | Unit |
|---|---|---|
| `LOG_L0_AGV01_State` | AGV state (code) | – |
| `LOG_L0_AGV01_BatterySoc` | battery state of charge | % |
| `LOG_L0_AGV01_PosX`, `LOG_L0_AGV01_PosY` | position in hall coordinates | m |
| `LOG_L0_AGV01_Trips_Cnt` | trips | pcs |
| `LOG_L0_ASRSRAW_CraneState` | crane state | – |
| `LOG_L0_ASRSRAW_SlotsUsed` | slots occupied | pcs |
| `LOG_L0_ASRSRAW_JobsWaiting` | crane queue | pcs |
| `LOG_L0_ASRSFG_SlotsUsed_Hi` | FG capacity alarm limit (e.g. 85 %) | pcs |
| `LOG_L0_CHG01_Current` | charging current | A |

### 12.5 Drawings and documents (codes from guide 15; running numbers are examples)

| Number | Content |
|---|---|
| `VC-FAC-LAY-0003-A` | AS/RS, AGV routes, park and charger layout |
| `VC-MEC-ASR-0001-A` | AS/RS ↔ AGV transfer station |
| `VC-MEC-DCK-0003-A` | crate docking stand (guide 10) |
| `VC-AGV-CHG-0001-A` | charger station |
| `VC-MEC-SPEC-0001-A` | AS/RS specification (11.3 A) |
| `VC-AGV-SPEC-0001-A` | AGV fleet and fleet manager specification (11.3 B, C) |
| `VC-AGV-RA-0001-A` | risk assessment of the AGV system (ISO 3691-4) |
| `VC-IF-AGV-ITS-0001-A` | interface sheet AGV ↔ fleet manager (VDA 5050, Wi-Fi) |

---

## 13. Standards for this topic

| Number | Title (short) | What it requires for us | Value / clause used | How to verify |
|---|---|---|---|---|
| ISO 3691-4 | Driverless industrial trucks and their systems – safety | risk assessment of the **system**; personnel detection; speed-dependent fields; braking; warning; operating zones; load transfer at stations | zones and clearances, PLr of safety functions (edition 2023 – check clauses); USA: ANSI/ITSDF B56.5 | risk assessment + verification tests (chapter 5, step 9) |
| ISO 13849-1 / -2 | Safety-related parts of control systems | PL design and validation of safety functions | PLr from ISO 3691-4 / risk assessment | validation report |
| IEC 61496-1 / -3 | Electro-sensitive protective equipment (laser scanners = part 3) | scanner type | Type 3 for AGV scanners (see guide 16) | certificate |
| ISO 13855 | Positioning of safeguards | safety distance S = K × T + C | light curtains at AS/RS openings; 2024 edition changed parts – verify | measure stopping time T |
| ISO 13857 | Safety distances (reach over / through) | fence heights and distances | AS/RS fence | layout check |
| ISO 12100 | Risk assessment | method | whole material-handling system | document `VC-AGV-RA-…` |
| EN 528 | Rail-dependent storage and retrieval equipment – safety | stacker crane safety, access, rescue | ASRS-RAW / ASRS-FG (verify edition) | supplier conformity + site test |
| EN 619 | Continuous handling equipment for unit loads – safety and EMC | conveyors, transfer stations | I/O conveyors, `B_PK` transfer | supplier conformity |
| EN 15512 | Adjustable pallet racking – structural design | rack calculation | beam deflection limit (span/200 – check clause), upright design | rack calculation by supplier |
| EN 15620 | Racking – tolerances, deformations, clearances | tolerance classes, floor flatness | automated racks: tight class; floor spec to building contractor | survey after erection |
| EN 15629 | Specification of storage equipment | what the user must specify to the rack supplier | basis of 11.3 A | – |
| EN 15635 | Application and maintenance of storage equipment | person responsible, inspection ≥ every 12 months by a competent person, damage classes | operation | inspection record |
| FEM 9.851 | Performance data of S/R machines – cycle times | reference points P1/P2 for single and dual cycles | 10.2; acceptance of crane cycle | cycle-time test |
| FEM 9.831 | S/R machines – tolerances, deformations and clearances in the high-bay warehouse | rack/crane tolerances | AS/RS rack (check current document) | survey |
| VDA 5050 | Interface AGV ↔ master control | MQTT + JSON topics `order`, `instantActions`, `state`, `visualization`, `connection`, `factsheet` | version 2.x – verify | interoperability test |
| ISO/IEC 20922 | MQTT v3.1.1 | message transport for VDA 5050 | broker in OT network | – |
| SEMI E84 | Parallel I/O handshake for carrier hand-off | signal sequence model for station hand-offs ("E84 style") | station handshake list | handshake test |
| IEC 62133-2 | Safety of secondary lithium cells and batteries | AGV battery safety | certificate from supplier | certificate |
| EN 1175 | Industrial trucks – electrical / electronic requirements | electrical safety of battery-powered trucks (check applicability to AGVs with supplier) | AGV electrics | conformity |
| ISO 6780 | Flat pallets – principal dimensions and tolerances | standard pallet sizes (e.g. 1 200 × 800, 1 200 × 1 000) | carrier footprint | – |

---

## 14. Complete worked example – sizing material handling for 17.2 units/h

Target: check the example design (2 AGVs, cranes 50 / 60 s, 280 / 110 slots, 10 pallets) at the ideal rate
17.2 units/h, with **real kinematics** instead of the twin's constant speed. Vehicle, battery and crane data
are the example values of chapter 10.

**Step 1 – From–to matrix** (mix 30 / 50 / 20)

| Loop | Parts/h | Parts per trip | Trips/h |
|---|---|---|---|
| TR-FG packaging → FG AS/RS | 17.2 | 1 | 17.2 |
| TR-CC10 / CC / CC30 castings | 5.16 / 8.6 / 3.44 | 4 (part loads happen) | 5.0 (0.29 per unit, 4.2) |
| TR-CYL cylinders | 34.4 | 12 | 2.9 |
| TR-CS crankshafts | 17.2 | 6 | 2.9 |

**Step 2 – Trip times with acceleration and turns** (10.1: each segment s/1.2 + 2.4 s, triangle below 2.88 m;
4 s per turn)

| Trip part | Segments | Time |
|---|---|---|
| FG empty: park → packaging | 3.3 + 31.8 + 2.9 m | 5.2 + 28.9 + 4.8 + 2 × 4 = 46.9 s |
| FG loaded: packaging → FG I/O | 2.9 + 25.4 + 6.2 m | 44.0 s (table 10.1) |
| **FG trip** | + load 20 s + unload 20 s | 46.9 + 20 + 44.0 + 20 = **131 s** (twin estimate 101 s) |
| Castings empty: park → raw I/O | 3.3 + 33.8 + 2.7 m | 5.2 + 30.6 + 4.6 (triangle) + 8 = 48.4 s |
| Crane wait | crane 50 s started at assignment | 50 − 48.4 = 1.6 s |
| Castings loaded: raw I/O → LOAD-CC | 2.7 + 7.8 + 24.3 m | 4.6 + 8.9 + 22.7 + 8 = 44.2 s |
| **Casting trip** | + 20 + 20 s | 48.4 + 1.6 + 20 + 44.2 + 20 = **134 s** (twin 119 s) |
| Cylinder / crankshaft trips | scaled like the casting trip (+ 13 %) | ≈ 130 s / ≈ 120 s |

**Step 3 – Fleet size (10.5)**

```
workload = 17.2 × 131 + 5.0 × 134 + 2.9 × 130 + 2.9 × 120 = 2 253 + 670 + 377 + 348 = 3 648 s/h
with traffic factor 1.1:  4 013 s/h
A_battery from step 4 = 0.90; target utilisation 0.70
AGVs = 4 013 / (3 600 × 0.70 × 0.90) = 4 013 / 2 268 = 1.77 → 2 AGVs  (each busy 4 013 / 2 / 3 600 = 56 %)
one AGV down: 4 013 / (3 600 × 0.90) = 124 % → the factory cannot run on one AGV
```

Options: (a) 3 AGVs (N + 1); (b) 2 AGVs + a conveyor from packaging to the FG AS/RS: the remaining
workload is (670 + 377 + 348) × 1.1 = 1 535 s/h → 0.7 AGV → 1 AGV runs it alone and the second is the spare.

**Step 4 – Battery and chargers (10.4)**

```
energy per AGV hour = 0.56 × 0.363 + 0.44 × 0.150 = 0.203 + 0.066 = 0.269 kWh/h
hours between charges = 3.50 / 0.269 = 13.0 h;  charge 1.46 h
A_battery = 13.0 / (13.0 + 1.46) = 0.90
energy per AGV per day = 24 × 0.269 = 6.5 kWh battery ≈ 7.2 kWh from the grid ≈ 0.86 USD/day at 0.12 USD/kWh
chargers = 2 × 1.46 / 14.46 = 0.20 → 1 charger + 1 spare (config: 2) ✔
```

**Step 5 – Cranes (10.2)**

| AS/RS | Jobs/h | Cycle | Utilisation |
|---|---|---|---|
| FG, single cycles, supplier example | 17.2 + 17.2 = 34.4 | 35.6 s | 34.4 × 35.6 / 3 600 = 34 % |
| FG, single cycles, twin value | 34.4 | 60 s | 57 % |
| FG, all as dual cycles (best case) | 17.2 pairs | 58.8 s | 28 % |
| Raw, 1.2 jobs per unit (4.4) | 20.6 | 35.6 s / 50 s (twin) | 20 % / 29 % |

Peaks: shipping 50 units = 50 × 35.6 s = 30 min (twin value: 50 min); one receipt of 120 VC20 castings =
30 loads × 35.6 s = 18 min (twin value: 25 min). Both ≤ 85 % of the hour → OK.

**Step 6 – Slots (4.5)**

```
raw steady state: 209 loads × 1.15 = 240 ≤ 280 ✔
raw start stock of the config: 325 loads > 280 ✘ → start with "safety + one lot" = 209 loads
FG: 110 slots → (110 − 20 safety) / 17.2 = 5.2 h without shipping
one truck per 8 h shift → 20 + 17.2 × 8 = 158 slots + orders waiting (say 20) = 178 → specify ≥ 180 slots,
e.g. 16 bays (22.4 m) × 6 levels × 2 sides = 192 slots, or ship every 4 h
```

**Step 7 – Pallet pool (4.6)**

```
N_min = 30.1 / 3 600 × 447.5 s = 3.7 pallets;  + 1 at load station + 6 loaded buffer (12 min) → 10 ✔
```

**Step 8 – Rack and floor (10.6)**

```
beam deflection 0.25 mm ≤ 7 mm ✔;  upright 10.3 kN;  base-plate pressure 0.46 N/mm²;  stored mass raw AS/RS 84 t
```

**Step 9 – AGV safety field (10.8)**

```
at 1.2 m/s: s_stop = 0.24 + 0.72 = 0.96 m → protective field ≈ 1.2 m (example – supplier and ISO 3691-4 decide)
```

**Result summary**

| Item | Example design | Check result |
|---|---|---|
| AGVs | 2 | enough at 56 % busy, **no redundancy** → 3 AGVs or FG conveyor |
| Chargers | 2 | ✔ (1 needed) |
| Config `speed_m_s` | 1.2 | use effective ≈ 0.8 m/s (10.1) |
| Config `battery_h` | 8 h | real estimate 9.6 h – OK; idle drain factor too low (15 % vs ≈ 41 %) |
| Raw crane | 50 s | ✔ (20–29 %) |
| FG crane | 60 s | ✔ (34–57 %) |
| Raw slots | 280 | ✔ steady state; ✘ config start stock |
| FG slots | 110 | ✘ if trucks leave once per shift → ≥ 180 |
| Pallets | 10 | ✔ |

---

## 15. Data you still need from suppliers / measurements

| What | Why | Who |
|---|---|---|
| Unit load data: crate size, tare, parts per crate, mass per model (castings, cylinders, crankshafts) | `unit_load`, rack design (10.6), AGV payload | foundry / forge, packaging design, logistics |
| Final hall layout with AGV routes, crossings, doors, slopes | trip lengths (14, step 2) | layout planner |
| AGV data: top speed, acceleration, braking, turn time, load / unload time, docking accuracy (C_pk) | trip time, safety field, station design | AGV supplier (VDA 5050 factsheet) |
| Battery: chemistry, Ah, voltage, usable SoC window, charge current, **standby power**, Wh/m | battery model (10.4) | AGV supplier |
| Fleet-manager simulation of our layout incl. traffic | traffic factor (10.5) | AGV supplier |
| Crane data: travel / hoist speed and acceleration, fork time, measured FEM 9.851 single and dual cycles | `crane_cycle_s` (10.2) | AS/RS supplier |
| Rack calculation and required floor flatness, slab loads | building design (10.6) | rack supplier, structural engineer |
| Conveyor and transfer-station data (speed, length, sensors) | I/O capacity (10.7) | conveyor supplier |
| Scanner response time and braking data | safety fields (10.8), risk assessment | AGV / scanner supplier |
| Wi-Fi survey of all routes | communication reliability | IT / Wi-Fi supplier |
| Truck / shipping schedule and order sizes | FG slots (4.5, 14 step 6) | sales / logistics |
| Supplier delivery sizes and frequency | receipt peaks for the raw crane | purchasing |
| Insurer and fire authority requirements for high racks | sprinklers, rack design | insurer, local authority |
| Measured trip times and crane cycles after commissioning | replace estimates in the config | logistics / industrial engineering |

---

## 16. Glossary

| Term | Simple meaning |
|---|---|
| **AGV** | Automated Guided Vehicle: a driverless vehicle that carries loads |
| **AMR** | Autonomous Mobile Robot: an AGV that plans its own path around obstacles |
| **Underride / latent AGV** | flat AGV that drives under a crate or rack and lifts it |
| **Fleet manager** | software that gives orders to all AGVs, controls traffic and charging |
| **VDA 5050** | open standard interface (MQTT + JSON) between fleet manager and AGVs |
| **MQTT** | light publish/subscribe message protocol over the network |
| **E84-style handshake** | parallel I/O signals between vehicle and station (request, ready, busy, complete), taken from the semiconductor standard SEMI E84 |
| **AS/RS** | Automated Storage and Retrieval System: high rack + stacker crane |
| **Stacker crane** | rail-guided machine that stores and retrieves loads in the AS/RS |
| **Crane cycle** | time for one store or one retrieval (twin: 50 s raw, 60 s FG) |
| **Single / dual cycle** | one job per trip / store + retrieve in one trip |
| **Slot** | one storage place for one unit load |
| **Unit load** | the container with its parts that goes into one slot (e.g. 4 VC20 castings) |
| **I/O point / P&D** | pick-up and drop position where AGVs give and take loads at the AS/RS |
| **Contour check** | light grid that rejects loads that are too big or badly placed |
| **WMS** | Warehouse Management System: knows every slot, container, lot, reservation |
| **Put-away** | storing goods after receipt |
| **Goods receipt** | booking delivered material into stock |
| **Lot** | quantity from one delivery / production batch, used for traceability |
| **FIFO** | first in, first out (oldest lot first) |
| **Pallet pool** | fixed number of fixture pallets that circulate in a cell; limits WIP |
| **Little's law** | WIP = throughput × time in the system |
| **Transport loop** | fixed AGV route "from A to B, batch n" created when the destination needs parts |
| **Reserved / incoming** | parts promised to an AGV task / parts on the way to a buffer |
| **Utilisation** | busy time ÷ total time |
| **Availability (AGV)** | share of time a vehicle is not charging or broken |
| **Safety laser scanner** | sensor that watches a protective field in front of the AGV and stops it |
| **Protective field** | area that must be free; its size changes with speed |
| **PLr** | required performance level of a safety function (ISO 13849-1) |
| **ISO 3691-4** | safety standard for driverless industrial trucks and their systems |
| **Trapezoid profile** | move with acceleration, constant speed and braking; time = s/v + v/a |
| **Single / dual command cycle** | crane trip with one job / with one store and one retrieval |
| **FEM 9.851 points P1 / P2** | reference rack positions used to state and test crane cycle times |
| **C-rate** | charge or discharge current ÷ battery capacity (0.5C = 50 A for 100 Ah) |
| **State of charge (SoC)** | battery filling level in % |
| **Effective speed** | route length ÷ real trip time incl. acceleration and turns |
| **Stopping distance** | distance from detection to standstill: v × t_r + v² / (2 a_b) |
| **C_pk** | capability index: (tolerance − mean offset) ÷ 3σ |
| **Storage location code** | `ASRS-RAW-A01L-L2-S14`: store, aisle + side, level, slot (guide 15) |
| **EN 528** | safety standard for rail-dependent storage and retrieval equipment |
| **Risk assessment** | systematic list of hazards, risks and protective measures |
