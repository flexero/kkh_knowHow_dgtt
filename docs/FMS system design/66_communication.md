# 66 – Communication: protocols, selection, calculations, IP plan, security, the module data block

> Tab **FMS engineering → item 6** (`/?feitem=6#fmse`). Contract: guide 60. State: **November 2026**.
> Standards named for orientation: IEC 61158/61784 (fieldbuses), IEC 61131-9 (IO-Link), IEC 62541 (OPC UA),
> IEC 62443 (industrial security), Modbus Application Protocol, MTConnect, Sparkplug. Typical values / examples.
> Detailed worked examples in other tabs: Communication (protocols by layer, messages), Ball screw factory item 4
> (Modbus TCP + HTTP only).

## Contents
1. Purpose · 2. Where in the twin · 3. Protocol families · 4. Choosing per link · 5. Calculations · 6. IP / VLAN plan ·
7. Security zones and conduits · 8. The standard module data block · 9. Real-factory implementation · 10. Checklists ·
11. Common mistakes · 12. Limits · 13. Glossary

---

## 1. Purpose

Every factory has different rules: one plant is "Siemens only", another "only Modbus TCP and HTTP", a third wants
cloud dashboards. The **method** stays the same:

1. Know the protocol families and what each is good for.
2. Choose a protocol **per link** (sensor, IO, motion, safety, module ⇄ cell, CNC ⇄ MES, MES ⇄ ERP, data out).
3. Check load, cycle time and data volume with simple formulas.
4. Give every device an address in a clear **IP / VLAN plan**.
5. Separate the network into **zones** with controlled **conduits** (security).
6. Give every module the **same data block** – so the cell controller, SCADA and MES read every module the same way.

---

## 2. Where in the twin

| Part | What you can do |
|---|---|
| **6A** Protocol map | 16 protocols: level, type, cycle, data model, ecosystem, use, pros / cons |
| **6B** Selector | 7 questions → recommended protocol per link with reason |
| **6C** Calculators | PROFINET load, EtherCAT cycle, Modbus TCP poll cycle, historian / MQTT volume |
| **6D** IP plan | Site + kit + cell → device list with tags and IP addresses, zone table, CSV export |
| **6E** Security | Zones / conduits diagram (click conduits), flow tester with 10 typical flows |
| **6F** Data block | Standard block of a module mapped to Modbus registers, PROFINET bytes, OPC UA nodes, MQTT topics |

---

## 3. Protocol families

| Family | Protocols | Job | Typical time |
|---|---|---|---|
| Sensor link | IO-Link | Smart sensors, valve terminals, RFID heads | 2–10 ms |
| Cyclic real-time fieldbus | PROFINET, EtherCAT, EtherNet/IP, CC-Link IE | IO, drives, PLC ⇄ PLC inside machine / cell | 0.05–10 ms |
| Safety layer | PROFIsafe, FSoE, CIP Safety | Safety signals over the fieldbus ("black channel") | bus + watchdog |
| Client / server | Modbus TCP (no model), OPC UA (model), MTConnect / umati (machine-tool model) | Jobs, states, values between controllers and supervisory systems | 10 ms – 1 s |
| IT messaging | MQTT (+ Sparkplug B), HTTP REST, B2MML | MES, ERP, historian, dashboards, cloud | 0.1 s – minutes |
| Domain standards | Euromap 77/83 (moulding), IPC-CFX / Hermes (electronics) | Machines of one industry ⇄ MES | ~1 s |

---

## 4. Choosing per link (rules behind 6B)

| Link | Default choice | If "only Modbus TCP + HTTP" |
|---|---|---|
| Sensor → IO | IO-Link + 24 V IO | same |
| PLC ⇄ IO / drives (inside a module) | Company PLC standard bus (Siemens → PROFINET, Rockwell → EtherNet/IP, Beckhoff → EtherCAT …) | machine builder's bus, stays inside the module |
| Fast motion | EtherCAT / PROFINET IRT / CIP Motion | inside the machine |
| Safety between modules | PROFIsafe / CIP Safety / FSoE (if wanted) else hard-wired | **hard-wired** dual channel |
| Module ⇄ cell controller | OPC UA (data) + fieldbus PLC-PLC coupling (fast handshake) | **Modbus TCP – standard data block** |
| CNC → MES / cell | umati or MTConnect (several brands), maker's OPC UA (one brand) | gateway → Modbus TCP / HTTP agent |
| SCADA ⇄ PLC | OPC UA or native driver; writes via cell controller | Modbus TCP (read) |
| MES ⇄ ERP | REST / JSON (B2MML content) | HTTP REST |
| Data out (historian, dashboards) | OPC UA → historian; MQTT Sparkplug via DMZ broker if many consumers | HTTP (SSE / REST) gateway |

---

## 5. Calculations

### 5.1 PROFINET cyclic load

$$ \text{frame} = \max(64,\ d + 10 + 22), \quad \text{wire} = \text{frame} + 20, \quad B = \frac{n \cdot \text{wire} \cdot 8}{T_{cyc}}, \quad \text{load} = \frac{B}{R} $$

Example: 30 devices × 32 bytes, 2 ms, 100 Mbit/s → frame 64 B, wire 84 B → B = 30 × 84 × 8 / 0.002 = 10.1 Mbit/s →
**10 %** (guideline: cyclic real-time load < 50 % per port).

### 5.2 EtherCAT cycle

$$ \text{bytes} = 14 + 2 + 12 + n\,d + 4 + 20, \qquad t = \frac{8\cdot\text{bytes}}{R} + n\,t_{fwd}, \qquad T_{min} \approx 1.25\,t $$

Example: 40 slaves × 16 B → 692 B → 55.4 µs on the wire + 40 × 0.6 µs = 79.4 µs → **≈ 100 µs** shortest cycle.

### 5.3 Modbus TCP poll cycle

$$ r = \left\lceil \frac{\text{registers}}{125} \right\rceil, \qquad T_{poll} = \left\lceil \frac{n}{c} \right\rceil \cdot r \cdot (RTT + t_{resp}) $$

Example: 20 devices × 60 registers, 8 ms response, 1 ms RTT, 4 parallel connections → 5 × 1 × 9 = **45 ms**.
Handshakes need ≤ 100 ms; monitoring ≤ 1 s.

### 5.4 Historian / MQTT volume

$$ v = \text{tags} \times \text{rate}, \qquad \text{storage/day} = v \cdot b \cdot 86\,400 \cdot k $$

Example: 3 000 tags × 1/s × 16 B × 30 % stored → 1.24 GB/day → 908 GB for 2 years. Lower the rate for slow signals
(temperatures 10 s), use deadband, aggregate old data.

---

## 6. IP / VLAN plan

- One **VLAN / subnet per zone** (enterprise 10, DMZ 20, manufacturing 30, engineering 40) and **one per cell**
  (101, 102 …). Subnet `10.<site>.<vlan>.0/24`, gateway `.1` = cell firewall.
- **Fixed ranges per device type** in every cell: .10–.49 PLCs / safety / cell controller · .50–.99 IO, drives, IO-Link
  masters · .100–.149 HMIs, PCs, cameras · .150–.199 CNCs, robots, measuring · .200–.239 temporary · .240–.253 network.
- Tags from item 5: `FMS1.MC02` = machine 2 of cell FMS1. The same tag in the IP list, PLC, SCADA and drawings.
- Real-time fieldbus traffic stays inside the machine or cell VLAN – **never routed**.
- Export the list (CSV) and keep it in the documentation; every change goes through the list first.

---

## 7. Security zones and conduits (IEC 62443)

| Zone | Content | Typical SL |
|---|---|---|
| Enterprise (L4) | ERP, office | SL1 |
| Industrial DMZ (L3.5) | Historian mirror, patch server, jump host, API proxy | SL2 |
| Manufacturing (L3) | MES, SCADA, DNC, WMS | SL2 |
| Cell zones (L1–2) | Cell controller, PLCs, CNCs, HMIs | SL2 |
| Safety (inside each cell) | Safety PLC, safety IO | SL3 |

Rules: **default deny**; conduits only between neighbouring zones; office → cell never direct; remote service only via
jump host (MFA, time-limited, recorded); write access to modules only through the cell controller; safety parameters
never remote; cell devices never talk to the internet; historian replicates outward one-way; personal accounts, USB control,
back-ups, patch plan.

---

## 8. The standard module data block

Words 0–19 are **identical in every module**; module-specific data starts at word 20.

| Word | Name | Type | Direction (module view) | Meaning |
|---|---|---|---|---|
| 0 | Status.StateCurrent | INT | out | PackML state 1–17 |
| 1 | Status.UnitModeCurrent | INT | out | 1 Production · 2 Maintenance · 3 Manual |
| 2 | Command.CntrlCmd | INT | in | PackML command 1–9 |
| 3 | Command.Bits | WORD | in | b0 CmdChangeRequest · b1 HS.Request · b2 HS.Ack · b3 FaultReset |
| 4 | Status.Bits | WORD | out | b0 Ready · b1 Busy · b2 Done · b3 Fault · b4 Warning · b5 Auto · b6 PartPresent · b7 HS.Ready |
| 5 | Command.UnitMode | INT | in | requested mode |
| 6 / 7 | Admin.AlarmNo / WarningNo | INT | out | active alarm / warning number |
| 8–9 | Admin.ProdProcessedCount | DINT | out | OEE counter |
| 10–11 | Admin.ProdDefectiveCount | DINT | out | OEE counter |
| 12–13 | Job.Id | DINT | in | job / work order |
| 14–15 | Job.PalletId | DINT | in/out | pallet / carrier ID |
| 16–17 | Status.LastCycle_s | REAL | out | last cycle time |
| 18 | Status.Heartbeat | UINT | out | +1 per second |
| 19 | Command.Heartbeat | UINT | in | +1 per second from cell controller |

Examples of the module part (word 20+): M01 program number, spindle load, lowest tool life, door / clamp bits;
M03 move from / to, fork position, free places; M06 dock ready-to-give / take bits; M11 program, OK / NOK.

**On each protocol:**
- **Modbus TCP:** holding registers 4xxxx (1-based) = PDU address + 1; read FC03, write FC06 / FC16.
  Example read of words 0–19: `00 01 00 00 00 06 01 03 00 00 00 14`. **Write into the interface sheet:** numbering,
  32-bit word order (this standard: high word first), REAL = IEEE 754, bit 0 = LSB, time-out 500 ms, heartbeat 3 s.
- **PROFINET IO:** module outputs = controller inputs (%IB), commands = controller outputs (%QB); I-device or PN/PN coupler
  with this byte layout.
- **OPC UA:** `Objects/<Unit>/Status/StateCurrent`, NodeId `ns=2;s=<Unit>.Status.StateCurrent`; Sign & Encrypt;
  subscribe status (100–500 ms), write command / job.
- **MQTT Sparkplug B:** `spBv1.0/<group>/DDATA/<edge>/<Unit>`, metric `Status/StateCurrent`; data out only, commands via
  the cell controller.

---

## 9. Real-factory implementation

1. Fill 6B with the customer's rules in phase P1/P3; write the result into the URS (protocol per link).
2. Calculate load / cycle / volume (6C) and choose switch types (managed, IGMP snooping, ring redundancy, IRT if needed).
3. Make the IP / VLAN plan (6D) before the electrical design – addresses go into the circuit diagrams and PLC projects.
4. Agree the zone / conduit model with the IT department; document every allowed flow.
5. Give every supplier the **standard data block** and the interface sheet template; test each module's block at FAT
   with a simple client (Modbus poll / OPC UA client) before integration.

---

## 10. Checklists

- [ ] Protocol per link written in the URS; company rules respected
- [ ] Load / cycle checks done; real-time traffic not routed
- [ ] IP / VLAN plan complete and exported; tags match item 5 naming
- [ ] Zones, conduits, allowed flows, remote access concept approved by IT
- [ ] Every module implements the standard block (words 0–19) + documented module part
- [ ] Word order, numbering, time-outs and heartbeat written in every interface sheet

---

## 11. Common mistakes

| Mistake | Result | Better |
|---|---|---|
| Different register maps per supplier | Special code for every module | Standard data block |
| 32-bit word order not agreed | Wrong counters / REAL values at commissioning | Write "high word first" in the sheet, test at FAT |
| No heartbeat | Cell controller does not notice a dead link | Heartbeat words + 3 s time-out |
| Flat network, everything in one subnet | Broadcast storms, no security | VLAN per zone / cell, firewalls |
| Supplier VPN directly into a machine | Uncontrolled access | Jump host in the DMZ, MFA, recorded |
| MQTT used for control commands | No determinism, security risk | Commands via cell controller |
| Historian at 100 ms for all tags | Disk full, slow queries | Rate per signal type, deadband |

---

## 12. Limits

- Load formulas are simplified (no acyclic traffic, no switch latency). For IRT / TSN use the vendor's planning tool.
- Security: the zone model is a starting point; a real IEC 62443 risk assessment and the IT department's rules decide.
- The data block is a project standard of this guide (based on PackML / PackTags), not an official standard.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| **Cyclic / acyclic** | Data sent every cycle / only on request |
| **Client / server, publish / subscribe** | Request-response vs. broker-based distribution |
| **VLAN** | Virtual LAN – separate network on the same switches |
| **DMZ** | Demilitarised zone – buffer network between office and plant |
| **Zone / conduit** | Group of assets with the same security need / controlled connection between zones (IEC 62443) |
| **SL** | Security level 1–4 |
| **Jump host** | Controlled server in the DMZ for remote access |
| **Heartbeat** | Counter that changes regularly to prove a link is alive |
| **Word order** | Order of the two 16-bit registers of a 32-bit value ("ABCD" vs "CDAB") |
| **Sparkplug B** | Specification for MQTT topics, payloads and state in industry |
| **umati** | OPC UA companion specification for machine tools |
