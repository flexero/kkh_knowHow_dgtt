# M5d – Cylindrical gear manufacturing: blank, hobbing, shaping, power skiving, heat treatment, grinding, honing, inspection, cost

> Field 1 *Mechanical design*, item 5d (manufacturing companion of M5 cylindrical gears; bevel gear manufacturing is in
> M5b chapter 7, worm gear manufacturing in M5c chapter 7).
> **Theory and program are combined:** every formula is followed by the code of `tools/gearmfg.py`, the command and the
> real output. MATLAB mirror: `tools/gearmfg.m`. Web: tab **M_P_C tools**, item 11. Python standard library only – offline.
> The program re-uses M5 (`gear.py`) for the case-depth rule, the ISO 1328 tolerances and the size measurements.
> **All inputs are example values.** Cutting data, the Hoffmeister chip-thickness formula, the Harris carburising law,
> grinding data, machine-hour rates and tool prices are typical values or published approximations. Values marked
> "check" must be compared with the tool maker's and machine maker's data and your own shop measurements.

## Contents
0. How to use this guide with the program
1. Purpose – what manufacturing planning of a gear must deliver
2. Process chains and the gear blank
3. Hobbing (kinematics, hob design, cutting data, surface, tool life, cycle time)
4. Shaping, power skiving and other soft methods (milling, broaching, rolling, shaving, chamfering)
5. Heat treatment (carburising, quenching, distortion, nitriding, induction) and its inspection
6. Hard finishing (generating grinding, profile grinding, honing, hard skiving, superfinishing, shot peening)
7. Inspection, quality control and production planning
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python gearmfg.py params` | Default input as JSON (copy → edit → `--in`) |
| `python gearmfg.py run --in my.json --out res` | Full plan → `report.md`, `chains.csv` (time, cost, grade of every process chain) |
| `python gearmfg.py examples` | Report of the default wheel, hob starts / gashes study, feed study, induction depth vs frequency |
| `python gearmfg.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python gearmfg.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=11#mpc` | Same plan with KPIs, process-chain cost chart, time per operation, feed / surface curve |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Workpiece diameters, tooth depth, blank mass | `work_geometry()` |
| 3 | Hob reference diameter, lead angle, swivel angle, speeds, index ratio | `hob_setup()` |
| 3 | Approach length, hobbing time, feed-mark depth, enveloping flats, maximum chip thickness (Hoffmeister), hob cost per part | `hob_approach()`, `hob_time()`, `feed_mark_depth()`, `envelope_depth()`, `hoffmeister_hmax()`, `hob_tool_cost_per_part()` |
| 4 | Shaping strokes and time; power skiving velocity triangle, speeds, time | `shaping_time()`, `skiving()` |
| 5 | Case depth plan (final, green, root), Harris carburising law and time, nitriding time, induction reference depth | `chd_plan()`, `harris_total_case()`, `carburising_time()`, `nitriding_time()`, `induction_depth()` |
| 6 | Generating grinding time (rough + finish), profile grinding time and specific removal rate | `gen_grinding_time()`, `prof_grinding_time()` |
| 7 | Achievable grade / roughness per process, ISO 1328 tolerances, operation cost, process chains | `PROCESS_QUALITY`, `tolerances()`, `op_cost()`, `chain_options()` |
| – | Report, chains CSV | `report_text()`, `run()` |
| 2–4 | Blank routes and tolerances, blank-error effect, hob accuracy classes, hob basic rack (protuberance), shifting plan, cutting-data study, differential rotation, two-cut strategy, crowning infeed, shaper cutter, run-out space, skiving Σ study, shaving, gear milling, broaching, chamfering, method choice | `it_grade_um()`, `blank_tolerances()`, `blank_error_effect()`, `hob_class_for_grade()`, `hob_basic_rack()`, `hob_shift_plan()`, `cutting_data_study()`, `differential_rotation()`, `two_cut_strategy()`, `crowning_infeed()`, `shaper_cutter()`, `runout_space()`, `skiving_sigma_study()`, `shaving_data()`, `gear_milling_time()`, `broaching_time()`, `choose_soft_method()`, `BLANK_ROUTES`, `HOB_CLASSES`, `HOB_CUTTING_DATA`, `CHAMFER_METHODS`, `METHOD_CHOICE` |
| 5–6 | Case steels and core hardness, carbon diffusion (erf, boost–diffuse), hardness traverse, tempering (Hollomon–Jaffe), distortion and stock, case-loss check, nitriding plan, induction frequency, generating grinding with dressing, flank twist, grinding burn, profile-grinding options, honing, shot peening, hard-finish choice | `jominy_equivalent()`, `core_hardness()`, `steel_choice()`, `D_carbon`, `carbon_erf()`, `depth_at_carbon()`, `time_for_carbon_depth()`, `hv_from_c()`, `boost_diffuse()`, `boost_for_chd()`, `hardness_traverse()`, `hollomon_jaffe()`, `equivalent_tempering_time()`, `distortion_estimate()`, `stock_needed()`, `stock_sharing()`, `case_loss_check()`, `nitriding_plan()`, `freq_for_depth()`, `induction_choice()`, `gen_grinding_with_dressing()`, `flank_twist()`, `burn_check()`, `prof_grinding_options()`, `honing_time()`, `peening_coverage_time()`, `peening_gain()`, `JOMINY_D`, `CASE_STEELS`, `R_GAS`, `HV_OF_C`, `QUENCH_FACTOR`, `NITRIDING`, `QW_LIMIT`, `HARD_FINISH_CHOICE` |
| 7–8 | ISO 1328 grade table, roll-test tolerances, deviation causes, W_k / pins size control, gauge capability, Cp / Cpk, X̄–R limits, machines needed, economic lot, cost vs volume and break-even, furnace plan, lead time, shoulder clearance, hunting check, inspection plan, worked pinion example | `tolerance_grades()`, `roll_test_tolerances()`, `size_control()`, `gauge_capability()`, `span_samples()`, `cp_cpk()`, `xbar_r_limits()`, `machines_needed()`, `economic_lot()`, `chain_cost_vs_volume()`, `break_even_volume()`, `furnace_plan()`, `lead_time()`, `tool_shoulder_clearance()`, `hunting_check()`, `shaft_mass()`, `pinion_example()`, `DEVIATION_CAUSES`, `OP_TIMES`, `SPECIAL_TOOLS`, `EXAMPLE_PINION`, `PINION_SHAFT`, `INSPECTION_PLAN` |
Example input of chapter 8: `tools/examples/gearmfg_example.json`.

### 0.3 What the self-test proves
1. Hobbing index: n_table·z = n0·z0; hob lead angle sin γ0 = z0·m_n/d0; hobbing time = z·L/(z0·n0·f_a).
2. The feed-mark formula equals the exact circle sagitta × sin α_n (within 0.1 %); enveloping flats scale with 1/i0².
3. Harris law: inverse is consistent, 4 × time gives 2 × case depth.
4. Power skiving: the relative velocity computed from vectors lies along the tooth line and its size equals v_c.
5. Induction reference depth at 10 kHz in hot steel ≈ 5.5 mm.
6. The cheapest chain that meets the grade is listed first; honing alone is rejected when the heat-treatment stock is too large.
7. Final case depth lies inside the 0.15–0.20·m_n rule; generating grinding finish/rough time ratio = feed ratio.

## 1. Purpose – what manufacturing planning of a gear must deliver

The M5 calculation says *what* gear is needed (module, teeth, profile shift, grade, case depth). Manufacturing planning
says *how* to make it repeatably at the right cost:

| Question | Answer from | Chapter |
|---|---|---|
| Which process chain (soft machining → heat treatment → hard finishing)? | Grade, hardness, internal / external, shoulders, volume | 2, 7 |
| Which tool and which machine settings? | Hob / cutter design, swivel angle, speeds, feeds | 3, 4 |
| What surface and accuracy does soft machining leave? | Feed marks, enveloping flats, chip thickness, tool accuracy | 3 |
| Which case depth before grinding, how long in the furnace, how much distortion? | CHD plan, carburising law, stock | 5 |
| How to reach grade 6 or better and avoid grinding burn? | Grinding method, stock, removal rate, inspection | 6 |
| How to prove the quality, how many machines, what does one gear cost? | ISO 1328, size control, SPC, capacity, cost | 7 |

**Default example** (`python gearmfg.py examples`): the wheel of the M5 reducer, m_n 2 mm, z 60, β 15° right hand,
x −0.10, b 28 mm, 18CrNiMo7-6 case hardened, required grade 6, batch 500, 4000 per year.

| Result | Value |
|---|---|
| Hobbing (2-start hob Ø70, 16 gashes, 150 m/min, f_a 2.5) | swivel 11.47°, 0.86 min cut; feed marks 7.6 µm, enveloping flats 0.44 µm, h_max 0.130 mm |
| Alternatives | shaping 5.31 min, power skiving 1.88 min per wheel |
| Case hardening | CHD 0.35 mm after grinding → 0.45 mm green; about 1.3 h carburising at 930 °C (Harris, check) |
| Hard finishing | generating grinding 2.13 min, profile grinding 11.62 min |
| Best chain | hobbing → carburising → generating grinding: 3.49 min machining, 14.82 € per part (example rates); honing alone is not possible with 0.10 mm stock per flank |


---

## 2. Process chains and the gear blank

### 2.1 What "making a gear" means

A cylindrical gear is never made in one operation. It passes through a **process chain**, and every link of the chain
has its own job:

| Link | Job | Typical result |
|---|---|---|
| Blank | Material with the right grain flow, hardenability and clean datum surfaces | bore IT6, faces flat and square |
| Soft machining | Cut the teeth in the soft (annealed) state, leave stock for hard finishing | ISO 1328 grade 8 … 9, Ra 1.6 … 3.2 µm |
| Heat treatment | Hardness and residual compressive stress in the case | 58 … 62 HRC surface; **distortion** 20 … 80 µm |
| Hard finishing | Remove the distortion, give the final flank form and modifications | grade 3 … 6, Ra 0.2 … 0.5 µm |
| Inspection | Prove the grade, the tooth thickness and the case | measuring report |

The **design** (M5) fixes the gear data, the grade and the case depth. The **manufacturing plan** (this chapter and the
next ones) chooses the methods, the stock, the tools and the cycle times so that the design is met at the lowest cost.
The program `gearmfg.py` follows that chain for the wheel of the M5 reducer (m_n 2, z 60, β 15° right hand, x −0.10,
b 28 mm, grade 6, case hardened):

```
python gearmfg.py examples
```
```
# Gear manufacturing report - Helical wheel z 60 of the M5 reducer, case hardened and ground (example)

mn 2.00, z 60, beta 15.0 deg right, x -0.10, b 28.0 mm; d 124.233, da 127.833, df 118.833, h 4.500 mm; blank mass 2.49 kg
```

**Hand check of the workpiece geometry** (`work_geometry()`):

```python
def work_geometry(P):
    mn, z = P["mn"], P["z"]
    be, an = math.radians(P["beta_deg"]), math.radians(P["alpha_n_deg"])
    d = mn * z / math.cos(be)
    da = d + 2 * mn * (P["haP"] + P["x"])
    df = d - 2 * mn * (P["hfP"] - P["x"])
    h = (da - df) / 2
```

- d = m_n·z / cos β = 2 · 60 / cos 15° = 120 / 0.965926 = **124.233 mm**
- d_a = d + 2 m_n (h_aP* + x) = 124.233 + 4 · 0.90 = **127.833 mm**
- d_f = d − 2 m_n (h_fP* − x) = 124.233 − 4 · 1.35 = **118.833 mm**
- h = (d_a − d_f)/2 = **4.500 mm** = 2.25 m_n (the full tooth depth the hob must cut).

### 2.2 The datum principle

The single most important rule of gear manufacturing is: **design datum = manufacturing datum = inspection datum.**
For a wheel with a bore this datum is the **bore axis** plus **one locating face**. The bore and this face are turned
in one clamping (so they are square to each other); the hobbing machine clamps the gear on an expanding mandrel in the
bore and against the face; the grinding machine and the gear measuring machine use the same bore and face. Every
change of datum adds an error that the flank tolerance has to absorb.

Typical blank sequence for a forged wheel:
1. Forging, then **isothermal annealing (FP)** – ferrite-pearlite structure, even hardness 160 … 200 HB, good
   machinability and, above all, *predictable distortion* in carburising.
2. Rough turning both sides (stock 1 … 2 mm).
3. Finish turning side A: bore, locating face, tip diameter – **one clamping**.
4. Finish turning side B on a mandrel in the bore (so side B is referenced to the bore).
5. Marking of the locating face (the hobber, the grinder and the inspector must know which face is the datum).

### 2.3 Blank routes

```
python gearmfg.py ch24
```
```
## 2.1 Blank routes
  bar stock, sawn + turned                         prototypes, small batches, d < ~150 mm material poor (chips 40-60 %)   fibre cut               cost 1.4  no tool cost
  die forging + normalising / isothermal annealing series 1 000+                        material good                   fibre follows contour   cost 1.0  die cost; FP annealing for even hardness
  ring rolling (seamless rolled ring)              large rims d > 300 mm                material very good              fibre circumferential   cost 1.1  rims for large wheels
  casting (steel / ductile iron)                   large, low-stress gears              material good                   fibre none              cost 0.9  pores - not for case hardening
  powder metal (sinter + densify)                  very high volume, small m            material best (near net)        fibre none              cost 0.7  density limits strength
```

(`BLANK_ROUTES` – relative costs are typical, check with your suppliers.) For our 4 000 wheels per year the die forging
is right; for the first 50 prototypes bar stock is used (no die), with the same heat-treatment specification so the
prototypes show the real distortion.

**Material for case hardening:** 16MnCr5, 20MnCr5, 18CrNiMo7-6 (larger sections, higher core strength). The steel must
be ordered with a **hardenability band** (H, HH or HL grades of EN ISO 683-3): a narrow Jominy band gives a narrow
spread of distortion, which directly reduces the grinding stock (chapter 5).

### 2.4 Blank tolerances derived from the flank grade

The blank tolerances are not free choices; they follow from the flank tolerances of ISO 1328.

**Standard tolerance (ISO 286-1):** tolerance unit i = 0.45·D^(1/3) + 0.001·D (µm, D in mm), IT6 = 10 i, IT7 = 16 i,
IT11 = 100 i. (The standard uses the geometric mean of the size range; the program takes D itself – check the table.)

**Datum face runout:** if the locating face runs out by f_ax over its diameter D_face, the blank is tilted by
f_ax / D_face and the helix over the face width b gets a slope error f_Hβ ≈ f_ax·b / D_face. We give this error at most
one third of the helix tolerance F_βT:

  f_ax ≤ (F_βT / 3) · D_face / b

```python
def blank_tolerances(P, D_face=None):
    w = work_geometry(P)
    tol = tolerances(P)
    bore = 0.35 * w["d"]
    D_face = D_face or 0.8 * w["df"]
    face_runout = tol["FbetaT"] / 3 * D_face / P["b"]          # helix share <= 1/3 F_betaT
    return {"bore": bore, "IT6_bore": it_grade_um(bore, 6), "IT7_bore": it_grade_um(bore, 7), "D_face": D_face,
            "face_runout_um": face_runout, "tip_IT11_um": it_grade_um(w["da"], 11), "tip_runout_um": 0.5 * tol["FrT"], ...}
```
```
## 2.2 Blank tolerances from the flank grade 6
  bore 43.5 mm: IT6 16.3 um, IT7 26.0 um; datum face D 95.1 mm runout <= 11.5 um (helix share F_betaT/3 = 3.4 um)
  tip diameter 127.833: IT11 239 um (size), tip runout <= 12.6 um (0.5 F_rT, F_rT 25.2 um)
```

Hand check: i = 0.45·43.5^(1/3) + 0.001·43.5 = 0.45·3.517 + 0.044 = 1.627 µm → IT6 = 16.3 µm ✓.
F_βT (grade 6, from `gear.iso1328_2013`) = 10.1 µm → f_ax ≤ 10.1/3 · 95.1/28 = **11.5 µm** ✓.

So the drawing of the blank gets: bore Ø43.5 H6, locating face runout 0.010 to the bore, tip diameter h11 with runout
0.012 (the tip is used to align the gear in the machine and as a reference for the tooth-thickness caliper – its
*size* tolerance can be wide, its *runout* cannot).

### 2.5 How blank errors become tooth errors

**Eccentric clamping.** A bore with diametral clearance c on the mandrel can sit off-centre by e = c/2. The teeth are
then cut concentric to the machine axis but eccentric to the bore. When the gear runs on its own shaft (bore axis) the
teeth have a **radial runout F_r = 2e** (the dial indicator reads the difference between the maximum and the minimum).

**Tilted clamping.** Face runout f_ax over D_face tilts the gear; the helix is cut straight in the machine but is
inclined to the bore axis: f_Hβ ≈ f_ax·b / D_face.

```python
def blank_error_effect(P, bore_clear_um=20.0, face_runout_um=10.0, D_face=None):
    w = work_geometry(P)
    D_face = D_face or 0.8 * w["df"]
    e = bore_clear_um / 2
    tol = tolerances(P)
    return {"e_um": e, "Fr_um": 2 * e, "fHb_um": face_runout_um * P["b"] / D_face, "FrT": tol["FrT"], "FbetaT": tol["FbetaT"]}
```
```
## 2.3 Blank errors -> tooth errors
  bore clearance 10 um, face runout  5 um: e  5.0, F_r 10.0 um (F_rT 25.2), helix slope 1.5 um (F_betaT 10.1)
  bore clearance 20 um, face runout 10 um: e 10.0, F_r 20.0 um (F_rT 25.2), helix slope 2.9 um (F_betaT 10.1)
  bore clearance 40 um, face runout 20 um: e 20.0, F_r 40.0 um (F_rT 25.2), helix slope 5.9 um (F_betaT 10.1)
```

**Lessons for the shop:**
- A fixed mandrel with 40 µm clearance alone uses up more than the whole runout tolerance of grade 6 (40 > 25.2 µm).
  Hobbing and grinding mandrels for grade 6 and better are **expanding (hydraulic or collet) mandrels** – zero clearance.
- Runout in the soft state is partly removed by grinding, but only if the grinding machine clamps on the same datum;
  otherwise the grinding stock must also cover the runout (more stock = more cost, thinner case – chapter 5).
- The face must be clean: a chip of 10 µm under the face is the same as 10 µm face runout.

### 2.6 The soft grade

Before heat treatment the gear needs only the grade that the hard finishing can still correct: ground gears are hobbed
to grade 8 … 9 with **stock** on each flank; gears that are *not* ground after hardening (nitrided, induction hardened
with small distortion, or through-hardened and used as-cut) need the final grade already from the soft process
(shaving or hobbing with a class AA hob). The soft grade decides the hob class (§ 3.5).

---

## 3. Hobbing (kinematics, hob design, cutting data, surface, tool life, cycle time)

### 3.1 Principle

Hobbing is **generating** with a worm-gear mesh: the hob is a worm (usually 1 … 3 starts) whose thread is interrupted by
**gashes** to form cutting teeth; every hob tooth has the profile of the **basic rack** in its normal section. Hob and
blank rotate in the ratio of a worm drive; while they rotate, the hob is fed along the gear axis. Every tooth of the
gear is formed by the **envelope** of many successive cuts; one hob cuts every number of teeth and every profile shift
of a given module and pressure angle. Hobbing is the most productive soft method for external spur and helical gears
and is used for > 80 % of all cylindrical gears.

### 3.2 Index ratio

In one revolution of a z₀-start hob, its thread advances z₀ pitches; the gear must turn z₀ teeth:

  n_table / n₀ = z₀ / z     →     n_table = n₀ · z₀ / z

The hob speed comes from the cutting speed on the hob tip diameter: n₀ = 1000·v_c / (π·d_a0).

```python
def hob_setup(P, w=None):
    w = w or work_geometry(P)
    mn, z0 = P["mn"], P["hob_z0"]
    d0 = P["hob_da0"] - 2 * P["hfP"] * mn                     # hob reference diameter (hob addendum = gear dedendum)
    g0 = math.asin(z0 * mn / d0)                               # hob lead angle
    same = P["hand"] == P["hob_hand"]
    be = math.radians(P["beta_deg"])
    eta = be - g0 if same else be + g0                         # swivel (setting) angle
    n0 = 1000 * P["hob_vc"] / (math.pi * P["hob_da0"])
    n_table = n0 * z0 / P["z"]
```
```
## Hobbing
- hob da0 70, z0 2, 16 gashes, right hand: d0 65.00, lead angle 3.528 deg, swivel angle 11.472 deg (same hand)
- vc 150 m/min -> n0 682 rpm, table 22.74 rpm; fa 2.50 mm/rev; approach 17.8, path 48.8 mm -> 0.86 min cut, 1.36 min total
- feed marks 7.63 um, enveloping flats 0.44 um; max chip thickness (Hoffmeister) 0.130 mm; hob cost 1.273 EUR/part
```

Hand check: n₀ = 1000·150 / (π·70) = **682.1 rpm**; n_table = 682.1 · 2 / 60 = **22.74 rpm** ✓.
On old machines the ratio is set by **change gears** (index gears) with an exact fraction; on CNC machines the
**electronic gearbox (EGB)** couples the table drive to the hob spindle encoder. The selftest of the program checks the
identity n_table·z = n₀·z₀ (`python gearmfg.py selftest`).

**Prime numbers and hunting:** with a multi-start hob, z/z₀ should not be an integer if possible – otherwise each gear
tooth is always cut by the same hob thread, and a pitch error of the hob between its threads appears as a pitch error
on the gear. With z 60 and z₀ 2 every gear tooth is cut by the same thread every second tooth (60/2 = 30): the hob
thread-to-thread error must be small (class A or better, § 3.5) – or a 1-start or 3-start hob would be chosen
(60/3 = 20, same problem; z₀ 7 would hunt but is impractical). Engineers accept it here because the gear is ground.

### 3.3 Hob lead angle and swivel angle

The hob is a worm with reference diameter d₀ and lead angle γ₀ (sin γ₀ = z₀·m_n / d₀, normal-module definition used
for hobs). To cut a spur gear, the hob thread must be parallel to the gear axis at the contact point → the hob axis is
**swivelled** by γ₀. For a helical gear with helix angle β:

  η = β − γ₀   (hob and gear **same** hand)        η = β + γ₀   (opposite hand)

The hob addendum equals the gear dedendum (the hob tip cuts the gear root): d₀ = d_a0 − 2·h_fP*·m_n.

Hand check: d₀ = 70 − 2·1.25·2 = **65.00 mm**; sin γ₀ = 2·2/65 = 0.061538 → γ₀ = **3.528°**; same hand →
η = 15 − 3.528 = **11.472°** ✓.

**Same hand is preferred**: the swivel angle is smaller, the hob and the work axes are closer to perpendicular, the
cutting is more stable and the approach is shorter. Opposite hand is used only when a hob of the right hand is not
available (one hob for left and right gears in a job shop).

### 3.4 Helical gears: the differential (additional rotation)

For a helical gear the hob also moves axially. While the hob travels one **lead** of the gear helix,
p_z = π·d / tan β = π·m_n·z / sin β, the gear must make one *extra* revolution so the hob follows the helix. Per gear
revolution the hob advances f_a, so the extra rotation is f_a / p_z revolutions; with the EGB:

  n_table = n_index / (1 ∓ f_a / p_z),    n_index = n₀·z₀ / z

(the sign depends on hand and feed direction – check the machine manual; the program uses − for same hand).

```python
def differential_rotation(P):
    be = math.radians(P["beta_deg"])
    pz = math.pi * P["mn"] * P["z"] / math.sin(be)
    k = P["hob_fa"] / pz
    n_index = hob_setup(P)["n_table"]
    sign = 1 if P["hand"] == P["hob_hand"] else -1
    n_table = n_index / (1 - sign * k)
```
```
## 3.5 Differential (helical additional rotation)
  lead p_z 1456.6 mm; extra rotation 0.001716 rev per work rev; table 22.7755 rpm (index 22.7364 rpm)
```

Hand check: p_z = π·2·60 / sin 15° = 376.99 / 0.258819 = **1456.6 mm**; f_a/p_z = 2.5/1456.6 = **0.001716**;
n_table = 22.7364 / (1 − 0.001716) = **22.7755 rpm** ✓.

The correction is only 0.17 % of the table speed, but this small term *is* the helix: without it the hob would cut a
spur gear. An error ε in the additional rotation changes the lead by the fraction ε and gives a helix slope error of
about b·tan β·ε over the face width: ε = 10⁻³ → 28·0.268·0.001 = 7.5 µm, already 74 % of F_βT (10.1 µm). On mechanical
machines the differential change gears are therefore calculated to 5 … 6 significant digits; the EGB of a CNC machine
computes the ratio exactly.

### 3.5 Hob design

**Hob basic rack.** The hob tooth is the "negative" of the gear tooth space:
- hob addendum h_a0 = h_fP* · m_n (cuts the gear root), hob dedendum h_f0 = (h_aP* + c*) · m_n;
- hob tip radius ρ_a0 = ρ_fP* · m_n (forms the root fillet – this radius decides the root stress, M5 § form factor);
- hob tooth thickness s₀ = π·m_n − s_n,pre (on the reference line at x = 0 position).

**Pre-grinding (stock) hob.** If the flanks are ground later, the gear is cut thicker by a normal stock q per flank.
A normal stock q on each flank increases the tooth thickness on the reference circle by 2q / cos α_n:

  s_n,pre = s_n + 2 q / cos α_n

**Protuberance.** If the grinding wheel removes q from the flank down to the root, it would leave a *step* (notch) at
the end of the ground zone – a stress raiser in the root. The hob therefore has a small **protuberance** (a bump at the
tip) of pr₀ ≈ q + 0.02 mm: it undercuts the lower flank slightly, so the grinding wheel later runs out into the
undercut and never touches the root fillet. The fillet keeps the hobbed surface *and* the full case depth (chapter 5).

**Tip chamfer (semi-topping).** A small flank at the hob root chamfers the gear tip edge (~0.1 m_n): no sharp tip edge
that would over-carburise and break off after hardening.

```python
def hob_basic_rack(P, stock=None, prot_extra=0.02):
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    q = P.get("stock_per_flank", 0.10) if stock is None else stock
    sn_gear = mn * (math.pi / 2 + 2 * P["x"] * math.tan(an))
    sn_pre = sn_gear + 2 * q / math.cos(an)
    s0 = math.pi * mn - sn_pre
    return {"ha0": P["hfP"] * mn, "hf0": (P["haP"] + 0.25) * mn, "sn_gear": sn_gear, "sn_pre": sn_pre, "s0": s0,
            "protuberance": q + prot_extra, "tip_chamfer": 0.1 * mn, "rho_a0": 0.38 * mn}
```
```
## 3.2 Hob basic rack for pre-grinding (stock 0.10 mm per flank)
  h_a0 2.500, h_f0 2.500 mm; gear s_n 2.9960 -> pre-grind s_n 3.2088 mm; hob s_0 3.0743 mm; protuberance 0.120, tip chamfer 0.20, rho_a0 0.76 mm
```

Hand check: s_n = 2(π/2 + 2·(−0.10)·tan 20°) = 2(1.5708 − 0.0728) = **2.9960 mm**;
s_n,pre = 2.9960 + 2·0.10 / 0.93969 = 2.9960 + 0.2128 = **3.2088 mm**; s₀ = 6.2832 − 3.2088 = **3.0743 mm** ✓.

On the hob drawing these are ordered as "pre-grinding hob, protuberance 0.12, stock 0.10 per flank, tip chamfer";
the hob maker designs the exact protuberance curve.

**Hob accuracy classes** (DIN 3968 / ISO 4468, classes AA, A, B, C). The class sets tolerances for the thread profile,
the lead, the gash spacing and the runout of the hub. Rule: the soft gear grade is about the hob class grade plus the
machine and clamping errors.

```
## 3.1 Hob class for the soft grade
  class AA: profile form ~ 5 um -> soft gear grade 6-7
  class A : profile form ~10 um -> soft gear grade 7-8
  class B : profile form ~20 um -> soft gear grade 8-9
  class C : profile form ~40 um -> soft gear grade 9-10
  soft grade 8 before grinding -> class B; grade 7 -> class A
```

(`HOB_CLASSES`, `hob_class_for_grade()` – typical values, check DIN 3968 tables for your module.) Our wheel is ground
afterwards; a soft grade 8 is enough → **class B** would do, but because of the non-hunting z/z₀ (§ 3.2) we order
**class A** (thread-to-thread error smaller), the cost difference is small compared with the grinding time it saves.

**Number of gashes i₀.** More gashes = more cutting teeth per revolution = smaller chips, finer enveloping flats
(§ 3.7), longer tool life – but a larger hob diameter (gashes need space). Typical: 12 … 20 gashes for d_a0 60 … 110 mm.

**Shifting.** Only a short zone of the hob length is in action (about 2h / tan α_n + π m_n). After every part (or every
few parts) the hob is shifted axially by a small amount so that fresh teeth come into the zone; when the whole usable
length is used the hob is reground (sharpened on the gash faces).

```python
def hob_shift_plan(P, hob_length=90.0, usable=0.9):
    w = work_geometry(P)
    act = 2 * w["h"] / math.tan(math.radians(P["alpha_n_deg"])) + math.pi * P["mn"]
    free = usable * hob_length - act
    parts = P["hob_parts_per_regrind"]
    return {"active": act, "free": free, "shift_per_part": free / parts, ...}
```
```
## 3.3 Shifting
  active zone 31.0 mm, free length 50.0 mm -> shift 0.167 mm per part over 300 parts; 522 m of flank cut per regrind
```

Hand check: active = 2·4.5/tan 20° + π·2 = 24.73 + 6.28 = **31.0 mm**; free = 0.9·90 − 31.0 = **50.0 mm**;
50.0/300 = **0.167 mm** per part ✓. The tool life is measured in **metres of tooth length cut per hob tooth** or simply
in parts per regrind; the wear criterion is the flank wear land **VB ≈ 0.15 … 0.20 mm** at the corners (the tip
corner of the hob tooth carries the thickest chip and wears first). A wear land that is too large produces a rough
root, higher cutting forces and size errors.

### 3.6 Cutting data, climb vs conventional, chip thickness

**Climb vs conventional hobbing.** In *climb* hobbing the hob feed and the cutting direction at the contact are the
same: the chip starts thick and ends thin – less rubbing at the start, longer tool life, better surface. Climb is
standard on modern rigid machines. *Conventional* hobbing (chip starts thin) is used on old machines with backlash in
the feed drive and for some helical gears where climb hobbing pulls the work.

**Wet vs dry.** Dry hobbing with AlCrN-coated PM-HSS or carbide hobs is now standard in series production: no oil mist,
no chip cleaning, higher speeds – but it needs a machine with chip evacuation downward and thermal stability, and a
coating that withstands > 600 °C at the edge.

```python
HOB_CUTTING_DATA = [   # tool / coating / coolant, vc m/min, fa mm/rev (roughing m 2..4), note (typical - check tool maker)
    ("PM-HSS uncoated, oil", 60.0, 2.0, "old machines, low rigidity"),
    ("PM-HSS TiN / AlCrN, oil", 120.0, 2.5, "standard wet hobbing"),
    ("PM-HSS AlCrN, dry", 150.0, 2.5, "default of this program"),
    ("carbide AlCrN, dry", 300.0, 2.5, "high-speed dry hobbing, rigid machine"),
]
```
```
## 3.4 Cutting data
  PM-HSS uncoated, oil         vc    60  fa 2.0 -> n0   273 rpm, 2.68 min  (old machines, low rigidity)
  PM-HSS TiN / AlCrN, oil      vc   120  fa 2.5 -> n0   546 rpm, 1.07 min  (standard wet hobbing)
  PM-HSS AlCrN, dry            vc   150  fa 2.5 -> n0   682 rpm, 0.86 min  (default of this program)
  carbide AlCrN, dry           vc   300  fa 2.5 -> n0  1364 rpm, 0.43 min  (high-speed dry hobbing, rigid machine)
```

The hobbing time drops by a factor of 6 from the old wet HSS process to dry carbide; the hob price rises by a factor of
3 … 5 – carbide pays only at high volume and on rigid machines.

**Maximum chip thickness (Hoffmeister).** Tool life in hobbing correlates best with the maximum undeformed chip
thickness h_max at the hob tooth tip. Hoffmeister's empirical formula (published approximation, check):

  h_max = 4.9 m_n · z^(9.25·10⁻³β − 0.542) · e^(−0.015β) · e^(−0.015x) · (r_a0/m_n)^(−8.25·10⁻³β − 0.225)
          · (i₀/z₀)^(−0.877) · (f_a/m_n)^0.511 · (T/m_n)^0.319

with β in degrees, T = depth of cut (here the full depth h), r_a0 = d_a0/2. For multi-start hobs the program uses the
gashes per start i₀/z₀ (check).

```python
def hoffmeister_hmax(P, w=None):
    w = w or work_geometry(P)
    mn, z, b, x = P["mn"], P["z"], P["beta_deg"], P["x"]
    T = w["h"]
    ra0 = P["hob_da0"] / 2
    return (4.9 * mn * z ** (9.25e-3 * b - 0.542) * math.exp(-0.015 * b) * math.exp(-0.015 * x) *
            (ra0 / mn) ** (-8.25e-3 * b - 0.225) * (P["hob_gashes"] / P["hob_z0"]) ** (-0.877) * (P["hob_fa"] / mn) ** 0.511 * (T / mn) ** 0.319)
```

Hand check, factor by factor (β 15, z 60, x −0.10, r_a0 35, i₀/z₀ 8, f_a 2.5, T 4.5):

| Factor | Value |
|---|---|
| 4.9 m_n | 9.800 |
| z^(0.13875 − 0.542) = 60^(−0.4033) | 0.1918 |
| e^(−0.225) | 0.7985 |
| e^(+0.0015) | 1.0015 |
| (35/2)^(−0.12375 − 0.225) = 17.5^(−0.3488) | 0.3685 |
| 8^(−0.877) | 0.1614 |
| (1.25)^0.511 | 1.1208 |
| (2.25)^0.319 | 1.2952 |
| **product h_max** | **0.130 mm** ✓ |

Typical targets (check tool maker): PM-HSS h_max ≈ 0.15 … 0.25 mm, carbide 0.10 … 0.20 mm. Our 0.130 mm is on the
safe side; the axial feed could be raised. The effect of starts and gashes on time, surface and chip thickness:

```
## Hob starts and gashes: time vs surface (same vc, fa)
  z0 1, 16 gashes: 1.72 min, enveloping flats 0.11 um, h_max 0.071 mm
  z0 2, 16 gashes: 0.86 min, enveloping flats 0.44 um, h_max 0.130 mm
  z0 3, 16 gashes: 0.57 min, enveloping flats 0.99 um, h_max 0.185 mm
  z0 3, 20 gashes: 0.57 min, enveloping flats 0.63 um, h_max 0.152 mm
```

Doubling the starts halves the time but almost doubles the chip thickness (tool wear) and quadruples the enveloping
flats – a 3-start hob with more gashes (20) recovers part of both. This is the standard trade-off of hob design.

### 3.7 Surface of a hobbed flank: feed marks and enveloping flats

A hobbed flank shows two families of marks.

**Feed marks (along the face width).** Each revolution of the gear, the hob – whose cutting edges lie on a cylinder of
diameter d_a0 – has moved by f_a. The flank is a series of circular arcs of radius R = d_a0/2 with chord f_a. The arc
height (sagitta) is s = R − √(R² − (f_a/2)²) ≈ f_a² / (8R) = f_a² / (4 d_a0). Measured normal to the flank (the
flank is inclined by α_n to the radial direction):

  δ_x = f_a² · sin α_n / (4 d_a0)

```python
def feed_mark_depth(fa, da0, alpha_n_deg):
    return fa ** 2 * math.sin(math.radians(alpha_n_deg)) / (4 * da0)
```

Hand check: 2.5² · 0.34202 / (4·70) = 2.1376/280 = **7.63 µm** ✓ (selftest: the approximation agrees with the exact
sagitta within 0.1 %).

```
## Axial feed: time vs feed-mark depth
  fa 1.0 mm/rev: 2.15 min, feed marks 1.22 um
  fa 2.0 mm/rev: 1.07 min, feed marks 4.89 um
  fa 3.0 mm/rev: 0.72 min, feed marks 10.99 um
  fa 4.0 mm/rev: 0.54 min, feed marks 19.54 um
```

The time falls with 1/f_a, the marks grow with f_a². For a gear that is ground afterwards the feed marks must only stay
well inside the stock (100 µm): f_a 4 mm/rev would be acceptable for the surface. For gears used as-hobbed, the feed
marks must be below ~ 1/3 of the flank form tolerance → f_a ≈ 1 … 1.5 mm/rev.

**Enveloping flats (along the profile).** The involute is not cut continuously but as a polygon of flats, one per
hob tooth that passes the profile. The number of cuts per tooth space is about i₀·z/z₀ per revolution of the gear
relative to the profile; the height of each flat is

  δ_y = π² · z₀² · m_n · sin α_n / (4 · z · i₀²)

```python
def envelope_depth(P):
    return math.pi ** 2 * P["hob_z0"] ** 2 * P["mn"] * math.sin(math.radians(P["alpha_n_deg"])) / (4 * P["z"] * P["hob_gashes"] ** 2)
```

Hand check: π²·4·2·0.34202 / (4·60·256) = 27.004 / 61 440 = **0.44 µm** ✓. Enveloping flats are critical only for
small numbers of teeth and multi-start hobs: for z = 12, z₀ = 3, i₀ = 12 they grow to π²·9·2·0.342/(4·12·144) = **8.8 µm** (δ_y ∝ z₀²/(z·i₀²)) – then a 1-start hob is used for finishing.

### 3.8 Approach length and cycle time

The hob enters the blank before the full depth is cut at the first face. Geometrically the hob tip circle (radius
r_a0) cuts a chord into the blank of depth h; the axial distance from first touch to full depth is the half chord:
L_a = √(h·(d_a0 − h)). For a helical gear the hob is swivelled and the path is longer; the program divides by cos β
(approximation, check – the exact value depends on η and the hob length).

The cutting time of one cut: the hob must travel L = b + L_a + overrun; per gear revolution it moves f_a; the gear turns
at n_table = n₀·z₀/z:

  t_h = L / (f_a · n_table) = z · L / (z₀ · n₀ · f_a)

```python
def hob_approach(P, w=None):
    w = w or work_geometry(P)
    h, da0 = w["h"], P["hob_da0"]
    return math.sqrt(h * (da0 - h)) / math.cos(math.radians(P["beta_deg"]))

def hob_time(P, w=None):
    w = w or work_geometry(P)
    s = hob_setup(P, w)
    La = hob_approach(P, w)
    L = P["b"] + La + P["hob_overrun"]
    t = P["hob_cuts"] * P["z"] * L / (P["hob_z0"] * s["n0"] * P["hob_fa"])
    return {"La": La, "L": L, "t_cut_min": t, "t_total_min": t + P["t_aux_min"]}
```

Hand check: L_a = √(4.5 · 65.5) / cos 15° = 17.168 / 0.96593 = **17.8 mm**; L = 28 + 17.8 + 3 = **48.8 mm**;
t_h = 60 · 48.8 / (2 · 682.1 · 2.5) = 2926 / 3410.5 = **0.86 min**; plus 0.5 min load/unload = **1.36 min** ✓.

Note that the approach (17.8 mm) is 64 % of the face width: for narrow gears the approach dominates the time. Ways to
shorten it: smaller hob diameter (but fewer gashes), **radial-axial** infeed (radial plunge first, then axial), or
cutting two blanks stacked on one mandrel (one approach for two gears – common for narrow gears in series).

**One cut or two?** For a module 2 gear one cut is normal. Two cuts (rough + finish) are used for large modules
(m > 4 … 6), for gears used as-hobbed with a fine surface, or with carbide hobs that need a constant chip.

```python
def two_cut_strategy(P, fa_rough=3.5, fa_finish=1.5):
    one = hob_time(P)
    r, f = hob_time(dict(P, hob_fa=fa_rough)), hob_time(dict(P, hob_fa=fa_finish))
    ...
```
```
## 3.6 One cut vs two cuts
  one cut fa 2.5: 0.86 min, feed marks 7.63 um; two cuts 3.5 + 1.5: 2.04 min, feed marks 2.75 um
```

The two-cut strategy costs 2.4 × the time for a finer surface – not worth it for our ground gear.

**Crowning and taper by hobbing.** CNC hobbers can change the centre distance during the axial stroke: a parabolic
radial change Δr(y) gives a flank crowning. A radial change Δr moves the flank normal to itself by Δr·sin α_n, so

  Δr = C_β / sin α_n

```
## 3.7 Crowning by hobbing: radial infeed for flank crowning
  C_beta  5 um -> radial infeed change 14.6 um
  C_beta 10 um -> radial infeed change 29.2 um
  C_beta 15 um -> radial infeed change 43.9 um
```

(`crowning_infeed()`.) Hobbed crowning is used for gears that are not ground (shaved or as-hobbed gears); for ground
gears the crowning is made by the grinding machine (chapter 6).

### 3.9 Tool cost per part

  cost_tool / part = (hob price + n_regrind · regrind cost) / ((n_regrind + 1) · parts per regrind)

```python
def hob_tool_cost_per_part(P):
    life_parts = (P["hob_regrinds"] + 1) * P["hob_parts_per_regrind"]
    return (P["hob_price"] + P["hob_regrinds"] * P["hob_regrind_cost"]) / life_parts
```

Hand check: (2400 + 10·180) / (11·300) = 4200 / 3300 = **1.273 EUR/part** ✓. After each regrind the hob must be
**recoated** (dry hobbing) and the gash spacing and rake face checked; a badly reground hob loses one class of
accuracy. Regrind and recoat are usually done by the tool maker on a service contract.

### 3.10 Typical hobbing defects

| Symptom on the gear | Likely cause | Remedy |
|---|---|---|
| Pitch error repeating every z/z₀ teeth | thread-to-thread error of a multi-start hob | better hob class, 1-start hob for finishing |
| Profile error the same on all teeth | hob profile worn / wrong rack, hob mounted with runout | regrind, check hob runout on the arbor (≤ 5 µm) |
| Helix slope error | differential wrong, face runout of the blank, mandrel tilt | recalculate EGB, clean face, check mandrel |
| Wavy flank in face direction | feed marks too deep, vibration | smaller f_a, more rigid clamping, climb hobbing |
| Torn / rough flank, built-up edge | v_c too low (wet), blunt hob, wrong coating | raise v_c, regrind, AlCrN coating |
| Runout | eccentric clamping, dirty mandrel | expanding mandrel, cleaning |
| Burr at the tooth ends | exit of the hob | chamfering (§ 4.8) |

---

## 4. Shaping, power skiving and other soft methods (milling, broaching, rolling, shaving, chamfering)

### 4.1 Gear shaping

**Principle.** The shaper cutter is a gear with relief-ground cutting edges. It reciprocates along the gear axis
(cutting stroke and return stroke) and at the same time rolls with the blank like a gear pair: n_work / n_cutter =
z₀ / z. During the return stroke the cutter (or the work) is **lifted** so the edges do not rub. Shaping can cut
**internal gears**, gears **close to a shoulder** (the cutter needs only a few mm of overrun), cluster gears and
non-circular profiles – all things a hob cannot do.

**Cutter.** A shaper cutter is a corrected gear with z₀ ≈ 75 mm / m_n teeth (d₀ ≈ 75 … 100 mm); for internal gears
z₀ must be well below z to avoid interference (z − z₀ ≥ 12 … 15, check). For helical gears the cutter is helical and
the machine needs a **helical guide** whose lead equals the cutter lead p_z0 = π·m_n·z₀ / sin β – one guide per helix
angle (mechanical machines) or an electronic helical guide (CNC shapers).

```python
def shaper_cutter(P, d0_target=75.0):
    z0 = max(12, round(d0_target * math.cos(math.radians(P["beta_deg"])) / P["mn"]))
    d0 = P["mn"] * z0 / math.cos(math.radians(P["beta_deg"]))
    out = {"z0": z0, "d0": d0}
    if P["beta_deg"] != 0:
        out["guide_lead"] = math.pi * P["mn"] * z0 / math.sin(math.radians(P["beta_deg"]))
```
```
## 4.1 Shaper cutter
  z0 36, d0 74.54 mm; helical guide lead 873.9 mm
```

Hand check: z₀ = round(75·0.96593 / 2) = round(36.2) = **36**; d₀ = 2·36 / 0.96593 = **74.54 mm**;
guide lead = π·2·36 / 0.258819 = **873.9 mm** ✓.

**Cycle time.** The stroke length is H = b + 2·overrun. With equal cutting and return speeds the number of double
strokes per minute is n_DH = 1000·v_c / (2H). The circumferential feed f_c (mm per double stroke on the reference
circle) sets the rotation: one revolution of the work needs π·d / f_c double strokes. Plus the radial infeed to the
full depth h at f_r per stroke:

  t_h = cuts · π·d / (f_c · n_DH) + h / (f_r · n_DH)

```python
def shaping_time(P, w=None):
    w = w or work_geometry(P)
    H = P["b"] + 2 * P["shp_overrun"]                          # stroke length
    nDH = 1000 * P["shp_vc"] / (2 * H)                         # double strokes per minute (equal cut / return speed, check)
    t_rot = P["shp_cuts"] * math.pi * w["d"] / (P["shp_fc"] * nDH)
    t_in = w["h"] / (P["shp_fr"] * nDH)
    return {"H": H, "nDH": nDH, "t_cut_min": t_rot + t_in, "t_total_min": t_rot + t_in + P["t_aux_min"]}
```
```
- shaping: stroke 34.0 mm, 588 double strokes/min -> 5.31 min total
```

Hand check: H = 28 + 6 = **34 mm**; n_DH = 40 000 / 68 = **588.2 /min**; rotation 2·π·124.233 / (0.30·588.2) =
780.6 / 176.5 = 4.42 min; infeed 4.5 / (0.02·588.2) = 0.38 min; total 4.81 + 0.5 = **5.31 min** ✓ –
**3.9 × the hobbing time**. Shaping is slow because half of every stroke is idle (return) and the cutting speed is
limited by the inertia of the reciprocating spindle (modern machines reach 2 000 … 3 000 double strokes/min for small
gears). It is used where hobbing is impossible.

### 4.2 Run-out space: the design decides the method

A shoulder or a second gear next to the teeth limits the axial space behind the teeth (the "groove"). Each method needs
a minimum space (approximations, check):
- hob: the full approach L_a (the hob is large);
- shaping: overrun 2 … 3 mm plus lift;
- power skiving: ≈ √(h·d₀)·sin Σ + 1 mm (the tool face is tilted by the axis cross angle Σ).

```python
def runout_space(P, groove=6.0):
    w = work_geometry(P)
    La = hob_approach(P, w)
    d0 = P["mn"] * P["skv_z0"] / math.cos(math.radians(P["beta_deg"] - P["skv_Sigma_deg"]))
    skv = math.sqrt(w["h"] * d0) * math.sin(math.radians(P["skv_Sigma_deg"])) + 1.0
    shp = P["shp_overrun"]
    ...
```
```
## 4.2 Run-out space behind the teeth
  groove  4.0 mm: hob needs 17.8, shaping 3.0, skiving 7.3 mm -> fits shaping
  groove  8.0 mm: hob needs 17.8, shaping 3.0, skiving 7.3 mm -> fits shaping, skiving
  groove 20.0 mm: hob needs 17.8, shaping 3.0, skiving 7.3 mm -> fits hobbing, shaping, skiving
```

**Design lesson:** a designer who leaves 20 mm instead of 8 mm behind a pinion allows hobbing (0.86 min) instead of
shaping (4.8 min) – a cost decision made on the drawing, not in the shop. Discuss the groove with manufacturing during
the embodiment design (M1 chapter on design for manufacture).

### 4.3 Power skiving

**Principle.** Power skiving (DIN 8589 "Wälzschälen") is a continuous generating method like hobbing, but the tool is a
cutter like a shaper cutter, and the tool axis is crossed to the work axis by the **axis cross angle Σ** (typically
10 … 30°). Tool and work rotate fast in the gear ratio (n₀ = n_w·z/z₀) and the tool is fed axially. Because the axes are
crossed, the tool teeth **slide along the tooth line** of the work – this sliding is the cutting motion. Power skiving
is 3 … 10 × faster than shaping for internal gears and needs little run-out space; it requires very rigid,
synchronised machines (high-speed EGB, tool and work spindles), which became available only around 2010.

**Velocity triangle.** At the contact point, in the plane tangent to the pitch cylinder, take x along the work axis
and y in the circumferential direction. The work moves with v_w = (0, v_w). The tool axis is crossed by Σ, so the
tool circumferential velocity is v₀ = v₀·(−sin Σ, cos Σ). The tooth line of the work (helix angle β) has the direction
t = (cos β, sin β). Correct meshing requires the relative velocity to lie **along the tooth line** (no velocity
normal to the flank):

  (v₀ cos Σ − v_w) · cos β = −v₀ sin Σ · sin β   →   v₀ = v_w · cos β / cos(β − Σ)

With the tool helix angle β₀ = β − Σ, the magnitude of the relative (cutting) velocity is

  v_c = |v₀ − v_w| = v₀ · sin Σ / cos β = **v_w · sin Σ / cos β₀**

So for a required v_c the work speed is v_w = v_c · cos β₀ / sin Σ – the **smaller Σ, the higher the spindle speeds**.

```python
def skiving(P, w=None):
    w = w or work_geometry(P)
    S = math.radians(P["skv_Sigma_deg"])
    b0 = math.radians(P["beta_deg"]) - S
    vw = P["skv_vc"] * math.cos(b0) / math.sin(S)              # workpiece circumferential speed m/min
    nw = 1000 * vw / (math.pi * w["d"])
    n0 = nw * P["z"] / P["skv_z0"]
    v0 = vw * math.cos(math.radians(P["beta_deg"])) / math.cos(b0)
    t = P["skv_passes"] * (P["b"] / math.cos(math.radians(P["beta_deg"])) + 2.0) / (P["skv_fa"] * nw)
```
```
- skiving: Sigma 20.0 deg, tool helix -5.00 deg, work 1119 rpm, tool 1815 rpm (v_w 437, v_tool 424 m/min) -> 1.88 min total
```

Hand check: β₀ = 15 − 20 = **−5°**; v_w = 150·cos 5° / sin 20° = 150·0.99619 / 0.34202 = **436.9 m/min**;
n_w = 436 900 / (π·124.233) = **1119 rpm**; n₀ = 1119·60/37 = **1815 rpm**; v₀ = 436.9·0.96593/0.99619 =
**423.6 m/min**; time 10 passes · (28/0.96593 + 2) / (0.20·1119.4) = 309.9 / 223.9 = 1.38 min + 0.5 = **1.88 min** ✓.
The selftest of the program checks the velocity triangle with vectors: the relative velocity is parallel to the tooth
line and its length is exactly v_c.

**Choice of Σ.**

```python
def skiving_sigma_study(P, sigmas=(10.0, 15.0, 20.0, 25.0, 30.0)):
    for s in sigmas:
        Q = dict(P, skv_Sigma_deg=s)
        k = skiving(Q) ...
```
```
## 4.3 Skiving: axis cross angle study
  Sigma 10.0: tool helix  +5.00 deg, work  2205 rpm, tool  3575 rpm, 0.70 min, run-out 4.2 mm
  Sigma 15.0: tool helix  +0.00 deg, work  1485 rpm, tool  2408 rpm, 1.04 min, run-out 5.7 mm
  Sigma 20.0: tool helix  -5.00 deg, work  1119 rpm, tool  1815 rpm, 1.38 min, run-out 7.3 mm
  Sigma 25.0: tool helix -10.00 deg, work   896 rpm, tool  1452 rpm, 1.73 min, run-out 8.8 mm
  Sigma 30.0: tool helix -15.00 deg, work   742 rpm, tool  1204 rpm, 2.09 min, run-out 10.3 mm
```

- A small Σ needs very high spindle speeds (here 3 575 rpm on the tool at Σ 10°) – the machine limit and the dynamic
  stiffness decide. The cutting time looks shorter only because the program keeps f_a per work revolution constant.
- A large Σ gives more sliding, a lower speed, but more run-out space and a stronger change of the effective rake and
  clearance angles along the profile (one flank cuts with a negative rake – the main tool-life problem of skiving).
- **Σ = β (here 15°)** gives a **spur tool** (β₀ = 0) – cheap, easy to regrind; it is chosen whenever the run-out
  space allows. For spur internal gears Σ is typically 15 … 25° with a helical tool.

**Tool.** Skiving tools are carbide (solid for small modules, inserted blades for large), coated; the regrinding is on
the face (like a shaper cutter). Many passes (6 … 15) with decreasing depth keep the chip small. Wet or MQL cooling.

**Where skiving wins:** internal gears in volume (planetary ring gears, internal splines of automotive transmissions),
external gears close to a shoulder, and **hard skiving** after heat treatment (chapter 6). Where it loses: external
gears with free run-out – hobbing is simpler, more robust and cheaper per tool.

### 4.4 Gear milling (form milling)

A disk-type form cutter (or an end mill on a 5-axis machine) cuts one tooth space at a time; after each space the work
is indexed by 360°/z. The tool profile is the space profile – a separate cutter per module, number of teeth range and
profile shift (classic "8-cutter set" per module), or a CNC path for 5-axis milling with a standard tool.

```python
def gear_milling_time(P, vc=200.0, fz=0.08, zc=12, dc=63.0, passes=2, index_s=3.0):
    n = 1000 * vc / (math.pi * dc)
    vf = fz * zc * n
    w = work_geometry(P)
    app = math.sqrt(w["h"] * (dc - w["h"]))
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + 2 * app
    t = P["z"] * passes * (L / vf + index_s / 60.0)
```
```
  gear milling (disk mill 63 mm, 12 teeth): n 1011 rpm, vf 970 mm/min, path 61.4 mm -> 13.60 min
```

Hand check: n = 200 000 / (π·63) = 1010.5 rpm; v_f = 0.08·12·1010.5 = 970 mm/min; approach √(4.5·58.5) = 16.2 mm;
L = 28.99 + 32.45 = 61.4 mm; t = 60·2·(61.4/970 + 0.05) = 120·0.1133 = **13.6 min** – 16 × the hob. Gear milling is for
**single parts, repairs, large modules (m > 10)** and prototypes on 5-axis machining centres (no special machine, no
hob delivery time of 6 … 10 weeks).

### 4.5 Broaching

A broach is a long tool with rows of teeth that grow step by step to the final space form; one stroke cuts all teeth
of an internal gear or spline. Extremely productive and accurate in volume production (automotive internal splines,
ring gears of planetary sets), but the broach costs 10 000 … 50 000 EUR and fits one gear only.

```
  broaching internal gear (broach 900 mm): 0.24 min per part
```

(`broaching_time()`: (L_broach + stroke) / v_cut + return = 1.1 m / 6 m/min + 1.1 m / 20 m/min = 0.183 + 0.055 =
0.24 min.) Helical internal gears need a rotating broach head.

### 4.6 Cold rolling

The teeth are formed plastically by rolling dies (two or three dies, or racks) without chips. Fibre flow follows the
contour, the surface is work-hardened and compressive – excellent fatigue strength – and the cycle is seconds. Limited
to small modules (m ≲ 2 … 3), ductile steels and very high volumes (splines, small pinions, worms). Often followed by
heat treatment and honing.

### 4.7 Gear shaving (soft finishing before heat treatment)

Shaving improves a hobbed or shaped gear from grade 8 … 9 to grade 6 … 7 *before* heat treatment, and gives crowning and
profile modifications – without grinding after hardening. The shaving cutter is a helical gear with serrations on the
flanks (the cutting edges), meshing with the work at a **crossed-axis angle of 10 … 15°**; the crossed axes produce
sliding along the tooth (the cutting motion) like a crossed helical gear pair. Methods: conventional (axial traverse),
diagonal, underpass, plunge (the fastest, cutter as wide as the gear).

```python
def shaving_data(P, cross_deg=12.0):
    z = P["z"]
    zc = [k for k in range(67, 90) if math.gcd(k, z) == 1][0]
    return {"cross_deg": cross_deg, "allow_per_flank": 0.02 + 0.01 * P["mn"], "cutter_z": zc, "t_min": 0.5,
            "grade_in": 8, "grade_out": 6}
```
```
  shaving: cross angle 12 deg, allowance 0.040 mm per flank, cutter z 67 (no common factor with 60), 0.5 min, grade 8 -> 6
```

**Rules:** the shaving allowance is small (0.02 + 0.01 m_n per flank, check); the pre-shave hob must have a protuberance
for the shaving cutter too; the number of cutter teeth must have **no common factor** with z (here 67 and 60) so every
cutter tooth meets every work tooth ("hunting") and errors average out. Shaving gives grade 6 … 7 soft – but heat
treatment distortion then adds 1 … 2 grades. The shaving process is therefore *corrected* for the expected distortion
(e.g. a pre-distorted helix angle), which needs a stable heat-treatment process. Shaving + case hardening is still the
cheapest chain for automotive gears of grade 7 … 8 (no hard finishing); for grade 6 and better, grinding or honing
after hardening is needed (chapter 6).

### 4.8 Chamfering and deburring

The hob leaves a **primary burr** at the tooth ends. A burr must be removed: it hardens in carburising, breaks off in
service and damages bearings and flanks; a sharp tooth edge also over-carburises (too much carbon in the corner →
brittle) and chips.

```
## 4.5 Chamfering methods
  chamfer rolling (press)                        | plastic deformation of the tooth edge  | secondary burr on face + flank bulge | 8-15 s  | cheap; bulge must be removed by a 2nd hob cut or shaving
  chamfer cutting (ChamferCut-type form cutter)  | cutting with a form cutter in mesh     | very small                           | 5-15 s  | integrated in the hobbing machine
  deburring brush / file                         | removes primary burr only              | edge not defined                     | 5 s     | no defined chamfer
  end mill along the edge (5-axis)               | CNC path along the tooth edge          | none                                 | 1-3 min | prototypes, large gears
```

(`CHAMFER_METHODS`.) Typical chamfer: 0.1 … 0.2 m_n × 30 … 45° on both tooth ends, specified on the drawing. Modern
hobbing machines chamfer by cutting during the next part's hobbing (no extra time).

### 4.9 Method choice

```
## 4.6 Method choice
  external, free run-out, any volume                   -> hobbing
  external, shoulder close (groove < hob approach)     -> shaping or power skiving
  internal gear, small / medium batch                  -> shaping
  internal gear, large batch, rigid machine            -> power skiving
  internal spline / gear, very high volume             -> broaching
  single / prototype, large module, 5-axis available   -> gear milling
  very high volume, small module, ductile steel        -> cold rolling
  internal False groove None volume None   -> hobbing
  internal False groove 8.0  volume 4000   -> power skiving
  internal False groove 8.0  volume 500    -> shaping
  internal True  groove None volume 500    -> shaping
  internal True  groove None volume 20000  -> power skiving
  internal True  groove None volume 100000 -> broaching (or skiving)
```

(`METHOD_CHOICE`, `choose_soft_method(P, internal, groove, volume)` – a first rule set, check against your machine park.)
Our wheel (external, free run-out, 4 000 / year) → **hobbing**. If the same gear had a shoulder 8 mm behind the teeth,
power skiving would be chosen at 4 000 / year, shaping for a 500-part batch (the skiving tool and set-up do not pay).

### 4.10 Functions of chapters 2–4

| Function / table | Purpose |
|---|---|
| `BLANK_ROUTES` | blank manufacturing routes |
| `it_grade_um()` | ISO 286 standard tolerance IT5 … IT11 |
| `blank_tolerances()` | bore, datum face, tip tolerances from the flank grade |
| `blank_error_effect()` | eccentric / tilted clamping → F_r and helix slope |
| `HOB_CLASSES`, `hob_class_for_grade()` | DIN 3968 hob class for the soft grade |
| `hob_basic_rack()` | pre-grinding hob rack, protuberance, tip chamfer |
| `hob_shift_plan()` | active zone, shift per part |
| `HOB_CUTTING_DATA`, `cutting_data_study()` | cutting data and times per tool / coating |
| `differential_rotation()` | helical additional rotation, EGB table speed |
| `two_cut_strategy()` | one cut vs rough + finish |
| `crowning_infeed()` | radial infeed for hobbed crowning |
| `shaper_cutter()` | shaper cutter teeth, diameter, helical guide lead |
| `runout_space()` | run-out space needed by hob / shaper / skiving tool |
| `skiving_sigma_study()` | effect of the axis cross angle |
| `shaving_data()` | shaving allowance, cutter teeth (hunting) |
| `gear_milling_time()`, `broaching_time()` | other soft methods |
| `CHAMFER_METHODS`, `METHOD_CHOICE`, `choose_soft_method()` | chamfering, method selection |


---

## 5. Heat treatment (carburising, quenching, distortion, nitriding, induction) and its inspection

Soft machining (chapters 3–4) gives the gear its shape. Heat treatment gives it its **strength**: a hard, wear- and
pitting-resistant surface (58–62 HRC) on a tough core (30–45 HRC) that carries the bending load at the root. The load
capacity values of M5 (σ_Hlim 1500 MPa, σ_Flim 500 MPa for 18CrNiMo7-6 case hardened) are only true when the heat
treatment reaches the right **case depth, surface hardness, core hardness and microstructure**. Heat treatment also
**distorts** the gear – that is why it decides the grinding stock and therefore the cost of hard finishing (chapter 6).

| Process | Surface hardness | Typical depth | Distortion | Finish after | Use |
|---|---|---|---|---|---|
| Case hardening (carburise + quench + temper) | 58–62 HRC | 0.15–0.20·m_n (CHD 550 HV) | high | grinding / honing | highest capacity, gearboxes of all sizes |
| Gas / plasma nitriding | 600–900 HV | 0.2–0.6 mm (NHD) | very low | usually none | medium load, low distortion, large thin gears |
| Induction hardening (contour or tooth-by-tooth) | 52–58 HRC | 1–4 mm | medium | grinding for large gears | large gears, m_n > 6, local hardening |
| Through hardening (QT) + hobbing hard | 28–40 HRC | whole section | none (before cutting) | none | low cost, low capacity, large wheels |

This chapter uses the core functions `chd_plan()`, `harris_total_case()`, `carburising_time()`, `nitriding_time()`,
`induction_depth()` of `gearmfg.py` and the chapter add-on (output: `python gearmfg.py ch56`).

### 5.1 Case-hardening steels and core hardness

A case-hardened gear needs **two** hardness values: the case (from carbon) and the core (from the alloy). The case
hardness depends almost only on the surface carbon content. The **core** hardness depends on how fast the middle of the
tooth cools during quenching and on the **hardenability** of the steel – the alloy elements Cr, Mn, Ni, Mo delay the
transformation to soft ferrite/pearlite so that martensite and bainite also form in slowly cooling sections.

Hardenability is measured with the **Jominy end-quench test** (EN ISO 642): a 25 mm bar is heated and water-sprayed on one
end; the hardness is measured along the bar. Every point of a real part cools like some point of the Jominy bar – the
**Jominy-equivalent distance J**. A tooth of a small module cools fast (small J), a big tooth slowly (large J).

Rule used in the program (rough, ask the heat treater for measured values – **check**):

  J ≈ 1.5 + 0.9·m_n  [mm]  (oil quench, middle of the tooth at the root);  gas quench (LPC, 10–20 bar): J × 1.3

```python
def jominy_equivalent(mn, quench="oil"):
    j = 1.5 + 0.9 * mn
    return j * (1.3 if quench == "gas" else 1.0)

def core_hardness(steel, mn, quench="oil"):
    J = CASE_STEELS[steel]["J"]
    x = jominy_equivalent(mn, quench)
    ...                                   # linear interpolation in the Jominy curve
```

The Jominy curves (`CASE_STEELS`, mean of the H band, **check** EN ISO 683-3) are:

| Steel | C % | J 1.5 | J 5 | J 9 | J 15 | J 25 mm | Typical use |
|---|---|---|---|---|---|---|---|
| 16MnCr5 | 0.16 | 41 | 36 | 29 | 24 | 21 HRC | small / medium gears, m_n ≤ 4 |
| 20MnCr5 | 0.20 | 45 | 42 | 36 | 31 | 28 | medium gears, m_n ≤ 6, vehicle gearboxes |
| 20NiCrMo2-2 | 0.20 | 44 | 38 | 29 | 24 | 22 | small gears, good toughness |
| 18CrNiMo7-6 | 0.18 | 44 | 43 | 41 | 38 | 36 | large / heavy-duty gears, m_n up to ~20 |

`python gearmfg.py ch56`:
```
## 5.1 Core hardness HRC at the tooth root vs module (oil quench, core min 30 HRC)
  mn  2 (J  3.3 mm): 16MnCr5 39, 20MnCr5 44, 20NiCrMo2-2 41, 18CrNiMo7-6 44
  mn  4 (J  5.1 mm): 16MnCr5 36, 20MnCr5 42, 20NiCrMo2-2 38, 18CrNiMo7-6 43
  mn  6 (J  6.9 mm): 16MnCr5 32, 20MnCr5 39, 20NiCrMo2-2 33, 18CrNiMo7-6 42
  mn 10 (J 10.5 mm): 16MnCr5 28!, 20MnCr5 34, 20NiCrMo2-2 28!, 18CrNiMo7-6 40
  mn 16 (J 15.9 mm): 16MnCr5 24!, 20MnCr5 31, 20NiCrMo2-2 24!, 18CrNiMo7-6 38
  gas quench mn 6: 16MnCr5 29, 20MnCr5 36, 20NiCrMo2-2 29, 18CrNiMo7-6 41
```
("!" = below 30 HRC.)

**Hand check** (16MnCr5, m_n 6): J = 1.5 + 0.9·6 = 6.9 mm, between 5 mm (36 HRC) and 7 mm (32 HRC):
36 + (6.9 − 5)/(7 − 5)·(32 − 36) = 36 − 3.8 = **32.2 HRC** ✓ (program 32).

**What the table teaches**
- ISO 6336-5 quality MQ asks for a core hardness of about **≥ 30 HRC** at the root (25 HRC for ML) – a weak core lets
  the case crack under the bending load ("case crushing") and lowers σ_Flim.
- 16MnCr5 and 20NiCrMo2-2 are fine up to m_n ≈ 6; above that only 20MnCr5 (just) and **18CrNiMo7-6** keep the core.
  This is why large industrial gears are almost always 18CrNiMo7-6 (or 17NiCrMo6-4) – the Ni + Mo is bought for the core.
- **Gas quenching** (low-pressure carburising + high-pressure gas) cools more slowly than oil: at m_n 6, 16MnCr5 drops from
  32 to 29 HRC. LPC + gas quench therefore needs a steel with more hardenability – the price of its lower distortion.
- Too **high** a core hardness (> 45 HRC) is also bad: low toughness, more distortion, more retained stresses.
- Hardenability varies from heat to heat inside the H band (±4–5 HRC). Narrow-band steels ("HH", "HL" or a customer
  band of 6–7 HRC) give a stable distortion – an important purchase specification for series gears.

### 5.2 Carburising – the physics of the case

#### 5.2.1 What happens

The gear is heated to 900–980 °C (austenite, which dissolves up to ~1.2 % carbon) in an atmosphere with a **carbon
potential** C_p higher than the steel's carbon (0.16–0.20 %). Carbon atoms enter the surface and **diffuse** inward.
After quenching, the high-carbon surface becomes hard martensite; the low-carbon core becomes low-carbon martensite /
bainite (tough). Hardness follows carbon: about **0.35 % C gives 550 HV** – the definition of the effective case
depth **CHD** (case hardening depth, ISO 2639 / ISO 18203: distance from the surface to the point with 550 HV).

| Atmosphere | How | Pros | Cons |
|---|---|---|---|
| Endogas + natural gas (sealed quench furnace) | CO / H2 atmosphere, C_p controlled with an oxygen probe | proven, cheap, continuous lines | intergranular oxidation (IGO) 10–20 µm, oil quench distortion |
| Low-pressure carburising (LPC, vacuum) | acetylene pulses at a few mbar | no IGO, clean, higher T possible (960–1050 °C), gas quench | invest, needs more hardenable steel, sharp edges over-carburise |

#### 5.2.2 Diffusion law (Fick) and its solution

Carbon flux is proportional to the carbon gradient (Fick's 1st law); conservation gives the diffusion equation (2nd law):

  ∂C/∂t = D · ∂²C/∂x²

For a **constant surface carbon** C_s, a uniform start carbon C_0 and a deep part, the solution is

  C(x, t) = C_s − (C_s − C_0) · erf( x / (2·√(D·t)) )

The diffusion coefficient of carbon in austenite rises steeply with temperature (Arrhenius law):

  D = D_0 · exp(−Q / (R·T)),  D_0 ≈ 0.23 cm²/s, Q ≈ 148 kJ/mol (typical, **check** – D also rises with carbon content)

```python
def D_carbon(T_C):
    return 0.23 * math.exp(-148000.0 / (R_GAS * (T_C + 273.15))) * 100.0      # mm^2/s

def carbon_erf(x_mm, t_h, T_C, Cs, C0):
    D = D_carbon(T_C)
    return Cs - (Cs - C0) * math.erf(x_mm / (2.0 * math.sqrt(D * t_h * 3600.0)))

def time_for_carbon_depth(depth_mm, Cx, T_C, Cs, C0):
    u = (Cs - Cx) / (Cs - C0)
    ...                                    # erfinv(u) by bisection -> lo
    return (depth_mm / (2 * lo)) ** 2 / D_carbon(T_C) / 3600.0
```

The inversion follows directly: at depth x the carbon is C_x when erf(x/(2√(Dt))) = (C_s − C_x)/(C_s − C_0) = u, so

  t = ( x / (2·erf⁻¹(u)) )² / D

**Parabolic law.** For a fixed carbon level the argument x/(2√(Dt)) is constant, so **x ∝ √t**: 4 × the time gives
2 × the case. The **Harris formula** used in the core is exactly this parabolic law with the temperature dependence
written as 10^(−3720/T):

  d_total = 802.6·√t / 10^(3720/T)  [mm, t in h, T in K]   (`harris_total_case()`)

Harris gives the **total** case depth (to about core carbon). The core program converts it to the effective depth with a
fixed ratio (`case_ratio` 0.6, **check**).

`python gearmfg.py ch56`:
```
## 5.2 Carbon diffusion
  T 900 C: D 5.913e-06 mm^2/s
  T 930 C: D 8.632e-06 mm^2/s
  T 960 C: D 1.237e-05 mm^2/s
  T 980 C: D 1.558e-05 mm^2/s
  erf, Cs 0.80, C0 0.18, 930 C: time for 0.35 %C at 0.450 mm = 2.73 h; check depth 0.4500 mm
  Harris (core): 1.33 h for total case 0.750 mm
```

**Hand check D(930 °C):** T = 1203.15 K; Q/(RT) = 148 000/(8.314·1203.15) = 14.796; e^−14.796 = 3.753·10⁻⁷;
D = 0.23·3.753·10⁻⁷ = 8.63·10⁻⁸ cm²/s = **8.63·10⁻⁶ mm²/s** ✓.

**Hand check erf time** (target green CHD 0.450 mm from `chd_plan()`): u = (0.80 − 0.35)/(0.80 − 0.18) = 0.7258;
erf⁻¹(0.7258) ≈ 0.773 (erf 0.77 = 0.7238, erf 0.775 = 0.7270); t = (0.45/(2·0.773))²/8.632·10⁻⁶ = 0.08470/8.632·10⁻⁶
= 9 813 s = **2.73 h** ✓.

**Hand check Harris:** 10^(3720/1203.15) = 10^3.092 = 1236; k = 802.6/1236 = 0.649 mm/√h; total case 0.450/0.6 = 0.75 mm
→ t = (0.75/0.649)² = **1.33 h** ✓.

**Why the two results differ (important for planning).** With a constant surface carbon of 0.80 % the case grows slowly –
2.73 h. The core's Harris value (1.33 h) assumes "effective = 0.6 × total case", which fits a **boost** cycle with a high
carbon potential, not a constant 0.80 %. The truth lies in between and depends on the furnace cycle → section 5.2.3.
Use Harris only for a first estimate; the heat treater's cycle program (or a carbon-diffusion simulation) decides.

**Temperature effect:** from 930 to 960 °C D rises by 43 %, so the same case needs 1/1.43 = 70 % of the time. LPC plants
use 960–1050 °C for this reason – but grain growth (fine-grain steels with Al/Nb are needed) and distortion rise.

#### 5.2.3 Boost–diffuse cycle

A constant 0.80 % surface carbon is slow. Real furnaces **boost** first with a high carbon potential (1.0–1.2 %, just below
soot / carbide formation) to push carbon in fast, then **diffuse** with a lower potential (0.7–0.8 %) so that the
surface carbon falls back to the target (too much carbon → retained austenite and carbides). The add-on solves the
diffusion equation numerically (explicit finite differences, stable for D·Δt/Δx² ≤ 0.5):

  C_i(new) = C_i + D·Δt/Δx² · (C_{i+1} − 2C_i + C_{i−1}),  surface C_0 = C_boost, then C_diff

```python
def boost_diffuse(T_C=930.0, C0=0.18, C_boost=1.10, C_diff=0.75, t_boost_h=1.0, t_diff_h=0.6, L=3.0, n=150):
    D = D_carbon(T_C)
    dx = L / n
    dt = 0.4 * dx * dx / D
    ...
    while t < t_end:
        C[0] = C_boost if t < t_boost_h * 3600.0 else C_diff
        for i in range(1, n):
            new[i] = C[i] + D * dt / dx ** 2 * (C[i + 1] - 2 * C[i] + C[i - 1])
        ...

def boost_for_chd(chd_mm, T_C=930.0, diff_ratio=0.6, **kw):   # bisection on the boost time
```

The surface is held at the gas potential (a simplification – real carbon transfer has a finite mass-transfer coefficient
β, so the real surface carbon lags the potential; **check**).

`python gearmfg.py ch56`:
```
  boost 0.5 h @1.10 + diffuse 0.5 h @0.75: surface C 0.723, CHD(0.35 %C) 0.310 mm, total 1.0 h
  boost 0.6 h @1.10 + diffuse 0.6 h @0.75: surface C 0.725, CHD(0.35 %C) 0.340 mm, total 1.2 h
  boost 0.8 h @1.10 + diffuse 0.6 h @0.75: surface C 0.729, CHD(0.35 %C) 0.375 mm, total 1.4 h
  boost 1.0 h @1.10 + diffuse 0.8 h @0.75: surface C 0.731, CHD(0.35 %C) 0.423 mm, total 1.8 h
  for CHD 0.450 mm at 930 C: boost 1.23 h + diffuse 0.74 h = 1.96 h, surface C 0.734
  for CHD 0.450 mm at 960 C: boost 0.86 h + diffuse 0.51 h = 1.37 h, surface C 0.734
```

So the green CHD 0.45 mm of the example wheel needs about **2.0 h at 930 °C** with boost–diffuse (2.73 h at constant
0.80 %, 1.33 h by Harris + ratio 0.6). Add heating (1–1.5 h for a full load), the drop to 840–860 °C before quenching
(to lower distortion and retained austenite), quench and temper: a full batch cycle is typically **6–10 h** for small
gears and up to **30–60 h** for CHD 3–4 mm on large gears (time ∝ CHD²).

**Hardness traverse.** Converting carbon to hardness with a typical martensite curve (`HV_OF_C`, tempered 160–180 °C,
the drop above 0.8 % C is retained austenite – **check**):

```
  hardness traverse (boost 0.6 + diffuse 0.6 h):
    x 0.1 mm: C 0.626 %, 750 HV
    x 0.2 mm: C 0.502 %, 681 HV
    x 0.3 mm: C 0.389 %, 589 HV
    x 0.4 mm: C 0.299 %, 529 HV
    x 0.5 mm: C 0.239 %, 493 HV
    x 0.6 mm: C 0.205 %, 473 HV
    x 0.7 mm: C 0.190 %, 460 HV
    x 0.8 mm: C 0.183 %, 453 HV
```
550 HV is crossed between 0.3 and 0.4 mm – the CHD of this short cycle is 0.34 mm (line above). This is the curve the lab
measures on a sectioned test piece (section 5.6).

#### 5.2.4 Target case depth – where the CHD comes from

`chd_plan()` (core) takes the rule CHD = 0.15–0.20·m_n (from `gear.chd_recommendation`) for the **finished** flank and
adds the grinding stock, because flank grinding removes case:

```python
def chd_plan(P):
    r = gear.chd_recommendation(P["mn"])
    chd_final = P["CHD_target"] or 0.5 * (r["CHD_min"] + r["CHD_max"])
    chd_green = chd_final + P["stock_per_flank"]
```
Report (`python gearmfg.py run`):
```
- CHD rule 0.30-0.40 mm; final 0.350 mm + stock 0.10 -> green CHD 0.450 mm (root keeps 0.450)
- carburising at 930 C: 1.33 h to total case 0.750 mm (Harris, ratio 0.60, check); span-size stock 0.200 mm
```

Physical reasons for the optimum depth:
- **Too thin:** the maximum shear stress under the Hertzian contact lies at ~0.78·b_H below the surface (b_H half contact
  width); if the case ends there, subsurface fatigue ("case crushing", flank breakage) starts at the case–core boundary.
  ISO 6336-5 gives an optimum CHD from the contact stress and the relative radius of curvature.
- **Too thick:** the root case becomes brittle through the whole root section, compressive residual stresses at the
  surface shrink, toughness falls, cycle time rises with CHD². σ_Flim drops.
- **Root vs flank:** the root is not ground, so it keeps the full green CHD (0.45 mm) – good for bending.

**Span-size stock.** The grinding stock of 0.10 mm per flank (normal) appears in the span measurement W_k as
2·s = 2·0.10 = **0.200 mm**, because W_k is measured along the base tangent, i.e. normal to both flanks – no cos α_n
factor (that factor appears only for a stock given in the transverse or tangential direction). The "green" W_k is made
0.200 mm larger than the finished W_k (plus the expected heat-treatment growth, section 5.4).

### 5.3 Quenching, retained austenite, intergranular oxidation, tempering

**Quench.** From 840–860 °C the gear is quenched in oil (60–120 °C, agitated), salt or high-pressure gas (N2 / He,
10–20 bar). The case transforms to martensite at the Ms temperature of the high-carbon layer (~150–200 °C) – **after** the
core (Ms ~400 °C). The late expansion of the case against the already hard core creates the **compressive residual
stresses** in the surface (−150 … −350 MPa) that raise the bending and pitting strength.

| Quench | Distortion | Hardness / core | Remarks |
|---|---|---|---|
| Oil, free (basket) | highest | good | cheap, scatter of distortion from part position in the load |
| Oil, **press quench** (fixture) | low, controlled | good | for thin wheels, ring gears, bevel gears; one part at a time |
| Gas (LPC, 10–20 bar) | lowest, most uniform | lower core (5.1) | clean parts, no washing, needs hardenable steel |

**Retained austenite (RA).** Above ~0.8 % C the Mf temperature drops below room temperature – part of the austenite does
not transform. A little RA (10–25 %) is acceptable or even helps rolling contact; much RA lowers hardness, reduces the
compressive stress and **grows** later (dimensional instability). Remedies: lower surface carbon (diffuse step), lower
quench temperature, sub-zero treatment (−80 °C) for precision gears.

**Intergranular oxidation (IGO).** In endogas the oxygen oxidises Cr, Mn, Si along the grain boundaries in the first
10–20 µm; the depleted zone does not harden (non-martensitic "HTTP" layer). IGO lowers σ_Flim at an unground root by
10–20 %. LPC has **no IGO**; with gas carburising the root can be shot peened (6.6) to compensate.

**Tempering.** 150–200 °C for 1–2 h relieves quench stresses, makes the martensite tougher, and costs only 1–2 HRC.
Time and temperature can be traded with the **Hollomon–Jaffe parameter**:

  P = T·(C + log₁₀ t),  T in K, t in h, C ≈ 20

```python
def hollomon_jaffe(T_C, t_h, Cc=20.0):
    return (T_C + 273.15) * (Cc + math.log10(t_h))

def equivalent_tempering_time(T1_C, t1_h, T2_C, Cc=20.0):
    P = hollomon_jaffe(T1_C, t1_h, Cc)
    return 10 ** (P / (T2_C + 273.15) - Cc)
```
```
## 5.3 Tempering
  P(180 C, 2 h) = 9199; same P at 160 C needs 17.3 h, at 200 C 0.28 h
```
**Hand check:** P = 453.15·(20 + log 2) = 453.15·20.301 = 9 199; at 160 °C: t = 10^(9199/433.15 − 20) = 10^1.238 = 17.3 h ✓.
The lesson: **20 °C** of tempering temperature equals a factor of ~8 in time – a furnace that is 20 °C too hot over-tempers.
The same parameter warns about **grinding burn** (6.3): a few seconds at 300–400 °C in the surface layer give the same P
as hours at 180 °C – the surface is re-tempered (soft).

### 5.4 Distortion and grinding stock

Every carburised gear changes shape: phase transformations change volume (martensite is ~1 % larger than austenite),
non-uniform cooling creates plastic strains, and stresses from machining are released. Typical effects on a wheel:

| Effect | Typical direction | Consequence |
|---|---|---|
| Size change | tip diameter and W_k grow +0.01 … +0.03 % | span measurement before HT set smaller / allowance |
| Bore shrinkage / ovality | bore shrinks 0.02–0.05 %, becomes oval | bore ground after HT, or press quench |
| Radial runout F_r | increases (eccentric growth, warping) | uneven stock on left / right flanks |
| Helix change f_Hβ | "unwinding" of the helix, thin webs dish | helix angle correction in the soft cut |
| Profile slope f_Hα | profile tilts, tip relief changes | profile correction in the soft cut / stock |

Good practice is **distortion compensation**: measure 5–10 parts after HT, find the mean change of helix and profile, and
cut the soft gear with the opposite correction (pre-correction of the hob / grinding is then only for the scatter).

The add-on estimates distortion with rule-of-thumb coefficients (**check** with your own measurements) and the stock needed
so that every flank cleans up:

```python
QUENCH_FACTOR = {"oil free": 1.0, "oil press quench": 0.7, "gas LPC": 0.6}

def distortion_estimate(P, quench="oil free"):
    w = work_geometry(P)
    k = QUENCH_FACTOR[quench]
    return {"Fr_um": k * (0.10 * w["d"] + 8), "fHb_um": k * (0.25 * P["b"] + 3), "fHa_um": k * (1.5 * P["mn"] + 3), ...}

def stock_needed(P, quench="oil free", cleanup_um=20.0):
    ecc = dd["Fr_um"] / 2 * math.sin(an)
    need = ecc + 0.5 * dd["fHb_um"] + 0.5 * dd["fHa_um"] + cleanup_um
```

**Why e·sin α_n.** A radial runout F_r means the tooth system is eccentric by e = F_r/2. Moving a tooth radially by e moves
its flank in the normal direction by e·sin α_n. The grinder centres the gear on its bore (or on the teeth – see stock
sharing), so one flank sees +e·sin α_n more, the other less. Helix and profile deviations take half their amount out of
the mean stock. A clean-up layer (~20 µm) removes the decarburised / oxidised skin and the hobbing marks.

`python gearmfg.py ch56`:
```
## 5.4 Distortion and grinding stock (wheel z 60, d 124.2)
  oil free          Fr 20.4, fHb 10.0, fHa 6.0, bore -13.0 um -> stock needed  31.5 um/flank
  oil press quench  Fr 14.3, fHb  7.0, fHa 4.2, bore - 9.1 um -> stock needed  28.0 um/flank
  gas LPC           Fr 12.3, fHb  6.0, fHa 3.6, bore - 7.8 um -> stock needed  26.9 um/flank
  stock sharing L 140 / R 60 um: rotate 40 um -> 100 um each
  case after grinding, worst flank: green 0.450 - removed 0.035 = 0.415 mm (rule min 0.30)
```

**Hand check (oil free):** F_r = 0.10·124.2 + 8 = 20.4 µm; e·sin α_n = 10.2·0.342 = 3.49 µm; need = 3.49 + 10.0/2 + 6.0/2
+ 20 = **31.5 µm** ✓.

**Reading the result.** The model asks for ~30 µm per flank; the program default `stock_per_flank` is 100 µm. Shops use
**0.05–0.15 mm per flank** for m_n 2–6 because real distortion scatter (part position in the basket, steel heat, furnace
load) is 2–4 times the mean, and because the soft gear itself has hobbing errors (grade 8–9). Every 10 µm of stock costs
grinding time (6.1) and case depth. A good strategy: **measure** the distortion of the first batches, then reduce the stock
step by step (statistical stock: mean + 3σ + clean-up).

**Stock sharing.** If after hardening the left flanks carry 140 µm and the right flanks 60 µm (measured by the grinding
machine's probe in a few gaps), the machine rotates the workpiece by (140 − 60)/2 = 40 µm (on the pitch circle, normal
direction) so that both flanks get 100 µm. Without sharing, the right flank would only be cleaned up partly, or the left
flank would lose 140 µm of case.

```python
def stock_sharing(left_um, right_um):
    mean = (left_um + right_um) / 2
    return {"shift_um": (left_um - right_um) / 2, "each_um": mean}
```

**Case depth after grinding.** The worst flank loses nominal stock + eccentric share: 0.450 − (0.0315 + 0.0035) = **0.415 mm**,
still above the rule minimum 0.30 mm. If the stock were 0.15 mm and the runout large, the case could fall below the
minimum – the reason why the green CHD is always specified **with** the planned stock.

### 5.5 Nitriding and induction hardening

#### 5.5.1 Nitriding

Nitrogen diffuses into the ferrite at 480–570 °C (below the transformation temperature – **no** quench, **very low
distortion**). Nitride-forming elements (Cr, Mo, V, Al) build fine nitrides → hard layer (600–900 HV). Above the diffusion
zone a thin **compound ("white") layer** of iron nitrides forms (ε / γ′); it is hard but brittle and is kept thin
(< 10 µm) or removed for gears.

Depth follows the same parabolic law: NHD = k·√t (`nitriding_time()` in the core, k ≈ 0.045–0.055 mm/√h, **check**).

```python
NITRIDING = {
    "gas nitriding 31CrMoV9":    {"k": 0.050, "T": 520, "surface_HV": 800, "white_k": 0.0015},
    "plasma nitriding 31CrMoV9": {"k": 0.045, "T": 500, "surface_HV": 800, "white_k": 0.0006},
    "gas nitriding 42CrMo4 QT":  {"k": 0.055, "T": 520, "surface_HV": 600, "white_k": 0.0015},
}
```
```
## 5.5 Nitriding (0.40 mm) and induction
  gas nitriding 31CrMoV9         64 h, white layer 12.0 um, surface 800 HV
  plasma nitriding 31CrMoV9      79 h, white layer  5.3 um, surface 800 HV
  gas nitriding 42CrMo4 QT       53 h, white layer 10.9 um, surface 600 HV
```
**Hand check:** t = (0.40/0.050)² = **64 h**; white layer 1.5 µm/√h · 8 = **12 µm** ✓.

Practical meaning:
- Long cycles (50–100 h) but large loads and **no grinding** → economical for thin, large or complex gears (ring gears,
  internal gears, gears with integral shafts that would distort in carburising).
- Case depth is small (0.3–0.6 mm): the Hertzian subsurface shear must stay in the layer → nitrided gears suit
  **moderate** contact stress (σ_Hlim ~1000–1250 MPa) and small to medium modules. Shock loads can crack the thin case.
- **Plasma nitriding** controls the white layer (thinner) and allows masking; **nitrocarburising** (570 °C, few hours)
  gives a thin layer for wear only.
- Soft machining is done in the **quenched and tempered** state (QT, ~30 HRC) – the core hardness comes from the QT.

#### 5.5.2 Induction hardening

An alternating current in a copper inductor induces eddy currents in the surface; they heat only a thin layer which is then
spray-quenched. The heated depth follows the **electrical reference depth** (skin effect):

  δ = 503·√(ρ / (μ_r·f))  [m]  (ρ resistivity Ωm, μ_r = 1 above the Curie point ~770 °C)

so a higher frequency heats a thinner layer. The core function and its inverse:

```python
def induction_depth(f_Hz, rho=1.2e-6, mu_r=1.0):          # core
    return 503.0 * math.sqrt(rho / (mu_r * f_Hz)) * 1000.0

def freq_for_depth(depth_mm, rho=1.2e-6):                   # add-on: f = rho (503/delta)^2
    d = depth_mm / 1000.0
    return rho * (503.0 / d) ** 2
```
Core examples (`python gearmfg.py examples`):
```
## Induction reference depth vs frequency (hot steel)
  f      3 kHz: 10.06 mm
  f     10 kHz: 5.51 mm
  f     30 kHz: 3.18 mm
  f    100 kHz: 1.74 mm
  f    300 kHz: 1.01 mm
```
**Contour hardening** follows the tooth outline (flank and root). It is done with **dual frequency**: a medium frequency
pre-heats the tooth base/root (deep), a high frequency then heats the flanks/tip briefly. Rule used (**check** with the
inductor maker): case ≈ 0.25·m_n, high frequency so that δ ≈ 2 × case (short heating time keeps the case at ~½ δ),
pre-heat frequency ≈ 1/10:

```
  mn  2: case 0.50 mm -> high f 304 kHz, pre-heat 30 kHz (delta 1.00 mm)
  mn  4: case 1.00 mm -> high f 76 kHz, pre-heat 8 kHz (delta 2.00 mm)
  mn  6: case 1.50 mm -> high f 34 kHz, pre-heat 3 kHz (delta 3.00 mm)
  mn 10: case 2.50 mm -> high f 12 kHz, pre-heat 1 kHz (delta 5.00 mm)
```
**Hand check (m_n 2):** δ = 1.0 mm → f = 1.2·10⁻⁶·(503/0.001)² = 1.2·10⁻⁶·2.53·10¹¹ = **304 kHz** ✓.

Practice: small gears are hardened in one shot (spin hardening, 0.1–2 s, power density several kW/cm²); large gears
(m_n > 10) **tooth by tooth** with a gap inductor that travels along the gap and hardens the root and two half flanks
(scanning). Steels: 42CrMo4, 34CrNiMo6, C45 (0.35–0.55 % C – the carbon is already in the steel). Risks: root not hardened
(scanning with flank-only inductors leaves the root soft → low σ_Flim), tip over-heating and cracks, tempering of the
neighbour tooth in tooth-by-tooth hardening.

#### 5.5.3 Through-hardened (QT) gears

The cheapest route for large, moderately loaded wheels: the blank is quenched and tempered to 28–40 HRC **before** cutting,
then hobbed (sometimes shaved) in the hard state. No distortion, no grinding, but σ_Hlim only ~600–850 MPa – the gear must
be 1.5–2 times larger than a case-hardened one for the same torque (M5, `material_study()` of gear.py).

### 5.6 Heat-treatment inspection

| Check | Method | Typical requirement (case hardened, ISO 6336-5 MQ – check) |
|---|---|---|
| Surface hardness | HRC / HV10 on the flank or a test piece | 58–62 HRC (660–750 HV) |
| Case depth CHD | hardness traverse HV1 on a sectioned test piece or a sacrificed gear, at the flank (mid-height) and root | in the drawing range, e.g. 0.30–0.50 mm finished |
| Core hardness | HV10 / HRC at the tooth centre at root level (30° tangent point line) | ≥ 30 HRC (MQ), ≤ 45 HRC |
| Microstructure | metallography: martensite needle size, RA %, carbides, IGO depth, no bainite / ferrite in the case | RA ≤ 25 %, IGO ≤ 12 µm (MQ, unground root) |
| Surface carbon | spectrometer on a shim, or derived from the traverse | 0.65–0.90 % |
| Cracks | magnetic particle inspection (MPI) | none |
| Distortion | gear measuring machine, bore gauge, W_k | within stock / compensation |

**Test pieces** ("witness coupons") of the same steel heat and a size similar to the tooth are carried in every load –
cutting a real gear is expensive. Their result is only valid if they cool like the tooth (equivalent section).
For series production the heat treater documents furnace curves (T, C_p, quench oil temperature, agitation) per load –
traceability back to each gear (see the MES chapters of the twin).

---

## 6. Hard finishing (generating grinding, profile grinding, honing, hard skiving, superfinishing, shot peening)

After heat treatment the gear has grade 8–10 (distortion) and a rough, partly decarburised surface. **Hard finishing**
removes the stock (section 5.4) and gives the final grade (ISO 1328 grade 3–6), the flank modifications (tip relief,
crowning, topological corrections from M5), and the surface (Ra 0.2–0.5 µm, or < 0.1 µm superfinished). It is the most
expensive step per part of the chain (chapter 7) – so the choice of process and the stock decide the cost.

### 6.1 Continuous generating grinding (threaded wheel)

**Principle.** The grinding wheel is a large **worm** (1–7 starts) of vitrified corundum or ceramic grain (sometimes CBN),
dia. 200–400 mm, turning at 45–80 m/s. It meshes with the workpiece like a hob: the work table turns in a fixed ratio
n_w = n_s·z_0/z (electronic gearbox), and the wheel is fed axially across the face width. Because many teeth are in
mesh at the same time and the motion is continuous, this is the **fastest** hard finishing method for series gears
(m_n 0.5–10, d up to ~800 mm).

**Time.** Exactly like hobbing (chapter 3): per pass the axial path L = b/cos β + La is covered with the axial feed f_a
per workpiece revolution:

  t = z·L / (z_0·n_s·f_a),  n_s = v_s·60000/(π·d_s)

```python
def gen_grinding_time(P):
    ns = P["grd_vs"] * 60000.0 / (math.pi * P["grd_ds"])
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + P["grd_La"]
    tr = P["z"] * L / (P["grd_z0"] * ns * P["grd_fa_rough"])
    tf = P["z"] * L / (P["grd_z0"] * ns * P["grd_fa_finish"])
    return {..., "t_cut_min": tr + tf, "t_total_min": tr + tf + P["t_aux_min"]}
```
Report (`python gearmfg.py run`):
```
- generating grinding: wheel 275 mm at 63 m/s -> 4375 rpm, 3 starts; rough 0.45 + finish 1.19 = 2.13 min total
```
**Hand check:** n_s = 63·60 000/(π·275) = 3 780 000/863.9 = 4 375 rpm; L = 28/cos 15° + 10 = 28.99 + 10 = 38.99 mm;
t_rough = 60·38.99/(3·4375·0.40) = 2339/5250 = 0.445 min; t_finish = 2339/(3·4375·0.15) = 1.188 min;
total 0.445 + 1.188 + 0.5 (load/measure) = **2.13 min** ✓.

The finish pass dominates (small feed for the surface and the grade). Starts: more starts z_0 = faster but a larger
wheel lead angle, coarser generating flats and lower accuracy – 1–2 starts for grade 3–4, 3–5 starts for series grade 5–6.

**Dressing.** The worm profile wears; it is re-dressed with a **diamond profile roll** (both flanks in one stroke, the roll
carries the exact profile incl. tip relief) after N parts. Dressing time, wheel life and cost per part:

```python
def gen_grinding_with_dressing(P, parts_per_dress=25, t_dress_min=1.5, dress_depth_mm=0.03, ds_min=200.0):
    g = gen_grinding_time(P)
    share = t_dress_min / parts_per_dress
    dressings = (P["grd_ds"] - ds_min) / (2 * dress_depth_mm)
    return {..., "t_cycle": g["t_total_min"] + share, "parts_per_wheel": dressings * parts_per_dress}
```
```
## 6.1 Generating grinding with dressing
  grind 2.13 + dressing share 0.060 = 2.19 min; 1250 dressings, 31250 parts per wheel
```
**Hand check:** dressings = (275 − 200)/(2·0.03) = **1250**; parts = 1250·25 = 31 250; share 1.5/25 = 0.06 min ✓.
Values (parts per dressing, dressing depth, minimum wheel diameter) are **check** values – they depend on the stock,
module and wheel spec. Important: the wheel diameter falls with each dressing, so n_s must rise to keep v_s (CNC does it),
and the wheel lead angle changes slightly (compensated by the swivel angle).

**Flank modifications and twist.** Profile modifications (tip / root relief, profile crowning) are in the **dressing roll**
or in a CNC-dressed profile. Lead crowning (C_β) is made by changing the **centre distance** while the wheel travels
across the face. For a **helical** gear the contact line between wheel and workpiece is inclined, so a centre-distance
change at one face position changes the profile at different heights differently: the flank gets an unwanted
**twist** (the profile slope differs between the two faces). Approximation (**check** with the machine maker's twist
calculation):

  S_twist ≈ 4·C_β·L_α·tan β_b / b

with L_α the roll length of the active profile.

```python
def flank_twist(P, C_beta_um=10.0):
    w = work_geometry(P)
    rb, ra = w["db"] / 2, w["da"] / 2
    rf = (w["df"] + 0.5 * P["mn"]) / 2
    La = math.sqrt(ra ** 2 - rb ** 2) - math.sqrt(max(rf ** 2 - rb ** 2, 0.0))
    bb = math.atan(math.tan(math.radians(P["beta_deg"])) * math.cos(w["at"]))
    return {"L_alpha": La, "beta_b_deg": math.degrees(bb), "twist_um": 4 * C_beta_um * La * math.tan(bb) / P["b"]}
```
```
  C_beta  5 um: L_alpha 12.05 mm, beta_b 14.08 deg -> twist 2.2 um
  C_beta 10 um: L_alpha 12.05 mm, beta_b 14.08 deg -> twist 4.3 um
  C_beta 15 um: L_alpha 12.05 mm, beta_b 14.08 deg -> twist 6.5 um
```
**Hand check:** α_t = atan(tan 20°/cos 15°) = 20.65°; d_b = 124.23·cos 20.65° = 116.25 mm; r_b 58.13, r_a 63.92,
start of active profile ≈ (118.83 + 1.0)/2 = 59.92 mm; L_α = √(63.92² − 58.13²) − √(59.92² − 58.13²) = 26.59 − 14.54 =
12.05 mm; β_b = atan(tan 15°·cos 20.65°) = 14.08°; twist = 4·10·12.05·0.2507/28 = **4.3 µm** ✓.

4 µm is about half of the profile slope tolerance f_Hα of grade 6 (8.2 µm, core report). Modern machines compensate twist
("twist-free" or "topological" grinding: diagonal shifting of a wheel whose profile changes along its width, or
CNC-coupled axis motions), and can also produce a **deliberate** twist or any topological modification computed by the
loaded tooth contact analysis (M5 ch. 6).

**Diagonal shifting.** To use the whole wheel width evenly and to improve the surface, the wheel is shifted tangentially
during the axial feed. With a worm that has a varying profile along its width the same motion creates topological
modifications.

### 6.2 Profile (form) grinding

**Principle.** A disc wheel with the exact **gap profile** (both flanks, or one flank) grinds one gap at a time, moving
along the face (with helical motion for helical gears); then the gear indexes to the next gap. The wheel profile is
CNC-dressed from a diamond disc, so **any** profile and lead modification is possible, and internal gears and large
gears (d up to 4 m+) can be ground. It is slower for small modules and many teeth (each gap separately), but very
accurate (grade 2–4) and flexible – the process of choice for large single gears, prototypes, internal gears and
gears with collision contours.

**Time.** Per gap and pass the wheel travels L = b/cos β + 2·overrun at the table feed v_f, plus indexing time:

  t = z·n_passes·(L/v_f + t_index)

```python
def prof_grinding_time(P):
    L = P["b"] / math.cos(math.radians(P["beta_deg"])) + 2 * P["pgr_overrun"]
    t_gap = L / P["pgr_vf"] * 60 + P["pgr_index_s"]
    t = P["z"] * P["pgr_passes"] * t_gap / 60.0
    Qw = P["pgr_ae"] * P["pgr_vf"] / 60.0
```
```
- profile grinding: 2.78 s per gap and pass, 4 passes, Q'w 2.50 mm3/(mm s) -> 11.62 min total
```
**Hand check:** L = 28.99 + 10 = 38.99 mm; t_gap = 38.99/3000·60 + 2 = 0.78 + 2 = 2.78 s; t = 60·4·2.78/60 = 11.12 min
+ 0.5 = **11.62 min** ✓ – 5.3 × the generating grinding time for this small-module wheel. The indexing time (2 s) is
72 % of each gap time: for small gears the "non-cutting" time dominates.

**Specific material removal rate and grinding burn.** The heat generated in the contact zone is proportional to the
removal rate per mm of wheel contact:

  Q'_w = a_e · v_f  [mm³/(mm·s)]  (a_e depth of cut per pass, v_f feed in mm/s)

If Q'_w is too high the surface temperature exceeds the tempering temperature (5.3, Hollomon–Jaffe): **tempering burn**
(soft zone, 50–100 HV lower, tensile residual stress) or even **re-hardening burn** (> A_c1: fresh untempered martensite
over a soft zone – very brittle). Burned flanks look fine but pit and crack early. CBN wheels conduct heat away much
better than corundum and allow 3–5 × higher Q'_w (`QW_LIMIT`, typical, **check**).

```python
QW_LIMIT = {"corundum (vitrified)": 3.0, "CBN (vitrified)": 12.0}

def prof_grinding_options(P, stock_mm=None, vf=None):
    for passes in (2, 3, 4, 6, 8):
        ae = stock / passes
        Q = dict(P, pgr_passes=passes, pgr_ae=ae, pgr_vf=vf or P["pgr_vf"])
        pg = prof_grinding_time(Q)
```
```
## 6.2 Profile grinding: passes vs time vs burn (stock 0.10 mm)
  2 passes, ae 0.050:  6.06 min, Q'w  2.50 -> corundum ok  CBN ok
  3 passes, ae 0.033:  8.84 min, Q'w  1.67 -> corundum ok  CBN ok
  4 passes, ae 0.025: 11.62 min, Q'w  1.25 -> corundum ok  CBN ok
  6 passes, ae 0.017: 17.18 min, Q'w  0.83 -> corundum ok  CBN ok
  8 passes, ae 0.013: 22.74 min, Q'w  0.62 -> corundum ok  CBN ok
  same stock at vf 9000 mm/min:
  2 passes, ae 0.050:  5.02 min, Q'w  7.50 -> corundum BURN CBN ok
  3 passes, ae 0.033:  7.28 min, Q'w  5.00 -> corundum BURN CBN ok
  4 passes, ae 0.025:  9.54 min, Q'w  3.75 -> corundum BURN CBN ok
  default (4 passes, ae 0.05): Q'w 2.50 <= 3.0 ok; vf max 3600 mm/min
```
**Hand check:** 2 passes at 9000 mm/min: Q'_w = 0.050·9000/60 = **7.5** > 3.0 (corundum) → burn ✓; CBN limit 12 → ok.

**What the table teaches**
- Fewer, deeper passes save time only until Q'_w reaches the limit. At 3000 mm/min indexing dominates; tripling the feed
  saves only 17 % of the time (6.06 → 5.02 min) but makes corundum burn. **CBN** lets the feed go up.
- The practical pass strategy: 1–3 **roughing** passes with large a_e (stock removal), 1 **finishing** pass with small
  a_e (0.01–0.02 mm) and low feed for grade and surface, sometimes a spark-out pass.
- Note: the core default `pgr_ae` (0.05 mm) times 4 passes is 0.20 mm, more than the 0.10 mm stock – the default is a
  conservative removal-rate example, not a consistent pass plan (see report at the end).

**Burn inspection** (ISO 14104 "nital etch", or Barkhausen noise):
- **Nital etch:** the gear is etched in dilute nitric acid; burned zones appear darker (tempered) or white-bright
  (re-hardened). Destructive for the surface finish – done on samples or as a 100 % check with re-polishing; acid
  handling regulations apply.
- **Barkhausen noise (BN):** a magnetic sensor measures the noise of domain-wall jumps, which rises with tensile stress
  and lower hardness. Non-destructive, automatic, 100 % in line; calibrated with nital-etched references.
- **Process monitoring:** spindle power / acoustic emission during grinding catch burn before it happens.

### 6.3 Honing (power honing)

A honing tool is an **internal gear** (or external for internal gears) of bonded abrasive that meshes with the workpiece at
a **crossed axis angle** (5–15°). The relative sliding along the teeth (like a helical gear pair with crossed axes) and
the controlled radial infeed remove 20–60 µm per flank at low speed (cutting speed 0.5–10 m/s). Results:
- surface with **crossed, curved grooves** (not parallel to the contact lines like ground surfaces) → **lower noise**,
  better oil film; Ra 0.1–0.3 µm;
- low surface temperature → **no burn**, compressive residual stress;
- corrects pitch and runout well, profile and lead within limits; grade 5–7.

Time model (removal rate per flank, **check**):

```python
def honing_time(stock_um, removal_um_per_s=0.8, t_aux_s=20.0):
    return (stock_um / removal_um_per_s + t_aux_s) / 60.0
```
```
## 6.3 Honing, shot peening
  honing stock 20 um: 0.75 min
  honing stock 40 um: 1.17 min
  honing stock 60 um: 1.58 min
```
**Hand check:** 40 µm: (40/0.8 + 20)/60 = 70/60 = **1.17 min** ✓.

Honing **alone** can only remove small stock – so it fits **low-distortion** heat treatment (LPC + gas quench, press
quench) where the stock can be ≤ 0.05 mm (the core `chain_options()` blocks honing-only chains with the default 0.10 mm
stock, chapter 7). Typical automotive chain: hob → (shave) → carburise → **hone**; high-end: grind → hone (noise).

### 6.4 Hard skiving and hard hobbing

**Hard skiving:** power skiving (chapter 3) with carbide or CBN-tipped tools on the **hardened** gear, removing 0.05–0.15 mm.
Very attractive for **internal gears** (ring gears of planetary sets), which are hard to grind: cycle times of ~1 min,
grade 5–7. Tool cost is high and the tool must be very stiff (vibration).
**Hard hobbing / skive hobbing:** carbide hobs with negative rake on gears up to ~62 HRC – used for large gears with
moderate accuracy (grade 6–8) as a cheaper alternative to grinding, or as pre-finishing to reduce the grinding stock.

### 6.5 Superfinishing and polishing

For lowest noise (electric vehicles), micropitting resistance and best efficiency, the ground surface (Ra 0.3–0.5 µm) is
further smoothed:
- **Vibratory chemically accelerated finishing (isotropic superfinishing):** a chemical forms a soft conversion layer on
  the peaks; ceramic media in a vibratory bowl wipe it off. Ra < 0.1 µm, removes ~1–2 µm, does not change the geometry.
- **Polish grinding:** the last pass of generating grinding with a polishing zone (elastic bond) on the same wheel.
- **Effects:** higher micropitting safety (thicker relative film, λ = h_min/Ra rises), lower friction, less run-in wear.
  Values from tests: micropitting load capacity up by one or more FZG load stages (**check**).

### 6.6 Shot peening of the root

Small hard steel or ceramic shots (0.2–0.8 mm) blasted at the root create plastic deformation in the surface layer →
**compressive residual stress** of −600 … −1000 MPa (case hardened), depth ~0.1–0.3 mm. Fatigue cracks need tension
to grow, so the root bending strength rises by **10–20 %** (up to 30 % with double peening, **check**), and the effect
of IGO (5.3) is cancelled.

Controls: **Almen intensity** (deflection of a standard strip, e.g. 0.35–0.50 mmA) and **coverage**. Coverage follows
C = 1 − exp(−k·t) (Avrami form): the time for 98 % is measured, then "200 %" means twice that time.

```python
def peening_coverage_time(cov=0.98, t_full_s=60.0):
    k = -math.log(1 - 0.98) / t_full_s
    return -math.log(1 - cov) / k

def peening_gain(sFlim=500.0, gain=0.15):
    return sFlim * (1 + gain)
```
```
  peening coverage 98 % in 60 s -> 200 % needs 120 s (as 2 x 98 % runs); sigma_Flim 500 -> 575 MPa
```
**Order of operations:** peen **after** grinding if the flanks are not ground in the root area (roots are usually not
ground) – or peen the whole tooth before grinding and grind only the flanks. Peening ground flanks roughens them
(Ra up) – flanks are masked or superfinished afterwards. For the M5 wheel a σ_Flim of 575 MPa raises S_F in proportion
(`gear.py`): useful when the root, not the flank, limits a design.

### 6.7 Choice of the hard finishing process

```
## 6.4 Choice of the hard finishing process
  generating grinding  | series mn 1-8, d < 600                     | grade 3-6 | short cycle, needs dressing; twist with crowning
  profile grinding     | large / single gears, internal             | grade 2-5 | slow for small mn, any modification, burn risk
  power honing         | series after grinding or with small HT stock | grade 5-7 | low-noise surface, small stock
  hard skiving         | internal gears, ring gears                 | grade 5-7 | fast, tool cost high
  superfinishing       | aerospace, EV gears                        | Ra < 0.1  | low noise, micropitting resistance
  shot peening         | highly loaded roots                        | -         | +10-20 % root strength, after grinding or before
```

Decision steps for a real gear:
1. **Grade and modifications needed** (from M5: K_V, K_Hβ, noise) → grade ≤ 5 or topological modifications → grinding.
2. **Batch size and gear size** → series + small/medium gear → generating grinding; single / large / internal → profile
   grinding (or hard skiving for internal).
3. **Heat-treatment distortion (stock)** → ≤ 0.05 mm per flank (LPC, press quench) → honing alone may be enough.
4. **Noise target** → add honing or superfinishing; avoid regular grinding patterns (diagonal shifting, randomised
   dressing).
5. **Root strength** → shot peening; **micropitting** → superfinishing.
6. **Cost** → `chain_options()` (chapter 7) with your machine-hour rates.

### 6.8 Summary for the example wheel (m_n 2, z 60, b 28, case hardened, grade 6)

| Step | Result | Function |
|---|---|---|
| Steel | 16MnCr5 / 20MnCr5 are enough at m_n 2 (core 39–44 HRC); 18CrNiMo7-6 only needed for m_n > 6 | `core_hardness()` |
| Case | finished CHD 0.35 mm, green 0.45 mm; ~2.0 h boost–diffuse at 930 °C (1.4 h at 960 °C) | `chd_plan()`, `boost_for_chd()` |
| Distortion / stock | model need ~30 µm/flank; planned 100 µm; worst-flank CHD 0.415 mm ≥ 0.30 | `stock_needed()`, `case_loss_check()` |
| Finishing | generating grinding 2.19 min incl. dressing (5.3 × faster than profile grinding 11.6 min); twist 4.3 µm at C_β 10 µm – compensate | `gen_grinding_with_dressing()`, `flank_twist()` |
| Burn | corundum profile grinding OK up to v_f 3600 mm/min at a_e 0.05 | `burn_check()` |
| Option | LPC + gas quench → stock ≤ 0.05 → hob → carburise → hone (chapter 7 cost) | `honing_time()` |


---

## 7. Inspection, quality control and production planning (ISO 1328, measuring machines, roll tests, size control, SPC, machines, lot size, cost vs volume)

Chapters 3–6 made the gear: soft cutting, heat treatment and hard finishing. This chapter covers two questions:

- **Is the gear right?** Answered by inspection and quality control: what is measured, with which instrument, against which tolerance, how often, and how to read the result back to a cause in the process.
- **Can we make it at the right cost and in time?** Answered by production planning: number of machines, bottleneck, lot size, cost per part against annual volume, heat-treat furnace and lead time.

Both questions are answered with the same program. The add-on functions of this chapter are called with
`python gearmfg.py ch78`.

### 7.0 Program map of chapters 7–8

| Section | Physics / method | Function |
|---|---|---|
| 7.1 | ISO 1328-1 tolerances for several grades, double-flank tolerances | `tolerance_grades()`, `roll_test_tolerances()` |
| 7.2 | Deviation → cause → remedy | `DEVIATION_CAUSES` |
| 7.3 | Span W_k and dimension over balls M_d after grinding and in the green state | `size_control()` (uses `gear.span_measurement`, `gear.over_pins`) |
| 7.4 | Measurement uncertainty vs tolerance, acceptance limit | `gauge_capability()` |
| 7.5 | Process capability C_p / C_pk, X-bar / R control chart | `span_samples()`, `cp_cpk()`, `xbar_r_limits()` |
| 7.6 | Machines, bottleneck, hunting tooth ratio, economic lot size | `machines_needed()`, `hunting_check()`, `economic_lot()` |
| 7.7 | Cost per part vs annual volume, break-even | `SPECIAL_TOOLS`, `chain_cost_vs_volume()`, `break_even_volume()` |
| 7.8 | Heat-treat furnace loads, lead time of a lot | `furnace_plan()`, `lead_time()` |
| 8.2 | Integral pinion shaft: tool run-out in front of a shoulder, shaft mass, worked example | `tool_shoulder_clearance()`, `shaft_mass()`, `EXAMPLE_PINION`, `pinion_example()` |
| 8.3 | Inspection plan | `INSPECTION_PLAN` |

All outputs in this chapter come from `python gearmfg.py ch78` (default wheel z 60 of the M5 reducer, `gearmfg.DEFAULT`)
unless another command is named.

---

### 7.1 The ISO 1328-1 tolerance system

#### 7.1.1 What is toleranced

A gear flank is a surface. ISO 1328-1:2013 does not tolerance the surface as a whole. It splits the error of the flank
into **three directions**, each with a few parameters:

| Direction | Parameter | Meaning | Main effect in the gearbox |
|---|---|---|---|
| Around the gear (pitch) | f_p – single pitch deviation | Error of the distance from one tooth to the next | Excitation once per tooth, noise |
| | F_p – total cumulative pitch deviation | Largest sum of pitch errors over the whole gear | Transmission error once per revolution, vibration |
| Along the profile (tip ↔ root) | F_α – total profile deviation | Width of the band that holds the measured profile | Noise, load concentration at tip / root |
| | f_Hα – profile slope deviation | Pressure angle too large / small | Contact moves to tip or root |
| | f_fα – profile form deviation | Waviness of the profile | Noise (tonal) |
| Along the face (helix) | F_β – total helix deviation | Band that holds the measured helix | Face load factor K_Hβ (M5) |
| | f_Hβ – helix slope deviation | Helix angle too large / small | Load at one end of the face |
| | f_fβ – helix form deviation | Waviness along the face | Noise |
| Radial | F_r – runout | Radial position of the tooth gaps vs the datum axis | Once-per-revolution error, backlash change |

The **grade** (accuracy class) A = 1 … 11 sets all limits at once. The step from one grade to the next is the factor
√2 ≈ 1.41: grade 7 tolerances are 1.41 × grade 6, grade 5 tolerances are 0.71 × grade 6. Grade 5 is the base grade of the
formulas.

The tolerances depend on module m_n, reference diameter d and face width b. In ISO 1328-1:2013 (as coded in M5, `gear.py`):

$$f_{pT} = (0.001\,d + 0.4\,m_n + 5)\,\sqrt{2}^{\,A-5}\qquad
F_{pT} = (0.002\,d + 0.55\sqrt{d} + 0.7\,m_n + 12)\,\sqrt{2}^{\,A-5}\quad[\mu m]$$

F_αT, F_βT are approximations in the style of the 2013 formulas and F_rT ≈ 0.9 F_pT (see the M5 code comment – check the
standard before use).

```python
def iso1328_2013(mn, d, b, A):                     # gear.py (M5)
    k = math.sqrt(2) ** (A - 5)
    fpt = (0.001 * d + 0.4 * mn + 5) * k
    Fp = (0.002 * d + 0.55 * math.sqrt(d) + 0.7 * mn + 12) * k
    Fa = (0.55 * math.sqrt(mn) + 5) * k * 1.0 + 0.0          # approximation
    Fb = (0.07 * math.sqrt(d) + 0.45 * math.sqrt(b) + 4) * k   # approximation
    return {"fpT": fpt, "FpT": Fp, "FalphaT": Fa, "FbetaT": Fb, "FrT": 0.9 * Fp}

def tolerance_grades(P=None, grades=(4, 5, 6, 7, 8, 9)):     # add-on chapter 7
    P = P or DEFAULT
    w = work_geometry(P)
    return [dict(grade=A, **gear.iso1328_2013(P["mn"], w["d"], P["b"], A)) for A in grades]
```

#### 7.1.2 Double-flank (radial composite) tolerances

In the **double-flank roll test** the gear is rolled against a master gear. A spring presses the two together, so both
flanks are in contact at all times (no backlash). The instrument records the change of the centre distance during one
revolution:

- **F_i''** (total radial composite deviation) is the largest change of the centre distance over a full turn. It
  contains runout, pitch errors and profile errors together.
- **f_i''** (tooth-to-tooth radial composite deviation) is the largest change over one tooth pitch (1/z of a turn).

ISO 1328-2:1997 gave (grade 5 base, step √2):

$$F_i'' = (3.2\,m_n + 1.01\sqrt{d} + 6.4)\,\sqrt{2}^{\,A-5}\qquad f_i'' = (2.96\,m_n + 0.01\sqrt{d} + 0.8)\,\sqrt{2}^{\,A-5}\quad[\mu m]$$

The 2020 edition of ISO 1328-2 uses its own grade system (R30 … R50). The formulas here belong to the 1997 edition, which
many drawings still quote. Check which edition your drawing names.

```python
def roll_test_tolerances(mn, d, A):
    k = math.sqrt(2) ** (A - 5)
    return {"Fi2": (3.2 * mn + 1.01 * math.sqrt(d) + 6.4) * k, "fi2": (2.96 * mn + 0.01 * math.sqrt(d) + 0.8) * k}
```

`python gearmfg.py ch78`:
```
## 7.1 ISO 1328-1 tolerances of the default wheel (d 124.233, mn 2.0, b 28) [um]
  grade   f_pT   F_pT  F_aT  F_bT  F_rT   F_i''  f_i''
      4    4.2   14.0   4.1   5.1  12.6    17.0    4.8
      5    5.9   19.8   5.8   7.2  17.8    24.1    6.8
      6    8.4   28.0   8.2  10.1  25.2    34.0    9.7
      7   11.8   39.6  11.6  14.3  35.6    48.1   13.7
      8   16.8   55.9  16.3  20.3  50.3    68.0   19.3
      9   23.7   79.1  23.1  28.6  71.2    96.2   27.3
```

**Hand check, grade 6:**
- f_pT = (0.001·124.233 + 0.4·2 + 5)·√2 = 5.924·1.4142 = **8.38 µm**. The program gives 8.4.
- F_i'' = (3.2·2 + 1.01·√124.233 + 6.4)·√2 = (6.4 + 11.257 + 6.4)·1.4142 = **34.0 µm**. The program gives 34.0.

**What the grades mean in practice (typical, check with your customer):**

| Grade | Typical use | Typical last process (from `PROCESS_QUALITY`) |
|---|---|---|
| 2–4 | Master gears, measuring gears, aerospace | Profile grinding, special care |
| 4–5 | Turbo gears, high-speed, low-noise automotive | Generating or profile grinding |
| 5–6 | Industrial ground reducers (like M5, grade 6) | Generating grinding |
| 6–7 | Honed automotive transmission gears, skived internal gears | Honing, hard skiving, power skiving |
| 7–9 | Hobbed / shaped general machinery, not hardened or nitrided after cutting | Hobbing, shaping |
| 9–11 | Agricultural, slow open gearing | Hobbing, casting |

An important practical point: the tolerance of the **pitch** (F_p) is about three times the tolerance of the **profile**
(F_α). Most noise problems come from profile and helix (tooth-mesh frequency). Most "once per revolution" vibrations and
backlash changes come from F_p and F_r, which in turn mostly come from **clamping and datum errors**, not from the cutting
tool.

#### 7.1.3 Evaluation ranges

A tolerance only means something together with the **range** where it is evaluated:
- **Profile:** the evaluation range L_α runs from the start of active profile (SAP, root side) to about 95 % of the
  active profile towards the tip. The tip corner and the tip relief are excluded, or evaluated against the designed
  profile (a "K-chart" with the modification drawn as the nominal).
- **Helix:** the evaluation range L_β is the face width minus 5 % or one module at each end, whichever is smaller.
  End relief or crowning is the nominal.

Write the designed modifications (tip relief C_a, crowning C_β, see M5 §6) on the drawing as **nominal profile / helix
shape with a tolerance band**. If you do not, a correctly modified gear "fails" inspection.

---

### 7.2 How gears are measured – and how to read a result back to the process

#### 7.2.1 The gear measuring machine (GMM)

A gear measuring machine (Klingelnberg, Gleason, Wenzel, Mahr and others) is a 4-axis machine: a rotary table (C) that
turns the gear between centres, and a 3-axis probe (X, Y, Z). It measures **generatively**, i.e. it reproduces the
geometry of the involute instead of scanning the flank point by point:

- **Profile:** the probe is placed on the base tangent and moved along the tangent (Y), while the table turns. An
  involute is the path of a point on a line that rolls on the base circle, so for a perfect involute the probe tip must
  move y = r_b·φ when the gear turns by φ. Every difference between the measured and this movement is the profile
  deviation. It is plotted magnified about 500 to 2000 times as the **profile chart**.
- **Helix:** the probe moves along the axis (Z) while the table turns by Δφ = Δz·tan β / r. The difference is the helix
  chart.
- **Pitch:** the probe touches the same flank point on every tooth, left and right flank. The differences of the
  angular positions give f_p and F_p.
- **Runout:** a ball probe in every gap (radial). F_r is the range of the radial positions.

Standard practice: profile and helix on **4 teeth at 90°**, both flanks; pitch and runout on all teeth. The datum is the
**functional axis** (bearing seats or bore), not the machine centres. If the shaft is measured between centres, the
centres must be true to the bearing seats. Measure in an air-conditioned room at 20 °C (ISO 1). A 2 m steel shaft grows
23 µm per 1 K.

The machine itself is calibrated with artefacts (involute master, helix master, pitch master) in the style of
**ISO 18653** and VDI/VDE 2612/2613. The result is the measurement uncertainty U, see 7.4.

**Reading a profile chart (left flank, root left, tip right):**

| Chart picture | Name | Likely cause | Remedy |
|---|---|---|---|
| Straight line, inclined | f_Hα (slope) | Pressure angle of hob / dresser wrong, wrong swivel | Correct the dresser angle or the profile-slope correction value on the grinder |
| Straight, both flanks inclined the same way | Base-circle error | Wrong base pitch of the tool | Correct the tool |
| Waves at a regular spacing | f_fα (form) | Hob gashes (enveloping flats, §3), dressing pattern | More gashes, finer dressing |
| Drop at the tip larger than designed | Tip relief too large | Dresser worn, wrong modification | Re-dress, correct the program |
| Hollow in the middle | Profile too concave | Gen. grinding: wrong worm shift strategy | Use the machine's profile-twist / modification options |

#### 7.2.2 Deviation → cause → remedy

The program holds the table that connects each deviation to its typical manufacturing cause. Use it as the first step of
a root-cause analysis (the second step is always: measure the machine, the tool and the clamping).

```python
DEVIATION_CAUSES = [   # deviation, what it is, typical manufacturing cause, remedy
    ("f_p / F_p (pitch)", "single / cumulative error of tooth spacing", "table / index error, hob runout, workpiece clamping eccentric, z and z0 with common factor",
     "true-running clamping, hunting tooth ratio, check table drive"),
    ("F_r (runout)", ...), ("f_Halpha (profile slope)", ...), ("f_falpha (profile form)", ...),
    ("f_Hbeta (helix slope)", ...), ("f_fbeta (helix form)", ...), ("growth / distortion", ...),
]
```

`python gearmfg.py ch78`:
```
## 7.2 Deviation -> cause -> remedy
  f_p / F_p (pitch)          | single / cumulative error of tooth spacing | table / index error, hob runout, workpiece clamping eccentric, z and z0 with common factor | true-running clamping, hunting tooth ratio, check table drive
  F_r (runout)               | radial position of the tooth gaps vs the datum axis | blank bore / centre not concentric to the hob path, mandrel runout, heat-treat distortion | machine on the functional datum, grind the bore and the teeth in one clamping
  f_Halpha (profile slope)   | pressure angle too large / small | hob or grinding-worm pressure angle error, dressing roll wear, wrong swivel angle | correct the dresser / regrind hob, profile slope correction on the machine
  f_falpha (profile form)    | waviness / form of the involute | hob gash spacing, enveloping flats, hob tooth wear, grinding-wheel dressing | more gashes, sharp hob, dress more often
  f_Hbeta (helix slope)      | helix angle too large / small | machine axis alignment, differential setting, heat-treat helix 'unwinding' | correct the helix on the grinding machine (lead correction), compensate distortion in the soft stage
  f_fbeta (helix form)       | waviness along the face | axial feed marks, machine vibration, clamping deflection | lower feed, rigid clamping, finishing cut
  growth / distortion        | change of size and form in heat treatment | carburising + quench: bore shrinks, helix and profile change, tooth thickness grows | measure the shift on first parts, pre-correct the soft geometry, press quench for thin wheels
```

Three cases from real production show how the table is used:

1. **Helix "unwinding" after case hardening.** A helical wheel is measured soft with f_Hβ ≈ 0 and after hardening with
   f_Hβ = −12 µm on all teeth (the helix angle became smaller). This is the typical carburising distortion of helical
   gears: the tooth "unwinds". If the wheel is ground afterwards, the grinder removes it, but the stock must be large
   enough on the side that comes out thick. If the wheel is not ground (nitrided or honed gears), the soft helix is
   **pre-corrected** by +12 µm on the hobbing machine. The value is found on 5 to 10 trial parts per load position and
   is only stable when the steel heat (hardenability band), the load pattern in the furnace and the quench stay the same.
2. **F_p = 2 × tolerance, f_p in tolerance.** The single pitches are good, but they add up to a once-per-revolution
   sine wave. This is an eccentricity: the gear was cut on a mandrel with runout, or the bore was turned in a separate
   clamping from the hob datum. Remedy: clamp on the functional datum, and grind bore and face in one clamping before the
   teeth are ground (or grind teeth with the bore as datum).
3. **The same two pitch errors repeat every second tooth.** The wheel has z = 60 and the hob has z0 = 2 starts. Each hob
   thread cuts only every second gap, so a pitch error between the two threads of the hob shows on alternate teeth. Use
   a hunting ratio (z and z0 without a common factor), see 7.6.3.

#### 7.2.3 Single-flank and double-flank roll tests

The GMM measures geometry. A **roll test** measures the function, i.e. the rolling with a mating gear:

| Test | How | Result | Use |
|---|---|---|---|
| Double-flank (radial composite), DIN 3963 (old) / ISO 1328-2 | Spring presses gear and master together, centre-distance change recorded | F_i'', f_i'' | Fast 100 % check after soft cutting or in final inspection; also gives the **functional tooth thickness** (the tight-mesh centre distance) |
| Single-flank (tangential composite) | Gear and master at the correct centre distance with backlash; rotary encoders on both shafts; difference of angles | F_i', f_i' (transmission error) | Noise prediction; correlates directly with gear whine |
| Contact pattern | Gear run against master with marking compound | Pattern position | Fast visual check of helix + profile slope (helical and bevel gears) |

What the double-flank test **cannot** see: helix deviations (a master gear with a narrow face touches only part of the
face), and the difference between left and right flank (both flanks are in contact at the same time). It is therefore a
**process monitoring** tool, not a replacement for the GMM. A typical plan: the GMM checks first parts and samples, and the
roll tester checks 100 % or every 20th part (see the inspection plan in §8.3).

---

### 7.3 Size control on the shop floor: span W_k and dimension over balls M_d

The GMM tells you the shape of the flank. It does not tell you quickly enough whether the tooth is **thick enough or thin
enough** for the backlash. On the shop floor the tooth thickness is controlled by:

- the **span measurement** (base tangent length) W_k with a disc micrometer over k teeth. The two discs touch two opposite
  flanks on the base tangent. Because the base tangent is normal to both involutes, the result does not depend on where
  on the flank the discs touch.
- the **dimension over two balls (pins)** M_d. It is used when W_k does not fit (narrow helical gears, internal gears) or
  for automatic in-process gauging.

Formulas (coded in M5, `gear.py`, see M5 chapter 7 for the derivation):

$$W_k = m_n\cos\alpha_n\left[(k-0.5)\pi + z\,\mathrm{inv}\,\alpha_t + 2x\tan\alpha_n\right] + A_{sn}\cos\alpha_n$$

$$\mathrm{inv}\,\alpha_{Mt} = \mathrm{inv}\,\alpha_t + \frac{D_M}{m_n z\cos\alpha_n} - \frac{\pi}{2z} + \frac{2x\tan\alpha_n}{z},\qquad
d_M = \frac{d\cos\alpha_t}{\cos\alpha_{Mt}},\qquad M_d = d_M + D_M\ (z\ \text{even})$$

Before grinding, the flank still carries the grinding stock q (per flank, normal to the flank). Because W_k is measured
normal to both flanks, the **green (soft) span** is simply

$$W_{k,\text{green}} = W_k + 2q$$

This is the value the hobbing operator works to. It is the link between the soft and the hard process.

```python
def size_control(P=None, allowance_um=(-50, -80)):
    P = P or DEFAULT
    Pg = _gear_P(P)                       # gear.py input: the workpiece as gear 2 of a pair
    g = gear.geometry(Pg)
    up, lo = allowance_um
    W_up = gear.span_measurement(Pg, g, 2, up)
    W_lo = gear.span_measurement(Pg, g, 2, lo)
    M_up = gear.over_pins(Pg, g, 2, allowance_um=up)
    M_lo = gear.over_pins(Pg, g, 2, allowance_um=lo)
    q = P["stock_per_flank"]
    return {"k": W_up["k"], "Wk_nominal": W_up["Wk_nominal"], "Wk_max": W_up["Wk"], "Wk_min": W_lo["Wk"],
            "Wk_green_max": W_up["Wk"] + 2 * q, "Wk_green_min": W_lo["Wk"] + 2 * q,
            "DM": M_up["DM"], "M_max": M_up["M"], "M_min": M_lo["M"], "fits_face": W_up["fits_face"]}
```

`python gearmfg.py ch78`:
```
## 7.3 Size control of the default wheel (allowance -50 / -80 um, stock 0.10 mm per flank)
  W_k over k = 8 teeth: nominal 46.0005; ground 45.9253 ... 45.9535; green (before grinding) 46.1253 ... 46.1535 mm; fits face: True
  over balls D_M 3.25: M_d 127.7325 ... 127.8136 mm
```

**Hand check of W_k (k = 8, z 60, x −0.10, β 15°):**
- tan α_t = tan 20° / cos 15° = 0.36397 / 0.96593 = 0.37681, so α_t = 20.647° = 0.36036 rad.
- inv α_t = 0.37681 − 0.36036 = 0.016450, and z·inv α_t = 0.98699.
- (k − 0.5)π = 7.5π = 23.5619; 2x tan α_n = −0.2·0.36397 = −0.07279. The sum is 24.4761.
- W_k = 2·cos 20°·24.4761 = 1.87939·24.4761 = **46.0004 mm**. The program gives 46.0005.
- With A_sn = −50 µm: 46.0005 − 0.050·0.93969 = **45.9535 mm**. The program gives 45.9535.

**How it is used:**
1. The **drawing** carries W_k (k = 8) 45.9253 … 45.9535 mm, or M_d over balls 3.25 mm 127.7325 … 127.8136 mm, as
   the tooth-thickness specification. ISO 21771 recommends giving the tooth-thickness allowance A_sn and the derived test
   dimensions together.
2. The **hobbing operator** works to 46.1253 … 46.1535 mm (green) and checks every 10th part.
3. The **grinding machine** measures W_k or M_d with an in-process probe after the rough pass and corrects the final
   infeed. Because the M_d band (81 µm) is wider than the W_k band (28 µm) for the same tooth-thickness band, balls are
   more sensitive to the ball size and to the ball seating. Use the ball diameter written on the drawing.
4. `fits_face: True` means W·sin β_b < b: the discs fit on the face of the helical gear. For narrow helical gears with a
   large helix angle it becomes False, and then M_d is the only choice.

The span **does not detect** pitch errors or runout in a useful way. A gear with large runout gives different W_k at
different positions, so measure at three positions 120° apart and use the smallest value for the backlash.

---

### 7.4 Measurement uncertainty vs tolerance

Every measurement has an uncertainty U (expanded, k = 2, about 95 % confidence). If U is large compared with the
tolerance T, the measurement cannot decide whether a part is good. Two rules are used:

- **Capability ratio U/T.** A common QM rule of thumb is U/T ≤ 0.1 (10 %) "good" and ≤ 0.2 "usable". Above that, the
  instrument is not capable for this characteristic. Company rules differ (MSA, VDA 5), so check yours.
- **ISO 14253-1 conformance.** A part is accepted with certainty only if the measured value is inside the tolerance
  minus U (the acceptance limit). The supplier must prove conformance; a measured value in the "U zone" near the limit
  is not proof.

```python
def gauge_capability(tol_um, U_um):
    r = U_um / tol_um
    return {"ratio": r, "verdict": "good" if r <= 0.1 else ("usable" if r <= 0.2 else "not capable"),
            "acceptance_limit_um": tol_um - U_um}
```

`python gearmfg.py ch78`:
```
## 7.4 Measurement uncertainty vs tolerance (grade 6)
  profile F_alpha, GMM U 1.5 um            T   8.2 um -> U/T 0.18 (usable), acceptance limit 6.7 um
  helix F_beta, GMM U 1.5 um               T  10.1 um -> U/T 0.15 (usable), acceptance limit 8.6 um
  W_k band 30 um, micrometer U 3 um        T  28.2 um -> U/T 0.11 (usable), acceptance limit 25.2 um
  profile F_alpha, shop-floor GMM U 3 um   T   8.2 um -> U/T 0.37 (not capable), acceptance limit 5.2 um
```

**What this means for a grade 6 gear:**
- A GMM in an air-conditioned measuring room (U ≈ 1.5 µm for profile, check your calibration certificate) is just
  usable for grade 6 profile tolerances (8.2 µm). For **grade 5 and better** you need U ≤ 1 µm, i.e. a high-end machine,
  a 20 ± 0.5 °C room and a good probe.
- The same GMM placed **next to the grinding machine** with U ≈ 3 µm (temperature swings, vibration) is **not capable**
  for grade 6 profile. It is still very useful for trends and for comparing parts with each other, but the release
  measurement must be done in the measuring room.
- In the 28.2 µm W_k band, a disc micrometer with U = 3 µm leaves only a 25.2 µm acceptance band. Electronic span gauges
  with U ≈ 1 µm are standard for ground gears.

Hand check: U/T = 1.5 / 8.2 = **0.18**, acceptance limit 8.2 − 1.5 = **6.7 µm**. The program gives the same.

---

### 7.5 Statistical process control (SPC) of the ground span

The inspection plan does not measure every characteristic on every part. Instead, the process must be shown to be
**capable** and then **kept under control**.

#### 7.5.1 Process capability C_p, C_pk

For a characteristic with lower / upper limits LSL, USL, mean μ and standard deviation s of the process:

$$C_p = \frac{USL - LSL}{6\,s}\qquad C_{pk} = \frac{\min(USL-\mu,\ \mu-LSL)}{3\,s}$$

C_p compares the **spread** with the tolerance. C_pk also includes the **position** of the mean. The usual requirement
for an established process is C_pk ≥ 1.33, and ≥ 1.67 for safety characteristics or for the approval of a new process
(check your customer's rules, e.g. VDA / AIAG PPAP).

The data in this section are **illustrative**: 25 span values drawn from a normal distribution around the middle of the
W_k band. Replace them with your own measurements (a list of numbers is all `cp_cpk()` needs).

```python
def span_samples(P=None, n=25, sigma_um=4.0, shift_um=0.0, seed=7):
    import random
    sc = size_control(P)
    mid = 0.5 * (sc["Wk_max"] + sc["Wk_min"])
    r = random.Random(seed)
    return [mid + (shift_um + r.gauss(0.0, sigma_um)) / 1000.0 for _ in range(n)]

def cp_cpk(x, LSL, USL):
    import statistics
    mu, s = statistics.mean(x), statistics.stdev(x)
    return {"mean": mu, "s": s, "Cp": (USL - LSL) / (6 * s), "Cpk": min(USL - mu, mu - LSL) / (3 * s)}
```

#### 7.5.2 X-bar / R control chart

Every hour (or every n parts) a subgroup of 5 consecutive parts is measured. The chart shows the subgroup mean X̄ and the
range R. Limits for subgroups of 5 (standard SPC constants):

$$UCL_{\bar X},\ LCL_{\bar X} = \bar{\bar X} \pm A_2\,\bar R,\quad UCL_R = D_4\,\bar R,\quad LCL_R = D_3\,\bar R,\quad \hat\sigma = \bar R/d_2$$

with A₂ = 0.577, D₃ = 0, D₄ = 2.114, d₂ = 2.326.

```python
def xbar_r_limits(x, n=5):
    import statistics
    A2, D3, D4, d2 = 0.577, 0.0, 2.114, 2.326
    groups = [x[i:i + n] for i in range(0, len(x) - n + 1, n)]
    xb = [statistics.mean(g) for g in groups]
    R = [max(g) - min(g) for g in groups]
    Xbb, Rb = statistics.mean(xb), statistics.mean(R)
    return {"groups": len(groups), "Xbar": Xbb, "Rbar": Rb, "UCL_x": Xbb + A2 * Rb, "LCL_x": Xbb - A2 * Rb,
            "UCL_R": D4 * Rb, "LCL_R": D3 * Rb, "sigma_est": Rb / d2, "xbars": xb, "ranges": R}
```

`python gearmfg.py ch78`:
```
## 7.5 SPC of the ground span W_k (ILLUSTRATIVE data, 25 parts)
  stable process sigma 4 um                  mean 45.9391, s 3.24 um -> Cp 1.45, Cpk 1.41 capable (>= 1.33)
  same, mean shifted +8 um (dresser drift)   mean 45.9471, s 3.24 um -> Cp 1.45, Cpk 0.66 NOT capable
  worn machine sigma 7 um                    mean 45.9388, s 5.67 um -> Cp 0.83, Cpk 0.79 NOT capable
  X-bar/R chart (5 subgroups of 5): X-bar 45.9391, UCL 45.9431, LCL 45.9351; R-bar 6.96 um, UCL_R 14.70 um; sigma from R 2.99 um
```

**Hand check (stable process):** the band is 45.9535 − 45.9253 = 28.2 µm, so C_p = 28.2 / (6 · 3.24) = **1.45**.
The program gives 1.45.

**How to read the three cases:**
- **Stable:** C_p 1.45, C_pk 1.41, so the process is capable. It uses 69 % of the tolerance (6s = 19.4 µm of 28.2 µm).
- **Mean shifted by +8 µm:** the spread is the same (C_p 1.45), but the mean moved towards the upper limit and C_pk
  falls to 0.66. In gear grinding this is the typical picture of **thermal growth of the machine** in the first hour,
  **dresser wear**, or a wrong **in-process probe offset**. The X̄ chart shows it as points above UCL 45.9431 mm, long
  before parts are out of tolerance. Reaction: correct the infeed offset, check the dresser. This is a correction, not a
  repair.
- **σ 7 µm:** the spread itself is too large (C_p 0.83). Correcting the mean does not help. Causes are clamping
  repeatability, a worn spindle or table bearing, unstable stock from heat treatment (the grinder takes different stock
  from part to part and deflects differently), or the measuring system itself (do a gauge R&R study first).

σ̂ from the ranges (2.99 µm) is close to the sample standard deviation (3.24 µm). If σ̂ from R is much smaller than
s, the process drifts between the subgroups (within-group spread small, between-group spread large). That is a signal to
look for time-dependent causes such as temperature, dressing intervals or tool wear.

---

### 7.6 Machines, bottleneck and lot size

#### 7.6.1 Number of machines

The machine load per year for one operation is the cutting time of all parts plus the setups:

$$\text{load} = V\,t_{op} + \frac{V}{Q}\,t_{setup}\qquad \text{machines} = \frac{\text{load}}{H_{year}\cdot 60\cdot OEE}$$

with V = annual volume, t_op = time per part (incl. load / unload), Q = lot size, H_year = available hours per year and
OEE = overall equipment effectiveness (availability × performance × quality rate).

```python
def machines_needed(P=None, ops=("hobbing", "gen_grinding"), hours_year=3680.0, OEE=0.75):
    P = P or DEFAULT
    t = _op_minutes(P)
    out = []
    for op in ops:
        load = P["annual"] * t[op] + P["annual"] / P["batch"] * P["setup_min"][op]
        m = load / (hours_year * 60 * OEE)
        out.append({"op": op, "t_min": t[op], "load_h": load / 60, "machines": m, "installed": max(1, math.ceil(m)),
                    "utilisation": m / max(1, math.ceil(m))})
    neck = max(out, key=lambda r: r["machines"])
    return {"ops": out, "bottleneck": neck["op"], "max_annual_one_machine": hours_year * 60 * OEE / neck["t_min"]}
```

`python gearmfg.py ch78`:
```
## 7.6 Machines for 4000 parts/year (2 shifts, OEE 0.75), lot 500
  hobbing         1.36 min/part -> load   96.5 h/yr -> 0.03 machines (install 1, utilisation 3 %)
  skiving         1.88 min/part -> load  133.6 h/yr -> 0.05 machines (install 1, utilisation 5 %)
  shaping         5.31 min/part -> load  359.1 h/yr -> 0.13 machines (install 1, utilisation 13 %)
  gen_grinding    2.13 min/part -> load  150.2 h/yr -> 0.05 machines (install 1, utilisation 5 %)
  prof_grinding  11.62 min/part -> load  780.6 h/yr -> 0.28 machines (install 1, utilisation 28 %)
  chain hobbing + generating grinding: bottleneck gen_grinding, one machine each carries up to 77613 parts/yr
  high volume 150 000 parts/yr (3 shifts 6000 h, OEE 0.80): hobbing 0.71 -> install 1; gen_grinding 1.12 -> install 2
  default wheel z 60 with a 2-start hob: common factor 2 -> hunting NO (use z0 1 or 3, or accept repeating pattern)
```

**Hand check (hobbing):** load = 4000·1.358 + (4000/500)·45 = 5430 + 360 = 5790 min = **96.5 h**. Available time is
3680·60·0.75 = 165 600 min, so 5790 / 165 600 = **0.035 machines**. The program gives 0.03.

**What it means for the compressor factory:**
- At 4000 wheels per year **one** hobbing machine and **one** generating grinder are loaded only 3–5 % by this part. They
  are not dedicated machines. They are shared in a **gear cell** with all other gears of the product family (pinions,
  wheels of VC10 / VC20 / VC30, pump gears). Planning is then done for the family: the sum of all loads per machine must
  stay below about 85 % so the cell can absorb rush orders and breakdowns.
- **Setup time** dominates at low volume. For hobbing, setups are 360 min of the 5790 min load (6 %). For a family of
  30 different gears in lots of 100, setups become the main load. That is why quick-change hob arbors, zero-point
  clamping and stored machine programs matter more than cutting speed in a job shop.
- **Profile grinding** is the bottleneck candidate: 11.62 min per part, 5.5 × the generating grinder. It is used for
  the parts that cannot be generating-ground (integral shafts with close shoulders, large modules, prototypes).
- At **150 000 parts per year** (an automotive volume) the generating grinder becomes the bottleneck (1.12 → 2 machines),
  while one hobbing machine is enough. This is the normal picture: hard finishing is the expensive, slow step, so lines are
  balanced around the grinders.

#### 7.6.2 Hunting tooth ratio

With a multi-start hob, each start (thread) cuts its own set of tooth gaps. If z and z0 have a common factor g, each
thread cuts only every g-th gap, and the small pitch difference between the threads of the hob shows on the gear as a
regular pattern of pitch errors. If gcd(z, z0) = 1 (a "hunting" ratio), every thread cuts every gap in turn and the hob
errors are averaged out.

```python
def hunting_check(z, z0):
    g = math.gcd(int(z), int(z0))
    return {"gcd": g, "hunting": g == 1}
```

The default wheel (z 60, z0 2) is **not** hunting. Use a 1-start or 3-start hob for the final cut, or accept the pattern
because the wheel is ground afterwards: grinding removes it, provided the stock covers the pitch error. The pinion of §8
(z 19, z0 2) is hunting.

#### 7.6.3 Economic lot size

Big lots save setups but tie up money in stock. The total cost per year of lot size Q is

$$K(Q) = \frac{D}{Q}\,S + \frac{Q}{2}\,H$$

with D = annual demand, S = setup cost per lot (setup time × machine-hour rate + extra costs such as dressing-roll
change, first-part inspection), and H = holding cost per part and year (part value × interest rate, typically 15–25 %,
check). Setting dK/dQ = 0 gives the Andler (Harris, Wilson) lot size:

$$Q^* = \sqrt{\frac{2\,D\,S}{H}}$$

```python
def economic_lot(P=None, op="hobbing", part_value=15.0, interest=0.20, extra_setup_eur=0.0):
    P = P or DEFAULT
    S = P["setup_min"][op] / 60.0 * P["rate"][op] + extra_setup_eur
    H = part_value * interest
    D = P["annual"]
    Q = math.sqrt(2 * D * S / H)
    cost = lambda q: D / q * S + q / 2 * H
    return {"S": S, "H": H, "Q_star": Q, "cost_at_Q": cost(Q), "cost_at_batch": cost(P["batch"]), "lots_per_year": D / Q}
```

`python gearmfg.py ch78`:
```
  economic lot hobbing       (setup 64 EUR, holding 3.0 EUR/part yr): Q* 412 parts, 9.7 lots/yr; cost/yr at Q* 1237 vs at lot 500: 1260 EUR
  economic lot gen_grinding  (setup 140 EUR, holding 3.0 EUR/part yr): Q* 611 parts, 6.5 lots/yr; cost/yr at Q* 1833 vs at lot 500: 1870 EUR
  economic lot gen_grinding +dress (setup 290 EUR, holding 3.0 EUR/part yr): Q* 879 parts, 4.5 lots/yr; cost/yr at Q* 2638 vs at lot 500: 3070 EUR
```

**Hand check (hobbing):** S = 45/60·85 = 63.75 EUR and H = 15·0.20 = 3.0 EUR, so Q* = √(2·4000·63.75/3.0) =
√170 000 = **412 parts**. The program gives 412.

**Lessons:**
- The cost curve is **flat** near the optimum: lot 500 instead of 412 costs only 23 EUR more per year (1260 vs 1237).
  Lot sizes are therefore chosen from practical units (furnace loads, pallets, one week of demand), not from the formula
  to the last part.
- One lot must pass all operations, and the grinder has the larger setup (dressing roll, worm profile dressing,
  first-part GMM check: 290 EUR). For the grinder alone Q* is 879. A common lot of about 500 to 600 is a reasonable
  compromise, and it fills 3 furnace loads (§7.8).
- **Reducing setup cost is better than increasing the lot.** Because K(Q*) = √(2DSH), halving S lowers the
  total lot-size cost by the factor 1/√2 (−29 %) and halves nothing else – and smaller lots make the factory more flexible
  (SMED, single-minute exchange of die).

---

### 7.7 Cost per part vs annual volume – which process chain?

`chain_options()` (chapter 6) compares the chains at **one** volume. Over the life of a product the volume changes, and
the **design-specific tools** decide which chain is cheapest:
- **Hob:** about 2400 EUR, specific to module, pressure angle and protuberance. It can be used for every gear with the
  same basic rack.
- **Skiving tool:** about 6000 EUR, specific to the gear (tooth count ratio, helix).
- **Dressing roll for generating grinding:** about 7000 EUR, specific to module, pressure angle and modifications.
  Profile grinding uses a CNC dresser with a universal disc, so it needs no specific tool.
- **Fixtures:** about 3000 EUR (check all quotations).

Cost per part over a product life of Y years:

$$c(V) = \sum_{ops}\frac{t_{op} + t_{setup}/Q}{60}\,r_{op} + c_{HT} + \frac{\sum K_{special}}{V\,Y},\qquad Q = \min(Q_{plan}, V)$$

For the hob the larger of the wear cost (regrinds, §3) and the amortisation is used: a hob bought for 300 parts is never
worn out.

```python
SPECIAL_TOOLS = {"hob": 2400.0, "skiving_tool": 6000.0, "dressing_roll": 7000.0, "fixtures": 3000.0}

def chain_cost_vs_volume(P=None, volumes=(100, 300, 1000, 3000, 10000, 30000), years=3.0):
    P = P or DEFAULT
    w = work_geometry(P)
    t = _op_minutes(P)
    ht = P["rate"]["heat_treat_per_kg"] * w["mass_kg"]
    rows = []
    for V in volumes:
        Q = dict(P, batch=min(P["batch"], V))
        n_life = V * years
        hob_tool = max(hob_tool_cost_per_part(Q), SPECIAL_TOOLS["hob"] / n_life)
        fx = SPECIAL_TOOLS["fixtures"] / n_life
        c = {"hob+gen_grind": op_cost(Q, "hobbing", t["hobbing"]) + hob_tool + ht + op_cost(Q, "gen_grinding", t["gen_grinding"])
             + SPECIAL_TOOLS["dressing_roll"] / n_life + fx,
             "hob+prof_grind": op_cost(Q, "hobbing", t["hobbing"]) + hob_tool + ht + op_cost(Q, "prof_grinding", t["prof_grinding"]) + fx,
             "skive+gen_grind": op_cost(Q, "skiving", t["skiving"]) + SPECIAL_TOOLS["skiving_tool"] / n_life + ht
             + op_cost(Q, "gen_grinding", t["gen_grinding"]) + SPECIAL_TOOLS["dressing_roll"] / n_life + fx}
        rows.append({"V": V, **c, "best": min(c, key=c.get)})
    return rows
```

`python gearmfg.py ch78`:
```
## 7.7 Cost per part vs annual volume (3-year product life, special tools amortised) [EUR]
  volume/yr   hob+gen_grind  hob+prof_grind  skive+gen_grind   cheapest
        100          56.51           50.94            70.50   hob+prof_grind
        300          27.60           37.91            33.28   hob+gen_grind
       1000          18.15           33.98            20.50   hob+gen_grind
       3000          15.93           33.31            16.95   hob+gen_grind
      10000          15.15           33.08            15.70   hob+gen_grind
      30000          14.93           33.01            15.35   hob+gen_grind
  break-even hob+gen_grind vs hob+prof_grind: 131 parts/yr
```

**Hand check of the profile-grinding chain at 10 000 parts per year** (lot 500):
- Hobbing: (1.358 + 45/500)/60·85 = **2.05 EUR**.
- Hob wear: 1.27 EUR. Heat treatment: 2.5·2.49 = 6.22 EUR.
- Profile grinding: (11.62 + 45/500)/60·120 = 23.42 EUR.
- Fixtures: 3000/30 000 = 0.10 EUR.
- Sum: **33.06 EUR**. The program gives 33.08 (rounding of the times).

**Lessons:**
- Below about **130 parts per year** (prototypes, spare parts, small series) profile grinding is cheaper, because it
  needs no dressing roll. Above that, generating grinding wins clearly. At 3000 parts per year it costs half as much
  (15.93 vs 33.31 EUR).
- Power skiving of an **external** gear does not pay against hobbing here (16.95 vs 15.93 EUR at 3000 per year). The
  special tool costs more and the machine-hour rate is higher. Skiving is the process for **internal** gears (planet
  ring gears) and gears close to a shoulder, where a hob cannot run out (see §8.2). There it replaces shaping and
  broaching.
- At high volume the cost per part approaches the pure machine and heat-treat cost: 14.93 EUR at 30 000 per year, of
  which heat treatment is 6.22 EUR (42 %). Reducing the **mass** that goes through the furnace (smaller blank, no
  hardening of the hub, or induction hardening only of the teeth, chapter 5) then becomes the biggest saving.
- **Make or buy:** a generating grinder costs 0.8 to 1.5 million EUR. At 4000 wheels per year it would be 5 % loaded by
  this part. Buy the grinding from a gear subcontractor until the whole product family loads a machine to more than about
  50 %. Keep hobbing in-house: it is cheap, flexible, and controls the delivery time.

---

### 7.8 Heat-treat furnace, line layout and lead time

#### 7.8.1 Layout

A typical gear line in a medium-volume factory has three areas with very different rhythms:

| Area | Machines | Rhythm | Typical problem |
|---|---|---|---|
| Soft cell | Lathe (blank), hobbing / skiving / shaping, deburring / chamfering, washing | Part by part, minutes | Hob changes, deburring quality (burrs harden and break off later) |
| Heat treatment | Sealed-quench batch furnace (or low-pressure carburising + high-pressure gas quench), tempering furnace, washer, shot blasting | **Batch**, hours | Waiting for a full load, distortion scatter between load positions |
| Hard cell | Bore / face grinding, gear grinding, honing, washing, GMM, roll tester, marking | Part by part, minutes | Grinding burn, stock variation from distortion |

The furnace is the link that breaks the flow: parts arrive one by one and leave in loads of 100 to 200. It is often run
in 3 shifts by a subcontractor or a central heat-treat shop, so the **waiting time** for the furnace is part of the lead
time.

#### 7.8.2 Furnace loads

Parts per load = net load mass / part mass. Net mass = gross load × (1 − fixture share). The cycle is:

$$t_{cycle} = t_{heat} + t_{carb}(\text{Harris, chapter 5}) + t_{diffuse/cool} + t_{quench}$$

```python
def furnace_plan(P=None, load_kg=600.0, fixture_share=0.30, t_heat_h=1.5, t_diffuse_h=1.0, t_quench_h=0.5,
                 hours_year=6000.0, OEE=0.85):
    P = P or DEFAULT
    w = work_geometry(P)
    parts = int(load_kg * (1 - fixture_share) / w["mass_kg"])
    t_carb = carburising_time(chd_plan(P)["CHD_green"], P["T_carb_C"], P["case_ratio"])
    cycle = t_heat_h + t_carb + t_diffuse_h + t_quench_h
    loads = math.ceil(P["annual"] / parts)
    util = loads * cycle / (hours_year * OEE)
    return {"parts_per_load": parts, "t_carb_h": t_carb, "cycle_h": cycle, "loads_per_year": loads,
            "furnace_h": loads * cycle, "utilisation": util, "parts_per_hour": parts / cycle}
```

#### 7.8.3 Lead time of a lot

Two ways to move a lot through the line:
- **Sequential:** the whole lot finishes one operation before it moves on.
- **Overlapped:** a transfer batch (here one furnace load) moves on as soon as it is ready, so the furnace starts after
  the first load is hobbed and grinding starts after the first load is hardened.

Queue times before each area (8 h) and the wait for a furnace slot (16 h) are examples. Measure them in your shop; they
are usually larger than the processing times.

```python
def lead_time(P=None, transfer=None, queue_h_per_op=8.0, wait_furnace_h=16.0):
    P = P or DEFAULT
    t = _op_minutes(P)
    n = P["batch"]
    fp = furnace_plan(P)
    loads = math.ceil(n / fp["parts_per_load"])
    soft, hard = n * t["hobbing"] / 60, n * t["gen_grinding"] / 60
    furn = loads * fp["cycle_h"]
    seq = soft + furn + hard + 2 * queue_h_per_op + wait_furnace_h
    tr = transfer or fp["parts_per_load"]
    ovl = tr * t["hobbing"] / 60 + max(furn, soft - tr * t["hobbing"] / 60) + tr * t["gen_grinding"] / 60 \
        + max(0.0, hard - furn) + 2 * queue_h_per_op + wait_furnace_h
    return {"lot": n, "loads": loads, "soft_h": soft, "furnace_h": furn, "hard_h": hard, "sequential_h": seq, "overlapped_h": ovl}
```

`python gearmfg.py ch78`:
```
## 7.8 Heat-treat furnace and lead time
  sealed-quench furnace 600 kg gross: 168 parts/load, carburise 1.33 h, cycle 4.33 h, 24 loads/yr -> 104 furnace h, utilisation 2 %, 38.8 parts/h
  lot 500: hobbing 11.3 h, furnace 13.0 h (3 loads), grinding 17.8 h -> lead time sequential 74.1 h, overlapped 59.6 h
```

**Hand check:**
- Parts per load: 600·0.7/2.49 = 168.7, so **168** parts.
- Cycle: 1.5 + 1.33 + 1.0 + 0.5 = **4.33 h**.
- Lot of 500: ⌈500/168⌉ = 3 loads, so 3·4.33 = **13.0 h** in the furnace.
- Sequential lead time: 11.3 + 13.0 + 17.8 + 2·8 + 16 = **74.1 h**. The program gives 74.1.

**Lessons:**
- The **processing** time of the lot is 42 h. The rest (32 h) is waiting. In real shops the ratio is often 1:10, with
  lead times of 2–4 weeks for a lot that is worked on for 2 days. **Little's law** connects them:
  WIP = throughput × lead time. Halving the lead time halves the parts sitting in the line.
- Overlapping saves 14.5 h (74.1 → 59.6 h) without any investment. It only needs a rule that a full furnace load is
  released at once.
- The short carburising time of 1.33 h comes from the shallow green case of 0.45 mm (module 2). For module 6 gears the
  case is 1.2–1.5 mm and carburising takes 10–15 h. Then the furnace, not the grinder, decides the lead time.
- The furnace utilisation of 2 % for this part confirms that heat treatment is bought or done centrally for the whole
  factory.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification – what has been checked and how

| Item | How it is checked | Where |
|---|---|---|
| Hob index (n_table·z = n0·z0), hob lead angle | `python gearmfg.py selftest` | Ch. 3 |
| Feed-mark formula = exact circle sagitta × sin α_n (within 0.1 %) | selftest | Ch. 3 |
| Enveloping flats ∝ 1/i0² | selftest | Ch. 3 |
| Harris law: inverse consistent, 4 × time → 2 × case | selftest | Ch. 5 |
| Power skiving: relative speed along the tooth line, |v_rel| = v_c (vector check) | selftest | Ch. 3 |
| Induction reference depth 10 kHz ≈ 5.5 mm | selftest | Ch. 5 |
| Hobbing time formula, grinding time ratio, CHD inside the 0.15–0.20 m_n rule | selftest | Ch. 3, 5, 6 |
| Chain sorting; honing alone not feasible with 0.10 mm stock | selftest | Ch. 6 |
| ISO 1328 f_pT and F_i'' (grade 6) | Hand calculation, §7.1 | Ch. 7 |
| W_k nominal and with allowance | Hand calculation, §7.3 | Ch. 7 |
| Capability ratio, C_p, machine load, economic lot, cost per part, furnace, lead time | Hand calculations, §7.4–7.8 | Ch. 7 |
| Shoulder run-out length, shaft mass | Hand calculations, §8.2 | Ch. 8 |

`python gearmfg.py selftest` ends with `SELFTEST PASS`, and `python dm_toolkit.py selftest_all` includes gearmfg.

### 8.2 Complete worked example – manufacturing plan for the M5 pinion (integral pinion shaft)

**Task.** The pinion of the M5 helical reducer (gear.py DEFAULT: m_n 2, z 19, x +0.25, β 15°, b 28 mm, 18CrNiMo7-6,
case hardened, grade 6) is made **in one piece with its shaft**, an integral pinion shaft. Bearing seats Ø30, shoulders
Ø40 next to the teeth, shaft end Ø25. Volume 4000 per year, lot 400. Plan the manufacture: tools, machines, heat
treatment, finishing, size data for the drawing, inspection plan, cost.

**Step 1 – input file** `tools/examples/gearmfg_example.json` (only the keys that differ from `gearmfg.DEFAULT`):

```json
{
  "name": "M5 pinion z 19 (integral pinion shaft), case hardened and ground (worked example chapter 8)",
  "z": 19, "x": 0.25, "hand": "left", "hob_hand": "left",
  "hob_da0": 56.0, "hob_z0": 2, "hob_gashes": 14,
  "batch": 400, "annual": 4000, "grade_required": 6
}
```

Why these choices:
- **hand left:** the pinion of a helical pair has the opposite hand to the wheel (wheel right).
- **hob_hand left:** with a hob of the same hand as the gear, the swivel angle η = β − γ0 is small (10.5° instead of
  19.5°). That gives a shorter approach and a smoother cut. It is the standard choice.
- **hob_da0 56:** a smaller hob than the 70 mm of the wheel, because of the shoulder (Step 3).
- **z0 2 with z 19:** gcd(19, 2) = 1, so the ratio is hunting (§7.6.2).

**Step 2 – full calculation.** `python gearmfg.py run --in examples/gearmfg_example.json --out example`

```
# Gear manufacturing report - M5 pinion z 19 (integral pinion shaft), case hardened and ground (worked example chapter 8)

mn 2.00, z 19, beta 15.0 deg left, x +0.25, b 28.0 mm; d 39.340, da 44.340, df 35.340, h 4.500 mm; blank mass 0.31 kg

## Hobbing
- hob da0 56, z0 2, 14 gashes, left hand: d0 51.00, lead angle 4.498 deg, swivel angle 10.502 deg (same hand)
- vc 150 m/min -> n0 853 rpm, table 89.75 rpm; fa 2.50 mm/rev; approach 15.8, path 46.8 mm -> 0.21 min cut, 0.71 min total
- feed marks 9.54 um, enveloping flats 1.81 um; max chip thickness (Hoffmeister) 0.250 mm; hob cost 1.273 EUR/part

## Shaping and power skiving (alternatives)
- shaping: stroke 34.0 mm, 588 double strokes/min -> 2.28 min total
- skiving: Sigma 20.0 deg, tool helix -5.00 deg, work 3535 rpm, tool 1815 rpm (v_w 437, v_tool 424 m/min) -> 0.94 min total

## Heat treatment (case hardening)
- CHD rule 0.30-0.40 mm; final 0.350 mm + stock 0.10 -> green CHD 0.450 mm (root keeps 0.450)
- carburising at 930 C: 1.33 h to total case 0.750 mm (Harris, ratio 0.60, check); span-size stock 0.200 mm

## Hard finishing
- generating grinding: wheel 275 mm at 63 m/s -> 4375 rpm, 3 starts; rough 0.14 + finish 0.38 = 1.02 min total
- profile grinding: 2.78 s per gap and pass, 4 passes, Q'w 2.50 mm3/(mm s) -> 4.02 min total

## Tolerances ISO 1328-1 grade 6 (gear.py, check)
- f_pT 8.3, F_pT 23.9, F_alphaT 8.2, F_betaT 9.6, F_rT 21.5 um

## Process chains (batch 400, cost per part, EUR, check rates)
- hobbing -> carburise -> gen_grinding         1.73 min    5.93 EUR  best grade 3 meets
- skiving -> carburise -> gen_grinding         1.96 min    7.39 EUR  best grade 3 meets
- shaping -> carburise -> gen_grinding         3.30 min    7.49 EUR  best grade 3 meets
- hobbing -> carburise -> prof_grinding        4.73 min   11.47 EUR  best grade 2 meets
- skiving -> carburise -> prof_grinding        4.96 min   12.94 EUR  best grade 2 meets
- shaping -> carburise -> prof_grinding        6.30 min   13.03 EUR  best grade 2 meets
- hobbing -> carburise -> honing               2.41 min    7.21 EUR  best grade 5 stock too large for honing alone
- skiving -> carburise -> honing               2.64 min    8.68 EUR  best grade 5 stock too large for honing alone
- shaping -> carburise -> honing               3.98 min    8.77 EUR  best grade 5 stock too large for honing alone
written: report.md, chains.csv -> example
```

What to notice in the report:
- **Chip thickness 0.250 mm** is at the upper end of the usual range for PM-HSS hobs (about 0.15–0.25 mm, check with the
  hob maker). The small hob (fewer gashes, 14) and the small tooth count raise it. If the hob maker limits h_max to
  0.20 mm, reduce the axial feed: h_max grows with f_a^0.511, so f_a = 2.5·(0.20/0.25)^(1/0.511) = **1.61 mm/rev**.
- **Enveloping flats 1.81 µm** (vs 0.44 µm on the wheel) come from the small tooth count z 19 and the 14 gashes.
  Uncritical, because the flank is ground.
- The cutting time is only 0.21 min, so the **auxiliary time** (0.5 min load / unload, shaft between centres) is 70 %
  of the hobbing time. On a shaft part, automation (gantry loader) pays more than faster cutting.

**Step 3 – design for manufacture: the shoulder next to the teeth.** On an integral pinion shaft the cutting tool must
run out of the cut in front of the shoulder. A disc-shaped tool of diameter d_tool that cuts to the root diameter d_f
touches a shoulder of diameter D_sh at an axial distance

$$L = \sqrt{r_0^2 - \left(\frac{d_f}{2} + r_0 - \frac{D_{sh}}{2}\right)^2},\qquad r_0 = \frac{d_{tool}}{2}$$

(axial-plane approximation; with the swivel angle of a helical gear the real value is a little different, so check it
in the CAD model or with the machine maker's simulation).

```python
def tool_shoulder_clearance(df, D_sh, d_tool):
    r0 = d_tool / 2
    y = df / 2 + r0 - D_sh / 2
    return math.sqrt(max(r0 ** 2 - y ** 2, 0.0)) if D_sh > df else 0.0
```

`python gearmfg.py ch78`:
```
## 8.2 Worked example - M5 pinion z 19 on an integral pinion shaft
  d 39.340, da 44.340, df 35.340, h 4.500 mm; hob da0 56 z0 2 (left hand): lead angle 4.498, swivel 10.502 deg; hunting z/z0: yes (gcd 1)
  hobbing: n0 853 rpm, table 89.7 rpm, approach 15.8 mm -> 0.71 min; gen. grinding 1.02 min; profile grinding 4.02 min
  run-out length needed in front of the 40 mm shoulder:
    hob da0 70                               12.6 mm
    hob da0 56                               11.2 mm
    grinding worm 275                        25.2 mm
    grinding worm 150 (small-wheel option)   18.5 mm
    profile wheel 100                        15.1 mm
```

**Hand check (grinding worm 275):** r0 = 137.5, y = 17.67 + 137.5 − 20 = 135.17, so L = √(137.5² − 135.17²) =
√(18 906 − 18 271) = √635 = **25.2 mm**.

**The design decision this forces:**
- If the shoulder is closer than **25.2 mm** to the end of the teeth, the standard generating grinder cannot grind the
  full face. Then the choices are:
  1. move the shoulder: the shaft becomes longer and the bearing span grows, which goes back to M3 deflection;
  2. reduce the shoulder diameter below the root circle (D_sh ≤ d_f = 35.3 mm): no clearance is needed, but the bearing
     abutment becomes smaller;
  3. use the small-wheel option of the grinder (worm d 150: 18.5 mm) or **profile grinding** with a d 100 wheel
     (15.1 mm), at 4 times the grinding time;
  4. use power skiving or shaping in the soft stage. These tools need only a small run-out (a few mm, shaping: a
     relief groove).
- **Decision for the example:** the designer gives a **26 mm** run-out space between the end of the teeth and the Ø40
  shoulder (generating grinding with the standard worm, cheapest chain). The hob needs only 11.2 mm, so it fits easily.
  The decision is written into the M3 shaft model (bearing span +14 mm), and the shaft deflection is checked again
  there.

This is the main lesson of the example: **the manufacturing method changes the shaft geometry.** That is why gear
manufacturing must be decided during the design (M1 method, embodiment design), not after the drawing is finished.

**Step 4 – heat treatment and the mass of the real part.**

```
  size: W_k over 3 teeth 15.6150 ... 15.6432 (green 15.8150 ... 15.8432) mm; M_d over balls 3.25: 43.9275 ... 43.9944 mm
  heat treatment: CHD final 0.350, green 0.450 mm; shaft mass 1.15 kg (model blank 0.31 kg) -> 2.88 EUR (model 0.77 EUR)
```

The program's blank model (a wheel with a bore of 0.35 d) is **wrong for a shaft**. The real stepped shaft (from
`PINION_SHAFT`, Ø30×40, Ø40×12, Ø44×28, Ø40×12, Ø30×30, Ø25×50 mm) weighs 1.15 kg.

```python
PINION_SHAFT = [(30.0, 40.0), (40.0, 12.0), (44.0, 28.0), (40.0, 12.0), (30.0, 30.0), (25.0, 50.0)]   # (d, L) mm

def shaft_mass(segments):
    return sum(7.85e-6 * math.pi / 4 * d ** 2 * L for d, L in segments)
```

**Hand check:** Σ d²L = 36 000 + 19 200 + 54 208 + 19 200 + 27 000 + 31 250 = 186 858 mm³. Multiplied by π/4 this is
146 757 mm³, and by 7.85·10⁻⁶ kg/mm³ it gives **1.152 kg**.

The heat-treat cost is therefore 2.88 EUR, not 0.77 EUR, and the cost per part of the chain rises from 5.93 to about
**8.0 EUR**. Further decisions for the heat treatment of a shaft:
- **Mask** the bearing seats and the threaded end (copper paint or stop-off paste) if they must stay soft: threads in
  case-hardened steel crack. Alternatively, carburise everything and turn off the case on the seats before hardening
  (the "carburise – turn – harden" route). That needs a second machining step.
- Hang the shafts **vertically** in the furnace fixture. Lying shafts bend under their own weight at 930 °C.
  Straightening after hardening is limited to about 0.05 mm and risks cracks, so check the runout on every shaft after
  hardening.
- **Grind the bearing seats** after hardening, in the same clamping (between centres) as the teeth, or with the teeth
  as datum. This keeps F_r small.

**Step 5 – size data for the drawing (from Step 4).**

| Characteristic | Value |
|---|---|
| Tooth-thickness allowance A_sn | −50 / −80 µm |
| Span W_k over k = 3 teeth (ground) | 15.6150 … 15.6432 mm |
| Span W_k green (before grinding, for the soft stage) | 15.8150 … 15.8432 mm |
| Dimension over balls D_M 3.25 mm (ground) | 43.9275 … 43.9944 mm (z odd: balls in opposite gaps 180° − 180°/z apart) |
| Flank grade | ISO 1328-1:2013 grade 6: f_pT 8.3, F_pT 23.9, F_αT 8.2, F_βT 9.6, F_rT 21.5 µm |
| CHD (550 HV) after grinding | 0.35 +0.15 mm (green 0.45 mm), surface 58–62 HRC, core ≥ 30 HRC (check) |
| Grinding burn | none (ISO 14104 class A on the flank / root class B, check the customer standard) |

**Step 6 – machines and cost.**

```
  machines: hobbing 0.02 (1); gen_grinding 0.03 (1)
  cheapest chain meeting grade 6: hobbing -> carburise -> gen_grinding, 1.73 min, 5.93 EUR/part
```

- The gear cell is loaded only 2–3 % by this part. The pinion goes into the family plan of the gear cell (§7.6).
- The tooth-related cost is about 8 EUR per part with the corrected heat-treat cost. The turning of the shaft, the
  grinding of the seats and the inspection come on top (M10 and the CAM item of field 2).

**Step 7 – decision summary of the example.**

1. Chain: turn (soft) → hob (da0 56, 2-start left, f_a 2.5, or 1.6 if the hob maker limits h_max) → deburr / chamfer
   → carburise (green CHD 0.45 mm, vertical fixture, seats masked or turned off) → harden + temper → grind centres →
   generating-grind teeth (standard worm) + grind seats → wash → inspect.
2. Shaft design change: **26 mm** run-out between teeth and the Ø40 shoulder (feed back to M3).
3. Tooth-thickness and inspection data as in Step 5. Inspection plan as in §8.3.
4. Cost ≈ 8 EUR per part for the teeth incl. heat treatment. Grinding bought from a subcontractor until the family loads
   a grinder above about 50 %.

### 8.3 Inspection plan of the example

```python
INSPECTION_PLAN = [   # characteristic, method / instrument, frequency, limit (example plan, check with the customer)
    ("blank: bearing seats, face runout", "CMM / runout gauge", "first part + 1 per 50", "IT6, 10 um"),
    ...
]
```

`python gearmfg.py ch78`:
```
## 8.3 Inspection plan of the example (what, how, how often)
  blank: bearing seats, face runout                | CMM / runout gauge                           | first part + 1 per 50                    | IT6, 10 um
  soft: W_k (green)                                | span micrometer at the hobbing machine       | every 10th part + after hob change       | W_k + 2q, +/-20 um
  soft: profile + helix (first part)               | gear measuring machine (GMM)                 | first part, after hob shift / regrind    | grade 8
  heat treatment: surface / core hardness, CHD     | Vickers traverse on a test piece in every load | every load                               | 58-62 HRC, CHD 0.35 +0.15
  heat treatment: distortion                       | W_k, runout on 5 parts per load              | every load                               | for stock planning
  ground: W_k / M_d                                | span micrometer / ball gauge at the grinder  | every part (in-process probe) or 1 per 5 | tolerance of the drawing
  ground: f_Halpha, f_Hbeta, F_alpha, F_beta, f_p, F_p, F_r | GMM, 4 teeth at 90 deg                       | first part + 1 per 50 + after dressing change | grade 6
  ground: grinding burn                            | nital etch (ISO 14104) or Barkhausen noise   | first part + 1 per lot / 100 % Barkhausen | class A/B
  ground: roughness Ra / Rz                        | stylus instrument on the flank               | 1 per lot                                | Ra <= 0.4 um
  final: double-flank roll test F_i'', f_i''       | roll tester against a master gear            | 100 % (fast) or 1 per 20                 | grade from 7.2
```

Principles behind the plan:
- **Measure where the error is made.** Green W_k is checked at the hobbing machine. Hardness and CHD are checked on a
  test piece of the same steel and size in every furnace load, because the case cannot be measured on the part without
  cutting it.
- **First part after every change.** Hob regrind or shift, dressing-roll change, new steel heat, new furnace program:
  each one needs a GMM first-part check before the lot continues.
- **Grinding burn** (tempering of the case by the grinding heat) is invisible to the eye and to the GMM, but it causes
  pitting and tooth breakage in service. Check it with nital etching (ISO 14104) or non-destructively with Barkhausen
  noise.
- **Frequencies come from capability.** With C_pk ≥ 1.33 (§7.5) the sample frequency can be reduced. With C_pk < 1.33,
  measure 100 % until the cause is removed.

### 8.4 Limits of the program

- Cutting data, chip-thickness formula, Harris law, grinding data, machine rates and tool prices are **typical values or
  published approximations**. Use your machine maker's and tool maker's data and your shop's time studies for real
  planning.
- The blank-mass model of `work_geometry()` is a wheel with a bore of 0.35 d. For shafts, hollow wheels or wheels with a
  web, compute the real mass (as in §8.2) before using the heat-treat cost.
- The hob wear cost per part is independent of the gear size (parts per regrind is an input). Larger gears with more
  metal removal wear the hob faster. Adjust `hob_parts_per_regrind` to the metal removed (or use the hob maker's tool-life
  model based on the length hobbed per tooth).
- The shoulder clearance is an axial-plane approximation. Helical gears with swivelled tools need a 3D check.
- ISO 1328-2 roll-test values follow the 1997 edition, and F_αT / F_βT are approximations (see M5). Check the standard.
- The SPC data are illustrative. C_p / C_pk need at least 25 subgroups (125 parts) from a stable process for a valid
  capability study.

### 8.5 References

1. ISO 1328-1:2013 – Cylindrical gears – ISO system of flank tolerance classification – Part 1: Definitions and allowable values of deviations relevant to flanks of gear teeth.
2. ISO 1328-2:2020 – Part 2: Definitions and allowable values of deviations relevant to radial composite deviations and runout information (and the 1997 edition for the formulas of §7.1.2).
3. ISO 21771:2007 – Gears – Cylindrical involute gears and gear pairs – Concepts and geometry.
4. ISO 6336-5:2016 – Calculation of load capacity of spur and helical gears – Strength and quality of materials (material quality grades ML / MQ / ME, CHD requirements).
5. DIN 3968 / ISO 4468 – Gear hobs (single-start), tolerances; VDI 2607 – Computer-aided evaluation of profile and helix measurements on cylindrical gears.
6. ISO 18653:2003 – Gears – Evaluation of instruments for the measurement of individual gears; VDI/VDE 2612 / 2613 – profile, helix and pitch measurement of gears.
7. ISO 14104:2017 – Gears – Surface temper etch inspection after grinding, chemical method.
8. ISO 14253-1:2017 – Geometrical product specifications – Inspection by measurement – Decision rules for verifying conformity.
9. ANSI/AGMA 2015-1-A01 – Accuracy classification system – tangential measurements for cylindrical gears.
10. Niemann, G.; Winter, H.: Maschinenelemente, Band II – Getriebe allgemein, Zahnradgetriebe. Springer.
11. Klocke, F.; Brecher, C.: Zahnrad- und Getriebetechnik (Gear and transmission technology). Hanser, 2017; Klocke, F.: Manufacturing Processes 1 – Cutting / Fertigungsverfahren 1. Springer.
12. Bausch, T. (ed.): Innovative Zahnradfertigung. expert verlag.
13. Harris, F. E.: Case depth – an attempt at a practical definition. Metal Progress 44 (1943) – the carburising law of chapter 5.
14. Hoffmeister, B.: Über den Verschleiß am Wälzfräser. Dissertation RWTH Aachen, 1970 – the chip-thickness formula of chapter 3.
15. Maker literature (application and machine handbooks): Liebherr-Verzahntechnik (hobbing, generating grinding, power skiving), Gleason-Pfauter (hobbing, threaded-wheel grinding), Reishauer (generating grinding), KAPP NILES (profile and generating grinding), Präwema (power honing), Klingelnberg / Gleason / Wenzel (gear measuring machines), Frenco (roll testers, over-ball gauges).
16. Montgomery, D. C.: Introduction to Statistical Quality Control. Wiley (SPC constants A₂, D₃, D₄, d₂).

### 8.6 Glossary

| Term | Meaning |
|---|---|
| Acceptance limit | Tolerance limit shrunk by the measurement uncertainty U (ISO 14253-1) |
| Base tangent length (span) W_k | Distance over k teeth measured normal to the flanks with disc micrometers |
| Barkhausen noise | Magnetic, non-destructive method that detects grinding burn and residual-stress changes |
| C_p, C_pk | Process capability: spread (and position) of the process compared with the tolerance |
| CHD | Case hardening depth: depth where the hardness falls to 550 HV |
| Double-flank roll test | Gear rolled against a master without backlash; records the centre-distance change F_i'', f_i'' |
| Dressing roll | Diamond roll with the tooth profile that shapes the grinding worm (design-specific tool) |
| Economic lot size Q* | Lot size with minimum sum of setup and holding cost, √(2DS/H) |
| Enveloping flats | Small flats on the involute left by the finite number of hob gashes |
| f_Hα, f_Hβ | Profile / helix slope deviation (pressure angle / helix angle error) |
| f_fα, f_fβ | Profile / helix form deviation (waviness) |
| F_α, F_β | Total profile / helix deviation |
| f_p, F_p | Single / total cumulative pitch deviation |
| F_r | Runout: radial position of the gaps vs the datum axis |
| Functional datum | The axis on which the gear runs in the gearbox (bearing seats, bore); all measurements refer to it |
| GMM | Gear measuring machine: CNC 4-axis machine that measures profile, helix, pitch, runout generatively |
| Green (soft) state | Before heat treatment; green dimensions include the grinding stock |
| Grinding burn | Local tempering (or rehardening) of the case by grinding heat; detected by nital etch or Barkhausen noise |
| Hunting ratio | z and z0 have no common factor, so every hob thread cuts every gap |
| Integral pinion shaft | Pinion cut directly on its shaft (no separate gear and shaft) |
| Lead time | Time from release of a lot to its completion; mostly waiting time |
| Little's law | WIP = throughput × lead time |
| M_d | Dimension over two balls (pins) placed in opposite gaps |
| OEE | Overall equipment effectiveness = availability × performance × quality rate |
| Run-out length | Axial space a tool needs in front of a shoulder to leave the cut |
| SMED | Single-minute exchange of die: methods to cut setup time |
| SPC | Statistical process control: control charts that detect a process change before parts are bad |
| Transfer batch | Part of a lot that moves on to the next operation before the whole lot is finished |
| U | Expanded measurement uncertainty (k = 2, about 95 % confidence) |
| X̄ / R chart | Control chart of subgroup means and ranges |
