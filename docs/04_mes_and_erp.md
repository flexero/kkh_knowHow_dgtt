# 04 – MES and ERP: Work Orders, Traceability, Quality, Maintenance, MRP, Purchasing, Stock and Cost

> **All numbers in this guide are example values** from `config/factory.json` and from test runs of the twin.
> They are not data from your factory. Replace them with your own data (supplier quotes, measured cycle
> times, real test results) before you use them for decisions.

---

## 1. Purpose

This guide explains the two business IT systems of the factory:

* **MES** (Manufacturing Execution System) – runs the shop floor *today*: which work order starts now,
  which serial number is where, did it pass the test, which machine needs maintenance.
* **ERP** (Enterprise Resource Planning), manufacturing part only – plans the *business*: customer orders,
  what to make (work orders), what to buy (purchase orders), stock, cost, revenue.

After reading it, you and your team should be able to:

1. Use the MES and ERP tabs of the twin and understand every number on them.
2. Do the MRP calculation and the Cpk calculation by hand and get the same result as the twin.
3. Write a requirements list for a real MES and ERP, prepare the master data, and plan the go-live.

**Why this matters:** machines, AGVs and PLCs can be perfect, but if the work order is wrong, the material is
not bought on time, or a bad casting lot cannot be traced, the factory still fails. MES and ERP are the
"brain" above the machines.

---

## 2. Where in the twin

| What | Where |
|---|---|
| MES tab | Browser `http://localhost:8080/#mes` (HTML: `web/index.html`, section `tab-mes`; drawing code: `renderMES()` in `web/ops.js`) |
| ERP tab | `http://localhost:8080/#erp` (section `tab-erp`; `renderERP()` and `renderCost()` in `web/ops.js`) |
| MES logic | `twin/mes.py` (class `MES`) |
| ERP logic | `twin/erp.py` (class `ERP`) |
| Settings | `config/factory.json`: `erp` section (items, lots, safety stocks, lead times, rates), `products` section (price, `wo_lot`, `safety_stock`, mix, cycle times per model), stations (`mtbf_h`, `mttr_min`, `spec_flow_m3_h`, `flow_tolerance_pct`, `serial`) |
| Messages between layers | `twin/comm.py` (14-step workflow), Communication tab |
| Unit history on disk | `data/history.db` (SQLite, table `units`) – written by `twin/historian.py` |
| API | `GET /api/mes`, `GET /api/mes/unit?sn=VC20-000012`, `POST /api/mes`, `GET /api/erp`, `POST /api/erp` (see README) |

### 2.1 MES tab – what you see

| Card | Content | Buttons |
|---|---|---|
| KPI tiles | Open work orders (+ units still to start), units in production, first-pass yield, Cpk, open maintenance orders | – |
| Work orders | Order, model, qty, started, done, scrap, progress, status, due, source (MRP / Manual / SO number) | **New work order** (model, qty, due in h, release yes/no), **Release**, **Hold**, **Close** |
| Traceability (genealogy) | Type or click a serial number: status, location, model, work order, air flow, customer, route (station + start → end time), components with lots | **Find** |
| Latest units | Last finished / scrapped / shipped units | click a serial number |
| Quality: air-flow test (SPC) | Chart of the measured FAD with UCL, LCL, LSL, mean; mean, σ, Cpk, out-of-control count; FPY and mean FAD per model | – |
| Non-conformance records | NCR number, time, station, part, lot, reason | – |
| Maintenance work orders | Order, machine, type (corrective / predictive / preventive), task, status | **Start** (stops the machine for maintenance), **Close** |
| Reliability: actual vs. plan | Failures, MTBF actual vs. plan, MTTR actual vs. plan (only machines with failures) | – |

### 2.2 ERP tab – what you see

| Card | Content | Buttons |
|---|---|---|
| KPI tiles | Revenue, gross profit (+ standard margin), on-time delivery, order backlog (+ late orders), inventory value (incl. WIP), purchases | – |
| Planning (MRP) and automation | Last MRP run: finished-goods table per model and material table per item, with every term of the formula | **Run MRP now**; switches: random customer orders, demand units/day, MRP every hour, release work orders automatically, ship automatically |
| Sales orders | Order, customer, model, qty, shipped (+ being picked), status, due / on time / late, value | **New order**; **Ship** (only when automatic shipping is off) |
| Inventory | Item, location (AS/RS or floor store), on hand, put-away, on order, safety, coverage hours, value, status (OK / LOW / SHORT) | – |
| Purchase orders | Order, item, supplier, qty, cost, status, arrival, lot | **Order** (item, qty) |
| Bill of materials and standard cost | Cost comparison of the 3 models, BOM of the selected model, cost breakdown, machine + labour cost per station | click a model |

---

## 3. Concepts simply

### 3.1 The ISA-95 levels (IEC 62264)

ISA-95 (international version IEC 62264) splits a factory into levels. Each level talks only to its
neighbours. The twin uses exactly these levels (`twin/comm.py`):

| Level | System | Time scale | Job in this factory |
|---|---|---|---|
| External | Customers, suppliers | days | Send orders, receive deliveries and invoices |
| **L4** | **ERP** | days, hours | Sales orders, MRP, purchasing, stock, cost, shipping |
| **L3** | **MES** | hours, minutes | Work-order release and dispatching, serial numbers, genealogy, quality, maintenance orders |
| L2 | SCADA (+ the twin) | seconds | Operator screens, alarms, trends, historian |
| L1 | PLC, CNC, AGV, test bench | milliseconds | Run the machines, report part done, test results, alarms |
| L0 | Sensors, actuators | milliseconds | Flow meter, pressure transmitter, vibration sensor, valves |

**Simple rule:** the ERP says **WHAT** and **WHEN** (23 × VC20-300 by Wednesday). The MES decides **HOW** and
**WHERE** (which machine, which program, in which sequence). The PLC **DOES** it.

### 3.2 Data flow ERP ↔ MES ↔ SCADA/PLC

Orders go **down**, results go **up**. These are the 14 steps of `twin/comm.py` (also in the Communication tab):

| Step | From → To | Message | Typical protocol | In the twin |
|---|---|---|---|---|
| 1 | Customer → ERP | Customer order | EDI ORDERS or web portal | `erp.create_so()` |
| 2 | ERP (inside) | MRP run | calculation | `erp.run_mrp()` every hour |
| 3 | ERP → supplier | Purchase order | EDI ORDERS | `erp.create_po()` |
| 4 | Supplier → ERP | Delivery, goods receipt, **lot number** | EDI DESADV + barcode/RFID scan | `erp._receive()` |
| 5 | ERP → MES | Work order | **ISA-95 B2MML ProductionSchedule** | `mes.create_wo()` |
| 6 | MES → PLC (via SCADA) | Release, recipe | OPC UA method call | `mes.wo_action("release")`, `mes.gate()` |
| 7 | MES/fleet → AGV | Transport order | VDA 5050 over MQTT | `handling._assign()` |
| 8 | PLC → MES | Unit started, **serial number**, casting lot | OPC UA | `mes._on_start()` |
| 9 | MES → CNC | Changeover / NC program | OPC UA file transfer, MTConnect | machine changeover (state SETUP) |
| 10 | Sensors → SCADA | Sensor data | IO-Link / 4–20 mA → PLC → OPC UA/MQTT | historian |
| 11 | Test bench → MES | Test result (FAD) | OPC UA or MQTT JSON | `mes._on_test()` |
| 12 | PLC/analytics → MES | Alarm → maintenance order | OPC UA Alarms & Conditions | `mes._new_mwo()` |
| 13 | MES → ERP | Production confirmation | **ISA-95 B2MML ProductionPerformance** | `mes._on_fg()` |
| 14 | ERP → customer | Shipment, invoice | EDI DESADV + INVOIC | `erp._shipped()` |

### 3.3 The B2MML idea

**B2MML** (Business To Manufacturing Markup Language) is an XML (or JSON) format, published by MESA, that
implements the ISA-95 object models. Its idea is simple:

* A message = **verb + noun**. Verb = what to do (`Process`, `Acknowledge`, `Get`, `Show`, `Sync`...).
  Noun = which ISA-95 object (`ProductionSchedule`, `ProductionPerformance`, `MaterialDefinition`...).
* `ApplicationArea` = the envelope (sender, time). `DataArea` = verb + noun + data.
* Field names come from the ISA-95 dictionary (`MaterialDefinitionID`, `Quantity`, `EndTime`...), so ERP
  and MES suppliers understand the same words.

The two most important messages in this factory:

| Message | Direction | Content in the twin (`twin/mes.py`) |
|---|---|---|
| `ProcessProductionSchedule` | ERP → MES | work order ID, `MaterialDefinitionID` (e.g. VC20-300), quantity, due, priority, sales order |
| `ProcessProductionPerformance` | MES → ERP | per finished unit: order, serial, material, qty 1, location; per completed work order: good qty, scrap qty |

Shortened example (from the Communication tab, step "ERP sends the work order to the MES"):

```xml
<ProcessProductionSchedule xmlns="http://www.mesa.org/xml/B2MML">
  <ApplicationArea><Sender><LogicalID>ERP</LogicalID></Sender>
    <CreationDateTime>2026-11-09T08:20:00Z</CreationDateTime></ApplicationArea>
  <DataArea>
    <Process/>
    <ProductionSchedule><ProductionRequest>
      <ID>WO-0012</ID><Priority>3</Priority><EndTime>2026-11-11T08:00:00Z</EndTime>
      <MaterialProducedRequirement>
        <MaterialDefinitionID>VC20-300</MaterialDefinitionID><Quantity>23</Quantity>
      </MaterialProducedRequirement>
    </ProductionRequest></ProductionSchedule>
  </DataArea>
</ProcessProductionSchedule>
```

**Why it matters for you:** if you buy ERP and MES from different suppliers, ask both for B2MML (or an
agreed ISA-95 based JSON/REST interface). Then the interface is a contract on paper, not a custom program
that only one person understands. Many real projects still use a custom REST/SQL interface – that is fine,
but use the ISA-95 object names in it.

### 3.4 Key words in one sentence each

| Word | Meaning |
|---|---|
| Sales order (SO) | A customer wants N units of a model by a due date. |
| Work order (WO) | An instruction to the shop floor: make N units of a model by a due date. |
| Purchase order (PO) | An order to a supplier: deliver N pieces of an item after the lead time. |
| BOM | Bill of materials: which purchased items, and how many, go into one unit. |
| Routing | The sequence of stations (operations) and their cycle times for one unit. |
| MRP | Material Requirements Planning: calculates what to make and what to buy. |
| Lot | A group of parts with the same origin (one delivery, one heat, one casting batch). |
| Serial number | A unique number for one single compressor. |
| Genealogy | The "family tree" of one unit: which component lots are inside it. |
| SPC | Statistical Process Control: a chart that shows if a process is stable. |
| Cpk | A number that says if a stable process is good enough for the specification. |
| NCR | Non-conformance record: a written record of a bad part (scrap, reject). |
| MTBF / MTTR | Mean time between failures / mean time to repair. |
| Pegging | Units are reserved for one customer order (make-to-order). |

---

## 4. Model and formulas

### 4.1 Work orders (MES)

#### 4.1.1 Status life cycle

```
            release                 first unit started              all units good in FG store
PLANNED ------------> RELEASED ------------------------> IN_PROGRESS --------------------------> COMPLETED
   |                     |  ^                                |  ^
   |                hold |  | release                   hold |  | release
   |                     v  |                                v  |
   |                   ON_HOLD <-----------------------------+--+
   |
   +-- close (from PLANNED, RELEASED, IN_PROGRESS, ON_HOLD) --> CLOSED
```

Rules from `MES.wo_action()`:

| Action | Allowed from | Result |
|---|---|---|
| release | PLANNED, ON_HOLD | RELEASED (or IN_PROGRESS if units were already started) |
| hold | RELEASED, IN_PROGRESS | ON_HOLD – no new units start; units already on the line continue |
| close | any open status | CLOSED – the order is finished by hand (e.g. cancelled) |
| (automatic) | IN_PROGRESS | COMPLETED when `done ≥ qty` |

Every release / hold sends an OPC UA style command (`StartOrder` / `HoldOrder`) to the serial-number station
(the fixture load station `LOAD-CC`).

#### 4.1.2 Order release – the "gate"

The serial-number station (`LOAD-CC`, config field `"serial": "VC"`) asks the MES before every new unit
(`MES.gate()`):

1. Is there a RELEASED or IN_PROGRESS work order that still needs units? If not → *"No released work order"*,
   the station waits. **This is why holding all orders empties the line.**
2. Are the castings of that model at the station? If not → *"Waiting for castings"*.
3. If several orders qualify, the **dispatching rule** picks one (sort key, smallest first):

| Rule | Sort key |
|---|---|
| FIFO | priority, creation number |
| EDD (default in config `fms.rule`) | priority, due date, creation number |
| SPT | priority, total work content of the model, due date |
| SETUP | priority, due-date window (`window_h` = 8 h example), "same model as now running" first, due date |

Priority always comes first (1 = most urgent). Example values in the code: make-to-order work orders get
priority **3**, MRP and manual work orders priority **5**.

Total work content per model (sum of station times, used by SPT), computed by the twin from the config
(example values): VC10 = 2 755 s (46 min), VC20 = 3 345 s (56 min), VC30 = 4 095 s (68 min).

**Note (correction):** the twin adds the time of **every machine** (`MES.work_s` in `twin/mes.py`), so the
3 parallel HMCs and the 2 parallel test benches are counted 3 × and 2 ×. The real work content of **one**
unit is lower: VC10 = 1 915 s, VC20 = 2 295 s (38 min), VC30 = 2 775 s. For SPT this does not matter
(only the ranking VC10 < VC20 < VC30 counts), but use the lower values for lead-time and Little's-law
calculations (10.5).

#### 4.1.3 Quantities of a work order

```
units still to start = qty − (started − scrap)
```

**Why "− scrap":** if a unit of the work order is scrapped (for example at the test bench), the order
automatically starts one more unit, so the customer still gets the full quantity.

Example: WO with qty 20, started 18, scrap 1 → still to start = 20 − (18 − 1) = **3**.

### 4.2 Traceability by serial number (MES)

#### 4.2.1 How numbers are created in the twin

| Thing | Format in the twin | Example | Created when |
|---|---|---|---|
| Serial number | `<model>-<6-digit sequence>` (one sequence for all models) | `VC20-000012` | the load station starts a unit (`Factory.assign_serial()`); marked on the **crankcase** |
| Component ID | `<buffer prefix>-<6-digit sequence>` | `CYL-000994`, `CS-000510`, `T100-000139` | the part leaves its store |
| Lot number | `<buffer prefix>-L<PO number, 4 digits>` | `CC20-L0009` (from PO-0009); start stock `CC20-L0000` | goods receipt of a purchase order (`ERP._receive()`) |

Stock is taken **first in, first out by lot** (`Buffer` in `twin/model.py`), so each component carries the
lot it came from.

These are the **twin's** formats. The real factory uses the project numbering (chapter 12 and
`docs/15_numbering_and_identification.md`): serial `VC20-2646-00123`, lot `LOT-CC20-2646-003`,
work order `WO-2646-0012`.

#### 4.2.2 What the genealogy record contains

`GET /api/mes/unit?sn=...` returns (real example from a twin run):

| Field | Example |
|---|---|
| sn / status / where | `VC10-000409` · IN STOCK · Finished goods AS/RS |
| work order / model / SKU | `WO-0015` · VC10 · VC10-100 |
| test result | FAD 10.08 m³/h |
| customer / sales order | filled when shipped (`mark_shipped()`) |
| route | `LOAD-CC` → `HMC-03` → `WASH-01` → `ASSY-01` → `ROBOT-01` → `TEST-01` → `PAINT-01` → `FINAL-01` → `PACK-01`, each with start and end time |
| components | crankcase `CC10-000090` lot `CC10-L0000`; 2 × cylinder `CYL-000994/995` lot `CYL-L0002` (route VMC-01 → HONE-01); crankshaft `CS-000510` lot `CS-L0001` (route LATHE-01 → GRIND-01); tank `T100-000139` lot `T100-L0011`; motor `M22-000139` lot `M22-L0012` |

Storage: the MES keeps the last 1 000 finished units in memory and writes every finished or scrapped unit to
`data/history.db`, so a unit can be found after it left memory. Shipping updates the record with customer
and order.

**Why genealogy:** if the foundry reports "lot CYL-L0002 has porosity", you must find every compressor that
contains a cylinder of that lot – in minutes, not days. That is the difference between recalling 40 units
and recalling a whole month of production.

### 4.3 Quality: air-flow test, SPC and Cpk (MES)

#### 4.3.1 Pass / fail at the test bench

The test bench measures the free air delivery (FAD). From `Machine._finish_part()` in `twin/model.py`:

```
pass  if  FAD ≥ nominal flow × (1 − tolerance / 100)
LSL = nominal × (1 − tolerance / 100)
```

Example values (tolerance `flow_tolerance_pct` = 3 %):

| Model | Nominal flow | LSL = nominal × 0.97 |
|---|---|---|
| VC10 | 10 m³/h | 9.7 m³/h |
| VC20 | 20 m³/h | **19.4 m³/h** |
| VC30 | 30 m³/h | 29.1 m³/h |

A failed unit is **scrapped** in the twin (no rework loop) and gets an NCR, e.g.
`NCR-00002 · TEST-02 · VC20-000004 · lot CC20-L0000 · "FAD 19.29 < 19.4 m3/h"`.

#### 4.3.2 Why the chart uses % when there are 3 models

With three models (10, 20, 30 m³/h) the values cannot share one chart in m³/h. So the twin plots
**FAD in % of the model's nominal flow**: `pct = FAD / nominal × 100`. Then 100 % = nominal and LSL = 97 %
for every model. With only one model the chart is in m³/h.

#### 4.3.3 Formulas (individuals chart, I-MR) – `MES.quality()`

The twin needs at least **8** test results. It uses the stored tests (up to the last 400).

| Step | Formula |
|---|---|
| 1. Mean | x̄ = (x₁ + x₂ + … + xₙ) / n |
| 2. Moving ranges | MRᵢ = \|xᵢ − xᵢ₋₁\| for i = 2 … n |
| 3. Average moving range | MR̄ = sum of MRᵢ / (n − 1) |
| 4. Process sigma (short term) | σ = MR̄ / d₂, with d₂ = **1.128** (constant for ranges of 2 values) |
| 5. Control limits | UCL = x̄ + 3σ,  LCL = x̄ − 3σ |
| 6. Capability (one-sided, lower limit only) | **Cpk = (x̄ − LSL) / (3σ)** |
| 7. Out of control | number of the last 50 points with \|x − x̄\| > 3σ |
| 8. First-pass yield | FPY = passed / tested |

Why only the lower limit: a customer is never unhappy with **more** air, so there is no upper spec limit.

#### 4.3.4 Worked example (real numbers from a 30-hour twin run, example values)

| Value | Result |
|---|---|
| Tests | 459, passed 456 |
| FPY | 456 / 459 = **99.3 %** |
| Mean x̄ | 102.15 % |
| σ (I-MR) | 2.185 % |
| UCL | 102.15 + 3 × 2.185 = **108.71 %** |
| LCL | 102.15 − 3 × 2.185 = **95.60 %** |
| LSL | 97.0 % |
| Cpk | (102.15 − 97.0) / (3 × 2.185) = 5.15 / 6.555 = **0.79** |

The MES tab shows "capable" at **Cpk ≥ 1.33**, otherwise "not capable". Here 0.79 → not capable.
A Cpk of 0.79 means the lower limit is only about 2.4 σ below the mean (0.79 × 3 = 2.36), so roughly 1 %
of units will fail – this fits the 3 rejects out of 459.

**What to do when Cpk is too low** (the hint in the tab): raise the mean air flow (valves, piston rings,
clearance volume) or reduce the variation (honing quality, ring gap, assembly torque). Raising the mean is
often cheaper than reducing σ.

**Control limits vs. spec limit – do not mix them:**

* **UCL / LCL** come from the process (what it *does*). A point outside means "something changed – find the cause".
* **LSL** comes from the customer (what it *must* do). A point below means "this unit is bad".

### 4.4 Non-conformance records (NCR)

Every scrapped part creates an NCR (`MES._on_scrap()`): number `NCR-00001…`, time, station, part ID (serial
number or component ID), lot, reason. Reasons seen in the twin: `Process defect`, `Worn tool`, and the test
failure text `FAD x.xx < limit`. The MES also counts scrap per station. If the scrapped part is a serial
unit, its work order gets `scrap + 1` and the unit record gets status SCRAPPED.

### 4.5 Maintenance work orders and MTBF / MTTR (MES)

The MES checks every machine every **10 s** (`MES._maintenance()`):

| Type | Created when | Closed when |
|---|---|---|
| CORRECTIVE | the machine goes DOWN (breakdown) – status IN_PROGRESS at once | automatically when the machine is running again; downtime in minutes is recorded |
| PREDICTIVE | the vibration trend reaches the alarm limit in less than **6 h** (analytics) | after a maintenance stop; or marked "too late" if the machine broke down first |
| PREVENTIVE | tool wear ≥ **85 %** | when tool wear is back below 20 % (tool changed), or after a maintenance stop |

**Start** puts the machine into MAINTENANCE state (it stops producing). This is the real trade-off: a planned
stop now, or a longer breakdown later.

**Actual reliability** (`MES.reliability()`):

```
MTBF actual (h)   = running time of the machine (h) / number of failures
MTTR actual (min) = total repair time (min) / number of failures
```

Note: the twin divides **running** time (state RUNNING), not calendar time, by the failures.

Example from a twin run: HMC-01 with 2 failures, MTBF actual 11.1 h vs. plan 30 h, MTTR actual 31.7 min vs.
plan 20 min (plan = `mtbf_h`, `mttr_min` in the config). Such a gap tells you: either the plan values were
too optimistic, or there is a real problem (in the twin, tool breakage and bearing failures add to the
random breakdowns).

### 4.6 Sales orders (ERP)

A sales order (`ERP.create_so()`) has: ID `SO-0001…`, customer, model, qty, due date, value = qty × price.

Example values: price VC10-100 = $890, VC20-300 = $1 450, VC30-500 = $2 150.

Two kinds:

| Kind | How planned | Stock |
|---|---|---|
| Normal (make-to-stock + order) | Hourly MRP nets all normal orders of a model together | shared finished stock |
| Make-to-order (from the Order flow tab) | Own work order, priority 3, MRP does not touch it | units are **pegged** (reserved) to this order |

Random demand for training (config `demand`): 300 units/day, orders of 5–30 units, due in 24–72 h, model chosen
by the mix 30 / 50 / 20 % (all example values).

**Shipping rule** (`ERP._ship()`, every 30 s): orders are served by due date. An order is shipped only
**complete** while it is still on time; if it is already late, the units in stock are shipped as a partial
shipment (status PARTIAL). The AS/RS crane picks each unit; then revenue and COGS are booked.

### 4.7 MRP – the full calculation (ERP)

MRP runs at start, every `mrp_interval_h` = **1 h** (example), or when you press **Run MRP now**. It has two
levels: first finished goods (→ work orders), then purchased material (→ purchase orders).

#### 4.7.1 Level 1 – finished goods, per model

```
demand    = Σ (qty − shipped − being picked) of open normal sales orders of this model
FG free   = units of this model in the FG store − units being picked − units pegged to open make-to-order orders
            + units on the way into the FG store (AGV, crane)
WO open   = Σ (qty − done) of open work orders of this model without a sales order
net       = demand + safety stock − FG free − WO open
if net > 0:  new work order qty = round up (net / wo_lot) × wo_lot
             due = earliest due date of the open sales orders of this model (else now + 24 h)
```

**Worked example – MRP at start of the twin (example values from `config/factory.json`):**

Initial sales orders: SO-0001 Alpha Tools 40 × VC20 (due 20 h), SO-0002 Beta Air Systems 25 × VC10 (30 h),
SO-0003 Gamma Workshop 16 × VC30 (40 h), SO-0004 Delta Motors 40 × VC20 (48 h). Finished stock 0, no work orders.

| Model | Demand | + Safety | − FG free | − WO open | = Net | WO lot | New work order |
|---|---|---|---|---|---|---|---|
| VC10 | 25 | 6 | 0 | 0 | **31** | 20 | ⌈31/20⌉ × 20 = **40** → WO-0001, due 30 h |
| VC20 | 40 + 40 = 80 | 10 | 0 | 0 | **90** | 20 | ⌈90/20⌉ × 20 = **100** → WO-0002, due 20 h |
| VC30 | 16 | 4 | 0 | 0 | **20** | 10 | ⌈20/10⌉ × 10 = **20** → WO-0003, due 40 h |

**Worked example – a later run (twin at hour 3, example):** VC20 demand 104, safety 10, FG free 33, WO open 67
→ net = 104 + 10 − 33 − 67 = **14** → ⌈14/20⌉ × 20 = **20** → new WO-0004 with 20 units.

**Why the lot size:** a work order of 3 units causes the same changeovers and paperwork as one of 20.
The lot size (`wo_lot`) is a compromise between changeover loss and stock.

#### 4.7.2 Level 2 – purchased material, per item

For each item of the item master (castings, forgings, tanks, motors):

```
units to start    = units still to start in open work orders (for this model, or all models for shared items)
planned rate (/h) = min( ideal factory rate × mix share ,
                         max( forecast rate , units finished in the last hour × mix share ) )
     forecast rate = demand units/day × mix share / 24      (if random demand is on)
                   = units to start / 24                     (if random demand is off)
units             = max( units to start , planned rate × lead time (h) )
                    + units in WIP of this model             (only for parts used late: tank and motor at final assembly)
gross requirement = BOM qty per unit × units
on hand           = stock in the store + stock being put away
on order          = Σ qty of open purchase orders of this item
net requirement   = gross + safety stock − on hand − on order
if net > 0:  purchase order qty = max( round up (net / lot) × lot , lot )
             arrival = now + lead time
```

**Why "max(units to start, rate × lead time)":** a new delivery can only arrive after the lead time. Until then,
the factory uses material for the open work orders – and, if more orders come in, for the planned production
during the lead time. The larger number is the real risk.

**Why "+ units in WIP" for tank and motor:** castings leave the store when a unit starts, but tank and motor are
used at final assembly, near the end. Units already on the line still need them.

**Ideal factory rate** (computed from the config, example): the slowest station group is FINAL-01. Its
mix-weighted average cycle is 0.3 × 180 s + 0.5 × 210 s + 0.2 × 250 s = 209 s → 3 600 / 209 = **17.22 units/h**
(all models together).

**Worked example A – CC20-CAST at start (no purchase):**

Config (example): BOM 1 per VC20, lead time 16 h, lot **120**, safety stock **100**, start stock 360.

| Term | Calculation | Value |
|---|---|---|
| Units to start (VC20) | WO-0002 | 100 |
| Forecast rate | 300 units/day × 0.5 / 24 | 6.25 /h |
| Rate cap | 17.22 × 0.5 | 8.61 /h |
| Planned rate | min(8.61, max(6.25, 0)) | 6.25 /h |
| Rate × lead time | 6.25 × 16 h | 100 |
| Units | max(100, 100) (casting → no WIP term) | 100 |
| Gross | 1 × 100 | 100 |
| On hand / on order | 360 / 0 | |
| Net | 100 + 100 − 360 − 0 | **−160** → no purchase order |

**Worked example B – CYL-CAST at hour 3 (purchase):**

Config (example): BOM **2** per unit (all models), lead time 16 h, lot 240, safety 300.

| Term | Calculation | Value |
|---|---|---|
| Units to start (all models) | 35 + 61 + 20 | 116 |
| Forecast rate | 300 / 24 | 12.5 /h |
| Units finished last hour | | 18 /h |
| Planned rate | min(17.22, max(12.5, 18)) | 17.22 /h |
| Rate × lead time | 17.22 × 16 | 275.6 |
| Units | max(116, 275.6) | 275.6 |
| Gross | 2 × 275.6 | **551** |
| On hand / on order | 780 / 0 | |
| Net | 551 + 300 − 780 − 0 | **71** |
| PO qty | ⌈71/240⌉ × 240 | **240** → PO-0002, arrives in 16 h |

**Worked example C – TANK-300 at hour 3 (late-use part):**

Config (example): BOM 1 per VC20, lead time 12 h, lot 60, safety 60.

| Term | Calculation | Value |
|---|---|---|
| Units to start (VC20) | | 61 |
| Planned rate | min(8.61, max(6.25, 18 × 0.5 = 9)) | 8.61 /h |
| Rate × lead time | 8.61 × 12 | 103.3 |
| + units of VC20 in WIP | | 26 |
| Units / gross | 103.3 + 26 | **129** |
| Net | 129 + 60 − 166 − 0 | **23** |
| PO qty | ⌈23/60⌉ × 60 | **60** → PO-0003 |

**Worked example D – CS-FORG at hour 6 (open PO already counted):**
gross 340, safety 150, on hand 360, on order 120 → net = 340 + 150 − 360 − 120 = **10** → PO = 120 (lot 120).

#### 4.7.3 Known mismatch in the Communication teaching view

The Communication tab, step-by-step simulation, **step 3** ("MRP calculates what to make and what to buy")
shows for CC20-CAST:

```
net = need + safety − on hand − on order = 23 + 20 − 15 − 0 = 28 → lot size 60
```

The config (`config/factory.json`) has for CC20-CAST **lot = 120, safety stock = 100**.
**The config values are the ones the engine uses.** The teaching view is a simplified story with its own
numbers. With the config values and the same story numbers it would be:

```
net = 23 + 100 − 15 − 0 = 108  →  ⌈108/120⌉ × 120 = 120 castings
```

Note also: in the Order flow tab, the button *Buy missing material* (`ERP.buy_for_so()`) uses
`need − (stock + put-away + line stock − stock needed by other orders) − on order`, rounded up to the lot,
**without** safety stock. Only the hourly MRP adds the safety stock.

### 4.8 Purchase orders and goods receipt (ERP)

* `PO-0001…`: item, supplier, qty, cost = qty × unit cost, due = order time + lead time.
* When the due time is reached, `_receive()` books the goods receipt: a **lot number** is created
  (e.g. `CYL-L0002` from PO-0002), the material goes to the AS/RS (crane put-away jobs) or floor store,
  and the value is added to "Purchases". The twin sends an EDI DESADV style message with a GS1-128 barcode scan.
* *Deliver now* (Order flow) is a training shortcut only.
* The twin has no supplier delays and no partial deliveries.

Example item data (from config, all example values):

| Item | BOM per unit | Unit cost | Supplier | Lead time | Lot | Safety | Start stock |
|---|---|---|---|---|---|---|---|
| CC10-CAST | 1 (VC10) | $72 | Foundry A | 16 h | 120 | 60 | 240 |
| CC20-CAST | 1 (VC20) | $95 | Foundry A | 16 h | 120 | 100 | 360 |
| CC30-CAST | 1 (VC30) | $138 | Foundry A | 16 h | 60 | 40 | 120 |
| CYL-CAST | 2 (all) | $28 | Foundry A | 16 h | 240 | 300 | 900 |
| CS-FORG | 1 (all) | $60 | Forge B | 20 h | 120 | 150 | 480 |
| TANK-100 / 300 / 500 | 1 (per model) | $95 / $180 / $285 | Tank Works C | 12 h | 60 / 60 / 30 | 30 / 60 / 20 | 120 / 200 / 60 |
| MOT-2.2KW / 4KW / 5.5KW | 1 (per model) | $150 / $210 / $280 | Motor D | 12 h | 60 / 60 / 30 | 30 / 60 / 20 | 120 / 200 / 60 |

(Supplier names are placeholders. Lead times of hours are shortened for the simulation; real foundry lead
times are usually weeks.)

### 4.9 Inventory and coverage hours (ERP)

```
coverage (h) = on hand / (ideal factory rate × BOM qty × mix share of the model)
status       = SHORT if on hand = 0,  LOW if on hand < safety stock,  else OK
value        = on hand × unit cost       (finished goods: × standard cost)
```

Examples at start (ideal rate 17.22 /h):

| Item | Calculation | Coverage |
|---|---|---|
| CC20-CAST | 360 / (17.22 × 1 × 0.5) | **41.8 h** |
| CYL-CAST | 900 / (17.22 × 2 × 1.0) | **26.1 h** |
| TANK-500 | 60 / (17.22 × 1 × 0.2) | **17.4 h** |

**Why coverage in hours:** "360 pieces" says nothing; "41.8 h" tells the planner at once whether the stock
lasts longer than the lead time (16 h). Coverage < lead time = danger. Note that the twin uses the **ideal**
(maximum) rate, so the real coverage is a little longer.

### 4.10 BOM and standard cost (ERP)

The BOM is **derived from the factory flow** (`Factory._capacity()`): the assembly station takes 1 crankcase +
2 cylinders + 1 crankshaft, final assembly takes 1 tank + 1 motor of the model. So the twin knows that one unit
needs 2 cylinder castings.

```
material   = Σ (BOM qty × unit cost) + other purchased parts (valves, heads, belt, packing)
conversion = Σ over station groups (time per unit (s) / 3600 × rate per hour of the station type)
             time per unit = model cycle time + handling time (e.g. pallet change 15 s)
energy     = kWh per unit (actual, or 10 kWh before the first unit) × energy price × (model time / average time)
standard cost = material + conversion + energy
margin %   = (price − standard cost) / price
```

**Worked example VC20-300 at start (example values):**

| Line | Calculation | Cost |
|---|---|---|
| CC20-CAST | 1 × $95 | $95 |
| CYL-CAST | 2 × $28 | $56 |
| CS-FORG | 1 × $60 | $60 |
| TANK-300 | 1 × $180 | $180 |
| MOT-4KW | 1 × $210 | $210 |
| Other parts | | $140 |
| **Material** | | **$741.00** |
| Conversion (e.g. HMC 6.0 min × $40/h = $4.00; test 6.0 min × $25/h = $2.50; …13 groups) | | **$22.59** |
| Energy | 10 kWh × $0.12 × time ratio | **$1.21** |
| **Standard cost** | | **$764.80** |
| Margin at $1 450 | (1 450 − 764.80) / 1 450 | **47.3 %** |

Other models (start of run, example): VC10 $547.82 (margin 38.4 %), VC30 $1 043.02 (margin 51.5 %).

Rates per hour (example): cnc $40, washer $20, load $28, assembly $30, robot $25, test $25, paint $35,
packaging $18; energy $0.12/kWh.

Note: for parallel machines (3 HMCs, 2 test benches) only **one** machine's time counts per unit – one unit
uses one machine.

### 4.11 Revenue, profit, on-time delivery (ERP)

Booked at the moment each unit is shipped (`ERP._shipped()`):

```
revenue        += price of the model
COGS           += standard cost of the model
gross profit    = revenue − COGS
on-time delivery (OTD) = orders shipped complete by the due date / all orders shipped complete
backlog units   = Σ (qty − shipped) of open orders
late orders     = open orders with due date in the past
inventory value = Σ item stock value + FG stock × standard cost + WIP units × material cost (default model)
```

Example from a 30-hour twin run: revenue $600 630, COGS $320 310, gross profit $280 320, 429 units shipped,
OTD 100 %, backlog 117 units, 7 open orders.

**Why OTD per order, not per unit:** a customer who gets 39 of 40 units on time still cannot finish his job.
That is also why the twin ships complete orders while on time.

---

## 5. Implementing in the real factory – step by step

### 5.1 Decide the split: what is ERP, what is MES

| Function | ERP (L4) | MES (L3) | Why |
|---|---|---|---|
| Customer orders, prices, invoices | ✔ | | money and contracts |
| Item master, BOM, routing (master copy) | ✔ | copy | one source of truth |
| MRP, purchasing, supplier lead times | ✔ | | needs stock + demand + suppliers |
| Work order creation | ✔ | (also manual) | from MRP |
| Release, sequence, dispatching rule | | ✔ | needs live machine and material state |
| Serial numbers, genealogy, test results | | ✔ | needs PLC data in seconds |
| SPC, NCR | | ✔ | close to the process |
| Maintenance orders | either (CMMS) | ✔ (trigger) | alarms come from the shop floor |
| Finished-goods stock booking | ✔ | reports | MES confirms, ERP books |

Write this table for your project and get it signed by production, IT and finance **before** you buy anything.

### 5.2 Requirements list (use it for supplier inquiries)

**MES must:**

1. Receive work orders from the ERP (B2MML or agreed ISA-95 based REST/JSON), and send confirmations back
   (good qty, scrap qty per order, per serial if wanted).
2. Statuses PLANNED / RELEASED / IN_PROGRESS / ON_HOLD / COMPLETED / CLOSED (or equivalent), release and hold
   by authorised users, with audit trail (who, when).
3. Dispatching per model with at least EDD and a "same model first" (setup) rule; priority override.
4. Order release interlock: the load station PLC may start a unit only with a valid released order (as the twin's gate).
5. Serial number generation and printing / laser-marking interface; scan at every station (or PLC report).
6. Genealogy: component lots per serial (crankcase, 2 cylinders, crankshaft, tank, motor, plus critical bought
   parts like valves), route with times, test data; forward and backward search ("which units contain lot X",
   "which lots are in unit Y"). Retention time as required by your product liability and customers.
7. Test bench interface: store raw curve or at least FAD, pressure, temperature per serial; pass/fail limits per model managed in MES (recipe), not hard-coded in the PLC.
8. SPC: I-MR chart (or X̄-R if you test in subgroups), Cpk, alarms when rules are broken.
9. NCR with reason codes, disposition (scrap / rework / use as is), link to lot and serial.
10. Rework loop (the twin has none – a real factory needs one for test-bench rejects).
11. Maintenance: orders from alarms, condition monitoring and counters; MTBF/MTTR reports (or interface to a CMMS).
12. OEE per machine, shift reports.
13. Interfaces to PLC/SCADA (OPC UA preferred), label printers, scanners.
14. Works on the plant network without internet; defined backup and restore; user roles.

**ERP (manufacturing part) must:**

1. Item master with units, item types (make / buy), cost, lead time, lot size, safety stock, supplier.
2. Multi-level BOM per model and routing with work centres and times.
3. MRP with safety stock, lot sizing (fixed lot / multiple of lot), lead-time offset, pegging for make-to-order.
4. Purchasing with supplier EDI or portal; goods receipt with lot / batch numbers and barcode scanning.
5. Warehouse locations incl. AS/RS interface (or a WMS between ERP and AS/RS).
6. Standard costing per model, actual vs. standard variance.
7. Sales orders, delivery, invoice; OTD report.
8. Open API (REST) or B2MML to the MES.

### 5.3 Master data to prepare (most work – start early)

| Master data | Content | Example from the twin | Who prepares |
|---|---|---|---|
| Items | number, name, unit, make/buy, cost, supplier, lead time, lot, safety stock | `CC20-CAST`, $95, Foundry A, 16 h, lot 120, safety 100 | purchasing + engineering |
| Finished products | SKU, price, WO lot size, FG safety stock | `VC20-300`, $1 450, lot 20, safety 10 | sales + planning |
| BOM per model | items and qty per unit | VC20: 1 CC20-CAST, 2 CYL-CAST, 1 CS-FORG, 1 TANK-300, 1 MOT-4KW + other parts | engineering |
| Work centres | machines / stations, capacity, cost rate | HMC group (3 machines), $40/h | production + finance |
| Routings | operation sequence per part and model | crankcase: LOAD → HMC → WASH → ASSY → ROBOT → TEST → PAINT → FINAL → PACK | manufacturing engineering |
| Cycle times | per operation and model, plus handling / changeover | HMC VC10 270 s, VC30 450 s; pallet change 15 s | manufacturing engineering (measure, do not guess) |
| Test specs | nominal, tolerance, test pressure per model | 20 m³/h, −3 %, 8 bar | quality |
| Reliability plan | MTBF, MTTR per machine | HMC 30 h / 20 min | maintenance (from supplier data, then actuals) |
| Customers, suppliers | addresses, EDI IDs | placeholders | sales, purchasing |

**Rules for master data:**

1. One owner per field. Example: lead time = purchasing, cycle time = manufacturing engineering.
2. Use the same item numbers in ERP, MES, PLC recipes and labels.
3. Measure cycle times (at least 30 cycles, take the median) before go-live, and again after 3 months.
4. Check every BOM by building one unit with the BOM printout in hand.

### 5.4 Traceability, label and serial number scheme

Recommended steps:

1. **Define what is traced:** serial level = the compressor (marked on the crankcase, like the twin). Lot level =
   castings, forgings, tanks, motors, valves. Decide if tanks and motors are traced by **their own serial**
   (pressure vessel and motor nameplates usually have one – record it, it is better than a lot).
2. **Serial format:** the twin uses `<model>-<6 digits>` = `VC20-000012`. The project scheme for the real
   factory is `<model>-<YYWW>-<5-digit seq>` = `VC20-2646-00123` (chapter 12, doc 15). Rules: never reused,
   no meaning hidden in digits that may change, enough digits for the volume. Add a plant code if you will
   have more than one plant.
3. **Mark:** laser or dot-peen DataMatrix + plain text on the crankcase at the load station, before machining
   (so even scrapped parts are traceable). Verify readability after washing and painting.
4. **Lot labels at goods receipt:** GS1-128 barcode with Application Identifiers. On a pallet (logistic
   unit): (00) SSCC + (02) GTIN of the contained items + (37) count + (10) lot. On a single item or a
   fixed-content case: (01) GTIN + (10) lot. Ask suppliers to print it; otherwise print it at receipt.
   (Correction: the Communication tab shows (02) + (10) + (37) without (00). GS1 rules use (02) and (37)
   only on a logistic unit together with the SSCC – see 12.7.)
5. **Capture points:** load station (serial ↔ work order ↔ casting lot), pump assembly (cylinder + crankshaft lots),
   test bench (results), final assembly (tank + motor), packing (final check), shipping (serial ↔ customer order).
6. **FIFO by lot** in the stores, or the genealogy is wrong. Forbid mixing lots in one bin.
7. **Test the recall:** pick one lot, ask the MES "which serials contain it, where are they now, which customer".
   Target time: a few minutes.

### 5.5 Go-live steps

1. **Write the process** (as-is and to-be) and the ERP/MES split (5.1).
2. **Choose systems** with the requirements list (5.2). Make every supplier demonstrate *your* scenario: one
   order of 23 × VC20 from sales order to shipment, with one scrapped unit and one lot recall.
3. **Prepare master data** (5.3) in a spreadsheet first; review; then load.
4. **Build interfaces:** ERP ↔ MES (B2MML/REST), MES ↔ PLC/SCADA (OPC UA), MES ↔ printers/scanners, ERP ↔ AS/RS/WMS.
   Use the twin's API (`/api/erp`, `/api/mes`, `/api/ingest`) as a test partner where helpful.
5. **Test in stages** (see 5.6).
6. **Train users** with the twin: planners (MRP, release), operators (scan, hold), quality (SPC, NCR),
   maintenance (orders).
7. **Opening stock:** count every item and lot physically; load it on the cut-over day.
8. **Cut-over:** start with one model (e.g. VC20) and one line, run in parallel with paper for 1–2 weeks,
   then add models.
9. **Hypercare:** daily meeting for the first 4 weeks: open issues, data errors, KPI review.
10. **Review after 3 months:** update cycle times, MTBF/MTTR, safety stocks and lot sizes with actuals.

### 5.6 Testing

| Test | What | Pass criterion (example) |
|---|---|---|
| Unit test of MRP | Recalculate 3 items by hand (like 4.7.2) | same result as the ERP |
| Interface test ERP → MES | Send 10 work orders incl. hold, change, close | all arrive, statuses agree in both systems |
| Interface test MES → ERP | Confirm 20 units, 1 scrap | ERP stock + 19 FG, scrap booked |
| Release interlock | Hold all orders | load station stops starting units |
| Genealogy | Build 5 units, compare MES record with physical parts | 100 % match |
| Recall drill | Search one cylinder lot | all affected serials and customers listed |
| SPC | Enter 25 known test values | x̄, σ, Cpk equal a spreadsheet calculation |
| Network loss | Unplug MES for 15 min | lines can continue or stop safely; data is buffered and sent later |
| Volume test | One shift of real volume (e.g. 17 units/h, example) | no delay at the scanners and screens |

### 5.7 KPIs to watch from day one

| KPI | Formula | Example target (set your own) |
|---|---|---|
| On-time delivery | orders shipped complete by due date / orders shipped | ≥ 95 % |
| First-pass yield | passed / tested at the test bench | ≥ 98 % |
| Cpk of air flow | (x̄ − LSL) / 3σ | ≥ 1.33 |
| Inventory coverage | on hand / consumption per hour | > lead time + safety |
| Schedule adherence | WOs completed by due / WOs due | ≥ 90 % |
| MTBF, MTTR per machine | see 4.5 | MTBF rising, MTTR falling |
| Inventory accuracy | correct counts / counted locations | ≥ 98 % |
| Standard vs. actual cost | (actual − standard) / standard | within ± 5 % |
| Gross margin per model | (price − cost) / price | per business plan |

---

## 6. Checklists

### 6.1 Before choosing systems
- [ ] ERP/MES split table written and signed (5.1)
- [ ] Requirements list complete (5.2), including offline operation and user roles
- [ ] Demo scenario defined (order → production → scrap → recall → shipment)
- [ ] Interface standard agreed (B2MML or ISA-95 based REST), OPC UA for the shop floor
- [ ] Data ownership and backup responsibility defined

### 6.2 Master data
- [ ] Item numbers identical in ERP, MES, PLC recipes and labels
- [ ] Every item has cost, supplier, lead time, lot size, safety stock
- [ ] BOM per model checked by building one unit
- [ ] Routings and cycle times measured (not guessed), per model
- [ ] Test limits per model approved by quality
- [ ] Work-centre cost rates approved by finance

### 6.3 Traceability
- [ ] Serial format fixed, never reused, enough digits
- [ ] Marking readable after washing and painting
- [ ] Supplier lot labels (GS1-128) agreed
- [ ] Capture points defined and scanners/PLC reports installed
- [ ] FIFO by lot enforced in stores and supermarkets
- [ ] Recall drill passed

### 6.4 MRP parameters
- [ ] Safety stock covers lead-time variation and demand variation (not "a round number")
- [ ] Lot sizes agreed with suppliers (packaging, truck load)
- [ ] Coverage hours > lead time for every item at go-live
- [ ] MRP run interval and "firm" period defined (what MRP may not change)
- [ ] Make-to-order vs. make-to-stock rule per customer/model defined

### 6.5 Go-live
- [ ] Opening stock counted per lot
- [ ] Users trained (with the twin)
- [ ] Parallel run period and fallback (paper) defined
- [ ] KPIs reported daily from day one
- [ ] Hypercare team named

---

## 7. Common mistakes

| Mistake | Effect | Better |
|---|---|---|
| Copy the example values of the twin into the real ERP | wrong purchases, wrong cost | use supplier quotes and measured times |
| Safety stock = 0 "to save money" | line stops at the first late delivery | size it from lead-time and demand variation |
| Lot size ignored in planning | stock jumps; MRP seems "wrong" (orders 120 when 10 are missing) | understand rounding up (4.7.2 example D) |
| Lead time of the twin (hours) used for real foundries (weeks) | material arrives far too late | real lead times, and plan with a horizon longer than the lead time |
| Release all work orders at once | WIP explodes, the wrong models block machines | release by the dispatching rule and capacity (MES gate) |
| Serial marked late (e.g. at final assembly) | scrap in machining is not traceable | mark at the first operation, like the twin's load station |
| Lots mixed in one bin | genealogy is wrong; recall too big | FIFO by lot, one lot per bin |
| SPC limits confused with spec limits | operators stop for nothing, or ship bad units | UCL/LCL = process, LSL = customer (4.3.4) |
| Cpk computed on an unstable process | number is meaningless | first get the chart in control, then compute Cpk |
| Cpk from a few points | random result | the twin needs ≥ 8; for a real decision use ≥ 25–30 values |
| MTBF on calendar time vs. running time mixed | wrong comparisons with suppliers | state the base; the twin uses running time |
| Two masters for BOM/routing (ERP and MES both edited) | data drifts apart | ERP master, MES copy via interface |
| Custom point-to-point interfaces without a written spec | nobody can maintain them | B2MML / ISA-95 object names, written interface spec |
| Trusting the teaching view numbers (lot 60, safety 20) | wrong lot and safety for CC20-CAST | config values (lot 120, safety 100) are used by the engine |

---

## 8. Limits of the twin

* **ERP covers manufacturing only:** no accounting, HR, payroll, quotations, real invoices, credit checks,
  taxes, currency changes.
* **Data is in memory** and is lost with **Reset**; only finished/scrapped units are stored in `data/history.db`.
  The MES keeps the last 1 000 units in memory, 400 test results, 200 NCRs.
* **No login, no roles, no audit trail in MES/ERP** (SCADA has an operator name). Do not run it on an open network.
* **MRP is simplified:** single level for purchased items (no sub-assemblies with own lead times), no time
  buckets / planning horizon, no firm planned orders, no capacity check (CRP), forecast is a constant rate.
* **Supplier side is ideal:** always on time, always the full quantity, no quality problems at receipt.
* **Lead times are hours** to make the simulation visible; real lead times are days or weeks.
* **Test rejects are scrapped**, no rework loop, no disposition workflow in NCRs.
* **SPC:** control limits are recalculated from all stored data every time (no frozen "phase I" limits), only one
  SPC characteristic (FAD), only the lower spec limit, no Western Electric / Nelson rules except "beyond 3σ".
* **Standard cost** uses the cycle time of one machine per group and default rates; overhead, scrap cost, labour
  as a limited resource and depreciation are not included. WIP is valued at material cost of the default model.
* **Maintenance:** no spare parts, no technician capacity, no maintenance calendar.
* **Order-flow material check and hourly MRP use slightly different formulas** (the order check has no safety stock).
* **Communication teaching view** uses its own story numbers (e.g. CC20-CAST lot 60, safety 20); the engine uses the config.
* Supplier and customer names, prices and costs are placeholders, not market data.

---

## 9. How to use chapters 10 – 15

Chapters 1 – 8 explain the twin. Chapters 10 – 15 are for building the **real** MES and ERP.

| Chapter | Content | Main reader |
|---|---|---|
| 10 Principles | The theory behind MRP, lot sizes, safety stock, WIP, SPC and traceability, with numbers | planner, quality engineer |
| 11 Detailed specification | Exact record layouts (fields, types, lengths), B2MML field lists, requirement tables for suppliers, server sizing | IT, buyer, MES/ERP supplier |
| 12 Identification and numbering | All numbers of the project (serial, lot, work order …) and the GS1 labels, with the check digit | engineering, quality, logistics |
| 13 Standards | Which standard says what, what it requires from us, how to check it | quality, buyer |
| 14 Complete worked example | One customer order from EDI to payment, every record and every message with field values | everybody (training) |
| 15 Data you still need | What is still missing, why, and who must deliver it | project manager |

Large general tables (unit conversions, material data, statistical tables) are collected in
`docs/14_engineering_reference_data.md`. The project numbering rules are owned by
`docs/15_numbering_and_identification.md`; chapter 12 here only applies them to MES and ERP.
**If chapter 12 and doc 15 ever disagree, doc 15 wins.**
The full list of standards of the project (with editions and where to buy them) is
`docs/16_standards_register.md`; chapter 13 here lists only what matters for MES and ERP.

All parameter values in chapters 10 – 15 (costs, lead times, z-values, server sizes, field lengths) are
**examples or proposals**. They are marked so. Replace them with your own data.

---

## 10. Principles

### 10.1 Independent and dependent demand – the idea of MRP

* **Independent demand** comes from outside: customers order compressors. You can only forecast it.
* **Dependent demand** is calculated: if you build 100 × VC20, you **need** 100 crankcase castings
  and 200 cylinder castings. You do not forecast them; you compute them from the BOM.

MRP (Material Requirements Planning) is the calculation of dependent demand. It has 4 steps, done for
every item and every time bucket (day or week):

| Step | Name | Formula |
|---|---|---|
| 1 | BOM explosion | gross requirement (child) = planned production (parent) × qty per parent |
| 2 | Netting | net requirement = gross + safety stock − (projected stock + scheduled receipts) |
| 3 | Lot sizing | planned receipt = net requirement rounded by the lot rule (10.2) |
| 4 | Lead-time offset | planned order release = planned receipt week − lead time |

The levels are done **from top to bottom** (finished product → sub-assembly → part → raw material),
because each lower level needs the planned orders of the level above. ERP systems give every item a
**low-level code** (its deepest level in any BOM) so that each item is netted only once.

**Twin vs. real MRP:** the twin nets **one** level for purchased items, without time buckets
(chapter 8). A real ERP uses time buckets. The following example shows a time-phased MRP record.

#### Worked example – time-phased MRP record (example values)

Item CC20-CAST. Real foundry lead time **2 weeks**. Safety stock 300. On hand at start 1 800.
One open purchase order (scheduled receipt) of 480 arrives in week 1. Weekly VC20 production plan from
the master schedule: 750, 750, 700, 800, 750, 750 (BOM: 1 casting per VC20).

**Rule A – lot-for-lot (L4L): order exactly the net requirement.**

| Week | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Gross requirement | 750 | 750 | 700 | 800 | 750 | 750 |
| Scheduled receipt | 480 | | | | | |
| Projected stock before order | 1 800 + 480 − 750 = 1 530 | 780 | 80 | 300 − 800 = −500 | −450 | −450 |
| Net requirement (to reach 300) | 0 | 0 | 220 | 800 | 750 | 750 |
| Planned receipt | | | 220 | 800 | 750 | 750 |
| Projected stock after order | 1 530 | 780 | 300 | 300 | 300 | 300 |
| **Planned order release** (week − 2) | **220** | **800** | **750** | **750** | | |

**Rule B – fixed lot 480 (for example 4 truck loads of 120): order a multiple of 480.**

| Week | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| Stock before order | 1 530 | 780 | 80 | 560 − 800 = −240 | 720 − 750 = −30 | 450 − 750 = −300 |
| Missing to reach 300 | 0 | 0 | 220 | 540 | 330 | 600 |
| Planned receipt = ⌈missing / 480⌉ × 480 | | | 480 | 960 | 480 | 960 |
| Stock after order | 1 530 | 780 | 560 | 720 | 450 | 660 |
| **Planned order release** (week − 2) | **480** | **960** | **480** | **960** | | |

Average end stock weeks 3 – 6: L4L = 300, fixed lot = (560 + 720 + 450 + 660) / 4 = **598**.
The fixed lot needs about 300 castings more stock on average, but it fits the supplier's truck and
packaging. **There is no "right" rule; there is a cost trade-off (10.2).**

### 10.2 Lot sizing: lot-for-lot, fixed lot, EOQ

| Rule | Order quantity | Good for | Weak point |
|---|---|---|---|
| Lot-for-lot (L4L) | exactly the net requirement | expensive items (motors, tanks), make-to-order | many small orders |
| Fixed lot / multiple of lot (the twin) | ⌈net / lot⌉ × lot | supplier packaging, pallet, truck load, furnace batch | extra stock |
| EOQ (Economic Order Quantity) | √(2·D·S / H) | stable demand, real ordering cost | assumes constant demand |
| Minimum order quantity | max(net, MOQ) | supplier conditions | extra stock |

**EOQ derivation (simple).** Per year you order D/Q times, each order costs S. The average stock is Q/2
and each piece in stock costs H per year.

```
total cost per year  C(Q) = (D / Q) · S  +  (Q / 2) · H
the minimum is where both terms are equal (derivative = 0):
                     D·S / Q = Q·H / 2   →   Q* = √(2·D·S / H)
```

**Worked example – CC20-CAST (example values):**

| Symbol | Meaning | Value |
|---|---|---|
| D | demand per year | 150 VC20 per day × 250 working days = 37 500 castings |
| S | cost per order (purchasing, receiving, incoming inspection, booking) | $80 |
| i | holding cost rate (capital, space, handling, risk) | 25 % per year |
| C | unit cost | $95 |
| H = i·C | holding cost per piece and year | 0.25 × 95 = $23.75 |

```
Q* = √(2 × 37 500 × 80 / 23.75) = √252 632 = 503 castings
orders per year = 37 500 / 503 = 75  →  one order every 250 / 75 = 3.3 working days
C(503)  = 37 500/503 × 80 + 503/2 × 23.75 = 5 964 + 5 973 = $11 937 per year
C(120)  = 25 000 + 1 425 = $26 425   (the twin's lot 120 – too small for these costs)
C(400)  = 7 500 + 4 750 = $12 250    (+2.6 %)
C(600)  = 5 000 + 7 125 = $12 125    (+1.6 %)
```

**Lesson:** the cost curve is flat near Q*. ±20 % around Q* costs only ~2 % more. So round Q* to a
practical number (full pallets, truck loads) – here for example 480 = 4 × 120.

### 10.3 Safety stock and reorder point

Safety stock protects against **variation**: demand higher than planned, or delivery later than planned.

```
demand variation only:            SS = z · σ_d · √LT
demand and lead-time variation:   SS = z · √( LT · σ_d²  +  d² · σ_LT² )
reorder point:                    ROP = d · LT + SS
```

| Symbol | Meaning | Unit |
|---|---|---|
| z | service factor from the normal distribution (table below) | – |
| d | average demand per period | pieces/day |
| σ_d | standard deviation of demand per period | pieces/day |
| LT | average lead time | days |
| σ_LT | standard deviation of the lead time | days |

| Cycle service level (probability of no stock-out in one replenishment cycle) | z |
|---|---|
| 90 % | 1.28 |
| 95 % | 1.645 |
| 98 % | 2.05 |
| 99 % | 2.33 |
| 99.9 % | 3.09 |

**Worked example – CC20-CAST (example values):** d = 150/day, σ_d = 30/day, LT = 15 working days
(3 weeks), z = 1.645 (95 %).

```
demand variation only:   SS = 1.645 × 30 × √15 = 1.645 × 30 × 3.873 = 191 castings
ROP = 150 × 15 + 191 = 2 441 castings  → order when stock + open orders fall below 2 441

with lead-time variation σ_LT = 3 days:
SS = 1.645 × √(15 × 30²  +  150² × 3²) = 1.645 × √(13 500 + 202 500) = 1.645 × 464.8 = 765 castings
```

**Lesson:** a supplier who is sometimes 3 days late costs you 4 × more safety stock than all your
demand variation. **Measure supplier delivery reliability** (σ_LT) – it is often the biggest lever.

Notes:
* The twin uses **fixed** safety stocks from the config, not this formula.
* Measure σ_d from at least 3 – 6 months of real consumption per item; until then use a sensible
  estimate and review monthly (chapter 15).
* The formula assumes normal, independent demand. For items with very lumpy demand (big single
  orders) use a simulation or a planner's judgement.

### 10.4 Inventory turns and days of supply

```
inventory turns per year = cost of goods sold per year / average inventory value
days of supply           = 365 / turns       (or working days / turns)
```

Example (example values): COGS $40 M per year, average inventory (raw + WIP + finished) $2.5 M
→ turns = 40 / 2.5 = **16** → days of supply = 365 / 16 = **23 days**.

Use turns per item group (castings, motors, finished goods) – one plant number hides problems.

### 10.5 Little's law for WIP and lead time

For any stable system (a machine, a line, the whole factory):

```
WIP = throughput × flow time          L = λ · W
```

Example (example values): the line finishes λ = 15 units/h. You count WIP = 60 units between load
station and FG store → flow time W = 60 / 15 = **4 h**. The real work content of a VC20 is 2 295 s
= 0.64 h (sum of one machine per station, 4.1.2 note) → **flow factor** = 4 / 0.64 = 6.3: the unit waits
5/6 of its time.

**Consequence:** at the same throughput, **less WIP = shorter lead time**. This is why the MES gate
(4.1.2) releases work only when the line can take it, instead of releasing all orders at once.

**Why queues explode near 100 % load** (Kingman approximation, for one station):

```
waiting time ≈ ((ca² + cs²) / 2) · (ρ / (1 − ρ)) · te
ρ = utilisation, te = mean process time, ca, cs = coefficient of variation of arrivals and process
```

ρ / (1 − ρ) is 4 at 80 %, 9 at 90 %, 19 at 95 %. Planning a bottleneck at 95 % load doubles the
waiting compared with 90 %. Plan the bottleneck at **≤ 85 – 90 %** (example rule).

### 10.6 Dispatching theory – why EDD and SPT

Two proven results for one machine (classical scheduling theory):

* **SPT** (shortest processing time first) gives the **smallest average flow time**.
* **EDD** (earliest due date first) gives the **smallest maximum lateness**.

For a real line with several stations these rules are good heuristics, not optimal. That is why the MES
should offer several rules and the planner chooses (the twin: FIFO, EDD, SPT, SETUP).

### 10.7 SPC statistics

#### 10.7.1 The normal distribution

Many process results (air flow, diameters) scatter around a mean μ with standard deviation σ in the
bell-shaped **normal distribution**.

| Range | Share of values inside | Share outside |
|---|---|---|
| μ ± 1σ | 68.27 % | 31.73 % |
| μ ± 2σ | 95.45 % | 4.55 % |
| μ ± 3σ | 99.73 % | 0.27 % (2 700 ppm, half on each side) |

**Why control limits at ±3σ:** a stable process gives a point outside ±3σ only 0.27 % of the time =
about once in **370 points** (average run length ARL₀ = 1 / 0.0027 = 370). So a point outside is
"probably a real change", and false alarms are rare.

#### 10.7.2 I-MR chart constants

For an individuals chart (one value per unit) the moving range of 2 neighbours estimates σ:

| Constant | Value (n = 2) | Use |
|---|---|---|
| d₂ | 1.128 | σ = MR̄ / d₂ |
| E₂ = 3 / d₂ | 2.660 | UCL/LCL of the I chart = x̄ ± 2.660 · MR̄ |
| D₄ | 3.267 | UCL of the MR chart = 3.267 · MR̄ |
| D₃ | 0 | LCL of the MR chart = 0 |

Example with the twin numbers of 4.3.4: σ = 2.185 % → MR̄ = 2.185 × 1.128 = 2.465 % →
UCL(MR) = 3.267 × 2.465 = **8.05 %**. A jump of more than 8 % of nominal between two units is a signal.

Other constants (X̄-R, X̄-s for subgroups) are in `docs/14_engineering_reference_data.md`.

#### 10.7.3 Rules for "out of control" (Western Electric rules)

The twin uses only rule 1. A real MES should offer at least these 4:

| Rule | Signal |
|---|---|
| 1 | one point outside ±3σ |
| 2 | 2 of 3 points in a row beyond 2σ, same side |
| 3 | 4 of 5 points in a row beyond 1σ, same side |
| 4 | 8 points in a row on the same side of the centre line |

More rules give more false alarms. Start with rules 1 and 4.

#### 10.7.4 Cp, Cpk, Pp, Ppk

```
Cp  = (USL − LSL) / (6σ)                  needs two limits – potential, ignores where the mean is
Cpu = (USL − x̄) / (3σ)      Cpl = (x̄ − LSL) / (3σ)
Cpk = min(Cpu, Cpl)                       with only a lower limit: Cpk = Cpl  (our FAD test)
Pp, Ppk = same formulas, but σ = overall standard deviation s of all values (long term)
```

* **Cpk** uses the short-term σ (MR̄ / d₂) = what the process can do when stable. The twin computes Cpk.
* **Ppk** uses the overall s = what the customer really gets (includes shifts between shifts, lots, days).
  If Ppk is much lower than Cpk, the process is not stable over time.
* Our FAD test has only an LSL, so **Cp cannot be computed** (no USL). Report Cpk (= Cpl).

#### 10.7.5 From Cpk to defect rate (PPM)

For a stable, normal process with one limit: share below LSL = Φ(−3 · Cpk).

| Cpk | z = 3·Cpk | Units below LSL | ppm |
|---|---|---|---|
| 0.57 | 1.71 | 4.4 % | ~44 000 |
| 0.79 | 2.37 | 0.89 % | ~8 900 |
| 1.00 | 3.00 | 0.135 % | 1 350 |
| 1.33 | 3.99 | 0.0033 % | ~33 (exactly 4σ: 32) |
| 1.67 | 5.00 | – | ~0.3 |
| 2.00 | 6.00 | – | ~0.001 |

(For two-sided limits add the share above the USL.) The twin example Cpk 0.79 → ~0.9 % rejects; the
twin run showed 3 / 459 = 0.65 % – the same size.

#### 10.7.6 How many values do you need for Cpk?

Cpk from a sample is itself uncertain. A common approximation (Bissell) for the lower 95 % confidence
bound:

```
Cpk_low ≈ Cpk − 1.645 · √( 1/(9n) + Cpk² / (2(n − 1)) )
```

| Measured Cpk | n | Cpk_low (95 %) |
|---|---|---|
| 1.50 | 30 | 1.50 − 1.645 × √(0.0037 + 0.0388) = **1.16** |
| 1.50 | 125 | 1.50 − 1.645 × √(0.00089 + 0.00907) = **1.34** |

**Lesson:** with 30 values a measured 1.50 proves only "≥ 1.16". To prove 1.33 you need about 125
values at Cpk 1.50. For release decisions use **≥ 100 values** (example rule), and always a stable chart first.

### 10.8 Traceability theory

**Two directions:**

| Direction | Question | Used for | Query |
|---|---|---|---|
| **Backward** (trace back) | "This unit failed in the field – which lots, machines, operators, test data are in it?" | root cause | serial → genealogy → component lots → supplier, heat, receipt |
| **Forward** (trace forward) | "Lot CYL-… is bad – which units contain it, where are they?" | containment, recall | lot → all consumption events → serials → stock / customer |

**The data model is a graph.** Every transformation step writes one **consumption event**:
`(output ID, input ID(s), qty, station, time, work order)`. Backward search follows the arrows from the
output; forward search follows them from the input. Any MES that stores these events can answer both
questions; one that stores only "lot of the crankcase" cannot.

**Granularity and recall size:**

| Traced by | Size of a recall when one input is bad (example values) |
|---|---|
| Serial (each part has its own number) | exactly the units with that part |
| Lot, one lot per bin (FIFO) | cylinder lot of 240 pieces, 2 per unit → at most **120** compressors |
| Lot, 2 lots mixed in one bin | both lots → up to **240** compressors |
| Time window only (no scan) | rate × window: 15 units/h × 16 h = **240** units per production day of doubt |

**Mass balance (check of data quality):** per lot,
`received = consumed + scrapped + on hand (+ returned)`. If the balance does not close, the genealogy
has gaps. Run this check monthly per lot.

### 10.9 Reliability basics for maintenance

```
availability   A = MTBF / (MTBF + MTTR)
probability to run time t without failure (constant failure rate):  R(t) = e^(−t / MTBF)
```

Example HMC-01 (twin values): plan A = 30 / (30 + 0.333) = **98.9 %**; actual A = 11.1 / (11.1 + 0.528)
= **95.5 %**. Probability that an HMC runs a full 8 h shift without failure at plan MTBF:
e^(−8/30) = **77 %**. At actual MTBF: e^(−8/11.1) = **49 %**.

Maintenance terms and KPI definitions: EN 13306 and EN 15341 (chapter 13).

---

## 11. Detailed specification for implementation

This chapter is a **proposal** for the record layouts. Give it to the MES/ERP suppliers as a starting
point; they map it to their standard tables. Field lengths are examples that fit the numbering of
chapter 12.

### 11.1 Conventions

| Item | Rule |
|---|---|
| Types | `String(n)` = text up to n characters (UTF-8); `Int` = whole number; `Dec(p,s)` = decimal with p digits, s after the point; `Bool`; `DateTime` = ISO 8601 in **UTC**, e.g. `2026-11-09T09:14:37.120Z`; `Date` = `2026-11-11`; `Enum` = fixed value list |
| M / O | M = mandatory, O = optional, C = conditional (rule given) |
| Keys | **PK** = primary key (unique); **FK** = reference to another record |
| Units | units of measure as UN/ECE Recommendation 20 codes (e.g. `EA` each, `H87` piece – choose one and use it everywhere); quantities in base unit |
| Money | `Dec(12,2)` plus currency ISO 4217 code (`USD`) |
| Audit | every record has `created_at`, `created_by`, `changed_at`, `changed_by` (not repeated below) |
| Status changes | every status change is written to an audit log: record, old status, new status, user, time, reason |

### 11.2 Item master (ERP, master copy)

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| item_no **PK** | String(20) | M | `CC20-CAST` | item number (12.3) |
| description | String(60) | M | `Crankcase casting VC20 (GG25)` | |
| item_type | Enum | M | `BUY` | `BUY`, `MAKE`, `PHANTOM`, `FG` (finished good) |
| base_uom | String(3) | M | `EA` | |
| drawing_no | String(24) | C | `VC-…-…-0020-B` | mandatory for MAKE items and for castings made to our drawing (12.2) |
| drawing_rev | String(1) | C | `B` | revision letter |
| traceability | Enum | M | `LOT` | `NONE`, `LOT`, `SERIAL` |
| supplier_no (default) | String(10) | C | `SUP-0001` | mandatory for BUY |
| supplier_part_no | String(30) | O | `FA-77812` | supplier's own number |
| lead_time_d | Int | M | `15` | working days, purchasing owns it |
| lot_rule | Enum | M | `FIXED` | `L4L`, `FIXED`, `MULT`, `EOQ`, `MOQ` |
| lot_qty | Int | C | `120` | for FIXED / MULT / MOQ |
| safety_stock | Int | M | `100` | from 10.3 |
| reorder_point | Int | O | `2441` | only if the item is planned by ROP instead of MRP |
| std_cost | Dec(12,4) | M | `95.0000` | per base unit |
| currency | String(3) | M | `USD` | ISO 4217 |
| default_location | String(12) | M | `ASRS-RAW` | |
| gtin | String(14) | O | `09521234000204` (demo prefix 952 – never on real labels) | if the supplier labels with GS1 (12.7) |
| net_weight_kg | Dec(8,3) | O | `18.500` | for AGV / crane loads |
| inspection_rule | Enum | O | `SAMPLE` | `NONE`, `SAMPLE`, `100PCT`, `CERT` (certificate only) |
| status | Enum | M | `ACTIVE` | `ACTIVE`, `BLOCKED`, `PHASE_OUT` |

### 11.3 BOM line (ERP master, copied to MES)

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| parent_item **PK** | String(20) | M | `VC20-300` | |
| bom_rev **PK** | String(2) | M | `A` | |
| line_no **PK** | Int | M | `10` | steps of 10 |
| component_item **FK** | String(20) | M | `CC20-CAST` | |
| qty_per | Dec(10,4) | M | `1.0000` | per 1 parent in base unit |
| uom | String(3) | M | `EA` | |
| scrap_pct | Dec(5,2) | O | `0.80` | planned scrap, MRP adds it (example = HMC base scrap rate 0.8 %) |
| consumed_at_op | String(4) | M | `0010` | operation of the routing where it is used (needed for backflush and for the MRP "late-use" rule, 4.7.2) |
| backflush | Bool | M | `true` | book consumption automatically at the operation |
| trace_capture | Enum | M | `SCAN` | `SCAN` (lot/serial must be scanned), `AUTO` (MES takes lot from FIFO), `NONE` |
| valid_from / valid_to | Date | M / O | `2026-11-01` / – | engineering change effectivity |

**Example: real multi-level BOM of VC20-300** (the twin is single-level). MAKE part number = drawing
number without revision (doc 15, 3.5); `VC-PRD-CC-0020` is the doc 15 example, the cylinder and crankshaft
numbers are placeholders until engineering issues the drawings:

| Level | Line | Item | Qty | Type | Consumed at |
|---|---|---|---|---|---|
| 0 | – | VC20-300 compressor | 1 | FG | – |
| 1 | 10 | `VC-PRD-CC-0020` crankcase VC20, machined | 1 | MAKE | 0040 ASSY |
| 2 | 10 | CC20-CAST crankcase casting | 1 | BUY | 0010 LOAD-CC |
| 1 | 20 | `VC-PRD-<group>-nnnn` cylinder, machined | 2 | MAKE | 0040 ASSY |
| 2 | 10 | CYL-CAST cylinder casting | 1 | BUY | VMC-01 |
| 1 | 30 | `VC-PRD-<group>-nnnn` crankshaft, machined | 1 | MAKE | 0040 ASSY |
| 2 | 10 | CS-FORG crankshaft forging | 1 | BUY | LATHE-01 |
| 1 | 40 | TANK-300 air tank 300 L | 1 | BUY | 0080 FINAL |
| 1 | 50 | MOT-4KW motor 4 kW | 1 | BUY | 0080 FINAL |
| 1 | 60 | valves, heads, belt, packing (twin: "other parts" $140) | – | BUY | various |

### 11.4 Routing step (operation)

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| item **PK** | String(20) | M | `VC20-300` | |
| routing_rev **PK** | String(2) | M | `A` | |
| op_no **PK** | String(4) | M | `0020` | |
| work_centre | String(12) | M | `HMC` | group of equivalent machines |
| alt_machines | String(60) | O | `HMC-01,HMC-02,HMC-03` | |
| setup_s | Int | M | `600` | changeover time (twin: tool set load 600 s) |
| cycle_s | Dec(8,1) | M | `345.0` | per unit, **measured** (5.3 rule 3) |
| handling_s | Dec(8,1) | O | `15.0` | e.g. pallet change |
| nc_program | String(20) | C | `OHMC02_VC20.nc` | for CNC operations; MES sends it at changeover |
| recipe | String(16) | C | `VC20_v1` | for PLC stations |
| check_plan | String(16) | O | `CP-VC20-TEST` | link to quality characteristics |
| report_point | Bool | M | `true` | MES expects a start/finish event from this station |

**Example routing VC20-300, crankcase / unit path** (cycle times = twin config, example values):

| Op | Work centre | Machines | Cycle s |
|---|---|---|---|
| 0010 | LOAD (serial marking) | LOAD-CC | 90 |
| 0020 | HMC | HMC-01/02/03 | 345 + 15 pallet change |
| 0030 | WASH | WASH-01 | 150 |
| 0040 | ASSY (pump assembly: crankcase + 2 cylinders + crankshaft) | ASSY-01 | 200 |
| 0050 | ROBOT | ROBOT-01 | 110 |
| 0060 | TEST (FAD) | TEST-01/02 | 360 |
| 0070 | PAINT | PAINT-01 | 160 |
| 0080 | FINAL (tank + motor) | FINAL-01 | 210 |
| 0090 | PACK | PACK-01 | 120 |

Side routings: cylinder VMC-01 100 s → HONE-01 90 s; crankshaft LATHE-01 170 s → GRIND-01 190 s.

### 11.5 Sales order

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| so_no **PK** | String(14) | M | `SO-2646-0006` | 12.4 |
| customer_no | String(10) | M | `CUS-0004` | |
| customer_po | String(35) | M | `PO-88231` | customer's own number – repeat it in every answer (EDI `RFF+ON`) |
| order_date | DateTime | M | `2026-11-09T08:15:00Z` | |
| status | Enum | M | `OPEN` | `OPEN`, `PARTIAL`, `SHIPPED`, `INVOICED`, `PAID`, `CANCELLED` |
| make_to_order | Bool | M | `true` | twin: `mto` |
| **line:** line_no | Int | M | `1` | |
| sku | String(20) | M | `VC20-300` | |
| qty | Int | M | `23` | |
| unit_price | Dec(12,2) | M | `1450.00` | |
| currency | String(3) | M | `USD` | |
| requested_date | Date | M | `2026-11-11` | EDI `DTM+2` |
| promised_date | Date | M | `2026-11-11` | sent in ORDRSP |
| qty_shipped | Int | M | `0` | |
| incoterm | String(3) | O | `FCA` | delivery terms (choose with sales) |

### 11.6 Purchase order

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| po_no **PK** | String(14) | M | `PO-2646-0009` | |
| supplier_no | String(10) | M | `SUP-0001` (Foundry A) | |
| order_date | DateTime | M | `2026-11-09T08:30:00Z` | |
| status | Enum | M | `OPEN` | `OPEN`, `CONFIRMED`, `PARTIAL`, `RECEIVED`, `CLOSED`, `CANCELLED` |
| **line:** line_no | Int | M | `1` | |
| item_no | String(20) | M | `CC20-CAST` | |
| qty | Int | M | `120` | |
| unit_price | Dec(12,4) | M | `95.0000` | |
| due_date | Date | M | `2026-11-30` | order date + lead time |
| confirmed_date | Date | O | `2026-11-30` | from supplier ORDRSP – the basis for measuring σ_LT (10.3) |
| qty_received | Int | M | `0` | |
| cert_required | Enum | O | `3.1` | inspection certificate type (EN 10204) – agree with quality |

### 11.7 Goods receipt and material lot

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| lot_no **PK** | String(20) | M | `LOT-CC20-2646-003` | our lot number (12.5), printed on our label |
| item_no | String(20) | M | `CC20-CAST` | |
| po_no / po_line | String(14) / Int | M | `PO-2646-0009` / 1 | |
| supplier_lot | String(20) | M | `FA-L0009` | from DESADV `GIN+BX` or supplier label AI (10) |
| heat_no | String(20) | O | `H26-4471` | melt / heat number from the certificate |
| qty_received | Int | M | `120` | |
| qty_on_hand | Int | M | `120` | updated by every movement |
| receipt_time | DateTime | M | `2026-11-10T06:20:00Z` | |
| quality_status | Enum | M | `RELEASED` | `QUARANTINE`, `RELEASED`, `BLOCKED`, `SCRAPPED` – MES must not consume a non-released lot |
| certificate_ref | String(40) | O | `CERT-FA-0009.pdf` | |
| location | String(12) | M | `ASRS-RAW` | |

### 11.8 Work order (production order)

| Field | Type | M/O | Example | Twin field |
|---|---|---|---|---|
| wo_no **PK** | String(14) | M | `WO-2646-0012` | `id` |
| sku | String(20) | M | `VC20-300` | `item` |
| model | String(6) | M | `VC20` | `product` |
| qty | Int | M | `23` | `qty` |
| qty_started / qty_done / qty_scrap | Int | M | `0` / `0` / `0` | `started`, `done`, `scrap` |
| status | Enum | M | `PLANNED` | `PLANNED`, `RELEASED`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CLOSED` (4.1.1) |
| priority | Int 1–9 | M | `3` | 1 = most urgent; MTO 3, MRP 5 (twin) |
| due | DateTime | M | `2026-11-11T08:00:00Z` | `due` |
| source | Enum | M | `SO` | `MRP`, `SO`, `MANUAL` |
| so_no / so_line | String(14) / Int | C | `SO-2646-0006` / 1 | mandatory if source = SO (pegging) |
| bom_rev / routing_rev | String(2) | M | `A` / `A` | frozen at release – later changes do not affect this order |
| created / released / completed | DateTime | M / C / C | | |
| hold_reason | String(60) | C | `Casting lot quarantined` | mandatory when ON_HOLD |

### 11.9 Serial (unit) record

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| serial_no **PK** | String(20) | M | `VC20-2646-00123` | 12.4; marked on the crankcase at op 0010 |
| sku / model | String(20) / String(6) | M | `VC20-300` / `VC20` | |
| wo_no **FK** | String(14) | M | `WO-2646-0012` | |
| status | Enum | M | `IN_PROCESS` | `IN_PROCESS`, `ON_HOLD`, `IN_STOCK`, `SHIPPED`, `SCRAPPED`, `REWORK` |
| location | String(12) | M | `TEST-01` | last station or store |
| start_time | DateTime | M | `2026-11-10T07:02:10Z` | |
| fg_time | DateTime | C | | when booked into FG store |
| test_result_id **FK** | String(20) | C | `TR-000457` | final valid test |
| so_no / customer_no | String(14) / String(10) | C | | filled at shipping |
| ship_time / shipment_no | DateTime / String(14) | C | | `SHP-2646-0042` |
| tank_serial / motor_serial | String(30) | C | `TW-300-8812` / `MD-4K-55120` | supplier serials from the nameplates (recommended, 5.4) |

**Route events** (one row per station visit): serial_no, op_no, station, start_time, end_time, result
(`OK`, `NOK`, `REWORK`), operator_id (if manual), nc_program / recipe used.

### 11.10 Genealogy (consumption event)

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| event_id **PK** | Int | M | `884512` | |
| parent_id | String(20) | M | `VC20-2646-00123` | unit (or sub-assembly) that receives the part |
| component_item | String(20) | M | `CYL-CAST` | |
| component_lot | String(20) | C | `LOT-CYL-2646-002` | if traceability = LOT |
| component_serial | String(30) | C | | if traceability = SERIAL |
| qty | Dec(10,4) | M | `2` | |
| station / op_no | String(12) / String(4) | M | `ASSY-01` / `0040` | |
| time | DateTime | M | `2026-11-10T07:21:40Z` | source time stamp from the PLC |
| capture | Enum | M | `SCAN` | `SCAN`, `AUTO_FIFO`, `MANUAL` – tells how reliable the link is |

Forward and backward search (10.8) are simple queries on this one table plus the lot table.

### 11.11 Test result

| Field | Type | M/O | Example |
|---|---|---|---|
| test_result_id **PK** | String(20) | M | `TR-000457` |
| serial_no | String(20) | M | `VC20-2646-00123` |
| bench | String(12) | M | `TEST-01` |
| test_plan / rev | String(16) / String(2) | M | `CP-VC20-TEST` / `A` |
| fad_m3_h | Dec(6,2) | M | `20.31` |
| lsl_m3_h | Dec(6,2) | M | `19.40` (copied from the plan at test time) |
| pressure_bar | Dec(5,2) | M | `8.00` |
| inlet_temp_c, ambient_pressure_kPa | Dec(5,1) | M | `21.5`, `100.8` (FAD must be corrected to inlet conditions – see ISO 1217) |
| motor_power_kw | Dec(6,2) | O | `4.12` |
| result | Enum | M | `PASS` / `FAIL` |
| attempt | Int | M | `1` (FPY counts only attempt 1) |
| curve_file | String(60) | O | `TR-000457.csv` (raw curve) |
| time | DateTime | M | `2026-11-10T08:44:05Z` |

### 11.12 Non-conformance record (NCR)

| Field | Type | M/O | Example | Note |
|---|---|---|---|---|
| ncr_no **PK** | String(14) | M | `NCR-2646-0002` | twin: `NCR-00002` |
| time | DateTime | M | `2026-11-10T09:31:12Z` | |
| station | String(12) | M | `TEST-02` | |
| part_id | String(30) | M | `VC20-2646-00131` | serial or component id |
| item_no | String(20) | M | `VC20-300` | |
| lot_no | String(20) | O | `LOT-CC20-2646-003` | |
| defect_code | String(8) | M | `T-FAD-LOW` | from a reason-code list (make the list with quality) |
| description | String(200) | M | `FAD 19.29 < 19.40 m3/h` | |
| qty | Int | M | `1` | |
| disposition | Enum | M | `REWORK` | `SCRAP`, `REWORK`, `USE_AS_IS`, `RETURN_TO_SUPPLIER` (twin: always scrap) |
| disposition_by / time | String(20) / DateTime | C | `QA-ANNA` | only quality role may decide |
| root_cause / action | String(200) | O | `Valve plate leak` / `Replace valve plate, retest` | |
| cost | Dec(12,2) | O | `211.00` | for scrap cost reporting |
| status | Enum | M | `OPEN` | `OPEN`, `DISPOSITIONED`, `CLOSED` |

### 11.13 Maintenance work order

| Field | Type | M/O | Example | Twin field |
|---|---|---|---|---|
| mwo_no **PK** | String(14) | M | `MWO-2646-0004` | `id` |
| asset_id | String(12) | M | `HMC-02` | `machine` |
| type | Enum | M | `PREDICTIVE` | `CORRECTIVE`, `PREVENTIVE`, `PREDICTIVE` (`type`) |
| trigger | String(80) | M | `Vibration trend reaches 7.1 mm/s in 4.2 h` | `text` |
| alarm_ref | String(30) | O | OPC UA EventId / alarm number | |
| priority | Int 1–4 | M | `2` | |
| status | Enum | M | `OPEN` | `OPEN`, `IN_PROGRESS`, `DONE`, `CLOSED`, `CANCELLED` |
| created / started / finished | DateTime | M / C / C | | `created`, `closed` |
| downtime_min | Dec(6,1) | C | `28.0` | `downtime_min` |
| failure_code / cause / remedy | String(8) each | C | `BRG` / `WEAR` / `REPL` | needed for MTBF per failure mode |
| spare_parts | list (item_no, qty) | O | `SPB-6208, 2` | |
| technician | String(20) | C | `MT-JOHN` | |

### 11.14 B2MML messages – field lists

**Important:** below is the **logical** content (ISA-95 attribute → B2MML element). In the official B2MML
schema several elements sit deeper (for example `MaterialProducedRequirement` inside `SegmentRequirement`,
and `Quantity` as a structure with `QuantityString` and `UnitOfMeasure`). The exact path depends on the
B2MML schema version. **Write the version (e.g. "B2MML V0600" or "V0700") in the interface spec and
validate every message against that XSD.** The shortened XML in 3.3 is a teaching example.

**ProcessProductionSchedule (ERP → MES), one ProductionRequest per work order**

| ISA-95 attribute | B2MML element (logical path) | Type | M/O | Example |
|---|---|---|---|---|
| Sender | `ApplicationArea/Sender/LogicalID` | String | M | `ERP` |
| Creation time | `ApplicationArea/CreationDateTime` | DateTime | M | `2026-11-09T08:20:00Z` |
| Message id | `ApplicationArea/BODID` | String | M | `ERP-20261109-000731` (for duplicates and acknowledge) |
| Verb | `DataArea/Process` | – | M | |
| Request id | `ProductionRequest/ID` | String(14) | M | `WO-2646-0012` |
| Description | `ProductionRequest/Description` | String | O | `MTO for SO-2646-0006` |
| Priority | `ProductionRequest/Priority` (if not in your schema version: agreed extension) | Int | M | `3` |
| Earliest start | `ProductionRequest/StartTime` | DateTime | O | `2026-11-09T12:00:00Z` |
| Due | `ProductionRequest/EndTime` | DateTime | M | `2026-11-11T08:00:00Z` |
| Product | `…/MaterialProducedRequirement/MaterialDefinitionID` | String(20) | M | `VC20-300` |
| Quantity + unit | `…/MaterialProducedRequirement/Quantity` (`QuantityString`, `UnitOfMeasure`) | Int, String | M | `23`, `EA` |
| BOM / routing revision | `…/ProductSegmentID` or agreed extension | String | O | `A` |
| Sales order | agreed extension (e.g. `ProductionRequest/HierarchyScope` is **not** for this) | String | O | `SO-2646-0006` |

**AcknowledgeProductionSchedule (MES → ERP)**

| Element | M/O | Example |
|---|---|---|
| `ApplicationArea/Sender/LogicalID` | M | `MES` |
| `ApplicationArea/BODID` + original BODID reference | M | `MES-20261109-002210`, ref `ERP-20261109-000731` |
| `Acknowledge/…/ResponseExpression@actionCode` | M | `Accepted`, `Modified` or `Rejected` |
| reason text (when Rejected) | C | `Unknown MaterialDefinitionID VC99-300` |
| `ProductionRequest/ID` | M | `WO-2646-0012` |

**ProcessProductionPerformance (MES → ERP)** – two kinds: per unit (finished-goods booking) and per
completed order.

| Element (logical) | Per unit | Per order | Example |
|---|---|---|---|
| `ProductionResponse/ID` (= work order) | M | M | `WO-2646-0012` |
| `…/MaterialProducedActual/MaterialDefinitionID` | M | M | `VC20-300` |
| `…/MaterialProducedActual/MaterialLotID` (serial) | M | – | `VC20-2646-00123` |
| `…/MaterialProducedActual/Quantity` | M | M | `1` (unit) / `23` (order good qty) |
| `…/MaterialProducedActual/StorageLocation` | M | – | `ASRS-FG` |
| scrap quantity (as MaterialProducedActual with a scrap location, or agreed extension) | – | M | `1` |
| `…/MaterialConsumedActual/MaterialDefinitionID` + `MaterialLotID` + `Quantity` | O (only if ERP wants lot-level backflush) | O | `CC20-CAST`, `LOT-CC20-2646-003`, `1` |
| `ProductionResponse/StartTime`, `EndTime` | M | M | `2026-11-10T07:02:10Z`, `…T10:12:00Z` |
| response state (`Completed` / `Closed`) | – | M | `Completed` |

**Other B2MML nouns you will need** (same pattern): `MaterialDefinition` (item master sync ERP → MES),
`MaterialLot` (lot data incl. quality status), `ProductDefinition` (BOM + routing to MES),
`Equipment` (asset list), `Personnel` (if the MES checks qualifications).

**Rules for the interface (copy into the spec):**

1. Every message has a unique `BODID`. The receiver ignores a message whose BODID it already processed
   (idempotent), but still sends the acknowledge again.
2. Every `Process` gets an `Acknowledge` within **60 s** (example). No acknowledge → sender retries 3 ×,
   then alarm.
3. Transport through a queue (store-and-forward), so ERP maintenance does not stop the MES.
4. All time stamps in UTC; all quantities with unit.
5. Change of a released work order: ERP sends `Change` (not a second `Process`); MES answers `Rejected`
   if units are already started and the change is not allowed (for example quantity below started).

### 11.15 Requirement specification for suppliers (with acceptance criteria)

Send these tables with the inquiry. Each line must be answered "standard / configuration / custom
development / not possible". Values are **examples** – set your own.

**MES**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| MES-01 | Receive work orders from ERP (B2MML or agreed ISA-95 REST), acknowledge each | send 50 orders incl. 1 duplicate, 1 invalid | 49 created, duplicate ignored, invalid rejected with reason, all acknowledged < 60 s |
| MES-02 | Work-order states 4.1.1 with role-based release / hold / close and audit trail | release, hold, close as 3 different roles | only allowed roles succeed; audit log shows user + UTC time |
| MES-03 | Release interlock to the serial station (gate) | hold all orders | load station PLC refuses to start a unit within 1 cycle |
| MES-04 | Dispatching rules FIFO, EDD, SETUP, priority override | 5 prepared orders | sequence equals the hand calculation |
| MES-05 | Serial generation per 12.4 and marking interface | generate 100 serials across a week change | format valid, no duplicates, sequence restarts at 00001 in the new ISO week |
| MES-06 | Genealogy per 11.10, forward and backward search | build 5 units; search 1 lot and 1 serial | 100 % match with physical parts; answer < 5 s with 1 year of data (≈ 70 000 units) |
| MES-07 | Test bench interface; limits per model in MES | send PASS, FAIL, limit value 19.40 | correct result; 19.40 = PASS; unit with FAIL blocked from FG |
| MES-08 | SPC I-MR with rules 1 + 4 (10.7.3), Cpk, Ppk | load 25 known values | x̄, σ, limits, Cpk equal spreadsheet to 3 decimals |
| MES-09 | NCR with reason codes, disposition, rework loop | fail a unit, rework, retest | NCR closed, unit retested, FPY counts first attempt only |
| MES-10 | Maintenance orders from alarms and counters; MTBF/MTTR | simulate breakdown + repair | MWO opened and closed automatically, downtime recorded ± 1 min |
| MES-11 | Store-and-forward when ERP link is down | stop ERP interface 4 h | no message lost, sent in order after restart |
| MES-12 | Shop floor keeps running without the MES for a defined time | stop MES server 30 min | PLCs buffer events (≥ 8 h capacity, example); no lost serial after restart |
| MES-13 | Performance | 1 shift at 20 units/h | every screen < 2 s; scanner answer < 1 s |
| MES-14 | Offline operation, no internet; backup and restore | restore last night's backup on a spare server | running again < 4 h (RTO), data loss ≤ 15 min (RPO) |
| MES-15 | Users, roles, password policy, no shared accounts | review | per IEC 62443 requirements agreed in the security spec |

**ERP (manufacturing part)**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| ERP-01 | Item master fields of 11.2 | load 30 items from spreadsheet | all fields stored, mandatory checks work |
| ERP-02 | Multi-level BOM and routing (11.3, 11.4) with effectivity dates | load VC20 BOM; change one line with a future date | MRP uses the old line before, the new line after the date |
| ERP-03 | Time-phased MRP with L4L, FIXED, MULT, MOQ, safety stock, lead-time offset | replay example 10.1 | identical planned order releases |
| ERP-04 | Pegging for make-to-order | create MTO order 23 × VC20 | WO linked to SO; stock reserved; MRP does not net it |
| ERP-05 | Purchasing with EDI ORDERS / ORDRSP / DESADV or portal | test partner | PO sent, confirmation date stored, DESADV creates expected receipt with supplier lot |
| ERP-06 | Goods receipt with lot, quality status, GS1-128 scan | scan a label | lot created per 11.7; quarantine blocks consumption |
| ERP-07 | Standard cost roll-up and variance | roll up VC20 | equals 4.10 method within $0.01 |
| ERP-08 | Sales order, delivery with serial list, invoice (EDI DESADV, INVOIC) | ship 23 units | DESADV lists 23 serials; invoice 23 × 1 450 = 33 350.00 USD |
| ERP-09 | KPI reports: OTD, inventory turns, coverage, accuracy | month-end | formulas as 4.11, 10.4 |
| ERP-10 | Open interface to MES (B2MML / REST), documented | interface test 11.14 rules | all rules pass |

### 11.16 Server sizing (example estimate – the supplier must confirm)

**Data volume of the MES** (example: 15 units/h, 16 h/day, 250 days = **60 000 units/year**):

| Data | Size per unit | Per year |
|---|---|---|
| Serial record + 9 route events + 6 genealogy rows | ≈ 3 kB | 60 000 × 3 kB = 180 MB |
| Test summary (11.11) | ≈ 0.5 kB | 30 MB |
| Test raw curve (300 s × 10 Hz × 4 channels × 8 bytes) | ≈ 96 kB | 60 000 × 96 kB = **5.8 GB** |
| Indexes, logs, audit trail (rule of thumb × 2 on structured data) | | ≈ 0.4 GB |
| **Total** | | **≈ 6.5 GB/year** (with curves), ≈ 0.6 GB without |

Keep the data at least as long as product liability and your customers require (often 10 years or more –
**check with your legal advisor**, chapter 15) → about 65 GB over 10 years. That is small; disk size is not
the problem, **backup, restore time and query speed** are.

**Example server set (virtual machines on 2 physical hosts for redundancy):**

| Server | vCPU | RAM | Disk | Note |
|---|---|---|---|---|
| MES application | 8 | 32 GB | 200 GB SSD | |
| MES database | 8 | 32 GB | 500 GB SSD (RAID 1/10) | daily full backup, log backup every 15 min (RPO 15 min) |
| ERP (if on site) | 8 | 32 GB | 500 GB SSD | often supplied as cloud/hosted – then the ERP–MES link needs the DMZ (guide 07) |
| Interface / queue server (DMZ) | 4 | 8 GB | 100 GB | B2MML queue |
| Test / training system | 4 | 16 GB | 200 GB | copy of MES for tests and training |

UPS for at least 15 min (example) and a controlled shutdown. Network design: guide 07, chapter 11.

---

## 12. Identification and numbering

The project numbering rules are defined in `docs/15_numbering_and_identification.md`. This chapter
shows how the MES and ERP use them. **Doc 15 is the master; check it before you configure the systems.**

**The twin uses simpler formats** (`VC20-000012`, `WO-0012`, `CC20-L0009` – 4.2.1). Those are fine for the
simulation. In the real factory use the formats below.

### 12.1 Overview

| Thing | Format | Example | Created by | Marked / printed on |
|---|---|---|---|---|
| Drawing number | `VC-<area>-<group>-<4 digits>-<rev letter>` | `VC-PRD-CC-0020-C` (crankcase VC20, machined – doc 15 example) | engineering | drawing, item master |
| Item number | MAKE = drawing no. without revision; BUY = `B-<class>-<5 digits>`; castings/forgings and SKUs as in the config (doc 15, 3.5) | `VC-PRD-CC-0020`, `B-SCR-01234`, `CC20-CAST`, `VC20-300` | engineering / purchasing | item master, labels |
| Compressor serial | `<model>-<YYWW>-<5-digit seq>` | `VC20-2646-00123` | MES at op 0010 | crankcase (DataMatrix + text), nameplate, DESADV |
| Part serial (serial-tracked parts) | `<type code>-<YYWW>-<5-digit seq>` | `WRM-2546-00017` (example from doc 15) | MES / station | the part |
| Material lot (ours) | `LOT-<item short code>-<YYWW>-<3-digit seq>` | `LOT-CC20-2646-003` | ERP at goods receipt | our receipt label |
| Work order | `WO-<YYWW>-<4-digit seq>` | `WO-2646-0012` | ERP (or MES for manual) | traveller, HMI |
| Sales order | `SO-<YYWW>-<4-digit seq>` | `SO-2646-0006` | ERP | order confirmation |
| Purchase order | `PO-<YYWW>-<4-digit seq>` | `PO-2646-0009` | ERP | PO, supplier label (AI 400 optional) |
| NCR, maintenance order, shipment / delivery note, change request, calibration | `NCR-`, `MWO-`, `SHP-`, `ECR-`/`ECN-`, `CAL-` + `<YYWW>-<4 digits>` | `NCR-2646-0002`, `MWO-2646-0004`, `SHP-2646-0042` | MES / ERP / PDM / quality | – |

All order and record sequences (WO, SO, PO, NCR, MWO, SHP, ECR …) and all serial sequences **restart at 1
every ISO week, separately per prefix / type code** (doc 15, 3.6 and 3.8). The week in the number keeps
them unique. The twin's short forms map 1:1: `WO-0012` → `WO-<YYWW>-0012`, `VC20-000012` →
`VC20-<YYWW>-<nnnnn>`, `CC20-L0009` → `LOT-CC20-<YYWW>-<nnn>`.
| Signal tag | `<Area>_<Line>_<Machine>_<Signal>` | `MCH_L2_HMC01_SpindleTemp` | automation | PLC, SCADA, historian (guide 07 ch. 12) |

### 12.2 Drawing number

`VC-<area>-<group>-<4 digits>-<rev letter>`: the 4 digits are a running number inside the group; the
revision letter changes with every released change (A, B, C …; doc 15 says which letters are skipped –
commonly I and O, because they look like 1 and 0). The ERP stores **drawing number and revision
separately** in the item master (11.2), and the work order **freezes** the revision at release (11.8), so
the genealogy shows which revision a unit was built to.

### 12.3 YYWW – the week code (ISO 8601 week)

`YYWW` = the last two digits of the **ISO week-year** + the **ISO week number** (01 – 53). Weeks start on
Monday; week 01 is the week with the first Thursday of the year.

| Date | ISO week | YYWW |
|---|---|---|
| Monday 2026-11-09 (start of our worked example) | 2026-W46 | **2646** |
| 2025-11-10 … 2025-11-16 | 2025-W46 | **2546** (the examples in doc 15) |
| Thursday 2026-12-31 | 2026-W53 | 2653 |
| Friday 2027-01-01 | still 2026-W53 | **2653** (not 2701!) |
| Monday 2027-01-04 | 2027-W01 | 2701 |

**Trap:** most programming languages have a "calendar year" and an "ISO week-year". Use the ISO
week-year (e.g. Python `date.isocalendar()`), otherwise 1 January 2027 would become "2753" or "2701" and
serials could repeat or jump. **Test the year change** in the acceptance test (MES-05).

### 12.4 Compressor serial number

`VC20-2646-00123`

| Part | Meaning | Rule |
|---|---|---|
| `VC20` | model code (VC10, VC20, VC30) | from the item master; the SKU (`VC20-300`) is stored separately |
| `2646` | ISO week of **start at op 0010** (marking) | not the finish week |
| `00123` | running number | 5 digits = up to 99 999 – more than enough (≈ 1 200 units per week at 15/h × 16 h × 5 d) |

Rules:
1. Created **only** by the MES, at the load station, before machining (so scrap is traceable).
2. **Never reused**, also not for scrapped units.
3. The running number **restarts at 00001 every ISO week**, separately for each type code (doc 15, 3.6).
   Optional: a Luhn check digit as a last field for hand entry, e.g. `VC20-2546-00123-7` (doc 15 shows the
   calculation). If used, the regular expression below gets `(-[0-9])?` at the end.
4. Check pattern for scanners and interfaces (regular expression):
   `^VC(10|20|30)-[0-9]{2}(0[1-9]|[1-4][0-9]|5[0-3])-[0-9]{5}$`
5. Length 15 characters – fits GS1 AI (21) (max 20) and the 20-character fields of chapter 11.

### 12.5 Material lot number

`LOT-CC20-2646-003` = our 3rd receipt lot of CC20 castings in week 2646.

* One goods receipt line = one lot. If the supplier delivers 2 supplier batches in one delivery, create
  **2 lots**.
* Always store the **supplier lot** (`FA-L0009`) and, for castings and forgings, the **heat number** in the
  lot record (11.7). A supplier recall names *their* lot; you must find *your* lot.
* 3 digits = 999 lots per item and week – enough.

### 12.6 Order numbers

`WO-2646-0012`, `SO-2646-0006`, `PO-2646-0009`: 4 digits per week = 9 999 orders per week. The prefix
tells the type at once; the week tells the age. Customer and supplier numbers are kept in their own fields
(`customer_po` = `PO-88231` is the **customer's** number, not ours – do not confuse it with our `PO-…`).

### 12.7 Labels: GS1-128 and GS1 DataMatrix

GS1 codes put several data fields into one barcode. Each field starts with an **Application Identifier
(AI)** in brackets (the brackets are printed in the human-readable text only, not encoded).

| AI | Meaning | Format | Example |
|---|---|---|---|
| (00) | SSCC – serial number of a logistic unit (pallet) | 18 digits, fixed | `095212345000001237` |
| (01) | GTIN – trade item number | 14 digits, fixed | `09521234567899` |
| (02) | GTIN of the items **contained** in a logistic unit | 14 digits, fixed | used with (00) and (37) |
| (10) | batch / lot | up to 20 characters, variable | `LOT-CC20-2646-003` |
| (11) | production date | YYMMDD, fixed | `261110` |
| (21) | serial number | up to 20 characters, variable | `VC20-2646-00123` |
| (37) | count of trade items in a logistic unit | up to 8 digits, variable | `120` |
| (400) | customer's purchase order number | up to 30 characters, variable | `PO-88231` |
| (91) – (99) | company internal information | up to 90 characters | internal use if you have no GTIN |

**Correction to the earlier text (5.4 and guide 07):** AI (02) and AI (37) are meant for a **logistic
unit** (pallet with the same items) and are used together with (00) SSCC. For a single item or a case with
fixed content use (01) (+ (10) lot), without (37). Check the AI combination rules ("mandatory
associations") in the current **GS1 General Specifications**.

**Variable-length fields** (10, 21, 37, 400) must end with a separator character (FNC1 / ASCII 29 "GS")
unless they are the **last** field. So put the serial or lot **last** when you can.

#### Check digit (modulo 10) – worked example

GTIN, SSCC and GLN all use the same check digit. Doc 15 (3.16) shows it for the compressor GTIN
`9521234567899`. Here a second example: GTIN-13 for the casting CC20-CAST with the GS1 **demonstration
prefix 952** (as in doc 15 – **never print 952 on real labels**; get your own company prefix from your
national GS1 organisation), first 12 digits `952123400020`:

```
digits (without check digit):   9  5  2  1  2  3  4  0  0  0  2  0
weights, starting from the RIGHT with 3:
                                1  3  1  3  1  3  1  3  1  3  1  3
products:                       9 15  2  3  2  9  4  0  0  0  2  0   → sum = 46
check digit = (10 − (46 mod 10)) mod 10 = (10 − 6) mod 10 = 4
GTIN-13 = 9521234000204      as GTIN-14 in AI (01) or (02): 09521234000204
```

Check of the pallet label in guide 07 step 6 (teaching example with another example prefix):
`0401234500001?` → sum 34 → check digit **6** → `04012345000016`. The teaching view in `web/commsim.js`
shows `…017`; 7 is not a valid check digit.

SSCC examples (extension digit 0 + prefix 9521234 + 9-digit serial reference + check digit):
`0 9521234 500000077` → sum 87 → check digit 3 → `095212345000000773` (supplier pallet, example);
`0 9521234 500000123` → sum 73 → check digit 7 → `095212345000001237` (our shipping pallet, example).

#### Labels in this factory (proposal)

| Label | Carrier | Content (human-readable form) |
|---|---|---|
| Crankcase direct part mark (op 0010) | DataMatrix, dot peen or laser + plain text | `VC20-2646-00123` (plain serial is enough inside the plant; or GS1 form below) |
| Nameplate / packaging of the compressor | GS1 DataMatrix + GS1-128 on the box | `(01)09521234567899(11)261110(21)VC20-2646-00123` (doc 15 adds `(240)` with our part number) |
| Supplier pallet label (read at receipt) | GS1-128 | `(00)095212345000000773(02)09521234000204(37)120(10)FA-L0009` (example values; the SSCC links the pallet to the DESADV) |
| Our receipt label on a casting pallet | GS1-128 or DataMatrix | `(02)09521234000204(37)120(10)LOT-CC20-2646-003` together with the supplier's SSCC; if the item has no GTIN, use internal AI 91–99 or a plain Code 128 with the lot number |
| Shipping pallet | GS1-128 | `(00)095212345000001237(02)09521234567899(37)8(400)PO-88231` – SSCC links to the DESADV |

Verification: print quality grade per ISO/IEC 15416 (linear) and ISO/IEC 15415 (2D), direct part marks per
ISO/IEC TR 29158. Test the crankcase mark **after washing and painting** (5.4). Target grades are a
decision for quality (chapter 15).

---

## 13. Standards

Only standards we are sure of are listed. Clause numbers change between editions: where a clause is
named, **check it in the current edition**. The project-wide register with editions is `docs/16_standards_register.md`.

| Standard | Title (short) | What it requires / gives for us | How to verify |
|---|---|---|---|
| **IEC 62264-1** (ISA-95 Part 1) | Enterprise-control system integration – Models and terminology | the level model (L0–L4), the functions of MES vs. ERP, the object model names (material, equipment, personnel, production schedule, performance) | ERP/MES split table (5.1) uses these terms; supplier confirms the mapping |
| **IEC 62264-2** | Objects and attributes for enterprise-control system integration | attribute lists of the objects (e.g. MaterialLot, ProductionRequest) – the basis of 11.14 | field mapping table in the interface spec |
| **IEC 62264-3** | Activity models of manufacturing operations management | the MES activities (production, quality, maintenance, inventory operations) – use as a checklist for MES scope | requirement list 11.15 covers all 4 areas |
| **IEC 62264-5** | Business to manufacturing transactions | the verbs (Get, Show, Process, Change, Cancel, Acknowledge, Respond, Sync …) used by B2MML | messages use these verbs; acknowledge rules in spec |
| **B2MML** (MESA International) | XML schemas implementing IEC 62264 | not an ISO/IEC standard but the usual implementation; version must be named | validate each message against the named XSD version |
| **ISO 8601** | Date and time format | `2026-11-09T09:14:37Z`, ISO week numbers (12.3) | interface test with week-53 and year-change dates |
| **ISO 4217** | Currency codes | `USD`, `EUR` in all money fields | field check |
| **UN/ECE Recommendation 20** | Codes for units of measure | unit codes (`EA`, `KGM`, `MTR` …) | one unit list in ERP and MES |
| **UN/EDIFACT** (syntax ISO 9735) | Electronic data interchange | ORDERS, ORDRSP, DESADV, INVOIC, RECADV; directory version (e.g. D.96A) and partner "message implementation guideline" | test messages with each partner |
| **GS1 General Specifications** | GS1 identification keys, AIs, barcodes | GTIN/SSCC structure, check digit, AI formats and combination rules (12.7) | label review; scanner test; check digit test |
| **ISO/IEC 15417** | Code 128 barcode symbology (GS1-128 is a use of it) | symbol structure | verifier |
| **ISO/IEC 16022** | Data Matrix symbology | symbol structure | verifier |
| **ISO/IEC 15415 / 15416** | Print quality of 2D / linear barcodes | grading method A–F (or 4–0) | barcode verifier report |
| **ISO/IEC TR 29158** | Direct part mark quality | grading of dot-peen / laser marks | verifier with DPM lighting |
| **ISO 9001** | Quality management systems | identification and traceability (clause 8.5.2 in the 2015 edition), control of nonconforming outputs (8.7), monitoring and measuring resources / calibration (7.1.5) | internal audit; recall drill (5.6) |
| **ISO 7870-2** | Control charts – Shewhart control charts | chart types, constants, rules (10.7) | SPC test MES-08 |
| **ISO 22514** series | Statistical methods in process management – capability and performance | definitions of Cp, Cpk, Pp, Ppk and how to compute them (check which part covers your case) | compare MES result with a spreadsheet |
| **ISO 1217** | Displacement compressors – Acceptance tests | how to measure and correct FAD to inlet conditions; test tolerances (check annex for packaged electrically driven compressors) | test bench procedure; calibration |
| **ISO 22400-2** | KPIs for manufacturing operations management – definitions | standard KPI formulas (OEE, availability, quality rate …) | MES KPI formulas compared with the standard |
| **EN 13306** | Maintenance terminology | definitions (corrective, preventive, condition-based, MTBF …) | maintenance order types use these terms |
| **EN 15341** | Maintenance key performance indicators | maintenance KPI definitions | KPI report review |
| **EN 10204** | Metallic products – types of inspection documents | certificate types 2.1, 2.2, 3.1, 3.2 for castings / forgings | PO field `cert_required`; receipt check |
| **IEC 62443** (series) | Security for industrial automation and control systems | zones/conduits and security levels; requirements for MES as part of the OT system – see guide 07 ch. 13 | security spec, supplier statement, test |

Pressure equipment (the air tank) has its own legal rules in each country/region (for example in the EU the
Pressure Equipment Directive or the Simple Pressure Vessels Directive). These affect traceability of the
tank serial – **ask the tank supplier and your notified body** (chapter 15).

---

## 14. Complete worked example – one order end to end

One make-to-order customer order, using the real-factory numbering (chapter 12), the twin's example
parameters (config) and the story of the Communication tab. **All values are examples.** Times are UTC.

### 14.1 Order and planning

| # | Time | Event | Record / message | Field values |
|---|---|---|---|---|
| 1 | Mon 2026-11-09 08:15 | Customer order arrives | EDI ORDERS (guide 07 step 1) | `BGM+220+PO-88231`, `NAD+BY+DELTA001`, `LIN VC20-300`, `QTY+21:23`, `DTM+2:20261111`, `PRI 1450` |
| 2 | 08:16 | ERP creates sales order | SO (11.5) | `so_no SO-2646-0006`, `customer_no CUS-0004` (Delta Compressors), `customer_po PO-88231`, `sku VC20-300`, `qty 23`, `unit_price 1450.00 USD`, `requested_date 2026-11-11`, `make_to_order true`, value 23 × 1 450 = **$33 350** |
| 3 | 08:17 | ERP confirms | EDI ORDRSP | `BGM+231+SO-2646-0006+29`, `RFF+ON:PO-88231`, `DTM+2:20261111` |
| 4 | 08:20 | ERP creates MTO work order | WO (11.8) | `WO-2646-0012`, `VC20-300`, qty 23, priority 3, due `2026-11-11T08:00:00Z`, source SO, `so_no SO-2646-0006`, status PLANNED |
| 5 | 08:20 | MRP checks material CC20-CAST | calculation (4.7 / guide 07 step 3, config values) | need 23, safety 100, on hand 15, on order 0 → net = 23 + 100 − 15 − 0 = **108** → ⌈108 / 120⌉ × 120 = **120** |
| 6 | 08:30 | Purchase order | PO (11.6) + EDI ORDERS | `PO-2646-0009`, Foundry A `SUP-0001`, `CC20-CAST` × 120 × $95.00 = **$11 400.00**, due (twin lead time 16 h) 2026-11-10 |

Other materials (cylinders, crankshafts, tanks, motors) are available in this story; their MRP lines
work the same way.

### 14.2 Goods receipt

| # | Time | Event | Values |
|---|---|---|---|
| 7 | Tue 2026-11-10 05:30 | DESADV from foundry | `BGM+351+DN-55120`, `RFF+ON:PO-2646-0009`, `QTY+12:120`, `GIN+BX+FA-L0009` (supplier lot) |
| 8 | 06:20 | Receipt scan | supplier pallet label `(00)095212345000000773(02)09521234000204(37)120(10)FA-L0009` (example values) – the SSCC matches the DESADV |
| 9 | 06:21 | ERP creates lot | `LOT-CC20-2646-003`, `supplier_lot FA-L0009`, `heat_no H26-4471`, qty 120, `quality_status QUARANTINE` |
| 10 | 06:40 | Incoming inspection OK | `quality_status RELEASED`; our label `(02)09521234000204(37)120(10)LOT-CC20-2646-003` printed |
| 11 | 06:45 | Put-away | MES/WMS → AS/RS: `Store("LOT-CC20-2646-003","CC20-CAST",120)` → slot R04-C2 |

Stock CC20-CAST now 15 + 120 = 135 (the 15 old pieces belong to an older lot, used first – FIFO).

### 14.3 Release and production

| # | Time | Event | Values |
|---|---|---|---|
| 12 | Mon 08:21 | B2MML ProcessProductionSchedule ERP → MES | `BODID ERP-20261109-000731`, `ID WO-2646-0012`, `Priority 3`, `EndTime 2026-11-11T08:00:00Z`, `MaterialDefinitionID VC20-300`, `Quantity 23 EA` |
| 13 | 08:21 | Acknowledge MES → ERP | `actionCode Accepted`, ref `ERP-20261109-000731` |
| 14 | Tue 06:55 | MES releases (rule EDD, priority 3 beats the MRP orders with priority 5) | WO status RELEASED; OPC UA `StartOrder("WO-2646-0012","VC20-300","VC20_v1",23)` → Good, queuePos 1 |
| 15 | 07:02 | First unit started | serial `VC20-2646-00123`, lot of crankcase: the 15 old castings first (FIFO) are lot `LOT-CC20-2645-007` (example), units 00138 onwards use `LOT-CC20-2646-003` |
| 16 | 07:02 – 10:12 | 24 units started: `VC20-2646-00123` … `VC20-2646-00146` | 23 ordered + 1 replacement for a scrap (step 18) |

**Genealogy record of the first unit (11.9 + 11.10):**

| Field | Value |
|---|---|
| serial_no | `VC20-2646-00123` |
| wo_no / sku | `WO-2646-0012` / `VC20-300` |
| route | 0010 LOAD-CC 07:02:10–07:03:40 · 0020 HMC-02 07:04–07:10 · 0030 WASH-01 · 0040 ASSY-01 07:21–07:24 · 0050 ROBOT-01 · 0060 TEST-01 08:38–08:44 · 0070 PAINT-01 · 0080 FINAL-01 · 0090 PACK-01 09:31 |
| crankcase | `CC20-CAST` lot `LOT-CC20-2645-007` (capture AUTO_FIFO at 0010) |
| cylinders | 2 × `CYL-CAST` lot `LOT-CYL-2646-002` (SCAN at 0040) |
| crankshaft | 1 × `CS-FORG` lot `LOT-CS-2645-011` (SCAN at 0040) |
| tank | `TANK-300` lot `LOT-T300-2646-001`, tank serial `TW-300-8812` (SCAN at 0080) |
| motor | `MOT-4KW` lot `LOT-M4K-2646-001`, motor serial `MD-4K-55120` (SCAN at 0080) |
| test | `TR-000457`: FAD 20.31 m³/h, LSL 19.40, 8.00 bar, PASS, attempt 1 |

(The other lot numbers in this table are invented for the example, in the format of 12.5.)

### 14.4 Test results, SPC and one reject

First 10 tested units of this order (FAD in m³/h, example values):

| Unit | 00123 | 00124 | 00125 | 00126 | 00127 | 00128 | 00129 | 00130 | 00131 | 00132 |
|---|---|---|---|---|---|---|---|---|---|---|
| FAD | 20.31 | 20.62 | 19.98 | 20.45 | 20.12 | 20.71 | 20.26 | 20.03 | **19.29** | 20.38 |
| MR | – | 0.31 | 0.64 | 0.47 | 0.33 | 0.59 | 0.45 | 0.23 | 0.74 | 1.09 |

```
x̄   = 202.15 / 10 = 20.215 m³/h
MR̄  = 4.85 / 9   = 0.539
σ    = 0.539 / 1.128 = 0.478
UCL  = 20.215 + 3 × 0.478 = 21.65      LCL = 20.215 − 3 × 0.478 = 18.78
UCL(MR) = 3.267 × 0.539 = 1.76          (largest MR 1.09 → no MR signal)
Cpk  = (20.215 − 19.40) / (3 × 0.478) = 0.815 / 1.434 = 0.57   → not capable (target ≥ 1.33)
expected rejects at Cpk 0.57: Φ(−1.71) ≈ 4.4 %   → about 1 in 23 units – this order had 1 in 24
```

Note: unit 00131 (19.29) is **inside** the control limits (process did not "change") but **below the
LSL** (unit is bad). This is the difference between control limits and spec limits (4.3.4). With only 10
values the Cpk is very uncertain (10.7.6) – but it already tells you to work on the mean flow.

| # | Time | Event | Values |
|---|---|---|---|
| 17 | Tue 09:31 | Unit 00131 fails | test `TR-000465`: FAD 19.29 < 19.40 → FAIL |
| 18 | 09:31 | NCR | `NCR-2646-0002`, station TEST-02, part `VC20-2646-00131`, item `VC20-300`, lot of the crankcase `LOT-CC20-2645-007` (see note), defect `T-FAD-LOW`, text `FAD 19.29 < 19.40 m3/h`. In a real factory the normal disposition is REWORK → retest; in this example quality decides **SCRAP** to match the twin. WO `qty_scrap` = 1 → units still to start = 23 − (23 − 1) = **1** → MES starts unit 00146 |
| 19 | | Scrap cost | castings/forging in the unit: 95 + 2 × 28 + 60 = **$211** (+ other parts already fitted + conversion up to test, per your costing rule) |

Note: unit 00131 uses a crankcase of the old lot or the new lot depending on FIFO position (00123–00137
use the 15 old castings). Here 00131 is from `LOT-CC20-2645-007`; the NCR stores that lot. Write what the
genealogy says, never what you expect.

### 14.5 Confirmation, shipping, invoice, payment

| # | Time | Event | Values |
|---|---|---|---|
| 20 | per unit, e.g. 09:32 | ProcessProductionPerformance (unit) | `ID WO-2646-0012`, `MaterialDefinitionID VC20-300`, `MaterialLotID VC20-2646-00123`, `Quantity 1 EA`, `StorageLocation ASRS-FG` → ERP: FG +1 |
| 21 | Tue 12:40 | Order completed | ProcessProductionPerformance (order): good 23, scrap 1, StartTime `…T07:02:10Z`, EndTime `…T12:40:00Z`; WO status COMPLETED |
| 22 | | ERP backflush | CC20-CAST −24, CYL-CAST −48, CS-FORG −24, TANK-300 −23, MOT-4KW −23 (scrapped unit had no tank/motor yet: it failed at op 0060 before FINAL 0080) |
| 23 | Tue 14:00 | Delivery | `SHP-2646-0042`, SO-2646-0006, 23 × VC20-300, dock OUT-1; crane retrieves 23 serials |
| 24 | 15:30 | DESADV to customer | `RFF+ON:PO-88231`, 23 × `GIN+BN+VC20-2646-00123` … (all serials except 00131), shipping pallets with SSCC labels |
| 25 | 15:31 | INVOIC | `BGM+380+INV-2026-0006`, `QTY+47:23`, `PRI 1450`, `MOA+77:33350` |
| 26 | Wed 09:00 | RECADV from customer | `RFF+AAK:SHP-2646-0042`, `QTY+48:23` |
| 27 | later | Payment (camt.054) | 33 350.00 USD, reference INV-2026-0006 → SO status PAID |

### 14.6 Result and KPIs of this order

| KPI | Calculation | Result |
|---|---|---|
| On time | shipped Tue 14:00, due Wed 2026-11-11 | **on time** |
| FPY | 23 / 24 | **95.8 %** |
| Revenue | 23 × 1 450 | **$33 350** |
| COGS (standard) | 23 × 764.80 (4.10) | **$17 590.40** |
| Gross profit | 33 350 − 17 590.40 | **$15 759.60** (47.3 %) before scrap cost |
| Scrap | 1 unit, ≥ $211 material | booked as variance |
| Flow time | first start 07:02 → last unit in FG ≈ 12:40 | 5.6 h for 24 units |
| Lot traceability check | forward search `LOT-CC20-2646-003` | lists 00138 – 00146 (and the rest of the lot still in stock: 120 − 9 = 111) |

---

## 15. Data you still need

The guide and the twin cannot give these. Without them the real MES/ERP cannot be configured.

| # | Data | Why it is needed | Who delivers |
|---|---|---|---|
| 1 | Real lead times per item, with supplier delivery history (mean and σ_LT) | MRP offset, safety stock (10.3) | purchasing, suppliers |
| 2 | Demand history or forecast per model (mean and σ per day/week) | MRP, safety stock, EOQ | sales |
| 3 | Ordering cost S and holding cost rate i | EOQ (10.2) | finance |
| 4 | Supplier packaging, MOQ, truck loads | lot sizes | purchasing, suppliers |
| 5 | Measured cycle, setup and handling times per operation and model | routing (11.4), capacity, cost | manufacturing engineering (time study, ≥ 30 cycles) |
| 6 | Final multi-level BOM incl. valves, heads, gaskets, belts, packing; drawing numbers and revisions | MRP, cost, genealogy | engineering |
| 7 | Item and drawing code lists (area, group, type codes) | numbering (12) | engineering, owner of doc 15 |
| 8 | GS1 company prefix (if GTIN/SSCC are used) and customer label requirements | labels (12.7) | management (GS1 membership), sales (customer specs) |
| 9 | Test specification per model: nominal FAD, tolerance, test pressure, correction method, test time | test limits, SPC | quality, R&D (with ISO 1217) |
| 10 | Which components are serial-traced (tank, motor, valve?) and the capture points | genealogy scope | quality, customers |
| 11 | Record retention period for production and test data | storage sizing, archive | legal, quality, key customers |
| 12 | Reason codes for scrap/rework, failure/cause/remedy codes for maintenance | NCR, MWO, Pareto analysis | quality, maintenance |
| 13 | Barcode / DPM quality target grades and marking method on the crankcase | labels, marking machine purchase | quality, marking supplier |
| 14 | Pressure-vessel legal requirements for the tanks in the sales countries | tank traceability, documentation | tank supplier, notified body, legal |
| 15 | Work-centre cost rates, overhead rules, scrap costing rule | standard cost | finance |
| 16 | ERP and MES product choice, B2MML version or REST spec | interface spec 11.14 | IT, suppliers |
| 17 | EDI partners and their message guidelines (version, codes) | EDI set-up | sales, purchasing, partners |
| 18 | Shift model and working calendar (days, shifts, holidays) | MRP calendar, capacity, KPIs | production management, HR |
| 19 | Opening stock per lot on the cut-over day | go-live | warehouse (physical count) |
| 20 | Roles and authorisation matrix (who may release, disposition, change master data) | user set-up, audit trail | production, quality, IT |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| B2MML | Business To Manufacturing Markup Language: XML/JSON implementation of the ISA-95 models (MESA) |
| BOM | Bill of materials |
| COGS | Cost of goods sold (here: standard cost of shipped units) |
| Coverage | How many hours the stock lasts at the planned consumption |
| Cpk | Process capability index, here one-sided: (mean − LSL) / 3σ |
| d₂ | Statistical constant 1.128 used to turn the average moving range into σ |
| DESADV | EDI dispatch advice ("the goods are on the way") |
| Dispatching rule | Rule that chooses the next work order (FIFO, EDD, SPT, SETUP) |
| EDD | Earliest due date first |
| EDI / EDIFACT | Standard electronic business messages (ORDERS, DESADV, INVOIC) |
| FAD | Free air delivery: the air flow of the compressor (m³/h) |
| FG | Finished goods |
| FIFO | First in, first out |
| FPY | First-pass yield: share of units passing the test the first time |
| Genealogy | Record of which component lots are in one serial unit |
| GS1-128 | Barcode standard with Application Identifiers, e.g. (10) = lot |
| I-MR chart | Individuals and moving range chart (one value per unit) |
| ISA-95 / IEC 62264 | Standard for the integration of enterprise and control systems (levels 0–4) |
| LCL / UCL | Lower / upper control limit (from the process, ±3σ) |
| Lead time | Time from purchase order to delivery |
| Lot | Group of parts with the same origin |
| Lot size | Fixed order quantity or multiple (e.g. 120 castings) |
| LSL | Lower specification limit (from the customer, e.g. 97 % of nominal flow) |
| MES | Manufacturing Execution System (ISA-95 level 3) |
| MRP | Material Requirements Planning |
| MTBF / MTTR | Mean time between failures / mean time to repair |
| MTO | Make-to-order |
| NCR | Non-conformance record |
| Net requirement | gross + safety stock − on hand − on order |
| OPC UA | Industrial communication standard between MES/SCADA and PLCs |
| OTD | On-time delivery |
| Pegging | Reserving production/stock for one customer order |
| PO / SO / WO / MWO | Purchase / sales / work / maintenance work order |
| Routing | Sequence of operations and stations for a part |
| Safety stock | Extra stock kept against delays and demand peaks |
| Serial number | Unique number of one unit (e.g. VC20-000012) |
| SPC | Statistical process control |
| SPT | Shortest processing time first |
| Standard cost | Planned cost per unit: material + conversion + energy |
| WIP | Work in progress: units started but not finished |
| AI (Application Identifier) | GS1 number in brackets that says what the following data is, e.g. (21) = serial |
| EOQ | Economic order quantity √(2DS/H) |
| GTIN / SSCC | GS1 number of a trade item / of a logistic unit (pallet), both with a mod-10 check digit |
| ISO week (YYWW) | Week number per ISO 8601, weeks start Monday; used in serial, lot and order numbers |
| L4L | Lot-for-lot: order exactly the net requirement |
| Little's law | WIP = throughput × flow time |
| Ppk | Like Cpk, but with the overall (long-term) standard deviation |
| ROP | Reorder point = demand during lead time + safety stock |
