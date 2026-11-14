# An Uncertainty-Aware, Low-Cost Digital Twin Method for the Stepwise Introduction of Flexible Manufacturing Systems in Emerging Industries

## Cases of Compressor and Ball Screw Production

Doctoral thesis submitted by **Kenzo** [full name]

[University] · [Faculty / Department] · [City, Country]

Supervisor: [name, title] · Co-supervisor: [name, title, if any]

[Month Year of submission]

---

## Declaration

I declare that this thesis is my own work, that it has not been submitted for any other degree, and that all sources are
acknowledged. The use of AI assistance is declared in Section 3.6. [Replace with the exact wording required by the
university.]

[Place, date] · [Signature]

---

## Abstract

Many manufacturers in emerging industries operate standalone CNC machine tools and are now moving to flexible
manufacturing systems (FMS). The move is large, largely irreversible and decided at a time when cycle times, failure and
repair behaviour, scrap and demand are uncertain; the technology available is often limited to Ethernet, Modbus TCP and
HTTP on offline computers. A systematic review of 28 studies showed that published manufacturing digital twins are mostly
simulation models with manual data exchange, that input uncertainty is rarely updated from real data and never with
Bayesian methods, that design-stage predictions are almost never validated after start-up, and that Modbus and the
transition from standalone CNC to FMS are absent.

This thesis develops and evaluates an uncertainty-aware, low-cost digital twin method for the stepwise introduction of
FMS, following design science research with analytical, controlled experimental and (planned) field evaluation. Four
contributions are made. (1) A Modbus-TCP-and-HTTP-only architecture with an event-preserving register block in every PLC
and closed-form sizing formulas lost none of 23 825 events in laboratory measurements with up to 160 machines, while
state-only polling missed 2–37 % of state changes. (2) A twin that translates design statements into conjugate priors,
updates failure, repair, cycle-time and scrap parameters sequentially with forgetting and learns its model discrepancy
reduced the monthly output prediction error in a virtual ramp-up with hidden true factories to 3.6 % with 94 % coverage of
its 90 % intervals (design model 12.0 %, one-time calibration 23.6 %) and identified the true bottleneck in 97–100 % of the
factories from month four. (3) Re-deciding staged investment options with the updated twin achieved the highest expected
net present value and the best downside with 44 % less capital than an all-at-once investment; two thirds of its advantage
over a fixed plan came from learning the machines. (4) Applied to two reference design cases, the method froze a design
prediction of 6 176 compressors per month for a compressor FMS, recommended robust first investment steps, and revealed two
tied bottlenecks in a ball screw shaft line that only operation can resolve; it is implemented without third-party
dependencies on one offline PC. Hypotheses on architecture and prediction accuracy are supported in the laboratory and in
simulation; honest uncertainty requires discrepancy learning; staged learning reduces downside but not early
under-capacity. A protocol for validation in the real ramp-up is defined, and the design prediction is already frozen.

**Keywords:** digital twin; flexible manufacturing system; ramp-up; Bayesian updating; model discrepancy; Modbus TCP;
staged investment; emerging economies; SMEs

## Abstract in [national language]

[To be written / translated by the candidate – required by most universities.]

---

## Acknowledgements

[To be written by the candidate.]

---

## Contents

1 Introduction · 2 State of the Art and Research Gap · 3 Research Methodology · 4 System Model and Problem Formulation ·
5 Low-Cost Digital Twin Architecture with Modbus TCP and HTTP · 6 Uncertainty-Aware Digital Twin with Sequential Bayesian
Updating · 7 Optimisation of the Stepwise FMS Introduction · 8 Implementation · 9 Industrial Application: Reference
Design Cases · 10 Discussion · 11 Conclusions · References · Appendices A–E

(Lists of figures and tables are generated during assembly.)

---

## Abbreviations

| Abbreviation | Meaning |
|---|---|
| AGV | automated guided vehicle |
| AS/RS | automated storage and retrieval system |
| B0, B1, P0, P1, P07, B0D, P07D | predictors of Chapter 6 (Section 6.4.3) |
| CNC | computer numerical control |
| CRN | common random numbers |
| CVaR | conditional value-at-risk |
| DES | discrete-event simulation |
| DSR | design science research |
| DT | digital twin |
| ERP | enterprise resource planning |
| FC03 | Modbus function code 03 (read holding registers) |
| FMS | flexible manufacturing system |
| HMC | horizontal machining centre |
| HTTP | Hypertext Transfer Protocol |
| MAPE | mean absolute percentage error |
| MES | manufacturing execution system |
| MTBF / MTTR | mean time between failures / mean time to repair |
| NIG | Normal-Inverse-Gamma (distribution) |
| NPV | net present value |
| OEE | overall equipment effectiveness |
| PI | prediction interval |
| PLC | programmable logic controller |
| PRISMA | Preferred Reporting Items for Systematic Reviews and Meta-Analyses |
| RTT | round-trip time |
| SLR | systematic literature review |
| SME | small and medium-sized enterprise |

## Main symbols

| Symbol | Meaning |
|---|---|
| $\lambda, \mu$ | failure rate, repair rate |
| $a, b$ | Gamma hyperparameters (shape, rate) |
| $m, \kappa, a, b$ | Normal-Inverse-Gamma hyperparameters |
| $q$ | scrap probability |
| $\rho$ | forgetting factor |
| $\boldsymbol{\theta}$ | vector of uncertain parameters |
| $E_k$ | absolute percentage error of period $k$ |
| $P, P_{eff}$ | polling period, effective polling period |
| $\eta$ | blocking efficiency of the screening model |
| $\beta$ | risk-aversion weight |

(Full notation: Section 4.2.)
