# Contract – Hydraulics tab (internal, for the builders)

User request (2026-11-12): "hydraulic design, I think that the data is not enough. I want to include more data like lock,
motor, v, q control valves, etc, asap elements all." → A full hydraulic element data book + live standard circuits + a
complete system-sizing calculator. Existing general method: `docs/25_hydraulic_design_method.md` (read it; do not contradict
its example: F 20 kN, stroke 200 mm, 2 s / 2 s, 60 s cycle, p_sys 10 MPa, bore 63 / rod 36 → A 31.17 cm² / annulus 20.99 cm², 18.7 L/min – check
its numbers and keep them consistent). Reader = mechanical engineer, non-native English → **simple English, formulas with
example numbers, tables, every value labelled "example – check the supplier's current catalogue"**. Real detail "for real
manufacture": real standards, real size series, real data ranges, real failure modes. No brand names needed; if you mention
typical makers, say "catalogue class".

## Shell (DONE – do not change)
* Tab button `data-tab="hyd"` "Hydraulics", section `#tab-hyd`, `TABS` contains `"hyd"`.
* Item nav `[data-hyitem="1".."3"]`, intros `#hyIntro1..3`, containers `#hyItem1..3`.
* `web/hyd.js` = item switch: `window` event `CustomEvent("hyitemshow",{detail:"N"})` on each item change and each time the
  tab is shown; `window.hyCtl = {showItem, current(), tabVisible()}`; deep link `/?hyitem=N#hyd`. **Build lazily** on the event
  with your number, or at module load when `window.hyCtl && hyCtl.current()==="N"`. Pause animations when hidden.
* Script tags + CSS links already in index.html: `hydlib.js` + `hydlib.css` (builder A), `hydckt.js` + `hydckt.css` (builder B).
* Do NOT edit index.html, app.js, style.css, hyd.js, README.md, docs/00_INDEX.md or the other builder's files. Use style.css
  variables (`--text --text-2 --border --surface --accent --good-text --serious --critical`) so dark theme works.

| Builder | Item(s) | Own files | Guide | Port | Scratch |
|---|---|---|---|---|---|
| A | 1 Element data book | `web/hydlib.js`, `web/hydlib_*.js`, `web/hydlib.css` | `docs/29_hydraulic_elements_data.md` | 8082 | `scratchpad\hyA` |
| B | 2 Standard circuits · 3 System sizing | `web/hydckt.js`, `web/hydckt_*.js`, `web/hydckt.css`; also update `docs/25_hydraulic_design_method.md` §2 "Where in the twin" (add the new tab) and add "Next to read: 29, 30" | `docs/30_hydraulic_circuits_sizing.md` | 8083 | `scratchpad\hyB` |

ISO 1219-1 symbols: draw as SVG (stroke = currentColor so dark theme works). Builder A writes a reusable symbol module
`web/hydlib_sym.js` (export functions returning SVG strings). Builder B may import it **only if it exists and works when B
starts its circuits**; otherwise B draws its own symbols (prefix them so names never clash). Do not wait for each other.

## Shared standard series (both builders use exactly these – examples, check catalogue)
* Pressure ratings: 6.3 / 10 / 16 / 21 / 25 / 31.5 / 35 MPa (ISO 2944 style). Machine-tool clamps 5–7 MPa, industrial 10–21, mobile 25–35.
* Cylinder bores (ISO 3320): 25 32 40 50 63 80 100 125 140 160 180 200 250 mm. Rods: 12 14 16 18 20 22 25 28 32 36 40 45 50 56 63 70 80 90 100 110 125 140 mm.
  Mill-type ISO 6020-2 (16 MPa) / ISO 6022 (25 MPa); tie-rod ISO 6020-2. Typical bore/rod pairs (ratio φ ≈ 1.25 / 1.4 / 2):
  40/22, 40/28, 50/28, 50/36, 63/36, 63/45, 80/45, 80/56, 100/56, 100/70, 125/70, 125/90, 160/90, 160/110, 200/125, 200/140.
* Directional valve sizes ISO 4401 (CETOP): NG6 (03) ≈ 60–80 L/min, NG10 (05) ≈ 100–120, NG16 (07) ≈ 300, NG25 (08) ≈ 650,
  NG32 (10) ≈ 1100 L/min; max 31.5–35 MPa (T port 16–21). Solenoids 24 V DC, ≈ 25–35 W.
* Pump displacements (cm³/rev): gear 4 6 8 11 14 16 19 23 26 32 40 50; vane 10 16 20 25 32 40 50 63; axial piston variable
  18 28 45 71 100 140. Electric motors IEC, 4-pole 1450 rpm (50 Hz): 0.75 1.1 1.5 2.2 3 4 5.5 7.5 11 15 18.5 22 30 37 45 kW.
* Hydraulic motors: gerotor/orbit 50–400 cm³/rev (low speed high torque), radial piston 200–6000 cm³/rev, axial piston 10–250,
  gear 4–50. Efficiencies (example): gear η_v 0.90–0.95 η_hm 0.85–0.90; vane 0.90/0.90; axial piston 0.95/0.92–0.95.
* Fluid HLP 46 (ISO VG 46, ISO 6743-4 HM), ρ = 870 kg/m³, ν = 46 mm²/s at 40 °C, bulk modulus 1400–1600 MPa (with air ≈ 1000).
* Pipe velocities: suction 0.5–1.2 m/s, return 2–4 m/s, pressure 3–6 m/s (up to 8 short lines). Steel tube EN 10305-4 E235/E355,
  fittings ISO 8434-1 (24° cone), flanges SAE J518 / ISO 6162 (code 61 / 62). Hoses EN 853/856 (1SN 2SN 4SP 4SH), ISO 18752.
* Cleanliness ISO 4406: servo/proportional 16/14/11, standard valves 18/16/13, gear pump 19/17/14 (examples). Filter β_x(c) ≥ 200 / 1000 (ISO 16889).
* Accumulators: bladder 0.2–50 L (up to 35 MPa), piston 0.1–1000 L, diaphragm 0.075–4 L; pre-charge p0 ≈ 0.9 · p_min (energy storage), N₂ only;
  safety and shut-off block with relief + manual discharge (EN ISO 4413, PED 2014/68/EU).
* Tank ≈ 3–5 × pump flow per minute (industrial), with baffle, breather filter, sight glass, temperature switch.
* Safety/standards: EN ISO 4413 (hydraulic safety), ISO 1219-1/-2 (symbols, circuits), ISO 4406, ISO 16889, ISO 10771-1 (fatigue).

## Common style
Cards with "What / Why / How / Check / Typical mistake", info boxes, SVG symbols and cut-away drawings, live calculators,
tables with real ranges, "selection example" with numbers, failures table. Charts: thin lines, one y-axis, legend ≥ 2 series.
Test params: prefix `&hl…` (A) / `&hc…` (B); `&hltest` / `&hctest` logs self-check lines; a test-only hold param like
robotckt.js `&ckhold` (needed for headless screenshots). Headless Chrome:
`"C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir=<scratch>/ud --timeout=12000
--screenshot=… --window-size=1400,2000 "http://127.0.0.1:<port>/?hyitem=N&<hold>#hyd"` with the REAL server
`python server.py --port <port>` started from the repo root. `--virtual-time-budget` hangs – do not use.
**NEVER touch port 8080 (the user's server, PID 23248).** Stop your own server at the end.

## Final report
What you built, verified numbers (hand check of formulas), files, tests, open issues, plus text snippets for the lead:
(1) README table row (format `| **Hydraulics – …** | description |`), (2) README section "Hydraulics: … principles" (25–50 lines),
(3) docs/00_INDEX row (`| NN | \`file\` | description | tab (item) | files |`).
