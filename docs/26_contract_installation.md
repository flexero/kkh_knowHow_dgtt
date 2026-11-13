# Contract – Installation tab (internal, for the builders)

User request (2026-11-12): "how can I install the CNC machines in factory? how to align machines and elements, wiring or
protect noise, or electric wire etc. to prevent vibration, etc. plz build new tab as installation tab in more detail."
Reader = mechanical engineer, non-native English → **simple English, short sentences, formulas with example numbers and
tables, every value labelled "example" / "check with the machine maker's installation manual"**. Must be real and detailed
"for real manufacture" (real standards, real instruments, real tolerances, real procedures, real failure modes).

## Shell (DONE – do not change, except where noted)
* Tab button `data-tab="inst"` "Installation", section `#tab-inst`, `TABS` in app.js contains `"inst"`.
* Item nav buttons `[data-initem="1".."5"]`, intros `#inIntro1..5`, containers `#inItem1..5` (1 visible, others hidden).
* `web/inst.js` = item switch. It dispatches `window` event `CustomEvent("initemshow", {detail:"N"})` on every item
  change AND every time the Installation tab is shown. `window.inCtl = {showItem(n), current(), tabVisible()}`.
  Deep link `/?initem=N#inst`. **Build your item lazily**: on `initemshow` with your number, or at module load when
  `window.inCtl && inCtl.current() === "N"` (the deep link may fire before your module loads). Pause animations when hidden.
* Script tags already in index.html (type="module"): `inst.js`, `instmech.js`, `instelec.js`, `instseq.js`.
  CSS files already linked: `instmech.css`, `instelec.css`, `instseq.css` (currently placeholders – you own yours).
* Do NOT edit index.html, app.js, style.css, inst.js, README.md, docs/00_INDEX.md or another builder's files.
  You may *read* everything. Use the CSS variables of style.css (`--text --text-2 --border --surface --accent
  --good-text --serious --critical` …) so dark theme works; existing card markup: `<div class="card"><div class="card-head"><h2>…`.

| Builder | Items | Files (own) | Guide | Test port | Scratch |
|---|---|---|---|---|---|
| A mechanical | 1 Foundation/anchoring/vibration · 2 Levelling/alignment/geometric acceptance | `web/instmech.js` (+ `instmech_*.js` if needed), `web/instmech.css` | `docs/26_installation_foundation_alignment.md` | 8082 | `scratchpad\inA` |
| B electrical | 3 Electrical installation · 4 EMC / cable routing / signal wiring | `web/instelec.js` (+ `instelec_*.js`), `web/instelec.css` | `docs/27_installation_electrical_emc.md` | 8083 | `scratchpad\inB` |
| C sequence | 5 Transport, rigging, utilities, commissioning, run-off | `web/instseq.js` (+ `instseq_*.js`), `web/instseq.css` | `docs/28_installation_sequence_commissioning.md` | 8084 | `scratchpad\inC` |

Offline only: no CDN, no fonts, no build step; stdlib Python. Optional 3D: local `three` via the existing importmap
(`import * as THREE from "three"`; `three/addons/…` → `./vendor/`) and `view3d.js` (`niceControls`). SVG / canvas is fine too.

## Reference machine + factory (shared example data – use these so the three items agree)
From `config/factory.json`: HMC-01/02/03 "Crankcase Machining Center", positions x = −23.3 m, y = −21.2 / −16.4 / −11.6 m
(4.8 m pitch), run power 18 kW, idle 4 kW, spindle 6000 rpm, vibration warn 4.5 mm/s, alarm 7.1 mm/s (ISO 10816-3 style; ISO 20816-3:2022 replaces ISO 10816-3).
Pallet 500 × 500 mm, pallet 110 kg + workpiece 400 kg (HMC / Pallet-changer tabs). Line also has WASH, VMC, robot cell, conveyors.

Example HMC 500 data (typical catalogue class – label as example):
* Machine mass 12 000 kg (+ coolant tank 800 L + chip conveyor 600 kg + APC). Footprint with APC ≈ 2.8 m × 5.2 m, height 3.0 m.
* Levelling: 6 levelling bolts on steel pads (3 main + 3 auxiliary style is acceptable), M30 jack bolts, optional M24 anchors.
* Axes: rapid 60 m/min, acceleration 0.6 g; moving column ≈ 1 800 kg; table + pallet + work ≈ 900 kg.
* Electrical: 3×400 V ±10 %, 50 Hz, TN-S, connected load 45 kVA, run 18 kW. Servo + spindle drives (PWM 8 kHz).
* Compressed air 0.5–0.6 MPa dry (ISO 8573-1 class 1.4.1 example), ≈ 300 NL/min peak. Coolant: emulsion 6–8 %, through-spindle 7 MPa option.
* Room: 20 ± 2 °C recommended for precision, gradient ≤ 1 K/m, no direct sun / door draught.

## Common style
Each item = several cards: explanation ("What / Why / How / Check / Typical mistake"), an **interactive** part (calculator,
simulator, plan, checklist), tables with real values, and the "what to check with the maker" list. Visible labels "example".
Charts: thin marks, one y-axis per chart, legend for ≥ 2 series, text in text colours.
Test params you add: prefix `&im…` (A), `&ie…` (B), `&is…` (C); a `&…test` param that logs self-check lines to the console.
Headless check: `"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir=<scratch>/ud
--timeout=9000 --screenshot=… --window-size=1400,2000 "http://127.0.0.1:<port>/?initem=N#inst"` with the real server
`python server.py --port <port>` started from the repo root (plain http.server gives /api/config JSON errors).
`--virtual-time-budget` hangs – do not use it. Note app.js shows the tab only on window load; if you need the load event
to wait, add a test-only hold param like robotckt.js `&ckhold` (read it to copy the trick).

**NEVER touch port 8080 (the user's server, PID 23248).** Stop your own server at the end.

## Final report (to the lead)
What you built, verified numbers (hand check of the main formulas), files, test results, open issues, and two text
snippets for the lead to paste: (1) a README table row, (2) a README section "Installation: … principles" (≈ 25–50 lines,
formulas + example numbers), and (3) a docs/00_INDEX row in the existing table format.
