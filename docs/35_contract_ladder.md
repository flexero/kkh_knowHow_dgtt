# Contract – PLC ladder programs (Delta + Siemens) for AS/RS, APC, hydraulics (internal, for the builders)

User request (2026-11-13): "when I use Delta or Siemens PLC, plz add the control circuit program (ladder)." Scope chosen by the
user: **AS/RS + APC + hydraulics**, **both PLC families side by side**. Reader = mechanical engineer, non-native English →
simple English, short sentences, tables, every value / address labelled "example – check with your PLC configuration".
Standing rules: offline only (no CDN), guide in docs/ for every feature (textbook style, formulas / timing numbers with
examples, buy list "catalogue examples" with real makers + price class "estimate – ask for a quote", SVG drawings
docs/img/NN_*.svg copied to web/img/, no ↑/↓ characters in SVGs), README + index rows are added by the lead.

## PLC families (use these, consistently)
| | Delta | Siemens |
|---|---|---|
| CPU (example) | **AS300 series AS332T-A** (ISPSoft 3.x), I/O modules AS16AM10N-A / AS16AN01T-A, analog AS04AD-A / AS04DA-A; mention DVP-ES3 / DVP-ES2 (WPLSoft/ISPSoft, octal X0–X7, X10–X17 …) as the small option | **S7-1500 CPU 1515F-2 PN** for AS/RS (as guide 32/33: PLC-ASRS-RAW 10.54.0.31), **S7-1200 CPU 1215C DC/DC/DC** for APC + HPU (or 1215FC if safety is integrated); TIA Portal V19 |
| Bit inputs / outputs | AS series: X0.0 … X0.15, Y0.0 … Y0.15 (word.bit); DVP: X0…X17 octal | %I0.0 … %I0.7, %Q0.0 … (byte.bit, bit 0–7 only!) |
| Internal bits | M0 … | %M10.0 … or (better) DB bits `"DB_Asrs".Step10` |
| Timers | TMR T0 K20 (100 ms base: T0–T199) → 2.0 s; AS series also TON instruction | IEC timer TON in an instance DB, PT := T#2S |
| Counters | CNT C0 K10 | CTU in an instance DB, PV := 10 |
| Words / analog | D0 …, analog via AS04AD-A, scaling 0–32000 (check) | %IW64 …, scaling 0–27648 with NORM_X / SCALE_X |
| Set / reset | SET / RST | –(S)– / –(R)– |
| Edges | LDP / LDF (rising / falling contact) | –|P|– / –|N|– (with an edge memory bit) |
| Compare | LD>= D0 K107 … | CMP >= box (IN1, IN2) |
| Move | MOV K10 D0 | MOVE box |
| Safety | Delta: hard-wired **safety relay** (e.g. Pilz PNOZ s4, Schmersal SRB-E, Phoenix Contact PSRmini) or a small safety controller (Pilz PNOZmulti 2) – the PLC only reads the feedback | F-CPU: F-LAD in a safety program (ESTOP1, FDBACK, SFDOOR instructions) or a safety relay; the standard program only reads the status |
**Rule written in every guide and on every page:** the standard ladder program never does the safety function itself
(e-stop, guard locking, STO, safe speed): that is the safety relay or the F-program (ISO 13849-1, IEC 62061, IEC 60204-1 §9.4).

## Shared core – `web/ladder.js` + `web/ladder.css` (builder A writes it FIRST, others use it)
```js
import { mountLadder, scaleLin } from "./ladder.js";
const ctl = mountLadder(containerEl, program, { plant, onScan, height });
// ctl = { setInput(tag, value), get(tag), state, start(), stop(), reset(), setView("delta"|"siemens"|"both") , destroy() }
```
`program` (plain JS object, one data file per machine):
```js
{
  id: "asrs", title: "AS/RS crane + conveyor control", scanMs: 20,
  plc: { delta: { cpu: "AS332T-A", sw: "ISPSoft 3.x" }, siemens: { cpu: "CPU 1515F-2 PN", sw: "TIA Portal V19" } },
  tags: [ // dir: "I" input, "Q" output, "M" internal, "AI"/"AQ" analog, "T" timer, "C" counter, "W" word
    { name: "S_START", dir: "I", type: "BOOL", delta: "X0.0", siemens: "%I0.0", comment: "Start push button (NO)", wire: "-SF1 13/14", init: false },
    { name: "P_SYS", dir: "AI", type: "REAL", delta: "D100 (AS04AD-A ch1)", siemens: "%IW64", unit: "MPa", min: 0, max: 16, init: 0 },
    { name: "T_CLAMP", dir: "T", delta: "T0", siemens: "\"DB_T_Clamp\" (TON)", comment: "clamp time", pt: 2.0 },
    { name: "C_PAL", dir: "C", delta: "C0", siemens: "\"DB_C_Pal\" (CTU)", pv: 10 },
  ],
  networks: [
    { title: "Network 1 – Automatic mode", comment: "why + how in one or two simple sentences",
      rungs: [ { in: TREE, out: [ OUT, ... ] } ] },
  ],
}
```
TREE = series / parallel nesting: `{ s: [TREE, …] }` series (AND), `{ p: [TREE, …] }` parallel (OR), leaves:
`{ c: "NO"|"NC"|"P"|"N", t: "TAG" }` contacts (P / N = rising / falling edge),
`{ cmp: ">="|"<="|">"|"<"|"=="|"<>", a: "TAG"|number, b: "TAG"|number }` compare contact,
`{ b: "TON"|"TOF"|"TP", t: "T_TAG" }` timer box in series (output = Q / done bit), `{ b: "CTU"|"CTD", t: "C_TAG", r: "RESET_TAG" }`.
OUT = `{ o: "OUT"|"SET"|"RST"|"NOT", t: "TAG" }`, `{ mov: number|"TAG", to: "TAG" }`, `{ calc: "A*B+C" (only + − * / and tag names), to: "TAG" }`, `{ jmp?: no }`.
Timers: TON t.Q = input true for ≥ pt s; elapsed in `t.ET`. Counters count rising edges of their input, Q = CV ≥ PV.
Analog AI values are set by sliders (min…max) or by the plant model.
The core renders every rung as **SVG ladder** (rails, contacts –| |– –|/|–, coils –( )–, (S)/(R), boxes TON/CTU/CMP/MOVE),
**live colours** (energised path green via CSS var `--good-text`, false grey), the tag name + address under each element in
the selected view: **Delta view** (X0.0, M10, T0 with "TMR T0 K20"), **Siemens view** (%I0.0, "DB_T_Clamp" TON PT T#2S), or **both**
(two columns). Also: Delta **instruction list** (LD / LDI / AND / ANI / OR / ORI / ANB / ORB / OUT / SET / RST / TMR / CNT / MOV / LD>= …)
generated from the tree, an **I/O table** (tag, Delta address, Siemens address, comment, wiring), an input panel (buttons /
switches for "I" tags, sliders for "AI"), a run / stop / single-scan / reset bar, a scan-time display, search, and a
"force" marker for inputs. `plant(state, dt)` (optional, per machine) is called every scan before the logic: it reads outputs and
writes inputs (e.g. valve Y1 on → cylinder moves → limit switch S2 true after 1.2 s), so the program runs on its own after Start.
Pause when the container is hidden (IntersectionObserver or `offsetParent === null`). Dark theme via the CSS vars of style.css.
Test param: `&ladtest` runs a built-in self-test of the core (tree eval, timers, edges, counters, IL generation) and logs `LADTEST …`.

## Builders
| Builder | Part | Own files | Guide | Port | Scratch |
|---|---|---|---|---|---|
| A | core + **AS/RS item 5** (`#srItem5`, event `sritemshow` detail "5", `window.srCtl`) | `web/ladder.js`, `web/ladder.css`, `web/asrslad.js` (+ `asrslad_*.js`) | `docs/35_plc_ladder_basics_asrs.md` (incl. ladder textbook: scan cycle, contacts/coils, seal-in, interlock, edges, timers, counters, step chain with SET/RST, analog scaling, alarms, Delta vs Siemens comparison, IEC 61131-3 languages) | 8082 | `scratchpad\ldA` |
| B | **APC** card `#apcLadder` (build when the APC tab is shown: chain `window.onTabShown` like web/apc.js line 440, or at load if `#tab-apc` is active) | `web/apclad.js` (+ `apclad_*.js`) | `docs/36_plc_ladder_apc.md` | 8083 | `scratchpad\ldB` |
| C | **Hydraulics item 4** (`#hyItem4`, event `hyitemshow` detail "4", `window.hyCtl`) | `web/hydlad.js` (+ `hydlad_*.js`) | `docs/37_plc_ladder_hydraulics.md` | 8084 | `scratchpad\ldC` |
Scratch base: `C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\c13f77ba-a4c3-4cb2-a5fe-2f0af9eb46e4\scratchpad\`.

Shell is DONE by the lead (index.html buttons, intros, containers, script tags, ladder.css link). Do NOT edit index.html, app.js,
style.css, sr.js, hyd.js, apc.js, asrscore.js, README.md, docs/00_INDEX.md or another builder's files.

## Content that must match existing design data (read these)
* **AS/RS:** guide 32 (modes, job telegram, step chain, 7 errors, 10 safety functions), guide 33 (I/O list, PLC-ASRS-RAW,
  S7-1515F-2 PN, addresses, devices -BG/-MA/-QA …), `web/asrscore.js` (shared live sim – item 5 may show live crane state
  next to the ladder, and may mirror `A.sim.faults` / e-stop as inputs). Programs: modes (auto / semi / manual / maintenance),
  job handshake WCS ↔ PLC (job valid, ack, done, error), travel / hoist / fork step chain with fine positioning, load-on-fork
  check, conveyor I/O with ID point + contour check + light-curtain muting status, drive enable / brake release / STO
  feedback, fault and alarm handling with acknowledge, counters (jobs, hours).
* **APC:** guide 09 (decided 2026-11-12: lift Ø50/28 at 10 MPa, accumulator band 10.0 / 10.8 / 11.5 MPa, start interlock
  ≥ 10.7 MPa, alarm < 10.0 MPa, oil ≥ 20 °C), the APC tab step chain table `#apcSeq` (web/apc.js – read its steps, sensors,
  interlocks and times; your ladder must implement exactly that sequence), E84-style / M-code handshake with the CNC (M60
  pallet change request, door closed, spindle at home), zero-point unclamp / clamp with pressure switches, lift, rotate 180°,
  lower, clamp, done; faults with time-outs.
* **Hydraulics:** guides 25, 29, 30 (HPU of guide 25 example 2 / APC: pump 1.5 kW, unloading valve 0V5 at 10.8 / 11.5 MPa,
  relief 13 MPa, transmitter 0–16 MPa, tank level / temperature / filter clogging switches, heater and cooler) + generic circuits:
  pump motor start (direct / star-delta with timer 5 s, interlocked contactors), accumulator charge control with hysteresis,
  pressure-switch based clamp-then-work sequence, hydraulic lock / counterbalance valve solenoids with "both solenoids never
  together" interlock, oil temperature control (heater < 20 °C, cooler > 50 °C, trip > 65 °C), level low = pump stop,
  filter clogged = warning then stop after time, pump run-hour counter, valve output test.

## Every part delivers
1. Page: header card (what PLC, how to read LAD, Delta vs Siemens view switch), the live ladder (≥ 12 networks per machine),
   I/O table, Delta IL listing, Siemens notes (DB structure, FB/FC split, OB1 / OB35 / OB100 equivalents), a "Real components +
   drawings – catalogue examples" card with `makeCard` from `web/robotref.js` (ids `ldCardA/B/C`; read web/machref.js usage),
   and a self-check `&ladAtest` / `&ladBtest` / `&ladCtest` that logs hand-checkable lines (e.g. "start → pump on after 0 ms,
   star→delta after 5.0 s").
2. Guide (≈ 1 200–2 000 lines): contents, how to use the page, the full program listing for BOTH PLCs (Delta ladder as text
   table / IL, Siemens LAD as table + SCL equivalent for the step chain), I/O list with wiring, timing calculations (scan time,
   timer accuracy ± 1 scan, debounce), commissioning / I/O check list, typical mistakes (double coil, missing seal-in, edge
   memory reused, %I0.8 does not exist, octal DVP addressing, timer reset by a missing input, safety in standard code …),
   buy list (PLC CPU, I/O, power supply, HMI e.g. Delta DOP-100 / Siemens TP700 Comfort, software licences ISPSoft (free) vs
   TIA Portal STEP 7 Basic/Professional, cables), ≥ 6 SVG drawings (PLC wiring of inputs PNP/sinking, outputs + relay,
   ladder example, step chain / GRAFCET, timing diagram, cabinet layout), standards (IEC 61131-3, IEC 61131-2, IEC 60204-1,
   ISO 13849-1, IEC 62061), glossary, supplier questions, "Next to read".
3. Test with the real server `python server.py --port <your port>` from the repo root (background), headless Chrome
   ("C:/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --disable-gpu --user-data-dir=<scratch>/ud --timeout=12000 …).
   A console collector exists: `python -I <scratch base>\apcC\cdp.py "<url>" <seconds>` (set PYTHONIOENCODING=utf-8) prints
   console lines + errors. Zero errors except favicon. `--virtual-time-budget` hangs – do not use. **NEVER touch port 8080**
   (the user's server). Stop your server at the end.
4. Final report: what you built, verified timing numbers, files, tests, open issues, plus text snippets for the lead: README
   table row, README section "PLC ladder – … principles" (20–40 lines), docs/00_INDEX row.
