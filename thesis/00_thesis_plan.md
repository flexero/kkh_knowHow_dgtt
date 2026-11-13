# Doctoral thesis – master plan

**Working title:** An Uncertainty-Aware, Low-Cost Digital Twin Method for the Stepwise Introduction of Flexible
Manufacturing Systems in Emerging Industries – Cases of Compressor and Ball Screw Production

**Candidate:** Kenzo · **Supervisor:** [name] · **Target length:** 132–150 pages (A4, 12 pt, 1.5 spacing ≈ 300 words
per text page; about 40 000–45 000 words plus about 60 figures and 50 tables) · **Plan version:** 1.0 (2026-11-13)

---

## 1. The scientific core in one page

**Problem.** A company that has only standalone CNC machines wants an FMS. It must decide machines, buffers, pallets,
transport, control rules and the *order of introduction* at design time, when cycle times, failure rates, scrap and
demand are uncertain, with only low-cost technology (Ethernet, Modbus TCP, HTTP, offline PCs). Wrong decisions are seen
only in ramp-up, when they are expensive.

**Gap (proved in paper 1 = chapter 2).** No published work (i) freezes design-stage twin predictions and validates them
against ramp-up, (ii) updates input parameters sequentially with Bayesian methods from commissioning / ramp-up data,
(iii) does this with Modbus/HTTP-only technology with measured limits, (iv) uses it for stepwise FMS introduction
decisions.

**Contributions (C1–C4) → chapters.**
| | Contribution | Chapter | Type of proof |
|---|---|---|---|
| C1 | Low-cost DT reference architecture (Modbus TCP + HTTP), with sizing formulas for polling, bandwidth, latency, data loss | 5 | Calculation + laboratory measurement campaign |
| C2 | Uncertainty-aware DES twin with sequential conjugate Bayesian updating (failure, repair, cycle time, scrap) and frozen-prediction protocol | 4, 6 | Mathematical derivation + Monte Carlo experiments with known ground truth |
| C3 | Stochastic optimisation of the stepwise FMS introduction plan (which machines / automation, when) using the updated twin | 7 | Algorithm + numerical experiments, comparison with baselines |
| C4 | Industrial application: compressor FMS (design phase, real design data) and ball screw line (second case) | 9 | Case study; ramp-up comparison added when data exist |

## 2. Honest data strategy (what is real, what is simulated, what comes later)

| Data | Source | Status | Used in |
|---|---|---|---|
| Product, routing, cycle-time estimates, machine list, layout | Your FMS design (4 months), supplier quotes, catalogues | **Real design data** – collected now | Ch 4, 7, 9 |
| Reference values (MTBF, MTTR, OEE, scrap) | Literature, standards, supplier data – cited | Real published values, cited | Ch 4, 9 |
| Communication performance | Measured on lab setup: real PC + Modbus TCP servers (simulated PLCs, later a real Delta/Siemens PLC) | **Real measurements** | Ch 5 |
| Bayesian updating accuracy | Virtual ramp-up: a "true" factory with hidden parameters generates data; the twin learns them | **Real computational experiments** (method proof, standard in simulation research) | Ch 6, 9 |
| Optimisation performance | Numerical experiments on the compressor and ball screw models | **Real computational experiments** | Ch 7 |
| Ramp-up of the real factory | Your factory after installation | **Future** – section 9.6 written as protocol now, results added when available | Ch 9 |

Rule for the whole thesis: every number has a label – *measured*, *calculated*, *simulated*, *design estimate* or
*cited*. Nothing simulated is presented as measured.

## 3. Table of contents with page budget

| Ch | Title | Pages | Main content |
|---|---|---|---|
| – | Front matter: title, declaration, abstract (EN + local language), acknowledgements, contents, lists of figures / tables, nomenclature | 10 | – |
| 1 | Introduction | 10 | Industrial background (emerging industry, CNC → FMS), problem statement, research questions RQ1–RQ3, hypotheses H1–H4, contributions, scope and limits, thesis structure |
| 2 | State of the art and research gap | 24 | FMS fundamentals and history; digital twin concepts (Grieves, Kritzinger, ISO 23247); DES in system design; input uncertainty (delta method, bootstrap, Bayesian); calibration and data assimilation; virtual commissioning; communication (OPC UA, MQTT, Modbus, HTTP); SMEs and emerging economies; **systematic review (paper 1): method, 28 studies, concept matrix**; gaps G1–G5 |
| 3 | Research methodology | 8 | Design science research; research design per RQ; validation strategy (3 layers: computational, laboratory, industrial); data management; reproducibility; ethics and confidentiality |
| 4 | System model and problem formulation | 16 | FMS as stochastic DES (stations, buffers, pallets, AGV, rules); parameter vector θ; performance measures (throughput, OEE, lead time, WIP); uncertainty model: priors from design data; **conjugate models** Gamma–Poisson (failures), Gamma–Exponential (repair), Normal–Inverse-Gamma / log-normal (cycle times), Beta–Binomial (scrap); posterior predictive; prediction error and interval coverage; **staging decision problem** (stages, options, costs, capacity constraints, risk) |
| 5 | Low-cost digital twin architecture (C1) | 15 | Requirements; layered architecture (machine → gateway → twin → MES/ERP) with Modbus TCP + HTTP only; register map design; **calculations**: polling cycle, bandwidth, latency budget, data-loss and timestamp error, number of machines per gateway; time synchronisation; data quality checks; security without cloud; **lab measurement campaign** and results |
| 6 | Uncertainty-aware twin with sequential Bayesian updating (C2) | 18 | Frozen-prediction protocol; event extraction from machine states; updating algorithms (pseudo-code), change detection, forgetting factor for ramp-up learning curves; uncertainty propagation by Monte Carlo DES; variance reduction (common random numbers); convergence and complexity; **experiments with known ground truth**: error vs data volume, vs deterministic and one-time calibration baselines |
| 7 | Optimisation of the stepwise FMS introduction (C3) | 15 | Staging as multi-stage stochastic problem; solution by simulation-based optimisation (sample average approximation + ranking & selection / genetic algorithm for configuration, rolling re-optimisation after each Bayesian update); objective (NPV, risk of under-capacity, CVaR); algorithm, complexity; **numerical experiments** vs static plan and all-at-once plan |
| 8 | Implementation | 10 | Software architecture (Python stdlib engine, browser twin, Modbus/HTTP gateway), data model, algorithms as modules, verification (unit tests, engine verification), performance, offline deployment on factory PC |
| 9 | Industrial application and validation (C4) | 20 | Case 1 compressor FMS: data, model, frozen design predictions v1.0, staging plan, sensitivity; Case 2 ball screw line: transfer; efficiency results (throughput, OEE, investment, risk); **9.6 ramp-up validation protocol** (+ results when available); threats to validity |
| 10 | Discussion | 6 | Answers to RQ1–RQ3, hypotheses accepted / rejected, comparison with literature, generalisation, limitations |
| 11 | Conclusions and future work | 4 | Summary of contributions, recommendations for industry, future research |
| – | References (~150–200) | 10 | – |
| A–E | Appendices: A register maps; B derivations; C algorithm listings; D experiment tables; E case data sheets | 12 | – |
| | **Total** | **≈ 148** | |

## 4. Research questions and hypotheses (draft – fixed in chapter 1 / 3)
- **RQ1** What architecture enables a reliable FMS digital twin with only Modbus TCP and HTTP, and what are its limits?
  **H1:** With a polling-based gateway, ≥ 40 machines can be monitored with state-change latency ≤ 1 s and sample loss ≤ 0.1 %.
- **RQ2** How much does sequential Bayesian updating improve prediction accuracy during commissioning and ramp-up?
  **H2:** Monthly throughput prediction error falls below 5 % at least 30 % faster (in data volume) than with a
  deterministic design model or one-time calibration. **H3:** 90 % predictive intervals achieve ≥ 85 % coverage.
- **RQ3** How can the updated twin support the stepwise introduction of an FMS?
  **H4:** A staged plan re-optimised after each update gives higher expected NPV and lower risk of under-capacity than
  an all-at-once or a static staged plan.
(Thresholds are proposals; they are tested, not assumed.)

## 5. Writing order (one chapter per round, like before)
| Round | Work | Output |
|---|---|---|
| 1 ✅ | Ch 4 model + derivations; code of the Bayesian updating library | `thesis/ch04_model.md` (done 2026-11-13), `thesis/code/bayes.py` |
| 2 ✅ | Ch 6 algorithm + virtual ramp-up experiments (real computations) | `ch06_bayesian_twin.md` (done 2026-11-13), `data/`, `figures/` |
| 3 ✅ | Ch 5 architecture + calculations + lab measurement (Modbus/HTTP on this PC) | `ch05_architecture.md` (done 2026-11-13), `data/comm_runs.jsonl`, `http_bench.json` |
| 4 | Ch 7 optimisation + experiments | `ch07_staging_optimisation.md` |
| 5 | Ch 8 implementation + Ch 9 cases (with your design data) | `ch08`, `ch09` |
| 6 | Ch 2 state of the art (expanded from paper 1) + Ch 3 methodology | `ch02`, `ch03` |
| 7 | Ch 1, 10, 11, abstract, front matter, appendices, references | complete thesis |
| 8 | Assembly into one Word / PDF document, figures, numbering, formatting check | `thesis.docx` / `thesis.pdf` |

## 6. What Kenzo provides during the work
- University rules: template, citation style, language, page format, number of papers required.
- From the FMS design (next 4 months): machine list with supplier, cycle-time estimates per operation, quotes (cost),
  layout, product mix and volumes – these replace example values in chapter 9.
- Later: commissioning and ramp-up logs (for section 9.6).

## 7. Files
`thesis/` – one Markdown file per chapter (`ch01_….md` …), `thesis/code/` (algorithms + experiments, stdlib Python),
`thesis/figures/`, `thesis/data/` (labelled data sets), `thesis/refs.bib` (references for Zotero).
