# Doctoral thesis – edition 2 (standard-based communication) – working folder

Thesis of **Kenzo**, second edition: *An Uncertainty-Aware Digital Twin Method with Interoperable OPC UA / MQTT
Communication for the Stepwise Introduction of Flexible Manufacturing Systems in Emerging Industries – Cases of
Compressor, Ball Screw and Roots Blower Production.*

## What edition 2 is

| | Edition 1 (`../thesis/`) | Edition 2 (this folder) |
|---|---|---|
| Factory communication | Ethernet + Modbus TCP + HTTP only; event-preserving register block in every PLC | OPC UA servers with information models (OPC 40001-1 Machinery, OPC 40501-1 Machine Tools), subscriptions, events, methods; MQTT broker with Sparkplug B as unified namespace; OPC UA PubSub (JSON over MQTT) as option; VDA 5050 for AGVs; certificates / TLS; still offline, no cloud |
| RQ1 / H1 | reliable twin with Modbus/HTTP only; ≥ 40 machines, latency ≤ 1 s, loss ≤ 0.1 % | open-standard architecture vs minimal Modbus/HTTP; 100 % of state changes, latency < 1 s, 21 devices on one industrial PC, no per-machine register mapping, at higher resource use and configuration effort |
| Chapter 5 | Modbus/HTTP architecture and measurements | OPC UA / MQTT architecture, measured against the Modbus/HTTP baseline |
| Chapters 4, 6, 7, 9 (science) | Bayesian twin, discrepancy, staging, cases | **unchanged** results; data path wording, Section 9.2.4 / 9.3.4 load estimates and Appendix A adapted |
| Code | Python standard library only | standard library for all thesis calculations; third-party packages (asyncua, amqtt, paho-mqtt, …) only for the OPC UA / MQTT measurements, installed offline into `.venv` |

The candidate and the supervisor choose which edition is defended. The text overlap between the editions is intended
and must be declared if both are made public (front matter, "Note on the two editions").

**H1 result.** Filled in on 2026-11-15 from the Chapter 5 measurements (abstract, Section 10.1, Table 10.1, Chapter 11):
H1 is supported under conditions (event-based delivery, MQTT QoS ≥ 1 with store-and-forward; laboratory bench with
emulated machines). Chapter 5 is generated: edit `code/modern/ch05_template.md`, then run `code/modern/fill_ch05.py`.

- Master plan, chapter list and writing order: [`00_thesis_plan.md`](00_thesis_plan.md)
- Plain-English guide to the methods (for you, not for the examiners): [`../Doctor paper/52_thesis_methods_guide.md`](../Doctor%20paper/52_thesis_methods_guide.md)
- Research roadmap (steps, paper 1, supervisor): [`../Doctor paper/51_doctoral_research_roadmap.md`](../Doctor%20paper/51_doctoral_research_roadmap.md)
- Paper 1 (systematic review = chapter 2 basis): [`../research/paper1_slr/paper1_draft.md`](../research/paper1_slr/paper1_draft.md)

## Status (2026-11-15)

| Chapter | File | Edition-2 status |
|---|---|---|
| Front matter (new title, abstract, note on the two editions, abbreviations) | [`00_front_matter.md`](00_front_matter.md) | adapted; H1 placeholder in the abstract |
| 1 Introduction | [`ch01_introduction.md`](ch01_introduction.md) | adapted (interoperability, RQ1 / H1, C1) |
| 2 State of the art and research gap | [`ch02_state_of_the_art.md`](ch02_state_of_the_art.md) | Section 2.7 rewritten (OPC UA, companion specs, PubSub, security, MQTT, Sparkplug B, UNS, TSN, AAS, VDA 5050, retrofit, Modbus baseline); gap G3 new |
| 3 Research methodology | [`ch03_methodology.md`](ch03_methodology.md) | H1 evaluation = OPC UA / MQTT campaign vs Modbus baseline |
| 4 System model | [`ch04_model.md`](ch04_model.md) | science unchanged; data-source wording and Table 4.5 sources → information model |
| 5 Architecture (OPC UA + MQTT) | [`ch05_architecture.md`](ch05_architecture.md) | written in parallel by the Chapter 5 / 8 work |
| 6 Bayesian twin | [`ch06_bayesian_twin.md`](ch06_bayesian_twin.md) | unchanged except the data-path sentence |
| 7 Staging optimisation | [`ch07_staging_optimisation.md`](ch07_staging_optimisation.md) | unchanged except the starting-point sentence |
| 8 Implementation | [`ch08_implementation.md`](ch08_implementation.md) | written in parallel by the Chapter 5 / 8 work |
| 9 Reference design cases | [`ch09_cases.md`](ch09_cases.md) | Sections 9.2.4 / 9.3.4 rewritten with an analytical OPC UA / MQTT load estimate (new Table 9.4; later tables renumbered); new Section 9.4 case 3 Roots blower extension (Tables 9.9 – 9.16, Figures 9.4 – 9.7; Section 9.4.7 with the OPC UA / MQTT load) |
| 10 Discussion | [`ch10_discussion.md`](ch10_discussion.md) | RQ1 answer (placeholder), decision table 10.2 (OPC UA / MQTT vs Modbus / HTTP) |
| 11 Conclusions | [`ch11_conclusions.md`](ch11_conclusions.md) | adapted; H1 placeholder |
| References | [`references.md`](references.md) | edition-1 list + about 40 verified entries for Section 2.7; `[verify]` marks to check |
| Appendices A–E | [`appendices.md`](appendices.md) | Appendix A = information-model mapping + baseline register map |
| **Assembled thesis** | `build/thesis.pdf` · `build/thesis.docx` · `build/thesis.html` | see the build command below |

## Python environment (offline)

All thesis calculations (Chapters 4, 6, 7, 9) use **only the Python standard library**. The OPC UA / MQTT measurements of
Chapter 5 need a few third-party packages; they are kept as wheel files in this folder so that everything installs on
an offline factory PC:

- `vendor/wheels/` – the wheel files (asyncua, amqtt, paho-mqtt, cryptography, …)
- `vendor/requirements-lock.txt` – the exact versions (lock file)
- `.venv/` – the virtual environment (not under version control; recreate it as below)

Recreate the environment (Windows, from `thesis_modern/`):

```
python -m venv .venv
.venv\Scripts\pip install --no-index --find-links vendor/wheels -r vendor/requirements-lock.txt
```

Then run the measurement scripts with `.venv\Scripts\python …`; the build and all other scripts run with the normal
`python`.

## Building the thesis document

From the project root:

```
set PYTHONIOENCODING=utf-8
python thesis_modern/code/build_thesis.py
```

(PowerShell: `$env:PYTHONIOENCODING='utf-8'; python thesis_modern/code/build_thesis.py`.) The script writes
`thesis_modern/build/thesis.html`, `thesis.pdf` (headless Chrome) and `thesis.docx`, and prints the page count.
Regenerate figures first if data changed: `python thesis_modern/code/make_figures.py` and
`python thesis_modern/code/make_fms_figures.py` (edition 2 changed Figure 1.1 — C1 "OPC UA + MQTT" — and the device notes of
Figure 4.4; Figures 8.x belong to the Chapter 8 work).

Then open `thesis.docx` in Word, answer **Yes** when Word asks to update fields (table of contents, page numbers) and
apply the university template (styles Heading 1–3, Caption, Normal). Formulas are Unicode text; re-type the numbered
equations with Word's equation editor for the final submission if the university requires it. Chapter notes "> Draft …"
and the per-chapter reference notes are left out automatically; `references.md` is the bibliography.

## Folder structure

```
thesis_modern/
  00_thesis_plan.md          master plan of edition 2
  ch01_….md … ch11_….md      one file per chapter
  code/                      every calculation and experiment (standard library; OPC UA / MQTT benches use .venv)
  data/                      raw results (CSV / JSON) – never edited by hand
  figures/                   thesis figures (SVG), generated by scripts
  vendor/                    offline wheels + lock file
  .venv/                     virtual environment (recreate, see above)
```

## Code – what each script does and how to reproduce every number

All scripts below run with Python 3.10+ and **only the standard library** (offline PC). The OPC UA / MQTT measurement scripts of Chapter 5 (edition 2) are documented in Chapter 5 and run in `.venv`. Run them from `thesis_modern/code/`.

| Script | Purpose | Reproduce | Output | Chapter |
|---|---|---|---|---|
| `bayes.py` | conjugate Bayesian models (failures, repairs, cycle time, scrap), capacity formula; `chapter4_examples()` prints every worked number of chapter 4 | `python bayes.py` | console | 4 |
| `flowline.py` | fast flow-line DES (departure-time recursion, Eq. 6.2); compressor line from design estimates | `python flowline.py` | console | 6 |
| `rampup_experiment.py` | virtual ramp-up: 30 hidden true factories × 12 months, predictors B0, B1, P0, P1, P07 | `python rampup_experiment.py 30 1.0 ../data/rampup_w1.0.csv` (also `0.25`, `4.0`) | `data/rampup_w*.csv` | 6 |
| `discrepancy.py` | adds model-discrepancy predictors B0D and P07D to a ramp-up CSV (post hoc, no new simulation) | `python discrepancy.py ../data/rampup_w1.0.csv` | same CSV | 6 |
| `analyse_rampup.py` | MAPE, coverage, width, bias per month and method | `python analyse_rampup.py ../data/rampup_w1.0.csv` | console (Tables 6.2–6.4, 6.7) | 6 |
| `bottleneck_experiment.py` | bottleneck identification and station-capacity error | `python bottleneck_experiment.py` | `data/bottleneck.csv` (Table 6.5) | 6 |
| `variance_experiment.py` | epistemic vs aleatory share (Eq. 4.13) | `python variance_experiment.py` | console (Table 6.6) | 6 |
| `plot_ch6.py` | figures 6.3 and 6.5 | `python plot_ch6.py` | `figures/fig6_*.svg` | 6 |
| `commbench.py` | Modbus TCP lab bench (edition-1 baseline): N emulated PLCs + gateway, event block vs state-only polling | `python commbench.py 40 par 0.25 60 ../data/comm_runs.jsonl 10`; `python commbench.py rtt` | `data/comm_runs.jsonl`, `comm_rtt.json` | 5 |
| `httpbench.py` | HTTP/JSON API throughput and latency | `python httpbench.py 160` | `data/http_bench.json` | 5 |
| `fill_ch05.py` (+ `ch05_text_*.md`) | writes the measured tables into chapter 5 | `python fill_ch05.py` (only once, on the template) | `ch05_architecture.md` | 5 |
| `staging.py` | stepwise FMS introduction: 6 options × 4 half-year stages, policies NONE / ALL / STATIC / ADAPT_DEM / ADAPTIVE / PI_RULE, screening model calibrated + validated against the DES | `python staging.py 40 0.0 ../data/staging_b0.0.csv` (also β = 0.5) | `data/staging_b*.csv` | 7 |
| `analyse_staging.py` | ΔNPV vs no investment, CVaR, capital, short stages, regret, paired differences | `python analyse_staging.py ../data/staging_b0.0.csv` | console (Tables 7.2–7.4) | 7 |
| `case_study.py` | chapter 9: case 1 frozen prediction P0, staging decision + sensitivity, gateway sizing; case 2 ball screw route parsed from `web/bsfmfg_data.js`, capacity, transfer test (20 scenarios), sizing for 73 machines | `python case_study.py` (set `PYTHONIOENCODING=utf-8` on Windows) | `data/case_study.json`, `data/case1_P0.json` | 9 |
| `case3_roots.py` | chapter 9, case 3 (Roots blower extension, all values reference estimates): static load of the shared stations, single- and three-chain mean value analysis of the shared cell (load station, shuttle, HMCs; fixture types A / B / C), Roots flow line with flow-equivalent cell, frozen prediction P0, transfer test (20 scenarios), screening of the first investment step, data-path load; figures 9.4 – 9.7 | `python case3_roots.py` (≈ 10 s; set `PYTHONIOENCODING=utf-8` on Windows) | `data/case3_roots.json`, `data/case3_P0.json`, `data/case3_rampup.csv`, `figures/fig9_[4-7]_roots_*.svg` | 9 |
| `make_figures.py` | all thesis figures (SVG) from the data: structure, information loop, architecture / software layers, capacity charts, event loss, cycle time, NPV / CVaR, transfer test | `python make_figures.py` | `figures/*.svg` | all |
| `make_fms_figures.py` | FMS figures 4.2 – 4.4 (factory layout, part routings, crankcase cell), 8.2 – 8.4 (control hierarchy, job handshake, AGV node map), 9.1 (cell throughput vs pallets): cleaned and cropped from the engineering drawings in `docs/img` and `Doctor paper/img`, figure 8.2 drawn new | `python make_fms_figures.py` | `figures/fig4_[234]_*.svg`, `fig8_[234]_*.svg`, `fig9_1_cell_throughput.svg` | 4, 8, 9 |
| `build_thesis.py` | assembles all chapter files into `build/thesis.html`, `thesis.pdf` (headless Chrome) and `thesis.docx` (Office XML written with the standard library; figures converted to PNG) | `python build_thesis.py` (set `PYTHONIOENCODING=utf-8`) | `build/` | all |
| `export_web.py` | copies the thesis results into the twin tab | `python export_web.py` | `../web/phd_data.js` | tab #phd |

Full campaign of chapter 5 (≈ 16 min): see the loop in the chapter 5 log, or run each configuration of Table 5.3.
Experiments of chapter 6 use 15 processes (`multiprocessing.Pool(15)`); reduce the number on smaller PCs.

## Data provenance – the labelling rule

Every number in the thesis carries one label:

| Label | Meaning | Example |
|---|---|---|
| **[design estimate]** | value from the FMS design / supplier statement; to be replaced by the final design data | MTBF of the HMC 30 h |
| **[assumption]** | modelling choice, stated and varied in sensitivity analyses | 330 productive hours per month; ramp-up shape |
| **[calculated]** | result of a formula | static capacity 5 667 parts/month |
| **[simulated]** | result of a simulation or computational experiment – never presented as measured | virtual ramp-up results |
| **[measured]** | measured on a real set-up (lab bench, later the factory) | Modbus campaign, HTTP bench |
| **[cited]** | from a referenced source | – |

## Known limitations of the current results (to be closed before the defence)
1. Chapter 5: emulated machines on one PC → repeat with the real machines' OPC UA servers (and the Modbus baseline with a real Delta AS332T and S7-1200).
2. Chapter 6: ramp-up shape is an assumption; the real ramp-up of the case factory (Section 9.7) is the final test.
3. Design estimates (Table 4.2) are the twin's example values; case 2 reliability and all money values are reference
   estimates → replace with the real FMS design data and quotations, re-run `case_study.py`, freeze P0 again.
4. References marked `[verify]` must be checked in the library database.
5. Real-machine check of Chapter 5: OPC UA servers of the real CNCs/PLCs and a Mosquitto broker (the lab used the
   Python broker amqtt – conservative); import the official companion-specification NodeSets.

## Reproducibility pitfalls found during the work (Windows)
- `time.time()` advances in ≈ 15.6 ms steps → use `time.perf_counter()` for timing.
- asyncio timers may fire up to one clock tick early → emulated delays implemented with threads + `time.sleep` and
  `timeBeginPeriod(1)`.
- `multiprocessing` on Windows cannot start children from code piped through stdin → always run scripts from files.
