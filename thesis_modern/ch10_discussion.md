# Chapter 10 – Discussion

> Draft v2.0 (edition 2) – 2026-11-15.

## 10.1 Answers to the research questions

**RQ1 – interoperable, standard-based architecture.** The architecture that answers RQ1 has four parts: OPC UA servers
in the machines (or in edge gateways for legacy controllers) whose address spaces follow OPC 40001-1 and OPC 40501-1;
one aggregating edge client per machine that delivers state changes, alarms and job completions as OPC UA *events* and
only analogue values as sampled variables; an MQTT broker with Sparkplug B as the unified namespace, to which the twin,
the FMS control, the historian and the AGVs (VDA 5050) connect; and certificate-based security with a small, offline
public-key infrastructure. The analytical sizing of Section 9.2.4 gives an upper bound of less than 1 Mbit/s for the 21 devices of the case
factory at a 0.25 s sampling interval. The laboratory campaign of Section 5.8 confirmed H1 under three conditions —
state changes delivered as OPC UA events (or data changes with queues), MQTT QoS 1 or 2 with store-and-forward and a
counter-gap replay, and publishing interval plus processing time below 1 s: all 21 914 event-delivered state changes
arrived, every change survived a 5 s broker outage, the median end-to-end latency was 54 ms (maximum 127 ms) for 21
devices and stayed below 140 ms for 100 devices, and the gateway used about 1 % of one CPU core [measured, one PC,
emulated machines]. Data changes with queue size 1 lost 27 % of short states at a 1 s publishing interval, exactly as
the sampling model predicts. The measured wire load (248 B per device and second on the OPC UA leg) was lower than
Modbus polling with the event block at comparable latency, so the analytical figure is conservative; the price of
the standard stack lies in memory, start-up time and configuration effort, not in bandwidth. Compared with the minimal Modbus TCP/HTTP
architecture of edition 1 — which reached complete event delivery only through an event block that had to be programmed
into every PLC and documented register by register — the standard-based architecture moves the semantics into a
published model and the completeness into the protocol (events, sequence numbers), and pays for it with certificates,
model configuration and more computing resources.

**RQ2 – representing and updating uncertainty.** Design statements can be translated into conjugate priors with one
interpretable confidence parameter (the equivalent amount of data); sequential updates with a forgetting factor track the
ramp-up; and a learned model discrepancy absorbs the structural error of a stationary model applied to a changing system.
In the virtual ramp-up, this reduced the monthly output error to 3.6 % on average over months 2–12 (design model 12.0 %,
one-time calibration 23.6 %), with 94 % coverage of 90 % intervals, and identified the true bottleneck in 97–100 % of the
factories from month 4 (design model 73–77 %). The ball screw case confirmed the pattern on a structurally different line, and the Roots blower extension (case 3) on
a new product family that shares the FMS cell (P07D below 5 % from month 4, 85–100 % coverage from month 2).

**RQ3 – stepwise introduction.** Re-deciding the investment options every half-year with the updated twin gave the
highest expected value (+9.28 M EUR versus no investment, against 9.07 for all-at-once and 7.57 for a plan fixed at
design time), the best downside and 44 % less capital than all-at-once. About two thirds of its advantage over the fixed
plan came from learning the machines rather than the demand. For the Roots blower extension the same decision logic,
combined with the process-level model of the shared cell, chose a second load station with the nearest-rack rule as the
first step in all prior samples — not the test bench or rotor machine that the static loads of the new stations suggest.

## 10.2 Hypotheses

**Table 10.1** Status of the hypotheses.
| | Hypothesis | Result | Evidence | Status |
|---|---|---|---|---|
| H1 | OPC UA + MQTT: 100 % of state changes, latency < 1 s, 21 devices on one PC, no per-machine register mapping; price: more resources and configuration effort than Modbus TCP/HTTP | 100 % of state changes with OPC UA events and with MQTT QoS 1/2 + store-and-forward + replay (also through a 5 s broker outage); median 54 ms, max 127 ms (21 devices), ≤ 139 ms (100 devices); all V1.2 fields mapped to the information model; more memory, start-up time and configuration effort, but less bandwidth than Modbus polling | measured on the laboratory bench (emulated machines, Python stacks, one PC; Section 5.8); analytical sizing in Section 9.2.4 | **supported under conditions** (event-based delivery, QoS ≥ 1 with store-and-forward); real-machine check pending |
| H2 | < 5 % error with ≥ 30 % less data than B0 / B1 | B0 and B1 never reach 5 % in most scenarios; P07D in all scenarios from month 4, P07 from month 9 | simulated (30 + 20 + 20 factories) | **supported** in simulation; field validation pending |
| H3 | ≥ 85 % coverage of 90 % intervals | parametric twin 8.5 %; with discrepancy learning 94 % (91–100 % across prior weights; 100 % from month 4 in case 2; 85–100 % from month 2 in case 3) | simulated | **supported with discrepancy learning, rejected for the parametric twin alone** |
| H4 | higher E[NPV] and lower under-capacity risk than ALL and STATIC | E[NPV] higher than both; CVaR better; under-capacity better than STATIC, equal to ALL | simulated (40 factories) | **partly supported** |

The two partial results are informative rather than disappointing. H3 shows that parameter uncertainty alone does not make
a twin's uncertainty honest when the system changes faster than the twin's memory; the discrepancy term is a necessary
part of the method, not an optional refinement. H4 shows that staged, learning-based investment buys value and downside
protection with less capital, but cannot prevent short-term under-capacity that occurs before any data exist — the
first-stage decision still rests on the design.

## 10.3 Comparison with the literature

- *Integration level.* Kritzinger et al. (2018) found that digital twin literature concentrated on digital models and
  shadows; the systematic review of this thesis found the same seven years later (18 of 28 studies are digital models).
  The architecture of Chapter 5 provides the automatic physical-to-virtual flow of a digital shadow with open standards;
  the staging decisions close the loop in the virtual-to-physical direction at the investment level.
- *Validation of design predictions.* Konstantinov et al. (2022) report a 17 % design-stage cycle-time error for one
  station, reduced to 8.7 % by manual recalibration. The virtual ramp-up reproduces errors of this order for the design
  model (8–12 % in mature months) and shows that *sequential* rather than one-time recalibration is required: calibrating
  once early in ramp-up made predictions worse (−26 %).
- *Input uncertainty.* Masciarelli and Matta (2022) quantified input uncertainty once with bootstrapping and noted the
  computational cost of Bayesian approaches. Conjugate models avoid this cost — each update is a few additions — at the
  price of restricted distribution families; the forgetting factor and the discrepancy term compensate for non-stationarity
  and structural error.
- *Updating in operation.* Schumacher et al. (2024) and Fu et al. (2025) update input distributions of systems in
  operation. The method here starts earlier — from design priors — and evaluates the updated predictions against the
  truth, including their uncertainty, which those studies do not report.
- *Design and ramp-up twins.* Van Ginkel et al. (2025) and Kampa et al. (2026) apply twins to the design and
  commissioning of new systems qualitatively or deterministically. This thesis adds uncertainty, learning and a
  quantitative evaluation of prediction quality and decision value.
- *Data quality.* Bokrantz et al. (2017) identified filtered short stops and mean-only vendor data as typical problems.
  Event-based delivery of state changes addresses the first at the source; the conjugate priors with an explicit worth
  address the second.
- *Communication performance.* Burger et al. (2019) found that OPC UA servers suffer when more than about 20 clients hold
  sessions; the unified namespace keeps one session per machine regardless of the number of consumers. Profanter et al.
  (2019) and Silveira Rocha et al. (2018) compared OPC UA and MQTT on single links; Chapter 5 adds the completeness of
  state-change delivery at factory scale and a comparison with the minimal Modbus alternative.
- *Interoperability.* Martins et al. (2023) and Liu et al. (2019) showed that one OPC UA layer can integrate CNC machines
  of different brands. This thesis uses the standard machine models not only for monitoring but as the *vocabulary of the
  Bayesian twin*: the states of the FMS model (Section 4.3.1) are the states of OPC 40001-1, so that model and data agree
  by construction.
- *Unified namespace.* The peer-reviewed evidence on the UNS pattern is thin (Pintilie et al., 2025); the case factory
  and the measurements of Chapter 5 add a documented, offline instance for a complete FMS.

## 10.4 Theoretical implications

1. **Two kinds of model error must be separated during ramp-up.** Parameter error shrinks with data; structural error
   (a stationary model for a changing system) does not. Treating both as parameter uncertainty leads to over-confident
   twins (Chapter 6). This extends the calibration-with-discrepancy idea of Kennedy and O'Hagan (2001) to sequential,
   non-stationary production settings.
2. **Completeness is a property of the delivery mechanism, not of the protocol family.** Sampled OPC UA variables can
   miss short states just as Modbus polling does, while polling becomes complete with an event history in the PLC
   (edition 1). What a Bayesian twin needs is an *event* semantics with a sequence or counter that reveals losses —
   provided by OPC UA events and Sparkplug sequence numbers in this edition. Latency is then bounded by the sampling and
   publishing intervals, which closed-form formulas describe.
3. **The value of a digital twin in capacity investment lies in learning the capacity effect.** Classical capacity
   expansion treats demand as uncertain and investment effects as known; in the transition to an FMS the reverse
   uncertainty dominates, and learning it was worth about two thirds of the advantage of adaptive planning.

## 10.5 Practical implications

For companies moving from standalone CNC machines to an FMS: (1) express design values with their confidence and freeze
the design prediction before start of production; (2) specify the data interface in every machine purchase order — for
the standard-based architecture an OPC UA server implementing OPC 40001-1 (and OPC 40501-1 for machine tools) with
events for state changes, alarms and job completion, the number of sessions and monitored items it must support, and
certificate-based security; for the minimal architecture the register map and event block — it makes every later
analysis possible; (3) update the twin monthly with a forgetting
factor during ramp-up and learn its discrepancy; never calibrate once and freeze; (4) decide investments in stages and
re-decide with the updated twin; invest first where the design is tight (in the case: final assembly and assembly
capacity); (5) give every machine a single session to an aggregating edge client and let all consumers use the unified
namespace instead of opening their own sessions; (6) Model the flexible cell as a closed network
of load station, transport and machines before buying machines: in the case, one operator at the load station bounds the
crankcase cell at 24.5 parts per hour, so a second load station is worth more than a fourth HMC (Section 9.2.5). When a new product family is to share the
cell, model one closed chain per fixture type: in case 3 the static loads (at most 89 %) hid that the shared cell would
become the factory bottleneck and lose 16 % of the compressor output (Section 9.4.3).
(7) Build the supervisory control on the same open interface as the twin and commission it against a virtual plant
first; the same acceptance checks then serve as the factory acceptance test of every supplier interface (Section 8.9).
(8) Treat certificates as part of commissioning: one offline certificate authority, a renewal plan and a written list of
trusted applications.

**When to choose which architecture.** The measured comparison of Chapter 5 and the analysis of this thesis lead to the
decision guide of Table 10.2. It is a qualitative synthesis; the thresholds are indicative [assumption], and the
measured resource and effort figures of Chapter 5 should be used to refine them for a given plant.

**Table 10.2** Decision guide: standard-based (OPC UA + MQTT/Sparkplug B) versus minimal (Modbus TCP + HTTP) architecture [assumption; synthesis].
| Criterion | Prefer Modbus TCP + HTTP when … | Prefer OPC UA + MQTT/Sparkplug B when … |
|---|---|---|
| Plant size and growth | few machines (up to about 10–20), stable layout, no planned expansion | 20 machines or more, or a stepwise introduction that adds machines and suppliers over years |
| Machine age and available interfaces | mostly legacy controllers without OPC UA; PLCs with Modbus servers only | new CNC machines and PLCs with OPC UA servers (ideally OPC 40001-1 / 40501-1); legacy machines few enough for edge gateways |
| Number of consumers | one twin, one control system | several consumers (twin, FMS control, MES, historian, dashboards, AGV master) that would otherwise each poll every machine |
| Skills | staff can program PLCs but not manage certificates, information models or brokers | at least one engineer trained in OPC UA modelling, MQTT and basic PKI, or a supplier who provides it |
| Security requirements | isolated network, physical access control, no regulatory or customer demands | export customers, audits or IEC 62443 requirements; networks shared with office IT; remote service planned |
| Budget | very small; every licence and training day counts | the interface is specified in machine purchase orders, so the extra cost per machine is small compared with the machine; open-source broker and stacks avoid licence fees |
| Semantics and reuse | signals are few and documented once | many signal types; reuse of the same model across machines, lines and factories is valuable |
| Supplier interfaces (AGV, AS/RS) | one supplier delivers the complete logistics system | AGVs of several makers (VDA 5050) or a fleet that will grow |

The two architectures are not exclusive: a plant can start with Modbus TCP and HTTP and an event block in each PLC, as in
edition 1, and introduce an MQTT broker with a unified namespace and edge gateways that translate the register maps into
OPC UA models when the plant grows — a stepwise introduction of the communication system that mirrors the stepwise
introduction of the FMS itself.

## 10.6 Generalisability

The method's components are generic: the conjugate models apply to any station with failures, repairs, cycle times and
scrap; the architecture to any machine with an OPC UA server or an edge gateway that provides one, and to any information
model expressed as an OPC UA companion specification; the staging rule to any set of discrete options. The three
cases differ in product variety, process structure and bottleneck pattern, and the main findings held in all of them:
case 2 is a single-product line with heat treatment and a dominant precision operation, case 3 a new product family that
shares the flexible cell with the first. Case 3 adds a form of generalisability that matters for growing companies:
the same twin, priors and decision rule serve a product-family extension without new software — the new family enters as
data (routing, priors, fixture type) — while the analysis exposes the coupling that a separate study of the new family
would miss, namely the shared cell. Its limits are that case 3 is not independent of case 1 and rests only on reference
estimates. Transfer
to systems with strongly non-exponential failure behaviour, many interacting variants or complex material flow (e.g.
job shops with re-entrant routing) requires the extensions listed in Section 10.8.

## 10.7 Limitations

The limitations are reported where they arise and are consolidated here: (1) the controlled experiments generate the
truth with the twin's model family and an assumed ramp-up shape; (2) the communication bench emulates the machines' OPC UA servers on one PC, while embedded servers in real
controllers may limit sessions, sampling rates and the implemented parts of the companion specifications; (3) case data are design data and reference estimates (case 3 entirely); (4) the reduced-order DES omits pallets, AGVs
and dispatching in the Monte Carlo experiments; (5) the staging rule is a heuristic that ignores later flexibility and
values options only through output; (6) the literature review covers one database and open-access full texts; (7)
screening, extraction, code and drafting were AI-assisted under the author's verification. Limitations (1)–(3) are removed
by the planned field validation; (4)–(5) by the extensions below; (6) by a subscription-database update before
submission.

## 10.8 Future research
- Field validation in the case factory (Section 9.7), later also of the Roots blower extension and tests with the real machines' OPC UA servers (Chapter 5).
- Measurement of the configuration effort of the standard-based architecture with real suppliers over several machine
  purchases, and of the long-term cost of certificate management in an SME.
- Asset Administration Shell submodels for the twin's priors and posteriors, so that design statements and learned
  machine behaviour can be exchanged with suppliers in a standard form.
- Explicit learning-curve models in the parameters (Section 4.6.5) to reduce the discrepancy term's over-correction after
  ramp-up.
- Hierarchical priors that share information between machines of the same type and between factories (data from
  several design instances, as suggested by van Beek et al., 2022).
- Non-conjugate failure models (Weibull) with fast approximate inference for wear-out behaviour.
- Approximate dynamic programming or real-options valuation of the staging decision with explicit value of flexibility,
  and inclusion of labour, energy and quality costs.
- Extension to job-shop and re-entrant systems, and to the full twin with pallets, AGVs and dispatching in the Monte
  Carlo loop; a multi-chain model of the shared cell whose kit and load-station times are updated with the same
  conjugate models, so that the twin also learns the process-level capacity of the cell (case 3).
