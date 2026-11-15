# 59 – Final thesis item F2: from the production programme to the optimised combined FMS

*Production programme → machine loads → optimal machine counts → combined versus separate factories → ramp-up purchase
plan → HMC pallet cell (pallets, fixtures, load stations) by queueing network and simulation → robustness → layout →
transport → operators → investment and NPV.*

**Files.**

| Path | Content |
|---|---|
| `thesis_final/design/02_fms/fms_data.json` | programme and machine catalogue, editable |
| `thesis_final/design/02_fms/fms_design.py` | program, standard-library Python; it reads the F1 routings directly |
| `thesis_final/design/02_fms/out/` | `report.md`, `machines.csv`, `flows.csv`, `layout.svg`, `cell_throughput.svg` |

**Data labels.**
- The programme is Kenzo's default, 2026-11-15: VC20 3000 per month; RB 400 per month (35/45/20 %); H = 330 h per month.
- Machine prices, areas, material costs and overheads are **reference estimates** (±30 %).
- All results are **calculated** or **simulated**. None is measured.

---

## 0 How to run

```
cd thesis_final/design/02_fms
python fms_design.py selftest            # SELFTEST PASS (15/15)
python fms_design.py loads               # chapter 4
python fms_design.py machines            # chapter 5
python fms_design.py cell                # chapter 8
python fms_design.py run                 # everything -> out/report.md + CSV + SVG
python fms_design.py --scale 1.2 run     # what-if: all demands x 1.2
```

**Change the programme.** Edit `programme.demand_month`, `ramp`, `lot` and `H_month` in `fms_data.json`, then run again.
Everything follows automatically.

| Chapter | Program function | Output |
|---|---|---|
| 4 Loads | `loads` | report §1 |
| 5 Machine counts | `maxflow`, `optimise` (branch and bound) | report §2, `machines.csv` |
| 6 Combined vs separate | `optimise` per product group | report §3 |
| 7 Ramp-up | `optimise` per stage | report §4 |
| 8 Pallet cell | `cell_model`, `mva`, `pallet_search`, `des_cell` | report §5, `cell_throughput.svg` |
| 9 Robustness | `robustness` + robust-design loop | report §6 |
| 10 Layout + transport | `flows`, `optimise_layout`, `agv_estimate` | report §7, `layout.svg`, `flows.csv` |
| 11–12 People, money | `economics` | report §8–9 |

---

## 1 The design problem

An FMS designer must answer, in this order:

| Decision | Question | Method in F2 |
|---|---|---|
| D1 | How many machines of each type? | integer optimisation (chapter 5) |
| D2 | Which operation runs on which machine type, when there are alternatives? | max-flow inside the optimisation |
| D3 | Which machines form which cell? | part families of F1 + flows (chapter 10) |
| D4 | How many pallets and fixtures, and how many load stations? | closed queueing network (MVA) + simulation (chapter 8) |
| D5 | When is each machine bought? | optimisation per ramp-up stage (chapter 7) |
| D6 | Is the design robust against wrong times and changing demand? | Monte Carlo (chapter 9) |
| D7 | Where is each department? | layout optimisation (chapter 10) |
| D8 | How much material handling? | flows → AGV count (chapter 10, input of F5) |
| D9 | Is it worth it? | investment, NPV (chapter 12) |

In the literature this is the **FMS design problem**. Stecke (1983) separates it from the *planning* problems, such as
part selection, grouping, loading and pallet allocation, and from *scheduling*.

**Why not simply divide and round up?** "HMC hours / hours per machine, rounded up" is correct only when:
- every operation has exactly one machine type;
- the pallets and the load station are never the bottleneck;
- the times are certain.

None of this is true here. F2 therefore uses a chain of models, each checked against an independent method:
max-flow against brute force, MVA against closed formulas and simulation, and the layout against its start solution.

---

## 2 The production programme

| Field | Value | Meaning |
|---|---|---|
| `H_month` | 330 h | 2 shifts × 7.5 h × 22 days |
| `demand_month` | VC20 3000; RB50 140, RB100 180, RB150 80 | full-rate volume |
| `ramp` | 0.4, 0.6, 0.8, 1.0 | ramp-up stages (one per quarter of year 1) |
| `lot` | VC20 150 (1 day); RB 35 / 45 / 20 (1 week) | production lot, sets the number of set-ups |
| `u_max` | 0.90 | planning ceiling on top of OEE (chapter 3) |

**Takt time.** This is the time between two finished products that the market demands:

$$T_{takt} = \frac{H\cdot 60}{\text{demand}} \qquad \text{VC20: } \frac{330\cdot60}{3000} = 6.6\ \text{min} \qquad \text{all products: } \frac{19\,800}{3400} = 5.8\ \text{min}$$

Every 6.6 minutes a VC20 must leave the test bench. A VC20 needs 31 min of assembly and 25 min of test, so at least
31/6.6 = 4.7 assembly stations and 25/6.6 = 3.8 test benches are needed **before** losses. The optimisation adds the
losses.

---

## 3 Capacity: OEE and why we keep a reserve

**Capacity of one machine per month:**

$$c_t = H\cdot60\cdot OEE_t\cdot u_{max}\quad[\text{min}]$$

**OEE** (overall equipment effectiveness) = availability × performance × quality. The catalogue values are 0.80–0.90; in
the FMS cell, HMC = 0.85. OEE removes breakdowns, slow cycles and scrap. It does **not** remove waiting.

**Why u_max = 0.90.** In every queue the waiting time grows sharply near full utilisation. Kingman's formula (G/G/1)
shows it:

$$W_q \approx \left(\frac{c_a^2 + c_s^2}{2}\right)\left(\frac{u}{1-u}\right)t_e$$

| Utilisation u | u/(1−u) | Waiting time with c_a = c_s = 1 |
|---|---|---|
| 0.70 | 2.3 | 2.3 × the process time |
| 0.85 | 5.7 | 5.7 × |
| 0.90 | 9 | 9 × |
| 0.95 | 19 | 19 × |

Above about 90 %, lead time and WIP explode. Hopp & Spearman call this the *variability law*. Planning therefore stops
at u_max = 0.90 of the OEE capacity.

---

## 4 Machine loads (program `loads`)

For each **routing group** g, the set of machine types that may do an operation:

$$L_g = \sum_i q_i\,t_{ig} + \sum_i \left\lceil\frac{q_i}{lot_i}\right\rceil s_g$$

| Symbol | Meaning |
|---|---|
| q_i | pieces of part-operation i per month (= product demand × quantity per unit from F1) |
| t_ig | time per piece from F1 |
| s_g | set-up time of the primary machine type per lot (fms_data `setup`) |

**Worked example: HMC.**
- VC20: 3000 × 11.93 min = 35 790 min = **596.5 h**.
- RB: housing + head plates. The mix-weighted time is 35.27 min, × 400 = **235 h**.
- HMC set-ups are 0, because fixtures are dedicated and NC programs are called by the pallet code.
- **Total 831.7 h per month.**

**Worked example: VMC set-ups.**
- VC20 has 12 VMC part-operations: C02, C03, C04, C05, C06, C08, each with OP10 + OP20.
- That gives 3000/150 = 20 lots × 12 × 20 min = 4800 min.
- RB has 2 VMC operations (R04, R05) × (4 + 4 + 4 lots) × 20 min = 480 min.
- Total **5280 min = 88 h** of VMC set-up per month. The self-test checks this value.
- Half of it disappears if the VC20 lot doubles to 300. That is a decision for the production planner, not for the
  machine count.

**Loads, full rate** (report §1):

| Allowed types | h/month | | Allowed types | h/month |
|---|---|---|---|---|
| ASSY | 1796.7 | | BAL | 185.7 |
| VMC | 1493.5 | | TMILL | 140.3 |
| TEST | 1450.0 | | GRIND | 138.4 |
| HMC | 831.7 | | RMILL | 135.8 |
| LATHE/TMILL | 554.2 | | PAINT, HONE, WASH, LAP, CMM, IHARD | 133 … 66 |
| PACK | 283.3 | | KEYS/TMILL | 49.2 |

**Total: about 7600 h per month.** 43 % of it is assembly, test and packing. That is why item F10 exists.

---

## 5 Optimal machine counts (program `optimise`)

### 5.1 The model

**Decision variables.**
- m_t: number of machines of type t (integer).
- x_gt: minutes of group g done on type t (continuous).

**Model:**

$$\min\ C = \sum_t m_t\Big(P_t\,(CRF + k_m) + o_t\,H\,12\,w\Big) + \text{energy}$$

$$\text{subject to}\quad \sum_{t\in g} x_{gt} = L_g\ \ \forall g \qquad \sum_g x_{gt} \le m_t\,c_t\ \ \forall t \qquad m_t \ge m_t^{min}$$

| Symbol | Meaning |
|---|---|
| P_t | price of one machine of type t |
| CRF | capital recovery factor = i(1+i)ⁿ/((1+i)ⁿ−1) = 0.08 · 1.08¹⁰ / (1.08¹⁰ − 1) = **0.149** per year (8 %, 10 years) |
| k_m | maintenance, 4 % of the price per year |
| o_t | operators per machine |
| w | labour rate, 9 EUR/h |
| m_t^min | minimum count; HMC ≥ 2, for redundancy in the pallet cell |

This is a mixed-integer linear program (MILP). There is no MILP solver in the standard library, so the program uses the
structure of the problem:

**Step 1 – Feasibility of a given set of counts = maximum flow.**
- Draw a network: source → group node (capacity L_g) → type node (unlimited) → sink (capacity m_t·c_t).
- All load can be placed **if and only if** the maximum flow equals ΣL_g. This follows from the max-flow / min-cut theorem
  (Ford–Fulkerson).
- The program uses Edmonds–Karp: augmenting paths found by breadth-first search.

Example from the self-test:
- Groups {A}: 50, {A, B}: 80, {B}: 30. Capacities A = 100, B = 60.
- Flow 160 = all load: A takes 50 + 50, B takes 30 + 30.
- With A = 40 only 150 fit: the A-only group cannot place 10.

**Step 2 – Branch and bound over the flexible types.**
- **Lower bound per type:** lb_t = ⌈load that can *only* go to t / c_t⌉.
- **Upper bound:** ub_t = ⌈all load that *may* go to t / c_t⌉.
- Types with lb = ub are fixed.
- The search tries the counts of the flexible types depth-first. It cuts a branch when the partial cost plus the lower
  bounds of the remaining types is already above the best feasible solution found.
- Each leaf is checked by max-flow.
- The self-test compares this with full enumeration (brute force) on a 5-group example. The costs are identical.

### 5.2 Result (report §2)

| Type | Count | Load h | Capacity h (H × OEE) | Utilisation |
|---|---|---|---|---|
| HMC | **4** | 831.7 | 1122.0 | 74.1 % |
| VMC | **7** | 1493.5 | 1848.0 | 80.8 % |
| LATHE | **2** | 475.2 | 528.0 | 90.0 % |
| TMILL | **1** | 237.6 | 264.0 | 90.0 % |
| RMILL | **1** | 135.8 | 264.0 | 51.4 % |
| GRIND, HONE, LAP, IHARD, BAL, KEYS, WASH, CMM, PAINT | 1 each | | | 11–63 % |
| ASSY | **8** | 1796.7 | 2244.0 | 80.1 % |
| TEST | **6** | 1450.0 | 1683.0 | 86.2 % |
| PACK | **2** | 283.3 | 561.0 | 50.5 % |

In total there are **40 machines and workplaces**: machine investment 5.115 M EUR; annual cost 1.79 M EUR.

**What the optimiser did with the flexibility.**

| Group | Load | Split |
|---|---|---|
| LATHE/TMILL | 554 h | **475 h on the two cheap lathes** (90 %), only 79 h on the turn-mill |
| KEYS/TMILL | 49 h | 31 h on the 45 kEUR keyseater; 18 h on the turn-mill, which still had capacity |

The turn-mill (280 kEUR) keeps the work only it can do: the orbital pin turning of the crankshaft, and the rotor turning
with live tools. The lathe takes the simple turning.

### 5.3 Lesson – an alternative must be real

The first run gave **0 RMILL** and put the rotor profile milling on the HMCs. The F1 data had listed HMC as an
alternative. The optimiser "saved" 450 kEUR, but on a machine that cannot do the job: an HMC's B-axis turns about a
vertical axis and cannot rotate a rotor synchronously about its own axis.

The same happened with crankcase OP10 on the VMCs. The tombstone pallet model of chapter 8 then disagreed with the
machine count: 3 HMCs at 100 %, and in the simulation only 6.9 instead of 9.09 crankcases per hour.

**After the correction** (guide 58, rule 6), only real alternatives remain. The cell model and the machine model now
describe the same factory.

> **Rule.** An optimiser is only as good as its feasible set. Every alternative needs a check of three things: can the
> machine hold the part, reach the features, and keep the tolerance?

---

## 6 Combined factory versus two separate factories

The program optimises three cases with the same data: VC20 alone, RB alone, and both together.

| Design | Machines | Machine investment | Annual cost |
|---|---|---|---|
| VC20 alone | 34 | 4.105 M EUR | 1.467 M EUR |
| RB alone | 13 | 2.225 M EUR | 0.655 M EUR |
| **Two separate factories** | **47** | **6.330 M EUR** | **2.122 M EUR** |
| **Combined FMS** | **40** | **5.115 M EUR** | **1.788 M EUR** |
| **Saving** | 7 | **1.215 M EUR (19.2 %)** | **0.334 M EUR per year (15.7 %)** |

**Why combining saves.** It is the integer-rounding (pooling) effect:

$$\lceil a\rceil + \lceil b\rceil \;\ge\; \lceil a + b\rceil$$

The RB programme alone needs only 0.93 HMC, 0.14 VMC and 0.1 of a grinder. In a separate factory each of these fractions
becomes a whole machine, and the HMC becomes two (redundancy). In the combined factory the Roots work fills the spare
capacity that the VC20 machines have anyway.

| Machine | VC20 alone | RB alone | Separate | Combined | Saved |
|---|---|---|---|---|---|
| HMC | 3 (2.36 needed) | 2 (0.93 + redundancy) | 5 | 4 | 1 |
| VMC | 7 | 1 | 8 | 7 | 1 |
| LATHE | 2 | 1 | 3 | 2 | 1 |
| GRIND, BAL, CMM, WASH, PAINT | 1 each | 1 each | 2 each | 1 each | 5 |
| KEYS | 0 (turn-mill does it) | 0 | 0 | 1 | −1 (cheaper than a 2nd turn-mill share) |
| **Total** | 34 | 13 | 47 | 40 | **7** |

This is the quantitative answer to RQ1: for a small second product, a combined FMS saves about a fifth of the machine
investment. The saving stays at 19–22 % from 70 % to 120 % of the programme:

| Programme | Combined machines | Saving vs separate |
|---|---|---|
| × 0.7 | 31 | 1.225 M EUR (22.2 %) |
| × 1.0 | 40 | 1.215 M EUR (19.2 %) |
| × 1.2 | 43 | 1.315 M EUR (19.7 %) |

---

## 7 Ramp-up: when to buy which machine (report §4)

The program optimises every ramp-up stage separately. Then it buys only the difference to what is already installed.

| Stage | Volume | Machines to add |
|---|---|---|
| 40 % | VC20 1200, RB 160 | ASSY 3, BAL, CMM, GRIND, **HMC 2**, HONE, IHARD, LAP, LATHE, PACK, PAINT, RMILL, TEST 3, TMILL, VMC 3, WASH |
| 60 % | VC20 1800, RB 240 | ASSY 2, TEST 1, VMC 1 |
| 80 % | VC20 2400, RB 320 | ASSY 1, **HMC 1**, LATHE 1, TEST 1, VMC 2 |
| 100 % | VC20 3000, RB 400 | ASSY 2, **HMC 1**, KEYS 1, PACK 1, TEST 1, VMC 1 |

**Reading.**
- Two HMCs, all single-unit special machines and the RMILL are needed from day one.
- The VMCs, assembly stations and test benches grow with the volume.
- The 3rd and 4th HMC come only at 80 % and 100 %. This is the **staged investment** of the doctoral thesis, chapter 7:
  with the Bayesian twin you buy the 3rd HMC when the *measured* cycle times and demand justify it, not on the plan.

**Practical rule.**
- Order a machine one delivery time *before* its stage starts. HMCs take 6–9 months; VMCs take 3–5 months.
- Prepare the foundations, power and pallet-rack positions for the full stage **now**. This is cheap compared with
  stopping production later.

---

## 8 The HMC pallet cell: pallets, fixtures, load stations (program `cell`)

### 8.1 The cell as a closed queueing network

A pallet circulates through the cell:

1. load station (unload the finished part, clean, load the raw part, clamp check);
2. transport;
3. HMC (machining);
4. transport back.

The number of pallets of each fixture type is **constant**. That makes it a *closed* network, and the pallets are the
"customers".

| Class | Fixture | Content of one visit | Pallets |
|---|---|---|---|
| FA | tombstone, 2 positions | crankcase C01 OP10 + OP20 (one in, one out) | N_FA |
| FC | tombstone, 4 faces | Roots kit R01 + R02 + R03 (all three parts of one blower) | N_FC |

**Demands per visit** (minutes), from the F1 routings:

| Class | Load station | Transport | HMC (/OEE) |
|---|---|---|---|
| FA | 2.63 | 1.00 | 11.93 / 0.85 = 14.04 |
| FC | 5.77 | 1.00 | 35.27 / 0.85 = 41.50 |

**Target throughput:** FA = 3000/330 = **9.09 per hour**; FC = 400/330 = **1.21 per hour**.

### 8.2 Mean value analysis (MVA)

Reiser & Lavenberg (1980). For population vector n (pallets per class), each class r and station k, the recursion is:

$$R_{rk}(\mathbf n) = \frac{D_{rk}}{c_k}\Big(1 + Q_k(\mathbf n - \mathbf e_r)\Big) + D_{rk}\frac{c_k-1}{c_k}$$
$$X_r(\mathbf n) = \frac{n_r}{\sum_k R_{rk}(\mathbf n)} \qquad Q_k(\mathbf n) = \sum_r X_r(\mathbf n)\,R^{queue}_{rk}(\mathbf n)$$

**In words.**
- **Arrival theorem:** an arriving pallet sees the network as it would be with one pallet fewer of its own class. So its
  residence time = its service time × (1 + the queue it finds).
- **Throughput:** Little's law (N = X·R) for each class.
- **Multi-server stations** (4 HMCs) use **Seidmann's approximation**: a c-server station with demand D is replaced by a
  single server with D/c plus a pure delay of D(c−1)/c.

**Self-test checks of the MVA code.**
- **Balanced network**, two equal single servers D: X(N) = N/(D(N+1)) exactly.
- **One pallet at a 2-server station:** X = 1/D. It never waits.
- **Many pallets:** X → c/D, the capacity of the station.

**Hand example.** One FA pallet alone in the cell:
- cycle = 2.63 + 1.00 + 14.04 = 17.67 min, so X = 60/17.67 = **3.40 crankcases per hour**.
- To reach 9.09 per hour you need at least ⌈9.09/3.40⌉ = 3 pallets *without any waiting*.
- With waiting you need 4. That is exactly what the MVA finds.

### 8.3 Search, chart and the competition between classes

`pallet_search` tries 1 or 2 load stations and N_FA, N_FC = 1…16. It takes the cheapest combination whose MVA throughput
meets both targets. Cost per pallet: fixture + rack slot = FA 31 kEUR, FC 41 kEUR; load station 45 kEUR.

**Result:** **1 load station, FA 4 pallets, FC 2 pallets.** MVA gives FA 9.24 per hour and FC 1.70 per hour.

`out/cell_throughput.svg` shows the throughput against N_FA, with FC = 2:
- **FA rises** quickly at first, then flattens: the HMCs saturate.
- **FC falls** when FA pallets are added. **Both classes compete for the same HMCs.** At N_FA ≥ 8 the Roots kits stay
  below their target of 1.21 per hour.
- Too many crankcase fixtures therefore *starve* the Roots product. A closed network makes this visible; a simple
  capacity calculation cannot.

### 8.4 Why a simulation must verify the MVA

Exact MVA needs a **product-form network** (BCMP theorem, Baskett et al. 1975). At first-come-first-served stations this
requires that **all classes have the same service time**. Here the HMC time is 14 min for FA and 41.5 min for FC, so the
MVA is an approximation.

The program therefore checks every MVA result with a **discrete-event simulation** (`des_cell`) of the same cell:
- lognormal times: machining cv 0.15, load station cv 0.40;
- 3000 h simulated, 200 h warm-up.

**If the simulation misses a target, the program adds pallets until it meets it.**

| | MVA | DES | Target |
|---|---|---|---|
| FA per hour | 9.24 | 9.72 | 9.09 |
| FC per hour | 1.70 | 2.33 | 1.21 |
| HMC utilisation | 83 % | 97 % | – |
| Load station utilisation | 57 % | 65 % | – |

The simulation gives *more* throughput than the MVA. The real times vary less than the exponential distribution that
MVA implicitly assumes (cv 0.15 instead of 1). **The MVA is conservative here, and the 4 + 2 pallets are confirmed.**

**About the high utilisations.** The closed model keeps every pallet always in circulation, so the HMCs are full. In the
real cell the controller releases pallets only for orders (fmsctl, guide 54), so the HMC utilisation becomes the load
ratio of chapter 5, 74 %.

The self-test also checks the simulator itself. With exponential times and a product-form network, it matches the exact
MVA within 5 % (measured error 0.0 %).

### 8.5 Recommendations for the cell

1. **Buy 5 FA fixtures, not 4.** The MVA margin is only 1.6 % (9.24 against 9.09). One spare fixture (28 kEUR) covers
   maintenance of a fixture, or a crash repair, without losing output.
2. **One load station at 57–65 %** is enough. At 120 % of the programme the program automatically chooses **2 load
   stations** and FA 6 / FC 2 pallets. Plan the space for the second load station now.
3. **Rack positions:** 4–5 FA + 2 FC + 2 spare = **9 pallet places** in the cell rack (item F3/F4).

---

## 9 Robustness (Monte Carlo)

The machine counts of chapter 5 are correct for the *planned* times and demand. But F1 times are ±25 %, and demand varies.

**Method.**
1. Draw a time factor for every machine type: lognormal, mean 1, σ = 0.15. σ 0.15 means the 90 % range is ±25 %.
2. Draw a demand factor for every product: normal, mean 1, σ = 0.10.
3. Check with max-flow whether the load fits the **full** OEE capacity (u = 1.0, no planning reserve).
4. Repeat 400 times. P(capacity sufficient) = share of feasible samples.

**Result with the optimal counts:**
- **P = 66.5 %.** In one month out of three, overtime or extra shifts would be needed.
- The machines that would most often save a failing sample are TEST (31), LATHE and TMILL (22 each), ASSY (16) and VMC (13).

**Robust design.** Add the machine that cures the most failures *per euro* until P ≥ 90 %:

| Step | Added | P |
|---|---|---|
| 1 | +1 ASSY (25 kEUR) | 70.5 % |
| 2 | +1 TEST (80 kEUR) | 78.8 % |
| 3 | +1 LATHE (90 kEUR) | 85.5 % |
| 4 | +1 VMC (110 kEUR) | **93.5 %** |

The **cost of robustness is 305 kEUR, 6 % of the machine investment.** The robust counts are ASSY 9, TEST 7, LATHE 3,
VMC 8 (the rest unchanged). They are used for the layout and the investment.

> **Engineering judgement.** A Saturday shift is an alternative to the four extra machines: +4 days per month = +18 %
> capacity, at overtime cost. A Saturday shift is cheaper at the start, while demand is uncertain. The machines are
> cheaper when the demand is proven. This is exactly the staged decision that the doctoral twin supports with real
> data.

At 120 % of the programme the robust design needs +855 kEUR (16 %), because more types run near their limit.

---

## 10 Layout and transport

### 10.1 Flows between departments

**Departments** are formed from the machine types (F1 family logic):

| Department | Content |
|---|---|
| HMC | pallet cell + rack + load station |
| VMC | small-part cell |
| ROT | lathe, turn-mill, rotor mill, grinder, hardening, balancing, keyseater: the rotational cell |
| FIN | honing, lapping, washing |
| QC | CMM room |
| ASY, TST, PNT, PCK | assembly, test, paint, final inspection and packing |
| RAW, KIT, BUY, SHP | stores: raw castings; machined parts + kitting; bought parts, tanks, motors; finished goods |
| TOOL, MNT, CHIP | tool room, maintenance, chips |

**Flow** = unit loads per month between two departments.
- Parts travel in crates: 1 crankcase or housing per load; 4 medium parts; 12 small; 24 flat; 6 shafts.
- Products move singly.
- The routing of each part gives its department sequence: RAW → … → KIT.
- The product line is KIT → ASY → TST → PNT → PCK → SHP.
- Bought parts go BUY → ASY (a tank + motor per VC20) and BUY → KIT.

**Strongest flows (unit loads per month).**

| Flow | Unit loads per month |
|---|---|
| RAW–HMC | 3600 |
| HMC–FIN | 3600 |
| QC–KIT | 3467 |
| FIN–QC | 3400 |
| The product line KIT → ASY → TST → PNT → PCK → SHP | 3400 on each link |
| BUY–ASY | 3200 |

### 10.2 Spine layout and its optimisation

**Model.**
- Two rows of departments along a central **AGV main aisle**. Row depth 22 m, aisle 6 m, so the hall is 50 m wide.
- Each department's width = area / 22 m.
- Department areas include the machine service areas × 1.35 (aisles inside the department), plus the store areas.

**Cost function** (rectilinear distance; the second term applies between rows):

$$Z = \sum_{i<j} f_{ij}\,\Big(|x_i - x_j| + (22 + 6)\,[\text{different rows}]\Big) + \sum_{k} f^{dock}_k\,(x_k + 14)$$

**Dock constraints.**
- RAW is fixed at the dock wall in row 1, and SHP in row 2. One truck yard serves both.
- A virtual dock node pulls the other receiving departments towards the wall, with truck flows of RAW 2250, BUY 600 and
  SHP 3400 per month.

**Algorithm.**
1. **SLP start.** Muther's systematic layout planning: departments sorted by total flow, placed alternately in the two rows.
2. **Simulated annealing** (Kirkpatrick et al. 1983), 20 000 moves:
   - a move swaps two departments or moves one to the other row;
   - a worse layout is accepted with probability exp(−ΔZ/T), and T falls by 0.05 % per move.
   - This escapes the local minima that pure pairwise exchange (CRAFT) gets stuck in.

**Result.** Z falls from 2.03 million to **0.90 million unit-load-metres per month (−56 %)**. Hall **72 × 50 m = 3578 m²**,
without offices and utility rooms.

```
dock wall
 row 1: RAW | HMC | VMC | FIN | QC | KIT | ROT | TOOL | CHIP
        ===================== AGV main aisle 6 m =====================
 row 2: SHP | PCK | PNT | TST | ASY | BUY | MNT
```

**Reading the solution.**
- The castings flow is short: RAW → HMC → FIN → QC → KIT.
- The VMC cell sits between the castings store and the finishing area.
- The product line runs **backwards** in row 2, from ASY towards the dock: ASY → TST → PNT → PCK → SHP. Finished
  compressors therefore leave right at the shipping dock.
- **BUY lands next to assembly, not at the dock.** The 3200 tank/motor loads to assembly outweigh the 600 truck loads.
  **Consequence: give BUY its own receiving door in the long side wall.** The 1-D spine model cannot place doors in side
  walls, so this is a manual correction for the detailed layout in item F11.

### 10.3 Transport → number of AGVs (input of F5)

$$t_{AGV} = \frac{\sum f_{ij}\cdot 2 d_{ij}}{v} + \sum f_{ij}\,t_{handling}$$

The factor 2 covers the empty return; v = 1 m/s; handling 60 s per move.

The assembly, test, paint and packing line runs on **conveyors** (item F4), so its flows are not AGV flows.

| Quantity | Value |
|---|---|
| Unit-load moves | 33 987 per month |
| Distance | 1279 km per month |
| AGV time | 922 h per month |
| AGV count at 75 % availability (charging, traffic) | 922/(330 · 0.75) = 3.7 → **4 AGVs** |

At × 1.2 demand the program gives 5 AGVs. Item F5 refines this with traffic and battery simulation.

---

## 11 Direct operators

Operators = Σ m_t · o_t + load stations.
- Machine attendance: VMC/lathe 1 operator per 3 machines; turn-mill, rotor mill and grinder 0.5.
- Assembly, test and paint workplaces: 1 each. Test benches: 0.5.
- The load station: 1.

**Result: 23.8 direct operators per shift, about 48 people in two shifts.** Indirect staff are in the fixed overhead.

The HMC cell has no machine operator: the load-station operator feeds four HMCs. This is the labour productivity of an
FMS, against 1 operator per stand-alone machine.

---

## 12 Investment and economic value (report §9)

| Item | EUR | Source |
|---|---|---|
| Machines (robust design) | 5 420 000 | F2 |
| HMC fixtures + rack slots | 206 000 | F2 (4 FA + 2 FC) |
| Load station | 45 000 | F2 |
| Building 3578 m² × 450 EUR/m² | 1 610 000 | F2 layout |
| AS/RS, conveyors, AGVs, ID, safety, IT, assembly tools, utilities, start-up | 5 000 000 | **placeholders** until F3–F12 |
| Working capital: 1.5 months of material | 4 493 000 | F2 |
| **Total** | **16.77 M EUR** | |

**Contribution per unit:** price × (1 − 0.12) − material.

| Product | Calculation | Contribution |
|---|---|---|
| VC20 | 1450 · 0.88 − 900 | **376 EUR** |
| RB50 | – | 408 EUR |
| RB100 | – | 560 EUR |
| RB150 | – | 760 EUR |

The 12 % covers sales, distribution, warranty and commission.

**Monthly cash flow at full rate:**
- contribution 1.347 M EUR;
- direct labour 0.071 M EUR;
- maintenance 0.018 M EUR;
- fixed overhead 0.350 M EUR;
- **net 0.908 M EUR per month.**

$$NPV = -I + \sum_{t=1}^{10}\frac{CF_t}{(1+i)^t}\qquad\Rightarrow\qquad NPV = \mathbf{51.8\ M\ EUR},\ \text{payback}\ \mathbf{2.0\ years}$$

Year 1 runs at the mean ramp-up of 70 %.

**Sensitivity with the annuity factor.** AF = (1 − 1.08⁻¹⁰)/0.08 = 6.71. A permanent change Δ in monthly cash flow
changes the NPV by 12 · Δ · AF ≈ 80.5 · Δ.

| Change | ΔCF per month | ΔNPV | NPV |
|---|---|---|---|
| VC20 price −10 % | −3000 · 145 · 0.88 = −383 kEUR | −30.8 M EUR | ≈ 21 M EUR |
| Demand × 0.7 (program run) | | | **24.4 M EUR**, payback 2.9 years |
| Demand × 1.2 (program run) | | | **68.9 M EUR**, payback 1.8 years |

> **Honesty.** These figures are reference estimates. They show the *structure* of the business case and its
> sensitivities, not a bankable plan. The price of the VC20 and its material cost decide everything: a 10 % price error
> moves the NPV by 31 M EUR. Get real quotations for the tank, motor and castings, and a market price study, before any
> investment decision.

---

## 13 Validation of the method and its limits

| Model | Validated by | Result |
|---|---|---|
| Max-flow feasibility | hand examples (self-test) | exact |
| Branch and bound | brute-force enumeration | identical cost |
| MVA code | closed formulas (balanced network, Seidmann limits) | exact |
| Simulator | exact MVA on a product-form network | 0.0 % error |
| MVA on the real cell | simulation with real variability | MVA conservative; pallets confirmed |
| Loads | F1 machine minutes × demand | identical (35 796 min HMC for VC20) |
| Layout | start solution | −56 % |

**Limits.**
1. **The alternative machine is assumed to take the same time** (alt_factor = 1). True for lathe ↔ turn-mill on simple
   turning; check it for others.
2. **Set-ups are simplified:** one time per lot and machine type, no sequence-dependent changeovers.
3. **Breakdowns are averaged into OEE.** MVA and the robustness check do not model long repairs. The simulation can be
   extended with MTBF/MTTR from the twin (thesis ch. 6).
4. **The layout is a 1-D spine model with fixed row depth.** The detailed 2-D layout comes in F11 (columns, doors,
   utilities, crane runways).
5. **No scrap or rework loops.** At 2–3 % scrap, add the same share to the loads.
6. **Economics** are reference estimates, without tax, inflation or financing costs.

---

## 14 Checklist before the results go to the supervisor or management

- [ ] `products.py selftest` and `fms_design.py selftest` both PASS.
- [ ] The programme in `fms_data.json` is agreed with sales.
- [ ] Machine prices replaced by at least two quotations per type: HMC, VMC, turn-mill, rotor mill, grinder.
- [ ] Every alternative in F1 checked: holding, reach, tolerance (5.3).
- [ ] Pallet cell: the DES confirms the MVA, and a spare fixture is planned.
- [ ] Robust design (P ≥ 90 %) or a Saturday-shift policy decided.
- [ ] Layout: dock and door positions checked against the site plan.
- [ ] NPV sensitivity to price and material cost shown, not only the base case.

---

## 15 References

- Stecke, K.E. (1983). Formulation and solution of nonlinear integer production planning problems for flexible
  manufacturing systems. *Management Science* 29(3), 273–288.
- Buzacott, J.A., Shanthikumar, J.G. (1993). *Stochastic Models of Manufacturing Systems*. Prentice Hall.
- Reiser, M., Lavenberg, S.S. (1980). Mean-value analysis of closed multichain queuing networks. *Journal of the ACM*
  27(2), 313–322.
- Baskett, F., Chandy, K.M., Muntz, R.R., Palacios, F.G. (1975). Open, closed, and mixed networks of queues with
  different classes of customers. *Journal of the ACM* 22(2), 248–260.
- Seidmann, A., Schweitzer, P.J., Shalev-Oren, S. (1987). Computerized closed queueing network models of flexible
  manufacturing systems. *Large Scale Systems* 12, 91–107. [verify volume/pages]
- Ford, L.R., Fulkerson, D.R. (1956). Maximal flow through a network. *Canadian Journal of Mathematics* 8, 399–404.
- Edmonds, J., Karp, R.M. (1972). Theoretical improvements in algorithmic efficiency for network flow problems.
  *Journal of the ACM* 19(2), 248–264.
- Kingman, J.F.C. (1961). The single server queue in heavy traffic. *Mathematical Proceedings of the Cambridge
  Philosophical Society* 57(4), 902–904.
- Hopp, W.J., Spearman, M.L. (2008). *Factory Physics*, 3rd ed. McGraw-Hill.
- Muther, R. (1973). *Systematic Layout Planning*, 2nd ed. Cahners Books.
- Kirkpatrick, S., Gelatt, C.D., Vecchi, M.P. (1983). Optimization by simulated annealing. *Science* 220(4598), 671–680.
- Tompkins, J.A., White, J.A., Bozer, Y.A., Tanchoco, J.M.A. (2010). *Facilities Planning*, 4th ed. Wiley.
- Nakajima, S. (1988). *Introduction to TPM*. Productivity Press. (OEE)

---

**Next item: F3, the AS/RS.**

| Input from F1 and F2 | Value |
|---|---|
| Casting crates | 3600 + 3067 + … unit loads per month out of RAW |
| Kitting store | 3467 + 3400 per month |
| Pallet places in the HMC cell | 9 |
| Store areas in the layout | RAW 420 m², KIT 260 m² |

F3 will deliver the rack, stacker crane, fork, drive sizing, 3D models, drawings, BOM, electrical schematics, PLC program,
WMS interface and safety.
