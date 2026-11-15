# M12 – Optimisation workflows: from CAD parameters through CAE solvers to a verified, manufacturable optimum (SOLIDWORKS · Ansys · Abaqus · Adams · MATLAB)

> Field 1 *Mechanical design*, item 12 – the last item of field 1.
> **Theory and program are combined:** every formula is followed by the code of `tools/optflow.py`, the command and
> the real output. Web: tab **M_P_C tools**, item 18. Python standard library only – offline.
> M1 (chapters 8, 29–31) explains the optimisation **algorithms**. M12 is about the **workflow**: how to connect your
> own tools (SOLIDWORKS, Ansys, Abaqus, Adams, MATLAB) in a loop that runs unattended, does not crash, uses few
> solver runs and gives a result you can trust and manufacture.
> Because there is no CAE software on this PC, `optflow.py` contains a small **virtual CAE solver** (beam finite
> elements, static and modal). It plays the role of Ansys / Abaqus so that every step of the loop runs for real. The
> exported scripts for your tools are **templates**: feature, parameter and result names must be adapted to your
> model and checked against your software version. All inputs are example values.

## Contents
0. How to use this guide with the program
1. Purpose – why a workflow, and the map of your toolchain
2. Formulating the problem and building a robust parametric model (variables, objectives, constraints, scaling; SOLIDWORKS equations, design tables, configurations, API)
3. Coupling the CAE solvers: the file-based loop, Ansys Workbench / APDL, Abaqus Python, Adams command files, MATLAB as orchestrator; cache, failures, licences
4. The virtual CAE and credibility: beam finite elements, eigenvalues, mesh convergence, verification, calibration of the model to measurements ("trend values" → reliable values)
5. Design of experiments and surrogate models: Latin hypercube, response surface, Kriging, validation, sensitivity
6. Optimisation strategies: direct vs surrogate, constraint handling, efficient global optimisation (expected improvement), multi-objective, discrete catalogue sizes, robust design
7. From the optimum to manufacturing: catalogue rounding, re-verification, tolerances, drawings, CAM, test plan, data management, the templates for your tools explained, checklist
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python optflow.py params` | Default problem as JSON (copy → edit → `--in`) |
| `python optflow.py run --in my.json --out res` | Complete workflow → `report.md`, `evaluations.csv` (every solver call), `templates/` (scripts for your tools with the optimum filled in) |
| `python optflow.py solve --in design.json --out result.txt` | The virtual CAE as a stand-alone external program: input file in, result file out – exactly how Ansys or Abaqus is called in batch |
| `python optflow.py export --out folder` | Writes the SOLIDWORKS / Ansys / Abaqus / Adams / MATLAB templates |
| `python optflow.py examples` | Default report, mesh convergence, calibration to a "measured" frame |
| `python optflow.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python optflow.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=18#mpc` | Runs the surrogate workflow: KPIs, convergence of the best mass over solver calls, DOE / infill points, cut through the optimum |

### 0.2 Program map – formula → function
| Chapter | Method | Function |
|---|---|---|
| 2 | Default problem: variables, bounds, limits; normalised constraints g ≤ 0 | `DEFAULT`, `constraints()` |
| 3 | Workflow engine (cache, log, failure handling, penalty), file-based coupling, external solver mode, templates | `Workflow`, `file_solver()`, `cmd_solve()`, `TEMPLATES`, `export_templates()` |
| 4 | Linear algebra (Gauss, Cholesky, Jacobi eigenvalues, generalised eigenproblem), RHS section, beam element stiffness and consistent mass, mesh, frame model, responses; calibration | `solve()`, `cholesky()`, `jacobi_eig()`, `gen_eig()`, `rhs_section()`, `beam_k()`, `beam_m()`, `mesh()`, `frame_fe()`, `responses()`, `calibrate()` |
| 5 | Latin hypercube, normalisation, quadratic response surface, Kriging (maximum likelihood), leave-one-out error | `lhs()`, `norm()`, `quad_terms()`, `rsm_fit()`, `Kriging`, `loo_error()` |
| 6 | Bounded Nelder–Mead with evaluation budget, multi-start, expected improvement, surrogate optimum, feasibility, EGO loop, direct reference search | `nelder_mead()`, `multistart()`, `phi()`, `Phi()`, `expected_improvement()`, `surrogate_models()`, `surrogate_optimum()`, `feasible()`, `ego()`, `direct()` |
| – | All results, report, evaluation log, templates | `summary()`, `report_text()`, `run()` |
| 2–4 | Normalised constraints and active set, formulation mistakes, scaling (raw vs normalised gradients), one-at-a-time screening, geometric feasibility / CAD rebuild check, SOLIDWORKS equations, design tables and COM API, Design Study; file-based loop, failure injection and penalty, log and restart, run-time budget with licences, Ansys Workbench / APDL template (BEAM188 / COMBIN14 / MASS21 modal), Abaqus Python template, Adams and MATLAB orchestration; Hermite shape functions and element matrices by Gauss integration, assembly and generalised eigenproblem, cantilever convergence, Rayleigh check, mesh study with GCI, remeshing noise and finite-difference gradients, smooth vs noisy optimisation, Gauss–Newton calibration, identifiability and measurement noise, MAC, impact modal test plan, V&V plan | `fa_constraint_table()`, `fa_scaling()`, `fa_screening()`, `fa_geometry_check()`, `fa_failing_solver()`, `fa_failure_demo()`, `fa_save_log()`, `fa_load_log()`, `fa_budget()`, `fa_apdl()`, `fa_abaqus()`, `fa_file_loop()`, `fa_hermite()`, `fa_hermite_dd()`, `fa_element_by_integration()`, `fa_cantilever()`, `fa_rayleigh()`, `fa_gci()`, `fa_noisy()`, `fa_fd_study()`, `fa_noisy_optimisation()`, `fa_model_freqs()`, `fa_calibrate_gn()`, `fa_calibration_noise()`, `fa_test_plan()`, `FA_MISTAKES`, `FA_GEOM`, `FA_SW_EQUATIONS`, `FA_SW_PY`, `FA_APDL`, `FA_ABAQUS`, `FA_VV` |
| 5–6 | Plans for computer experiments, maximin Latin hypercube, comparison of factorial / random / LHS / maximin LHS, 10·k rule, response-surface R² / adjusted R² and their trap, leave-one-out vs test set, error vs number of DOE points, Kriging derivation (correlation, maximum likelihood, prediction variance, θ as variable activity), first-order Sobol indices on the surrogate, screening; direct vs surrogate, exterior penalty and its 1/r violation, expected-improvement table, constrained EI and probability of feasibility, EGO convergence and stopping, Pareto front by the ε-constraint method with true checks, discrete catalogue heights, robust design (tolerance Monte Carlo on the true solver, worst-corner back-off, local refinement), verification on finer meshes, end-of-study checklist, MATLAB equivalents | `fb_min_dist()`, `fb_maximin_lhs()`, `fb_design_compare()`, `fb_r2()`, `fb_validation()`, `fb_testset()`, `fb_kriging_info()`, `fb_sobol()`, `fb_sur_obj()`, `fb_from_z()`, `fb_to_z()`, `fb_penalty_study()`, `fb_ei_table()`, `fb_final_ei()`, `fb_pareto()`, `fb_catalogue()`, `fb_perturbed()`, `fb_robust_mc()`, `fb_corner_factors()`, `fb_robust_design()`, `FB_KEYS`, `FB_CATALOGUE_H`, `FB_TOL` |
| 7–8 | Catalogue rounding with continuous re-tuning, real isolation mounts (stiffness, load rating, position re-tuned), mount loads and equilibrium, re-verification on finer meshes and margin policy, tolerance corners, robust enumeration with production measures, drawing data (cut list, welds, holes, NX CAM note), cost of frame variants, impact-hammer test plan and ±5 % acceptance, calibration loop after a deviating test, run manifest (input hash), APDL template, templates for SOLIDWORKS / Ansys / Abaqus / Adams / MATLAB explained, checklist, effort, failure modes; verification, worked example (ball-screw test-rig base frame), limits, references, glossary | `fc_section_P()`, `fc_catalogue()`, `fc_retune()`, `fc_catalogue_retuned()`, `fc_mount_load()`, `fc_select_mount()`, `fc_reverify()`, `fc_tolerance_corners()`, `fc_corners_ok()`, `fc_robust_search()`, `fc_cut_list()`, `fc_cost()`, `fc_test_plan()`, `fc_after_test()`, `fc_manifest()`, `fc_export_apdl()`, `fc_example()`, `FC_X_OPT`, `FC_RHS`, `FC_MOUNTS`, `FC_COST`, `FC_TOL`, `FC_TOL_PROD`, `FC_CROSS`, `FC_APDL`, `FC_CHECKLIST`, `FC_EFFORT`, `FC_FAILURES` |
Example input of chapter 8: `tools/examples/optflow_example.json`.

### 0.3 What the self-test proves
1. The beam elements give the free–free bending frequency (4.730²/(2πL²))·√(EI/ρA) of a beam to 0.1 % with 40 elements.
2. A rigid beam on springs has the bounce frequency √(Σk/m)/2π.
3. A simply supported beam deflects F·L³/(48·EI) under a central load.
4. The Latin hypercube has exactly one point in each stratum of each variable.
5. The response surface recovers an exact quadratic; Kriging interpolates its training points.
6. Nelder–Mead finds the minimum (1, 1) of the Rosenbrock function; EI(μ = f_min) = s/√(2π).
7. The file-based coupling (write input → run the external program → parse the result) gives exactly the numbers of a direct call.
8. The calibration recovers hidden stiffness factors (0.8 for the joints, 1.2 for the mounts) from "measured" frequencies.

## 1. Purpose – why a workflow, and the map of your toolchain

You already have the tools: SOLIDWORKS makes reliable geometry, Ansys / Abaqus / Adams give stresses, frequencies and
motions, MATLAB can drive anything. What is missing is the **loop**. Today a design change means: edit the CAD,
export, re-mesh, re-run, copy numbers into a spreadsheet, decide. That is slow, so only two or three variants are
ever looked at, and the CAE numbers stay "trend values" because nobody checked them against a test.

An optimisation workflow does four things:

| Step | What it gives | Chapter |
|---|---|---|
| Formulate | A clear question: which variables, which objective, which limits, in which units | 2 |
| Automate | CAD → CAE → results without a person in the loop, robust against crashes | 3 |
| Make it credible | A verified solver (mesh, theory), **calibrated to a test** – trend values become reliable values | 4 |
| Search efficiently | DOE + surrogate + infill: the optimum with tens, not thousands, of solver runs | 5, 6 |
| Make it real | Round to catalogue sizes, re-check, draw, make, test | 7 |

Your toolchain and where each tool sits in the loop:

| Tool | Role in the loop | Interface used here |
|---|---|---|
| SOLIDWORKS | Parametric geometry, mass properties, export (STEP / Parasolid) | design table (CSV / Excel), VBA / API macro |
| SOLIDWORKS Simulation / Motion | Quick linear FE / motion, built-in "Design Study" | design study (small problems) |
| Ansys Workbench / Mechanical / APDL | FE: static, modal, harmonic, fatigue | Workbench parameters + journal (`RunWB2 -B`), APDL macro |
| Abaqus | FE incl. contact and non-linear material | Python script (`abaqus cae noGUI=`), result database (ODB) |
| Adams | Multibody motion, loads on joints | command file (`.cmd`), design variables, Adams Insight |
| MATLAB | Orchestrator, optimiser (`fmincon`, `surrogateopt`, `ga`), post-processing | `system()` calls + file exchange |
| `optflow.py` (this guide) | The same loop in Python, offline, with a virtual CAE | `Workflow`, `file_solver()` |

**Default problem** (`python optflow.py examples`): the 2.5 m base frame of the compressor package of M11
(compressor 120 kg, motor 30 kg, receiver with fittings 65 kg) on four isolation mounts. M11 showed that this frame
can come close to the 24 Hz compressor order. Two RHS beams h × 60 × 4.

- **Variables:** RHS height h (60 … 160 mm), mount position a from the ends (50 … 600 mm), mount stiffness k (20 … 400 N/mm each).
- **Objective:** minimum beam mass.
- **Limits:** mount modes ≤ 10 Hz (isolation of the 24.1 Hz order), first bending mode ≥ 60.3 Hz (1.25 × the 48.2 Hz order), static sag on the mounts ≤ 6 mm, stress ≤ 100 MPa.

| Result | Value |
|---|---|
| Current design h 100, a 300, k 120 | 47.73 kg; mount modes 6.66 / 9.87 Hz, bending 76.4 Hz, sag 5.37 mm – feasible but heavy |
| Surrogate workflow (LHS 20 + Kriging + 12 infill iterations) | **h 79.2 mm, a 233.6 mm, k 105.5 N/mm → 41.20 kg (−13.7 %)** in **44 solver calls** (found at iteration 3); two limits active: mount mode 10.00 Hz, bending 60.3 Hz; sag 5.96 mm just inside |
| Direct search on the solver (multi-start Nelder–Mead, penalty) | 40.76 kg but **infeasible** (59.3 Hz < 60.3 Hz) after **764 solver calls** – the penalty method stops slightly outside the limits |
| Mesh convergence | 4 → 32 elements change the bending frequency by 0.01 % |
| Calibration | from three "measured" frequencies the program finds the hidden joint factor 0.75 and mount factor 1.15 exactly |

With a real Ansys model at 5 minutes per run, the surrogate workflow needs about 4 hours, the direct search about
64 hours – and still gives a design that violates a limit.


---

## 2. Formulating the problem and building a robust parametric model

An optimiser does exactly what the formulation says – nothing more. Most "the optimisation did not work" stories are
formulation errors, not algorithm errors. This chapter turns the engineering question "make the frame lighter without
resonance" into a mathematical problem, and shows how to build a CAD model that survives hundreds of automatic changes.

### 2.1 The three parts of every optimisation problem

```
minimise      f(x)                      objective (one number)
subject to    g_j(x) <= 0,  j = 1 … m   inequality constraints (limits)
              x_i,min <= x_i <= x_i,max design-variable bounds
```

| Part | Default frame | Rule |
|---|---|---|
| Design variables x | h (RHS height), a (mount position), k (mount stiffness) | only what you are really free to change; each must influence something |
| Objective f | beam mass in kg | one quantity; cost if you can model it, otherwise mass as its proxy |
| Constraints g | mount modes ≤ 10 Hz, bending mode ≥ 60.3 Hz, sag ≤ 6 mm, stress ≤ 100 MPa | every requirement that is not the objective becomes a limit |
| Bounds | h 60 … 160 mm, a 50 … 600 mm, k 20 … 400 N/mm | from catalogue, geometry and supplier ranges |

**Normalised constraints.** Every limit is written so that g ≤ 0 means "satisfied" and g has no unit:

```
upper limit:  g = value / limit − 1       (f_rigid ≤ 10 Hz  →  g = f_rigid / 10 − 1)
lower limit:  g = 1 − value / limit       (f_bend ≥ 60.3 Hz →  g = 1 − f_bend / 60.3)
```

Then g = −0.10 always means "10 % margin", whether the quantity is Hz, mm or MPa. The core function:

```python
def constraints(P, R):
    """g <= 0 means satisfied (normalised)."""
    lim = P["limits"]
    return {"f_rigid": R["f_rigid"] / lim["f_rigid_max"] - 1, "f_bend": 1 - R["f_bend"] / lim["f_bend_min"],
            "sag": R["sag"] / lim["sag_max"] - 1, "sigma": R["sigma"] / lim["sigma_max"] - 1}
```

The add-on prints the constraint table of the current design (`python optflow.py ch24`):

```python
def fa_constraint_table(P, x):
    """Raw response, limit, normalised g = value / limit - 1 (or 1 - value / limit for lower limits), state."""
    R = responses(P, x)
    g = constraints(P, R)
    lim = P["limits"]
    rows = [("f_rigid", R["f_rigid"], "<=", lim["f_rigid_max"], g["f_rigid"]), ("f_bend", R["f_bend"], ">=", lim["f_bend_min"], g["f_bend"]),
            ("sag", R["sag"], "<=", lim["sag_max"], g["sag"]), ("sigma", R["sigma"], "<=", lim["sigma_max"], g["sigma"])]
    return [(n, v, op, l, gv, "active" if abs(gv) < 0.02 else ("violated" if gv > 0 else "inactive")) for n, v, op, l, gv in rows]
```

```
## 2.1 Formulation of the default problem (normalised constraints g <= 0)
  f_rigid      9.871 <=   10.00 -> g -0.013  active
  f_bend      76.418 >=   60.30 -> g -0.267  inactive
  sag          5.370 <=    6.00 -> g -0.105  inactive
  sigma       10.771 <=  100.00 -> g -0.892  inactive
```

A constraint with |g| < 0.02 is called **active**: the optimum will usually sit on active constraints. The current
design already uses the isolation limit (f_rigid 9.87 Hz, g = −0.013); the bending mode has 27 % margin and the
stress 89 % margin – this is where mass can be saved.

**Which objective – mass or cost?** Mass is easy to compute and usually proportional to material cost. But cost is
what the company pays. For a welded frame, cost ≈ material + welding + machining + coating; a lighter RHS with
thinner walls may need more welding preparation. In this guide the objective is mass; chapter 7 discusses when to
change it to a cost model (M1 ch. 22 has the cost estimation).

### 2.2 Common formulation mistakes

```
## 2.2 Common formulation mistakes
  - objective = sum of unlike quantities (kg + Hz): optimiser trades kg against Hz at an arbitrary rate -> one objective, the rest as constraints g <= 0
  - constraints in raw units (Hz, mm, MPa): penalty dominated by the largest number -> normalise: g = value / limit - 1
  - bounds too narrow: optimum sits on a bound; real optimum outside -> check active bounds; widen and re-run
  - bounds too wide (geometry impossible): CAD rebuild fails, mesher crashes -> geometric feasibility check before the solver
  - discrete size treated as continuous and rounded at the end: rounded design violates a limit -> re-verify after rounding or optimise on the catalogue
  - equality constraint f = 60.3 Hz: feasible set is a thin surface; optimisers struggle -> use an inequality f >= 60.3 Hz
  - objective insensitive to a variable: variable drifts, wasted runs -> screen first; freeze unimportant variables
  - limits without margin for model error: optimum on the edge of a wrong model -> calibrate the model or add a margin (chapter 4)
```

### 2.3 Scaling – why the optimiser must work in [0, 1]

The three variables have very different units and ranges: h in mm (range 100), a in mm (range 550), k in N/mm
(range 380). A gradient in raw units mixes these units. The add-on computes the finite-difference gradient of the
bending frequency in raw units and per full range:

```
d f / d x_i (raw)           = [f(x + Δ e_i) − f(x)] / Δ
d f / d z_i (normalised)    = d f / d x_i · (x_i,max − x_i,min),     z_i = (x_i − x_i,min) / (x_i,max − x_i,min)
```

```python
def fa_scaling(P, x, rel=1e-3):
    """Finite-difference gradient of f_bend in raw units (per mm, per N/mm) and per normalised unit (per full range):
    raw gradients differ by orders of magnitude, normalised ones are comparable -> optimisers work in [0, 1]."""
    lo, hi = [v[1] for v in P["vars"]], [v[2] for v in P["vars"]]
    R0 = responses(P, x)["f_bend"]
    out = []
    for i, (l, u) in enumerate(zip(lo, hi)):
        d = rel * (u - l)
        xp = list(x)
        xp[i] += d
        g_raw = (responses(P, xp)["f_bend"] - R0) / d
        out.append((P["vars"][i][0], P["vars"][i][3], g_raw, g_raw * (u - l)))
    return out
```

```
## 2.3 Scaling: gradient of f_bend in raw and in normalised units
  h : d f_bend / d h = +0.79757 Hz per mm,  per full range  +79.757 Hz
  a : d f_bend / d a = -0.00526 Hz per mm,  per full range   -2.894 Hz
  k : d f_bend / d k = +0.00645 Hz per N/mm,  per full range   +2.449 Hz
```

Read it like this: the raw gradients differ by a factor 150 (0.80 Hz/mm against 0.005 Hz/mm), but this comparison is
meaningless because a millimetre of h and a millimetre of a are not equally "large" changes. Per full range, h is
30 times more important for the bending frequency than a or k. All optimisers in `optflow.py` therefore work in the
normalised space z ∈ [0, 1]³ (`norm()`, and the transformations inside `direct()` and `surrogate_optimum()`).
Without scaling, Nelder–Mead or a gradient method takes steps that are far too big in one direction and far too
small in another (the "ill-conditioned valley" of M1 §29.3).

### 2.4 Screening – which variable does what?

Before an expensive optimisation, change one variable at a time to its bounds (2·n + 1 = 7 solver runs):

```python
def fa_screening(P, x):
    """One-at-a-time screening: each variable at its lower and upper bound, others at the current design."""
    rows = []
    base = responses(P, x)
    for i, v in enumerate(P["vars"]):
        for side, val in (("low", v[1]), ("high", v[2])):
            xx = list(x)
            xx[i] = val
            R = responses(P, xx)
            rows.append((v[0], side, val, R["mass_kg"], R["f_rigid"], R["f_bend"], R["sag"], R["sigma"]))
    return base, rows
```

```
## 2.4 One-at-a-time screening around the current design
  base          mass 47.73 kg, f_rigid 9.87, f_bend 76.4 Hz, sag 5.37 mm, sigma 10.8 MPa
  h low    60.0  mass 35.17 kg, f_rigid 10.14, f_bend   45.1 Hz, sag  5.11 mm, sigma  21.4 MPa
  h high  160.0  mass 66.57 kg, f_rigid  9.47, f_bend  124.9 Hz, sag  5.75 mm, sigma   5.7 MPa
  a low    50.0  mass 47.73 kg, f_rigid 12.27, f_bend   78.3 Hz, sag  5.37 mm, sigma  18.9 MPa
  a high  600.0  mass 47.73 kg, f_rigid  7.28, f_bend   75.7 Hz, sag  5.37 mm, sigma   3.0 MPa
  k low    20.0  mass 47.73 kg, f_rigid  4.03, f_bend   75.8 Hz, sag 32.22 mm, sigma  10.8 MPa
  k high  400.0  mass 47.73 kg, f_rigid 17.95, f_bend   78.2 Hz, sag  1.61 mm, sigma  10.8 MPa
```

What the screening tells you before any optimisation:

- **h** drives mass and bending frequency (45 … 125 Hz). The bending limit 60.3 Hz will decide h.
- **a** (mount position) hardly changes mass or bending frequency, but strongly changes the mount pitch mode
  (7.3 … 12.3 Hz) and the stress (3 … 19 MPa): mounts near the ends give a stiff pitching mode.
- **k** (mount stiffness) decides isolation and sag: soft mounts isolate (4 Hz) but sag 32 mm; stiff mounts sag
  1.6 mm but the mount mode rises to 18 Hz – almost on the 24.1 Hz order.
- The **objective depends only on h**; a and k are there to make the constraints work. Such a problem has its
  optimum where the constraints that involve h (bending) and the ones that involve a and k (isolation, sag) are all
  just active – exactly what the optimisers will find (chapter 6).

### 2.5 A robust parametric model in SOLIDWORKS

The CAD model is the first "solver" in the loop. It must rebuild for **every** combination of variables inside the
bounds, without a person clicking on error messages.

| Technique | What to do | Why |
|---|---|---|
| Design intent | Dimension from functional datums (frame end, centre line), not from other edges that may disappear | a change of h must not move the mount hole pattern |
| Fully defined sketches | Every sketch black (fully defined); relations instead of "nearly horizontal" | under-defined sketches jump to strange shapes when a value changes |
| Global variables + equations | The design variables live in **Tools → Equations** as global variables; dimensions refer to them | one place to change; API and design tables write only these |
| Named dimensions | Rename `D1@Sketch1` to e.g. `h@Sketch_RHS`; name features | scripts address dimensions by name – default names change when features are re-ordered |
| Design tables / configurations | Excel table with one row per configuration (DOE points) | quick way to make 10–30 variants without API code |
| Reference geometry | Planes and axes for mounts and masses at parametric positions | CAE load / spring locations follow the geometry automatically |
| Weldments | Structural members from a profile library (RHS h × 60 × 4) | profile size becomes a configuration parameter; cut list gives the mass |
| Mass properties | Use the measured densities and add purchased parts as point masses | the CAD mass is the objective – it must be right |
| Rebuild check | After every change: `EditRebuild3` returns False on errors → report "failed" | a silent rebuild error gives a wrong geometry and a wrong optimum |

Global variables and equations for the frame:

```
## 2.6 SOLIDWORKS equations (global variables drive the dimensions)
"h" = 100                                  ' global variable (design variable 1)
"a" = 300                                  ' global variable (design variable 2)
"D1@Sketch_RHS" = "h"                     ' RHS profile height
"D2@Sketch_RHS" = 60                       ' RHS width (fixed)
"D1@Sketch_Mount" = "a"                   ' mount position from the frame end
"D1@Pattern_Mount" = 2500 - 2 * "a"       ' distance between the two mount positions
"Wall@Shell1" = 4
```

**Geometric feasibility before the solver.** Some variable combinations inside the bounds are impossible: a wall
thicker than half the profile height, a mount pad outside the frame, two mount positions that cross. The CAD rebuild
fails, or worse, it rebuilds into a wrong shape. A cheap check before the CAD and CAE call saves time and gives the
optimiser a clear "infeasible" answer instead of a crash:

```python
FA_GEOM = {"r_out_per_t": 2.0, "pad": 100.0, "end_plate": 20.0, "clear": 30.0}   # RHS corner radius / t, mount pad width, end plate, clearance mm (check)

def fa_geometry_check(P, x):
    """Geometric feasibility BEFORE the solver (what a CAD rebuild would reject): the RHS must have a flat web between
    the corner radii, the mount pad must fit between end plate and the first load, the mounts must not cross."""
    h, a, k = x
    t, b = P["t"], P["b"]
    r = FA_GEOM["r_out_per_t"] * t
    first_load = min(m[0] for m in P["masses"])
    checks = {"flat web h - 2 r_out > 0": h - 2 * r > 0, "flat flange b - 2 r_out > 0": b - 2 * r > 0,
              "pad inside the frame": a - FA_GEOM["pad"] / 2 >= FA_GEOM["end_plate"],
              "pad clear of the first load": a + FA_GEOM["pad"] / 2 + FA_GEOM["clear"] <= first_load or a >= first_load,
              "mounts do not cross (a < L/2)": a < P["L"] / 2 - FA_GEOM["pad"] / 2}
    return checks
```

```
## 2.5 Geometric feasibility before the solver (CAD rebuild check)
  h 100.0 a 300.0: OK
  h  60.0 a 300.0: OK
  h 100.0 a  40.0: REJECT (pad inside the frame)
  h 100.0 a 560.0: REJECT (pad clear of the first load)
  h  15.0 a 300.0: REJECT (flat web h - 2 r_out > 0)
```

The third design (a = 40) lies below the variable bound anyway and is also rejected by the pad check. The fourth
(a = 560) is inside the bounds but geometrically wrong: its mount pad would sit under the compressor feet at 600 mm.
The fifth (h = 15) has no flat web left between the corner radii – the CAD profile cannot be built. In a real workflow such a design gets the penalty value of
a failed run (chapter 3.3) **without** calling the CAE solver.

### 2.6 The SOLIDWORKS API – driving the CAD from a script

Design tables are enough for a fixed DOE. For an optimisation loop the CAD must be changed by a program. SOLIDWORKS
exposes its API through COM, so VBA macros, C#, MATLAB (`actxserver('SldWorks.Application')`) and Python
(`pywin32`) can all drive it. A minimal Python driver:

```
## 2.7 SOLIDWORKS driven from Python (COM)
# Python driving SOLIDWORKS through COM (pywin32; template - check the API calls for your version)
import win32com.client as w32
sw = w32.Dispatch("SldWorks.Application")
model = sw.ActiveDoc
eqm = model.GetEquationMgr
def set_var(name, value):                     # change a global variable in the equation manager
    for i in range(eqm.GetCount):
        if eqm.Equation(i).startswith('"%s"' % name):
            eqm.Equation(i, '"%s" = %g' % (name, value))
for h in (80, 100, 120):
    set_var("h", h); set_var("a", 300)
    ok = model.EditRebuild3()                 # False = rebuild error -> report as failed design
    mass = model.Extension.CreateMassProperty().Mass if ok else None
    model.Extension.SaveAs("C:/work/frame_h%d.x_t" % h, 0, 1, None, 0, 0)   # Parasolid for the CAE tool
    print(h, ok, mass)
```

Practical points (check for your SOLIDWORKS version):

- Run SOLIDWORKS **visible** while developing, invisible (`sw.Visible = False`) in production; one licence is used per
  session.
- Always check the rebuild result and the mass (a negative or zero mass means the geometry broke).
- Export a **neutral file** (Parasolid `.x_t` or STEP) for the CAE tool, or keep the associative link (SOLIDWORKS →
  Ansys Workbench with the CAD plug-in; the parameter must be marked as "DS_" or published to Workbench).
- Close and re-open the document every few hundred iterations – long COM sessions leak memory.

### 2.7 SOLIDWORKS Simulation "Design Study" – when is it enough?

SOLIDWORKS Simulation has a built-in **Design Study** (parameters → linear static / frequency study → goal and
constraints). It is enough when:

- the analysis is linear static, frequency or buckling and the SOLIDWORKS mesher is adequate;
- there are only 1–3 variables with a few discrete values each (it evaluates a grid, it does not do surrogates);
- you do not need Ansys / Abaqus physics (contact, non-linear material, explicit, fatigue to FKM).

For anything larger use the workflow of chapters 3–6: SOLIDWORKS for geometry, Ansys / Abaqus for physics, MATLAB or
`optflow.py` for the search.

---

## 3. Coupling the CAE solvers: the loop that runs unattended

### 3.1 The file-based loop

Every CAE program can be driven in batch mode with files. The pattern is always the same:

```
x  →  [write input file from a template]  →  [run the solver: command line, wait, return code]
   →  [parse the result file: regular expressions]  →  responses R(x)
```

`optflow.py` implements this with its own virtual CAE as the "external program" (`python optflow.py solve`):

```python
def file_solver(P, workdir, cmd=None):
    """File-based coupling as used with any external CAE program: write the input from a template, run a command,
    parse the result file with regular expressions. Default command: this program's own 'solve' (offline demo)."""
    os.makedirs(workdir, exist_ok=True)
    me = os.path.abspath(__file__)
    def solver(x):
        inp, out = os.path.join(workdir, "design.json"), os.path.join(workdir, "result.txt")
        with open(inp, "w", encoding="utf-8") as f:
            json.dump(dict(P, x=x), f)
        c = cmd or [sys.executable, me, "solve", "--in", inp, "--out", out]
        subprocess.run(c, check=True, capture_output=True, timeout=120)
        txt = open(out, encoding="utf-8").read()
        get = lambda name: float(re.search(r"^%s\s*=\s*([-+0-9.eE]+)" % name, txt, re.M).group(1))
        return {"mass_kg": get("MASS"), "f_rigid": get("F_RIGID"), "f_bend": get("F_BEND"), "sag": get("SAG"), "sigma": get("SIGMA"),
                "f": [get("F1"), get("F2"), get("F3"), get("F4")]}
    return solver
```

What goes out and what comes back for the current design (`fa_file_loop()`):

```
## 3.1 One call through the file interface
  input file keys: E, F_shake, L, b, direct_budget, doe_n, dyn, ego_iter, f_exc, limits, masses, n_el, name, rho, seed, starts, t, vars, x, x0
  x = [100.0, 300.0, 120.0]
  result file:
    MASS = 47.728
    F_RIGID = 9.87052024
    F_BEND = 76.4177201
    SAG = 5.36950348
    SIGMA = 10.7705666
    F1 = 6.65731124
    F2 = 9.87052024
    F3 = 76.4177201
    F4 = 215.052869
```

The self-test (item 7) proves that this path gives exactly the numbers of a direct function call. To couple a real
solver you replace three things: the template (Ansys journal, APDL macro, Abaqus script), the command
(`RunWB2.exe -B -R …`, `ansys… -b -i … -o …`, `abaqus cae noGUI=…`) and the regular expressions of the result file.

Details that decide whether the loop survives a night:

| Item | Good practice |
|---|---|
| Working directory | one folder per run (`run_0001/`), never overwrite; keeps inputs, logs and results for later checks |
| Timeout | `subprocess.run(..., timeout=...)` – a hanging mesher must be killed (default 120 s here; for Ansys 2–3 × the normal run time) |
| Return code | `check=True`: non-zero exit = failure; also check that the result file exists and is newer than the input |
| Parsing | match by name (`F_BEND = …`), never by line number; fail loudly if a value is missing |
| Units | write the units into the template and the result file; one unit system (N, mm, t, s here) |
| Licence | the run fails if no licence token is free – treat like a crash and retry later |
| Log | one line per run in a CSV (variables, responses, error text) – the basis of restart and of chapter 5 |

### 3.2 Failures are normal – the workflow must not stop

In real projects 2–10 % of CAE runs fail: the mesher cannot mesh a thin sliver, the CAD rebuild breaks, a licence
is lost, the solver diverges. The `Workflow` class catches every exception, stores `None` for that point and the
penalised objective returns a large value (1e8) so the optimiser simply avoids that region:

```python
class Workflow:
    """Evaluation engine: bounds, cache (no point is solved twice), log of every call, failure -> None."""
    def __init__(self, P, solver=None, log=None):
        self.P, self.solver = P, solver or (lambda x: responses(P, x))
        self.cache, self.log, self.calls, self.fails = {}, log, 0, 0
        self.lo = [v[1] for v in P["vars"]]
        self.hi = [v[2] for v in P["vars"]]

    def key(self, x):
        return tuple(round(v, 6) for v in x)

    def evaluate(self, x):
        k = self.key(x)
        if k in self.cache:
            return self.cache[k]
        self.calls += 1
        try:
            R = self.solver(list(x))
        except Exception as ex:                       # a crashed CAE run must not stop the optimisation
            self.fails += 1
            R = None
            err = str(ex)
        self.cache[k] = R
        if self.log is not None:
            self.log.append({"x": list(k), "R": R, "err": None if R else err})
        return R

    def penalised(self, x, r=1e3):
        """Objective with exterior penalty; out of bounds or failed -> large value."""
        if any(v < l - 1e-9 or v > u + 1e-9 for v, l, u in zip(x, self.lo, self.hi)):
            return 1e9
        R = self.evaluate(x)
        if R is None:
            return 1e8
        g = constraints(self.P, R)
        return R["mass_kg"] + r * sum(max(0.0, v) ** 2 for v in g.values())
```

The add-on injects a solver that crashes on every fourth call:

```python
def fa_failing_solver(P, every=4):
    """Solver that crashes on every 'every'-th call (licence lost, mesher failure) - the workflow must survive."""
    n = [0]
    def s(x):
        n[0] += 1
        if n[0] % every == 0:
            raise RuntimeError("solver crash (simulated): mesh failure")
        return responses(P, x)
    return s
```

```
## 3.2 Failure handling: every 4th solver call crashes
  12 solver calls, 3 failures; penalised objective of the 12 DOE points:
  617, 76.59, 718.1, 1e+08, 89.1, 61.07, 404.1, 1e+08, 135.3, 756.4, 7412, 1e+08
```

Three of twelve runs failed; the DOE continued and the failed points carry the value 1e8. A surrogate model
(chapter 5) is simply fitted to the successful points only – `ego()` filters `R is not None`.

### 3.3 Cache, log and restart

Two rules save a lot of solver time:

1. **Never solve the same point twice** – the cache key is the rounded variable vector (`Workflow.key()`).
   Optimisers like Nelder–Mead re-visit points after a shrink step; surrogate loops re-evaluate the DOE when restarted.
2. **Write every run to a log and be able to restart from it** – a power cut at run 180 of 200 must not cost
   180 runs.

```python
def fa_load_log(wf, path):
    """Restart: fill the cache of a new workflow from the CSV log -> already solved points cost nothing."""
    n = 0
    for line in open(path, encoding="utf-8").read().splitlines()[1:]:
        c = line.split(",")
        x = [float(v) for v in c[:3]]
        R = None if c[3] == "" else dict(zip(("mass_kg", "f_rigid", "f_bend", "sag", "sigma"), (float(v) for v in c[3:8])))
        if R is not None:
            wf.cache[wf.key(x)] = R
            n += 1
    return n
```

```
## 3.3 Log and restart
  log has 12 lines, 9 successful points loaded into the cache; re-running the same DOE costs 3 new solver calls (only the 3 failed points)
```

### 3.4 How long will it take? – the run-time budget

```
wall-clock time  =  N_runs · (t_solve + t_CAD/mesh) / min(parallel jobs, licence tokens)
```

```python
def fa_budget(t_run_min, calls, parallel=1, licences=1, overhead_min=1.0):
    """Wall-clock hours: calls x (solve + CAD/mesh overhead) / min(parallel jobs, licences)."""
    return calls * (t_run_min + overhead_min) / max(1, min(parallel, licences)) / 60
```

```
## 3.4 Run-time budget (wall-clock hours)
    5 min per run,   44 runs, 1 parallel, 1 licences ->    4.4 h
    5 min per run,  764 runs, 1 parallel, 1 licences ->   76.4 h
   30 min per run,   44 runs, 1 parallel, 1 licences ->   22.7 h
   30 min per run,   44 runs, 4 parallel, 2 licences ->   11.4 h
   30 min per run,  764 runs, 4 parallel, 2 licences ->  197.4 h
```

This table is the strongest argument for the surrogate workflow of chapters 5–6: with a 5-minute Ansys run the 44
runs of the surrogate loop take an afternoon, the 764 runs of the direct search more than three days – and the direct
search still ended slightly outside the limits (chapter 1). Parallel runs help only as far as licence tokens allow:
four parallel jobs with two Ansys licences halve, not quarter, the time. Ansys HPC packs or Abaqus tokens decide
this – ask your licence administrator before planning a big study.

### 3.5 Ansys: Workbench parameters and APDL

**Workbench route.** Mark the CAD dimensions (from SOLIDWORKS: prefix `DS_` or publish them) and the results
(maximum stress, frequency 1…6, mass) as **parameters** (the "P" check boxes). They appear in the Parameter Set.
The journal exported by `python optflow.py export` (`ansys_workbench_update.py`) sets P1…P3, calls `Update()` and
writes P4…P7 to `result.txt`. Run it without the GUI: `RunWB2.exe -B -R ansys_workbench_update.py` (check the
executable name and path of your version). Workbench also has its own optimiser (DesignXplorer: DOE, response
surface, MOGA); it is good for a first study inside one project. Newer Ansys versions offer a Python API
(PyAnsys: PyMechanical, PyMAPDL) that replaces journals – the loop logic stays the same.

**APDL route.** For a beam frame, a short APDL macro is faster and fully transparent. The add-on writes the macro
with the numbers of the current design: BEAM188 elements with an arbitrary section (ASEC) that carries the area and
second moment of the RHS pair, COMBIN14 springs for the mounts, MASS21 point masses, Block Lanczos modal analysis and
the first four frequencies written to `result.txt`:

```python
def fa_apdl(P, x, n_el=25):
    """Fill the APDL template with the frame data: nodes every L/n_el (masses and mounts snapped to the nearest node)."""
    h, a, k = x
    A, I, _ = rhs_section(h, P["b"], P["t"])
    J = 2 * (2 * ((P["b"] - P["t"]) * (h - P["t"])) ** 2 * P["t"] / (P["b"] + h - 2 * P["t"]))   # Bredt, two tubes
    nn = n_el + 1
    node = lambda xx: int(round(xx / P["L"] * n_el)) + 1
    mreal = "\n".join("R,%d,%.6g" % (10 + i, m) for i, (_, m) in enumerate(P["masses"]))
    mel = "\n".join("TYPE,3  $  REAL,%d  $  E,%d" % (10 + i, node(xx)) for i, (xx, _) in enumerate(P["masses"]))
    spr = "\n".join("N,%d,%.3f,-100  $  TYPE,2  $  REAL,2  $  E,%d,%d  $  D,%d,ALL,0" % (1000 + j, s, node(s), 1000 + j, 1000 + j)
                    for j, s in enumerate((a, P["L"] - a)))
    t = FA_APDL
    for kk, v in {"L": "%.1f" % P["L"], "A2": "%.1f" % (2 * A), "I2": "%.6g" % (2 * I), "J2": "%.6g" % J, "KM": "%.3f" % (2 * k),
                  "NN": nn, "NE": n_el, "MASSREALS": mreal, "MASSELS": mel, "SPRINGS": spr}.items():
        t = t.replace("{%s}" % kk, str(v))
    return t
```

```
## 3.5 APDL macro for the frame (current design)
! APDL macro: compressor base frame (2-D equivalent of the two RHS beams), modal + static (template - check)
! units N, mm, t, s   |  run:  ansys2024R1 -b -i frame.mac -o frame.out
/PREP7
L = 2500.0  $  A2 = 2432.0  $  I2 = 3.25137e+06  $  J2 = 3.04225e+06  $  KM = 240.000
ET,1,BEAM188                       ! beam (3-D element, kept in the XY plane)
SECTYPE,1,BEAM,ASEC                ! arbitrary section = the pair of RHS beams
SECDATA,A2,I2,0,I2,0,J2
MP,EX,1,210000  $  MP,PRXY,1,0.3  $  MP,DENS,1,7.85e-9
ET,2,COMBIN14  $  KEYOPT,2,2,2  $  R,2,KM          ! vertical spring per mount position (2 mounts)
ET,3,MASS21  $  KEYOPT,3,3,4                         ! 2-D point mass without rotary inertia
R,10,0.12
R,11,0.03
R,12,0.065
*DO,i,1,26
  N,i,(i-1)*L/25
*ENDDO
TYPE,1  $  SECNUM,1  $  MAT,1
*DO,i,1,25
  E,i,i+1
*ENDDO
TYPE,3  $  REAL,10  $  E,7
TYPE,3  $  REAL,11  $  E,13
TYPE,3  $  REAL,12  $  E,21
N,1000,300.000,-100  $  TYPE,2  $  REAL,2  $  E,4,1000  $  D,1000,ALL,0
N,1001,2200.000,-100  $  TYPE,2  $  REAL,2  $  E,23,1001  $  D,1001,ALL,0
D,ALL,UZ,0  $  D,ALL,ROTX,0  $  D,ALL,ROTY,0  $  D,1,UX,0
FINISH
/SOLU
ANTYPE,MODAL  $  MODOPT,LANB,6  $  MXPAND,6  $  SOLVE
FINISH
/POST1
*DIM,F,ARRAY,6
*DO,i,1,6
  *GET,F(i),MODE,i,FREQ
*ENDDO
*CFOPEN,result,txt
*VWRITE,F(1),F(2),F(3),F(4)
('F1 = ',F12.5,/,'F2 = ',F12.5,/,'F3 = ',F12.5,/,'F4 = ',F12.5)
*CFCLOS
```

Check list before trusting the APDL model: the total mass (`*GET` of the element mass + MASS21) equals the CAD mass +
purchased parts; the first two modes are the mount modes; the frequencies agree with `optflow.py solve` for the
same design within the mesh error (chapter 4) – this is a cheap **cross-verification of two independent solvers**.

### 3.6 Abaqus: Python scripts and the result database

Abaqus/CAE records every GUI action as Python (`abaqus.rpy`). Clean the recording into a parametric script, then run
it in batch: `abaqus cae noGUI=frame.py`. Results are read from the output database (ODB) with `odbAccess` – for
a frequency step the history output `EIGFREQ`:

```
## 3.6 Abaqus Python script for the frame (current design)
# Abaqus/CAE noGUI script: frame modal analysis (template - check names for your Abaqus version)
from abaqus import *
from abaqusConstants import *
import regionToolset
L, h, a, k = 2500.0, 100.00, 300.00, 120.000
m = mdb.Model(name='frame')
s = m.ConstrainedSketch(name='line', sheetSize=4000.0)
s.Line(point1=(0.0, 0.0), point2=(L, 0.0))
p = m.Part(name='beam', dimensionality=TWO_D_PLANAR, type=DEFORMABLE_BODY)
p.BaseWire(sketch=s)
m.Material(name='steel'); m.materials['steel'].Elastic(table=((210000.0, 0.3),)); m.materials['steel'].Density(table=((7.85e-9,),))
m.GeneralizedProfile(name='pair', area=2432.0, i11=3.25137e+06, i12=0.0, i22=3.25137e+06, j=3.04225e+06, gammaO=0.0, gammaW=0.0)
m.BeamSection(name='sec', integration=BEFORE_ANALYSIS, profile='pair', material='steel', poissonRatio=0.3)
p.SectionAssignment(region=(p.edges,), sectionName='sec')
p.assignBeamSectionOrientation(region=(p.edges,), method=N1_COSINES, n1=(0.0, 0.0, -1.0))
for xp in [a, L - a] + [600.0, 1250.0, 2050.0]:
    p.PartitionEdgeByPoint(edge=p.edges.findAt(((xp * 0.999 + 0.001, 0.0, 0.0),))[0], point=(xp, 0.0, 0.0))
p.seedPart(size=L / 25.0); p.generateMesh()
inst = m.rootAssembly.Instance(name='beam-1', part=p, dependent=ON)
for xp in (a, L - a):
    v = inst.vertices.findAt(((xp, 0.0, 0.0),))
    m.rootAssembly.engineeringFeatures.SpringDashpotToGround(name='mount%d' % int(xp), region=regionToolset.Region(vertices=v),
        orientation=None, dof=2, springBehavior=ON, springStiffness=2 * k)
for i, (xp, ms) in enumerate([[600.0, 0.12], [1250.0, 0.03], [2050.0, 0.065]]):
    v = inst.vertices.findAt(((xp, 0.0, 0.0),))
    m.rootAssembly.engineeringFeatures.PointMassInertia(name='m%d' % i, region=regionToolset.Region(vertices=v), mass=ms)
m.FrequencyStep(name='modes', previous='Initial', numEigen=6)
job = mdb.Job(name='frame', model='frame'); job.submit(); job.waitForCompletion()
from odbAccess import openOdb
odb = openOdb('frame.odb')
data = odb.steps['modes'].historyRegions['Assembly ASSEMBLY'].historyOutputs['EIGFREQ'].data
open('result.txt', 'w').write('\n'.join('F%d = %.6g' % (i + 1, f) for i, (_, f) in enumerate(data)))
```

Typical problems: the `findAt()` coordinates must lie exactly on the edge or vertex (round-off after a geometry
change), partitions must be re-created for every new geometry, and the job name must be unique per run in a parallel
loop.

### 3.7 Adams and MATLAB in the loop

**Adams.** Design variables (`.model.DV_h`) drive the geometry points and properties; a command file
(`adams_run.cmd`, exported by `optflow.py export`) changes them, runs the simulation and writes a measure
(e.g. the mount force over time) to a text file. Adams Insight does DOE and response surfaces inside Adams. Use
Adams when the loads come from motion (the compressor's shaking force over a speed run-up) and feed its peak
loads into the FE model.

**MATLAB as orchestrator.** MATLAB is a natural driver: `system('…')` runs any solver, `fileread` + `regexp` parse the
results, and `fmincon` (gradient, constraints), `patternsearch`, `ga`, `surrogateopt` (surrogate-based, for
expensive black boxes – the MATLAB equivalent of `ego()`) do the search. The exported `matlab_driver.m` shows the
pattern: `run_solver(x)` writes `design.json`, calls the solver, parses `result.txt`. Recommended choice:
`surrogateopt` for 2–10 continuous variables with a solver of minutes per run; `fmincon` only with smooth
responses (see the noise problem in 4.6); `ga` for discrete catalogue sizes if runs are cheap.

---

## 4. The virtual CAE and credibility: from trend values to reliable values

You told us that your Ansys / Abaqus / Adams results are, so far, "trend values". That is the honest state of most
CAE in industry. A result becomes **reliable** only after three steps: **verification** (the equations are solved
right), **validation** (the right equations – compared with a test), and **calibration** (uncertain parameters fitted
to the test). This chapter does all three with the virtual CAE of `optflow.py`, so you can repeat them with your tools.

### 4.1 The beam element – shape functions and element matrices

A 2-D beam element of length l has two nodes with two degrees of freedom each: deflection w and slope θ. Inside the
element w(x) is a cubic polynomial written with the **Hermite shape functions** (ξ = x / l):

```
w(ξ) = N1 w1 + N2 θ1 + N3 w2 + N4 θ2
N1 = 1 − 3ξ² + 2ξ³        N2 = l (ξ − 2ξ² + ξ³)
N3 = 3ξ² − 2ξ³            N4 = l (−ξ² + ξ³)
```

Bending energy and kinetic energy give the stiffness and the **consistent mass** matrix:

```
k = ∫ EI (N'')ᵀ N'' dx = EI/l³ · [12 6l −12 6l; 6l 4l² −6l 2l²; −12 −6l 12 −6l; 6l 2l² −6l 4l²]
m = ∫ ρA Nᵀ N dx      = ρA l/420 · [156 22l 54 −13l; 22l 4l² 13l −3l²; 54 13l 156 −22l; −13l −3l² −22l 4l²]
```

```python
def beam_k(EI, l):
    c = EI / l ** 3
    return [[12 * c, 6 * l * c, -12 * c, 6 * l * c], [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
            [-12 * c, -6 * l * c, 12 * c, -6 * l * c], [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c]]

def beam_m(rhoA, l):
    c = rhoA * l / 420
    return [[156 * c, 22 * l * c, 54 * c, -13 * l * c], [22 * l * c, 4 * l * l * c, 13 * l * c, -3 * l * l * c],
            [54 * c, 13 * l * c, 156 * c, -22 * l * c], [-13 * l * c, -3 * l * l * c, -22 * l * c, 4 * l * l * c]]
```

The add-on integrates the two definitions numerically (4-point Gauss) and compares with the closed forms – an
independent check of the element:

```python
def fa_element_by_integration(EI=1.0, rhoA=1.0, l=2.0):
    """k = int EI N''^T N'' dx, m = int rhoA N^T N dx by 4-point Gauss quadrature; compare with beam_k / beam_m."""
    gp = [(0.0694318442, 0.1739274226), (0.3300094782, 0.3260725774), (0.6699905218, 0.3260725774), (0.9305681558, 0.1739274226)]
    K, M = zeros(4), zeros(4)
    for xi, w in gp:
        B, N = fa_hermite_dd(xi, l), fa_hermite(xi, l)
        for i in range(4):
            for j in range(4):
                K[i][j] += EI * B[i] * B[j] * w * l
                M[i][j] += rhoA * N[i] * N[j] * w * l
    Kc, Mc = beam_k(EI, l), beam_m(rhoA, l)
    dk = max(abs(K[i][j] - Kc[i][j]) for i in range(4) for j in range(4)) / max(abs(v) for r in Kc for v in r)
    dm = max(abs(M[i][j] - Mc[i][j]) for i in range(4) for j in range(4)) / max(abs(v) for r in Mc for v in r)
    unity = max(abs(sum(fa_hermite(xi, l)[i] for i in (0, 2)) - 1) for xi in (0.0, 0.3, 0.7, 1.0))
    return {"dk": dk, "dm": dm, "unity": unity}
```

```
## 4.1 Element matrices by integration of the Hermite shape functions
  max rel. difference to beam_k 1.11e-10, to beam_m 3.94e-11; N1 + N3 = 1 (rigid translation) error 0.0e+00
```

The difference is at the round-off of the Gauss abscissae (10⁻¹⁰), and N1 + N3 = 1 shows that a rigid translation is
represented exactly (no strain energy) – the "patch test" of a beam element.

### 4.2 Assembly, springs, point masses, solution

The global matrices are the sum of the element matrices at the shared nodes. A mount adds its stiffness to the
diagonal of K at the vertical DOF of its node; a point mass adds to the diagonal of M. The frame model of
`optflow.py` also inserts nodes at every mount and mass position (`mesh()`), so loads and supports sit exactly on
nodes:

```python
def frame_fe(P, h, a, k, n_el=None, EI_factor=1.0, k_factor=1.0):
    """Two RHS beams (one 2-D beam with 2 x EI, 2 x mass), point masses, 4 mounts (2 per position, spring 2k each).
    Returns natural frequencies, static sag, maximum bending stress (gravity x dyn + shaking force), beam mass."""
    L = P["L"]
    A, I, W = rhs_section(h, P["b"], P["t"])
    EI, rhoA = 2 * P["E"] * I * EI_factor, 2 * P["rho"] * A
    sup = [a, L - a]
    xs = mesh(L, n_el or P["n_el"], sup + [m[0] for m in P["masses"]])
    n = 2 * len(xs)
    K, M = zeros(n), zeros(n)
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        ke, me = beam_k(EI, l), beam_m(rhoA, l)
        d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3]
        for i in range(4):
            for j in range(4):
                K[d[i]][d[j]] += ke[i][j]
                M[d[i]][d[j]] += me[i][j]
    idx = lambda x: min(range(len(xs)), key=lambda i: abs(xs[i] - x))
    for s in sup:
        K[2 * idx(s)][2 * idx(s)] += 2 * k * k_factor
    for x, m in P["masses"]:
        M[2 * idx(x)][2 * idx(x)] += m
    lam = gen_eig(K, M)
    f = [math.sqrt(max(l_, 0.0)) / (2 * math.pi) for l_ in lam]
    # static: gravity x dyn on masses and beam (lumped half-element), + shaking force at the compressor
    g = 9810.0
    Fg = [0.0] * n                     # gravity (1 g) on beam (lumped half elements) and masses
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        for nd in (e, e + 1):
            Fg[2 * nd] -= rhoA * g * l / 2
    for x, m in P["masses"]:
        Fg[2 * idx(x)] -= m * g
    ug = solve(K, Fg)
    sag0 = -0.5 * (ug[2 * idx(sup[0])] + ug[2 * idx(sup[1])])       # mean static compression of the mounts
    F = [P["dyn"] * v for v in Fg]
    F[2 * idx(P["masses"][0][0])] -= P["F_shake"]
    u = solve(K, F)
    Mmax = 0.0
    for e in range(len(xs) - 1):
        l = xs[e + 1] - xs[e]
        w1, t1, w2, t2 = u[2 * e:2 * e + 4]
        for xi in (0.0, 1.0):          # w'' at the element ends (Hermite shape functions)
            B = [(-6 + 12 * xi) / l ** 2, (-4 + 6 * xi) / l, (6 - 12 * xi) / l ** 2, (-2 + 6 * xi) / l]
            Mmax = max(Mmax, abs(EI * (B[0] * w1 + B[1] * t1 + B[2] * w2 + B[3] * t2)))
    return {"f": f, "sag": sag0, "sigma": Mmax / (2 * W), "mass_kg": rhoA * L * 1000, "n_dof": n, "nodes": xs, "u": u}
```

Two linear-algebra problems are solved:

- **static:** K u = F (gravity × dyn + shaking force) by Gauss elimination; the bending moment follows from
  M = EI·w'' = EI·Σ N''_i u_i at the element ends, the stress from σ = M / (2 W);
- **modal:** K φ = ω² M φ (generalised eigenproblem). With the Cholesky factor M = L Lᵀ it becomes the standard
  symmetric problem (L⁻¹ K L⁻ᵀ) y = ω² y, solved by Jacobi rotations (`gen_eig()`, `jacobi_eig()`). The frame floats
  on its mounts, so there is no zero eigenvalue: the two lowest modes are the **mount modes** (bounce and pitch of
  the almost rigid frame on the springs), the third is the first **bending** mode.

A detail that matters in practice: the frequencies range from 6 Hz to several kHz, so the eigenvalues ω² span about
six orders of magnitude. An eigen solver whose stopping test is relative to the largest eigenvalue returns the
small ones inaccurately. `jacobi_eig()` therefore uses a relative test for each pair of entries. Commercial codes
(Block Lanczos in Ansys, Lanczos / AMS in Abaqus) solve this with shift-and-invert – one reason to always request a
frequency range or a shift near your frequencies of interest.

### 4.3 Verification against theory

**Cantilever.** A clamped–free beam with a tip load: tip deflection F L³ / (3 EI) and first frequency
1.8751² / (2π L²) · √(EI / ρA). Built from the same `beam_k` / `beam_m` with the first node clamped:

```python
def fa_cantilever(n_el, L=1000.0, EI=1e11, rhoA=1e-5, F=1000.0):
    """Clamped-free beam with the core element matrices: tip deflection F L^3 / (3 EI), first frequency
    1.8751^2 / (2 pi L^2) sqrt(EI / rhoA) - convergence with the number of elements."""
    l = L / n_el
    n = 2 * (n_el + 1)
    K, M = zeros(n), zeros(n)
    for e in range(n_el):
        ke, me = beam_k(EI, l), beam_m(rhoA, l)
        for i in range(4):
            for j in range(4):
                K[2 * e + i][2 * e + j] += ke[i][j]
                M[2 * e + i][2 * e + j] += me[i][j]
    Kr = [r[2:] for r in K[2:]]
    Mr = [r[2:] for r in M[2:]]
    Fv = [0.0] * (n - 2)
    Fv[-2] = F
    w = solve(Kr, Fv)[-2]
    f1 = math.sqrt(gen_eig(Kr, Mr)[0]) / (2 * math.pi)
    return {"w_tip": w, "w_th": F * L ** 3 / (3 * EI), "f1": f1, "f1_th": 1.8751041 ** 2 / (2 * math.pi * L ** 2) * math.sqrt(EI / rhoA)}
```

```
## 4.2 Cantilever: convergence of tip deflection and first frequency
  1 elements: w_tip 3.333333 mm (theory 3.333333), f1 56.2252 Hz (theory 55.9591, error +0.4754 %)
  2 elements: w_tip 3.333333 mm (theory 3.333333), f1 55.9862 Hz (theory 55.9591, error +0.0483 %)
  4 elements: w_tip 3.333333 mm (theory 3.333333), f1 55.9610 Hz (theory 55.9591, error +0.0033 %)
  8 elements: w_tip 3.333333 mm (theory 3.333333), f1 55.9592 Hz (theory 55.9591, error +0.0002 %)
```

Two lessons: the deflection is **exact with one element** (the Hermite cubic contains the exact solution of a tip-
loaded beam), and the frequency converges from above with the error falling by about 10 per halving of the element
size (fourth-order convergence of consistent-mass beam elements). The self-test adds the free–free beam
(4.730² / (2π L²) · √(EI / ρA), 0.1 % with 40 elements), the simply supported beam under a central load and the rigid
bounce on springs.

**Rayleigh.** For a simply supported beam with a central mass the classic estimate is
f = 1/(2π) · √(48 EI / L³ / (m + 0.486 m_beam)) – a hand calculation every designer can do to check a CAE result:

```python
def fa_rayleigh(P, h=100.0, m=0.12):
    """Simply supported beam (stiff springs at the ends) with a central mass: FE vs Rayleigh estimate
    f = 1/(2 pi) sqrt(48 EI / L^3 / (m + 0.486 m_beam))."""
    Q = dict(P, masses=[[P["L"] / 2, m]], F_shake=0.0, n_el=20)
    r = frame_fe(Q, h, 1e-6, 1e8)
    A, I, _ = rhs_section(h, P["b"], P["t"])
    EI, mb = 2 * P["E"] * I, 2 * P["rho"] * A * P["L"]
    fr = math.sqrt(48 * EI / P["L"] ** 3 / (m + 0.486 * mb)) / (2 * math.pi)
    fe = [f for f in r["f"] if f > 1.0][0]
    return {"f_fe": fe, "f_rayleigh": fr, "dev_pct": 100 * (fr / fe - 1)}
```

```
## 4.3 Rayleigh check: simply supported frame with the compressor mass at mid-span
  h 80: FE 14.82 Hz, Rayleigh 14.83 Hz (+0.01 %)
  h 120: FE 23.88 Hz, Rayleigh 23.88 Hz (+0.02 %)
```

Agreement within 0.02 %: for a dominant point mass the Rayleigh formula is practically exact. Use such hand checks
on your Ansys / Abaqus models before every study: if the CAE result differs from the hand estimate by more than
10–20 %, look for an input error (units, supports, missing mass) before you look for physics.

### 4.4 Mesh convergence and the Grid Convergence Index

Every FE result depends on the mesh. A **three-mesh study** with a constant refinement ratio r gives the observed
order of convergence p, the extrapolated "mesh-independent" value and the Grid Convergence Index (Roache, M1 §28):

```
p = ln[(f3 − f2) / (f2 − f1)] / ln r        f_ext = f1 + (f1 − f2) / (r^p − 1)
GCI_fine = 1.25 · |(f1 − f2) / f1| / (r^p − 1)
```

```python
def fa_gci(P, x, ns=(4, 8, 16)):
    """Mesh study of the frame with the Roache GCI (dm_toolkit.gci)."""
    import dm_toolkit
    rows = [(n, responses(P, x, n)) for n in ns]
    out = {}
    for key in ("f_bend", "sigma"):
        f3, f2, f1 = (r[key] for _, r in rows)
        try:
            out[key] = dm_toolkit.gci(f1, f2, f3, r=2.0)
        except ValueError as ex:
            out[key] = {"error": str(ex)}
    return rows, out
```

```
## 4.4 Mesh convergence and GCI (current design)
   4 elements: f_bend 76.42762 Hz, sigma 10.7650 MPa
   8 elements: f_bend 76.41898 Hz, sigma 10.7650 MPa
  16 elements: f_bend 76.41772 Hz, sigma 10.7706 MPa
  f_bend: order p 2.77, extrapolated 76.41750, GCI fine 0.0004 %
  sigma: oscillating or no convergence - refine further
```

The bending frequency converges cleanly (order 2.8, GCI 0.0004 %) – the frame model is far finer than needed even
with 4 elements, because nodes sit at all masses and mounts. The **stress does not converge monotonically**: the
maximum moment sits at a node whose position shifts slightly with the mesh, so the GCI formula refuses it
("oscillating"). That is a typical real-world finding: frequencies converge fast, local stresses slowly and
erratically. In Ansys / Abaqus, do the mesh study **for the response that enters the optimisation** (frequency,
stress at the weld toe, …) and keep the mesh **fixed in topology** during the optimisation (morphing instead of
re-meshing) where possible.

### 4.5 Numerical noise – why gradients from CAE are dangerous

When the geometry changes, a real mesher creates a different mesh. The response then jumps by a small amount –
**numerical noise** – typically 0.1 … 1 % for frequencies and several % for peak stresses. The add-on models this
with a deterministic ±0.3 % noise that depends on the design point:

```python
def fa_noisy(P, x, amp=0.003):
    """Response with 'remeshing noise': a different mesh for every geometry changes the result by up to +/- amp
    (deterministic in x, like a real mesher)."""
    R = responses(P, x)
    rnd = random.Random(hash(tuple(round(v, 6) for v in x)))
    R = dict(R)
    R["f_bend"] *= 1 + amp * (2 * rnd.random() - 1)
    R["f_rigid"] *= 1 + amp * (2 * rnd.random() - 1)
    return R
```

A finite-difference gradient divides the change of the response by the step. With noise ε·f the error of the
gradient is about ε·f / Δ:

```python
def fa_fd_study(P, x, steps=(10.0, 1.0, 0.1, 0.01, 0.001), amp=0.003):
    """Central finite-difference gradient d f_bend / d h: smooth model vs noisy model. Noise / step dominates small steps."""
    out = []
    for d in steps:
        xp, xm = list(x), list(x)
        xp[0] += d
        xm[0] -= d
        gs = (responses(P, xp)["f_bend"] - responses(P, xm)["f_bend"]) / (2 * d)
        gn = (fa_noisy(P, xp, amp)["f_bend"] - fa_noisy(P, xm, amp)["f_bend"]) / (2 * d)
        out.append((d, gs, gn))
    return out
```

```
## 4.5 Numerical noise: finite-difference gradient d f_bend / d h (noise +/- 0.3 %)
  step  10.000 mm: smooth +0.7974 Hz/mm, noisy    +0.8058 Hz/mm
  step   1.000 mm: smooth +0.7975 Hz/mm, noisy    +0.8168 Hz/mm
  step   0.100 mm: smooth +0.7975 Hz/mm, noisy    -0.7370 Hz/mm
  step   0.010 mm: smooth +0.7975 Hz/mm, noisy    -0.6693 Hz/mm
  step   0.001 mm: smooth +0.7975 Hz/mm, noisy    -9.1414 Hz/mm
```

With steps of 10 mm and 1 mm the noisy gradient is close to the true +0.80 Hz/mm; below 0.1 mm it has the **wrong
sign** and at 0.001 mm it is 11 times too large. A gradient optimiser (MATLAB `fmincon` with default finite
differences, step ≈ 10⁻⁸ · x) on a re-meshing CAE model is therefore effectively blind. Remedies: large steps
(1–5 % of the range), mesh morphing, gradient-free or surrogate methods (chapters 5–6) – the surrogate smooths the
noise because it fits a smooth surface through many points.

```
## 4.6 Optimisation on a smooth vs a noisy solver (Nelder-Mead, 90 calls)
  smooth: h 78.4, a 231.8, k 104.0 -> true mass 40.95 kg, f_rigid 9.95, f_bend 59.7 Hz, sag 6.03 -> feasible no (80 calls)
  noisy : h 78.8, a 348.2, k 128.1 -> true mass 41.07 kg, f_rigid 9.86, f_bend 59.4 Hz, sag 4.90 -> feasible no (104 calls)
```

Both direct Nelder–Mead runs with 90 solver calls stop **slightly outside** the limits (the penalty method, M1
§29.5), and the noisy one stops at a different design (a 348 mm instead of 232 mm) with a higher mass: noise creates
false local minima. Hence the rule of chapter 6: after any optimisation, **re-run the true solver at the optimum and
check the limits with a margin**.

### 4.6 Validation and calibration – model updating to a test

A verified model can still be wrong: the real joints of a welded frame are softer than a perfect beam, the real
mounts have a dynamic stiffness 10–40 % above the catalogue static value, the receiver contents change the mass.
**Calibration** (model updating) fits a few uncertain parameters so that the model reproduces measured
quantities – here the first three natural frequencies from an impact test.

Choice of parameters – few, physical, and each one sensitive to some measurement:

| Parameter | Physical meaning | Sensitive measurement |
|---|---|---|
| EI factor | joint flexibility, real profile vs nominal | bending mode |
| k factor | dynamic mount stiffness vs catalogue | the two mount modes |

The method (Gauss–Newton on log factors, residual r_i = ln(f_model,i / f_meas,i)):

```
q = (ln EI_factor, ln k_factor)
J_ij = ∂r_i / ∂q_j    (finite differences)
Δq = −(Jᵀ J)⁻¹ Jᵀ r,  repeat until Δq ≈ 0
condition number of Jᵀ J  → identifiability (large = the data cannot determine the parameter)
```

```python
def fa_calibrate_gn(P, x, f_meas, modes=(0, 1, 2), it=8):
    """Gauss-Newton on log factors q = (ln EI_factor, ln k_factor), residual r_i = ln(f_model,i / f_meas,i),
    finite-difference Jacobian; returns factors, Jacobian condition (identifiability) and iterations."""
    q = [0.0, 0.0]
    cond = None
    for _ in range(it):
        f0 = fa_model_freqs(P, x, q, modes)
        r = [math.log(a / b) for a, b in zip(f0, f_meas)]
        J = []
        for j in range(2):
            qq = list(q)
            qq[j] += 1e-4
            fj = fa_model_freqs(P, x, qq, modes)
            J.append([(math.log(a / b) - ri) / 1e-4 for a, b, ri in zip(fj, f_meas, r)])
        JtJ = [[sum(J[i][m] * J[j][m] for m in range(len(r))) for j in range(2)] for i in range(2)]
        tr, det = JtJ[0][0] + JtJ[1][1], JtJ[0][0] * JtJ[1][1] - JtJ[0][1] ** 2
        disc = math.sqrt(max(tr * tr / 4 - det, 0.0))
        lmax, lmin = tr / 2 + disc, tr / 2 - disc
        cond = lmax / lmin if lmin > 1e-300 else float("inf")
        if cond > 1e10:
            return {"EI_factor": None, "k_factor": None, "cond": cond, "identifiable": False}
        Jtr = [sum(J[i][m] * r[m] for m in range(len(r))) for i in range(2)]
        dq = solve(JtJ, [-v for v in Jtr])
        q = [a + b for a, b in zip(q, dq)]
        if max(abs(v) for v in dq) < 1e-10:
            break
    return {"EI_factor": math.exp(q[0]), "k_factor": math.exp(q[1]), "cond": cond, "identifiable": True}
```

```
## 4.7 Calibration (Gauss-Newton) and identifiability
  modes 1-3 (2 mount + 1 bending): EI factor 0.7500, k factor 1.1500, condition 2.1
  mount modes only:                identifiable, condition 4.21e+03
  +/- 1 % measurement noise, 8 trials, modes 1-3:   EI factor 0.742 ... 0.761, k factor 1.132 ... 1.167 (true 0.75 / 1.15)
  +/- 1 % measurement noise, 8 trials, modes 1-2 only: EI factor 0.391 ... 2.681, k factor 1.131 ... 1.175
```

Read the four lines:

1. With the two mount modes **and** the bending mode the hidden factors 0.75 / 1.15 are recovered exactly; the
   condition number 2.1 says both parameters are well determined.
2. With only the two mount modes the condition number is 4200: mathematically solvable, practically not.
3. With ±1 % measurement noise and three modes the factors scatter by only ±1.3 % – a calibrated model.
4. With ±1 % noise and only the mount modes the EI factor scatters from 0.39 to 2.68 – **the test did not contain
   the information**. The lesson for planning a test: measure the modes that are sensitive to every parameter you
   want to calibrate. A further check is the **MAC** (modal assurance criterion,
   MAC = |φ_testᵀ φ_FE|² / ((φ_testᵀ φ_test)(φ_FEᵀ φ_FE))): pair test and FE modes by shape, not by order – two modes
   can swap order between test and model.

The core `calibrate()` (Nelder–Mead on the same residual) gives the same result; Gauss–Newton needs about 30 solver
calls instead of a few hundred, which matters with a real CAE model.

### 4.7 Planning the modal test

An impact-hammer test of the built frame is cheap (hammer, one or two accelerometers, a 4-channel analyser, half a
day). The numbers to plan it:

```
sampling rate      f_s ≥ 2.56 · f_max   (anti-aliasing; here with margin for a 200 Hz band)
resolution         Δf = accuracy · f_target           record length T = 1 / Δf
samples            N = f_s · T  (rounded up to a power of 2 for the FFT)
```

```python
def fa_test_plan(f_max=80.0, f_target=60.3, accuracy=0.005):
    """Impact (hammer) modal test: sampling rate >= 2.56 f_max, frequency resolution df <= accuracy x f_target,
    record length T = 1 / df, number of samples N = fs T."""
    fs = 2.56 * f_max * 2.5          # margin for the anti-aliasing filter and a 200 Hz band
    df = accuracy * f_target
    T = 1 / df
    return {"fs": fs, "df": df, "T": T, "N": 2 ** math.ceil(math.log2(fs * T))}
```

```
## 4.8 Impact modal test plan for the built frame
  sampling 512 Hz, resolution 0.301 Hz -> record 3.3 s, 2048 samples per average
```

Practical points: soft rubber hammer tip for the low mount modes (energy up to ~200 Hz), hard tip only for higher
modes; test the frame **on its real mounts** (that is what you want to calibrate) and, for a second set, on soft
supports (free–free) to separate frame and mount properties; average 5–10 impacts; check the coherence (> 0.9) at
the peaks; mark the accelerometer positions in the CAD so the FE mode shapes can be compared (MAC).

### 4.8 The verification and validation (V&V) plan

```
## 4.9 Verification and validation plan
  - code verification: does the solver solve the equations right? -> analytic cases: cantilever, simply supported, free-free (self-test) (CAE engineer)
  - solution verification: is the mesh fine enough? -> 3-mesh study, GCI < 2 % for the response used (CAE engineer)
  - input check: are loads, masses, units, supports right? -> mass report vs CAD and scale; reaction sum = weight (designer)
  - validation test: does the model match reality? -> impact modal test of the built frame, 3+ modes (test lab)
  - calibration: which uncertain parameters explain the difference? -> identify joint EI factor and mount k from test (CAE + test)
  - validation (blind): does the calibrated model predict a NEW case? -> second configuration (e.g. receiver empty / full) predicted then tested (CAE + test)
  - use with margin: how wrong can it still be? -> remaining error -> margin on limits (e.g. 5 % on frequencies) (designer)
```

With this plan your CAE numbers change from "trend values" to **quantified** values: a calibrated model plus a stated
remaining error (for example "frequencies ±3 %"). That remaining error goes into the limits of the optimisation
(chapter 6: a 5 % margin on 60.3 Hz) – and the optimum becomes a design you can release.


---

## 5. Design of experiments and surrogate models

A CAE run is expensive. Ansys needs minutes, Abaqus with contact needs hours, and an Adams run with flexible bodies
needs about as long as Ansys. You cannot ask the solver thousands of questions. The workflow therefore asks it
**a few well-chosen questions** (the design of experiments, DOE), builds a cheap **surrogate model** (also called a
metamodel or response surface) from the answers, and lets the optimiser work on the surrogate. The true solver is
only used to check the surrogate and the final design.

```
   DOE (chapter 5.1)  ->  true solver runs  ->  surrogate fit (5.2-5.4)  ->  validation (5.3)  ->  optimiser on the surrogate (6)
          ^                                                                                                |
          +------------------------- infill: add the most useful new point (6.3, EGO) ---------------------+
```

`python optflow.py ch56` prints every result of chapters 5 and 6. The add-on functions start with `fb_`; the core
functions (`lhs()`, `rsm_fit()`, `Kriging`, `loo_error()`, `ego()`) are explained in chapter 0.2 and used here.

### 5.1 Plans for computer experiments – why physical DOE rules do not fit

M1 chapter 30 teaches DOE for **physical tests**: full and fractional factorial plans, replicates, randomisation,
blocking. Those rules exist because a physical test has **random scatter**. You repeat a point to estimate the
noise, and you randomise the run order to protect yourself against drift (tool wear, temperature).

A CAE solver is **deterministic**: the same input gives exactly the same output. That changes three rules:

| Physical test | Computer experiment | Why |
|---|---|---|
| Replicates (repeat a point) | **never** – a repeat costs a run and gives the same number | no random error |
| Randomise the run order | not needed | no drift (but keep the solver version and mesh settings fixed!) |
| Points at the corners of the region (2-level factorial) | **fill the space** with points everywhere | the response may be curved anywhere; a surrogate must learn the inside, not only the corners |
| Few levels per factor (2 or 3) | **many levels** per variable | after projection onto one variable, each point should give new information |

The second point is easy to forget: a CAE result is deterministic only if the **model** is fixed. A re-mesh that
changes with the geometry (automatic meshing in SOLIDWORKS Simulation or Ansys) creates **numerical noise** –
small jumps in the response when a parameter changes slightly. Chapter 4 showed how to keep it small (mesh
convergence). Kriging with a small nugget (chapter 5.4) tolerates the rest.

Two properties describe a good computer plan:

1. **Space filling** – no large empty regions and no points crowded together. The usual measure is the
   **maximin criterion**: the smallest distance between any two points should be as **large** as possible.
2. **Projection** – when you look at one variable alone, the points should cover many different levels. If a
   variable turns out to be unimportant, the plan collapses onto the others; a 3³ factorial then has only 9
   different points in the remaining two variables (each repeated three times – useless repeats for a computer).

The **Latin hypercube** (LHS, core `lhs()`) guarantees the projection property: each variable range is cut into
n strata, and exactly one point lies in each stratum. The **maximin Latin hypercube** additionally keeps the
space-filling property: many random LHS are generated and the one with the largest smallest distance is kept.

```python
def fb_min_dist(Z):
    """Smallest distance between two points of a plan (normalised space) - the maximin criterion."""
    return min(math.dist(Z[i], Z[j]) for i in range(len(Z)) for j in range(i + 1, len(Z)))

def fb_maximin_lhs(n, k, tries=200, seed=1):
    """Best of many random Latin hypercubes: keep the one with the largest smallest distance."""
    best, dbest = None, -1.0
    for s in range(tries):
        Z = lhs(n, [0.0] * k, [1.0] * k, seed + s)
        d = fb_min_dist(Z)
        if d > dbest:
            best, dbest = Z, d
    return best, dbest
```

`fb_design_compare()` compares four plans with the same 27 points in the normalised cube [0, 1]³:

```python
    ff = [[i / 2, j / 2, l / 2] for i in range(3) for j in range(3) for l in range(3)]
    rnd = random.Random(seed)
    rd = [[rnd.random() for _ in range(k)] for _ in range(n)]
    lh = lhs(n, [0.0] * k, [1.0] * k, seed)
    mm, _ = fb_maximin_lhs(n, k, 200, seed)
    ...
        lv = min(len(set(round(z[j], 9) for z in Z)) for j in range(k))
```

```
## 5.1 Plans for computer experiments (27 points, 3 variables, normalised space)
  full factorial 3^3         n 27: smallest distance 0.500, levels per variable  3
  random                     n 27: smallest distance 0.081, levels per variable 27
  Latin hypercube            n 27: smallest distance 0.127, levels per variable 27
  maximin Latin hypercube    n 27: smallest distance 0.187, levels per variable 27
  maximin LHS for the default DOE (n 20): smallest distance 0.240 vs plain LHS (seed 7) 0.132
```

How to read it:

- The **full factorial** has the largest smallest distance (0.5) but only **3 levels per variable**. It cannot
  see a curve with more than one bend in any variable, and if one variable is unimportant 18 of the 27 runs are
  repeats in the other two.
- **Random points** have 27 levels but can lie almost on top of each other (0.081): wasted runs.
- The **LHS** has 27 levels and better spacing (0.127). The **maximin LHS** improves the spacing by 47 % (0.187)
  at no extra cost – it only needs 200 cheap trials before any solver run.
- For the default problem (20 points) the maximin LHS reaches 0.240 against 0.132 for the plain LHS that the
  core `ego()` uses. The core keeps the plain LHS so that the result is reproducible with one seed; for a real
  Ansys study, where every run costs minutes, use the maximin plan.

**How many points?** The common rule for a first DOE is **n ≈ 10 · k** (k = number of variables). For the frame,
k = 3 gives 20–30 points. Fewer points are possible if the responses are smooth (here they are). A quadratic
response surface needs at least p = (k + 1)(k + 2)/2 = 10 points to be fitted at all; with exactly 10 it passes
through every point and you have no information left to check it (chapter 5.3 shows how badly that fails).

MATLAB: `lhsdesign(n, k, 'criterion', 'maximin', 'iterations', 200)` (Statistics Toolbox) gives the same plan;
Ansys DesignXplorer offers "Optimal Space-Filling" and "Latin Hypercube Sampling"; Adams Insight and SOLIDWORKS
"Design Study" offer factorial plans only (check your version).

### 5.2 Response surface: fit quality and its trap

The quadratic response surface (core `rsm_fit()`, theory in M1 chapter 30) writes each response as

  ŷ(z) = β₀ + Σ βᵢ zᵢ + Σ βᵢⱼ zᵢ zⱼ  (all squares and products, p = 10 coefficients for k = 3)

and finds β by least squares. Its usual quality numbers are

  R² = 1 − SS_res / SS_tot,  R²_adj = 1 − (1 − R²) · (n − 1)/(n − p)

with SS_res = Σ (ŷᵢ − yᵢ)² (residual sum of squares) and SS_tot = Σ (yᵢ − ȳ)² (total sum of squares). The adjusted
R² punishes extra coefficients: if a model only fits because it has many coefficients, R²_adj falls.

```python
def fb_r2(Z, y):
    """Fit quality of the quadratic response surface: R2 = 1 - SS_res / SS_tot, adjusted R2 = 1 - (1 - R2)(n - 1)/(n - p)."""
    s = rsm_fit(Z, y)
    n, p = len(y), len(quad_terms(Z[0]))
    ym = sum(y) / n
    ss_res = sum((s(z) - v) ** 2 for z, v in zip(Z, y))
    ss_tot = sum((v - ym) ** 2 for v in y)
    r2 = 1 - ss_res / ss_tot
    return {"R2": r2, "R2_adj": 1 - (1 - r2) * (n - 1) / (n - p) if n > p else float("nan"), "n": n, "p": p}
```

**The trap:** R² measures how well the surface passes through the points it was fitted to. It says nothing about
the points in between – and only those matter for the optimiser. The honest check is **cross-validation**
(chapter 5.3). The table below already contains it:

```
## 5.2 Fit quality on the 20 DOE points (true solver) - R2 of the response surface vs leave-one-out
  mass_kg  R2 1.0000, R2_adj 1.0000 | LOO error / range: RSM 0.0000, Kriging 0.0081
  f_rigid  R2 0.9980, R2_adj 0.9961 | LOO error / range: RSM 0.0318, Kriging 0.0219
  f_bend   R2 0.9999, R2_adj 0.9998 | LOO error / range: RSM 0.0073, Kriging 0.0079
  sag      R2 0.8519, R2_adj 0.7187 | LOO error / range: RSM 0.2177, Kriging 0.1472
```

- **Mass** is linear in h (two tubes, fixed length): the quadratic surface is exact (LOO 0.0000). Kriging is
  slightly worse (0.0081) because its built-in trend is a constant; it has to imitate a straight line with its
  correlation function. (Universal Kriging with a linear trend would be exact – check if your tool offers it.)
- **f_bend** is smooth and nearly a function of h alone: both models are very good (< 1 % of the range).
- **f_rigid** is the *highest of two rigid-body modes* (bounce and pitch). Where the two modes change places the
  response has a **kink**, and a quadratic cannot follow a kink. R² is still 0.998 – it looks excellent – but the
  LOO error is 3.2 % of the range, 45 % worse than Kriging.
- **sag** depends on 1/k, a strongly curved function with large values at small k. R² = 0.85 and R²_adj = 0.72
  warn you here; the LOO error is 22 % (RSM) and 15 % (Kriging). Both are poor. This matters in chapter 6.5: the
  optimiser later moves into regions where the sag surrogate is wrong, and only the true check finds it.

Rules for response surfaces in practice:

| Situation | Response surface? |
|---|---|
| Smooth, gently curved response, small region (local refinement near a known design) | yes – cheap, interpretable, robust |
| Maximum / minimum of several quantities (highest mode, worst stress over load cases) | no – kinks; model each quantity separately or use Kriging |
| Strong curvature (1/x, exponential, resonance) | transform first (fit log y or 1/y) or use Kriging |
| Noisy CAE results (re-meshing noise) | yes – least squares smooths the noise; Kriging needs a larger nugget |

A practical transform for the sag: sag ≈ m·g/(4k), so fitting 1/sag (≈ linear in k) instead of sag removes most
of the curvature. The same trick works for frequencies: f² is closer to linear in stiffness than f.

### 5.3 Validation: leave-one-out and an independent test set

**Leave-one-out (LOO, core `loo_error()`):** remove point i, fit the surrogate to the other n − 1 points,
predict point i, compare with the true value; repeat for all points. The RMS of these errors divided by the
range of the response is a dimensionless quality number:

  e_LOO = √( Σ (ŷ₋ᵢ(zᵢ) − yᵢ)² / n ) / (y_max − y_min)

```python
def loo_error(Z, y, make):
    """Leave-one-out: refit without point i, predict it; RMS error relative to the response range."""
    e = []
    for i in range(len(y)):
        s = make(Z[:i] + Z[i + 1:], y[:i] + y[i + 1:])
        e.append(s(Z[i]) - y[i])
    rng = (max(y) - min(y)) or 1.0
    return math.sqrt(sum(v * v for v in e) / len(e)) / rng
```

LOO costs **no solver runs** – only n refits of the surrogate. That is why it is the standard check in Ansys
DesignXplorer ("verification points" cost runs, "cross-validation" does not) and in MATLAB (`crossval`).

An **independent test set** is more expensive but even more honest: run the true solver at extra random points
that were never used for fitting. `fb_testset()` does this with 80 random points and asks how the error falls when
the DOE grows from 10 to 40 points:

```python
    Xt = [[l + (u - l) * rnd.random() for l, u in zip(lo, hi)] for _ in range(n_test)]
    Rt = [responses(P, x) for x in Xt]
    ...
    for n in ns:
        X = lhs(n, lo, hi, P["seed"])
        Rs = [responses(P, x) for x in X]
        ...
            row[key + "_kriging"] = math.sqrt(sum((kr.predict(z) - v) ** 2 for z, v in zip(Zt, yt)) / n_test) / rng
```

```
## 5.3 Error on 80 independent test points vs number of DOE points (RMS / range)
  n 10: f_bend  Kriging 0.0307  RSM 0.1740 | f_rigid  Kriging 0.0345  RSM 0.5275
  n 20: f_bend  Kriging 0.0037  RSM 0.0060 | f_rigid  Kriging 0.0183  RSM 0.0155
  n 30: f_bend  Kriging 0.0014  RSM 0.0054 | f_rigid  Kriging 0.0068  RSM 0.0148
  n 40: f_bend  Kriging 0.0008  RSM 0.0045 | f_rigid  Kriging 0.0073  RSM 0.0141
```

- With **10 points** the quadratic surface has exactly as many points as coefficients. It interpolates them and
  is useless in between: 17 % error for f_bend and **53 %** for f_rigid. Kriging is already usable (3 %).
- From **20 points** (the 10·k rule minus one third) both are good for f_bend. For f_rigid the RSM is even slightly
  better at n = 20 (1.55 % against 1.84 %), but it **stops improving** at about 1.4 % – the kink of the max
  function is a model error that more points cannot remove. Kriging keeps improving to 0.7 %.
- Between 30 and 40 points Kriging hardly improves any more for f_rigid. More DOE points are then wasted; the
  remaining budget is better spent on **infill points near the optimum** (chapter 6.3).

Acceptance rule used in this guide (check against your own needs): **e_LOO ≤ 2 %** for responses that appear in
active constraints, ≤ 5 % for the others. The frame passes for mass, f_bend and f_rigid but not for sag – the
infill loop and the final true check must take care of the sag limit.

### 5.4 Kriging – what the model assumes and what it tells you

Kriging (core class `Kriging`, named after the mining engineer D. Krige; in Ansys "Kriging", in MATLAB `fitrgp`,
in statistics "Gaussian process regression") treats the unknown response as a random function:

  y(z) = μ + Z(z),  Cov(Z(z), Z(z')) = σ² · R(z, z'),  R(z, z') = exp( −Σⱼ θⱼ (zⱼ − z'ⱼ)² )

- μ is a constant mean, σ² the process variance.
- R is the **correlation**: two points close together have almost the same response (R → 1), points far apart
  are independent (R → 0).
- θⱼ is the **activity** of variable j: a large θ means the response changes quickly in that direction (short
  correlation length ≈ 1/√θ).

For given θ, the best linear unbiased predictor and its variance are

  ŷ(z) = μ̂ + rᵀ R⁻¹ (y − 1 μ̂),  μ̂ = 1ᵀ R⁻¹ y / 1ᵀ R⁻¹ 1
  s²(z) = σ̂² [ 1 − rᵀ R⁻¹ r + (1 − 1ᵀ R⁻¹ r)² / 1ᵀ R⁻¹ 1 ]

with r = vector of correlations between z and the training points. θ is chosen by **maximum likelihood**; after
inserting μ̂ and σ̂² = (y − 1μ̂)ᵀ R⁻¹ (y − 1μ̂)/n, the concentrated log-likelihood is

  ln L(θ) = −½ ( n · ln σ̂² + ln det R )

The core tries all θ on a grid (0.3 … 30 per variable) and keeps the best (`_fit()` returns `lnL`). Two
properties make Kriging the workhorse of surrogate optimisation:

1. It **interpolates**: at a training point ŷ = y and s = 0 (only the tiny nugget 10⁻⁸ prevents exact zero).
2. It **knows where it is uncertain**: s grows with the distance from the data. Expected improvement (chapter 6.3)
   uses exactly this.

`fb_kriging_info()` shows both for the bending-frequency model:

```python
    j = min(range(1, len(Z)), key=lambda m: math.dist(Z[0], Z[m]))
    mid = [(a + b) / 2 for a, b in zip(Z[i], Z[j])]
    return {"theta": model.theta, "mu": model.mu, "sigma": math.sqrt(model.s2), "sd_train": model.predict(Z[i], True)[1],
            "sd_mid": model.predict(mid, True)[1], "dist": math.dist(Z[i], Z[j])}
```

```
## 5.4 Kriging of f_bend (20 DOE points)
  theta (h, a, k) [1.0, 0.3, 0.3], mu 93.78 Hz, sigma 26.70 Hz; prediction sd at a training point 0.0027 Hz, half-way to the nearest point (distance 0.132) 0.012 Hz
```

- θ_h = 1.0 is larger than θ_a = θ_k = 0.3: the model has **learned** that h drives the bending frequency, without
  being told.
- θ_a and θ_k sit on the **lowest grid value**. The likelihood would prefer even smaller values (weaker
  activity); the grid limits the model here – a finer or wider θ search (MATLAB `fitrgp`, DesignXplorer) would fit a
  little better. Check the θ values of your Kriging models for this sign.
- The prediction standard deviation is 0.003 Hz at a training point and 0.012 Hz half-way to the nearest point –
  tiny compared with σ = 26.7 Hz, because f_bend is very smooth. For sag the same numbers would be much larger
  (LOO 15 %).

### 5.5 Sensitivity analysis on the surrogate – which variables matter

Once a surrogate exists, thousands of evaluations cost nothing. That allows a **global sensitivity analysis**:
which share of the variation of a response comes from which variable? The first-order **Sobol index** is

  Sᵢ = V( E(y | xᵢ) ) / V(y)

– the variance of the response that would remain if you knew only xᵢ, divided by the total variance. Sᵢ = 1: the
response depends on xᵢ alone; Sᵢ ≈ 0: xᵢ can be fixed without loss; Σ Sᵢ < 1: interactions between variables
exist.

The Monte Carlo estimate (Jansen form) uses two independent random samples A and B and the mixed samples A_B⁽ⁱ⁾
(sample A with column i taken from B). f(B) and f(A_B⁽ⁱ⁾) share only xᵢ, so

  V − Vᵢ = (1/2N) Σ ( f(B) − f(A_B⁽ⁱ⁾) )²

```python
    A = [[rnd.random() for _ in range(k)] for _ in range(N)]
    B = [[rnd.random() for _ in range(k)] for _ in range(N)]
    fA = [model.predict(a) for a in A]
    fB = [model.predict(b) for b in B]
    ...
    for i in range(k):
        fABi = [model.predict([b[j] if j == i else a[j] for j in range(k)]) for a, b in zip(A, B)]
        Vi = V - sum((fb_ - fab) ** 2 for fb_, fab in zip(fB, fABi)) / (2 * N)
        S.append(Vi / V if V > 0 else 0.0)
```

It needs N·(k + 2) = 5000 surrogate evaluations per response – a second on the surrogate, but 17 days with a
5-minute Ansys model. Sensitivity analysis is only practical **on a surrogate**.

```
## 5.5 Sensitivity: first-order Sobol indices on the Kriging (N 1000)
  mass_kg  S_h 1.000, S_a 0.033, S_k 0.033 (sum 1.066)
  f_rigid  S_h 0.074, S_a 0.248, S_k 0.773 (sum 1.095)
  f_bend   S_h 0.995, S_a 0.038, S_k 0.031 (sum 1.063)
  sag      S_h 0.028, S_a 0.021, S_k 0.950 (sum 0.999)
```

The indices have a Monte Carlo error of about ±0.03 with N = 1000 (mass cannot depend on a or k at all, yet
S_a = 0.033 – that is the noise level; sums slightly above 1 have the same cause). Increase N to 10 000 for two
decimals. Read within this accuracy:

| Response | Driven by | Meaning for the design |
|---|---|---|
| mass | h only | the objective is one-dimensional – a and k are "free" for the constraints |
| f_bend | h only (0.995) | the bending limit fixes the RHS height; the mount position hardly matters for this frame |
| f_rigid | k (0.77), a (0.25) | isolation is set by the mount stiffness first, by the mount spacing second (pitch mode) |
| sag | k only (0.95) | sag and f_rigid both depend on k – in **opposite directions** (soft mounts isolate well but sag) |

This table explains the whole optimisation in advance: h is pushed down until f_bend = 60.3 Hz, k is squeezed
between "isolation" (k small) and "sag" (k large), and a is used to tune the pitch mode. Chapter 6 confirms it, and
chapter 6.7 shows why this squeeze makes the deterministic optimum fragile.

**Screening:** with many variables (10–30 in a real CAD model: wall thicknesses, radii, rib positions…) run a small
DOE (2k – 4k points), compute the Sobol indices on a rough surrogate and **fix every variable with Sᵢ (and its total
index) below about 0.01–0.02**. The real study then runs with the 3–6 variables that matter. In Ansys DesignXplorer
this is the "Sensitivities" chart; MATLAB has no single function – the 15 lines above in MATLAB syntax do it.

---

## 6. Optimisation strategies

### 6.1 Direct search on the solver versus the surrogate workflow

The same problem was solved twice (chapter 1 summary): with the surrogate workflow (`ego()`) and with a
multi-start Nelder–Mead directly on the solver (`direct()`, penalty factor r = 1000, budget 150 calls per start).

```
## 6.1 Direct search vs surrogate workflow (same problem)
  surrogate (EGO): 44 solver calls -> 41.20 kg, feasible yes
  direct (multi-start Nelder-Mead, penalty r 1e3, budget 150 per start): 764 calls -> 40.76 kg, feasible no, max g +0.0168
  at 5 min per CAE run: surrogate 3.7 h, direct 63.7 h
```

- The surrogate workflow needs **6 %** of the solver calls (44 against 764) – an afternoon instead of almost three
  days with a real Ansys model.
- The direct result looks **lighter** (40.76 kg) but violates the bending limit by 1.7 % (59.3 Hz < 60.3 Hz).
  Chapter 6.2 shows that this is not bad luck but a property of the penalty method.
- A direct search is still the right tool when the solver is **cheap** (analytical models like the programs of
  M2–M11, a run below one second) or when the problem has **many variables** (> 15–20), where surrogates need too
  many points. Gradient methods (`fmincon` with SQP) on the solver are efficient only if the solver delivers
  **gradients** (adjoint sensitivities: Ansys topology / shape optimisation, Abaqus Tosca) – finite differences
  through a re-meshing CAE model give noisy gradients and are not recommended.

| Situation | Strategy |
|---|---|
| Solver < 1 s, any number of variables | direct: gradient-based (smooth) or Nelder–Mead / GA (non-smooth) |
| Solver minutes, 2–10 variables | **surrogate workflow** (DOE + Kriging + infill) – this chapter |
| Solver minutes, 10–30 variables | screening (5.5) first, then the surrogate workflow with the important variables |
| Solver with adjoint gradients (topology, shape) | gradient-based inside the CAE program (Ansys, Tosca) |
| Hours per run (crash, non-linear contact) | small DOE + Kriging, 5–10 infill points, accept a "good" design |

### 6.2 Constraint handling – why the penalty result is infeasible

The core penalty objective (used by `direct()` and `surrogate_optimum()`) is the **exterior quadratic penalty**

  φ(x) = mass(x) + r · Σ max(0, gⱼ(x))²

At the true constrained optimum x*, the mass gradient pulls outward (lighter) and the penalty is zero with zero
slope. So φ always has its minimum **slightly outside** the feasible region, where the penalty slope
2r·g·∇g balances the mass gradient. The remaining violation is about g ≈ |∇mass| / (2r|∇g|) – it shrinks
**like 1/r** but never becomes zero. `fb_penalty_study()` shows it on the final Kriging and checks every optimum with
the true solver:

```python
    for r in rs:
        f, _ = fb_sur_obj(P, models, r=r)
        z, v = nelder_mead(f, z0, [0.05] * 3, tol=1e-12, itmax=800)
        x = fb_from_z(P, z)
        R = responses(P, x)
        g = constraints(P, R)
```

```
## 6.2 Penalty factor study (optimum on the final Kriging, verified with the true solver)
  r   1e+02: h 69.34, a 202.9, k 103.16 -> true mass 38.102 kg, f_bend 52.91 Hz, largest g +0.12251, feasible no
  r   1e+03: h 78.22, a 227.3, k 104.53 -> true mass 40.889 kg, f_bend 59.57 Hz, largest g +0.01214, feasible no
  r   1e+04: h 79.09, a 229.3, k 104.69 -> true mass 41.161 kg, f_bend 60.23 Hz, largest g +0.00122, feasible no
  r   1e+05: h 79.17, a 229.5, k 104.70 -> true mass 41.188 kg, f_bend 60.29 Hz, largest g +0.00015, feasible yes
```

Each factor 10 on r reduces the violation by a factor 10 (0.123 → 0.012 → 0.0012 → 0.0002), exactly as the
1/r estimate says. r = 1000, the value used by the direct search, leaves a 1.2 % violation – the reason for the
infeasible direct result in 6.1. Large r is not free: the penalty function becomes a steep valley, and simplex or
gradient methods slow down or stop early (ill-conditioning). Practical rules:

- **Normalise the constraints** (the core uses g = response/limit − 1), so that one r fits all of them.
- Increase r in steps (10², 10³, 10⁴ …) and restart from the last optimum (sequential penalty), or use an
  **augmented Lagrangian** (M1 chapter 29) which reaches g = 0 with a moderate r.
- Or give the optimiser the constraints directly: `fmincon(..., nonlcon)` (SQP, interior point) in MATLAB,
  the constrained algorithms of DesignXplorer (MOGA, NLPQL, ASO). These return designs **on** the limit.
- Whatever method: **check the final design with the true solver against the limits.** The tolerance used in the
  core (`feasible()`, |g| ≤ 0.001, i.e. 0.06 Hz at 60.3 Hz) states what "on the limit" means.

The surrogate workflow avoids the problem in a different way. Its infill criterion (6.3) multiplies the expected
improvement by the **probability of feasibility**, and the best design is chosen only among **true solver results
that satisfy the limits**. A surrogate error can never sneak an infeasible design into the result – it can only
cost a few extra calls.

### 6.3 Efficient global optimisation (EGO) – expected improvement

Optimising only on the surrogate (go to the surrogate minimum, run the solver there, refit, repeat) has a known
weakness: it **exploits** the current model and never looks where the model is uncertain. If the first DOE missed
the region of the true optimum, the loop never finds it. Jones, Schonlau and Welch (1998) proposed the **expected
improvement**: if the Kriging predicts mean μ(z) and standard deviation s(z), and f_min is the best feasible value
found so far, the improvement I = max(f_min − Y, 0) of a normally distributed Y has the expectation

  EI(z) = (f_min − μ) · Φ(u) + s · φ(u),  u = (f_min − μ)/s

(Φ, φ = cumulative and density function of the standard normal distribution; core `expected_improvement()`).
The first term rewards a low predicted value (**exploitation**), the second rewards uncertainty (**exploration**).
`fb_ei_table()` evaluates it for f_min = 41.2 kg:

```
## 6.3 Expected improvement EI(f_min 41.2 kg; mu, s)
  mu \ s     0.05     0.30     1.00
   40.50   0.7000   0.7010   0.8429
   41.00   0.2000   0.2453   0.5069
   41.20   0.0199   0.1197   0.3989
   41.50   0.0000   0.0250   0.2668
   42.00   0.0000   0.0004   0.1202
```

- With a small s (model certain) EI ≈ max(f_min − μ, 0): only points predicted better than 41.2 kg are interesting.
- A point predicted **worse** (μ = 42.0 kg) but very uncertain (s = 1.0 kg) still has EI = 0.12 kg – more than a
  point predicted equal to the best with a certain model (0.02). That is exploration: such a point may hide a
  better region.
- At μ = f_min, EI = s/√(2π) (0.3989 for s = 1) – one of the self-test checks.

Constraints enter through the **probability of feasibility**: each constraint has its own Kriging with mean μⱼ and
deviation sⱼ, and P(feasible) = Π Φ( ±(limitⱼ − μⱼ)/sⱼ ). The core `ego()` maximises EI · P(feasible) and, in every
iteration, also adds the surrogate optimum itself – one exploitation point and one exploration point per iteration.

### 6.4 Convergence and when to stop

```
## 6.4 EGO convergence and stopping
  iteration  1: 22 calls, best 41.704 kg, gain 0.000 kg
  iteration  2: 24 calls, best 41.704 kg, gain 0.000 kg
  iteration  3: 26 calls, best 41.204 kg, gain 0.500 kg
  iteration  4: 28 calls, best 41.204 kg, gain 0.000 kg
  ...
  iteration 10: 40 calls, best 41.204 kg, gain 0.000 kg
  iteration 11: 42 calls, best 41.204 kg, gain 0.000 kg
  iteration 12: 44 calls, best 41.204 kg, gain 0.000 kg
  largest constrained EI left after the last iteration: 0.00000 kg at h 125.0, a 316.5, k 101.8
  probability of feasibility of the best point on the surrogate: 0.999
```

- The first DOE (20 points) already contained a feasible design of 41.70 kg (iteration 1 shows the best of the 20
  DOE points plus 2 infill points). Most of the gain (−12.6 % of the −13.7 % against the current design) comes from
  the DOE + first surrogate; the infill points find the last 0.5 kg.
- The best mass improves in **steps**. Here the final design is found at iteration 3 and iterations 4–12 only
  confirm it. That is luck, not a rule: with another seed or a slightly different DOE the last improvement can come
  late (in a test run with a different mesh the last 0.18 kg came only at iteration 11). A rule like "stop after 3
  iterations without improvement" is therefore risky. Better stopping criteria:
  1. **maximum remaining EI** below a small fraction of the objective (here < 10⁻⁵ kg after iteration 12, i.e.
     nothing left to gain where the model is confident – `fb_final_ei()`),
  2. a fixed **budget** of solver calls (the usual rule in industry: decide what the study may cost),
  3. the **true check** of the surrogate optimum agrees with the prediction within the LOO error.
- P(feasible) of the best point is 0.999, although the design lies **on** two limits (f_rigid 10.00 Hz, f_bend
  60.3 Hz) with the sag just inside (5.96 mm). A probability near 1 on an active limit only means that the surrogate
  trusts its own prediction there. It says nothing about the scatter of the real frame: any tolerance on the mounts,
  the walls or the masses pushes this design over a limit (chapter 6.7).

### 6.5 Multi-objective: how much does more stiffness cost?

The "minimum mass with f_bend ≥ 60.3 Hz" question hides a decision: the 60.3 Hz is 1.25 × the 2nd compressor order.
Would 70 Hz or 80 Hz be worth the extra steel? With two objectives (mass ↓, f_bend ↑) there is no single optimum,
but a **Pareto front**: the designs where one objective can only be improved by worsening the other.

The **ε-constraint method** turns it into a series of single-objective problems: minimise mass subject to
f_bend ≥ ε for several ε – each solved on the surrogate in a fraction of a second and then checked once on the
true solver (`fb_pareto()`):

```python
    for e in eps:
        f, Q = fb_sur_obj(P, models, limits={"f_bend_min": e}, r=1e5)
        z, _ = nelder_mead(f, z0, [0.05] * 3, tol=1e-12, itmax=800)
        x = fb_from_z(P, z)
        m_sur = models["mass_kg"].predict(z)
        R = responses(P, x)
```

```
## 6.5 Multi-objective: mass vs bending frequency (epsilon-constraint on the surrogate, true check)
  f_bend >=  50.0 Hz: h  65.90, a 231.3, k  103.4 -> surrogate 37.02 kg / 50.0 Hz, true 37.02 kg / 50.0 Hz, largest g -0.0004 (f_bend) feasible
  f_bend >=  55.0 Hz: h  72.37, a 230.6, k  104.1 -> surrogate 39.05 kg / 55.0 Hz, true 39.05 kg / 55.0 Hz, largest g -0.0000 (f_rigid) feasible
  f_bend >=  60.3 Hz: h  79.17, a 229.5, k  104.7 -> surrogate 41.19 kg / 60.3 Hz, true 41.19 kg / 60.3 Hz, largest g +0.0002 (sag) feasible
  f_bend >=  65.0 Hz: h  85.17, a 228.1, k  105.1 -> surrogate 43.07 kg / 65.0 Hz, true 43.07 kg / 65.0 Hz, largest g +0.0035 (sag) NOT feasible
  f_bend >=  70.0 Hz: h  91.53, a 225.4, k  105.3 -> surrogate 45.06 kg / 70.0 Hz, true 45.07 kg / 70.0 Hz, largest g +0.0094 (sag) NOT feasible
  f_bend >=  80.0 Hz: h 104.13, a 214.2, k  104.5 -> surrogate 49.01 kg / 80.0 Hz, true 49.03 kg / 80.1 Hz, largest g +0.0329 (sag) NOT feasible
  f_bend >=  90.0 Hz: h 116.50, a 193.3, k  101.6 -> surrogate 52.91 kg / 90.0 Hz, true 52.91 kg / 90.0 Hz, largest g +0.0777 (sag) NOT feasible
```

Two lessons, one about the design and one about the workflow:

1. **The front is almost a straight line: about 0.40 kg per Hz** (37.0 kg at 50 Hz, 52.9 kg at 90 Hz). Raising the
   bending margin from 1.25 to 1.5 × the 2nd order (72 Hz) costs about 4.7 kg of steel (+11 %) – a small price for a
   frame that will also carry an unknown future receiver. This is the kind of number a design review needs.
2. **Mass and f_bend are predicted perfectly** (surrogate = true within 0.01 kg / 0.1 Hz), but the designs above
   65 Hz violate the **sag** limit by up to 8 % on the true solver. The sag surrogate is the weakest model (LOO
   15 %, chapter 5.3), and its data were concentrated near the 60 Hz optimum by the infill loop. The surrogate
   optimiser sees a feasible design that does not exist. **Every point of a Pareto front from a surrogate must be
   verified**, and for the region you choose, run a few more infill points (or re-optimise k with the true solver:
   sag depends on k alone, a 1-D search with 3–4 runs).

MATLAB: `gamultiobj` or `paretosearch` find the whole front directly (many evaluations – use them on the surrogate,
e.g. a `fitrgp` model); Ansys DesignXplorer: MOGA on a response surface, then "verify candidates".

### 6.6 Discrete catalogue sizes

The optimiser returns h = 79.2 mm; the steel stockist sells RHS 80 × 60 × 4, not 79.2. Rounding **up** to the next
catalogue size is safe for f_bend but changes the balance of the other limits, so a and k must be chosen again for
the catalogue size. With h fixed the mass is fixed too, so the best choice of a and k is the one with the **largest
margin**: minimise the largest normalised constraint g_max (a min-max problem), then check with the true solver
(`fb_catalogue()`):

```python
    for h in FB_CATALOGUE_H:
        zh = (h - P["vars"][0][1]) / (P["vars"][0][2] - P["vars"][0][1])
        def f(z2):
            zz = [zh] + list(z2)
            if any(v < 0 or v > 1 for v in zz):
                return 1e9
            return max(constraints(P, {key: m.predict(zz) for key, m in models.items()}).values())
        z2, _ = nelder_mead(f, z0[1:], [0.05, 0.05], tol=1e-12, itmax=600)
```

```
## 6.6 Discrete catalogue heights (a, k re-optimised for each h, true check)
  RHS  60x60x4: a  50.0, k  111.5 -> 35.17 kg, f_rigid 11.87, f_bend 48.1, sag 5.50 -> NOT feasible
  RHS  70x60x4: a  58.0, k   93.5 -> 38.31 kg, f_rigid 10.90, f_bend 54.7, sag 6.64 -> NOT feasible
  RHS  80x60x4: a 244.9, k  105.9 -> 41.45 kg, f_rigid 9.91, f_bend 60.8, sag 5.94 -> feasible
  RHS  90x60x4: a 423.5, k  120.3 -> 44.59 kg, f_rigid 8.75, f_bend 67.9, sag 5.29 -> feasible
  RHS 100x60x4: a 600.0, k  133.2 -> 47.73 kg, f_rigid 7.66, f_bend 75.7, sag 4.84 -> feasible
  RHS 120x60x4: a 600.0, k  142.3 -> 54.01 kg, f_rigid 7.81, f_bend 91.9, sag 4.64 -> feasible
  RHS 140x60x4: a 600.0, k  146.2 -> 60.29 kg, f_rigid 7.80, f_bend 108.2, sag 4.62 -> feasible
  RHS 160x60x4: a 600.0, k  144.9 -> 66.57 kg, f_rigid 7.66, f_bend 124.5, sag 4.77 -> feasible
  lightest feasible catalogue size: RHS 80x60x4, a 244.9 mm, k 105.9 N/mm, 41.45 kg
```

- **RHS 80 × 60 × 4** with a = 245 mm and k = 106 N/mm is the catalogue answer: 41.45 kg, only 0.25 kg above the
  continuous optimum, with all three limits met and small margins (9.91 Hz, 60.8 Hz, 5.94 mm).
- The 60 and 70 mm tubes cannot reach 60.3 Hz whatever a and k are – the min-max search shows *how far* they miss
  (48 and 55 Hz). That is useful: the designer sees immediately that only a different section family (wider or
  thicker tube) would make them work.
- For the heavier tubes the min-max search moves the mounts to the bound a = 600 mm (closest together) and stiffens
  them: with mass no longer an issue, the largest margin comes from separating the mount modes from 10 Hz *and* the sag from
  6 mm. Note also the mount stiffness: **106 N/mm is not a catalogue value either**. Real rubber mounts come in
  steps (e.g. 80, 100, 125, 160 N/mm, check the supplier); repeat the same procedure with k fixed to the nearest
  values and pick the best combination. With two discrete variables the "branch over the catalogue" is a small
  table, not an optimisation problem.

For many discrete variables (plate thicknesses, standard sections, number of ribs) use a **genetic algorithm with
integer variables** (`ga(..., IntCon)` in MATLAB, M1 chapter 29) on the surrogate, or "round, fix, re-optimise the
continuous rest" in steps as above.

### 6.7 Robust design – the optimum meets real parts

The deterministic optimum lies on two limits at once, with the third (sag) just inside. Real frames are not exactly the model: rubber mounts are
delivered with about **±20 %** stiffness tolerance (Shore hardness scatter, temperature, check the supplier's data
sheet), cold-formed RHS walls with about **±10 %** thickness tolerance (EN 10219 style, check), and the payload
masses (compressor variant, receiver fittings, oil, air) are known to perhaps **±10 %**. `fb_robust_mc()` samples
these tolerances (uniform, 250 samples) and runs the **true solver** for each sample:

```python
def fb_perturbed(P, x, kf=1.0, tf=1.0, mf=1.0):
    """True solver with mount stiffness factor kf, wall factor tf and payload mass factor mf."""
    Q = dict(P, t=P["t"] * tf, masses=[[xm, m * mf] for xm, m in P["masses"]])
    r = frame_fe(Q, x[0], x[1], x[2], k_factor=kf)
    ...
    for _ in range(n):
        R = fb_perturbed(P, x, 1 + FB_TOL["k"] * (2 * rnd.random() - 1), 1 + FB_TOL["t"] * (2 * rnd.random() - 1),
                         1 + FB_TOL["mass"] * (2 * rnd.random() - 1))
```

```
## 6.7 Robust design: tolerances k +/-20 %, wall +/-10 %, payload +/-10 % (uniform, 250 samples)
  deterministic optimum h 79.2, a 233.6, k 105.5: P(f_rigid > 10) 0.50, P(f_bend < 60.3) 0.55, P(sag > 6) 0.49, P(any) 0.99; f_bend 60.2 +/- 1.1 Hz
```

**Almost every sample violates at least one limit** (P(any) = 0.99). The reason is the squeeze found in chapter 5.5:
a stiffer-than-nominal mount raises the mount frequency above 10 Hz, a softer one sags more than 6 mm – there is no
mount in the tolerance band that satisfies both. And f_bend scatters by ±1.1 Hz around the limit. This is the
typical fate of an optimum that has been squeezed against several limits: **optimisation removes all hidden
safety margins**, so the tolerances must be put back explicitly.

**Back-off by worst corners.** `fb_corner_factors()` evaluates the worst corner of the tolerance box for each limit
separately (f_rigid: stiff mounts; sag: soft mounts and heavy payload; f_bend: thin wall), takes the ratio worst /
nominal and tightens each limit by it:

```python
    fr = max(fb_perturbed(P, x, 1 + kk, tf, mf)["f_rigid"] for tf in (1 - t, 1 + t) for mf in (1 - mm, 1 + mm)) / R0["f_rigid"]
    fbend = min(fb_perturbed(P, x, kf, 1 - t, mf)["f_bend"] for kf in (1 - kk, 1 + kk) for mf in (1 - mm, 1 + mm)) / R0["f_bend"]
    sg = max(fb_perturbed(P, x, 1 - kk, tf, 1 + mm)["sag"] for tf in (1 - t, 1 + t)) / R0["sag"]
```

Then the problem is solved again with the tightened limits – first on the surrogate, then refined with a small
budget **on the true solver** (`fb_robust_design()`), because the surrogate is least accurate exactly at the new,
unvisited limits:

```
  worst-corner ratios: f_rigid x1.152, f_bend x0.948, sag x1.374 -> tightened limits f_rigid <= 8.68 Hz, f_bend >= 63.6 Hz, sag <= 4.37 mm
  surrogate optimum with tightened limits: h 84.9, a 482.0, k 133.5 -> 42.99 kg; true check: largest g +0.0848 (NOT OK)
  after local refinement on the true solver (50 calls): h 85.1, a 559.5, k 147.2 -> 43.03 kg, f_rigid 8.41, f_bend 63.6, sag 4.30; largest g -0.0001 (OK)
  robust design: P(f_rigid > 10) 0.00, P(f_bend < 60.3) 0.00, P(sag > 6) 0.00, P(any) 0.00; mass +4.4 % vs deterministic optimum
```

- The corner ratios are the "safety factors" the tolerances demand: f_rigid can rise by 15.2 % (√1.2 from the mount
  plus the lighter payload), f_bend can fall by 5.3 %, the sag can grow by 37 %.
- The robust design moves the mounts **closer together** (a = 560 mm from each end, spacing 1381 mm instead of
  2033 mm) and makes them **stiffer** (147 N/mm). Stiffer mounts cut the sag; the smaller spacing lowers the pitch
  mode (its stiffness grows with the square of the spacing), so that the stiffer mounts still isolate. The tube grows from 79 to 85 mm for the bending margin.
- The surrogate optimum missed the tightened limits by 8.5 % (largest g +0.085) – the surrogate is weakest at the new,
  unvisited limits; 50 calls on the true solver fixed that. In a real Ansys study, replace those 50 calls by 4–6 EGO
  infill iterations with the tightened limits.
- Result: **no sample out of 250 violates a limit**, for **+4.4 % mass** (43.03 kg against 41.20 kg). This, not the
  41.20 kg, is the design to draw. With the catalogue rounding of 6.6 it becomes RHS 90 × 60 × 4 (85 mm is not
  stocked) – repeat 6.6 with the tightened limits before release.

The corner method is conservative (all worst cases at once for each limit). A **reliability-based** design asks
instead for a target probability, e.g. P(violation) ≤ 1 % (M1 chapter 31.7 RBDO). With 250 samples the smallest
measurable probability is about 1/250 = 0.4 %; for 0.1 % or less use more samples on the **surrogate** (cheap) and
check the final design with a few hundred true runs, or use FORM (first-order reliability method, M1) on the
surrogate. MATLAB: `sdo.optimize` with uncertain parameters (Simulink Design Optimization), or a loop of
`surrogateopt` around `normrnd` samples; Ansys DesignXplorer: "Six Sigma Analysis".

### 6.8 Verification of the optimum

The last step of every optimisation is the **true solver at the final design** – with the settings of the
production model, not those of the study. If the study used a coarse mesh for speed, the final check uses the
fine one; if the study used a linear model, the check uses the full model (contact, pre-stress) once.

```
## 6.8 Verification of the optimum on the true solver and finer meshes
   8 elements: mass 41.204 kg, f_rigid 9.9987 Hz, f_bend 60.311 Hz, sag 5.9581 mm, sigma 17.64 MPa -> feasible
  16 elements: mass 41.204 kg, f_rigid 9.9987 Hz, f_bend 60.311 Hz, sag 5.9581 mm, sigma 17.69 MPa -> feasible
  32 elements: mass 41.204 kg, f_rigid 9.9984 Hz, f_bend 60.311 Hz, sag 5.9582 mm, sigma 17.69 MPa -> feasible
```

The frequencies do not change with the mesh (beam elements with consistent mass converge very fast, chapter 4);
the stress changes by 0.3 % from 8 to 16 elements and then stays – far from its 100 MPa limit. In a solid Ansys
model the bending frequency would typically move by 1–3 % between the study mesh and a converged mesh – more than
the 0.006 Hz margin of the deterministic optimum. That is one more reason to optimise with **margins** (6.7) and
to compute the margin from a mesh study (chapter 4, GCI of M1 chapter 28).

**Checklist – end of an optimisation study**

| Check | Done here |
|---|---|
| Surrogates validated (LOO / test points) for every response in an active constraint | 5.2, 5.3: f_bend and f_rigid OK, sag weak → verified by the true solver |
| Final design run with the true solver, all limits checked | 6.8 |
| Mesh / model settings of the final check at production level | 6.8 (8 → 32 elements) |
| Tolerances and scatter taken into account | 6.7 (corner back-off, Monte Carlo 250 runs) |
| Rounded to catalogue / manufacturable values and re-checked | 6.6 (RHS 80; repeat for the robust design → RHS 90) |
| Cost of the decision visible (Pareto front) | 6.5: 0.40 kg per Hz |
| Number of solver calls and the stopping reason documented | 6.1, 6.4 |

**MATLAB equivalents for chapters 5–6** (Optimization, Global Optimization and Statistics toolboxes; check the
syntax of your release):

| This guide | MATLAB |
|---|---|
| `lhs()`, `fb_maximin_lhs()` | `lhsdesign(n, k, 'criterion', 'maximin')` |
| `rsm_fit()`, `fb_r2()` | `fitlm(X, y, 'quadratic')` (R², adjusted R² in the output) |
| `Kriging` | `fitrgp(X, y, 'KernelFunction', 'ardsquaredexponential')` (one length scale per variable = 1/√θ) |
| `loo_error()` | `crossval` / `kfoldLoss(crossval(mdl, 'Leaveout', 'on'))` |
| `fb_sobol()` | own code (15 lines) on `predict(mdl, X)` |
| `ego()` (EI + P(feasible)) | `surrogateopt` (RBF surrogate, similar idea) or `bayesopt` (Kriging + EI, unconstrained or with `XConstraintFcn`) |
| penalty + Nelder–Mead | `fmincon(fun, x0, [], [], [], [], lb, ub, nonlcon)` – constraints handled exactly |
| `fb_pareto()` | `gamultiobj` / `paretosearch` (on the surrogate) |
| catalogue sizes | `ga(..., 'IntCon', 1)` with an index into the catalogue list |
| `fb_robust_mc()` | loop over `rand`-sampled parameters calling the solver (or the `fitrgp` surrogate) |


---

## 7. From the optimum to manufacturing

An optimiser returns numbers such as h = 79.2 mm, a = 230.5 mm, k = 104.7 N/mm. None of them can be bought. The
optimum also sits **exactly on three limits** (9.99 Hz, 60.3 Hz, 6.00 mm), which means it has no margin at all. This
chapter turns the mathematical optimum into a frame that can be ordered, welded, installed and tested:

| Step | Question | Section |
|---|---|---|
| Catalogue rounding | Which standard RHS, and what happens to the other variables? | 7.1 |
| Real parts | Which isolation mount from a catalogue, at which position? | 7.2 |
| Re-verification | Is the final design still feasible on a finer mesh? What margins are left? | 7.3 |
| Tolerances | Do all limits hold for the worst combination of wall thickness, mount stiffness and masses? | 7.4, 7.4b |
| Drawing | Cut list, welds, hole positions | 7.5 |
| Cost | What does each variant cost? | 7.6 |
| Test | How is the prototype measured, and what is accepted? | 7.7 |
| Calibration | What if the test does not match? | 7.8 |
| Data | How are models, runs and results kept reproducible? | 7.9 |
| Your tools | The exported templates, line by line | 7.10 |
| Organisation | Checklist, effort, typical failures | 7.11 |

All results below come from `python optflow.py ch78`. The add-on starts from the optimum of chapter 6, stored as a
constant so that the chapter does not repeat the 44 EGO solver calls:

```python
FC_X_OPT = [79.2, 230.5, 104.7]      # a point on the flat optimum of the default problem (examples: h 79.2, a 233.6, k 105.5 - same 41.20 kg)
```

### 7.1 Catalogue rounding – the discrete outer loop

Cold-formed hollow sections (EN 10219) come in fixed sizes. The data table of the add-on holds typical sizes around
the optimum, with their catalogue mass per metre (which includes the corner radii):

```python
FC_RHS = [   # EN 10219 cold-formed RHS h x b x t mm, mass kg/m with corner radii (typical catalogue values - check)
    (60, 40, 4, 5.64), (80, 40, 4, 6.90), (70, 50, 4, 6.97), (80, 60, 4, 8.15), (90, 50, 4, 8.15), (100, 50, 4, 8.78),
    (100, 60, 4, 9.41), (80, 60, 5, 9.99), (120, 60, 4, 10.7), (100, 60, 5, 11.6), (120, 80, 4, 11.9)]
```

The core model fixes the width b and the wall t in the problem dictionary and treats only h as a variable. To test
another catalogue width or wall, a copy of the problem is made:

```python
def fc_section_P(P, h, b, t):
    """Problem with another RHS width / wall (the core keeps b and t in P; h stays a variable)."""
    return dict(P, b=float(b), t=float(t))
```

**First attempt – round h and keep a and k.** Every catalogue section is solved once with the true solver, using
the optimum mount position and stiffness unchanged:

```python
def fc_catalogue(P, a, k, n_el=None):
    """Every catalogue RHS with the optimised mount position and stiffness, solved with the true (virtual) solver:
    model mass (sharp corners), catalogue mass, responses, feasibility; the lightest feasible section."""
    rows = []
    for h, b, t, kgm in FC_RHS:
        Q = fc_section_P(P, h, b, t)
        R = responses(Q, [h, a, k], n_el)
        rows.append({"rhs": "%dx%dx%d" % (h, b, t), "h": h, "b": b, "t": t, "kg_m": kgm, "mass_cat": 2 * kgm * P["L"] / 1000,
                     "R": R, "g": constraints(Q, R), "ok": feasible(Q, R)})
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "best": min(ok, key=lambda r: r["mass_cat"]) if ok else None}
```

```
## 7.1 Catalogue rounding: every EN 10219 RHS with the optimum a 230.5 mm, k 104.7 N/mm (true solver)
  RHS 60x40x4    5.64 kg/m -> frame  28.2 kg (model  28.9): f_rigid 10.21, f_bend   41.1 Hz, sag 5.71 mm, sigma  34.5 MPa -> fails f_rigid, f_bend
  RHS 80x40x4    6.90 kg/m -> frame  34.5 kg (model  35.2): f_rigid 10.12, f_bend   55.2 Hz, sag 5.86 mm, sigma  22.8 MPa -> fails f_rigid, f_bend
  RHS 70x50x4    6.97 kg/m -> frame  34.9 kg (model  35.2): f_rigid 10.11, f_bend   50.8 Hz, sag 5.86 mm, sigma  23.9 MPa -> fails f_rigid, f_bend
  RHS 80x60x4    8.15 kg/m -> frame  40.8 kg (model  41.4): f_rigid  9.99, f_bend   60.9 Hz, sag 6.01 mm, sigma  17.6 MPa -> fails sag
  RHS 90x50x4    8.15 kg/m -> frame  40.8 kg (model  41.4): f_rigid  9.99, f_bend   65.8 Hz, sag 6.01 mm, sigma  16.8 MPa -> fails sag
  RHS 100x50x4   8.78 kg/m -> frame  43.9 kg (model  44.6): f_rigid  9.93, f_bend   73.5 Hz, sag 6.08 mm, sigma  14.5 MPa -> fails sag
  RHS 100x60x4   9.41 kg/m -> frame  47.0 kg (model  47.7): f_rigid  9.86, f_bend   76.7 Hz, sag 6.15 mm, sigma  13.0 MPa -> fails sag
  RHS 80x60x5    9.99 kg/m -> frame  50.0 kg (model  51.0): f_rigid  9.77, f_bend   63.3 Hz, sag 6.23 mm, sigma  15.1 MPa -> fails sag
  RHS 120x60x4  10.70 kg/m -> frame  53.5 kg (model  54.0): f_rigid  9.73, f_bend   92.7 Hz, sag 6.30 mm, sigma  10.2 MPa -> fails sag
  RHS 100x60x5  11.60 kg/m -> frame  58.0 kg (model  58.9): f_rigid  9.61, f_bend   79.6 Hz, sag 6.42 mm, sigma  11.2 MPa -> fails sag
  RHS 120x80x4  11.90 kg/m -> frame  59.5 kg (model  60.3): f_rigid  9.59, f_bend   98.9 Hz, sag 6.45 mm, sigma   8.6 MPa -> fails sag
  feasible with the optimum a and k unchanged: 0 of 11 sections
```

**Not one section is feasible.** The reason is visible in the sag column. The continuous optimum used the full sag
limit (6.00 mm) with k = 104.7 N/mm. Any section heavier than h = 79.2 × 60 × 4 makes the frame heavier, so the mounts
sink further (sag = weight / total stiffness) and the sag limit is broken. Sections lighter than the optimum fail the
bending frequency instead. This is the normal situation: **an optimum with active limits cannot be rounded one
variable at a time.**

**Correct method – re-tune the continuous variables for every discrete choice.** For each catalogue section the
remaining continuous variables (a, k) are moved so that the worst normalised constraint becomes as small as
possible. This is a small inner optimisation with the true solver, limited to 80 calls:

  minimise  g_max(a, k) = max_i g_i(h_catalogue, a, k),   g_i ≤ 0 means "limit met"

```python
def fc_retune(Q, h, a0, k0, fix_k=False, budget=80):
    """Inner re-optimisation after a discrete choice: keep the catalogue section h (and the catalogue mount k if
    fix_k) and move the continuous variables (a, k) to minimise the worst normalised constraint (true solver).
    Normalised variables, Nelder-Mead with an evaluation budget."""
    lo = [v[1] for v in Q["vars"]][1:]
    hi = [v[2] for v in Q["vars"]][1:]
    def unpack(z):
        a = lo[0] + z[0] * (hi[0] - lo[0])
        k = k0 if fix_k else lo[1] + z[1] * (hi[1] - lo[1])
        return a, k
    def f(z):
        if any(v < 0 or v > 1 for v in z):
            return 1e9
        a, k = unpack(z)
        return max(constraints(Q, responses(Q, [h, a, k])).values())      # worst normalised constraint (<= 0 feasible)
    z0 = [(a0 - lo[0]) / (hi[0] - lo[0])] + ([] if fix_k else [(k0 - lo[1]) / (hi[1] - lo[1])])
    z, v = nelder_mead(f, z0, [0.1] * len(z0), tol=1e-6, itmax=200, fmax=budget)
    a, k = unpack(z if not fix_k else list(z) + [0.0])
    R = responses(Q, [h, a, k])
    return {"a": a, "k": k, "R": R, "g_max": v, "ok": feasible(Q, R)}
```

```python
def fc_catalogue_retuned(P, a0, k0):
    """Catalogue sections with a and k re-tuned for each (discrete outer loop, continuous inner loop)."""
    rows = []
    for h, b, t, kgm in FC_RHS:
        Q = fc_section_P(P, h, b, t)
        r = fc_retune(Q, h, a0, k0)
        rows.append(dict(r, rhs="%dx%dx%d" % (h, b, t), h=h, b=b, t=t, kg_m=kgm, mass_cat=2 * kgm * P["L"] / 1000))
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "best": min(ok, key=lambda r: r["mass_cat"]) if ok else None}
```

```
  ... the same sections with a and k re-tuned for each section (inner loop, max. 80 solver calls each):
  RHS 60x40x4   frame  28.2 kg: a  50.1 mm, k 127.6 N/mm -> f_rigid 12.61, f_bend   44.5 Hz, sag 4.69 mm, worst g +0.261 -> fails
  RHS 80x40x4   frame  34.5 kg: a 111.9 mm, k  95.7 N/mm -> f_rigid 10.68, f_bend   56.2 Hz, sag 6.41 mm, worst g +0.069 -> fails
  RHS 70x50x4   frame  34.9 kg: a  50.1 mm, k  98.4 N/mm -> f_rigid 11.28, f_bend   52.6 Hz, sag 6.24 mm, worst g +0.128 -> fails
  RHS 80x60x4   frame  40.8 kg: a 244.4 mm, k 105.8 N/mm -> f_rigid  9.91, f_bend   60.8 Hz, sag 5.95 mm, worst g -0.009 -> OK
  RHS 90x50x4   frame  40.8 kg: a 358.7 mm, k 114.0 N/mm -> f_rigid  9.20, f_bend   65.1 Hz, sag 5.52 mm, worst g -0.080 -> OK
  RHS 100x50x4  frame  43.9 kg: a 555.6 mm, k 132.8 N/mm -> f_rigid  7.99, f_bend   72.4 Hz, sag 4.79 mm, worst g -0.201 -> OK
  RHS 100x60x4  frame  47.0 kg: a 600.0 mm, k 137.8 N/mm -> f_rigid  7.80, f_bend   75.7 Hz, sag 4.68 mm, worst g -0.220 -> OK
  RHS 80x60x5   frame  50.0 kg: a 296.5 mm, k 113.7 N/mm -> f_rigid  9.56, f_bend   62.9 Hz, sag 5.74 mm, worst g -0.044 -> OK
  RHS 120x60x4  frame  53.5 kg: a 599.7 mm, k 141.3 N/mm -> f_rigid  7.78, f_bend   91.9 Hz, sag 4.67 mm, worst g -0.222 -> OK
  RHS 100x60x5  frame  58.0 kg: a 598.9 mm, k 144.0 N/mm -> f_rigid  7.77, f_bend   78.7 Hz, sag 4.66 mm, worst g -0.223 -> OK
  RHS 120x80x4  frame  59.5 kg: a 598.7 mm, k 144.8 N/mm -> f_rigid  7.77, f_bend   98.2 Hz, sag 4.66 mm, worst g -0.223 -> OK
  lightest feasible catalogue section: RHS 80x60x4, 40.8 kg with a 244.4 mm, k 105.8 N/mm (continuous optimum h 79.2 x 60 x 4: model 41.20 kg)
```

Now eight of eleven sections are feasible. The lightest is **RHS 80 × 60 × 4** (40.8 kg by catalogue mass; the model
with sharp corners gives 41.4 kg). It even beats the continuous optimum slightly, because the catalogue mass per
metre includes the corner radii while the model uses sharp corners. Note how the inner loop moved the mounts
(a = 244 mm) and stiffened them a little (k = 105.8 N/mm) to keep the sag within 6 mm.

**Rule:** after every discrete decision (section, mount, bolt size, plate thickness) re-optimise the continuous
variables that remain. In MATLAB this is an outer loop over the catalogue with `fmincon` inside; in a commercial
optimiser (Ansys DesignXplorer, Isight, modeFRONTIER) it is a "discrete variable" with a nested continuous run.

### 7.2 Real isolation mounts

Mounts are also catalogue parts. Each has a stiffness and a maximum static load:

```python
FC_MOUNTS = [   # rubber cylinder / levelling mounts: name, vertical stiffness N/mm, max static load N, price EUR (typical - check)
    ("RM-40", 60.0, 450.0, 9.0), ("RM-50", 90.0, 700.0, 11.0), ("RM-60", 110.0, 1000.0, 14.0), ("RM-60H", 140.0, 1200.0, 16.0),
    ("RM-75", 180.0, 1600.0, 21.0), ("RM-100", 260.0, 2600.0, 32.0)]
```

The load per mount follows from the static solution with 1 g. Each support position has two mounts (one under each
beam), so the reaction of one mount is k × compression:

  F_mount = k · w(a),     4 · F_mean = total weight

```python
def fc_mount_load(P, x, b=None, t=None):
    """Static load per mount (1 g): reaction of each support spring = 2k x compression / 2 mounts."""
    h, a, k = x
    Q = fc_section_P(P, h, b or P["b"], t or P["t"])
    r = frame_fe(dict(Q, dyn=1.0, F_shake=0.0), h, a, k)
    xs, u = r["nodes"], r["u"]
    idx = lambda xx: min(range(len(xs)), key=lambda i: abs(xs[i] - xx))
    loads = [-k * u[2 * idx(s)] for s in (a, P["L"] - a)]     # per mount (each support position has 2 mounts of k)
    return {"F_mount": loads, "F_total": 2 * sum(loads), "weight": 9.81 * (sum(m for _, m in P["masses"]) * 1000 + r["mass_kg"])}
```

With the stiffness fixed by the catalogue, only the position a is free. `fc_retune(..., fix_k=True)` moves a alone:

```python
def fc_select_mount(P, x, b=None, t=None):
    """Real mounts: for each catalogue mount solve the frame with its stiffness; feasible and within the load rating."""
    h, a, _ = x
    out = []
    for name, km, Fmax, price in FC_MOUNTS:
        Q = fc_section_P(P, h, b or P["b"], t or P["t"])
        r = fc_retune(Q, h, a, km, fix_k=True, budget=40)             # mount stiffness fixed by the catalogue: move a only
        Fm = max(fc_mount_load(P, [h, r["a"], km], b, t)["F_mount"])
        out.append({"name": name, "k": km, "a": r["a"], "F_max": Fmax, "F": Fm, "price": price, "R": r["R"],
                    "ok": r["ok"] and Fm <= Fmax, "load_ok": Fm <= Fmax})
    ok = [m for m in out if m["ok"]]
    return {"rows": out, "best": min(ok, key=lambda m: m["price"]) if ok else None}
```

```
## 7.2 Real isolation mounts (catalogue stiffness and load rating, RHS 80x60x4; a re-tuned for each mount)
  static load per mount (1 g): 692 / 566 N, sum of 4 mounts 2516 N = weight 2516 N
  RM-40   k    60 N/mm, rating   450 N (load  697 N): a 313.2 mm -> f_rigid  7.00 Hz, sag 10.48 mm, f_bend  60.0 Hz,  9.00 EUR -> NOT OK
  RM-50   k    90 N/mm, rating   700 N (load  696 N): a 312.7 mm -> f_rigid  8.55 Hz, sag 6.98 mm, f_bend  60.3 Hz, 11.00 EUR -> NOT OK
  RM-60   k   110 N/mm, rating  1000 N (load  694 N): a 263.6 mm -> f_rigid  9.93 Hz, sag 5.72 mm, f_bend  60.7 Hz, 14.00 EUR -> OK
  RM-60H  k   140 N/mm, rating  1200 N (load  702 N): a 375.4 mm -> f_rigid 10.01 Hz, sag 4.49 mm, f_bend  60.2 Hz, 16.00 EUR -> NOT OK
  RM-75   k   180 N/mm, rating  1600 N (load  712 N): a 484.1 mm -> f_rigid 10.08 Hz, sag 3.49 mm, f_bend  59.8 Hz, 21.00 EUR -> NOT OK
  RM-100  k   260 N/mm, rating  2600 N (load  727 N): a 600.0 mm -> f_rigid 10.85 Hz, sag 2.42 mm, f_bend  59.6 Hz, 32.00 EUR -> NOT OK
  selected: RM-60 (k 110 N/mm) with a 263.6 mm
  drawing value a = 265 mm -> f_rigid 9.91 Hz, f_bend 60.7 Hz, sag 5.72 mm, feasible True
```

The check of the sum of the four mount forces against the weight (2516 N = 2516 N) proves that the static solution
is in equilibrium. Only **RM-60** (110 N/mm) works: RM-40 is overloaded (687 N > 450 N) and too soft (sag 10.5 mm);
RM-50 sags 7.0 mm; RM-60H and stiffer mounts push the mount mode above 10 Hz, even with the mounts moved inwards.
The hole position is then rounded to a 5 mm drawing grid (a = 265 mm) and solved once more.

### 7.3 Re-verification on finer meshes and margins

A design found with one mesh must be checked with a finer one. The margin of each response is its distance from the
limit in percent:

  margin = (1 − f / f_max), (f / f_min − 1), (1 − sag / sag_max), (1 − σ / σ_max)

```python
def fc_reverify(P, x, b=None, t=None, meshes=(8, 16, 32, 64)):
    """Final design on finer meshes; margins = distance of each response from its limit in %."""
    h, a, k = x
    Q = fc_section_P(P, h, b or P["b"], t or P["t"])
    lim = P["limits"]
    rows = []
    for n in meshes:
        R = responses(Q, x, n)
        rows.append({"n_el": n, "R": R, "margin": {"f_rigid": 100 * (1 - R["f_rigid"] / lim["f_rigid_max"]),
                                                   "f_bend": 100 * (R["f_bend"] / lim["f_bend_min"] - 1),
                                                   "sag": 100 * (1 - R["sag"] / lim["sag_max"]),
                                                   "sigma": 100 * (1 - R["sigma"] / lim["sigma_max"])}})
    return rows
```

```
## 7.3 Re-verification of the final design (RHS 80x60x4, a 265.0, RM-60) on finer meshes; margins to the limits
   8 elements: f_rigid 9.9128, f_bend 60.739 Hz, sag 5.7176 mm, sigma 16.03 MPa | margins f_rigid +0.9 %, f_bend +0.7 %, sag +4.7 %, sigma +84.0 %
  16 elements: f_rigid 9.9128, f_bend 60.739 Hz, sag 5.7176 mm, sigma 16.09 MPa | margins f_rigid +0.9 %, f_bend +0.7 %, sag +4.7 %, sigma +83.9 %
  32 elements: f_rigid 9.9128, f_bend 60.739 Hz, sag 5.7176 mm, sigma 16.09 MPa | margins f_rigid +0.9 %, f_bend +0.7 %, sag +4.7 %, sigma +83.9 %
  64 elements: f_rigid 9.9128, f_bend 60.739 Hz, sag 5.7176 mm, sigma 16.09 MPa | margins f_rigid +0.9 %, f_bend +0.7 %, sag +4.7 %, sigma +83.9 %
```

The beam model is converged at 8 elements (it was refined at masses and mounts, chapter 4). The margins are the real
problem: **0.9 % on the mount mode and 0.7 % on the bending mode.** Every optimum ends like this, because the
optimiser pushes the design until a limit stops it. What margin is needed depends on how well the inputs are known.
That is the subject of 7.4.

**Margin policy** (typical, adapt to your company):

| Situation | Margin on a frequency limit | Margin on a stress limit |
|---|---|---|
| Solver calibrated by a test of this part, tolerances checked at the corners | 0 % (the corners are the margin) | 0 % plus the code safety factor |
| Solver verified (mesh, theory) but not calibrated | 10 % | 10–15 % |
| "Trend values" only (new joint types, rubber parts, unknown damping) | 15–25 % | 20 % |

### 7.4 Tolerance corners

Three inputs scatter in production:

- the **wall thickness** of the RHS: EN 10219 allows about ±10 % for walls up to 5 mm, which changes both I and A;
- the **stiffness of rubber mounts**: ±15–20 % is normal for a catalogue part (hardness tolerance ±5 Shore A);
- the **masses** of compressor, motor and receiver: ±10 % if taken from data sheets.

```python
FC_TOL = {"t_rel": 0.10, "k_rel": 0.20, "m_rel": 0.10}   # RHS wall +/-10 % (EN 10219 typical), mount stiffness +/-20 %, masses +/-10 % (check)
```

With three inputs and two extremes each there are 2³ = 8 corners. Frequencies and sag change monotonically with
these inputs, so the worst case is always at a corner:

```python
def fc_tolerance_corners(P, x, b=None, t=None, tol=None):
    """Worst case of the frequencies over the corners wall thickness +/-, mount stiffness +/-, masses +/-
    (2^3 = 8 solver calls). The wall changes I and A; the masses scale all point masses."""
    tol = tol or FC_TOL
    h, a, k = x
    tt = t or P["t"]
    rows = []
    for st in (-1, 1):
        for sk in (-1, 1):
            for sm in (-1, 1):
                Q = fc_section_P(P, h, b or P["b"], tt * (1 + st * tol["t_rel"]))
                Q["masses"] = [[xm, m * (1 + sm * tol["m_rel"])] for xm, m in P["masses"]]
                R = responses(Q, [h, a, k * (1 + sk * tol["k_rel"])])
                rows.append({"t": st, "k": sk, "m": sm, "R": R})
    return {"rows": rows, "f_rigid_max": max(r["R"]["f_rigid"] for r in rows), "f_bend_min": min(r["R"]["f_bend"] for r in rows),
            "sag_max": max(r["R"]["sag"] for r in rows)}
```

```
## 7.4 Tolerance corners: wall +/-10 %, mount stiffness +/-20 %, masses +/-10 % (8 solver calls)
  t -1, k -1, m -1: f_rigid  9.34 Hz, f_bend  61.0 Hz, sag 6.44 mm
  t -1, k -1, m +1: f_rigid  8.61 Hz, f_bend  57.6 Hz, sag 7.64 mm
  t -1, k +1, m -1: f_rigid 11.43 Hz, f_bend  61.5 Hz, sag 4.29 mm
  t -1, k +1, m +1: f_rigid 10.53 Hz, f_bend  58.1 Hz, sag 5.09 mm
  t +1, k -1, m -1: f_rigid  9.16 Hz, f_bend  63.3 Hz, sag 6.66 mm
  t +1, k -1, m +1: f_rigid  8.47 Hz, f_bend  60.0 Hz, sag 7.85 mm
  t +1, k +1, m -1: f_rigid 11.20 Hz, f_bend  63.7 Hz, sag 4.44 mm
  t +1, k +1, m +1: f_rigid 10.36 Hz, f_bend  60.5 Hz, sag 5.24 mm
  worst case: f_rigid 11.43 Hz (limit 10.0), f_bend 57.6 Hz (limit 60.3), sag 7.85 mm (limit 6.0)
  same corners for the unrounded optimum (h 79.2, a 230.5, k 104.7): f_rigid 11.51 Hz, f_bend 57.1 Hz, sag 8.24 mm
  -> an optimum with < 1 % margin on its active limits fails at the tolerance corners: NOT OK
```

All three limits are broken at some corner: the mount mode reaches 11.43 Hz (stiff mounts, light masses), the bending
mode drops to 57.6 Hz (thin wall, heavy masses), and the sag grows to 7.85 mm (soft mounts, heavy masses). The
unrounded optimum is no better. **An optimum with less than 1 % margin is not a product.**

### 7.4b Robust choice

There are two ways to make the design robust:

1. **Design to tightened limits** (limit divided by the worst-case factor found in 7.4). Simple, but conservative.
2. **Check the corners inside the search.** Here the space is small enough to enumerate it: three catalogue
   sections × four mounts × four mount positions on a 50 mm grid, each with 8 corners (384 solver calls).

```python
def fc_corners_ok(P, tc):
    lim = P["limits"]
    return tc["f_rigid_max"] <= lim["f_rigid_max"] and tc["f_bend_min"] >= lim["f_bend_min"] and tc["sag_max"] <= lim["sag_max"]
```

```python
def fc_robust_search(P, sections, mounts, a_grid, tol):
    """Robust design by enumeration: catalogue section x catalogue mount x mount position on a 50 mm grid; a design
    is accepted only if all 8 tolerance corners meet the limits. Lightest, then cheapest mount."""
    rows = []
    for h, b, t, kgm in sections:
        for name, km, Fmax, price in mounts:
            for a in a_grid:
                tc = fc_tolerance_corners(P, [h, a, km], b, t, tol)
                rows.append({"rhs": "%dx%dx%d" % (h, b, t), "h": h, "b": b, "t": t, "kg_m": kgm, "mount": name, "k": km, "price": price,
                             "a": a, "tc": tc, "ok": fc_corners_ok(P, tc)})
    ok = [r for r in rows if r["ok"]]
    return {"rows": rows, "ok": ok, "best": min(ok, key=lambda r: (r["kg_m"], r["price"], -r["a"])) if ok else None}
```

The search is run twice: first with the raw tolerances, then with tolerances after two cheap production measures.
The mounts are measured at goods-in and matched in sets of four (±10 %), and compressor, motor and receiver are
weighed (±3 %):

```python
FC_TOL_PROD = {"t_rel": 0.10, "k_rel": 0.10, "m_rel": 0.03}   # after measures: mounts matched / measured +/-10 %, masses weighed +/-3 % (check)
```

```
## 7.4b Robust choice: catalogue section x catalogue mount x position (50 mm grid), all 8 corners must pass
  with the raw tolerances (mounts +/-20 %, masses +/-10 %): 0 of 48 combinations pass
  with production measures (mounts matched +/-10 %, masses weighed +/-3 %): 4 of 48 combinations pass:
    RHS 90x50x4   RM-60H  a 450 mm: worst f_rigid 9.90 Hz, f_bend 62.8 Hz, sag 5.19 mm
    RHS 90x50x4   RM-60H  a 550 mm: worst f_rigid 8.90 Hz, f_bend 62.6 Hz, sag 5.19 mm
    RHS 100x50x4  RM-60H  a 450 mm: worst f_rigid 9.83 Hz, f_bend 70.4 Hz, sag 5.26 mm
    RHS 100x50x4  RM-60H  a 550 mm: worst f_rigid 8.84 Hz, f_bend 70.2 Hz, sag 5.26 mm
  robust final design: RHS 90x50x4, RM-60H (k 140 N/mm), mounts at a = 550 mm
  nominal: mass 41.45 kg (model), f_rigid 8.30 Hz, f_bend 64.6 Hz, sag 4.49 mm, sigma 3.7 MPa; mount load 720 N <= rating 1200 N
```

With raw tolerances **no** combination works: the sag limit (6 mm, mounts soft enough) and the isolation limit
(10 Hz, mounts not too stiff) cannot both hold when the stiffness may vary by ±20 % and the masses by ±10 %. This is
a **requirement conflict**, not a design problem, and only a process measure solves it. With matched mounts and
weighed masses four combinations pass. The robust final design is **RHS 90 × 50 × 4 with RM-60H mounts at
a = 550 mm**. It has the same mass per metre as the 80 × 60 × 4. The taller, narrower section gives a higher bending
frequency (64.6 Hz nominal), and the stiffer mounts placed further inside keep the mount mode low (8.30 Hz nominal).
The mount load (720 N) is well within the rating (1200 N).

The design engineer must now write the two measures into the documents: "mounts: stiffness measured, sets matched
within ±10 %" on the purchase specification and "weigh compressor, motor and receiver, record in the build sheet" in
the assembly instruction.

### 7.5 Drawing data

The welded frame consists of two long beams, three cross members welded all round at both ends (fillet a 3, see M11)
and four mount plates:

```python
FC_CROSS = {"n": 3, "length": 500.0}     # cross members between the two beams (same section), length mm
```

```python
def fc_cut_list(P, h, b, t, a):
    """Cut list, weld length, mount holes of the welded frame (two long beams, cross members welded all round)."""
    L, cr = P["L"], FC_CROSS
    perim = 2 * (h + b) / 1000
    weld_m = cr["n"] * 2 * perim                       # each cross member: both ends welded all round
    holes = [round(a, 1), round(L - a, 1)]
    return {"parts": [("long beam RHS %dx%dx%d" % (h, b, t), 2, L), ("cross member RHS %dx%dx%d" % (h, b, t), cr["n"], cr["length"]),
                      ("mount plate 100x100x8 S235, hole 13", 4, 100.0)],
            "weld_m": weld_m, "holes": holes, "cuts": 2 + cr["n"] + 4}
```

```
## 7.5 Drawing data: cut list, welds, mount holes
  2 x long beam RHS 90x50x4                  length 2500 mm
  3 x cross member RHS 90x50x4               length 500 mm
  4 x mount plate 100x100x8 S235, hole 13    length 100 mm
  welds: 3 cross members welded all round at both ends -> 1.68 m fillet a 3 (M11); mount holes at x = 550.0 / 1950.0 mm on both beams; 9 saw cuts
```

Drawing notes that come directly from this workflow:

- RHS 90 × 50 × 4 EN 10219 S355J2H; wall thickness tolerance per EN 10219 (it was part of the corner check).
- Mount holes Ø13 at x = 550 / 1950 mm on both beams; position tolerance Ø1 (M10, floating fastener).
- Weld: fillet a 3 all round, ISO 5817 level C (M11, chapter 7); weld sequence symmetric to limit bowing.
- Note on the general arrangement: "Natural frequencies verified: mount modes ≤ 10 Hz, first bending mode ≥ 60.3 Hz;
  acceptance per test plan TP-xxx". This makes the requirement visible to whoever changes the frame later.

**NX CAM:** the frame itself is sawn and welded, so it needs no CAM programme. CAM is used only for the mount
plates (drilling, or a laser / plasma cutting programme from the DXF of the plate) and for the drilling of the mount
holes in the beams, if done on a CNC drilling line. The CAD → CAM link is therefore the plate drawing and the hole
coordinates from `fc_cut_list()`.

### 7.6 Cost of the frame variants

The cost model adds material, sawing, welding (the M11 rate per metre of fillet a 3 including preparation),
drilling, painting, mount plates and mounts:

```python
FC_COST = {"steel_eur_kg": 1.40, "saw_eur_cut": 2.5, "weld_eur_m": 18.0, "drill_eur_hole": 1.5, "paint_eur_m2": 12.0,
           "plate_eur": 6.0}   # material, sawing, MAG fillet a 3 incl. preparation (M11 cost model), drilling, painting, mount plate (check)
```

  cost = m_steel · c_kg + n_cuts · c_cut + L_weld · c_weld + n_holes · c_hole + A_paint · c_m² + plates + 4 · mount

```python
def fc_cost(P, h, b, t, kgm, a, mount_price):
    """Frame cost: steel + sawing + welding + drilling + painting + mount plates + 4 mounts (EUR, typical rates)."""
    c = FC_COST
    cl = fc_cut_list(P, h, b, t, a)
    length_m = (2 * P["L"] + FC_CROSS["n"] * FC_CROSS["length"]) / 1000
    steel_kg = kgm * length_m + 4 * 0.1 * 0.1 * 0.008 * 7850
    area = 2 * (h + b) / 1000 * length_m
    parts = {"steel": steel_kg * c["steel_eur_kg"], "sawing": cl["cuts"] * c["saw_eur_cut"], "welding": cl["weld_m"] * c["weld_eur_m"],
             "drilling": 8 * c["drill_eur_hole"], "painting": area * c["paint_eur_m2"], "plates": 4 * c["plate_eur"], "mounts": 4 * mount_price}
    return {"parts": parts, "total": sum(parts.values()), "steel_kg": steel_kg}
```

```
## 7.6 Cost of frame variants (typical rates - check)
  current RHS 100x60x4, RM-60H     steel  63.7 kg: steel 89.1, sawing 22.5, welding 34.6, drilling 12.0, painting 25.0, plates 24.0, mounts 64.0 -> 271.2 EUR (+0.0 %)
  nominal optimum RHS 80x60x4, RM-60 steel  55.5 kg: steel 77.7, sawing 22.5, welding 30.2, drilling 12.0, painting 21.8, plates 24.0, mounts 56.0 -> 244.3 EUR (-9.9 %)
  robust final RHS 90x50x4, RM-60H steel  55.5 kg: steel 77.7, sawing 22.5, welding 30.2, drilling 12.0, painting 21.8, plates 24.0, mounts 64.0 -> 252.3 EUR (-7.0 %)
  stiffer RHS 120x60x4, RM-60H     steel  72.1 kg: steel 100.9, sawing 22.5, welding 38.9, drilling 12.0, painting 28.1, plates 24.0, mounts 64.0 -> 290.3 EUR (+7.1 %)
```

The optimisation saves about 7–10 % of the frame cost. Robustness costs only the difference between RM-60H and
RM-60 mounts (8 € per frame). The stiffer 120 × 60 × 4, the classic "make it heavier to be safe" answer, costs 7 %
more than today. Steel is less than a third of the cost; sawing, welding and painting scale with the number of parts,
not with their mass. **Fewer parts often save more than a lighter section.**

### 7.7 Modal test plan and acceptance

A prototype frame is tested by impact (hammer) testing. The plan is written **before** the frame is built, so that
the acceptance is not adapted to the result afterwards:

- **Frequency band:** 2.5 × the highest mode of interest, so that the third mode is well inside the band.
- **Sampling:** f_s = 2.56 × band (analyser practice, anti-aliasing filter).
- **Resolution:** Δf = band / lines; record length T = 1/Δf. The mount modes at 7–8 Hz need a resolution of
  about 0.1 Hz, so records of about 10 s.
- **Hammer tip:** a soft tip puts the energy into low frequencies (mount modes); a hard tip into high ones.
- **Points:** 11 points along the beam (roving hammer, fixed accelerometer near a mount, away from nodes).
- **Acceptance:** each measured frequency within ±5 % of the model; otherwise calibrate (7.8).

```python
def fc_test_plan(P, R, f_max_factor=2.5, n_lines=1600):
    """Impact-hammer modal test: frequency range up to 2.5 x the highest frequency of interest, sampling, resolution,
    record length, hammer tip, acceptance window +/-5 % around the model."""
    fmax = f_max_factor * max(R["f"][:3])
    fs = 2.56 * fmax                                    # analyser practice: fs = 2.56 x bandwidth
    df = fmax / n_lines
    tip = "rubber (soft) tip, up to ~500 Hz" if fmax <= 500 else "plastic tip, up to ~2 kHz" if fmax <= 2000 else "steel tip"
    acc = [(i + 1, f, 0.95 * f, 1.05 * f) for i, f in enumerate(R["f"][:3])]
    return {"f_band": fmax, "fs": fs, "df": df, "T_rec": 1 / df, "tip": tip, "acceptance": acc,
            "points": [round(P["L"] * i / 10) for i in range(11)]}
```

```
## 7.7 Modal test plan (impact hammer) and acceptance window
  band 0 ... 162 Hz, sampling 413 Hz, 1600 lines -> resolution 0.101 Hz, record 9.9 s, rubber (soft) tip, up to ~500 Hz
  impact / response points (mm): 0, 250, 500, 750, 1000, 1250, 1500, 1750, 2000, 2250, 2500
  mode 1: model 7.07 Hz -> accept 6.71 ... 7.42 Hz
  mode 2: model 8.30 Hz -> accept 7.89 ... 8.72 Hz
  mode 3: model 64.60 Hz -> accept 61.37 ... 67.83 Hz
```

Mount modes are tested with the frame standing on its real mounts and loaded with the real masses (or dummy masses
of the same weight at the same positions); a frame on soft foam would show free–free bending modes only.

### 7.8 When the test does not match – the calibration loop

Chapter 4 explained the calibration: the model has two uncertain stiffnesses, the joints (an EI factor for the
flexibility of welds and cross members) and the mounts (a k factor). Both are fitted to the measured frequencies by
least squares. The loop then checks the limits again with the calibrated model:

```python
def fc_after_test(P, x, f_meas):
    """Calibration loop: identify the joint (EI) and mount (k) factors from the test, then check the limits with the
    calibrated model - decide whether the design must change."""
    C = calibrate(P, x, f_meas)
    h, a, k = x
    r = frame_fe(P, h, a, k, EI_factor=C["EI_factor"], k_factor=C["k_factor"])
    Rc = {"f_rigid": r["f"][1], "f_bend": r["f"][2]}
    return {"C": C, "f_rigid": Rc["f_rigid"], "f_bend": Rc["f_bend"],
            "ok": Rc["f_rigid"] <= P["limits"]["f_rigid_max"] and Rc["f_bend"] >= P["limits"]["f_bend_min"]}
```

```
## 7.8 Test deviates: calibration loop (example: joints 15 % softer, mounts 10 % stiffer than modelled)
  measured 7.41, 8.71, 59.57 Hz -> EI factor 0.850, k factor 1.100 (rms 0.0000 %); calibrated model: f_rigid 8.71 Hz, f_bend 59.6 Hz -> LIMIT VIOLATED - change the design
  next robust candidate RHS 100x50x4, RM-60H, a 450 with the calibrated factors: f_rigid 9.61 Hz, f_bend 67.0 Hz -> OK (frame +3.1 kg)
```

In the example the joints are 15 % softer than modelled. The calibrated model shows that the bending mode of the
chosen design (59.6 Hz) is now below the 60.3 Hz limit. The program goes to the next robust candidate from 7.4b and
evaluates it with the **calibrated** factors: RHS 100 × 50 × 4 at a = 450 mm gives 67.0 Hz and passes, for 3.1 kg
more steel. This is how "trend values" become reliable values: the test does not only accept or reject the
prototype, it corrects the model, and the corrected model makes the next decision.

### 7.9 Data management

An optimisation project produces hundreds of solver runs. Without discipline nobody can say a month later which
model gave which number. Minimum rules:

| Item | Rule |
|---|---|
| Folder per study | `<project>/opt/<study-name>/` with `inputs/`, `runs/`, `results/`, `report/` |
| Every solver call | one line in `evaluations.csv` (written by `optflow.py run`): variables, responses, feasible flag |
| Models | CAD and CAE models checked into the PDM (SOLIDWORKS PDM / Teamcenter) with the study name in the revision comment |
| Run identity | a hash of all inputs (`run_id`): same inputs → same id, different inputs → different id |
| Final design | released only with: report, evaluation log, manifest, test report, calibrated factors |

```python
def fc_manifest(P, x, R, solver="optflow virtual CAE 2-D beam FE"):
    """Run manifest for data management: input hash (identical inputs -> identical hash), design, results, solver."""
    import hashlib
    blob = json.dumps({"P": P, "x": x}, sort_keys=True).encode("utf-8")
    return {"run_id": hashlib.sha256(blob).hexdigest()[:12], "solver": solver, "x": x,
            "results": {k: round(v, 4) for k, v in R.items() if k != "f"}, "frequencies": [round(f, 3) for f in R["f"]]}
```

```
## 7.9 Run manifest (data management)
  {"run_id": "23c577b54855", "solver": "optflow virtual CAE 2-D beam FE", "x": [90, 550.0, 140.0], "results": {"mass_kg": 41.448, "f_rigid": 8.3045, "f_bend": 64.6005, "sag": 4.4924, "sigma": 3.6623}, "frequencies": [7.068, 8.304, 64.601, 188.067]}
  same inputs again -> same run_id: True
```

The hash (SHA-256 of the sorted JSON of all inputs) costs nothing and settles every later argument about "which
version was that". Store the manifest next to the CAD revision.

### 7.10 The templates for your tools, line by line

`python optflow.py export --out folder` (and every `run`) writes templates filled with the design. They are written
from the documented interfaces of each program. Feature names, parameter names and result names must be adapted to
your model and checked against your software version. The add-on adds an APDL macro:

```python
FC_APDL = """! APDL macro (template - check element / section options in your Ansys version)
! two RHS beams as one 2-D beam pair, point masses, spring mounts, modal analysis
/PREP7
h = {h}  $ a = {a}  $ k = {k}  $ L = {L}
ET,1,BEAM188  $ ET,2,MASS21,,,4  $ ET,3,COMBIN14
MP,EX,1,210000 $ MP,PRXY,1,0.3 $ MP,DENS,1,7.85e-9
SECTYPE,1,BEAM,HREC $ SECDATA,{b},h,{t},{t},{t},{t}     ! hollow rectangle b x h, walls t
K,1,0,0 $ K,2,L,0 $ L,1,2 $ LESIZE,ALL,,,{n_el} $ LMESH,ALL
! ... MASS21 at the mass positions (R,2,m,m), COMBIN14 to ground at x = a and x = L - a (R,3,2*k), D,ALL,UZ / ROTX / ROTY ...
/SOLU $ ANTYPE,MODAL $ MODOPT,LANB,6 $ SOLVE $ FINISH
/POST1 $ *GET,F1,MODE,1,FREQ $ *GET,F2,MODE,2,FREQ $ *GET,F3,MODE,3,FREQ
*CFOPEN,result,txt $ *VWRITE,F1,F2,F3 $ ('F1 = ',F12.5,/,'F2 = ',F12.5,/,'F3 = ',F12.5) $ *CFCLOS
"""
```

```
## 7.10 Templates for your tools (filled with the final design)
  APDL macro filled: h = 90.00  $ a = 550.00  $ k = 140.00  $ L = 2500.0 | ET,1,BEAM188  $ ET,2,MASS21,,,4  $ ET,3,COMBIN14 | MP,EX,1,210000 $ MP,PRXY,1,0.3 $ MP,DENS,1,7.85e-9
  solidworks_design_table.csv        6 lines; first: configuration,h@Sketch_RHS,a@Sketch_Mount,k (custom property)
  solidworks_set_and_rebuild.bas    13 lines; first: ' SOLIDWORKS VBA macro (template - check feature / dimension names in your model
  ansys_workbench_update.py         12 lines; first: # Ansys Workbench journal (IronPython, template - check parameter names P1.. in 
  abaqus_frame.py                   11 lines; first: # Abaqus/CAE noGUI script (template)  run:  abaqus cae noGUI=abaqus_frame.py
  adams_run.cmd                      6 lines; first: ! Adams/View command file (template)  run:  adams2023 aview ru-s b adams_run.cmd
  matlab_driver.m                   18 lines; first: % MATLAB driver (template): surrogate-based optimisation calling the external so
  problem.json                      65 lines; first: {
  frame_modal.mac                   12 lines; first: ! APDL macro (template - check element / section options in your Ansys version)
```

**SOLIDWORKS design table** (`solidworks_design_table.csv`): one row per configuration, the column headers are the
dimension names `name@feature` as shown in SOLIDWORKS (Tools → Options → General → Show dimension names). The rows
are a Latin hypercube, ready to paste into an Excel design table (Insert → Tables → Design Table). Adapt the headers
to your dimension names. A custom property (here k) is written as `$PRP@property`.

```
configuration,h@Sketch_RHS,a@Sketch_Mount,k (custom property)
design_1,141.4,387.7,251.8
design_2,70.7,280.0,340.8
design_3,127.3,206.7,214.3
design_4,81.2,581.0,30.1
design_5,110.1,63.6,127.9
```

**SOLIDWORKS VBA macro** (`solidworks_set_and_rebuild.bas`):

```
' SOLIDWORKS VBA macro (template - check feature / dimension names in your model)
' sets the design variables, rebuilds, writes mass and exports STEP for the CAE tool
Dim swApp As Object, Part As Object
Sub main()
    Set swApp = Application.SldWorks
    Set Part = swApp.ActiveDoc
    Part.Parameter("h@Sketch_RHS").SystemValue = 90.00 / 1000#      ' m
    Part.Parameter("a@Sketch_Mount").SystemValue = 550.00 / 1000#
    Part.EditRebuild3
    Dim mp As Object: Set mp = Part.Extension.CreateMassProperty
    Open "C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\cad_mass.txt" For Output As #1: Print #1, "MASS = " & mp.Mass: Close #1
    Part.SaveAs3 "C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\frame.step", 0, 2
End Sub
```

- `Part.Parameter("h@Sketch_RHS").SystemValue` sets a dimension in **metres** (the API uses SI). Replace the names
  with yours.
- `EditRebuild3` rebuilds. Check its return value in a real macro; a failed rebuild must be reported as a failed run.
- `CreateMassProperty` gives the mass of the rebuilt part (a free check against the CAE mass).
- `SaveAs3 ... frame.step` exports the geometry for Ansys / Abaqus. With the SOLIDWORKS → Ansys live link
  (Workbench "Geometry" from the CAD) this export is not needed; then the parameters are linked directly.

**Ansys Workbench journal** (`ansys_workbench_update.py`), run with `RunWB2.exe -B -R script.py`:

```
# Ansys Workbench journal (IronPython, template - check parameter names P1.. in your project)
# run:  RunWB2.exe -B -R ansys_workbench_update.py
Open(FilePath=r"C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\frame.wbpj")
dp = Parameters.GetDesignPoint(Name="0")
Parameters.GetParameter(Name="P1").Expression = "90.00 [mm]"   # RHS height
Parameters.GetParameter(Name="P2").Expression = "550.00 [mm]"   # mount position
Parameters.GetParameter(Name="P3").Expression = "140.00 [N mm^-1]"
Update()
f = open(r"C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\result.txt", "w")
for name, p in (("F_RIGID", "P4"), ("F_BEND", "P5"), ("SIGMA", "P6"), ("MASS", "P7")):
    f.write("%s = %s\n" % (name, Parameters.GetParameter(Name=p).Value.Value))
f.close()
```

- Input parameters P1–P3 are the dimensions published in DesignModeler / SpaceClaim / the CAD link; output
  parameters P4–P7 are published results (frequencies of the Modal system, maximum stress, mass). Check the numbers
  in the Parameter Set of your project.
- `Update()` re-runs geometry, mesh and solution of the current design point. Mesh controls must be defined by
  element **size**, not by a fixed number of elements, so that the mesh follows the geometry (chapter 4).
- The result file uses the same `NAME = value` format as `optflow.py solve`, so `file_solver()` reads it unchanged.

**APDL macro** (`frame_modal.mac`, run with `ansys2xx -b -i frame_modal.mac -o out.txt`): a beam model like the
virtual CAE: BEAM188 with a hollow rectangular section (HREC), MASS21 point masses, COMBIN14 springs, a Block Lanczos
modal analysis and `*VWRITE` of the frequencies. Use it to verify the virtual CAE against Ansys once. The lines with
`...` must be completed (mass and spring elements at the right nodes, boundary conditions out of plane).

**Abaqus Python** (`abaqus_frame.py`, run with `abaqus cae noGUI=abaqus_frame.py`):

```
# Abaqus/CAE noGUI script (template)  run:  abaqus cae noGUI=abaqus_frame.py
from abaqus import *
from abaqusConstants import *
h, a, k = 90.00, 550.00, 140.00
m = mdb.Model(name='frame')
# ... build sketch / beam part with BoxProfile(b=60.0, a=h, uniformThickness=ON, t1=4.0), springs, point masses ...
# step: m.FrequencyStep(name='modes', previous='Initial', numEigen=6); job = mdb.Job(name='frame', model='frame'); job.submit(); job.waitForCompletion()
from odbAccess import openOdb
odb = openOdb('frame.odb')
fr = odb.steps['modes'].historyRegions['Assembly ASSEMBLY'].historyOutputs['EIGFREQ'].data
open(r'C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\result.txt', 'w').write('\n'.join('F%d = %g' % (i + 1, v) for i, (_, v) in enumerate(fr)))
```

- The model block is left as a skeleton (`# ...`). Record the macro once in Abaqus/CAE (File → Macro Manager); the
  recorded commands are exactly what goes there. Then replace the numbers by `h`, `a`, `k`.
- The eigenfrequencies come from the history output `EIGFREQ` of the frequency step in the ODB.

**Adams command file** (`adams_run.cmd`):

```
! Adams/View command file (template)  run:  adams2023 aview ru-s b adams_run.cmd
variable modify variable_name = .frame.DV_h  real_value = 90.00
variable modify variable_name = .frame.DV_a  real_value = 550.00
variable modify variable_name = .frame.DV_k  real_value = 140.00
simulation single_run transient type = auto_select end_time = 2.0 number_of_steps = 2000 model_name = .frame
numeric_results write result_set_component_name = .frame.Last_Run.MEA_mount_force.Q file_name = "C:\Users\ADMINI~1\AppData\Local\Temp\1\claude\481ca60bc3bc2104\8976bf50-e0ca-4ac6-977f-f1340934dd04\scratchpad\oftpl_final\mount_force.txt"
```

- Design variables `DV_h`, `DV_a`, `DV_k` must exist in the model (Build → Design Variable) and be used by the
  geometry, marker and spring definitions.
- The transient run gives mount forces over time, which is the input for the mount fatigue check and for M4/M11
  loads. For frequencies use Adams/Linear (`linear eigensolution`).

**MATLAB driver** (`matlab_driver.m`):

```
% MATLAB driver (template): surrogate-based optimisation calling the external solver through files
lb = [60 50 20]; ub = [160 600 400];
opts = optimoptions('surrogateopt', 'MaxFunctionEvaluations', 60, 'PlotFcn', 'surrogateoptplot');
[xbest, fbest] = surrogateopt(@objcon, lb, ub, opts);
function s = objcon(x)                 % ONE solver run per design point: objective and constraints from the same result
    R = run_solver(x);
    s.Fval = R.mass;
    s.Ineq = [R.f_rigid/10.0 - 1, 1 - R.f_bend/60.3, R.sag/6.0 - 1, R.sigma/100.0 - 1];
end
function R = run_solver(x)
    P = jsondecode(fileread('problem.json'));   % full problem written by "python optflow.py export"
    P.x = x;
    fid = fopen('design.json', 'w'); fprintf(fid, '%s', jsonencode(P)); fclose(fid);
    system('python optflow.py solve --in design.json --out result.txt');   % or the Ansys / Abaqus batch call
    t = fileread('result.txt');
    g = @(n) str2double(regexp(t, [n ' = ([-+0-9.eE]+)'], 'tokens', 'once'));
    R = struct('mass', g('MASS'), 'f_rigid', g('F_RIGID'), 'f_bend', g('F_BEND'), 'sag', g('SAG'), 'sigma', g('SIGMA'));
end
```

- `surrogateopt` (Global Optimization Toolbox) does what chapters 5–6 do: radial-basis surrogate plus adaptive
  sampling, with inequality constraints `Ineq ≤ 0`, the same normalised form as `constraints()`.
- `run_solver` writes the design file, calls the external program with `system()` and parses the result with
  `regexp`, the same file-based loop as `file_solver()`.
- `objcon` calls `run_solver` **once** per design point and returns objective and constraints from the same result.
  (A first version of this template built the objective and the constraints in two separate handles, which ran
  every Ansys job twice – a common and expensive MATLAB mistake.)
- `run_solver` reads the full problem from `problem.json` (written by `python optflow.py export`) and only replaces
  `x`; the external solver always gets a complete, self-contained input file.

### 7.11 Checklist, effort and typical failures

```
## 7.11 Checklist, effort, failure modes
  [ 1] variables are CAD dimensions that really change the part (rebuild tested at all bounds)
  [ 2] objective and every limit written with unit and source (standard, order of excitation, customer)
  [ 3] solver verified against theory (mesh study, simple load cases) before the loop starts
  [ 4] solver calibrated against a test of a similar part (or margins increased)
  [ 5] batch call works without GUI; failures caught and logged; cache / restart possible
  [ 6] DOE checked: no failed or duplicate points, responses smooth enough for a surrogate (LOO error)
  [ 7] optimum verified with the true solver on a finer mesh; active limits identified
  [ 8] rounded to catalogue / manufacturable values and re-verified; tolerance corners checked
  [ 9] drawing, cut list, weld note and inspection items derived from the final model
  [10] test plan with acceptance window written before the prototype is built
  effort of a first loop: clean parametric CAD model (SOLIDWORKS equations, design table, rebuild tests) 2.0 d; CAE model in batch mode (Ansys Workbench parameters or Abaqus script), mesh study 3.0 d; coupling script (MATLAB or Python), file exchange, failure handling, logging 2.0 d; DOE + surrogate + optimisation runs, review of results 1.5 d; rounding, re-verification, tolerance study, drawing update 1.0 d; modal test of the prototype and calibration 2.0 d; documentation / report / handover 1.0 d -> total 12.5 person-days
  wrong limits                         | optimum looks great, product fails               | derive every limit from the load / excitation (M2 orders, M11)
  CAD does not rebuild at the bounds   | random solver failures, holes in the DOE         | rebuild test at all 2^n corners before the loop
  mesh changes with the geometry       | noisy responses, optimiser chases noise          | fixed element size, mesh study, smooth surrogate
  uncalibrated CAE                     | the optimum sits on a limit that is 10 % wrong   | calibrate to a test, or keep 10-15 % margin
  penalty optimiser                    | optimum slightly infeasible (direct search: 59.3 < 60.3 Hz) | verify feasibility with the true solver; small safety offset
  too many variables                   | DOE explodes, surrogate poor                     | screening (sensitivity) first, keep 3-8 variables
  optimum not manufacturable           | odd sizes, no catalogue part                     | discrete catalogue step and re-verification (chapter 7.1)
  results lost / not reproducible      | nobody knows which model gave which number       | run manifest with input hash, evaluation CSV, PDM
```

The effort estimate (12.5 person-days for the first loop) is for one engineer who knows the tools. Most of it is
spent once: the parametric model, the batch CAE model and the coupling script can be reused for the next frame. The
second study of a similar part typically takes 2–3 days. The most expensive failure in practice is the first one in
the table, **wrong limits**: an optimiser is very good at exploiting a badly stated requirement.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification of the program

`python optflow.py selftest` runs ten independent checks:

```
free-free beam: 1st bending frequency = 4.730^2/(2 pi L^2) sqrt(EI/rhoA) OK   263.05 / 263.05 Hz
rigid beam on springs: bounce frequency sqrt(sum k / m) / 2 pi     OK   7.118 Hz
simply supported beam: midspan deflection F L^3 / (48 EI)          OK   0.1250 mm
Latin hypercube: one point in each of the 10 strata per variable   OK   
response surface recovers an exact quadratic                       OK   
Kriging interpolates its training points                           OK   
Nelder-Mead solves Rosenbrock (1, 1)                               OK   
expected improvement: EI(mu = fmin, s) = s / sqrt(2 pi)            OK   
file-based coupling (template -> external run -> parse) = direct call OK   
calibration recovers the hidden stiffness factors 0.8 / 1.2        OK   0.8000 / 1.2000
SELFTEST PASS
```

| Check | What it proves | Why it matters for the workflow |
|---|---|---|
| Free–free beam 263.05 Hz | element stiffness, consistent mass, eigen solver | the virtual CAE gives correct frequencies, so the loop is tested with a real physical model |
| Rigid beam on springs | spring assembly, point masses | the mount modes (an active limit) are right |
| Simply supported beam F·L³/(48EI) | static solution, load vector | sag and stress (limits) are right |
| Latin hypercube strata | DOE property | the surrogate sees the whole design space |
| Exact quadratic / Kriging interpolation | surrogate fitting | the surrogate reproduces what it was trained on |
| Rosenbrock (1, 1) | optimiser | the search converges on a hard valley |
| EI(μ = f_min) = s/√(2π) | infill criterion | EGO explores where the surrogate is uncertain |
| File coupling = direct call | template → external run → parse | the same loop works with Ansys or Abaqus in place of `solve` |
| Calibration 0.8 / 1.2 | model updating | test results can correct the model |

In addition, chapter 7 contains two consistency checks: the sum of the mount forces equals the weight (7.2), and the
results do not change between 8 and 64 elements (7.3).

### 8.2 Complete worked example – base frame of the ball-screw test rig

The second frame comes from the ball-screw factory: the base frame of a test rig on levelling mounts. A drive motor
(45 kg), a carriage (30 kg) and a load unit (80 kg) stand on a 1.8 m frame of two RHS h × 80 × 5. The screw turns at
up to 3000 rpm (50 Hz). Its second order (100 Hz, unbalance and screw whirl) must stay below the first bending mode
with 25 % margin. The mount modes must be well below 50 Hz (≤ 20 Hz). Because the rig measures positioning accuracy,
the frame may sink at most **1.0 mm** on its mounts. Input file `examples/optflow_example.json`:

```json
{
  "name": "Base frame of the ball-screw test rig (ball-screw factory) on levelling mounts: minimum mass, screw 3000 rpm (example)",
  "L": 1800.0,
  "b": 80.0,
  "t": 5.0,
  "masses": [[300.0, 0.045], [900.0, 0.030], [1500.0, 0.080]],
  "F_shake": 150.0,
  "vars": [["h", 60.0, 200.0, "mm"], ["a", 50.0, 500.0, "mm"], ["k", 50.0, 1500.0, "N/mm"]],
  "x0": [140.0, 150.0, 400.0],
  "limits": {"f_rigid_max": 20.0, "f_bend_min": 125.0, "sag_max": 1.0, "sigma_max": 100.0},
  "f_exc": [50.0, 100.0]
}
```

Only the keys that differ from the default are given; everything else (E, density, element count, DOE size, EGO
iterations) is taken from `DEFAULT`. Command:

```
python optflow.py run --in examples/optflow_example.json --out example
```

```
# Optimisation workflow report - Base frame of the ball-screw test rig (ball-screw factory) on levelling mounts: minimum mass, screw 3000 rpm (example)

Variables: h 60 ... 200 mm, a 50 ... 500 mm, k 50 ... 1500 N/mm
Limits: f_rigid <= 20.0 Hz (isolation of 50.0 Hz), f_bend >= 125.0 Hz (1.25 x 100.0 Hz), sag <= 1.0 mm, sigma <= 100 MPa

## Current design
- h 140.0 mm, a 150.0 mm, k 400.0 N/mm -> mass 59.35 kg, f_rigid 19.95 Hz, f_bend 195.8 Hz, sag 1.31 mm, sigma 2.8 MPa; first frequencies 13.47, 19.95, 195.77, 757.76 Hz
- constraints (<= 0 OK): f_rigid -0.002, f_bend -0.566, sag +0.314, sigma -0.972

## Surrogate-based optimisation (LHS 20 + Kriging + 12 infill iterations)
- iteration  1:  22 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  2:  24 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  3:  26 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  4:  28 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  5:  30 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  6:  32 solver calls, best feasible mass 46.52 kg (h 94.6 mm, a 417.1 mm, k 554.8 N/mm)
- iteration  7:  34 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- iteration  8:  36 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- iteration  9:  38 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- iteration 10:  40 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- iteration 11:  42 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- iteration 12:  44 solver calls, best feasible mass 46.05 kg (h 93.0 mm, a 500.0 mm, k 509.8 N/mm)
- result: h 93.0 mm, a 500.0 mm, k 509.8 N/mm -> mass 46.05 kg, f_rigid 16.64 Hz, f_bend 125.2 Hz, sag 0.97 mm, sigma 3.2 MPa (44 solver calls)

## Direct optimisation on the solver (multi-start Nelder-Mead, penalty) - reference
- result: h 91.6 mm, a 255.3 mm, k 492.0 N/mm -> mass 45.66 kg, f_rigid 20.01 Hz, f_bend 123.5 Hz, sag 1.00 mm, sigma 3.0 MPa, feasible no (723 solver calls)
- surrogate workflow used 6 % of the solver calls of the direct search; mass saving vs current design 22.4 %
```

**Step 1 – current design.** The existing frame (RHS 140 × 80 × 5, mounts 150 mm from the ends, 400 N/mm) is heavy
(59.4 kg) and still **infeasible**: it sinks 1.31 mm (limit 1.0 mm), and its mount mode (19.95 Hz) is just at the
limit. Its bending mode (196 Hz) is far above what is needed. The frame is too stiff in bending and too soft on its
mounts.

**Step 2 – surrogate workflow.** After the 20-point Latin hypercube the best feasible design is already 46.5 kg. The
infill iterations improve it to **46.05 kg (−22.4 %)**: h 93.0 mm, mounts at the end of the allowed range
(a = 500 mm), k = 510 N/mm. Three limits are active again: bending mode 125.2 Hz, sag 0.97 mm, and the mount position
at its upper bound. The mount mode (16.6 Hz) is not active, because the sag limit forces stiff mounts and moving
them inwards keeps the pitch mode low. **The bound on a is active**: if the layout allows mounts more than 500 mm from
the ends, the frame can become lighter. That is a question for the layout, not for the optimiser.

**Step 3 – direct search as reference.** The direct Nelder–Mead search on the solver needs 723 calls and stops at a
design that violates two limits slightly (20.01 Hz, 123.5 Hz). The same lesson as in the default problem: penalty
methods end just outside the limits, and they need about 16 times more solver calls.

**Step 4 – to manufacturing (chapter 7 applied).** Round h = 93.0 mm to a catalogue section with the same width and
wall, e.g. RHS 100 × 80 × 5 (EN 10219), and **re-tune a and k** with `fc_retune()`. Then pick a levelling mount close
to the tuned k and re-tune a, check the tolerance corners (mount stiffness ±10–20 %, wall ±10 %, masses ±3–10 %),
draw, cost, and test with the acceptance window ±5 %. Because the sag limit (1.0 mm) is tight, the mount stiffness
tolerance will dominate the corner check exactly as in 7.4. Precision levelling mounts with a measured stiffness, or
adjustable levelling after installation, are the process measures that make the limit achievable.

The evaluation log `example/evaluations.csv` lists all 44 solver calls with variables, responses and the feasible
flag. The folder `example/templates/` contains the SOLIDWORKS, Ansys, Abaqus, Adams and MATLAB templates filled with
the optimum.

### 8.3 Limits of the program

- The virtual CAE is a 2-D beam model: vertical bending and the two vertical mount modes. Lateral and torsional
  modes, local plate modes of the RHS walls and the flexibility of the welded joints are not modelled. The joint
  flexibility is the reason for the calibration factor (chapter 4, 7.8).
- The two beams are modelled as one beam pair, which assumes the load is shared equally.
- Isolation mounts are linear springs without damping or frequency dependence. Real rubber is about 1.2–1.5 × stiffer
  dynamically than statically (check the data sheet).
- Catalogue data (RHS masses, mounts, costs) are typical values. Replace them with your supplier's data.
- The exported scripts are templates, not tested against a licensed installation on this PC.

### 8.4 References

- Forrester, A. I. J.; Sóbester, A.; Keane, A. J.: *Engineering Design via Surrogate Modelling – A Practical Guide.* Wiley, 2008.
- Jones, D. R.; Schonlau, M.; Welch, W. J.: Efficient global optimization of expensive black-box functions. *Journal of Global Optimization* 13 (1998), 455–492.
- Nocedal, J.; Wright, S. J.: *Numerical Optimization.* 2nd ed., Springer, 2006.
- Myers, R. H.; Montgomery, D. C.; Anderson-Cook, C. M.: *Response Surface Methodology.* 4th ed., Wiley, 2016.
- Santner, T. J.; Williams, B. J.; Notz, W. I.: *The Design and Analysis of Computer Experiments.* 2nd ed., Springer, 2018.
- ASME V&V 10-2019: Standard for Verification and Validation in Computational Solid Mechanics; ASME V&V 20-2009 (fluid dynamics and heat transfer; the validation-metric ideas apply).
- NAFEMS: *What is Verification and Validation?*; *Engineering Simulation Quality Management* (NAFEMS publications).
- Ewins, D. J.: *Modal Testing: Theory, Practice and Application.* 2nd ed., Research Studies Press, 2000.
- Friswell, M. I.; Mottershead, J. E.: *Finite Element Model Updating in Structural Dynamics.* Kluwer, 1995.
- EN 10219-2: Cold formed welded structural hollow sections – tolerances, dimensions and sectional properties.
- Ansys Workbench Scripting Guide, Mechanical APDL Command Reference (Ansys Help, version-specific).
- Abaqus Scripting User's Guide and Scripting Reference (SIMULIA documentation).
- Adams/View Command Language Reference (MSC Software documentation).
- SOLIDWORKS API Help (`IModelDoc2.Parameter`, `IModelDocExtension.CreateMassProperty`, design tables).
- MATLAB Global Optimization Toolbox documentation (`surrogateopt`, `ga`, `patternsearch`) and Optimization Toolbox (`fmincon`).
- Guide M1 of this folder (chapters 8, 29–31: optimisation algorithms, DOE, robust design); M10 (tolerances); M11 (welds, frames, mounts).

### 8.5 Glossary

| Term | Meaning |
|---|---|
| Active limit | A constraint that is exactly met at the optimum (g = 0); moving the design in its direction is not allowed |
| Calibration (model updating) | Adjusting uncertain model parameters (joint and mount stiffness) so that the model reproduces measured results |
| Catalogue rounding | Replacing continuous optimum values by purchasable sizes, followed by re-tuning of the other variables |
| Corner (tolerance corner) | A combination of all uncertain inputs at their extreme values; with monotonic responses the worst case lies at a corner |
| DOE | Design of experiments: the planned set of design points run before any optimisation (here a Latin hypercube) |
| EGO | Efficient global optimisation: surrogate model plus infill points chosen by expected improvement |
| Expected improvement (EI) | Expected gain over the best known design, using the surrogate's prediction and uncertainty |
| File-based coupling | Connecting programs by writing an input file, running the program in batch, and parsing its result file |
| Infill point | A new solver run added where the surrogate predicts an optimum or is most uncertain |
| Inner / outer loop | Discrete choices (catalogue) in the outer loop, continuous re-tuning inside each |
| Kriging | A surrogate that interpolates the runs and gives an uncertainty estimate between them |
| Latin hypercube | A DOE in which each variable range is cut into n strata with exactly one point per stratum |
| Manifest | A small file with the run identity (input hash), solver, design and results, kept for reproducibility |
| Margin | Distance of a response from its limit, in percent of the limit |
| Mount mode (rigid-body mode) | Vibration of the frame as a rigid body on its mounts (bounce, pitch) |
| Penalty method | Constraint handling by adding a cost for violation; tends to end slightly outside the limits |
| Robust design | A design that meets all limits for the whole scatter of the inputs, not only at nominal values |
| Surrogate | A cheap mathematical model of the expensive solver, fitted to the DOE and infill runs |
| Template | A script with placeholders `{h}`, `{a}`, `{k}` that the workflow fills for each design |
| Trend value | A CAE result that shows the right direction of change but whose absolute value is not yet verified and calibrated |
