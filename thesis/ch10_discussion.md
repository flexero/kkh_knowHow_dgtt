# Chapter 10 – Discussion

> Draft v1.0 – 2026-11-14.

## 10.1 Answers to the research questions

**RQ1 – architecture with Modbus TCP and HTTP only.** A reliable FMS twin can be built with these technologies if three
conditions are met: a single gateway is the only Modbus client and all other systems use its HTTP API; every PLC carries
the same register map plus an event block (change counter, last-change time stamp, 8-entry ring); and the gateway polls
in parallel or is sized with Eq. (5.4). Under these conditions the laboratory campaign recovered all 23 825 events of 15
runs with up to 160 machines, with maximum detection latencies of 0.26–0.30 s at a 0.25 s period; the limits are set by
the PLC response time (sequential gateways: $N_{max} = P/(k\,\mathbb{E}[\mathrm{RTT}])$), not by bandwidth (2.1 Mbit/s for 160
machines) or by the HTTP side (≈ 4 500 full snapshots per second).

**RQ2 – representing and updating uncertainty.** Design statements can be translated into conjugate priors with one
interpretable confidence parameter (the equivalent amount of data); sequential updates with a forgetting factor track the
ramp-up; and a learned model discrepancy absorbs the structural error of a stationary model applied to a changing system.
In the virtual ramp-up, this reduced the monthly output error to 3.6 % on average over months 2–12 (design model 12.0 %,
one-time calibration 23.6 %), with 94 % coverage of 90 % intervals, and identified the true bottleneck in 97–100 % of the
factories from month 4 (design model 73–77 %). The ball screw case confirmed the pattern on a structurally different line.

**RQ3 – stepwise introduction.** Re-deciding the investment options every half-year with the updated twin gave the
highest expected value (+9.28 M EUR versus no investment, against 9.07 for all-at-once and 7.57 for a plan fixed at
design time), the best downside and 44 % less capital than all-at-once. About two thirds of its advantage over the fixed
plan came from learning the machines rather than the demand.

## 10.2 Hypotheses

**Table 10.1** Status of the hypotheses.
| | Hypothesis | Result | Evidence | Status |
|---|---|---|---|---|
| H1 | ≥ 40 machines, latency ≤ 1 s, loss ≤ 0.1 % | 0 % loss up to 160 machines; max latency 0.26–0.30 s at P = 0.25 s; at P = 1 s the max exceeds 1 s by the RTT | measured, emulated PLC timing | **supported**, with design rules (event block; parallel polling or Eq. 5.4); real-PLC check pending |
| H2 | < 5 % error with ≥ 30 % less data than B0 / B1 | B0 and B1 never reach 5 % in most scenarios; P07D in all scenarios from month 4, P07 from month 9 | simulated (30 + 20 factories) | **supported** in simulation; field validation pending |
| H3 | ≥ 85 % coverage of 90 % intervals | parametric twin 8.5 %; with discrepancy learning 94 % (91–100 % across prior weights; 100 % from month 4 in case 2) | simulated | **supported with discrepancy learning, rejected for the parametric twin alone** |
| H4 | higher E[NPV] and lower under-capacity risk than ALL and STATIC | E[NPV] higher than both; CVaR better; under-capacity better than STATIC, equal to ALL | simulated (40 factories) | **partly supported** |

The two partial results are informative rather than disappointing. H3 shows that parameter uncertainty alone does not make
a twin's uncertainty honest when the system changes faster than the twin's memory; the discrepancy term is a necessary
part of the method, not an optional refinement. H4 shows that staged, learning-based investment buys value and downside
protection with less capital, but cannot prevent short-term under-capacity that occurs before any data exist — the
first-stage decision still rests on the design.

## 10.3 Comparison with the literature

- *Integration level.* Kritzinger et al. (2018) found that digital twin literature concentrated on digital models and
  shadows; the systematic review of this thesis found the same seven years later (18 of 28 studies are digital models).
  The architecture of Chapter 5 provides the automatic physical-to-virtual flow of a digital shadow with low-cost means;
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
  The event block addresses the first at the source; the conjugate priors with an explicit worth address the second.

## 10.4 Theoretical implications

1. **Two kinds of model error must be separated during ramp-up.** Parameter error shrinks with data; structural error
   (a stationary model for a changing system) does not. Treating both as parameter uncertainty leads to over-confident
   twins (Chapter 6). This extends the calibration-with-discrepancy idea of Kennedy and O'Hagan (2001) to sequential,
   non-stationary production settings.
2. **Polling can be event-complete.** The supposed inferiority of request-response protocols for digital twins rests on
   sampling; moving a small event history into the PLC makes polling complete with negligible cost. The design trade-off
   is then latency versus load, which closed-form formulas describe accurately.
3. **The value of a digital twin in capacity investment lies in learning the capacity effect.** Classical capacity
   expansion treats demand as uncertain and investment effects as known; in the transition to an FMS the reverse
   uncertainty dominates, and learning it was worth about two thirds of the advantage of adaptive planning.

## 10.5 Practical implications

For companies moving from standalone CNC machines to an FMS: (1) express design values with their confidence and freeze
the design prediction before start of production; (2) specify the register map and event block in every machine purchase
order — it costs a few PLC lines and makes every later analysis possible; (3) update the twin monthly with a forgetting
factor during ramp-up and learn its discrepancy; never calibrate once and freeze; (4) decide investments in stages and
re-decide with the updated twin; invest first where the design is tight (in the case: final assembly and assembly
capacity); (5) use parallel polling for more than about 40 machines at sub-second periods. (6) Model the flexible cell as a closed network
of load station, transport and machines before buying machines: in the case, one operator at the load station bounds the
crankcase cell at 24.5 parts per hour, so a second load station is worth more than a fourth HMC (Section 9.2.5).
(7) Build the supervisory control on the same open interface as the twin and commission it against a virtual plant
first; the same acceptance checks then serve as the factory acceptance test of every supplier PLC (Section 8.9).

## 10.6 Generalisability

The method's components are generic: the conjugate models apply to any station with failures, repairs, cycle times and
scrap; the architecture to any PLC with a Modbus TCP server; the staging rule to any set of discrete options. The two
cases differ in product variety, process structure and bottleneck pattern, and the main findings held in both. Transfer
to systems with strongly non-exponential failure behaviour, many interacting variants or complex material flow (e.g.
job shops with re-entrant routing) requires the extensions listed in Section 10.8.

## 10.7 Limitations

The limitations are reported where they arise and are consolidated here: (1) the controlled experiments generate the
truth with the twin's model family and an assumed ramp-up shape; (2) the communication bench emulates PLC timing on a
loopback network; (3) case data are design data and reference estimates; (4) the reduced-order DES omits pallets, AGVs
and dispatching in the Monte Carlo experiments; (5) the staging rule is a heuristic that ignores later flexibility and
values options only through output; (6) the literature review covers one database and open-access full texts; (7)
screening, extraction, code and drafting were AI-assisted under the author's verification. Limitations (1)–(3) are removed
by the planned field validation; (4)–(5) by the extensions below; (6) by a subscription-database update before
submission.

## 10.8 Future research
- Field validation in the case factory (Section 9.6) and real-PLC tests (Section 5.8).
- Explicit learning-curve models in the parameters (Section 4.6.5) to reduce the discrepancy term's over-correction after
  ramp-up.
- Hierarchical priors that share information between machines of the same type and between factories (data from
  several design instances, as suggested by van Beek et al., 2022).
- Non-conjugate failure models (Weibull) with fast approximate inference for wear-out behaviour.
- Approximate dynamic programming or real-options valuation of the staging decision with explicit value of flexibility,
  and inclusion of labour, energy and quality costs.
- Extension to job-shop and re-entrant systems, and to the full twin with pallets, AGVs and dispatching in the Monte
  Carlo loop.
