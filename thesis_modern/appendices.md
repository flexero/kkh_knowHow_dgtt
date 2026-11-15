# Appendices

## Appendix A – Information-model mapping and baseline register map

The standard-based architecture of Chapter 5 replaces the hand-made register map of edition 1 by standard information
models. A.1 lists, for every observation used by the Bayesian twin (Table 4.5) and the FMS control, the node of the
machine's OPC UA address space and the Sparkplug B metric under which the edge client publishes it in the unified
namespace. Node names follow OPC 40001-1 and OPC 40501-1; exact browse paths depend on the release implemented by each
machine and are fixed in Chapter 5, which governs where the two differ [verify against the release used]. A.3–A.6 keep
the register map and event block of edition 1, which serve as the measured baseline.

**A.1 Observations of the twin and their sources in the information model.**
| Observation (Table 4.5) | OPC UA source node (machine server) | Delivery | Sparkplug B metric (DDATA) |
|---|---|---|---|
| machine state (*processing*, *idle*, *blocked*, *down*, *setup*) | `MachineryBuildingBlocks/MachineryItemState/CurrentState` and `MachineryOperationMode/CurrentState` (OPC 40001-1); for machine tools also `Monitoring/Channel/ChannelState` (OPC 40501-1) | event on every transition (time stamp of the source) | `state`, `mode` |
| failure with error code | notification / alarm events (`Notification/Messages`, OPC 40501-1; alarms and conditions, IEC 62541-9) | event | `alarm/code`, `alarm/active` |
| cycle completion and cycle time | production job / program state (`Production/ProductionPlan/<job>`, `Production/ActiveProgram/State`, OPC 40501-1) | event on completion; cycle time computed from time stamps | `job/id`, `job/cycle_time` |
| good and scrap parts | part counters of the production job (`RunsCompleted`, part quality, OPC 40501-1); `OperationCounters` (OPC 40001-1) | sampled variable, change only | `count/good`, `count/scrap` |
| identification | `Identification` (manufacturer, model, serial number; OPC 40001-1) | read once at connection; in DBIRTH | DBIRTH properties |
| analogue values (spindle load, power, override) | `Monitoring/Spindle`, `Monitoring/MachineTool` (OPC 40501-1); energy as vendor extension | sampled variable, 1 s, deadband | `proc/<name>` |
| job start, confirmation (FMS control) | methods of the machine object (vendor or job-management methods) | method call, result returned | DCMD (`cmd/start_job`) for consumers of the UNS |
| AGV order and state | VDA 5050 topics `order`, `state`, `instantActions`, `connection` | MQTT (JSON) | not Sparkplug; same broker |

**A.2 Unified namespace (topic structure).** Machine data: `spBv1.0/<plant>/<NBIRTH|NDATA|NDEATH|DBIRTH|DDATA|DDEATH|NCMD|DCMD>/<edge node = cell or area>/<device = machine>`;
AGVs: `<interface>/<major version>/<manufacturer>/<serial number>/<topic>` as defined by VDA 5050; twin results (predictions,
posteriors) are published by the twin under its own Sparkplug edge node so that the MES and dashboards can read them from
the same broker.

**A.3 Baseline: register groups of the standard machine interface (edition 1, map V1.1, 227 holding registers, factory design guides 43 / 47).**
| Group | Registers | Content | Poll period |
|---|---|---|---|
| FAST | 0–11 | map version, type code, unit id, heartbeat, status word, mode, state, alarm, handshake status, acknowledge sequence, result, lot done | 500 ms (100 ms during a command) |
| COUNTERS + PROCESS | 20–99 | good and scrap (UINT32), last cycle time (REAL), order, part (ASCII 20), process values | 1 s |
| ENERGY | 100–103 | power kW, energy kWh (REAL) | 10 s |
| COMMAND | 200–225 | MES order data with toggle-bit handshake | on demand |
| GATEWAY HEARTBEAT | 226 | written by the gateway every second; PLC watchdog 5 s | 1 s |

**A.4 Baseline: event block (edition 1, proposed map V1.2, registers 104–131).**
| Offset | Content | Type |
|---|---|---|
| 0–1 | change counter since power-on | UINT32 |
| 2–3 | time of last change [ms, PLC clock] | UINT32 |
| 4–27 | ring buffer, 8 × (new state; time high word; time low word), newest first | 8 × (UINT16 + UINT32) |

**A.5 Baseline: PLC logic of the event block (structured text, schematic).**
```
IF state <> state_prev THEN
    change_counter := change_counter + 1;
    t_last := CLOCK_MS();                       (* PLC millisecond clock, synchronised hourly by the gateway *)
    idx := change_counter MOD 8;
    ring_state[idx] := state;  ring_time[idx] := t_last;
    state_prev := state;
END_IF;
(* copy counter, t_last and the ring (newest first) into holding registers 104–131 every scan *)
```

**A.6 Baseline: gateway logic.** Δ = counter − counter_prev; if Δ = 0: no event; if 1 ≤ Δ ≤ 8: read the newest Δ ring entries and emit
events with PLC time stamps in chronological order; if Δ > 8: emit the 8 newest and flag "Δ − 8 events lost" with the
interval; counter wrap-around handled modulo 2³².

## Appendix B – Derivations of the conjugate updates

**B.1 Gamma–Poisson.** Likelihood of $n$ failures in uptime $T$: $p(n\mid\lambda) \propto \lambda^n e^{-\lambda T}$. Prior
$p(\lambda) \propto \lambda^{a-1} e^{-b\lambda}$. Posterior $\propto \lambda^{a+n-1} e^{-(b+T)\lambda}$, i.e. Gamma$(a+n, b+T)$.
For $X = 1/\lambda$ with $\lambda \sim$ Gamma$(a, b)$: $X \sim$ Inv-Gamma$(a, b)$ and $\mathbb{E}[X] = b/(a-1)$ for $a > 1$.
With $b = T_0$ and $a = 1 + T_0/\mathrm{MTBF}_0$ the prior mean of MTBF equals MTBF$_0$.

**B.2 Gamma–exponential.** Likelihood of repair times $r_1..r_k$: $\prod \mu e^{-\mu r_i} = \mu^k e^{-\mu \sum r_i}$; with a
Gamma$(a, b)$ prior the posterior is Gamma$(a + k, b + \sum r_i)$; $\mathbb{E}[\mathrm{MTTR}] = (b + \sum r_i)/(a + k - 1)$.

**B.3 Normal-Inverse-Gamma.** For $y_i = \ln t_i \sim \mathcal{N}(m, \sigma^2)$ the likelihood is
$\propto \sigma^{-n} \exp\{-[S + n(\bar y - m)^2]/(2\sigma^2)\}$. With prior $\sigma^2 \sim$ Inv-Gamma$(a_0, b_0)$,
$m\mid\sigma^2 \sim \mathcal{N}(m_0, \sigma^2/\kappa_0)$, completing the square in $m$ gives
$\kappa_0(m - m_0)^2 + n(\bar y - m)^2 = \kappa_n (m - m_n)^2 + \frac{\kappa_0 n}{\kappa_n}(\bar y - m_0)^2$ with
$\kappa_n = \kappa_0 + n$, $m_n = (\kappa_0 m_0 + n\bar y)/\kappa_n$; collecting the powers of $\sigma^2$ gives $a_n = a_0 + n/2$ and
$b_n = b_0 + S/2 + \kappa_0 n (\bar y - m_0)^2/(2\kappa_n)$ (Eq. 4.9).

**B.4 Beta–binomial.** $p(x\mid q) \propto q^x (1-q)^{n-x}$; Beta$(a, b)$ prior → Beta$(a + x, b + n - x)$.

**B.5 Forgetting.** Raising the prior to the power $\rho$ (power prior; Ibrahim and Chen, 2000) multiplies the
hyperparameters that count data (shape and rate of the Gamma, $\kappa$, $a$, $b$ of the NIG, both Beta parameters) by $\rho$
before the new data are added (Eq. 4.11).

## Appendix C – Algorithms and code index

| Algorithm / formula | Thesis | File and function |
|---|---|---|
| Static capacity, Eq. 4.1–4.2 | 4.4 | `thesis_modern/code/bayes.py` – `station_capacity` |
| Conjugate models, Eq. 4.5–4.11 | 4.6 | `bayes.py` – `FailureRate`, `RepairTime`, `CycleTime`, `ScrapRate` |
| Worked examples 4.1–4.5 | 4.6 | `bayes.py` – `chapter4_examples` |
| Departure-time recursion DES, Eq. 6.2 | 6.4.1 | `flowline.py` – `simulate` |
| Welford accumulator, Algorithm 6.1 | 6.3.1 | twin data collection; `flowline.py` records the same statistics |
| Sequential update + prediction, Algorithms 6.2–6.3 | 6.3 | `rampup_experiment.py` – `StationBelief`, `predict_bayes` |
| Model discrepancy, Eq. 6.1 | 6.3.4 | `discrepancy.py` – `add_discrepancy` |
| Load estimate of the OPC UA / MQTT data path | 9.2.4 | formulas in Section 9.2.4 (hand calculation) |
| Sizing formulas of the Modbus baseline | 5 | `case_study.py` – `sizing`; `web/phd_calc.js` |
| OPC UA / MQTT measurement bench | 5 | see Chapter 5 and `thesis_modern/README.md` |
| Modbus laboratory bench (baseline) | 5 | `commbench.py` |
| Screening model, Eq. 7.3 | 7.3.3 | `staging.py` – `screen_th`, `calibrate_eta`, `validate_screen` |
| Rolling-horizon rule, Eq. 7.2 | 7.3.1 | `staging.py` – `decide` |
| Reference cases 1 and 2 | 9.2, 9.3 | `case_study.py` |
| Case 3: static load, multi-chain MVA of the shared cell (Eqs. 9.1–9.3), Roots line, P0, transfer test, screening | 9.4 | `case3_roots.py` – `shared_load`, `mva_multi`, `modelB_multi`, `best_allocation`, `roots_line`, `frozen_P0`, `roots_scenario`, `staging_screen` |
| Browser implementation | 8.5 | `web/phd.js`, `web/phd_calc.js` |

## Appendix D – Experiment settings

| Experiment | Scenarios / runs | Key settings | Seeds |
|---|---|---|---|
| Virtual ramp-up (Ch. 6) | 30 factories × 12 months × 5 predictors (+2 post hoc); prior weight 0.25 / 1 / 4 | $N_\theta$ = 40, R = 1 (Bayes), 20 replications (point), 330 h/month, buffers 4 | scenario $s$: truth seed 10 000 + $s$, run seed $s$ |
| Bottleneck identification (Ch. 6) | 30 × 12 | posterior means, Eq. 4.2 | as above |
| Variance decomposition (Ch. 6) | 10 factories, months 1, 2, 4, 8, 12 | $N_\theta$ = 40, R = 3 | 500 + $s$ |
| OPC UA / MQTT campaign (Ch. 5) | see Chapter 5 | 21 devices and scaled plants, T = 0.25–1 s, sampled vs event delivery, security on / off | see Chapter 5 |
| Modbus baseline campaign (Ch. 5, edition 1) | 15 runs × 60 s | N = 10–160, P = 0.1–1 s, scan 0 / 10 / 20 ms, sequential / parallel | machine process seed 1 |
| HTTP bench (Ch. 5, baseline) | 6 configurations × 10 s | 160-machine snapshot, 1 / 4 / 16 clients | 1 |
| Staging (Ch. 7) | 40 factories × 6 policies; β = 0 / 0.5 | 4 stages × 6 months, 3 replications per stage (CRN), $N_\theta$ = 60 | truth 20 000 + $s$, stage streams 100 $s$ + stage |
| Case 2 transfer (Ch. 9) | 20 factories × 12 months | $N_\theta$ = 30, 312.5 h/month | truth 30 000 + $s$ |
| Case 3 P0 and transfer (Ch. 9) | P0: 400 samples; transfer: 20 factories × 12 months | $N_\theta$ = 30, 330 h/month, buffers 4, flow-equivalent cell 1.559 kits / h | P0 2027; truth 40 000 + $s$, run seed $s$ |
| Case 3 investment screening (Ch. 9) | 4 options, 4 stages; 40 prior samples | budget 400 000 EUR / stage, 12 pallets, blowers served first | 77 |

## Appendix E – Case data sheets

**E.1 Case 1** – station data: Table 4.2; options and costs: Table 7.1; economics: Section 7.2.3; frozen prediction:
`thesis_modern/data/case1_P0.json` (Table 9.2).

**E.2 Case 2** – route BS variant G with machine counts and reference reliability: Table 9.7; source of route data:
`web/bsfmfg_data.js` (ball screw factory design); plant: 120 shafts per day, 2 shifts × 7.5 h, 250 days, heat treatment 3
shifts, OEE 0.75 for machine sizing.

**E.3 Case 3** – Roots blower family and demand: Table 9.9; routing, cycle times, machine counts and reference
reliability: Table 9.10; shared stations: Table 4.2 (full FMS of case 1, all options of Table 7.1); cell data:
Section 9.2.5 (load station 147 s per crankcase, shuttle 70 s per cycle, move rule 12 s + 2 s per location);
investment options: Table 9.15; all values [reference estimate]; data: `thesis_modern/data/case3_roots.json`,
`case3_P0.json` (Table 9.13), `case3_rampup.csv` (Table 9.14).

All data sets: `thesis_modern/data/`; generation commands: `thesis_modern/README.md`.
