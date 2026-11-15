# FMS engineering tools (tools/fmse)

Small command-line programs for the engineering work of an FMS (flexible manufacturing system)
project: choosing the system type, schedule, business case, acceptance test, URS, risks and
interfaces. They belong to **item 1** of the FMS engineering tab:

- Guide (textbook): `docs/FMS system design/61_fms_types_pipeline_modules.md`
- Web page: Digital twin → tab **FMS engineering** → item 1 (data in `web/fmse_data.js`)
- Shared example inputs + formulas: `tools/fmse/examples/item1_examples.json`

**Item 2** (product → process → machines: ABC, part families, Opitz code, process selection, cycle
times, capacity, line balancing, machine selection) has its own 8 tools. See the section
[Item 2](#item-2-product--process--machines) further down.

**Item 3** (the elements of an FMS: pallets, pool, stacker, AGV, AS/RS, robot, washer, CMM, assembly and
test stations, vision, ...) has 8 more tools. See the section [Item 3](#item-3-the-elements-of-an-fms).

**Item 4** (capacity, layout, simulation: OEE, queueing, closed networks / MVA, buffer and FMS simulation,
layout, space, aisles) has 6 more tools. See the section [Item 4](#item-4-capacity-layout-simulation).

**Item 5** (control architecture: PackML state machine, tag naming and data-block tags, cell-controller logic,
availability of the control chain and the MES buffer, alarm KPIs, ISA-95 / B2MML-style messages) has 6 more tools.
See the section [Item 5](#item-5-control-architecture).

**Item 6** (communication: network load and timing calculators, IP / VLAN plan with PROFINET names, Modbus TCP codec
and a real Modbus TCP module simulator, data-block interface sheet, handshake + heartbeat simulation, firewall
and IEC 62443 risk check) has 6 more tools. See the section [Item 6](#item-6-communication).

**Item 7** (electrical & safety principles: load list, transformer and short-circuit current, cable sizing with voltage
drop and fault loop, 24 V budget, cabinet heat balance, ISO 13849-1 performance level, ISO 13855 safety distances,
safety-zone cause & effect matrix) has 7 more tools. See the section [Item 7](#item-7-electrical--safety).

**Item 8** (module library: complete circuits per module: IO list, IEC 81346 designations, cables, terminal plan, BOM,
motor starters, module feeder and distribution board, SVG schematic sheets, rule checks) has 4 more tools and a shared
core. See the section [Item 8](#item-8-module-library-complete-circuits-per-module).

**Item 9** (PLC programming principles: scan / reaction time, tasks and response-time analysis, overflow, IEC 61131-3
standard FBs, device FBs, the module sequence inside PackML with the data block, ISA-18.2 alarms, Structured Text
generated from the item-8 library, software effort) has 7 more tools. See the section
[Item 9](#item-9-plc-programming-principles) at the end.

**Item 10A** (PLC program standard + complete device FB library: the real IEC 61131-3 Structured Text library
`plc_lib/*.st`, the same FBs as Python classes, a small soft PLC that runs the .st files in unit tests, and the
library rule check) has 3 more tools. See the section [Item 10A](#item-10a-plc-library-st-device-fbs-and-soft-plc)
at the end.

The guide, the web page and these tools use **the same inputs and the same formulas**, so the
numbers are the same in all three places. If you change an example value, change it in the
JSON file. All three builders read it.

## Offline note

- Python 3 (3.8 or newer, tested with 3.12), **standard library only**. You do not need pip, internet or extra packages.
- All output files (Markdown, CSV, HTML Gantt) are self-contained. The HTML has inline CSS and SVG, with no web
  fonts, CDN or links, so it opens on an offline factory PC.
- CSV files use `;` as separator and are UTF-8 with BOM, so Excel shows `€`, `ä`, `×` correctly.
- Every tool reconfigures the console to UTF-8, so the output works in the Windows console.

## The tools at a glance

| Tool | What it does | Main inputs |
|---|---|---|
| `fms_economics.py` | Cost per part of CNC / FMC / FMS / transfer line per scenario, cheapest type, break-even volumes, cost-vs-volume table | `economics` |
| `cpm_schedule.py` | Critical path method: ES/EF/LS/LF, float, critical path, calendar dates, offline HTML Gantt, CSV | `cpm_project` or your CSV |
| `business_case.py` | Cash flows, NPV, IRR, payback, discounted payback, sensitivity grid | `business_case` |
| `acceptance.py` | Availability of the SAT run, cycle-time check, Cp / Cpk | `acceptance_run`, values file |
| `urs_generator.py` | Questionnaire answers (40 questions) → URS draft (Markdown) + traceability CSV + vagueness check | questionnaire JSON from the web page |
| `risk_register.py` | Score P×I, class, sorted register, 5×5 heat map, CSV | `risks` or your CSV |
| `interface_matrix.py` | N² interface matrix of a module kit, interface list, interface sheet stubs (9 faces) | `kits`, `interfaces` |
| `run_all_selftests.py` | Runs every `--selftest` and prints a summary | – |
| `fmse_common.py` | Shared helpers (JSON loading, tables, CSV, self-test). Not a CLI. | – |

Common options of every tool:

- `--examples PATH` uses another example / project JSON with the same structure (default: the shared file).
- `--selftest` runs built-in checks against hand-calculated values. It prints PASS / FAIL lines and the exit code is 1 on failure.
- `-h` shows help, formulas and an example command.

Wrong input (missing file, broken JSON, bad CSV line, unknown id) gives a clear `ERROR:` line and exit code 2. You do not get a Python traceback.

Run the tools from the project root, for example `python tools/fmse/fms_economics.py`. They also work from any other folder.

---

## 1. fms_economics.py: which system type is cheapest?

```
python tools/fmse/fms_economics.py [--scenario A|B|C|all] [--csv out.csv] [--volumes 1000,5000,...] [--max-volume 500000]
```

Formulas:

```
Q_total       = variety × q_per_part                      parts / year
N_changeovers = variety × orders_per_part_year            (one changeover per order)
CRF           = i(1+i)^n / ((1+i)^n − 1)                  i = 8 %, n = 8 → CRF = 0.174015
units         = ceil(Q_total / cap_per_unit)
C             = units·I·CRF + units·F + Q_total·v + N_changeovers·c_ch     (I, F: MEUR × 10^6 → EUR)
cost per part = C / Q_total
```

**Break-even method.** For one pair of types, the variety and N_changeovers stay fixed and only Q_total
changes. The cost of a type is a straight line while its number of units stays the same. It jumps up by
I·CRF + F at every Q = k·cap. So the difference between two types is a straight line between all unit
jumps of both types. The tool walks through these segments up to `--max-volume`. In each segment it
solves the line for zero. It also reports a crossing at a unit jump (marked `*`). One pair can have
several break-even volumes.

Real output (excerpt):

```
=== Scenario A: Medium variety, medium volume ===
Q_total = 18 000 parts/yr, N_changeovers = 120 /yr
type  units  capital/yr  fixed/yr  variable/yr  changeover/yr   C EUR/yr  EUR/part
cnc       1     156 613    60 000      684 000         21 600    922 213     51.23
fmc       2     295 825   100 000      396 000          4 800    796 625     44.26  <= cheapest
fms       1     452 438   120 000      252 000          1 800    826 238     45.90
ftl       1     783 066   150 000      144 000        300 000  1 377 066     76.50

Break-even total volumes (variety 12, N_changeovers 120 fixed, Q = 1 .. 500 000):
   cnc vs fmc : no break-even, fmc always cheaper
   cnc vs fms : 14 001 (then fms)
   cnc vs ftl : 30 000* (then ftl)
   fmc vs fms : 21 702 (then fms), 42 000* (then fmc), 43 778 (then fms)
   fmc vs ftl : 42 000* (then ftl)
   fms vs ftl : 42 000* (then ftl)
```

Results of all scenarios (EUR per part):

| Scenario | Q_total | N_ch | CNC | FMC | FMS | FTL | Cheapest |
|---|---|---|---|---|---|---|---|
| A Medium variety, medium volume | 18 000 | 120 | 51.23 | **44.26** | 45.90 | 76.50 | FMC |
| B High variety, low volume | 6 000 | 450 | 87.60 | **57.99** | 110.53 | 351.01 | FMC |
| C Low variety, high volume | 240 000 | 8 | 45.23 | 36.84 | 28.31 | **11.97** | FTL |

## 2. cpm_schedule.py: project schedule with the critical path

```
python tools/fmse/cpm_schedule.py [--tasks file.csv] [--start 2027-01-04] [--html gantt.html] [--csv cpm.csv]
```

The task CSV uses this format. The header line is optional, and `#` starts a comment line.

```
id;name;duration;predecessors
T01;Need statement;2;
T15;Virtual commissioning;4;T13,T14
```

Method: topological sort (Kahn) with loop detection, then the forward pass `ES = max(EF pred)`,
`EF = ES + d`, then the backward pass `LF = min(LS succ)`, `LS = LF − d`. Total float is `TF = LS − ES`
and free float is `FF = min(ES succ) − EF`. A task is critical when TF = 0. Week w starts on
`start + 7·w days`, and the finish date is the last day of the last week (`start + 7·EF − 1`).

Real output (excerpt):

```
T09  FDS + interface sheets (integrator)        6  T08    27  33  27  33   0   0  YES   2027-07-12  2027-08-22
T10  Machine tools manufacturing (long lead)   30  T08    27  57  30  60   3   0        2027-07-12  2028-02-06
...
Total duration: 87 weeks   (end 2028-09-03)
Critical path 1: T01 -> T02 -> T03 -> T04 -> T05 -> T06 -> T07 -> T08 -> T09 -> T12 -> T13 -> T15 -> T19 -> T20 -> T21 -> T22 -> T23 -> T25
Near-critical (float <= 4): T24 (1), T10 (3), T18 (3), T11 (4)
```

Example files: `examples/gantt_example.html` (critical tasks in red, float as a light bar) and `examples/cpm_example.csv`.

## 3. business_case.py: NPV, IRR, payback

```
python tools/fmse/business_case.py [--saving 0.62] [--invest 2.9] [--rate 0.08] [--opex ..] [--residual ..] [--years ..] [--csv cash.csv]
```

```
CF_t   = annual_saving × ramp_t − extra_opex
NPV    = −I0 + Σ CF_t/(1+r)^t + residual/(1+r)^n
IRR    = r with NPV(r) = 0, bisection between −0.99 and 1.0, tolerance 1e-7
Payback (and discounted payback with CF_t/(1+r)^t): first year where cumulative CF ≥ I0,
         linear interpolation inside the year; the residual value is not used for payback
Sensitivity: NPV for saving × (1 + saving_pct) and I0 × (1 + invest_pct); ramp, opex, residual, rate constant
```

Real output (excerpt):

```
NPV                = -0.0069 MEUR  (-6 907 EUR)
IRR                = 7.9449 %
Payback            = 6.12 years
Discounted payback = not reached within 8 years
saving \ invest   -10 %    +0 %   +10 %   +20 %
-20 %            -0.356  -0.646  -0.936  -1.226
+0 %              0.283  -0.007  -0.297  -0.587
+20 %             0.922   0.632   0.342   0.052
```

The example sits almost exactly on the break-even line: IRR 7.94 % against an 8 % rate. A 10 % higher saving
(`--saving 0.682`), or 10 % less investment, makes it clearly positive.

## 4. acceptance.py: SAT availability, cycle time, Cpk

```
python tools/fmse/acceptance.py [--run 72 --owner 1.2 --supplier 3.1 --target 0.95] [--values cycles.txt --guaranteed 57.6]
python tools/fmse/acceptance.py --cpk --lsl 52.000 --usl 52.030 --values tools/fmse/examples/bore_values_example.txt
```

```
A   = (T_run − T_owner − T_supplier) / (T_run − T_owner)        PASS if A ≥ target
Cycle check: n, mean, sample std s = sqrt(Σ(x−mean)²/(n−1)), min, max, share above guaranteed; PASS if mean ≤ guaranteed
Cp  = (USL − LSL) / (6 s)          Cpk = min(USL − mean, mean − LSL) / (3 s)        PASS if Cpk ≥ 1.33
```

Real output (excerpt):

```
     = (72 - 1.2 - 3.1) / (72 - 1.2) = 67.7 / 70.8
     = 0.956215  = 95.62 %   target 95.00 %   ->  PASS
 n     mean  std (s)   min   max  guaranteed  > guaranteed
10  57.3900   0.4383  56.8  58.1        57.6      3 (30 %)
   mean 57.3900 <= guaranteed 57.6  ->  PASS
3) PROCESS CAPABILITY   (bore 52 H7 example)
   Cp = 1.9365   Cpk = 1.2910   required Cpk >= 1.33  ->  FAIL
   Cpk is clearly below Cp: the process is not centred - move the mean to the middle.
```

## 5. urs_generator.py: questionnaire → URS draft + traceability

```
python tools/fmse/urs_generator.py questionnaire.json [--out URS_draft.md] [--trace trace.csv]
python tools/fmse/urs_generator.py --make-example my_questionnaire.json
```

- The input is the JSON exported by the web questionnaire: `{"format":"fms-requirements-v1","date":"…","answers":{"q01":"…",…}}`.
- The output has chapters 1 Purpose & scope … 13 Acceptance criteria and 14 Open points.
- Each question gives one requirement. Its ID stays the same whether the question is answered or not: `URS-PRD-001` is q01, `URS-SCO-001` is q40, `URS-ACC-001` is q37.
- Each requirement has a `Verification:` line with one method (inspection / test / analysis / demonstration) and how it is checked.
- Empty answers become `[TBD]` requirements and are listed in 14.1 Open points with "why it matters" and the example answer.
- The vagueness checker flags vague words such as fast, quick, reliable, robust, user-friendly, flexible, approximately, about, as soon as possible, state of the art, sufficient, adequate, minimal, maximum possible, etc. Each finding comes with a rewrite hint. It also flags numeric answers that contain no number, and choice answers that are not one of the choices.
- The traceability CSV has these columns: `URS ID; requirement text; FDS reference (empty); verification method; test reference (empty)`.
- The 40 questions are copied from `web/fmse_data.js` (QUEST). `--selftest` checks that the web file still has q01..q40 and the same texts.

The example files are made from the example answers in the web data:
`examples/questionnaire_example.json` → `examples/URS_draft_example.md` + `examples/trace_example.csv`.

```
URS draft written: examples\URS_draft_example.md  (40 requirements, 0 open points TBD)
Verification methods: analysis 9, demonstration 8, inspection 12, test 11
Wording findings: 0
```

(If an answer of a choice question is not one of the choices, the checker reports it, e.g.
`URS-QUA-002: answer is not one of the standard choices (None / Lot / Serial / Serial + process data) - check`.)

## 6. risk_register.py: score, class, heat map

```
python tools/fmse/risk_register.py [--risks my_risks.csv] [--csv out.csv]
```

`score = P × I`. The class is HIGH for 15 or more, MEDIUM for 8–14 and LOW for 7 or less. The register is
sorted by score, then by P (both high to low), then by id. Your own CSV uses the columns `id;title;P;I;mitigation`.

```
Count: 15 risks  -  HIGH 4, MEDIUM 9, LOW 2
Top 3: R02 Part data / volumes wrong or missing (16); R03 Interfaces between suppliers unclear (16); R05 Software (cell controller / MES) late or buggy (16)
  4  | L  4  n=0     | M  8  n=2     | M 12  n=2     | H 16  n=3     | H 20  n=0     |
     |               | R06 R13       | R04 R09       | R02 R03 R05   |               |
```

## 7. interface_matrix.py: N² matrix and interface sheets

```
python tools/fmse/interface_matrix.py --kit fms|fmc|asm|weld|sheet [--sheets DIR] [--csv out.csv]
python tools/fmse/interface_matrix.py --modules M01,M02,M03,M04,M18,M19,M22
```

- An interface exists when both modules are in the kit.
- Wildcards: `*` means all kit modules except M19–M22. `*physical` means all modules with moving parts (not M09 or M19–M22). `*networked` means all modules except M02; M18 is included.
- Duplicate pairs are merged.
- Letters: M = mechanical, S = signal, D = data, U = utility, F = safety, N = network.
- `--sheets` writes one Markdown stub per pair plus `00_index.md`. Each stub has the 9 faces: mechanical, electrical, safety, PackML state model, function block, handshake, communication (standard data block words 0–19 from docs/66 §8 plus the module part from word 20), HMI & alarms, documents & tests. It also has a sign-off table.

| Kit | Modules | Interfaces |
|---|---|---|
| fms | 16 | 51 (M 8, S 11, D 17, U 2, F 10, N 14) |
| fmc | 12 | 32 (M 3, S 5, D 12, U 1, F 6, N 10) |
| asm | 11 | 31 (M 4, S 6, D 11, U 0, F 6, N 10) |
| weld | 11 | 29 (M 2, S 4, D 10, U 1, F 6, N 10) |
| sheet | 12 | 33 (M 4, S 5, D 10, U 1, F 7, N 11) |

(Counts include the interfaces added on 2026-11-14 for item 3: M11–M01, M17–M15, M05–M16, M08–M16, M17–M16.)

```
      01 02 03 04 06 08 09 10 11 12 17 18 19 20 21 22
M01    \ MS  .  .  .  .  D  .  D  . SU  F  D  .  .  N   Machine tool (CNC) interface
M02   MS  \ MS  .  .  .  .  .  .  .  .  F  D  .  .  .   Automatic pallet changer (APC)
M03    . MS  \ MS  . MS  . MS MS  .  .  F  D  .  .  N   Pallet rack / pallet pool + stacker
```

The example sheets for the FMS kit are in `examples/interface_sheets_fms/` (51 sheets + index). The CSV is `examples/interfaces_fms.csv`.

## 8. Self-tests

```
python tools/fmse/run_all_selftests.py [--verbose]

SELF-TEST SUMMARY
  fms_economics.py        PASS  (25 checks passed, 0 failed)
  cpm_schedule.py         PASS  (14 checks passed, 0 failed)
  business_case.py        PASS  (12 checks passed, 0 failed)
  acceptance.py           PASS  (15 checks passed, 0 failed)
  urs_generator.py        PASS  (35 checks passed, 0 failed)
  risk_register.py        PASS  (8 checks passed, 0 failed)
  interface_matrix.py     PASS  (18 checks passed, 0 failed)
  abc_analysis.py         PASS  (12 checks passed, 0 failed)
  pfa_cells.py            PASS  (24 checks passed, 0 failed)
  gt_opitz.py             PASS  (21 checks passed, 0 failed)
  tolerance_process.py    PASS  (28 checks passed, 0 failed)
  process_time.py         PASS  (29 checks passed, 0 failed)
  capacity_plan.py        PASS  (21 checks passed, 0 failed)
  line_balance.py         PASS  (12 checks passed, 0 failed)
  machine_select.py       PASS  (19 checks passed, 0 failed)
  element_sizing.py       PASS  (63 checks passed, 0 failed)
  tolerance_stack.py      PASS  (14 checks passed, 0 failed)
  agv_fleet.py            PASS  (16 checks passed, 0 failed)
  asrs_cycle.py           PASS  (11 checks passed, 0 failed)
  robot_payload.py        PASS  (11 checks passed, 0 failed)
  assembly_test.py        PASS  (15 checks passed, 0 failed)
  transport_select.py     PASS  (13 checks passed, 0 failed)
  conveyor_drive.py       PASS  (5 checks passed, 0 failed)
  oee_losses.py           PASS  (21 checks passed, 0 failed)
  queueing.py             PASS  (38 checks passed, 0 failed)
  mva_closed.py           PASS  (16 checks passed, 0 failed)
  buffer_sim.py           PASS  (20 checks passed, 0 failed)
  fms_sim.py              PASS  (21 checks passed, 0 failed)
  layout_plan.py          PASS  (23 checks passed, 0 failed)
  packml_sim.py           PASS  (31 checks passed, 0 failed)
  tag_namer.py            PASS  (32 checks passed, 0 failed)
  cell_controller_sim.py  PASS  (21 checks passed, 0 failed)
  arch_availability.py    PASS  (15 checks passed, 0 failed)
  alarm_kpi.py            PASS  (15 checks passed, 0 failed)
  isa95_msg.py            PASS  (20 checks passed, 0 failed)
  net_calc.py             PASS  (56 checks passed, 0 failed)
  ip_plan.py              PASS  (36 checks passed, 0 failed)
  modbus_codec.py         PASS  (60 checks passed, 0 failed)
  datablock_map.py        PASS  (21 checks passed, 0 failed)
  handshake_sim.py        PASS  (35 checks passed, 0 failed)
  net_security.py         PASS  (34 checks passed, 0 failed)
  load_list.py            PASS  (28 checks passed, 0 failed)
  cable_size.py           PASS  (28 checks passed, 0 failed)
  control_power.py        PASS  (26 checks passed, 0 failed)
  cabinet_thermal.py      PASS  (21 checks passed, 0 failed)
  safety_pl.py            PASS  (51 checks passed, 0 failed)
  safety_distance.py      PASS  (23 checks passed, 0 failed)
  safety_zones.py         PASS  (21 checks passed, 0 failed)
  circuit_library.py      PASS  (123 checks passed, 0 failed)
  module_power.py         PASS  (111 checks passed, 0 failed)
  circuit_svg.py          PASS  (28 checks passed, 0 failed)
  library_check.py        PASS  (27 checks passed, 0 failed)
  TOTAL                   PASS  (1443 checks passed, 0 failed)
```

The expected values in the self-tests come from a separate hand calculation. They are not copied from the tool output.

## Example files in `examples/`

| File | Made by |
|---|---|
| `item1_examples.json` | shared input (do not edit here without telling the guide / web builders) |
| `item2_examples.json` | shared input of item 2 (same rule) |
| `item3_examples.json` | shared input of item 3 (same rule; the 17 basic calculators take their inputs from `web/fmse3.js`) |
| `item5_examples.json` | shared input of item 5 (same rule; PackML / data-block tables are checked against `web/fmse5_data.js`, `web/fmse6_data.js`) |
| `item6_examples.json` | shared input of item 6 (same rule; kit / data-block tables are read directly from `web/fmse6_data.js`, `UNIT` from `web/fmse6.js`) |
| `item7_examples.json` | shared input of item 7 (same rule; tables marked "example table" must be checked against the standard edition of the project) |
| `item8_examples.json` | shared circuit library of item 8 (32 patterns, 22 modules, constants, kit; exact derivation rules in `_rules`, same rule as above) |
| `economics_example.csv` | `fms_economics.py --csv` |
| `cpm_example.csv`, `gantt_example.html` | `cpm_schedule.py --csv --html` |
| `cashflow_example.csv` | `business_case.py --csv` |
| `bore_values_example.txt` | input for `acceptance.py --cpk` |
| `questionnaire_example.json`, `URS_draft_example.md`, `trace_example.csv` | `urs_generator.py` |
| `risks_example.csv` | `risk_register.py --csv` |
| `interfaces_fms.csv`, `interface_sheets_fms/` | `interface_matrix.py --kit fms --csv --sheets` |

## Using the tools in a real project

1. Copy `examples/item1_examples.json` to your project folder and put in your own values (volumes, costs, tasks, risks, kit).
2. Run every tool with `--examples your_project.json`. Use `--tasks` for the schedule and `--risks` for the risk register, which take CSV files.
3. In the web page, fill in the questionnaire, export it as JSON and run `urs_generator.py` on the file. Review every `[TBD]` and every wording finding before you send the URS.
4. Generate the interface sheets for your module list (`--modules`). Give each sheet one owner and have both suppliers sign it.

All values in the shared example file are examples. Always check prices, capacities and times for your own factory.

---

# Item 2: product → process → machines

Eight programs for the step from the product to the processes and machines. You find the part
families, choose the processes, estimate the cycle times, size the machine groups, balance the
assembly line and select the machine.

- Guide (textbook): `docs/FMS system design/62_product_process_machines.md`
- Web page: Digital twin → tab **FMS engineering** → item 2 (data in `web/fmse2_data.js`)
- Shared example inputs + exact formulas: `tools/fmse/examples/item2_examples.json` (key `_formulas`)

The guide, the web page and these tools use the same inputs and formulas, so the numbers match.
All tools default to `--examples tools/fmse/examples/item2_examples.json`. They have `--selftest`
and `-h`, the same as the item-1 tools.

| Tool | What it does | JSON section |
|---|---|---|
| `abc_analysis.py` | ABC / Pareto of the P-Q list: share, cumulative share, class, summary, text Pareto chart | `pq_parts` |
| `pfa_cells.py` | Production flow analysis: King's ROC, Jaccard similarity, single-linkage cells, exceptional elements, voids, efficacy Γ, efficiency η, threshold sweep | `pfa` or your CSV |
| `gt_opitz.py` | Simplified Opitz-style 5-digit form code: tables, decode, build (also interactive), similarity of two codes | `opitz_example` |
| `tolerance_process.py` | Required IT grade (ISO 286-1 table), capable / economical processes, cheapest final operation, allowance chain, H/f-g-h fits | `it_table_um`, `process_chain` |
| `process_time.py` | Turning, milling, drilling, tapping, spindle power/torque check, Taylor tool life, injection moulding, bending, arc welding | `cutting`, `taylor`, `moulding`, `bending`, `welding` |
| `capacity_plan.py` | Available hours, load per machine group, machines, utilisation, bottleneck, takt, EOQ lot-size table | `calendar`, `capacity`, `eoq` |
| `line_balance.py` | Precedence check (cycles), positional weights, RPW and LCR balancing, idle time, efficiency, text Gantt | `line_balance` or your CSV |
| `machine_select.py` | AHP weights + consistency + scores, life-cycle cost per candidate, combined ranking | `ahp`, `lcc` |

## 9. abc_analysis.py: which parts make the volume?

```
python tools/fmse/abc_analysis.py [--basis volume|revenue] [--csv abc.csv]
```

Formula: value = Q (volume) or Q × price (revenue). Sort by value, descending (equal values keep the file order).
Class **A** while the cumulative share *before* the part is < 80 %, **B** while < 95 %, otherwise **C**.
So the part that crosses 80 % is still an A part.

```
 #  part                          Q/yr  price EUR   value  share %  cum before %   cum %  class
 7  P10 Flywheel                 9 000      25.00   9 000     8.93         71.43   80.36  A
 8  P12 Pipe flange              6 000       4.00   6 000     5.95         80.36   86.31  B
...
class  parts  % of parts   value  % of value
A          7        46.7  81 000       80.36
B          4        26.7  15 500       15.38
C          4        26.7   4 300        4.27
```

By revenue (`--basis revenue`, total 4 093 800 EUR): A = 6 parts (84.2 %), B = 3 (12.8 %), C = 6 (3.1 %).

## 10. pfa_cells.py: machine cells and part families

```
python tools/fmse/pfa_cells.py [--matrix matrix.csv] [--T 0.3] [--csv cells.csv]
```

Matrix CSV: the first row holds the machine names, the first column holds the part names, and the cells are 0 / 1 (`;` or `,`).

```
King's ROC       rows / columns read as binary numbers (leftmost column, top row = highest bit),
                 sort descending (stable), repeat until no change (max 20 iterations)
Jaccard          s_jk = a/(a+b+c)
Single linkage   join j,k if s_jk >= T (and > 0); part -> cell with most operations (tie -> lower cell)
Efficacy         Γ = (e − exceptional)/(e + voids)
Efficiency       η = 0.5·η1 + 0.5·η2, η1 = 1s inside / cells inside blocks, η2 = 0s outside / cells outside
```

Real output (JSON example, T = 0.30):

```
  Cell 1: machines LATHE, GRIND, SAW      parts P02 shaft S1, P05 shaft S2, P08 pin
  Cell 2: machines HMC, DRILL, WASH       parts P01 crankcase A, P04 crankcase B, P07 cover K, P10 bracket
  Cell 3: machines HONE, VMC              parts P03 cylinder C1, P06 cylinder C2, P09 cylinder C3
  operations e        = 27
  exceptional         = 2   (P03 cylinder C1 -> DRILL, P07 cover K -> GRIND)
  voids               = 2   (P08 pin / GRIND, P10 bracket / DRILL)
  efficacy  Gamma     = (27 - 2)/(27 + 2) = 86.2 %
             eta      = 0.5*92.6 % + 0.5*96.2 % = 94.4 %
```

ROC converges in 2 iterations. The sweep shows 1 cell for T ≤ 0.15, 3 cells for 0.20–0.50 (Γ 86.2 %), 4 cells
for 0.55–0.60 (Γ 82.1 %) and 5 cells from 0.65 (Γ 74.1 %).

## 11. gt_opitz.py: simplified Opitz form code

```
python tools/fmse/gt_opitz.py                       (JSON example -> 25033)
python tools/fmse/gt_opitz.py --digits 2,5,0,3,3    (decode)
python tools/fmse/gt_opitz.py --explain             (all tables)
python tools/fmse/gt_opitz.py --build --L 320 --D 60 --ext both-thread --int none --plane 3 --aux 3
python tools/fmse/gt_opitz.py --interactive
python tools/fmse/gt_opitz.py --compare 25033 15033 (4 of 5 digits equal)
```

Digit 1 = part class (0: L/D ≤ 0.5, 1: 0.5 < L/D < 3, 2: L/D ≥ 3). Digit 2 = external shape. Digit 3 = internal shape.
Digit 4 = plane surface machining. Digit 5 = auxiliary holes and gear teeth. **Simplified, so check the original
Opitz tables.** Non-rotational classes 6–9 are not covered.

```
1 part class                          2  rotational, L/D >= 3 (long shaft, spindle)
2 external shape                      5  stepped to both ends, with screw thread
3 internal shape                      0  no through bore, no blind hole (centre holes do not count)
4 plane surface machining             3  external groove and/or slot (e.g. keyway)
5 auxiliary holes and gear teeth      3  radial holes, not related by a drilling pattern
```

## 12. tolerance_process.py: which process reaches the tolerance?

```
python tools/fmse/tolerance_process.py [--D 52 --tol 30 --ra 0.8] [--domain Machining] [--feature bore|bore_rot|shaft|face]
                                       [--chain] [--fit H7/g6]
```

```
required grade   = largest k with IT_k <= tolerance (size range lower < D <= upper)
capable          IT_best <= required and Ra_best <= Ra
economical       capable and IT_worst <= required and Ra_worst <= Ra
chain            z_i = z_min_i + T_(i-1)/2 ;  D_(i-1) = D_i − 2·z_i (bore) ; start at mid-tolerance final D
```

D 52 mm, 30 µm → **IT7** (IT7 = 30 µm ≤ 30 < IT8 = 46). With Ra 0.8 µm: economical = hard turning, cylindrical grinding,
surface grinding, honing, lapping. Capable = finish turning, reaming, fine boring, broaching, wire EDM. Cheapest final
operation (same ranking as the web page) = hard turning (CBN). The process list is a copy of `PROC` in
`web/fmse2_data.js`, and the self-test checks that both are still equal.

```
step  process             IT  T_i mm  T_(i-1) mm  z_min mm  z_i mm  D before mm  D after mm  Ra µm
   1  Rough boring        11   0.190       2.000     0.300  1.3000       48.851      51.451    6.3
   2  Semi-finish boring   9   0.074       0.190     0.100  0.1950       51.451      51.841    3.2
   3  Fine boring          7   0.030       0.074     0.050  0.0870       51.841      52.015    0.8
Raw (cast) bore D_0 = 48.851 mm   total removal = 1.582 mm per side = 3.164 mm on the diameter
```

`--fit` supports hole basis H with shafts **f, g, h** only (ISO 286-2 fundamental deviations 0–500 mm). The self-test
checks them. Example: H7/g6 at 52 mm gives a shaft of −29 / −10 µm and a clearance of 10–59 µm.

## 13. process_time.py: cycle time and power estimators

```
python tools/fmse/process_time.py                          (all, JSON defaults)
python tools/fmse/process_time.py turn|mill|drill|tap [--mat 0..3] [--vc ...] [...]
python tools/fmse/process_time.py spindle [--check-n 800 --check-Pc 9]
python tools/fmse/process_time.py taylor [--v 250]
python tools/fmse/process_time.py mould|bend|weld [...]
```

Every JSON value can be changed with an option of the same name. Each line of the output shows the formula with the numbers filled in.

| Estimator | Result with the JSON defaults |
|---|---|
| turn (C45, D 60, vc 200, f 0.25, ap 2, 3 passes) | n 1061.0 rpm, vf 265.3 mm/min, t_c 1.357 min, Pc 3.167 kW (spindle 3.958 kW), M 28.50 N·m |
| mill (GJL-250, Dc 80, z 6, fz 0.2, vc 160) | n 636.6 rpm, vf 763.9 mm/min, t_c 0.995 min, Q 183.3 cm³/min, Pc 3.361 kW, M 50.42 N·m |
| drill (D 10, H 30, f 0.25, vc 100, 12 holes) | n 3183.1 rpm, 2.49 s/hole, 29.9 s all holes, Pc 1.146 kW |
| tap (M10×1.5, H 20, vc 12, 12 holes) | n 382.0 rpm, 4.82 s/hole, 57.8 s all holes |
| spindle (18 kW, 120 N·m) | n_b 1432.5 rpm. Milling cut: P_av(636.6) = 8.00 kW ≥ 4.20 kW → OK, **torque** limit, reserve 47 % |
| taylor (n 0.25, C 400) | T(200 m/min) 16.0 min. Min cost: T 15.0 min, v 203.3 m/min. Max production: T 3.0 min, v 303.9 m/min |
| mould (s 2.5 mm) | t_cool 7.92 s, cycle 18.42 s, clamp force 756.0 kN |
| bend | 6 × 9 + 20 = 74 s |
| weld | arc time 1.8 m / 0.6 m/min = 3.00 min = 180 s |

## 14. capacity_plan.py: machines, bottleneck, takt, EOQ

```
python tools/fmse/capacity_plan.py [--calendar] [--capacity] [--eoq] [--growth 15] [--hours 3500] [--lots 25,50,94] [--csv out.csv]
```

```
days = 365 − weekend − holidays − shutdown ; h = days·shifts·(shift_h − break_h) ; h_avail = h·(1 − planned_maint)
L_g  = Σ Q·t/60 + Σ ceil(Q/lot)·t_setup/60   (set-up only for parts that use the group)
machines = ceil(L_g/(h_avail·OEE)) ; util = L_g/(machines·h_avail·OEE) ; takt = h_avail·60/demand
Q* = sqrt(2·D·S/H), S = t_setup·rate + admin, H = holding_rate·unit_value ; TC = D/Q·S + Q/2·H
```

```
  h_avail = 3 615.0 * (1 - 0.03) = 3 506.55 h
group     OEE    run h  set-up h  lots   load h    h*OEE  exact  machines  util %  takt min
HMC      0.75  5 133.3     100.0   300  5 233.3  2 629.9  1.990         2    99.5     23.38
VMC      0.75  2 850.0     200.0   400  3 050.0  2 629.9  1.160         2    58.0      5.84
Lathe    0.75  2 100.0     104.2   250  2 204.2  2 629.9  0.838         1    83.8     11.69
Grinder  0.70  1 050.0     100.0   150  1 150.0  2 454.6  0.469         1    46.9     23.38
Washer   0.85  1 125.0       0.0   700  1 125.0  2 980.6  0.377         1    37.7      4.68
Bottleneck: HMC 99.5 %      Takt (all parts): 3 506.55 h * 60 / 45 000 parts = 4.675 min/part
  Q* = sqrt(2*4000*50.00/45.00) = 94.3 parts   total cost at Q* = 4 242.64 EUR/yr
```

With `--growth 15` the HMC group needs 3 machines (76.3 %) and the lathe becomes the bottleneck (96.4 %).

## 15. line_balance.py: stations for the assembly line

```
python tools/fmse/line_balance.py [--rule rpw|lcr|both] [--takt 115.2] [--tasks tasks.csv] [--csv stations.csv]
```

Tasks CSV: `id;name;time_s;predecessors` (separate several predecessors with `,` or a space). Unknown predecessors and
precedence cycles give a clear error.

```
takt = 3840 h * 3600 / 120000 parts = 115.20 s ; min stations = ceil(460/115.2) = 4
RPW  priority A C B E D G F H I J K L   -> stations A C | B E D | G F H | I J | K L
LCR  priority G K C A I E F B J D L H   -> stations A C | F B E | D G H | I J | K L
stations = 5 (min 4)   efficiency = 460/(5*115.20) = 79.86 %   balance delay = 20.14 %
  S3  G=========================F==============H========| 115 s
```

## 16. machine_select.py: AHP, life-cycle cost, combined view

```
python tools/fmse/machine_select.py [--ahp] [--lcc] [--csv lcc.csv]
```

```
AHP   w = normalised geometric row means ; λmax = mean (Aw)_i/w_i ; CI = (λmax−n)/(n−1) ; CR = CI/RI(n) < 0.10
LCC   = purchase + installation + Σ (energy + maintenance + tooling)/(1+r)^t − residual/(1+r)^years
```

```
weights: technical fit 35.12 %, accuracy 18.87 %, local service 10.89 %, life-cycle cost 35.12 %
lambda_max = 4.0104   CR = 0.0038  -> consistent
score: Machine A 7.242 (3), Machine B 7.407 (2), Machine C 7.623 (1)
LCC:   Machine A 814 651 (2), Machine B 863 938 (3), Machine C 812 351 (1) EUR
Machine C is first in both views. The LCC gap to Machine A is only 0.3 %, so treat the two as equal on cost.
```

## Item 2 in a real project

1. Copy `examples/item2_examples.json` and put in your P-Q list, routings (part-machine matrix), feature
   tolerances, cutting data, calendar, part times, assembly tasks, AHP judgements and the supplier offers.
2. Run the tools with `--examples your_project.json`. Use `--matrix` for your PFA matrix and `--tasks` for your
   assembly tasks.
3. Use the estimators (± 20–30 %) only until you have the supplier's time study. Then put the real times into the capacity plan.
4. Fix the AHP judgements **before** you open the offers. Check the knock-out criteria (part fits, local service) first.

---

# Item 3: the elements of an FMS

Eight programs for sizing the **elements** of a flexible system: pallets and fixtures, pallet changer, pallet
pool and stacker, load stations, robot, AGV, conveyor, AS/RS, tool magazine, washer, CMM, marking, gripper,
positioner, sheet tower, chips and coolant. They also cover the assembly / test / vision stations and the hand-over tolerance stack.

- Guide (textbook): [`docs/FMS system design/63_fms_elements_catalogue.md`](../../docs/FMS%20system%20design/63_fms_elements_catalogue.md)
- Web page: Digital twin → tab **FMS engineering** → item 3 (code `web/fmse3.js`, data `web/fmse3_data.js`).
  Deep link to one element: `/?feitem=3&feel=agv#fmse`
- Shared example inputs + exact formulas: `tools/fmse/examples/item3_examples.json` (key `_formulas`)

**The same numbers in three places.** The 17 basic calculators in `element_sizing.py` are a 1:1 copy of the web
calculators (`web/fmse3.js`, object `CALC`): same inputs, same default values, same formulas, same verdict
texts, g = 9.81 m/s². The values are printed with the same decimals and the same rounding as the web page
(half away from zero, `,` as thousands separator, e.g. `31,250 N`). The self-test reads `web/fmse3.js` and
checks that every input key and default value is still the same. The deeper calculations (battery, inertia,
screw, press-fit, leak, vision, transport score, tolerance stack, conveyor drive) use the formulas in
`_formulas` of the JSON. All tools default to `--examples tools/fmse/examples/item3_examples.json`. They all have
`--selftest` and `-h` with example commands.

| Tool | What it does | Inputs |
|---|---|---|
| `element_sizing.py` | The 17 web sizing calculators: inputs, every result with its formula and the numbers, verdict; `--list`, `all`, `--csv` | `web/fmse3.js` defaults, your `--key value` |
| `tolerance_stack.py` | Hand-over stack: worst case, RSS, verdict, largest contributor, coarse-to-fine stages, optional Monte Carlo | `stack` or your CSV `name;tolerance` |
| `agv_fleet.py` | AGV fleet (web) + battery: energy per trip and per hour, runtime, charge time, availability, opportunity charging, extra vehicles | web `agv` + `agv_battery` |
| `asrs_cycle.py` | FEM 9.851 single / double cycle (web), move table, throughput table for other rack sizes, number of cranes for a peak | web `asrs` |
| `robot_payload.py` | Payload, wrist moment, reach (web) + load inertia J and moment M with gripper and part separately | web `robot` + `robot_inertia` |
| `assembly_test.py` | `screw` preload, `pressfit` pressure and force, `leak` rate + temperature error, `vision` pixel size and pixels per defect | `screw_preload`, `press_fit`, `leak_test`, `vision` |
| `transport_select.py` | Weighted star scoring of 6 transport options per need, ranking, winner | `transport_select` |
| `conveyor_drive.py` | Drive force and motor power of a conveyor section | `conveyor_drive` |

## 17. element_sizing.py: the 17 sizing calculators of the web page

```
python tools/fmse/element_sizing.py --list                 (all calculators, their inputs and defaults)
python tools/fmse/element_sizing.py all [--csv out.csv]    (every calculator with the web defaults)
python tools/fmse/element_sizing.py <calc> [--key value ...] [--csv out.csv]
python tools/fmse/element_sizing.py pool --nm 4 --mv 50
```

`<calc>` is one of `cycle pallets apc pool loadst robot agv conv asrs tools wash meas dmc grip posit tower chips`.
The keys are the web input keys. Case matters: `--N`, `--L`, `--H`, `--T`, `--U`, `--S`, `--Sc`.
All inputs must be ≥ 0 and divisors must be > 0. Otherwise the tool stops with an `ERROR:` line.

```
[pool]  Pallet pool places and stacker load
input                              key  value  unit
---------------------------------  ---  -----  ----
Machines                           nm       3
Cycle per pallet                   tc      60  min
Pallets (from Pallets & fixtures)  N       27
Stacker time per move              mv      45  s
Moves per pallet cycle             mpc      4
Free places for exchange           fr       2

result (formula)                             value  with numbers
---------------------------------------  ---------  -----------------
Pallets per hour through machines          3.00 /h  3·60 ÷ 60
Stacker moves per hour                     12.0 /h  3.0000·4
Stacker utilisation = moves·time ÷ 3600       15 %  12.0000·45 ÷ 3600
Rack places = pallets + free places      29 places  27 + 2
Verdict: Stacker has reserve for added machines.
```

Results with the web defaults (the web page shows the same values):

| Calculator | Formulas (short) | Main results with the defaults | Verdict |
|---|---|---|---|
| cycle | non-cut = (n_tc·t_c2c + rapid + pallet + probing)/60; share = t_c/cycle | non-cutting 2.62 min, cycle 10.62 min, share 75 %, 5.65 pallets/h | Good productive share. |
| pallets | manned = 2m + m·buf + load + other; unmanned = m·(1 + ⌈T·60/cycle⌉) | manned 15, unmanned 27, **27 pallets**, TH 3.00/h, flow time 9.0 h | the unmanned shift decides |
| apc | u0 = t_c/(t_c + t_load); u1 = t_c/(t_c + t_change) | 67 % → 98 %, gain 47 % | loading is hidden in the cutting time |
| pool | moves/h = m·60/cycle·moves; u = moves·t/3600 | 3.00 pallets/h, 12.0 moves/h, stacker 15 %, 29 places | reserve |
| loadst | λ = m·60/cycle; work = λ·t_load/60; n = ⌈work/u_max⌉ | λ 3.00/h, work 0.75, **1 station**, 75 % | one station |
| robot | m = part + gripper; M = m·g·e | 20.0 kg, payload 80 %, M 23.5 N·m (47 %), reach margin 200 mm | ✓ (80 % is allowed) |
| agv | t = (d_l + d_e)/v + t_tr; work = orders·t/3600; n = ⌈work/(η·f)⌉ | 260 s, 1.73 vehicle-h/h, **3 vehicles**, 58 % | add 1 reserve |
| conv | on the way = TH·t/3600; N = ⌈st·(1+buf)·0.8 + on the way⌉ | 3.0 on the way, **23 carriers**, 0.80 m/min | test in simulation |
| asrs | FEM 9.851 P1 (L/5, 2H/3), P2 (2L/3, H/5); t = max(t_x, t_y) | single **46.5 s** (77 moves/h), double **74.7 s** (96 moves/h) | plan double cycles |
| tools | sisters = ⌈np·use/life⌉ − 1; pockets = ⌈(unique + k·s)(1 + r)⌉ | use 60 min, 1 sister, **118 pockets** | standard magazine |
| wash | work = TH/pb·t/3600; n = ⌈work/OEE⌉ | 10.0 cycles/h, 0.33, **1 washer**, 33 % | check drying |
| meas | T/U; zone = T − 2U; CMM = TH/n·t_m/60 | 7.5 : 1, zone 22.0 µm, CMM 16 % | ◐ acceptable, use guard bands |
| dmc | smallest ECC 200 square symbol with capacity ≥ characters | 18 × 18 (25 characters), 5.4 mm, 6.6 mm with quiet zone | cell size advice |
| grip | F = m(g + a)S/(μn); F_c = S·F_cut/(μ·n_c) | 1,981 N per jaw, 31,250 N per clamp | form-fit advice |
| posit | M = m·g·e (rotation), m·g·h (tilt) | 471 N·m (47 %), 1,766 N·m (59 %) | ✓ inside the ratings |
| tower | places = ⌈(mat + fin)(1 + r)⌉; sheets = ⌈T·60/(t_cut + t_ch/60)⌉ | 22 places, 32 sheets, laser 94 % | stack height |
| chips | V = Q·T·60·share·bulk/1000·machines; tank = 10·pump flow | 864 litres, tank 600 litres | bulk factors |

## 18. tolerance_stack.py: will the pallet find its place?

```
python tools/fmse/tolerance_stack.py [--capture 12] [--final 0.02]
python tools/fmse/tolerance_stack.py --csv my_stack.csv            (columns name;tolerance in ± mm)
python tools/fmse/tolerance_stack.py --montecarlo 100000 --seed 1
```

`WC = Σ|tᵢ|`, `RSS = √Σtᵢ²`. Verdict: capture ≥ WC → safe; RSS ≤ capture < WC → risk (rare misses, add
monitoring + retry); capture < RSS → not OK. The tool also tells you how much the largest contributor must shrink
so that WC fits the capture range. It prints the three coarse-to-fine stages of the web page.

```
Worst case = Σ |tᵢ|  = 8 + 3 + 2 + 1 + 1.5 = ± 15.50 mm
Statistical (RSS) = √Σ tᵢ² = √80.25 = ± 8.96 mm (all contributors independent, normal)
Capture range ± 12.00 mm -> RISK: only statistical – rare misses possible, add monitoring + retry
Largest contributor: AGV stop position (navigation) (± 8.0 mm) – reduce this first
  To be safe (WC ≤ capture) reduce it from ± 8 to ± 4.5 mm (−3.5 mm), or make the first guide catch ± 15.50 mm.

EXTRA - Monte Carlo (NOT part of the cross-check numbers): 100000 hand-overs, seed 1, each error normal with σ = t/3
  outside ± 12 mm: 7 of 100000 = 0.0070 %   (normal theory with σ_total = RSS/3 = 2.986 mm: 0.0059 %)
```

The Monte Carlo is an extra. It is **not** one of the numbers that the guide and the web page cross-check.

## 19. agv_fleet.py: fleet size and battery

```
python tools/fmse/agv_fleet.py [--trips 40] [--dl 120 --de 100 --vv 1.0 ...] [--Ah 150 --P_charge_kW 6 ...]
```

Part 1 is the web `agv` calculator. `--trips` is the web input `tr`: orders per hour of the whole fleet.
Part 2 uses the JSON formula `agv_battery` per vehicle:
`E_trip = (P_drive·t_drive + P_lift·t_lift)/3.6`, `busy = trips·(t_drive + t_lift + t_other)`,
`E_h = trips·E_trip + P_idle·1000·(3600 − busy)/3600`, `usable = V·Ah·DoD`, `runtime = usable/E_h`,
`charge = usable/(P_charge·1000·η)`, availability = runtime/(runtime + charge).
Opportunity charging needs `E_h/(P_charge·1000·η)` hours of charging per working hour.
Part 3 sizes the fleet again with the battery availability and shows the extra vehicles. With opportunity charging
the availability is 1 if the charging time fits into the idle time, otherwise 1 − (charge share − idle share).

| Battery figure (JSON example) | Value |
|---|---|
| energy per trip | (1.2·220 + 0.8·20)/3.6 = 77.78 Wh |
| busy time | 8·260 = 2080 s per hour (57.8 %) |
| energy per working hour | 622.22 + 63.33 = 685.56 Wh |
| usable energy | 48·100·0.8 = 3840 Wh |
| runtime / charge time | 5.60 h / 1.422 h |
| availability without opportunity charging | 79.8 % |
| opportunity charging | 0.254 h per working hour (15.2 min/h). It fits into the 25.3 min of idle time per hour |
| fleet | web: 3 vehicles (η 0.85); battery 79.8 % → 3 (+0); opportunity charging → 3 (+0) |

With `--trips 40` the web gives 4 vehicles and the battery availability gives 5 (+1).
The tool also checks that the two input sets agree: 24 orders/h ÷ 3 vehicles = 8 trips per vehicle, 260 s per trip.

## 20. asrs_cycle.py: stacker crane cycles, throughput table, number of cranes

```
python tools/fmse/asrs_cycle.py [--L 40 --H 12 --vx 3 --ax 0.5 --vy 0.8 --ay 0.5 --tf 8 --td 4]
python tools/fmse/asrs_cycle.py --peak 150 [--cycle double|single] [--umax 0.85]
python tools/fmse/asrs_cycle.py --lengths 20,40,60,80 --heights 8,12,16 --csv asrs.csv
```

This is the same as the web `asrs` calculator: P1 = (L/5, 2H/3), P2 = (2L/3, H/5); `t_move(s) = s/v + v/a` if s > v²/a,
else `2√(s/a)`; X and Y move together, so `t = max(t_x, t_y)`; single = t(P1) + t(P2) + 2·t_fork + t_dead;
double = t(P1) + t(P1→P2) + t(P2) + 4·t_fork + t_dead. Cranes = ⌈peak/(throughput·u_max)⌉.

```
move           x m   t_x s    y m   t_y s  t = max s  decides
---------  ------  ------  -----  ------  ---------  -------
I/O -> P1   8.000   8.000  8.000  11.600     11.600  Y
I/O -> P2  26.667  14.889  2.400   4.600     14.889  X
P1 -> P2   18.667  12.222  5.600   8.600     12.222  X
Single cycle (store or retrieve)                          46.5 s
Double cycle (store + retrieve)                           74.7 s
Throughput single cycles                              77 moves/h
Throughput double cycles                              96 moves/h
CRANES FOR A PEAK OF 150 moves/h (double cycles, max. utilisation 0.85)
  cranes = ⌈150 / (96.37·0.85)⌉ = ⌈1.831⌉ = 2   (utilisation per crane 78 %; one crane per aisle)
```

## 21. robot_payload.py: payload, moment and inertia

```
python tools/fmse/robot_payload.py [--mp 12 --mg 8 --e 120 ...] [--m_g 8 --e_g 0.1 --m_p 12 --a 0.3 --b 0.2 --e_p 0.2 ...]
```

Part 1 = web `robot` (20.0 kg, payload 80 %, M = 20·9.81·0.12 = 23.5 N·m, 47 %, ✓). Part 2 = JSON `robot_inertia`:
`J = m_g·e_g² + m_p·(a² + b²)/12 + m_p·e_p²` = 0.08 + 0.13 + 0.48 = **0.69 kg m²** (43.1 % of 1.6),
`M = (m_g·e_g + m_p·e_p)·g` = (0.8 + 2.4)·9.81 = **31.392 N m** (62.8 % of 50) → OK (rule ≤ 80 %).
The part offset (Steiner term) is 70 % of J. Side c of the cuboid does not enter the formula because it lies along the axis.

## 22. assembly_test.py: screwdriving, press-fit, leak test, vision

```
python tools/fmse/assembly_test.py                       (all four)
python tools/fmse/assembly_test.py screw|pressfit|leak|vision [--<JSON key> value ...]
```

| Check | Formula | Example result |
|---|---|---|
| screw | F = T/(K·d) | 25/(0.2·0.008) = **15625 N**, 66.5 % of the proof load 23500 N → OK (50–80 % window, rule of thumb) |
| pressfit | p = E·δ/(2d)·(1 − (d/D)²); F = p·π·d·L·μ | p = 105·0.75 = **78.75 MPa**, F = 4725π = **14844 N** (14.84 kN) |
| leak | Q = V·dp/dt; ·60 cm³/min; dp_T = p_abs·dT/T | Q = **0.1 mbar l/s = 6.00 cm³/min**; dp_T = 7013·0.1/293.15 = **2.392 mbar ≥ dp 2 mbar → NOT OK**. A temperature drift of 0.1 K gives more than the leak signal; for ≤ 10 % the part temperature may change only 0.0084 K |
| vision | pixel = max(FOV_x/px_x, FOV_y/px_y); px per defect = defect/pixel | pixel 0.04902 mm, **6.12 px** per 0.3 mm defect → OK (≥ 3 px), repeatability ≈ 0.0049 mm |

The screw window (50–80 % of the proof load) and the 10 % leak limit are rules of thumb added by the tool. The
output marks them as rules of thumb. Check the screw joint with VDI 2230.

## 23. transport_select.py: which transport system?

```
python tools/fmse/transport_select.py                    (all 3 example needs)
python tools/fmse/transport_select.py --need 2
python tools/fmse/transport_select.py --weights 2,4,5,3 [--csv transport.csv]
```

`score = Σ wₖ·sₖ / Σ wₖ` with the stars of the table. For Investment, s = 6 − stars (cheap = good).

| Option | Need 1: pallet pool, fixed line (w 2,4,5,3) | Need 2: kitting, layout changes yearly (w 5,2,2,4) | Need 3: warehouse → lines, 150 m (w 4,2,2,3) |
|---|---|---|---|
| Forklift AGV | 40/14 = 2.857 | 42/13 = 3.231 | 35/11 = 3.182 |
| AGV with roller deck | 44/14 = 3.143 | 44/13 = 3.385 | 37/11 = 3.364 |
| AMR | 40/14 = 2.857 | **49/13 = 3.769** | **40/11 = 3.636** |
| RGV on rail | **54/14 = 3.857** | 40/13 = 3.077 | 35/11 = 3.182 |
| Roller / chain conveyor | 50/14 = 3.571 | 37/13 = 2.846 | 32/11 = 2.909 |
| Stacker crane (pallet pool) | 42/14 = 3.000 | 32/13 = 2.462 | 28/11 = 2.545 |
| **Winner** | RGV on rail | AMR | AMR |

When two scores are equal, the table order is kept (need 1: Forklift AGV and AMR 2.857; need 3: Forklift AGV and RGV 3.182).

## 24. conveyor_drive.py: drive power

```
python tools/fmse/conveyor_drive.py [--m_total_kg 600 --mu_roll 0.03 --a 0.3 --v 0.3 --eta 0.8]
```

`F = m·g·μ + m·a` = 176.58 + 180 = **356.58 N**; `P = F·v/η` = 356.58·0.3/0.8 = **133.72 W**
(steady running only: 66.22 W) → take the next standard motor, e.g. 0.18 kW.

## Item 3 in a real project

1. Start with the web calculators or `element_sizing.py` for first numbers. Change only the inputs you know.
2. Copy `examples/item3_examples.json` and put in your battery, robot, station and transport data. Run the tools
   with `--examples your_project.json`. For the hand-over stack, use your own CSV (`--csv`).
3. Check fleet sizes, crane counts and carrier numbers with a simulation (item 4). The peaks and the traffic decide.
4. Precision at a hand-over always comes from the station (cones, pins, zero-point), never from the vehicle.

---

# Item 4: capacity, layout, simulation

Six programs for the **capacity, layout and simulation** step: how much of the machine time is really
productive (OEE), how long parts wait (queueing), how many pallets a closed FMS needs (MVA + closed laws),
how big a buffer must be, a full discrete-event simulation of a generic FMS, and the block layout with
space and aisles.

- Guide (textbook): [`docs/FMS system design/64_capacity_layout_simulation.md`](../../docs/FMS%20system%20design/64_capacity_layout_simulation.md)
- Web page: Digital twin → tab **FMS engineering** → item 4 (code `web/fmse4.js`, data `web/fmse4_data.js`).
  Deep link: `/?feitem=4#fmse`
- Shared example inputs + exact formulas: `tools/fmse/examples/item4_examples.json` (key `_formulas`)

**Analytic results are exact.** OEE, MTBF / MTTR, M/M/1, Erlang C, Kingman / Sakasegawa, set-up
variability, MVA, closed laws, layout cost, pairwise exchange, SLP score, space and aisles use the formulas
of `_formulas`. The guide, the web page and the tools give the same numbers.

**Simulations are compared statistically.** `buffer_sim.py` and `fms_sim.py` are ports of `runLine()` and
`simFMS()` in `web/fmse4.js`. They use the same event logic, the same event order (time first, then sequence number), the same warm-up
(10 % of the run, at most 2 880 min) and the same statistics. The random generator is the same **mulberry32** as the
web `rng()`, written with 32-bit integer arithmetic (`Math.imul`, `>>> 0`). The self-test checks it against a
second, literal emulation of the JavaScript int32 rules. The same seed therefore gives the same uniform
numbers, and the lognormal (Box–Muller) and exponential samples are drawn in the same order. Example: seed 7,
14 days, N = 10 gives 2.907 pallets/h here and 2.91 on the web page.

**Results may still differ in the last digits.** Python and the browser use different `log` / `cos` / `exp`
libraries. One different last bit can change the order of two events, and then the runs drift apart. That is why the
cross-check is **statistical**: 10 replications with the seeds 1–10, mean ± 95 % half width
`t_9 · s / √10` with `t_9 = 2.262`. The confidence intervals must overlap.

| Tool | What it does | Inputs |
|---|---|---|
| `oee_losses.py` | OEE, TEEP, six-big-loss waterfall (text bars); `--log`: failures, MTTR, MTBF, A_inherent, Pareto of all stop minutes | `oee`, `stop_log` |
| `queueing.py` | `mm1`, `mmm` (Erlang C), `gg` (Kingman / Sakasegawa with breakdowns), `breakdown` (long vs short stops), `setup` (set-up variability table), `curve` (CT/te vs u) | `mm1`, `mmm`, `queue`, `setup_var` |
| `mva_closed.py` | Exact MVA with Seidmann for N = 1..15, closed laws side by side, pallets for 95 % of r_b | `mva` or your CSV |
| `buffer_sim.py` | 2-machine line with a buffer: throughput ± CI per buffer size, % of the limit, rule-of-thumb buffer | `buffer_line` |
| `fms_sim.py` | Closed-loop FMS DES: all KPIs ± CI, Little check, `--sweep` next to MVA and closed laws, `--welch` warm-up curve | `fms_sim` |
| `layout_plan.py` | Layout cost, pairwise exchange with iteration log, SLP closeness score, space table, aisle widths | `layout`, `space`, `aisle` |

All tools default to `--examples tools/fmse/examples/item4_examples.json`. They all have `--selftest` and `-h` with
example commands. Bad input gives an `ERROR:` line and exit code 2.

## 25. oee_losses.py: OEE, TEEP, loss waterfall, stop log

```
python tools/fmse/oee_losses.py [--log | --only-log] [--plan 4800 --down 200 ...] [--csv out.csv]
```

Formulas: `run = plan − down − setup`, `A = run/plan`, `P = ideal·total/run`, `Q = good/total`,
`OEE = A·P·Q`, `TEEP = OEE·plan/cal`, speed loss `= run − ideal·total − minor`, quality loss time `= ideal·(total − good)`.
Stop log: `MTTR` = mean failure duration, `MTBF = (production time − failure minutes)/failures`,
`A_inherent = MTBF/(MTBF + MTTR)`. The Pareto groups **all** stop minutes (failure, minor, set-up) by the reason
text. Equal minutes keep the order of their first appearance in the log.

```
  A    = run / plan          = 3870 / 4500            = 86.0 %
  P    = ideal*total / run   = 2*1650 / 3870       = 85.3 %
  Q    = good / total        = 1610 / 1650            = 97.6 %
  OEE  = A*P*Q               = 0.8600*0.8527*0.9758 = 71.6 %  (= fully productive / plan = 3220 / 4500)
  TEEP = OEE*plan / cal      = 0.7156*4500 / 10080    = 31.9 %
  Planned            4 500 min  100.0 %  ########################################
  Breakdowns           270 min    6.0 %  --
  Set-ups              360 min    8.0 %  ---
  Run time           3 870 min   86.0 %  ##################################
  Minor stops          150 min    3.3 %  -
  Speed loss           420 min    9.3 %  ----
  Net run            3 300 min   73.3 %  #############################
  Scrap / rework        80 min    1.8 %  -
  Fully productive   3 220 min   71.6 %  #############################

  failures   = 7  (sum 373 min)
  MTTR       = 373 / 7 = 53.29 min
  MTBF       = (9600 - 373) / 7 = 1318.14 min = 21.97 h
  A_inherent = MTBF / (MTBF + MTTR) = 1318.14 / 1371.43 = 96.11 %
 #  reason                            type     n  min     %  cum %
 1  Pallet clamp hydraulic leak       failure  1  120  24.2   24.2
 2  Axis drive fault (X)              failure  1   90  18.1   42.3
 3  Tool magazine chain fault         failure  1   60  12.1   54.4
 4  Spindle overload / tool breakage  failure  1   45   9.1   63.5
 5  Coolant level low                 failure  2   40   8.1   71.6
 6  Program prove-out new part        setup    1   40   8.1   79.6
 ...
11  Probe error                       minor    2    7   1.4  100.0
```

## 26. queueing.py: M/M/1, Erlang C, Kingman, breakdowns, set-ups, curve

```
python tools/fmse/queueing.py [mm1|mmm|gg|breakdown|setup|curve|all] [--lam --te --m --u --t0 --c0 --ca --mttf --mttr --cr]
python tools/fmse/queueing.py setup --rate 4.5        (or --u 0.8 = utilisation at the largest Ns)
python tools/fmse/queueing.py curve --step 0.01 --csv curve.csv
```

| Model | Formula | Example result |
|---|---|---|
| M/M/1 | ρ = λ/μ, Lq = ρ²/(1−ρ), Wq = Lq/λ, W = Wq + 1/μ, L = λW | ρ 0.8333, Lq 4.1667, Wq 50.00 min, W 60.00 min, L 5.00 |
| M/M/3 Erlang C | a = λ/μ, P0, C, Lq = Cρ/(1−ρ) | a 2.5, ρ 0.8333, P0 0.044944, C 0.702247, Lq 3.5112, Wq 21.07 min, W 36.07 min, L 6.0112 |
| G/G/m | A = MTTF/(MTTF+MTTR), te = t0/A, ce² = c0² + (1+cr²)A(1−A)MTTR/t0, Wq = (ca²+ce²)/2 · u^(√(2(m+1))−1)/(m(1−u)) · te | A 90.91 %, te 11 min, ce² 1.2417, Wq 69.87 min, CT 80.87 min, WIP 6.25 |

```
BREAKDOWNS: SHORT AND FREQUENT OR RARE AND LONG?  (u = 0.85, t0 = 10, c0 = 0.5, ca = 1, m = 1)
case                       MTTF  MTTR     A %  te min    ce^2  Wq min  CT min  CT/te
Your machine                600    60   90.91  11.000  1.2417   69.87   80.87   7.35
Same A, 10x shorter stops    60     6   90.91  11.000  0.3492   42.05   53.05   4.82
No breakdowns                 -     -  100.00  10.000  0.2500   35.42   45.42   4.54

SET-UP VARIABILITY  (t0 = 10 min, sigma0 = 5, ts = 60 min, sigma_s = 20)    with --u 0.8
Ns  te min  sigma_e^2    ce^2       u    Wq min
5   22.000    681.000  1.4070  1.5304  unstable
10  16.000    389.000  1.5195  1.1130  unstable
20  13.000    216.000  1.2781  0.9043    140.00
40  11.500    122.750  0.9282  0.8000     44.35
```

Set-up formulas (Hopp & Spearman): `te = t0 + ts/Ns`, `σe² = σ0² + σs²/Ns + (Ns−1)/Ns²·ts²`, `ce² = σe²/te²`.
`Wq` in the set-up table uses Kingman with m = 1 and `ca` of section `queue`. `curve` prints CT/te for
u = 0.30, 0.35, …, 0.95, 0.97 for the machine, the short-stop machine and the machine without breakdowns.
These are the three lines of the web chart.

## 27. mva_closed.py: MVA and closed laws

```
python tools/fmse/mva_closed.py [--N 15] [--stations my_stations.csv] [--csv out.csv]
```

The stations CSV has the columns `name;servers;demand_min` (the header is optional). Seidmann: a station with m
servers and demand D becomes a single-server queue with D/m plus a pure delay D(m−1)/m. MVA:
`R_k(n) = D_k/m_k · (1 + Q_k(n−1))`, `X(n) = n / Σ(R_k + R_delay)`, `Q_k(n) = X(n)·R_k(n)`.
Closed laws: `r_b = min m_k/D_k`, `T0 = Σ D_k`, `W0 = r_b·T0`, best `min(N/T0, r_b)`, PWC `N/(W0+N−1)·r_b`, worst `1/T0`.

```
  rb = 2.9762 pallets/h (Machines)   T0 = 75.48 min   W0 = rb*T0 = 3.7440 pallets
 N   worst     PWC     MVA    best  MVA % of rb
 1  0.7949  0.7949  0.7949  0.7949         26.7
 2  0.7949  1.2547  1.4477  1.5898         48.6
 3  0.7949  1.5544  1.9532  2.3847         65.6
 4  0.7949  1.7652  2.3202  2.9762         78.0
 5  0.7949  1.9216  2.5701  2.9762         86.4
 6  0.7949  2.0422  2.7311  2.9762         91.8
 7  0.7949  2.1381  2.8303  2.9762         95.1
 8  0.7949  2.2161  2.8899  2.9762         97.1
10  0.7949  2.3354  2.9461  2.9762         99.0
15  0.7949  2.5159  2.9740  2.9762         99.9
Pallets for 95 % of rb: N = 7 (X = 2.8303 pallets/h = 95.1 % of rb)
```

The full output also lists R and Q per station and the loop time `n/X` for every n.

## 28. buffer_sim.py: buffer between two machines (simulation)

```
python tools/fmse/buffer_sim.py [--reps 10] [--B 0,1,2,5,10,20] [--seeds 11,23] [--t1 --t2 --cv --mttf --mttr --T] [--csv out.csv]
```

Port of `runLine()`: M1 → buffer (B places) → M2, with lognormal cycles and time-based breakdowns. M1 is blocked
when the buffer is full. `TH = parts / T · 60`. Limit `= min(A/t1, A/t2)·60`. Rule-of-thumb buffer
`= MTTR / cycle`. 10 replications (seeds 1–10), 30 000 min each:

```
  limit = min(A/t1, A/t2)*60 = 54.545 parts/h   (A = 0.9091)
B places  TH parts/h (mean ± 95 % hw)         95 % CI  % of limit
       0                 44.13 ± 0.21  43.92 .. 44.34        80.9
       1                 47.55 ± 0.26  47.29 .. 47.81        87.2
       2                 49.21 ± 0.48  48.73 .. 49.68        90.2
       3                 49.49 ± 0.30  49.19 .. 49.78        90.7
       5                 50.07 ± 0.24  49.83 .. 50.31        91.8
       8                 50.77 ± 0.38  50.39 .. 51.15        93.1
      10                 50.89 ± 0.32  50.57 .. 51.21        93.3
      15                 51.55 ± 0.33  51.21 .. 51.88        94.5
      20                 51.97 ± 0.32  51.65 .. 52.29        95.3
Places for 95 % of the limit (mean): 20
Rule of thumb: buffer = MTTR / cycle = 10 / 1 = 10.0 parts
```

`--seeds 11,23` runs the two seeds that the web page averages.

## 29. fms_sim.py: generic closed-loop FMS (simulation)

```
python tools/fmse/fms_sim.py [--N 10 --reps 10] [--rule FIFO|SPT] [--m --L --V --load --loadCv --move --mttf --mttr --days] [--csv out.csv]
python tools/fmse/fms_sim.py --sweep [--nmax 20]
python tools/fmse/fms_sim.py --welch [--window 12 --every 6]
```

Port of `simFMS()`: N pallets cycle load station → vehicle → machine → vehicle → load station. The part type
is drawn at loading by the mix. Machines have lognormal machining times and time-based breakdowns. Dispatching is FIFO or SPT.
The statistics start after the warm-up `min(10 % of T, 2 880 min)`. Little check: `N = TH · loop time`.

```
GENERIC FMS - DISCRETE-EVENT SIMULATION  m = 3 machines, N = 10 pallets, L = 1, V = 1, rule FIFO
  load 12 min (cv 0.3), move 1.5 min, MTTF 1200 / MTTR 60 min, 14 days, warm-up 2016 min, replications 10 (seeds 1..10)
KPI (mean ± 95 % half width)         unit               value
Throughput                           pallets/h  2.984 ± 0.032
Machine utilisation (incl. repairs)  %            100.0 ± 0.0
  of it breakdown (repair)           %            4.53 ± 0.71
Load station utilisation             %             59.6 ± 0.9
Vehicle utilisation                  %             14.9 ± 0.2
Pallet loop time                     min          201.0 ± 2.1
Queue at the machines                pallets      6.09 ± 0.02
Queue at the load station            pallets      0.16 ± 0.01
Little check TH*loop                 pallets      9.99 ± 0.01
Theory: bottleneck machines rb = 2.976 pallets/h (machines 2.976 · load stations 5.000 · vehicles 20.000), T0 = 75.48 min, W0 = 3.74
        best 2.976 · PWC 2.335 · worst 0.795 · MVA 2.946 pallets/h  ->  simulated TH 2.984 ± 0.032 = 100.3 % of rb
```

With N = 10 the machines are saturated: the simulated TH equals r_b within the CI. The simulated TH lies
**above** the MVA value because the real times vary less than exponential times (machining cv 0.15).

```
PALLET SWEEP  N = 1..15  (10 replications per N, 14 days each)
 N    sim TH ± hw    MVA  worst    PWC   best  loop min   uM %
 1  0.793 ± 0.006  0.795  0.795  0.795  0.795      75.7   26.8
 2  1.566 ± 0.014  1.448  0.795  1.255  1.590      76.5   52.7
 3  2.316 ± 0.024  1.953  0.795  1.554  2.385      77.7   77.9
 4  2.786 ± 0.015  2.320  0.795  1.765  2.976      86.1   93.6
 5  2.950 ± 0.018  2.570  0.795  1.922  2.976     101.7   99.3
 6  2.977 ± 0.031  2.731  0.795  2.042  2.976     120.9  100.0
 8  2.977 ± 0.029  2.890  0.795  2.216  2.976     161.1  100.0
10  2.984 ± 0.032  2.946  0.795  2.335  2.976     201.0  100.0
15  2.965 ± 0.028  2.974  0.795  2.516  2.976     303.5  100.0
Pallets for 95 % of the best simulated TH: 5; for 95 % of rb: 5
```

`--welch` prints the replication-averaged hourly throughput and its centred moving average (window w hours).
The warm-up ends where the curve becomes flat.

## 30. layout_plan.py: layout cost, pairwise exchange, SLP, space, aisles

```
python tools/fmse/layout_plan.py [--craft] [--slp] [--space] [--aisle] [--start 6,0,5,1,7,4,2,3] [--csv swaps.csv]
```

`C = Σ f_ij · d_ij`, `d_ij = (|dx| + |dy|) · 20 m`. Pairwise exchange (steepest descent): try every slot pair
i < j and take the swap with the largest strict saving (the first one on ties). Repeat until no swap helps.

```
  [  Assembly  ][ Receiving  ][  Grinding  ][ Saw / prep ]
  [  Shipping  ][ Heat treat ][  Turning   ][  Milling   ]
  C(start) = 8 900 load·m/day
it  swap               departments               cost before  cost after  saving
 1  slot 1 <-> slot 2  Receiving <-> Grinding          8 900       7 200  -1 700
 2  slot 2 <-> slot 3  Receiving <-> Saw / prep        7 200       6 400    -800
 3  slot 2 <-> slot 7  Saw / prep <-> Milling          6 400       5 600    -800
3 swaps: 8 900 -> 5 600 load·m/day (-37 %).
  [  Assembly  ][  Grinding  ][  Milling   ][ Receiving  ]
  [  Shipping  ][ Heat treat ][  Turning   ][ Saw / prep ]
```

SLP score (A 16, E 8, I 4, O 2, U 0, X −64, adjacent = slot distance 1): **start −30**, because the X pair Saw / prep –
Grinding is adjacent. **Improved layout 90**: the adjacent A pairs are Receiving – Saw, Saw – Turning, Heat treat –
Grinding, Grinding – Assembly and Assembly – Shipping, plus E Turning – Heat treat and O Heat treat – Shipping.

Space: `area = machines · (footprint + operator & service) · (1 + allowance)`:
Turning 114.40, Milling 117.00, Grinding 93.60, Heat treat 72.00, Assembly 134.40 → net **531.40 m²**,
aisles 25 % of net = 132.85 m², **total 664.25 m²**. If your 25 % means a share of the total floor, the tool
also prints `531.40/(1 − 0.25) = 708.53 m²`.

Aisles (`w` = the wider of vehicle and load, `c` = 0.5 m): forklift one-way `w + 2c` = 2.20 m, two-way `2w + 3c` = 3.90 m;
AGV one-way 2.00 m, two-way 3.50 m; AGV with people (+0.5 m each side) one-way 3.00 m, two-way 4.50 m.

## Item 4 in a real project

1. Measure first: run `oee_losses.py --log` on a real stop log. The Pareto shows where the time goes.
2. Use `queueing.py` and `mva_closed.py` for fast what-if answers (minutes, not days). They show where the
   bottleneck is and roughly how many pallets you need.
3. Confirm with the simulation (`fms_sim.py`). Use more replications for decisions and `--welch` to check the warm-up.
   Put your real machining times, mix, breakdown data and transport times into a copy of the JSON.
4. Lay out with `layout_plan.py`, then add the building constraints (columns, utilities, clean / dirty zones,
   safety distances, expansion space). The pairwise exchange gives a local optimum only. Try other starts.

---

# Item 5: control architecture

Six programs for the **control architecture** step: the PackML state machine of every module, the tag-naming
rule and the data-block tag list, the cell-controller logic (MES → job buffer → load station → vehicle →
machines → confirmations), the availability of the control chain and of the MES link, the alarm-system KPIs,
and ISA-95 / B2MML-style messages between ERP, MES and the cell.

- Guide (textbook): [`docs/FMS system design/65_control_architecture.md`](../../docs/FMS%20system%20design/65_control_architecture.md)
  (data-block items: `66_communication.md`, section 8)
- Web page: Digital twin → tab **FMS engineering** → item 5 (code `web/fmse5.js`, data `web/fmse5_data.js`).
  Deep link: `/?feitem=5#fmse`
- Shared example inputs + exact rules: `tools/fmse/examples/item5_examples.json` (keys `_formulas` and `cell_sim._rules`)

**Everything in item 5 is deterministic.** There are no random numbers. The guide, the web page and these tools
apply the same rules to the same inputs, so the results must be **identical**, and that includes the cell-controller
message log, line by line. The PackML tables (`STATES`, `CMDS`, `EDGES`, `MODES`) are copied from `web/fmse5_data.js`.
The data-block tables (`BLOCK`, `EXTRA`) are copied from `web/fmse6_data.js`. Each self-test reads the web file and
checks that the copy still matches it (helper `read_js_const()` in `fmse_common.py`).

| Tool | What it does | Inputs |
|---|---|---|
| `packml_sim.py` | PackML engine: runs the 6 scenarios with a trace (accepted / rejected + reason), `--cmds` own list, `--table` full state × command table + CSV | `packml_scenarios` |
| `tag_namer.py` | Checks tag names (6 parts, characters, unit number, length, negative word, duplicate), `--generate` builds the data-block tag list (297 tags, all checked) + CSV, IEC 81346 example | `naming` |
| `cell_controller_sim.py` | Cell-controller logic simulation exactly per `cell_sim._rules`: log, KPIs, text Gantt, CSV; `--scenario b`, `--buffer`, `--mes-down` | `cell_sim` |
| `arch_availability.py` | A per component, the two architecture variants (series of parallel blocks), downtime h/year; MES-buffer loss table | `availability` |
| `alarm_kpi.py` | ISA-18.2 / EEMUA 191 KPIs: 10-min counts, average/h, peak, floods, priority mix, chattering, top-5 bad actors, histogram, verdict | `alarm_log` or your CSV |
| `isa95_msg.py` | B2MML-style PROCESS / ACKNOWLEDGE / SHOW messages for the 12 jobs (XML or JSON), validator, idempotency demo | `cell_sim` (+ times from the simulation) |

All tools default to `--examples tools/fmse/examples/item5_examples.json`. They all have `--selftest` and `-h` with
example commands. Bad input gives an `ERROR:` line and exit code 2. Files you ask for with `--csv` are `;` separated
UTF-8 CSV files with a BOM.

## 31. packml_sim.py: PackML state machine

What it does: it plays a list of PackML commands on one module and shows, for each command, the state before, the
state after, and whether the command was **accepted** or **rejected** and why. Every module of the FMS
(machine, pallet pool, load station, washer ...) uses this same state machine, so the cell controller needs only
one piece of code for all of them.

Rules (`_formulas.packml`, ISA-TR88.00.02):

- Start state **Stopped (2)**. State numbers 1–17 and command numbers 1–9 are the standard ones (`STATES`, `CMDS`).
- A command is accepted only if (1) the **mode** allows it (`MODES`: Production has all 9 commands, Maintenance
  has no Suspend / Unsuspend, Manual has only Reset, Start, Stop, Abort, Clear) **and** (2) the current state has
  a transition for it (`EDGES`). Otherwise it is **rejected**: the state stays the same and the reason is logged.
- **Stop** works from every state except Stopped, Stopping, Aborting, Aborted, Clearing (→ Stopping).
  **Abort** works from every state except Aborting, Aborted (→ Aborting).
- **SC** (state complete) finishes an *acting* state. There are 11: Resetting, Starting, Execute, Completing,
  Holding, Unholding, Suspending, Unsuspending, Stopping, Aborting, Clearing. In a *wait* state (Stopped, Idle,
  Complete, Held, Suspended, Aborted) SC is rejected. SC is a signal of the module itself, not an operator
  command, so it is not checked against the mode.
- A mode change (`Mode=Manual` in a command list) is only allowed in Stopped, Idle or Aborted.

How to run:

```
python tools/fmse/packml_sim.py                         (the 6 JSON scenarios + summary)
python tools/fmse/packml_sim.py --scenario 6 --csv trace6.csv
python tools/fmse/packml_sim.py --table --csv packml_table.csv      (17 states x 10 columns)
python tools/fmse/packml_sim.py --table --mode Manual               ('(mode)' = blocked by the mode)
python tools/fmse/packml_sim.py --mode Maintenance --cmds Reset,SC,Start,SC,Suspend,Hold,SC
```

Real output:

```
Scenario 5: Wrong commands   (mode Production, start Stopped)
step  command  before          after           result    reason
----  -------  --------------  --------------  --------  --------------------------
   1  Start    Stopped (2)     Stopped (2)     REJECTED  no transition from Stopped
   2  Reset    Stopped (2)     Resetting (15)  accepted
   3  SC       Resetting (15)  Idle (4)        accepted
   4  Unhold   Idle (4)        Idle (4)        REJECTED  no transition from Idle
  END STATE: Idle (4)   mode Production   rejected: Start (step 1), Unhold (step 4)

SUMMARY
#  scenario                    mode        end state    rejected
-  --------------------------  ----------  -----------  -------------
1  Normal job                  Production  Idle (4)     -
2  Hold for missing material   Production  Execute (6)  -
3  Suspend (no pallet coming)  Production  Execute (6)  -
4  E-stop and recovery         Production  Idle (4)     -
5  Wrong commands              Production  Idle (4)     Start, Unhold
6  Manual mode limits          Manual      Stopped (2)  Hold, Suspend
```

The transition table has 35 accepted (state, command) pairs: 8 command edges, plus Stop from 12 states, plus
Abort from 15 states. It also has 11 SC transitions.

## 32. tag_namer.py: tag names and the data-block tag list

What it does: it checks tag names against the naming rule of the URS. It also generates the complete tag list of
the standard module data blocks for all units of the cell, and it shows how an IEC 81346 reference designation
is built.

Rule (`_formulas.tag`, changed 2026-11-15, see `_naming_changelog`): `site.area.cell.unit.equipment.signal`,
**exactly 6 parts**, e.g. `PLT1.MACH.FMS1.MC02.APC.ClampOK`.

| Check | Wrong example | Why it matters |
|---|---|---|
| parts: exactly 6 | `PLT1.MACH.FMS1.MC01.Load` | every tag has the same structure, so tools can split it |
| bad characters: parts 1–5 only `A-Z a-z 0-9`; the signal also, plus at most **one** `_` + unit suffix (`SpindleLoad_pct`, `Torque_Nm`, `LastCycle_s`) | `Pos-Ok` | `-`, space, umlaut break PLC, SCADA or SQL names |
| unit number: unit code + **2 digits** | `MC2` | sorting MC1, MC10, MC2 goes wrong; one fixed format |
| length ≤ `max_len` (48) | `...Tank.LevelHighHighAlarmWithDelay` (54) | HMI fields, OPC UA browse names, historian limits |
| negative word: signal must not start with Not / No / Non / Un + upper case | `NotOK` | double negation (`NotOK = FALSE`) causes logic errors; name the positive state |
| duplicate | the same tag twice | two signals with one name: wrong data in SCADA |

Data-block tags (`_formulas.datablock_tags`): every unit instance (code + 01..n) gets the 15 standard items of
guide 66 section 8 (`Status.StateCurrent` ... `Command.Heartbeat`), plus the module part `EXTRA` of its module
(M01 machine, M03 pool, M04 load station, M06 AGV station, M11 CMM). The tag has 6 parts,
`site.area.cell.unit.group.item`: the group of the item name is the equipment part, e.g.
`PLT1.MACH.FMS1.MC01.Status.StateCurrent`, or `PLT1.MACH.FMS1.MC01.NC.ProgramNo` from `EXTRA`. Every generated
tag must pass the same rule. There is no exception, and the tool checks all of them.

How to run:

```
python tools/fmse/tag_namer.py                          (the 6 JSON test tags + IEC 81346 example)
python tools/fmse/tag_namer.py --check PLT1.MACH.FMS1.MC01.Door.Closed PLT1.MACH.FMS1.LS1.X.Y
python tools/fmse/tag_namer.py --check-file my_tags.txt --csv check.csv   (exit code 1 if a tag is wrong)
python tools/fmse/tag_namer.py --generate --csv datablock_tags.csv
```

Real output:

```
#  tag                                                     verdict  reason
1  PLT1.MACH.FMS1.MC02.APC.ClampOK                         OK
2  PLT1.MACH.FMS1.MC2.Door.Closed                          ERROR    unit number format: 'MC2' must be unit code + 2-digit number (e.g. MC02)
3  PLT1.MACH.FMS1.LS01.LightCurtain.NotOK                  ERROR    negative word: signal 'NotOK' starts with 'Not' - name the positive state
4  PLT1.MACH.FMS1.POOL01.Fork.Pos-Ok                       ERROR    bad characters in: 'Pos-Ok' (only A-Z a-z 0-9; signal: one '_' + unit suffix allowed)
5  PLT1.MACH.FMS1.WASH01.Tank.LevelHighHighAlarmWithDelay  ERROR    length: 54 characters > 48
6  PLT1.MACH.FMS1.MC02.APC.ClampOK                         ERROR    duplicate: same tag already in the list

  18 unit instances x 15 standard items = 270 + module parts 27 = 297 tags
  longest tag 47 characters (max_len 48): PLT1.MACH.FMS1.AGVST01.Admin.ProdProcessedCount
  rule check of all generated tags: 297 OK, 0 with errors

  full designation: =FMS1.MC02+HALL1.A3-KF1
```

The two longest tags are `...AGVST01.Admin.ProdProcessedCount` and `...AGVST01.Admin.ProdDefectiveCount`, both
`15 + 8 + 6 + 18 = 47` characters, so they are within `max_len` 48. A longer unit code (6 letters) would exceed it.
Keep unit codes at 5 letters or fewer.

## 33. cell_controller_sim.py: cell-controller logic

What it does: it runs the decision logic of the cell controller minute by minute. Jobs come from the MES into a
small **job buffer** (max 3). The load station loads a pallet with the next job. The cell routes the READY pallet to
the lowest free machine. One vehicle moves the pallets. When a pallet comes back to the load station, a
**confirmation** goes into the outbox and is sent to the MES. MES outages and machine faults are events.

Rules (`cell_sim._rules`, applied exactly). Time steps t = 0 … T, and in each step:

1. **External events** (time, then list order). FAULT: the machine cannot be routed to. If it is executing, it stores
   `remaining = end − t` and goes to Held. REPAIRED: if a remaining time is stored, `end = t + remaining` and the
   machine goes back to Execute. MES_DOWN / MES_UP switch the MES link.
2. **Completions** with `end == t`: first the vehicle, then the machines by index, then the load station.
   A move to a machine gives START (`end = t + machining time`). A move to the LS gives ARRIVE_LS, the pallet joins
   the LS queue and `CONF(job)` goes into the outbox. Machine end gives DONE and a vehicle request to the LS.
   Load station end gives LOADED and the pallet becomes READY.
3. **MES** (only if the link is up): SEND_CONF for every confirmation in the outbox, then receive at most ONE job
   (JOB) if the buffer has room and the MES still has jobs.
4. **Decisions**: (a) LOAD if the LS is free and both the queue and the buffer have something. If the LS is free,
   the queue has a pallet, the buffer is empty and the MES still has jobs, that minute counts as **starved**.
   (b) ROUTE the READY pallets to the lowest-index Idle, unreserved, not faulted machine.
   (c) MOVE: the free vehicle takes the first request (FIFO). A machine becomes Idle when its pallet is taken away.

KPIs at T: started, done, confirmations sent, outbox at T, max outbox, starved minutes, Execute minutes per machine
(minutes t of the run in state Execute, i.e. `t ∈ [start, end)`), Held minutes.

Log format: `t EVENT object details`. The events are `JOB J01`, `LOAD P1 J01`, `LOADED P1 J01`, `ROUTE P1 MC01`,
`MOVE P1 LS->MC01`, `MOVE P1 MC01->LS`, `START MC01 P1 J01`, `DONE MC01 P1 J01`, `ARRIVE_LS P1 J01`,
`SEND_CONF J01`, `FAULT MC02 Held`, `REPAIRED MC02 Execute`, `MES_DOWN` and `MES_UP`.

How to run:

```
python tools/fmse/cell_controller_sim.py                       (scenario A: KPIs + Gantt)
python tools/fmse/cell_controller_sim.py --log --csv log_a.csv (full log, 124 lines)
python tools/fmse/cell_controller_sim.py --scenario b --log    (MES down 50-140)
python tools/fmse/cell_controller_sim.py --scenario b --buffer 12   (bigger buffer: starved 0)
python tools/fmse/cell_controller_sim.py --mes-down 50,200     (your own MES outage, faults of scenario A)
```

Real output, scenario A (first 20 log lines):

```
  0 JOB J01
  0 LOAD P1 J01
  1 JOB J02
  2 JOB J03
  3 JOB J04
  10 LOADED P1 J01
  10 LOAD P2 J02
  10 ROUTE P1 MC01
  10 MOVE P1 LS->MC01
  11 JOB J05
  12 START MC01 P1 J01
  20 LOADED P2 J02
  20 LOAD P3 J03
  20 ROUTE P2 MC02
  20 MOVE P2 LS->MC02
  21 JOB J06
  22 START MC02 P2 J02
  30 LOADED P3 J03
  30 LOAD P4 J04
  30 ROUTE P3 MC03
```

| KPI at T = 300 | Scenario A (MES down 50–80) | Scenario B (MES down 50–140) |
|---|---|---|
| jobs started / done | 12 / 12 | 12 / 12 |
| confirmations sent, outbox at T | 12, 0 | 12, 0 |
| max outbox | 1 | **6** |
| starved minutes of the LS | 0 | **52** |
| Execute minutes MC01 / MC02 / MC03 | 150 / 140 / 130 | 180 / 110 / 130 |
| Held minutes MC02 (fault 60–85) | 25 | 25 |

```
         0         1         2         3   (digit = hundreds of minutes, 1 char = 10 min)   scenario B
MC01     .EEEEEEEEEEEE..EEEEEEEE........
MC02     ..EEEEHHHEEE....EEEE...........
MC03     ...EEEEEEEEEEE...EEE...........
LS       LLLLLLLL......LLLL.............
Vehicle  .2224.4.48..2222224.4.2........
```

What it shows: the 3-job buffer covers a 30-minute MES outage completely (A). A 90-minute outage (B) empties the
buffer, so the load station waits 52 minutes for jobs and 6 confirmations pile up in the outbox. They are all sent
when the MES is back, and none is lost. Use `--buffer` to find the buffer that covers your longest MES outage.

## 34. arch_availability.py: availability of the control chain

Formulas (`_formulas.availability`, `_formulas.mes_buffer`):

```
A = MTBF / (MTBF + MTTR)              parallel (n redundant): A_block = 1 - (1 - A)^n
series: A_chain = product of blocks   downtime = (1 - A) * 8760 h/year
MES outages: f = 8760 / (MTBF + MTTR) per year, duration exponential, mean MTTR
P(outage > b) = exp(-b / MTTR)        expected loss = f * MTTR * exp(-b / MTTR)  h/year
```

How to run: `python tools/fmse/arch_availability.py [--buffers 0,0.5,1,2,4,8,12] [--csv availability.csv]`

Real output:

```
component           MTBF h  MTTR h         A  downtime h/year
MES server            8000       4  0.999500            4.378
Core switch          50000       2  0.999960            0.350
Cell controller PC   20000       8  0.999600            3.503
Cell PLC            100000       4  0.999960            0.350
Safety PLC          150000       4  0.999973            0.234
Machine PLC/CNC      30000       6  0.999800            1.752

variant                                               A  downtime h/year  saved vs first h/year
Single cell controller, single switch         0.9995202             4.20                   0.00
Redundant cell controller pair + switch ring  0.9999598             0.35                   3.85

buffer b h  P(outage > b)  expected loss h/year
0                  1.0000                 4.378
1                  0.7788                 3.409
2                  0.6065                 2.655
4                  0.3679                 1.611
8                  0.1353                 0.592
```

The redundancy assumes independent failures and a switch-over that always works. Test the switch-over at FAT / SAT.
In the redundant variant the single cell PLC is the largest remaining part of the downtime.

## 35. alarm_kpi.py: alarm-system KPIs

Rules (`_formulas.alarm_kpi`, ISA-18.2 / EEMUA 191): count the alarms per 10-min window `[0, 600), [600, 1200) ...`.
Average = alarms / shift hours / operators. Peak = the largest window count. A **flood** window has more than 10
alarms. Priorities 1 high / 2 medium / 3 low are compared with the target 5 / 15 / 80 %. A **chattering** tag has
≥ 3 activations within 60 s (`t[i+2] − t[i] ≤ 60 s`). The **top-5 bad actors** are the tags with the most alarms
(on ties, the tag that appeared first wins). The verdict on the average is: ≤ 6/h acceptable, ≤ 12/h manageable.
The "< 1 % of the time in flood" check and the priority-mix verdict are additional EEMUA-style guide values.

How to run:

```
python tools/fmse/alarm_kpi.py [--csv windows.csv]
python tools/fmse/alarm_kpi.py --csv-in my_alarm_log.csv --shift-h 8 --operators 2   (CSV: t_s;tag;priority)
```

Real output:

```
alarms in the shift                          39
average per hour per operator             4.875
peak 10-min count                            15
flood windows (> 10)           1 of 48 = 2.08 %
alarms inside floods                15 = 38.5 %
priority: low 22 = 56.4 % (target 80) · medium 13 = 33.3 % (15) · high 4 = 10.3 % (5)
chattering: WASH1.LevelHigh (6 activations)
top-5: WASH1.LevelHigh 6, MC01.CoolantLow 3, MC02.SpindleTemp 3, POOL1.ForkPos 3, LS1.LightCurtain 2
VERDICT: average acceptable (<= 6) · peak = flood · time in flood too high · too many high / medium · fix 1 chattering tag
```

The average looks fine, but one air-pressure drop at 02:10 makes a 15-alarm flood. The fix is to treat the first-out alarm
(`UTIL1.AirPressLow`) as the cause and suppress the follow-up alarms (state-based or first-out suppression).

## 36. isa95_msg.py: ISA-95 / B2MML-style messages

> **Format: B2MML-style example. Check the B2MML schema version you use.** The element names follow the ISA-95
> object model and the B2MML verb / noun idea (`Process`, `Acknowledge`, `Show` + `ApplicationArea` + `DataArea`).
> The messages are not validated against the official XSD. Map the fields to the schema version of your MES / ERP.

What it does: for each of the 12 jobs of the cell simulation it makes 4 messages: `ProcessProductionSchedule`
(ERP → MES, the production order), `ProcessJobOrder` (MES → cell, at the minute the cell receives the JOB),
`AcknowledgeJobOrder` (cell → MES, same minute, refers to the job-order message ID) and
`ShowProductionPerformance` (cell → MES, at SEND_CONF, with the real start / end time, machine and pallet
from the simulation). Minute 0 = the fixed example time `2026-11-20T06:00:00Z`.

- **Message ID** (`BODID`) = `<sender>-<sequence 6 digits>`, e.g. `CELL-000009`. **SequenceNumber** = 1, 2, 3 … per
  sender, so the receiver can see a gap (lost message).
- **Validator**: required header fields (sender, receiver, UTC time, BODID, sequence number) plus the body fields
  of each message type. It also checks the time format, that the sequence number is ≥ 1, and that end ≥ start.
- **Idempotency**: the receiver stores every processed BODID. If the same ID comes again (for example, a re-send
  after a lost acknowledge), the message is ignored and only acknowledged again. A confirmation is never booked twice.

How to run:

```
python tools/fmse/isa95_msg.py                       (message list + all J01 messages as XML)
python tools/fmse/isa95_msg.py --json --job J05
python tools/fmse/isa95_msg.py --out msgs --csv messages.csv    (one file per message)
```

Real output (excerpt):

```
29  06:44   44  ShowProductionPerformance  CELL->MES  CELL-000009           9  J01
  48 messages; validator: 0 errors
          <ActualStartTime>2026-11-20T06:12:00Z</ActualStartTime>
          <ActualEndTime>2026-11-20T06:42:00Z</ActualEndTime>
          <EquipmentActual>
            <EquipmentID>MC01</EquipmentID>
VALIDATOR DEMO  (required fields per message type)
  broken copy of CELL-000009: missing DataArea.ProductionPerformance.ProductionResponse.SegmentResponse.ActualEndTime
  broken copy of CELL-000009: ApplicationArea.CreationDateTime '20.11.2026 06:44' is not UTC time YYYY-MM-DDThh:mm:ssZ
IDEMPOTENCY DEMO
  receive 9: CELL-000009 processed: confirmation of job J01 booked
  receive 10: CELL-000009 DUPLICATE - ignored (already processed), acknowledge again
```

## Item 5 in a real project

1. Write the PackML rule (states, modes, which commands per mode) and the tag-naming rule into the **URS**. Use
   `packml_sim.py --table` and `tag_namer.py --generate` as appendices, and ask every supplier to confirm them.
2. Check the suppliers' tag lists with `tag_namer.py --check-file` before the FAT. Fix the names at the source.
3. Size the local job buffer of the cell controller from the real MES outage history: use `arch_availability.py`
   (loss vs buffer) and `cell_controller_sim.py --mes-down` for the longest outage you must survive.
4. Decide on redundancy with `arch_availability.py`. Put your real MTBF / MTTR into a copy of the JSON.
5. Run `alarm_kpi.py` on the alarm log of the FAT and of the first production weeks. Fix the bad actors and the
   chattering tags first.
6. Use `isa95_msg.py` as a talking paper with the MES / ERP team. It shows which fields, IDs, sequence numbers and
   duplicate handling the interface specification must define.

---

# Item 6: communication

Six programs for the **communication** step:

- first numbers for the network design (PROFINET, EtherCAT, Modbus TCP, historian, latency, IO-Link, OPC UA, MQTT, fibre)
- the IP / VLAN plan of a cell, with PROFINET device names
- the Modbus TCP encoding of the standard module data block, with a **real Modbus TCP module simulator**
- the interface sheet of the data block on four protocols
- the handshake and heartbeat logic between the cell controller and a module
- the firewall and IEC 62443 risk check of the plant network

- Guide (textbook): [`docs/FMS system design/66_communication.md`](../../docs/FMS%20system%20design/66_communication.md)
- Web page: Digital twin → tab **FMS engineering** → item 6 (code `web/fmse6.js`, data `web/fmse6_data.js`).
  Deep link: `/?feitem=6#fmse`
- Shared example inputs + exact rules: `tools/fmse/examples/item6_examples.json` (keys `_formulas` and
  `handshake_sim._rules`)

**Everything in item 6 is deterministic.** The guide, the web page and these tools apply the same formulas to the same
inputs. So the numbers, the frames (hex bytes) and the handshake log must be **identical** in all three places. The kit
and data-block tables (`KITS`, `MODDEV`, `RANGES`, `ZONES`, `BLOCK`, `EXTRA`) are **read directly** from
`web/fmse6_data.js` with `read_js_const()`, and `UNIT` is read from `web/fmse6.js`. Nothing is copied by hand.

| Tool | What it does | Inputs |
|---|---|---|
| `net_calc.py` | The 4 web calculators (PROFINET load, EtherCAT cycle, Modbus TCP polling, historian volume, with the same verdict texts), plus latency (base / worst case), IO-Link per COM rate, OPC UA subscription load, MQTT broker load and fibre budget. Sub-commands take your own inputs | `net_calc` |
| `ip_plan.py` | Subnet calculator, overlap check of the address plan, duplicate-IP check, kit IP plan exactly like web 6D with PROFINET device names and a name check, CSV `Tag;Device;Module;IP;Subnet;Gateway;VLAN;PNName` | `subnet`, `ip_plan` + web tables |
| `modbus_codec.py` | Encodes / decodes the data block (INT, UINT, WORD, DINT, REAL, STRING[20]), word-order demo, the 6 example frames (request + response hex), decodes a response, status / command bit names. `--serve` runs a module simulator, `--poll` a client | `datablock` + web `BLOCK` / `EXTRA` |
| `datablock_map.py` | Interface sheet of one unit or a whole kit: word, 4xxxx, PDU, PROFINET %IB / %QB, OPC UA browse path + NodeId + type, Sparkplug metric + topic, item-5 tag (checked, ≤ 48). Markdown / CSV | `naming`, `ip_plan` + web tables |
| `handshake_sim.py` | Cell controller ⇄ module handshake + heartbeat per `handshake_sim._rules`: scenarios A–D, log, KPIs. `--exec`, `--events`, `--jobs` for your own scenarios | `handshake_sim` |
| `net_security.py` | Firewall check of the 17 flows (first match, default deny), rule audit, IEC 62443 risk table with residual risk, zone SL-T. Markdown / CSV | `security` |

All tools default to `--examples tools/fmse/examples/item6_examples.json`. They all have `--example` (the same as
the default run), `--json`, `--selftest` and `-h` with example commands. Bad input gives an `ERROR:` line and exit
code 2.

## 37. net_calc.py: network load and timing

The first four formulas are the web calculators (`CALC` in `web/fmse6.js`). The self-test checks that case 1 of each
calculator equals the web default (`PN0`, `EC0`, `MB0`, `HI0`) and that the verdict texts are the web texts.

```
python tools/fmse/net_calc.py                      (all JSON cases)
python tools/fmse/net_calc.py pn --dev 60 --io 250 --cyc 1
python tools/fmse/net_calc.py mb --dev 15 --regs 200 --conn 5 --json
python tools/fmse/net_calc.py latency --hops 4 --maxwire 1538
```

| Case | Result |
|---|---|
| PROFINET web default (30 dev, 32 B, 2 ms, 100 Mbit/s) | frame 64 B, wire 84 B, 10.08 Mbit/s, load 10.1 % → OK |
| PROFINET 60 dev × 250 B at 1 ms | frame 282 B, 144.96 Mbit/s, load 145 % → too high |
| EtherCAT web default (40 × 16 B) | 692 B, 55.4 µs on the wire + 24 µs = 79.4 µs, shortest cycle 99 µs → motion at 250 µs |
| EtherCAT 100 × 8 B | 852 B, 128.2 µs, shortest cycle 160 µs |
| Modbus web default (20 dev, 60 regs, 4 conn) | 1 request, 9 ms, poll cycle 45 ms, 22.2 /s, 12 / 129 bytes → handshakes OK |
| Modbus 1 connection | 180 ms, 5.6 /s → monitoring only |
| Modbus 15 dev × 200 regs, 5 conn | 2 requests, 54 ms, response 259 bytes |
| Historian web default | 3,000 values/s, 384 kbit/s, 1.24 GB/day, 908 GB → large |
| Historian everything at 100 ms | 30,000 values/s, 3,840 kbit/s, 41.47 GB/day, 30,275 GB |
| Latency, line of 10 switches | t_tx 6.72 µs, base 104.92 µs, worst case 1,335.32 µs (one 1538-byte frame ahead per hop) |
| IO-Link (2 B in, 1 B OD) | 76 bits: COM1 15.833 ms, COM2 1.979 ms, COM3 0.330 ms → 1.0 ms (device limit) |
| OPC UA 600 items @ 250 ms | 480 notifications/s + 30 publish/s = 18,900 B/s = 151.2 kbit/s |
| MQTT 20 edges × 50 metrics | 641 B per message, in 12,820 B/s, out 38,460 B/s, 410.24 kbit/s |
| Fibre OM3 300 m, 4 connectors | loss 4.25 dB, budget 7.5 dB, margin 3.25 dB → OK |

## 38. ip_plan.py: IP / VLAN plan and PROFINET names

```
python tools/fmse/ip_plan.py                                (subnets + checks + kit plan)
python tools/fmse/ip_plan.py --cidr 10.1.101.0/24 172.16.5.77/20
python tools/fmse/ip_plan.py --kit "FMC (1 HMC + rack)" --cell FMC2 --vlan 102 --csv ip_fmc2.csv
```

Real output (excerpt):

```
10.1.30.0/23       255.255.254.0    10.1.30.0       10.1.31.255     10.1.30.1       10.1.31.254        510
192.168.10.130/25  255.255.255.128  192.168.10.128  192.168.10.255  192.168.10.129  192.168.10.254     126  host bits set -> network is 192.168.10.128
  OVERLAP  10.1.101.0/24 and 10.1.101.128/25
  DUPLICATE  10.1.101.10: 'FMS1.POOL01 PLC' and 'FMS1.CC01 Cell controller'
KIT IP PLAN  kit 'FMS (3 HMCs + pool + AGV)', cell FMS1, VLAN 101 -> subnet 10.1.101.0/24, gateway 10.1.101.1
 1  FMS1.MC01     CNC              M01     10.1.101.150  fms1-mc01-cnc              OK
 2  FMS1.MC01     PLC (machine)    M01     10.1.101.10   fms1-mc01-plc-machine      OK
 3  FMS1.MC01     HMI              M01     10.1.101.100  fms1-mc01-hmi              OK
31  FMS1.NET01    Firewall         M22     10.1.101.241  fms1-net01-firewall        OK
  31 devices, 0 'range full!'
```

The PROFINET name check allows only `a-z 0-9 - .`. Each label must be ≤ 63 characters, the whole name ≤ 240, and the
name must not start with `port-`.

## 39. modbus_codec.py: Modbus TCP codec and module simulator

Encoding of this standard: 32-bit values **high word first ("ABCD")**, REAL = IEEE 754, STRING[20] = 10 registers
with the first character in the high byte. The example server is module MC02 with the M01 map of 25 registers. It
checks in this order: function supported (01) → quantity valid (03) → address inside the map (02) → write allowed (02).

```
python tools/fmse/modbus_codec.py                         (registers, word-order demo, 6 frames, decode)
python tools/fmse/modbus_codec.py --decode "00 01 00 00 00 2B 01 03 28 ..." --start 0
python tools/fmse/modbus_codec.py --module M04 --set LS.SerialFirst=SN-2026-0001
python tools/fmse/modbus_codec.py --serve                 (simulator on 127.0.0.1:1502, Ctrl+C stops)
python tools/fmse/modbus_codec.py --poll 127.0.0.1 1502 --count 10 --write-hb
```

Real output (excerpt):

```
  registers (dec): [6, 1, 0, 0, 98, 1, 0, 0, 0, 1412, 0, 23, 1, 4465, 0, 3, 17637, 20480, 4711, 4710, 0, 0, 0, 0, 0]
  Status.Bits 98 = 0x0062 = Busy + Auto + PartPresent
DINT   70001  CDAB          1171 0001  292,618,241        <- server sends CDAB, you decode ABCD
REAL  1834.5  CDAB          5000 44E5  8.607995e+09
1. Read standard block (words 0-19)
   request : 00 01 00 00 00 06 01 03 00 00 00 14
   response: 00 01 00 00 00 2B 01 03 28 00 06 00 01 00 00 00 00 00 62 00 01 00 00 00 00 00 00 05 84 00 00 00 17 00 01 11 71 00 00 00 03 44 E5 50 00 12 67 12 66
4. Too many registers (qty 200)
   response: 00 04 00 00 00 03 01 83 03
6. Write to a read-only word (StateCurrent)
   response: 00 06 00 00 00 03 01 86 02
```

**The simulator is a real Modbus TCP server** (standard library `socketserver`). Status.Heartbeat counts +1 every
second, only `in` / `in/out` words can be written, and several clients can connect at the same time. It binds to
`127.0.0.1` unless you give `--host`, for example `--host 0.0.0.0` to test a real PLC or SCADA on the plant network.
Port 8080 is refused, because it belongs to the digital-twin web server. The poller reads words 0–19 every second
with a 3 s time-out. It reports the heartbeat as lost when it has not changed for 3 s. The self-test starts the server
on an ephemeral port and tests FC03 / FC06 / FC16 and the exceptions over a real socket.

## 40. datablock_map.py: interface sheet of the data block

```
python tools/fmse/datablock_map.py                         (FMS kit: 16 units, 267 rows)
python tools/fmse/datablock_map.py --module M01 --unit MC02 --md mc02.md
python tools/fmse/datablock_map.py --full --csv interface_fms1.csv
```

The mappings are exactly those of web 6F (`drawMap`): holding register `4` + (base + word + 1), PROFINET `%IB` for the
module's outputs and `%QB` for its inputs, OPC UA `ns=2;s=<unit>.<name>`, Sparkplug
`spBv1.0/FMS1/DDATA|DCMD/CC1/<unit>`. The tag is the item-5 data-block tag (`PLT1.MACH.FMS1.<unit>.<group>.<item>`,
the same as `tag_namer.py --generate`) and is checked with the item-5 rule. Kit FMS: 16 units have a data block
(M20 SCADA and M22 network have none), 267 rows, longest tag 47 characters
(`PLT1.MACH.FMS1.AGVST01.Admin.ProdProcessedCount`), all ≤ 48.

## 41. handshake_sim.py: handshake and heartbeat

```
python tools/fmse/handshake_sim.py                         (KPIs of scenarios A-D)
python tools/fmse/handshake_sim.py --scenario B            (with the full log)
python tools/fmse/handshake_sim.py --scenario A --exec 30 --events 60:CC_FREEZE,75:CC_RESUME
```

Real output:

```
scen.  log lines  completed (job@tick)          final CC  HS t/o  JOB t/o  loss detection delay
A             27  70001@56 70002@113 70003@170  S0             0        0  -
B             32  70001@56 70002@173 70003@230  S0             0        0  CC COMM_LOSS 21 ticks = 2.1 s
C             32  70001@56 70002@176 70003@233  S0             1        0  -
D             31  70001@56 70002@152 70003@209  S0             0        0  MOD CC_LOSS 21 ticks = 2.1 s
```

One job takes 57 ticks: 4 handshake steps with a one-tick delay each, 50 ticks of execution, and 3 more ticks for
Done / Ack / release. The comm loss is detected 21 ticks (2.1 s) after the freeze, not 30, because the last heartbeat
change was seen 9 ticks before the freeze.

## 42. net_security.py: firewall and IEC 62443 risk

```
python tools/fmse/net_security.py                          (flows, audit, risk table, zone SL-T)
python tools/fmse/net_security.py --flow "Office PC,ent,Cell PLC,c1,s7"
python tools/fmse/net_security.py --md security.md --csv flows.csv --risk-csv risk.csv
```

Results of the example: 10 flows are allowed and 7 denied. 3 of the denials come from DEFAULT: office → cell PLC,
supplier laptop → robot, and office → MES directly. Audit findings: **R04** crosses zones (DMZ → cell directly) and
**R15** allows any service (the "allow all" left after commissioning). The risks are 20 / 12 / 16 / 15 / 15 / 8 / 9 /
12 / 6, and all residual risks are low. Zone SL-T: mfg 3, c1 3, saf 3, eng 2, dmz 1.

## Item 6 in a real project

1. Size the networks with `net_calc.py` before you order switches: cyclic load < 50 % per port, Modbus poll cycle
   ≤ 100 ms for handshakes, historian disk for the whole retention time, fibre margin ≥ 3 dB.
2. Make the IP plan with `ip_plan.py`. Give the CSV (with the PROFINET names) to every supplier before the FAT.
3. Put the `datablock_map.py` sheet of every module into its interface sheet, and have both suppliers sign it. Before
   the real machines arrive, test each module against `modbus_codec.py --poll` (the cell controller's view) and test
   the cell controller against `modbus_codec.py --serve` (a module).
4. Use `handshake_sim.py` to agree the time-outs and the reaction to a communication loss with the PLC programmers.
5. Run `net_security.py` on the real firewall rule list at every change, and close every audit finding.

---

# Item 7: electrical & safety

Seven programs for the **electrical and safety principles** step:

- the load list of the cell with the transformer size, the short-circuit current and motor starting currents
- cable sizing of a feeder (ampacity, PE, voltage drop, TN fault loop) and the 24 V line drop
- the 24 V control power budget with PSU and electronic circuit breaker (ECB) channels
- the heat balance of a control cabinet (IEC 60890 surface, filter fan or cooling unit)
- the performance level of safety functions (ISO 13849-1: PLr, MTTFd, DCavg, category, CCF, Table 11)
- the minimum safety distances (ISO 13855) and the guard-locking decision (ISO 14119)
- the safety-zone cause & effect matrix with scenarios, latching and reset

- Guide (textbook): `docs/FMS system design/67_electrical_safety.md`
- Web page: Digital twin → tab **FMS engineering** → item 7 (`web/fmse7*.js`). Deep link: `/?feitem=7#fmse`
- Shared example inputs + exact formulas: `tools/fmse/examples/item7_examples.json` (key `_formulas`)

**Everything in item 7 is deterministic.** The guide, the web page and these tools apply the same formulas to the same
inputs, so the numbers must be **identical** in all three places.

> **Important.** All values, and the tables marked "example table" (ampacity table, simplified PL table), are
> **examples for teaching**. Every tool prints this note. A real design needs sign-off by a qualified electrical /
> safety engineer with the current editions of IEC 60364, IEC 60204-1, IEC 60890 / IEC 61439, ISO 12100,
> ISO 13849-1/-2, ISO 13855, ISO 14119, ISO 13850 or IEC 62061, and the manufacturers' data.

| Tool | What it does | Inputs |
|---|---|---|
| `load_list.py` | Load list (P, Q, S, cos φ, current), growth reserve, size and loading of a dedicated transformer, Ik3 of the plant transformer, motor I_n / DOL / star-delta. Own list as CSV. Markdown / CSV | `load_list`, `motor` |
| `cable_size.py` | Required Iz with factors, table choice, PE rule, conditions Ib ≤ In ≤ Iz, 3-phase voltage drop, TN fault loop (Ik1, disconnection, L_max), 24 V two-wire drop and L_max. Sub-commands `feeder`, `dc24` | `cable`, `dc24.line` |
| `control_power.py` | 24 V load current, PSU choice, ECB channel currents and ratings. Own list as CSV. Markdown / CSV | `dc24` |
| `cabinet_thermal.py` | IEC 60890 surface (free-standing / wall), natural dissipation, filter fan flow or cooling unit per ambient temperature. Markdown / CSV | `cabinet` |
| `safety_pl.py` | Risk graph PLr, n_op / MTTFd / T10d per component, channel MTTFd, symmetrisation, cap 100, DCavg, PL per subsystem, Table 11, verdict; CCF cases. Sub-commands `risk`, `eval` (own components), `ccf`. Markdown / CSV | `safety` |
| `safety_distance.py` | ISO 13855 distances (light curtain, multi-beam, scanner, two-hand) and guard-locking decision. Sub-commands `aopd`, `multibeam`, `scanner`, `twohand`, `guard` | `safety.distance_cases`, `safety.guard_locking` |
| `safety_zones.py` | Cause & effect matrix, all scenarios (rows fired, action per output, outputs still RUN), own inputs (`--active`), latching + reset (`--sequence`). Markdown / CSV | `safety.zones` |

All tools default to `--examples tools/fmse/examples/item7_examples.json`. They all have `--example` (the same as
the default run), `--json`, `--selftest` and `-h` with example commands. Bad input gives an `ERROR:` line and exit
code 2.

## 43. load_list.py: load list, transformer, short-circuit and motor currents

```
python tools/fmse/load_list.py                              (load list + Ik3 + motor)
python tools/fmse/load_list.py --loads my_loads.csv --ks 0.7 --md loadlist.md --csv loadlist.csv
python tools/fmse/load_list.py ik3 --S 1000 --uk 0.06 --U 400
python tools/fmse/load_list.py motor --P 7.5 --eta 0.9 --cosphi 0.82 --kstart 7
```

Own CSV: `name;qty;P_kW;ku;cosphi` (header optional, `#` = comment).

| Result of the example | Value |
|---|---|
| P / Q (sum of the 9 loads) | 125.5 kW / 72.105 kvar |
| S = 0.8 × √(P² + Q²) | 115.791 kVA, cos φ 0.8671, I = 167.13 A at 400 V |
| S_req = S × 1.25 | 144.74 kVA → dedicated transformer **250 kVA**, loading 0.463 |
| Ik3 of the 1000 kVA plant transformer, uk 6 % | **24 056 A** (breakers Icu and panel SCCR ≥ 24.1 kA) |
| Motor 7.5 kW, η 0.9, cos φ 0.82 | I_n 14.668 A, DOL 102.68 A, star-delta 34.23 A |

## 44. cable_size.py: feeder sizing, voltage drop, fault loop, 24 V line

```
python tools/fmse/cable_size.py                             (JSON feeder + 24 V line)
python tools/fmse/cable_size.py feeder --Ib 40 --In 50 --L 80 --curve B
python tools/fmse/cable_size.py feeder --A 25               (check a chosen cross-section)
python tools/fmse/cable_size.py dc24 --L 25 --I 1.5 --A 0.75
```

Real output (feeder to MC02):

```
  required Iz = In/(k_temp*k_group) = 80/(0.87*0.77) = 119.42 A
  -> 35 mm2: table Iz 148 A, corrected 148*0.87*0.77 = 99.15 A
  Ib 65 <= In 80 <= Iz 99.15 -> OK
  PE conductor 16 mm2
  voltage drop dU = sqrt(3)*Ib*L*rho*cosphi/A = 3.691 V = 0.923 % (limit 5 %) -> OK
  fault loop: R_loop = 0.1229 ohm, Zs = 0.15 + R = 0.2729 ohm, Ik1 = 230/Zs = 842.7 A
  Ia = m*In = 10*80 = 800 A -> disconnection OK (Ik1 >= Ia)
  maximum length for disconnection L_max = 67.10 m
24 V LINE  valve terminal 15 m from the cabinet
  dU = 2*L*I*rho/A = 2*15*2*0.0178/1.5 = 0.712 V, U_load = 23.288 V (min 21.6 V) -> OK
  L_max = (U_psu - U_min)*A/(2*I*rho) = 50.56 m
```

25 mm² (119 A) misses the required 119.42 A by a hair, so 35 mm² is chosen. Longer than 67.10 m, the C80 breaker would
not trip fast enough: use a bigger cable, an RCD or a different curve.

## 45. control_power.py: 24 V budget, PSU, ECB channels

```
python tools/fmse/control_power.py                          (JSON example)
python tools/fmse/control_power.py --loads my_24v.csv --reserve 1.3 --md budget.md --csv channels.csv
```

Own CSV: `name;I_A;qty;sim;channel`. Example: I_load **5.74 A**, × 1.25 = 7.175 A → **PSU 10 A**. Channels:
ch1 2.3 A → 3 A, ch2 1.42 A → 2 A, ch3 0.52 A → 1 A, ch4 1.5 A → 2 A.

## 46. cabinet_thermal.py: cabinet heat balance

```
python tools/fmse/cabinet_thermal.py                        (JSON cabinet, Ta 25 / 35 / 40 °C)
python tools/fmse/cabinet_thermal.py --W 0.8 --H 2.0 --D 0.6 --mounting free --loss 450 --Ta 20,30,40
```

Stacker-crane cabinet against a wall: A = 1.4·1.2·(2.0 + 0.6) + 1.8·0.6·2.0 = **6.528 m²**, losses **805 W**, Ti 35 °C.

| Ta | P_nat | Q needed | Solution |
|---|---|---|---|
| 25 °C | 359.04 W | 445.96 W | filter fan **138.2 m³/h** |
| 35 °C | 0 W | 805 W | cooling unit **805 W** (no ΔT for a fan) |
| 40 °C | −179.52 W | 984.52 W | cooling unit **984.5 W** (heat flows in through the walls) |

## 47. safety_pl.py: ISO 13849-1 performance level

```
python tools/fmse/safety_pl.py                              (6 functions + CCF cases)
python tools/fmse/safety_pl.py --function SF1               (with every component: n_op, MTTFd, T10d)
python tools/fmse/safety_pl.py --ccf-score 40               (what happens without EMC evidence)
python tools/fmse/safety_pl.py risk --S S2 --F F1 --P P2
python tools/fmse/safety_pl.py eval --cat 3 --ch1 "Switch A,2000000,240,16,1800,99" --ch2 "Switch B,10000000,240,16,1800,90" --other e,d --risk S2F2P1
python tools/fmse/safety_pl.py ccf --measures 1,3,5,6,7
```

Real output (summary):

```
SF   risk    PLr  subsystem PLs  PL  verdict  safety function
SF1  S2F2P1  d    d e d          d   OK       Pallet-pool access door open -> stacker crane stops (guard locking)
SF2  S2F2P1  d    e e d          d   OK       Light curtain at the load station -> rotary table + fork stop
SF3  S2F1P2  d    d e d          d   OK       Emergency stop of the cell (stop category 1)
SF4  S1F2P1  b    d e c          c   OK       Scanner at the AGV dock -> transfer conveyor stops
SF5  S2F1P1  c    d e d          d   OK       Enabling device in maintenance mode -> stacker safely-limited speed
SF6  S2F2P1  d    c e c          c   NOT OK   Washer door open -> pumps + conveyor stop (FIRST DESIGN, single channel)
```

SF1 input: channel MTTFd 2604.17 / 13020.83 years, symmetrised 8969.91 → capped 100 (high), DCavg 97.5 % (medium) →
Cat 3 column `3|medium` → PL d. SF6 is the "first design" on purpose: single channel, Cat 1 → PL c < PLr d. The fix
is a second channel with diagnostics (Cat 3). CCF: the typical design scores 65 (OK); without EMC test evidence it
scores 40, and then every Cat 2–4 subsystem is not allowed (`--ccf-score 40`).

## 48. safety_distance.py: ISO 13855 distances, guard locking

```
python tools/fmse/safety_distance.py                        (6 cases + guard locking)
python tools/fmse/safety_distance.py aopd --d 30 --times 0.015,0.02,0.2
python tools/fmse/safety_distance.py scanner --H 200 --Z 120 --T 0.45
python tools/fmse/safety_distance.py guard --tstop 2.5 --dist 1200
```

| Case | T | S |
|---|---|---|
| LC1 light curtain 14 mm | 0.185 s | 370 mm |
| LC2 light curtain 30 mm | 0.185 s | 498 mm |
| LC3 30 mm, slower stop | 0.300 s | 728 > 500 → 1600·T + 128 = **608 mm** |
| MB1 4-beam body detection | 0.185 s | 1146 mm |
| SC1 scanner, H 300 mm, Z 100 mm | 0.500 s | C 1080 → 1980 mm |
| TH1 two-hand control | 0.120 s | 442 mm |

Guard locking (t_access = 800/1600 = 0.5 s): HMC spindle 8 s → **required**, stacker crane 1.2 s → **required**,
washer pump 0.3 s → not required.

## 49. safety_zones.py: cause & effect matrix

```
python tools/fmse/safety_zones.py                           (matrix + 6 scenarios)
python tools/fmse/safety_zones.py --active LS01_LC,AGV_DOCK_FIELD
python tools/fmse/safety_zones.py --sequence "ESTOP_CELL | | RESET | POOL_DOOR_OPEN"
```

| Scenario | Rows fired | Outputs still RUN (of 12) |
|---|---|---|
| Normal automatic | – | 12 |
| Operator reaches into the load station | Z2 | 10 |
| Pool door opened in automatic | Z3 | 6 |
| Maintenance in the pool with enabling device | Z4 | 6 |
| Maintenance + person at the AGV dock | Z4 + Z5 | 5 |
| E-stop during maintenance | Z1 + Z4 | 1 |

In the e-stop scenario LS01_CLAMP stays RUN (action `-`: the clamp keeps the pallet clamped) and MC01–MC03 get STO.
`--sequence` shows the latching: Z1 stays active after the e-stop is released until a RESET with the input cleared.

## Item 7 in a real project

1. Start the load list (`load_list.py`) with the machine makers' data sheets. Ask the plant electrician for the real
   Ik3 at the connection point (with cable impedance) and order breakers and panels with Icu / SCCR above it.
2. Size every feeder with `cable_size.py` using the factors of the real installation. Check L_max of the fault loop
   for the longest cable, and the 24 V drop for remote valve terminals and IO-Link masters.
3. Make the 24 V budget (`control_power.py`) per cabinet. Keep 25 % reserve and split the channels so a short circuit
   in the field does not stop the PLC.
4. Run `cabinet_thermal.py` with the hottest summer ambient of the hall. Above about Ti − 5 °C a fan is no longer
   enough.
5. For each safety function from the risk assessment, check the PL with `safety_pl.py`, then verify it with SISTEMA
   (or similar) and the real B10d / MTTFd values. Measure the stopping times and recalculate `safety_distance.py`.
6. Agree the cause & effect matrix (`safety_zones.py`) with production. The KPI "outputs still RUN" shows how much of
   the cell keeps working during a safety stop.

---

# Item 8: module library: complete circuits per module

Four programs (plus one shared core) for the **module circuit library** step. The library is a set of standard
circuit patterns (DOL starter, inverter with STO, guard door with guard locking, e-stop, light curtain, valve, sensor,
signal tower, ...) and every module M01–M22 as a list of pattern instances. All lists are derived from it:

- the IO list with tags and addresses, IO cards with spare channels, devices with IEC 81346 designations, cables
  (WD numbers), the terminal plan -XD2 and the bill of materials (BOM)
- the motors (rated current, contactor or inverter size), the demand load list, the installed current, the module
  feeder (breaker + cable), 24 V current + PSU, cabinet losses, and the distribution-board schedule of a kit
- SVG schematic sheets: one per pattern, one overview per module
- rule checks over the whole library and a kit

- Guide (textbook): `docs/FMS system design/68_module_circuits.md`
- Web page: Digital twin → tab **FMS engineering** → item 8 (`web/fmse8*.js`)
- Shared library + exact rules: `tools/fmse/examples/item8_examples.json` (key `_rules`)
- One implementation of the rules: `tools/fmse/circuit_lib_core.py` (not a CLI; used by all four tools)

**Everything in item 8 is deterministic.** The guide, the web page and these tools apply the same rules to the same
library, so the numbers must be **identical** in all three places.

> **Revision 2026-11-15 (gap fix).** Two gaps found in the guide-68 review are closed in the library and the tools:
> (1) **power cables are now sized per instance** (rule `_rules.power_cable`, key `pcab` on the patterns DOL, VFD_STO,
> HEATER, FEEDER_EXT): before, every motor cable had a fixed text (the 18 kW heater had 4G2.5, the 15 kW hydraulic
> pump 4G1.5). Now Ib → Ip → A gives e.g. heater 25.98 A → 32 A → **4G6**, HydPump 30.0 A → **4G6**, WeldPwr
> **4G10**, M01 supply **4G35**. (2) **M18 SAFE01 has safety outputs**: new pattern **ZONE_OUT** (1 F-DO zone release +
> 1 F-DI EDM feedback), 4 instances Zone1..Zone4 after SafetyCpu (rule `_rules.zone_out`). New results: M18 io 20,
> terminals 22, cables 10 = 123 m, devices 10, 24 V 1.82 A, losses 37.2 W; library kit io 210 (DI 90, DO 45, AI 9,
> FDI 49, FDO 17), cards 57 (FDI 12, FDO 9), terminals 342, cables 137 = 1333 m, devices 163, losses 1258.6 W
> (P 115.213 kW, S 132.682 kVA, PSU 57.5 A unchanged). New checks R9 (power cable size) and R10 (safety inputs need
> safety outputs); 54 SVG sheets.

> **Important.** All circuits, sizes and tables are **examples for teaching** (IO card sizes like ET 200SP, example
> ampacity table, motor kW used as electrical kW in the load list). Every tool prints this note. Real circuits are
> made in an E-CAD system and signed off by qualified electrical / safety engineers to IEC 60204-1 (with IEC 60364,
> IEC 61439, IEC 81346, ISO 13849) in the current editions, with the manufacturers' data. The SVG sheets are
> **not for construction**.

| Tool | What it does | Inputs |
|---|---|---|
| `circuit_library.py` | Expands a module (`--module`), the library kit (`--kit`) or an own kit (`--modules`): IO list (tag, type, address, description, group), IO cards + spare, devices with designations, cables, terminal plan -XD2, BOM; `--list` shows modules + patterns. Markdown; `--out DIR` writes `io_list.csv`, `devices.csv`, `cables.csv`, `terminals.csv`, `bom.csv` and (modules with power circuits) `power_cables.csv`; console / Markdown also show the **power cable sizing** table (Ib, Ip, Iz req, A, cores) and the metres per cable type (kit: one folder per module instance + `kit_bom.csv` + `kit_cable_types.csv`) | `patterns`, `modules`, `kit` |
| `module_power.py` | Per module: motors (In, contactor AC-3 / MPCB setting or inverter size), demand load list (P, Q, S, I), installed current, feeder breaker + cable, **power cable sizing per instance** (`--cables`: Ib → Ip → A → cores), 24 V current + PSU, losses. Distribution-board schedule of a kit (one feeder per module instance). Markdown / CSV | `constants`, `modules`, `kit` |
| `circuit_svg.py` | SVG sheets (A3 landscape frame, title block with project, sheet, designation, revision, sheet number; IEC 60617-like symbols from lines / rectangles / circles): `--pattern DOL`, `--module M03`, `--all` (54 sheets = 32 patterns incl. ZONE_OUT + 22 modules, + `index.html`); cable labels show the sized power cable text with Ib / Ip to `--out DIR` | library |
| `library_check.py` | Rules R1–R10: tags ≤ 48 characters and unique (module and kit), designations unique, IO spare ≥ 20 %, safety signals only on F-DI / F-DO, two-channel inputs in pairs, PSU reserve ≥ 25 %, feeder In ≥ I_inst and Iz·k ≥ In, a feeder for every module with motors, R9 power cable cross-section ≥ calculated A, R10 a kit with F-DI must have F-DO (a module with F-DI but no F-DO = warning). Exit code 1 if there are findings (warnings do not count). CSV | library, kit |

All tools default to `--examples tools/fmse/examples/item8_examples.json`. They all have `--example` (the same as the
default run), `--json`, `--selftest` and `-h` with example commands. Bad input (unknown module or pattern, broken JSON)
gives an `ERROR:` line and exit code 2.

The rules in short (the full text is in `_rules`):

```
tag          PLT1.MACH.FMS1.<unit>.<group>.<signal>          unit = UNIT code + 01 (kit: 01, 02 ... per module code)
designation  =FMS1.<unit>-<class><n>  (n counts per class code in the module)   cables WD1, WD2 ...
cards        cards = ceil(used*1.2/channels)  (DI 16, DO 16, AI 4, AO 2, FDI 8, FDO 4) ; spare = cards*ch - used
address      k-th entry of a type -> TYPE<k//ch + 1>.<k%ch>   e.g. DI1.00, FDI2.07
terminals    -XD2 1..n = io entries + 'tx' supply terminals (+24V / 0V), io first per instance
motor        In = kW*1000/(sqrt(3)*400*eta*cos)  eta 0.88, cos 0.82 ; DOL contactor = smallest AC-3 >= In ;
             VFD size = smallest vfd_kw >= kW ; VFD loss 3 % of kW
demand       P = sum kW*ku ; Q = sum P_i*tan(acos cos_i) ; S = sqrt(P^2+Q^2) ; I = S*1000/(sqrt(3)*400)
             ku: feeder from params, motors 0.7, heater 0.8, control power PSU*24/0.9/1000 kW with 0.6
feeder       installed (ku = 1) I_inst ; breaker In = smallest rating >= I_inst ;
             cable = smallest size with Iz_table >= In/(0.87*0.77) ; no load -> no feeder
24 V         i24 = sum pattern i24 + IO station (0.3 + 0.05*cards) ; PSU = smallest size >= 1.25*i24
losses       patterns + IO station (4 + 1*cards W) + PSU*24*(1/0.92 - 1)
kit          sums over the module instances (P, S, I, loss = sums of the module values as printed)
power cable  (2026-11-15) per DOL / VFD_STO / HEATER / FEEDER_EXT instance:
             Ib = motor In (DOL, VFD) or kW*1000/(sqrt(3)*400*cos) (HEATER, FEEDER_EXT, ku ignored)
             Ip = Ib round 2 (MPCB / inverter overload setting) or smallest breaker >= Ib (HEATER, FEEDER_EXT)
             A  = smallest size with Iz_table >= Ip/(0.87*0.77) ; cores = prefix + A + suffix (4G6, 4G4 + shield)
zone out     (2026-11-15) ZONE_OUT = Release (F-DO, 2-channel PM) + Fb (F-DI, EDM) ; M18 has Zone1..Zone4
```

## 50. circuit_library.py: IO list, designations, cables, terminals, BOM

```
python tools/fmse/circuit_library.py --list
python tools/fmse/circuit_library.py --module M03               (= default: pallet pool + stacker crane)
python tools/fmse/circuit_library.py --module M03 --md M03.md --out M03_lists
python tools/fmse/circuit_library.py --kit                      (library kit, 18 module instances)
python tools/fmse/circuit_library.py --modules M01,M01,M04 --out my_kit
```

Real output (M03, start of the IO list):

```
MODULE M03  =FMS1.POOL01  Pallet pool + stacker crane
  io entries 31 (DI 11, DO 4, FDI 11, FDO 5), IO cards 6
  devices 22, cables 16 = 149 m, terminals -XD2 42, longest tag 37 characters (max 48)
address  tag                                    type  description
FDO1.00  PLT1.MACH.FMS1.POOL01.DriveSup.Enable  FDO   coils K1 + K2
FDI1.00  PLT1.MACH.FMS1.POOL01.DriveSup.EDM     FDI   feedback: NC mirror contacts K1 + K2 in series
FDO1.01  PLT1.MACH.FMS1.POOL01.Travel.STO       FDO   safe torque off (2-channel F-DO)
DI1.00   PLT1.MACH.FMS1.POOL01.Travel.Ready     DI    inverter ready
...
FDI2.00  PLT1.MACH.FMS1.POOL01.Enable.Ok2       FDI   enabling middle position, channel 2
```

`Enable.Ok2` is the 9th F-DI entry, so it goes to F-DI card 2, channel 0.

| Result | M03 | Library kit (18 instances) |
|---|---|---|
| io entries | 31 (DI 11, DO 4, FDI 11, FDO 5) | 210 (DI 90, DO 45, AI 9, FDI 49, FDO 17) |
| IO cards | DI 1, DO 1, FDI 2, FDO 2 | 57: DI 17, DO 11, AI 8, FDI 12, FDO 9 |
| terminals -XD2 | 42 | 342 |
| cables | 16 = 149 m (motor cables 4G4 / 4G2.5 / 4G1.5 + shield) | 137 = 1333 m |
| devices | 22 (QA1–QA2, FC1–FC3, TA1–TA3, MA1–MA3, BG1–BG5, SF1–SF4, KF1, PF1) | 163 |

Power cable sizing of M03 (printed after the cable list; also in `power_cables.csv`):

```
cable  group   pattern  kW   Ib A   Ip A  Ip from                    Iz req A  A mm2  Iz*k A  cores
WD1    Travel  VFD_STO  11   22.00  22    inverter overload setting     32.84      4   26.80  4G4 + shield
WD3    Hoist   VFD_STO  7.5  15.00  15    inverter overload setting     22.39    2.5   20.10  4G2.5 + shield
WD5    Fork    VFD_STO  1.5   3.00   3    inverter overload setting      4.48    1.5   14.74  4G1.5 + shield
```

Kit metres per cable type (`kit_cable_types.csv`): 4G35 45 m, 4G6 10 m, 4G4 + shield 15 m, 4G2.5 15 m,
4G2.5 + shield 15 m, 4G1.5 105 m, 4G1.5 + shield 45 m, 4x0.75 165 m (incl. the 4 zone cables of M18), ...

## 51. module_power.py: motors, feeder, 24 V, losses, distribution board

```
python tools/fmse/module_power.py                               (all modules + library kit board)
python tools/fmse/module_power.py --module M10                  (one module in detail)
python tools/fmse/module_power.py --kit --md board.md --csv board.csv
python tools/fmse/module_power.py --modules M01,M01,M03,M10
```

| Module | Motors | Demand P / S / I | I_inst → breaker, cable | 24 V → PSU | Losses |
|---|---|---|---|---|---|
| M01 MC01 | – (feeder to the machine 38 kW) | 22.84 kW / 26.864 kVA / 38.78 A | 64.63 A → **80 A, 35 mm²** | 0.58 A → 2.5 A | 19.2 W |
| M03 POOL01 | VFD 11 / 7.5 / 1.5 kW (In 22.003 / 15.002 / 3.0 A) | 14.08 kW / 17.154 kVA / 24.76 A | 35.40 A → **40 A, 10 mm²** | 3.02 A → 5 A | 631.4 W |
| M10 WASH01 | DOL 7.5 kW (15.002 A → 18 A, cable 4G2.5), 3 kW (9 A), 0.37 kW (9 A); heater 18 kW 25.98 A → 32 A → 4G6 | 22.049 kW / 22.683 kVA / 32.74 A | 43.19 A → **50 A, 16 mm²** | 1.165 A → 2.5 A | 38.7 W |
| M16 PRESS01 | DOL 15 kW (30.004 A → 32 A, cable 4G6) | 10.58 kW / 12.886 kVA / 18.6 A | 26.60 A → **32 A, 6 mm²** | 2.075 A → 5 A | 43.9 W |
| M21 MESCON01 | – (no field circuits) | 0 | no feeder | 0 | 0 |

Distribution-board schedule of the library kit (one feeder per module instance; the designation is the next free FC
number of the module):

```
no  designation        module  unit     P_inst kW  I_inst A  I demand A  breaker In A  cable mm2  Iz corr A
1   =FMS1.MC01-FC2     M01     MC01        38.067     64.63       38.78            80         35      99.15
2   =FMS1.MC02-FC2     M01     MC02        38.067     64.63       38.78            80         35      99.15
3   =FMS1.MC03-FC2     M01     MC03        38.067     64.63       38.78            80         35      99.15
4   =FMS1.APC01-FC1    M02     APC01        0.067      0.10        0.06             6        1.5      14.74
5   =FMS1.APC02-FC1    M02     APC02        0.067      0.10        0.06             6        1.5      14.74
6   =FMS1.APC03-FC1    M02     APC03        0.067      0.10        0.06             6        1.5      14.74
7   =FMS1.POOL01-FC4   M03     POOL01      20.133     35.40       24.76            40         10      46.89
8   =FMS1.LS01-FC2     M04     LS01         0.883      1.52        1.04             6        1.5      14.74
9   =FMS1.LS02-FC2     M04     LS02         0.883      1.52        1.04             6        1.5      14.74
10  =FMS1.AGVST01-FC2  M06     AGVST01      0.437      0.75        0.51             6        1.5      14.74
11  =FMS1.WASH01-FC5   M10     WASH01      28.937     43.19       32.74            50         16      62.97
12  =FMS1.CMM01-FC2    M11     CMM01        6.067      9.72        5.83            10        1.5      14.74
13  =FMS1.MARK01-FC3   M12     MARK01       1.817      2.91        1.88             6        1.5      14.74
14  =FMS1.UTIL01-FC2   M17     UTIL01       5.567      9.78        6.84            10        1.5      14.74
15  =FMS1.SAFE01-FC1   M18     SAFE01       0.067      0.10        0.06             6        1.5      14.74
16  =FMS1.CC01-FC1     M19     CC01         0.133      0.20        0.12             6        1.5      14.74
17  =FMS1.SCADA01-FC1  M20     SCADA01      0.133      0.20        0.12             6        1.5      14.74
18  =FMS1.NET01-FC1    M22     NET01        0.067      0.10        0.06             6        1.5      14.74
  kit demand P = 115.213 kW, S = 132.682 kVA (arithmetic sum of the module S, ks = 1), sum I = 191.52 A
  kit PSU sum = 57.5 A, 24 V current sum = 29.415 A, cabinet losses = 1258.6 W
```

`--cables` prints the power cable sizing of every module (29 instances), e.g.:

```
module  cable  group    pattern     kW  Ib A   Ip A  Ip from       Iz req A  A mm2  Iz*k A  cores
M01     WD1    Supply   FEEDER_EXT  38  64.53    80  breaker         119.42     35   99.15  4G35
M10     WD3    Heater   HEATER      18  25.98    32  breaker          47.77      6   34.16  4G6
M15     WD2    WeldPwr  FEEDER_EXT  20  32.08    40  breaker          59.71     10   46.89  4G10
M16     WD1    HydPump  DOL         15  30.00    30  MPCB setting     44.78      6   34.16  4G6
```

The kit S is the arithmetic sum of the module S (safe side, ks = 1). The cell load list of item 7 (`load_list.py`)
applies a simultaneity factor on top.

## 52. circuit_svg.py: SVG schematic sheets

```
python tools/fmse/circuit_svg.py --module M03 --out sheets      (= default: module overview M03)
python tools/fmse/circuit_svg.py --pattern DOL --out sheets
python tools/fmse/circuit_svg.py --all --out sheets             (32 pattern sheets + 22 module sheets + index.html)
python tools/fmse/circuit_svg.py --list
```

- **Pattern sheet** (`pattern_<NAME>.svg`): one instance in the example unit `=FMS1.XX01` (power patterns with an
  example 4 kW / 10 kW): control cabinet with the power chain (L1 L2 L3 PE → FC → QA / TA), the IO channels with
  addresses, the terminal strip -XD2 with +24V / 0V supply terminals, the cables WDn and the field devices.
- **Module sheet** (`module_<CODE>.svg`): cabinet (feeder from the main board, IO station, every card with used /
  spare channels, 24 V PSU, cabinet devices), field devices with full designations and their cables per instance
  (power cables with the sized cores text and Ib / Ip, e.g. M10 `WD3 4G6 10 m (Ib 26.0 A, Ip 32 A)`), IO list with
  address and tag. Pattern sheets of power patterns print the sizing line `power cable WD1: Ib -> Ip -> A -> cores`.
- **ZONE_OUT** (new 2026-11-15): zone interface terminal block XD1 in the cabinet, FDO1.00 Release + FDI1.00 Fb,
  cable WD1 4x0.75 to the zone; the M18 sheet shows Zone1..Zone4 and the FDO card (used 4, spare 0).
- Symbols (simplified IEC 60617 style): breaker, contactor, motor M 3~, converter ~/~ and ~/=, heater, proximity
  sensor, push-button / e-stop, solenoid coil, lamp, transmitter P / T, device box.
- Plain SVG text, no fonts or scripts to load: opens in any browser on an offline PC; print on A3.

## 53. library_check.py: rule checks

```
python tools/fmse/library_check.py                              (all 22 modules + the library kit)
python tools/fmse/library_check.py --modules M01,M01,M04 --csv findings.csv
```

Real output:

```
LIBRARY CHECK  32 patterns, 22 modules (328 tags), kit 'FMS (3 HMCs + pool + AGV)' with 18 module instances (210 tags)
  longest tag 41 characters (max 48), smallest IO spare 23 % (min 20 %), smallest PSU reserve 35 % (min 25 %)
No findings: every rule R1-R10 is met.

6 warning(s) (R10, review - not an error):
R10 sfout  M06 AGVST01  WARNING: 2 F-DI safety input(s) but no F-DO in the module - the safety function output must be in another module (M18 zone outputs); ...
(also M07, M10, M12, M13, M14)
```

R9 compares the cross-section in the cores text of each power cable (`4G6` → 6 mm²) with the A of the rule
power_cable. R10: a whole kit with F-DI and no F-DO is an error (nothing could switch the hazard off); a single
module with F-DI but no F-DO is a warning, because its e-stop / door may act through the zone outputs of M18 -
confirm it in the item-7 zone matrix. Before the 2026-11-15 revision M18 itself had 6 F-DI and no F-DO.

The self-test breaks copies of the library on purpose and checks that each rule finds the fault: a 50-character tag,
a duplicate group, two module types with the same unit code in a kit (20 duplicate tags), reserve 0 (M13: 8 F-DI on
one 8-channel card → spare 0), e-stop on a standard DI, STO on a standard DO, a light curtain without OSSD 2, an
F-DI "Ch2" without a first channel, only 2.5 A PSUs (M03 needs 3.775 A), breakers only up to 40 A (MC01 needs
64.63 A), cables only up to 4 mm², a motor module without a load, a duplicated device designation, and (new
2026-11-15) HEATER without `pcab` (M10 heater keeps 4G2.5 < 6 mm² → R9), DOL without `pcab` (M10 spray pump and M16
hydraulic pump on 4G1.5 → R9), the old M18 without ZONE_OUT as a kit (6 F-DI, no F-DO → R10) and a kit M06,M07
(e-stops only → exactly one R10 finding).

## Item 8 in a real project

1. Agree the pattern library with the electrical designer and the safety engineer first (one pattern = one approved
   standard circuit with its E-CAD macro). Put the project's IO card sizes, contactor / inverter / breaker ranges
   and the ampacity table of the real installation method into `constants`.
2. Describe every module as a list of pattern instances and expand it with `circuit_library.py`. Hand the IO list
   CSV to the PLC programmer (tags = data-block names of item 5/6) and the cable list to the installer.
3. Size the feeders with `module_power.py`, then check the long feeders with `cable_size.py` (voltage drop, fault
   loop) and the cabinet heat with `cabinet_thermal.py` (losses from this tool).
4. Run `library_check.py` after every change of the library or the kit. A finding is a design error, not a warning.
5. Use the SVG sheets for design reviews only. The construction drawings come from the E-CAD system, checked and
   signed by the responsible engineer.

# Item 9: PLC programming principles

Seven programs for the **PLC programming** step: how fast a PLC reacts, whether its tasks fit, the standard and device
function blocks, the module sequence inside the PackML state machine, alarms to ISA-18.2, Structured Text generated
from the item-8 circuit library, and the effort for the software quote.

- Guide (textbook): `docs/FMS system design/69_plc_programming.md`
- Web page: Digital twin → tab **FMS engineering** → item 9 (`web/fmse9*.js`)
- Shared examples + exact rules: `tools/fmse/examples/item9_examples.json` (key `_rules`: response, tasks, overflow,
  fb_trace, analog, limits, motor, module_run, alarms, codegen, effort)
- Code generation and effort read the item-8 library `examples/item8_examples.json` **through `circuit_lib_core.py`**
  (module expansion, IO list, card addresses, card counts). There is no second copy of the item-8 rules. The PackML
  tables (STATES, CMDS, EDGES, MODES) come from `packml_sim.py` (= `web/fmse5_data.js`).

**Everything in item 9 is deterministic.** The guide, the web page and these tools apply the same rules, so every
number, every log line and the generated ST text (same Adler-32 checksum) must be **identical** in all three places.

> **Important.** All values are **examples for teaching**. Safety functions are programmed only in the safety
> (F-) program by qualified people. The standard program only reads safety signals (the generated code has no
> assignment to an F-output). The generated ST is a skeleton for the FB library of your PLC platform. Check the
> analog scaling (27648 = Siemens style), the first-scan behaviour of F_TRIG and the timer resolution on your system.

| Tool | What it does | Rule |
|---|---|---|
| `plc_timing.py` | `--response` reaction time DI → DO (t_min, t_max, travel during t_max); `--tasks` utilisation, Liu-Layland bound and response-time analysis with the iteration list R0, R1, ...; `--overflow` time until a counter / timer overflows. Own values by CLI | response, tasks, overflow |
| `iec_std_fb.py` | Classes TON, TOF, TP, R_TRIG, F_TRIG, CTU, CTD, SR, RS; `--trace` = the 40-scan table + events, `--diagram` ASCII timing diagram; own PT / PV / signal ranges | fb_trace |
| `device_fb.py` | `FB_AnalogIn` (4–20 mA scaling + NAMUR NE 43 status + substitute value), `FB_LimitAlarm` (H / L, hysteresis, on-delay), `FB_MotorDol` + plant model; `--analog`, `--limits`, `--motor A..E|ALL` (log), `--trace` per tick | analog, limits, motor |
| `module_sequence.py` | APC01 (M02) sequence S10 unclamp → S20 rotate → S30 clamp + pressure inside PackML, commanded over the data block (CntrlCmd, CmdChangeRequest), plant model; `--scenario A..E --log`, `--trace`, own `--events`; summary: final state, StateCurrent, AlarmNo, count, Bits, plant, log lines | module_run |
| `alarm_isa182.py` | ISA-18.2 state machine (NORM, UNACK, ACKED, RTNUN, SHLVD, OOS), annunciation, first-out per group, chattering, standing alarms; `--log`, own `--events` | alarms |
| `st_codegen.py` | Structured Text from the item-8 library: `VAR_GLOBAL` with `%IX/%QX/%IW/%QW` addresses + `FB_<unit>_Devices`; `--module M02 [--out file.st]`, `--all` (FB instances, lines, characters, Adler-32 per module), `--kit` (95 FB instances), `--out-dir` | codegen |
| `plc_effort.py` | Effort for the PLC software quote: eng = Σ qty × h, + test, documentation, PM, contingency; `--kit` computes io_std 144, io_safe 66 (item-8 kit) and fb_instances 95 (codegen) itself; own `--qty`, `--factor` | effort |

All tools default to `--examples tools/fmse/examples/item9_examples.json` and have `--example` (the same as the default
run), `--json`, `--selftest` and `-h` with example commands. Most have `--md` (Markdown report) and some `--csv`. Bad
input gives an `ERROR:` line and exit code 2.

The rules in short (the full text is in `_rules`):

```
response   t_min = t_in + T_scan + t_out ; t_max = t_in + 2*T_bus + 2*T_scan + t_out ; travel = v*t_max/1000 mm
tasks      integer us ; U = sum C/T ; bound n*(2^(1/n) - 1) (sufficient only) ; RTA R0 = C_i,
           R_k+1 = C_i + sum_higher ceil(R_k/T_j)*C_j until equal (OK) or > T_i (MISS)
overflow   time = max / increments per s ; TIME 2147483647 ms = 24 d 20 h 31 min 23.647 s
fb_trace   dt 10 ms, 40 scans, PT 50 ms, PV 3 ; TON/TOF/TP IN = A, CTU (A, RST), CTD (A, LD), SR/RS (A, B)
analog     mA = 4 + 16*raw/27648 ; NE 43: <= 3.6 BAD, < 3.8 UNCERTAIN, <= 20.5 GOOD, < 21 UNCERTAIN, else BAD ;
           value clamped (GOOD / UNCERTAIN) or substitute lo (BAD)
limits     ON after 'delay' consecutive samples >= H (<= L) ; OFF at once below H - hyst (above L + hyst)
motor      tick 100 ms, T_fb 500 ms ; plant: contactor from Run of the last tick, RunFb after 2 ticks ;
           alarms 1 no feedback, 2 feedback lost, 3 trip, 4 feedback without command ; no automatic restart
module_run tick 100 ms ; events -> plant -> PLC (command, state action, entry actions, outputs, data block) ;
           durations Resetting 5, Starting 2, Completing 2, Stopping 2, Aborting 1, Clearing 2, Holding/Unholding 1 ;
           S10 30, S20 50, S30 30 ticks time-out -> alarm 11 / 12 / 13 + internal Abort ; Bits Ready 1, Busy 2,
           Done 4, Fault 8, Auto 32, PartPresent 64
alarms     ISA-18.2 transitions ; annunciation = INTO UNACK ; first-out per group, re-armed when all NORM ;
           chattering 3 acts within 60 s ; standing = UNACK or ACKED at the end
codegen    symbol <unit>_<group>_<signal> ; DI k -> %IX(2*(k//16) + (k%16)//8).(k%8) ; AI k -> %IW(2*cards_DI +
           8*(k//4) + 2*(k%4)) ; DO / AO the same with %QX / %QW (cards_DO) ; FDI / FDO no address ;
           checksum Adler-32 of the UTF-8 text
effort     eng = sum qty*coef ; test 0.4, doc 0.15 x eng ; pm 0.1 x (eng+test+doc) ; contingency 0.15 x subtotal
```

## 54. plc_timing.py: reaction time, tasks, overflow

```
python tools/fmse/plc_timing.py                                (all three parts)
python tools/fmse/plc_timing.py --tasks
python tools/fmse/plc_timing.py --tasks --task Fast:2000:300:1 --task Main:10000:3500:2
python tools/fmse/plc_timing.py --response --t-in 3 --t-bus 2 --t-scan 10 --t-out 0.5 --v 500
python tools/fmse/plc_timing.py --overflow --max 32767 --rate 0.5
```

Real output (task set "Typical"):

```
TASK SET Typical:  U = 0.6600, Liu-Layland bound = 0.7568 -> schedulable by the bound test ; RTA: all deadlines met
task         prio     T us   C us    R us    R/T  result  iterations R0, R1, ...
Fast_Motion     1     2000    300     300  0.150  OK      300, 300
Main            2    10000   3500    4400  0.440  OK      3500, 4100, 4400, 4400
Comm            3   100000  12000   26700  0.267  OK      12000, 20800, 25800, 26400, 26700, 26700
Diag            4  1000000  40000  129000  0.129  OK      40000, 72000, 90800, 100800, 117800, 123700, 128100, 129000, 129000
```

| Case | Result |
|---|---|
| Reaction time: local IO, 10 ms task / PROFINET 2 ms / fast task 2 ms / over the cell controller (Modbus 100 ms) | t_max 23.5 / 27.5 / 6.2 / **223.5 ms**; travel at 500 mm/s 11.8 / 13.8 / 3.1 / 111.8 mm |
| Task set Tight | U 0.91 > bound 0.7568, but the RTA passes (Main R 7200, Diag R 357700 µs) |
| Task set Overloaded | U 1.14: Comm R 100900 > 100000 µs and Diag 1020900 µs → **MISS** |
| Overflow | TIME 24.86 d, INT counter at 1 part / 2 min 45.51 d, UINT heartbeat at 10/s 0.08 d (6553.5 s), UDINT 13.62 years, DINT seconds 68.1 years |

## 55. iec_std_fb.py: IEC 61131-3 standard function blocks

```
python tools/fmse/iec_std_fb.py --trace --diagram
python tools/fmse/iec_std_fb.py --pt 30 --pv 2 --a 2-8,11-12 --b 6-7 --rst 33 --ld 0,36
python tools/fmse/iec_std_fb.py --csv trace.csv --md trace.md
```

Real output (part of the ASCII timing diagram, '#' = TRUE):

```
 scan k  0         1         2         3
         0123456789012345678901234567890123456789
      A  __#######__##__###############__________
      B  ______##____________###_________##______
  TON_Q  _______##___________##########__________
  TOF_Q  __#################################_____
   TP_Q  __#####____#####________________________
  RTRIG  __#________#___#________________________
  FTRIG  _________#___#________________#_________
  CTU_Q  _______________##################_______
     SR  __##############################________
     RS  __####__############___#########________
 CTU_CV  0011111111122223333333333333333330000000
```

Events: TON_Q (7,1) (9,0) (20,1) (30,0); TOF_Q (2,1) (35,0); TP_Q (2,1) (7,0) (11,1) (16,0). The TP pulse is not
re-triggered at 15, because it still runs. CTU_Q (15,1) (33,0); CTD_Q (15,1) (36,0). RS goes FALSE while B is TRUE
(reset dominant). SR stays TRUE at 6 and 20 (set dominant).

## 56. device_fb.py: FB_AnalogIn, limit alarm, FB_MotorDol

```
python tools/fmse/device_fb.py                                 (analog + limits + motor summary)
python tools/fmse/device_fb.py --analog --raw 13824,-6000 --lo 0 --hi 16
python tools/fmse/device_fb.py --limits --values 2.5,2.9,3.1,8.1,8.2 --H 8 --L 3 --hyst 0.2 --delay 2
python tools/fmse/device_fb.py --motor E --trace
python tools/fmse/device_fb.py --motor A --events 2:CMD_ON,12:TRIP
```

Real output (motor scenario E, contactor welded):

```
MOTOR E Contactor welded: final FAULT, alarm 4 run feedback without command (contactor welded?), Run 0, 9 log lines
  2 event CMD_ON
  2 STOPPED -> STARTING
  4 STARTING -> RUNNING
  8 event WELD
  12 event CMD_OFF
  12 RUNNING -> STOPPING
  17 STOPPING -> FAULT alarm 4 run feedback without command (contactor welded?)
  25 event RESET
  25 reset rejected (alarm 4)
```

| Part | Result |
|---|---|
| Analog 0..10 bar | raw −6000 → 0.528 mA BAD (wire break), value_out 0.0; −500 → 3.711 mA UNCERTAIN; 13824 → 12.000 mA 5.000 bar; 28800 → 20.667 mA UNCERTAIN, clamped 10.0; 30000 → 21.361 mA BAD fault high, 0.0 |
| Limits H 8 / L 3, hyst 0.2, delay 2 | events 1 L on, 3 L off, 7 H on, 11 H off (7.9 and 7.85 do not clear H: hysteresis), 14 L on, 15 L off |
| Motor A–E | A normal 6 lines; B no feedback → alarm 1 at 7, 15 lines; C feedback lost → alarm 2 at 12, ends RUNNING; D trip → alarm 3, reset at 14 rejected, accepted at 18 after TRIP_CLEAR, **no automatic restart** (new edge at 25); E welded → alarm 4 at 17, reset rejected |

## 57. module_sequence.py: APC01 sequence inside PackML + data block

```
python tools/fmse/module_sequence.py                           (summary of A..E)
python tools/fmse/module_sequence.py --scenario B --log
python tools/fmse/module_sequence.py --scenario D --trace      (per tick: state, step, outputs, rotate x, clamp x, pressure)
python tools/fmse/module_sequence.py --scenario A --events "2:CMD Reset,10:CMD Start,30:JAM_ROT"
python tools/fmse/module_sequence.py --csv run_log.csv --md run.md
```

Real output:

```
SUMMARY
scen.  final state  StateCurrent  AlarmNo  count  Bits                         rotate x  spool  log lines
A      Idle                    4        0      1  97 (Ready+Auto+PartPresent)        30  B             23
B      Complete               17        0      1  100 (Done+Auto+PartPresent)         0  A             41
C      Complete               17        0      1  100 (Done+Auto+PartPresent)         0  A             42
D      Idle                    4        0      1  97 (Ready+Auto+PartPresent)        30  B             33
E      Idle                    4        0      0  97 (Ready+Auto+PartPresent)        30  B             28
```

Scenario B, the abort (part of `--log`):

```
  20 step S10 -> S20
  30 event JAM_ROT
  70 ALARM 12 rotate timeout in S20 -> internal Abort: Execute -> Aborting
  70 state Aborting StateCurrent=8 AlarmNo=12 Bits=106 count=0
  71 SC: Aborting -> Aborted
  71 state Aborted StateCurrent=9 AlarmNo=12 Bits=104 count=0
  ...
  95 cmd Clear accepted: Aborted -> Clearing
  95 state Clearing StateCurrent=1 AlarmNo=0 Bits=98 count=0
```

The log has one line for each event, accepted / rejected command, SC transition, step change, alarm and sequence start,
and one `state ... StateCurrent= AlarmNo= Bits= count=` line per state change (= what the cell controller reads
from the data block). Note on B: after the abort the clamp spring clamps, but the double valve keeps spool B. So after
UNJAM the rotation moves on to B without any command. That is why energy isolation needs the safety valve of item 7/8.

## 58. alarm_isa182.py: ISA-18.2 alarm state machine

```
python tools/fmse/alarm_isa182.py --log
python tools/fmse/alarm_isa182.py --events "100:A1:act,110:A1:ack,120:A1:clr" --log
python tools/fmse/alarm_isa182.py --csv alarms.csv --md alarms.md
```

Real output (result after the 35 events):

```
alarm  final state  annunciations  chattering  standing
A1     RTNUN                    2
A2     NORM                     2
A3     ACKED                    3              yes
A4     NORM                     3  yes
A5     ACKED                    1              yes
  first-out per group: CELL A3, WASH - (armed), CMM A5
```

First-out: A1 at 100 (A2 and A3 follow in the same group without first-out). A4 chatters (act at 200, 212, 224 = 3
acts in 24 s) and is shelved at 240; act / clr while shelved have no effect. A2 is not shelvable (shelve at 310 has no
effect). A5 goes out of service at 500 and back in service at 600 while active → UNACK with annunciation.

## 59. st_codegen.py: Structured Text from the item-8 library

```
python tools/fmse/st_codegen.py --module M02                   (print; = default)
python tools/fmse/st_codegen.py --module M03 --out M03.st
python tools/fmse/st_codegen.py --all --out-dir st_out --md codegen.md
python tools/fmse/st_codegen.py --kit                          (18 module instances, units MC01, MC02 ...)
```

Real output (M02, start and end):

```
(* AUTO-GENERATED from the item 8 circuit library: M02 APC01 - Automatic pallet changer (APC) *)
(* IO: 10 points (DI 6, DO 3, AI 1, AO 0, FDI 0, FDO 0) - do not edit by hand, regenerate *)
VAR_GLOBAL
  APC01_Rotate_SolA AT %QX0.0 : BOOL; (* PLT1.MACH.FMS1.APC01.Rotate.SolA | DO1.00 | solenoid A *)
  ...
  APC01_ClampPress_Value AT %IW2 : INT; (* PLT1.MACH.FMS1.APC01.ClampPress.Value | AI1.00 | pressure 4-20 mA *)
END_VAR

FUNCTION_BLOCK FB_APC01_Devices
VAR
  Rotate : FB_Valve2; (* VALVE_DOUBLE *)
  ...
END_VAR
Rotate(xPosA := APC01_Rotate_PosA, xPosB := APC01_Rotate_PosB);
APC01_Rotate_SolA := Rotate.qSolA;
...
END_FUNCTION_BLOCK
(* 32 lines, 1830 characters, Adler-32 0f66079f, 5 FB instances *)
```

| Module | Lines | Characters | Adler-32 | FB instances |
|---|---:|---:|---|---:|
| M02 APC01 | 32 | 1830 | 0f66079f | 5 |
| M03 POOL01 | 70 | 5169 | b0c1f5f1 | 13 |
| M10 WASH01 | 56 | 4004 | 5ab5ac95 | 10 |
| Library kit (18 module instances) | | | | **95** |

FB instances per module: M01 3, M02 5, M03 13, M04 9, M05 7, M06 6, M07 12, M08 15, M09 3, M10 10, M11 3, M12 5,
M13 10, M14 8, M15 12, M16 11, M17 5, M18 9, M19 1, M20 0, M21 0, M22 1. The files are written as UTF-8 with '\n'
line ends, so the checksum is the same on every PC.

## 60. plc_effort.py: PLC software effort

```
python tools/fmse/plc_effort.py                                (= --kit)
python tools/fmse/plc_effort.py --qty io_std=300,io_safe=40,fb_instances=120,seq_steps=200,alarms=600
python tools/fmse/plc_effort.py --kit --qty hmi_screens=45 --factor contingency_factor=0.2 --md effort.md
```

Real output (library kit):

```
item              quantity  h per unit  hours  source
io_std                 144         0.5   72.0  computed (item 8 kit)
io_safe                 66           1   66.0  computed (item 8 kit)
fb_instances            95         1.5  142.5  computed (st_codegen kit)
seq_steps              120         1.5  180.0  kit_qty
...
engineering                     sum qty*coef               994.5
test (FAT/SAT prep, I/O check)  0.4 x eng                  397.8
documentation                   0.15 x eng                 149.2
project management              0.1 x (eng + test + doc)   154.1
subtotal                                                  1695.6
contingency                     0.15 x subtotal            254.3
TOTAL                                                     1950.0
  = 51.3 person-weeks at 38 h/week
```

## Item 9 in a real project

1. Check the timing first: the reaction time of every fast motion or interlock signal (`plc_timing.py --response`)
   and the task load of the real CPU (C from the PLC's own cycle-time statistics, then `--tasks`). Never put a fast
   interlock over the cell controller or Modbus: 223.5 ms is too slow for that.
2. Agree an FB library (device FBs with the same interface as `FB_MotorDol`, `FB_AnalogIn`, valves, sensors) and the
   module template (PackML state machine + sequence + data block). Test each FB alone with traces like the ones here.
3. Generate the IO variables and the device-FB instances from the item-8 library (`st_codegen.py`). Do not type them by
   hand. When the library changes, regenerate the code and compare the checksum.
4. Set up the alarms to ISA-18.2 (priorities, groups for first-out, shelving only for shelvable alarms) and check
   chattering and standing alarms in the FAT with the alarm KPIs of item 5 (`alarm_kpi.py`).
5. Use `plc_effort.py` for the quote. Replace the coefficients with your own figures from past projects.


# Item 10A: PLC library (ST device FBs) and soft PLC

Part A of item 10 turns the item-9 principles into a **complete device function-block library in real IEC 61131-3
Structured Text**, one file per FB in `tools/fmse/plc_lib/`, with a common header, the decisions D1 - D4 and one rule
per FB. Every FB type that `st_codegen.py` (item 9) puts into a generated module has a matching `.st` file with the
SAME parameter names, so the generated `FB_<unit>_Devices` of all 22 modules loads and runs with the library.

- Guide (textbook): `docs/FMS system design/70_plc_library_A_standard_fbs.md` (part A)
- Shared examples + exact rules: `tools/fmse/examples/item10a_examples.json` (keys `decisions` D1 - D4, `_rules`
  common + one rule per FB + alarm_manager + fb_library, `fb_interfaces`, `_input_defaults`, `fb_tests`,
  `alarm_manager`)
- ST source: `tools/fmse/plc_lib/*.st` (29 FBs + `F_CmdAllowed` + `TYPES.st`), see `plc_lib/README.md`
- Reference lines for the self-tests: `fb_library_ref.py` (REF_10A = 19 FB test logs + alarm manager + command
  matrix, REF_9_DEVICE = FB_AnalogIn / limit alarm / FB_MotorDol of item 9)

The decisions in one line each:

```
D1 command request   4-phase echo: CC writes CntrlCmd + sets CmdChangeRequest (one FC16), module answers CmdAck
                     (bit8) or CmdRej (bit9) on the rising edge, CC clears the request, module clears the echo
D2 alarm numbers     AlarmNo = M x 1000 + 10 x i + a (APC01 Rotate alarm 1 -> 2011), module level i = 0, 900 + n
D3 alarm reaction    by CLASS: A = internal Abort, B = internal Hold from Execute, C = warning only
D4 Resetting         homing sequence with checks (all devices home, no A/B alarm, safety OK) before Idle (part B)
```

| Tool | What it does | Rule |
|---|---|---|
| `fb_library.py` | The 29 library FBs as Python classes + the shared test harness (events, change log, alarm manager, command matrix, item-9 plant model). `--test <FB, test id or all>`, `--list`, `--interface FB_x`, `--alarms`, `--cmdmatrix [--mode 1/2/3]`, `--item9` | all `_rules` |
| `st_sim.py` | Soft PLC: interpreter for an ST subset (see below). Loads `plc_lib/*.st` and runs every `fb_test`, the alarm manager (`FB_AlarmMgr.st`), the command matrix (`F_CmdAllowed.st`) and the item-9 analog / limit / motor scenarios (`FB_MotorDol.st` inside the item-9 plant model) **from the ST source**. `--test`, `--run FB_x --events ... --set ...`, `--list`, `--features` | common |
| `plc_lib_check.py` | Library rules C1 - C6: a .st file for every codegen FB type, codegen parameter names = .st interfaces for all 22 modules (+ the generated code runs 3 cycles), header / version / alarm table, no FB writes a global or an F-signal, interfaces = JSON and = Python classes, TYPES.st = item-5 tables | fb_library |

```
python tools/fmse/st_sim.py --test                       (all tests on the .st source; = reference line by line)
python tools/fmse/st_sim.py --test V4                    (one test; or an FB name, item10a, item9)
python tools/fmse/st_sim.py --run FB_Sensor --ticks 20 --set tOn_ms=300,tOff_ms=200 --events "2:xOn=1;3:xOn=0;4:xOn=1;10:xOn=0"
python tools/fmse/fb_library.py --interface FB_Valve2
python tools/fmse/fb_library.py --cmdmatrix --mode 2
python tools/fmse/plc_lib_check.py --modules --md check.md
```

**Everything in item 10A is deterministic.** `fb_library.py` (Python classes) and `st_sim.py` (the .st files) use
the SAME harness and both must print exactly the reference: the 19 FB test logs, the alarm-manager log and the
command matrix (203 lines), plus the 89 item-9 lines. Extra cross-checks: every ST FB = its Python class on 300
random ticks, `F_CmdAllowed.st` = `allowed()` for 935 command / state / mode cases, the ST standard FBs (TON, TOF, TP,
R_TRIG, F_TRIG, CTU, CTD, SR, RS) = the 40-scan trace of `iec_std_fb.py`.

> **Important.** All values are **examples for teaching**. The library FBs only read F-copies of safety signals and
> never write an F-output (checked by `plc_lib_check.py` C4). Safety functions are programmed only in the F-program by
> qualified people. Check the analog scaling, the timer resolution and the first-scan behaviour on your platform.

Real output (`st_sim.py --test`, start, alarm manager, one matrix row):

```
TEST FB_Sensor | S1 debounce: bounce ignored, 300 ms on / 200 ms off | 3 lines
    0 init xValue=0
    6 xValue=1
    13 xValue=0
TEST FB_Valve1 | V1 normal: A -> B -> A | 5 lines
    0 init qSol=0 xAtA=1 xAtB=0 xBusy=0 xError=0 iAlarm=0
    2 qSol=1 xAtA=0 xBusy=1
    8 xAtB=1 xBusy=0
...
ALARM MANAGER
    10 on 2053 class C -> AlarmNo=0 WarningNo=2053 AlarmClass=3 reaction=none (warning)
    20 on 2021 class B -> AlarmNo=2021 WarningNo=2053 AlarmClass=2 reaction=Hold (if Execute)
    25 on 2011 class A -> AlarmNo=2011 WarningNo=2053 AlarmClass=1 reaction=Abort
...
CMD MATRIX (Production): rows state, accepted commands
    Execute ['Stop', 'Hold', 'Suspend', 'Abort']
```

Real output (`plc_lib_check.py`):

```
check  result  checked  problems  what
C1     PASS         24         0  every codegen fb_type has its .st file
C2     PASS        302         0  codegen names = .st interfaces, 22 modules (243 inputs, 59 outputs), run 3 cycles
C3     PASS         30         0  header: purpose, rule, interface, version, alarm table, notes
C4     PASS        389         0  no FB writes a global / F-signal; generated code never writes an F-output
C5     PASS         46         0  interfaces = JSON fb_interfaces (17) and = fb_library classes (29)
C6     PASS         34         0  TYPES.st = item-5 tables, GC_CYCLE_MS 100; ASCII, LF, no TAB
RESULT: ALL CHECKS PASSED
```

## 61. fb_library.py: the FBs in Python + the test harness

One class per FB with `IN`, `CFG`, `OUT` and `run()` (= one call); wrappers (`FB_Estop`, `FB_Door2Ch`,
`FB_EnableSwitch`, `FB_LightCurtain` = FB_Safe2Ch, `FB_SafetyCoupling` = 2 x FB_Safe2Ch, `FB_ZoneOut`,
`FB_ContactorPair` = FB_Edm inverted, `FB_SafeValve` = 2 x FB_Edm) and the item-9 FBs `FB_MotorDol`, `FB_AnalogIn`,
`FB_LimitAlarm`. The harness functions (`run_test`, `alarm_log`, `cmd_matrix`, `motor_scenario`, `item9_lines`) take a
factory `make(name, cfg)` that returns an object with `set / call / outputs`; `make_py` gives the Python class,
`st_sim.make_st_factory(lib)` the parsed .st FB. So one harness tests both implementations.

## 62. st_sim.py: soft PLC for the .st files

Supported ST subset (keep the library inside it; `plc_lib_check.py` parses every file with it):

```
POUs        FUNCTION_BLOCK, FUNCTION (return by name), PROGRAM ; TYPE enumerations (qualified E_X.A)
variables   VAR_GLOBAL [CONSTANT] (also AT %IX0.0 of generated code), VAR_INPUT, VAR_OUTPUT, VAR, VAR_TEMP,
            VAR CONSTANT, initial values ; BOOL, SINT..LINT, USINT..ULINT, BYTE..LWORD, REAL, LREAL, TIME,
            enumerations, FB instances, ARRAY [lo..hi] OF <elementary> with [1, 2, 3(0)] init
statements  :=  IF/ELSIF/ELSE  CASE (values, ranges, lists, enum labels, ELSE)  FOR..TO..BY  WHILE  REPEAT..UNTIL
            EXIT  RETURN  FB calls with named inputs (:=) and outputs (=>), instance.output
operators   OR XOR AND & = <> < > <= >= + - * / MOD ** NOT unary minus, IEC precedence
functions   ABS MIN MAX LIMIT SEL MUX SQRT TRUNC, <type>_TO_<type>, TO_<type>, user FUNCTIONs
std FBs     R_TRIG F_TRIG TON TOF TP CTU CTD SR RS (written in ST, simulated clock)
literals    TRUE/FALSE, 1_000, 16#FF, 2#1010, 1.5E3, INT#5, T#1s500ms ; comments (* *) /* */ //
checks      strict types (BOOL <-> number, REAL -> INT need a conversion), integer wrap-around, integer '/'
            truncates, MOD sign of dividend, division by zero, array bounds, watchdog, internal VAR not readable
            from outside, only inputs writable from outside; every error names file:line
```

Not supported (on purpose): STRUCT, STRING, pointers / REFERENCE, VAR_IN_OUT, methods / interfaces (OOP),
multi-dimensional arrays. REAL is computed in 64 bit (the PLC uses 32 bit - the test values are chosen so that this
does not change a comparison).

## 63. plc_lib_check.py: library rules

See C1 - C6 above. `--modules` prints, per module, the FB instances, the number of checked input / output names, the
F-outputs and whether the generated code ran 3 cycles with the library. The self-test also mutates the library in
memory (renamed input, global write, wrong version, missing header entry, changed alarm text, missing file, type
error) and checks that each problem is found.

## Item 10A in a real project

1. Agree the module standard first (D1 - D4): one writer per data-block word, alarm numbers M x 1000 + 10 x i + a,
   reaction by alarm class, Resetting = homing. Write it into the FDS before anybody writes PLC code.
2. Import `plc_lib/TYPES.st` first, then the FBs (CODESYS / TwinCAT: as they are; TIA Portal: see the Siemens note in
   every header). Set `GC_CYCLE_MS` to the cycle of the task that calls the FBs (10 ms) - or replace the counters by
   TON as shown in the headers.
3. Generate the device FB instances with `st_codegen.py` and run `plc_lib_check.py`: every name the generator uses
   must exist in the library. Change the library and the generator together, never by hand in one module.
4. Test every FB alone before the FAT with traces like `st_sim.py --run` (on the real PLC: the same events with the
   simulation mode of the IDE) and compare the change logs line by line.
5. The FBs only read F-copies of safety signals and never write an F-output. Safety functions are programmed in the
   F-program by qualified people and validated separately (ISO 13849-2 / IEC 62061).
