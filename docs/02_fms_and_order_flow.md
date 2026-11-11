# Guide 02 – FMS (three models on the same machines) and Order Flow

> **All numbers in this guide are example values** taken from `config/factory.json` and from the twin code.
> They are not data from your real factory. Replace them with real machine data, real supplier data and
> real time studies before you make decisions.

---

## 1. Purpose

This guide explains two parts of the digital twin:

1. **FMS (Flexible Manufacturing System)** – how the factory makes **three compressor models**
   (VC10, VC20, VC30) on the **same machines**: changeovers, tool magazines, kanban supermarkets,
   kit check and dispatching rules.
2. **Order flow** – how **one customer order** travels through the systems:
   ERP → MES → machines → finished-goods AS/RS → customer. You can do every step by hand
   (manual mode) or let the system do it (automatic mode).

Use this guide with your team to:

- understand **why** the twin behaves as it does,
- copy the **logic** (not only the machines) into the real MES/ERP and PLC programs,
- avoid the mistakes the twin already showed us (section 7).

The three models (example values):

| Model | SKU | Flow (FAD) | Motor | Tank | Price | Mix (share of demand) | Work content |
|---|---|---|---|---|---|---|---|
| VC10 | VC10-100 | 10 m³/h | 2.2 kW | 100 L | $890 | 30 % | 46 min |
| VC20 | VC20-300 | 20 m³/h | 4 kW | 300 L | $1,450 | 50 % | 56 min |
| VC30 | VC30-500 | 30 m³/h | 5.5 kW | 500 L | $2,150 | 20 % | 68 min |

"Work content" = the value `mes.work_s` that the code uses as the sort key of the SPT rule. **Correction:**
the code adds the station time of **every machine in the list**, so the three HMCs and the two test
benches are counted 3 × and 2 ×, the second cylinder is not counted, and the pallet change is not counted.
It is a good ranking key (VC10 < VC20 < VC30) but not the real work per unit. The **real work content
per unit** (one HMC, one test bench, two cylinders, no handling) is: VC10 **34.6 min** (2 075 s),
VC20 **41.4 min** (2 485 s), VC30 **50.2 min** (3 010 s).

---

## 2. Where in the twin

### 2.1 Tabs and deep links

| What | Where | Deep link |
|---|---|---|
| Models, rule, FMS cell, kanban, changeovers | Tab **FMS & products** | `http://localhost:8080/#fms` |
| PLC control of the cell (same tab, lower part) | Tab **FMS & products** | `/?plc=PLC-02#fms` |
| One customer order step by step | Tab **Order flow** | `/#order` |
| Work orders, serial numbers, genealogy | Tab **MES** | `/#mes` |
| Sales orders, MRP, purchase orders, stock | Tab **ERP** | `/#erp` |
| Test other rules / mix / tool sets offline | Tab **What-if simulation** | `/#whatif` |
| Units with blue serial tags in 3D | Tab **Live factory** | `/` (follows the order selected in Order flow) |

### 2.2 Files

| File | What it contains |
|---|---|
| `config/factory.json` | `products`, `fms`, station keys `setup_s`, `tool_magazine`, `pick`, `kanban`, buffer keys `per_variant`, `variant`, input key `alt` |
| `twin/model.py` | `Buffer` (per-model counting), `Machine._plan` (which part next), `_rule_key`, `_kanban_variant`, `_changeover`, `Factory` (rule, window, mix) |
| `twin/mes.py` | work orders, `gate` (order release), `rule_key`, `need_for` (castings needed), pegging of units |
| `twin/erp.py` | sales orders, make-to-order steps (`plan_so`, `buy_for_so`, `_auto_order`), MRP per model, shipping (`_ship`, `_fg_for`) |
| `twin/fms.py` | builds the JSON for the FMS tab (`GET /api/fms`) and the rule texts |
| `twin/engine.py` | `rule` command, `step` command (time stepping), `reset` with `mode: manual` |
| `web/ops.js` | `renderFMS` (FMS tab), `renderOrder` + `orderAction` (Order flow tab) |
| `web/index.html` | layout of both tabs, formula box "How this FMS works" |

### 2.3 How to use the FMS tab (5 minutes)

1. Open `/#fms`.
2. Read the **Product family** table: backlog, units to start, in production, in stock, finished – per model.
3. Look at the **Dispatching rule** card. The active rule is highlighted (default **EDD**).
   Below it: released work orders **in the order the rule will start them**.
4. Look at the **FMS cell** cards: load station (castings per model), pallet pool (in use / free),
   3 machining centers (model in the machine, tool magazine content, tool exchanges, OEE).
5. Look at **Kanban supermarkets**: one bar per model (dark = in the supermarket, light = in the line,
   amber mark = trigger level).
6. Look at **Changeovers per station**: time per change, number of changes, hours lost, share of time.
7. Click **SETUP** and set the **Batch window** (for example 48 h). Watch the changeover table
   for one or two simulated hours. Then go back to **EDD**. (See section 7.2 for what you will see.)

### 2.4 How to use the Order flow tab (10 minutes, manual)

1. Open `/#order`.
2. Press **Start empty factory (manual)**. The simulation restarts with no orders, and every automatic
   function is off (no random demand, no hourly MRP, no automatic release, no automatic shipping).
3. Enter: customer, model (for example VC20), **Qty 50**, **Due in 48 h**. Leave **automatic steps** unticked.
   Press **Create order**.
4. The 7-step bar appears. Press the button under it for each step:
   - **Create work order for 50 units** (step 2),
   - **Buy missing material** if something is short (step 3), then wait, step time, or press **Deliver now** (training shortcut),
   - **Release WO-xxxx to the shop floor** (step 4).
5. Press **+10 min** several times (or **+1 h**). Watch the route map: each serial number moves from
   machine to machine, onto the AGV and into the finished-goods AS/RS.
6. When all 50 units are in stock, press **Ship order** (step 7).
7. Click any serial number to see its route, its parts and their lots (genealogy).

Time buttons: **Pause / Run**, **+1 min**, **+10 min**, **+1 h**. They work while paused
(`POST /api/command {"action":"step","value":600}`; allowed range 1 s to 4 h per call).

### 2.5 API

| Call | Purpose |
|---|---|
| `GET /api/fms` | models, rule, rule texts, window, FMS cell, pallets, kanbans, changeovers, queue |
| `POST /api/command {"action":"rule","value":"EDD"}` | set the rule: `FIFO`, `EDD`, `SPT`, `SETUP` |
| `POST /api/command {"action":"rule","value":"SETUP","window_h":8}` | SETUP rule with a due-date window (0.5–168 h) |
| `GET /api/order?so=SO-0001` | the 7 stages, route map, units, material check, purchase orders, log |
| `POST /api/erp {"action":"create_so","customer":"X","qty":50,"due_h":48,"product":"VC20","mto":true,"auto":false}` | make-to-order sales order |
| `POST /api/erp {"action":"plan_so","id":"SO-0001","release":false}` | step 2: work order for this order |
| `POST /api/erp {"action":"buy_so","id":"SO-0001"}` | step 3: purchase orders for missing material |
| `POST /api/erp {"action":"receive_now","id":"PO-0003"}` | training shortcut: supplier delivers now |
| `POST /api/mes {"action":"release","id":"WO-0001"}` | step 4: release |
| `POST /api/erp {"action":"ship","id":"SO-0001"}` | step 7: ship what is in stock for this order |
| `POST /api/erp {"action":"so_auto","id":"SO-0001","auto":true}` | the system does the remaining steps of this order |
| `POST /api/erp {"action":"mode","mode":"auto"}` or `"manual"` | whole factory automatic or manual |
| `POST /api/command {"action":"reset","mode":"manual"}` | empty factory, manual mode |

---

## 3. Concepts explained simply

### 3.1 The model is written on every part (`v`)

Every part in the twin is a small record (a Python dictionary). The field **`v`** holds the model:
`"VC10"`, `"VC20"` or `"VC30"`.

- **Crankcase castings** are model-specific from the start. They come from three different stores
  (`RAW_CC10`, `RAW_CC`, `RAW_CC30`, each with `"variant"`), so the casting already has `v`.
- **Cylinder castings and crankshaft forgings** are the same raw part for all models (no `v`).
  The machine **gives** the part its model when it machines it (`"assign": True` in `_plan`):
  "the part becomes this model because we ran that model's NC program".
- **Tanks and motors** come from model-specific stores. The final-assembly input has an `alt` table:
  VC10 → 100 L tank + 2.2 kW motor, VC20 → 300 L + 4 kW, VC30 → 500 L + 5.5 kW.

**Why it matters in the real factory:** every place that counts parts (buffer, supermarket, AS/RS, AGV load,
MRP, shipping) must count **per model**. A buffer with "8 crankcases" says nothing; "3 × VC10, 5 × VC20" is the real information.
In the real factory the model travels with the part as: serial number on the casting (DMC / laser mark),
RFID tag on the fixture pallet, or the order number in the MES linked to the pallet ID.

### 3.2 Machine state SETUP (changeover)

A machine needs a changeover when the next part is a **different model** from the last one:
new NC program, other fixture or chuck jaws, other gauges, other test adapter.

In the twin the machine first takes the part, then stays in state **SETUP** for the setup time, then goes to **RUNNING**.
SETUP is shown in blue blinking light in 3D and counts as lost time (it lowers OEE availability).

Setup times in the example config (`setup_s`):

| Station | Setup time per model change |
|---|---|
| VMC-01 cylinder boring | 180 s |
| HONE-01 honing | 120 s |
| LATHE-01 crankshaft lathe | 240 s |
| GRIND-01 grinder | 180 s |
| ASSY-01 pump assembly | 60 s |
| ROBOT-01 head bolting | 30 s |
| TEST-01 / TEST-02 test benches | 120 s |
| FINAL-01 final assembly | 150 s |
| PACK-01 packaging | 60 s |
| LOAD-CC, WASH-01, PAINT-01 | 0 (no setup) |
| HMC-01..03 | no `setup_s`; they use a **tool magazine** (see 3.3) |

### 3.3 Machining centers with tool magazines

The three horizontal machining centers (HMC-01, HMC-02, HMC-03) machine the crankcases.
Each **tool magazine holds the tool sets of only 2 models** (`"tool_magazine": {"sets": 2, "load_s": 600}`).

| Machine | Tool sets at start (`initial`) |
|---|---|
| HMC-01 | VC10, VC20 |
| HMC-02 | VC20, VC30 |
| HMC-03 | VC10, VC30 |

So **every model is loaded in 2 of the 3 machines**.

If a pallet of the third model arrives, the machine must **exchange one tool set** (600 s = 10 min, example value).
The set that was **used longest ago** leaves the magazine (LRU = "least recently used", code in `_changeover`).

**Flexible routing:** a loaded pallet can go to **any** free machining center (`"pick": "rule"`).
Under the **SETUP** rule a free machine prefers a pallet whose tools are already in its magazine.
Under EDD, FIFO and SPT the machine takes the pallet the rule ranks first, even if this costs a tool exchange.

### 3.4 Fixture pallets and the load station

The **Fixture Load Station** (LOAD-CC) clamps a casting on a fixture pallet and marks the **serial number**.
It may only start when:

1. a **released work order** still needs units (order release by the MES – `release_gate`),
2. a casting **of that model** is at the station,
3. a **free fixture pallet** exists (pool `PAL-CC`, 10 pallets).

The pallet returns to the pool when the HMC finishes the part. So the number of pallets
**limits the work in progress (WIP)** of the cell. (Pallet pool sizing: see Guide 03.)

The serial number is built as `<model>-<running number>`, for example `VC20-000012`.

### 3.5 Kanban supermarkets

The cylinder line (VMC-01 → HONE-01) and the crankshaft line (LATHE-01 → GRIND-01) do **not** follow work orders.
They are **pull** lines: they refill a **supermarket** in front of the assembly cell.

| Supermarket | Buffer | Places per model (`per_variant`) | Kanban target | Trigger | Line |
|---|---|---|---|---|---|
| Cylinder supermarket | `B_CYL` (36 places) | 12 | 12 | 6 | VMC-01 → HONE-01 |
| Crankshaft supermarket | `B_CS` (24 places) | 8 | 8 | 4 | LATHE-01 → GRIND-01 |

**Kanban level of a model** = parts of that model in the supermarket **+ parts already on the way**
in the line (buffers between the machines and parts inside the machines). Code: `_kanban_level`.

The decision rule of the first machine of the line (`_kanban_variant`):

1. Make a model **only** if its level is **below target**.
2. **Stay on the current model** while it is still below target (no changeover needed).
3. Change to another model **only** when that model has fallen **to its trigger level or lower**
   (a "full batch of kanban cards" is waiting).
4. If several models are at trigger: take the one with the lowest fill (level ÷ target).
5. If no model needs parts: the line stops with the reason "Kanban full – no part needed now". This is correct – overproduction is waste.

### 3.6 Kit check at assembly

The pump assembly cell ASSY-01 needs **1 crankcase + 2 cylinders + 1 crankshaft of the same model** (a **kit**).
It uses `"pick": "kit"`:

1. It looks at the crankcases waiting in front of it (buffer `B_CC`), sorted by the dispatching rule.
2. For each one it checks: are 2 cylinders and 1 crankshaft **of this model** in the supermarkets?
3. It starts the **first crankcase whose kit is complete**.
4. If no kit is complete, it waits with the reason "Kit not complete – waiting for …".

So the buffer in front of the assembly also **re-sequences** the models: a VC30 crankcase may pass a VC20
crankcase if only the VC30 kit is complete.

**Why:** starting a unit without all parts creates half-built units on the floor (WIP that blocks space and hides problems).

### 3.7 Dispatching rules

A dispatching rule decides **which work order or pallet goes first**. It is used in two places:

- **MES order release** (`mes.rule_key`): which released work order the load station starts next.
- **Machines with `pick: rule` or `pick: kit`** (`Machine._rule_key`): which waiting pallet / crankcase goes first.

Work-order **priority always comes first** (1 = most urgent). Make-to-order orders from the Order flow tab get
**priority 3**, MRP stock orders **priority 5**.

| Rule | Sort key (after priority) | Good for | Weak point |
|---|---|---|---|
| **FIFO** | creation order | simple, fair | models alternate → many changeovers |
| **EDD** (default) | earliest due date | on-time delivery | urgent orders of different models mix → changeovers |
| **SPT** | shortest work content (VC10 first) | low WIP, many units finish fast | big models (VC30) can wait very long |
| **SETUP** | due-date window, then "model running now first", then due date | fewer changeovers at the **load station and HMCs** | big windows → long batches → empty kanbans → **more** changeovers downstream (section 7.2) |

**SETUP rule in detail:**
Time is cut into windows of `window_h` hours (example 8 h). `window number = due time ÷ (window_h × 3600 s)`, rounded down.
Orders due in the **same window** form one batch. Inside the batch, the model that is running now goes first.
Orders in a **later** window always wait. So the window limits how long a batch can become.

### 3.8 Make-to-order and pegging

There are two kinds of sales orders in the twin:

| | Make-to-stock (MRP) order | Make-to-order (MTO) order |
|---|---|---|
| Created by | random demand or ERP tab | **Order flow** tab (`mto: true`) |
| Work order | MRP makes one work order per model for **all** open stock orders together | **its own** work order (`plan_so`), linked by `so` |
| Units | anonymous stock | **pegged**: every unit gets `so = SO-xxxx` when it starts |
| MRP | netted by MRP | **ignored** by MRP; its pegged units are not counted as free stock |
| Shipping | from free stock of the same model | own units first, then free stock of the same model |
| Priority | 5 | 3 |

**Pegging** = a fixed link "this serial number is made for this customer order". The MES writes `so` into the unit record
when the unit starts (`_on_start`). The ERP will not give a pegged unit to another order (`_fg_for`).

**Scrap is replaced automatically:** a work order counts `started − scrap`. When a unit is scrapped
(for example a test-bench reject), the work order again needs one unit, so the load station starts one more.

### 3.9 Manual and automatic order flow

| | Automatic factory | Manual factory |
|---|---|---|
| Customer orders | random demand (example 300 units/day) + your orders | only your orders |
| MRP (planning) | every hour (`mrp_interval_h` = 1) | only when you press a button |
| Work-order release | automatic | you press **Release** |
| Shipping | automatic (every 30 s check) | you press **Ship** |

In addition, each MTO order has its own switch **automatic steps for this order**. With it, the ERP does
plan → buy → release → ship for this one order, even in a manual factory.

If some switches are on and some off (ERP tab settings), the mode shows **mixed**.

### 3.10 The 7 steps of one order

| Step | System | Done when | What happens |
|---|---|---|---|
| 1 Customer order | ERP | always | sales order with customer, model, quantity, due date |
| 2 Plan work order | ERP → MES | planned quantity ≥ order quantity | `plan_so` creates a work order (priority 3, due = order due date) |
| 3 Check material | ERP | no item SHORT and no item waiting on a purchase order | BOM check per model; `buy_so` creates purchase orders for the missing quantity |
| 4 Release | MES | a work order is RELEASED / IN_PROGRESS / COMPLETED | the load station may start units of this order |
| 5 Production | machines | all units started, none left in production, enough finished | units move through the route; AGVs move castings and finished crates |
| 6 Finished-goods AS/RS | AS/RS | finished + picking + shipped ≥ order quantity | the AGV brings each packed unit to the FG AS/RS, the crane stores it |
| 7 Ship | ERP | order status SHIPPED | the crane retrieves the units; the ERP books revenue; the MES marks each serial number as shipped to the customer |

You can **release before the material arrives** (the button is offered in step 3). The line then starts with the stock that is there.

---

## 4. Model and formulas (with the example values of the code)

### 4.1 Cycle time per model

Each product has a table `cycle_s` per station type. VC20 has no table, so it uses the station's own `cycle_time_s`.

| Station | VC10 | VC20 | VC30 | Mix average |
|---|---|---|---|---|
| LOAD-CC | 80 s | 90 s | 100 s | 89.0 s |
| HMC (each of 3) | 270 s | 345 s | 450 s | 343.5 s (+15 s pallet change) |
| WASH-01 | 130 | 150 | 170 | 148.0 |
| VMC-01 | 85 | 100 | 125 | 100.5 |
| HONE-01 | 75 | 90 | 110 | 89.5 |
| LATHE-01 | 140 | 170 | 210 | 169.0 |
| GRIND-01 | 160 | 190 | 230 | 189.0 |
| ASSY-01 | 170 | 200 | 240 | 199.0 |
| ROBOT-01 | 95 | 110 | 130 | 109.5 |
| TEST-01 / 02 | 300 | 360 | 420 | 354.0 |
| PAINT-01 | 130 | 160 | 200 | 159.0 |
| FINAL-01 | 180 | 210 | 250 | 209.0 |
| PACK-01 | 100 | 120 | 140 | 118.0 |

**Mix-average cycle time**

```
t_avg = Σ (mix share of model × cycle time of model)
HMC:   t_avg = 0.3 × 270 + 0.5 × 345 + 0.2 × 450 = 81 + 172.5 + 90 = 343.5 s
```

### 4.2 Capacity of a station group

```
units per hour = Σ over parallel machines (3600 ÷ (t_avg + handling time)) ÷ parts needed per unit
```

| Group | Calculation | Units/h |
|---|---|---|
| HMC-01..03 | 3 × 3600 ÷ (343.5 + 15) | 30.1 |
| TEST-01..02 | 2 × 3600 ÷ 354 | 20.3 |
| VMC-01 (2 cylinders per unit) | 3600 ÷ 100.5 ÷ 2 | 17.9 |
| ASSY-01 | 3600 ÷ 199 | 18.1 |
| FINAL-01 | 3600 ÷ 209 | **17.2 ← lowest** |

**Ideal factory rate = lowest group = 17.2 units/h** (FINAL-01). This is the design limit **without**
setups, breakdowns, starvation or start-up. In one 24-hour test run of the twin (seed 1, EDD rule,
starting with an empty line) the real output was **345 units = 14.4 units/h** (example result).
The gap comes from breakdowns (MTBF/MTTR), changeovers, scrap and the empty line at the start.

Note: VMC-01 (17.9) and ASSY-01 (18.1) are very close to FINAL-01. With this mix the factory has
**three near-bottlenecks**. A small mix change moves the bottleneck. This is typical for an FMS – check it with the what-if tab.

### 4.3 Time per unit with batches (changeover share)

```
time per unit = cycle time + setup time ÷ batch size
LATHE-01, VC20, batch 4:   170 s + 240 s ÷ 4 = 230 s   (35 % slower than 170 s)
LATHE-01, VC20, batch 8:   170 s + 240 s ÷ 8 = 200 s
```

```
setup share of a station = Σ setup time ÷ total time
Example from the 24 h run: LATHE-01 10 changeovers × 240 s = 2,400 s;  2,400 ÷ 86,400 = 2.8 %
```

### 4.4 Tool magazine exchange

```
exchange needed when: model of the pallet ∉ tool sets in the magazine
time lost = load_s = 600 s (example)
```

With 3 machines × 2 sets and 3 models, each model is in 2 machines. In the 24 h EDD run the three HMCs
made only 2 + 3 + 4 = 9 tool exchanges (1.5 h in total). Reason: there are usually two machines able to run each model, and
the LRU rule keeps the most used sets.

### 4.5 Kanban target

General kanban rule (the twin uses the same idea):

```
target ≥ demand during the refill time + safety stock
```

**Example – cylinder supermarket, model VC20** (example values):

```
demand of VC20 cylinders  = 2 per unit × 17.2 units/h × 0.5 mix = 17.2 cylinders/h
refill time (worst case)  = the line finishes the batch of another model (up to 12 × 100 s = 20 min)
                           + changeover VMC 180 s + HONE 120 s (5 min)
                           + first part through VMC + HONE (100 + 90 s ≈ 3 min)
                           ≈ 28 min ≈ 0.47 h
demand during refill      = 17.2 × 0.47 ≈ 8 cylinders
target                    = 8 + safety (≈ 4) = 12 cylinders = 6 units  → config "target": 12
trigger                   = target ÷ 2 = 6 (the twin default when "trigger" is missing)
```

**Example – crankshaft supermarket, VC20:** demand = 1 × 17.2 × 0.5 = 8.6/h; refill ≈ 0.5 h → 4.3 + safety → target 8, trigger 4.

The common Toyota form with containers:

```
number of kanban cards N = demand per hour × refill time (h) × (1 + safety factor) ÷ parts per container
```

### 4.6 MRP per model (make-to-stock orders)

Finished-goods level, for **each model separately** (`run_mrp`):

```
net = open demand + safety stock − free FG stock − open work orders
free FG stock = FG units of this model − units being picked − units pegged to open MTO orders
              + units of this model on the way into the FG store (AGV, crane queue)
if net > 0: new work order = net rounded UP to the work-order lot (wo_lot)
```

**Example at start** (initial orders: VC20 40 + 40, VC10 25, VC30 16; FG empty; no work orders):

| Model | Demand | + Safety | − Free FG | − Open WO | Net | Lot | Work order |
|---|---|---|---|---|---|---|---|
| VC10 | 25 | 6 | 0 | 0 | 31 | 20 | **40** |
| VC20 | 80 | 10 | 0 | 0 | 90 | 20 | **100** |
| VC30 | 16 | 4 | 0 | 0 | 20 | 10 | **20** |

Material level (each purchased item, model items only for their model):

```
units      = max(units still to start, planned rate × supplier lead time) (+ units in WIP for tank/motor)
gross      = BOM quantity × units
net        = gross + safety stock − on hand − on order
if net > 0: purchase order = net rounded UP to the purchase lot
```

Example CC20-CAST (VC20 casting): planned rate = 300 units/day × 0.5 ÷ 24 = 6.25 units/h; × 16 h lead time = 100.
units = max(100 to start, 100) = 100; gross = 100; net = 100 + 100 safety − 360 on hand − 0 = **−160 → no purchase order**.

### 4.7 Material check of one MTO order (step 3)

For each BOM item of the order's model (`_materials`):

```
need  = units of this order still to start × BOM qty
        (+ units of this order already running that still need a late part, e.g. tank and motor)
have  = in store + being put away + already at the line (moved by AGV)
        − what other open work orders of the same item still need
short = max(0, need − have)
to buy = max(0, short − already on order)
status = OK / ON ORDER / SHORT
```

**Why "− other open work orders":** stock is shared. Without this line, two orders would both count the same castings and both believe they are covered.

### 4.8 Shipping rule

Every 30 s (automatic shipping) the ERP goes through the open orders **by due date** (`_ship`):

1. Units allowed for this order: its **own pegged units** first, then **free units of the same model**
   (not pegged to another open order).
2. If there are **not enough** units **and** the order is **not late** yet → do not ship (ship complete orders),
   and **keep the free stock of this model** for this older order (`hold_free` = a set of **models**).
3. If the order **is late** → ship what is there (partial shipment).
4. Each unit is retrieved by the FG crane, then counted as shipped (revenue, cost of goods, on-time flag).

The manual button **Ship order** ships everything available for the order right away (also partial).

### 4.9 Order lead time estimate (rule of thumb)

```
lead time ≈ flow time of the first unit + (quantity − 1) × time per unit at the bottleneck
```

Example: 50 × VC20 in an **empty** factory. Bottleneck for VC20 only = FINAL-01 210 s.
Flow time of the first unit = the longest path (critical path), not the sum of all times, because the
crankcase, cylinder and crankshaft branches run at the same time:

```
crankcase branch  LOAD 90 + HMC 345 + 15 + WASH 150           = 600 s  (longest branch)
cylinder branch   VMC 2 × 100, HONE overlaps → 290 s;  crankshaft branch LATHE 170 + GRIND 190 = 360 s
after assembly    ASSY 200 + ROBOT 110 + TEST 360 + PAINT 160 + FINAL 210 + PACK 120 = 1 160 s
critical path     600 + 1 160 = 1 760 s ≈ 29 min
+ AGV casting trip ≈ 2 min + changeovers on the path ≈ 7 min + AGV to FG ≈ 2 min  → ≈ 40 min
```

Lead time ≈ 0.67 h + 49 × 210 s = 0.67 + 2.86 = **≈ 3.5 h** (ideal estimate; breakdowns add a little).
(Correction: an earlier version used the SPT key of 56 min as flow time and got 4.4 h.)
In a busy factory add the queue of other released orders. Chapter 14 shows the full example.
Check it in the twin with **+10 min** steps.

---

## 5. Implementing in the real factory – step by step

### Step 1 – Freeze the product data per model
1. For each model, list: BOM (casting, cylinders, crankshaft, tank, motor, small parts), routing (station sequence),
   cycle time per station, setup time per station change (from model A to model B), test specification (FAD, tolerance).
2. Measure setup times as a **matrix** (from → to). The twin uses one value per station; reality can differ
   (VC10 → VC20 may be faster than VC10 → VC30).
3. Enter real values into `config/factory.json` (`products[].cycle_s`, `setup_s`) and run the what-if tab.

### Step 2 – Give every part its model and identity
1. Mark the serial number on the crankcase at the load station (laser or dot-peen DMC). The twin does this at LOAD-CC.
2. Put an RFID tag (or a barcode) on every fixture pallet. The PLC of the cell links **pallet ID ↔ serial number ↔ model ↔ work order**.
3. Cylinders and crankshafts: if they get no own serial number, at least the **batch** and the **model** must be on the container / supermarket lane.
4. Scanners at: load station, each HMC (pallet arrival), assembly (kit check), test bench, final assembly (tank + motor scan), packaging, FG AS/RS input.

### Step 3 – NC programs and tool management of the HMCs
1. One NC program per model and machine (naming example from the twin: `OHMC01_VC20.nc`).
2. The MES (or the cell controller) sends the program number with the pallet. The machine checks: program loaded? tool set in the magazine?
3. Plan the **tool set allocation** like the twin (each model in at least 2 machines). Then one machine can break down without stopping a model.
4. Tool presetting room: tool sets of the third model are prepared **before** they are needed. A prepared exchange is faster than 10 min.
5. Tool life management: count parts per tool in the CNC; the twin's preventive maintenance at 85 % wear is an example of the logic.

### Step 4 – Changeover reduction (SMED) before choosing a rule
1. Film one changeover per station. Separate **internal** work (machine stopped) and **external** work (can be done while running).
2. Move external work out: prepare fixture, jaws, test adapter beside the machine.
3. Use quick-change: zero-point clamping, coded fixtures, standard heights, program call by barcode.
4. Re-measure and update `setup_s`. Every second of setup you remove is worth more than any dispatching rule.

### Step 5 – Kanban loops for cylinders and crankshafts
1. Calculate target and trigger per model (section 4.5) with **real** demand and refill times.
2. Build the supermarket with **fixed lanes per model** (the twin uses `per_variant`): colour-coded lanes, one lane per model, max quantity marked.
3. Signal: when a lane falls to the trigger, a card (or an electronic signal from a light barrier / weighing / RFID count) goes to the first machine of the line.
4. Line rule for the operator / PLC: stay on the current model until it reaches target; change only when another model is at trigger (same as the twin).
5. Show the levels on a screen at the line (like the kanban bars in the FMS tab).

### Step 6 – Kit check at assembly
1. Before the operator starts a pump: scan crankcase serial number → MES checks 2 cylinders + 1 crankshaft of the same model are in the kit position.
2. Poka-yoke: wrong-model parts must not fit or must be rejected by scan (different bore, different crankshaft length, colour code).
3. Allow re-sequencing (start the next crankcase with a complete kit), but log it.

### Step 7 – Dispatching rule in the MES
1. Start with **EDD** (default of the twin).
2. Keep a **priority** field (1 = urgent). Customer-specific orders get a better priority than stock orders (twin: 3 vs 5).
3. If you want batching, use the SETUP rule with a **small window** (for example one shift = 8 h), never a window of several days.
4. Measure every week: number of changeovers per station, on-time delivery, kanban stock-outs. Change the rule only with data.

### Step 8 – ERP ↔ MES order flow
1. ERP: sales order with model, quantity, due date, and the flag make-to-order / make-to-stock.
2. ERP → MES: work order (in ISA-95 / B2MML this is a ProductionSchedule; the twin shows an example message in the Communication tab).
3. MES → ERP: units started, scrap, completed, units into FG stock (ProductionPerformance).
4. Pegging: the MES writes the sales-order number on every unit of an MTO work order. The WMS must keep these units for that order.
5. Shipping: WMS picks per order, **per model**. ERP books revenue and creates the invoice.
6. Decide clearly which system does what: who runs MRP (ERP), who releases (MES planner or automatic), who picks (WMS).

### Step 9 – Test the logic with the twin before go-live
1. Load the real config, run 3 × 24 h in the what-if tab with each rule.
2. Run the manual order-flow exercise with the planners and the shop-floor team.
3. Run a "bad day": one HMC off (what-if `enabled: 0`), VC30 mix 40 %, kanban target −50 %. Note what breaks first.

---

## 6. Checklists

### 6.1 Product / FMS data checklist
- [ ] Every model has a BOM, routing, cycle time per station, test specification.
- [ ] Setup time measured per station (and ideally as a from–to matrix).
- [ ] Tool sets per model defined; magazine capacity per HMC known; each model in ≥ 2 HMCs.
- [ ] NC program per model and machine; program call linked to the pallet/order.
- [ ] Fixture works for all models (or fixture change counted as setup).
- [ ] Model-specific castings, tanks, motors have separate storage locations and separate stock in the ERP.

### 6.2 Kanban checklist
- [ ] Target and trigger calculated per model with real demand and refill time.
- [ ] Separate lanes per model; maximum marked; first-in first-out inside a lane.
- [ ] Rule written at the line: "stay on the model until target; change only at trigger".
- [ ] Stock-out of a lane creates an alarm / andon.
- [ ] Review targets when the mix changes by more than about 10 points.

### 6.3 Order-flow checklist
- [ ] Every sales order has a model, quantity, due date, MTO/MTS flag.
- [ ] MRP runs **per model**; MTO orders are excluded from MRP netting.
- [ ] Pegged units cannot be shipped to another customer (system lock, not only a rule on paper).
- [ ] Scrapped units create a replacement start automatically (work order counts started − scrap).
- [ ] Shipping rule: complete orders when on time, partial only when late or when the customer agrees.
- [ ] Shipping logic and "keep stock for the oldest order" work **per model** (section 7.1).
- [ ] FG warehouse capacity alarm before it is full (for example at 85 %).
- [ ] Material check counts what other open work orders still need.

### 6.4 Go-live test checklist (manual order exercise)
- [ ] Create MTO order of 50 × VC20 → work order created with priority 3.
- [ ] Material short → purchase orders created for exactly the missing quantity (rounded to lot).
- [ ] Release → castings of the right model arrive at the load station; no other model is brought.
- [ ] Units carry serial number + work order + sales order (check 5 at random).
- [ ] One forced test-bench reject → replacement unit starts automatically.
- [ ] All units in FG → ship → each serial number shows customer and shipping date.

---

## 7. Common mistakes and lessons learned

### 7.1 Lesson: a global "hold free stock" rule jammed the whole line

**What happened (in an earlier version of the twin):** the shipping rule said "if the oldest order is not complete
and not late, keep the **free stock** for it and ship nothing else". This flag was **global** (for all models).

The chain of events:

1. An old VC30 order waited for its last units.
2. The global flag blocked shipping of **all** models, also complete VC10 and VC20 orders.
3. Finished units kept arriving; nothing left. The **FG AS/RS (110 slots)** filled up.
4. The AGV transport to the FG store checks free slots (`slots − count − incoming`). At 0 free slots the AGV stopped taking crates from packaging.
5. Buffer `B_PK` (3 places) filled → PACK-01 BLOCKED → FINAL-01 BLOCKED → … → the whole line stopped.
6. The VC30 order could now **never** be completed. Deadlock.

**Fix (current code):** `hold_free` is a **set of models**. Free VC30 stock is kept for the old VC30 order,
but VC10 and VC20 orders ship normally.

**Rule for the real factory:** **every** shipping, MRP, reservation, kanban and warehouse rule must work **per model**
(per SKU). Test every rule with the question: "Can a problem of model A stop model B?" If yes, change the rule.
Also: the FG warehouse must have a capacity alarm and a manual override, because a full warehouse stops production.

### 7.2 Lesson: big SETUP batches cause MORE changeovers, not fewer

It sounds logical: "batch the same model together → fewer changeovers". The twin shows the opposite when the batches become long.

Example result, 24 h runs, same seed, same orders (example values):

| Rule | Window | Good units | Changeovers (all stations) | Setup hours |
|---|---|---|---|---|
| EDD | – | 345 | 156 | 6.0 h |
| SETUP | 8 h | 344 | 174 | 6.6 h |
| SETUP | 48 h | 327 | 213 | 8.4 h |

Why:

1. A long VC20 batch at the load station sends only VC20 crankcases to assembly.
2. Assembly needs 2 VC20 cylinders + 1 VC20 crankshaft per unit. The VC20 **supermarket lanes are sized for the mixed flow**
   (12 cylinders = 6 units, 8 crankshafts = 8 units). They **empty** quickly.
3. The kanban lines must now run VC20 for a long time; the other models' lanes are full and idle.
   When the batch changes, the lines must change over again, often before the lanes are refilled.
4. While the VC20 kits are missing, the assembly starts **whatever kit is complete** (re-sequencing). So the flow after assembly
   alternates models more often – and **every** downstream station (robot, test benches, final assembly, packing) changes over each time.
5. Result: fewer changeovers at the HMCs, but more everywhere else, and less output.

That is why **EDD is the default rule**. Batching helps only when the kanban supermarkets are big enough for the batch size:

```
batch size ≤ kanban target per model ÷ parts per unit   (cylinders: 12 ÷ 2 = 6 units)
```

### 7.3 Other common mistakes

| Mistake | Effect | Better |
|---|---|---|
| Counting buffers without model | AGV brings wrong castings, assembly waits for kits | count per model everywhere (`count_v`) |
| AGV brings castings "to fill the place" | line-side full of a model nobody ordered | bring castings only for released work orders (`need_for`) |
| Starting units without a complete kit | half-built pumps on the floor | kit check before start |
| One tool set per model in only one HMC | one breakdown stops a model | each model in ≥ 2 machines |
| Changing the rule every day | nobody understands the plan | change only with a week of data |
| Pegged units used for another order | the MTO customer gets late | system lock on pegged serial numbers |
| Using SPT permanently | VC30 orders starve, become late | use SPT only short term, with priorities |
| No scrap replacement | order short by the scrapped units | work order counts started − scrap |
| Releasing everything at once | long queues, high WIP, more mixing | release by due date; pallets limit WIP |

---

## 8. Limits of the twin

1. **One setup time per station**, the same for every model change. Real setups depend on from-model and to-model.
2. **Tool exchange = fixed 600 s.** No tool life per tool, no sister tools, no tool presetting queue.
3. **Changeover starts when the part is taken.** In reality you can often prepare a setup while the last part runs.
4. **Kanban signal is instant and perfect.** No lost cards, no counting errors, no delay.
5. **No operators** as a limited resource: changeovers, kit picking, load station work need no people in the twin.
6. **No shift calendar** and no breaks: the twin runs 24 h per day.
7. **Demand is random** (example 300 units/day, orders of 5–30 units, due in 24–72 h) – not a real forecast.
8. **Suppliers are always on time** (fixed lead time). No partial deliveries, no quality rejects at goods receipt.
9. **Test reject = scrap.** No rework loop.
10. **MRP is simple** (one level per model, lot rounding, safety stock); no capacity check (it can create more work than the factory can do).
11. **What-if has no orders:** in the What-if tab the models start in mix proportions; the SETUP rule there uses `max_batch` (example 10)
    instead of the due-date window.
12. **Data is in memory.** A reset clears orders and work orders (finished units are also written to `data/history.db`).
13. All numbers (cycle times, setups, MTBF, prices, lots) are **example values**.

---

## 9. Key formulas at a glance

| Formula | Meaning | Example | Section |
|---|---|---|---|
| `L = λ × W` | Little's law: WIP = throughput × flow time | 14.4 /h × 2.8 h = 40 units | 10.1 |
| `ρ = λ × t_e / c` | utilisation of a group of c machines | TEST at 17.2 /h: 84.6 % | 10.2 |
| `W_q ≈ ((c_a² + c_e²)/2) × (ρ/(1−ρ)) × t_e` | Kingman (VUT) waiting time | FINAL-01: 9 min | 10.4 |
| `c_e² = c_0² + 2 A (1−A) m_r / t_0` | variability with breakdowns (exponential repair) | 0.019 vs 4.85 | 10.4 |
| `c_d² = ρ² c_e² + (1−ρ²) c_a²` | variability passed downstream | – | 10.5 |
| `t_unit = t + S / Q` | time per unit with batch Q and setup S | LATHE Q = 4: 229 s | 4.3, 10.7 |
| `Q_min = D × S / (1 − D × t)` | smallest batch that keeps up with demand D | GRIND at 17.2 /h: 9 | 10.7 |
| `target ≥ D × T_refill + SS`, `SS = z × σ × √T` | kanban target with safety stock | VC20 cylinders 15 | 4.5, 10.9 |
| `EOQ = √(2 D S_o / H)` | economic order quantity | 487 castings | 10.10 |
| `net = demand + safety − free FG − open WO` | MRP net requirement per model | VC20: 90 → WO 100 | 4.6 |
| `lead time ≈ critical path + (Q − 1) × t_bottleneck` | order lead time | 3.5 h | 4.9, 14 |

---

## 10. Science principles

The laws of flow and queueing that explain why the FMS behaves as it does. Reliability, OEE and
simulation statistics are in guide `01`, chapter 10. Material-handling physics is in guide `03`.

### 10.1 Little's law

Draw the number of units in the factory (WIP) over a long time T. The area under this curve, in
"unit-hours", is the sum of the times all units spent inside: area = n × W (n units, W = mean flow time).
The mean WIP is area / T:

```
L = area / T = (n / T) × W = λ × W
L = mean WIP [units],  λ = throughput [units/h],  W = mean flow time [h]
```

It holds for any system in steady state, any rule, any distribution. Uses:

| Known | Calculated | Example (example values) |
|---|---|---|
| λ and W | WIP | 14.4 units/h × 2.8 h = 40 units in the factory |
| WIP and λ | flow time | MES counts 40 units in WIP, output 14.4 /h → W = 40 / 14.4 = 2.8 h |
| Released backlog and λ | waiting time of a new order | 100 released units ahead / 14.4 /h = 6.9 h before a new order starts |
| Pallet count (WIP cap) | maximum flow time at a given rate | guide `03`, 4.6 |

Consequence: at the **same** output, more WIP means **longer** flow time. Releasing everything at once
(table 7.3) does not make the factory faster – it only makes every order wait longer.

### 10.2 Utilisation

```
ρ = arrival rate × effective time per part / number of parallel machines = λ × t_e / c
```

Utilisation of each group at the 24 h twin output of 14.4 units/h (ρ = 14.4 / capacity from 4.2):

| Group | Capacity /h | ρ at 14.4 /h |
|---|---|---|
| FINAL-01 | 17.2 | 0.84 |
| VMC-01 | 17.9 | 0.80 |
| ASSY-01 | 18.1 | 0.80 |
| GRIND-01 | 19.0 | 0.76 |
| HONE-01 | 20.1 | 0.72 |
| TEST-01/02 | 20.3 | 0.71 |
| LATHE-01 | 21.3 | 0.68 |
| PAINT-01 | 22.6 | 0.64 |
| WASH-01 | 24.3 | 0.59 |
| HMC-01..03 | 30.1 | 0.48 |
| PACK-01 | 30.5 | 0.47 |
| ROBOT-01 | 32.9 | 0.44 |
| LOAD-CC | 40.4 | 0.36 |

(These ρ values ignore setups and breakdowns; with them the top machines are closer to 1.)

### 10.3 Why waiting time explodes near 100 % utilisation

For the simplest queue (one machine, random arrivals and random process times, "M/M/1"):

```
W_q = ρ / (1 − ρ) × t_e
```

| ρ | 0.50 | 0.70 | 0.80 | 0.85 | 0.90 | 0.95 |
|---|---|---|---|---|---|---|
| W_q in multiples of t_e | 1.0 | 2.3 | 4.0 | 5.7 | 9.0 | 19.0 |

From 80 % to 95 % the waiting time grows almost 5 times. That is why planning rules say "crane ≤ 80–85 %",
"AGV ≤ 70–75 %": not because the equipment cannot do more, but because queues become very long.

### 10.4 Kingman (VUT) equation – variability × utilisation × time

Real machines are not as random as M/M/1. Kingman's approximation for one machine:

```
W_q ≈ V × U × T = ((c_a² + c_e²) / 2) × (ρ / (1 − ρ)) × t_e
c_a = coefficient of variation of the time between arrivals (std. dev. / mean)
c_e = coefficient of variation of the effective process time
```

Effective process time with random breakdowns (Hopp & Spearman, "Factory Physics"):

```
t_e  = t_0 / A
c_e² = c_0² + (1 + c_r²) × A × (1 − A) × m_r / t_0
t_0 = natural process time, c_0 its variation, m_r = MTTR, c_r = variation of repair time (exponential: c_r² = 1)
```

**Example 1 – FINAL-01 as in the config** (MTBF 120 h, MTTR 8 min = 480 s), at 14.4 units/h, c_a² = 1 assumed:

```
mix: t = 180 / 210 / 250 s with 0.3 / 0.5 / 0.2 → mean 209 s
variance = 0.3 × 29² + 0.5 × 1² + 0.2 × 41² = 589 s²   → c_0² = 589 / 209² = 0.0135
A = 120 / (120 + 0.133) = 0.99889
c_e² = 0.0135 + 2 × 0.99889 × 0.00111 × 480 / 209 = 0.0135 + 0.0051 = 0.0186
t_e = 209 / 0.99889 = 209.2 s;   ρ = 14.4 × 209.2 / 3600 = 0.837
W_q = ((1 + 0.0186) / 2) × (0.837 / 0.163) × 209.2 = 0.509 × 5.13 × 209.2 ≈ 547 s ≈ 9 min
```

**Example 2 – same availability, different failure pattern** (both A = 97.1 %):

| Failure pattern | m_r | c_e² | t_e | ρ | W_q |
|---|---|---|---|---|---|
| rare and long: MTBF 168 h, MTTR 5 h | 18 000 s | 0.0135 + 2 × 0.0281 × 18 000 / 209 = **4.85** | 215.2 s | 0.861 | 2.92 × 6.19 × 215.2 ≈ **3 900 s = 65 min** |
| frequent and short: MTBF 1 h, MTTR 1.8 min | 107 s | 0.0135 + 2 × 0.0281 × 107 / 209 = **0.042** | 215.2 s | 0.861 | 0.52 × 6.19 × 215.2 ≈ **690 s = 12 min** |

Same availability, **5 times** longer waiting. This is the mathematical reason for the rule in guide 01,
3.6: long repairs hurt much more than short ones. In the real factory: keep MTTR short (spare parts on
site, trained technicians), even if MTBF is good.

### 10.5 Why buffers decouple variability

The variability of the parts **leaving** a machine (linking equation, Hopp & Spearman):

```
c_d² = ρ² × c_e² + (1 − ρ²) × c_a²
```

A busy machine (ρ near 1) passes its own variability downstream. Example 2 (rare long failures, ρ = 0.861):
c_d² = 0.741 × 4.85 + 0.259 × 1 = 3.85 → the next station sees very irregular arrivals.

A buffer absorbs this: while the upstream machine is down, the downstream machine takes parts from the
buffer. To bridge one repair completely:

```
buffer ≥ consumption rate × repair time
FINAL-01 down 8 min at 1 unit per 209 s → 480 / 209 = 2.3 → 3 places (B_P4 has 6: OK)
rare long failure 5 h → 18 000 / 209 = 86 units → not practical
```

So: **short** stops are solved by buffers, **long** stops must be solved by faster repair. Place buffers
**in front of** the bottleneck (it must never starve) and **behind** it (it must never be blocked).

### 10.6 Bottleneck theory (Theory of Constraints)

The output of a line equals the capacity of its slowest resource. Five focusing steps (Goldratt):

1. **Identify** the bottleneck (twin: active-period method, guide 01, 4.12).
2. **Exploit** it: no idle time – breaks covered, buffer in front, quality check before it (do not process scrap).
3. **Subordinate** everything else: other machines work at the bottleneck pace (kanban, release by pallets).
4. **Elevate**: shorter cycle, second machine – only after steps 2–3.
5. **Repeat**: the bottleneck moves (here: FINAL-01 → VMC-01 → ASSY-01 are within 5 %).

**Economics of a bottleneck hour** (example values from the config):

| Model | Price | Material (casting + 2 cylinders + crankshaft + tank + motor + other) | Contribution | FINAL-01 time | Contribution per bottleneck minute |
|---|---|---|---|---|---|
| VC10 | 890 | 72 + 56 + 60 + 95 + 150 + 95 = 528 | 362 | 180 s | 121 USD/min |
| VC20 | 1 450 | 95 + 56 + 60 + 180 + 210 + 140 = 741 | 709 | 210 s | 203 USD/min |
| VC30 | 2 150 | 138 + 56 + 60 + 285 + 280 + 195 = 1 014 | 1 136 | 250 s | 273 USD/min |

```
mix-weighted contribution = 0.3 × 362 + 0.5 × 709 + 0.2 × 1 136 = 690 USD per unit
one bottleneck hour = 17.2 units × 690 = 11 873 USD contribution (before labour, energy)
one hour at a non-bottleneck with free capacity ≈ 0 USD (buffers absorb it)
```

### 10.7 Changeovers and batch size

A batch of Q parts with setup S and cycle t takes S + Q × t. The machine keeps up with demand D
(parts per second) only if this is not more than the time the batch covers, Q / D:

```
S + Q × t ≤ Q / D    →    Q_min = D × S / (1 − D × t)
capacity with batch Q = 3600 / (t + S / Q)   [parts/h]
```

Numbers at the **ideal** rate 17.2 units/h (D in parts/s, mix-average t from 4.1):

| Machine | D (parts/s) | t | S | D × t | Q_min | Capacity in units/h with Q = 4 / 8 / 12 |
|---|---|---|---|---|---|---|
| LATHE-01 | 0.00478 | 169 s | 240 s | 0.808 | **6** | 15.7 / 18.1 / 19.4 |
| GRIND-01 | 0.00478 | 189 s | 180 s | 0.903 | **9** | 15.4 / 17.0 / 17.7 |
| VMC-01 (2 per unit) | 0.00956 | 100.5 s | 180 s | 0.960 | **43** cylinders | 12.6 / 14.6 / 15.6 |
| HONE-01 (2 per unit) | 0.00956 | 89.5 s | 120 s | 0.855 | **8** cylinders | 15.1 / 17.2 / 18.1 |

At the twin output of 14.4 units/h D is smaller: Q_min = 3 for LATHE and GRIND, 7.3 cylinders for VMC.

**What this means:** if every batch needs a changeover, the cylinder line cannot reach 17.2 units/h with
the supermarket size of 12 cylinders per model (best case 15.6 units/h). This is one main reason why the
twin makes about 14.4 units/h and not the ideal 17.2 units/h. It shows two levers: shorter setups (SMED)
or bigger supermarket lanes (bigger batches). Test both in the what-if tab.

### 10.8 Dispatching rules – what theory says

For **one machine** with all jobs waiting, two classic results hold:

| Rule | Proven property (one machine) |
|---|---|
| SPT (shortest processing time first) | gives the **smallest mean flow time** (Smith's rule) |
| EDD (earliest due date first) | gives the **smallest maximum lateness** (Jackson's rule) |
| FIFO | no optimal property, but fair and predictable |

For a whole factory with parallel machines, setups and kits no rule is optimal for every goal. That is
why rules are tested in the twin (7.2) instead of chosen by theory.

### 10.9 Safety stock for a kanban loop

If demand per hour varies with standard deviation σ (in parts per hour) and the refill time is T (h):

```
SS = z × σ × √T          z = 1.65 for 95 %, 2.33 for 99 % service level
target = mean demand × T + SS
```

Example cylinders VC20 (σ is an **assumed** example value – measure it): mean demand 17.2 /h, T = 0.47 h,
σ = 6 cylinders per hour:

```
SS = 1.65 × 6 × √0.47 = 1.65 × 6 × 0.686 = 6.8 → 7
target = 17.2 × 0.47 + 7 = 8.1 + 7 = 15 cylinders   (config uses 12 → check with real σ)
```

### 10.10 Economic order quantity (purchase lots)

Ordering often costs ordering effort; ordering rarely costs stock holding:

```
EOQ = √(2 × D × S_o / H)
D = demand per year, S_o = cost per order, H = holding cost per part and year
```

Example CC20 castings (S_o and H are **example values**): D = 150 per day × 300 days = 45 000 per year,
S_o = 50 USD, H = 20 % × 95 USD = 19 USD per year:

```
EOQ = √(2 × 45 000 × 50 / 19) = √236 842 ≈ 487 castings
```

But 487 castings need 487 / 4 = 122 AS/RS slots – almost half of the raw AS/RS. The space limit wins:
the config lot of 120 castings (30 slots) is a space-driven choice. Always check the lot against AS/RS
slots (guide 03, 4.5).

---

## 11. Detailed specification for implementation

### 11.1 Config keys of the FMS (`config/factory.json`)

**`products[]`** (one entry per model):

| Key | Unit | Default | Range | Meaning |
|---|---|---|---|---|
| `id` | text | required | short, no spaces | model code, written on every part (`v`) |
| `sku` | text | – | ERP article number | `VC20-300` |
| `name`, `color` | text, `#rrggbb` | – | – | display |
| `price` | USD | – | > 0 | revenue per unit |
| `other_parts_cost` | USD | – | ≥ 0 | small parts not modelled as items |
| `wo_lot` | units | – | 1–500 | MRP rounds work orders up to this lot |
| `safety_stock` | units | – | 0–500 | FG safety stock per model |
| `mix` | share | 1 | ≥ 0; code normalises the sum to 1 | product mix (what-if and default gate) |
| `spec_flow_m3_h` | m³/h | station value | > 0 | test specification of this model |
| `size` | factor | 1 | 0.5–2 | 3D size only |
| `cycle_s` | `{station id or prefix: s}` | `{}` | 1–36 000 s | model cycle times; missing → `cycle_time_s × time_factor` |
| `time_factor` | factor | 1.0 | 0.3–3 | for stations not listed in `cycle_s` |

**`fms`**:

| Key | Unit | Default | Range | Meaning |
|---|---|---|---|---|
| `rule` | enum | EDD | FIFO, EDD, SPT, SETUP | dispatching rule |
| `window_h` | h | 8 | 0.5–168 (code, rule command) | due-date window of the SETUP rule |
| `max_batch` | units | 10 | 1–100 | batch limit of the SETUP rule in what-if (no orders there) |

**Station keys of the FMS:**

| Key | Format | Range | Meaning |
|---|---|---|---|
| `setup_s` | s | 0–14 400 | changeover per model change |
| `tool_magazine` | `{"sets": 2, "load_s": 600, "initial": ["VC10","VC20"]}` | sets ≥ 1 (code), load_s 0–7 200 | tool sets in the magazine, exchange time, start content |
| `pick` | `"rule"` / `"kit"` / missing | – | how the next part is chosen |
| `kanban` | `{"buffer", "target", "trigger"}` | trigger < target; default trigger = target / 2 | pull control of the first machine of a line |
| `serial` | text | – | this station gives serial numbers (load station) |
| `seize` / `release` | pool id | must exist | take / give back a fixture pallet |
| `set_up_for` | model id | – | model the machine is set up for at start |

**Buffer and input keys:** `per_variant` (max parts per model in a supermarket), `variant` (model of a
store), input `alt` (`{"VC10": "RAW_TANK100", ...}` = model-specific input buffer).

### 11.2 Data structures (from the code)

**Work order** (`twin/mes.py`):

| Field | Type | Example | Meaning |
|---|---|---|---|
| `id`, `n` | text, int | `WO-0001`, 1 | number |
| `item`, `product` | text | `VC20-300`, `VC20` | SKU and model |
| `qty`, `started`, `done`, `scrap` | int | 50, 12, 10, 0 | counters; still to start = qty − (started − scrap) |
| `status` | enum | PLANNED, RELEASED, IN_PROGRESS, COMPLETED | |
| `due`, `created`, `released`, `completed` | s (sim time) | – | |
| `source` | text | `MRP`, `SO-0001`, `Manual` | where it came from |
| `so` | text | `SO-0001` | pegged sales order (MTO) |
| `priority` | int | 3 (MTO), 5 (MRP) | 1 = most urgent |

**Sales order** (`twin/erp.py`): `id` (SO-0001), `customer` (≤ 60 characters), `qty`, `product`, `sku`,
`shipped`, `picking`, `status` (OPEN … SHIPPED), `created`, `due`, `shipped_t`, `on_time`, `value`
(qty × price), `mto`, `auto`.

**Purchase order:** `id` (PO-0001), `sku`, `name`, `supplier`, `qty`, `cost`, `status`, `source`,
`ordered`, `due` (= ordered + lead time), `received`, `lot` (`<prefix>-L<PO number>`, e.g. `T300-L0001`).

**Kanban card** (proposal for the real factory, electronic or paper):

| Field | Example |
|---|---|
| Card id | `KB-CYL-VC20-03` (proposal) |
| Part / model | cylinder, VC20 |
| Quantity per card (container) | 6 cylinders |
| Supplier process → customer process | VMC-01/HONE-01 → ASSY-01 |
| Lane location | `FLR-ASM-R01-P02` |
| Cards in the loop | target / quantity per card = 12 / 6 = 2 |

### 11.3 API fields with ranges

| Call | Field | Type | Range / rule |
|---|---|---|---|
| `POST /api/erp create_so` | `customer` | text | cut to 60 characters (code) |
| | `qty` | int | > 0 |
| | `due_h` | h | > 0 (recommended ≥ lead time, 4.9) |
| | `product` | model id | must exist |
| | `mto`, `auto` | bool | – |
| `POST /api/command rule` | `value` | enum | FIFO, EDD, SPT, SETUP |
| | `window_h` | h | 0.5–168 (code clamps) |
| `POST /api/command step` | `value` | s | 1–14 400 (code clamps) |
| `POST /api/erp receive_now` | `id` | PO id | open PO |
| `POST /api/mes release` | `id` | WO id | status PLANNED |

### 11.4 Real equipment – specification tables to send to suppliers

All values are **examples** from the twin config; replace with your process data.

**A) Fixture load station (LOAD-CC)**

| Group | Requirement |
|---|---|
| Performance | load + clamp + mark ≤ 80 / 90 / 100 s for VC10 / VC20 / VC30 (twin cycle), one operator |
| Function | take casting from line-side place (4 per model), place on fixture pallet, clamp, mark serial number, confirm in MES |
| Ergonomics | working height adjustable or 900–1 050 mm; lifting aid (balancer) if casting > 15 kg (check national manual-handling limits, ISO 11228-1) |
| Accuracy | casting located on fixture datum; clamping force documented per model |
| Interfaces | MES: work order + model + serial number; pallet RFID read/write; marking unit; pallet-pool system "pallet ready" |
| Safety | risk assessment per ISO 12100; guarding of the marking laser (laser class per IEC 60825-1) |
| Documentation | layout, electrical drawings, signal list, operating manual, spare parts list |
| Acceptance | 50 loads per model within cycle; 100 % correct serial ↔ pallet ↔ WO link; no wrong-model load possible |

**B) Fixture pallets (pool PAL-CC, 10 pieces)**

| Group | Requirement |
|---|---|
| Quantity | 10 (twin: Little's law minimum 3.7 + buffer, guide 03, 4.6) |
| Interface to HMC | zero-point clamping / pallet changer interface of the HMC supplier |
| Accuracy | repeatability of the pallet on the machine: ask the HMC supplier (typical zero-point systems claim a few µm) |
| Models | one fixture for VC10 / VC20 / VC30 (quick-change locators) or model-coded fixtures |
| Identification | RFID tag (11.4 D) + engraved plate `PAL-0001` … `PAL-0010` |
| Environment | coolant and chips; corrosion protected |
| Acceptance | measure repeatability 10 × per pallet on each HMC; all within the process tolerance budget |

**C) Part marking and code reading**

| Group | Requirement |
|---|---|
| Code | Data Matrix ECC 200 (ISO/IEC 16022) |
| Content | compressor serial number, e.g. `VC20-2546-00123` (15 characters) |
| Size / place | e.g. 8–12 mm square on a machined or flat cast pad; quiet zone around it |
| Method | dot-peen or laser on cast iron; must survive washing and painting (or mask during painting) |
| Quality | direct-part-mark grade per ISO/IEC TR 29158 – minimum grade to agree (example: C or better) |
| Readers | fixed readers at LOAD-CC, each HMC, ASSY-01, TEST, FINAL-01, PACK-01; first-read rate ≥ 99.5 % (example) |
| Interface | reader → PLC / MES (OPC UA or TCP), result + read quality |
| Acceptance | 200 parts: read at every station, no wrong read, grade report |

**D) RFID on fixture pallets and containers**

| Group | Requirement |
|---|---|
| Standard | HF 13.56 MHz ISO/IEC 15693, or UHF ISO/IEC 18000-63 – one standard for the whole plant |
| Tag | on-metal type, IP67 or better, resistant to coolant; −10 … +80 °C |
| Data | pallet id (fixed); serial number, model, WO, process step (written) |
| Read range | as the station needs (HF typically a few cm–tens of cm; UHF larger – ask supplier) |
| Acceptance | 1 000 reads per station without failure; write-verify test |

**E) Kanban supermarket racks (B_CYL, B_CS)**

| Group | Requirement |
|---|---|
| Lanes | one lane per model; cylinders 12 per model (36 total), crankshafts 8 per model (24 total) – config values |
| Type | gravity flow rack (FIFO), or containers on roller lanes; part protection (no metal contact on machined surfaces) |
| Marking | lane colour per model (VC10 / VC20 / VC30), max level line, trigger line |
| Signal | sensor at the trigger position per lane (light barrier / weight) → PLC → line display (electronic kanban) |
| Ergonomics | pick height 700–1 200 mm (example), from the assembly side |
| Acceptance | fill each lane to max; trigger signal at the right count ±0; FIFO verified |

**F) MES functions for the FMS (software specification)**

| Function | Requirement (copy of the twin logic) |
|---|---|
| Work orders | per model; priority; due date; MTO / MTS flag; counts started − scrap (automatic replacement) |
| Release gate | load station starts only units of released WOs, in rule order (FIFO / EDD / SPT / SETUP window) |
| Material call | castings per model only for released WOs (twin `variant_need`) |
| Kit check | ASSY starts only with a complete kit of the same model; re-sequencing logged |
| Tool-set awareness | send pallet to an HMC that has the model's tool set (SETUP rule) or plan the exchange |
| Pegging | serial ↔ sales order lock; WMS must respect it |
| Interfaces | ERP (ISA-95 / B2MML style messages), PLC (OPC UA), WMS, fleet manager |
| Acceptance | go-live tests 6.4 all passed; one week parallel run with the twin |

---

## 12. Identification and numbering

The project scheme is in `docs/15_numbering_and_identification.md` (guide 15). This chapter uses it;
if anything differs, **guide 15 wins**. The twin keeps its short ids; they map 1:1 to the real formats.

### 12.1 Orders and records (guide 15, 3.7–3.8)

Format of orders: `<prefix>-<YYWW>-<4 digits>`, the sequence restarts at `0001` every ISO week per prefix.

| Object | Twin format (code) | Real factory | Example |
|---|---|---|---|
| Sales order | `SO-0001` | `SO-<YYWW>-<nnnn>` | `SO-2546-0002` |
| Work order | `WO-0001` | `WO-<YYWW>-<nnnn>` | `WO-2546-0001` |
| Purchase order | `PO-0001` | `PO-<YYWW>-<nnnn>` | `PO-2545-0011` |
| Maintenance WO | `MWO-0001` | `MWO-<YYWW>-<nnnn>` | `MWO-2546-0012` |
| NCR (non-conformance) | `NCR-00002` | `NCR-<YYWW>-<nnnn>` | `NCR-2548-0002` |
| Own material lot | `CC20-L0003` (`<buffer prefix>-L<PO no.>`) | `LOT-<item prefix>-<YYWW of receipt>-<nnn>` + supplier batch | `LOT-CC20-2546-003` |

### 12.2 Units, parts, carriers and tools

| Object | Twin | Project format | Example |
|---|---|---|---|
| Compressor serial (marked on the crankcase at LOAD-CC) | `VC20-000012` | `<model>-<YYWW>-<5 digits>`, restarts at 00001 every ISO week per type code | `VC20-2546-00123` |
| Cylinder / crankshaft | part id `CYL-000123` | no own serial: traced by lot `LOT-CYL-…` / `LOT-CS-…` and container | – |
| Fixture pallet | pool `PAL-CC`, count 10 | `PAL-<4 digits>` (engraved + HF RFID tag) | `PAL-0007` |
| Fixture on the pallet | – | `FIX-<4 digits>` | `FIX-0003` |
| Crate (cylinders, crankshafts in containers) | – | `CRT-<6 digits>` | `CRT-000123` |
| Supermarket lane (floor / supermarket location) | `B_CYL` with `per_variant` | `FLR-<area>-R<rr>-P<pp>` | `FLR-ASM-R01-P02` (cylinder rack, VC20 lane) |
| Kanban card | – | `KB-<part>-<model>-<nn>` (proposal of this guide – not in guide 15) | `KB-CYL-VC20-03` |
| NC program | `OHMC01_VC20.nc` (twin example) | O-number `O<p><k><oo>` + file `<part no.>_<OP>_<machine type>_<rev>.nc` | `O2102`, `VC-PRD-CC-0020_OP20_HMC_C.nc` |
| Tool / sister tool | – | `T<f><nnn>` / `T<f><nnn>-<nn>` | `T1203`, `T1203-01` |
| Tool set of one model on one HMC | `initial: ["VC10","VC20"]` | list of tool numbers per O-program; set name `TS-<model>-<machine>` (proposal) | `TS-VC20-HMC01` |

YYWW = ISO year (2 digits) + ISO week (2 digits), Python `date.isocalendar()` (guide 15, 3.15).

### 12.3 Tags of the FMS (format `<Area>_<Line>_<Machine>_<Signal>`, codes from guide 15, 3.10)

Lines: `MCH_L1` crankshaft, `MCH_L2` crankcase FMS cell, `MCH_L3` cylinder, `ASM_L1` pump assembly.

| Tag | Meaning | Unit |
|---|---|---|
| `MCH_L2_LOADCC_PalletId` | pallet at the load station | text |
| `MCH_L2_LOADCC_SerialNo` | serial number just marked | text |
| `MCH_L2_LOADCC_WorkOrder` | WO of the unit being loaded | text |
| `MCH_L2_HMC01_ProgramNo` | active NC program | text |
| `MCH_L2_HMC01_ToolSets` | tool sets in the magazine | text list |
| `MCH_L2_HMC01_SetupActive` | changeover running | bool |
| `MCH_L2_HMC01_Setup_Cnt` | number of changeovers | pcs |
| `MCH_L3_VMC01_ModelActive` | model now in the cylinder line | text |
| `MCH_L1_LATHE01_ModelActive` | model now in the crankshaft line | text |
| `ASM_L1_SMCYL_LevelVC20` | cylinder supermarket level VC20 | pcs |
| `ASM_L1_SMCYL_TriggerVC20` | lane at trigger | bool |
| `ASM_L1_ASSY01_KitComplete` | kit check result | bool |

### 12.4 Drawings and documents for this topic (codes from guide 15, 3.2 / 3.4; running numbers are examples)

| Number | Content |
|---|---|
| `VC-MCH-FIX-0014-A` | crankcase fixture for HMC (all models or per model) |
| `VC-MCH-PAL-0001-A` | machining / fixture pallet base |
| `VC-MCH-CEL-0001-A` | crankcase cell layout incl. load station and pallet pool |
| `VC-ASM-STN-0010-A` | supermarket flow rack, cylinders |
| `VC-ASM-STN-0011-A` | supermarket flow rack, crankshafts |
| `VC-PRD-CC-0020-C` | crankcase VC20, machined – shows the DMC position |
| `VC-QA-SPEC-0001-A` | marking specification: DMC content, size, grade (11.4 C) |
| `VC-MCH-SPEC-0001-A` | load station and fixture pallet specification (11.4 A, B) |

---

## 13. Standards for this topic

| Number | Title (short) | What it requires / gives for us | Value / clause used | How to verify |
|---|---|---|---|---|
| ISO 9001 | Quality management systems | identification and traceability of outputs when required | clause 8.5.2 (2015 edition) | audit: serial → lots → test result in ≤ 5 min |
| IEC 62264-1, -2, -3 (ISA-95) | Enterprise–control integration | object models (production schedule, performance, material) and MOM activity models | ERP ↔ MES messages (step 8 in chapter 5) | interface specification review |
| ISO 22400-2 | KPIs for manufacturing operations management | KPI definitions (OEE, throughput, WIP, setup ratio …) | weekly KPI list of step 7 (check clause in current edition) | KPI sheet |
| ISO/IEC 16022 | Data Matrix bar code symbology | symbol structure ECC 200 | part marking (11.4 C) | verifier report |
| ISO/IEC TR 29158 | Direct part mark (DPM) quality guideline | grading method for marked parts | minimum grade in contract (check current edition) | verifier report on sample parts |
| ISO/IEC 15415 | 2D symbol print quality test | grading of printed 2D codes (labels) | labels on containers | verifier |
| ISO/IEC 15459 | Unique identification | rules for unique identifiers of items and transport units | basis of serial / carrier ids | – |
| ISO/IEC 15693 / ISO/IEC 18000-63 | RFID air interfaces (HF vicinity cards / UHF) | tag–reader compatibility | one standard plant-wide (11.4 D) | read test |
| ISO 1217 | Displacement compressors – acceptance tests | how to measure free air delivery (FAD) and power; tolerances for packaged compressors (annex) | test bench method; our ± 3 % internal limit is separate from the standard's tolerance bands (check annex values in current edition) | bench calibration and comparison |
| ISO 13399 | Cutting tool data representation | standard tool data | tool data exchange with presetter / CAM | data import test |
| ISO 6983-1 | NC program format | G-code structure | NC programs per model (guide 08) | – |
| ISO 12100 | Safety of machinery – risk assessment | risk assessment method | load station, marking unit | risk assessment document |
| IEC 60825-1 | Safety of laser products | laser classification | laser marking unit | supplier certificate |
| ISO 11228-1 | Ergonomics – manual handling, lifting and carrying | limits for manual lifting | casting handling at LOAD-CC (check national rules too) | workplace assessment |
| ISO 8601 | Date and time | week numbering for YYWW | serial numbers | – |

---

## 14. Complete worked example – one make-to-order order, 50 × VC20

**Situation:** manual mode, empty factory, rule EDD. Customer "Alpha Tools" orders 50 × VC20, due in
48 h. Stock as in the config, **except** (assumption for the example) only 30 tanks of 300 L are in the
floor store because other orders used them.

**Step 1 – Sales order**

```
SO-0001: 50 × VC20-300, due = now + 48 h, value = 50 × 1 450 = 72 500 USD, mto = true
```

**Step 2 – Work order**

```
plan_so → WO-0001: qty 50, product VC20, priority 3, due = SO due, so = SO-0001
```

**Step 3 – Material check (4.7)** – BOM per VC20: 1 CC20 casting, 2 cylinder castings, 1 crankshaft
forging, 1 tank 300 L, 1 motor 4 kW.

| Item | Need | Have | Short | Lot | Purchase order |
|---|---|---|---|---|---|
| CC20-CAST | 50 | 360 | 0 | – | – |
| CYL-CAST | 100 | 900 | 0 | – | – |
| CS-FORG | 50 | 480 | 0 | – | – |
| TANK-300 | 50 | 30 | **20** | 60 | **PO-0001: 60 tanks** (rounded up), 60 × 180 = 10 800 USD, lead time 12 h |
| MOT-4KW | 50 | 200 | 0 | – | – |

**When is the tank needed?** (not only "how many"): unit k reaches FINAL-01 at about
0.67 h + (k − 1) × 210 s. Unit 31 needs a tank after 0.67 h + 30 × 210 s = 0.67 + 1.75 = **2.4 h**.
The PO arrives after 12 h → FINAL-01 waits **≈ 9.6 h**. Decision options: expedite the supplier, or
release now and accept that 20 units finish later (due date 48 h is still met). Here: release now.

**Step 4 – Release** WO-0001. LOAD-CC starts VC20 units in EDD order.

**Step 5 – Production**

| Item | Calculation | Result |
|---|---|---|
| Bottleneck for VC20 only | FINAL 210 s; VMC 2 × 100 = 200 s; ASSY 200; GRIND 190; TEST 360 / 2 = 180; HMC 360 / 3 = 120 | FINAL-01, 3 600 / 210 = 17.1 units/h |
| Flow time of unit 1 | critical path 1 760 s + AGV 2 min + setups 7 min + AGV to FG 2 min (4.9) | ≈ 40 min |
| Units 1–30 finished | 0.67 h + 29 × 210 s | ≈ 2.4 h |
| Units 31–50 | tanks arrive at 12 h; 20 × 210 s = 1.17 h; + pack and AGV ≈ 0.1 h | ≈ 13.3 h |
| Kanban load | VMC runs VC20 at 200 s per unit vs 210 s demand → ρ = 0.95; GRIND 190 / 210 → ρ = 0.90 | lines keep up, little reserve |
| AGV trips for castings | 50 / 4 per trip | 13 trips (13 crane retrievals of 4 castings) |
| AGV trips for cylinders / crankshafts | 100 / 12; 50 / 6 | 9 + 9 trips |
| Expected test rejects | p = 1.16 % (guide 01, 4.8) → 50 × 0.0116 | 0.58 units |
| Chance of at least one reject | 1 − (1 − 0.0116)⁵⁰ = 1 − 0.558 | **44 %** → WO starts a 51st unit automatically |
| Serial numbers | twin `VC20-000001` …; project format | `VC20-2546-00001` … `-00050` (+ replacement) |

**Step 6 – Finished-goods AS/RS**

```
50 store jobs × 60 s = 50 min crane time, spread over ≈ 13 h
```

**Step 7 – Ship**

```
50 retrievals × 60 s = 50 min of continuous crane time → the truck must be at the dock ≥ 50 min
revenue 72 500 USD; material 50 × 741 = 37 050 USD; contribution 35 450 USD
finished after ≈ 13.3 h < due 48 h → on time
```

Each serial number in the MES shows: WO-0001, SO-0001, Alpha Tools, ship date, casting lot (e.g.
`CC20-L0000` start stock), cylinder and crankshaft lots, tank lot `T300-L0001` (units 31–50, from PO-0001),
FAD value from the test bench.

In real-factory numbers (guide 15), if the order is entered in ISO week 46 of 2025: `SO-2546-0001`,
`WO-2546-0001`, `PO-2546-0001`, serials `VC20-2546-00001` …, tank lot `LOT-T300-2546-001` (or the week of
receipt, 2547, if the tanks arrive in the next week).

**Lesson of the example:** the material check must compare the **time** a part is needed with the
**arrival time** of the purchase order. The twin's material check (4.7) counts quantities only.

---

## 15. Data you still need from suppliers / measurements

| What | Why | Who |
|---|---|---|
| Setup time **matrix** per station (from model → to model), internal / external part | `setup_s`, batch sizes (4.3, 10.7) | machine suppliers, SMED study |
| Tool lists per model and HMC; magazine places; tool-set exchange time with prepared tools | `tool_magazine` (3.3) | HMC supplier, NC programmer |
| Fixture concept: one fixture for all models or change; clamping time per model | LOAD-CC cycle, pallet count | fixture supplier |
| Repeatability of pallet on machine | process capability | HMC / zero-point supplier |
| Real demand per model per day and its variation (σ) | kanban targets, safety stock (10.9) | sales / planning |
| Refill time of each kanban loop (measured) | kanban targets (4.5) | industrial engineering |
| Supplier lead times, minimum lots, reliability of delivery dates | MRP (4.6), worked example step 3 | purchasing, suppliers |
| Ordering and holding cost | EOQ (10.10) | finance |
| Marking method that survives washing and painting; achievable code grade on cast iron | traceability (11.4 C) | marking supplier, trial on real castings |
| RFID standard decision and tag test on our pallets | 11.4 D | automation team, RFID supplier |
| ERP / MES message formats and which system does MRP, release, picking | chapter 5 step 8 | IT, ERP / MES suppliers |
| Test-bench measurement uncertainty and FAD scatter of real units | test reject rate (guide 01, 4.8) | R&D, test bench supplier |
| Number of operators per area and shift | operators are not modelled (8) | production management |

---

## 16. Glossary

| Term | Simple meaning |
|---|---|
| **FMS** | Flexible Manufacturing System: machines that can make several models with little changeover, plus automatic part flow |
| **Model / variant (`v`)** | VC10, VC20 or VC30; written on every part record |
| **HMC** | Horizontal Machining Center (here: crankcase machining) |
| **Tool magazine** | storage of tools in the machine; here it holds the tool sets of 2 models |
| **Tool set exchange** | replacing the tools of one model by the tools of another model (600 s example) |
| **SETUP (state)** | machine is changing over to another model; lost time |
| **Changeover / setup time (`setup_s`)** | time lost when the model changes |
| **SMED** | method to reduce setup time (separate internal and external work) |
| **Fixture pallet** | pallet with a fixture that holds a casting during machining; the number of pallets limits WIP |
| **Load station** | clamps castings on pallets and marks the serial number; starts units only for released work orders |
| **Kanban** | pull signal: make only what was used |
| **Supermarket** | small store in front of the user with fixed places per model |
| **Target / trigger** | kanban stock to reach / level at which a model change is allowed |
| **Kit** | all parts of one unit of one model (1 crankcase + 2 cylinders + 1 crankshaft) |
| **Dispatching rule** | rule that decides which order or pallet goes first (FIFO, EDD, SPT, SETUP) |
| **EDD** | Earliest Due Date first |
| **SPT** | Shortest Processing Time first |
| **FIFO** | First In, First Out |
| **Due-date window** | time slice (example 8 h) used by the SETUP rule to group orders |
| **Priority** | number on a work order; 1 = most urgent; always sorted before the rule |
| **Sales order (SO)** | customer order in the ERP |
| **Work order (WO)** | production order in the MES for one model |
| **Purchase order (PO)** | order to a supplier |
| **MTO / MTS** | make-to-order (for one customer) / make-to-stock (for anonymous stock) |
| **Pegging** | fixed link between a unit (serial number) and a customer order |
| **MRP** | Material Requirements Planning: calculates work orders and purchase orders from demand and stock |
| **Net requirement** | what is still missing after stock and open orders are subtracted |
| **Lot size** | quantity is rounded up to a multiple of it |
| **Safety stock** | extra stock against uncertainty |
| **Release** | the MES allows the shop floor to start a work order |
| **FG** | finished goods |
| **Partial shipment** | shipping only part of an order |
| **OEE** | Overall Equipment Effectiveness = availability × performance × quality |
| **WIP** | work in progress: units started but not finished |
| **LRU** | least recently used: the tool set used longest ago leaves the magazine first |
| **Little's law** | WIP = throughput × flow time (L = λ × W) |
| **Utilisation (ρ)** | share of time a machine is needed: λ × t_e / c |
| **Coefficient of variation (c)** | standard deviation ÷ mean; measures how irregular times are |
| **Kingman / VUT equation** | waiting time ≈ variability × utilisation factor × process time |
| **Critical path** | longest chain of steps that must happen one after the other; sets the flow time of one unit |
| **Contribution** | price − material cost; money earned per unit before labour and overhead |
| **EOQ** | economic order quantity: lot size with the lowest sum of ordering and holding cost |
| **YYWW** | ISO year (2 digits) + ISO week (2 digits) in serial and order numbers (guide 15) |
