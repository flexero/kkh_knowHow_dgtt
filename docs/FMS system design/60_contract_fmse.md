# 60 – Contract: tab "FMS engineering" (general method for any FMS)

> Working agreement for the tab `#fmse`. Started **2026-11-14**. Built one item at a time.
> All numbers in this tab are **typical ranges or examples** – check them for each real project.

## 1. Goal

Make the user able to **design, control and implement any flexible manufacturing system** in real factories –
not only the compressor or ball-screw factory of this twin. Factories differ (product, volume, process, budget,
existing technology), so the tab teaches the **general method**: workflow, typical elements, calculations,
communication, circuits, programs, MES and ERP theory – and a **module library** to configure each new FMS
instead of inventing it.

## 2. Agreed scope (user, 2026-11-14)

| Point | Decision |
|---|---|
| Process domains | **All**: machining (prismatic + rotational), assembly, robot welding, sheet metal, moulding / casting, electronics, painting |
| Roles | **Both**: factory owner's engineer (specify, buy, accept, run) **and** integrator (design, build, commission) |
| Control content | **Complete modular circuits and PLC programs** for every module, with diagrams, so a whole FMS can be controlled from the library |
| Existing tabs | Stay unchanged; the new tab links to them as worked examples |
| Offline | Yes – local files only, stdlib Python, no internet |

## 3. The 14 items (order)

| # | Item | Guide | Status |
|---|---|---|---|
| 1 | FMS types, project pipeline (2 roles), requirements questionnaire, **module standard** | 61 | ✓ textbook + tools + web 1A–1M (redo 2026-11-14) |
| 2 | Product → process → machines (all domains), part families, machine count | 62 | ✓ textbook + tools + web 2A–2M (redo 2026-11-14) |
| 3 | Typical elements catalogue | 63 | ✓ textbook + tools + web 3A–3E + element guide (redo 2026-11-14) |
| 4 | Capacity, layout, simulation | 64 | ✓ built 2026-11-14 |
| 5 | Control architecture – ISA-95, ISA-88 / PackML | 65 | ✓ built 2026-11-14 |
| 6 | Communication – fieldbuses, OPC UA, MTConnect, MQTT, Modbus TCP, IP plan | 66 | ✓ built 2026-11-14 |
| 7 | Electrical & safety principles | 67 | next |
| 8 | **Module library: complete circuits** per module | 68 | open |
| 9 | PLC programming principles – IEC 61131-3, state machines, handshakes | 69 | open |
| 10 | **Module library: complete PLC programs** per module + cell controller | 70 | open |
| 11 | MES theory + generic MES design | 71 | open |
| 12 | ERP theory + ERP ⇄ MES integration | 72 | open |
| 13 | Implementation in real factories (both roles) | 73 | open |
| 14 | Design kit – complete cases (machining, assembly, welding, sheet metal, moulding) | 74 | open |

## 4. The module standard (fixed in item 1, used by items 3–14)

Every FMS = a set of **modules M01–M22**. Every module has the same **9 faces**:

| Face | Content | Filled in item |
|---|---|---|
| Mechanical interface | mounting, hand-over position + tolerance, guards | 3 |
| Electrical / circuits | power, 24 V DC control, IO list, terminals, cabinet | 7–8 |
| Safety | safety functions, PL required / reached, link to cell safety | 7–8 |
| State model | PackML states 1–17 + commands 1–9 + modes Production / Maintenance / Manual + PackTags (fixed in item 5, guide 65) | 5, 9 |
| PLC function block | one FB per module, standard interface (cmd, status, data, alarms) | 9–10 |
| Hand-over (handshake) | Ready → Request → Busy → Done, timeouts | 9–10 |
| Communication | standard data block words 0–19 (state, mode, command, handshake bits, alarms, counters, job, pallet, cycle, heartbeats) + module part from word 20; Modbus 32-bit high word first (fixed in item 6, guide 66) | 6 |
| HMI & alarms | standard screen, alarm numbers + texts | 9–10 |
| Documents & tests | interface sheet, FAT steps, spare parts, maintenance plan | 11, 13 |

Modules: M01 machine tool interface · M02 APC · M03 pallet rack / pool + stacker · M04 load / unload station ·
M05 robot loading cell · M06 AGV / AMR interface · M07 conveyor / carriers · M08 AS/RS · M09 tool management ·
M10 washer · M11 measuring station · M12 marking & ID · M13 assembly station · M14 test station · M15 robot welding
cell · M16 press / bending / punching · M17 utilities · M18 cell safety controller · M19 cell controller ·
M20 SCADA / HMI · M21 MES / ERP connector · M22 network & IT/OT.

**Rule:** a module never talks directly to another module's internals – only through its FB interface and the
handshake; the cell controller (M19) coordinates. Safety is always hard-wired / safety PLC (M18), never over the
standard network alone.

## 5. Technical rules for the tab

- Files: `web/fmse.js` (switch + item 1), `web/fmse_data.js`, `web/fmse.css`; later items as `web/fmse<N>.js` +
  `web/fmse<N>_data.js`, exporting `mount(el)`, registered in the `mods` map of `build()` in `fmse.js`.
- Item buttons for items not built yet are `disabled` with "(next)"; enable each when built (change status in
  `ITEMS` in `fmse_data.js` and the button in `index.html`).
- Deep links: `/?feitem=N#fmse`; item 1 also `fevar`, `fevol`, `fephase`, `femod`.
- Questionnaire answers are stored only in the browser (localStorage `fmse.answers`) – export Markdown / JSON
  to keep them.
- Each item adds a guide (numbers above) and a row in `docs/00_INDEX.md`.
