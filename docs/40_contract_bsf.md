# Contract – Ball screw + profiled linear guide factory tab (internal, for the builders)

User request (2026-11-13): "With only Modbus and Ethernet communication and HTTP – our technology is only like that – keeping the
current work, implement ball screw, nut, profiled linear guide and the manufacturing system: 3D digital twin, MES, ERP,
communication etc., the whole process, newly, in a new tab, fully, one by one."
Reader = mechanical engineer, non-native English → simple English, short sentences, tables, formulas with example numbers,
every value labelled "example – check the maker's catalogue / your supplier". Standing rules: offline only (local three.js
via the importmap, no CDN, stdlib Python), every item gets a textbook-style guide in docs/ (theory, formulas, worked examples,
real design values, "Buy list – catalogue examples" with real makers + price class "estimate – ask for a quote", shopping list,
≥ 8 SVG drawings docs/img/NN_*.svg copied to web/img/, NO ↑ / ↓ characters in SVGs, standards register, glossary, supplier
questions, next to read), and a "Real components + drawings – catalogue examples" card via `makeCard` from web/robotref.js.

## Tab shell (DONE by the lead – do not change)
Tab `data-tab="bsf"` "Ball screw + guide factory", section `#tab-bsf`, item buttons `[data-bfitem="1".."8"]` (2–8 disabled
"(next)" until built – the lead enables them), intro `#bfIntro1` (lead adds the others), containers `#bfItem1..8`.
`web/bsf.js` = item switch: window event `CustomEvent("bfitemshow",{detail:"N"})` on item change and when the tab is shown;
`window.bfCtl = {showItem, current(), tabVisible()}`; deep link `/?bfitem=N#bsf`. Build lazily; pause rendering when hidden.

## Planned items (built one by one)
| # | Item | Guide |
|---|---|---|
| 1 | Products – ball screw, nut, profiled linear guide: design, load ratings, accuracy, 3D | 40 |
| 2 | Manufacturing processes – screw shaft, nut, rail, carriage: every operation in 3D | 41 |
| 3 | Factory layout + live 3D digital twin (lines, machines, AGVs, stores) | 42 |
| 4 | Communication – only Ethernet + Modbus TCP + HTTP | 43 |
| 5 | Quality + inspection | 44 |
| 6 | MES (HTTP) | 45 |
| 7 | ERP (HTTP) | 46 |
| 8 | PLC control programs (Delta + Siemens, reuse web/ladder.js) | 47 |

## Reference products (shared example data – every item uses these)
| Code | Product | Main data (examples – a builder may refine with catalogue-class values, then ALL items follow item 1's data file) |
|---|---|---|
| `BS-3210-1000-C5` | Ground ball screw | shaft Ø32 mm, lead 10 mm, right hand, thread length ≈ 850 mm, total 1 000 mm, 1 start, accuracy grade C5 (ISO 3408-3 / JIS), material shaft 50CrMo4 (SCM / CF53 class) induction hardened 58–62 HRC |
| `BN-3210-FL` | Flanged single ball nut, DIN 69051-5 form B style | ball Ø6.35 mm (1/4"), internal recirculation (deflector) or end-cap (choose one as main, explain the other), preload P1 (≈ 2–5 % C, by ball oversize) or double nut, case-hardened 20CrMo / carburizing steel or 100Cr6, wiper seals |
| `LG-25-1000` | Profiled linear guide rail size 25 | rail width 23 mm, height ≈ 22–24 mm, length 1 000 mm, hole pitch 60 mm, 100Cr6 / C55 induction hardened raceways, accuracy class N/H/P, ball type with 4 raceways at 45° (O-arrangement) |
| `LB-25-FL` | Carriage (block) size 25, flange type | 4-row recirculating balls, preload Z0/Z1/Z2 (0 / ≈ 2 % / ≈ 8 % C), end seals + lubrication nipple, retainer |
Purchased: balls (DIN 5401 / ISO 3290, G5–G10), seals, end caps, deflectors (plastic), wipers, grease, bearings for end supports.
Product family (for MES / ERP later): screws Ø16 / 20 / 25 / 32 / 40, leads 5 / 10 / 20, lengths 300 – 2 000 mm, grades C3 / C5 / C7;
guides size 15 / 20 / 25 / 30 / 35, rail length 300 – 4 000 mm, blocks flange / narrow, preload Z0 / Z1 / Z2.

## Communication rule (applies to items 3–8)
* Physical: Ethernet (100 Mbit / 1 Gbit, star, managed switches, separate machine VLAN).
* Machines / PLCs / test stands / sensors ↔ gateway: **Modbus TCP only** (port 502). Register map convention: holding registers
  4xxxx (0-based offsets in the guide), BOOL in coils or bits of a status word, INT16, REAL = 2 registers big-endian word order
  ("ABCD", state it), strings ASCII 2 chars / register; polling 100 ms (fast status) – 1 s (counters) – 10 s (energy).
* Gateway / MES / ERP / twin / AGV fleet / label printer / browser: **HTTP only** (REST + JSON; Server-Sent Events for live push are
  HTTP). No MQTT, no OPC UA. AGV fleet via its HTTP API (VDA 5050 ideas mapped to HTTP).
* Safety is hard-wired (safety relay / F-PLC), never over Modbus or HTTP.
* Server side (later items): stdlib Python, own routes under `/api/bsf/...` in server.py (lead decides integration), a Modbus TCP
  server / client in stdlib (see tools/spst_modbus_sim.py and tools/spst_gateway.py for existing examples).

## Testing (all items)
Real server `python server.py --port <your port>` from the repo root (background). Console collector:
`PYTHONIOENCODING=utf-8 python -I C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\c13f77ba-a4c3-4cb2-a5fe-2f0af9eb46e4\scratchpad\apcC\cdp.py "<url>" <seconds>`
(favicon 404 is fine). Headless Chrome screenshots: "C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new
--disable-gpu --user-data-dir=<scratch>/ud --timeout=15000 --screenshot=… --window-size=1400,2200 "<url>" (WebGL can be blank
headless – copy the canvas via toDataURL into an <img> in a test-only hook to verify). Add a test-only hold param (like `&ckhold`
in web/robotckt.js) and a `&bfNtest` self-check. `--virtual-time-budget` hangs – don't use. **NEVER touch port 8080** (the user's
server). Stop your server at the end. Do NOT edit index.html, app.js, style.css, bsf.js, README.md, docs/00_INDEX.md or other items' files.
Final report: what you built, verified numbers, files, tests, open issues + snippets: README table row, README section (20–40 lines),
docs/00_INDEX row (`| NN | \`NN_….md\` | description | Ball screw + guide factory (item N) | main files |`).
