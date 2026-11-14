# M1 – Mechanical design method: a universal pipeline from task to best, reliable result

> Field 1 *Mechanical design*, item 1. Folder `machine+program_software+control_system design/`.
> Calculation program: `tools/dm_toolkit.py` (Python standard library, offline) – **every worked example E1–E9 in this
> guide is produced by it** (`python dm_toolkit.py examples`, check: `python dm_toolkit.py selftest`).
> All numbers are **example values**. Standards are named for orientation – work with the current edition.

## Contents
0. How to use this guide (0.1 program map – formula → function)
1. Purpose – what "best result" means
2. Where it fits (your tools, other guides)
3. Concepts – design is a loop of decisions under constraints
4. The universal pipeline S0–S9 (one table)
5. Stage by stage – theory, method, template, example
6. Safety factor, reliability and fatigue – the theory you need every day
7. From "trend" to "reliable value": making your CAE credible (SolidWorks Motion, Ansys, Abaqus, Adams)
8. Optimisation in design – formulation, methods, tools, examples
9. Design calculation programs for machine elements – do you need them? (answer + plan)
10. Tool integration map for your software set
11. Complete mini example: compressor motor-to-crank drive shaft through S0–S9
12. Gate checklists
13. Common mistakes
14. Limits
15. Standards and books
16. Glossary

**Part B – Deep reference**
17. Requirements engineering and load spectra · 18. Function structure and axiomatic design · 19. Creative methods (TRIZ,
morphology, patents) · 20. Evaluation and decision (VDI 2225, AHP, FMEA) · 21. Embodiment design · 22. Material selection +
heat treatment · 23. Design for manufacturing and cost · 24. Tolerancing, GD&T, metrology · 25. Strength and failure theory ·
26. Fatigue (FKM, strain-life, fracture mechanics) · 27. Reliability engineering · 28. FEA and MBD theory, V&V ·
29. Optimisation mathematics and algorithms · 30. DOE and statistics · 31. Topology, shape, multi-objective, robust, RBDO ·
32. Testing and validation · 33. Release to manufacturing and quality

---

## 0. How to use this guide
- New task arrives → open **section 4** (pipeline table) and walk S0 → S9. Do not skip S0–S3: most bad designs are
  bad because the task or the concept was wrong, not because the FEA was wrong.
- Every stage ends with a **gate** (section 12): a short check list. Pass the gate → next stage.
- When you calculate, follow the **analysis pyramid** (section 5.7): hand formula → standard method → FEA / MBD → test.
- When you want the *best* design (lightest, cheapest, stiffest), use **section 8** (optimisation).
- Machine elements (gears, cams, crank, shafts, bearings, bolts, springs…) are covered one by one in the next items of
  this folder, each with its own calculation program (section 9).

### 0.1 Program map – theory and program combined
Every method in this guide has a function in `tools/` that computes it. Read the formula in the chapter, then open the
function (same symbols, comments give units) and run `python <module>.py examples` to see the worked example.
`python dm_toolkit.py selftest_all` proves all modules (ALL PASS).

| Chapter | Method / formula | Module → function |
|---|---|---|
| 5.4, 20 | Weighted decision matrix | `dm_toolkit.decision_matrix`, `dm_req.weighted_total`, `break_even_weight` |
| 17 | Kano coefficients, QFD House of Quality | `dm_req.kano_coeff`, `dm_req.qfd` |
| 17 | Rainflow counting (ASTM E1049), damage-equivalent load | `dm_req.reversals`, `rainflow`, `rainflow_table`, `equivalent_load` |
| 17 | Compressor load cases from the gas cycle | `dm_req.compressor_loads` (full model: `crank.py`, M2) |
| 18 | Design matrix type, information axiom | `dm_req.design_matrix_type`, `info_uniform`, `info_normal` |
| 19 | Morphological box combinations | `dm_req.morph_count` |
| 20 | AHP (eigenvector, CI, CR), VDI 2225, decisions under uncertainty, RPN | `dm_req.ahp`, `vdi2225`, `decision_uncertainty`, `rpn` |
| 5.5, 21 | Equal-strength beam, springs series/parallel, stiffness budget, bolt load factor | `dm_embody.tapered_beam`, `springs_series`, `springs_parallel`, `stiffness_budget`, `bolt_load_factor` |
| 21 | Thermal growth, natural frequency, mounts, transmissibility, Renard numbers | `dm_embody.thermal_growth`, `natural_freq`, `mount_stiffness`, `transmissibility`, `renard` |
| 5.5, 22 | Ashby indices, plate mass ratio, penalty function | `dm_toolkit.ashby_beam`, `dm_embody.indices`, `plate_mass_ratio`, `penalty_plate` |
| 23 | Machining times, bend allowance, should-cost, DFA efficiency | `dm_embody.turning_time`, `drilling_time`, `bend_allowance`, `should_cost`, `dfa_efficiency` |
| 5.6, 24 | ISO 286 tolerance unit / IT, fits, Lamé press fit, bonus tolerance | `dm_embody.tol_unit`, `it_value`, `fit`, `lame_pressure`, `bonus_tol` |
| 5.6, 24 | Stack-up WC / RSS / Monte Carlo, cost-optimal allocation, Cp/Cpk | `dm_toolkit.stack`, `dm_embody.stack_mc`, `allocate`, `cp_cpk` |
| 25 | Principal stresses, von Mises, Tresca, Mohr–Coulomb | `dm_strength.principal_stresses`, `von_mises_principal`, `shaft_combined`, `mohr_coulomb` |
| 25 | Notch sensitivity, K_f, buckling, Hertz line / point, Lamé | `dm_strength.peterson_q`, `kf_from_kt`, `buckling_rod`, `hertz_line`, `hertz_point`, `lame` |
| 6.3, 26 | Marin + Goodman, Basquin, S-N life, mean stress, FKM M_σ | `dm_toolkit.marin_goodman`, `dm_strength.basquin`, `sn_life`, `mean_stress`, `fkm_M` |
| 26 | Rainflow + Miner (elementary / original / Haibach), strain-life (Neuber), Paris crack growth, FKM local | `dm_strength.rainflow`, `miner`, `neuber_strain_life`, `paris_life`, `fkm_local` |
| 6.2, 27 | Stress–strength interference (normal, lognormal), FORM, Monte Carlo | `dm_toolkit.interference`, `dm_strength.lognormal_interference`, `form_hlrf`, `monte_carlo` |
| 27 | Weibull, Weibull fit, k-out-of-n, success run, ISO 281 a1 | `dm_strength.weibull`, `weibull_fit`, `k_out_of_n`, `success_run`, `iso281_a1` |
| 5.7, 28 | GCI mesh convergence | `dm_toolkit.gci` |
| 28 | FEA bar chain assembly, Gauss integration, explicit time step, singularity growth, MAC, Hertz contact stiffness | `dm_strength.bar_chain`, `gauss2`, `wave_dt`, `singular_growth`, `mac`, `hertz_k_sphere` |
| 8, 29 | Shaft sizing optimisation, Nelder–Mead | `dm_toolkit.shaft_opt`, `nelder_mead` |
| 29 | KKT examples, steepest descent / Newton, BFGS, FD step, augmented Lagrangian, GA, RSM, standard sizes, EI | `dm_opt.kkt_example`, `beam_kkt`, `descent_demo`, `bfgs`, `fd_step`, `aug_lagrangian`, `ga`, `spring_rsm`, `spring_discrete`, `expected_improvement` |
| 8.4, 30 | 2^k effects, ANOVA + F-test p-value, aliasing, LHS, CCD | `dm_toolkit.doe_effects`, `dm_opt.anova_2k`, `f_pvalue`, `alias_structure`, `frac_2_4_1`, `lhs`, `ccd_points` |
| 31 | Truss topology, Pareto front, Taguchi loss + S/N, RBDO | `dm_opt.truss_topology`, `cantilever_pareto`, `taguchi_loss`, `sn_ratios`, `rbdo_shaft` |
| 32 | Strain-gauge bridges, rosette, FFT plan, Arrhenius, success run / Lipson, inverse power law | `dm_opt.bridge`, `rosette_rect`, `fft_plan`, `arrhenius`, `success_run`, `lipson`, `inverse_power` |
| 33 | X̄-R chart, Cp/Cpk/Pp/Ppk, gauge R&R | `dm_opt.xbar_r`, `capability`, `grr` |

---

## 1. Purpose – what "best result" means
A design is **best** when it meets **all demands** (must-haves), reaches the **wishes** as far as cost allows, and you
can **prove** it (calculation + test) – at the lowest life-cycle cost.

| Quality of a result | Meaning | How you get it |
|---|---|---|
| **Correct** | Does the right job (right requirements) | S0 task clarification, S1 function analysis |
| **Good** | Good concept, simple, robust | S2–S3 concept generation + evaluation |
| **Safe / reliable** | Will not fail in its life with known probability | S6 verification, section 6 reliability, S8 tests |
| **Best** | Optimum within constraints (mass, cost, stiffness…) | Section 8 optimisation |
| **Makeable** | Can be manufactured, assembled, inspected at the planned cost | S5 DFM/DFA, tolerances, S9 release |
| **Provable** | Every number traceable: input, method, result, check | Calculation reports, credibility level (section 7) |

---

## 2. Where it fits

### 2.1 Your current tool status (from your message) and the target

| Tool | Today | Target after this guide |
|---|---|---|
| SOLIDWORKS CAD | Correct parts | + design variables (global variables / design tables) for optimisation |
| SOLIDWORKS Motion | Dynamics analysis | Verified against hand kinematics + energy check; loads exported to FEA |
| Ansys, Abaqus | Trend only | **Credibility level 2–3** (section 7): converged, checked, validated → values you can sign |
| Adams | Trend only | Validated contact / friction parameters, flexible bodies (guide 54 C16), loads → fatigue |
| NX CAM | Manufacturing | Fed by released models with PMI / tolerances (S9) |
| MATLAB | Mathematics | **Hub**: hand models, standard calculations, optimisation (fmincon, ga), DOE, post-processing |
| Optimisation | Not used | Sizing optimisation + DOE in every important design (section 8) |

### 2.2 Related guides
Guide 10 (mechanics of the twin), 14 (engineering formulas index), 16 (standards register), 52 (CAD/CAE/CAM software),
53 (co-simulation), 54 (63 coupled chains + modules).

---

## 3. Concepts – design is a loop of decisions under constraints

**Design** = choosing values for **design variables** x (geometry, material, process) so that the product meets
**requirements** under **constraints** with the best **objective**. In mathematics (section 8):

  minimise f(x)  subject to  g_i(x) ≤ 0 ,  h_j(x) = 0 ,  x_lower ≤ x ≤ x_upper

You do this in every design, even by hand – the method makes it **explicit, repeatable and checkable**.

Three ideas behind all good design methods:

| Idea | Meaning | Source |
|---|---|---|
| **Systematic stages** | Clarify → concept → embody → detail, each with a gate | VDI 2221-1:2019, Pahl & Beitz |
| **V-model** | Requirements on the left are verified by tests on the right at the same level (system, subsystem, part) | VDI 2206:2021 (mechatronic), systems engineering |
| **Iteration with growing fidelity** | Cheap models first (hand), expensive models later (FEA, test) – only for what matters | Analysis pyramid, DFSS |

```
 Requirements (system) ─────────────────────────────────────────► System test / validation
     Requirements (subsystem) ───────────────────────────► Subsystem test
          Part design + calculation ─────────────► Part test / inspection
                         Detail design + manufacture
```

**Cost of change rule:** a change costs about ×10 more at each later stage (concept → drawing → prototype → production).
→ Spend time early (S0–S3).

---

## 4. The universal pipeline S0–S9

| Stage | Question | Main output | Methods | Your tools | Gate (section 12) |
|---|---|---|---|---|---|
| **S0 Task clarification** | What exactly must it do? | Requirement list (quantified, demand/wish, verification method), load cases | Requirement list, QFD, standards search, load spectrum | Excel, MATLAB | G0 |
| **S1 Function + physics** | Which functions, which physics? | Function structure, first-principles model, key parameters | Function analysis, axiomatic design, dimensional analysis | MATLAB | G1 |
| **S2 Concept generation** | Which solutions exist? | 3–6 concept variants | Morphological box, TRIZ, benchmarking, patents | Sketches, SOLIDWORKS rough | G2 |
| **S3 Concept evaluation** | Which is best? | Chosen concept + risks | Weighted matrix (E1), Pugh, early FMEA | Excel / toolkit | G3 |
| **S4 Embodiment + sizing** | How big, what material, which layout? | Layout, main dimensions, materials, standard parts | Design principles, Ashby (E7), hand + standard calcs, stiffness budget | MATLAB, element programs (section 9), SOLIDWORKS | G4 |
| **S5 Detail design** | Every part makeable and inspectable? | 3D + drawings, tolerances, fits, surfaces, BOM | GD&T, tolerance stack (E5), DFM/DFA | SOLIDWORKS, NX | G5 |
| **S6 Verification by analysis** | Does it meet the numbers? | Calculation report with credibility level | Analysis pyramid, V&V, GCI (E2), fatigue (E4) | Ansys, Abaqus, Adams, SW Motion | G6 |
| **S7 Optimisation** | Can it be better? | Optimum + sensitivity + robustness | DOE (E6), sizing opt. (E8/E9), reliability (E3) | MATLAB, Ansys DesignXplorer / optiSLang, SW Design Study | G7 |
| **S8 Validation by test** | Does the real part behave as calculated? | Test report, model correlation | Strain gauge, modal test, endurance test, accelerated test | DAQ, MATLAB | G8 |
| **S9 Release + feedback** | Can production start? Did we learn? | Released data, control plan, FAI, lessons learned | Change management, PFMEA, control plan | PDM, NX CAM | G9 |

S6 and S7 are a loop: analyse → optimise → analyse the optimum again. S8 can send you back to S4–S6.

---

## 5. Stage by stage

### 5.1 S0 – Task clarification

**Theory.** A requirement is only useful when it is **quantified, verifiable and traceable**. "Strong", "quiet",
"cheap" are not requirements; "≤ 72 dB(A) at 1 m (ISO 3744)" is.

**Requirement list template**

| ID | Requirement | Value + unit | D/W | Source | Verification | Status |
|---|---|---|---|---|---|---|
| R01 | Free air delivery | ≥ 20 m³/h at 0.8 MPa (ISO 1217) | D | Customer | Test bench | open |
| R02 | Crank speed | 1450 rpm ± 2 % | D | Motor / belt | Calc + test | open |
| R03 | Noise | ≤ 72 dB(A) at 1 m | W | Market | ISO 3744 test | open |
| R04 | Life of crank train | ≥ 20 000 h at 100 % duty | D | Spec | Calc (fatigue + bearings) + endurance test | open |
| R05 | Mass of pump | ≤ 45 kg | W | Handling | Weigh | open |
| R06 | Unit cost | ≤ … USD at 5 000 pcs/yr | D | Business | Cost calc | open |
| R07 | Safety | Machinery Regulation (EU) 2023/1230, EN 1012-1, PED for tank | D | Law | Risk assessment ISO 12100 | open |

D = demand (must, pass/fail), W = wish (weighted, more is better).

**Load cases = the most important input of all calculations.** Write them down at S0:

| Case | Description | Example |
|---|---|---|
| LC1 Normal operation | Nominal speed, pressure, temperature | 1450 rpm, 0.8 MPa, 40 °C ambient |
| LC2 Maximum operation | Worst normal condition | 0.9 MPa (safety valve set), 45 °C |
| LC3 Start / stop | Motor start torque, inertia | Star-delta or DOL ≈ 2–3 × nominal torque |
| LC4 Fault / misuse | Blocked valve, overpressure, wrong rotation | Safety valve 1.1 × p_max |
| LC5 Transport / assembly | Drop, lifting, bolt tightening | 2 g vertical, lifting eye |
| LC6 Fatigue spectrum | Load cycles over life | 20 000 h · 1450 · 60 = **1.74 · 10⁹ cycles** → infinite-life design |

**QFD (House of Quality)** links customer wishes → engineering characteristics with weights 1–3–9. Use it when there
are many customer wishes; for small parts a requirement list is enough.

### 5.2 S1 – Function analysis and physics

**Function structure.** Describe the product as conversion of **energy, material, signal**:
Compressor: electric energy → mechanical rotation → reciprocating motion → compressed air + heat; signal: pressure
switch → motor on/off. Each sub-function (convert, transmit, guide, seal, cool, store) is a box.

**Axiomatic design (Suh).** Independence axiom: each functional requirement FR should be controlled by its own design
parameter DP.

  {FR} = [A] · {DP}

| Matrix [A] | Name | Meaning |
|---|---|---|
| Diagonal | Uncoupled | Best: tune each FR alone |
| Triangular | Decoupled | OK if you set DPs in the right order |
| Full | Coupled | Every change disturbs everything → redesign |
Example: valve plate must (FR1) open fast and (FR2) last 10⁹ cycles. DP1 = reed thickness affects both → coupled.
Adding DP2 = stop-plate lift height (limits stress) makes it decoupled: choose thickness for response, lift for stress.

**First-principles model.** Before CAD, write the governing equations of the main function (here: crank kinematics,
gas force F = p·A, inertia force F = m·r·ω²·(cos φ + λ cos 2φ)). It tells you which parameters matter
(→ design variables x) and gives the numbers to check every later FEA/MBD result. The crank, gear and cam items of this
folder give these models with programs.

**Dimensional analysis (Buckingham Π).** Reduces many variables to few dimensionless groups (Reynolds, λ = r/l,
safety factor, Π = stiffness ratio) → fewer runs in DOE and scaling from test models.

### 5.3 S2 – Concept generation

**Morphological box** – sub-functions in rows, solution principles in columns, combine one per row:

| Sub-function | Option 1 | Option 2 | Option 3 |
|---|---|---|---|
| Drive | V-belt | Direct coupling | Gearbox |
| Crank bearing | Ball bearings | Roller bearings | Plain bearings |
| Cylinder cooling | Air fins + fan | Water jacket | Oil-cooled |
| Valve type | Reed (flapper) | Ring plate | Poppet |
Concept A = belt + ball + fins + reed (classic), B = direct + roller + fins + ring plate, …

**TRIZ (Altshuller)** – solve a **contradiction** instead of compromising.
Example: reed valve must be **thin** (light, fast) **and thick** (fatigue strength). Inventive principles that help:
#1 Segmentation (two thinner reeds stacked), #3 Local quality (tapered reed, thick at root), #40 Composite / better
material (stainless spring steel 1.4310 / Sandvik valve steel, shot-peened). Result: tapered shot-peened reed.

**Benchmarking + patents:** take apart 2–3 competitor products, measure; search patents (Espacenet, offline copy) to
avoid infringement and get ideas.

### 5.4 S3 – Concept evaluation

**Weighted decision matrix** (VDI 2225 style): weights w_k (sum 1), scores s_k (1…5), total = Σ w_k·s_k.

**Example E1 – drive concept** (`dm_toolkit.py`):

| Criterion | Weight | V-belt | Direct coupling | Gearbox |
|---|---|---|---|---|
| Cost | 0.30 | 5 | 4 | 2 |
| Efficiency | 0.20 | 3 | 5 | 4 |
| Noise | 0.15 | 4 | 3 | 2 |
| Maintenance | 0.20 | 3 | 4 | 3 |
| Size | 0.15 | 3 | 4 | 4 |
| **Total** | 1.00 | **3.75 (75 %)** | **4.05 (81 %)** | **2.90 (58 %)** |

Rules: demands are checked first (a concept that fails a demand is out, whatever its score); a difference < 10 % is a
tie → look at risk; do a **sensitivity check** – change the biggest weight ± 0.1 – does the winner change? Here a belt
still allows a speed change by pulley swap (wish for variants) – write such points next to the score.
**Pugh method:** compare all concepts against a reference (+ / 0 / −) – fast for first screening.
**Early FMEA:** for the chosen concept list failure modes, effect, cause, severity S × occurrence O × detection D = RPN
(or the AIAG-VDA action priority) → tells you what must be calculated or tested first.

### 5.5 S4 – Embodiment and sizing

**Basic rules (Pahl & Beitz): clear – simple – safe.**
Clear: every function has a defined, calculable load path. Simple: few parts, simple shapes. Safe: direct safety
(safe-life / fail-safe / redundancy), not warnings.

**Embodiment principles**

| Principle | Meaning | Machine example |
|---|---|---|
| Direct, short force flow | Loads take the shortest path, no sudden changes of section | Crank web with large fillet, bearing close to load |
| Division of tasks | One element per function | Separate seal from bearing; key transmits torque, shaft shoulder locates |
| Self-help / self-reinforcing | Load increases the function | Pressure-energised seal, self-energising brake |
| Equal strength | All sections similarly loaded | Tapered shaft, tapered reed |
| Stability / no redundancy | Statically determined support | Locating + floating bearing (thermal growth) |
| Thermal growth allowed | Parts can expand | Floating bearing, sliding fit of cylinder |

**Material selection with Ashby indices.** For a **light, stiff beam** (bending, size free) the mass is
m ∝ ρ / E^½ → maximise **M = E^½ / ρ**. Example E7:

| Material | E GPa | ρ kg/m³ | M = E^½/ρ | Mass vs best |
|---|---|---|---|---|
| CFRP (quasi-isotropic) | 60 | 1600 | 153.1 | 1.00 |
| Al 6082-T6 | 70 | 2700 | 98.0 | 1.56 |
| Steel S355 | 210 | 7850 | 58.4 | 2.62 |
| Grey iron EN-GJL-250 | 110 | 7200 | 46.1 | 3.32 |
Other indices: light strong tie (σ_f / ρ), light stiff plate (E^⅓ / ρ), spring (σ_f² / E), thermal distortion
(λ / α). Then check cost, process (casting, machining), damping (grey iron damps vibration well → good for crankcase),
availability.

**Stiffness budget.** For machines, stiffness often decides, not strength. Split the allowed deflection between parts
(springs in series 1/k = Σ 1/k_i) – e.g. spindle 40 %, bearings 30 %, housing 30 %.

**Hand sizing first** with formulas + standards (section 9): σ = M/W, τ = T/W_p, deflection, bearing life
L10 = (C/P)^p, bolt preload, key pressure… These give the main dimensions in minutes and the numbers to check CAE later.

### 5.6 S5 – Detail design

- **Tolerances:** ISO 286 fits (H7/g6 sliding, H7/k6 transition, H7/p6 press), ISO 2768 general tolerances,
  ISO 1101 GD&T (position, runout, flatness), ISO 8015 independence principle (or envelope Ⓔ where needed).
- **Surface:** Ra by function (bearing seat Ra 0.8, seal running surface Ra 0.2–0.8 with no lead, honed bore
  plateau Rk/Rpk/Rvk).
- **Tolerance stack-up:** worst case T_WC = Σ|t_i|; statistical RSS T_RSS = √(Σ t_i²) (needs capable processes;
  Bender factor 1.5 for safety).

**Example E5** – four tolerances ±0.05, ±0.10, ±0.02, ±0.03 mm: worst case **±0.200**, RSS **±0.1175**,
RSS × 1.5 **±0.176**. Use WC for safety-critical or small lots; RSS for large lots with Cpk ≥ 1.33.

- **DFM:** standard tools and radii, accessible features, no deep narrow pockets, datum features that the
  machine can clamp, one set-up for related features (see guide 49 machine tools).
- **DFA (Boothroyd–Dewhurst):** assembly efficiency **E_ma = 3 · N_min / t_total** (3 s ideal time per part).
  Example: 12 parts, theoretical minimum 5, total assembly 60 s → E_ma = 15 / 60 = **25 %** → combine parts.
- **Drawing check:** every dimension needed for function has a tolerance; datums match the function and the
  inspection; material, heat treatment, surface hardness and depth, coating, marking.

### 5.7 S6 – Verification by analysis: the analysis pyramid

```
            ┌──────────────┐  Test (S8)  – truth, expensive
           ┌┴──────────────┴┐ FEA / MBD / CFD – detail, needs V&V
          ┌┴────────────────┴┐ Standard methods (ISO 6336, DIN 743, VDI 2230, ISO 281, FKM)
         ┌┴──────────────────┴┐ Hand formulas + first-principles model – fast, always
```
**Rule:** never run FEA without a hand estimate of the answer. If FEA and hand differ by > 20–30 % and you
cannot explain why, the FEA is wrong until proven otherwise.

**Example E10 – hand check of an FEA run.** Cantilever 20 × 20 mm steel, L = 200 mm, F = 1000 N:
I = 20⁴/12 = 13 333 mm⁴, δ = F·L³ / (3·E·I) = 1000·200³ / (3·210 000·13 333) = **0.952 mm**.
FEA gives 0.97 mm → +1.9 % (shear deformation + root flexibility) → plausible.

**Verification (solving the equations right)**:
- **Code verification:** solver reproduces known solutions (patch test, textbook cases) – done once per tool.
- **Solution verification:** mesh / time-step convergence. Use the **Grid Convergence Index (Roache)** with three meshes,
  constant refinement ratio r:

  p = ln((f₃ − f₂)/(f₂ − f₁)) / ln r  f_ext = f₁ + (f₁ − f₂)/(r^p − 1)  GCI = 1.25·|(f₁ − f₂)/f₁| / (r^p − 1)

**Example E2** – peak stress at a crank fillet, meshes h, 2h, 4h (r = 2): f₁ = 212.0, f₂ = 206.5, f₃ = 190.0 MPa
→ order p = **1.58**, extrapolated **214.8 MPa**, GCI fine **1.62 %**, GCI medium 4.99 %, asymptotic ratio **1.03**
(≈ 1 → meshes in the asymptotic range). Report: σ = 212 MPa ± 1.6 % (discretisation). If f keeps growing
without limit → **singularity** (sharp corner, point load) – model the real fillet or read stress away from it.

**Validation (solving the right equations)**: compare with **test** on the real or a similar part (S8): strains,
deflections, natural frequencies. The difference gives the **model error band** used later.

### 5.8 S7 – Optimisation → section 8.

### 5.9 S8 – Validation by test

| Test | Measures | Correlation target (typical) |
|---|---|---|
| Static strain-gauge test | Strain at hot spots, deflection | FEA within ± 10–15 % at gauge position |
| Modal (tap) test | Natural frequencies, mode shapes | Frequencies ± 5 %, MAC > 0.9 (guide 54 C61) |
| Operating measurement | Accelerations, temperatures, forces | MBD / CFD trend and level ± 15–20 % |
| Endurance test | Life, failure location | No failure up to target (with test factor) |
| Accelerated test | Higher load → shorter time | Same failure mode as field |

**Accelerated test (Basquin S-N law):** N₂ = N₁ · (S₁/S₂)^k. Raising stress amplitude from 100 to 130 MPa with slope
k = 8 shortens test time by 1.3⁸ = **8.2 ×**. Only valid while the failure mode stays the same (no yielding, no new
mechanism).

**Damage accumulation (Palmgren–Miner):** D = Σ n_i / N_i ≤ D_allow (1.0 classic; 0.3–0.5 recommended by FKM for
safety). Example: 10⁶ cycles at a level with N = 5·10⁶ plus 10⁵ cycles with N = 3·10⁵ → D = 0.2 + 0.333 = **0.53**.

### 5.10 S9 – Release and feedback
Released 3D + drawings + PMI, BOM, material and heat-treatment specs, inspection plan (critical characteristics from
FMEA), process FMEA, control plan, first article inspection (FAI, e.g. AS9102-style or PPAP), change management (ECR/ECO),
**lessons learned** written into your design rules and into the calculation programs (they become better each project).

---

## 6. Safety factor, reliability and fatigue

### 6.1 Deterministic safety factor
n = strength / stress (static: R_e / σ_vM; fatigue: from Goodman etc.). Typical ranges:

| Situation | Static n (to yield) | Fatigue n |
|---|---|---|
| Well-known loads, material certified, tests done | 1.25–1.5 | 1.3–1.5 |
| Normal machine design | 1.5–2.0 | 1.5–2.0 |
| Uncertain loads / material / brittle (cast iron to R_m) | 2.0–3.0 (R_m: 3–4) | 2.0–3.0 |
| Risk to people (lifting, pressure) | Code-defined (EN 13001, EN 13445, …) | Code-defined |
FKM guideline gives safety factors by consequence of failure and inspection possibility – use it for machine parts.

### 6.2 Stress–strength interference (probability of failure)
Strength S ~ N(μ_S, σ_S), stress L ~ N(μ_L, σ_L):

  z = (μ_S − μ_L) / √(σ_S² + σ_L²)    R = Φ(z)

**Example E3:** μ_S = 350, σ_S = 25 MPa; μ_L = 220, σ_L = 30 MPa → central safety factor 1.59, z = **3.33**,
R = **0.99956** → **436 failures per million**. The same SF 1.59 with half the scatter gives z = 6.7 (≈ 0 ppm).
→ **Reducing scatter (process control, load control) is as effective as adding material.** This is the base of
robust design and reliability-based optimisation (section 8.6).

### 6.3 Fatigue (high cycle, steel) – Marin factors and Goodman
Endurance limit of the part: **S_e = k_a · k_b · k_c · k_d · k_e · S_e′**, S_e′ ≈ 0.5·R_m (R_m ≤ 1400 MPa).

| Factor | Meaning | Formula / value |
|---|---|---|
| k_a surface | Rougher → lower | a · R_m^b (machined a = 4.51, b = −0.265; ground 1.58, −0.085) |
| k_b size | Bigger → lower | 1.24·d^−0.107 (2.79–51 mm) |
| k_c load | Bending 1, axial 0.85, torsion 0.59 | |
| k_d temperature | | 1 up to ≈ 250 °C |
| k_e reliability | 50 % 1.0, 90 % 0.897, 99 % 0.814, 99.9 % 0.753 | |
| K_f notch | Applied to stress | K_f = 1 + q·(K_t − 1) |

Modified Goodman: **1/n_f = σ_a/S_e + σ_m/R_m**; yield check (Langer) n_y = R_e / (σ_a + σ_m).

**Example E4** – C45 shaft, R_m = 650, R_e = 430 MPa, d = 30 mm, machined, 99 % reliability, σ_a = 80, σ_m = 60 MPa:
S_e′ = 325, k_a = 0.811, k_b = 0.862, k_e = 0.814 → **S_e = 184.8 MPa** → **n_f = 1.90**, n_y = 3.07.
(`python dm_toolkit.py goodman 650 430 30 80 60 machined 99`.) For a real design use DIN 743 (shafts) or the FKM
guideline – they include notch, size, surface and mean-stress effects in detail; the shaft item of this folder does it.

---

## 7. From "trend" to "reliable value": making your CAE credible

### 7.1 Credibility levels (use them in every report)

| Level | Name | What has been done | Use the result for |
|---|---|---|---|
| L0 | Picture | Run without checks | Nothing except ideas |
| L1 | Verified numerically | Units, BCs, convergence (GCI), reactions = loads, energy checks | Comparing variants (**trend**) – where you are today |
| L2 | Checked by independent method | Within ± 10–20 % of hand calc / standard method, or explained | Design decisions with normal safety factor |
| L3 | Validated by test | Correlated with test on the same or similar part, error band known | Final sizing, reduced safety factor |
| L4 | Predictive with uncertainty | L3 + uncertainty of inputs propagated (Monte Carlo / UQ) | Reliability-based design, warranty prediction |
Reference: ASME V&V 10-2019 (computational solid mechanics), NAFEMS "What is verification and validation".

### 7.2 Why your results are only "trend" today – the 10 usual causes

| # | Cause | Effect | Fix |
|---|---|---|---|
| 1 | Boundary conditions too stiff (fixed faces) | Wrong stress near supports, too high stiffness | Model the real support (bolts, bearings as springs, remote points with correct behaviour) |
| 2 | Wrong load introduction (point loads) | Singularities | Distribute over real contact area, bearing load (cosine) |
| 3 | No mesh convergence | Stress depends on mesh | GCI (E2), refine at hot spots, quadratic elements |
| 4 | Stress singularities read as real | Too high values | Model fillets; read at 0.4t/1.0t hot-spot (IIW) for welds |
| 5 | Material data from library | ± 20–50 % in fatigue | Use certificate / standard values, true stress-strain for plasticity |
| 6 | Contact settings by default | Wrong load sharing, bolted joints wrong | Friction coefficient from test/standard, bolt pretension, check contact status and penetration |
| 7 | Linear model for nonlinear behaviour | Wrong when yielding / large deflection / gap | Use nonlinear geometry / material / contact when needed |
| 8 | Dynamic effects ignored or MBD contact parameters guessed | Wrong peak forces | Contact stiffness / damping from Hertz + test; time-step study |
| 9 | Units (mm vs m, N vs kN, tonne-mm-s in Abaqus) | Orders of magnitude | Unit system written on top of every model; check mass of model = CAD mass |
| 10 | No comparison with anything | Nobody knows | Analysis pyramid: hand → standard → FEA → test |

### 7.3 Tool-by-tool checklist

**SOLIDWORKS Motion / Adams (multibody)**
- Mass, centre of gravity, inertia of every body = CAD mass properties.
- Kinematics check: positions / velocities of the crank train vs hand formula (crank item program) within 0.5 %.
- Energy check: input work = kinetic + potential + dissipated (friction) – error < 1–2 %.
- Contact: stiffness k from Hertz (k ≈ (4/3)·E*·√R* for sphere-type), exponent 1.5 (metal), damping ≈ 0.1–1 % of k,
  penetration depth ≈ 0.01–0.1 mm – vary ± 50 % and check the result changes < 5 %; otherwise the result depends on a
  guess → measure or use a joint instead of contact.
- Integrator: error tolerance 1e-4 → 1e-5 and maximum step halved → peak forces must change < 2 %.
- Redundant constraints: remove them (bushings or correct joint types), otherwise reaction forces are arbitrary.
- Flexible parts where stiffness matters (crankshaft, conrod, frame): flexible body (guide 54 C16).

**Ansys Mechanical / Abaqus (FEA)**
- Units written on the model; mass = CAD mass (± 1 %).
- Reaction forces = applied loads (± 0.5 %); free-free modal: 6 rigid modes ≈ 0 Hz.
- Mesh: quadratic tetrahedra (SOLID187 / C3D10) or hex; ≥ 2–3 elements through thin walls; GCI < 5 % at hot spots.
- Contacts: check status (open / sticking / sliding), penetration < 1–5 % of element size; bolt pretension load step first.
- Nonlinear: load–displacement curve smooth, convergence history, energy balance (Abaqus: ALLAE / ALLIE < 5–10 %
  for hourglass in explicit; ALLKE / ALLIE < 5 % for quasi-static explicit).
- Fatigue: stress at real fillet radius with K_t built in → do not add K_t again; use local S-N or FKM local approach.
- Report: inputs (geometry version, material source, loads with LC number), mesh study, checks, results with
  uncertainty, credibility level.

### 7.4 Calibration loop (how to reach L3 for your company)
1. Choose 2–3 **reference parts** you make often (shaft, bracket, crankcase rib).
2. Calculate (FEA + hand + standard) **before** testing; write the prediction.
3. Test: strain gauges at the hot spot, deflection dial gauge, tap test frequencies.
4. Compare: error = (FEA − test)/test. Typical good result: static ±10 %, frequency ±5 %.
5. Fix the modelling rules (supports, contact, mesh size) until the error is inside the band – write them into a
   **company modelling guideline** (one page per part type).
6. From now on all similar parts can be calculated to L3 with known error band → you may use smaller safety factors.

### 7.5 Simulation report template (1–3 pages)
Purpose and question · geometry ID + version · materials + source · load cases (LC table) · BCs + contacts (picture) ·
mesh + convergence (GCI) · checks (mass, reactions, hand calc) · results (table + plots at the same scale) ·
uncertainty and credibility level · conclusion = answer to the question · next steps.

---

## 8. Optimisation in design

### 8.1 Formulation – the most important step
Write the problem in words and then in symbols **before** using any tool:

| Element | Question | Example (shaft E8) |
|---|---|---|
| Design variables x | What may change? Ranges? | Outer diameter d_o 10–50 mm, inner d_i ≥ 0 |
| Objective f(x) | What is "best"? | Minimum cross-section area (∝ mass) |
| Constraints g(x) ≤ 0 | What must hold? | σ_vM ≤ R_e/n = 177.5 MPa; twist ≤ 1.0 °/m; wall ≥ 3 mm; d_o ≤ 50 mm |
| Parameters | Fixed inputs | T = 200 N·m, M = 150 N·m, G = 80 GPa, R_e = 355 MPa, n = 2 |
| Model | How f and g are computed | Formulas (here), FEA, MBD, or a surrogate |

Normalise constraints (g = σ/σ_allow − 1 ≤ 0) so all are of size ≈ 1.

### 8.2 Types of structural optimisation

| Type | Changes | Stage | Tools |
|---|---|---|---|
| **Sizing / parameter** | Dimensions, thicknesses, material grade | S4–S7 | MATLAB fmincon, SOLIDWORKS Design Study, Ansys DesignXplorer / optiSLang, Adams Insight |
| **Shape** | Boundary form (fillet contour, free shape) | S6–S7 | Ansys / Abaqus Tosca shape, mesh morphing |
| **Topology** | Where material should be at all | S4 (concept of a part) | Ansys Topology Optimization, Abaqus Tosca, SOLIDWORKS Topology Study, Altair Inspire |
| **Multi-objective** | Trade-off (mass vs stiffness vs cost) | S3–S7 | gamultiobj (MATLAB), optiSLang, NSGA-II |
| **Robust / reliability-based** | Optimum that stays good with scatter | S7 | Monte Carlo + optimiser, optiSLang robustness, FORM |

### 8.3 Methods – which to choose

| Method | How it works | Good for | Weak point |
|---|---|---|---|
| Gradient (SQP: fmincon) | Follows the slope, handles constraints exactly | Smooth problems, many variables, cheap models | Local optimum; noisy FEA gradients |
| Simplex (Nelder–Mead: fminsearch) | Moves a simplex, no gradients | Few variables, noisy functions | No constraints → use penalty; slow for > 10 variables |
| DOE + response surface | Run planned points, fit polynomial / Kriging, optimise the surface | Expensive FEA (10–100 runs) | Surrogate error – verify optimum with a real run |
| Genetic algorithm (ga), particle swarm | Population, random search | Discrete variables (standard sizes), multimodal | Many evaluations (hundreds–thousands) |
| Topology (SIMP) | Density per element 0–1, penalised stiffness E(ρ) = ρ^p·E₀ (p ≈ 3) | Concept shape of parts | Result must be re-designed for manufacture |

Practical rule: **cheap analytic model → fmincon directly; expensive FEA → DOE + surrogate (or optiSLang MOP) → verify.**

### 8.4 Design of experiments (DOE)
**Full factorial 2^k:** each factor at low (−1) and high (+1). Effect of a factor = mean response at + minus mean at −.
**Example E6** – crank-web peak stress (FEA runs, example values), factors F1 fillet radius 2 → 4 mm, F2 web thickness
12 → 16 mm, F3 material grade (lower → higher E-modulus variant; small effect):

| Run | F1 | F2 | F3 | σ_max MPa |
|---|---|---|---|---|
| 1 | − | − | − | 182 |
| 2 | + | − | − | 151 |
| 3 | − | + | − | 168 |
| 4 | + | + | − | 139 |
| 5 | − | − | + | 176 |
| 6 | + | − | + | 147 |
| 7 | − | + | + | 160 |
| 8 | + | + | + | 133 |
Effects: **F1 −29.0**, F2 −14.0, F3 −6.0 MPa; interactions ≈ ±1 MPa (negligible); mean 157 MPa.
→ The fillet radius is twice as important as the web thickness: spend the design effort there.
Larger k: fractional factorial 2^(k−p), Plackett–Burman (screening), Box–Behnken / central composite (quadratic
response surfaces), Latin hypercube (for surrogates). MATLAB: `fullfact`, `ff2n`, `bbdesign`, `ccdesign`, `lhsdesign`
(Statistics and Machine Learning Toolbox).

### 8.5 Example E8 / E9 – minimum-mass hollow shaft (sizing optimisation)
Problem: section 8.1 table. Two solutions in `dm_toolkit.py`:
- **E8 exhaustive search + bisection** (robust, global): **d_o = 42.25 mm, d_i = 36.25 mm**, A = **369.9 mm²**,
  σ_vM = 67.6 MPa (≪ 177.5), twist = **1.000 °/m (active)**, wall = **3.0 mm (active)**.
- **E9 Nelder–Mead with penalty** (fminsearch-style): d_o = 42.24, d_i = 36.24 mm, A = 369.9 mm² – same optimum.
- Best **solid** shaft for the same constraints: d = 34.76 mm, A = 949.0 mm² → hollow saves **61 %** mass.
Lessons: (1) the optimum lies on **active constraints** (here twist + minimum wall, not stress) – the stiffness
requirement, not strength, sizes the shaft; (2) if you relax the wall limit the optimiser will make an impossibly thin
tube – every manufacturing limit must be a constraint; (3) then round to standard tube sizes and re-check.

**Same problem in MATLAB (Optimization Toolbox):**
```matlab
T = 200; M = 150; allow = 355/2; G = 80000; phimax = 1.0; tmin = 3; domax = 50;   % N*m, MPa, deg/m, mm
I4   = @(x) x(1)^4 - x(2)^4;
sig  = @(x) sqrt((32*M*1e3*x(1)/(pi*I4(x)))^2 + 3*(16*T*1e3*x(1)/(pi*I4(x)))^2);
phi  = @(x) rad2deg(T*1e3*1000/(G*pi*I4(x)/32));
area = @(x) pi/4*(x(1)^2 - x(2)^2);
nonlcon = @(x) deal([sig(x)/allow - 1; phi(x)/phimax - 1], []);   % g <= 0, no equalities
A = [-1 1]; b = -2*tmin;                % d_i - d_o <= -2 t_min  (wall)
lb = [10 0]; ub = [domax domax];
opts = optimoptions('fmincon','Display','iter');
x = fmincon(area, [45 30], A, b, [], [], lb, ub, nonlcon, opts)  % expect about [42.25 36.25]
```
For standard sizes (discrete): `ga` with `IntCon`, or list catalogue tubes and pick the lightest feasible.

**Optimising with FEA / CAD in the loop (your tools):**

| Tool chain | How |
|---|---|
| SOLIDWORKS Design Study | Dimensions / global variables as variables, Simulation results as constraints, objective mass → built-in optimiser (good for 2–6 variables, static) |
| Ansys Workbench parameters + DesignXplorer / optiSLang | Mark CAD dimensions as parameters (DS_ prefix in SOLIDWORKS or Workbench parameter), outputs as parameters → DOE → response surface → optimum → verification point |
| Abaqus + Python + MATLAB | MATLAB writes .inp (or calls Abaqus Python), runs solver, reads .odb results → fmincon / surrogate (guide 54 C59) |
| Adams Insight | DOE on Adams design variables (spring rates, masses, lengths) → response surface |
| MATLAB as master | `fmincon` / `surrogateopt` call any tool by system command; cache results; parallel runs (Parallel Computing Toolbox) |

### 8.6 Multi-objective, robust and reliability-based design
- **Pareto front:** set of designs where one objective cannot improve without another getting worse (e.g. mass vs
  deflection). Choose the knee point. MATLAB `gamultiobj` / `paretosearch`.
- **Robust design (Taguchi idea):** choose nominal values where the response is **insensitive** to scatter
  (flat region of the curve). Measure with mean and standard deviation from Monte Carlo or DOE replicates.
- **Reliability-based (RBDO):** constraint P(g > 0) ≤ P_allowed instead of g ≤ 0 with a fixed safety factor.
  Example E3 shows how scatter changes ppm at the same SF. Tools: Monte Carlo in MATLAB, FORM, optiSLang reliability.

---

## 9. Design calculation programs for machine elements – do you need them?

**Short answer: yes.** CAD gives geometry and FEA gives stresses, but **neither tells you whether a gear, bearing, bolt,
cam, shaft or spring is correctly designed for life and manufacture.** Machine elements have **standard calculation
methods** that contain decades of test data (factors for load spectrum, lubrication, surface, size, notch, scatter)
which a plain FEA does not include. A design is only accepted (by customers, notified bodies, insurers) when it is
calculated with these methods.

### 9.1 What a machine-element program must give – up to manufacture

| Output | Example (gear) |
|---|---|
| Main dimensions | m, z, b, x (profile shift), centre distance |
| Strength / life with safety factors | Root S_F, flank S_H (ISO 6336), scuffing, micropitting |
| Manufacturing data | Tooth thickness / span measurement W_k, over-pin dimension, tolerances (ISO 1328 class), tip/root diameters |
| Material + heat treatment | 18CrNiMo7-6 case hardened, case depth 0.8–1.2 mm, 58–62 HRC |
| Inspection data | Profile / helix tolerances, runout, backlash range |
| Report | Inputs, method, results, standard edition |

### 9.2 Standards and methods per element

| Element | Standard / method | Key results |
|---|---|---|
| Crank mechanism (compressor) | Kinematics + dynamics of slider-crank, gas + inertia forces, balancing (VDI 2149 for mass balancing of mechanisms in general) | Forces on pins / bearings, torque curve, flywheel, unbalanced forces 1st / 2nd order |
| Gears (spur / helical) | ISO 6336-1…-6, ISO 21771 (geometry), ISO 1328-1 (accuracy), AGMA 2101 | S_F, S_H, scuffing, manufacturing dimensions |
| Worm, bevel gears | ISO/TS 14521, ISO 10300, ISO 23509 | Efficiency, wear, strength |
| Cams | VDI 2143 (motion laws), Hertz contact, follower dynamics | Motion law, pressure angle, curvature, contact stress, cam profile coordinates for CNC |
| Shafts | DIN 743-1…-4, FKM guideline | Static + fatigue safety at every notch, deflection, critical speed |
| Rolling bearings | ISO 281 (L10, L_nm with a_ISO), ISO 16281, ISO 76 (static) | Modified life, static safety, lubrication κ |
| Plain bearings | DIN 31652 / ISO 7902 | Minimum film thickness, temperature |
| Bolted joints | VDI 2230-1:2015 | Preload, tightening torque, safety against slipping, fatigue, embedding |
| Shaft-hub connections | DIN 6892 (keys), DIN 7190-1 (press fits), DIN 5480 (splines) | Surface pressure, transmissible torque, fit selection |
| Springs | EN 13906-1/-2/-3 | Stress, fatigue (Goodman diagram), buckling, manufacturing data (L0, d, D, n) |
| Belts, chains | ISO 9980 / maker methods (belts), ISO 10823 (chains) | Belt number, pre-tension, life |
| Welds | EN 1993-1-8 / -1-9, IIW recommendations, FKM | Weld stress, fatigue class (FAT) |
| Pressure parts | EN 13445-3, EN 286 (simple vessels), ASME VIII | Wall thickness, nozzles, fatigue |
| Tolerances / fits | ISO 286, ISO 1101, stack-up | Fits, clearances, assembly capability |

### 9.3 Buy or build?

| Option | Examples | Offline? | Comment |
|---|---|---|---|
| Commercial integrated | **KISSsoft / KISSsys** (Gleason), **MESYS**, **MDESIGN**, Romax (Hexagon), SMT MASTA | Yes (local licence / dongle) | Industry standard, certified methods, expensive (M–H class) |
| Low cost | MITCalc (Excel-based), Autodesk Inventor Design Accelerator, SOLIDWORKS Toolbox calculators | Yes | Good for simple cases; check method and edition |
| Online | eAssistant | **No** (internet) | Against offline rule |
| **Own programs (this folder)** | Python stdlib tools, one per element, with worked examples and self-tests | **Yes** | You understand every formula, adapt to your products; validate against a commercial tool or textbook examples before use for safety parts |

**Recommendation:** build your own programs here to **learn and own the method** (the next items), and buy one
commercial tool (KISSsoft or MESYS) later for gears / bearings / shaft systems where customers ask for certified
reports. Cross-check the two – differences teach you the details.

### 9.4 Plan of the next items (field 1, one by one)

| Item | Topic | Program (planned) |
|---|---|---|
| M1 | **Design method** (this guide) | `dm_toolkit.py` – decision matrix, GCI, reliability, Goodman, stack, DOE, Ashby, optimisation |
| M2 | Crank mechanism: kinematics, gas + inertia forces, bearing loads, torque, flywheel, balancing | `crank.py` |
| M3 | Shafts (DIN 743 / FKM) + keys / press fits | `shaft.py` |
| M4 | Rolling bearings (ISO 281 modified life) | `bearing.py` |
| M5 | Gears (ISO 6336 + geometry + manufacturing dimensions) | `gear.py` |
| M6 | Cams (VDI 2143 motion laws, profile for CNC, contact stress) | `cam.py` |
| M7 | Bolted joints (VDI 2230) | `bolt.py` |
| M8 | Springs (EN 13906) incl. valve springs | `spring.py` |
| M9 | Belts / chains / couplings | `drive.py` |
| M10 | Tolerances, fits, GD&T, stack-up (Monte Carlo) | `tol.py` |
| M11 | Welds and frames, pressure parts (air tank) | `weld.py`, `vessel.py` |
| M12 | Optimisation workflows with your CAE tools (SOLIDWORKS / Ansys / Abaqus / Adams + MATLAB) | scripts + templates |
Each item: guide (theory → formulas → standard → worked example → manufacturing data → checks) + program + self-test.

---

## 10. Tool integration map for your software set

```
 Requirements (Excel) ─► MATLAB hub: first-principles models, element programs, optimisation, DOE, reports
        │                    ▲  │                 ▲
        ▼                    │  ▼                 │ results (CSV / .odb / .res)
 SOLIDWORKS CAD ─ global variables / design table (Excel) ─► geometry versions
        │  STEP / Parasolid (+ DS_ parameters)
        ├─► SOLIDWORKS Motion ─ loads vs time ─► SOLIDWORKS Simulation / Ansys (static, fatigue)
        ├─► Adams (guide 54 C3) ⇄ Ansys flexible bodies (C16) ─► loads ─► nCode / fe-safe (C19, C20)
        ├─► Ansys Workbench (parameters ─► DesignXplorer / optiSLang)
        ├─► Abaqus (Python scripts driven by MATLAB, C59)
        └─► NX CAM (released model + PMI) ─► post ─► machine simulation ─► CNC (C41)
```

| Link | How in practice |
|---|---|
| MATLAB → SOLIDWORKS | Write the design table / global-variable Excel file, or use the SOLIDWORKS API (COM: `actxserver('SldWorks.Application')`) to set dimensions and rebuild |
| SOLIDWORKS → Ansys | Workbench associative interface; dimensions with prefix `DS_` become Workbench parameters |
| SOLIDWORKS Motion → FEA | Motion study → "Import motion loads" into SOLIDWORKS Simulation, or export joint forces vs time (CSV) → Ansys remote forces |
| Ansys / Abaqus → MATLAB | Ansys: parameters table export, PyMechanical / APDL output files; Abaqus: Python script extracts .odb → CSV |
| Adams → MATLAB | Adams Controls (C10), or request output in .csv / .res; Adams Insight for DOE |
| All → reports | MATLAB Report Generator or simple Markdown / Excel templates (section 7.5) |

---

## 11. Complete mini example – compressor motor-to-crank drive shaft through S0–S9 (example values)

| Stage | What was done | Result |
|---|---|---|
| S0 | Requirements: transmit 3 kW at 1450 rpm (T_nom = 9550·3/1450 = 19.8 N·m), start torque 2.5 × → 49 N·m, life 1.74·10⁹ cycles (infinite), mass wish minimum | Load cases LC1 (19.8 N·m), LC3 (49 N·m), belt pull bending |
| S1 | Function: transmit torque, carry pulley, locate axially. First-principles: σ_b = 32M/(πd³), τ = 16T/(πd³) | Key variables: d, material, notch radius |
| S2–S3 | Concepts: keyed solid shaft / splined / taper-lock bush; matrix → keyed solid shaft (cheap, standard) | Concept chosen |
| S4 | Hand sizing with Goodman (E4-type), C45 +N, d ≈ 25–30 mm; locating + floating bearing | d = 30 mm at pulley seat |
| S5 | Fit pulley H7/k6, bearing seats k5, fillet r = 1.6 mm, Ra 0.8 on seats, tolerance stack of axial play (E5-type) | Drawing ready for check |
| S6 | Hand + DIN 743 (item M3) + FEA of the shoulder with GCI < 2 %; difference FEA vs DIN 743 notch stress 8 % → L2 | n_f ≈ 1.9 ≥ 1.5 required |
| S7 | DOE on fillet radius and diameter step; sizing optimisation as E8 if mass matters | r = 2.0 mm gives −10 % stress at no cost |
| S8 | Strain gauge on prototype at shoulder, run at LC1 / LC3 | FEA within 7 % → L3 for this part family |
| S9 | Release drawing, inspection plan (diameters, runout, fillet radius gauge), lessons learned → modelling guideline | Part released |

---

## 12. Gate checklists

**G0 (after S0)** – [ ] every requirement has value + unit + verification method · [ ] load cases LC1–LC6 written ·
[ ] standards and laws listed · [ ] demands vs wishes separated
**G1** – [ ] function structure drawn · [ ] first-principles model gives the key numbers · [ ] coupled FRs identified
**G2** – [ ] ≥ 3 real concepts · [ ] TRIZ / morphological box used for the hardest sub-function · [ ] patents checked
**G3** – [ ] demands checked before scoring · [ ] weighted matrix + sensitivity · [ ] top risks (FMEA) listed
**G4** – [ ] load path clear · [ ] material chosen with index + cost + process · [ ] main parts hand-sized with standards ·
[ ] stiffness budget · [ ] standard parts selected from catalogues
**G5** – [ ] all functional dimensions toleranced · [ ] stack-up done · [ ] DFM/DFA review with production · [ ] drawing check
**G6** – [ ] hand estimate exists for each FEA/MBD result · [ ] convergence (GCI) · [ ] checks (mass, reactions, energy) ·
[ ] credibility level stated · [ ] safety factors meet the rule (FKM / standard)
**G7** – [ ] problem written (x, f, g) · [ ] DOE shows main factors · [ ] optimum verified by a real run · [ ] robustness checked ·
[ ] rounded to standard sizes and re-checked
**G8** – [ ] test plan from FMEA · [ ] prediction written before the test · [ ] correlation within target · [ ] model rules updated
**G9** – [ ] released data complete · [ ] control plan for critical characteristics · [ ] FAI passed · [ ] lessons learned written

---

## 13. Common mistakes
- Starting in CAD before the requirement list and load cases exist.
- One concept only ("we always did it like this").
- FEA without hand estimate; reading singular peak stresses; default contact settings; fixed supports everywhere.
- Taking library material data for fatigue.
- Optimising without manufacturing constraints → impossible thin walls; optimising a surrogate without verification.
- Same safety factor for everything, regardless of load knowledge and consequence.
- Test without a prediction written beforehand (then nothing is learned).
- No feedback: the same modelling error repeats in every project.

## 14. Limits
- The pipeline is a framework – small parts may pass S0–S3 in one hour; safety parts need every gate formally.
- E4 uses Shigley-type Marin factors for orientation; for design reports use DIN 743 / FKM (item M3).
- E6 responses and E8 loads are example values; the optimisation example uses formulas, not FEA.
- Accelerated test and Miner rule have known scatter – confirm with the standard / test data of your material.
- Correlation targets in 5.9 / 7.4 are typical industry values, not standard limits.

## 15. Standards and books
VDI 2221-1/-2:2019 (design methodology) · VDI 2222 (methodical concept design) · VDI 2223 (embodiment) · VDI 2225
(technical-economic evaluation) · VDI 2206:2021 (mechatronic systems, V-model) · ISO 12100 (risk assessment) ·
ASME V&V 10-2019 + V&V 10.1 (solid mechanics V&V) · NAFEMS V&V publications · FKM guideline "Analytical strength
assessment" (7th ed.) · DIN 743 · ISO 6336 · ISO 281 · VDI 2230-1 · EN 13906 · ISO 286 · ISO 1101 · ISO 8015 ·
AIAG-VDA FMEA handbook (2019).
Books: Pahl/Beitz *Engineering Design* · Budynas/Nisbett *Shigley's Mechanical Engineering Design* · Roloff/Matek
*Maschinenelemente* · Niemann/Winter *Maschinenelemente* · Ashby *Materials Selection in Mechanical Design* ·
Suh *Axiomatic Design* · Arora *Introduction to Optimum Design* · Montgomery *Design and Analysis of Experiments* ·
Roache *Verification and Validation in Computational Science and Engineering*.

## 16. Glossary
| Term | Meaning |
|---|---|
| Active constraint | Constraint exactly at its limit at the optimum – it decides the design |
| Credibility level | How much a simulation result can be trusted (L0–L4, section 7.1) |
| DFM / DFA | Design for manufacture / assembly |
| DOE | Design of experiments – planned set of runs |
| FKM guideline | German guideline for analytical strength assessment of machine parts |
| GCI | Grid Convergence Index – discretisation error estimate |
| Load case (LC) | Defined combination of loads for a calculation |
| Marin factors | Correction factors from specimen to part endurance limit |
| Pareto front | Best trade-off designs of several objectives |
| QFD | Quality Function Deployment – customer wishes → engineering characteristics |
| RBDO | Reliability-based design optimisation |
| Surrogate / response surface | Fast fitted model replacing expensive simulations |
| TRIZ | Theory of inventive problem solving – contradictions + inventive principles |
| V&V | Verification (equations solved right) and validation (right equations) |

---

# Part B – Deep reference (textbook level, through to real manufacturing)

> Chapters 17–33 explain every method of Part A in depth: theory with derivations, formulas with units, standard
> procedures, worked examples, manufacturing data, checklists and references. Programs (Python standard library, offline):
> `tools/dm_req.py` (ch. 17–20), `tools/dm_embody.py` (ch. 21–24), `tools/dm_strength.py` (ch. 25–28),
> `tools/dm_opt.py` (ch. 29–33). Run all self-tests: `python dm_toolkit.py selftest_all`.
> Values marked "typical" or "check …" must be confirmed with the current standard, certificate or supplier datasheet.

## 17 Requirements engineering and load spectra

> Program: `tools/dm_req.py` (examples R1–R7). All numbers are **example values**.

### 17.1 Why requirements decide everything
Every later number is calculated **against** a requirement: stress against allowed stress, life against required life,
noise against a limit. A wrong or vague requirement makes a perfect calculation useless. Studies of product
development often report that most late changes come from unclear requirements, not from calculation errors.
So the first engineering skill is to **write requirements well**.

### 17.2 Quality of a single requirement (ISO/IEC/IEEE 29148)
ISO/IEC/IEEE 29148 (requirements engineering, systems and software) lists characteristics of a good requirement. In
simple words:

| Characteristic | Test question | Bad | Good |
|---|---|---|---|
| Necessary | Would anything be missing without it? | "Nice blue colour" (if no customer needs it) | RAL 5015 because brand guide BG-03 says so |
| Unambiguous | Can two engineers read it differently? | "Low noise" | L_pA ≤ 72 dB(A) at 1 m, ISO 3744, at 0.8 MPa |
| Complete | Are conditions and units stated? | "Life 20 000 h" | 20 000 h at 100 % duty, 0.8 MPa, 40 °C ambient |
| Singular | Only one demand per line? | "Light and cheap" | Two lines: mass ≤ 45 kg; cost ≤ X |
| Feasible | Physically and economically possible? | "Zero vibration" | Vibration velocity ≤ 4.5 mm/s r.m.s. (ISO 10816-type limit) |
| Verifiable | Is there a test or calculation that proves it? | "Robust" | Passes 1 000 h endurance test at LC2 |
| Correct | Does it match the real need / source? | Copied from old product | Traced to customer spec CS-12 §4 |
| Conforming | Uses the agreed template and words | Free text | Template of 5.1 |

The standard also lists characteristics for a **set** of requirements: complete, consistent (no contradictions),
feasible as a whole, comprehensible, able to be validated.

**Words to avoid:** robust, user-friendly, sufficient, approximately, etc., as required, minimise, maximise (without a
limit), "and/or". **Words to use:** shall (demand), should (wish), a number with unit and a test method.

### 17.3 Kano model – which requirements make customers happy
Kano classifies customer needs by how satisfaction changes with fulfilment:

| Class | Fulfilled | Not fulfilled | Compressor example |
|---|---|---|---|
| Must-be (M) | Customer neutral | Very unhappy | Reaches 0.8 MPa, safety valve, no oil leak |
| One-dimensional (O) | More = happier | Unhappy | FAD, noise, energy use |
| Attractive (A) | Delighted | Neutral | Remote monitoring, display of service hours |
| Indifferent (I) | No effect | No effect | Colour of the inside cover |
| Reverse (R) | Unhappy | Happy | Too many settings for a simple user |

Survey: each customer answers a functional question ("If the compressor has X, how do you feel?") and a
dysfunctional one ("If it does not have X…"). A Kano evaluation table turns the answer pair into A/O/M/I/R.
Satisfaction coefficients (Berger et al., 1993):

  Better = (A + O) / (A + O + M + I)  Worse = −(O + M) / (A + O + M + I)

**Example R1** (100 answers): "low noise" A 12, O 38, M 40, I 10 → Better **0.50**, Worse **−0.78** (customers are very
unhappy if it is loud → treat as a hard limit). "Remote monitoring" A 45, O 20, M 5, I 30 → Better **0.65**, Worse
**−0.25** (a delighter → a wish, good for marketing, not a demand).
Note: delighters become must-be over the years (display panels were attractive 15 years ago).

### 17.4 QFD – House of Quality, fully worked
QFD (Quality Function Deployment, Akao) translates the **voice of the customer** into **engineering characteristics
(EC)** with target values. The "house" has rooms: customer needs + weights (left), ECs (ceiling), relationship matrix
(centre, 9 strong / 3 medium / 1 weak / 0), correlation roof (EC vs EC: + supports, − conflicts), competitor
benchmark (right), target values and importance (basement).

Importance of EC j: **IW_j = Σ_i w_i · r_ij**, relative importance **RW_j = IW_j / Σ_j IW_j**.

**Example R2** – customer weights: FAD 5, low noise 4, long life 5, low cost 3, compact 2.

| Customer need (w) | Swept volume | Crank speed | Bearing C/P | Valve lift | Fan flow | Mass |
|---|---|---|---|---|---|---|
| FAD (5) | 9 | 9 | 0 | 3 | 1 | 0 |
| Low noise (4) | 1 | 9 | 0 | 3 | 3 | 1 |
| Long life (5) | 0 | 3 | 9 | 3 | 3 | 0 |
| Low cost (3) | 3 | 3 | 3 | 0 | 1 | 9 |
| Compact (2) | 3 | 3 | 0 | 0 | 0 | 9 |
| **Absolute IW** | **64** | **111** | **54** | **42** | **35** | **49** |
| **Relative %** | 18.0 | **31.3** | 15.2 | 11.8 | 9.9 | 13.8 |

Interpretation: **crank speed** is the most important EC (it affects FAD, noise and life). The roof shows a conflict:
higher speed → more FAD but more noise and shorter life → this is a design trade-off to optimise (chapter 29) or a
TRIZ contradiction (chapter 19). Typical next step: target values (e.g. 1450 rpm, swept volume 0.305 L) and the second
house (EC → part characteristics, e.g. bore tolerance, bearing type).

Practice: one house per product is enough for an SME; use Excel. More than ~25 needs or ECs makes the matrix unreadable
– group them.

### 17.5 Requirement traceability matrix (RTM)
Every requirement must be traceable **forward** (to design, calculation, test, drawing, inspection) and **backward**
(to its source).

| Req. | Source | Design element | Calculation | Verification test | Drawing note / characteristic | Inspection |
|---|---|---|---|---|---|---|
| R04 life 20 000 h | Spec §3 | Crankshaft, bearings | Fatigue n_f ≥ 1.5 (ch. 26), L10 ≥ 20 000 h (item M4) | 1 000 h endurance at LC2 | Fillet r 2.0 ± 0.2, Ra 0.4 on pin, induction hardened 52–58 HRC | Fillet gauge 100 %, hardness 1/batch |
| R01 FAD ≥ 20 m³/h | Customer | Bore Ø65, stroke 46, valves | Volumetric efficiency (R6) | ISO 1217 bench test | Bore Ø65 H7, cylindricity 0.008 | CMM 1/shift, bench 100 % |
| R03 noise | Market | Fan, cover, mounts | Sound power estimate | ISO 3744 | Fan balancing G6.3 | Balancing 100 % |

Rule: a requirement with an empty "verification" column is not finished. A drawing characteristic without a
requirement behind it is a cost driver (unnecessary tolerance) – remove it or mark it as general tolerance.

### 17.6 From requirement to drawing note and inspection plan
1. Requirement (R04 life) → 2. failure mode (fatigue crack at pin fillet, FMEA ch. 20) → 3. design parameter (fillet
radius, surface, residual stress) → 4. **special characteristic** on the drawing (symbol per your company rule, e.g.
◆ or "SC") with tolerance → 5. **control plan** line: method, gauge, sample size, frequency, reaction plan → 6. SPC with
Cpk ≥ 1.33 (≥ 1.67 for safety-related).
This chain is the backbone of IATF 16949-type quality systems and of the AIAG-VDA FMEA (ch. 20.7).

### 17.7 Load derivation: duty cycle, spectrum, counting
A part fails by its **load history**, not by one load. Steps:
1. **Duty cycle:** what the machine does over time. Compressor example: 60 % on-time, 10 starts per hour, 20 000 h life
   → 1450 · 60 · 20 000 = **1.74 · 10⁹ crank revolutions**, 10 · 20 000 = **200 000 starts**.
2. **Load history:** force / torque vs time – from calculation (gas + inertia model), MBD (Adams, SW Motion) or
   measurement (strain gauge on the shaft, torque meter).
3. **Counting:** turn the irregular history into cycles (range, mean, number) – rainflow counting.
4. **Spectrum:** table of load classes and cycle numbers (cumulative frequency diagram).
5. **Damage or equivalent load:** Miner sum (ch. 26) or one equivalent load for standard methods (bearings, gears).

### 17.8 Rainflow counting (ASTM E1049-85, 3-point method)
Rainflow identifies **closed hysteresis loops** in the stress–strain response – each loop is one fatigue cycle.

Algorithm (ASTM E1049, §5.4.4, simplified wording):
1. Reduce the history to **peaks and valleys** (reversals).
2. Read points one by one onto a stack. With at least 3 points, let **X** = range of the last two points and **Y** =
   range of the two points before them.
3. If X < Y: read the next point.
4. If X ≥ Y and Y contains the **first point** of the history (stack has 3 points): count Y as **½ cycle**, remove
   the first point, go to step 2.
5. If X ≥ Y otherwise: count Y as **1 cycle**, remove both points of Y, go to step 2.
6. At the end: count every remaining range as **½ cycle** (the residue).

**Example R3 – ASTM E1049 reference history** −2, 1, −3, 5, −1, 3, −4, 4, −2 (load units):

| Range | Cycles |
|---|---|
| 3 | 0.5 |
| 4 | 1.5 |
| 6 | 0.5 |
| 8 | 1.0 |
| 9 | 0.5 |
Total 4.0 cycles – identical to the table printed in ASTM E1049 → the program is verified (code verification!).

**Example R4 – crank torque record** (N·m): 0, 12, 4, 10, 2, 49 (start peak), 0, 12, 6, 14, 0 →
range 6 N·m: 2 cycles, 10: 1, 14: 1, **49: 1** (the start cycle). The start cycle dominates damage even though it is
rare – for shafts with S-N slope k ≈ 5–8 one 49 N·m cycle does more damage than thousands of 6 N·m cycles
(49/6)^5 ≈ 36 000. This is why **start-up must be a load case**.

Practice: MATLAB Signal Processing Toolbox has `rainflow(x)`; nCode / fe-safe do it inside fatigue runs. Always remove
the mean drift and filter noise before counting (small noise ranges add many tiny cycles – a "gate" of 1–5 % of max range
is common).

### 17.9 Damage-equivalent load
For a spectrum with n_i cycles at load L_i and an S-N / life law with exponent k (life ∝ L^(−k)), the constant load
that gives the same damage in the same total cycles:

  **L_eq = ( Σ n_i · L_i^k / Σ n_i )^(1/k)**

Derivation: damage D = Σ n_i / N_i with N_i = C · L_i^(−k) → D = Σ n_i L_i^k / C. A constant L_eq over N = Σ n_i cycles
gives D = N · L_eq^k / C. Equal D → formula above.

Exponents: ball bearings k = 3, roller bearings k = 10/3 (ISO 281), gear flank ≈ 6.6 and gear root ≈ 8.7 in the
finite-life region (typical values for case-hardened steel – check ISO 6336-2/-3 for your material), steel shafts k ≈ 5–8.

**Example R5** – spectrum (example): 0.90·10⁹ cycles at 12.4 N·m, 0.09·10⁹ at 25.0 N·m, 0.01·10⁹ at 49.4 N·m:

| k | Used for | L_eq (N·m) |
|---|---|---|
| 3 | ball bearing | **16.30** |
| 10/3 | roller bearing | 16.95 |
| 6.6 | gear flank | 24.98 |
| 8.7 | gear root | 29.18 |
Lesson: the higher k, the more the rare high loads count. Using the mean load (12.4) instead of L_eq would overestimate
bearing life by (16.30/12.4)³ ≈ 2.3 ×.

### 17.10 Application factor K_A
When the real spectrum is unknown, standards multiply the nominal load by an **application factor**. The informative
table used with ISO 6336 / DIN 3990 (also in many gear and coupling catalogues):

| Driving machine \ driven machine | Uniform | Light shocks | Moderate shocks | Heavy shocks |
|---|---|---|---|---|
| Uniform (electric motor) | 1.00 | 1.25 | 1.50 | 1.75 |
| Light shocks (multi-cylinder engine, hydraulic motor) | 1.10 | 1.35 | 1.60 | 1.85 |
| Moderate shocks | 1.25 | 1.50 | 1.75 | 2.00 |
| Heavy shocks (single-cylinder engine) | 1.50 | 1.75 | 2.00 | 2.25 or higher |

**Example R7:** electric motor + reciprocating compressor (moderate shocks) → **K_A = 1.50** (single-cylinder compressors
are often put in "heavy" → 1.75). Check the classification in the annex of the edition you use. Where you have a measured
or calculated spectrum, use it instead (it is more accurate and usually less conservative).

### 17.11 Compressor load cases from gas pressure (example R6)
Data (example): bore D = 65 mm, stroke s = 46 mm (crank radius r = 23 mm), conrod l = 90 mm (λ = r/l = 0.256),
2 cylinders in 90° V, 1450 rpm, discharge 0.8 MPa gauge, FAD 20 m³/h, polytropic exponent n = 1.30,
mechanical efficiency 0.85, reciprocating mass 0.35 kg per cylinder.

| Quantity | Formula | Result |
|---|---|---|
| Piston area | A = π D²/4 | **3318.3 mm²** |
| Swept volume per cylinder | V_s = A · s | **0.1526 L** (2 cyl.: 0.305 L) |
| Theoretical displacement | V_th = 2 V_s · n · 60 | **26.56 m³/h** |
| Volumetric efficiency | λ_v = FAD / V_th | **0.753** |
| Peak gas force (gauge) | F_g = p_g · A | **2655 N** |
| Pressure ratio | π = (p_g + p_atm)/p_atm | **8.90** |
| Indicated power (polytropic) | P_i = n/(n−1) · p₁ · Q · (π^((n−1)/n) − 1) | **1600 W** |
| Shaft power | P = P_i / η_m | **1882 W** |
| Mean crank torque | T_m = P / ω (ω = 151.8 rad/s) | **12.40 N·m** |
| Max inertia force (TDC) | F_i = m r ω² (1 + λ) | **233 N** |
| Upper bound of gas torque | T ≤ F_g · r | **61.1 N·m** |
| Fault: blocked outlet, safety valve full lift 1.1 × 0.9 MPa = 0.99 MPa | F = 0.99 · A | **3285 N** |

Load case table for crank train calculations:

| LC | Case | Values (example) | Used for |
|---|---|---|---|
| LC1 | Normal | 0.8 MPa, 1450 rpm, T_m 12.4 N·m, F_g 2655 N | Fatigue (infinite life), bearing life |
| LC2 | Maximum operation | 0.9 MPa (cut-out), 45 °C | Fatigue with K_A or spectrum |
| LC3 | Start (DOL) | Motor starting torque ≈ 2.5 × nominal; 3 kW at 2930 rpm → 9.78 N·m, at crank ×2.02 → 19.75 N·m nominal, **49.4 N·m** start | Static + low-cycle (200 000 starts) |
| LC4 | Fault | 0.99 MPa → 3285 N | Static safety (to yield), no fatigue |
| LC5 | Transport / assembly | 2 g, bolt torque | Static |
| LC6 | Spectrum | from R4/R5 | Damage sum, L_eq |
Gas force dominates inertia force here (2655 vs 233 N) because the compressor is small and slow; at higher speed the
inertia term grows with ω² and the balance changes (item M2 computes the full force curve over crank angle).

### 17.12 MATLAB snippet
```matlab
c = rainflow(torque_record);          % Signal Processing Toolbox: [count range mean start end]
k = 3; Leq = (sum(c(:,1).*c(:,2).^k)/sum(c(:,1)))^(1/k);   % equivalent RANGE for bearings (use amplitude consistently)
```

### 17.13 Checklist
- [ ] Every requirement passes the 29148 test questions · [ ] Kano class known for top 10 needs · [ ] QFD for products with
many needs · [ ] RTM: each requirement has calculation + test + drawing characteristic · [ ] duty cycle and life in cycles ·
[ ] load cases include start-up and fault · [ ] spectrum or K_A justified · [ ] k exponent matches the failure mode.

### 17.14 Common mistakes
Requirements without test method · mean load used for fatigue · start-up and fault cases forgotten · rainflow on noisy
signals without gate · mixing ranges and amplitudes (factor 2!) · K_A applied **and** a measured spectrum (double counting).

### 17.15 References
ISO/IEC/IEEE 29148:2018 · ASTM E1049-85 (reapproved, check current year) · ISO 6336-1:2019 (K_A) · ISO 281:2007 ·
ISO 1217:2009 (displacement compressors acceptance tests) · Akao, *Quality Function Deployment* (1990) · Kano et al. (1984)
· Berger et al., *Kano's methods…*, Center for Quality Management Journal (1993) · Köhler/Haibach, *Fatigue strength* (Haibach,
*Betriebsfestigkeit*, 3rd ed. 2006) · Pahl/Beitz (4th Engl. ed. 2007 / German 9th ed. 2021).

---

## 18 Function structure and axiomatic design

> Program: `tools/dm_req.py` (examples R8–R9).

### 18.1 Function = what, not how
A **function** is the relation between input and output of a system, written as **verb + noun** ("compress air",
"transmit torque"). It says *what* must happen, never *how* (no "V-belt"). Thinking in functions frees you from the
old solution and opens the concept space (chapter 19).

Three flows (Pahl & Beitz): **energy** (mechanical, electrical, thermal…), **material** (air, oil, chips), **signal**
(pressure value, on/off). The overall function is split into sub-functions until each can be solved by a known
physical effect.

### 18.2 Generally valid functions (VDI 2222 / Pahl & Beitz)
| Generic function | Energy example | Material example | Signal example |
|---|---|---|---|
| Change / convert | Electric → mechanical (motor) | Air → compressed air | Pressure → voltage (sensor) |
| Vary (magnitude) | Speed change (belt ratio) | Throttle | Amplify |
| Connect / separate | Couple motor + crank | Mix / filter oil from air | Combine signals |
| Channel / conduct | Transmit torque (shaft) | Guide air (manifold) | Transmit (cable, Modbus) |
| Store | Flywheel, air tank | Tank | Memory |

### 18.3 Function structure of the compressor (energy + material + signal)
```
 Electric energy ─► [convert to rotation] ─► [vary speed] ─► [convert rotation to linear] ─► [compress air] ─► compressed air
 Ambient air ─────► [filter] ──────────────────────────────────────────► [admit/close (valves)] ┘        │
 Heat ◄──────────────────────────────────────────────── [remove heat] ◄─────────────────────────────────┘
 Pressure signal ─► [compare with set point] ─► [switch energy on/off]
```
Each box becomes a row of the morphological box (19.7).

### 18.4 Physical effects catalogue
For each sub-function list physical effects (Koller, Roth catalogues): convert rotation → linear: crank
(lever/kinematics), cam, swash plate, scotch yoke, screw; compress: displacement (piston, scroll, screw, vane),
dynamic (centrifugal); seal: elastic contact, labyrinth, liquid film; remove heat: convection, conduction, evaporation.
This is how new concepts (scroll vs piston) appear systematically, not by luck.

### 18.5 Axiomatic design – theory
Suh's axiomatic design maps four domains: customer needs (CA) → **functional requirements FR** → **design parameters DP**
→ process variables PV. In the functional → physical mapping:

  **{FR} = [A] {DP}**  with A_ij = ∂FR_i / ∂DP_j

**Axiom 1 (independence):** keep the FRs independent. **Axiom 2 (information):** among designs that satisfy axiom 1,
the best has the least information content.

| [A] | Type | Consequence |
|---|---|---|
| Diagonal | Uncoupled | Each FR adjusted by its own DP, any order |
| Triangular (after reordering) | Decoupled | Works if DPs are set in the right sequence |
| Otherwise | Coupled | Changing one DP disturbs several FRs → iteration, poor robustness → redesign |

Theorem (Suh): if there are fewer DPs than FRs, the design is coupled (or some FRs cannot be met). More DPs than FRs →
redundant design (can be reduced).

**Procedure:** 1) write 3–7 FRs at the top level (solution-neutral, measurable) · 2) choose one DP per FR · 3) fill
the matrix with X / 0 (or partial derivatives if a model exists) · 4) reorder to find a triangle · 5) if coupled →
add or change DPs · 6) zig-zag down: decompose each FR/DP pair to the next level.

### 18.6 Worked examples R8
**R8a – valve plate (decoupled).** FR1 open fast, FR2 limit reed stress, FR3 seal when closed; DP1 reed thickness,
DP2 stop-plate lift, DP3 seat flatness:

| | DP1 thickness | DP2 lift | DP3 flatness |
|---|---|---|---|
| FR1 response | X | 0 | 0 |
| FR2 stress | X | X | 0 |
| FR3 sealing | 0 | X | X |
Program: **decoupled**, order DP1 → DP2 → DP3: choose thickness for response first, then lift so stress is
acceptable, then flatness for the sealing with that lift.

**R8b – coupled.** FR1 FAD, FR2 noise, both driven by DP1 speed and DP2 bore in the same way ([[X X],[X X]]) →
**coupled**: every bore change also changes noise. Fix: add an independent DP for noise (fan design / cover with
absorption) → noise is then controlled separately.

**R8c – shaft seat (decoupled after reordering).** FR1 transmit torque, FR2 locate axially, FR3 support radial load;
DP1 key, DP2 shoulder + circlip, DP3 bearing seat diameter; matrix [[X X 0],[0 X 0],[0 X X]] → program finds order
DP2 → DP1 → DP3 (set the shoulder position first, then key length, then the seat).

### 18.7 Information axiom – quantify "probability of success"
Information content **I = log₂(1/P)** [bit], P = probability that the system output lies inside the **design range**
(tolerance). For a uniform system range: P = common range / system range. For a normal process:
P = Φ((USL − μ)/σ) − Φ((LSL − μ)/σ). Total information of independent FRs: I_total = Σ I_i (smaller = better).

**Example R9 – cylinder bore Ø65 H7 (65.000…65.030 mm):**

| Process | μ (mm) | σ (mm) | P | I (bit) |
|---|---|---|---|---|
| HMC + honing (good) | 65.012 | 0.006 | **0.9759** | **0.035** |
| Older machine | 65.015 | 0.010 | 0.8664 | 0.207 |
The good process carries 6 × less information → much more robust. This links axiomatic design to process capability
(Cpk) – in practice you report Cpk; I is the theoretical sum you can add over several FRs.

**Example R9c – valve lift (uniform):** design range 0.10–0.30 mm, system (manufacturing) range 0.05–0.35 mm →
P = 0.20 / 0.30 = **0.667**, I = **0.585 bit** → either tighten the process or widen the design range (check with
valve-dynamics simulation, guide 54 C31, whether 0.05–0.35 still works).

### 18.8 Practice and manufacturing link
- FR/DP/PV mapping is a direct bridge to manufacturing: each DP that is a dimension gets a **PV** (process variable:
  machine, tool, parameter) – e.g. DP fillet radius → PV form tool radius + CNC program.
- Coupled designs are expensive in production: adjustment at assembly (shims, selective fitting). Decoupled designs
  allow a fixed **adjustment sequence** in the work instruction.
- MATLAB: write [A] as a logical matrix; the permutation search of `dm_req.py` is easy to copy (`perms`).

### 18.9 Checklist / common mistakes
[ ] FRs solution-neutral and measurable · [ ] one DP per FR · [ ] matrix filled and type stated · [ ] coupled pairs
resolved or justified · [ ] information / Cpk estimated for key FRs.
Mistakes: FR written as a solution ("use V-belt"); FR list mixing levels; ignoring weak couplings that later dominate
(thermal growth couples almost everything in machine tools).

### 18.10 References
Suh, *The Principles of Design* (1990), *Axiomatic Design* (2001) · Pahl/Beitz (ch. on function structures) · VDI 2221-1:2019
· VDI 2222 (methodical concept development; check current part numbering) · Koller, *Konstruktionslehre für den Maschinenbau* ·
Roth, *Konstruieren mit Konstruktionskatalogen* (3 vols.).

---

## 19 Creative methods

> Program: `tools/dm_req.py` (example R10).

### 19.1 Why methods for creativity
Most engineers stop at the first idea that works. Systematic methods generate **more and better** variants in a
controlled time. Two families: **intuitive** (brainstorming, 6-3-5, analogy, bionics) and **discursive / systematic**
(morphological box, design catalogues, TRIZ).

### 19.2 TRIZ basics
TRIZ (Altshuller, from analysis of many thousands of patents) says: inventive problems contain **contradictions**;
the same few principles solve them across industries; systems evolve toward **ideality**.

- **Technical contradiction:** improving parameter A worsens parameter B (lighter reed → weaker reed).
- **Physical contradiction:** one parameter must have two opposite values (reed must be thin **and** thick).
- **Ideality** = Σ useful functions / (Σ costs + Σ harms). **Ideal final result (IFR):** the function is done "by
  itself", without added cost or harm (e.g. the air pressure itself closes the valve).

### 19.3 The 39 engineering parameters (most used in machine design)
1 weight of moving object · 2 weight of stationary object · 3/4 length (moving / stationary) · 7 volume of moving object
· 9 speed · 10 force · 11 stress or pressure · 12 shape · 13 stability of the object's composition · 14 strength ·
15 duration of action of a moving object · 17 temperature · 19 use of energy by moving object · 21 power · 22 loss of
energy · 23 loss of substance · 25 loss of time · 27 reliability · 28 measurement accuracy · 29 manufacturing precision ·
30 external harm affecting the object · 31 object-generated harmful factors · 32 ease of manufacture · 33 ease of
operation · 34 ease of repair · 35 adaptability · 36 device complexity · 37 difficulty of detecting and measuring ·
38 extent of automation · 39 productivity.

### 19.4 Using the contradiction matrix
1. State the technical contradiction in words: "If we make the reed thinner (improving 1 weight of moving object /
   9 speed), then 14 strength gets worse."
2. Map to the improving parameter (row) and worsening parameter (column).
3. Read the cell: 1–4 principle numbers. (Cell contents differ slightly between published matrix versions – use one
   reference copy, e.g. Altshuller's 1971 matrix or the Matrix 2003/2010 of Mann, and cite it.)
4. Interpret each suggested principle for your problem; generate at least one concept per principle.
5. If no good idea: reformulate as a physical contradiction and use the separation principles (19.6).

### 19.5 The 40 inventive principles – with a machine-design example each

| # | Principle | Machine-design example |
|---|---|---|
| 1 | Segmentation | Stacked thin reed valves instead of one thick reed |
| 2 | Taking out / extraction | Move the noisy motor fan out of the cover; separate oil separator |
| 3 | Local quality | Induction-hardened crankpin only, soft core elsewhere |
| 4 | Asymmetry | Asymmetric cam profile (fast opening, soft closing) |
| 5 | Merging | Cast cylinder + crankcase in one piece; combined valve plate with both valves |
| 6 | Universality | One bearing housing for both cylinders |
| 7 | Nested doll | Valve spring inside spring; telescopic shaft |
| 8 | Anti-weight (counterweight) | Crank counterweights to balance inertia forces |
| 9 | Preliminary anti-action | Pre-stressed bolts; shot peening (compressive residual stress before load) |
| 10 | Preliminary action | Pre-assembled valve cartridge; pre-lubricated sealed bearings |
| 11 | Beforehand cushioning | Safety valve; shear pin; overload clutch |
| 12 | Equipotentiality | Work-piece transfer at constant height (no lifting) in assembly line |
| 13 | The other way round | Rotate the part instead of the tool (turning vs milling); fixed piston, moving cylinder |
| 14 | Spheroidality / curvature | Fillet radii instead of sharp corners; crowned rollers |
| 15 | Dynamics | Adjustable belt tensioner; variable-speed drive (VFD) |
| 16 | Partial or excessive action | Over-size casting then machine to size; fill mould excessively with risers |
| 17 | Another dimension | V-arrangement of cylinders (90°) instead of in-line → shorter, better balance |
| 18 | Mechanical vibration | Vibratory bowl feeder; vibration-assisted machining |
| 19 | Periodic action | Pulsed lubrication; intermittent cooling fan control |
| 20 | Continuity of useful action | Pallet changer keeps spindle cutting while loading (guide 09) |
| 21 | Skipping / rushing through | Fast induction hardening (short heat → little distortion) |
| 22 | Blessing in disguise | Use compression heat to dry the air / heat water |
| 23 | Feedback | Pressure switch, closed-loop speed control |
| 24 | Intermediary | Bearing bush between shaft and housing; sacrificial wear plate |
| 25 | Self-service | Self-lubricating bushings; pressure-energised seals |
| 26 | Copying | Virtual commissioning (simulated copy of the machine) |
| 27 | Cheap short-living objects | Disposable filter cartridges |
| 28 | Mechanics substitution | Magnetic coupling instead of shaft seal; sensor instead of mechanical stop |
| 29 | Pneumatics / hydraulics | Hydraulic tensioner; air cushion for transport |
| 30 | Flexible shells / thin films | Diaphragm instead of piston seal (oil-free) |
| 31 | Porous materials | Sintered self-lubricating bushes; sintered silencers |
| 32 | Colour changes | Colour-coded hoses; temperature-indicating paint on bearings |
| 33 | Homogeneity | Same material for contacting parts to avoid galvanic corrosion |
| 34 | Discarding and recovering | Sacrificial anodes; casting cores that are washed out |
| 35 | Parameter changes | Change temperature / hardness / state (heat treatment) |
| 36 | Phase transitions | Shrink-fit using cooling (liquid nitrogen) of the inner part |
| 37 | Thermal expansion | Shrink fit of the gear on the shaft; bimetal thermal switch |
| 38 | Strong oxidants | Plasma nitriding / oxygen-enriched cutting |
| 39 | Inert atmosphere | Argon shielding in welding and LPBF (guide 48) |
| 40 | Composite materials | Fibre-reinforced reed valves (PEEK-carbon) for some valve types |

### 19.6 Separation principles (for physical contradictions)
| Separation in… | Idea | Example |
|---|---|---|
| Time | Opposite values at different times | Belt tensioner loose for assembly, tight in operation |
| Space | Opposite values in different places | Reed thick at the root, thin at the tip (tapered reed) |
| Condition | Property depends on condition | Viscous coupling: soft at low slip, stiff at high slip |
| Scale (system level) | Parts have one property, whole system the other | Chain: each link rigid, the chain flexible |

### 19.7 Substance–field (Su-field) models and the 76 standard solutions
A minimal working system = two substances S1 (object), S2 (tool) and a field F (mechanical, thermal, chemical,
electric, magnetic…). Problems are an **incomplete** model (a part is missing) or a **harmful / insufficient** effect.
The **76 standard solutions** are grouped in 5 classes: 1 build or destroy Su-fields (13), 2 develop Su-fields (23),
3 transition to super-system / micro-level (6), 4 detection and measurement (17), 5 helpers for using the standards (17).
Example (class 4, measurement): measuring bearing wear is hard → add a substance/field that is easy to measure
(vibration sensor + envelope analysis, or wear particle sensor in the oil).

### 19.8 ARIZ (algorithm of inventive problem solving) – steps (ARIZ-85C, 9 parts)
1 Analyse the problem · 2 analyse the problem model (conflict zone, operating time, resources) · 3 formulate IFR and the
physical contradiction · 4 mobilise substance-field resources · 5 apply the information fund (standards, effects,
principles) · 6 change or replace the problem · 7 analyse the method of removing the contradiction · 8 apply the solution
to other problems · 9 analyse the problem-solving process (lessons). Use ARIZ only for hard problems; matrix + principles
solve most everyday cases.

### 19.9 Morphological analysis with compatibility
Number of combinations = Π (options per row). 4 rows × 3 options = **81**. Not all are compatible → **compatibility
matrix** (pairs of options that do not work together).

**Example R10** – rows: drive (V-belt / direct / gear), crank bearing (ball / roller / plain), cooling (fins + fan /
water / oil), valve (reed / ring plate / poppet). Incompatible pairs (example rules): direct drive + water jacket;
plain bearings + dry fins concept (needs oil circuit); poppet valve + V-belt speed concept. Result: **81 total, 55
compatible**. Then pre-select 4–6 promising combinations by quick rating (Pugh, ch. 20.4) before detailed evaluation.

### 19.10 Intuitive methods
- **Brainstorming:** 5–7 people, 20–30 min, no criticism, quantity first, build on others' ideas, then cluster.
- **Method 6-3-5:** 6 people write 3 ideas in 5 minutes, pass the sheet, 6 rounds → up to 108 ideas in 30 min; works
  better than brainstorming for shy teams and non-native speakers (written).
- **Analogy / bionics:** woodpecker skull → shock absorber; bone remodelling → topology optimisation; shark skin →
  low-drag surfaces.
- **Design catalogues (Roth, Koller):** tables of solution principles for standard functions (e.g. all ways to fix a
  hub to a shaft: key, spline, polygon, press fit, clamping set, adhesive, weld) with properties.

### 19.11 Patents – search and freedom to operate
- **Search method:** keywords + **IPC/CPC classes**. For piston air compressors look at F04B (positive-displacement
  machines and pumps, including subgroups for elastic fluids – e.g. multi-cylinder and component/accessory groups;
  check the current IPC scheme online once and save the class list offline), F16C (shafts, bearings), F16K (valves),
  F16J (pistons, seals). Databases: Espacenet (EPO), WIPO PATENTSCOPE, national offices.
- Read **claims** (legal scope), not only the abstract. Independent claim 1 is the widest.
- **Freedom to operate (FTO):** is your product inside the claims of a **valid, in-force** patent **in the countries**
  where you make or sell? Expired / lapsed patents (> 20 years from filing, or fees not paid) are free knowledge.
  FTO opinions for products you sell must come from a patent attorney – the engineer prepares the search.
- Patents are also a **creativity source**: TRIZ itself came from patents.

### 19.12 Checklist / common mistakes / references
[ ] Function structure first · [ ] ≥ 1 intuitive + 1 systematic method used · [ ] contradictions written explicitly ·
[ ] morphological combinations filtered by compatibility · [ ] patent search for the chosen concept.
Mistakes: compromising instead of solving a contradiction; evaluating ideas during generation; matrix used as a
mechanical recipe without interpretation; copying a patented solution unknowingly.
References: Altshuller, *And Suddenly the Inventor Appeared* (1996), *40 Principles* (1997) · Mann, *Hands-on Systematic
Innovation* (2002/2007) · Savransky, *Engineering of Creativity* (2000) · Zwicky (morphological method) · Rohrbach (6-3-5,
1969) · Roth, *Konstruieren mit Konstruktionskatalogen* · WIPO IPC scheme (current version).

---

## 20 Evaluation and decision

> Program: `tools/dm_req.py` (examples R11–R15).

### 20.1 The decision problem
Choose among alternatives a_1…a_m judged by criteria c_1…c_n with weights w_j. Steps: (1) check **demands** (go / no-go)
→ (2) **weights** (direct, pairwise, AHP) → (3) **scores** (scale with written meaning) → (4) **aggregate**
(weighted sum, VDI 2225 x/y) → (5) **sensitivity** → (6) **risk / uncertainty** → (7) decide + document.

### 20.2 Utility analysis (weighted sum)
Total value U_a = Σ_j w_j · s_aj with Σ w_j = 1. Score scales must be **defined per criterion** before scoring, e.g.
efficiency: 1 = < 85 %, 3 = 90–93 %, 5 = > 96 %. Criteria must be **independent** (no double counting: "cost" and
"price" are the same criterion). Hierarchical weights: main criterion weight × sub-criterion weight.

### 20.3 VDI 2225 – technical and economic value
VDI 2225 rates technical properties on a **0–4 scale** (0 unsatisfactory, 1 just tolerable, 2 adequate, 3 good,
4 very good / ideal) and computes:

  **Technical value x = Σ g_i p_i / (p_max · Σ g_i)**  **Economic value y = H_ideal / H**,  H_ideal = 0.7 · H_permissible

Plot every variant in the **strength diagram** (x horizontal, y vertical). The best variants lie near the top right and
near the diagonal x = y (balanced). A common combined measure is s = √(x·y) (others use the distance to the ideal point
– state which one you use).

**Example R12** – weights g = 3, 2, 2, 1 (function, efficiency, maintenance, size), permissible cost 70 (example
currency units), H_ideal = 49:

| Variant | Points p | Cost H | x | y | s = √(xy) |
|---|---|---|---|---|---|
| A V-belt | 3, 2, 3, 2 | 52 | 0.656 | **0.942** | **0.786** |
| B direct | 3, 4, 2, 3 | 61 | **0.750** | 0.803 | 0.776 |
| C gear | 2, 3, 1, 3 | 88 | 0.531 | 0.557 | 0.544 |
A and B are nearly equal (difference 1 %) → a tie: decide by risk and strategy (B is technically better; A is cheaper
now). C is clearly out (and above permissible cost → fails a demand).

### 20.4 Pugh method (iterative)
Matrix: alternatives vs criteria; one alternative is the **datum**; others get + (better), S (same), − (worse). Sum
+ and − (unweighted). Then **improve**: combine strengths of good concepts into hybrids, eliminate weak ones, choose a
new datum (the strongest), repeat 2–3 rounds until the set converges. Pugh is ideal for **early screening** of the
morphological combinations (19.9) because it needs no numbers.

### 20.5 AHP – Analytic Hierarchy Process (Saaty)
Weights from **pairwise comparisons** on the 1–9 scale (1 equal, 3 moderate, 5 strong, 7 very strong, 9 extreme;
reciprocals for the opposite direction). For n criteria build the n × n matrix M with m_ij = importance of i over j,
m_ji = 1/m_ij.

Theory: for a perfectly consistent matrix m_ij = w_i / w_j, so M·w = n·w – the weights are the eigenvector with
eigenvalue n. Real judgements are slightly inconsistent → use the **principal eigenvector** (eigenvalue λ_max ≥ n):
- Power iteration: w ← M w / ‖M w‖₁, repeat until stable.
- λ_max = mean_i ( (M w)_i / w_i ).
- **Consistency index CI = (λ_max − n)/(n − 1)**, **consistency ratio CR = CI / RI**.
- Random index RI (Saaty): n = 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49.
- Rule: **CR ≤ 0.10** acceptable; otherwise revise the judgements.

**Example R11** – criteria cost, efficiency, noise, size; judgements: cost vs efficiency 3, vs noise 5, vs size 7;
efficiency vs noise 3, vs size 5; noise vs size 3:
Weights **0.565, 0.262, 0.118, 0.055**, λ_max = 4.117, CI = 0.039, **CR = 0.043** → consistent.
**R11b** – circular judgements (A > B 3, B > C 3, C > A 3): λ_max = 4.333 (n = 3), CR = **1.15** → inconsistent, redo.

MATLAB:
```matlab
[V,D] = eig(M); [lmax,i] = max(real(diag(D))); w = real(V(:,i)); w = w/sum(w);
CI = (lmax-n)/(n-1); CR = CI/RI(n);
```

### 20.6 Sensitivity and break-even weights
A decision is **robust** if the winner does not change for reasonable weight changes. Break-even weight: vary w_k,
scale the other weights proportionally (sum = 1), find where totals of two alternatives are equal.
**Example R13** – E1 matrix of the main guide (V-belt 3.75 vs direct coupling 4.05 at w_cost = 0.30): the cost weight
would have to rise to **0.46** before the V-belt wins. If the team agrees cost is not 46 % of the decision, the result
is robust.

### 20.7 Decision under uncertainty
When the outcome depends on an uncertain scenario (demand, price), build a payoff table:

**Example R14** – make the crankshaft in-house vs buy vs split; profit over 5 years (example k-currency) for demand
low / medium / high with probabilities 0.25 / 0.50 / 0.25:

| Alternative | Low | Medium | High | Expected value | Worst case | Max regret |
|---|---|---|---|---|---|---|
| Make in-house | −120 | 60 | 210 | 52.5 | −120 | 130 |
| Buy | 10 | 50 | 90 | 50.0 | **10** | 120 |
| Make + buy split | −40 | 70 | 150 | **62.5** | −40 | **60** |
Criteria: **expected value** (risk-neutral) → split; **maximin** (pessimist) → buy; **minimax regret** (least
disappointment) → split. When two criteria agree, the decision is strong. Regret = best payoff in that scenario minus
the payoff of the alternative.

### 20.8 FMEA (AIAG-VDA handbook 2019) – the 7 steps
1. **Planning & preparation** – scope, team, timing (5T: intent, timing, team, tasks, tools).
2. **Structure analysis** – system → subsystem → component tree (e.g. compressor → crank train → crankshaft).
3. **Function analysis** – functions and requirements for each element (from ch. 17/18).
4. **Failure analysis** – failure chain: **failure effect** (higher level) ← **failure mode** (this element) ←
   **failure cause** (lower level / design parameter).
5. **Risk analysis** – current **prevention** controls (design rules, calculations) and **detection** controls (tests,
   analyses); rate **S** severity, **O** occurrence, **D** detection (1–10 each).
6. **Optimisation** – actions, responsible person, date; re-rate.
7. **Results documentation** – report, communication.

Rating summary (design FMEA, simplified wording – use the official tables):

| Rating | Severity S | Occurrence O (design) | Detection D |
|---|---|---|---|
| 9–10 | Affects safe operation or legal compliance | Very high: new technology, no history | No or unproven detection method |
| 7–8 | Loss / degradation of primary function | High: new design, little experience | Detection late, method not proven |
| 4–6 | Loss / degradation of secondary function, annoyance | Moderate: similar to known designs with some problems | Proven method, applied moderately early |
| 2–3 | Small, noticed by some customers | Low: known design, few problems | Proven method, early, high confidence |
| 1 | No effect | Very low / prevented by proven controls | Failure prevented by design |

**Action Priority (AP):** the 2019 handbook replaced the RPN (S×O×D) as the main ranking with an **AP table** giving
**High / Medium / Low** for each S-O-D combination. Logic: severity first, then occurrence, then detection – a high
S with non-low O is High priority even if detection is good. **Use the official AP table** from the handbook (it is a
large lookup table; it is not reproduced here). The program `dm_req.py` only gives RPN for comparison with old FMEAs.

### 20.9 Worked FMEA rows – compressor crank train (example)

| Element / function | Failure mode | Effect (S) | Cause | Prevention | O | Detection | D | RPN (old) | Action |
|---|---|---|---|---|---|---|---|---|---|
| Crankshaft – transmit torque 20 000 h | Fatigue crack at pin fillet | Compressor stops, possible damage (8) | Fillet radius too small / no hardening | Goodman calc (ch. 26), FKM | 4 | 1 000 h endurance test late in project | 5 | **160** | Increase fillet to r 2.0, induction harden, strain-gauge test at prototype → re-rate O 2, D 3 → RPN 48 |
| Conrod bearing – carry load | Seizure | Stop (8) | Oil film too thin at start | Bearing calc (item M4/M3) | 3 | Bench test with temperature monitoring | 4 | 96 | Add oil groove, test 200 000 starts accelerated |
| Valve reed – seal / open | Reed fracture | FAD loss, noise (5) | High impact stress, wrong lift | Valve simulation (C31) | 6 | Endurance test | 4 | **120** | Reduce lift, shot-peen reed |
The program prints RPN 160 → 48 for the first row after the action. With the AP table, row 1 before action would very
likely be **High** (S = 8, O = 4) – check with the official table.

### 20.10 From FMEA to DVP&R and control plan
- **DVP&R (Design Verification Plan & Report):** every detection control in the DFMEA becomes a planned test or
  analysis line: test name, specification / acceptance criterion, sample size, responsible, timing, **result** (pass /
  fail). E.g. "Crankshaft fatigue: 3 parts, 10⁷ cycles at 1.3 × LC2 torque, no crack (magnetic particle check)".
- **Special characteristics:** causes with high S that depend on a manufacturing characteristic (fillet radius,
  hardness depth) are marked on the drawing (17.6).
- **Process FMEA → control plan:** the process FMEA (machining, heat treatment) analyses how the characteristic can be
  wrong; the control plan defines how it is checked in production (gauge, frequency, reaction plan, SPC).
- **Feedback:** field failures and test failures update O ratings and design rules for the next product.

### 20.11 Checklist
- [ ] Demands checked before scoring · [ ] score scales defined per criterion · [ ] weights by AHP with CR ≤ 0.10 (or
justified directly) · [ ] sensitivity / break-even weights computed · [ ] ties decided by risk, documented ·
[ ] uncertainty table for investment-type decisions · [ ] DFMEA uses the 2019 AP table · [ ] each high-AP item has an
action and a DVP&R line · [ ] special characteristics transferred to drawing + control plan.

### 20.12 Common mistakes
Weights chosen after seeing scores (bias) · double counting correlated criteria · treating a 2 % difference as a win ·
AHP with CR > 0.1 accepted · FMEA done after the design is frozen (then it is documentation, not prevention) · RPN
thresholds ("act if RPN > 100") – they hide high-severity items with low RPN.

### 20.13 References
VDI 2225-3 (technical-economic evaluation; check current part / edition) · Saaty, *The Analytic Hierarchy Process*
(1980) · Pugh, *Total Design* (1991) · AIAG & VDA, *FMEA Handbook* (1st ed. 2019) · IEC 60812:2018 (FMEA general) ·
Pahl/Beitz (evaluation chapter) · Clemen & Reilly, *Making Hard Decisions* (3rd ed. 2014).


---

## 21 Embodiment design – from concept to a calculable, makeable layout

> Program: `tools/dm_embody.py` (`python dm_embody.py examples`, `selftest`). Examples 21a–21f are computed there.
> All numbers are **example values**.

### 21.1 What embodiment means
Embodiment (German *Gestaltung*) turns the chosen concept (S3) into a **definitive layout**: main dimensions, materials,
load paths, standard parts, joints, and the arrangement that lets you make, assemble, inspect and service it. Output:
scaled layout drawing / skeleton CAD assembly + sizing calculations + list of open risks. Detail design (S5) then
only adds tolerances and small features.

Order of work (VDI 2223 / Pahl & Beitz):
1. Collect the **spatial constraints** (envelope, interfaces, motor, base, piping, access).
2. Find the **determining main function carriers** (for a compressor: crank train, cylinders, valves, bearings).
3. Rough layout of these carriers – **hand-sized** from the load cases (section 5.1).
4. Add **auxiliary function carriers** (seals, lubrication, cooling, fixings).
5. Check the layout against the **rules** (21.2) and **principles** (21.3–21.9).
6. Evaluate variants of the layout (same method as S3) → definitive layout.

### 21.2 The three basic rules: clear – simple – safe
| Rule | Ask yourself | Bad example | Good example |
|---|---|---|---|
| **Clear** (eindeutig) | Is every load path, every function, every fit defined and calculable? | Shaft held by 3 bearings in one rigid housing – load sharing unknown (statically indeterminate) | Locating + floating bearing: each bearing has a known load |
| **Simple** | Fewer parts, simple shapes, standard parts, few operations? | Welded bracket of 9 plates | One bent sheet or one cast bracket |
| **Safe** | Is safety built into the design, not into warnings? | "Do not open while running" label | Interlocked guard; pressure relief valve sized by standard |

### 21.3 Safety principles (ISO 12100 three-step method)
**ISO 12100 order of risk reduction:**
1. **Inherently safe design** – remove or reduce the hazard by design (lower energy, no pinch point, rounded edges,
   lower pressure, stable base).
2. **Safeguarding and protective measures** – guards, interlocks, light curtains, safety valves (ISO 14120, ISO 13849).
3. **Information for use** – warnings, manual, training – only for the remaining risk.

**Three strategies for structural safety:**
| Strategy | Principle | Machine example | Needs |
|---|---|---|---|
| **Safe-life** | Part survives the whole life without failure | Crankshaft designed for infinite life (1.74·10⁹ cycles) | Good load data, fatigue calc + test |
| **Fail-safe** | A failure is allowed but has no dangerous result | Belt guard catches a broken belt; burst disc after relief valve | Defined failure mode, inspection |
| **Redundancy** | Two independent elements share the function | Two pressure switches + relief valve on the air tank; dual-channel safety circuit | Independence (no common cause) |
Also **principle of limited failure** (part fails slowly and visibly – ductile material, leak before break) and
**self-protection** (shear pin, slip clutch protects expensive parts).

### 21.4 Force-flow (load-path) design
Think of force as a fluid flowing through the part. Stress concentrates where the "flow lines" crowd or turn sharply.

Rules:
- **Shortest direct path.** Put bearings close to the load; a pulley overhang of 60 mm instead of 30 mm doubles the
  bending moment M = F·a.
- **Avoid sudden changes of section.** Fillet radius r ≥ 0.1·d at shaft shoulders where possible; relief grooves;
  stress-relief notches above the critical notch (they "guide" the flow).
- **Tension and compression instead of bending.** A truss (triangles) is 5–20× stiffer than a beam of the same mass.
- **Close the force loop inside the machine.** Gas force on the piston and on the cylinder head are closed through
  the cylinder bolts and crankcase – keep this loop short and stiff, not through the base frame.
- **Similar deformation of connected parts.** Hub and shaft should deform similarly (hub with chamfer / thinner
  rim at the end) → lower edge pressure in press fits.

### 21.5 Division of tasks, self-help, stability
- **Division of tasks:** one element per function → each element can be optimised and calculated alone. Example:
  the key transmits torque, the shoulder locates axially, the press fit centres – instead of one tapered fit doing all.
  Cost: more parts. Opposite principle: **integration of functions** (fewer parts, e.g. cast-in oil channel) – use
  when the functions do not conflict.
- **Self-help (self-reinforcing):** the load itself increases the function. Examples: O-ring and lip seals pressed by
  the pressure they seal; reed valve pressed onto its seat by the gas pressure; self-energising brake.
- **Stability:** a disturbance must decrease, not grow. Static: wide support base (tipping), centre of gravity low.
  Thermal: avoid closed loops that heat unevenly. Hydrodynamic bearing: check for oil whirl.

### 21.6 Equal strength – derivation of the tapered beam
A cantilever of length L with end load F and rectangular section b × h(x) (x from the free end):
bending moment M(x) = F·x, section modulus W(x) = b·h(x)²/6, stress σ(x) = M/W = 6·F·x / (b·h(x)²).
Demand σ(x) = σ_allow everywhere:

  **h(x) = √(6·F·x / (b·σ_allow))**  – a parabola.

Volume: ∫₀ᴸ b·h dx = b·h(L)·(2/3)·L → **one third less material** than a constant section h(L).

**Example 21a:** F = 2000 N, b = 20 mm, σ_allow = 150 MPa, L = 200 mm → h_root = √(6·2000·200/(20·150)) =
**28.28 mm**, mean height 18.86 mm, saving **33.3 %**. Real parts: the free end needs a minimum height for shear
(τ = 1.5·F/(b·h)) and for the load introduction – taper to a minimum, not to zero. Same idea: tapered reed valve,
stepped shafts, forged conrod I-section, cast ribs thicker at the root.

### 21.7 Design for stiffness
Stiffness k = F/δ (N/mm or N/µm). Elements in the load path add like springs:
- **Series** (same force passes through all): 1/k = Σ 1/k_i → the **weakest** element dominates.
- **Parallel** (same deflection): k = Σ k_i.

Basic element stiffness (example formulas):
| Element | Stiffness |
|---|---|
| Bar (tension) | k = E·A/L |
| Cantilever, end load | k = 3·E·I/L³ |
| Simply supported, centre load | k = 48·E·I/L³ |
| Shaft in torsion | k_t = G·I_p/L (N·mm/rad) |
| Ball bearing (radial, rough) | k ≈ 30–100 N/µm (small bearings, preloaded higher) – **maker data** |
| Bolted joint | bolt k_b = E·A/L_k; clamped parts k_p ≈ 3–10·k_b (VDI 2230 cone model) |

**Bolt load factor.** External axial load F_A on a preloaded joint: the bolt sees only Φ·F_A with
Φ = k_b/(k_b + k_p). **Example 21c:** M10 bolt, stress area 58 mm², grip 30 mm, k_b = 210 000·58/30 = **406 000 N/mm**,
k_p = 4·k_b → **Φ = 0.20**: only 20 % of the cylinder-head gas force reaches the bolt as alternating load → this is why
stiff clamped parts and elastic (long, thin) bolts improve fatigue life. Full method: item M7 (VDI 2230).

**Stiffness budget – procedure:**
1. Allowed deflection δ_allow at the functional point (from requirement: e.g. gear mesh misalignment, tool position).
2. Required total k_tot = F/δ_allow.
3. Split δ_allow into shares for each element in series (experience: shaft 30–40 %, bearings 20–40 %, housing 20–40 %).
4. Each element needs k_i = F/(δ_allow·share_i). Design each part to its target; check 1/k_tot = Σ1/k_i.

**Example 21b:** F = 1000 N, δ_allow = 10 µm → k_tot = **100 N/µm**. Shares 40/30/30 % → shaft **250 N/µm**,
bearings **333 N/µm**, housing **333 N/µm**; series check gives exactly 100 N/µm.

### 21.8 Thermal design
Free thermal expansion: **ΔL = α·L·ΔT** (α in 1/K). Typical α (10⁻⁶/K): steel 11–12, grey iron 10–11, ductile iron
11–12.5, aluminium alloys 21–24, austenitic stainless 16–17, PA66-GF30 20–40 (direction dependent).

If parts with different α are fixed together, the difference becomes **stress** (σ = E·Δα·ΔT if fully blocked) or
**lost clearance / preload**.

**Example 21d – crank bearing distance 120 mm, crankcase warms 60 K more than at assembly:**
| Crankcase | ΔL case | ΔL steel shaft | Difference |
|---|---|---|---|
| Aluminium (α 23·10⁻⁶) | 0.1656 mm | 0.0828 mm | **0.0828 mm** |
| Grey iron (α 10.5·10⁻⁶) | 0.0756 mm | 0.0828 mm | **0.0072 mm** |
With an aluminium crankcase, two fixed ball bearings would be pulled apart by 0.08 mm → high axial load, short life.
Solutions: **locating + floating bearing** (one bearing fixed axially, the other free to slide in its housing or a
cylindrical roller bearing NU type), or steel bearing liners, or pre-set axial play calculated for the hot condition.
Further thermal rules: allow growth in one direction from a defined fixed point; symmetric heat sources; check fits at
both cold and hot temperature (a press fit in aluminium can loosen when hot: aluminium hub grows faster than the steel
bearing ring); cooling fins on the hot side; thermal stress check for cylinder/head bolts.

### 21.9 Design for noise and vibration
Natural frequency of a single mass on a spring: **f_n = (1/2π)·√(k/m)**.

| Goal | Rule |
|---|---|
| Stiff structure (brackets, frames, guards) | f_n ≥ **1.3–1.5 ×** highest relevant excitation frequency (better ≥ 2× when cheap) |
| Vibration isolation (machine on mounts) | f_n ≤ f_excitation / 2.5…3 (isolation starts at r = f/f_n > √2) |
| Never | Run continuously near f_n (resonance; amplification 1/(2ζ), ζ ≈ 0.02–0.05 for steel structures → 10–25×) |

Transmissibility (force through the mounts): T = √[(1 + (2ζr)²) / ((1 − r²)² + (2ζr)²)], r = f/f_n.

**Example 21e – compressor pump 60 kg on 4 rubber mounts, first order 1450/60 = 24.2 Hz, second order 48.3 Hz:**
target f_n = 8 Hz → k = m·(2π·f_n)² = 60·(2π·8)² = **151 600 N/m** → **37.9 N/mm per mount**. r = 3.02 →
T = **0.123** undamped (only 12 % of the force reaches the floor), **0.143** with ζ = 0.1. A sheet bracket on the
pump with k = 5·10⁶ N/m carrying 3 kg has f_n = **205 Hz** ≥ 1.5 × 48.3 = 72 Hz → OK. Also check the start-up:
the machine passes through 8 Hz when starting/stopping – ζ of the mount limits the peak.
Noise rules: reduce the source first (balancing – item M2, valve impact, fan blade-pass frequency), then the path
(stiff, damped panels; grey iron damps 5–10× better than steel), then the receiver (enclosure). Measure: ISO 3744
sound power, ISO 10816/20816 vibration severity.

### 21.10 Design for corrosion
- Choose material for the environment (humid compressed air with condensate → tank inside coating or galvanising,
  drain valve; stainless for valve reeds).
- Avoid **galvanic couples** (aluminium with steel/stainless in wet areas – insulate, use zinc-flake coated bolts).
- Avoid crevices and water traps; give drain holes; weld continuous, not stitch, in wet zones.
- Corrosion allowance for pressure parts (EN 13445: often 1 mm unless justified).
- Surface protection: paint system by ISO 12944 corrosivity class (C2–C5), zinc-flake (ISO 10683) for bolts.

### 21.11 Modular and platform design
- **Module:** a unit with defined interfaces that can be combined (pump, motor, tank, control box).
- **Platform:** common parts across a family (same crankcase for 2 bores, same crankshaft for 2 strokes).
- **Size ranges** follow **similarity laws** with a constant step ratio (21.12): stresses stay equal if all lengths scale
  by φ_L and speed is adapted.
- Benefits: fewer part numbers, larger lots, faster variants. Cost: some parts are over-sized for the small variant.

### 21.12 Standardisation and preferred numbers (ISO 3, Renard)
Geometric series with a constant ratio give even steps over a range. Renard series **Rn: q = 10^(1/n)**.
- R5 q = 1.585, **R10 q = 1.259**, **R20 q = 1.122**, R40 q = 1.059.
- Theoretical R10: 1.000, 1.259, 1.585, 1.995, 2.512, 3.162, 3.981, 5.012, 6.310, 7.943 (Example 21f).
- Rounded R10 (ISO 3): **1, 1.25, 1.6, 2, 2.5, 3.15, 4, 5, 6.3, 8** (×10ⁿ).
- Rounded R20: 1, 1.12, 1.25, 1.4, 1.6, 1.8, 2, 2.24, 2.5, 2.8, 3.15, 3.55, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9.
Use for: tank volumes, motor powers, pressures, size ranges, main dimensions. Also use **standard parts** first
(ISO bolts, DIN/ISO bearings, keys, circlips, O-rings ISO 3601) and **company standards** (preferred list of 20 bolt
sizes, 10 materials) – fewer part numbers, lower stock, faster design.

### 21.13 Design for maintenance (and service)
Wear parts (valves, reeds, piston rings, filter, belt) reachable without dismantling the pump; standard tools;
inspection points visible (oil level, belt tension); lifting points for parts > 20 kg; replaceable liners instead of
whole crankcase; service intervals from calculated life (bearings L10, rings wear).

### 21.14 Checklist and common mistakes (embodiment)
Checklist – [ ] every load path drawn and calculable · [ ] statically determined supports (locating/floating) ·
[ ] stiffness budget for functional points · [ ] thermal growth checked hot and cold · [ ] natural frequencies vs
excitation (1st, 2nd order, blade pass) · [ ] galvanic couples avoided · [ ] standard and preferred sizes used ·
[ ] wear parts serviceable · [ ] ISO 12100 three-step method applied.
Mistakes – over-constrained bearing arrangements; long overhangs; bracket resonance at 2nd order; aluminium press fits
that loosen hot; forgetting that stiffness, not strength, decides machine parts.

**References:** VDI 2223, ISO 12100, ISO 3, ISO 12944, VDI 2230-1, ISO 20816-1; Pahl/Beitz *Engineering Design*
ch. 7; Ehrlenspiel *Integrated Product Development*; Harris/Piersol *Shock and Vibration Handbook*.

---

## 22 Material selection – Ashby method, machine materials, heat treatment

### 22.1 The method in four steps (Ashby)
1. **Translate** the function into: function, objective (minimise mass / cost / volume), constraints (stiffness,
   strength, temperature, corrosion), free variables (usually one dimension).
2. **Screen**: remove materials that fail hard limits (temperature, corrosion, process, availability).
3. **Rank** with the **performance index** M (derived from objective + constraint, 22.2).
4. **Document**: look at the top 3–5 in detail – cost, process, damping, fatigue data, supplier, experience.

### 22.2 Derivation of performance indices
**Light, stiff tie** (rod length L fixed, area A free, stiffness S = E·A/L required):
mass m = A·L·ρ, eliminate A = S·L/E → m = S·L²·(ρ/E) → minimise ρ/E → **M = E/ρ**.

**Light, strong tie:** F ≤ A·σ_f → A = F/σ_f → m = F·L·ρ/σ_f → **M = σ_f/ρ**.

**Light, stiff beam** (square section a × a, a free, L fixed, stiffness S = C·E·I/L³, I = a⁴/12):
a² = (12·S·L³/(C·E))^½ → m = a²·L·ρ = (12·S/C)^½·L^(5/2)·(ρ/E^½) → **M = E^½/ρ**.

**Light, strong beam:** σ = M_b/W, W = a³/6 → a = (6·M_b/σ_f)^(1/3) → m ∝ ρ/σ_f^(2/3) → **M = σ_f^(2/3)/ρ**.

**Light, stiff plate** (thickness t free, width and length fixed, S ∝ E·t³): t ∝ (1/E)^(1/3) → m ∝ ρ/E^(1/3) →
**M = E^(1/3)/ρ**. **Light, strong plate:** σ ∝ 1/t² → **M = σ_f^½/ρ**.

**Spring (max elastic energy per volume):** U/V = σ_f²/(2E) → **M = σ_f²/E** (for fatigue-loaded springs use the
fatigue strength σ_w).

**Shaft in torsion:** strong solid shaft: τ = 16·T/(π·d³), d free → **M = σ_f^(2/3)/ρ** (same as beam); stiff shaft:
**M = G^½/ρ**.

| Component | Constraint | Free variable | Index (maximise) |
|---|---|---|---|
| Tie | stiffness / strength | area | E/ρ, σ_f/ρ |
| Beam, shaft | stiffness / strength | section size | E^½/ρ, σ_f^(2/3)/ρ |
| Plate / panel | stiffness / strength | thickness | E^(1/3)/ρ, σ_f^½/ρ |
| Spring | energy, no failure | – | σ_f²/E |
| Minimum cost | any of the above | same | replace ρ by **C_m·ρ** (C_m = price per kg) |

**Shape factor φ:** a tube, I-beam or box is stiffer than a solid square of the same area. Stiffness shape factor
φ_B = 12·I/A² (solid square = 1; standard I-beams 5–15; thin tubes 10–30). Index with shape: (φ_B·E)^½/ρ. Limited by
buckling of thin walls and by the process (casting minimum wall, extrusion).

### 22.3 Multiple constraints and objectives
- **Two constraints** (e.g. stiffness and strength): calculate mass for each constraint separately; the **larger** mass
  is the active constraint for that material; rank by this value (the active constraint may differ by material).
- **Two objectives** (mass and cost): **penalty function Z = C + α·m** with an **exchange constant α** (value of saving
  1 kg in money). Typical α: stationary machines 0–5 USD/kg, transport vehicles 5–50, aircraft 500+, space 10 000+.

**Example 22b/22c – crankcase side wall as a plate of equal bending stiffness** (reference grey iron 20 kg):
m_Al/m_GJL = (E^(1/3)/ρ)_GJL / (E^(1/3)/ρ)_Al = 0.67/1.55 = **0.431** → aluminium wall is **2.3× lighter** (8.6 kg).
With relative prices (example: GJL 2, AlSi10Mg 6, S355 2.2 USD/kg):
| Material | Mass kg | Cost USD | Z (α = 2) | Z (α = 50) |
|---|---|---|---|---|
| EN-GJL-250 | 20.0 | 40.0 | 80.0 | 1040 |
| AlSi10Mg T6 | 8.6 | 51.7 | **68.9** | **482** |
| S355 (welded) | 17.6 | 38.7 | 73.8 | 918 |
Even at α = 2 USD/kg aluminium wins Z – **but** this simple index ignores process cost (casting + machining),
damping (grey iron much better for noise), thermal expansion vs steel crankshaft (21.8), wear of bores (aluminium
needs liners or coated bores). That is why stationary compressors mostly use grey iron and portable ones aluminium.

### 22.4 Material data for common machine materials (typical values – **check certificate / EN standard**)
| Material (standard) | E GPa | ρ kg/m³ | R_e / R_p0.2 MPa | R_m MPa | σ_bW est. MPa | Rel. cost/kg | Typical use |
|---|---|---|---|---|---|---|---|
| S235JR (EN 10025-2) | 210 | 7850 | 235 | 360–510 | ≈ 180 | 1.0 | Frames, brackets, base plates |
| S355J2 (EN 10025-2) | 210 | 7850 | 355 | 470–630 | ≈ 235 | 1.1 | Welded frames, tank skirts |
| C45 +QT (EN ISO 683-1, 16–40 mm) | 210 | 7850 | 430 | 650–800 | ≈ 300 | 1.3 | Shafts, pins, simple crankshafts |
| 42CrMo4 +QT (EN ISO 683-2, 16–40 mm) | 210 | 7850 | 750 | 1000–1200 | ≈ 480 | 1.8 | Highly loaded shafts, crankshafts, conrod bolts |
| 16MnCr5 case hardened (EN ISO 683-3) | 210 | 7850 | core ≈ 650 | core ≈ 1000 | ≈ 450 (surface higher) | 1.7 | Small gears, pins, cams |
| 18CrNiMo7-6 case hardened | 210 | 7850 | core ≈ 850 | core ≈ 1200 | ≈ 550 | 3.0 | Heavy gears |
| 100Cr6 hardened (EN ISO 683-17) | 210 | 7830 | – (60–64 HRC) | ≈ 2000 | ≈ 800 | 2.0 | Bearings, guide rails, pins |
| EN-GJL-250 grey iron (EN 1561) | 103–118 | 7200 | R_p0.1 ≈ 165 | 250 | ≈ 110 | 1.0 (casting) | Crankcase, cylinders, beds – damping |
| EN-GJS-500-7 ductile (EN 1563) | 169 | 7100 | 320 | 500 | ≈ 224 | 1.2 (casting) | Crankshafts (cast), housings |
| AlSi10Mg T6 cast (EN 1706) | 71 | 2680 | ≈ 220 | ≈ 260 | ≈ 80 | 3.0 | Light crankcases, heads, covers |
| EN AW-6082-T6 (EN 755-2) | 70 | 2700 | 260 | 310 | ≈ 90 | 3.5 | Profiles, plates, fixtures |
| EN AW-7075-T6 | 72 | 2810 | ≈ 500 | ≈ 570 | ≈ 160 | 7.0 | Highly stressed light parts |
| X5CrNi18-10 / 1.4301 (EN 10088) | 200 | 7900 | ≈ 210 | 520–720 | ≈ 240 | 4.0 | Food / wet parts, covers |
| PA66-GF30 (dry) | ≈ 9.5 (conditioned ≈ 6) | 1350 | ≈ 180 | ≈ 180 | ≈ 50 | 4.0 | Fan blades, covers, clips |
| PTFE | 0.4–0.75 | 2170 | ≈ 12 | 20–35 | – | 15 | Seals, piston rings (filled), slides |
σ_bW = rotating-bending fatigue strength, unnotched polished specimen, **rough estimate** (steel ≈ 0.45–0.5·R_m) –
use DIN 743 / FKM values for design (item M3). R_m of grey iron depends on wall thickness (EN 1561 table).
Relative costs are rough market classes (2026) – ask suppliers.

### 22.5 Heat treatment – what, how hard, how deep, when
| Process | Steels | Surface hardness | Depth | Distortion | Use when |
|---|---|---|---|---|---|
| **Quench & temper (QT)** | C45, 42CrMo4, 34CrNiMo6 | 200–350 HB (through) | Through (limited by hardenability / size) | Medium – machine after | Shafts, crankshafts, bolts – strength + toughness |
| **Case hardening** (carburise + quench + temper) | 16MnCr5, 20MnCr5, 18CrNiMo7-6 | 58–62 HRC | CHD 0.3–2.0 mm (≈ 0.15–0.2·m for gears) | High – grind after | Gears, cams, pins – wear + fatigue |
| **Induction hardening** | C45, 42CrMo4, GJS | 50–58 HRC | 1–5 mm | Low, local | Crank pins, journals, shaft seats |
| **Gas nitriding** | 31CrMoV9, 42CrMo4, nitriding steels | 600–900 HV (compound layer + diffusion) | 0.2–0.6 mm | Very low (≈ 500–570 °C) | Finished parts, cylinder liners, spindles |
| **Nitrocarburising** | Most steels | 400–700 HV | 0.1–0.3 mm | Very low | Wear + corrosion on cheap parts |
| **Through hardening** | 100Cr6 | 58–64 HRC | Through | High | Bearing rings, small pins |
| **Annealing / stress relief** | Welds, castings | – | – | Removes stress | Before finishing precise welded / cast parts |
Rules: specify on the drawing hardness + effective depth + where (ISO 15787 for heat-treatment indication), e.g.
"Induction hardened 52–58 HRC, Rht 1.5–2.5 mm (at 450 HV), pins and journals only". Hardening creates **compressive
residual stress** at the surface → higher fatigue strength (often +30–100 %). Grind after case hardening (remove
distortion), but control grinding burn (Nital etch test ISO 14104).

### 22.6 Surface treatments
Shot peening (compressive stress, +20–50 % fatigue, valve reeds and springs), rolling of fillets (crankshaft fillet
rolling, +50–100 % fatigue at the fillet), hard chrome / PVD coatings (wear), phosphating + oil (corrosion, running-in),
anodising (aluminium), zinc-flake (bolts), paint by ISO 12944.

### 22.7 Worked selection examples (compressor)
| Part | Function / constraint | Candidates | Choice + reason |
|---|---|---|---|
| **Crankshaft** | Strong shaft in bending + torsion, fatigue 10⁹ cycles, wear at pins | GJS-700-2 cast, C45 forged + induction, 42CrMo4 QT | Small compressor: **GJS-600/700 cast** (near-net shape, good damping) or **C45 forged + induction-hardened pins**; 42CrMo4 only if size is limited. Index σ^(2/3)/ρ similar; cost and process decide |
| **Connecting rod** | Light, strong in compression/buckling, fatigue | AlSi cast / forged Al, C45 forged | Small oil-free compressors: **aluminium rod with direct bearing**; lubricated: forged steel or GJS |
| **Valve reed** | Max fatigue strength in bending, low mass, corrosion | Hardened carbon spring steel, stainless 1.4310 / special valve steels | **Special valve steel strip (stainless, hardened, tumbled edges)**; index σ_w²/E – highest σ_w wins (22d: 42CrMo4 1.10 vs C45 0.43 – strip valve steels are far higher) |
| **Crankcase** | Stiff plate, damping, low cost, bores wear | GJL-250, AlSi10Mg | Stationary: **GJL-250** (damping, cost, same α as steel); portable: **AlSi10Mg** with liners (22.3) |
| **Fan** | Light, cheap, shape | PA66-GF30, Al | **PA66-GF30** injection moulded |

### 22.8 Checklist, mistakes, references
Checklist – [ ] function, objective, constraints written · [ ] index derived for the right free variable · [ ] screening by
temperature, corrosion, process · [ ] data from EN standard / certificate (3.1 to EN 10204) · [ ] heat treatment and
depth on drawing · [ ] fatigue data (not only R_m) · [ ] cost incl. process.
Mistakes – choosing by R_m only; using library fatigue values; forgetting size effect (QT strength falls with diameter);
case hardening without grinding allowance; aluminium in contact with steel in wet areas.
**References:** EN 10025, EN ISO 683-1/-2/-3/-17, EN 1561, EN 1563, EN 1706, EN 573/755, EN 10088, EN 10204, ISO 15787;
Ashby *Materials Selection in Mechanical Design*; Ashby/Jones *Engineering Materials*; Krauss *Steels – Processing,
Structure and Performance*; ASM Handbook vol. 4 (Heat Treating).

---

## 23 Design for manufacturing (DFM), assembly (DFA) and cost

### 23.1 Principle
70–80 % of product cost is fixed in design. DFM rule: **choose the process early, then design to its rules**; every
feature must be makeable with standard tools, in few set-ups, at the tolerance the process reaches without special effort.

### 23.2 Process rules with numbers (typical guide values – confirm with your supplier)
| Process | Rules |
|---|---|
| **Sand casting (grey / ductile iron)** | Min wall 4–6 mm (GJL), 5–8 mm (GJS); uniform walls, transitions ≤ 1:3 with radii; draft 1–3°; inner radius ≥ ⅓ of wall; avoid isolated hot spots (risers / chills); machining allowance 2–5 mm (ISO 8062-3 RMA grade); general tolerances ISO 8062-3 **DCTG 10–13** for sand castings (see standard table); datum targets on cast surfaces for first set-up |
| **Pressure die casting (Al)** | Wall 1.5–4 mm; draft 0.5–2°; ribs instead of thick walls; ejector pin areas; porosity in thick sections – no pressure-tight walls without impregnation; DCTG 4–7 |
| **Forging (closed die)** | Draft 3–7°; parting line on the largest section; radii ≥ 2–6 mm; flash 2–5 mm; machining allowance 1.5–4 mm; EN 10243-1 tolerances |
| **Turning** | Standard grooves (DIN 76 thread undercut, DIN 509 relief groove); chamfers 45°; avoid deep narrow grooves; L/D of slender parts ≤ 4 without tailstock, ≤ 10–20 with steady rest |
| **Milling** | Internal corner radius ≥ tool radius (use R ≥ 1.1 × tool radius to avoid full engagement); pocket depth ≤ 3–4 × tool diameter; flat datum faces; all features from as few directions as possible (HMC: 4 sides + top in one set-up) |
| **Drilling / threading** | Drill depth ≤ 5·D standard, up to 10–30·D with gun/coolant drills; flat entry and exit; tapped hole depth = thread + 2–3 pitches; thread engagement in steel ≈ 1.0–1.25·d, in grey iron ≈ 1.25–1.5·d, in aluminium ≈ 1.5–2·d |
| **Grinding / honing** | Grinding relief at shoulders; honing needs a run-out (bore open or relief at the bottom); plateau honing of cylinder bores (Rpk, Rk, Rvk spec) |
| **Welding** | Access for the torch; avoid weld accumulation; symmetric welds against distortion; weld before final machining; EN ISO 5817 quality levels B/C/D; EN ISO 13920 general tolerances |
| **Sheet metal** | Inner bend radius ≥ 1·t (steel), ≥ 1.5–2·t (Al hard); hole distance from bend ≥ 2·t + R; flange length ≥ 4·t; bend relief |
| **Additive (LPBF metal)** | Overhang ≥ 45° from horizontal without supports; min wall ≈ 0.4–1 mm; holes Ø < 8 mm self-supporting; powder removal openings; machining allowance 0.5–1 mm on functional faces (guide 48) |

**Bend allowance (sheet):** BA = θ·(R + K·T) (θ in rad, K-factor 0.3–0.5). **Example 23c:** 90°, R = 2, T = 2,
K = 0.33 → BA = (π/2)·(2 + 0.66) = **4.178 mm**. Flat length = straight legs (to the tangent points) + BA.
Calibrate K for your press brake and material with a test bend.

### 23.3 Achievable tolerance and roughness per process (typical, economical)
| Process | IT grade | Ra µm |
|---|---|---|
| Sand casting | IT14–16 | 12.5–25 |
| Die casting | IT11–13 | 1.6–3.2 |
| Forging | IT14–16 | 6.3–12.5 |
| Turning rough / finish | IT11–12 / IT7–9 | 6.3–12.5 / 0.8–3.2 |
| Milling | IT8–11 | 1.6–6.3 |
| Drilling | IT10–12 | 3.2–12.5 |
| Reaming / fine boring | IT6–8 | 0.4–1.6 |
| Cylindrical grinding | IT5–6 | 0.1–0.8 |
| Honing | IT4–6 | 0.05–0.4 |
| Lapping | IT3–5 | 0.025–0.2 |
| LPBF (as built) | ± 0.1–0.2 mm | 6–15 |
**Cost of tolerance:** cost rises steeply when you leave the economical range of a process – each IT grade tighter
adds roughly 20–50 % to the operation cost, and below the process limit you need a new process (e.g. grinding after
turning). Model used in 24.6: c(t) = a + b/t.

### 23.4 Machining time formulas
| Operation | Spindle speed | Time |
|---|---|---|
| Turning (length L) | n = 1000·v_c/(π·D) | t = i·L/(f·n) (i passes, f mm/rev) |
| Drilling (depth L) | n = 1000·v_c/(π·D) | t = (L + 0.3·D)/(f·n) (tip approach) |
| Milling | n = 1000·v_c/(π·D); v_f = f_z·z·n | t = (L + D)/v_f (approach + overrun) |
| Grinding (plunge) | – | t = allowance / infeed rate + spark-out |
**Example 23a – turning a Ø30 journal, L = 40 mm:** v_c = 180 m/min, f = 0.2 mm → n = **1910 rpm**, t = 0.1047 min
= **6.3 s** per pass. **Example 23b – drilling Ø8.5 (M10 tap drill), 20 mm deep:** v_c = 80, f = 0.12 → n = 2996 rpm,
t = **3.8 s**. Add non-cutting time (tool change 2–6 s, rapid moves, probing) – often 30–50 % of cycle on small parts.

### 23.5 Should-cost model
  **Cost per part = material + Σ (cycle time × machine-hour rate) + Σ (set-up time × rate)/lot + tooling/lot + overhead**

Material = blank mass × price/kg × (1 + scrap rate). Machine-hour rate = (depreciation + interest + space + energy
+ maintenance + operator) / productive hours (guide 04 costing).

**Example 23d – drive shaft from C45 bar Ø36 × 180 mm, lot 200 (example rates):**
blank mass = π/4·36²·180·7.85·10⁻⁶ = **1.438 kg**; material at 1.6 USD/kg + 3 % scrap = **2.37 USD**.
| Operation | Cycle min | Set-up min | Rate USD/h | Run USD | Set-up/part USD |
|---|---|---|---|---|---|
| Saw | 0.5 | 5 | 40 | 0.33 | 0.017 |
| CNC turning | 4.5 | 30 | 60 | 4.50 | 0.150 |
| Keyway milling | 2.0 | 20 | 55 | 1.83 | 0.092 |
| Grinding seats | 3.0 | 40 | 70 | 3.50 | 0.233 |
| **Sum** | | | | **10.17** | **0.49** |
Total **13.03 USD** (+ overhead, inspection, heat treatment, packing). Lessons: machining is 78 % of the cost →
reduce operations (does the keyway need a separate machine? can grinding be replaced by fine turning IT7?); material
is minor. Use this model to compare design variants **before** asking for quotes.

### 23.6 DFA – Boothroyd–Dewhurst method
**Step 1 – minimum part count.** For each part ask the three questions; if all answers are "no", the part is a
candidate for elimination or combination:
1. Does the part **move relative** to the others (in operation)?
2. Must it be a **different material** (or isolated) from the others?
3. Must it be **separate for assembly or service** (otherwise assembly or disassembly is impossible)?
**Step 2 – time.** Each part gets a handling time (size, symmetry α + β, thickness, tangling, tools) and an insertion
time (alignment, resistance, access, fastening: a screw takes 6–12 s, a snap 1.5–3 s) from Boothroyd tables.
**Step 3 – efficiency** E_ma = 3·N_min / t_total (3 s = ideal time for an easy part).

**Example 23e – intake filter assembly (example times):** housing 4 s, element 5 s, gasket 6 s, cover 4 s, 4 screws
9 s each → 55 s; N_min = 3 (housing, element, cover) → E_ma = 9/55 = **16.4 %**. Redesign: snap-fit cover with moulded
seal → housing 4, element 5, cover 5 s = 14 s → E_ma = **64.3 %**, 4× faster, 5 fewer parts in stock.
DFA rules: fewer parts, no separate fasteners where possible, self-locating (chamfers, lead-ins), symmetric or
clearly asymmetric parts, top-down assembly (Z-axis), no tangling, standard fasteners if needed.

### 23.7 Poka-yoke (mistake-proofing)
Design so that wrong assembly is **impossible** (asymmetric pins, different bolt sizes for different covers, keyed
connectors, stepped valve plate so it fits only one way) or **immediately detected** (sensor checks, colour codes).
Prefer prevention to detection.

### 23.8 Checklist, mistakes, references
Checklist – [ ] process chosen and its rules applied · [ ] all tolerances inside the economical range · [ ] set-ups
counted · [ ] should-cost calculated for variants · [ ] DFA efficiency ≥ 30–50 % for assemblies · [ ] poka-yoke for
every part that can be fitted wrong · [ ] supplier (foundry, forge, machine shop) reviewed the design.
Mistakes – sharp internal corners in pockets; walls too thin for casting; tolerances tighter than function needs;
separate screws for everything; designing without knowing the machine (guide 49).
**References:** ISO 8062-3, EN 10243-1, ISO 2768, EN ISO 13920, EN ISO 5817, DIN 76, DIN 509, VDI 2235 (cost); Boothroyd/
Dewhurst/Knight *Product Design for Manufacture and Assembly*; Swift/Booker *Manufacturing Process Selection Handbook*;
Bralla *Design for Manufacturability Handbook*.

---

## 24 Tolerancing, GD&T and metrology

### 24.1 ISO 286 system – how tolerance values are built
**Tolerance unit** for nominal sizes up to 500 mm: **i = 0.45·∛D + 0.001·D** (i in µm, D in mm), where D is the
**geometric mean of the size range** (D = √(D_min·D_max)).
**IT grade** = multiplier × i: IT5 = 7i, IT6 = 10i, IT7 = 16i, IT8 = 25i, IT9 = 40i, IT10 = 64i, IT11 = 100i,
IT12 = 160i (each grade ≈ R5 step, ×1.6). Values in ISO 286-1 tables are rounded.

**Example 24a – range 18–30 mm:** D = √(18·30) = 23.24 mm, i = 0.45·2.854 + 0.023 = **1.307 µm**,
IT6 = 13.07 → table **13 µm**; IT7 = 20.92 → table **21 µm**.

**Fundamental deviation** (letter) places the zone relative to the nominal size: holes A…ZC (H: lower deviation 0),
shafts a…zc (h: upper deviation 0). Values per size range in **ISO 286-2 tables**. For 18–30 mm (from ISO 286-2):

| Zone | Upper µm | Lower µm |
|---|---|---|
| H7 (hole) | +21 | 0 |
| g6 (shaft) | −7 | −20 |
| k6 (shaft) | +15 | +2 |
| p6 (shaft) | +35 | +22 |

### 24.2 Fit calculation
Max clearance = ES_hole − ei_shaft; min clearance = EI_hole − es_shaft (negative = interference).
**Example 24b at Ø30:**
| Fit | Max clearance | Min clearance | Type | Use |
|---|---|---|---|---|
| H7/g6 | +41 µm | +7 µm | Clearance | Sliding / locating fit, gear on pin that must slide |
| H7/k6 | +19 µm | −15 µm | Transition | Pulley / coupling hub with key, bearing inner ring at moderate load |
| H7/p6 | −1 µm | −35 µm | Interference (1–35 µm) | Press fit transmitting torque without key, bushings |

**Interference pressure (Lamé, thick cylinders) – link to item M3 / DIN 7190.** Solid steel shaft in steel hub,
diametral interference δ, joint diameter d, hub outer Do:  **p = (E·δ/(2·d))·(1 − (d/Do)²)**.
**Example 24c:** δ = 0.035 mm (max of H7/p6), d = 30, Do = 60 → p = **91.9 MPa** (before smoothing of the roughness
peaks – DIN 7190 reduces the effective interference by the smoothing value; see item M3). Transmissible torque
T = μ·p·π·d²·L/2 – also in M3.

### 24.3 Geometric tolerances (ISO 1101) and datums (ISO 5459)
| Group | Characteristic | Datum needed? | Typical use |
|---|---|---|---|
| Form | Straightness, flatness, roundness, cylindricity | No | Sealing faces (flatness 0.02–0.05), bores (cylindricity 5–10 µm) |
| Orientation | Parallelism, perpendicularity, angularity | Yes | Cylinder bore ⊥ crank axis |
| Location | Position, concentricity / coaxiality, symmetry | Yes | Bolt holes, bearing bores coaxial |
| Run-out | Circular run-out, total run-out | Yes | Shaft seats relative to bearing axis |
| Profile | Line profile, surface profile | Optional | Cam contour, free-form surfaces |

**Datums:** primary (3 points – plane), secondary (2 – line), tertiary (1 – point) = 3-2-1 rule; choose datums that
are **functional** (the faces / axes that locate the part in the assembly) and **manufacturable** (clampable in the
first set-up) and **measurable** (CMM can probe them). Common datum A-B = axis through two bearing seats.

**ISO 8015 independence principle** (default in ISO GPS): size and form are independent – a Ø30 h6 shaft may be
banana-shaped within its size tolerance unless form is specified. Use the **envelope requirement Ⓔ** (ISO 14405-1)
where a fit must assemble (bearing seats, sliding fits). (ASME Y14.5 uses Rule #1 envelope by default – watch out
with drawings from US suppliers.)

**Maximum material requirement Ⓜ and bonus tolerance:** position tolerance applies at MMC; as the feature departs
from MMC the tolerance grows. **Example 24d:** hole Ø10 +0.1/0, position Ø0.2 Ⓜ: at Ø10.0 (MMC) Ø0.2; at Ø10.1 (LMC)
Ø0.2 + 0.1 = **Ø0.3**. **Virtual condition** (worst mating boundary) of the hole = MMC − position = 10.0 − 0.2 =
**Ø9.8** → a fixed Ø9.8 pin gauge checks it (functional gauge). Use Ⓜ for clearance holes of bolts (cheap parts,
function = assembly); never for press fits or sealing features.

### 24.4 Tolerance stack-up – worst case, RSS, Monte Carlo
Gap G = Σ s_i·X_i (s_i = +1 or −1 along the loop).
- **Worst case:** T_G = Σ T_i – 100 % assembly, expensive tolerances.
- **RSS (statistical):** T_G = √(Σ T_i²) – assumes normal, centred, independent, Cp ≈ 1 (σ_i = T_i/3).
- **Monte Carlo:** draw each X_i from its real distribution (normal, uniform, skewed, shifted mean), compute G,
  count out-of-spec – the most realistic; easy in MATLAB / Python.

**Example 24e – axial gap G = A − B − C − D, spec 0.1 … 0.5 mm:**
A = 100 ± 0.10, B = 40 ± 0.05, C = 30 ± 0.05, D = 29.7 ± 0.05 → nominal G = 0.30.
| Method | Gap range | Out of spec |
|---|---|---|
| Worst case | 0.30 ± **0.250** → 0.05 … 0.55 | Possible (exceeds spec) |
| RSS | 0.30 ± **0.132** → 0.168 … 0.432 | ≈ 0 |
| Monte Carlo, normal σ = T/3 (200 000 runs) | σ_G = 0.0441 | **≈ 0.001 %** (theory ≈ 6 ppm) |
| Monte Carlo, uniform ± T (bad process, flat distribution) | σ_G = 0.0764 | **0.27 %** |
Lesson: RSS is only valid if the processes are capable and centred; with flat (uniform) distributions out-of-spec
rises to 0.27 % (2700 ppm). (A normal approximation with σ_G = 0.0764 would predict 0.88 %; the real sum of four
uniform variables has lighter tails – Monte Carlo shows the truth.)

```matlab
N = 2e5; A = 100 + 0.10/3*randn(N,1); B = 40 + 0.05/3*randn(N,1);
C = 30 + 0.05/3*randn(N,1); D = 29.7 + 0.05/3*randn(N,1);
G = A - B - C - D; outPct = 100*mean(G < 0.1 | G > 0.5)
```

### 24.5 Process capability link
C_p = (USL − LSL)/(6σ), C_pk = min(USL − μ, μ − LSL)/(3σ). Required typically C_pk ≥ 1.33 (≈ 63 ppm), critical
characteristics ≥ 1.67. **Example 24g:** H7 bore 0 … 21 µm (deviation from nominal), σ = 3 µm, mean 12.5 µm →
C_p = **1.17**, C_pk = **0.94** → **2319 ppm** out of spec. Centre the process (mean 10.5) → C_pk = C_p = 1.17;
to reach 1.33 you need σ ≤ 2.6 µm (better machine / fine boring / honing). This connects the drawing tolerance to the
machine choice (guide 49) and to SPC in production.

### 24.6 Tolerance allocation (cost-optimal)
Cost model per dimension c_i = a_i + b_i/t_i. Minimise Σ c_i:
- with worst case Σ t_i = T → Lagrange gives **t_i ∝ √b_i**;
- with RSS √(Σ t_i²) = T → **t_i ∝ b_i^(1/3)**.
**Example 24f:** three dimensions, b = 1, 4, 9 (cost weights), total T = 0.3 mm (WC):
optimal t = **0.05 / 0.10 / 0.15 mm**, variable cost Σb/t = **120** vs **140** with equal tolerances 0.1 each
(−14 %). With RSS the same total allows t = 0.107 / 0.170 / 0.223 mm, cost 73 – hard-to-make dimensions get the larger
tolerance.

### 24.7 Measurement uncertainty and decision rules (ISO 14253-1)
A measured value has uncertainty U (expanded, k = 2). **ISO 14253-1 default rule:** conformance is proved only inside
the tolerance **reduced by U at each side** (guard band) – the supplier carries the measurement risk; the customer
rejects only outside the tolerance **enlarged** by U.
Example: H7 bore Ø30 (0 … +21 µm), U = 2 µm → supplier accepts 2 … 19 µm (17 µm usable). Rules of thumb: U ≤ 10–20 %
of tolerance; instrument resolution ≤ T/10 (**10:1 rule**: 2 µm for this bore → use bore gauge / air gauge, not a
caliper); gauge capability study (MSA, %GR&R ≤ 10 % good, 10–30 % conditional – guide 33). CMM: specify datum
alignment and evaluation (least squares vs minimum zone) on the inspection plan; measure at 20 °C (ISO 1).

### 24.8 Surface texture (ISO 21920, replaces ISO 4287 / 1302)
| Function | Typical spec (example) |
|---|---|
| Bearing seat on shaft | Ra 0.4–0.8 µm |
| Bearing seat in housing | Ra 0.8–1.6 µm |
| Radial shaft seal running surface | Ra 0.2–0.8, Rz 1–5, **no machining lead** (plunge ground), 45–60 HRC |
| Honed cylinder bore | Plateau: Rk 0.2–0.6, Rpk ≤ 0.2, Rvk 0.5–1.5 (ISO 13565-2 / ISO 21920-2) |
| Gasket / O-ring static face | Ra 0.8–3.2 (O-ring: ISO 3601-2 recommendations) |
| Sliding guide | Ra 0.2–0.4 |
| Press-fit surfaces | Rz 4–10 (affects smoothing, M3) |
| Machined non-functional | Ra 3.2–6.3 |
Rmr (material ratio) controls bearing area for wear surfaces. State the filter / evaluation length if not default.

### 24.9 Checklist, mistakes, references
Checklist – [ ] every functional size has a fit chosen by function · [ ] envelope Ⓔ on fits · [ ] datums functional +
clampable + measurable · [ ] Ⓜ only where function = assembly · [ ] stack-ups done (WC for safety, MC for production) ·
[ ] tolerance vs process capability (C_pk ≥ 1.33) · [ ] measurement method and U for each critical characteristic ·
[ ] surface specs by function.
Mistakes – general tolerance ISO 2768-f everywhere (expensive); RSS without capable processes; forgetting ISO 8015
independence (form not controlled); datums that cannot be clamped; inspecting a 10 µm tolerance with a caliper;
ignoring temperature (Δ = 11.5 µm/m/K for steel: a Ø100 part measured at 30 °C is 11.5 µm bigger).
**References:** ISO 286-1/-2, ISO 1101, ISO 5459, ISO 8015, ISO 14405-1, ISO 2768-1/-2, ISO 14253-1, ISO 21920-1/-2/-3,
ISO 13565-2, ISO 1, DIN 7190-1, ASME Y14.5-2018; Henzold *Geometrical Dimensioning and Tolerancing for Design,
Manufacturing and Inspection*; Fischer *Mechanical Tolerance Stackup and Analysis*; Krulikowski *Fundamentals of GD&T*.


---

## 25 Strength and failure theory

> Program: `tools/dm_strength.py` (examples S1–S8). All inputs are **example values**.

### 25.1 Stress at a point – the stress tensor
At any point in a loaded part, the state of stress is a symmetric 3 × 3 tensor (MPa):

```
        | σx   τxy  τxz |
  [σ] = | τxy  σy   τyz |
        | τxz  τyz  σz  |
```
Six numbers fully describe it. FEA gives you exactly these six components at each node (Ansys: SX…SXZ; Abaqus: S11…S23).
Everything else (von Mises, principal, Tresca) is calculated from them.

**Principal stresses** σ1 ≥ σ2 ≥ σ3 are the normal stresses on the three planes where shear is zero.
They are the roots of the characteristic (cubic) equation:

  σ³ − I1·σ² + I2·σ − I3 = 0

with the **invariants** (same value in every coordinate system):
- I1 = σx + σy + σz
- I2 = σxσy + σyσz + σzσx − τxy² − τyz² − τxz²
- I3 = det[σ]

Closed solution (trigonometric): with J2 = I1²/3 − I2, J3 = 2I1³/27 − I1·I2/3 + I3, r = √(J2/3),
θ = ⅓·arccos(J3 / (2r³)): σ_k = I1/3 + 2r·cos(θ − 2πk/3), k = 0, 1, 2.

**Mohr circle (plane stress):** centre C = (σx + σy)/2, radius R = √(((σx − σy)/2)² + τxy²);
σ1,2 = C ± R, τmax(in plane) = R, principal angle tan 2θp = 2τxy/(σx − σy).

**Example S1 – 3D stress state at a crank-web fillet (example values).**
σx = 120, σy = −40, σz = 0, τxy = 50, τyz = 0, τxz = 20 MPa.
I1 = 80, I2 = −7700, I3 = 16 000 → σ1 = **137.04**, σ2 = **−2.13**, σ3 = **−54.91** MPa.
Check: σ1 + σ2 + σ3 = 80 = I1. von Mises = **171.76 MPa** (same from components and from principals), Tresca
σ1 − σ3 = **191.95 MPa**.

### 25.2 Failure hypotheses – which one when

| Hypothesis | Equivalent stress | Physical idea | Use for |
|---|---|---|---|
| Normal stress (Rankine) | σ_eq = σ1 | Separation fracture on the plane of largest tension | Brittle materials in tension (grey cast iron, ceramics, hardened case) |
| Tresca (max shear) | σ_eq = σ1 − σ3 | Yield starts when max shear reaches τ_y = R_e/2 | Ductile steel, conservative (≤ 15 % above von Mises) |
| von Mises (distortion energy) | σ_eq = √(½[(σ1−σ2)² + (σ2−σ3)² + (σ3−σ1)²]) | Yield when distortion (shape-change) energy reaches the uniaxial value | Ductile metals – standard in FEA and FKM |
| Mohr–Coulomb (brittle) | 1/n = σ1/S_t − σ3/S_c | Different strength in tension S_t and compression S_c | Grey cast iron (crankcase), concrete |

**Derivation of von Mises (short).** The strain energy density u = (1/2E)[σ1² + σ2² + σ3² − 2ν(σ1σ2 + σ2σ3 + σ3σ1)]
splits into a volume-change part u_v = (1−2ν)/(6E)·(σ1+σ2+σ3)² and a distortion part
u_d = (1+ν)/(6E)·[(σ1−σ2)² + (σ2−σ3)² + (σ3−σ1)²]. Metals yield by shear slip, which is driven by u_d only
(hydrostatic pressure does not cause yield – confirmed by Bridgman tests). Setting u_d equal to the value in a tension
test at yield (σ1 = R_e, σ2 = σ3 = 0 → u_d = (1+ν)/(3E)·R_e²) gives σ_vM = R_e.
For a shaft (σ from bending, τ from torsion): **σ_vM = √(σ² + 3τ²)**, Tresca: **√(σ² + 4τ²)**.

**Example S2 – combined bending and torsion, shaft d = 30 mm, M = 150 N·m, T = 200 N·m, R_e = 430 MPa.**
σ_b = 32M/(πd³) = **56.59 MPa**, τ = 16T/(πd³) = **37.73 MPa** → σ_vM = **86.44 MPa** (n = 4.97), Tresca **94.31 MPa**
(n = 4.56). Static strength is easy here – fatigue (chapter 26) decides.

**Example S3 – grey cast iron crankcase rib, Mohr–Coulomb.** EN-GJL-250: S_t = 250 MPa, S_c ≈ 840 MPa (≈ 3.4 × S_t –
check the foundry certificate). σ1 = 60, σ3 = −120 MPa → 1/n = 60/250 − (−120)/840 = 0.383 → **n = 2.61**.
Von Mises would give a wrong answer for cast iron, because grey iron is much stronger in compression.

### 25.3 Notches – K_t, q, K_f and the stress gradient
**Stress concentration factor** K_t = σ_max / σ_nom (elastic, geometry only). Source: Peterson's charts, FEA, FKM
tables. Typical shaft shoulder D/d = 1.2, r/d = 0.05: K_t ≈ 1.9 (bending).

In fatigue a notch hurts less than K_t says, because a small volume is highly stressed and a crack must grow through a
falling stress field. This is the **notch sensitivity** q (0…1):

  K_f = 1 + q·(K_t − 1)

Peterson (steels): q = 1/(1 + a/r), a = 0.0254·(2070/R_m)^1.8 mm (R_m in MPa).
Neuber form: q = 1/(1 + √(ρ*/r)) with a material length ρ*. Higher strength → smaller a → q closer to 1
(strong steels are **more notch sensitive**).

**Example S4.** Shoulder fillet r = 1.6 mm, K_t = 1.9.
C45 (R_m = 650): a = 0.2043 mm, q = 0.887, **K_f = 1.80**. 42CrMo4 QT (R_m = 1000): a = 0.0941, q = 0.944, **K_f = 1.85**.
Lesson: the higher-strength steel gains less than its R_m suggests at a sharp notch → generous radii are essential.

**Stress gradient approach (FKM).** The relative stress gradient G = (1/σ_max)·(dσ/dx) at the notch root
(≈ 2/r for a fillet in bending, mm⁻¹) gives a **support factor** n_σ ≥ 1 (chapter 26.8). FEA delivers G directly from the
stress along a path normal to the surface.

### 25.4 Stability – buckling of rods and columns
Long slender members in compression fail by **instability** at a stress far below R_e.

Euler (elastic): F_cr = π²·E·I / (K·L)², σ_cr = π²E/λ², slenderness λ = K·L/r_g, r_g = √(I/A) (= d/4 for a round bar).
Effective length factor K: pinned–pinned 1.0, fixed–free 2.0, fixed–pinned 0.7, fixed–fixed 0.5.
Transition slenderness λ_t = π·√(2E/R_e). For λ < λ_t use **Johnson's parabola**:
σ_cr = R_e − (R_e·λ/(2π))²/E.

Procedure: (1) choose end conditions honestly (a cylinder with rod eye and clevis is pinned–pinned only if both pins
are free; a flange-mounted cylinder with free rod end is fixed–free K = 2); (2) compute λ, λ_t; (3) σ_cr, F_cr;
(4) safety n = F_cr / F ≥ 3.5 (common hydraulic practice; check ISO/TR 13327 and the cylinder maker's chart).

**Example S5 – APC hydraulic cylinder rod, Ø25 mm, R_e = 500 MPa, bore Ø63 at 10 MPa → F = 31 172 N.**

| Case | K·L | λ | λ_t | Method | σ_cr MPa | F_cr kN | n |
|---|---|---|---|---|---|---|---|
| a – pinned–pinned, L = 600 | 600 | 96.0 | 91.1 | Euler | 224.9 | 110.4 | **3.54** (OK) |
| b – pinned–pinned, L = 400 | 400 | 64.0 | 91.1 | Johnson | 376.5 | 184.8 | **5.93** |
| c – fixed–free, L = 600 | 1200 | 192.0 | 91.1 | Euler | 56.2 | 27.6 | **0.89 – buckles!** |
Same rod, same load – only the mounting changes the result by a factor 4. Plate and shell buckling (thin walls of
welded frames, air tanks under vacuum) follow σ_cr = k·π²E/(12(1−ν²))·(t/b)² – use EN 1993-1-5 / EN 13445.

### 25.5 Contact stress – Hertz theory
When two curved bodies touch, the contact area is small and the pressure very high. Hertz (1882) assumptions: elastic,
smooth, frictionless, contact size ≪ radii.

Combined modulus: 1/E* = (1 − ν1²)/E1 + (1 − ν2²)/E2. Combined radius: 1/R* = 1/R1 + 1/R2 (concave radius negative).

| Contact | Contact size | Max pressure | Max shear (subsurface) |
|---|---|---|---|
| Line (cylinders, length b) | half width a = √(4F·R*/(π·b·E*)) | p_max = 2F/(π·a·b) | τ_max ≈ 0.30·p_max at depth 0.786·a |
| Point (sphere on flat) | radius a = (3F·R*/(4E*))^⅓ | p_max = 3F/(2π·a²) | τ_max ≈ 0.31·p_max at depth 0.48·a |
| Approach (sphere) | δ = a²/R* | | |

The maximum shear lies **below** the surface → this is where pitting (rolling contact fatigue) starts. The case-hardening
depth must be clearly deeper than this depth (rule: effective case depth CHD ≥ 2–3 × z_τmax, with margin for grinding).

**Example S6a – cam follower roller (Ø25 mm, b = 12 mm) on cam radius 30 mm, F = 1500 N, steel/steel.**
E* = 115 385 MPa, R* = 8.824 mm → a = **0.110 mm**, p_max = **721 MPa**, τ_max = 216 MPa at **0.087 mm** depth.
Allowable for through-hardened 100Cr6 rollers / case-hardened cams is typically 1500–2000 MPa (line contact, depends on
cycles – check VDI 2143 / maker data) → OK.
**Example S6b – ball Ø10 on flat, F = 500 N:** a = **0.253 mm**, p_max = **3721 MPa**, δ = 12.8 µm, τ_max = 1154 MPa at
0.122 mm. Point contacts reach rolling-bearing level pressures quickly – only hardened bearing steel survives.

### 25.6 Thick-walled cylinders – Lamé
For internal pressure p, inner radius r_i, outer radius r_o (at the bore, the critical point):
- Hoop: σ_t = p·(r_o² + r_i²)/(r_o² − r_i²)
- Radial: σ_r = −p
- Axial (closed ends): σ_a = p·r_i²/(r_o² − r_i²)
Thin-wall estimate σ_t ≈ p·r_i/t is only valid for t < r_i/10.

**Example S7 – hydraulic cylinder tube Ø63 × Ø76, p = 16 MPa:** σ_t = **86.3**, σ_r = −16.0, σ_a = 35.1 MPa →
σ_vM = **88.6 MPa**; thin-wall estimate 77.5 MPa (−10 %, unconservative). With E355 tube (R_e ≈ 355 MPa) n ≈ 4.0.
Air tank (thin wall, D = 300, t = 3, p = 1.1 MPa): σ = pD/(2t) = **55 MPa** – but tanks are designed by code
(EN 286-1 simple vessels / EN 13445-3) with weld efficiency, corrosion allowance and fatigue rules.

### 25.7 Ductile vs brittle static design and plastic reserve

| Item | Ductile (steel, Al) | Brittle (grey iron, hardened case) |
|---|---|---|
| Reference strength | R_e / R_p0.2 | R_m |
| Hypothesis | von Mises | Normal stress or Mohr–Coulomb |
| Notch in static load | Usually ignored (local yielding redistributes) | Must be included (K_t) |
| Safety factor (typical) | 1.5 to yield | 2.5–4 to R_m |

**Plastic reserve.** A bending beam does not fail when the outer fibre yields; the full plastic moment is larger by the
**shape factor** K_p = M_pl/M_el: rectangle **1.50**, solid circle **16/(3π) = 1.698**. FKM uses this as the plastic
support number n_pl = min(√(E·ε_ertr/R_p), K_p) (chapter 26.8). Only use plastic reserve for **static** loads and
ductile materials (elongation A ≥ 6–10 %).

### 25.8 Manufacturing link
- **Material certificate EN 10204 3.1** for every highly loaded part: R_e, R_m, A, Z, impact energy, chemistry – your
  calculation uses these values, not catalogue ones.
- **Heat treatment** sets R_e/R_m (QT: 42CrMo4 +QT R_m 900–1100 MPa for d 16–40 mm, EN 10083-3); case hardening sets
  contact strength (CHD per ISO 2639/ISO 18203 measurement).
- **Fillet radius is a manufacturing feature:** specify r with tolerance (e.g. R2 +0.3/0) and check with radius gauge or
  profile projector; undercut by a worn tool tip raises K_t.
- **Cast iron:** check S_c/S_t and section-thickness effect (thick walls are weaker – EN 1561 separately cast bars vs
  wall thickness table).

### 25.9 Checklist and common mistakes
Checklist: [ ] correct hypothesis for the material · [ ] principal stresses checked for sign (tension at notch?) ·
[ ] K_t source documented · [ ] buckling checked for every slender compression member with honest end conditions ·
[ ] Hertz pressure vs material/hardening depth · [ ] Lamé for thick walls.
Mistakes: von Mises for grey iron; ignoring compression buckling of piston rods and long screws; reading K_t·σ_nom from FEA
and then multiplying by K_t again; thin-wall formula for a thick cylinder; case depth shallower than the Hertz shear depth.

**References:** Budynas/Nisbett, *Shigley's Mechanical Engineering Design*, 11th ed. (2020) ch. 3, 5, 6 · Pilkey/Pilkey,
*Peterson's Stress Concentration Factors*, 3rd ed. (2008) · Johnson, *Contact Mechanics* (1985) · Timoshenko/Gere,
*Theory of Elastic Stability* · FKM guideline, 7th ed. (2020) · EN 1993-1-5, EN 13445-3, EN 286-1, ISO/TR 13327.

---

## 26 Fatigue in depth

> Examples F1–F6 in `dm_strength.py`. Material constants are typical literature values – **use your certificate and
> test data for real designs.**

### 26.1 How fatigue happens
Cyclic stress below R_e causes local slip bands at the surface → micro-crack (initiation, often 80–90 % of life in
smooth parts) → crack growth (fracture mechanics) → final fracture (beach marks + fast fracture zone on the fracture
surface). Initiation is controlled by **surface condition, residual stress, notch and mean stress**; growth by
**ΔK and material toughness**.

### 26.2 S-N (Wöhler) curve
Basquin: **σ_a = σ_f′·(2N)^b**, b ≈ −0.05 … −0.12 (σ_f′ ≈ R_m + 345 MPa for steel as first estimate).
Component form (FKM, EC3): **N = N_D·(σ_D/σ_a)^k**, knee point N_D ≈ 10⁶ (FKM normal stress, steel), slope k = 5 for normal
stress and k = 8 for shear (FKM component curves; welded joints IIW k = 3).
Very high cycle (N > 10⁷): many steels have no true endurance limit – FKM continues with a slow slope (k_II = 15 for
steel; check FKM 7th ed.) or a 5–10 % drop per decade. Compressor parts see 10⁹ cycles (chapter 5.1 LC6) → **always use a
curve that continues beyond the knee**.

**Example F1.** 42CrMo4 QT, R_m = 1000, σ_f′ = 1345, b = −0.085 → σ_a at 10⁶ cycles = **391.9 MPa** (smooth polished
specimen). Component at 1.2 × σ_D with k = 5: N = 10⁶ · (1/1.2)⁵ = **401 878 cycles** – a 20 % overload costs 60 % of
life. That is why load knowledge (S0) matters so much.

### 26.3 Mean stress – Haigh diagram
Plot allowable amplitude σ_a vs mean σ_m. Models:

| Model | Equation (safety n) | Character |
|---|---|---|
| Goodman | σ_a/S_e + σ_m/R_m = 1/n | Straight line to R_m – standard, slightly conservative for steel |
| Gerber | n·σ_a/S_e + (n·σ_m/R_m)² = 1 | Parabola – fits ductile test data best (mean value) |
| Soderberg | σ_a/S_e + σ_m/R_e = 1/n | Line to R_e – very conservative |
| SWT | σ_a,eq = √(σ_max·σ_a) | Good for strain-life and many steels; no effect of negative mean |
| FKM | σ_AK = σ_WK/(1 + M_σ·σ_m/σ_a) (region II, −∞ < R < 0 … 0.5) | M_σ = a_M·10⁻³·R_m + b_M (steel a_M = 0.35, b_M = −0.1) |

**Example F2** – S_e = 300, R_m = 1000, R_e = 850, σ_a = 150, σ_m = 200 MPa:
Goodman **n = 1.43**, Gerber **1.75**, Soderberg **1.36**, SWT σ_a,eq = 229.1 → **n = 1.31**,
FKM M_σ = **0.25** → σ_a,eq = 150 + 0.25·200 = 200 → **n = 1.50**.
Spread 1.31 … 1.75: the model is a design decision – write it into the report. Compressive mean stress (from shot
peening, rolling) **helps**: this is why residual compressive stress raises fatigue strength.

### 26.4 Endurance limit of the component – the influence factors
S_e(component) = S_e′ × surface × size × load type × temperature × reliability × technology / K_f.
Chapter 6.3 gave the Marin factors. Technology factors that you control in manufacturing:

| Treatment | Typical gain in fatigue strength at a notch | Note |
|---|---|---|
| Shot peening (Almen 0.2–0.4 mmA, coverage ≥ 100 %) | +20 … +50 % | Specify per SAE J2441/AMS 2430; check Almen strip each shift |
| Fillet rolling (crankshafts) | +50 … +100 % | Standard on forged/cast crankshafts |
| Induction / case hardening of fillet | +50 … +100 % | Hardening must run through the fillet, no soft zone at the end |
| Nitriding | +30 … +80 % | Small distortion, good for complex parts |
| Grinding burn, decarburisation | −20 … −50 % | Nital etch test (ISO 14104), hardness check |
| Chrome / nickel plating | −10 … −40 % | Tensile residual stress, hydrogen – bake after plating |
FKM uses a surface treatment factor K_V (1.1–2.5, table by treatment and notch – check FKM 7th ed. table).

### 26.5 Variable amplitude – rainflow counting and Miner
Real loads vary. Procedure: (1) measured or simulated load–time history → (2) reduce to turning points →
(3) **rainflow counting** (ASTM E1049-85) gives cycles with range and mean → (4) mean-stress correction →
(5) damage per cycle from S-N curve → (6) **Palmgren–Miner** D = Σ n_i/N_i; failure at D = D_crit.

Miner variants for cycles below the knee σ_D:
- **Original:** no damage below σ_D (unconservative for spectra).
- **Elementary:** S-N line continues with slope k (conservative).
- **Modified (Haibach):** below σ_D slope k′ = 2k − 1 (FKM default for spectra).
Allowable sum D_crit: FKM recommends 0.3 (steel) … 1.0 for constant amplitude-like spectra – check FKM 7th ed.

**Example F3** – block history (MPa) [0, 100, −50, 80, −80, 120, −20, 60, −100, 0], S-N: σ_D = 60 MPa at 10⁶, k = 5.
Rainflow result: full cycles range 130 (mean 15) and 80 (mean 20); half cycles ranges 100, 180, 200, 220, 100.
Damage per block (amplitude = range/2, no mean correction for simplicity): elementary **2.261·10⁻⁵** → life
**≈ 44 230 blocks**; Haibach 2.230·10⁻⁵ → 44 850 blocks; original 2.208·10⁻⁵ → 45 300 blocks.
(Here most cycles are above the knee, so the three rules agree; for long spectra with many small cycles they differ by
factors.) Tools: nCode DesignLife, fe-safe, MATLAB `rainflow` (Signal Processing Toolbox).

```matlab
% MATLAB: rainflow + Miner (elementary), example values
x  = [0 100 -50 80 -80 120 -20 60 -100 0];
c  = rainflow(x);                 % columns: count, range, mean, start, end
sa = c(:,2)/2;  n = c(:,1);
sD = 60; ND = 1e6; k = 5;
D  = sum(n ./ (ND*(sD./sa).^k))   % expect 2.261e-5 per block
```

### 26.6 Strain-life (low-cycle fatigue) and Neuber
When the notch root yields (high loads, start-stop, thermal cycles), use strains:

  ε_a = (σ_f′/E)·(2N)^b + ε_f′·(2N)^c   (Coffin–Manson–Basquin; c ≈ −0.5 … −0.7)

Cyclic stress–strain curve (Ramberg–Osgood): ε_a = σ_a/E + (σ_a/K′)^(1/n′).
**Neuber's rule** links the elastic FEA/K_t stress to the real elastic-plastic notch state: σ·ε = (K_t·S)²/E.

**Example F4** – notch K_t = 2.5, nominal amplitude S = 200 MPa, steel: E = 206 000, K′ = 1200, n′ = 0.15,
σ_f′ = 1200, b = −0.09, ε_f′ = 0.6, c = −0.6.
Elastic notch stress 500 MPa → Neuber + Ramberg–Osgood: σ = **417.6 MPa**, ε_a = **0.00291** → Coffin–Manson:
2N = 66 962 → **N ≈ 33 500 cycles**. Elastic-only thinking would have overestimated the local stress (500) but cannot give
the strain – for LCF always use ε-N (Abaqus/Ansys + fe-safe/nCode "strain-life" with Neuber or elastic-plastic FEA).

### 26.7 Fracture mechanics – when a crack or defect is present
Stress intensity K = Y·σ·√(π·a) (MPa√m, a in m). Unstable fracture when K_max ≥ K_IC (fracture toughness).
Critical crack length a_c = (1/π)·(K_IC/(Y·σ_max))². Growth (Paris): **da/dN = C·(ΔK)^m**.
Integrated life for constant Y and m ≠ 2: N = (a_c^(1−m/2) − a_0^(1−m/2)) / (C·(Y·Δσ·√π)^m·(1 − m/2)).
Barsom constants (m/cycle, MPa√m): ferrite–pearlite steel C = 6.9·10⁻¹², m = 3.0; martensitic 1.35·10⁻¹⁰, m = 2.25.

**Example F5** – surface defect a₀ = 0.5 mm in a wide plate-like section, Δσ = 150 MPa (R = 0), Y = 1.12,
K_IC = 60 MPa√m: a_c = **40.6 mm**, life **≈ 436 000 cycles**. At 1450 rpm that is only **5 hours**. Use: (1) set
NDT acceptance limits (the largest defect that cannot grow to failure in the inspection interval); (2) castings – a
porosity of 0.5 mm at a highly stressed surface is a crack starter. For real shafts Y depends on geometry (handbooks:
Murakami, BS 7910 / API 579 solutions).

### 26.8 Welded joints – FAT classes (IIW)
Welds are designed with **FAT class** = stress range Δσ (MPa) that gives 2·10⁶ cycles at 97.7 % survival, slope m = 3
(knee at 10⁷, then m = 22 in current IIW). Examples: transverse butt weld ground flush FAT 112, as-welded butt FAT 90,
fillet-welded cover plate end FAT 50 (check IIW document XIII-2460-13 table). Use nominal, hot-spot (0.4t/1.0t
extrapolation) or effective notch (r_ref = 1 mm, FAT 225) method. Weld toe improvement (grinding, HFMI) raises the class.

### 26.9 FKM guideline – step-by-step procedure (local stress approach)
FKM "Analytical strength assessment of components" (7th ed., 2020) is the reference for machine parts made of steel,
cast iron and aluminium. Structure:

| Step | Static assessment | Fatigue assessment |
|---|---|---|
| 1 | Stresses (nominal or local from FEA) for max load | Stress amplitude σ_a and mean σ_m per load case / spectrum |
| 2 | Material: R_m, R_p from standard min values × technological size factor K_d (+ anisotropy K_A) | Fatigue strength of material σ_W,zd = f_W,σ·R_m (wrought steel f_W,σ = 0.40) |
| 3 | Plastic support n_pl = min(√(E·ε_ertr/R_p), K_p) (ε_ertr ≈ 5 % ductile steel) | Design factor K_WK = (1/n_σ)·[1 + (1/K̃_f)·(1/K_R − 1)]·1/(K_V·K_S·K_NL,E) |
| 4 | Component strength σ_SK = R_p·n_pl | Component fatigue limit σ_WK = σ_W,zd / K_WK |
| 5 | | Mean stress factor K_AK (M_σ), variable amplitude factor K_BK (spectrum, Miner) → σ_BK = K_BK·K_AK·σ_WK |
| 6 | Safety factor j (consequence of failure, ductility, inspection) | Safety factor j_D (consequence, inspection) |
| 7 | Utilisation a_SK = σ·j / σ_SK ≤ 1 | Utilisation a_BK = σ_a·j_D / σ_BK ≤ 1 |
| 8 | Combined stresses: a_SK,eq by von Mises / normal stress hypothesis per ductility | Combined amplitudes: FKM combination formulas |

Factors in step 3 (local approach):
- Support number n_σ from relative stress gradient G (mm⁻¹): G ≤ 0.1: n = 1 + G·10^−(a_G − 0.5 + R_m/b_G);
  0.1 < G ≤ 1: n = 1 + √G·10^−(a_G + R_m/b_G); G > 1: n = 1 + ⁴√G·10^−(a_G + R_m/b_G). Steel: a_G = 0.5, b_G = 2700.
- Roughness factor K_R = 1 − a_R·lg(R_z)·lg(2R_m/R_m,N,min), steel a_R = 0.22, R_m,N,min = 400 MPa.
- K̃_f = 2.0 (constant in the local design factor, steel), K_V surface treatment, K_S coating, K_NL,E grey iron.
- Safety factors (steel, ductile, typical): j_D = 1.5 for high consequence and no regular inspection, lower (≈ 1.2–1.35)
  for moderate consequence or regular inspection; static j ≈ 1.5 vs R_p and 2.0 vs R_m. **Check FKM 7th ed. tables
  for exact values before use in a report.**

**Example F6 – compressor crankshaft pin fillet, 42CrMo4 +QT (example values).**
Inputs: R_m = 1000 MPa, R_p = 750 MPa (EN 10083-3 for d 16–40 mm), local FEA stress at fillet (elastic, includes K_t):
σ_a = 180 MPa, σ_m = 90 MPa, σ_max (overload LC2) = 270 MPa; fillet r = 2 mm → G ≈ 2/r = **1.0 mm⁻¹**; turned fillet
R_z = 10 µm; constant amplitude, N ≫ 10⁶ → K_BK = 1.

| Quantity | Formula | Value |
|---|---|---|
| σ_W,zd | 0.40·1000 | **400 MPa** |
| n_σ | 1 + √1·10^−(0.5 + 1000/2700) | **1.135** |
| K_R | 1 − 0.22·lg10·lg(2000/400) | **0.846** |
| K_WK (K_V = 1) | (1/1.135)·[1 + 0.5·(1/0.846 − 1)] | **0.961** |
| σ_WK | 400 / 0.961 | **416.1 MPa** |
| M_σ | 0.35·10⁻³·1000 − 0.1 | **0.25** |
| K_AK | 1/(1 + 0.25·90/180) | **0.889** |
| σ_AK = σ_BK | 0.889·416.1 | **369.9 MPa** |
| a_BK | 180·1.5 / 369.9 | **0.73 ≤ 1 → OK** |
| n_pl | min(√(206 000·0.05/750) = 3.71, K_p = 1.7) | **1.7** |
| σ_SK | 750·1.7 | **1275 MPa** |
| a_SK | 270·1.5 / 1275 | **0.32 ≤ 1 → OK** |
**With fillet rolling** (K_V = 1.3, example): K_WK = 0.739, σ_BK = 480.8 MPa, a_BK = **0.56** → 23 % more margin, or a
smaller pin, or permission for a lower grade steel. This is how a manufacturing process enters the strength proof.

### 26.10 Manufacturing link and inspection
- Specify on the drawing what the calculation assumed: fillet radius + tolerance, surface (R_z ≤ 10 / ground R_a 0.4),
  "fillet rolled, rolling force … kN" or "shot peened 0.3 mmA, 200 % coverage", hardness range, no grinding burn (nital
  etch ISO 14104), MPI crack test (ISO 9934) for forgings, UT for internal defects.
- Residual stress check on first parts: X-ray diffraction (EN 15305).
- Fatigue-critical castings: X-ray / CT porosity acceptance per zone (ASTM E446 / ISO 4993 levels) linked to F5-type
  defect size.

### 26.11 Checklist, mistakes, references
Checklist: [ ] cycle count over life (10⁹ for compressor) and curve beyond the knee · [ ] mean-stress model stated ·
[ ] K_f or local stress with support (no double K_t) · [ ] surface + technology factors match the drawing ·
[ ] spectrum → rainflow → Miner with stated D_crit · [ ] LCF checked for start/stop · [ ] defect tolerance (Paris) for
castings/welds · [ ] utilisation a ≤ 1 with documented j.
Mistakes: endurance limit used for 10⁹ cycles without check; Goodman with negative mean stress (unconservative); ignoring
plating/grinding damage; weld calculated with base-metal S-N; Miner sum 1.0 for spectra without justification.
**References:** FKM guideline 7th ed. (VDMA, 2020) · Haibach, *Betriebsfestigkeit*, 3rd ed. (2006) · Stephens/Fatemi/
Stephens/Fuchs, *Metal Fatigue in Engineering*, 2nd ed. (2001) · Radaj/Vormwald, *Ermüdungsfestigkeit* · IIW
recommendations (Hobbacher, 2nd ed. 2016) · ASTM E1049-85 (2017) · ASTM E606 (strain-controlled tests) · BS 7910 ·
Anderson, *Fracture Mechanics*, 4th ed. (2017).

---

## 27 Reliability engineering

> Examples R1–R9 in `dm_strength.py`.

### 27.1 Basic definitions
- Reliability R(t) = probability of no failure up to time t; unreliability F(t) = 1 − R(t).
- Density f(t) = dF/dt; hazard (failure) rate h(t) = f(t)/R(t).
- MTTF = ∫₀^∞ R(t) dt. B_x life = time at which x % have failed (B10 = 10 %).

**Bathtub curve:** early failures (h falling, β < 1 – manufacturing defects → burn-in, inspection), random failures
(h constant, β = 1 – overloads, external causes), wear-out (h rising, β > 1 – fatigue, wear, corrosion → design life,
preventive maintenance).

### 27.2 Distributions

| Distribution | F(t) or model | Use |
|---|---|---|
| Normal | Φ((x − μ)/σ) | Strength, dimensions, loads with small scatter |
| Lognormal | Φ((ln x − μ_ln)/σ_ln) | Fatigue lives, repair times, loads with large scatter |
| Exponential | 1 − e^(−λt), MTTF = 1/λ | Random failures (electronics) |
| Weibull (2-par.) | **F(t) = 1 − exp(−(t/η)^β)** | Mechanical life – the workhorse |
Weibull: η = characteristic life (63.2 % failed), β = shape. MTTF = η·Γ(1 + 1/β). t at reliability R:
t_R = η·(−ln R)^(1/β). B10 = η·(0.10536)^(1/β). Hazard h(t) = (β/η)·(t/η)^(β−1).

**Example R1** – β = 1.5, η = 12 000 h: MTTF = **10 833 h**, B10 = **2 677 h**, R(5 000 h) = **0.764**, h(5 000) =
8.07·10⁻⁵ per hour. Note MTTF is 4× B10: never use MTTF as "design life".

### 27.3 Weibull analysis of test data
Procedure: (1) sort failure times; (2) median rank (Bernard) F_i = (i − 0.3)/(n + 0.4); (3) x = ln t, y = ln(−ln(1 − F));
(4) straight-line fit y = β·x − β·ln η (regress y on x); (5) check r² and the plot; suspended (unfailed) units need
Johnson's adjusted ranks or maximum likelihood.

**Example R2** – 6 valve reeds tested to failure (×1000 cycles): 410, 730, 1050, 1320, 1700, 2350.

| i | t | F_i | x = ln t | y |
|---|---|---|---|---|
| 1 | 410 | 0.1094 | 6.0162 | −2.1556 |
| 2 | 730 | 0.2656 | 6.5930 | −1.1753 |
| 3 | 1050 | 0.4219 | 6.9565 | −0.6015 |
| 4 | 1320 | 0.5781 | 7.1854 | −0.1473 |
| 5 | 1700 | 0.7344 | 7.4384 | 0.2819 |
| 6 | 2350 | 0.8906 | 7.7622 | 0.7943 |
Result: **β = 1.70, η = 1 460 ·10³ cycles, r² = 0.9995** → wear-out (fatigue). B10 = 1460·0.10536^(1/1.7) ≈ 390·10³
cycles. MATLAB: `wblfit(t)` (maximum likelihood, Statistics Toolbox) gives slightly different numbers – both are
estimates; with 6 samples the confidence band is wide (use `wblfit` 90 % bounds).

### 27.4 Stress–strength interference
Normal–normal: z = β = (μ_S − μ_L)/√(σ_S² + σ_L²), R = Φ(β) (chapter 6.2, E3: β = 3.33, 436 ppm).
Lognormal–lognormal (better for fatigue): β = ln(Ŝ/L̂)/√(ln(1 + V_S²) + ln(1 + V_L²)), Ŝ, L̂ = medians, V = COV.
**Example R3** – median strength 350 (V = 8 %), median stress 220 (V = 12 %): **β = 3.23, R = 0.99938, 621 ppm**.

### 27.5 FORM – first-order reliability method (Hasofer–Lind)
For a nonlinear limit state g(x) (failure when g < 0) with random variables x: transform to standard normal space
u_i = (x_i − μ_i)/σ_i; the **reliability index β** is the shortest distance from the origin to the surface g = 0
(design point u*). P_f ≈ Φ(−β). Iteration (HL-RF): u_(k+1) = [(∇g·u_k − g(u_k))/|∇g|²]·∇g. The direction cosines
α_i = −u_i*/β show **which variable matters most** (α² = share of importance).

**Example R4** – shaft g = R_e − 32·M/(π·d³), M = 800 N·m fixed, R_e ~ N(430, 30) MPa, d ~ N(30, 0.6) mm (2 % COV –
exaggerated, e.g. corrosion or wrong stock): FORM **β = 3.573, P_f = 1.76·10⁻⁴**, design point R_e* = 342.8 MPa,
d* = 28.75 mm, α = (0.813, 0.582) → R_e explains 66 %, d 34 % of the risk. 11 iterations.
**Example R5 – Monte Carlo check** (200 000 samples, seed 1): P_f = **2.0·10⁻⁴**, 95 % CI 1.38…2.62·10⁻⁴ → FORM inside
the band. Rule: Monte Carlo needs N ≈ 100/P_f samples for ±20 % accuracy (10⁶ for P_f = 10⁻⁴).

```matlab
% MATLAB Monte Carlo (example values)
N = 2e5; Re = 430 + 30*randn(N,1); d = 30 + 0.6*randn(N,1);
g = Re - 32*800e3./(pi*d.^3);  Pf = mean(g < 0)   % about 2e-4
```

### 27.6 System reliability
- Series (all must work): R_s = Π R_i. 5 parts of 0.99 → **0.951**.
- Parallel (one of n enough): R_p = 1 − Π(1 − R_i). 2 × 0.9 → **0.99**.
- k-out-of-n: R = Σ_(i=k)^n C(n,i)·R^i·(1−R)^(n−i). 2-out-of-3, R = 0.9 → **0.972**.
- **Allocation** (equal, series): target system R_s = 0.95 for 4 subsystems → each **0.9873** (R_s^(1/4)). Better:
  allocate by complexity / criticality (ARINC, AGREE methods).

### 27.7 Rolling bearings as a Weibull case
ISO 281: L10 = (C/P)^p (p = 3 ball, 10/3 roller); life at other reliability L_n = a1·a_ISO·L10 with Weibull
dispersion. a1 = 0.95·(ln(100/R)/ln(100/90))^(2/3) + 0.05 → R = 90 %: **1.0**, 95 %: **0.638** (table 0.64), 99 %:
**0.248** (table 0.25). A compressor with 4 bearings in series, each at L10, has system reliability 0.9⁴ = 0.66 at that
time → choose each bearing for the system target.

### 27.8 Test planning – success-run (zero-failure) tests
Number of samples that must survive the target life with no failure to show reliability R with confidence C:
**n = ln(1 − C)/ln R**. Testing longer (life ratio L = t_test/t_target) with Weibull shape β (Lipson):
**n = ln(1 − C)/(L^β·ln R)**.
**Example R7** – show R = 90 % at C = 90 %: n = 21.85 → **22 parts**. Testing 2 × target life with β = 1.5: n = 7.73 →
**8 parts**. Longer tests save parts but take time and need the same failure mode (no new mechanism at the longer life).

### 27.9 Manufacturing link
Scatter in production is part of reliability: R_e scatter from heat-lot certificates, diameter scatter from SPC (C_pk),
residual stress scatter from peening control. Feed the measured σ values into interference / FORM. Field data (warranty
returns with hours) → Weibull analysis → update design rules (S9 feedback).

### 27.10 Checklist, mistakes, references
Checklist: [ ] distribution type justified · [ ] Weibull fit with r² and confidence bounds · [ ] β index and the variable
importance known · [ ] Monte Carlo sample size ≥ 100/P_f · [ ] system model (series/parallel) drawn · [ ] test plan from
success-run or Weibull.
Mistakes: MTTF used as life; normal distribution for fatigue life; few samples treated as exact; series reliability
forgotten (each part 99 % but 50 parts → 60 %).
**References:** O'Connor/Kleyner, *Practical Reliability Engineering*, 5th ed. (2012) · Abernethy, *The New Weibull
Handbook*, 5th ed. · Bertsche, *Reliability in Automotive and Mechanical Engineering* (2008) · Haldar/Mahadevan,
*Probability, Reliability and Statistical Methods in Engineering Design* (2000) · ISO 281:2007 · IEC 61649 (Weibull
analysis) · VDA volume 3 part 2 (reliability).

---

## 28 FEA and MBD theory, verification and validation in depth

> Examples T1–T9 in `dm_strength.py`.

### 28.1 FEA from first principles – the bar element
Equilibrium + Hooke + compatibility. A bar of length L, area A, modulus E, nodes 1–2 with axial displacements u1, u2:
strain ε = (u2 − u1)/L, force N = EA·ε. Nodal forces:

```
 | f1 |   EA  |  1  -1 | | u1 |
 | f2 | = --- | -1   1 | | u2 |        k_e = EA/L
          L
```
**Assembly:** add every element matrix into the global matrix at its node numbers → [K]{u} = {F}; apply supports
(delete fixed rows/columns); solve; back-calculate strains and stresses; reactions R = K·u at fixed nodes.

**Example T1** – stepped bar, E = 210 000 MPa, element 1: A = 200 mm², L = 100; element 2: A = 100 mm², L = 100;
F = 10 kN at the free end. k1 = 420 000 N/mm, k2 = 210 000 N/mm → u = [0, **0.02381**, **0.07143**] mm, stresses
**50** and **100 MPa**, reaction **−10 000 N** (equilibrium check passes). Every commercial FEA code does exactly this, only
with millions of degrees of freedom.

### 28.2 Shape functions, isoparametric elements, integration
Inside an element the displacement is interpolated from nodal values: u(ξ) = Σ N_i(ξ)·u_i. Linear bar: N1 = (1−ξ)/2,
N2 = (1+ξ)/2 (ξ from −1 to 1). Isoparametric = the same N_i map the geometry → curved edges for quadratic elements.
Element stiffness k_e = ∫ Bᵀ·D·B dV (B = strain–displacement matrix, D = elasticity matrix), evaluated by **Gauss
quadrature**: n points integrate polynomials up to degree 2n − 1 exactly.
**Example T2** – 2-point Gauss (±1/√3, weights 1): ∫₋₁¹(x³ + 2x² + 1)dx = **3.3333** exactly; ∫x⁴ gives 0.2222 instead of
0.4 → too few points for degree 4. *Reduced integration* (fewer points) makes elements softer and faster but can create
zero-energy modes (hourglassing).

### 28.3 Element types and their pitfalls

| Element | Ansys | Abaqus | Use | Pitfall |
|---|---|---|---|---|
| Linear tet (4 node) | SOLID285 / SOLID187 degenerated | C3D4 | Avoid for stress | Far too stiff (constant strain) – stress error 20–50 % |
| Quadratic tet (10 node) | **SOLID187** | **C3D10**, C3D10M (contact) | Standard for CAD solids | Needs ≥ 2 elements through thin walls |
| Linear hex, full integration | SOLID185 (full) | C3D8 | Avoid in bending | **Shear locking** – too stiff in bending |
| Linear hex, reduced | SOLID185 (reduced/enhanced strain) | **C3D8R** (+ hourglass control), C3D8I (incompatible modes) | Explicit, large deformation | **Hourglassing** – check artificial energy < 5–10 % |
| Quadratic hex | SOLID186 | C3D20R | Accurate stress in simple shapes | Meshing effort |
| Shell | SHELL181/281 | S4R, S8R | Sheet metal, tanks, frames | Wrong for t/L > 0.1; stress top/bottom/mid |
| Beam | BEAM188/189 | B31/B32 | Frames, shafts (quick) | Local stresses at joints not captured |
**Volumetric locking:** nearly incompressible material (rubber, plastic flow ν → 0.5) locks fully integrated elements →
use hybrid (Abaqus C3D8H/C3D10H) or mixed u-P formulation (Ansys KEYOPT).

### 28.4 Errors, refinement and singularities
- Discretisation error decreases as h^p (h element size, p order). **h-refinement** = smaller elements, **p-refinement** =
  higher order. Error estimators (Zienkiewicz–Zhu, stress jump between elements – Ansys "structural error", Abaqus
  error indicators) show where to refine.
- Convergence and GCI: chapter 5.7 (E2).
- **Singularities:** at a sharp re-entrant corner the elastic stress goes as σ ∝ r^(λ−1) (λ < 1) → infinite. For a 90°
  corner λ ≈ 0.5445: halving the element size raises the peak by 2^0.4555 = **1.37 ×**; for a crack (λ = 0.5) **1.41 ×**
  (example T4). A value that grows by this factor at every refinement is **not a result** – model the real radius, or use
  hot-spot / notch-stress methods (welds), or fracture mechanics (cracks).
- Point loads and point supports are singular too – distribute them.

### 28.5 Contact algorithms

| Method | Idea | Pro | Con | Ansys / Abaqus |
|---|---|---|---|---|
| Penalty | Contact force = k_n·penetration | Robust, fast | Some penetration; k_n choice | Ansys "Pure penalty"; Abaqus penalty (default in general contact) |
| Augmented Lagrange | Penalty + iterative correction | Small penetration, robust | More iterations | Ansys default (Augmented Lagrange) |
| Lagrange multiplier | Exact zero penetration | Exact | Over-constraint, chattering | Ansys "Normal Lagrange"; Abaqus "hard" contact direct |
| MPC / bonded | Glues nodes | Fast, linear | No separation | Ansys bonded MPC; Abaqus *TIE |
Friction: Coulomb μ; sticking via penalty tangential stiffness (elastic slip). Checks: contact status plot, penetration
< 1–5 % of element size, contact pressure smooth (no checkerboard), reaction balance.

### 28.6 Nonlinear solution
Nonlinear sources: geometry (large deflection), material (plasticity), contact. Solved incrementally with
**Newton–Raphson**: residual r = F_ext − F_int(u); tangent K_T = ∂F_int/∂u; Δu = K_T⁻¹·r; repeat until |r| < tol
(Ansys force tolerance 0.5 %, Abaqus R_n^α ≤ 0.5 %). Convergence is **quadratic** near the solution.
**Example T7** – spring F(u) = 1000·u + 50·u³ (N, mm), F = 5000 N: iterations u = 0 → 5.0 → 3.684 → 3.294 → 3.2631 →
**3.2630 mm**; residual 5000 → −6250 → −1185 → −81 → −0.47 → 0 (quadratic in the last steps).
**Arc-length (Riks)** controls a path length instead of load → follows snap-through and buckling beyond the limit point.
Abaqus *STATIC, RIKS; Ansys ARCLEN.

### 28.7 Explicit dynamics – stable time step
Central-difference integration is only conditionally stable: **Δt ≤ L_e/c**, wave speed c = √(E/ρ) (1D; in 3D use the
dilatational wave speed). Units in tonne–mm–s: ρ steel = 7.85·10⁻⁹ t/mm³.
**Example T3** – steel c = **5172 m/s**, L_e = 1 mm → **Δt = 1.93·10⁻⁷ s**; aluminium c = 5092 m/s, Δt = 1.96·10⁻⁷ s.
A 10 ms drop test needs ≈ 52 000 increments. One tiny element (0.1 mm) cuts the step for the whole model by 10 → clean the
mesh, or use **mass scaling** (check kinetic energy < 5 % of internal energy for quasi-static runs).

### 28.8 Modal, harmonic and transient analysis
Modal: solve (K − ω²M)·φ = 0 → natural frequencies f_i = ω_i/2π and mode shapes φ_i. **Effective mass participation**
tells which modes matter for base excitation: include modes until Σ ≥ 90 % in each direction.
Harmonic: steady-state response to sinusoidal force, damping ratio ζ (steel structures 0.5–2 %, bolted assemblies 2–5 %)
→ peak amplification Q ≈ 1/(2ζ). Transient: time integration (Newmark/HHT) for start-up, impact, gas-force cycles.
Compressor rule: keep natural frequencies away (≥ ±15–20 %) from 1st and 2nd order (24.2 / 48.3 Hz at 1450 rpm) and
from belt and fan frequencies.

### 28.9 MBD theory (Adams, SOLIDWORKS Motion, Simscape, Simcenter Motion)
- Equations: M(q)·q̈ + Φ_qᵀ·λ = Q(q, q̇, t) with constraints Φ(q, t) = 0 → **differential-algebraic equations (DAE)**,
  index 3 (positions). Solvers reduce the index (index-2 / stabilised index-2 "SI2" formulation in Adams) or use
  **Baumgarte stabilisation** Φ̈ + 2αΦ̇ + β²Φ = 0 to stop drift.
- Integrators: **GSTIFF** (Gear, variable order BDF – robust, default in Adams), **HHT** (Hilber–Hughes–Taylor –
  better for flexible bodies, numerical damping α = −0.3…0), WSTIFF. Error tolerance and HMAX (maximum step) control
  accuracy – run a step study (halve HMAX, peak force change < 2 %).
- **Contact force model** (Adams IMPACT): F = k·δ^e + STEP(δ, 0, 0, d_max, c_max)·δ̇. k from Hertz, e = 1.5 for metal
  (sphere-type), damping c_max ≈ 0.1–1 % of k, penetration d_max ≈ 0.01–0.1 mm.
- **Example T6 – Hertz stiffness for a steel ball R = 10 mm on steel flat:** E* = 115 385 MPa, k = (4/3)·E*·√R =
  **486 504 N/mm^1.5**; at F = 1000 N δ = (F/k)^(2/3) = **0.0162 mm**, secant stiffness 61 857 N/mm. Using a random "k = 10⁵"
  instead gives a different δ and different peak forces – always derive k, then vary ± 50 % in a sensitivity run.
- Redundant constraints: a 4-bar built with 4 revolute joints has 3 redundant constraints → reactions are arbitrary.
  Use joint primitives (inline, inplane) or bushings so the model is statically determined.

### 28.10 Validation metrics and test correlation
- Relative error e = (sim − test)/test. **Example T8** – FEA vs tap test: 212/205 Hz **+3.4 %**, 455/470 Hz **−3.2 %**,
  780/760 Hz **+2.6 %** → within ± 5 % target.
- **MAC** (modal assurance criterion): MAC = |φ_testᵀ·φ_FEA|² / ((φ_testᵀφ_test)·(φ_FEAᵀφ_FEA)), 0…1.
  **Example T5** – φ_test = [0.10, 0.45, 0.80, 1.00], φ_FEA = [0.12, 0.43, 0.82, 1.00] → MAC = **0.9994** (same mode);
  against a different mode shape [1.00, 0.60, −0.40, −0.90] → **0.167** (different mode). Target: diagonal MAC > 0.9,
  off-diagonal < 0.1–0.2.
- Strain-gauge correlation: compare at the gauge position and **direction**, averaged over the gauge length (3–6 mm)
  – not the FEA peak at the fillet bottom.

### 28.11 Uncertainty quantification
Inputs are uncertain (loads, E, dimensions, friction). Propagate by Monte Carlo or first-order (Taylor) method.
For a product-type model y = c·Π x_i^(a_i): COV_y² ≈ Σ (a_i·COV_i)².
**Example T9** – cantilever δ = F·L³/(3EI), F COV 5 %, E COV 2 %, L COV 0.5 % → linear COV = √(5² + 2² + (3·0.5)²) =
**5.59 %**; Monte Carlo 100 000 samples: mean 0.953 mm, COV **5.59 %**. Variance shares: F **80 %**, E 12.8 %, L 7.2 % →
improving the load knowledge is worth more than better material data. Ansys optiSLang / DesignXplorer "six sigma" and
MATLAB do this for FEA with surrogates.

### 28.12 ASME V&V 10 workflow (applied to your company)
1. Define the intended use and the quantity of interest (e.g. fillet stress amplitude, ±10 %).
2. Conceptual model (physics, assumptions) → mathematical model → computational model.
3. **Code verification** (benchmarks: NAFEMS LE1/LE10, patch tests) – once per software version.
4. **Solution verification** (GCI, time step) – every model.
5. Validation experiment designed **together** with the model (same BCs, measured inputs).
6. Compare with a validation metric (error, MAC) against the accuracy requirement.
7. Uncertainty of both (test scatter, input UQ) → decide: adequate / not adequate.
8. Document → credibility level (chapter 7.1).

### 28.13 Mapping to your tools – recommended settings

| Topic | Ansys Mechanical | Abaqus | Adams / SOLIDWORKS Motion |
|---|---|---|---|
| Solid elements | SOLID187 (tet10), SOLID186 (hex20) | C3D10 / C3D10M, C3D20R, C3D8I | – (rigid / flexible MNF) |
| Contact | Augmented Lagrange, frictional μ from data, "adjust to touch" only with care | General contact or surface-to-surface, penalty, μ | IMPACT with Hertz-derived k, e = 1.5 |
| Nonlinear | Large deflection ON when rotations > ≈ 5°; auto time stepping | NLGEOM=YES; *STATIC with controls | GSTIFF SI2, HMAX ≤ 1/(20·f_max) |
| Explicit | LS-DYNA / Explicit STR | Abaqus/Explicit, check ALLAE/ALLIE, ALLKE/ALLIE | – |
| Error check | Structural error plot, convergence tool | Error indicators, energy output | Energy, redundant constraint report |
| Units | Set in Units menu (mm, t, s, N, MPa) | No units – keep t-mm-s-N-MPa consistent | Units dialog – check mass |

### 28.14 Manufacturing link
FEA must use the **as-manufactured** geometry where it matters: real fillet radii (minimum tolerance value), cast wall
thickness (minimum, with draft), machining stock removed, weld size a (minimum). Residual stresses from peening, rolling,
welding or quenching can be mapped into FEA (guide 54 C42/C43/C47). Validation tests are run on parts from the real
process route, not on lab-made specimens only.

### 28.15 Checklist, mistakes, references
Checklist: [ ] element type suits physics (no tet4, no C3D8 in bending) · [ ] GCI and singularities checked · [ ] contact
status and penetration checked · [ ] nonlinear convergence history clean · [ ] explicit energy ratios OK · [ ] modal mass
≥ 90 % · [ ] MBD contact k derived, step study done, no redundant constraints · [ ] validation metric vs requirement ·
[ ] UQ: main uncertain input known.
Mistakes: linear tets; hourglassing ignored; Lagrange contact on rough meshes (chattering); explicit with tiny sliver
elements; default Adams contact parameters; comparing FEA peak with strain-gauge average; units in Abaqus mixed.
**References:** Cook/Malkus/Plesha/Witt, *Concepts and Applications of Finite Element Analysis*, 4th ed. (2002) ·
Bathe, *Finite Element Procedures*, 2nd ed. (2014) · Zienkiewicz/Taylor/Zhu, *The Finite Element Method*, 7th ed. (2013) ·
Wriggers, *Computational Contact Mechanics*, 2nd ed. (2006) · Shabana, *Dynamics of Multibody Systems*, 5th ed. (2020) ·
Ewins, *Modal Testing*, 2nd ed. (2000) · ASME V&V 10-2019 · NAFEMS benchmark publications (LE1, LE10) · Oberkampf/Roy,
*Verification and Validation in Scientific Computing* (2010).


---

## 29 Optimisation mathematics and algorithms

> Program: `tools/dm_opt.py` (`python dm_opt.py examples`, `python dm_opt.py selftest`). Every number in chapters 29–33
> comes from it. All inputs are **example values**.

### 29.1 Problem classes – know the class before you choose a solver

| Class | Form | Example in machine design | Typical solver |
|---|---|---|---|
| **LP** – linear program | f and all g linear | Product mix, cutting-stock (bars from stock length), transport plan | Simplex, interior point (`linprog`) |
| **NLP** – nonlinear program | f or g nonlinear, variables continuous | Shaft, spring, beam sizing; most structural problems | SQP, interior point (`fmincon`) |
| **MINLP** – mixed-integer nonlinear | Some variables integer / discrete | Standard wire sizes, number of bolts, number of teeth | Branch and bound, GA (`ga` with `IntCon`) |
| **Convex** | f convex, feasible set convex | Some sizing problems after a log transform (geometric programming) | Any local method finds the **global** optimum |
| **Non-convex / multimodal** | Several local optima | Topology, shape, crank balancing with many variables | Multi-start, GA, PSO, surrogate + global search |

**Why convexity matters.** For a convex problem every local minimum is the global minimum. Many sizing problems become
convex in log variables (y = ln x) because their formulas are power laws (σ = 32M/(πd³), k = Gd⁴/(8D³n)). This is also
why a surrogate in log space fits so well (29.9).

### 29.2 Lagrange multipliers and the KKT conditions

**Equality constraint.** Minimise f(x) subject to h(x) = 0. At the optimum the gradient of f must be parallel to the
gradient of h (otherwise you could slide along h = 0 and reduce f):

  ∇f(x*) + λ·∇h(x*) = 0 ,  h(x*) = 0  → Lagrangian L(x, λ) = f(x) + λ·h(x), stationary point of L.

**Inequality constraints g_i(x) ≤ 0 – Karush–Kuhn–Tucker (KKT) conditions** (necessary for a local optimum, under a
regularity condition):

| Condition | Formula | Meaning |
|---|---|---|
| Stationarity | ∇f + Σ μ_i ∇g_i + Σ λ_j ∇h_j = 0 | No feasible direction reduces f |
| Primal feasibility | g_i ≤ 0, h_j = 0 | Design is allowed |
| Dual feasibility | μ_i ≥ 0 | A constraint can only push, never pull |
| Complementary slackness | μ_i · g_i = 0 | Inactive constraint (g < 0) has μ = 0; μ > 0 only on active constraints |

**Shadow price (sensitivity).** If the constraint is g(x) ≤ b, then **df*/db = −μ**: the multiplier tells you how much
the optimum improves when you relax the limit by one unit. This is the most useful by-product of an optimisation: it
tells management what a stronger material, a larger space or a looser tolerance is worth.

**Worked example 29-A (mathematics).** min f = x₁² + x₂² subject to x₁ + x₂ ≥ b (write g = b − x₁ − x₂ ≤ 0), b = 4.
Stationarity: 2x₁ − μ = 0, 2x₂ − μ = 0 → x₁ = x₂ = μ/2. Active: x₁ + x₂ = 4 → μ = 4, x* = (2, 2), f* = 8.
Check of the shadow price: f*(b) = b²/2 → df*/db = b = **4.0 = μ** (program: 4.0000). Raising the requirement b by 1
costs about 4 units of f.

**Worked example 29-B (engineering).** Rectangular section b × h, bending moment M = 2.0·10⁶ N·mm, allowable
σ = 150 MPa, height limit h ≤ 120 mm (space). Minimise area A = b·h.
Stress constraint 6M/(b h²) ≤ σ. For a given h the smallest b is b = 6M/(σ h²) → A = 6M/(σ h) falls with h → the height
limit is **active**: h = 120 mm, **b = 5.56 mm, A = 666.7 mm²**.
Sensitivities (shadow prices): dA/dh_max = −6M/(σh²) = **−5.56 mm² per mm** of extra height; dA/dσ = **−4.44 mm² per MPa**.
Reading: 10 mm more space saves ≈ 56 mm² (8 %); a steel with 10 MPa higher allowable saves ≈ 44 mm². Note the
5.56 mm web would buckle – a missing constraint (local buckling, b/h limit). **Every real limit must be in the model.**

### 29.3 Scaling – the hidden reason for slow or wrong optimisation

Gradient methods follow the steepest slope. If variables or constraints have very different sizes (mm vs MPa vs kg) the
level lines become long thin ellipses and steepest descent zig-zags.

**Worked example 29-C.** f = (x₁ − 3)² + 10·(x₂ + 1)², start (0, 0). Hessian H = diag(2, 20), condition number 10.
- Steepest descent with exact line search: **35 iterations** to |∇f| < 10⁻⁶.
- Newton (uses H): **1 iteration**.
- Steepest descent after scaling x₂′ = √10·x₂ (circle level lines): **1 iteration**.

**Rules:** scale every variable to order 1 (x/x_ref), write constraints as g = value/limit − 1, objective as f/f_ref.
In MATLAB `optimoptions(...,'TypicalX',...)` or scale yourself (better).

### 29.4 Gradient methods (unconstrained)

| Method | Update | Cost per iteration | Convergence |
|---|---|---|---|
| Steepest descent | x ← x − α ∇f | 1 gradient | Linear, slow when ill-conditioned |
| Newton | x ← x − H⁻¹ ∇f | Gradient + Hessian (n² second derivatives) | Quadratic near optimum |
| Quasi-Newton **BFGS** | x ← x − α B⁻¹ ∇f, B updated from gradient changes | 1 gradient | Superlinear, the standard workhorse |
| Conjugate gradient | Directions conjugate w.r.t. H | 1 gradient, little memory | Good for very many variables |

**BFGS update** of the inverse Hessian approximation H_k (s = x_{k+1} − x_k, y = ∇f_{k+1} − ∇f_k):
H_{k+1} = H_k + (sᵀy + yᵀH_k y)(s sᵀ)/(sᵀy)² − (H_k y sᵀ + s yᵀ H_k)/(sᵀy).
**Line search (Armijo):** accept step α if f(x + αp) ≤ f(x) + c₁ α ∇fᵀp (c₁ ≈ 10⁻⁴), else halve α.
**Example 29-D:** BFGS with finite-difference gradients on the Rosenbrock "banana" function from (−1.2, 1): reaches
(1.00000, 1.00000), f = 3·10⁻¹⁷ in **34 iterations** (steepest descent needs thousands).

### 29.5 Constrained methods – what fmincon really does

| Method | Idea | Strength | Weakness | fmincon option |
|---|---|---|---|---|
| **Penalty** | min f + r·Σ max(0, g)² | Simple, any inner solver | Ill-conditioned for large r; optimum slightly infeasible | – (do it yourself) |
| **Augmented Lagrangian** | min f + (μ/2)Σ[max(0, g + λ/μ)² − (λ/μ)²], then λ ← max(0, λ + μg) | Exact optimum with moderate μ; gives multipliers | Outer loop needed | – (used in `ga` for nonlinear constraints) |
| **SQP** | Each iteration solves a quadratic model of L with linearised constraints | Fast, accurate for smooth small/medium problems | Needs good gradients | `'sqp'` |
| **Interior point** | Barrier −t·Σ ln(−g) keeps x inside; t → 0 | Large problems, robust, default | May be slower on small problems | `'interior-point'` (default) |
| **Active set** | Guesses the active constraints, solves equality problem | Small dense problems | – | `'active-set'` |

**Recommendation for your work:** analytic models → `fmincon` with `'sqp'`; FEA in the loop → surrogate first (29.9) or
`'interior-point'` with careful finite differences (29.6); discrete sizes → 29.10.

### 29.6 Finite-difference gradients and FEA noise

Gradient by forward difference: ∂f/∂x ≈ (f(x + h) − f(x))/h. Two errors:
- truncation ≈ (h/2)·|f″| (h too large),
- noise ≈ 2ε/h, where ε = numerical noise of f (mesh changes, solver tolerance, remeshing in each CAD update).

Minimise the sum: **h_opt = 2·√(ε/|f″|)**, error at h_opt = 2·√(ε·|f″|).

**Example 29-E.** FEA peak stress f = 200 MPa, relative noise 10⁻⁴ (ε = 0.02 MPa), curvature f″ = 50 MPa/mm²:
h_opt = **0.04 mm**, gradient error ≈ 2 MPa/mm. With the default h ≈ 10⁻⁸·x the gradient would be pure noise.
**Practice:** keep the mesh topology fixed (morphing) when x changes; tighten solver tolerances; use central differences
(error ∝ h²); in MATLAB set `'FiniteDifferenceStepSize'` (e.g. 1e-3 relative) and `'FiniteDifferenceType','central'`.
Ansys / Abaqus parameter studies: same rule – a 0.001 mm step on a 30 mm diameter only measures remeshing noise.

### 29.7 Derivative-free local methods
- **Nelder–Mead simplex** (`fminsearch`): n + 1 points, reflect / expand / contract / shrink. Good for 2–6 variables
  and noisy functions. No constraints → penalty or augmented Lagrangian around it.
- **Pattern search** (`patternsearch`, Global Optimization Toolbox): polls a mesh of directions around the best point,
  shrinks the mesh on failure; handles bounds and linear constraints; provable convergence on smooth problems; good with
  FEA noise.

### 29.8 Global methods

**Genetic algorithm (GA).** Population of designs; each generation:
1. **Selection** – tournament: pick 2 at random, the better one becomes a parent.
2. **Crossover** – e.g. blend BLX-α: child gene uniform in [min − αI, max + αI], I = |p₁ − p₂| (α = 0.5).
3. **Mutation** – add Gaussian noise (e.g. 10 % of the variable range) with probability p_m ≈ 0.1–0.2.
4. **Elitism** – copy the best 1–2 unchanged.
Constraints by penalty or by feasibility rules (feasible beats infeasible; among infeasible, smaller violation wins).

**Particle swarm (PSO)** – velocity of each particle:
  v ← w·v + c₁r₁(p_best − x) + c₂r₂(g_best − x),  x ← x + v  (w ≈ 0.7, c₁ = c₂ ≈ 1.5, r random in [0, 1]).

**Simulated annealing** – accept a worse move with probability P = exp(−Δf/T); temperature T falls slowly.

Global methods need **hundreds to thousands of evaluations** → use them on analytic models or surrogates, not directly
on a 30-minute FEA.

### 29.9 Surrogate-based optimisation

**Response surface (RSM) by least squares.** Model y ≈ Xβ (X = design matrix with columns 1, x, x², x₁x₂…).
Minimising the squared error gives the normal equations **β = (XᵀX)⁻¹Xᵀy**.

**Worked example 29-F (hand-size).** Stress concentration factor of a shaft shoulder from 5 FEA runs (example values):

| r (mm) | 1.0 | 1.5 | 2.0 | 2.5 | 3.0 |
|---|---|---|---|---|---|
| K_t | 2.10 | 1.85 | 1.68 | 1.57 | 1.50 |
Quadratic fit: **K_t = 2.752 − 0.776·r + 0.120·r²**, R² = 0.9993, R²_adj = 0.9986, residuals ≤ 0.008.
Linear fit: K_t = 2.332 − 0.296·r, R² = 0.945, R²_adj = 0.927 → the curvature is real; use the quadratic.

**Kriging (Gaussian process).** y(x) = μ + Z(x), Z correlated by distance (e.g. exp(−Σθ_k(x_k − x′_k)²)). It
**interpolates** the samples and gives a **prediction uncertainty s(x)**. **Radial basis functions:** y = Σ w_i φ(|x − x_i|).
**Infill by expected improvement:** next sample where
  EI = (f_min − μ)·Φ(z) + s·φ(z),  z = (f_min − μ)/s.
Example: best so far f_min = 0.120 kg, surrogate predicts μ = 0.115 kg with s = 0.010 kg → EI = **0.00698 kg** → a
promising point. EI balances "predicted good" (exploitation) and "unknown" (exploration). MATLAB: `surrogateopt`,
`fitrgp`; Ansys optiSLang (MOP), DesignXplorer (Kriging, genetic aggregation).

### 29.10 Discrete and standard sizes
Real designs use catalogue values (wire diameters EN 10270, bolt sizes, bearing bores, module series, sheet thickness).
Methods: (1) solve continuous → round → **re-check all constraints** (rounding can make it infeasible);
(2) enumerate the catalogue list and optimise the remaining continuous variables for each entry (best for short lists);
(3) branch and bound / GA with integer variables (`ga(...,'IntCon',idx)`, map integer → catalogue index).

### 29.11 Complete comparison – minimum-mass helical compression spring (example values)

**Problem.** Static spring for a valve / unloader: F_max = 300 N, rate k = 10 N/mm (target), G = 81 500 MPa,
ρ = 7850 kg/m³, corrected shear stress τ ≤ 650 MPa (example allowable), outer diameter D + d ≤ 32 mm, spring index
4 ≤ C = D/d ≤ 12, buckling limit L₀/D ≤ 4, working stroke 30 mm + 15 % clearance, n ≥ 2.
Variables: wire d, mean coil diameter D. Active coils from the rate: **n = G d⁴/(8 D³ k)** (equality eliminated).
Formulas: Wahl factor K_W = (4C − 1)/(4C − 4) + 0.615/C, τ = K_W·8FD/(πd³), L₀ = (n + 2)·d + 1.15·30,
mass m = ρ·(πd²/4)·πD·(n + 2).

| Method | d mm | D mm | Mass g | Remarks |
|---|---|---|---|---|
| Dense grid (reference, global) | 3.101 | 20.73 | **48.55** | n = 10.57, C = 6.68, τ = 650.0 (**active**), L₀ = 73.5 mm, L₀/D = 3.55 (g = −0.11, inactive) |
| Augmented Lagrangian + Nelder–Mead | 3.092 | 20.51 | **48.55** | Multiplier μ_τ = 0.0933 kg per unit relative stress → relaxing τ_allow by 1 % saves ≈ 0.93 g |
| Genetic algorithm (60 × 150) | 3.089 | 20.48 | 48.46 | τ exceeded by 0.095 % – penalty methods end slightly infeasible → always re-check |
| RSM quadratic in **ln m, ln τ** (25 samples) | 3.180 | 22.65 | predicted 49.25 / true **48.65** | R² = 0.9998; τ_true = 650.5 (0.08 % over) → small correction after verification |
| RSM quadratic in m, τ directly | 3.265 | 23.95 | predicted **5.73** / true 51.56 | R² = 0.969 looked "good", prediction wrong by 9× → **never trust a surrogate without a verification run** |
| Discrete EN 10270 wire list | **3.20** | 23.12 | **48.81** | Only +0.5 % mass; d = 3.0 has **no feasible D** (stress needs D ≤ ≈18.6 mm, buckling needs D ≥ ≈19 mm) |

Discrete table: d 3.20 → 48.81 g · 3.50 → 58.21 g · 3.80 → 90.53 g · 4.00 → 120.51 g; d ≥ 4.5 infeasible (outer diameter).
**Lessons.** (1) The optimum valley is flat (different d, D give the same mass) → choose inside it by manufacturing
(standard wire, coiling tool). (2) Stress is the active limit; buckling decides which wires are possible. (3) Power-law
physics → fit surrogates in log space. (4) The spring item M8 adds fatigue (Goodman for EN 13906), set loss, end
coils and tolerances (EN 15800).

**MATLAB equivalent:**
```matlab
P.F=300; P.k=10; P.G=81500; P.rho=7.85e-6; P.tau=650; P.Dout=32;
mass = @(x) P.rho*pi*x(1)^2/4*pi*x(2)*(P.G*x(1)^4/(8*x(2)^3*P.k)+2);
opts = optimoptions('fmincon','Algorithm','sqp','Display','iter');
[x,m,~,~,lam] = fmincon(mass,[3.5 25],[],[],[],[],[1 6],[6 40],@(x) springcon(x,P),opts);
lam.ineqnonlin            % shadow prices of the constraints
function [g,h] = springcon(x,P)
 d=x(1); D=x(2); n=P.G*d^4/(8*D^3*P.k); C=D/d; Kw=(4*C-1)/(4*C-4)+0.615/C;
 tau=Kw*8*P.F*D/(pi*d^3); L0=(n+2)*d+1.15*30;
 g=[tau/P.tau-1; (D+d)/P.Dout-1; 4/C-1; C/12-1; L0/D/4-1; 1-n/2]; h=[];
end
```

### 29.12 Checklist – optimisation set-up
- [ ] Variables, objective, constraints written in words and symbols; units; bounds from manufacturing.
- [ ] Variables and constraints scaled to order 1.
- [ ] Every real limit included (buckling, minimum wall, tool access, standard sizes).
- [ ] Method chosen by problem class and model cost.
- [ ] Gradients: analytic or finite differences with h_opt; noise checked.
- [ ] Multi-start (≥ 5 starts) or global method for non-convex problems.
- [ ] Optimum verified with the full model; constraints re-checked after rounding.
- [ ] Multipliers / sensitivities reported.

### 29.13 Common mistakes
Missing constraints (thin webs, buckling) · no scaling · default finite-difference step on FEA · trusting R² of a
surrogate · penalty optimum taken as feasible · one start point on a multimodal problem · rounding without re-check.

### 29.14 References
Arora, *Introduction to Optimum Design*, 4th ed. (2016) · Nocedal & Wright, *Numerical Optimization*, 2nd ed. (2006) ·
Vanderplaats, *Numerical Optimization Techniques for Engineering Design*, 4th ed. · Forrester, Sóbester & Keane,
*Engineering Design via Surrogate Modelling* (2008) · Deb, *Multi-Objective Optimization using Evolutionary Algorithms*
(2001) · MathWorks Optimization Toolbox / Global Optimization Toolbox documentation.

---

## 30 DOE and statistics for engineers

### 30.1 Why planned experiments
Changing one factor at a time (OFAT) misses **interactions** and needs more runs for the same precision. A planned
design (DOE) estimates all main effects and interactions with every run used for every estimate. Use DOE for physical
tests (machining, assembly force, test bench) **and** for simulation studies (FEA, MBD) before optimisation.

### 30.2 Full factorial 2^k – effects and interactions
k factors at two levels (−1, +1), 2^k runs (standard order: A changes fastest). For a term T (A, B, AB, ABC…):
- contrast C_T = Σ (sign of T in run i)·(sum of the r replicates of run i),
- **effect** = C_T / (r·2^(k−1)) = mean(y at T = +) − mean(y at T = −),
- **sum of squares** SS_T = C_T² / (r·2^k), 1 degree of freedom.
- Sign of an interaction column = product of the factor columns (AB = A·B).

**Normal probability plot of effects.** Without replication: plot sorted effects against normal quantiles; small
(inactive) effects lie on a straight line, active effects fall off it (Daniel plot). Pareto chart of |effects| is the
same idea for beginners.

### 30.3 ANOVA – which effects are real?
Total variation SST = Σ(y − ȳ)² splits into SS of the terms + **pure error** SSE (from replicates):
SSE = Σ over runs Σ (y − ȳ_run)², df_E = 2^k·(r − 1), MSE = SSE/df_E.
F-test for each term: **F = SS_T/MSE** with (1, df_E) degrees of freedom; p-value = P(F_{1,df_E} > F).
p < 0.05 → the effect is statistically significant (5 % risk of a false alarm).
The program computes p from the regularised incomplete beta function: P(F_{d1,d2} > F) = I_{d2/(d2+d1F)}(d2/2, d1/2)
(Numerical Recipes continued fraction). Check: F_crit(0.05; 1, 8) = **5.318** (table value 5.32).

**Worked example 30-A – surface roughness in finish turning** (example values, 2³ with r = 2 replicates).
A = cutting speed 150 / 250 m/min, B = feed 0.10 / 0.20 mm/rev, C = nose radius 0.4 / 0.8 mm.

| Run | A | B | C | Ra µm (rep 1, rep 2) |
|---|---|---|---|---|
| 1 | − | − | − | 1.10, 1.16 |
| 2 | + | − | − | 0.98, 1.04 |
| 3 | − | + | − | 2.45, 2.39 |
| 4 | + | + | − | 2.20, 2.28 |
| 5 | − | − | + | 0.72, 0.78 |
| 6 | + | − | + | 0.66, 0.70 |
| 7 | − | + | + | 1.58, 1.50 |
| 8 | + | + | + | 1.40, 1.46 |

ANOVA (grand mean 1.400 µm, SST 5.881, SSE 0.0162, df_E = 8, MSE 0.002025):

| Term | Effect µm | SS | F | p | Verdict |
|---|---|---|---|---|---|
| B feed | **+1.015** | 4.1209 | 2035 | 6·10⁻¹¹ | dominant |
| C nose radius | **−0.600** | 1.4400 | 711 | 4·10⁻⁹ | strong |
| B×C | **−0.245** | 0.2401 | 119 | 4·10⁻⁶ | real interaction |
| A speed | −0.120 | 0.0576 | 28.4 | 7·10⁻⁴ | small but real |
| A×B | −0.025 | 0.0025 | 1.2 | 0.30 | not significant |
| A×C | +0.030 | 0.0036 | 1.8 | 0.22 | not significant |
| A×B×C | +0.005 | 0.0001 | 0.05 | 0.83 | not significant |

**Physics check (always do it):** geometric roughness Ra ≈ f²/(32·r_ε) (in mm → ×1000 for µm): f = 0.2, r = 0.8 →
1.56 µm (test 1.50–1.58 ✓); f = 0.1, r = 0.4 → 0.78 µm (test 1.10–1.16: real process adds tool wear / built-up edge).
The B×C interaction is the physics f²/r: a larger nose radius helps more at high feed. **Decision:** for Ra ≤ 1.6 µm use
r = 0.8 mm and f ≤ 0.2 mm; speed is a cost choice.

### 30.4 Fractional factorials, resolution and aliasing
2^(k−p) uses a fraction of the runs. A generator sets one factor column from others, e.g. **D = ABC** → defining
relation **I = ABCD**. Every effect is then **aliased** (cannot be separated) with its product by the defining word
(multiplication with letters cancelling in pairs, A² = I):

| Effect | Alias (2^(4−1), I = ABCD) |
|---|---|
| A | BCD |
| B | ACD |
| C | ABD |
| D | ABC |
| AB | CD |
| AC | BD |
| AD | BC |

**Resolution** = length of the shortest word in I. Res III: main effects aliased with 2-factor interactions (screening
only). **Res IV** (this design): main effects clear of 2FI, 2FI aliased with each other. Res V: main and 2FI clear.

**Worked example 30-B** – 8 FEA runs, 4 factors of a bracket (example values): y = 212, 188, 196, 179, 205, 183, 190, 168 MPa
(standard order of A, B, C; D = ABC). Estimates: A (+BCD) **−21.25**, B (+ACD) **−13.75**, C (+ABD) −7.25, D (+ABC) −1.75,
AB (+CD) 1.75, AC (+BD) −0.75, AD (+BC) −1.25 MPa. → A and B matter; D can be fixed at the cheaper level; the 2FI chains
are small, so no follow-up runs are needed. If a 2FI chain were large, run the **fold-over** (the other half) to separate it.

### 30.5 Screening and response-surface designs

| Design | Runs | Use |
|---|---|---|
| Plackett–Burman | Multiple of 4 (12 runs for up to 11 factors) | Screening many factors, Res III |
| 2^(k−p) Res IV/V | 8, 16, 32 | Screening with interactions |
| **Central composite (CCD)** | 2^k + 2k + n₀ (k = 2: 4 + 4 + 1 = **9**, α = (2^k)^(1/4) = **1.414**, rotatable) | Quadratic RSM, sequential (add star points to a factorial) |
| Box–Behnken | k = 3: 15 runs | Quadratic RSM without extreme corners (safe for machines) |
| **Latin hypercube (LHS)** | Any n | Space-filling samples for Kriging / surrogates in simulation |

LHS idea: divide each variable range into n equal strata, use each stratum exactly once per variable, random pairing.
Example (program, 5 samples × 2 variables in [0, 1]): (0.125, 0.108), (0.413, 0.710), (0.603, 0.479), (0.967, 0.972),
(0.252, 0.246) – each column has one value in each fifth. Use a maximin LHS (largest minimum distance) for better spread.

### 30.6 Replication, randomisation, blocking
- **Replication** (repeat the whole run) gives pure error → F-tests. Repeated *measurement* of the same part is not
  replication.
- **Randomise** run order (tool wear, temperature drift would otherwise look like a factor effect).
- **Blocking**: when runs must be split (two days, two machines, two material heats), make the block a factor that is
  aliased only with a high-order interaction (e.g. block = ABC in a 2³).
- FEA is deterministic: no replication needed, but **numerical noise** (mesh) acts like error → keep mesh rules fixed.

### 30.7 Regression quality and residual checks
R² = 1 − SSE/SST; **R²_adj** = 1 − [SSE/(n − p)]/[SST/(n − 1)] (penalises extra terms; if R²_adj falls when you add a
term, drop it). Prediction R² (PRESS, leave-one-out) shows forecasting ability. **Residual checks:** residuals vs fitted
(no funnel, no curve), normal plot (straight), residuals vs run order (no drift). A pattern means a missing term or a
needed transform (log y – see 29.11).

### 30.8 MATLAB
```matlab
D  = ff2n(3)*2-1;                    % 2^3 design in -1/+1
Df = fracfact('a b c abc');          % 2^(4-1), D = ABC
[Dc,~] = ccdesign(2,'type','circumscribed');   % CCD
X  = lhsdesign(20,3,'criterion','maximin');    % LHS
tbl = array2table([D; D],'VariableNames',{'A','B','C'}); tbl.Ra = y(:);
mdl = fitlm(tbl,'Ra ~ A*B*C');       % effects = 2*coefficients
anova(mdl)                            % SS, F, p
```

### 30.9 Checklist / mistakes / references
Checklist: [ ] response measurable with MSA OK (33.6) · [ ] factor ranges wide but safe · [ ] replicates or centre
points for error · [ ] randomised order · [ ] ANOVA + residual check · [ ] physics check of the result · [ ] confirmation run.
Mistakes: OFAT · ranges too narrow (effect hidden in noise) · ignoring interactions · no confirmation run · fitting
a quadratic to a 2-level design (curvature not estimable without centre or star points).
References: Montgomery, *Design and Analysis of Experiments*, 10th ed. (2019) · Box, Hunter & Hunter, *Statistics for
Experimenters*, 2nd ed. (2005) · Myers, Montgomery & Anderson-Cook, *Response Surface Methodology*, 4th ed. (2016) ·
ISO 3534-3 (statistics vocabulary – design of experiments).

---

## 31 Advanced structural optimisation

### 31.1 Topology optimisation – theory
Question: *where* should material be inside a design space to carry the loads with the best stiffness?

**SIMP (Solid Isotropic Material with Penalisation).** Each element e has a density 0 < ρ_e ≤ 1 and stiffness
  **E(ρ_e) = ρ_e^p · E₀**, p ≈ 3.
The penalty p makes intermediate densities uneconomic (stiffness ρ³ but mass ρ) → results become black-and-white.

**Minimum compliance problem:**
  min c(ρ) = Fᵀu = uᵀK(ρ)u  s.t. K(ρ)u = F,  Σ ρ_e v_e ≤ V*,  ρ_min ≤ ρ_e ≤ 1.
Compliance = work of the load = 1/stiffness. **Sensitivity** (adjoint, free for compliance):
  ∂c/∂ρ_e = −p·ρ_e^(p−1)·u_eᵀ k_e⁰ u_e  (always negative: more material = stiffer).
**Optimality-criteria (OC) update** (from the KKT condition ∂c/∂ρ_e + λ v_e = 0):
  ρ_e ← ρ_e · B_e^η, B_e = −(∂c/∂ρ_e)/(λ·∂V/∂ρ_e), η ≈ 0.5, with move limit m ≈ 0.2 and bounds;
  λ found by bisection so that the volume constraint is met exactly.
**Numerical problems and cures:**

| Problem | Cause | Cure |
|---|---|---|
| Checkerboard (alternating solid/void) | Low-order elements over-stiff in that pattern | Density or sensitivity **filter** (radius r_min ≈ 1.5–3 elements), higher-order elements |
| Mesh dependence | Finer mesh → finer members | Filter radius in **mm**, not in elements → **minimum member size** |
| Grey zones | Penalty too low, filter | Continuation p = 1 → 3, projection (Heaviside) |
| Local optima | Non-convex | Continuation, different starts; accept "good", not "global" |

### 31.2 Worked example 31-A – truss ground-structure topology (program)
Ground structure 5 × 3 nodes, 1 m grid, bars between neighbours and diagonals (**38 bars**), left column fixed,
F = 10 kN downward at the right middle node, E = 210 GPa, volume limit 20 % of "all bars at 1000 mm²"
(V = 0.008925 m³). Truss version of OC: A_i ← A_i·(E ε_i²/λ)^0.5 (equal strain-energy density in all bars at the optimum).
Result after 60 iterations: compliance **29.22 → 13.66 J** (stiffness × 2.14 at the same volume); **24 bars kept**
(A > 1 % of max), 14 removed. Largest bars: top and bottom chords at the support (855 mm²), falling to 444 mm²
toward the tip; diagonals 114–394 mm²; the middle-row horizontal bars disappear. This is the classic cantilever
pattern (chords carry bending, diagonals carry shear, Michell-type). The same logic drives a continuum SIMP run in Ansys
or Tosca – only with thousands of "bars" (elements).

### 31.3 From topology result to a manufacturable part
Topology output is a **concept**, not a part. Re-design it with manufacturing constraints set **in the optimisation**:

| Process | Constraint to set | Design rules after the run |
|---|---|---|
| Casting (crankcase, brackets) | Draw (pull) direction, symmetry, minimum member size ≥ 2× minimum wall (grey iron ≈ 4–5 mm, Al sand ≈ 4 mm) | Draft 1–3°, radii ≥ wall/2, uniform walls, no isolated thick nodes (porosity) |
| Machining from plate / bar | Extrusion constraint (constant section), tool access, pocket depth ≤ 4–5 × tool diameter | Pockets with corner radius ≥ tool radius, flat floors |
| Additive (LPBF) | Overhang angle ≥ 45° from plate, minimum member ≥ 0.5–1 mm, no trapped powder | Self-supporting angles, powder exits, support minimum (guide 48) |
| Weldment | Member list from standard profiles | Truss of tubes / plates – section choice by sizing optimisation (29) |
Then: smooth CAD (SOLIDWORKS, from the STL / mesh as reference), **re-analyse** the CAD part (stress, fatigue,
buckling – topology optimises stiffness only), then size with parameter optimisation.

### 31.4 Shape optimisation
- **Mesh morphing / free-shape (Tosca Shape, Ansys shape):** nodes on the surface move to make stress uniform
  (objective: min max σ_vM, or homogenise stress along a fillet). Constraint: allowed growth / shrink region.
- **Fillet optimisation by Mattheck's method of tensile triangles** (CAO-like, no software): from the corner draw an
  isosceles triangle with base angle 45° along the surfaces, take the midpoint of its free side as base of a new triangle
  of half the angle (22.5°), repeat (11.25°…); the polyline approximates the notch-free "tree root" contour. Typical stress
  reduction 30–50 % against a circular fillet of the same space.
- Parametric shape: elliptic fillet (a/b), relief grooves – optimise a, b with 29 + 30.

### 31.5 Multi-objective optimisation
**Pareto dominance:** design A dominates B if A is no worse in all objectives and better in at least one. The set of
non-dominated designs = **Pareto front**.

| Method | Formula | Note |
|---|---|---|
| Weighted sum | min w₁f₁/f₁ref + w₂f₂/f₂ref | Simple; misses non-convex parts of the front |
| **ε-constraint** | min f₁ s.t. f₂ ≤ ε, sweep ε | Finds every Pareto point; clear meaning |
| NSGA-II (`gamultiobj`) | Non-dominated sorting + crowding distance (keeps spread) | Whole front in one run; many evaluations |

**Worked example 31-B – cantilever b × h** (F = 2000 N, L = 500 mm, E = 210 GPa, σ ≤ 150 MPa, h ≤ 4b): objectives
area A (mass) and tip deflection δ = 4FL³/(E b h³). ε-constraint results:

| ε (δ_max) mm | b mm | h mm | A mm² | δ mm | σ MPa |
|---|---|---|---|---|---|
| 0.5 | 19.65 | 78.55 | 1543.5 | 0.500 | 49.5 |
| 1.0 | 16.52 | 66.06 | 1091.3 | 1.000 | 83.2 |
| 1.5 | 14.93 | 59.69 | 891.1 | 1.500 | 112.8 |
| 2.0 | 13.89 | 55.55 | 771.6 | 2.000 | 140.0 |
| ≥ 2.194 | 13.58 | 54.27 | **737.0** | 2.194 | **150.0** |
The front ends at δ = 2.194 mm: beyond it the stress limit, not stiffness, decides. Halving deflection from 2 to 1 mm
costs +41 % mass; from 1 to 0.5 mm another +41 %. **The knee** (≈ 1–1.5 mm) is usually the engineering choice.

### 31.6 Robust design (Taguchi)
**Quality loss** for a nominal-is-best characteristic: L(y) = k·(y − m)², k = A/Δ² (A = cost at the tolerance limit Δ).
Expected loss per part: **E[L] = k·[σ² + (μ − m)²]**.
**Example 31-C:** shaft Ø30 ± 0.02 mm, scrap / rework cost at the limit A = 5 USD → k = 12 500 USD/mm². Process σ = 0.005 mm,
mean offset 0.003 mm → E[L] = **0.425 USD per part**; centred process 0.3125 USD (−26 %) → centring pays before buying a
better machine.
**Signal-to-noise ratios** (higher is always better):
smaller-the-better S/N = −10·log(Σy²/n); larger-the-better S/N = −10·log(Σ(1/y²)/n); nominal-the-best S/N = 10·log(ȳ²/s²).
Example (4 measurements of Ra 0.82, 0.95, 0.88, 0.91 µm): smaller-the-better **1.00 dB**, nominal-the-best 24.22 dB.
**Parameter design:** control factors in an inner array, noise factors (temperature, material batch, wear) in an outer
array; choose control levels that maximise S/N (robustness), then use an adjustment factor to bring the mean to target.

### 31.7 Reliability-based design optimisation (RBDO)
Replace g(x) ≤ 0 with a fixed safety factor by **P[g(x, X) > 0] ≤ P_f,allow**, or equivalently reliability index
β ≥ β_target (β = −Φ⁻¹(P_f); P_f = 10⁻⁴ → β = 3.719).
Mean-value first-order (FOSM): β = (μ_S − μ_σ)/√(σ_S² + σ_σ²).
**Example 31-D – shaft in bending** (example values): M ~ N(400 N·m, COV 15 %), strength S ~ N(300, 20 MPa),
σ = 32M/(πd³).
- RBDO with β_t = 3.719 (P_f = 10⁻⁴): **d = 28.47 mm**.
- Deterministic SF = 2 on mean values: d = 30.06 mm → β = 4.98, P_f = 3·10⁻⁷ (over-safe here by 1.6 mm).
With a larger load scatter (COV 30 %) the same SF = 2 can become **unsafe** – the fixed SF does not see scatter.
Methods: double loop (reliability analysis inside each optimisation step – accurate, expensive), sequential (SORA:
shift constraints by the reliability analysis, then deterministic optimisation – fast). Tools: optiSLang (robustness +
reliability), MATLAB with Monte Carlo / FORM, Ansys DesignXplorer Six Sigma.

### 31.8 Tool mapping

| Task | Ansys | Abaqus | SOLIDWORKS | MATLAB / other |
|---|---|---|---|---|
| Topology | Structural Optimization (Topology Density, Level Set, Lattice), manufacturing constraints | Tosca Structure topology (ATOM) | Topology Study (Simulation Professional+) | Own SIMP code (top88.m by Andreassen et al.) |
| Shape | Shape optimisation / mesh morphing (Ansys Mechanical, RBF Morph add-on) | Tosca Structure shape / bead | – | – |
| Parameter / multi-objective | DesignXplorer, **optiSLang** | Isight | Design Study | `fmincon`, `gamultiobj`, `paretosearch` |
| Robust / reliability | optiSLang, DesignXplorer Six Sigma | Isight | – | Monte Carlo, FORM scripts |

### 31.9 Checklist / mistakes / references
Checklist: [ ] design and non-design space defined (bearing seats, bolt faces frozen) · [ ] all load cases incl.
fatigue-relevant ones · [ ] manufacturing constraints in the run · [ ] filter radius in mm ≥ minimum member · [ ] CAD
re-design re-analysed for stress, buckling, fatigue · [ ] Pareto knee chosen consciously · [ ] scatter data for RBDO.
Mistakes: one load case only (part fails in the other) · taking the voxel shape as final · ignoring stress (topology
optimises stiffness) · weighted sum with unscaled objectives · fixed SF for very different scatter.
References: Bendsøe & Sigmund, *Topology Optimization*, 2nd ed. (2003) · Andreassen et al., "Efficient topology
optimization in MATLAB using 88 lines of code", Struct. Multidisc. Optim. 43 (2011) · Mattheck, *Design in Nature* (1998)
· Taguchi, Chowdhury & Wu, *Taguchi's Quality Engineering Handbook* (2005) · Choi, Grandhi & Canfield,
*Reliability-based Structural Design* (2007).

---

## 32 Testing and validation

### 32.1 Test strategy – V-model and DVP&R
Each requirement (S0) gets a verification method: analysis, inspection, demonstration or **test**. Plan the tests early
in a **DVP&R** (Design Verification Plan & Report):

| Column | Example (crank train) |
|---|---|
| Requirement / spec | R04 life ≥ 20 000 h |
| Test / procedure | Endurance bench 1000 h at 1.1 × p_max + accelerated crankshaft test (32.6) |
| Acceptance criteria | No crack (MT inspection), wear ≤ 0.02 mm on pins |
| Sample size / level | 3 pumps (prototype), 2 crankshafts on resonance rig |
| Timing / responsible | Week 30, test lab |
| Result / status | (filled at the end) |
Order: component tests → subsystem → system → field. Each test has a **written prediction** before it runs (from S6).

### 32.2 Strain gauges in depth
**Principle.** Resistance change proportional to strain: **ΔR/R = k·ε** (gauge factor k ≈ 2.0 for constantan foil).
For ε = 500 µm/m (≈ 105 MPa in steel, σ = E·ε): ΔR/R = 0.001 → 0.12 Ω on a 120 Ω gauge – too small to read directly →
**Wheatstone bridge**.

Bridge output (all arms equal R, small strains): U_out/U_ex = (k/4)·(ε₁ − ε₂ + ε₃ − ε₄).

| Bridge | Active gauges | Output U_out/U_ex | Example (k = 2.0, ε = 500 µm/m, U_ex = 5 V) | Use |
|---|---|---|---|---|
| Quarter | 1 | k·ε/4 | **1.25 mV** | Single point; needs temperature-compensated gauge |
| Half (bending: top + bottom) | 2 (opposite strain) | k·ε/2 | **2.50 mV** | Bending, self-compensates temperature |
| Full (4 active) | 4 | k·ε | **5.00 mV** | Load cells, torque shafts (±45° gauges) |

**Temperature compensation:** self-compensated gauges (matched to steel α ≈ 11·10⁻⁶/K or Al ≈ 23·10⁻⁶/K); dummy gauge in
the adjacent arm; half / full bridges cancel temperature strain because it appears equally in adjacent arms.
**Lead-wire error:** 3-wire connection for quarter bridges; shunt calibration (known resistor) to check the whole chain.

**Rosette → principal stresses.** Rectangular rosette (0°/45°/90°, strains ε_a, ε_b, ε_c):
  ε₁,₂ = (ε_a + ε_c)/2 ± (1/√2)·√[(ε_a − ε_b)² + (ε_b − ε_c)²]
  tan 2θ = (2ε_b − ε_a − ε_c)/(ε_a − ε_c)  (θ from gauge a)
  σ₁ = E/(1 − ν²)·(ε₁ + νε₂), σ₂ = E/(1 − ν²)·(ε₂ + νε₁)
**Example 32-A:** ε_a = 600, ε_b = 200, ε_c = −100 µm/m, steel E = 210 GPa, ν = 0.3 → ε₁ = **603.6**, ε₂ = **−103.6** µm/m,
σ₁ = **132.1 MPa**, σ₂ = 17.9 MPa, θ = −4.1°, σ_vM = 124.1 MPa. Compare with FEA **at the gauge grid position and
averaged over the gauge length** (not the peak node), target ± 10–15 %.
Placement: at the predicted hot spot but ≥ 1–2 grid lengths away from the notch root if the gradient is steep (or use
a gauge chain and extrapolate).

### 32.3 Load cells, accelerometers and FFT basics
- **Load cells / torque sensors:** full-bridge strain gauges on a spring element; check rated load, combined loads,
  accuracy class; calibrate traceably (ISO 376 for force-proving instruments).
- **Accelerometers (IEPE / piezo):** sensitivity (mV/g), frequency range (mounting: stud > adhesive > magnet), mass
  ≤ 1/10 of the local structure mass.
- **Sampling:** f_s ≥ 2.56·f_max (anti-alias filter roll-off; Nyquist 2.0 is the theoretical minimum).
  Resolution **Δf = f_s/N**, record time T = N/f_s.
  **Example 32-B:** f_max = 2000 Hz → f_s = **5120 Hz**; N = 8192 → Δf = **0.625 Hz**, T = **1.60 s**, 3200 useful lines.
  Compressor 1st order at 1450 rpm = 24.17 Hz – resolved with 0.625 Hz lines.
- **Windows:** Hanning for continuous random / run-up signals; flat-top for exact amplitudes of sine components;
  force/exponential windows for impact tests; rectangular only for transients that fit in the record.

### 32.4 Modal testing (impact hammer)
1. Support free-free (soft bungees, rigid modes < 10–20 % of first elastic mode) or in the real mounting.
2. Measure points on a grid matching the FEA nodes; hammer tip chosen for the frequency range (hard tip = high f).
3. **FRF** H(f) = output/input; **H1 estimator** H₁ = G_xy/G_xx (cross spectrum / input auto spectrum; minimises output
   noise); average 3–5 hits; check **coherence** γ² > 0.9 near resonances.
4. Curve-fit modes (frequency, damping, shape) – Simcenter Testlab, MATLAB `modalfit`.
5. Correlate with FEA: frequency error ± 5 %, **MAC** = |φ_testᵀφ_FE|²/[(φ_testᵀφ_test)(φ_FEᵀφ_FE)] > 0.9 (guide 54 C61).

### 32.5 Endurance and accelerated testing
**Inverse power law (mechanical fatigue):** time factor = (S₂/S₁)^k. Example 32-C: stress amplitude 100 → 130 MPa, k = 8 →
**8.16 ×** shorter. **Arrhenius (temperature-driven ageing: oil, elastomer seals, electronics, insulation):**
  AF = exp[(E_a/k_B)·(1/T₁ − 1/T₂)], k_B = 8.617·10⁻⁵ eV/K.
Example 32-D: E_a = 0.7 eV (example – activation energies differ by failure mechanism; get E_a from data, not assumption),
use 40 °C, test 85 °C → AF = **26.0**: 1000 h test ≈ 26 000 h use at 40 °C for that mechanism.
**Rules:** the failure mode must stay the same (no yielding, no new mechanism, no lubricant break-down that would not
happen in the field); confirm with a few tests at use level.

### 32.6 Test-to-bogey and Weibull (Lipson) extension
**Success run (zero failures):** to show reliability R with confidence C: **n = ln(1 − C)/ln R**.
Example 32-E: R = 90 %, C = 90 % → n = **21.85 → 22 parts** without failure, each tested to the target life.
**Lipson extension:** test longer than the target, L = t_test/t_target, with Weibull slope β:
  n = ln(1 − C)/(L^β·ln R).
Example: L = 2, β = 2 (wear-out) → n = **5.46 → 6 parts**, each tested to 2 × target life. β must be known from similar
parts (fatigue of steel: β ≈ 1.5–3 typical; check own data).

**HALT / HASS:** HALT (Highly Accelerated Life Test) steps temperature and vibration until failure to find weak points
and margins (design phase); HASS screens production with stresses below HALT limits. Mainly electronics / mechatronics
(controllers, sensors on the compressor).

### 32.7 Compressor bench tests (product validation)

| Test | Standard | Measures | Notes |
|---|---|---|---|
| Free air delivery (FAD) and specific power | **ISO 1217** (displacement compressors acceptance tests) | Flow at inlet conditions, shaft / electric power, kW per m³/min | Nozzle or orifice method; reference inlet conditions; tolerances in Annex |
| Noise | **ISO 2151** (noise test code for compressors) with ISO 3744 / 3746 (sound power) | Sound power level L_WA, sound pressure at 1 m | Mounting and operating conditions defined by ISO 2151 |
| Endurance | Company spec (e.g. 1000 h at max pressure and temperature) | Wear, oil carry-over, valve breakage, temperatures | Inspect valves, rings, bearings after test |
| Thermal | Company spec | Discharge temperature, cylinder / head temperature | Thermocouples at defined points |
| Safety | EN 1012-1, pressure equipment rules | Safety valve function, guards, surface temperature | Notified body for tank (PED / SPVD) |
| Vibration | ISO 10816 / ISO 20816 (evaluation zones) | RMS velocity on feet / bearings | Compare with balancing calculation (crank item M2) |

### 32.8 Test report template and model updating
Report: purpose + requirement ID · specimen (serial, drawing revision, material certificate) · set-up photo + sketch ·
instrumentation (sensor type, serial, calibration date, uncertainty) · procedure · **prediction vs result table** ·
deviations · conclusion (pass / fail against the acceptance criterion) · raw data location.
**Model updating:** if FEA and test differ beyond the target, change *physically justified* parameters only (support
stiffness, contact, material E from coupon test, mass of added parts) – never "tune" E to 150 GPa to match. Use
sensitivity (∂f/∂p) to pick parameters; Simcenter 3D correlation, FEMtools, or MATLAB `fmincon` minimising the
frequency error.

### 32.9 Checklist / mistakes / references
Checklist: [ ] DVP&R with acceptance criteria · [ ] prediction written · [ ] sensors calibrated, uncertainty known ·
[ ] f_s ≥ 2.56 f_max, coherence > 0.9 · [ ] accelerated test keeps failure mode · [ ] sample size from success-run ·
[ ] report with raw data.
Mistakes: gauges at the wrong place or orientation · quarter bridge without temperature compensation · aliasing ·
magnet-mounted accelerometers above 2–3 kHz · accelerated test that creates a new failure mode · "1 test passed = proven".
References: Hoffmann, *An Introduction to Stress Analysis and Transducer Design using Strain Gauges* (HBM, 2012) ·
Ewins, *Modal Testing: Theory, Practice and Application*, 2nd ed. (2000) · Nelson, *Accelerated Testing* (2004) ·
O'Connor & Kleyner, *Practical Reliability Engineering*, 5th ed. (2012) · ISO 1217 · ISO 2151 · ISO 3744 · ISO 20816-1.

---

## 33 Release to manufacturing and quality

### 33.1 Design release package
| Content | Standard / format | Note |
|---|---|---|
| 3D model with PMI (MBD) | ISO 16792 (digital product definition), ISO 10303-242 (**STEP AP242**) | Semantic PMI so CAM / CMM can read tolerances |
| 2D drawings (if used) | ISO 128 (presentation), ISO 129-1 (dimensions), ISO 1101 (GD&T), ISO 8015, ISO 2768 / ISO 22081 (general tolerances) | Title block: material, heat treatment, surface, revision |
| BOM | Engineering BOM → manufacturing BOM (MES / ERP, guide 04) | Part number, revision, quantity, make / buy |
| Specifications | Material (EN 10083 etc.), heat treatment, coating, cleanliness, marking, packaging | Referenced on the drawing |
| Calculation + test reports | Sections 7.5, 32.8 | Archived with the release revision |
| Special characteristics list | From DFMEA / PFMEA | Marked on the drawing (e.g. ◆ critical, ▲ significant – company symbols) |

### 33.2 Design reviews
| Review | When | Focus |
|---|---|---|
| Concept review | After S3 | Requirements met by concept, risks |
| Preliminary design review (PDR) | After S4 | Layout, sizing, interfaces, make/buy |
| Critical design review (CDR) | After S5–S6 | Drawings, tolerances, calculations, DFM/DFA, test plan |
| Production readiness review | Before S9 release | Process capability, gauges, PPAP status |
Rule: reviewers who did **not** design the part; checklist-based; actions with owner and date.

### 33.3 Change management
- **ECR** (engineering change request): why, what, effect, cost. **ECN / ECO** (notice / order): approved change with
  effectivity (from serial number / date / lot).
- **Revision rules:** revision letter changes when form, fit or function or documentation change; **new part number**
  when the part is no longer **interchangeable** (old and new cannot be mixed in assembly or service).
- Update all linked data: 3D, drawing, BOM, CAM program, CMM program, control plan, PFMEA, spare parts.

### 33.4 APQP and PPAP
**APQP phases** (AIAG): 1 plan and define program · 2 product design and development · 3 process design and development ·
4 product and process validation · 5 feedback, assessment and corrective action.
**PPAP – 18 elements** (AIAG PPAP 4th ed.): 1 design records · 2 authorised engineering change documents · 3 customer
engineering approval · 4 design FMEA · 5 process flow diagram · 6 process FMEA · 7 control plan · 8 measurement system
analysis · 9 dimensional results · 10 material / performance test results · 11 initial process studies · 12 qualified
laboratory documentation · 13 appearance approval report · 14 sample production parts · 15 master sample ·
16 checking aids · 17 customer-specific requirements · 18 part submission warrant (PSW).
Even when no customer demands PPAP, use it as your own release checklist for bought and made parts.
**First article inspection (FAI):** 100 % of drawing characteristics measured on the first part(s) from the production
process (ballooned drawing, AS9102-style forms), plus material and special-process certificates.

### 33.5 PFMEA → control plan → special characteristics
PFMEA per process step: function, failure mode, effect (S), cause (O), current controls (D); AIAG-VDA (2019) uses
**action priority** H/M/L instead of RPN. The **control plan** lists for every characteristic: process step, machine,
characteristic, specification, measurement method, sample size and frequency, control method (SPC, 100 % check,
poka-yoke), reaction plan. Critical characteristics (safety, legal: e.g. tank weld, safety valve seat) need 100 % or
proven Cpk ≥ 1.67 and documented traceability.

### 33.6 SPC, process capability and measurement systems

**X̄–R chart** (subgroup size n = 5; constants for n = 5: **A₂ = 0.577, D₃ = 0, D₄ = 2.114, d₂ = 2.326** – standard
tabulated values, e.g. AIAG SPC manual / ISO 7870-2):
  UCL_X̄ = X̿ + A₂R̄, LCL_X̄ = X̿ − A₂R̄, UCL_R = D₄R̄, LCL_R = D₃R̄, σ̂ = R̄/d₂.
**Example 33-A** – bearing seat Ø30 mm, X̿ = 30.002 mm, R̄ = 0.010 mm → UCL_X̄ = **30.00777**, LCL_X̄ = **29.99623**,
UCL_R = **0.02114**, σ̂ = **0.00430 mm**. Out-of-control rules: point outside limits, 7 points on one side, trends (Western
Electric / Nelson rules).

**Capability:** Cp = (USL − LSL)/(6σ), **Cpk = min(USL − μ, μ − LSL)/(3σ)** (σ within subgroups; Pp / Ppk use the overall
standard deviation – long-term performance).
**Example 33-B:** spec 30 ± 0.02 mm, μ = 30.002, σ = 0.00430 → Cp = **1.55**, Cpk = **1.40**, expected **14 ppm** out of
tolerance (normal distribution). Targets: Cpk ≥ 1.33 normal, ≥ 1.67 for critical / new processes (PPAP initial study).

**Measurement system analysis (GR&R, AIAG MSA 4th ed.):** σ_GRR = √(σ_EV² + σ_AV²) (equipment = repeatability,
appraiser = reproducibility).
%GRR of tolerance = 6σ_GRR/T; %GRR of total variation = σ_GRR/σ_total; **ndc = 1.41·σ_PV/σ_GRR**.
**Example 33-C:** σ_EV = 0.0012, σ_AV = 0.0008 → σ_GRR = 0.00144 mm; tolerance 0.04 mm → **%GRR = 21.6 %** of tolerance
(10–30 % = conditionally acceptable), 30.5 % of total variation, part variation σ_PV = 0.0045 → **ndc = 4.4 → 4** (< 5:
the gauge cannot separate parts well enough for SPC) → use an air gauge or a better comparator for this seat.
Rule of thumb: gauge resolution ≤ 1/10 of the tolerance; decision rules per ISO 14253-1 (measurement uncertainty at the
limits).

### 33.7 Digital thread CAD → CAM → CMM
1. Released SOLIDWORKS / NX model with semantic PMI → **STEP AP242** (or native NX).
2. **NX CAM**: tool paths from the model; feature-based machining reads holes / tolerances; post-processor per machine;
   machine simulation / VERICUT (guide 54 C41).
3. **CMM programming from PMI** (e.g. PC-DMIS, Calypso, NX CMM Inspection): characteristics generated from the PMI,
   probe paths automatic; results in **QIF** (ISO 23952, Quality Information Framework) back to the model for
   comparison and SPC.
4. Results → SPC / MES (guide 06 / 45) → capability per characteristic → feedback to design tolerances.
Benefit: no re-typing of tolerances; one change in the model updates CAM and CMM (with change control 33.3).

### 33.8 Feedback loop – field data and problem solving
- **Field data:** warranty returns, service reports, test-bench data, twin data (failure modes, operating hours) →
  Weibull analysis (β, η) per failure mode → compare with the design prediction.
- **8D problem solving:** D1 team · D2 problem description (is / is-not) · D3 containment · D4 root cause (5-why,
  Ishikawa, verification) · D5 permanent corrective action · D6 implement + validate · D7 prevent recurrence (update
  FMEA, design rules, calculation programs) · D8 close and recognise the team.
- **Lessons-learned database and design rules:** every 8D, test failure and FEA-vs-test correlation adds one rule
  (example: "crank web fillet ≥ 2.5 mm, rolled; FEA support model: bearing as cosine load over 120°"). Rules feed
  the gate checklists (section 12) and the defaults of the calculation programs (M2–M12).

### 33.9 Checklist / mistakes / references
Checklist: [ ] release package complete (33.1) · [ ] reviews held with independent reviewers · [ ] change control with
interchangeability decision · [ ] PFMEA → control plan for all special characteristics · [ ] Cpk and %GRR of every
critical characteristic known · [ ] FAI passed · [ ] PMI flows to CAM and CMM · [ ] 8D and lessons learned linked to the
design rules.
Mistakes: revision change without checking interchangeability · CMM programs typed by hand from drawings · Cpk from 10
parts · gauge with ndc < 5 used for SPC · 8D closed without updating FMEA and design rules.
References: AIAG *APQP* 2nd ed. (2008) · AIAG *PPAP* 4th ed. (2006) · AIAG *SPC* 2nd ed. (2005) · AIAG *MSA* 4th ed. (2010) ·
AIAG-VDA *FMEA Handbook* (2019) · ISO 7870-2 (Shewhart control charts) · ISO 22514-2 (process capability) ·
ISO 14253-1 (decision rules) · ISO 10303-242 · ISO 23952 (QIF) · ISO 16792 · Montgomery, *Introduction to Statistical
Quality Control*, 8th ed. (2019).
