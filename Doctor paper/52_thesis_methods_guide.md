# 52 – Thesis methods in plain English: capacity, Bayesian updating, virtual ramp-up, Modbus sizing

> Tab **Doctoral research** (`#phd`), items 2–6. This guide explains, without academic language, the methods of thesis
> chapters 4 to 9. The thesis chapters (`thesis/ch0*.md`) are written for
> examiners; this guide is written for **you** – to understand, explain to your supervisor and use in the real factory.
> Station values are **example design values** of the twin; simulation results are **simulated**; Modbus results are
> **measured on a lab PC with emulated PLCs**.

## Contents
1. Purpose · 2. Where in the twin · 3. Concepts · 4. Capacity and bottleneck (ch. 4) · 5. Bayesian updating (ch. 4) ·
6. The virtual ramp-up experiment (ch. 6) · 7. Modbus TCP + HTTP sizing and the event block (ch. 5) ·
7b. Step-by-step FMS introduction (ch. 7) · 7c. Implementation and reference cases (ch. 8–9) · 7d. How the thesis argues (ch. 2–3) ·
8. Real-factory implementation · 9. Checklists · 10. Common mistakes · 11. Limits · 12. Glossary

---

## 1. Purpose
The thesis claims: *a cheap digital twin, corrected every month with real machine data, predicts a new FMS better than
the design study, knows where the real bottleneck is, and can be built with only Modbus TCP and HTTP.* This guide shows
how each part of that claim is calculated, with numbers you can check by hand or in the tab.

## 2. Where in the twin

| Tab item | What you do there | Thesis |
|---|---|---|
| 2 – Capacity + Bayesian updating | edit station data, see the bottleneck; update MTBF, MTTR, cycle time or scrap with data | ch. 4 |
| 3 – Virtual ramp-up | see the results of 30 simulated factories; run one yourself | ch. 6 |
| 4 – Modbus/HTTP sizing | enter machines, polling period, PLC scan time → delay, loss, bandwidth | ch. 5 |
| 5 – Stepwise FMS introduction | see which investment policy wins; build your own plan stage by stage | ch. 7 |
| 6 – Reference design cases | frozen design prediction, robustness of the first investments, ball screw line results | ch. 8–9 |

Code (same formulas): `thesis/code/` – overview and how to reproduce every number in `thesis/README.md`.

## 3. Concepts
- **Static capacity** – what a station can produce if nothing else disturbs it (no waiting, no blocking).
- **Bottleneck** – the station with the lowest capacity; it sets the output of the whole line.
- **Prior** – what we believe *before* the machine runs: the design value plus how sure we are.
- **Posterior** – what we believe *after* adding real data.
- **Equivalent amount of data ("worth")** – our way to say how sure we are: "the supplier MTBF of 30 h is worth 300 hours
  of real running". Small worth = we trust data quickly; large worth = we trust the design longer.
- **Epistemic uncertainty** – we do not know the true value yet. Shrinks with data.
- **Aleatory uncertainty** – natural randomness (when exactly the next failure comes). Never disappears.
- **Ramp-up** – the months from the first part to full output; failures, slow cycles and scrap are high at the start.
- **Frozen prediction** – a prediction stored with date and version *before* the real result exists, so nobody can
  change it afterwards. This is how the thesis proves its predictions honestly.
- **Polling** – the gateway asks every PLC for its registers again and again (Modbus TCP is always "ask and answer").

## 4. Capacity and bottleneck (thesis chapter 4, Eq. 4.1–4.2)

**Availability** – share of time the machine is not broken:

$$A = \frac{MTBF}{MTBF + MTTR}$$

**Capacity in good parts per month:**

$$C = c \cdot A \cdot \frac{3600 \cdot H}{\bar t + h} \cdot (1 - q)$$

c = number of machines, H = productive hours per month, t̄ = average cycle time over the product mix, h = handling
time not hidden by the pallet changer, q = scrap rate.

**Worked example – HMC (example values):** c = 3, MTBF = 30 h, MTTR = 20 min = 0.333 h → A = 30 / 30.333 = 0.989.
Mix 30 / 50 / 20 % with cycle times 270 / 345 / 450 s → t̄ = 0.3·270 + 0.5·345 + 0.2·450 = 343.5 s; h = 15 s; q = 0.8 %;
H = 330 h (2 shifts × 7.5 h × 22 days).
C = 3 · 0.989 · 3600 · 330 / (343.5 + 15) · 0.992 = **9 754 parts/month**.

Doing this for all 13 stations: **FINAL 5 667** is the bottleneck, ASSY 5 945 (+4.9 %), GRIND 6 164 (+8.8 %).
**Lesson:** three stations are within 9 % – a small error in one design cycle time can move the bottleneck. That is why
the twin must learn the real values.

The simulation gives about **5 320** good parts/month – lower than 5 667 because of scrap at all stations, blocking and
waiting. Static capacity is always optimistic; use it to *find* the bottleneck, use the simulation to *predict* output.

## 5. Bayesian updating (thesis chapter 4, Eq. 4.5–4.11)

The idea in one sentence: **new estimate = mix of the design value and the measured value, weighted by how much data
each is worth.** For four quantities the mathematics is so simple that the update is just adding numbers.

### 5.1 Failures (MTBF) – Gamma–Poisson
Prior from design: b = worth in hours, a = 1 + b / MTBF_design.
Update with n failures in T hours of running: **a ← a + n, b ← b + T.** Estimate: MTBF = b / (a − 1).

*Example (HMC):* design MTBF 30 h worth 300 h → a = 11, b = 300 → MTBF 30 h, 90 % range 17.7–48.6 h.
Month 1: 14 failures in 310 h → a = 25, b = 610 → **MTBF 25.4 h**, range 18.1–35.1 h.
Month 2: 24 failures in 640 h → a = 49, b = 1 250 → **26.0 h**, range 20.5–32.8 h.
The range shrinks from 31 h to 12 h: we now *know* the machine much better.

### 5.2 Repair time (MTTR) – Gamma–exponential
Prior: a = 1 + worth (in repairs), b = worth · MTTR_design. Update with k repairs of total duration Σr:
**a ← a + k, b ← b + Σr.** Estimate MTTR = b / (a − 1).
*Example:* design 20 min worth 5 repairs; 14 real repairs averaging 30.1 min → **MTTR 27.4 min**.

### 5.3 Cycle time – Normal-Inverse-Gamma on the logarithm
Cycle times are positive and skewed, so we work with ln(t). The result behaves like a weighted average:

$$\text{new mean} \approx \frac{\text{worth} \cdot \text{design} + n \cdot \text{measured mean}}{\text{worth} + n}$$

*Example:* supplier 345 s ± 10 % worth 10 cycles; 40 measured cycles, mean 371 s → **366 s** (80 % of the way to the data,
because 40 / (10 + 40) = 0.8).

### 5.4 Scrap – Beta–binomial
Prior a = q_design · worth, b = (1 − q_design) · worth. Update with x scrap in n parts: **a ← a + x, b ← b + n − x.**
Estimate q = a / (a + b).
*Example:* design 0.8 % worth 250 parts; 9 scrap in 400 → **1.69 %**.

### 5.5 Forgetting during ramp-up
In ramp-up the machine gets better every month, so old data become wrong. Before each update multiply a and b by
**ρ = 0.7**: data from 1 month ago count 70 %, 2 months ago 49 %, 3 months ago 34 % … (memory ≈ 1 / (1 − ρ) ≈ 3.3 months).
After ramp-up raise ρ towards 1.

## 6. The virtual ramp-up experiment (thesis chapter 6)

**Why an experiment?** In a real factory nobody knows the *true* MTBF – only estimates. In a simulation we can create a
"true factory" with hidden values and check whether the twin finds them.

**How it works (per scenario):**
1. Create a hidden true factory: every station differs from the design (MTBF 0.6–1.1 × design, MTTR 1.0–1.5 ×, cycle time
   0.98–1.12 ×, scrap 1–2 ×) and has a ramp-up: in month 1 MTBF is half, repairs 50 % longer, cycles 8 % slower, scrap 3 ×.
2. Each month the true factory is simulated; the twin gets only the machine data (failures, running hours, repairs,
   cycle times, scrap counts) – like from the Modbus gateway.
3. Before each month, every method predicts the good output. Then the truth is revealed and the error measured.
4. Repeat for 30 different hidden factories.

**Methods compared:** B0 design model (never updated) · B1 calibrated once with month 1 · P07 Bayesian twin with
forgetting · P07D = P07 + learning its own systematic error ("discrepancy") · and three more in the thesis.

**Results (simulated, 30 factories):**

| Method | Error months 2–12 | 90 % range really contains the truth |
|---|---|---|
| B0 design model | 12.0 % – never improves | 0 % |
| B1 one-time calibration | 23.6 % – worse than nothing | 0 % |
| P07 Bayesian twin | 5.7 % (2.6 % in months 7–12) | 8.5 % |
| **P07D twin + discrepancy** | **3.6 %** | **94 %** |

**Bottleneck:** the twin finds the true bottleneck in 97–100 % of factories from month 4; the design model in 73–77 %.

**Three lessons to remember:**
1. A design study that is not updated stays wrong (here 8 % too optimistic) for ever.
2. Calibrating once at the start of ramp-up is dangerous – you freeze the worst month into the model.
3. Parameter learning tells you *where* the factory differs from the design; the discrepancy term makes the forecast and
   its uncertainty honest. You need both.

## 7. Modbus TCP + HTTP sizing and the event block (thesis chapter 5)

### 7.1 The problem with polling
The gateway reads each PLC every P seconds. A short stop that starts and ends between two reads is **never seen**. With
P = 1 s, about 28 % of short states are lost (measured: 29–37 % of all changes not reported). Lost stops make the twin
think the machine is better than it is.

### 7.2 The solution: event block in every PLC (28 registers)
- a **change counter** (+1 at every state change),
- the **time of the last change** (milliseconds, PLC clock),
- a **ring buffer** with the last 8 changes (state + time).
The gateway compares the counter with the last read: the difference tells exactly how many changes happened; the ring
gives them with their real time. About 10 lines of PLC program. **Measured: 0 lost of 23 825 events.**

### 7.3 Sizing formulas (put your values into tab item 4)
- Bytes on the wire per read of n registers: **261 + 2n** (36 registers → 333 bytes).
- Bandwidth: N machines × reads per second × bytes × 8. *Example:* 160 machines, 36 registers, 4 reads/s → 1.7 Mbit/s
  = 1.7 % of a 100 Mbit/s network. Bandwidth is never the problem.
- PLC answer time: ≈ 1 ms + scan / 2 (scan 10 ms → 6 ms).
- Sequential gateway limit: **N_max = P / (k × answer time)**. *Example:* P = 1 s, 1 read, 6.05 ms → 165 machines;
  P = 0.5 s with 2 reads → only 41 machines. A **parallel** gateway (asks all PLCs at once) reads 160 machines in ≈ 14 ms.
- Delay until an event is seen: average P / 2, maximum P + answer time.
- Event-block loss: only if more than 8 events happen between two reads – practically never at P ≤ 10 s.

## 7b. Step-by-step FMS introduction (thesis chapter 7)

**The question:** you start with connected standalone CNCs (manual HMC loading, small racks, slow fault response). Six
investments lead to the FMS. Buy everything now, follow a plan made today, or decide again every half-year with the twin?

**The six options (example costs – replace with your quotes):**

| Option | What it changes | Cost |
|---|---|---|
| PAL – pallet pool on the HMCs | load/unload hidden: 120 s → 15 s | 180 000 € |
| GR2 – second grinder | grinding capacity × 2 | 350 000 € |
| AS2 – second assembly station | assembly capacity × 2 | 120 000 € |
| FRB – robot-assisted final assembly | final assembly cycle −25 % | 220 000 € |
| MES – cell controller + MES | repairs 30 % faster, scrap −20 % | 150 000 € |
| AGV – AGV transport (needs MES) | buffers 2 → 4 parts | 250 000 € |

**How a plan is valued (NPV):** for every half-year: 6 months × (margin 450 € × sold units − 50 € × units not delivered),
minus maintenance (3 % of installed cost per half-year), minus the investment, all discounted with 5 % per half-year;
plus 2 more years with the final configuration. Output per month comes from the **screening formula**
output = bottleneck rate × yield × η (η ≈ 0.993 for buffers of 2), which is within 1.2 % of the full simulation.

**The decision rule (same for all policies):** at each stage try every affordable combination of new options (budget
400 000 € per stage, AGV only with MES) and take the one with the best NPV, assuming nothing more is bought later.
The policies differ only in what they *know*: design values (STATIC), observed demand (ADAPT_DEM), the Bayesian twin
(ADAPTIVE) or the hidden truth (PI_RULE).

**Results (simulated, 40 factories; money values are examples):**

| Policy | Extra NPV vs no investment | Worst 10 % | Capital |
|---|---|---|---|
| All at once | 9.07 M€ (worst case −0.87 M€) | 1.17 M€ | 1.27 M€ |
| Plan fixed at design | 7.57 M€ | 1.53 M€ | 0.69 M€ |
| Demand updated only | 8.16 M€ | 1.90 M€ | 0.62 M€ |
| **Re-decided with the twin** | **9.28 M€** | **2.04 M€** | **0.71 M€** |

**What to remember:**
1. Deciding step by step with the twin gives the most value, the best worst case and needs 44 % less capital than
   buying everything at once – important when money is expensive.
2. About two thirds of the advantage over a fixed plan comes from **knowing the real machines** (the twin), one third
   from knowing the real demand.
3. The fixed plan always buys the second grinder; the twin buys it only where the grinder really limits output (27 of 40
   factories) and buys the MES in 32 of 40, because real machines fail more often than designed.
4. PAL and AGV are almost never chosen here, because the HMC cell is not the bottleneck and small buffers already lose
   < 1 %. They would pay through labour savings, which this model does not count – enter your labour costs before deciding.

**Try it:** tab item 5 – tick options per stage, change the demand level, press "Suggest plan" (gives AS2 + FRB in
stage 1, GR2 in stage 2 with the example values).

## 7c. Implementation and the two reference cases (thesis chapters 8 and 9)

**Chapter 8 – how it is built.** Everything runs on one offline PC with Python and JavaScript only, no extra packages:
the factory twin (`server.py`, `twin/`, verified against 11 hand calculations – all passed), the thesis modules
(`thesis/code/`), and the same calculations in the browser (tab "Doctoral research"), checked number by number against
Python. Monthly update + prediction take less than 2 seconds.

**Chapter 9 – "reference design cases".** You have no production data yet, so the method is applied to the two factory
designs of this project, exactly as you would do it at the end of the design phase. Structure, routings, cycle times and
machine counts come from the designs; reliability of the ball screw machines and all money values are **reference
estimates** (engineering estimates) and are labelled so.

**Case 1 – compressor FMS (results):**
- **Frozen design prediction P0:** 6 176 compressors per month (90 % range 5 916 – 6 413), stored with date in
  `thesis/data/case1_P0.json`. The plain design calculation says 6 322 – 2.3 % more, because point values hide how
  uncertain losses add up. **This number is never changed**; your real factory will be compared with it after ramp-up.
- **First investments:** robot-assisted final assembly + second assembly station in the first half-year, second grinder
  in the second. This stays the first choice whatever the margin, discount rate or penalty; it changes only with
  capex, budget and demand (with demand 20 % lower, no investment pays – wait for demand data).
- **Data path:** 25 Modbus devices, 0.25 s polling → 0.27 Mbit/s, sequential 151 ms or parallel 12 ms per cycle – both fine.

**Case 2 – ball screw shaft line (results):**
- 12 operations, machines from the design rule (8 thread grinders, 3 lead-measuring machines, 2 lathes …).
- **Two bottlenecks almost equal:** thread grinding 3 433 and induction hardening 3 435 good shafts per month. Simulation
  gives 3 055 – about 22 % above the target of 2 500 (the design assumed OEE 0.75).
- **Transfer test (20 hidden factories):** design model never below 13 % error; twin + discrepancy below 5 % from month 4,
  intervals cover the truth 100 % from month 4; true bottleneck found 80 – 100 % (design 50 – 65 %, because the two
  bottlenecks are tied).
- **Data path, 73 machines:** sequential polling too slow at 0.25 s (442 ms) → use a parallel gateway (14 ms), or
  sequential at 1 s.

**What you must do before the defence:** (1) replace the reference values with quotations and supplier data → re-run
`python thesis/code/case_study.py`; (2) freeze P0 again before the first part; (3) run the monthly ramp-up protocol of
thesis section 9.6 for 12 months.

**Try it:** tab item 6.

## 7d. How the thesis argues (thesis chapters 2 and 3)

**Chapter 2 – what is known and what is missing.** Seven areas of knowledge are reviewed (FMS, digital twins, simulation
for design, input uncertainty and calibration, ramp-up, industrial communication, SMEs / emerging economies and staged
investment). Each section ends with "taken from here" and "missing". The systematic review (paper 1, 28 studies) proves
the missing parts: Modbus 0 of 28, Bayesian updating 0, ramp-up with data 0, design prediction checked against the real
system 1. This gives the five gaps G1–G5, and each chapter of the thesis closes one.

**Chapter 3 – how the thesis proves its claims.** The thesis follows *design science research*: build something useful
(the architecture, the Bayesian twin, the staging method) and prove it is better than the usual way. The proof has three
layers: (1) formulas you can check by hand, (2) controlled experiments where the truth is known (lab bench, virtual
factories), (3) the real factory (real PLCs, real ramp-up) – layer 3 is planned and the design prediction is already
frozen. Every number has a label (design / assumption / reference estimate / calculated / simulated / measured / cited).

**Important for you – AI assistance.** Chapter 3 contains a declaration that an AI assistant was used for the literature
search, screening, data extraction, code and drafting, under your direction and responsibility. **Before submitting,
check your university's rules on AI use in theses** (some require a declaration form, some restrict AI-drafted text) and
discuss it with your supervisor. You must be able to explain and defend every part of the thesis in the oral exam – use
guide 52 and the tab to learn each method until you can derive the formulas yourself.

## 8. Real-factory implementation
1. **During the FMS design (now):** replace the example values in tab item 2 with your supplier cycle times, MTBF, MTTR
   and scrap; note how sure you are of each value (= worth). Freeze the twin predictions at design freeze (version tag).
2. **PLC specification for every machine supplier:** standard register map V1.1 **plus the event block** (Table 5.2 of
   the thesis) – write it into the purchase specification.
3. **Gateway:** parallel polling; FAST + EVENT every 0.25–0.5 s, counters every 1 s, energy every 10 s; hourly time
   synchronisation of the PLC clocks.
4. **Before ramp-up:** repeat the Modbus bench with one real Delta and one Siemens PLC (thesis section 5.8).
5. **During ramp-up, every month:** update the twin (ρ = 0.7), store the prediction for the next month *before* it starts,
   compare with reality → this is the data of thesis section 9.6.
6. **Every half-year:** enter the real quotations and labour costs in tab item 5, re-run the decision with the updated
   twin, buy only the options it selects for this stage.

## 9. Checklists
**Before trusting a capacity result:** ☐ product mix sums to 1 ☐ handling time only where not hidden by pallet change
☐ MTTR in the same unit as MTBF ☐ scrap per station, not total ☐ H = really productive hours.
**Before an update:** ☐ uptime T counts running hours, not calendar hours ☐ repairs from the PLC "down" intervals
☐ worth of the design value written down ☐ prediction for next month stored before data arrive.
**Before buying PLCs:** ☐ Modbus TCP server ☐ register map V1.1 + event block in the specification ☐ scan time known
☐ ≥ 2 Modbus connections.

## 10. Common mistakes
- Using the static capacity as the output forecast (it is 6–7 % too high here).
- Calibrating the model once after commissioning and then freezing it.
- Giving the design value a huge worth "because the supplier said so" – then data cannot correct it.
- Polling state only and believing every short stop is captured.
- Mixing simulated and measured numbers without labels – an examiner will find it.

## 11. Limits
The ramp-up shape in the experiment is an assumption; the network test used the PC loopback and emulated PLCs; station
values are example design values. All three are closed with your real design data, a real-PLC test and the real ramp-up.

## 12. Glossary
**Conjugate prior** – a prior for which updating is just adding numbers. **MAPE** – mean absolute percentage error.
**Coverage** – how often the true value lies inside the predicted range. **Discrepancy** – the systematic error of the
model itself. **RTT** – round-trip time of one Modbus request. **Event block** – counter + time stamp + ring of the last
8 state changes in the PLC. **ρ (rho)** – forgetting factor.
