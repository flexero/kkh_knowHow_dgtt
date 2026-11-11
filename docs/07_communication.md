# 07 – Communication: How All Layers of the Factory Talk

> **All numbers, names, addresses, ports, order numbers and prices in this guide are example values.**
> They come from the digital twin. In the real factory you replace them with the values from your own
> suppliers, your own network plan and your own interface specifications.

---

## 1. Purpose

A smart factory is many computers and controllers that must work together:

* the **customer's** purchasing system and the **supplier's** sales system,
* the **ERP** (business planning),
* the **MES** (manufacturing operations),
* **SCADA**, the HMIs, the historian, the AGV fleet manager and the digital twin,
* **PLCs**, **CNC controls**, robot controllers and AGV controllers,
* **sensors and actuators** on the machines.

Each of these systems has its own "language" (protocol). This guide explains:

1. **Who talks to whom** (the ISA-95 layers, also called the automation pyramid).
2. **Which protocol** is typical on each link, and **why**.
3. **What a real message looks like**, line by line, with its grammar.
4. **How to build the communication in the real factory**: network zones, security, OPC UA
   information model, MQTT topic scheme, VDA 5050 for AGVs, time synchronisation, IT/OT
   responsibilities, and how to test every interface before production starts.

Why this matters: most problems in new smart factories are **not** in the machines. They are in the
interfaces: a missing confirmation, a wrong unit (mm or µm?), a different time stamp, a firewall rule
nobody asked for, or two systems that both think they are the "master" of the work order.
If you plan the communication early, with a written interface specification for every link, you avoid
most of these problems.

---

## 2. Where in the twin

Open the twin (`python server.py`, then `http://localhost:8080`) and click the tab **Communication**.
At the top there is a switch with 4 views:

| View (button) | What it shows | Source file | Deep link |
|---|---|---|---|
| **Step-by-step simulation** | One customer order (23 × VC20-300) in 20 animated steps, with the real message text of every step | `web/commsim.js` | `/?csstep=13#comm` (opens step 13) |
| **Protocols by layer** | The 5 communication types and, for every pair of neighbour layers, 3–4 typical protocols with an example message | `web/commproto.js` | `/?cmmode=proto#comm` (`&cpopen=1` opens all examples) |
| **SCADA explained** | What SCADA is and a small working SCADA screen on live twin data | `web/scada.js` | `/?cmmode=scada#comm` |
| **Live monitor** | The ISA-95 layers with live message counts, the 14-step workflow as a swimlane, and a live message log of the running twin | `twin/comm.py` + `web/comm.js` | `/?cmmode=live#comm` |

The browser remembers the last view you used (in `localStorage`, only on your PC).

Server API for the live monitor:

```
GET /api/comm            -> layers, links, 14 steps with counts, last 80 log messages
GET /api/comm?since=120  -> only log messages with id > 120
```

> **Important (what-if):** The **what-if simulation** makes copies of the factory and runs them very fast.
> These copies have **no message bus**. The function `comm.send(...)` checks this and does nothing
> (a "no-op") when the factory has no bus. So what-if runs never appear in the live monitor, and they do
> not slow down because of message logging.

---

## 3. Concepts, simply

### 3.1 The layers (ISA-95 / automation pyramid)

ISA-95 (also published as IEC 62264) is the standard that describes the levels of a factory and the
information that flows between business systems and manufacturing systems. The twin uses these 6 layers:

| Layer id | Level | Systems | Typical time scale | In this twin |
|---|---|---|---|---|
| EXT | Outside | customer purchasing, supplier sales, carriers, banks | days | Order flow form, ERP tab (simulated customers and suppliers) |
| L4 | Level 4 | **ERP**: sales orders, MRP, purchasing, inventory, cost, invoices | days / hours | `twin/erp.py` – ERP tab |
| L3 | Level 3 | **MES**: work orders, dispatching rule, serial numbers, quality (SPC), maintenance, WMS | hours / minutes | `twin/mes.py` – MES, FMS and Order flow tabs |
| L2 | Level 2 | **SCADA / HMI / historian / digital twin**, AGV fleet manager, AS/RS control | seconds | Live factory tab, `data/history.db`, `twin/analytics.py` |
| L1 | Level 1 | **Control**: PLC, CNC, robot and AGV controllers | milliseconds | `twin/model.py` (simulated) or a real gateway → `POST /api/ingest` |
| L0 | Level 0 | **Field**: sensors and actuators (vibration, temperature, power meter, flow meter, motors, valves, barcode/RFID) | micro- to milliseconds | simulated signals in `twin/model.py` |

**Simple rule:** orders and commands go **down**; results, data and alarms go **up**.

```
customer --EDI--> ERP --B2MML--> MES --OPC UA--> PLC/CNC --IO-Link--> sensors
                     <--------------- confirmations, results, alarms ---------------
```

**Why layers?** Each layer works in a different time scale. The ERP plans in days; a PLC reacts in
milliseconds. If you connect the ERP directly to a PLC, the ERP must understand machine details and the
PLC must understand business documents. Layers keep each system simple and replaceable.

### 3.2 The 5 communication types

Every protocol in the factory belongs to one of these 5 types (from `web/commproto.js`):

| Type | How it works | Like … | Typical use |
|---|---|---|---|
| ⇄ **Request / response** | A client asks, the server answers. One question, one answer. | a phone call | read a value, start a job, ask for stock |
| ◎ **Publish / subscribe** | The sender publishes to a topic on a broker. Everybody who subscribed gets it. | a radio station | status, events, data that many systems need |
| ▤ **Document exchange** | A complete business document is sent at once and answered later. | a letter | orders, invoices, work orders (between companies, ERP ↔ MES) |
| ⟳ **Cyclic real-time I/O** | Small fixed data frames are exchanged in a strict cycle (every 0.25–10 ms), even if nothing changes. | a heartbeat | servo drives, remote I/O, valve islands, safety |
| ∿ **Signal on a wire** | The value is a current, a voltage or a simple serial line. No network address. | a thermometer | sensors and actuators on PLC input/output cards |

### 3.3 Every message has a grammar

The twin colours every example message with the same 6 colours. Learn them once and you can read
EDIFACT, XML, OPC UA, JSON and G-code in the same way:

| Colour class | Meaning | Example |
|---|---|---|
| **envelope / header** (`e`) | who sends, to whom, when, message number | `UNB+UNOC:3+DELTA001:ZZ+VCFACTORY:ZZ+...`, `<ApplicationArea>`, MQTT topic header |
| **verb** (`v`) | what to do | `ORDERS`, `Process`, `Call`, `POST`, `order`, `G81` |
| **object / field names** (`n`) | which thing, which field | `BGM`, `<MaterialDefinitionID>`, `ns=2;s=LOAD-CC.Orders`, `"nodes"` |
| **data values** (`d`) | the actual values | `PO-88231`, `VC20-300`, `23` |
| **answer / status / result** (`a`) | the reply | `StatusCode Good`, `201 Created`, `actionCode="Accepted"`, `PASS` |
| **comment** (`c`) | explanation only, **not sent** | `← 220 = order` |

**Key idea:** nearly every protocol is "**envelope + verb + noun + data**", and every request needs an
**answer**. If you remember this, a new protocol is not frightening.

### 3.4 The protocols in one sentence each

| Protocol | One sentence | Layer link |
|---|---|---|
| **EDI – EDIFACT / ANSI X12** | Strict text documents between companies (order, confirmation, delivery note, invoice). | EXT ↔ L4 |
| **ISA-95 B2MML** | XML (or JSON) messages with the ISA-95 vocabulary, grammar = VERB + NOUN. | L4 ↔ L3 |
| **REST** | HTTP method (verb) + URL (noun) + JSON body; answer = HTTP status code. | many links |
| **OPC UA** | Typed, secure client/server (and pub/sub) protocol for machines: read, write, call methods, subscribe, alarms. | L3 ↔ L2 ↔ L1 |
| **MQTT** | Light publish/subscribe through a broker; topics form a tree. | L2 ↔ L1, plant ↔ cloud |
| **Sparkplug B** | Rules on top of MQTT: fixed topic structure, birth/death messages, binary payload. | L2 ↔ L1 |
| **VDA 5050** | JSON messages over MQTT between the AGV fleet manager and the AGVs. | L2 ↔ AGVs |
| **MTConnect** | Read-only XML over HTTP for CNC machine data. | L2 ↔ CNC |
| **PROFINET / EtherCAT / EtherNet/IP** | Industrial Ethernet for cyclic real-time I/O. | L1 ↔ L0, L1 ↔ L1 |
| **IO-Link** | Point-to-point digital link to smart sensors on a 3-wire M12 cable. | L1 ↔ L0 |
| **4–20 mA** | Analog current signal; 4 mA = range start, 20 mA = range end. | L1 ↔ L0 |
| **G-code (ISO 6983)** | The language of the NC program inside the CNC (see guide 08). | file sent L3 → L1 |
| **GS1-128 barcode** | Label with Application Identifiers: (01) product GTIN, (10) lot, (21) serial; on pallets (00) SSCC, (02) contained GTIN, (37) count. | L0 → L3 |
| **ISO 20022 (camt.054)** | Bank XML: "money arrived on your account". | EXT → L4 |

---

## 4. The model in the twin, with example messages

### 4.1 Live monitor (`twin/comm.py` + `web/comm.js`)

**What it is.** The twin itself moves data with Python function calls and HTTP JSON. The module
`twin/comm.py` **records** every important event as the message it **would be** in a real factory, with the
protocol a real factory would typically use. This lets you see the real information flow of the running
factory.

**How it works.**

1. When the live engine starts, it creates one `Bus` object: `self.factory.bus = comm.Bus(self.factory)`.
2. Wherever something happens (a sales order arrives, the MES releases an order, an AGV gets a job …), the
   code calls `comm.send(factory, step_number, text, payload)`.
3. The bus:
   * increases the counter of that workflow step,
   * counts the message on **every link it crosses** (for example, MES L3 → PLC L1 crosses the links L3–L2
     and L2–L1), as "down" (towards the field) or "up" (towards the business),
   * stores it in a log (the last 300 messages; the browser shows the newest 80).
4. The browser asks `GET /api/comm` once per second while the Live monitor view is visible, and moves
   small dots along the links when the counters grow.

**Sensor data (step 10) is special.** Every sample period the engine sends "N machines × 4 signals →
historian". This is **counted** (4 × number of machines) but **not written to the log** one by one,
otherwise the log would be full of sensor values. Data from a **real gateway** (`POST /api/ingest`) is
logged as "Gateway data from …" with the full JSON.

**The 14 workflow steps** (from `STEPS` in `twin/comm.py`):

| # | From → to | Message | Typical protocol | What happens | Where in the twin code |
|---|---|---|---|---|---|
| 1 | EXT → L4 | Customer order | EDI ORDERS or web portal (REST) | ERP creates a sales order: customer, model, quantity, due date | `POST /api/erp {action: create_so}` |
| 2 | L4 → L4 | MRP run | inside the ERP | net = demand + safety stock − free stock − open work orders → new work orders and purchase orders | `erp.run_mrp()` every hour or "Run MRP now" |
| 3 | L4 → EXT | Purchase order | EDI ORDERS or supplier portal | material needed during the supplier lead time is ordered | `erp.create_po()` |
| 4 | EXT → L4 | Delivery and goods receipt | EDI DESADV + barcode / RFID scan | supplier delivers; lot number booked; AS/RS crane stores | `erp._receive()` → `handling.receive()` |
| 5 | L4 → L3 | Work order | ISA-95 B2MML ProductionSchedule | ERP tells MES what to make: model, quantity, due date | `mes.create_wo()` |
| 6 | L3 → L1 | Release and recipe | OPC UA method call (through SCADA) | dispatching rule (FIFO / EDD / SPT / SETUP) picks the order | `mes.wo_action(release)` |
| 7 | L3 → L1 | Transport order | VDA 5050 over MQTT (AGV fleet manager) | kanban signal: rack has room → AGV gets pick-up/drop-off order | `handling._assign()` |
| 8 | L1 → L3 | Unit started, serial number | OPC UA (PLC → MES) | load station clamps a casting, marks the serial number | `mes._on_start()` |
| 9 | L3 → L1 | Changeover / NC program | OPC UA file transfer or MTConnect | new model: CNC program, jaws, test limits or tool set change | `machine._changeover()` → state SETUP |
| 10 | L0 → L2 | Sensor data | IO-Link / 4–20 mA → PLC → OPC UA or MQTT | temperature, vibration, power, state of every machine, every `history_interval_s` (15 s in the example config; code default 10 s) | `engine._sample()` / `POST /api/ingest` |
| 11 | L1 → L3 | Test result | OPC UA or MQTT JSON | test bench sends measured air flow; MES checks spec, updates SPC | `mes._on_test()` |
| 12 | L1 → L3 | Alarm → maintenance order | OPC UA Alarms & Conditions | breakdown (PLC alarm) or rising vibration trend creates a maintenance order | `mes._new_mwo()` |
| 13 | L3 → L4 | Production confirmation | ISA-95 B2MML ProductionPerformance | each finished unit reported; ERP books finished-goods stock | `mes._on_fg()` |
| 14 | L4 → EXT | Shipment and invoice | EDI DESADV + INVOIC | AS/RS picks the units, truck leaves, customer gets delivery note + invoice | `erp._shipped()` |

Two details from the code:

* Step 5 comes from **L3** (not L4) when a planner types the work order directly into the MES
  (source "Manual").
* Step 12 starts at **L1** for a breakdown (corrective, severity 800) and at **L2** for a predictive
  order created by twin analytics (severity 500).

**Example payloads recorded by the live twin** (real structure from the code; values are examples):

Step 1 – customer order (`twin/erp.py`):
```json
{"EDI": "ORDERS", "BGM": "SO-0006", "NAD_BY": "Delta Compressors", "LIN": "VC20-300",
 "QTY": 23, "DTM_due_in_h": 48.0, "PRI_usd": 1450}
```

Step 6 – release to the load station (`twin/mes.py`):
```json
{"method": "StartOrder", "node": "ns=2;s=LOAD-CC.Orders", "order": "WO-0012",
 "material": "VC20-300", "recipe": "VC20_v1", "qty": 23, "rule": "EDD"}
```

Step 7 – AGV transport order (`twin/handling.py`):
```json
{"vda5050": "order", "serialNumber": "AGV-02", "orderId": "T00146",
 "nodes": ["<source store>", "<destination buffer>"], "load": {"type": "...", "qty": 1}, "battery_pct": 78}
```
(The node names are the names of the source and destination stores/buffers in `config/factory.json`.)

Step 9 – changeover (`twin/model.py`):
```json
{"machine": "HMC-02", "program": "OHMC02_VC20.nc", "from_model": "VC30", "to_model": "VC20",
 "setup_s": 600, "tools_loaded": ["VC20", "VC30"]}
```

Step 10 – sensor sample (`twin/engine.py`):
```json
{"topic": "plant/HMC-01/telemetry", "state": "RUNNING", "temp_c": 61.2,
 "vib_mm_s": 2.31, "power_kw": 17.4, "t": 36000}
```

Step 11 – test result (`twin/mes.py`):
```json
{"topic": "plant/TEST-01/test", "serial": "VC20-000112", "model": "VC20",
 "fad_m3_h": 20.31, "lsl_m3_h": 19.4, "result": "PASS"}
```

Step 12 – alarm → maintenance order:
```json
{"alarm": {"source": "HMC-02", "severity": 500, "message": "...", "condition": "RUNNING"},
 "maintenance_order": "MWO-0004", "type": "PREDICTIVE"}
```

Step 13 – production confirmation (one unit):
```json
{"ProductionPerformance": {"Order": "WO-0012", "Serial": "VC20-000112", "Material": "VC20-300",
                           "Qty": 1, "Location": "..."}}
```

**How to use the live monitor.**

1. Start the twin and let it run (or increase the time scale).
2. Open Communication → **Live monitor**.
3. Look at the layer stack: each link shows ↓ (down) and ↑ (up) counters and messages per hour.
4. Click a row of the **workflow swimlane**: the detail panel shows "What happens", "In this twin" and the
   latest real message with its JSON payload.
5. In the **message log**, filter by step, pause the log, and click a row to see that exact message.
6. If step 4 shows "not yet": suppliers need 12–20 h (example lead times). Run the factory faster or use
   *Deliver now* in the Order flow tab.

**Formula for the rates shown:**

```
messages per hour = count / simulated time [s] × 3600
example: 46 work-order releases after 10 h simulated time → 46 / 36 000 × 3600 = 4.6 per hour
```

### 4.2 Step-by-step simulation (`web/commsim.js`)

**What it is.** A teaching animation of **one** customer order: Delta Compressors orders **23 × VC20-300**.
The upper part of the picture is the **information world** (envelopes fly between Customer, Supplier, ERP,
MES, AGV fleet manager, SCADA and 6 controllers). The lower part is the **physical world** (truck, AS/RS
crane, AGV, conveyor, the part moving through load station → HMC-02 → assembly → test bench →
finished-goods AS/RS).

Controls: **▶ Play / ⏸ Pause**, **Next ▶**, **◀ Back**, **Replay** (this step), **Restart**, speed.
Click any step number to jump to it. An envelope ✉ is a message; ↩ is an answer. The envelope colour is the
protocol family:

| Colour family | Protocols |
|---|---|
| purple | EDI / EDIFACT (business documents) |
| blue | ISA-95 B2MML / REST (ERP ↔ MES) |
| teal | OPC UA (MES/SCADA ↔ PLC, CNC) |
| pink | MQTT publish / subscribe |
| brown | VDA 5050 (AGV over MQTT) |
| grey | Field: 4–20 mA, IO-Link, barcode |

A progress bar shows the order stage: Order › Planning › Material › Released › Production › Tested ›
In stock › Shipped › Paid.

**The 20 steps:**

| # | Step | From → to | Protocol |
|---|---|---|---|
| 1 | Customer sends a purchase order | Customer → ERP | EDIFACT ORDERS |
| 2 | ERP confirms the order | ERP → Customer | EDIFACT ORDRSP |
| 3 | MRP calculates what to make and what to buy | inside ERP | calculation, not a message |
| 4 | ERP sends a purchase order to the supplier | ERP → Supplier | EDIFACT ORDERS |
| 5 | Supplier announces the delivery, truck arrives | Supplier → ERP | EDIFACT DESADV |
| 6 | Goods receipt: scan, book, store | scanner → MES → ERP; MES → AS/RS PLC | GS1-128 barcode + OPC UA Call |
| 7 | ERP sends the work order to the MES | ERP → MES | B2MML ProcessProductionSchedule |
| 8 | MES acknowledges the work order | MES → ERP | B2MML AcknowledgeProductionSchedule |
| 9 | MES releases the order to the load station | MES → PLC load station | OPC UA Call + response |
| 10 | AGV brings castings to the load station | MES → fleet manager → AGV | VDA 5050 order (JSON over MQTT) |
| 11 | Unit started: serial number marked and reported | PLC load → MES | OPC UA DataChangeNotification |
| 12 | Changeover: new NC program for the machining center | MES → CNC | OPC UA FileTransfer + G-code |
| 13 | Machining: sensor data flows up all the time | sensor → CNC → SCADA | 4–20 mA + IO-Link + MQTT |
| 14 | Alarm: vibration too high → maintenance order | CNC → SCADA → MES | OPC UA Alarms & Conditions |
| 15 | Assembly: which parts went into this compressor? | PLC assembly → MES | OPC UA DataChange (components consumed) |
| 16 | Performance test: result to the MES | test PLC → MES | MQTT publish (JSON) |
| 17 | Packed and stored: production confirmation to ERP | MES → ERP | B2MML ProcessProductionPerformance |
| 18 | Shipping: ERP orders the delivery, crane picks | ERP → MES; MES → AS/RS PLC | REST + OPC UA Call |
| 19 | Delivery note and invoice to the customer | ERP → Customer | EDIFACT DESADV + INVOIC |
| 20 | Customer confirms receipt and pays | Customer → ERP | EDIFACT RECADV + ISO 20022 camt.054 |

In total, one customer order needs **about 30 messages in 6 protocol families**, from EDI between
companies down to 4–20 mA on a wire, and back up.

Below are the most important messages, copied from the code. Comments after `←` are **not sent**.

#### Step 1 – EDIFACT ORDERS (customer → our ERP)

```
UNB+UNOC:3+DELTA001:ZZ+VCFACTORY:ZZ+261109:0815+000123'   ← envelope: from, to, date, number
UNH+1+ORDERS:D:96A:UN'                                     ← message type = the verb
BGM+220+PO-88231+9'                                        ← 220 = order, 9 = original
DTM+2:20261111:102'                                        ← 2 = delivery date wanted
NAD+BY+DELTA001::92'                                       ← BY = buyer
LIN+1++VC20-300:SA'                                        ← line 1: article
QTY+21:23'                                                 ← 21 = ordered quantity
PRI+AAA:1450'                                              ← price per unit
UNT+8+1'                                                   ← end: 8 segments
UNZ+1+000123'
```

How to read it:
* Each line is a **segment** (one sentence). It ends with `'`.
* `+` separates the data elements (words); `:` separates parts of one element.
* The first 3 letters say what the segment is about: `BGM` document, `NAD` name/address, `QTY` quantity.
* Codes such as `220`, `21`, `BY` come from the UN/EDIFACT code lists, so every computer reads them the same way.
* Result in the twin: ERP creates sales order **SO-0006: 23 × VC20-300, due 11 Nov**.

#### Step 2 – EDIFACT ORDRSP (our answer)

```
UNH+1+ORDRSP:D:96A:UN'
BGM+231+SO-0006+29'          ← 29 = accepted without change
RFF+ON:PO-88231'             ← answers the customer's order
DTM+2:20261111:102'          ← we promise this date
LIN+1++VC20-300:SA'
QTY+21:23'
UNT+7+1'
```

**Why:** every request needs an answer. `RFF+ON` repeats the customer's own order number, so their
computer can match the answer.

#### Step 3 – MRP (a calculation inside the ERP)

```
Make-to-order: work order quantity = 23 × VC20-300

Material CC20-CAST (1 casting per compressor)
net = need + safety − on hand − on order
    = 23   + 20     − 15      − 0        = 28
→ purchase order, rounded up to the supplier lot size = 60
```

#### Step 5 – EDIFACT DESADV (supplier: "the truck is coming")

```
UNH+1+DESADV:D:96A:UN'
BGM+351+DN-55120+9'
RFF+ON:PO-0009'                 ← our purchase order number
DTM+17:202611100600:203'        ← arrives 10 Nov 06:00 (format 203 = date + time)
LIN+1++CC20-CAST:BP'
QTY+12:60'                      ← 12 = despatched quantity
GIN+BX+FA-L0009'                ← lot (batch) number – key for traceability
UNT+8+1'
```

#### Step 6 – Goods receipt: barcode + OPC UA method call

```
Pallet label, read by the scanner:
(02)04012345000017 (10)FA-L0009 (37)60
(02) = product GTIN   (10) = lot   (37) = quantity

MES/WMS → AS/RS PLC, through SCADA (OPC UA):
Call ns=2;s=ASRS-RAW.Store ( "FA-L0009", "CC20-CAST", 60 )
→ StatusCode Good · slot R04-C2
```

> **Correction (teaching view in `web/commsim.js` not changed):** the check digit of `0401234500001?` is
> **6**, not 7 → valid GTIN `04012345000016` (calculation: guide 04, 12.7). And in GS1 rules (02) =
> "GTIN of the items contained in a logistic unit" and (37) = "count" belong on a pallet label together
> with (00) SSCC, e.g. `(00)095212345000000773(02)09521234000204(37)60(10)FA-L0009` (GS1 demo prefix 952,
> never on real labels). Our own lot number would be `LOT-CC20-2646-003` (doc 15).

#### Step 7 – B2MML ProcessProductionSchedule (ERP → MES, shortened)

```xml
<ProcessProductionSchedule xmlns="http://www.mesa.org/xml/B2MML">
 <ApplicationArea>
   <Sender><LogicalID>ERP</LogicalID></Sender>
   <CreationDateTime>2026-11-09T08:20:00Z</CreationDateTime>
 </ApplicationArea>
 <DataArea>
   <Process/>                                   <!-- verb -->
   <ProductionSchedule><ProductionRequest>      <!-- noun -->
     <ID>WO-0012</ID>
     <Priority>3</Priority>
     <EndTime>2026-11-11T08:00:00Z</EndTime>
     <MaterialProducedRequirement>
       <MaterialDefinitionID>VC20-300</MaterialDefinitionID>
       <Quantity>23</Quantity>
     </MaterialProducedRequirement>
   </ProductionRequest></ProductionSchedule>
 </DataArea>
</ProcessProductionSchedule>
```

* Grammar = **verb + noun**: verb `Process` (do it), noun `ProductionSchedule`.
* `ApplicationArea` = envelope (who, when). `DataArea` = verb + noun + data.
* The ERP says **WHAT** and **WHEN**. **HOW** (route, machines, programs) is the MES's job.
* The message passes the firewall/DMZ between office network and plant network.

#### Step 8 – B2MML AcknowledgeProductionSchedule (MES → ERP)

```xml
<AcknowledgeProductionSchedule>
 <ApplicationArea><Sender><LogicalID>MES</LogicalID></Sender></ApplicationArea>
 <DataArea>
   <Acknowledge>
     <ResponseCriteria><ResponseExpression actionCode="Accepted"/></ResponseCriteria>
   </Acknowledge>
   <ProductionSchedule><ProductionRequest><ID>WO-0012</ID></ProductionRequest></ProductionSchedule>
 </DataArea>
</AcknowledgeProductionSchedule>
```

`actionCode` = Accepted, Modified or Rejected. Without this answer, the ERP would send the order again or
raise an alarm.

#### Step 9 – OPC UA Call StartOrder (MES → PLC load station)

```
MES (OPC UA client) → PLC load station (OPC UA server)
CallRequest
  ObjectId : ns=2;s=LOAD-CC.Orders
  MethodId : ns=2;s=LOAD-CC.Orders.StartOrder
  InputArguments:
    [0] String  "WO-0012"      ← order
    [1] String  "VC20-300"     ← material
    [2] String  "VC20_v1"      ← recipe
    [3] UInt32  23             ← quantity
CallResponse
  StatusCode      : Good (0x00000000)
  OutputArguments : [0] UInt32 1   ← position in the queue
```

* **NodeId** grammar: `ns=2;s=LOAD-CC.Orders` = namespace 2, string identifier "LOAD-CC.Orders".
* OPC UA services are the verbs: `Read`, `Write`, `Browse`, `Call`, `Subscribe`.
* Arguments have **data types** (String, UInt32 …), so the PLC cannot read a number as text.
* Status codes: Good, Uncertain, or Bad_… (for example `Bad_InvalidState` if the station is in maintenance).
* The MES chose WO-0012 first because of the dispatching rule **EDD** (earliest due date).

#### Step 10 – VDA 5050 order (fleet manager → AGV, JSON over MQTT)

```
Topic: uagv/v2/AcmeAGV/AGV-02/order        ← address + verb
{ "headerId": 3412, "timestamp": "2026-11-09T09:02:11Z", "version": "2.0.0",
  "manufacturer": "AcmeAGV", "serialNumber": "AGV-02",
  "orderId": "T00146", "orderUpdateId": 0,
  "nodes": [
    { "nodeId": "ASRS-RAW-OUT", "sequenceId": 0, "released": true,
      "actions": [{ "actionType": "pick", "actionId": "a1", "blockingType": "HARD" }] },
    { "nodeId": "LOAD-IN", "sequenceId": 2, "released": true,
      "actions": [{ "actionType": "drop", "actionId": "a2", "blockingType": "HARD" }] } ],
  "edges": [{ "edgeId": "e1", "sequenceId": 1, "released": true,
              "startNodeId": "ASRS-RAW-OUT", "endNodeId": "LOAD-IN" }] }

AGV → fleet manager, topic .../AGV-02/state:
{ "orderId": "T00146", "actionStates": [{ "actionId": "a2", "actionStatus": "FINISHED" }],
  "batteryState": { "batteryCharge": 78 } }
```

* Topic grammar: `interface / version / manufacturer / serial number / topic`. The last word is the verb:
  `order`, `state`, `instantActions`.
* An order is a path of **nodes** (even sequenceId 0, 2, 4 …) and **edges** (odd 1, 3 …).
* Actions at nodes: `pick`, `drop`. The AGV reports progress on its `state` topic.

#### Step 11 – OPC UA subscription: unit started

```
once, at start-up:
CreateMonitoredItems  ns=2;s=LOAD-CC.UnitStarted   SamplingInterval = 100 ms

PLC → MES, only when the value changes:
DataChangeNotification
  SequenceNumber  : 5821
  Value           : { "serial": "VC20-000112", "order": "WO-0012", "casting_lot": "FA-L0009" }
  StatusCode      : Good
  SourceTimestamp : 2026-11-09T09:14:37.120Z
```

* The MES **subscribes once**; the PLC sends **only when the value changes**: no polling, little network load.
* `SequenceNumber` lets the MES detect a lost message.
* `SourceTimestamp` = when it happened in the machine (not when it arrived).
* Result: the MES links serial ↔ work order ↔ customer order ↔ casting lot (traceability).

#### Step 12 – Changeover: NC program by OPC UA file transfer

```
MES → CNC (OPC UA FileType methods)
Call Open( mode = Write )                           → fileHandle 7
Call Write( fileHandle 7, data = <O1020_VC20.nc> )
Call Close( fileHandle 7 )
Write ns=2;s=HMC-02.ActiveProgram = "O1020"         → Good

First lines of the NC program:
O1020 (VC20 CRANKCASE OP10)
N10 G90 G54              ← absolute, work offset 1
N20 T12 M06              ← change to tool 12
N30 S1800 M03            ← spindle 1800 rpm, clockwise
N40 G81 Z-42 R2 F240     ← drilling cycle, depth 42 mm
```

HMC-02 shows state **SETUP** for about 10 min (example) while program and tools change.
G-code is explained in detail in guide `08_cnc_gcode.md`.

#### Step 13 – Sensor data: 4–20 mA, IO-Link, MQTT

```
(1) vibration sensor → controller, 4–20 mA, range 0–50 mm/s
value = min + (I − 4) / 16 × (max − min)
I = 4.77 mA  →  0 + (0.77 / 16) × 50 = 2.4 mm/s
I < 3.6 mA   →  wire broken

(2) temperature sensor → controller, IO-Link, 0.1 °C per bit
process data 0x02 0x9A = 666  →  66.6 °C

(3) controller → SCADA / twin, MQTT publish every 10 s
Topic: vcfactory/plant1/machining/fms/HMC-02/telemetry   QoS 1
{ "ts": "2026-11-09T09:20:00Z", "state": "RUN", "temp_c": 66.6,
  "vib_mm_s": 2.4, "power_kw": 14.8 }
broker → controller: PUBACK
```

* **4–20 mA:** the scale starts at 4 mA, so 0 mA means "wire broken". This is called a "live zero".
* **IO-Link:** digital bytes; the sensor's **IODD** file (device description) says what each byte means.
  `0x029A` hex = 2 × 256 + 154 = 666 → × 0.1 °C = 66.6 °C.
* **MQTT topic** = a tree `company/site/area/line/machine/...` (Unified Namespace). Anyone may subscribe:
  twin, historian, dashboard.
* **QoS 1** = delivered at least once (the broker answers PUBACK).

#### Step 14 – OPC UA Alarms & Conditions

```
EventNotification                              controller → SCADA → MES
  EventType   : OffNormalAlarmType
  SourceName  : HMC-02
  Severity    : 600                            ← 1 … 1000
  Message     : "Spindle vibration 7.3 mm/s > limit 7.1"
  ActiveState : TRUE
  AckedState  : FALSE

operator on the HMI:
Call Acknowledge( EventId, "bearing check planned" )   → AckedState = TRUE

MES: new maintenance order MWO-0004 (predictive)
```

Two separate states: `ActiveState` (is the problem still there?) and `AckedState` (has a person seen it?).
The limit 7.1 mm/s is the example `vibration_alarm_mm_s` of the HMCs in `config/factory.json`.

#### Step 15 – Components consumed (genealogy)

```
assembly PLC → MES
DataChangeNotification  ns=2;s=ASSY-01.Consumed
{ "serial": "VC20-000112",
  "components": [
     { "part": "CYL-CAST", "lot": "CY-L0201", "qty": 2 },
     { "part": "CS-FORG",  "lot": "CS-L0107", "qty": 1 } ] }
StatusCode : Good
```

If a cylinder lot is found bad later, the MES lists every compressor that contains it, in seconds.

#### Step 16 – Test result by MQTT

```
Topic: vcfactory/plant1/test/TEST-01/result   QoS 1
{ "serial": "VC20-000112", "model": "VC20",
  "fad_m3_h": 20.31, "lsl_m3_h": 19.40, "pressure_bar": 8.0,
  "result": "PASS", "ts": "2026-11-09T13:42:05Z" }
```

MES rule: PASS if FAD ≥ LSL. LSL = 97 % of nominal = 0.97 × 20 = **19.40 m³/h**. 20.31 ≥ 19.40 → PASS.
The value also goes into the SPC chart (UCL / LCL, Cpk).

#### Step 17 – B2MML ProcessProductionPerformance (MES → ERP, shortened)

```xml
<ProcessProductionPerformance>
 <DataArea>  <Process/>
  <ProductionResponse><ID>WO-0012</ID>
   <MaterialProducedActual>
     <MaterialDefinitionID>VC20-300</MaterialDefinitionID>
     <MaterialLotID>VC20-000112</MaterialLotID>        <!-- serial number -->
     <Quantity>1</Quantity>
     <StorageLocation>ASRS-FG</StorageLocation>
   </MaterialProducedActual>
   <MaterialConsumedActual>
     <MaterialDefinitionID>CC20-CAST</MaterialDefinitionID>
     <MaterialLotID>FA-L0009</MaterialLotID>
   </MaterialConsumedActual>
  </ProductionResponse>
 </DataArea>
</ProcessProductionPerformance>
```

ERP result: finished stock +1, casting stock −1 (backflush), cost booked. The other 22 units repeat steps 10–17.

#### Step 18 – REST + OPC UA (shipping)

```
ERP → MES/WMS (REST, JSON)
POST /api/deliveries
{ "delivery": "DN-0042", "order": "SO-0006", "sku": "VC20-300", "qty": 23, "dock": "OUT-1" }
→ 201 Created

MES/WMS → AS/RS PLC (OPC UA), once per unit:
Call ns=2;s=ASRS-FG.Retrieve( "VC20-000112", "OUT-1" )   → Good
```

REST grammar: method (verb) + URL (noun) + JSON body. `POST` = create, `GET` = read, `PUT` = change,
`DELETE` = remove. Answers: 2xx OK (201 = created), 4xx = error in the request, 5xx = server error.

#### Step 19 – DESADV + INVOIC (to the customer)

```
UNH+2+INVOIC:D:96A:UN'
BGM+380+INV-2026-0006+9'        ← 380 = commercial invoice
RFF+ON:PO-88231'                ← always the customer's own order number
LIN+1++VC20-300:SA'
QTY+47:23'                      ← 47 = invoiced quantity
PRI+AAA:1450'
MOA+77:33350'                   ← invoice amount = 23 × 1450
UNT+8+2'
```

The DESADV carries all serial numbers in `GIN+BN+VC20-000112+VC20-000113'` …

#### Step 20 – RECADV + bank camt.054 (loop closed)

```
UNH+1+RECADV:D:96A:UN'
BGM+632+GR-7781+9'
RFF+AAK:DN-0042'           ← our delivery note
LIN+1++VC20-300:SA'
QTY+48:23'                 ← 48 = received quantity
UNT+6+1'

Bank → ERP (camt.054, shortened):
<BkToCstmrDbtCdtNtfctn>
  <Amt Ccy="USD">33350.00</Amt> <CdtDbtInd>CRDT</CdtDbtInd>
  <Ustrd>INV-2026-0006</Ustrd>
</BkToCstmrDbtCdtNtfctn>
ERP: invoice paid → SO-0006 closed
```

### 4.3 Protocols by layer (`web/commproto.js`)

This view is a **reference card**. For each neighbour-layer link it shows 3–4 typical protocols with:
type, data format, transport/port, speed, use and an example message. The "main" protocol is marked.
Click a communication type at the top to highlight all protocols of that type.

| Link | Network (example) | Main protocol | Type | Speed | Other options |
|---|---|---|---|---|---|
| EXT ⇅ L4 | Internet, encrypted (TLS). Partners never reach the plant network. | EDI – EDIFACT / ANSI X12 (AS2 over HTTPS 443, SFTP or VAN) | document | minutes – hours | REST API (HTTPS 443, JSON); Bank ISO 20022 XML (EBICS or SFTP, daily) |
| L4 ⇅ L3 | Office IT network → firewall / DMZ → plant network | ISA-95 B2MML (HTTPS web service or message queue) | document | minutes | REST/SOAP (HTTPS 443); message queue AMQP (TCP 5672) / Kafka (TCP 9092) |
| L3 ⇅ L2 | Plant network (Ethernet), split into security zones (IEC 62443) | OPC UA client/server (TCP 4840, signed + encrypted) | request/response | 100 ms – 1 s | MQTT / Sparkplug B (1883, 8883 with TLS); SQL / historian API |
| L2 ⇅ L1 | Control network (industrial Ethernet); Wi-Fi or 5G for AGVs | OPC UA server inside PLC / CNC (TCP 4840) | request/response | 10 – 500 ms | MTConnect (HTTP, port 5000 typical, read-only); VDA 5050 over MQTT; S7 (TCP 102), EtherNet/IP CIP (44818), Modbus TCP (502) |
| L1 ⇅ L0 | Field cables and field buses | IO-Link (3-wire M12, point to point, 230 kbit/s, ≈ 2 ms cycle) | signal | ≈ 2 ms | 4–20 mA / 0–10 V; 24 V digital I/O (< 1 ms); PROFINET IO / EtherCAT (0.25–4 ms cycle) |

**Why these protocols?** (from the code):
* EXT–L4: different companies, different software → they need a strict, agreed document standard.
* L4–L3: ERP thinks in orders and days, MES in units and minutes. ISA-95 defines the common words.
* L3–L2: MES needs machine states and results within seconds and must send commands safely.
* L2–L1: every controller brand has its own protocol; OPC UA and MTConnect give one common view.
* L1–L0: sensors are simple and must be fast, cheap and robust.

**Selected example messages from this view:**

Message queue (AMQP / Kafka) between ERP and MES – messages are stored until the receiver is back online:
```
queue:   mes.workorders
message: { "verb": "Process", "wo": "WO-0012", "qty": 23 }
← ack (message removed from queue)
```

MQTT / Sparkplug B (Unified Namespace):
```
PUBLISH topic plant/line1/HMC-02/state
{ "state": "RUN", "serial": "VC20-000112", "oee": 0.82 }
QoS 1 = delivered at least once; retained = new subscribers get the last value
```

MTConnect (CNC, read-only):
```
GET /current
← <Execution>ACTIVE</Execution>
  <PartCount>112</PartCount>
  <SpindleSpeed>6000</SpindleSpeed>
```

Modbus TCP (older HMI / SCADA – you must know the register map):
```
Read Holding Register 40001   (Modbus function 03)
← 2350
register map: 40001 = air pressure × 100  →  23.50 bar
```

4–20 mA pressure transmitter:
```
value = min + (I − 4 mA) / 16 mA × (max − min)
I = 12 mA, range 0 … 10 bar  →  0 + (12 − 4)/16 × 10 = 5 bar
I < 3.6 mA = wire broken (that is why it starts at 4, not 0)
```

IO-Link vibration sensor:
```
process data 0x00 0x2D → 45
device description (IODD): value × 0.1 = mm/s  →  vibration 4.5 mm/s
```

PROFINET IO / EtherCAT (cyclic):
```
every 1 ms:
 PLC → drive  target position = 125.400 mm
 drive → PLC  actual position = 125.398 mm, status = OK
```

**Connections that skip a layer or stay inside one** (also in this view):

| Between | Title | Protocols | Note |
|---|---|---|---|
| L3 ⇄ L1 | MES directly to PLC / CNC | OPC UA, MTConnect | Modern plants often skip SCADA for orders and results; SCADA then only shows and alarms. |
| L1 ⇄ L1 | Machine to machine / robot handshake | PROFINET, EtherNet/IP; safety: PROFIsafe | "part ready" / "part taken"; safety signals use a safety protocol. |
| L0 ⇄ L1 | Identification: barcode and RFID | GS1-128, RFID (ISO 15693, UHF EPC) | Reader gives the text to the PLC (IO-Link or Ethernet). |
| L2 ⇄ EXT | Plant to cloud | MQTT over TLS (8883), HTTPS | Data goes **out only**, through the DMZ. The cloud never sends commands directly to machines. |
| L2 ⇄ L2 | Twin ↔ browser (this project) | HTTP JSON + Server-Sent Events | `/api/...` request/response, `/api/stream` pushes updates to the browser. |

### 4.4 SCADA explained (`web/scada.js`) – short

This view explains SCADA (Supervisory Control And Data Acquisition) as the **control-room software**:
the PLC controls the machine in milliseconds; SCADA watches all machines and supervises in seconds.
If SCADA stops, the machines keep running – you only become blind.

It shows the 5 jobs of SCADA (acquire, display, alarm, record, command), a line mimic, a machine
faceplate with tags and PLC addresses, an alarm list with an ISA-18.2 style life cycle, a trend, an animated
scan cycle, and **operator command previews** (the OPC UA Write / Call that would be sent – they are
**shown only, never sent**). A teaching switch adds simulated bearing damage on one machine.

Signal scaling used on the faceplate (example: temperature range 0–150 °C, Siemens-style analog card):

```
I   = 4 + 16 · (v − lo) / (hi − lo)          [mA]
raw = 27648 · (v − lo) / (hi − lo)           [PLC counts]

v = 66.6 °C:  I = 4 + 16 · 66.6/150 = 11.10 mA     raw = 27648 · 0.444 = 12 276
```

Everything about SCADA in detail (tags, alarm management, trends, audit trail, shift report) is in
guide **`06_scada.md`**.

---

## 5. Implementing in the real factory, step by step

This chapter is the main work for your team. Do the steps in this order.

### Step 1 – Make a list of all systems and all links

1. Write a **system list**: every computer, server, controller and smart device. For each: name, layer
   (EXT / L4 … L0), supplier, location, owner.
2. Draw the **link diagram** like the Live monitor: arrows between systems.
3. For each arrow write: what information, which direction, how often, how fast an answer is needed,
   what happens if the link is down.
4. Use the 14 workflow steps of the twin as a check list: every step must have a real link in your plan.

Example link list (shortened; example values):

| Link | Data | Direction | Rate | Max delay | If link down |
|---|---|---|---|---|---|
| ERP → MES | work orders | down | ~20 per day | 5 min | MES keeps working with released orders; queue stores new ones |
| MES → load station PLC | release, recipe | down | ~5 per hour | 2 s | operator cannot start new order; MES alarm |
| Load station PLC → MES | unit started, serial | up | ~1 per 6 min | 2 s | PLC buffers events (store-and-forward); MES catches up |
| CNC → historian | state, power, vibration | up | every 1–10 s | 10 s | gap in trend only |
| Test bench → MES | test result | up | 1 per unit | 5 s | **unit must not be released** without a result |
| Fleet manager ↔ AGV | VDA 5050 order/state | both | state ~1 s | 1 s | AGV stops at the next node |

### Step 2 – Design the network: levels, zones and conduits

Use the **zone and conduit** idea of **IEC 62443** (the standard series for security of industrial
automation and control systems):

* A **zone** = a group of systems with the same security needs (for example "FMS cell control").
* A **conduit** = the controlled path between two zones (a firewall with written rules).
* Traffic is allowed **only** through conduits, **only** with the protocols and ports in the rules.

Typical zone plan for this factory (example):

| Zone | Level | Systems | Example VLAN / subnet |
|---|---|---|---|
| Enterprise (office IT) | L4 | ERP, e-mail, office PCs | VLAN 10 – 10.10.0.0/16 |
| **DMZ** (between IT and OT) | "L3.5" | data replication server, ERP–MES gateway, patch server, remote-access jump host, historian mirror, time server | VLAN 20 – 10.20.0.0/24 |
| Plant operations | L3 | MES, WMS, MQTT broker, central historian | VLAN 30 – 10.30.0.0/24 |
| Supervisory | L2 | SCADA servers, HMI clients, AGV fleet manager, digital twin | VLAN 40 – 10.40.0.0/24 |
| Cell: FMS (load station, HMC-01…03, washer) | L1 | PLCs, CNCs | VLAN 51 – 10.51.0.0/24 |
| Cell: cylinder + crankshaft lines | L1 | PLCs, CNCs | VLAN 52 |
| Cell: assembly, robot, test benches | L1 | PLCs, robot controller, test PLCs | VLAN 53 |
| AS/RS | L1 | crane PLCs | VLAN 54 |
| AGV Wi-Fi | L1 | AGVs (own SSID) | VLAN 60 |
| Safety | L1/L0 | safety PLC network (if separate) | own network, no routing |

Example firewall (conduit) rules – **write them as a table and keep it under version control**:

| From zone | To zone | Protocol / port | Purpose |
|---|---|---|---|
| Enterprise | DMZ | HTTPS 443 | ERP → ERP–MES gateway (B2MML) |
| DMZ | Plant operations | HTTPS 443 or AMQP 5671 (TLS) | gateway → MES |
| Plant operations | Supervisory, cells | OPC UA 4840 | MES / SCADA → PLC, CNC |
| Cells | Plant operations | MQTT 8883 (TLS) | PLC / gateway → broker |
| Supervisory | AGV Wi-Fi | MQTT 8883 | fleet manager ↔ AGVs (VDA 5050) |
| Enterprise | Cells | **none** | office never talks directly to PLCs |
| Internet | any OT zone | **none** | remote service only via jump host in DMZ, with personal login, MFA, time limit, logging |

Rules to follow:

1. **No direct path from office IT or the internet to a PLC.** Everything passes the DMZ.
2. **Deny by default.** Open only what is in the table.
3. **One cell = one VLAN.** A virus or a broadcast storm stays in one cell.
4. **AGV Wi-Fi is its own zone.** Plan roaming and coverage (site survey) before the AGVs arrive.
5. **Cloud: data goes out only.** No commands from the cloud to machines.
6. **The twin** (this project has no login) belongs only in a trusted zone (Supervisory), never in the DMZ
   or the internet.

### Step 3 – Choose the protocol for each link

Use this decision table. It follows the twin; the choices are typical, not the only possible ones.

| Question | If yes, use … | Why |
|---|---|---|
| Between two companies? | EDI (EDIFACT / X12) via AS2 or a VAN; REST portal for small partners | strict, agreed documents; legal records |
| ERP ↔ MES business objects? | ISA-95 B2MML (XML/JSON) over HTTPS or a message queue | common vocabulary; queue = nothing lost during ERP updates |
| Command to a machine that needs a confirmed answer (start, release, write recipe)? | OPC UA method call / write | typed arguments, status code answer, security built in |
| Data that many systems need (state, counters, quality)? | MQTT (Unified Namespace) or OPC UA subscriptions | publish once, many readers; low load |
| CNC data, read-only, multi-brand? | OPC UA for Machine Tools or MTConnect | standard data model for CNCs |
| AGVs from one or several suppliers? | VDA 5050 over MQTT | one fleet manager for different AGV brands |
| Drive, servo, remote I/O, valve island? | PROFINET IO, EtherCAT or EtherNet/IP (follow your PLC brand) | deterministic cycle |
| Safety signals between machines? | PROFIsafe / FSoE / CIP Safety, or hard-wired safety | certified safety function |
| Smart sensor with diagnosis? | IO-Link | parameters + diagnosis + device name |
| Simple analog sensor? | 4–20 mA | robust, live zero detects wire break |

Practical rules:

* **Write the protocol AND the version** in the specification (for example "VDA 5050 2.0", "OPC UA
  1.04 or later", "EDIFACT D.96A").
* **Prefer one main protocol per layer link.** Every extra protocol is extra knowledge, extra gateways,
  extra failure points.
* For **old machines** without OPC UA: a gateway (PLC or industrial PC) reads the signals and publishes them
  (see README "Typical hardware paths": current clamp on the motor, proximity sensor for part count,
  accelerometer on the spindle).
* **Put it in the purchase order.** Every machine supplier must deliver the agreed interface (for example
  "OPC UA server with the information model in Annex X, security mode SignAndEncrypt"). Adding it later is
  expensive.

### Step 4 – Plan the OPC UA information model and namespace

An OPC UA server shows its data as a tree of **nodes** (objects, variables, methods). If every supplier
builds a different tree, your MES must be programmed again for every machine. So **you** define the model.

1. **Use companion specifications where they exist.** Examples: *OPC UA for Machinery* (common building
   blocks such as identification and machine state) and *OPC UA for Machine Tools* (CNC data). Ask each
   supplier which companion specifications they support.
2. **Define your own model for the rest** (factory standard), with the same structure on every machine.
3. **Identify nodes by namespace URI, not by the number.** `ns=2` is only an index; it can change when the
   server is updated. Your clients must look up the index from the URI (for example
   `urn:vcfactory:plant1:machines`) at connection time.
4. **Use clear string identifiers** like the twin: `<Asset>.<Group>.<Item>`.

Example factory standard (example names – adapt them):

```
Objects
└── HMC-02                                  (asset id = same as in MES, SCADA, twin)
    ├── Identification   Manufacturer, Model, SerialNumber, SoftwareVersion
    ├── State            Mode (AUTO/MANUAL/SETUP), State (RUN/IDLE/SETUP/ALARM/OFF), Since
    ├── Counters         PartsGood (UInt32), PartsScrap (UInt32)
    ├── Program          ActiveProgram (String), ProgramFiles (FileType)
    ├── Process          SpindleSpeed_rpm, SpindlePower_kW, Vibration_mm_s, Temperature_C
    ├── Orders           (Object)
    │   ├── StartOrder(order:String, material:String, recipe:String, qty:UInt32) → queuePos:UInt32
    │   └── HoldOrder(order:String)
    ├── UnitStarted      { serial, order, casting_lot }  (structure, subscribed by the MES)
    └── Alarms           (Alarms & Conditions, Severity 1…1000)
```

Rules for the model:

* **Units in the name or in the EngineeringUnits property** (`Vibration_mm_s`). Never "vibration" alone.
* **Data types fixed** (UInt32 for counters, Double for measurements, String for ids).
* **Quality and time stamp** come with every value; the client must check `StatusCode` (Good / Uncertain / Bad).
* **Methods for actions** (StartOrder), not "write 1 to a bit and hope". A method gives a clear answer
  (`Good` or `Bad_InvalidState`).
* **Security:** use security mode **SignAndEncrypt**, user authentication, and a certificate plan (who
  creates, trusts and renews certificates – they expire).
* **Sampling and publishing intervals:** write them in the spec (for example state 500 ms, process values
  1 s, counters on change).

### Step 5 – Plan the MQTT topic scheme (Unified Namespace)

The twin uses topics like `vcfactory/plant1/machining/fms/HMC-02/telemetry`. Write a topic standard
before the first device publishes. (The project has now fixed it in doc 15, 3.10: `vc/<Area>/<Line>/<Machine>/…`,
e.g. `vc/MCH/L2/HMC02/telemetry` – see 11.4. The long form below shows the general ISA-95 idea.)

```
<enterprise>/<site>/<area>/<line>/<asset>/<class>[/<item>]

vcfactory/plant1/machining/fms/HMC-02/telemetry     every 10 s, QoS 1
vcfactory/plant1/machining/fms/HMC-02/state         on change, QoS 1, retained
vcfactory/plant1/test/TEST-01/result                one per unit, QoS 1
vcfactory/plant1/machining/fms/HMC-02/status        online/offline (last will), retained
```

Rules:

1. **Levels follow ISA-95** (enterprise / site / area / line / cell / asset), so everyone finds data the same way.
2. **Asset ids are the same** in MES, SCADA, OPC UA and MQTT (`HMC-02` everywhere).
3. **Fixed character set:** letters, digits, `-` and `_`. No spaces. Decide upper/lower case once.
4. **Payload standard (JSON):** always `ts` in ISO 8601 **UTC** (`2026-11-09T09:20:00Z`), unit in the field
   name (`temp_c`, `vib_mm_s`, `power_kw`, `fad_m3_h`), and the serial number when the data belongs to a unit.
5. **QoS:** QoS 1 for results and events; QoS 0 is acceptable for fast telemetry where a lost value does not matter.
   Remember QoS 1 means "at least once": the receiver must handle **duplicates** (use serial + ts as key).
6. **Retained** messages for the **last state** (new subscribers get it at once). Not for events.
7. **Last Will** (LWT) message for online/offline status of every device.
8. **Access control on the broker:** each device may publish only under its own topic branch.
9. **Commands:** prefer OPC UA methods for commands. If you use MQTT for commands, use separate `cmd`
   topics, a request id, and a reply topic.
10. If you use **Sparkplug B**, its topic structure is fixed: `spBv1.0/<group_id>/<message_type>/<edge_node_id>[/<device_id>]`,
    with birth and death certificates. Do not mix free topics and Sparkplug in the same branch.

### Step 6 – VDA 5050 for the AGVs

VDA 5050 is the interface between a fleet manager (VDA 5050 calls it *master control*) and AGVs, with JSON
messages over MQTT. It lets you use AGVs from different suppliers with one fleet manager.

1. **Fix the version** (the twin's example uses `"version": "2.0.0"`). Fleet manager and all AGVs must
   support it.
2. **Topics** per AGV: `<interfaceName>/<majorVersion>/<manufacturer>/<serialNumber>/<topic>`, for example
   `uagv/v2/AcmeAGV/AGV-02/order`. Main topics: `order`, `instantActions`, `state`, `connection`,
   `visualization`, `factsheet`.
3. **Node map:** give every pick/drop station a fixed `nodeId` (`ASRS-RAW-OUT`, `LOAD-IN` …) and keep the
   list in the interface specification together with coordinates.
4. **Actions:** agree on the action types (`pick`, `drop`, charging …) and their parameters (load type,
   height).
5. **Station handshake:** VDA 5050 controls driving. The **transfer at the station** (conveyor running,
   station ready, load taken) needs a separate handshake between AGV and station PLC – for example optical
   I/O in the style of SEMI E84, as the mechanical interface guides of this project describe. Define who
   waits for whom and the time-outs.
6. **MES ↔ fleet manager** is not VDA 5050: it is a transport request (from, to, load, priority) – usually
   REST or OPC UA. Specify it like every other interface.
7. **Test** with one AGV first: order, state, battery, error states, connection lost, emergency stop,
   order cancel (`instantActions`).

### Step 7 – Time synchronisation (NTP / PTP)

Traceability and alarm analysis only work if **all clocks agree**. Example: the MES must know which unit was
in the machine when an alarm came. If the PLC clock is 3 minutes wrong, the alarm is linked to the wrong
serial number.

1. **One plant time source**, for example a time server in the DMZ (with GPS or synchronised to the
   IT time servers).
2. **NTP** (Network Time Protocol) for servers, MES, SCADA, HMIs, PLCs and gateways. Typical accuracy on a
   LAN: milliseconds. That is enough for MES and SCADA.
3. **PTP** (Precision Time Protocol, IEEE 1588) only where you need sub-microsecond accuracy (for example
   coordinated motion or precise sequence-of-events recording). It needs PTP-capable switches.
4. **Store all time stamps in UTC.** Convert to local time only on the screen. This avoids errors at the
   daylight-saving change.
5. **Use the source time stamp** (when it happened in the machine, `SourceTimestamp`), not the time the
   message arrived.
6. **Monitor the offset.** An alarm in SCADA if a device clock is more than, for example, 1 s wrong.

### Step 8 – Decide IT/OT responsibilities

Write down **who owns what** before commissioning. Example responsibility table (R = responsible, A =
approves, C = consulted):

| Task | IT department | OT / automation team | Machine supplier | MES/ERP supplier |
|---|---|---|---|---|
| Office network, ERP servers | R | C | – | C |
| DMZ, firewalls between IT and OT | R (operates) | A (rules) | – | C |
| Plant / cell networks, switches, VLANs | C | R | C | – |
| PLC and CNC programs | – | A | R | – |
| OPC UA servers in machines | – | A (model) | R | C |
| MQTT broker, historian | C | R | – | C |
| MES, ERP interfaces (B2MML, REST) | C | C | – | R |
| Certificates, user accounts | R | R (OT accounts) | C | C |
| Patching servers and PCs | R | A (time window) | C | C |
| Backups of PLC/CNC programs | – | R | C | – |
| Remote access for suppliers | R (jump host) | A (each session) | user | user |
| Interface tests (FAT/SAT) | C | R | R | R |

**Why:** IT thinks "patch quickly"; OT thinks "never stop the line". Both are right. Agree on rules:
patch windows during planned stops, test patches first on a test system, and a written emergency procedure.

### Step 9 – Write an interface specification for every link

One document per link (or per interface type). Use this **template**:

```
INTERFACE SPECIFICATION  IF-07  MES → Load station PLC: order release      Version 1.2 (example)

1. Partners          Client: MES (L3)        Server: PLC LOAD-CC (L1)
2. Purpose           Release a work order and its recipe to the load station.
3. Protocol          OPC UA 1.04+, binary, TCP 4840, SignAndEncrypt, user "mes_svc"
4. Trigger           MES dispatching rule selects the next order (rule EDD).
5. Message           Method ns=<urn:vcfactory:plant1:machines>;s=LOAD-CC.Orders.StartOrder
                     IN : order String(16)  e.g. "WO-0012"
                          material String(16)  e.g. "VC20-300"
                          recipe String(16)  e.g. "VC20_v1"
                          qty UInt32 1…999  e.g. 23
                     OUT: queuePos UInt32
6. Answer            Good = accepted.  Bad_InvalidState = station in maintenance/E-stop.
                     Bad_InvalidArgument = unknown recipe.
7. Timing            Answer within 2 s. No answer → MES retries 3 × every 10 s, then alarm.
8. Duplicates        Same order sent twice → PLC answers Good and does not add it twice (idempotent).
9. Error handling    Link down → MES shows "station offline"; operator may start from HMI with
                     scanned work-order barcode (fallback).
10. Logging          MES logs request + answer with UTC time stamp; PLC keeps last 100 calls.
11. Test cases       T1 normal, T2 unknown recipe, T3 station in maintenance, T4 duplicate,
                     T5 network cable pulled, T6 qty = 0, T7 certificate expired.
12. Owner / contact  MES: … / PLC: …
```

Fill it for all 14 workflow steps of the twin plus all machine-specific links.

### Step 10 – Commission and test the interfaces

Test in stages. Never test an interface for the first time on the production line.

1. **Desk test (simulation).** Use simulators: an OPC UA test client, an MQTT client subscribed to `#`
   on a test broker, an EDI test partner. The twin itself is a useful "fake factory": it can produce
   the same messages (see the Live monitor) and real gateways can post to `/api/ingest`
   (try `python tools/gateway_example.py --machine LATHE-01`).
2. **FAT (Factory Acceptance Test)** at the machine supplier: test the OPC UA server against your
   information model, with your test client and your test cases.
3. **SIT (System Integration Test)** on site: MES + SCADA + PLCs together, cell by cell.
4. **SAT (Site Acceptance Test)**: complete order loop, like the 20-step simulation: one real customer
   order from EDI to invoice.

**Test messages.** Prepare a set of test messages with known results. Examples:

| Test | Message sent | Expected answer / result |
|---|---|---|
| Normal release | `Call LOAD-CC.Orders.StartOrder("WO-T001","VC20-300","VC20_v1",2)` | `Good`, queuePos 1; HMI shows "ready: WO-T001" |
| Unknown recipe | `... StartOrder("WO-T002","VC20-300","VC99_v1",2)` | `Bad_InvalidArgument`; MES alarm; nothing on HMI |
| Station in maintenance | same as normal, station in maintenance mode | `Bad_InvalidState` |
| Duplicate | normal release sent twice | second answer `Good`, order **not** doubled |
| Test result PASS | publish `{"serial":"VC20-T0001","fad_m3_h":20.31,"lsl_m3_h":19.40,"result":"PASS",...}` | MES: unit PASS, value in SPC chart |
| Test result at the limit | `fad_m3_h` = 19.40 | PASS (rule is ≥ LSL) |
| Test result FAIL | `fad_m3_h` = 19.39 | FAIL; unit blocked |
| Broker down | stop the broker during test results | gateway buffers, sends after restart; no result lost, no duplicate unit |
| Clock wrong | set PLC clock + 5 min | time monitoring alarm |
| 4–20 mA wire break | disconnect the sensor | value < 3.6 mA → "wire broken" alarm, not "0 mm/s" |
| B2MML reject | send ProductionSchedule with unknown material | `AcknowledgeProductionSchedule actionCode="Rejected"` + reason |
| EDI | test ORDERS from the partner | ORDRSP within agreed time; sales order correct |

Also measure: **message rate** and **network load** at full production (the Live monitor gives you rates per
link to start with), **answer times**, and **recovery time** after a network or server restart.

---

## 6. Checklists

### 6.1 Planning checklist

- [ ] System list complete (every system, layer, owner).
- [ ] Link diagram drawn; every one of the 14 workflow steps has a real link.
- [ ] For every link: data, direction, rate, max delay, behaviour when the link is down.
- [ ] Protocol **and version** chosen for every link.
- [ ] Zone/conduit plan (IEC 62443 idea) with VLANs and firewall rule table.
- [ ] DMZ between office IT and plant; no direct path from IT/internet to PLCs.
- [ ] Remote access concept (jump host, personal accounts, MFA, logging).
- [ ] OPC UA information model (factory standard) written; companion specifications requested.
- [ ] MQTT topic standard and payload standard written (UTC time, units in names).
- [ ] VDA 5050 version, node map and station handshake defined.
- [ ] Time concept: time server, NTP for all, PTP only where needed, UTC everywhere.
- [ ] IT/OT responsibility table signed by both sides.
- [ ] Interface requirements written into every machine purchase order.

### 6.2 Interface specification checklist (per link)

- [ ] Partners (client/server or publisher/subscriber) named.
- [ ] Trigger, message structure, data types, ranges, units.
- [ ] Every answer code and what the sender does with it.
- [ ] Time-out, retries, alarm.
- [ ] Duplicates handled (idempotent).
- [ ] Store-and-forward when the link is down.
- [ ] Security (encryption, user, certificate).
- [ ] Logging on both sides with UTC time stamps.
- [ ] Test cases including error cases.

### 6.3 Commissioning checklist

- [ ] Desk test with simulators passed.
- [ ] FAT of each machine interface against your model passed.
- [ ] Clocks synchronised; offset monitoring active.
- [ ] Firewall rules tested (allowed traffic works, everything else is blocked).
- [ ] All normal test messages passed.
- [ ] All error test messages passed (wrong data, timeout, duplicate, link down, wire break).
- [ ] Full order loop (EDI order → work order → units → test → confirmation → shipping → invoice) passed.
- [ ] Load test at full production rate.
- [ ] Backups of all PLC/CNC programs, OPC UA configurations, broker configuration and firewall rules.
- [ ] Certificates: expiry dates listed, renewal owner named.

---

## 7. Common mistakes

| Mistake | What happens | How to avoid it |
|---|---|---|
| No answer defined ("fire and forget" for commands) | ERP/MES does not know if the order arrived; orders lost or doubled | every request has an answer (ORDRSP, Acknowledge, StatusCode, 201 Created) |
| Units not defined | 2.4 is read as mm/s by one system and as in/s by another | unit in the field name or EngineeringUnits |
| Local time stamps | wrong order of events at daylight-saving change; wrong serial linked to an alarm | UTC everywhere, source time stamp |
| Polling everything fast | network and PLC overloaded | OPC UA subscriptions / MQTT publish on change |
| Using `ns=2` as a fixed number | client reads wrong nodes after a server update | look up namespace index from the URI |
| Different asset names in each system | MES "HMC2", SCADA "MC_02", MQTT "hmc-02" – data cannot be joined | one asset id list for all systems |
| Office network routed to PLCs "for convenience" | malware from IT reaches the machines | DMZ, deny by default |
| QoS 1 without duplicate handling | one test result counted twice | idempotent receiver (serial + ts as key) |
| 0–20 mA instead of 4–20 mA, or no wire-break check | broken wire shows "0" as a valid value | use 4–20 mA; alarm below 3.6 mA |
| Interface added after the machine was bought | expensive change, delays | write the interface into the purchase order |
| ERP sends HOW instead of WHAT | ERP must know machines and programs; MES role unclear | ERP: what and when; MES: how |
| Testing interfaces for the first time on the line | production stops during debugging | desk test, FAT, SIT before SAT |
| Expired certificates | OPC UA or MQTT connections suddenly fail | certificate list with expiry dates and owner |
| Cloud allowed to send commands | security and safety risk | data out only |

---

## 8. Limits of the twin

* The twin **does not speak** EDIFACT, B2MML, OPC UA, MQTT or VDA 5050 on the network. It moves data
  internally and **records** each event as the message it would be in a real factory. The messages in the
  simulation and in the protocol view are **teaching examples**, shortened, not complete valid messages for
  a certification test.
* All protocol choices, ports, speeds, NodeIds, topics and codes are **typical examples**, not the only
  possible choice.
* The live log keeps only the last 300 messages (the browser shows 80). Sensor values are counted, not logged.
* What-if copies have no bus: `comm.send` does nothing there.
* There is no network model: no delays, no lost messages, no bandwidth limits, no firewall.
* The step-by-step simulation is one fixed story (23 × VC20-300); it does not use live data.
* The SCADA explained view shows operator commands but never sends them.
* The twin has no login or security. Run it only on a trusted network.

---

## 9. How to use chapters 10 – 15

Chapters 1 – 8 explain how the twin shows communication. Chapters 10 – 15 are for building the **real**
networks and interfaces.

| Chapter | Content | Main reader |
|---|---|---|
| 10 Principles | Why protocols behave as they do: pub/sub, bandwidth, latency, determinism, TCP/UDP, time sync, information models, reliability, security – with numbers | automation and IT engineers |
| 11 Detailed specification | Asset register, OPC UA node tree with NodeIds and units, MQTT topics and JSON schema, VDA 5050 fields, network/VLAN/IP/port plan, server sizing, requirement tables for suppliers | engineers, buyer, suppliers |
| 12 Identification | How assets, tags, NodeIds, topics, host names, IP addresses and certificates are named | everybody who configures a device |
| 13 Standards | What each communication standard requires and how to verify it | engineers, buyer |
| 14 Complete worked example | The order of guide 04 chapter 14 as network messages with addresses, ports, payloads and sizes | training, commissioning |
| 15 Data you still need | What is missing, why, who delivers | project manager |

Related documents: `docs/15_numbering_and_identification.md` (numbering master – it wins if anything here
differs), `docs/14_engineering_reference_data.md` (general tables), `docs/16_standards_register.md` (all
standards with editions), guide 04 chapters 11 – 14 (business records and B2MML).

All values in chapters 10 – 15 (addresses, sizes, intervals, limits) are **examples or proposals**.

---

## 10. Principles

### 10.1 Client/server and publish/subscribe

| | Client/server (request/response) | Publish/subscribe (broker) |
|---|---|---|
| Who knows whom | client must know the server address | publisher and subscriber know only the broker and the topic |
| Typical | OPC UA client/server, REST, Modbus, MTConnect | MQTT, Sparkplug B, OPC UA PubSub, AMQP queues |
| Good for | commands with a confirmed answer, reading on demand | data that many systems need, events, telemetry |
| Weak point | many clients × many servers = many connections, polling load | no direct answer – a command needs an extra reply topic |

**Number of connections.** 5 consumers (MES, SCADA, historian, twin, dashboard) and 16 machines:

```
point to point:  5 × 16 = 80 sessions, every machine serves 5 clients
with a broker:   5 + 16 = 21 sessions, every machine publishes once
```

**Polling vs. report by exception.** 2 000 tags polled every 1 s = 2 000 reads/s. If only 5 % of the
values change per second, change-driven reporting (OPC UA subscription, MQTT publish on change) sends
100 values/s – 20 × less. A **deadband** (e.g. send temperature only if it changed by more than 0.5 °C)
reduces it further. The deadband is an attribute in the tag list (doc 15, 3.10).

Note: an OPC UA *subscription* is still client/server (the server pushes changes through the client's
session). OPC UA *PubSub* (IEC 62541-14) is real publish/subscribe over UDP or MQTT.

### 10.2 Bandwidth – how big is a message on the wire?

```
data rate [bit/s] = size on the wire [bytes] × 8 × messages per second
size on the wire  = payload + protocol headers of every layer
```

| Layer | Overhead per frame / packet | Note |
|---|---|---|
| Ethernet preamble + start delimiter | 8 bytes | on the wire only |
| Ethernet header (MAC addresses + type) | 14 bytes | |
| VLAN tag (IEEE 802.1Q) | 4 bytes | in tagged links |
| Ethernet frame check sequence (FCS) | 4 bytes | |
| Inter-frame gap | 12 bytes (time) | |
| IPv4 header | 20 bytes | without options |
| TCP header | 20 bytes + typically 12 bytes options (time stamps) | |
| UDP header | 8 bytes | |
| TLS 1.3 record (AES-GCM) | ≈ 22 bytes (5 header + 1 type + 16 tag) | per record |
| MQTT PUBLISH | 2 – 5 bytes fixed header + 2 + topic length + 2 packet id (QoS ≥ 1) | |

Ethernet payload is 46 – 1 500 bytes; the smallest frame is 64 bytes (header to FCS), the largest 1 518
(1 522 with VLAN tag).

**Worked example – one telemetry message (MQTT, QoS 1, TLS):**

```
topic    vc/MCH/L2/HMC01/telemetry                                                  25 bytes
payload  {"ts":"2026-11-09T09:20:00.000Z","state":0,"SpindleTemp":66.6,"Vib":2.4,
          "Power":14.8,"Speed":1800}                                                  98 bytes
MQTT packet  = 3 (fixed header) + 2 + 25 (topic) + 2 (packet id) + 98       = 130 bytes
+ TLS 22 + TCP 32 + IPv4 20 + Ethernet 14 + VLAN 4 + FCS 4                 = 226 bytes frame
+ preamble 8 + gap 12                                                       = 246 bytes on the wire
PUBACK back: 4 (MQTT) + 22 + 32 + 20 + 22 + 20                             = 120 bytes
total per message ≈ 366 bytes ≈ 2 900 bit
```

| Case | Messages/s | Data rate | Share of 1 Gbit/s |
|---|---|---|---|
| Twin: 16 machines every 15 s | 1.07 | 3.1 kbit/s | 0.0003 % |
| Real plant: 200 assets every 1 s | 200 | 0.6 Mbit/s | 0.06 % |
| 2 000 tags, each its own message every 1 s | 2 000 | 6 Mbit/s | 0.6 % |

**Lesson:** for MES, SCADA and historian, bandwidth on wired Ethernet is almost never the problem.
Latency, Wi-Fi coverage and the number of sessions on a PLC are.

**Cyclic real-time I/O is different.** PROFINET RT sends a frame per device per direction every cycle,
even if nothing changes. The smallest frame on the wire is 64 + 8 + 12 = 84 bytes = 672 bit:

```
1 device, 1 ms cycle:  672 bit × 1 000 /s = 0.67 Mbit/s per direction
20 devices in a line, 1 ms:  20 × 0.67 = 13.4 Mbit/s per direction on the link next to the PLC
→ 13 % of a 100 Mbit/s link
```

The PLC engineering tool calculates this exactly; check its network load report at FAT.

### 10.3 Latency and jitter

**Latency** = time from sending to receiving. **Jitter** = how much the latency varies.

| Part of the delay | Formula / typical value | Example |
|---|---|---|
| Serialisation (putting bits on the wire) | frame bits / link rate | 246 B at 100 Mbit/s = 1 968 / 10⁸ = 20 µs; 1 538 B (largest frame) = 123 µs; at 1 Gbit/s 10 × less |
| Propagation | ≈ 5 µs per km in copper or fibre | 100 m = 0.5 µs |
| Switch (store and forward) | ≈ serialisation time + a few µs per switch | 5 switches ≈ 0.1 – 0.6 ms |
| Queueing | 0 … many ms when a link is busy | the cause of jitter |
| Application processing | ms to tens of ms | OPC UA server in a PLC answers in its communication time slice |
| Sampling / publishing | up to one interval | see below |

**OPC UA subscription:** worst-case delay ≈ sampling interval + publishing interval. Example: sampling
100 ms + publishing 500 ms → up to **0.6 s** before the MES sees a change. Set the intervals to what
the receiver needs, not as fast as possible.

**Wi-Fi (AGVs):** the handover between access points (roaming) can take from tens of milliseconds to more
than one second, depending on equipment and security settings. Ask for fast roaming (IEEE 802.11r) and
**measure** it along the AGV routes. VDA 5050 tolerates short gaps (the AGV continues its released path);
station handshakes must not run over a roaming Wi-Fi link without time-outs.

### 10.4 Determinism and cycle times (PROFINET classes, conceptually)

**Deterministic** = the maximum delay is guaranteed. Normal Ethernet with TCP/IP is not deterministic:
frames wait in switch queues, and a lost TCP segment is repeated only after a time-out (typically
0.2 – 1 s).

| Class (PROFINET, conceptual) | How | Typical cycle | Use |
|---|---|---|---|
| NRT (non-real-time) | normal TCP/UDP/IP | ~100 ms | parameters, diagnostics, configuration |
| RT (real-time) | Ethernet frames without IP, high priority (VLAN priority), standard switches with priority queues | about 1 – 10 ms (shorter possible) | remote I/O, valve islands, most PLC I/O |
| IRT (isochronous real-time) | reserved time slots in every cycle, special IRT switches, synchronised clocks | down to well below 1 ms, jitter ≤ 1 µs | motion control, synchronised axes |

PROFINET devices are grouped in **conformance classes** (CC-A, CC-B, CC-C; IRT needs CC-C). EtherCAT
reaches similar cycle times differently: one frame passes all devices and each device reads/writes its
bytes "on the fly"; distributed clocks synchronise the devices. **TSN** (Time-Sensitive Networking, the
IEEE 802.1 TSN standards) adds scheduled traffic to standard Ethernet; it is coming into PLC and drive
products.

**What this factory needs (example):** axis control stays inside the CNC/drive (machine supplier);
PLC I/O 2 – 10 ms (RT); MES and SCADA 100 ms – seconds (NRT, OPC UA/MQTT). IRT only where a machine
supplier needs it inside his machine.

### 10.5 TCP and UDP

| | TCP | UDP |
|---|---|---|
| Connection | yes (3-way handshake SYN, SYN-ACK, ACK) | no |
| Lost data | repeated automatically | lost (application must handle it) |
| Order | guaranteed | not guaranteed |
| Delay on loss | time-out, then repeat → jitter | none, but data missing |
| Used by | OPC UA binary (opc.tcp), MQTT, HTTP/HTTPS, Modbus TCP, S7, AMQP | NTP, PTP (also directly on Ethernet), OPC UA PubSub (UDP), SNMP, Syslog (UDP), DNS (mostly) |

**MQTT keep-alive:** the client sends at least one packet per keep-alive interval (PINGREQ if idle). The
broker treats the client as dead after **1.5 × keep-alive** without a packet and then publishes its Last
Will. Example keep-alive 10 s → device "offline" visible after at most **15 s**. A longer keep-alive saves
nothing important on Ethernet; use 10 – 30 s for machines (example).

**TLS:** a TLS 1.3 handshake adds one round trip and some milliseconds of CPU for the certificate check.
On a LAN with 0.5 ms round-trip time this is negligible – but after a broker restart **all** clients
reconnect at once. Ask for random reconnect delays (back-off) in devices and gateways.

### 10.6 Time synchronisation accuracy

**Why:** a quartz clock with 20 ppm error drifts 20 × 10⁻⁶ × 86 400 s = **1.7 s per day**. Without
synchronisation, after a month two PLCs can differ by nearly a minute.

**How NTP measures the offset** (4 time stamps: client sends t1, server receives t2, server sends t3,
client receives t4):

```
offset θ = ((t2 − t1) + (t3 − t4)) / 2          delay δ = (t4 − t1) − (t3 − t2)

example (client clock 100 ms behind):
t1 = 10:00:00.000  t2 = 10:00:00.105  t3 = 10:00:00.106  t4 = 10:00:00.011
θ = (0.105 + 0.095) / 2 = 0.100 s  → client adds 100 ms
δ = 0.011 − 0.001 = 0.010 s  (round trip)
```

NTP assumes the way there and back take the same time; the error is at most δ/2. On a good wired LAN
NTP reaches about 1 ms or better; over Wi-Fi and through busy routers it is worse. **PTP (IEEE 1588)**
time-stamps packets in the network hardware and corrects the switch delay; with PTP-capable switches it
reaches **below 1 µs**.

| Need in this factory | Accuracy needed | Method |
|---|---|---|
| Link an alarm or a measurement to the serial in the machine (a unit stays minutes) | ≤ 1 s | NTP |
| Order of alarms across machines (alarm flood analysis) | ≤ 10 ms | NTP on wired LAN, time stamp in the PLC |
| Sequence of events at 1 ms resolution | ≤ 1 ms | time stamp in the same PLC, or PTP |
| Synchronised motion | µs | IRT / EtherCAT distributed clocks / PTP – inside the machine |

### 10.7 Information modelling

**Data** is a number: `66.6`. **Information** is the number plus everything you need to use it safely:

| Part | Example |
|---|---|
| value + data type | `66.6`, Double |
| engineering unit | °C (UN/ECE code `CEL`) |
| range | 0 – 150 °C |
| quality | Good / Uncertain / Bad |
| time stamp | source time `2026-11-09T09:20:00.000Z` |
| context | which machine (HMC-01), which signal (spindle temperature), which unit was inside |

**OPC UA address space** (IEC 62541-3): everything is a **node**. There are 8 node classes: Object,
Variable, Method, ObjectType, VariableType, DataType, ReferenceType, View. Nodes are connected by
**references** (`HasComponent`, `HasProperty`, `Organizes`, `HasTypeDefinition` …).

**Types and instances:** define the type "HMC" once (which variables, methods, alarms), then create 3
instances HMC-01 … HMC-03. A client that understands the type understands every instance – also a
fourth HMC bought later. **Companion specifications** are agreed types for an industry (e.g. OPC UA for
Machinery, OPC UA for Machine Tools).

**Hierarchy:** the ISA-95 equipment hierarchy (enterprise → site → area → line/work centre → unit) is the
same skeleton for the OPC UA tree, the MQTT topic tree and the tag names: `MCH` / `L2` / `HMC01`
(doc 15, 3.10).

### 10.8 Reliability of delivery

**MQTT QoS:**

| QoS | Packets | Guarantee | Cost |
|---|---|---|---|
| 0 | PUBLISH | at most once – may be lost | 1 packet |
| 1 | PUBLISH → PUBACK | at least once – may be **duplicated** | 2 packets |
| 2 | PUBLISH → PUBREC → PUBREL → PUBCOMP | exactly once (between two partners) | 4 packets |

Important details:

* QoS is agreed **per hop**: publisher → broker, broker → subscriber. The subscriber gets
  min(publish QoS, subscription QoS).
* QoS 1/2 to a subscriber that was offline works only with a **persistent session** (MQTT 3.1.1: clean
  session = false; MQTT 5: clean start = 0 and a session expiry interval > 0).
* QoS does not protect against a device that loses power before sending. That needs **store-and-forward**
  in the device or gateway.
* Prefer **QoS 1 + idempotent receiver** (key = serial + time stamp, or a message id) over QoS 2: simpler,
  and it also handles duplicates created by a gateway restart.

**Store-and-forward buffer size:** messages/s × outage time × size. Example: test bench gateway with
4 messages/s × 8 h × 300 bytes = 4 × 28 800 × 300 = **35 MB** – easy for an industrial PC, too much for
some PLCs. State the required buffer time in the spec (11.9).

**Availability of a chain** (all parts needed = series; redundant parts = parallel):

```
series:    A = A1 × A2 × …          parallel (2 equal parts): A = 1 − (1 − A1)²
example:   switch 99.99 % × firewall 99.99 % × broker server 99.9 % × MES server 99.9 %
           = 0.9999 × 0.9999 × 0.999 × 0.999 = 0.9978  → 99.78 % → 0.0022 × 8 760 h = 19 h down per year
with 2 broker servers in a cluster: 1 − 0.001² = 99.9999 % for that part → chain ≈ 99.88 % → 10.5 h/year
```

Ring topologies with a redundancy protocol (e.g. MRP, IEC 62439-2) keep the cell network running when one
cable breaks; the switch-over time depends on the protocol profile (check the value in the device data,
e.g. "≤ 200 ms").

### 10.9 Security basics

**CIA triad:**

| Goal | Meaning | Example in this factory |
|---|---|---|
| **C**onfidentiality | only authorised people read the data | NC programs, prices, customer data |
| **I**ntegrity | data is not changed unnoticed | test limit 19.40 must not become 18.40; a work order quantity must not change |
| **A**vailability | systems work when needed | the line must not stop because of malware |

In office IT the order is often C > I > A. In OT it is usually **A and I first**, because a wrong value or
a stopped line can damage machines, products or people.

**Cryptography in two sentences each:**

* **Symmetric** (e.g. AES): the same secret key encrypts and decrypts. Fast; used for the data itself.
* **Asymmetric** (e.g. RSA, elliptic curves): a **public key** (everybody may know it) and a **private key**
  (kept secret). Used to agree on a symmetric key and to **sign** (prove who sent something).
* **Hash** (e.g. SHA-256): a fingerprint of data; any change gives a different fingerprint.

**Certificates and PKI.** An X.509 certificate is a signed document that says "this public key belongs to
`vc-mch-hmc01-cnc`" and is valid from … to …. It is signed by a **certificate authority (CA)**. If you trust
the CA, you trust every certificate it signed (chain of trust). A **CRL** (certificate revocation list)
lists certificates that are no longer valid before their end date.

| Item | OPC UA | MQTT (TLS) |
|---|---|---|
| Server identity | application instance certificate; the `ApplicationUri` must match the certificate's subject alternative name | broker server certificate; host name must match |
| Client identity | client application certificate (+ user: user name/password or user certificate) | client certificate, or user name/password inside TLS |
| Encryption | security mode **SignAndEncrypt** | TLS 1.2 or 1.3 on port 8883 |
| Trust | trust list of each application (or a global discovery server pushes certificates) | CA certificates in broker and clients |
| Weak settings to forbid | security mode None; deprecated policies Basic128Rsa15 and Basic256 | port 1883 without TLS outside the lab; anonymous access |

Current OPC UA security policies include `Basic256Sha256`, `Aes128_Sha256_RsaOaep` and
`Aes256_Sha256_RsaPss` – ask suppliers which they support and agree one minimum.

**Certificate workload (example):** 40 OPC UA/MQTT devices with 2-year certificates = 20 renewals per
year – about one every 2.5 weeks. Without a list of expiry dates and an owner, connections will suddenly
fail (common mistake, chapter 7).

**IEC 62443 in one table:**

| Idea | Meaning |
|---|---|
| Zones and conduits | group systems, control the paths between groups (5, Step 2) |
| Security levels SL 1 – 4 | protection against: SL 1 casual or accidental violation, SL 2 intentional attack with simple means, SL 3 sophisticated attack with moderate resources, SL 4 sophisticated attack with extended resources |
| 7 foundational requirements | identification and authentication control, use control, system integrity, data confidentiality, restricted data flow, timely response to events, resource availability |
| Target level per zone | you decide per zone (risk assessment, IEC 62443-3-2); the supplier proves what his component reaches (IEC 62443-4-2) |

---

## 11. Detailed specification for implementation

### 11.1 Asset register (one master list for all systems)

Every system (PLC, SCADA, MES, historian, broker, fleet manager, twin, firewall) takes names and addresses
from this list. Format and rules: doc 15 (3.9, 3.10, 3.13).

| Field | Example HMC-01 | Example LOAD-CC | Example TEST-01 | Example AGV-01 |
|---|---|---|---|---|
| Equipment ID (MES, twin) | `HMC-01` | `LOAD-CC` | `TEST-01` | `AGV-01` |
| Tag machine name | `HMC01` | `LOADCC` | `TEST01` | `AGV01` |
| Area / line | `MCH` / `L2` | `MCH` / `L2` | `TST` / `L1` | `LOG` / `L0` |
| Tag prefix | `MCH_L2_HMC01` | `MCH_L2_LOADCC` | `TST_L1_TEST01` | `LOG_L0_AGV01` |
| VLAN / IP | 51 / `10.51.0.51` (CNC) | 51 / `10.51.0.11` (PLC-01) | 53 / `10.53.0.12` (example) | 60 / `10.60.0.51` |
| Host name | `vc-mch-hmc01-cnc` | `vc-mch-plc01` | `vc-tst-plc02` (example) | `vc-log-agv01` |
| OPC UA endpoint | `opc.tcp://vc-mch-hmc01-cnc:4840` | `opc.tcp://vc-mch-plc01:4840` | `opc.tcp://vc-tst-plc02:4840` | – (VDA 5050) |
| ApplicationUri | `urn:vc:plant1:MCH:L2:HMC01` | `urn:vc:plant1:MCH:L2:LOADCC` | `urn:vc:plant1:TST:L1:TEST01` | – |
| MQTT client id | `MCH_L2_HMC01` | `MCH_L2_LOADCC` | `TST_L1_TEST01` | `AGV-01` (VDA 5050 serialNumber, see 11.6) |
| Physical serial | supplier's serial | – | supplier's serial | `AGV-2546-00001` (own build, doc 15) |
| Supplier / model / firmware | from purchase order | | | |
| Owner | OT team | OT team | quality + OT | logistics + OT |

(The IP host numbers marked "example" follow the host ranges of doc 15 3.13 but are not yet assigned
there. `PLC-01` = `10.51.0.11`, `HMC-01` CNC = `10.51.0.51` and `AGV-01` = `10.60.0.51` are doc 15 values.)

### 11.2 OPC UA server requirements (per machine / PLC)

| Item | Requirement (example values) |
|---|---|
| Protocol | OPC UA binary over TCP (`opc.tcp`), port **4840**, specification version 1.04 or later |
| Security | modes **SignAndEncrypt** only (None disabled in production); policy at least `Basic256Sha256` or `Aes128_Sha256_RsaOaep` |
| Users | user name/password or X.509; roles: `mes_svc` (read + methods), `scada_svc` (read + write set points), `viewer` (read) |
| Certificates | application instance certificate with `ApplicationUri` from 11.1; validity ≤ 2 years (example); import of our CA |
| Namespace | our model in namespace URI `urn:vc:plant1:machines` (example); clients resolve the index at connect time |
| Capacity | ≥ 5 sessions, ≥ 1 000 monitored items, minimum sampling interval ≤ 100 ms (example) |
| Time | NTP client to the plant time server; `SourceTimestamp` from the PLC clock |
| Companion specs | supplier states which ones (OPC UA for Machinery, Machine Tools …) |
| Documentation | node list (export as NodeSet2 XML file) delivered with the machine, before FAT |

### 11.3 OPC UA node tree with NodeIds, data types and units

**NodeId rule (proposal):** string identifiers; the identifier of a variable or method is the **tag name**
(doc 15, 3.10), objects use the tag prefix. Browse path = the same parts with `/`. So one name works in PLC,
SCADA, OPC UA and historian.

```
ns = index of "urn:vc:plant1:machines"   (resolved at connect, never hard-coded)
Objects
└── MCH                               s=MCH
    └── L2                            s=MCH_L2
        ├── HMC01                     s=MCH_L2_HMC01            (ObjectType: VcMachineType)
        └── LOADCC                    s=MCH_L2_LOADCC           (ObjectType: VcLoadStationType)
└── TST / L1 / TEST01                 s=TST_L1_TEST01           (ObjectType: VcTestBenchType)
```

**HMC01** (sampling interval = what the client should request):

| Browse path (below MCH/L2/HMC01) | NodeId `s=` | Class | DataType | Unit (UN/ECE code, UnitId) | Range | Access | Sampling |
|---|---|---|---|---|---|---|---|
| Identification/Manufacturer | `MCH_L2_HMC01_Manufacturer` | Variable | String | – | – | R | once |
| Identification/SerialNumber | `MCH_L2_HMC01_SerialNumber` | Variable | String | – | – | R | once |
| State | `MCH_L2_HMC01_State` | Variable | Int16 (enum: 0 RUNNING, 1 SETUP, 2 STARVED, 3 BLOCKED, 4 DOWN, 5 MAINTENANCE, 6 STOPPED, 7 OFFLINE – guide 06) | – | 0 – 7 | R | on change (100 ms) |
| CurrentSerial | `MCH_L2_HMC01_CurrentSerial` | Variable | String(20) | – | e.g. `VC20-2646-00123` | R | on change |
| ActiveProgram | `MCH_L2_HMC01_ActiveProgram` | Variable | String | – | e.g. `O2102` | R | on change |
| SpindleTemp | `MCH_L2_HMC01_SpindleTemp` | Variable | Double | °C (`CEL`, 4408652) | 0 – 150 | R | 1 000 ms, deadband 0.5 |
| SpindleSpeed | `MCH_L2_HMC01_SpindleSpeed` | Variable | Double | 1/min (`RPM`, 5394509) | 0 – 6 000 | R | 1 000 ms |
| SpindlePower | `MCH_L2_HMC01_SpindlePower` | Variable | Double | kW (`KWT`, 4937556) | 0 – 30 | R | 1 000 ms |
| Vib | `MCH_L2_HMC01_Vib` | Variable | Double | mm/s (`C16` – verify in Rec 20, UnitId 4403510) | 0 – 50 | R | 1 000 ms |
| Vib_Hi / Vib_HiHi | `MCH_L2_HMC01_Vib_Hi`, `_Vib_HiHi` | Variable | Double | mm/s | 4.5 / 7.1 (config) | R (W for engineer role) | once |
| ToolWear | `MCH_L2_HMC01_ToolWear` | Variable | Double | % (`P1`, 20529) | 0 – 100 | R | 10 s |
| Energy | `MCH_L2_HMC01_Energy` | Variable | Double | kWh (`KWH`, 4937544) | counter | R | 60 s |
| Good_Cnt / Scrap_Cnt | `MCH_L2_HMC01_Good_Cnt`, `_Scrap_Cnt` | Variable | UInt32 | – | counter | R | on change |
| StartOrder | `MCH_L2_HMC01_StartOrder` | Method | in: order String(14), material String(20), recipe String(16), qty UInt32; out: queuePos UInt32 | | | X (mes_svc) | – |
| HoldOrder | `MCH_L2_HMC01_HoldOrder` | Method | in: order String(14) | | | X | – |
| (alarms) | object `MCH_L2_HMC01` is EventNotifier | Events | OPC UA Alarms & Conditions, alarm ids `HMC01_A5101` … (doc 15) | | | | |

**Engineering unit** in OPC UA = property `EngineeringUnits` of type `EUInformation`: `NamespaceUri =
"http://www.opcfoundation.org/UA/units/un/cefact"`, `UnitId` (Int32), `DisplayName` (e.g. "°C"),
`Description`. For UN/ECE codes of up to 3 characters the UnitId is the code's ASCII bytes as one number:

```
"CEL" = C (67), E (69), L (76) → 67 × 65 536 + 69 × 256 + 76 = 4 390 912 + 17 664 + 76 = 4 408 652
```

Range = property `EURange` (low, high), used by SCADA for scaling and by the client for plausibility.

**LOADCC** (serial station):

| Browse path | NodeId `s=` | Class | DataType |
|---|---|---|---|
| StartOrder / HoldOrder | `MCH_L2_LOADCC_StartOrder` / `_HoldOrder` | Method | as HMC01 |
| UnitStarted | `MCH_L2_LOADCC_UnitStarted` | Variable | structure `VcUnitStarted` { serial String(20), wo String(14), castingLot String(20), seq UInt32, time DateTime } |
| ReleaseOk | `MCH_L2_LOADCC_ReleaseOk` | Variable | Boolean (MES gate: TRUE = a released order with material exists) |

**TEST01** (test bench):

| Browse path | NodeId `s=` | Class | DataType |
|---|---|---|---|
| Result | `TST_L1_TEST01_Result` | Variable | structure `VcTestResult` { testResultId String(20), serial String(20), wo String(14), model String(6), fad Double [m³/h, `MQH` 5067080], lsl Double [m³/h], press Double [bar, `BAR` 4342098], inletTemp Double [°C], result Int16 (0 FAIL, 1 PASS), attempt UInt16, seq UInt32, time DateTime } |
| Limits_Sp | `TST_L1_TEST01_Limits_Sp` | Variable | structure per model (written by MES only) |

The `seq` field (running number) lets the MES detect a lost result; the MES stores the last `seq` per
station.

**Method answers (StatusCode)** to put in the interface sheet `VC-IF-ITS-MCH-0001` (doc 15):

| Case | StatusCode |
|---|---|
| accepted | `Good` |
| station in maintenance / E-stop / not in AUTO | `Bad_InvalidState` |
| unknown recipe or qty = 0 | `Bad_InvalidArgument` |
| caller not allowed | `Bad_UserAccessDenied` |
| same order again | `Good`, not added twice (idempotent) |

### 11.4 MQTT topic tree and payload schema

**Topic rule (doc 15):** `vc/<Area>/<Line>/<Machine>/<class>[/<item>]`. The twin's topics
(`plant/HMC-01/telemetry`, `vcfactory/plant1/…`) are teaching examples; implement this one.

| Topic | Publisher | Content | QoS | Retained | Rate |
|---|---|---|---|---|---|
| `vc/MCH/L2/HMC01/telemetry` | PLC-01 gateway | process values (schema below) | 0 or 1 | no | every 1 – 15 s |
| `vc/MCH/L2/HMC01/state` | PLC-01 gateway | state code, since, current serial | 1 | **yes** | on change |
| `vc/MCH/L2/HMC01/status` | gateway (LWT) | `{"online":true}` / Last Will `{"online":false}` | 1 | yes | on connect / loss |
| `vc/TST/L1/TEST01/result` | test bench | test result per unit | 1 | no | per unit |
| `vc/MCH/L2/LOADCC/unitStarted` | PLC-01 | serial, WO, lot | 1 | no | per unit |
| `vc/MCH/L2/HMC01/SpindleTemp` | (optional single-tag form, doc 15) | `{"ts":…,"v":66.6,"q":"Good"}` | 0 | yes | on change |
| `vc/<…>/cmd/<name>` and `…/cmd/<name>/reply` | MES / device | only if commands must go over MQTT (prefer OPC UA) | 1 | no | on demand |

**Broker access control (ACL):** each client id may publish only below its own prefix (e.g.
`MCH_L2_HMC01` → `vc/MCH/L2/HMC01/#`); MES, historian, twin and SCADA may subscribe to `vc/#`; nobody but
the MES publishes `…/cmd/…`.

**Payload rules:** UTF-8 JSON; `ts` = ISO 8601 UTC with milliseconds; field names = the signal words of
doc 15 (`SpindleTemp`, `Vib`, `Power` …); the unit is defined in the tag list / schema, not repeated in
every message; numbers as numbers (not strings); `msgId` for events so receivers can drop duplicates.

**JSON Schema of the test result** (give it to the test bench supplier):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:vc:plant1:schema:testResult:1",
  "type": "object",
  "required": ["ts", "msgId", "testResultId", "serial", "wo", "model", "fad", "lsl", "press", "result", "attempt"],
  "properties": {
    "ts":           { "type": "string", "format": "date-time" },
    "msgId":        { "type": "string", "maxLength": 32 },
    "testResultId": { "type": "string", "maxLength": 20 },
    "serial":       { "type": "string", "pattern": "^VC(10|20|30)-[0-9]{4}-[0-9]{5}(-[0-9])?$" },
    "wo":           { "type": "string", "pattern": "^WO-[0-9]{4}-[0-9]{4}$" },
    "model":        { "enum": ["VC10", "VC20", "VC30"] },
    "fad":          { "type": "number", "minimum": 0, "maximum": 100, "description": "m3/h at inlet conditions" },
    "lsl":          { "type": "number", "description": "m3/h, limit used for this test" },
    "press":        { "type": "number", "description": "bar (gauge)" },
    "inletTemp":    { "type": "number", "description": "degC" },
    "result":       { "enum": ["PASS", "FAIL"] },
    "attempt":      { "type": "integer", "minimum": 1 }
  },
  "additionalProperties": false
}
```

Telemetry schema: same style with `ts`, `state` (integer 0 – 7) and the process values of 11.3.

### 11.5 Sparkplug B (only if chosen instead of free JSON topics)

Topic `spBv1.0/<group_id>/<message_type>/<edge_node_id>[/<device_id>]`, e.g.
`spBv1.0/MCH_L2/DDATA/PLC01/HMC01`. Message types NBIRTH/NDEATH/DBIRTH/DDEATH/NDATA/DDATA/NCMD/DCMD/STATE.
Payload is binary (Protocol Buffers). Do not mix Sparkplug and free topics in the same branch (5, Step 5).

### 11.6 VDA 5050 – fields we use

Version: fix one (the twin example uses 2.0.0) for fleet manager and all AGVs; **validate messages
against the official JSON schemas of that version**. Topic:
`uagv/v2/<manufacturer>/<serialNumber>/<topic>`. Use the equipment ID as `serialNumber` (`AGV-01`) – or the
supplier's vehicle serial; decide once and write it in `VC-IF-AGV-ITS-0001` (doc 15).

**Header (in every message):** `headerId` (counter per topic), `timestamp` (ISO 8601 UTC), `version`,
`manufacturer`, `serialNumber`.

**order (fleet manager → AGV):**

| Field | Type | Our use / example |
|---|---|---|
| orderId | string | transport order id from the fleet manager, e.g. `T00146` |
| orderUpdateId | integer | 0, +1 for each extension of the same order |
| nodes[] | array | `nodeId` (station node name, 12.4), `sequenceId` (even 0, 2, 4 …), `released` (true = AGV may go there), `nodePosition` {x, y, theta, mapId} (from the map), `actions[]` |
| nodes[].actions[] | array | `actionType` (`pick`, `drop`, charging action as agreed), `actionId` (unique), `blockingType` (`NONE`, `SOFT`, `HARD`), `actionParameters` [{key, value}] e.g. load type `CRATE-CC`, height |
| edges[] | array | `edgeId`, `sequenceId` (odd 1, 3 …), `released`, `startNodeId`, `endNodeId`, optional `maxSpeed` (m/s) |

**state (AGV → fleet manager):**

| Field | Our use |
|---|---|
| orderId, orderUpdateId | which order the AGV is doing |
| lastNodeId, lastNodeSequenceId | where it is in the order |
| nodeStates[], edgeStates[] | what is still to do |
| driving | true/false |
| agvPosition {x, y, theta, mapId, positionInitialized} | for the twin and the map |
| actionStates[] {actionId, actionStatus} | `WAITING`, `INITIALIZING`, `RUNNING`, `PAUSED`, `FINISHED`, `FAILED` |
| batteryState {batteryCharge, charging} | % – fleet manager sends to charger below the limit (config `low_battery_pct` 25 %) |
| errors[] {errorType, errorLevel} | `WARNING` or `FATAL` → SCADA alarm |
| safetyState {eStop, fieldViolation} | E-stop and protective field → SCADA |
| operatingMode | `AUTOMATIC`, `SEMIAUTOMATIC`, `MANUAL`, `SERVICE`, `TEACHIN` |

State is sent on every change and periodically (check the maximum interval in the version you use).
**connection** topic: `ONLINE`, `OFFLINE`, `CONNECTIONBROKEN` (the last as MQTT Last Will).
**instantActions**: `cancelOrder`, `startPause`, `stopPause` (and others as agreed).
**factsheet**: AGV describes its capabilities (from version 2.0).

### 11.7 Network plan

**VLANs and subnets** (doc 15, 3.13 – the master; repeated here for the link plan):

| VLAN | Name | Zone | Subnet | Gateway |
|---|---|---|---|---|
| 10 | `ENT-OFFICE` | enterprise IT | 10.10.0.0/16 | 10.10.0.1 |
| 20 | `DMZ` | IT/OT DMZ | 10.20.0.0/24 | 10.20.0.1 |
| 30 | `OT-L3-OPS` | MES, WMS, broker, historian | 10.30.0.0/24 | 10.30.0.1 |
| 40 | `OT-L2-SUP` | SCADA, HMIs, fleet manager, twin | 10.40.0.0/24 | 10.40.0.1 |
| 51 | `OT-L1-MCH-L2` | crankcase FMS cell | 10.51.0.0/24 | 10.51.0.1 |
| 52 | `OT-L1-MCH-L1L3` | cylinder + crankshaft lines | 10.52.0.0/24 | 10.52.0.1 |
| 53 | `OT-L1-ASM-TST` | assembly, robot, test benches | 10.53.0.0/24 | 10.53.0.1 |
| 54 | `OT-L1-LOG-ASRS` | AS/RS crane PLCs | 10.54.0.0/24 | 10.54.0.1 |
| 60 | `OT-L1-AGV-WIFI` | AGVs (own SSID) | 10.60.0.0/24 | 10.60.0.1 |

Host ranges in each /24 (doc 15): `.1` gateway, `.2–.9` switches/APs, `.10–.49` PLCs, `.50–.99` CNCs,
robots, drives, AGVs, `.100–.149` HMIs/IPCs/servers, `.150–.199` I/O, cameras, printers, scanners, meters.
No DHCP in OT cells.

**Servers (example assignment, not yet in doc 15):** MES `10.30.0.100` (`vc-ops-mes01`), MQTT broker
`10.30.0.101`/`.102` (cluster), historian `10.30.0.103`, SCADA `10.40.0.100` (doc 15), fleet manager
`10.40.0.101`, twin `10.40.0.102`, time server and B2MML gateway in the DMZ `10.20.0.100`/`.101`.

**Ports and protocols:**

| Protocol | Transport / port | Where allowed (example) | Note |
|---|---|---|---|
| OPC UA binary | TCP 4840 | L3/L2 → L1 cells | IANA port; servers may use another port – write it in 11.1 |
| MQTT | TCP 1883 | **lab only** | no encryption |
| MQTT over TLS | TCP 8883 | cells → broker (L3); fleet manager ↔ AGVs | |
| HTTPS (REST, B2MML web service, web HMI) | TCP 443 | ENT ↔ DMZ ↔ L3; browsers → MES/SCADA | |
| HTTP | TCP 80 | redirect to 443 only | |
| AMQP over TLS | TCP 5671 | DMZ ↔ L3 (if a queue is used) | 5672 without TLS |
| Modbus TCP | TCP 502 | L2 → old devices only | no security – keep inside the cell |
| Siemens S7 | TCP 102 | engineering station → PLC | |
| EtherNet/IP | TCP 44818, UDP 2222 (I/O) | inside the cell | if used |
| PROFINET RT / IRT | Ethernet type 0x8892 (no IP) + UDP 34964 for connection set-up | inside the cell only | not routed |
| EtherCAT | Ethernet type 0x88A4 | inside the machine | not routed |
| MTConnect agent | TCP (often 5000) | L2 → CNC | read-only |
| NTP | UDP 123 | all → time server | |
| PTP (IEEE 1588) | UDP 319/320 or Ethernet | inside cells where needed | needs PTP switches |
| DNS | UDP/TCP 53 | all → DNS (L3 or DMZ) | |
| Syslog | UDP 514, TLS TCP 6514 | all → log server | |
| SNMP | UDP 161 (queries), 162 (traps) | network management → switches | use SNMPv3 |
| SSH | TCP 22 | jump host → devices | |
| RDP | TCP 3389 | jump host → HMIs/servers only | never from outside |

**Firewall rule table** (extends 5, Step 2 – give every rule an id and keep it in version control):

| Rule | From | To | Port | Purpose |
|---|---|---|---|---|
| FW-01 | ERP (VLAN 10) | B2MML gateway `10.20.0.101` | TCP 443 | work orders down, confirmations up |
| FW-02 | B2MML gateway | MES `10.30.0.100` | TCP 443 / 5671 | |
| FW-03 | MES, SCADA | cells 51–54 | TCP 4840 | OPC UA |
| FW-04 | cells 51–54 | broker `10.30.0.101/102` | TCP 8883 | MQTT |
| FW-05 | fleet manager `10.40.0.101` | broker | TCP 8883 | VDA 5050 |
| FW-06 | VLAN 60 (AGVs) | broker | TCP 8883 | VDA 5050 |
| FW-07 | all OT | time server `10.20.0.100` | UDP 123 | NTP |
| FW-08 | jump host (DMZ) | OT devices | TCP 22, 3389, 443 | remote service, per session approval |
| FW-99 | any | any | any | **deny and log** |

### 11.8 Server sizing (example – suppliers confirm)

**Historian storage:**

```
raw size = tags × samples per second × bytes per sample × seconds per year
2 000 tags × 1 /s × 16 B × 31 536 000 s = 1.0 TB per year uncompressed
with deadband/compression 10 : 1 (typical order of magnitude, depends on the signal) ≈ 100 GB per year
```

| Server | vCPU | RAM | Disk | Note |
|---|---|---|---|---|
| MQTT broker (×2, cluster) | 4 | 8 GB | 100 GB | 200 clients, < 5 000 msg/s is a small load for common brokers |
| Historian | 8 | 32 GB | 2 TB SSD | 10 years at the estimate above + reserve |
| SCADA server (×2, redundant) | 8 | 16 GB | 250 GB | supplier sizing rules |
| Fleet manager | 4 | 8 GB | 100 GB | AGV supplier |
| Time server | appliance or small VM | | | GPS antenna or IT time source |
| MES / ERP | see guide 04, 11.16 | | | |

### 11.9 Requirement tables for suppliers (with acceptance criteria)

**Machine suppliers (OPC UA interface)**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| COM-M01 | OPC UA server per 11.2, node tree per 11.3 (NodeSet2 file before FAT) | browse with our test client at FAT | all nodes, types, units, ranges as specified |
| COM-M02 | Methods StartOrder/HoldOrder with the StatusCodes of 11.3 | test cases T1–T7 (5, Step 9) | all answers as specified, answer < 2 s |
| COM-M03 | SignAndEncrypt, user roles, our CA certificates | connect with None / wrong certificate / right certificate | only the right certificate + user connects |
| COM-M04 | Source time stamps from NTP-synchronised clock | compare with time server | offset < 100 ms (example) |
| COM-M05 | Event buffer when the MES is offline | disconnect 8 h (example) during production | no lost events (`seq` continuous) |
| COM-M06 | No other open ports than documented | port scan at FAT | only the listed ports answer |

**Network supplier (switches, firewalls, Wi-Fi)**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| COM-N01 | VLANs and IP plan of 11.7, managed switches with port security | configuration review + test laptop in a wrong port | no access to other VLANs |
| COM-N02 | Firewall rules of 11.7, default deny with logging | allowed and forbidden connection from each zone | allowed works, forbidden blocked and logged |
| COM-N03 | Ring redundancy in cell networks | pull one ring cable during production | no PLC connection loss beyond the specified switch-over time |
| COM-N04 | AGV Wi-Fi coverage and roaming | drive all routes, measure signal and roaming time | signal and roaming within the AGV supplier's limits (e.g. ≥ −67 dBm, roaming < 100 ms – values from the AGV supplier) |
| COM-N05 | Time server, NTP for all devices | offset monitoring | all devices within 100 ms (example) |
| COM-N06 | Documentation: drawings, IP list `VC-ITS-NET-0001`, configuration backups | review | complete, matches the installed state |

**MQTT broker / UNS**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| COM-B01 | MQTT 3.1.1 and 5.0, TLS 8883, client certificates, ACL per 11.4 | client publishes outside its branch | rejected |
| COM-B02 | Persistent sessions, retained messages, Last Will | restart subscriber; kill a publisher | missed QoS 1 messages delivered; LWT within 1.5 × keep-alive |
| COM-B03 | Cluster / fail-over | stop one broker node | clients reconnect < 30 s (example), no lost QoS 1 message |
| COM-B04 | Load | 5 000 msg/s for 1 h | latency < 50 ms (example), no loss |

**AGV supplier (VDA 5050)**

| ID | Requirement | Acceptance test | Pass criterion |
|---|---|---|---|
| COM-A01 | VDA 5050 version as fixed, messages valid against official schemas | schema validation of recorded messages | 100 % valid |
| COM-A02 | order, instantActions (cancelOrder), state, connection, factsheet | test orders incl. cancel and order update | AGV behaves as specified; state shows correct actionStatus |
| COM-A03 | Wi-Fi loss behaviour | switch off AP on the route | AGV continues only on released path, stops safely, reports CONNECTIONBROKEN, resumes |
| COM-A04 | Station handshake with load station PLC (separate interface sheet) | 100 transfers | no failed transfer, time-outs work |

---

## 12. Identification in communication

The numbering master is doc 15. This chapter shows how one asset is named in every system.

### 12.1 One asset in all systems – example HMC-01

| System | Name of HMC-01 | Rule (doc 15) |
|---|---|---|
| MES, twin, config | `HMC-01` | equipment ID `<type>-<2 digits>` |
| PLC symbol / SCADA tag | `MCH_L2_HMC01_SpindleTemp` | `<Area>_<Line>_<Machine>_<Signal>`, hyphen dropped |
| OPC UA | NodeId `ns=<urn:vc:plant1:machines>;s=MCH_L2_HMC01_SpindleTemp`, browse path `MCH/L2/HMC01/SpindleTemp` | 11.3 |
| MQTT | `vc/MCH/L2/HMC01/telemetry`, single tag `vc/MCH/L2/HMC01/SpindleTemp` | 11.4 |
| Historian | tag `MCH_L2_HMC01_SpindleTemp` | same as SCADA |
| Alarm | `HMC01_A5101` "Spindle temperature high" | `<Machine>_A<gnnn>` |
| Host name (CNC) | `vc-mch-hmc01-cnc` | `vc-<area>-<device>`, lower case, ≤ 63 characters per DNS label |
| IP address (CNC) | `10.51.0.51` | `10.<VLAN>.0.<host>` |
| PROFINET device name | `vc-mch-hmc01-io1` | same text as host name |
| Certificate | subject CN `vc-mch-hmc01-cnc`, SAN URI `urn:vc:plant1:MCH:L2:HMC01`, SAN DNS `vc-mch-hmc01-cnc` | 11.2 |
| Device designation | `=MCH.L2.HMC01 +CAB01 -QA3` | IEC 81346 style |
| Physical serial | supplier's, or `HMC-2546-00001` for an own-built machine | serial ≠ equipment ID |

### 12.2 Rules

1. **One asset register** (11.1) feeds every system. Nobody types names by hand into a second system.
2. **Case:** tags and topics exactly as in doc 15 (`MCH_L2_HMC01`); host names lower case (DNS).
3. **Character set:** letters, digits, `_` (tags), `-` (IDs, host names), `/` (topic levels only).
   No spaces, no `#`, `+` (MQTT wildcards), no `.` inside a topic level.
4. **Length:** keep tag names ≤ 40 characters (example limit; check the smallest limit of your PLC, SCADA and
   historian products).
5. **Business IDs in messages:** serial `VC20-2646-00123`, work order `WO-2646-0012`, lot
   `LOT-CC20-2646-003` exactly as guide 04 chapter 12 – never shortened in a payload.
6. **Station node names for AGVs** (VDA 5050 `nodeId`): use the store / station ID plus side, e.g.
   `ASRS-RAW-OUT`, `LOAD-CC-IN` (examples; list them with coordinates in `VC-IF-AGV-ITS-0001`).
7. **Interface documents** are named `VC-IF-<side A>-<side B>-<nnnn>-<rev>` (e.g. `VC-IF-ITS-MCH-0001-A`
   for MES ↔ machining PLCs).

### 12.3 Labels as data carriers

Barcodes and DataMatrix codes are the "communication" between a physical part and the MES (L0 → L3). The
content (GS1 AIs, check digit) is in guide 04, 12.7 and doc 15, 3.16. For communication only this matters:
the scanner sends the decoded text (including the GS separator for variable fields) to the PLC or MES; the
receiver must **parse by AI**, not by position.

**Correction to chapter 4 (step 6):** the label `(02)04012345000017 (10)FA-L0009 (37)60` has a wrong check
digit (correct: `04012345000016`), and AIs (02) + (37) belong on a logistic unit together with (00) SSCC.
The twin's teaching view (`web/commsim.js`) still shows the old text.

---

## 13. Standards

Only standards we are sure of. Where a clause or version matters, **check it in the current edition**.
Full register with editions: `docs/16_standards_register.md`.

| Standard | Title (short) | What it requires / gives for us | How to verify |
|---|---|---|---|
| **IEC 62264** (ISA-95) | Enterprise-control system integration | level model, object names for ERP ↔ MES (see guide 04, 13) | interface spec uses ISA-95 objects |
| **IEC 62541** (= OPC 10000 series) | OPC Unified Architecture | Part 3 address space, Part 4 services, Part 5 information model, Part 6 mappings (binary, port 4840), Part 7 profiles, Part 8 data access (EngineeringUnits, EURange), Part 9 alarms & conditions, Part 14 PubSub, Part 2 security model | NodeSet2 review; test client; profile/certification statement of the supplier |
| **OPC 40001-1** | OPC UA for Machinery – basic building blocks | common machine identification and state nodes | supplier states support; browse check |
| **OPC 40501-1** | OPC UA for Machine Tools | CNC data model (production, monitoring, tools) | as above |
| **ISO/IEC 20922** | MQTT version 3.1.1 | packet formats, QoS 0/1/2, retained, Last Will, keep-alive 1.5 × | broker and client conformance tests (11.9) |
| **MQTT 5.0** (OASIS standard) | MQTT version 5 | adds session expiry, reason codes, user properties | as above |
| **Sparkplug** (Eclipse Foundation) | MQTT topic and payload rules | fixed topic namespace, birth/death, protobuf payload | only if chosen; check version |
| **VDA 5050** (VDA/VDMA) | Interface AGV ↔ master control | topics, order/state/instantActions/connection/factsheet messages, JSON schemas | schema validation; test orders (COM-A01…04); fix the version |
| **IEC 62443-2-1** | Security program requirements for asset owners | our security management (roles, patching, backups, remote access) | internal audit |
| **IEC 62443-3-2** | Security risk assessment, zones and conduits | zone/conduit model, target security level per zone | documented risk assessment |
| **IEC 62443-3-3** | System security requirements and security levels | technical requirements (FR 1–7) per SL for the system integrator | requirement checklist at SAT |
| **IEC 62443-4-1 / 4-2** | Secure product development / component requirements | what a supplier must prove for his product | supplier certificate or statement |
| **IEEE 1588** | Precision Time Protocol (PTP) | sub-µs synchronisation, needs PTP-capable switches | offset measurement |
| **RFC 5905** | NTP version 4 | NTP protocol, UDP 123 | offset monitoring |
| **ISO 8601** | Date and time format | UTC time stamps `…Z`, ISO weeks | payload validation |
| **IEC 61158 / IEC 61784** | Industrial communication networks – fieldbus specifications / profiles | PROFINET, EtherCAT, EtherNet/IP and others are defined here | supplier conformance certificate |
| **IEC 61131-9** | Single-drop digital communication interface (IO-Link) | IO-Link master/device, IODD | device certificate, IODD file |
| **IEC 62439-2** | Media Redundancy Protocol (MRP) | ring redundancy and recovery time | cable-pull test (COM-N03) |
| **IEEE 802.3 / 802.1Q / 802.11** | Ethernet / VLAN / Wi-Fi | physical network, VLAN tags, wireless | switch and Wi-Fi acceptance |
| **RFC 8446** | TLS 1.3 | encryption for MQTT, HTTPS | TLS scan (protocol versions, ciphers) |
| **RFC 5280** | X.509 certificate profile | certificate fields, validity, CRL | certificate review |
| **RFC 9110** | HTTP semantics | methods, status codes for REST | interface test |
| **NAMUR NE 43** | Signal levels for failure information of 4–20 mA transmitters | defined failure ranges below/above the 4–20 mA band (wire break detection) | wire-break test (5, Step 10) |
| **IEC 62682 / ISA-18.2** | Alarm management | alarm life cycle (guide 06) | alarm rationalisation review |
| **UN/EDIFACT** (syntax ISO 9735) | EDI messages | ORDERS, ORDRSP, DESADV, INVOIC, RECADV | partner tests |
| **ISO 20022** | Financial messages | camt.054 bank notification | bank test file |
| **GS1 General Specifications** | Barcodes, AIs | label content (guide 04, 12.7) | verifier, scanner test |
| **MTConnect** (MTConnect Institute) | CNC data, read-only HTTP/XML | agent, data items | check version supported by the CNC |

---

## 14. Complete worked example – the order as network traffic

The same order as guide 04 chapter 14: Delta Compressors, 23 × VC20-300, `SO-2646-0006`,
`WO-2646-0012`, first unit `VC20-2646-00123`. Addresses from 11.1/11.7. **All values are examples.**

### 14.1 Message list

| # | From (IP) → to (IP:port) | Protocol | Content (key fields) | Size on wire (approx.) |
|---|---|---|---|---|
| 1 | customer VAN → ERP (internet, AS2 over HTTPS 443) | EDIFACT ORDERS | `BGM+220+PO-88231`, `QTY+21:23`, `DTM+2:20261111` | ≈ 2 kB incl. AS2/MIME |
| 2 | ERP → customer | EDIFACT ORDRSP | `BGM+231+SO-2646-0006+29`, `RFF+ON:PO-88231` | ≈ 2 kB |
| 3 | ERP → Foundry A | EDIFACT ORDERS | `PO-2646-0009`, `CC20-CAST` × 120 | ≈ 2 kB |
| 4 | ERP 10.10.x.x → B2MML gateway 10.20.0.101:443 → MES 10.30.0.100:443 | B2MML ProcessProductionSchedule | `WO-2646-0012`, `VC20-300`, 23 EA, priority 3, EndTime `2026-11-11T08:00:00Z` | ≈ 2 – 3 kB XML |
| 5 | MES → ERP (same path back) | B2MML Acknowledge | `actionCode="Accepted"` | ≈ 1.5 kB |
| 6 | Foundry → ERP | EDIFACT DESADV | `RFF+ON:PO-2646-0009`, `GIN+BX+FA-L0009`, `QTY+12:120` | ≈ 2 kB |
| 7 | scanner 10.54.0.150 → MES (via PLC or directly, TCP) | GS1-128 text | `(00)095212345000000773(02)09521234000204(37)120(10)FA-L0009` | < 200 B |
| 8 | MES 10.30.0.100 → PLC-ASRS-RAW 10.54.0.11:4840 | OPC UA Call `LOG_L0_ASRSRAW_Store` | `("LOT-CC20-2646-003","CC20-CAST",120)` → Good, slot `ASRS-RAW-A01-L4-S02` (format doc 15) | ≈ 0.4 kB each way |
| 9 | MES → PLC-01 10.51.0.11:4840 | OPC UA Call `MCH_L2_LOADCC_StartOrder` | `("WO-2646-0012","VC20-300","VC20_v1",23)` → Good, queuePos 1 | ≈ 0.4 kB each way |
| 10 | fleet manager 10.40.0.101 → broker 10.30.0.101:8883 → AGV-01 10.60.0.51 | VDA 5050 order, topic `uagv/v2/<manufacturer>/AGV-01/order` | nodes `ASRS-RAW-OUT` (pick) → `LOAD-CC-IN` (drop) | ≈ 1 – 2 kB |
| 11 | PLC-01 → MES (OPC UA DataChange of `MCH_L2_LOADCC_UnitStarted`) and → broker (`vc/MCH/L2/LOADCC/unitStarted`) | OPC UA + MQTT | `{"serial":"VC20-2646-00123","wo":"WO-2646-0012","castingLot":"LOT-CC20-2645-007","seq":5821,"time":"2026-11-10T07:02:10.120Z"}` | ≈ 0.3 kB |
| 12 | MES → HMC-02 CNC 10.51.0.52:4840 (example host) | OPC UA FileType Open/Write/Close + Write ActiveProgram | NC file `VC-PRD-CC-0020_OP20_HMC_C.nc` (name per doc 15), program `O2102` | file size + ≈ 1 kB |
| 13 | PLC-01 → broker | MQTT `vc/MCH/L2/HMC02/telemetry` every 15 s (twin) / 1 s (real) | see 10.2 | ≈ 366 B incl. PUBACK |
| 14 | HMC-02 CNC → SCADA/MES | OPC UA Alarms & Conditions | `HMC02_A5101`-type event, Severity 600, `Vib 7.3 > 7.1 mm/s` → `MWO-2646-0004` | ≈ 0.5 kB |
| 15 | PLC-ASSY → MES | OPC UA DataChange `ASM_L1_ASSY01_Consumed` | serial `VC20-2646-00123`, `CYL-CAST` lot `LOT-CYL-2646-002` × 2, `CS-FORG` lot `LOT-CS-2645-011` × 1 | ≈ 0.4 kB |
| 16 | test bench 10.53.0.12 → broker → MES | MQTT `vc/TST/L1/TEST01/result`, QoS 1 | payload 14.2 | ≈ 490 B incl. PUBACK |
| 17 | MES → ERP (via DMZ) | B2MML ProcessProductionPerformance (unit) | `WO-2646-0012`, `MaterialLotID VC20-2646-00123`, 1 EA, `ASRS-FG` | ≈ 2 kB |
| 18 | ERP → MES (REST) and MES → PLC-ASRS-FG | HTTPS POST + OPC UA Call `LOG_L0_ASRSFG_Retrieve` | `{"shipment":"SHP-2646-0042","order":"SO-2646-0006","sku":"VC20-300","qty":23,"dock":"OUT-1"}` → 201 Created; 23 × Retrieve | ≈ 1 kB + 23 × 0.8 kB |
| 19 | ERP → customer | EDIFACT DESADV + INVOIC | 23 × `GIN+BN+VC20-2646-…`, `MOA+77:33350` | ≈ 4 kB |
| 20 | customer → ERP; bank → ERP | RECADV; ISO 20022 camt.054 | `RFF+AAK:SHP-2646-0042`; 33 350.00 USD | ≈ 2 kB + 3 kB |

### 14.2 Test result message in detail (message 16, first unit)

```
PUBLISH  topic  vc/TST/L1/TEST01/result   QoS 1   retain false   packet id 457
{"ts":"2026-11-10T08:44:05.000Z","msgId":"TEST01-000457","testResultId":"TR-000457",
 "serial":"VC20-2646-00123","wo":"WO-2646-0012","model":"VC20","fad":20.31,"lsl":19.40,
 "press":8.0,"inletTemp":21.5,"result":"PASS","attempt":1}
broker → test bench: PUBACK packet id 457
broker → MES (subscribed to vc/TST/#, QoS 1, persistent session): same PUBLISH, MES answers PUBACK
MES: validates against the schema (11.4), drops it if msgId already stored, checks 20.31 ≥ 19.40 → PASS,
     adds 20.31 to the SPC chart (guide 04, 14.4), stores TR-000457 with the serial
```

Size: topic 23 B, payload 227 B → MQTT packet 257 B → on the wire 373 B, plus PUBACK 120 B.

### 14.3 Totals for the order

| Item | Value |
|---|---|
| Business messages (EDI, B2MML, REST) | ≈ 10 + 24 unit confirmations + 1 order confirmation ≈ 35 |
| OPC UA calls and notifications (release, 24 unit starts, consumption, 23 retrieves, alarm) | ≈ 80 |
| Test results (24 units incl. the reject) | 24 MQTT messages |
| Telemetry during the 5.6 h (16 machines every 1 s in the real plant) | 16 × 20 160 s ≈ 322 000 messages ≈ 120 MB on the wire |
| Share of telemetry in the traffic | > 99 % – but still only ≈ 0.05 Mbit/s average |

**Lesson:** business messages are few but each one is critical (must not be lost or doubled); telemetry
is many but each single value is unimportant. Specify them differently: confirmed, idempotent, logged
(business) vs. QoS 0/1, compressed, sampled (telemetry).

---

## 15. Data you still need

| # | Data | Why | Who delivers |
|---|---|---|---|
| 1 | Final list of all devices (PLCs, CNCs, robots, scanners, printers, cameras, meters) with supplier and model | asset register, IP plan, licences | OT team, machine suppliers |
| 2 | Which OPC UA companion specifications each machine supports; NodeSet2 files | node tree 11.3 | machine suppliers |
| 3 | PLC and CNC brand decisions (PROFINET or EtherCAT or EtherNet/IP) | cell network design, switches | OT team |
| 4 | Number of tags per machine and required sampling rates | historian sizing, broker load | process and quality engineers |
| 5 | Building drawings with cable routes, cabinet locations, AGV routes | cabling, Wi-Fi site survey | civil / layout planner |
| 6 | Wi-Fi requirements of the AGV supplier (band, signal level, roaming time, max. latency) | Wi-Fi design and acceptance (COM-N04) | AGV supplier |
| 7 | VDA 5050 version and options supported by fleet manager and AGVs | interface sheet `VC-IF-AGV-ITS-0001` | AGV / fleet manager supplier |
| 8 | ERP and MES products and their interface options (B2MML version, REST, queues) | DMZ design, FW-01/02 | IT, ERP/MES suppliers |
| 9 | IT security policy of the company: CA/PKI, accounts, MFA, patch rules, log retention | certificates, remote access, IEC 62443 programme | IT department |
| 10 | Risk assessment and target security level per zone | firewall design, supplier requirements | OT + IT (IEC 62443-3-2) |
| 11 | Time source decision (GPS appliance or IT time servers) and PTP need | time concept | OT + IT |
| 12 | Availability targets per system (allowed downtime per year, RTO/RPO) | redundancy, server count | production management |
| 13 | Customer / supplier EDI partners, VAN or AS2 details, message guidelines | EDI set-up | sales, purchasing, partners |
| 14 | Store-and-forward needs per device (hours of buffer) | gateway/PLC selection | OT team |
| 15 | Missing host numbers in the IP plan (test benches, assembly PLCs, servers) and their entry in `VC-ITS-NET-0001` | 11.1, 11.7 | owner of doc 15 / OT team |

---

## 16. Glossary

| Term | Simple meaning |
|---|---|
| **AS2** | A way to send EDI documents securely over HTTPS between companies. |
| **B2MML** | Business To Manufacturing Markup Language: XML schemas for the ISA-95 objects. |
| **Broker** | Server that receives MQTT messages and forwards them to the subscribers. |
| **Companion specification** | An agreed OPC UA information model for one type of machine or industry. |
| **Conduit** | Controlled communication path between two security zones (IEC 62443). |
| **DESADV / ORDERS / ORDRSP / INVOIC / RECADV** | EDIFACT messages: despatch advice, order, order response, invoice, receiving advice. |
| **DMZ** | Network zone between office IT and plant OT; no direct traffic passes it. |
| **EDD** | Earliest due date: dispatching rule, the order with the earliest due date goes first. |
| **EDI / EDIFACT** | Electronic Data Interchange; UN/EDIFACT is the international standard for the documents. |
| **FAT / SIT / SAT** | Factory, System Integration and Site Acceptance Test. |
| **GS1-128** | Barcode with Application Identifiers like (01) GTIN, (10) lot, (21) serial, (00) SSCC. |
| **IEC 62443** | Standard series for security of industrial automation systems (zones, conduits, security levels). |
| **IODD** | IO-Link Device Description: file that explains the bytes of an IO-Link sensor. |
| **IO-Link** | Point-to-point digital connection to smart sensors and actuators. |
| **ISA-95 (IEC 62264)** | Standard for the levels of a factory and the information between ERP and MES. |
| **ISA-18.2** | Standard for alarm management (see guide 06). |
| **LSL** | Lower specification limit (here 97 % of the nominal flow). |
| **LWT (Last Will)** | MQTT message the broker publishes when a device disconnects unexpectedly. |
| **MES** | Manufacturing Execution System: work orders, serials, quality, maintenance (Level 3). |
| **Method (OPC UA)** | A function in the server that a client can call with typed arguments. |
| **MQTT** | Light publish/subscribe protocol through a broker. |
| **MTConnect** | Read-only XML/HTTP standard for CNC machine data. |
| **NodeId** | Address of a node in an OPC UA server, e.g. `ns=2;s=LOAD-CC.Orders`. |
| **NTP / PTP** | Network Time Protocol (ms accuracy) / Precision Time Protocol IEEE 1588 (sub-µs). |
| **OPC UA** | Secure, typed client/server (and pub/sub) protocol for industrial data and commands. |
| **QoS** | MQTT Quality of Service: 0 = at most once, 1 = at least once, 2 = exactly once. |
| **REST** | HTTP method + URL + JSON body; answer = HTTP status code. |
| **Retained message** | MQTT message the broker keeps and gives to every new subscriber. |
| **SCADA** | Supervisory Control And Data Acquisition: control-room software (Level 2). |
| **Sparkplug B** | Rules on top of MQTT: fixed topics, birth/death messages, binary payload. |
| **StatusCode** | OPC UA answer: Good, Uncertain or Bad_… with the reason. |
| **Subscription** | OPC UA: the client asks once; the server sends values only when they change. |
| **Unified Namespace (UNS)** | One central topic tree where all systems publish their current data. |
| **VDA 5050** | JSON-over-MQTT interface between AGV fleet manager and AGVs. |
| **VLAN** | Virtual LAN: a separate logical network on the same switches. |
| **Zone** | Group of systems with the same security needs (IEC 62443). |
| **4–20 mA** | Analog current signal with a "live zero": below about 3.6 mA = wire broken. |
| **CIA triad** | Confidentiality, integrity, availability – the three goals of security. |
| **Deadband** | Send a value only when it changed by more than this amount. |
| **EUInformation** | OPC UA structure for the engineering unit (UN/ECE code as UnitId). |
| **Jitter** | Variation of the delay of messages. |
| **NodeSet2** | XML file that describes an OPC UA information model; suppliers deliver it with the machine. |
| **PKI / CA** | Public key infrastructure / certificate authority that signs certificates. |
| **RT / IRT** | PROFINET real-time / isochronous real-time communication classes. |
| **Store-and-forward** | A device keeps messages while the link is down and sends them later. |
| **TSN** | Time-Sensitive Networking: IEEE 802.1 extensions for deterministic Ethernet. |
