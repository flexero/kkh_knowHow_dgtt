# 06 – SCADA (Level 2)

Guide for the engineering team that will build the real V-compressor factory.
It explains the SCADA layer of the digital twin, and how to plan, build and commission a real SCADA system.

> **Important:** every PLC address, signal range, alarm limit, deadband and time in this guide is an
> **example value** from the twin. Your real values come from your I/O list, your machine data sheets and your
> alarm philosophy document.

---

## Contents

1. Purpose
2. Where in the twin
3. Concepts – simply explained
4. The model in the twin + formulas
5. Implementing in the real factory – step by step
6. Checklists
7. Common mistakes
8. Limits of the twin
9. Engineering chapters – how to use chapters 10–15
10. Science principles – signals, sampling, alarm statistics, storage, availability
11. Detailed specification – servers, clients, historian, HMI rules, priorities, tag database, alarm list
12. Identification and numbering (tags, alarms, screens, nodes, hosts, accounts)
13. Standards – requirements and verification
14. Complete worked example – station HMC01 in SCADA end to end
15. Data you still need
16. Glossary

> **Binding rules for the real factory** (they replace the twin's example values where they differ):
> * Tag names: `<Area>_<Line>_<Machine>_<Signal>[_Suffix]`, e.g. `MCH_L2_HMC01_SpindleTemp`, `MCH_L2_HMC01_Speed_Sp`;
>   alarm IDs `<Machine>_A<gnnn>`, e.g. `HMC01_A5101`; IPs `10.<VLAN>.0.<host>` (chapter 12, master
>   `docs/15_numbering_and_identification.md`). The twin's `HMC-02.Temperature` is a simplified form.
> * SCADA reads the PLC **by symbol over OPC UA** from the station interface DB (`DB(10 + b)`, HMC01 = DB12), never by
>   absolute `%IW` address. The one PLC address scheme is in guide 05, chapter 12.4.
> * SCADA can request a start; it can **never reset an E-stop**. After an E-stop the sequence is
>   release → local reset → separate start (guide 05, 4.7 and 14.5). The twin restarts automatically – not allowed.
> * Large generic tables are in `docs/14_engineering_reference_data.md`.

---

## 1. Purpose

**SCADA** = Supervisory Control And Data Acquisition. It is the **control-room software**.

* It reads the values of all PLCs (tags).
* It shows the whole factory on screens (mimic, faceplates).
* It raises **alarms** and the operator must react.
* It stores history (historian) for trends and analysis.
* It lets the operator send **commands and set points** to the PLC.

The PLC controls the machine in milliseconds. SCADA supervises all machines in seconds.
**If SCADA stops, the machines keep running – you only become blind.** That is the correct design:
nothing safety-related depends on SCADA.

This guide helps you to:

* understand every function of the twin's SCADA tab and why it exists;
* write the **tag naming rule**, the **alarm philosophy document** (ISA-18.2) and the **HMI style guide** (ISA-101 idea);
* size the **historian**;
* set up **user roles and audit trail**;
* place SCADA in a secure network (**IEC 62443 zones**) with the right **redundancy**;
* commission SCADA step by step.

---

## 2. Where in the twin

| What | File / place |
|---|---|
| SCADA engine (server side) | `twin/scada.py`, class `SCADA` (runs inside the twin engine) |
| SCADA tab (operator screens) | **SCADA** tab, code in `web/scadatab.js` |
| Teaching view "SCADA explained" | **Communication** tab → mode SCADA, code in `web/scada.js`, deep link `/?cmmode=scada#comm` (`&sctest=1` starts the bearing-damage demo) |
| Data API | `GET /api/scada` · `POST /api/scada` · `GET /api/scada/trend?tags=HMC-02.Temperature,HMC-02.Vibration&hours=4` (max 4 tags) |
| Historian | `twin/historian.py`, SQLite file `data/history.db`, table `samples` |
| Deep link to a page | `/?scp=alarms#scada` (pages: `overview`, `alarms`, `tags`, `trends`, `audit`, `report`, `settings`) |
| E-stop interlock source | `twin/plc.py` writes `factory.estop_machines` (see guide 05) |

### 2.1 Pages of the SCADA tab

| Page | What you see / do |
|---|---|
| **KPI row** (always) | machines running, active alarms (not acknowledged), alarm rate last hour vs benchmark 6/h, standing / chattering / shelved, line OEE + power; scan counter and tag count |
| **Overview** | mimic of all lines (cards per machine with state, °C, mm/s, kW, pcs, speed if not 100 %, alarm badge), Start line / Stop line buttons, buffers and AGV batteries, **faceplate** of the selected machine |
| **Alarms** | alarm list with level, since, source, tag, value, limit, state, comment; buttons Ack, Shelve, Unshelve, Comment, Ack all; filter by level; show shelved; chart "new alarms per hour, last 12 h" with the 6/h benchmark line; standing and chattering lists; **bad actors** top 8; **journal** (last 150 activations) |
| **Tags** | tag database (161 tags in the example factory) with value, unit, quality, time stamp, PLC address, signal, alarm limits; writable `SpeedSetpoint` |
| **Trends** | 4 pens (machine + signal), one chart per pen (small multiples), range 30 min / 1 h / 2 h / 4 h / 8 h / 24 h, dashed SCADA alarm limits, crosshair tooltip |
| **Audit trail** | every operator action: time, operator, action, target, detail, result |
| **Shift report** | per machine: good, scrap, availability, performance, quality, OEE, running h, down + maintenance h, stopped h, alarms; total line; **CSV download** |
| **Alarm settings** | editable SCADA alarm limits per machine (vibration HIGH, HIGH-HIGH, temperature HIGH, tool wear HIGH) and the deadbands |

The operator name is typed in the field at the top of the SCADA tab. It is written to every action.

---

## 3. Concepts – simply explained

### 3.1 Where SCADA sits

```
L3  MES     work orders, serial numbers, quality
         ▼ orders, recipes                 ▲ machine states, counts, results
L2  SCADA   screens, alarms, trends, historian, operator commands
         ▼ commands, set points            ▲ tag values (OPC UA subscription, 0.1–1 s)
            (OPC UA Write / Call)
L1  PLC / CNC   controls the machine in milliseconds
         ▼ outputs: motor, valve            ▲ inputs: 4–20 mA, 24 V, IO-Link
L0  sensors and actuators
```

### 3.2 The 5 jobs of SCADA

| Job | Meaning | Example in the twin |
|---|---|---|
| 1 Acquire data | read every **tag** from every PLC | 161 tags |
| 2 Display | mimic diagram + one faceplate per machine | Overview page |
| 3 Alarm | compare values with limits; operator acknowledges | ISA-18.2 alarm list |
| 4 Record | store values with time stamp | historian `data/history.db` |
| 5 Supervisory control | commands and set points down to the PLC | Start, Stop, SpeedSetpoint |

### 3.3 Tag

A **tag** is one named value, for example `HMC-02.Temperature`. Each tag has:

* a **value** and a **unit** (41.2 °C),
* a **source address** in the PLC (`%IW80`, `DB12.DBW0` …),
* a **quality** (Good / Bad / Uncertain – is the value trustworthy?),
* a **time stamp** (when was the value measured?).

Why quality? If a PLC loses communication, the last value stays on screen. Without quality the operator
believes an old number. With quality "Bad – no communication" he knows the value is not live.

### 3.4 Signal scaling (4–20 mA → raw → engineering unit)

A sensor sends a current. The PLC analog card converts it to a number. SCADA (or the PLC) converts the number
back to °C, bar, m³/h.

```
current      I   = 4 + 16 · (v − lo) / (hi − lo)        [mA]
PLC raw      raw = 27648 · (v − lo) / (hi − lo)          (Siemens: 4 mA = 0, 20 mA = 27648)
engineering  v   = lo + (hi − lo) · raw / 27648
```

Example (temperature, range 0–150 °C, as shown live in the teaching view):

```
sensor 41.2 °C → I = 4 + 16 × 41.2/150 = 8.39 mA
              → raw = 27648 × 0.275 ≈ 7594
              → SCADA = 150 × 7594 / 27648 = 41.2 °C
```

Other example ranges in the twin: air flow 0–40 m³/h, pressure 0–16 bar (4–20 mA);
vibration IO-Link raw × 0.1 = mm/s; power raw × 0.01 = kW.

Rule: do the scaling **once**, in one place (normally the PLC, so all clients see the same engineering value).
Write the range in the I/O list.

### 3.5 Alarm, deadband, life cycle (ISA-18.2)

An **alarm** is a signal to the operator that **needs an action**. If no action is needed, it is not an alarm
(it may be an event or a message).

**Deadband (hysteresis):** the alarm switches **ON** at `value ≥ limit` and **OFF** only when
`value < limit − deadband`. Why: a noisy value near the limit would otherwise switch ON/OFF many times
("chattering").

**Life cycle:**

```
normal ──value ≥ limit──► ACTIVE, not acknowledged  (blinks)
   ACTIVE, not acknowledged ──operator Ack──► ACTIVE, acknowledged
   ACTIVE, acknowledged ──value < limit − deadband──► gone (normal)
   ACTIVE, not acknowledged ──value back to normal──► CLEARED, not acknowledged  (must still be acknowledged)
   CLEARED, not acknowledged ──operator Ack──► gone
```

Why "cleared but not acknowledged" stays on the list: the operator must **see** that something happened, even
if it is gone now (example: a short temperature peak).

**Shelve:** the operator hides an alarm for a limited time (e.g. a known sensor fault waiting for repair).
It must have a time limit and a reason. **Comment:** a note on the alarm for the next shift.

### 3.6 Alarm performance

| Metric | Meaning | Why |
|---|---|---|
| Alarm rate | new alarms per hour per operator | too many = operator ignores alarms |
| Benchmark | ISA-18.2 / EEMUA 191 guidance: about 6 alarms per hour (≈ 1 per 10 min, ≈ 150 per day) is "very likely acceptable" for one operator | target for the twin's KPI |
| Standing alarm | active for a long time | nobody reacts → it is not a real alarm, or the problem is ignored |
| Chattering alarm | ON/OFF many times in a short time | wrong deadband or delay |
| Bad actors | the few alarms that create most of the count | fix these first (often 10 alarms = most of the load) |
| Alarm flood | many alarms in a short time (e.g. after a breakdown) | operator cannot see the important one |

### 3.7 Faceplate and operator command

A **faceplate** is the small window of one machine: values, limits, state, alarms, and command buttons.
A command (Start, Stop, set point) goes **to the PLC**. **The PLC decides** if it is allowed (interlock), and
answers. SCADA only asks.

### 3.8 Historian

A database of values with time stamps. Used for trends, fault analysis, OEE, quality investigation.
Two common storage rules:

* **cyclic**: store every n seconds (the twin: every 15 s with the example config);
* **deadband / exception**: store only if `|new − last stored| > deadband` (saves space).

### 3.9 Audit trail

A list of **who did what, when, and with what result**. Every command, acknowledge, shelve, comment and limit
change. Why: after an incident you must know what happened; for quality you must prove who changed a limit.

### 3.10 Shift report and OEE

```
Availability = operating time / planned time
Performance  = ideal cycle time × count / operating time
Quality      = good parts / total parts
OEE          = Availability × Performance × Quality
```

---

## 4. The model in the twin + formulas

### 4.1 Scan

`SCADA.step(dt)` is called every simulation step. Every **2.0 simulated seconds** (`SCAN_S = 2.0`) it runs one
alarm scan (`_scan()`). The scan counter is shown at the top of the tab.

### 4.2 Alarm conditions

| Key (example) | Source | Level | Condition ON | Deadband (OFF below) |
|---|---|---|---|---|
| `HMC-02.DOWN` | machine | critical | state = DOWN (breakdown) | – (state) |
| `HMC-02.COMM` | machine | warning | state = OFFLINE ("Communication lost – no data from PLC") | – |
| `HMC-02.VIB_HH` | machine | serious | vibration (1-min average) ≥ HIGH-HIGH | 0.3 mm/s |
| `HMC-02.VIB_H` | machine | warning | vibration ≥ HIGH (only if not HIGH-HIGH) | 0.3 mm/s |
| `HMC-02.TEMP_H` | machine | serious | temperature ≥ HIGH | 2.0 °C |
| `HMC-02.WEAR_H` | machine | warning | tool wear ≥ 85 % (machines with tool wear only) | 2 % |
| `<buffer>.EMPTY` | purchased-parts store | serious | stock = 0 ("Stock-out – production will stop") | – |
| `AGV-01.BATT_L` | AGV | warning | battery < 15 % | – |

Deadbands can be set in `config/factory.json` under `"scada"`: `deadband_vib_mm_s`, `deadband_temp_c`,
`deadband_wear_pct`. The example config has no `scada` section, so the defaults 0.3 / 2.0 / 2.0 are used.

**Deadband formula** (in the code):

```
ON  if  value ≥ limit
stay ON  if  alarm already active AND value ≥ limit − deadband
OFF  if  value < limit − deadband
```

Example HMC-02 vibration (example limits from config: HIGH 4.5 mm/s, HIGH-HIGH 7.1 mm/s, deadband 0.3):

| Vibration (1-min avg) | Alarm |
|---|---|
| 4.4 mm/s | none |
| 4.5 mm/s | VIB_H ON (warning) |
| 4.3 mm/s | VIB_H still ON (4.3 ≥ 4.5 − 0.3 = 4.2) |
| 4.1 mm/s | VIB_H OFF |
| 7.1 mm/s | VIB_HH ON (serious), VIB_H goes off (only the higher one is shown) |

The vibration value is a 1-minute moving average (exponential, `vib_ewma += (vib − vib_ewma)·dt/60`).
Why: raw vibration jumps; an average gives fewer false alarms. The trend page shows the **raw** historian value,
so a trend can touch a limit without an alarm.

Example limits from `config/factory.json` (start values of the SCADA limits = machine data):

| Machine type (example) | Vib HIGH | Vib HIGH-HIGH | Temp HIGH |
|---|---|---|---|
| HMC, VMC, lathe | 4.5 mm/s | 7.1 mm/s | 75 °C |
| Honing, grinder | 3.5 / 3.0 | 6.0 / 5.5 | 70 °C |
| Test bench | 4.5 | 7.1 | 85 °C |
| Paint oven | 2.5 | 4.5 | 90 °C |
| Load, assembly | 2.0 | 4.0 | 50 °C |

### 4.3 Alarm record and life cycle in the code

Each alarm has: id, key, source, tag, level, text, value, limit, on time, off time, ack flag, ack by, ack time,
shelved until, shelved by, comment, count.

* New activation → a new record, written to the **journal** (keeps 400, shows 150) and as an event to the historian.
* Value back to normal → `off` time set. If already acknowledged → removed. If not → stays as
  "CLEARED · not acknowledged".
* Comes back **before** acknowledge → the same record becomes active again, count + 1 (shown as "(3×)").
* **Ack** (one or "all"): sets ack, user, time. A cleared alarm is removed at once.
* **Shelve**: 0.25–24 h (clamped), optional reason (saved as comment). The alarm is hidden from the list and
  from the "active" KPI. It comes back automatically when the time ends. **Unshelve** shows it again at once.
* **Comment**: up to 200 characters.

Every one of these actions is written to the audit trail.

### 4.4 Alarm performance formulas

```
rate_1h   = number of alarm activations in the last 3600 s
rate_avg  = total activations / run hours
benchmark = 6 per hour  (KPI turns red above 6; hour bars turn red above 6)
standing  = alarm active (not cleared) for more than 3600 s
chattering = 3 or more activations of the same alarm within 600 s
bad actors = 8 alarm keys with the highest activation count
per_hour  = activations in each of the last 12 hours (bar chart)
```

Notes:

* Shelved alarms are still counted in the rate. Correct: shelving hides, it does not remove the problem.
* The twin's thresholds (standing > 1 h, chattering 3 in 10 min) are the twin's own choices. In your alarm
  philosophy define your own. ISA-18.2 also uses "stale" for alarms active for a long time (often 24 h).
  A common chattering rule is 3 or more activations in 1 minute.
* The twin counts all alarms of the whole factory as if one operator watches everything. In a real factory
  measure the rate **per operator position**.

### 4.5 Operator commands (real, they change the simulation)

| Command | API body (example) | Interlock / check in `_machine()` |
|---|---|---|
| Start | `{"action":"machine","machine":"HMC-02","cmd":"start","user":"Anna"}` | refused if E-stop pressed in its PLC; refused if DOWN |
| Stop | `…"cmd":"stop"` | – (confirmation dialog in the browser) |
| Maintenance | `…"cmd":"maintenance"` | refused if already DOWN or MAINTENANCE |
| Speed set point | `…"cmd":"set_speed","value":110` | value required; limited to 50–130 % by the machine model |
| Training bearing fault | `…"cmd":"inject_bearing_fault"` | – (vibration rises slowly, then alarms come) |
| Start / stop line | `{"action":"line","line":"Cylinder machining","cmd":"stop"}` | each machine as above |
| Write tag | `{"action":"write","tag":"HMC-02.SpeedSetpoint","value":110}` | only `<machine>.SpeedSetpoint` is writable |
| Alarm limits | `{"action":"limits","machine":"HMC-02","vib_h":4.0,"vib_hh":6.5}` | > 0; vib HIGH < HIGH-HIGH, else refused and old values kept |

All commands are refused for **external** machines (real machines connected by `/api/ingest`):
"commands go to its own PLC/HMI".

**Speed set point effect** (from `twin/model.py`, written on the faceplate):

```
production rate   ∝ speed
tool wear / part  ∝ speed^1.5
breakdown ageing  ∝ speed²

Example 110 %:  output +10 %,  wear × 1.10^1.5 = × 1.15,  failure ageing × 1.10² = × 1.21
```

This teaches why "just run faster" is not free.

**E-stop interlock:** when an E-stop is pressed in the PLC tab, SCADA refuses "start" for those machines:
"refused: E-stop is pressed in its PLC – release and reset the E-stop first (interlock)". The result is written
to the audit trail.

Note: in the twin, releasing the E-stop restarts the stopped stations automatically (guide 05, 4.7), so a SCADA
start is not even needed. In the real factory the stations stay stopped after release and reset; a **new start**
(local button or a SCADA start request that the PLC checks) is required.

### 4.6 The rule about SCADA alarm limits

> **SCADA alarm limits are SCADA's own copy.** They start from the machine data (`vib_warn`, `vib_alarm`,
> `temp_limit`), but changing them on the Alarm settings page changes only `SCADA.limits`.
> They are **never written into `machine.vib_alarm`**, because `machine.vib_alarm` drives the bearing-failure
> physics of the simulated machine. Raising the SCADA limit does not make the machine stronger – it only
> makes the alarm come later.

This is exactly like a real factory: the alarm limit is a setting in SCADA (or in the PLC); the bearing breaks at
its physical limit whatever the screen says. Any limit change is in the audit trail as
`vib_h 4.5 -> 4 ...`.

### 4.7 Tag database

161 tags in the example factory:

| Tag name | Count | Example address (twin) | Signal |
|---|---|---|---|
| `<M>.State` | 16 | `DB(10+i).DBW0` | PLC logic, state code 0 = RUNNING, 1 SETUP, 2 STARVED, 3 BLOCKED, 4 DOWN, 5 MAINTENANCE, 6 STOPPED, 7 OFFLINE |
| `<M>.Temperature` | 16 | `%IW(64+8·i)` | 4–20 mA, 0–150 °C |
| `<M>.Vibration` | 16 | IO-Link port 1 | raw × 0.1 |
| `<M>.Power` | 16 | Modbus 40021 | power meter, raw × 0.01 |
| `<M>.SpindleSpeed` | 7 | CNC var #4119 | from CNC |
| `<M>.ToolWear` | 8 | CNC var #5001 | from CNC |
| `<M>.AirFlow` | 2 | `%IW(64+8·i+2)` | 4–20 mA, 0–40 m³/h |
| `<M>.Pressure` | 2 | `%IW(64+8·i+4)` | 4–20 mA, 0–16 bar |
| `<M>.SpeedSetpoint` | 16 | `DB(10+i).DBD12` | set point (operator), **writable** |
| `<M>.GoodCount` | 16 | `DB(10+i).DBD4` | PLC counter |
| `<M>.ScrapCount` | 16 | `DB(10+i).DBD8` | PLC counter |
| `<buffer>.Level` | 28 | `DB90.DBW(2·k)` | AS/RS / conveyor PLC |
| `<AGV>.Battery` | 2 | VDA 5050 state | MQTT |
| **Total** | **161** | | |

`i` = index of the machine in the whole factory (0 … 15). Example: HMC-02 is i = 2 → temperature `%IW80`,
state `DB12.DBW0`.

Quality: "Good", or "Bad – no communication" when the machine is OFFLINE. Time stamp: the simulation time of
the read.

> **Real factory:** the addresses in this table are twin examples and conflict with the PLC tab's scheme
> (see section 8). In the real system the "source" column of every tag is an **OPC UA node of the station
> interface DB**, e.g. `ns=3;s="MCH_L2_HMC01_IF"."SpindleTemp"`, generated from the I/O list (chapter 12.4–12.5
> and guide 05 chapter 12).

### 4.8 Historian trends

* The engine stores one row per machine every `history_interval_s` (15 s in the example config; the trend page
  text says 10 s, which is the default when the key is missing). Columns: temperature, vibration, power,
  spindle rpm, tool wear, good, scrap, state.
* `GET /api/scada/trend` reads up to **4 tags**, for the chosen range, and thins each series to at most
  **300 points** (`step = ceil(rows / 300)`). Why: a screen cannot show more points than pixels.
* Trendable signals: Temperature, Vibration, Power, SpindleSpeed, ToolWear, GoodCount, ScrapCount.
* Dashed lines = current SCADA alarm limits.
* The faceplate shows the last hour of temperature and vibration.
* Pen choice is remembered in the browser.

### 4.9 Shift report

From `analytics.machine_oee()`:

```
planned   = total time − STOPPED − MAINTENANCE − OFFLINE
operating = planned − DOWN − SETUP
A = operating / planned
P = min(1, ideal time of the parts made / operating)
Q = good / total
OEE = A × P × Q
```

Example: planned 8.0 h, down 0.5 h, setup 0.3 h → operating 7.2 h, A = 0.90.
Ideal time of parts made 6.5 h → P = 6.5/7.2 = 0.90. Good 95 of 100 → Q = 0.95.
OEE = 0.90 × 0.90 × 0.95 = **0.77**.

CSV columns: `machine, name, good, scrap, availability, performance, quality, oee, running_h, down_maint_h,
stopped_h, alarms`. File name `shift_report_<time>.csv`. Note: the report covers the **whole run** since the
last reset, not a real 8-hour shift window.

### 4.10 The teaching view (`web/scada.js`)

In the Communication tab, mode SCADA:

* Explains the 5 jobs, the place between MES and PLC, and a comparison PLC / SCADA / MES.
* A **small SCADA screen** on live data: mimic, faceplate with **tag, PLC address, signal (mA), PLC raw, value,
  quality**, and the scaling line `I = 4 + 16 × T/150 → raw = 27648 × r → T = 150 × raw/27648`.
* Its own simple alarm engine **in the browser** (deadbands 0.3 mm/s and 2 °C; tool wear warning at ≥ 90 %),
  with acknowledge and a short history.
* Operator commands are **previews only**, never sent: `Write HMC-02.FeedOverride = 90 % ← Good`,
  `Call StopAtCycleEnd()`, `Call ResetFault()` → `Bad_ConditionNotMet` when the machine is DOWN
  ("the PLC refuses: repair first").
* An animated scan cycle: Read → Scale → Check limits → Update screen → Historian → Commands.
* A teaching switch adds fake bearing damage on the selected machine (vibration rises, alarms appear).
  This damage is **not** stored in the historian.

The **SCADA tab** is the real one (server alarms, real commands, audit). The teaching view is for learning.

---

## 5. Implementing in the real factory – step by step

### 5.1 Define the scope

1. List what SCADA must do: monitoring of all lines, alarms, historian, operator commands, reports, interface to MES.
2. List what SCADA must **not** do: no safety functions, no E-stop reset, no closed-loop control that needs
   fast reaction (that stays in the PLC).
3. Decide the operator positions (e.g. one control room + one panel per line) – this decides alarm rate targets
   and screen layout.
4. Choose the product (examples of SCADA products: WinCC, Ignition, AVEVA, FactoryTalk). Requirements: OPC UA
   client, alarm management with shelving and audit, historian, user management, redundancy option, offline
   operation (no cloud needed).

### 5.2 Tag naming and tag list

1. Use the same station IDs as the layout, PLC, MES (HMC-02, not "M4").
2. Structure (project rule, chapter 12): `<Area>_<Line>_<Machine>_<Signal>`.
   Example: `MCH_L2_HMC01_SpindleTemp`, `MCH_L2_HMC01_Speed_Sp` (suffixes `_Sp`, `_Cmd`, `_Fb`, `_Hi`/`_HiHi`, `_Ok`,
   `_Cnt` per doc 15). The twin uses the shorter
   `<Station>.<Signal>` (`HMC-02.Temperature`) – do not copy that into the real system.
3. Fixed signal names for the same thing on all machines (Temperature, Vibration, Power, State, GoodCount …).
   Why: one faceplate template works for all machines, and reports can sum them.
4. Generate the tag list **from the PLC I/O list and the OPC UA interface DBs** – not by hand.
5. Columns: tag, description, unit, range, source (PLC + node / address), data type, scan/subscription rate,
   historian yes/no + deadband, alarm limits + priority, writable yes/no + allowed range + role.

### 5.3 Alarm philosophy document (ISA-18.2)

Write this **before** configuring any alarm. ISA-18.2 describes the alarm management life cycle:
philosophy → identification → rationalization → design → implementation → operation → maintenance →
monitoring and assessment, with management of change and audit around it.

Contents of the philosophy document:

1. **Definition**: an alarm needs an operator action. If not, make it an event or remove it.
2. **Priorities**: e.g. critical / serious / warning (the twin's levels), with the meaning of each and the
   expected reaction time. Common guidance for priority distribution is roughly 80 % low, 15 % medium, 5 % high.
3. **Rationalization**: for every alarm write cause, consequence, operator action, time to react, priority,
   limit, deadband, delay. Remove alarms without an action.
4. **Deadbands and delays** per signal type (e.g. vibration 0.3 mm/s, temperature 2 °C as in the twin;
   on-delay a few seconds for noisy signals).
5. **Shelving rules**: who may shelve, maximum time (twin: 24 h), reason required, shelved list reviewed each shift.
6. **Suppression** rules: e.g. when a machine is in maintenance, suppress its process alarms; when HIGH-HIGH is
   active, HIGH is not shown (the twin does this for vibration).
7. **Performance targets**: alarm rate per operator (≈ 6/h benchmark), max standing alarms, no chattering alarms,
   flood definition.
8. **Monitoring**: weekly bad-actor review (top 10), monthly KPI report.
9. **Management of change**: who approves new alarms and limit changes; all changes in the audit trail.
10. Roles and training.

### 5.4 HMI design (ISA-101 idea)

ISA-101 describes HMI design for process automation. Main ideas ("high-performance HMI"):

1. **Grey background, little colour.** Colour is used only for abnormal states and alarms. Then red really
   means something. (The twin's teaching view says the same.)
2. **Never use colour alone**: add shape or text (the twin uses ▲ for warning, ! for serious/critical, plus text).
3. **Display hierarchy**:
   * Level 1 – plant overview (the twin's Overview mimic + KPIs),
   * Level 2 – line / unit,
   * Level 3 – machine detail (faceplate),
   * Level 4 – diagnostics (tag database, I/O, trends).
4. **Show values with context**: limit next to the value (faceplate shows "HIGH 75"), small trends instead of
   numbers only.
5. **Consistent faceplates** from templates: same position for the same button on every machine.
6. **Confirmation for impactful commands** (the twin asks before Stop, Maintenance, Stop line, bearing fault).
7. Write an **HMI style guide** (colours, symbols, fonts, navigation) and give it to all suppliers.

### 5.5 Historian sizing

Formula:

```
samples per day = number of tags × 86 400 s / sample interval
storage per day = samples per day × bytes per sample
```

Example (only an example; check your product's real bytes per sample and compression):

```
161 tags, every 1 s, 16 bytes per sample (time stamp + value + quality)
samples per day = 161 × 86 400 = 13 910 400
storage per day = 13 910 400 × 16 B ≈ 223 MB  →  about 81 GB per year without compression
```

With deadband / exception storage, slow signals (temperatures) store much less. Measure after commissioning.

The twin stores 16 machine rows every 15 s: `16 × 86 400 / 15 = 92 160 rows per day`.

Steps:

1. Decide per tag: interval or deadband, and **retention** (e.g. raw 1 year, aggregates 10 years – your decision).
2. Separate **fast data** (vibration spectra, test-bench curves) – often a different storage.
3. Plan **store-and-forward**: if the historian server is down, the collector buffers data locally.
4. Use the **source time stamp** from the PLC where possible, and synchronize all clocks (NTP on the
   OT network).
5. Backup and restore test.

### 5.6 User roles and audit trail

The twin has **no login** – the operator types a name. A real SCADA needs authentication.

| Role (example) | May |
|---|---|
| Viewer | see screens, trends, reports |
| Operator | acknowledge, comment, start/stop, set points within limits |
| Shift leader | + shelve alarms, start/stop lines |
| Maintenance | + maintenance mode, diagnostic screens |
| Process engineer | + change alarm limits (with reason), set-point ranges |
| Administrator | user management, configuration – not production commands |

Rules:

1. Personal accounts (no shared "operator" login); central user management where possible.
2. Every action → audit trail: time, user, workstation, action, target, old value → new value, result.
   The twin records time, user, action, target, detail, result, e.g. `vib_h 4.5 -> 4`.
3. Audit trail is read-only for users and kept for a defined time.
4. Automatic logout / screen lock on shared panels; quick user change at shift change.

### 5.7 Network security (IEC 62443)

IEC 62443 divides the system into **zones** (groups of devices with the same security needs) and **conduits**
(the controlled connections between zones), with target security levels.

Example zone model for this factory:

| Zone (example) | Contains | Conduit / rule |
|---|---|---|
| Office / IT | ERP, e-mail, internet | only to the DMZ |
| Industrial DMZ | historian replica, MES web, patch server, remote-access gateway | firewall on both sides; no direct IT → PLC traffic |
| Operations (Level 3/2) | MES server, SCADA servers, engineering station | OPC UA to PLCs only |
| Control – one zone per line | line PLC, CNC, robot, HMI panels | PROFINET inside; only OPC UA 4840 from SCADA/MES |
| Safety | F-CPU safety network, PROFIsafe devices | no external access |
| AGV / Wi-Fi | AGVs, fleet manager, access points | separate SSID/VLAN, WPA3-Enterprise or equivalent, MQTT to fleet manager only |

Rules:

1. No direct connection from the office network or internet to PLCs.
2. Remote access only through a controlled gateway in the DMZ, with approval and logging.
3. OPC UA with security policy Sign & Encrypt and user authentication; no anonymous write.
4. Harden SCADA PCs (no internet browsing, USB control, antivirus/whitelisting suitable for OT).
5. Patch process tested on a test system first.
6. The twin itself has no security – run it only on a trusted network (README).

### 5.8 Redundancy and availability

| Part | Option | Why |
|---|---|---|
| SCADA server | redundant pair (hot standby) | operators are not blind when one server fails |
| Historian | store-and-forward in collectors; backup | no data gap |
| Network | ring topology (e.g. PROFINET MRP, redundant switches for the plant network) | one cable break does not stop communication |
| Power | UPS for servers, switches, PLCs | controlled behaviour at power loss |
| Clients | at least 2 operator stations per control room | one PC failure is not a problem |
| Time | 2 NTP sources | correct time stamps in alarms and historian |

Remember: the PLCs keep the machines running without SCADA. Redundancy is about **visibility and data**, not safety.

### 5.9 Commissioning SCADA

1. **Tag loop check**: for every tag, change the value at the source (sensor simulator, force in PLC) and check
   value, unit, scaling and quality on the screen. Example: inject 12 mA on a 0–150 °C input → screen must
   show 75 °C (4 + 16 × 75/150 = 12 mA).
2. **Bad quality test**: unplug the PLC network cable → tags go Bad, COMM alarm comes.
3. **Alarm test**: drive each alarm over the limit and back (deadband!), acknowledge, shelve, comment.
   Check priority and text against the rationalization list.
4. **Command test**: every command and set point, with the PLC refusing when interlocked
   (e.g. start during E-stop must be refused, as in the twin).
5. **Rights test**: each role can do only what it should.
6. **Historian test**: trends correct, retention set, store-and-forward test (stop server, restart, data complete).
7. **Redundancy test**: switch off the active server – clients continue.
8. **Reports**: OEE values compared with a hand calculation for one shift.
9. **Performance**: screen call-up time, CPU load of servers, alarm rate during first weeks of production.
10. Hand-over documents: tag list, alarm list, philosophy, style guide, user list, backup.

Use the twin before this: train operators on the SCADA tab (acknowledge, shelve, interlocks, shift report), and
discuss the alarm philosophy with the twin's bad-actor list and alarm rate chart.

---

## 6. Checklists

### 6.1 Design

- [ ] Scope: what SCADA does and does not do (no safety, no E-stop reset)
- [ ] Operator positions defined
- [ ] Tag naming rule written; station IDs same as PLC and MES
- [ ] Tag list generated from I/O list / OPC UA interface DBs
- [ ] Scaling done in one place, ranges in the list
- [ ] Alarm philosophy document approved
- [ ] HMI style guide (ISA-101 idea) given to all suppliers
- [ ] Historian sizing and retention decided
- [ ] User roles defined
- [ ] Zone / conduit drawing (IEC 62443)
- [ ] Redundancy concept

### 6.2 Alarm rationalization (per alarm)

- [ ] Cause, consequence, operator action, time to react
- [ ] Priority
- [ ] Limit, deadband, delay
- [ ] Suppression rule (maintenance, higher alarm active)
- [ ] Alarm limit is a SCADA/PLC setting – not changing machine protection

### 6.3 Commissioning

- [ ] Loop check of every tag (value, unit, quality)
- [ ] Communication loss → Bad quality + COMM alarm
- [ ] Every alarm tested ON/OFF with deadband
- [ ] Ack / shelve / comment / audit tested
- [ ] Every command tested, including PLC refusal
- [ ] Rights per role tested
- [ ] Historian, store-and-forward, backup/restore tested
- [ ] Redundancy switch-over tested
- [ ] OEE report checked against hand calculation

### 6.4 Operation (monthly)

- [ ] Alarm rate per operator vs target (≈ 6/h)
- [ ] Top-10 bad actors reviewed and fixed
- [ ] Standing and chattering alarms = 0 or justified
- [ ] Shelved list reviewed
- [ ] Audit trail spot check (limit changes justified)
- [ ] Backups OK

---

## 7. Common mistakes

| Mistake | Why it is bad | Do instead |
|---|---|---|
| Every signal becomes an alarm | alarm flood, operator ignores all | alarm only if an action is needed |
| No deadband | chattering alarms | deadband + delay per signal type |
| Raising an alarm limit to "stop the alarm" | hides a real problem; machine still breaks at its physical limit | find the cause; change limits only with MOC and audit |
| Writing SCADA limits into machine protection (in the twin: into `machine.vib_alarm`) | mixes alarm setting with physics/protection | keep SCADA limits separate |
| Shelving without time limit or reason | alarms disappear forever | max time, reason, review each shift |
| Colourful screens (green everywhere) | red alarm does not stand out | grey screens, colour only for abnormal |
| No quality shown | operator trusts an old value | show quality, grey/hatch bad values |
| SCADA command bits write directly to outputs | no interlock check | command to PLC; PLC checks and answers |
| E-stop reset possible from SCADA | unsafe | local reset only |
| Shared login "operator" | audit trail useless | personal accounts |
| Office network can reach PLCs | cyber risk | IEC 62443 zones, DMZ, firewall |
| Historian sized by guess | disk full, data lost | size with formula, monitor growth |
| Different time on each PC | alarms in wrong order | NTP for all OT devices |
| Tag list typed by hand | wrong addresses | generate from I/O list |

---

## 8. Limits of the twin

* **No login, no security.** The operator name is a free text field (stored in the browser). Anyone on the
  network can send commands. Run the twin only on a trusted network.
* **One "operator" for the whole factory.** The alarm rate is for all machines together, not per operator position.
* **Time stamps** in the tag database are the time of the read, not a source time stamp from the PLC.
* **Quality** is only Good or "Bad – no communication" (OFFLINE). No "Uncertain", no wire-break detection.
* **Alarm engine is simple**: fixed condition list, levels critical / serious / warning, no on-delay, no
  per-alarm deadband, no state-based suppression except "HIGH-HIGH hides HIGH" for vibration, no alarm flood
  detection. AGV battery and stock-out alarms have no deadband.
* **Thresholds** standing > 1 h and chattering 3 in 10 min are the twin's choices.
* **Writable tags**: only `SpeedSetpoint`. Alarm limits only for vibration, temperature and tool wear.
* **Shift report** covers the whole run since reset, not a real shift window or calendar.
* **Historian**: one sample every `history_interval_s` (15 s in the example config; the trend hint text says 10 s);
  SQLite file; no compression, no store-and-forward, no redundancy. Trends are limited to 4 pens and
  300 points each.
* **Example addresses**: the SCADA tag address scheme (`%IW(64 + 8·i)`, `DB(10+i)`, by machine index in the factory)
  is different from the PLC tab scheme (`%IW(64 + 16·k)`, `DB(20+k)`, by slot in each PLC). The same address can mean
  different machines in the two views. Power is shown as "Modbus 40021" for every machine. In a real project
  all addresses come from one I/O list (guide 05, chapter 12.4) and SCADA reads by OPC UA symbol (chapter 12.4 here).
* **E-stop release** restarts machines automatically in the twin; real factory: release → reset → start.
* **Teaching view** (`web/scada.js`) runs its own browser alarm logic (tool wear at 90 % instead of 85 %, scan
  cycle text "1 s") and sends no commands. Use the SCADA tab for the real twin behaviour.
* No redundancy, no OPC UA server/client inside the twin – the twin reads its own simulated machines directly.

---

## 9. Engineering chapters – how to use chapters 10–15

| Chapter | Use it when you … |
|---|---|
| 10 Science principles | set sampling / deadbands, judge alarm statistics, size historian, network, UPS, availability |
| 11 Detailed specification | write the SCADA purchase specification, the HMI style guide, the tag database and the alarm list |
| 12 Identification and numbering | name tags, alarms, screens, OPC UA nodes, servers and accounts |
| 13 Standards | check which standard asks what, and how to prove it |
| 14 Worked example | see one station (HMC01) from PLC interface DB to screen, alarm, trend and audit |
| 15 Data you still need | plan the data still missing |

Electrical and PLC basics (Ohm's law, 4–20 mA loop, 27648 counts, PL calculation, cabinet) are in guide 05,
chapters 10–14. Large generic tables: `docs/14_engineering_reference_data.md`.

---

## 10. Science principles – signals, sampling, alarm statistics, storage, availability

### 10.1 From sensor to screen – where errors come from

```
sensor (accuracy ±a %) → 4–20 mA → AI card (27648 counts) → PLC scaling → interface DB → OPC UA → SCADA tag
```

| Step | Error / delay source | Typical size (example) |
|---|---|---|
| Sensor | accuracy class | ±0.5 % of span = ±0.75 °C on 0–150 °C |
| AI card | resolution 150/27648 = 0.0054 °C, card accuracy | ±0.1–0.3 % (data sheet) |
| PLC | scan + filter | ms … s (filter) |
| OPC UA | sampling + publishing interval | 0.1–1 s |
| SCADA | display refresh | 0.5–1 s |

Rule: the **number of decimals on the screen** should match the real accuracy. Show 41.2 °C, not 41.2371 °C.
Scaling details and Siemens raw ranges: guide 05, 10.4–10.5.

### 10.2 Quality and time stamp (OPC UA)

Every OPC UA value has a **StatusCode**. Its two top bits give the severity: `00` **Good**, `01` **Uncertain**,
`10` **Bad**. Examples of Bad: no communication, sensor failure (wire break), configuration error.
Two time stamps: **source** (when the PLC/server measured it) and **server** time. Use the source time stamp
for alarms and the historian.

### 10.3 Sampling, subscriptions and deadband

OPC UA subscription parameters (per monitored item / subscription):

| Parameter | Meaning | Start value (example) |
|---|---|---|
| Sampling interval | how often the server checks the value | 500 ms for process values, 100 ms for states |
| Publishing interval | how often changes are sent to SCADA | 1000 ms |
| Queue size | values kept if several changes happen in one publishing interval | 1 (process) / 10 (events, counters) |
| Deadband (absolute or percent) | send only if the change is larger | 0.1 °C, 0.05 mm/s |

Nyquist idea (guide 05, 10.6): to see a change that lasts t, sample at least every t/2 – better t/5.
A 200 ms pressure spike is **invisible** to a 1 s SCADA sampling. Fast events (spikes, trips) must be detected
**in the PLC** and sent as an alarm bit or counter with the source time stamp.

### 10.4 Alarm deadband and delay sizing

```
alarm ON   : value ≥ limit           (for at least t_on)
alarm OFF  : value < limit − deadband (for at least t_off)
deadband   ≥ peak-to-peak noise of the signal (measure it in the historian)
```

Starting values (ISA-18.2 guidance – adjust after measurement):

| Signal type | Deadband (% of range) | On / off delay |
|---|---|---|
| Flow | 5 % | 15 s |
| Level | 5 % | 60 s |
| Pressure | 2 % | 15 s |
| Temperature | 1 % | 60 s |

Example: temperature 0–150 °C → 1 % = 1.5 °C (the twin uses 2 °C). Vibration has no row – the twin uses
0.3 mm/s on a 1-min average; measure the noise and decide.

A delay prevents chattering but **delays the alarm**: check that `t_on + operator time to act` is still shorter
than the time until the consequence happens (rationalization, 11.9).

### 10.5 Alarm system statistics

```
alarm rate      = number of new activations / hours / operator position
chattering      = same alarm ≥ 3 activations in 1 min (common rule; the twin: 3 in 10 min)
fleeting        = alarm that clears again within a short time (e.g. < 5 s) – usually needs a delay
stale           = active > 24 h (the twin calls > 1 h "standing")
flood           = > 10 new alarms in 10 min per operator; ends when < 5 in 10 min
top-10 share    = activations of the 10 most frequent alarms / all activations
```

Performance targets (ISA-18.2 / EEMUA 191 guidance, per operator position):

| Metric | Very likely acceptable | Maximum manageable |
|---|---|---|
| Alarms per day | ~150 | ~300 |
| Alarms per hour | ~6 | ~12 |
| Alarms per 10 min | ~1 | ~2 |
| 10-min periods with > 10 alarms | < ~1 % | |
| Maximum alarms in any 10 min | ≤ 10 | |
| Time in flood | < ~1 % | |
| Top-10 share | ~1 % to 5 % maximum (with action plan) | |
| Chattering and fleeting alarms | zero (action plan for each) | |
| Stale alarms | < 5 present on any day | |
| Priority distribution (3 priorities) | ~80 % low / ~15 % medium / ~5 % high | |

Example: 16 machines, one control-room operator, each machine 0.3 alarms/h on average
→ `16 × 0.3 = 4.8 alarms/h` → OK (< 6). One chattering sensor with 20 activations/h → 24.8/h → fix it first
(it is the bad actor).

### 10.6 Historian storage

```
samples/day (cyclic)    = tags × 86 400 / interval
samples/day (exception) ≈ tags × change rate after deadband (measure; often 5–20 % of cyclic for slow values)
storage/day             = samples/day × bytes per sample / compression factor
disk                    = storage/day × 365 × retention years × 1.5 (index, growth, safety)
```

Example – whole factory (*estimate*): 16 machines × 40 tags + 360 line / AGV / store tags = 1000 tags,
16 bytes per sample:

| Method | Samples/day | Storage/day | Per year |
|---|---|---|---|
| Cyclic 1 s | 86.4 million | 1.38 GB | 505 GB |
| Exception with deadband (assume 10 % of cyclic) | 8.64 million | 138 MB | 50 GB |
| Disk for 2 years raw, factor 1.5 | | | **≈ 150 GB** (exception) |

The bytes per sample and compression differ per product – take the vendor's sizing tool and **measure after
4 weeks** of production.

### 10.7 Network load

```
load [bit/s] ≈ notifications per second × bytes per notification × 8
```

Example: 1000 tags, 30 % change per second after deadband → 300 notifications/s × about 50 bytes
(value + status + time stamp + protocol overhead – rough) × 8 = **0.12 Mbit/s**. On a 100 Mbit/s or 1 Gbit/s
plant network this is small. The **real limits** are usually the PLC's OPC UA server (maximum monitored items,
sessions, minimum sampling interval – see the CPU data sheet) and the CPU load it causes.

### 10.8 Availability and redundancy

```
A = MTBF / (MTBF + MTTR)
downtime per year = (1 − A) × 8760 h
two servers in parallel (independent): A_pair = 1 − (1 − A)²
```

Example: one SCADA server MTBF 20 000 h, MTTR 8 h (restore from backup, example)

```
A = 20 000 / 20 008 = 0.9996     → (1 − 0.9996) × 8760 = 3.5 h blind per year (plus maintenance stops)
A_pair = 1 − 0.0004² = 0.99999984 → seconds per year in theory
```

In practice switch-over, common causes (same software bug, same power, same switch) dominate – so also make
power, network and time redundant (5.8) and **test** the switch-over.

### 10.9 UPS sizing

```
E_needed [Wh] = P_load [W] × t_backup [h]
E_battery    ≥ E_needed / η_inverter × ageing factor (e.g. 1.25)
S_UPS [VA]   ≥ P_load / power factor
```

Example: 2 servers × 250 W + 2 switches × 50 W + firewall 30 W + time server 10 W = 640 W; add 25 % → 800 W;
backup 15 min for a controlled shutdown:

```
E_needed  = 800 × 0.25 = 200 Wh
E_battery ≥ 200 / 0.9 × 1.25 = 278 Wh
S_UPS     ≥ 800 / 0.9 = 889 VA  → choose ≥ 1500 VA with ≥ 280 Wh battery
```

Connect the UPS signal to the servers for an automatic shutdown before the battery is empty.

### 10.10 Time synchronisation

* All PLCs, servers, clients, switches use **NTP** from the factory time server(s) (offline: GPS/DCF receiver
  or a domain controller as master). On a LAN NTP typically reaches a few milliseconds.
* Store time in **UTC**, display local time; format ISO 8601 (`2026-11-11T08:15:30.250Z`).
* Alarm time stamps should come from the **PLC** (source) – SCADA reception time can be late by the publishing
  interval and network delay. For sequence-of-events (which trip came first) you need millisecond time stamps
  in the PLC.

### 10.11 Human factors in numbers

* About 8 % of men have a red–green colour vision deficiency → never use colour alone (5.4).
* The operator can follow only a few important things at once → the overview should show **deviations**, not
  all numbers.
* Screen call-up time target ≤ 2 s (example – write it in the specification and test it).

---

## 11. Detailed specification

### 11.1 SCADA functional specification (summary table for the purchase order)

| Function | Requirement |
|---|---|
| Data acquisition | OPC UA client (IEC 62541), security Sign & Encrypt, certificate handling; ≥ 3000 tags licence (≥ 2 × the estimate) |
| Alarming | ISA-18.2 life cycle, priorities 1–3 (11.7), shelving with max time + reason, state-based suppression, alarm KPIs (10.5), source time stamps |
| Historian | exception + cyclic storage, store-and-forward, retention per tag class, export CSV, ≥ 2 years raw online |
| Displays | template faceplates, 4-level hierarchy (5.4), style guide (11.6) |
| Commands | OPC UA write with limits and roles; OPC UA method calls; confirmation dialogs; all actions in audit trail |
| Users | personal accounts, roles (5.6), central user management (works offline), auto logout |
| Reports | shift report with OEE, alarm KPI report, CSV/PDF |
| Redundancy | hot-standby server pair, automatic client switch-over |
| Offline | **no cloud, no internet licence check** at runtime; all help files local |
| Interfaces | to MES (OPC UA or database), to the twin (`/api/ingest` gateway for virtual commissioning) |
| Documentation | tag list, alarm list, style guide, user list, backup/restore procedure |

### 11.2 Server specification (*example* – the vendor's sizing tool decides)

| Item | SCADA server (×2, redundant) | Historian server |
|---|---|---|
| Type | industrial or rack server, redundant PSU | same |
| CPU / RAM | 8 cores / 32 GB | 8 cores / 32 GB |
| Disk | 2 × SSD in RAID 1 (system + project) | RAID 1 or RAID 10, size from 10.6 (e.g. ≥ 2 × 1 TB) |
| OS | vendor-approved server OS, hardened, no internet | same |
| Network | 2 ports: plant / OT network + redundancy link | plant network |
| Power | UPS (10.9) | UPS |
| Virtualisation | allowed if the vendor supports it; then host redundancy | |

### 11.3 Client / operator station

| Item | Specification (example) |
|---|---|
| Control room | ≥ 2 operator stations, each 2 × 24" full-HD (or larger) |
| Line panel | industrial panel PC or thin client, IP65 front, touch |
| Input | keyboard + mouse in control room; touch on the floor |
| Login | personal account, quick user change at shift change |
| Placement | screen visible without glare; alarm horn / sound per priority |

### 11.4 Historian specification

| Tag class | Storage | Example interval / deadband | Retention (your decision) |
|---|---|---|---|
| Analog process (temperature, pressure, vibration, power) | exception + max interval | deadband 0.5 % of range, max 60 s | 2 years raw, 10 years 1-min / 1-h aggregates |
| States, modes, steps | on change | – | 2 years |
| Counters | on change | – | 10 years (quality evidence) |
| Alarms and events, audit | every record | – | per quality / legal rule (e.g. 10 years) |
| Fast data (test-bench curves, vibration spectra) | separate store (files / database) linked by serial number | – | per product |

### 11.5 Network, time server and power (SCADA side)

* OT network per guide 05 11.9; SCADA servers in the Operations zone (5.7).
* Firewall rules: SCADA → PLC TCP 4840 only; MES ↔ SCADA defined ports; no internet.
* 2 NTP sources; switches with redundant power; UPS for servers, core switches, firewall (10.9).

### 11.6 HMI style guide – rules to give every supplier

| Element | Rule |
|---|---|
| Background | light or mid grey, no pictures |
| Normal values | dark grey / black text, no colour |
| Equipment state "running / stopped" | grey shades and text or symbol – **not** green / red (red is reserved for alarms) |
| Alarm priority colours | priority 1 red, priority 2 orange, priority 3 yellow – **always with shape and number** (e.g. square "1", triangle "2", inverted triangle "3"; define one set) |
| Bad quality | value replaced or crossed, magenta or hatched (choose one, never used for anything else) |
| Fonts | one sans-serif font; values ≥ 12 pt on control-room screens (example) |
| Units | always shown, SI units (°C, bar, mm/s, kW) |
| Decimals | match accuracy (10.1) |
| Navigation | same position on every screen; ≤ 3 clicks from overview to any faceplate |
| Faceplate | same layout for all machines of a type: values with limits, small trend, state, step number, alarms, commands at the bottom |
| Commands | confirmation for Stop, Maintenance, line commands, limit changes; disabled (greyed) when not allowed, with the reason |
| Language | one operator language; texts from the alarm list (no free texts in the PLC) |

Stack lights and push buttons on the machine follow IEC 60204-1 colours (guide 05, 11.11).

### 11.7 Alarm priorities (definition)

| Priority | Name (twin) | Consequence if no action | Max time to respond (example) | Sound | Expected share |
|---|---|---|---|---|---|
| 1 | critical | injury risk, machine damage, line stop | < 3 min | continuous horn | ~5 % |
| 2 | serious | production loss, quality risk | 3–10 min | intermittent | ~15 % |
| 3 | warning | small loss, maintenance needed soon | 10–30 min | single tone | ~80 % |
| – | event / message (no alarm) | no operator action required | – | none | – |

Priority = from the matrix "consequence severity × time to respond" in the alarm philosophy (5.3). E-stop
pressed is shown as priority 1 so everybody knows why the line stopped.

### 11.8 Tag database fields

The tag list is the document `VC-ITS-TAG-0001` (doc 15). Fields:

| Field | Example (HMC01 spindle temperature) |
|---|---|
| Tag name | MCH_L2_HMC01_SpindleTemp |
| Description | Spindle housing temperature |
| Area / line / machine / signal | MCH / L2 / HMC01 / SpindleTemp |
| Data type | REAL |
| Unit, decimals | °C, 1 |
| Engineering range lo / hi | 0 / 150 |
| Source PLC | PLC-01 (10.51.0.11) |
| Source node | `ns=3;s="MCH_L2_HMC01_IF"."SpindleTemp"` (interface DB12) |
| I/O list reference | `%IW80`, `+FLD-BT1`, 4–20 mA (guide 05, 11.12; `VC-ELE-IOL-0001`) |
| Sampling / publishing / deadband | 500 ms / 1000 ms / 0.1 °C |
| Access | read only (read/write only for `_Sp` tags) |
| Write limits, write role | – (e.g. `MCH_L2_HMC01_Speed_Sp` 50–130 %, Operator) |
| Historian | yes, exception, deadband 0.5 °C, max interval 60 s, class "analog process" |
| Alarm limits (parameters) | `MCH_L2_HMC01_SpindleTemp_Hi` = 75, `_HiHi` = 85 (no `_Lo` / `_LoLo`) |
| Alarm deadband, delays | 2.0 °C, on 5 s / off 5 s |
| Alarm IDs, priority | HMC01_A5101 (priority 3), HMC01_A5102 (priority 2) |
| Suppression group | machine HMC01 in maintenance (`MCH_L2_HMC01_State = 5`) |
| Owner, revision, date | process engineering, rev A, 2026-11-11 |

### 11.9 Alarm list – rationalization records (filled examples)

Alarm IDs follow doc 15 §3.10: `<Machine>_A<gnnn>` with group digit g: 0 system/communication, 1 safety,
2 hydraulics, 3 pneumatics, 4 drives/axes, 5 process values, 6 tool/NC, 7 material handling, **8 step-chain
timeout (sss = step number)**, 9 maintenance. Alarm list document: `VC-ITS-ALM-0001`.

| Alarm ID | Condition | Limit / deadband / delay | Priority | Cause | Consequence | Operator action | Time to respond | Suppression |
|---|---|---|---|---|---|---|---|---|
| HMC01_A5101 Spindle temperature high | SpindleTemp ≥ _Hi | 75 °C / 2 °C / 5 s | 3 | coolant low, chiller fault, bearing wear | spindle damage if it continues | check coolant flow, chiller; call maintenance | 30 min | machine in maintenance |
| HMC01_A5102 Spindle temperature very high | SpindleTemp ≥ _HiHi | 85 °C / 2 °C / 2 s | 2 | as above, advanced | spindle damage, scrap | stop at cycle end, call maintenance | 5 min | maintenance; hides A5101 |
| HMC01_A5103 Spindle temperature sensor fault | quality Bad | – / – / 1 s | 3 | wire break, sensor fault | temperature not monitored | call electrician | 30 min | maintenance |
| HMC01_A5111 Spindle vibration high | SpindleVib (1-min avg) ≥ _Hi | 4.5 mm/s / 0.3 / avg | 3 | bearing wear, unbalance | bearing failure in days–weeks | plan bearing check | shift | maintenance |
| HMC01_A5112 Spindle vibration very high | SpindleVib ≥ _HiHi | 7.1 mm/s / 0.3 / avg | 2 | bearing damage | breakdown | stop, maintenance | 10 min | hides A5111 |
| HMC01_A4001 CNC / drive fault | CNC Fault = 1 | – | 1 | CNC alarm (number in text) | machine stopped | read CNC alarm, repair | 3 min | – |
| HMC01_A1001 E-stop pressed | EStop_Ok = 0 | – | 1 | E-stop pressed | line stopped | find reason, release, local reset, start | 3 min | – |
| HMC01_A0011 OPC UA connection SCADA ↔ PLC lost | node status Bad / LifeCounter frozen | – / – / 10 s | 2 | network, PLC down | blind for this machine | check network / PLC | 10 min | – |
| HMC01_A8010 Timeout step 10 | step 10 > 5 s | – | 2 | CNC not in AUTO, CNC alarm | cell stops | check CNC, reset | 10 min | – |
| HMC01_A7003 AGV handshake timeout | E84 answer missing | agreed time | 2 | AGV / station signal | pallet not delivered | check AGV and docking | 10 min | – |
| AGV01_A9010 Battery low (example number) | battery < 15 % | 15 % / 3 % / 30 s | 3 | charging missed | AGV stops | check charging station | 30 min | AGV in maintenance |

The number ranges inside each group (e.g. A51xx for spindle values) are *examples* – keep the register of used
numbers in `VC-ITS-ALM-0001`. Store-empty alarms belong to the store or the consuming machine (e.g. group 7) –
define the owner in the alarm list.

### 11.10 User roles and security

As 5.6 and 5.7. Specification items: personal accounts, password rules or smart cards, role list approved by the
production manager, audit trail read-only, account review every 6 months (example), USB ports disabled on clients.

---

## 12. Identification and numbering

Master: `docs/15_numbering_and_identification.md` (doc 15). **If different, doc 15 wins.** Items that doc 15
does not define yet are marked *proposal – add to doc 15*.

### 12.1 Tags (doc 15 §3.10)

`<Area>_<Line>_<Machine>_<Signal>[_Suffix]`, e.g. `MCH_L2_HMC01_SpindleTemp` – identical to the PLC symbol and
the OPC UA variable name (guide 05, 12.1).

* Areas: MCH, ASM, TST, PNT, FIN, LOG, UTL. Machining lines: **L1 crankshaft, L2 crankcase FMS cell,
  L3 cylinder**; `L0` = equipment for the whole area (e.g. `LOG_L0_AGV01_…`).
* Fixed signal words: `Temp`, `Press`, `Flow`, `Vib`, `Power`, `Energy`, `Speed`, `Pos`, `Current`, `Level`,
  `Count`, `State`.
* Suffixes: `_Sp` set point (writable) · `_Cmd` command · `_Fb` feedback · `_Hi` `_HiHi` `_Lo` `_LoLo` alarm
  limit parameters · `_Ok` status OK · `_Cnt` counter. Examples: `MCH_L2_HMC01_Speed_Sp`,
  `MCH_L2_HMC01_Good_Cnt`, `MCH_L2_HMC01_SpindleVib_HiHi`.
* Other forms: OPC UA browse path `MCH/L2/HMC01/SpindleTemp`, MQTT `vc/MCH/L2/HMC01/SpindleTemp`,
  twin (simplified) `HMC-01.Temperature`.

### 12.2 Alarms (doc 15 §3.10)

`<Machine>_A<gnnn>`, e.g. `HMC01_A5101` "Spindle temperature high"; step-chain timeouts `A8sss` with the step
number, e.g. `APCHMC01_A8030` "Timeout step 30 (lift up)". One ID = one row in the alarm list = one
rationalization record. In SCADA the alarm is shown with its ID, machine, text and the tag it belongs to.

### 12.3 Screens (*proposal – add to doc 15*)

| Level | ID | Example |
|---|---|---|
| 1 Plant overview | `SCR1_<Plant>` | SCR1_PLANT |
| 2 Line | `SCR2_<Area>_<Line>` | SCR2_MCH_L2 |
| 3 Machine / faceplate | `SCR3_<Area>_<Line>_<Machine>` | SCR3_MCH_L2_HMC01 |
| 4 Diagnostics | `SCR4_<Area>_<Line>_<Machine>_<Topic>` | SCR4_MCH_L2_HMC01_IO |

### 12.4 OPC UA nodes and PLC source

* Endpoint: `opc.tcp://<PLC IP>:4840`; IP plan `10.<VLAN>.0.<host>` (doc 15 §3.13): PLC-01 = `10.51.0.11`.
* Node of a value: `ns=<index>;s="<Area>_<Line>_<Machine>_IF"."<Signal>"` (Siemens S7-1500 form; the namespace
  index is read when browsing – often 3).
* The interface DB number is `DB(10 + b)`, b = station block (guide 05, 12.4; HMC01 = b 2 = DB12). SCADA does not
  need the number, but it helps diagnostics.
* Interface sheet: `VC-IF-ITS-MCH-0001` (MES/SCADA ↔ machining PLCs).

### 12.5 Servers, clients, accounts, files (doc 15 §3.13 where defined)

| Object | Rule | Example |
|---|---|---|
| SCADA server(s) | host name `vc-<area>-<device>`, VLAN 40 `OT-L2-SUP`, hosts .100–.149 | `vc-sup-scada01` = 10.40.0.100, `vc-sup-scada02` (example .101) |
| Historian | VLAN 30 `OT-L3-OPS` | `vc-ops-hist01` (example name / 10.30.0.1xx) |
| Operator clients | VLAN 40 | `vc-sup-cl01` (*proposal*) |
| Personal accounts | first name . last name | anna.meier (example) |
| Service accounts | `svc-<purpose>` (*proposal*) | svc-opcua-scada |
| Report files | `<report>_<area>_<line>_<YYYYMMDD>_<shift>.csv` (*proposal*) | shift_MCH_L2_20261111_A.csv |
| SCADA project version | `MAJOR.MINOR.PATCH` (doc 15 §3.14) + change log | SCADA v1.2.0 |
| Documents | tag list `VC-ITS-TAG-0001`, alarm list / philosophy `VC-ITS-ALM-0001`, network plan `VC-ITS-NET-0001` | |
| Time stamps | ISO 8601, UTC stored | 2026-11-11T08:15:30Z |

---

## 13. Standards – requirements and verification

Always use the current edition; where unsure, the clause is not given ("check clause").

| Number | Title (short) | Requirement for SCADA in this factory | Value / clause | Verification |
|---|---|---|---|---|
| ISA-18.2 / IEC 62682 | Management of alarm systems | alarm philosophy, rationalization, life cycle, KPIs, MOC | 10.5, 11.7, 11.9 | approved philosophy; monthly KPI report |
| EEMUA 191 (guide) | Alarm systems guide | benchmark alarm rates | ~6/h acceptable | KPI report |
| ISA-101.01 | HMI for process automation | style guide, display hierarchy, consistent faceplates | 5.4, 11.6 | style guide review, screen review |
| IEC 62443-3-2 | Security risk assessment, zones and conduits | zone / conduit model, target security level per zone | 5.7 | zone drawing, risk assessment |
| IEC 62443-3-3 | System security requirements and security levels | user identification, use control, audit, network segmentation | SL per zone | requirement checklist with the vendor |
| IEC 62443-2-4 | Requirements for service providers | integrator security practices | – | contract clause, audit |
| IEC 62541 | OPC UA | client/server, security Sign & Encrypt, subscriptions, methods | port 4840 | browse/read/write/method tests |
| IEC 60204-1 | Electrical equipment of machines | colours of lamps/buttons on panels; stop categories; SCADA is **not** a safety device | guide 05 §11.11 | inspection |
| ISO 13850 | Emergency stop | reset must not start; reset locally | guide 05 | test: SCADA cannot reset |
| ISO 13849-1 / IEC 62061 | Functional safety | no safety function in SCADA | – | design review |
| IEC 81346 | Reference designation | device names shown in diagnostics screens | guide 05 §12.2 | review |
| ISO 8601 | Date and time format | time stamps in reports and exports | – | check exports |
| ISA-95 / IEC 62264 | Enterprise–control integration | level model L0–L4; SCADA ↔ MES interface | 3.1 | interface specification |
| ISO 22400-2 | KPIs for manufacturing operations management | OEE and other KPI definitions | 3.10 | report check against hand calculation |

---

## 14. Complete worked example – station HMC01 in SCADA end to end

Station `MCH_L2_HMC01` (crankcase FMS cell, line L2), `PLC-01` at `10.51.0.11`, station block b = 2,
interface DB12. The PLC side (I/O, wiring, code, PL) is guide 05, chapter 14. All values are *examples*.

### 14.1 PLC interface data type (what SCADA may see)

```
TYPE UDT_StationIF :
STRUCT
    State        : INT;    // 0 RUNNING, 1 SETUP, 2 STARVED, 3 BLOCKED, 4 DOWN, 5 MAINTENANCE, 6 STOPPED, 7 OFFLINE
    Step         : INT;    // step chain number
    Safety_Ok    : BOOL;   // E-stop + door + reset OK
    RunEnable    : BOOL;
    SpindleTemp  : REAL;   // degC (scaled in the PLC)
    SpindleVib   : REAL;   // mm/s RMS
    CoolantPress : REAL;   // bar
    Power        : REAL;   // kW
    SpindleSpeed : REAL;   // 1/min
    ProgramNo    : INT;    // 2102 shown as "O2102" (doc 15 NC numbers)
    Good_Cnt     : DINT;
    Scrap_Cnt    : DINT;
    Speed_Sp     : REAL;   // %, written by SCADA, PLC limits to 50..130
    AlarmBits    : DWORD;  // bit 0 A5101, bit 1 A5102, bit 2 A5103, bit 3 A8010, bit 4 A4001, bit 5 A1001 ...
    LifeCounter  : INT;    // +1 every second - SCADA checks that it changes (heartbeat)
END_STRUCT
END_TYPE
```

Methods (OPC UA, in the PLC): `StartRequest()`, `StopAtCycleEnd()`, `ResetFault()` – each returns Good or
`Bad_ConditionNotMet` with the reason (e.g. "Safety_Ok = 0 – reset E-stop locally").

### 14.2 Connection

| Setting | Value (example) |
|---|---|
| Endpoint | `opc.tcp://10.51.0.11:4840` (firewall: only from the SCADA/MES servers in VLAN 40/30) |
| Security | Sign & Encrypt, policy Basic256Sha256 or newer; anonymous off |
| User | `svc-opcua-scada` (read + write `Speed_Sp` + call methods) |
| Subscription | publishing 1000 ms; sampling 500 ms; deadband 0.1 (absolute) for REAL values |
| Heartbeat | LifeCounter not changing for 10 s → tags Bad + alarm `HMC01_A0011` |

### 14.3 Tags

The table in guide 05, 14.7 plus the fields of 11.8. Result for this station: **15 tags** (State, Step,
Safety_Ok, RunEnable, SpindleTemp, SpindleVib, CoolantPress, Power, SpindleSpeed, ProgramNo, Good_Cnt, Scrap_Cnt,
Speed_Sp, AlarmBits, LifeCounter), each with the prefix `MCH_L2_HMC01_`, plus the limit parameters
`_Hi` / `_HiHi` / `_Lo` of the alarmed values.

### 14.4 Alarm: rationalization record of `HMC01_A5101` (spindle temperature high)

| Field | Value |
|---|---|
| Tag / condition | MCH_L2_HMC01_SpindleTemp ≥ MCH_L2_HMC01_SpindleTemp_Hi (75 °C) |
| Deadband / delay | 2 °C (OFF below 73 °C) / on 5 s, off 5 s |
| Why 75 °C | machine supplier: max spindle housing temperature e.g. 85 °C → `_HiHi` at 85, `_Hi` 10 K earlier (example – get the real value) |
| Time to consequence | rise 85 − 75 = 10 K at about 1 K/min (from historian) → ≈ 10 min |
| Operator time to act | check coolant and chiller: ≈ 5 min → 5 s delay + 5 min < 10 min ✓ |
| Priority | consequence "machine damage" but time 10–30 min → 3 (warning); HMC01_A5102 → 2 |
| Operator action | check coolant flow and chiller; call maintenance; note in alarm comment |
| Suppression | while `MCH_L2_HMC01_State = 5` (maintenance); hidden while HMC01_A5102 is active |
| Approved by / date | process engineering / production, rev A, recorded in `VC-ITS-ALM-0001` |

### 14.5 Faceplate `SCR3_MCH_L2_HMC01`

Top: name, state (text + grey symbol), step number with text ("Step 20 – in cycle"), program O2102.
Middle: SpindleTemp 41.2 °C with _Hi 75 / _HiHi 85 marks on a bar; SpindleVib 1.8 mm/s with 4.5 / 7.1; small
1-hour trend of both. Counters: good / scrap. Bottom: buttons Start request, Stop at cycle end, Reset fault,
Speed set point (50–130 %), each greyed out with the reason when the PLC would refuse (e.g. Safety_Ok = 0).

### 14.6 Historian for this station

| Tags | Mode | Samples/day (estimate) |
|---|---|---|
| SpindleTemp, SpindleVib, CoolantPress, Power, SpindleSpeed (5) | exception, deadband 0.5 % of range, max 60 s | ≥ 5 × 1440 = 7 200 minimum; with changes assume 5 × 8 640 (every 10 s) = 43 200 |
| State, Step, Safety_Ok, RunEnable, ProgramNo, AlarmBits (6) | on change | e.g. 2 000 |
| Good_Cnt, Scrap_Cnt (2) | on change | 2 × 400 parts = 800 |
| Speed_Sp (1) + audit | on change | < 50 |
| **Sum** | | ≈ 46 000 samples/day × 16 B ≈ **0.74 MB/day ≈ 270 MB/year** |

16 machines ≈ 4.3 GB/year – well inside the disk sizing of 10.6.

### 14.7 Command and audit example

Operator `anna.meier` sets speed 110 % on client `vc-sup-cl01`:

```
OPC UA Write  ns=3;s="MCH_L2_HMC01_IF"."Speed_Sp" = 110.0  → Good
Audit record: 2026-11-11T08:15:30Z | anna.meier | vc-sup-cl01 | write | MCH_L2_HMC01_Speed_Sp | 100 -> 110 | Good
```

Start request during E-stop:

```
OPC UA Call   StartRequest()  → Bad_ConditionNotMet "Safety_Ok = 0 – reset E-stop locally"
Audit record: … | anna.meier | vc-sup-cl01 | call | MCH_L2_HMC01 StartRequest | – | refused: Safety_Ok = 0
```

### 14.8 Tests (SCADA part)

1. Loop check: 12 mA on `%IW80` → faceplate 75.0 °C, `HMC01_A5101` comes after 5 s; lower the current to
   11.7 mA (≈ 72 °C, below 73 °C) → the alarm clears after 5 s.
2. Open the sensor wire → `HMC01_A5103`, value shown as Bad (11.6 rule).
3. Unplug the PLC network cable → after 10 s all 15 tags Bad + `HMC01_A0011`.
4. Write `Speed_Sp` 140 → PLC limits to 130 (or SCADA refuses above 130); audit shows old → new value.
5. Start request with Safety_Ok = 0 → refused with reason; after local reset → accepted.
6. Role test: viewer cannot write; operator cannot change alarm limits.
7. Historian: trend of the test values visible; restart historian → no gap (store-and-forward).

---

## 15. Data you still need

| Data | From whom | Needed for |
|---|---|---|
| Screen IDs, client host names, service-account and report-file rules (proposals in 12.3/12.5, not yet in doc 15); register of used alarm numbers | numbering owner (doc 15), IT/OT | chapter 12 |
| Operator positions and which machines each one supervises | production management | alarm rate targets (10.5) |
| Chosen SCADA product, its licence model and sizing tool, bytes per sample and compression | vendor | 10.6, 11.1, 11.2 |
| PLC OPC UA server limits (max monitored items, sessions, min sampling) | PLC vendor data sheet | 10.7 |
| Real alarm limits and allowed temperatures / vibration per machine | machine suppliers, process engineering | 11.9, 14.4 |
| Process time constants (how fast temperature rises) | historian data after start-up, supplier | delays and priorities (10.4, 14.4) |
| Alarm philosophy decisions: priorities matrix, shelving times, suppression rules | your alarm team | 5.3, 11.7 |
| Retention rules (quality, customer, legal) | quality / legal | 11.4 |
| IEC 62443 target security level per zone; firewall rules | OT security / IT | 5.7, 13 |
| Server room, UPS, cooling, time source (GPS/DCF) | site / IT | 10.9, 10.10 |
| MES interface definition (which tags, which direction) | MES project (guide 04) | 11.1 |
| Operator language and texts | production | 11.6 |
| Measured signal noise for deadbands | historian after commissioning | 10.4 |

---

## 16. Glossary

| Term | Meaning |
|---|---|
| SCADA | Supervisory Control And Data Acquisition – control-room software (Level 2) |
| Tag | one named value with address, unit, quality, time stamp |
| Quality | trust level of a value: Good / Bad / Uncertain |
| Mimic | overview drawing of the plant with live values |
| Faceplate | small window of one machine with values, alarms, commands |
| Set point | target value written by the operator (e.g. speed 110 %) |
| Alarm | signal that needs an operator action |
| Event / message | information without required action |
| Limit HIGH / HIGH-HIGH | first and second alarm level of a value |
| Deadband (hysteresis) | value must go below limit − deadband before the alarm clears |
| Acknowledge (Ack) | operator confirms he has seen the alarm |
| Cleared, not acknowledged | alarm condition gone, but not yet seen by the operator |
| Shelve | hide an alarm for a limited time, with reason |
| Suppression | rule-based hiding of alarms (e.g. during maintenance) |
| Standing / stale alarm | alarm active for a long time |
| Chattering alarm | alarm that switches ON/OFF many times quickly |
| Bad actor | an alarm that creates a large share of all alarms |
| Alarm flood | many alarms in a short time |
| Alarm rate | new alarms per hour (per operator) |
| ISA-18.2 | standard for alarm management in process industries (also IEC 62682) |
| EEMUA 191 | guide for alarm systems (benchmark values) |
| ISA-101 | standard for HMI design |
| IEC 62443 | standard series for industrial cyber security (zones, conduits, security levels) |
| DMZ | demilitarized zone – network between IT and OT |
| Historian | time-series database of tag values |
| Store-and-forward | buffering data locally when the server is not reachable |
| Audit trail | record of who did what and when |
| OEE | Overall Equipment Effectiveness = Availability × Performance × Quality |
| OPC UA Write / Call | write a value / call a method in the PLC |
| MOC | Management of Change – controlled approval of changes |
| NTP | Network Time Protocol – clock synchronization |
| 27648 | Siemens raw value for 20 mA (100 % of range) |
| StatusCode | OPC UA quality of a value; top bits 00 Good, 01 Uncertain, 10 Bad |
| Sampling / publishing interval | how often the OPC UA server checks a value / sends changes to the client |
| Fleeting alarm | alarm that clears again within a few seconds |
| Stale alarm | alarm active for more than 24 h (common definition) |
| Rationalization | review of each alarm: cause, consequence, action, time to respond, priority, limit |
| Interface DB | PLC data block with the values SCADA / MES may use; `DB(10 + b)` in this project |
| LifeCounter | value the PLC increments every second so SCADA can detect a frozen connection |
| MTBF / MTTR | mean time between failures / mean time to repair; A = MTBF / (MTBF + MTTR) |
| UPS | uninterruptible power supply |
| Alarm ID | `<Machine>_A<gnnn>` – unique alarm number (doc 15), g = group digit |
| Tag suffix | `_Sp`, `_Cmd`, `_Fb`, `_Hi`, `_HiHi`, `_Lo`, `_LoLo`, `_Ok`, `_Cnt` (doc 15) |
