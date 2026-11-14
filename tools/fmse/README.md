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
test stations, vision, ...) has 8 more tools. See the section [Item 3](#item-3-the-elements-of-an-fms) at the end.

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
  fms_economics.py      PASS  (25 checks passed, 0 failed)
  cpm_schedule.py       PASS  (14 checks passed, 0 failed)
  business_case.py      PASS  (12 checks passed, 0 failed)
  acceptance.py         PASS  (15 checks passed, 0 failed)
  urs_generator.py      PASS  (35 checks passed, 0 failed)
  risk_register.py      PASS  (8 checks passed, 0 failed)
  interface_matrix.py   PASS  (18 checks passed, 0 failed)
  abc_analysis.py       PASS  (12 checks passed, 0 failed)
  pfa_cells.py          PASS  (24 checks passed, 0 failed)
  gt_opitz.py           PASS  (21 checks passed, 0 failed)
  tolerance_process.py  PASS  (28 checks passed, 0 failed)
  process_time.py       PASS  (29 checks passed, 0 failed)
  capacity_plan.py      PASS  (21 checks passed, 0 failed)
  line_balance.py       PASS  (12 checks passed, 0 failed)
  machine_select.py     PASS  (19 checks passed, 0 failed)
  element_sizing.py     PASS  (63 checks passed, 0 failed)
  tolerance_stack.py    PASS  (14 checks passed, 0 failed)
  agv_fleet.py          PASS  (16 checks passed, 0 failed)
  asrs_cycle.py         PASS  (11 checks passed, 0 failed)
  robot_payload.py      PASS  (11 checks passed, 0 failed)
  assembly_test.py      PASS  (15 checks passed, 0 failed)
  transport_select.py   PASS  (13 checks passed, 0 failed)
  conveyor_drive.py     PASS  (5 checks passed, 0 failed)
  TOTAL                 PASS  (441 checks passed, 0 failed)
```

The expected values in the self-tests come from a separate hand calculation. They are not copied from the tool output.

## Example files in `examples/`

| File | Made by |
|---|---|
| `item1_examples.json` | shared input (do not edit here without telling the guide / web builders) |
| `item2_examples.json` | shared input of item 2 (same rule) |
| `item3_examples.json` | shared input of item 3 (same rule; the 17 basic calculators take their inputs from `web/fmse3.js`) |
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
