# 64 – Capacity, layout and simulation: OEE, queues, buffers, layout, discrete-event simulation

> Tab **FMS engineering → item 4** (`/?feitem=4#fmse`). Contract: guide 60. State: **November 2026**.
> All numbers are **examples**. Main reference: Hopp & Spearman, *Factory Physics* (queueing and closed-system laws).

## Contents
1. Purpose · 2. Where in the twin · 3. OEE · 4. Queueing and variability · 5. Buffers · 6. Layout ·
7. Simulation of an FMS · 8. Real-factory implementation · 9. Checklists · 10. Common mistakes · 11. Limits · 12. Glossary

---

## 1. Purpose

Item 2D gave the number of machines from **average** loads. Real systems lose output through **losses**,
**variability**, **waiting**, **blocking** and **bad layout**. Item 4 explains these effects with formulas and lets you
test a generic FMS in a simulation before you spend money:

- How much of the planned time is really productive (**OEE**)?
- Why does a machine at 95 % utilisation create huge queues (**queueing**)?
- How big must a **buffer** be?
- How should departments / machines be **placed** (layout)?
- How many **pallets, load stations, vehicles** does the FMS need (**simulation**)?

---

## 2. Where in the twin

| Part | What you can do |
|---|---|
| **4A** OEE | Week of one machine → waterfall of the six big losses, A, P, Q, OEE, TEEP |
| **4B** Queueing | Utilisation slider + process / breakdown data → cycle time curve, three scenarios |
| **4C** Buffer | Two machines with breakdowns → simulated throughput for 0–20 buffer places |
| **4D** Layout | 7 layout types; from-to matrix of 8 departments; swap by clicking or automatic pairwise exchange |
| **4E** FMS simulation | Machines, pallets, load stations, vehicles, part mix, breakdowns → KPIs, Gantt, throughput-vs-pallets sweep |

The compressor twin (Live factory, What-if) is a **specific** simulation; 4E is a **generic** one you can set up for
any FMS in minutes.

---

## 3. OEE – six big losses

$$ A = \frac{\text{run time}}{\text{planned time}}, \quad P = \frac{t_{ideal}\cdot n_{total}}{\text{run time}}, \quad Q = \frac{n_{good}}{n_{total}}, \quad OEE = A\,P\,Q $$

$$ TEEP = OEE \cdot \frac{\text{planned time}}{\text{calendar time}} $$

| Loss | Belongs to | Typical action |
|---|---|---|
| Breakdowns | A | TPM, predictive maintenance |
| Set-ups and adjustments | A | SMED, pallets prepared offline |
| Minor stops (< 5 min) | P | Fix root causes (sensors, chips, feeders) |
| Reduced speed | P | Process optimisation, tooling |
| Scrap / rework | Q | Process capability, poka-yoke |
| Start-up losses | Q | Stable warm-up, first-part rules |

**Example (one week):** planned 4 500 min, breakdowns 270, set-ups 360 → run time 3 870 min, A = 86.0 %;
ideal 2.0 min × 1 650 parts = 3 300 min → P = 85.3 %; 1 610 good → Q = 97.6 %; **OEE = 71.6 %**
(= 3 220 fully productive min ÷ 4 500). Calendar 10 080 min → TEEP = 31.9 % – the unmanned hours of an FMS raise
TEEP more than any other action.

---

## 4. Queueing and variability

### 4.1 Effective process time with breakdowns

$$ A = \frac{MTTF}{MTTF + MTTR}, \qquad t_e = \frac{t_0}{A}, \qquad c_e^2 = c_0^2 + (1 + c_r^2)\,A(1-A)\frac{MTTR}{t_0} $$

($c_r = 1$ for exponential repair times.)

### 4.2 Waiting time (Kingman for 1 machine, Sakasegawa for m machines)

$$ W_q \approx \frac{c_a^2 + c_e^2}{2}\cdot\frac{u^{\sqrt{2(m+1)}-1}}{m(1-u)}\cdot t_e, \qquad CT = W_q + t_e, \qquad WIP = r_a \cdot CT $$

**Example:** t₀ = 10 min, c₀ = 0.5, MTTF 600 min, MTTR 60 min, cₐ = 1, m = 1, u = 85 % →
A = 90.9 %, tₑ = 11.0 min, cₑ² = 0.25 + 2 × 0.909 × 0.091 × 6 = 1.24; Wq = (1 + 1.24)/2 × 0.85/0.15 × 11 = **69.9 min**;
CT = 80.9 min = 7.4 × tₑ.

### 4.3 Three lessons

1. Waiting grows like u / (1 − u): 80 % → 4, 90 % → 9, 95 % → 19 (times tₑ × variability). **Plan bottlenecks at 80–85 %.**
2. **Variability costs capacity** – halving c (stable processes, regular release) halves the queue.
3. With the **same availability**, frequent short stops are much better than rare long ones: MTTF 60 / MTTR 6 gives
   cₑ² = 0.35 instead of 1.24 – the queue is about 2× shorter.

---

## 5. Buffers between machines

Without a buffer, two machines in series behave almost like one machine with availability ≈ A₁ × A₂ – every stop of
one stops the other. A buffer decouples them.

**Rule of thumb:** buffer ≈ parts made during one average repair = MTTR ÷ cycle time.

**Example (4C):** both machines 1 min cycle, cv 0.3, MTTF 100, MTTR 10 min (A = 91 %): no buffer → 44 parts/h
(81 % of the 54.5/h limit); 18 places → 95 %; 20 places → 51.9/h. MTTR ÷ cycle = 10 places gives ≈ 90 %.
More places give less and less but cost space and WIP. **In an FMS the pallet pool is the buffer.**

---

## 6. Layout

### 6.1 Types

| Type | Best for |
|---|---|
| Process (functional) | Job shop, many different parts |
| Product (line) | High volume, few variants |
| Cellular | Part families (item 2A) – the step before an FMS |
| FMS linear (spine) | 2–8 machines along a pallet pool / rail, expandable |
| FMS loop | Assembly systems with carriers |
| U-shape | Manual / semi-automatic cells |
| Fixed position | Very large products |

### 6.2 From-to matrix and transport effort

$$ C = \sum_i \sum_j f_{ij}\, d_{ij} $$

f = loads per day from i to j, d = distance (rectilinear: |Δx| + |Δy|). **Pairwise exchange** (the idea of CRAFT):
try every swap of two departments, keep the one that saves most, repeat until no swap helps (local optimum).
Example (4D): 8 departments, 20 m slots: 8 900 → 5 600 load·m/day in 3 swaps (−37 %). 8! = 40 320 layouts exist –
that is why heuristics are used.

After the numbers: departments' real sizes, building columns, crane ways, utilities, clean / dirty zones (heat
treatment and grinding apart), docks for receiving and shipping, safety distances, expansion space.

---

## 7. Simulation of an FMS (closed loop)

### 7.1 The model in 4E

Every pallet cycles: **load station → vehicle → machine (any free one) → vehicle → load station**. Parts are assigned
at the load station by the mix. Machines fail only while working (MTTF in busy time, exponential), repair MTTR.
Processing and load times are lognormal with the given cv. Dispatching FIFO or SPT. Warm-up (10 %, ≤ 2 days) is
not counted. Same seed → same result.

### 7.2 Laws for closed systems (Factory Physics)

$$ r_b = \min\left(\frac{m}{t_m/A},\ \frac{L}{t_{load}},\ \frac{V}{2\,t_{move}}\right), \qquad T_0 = t_{load} + 2t_{move} + \frac{t_m}{A}, \qquad W_0 = r_b\,T_0 $$

$$ TH_{best}(N) = \min\left(\frac{N}{T_0},\ r_b\right), \qquad TH_{PWC}(N) = \frac{N}{W_0 + N - 1}\,r_b $$

**Example:** 3 machines, mean 57.6 min per pallet, A = 95.2 % → machines 2.98 pallets/h (bottleneck), load station
5.0/h, vehicle 20/h; T₀ = 12 + 3 + 60.5 = 75.5 min; **W₀ = 3.7 pallets**. Simulated: 5 pallets give 95 % of the maximum;
with 10 pallets TH = 2.91/h (200-day runs: 2.97–2.98/h), machine utilisation 100 % (of it 4.8 % breakdown), load station
58 %, loop time 206 min. Little check: 2.91/60 × 206 = 10.0 = N ✓.

### 7.3 How to use it

1. Enter your machines, part mix and times (from item 2), load and transport times (item 3).
2. Run the **sweep**: find the number of pallets where the curve flattens (≈ 95 % of max).
3. Change one resource at a time (one more load station, a second vehicle, shorter MTTR) and see which becomes the
   bottleneck.
4. Look at the **Gantt**: red = breakdowns, gaps = machines waiting – are they starved (too few pallets / slow load
   station) or blocked?
5. Repeat with 3–5 seeds; report the range, not one number.

---

## 8. Real-factory implementation

- Measure OEE per machine **from day 1** of operation (automatic from the machine signals, item 11); losses by reason.
- Use the queueing formulas to explain to management why 95 % planned utilisation gives late orders.
- Size buffers / pallets with 4C / 4E, then confirm in the detailed simulation of the supplier (Plant Simulation,
  FlexSim, AnyLogic …) or in the twin.
- Layout: from-to matrix from real routings × volumes; iterate with the building constraints; keep expansion space.
- Keep the simulation model alive after start-up: update with real MTTF / MTTR / times → it becomes the planning twin.

---

## 9. Checklists

- [ ] OEE assumption written for each machine group (year 1 and later)
- [ ] Bottlenecks planned ≤ 85 % utilisation; variability sources listed
- [ ] Buffers / pallets sized for MTTR of the neighbour machines
- [ ] From-to matrix done; layout variants compared by Σ f·d and qualitative criteria
- [ ] Simulation with several seeds; sweep of pallets; bottleneck named; Gantt checked

---

## 10. Common mistakes

| Mistake | Result | Better |
|---|---|---|
| Plan at 95 % utilisation | Long, unpredictable lead times | ≤ 85 % on bottlenecks |
| Average values only | System looks fine on paper, fails in reality | Queueing formulas + simulation |
| Ignoring MTTR size | Long breakdowns block everything | Short repairs, spare parts, buffers ≥ MTTR ÷ cycle |
| More pallets "to be safe" | WIP and lead time grow, no more output | Sweep: stop where the curve flattens |
| One simulation run | Random result taken as truth | Several seeds, ranges |
| Layout only by flow numbers | Columns, utilities, safety forgotten | Use Σ f·d as a first step only |

---

## 11. Limits

- The queueing formulas are approximations (good for planning, ±10–20 %).
- 4E is generic: identical machines, one routing step per pallet, one vehicle pool, no shifts / breaks, no set-ups,
  no tool shortages. Use a detailed model for the final design.
- Pairwise exchange finds a local optimum on equal-size slots only.

---

## 12. Glossary

| Term | Meaning |
|---|---|
| **OEE / TEEP** | Overall equipment effectiveness / total effective equipment performance |
| **MTTF / MTTR** | Mean time to failure / mean time to repair |
| **cv, c²** | Coefficient of variation (std ÷ mean), its square |
| **tₑ** | Effective process time including breakdowns |
| **u** | Utilisation = arrival rate × tₑ ÷ machines |
| **W_q, CT** | Waiting time in queue, cycle time (waiting + process) |
| **r_b, T₀, W₀** | Bottleneck rate, raw process (loop) time, critical WIP |
| **PWC** | Practical worst case – reference curve for a system with "normal" variability |
| **DES** | Discrete-event simulation |
| **From-to matrix** | Table of material flows between departments |
| **CRAFT** | Classic layout improvement method by pairwise exchange |
