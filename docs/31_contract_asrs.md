# Contract – AS/RS raw materials tab (internal, for the builders)

User request (2026-11-12): "AS/RS managing raw materials – real digital 3D twin build for manufacturing in the factory directly.
New tab. Structure: machining (mechanical) system, controlling system, PLC circuit, and ERP / MES etc. for that."
Reader = mechanical engineer, non-native English → **simple English, formulas with example numbers, tables, every value
labelled "example – the AS/RS supplier's offer decides"**. Real detail "for real manufacture": real standards, real parts,
real design values, real failure modes. Standing rules: every guide gets theory + formulas + worked examples, **"Buy list –
catalogue examples"** tables (real makers + series, data only if confident else "see datasheet", price class "estimate –
ask for a quote", what to check) + a shopping list, and **real drawings as SVG files** (docs/img/NN_*.svg, copied to web/img/).

## Shell (DONE – do not change)
* Tab `data-tab="asrs"` "AS/RS raw materials", section `#tab-asrs`, items `[data-sritem="1".."4"]`, intros `#srIntro1..4`,
  containers `#srItem1..4`. `web/sr.js` = item switch: window event `CustomEvent("sritemshow",{detail:"N"})` on each item change and
  each time the tab is shown; `window.srCtl = {showItem, current(), tabVisible()}`; deep link `/?sritem=N#asrs`.
  **Build lazily** on the event with your number, or at module load when `srCtl.current()==="N"` and the tab is visible.
* Script tags (type="module") already in index.html: `sr.js`, `asrs3d.js` (A), `asrsctl.js` (B), `asrsckt.js` (C), `asrswms.js` (D).
  CSS already linked: `asrs1.css` (A), `asrs2.css` (B), `asrs3.css` (C), `asrs4.css` (D) – placeholders, you own yours.
* Do NOT edit index.html, app.js, style.css, sr.js, asrscore.js, README.md, docs/00_INDEX.md or another builder's files.

## Shared core – `web/asrscore.js` (DONE, tested – read it fully; do not change it; you may add helpers in your own files)
`import { getASRS, RACK, CRANE, IO, SKU, SKUS, slotPos, slotId, trapTime, trapPos, moveTime, lhdTime, fem9851 } from "./asrscore.js"`.
`const A = getASRS()` returns the ONE shared instance `window.ASRS = {RACK, CRANE, IO, SKU, SKUS, sim, fem, …}`; the sim clock runs at
10 Hz for the whole page. `A.sim` has: `t` (s), `speed`, `running`, `slots[]` (`id side bay k level x y z load{sku,qty,kg,lot,inDate} reserved blocked`),
`byId`, `crane {x, z, fork (−1 L … 0 … +1 R), carrying, phase, plan, vx, vz, mode, energyWh}`, `queue[]`, `done[]` (jobs `{id,type,sku,qty,slot,tReq,tStart,tEnd,state,src,err}`),
`inConv[]`, `outConv[]`, `stats`, `rates {storePerH, retrievePerH, dual}`, `estop`, `faults {crane, scanner, slotBlocked, convJam, overload}`, `log[]`;
methods `step(dt)`, `on(ev, cb)` (events "tick", "job", "stock", "fault", "log"), `addJob(type, sku, src)`, `setFault(k, v)`, `setEstop(v)`,
`stock()`, `fill()`, `kpi()`, `logMsg(msg, lvl)`.
Geometry (metres): x along the aisle (0 = crane transfer point at the I/O conveyors, rack starts at `RACK.x0` = 1.2), y across (crane axis 0,
side L = −y, side R = +y), z up from the floor. Rack: 2 sides × 14 bays × 2 crates × 7 levels = **392 slots**, bay pitch 1.925 m, level pitch
1.25 m (L1 0.45 m … L7 7.95 m), crate 1.2 × 0.8 × 0.6 m, max 300 kg, aisle 1.5 m, rack length 27.05 m, height 9.5 m. Crane: travel 3 m/s,
0.5 m/s²; hoist 1 m/s, 0.5 m/s²; fork 1.0 m/s, 1.2 m/s² (≈ 2.2 s each way); fine positioning 3 s; moving mass 4 200 kg (example).
FEM 9.851: SC 34.8 s (103 jobs/h), DC 57.8 s (125 jobs/h). Raw materials: crankcase castings VC10/VC20/VC30, cylinder castings,
crankshaft forgings (unit loads from config `asrs[0].unit_load`). These numbers agree with guide 03 §10.2 / §19 – stay consistent.
Faults are SHARED: if item 2 injects "crane fault", item 1 shows it, item 3's contacts change, item 4 sees jobs waiting. Use `sim.setFault`.

| Builder | Item | Own files | Guide | Port | Scratch |
|---|---|---|---|---|---|
| A | 1 Mechanical system – 3D twin | `web/asrs3d.js` (+ `asrs3d_*.js`), `asrs1.css` | `docs/31_asrs_mechanical_3d.md` | 8082 | `scratchpad\srA` |
| B | 2 Control system | `web/asrsctl.js` (+ `asrsctl_*.js`), `asrs2.css` | `docs/32_asrs_control_system.md` | 8083 | `scratchpad\srB` |
| C | 3 PLC + electrical circuits | `web/asrsckt.js` (+ `asrsckt_*.js`), `asrs3.css` | `docs/33_asrs_control_circuits.md` | 8084 | `scratchpad\srC` |
| D | 4 WMS / ERP / MES | `web/asrswms.js` (+ `asrswms_*.js`), `asrs4.css` | `docs/34_asrs_wms_erp_mes.md` | 8085 | `scratchpad\srD` |

Scratch base: `C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\c13f77ba-a4c3-4cb2-a5fe-2f0af9eb46e4\scratchpad\`.

## Common
* Offline only: local `three` via the importmap (`import * as THREE from "three"`, addons `three/addons/…` → `./vendor/`), `view3d.js`
  (`niceControls`). Reuse ideas from `web/robot3d.js` (3D robot cell), `web/robotctl.js` (control item), `web/robotckt*.js` (IEC schematic
  pages with frame, cross-references, live contacts) and `web/robotref.js` (`makeCard` – catalogue card).
* Each item ends with a **"Real components + drawings – catalogue examples" card** built with `makeCard` from `web/robotref.js`
  (read how `web/machref.js` calls it and build the same config from your guide's buy list tables; ids `srCard1..4`).
* Each guide: textbook + reference + design guide (≈ 1 500–2 500 lines), contents list, How to use the page, formulas with worked numbers
  (verify with Python stdlib), buy lists + shopping list, ≥ 8 SVG drawings (offline, viewBox, white background, black + one accent, text
  ≥ 11 px, title block "EXAMPLE – check the AS/RS supplier's documentation", **no ↑ / ↓ characters** (emoji in Chrome)), standards
  register, glossary, checklists, supplier questions, "Next to read".
* Test with the real server `python server.py --port <your port>` from the repo root, headless Chrome
  (`"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir=<scratch>/ud --timeout=12000
  --screenshot=… --window-size=1400,2000 "http://127.0.0.1:<port>/?sritem=N&<hold>#asrs"`); add a test-only hold param like `&ckhold` in
  web/robotckt.js and a `&srNtest` self-check that logs hand-checkable lines. `--virtual-time-budget` hangs – don't use it.
  **NEVER touch port 8080 (the user's server, PID 23248).** Stop your server at the end. Zero console errors; switching items 1↔2↔3↔4 fine.
* Final report: what you built, verified numbers, files, tests, errors found, plus text snippets for the lead: README table row,
  README section "AS/RS: … principles" (25–50 lines), docs/00_INDEX row.
