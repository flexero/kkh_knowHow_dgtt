# Chapter 3 – Research Methodology

> Draft v2.0 (edition 2) – 2026-11-15. Describes how the research questions are answered: the research paradigm (3.1), the design
> per research question (3.2), the evaluation strategy (3.3), the experimental and statistical methods (3.4), data,
> labelling and reproducibility (3.5), ethics, confidentiality and the use of AI assistance (3.6), and the limitations of
> the methodology (3.7).

## 3.1 Research paradigm: design science research

The thesis develops artefacts — a standard-based communication architecture, a Bayesian twin method, a decision method for staged
investment — and evaluates whether they solve a practical problem better than existing approaches. This is the
situation for which design science research (DSR) was formulated: research that creates and evaluates artefacts
intended to solve identified organisational problems, with rigour derived from the knowledge base and relevance derived
from the application environment (Hevner et al., 2004). The process follows the six activities of Peffers et al. (2007):

| DSR activity | In this thesis |
|---|---|
| 1 Problem identification and motivation | industrial context (Ch. 1), state of the art and systematic review (Ch. 2) |
| 2 Objectives of a solution | research questions RQ1–RQ3, hypotheses H1–H4, requirements (Tables 5.1, Section 8.1) |
| 3 Design and development | artefacts C1–C3: OPC UA / MQTT architecture with information-model mapping (Ch. 5), Bayesian twin with discrepancy learning (Ch. 4, 6), staging decision method (Ch. 7); implementation (Ch. 8) |
| 4 Demonstration | reference design cases: compressor FMS, ball screw line and Roots blower extension sharing the FMS cell (Ch. 9) |
| 5 Evaluation | laboratory measurement campaign against the Modbus TCP/HTTP baseline (Ch. 5), controlled computational experiments (Ch. 6, 7, 9), planned field validation (Section 9.7) |
| 6 Communication | thesis, paper 1 (systematic review), papers 2–4 (planned), browser implementation in the twin |

DSR fits the target context because the problem is practical and urgent (a company must decide how to introduce an
FMS), the artefacts can be built and used, and their utility can be evaluated quantitatively against baselines.

## 3.2 Research design per question

**Table 3.1** Research design.
| | RQ1 – architecture | RQ2 – Bayesian twin | RQ3 – staged introduction |
|---|---|---|---|
| Artefact | OPC UA + MQTT/Sparkplug B reference architecture (information models OPC 40001-1 / 40501-1, subscriptions, events, methods, unified namespace, VDA 5050, certificates), mapping of twin observations to model nodes, sizing formulas | conjugate updating with forgetting, nested Monte Carlo prediction, discrepancy learning, frozen-prediction protocol | rolling-horizon decision rule with screening model and Bayesian information |
| Hypothesis | H1 | H2, H3 | H4 |
| Evaluation method | analytical model + laboratory measurement campaign (same scenarios for both architectures) | controlled computational experiment (virtual ramp-up with hidden truth), transfer to a second line and a third, cell-sharing product family | controlled computational experiment (hidden factories, uncertain demand) |
| Baselines | minimal Modbus TCP/HTTP architecture of edition 1 (event block, parallel polling); variants of the standard architecture (sampled variables vs events; with and without encryption) | deterministic design model (B0), one-time calibration (B1), frozen prior (P0), output-level correction (B0D) | all-at-once (ALL), plan fixed at design (STATIC), demand-only learning (ADAPT_DEM), perfect-information rule (PI_RULE) |
| Measures | completeness of state-change delivery, end-to-end latency, CPU and memory of the industrial PC, bandwidth, configuration effort (engineering steps / lines of configuration per device) | MAPE, coverage, interval width, bias, bottleneck identification, epistemic share | incremental NPV, CVaR, capital, short stages, regret |
| Data | measured on the bench (emulated machines with OPC UA servers) | simulated | simulated |
| Field validation | real CNC / PLC OPC UA servers in the case factory (Chapter 5) | real ramp-up (Section 9.7) | half-yearly decisions in the case factory |

## 3.3 Evaluation strategy: three layers

No single evaluation can establish the utility of the artefacts. The thesis therefore combines three layers, each
compensating a weakness of the others:

1. **Analytical evaluation.** Closed-form models (static capacity, Eq. 4.2; message-rate, bandwidth and latency
   estimates of the communication architecture, Chapter 5 and Section 9.2.4; conjugate updates, Eq. 4.5–4.11) give
   transparent, checkable predictions and are verified by hand calculations and by the other layers (e.g. DES 0.4 %
   below the static bound).
2. **Controlled experiments.** Laboratory measurements and computational experiments with a known truth answer questions
   that field data cannot answer: whether the method learns the *true* parameters, how fast, and whether its uncertainty
   is honest. They allow many replications, paired comparisons and sensitivity analyses. Their weakness — the truth
   is generated by an assumed model — is stated in every chapter.
3. **Field validation.** The real ramp-up of the case factory and the tests with the real machine OPC UA servers remove
   the assumed-model weakness. Because the factory is still in design, this layer is fully specified (Chapter 5, Section
   9.7) and the design prediction
   is already frozen, but its results are not yet available.

## 3.4 Experimental and statistical methods

### 3.4.1 Simulation experiments
Simulation experiments follow established practice (Law, 2015): verified models (Section 8.3: 11 of 11 hand-calculation
tests; Section 6.4.1: static-bound check; Section 7.3.3: screening model vs DES, 1.2 % mean deviation), explicit
random-number seeds, replications sufficient for the precision required, and common random numbers when alternatives
are compared on the same scenario (Chapter 7). Scenario generators (Table 6.1) are documented as assumptions and varied
in sensitivity analyses (prior weight × 0.25 / 1 / 4; risk aversion β = 0 / 0.5; one-at-a-time variation of economic
parameters).

### 3.4.2 Laboratory measurement campaign for H1
H1 is evaluated by a measurement campaign that runs the standard-based architecture and the Modbus TCP/HTTP baseline on
the same laboratory set-up and the same machine scenarios. The set-up is described here only generically; the details,
software versions and configurations are given in Chapter 5.

- **Plant emulation.** The 21 devices of the case factory (Section 9.2.4) are emulated on the bench. Each emulated
  machine produces state changes, cycle completions, counters and alarms from the same stochastic process with a fixed
  seed and exposes them (a) through an OPC UA server whose address space follows OPC 40001-1 / OPC 40501-1 and (b) through
  the Modbus register map with event block of edition 1.
- **Data path under test.** OPC UA subscriptions (sampled variables) and OPC UA events deliver the data to an edge
  client, which publishes them as Sparkplug B metrics to an MQTT broker (the unified namespace); the twin subscribes to
  the broker. The AGVs exchange VDA 5050 messages over the same broker. All components run on one industrial PC,
  offline, with certificate-based security switched on (and, as a variant, off).
- **Ground truth.** Every emulated machine logs the true time of each state change in the same high-resolution clock as
  the receiving twin, so that completeness (delivered / generated state changes) and end-to-end latency are computed
  exactly rather than estimated.
- **Factors.** Sampling and publishing intervals (0.25–1 s), number of devices (21 and scaled-up plants), delivery
  mechanism (sampled variable vs event), security mode.
- **Measures.** Completeness, latency distribution (mean, 99th percentile, maximum), CPU and memory of the PC, network
  load, and configuration effort (engineering steps and lines of configuration per added device), each for both
  architectures.
- **Acceptance.** H1 is supported if completeness is 100 % and the maximum end-to-end latency stays below 1 s for the
  21-device case, and if adding a device of a known type needs no per-device register mapping; the price — resource use
  and configuration effort relative to the baseline — is reported, not judged against a threshold.

The Modbus baseline repeats the edition-1 campaign on the same bench (event block, parallel polling), so that both
architectures are compared under identical machine behaviour. Lessons from edition 1 are kept: timing uses a
high-resolution monotonic clock, and the platform pitfalls found then (coarse system clock, early asynchronous timers
on Windows) are avoided by design.

### 3.4.3 Statistical analysis
- Point accuracy: absolute percentage error per period, mean over scenarios (MAPE), bias.
- Calibration and sharpness: empirical coverage of 90 % intervals and mean relative interval width, judged together.
- Comparison of policies: paired differences per scenario with standard error and the number of scenarios in which a
  policy is better; with 40 scenarios, a mean difference of more than two standard errors is regarded as systematic.
- Risk: conditional value-at-risk of the worst 10 % of scenarios.
- Variance decomposition: law of total variance on nested samples (Eq. 4.13).
Results are reported with their sample sizes; no claim is made beyond the simulated or measured setting in which it was
obtained.

### 3.4.4 Systematic review
The literature review follows PRISMA 2020 with a pre-defined protocol (`Doctor paper/51_slr_protocol.md`): review questions,
search strings, eligibility criteria with exclusion codes, screening, quality scoring and a fixed extraction form.
Deviations (single database, open-access full texts only, AI-assisted screening) are logged and reported.

## 3.5 Data, labelling and reproducibility

**Labelling.** Every number in the thesis carries one label: *design estimate* (from the factory design), *assumption*
(modelling choice), *reference estimate* (engineering estimate used in place of unavailable company data), *calculated*,
*simulated*, *measured* or *cited*. Simulated results are never presented as measured, and reference estimates are never
presented as company data.

**Data management.** Raw results are written by scripts to `thesis_modern/data/` and never edited by hand; tables and figures
are generated from them; the browser implementation reads a generated data file. Prediction records are append-only and
dated (the frozen design prediction P0 of case 1 was stored on 13 November 2026).

**Reproducibility.** All code uses the Python standard library only; every table and figure can be reproduced with one
command listed in `thesis_modern/README.md`; seeds are fixed; the third-party packages needed for the OPC UA and
MQTT measurements are installed offline from a locked set of wheels into a virtual environment (`thesis_modern/.venv`),
while all other code uses the Python standard library only; the Python reference and the browser implementation were
cross-checked number by number (Section 8.5).

## 3.6 Ethics, confidentiality and use of AI assistance

**Human subjects.** The research involves no experiments with people and no personal data. Field data of the case
factory are machine and production data; they will be anonymised (no prices, customers or employee data) before
publication, and their use will be agreed in writing with the company.

**Confidentiality.** Economic values in the thesis are reference estimates; real quotations, if used, will be reported
only in relative or anonymised form.

**Use of AI assistance.** A large language model (Claude, Anthropic) was used as a research assistant under the
direction of the author: to execute the literature search and pre-screen titles and abstracts against written criteria,
to extract data from full texts into a fixed form, to write and run the analysis, simulation and measurement code, and to
draft and edit text. All criteria, research questions, interpretations and conclusions are the author's responsibility;
AI-produced screening decisions, extractions, code results and text are verified by the author before submission. This
statement will be adapted to the rules of the university and of each journal, which must be checked before submission
(some institutions require a specific declaration form or restrict AI use in thesis writing).

## 3.7 Limitations of the methodology
1. **Simulated truth.** Controlled experiments generate the truth with the same model family as the twin; the field
   validation (Section 9.7) is required to remove this limitation.
2. **Emulated hardware.** The communication bench emulates the machines' OPC UA servers and PLC timing on one PC; the
   embedded OPC UA servers of real CNC controllers can behave differently (session limits, sampling rates, supported
   model parts), so the tests with the real machines (Chapter 5) are required.
3. **Reference data.** The cases use design data of this project and reference estimates for reliability and economics;
   the Roots blower extension (case 3) rests entirely on reference estimates because its product design does not exist
   yet; absolute values must be replaced by company data.
4. **Single-author evaluation with AI assistance.** Screening and extraction were not double-coded by a second human;
   the author's verification sample and, if possible, a second human reviewer are required (paper 1, Section 3.4).
5. **Literature coverage.** One database, open-access full texts only (Section 2.9.3).

## 3.8 Summary
The thesis follows design science research: it builds three artefacts for a practical problem — among them a
standard-based OPC UA / MQTT architecture measured against a Modbus TCP/HTTP baseline — and evaluates them in three
layers — analytical, controlled experimental and field — with explicit baselines, paired comparisons, sensitivity
analyses and a strict labelling of data. Two layers are complete; the field layer is specified in detail and its design
prediction already frozen. The use of AI assistance is declared and remains under the author's responsibility.

---
**References cited in this chapter**: Hevner, A.R., March, S.T., Park, J., Ram, S. (2004) Design science in information
systems research, *MIS Quarterly* 28(1), 75–105; Peffers, K., Tuunanen, T., Rothenberger, M.A., Chatterjee, S. (2007) A
design science research methodology for information systems research, *Journal of Management Information Systems* 24(3),
45–77; Law (2015); Page et al. (2021).
