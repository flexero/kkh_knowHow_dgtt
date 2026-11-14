# 65 – Control architecture: ISA-95 levels, equipment hierarchy, PackML, message flow

> Tab **FMS engineering → item 5** (`/?feitem=5#fmse`). Contract: guide 60. State: **November 2026**.
> Standards named for orientation: IEC 62264 (ISA-95), IEC 61512 (ISA-88), ISA-TR88.00.02 (PackML). Use the current editions.
> Examples only.

## Contents
1. Purpose · 2. Where in the twin · 3. ISA-95 levels · 4. Who decides what · 5. Equipment hierarchy and tag names ·
6. PackML – the standard state machine · 7. One pallet through all levels · 8. Architecture variants ·
9. Real-factory implementation · 10. Checklists · 11. Common mistakes · 12. Limits · 13. Glossary

---

## 1. Purpose

Items 1–4 decided **what** to build. From item 5 on: **how to control it**. Before any circuit or PLC program you
need a clear architecture:

- Which **system** does which job (ERP, MES, cell controller, SCADA, PLC, CNC, safety)?
- Which **decisions** are made where?
- How is the equipment **named** so that PLC, SCADA, MES and drawings use the same names?
- Which **states and commands** does every module have (so the cell controller can drive any module the same way)?
- Which **messages** flow between the levels?

This item fixes the state model and naming that items 8–10 (circuits and PLC library) will use.

---

## 2. Where in the twin

| Part | What you can do |
|---|---|
| **5A** ISA-95 pyramid | Click a level: systems, time frame, functions, data down / up, FMS example. Decision matrix with a quiz |
| **5B** Hierarchy | Example tree enterprise → control module; tag-name builder |
| **5C** PackML | Live state machine: commands, modes, auto state-complete, state numbers, PackTags, log |
| **5D** Message flow | 16 steps of one pallet from ERP order to ERP confirmation, with real message text |
| **5E** Variants | 5 ways to place the cell logic, with pros / cons |

Worked examples elsewhere: Communication tab (protocol layers, messages), SCADA tab, PLC layer in FMS & products,
MES and ERP tabs.

---

## 3. ISA-95 levels

| Level | Name | Systems | Time frame | In an FMS |
|---|---|---|---|---|
| 4 | Business planning & logistics | ERP | months – days | Releases production orders, MRP, purchasing, costs |
| 3 | Manufacturing operations management | MES / MOM, QMS, CMMS, WMS, DNC, tool management | shifts – minutes | Schedules jobs, kit check, tracks serials, quality, OEE |
| 2 | Supervisory control | Cell controller, SCADA / HMI, historian | minutes – seconds | Pallet → machine, transport orders, alarms, trends |
| 1 | Basic control | PLC, CNC, robot controller, safety PLC, drives | ms – seconds | Sequences, interlocks, handshakes, motion, safety |
| 0 | Physical process | Sensors, actuators, the machine | real time | Cutting, clamping, moving, measuring |

Data goes **down** as orders / jobs / commands and **up** as states / counts / values / confirmations. Each level
aggregates: ERP wants "4 good, 0 scrap, 0.95 h", not 10 000 sensor values.

---

## 4. Who decides what

**Rule:** decide at the **lowest level that has the needed information and time**. Safety is always level 1, hard-wired
or safety PLC – never dependent on a network, PC or MES.

| Decision | Level | System |
|---|---|---|
| Which customer orders this month, how much material to buy | 4 | ERP |
| Sequence of jobs per machine group this shift | 3 | MES scheduler |
| Release a job only with material + fixture + program + tools ready (kit check) | 3 | MES |
| NC program version | 3 | MES / DNC (executed at 1) |
| Which pallet to which free machine **now** | 2 | Cell controller |
| Alarm display and acknowledgement | 2 | SCADA / HMI |
| Stacker motion, pallet change sequence, door, clamp | 1 | PLC / CNC |
| Stop all motion when a guard opens | 1 | Safety PLC / hard-wired |
| Tool life counting | 1 (data to 3) | CNC → tool management |
| Part OK / NOK, OEE, maintenance orders | 3 | MES / QMS / CMMS |

The cell must **keep running for a while without MES / ERP** (local job buffer of e.g. one shift) – production must not
stop because a server is being updated.

---

## 5. Equipment hierarchy and tag names

**Role-based equipment hierarchy** (ISA-95 / ISA-88):
Enterprise → Site → Area → Work centre (cell / line) → Work unit (module) → Equipment module → Control module.

Example: `Example Compressors → Plant 1 → Machining → FMS1 → HMC02 → APC → clamp valve Y1 + pressure switch B3`.

**Tag name** = path through the tree: `PLT1.MACH.FMS1.HMC02.APC.ClampOK`.

Rules:
1. The **same name** in PLC, SCADA, MES, historian, circuit diagram and FAT list.
2. Fixed-length codes (HMC02, not HMC2) – lists sort correctly.
3. Unit codes follow the module standard (M01…M22) with a number.
4. Signals in English, **positive logic** (`ClampOK`, `DoorClosed`), state as noun, command as verb (`CmdStart`).
5. Write the naming rule into the URS (item 1, phase P3) – every supplier must follow it.

---

## 6. PackML – the standard state machine

### 6.1 States (with standard numbers)

| No. | State | Kind | Meaning |
|---|---|---|---|
| 2 | Stopped | wait | Powered, not running |
| 15 | Resetting | acting | Homing, initialising → Idle |
| 4 | Idle | wait | Ready for Start (next job) |
| 3 | Starting | acting | Start-up steps → Execute |
| 6 | Execute | (job) | Doing the job |
| 16 | Completing | acting | Finishing steps → Complete |
| 17 | Complete | wait | Job done, waits for Reset |
| 10 / 11 / 12 | Holding / Held / Unholding | | Pause for an **internal** reason (material at the machine missing, operator, tool) |
| 13 / 5 / 14 | Suspending / Suspended / Unsuspending | | Wait for an **external** reason (no pallet coming, no space downstream) |
| 7 | Stopping | acting | Controlled stop → Stopped |
| 8 / 9 | Aborting / Aborted | | Fast stop on fault / E-stop; needs Clear |
| 1 | Clearing | acting | Faults reset → Stopped |

**Acting states** (…ing) finish by themselves with **SC** (state complete). **Wait states** need a command.

### 6.2 Commands

| No. | Command | From |
|---|---|---|
| 1 | Reset | Stopped, Complete |
| 2 | Start | Idle |
| 3 | Stop | every state except Stopped, Stopping, Aborting, Aborted, Clearing |
| 4 / 5 | Hold / Unhold | Execute / Held |
| 6 / 7 | Suspend / Unsuspend | Execute / Suspended |
| 8 | Abort | every state except Aborting, Aborted |
| 9 | Clear | Aborted |

### 6.3 Modes

Production (all states), Maintenance (no Suspend), Manual (no Hold / Suspend / Complete; jog under safe conditions).
Mode change only in **Stopped, Idle or Aborted** (the twin refuses other changes).

### 6.4 PackTags – the standard data block of every module

| Tag | Content |
|---|---|
| `Command.CntrlCmd` | 1–9 (table 6.2) |
| `Command.CmdChangeRequest` | BOOL, rising edge executes the command |
| `Command.UnitMode` | 1 Production · 2 Maintenance · 3 Manual |
| `Status.StateCurrent` | 1–17 (table 6.1) |
| `Status.UnitModeCurrent` | current mode |
| `Admin.Alarm[]`, `Admin.Warning[]` | number, text, time – same numbering scheme in all modules |
| `Admin.ProdProcessedCount`, `ProdDefectiveCount` | counters for OEE |

Why it matters: the cell controller, SCADA and MES can treat **every module the same way** – HMC, washer, stacker,
robot cell. OEE comes automatically: Execute = running, Suspended = starved/blocked, Held = internal stop, Aborted = fault.

---

## 7. One pallet through all levels (5D)

1. ERP → MES: production order PO 4711, 40 × CC20, due 20 Nov.
2. MES: schedule + **kit check** (castings, fixture, NC program version, tools) → release WO-4711-10.
3. MES → cell controller: job (pallets, fixture, program, allowed machines).
4. Cell → AS/RS: material call to load station LS1.
5. Cell → stacker PLC: bring empty fixture pallet P07 to LS1.
6. Operator clamps 4 parts, scans pallet RFID and serials, releases.
7. LS1 → cell: pallet ready with serials.
8. Cell: HMC-02 Idle + tools OK → stacker moves P07 to HMC-02.
9. Cell → CNC: Request(program, pallet) → Ready → Busy → PackML Execute.
10. CNC → SCADA / historian: live state, loads, tool life.
11. CNC → cell: cycle done, 57.2 min, 4 OK → Complete → Reset → Idle.
12. Cell: 1 in 10 measured → washer → CMM.
13. CMM → MES: measured values per serial (SPC).
14. LS1: unclamp, parts to store, pallet back.
15. Cell → MES: confirmation per job (good, scrap, machine, time) → genealogy.
16. MES → ERP: confirmation (yield, scrap, hours) → stock and cost.

---

## 8. Architecture variants

| Variant | Use when |
|---|---|
| Central cell controller (FMS host) | Classic FMS with pallet pool, 3–10 machines |
| Line / cell PLC as controller | Small cells, fixed flows, assembly |
| Machine builder's FMS software | FMC / FMS of one machine brand |
| MES-driven (no separate cell controller) | Simple cells with slow cycles, modern MES |
| Distributed / service-oriented (skills, plug & produce, MTP idea) | Greenfield, frequent re-configuration |

Common rules for all variants: PackML + standard data block per module; handshakes with time-outs; safety never in the
cell controller; local job buffer when MES / ERP are down; manual fallback per module.

---

## 9. Real-factory implementation

1. Draw the **architecture diagram** in phase P2/P3: systems, levels, networks, who owns which decision (table 4).
2. Write naming and PackML rules into the **URS**; ask every supplier to confirm.
3. For each module define its **PackTags** and **handshakes** (items 9–10) – one interface sheet per module.
4. Decide the variant (5E) – with an owner for the cell logic (integrator or machine builder).
5. Test the message flow (5D) end-to-end at FAT with the real MES test system, including "MES down" and "network down".

---

## 10. Checklists

- [ ] Architecture diagram with levels, systems, networks
- [ ] Decision matrix filled for your project; safety only at level 1
- [ ] Equipment hierarchy and tag naming rule in the URS
- [ ] Every module: PackML states + modes + PackTags documented
- [ ] Message list per interface (content, trigger, time-out, error reaction)
- [ ] Behaviour when MES / ERP / network is down defined and tested

---

## 11. Common mistakes

| Mistake | Result | Better |
|---|---|---|
| Every supplier with its own state names | Cell controller needs special code per machine, OEE not comparable | PackML for every module |
| Safety via the cell PC / network | Not compliant, dangerous | Safety PLC / hard-wired, level 1 |
| MES makes second-level decisions | Slow, cell stops when the server is slow | Cell controller at level 2 |
| ERP talks to machines | No traceability, no kit check | ERP → MES → cell |
| Different names in PLC, SCADA, drawings | Errors at commissioning and maintenance | One tag naming rule |
| No "server down" plan | Production stops at every IT update | Local job buffer + manual mode |

---

## 12. Limits

- PackML comes from packaging; machine tools often use their own CNC states – map them to PackML in the M01 interface
  (item 10).
- ISA-95 is a functional model; real products often cover several levels.
- The message texts in 5D are examples (JSON / REST style); real ones depend on the protocol (item 6).

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **ISA-95 / IEC 62264** | Standard for the integration of enterprise and control systems (levels, models, messages) |
| **ISA-88 / IEC 61512** | Batch control standard – source of the equipment hierarchy and state ideas |
| **PackML** | Packaging Machine Language – standard state model, modes and tags (ISA-TR88.00.02) |
| **PackTags** | Standard data tags of a PackML machine |
| **SC** | State complete – automatic end of an acting state |
| **MOM** | Manufacturing operations management (MES and related functions) |
| **DNC** | Distributed numerical control – NC program management and download |
| **Kit check** | Check that material, fixture, program and tools are ready before a job is released |
| **Cell controller** | Level-2 software / PLC that coordinates the modules of a cell |
| **MTP** | Module Type Package (VDI 2658) – description of a module's services for plug & produce |
