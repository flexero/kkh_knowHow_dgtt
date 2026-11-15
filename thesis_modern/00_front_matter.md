# An Uncertainty-Aware Digital Twin Method with Interoperable OPC UA / MQTT Communication for the Stepwise Introduction of Flexible Manufacturing Systems in Emerging Industries

## Cases of Compressor, Ball Screw and Roots Blower Production – Second Edition: Standard-Based Industrial Communication

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
manufacturing systems (FMS). The move is large, irreversible and decided while cycle times, failures, scrap and
demand are uncertain. A systematic review of 28 studies showed that published manufacturing digital
twins are mostly simulation models with manual data exchange, that input uncertainty is rarely updated from real data and
never with Bayesian methods, that design-stage predictions are almost never validated after start-up, and that measured,
standard-based data paths for small firms in the transition from standalone CNC machines to an FMS are missing.

This thesis develops and evaluates an uncertainty-aware digital twin method with interoperable communication for the
stepwise introduction of FMS, following design science research. Four contributions are made. (1) An offline architecture built on open standards — OPC UA servers with
information models following OPC UA for Machinery and for Machine Tools, subscriptions, events and methods; an MQTT broker
with Sparkplug B as unified namespace; VDA 5050 for the AGVs; certificate-based security — is mapped to the 21-device case
factory and measured against a minimal Modbus TCP/HTTP baseline. On a laboratory bench with emulated machines it delivered 100 % of 21 914 state changes as OPC UA events and every change through a 5 s broker outage with MQTT QoS 1/2, store-and-forward and counter-gap replay, with a median end-to-end latency of 54 ms (maximum 127 ms) for 21 devices and below 140 ms for 100 devices, at about 1 % of one CPU core; sampled data changes with queue size 1 missed up to 27 % of short states, so H1 is supported only with event-based delivery. (2) A twin that translates design statements into conjugate priors, updates failure, repair, cycle-time and
scrap parameters sequentially with forgetting and learns its model discrepancy reduced the monthly output prediction error
in a virtual ramp-up with hidden true factories to 3.6 % with 94 % coverage of its 90 % intervals (design model 12.0 %,
one-time calibration 23.6 %) and identified the true bottleneck in 97–100 % of the factories from month four. (3)
Re-deciding staged investment options with the updated twin achieved the highest expected net present value and the best
downside with 44 % less capital than an all-at-once investment. (4) Applied to three reference design cases, the method froze a design prediction of 6 176 compressors per month
for a compressor FMS, recommended robust first investment steps and revealed two tied bottlenecks in a ball screw shaft
line; for a Roots blower family sharing the FMS cell it showed that the cell becomes the factory bottleneck and that a
second load station is the first investment step, and the twin transferred again. A protocol for validation in the real ramp-up is
defined.

**Keywords:** digital twin; flexible manufacturing system; OPC UA; MQTT; Sparkplug B; unified namespace;
interoperability; Bayesian updating; model discrepancy; staged investment; emerging economies; SMEs

## Abstract in [national language]

[To be written / translated by the candidate – required by most universities.]

---

## Note on the two editions

This thesis exists in two editions that share the same research method, the same Bayesian twin (Chapters 4 and 6), the
same staging optimisation (Chapter 7) and the same reference design cases (Chapter 9). They differ in the communication
technology of the factory. **Edition 1** assumes a minimal technology base — Ethernet, Modbus TCP and HTTP only — and
contributes an event-preserving register block for polling. **Edition 2 (this document)** assumes that the company adopts
open industrial communication standards — OPC UA with standard information models, MQTT with Sparkplug B as a unified
namespace, VDA 5050 for the AGVs and certificate-based security, still offline without cloud services — and keeps the
Modbus TCP/HTTP architecture as the measured baseline. The candidate and the supervisor choose which edition is defended.
The text overlap between the editions is intended; if both editions are made public, the overlap must be declared in each.

---

## Acknowledgements

[To be written by the candidate.]

---

## Contents

1 Introduction · 2 State of the Art and Research Gap · 3 Research Methodology · 4 System Model and Problem Formulation ·
5 Interoperable Digital Twin Architecture with OPC UA and MQTT · 6 Uncertainty-Aware Digital Twin with Sequential Bayesian
Updating · 7 Optimisation of the Stepwise FMS Introduction · 8 Implementation · 9 Industrial Application: Reference
Design Cases · 10 Discussion · 11 Conclusions · References · Appendices A–E

(Lists of figures and tables are generated during assembly.)

---

## Abbreviations

| Abbreviation | Meaning |
|---|---|
| AAS | Asset Administration Shell (IEC 63278) |
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
| DDATA / NDATA | Sparkplug B device / edge-node data message |
| DBIRTH / NBIRTH | Sparkplug B device / edge-node birth certificate (metric definitions) |
| FC03 | Modbus function code 03 (read holding registers; baseline architecture) |
| FMS | flexible manufacturing system |
| HMC | horizontal machining centre |
| GDS | Global Discovery Server (OPC UA certificate and discovery management) |
| HTTP | Hypertext Transfer Protocol |
| IIoT | industrial Internet of Things |
| IPC | industrial PC |
| MAPE | mean absolute percentage error |
| MES | manufacturing execution system |
| MQTT | Message Queuing Telemetry Transport (ISO/IEC 20922; OASIS MQTT 5.0) |
| MTBF / MTTR | mean time between failures / mean time to repair |
| MVA | mean value analysis (closed queueing networks) |
| MTConnect | open machine-tool data standard (ANSI/MTC1) |
| NIG | Normal-Inverse-Gamma (distribution) |
| NPV | net present value |
| OEE | overall equipment effectiveness |
| OPC UA | OPC Unified Architecture (IEC 62541) |
| OPC 40001-1 / 40501-1 | OPC UA for Machinery – Basic Building Blocks / OPC UA for Machine Tools – Monitoring and Job Management |
| PI | prediction interval |
| PKI | public key infrastructure |
| PLC | programmable logic controller |
| PubSub | publish–subscribe (OPC UA Part 14) |
| PRISMA | Preferred Reporting Items for Systematic Reviews and Meta-Analyses |
| QoS | quality of service (MQTT delivery levels 0, 1, 2) |
| RTT | round-trip time |
| SLR | systematic literature review |
| SME | small and medium-sized enterprise |
| TLS | Transport Layer Security |
| TSN | Time-Sensitive Networking (IEEE 802.1) |
| UADP | UA Datagram Protocol (binary OPC UA PubSub encoding) |
| UNS | unified namespace |
| VDA 5050 | interface for communication between AGVs and a master control (VDA/VDMA) |
| X.509 | standard format of public-key certificates |

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
| $P, P_{eff}$ | polling period, effective polling period (Modbus baseline) |
| $T_s, T_p$ | sampling interval, publishing interval of an OPC UA subscription |
| $\eta$ | blocking efficiency of the screening model |
| $\beta$ | risk-aversion weight |

(Full notation: Section 4.2.)
