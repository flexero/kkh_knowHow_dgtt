# M10 – Tolerances, fits and stack-up: ISO 286 limits and fits, interference fits, tolerance chains, geometric tolerances, measurement

> Field 1 *Mechanical design*, item 10.
> **Theory and program are combined:** every formula is followed by the code of `tools/tol.py`, the command and the
> real output. MATLAB mirror: `tools/tol.m`. Web: tab **M_P_C tools**, item 16. Python standard library only – offline.
> **The ISO 286 values are typed in from ISO 286-1/-2** (standard tolerances IT1–IT16, shaft deviations d…p in the
> main steps and c, r, s, u in the intermediate steps up to 500 mm, hole deviations by the general and the Δ rule).
> The self-test compares them with known table values. Check them against the standard before a drawing is
> released. Bearing-ring tolerances, friction coefficients, process capabilities and cost data are typical values,
> marked "check". The default case is the M2 compressor: its seats (M3 shaft, M4 bearings), its TDC gap stack and its
> cylinder-head bolts.

## Contents
0. How to use this guide with the program
1. Purpose – what a tolerance calculation must prove
2. The ISO system of limits and fits (ISO 286): sizes, deviations, IT grades, fundamental deviations, hole / shaft basis, the Δ rule, preferred fits, general tolerances ISO 2768, envelope requirement
3. Fits in function: selection by function, rolling-bearing seats, temperature, wear, roughness, fit finder
4. Interference fits (DIN 7190 style): Lamé theory, smoothing, torque and axial capacity, hub stress, press-in and shrink assembly, redesign of the M3 seat
5. Tolerance stack-up: chains and loops, worst case, RSS, modified RSS, Monte Carlo, process shift, Cpk, contributions, nonlinear stacks, allocation, selective assembly
6. Geometric tolerancing (ISO 1101 / ISO GPS / ASME Y14.5): form, orientation, location, run-out, datums, MMC / LMC and bonus, virtual condition, fastener formulas, functional gauges
7. Manufacturing and measurement: process capability per process, cost of tolerances, limit gauges (Taylor principle), measurement uncertainty and guard bands, MSA, SPC, roughness vs IT, reference temperature, drawing check
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python tol.py params` | Default input as JSON (copy → edit → `--in`) |
| `python tol.py fit H7/g6 25` | One fit: limits of hole and shaft, clearance range, type, probability of interference |
| `python tol.py run --in my.json --out res` | Full calculation → `report.md`, `fit_table.csv` (fit table for the drawing) |
| `python tol.py examples` | Report of the default case, ISO 286 check values, IT table vs formula, fit finder, ISO 2768 |
| `python tol.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python tol.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=16#mpc` | Fit calculator with zone diagram, the compressor fit table, stack-up with Monte Carlo histogram, press fit |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Size steps, standard tolerances IT1–IT16 (table and formula), fundamental deviations of shafts, hole deviations with the Δ rule, js rounding, zone parser, bearing-ring zones, general tolerances | `MAIN`, `SUB`, `IT_TABLE`, `DEV_MAIN`, `DEV_SUB`, `step()`, `it_um()`, `it_formula()`, `fund_dev_shaft()`, `js_half()`, `shaft_limits()`, `hole_limits()`, `parse_zone()`, `zone_limits()`, `BRG_BORE`, `BRG_OD`, `ISO2768`, `general_tol()` |
| 3 | Fit limits, fit type, probability of interference, preferred fits, fit finder, clearance at operating temperature | `fit()`, `fit_pair()`, `PREFERRED_FITS`, `fit_finder()`, `fit_hot()`, `fit_report()` |
| 4 | Interference fit: smoothing, Lamé pressure (hollow shaft, two materials), torque, axial force, hub stress, shrink temperature | `press_fit()`, `press_fit_check()` |
| 5 | Stack-up: worst case, RSS, modified RSS, Monte Carlo (normal / uniform), contributions, Cpk; cost-optimal allocation | `stack()`, `allocate()` |
| 6 | Position tolerance: floating / fixed fastener, MMC bonus, coordinate → position zone | `fastener()`, `bonus()`, `xy_to_position()`, `gdt_check()` |
| – | All results, report, fit table | `summary()`, `report_text()`, `run()` |
| 2–4 | Tolerance unit and IT rows, shaft and hole zone tables, Δ rule demo, js rounding, preferred fits, ISO 2768-1/-2 general tolerances, drawing notation, envelope requirement; fits by function, bearing seats (load case, P/C zones, housing zones, clearance reduction), piston designs and housing material at temperature, wear allowance, roughness vs IT, fit finder (clearance / press / shaft basis); Lamé stress field, hub materials, elastic-plastic limits, combined load, press-in, shrink and liquid-nitrogen assembly, centrifugal loosening, hub edge and fretting, redesign of the M3 seat | `tol_unit()`, `it_rows()`, `zone_table()`, `hole_table()`, `delta_rule_demo()`, `preferred_table()`, `general_geo()`, `drawing_note()`, `envelope()`, `function_table()`, `bearing_shaft_zone()`, `bearing_seat_table()`, `clearance_after_fit()`, `piston_design()`, `housing_material()`, `wear_life()`, `roughness_vs_it()`, `shaft_basis_finder()`, `lame_field()`, `hub_material_table()`, `plastic_limits()`, `combined_capacity()`, `press_in()`, `shrink_assembly()`, `loosening_speed()`, `redesign_seat()`, `HOLE_LETTERS`, `GT2768_FLAT`, `GT2768_PERP`, `GT2768_RUNOUT`, `FIT_BY_FUNCTION`, `BRG_SHAFT_FITS`, `BRG_HOUSING_FITS`, `C3_6206`, `PISTON_TYPES`, `RA_FOR_IT`, `HUB_MATERIALS`, `PF_EDGE` |
| 5–6 | Loop diagram and sign rule, unequal limits → mean ± t, worst case, RSS derivation and its assumptions, contributions, modified RSS (Bender), Monte Carlo with normal / uniform / triangular / skewed sizes and mean shifts, Cpk-based stack and the 1.5σ shift, ⟨ST⟩ symbol and its risks, nonlinear stacks with numeric sensitivities (clearance ratio, desaxé offset), 2-D loops, cost-based allocation (equal / D^(1/3) / Lagrange WC / Lagrange RSS), selective assembly of piston and cylinder, axial play of the locating bearing; tolerance characteristics, datums 3-2-1 and datum shift, MMC/LMC/RFS, bonus and virtual condition, envelope Ⓔ vs independence, floating/fixed fastener, projected zone Ⓟ, position vs ± coordinates, composite position from a CMM report, run-out of bearing seats (unbalance, ring tilt), perpendicularity of the cylinder bore, functional gauge, zero tolerance at MMC, profile tolerance, drawing summary table | `st_sym()`, `st_loop_table()`, `st_draw()`, `st_mc()`, `st_cpk_stack()`, `st_bender()`, `st_numeric_sens()`, `st_nonlinear()`, `st_clearance_ratio()`, `st_desaxe_tdc()`, `st_allocate_compare()`, `st_selective()`, `st_piston_grading()`, `st_axial_items()`, `gd_virtual()`, `gd_bonus_table()`, `gd_envelope()`, `gd_projected()`, `gd_xy_area()`, `gd_pattern_check()`, `gd_runout()`, `gd_bore_perp()`, `gd_gauge()`, `gd_zero_mmc()`, `gd_profile_check()`, `gd_datum_shift()`, `ST_CLEARANCE`, `ST_COST_B`, `ST_AXIAL`, `GD_TYPES`, `GD_PATTERN` |
| 7–8 | Process capability per process (IT, Ra, cost), process choice per IT grade, cost–tolerance models (reciprocal / exponential fit, cost per IT grade), Cp / Cpk / ppm from a sample, limit gauges (Taylor principle, gauge tolerance, wear allowance), GUM uncertainty budget and ISO 14253-1 guard band, gauge R&R (average-range method), SPC x̄–R chart (phase I / II), reference temperature 20 °C, roughness vs IT, grinding allowance after hardening, machining routes of the compressor seats, drawing check list, shrink-assembly options, worked example (gearbox intermediate shaft) and its decisions | `mf_processes_for()`, `mf_fit_cost()`, `mf_cost_per_grade()`, `mf_sample()`, `mf_capability()`, `mf_gauges()`, `mf_uncertainty()`, `mf_guard_band()`, `mf_grr_study()`, `mf_spc()`, `mf_warm_part()`, `mf_roughness()`, `mf_ra_callout()`, `mf_grind_allowance()`, `mf_routes()`, `mf_shrink_options()`, `mf_example_params()`, `mf_example_options()`, `MF_PROCESS`, `MF_COST_DATA`, `MF_GAUGE`, `MF_K`, `MF_SPC`, `MF_RA_SERIES`, `MF_ROUTES`, `MF_DRAWING_CHECK` |
Example input of chapter 8: `tools/examples/tol_example.json`.

### 0.3 What the self-test proves
1. H7/g6 at 25 mm gives +7 … +41 µm, the value printed in ISO 286-2.
2. The hole Δ rule reproduces K6 at 40 mm (+3/−13), N7 at 25 (−7/−28) and S7 at 25 (−27/−48).
3. Hole basis and shaft basis give identical fits: H7/p6 = P7/h6 (−35 … −1 µm). This is what the Δ rule was made for.
4. The IT table agrees with the formula IT = k·i, i = 0.45·D^(1/3) + 0.001·D, within the rounding of the standard (max 8.4 %).
5. js7 at 25 mm is ±10 µm (IT7 = 21 is odd and is rounded down).
6. Lamé: the radial displacements of hub and hollow shaft add up to half the effective interference (two materials).
7. Monte Carlo standard deviation = RSS/3 for normal parts and √(Σt²/3) for uniform parts.
8. The cost-optimal tolerance allocation keeps Σt = T and is cheaper than an equal split.
9. The probability of interference of a transition fit equals Φ(−mean/σ).
10. Floating fastener 8 mm bolt / 9 mm hole: position tolerance 1.0 mm; fixed fastener 0.5 mm per part.

## 1. Purpose – what a tolerance calculation must prove

No part is made exactly to size. A tolerance is the **allowed variation**. It must be **wide enough** to be cheap to
make and **narrow enough** that every combination of good parts still works. The tolerance calculation proves both.

| Proof | Question | Chapter |
|---|---|---|
| Fit | Does every hole / shaft pair give the clearance or interference the function needs – cold **and** hot? | 2, 3 |
| Joint | Does an interference fit transmit the torque at the smallest interference, and does the hub survive the largest? | 4 |
| Chain | Does the closing dimension of an assembly (gap, play, height) stay inside its limits – always (worst case) or with a known reject rate (statistics)? | 5 |
| Geometry | Are form, orientation, position and run-out limited so that parts assemble and work? | 6 |
| Manufacture and inspection | Can the process hold the tolerance (Cpk), can the gauge measure it, what does it cost? | 7 |

**Default case** (`python tol.py examples`): the M2 compressor.

| Feature | Fit | Result |
|---|---|---|
| 6206 inner ring on the crankshaft (rotating load) | bearing bore (ISO 492 normal, 0/−10) / k5 | interference 2 … 21 µm – correct for a rotating inner-ring load |
| 6206 outer ring in the crankcase | H7 / bearing OD (0/−13) | clearance 0 … 43 µm cold, but −8.7 … +34 µm hot: the floating outer ring can be clamped when the bearing is warmer than the housing |
| Aluminium piston in cast-iron cylinder | H7 / −110…−130 µm | clearance 110 … 160 µm cold → only 18 … 68 µm hot (piston 110 °C, cylinder 80 °C). The cold clearance needed to avoid seizure is larger than the 120 µm that avoids piston slap |
| Piston pin in small-end bush | H7/g6 at 18 | clearance 6 … 35 µm cold, 15 … 44 µm hot – OK |
| Crank pulley hub (keyed) | H7/k6 at 25 | transition −15 … +19 µm, interference in 31 % of the assemblies |
| Flywheel / gear press fit of M3 | H7/s6 at 30, l 16 | interference 14 … 48 µm, but after smoothing only 6.4 µm at the minimum → 42.7 N m < 107.6 N m needed (S 0.60) – redesign in chapter 4 |
| TDC gap stack of M2 (6 parts) | 0.600 mm nominal | worst case 0.400 … 0.800, RSS 0.513 … 0.687 mm – inside 0.35 … 0.90 even in the worst case; gasket and deck height give 66 % of the variation |
| Cylinder-head bolts M8, holes 9 H13 | position | floating fastener: Ø 1.00 mm at MMC (1.22 mm with bonus); with studs only Ø 0.50 mm per part |


---

## 2. The ISO system of limits and fits (ISO 286)

A drawing dimension without a tolerance cannot be made, measured or accepted. ISO 286 is the language that lets a
designer in one company and a machinist in another agree, with two characters ("H7", "k5"), on the exact range of
sizes allowed. This chapter builds that language from the bottom up and shows how `tol.py` holds it in tables.

### 2.1 GPS idea and the words of sizes

ISO 286 is part of the **Geometrical Product Specification (GPS)** system (ISO 14638 matrix). GPS says: a drawing
specifies a *feature* (a cylinder, two parallel planes) and an *operator* (how to evaluate it). For a size it means:

| Word | Meaning | Compressor example (6206 seat) |
|---|---|---|
| nominal size D | size of the ideal geometry, named on the drawing | Ø30 |
| actual (local) size | two-point size measured on the real part (ISO 14405-1 default) | 30.006 mm at one place |
| upper / lower limit of size | largest / smallest permitted size | 30.011 / 30.002 |
| upper / lower deviation | limit − nominal: shaft es / ei, hole ES / EI (French *écart supérieur / inférieur*) | +11 / +2 µm |
| tolerance T | upper − lower limit = IT value of the grade | 9 µm (IT5) |
| tolerance zone | the band between the two limits, written as **letter + number** | k5 |
| fundamental deviation | the deviation nearest to the zero line; it fixes the **position** of the zone | ei = +2 µm |

Rule of the letters: **capital letters = holes** (internal features), **small letters = shafts** (external features).
"Hole" and "shaft" mean any internal / external feature of size – a slot is a hole, a key is a shaft.

### 2.2 IT grades and the tolerance unit

The **grade** (the number) sets the *width* of the zone. ISO 286 has IT01, IT0, IT1 … IT18. Rough guide:

| Grades | Typical use |
|---|---|
| IT1–IT4 | gauges, measuring instruments, precision bearing rings |
| IT5–IT7 | fits of machine parts: bearing seats (5–6), precise holes (7) |
| IT8–IT11 | less critical fits, running fits with large clearance, drilled holes (11) |
| IT12–IT16 | free sizes, cast / forged / flame-cut parts |

Why does the width grow with the size? Two reasons, both physical. First, the error of a machine (thermal growth,
spindle deflection) grows roughly with the size. Second, and more important for small sizes, measuring and
finishing errors do **not** go to zero for a small part. Experiments in the 1920s (the ISA system) gave a law between
linear and constant: the **tolerance unit**

i = 0.45·D^(1/3) + 0.001·D   (i in µm, D in mm)

The cube root describes manufacturing and the small linear term the measuring uncertainty from temperature
(1 µm per 1000 mm). D is not the nominal size itself but the **geometric mean of its size step**, √(D_low·D_high),
so all sizes of one step get the same tolerance. From IT5 upwards each grade is a fixed multiple of i, a
geometric (Renard R5) series with ratio 10^(1/5) ≈ 1.6:

ITn = k·i, k = 7, 10, 16, 25, 40, 64, 100, 160, 250, 400, 640, 1000 for IT5 … IT16

```python
def it_formula(D, grade):
    k = {5: 7, 6: 10, 7: 16, 8: 25, 9: 40, 10: 64, 11: 100, 12: 160, 13: 250, 14: 400, 15: 640, 16: 1000}[grade]
    i = step(D)
    lo = 1.0 if i == 0 else MAIN[i - 1]                 # first step: ISO uses D = sqrt(1 x 3)
    Dm = math.sqrt(lo * MAIN[i])
    return k * (0.45 * Dm ** (1 / 3) + 0.001 * Dm)
```

The standard then **rounds** these values to "nice" numbers; the rounded table is the law, not the formula. `tol.py`
therefore stores the table (`IT_TABLE`, IT1–IT16 for the 13 main steps up to 500 mm) and uses the formula only as a
check. The step lookup:

```python
MAIN = [3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500]   # upper limits of the main size steps
def step(D, table=MAIN):
    """Index of the size step: D in (lower, upper]; 0 ... 3 mm includes 3."""
    return next(i for i, u in enumerate(table) if D <= u)
def it_um(D, grade):
    return IT_TABLE[step(D)][grade - 1]
```

Note "**over … up to and including**": Ø30 belongs to the step 18–30, Ø30.001 to 30–50. A 6206 bearing seat of 30 mm
gets the smaller tolerances of the step below. `python tol.py ch24`:

```
## 2.2 Tolerance unit and IT grades
  D   3: step mean    1.73 mm, i = 0.542 um, IT7 = 16 i =   8.7 -> table 10 um
  D  10: step mean    7.75 mm, i = 0.898 um, IT7 = 16 i =  14.4 -> table 15 um
  D  30: step mean   23.24 mm, i = 1.307 um, IT7 = 16 i =  20.9 -> table 21 um
  D  65: step mean   63.25 mm, i = 1.856 um, IT7 = 16 i =  29.7 -> table 30 um
  D 120: step mean   97.98 mm, i = 2.173 um, IT7 = 16 i =  34.8 -> table 35 um
  D 250: step mean  212.13 mm, i = 2.896 um, IT7 = 16 i =  46.3 -> table 46 um
  D 500: step mean  447.21 mm, i = 3.888 um, IT7 = 16 i =  62.2 -> table 63 um
  IT rows (um)   IT5    IT6    IT7    IT8    IT9   IT11   IT13
  D   3        4      6     10     14     25     60    140
  D  10        6      9     15     22     36     90    220
  D  30        9     13     21     33     52    130    330
  D  65       13     19     30     46     74    190    460
  D 120       15     22     35     54     87    220    540
  D 250       20     29     46     72    115    290    720
  D 500       27     40     63     97    155    400    970
```

Read it like this: going from Ø30 to Ø500 (17 × larger) the IT7 tolerance grows only 3 ×. Going one grade finer
divides the tolerance by 1.6 – and roughly doubles the machining cost (chapter 7). The largest deviation of formula
from table is at the smallest step (IT7 at Ø3: 8.7 against 10 µm) – the self-test allows 12 % and finds 8.4 % for
the steps it checks.

### 2.3 Fundamental deviations of shafts – where the zone sits

The **letter** places the zone relative to the zero line (nominal size). For shafts:

```
        +  |                                   ┌──┐ u
           |                             ┌──┐ s│  │
           |                       ┌──┐ r│  │  └──┘
           |                 ┌──┐ p│  │  └──┘
           |           ┌──┐ n│  │  └──┘            ei fixed (lower deviation)
           |     ┌──┐ m│  │  └──┘                  k ... u : shaft LARGER than nominal
  0 ───────┼─┬──┬┼──┼┬─┴──┴──────────────────────  zero line = nominal size
           | │h ││js││k                            h: es = 0;  js: symmetric
           | └──┘└──┘└──┘
        −  |  ┌──┐ g                               es fixed (upper deviation)
           |  └──┘┌──┐ f                          c ... g : shaft SMALLER than nominal
           |      └──┘ ...  e, d, c (further down)
```

- **c … h**: the *upper* deviation es is fixed (h: es = 0); the zone hangs below it. These shafts are smaller than the
  nominal size → clearance with an H hole.
- **js**: symmetric ±IT/2.
- **k … u**: the *lower* deviation ei is fixed; the zone stands on it. These shafts are larger → transition or
  interference with an H hole.

The fundamental deviation depends only on the letter and the size step (not on the grade), with one exception: k is
+0.6·D^(1/3) only for IT4–IT7 and 0 otherwise. Deviations p and below change only at the main steps; r, s, u (and
c) change at the **intermediate steps** (18–24 / 24–30 …), because large interferences must follow the size more closely.

```python
def fund_dev_shaft(D, letter, grade):
    if letter in DEV_MAIN:                       # d e f g h k m n p - main steps
        v = DEV_MAIN[letter][step(D)]
        if letter == "k" and not 4 <= grade <= 7:
            v = 0
        return v
    if letter in DEV_SUB:                        # c r s u - intermediate steps
        return DEV_SUB[letter][step(D, SUB)]

def shaft_limits(D, letter, grade):
    t = it_um(D, grade)
    if letter == "js":
        h = js_half(D, grade)
        return -h, h
    v = fund_dev_shaft(D, letter, grade)
    return (v - t, v) if letter in UPPER_LETTERS else (v, v + t)
```

All shaft zones of the program at Ø30 (`zone_table()` of the add-on):

```
## 2.3 Shaft zones at D 30 mm (um): zone  ei / es
  c6     -123 /  -110      c7     -131 /  -110
  d6      -78 /   -65      d7      -86 /   -65
  e6      -53 /   -40      e7      -61 /   -40
  f6      -33 /   -20      f7      -41 /   -20
  g6      -20 /    -7      g7      -28 /    -7
  h6      -13 /    +0      h7      -21 /    +0
  js6    -6.5 /  +6.5      js7     -10 /   +10
  k6       +2 /   +15      k7       +2 /   +23
  m6       +8 /   +21      m7       +8 /   +29
  n6      +15 /   +28      n7      +15 /   +36
  p6      +22 /   +35      p7      +22 /   +43
  r6      +28 /   +41      r7      +28 /   +49
  s6      +35 /   +48      s7      +35 /   +56
  u6      +48 /   +61      u7      +48 /   +69
```

Check the rule in the table: from grade 6 to 7 the fixed side stays (f: −20; k: +2) and only the free side moves by
IT7 − IT6 = 21 − 13 = 8 µm.

> **Limitation of the program:** the shaft letters a, b, cd, ef, fg, j, t, v, x, y, z, za, zb, zc and the j holes are
> not in the tables. In practice you need **j5 / j6 / J7** mainly for bearing seats; the add-on uses the very
> similar js zones there. Add rows to `DEV_MAIN` if you need them (check ISO 286-2).

### 2.4 Holes, hole basis and shaft basis

For holes the zone positions mirror the shafts: **A … H** lie above the zero line (EI fixed, EI = −es of the same
shaft letter), **K … U** below it (ES fixed). Two systems keep the number of tools and gauges small:

- **Hole basis** (H hole, EI = 0): the hole is always H; the fit is chosen by the shaft letter. This is normal in
  machine building, because a hole needs fixed tools (reamer, plug gauge) for each size and zone, while a shaft of any
  size is turned or ground with the same tool. All compressor fits of this guide are hole basis.
- **Shaft basis** (h shaft, es = 0): the shaft is always h – used for drawn bright bar (h9 / h11 stock), long shafts
  carrying several parts with different fits, pins, and **rolling-bearing outer rings** (the bearing OD is a
  "shaft basis" part by nature).

```
## 2.4 Hole zones at D 30 mm (um): zone  EI / ES
  C6     +110 /  +123   C7     +110 /  +131   C8     +110 /  +143
  D6      +65 /   +78   D7      +65 /   +86   D8      +65 /   +98
  E6      +40 /   +53   E7      +40 /   +61   E8      +40 /   +73
  F6      +20 /   +33   F7      +20 /   +41   F8      +20 /   +53
  G6       +7 /   +20   G7       +7 /   +28   G8       +7 /   +40
  H6       +0 /   +13   H7       +0 /   +21   H8       +0 /   +33
  JS6    -6.5 /  +6.5   JS7     -10 /   +10   JS8     -16 /   +16
  K6      -11 /    +2   K7      -15 /    +6   K8      -23 /   +10
  M6      -17 /    -4   M7      -21 /    +0   M8      -29 /    +4
  N6      -24 /   -11   N7      -28 /    -7   N8      -36 /    -3
  P6      -31 /   -18   P7      -35 /   -14   P8      -55 /   -22
  R6      -37 /   -24   R7      -41 /   -20   R8      -61 /   -28
  S6      -44 /   -31   S7      -48 /   -27   S8      -68 /   -35
  U6      -57 /   -44   U7      -61 /   -40   U8      -81 /   -48
```

### 2.5 The Δ rule – why K7 is not simply the mirror of k6

If the hole were just the mirror image of the shaft (ES = −ei, "general rule"), then the fit **H7/p6** and the fit
**P7/h6** would *not* give the same clearance limits, because the hole is one grade coarser than the shaft in both.
ISO wanted the two systems to be exchangeable: a designer may switch from hole to shaft basis without changing the
function. The fix is the **special rule** for the holes K, M, N up to IT8 and P … ZC up to IT7 (D > 3 mm):

ES = −ei + Δ,  Δ = IT(n) − IT(n−1)

Proof for H7/p6 vs P7/h6 at Ø25 (IT6 = 13, IT7 = 21, ei(p) = +22):
- H7/p6: C_max = ES_H − ei_p = 21 − 22 = −1; C_min = EI_H − es_p = 0 − 35 = −35 µm.
- P7/h6 with Δ: ES_P = −22 + (21 − 13) = −14, EI_P = −14 − 21 = −35. C_max = −14 − (−13) = −1; C_min = −35 − 0 = −35 µm. Identical.

```python
    ei = DEV_MAIN["k"][step(D)] if l == "k" else fund_dev_shaft(D, l, grade)
    delta = it_um(D, grade) - it_um(D, grade - 1) if (D > 3 and grade > 1) else 0.0
    if l in ("k", "m", "n"):
        if grade <= 8:
            ES = -ei + delta
        else:
            ES = 0.0 if l in ("k", "n") else -ei
    else:
        ES = -ei + delta if grade <= 7 else -ei
    return ES - t, ES
```

```
## 2.5 Delta rule at D 25 mm (um): zone, -ei (general rule), Delta, ES, EI
  K6   -ei   -2   Delta    4   ES    +2   EI   -11
  K7   -ei   -2   Delta    8   ES    +6   EI   -15
  K8   -ei   -2   Delta   12   ES   +10   EI   -23
  M6   -ei   -8   Delta    4   ES    -4   EI   -17
  M7   -ei   -8   Delta    8   ES    +0   EI   -21
  M8   -ei   -8   Delta   12   ES    +4   EI   -29
  N6   -ei  -15   Delta    4   ES   -11   EI   -24
  N7   -ei  -15   Delta    8   ES    -7   EI   -28
  N8   -ei  -15   Delta   12   ES    -3   EI   -36
  P6   -ei  -22   Delta    4   ES   -18   EI   -31
  P7   -ei  -22   Delta    8   ES   -14   EI   -35
  P8   -ei  -22   Delta   12   ES   -22   EI   -55
  S6   -ei  -35   Delta    4   ES   -31   EI   -44
  S7   -ei  -35   Delta    8   ES   -27   EI   -48
  S8   -ei  -35   Delta   12   ES   -35   EI   -68
```

Look at P8 and S8: above IT7 the Δ is **not** added (ES = −ei = −22 / −35). The self-test checks K6 at Ø40 (+3/−13),
N7 and S7 at Ø25 against ISO 286-2, and H7/p6 = P7/h6.

### 2.6 js and JS – the rounding rule

js / JS are symmetric: ±IT/2. If IT is an odd number of micrometres in grades 7 to 11, ISO 286-1 rounds the deviation
**down** to the next even value, so that the limits stay whole micrometres:

```python
def js_half(D, grade):
    t = it_um(D, grade)
    if 7 <= grade <= 11 and t == int(t) and int(t) % 2 == 1:   # odd IT values rounded to the lower even number
        t -= 1
    return t / 2
```

```
## 2.6 js rounding: js6/js7/js8 at 25 = +/-6.5 / +/-10 / +/-16 um (IT 13 / 21 / 33)
```

js7 at Ø25 is ±10, not ±10.5 – the zone is 1 µm narrower than IT7. In grade 6 the half-micrometre is kept (±6.5).

### 2.7 Preferred fits

Any letter can be combined with any hole, but each new combination needs new gauges and reamers. ISO 286-1 (and ANSI
B4.2) therefore recommends a short list. With hole basis the H7 hole is the workhorse; the shaft letter selects the
function:

```
## 2.7 Preferred fits at D 30 mm (um)
  H11/c11  C  +110 ...  +370  clearance
  H9/d9    C   +65 ...  +169  clearance
  H8/f7    C   +20 ...   +74  clearance
  H7/g6    C    +7 ...   +41  clearance
  H7/h6    C    +0 ...   +34  clearance
  H7/k6    C   -15 ...   +19  transition
  H7/n6    C   -28 ...    +6  transition
  H7/p6    C   -35 ...    -1  interference
  H7/s6    C   -48 ...   -14  interference
  H7/u6    C   -61 ...   -27  interference
  C11/h11  C  +110 ...  +370  clearance
  D9/h9    C   +65 ...  +169  clearance
  F8/h7    C   +20 ...   +74  clearance
  G7/h6    C    +7 ...   +41  clearance
  K7/h6    C   -15 ...   +19  transition
  N7/h6    C   -28 ...    +6  transition
  P7/h6    C   -35 ...    -1  interference
  S7/h6    C   -48 ...   -14  interference
  U7/h6    C   -61 ...   -27  interference
```

Every shaft-basis fit gives exactly the same limits as its hole-basis partner – the Δ rule at work. The clearance
C = hole − shaft: **C_max = ES − ei, C_min = EI − es** (core `fit()`); negative C is interference.

### 2.8 General tolerances – ISO 2768

Most dimensions of a part (chamfers, free lengths, outside contours) need no individual tolerance. A title-block note
"**ISO 2768-mK**" gives them all a general tolerance: **m** = medium class for linear sizes (ISO 2768-1), **K** =
class for form and position (ISO 2768-2). The principle: a dimension outside the general tolerance is rejected only
if the function is affected – the general tolerance is the workshop's *normal accuracy*, not a sharp limit.

```python
def general_tol(L, cls="m"):
    col = {"f": 1, "m": 2, "c": 3, "v": 4}[cls]
    row = next(r for r in ISO2768 if L <= r[0])
    return row[col]
```

```
## 2.8 General tolerances ISO 2768-1 (+/- mm) and ISO 2768-2 (mm)
  L    2.0: f 0.05  m 0.1  c 0.2  v None
  L    5.0: f 0.05  m 0.1  c 0.3  v 0.5
  L   25.0: f 0.1  m 0.2  c 0.5  v 1.0
  L   65.0: f 0.15  m 0.3  c 0.8  v 1.5
  L  139.2: f 0.2  m 0.5  c 1.2  v 2.5
  L  300.0: f 0.2  m 0.5  c 1.2  v 2.5
  L  800.0: f 0.3  m 0.8  c 2.0  v 4.0
  flatness of a 139 mm deck: H 0.20, K 0.40, L 0.80; perpendicularity 62 mm: K 0.40; run-out K 0.2
```

Important consequence for the compressor: the **block deck height 139.2 mm** would get ±0.5 mm from ISO 2768-m – ten
times the ±0.05 mm the TDC gap stack of chapter 5 needs. Every dimension in a functional chain needs an **individual
tolerance**. Likewise a general flatness of 0.4 mm (class K) for the 139 mm deck would ruin the gasket seal; the deck
gets an explicit flatness (e.g. 0.03 mm). The ISO 2768-2 values in `GT2768_FLAT` / `GT2768_PERP` are typical – check.

### 2.9 Writing limits on drawings – envelope requirement and ISO 14405

A size tolerance alone says nothing about **form**. Since ISO 8015 (2011) the default is the **independence
principle**: size (two-point) and form are checked separately; a bent shaft whose every local size is in tolerance is
a good shaft. For fits this is dangerous – a bent Ø30 h6 pin will not go into a Ø30 H7 hole of the same nominal
size. The remedy is the **envelope requirement Ⓔ** (ISO 14405-1): the feature must not violate the perfect-form
boundary at maximum material condition (MMC). Then the allowed form error equals the distance between the actual size
and MMC:

```python
def envelope(D, zone, actual, part="shaft"):
    lo, hi = zone_limits(D, zone, part)
    mmc = D + (hi if part == "shaft" else lo) / 1000
    return {"MMC": mmc, "form_allowed": abs(mmc - actual)}
```

```
## 2.9 Drawing notation and envelope requirement
  Ø30 k5 (+0.011 / +0.002)     limits 30.011 / 30.002
  Ø62 H7 (+0.030 / +0.000)     limits 62.030 / 62.000
  Ø18 g6 (-0.006 / -0.017)     limits 17.994 / 17.983
  Ø30 s6 (+0.048 / +0.035)     limits 30.048 / 30.035
  shaft 30 h6 (E), actual local size 30.000: MMC 30.000 -> allowed straightness of axis 0.000 mm
  shaft 30 h6 (E), actual local size 29.995: MMC 30.000 -> allowed straightness of axis 0.005 mm
  shaft 30 h6 (E), actual local size 29.987: MMC 30.000 -> allowed straightness of axis 0.013 mm
```

Drawing practice:
- Write **zone + deviations**: "Ø30 k5 (+0.011/+0.002)" – the zone tells the gauge room which gauge, the numbers save
  the machinist a table lookup. Some companies write the limits directly (30.011 / 30.002).
- Put **Ⓔ** behind every fit size (or a note "ISO 14405 Ⓔ" for all fits). The GO gauge (full form, chapter 7) checks
  the envelope; the NOT-GO gauge (two-point) checks the local size – that is exactly Taylor's principle.
- Never use **both** an individual tolerance and a general tolerance for the same size; never tolerance a dimension
  twice in a chain (closed chains – chapter 5).

## 3. Fits in function

A fit is selected from the **function**, then checked for the **real conditions**: temperature, load, wear and
roughness. The table values of chapter 2 are the 20 °C cold state on a perfect part.

### 3.1 Selection by function

```python
FIT_BY_FUNCTION = [   # class, hole basis, shaft basis, typical use
    ("loose running", "H11/c11", "C11/h11", "agricultural machines, pivots with dirt, wide temperature range"),
    ("free running", "H9/d9", "D9/h9", "large plain bearings at high speed, idler pulleys on axles"),
    ...
    ("force / shrink", "H7/u6", "U7/h6", "high torque by friction only, shrink fits"),
]
```

```
## 3.1 Fits by function at D 30 mm (um)
  loose running                   H11/c11   +110 ...  +370  | C11/h11   +110 ...  +370  agricultural machines, pivots with dirt, wide temperature range
  free running                    H9/d9      +65 ...  +169  | D9/h9      +65 ...  +169  large plain bearings at high speed, idler pulleys on axles
  close running                   H8/f7      +20 ...   +74  | F8/h7      +20 ...   +74  plain bearings of machine tools and gearboxes, pump shafts
  sliding                         H7/g6       +7 ...   +41  | G7/h6       +7 ...   +41  spigots, sliding gears, piston pins, precise guides
  locational clearance            H7/h6       +0 ...   +34  | H7/h6       +0 ...   +34  centring of covers, change gears, parts assembled by hand
  locational transition           H7/k6      -15 ...   +19  | K7/h6      -15 ...   +19  pulleys / couplings with key, bearing seats with light load
  locational transition, tighter  H7/n6      -28 ...    +6  | N7/h6      -28 ...    +6  gears and couplings with key that must not rattle
  light press                     H7/p6      -35 ...    -1  | P7/h6      -35 ...    -1  bushes, locating pins, light press fits (no torque by friction)
  medium drive                    H7/s6      -48 ...   -14  | S7/h6      -48 ...   -14  gear hubs, flywheels, bronze rims, permanent joints
  force / shrink                  H7/u6      -61 ...   -27  | U7/h6      -61 ...   -27  high torque by friction only, shrink fits
```

How to think about each class:
- **Running fits** need an oil film: minimum clearance ≈ 1 … 2 ‰ of D for plain bearings (hydrodynamics, M4) plus the
  thermal change; maximum clearance limits the noise and oil flow.
- **Location fits** centre a part. H7/h6 can be zero clearance – parts go together by hand only because form errors are
  small. H7/k6 is the classic **keyed hub**: the key carries the torque, the fit only centres and stops rattling.
- **Transition fits** are a statistical matter. `fit()` returns the probability of interference with both sizes
  normal, centred, ±3σ = tolerance:

  P(C < 0) = Φ(−μ_C / σ_C),  μ_C = mean hole − mean shaft,  σ_C = √((T_h/6)² + (T_s/6)²)

  `python tol.py fit H7/k6 25`:

  ```
  H7/k6 at 25 mm: hole +21/+0 um, shaft +15/+2 um -> C -15 ... +19 um (transition), P(interference) 31.35 %
  ```

  One pulley hub in three needs a light press; the assembly instruction must allow a soft hammer or a press. If the
  production centres the hole at its lower limit (it usually does – machinists aim for MMC), the share is higher.
- **Interference fits** transmit torque by friction – chapter 4 proves it.

### 3.2 Rolling-bearing seats

Rolling-bearing rings are thin. They must be **fixed** on the ring that sees a **rotating load** (the load direction
moves around the ring), otherwise the ring creeps, wears the seat and fretting corrosion follows. The ring with a
**stationary load** may have clearance and is normally the floating (axially free) side.

| Load case | Inner ring (shaft) | Outer ring (housing) | Compressor |
|---|---|---|---|
| shaft rotates, load direction fixed (belt pull, gas force on average) | rotating load → interference (j, k, m, n) | stationary load → clearance (H, G, J) | crankshaft, 6206 |
| housing rotates (wheel hub, idler pulley on axle) | stationary → g, h | rotating → N7, P7 | idler of M9 |

Bearing rings are **not** ISO 286 zones. The bore and outside diameter of a normal-class (P0) bearing have the upper
deviation 0 and a lower deviation from ISO 492 (`BRG_BORE`, `BRG_OD`; typical values – check). The bore is thus
"below nominal" – a k5 shaft, a transition fit in an H hole, gives a clear interference with a bearing bore. Which
shaft zone? It depends on the load ratio P/C (equivalent load / dynamic capacity) and the diameter (maker's table,
`BRG_SHAFT_FITS`, check):

```python
def bearing_shaft_zone(d, P_over_C):
    rows = next(r for lim, r in BRG_SHAFT_FITS if P_over_C <= lim)
    return next((z for u, z in rows if d <= u), rows[-1][1])
```

```
## 3.2 Bearing seat 6206 (d 30): shaft zone by load P/C, interference min / max (um)
  P/C 0.03 -> js6  interference  -6.5 ... +16.5
  P/C 0.08 -> k5   interference    +2 ...   +21
  P/C 0.15 -> m5   interference    +8 ...   +27
  housing stationary outer ring, normal                      H7  C    +0 ...   +43  floating bearing can slide axially
  housing stationary outer ring, heat flow through the shaft G7  C   +10 ...   +53  keeps the floating function when the ring is warmer
  housing stationary outer ring, accurate running            JS7 C   -15 ...   +28  less clearance (makers write J7), may still slide
  housing rotating outer ring load (e.g. wheel hub, idler)   N7  C   -39 ...    +4  outer ring must not creep
  housing rotating outer ring, heavy / thin housing          P7  C   -51 ...    -8  high interference
  k5 fit: clearance reduction 0.0 ... 13.6 um -> C3 13...28 becomes -0.6 ... 28.0 um (before thermal effect, see M4)
```

The 6206 of M4 runs at P/C ≈ 0.08 (normal load) → **k5** is right: 2 … 21 µm interference (default fit 1 of tol.py).

**Interference eats internal clearance.** The pressed inner ring expands. With smoothing and the thin-ring factor
d/F (F = inner raceway diameter ≈ 36.5 mm for the 6206, M4 ch. 7):

Δ_clearance ≈ 0.9 · U_w · d / F

```python
def clearance_after_fit(U_min, U_max, d=30.0, F_race=36.5, Rz_shaft=3.2, C=C3_6206):
    red = [0.9 * max(0.0, U - 0.8 * Rz_shaft) * d / F_race for U in (U_min, U_max)]
    return {"red_min": red[0], "red_max": red[1], "C_min": C[0] - red[1], "C_max": C[1] - red[0]}
```

At the largest interference the C3 clearance can drop to −0.6 µm – **before** the inner ring gets warmer than the
outer ring. That is why M4 chose **C3** (normal clearance CN would be preloaded) and why the bearing seat must not
be ground to the upper limit "for safety".

### 3.3 Temperature – the fit you assemble is not the fit that runs

Each part grows by α·D·ΔT. The change of clearance (core `fit_hot()`):

ΔC = D·(α_hole·(T_hole − 20) − α_shaft·(T_shaft − 20))

```python
def fit_hot(F, alpha_h, alpha_s, T_h, T_s, T_ref=20.0):
    dC = F["D"] * 1000 * (alpha_h * (T_h - T_ref) - alpha_s * (T_s - T_ref))
    return {"dC": dC, "C_min_hot": F["C_min"] + dC, "C_max_hot": F["C_max"] + dC}
```

Two cases of the compressor show both directions.

**Aluminium piston in a cast-iron cylinder.** The piston skirt (110 °C) grows twice as much per kelvin as the cylinder
(80 °C). The default report shows a cold clearance of 110 … 160 µm shrinking to 18 … 68 µm hot. With a required hot
minimum of 10 µm and a tolerance band of 50 µm (H7 = 30 µm + piston grading 20 µm), the needed cold clearance depends
on the piston design:

```python
def piston_design(D=65.0, T_cyl=80.0, T_pis=110.0, alpha_cyl=11.0e-6, C_hot_min=10.0, band=50.0, C_cold_max=120.0):
    for name, a in PISTON_TYPES:
        dC = D * 1000 * (alpha_cyl * (T_cyl - 20) - a * (T_pis - 20))
        cmin = C_hot_min - dC
        out.append((name, a, dC, cmin, cmin + band, cmin + band <= C_cold_max))
```

```
## 3.3 Temperature: piston designs (D 65, cylinder 80 C, skirt 110 C, hot clearance >= 10 um, band 50 um)
  plain Al-Si piston (default)                                   alpha 23.0e-6: change  -91.6 um -> cold 101.6 ... 151.6 um too loose cold (> 120)
  Al-Si piston with steel struts (autothermic)                   alpha 17.5e-6: change  -59.5 um -> cold  69.5 ... 119.5 um OK (<= 120)
  Al-Si piston, steel ring carrier + struts, hyper-eutectic alloy alpha 16.0e-6: change  -50.7 um -> cold  60.7 ... 110.7 um OK (<= 120)
  grey cast-iron piston                                          alpha 11.0e-6: change  -21.4 um -> cold  31.4 ...  81.5 um OK (<= 120)
```

Conclusion: a plain aluminium piston cannot meet both limits with a 50 µm band – it slaps when cold or seizes when
hot. Real compressor pistons solve it with **steel struts** cast into the skirt (effective α ≈ 17.5·10⁻⁶ – check
maker), an **oval, barrel-shaped skirt** (cam-ground; the clearance is measured at one defined height), or **grading**:
pistons and bores are sorted in 10 µm classes and paired (selective assembly, chapter 5), which halves the band.
For the VC compressor: strut piston, cold clearance 70 … 120 µm, measured 15 mm above the skirt bottom
across the thrust side.

**Outer ring in a cast-iron vs an aluminium housing.** The bearing ring (80 °C) is warmer than the housing (70 °C):

```
  6206 outer ring D 62 (ring 80 C, housing 70 C): zone  cold C | cast iron hot | aluminium hot (um)
  G7    +10 ...   +53 |   +1.3 ...  +44.3 |  +38.5 ...  +81.5
  H7     +0 ...   +43 |   -8.7 ...  +34.3 |  +28.5 ...  +71.5
  JS7   -15 ...   +28 |  -23.7 ...  +19.3 |  +13.5 ...  +56.5
  K7    -21 ...   +22 |  -29.7 ...  +13.3 |   +7.5 ...  +50.5
  M7    -30 ...   +13 |  -38.7 ...   +4.3 |   -1.5 ...  +41.5
```

- In **cast iron** the floating bearing in H7 can be clamped hot (−8.7 µm) – it cannot slide to take the crankshaft
  growth, an axial force builds up. Fix: **G7** for the floating bearing (+1.3 µm minimum hot). This is a finding
  for the default design.
- In **aluminium** the housing runs away from the ring: H7 becomes 28 … 72 µm, the ring creeps. Aluminium housings
  need **K7 / M7** (or a steel sleeve, or an O-ring in a groove to stop creep). Choose the fit at operating
  temperature, then check the cold state for assembly.

### 3.4 Wear allowance

A running fit opens up as both parts wear. If the function limit (noise, oil leakage, knocking) is C_limit, the
life is set by the largest new clearance:

life = (C_limit − C_max,new) / wear rate

```python
def wear_life(D=30.0, pair="H8/f7", C_limit=120.0, wear_um_per_1000h=4.0):
    F = fit(D, *pair.split("/"))
    return {"C_max": F["C_max"], "C_min": F["C_min"], "h_worst": 1000 * (C_limit - F["C_max"]) / wear_um_per_1000h,
            "h_best": 1000 * (C_limit - F["C_min"]) / wear_um_per_1000h}
```

```
## 3.4 Wear allowance: H8/f7 at 30 (C +20 ... +74 um), limit 120 um, wear 4 um / 1000 h -> life 11500 ... 25000 h
```

The tolerance itself costs life: an H8/f7 pair built at C_max lasts less than half as long as one built at C_min.
Choosing H7/f6 (20 … 54 µm) would raise the worst-case life to 16 500 h. The wear rate is an example – measure it.

### 3.5 Roughness and fits

A tolerance of a few micrometres makes no sense on a surface whose peaks are as high as the tolerance. Rules of thumb
(typical, check company standard): Rz ≈ 4 … 6·Ra; Rz should not exceed about 20 … 25 % of IT.

```
## 3.5 Roughness vs IT at D 30: grade, IT um, Ra um, Rz ~ 5 Ra, Rz as % of IT
  IT5      9  Ra  0.2  Rz   1.0   11.1 %
  IT6     13  Ra  0.4  Rz   2.0   15.4 %
  IT7     21  Ra  0.8  Rz   4.0   19.0 %
  IT8     33  Ra  1.6  Rz   8.0   24.2 %
  IT9     52  Ra  3.2  Rz  16.0   30.8 %
  IT10    84  Ra  3.2  Rz  16.0   19.0 %
  IT11   130  Ra  6.3  Rz  31.5   24.2 %
```

For running fits the peaks wear off in the first hours (run-in) and the clearance grows by about Rz of both parts. For
interference fits they are **flattened on assembly** – DIN 7190 subtracts 0.8·(Rz_shaft + Rz_hub) from the measured
interference (chapter 4). With the M3 roughness (Rz 3.2 / 6.3) that is 7.6 µm – more than half of the 14 µm minimum
interference of H7/s6.

### 3.6 Fit finder – from the required clearance to the fit

Instead of trying fits by hand, give the range the function needs and let `fit_finder()` list all hole-basis fits
whose clearance lies completely inside it (preferred fits first, then the widest = cheapest fit tolerance):

```python
def fit_finder(D, c_lo, c_hi, holes=("H6", "H7", "H8", "H9", "H11"), grades=range(5, 12)):
    for h in holes:
        gh = parse_zone(h)[1]
        for L in SHAFT_LETTERS:
            for g in grades:
                if not gh - 2 <= g <= gh:                  # shaft same grade as the hole or up to 2 grades finer
                    continue
                F = fit(D, h, "%s%d" % (L, g))
                if F["C_min"] >= c_lo and F["C_max"] <= c_hi:
                    ...
```

The add-on gives the same for shaft basis (`shaft_basis_finder()`). For a press fit, give negative limits:

```
## 3.6 Fit finder
  hole basis d 30, running clearance 20 ... 80 um:
    H8/f7     C   +20 ...   +74  (preferred)
    H8/f6     C   +20 ...   +66
    H7/f7     C   +20 ...   +62
    H7/e6     C   +40 ...   +74
    H7/f6     C   +20 ...   +54
    H7/e5     C   +40 ...   +70
  hole basis d 30, press fit interference 20 ... 80 um (C -80 ... -20):
    H7/u6     C   -61 ...   -27  (preferred)
    H7/u7     C   -69 ...   -27
    H7/u5     C   -57 ...   -27
    H6/s6     C   -48 ...   -22
    H6/u6     C   -61 ...   -35
    H6/s5     C   -44 ...   -22
  shaft basis d 30, clearance 20 ... 80 um:
    F8/h7     C   +20 ...   +74
    F8/h6     C   +20 ...   +66
    F7/h7     C   +20 ...   +62
    E7/h6     C   +40 ...   +74
    F7/h6     C   +20 ...   +54
    E7/h5     C   +40 ...   +70
```

How to read: for a running fit of 20 … 80 µm take the preferred **H8/f7** – the cheapest (widest, 54 µm fit
tolerance) and stocked in every workshop. For 20 … 80 µm interference the finder proposes **H7/u6**; H6/s6 also
works but needs an H6 hole (honing, chapter 7). The required range itself must come from function: oil film and
thermal change (running fits), chapter 4 (press fits).

## 4. Interference fits (DIN 7190 style)

An interference fit transmits torque and axial force **by friction only** – no key, no notch from a keyway, no
backlash. It is the joint of gear hubs, flywheels, bronze worm-wheel rims (M5c) and bearing rings. The proof has two
sides: at the **smallest** interference it must not slip; at the **largest** it must not overstress the hub, and it
must still be possible to assemble.

### 4.1 Lamé thick-walled cylinders

Hub (inner radius a = d/2, outer b = D_hub/2) and shaft (outer a, bore c = d_i/2) are thick cylinders under the joint
pressure p. With plane stress, the radial and hoop stresses in the hub are (Lamé 1852):

σ_r(r) = −p·a²/(b² − a²)·(b²/r² − 1),  σ_t(r) = +p·a²/(b² − a²)·(b²/r² + 1)

At the bore (r = a) the hub sees σ_r = −p and the largest hoop stress σ_t = p·(1 + Q_h²)/(1 − Q_h²), Q_h = d/D_hub.
The radial displacement of the hub bore and of the shaft surface follow from Hooke's law (σ_t − ν·σ_r)/E. Their
difference must equal half the effective diametral interference U_w:

u_hub − u_shaft = U_w / 2

Solving for p gives the core formula (with Q_s = d_i/d for a hollow shaft and two materials):

p = U_w / ( d · [ (1/E_h)·((1 + Q_h²)/(1 − Q_h²) + ν_h) + (1/E_s)·((1 + Q_s²)/(1 − Q_s²) − ν_s) ] )

```python
def press_fit(pf, U_um):
    d, D, di = pf["d"], pf["D_hub"], pf["di_shaft"]
    Qh, Qs = d / D, di / d
    Uw = max(0.0, U_um - 0.8 * (pf["Rz_shaft"] + pf["Rz_hub"]))
    K = (1 / pf["E_hub"]) * ((1 + Qh ** 2) / (1 - Qh ** 2) + pf["nu_hub"]) + (1 / pf["E_shaft"]) * ((1 + Qs ** 2) / (1 - Qs ** 2) - pf["nu_shaft"])
    p = Uw / 1000 / (d * K)
    A = math.pi * d * pf["l"]
    T = p * A * pf["mu"] * d / 2 / 1000
    sig_v = p * math.sqrt(3 + Qh ** 4) / (1 - Qh ** 2)
    return {"U": U_um, "U_w": Uw, "p": p, "T_Nm": T, "F_ax_N": p * A * pf["mu"], "sig_v_hub": sig_v, ...}
```

The self-test computes both displacements independently (hollow shaft d_i 10 mm, hub E 120 000 MPa) and finds
u_hub − u_shaft = U_w/2 exactly – the Lamé solution is consistent. A **hollow shaft** (Q_s > 0) is softer: the same
interference gives less pressure, and the shaft bore sees a hoop stress −2p·a²/(a² − c²).

### 4.2 Stress field in the default seat

The M3 seat (Ø30 H7/s6, hub D 55, l 16, steel) at the largest interference:

```
## 4.2 Lame stress field, H7/s6 d 30 / D 55 at U_max 48 um (p 99.3 MPa)
  hub r 15.00 mm: sigma_r   -99.3, sigma_t  +183.5 MPa
  hub r 18.12 mm: sigma_r   -54.8, sigma_t  +138.9 MPa
  hub r 21.25 mm: sigma_r   -28.4, sigma_t  +112.5 MPa
  hub r 24.38 mm: sigma_r   -11.5, sigma_t   +95.6 MPa
  hub r 27.50 mm: sigma_r    -0.0, sigma_t   +84.1 MPa
  solid shaft: sigma_r = sigma_t = -99.3 MPa
```

The hub is critical at its bore, where hoop tension and radial compression act together (plane stress,
σ_t = 183.5 MPa, σ_r = −p = −99.3 MPa). The core uses the exact von Mises value
σ_v = √(σ_t² − σ_t·σ_r + σ_r²) = p·√(3 + Q_h⁴)/(1 − Q_h²) = 248 MPa. The common shortcut √3·p/(1 − Q_h²) = 245 MPa
is 1.4 % lower here and up to 15 % lower for thin hubs (Q_h → 1: 2/√3), so it is not conservative and the program
does not use it. DIN 7190 uses the Tresca value 2p/(1 − Q_h²) = 284 MPa, which is more conservative. The solid shaft
is under uniform compression (σ_r = σ_t = −p) and is never critical.

### 4.3 Hub material

The same interference gives very different joints in different hub materials. E enters the pressure (a softer hub
gives less pressure), the permissible stress enters the hub safety:

```python
HUB_MATERIALS = {   # E MPa, nu, permissible stress MPa (Re for ductile, Rm/2 for grey iron - check), alpha 1/K
    "steel C45 (QT)": (210000.0, 0.30, 490.0, 11.0e-6),
    "steel 42CrMo4 (QT)": (210000.0, 0.30, 750.0, 11.0e-6),
    "ductile iron EN-GJS-400": (169000.0, 0.275, 250.0, 10.5e-6),
    "grey iron EN-GJL-250": (110000.0, 0.26, 125.0, 10.0e-6),
    "aluminium EN AW-6082 T6": (70000.0, 0.33, 250.0, 23.0e-6),
}
```

```
## 4.3 Hub material (same seat H7/s6, d 30, D 55, l 16): p min / max MPa, T_min N m, S_slip, sigma_v MPa, S_hub
  steel C45 (QT)             p  15.7 /   99.3  T  42.7  S_slip 0.60  sigma_v   248  S_hub 1.97
  steel 42CrMo4 (QT)         p  15.7 /   99.3  T  42.7  S_slip 0.60  sigma_v   248  S_hub 3.02
  ductile iron EN-GJS-400    p  13.4 /   84.7  T  36.4  S_slip 0.51  sigma_v   212  S_hub 1.18
  grey iron EN-GJL-250       p   9.5 /   59.9  T  25.7  S_slip 0.36  sigma_v   150  S_hub 0.83
  aluminium EN AW-6082 T6    p   6.2 /   39.1  T  16.8  S_slip 0.23  sigma_v    98  S_hub 2.56
```

- A **grey-iron** flywheel (the usual material for a compressor flywheel!) is the worst choice for a press fit: low E,
  brittle (no yield – use Rm/2 or less), hub safety 0.83 at the largest interference → cracks at the hub bore. A
  grey-iron flywheel needs a **key or a taper bush**, not a press fit.
- **Aluminium** needs about 3 × the interference of steel for the same pressure, and it loses the fit when warm
  (α 23·10⁻⁶ – check the hot state with `fit_hot()`).
- Steel and ductile iron are the materials for press-fit hubs.

### 4.4 Elastic-plastic hubs

DIN 7190-1 allows the hub to yield partly (elastic-plastic design): more pressure from the same interference
scatter, because the plastic zone limits the pressure. Two limits bracket the design:

p_el = Re·(1 − Q²)/√3 (yield starts at the bore),  p_pl = (2·Re/√3)·ln(1/Q) (whole hub plastic)

```python
def plastic_limits(pf=None):
    Q = pf["d"] / pf["D_hub"]
    Re = pf["Re_hub"]
    return {"Q": Q, "p_el": Re * (1 - Q * Q) / math.sqrt(3), "p_pl": 2 * Re / math.sqrt(3) * math.log(1 / Q)}
```

```
## 4.4 Plastic limits of the steel hub (Q 0.545, Re 600): yield onset p_el 243 MPa, fully plastic 420 MPa (actual p_max 99.3)
```

The default seat stays far in the elastic range (99 MPa against 243 MPa) – there is room to increase the interference.
An elastic-plastic design must never reach p_pl, and it is only allowed for ductile hubs that see no fatigue at the
bore. Not for grey iron.

### 4.5 Torque, axial force and combined load

At the smallest interference the friction force μ·p·π·d·l must carry the torque (as a circumferential force 2T/d)
and any axial force together – they share the same friction:

√((2T/d)² + F_ax²) ≤ μ·p_min·π·d·l / S

```python
def combined_capacity(pf, U_um, T_Nm, F_ax_N):
    r = press_fit(pf, U_um)
    cap = pf["mu"] * r["p"] * math.pi * pf["d"] * pf["l"]
    need = math.hypot(2 * T_Nm * 1000 / pf["d"], F_ax_N)
    return {"capacity_N": cap, "need_N": need, "S": cap / need}
```

```
## 4.5 Combined load at U_min: T 71.7 N m + F_ax 2 kN -> need 5182 N, capacity 2847 N, S 0.55
```

The friction coefficient μ is the largest uncertainty: 0.07 … 0.12 for longitudinal press fits (oiled), 0.12 … 0.18
for shrink fits (dry, degreased), up to 0.3 with special coatings or corundum dust in the joint (typical, check
DIN 7190-1 table). The core uses μ = 0.12. Halving μ halves the torque – never design a press fit to S < 1.5.

### 4.6 Assembly: press-in, shrink, cooling, centrifugal loosening

**Press-in (longitudinal fit).** The press force is the friction force at U_max with the press-in friction (oiled,
μ ≈ 0.08): F = p_max·π·d·l·μ_e. Press slowly (≤ 2 mm/s), oil both parts, chamfer the shaft 5 … 15° so that the
peaks are not sheared off. Pressing reduces the effective interference more than shrinking (the peaks are torn,
not flattened) – shrink fits are the better joint.

**Shrink (transverse fit).** Heat the hub until the bore is larger than the shaft by an assembly clearance
(≈ 0.001·d):

ΔT = (U_max + 0.001·d) / (α_hub·d)

**Cooling.** Cooling the shaft in liquid nitrogen (−196 °C, mean α ≈ 8.5·10⁻⁶ between −196 and 20 °C – check) gives
a shrinkage α·d·216 K and needs a much lower hub temperature, or none.

```python
def shrink_assembly(pf, U_max_um, T_room=20.0, alpha_cold=8.5e-6, T_ln2=-196.0, T_hub_max=250.0):
    need = U_max_um / 1000 + 0.001 * pf["d"]
    dT_hub = need / (pf["alpha_hub"] * pf["d"])
    shrink_shaft = alpha_cold * pf["d"] * (T_room - T_ln2)
    dT_rest = max(0.0, need - shrink_shaft) / (pf["alpha_hub"] * pf["d"])
```

**Centrifugal loosening.** A rotating hub grows more than the shaft (it is a disk with a hole). The loss of diametral
interference is 2·(u_hub − u_shaft) with u_hub = ρω²a·((3 + ν)·b² + (1 − ν)·a²)/(4E) and, for a solid shaft,
u_shaft = (1 − ν)·ρω²a³/(4E). Setting the loss equal to U_w,min gives the loosening speed:

```
## 4.6 Assembly
  press-in force (oiled, mu 0.08): 12.0 kN at U_max; with mu 0.12 (core): 18.0 kN
  shrink: need 0.078 mm -> heat hub by 236 K to 256 C (too hot); shaft in liquid nitrogen shrinks 0.055 mm -> hub heating 69 K
  centrifugal loosening at U_w,min 6.4 um: n 28881 rpm; interference lost at 1450 rpm 0.016 um
```

- Shrinking the default seat needs a hub at 256 °C – above the 250 °C that a workshop oven or induction heater does
  without discolouring or tempering effects on hardened hubs (limit typical – check the hub heat treatment; QT steel
  tempered at ≥ 550 °C tolerates 300 °C). With the shaft in liquid nitrogen 89 °C is enough.
- At 1450 rpm centrifugal loosening is negligible (0.016 µm); it matters for fast rotors (turbo compressors, spindles,
  > 10 000 rpm with large hubs).

### 4.7 Hub edge, fretting and fatigue of the shaft

The pressure is not uniform along the seat: at the hub edges it peaks (stiff hub wall ends abruptly) and micro-slip
under rotating bending causes **fretting corrosion** (red-brown oxide, "fretting rust") and fatigue cracks in the
shaft just inside the hub edge. DIN 743 gives notch factors for press fits (M3 ch. 5). Design measures:

```
## 4.7 Hub edge and fretting
  plain press fit, sharp hub edge                                      beta_sigma ~ 2.2 ... 2.8
  hub edge chamfered / rounded, hub wall thinned at the end            beta_sigma ~ 1.8 ... 2.2
  shaft seat raised 5 ... 10 % with a rounded shoulder (relief groove) beta_sigma ~ 1.4 ... 1.7
  seat rolled (deep rolling) or nitrided                               beta_sigma reduced ~ 30 %, fretting resistance up
  molybdenum / anti-fretting coating, l/d >= 0.5                       less micro-slip at the edges, fretting corrosion delayed
```

(Values typical – check DIN 743-2 / FKM for the real geometry.) A short seat (l/d = 0.53 in M3) is more sensitive to
tilting and edge slip than l/d ≈ 0.8 … 1.0.

### 4.8 Redesign of the M3 seat

The default joint fails: at U_min = 14 µm only 6.4 µm remain after smoothing, the joint carries 42.7 N m against
1.5 × 71.7 = 107.6 N m (S 0.60). Four levers act on the smallest torque: the **fit** (more interference), the **seat
length** (linear in T), the **roughness** (less smoothing loss) and the **hub diameter** (stiffer hub, more pressure).
`redesign_seat()` searches all combinations and applies three conditions: S_slip ≥ 1.5 at U_min, S_hub ≥ 1.2 at U_max,
hub heating ≤ 300 °C:

```python
def redesign_seat(pf=None, fits=("H7/r6", "H7/s6", "H7/u6"), lengths=(16.0, 20.0, 25.0, 30.0),
                  rz=((3.2, 6.3), (1.6, 3.2), (0.8, 1.6)), hubs=(55.0, 65.0), T_hub_max=300.0):
    for f in fits:
        for l in lengths:
            for rs, rh in rz:
                for D in hubs:
                    q = dict(pf, fit=f, l=l, Rz_shaft=rs, Rz_hub=rh, D_hub=D)
                    c = press_fit_check(q)
                    T_hub = 20 + c["dT_shrink"]
                    ok = c["S_slip"] >= pf["S_slip"] and c["hi"]["S_hub"] >= pf["S_hub"] and T_hub <= T_hub_max
```

```
## 4.8 Redesign of the M3 seat (T_req 71.7 N m, S_slip >= 1.5, S_hub >= 1.2, hub heated to <= 300 C)
  H7/r6  l   16 Rz 3.2/6.3 D 55: U   7... 41 um, T_min    0.0 N m, S_slip 0.00, S_hub 2.92, hub 235 C, F 14.9 kN 
  H7/r6  l   16 Rz 0.8/1.6 D 55: U   7... 41 um, T_min   33.9 N m, S_slip 0.47, S_hub 2.50, hub 235 C, F 17.4 kN 
  H7/r6  l   30 Rz 0.8/1.6 D 55: U   7... 41 um, T_min   63.6 N m, S_slip 0.89, S_hub 2.50, hub 235 C, F 32.6 kN 
  H7/s6  l   16 Rz 3.2/6.3 D 55: U  14... 48 um, T_min   42.7 N m, S_slip 0.60, S_hub 2.41, hub 256 C, F 18.0 kN 
  H7/s6  l   16 Rz 0.8/1.6 D 55: U  14... 48 um, T_min   80.6 N m, S_slip 1.12, S_hub 2.12, hub 256 C, F 20.5 kN 
  H7/s6  l   20 Rz 0.8/1.6 D 55: U  14... 48 um, T_min  100.8 N m, S_slip 1.41, S_hub 2.12, hub 256 C, F 25.6 kN 
  H7/s6  l   25 Rz 3.2/6.3 D 55: U  14... 48 um, T_min   66.7 N m, S_slip 0.93, S_hub 2.41, hub 256 C, F 28.1 kN 
  H7/s6  l   25 Rz 0.8/1.6 D 55: U  14... 48 um, T_min  126.0 N m, S_slip 1.76, S_hub 2.12, hub 256 C, F 32.0 kN OK
  H7/s6  l   30 Rz 0.8/1.6 D 55: U  14... 48 um, T_min  151.2 N m, S_slip 2.11, S_hub 2.12, hub 256 C, F 38.4 kN OK
  H7/u6  l   16 Rz 3.2/6.3 D 55: U  27... 61 um, T_min  129.5 N m, S_slip 1.81, S_hub 1.83, hub 296 C, F 23.8 kN OK
  H7/u6  l   16 Rz 0.8/1.6 D 55: U  27... 61 um, T_min  167.4 N m, S_slip 2.33, S_hub 1.65, hub 296 C, F 26.3 kN OK
  H7/u6  l   20 Rz 3.2/6.3 D 55: U  27... 61 um, T_min  161.8 N m, S_slip 2.26, S_hub 1.83, hub 296 C, F 29.7 kN OK
  ...
  passing designs: 32 of 72; shortest seat: H7/u6, l 16, Rz 3.2/6.3, hub D 55: S_slip 1.81, S_hub 1.83, hub 296 C
    pass: H7/s6  l   20 Rz 0.8/1.6 D 65: S_slip 1.57, S_hub 2.13, hub 256 C, F 28.7 kN
    pass: H7/s6  l   25 Rz 1.6/3.2 D 65: S_slip 1.66, S_hub 2.22, hub 256 C, F 34.4 kN
    pass: H7/s6  l   25 Rz 0.8/1.6 D 55: S_slip 1.76, S_hub 2.12, hub 256 C, F 32.0 kN
    ...
    pass: H7/u6  l   16 Rz 3.2/6.3 D 55: S_slip 1.81, S_hub 1.83, hub 296 C, F 23.8 kN
  recommended assembly of H7/u6: hub alone 296 C, or shaft in liquid nitrogen + hub 129 C
```

(Lines marked "…" are left out here; `python tol.py ch24` prints all of them.)

What the search teaches:
- **r6 is useless with turned surfaces**: smoothing (7.6 µm) eats the whole minimum interference of 7 µm – zero
  torque at U_min. A press fit with a small minimum interference must have ground surfaces.
- **Roughness is as strong as the fit:** H7/s6 with a ground shaft and a fine-bored hub (Rz 0.8 / 1.6) at l 25 passes
  (S 1.76) – the same fit that fails at Rz 3.2 / 6.3.
- **Length is linear, the fit is more than linear**: u6 instead of s6 doubles the effective minimum interference
  (19.4 against 6.4 µm → 3 ×).

**Recommendation for the M3 seat:** keep the shaft length (l = 16) and the hub (D 55, steel QT, Re ≥ 600) and change
the fit to **Ø30 H7/u6 Ⓔ**, Rz 3.2 shaft / 6.3 hub: S_slip 1.81, S_hub 1.83. Assemble by **cooling the shaft in
liquid nitrogen and heating the hub to about 130 °C** (hub alone would need 296 °C). If cryogenic assembly is not
available: **H7/s6 with a ground seat Rz 0.8 / fine-bored hub Rz 1.6 and l = 25 mm** (S 1.76, hub 256 °C) – this costs
9 mm of shaft length and a grinding operation. Both variants must be fed back to M3 (shaft length / notch factor) and
are given as "check" until μ is confirmed for the real surfaces.


---

## 5. Tolerance stack-up: chains and loops, worst case, RSS, Monte Carlo, process shift, Cpk, nonlinear stacks, allocation, selective assembly

A single fit has two parts. Most functional dimensions of a machine have many: the gap between the piston and the valve
plate at top dead centre (TDC), the axial play of a bearing, the height of a stack of plates, the backlash of a gear
pair. Every part adds its own variation. The **stack-up** (tolerance chain) answers two questions:

1. **Analysis:** with the tolerances on the drawings, where does the closing dimension lie – always (worst case), or in
   99.73 % of the assemblies (statistics)?
2. **Synthesis:** the closing dimension must stay inside given limits – how should its tolerance be split among the parts
   so that the parts are as cheap as possible?

`python tol.py ch56` prints all results of this chapter. The core functions are `stack()` and `allocate()` (chapter 0
map), the extra functions are in the add-on of chapter 5.

### 5.1 The loop diagram and the sign rule

**Method (the "loop" or "vector chain"):**

1. Name the **closing dimension** G – the one that is not made directly but results from assembly (here the TDC gap).
2. Start at one end of G and walk through the parts, along the dimensions that touch each other, back to the other end
   of G. Draw every dimension as an arrow.
3. An arrow that points in the **same direction** as the positive direction of G gets the sign **+1** (making it longer
   makes G longer). An arrow in the opposite direction gets **−1**.
4. G = Σ sᵢ·xᵢ. Only dimensions in the loop count. A dimension that is not in the loop has no influence – this is the
   most useful result of drawing the loop: it shows which tolerances you can open up.

For the TDC gap of the M2 compressor the loop runs: crank axis → (block deck height, +) → deck face → (gasket, +) →
valve plate underside = top of G → back down: piston crown → (compression height, −) → piston pin → (rod centre
distance, −) → crank pin → (crank radius, −) → crank axis. The clearances in the pin and crank-pin bearings also sit in
the loop. At TDC they are pushed out or pulled in by gas and inertia forces, so they are taken as 0 ± 0.02 mm.

```
         valve plate  ───────────────  ▲
                       G (TDC gap)      │ + gasket 0.80
         piston crown ─────────  ▲      ▼ deck face ─────
                                 │ − compression height 26.40
                       pin  ●────┘
                                 │ − rod 90.00
                  crank pin ●────┘                     + deck height 139.20
                                 │ − crank radius 23.00
                 crank axis ⊕────┘──────────────────────┘
```

The add-on prints the loop as a table. Each line shows the range the item adds to G:

```python
def st_loop_table(st):
    """Loop table: sign, nominal, +/- t, min and max contribution to the closing dimension."""
    rows = []
    for n, s, x, t in st["items"]:
        rows.append((n, s, x, t, s * x - t, s * x + t))
    return rows
```

```
## 5.1 Loop table of the TDC gap (mm)
  + block deck height (crank axis -> deck)      139.200 +/- 0.050   contributes  +139.150 ...  +139.250
  + gasket thickness (compressed)                 0.800 +/- 0.050   contributes    +0.750 ...    +0.850
  - crank radius                                 23.000 +/- 0.020   contributes   -23.020 ...   -22.980
  - rod centre distance                          90.000 +/- 0.030   contributes   -90.030 ...   -89.970
  - piston compression height                    26.400 +/- 0.030   contributes   -26.430 ...   -26.370
  - bearing clearances (pin + crank pin)          0.000 +/- 0.020   contributes    -0.020 ...    +0.020
  closing dimension G = 0.600 mm; WC +/- 0.200; RSS +/- 0.0872; ratio RSS / WC 0.44
```

Check by hand: 139.20 + 0.80 − 23.00 − 90.00 − 26.40 − 0 = 0.600 mm.

**Unequal limits.** Drawings often give limits such as 16 0/−0.12 (bearing width) or 2.0 0/−0.06 (circlip). A stack
calculation needs each size as **mean ± half tolerance**: 16 0/−0.12 → 15.94 ± 0.06. Using the nominal 16.00 with
±0.12 would put the mean in the wrong place and double the tolerance. Use `st_sym()` for this:

```python
def st_sym(nominal, lo, hi):
    """Unequal limits nominal +hi/+lo -> mean size and symmetric +/- t (stack calculations use mean +/- t)."""
    return nominal + (lo + hi) / 2, (hi - lo) / 2
```

### 5.2 Worst case (arithmetic) stack

If every part may lie anywhere inside its tolerance, the extreme assemblies are:

  G_max = Σ sᵢ·xᵢ + Σ tᵢ,   G_min = Σ sᵢ·xᵢ − Σ tᵢ   →   T_WC = Σ tᵢ

The worst case is **certain**: no assembly of good parts can be outside. It is the right method when:

- there are only 2–4 parts in the loop;
- a failure is dangerous or very expensive (a piston that hits the valve plate destroys the compressor);
- the quantity is small (a statistical argument needs many parts);
- the parts come from few batches, so their errors are **correlated** (one setting of the machine makes all parts
  of a batch too large).

Its weakness: it assumes that all parts are at the unfavourable limit **at the same time**. With six parts the
probability of that is practically zero, so the worst case forces tolerances that are tighter, and dearer, than needed.

The core function computes it in one line (`wc = sum(t for *_, t in it)`). TDC gap: T_WC = 0.05 + 0.05 + 0.02 + 0.03 +
0.03 + 0.02 = ±0.200 mm → 0.400 … 0.800 mm, inside the required 0.35 … 0.90 mm.

### 5.3 Statistical stack: root sum of squares (RSS)

**Derivation.** Treat every size as a random variable Xᵢ with mean μᵢ and standard deviation σᵢ. For a sum of
**independent** random variables:

  mean:     μ_G = Σ sᵢ·μᵢ
  variance: σ_G² = Σ sᵢ²·σᵢ² = Σ σᵢ²        (sᵢ = ±1, and the covariance terms vanish because the parts are independent)

If each part is made with its tolerance equal to ±3σᵢ (process capability Cp = 1, normal distribution: 99.73 % inside),
then tᵢ = 3σᵢ and

  T_RSS = 3·σ_G = 3·√(Σ (tᵢ/3)²) = √(Σ tᵢ²)

So the **statistical tolerance grows with the square root** of the number of parts, the worst case grows linearly.
With n equal tolerances t: T_WC = n·t, T_RSS = √n·t. For n = 6 the RSS result is 41 % of the worst case.

TDC gap: T_RSS = √(0.05² + 0.05² + 0.02² + 0.03² + 0.03² + 0.02²) = √0.0076 = ±0.0872 mm → 0.513 … 0.687 mm. The
ratio RSS/WC printed above is 0.44.

**The assumptions behind RSS.** RSS is only as good as these four assumptions, which must be checked for every stack:

| Assumption | What breaks it | Consequence |
|---|---|---|
| Parts are **independent** | one machine setting for a whole batch; matched parts from the same casting | errors add linearly → back towards the worst case |
| Sizes are **normal** | sorting (parts near the limits removed), tool wear (uniform), operators aiming at MMC (skewed) | wider tails than the normal curve |
| Means are **centred** | process set off-centre, tool wear, thermal drift | the whole result shifts – RSS does not see it |
| Tolerance = ±3σ (Cp = 1) | capable process (Cp 1.33 … 2) or poor process (Cp < 1) | RSS is pessimistic or optimistic |
| Enough parts | prototype, small series | the "99.73 %" has no meaning |

**Contribution (sensitivity) analysis.** The share of part i in the variance of G is cᵢ = sᵢ²·tᵢ² / Σ tᵢ² (core
`stack()`, field `contrib`). For the TDC gap the deck height and the gasket give 32.9 % each, together **66 %**. That
is where to spend money: halving the gasket tolerance (±0.025) reduces T_RSS from 0.087 to 0.077 mm. Halving the
crank radius tolerance reduces it by only 0.002 mm.

### 5.4 Modified RSS (Bender)

Because the RSS assumptions are rarely all true, industry uses a correction factor k (Bender, 1962):

  T_MRSS = k·√(Σ tᵢ²),   k = 1.4 … 1.8 (commonly 1.5),   capped at T_WC

The add-on prints the effect of k (core field `MRSS` uses the input `mrss_factor`, default 1.5):

```python
def st_bender(st, ks=(1.0, 1.3, 1.5, 1.8)):
    s = stack(st, 2000, 1)
    return [(k, min(s["WC"], k * s["RSS"])) for k in ks]
```

```
## 5.2 Modified RSS (Bender factor k)
  k 1.0 -> +/- 0.087 mm -> 0.513 ... 0.687
  k 1.3 -> +/- 0.113 mm -> 0.487 ... 0.713
  k 1.5 -> +/- 0.131 mm -> 0.469 ... 0.731
  k 1.8 -> +/- 0.157 mm -> 0.443 ... 0.757
```

k = 1.5 corresponds roughly to each part having a mean shift of half its tolerance. The result lies between RSS and the
worst case. It is a good default when you know the process only roughly.

### 5.5 Monte Carlo simulation – any distribution, any shift

Monte Carlo does not need any assumption about the result. The computer "builds" many assemblies. For each one it
draws a random size for every part from that part's distribution and computes G. The histogram of G is the answer.

`st_draw()` draws one size. It supports four distributions and a mean shift (as a fraction of t):

```python
def st_draw(dist, x, t, shift, rnd):
    m = x + shift * t
    if dist == "normal":
        return rnd.gauss(m, t / 3)
    if dist == "uniform":
        return rnd.uniform(m - t, m + t)
    if dist == "triangular":
        return rnd.triangular(m - t, m + t, m)
    if dist == "skewed":
        return m - t + 2 * t * rnd.betavariate(2, 5)
    raise ValueError(dist)
```

| Distribution | Standard deviation for ±t | When it is realistic |
|---|---|---|
| normal, ±3σ = t | t/3 = 0.333 t | stable, centred, capable process (grinding, CNC turning in series) |
| triangular | t/√6 = 0.408 t | sizes cluster in the middle but the process is less controlled |
| uniform | t/√3 = 0.577 t | tool wear between tool changes; nothing known (the safe assumption) |
| skewed beta(2, 5) | 0.32 t, mean at −0.43 t | operator aims at the "safe" side (MMC); gaskets compressed thinner; castings with a one-sided machining allowance |

`st_mc()` runs the simulation and reports the mean, the standard deviation, the reject rate in ppm, and the 0.135 % and
99.865 % quantiles. Those are the "natural ±3σ limits" of a non-normal result:

```python
def st_mc(st, dists=None, shifts=None, n=100000, seed=1):
    ...
    for _ in range(n):
        g.append(sum(s * st_draw(d, x, t, sh, rnd) for (_, s, x, t), d, sh in zip(it, dists, shifts)))
    g.sort()
    ...
    return {"mean": m, "sd": sd, "ppm": 1e6 * out / n, "q_lo": g[int(0.00135 * n)], "q_hi": g[int(0.99865 * n) - 1]}
```

```
## 5.3 Monte Carlo: distributions and mean shifts (100 000 assemblies)
  all normal, centred                              mean 0.6001, sd 0.0291, 0.135 % ... 99.865 %: 0.512 ... 0.686 mm, out 0 ppm
  all uniform (no process knowledge)               mean 0.6001, sd 0.0502, 0.135 % ... 99.865 %: 0.461 ... 0.739 mm, out 0 ppm
  all triangular                                   mean 0.6001, sd 0.0355, 0.135 % ... 99.865 %: 0.497 ... 0.703 mm, out 0 ppm
  gasket + deck skewed (beta 2,5)                  mean 0.5571, sd 0.0283, 0.135 % ... 99.865 %: 0.482 ... 0.647 mm, out 0 ppm
  normal, all means +0.5 t in the adverse direction mean 0.5001, sd 0.0291, 0.135 % ... 99.865 %: 0.412 ... 0.586 mm, out 0 ppm
  normal, gasket mean -0.8 t (thin gaskets)        mean 0.5601, sd 0.0291, 0.135 % ... 99.865 %: 0.472 ... 0.646 mm, out 0 ppm
```

What the six cases teach:

1. **Normal, centred:** the Monte Carlo range 0.512 … 0.686 equals the RSS result 0.513 … 0.687. The self-test of
   chapter 0 checks this (MC sd = RSS/3 within 1 %).
2. **Uniform:** even if nothing is known about the processes, the range (0.461 … 0.739) is still only 70 % of the
   worst case (0.400 … 0.800). With six parts the **central limit theorem** already makes the sum nearly normal.
3. **Triangular:** in between.
4. **Skewed deck and gasket:** the spread hardly changes (sd 0.0283), but the **mean moves** by −0.043 mm. A shift is
   much more dangerous than a wider spread, because it moves the whole distribution towards one limit.
5. **All means at +0.5 t in the adverse direction** (every part made at the side that makes the gap smaller): the
   mean drops to 0.500 mm and the lower natural limit to 0.412 mm. That is only 0.012 mm above the worst case.
   Systematic shifts of all parts in the same direction cancel the benefit of statistics.
6. **Thin gaskets** (a supplier delivers gaskets at −0.8 t): one part with a shift costs 0.04 mm of mean.

**Conclusion for the TDC gap:** even with all means shifted, no assembly falls below 0.35 mm. The stack is robust,
and the worst case alone already proves it.

**How many trials?** The standard error of a reject rate p estimated from n trials is √(p(1 − p)/n). To see 100 ppm
(10⁻⁴) with ±10 % accuracy you need about 10⁶ trials. 10⁵ trials, as here, only show reject rates of about 10⁻³ or
more. For smaller rates use the normal tail formula (chapter 5.6) or importance sampling. "0 ppm out" above means
"less than about 30 ppm", not "zero".

### 5.6 Statistical stack from process capability (Cp, Cpk) and the 1.5σ shift

A supplier quality agreement usually states **Cp** and **Cpk** for each important size:

  Cp = (USL − LSL)/(6σ) = 2t/(6σ)  → σ = t/(3·Cp)
  Cpk = min(USL − μ, μ − LSL)/(3σ) → mean offset |δ| = t − 3σ·Cpk = t·(1 − Cpk/Cp)

A conservative stack combines the parts like this:

- **standard deviations by RSS:** σ_G = √(Σ σᵢ²), because the random scatter of different parts is independent;
- **mean offsets linearly, in the adverse direction:** Δ = Σ |δᵢ|, because we do not know the direction of the offsets.

  G_lo = G − Δ − 3σ_G,  G_hi = G + Δ + 3σ_G,  z_min = min(G − Δ − LSL, USL − G − Δ)/σ_G,  p = Φ(−z_min)

```python
def st_cpk_stack(st, Cp=1.33, Cpk=1.0):
    sig = [t / (3 * Cp) for *_, t in st["items"]]
    dl = [t * (1 - Cpk / Cp) for *_, t in st["items"]]
    S = math.sqrt(sum(s * s for s in sig))
    D = sum(dl)
    ...
    ppm = 1e6 * 0.5 * math.erfc(min(z_lo, z_hi) / math.sqrt(2))
```

```
## 5.4 Statistical stack from process capability (each part Cp, Cpk)
  Cp 1.00 Cpk 1.00: sigma 0.0291, mean offset 0.000 -> 0.513 ... 0.687 mm, z 8.60, 0.00 ppm on the worse side
  Cp 1.33 Cpk 1.33: sigma 0.0218, mean offset 0.000 -> 0.534 ... 0.666 mm, z 11.44, 0.00 ppm on the worse side
  Cp 1.33 Cpk 1.00: sigma 0.0218, mean offset 0.050 -> 0.485 ... 0.715 mm, z 9.17, 0.00 ppm on the worse side
  Cp 2.00 Cpk 1.50: sigma 0.0145, mean offset 0.050 -> 0.506 ... 0.694 mm, z 13.76, 0.00 ppm on the worse side
  Cp 1.00 Cpk 0.50: sigma 0.0291, mean offset 0.100 -> 0.413 ... 0.787 mm, z 5.16, 0.12 ppm on the worse side
  six-sigma rule (Cp 2, shift 1.5 sigma -> Cpk 1.5): range 0.506 ... 0.694 mm
```

- **Cp = Cpk = 1** is exactly the plain RSS.
- A capable process (**Cp = Cpk = 1.33**, the usual automotive demand) narrows the result to 0.534 … 0.666 mm.
- **Cp 1.33 with Cpk 1.00** (good scatter, poorly centred) is worse than Cp = Cpk = 1. In a stack, **centring matters
  more than scatter**.
- The **six-sigma convention** (Cp = 2, a long-term mean shift of 1.5σ, so Cpk = 1.5) gives 0.506 … 0.694 mm.
- **Cp 1.00, Cpk 0.50** (a poor supplier) still keeps all assemblies inside 0.35 … 0.90 mm (0.12 ppm on the worse side).

**The statistical tolerance symbol ⟨ST⟩.** If you use RSS to justify wider part tolerances, the drawing must say so.
ISO 3040 / ASME Y14.5 mark the size with the symbol ⟨ST⟩ plus a note such as "statistical tolerance: Cpk ≥ 1.33". Then
the part is accepted not when it is inside its limits, but when the **batch** meets the capability. Risks:

1. **Inspection:** incoming inspection must measure enough parts to compute Cpk. A single good part proves nothing.
2. **Spare parts:** a single replacement part is not "statistical". A worst-case assembly made from spare parts may
   fail.
3. **Sorting:** a supplier who sorts out-of-tolerance parts instead of fixing the process delivers a truncated,
   uniform-like distribution. The RSS assumption is then broken, although every part is in tolerance.
4. **Responsibility:** without ⟨ST⟩ on the drawing, the supplier is only obliged to the limits, and the designer's RSS
   is a private hope.

### 5.7 Nonlinear stacks: numeric sensitivities

When G is not a simple sum, for example a function of angles, squares or ratios, write it as G = f(x₁ … xₙ) and
linearise around the nominal point:

  ΔG ≈ Σ (∂f/∂xᵢ)·Δxᵢ   →   T_WC = Σ |∂f/∂xᵢ|·tᵢ,   T_RSS = √(Σ (∂f/∂xᵢ·tᵢ)²)

The partial derivatives ("sensitivities") need not be derived by hand. A central difference is accurate to h²:

  ∂f/∂xᵢ ≈ [f(…, xᵢ + h, …) − f(…, xᵢ − h, …)] / (2h)

```python
def st_numeric_sens(f, x, h=1e-6):
    out = []
    for i in range(len(x)):
        xp, xm = list(x), list(x)
        xp[i] += h
        xm[i] -= h
        out.append((f(xp) - f(xm)) / (2 * h))
    return out

def st_nonlinear(f, x, t, n=100000, seed=1):
    sens = st_numeric_sens(f, x)
    rss = math.sqrt(sum((s * ti) ** 2 for s, ti in zip(sens, t)))
    ... Monte Carlo of f with normal inputs (sigma = t/3) ...
```

**Example 1 – clearance ratio of the compressor.** The delivered air quantity (FAD) of M2 depends on the clearance ratio
c = V_c/V_s = (A·gap + V_pocket)/(A·s), A = π·D²/4. The inputs are bore, stroke, TDC gap (the RSS result of chapter
5.3) and the volume of the valve pockets:

```python
def st_clearance_ratio(x):
    D, s, gap, Vp = x
    A = math.pi * D * D / 4
    return (A * gap + Vp * 1000) / (A * s)
```

```
## 5.5 Nonlinear stack 1: clearance ratio c = (A gap + V_pocket) / (A s)
  bore D mm                 65.000 +/- 0.015  dc/dx -0.000443  -> share -0.00001 (0.0 %)
  stroke s mm               46.000 +/- 0.040  dc/dx -0.000597  -> share -0.00002 (0.0 %)
  TDC gap mm                 0.600 +/- 0.087  dc/dx +0.021739  -> share +0.00189 (78.7 %)
  valve pocket volume cm3    2.200 +/- 0.150  dc/dx +0.006551  -> share +0.00098 (21.3 %)
  c nominal 0.02746; linearised RSS +/- 0.00213; Monte Carlo mean 0.02746, 3 sd 0.00213
```

The clearance ratio is 2.75 % ± 0.21 %. Bore and stroke tolerances are irrelevant here. The TDC gap gives 79 % and the
valve-pocket casting 21 %. Here the function is smooth enough that linearisation and Monte Carlo agree to 5 digits.
M2 chapter 10 gives the FAD loss per 0.1 mm gap, so ±0.087 mm of gap means about ±0.9 % FAD scatter between compressors.

**Example 2 – where linearisation fails: the desaxé offset.** If the cylinder axis is offset by e from the crank axis
(by design, or by the position tolerance of the bore), the pin height at TDC is y = √((r + l)² − e²). At e = 0 the
derivative ∂y/∂e = −e/y is **zero**: linear RSS says the offset tolerance has no effect.

```python
def st_desaxe_tdc(x):
    r, l, e = x
    return math.sqrt((r + l) ** 2 - e * e)
```

```
## 5.6 Nonlinear stack 2: desaxe offset e of the cylinder axis (r 23 +/- 0.02, l 90 +/- 0.03, e 0 +/- 0.3 mm)
  sensitivities dy/dr 1.0000, dy/dl 1.0000, dy/de 0.000000 (zero at e = 0: invisible to linear RSS)
  y nominal 113.0000; linear RSS +/- 0.0361; MC mean 112.99993 (bias -0.00007 mm), 3 sd 0.0359
  offset e 0.3 mm lowers the TDC height by 0.0004 mm
  offset e 1.0 mm lowers the TDC height by 0.0044 mm
  offset e 2.0 mm lowers the TDC height by 0.0177 mm
```

The effect is second order: Δy ≈ e²/(2(r + l)). Monte Carlo shows it as a small **bias** of the mean, not as scatter.
For this compressor the effect is negligible (0.4 µm at 0.3 mm offset). The method matters for linkages near a dead
centre (M2b four-bar, toggle presses), where a zero first derivative is the normal case. **Rule:** if a sensitivity
is zero or the function has a maximum or minimum near the nominal point, use Monte Carlo or a second-order expansion.

**2-D vector loops.** In a plane assembly (a lever, a linkage, a gear centre distance with bore positions) the loop is
closed by vectors: Σ Lᵢ·(cos θᵢ, sin θᵢ) = 0. Solving for the unknown closing length or angle gives f(x). Then exactly
the same numeric sensitivity method applies, with lengths **and angles** as toleranced inputs. The four-bar program
M2b (`fourbar.tolerance_mc`) is such a 2-D Monte Carlo stack.

### 5.8 Tolerance allocation (synthesis)

**The cost model.** The cost of making a size rises steeply as its tolerance closes. A practical model, fitted to shop
data, is

  cᵢ(tᵢ) = aᵢ + bᵢ / tᵢᵏ    (k ≈ 1 for turning and milling, 1.5 … 2 near the process limit – check)

aᵢ is the fixed cost and does not affect the allocation.

**Worst-case allocation (Lagrange).** Minimise C = Σ bᵢ/tᵢᵏ subject to Σ tᵢ = T. With the Lagrange multiplier λ:
∂/∂tᵢ [Σ bᵢ tᵢ⁻ᵏ + λ(Σ tᵢ − T)] = −k·bᵢ·tᵢ⁻⁽ᵏ⁺¹⁾ + λ = 0 → tᵢ ∝ bᵢ^(1/(k+1)).
Expensive parts get **larger** tolerances.

**RSS allocation.** Subject to √(Σ tᵢ²) = T: −k·bᵢ·tᵢ⁻⁽ᵏ⁺¹⁾ + 2λ·tᵢ = 0 → tᵢ ∝ bᵢ^(1/(k+2)).

These are the formulas of the core `allocate()`. The add-on compares them with two rules of thumb:

- **equal split:** tᵢ = T/n;
- **proportional to the tolerance unit** D^(1/3), the ISO 286 idea that bigger parts deserve bigger tolerances.

```python
def st_allocate_compare(names, nominals, b, T, k=1.0):
    eq = [T / n] * n
    w = [max(D, 1.0) ** (1 / 3) for D in nominals]
    pr = [T * x / sum(w) for x in w]
    opt = allocate(b, T, k, "wc")["t"]
    rss = allocate(b, T, k, "rss")["t"]
```

The TDC gap may vary by ±0.25 mm (0.35 … 0.90 around 0.60, limited by the lower side). Cost coefficients bᵢ
(`ST_COST_B`, typical – check): the deck height of a casting is dearest (0.40 EUR·mm), the bearing clearances cheapest:

```
## 5.7 Allocation of the TDC tolerance (worst case +/- 0.25 mm available, cost = b / t)
  item                                            b    equal unit^1/3  optimal  RSS opt
  block deck height (crank axis -> deck)       0.40   0.0417   0.0741   0.0547   0.1218
  gasket thickness (compressed)                0.30   0.0417   0.0143   0.0474   0.1107
  crank radius                                 0.25   0.0417   0.0407   0.0432   0.1041
  rod centre distance                          0.20   0.0417   0.0641   0.0387   0.0967
  piston compression height                    0.20   0.0417   0.0426   0.0387   0.0967
  bearing clearances (pin + crank pin)         0.10   0.0417   0.0143   0.0273   0.0767
  cost (EUR per assembly, model): equal 34.80, unit 47.34, optimal WC 33.43, optimal RSS 13.84
  present design (t = 0.05/0.05/0.02/0.03/0.03/0.02): cost 44.83
```

Results:

- The **present tolerances** use only ±0.20 of the ±0.25 available and cost 44.83 (model units). The cost-optimal
  worst-case split uses the full ±0.25 and costs **33.43**, 25 % less, and still gives a certain result.
- The **tolerance-unit rule** is the worst here (47.34). It gives the thin gasket (0.8 mm) only ±0.014 mm, which is
  impossible for a compressed fibre gasket. The D^(1/3) rule belongs to fits of the same kind, not to stacks of very
  different parts.
- The **RSS allocation** allows about twice the tolerances (deck ±0.12, gasket ±0.11) and costs only 13.84. It may
  only be used if the processes are proven (Cpk) and ⟨ST⟩ is on the drawings (chapter 5.6).

### 5.9 Selective assembly (class grading)

When the function needs a closing tolerance smaller than the sum of the part tolerances, there is a third way besides
tighter tolerances and statistics: **measure all parts, sort them into classes, assemble only parts of matching
classes**. Engine and compressor builders do this with pistons and cylinders, crank pins and rod bearings, roller
bearings and their rings. The class letter is stamped on the piston crown and the cylinder block.

**Theory.** Bore tolerance T_h and piston tolerance T_s are each divided into g classes of equal width. Parts of class
j are assembled together. Inside one class the clearance varies by only

  T_C,class = T_h/g + T_s/g = (T_h + T_s)/g

so the clearance range shrinks by the factor g. The price:

1. 100 % measurement.
2. Class marking and logistics.
3. **Surplus parts.** If the two size distributions do not have the same shape and position, classes contain different
   numbers of bores and pistons, and some parts find no partner.
4. **Spare parts** must be supplied in all classes.

`st_selective()` simulates both processes (normal, centred, Cp 1.33), sorts the parts into classes and reports the
clearance range per class and the share of each class:

```python
def st_selective(hole=(0.0, 30.0), shaft=(-130.0, -110.0), groups=3, n=60000, seed=2, Cp=1.33):
    ...
    for g in range(groups):
        h_lo, h_hi = hole[0] + g * th / groups, hole[0] + (g + 1) * th / groups
        s_lo, s_hi = shaft[0] + g * ts / groups, shaft[0] + (g + 1) * ts / groups
        rng.append((h_lo - s_hi, h_hi - s_lo))
    unmatched = sum(abs(a - b) for a, b in zip(share_h, share_s)) / 2
```

```
## 5.8 Selective assembly of piston and cylinder (bore H7 0/+30, piston -110/-130 um, Cp 1.33)
  1 class(es): clearance per class 110..160 um, overall 110.0 ... 160.0; shares bore 1.00 / piston 1.00; unmatched 0.0 %
  2 class(es): clearance per class 120..145, 125..150 um, overall 120.0 ... 150.0; shares bore 0.50/0.50 / piston 0.50/0.50; unmatched 0.1 %
  3 class(es): clearance per class 123..140, 127..143, 130..147 um, overall 123.3 ... 146.7; shares bore 0.09/0.82/0.09 / piston 0.09/0.82/0.09; unmatched 0.1 %
  5 class(es): clearance per class 126..136, 128..138, 130..140, 132..142, 134..144 um, overall 126.0 ... 144.0; shares bore 0.01/0.20/0.58/0.20/0.01 / piston 0.01/0.21/0.57/0.20/0.01; unmatched 0.2 %
  grading with equal 30 um tolerances (piston cheaper), hot loss 91.6 um, hot min 10 um, cold max 120 um:
   1 class(es): clearance range 60.0 um -> cold 101.6 ... 161.6, hot 10.0 ... 70.0 um -> piston slap cold
   3 class(es): clearance range 20.0 um -> cold 101.6 ... 121.6, hot 10.0 ... 30.0 um -> piston slap cold
   5 class(es): clearance range 12.0 um -> cold 101.6 ... 113.6, hot 10.0 ... 22.0 um -> OK
```

**The compressor piston problem solved.** Chapter 3 showed the conflict of the aluminium piston: the hot clearance must
stay ≥ 10 µm, and the clearance shrinks by 91.6 µm from cold to hot. So the cold clearance must be ≥ 101.6 µm. But
above about 120 µm cold the piston slaps (noise, skirt wear). Ungraded, the cold range is 50 µm wide (H7 + 20 µm
piston), which does not fit into 101.6 … 120.

- With **5 classes** of 6 µm each, and the piston tolerance even opened to 30 µm (cheaper turning), every
  class gives 12 µm of clearance range. The cold clearance is 101.6 … 113.6 µm and the hot clearance 10 … 22 µm. Both
  requirements are met.
- 3 classes (20 µm) are just not enough (121.6 > 120).
- The outer classes hold only about 1 % of the parts each. With centred, equal processes the mismatch is negligible
  (0.2 %).

This is how series engines and compressors are built (typically 3 … 5 piston classes, class letter on the piston
crown).

### 5.10 Second example: axial play of the locating bearing

The 6206 locating bearing A of the crankshaft (M4) sits between a housing shoulder and a circlip (DIN 472). The axial
play must be > 0 (no axial preload of a deep-groove bearing by the circlip) and ≤ 0.30 mm (axial movement of the
crankshaft, rod side load). The loop is: shoulder → groove flank (+), bearing width (−), circlip thickness (−). The
drawing limits are converted with `st_sym()`:

```python
ST_AXIAL = {
    "name": "axial play of 6206 (locating bearing)", "LSL": 0.0, "USL": 0.30,
    "raw": [["shoulder -> circlip groove flank", 1, 18.10, -0.05, 0.05],
            ["bearing width B (ISO 492: 0/-0.12)", -1, 16.00, -0.12, 0.0],
            ["circlip thickness s (DIN 472: 2.0 0/-0.06)", -1, 2.00, -0.06, 0.0]]}
```

```
## 5.9 Axial play of the locating bearing (housing shoulder - bearing - circlip)
  + shoulder -> circlip groove flank             mean 18.100 +/- 0.050
  - bearing width B (ISO 492: 0/-0.12)           mean 15.940 +/- 0.060
  - circlip thickness s (DIN 472: 2.0 0/-0.06)   mean 1.970 +/- 0.030
  play nominal 0.190 mm; WC 0.050 ... 0.330 (NOT OK); RSS 0.106 ... 0.274 (OK) for 0.00 ... 0.30 mm
  groove 18.07 +/- 0.03: WC 0.040 ... 0.280 (OK)
```

With only three parts, statistics is not convincing. Bearings and circlips come in boxes from one production lot, so
they are correlated, and three parts are not "many". So the worst case is the right check, and it fails (0.33 mm).
Two remedies:

1. Tighten and lower the groove position to 18.07 ± 0.03 mm, a normal CNC tolerance. The worst case becomes
   0.040 … 0.280 mm: OK.
2. Use a **wave spring washer** or a circlip of selected thickness (DIN 472 circlips exist in thickness steps), which
   removes the play by adjustment instead of by tolerance.

---

## 6. Geometric tolerancing (ISO 1101 / ISO GPS / ASME Y14.5)

A size tolerance controls only **local sizes** (two-point measurements). It says nothing about whether a shaft is
straight, a bore round, a face flat, or a hole where it should be. Those properties are controlled by **geometric
tolerances**. On a modern drawing they decide the function at least as much as the size tolerances do.
`python tol.py ch56` prints all results of this chapter (sections 6.x).

### 6.1 The tolerance characteristics

```
## 6.1 Geometric characteristics
  form         straightness                       datum no       crankshaft journal axis
  form         flatness                           datum no       deck face, valve plate, gasket faces
  form         roundness                          datum no       cylinder bore, bearing seats
  form         cylindricity                       datum no       cylinder bore (taper + roundness + straightness together)
  orientation  parallelism                        datum yes      crank pin axis to main axis
  orientation  perpendicularity                   datum yes      cylinder bore axis to crank axis, deck face to bore
  orientation  angularity                         datum yes      V-bank angle of the two cylinders (90 deg)
  location     position                           datum yes      head-bolt holes, dowel holes, bearing bore pair
  location     concentricity / coaxiality         datum yes      two main bearing bores (line bore)
  location     symmetry                           datum yes      keyway to shaft axis
  run-out      circular run-out (radial / axial)  datum yes      bearing seats, pulley seat, shoulders
  run-out      total run-out                      datum yes      seal running surface
  profile      profile of a line / surface        datum optional cam contour (M6), gasket outline, free-form castings
```

**The hierarchy.** A tolerance of a higher family also limits the lower ones. A position tolerance limits orientation
and form, an orientation tolerance limits form. So a form tolerance on a toleranced feature is only useful when it is
**smaller** than the orientation/position tolerance. Example: cylinder bore with position Ø0.05, perpendicularity 0.03
and cylindricity 0.008 – each refines the one before.

**Tolerance zones.**

| Characteristic | Zone |
|---|---|
| straightness of an axis | cylinder of diameter t (with Ø in the frame) |
| flatness | two parallel planes at distance t |
| roundness | two concentric circles, radial distance t, in each cross-section |
| cylindricity | two coaxial cylinders at radial distance t |
| perpendicularity of an axis | cylinder of diameter t perpendicular to the datum |
| position of a hole | cylinder of diameter t at the theoretically exact position (dimensions in boxes) |
| circular radial run-out | circles of radial distance t in each section, centred on the datum axis, measured while rotating |
| profile of a surface | band of width t around the exact (CAD) surface, normal to it |

### 6.2 Datums and the 3-2-1 principle

A datum is the **perfect geometric element** (plane, axis, point) that a real feature establishes. It is the
coordinate system in which orientation, location and run-out are measured. The **3-2-1 rule** fixes a rigid part
with 6 contacts:

- **primary datum A:** 3 points – a plane, removes 3 degrees of freedom (translation z, rotation x, y);
- **secondary B:** 2 points – a line or axis, removes 2 more;
- **tertiary C:** 1 point – removes the last.

The order in the feature control frame (|⌖|Ø0.5 Ⓜ|A|B|C|) is the order of contact. Changing the order changes the part
that is accepted.

**Choose datums from the function, not from manufacturing:** the deck face (A) and the two main bearing bores (B, the
crank axis) define the crankcase, because these are the surfaces the cylinder and the crankshaft actually sit on. A
casting reference point that the foundry likes is not a datum for the assembled function.

**Datum feature at MMC (datum shift).** If a datum is a feature of size (a dowel hole) and is referenced at MMC
(|A Ⓜ|), the pattern may shift by the departure of the datum feature from its MMC:

```python
def gd_datum_shift(datum_size, datum_mmc, internal=True):
    return max(0.0, (datum_size - datum_mmc) if internal else (datum_mmc - datum_size))
```

```
  dowel datum hole 8 H7 referenced at MMC, measured 8.012: pattern may shift by 0.012 mm
```

This is functional: the valve plate located on that dowel can also move by that clearance.

### 6.3 MMC, LMC, RFS – bonus tolerance and virtual condition

- **MMC (maximum material condition):** the size with the most material – smallest hole, largest shaft.
- **LMC:** the size with the least material – largest hole, smallest shaft.
- **RFS (regardless of feature size):** the default in ISO 1101 when no modifier is given. The geometric tolerance is
  the same at any size.

**Ⓜ (MMC modifier) and the bonus.** For assembly (bolt through a hole), what matters is the worst-case boundary of the
hole: its **virtual condition** VC = MMC − t (hole), MMC + t (pin). As the hole is made larger than MMC, it may be
further off position and still accept the bolt:

  allowed position = t(MMC) + |actual size − MMC|

```python
def gd_virtual(mmc, t, internal=True):
    return mmc - t if internal else mmc + t

def bonus(T_mmc, size, mmc, internal=True):        # core tol.py
    return T_mmc + max(0.0, (size - mmc) if internal else (mmc - size))
```

```
## 6.2 Virtual condition, bonus, envelope
  head-bolt hole 9.00 ... 9.22, position 1.0 at MMC -> virtual condition 8.00 mm (= bolt diameter)
    hole 9.000 -> position allowed 1.000
    hole 9.055 -> position allowed 1.055
    hole 9.110 -> position allowed 1.110
    hole 9.165 -> position allowed 1.165
    hole 9.220 -> position allowed 1.220
```

The VC of the head-bolt hole equals the bolt diameter (8.00): **every** hole that passes the size and the position
check accepts a bolt at nominal position. That is the design rule: VC_hole ≥ VC_bolt.

**Use Ⓜ for clearance assembly. Never use it** where the position itself is the function, regardless of size: a bore
for a bearing, a gear centre distance, a sealing face. There the bonus would allow a larger error exactly when the
hole is larger.

### 6.4 Envelope requirement vs principle of independence

**ISO 8015 (principle of independence, default in ISO GPS since 2011):** size and form are independent. A shaft 30 k5
with no further note may be bent like a banana as long as every two-point size is between 30.002 and 30.011.

**Envelope requirement Ⓔ (ISO 14405-1; the default "Rule #1" in ASME Y14.5):** the feature must not violate the
perfect form at MMC. A shaft at MMC must be perfectly straight and round. The less material it has, the more form
error it may have:

```python
def gd_envelope(actual, mmc, internal=False):
    return max(0.0, (actual - mmc) if internal else (mmc - actual))
```

```
  journal 30 k5 (+0.002/+0.011) with (E): local size 30.011 -> form error allowed 0.000 mm
  journal 30 k5 (+0.002/+0.011) with (E): local size 30.008 -> form error allowed 0.003 mm
  journal 30 k5 (+0.002/+0.011) with (E): local size 30.005 -> form error allowed 0.006 mm
  journal 30 k5 (+0.002/+0.011) with (E): local size 30.002 -> form error allowed 0.009 mm
```

**Rule for this compressor:** every fit of chapter 3 (bearing seats, piston pin, pulley hub, press fit) carries Ⓔ
after the tolerance (30 k5 Ⓔ), or the drawing states "ISO 14405 Ⓔ" generally. Without it, a fit calculated in chapter 3
is not guaranteed: a bent journal behaves like a bigger shaft. The **Taylor principle** of limit gauges (chapter 7) is
the measuring counterpart of Ⓔ: the GO gauge is a full-form gauge at MMC, the NO-GO gauge measures two points.

### 6.5 Fastener formulas – floating and fixed

For a bolt pattern that must assemble in every case:

- **floating fastener** (bolt through clearance holes in both parts, nut): each part may use T = H − F;
- **fixed fastener** (stud or screw threaded into one part): the two parts share H − F, so T₁ + T₂ = H − F, usually
  T = (H − F)/2 each.

H is the hole at MMC, F the fastener at MMC (core `fastener()`):

```
## 6.3 Fasteners and projected tolerance zone (M8)
  floating (through bolts) T = 1.00 per part; fixed (studs) T = 0.50 per part
```

The cylinder head of the compressor is held by studs in the crankcase, so it is the **fixed** case: Ø0.5 at MMC for the
threaded holes of the crankcase, Ø0.5 for the 9 mm holes of the valve plate and head.

### 6.6 Projected tolerance zone for studs

The fixed-fastener formula assumes the stud axis stays inside its zone **also above the block**, through the thickness
of the head. But the tolerance applies only over the length of the threaded hole. A stud that is tilted inside a
zone of Ø0.5 over 12 mm of thread leans out much further at the top of a 20 mm head:

  r(h) = T/2 + T·h/L_e     (axis from one side of the zone at the bottom to the other side at the top)

```python
def gd_projected(T, L_e, h, F=8.0):
    r = T / 2 + T * h / L_e
    return {"r_top": r, "H_needed": F + 2 * r + T, "H_needed_projected": F + 2 * T}
```

```
## 6.3 Fasteners and projected tolerance zone (M8)
  stud T 0.5 over thread 12 mm, part thickness  0.0: top deviation r 0.250 -> hole needed 9.00 (projected zone: 9.00)
  stud T 0.5 over thread 12 mm, part thickness 10.0: top deviation r 0.667 -> hole needed 9.83 (projected zone: 9.00)
  stud T 0.5 over thread 12 mm, part thickness 20.0: top deviation r 1.083 -> hole needed 10.67 (projected zone: 9.00)
  stud T 0.5 over thread 12 mm, part thickness 30.0: top deviation r 1.500 -> hole needed 11.50 (projected zone: 9.00)
```

With a 20 mm head, the 9 mm holes would need to be 10.67 mm. The remedy is the **projected tolerance zone** Ⓟ: the
frame |⌖|Ø0.5 Ⓜ Ⓟ 20|A|B| extends the zone 20 mm above the block. Inspection then measures a gauge pin screwed into the
thread. Then 9 mm holes are enough. **Every threaded hole for a stud or a long screw through a thick part needs Ⓟ.**

### 6.7 Position instead of ± coordinates

A position tolerance Ø T at the true position (boxed dimensions) gives a **round** zone. A ± coordinate tolerance gives
a **square** zone. If the square is chosen so that it fits inside the circle (its diagonal = T), the circle has π/2
times its area:

```python
def gd_xy_area(T):
    tx = T / (2 * math.sqrt(2))
    sq = (2 * tx) ** 2
    ci = math.pi * T * T / 4
    return {"tx": tx, "square": sq, "circle": ci, "ratio": ci / sq}
```

```
## 6.4 Position zone vs +/- coordinates
  circle 1.0: +/- 0.354 square has area 0.500 mm2, circle 0.785 mm2 -> circle 57 % larger
  +/- 0.5 x/y coordinates allow a position error up to 1.414 (diagonal)
```

The bolt only cares about the radial distance from the true position, so the circle is the functional zone. Position
tolerancing accepts **57 % more** parts for the same function. Coordinate tolerances also have two other faults:

1. In the diagonal direction they allow 1.414 times the intended error (core `xy_to_position(0.5, 0.5)` = 1.414).
2. They depend on the chain of dimensioning. Chain dimensions add up from hole to hole. Boxed true-position dimensions
   do not.

### 6.8 Composite position: pattern location and pattern accuracy

Often the pattern **as a whole** may be located loosely relative to the datums (the head is centred on the cylinder by
its own spigot), but the holes must match **each other** closely (the studs must enter all holes at once). The
composite frame has two lines:

- **upper line, PLTZF** (pattern-locating tolerance zone framework): each hole within Ø1.0 of its true position
  relative to A, B, C;
- **lower line, FRTZF** (feature-relating): each hole within Ø0.3 of its position relative to the **other holes**. The
  pattern may be moved as a whole (and rotated, if the secondary datum is not repeated).

`gd_pattern_check()` evaluates a CMM report of the four head-bolt holes. FRTZF uses a best-fit translation, the mean
offset of all holes:

```python
def gd_pattern_check(pat=None):
    dev = [(mx - nx, my - ny) for (nx, ny), (mx, my) in zip(pat["nominal"], pat["measured"])]
    plt = [2 * math.hypot(dx, dy) for dx, dy in dev]
    cx = sum(d[0] for d in dev) / len(dev)
    cy = sum(d[1] for d in dev) / len(dev)
    frt = [2 * math.hypot(dx - cx, dy - cy) for dx, dy in dev]
```

```
## 6.5 Composite position of the head-bolt pattern (CMM report)
  hole 1: position to datums 0.956 (PLTZF 1.0), to the pattern 0.057 (FRTZF 0.3)
  hole 2: position to datums 0.950 (PLTZF 1.0), to the pattern 0.029 (FRTZF 0.3)
  hole 3: position to datums 0.906 (PLTZF 1.0), to the pattern 0.051 (FRTZF 0.3)
  hole 4: position to datums 0.881 (PLTZF 1.0), to the pattern 0.043 (FRTZF 0.3)
  pattern shift 0.353 / 0.298 mm -> PLTZF OK, FRTZF OK
```

The pattern is drilled 0.35/0.30 mm off (one fixture setting), so every hole is close to its PLTZF limit. Against each
other the holes are within 0.06 mm. The part is good. The shop should still correct the fixture offset now, before the
next batch reaches the Ø1.0 limit. A position report in this form tells the machinist **what** to correct (one offset
for all holes), not only "pass/fail".

### 6.9 Run-out of the bearing seats (link to M3 / M4)

Circular **radial run-out** is measured with a dial gauge while the shaft turns between centres (the datum axis A–B
of the two bearing seats). It contains eccentricity and roundness together. **Axial run-out** of a shoulder is the
wobble of its face. Their effects on the crankshaft assembly:

- a pulley or flywheel seat with radial run-out t_r sits eccentric by e = t_r/2 → unbalance U = m·e. Compare with the
  permissible residual unbalance of ISO 21940-11, U_per = 9549·G·m/n (g·mm, m in kg, n in rpm) for grade G 6.3;
- a shoulder with axial run-out t_ax tilts the bearing ring that is clamped against it by t_ax/D_shoulder. Compare with
  the permissible misalignment of the bearing (deep-groove ball bearing about 10 arcmin at normal clearance – check).

```python
def gd_runout(t_radial=0.010, t_axial=0.020, D_shoulder=36.0, m_rotor=4.5, n=1450.0, G=6.3, misalign_arcmin=10.0):
    e = t_radial / 2 * 1000                                  # um
    U = m_rotor * e                                         # g mm (kg x um = g mm)
    U_per = 9549 * G * m_rotor / n
    tilt = math.degrees(t_axial / D_shoulder) * 60          # arcmin
```

```
## 6.6 Run-out of the bearing seats (M3 / M4)
  radial 0.005 / axial 0.010: e 2.5 um, U 11.2 g mm = 6 % of U_per 186.7 (G6.3); ring tilt 1.0 arcmin OK
  radial 0.010 / axial 0.020: e 5.0 um, U 22.5 g mm = 12 % of U_per 186.7 (G6.3); ring tilt 1.9 arcmin OK
  radial 0.030 / axial 0.050: e 15.0 um, U 67.5 g mm = 36 % of U_per 186.7 (G6.3); ring tilt 4.8 arcmin OK
  radial 0.100 / axial 0.100: e 50.0 um, U 225.0 g mm = 121 % of U_per 186.7 (G6.3); ring tilt 9.5 arcmin OK
```

For the 4.5 kg flywheel at 1450 rpm, a seat run-out of 0.01 mm uses 12 % of the G 6.3 budget. Specify **radial run-out
0.01 A–B** for the flywheel and pulley seats. That is grinding quality, the same operation as the k5 fit. Specify
**axial run-out 0.02 A–B** for the bearing shoulders: 1.9 arcmin of ring tilt costs almost no bearing life.

Run-out and fit interact. An interference fit (k5, s6) **copies the seat's run-out into the ring or hub**. A clearance
fit adds the clearance as eccentricity on top. For a balanced rotor this is one more reason to use transition or
interference fits for rotating parts.

### 6.10 Perpendicularity of the cylinder bore to the crank axis

The rod keeps the piston aligned to the crank. If the bore axis is not perpendicular to the crank axis (datum A–B),
the piston stands tilted in the bore. Over its skirt length it then uses part of the **diametral clearance**:
used ≈ L_skirt · t/L_bore.

```python
def gd_bore_perp(t_perp=0.030, L_ref=80.0, L_skirt=40.0, C_hot_min=18.4):
    tilt = t_perp / L_ref
    used = L_skirt * tilt * 1000
    return {"tilt_mrad": tilt * 1000, "used_um": used, "left_um": C_hot_min - used, "share": used / C_hot_min}
```

```
## 6.7 Perpendicularity of the cylinder bore to the crank axis
  t 0.01 over 80 mm: tilt 0.125 mrad, skirt uses 5.0 um of the 18.4 um hot clearance (27 %), left 13.4 um
  t 0.02 over 80 mm: tilt 0.250 mrad, skirt uses 10.0 um of the 18.4 um hot clearance (54 %), left 8.4 um
  t 0.03 over 80 mm: tilt 0.375 mrad, skirt uses 15.0 um of the 18.4 um hot clearance (82 %), left 3.4 um
  t 0.05 over 80 mm: tilt 0.625 mrad, skirt uses 25.0 um of the 18.4 um hot clearance (136 %), left -6.6 um
```

The minimum hot clearance of the default piston is only 18.4 µm (chapter 3). Perpendicularity 0.05 mm would seize the
piston, and even 0.03 mm leaves 3.4 µm. **Specify perpendicularity 0.01 A–B** for the cylinder bores. That is a fine
boring operation on the same setting as the main bearing bores, or a honing fixture referenced to the crank axis. Here
a geometric tolerance and the fit of chapter 3 must be designed **together**: the fit alone looks fine.

### 6.11 Functional gauges and zero tolerance at MMC

**Functional (GO) gauge.** For a pattern toleranced at MMC, the simplest inspection is a plate with pins at the
**true positions**, pin diameter = **virtual condition** of the holes. If the part drops over the pins, every hole
satisfies size at MMC and position together. The gauge-maker's tolerance (typically 5 … 10 % of the part
tolerance – check) is put on the pins in the direction that makes the gauge **stricter** (absolute acceptance: the
gauge never accepts a bad part, it may reject a few good ones):

```python
def gd_gauge(H_mmc, T_pos, gauge_tol_pct=5.0):
    vc = H_mmc - T_pos
    gt = gauge_tol_pct / 100 * T_pos
    return {"VC": vc, "pin_min": vc, "pin_max": vc + gt, "gauge_tol": gt}
```

```
## 6.8 Functional gauge, zero tolerance at MMC, profile, datum shift
  GO gauge pins at true position: 8.000 ... 8.050 mm (gauge tolerance 0.050)
```

The size limits (9.00 … 9.22) are still checked separately with plug gauges. The functional gauge checks only the
virtual-condition boundary.

**Zero tolerance at MMC.** Instead of "hole 9.00 … 9.22, position Ø1.0 Ⓜ" you may write "hole 8.00 … 9.22, position
Ø0 Ⓜ". The VC is the same 8.00 mm, so the function is the same. But the size and position can now trade freely: an
undersize hole with a very good position is also accepted.

```python
def gd_zero_mmc(H_mmc, H_lmc, T, cases):
    vc = H_mmc - T
    for size, pos in cases:
        orig = H_mmc <= size <= H_lmc and pos <= bonus(T, size, H_mmc)
        zero = vc <= size <= H_lmc and pos <= size - vc
```

```
  hole 9.10, position 1.05: original callout accept, zero at MMC accept
  hole 8.90, position 0.85: original callout reject, zero at MMC accept
  hole 8.60, position 0.70: original callout reject, zero at MMC reject
  hole 9.22, position 1.20: original callout accept, zero at MMC accept
  hole 9.00, position 1.05: original callout reject, zero at MMC reject
```

The 8.90 hole at position 0.85 assembles perfectly, because 8.90 − 0.85 = 8.05 > 8.00. The original callout rejects it
only because it is undersize. Zero tolerance at MMC removes such **false rejects**. Use it where the bolt holes are
drilled and the shop's scatter is mainly in position.

### 6.12 Profile tolerance

The **profile of a surface** controls a free-form or composite surface against its exact CAD geometry. It is a band of
width t, normally bilateral (±t/2) around the nominal. Typical uses: the M6 cam contour (profile 0.02 relative to the
camshaft axis), the outline of a cast part, the gasket contour. With a CMM, the normal deviations of the measured
points are compared with the band:

```python
def gd_profile_check(devs, t, bilateral=True):
    lo, hi = (-t / 2, t / 2) if bilateral else (0.0, t)
    bad = [d for d in devs if not lo <= d <= hi]
    return {"min": min(devs), "max": max(devs), "zone": (lo, hi), "ok": not bad, "n_bad": len(bad)}
```

```
  gasket outline profile 0.1: deviations -0.06 ... 0.05 -> NOT OK (1 point(s) outside)
```

The gasket outline has a total spread of 0.11 mm, close to the 0.1 band, but one point is at −0.06, outside the
bilateral ±0.05. If the function only cares about the gasket being **not larger** (it must not reach into the bolt
holes), an unequal zone (ISO 1101 "UZ" modifier, ASME Ⓤ) such as 0.1 UZ −0.08 would accept it. The tolerance should
follow the function.

### 6.13 Summary: geometric tolerances for the compressor drawings

| Feature | Tolerance | Why (chapter) |
|---|---|---|
| Main bearing bores (datum B = common axis A–B) | coaxiality Ø0.01, cylindricity 0.005 | bearing misalignment (M4) |
| Crankshaft bearing / flywheel / pulley seats | 30 k5 Ⓔ, radial run-out 0.01 A–B | fit (3), unbalance (6.9) |
| Bearing shoulders | axial run-out 0.02 A–B | ring tilt (6.9) |
| Cylinder bores | 65 H7, perpendicularity 0.01 to A–B, cylindricity 0.008, position Ø0.05 | hot piston clearance (3, 6.10) |
| Deck face | flatness 0.03, parallel 0.05 to A–B, height 139.20 ± 0.05 | TDC gap stack (5) |
| Head-stud threads M8 | position Ø0.5 Ⓜ Ⓟ 20 to deck A and bores | fixed fastener, projected zone (6.5, 6.6) |
| Valve plate / head holes 9 H13 | position Ø0.5 Ⓜ, or Ø0 Ⓜ with size 8.5 … 9.22 | fixed fastener, zero at MMC (6.11) |
| Circlip groove | 18.07 ± 0.03 from shoulder | axial play stack (5.10) |
| Gasket outline | profile 0.1 (UZ if needed) | 6.12 |

Every line of this table is a result of the program, not a habit. That is the difference between tolerancing by
function and tolerancing by copying old drawings.


---

## 7. Manufacturing and measurement: process capability, cost, gauges, uncertainty, MSA, SPC, roughness, temperature, drawing check

A tolerance on the drawing is a promise. Chapters 2–6 checked that every good part works. This chapter
checks the other half: can the shop **make** the part inside the tolerance, can inspection **prove** it, and what
does it **cost**? A tolerance that the process cannot hold, or that the gauge cannot see, is worth nothing.

All results come from `python tol.py ch78`. The data (process table, cost points, gauge factors, measurement
values) are typical values – marked "check" – and must be replaced by your own shop data.

### 7.1 Which process holds which IT grade

Each machining process has a **normal** accuracy, reached in series production without special care, and a **best**
accuracy, reached with a good machine, a sharp tool, stable temperature and an experienced operator. Plan with the
normal value. The best value is for single parts or for an emergency.

```python
MF_PROCESS = [   # process, best IT, normal IT, Ra best um, Ra normal um, relative cost per feature (typical - check)
    ("sawing / flame cutting", 13, 15, 6.3, 25.0, 0.5),
    ...
    ("cylindrical grinding", 5, 6, 0.1, 0.4, 3.0),
    ("honing", 4, 6, 0.05, 0.4, 4.0),
    ...
]

def mf_processes_for(D, grade):
    """Processes that hold ITgrade at nominal D: 'normal' if the normal IT is good enough, 'best' if only the best IT."""
    T = it_um(D, grade)
    out = []
    for name, best, normal, ra_b, ra_n, c in MF_PROCESS:
        state = "normal" if normal <= grade else "best only" if best <= grade else None
        ...
```

`python tol.py ch78`:

```
## 7.1 Process capability per process (typical - check)
  sawing / flame cutting             IT13 best / IT15 normal, Ra   6.3 /    25 um, cost 0.5
  sand casting                       IT14 best / IT16 normal, Ra  12.5 /    25 um, cost 0.6
  die casting / investment casting   IT10 best / IT13 normal, Ra   1.6 /   3.2 um, cost 0.8
  drop forging                       IT13 best / IT15 normal, Ra   6.3 /  12.5 um, cost 0.7
  sheet metal punching / bending     IT10 best / IT12 normal, Ra   1.6 /   3.2 um, cost 0.6
  drilling                           IT10 best / IT12 normal, Ra   3.2 /   6.3 um, cost 1.0
  turning, rough                     IT10 best / IT12 normal, Ra   6.3 /  12.5 um, cost 1.0
  turning, finish                    IT7  best / IT9  normal, Ra   0.8 /   1.6 um, cost 1.6
  milling, finish                    IT7  best / IT9  normal, Ra   0.8 /   3.2 um, cost 1.8
  boring (fine boring)               IT6  best / IT8  normal, Ra   0.4 /   1.6 um, cost 2.2
  reaming                            IT6  best / IT8  normal, Ra   0.4 /   1.6 um, cost 2.0
  cylindrical grinding               IT5  best / IT6  normal, Ra   0.1 /   0.4 um, cost 3.0
  internal grinding                  IT5  best / IT7  normal, Ra   0.2 /   0.8 um, cost 3.5
  honing                             IT4  best / IT6  normal, Ra  0.05 /   0.4 um, cost 4.0
  lapping / superfinishing           IT3  best / IT5  normal, Ra 0.025 /   0.1 um, cost 6.0
  wire EDM                           IT6  best / IT8  normal, Ra   0.4 /   1.6 um, cost 5.0
  IT5 at 30 mm (T 9 um): cylindrical grinding (best only, Ra 0.1); internal grinding (best only, Ra 0.2); honing (best only, Ra 0.05); lapping / superfinishing (normal, Ra 0.1)
  IT7 at 65 mm (T 30 um): turning, finish (best only, Ra 0.8); milling, finish (best only, Ra 0.8); reaming (best only, Ra 0.4); cylindrical grinding (normal, Ra 0.4)
  IT11 at 139.2 mm (T 250 um): sheet metal punching / bending (best only, Ra 1.6); die casting / investment casting (best only, Ra 1.6); drilling (best only, Ra 3.2); turning, rough (best only, Ra 6.3)
```

How to read it:

- The **k5 bearing seat** (IT5 at 30 mm, only 9 µm) is a grinding job. Grinding reaches IT5 only as "best", so the
  grinding machine must be in good condition. In practice a k5 seat is ground with in-process gauging (a measuring
  head on the workpiece during grinding), which turns "best" into a reliable result.
- The **H7 cylinder** (IT7 at 65 mm) can be reached by fine boring, but the bore of a compressor also needs the
  plateau surface for oil retention. So it is honed, even though boring alone would hold the size.
- The **deck height** (139.2 mm) needs only IT11 (±0.125 mm). Rough turning or milling is enough, and nobody should
  ask for more.

The list is sorted by cost. The cheapest process that holds the grade "normal" is the right one; a process that
holds it only "best" costs the 1.5 × penalty used in the function (scrap, slower feed, more measuring).

### 7.2 What a tighter tolerance costs

Cost rises steeply as the tolerance becomes small. Two models are common:

- reciprocal: C = a + b/t
- exponential: C = a·e^(−b·t)

Both are fitted to measured shop data (cost index vs tolerance for one feature) by linear least squares. The
reciprocal model is linear in 1/t; the exponential model is linear in ln C.

```python
def mf_fit_cost():
    """Least-squares fits of the cost-tolerance data: reciprocal C = a + b/t (linear in 1/t) and exponential
    C = a e^(-b t) (linear in ln C). Returns parameters and RMS error of both models."""
    ...
    a1, b1 = lsq([1 / v for v in t], c)
    la, lb = lsq(t, [math.log(v) for v in c])
    a2, b2 = math.exp(la), -lb
```

```
## 7.2 Cost - tolerance models (data: d 30, turned / ground - check)
  reciprocal C = 0.673 + 26.09 / t   (RMS 0.086)
  exponential C = 3.810 exp(-0.0159 t) (RMS 1.127)
  IT5  T    9 um -> cost index 3.57
  IT6  T   13 um -> cost index 2.68
  IT7  T   21 um -> cost index 1.92
  IT8  T   33 um -> cost index 1.46
  IT9  T   52 um -> cost index 1.17
  IT10 T   84 um -> cost index 0.98
  IT11 T  130 um -> cost index 0.87
  one grade finer at IT6 -> IT5: + 33 % cost
```

The reciprocal model fits the data well (RMS 0.086). The exponential model does not (RMS 1.13): it cannot follow the
steep rise at small tolerances. This is typical. Use the reciprocal model, and it is also the model behind the
cost-optimal allocation `allocate()` of chapter 5 (cost b_i/t_i).

The table gives the practical rule: **each IT grade finer costs 25–35 % more** in the range IT5–IT8, and almost
nothing is saved below IT10. That is why general tolerances (ISO 2768-m) are used for everything that does not
need a fit – they are free.

### 7.3 Process capability from a measured sample

A tolerance is held "reliably" when the process spread is small compared with it and the process is centred.

- Cp = (USL − LSL)/(6·s) – could the process hold the tolerance if it were centred?
- Cpk = min(USL − x̄, x̄ − LSL)/(3·s) – does it hold it where it actually runs?
- ppm out = 10⁶·[(1 − Φ((USL − x̄)/s)) + Φ((LSL − x̄)/s)] for a normal distribution.

Usual requirements: Cpk ≥ 1.33 for normal characteristics, Cpk ≥ 1.67 for safety or critical ones (automotive
practice, check your customer). Cpk 1.33 corresponds to 4 σ from the nearer limit, about 32 ppm.

```python
def mf_capability(data, LSL, USL):
    """Cp = (USL - LSL)/(6 s), Cpk = min(USL - x, x - LSL)/(3 s), ppm out from the normal distribution."""
    n = len(data)
    m = sum(data) / n
    s = math.sqrt(sum((x - m) ** 2 for x in data) / (n - 1))
    phi = lambda z: 0.5 * math.erfc(-z / math.sqrt(2))
    ppm = 1e6 * ((1 - phi((USL - m) / s)) + phi((LSL - m) / s))
    ...
```

The example uses 50 simulated diameters of the k5 crankshaft seat (+2 … +11 µm), seed 7:

```
## 7.3 Capability of the k5 seat from a sample of 50 (simulated measurements, um)
  centred process  mean  6.42 s 0.84 -> Cp 1.78, Cpk 1.74,       0 ppm (sample 0 out,  4.49 ...  8.22)
  shifted process  mean  8.92 s 0.84 -> Cp 1.78, Cpk 0.82,    6819 ppm (sample 0 out,  6.99 ... 10.72)
  wide process     mean  6.34 s 1.60 -> Cp 0.93, Cpk 0.90,    5244 ppm (sample 0 out,  2.67 ...  9.76)
```

Three lessons:

1. The **shifted** process has the same Cp (1.78) as the centred one, but Cpk 0.82 and 6 800 ppm out – **and not a
   single part of the 50 was out**. A sample of 50 that "looks good" proves nothing; only the statistics show the
   risk. The remedy costs nothing: re-centre the grinding target (adjust the in-process gauge by −2.5 µm).
2. The **wide** process (s 1.6 µm) cannot be saved by centring: Cp 0.93 < 1. It needs a better machine, a better
   wheel dressing, or a wider tolerance (k6 instead of k5 – check with the bearing maker).
3. Cpk from 50 parts has a confidence interval of roughly ±15 %. Use at least 50 parts for a machine capability
   study and 125 parts (25 subgroups of 5) for a process capability study.

### 7.4 Limit gauges and the Taylor principle

A **limit gauge** does not measure; it decides "good / not good". The **Taylor principle** (1905) says:

- The **GO gauge** has the **full form** of the mating part and checks the **maximum material limit** (MMC): smallest
  hole, largest shaft. A full-length plug or a full ring then also detects form errors (bend, taper, out-of-round)
  that would stop assembly.
- The **NO-GO gauge** checks the **least material limit** (LMC) at **two points** only (short plug, snap gauge), so
  it finds a local oversize.

This is exactly the **envelope requirement** (E) of ISO 14405-1 in hardware form: a GO gauge enforces the envelope.

The gauge itself needs a manufacturing tolerance H, and the GO gauge wears. Gauge standards (ISO 1938, DIN 7150 /
DIN 7162) therefore place the GO gauge a distance z **inside** the tolerance and allow it to wear by y **beyond** the
MMC limit. The program uses simple fractions of IT (typical for IT6–IT8, check the standard tables):

```python
MF_GAUGE = {"H": 0.15, "z": 0.15, "y": 0.10}   # gauge tolerance, GO offset inside the zone, wear allowance beyond MMC, as fraction of IT

def mf_gauges(D, zone, part):
    lo, hi = zone_limits(D, zone, part)
    T = hi - lo
    H, z, y = (MF_GAUGE[k] * T for k in ("H", "z", "y"))
    if part == "hole":       # plug gauge: MMC = lower limit
        go = (lo + z - H / 2, lo + z + H / 2)
        wear = lo - y
        nogo = (hi - H / 2, hi + H / 2)
    else:                    # ring / snap gauge: MMC = upper limit
        go = (hi - z - H / 2, hi - z + H / 2)
        wear = hi + y
        nogo = (lo - H / 2, lo + H / 2)
```

```
## 7.4 Limit gauges (Taylor principle; H 0.15 IT, z 0.15 IT, y 0.10 IT - check ISO 1938)
   62 H7  hole  zone  +0.0 ... +30.0: GO  +2.25 ...  +6.75 (wear limit  -3.00), NO-GO +27.75 ... +32.25 um; tolerance lost to gauging 30 %
   65 H7  hole  zone  +0.0 ... +30.0: GO  +2.25 ...  +6.75 (wear limit  -3.00), NO-GO +27.75 ... +32.25 um; tolerance lost to gauging 30 %
   18 H7  hole  zone  +0.0 ... +18.0: GO  +1.35 ...  +4.05 (wear limit  -1.80), NO-GO +16.65 ... +19.35 um; tolerance lost to gauging 30 %
   30 k5  shaft zone  +2.0 ... +11.0: GO  +8.97 ... +10.33 (wear limit +11.90), NO-GO  +1.33 ...  +2.67 um; tolerance lost to gauging 30 %
   30 s6  shaft zone +35.0 ... +48.0: GO +45.07 ... +47.02 (wear limit +49.30), NO-GO +34.02 ... +35.98 um; tolerance lost to gauging 30 %
```

For the 6206 housing bore (62 H7) the GO plug is made to 62.00225 … 62.00675 mm and is scrapped when it has worn
down to 61.997 mm. The NO-GO plug is 62.02775 … 62.03225 mm. Up to 30 % of the tolerance is "lost" to the gauge
tolerance and position – a new GO gauge rejects some good parts near the MMC limit. For the k5 seat with only
9 µm, a ring gauge would have a tolerance of 1.35 µm. That is possible but expensive, and a ring gauge is also
hard to use on a crankshaft between webs. **Practical choice:** the k5 seat is measured with an indicating snap
gauge or in-process gauging (7.5, 7.6); the H7 bores are checked with GO / NO-GO plugs in series, and with an air
gauge on the honing machine for the cylinder.

### 7.5 Measurement uncertainty and guard bands (GUM, ISO 14253-1)

Every measurement has an uncertainty U. ISO 14253-1 says: the **supplier** may only declare conformance if the
measured value is inside the tolerance **reduced by U on both sides** (the conformance zone). The **customer** may
only reject if the value is outside the tolerance **enlarged by U**. So the uncertainty eats tolerance from the
person who has to prove it.

The uncertainty budget follows the GUM: each influence gives a standard uncertainty u_i, then

u_c = √(Σ u_i²), U = k·u_c with k = 2 (about 95 %).

| Influence | Distribution | u_i |
|---|---|---|
| resolution of the display a | rectangular | a/√12 |
| repeatability (standard deviation of repeated readings) | normal | s |
| calibration of the setting standard (certificate U_cal, k = 2) | normal | U_cal/2 |
| temperature difference part – gauge ±ΔT | rectangular | L·α·ΔT/√3 |
| α mismatch at a deviation T_dev from 20 °C | rectangular | L·(Δα + u_α)·T_dev/√3 |

```python
def mf_uncertainty(L=30.0, res=1.0, s_rep=0.6, U_cal=0.8, dT=2.0, alpha_part=11.5e-6, alpha_gauge=11.5e-6, d_alpha_unc=1.0e-6, T_dev=3.0):
    L_um = L * 1000
    comps = [("resolution", res / math.sqrt(12)), ("repeatability", s_rep), ("calibration of the standard", U_cal / 2),
             ("temperature difference part - gauge (+/-%.1f K)" % dT, L_um * alpha_part * dT / math.sqrt(3)),
             ("alpha mismatch at %.1f K from 20 C" % T_dev, L_um * (abs(alpha_part - alpha_gauge) + d_alpha_unc) * T_dev / math.sqrt(3))]
    uc = math.sqrt(sum(u * u for _, u in comps))
    return {"comps": comps, "u_c": uc, "U": 2 * uc}

def mf_guard_band(lo, hi, U):
    """ISO 14253-1: proof of conformance only inside [lo + U, hi - U]; the supplier loses 2U of the tolerance."""
```

```
## 7.5 Measurement uncertainty and guard band (k5 at 30, T = 9 um)
  digital micrometer 1 um: U = 1.75 um (k = 2) -> accept +3.75 ... +9.25, T/U 5.1, 39 % of the tolerance lost
    resolution                                       u 0.289 um
    repeatability                                    u 0.600 um
    calibration of the standard                      u 0.400 um
    temperature difference part - gauge (+/-2.0 K)   u 0.398 um
    alpha mismatch at 3.0 K from 20 C                u 0.052 um
  dial snap gauge 0.5 um, set to a gauge block: U = 1.09 um (k = 2) -> accept +3.09 ... +9.91, T/U 8.3, 24 % of the tolerance lost
  micrometer on a warm part (+8 K, no correction): U = 3.56 um (k = 2) -> accept +5.56 ... +7.44, T/U 2.5, 79 % of the tolerance lost
```

- With a good digital micrometer the k5 seat (9 µm) shrinks to 5.5 µm of accepted range – 39 % lost. The largest
  contribution is repeatability (0.6 µm), i.e. the operator and the anvil contact, not the display.
- A dial snap gauge set to a gauge block halves the loss (24 %). The common rule "T/U ≥ 4 … 10" (golden rule of
  metrology: U ≤ T/10 … T/4) is met only with the snap gauge.
- Measuring a warm part straight from the grinding machine (+8 K) loses 79 % of the tolerance. Either wait (or cool
  the part in a fluid bath) or correct the reading with the temperature (7.8).

### 7.6 Gauge R&R (measurement system analysis)

Before a gauge is used for capability studies it must be shown that its own variation is small compared with the
tolerance. The AIAG **average and range method** separates:

- EV, equipment variation (repeatability): R̄·K1, R̄ = mean range of the repeated readings of each operator and part.
- AV, appraiser variation (reproducibility): √((x̄_diff·K2)² − EV²/(n·r)), x̄_diff = range of the operator means.
- GRR = √(EV² + AV²); PV (part variation) = R_p·K3; TV = √(GRR² + PV²).
- %GRR of tolerance = 6·GRR/T; ndc (number of distinct categories) = 1.41·PV/GRR.

Acceptance (AIAG MSA, check): %GRR < 10 % good, 10–30 % conditionally acceptable, > 30 % not acceptable; ndc ≥ 5.

```python
MF_K = {"K1_2trials": 0.8862, "K2_3ops": 0.5231, "K3_10parts": 0.3146}   # AIAG MSA constants (1/d2*)

def mf_grr_study(T_um, sd_part=4.0, sd_rep=0.5, sd_op=0.3, parts=10, ops=3, trials=2, seed=11):
    ...
    EV = R_bar * MF_K["K1_2trials"]
    AV = math.sqrt(max(0.0, ((max(op_means) - min(op_means)) * MF_K["K2_3ops"]) ** 2 - EV ** 2 / (parts * trials)))
    GRR = math.hypot(EV, AV)
    PV = (max(part_means) - min(part_means)) * MF_K["K3_10parts"]
```

The study is simulated (10 parts, 3 operators, 2 trials), with true part spread 4 µm, operator bias 0.3 µm:

```
## 7.6 Gauge R&R, 10 parts x 3 operators x 2 trials (simulated, average-range method)
  snap gauge (repeatability 0.5 um): EV 0.51, AV 0.17, GRR 0.53, PV 3.02 um -> %GRR of tolerance 36 %, of TV 17 %, ndc 8.0
  hand micrometer (repeatability 1.5 um): EV 1.52, AV 0.04, GRR 1.52, PV 3.07 um -> %GRR of tolerance 101 %, of TV 44 %, ndc 2.8
```

Even the snap gauge gives 36 % of the 9 µm tolerance – not acceptable by the 30 % rule, although it separates the
parts well (ndc 8). The hand micrometer is useless for this tolerance (101 %, ndc 2.8: it can only say "small /
large"). For IT5 features the realistic gauges are **air gauges** or **in-process gauging heads** with
repeatability ≤ 0.2 µm. This is a real finding for the compressor: the k5 crankshaft seat needs an air gauge
or the grinding machine's own gauge; the measuring room micrometer is not enough.

### 7.7 Statistical process control: X̄–R chart

Once the process is capable, SPC keeps it so. Subgroups of n = 5 parts are taken at intervals; their mean x̄ and
range R are plotted. Limits (Shewhart):

- x̄ chart: x̿ ± A2·R̄ (A2 = 0.577 for n = 5)
- R chart: D3·R̄ … D4·R̄ (D3 = 0, D4 = 2.114)
- process σ = R̄/d2 (d2 = 2.326)

The limits are computed in **phase I** from a stable period and then **frozen** for phase II. If they were
recomputed with the disturbed data, the shift would partly hide itself.

```python
MF_SPC = {5: {"A2": 0.577, "D3": 0.0, "D4": 2.114, "d2": 2.326}}

def mf_spc(mean, sd, k=20, n=5, seed=3, shift_at=None, shift=0.0):
    ...
    m = shift_at if shift_at else k                       # limits from the stable phase only (phase I), then applied
    xbb, Rb = sum(xb[:m]) / m, sum(R[:m]) / m
    lim = {"UCLx": xbb + c["A2"] * Rb, "LCLx": xbb - c["A2"] * Rb, "UCLr": c["D4"] * Rb, "LCLr": c["D3"] * Rb}
```

```
## 7.7 SPC X-bar / R chart of the k5 seat (subgroups of 5)
  stable process: X-bar-bar 6.33, R-bar 2.57, sigma 1.11 um; X-bar limits 4.85 ... 7.82, R limits 0.00 ... 5.44; out of control: none
  wheel wear: +2 um shift from subgroup 14: X-bar-bar 6.21, R-bar 2.39, sigma 1.03 um; X-bar limits 4.83 ... 7.60, R limits 0.00 ... 5.06; out of control: [14, 15, 16, 17, 18, 19, 20]
```

A shift of only 2 µm (about 2 σ) is caught at the first subgroup after it happens (14) – long before parts are out of
tolerance (the upper limit is +11 µm). This is the point of SPC: **react to the process, not to scrap**. Note that
the control limits (4.8 … 7.6 µm) are not the tolerance limits (2 … 11 µm); they describe what the process does,
not what the drawing allows.

### 7.8 Reference temperature 20 °C

ISO 1 defines all dimensions at **20 °C**. A part measured at another temperature with a gauge of a different
material (or at a different temperature) reads wrong:

e = L·(α_part·(T_part − 20) − α_gauge·(T_gauge − 20))

```python
def mf_warm_part(L, T_part, alpha_part, T_gauge=20.0, alpha_gauge=11.5e-6):
    return L * 1000 * (alpha_part * (T_part - 20) - alpha_gauge * (T_gauge - 20))
```

```
## 7.8 Reference temperature 20 C (ISO 1)
  steel shaft 30 mm at 28 C                              reading error +2.8 um
  aluminium piston 65 mm at 26 C (steel gauge at 20 C)   reading error +9.0 um
  cast-iron crankcase bore 62 mm at 35 C after machining reading error +10.2 um
```

- The crankshaft seat at 28 °C reads 2.8 µm too large – almost a third of the k5 tolerance.
- The aluminium piston at 26 °C reads 9 µm large: the piston clearance (chapter 3: 110 … 160 µm) would be judged
  9 µm too small. Pistons are therefore graded (size classes) in a temperature-controlled room.
- The crankcase bore straight from the boring machine at 35 °C reads 10 µm large – a third of H7. Bores are measured
  after the casting has cooled, or the machine compensates with a temperature sensor on the part.

### 7.9 Roughness and IT grade

A fit cannot be finer than the surface it is made of. Rules of thumb (check with your standard practice):
Rz ≤ (0.1 … 0.25)·IT, Ra ≈ Rz/5 for turned and ground surfaces. For interference fits each surface also loses
0.8·Rz of interference by smoothing (chapter 4).

```python
def mf_roughness(D, grade, k_rz=0.2):
    T = it_um(D, grade)
    Rz = k_rz * T
    return {"T": T, "Rz_max": Rz, "Ra_max": Rz / 5, "smoothing_um": 0.8 * Rz}

def mf_ra_callout(Ra):
    """Next finer value of the preferred Ra series (ISO 1302 style) for the drawing."""
```

```
## 7.9 Roughness vs IT (Rz <= 0.2 IT, Ra ~ Rz/5 - check)
  6206 seat k5       IT5   9 um: Rz <= 1.8, Ra <= 0.36 -> drawing Ra 0.2; smoothing loss of this Rz 1.4 um
  crankcase bore H7  IT7  30 um: Rz <= 6.0, Ra <= 1.20 -> drawing Ra 0.8; smoothing loss of this Rz 4.8 um
  cylinder H7        IT7  30 um: Rz <= 6.0, Ra <= 1.20 -> drawing Ra 0.8; smoothing loss of this Rz 4.8 um
  press-fit seat s6  IT6  13 um: Rz <= 2.6, Ra <= 0.52 -> drawing Ra 0.4; smoothing loss of this Rz 2.1 um
```

Compare with the M3 press-fit seat in chapter 4: it was specified with Rz 3.2 (shaft) and Rz 6.3 (hub). The rule
gives Rz ≤ 2.6 µm for an IT6 shaft. Specifying Ra 0.4 (Rz ≈ 2) on the shaft and Rz 4 in the hub would raise the
effective minimum interference from 6.4 to about 9 µm – a cheap part of the chapter-4 redesign. The cylinder is
specified finer than the rule (Ra 0.4, plateau honed) for oil retention and ring sealing, not for the fit.

### 7.10 Heat treatment, distortion and grinding allowance

A hardened seat must be turned **oversize**, hardened, and ground to size. The grinding stock must remove the turned
roughness, the decarburised / damaged layer and the distortion (run-out after hardening), and it varies by the
tolerance of the turned diameter:

z_min = 2·(Rz_prev + defect layer + distortion), z_max = z_min + T_prev

```python
def mf_grind_allowance(D, T_prev_um, Rz_prev=12.5, defect_um=20.0, distortion_um=30.0):
    zmin = 2 * (Rz_prev + defect_um + distortion_um)
    return {"D": D, "z_min": zmin, "z_max": zmin + T_prev_um, "turn_to": "%.3f ... %.3f" % (D + zmin / 1000, D + (zmin + T_prev_um) / 1000)}
```

```
## 7.10 Grinding allowance after induction hardening (crank journal 30 k5)
  distortion 15 um: stock on diameter 95 ... 147 um -> turn to 30.095 ... 30.147 mm
  distortion 30 um: stock on diameter 125 ... 177 um -> turn to 30.125 ... 30.177 mm
  distortion 60 um: stock on diameter 185 ... 237 um -> turn to 30.185 ... 30.237 mm
```

The turned drawing of the crankshaft says "Ø 30.125 … 30.177 before hardening" if the journal is induction
hardened. Too little stock leaves black (unground) spots; too much stock grinds away the hardened case and costs
grinding time. If distortion grows (long, slender shafts), straightening before grinding is cheaper than more stock.
For case-hardened gears (M5d) the same logic sets the stock on the flanks.

### 7.11 Machining routes of the compressor seats

The process table of 7.1 becomes a route per feature. The last operation must reach the IT grade of the drawing:

```python
MF_ROUTES = [   # feature, nominal, zone, part, operations (name, IT reached), final Ra required
    ("6206 seat on crankshaft", 30.0, "k5", "shaft", [("turn rough", 11), ("turn finish (leave 0.3 mm)", 9), ("induction harden journal (optional)", 9), ("cylindrical grind", 5)], 0.4),
    ("6206 bore in crankcase", 62.0, "H7", "hole", [("rough bore", 11), ("fine bore (one set-up with the 2nd bore)", 7)], 0.8),
    ("cylinder bore", 65.0, "H7", "hole", [("rough bore", 11), ("fine bore", 8), ("plateau honing", 6)], 0.4),
    ...
]
```

```
## 7.11 Machining routes of the compressor seats
  6206 seat on crankshaft    30 k5  (IT5, 9 um, Ra 0.4): turn rough IT11 > turn finish (leave 0.3 mm) IT9 > induction harden journal (optional) IT9 > cylindrical grind IT5 -> IT5 OK
  6206 bore in crankcase     62 H7  (IT7, 30 um, Ra 0.8): rough bore IT11 > fine bore (one set-up with the 2nd bore) IT7 -> IT7 OK
  cylinder bore              65 H7  (IT7, 30 um, Ra 0.4): rough bore IT11 > fine bore IT8 > plateau honing IT6 -> IT6 OK
  small-end bush bore        18 H7  (IT7, 18 um, Ra 0.8): press bush in IT11 > fine bore / ream after pressing IT7 -> IT7 OK
  pulley seat                25 k6  (IT6, 13 um, Ra 0.8): turn rough IT11 > turn finish IT8 > cylindrical grind IT6 -> IT6 OK
  press-fit seat             30 s6  (IT6, 13 um, Ra 0.8): turn rough IT11 > turn finish IT8 > cylindrical grind IT6 -> IT6 OK
```

Points that the IT grade alone does not show:

- **Both crankcase bearing bores in one set-up** (line boring from one side, or boring from both sides with a
  rotary table). Then their coaxiality is limited by the machine, not by two clampings – that is what the run-out
  and coaxiality tolerances of chapter 6 need.
- **The small-end bush is finished after pressing in.** A bush pressed into its bore shrinks by roughly the
  interference; finishing it afterwards removes that uncertainty from the pin clearance.
- **All shaft seats are ground in one clamping between centres**, so run-out between the bearing seats and the
  pulley seat is only the grinding machine's error (a few µm).

### 7.12 Drawing check list for tolerances

```
## 7.12 Drawing check list
  1. every functional size has a tolerance: ISO zone (30 k5) or limits; all others covered by the general tolerance note 'ISO 2768-mK'
  2. independency principle (ISO 8015) is the default: write (E) where size must also control form (fits!) or use GO gauges
  3. datums (ISO 5459) are the functional surfaces - bearing seats for run-out, mating face for position
  4. geometric tolerances smaller than the size tolerance where form matters (cylindricity of bearing seats ~ IT5/2)
  5. roughness on every fitted surface (Ra or Rz), consistent with the IT grade
  6. heat treatment note with hardness, depth and where; grinding allowance on the turned drawing
  7. fit table on the assembly drawing with clearance / interference limits and assembly method (press / shrink temperature)
  8. measurement at 20 C or with a temperature correction; inspection characteristic marked (CTQ) where Cpk is required
```

The fit table of item 7 is written by `python tol.py run` as `fit_table.csv` – paste it into the assembly drawing.

### 7.13 Summary of chapter 7 for the compressor

| Feature | Process | Inspection | Note |
|---|---|---|---|
| 30 k5 bearing seats, 25 k6, 30 s6 | turn → (harden) → grind in one clamping | air gauge / in-process gauge (GRR!), SPC x̄–R | measure at 20 °C; Ra 0.2–0.4 |
| 62 H7 bearing bores | rough + fine bore in one set-up | GO / NO-GO plug, air gauge for SPC | measure after cooling (+10 µm at 35 °C) |
| 65 H7 cylinder | bore → plateau hone | air gauge on the honing machine | pistons graded in classes at 20 °C |
| 18 H7 bush | press in → fine bore / ream | GO / NO-GO plug | finish after pressing |
| deck height 139.2 ± 0.05 | fine milling | CMM / height gauge, SPC | 33 % of the TDC gap variation |

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification

`python tol.py selftest` checks the program against independent values. The output (also printed by `ch78`):

```
## 8.1 Verification (python tol.py selftest)
H7/g6 at 25 mm: clearance +7 ... +41 um (ISO 286-2)                OK   
hole K6 at 40: +3/-13, N7 at 25: -7/-28, S7 at 25: -27/-48 (Delta rule) OK   
hole basis H7/p6 = shaft basis P7/h6 (same limits of clearance)    OK   -35 ... -1
IT table = formula k x i within rounding (< 12 %)                  OK   max 8.4 %
js7 at 25 = +/-10 (IT7 = 21 odd -> rounded down)                   OK   
Lame: u_hub - u_shaft = effective interference / 2 (hollow shaft, two E) OK   
stack: Monte Carlo sd (normal) = RSS / 3 within 1 %                OK   0.0289 / 0.0291
stack: uniform MC sd = sqrt(sum t^2 / 3)                           OK   
allocation: sum t = T and cheaper than equal split                 OK   120.0 < 140.0
transition fit: P(interference) = Phi(-mean / sd)                  OK   
floating fastener 8 / 9: T = 1.0; fixed 0.5 per part               OK   
SELFTEST PASS
```

| Check | What it proves | Why it is independent |
|---|---|---|
| H7/g6 at 25 | table lookup, limits, fit formula | value printed in ISO 286-2 and every handbook |
| K6, N7, S7 | the Δ rule for holes | three different branches (K, N, P…U), compared with printed values |
| H7/p6 = P7/h6 | the purpose of the Δ rule | a property of the ISO system, not a typed number |
| IT table vs k·i | no typing error larger than the rounding | formula from ISO 286-1 |
| js7 rounding | the special rounding rule | printed ±10 instead of ±10.5 |
| Lamé | pressure formula | displacement of each cylinder computed separately and added |
| Monte Carlo | sampling and the RSS formula | statistical theory: σ_sum² = Σσ_i² |
| allocation | Lagrange solution | constraint and cost compared with an equal split |
| P(interference) | normal model | evaluated with erf instead of erfc |
| fasteners | position formulas | textbook values |

What the self-test **cannot** prove: that the typed table values are correct in every cell (only the sampled cells
are compared), that the bearing-ring tolerances, friction coefficients and process data are right for your
supplier, or that the normal distribution describes your process. Those remain "check" items.

Manual cross-checks that are worth doing once: compare five random zones with a handbook (e.g. `python tol.py fit
H8/f7 100` → hole 0/+54, shaft −36/−71); recompute one press fit by hand; and run one stack in a spreadsheet.

### 8.2 Complete worked example: gearbox intermediate shaft

**Task.** An intermediate shaft of a two-stage gearbox carries a case-hardened gear (torque 180 N m, safety against
slip 1.5) and a sliding shift sleeve. It runs in two 6207 deep-groove ball bearings, cross-located (each bearing
takes thrust in one direction, the covers locate the outer rings). Covers are centred in the housing bores by a
spigot and fixed with M6 screws in tapped holes. Housing: grey cast iron. Wanted: all fits, the gear press fit with
the assembly method, the axial play of the shaft (0.10 … 0.50 mm: the shaft must never be clamped by thermal growth,
but must not shuttle), and the position tolerance of the cover holes.

Input file `tools/examples/tol_example.json` (only the keys that differ from the default):

```json
{
  "name": "Gearbox intermediate shaft: 6207 seats, gear press fit, sliding sleeve, cover spigots, axial play, cover bolts (example)",
  "fits": [
    {"name": "6207 inner ring on shaft (rotating load)", "D": 35.0, "hole": "brg_bore", "shaft": "k5", ...},
    {"name": "6207 outer ring in housing (stationary load, floating side)", "D": 72.0, "hole": "H7", "shaft": "brg_od",
     "alpha": [10.5e-6, 11.5e-6], "T": [60.0, 70.0], "need": [0.0, 60.0]},
    {"name": "gear hub on shaft (press fit)", "D": 40.0, "hole": "H7", "shaft": "u6", ...},
    {"name": "sliding sleeve on shaft (shift collar)", "D": 45.0, "hole": "H7", "shaft": "g6", ...},
    {"name": "bearing cover spigot in housing bore (centring)", "D": 72.0, "hole": "H7", "shaft": "f7", ...}
  ],
  "pressfit": {"fit": "H7/u6", "d": 40.0, "D_hub": 70.0, "l": 40.0, "Rz_shaft": 3.2, "Rz_hub": 6.3, "mu": 0.12,
               "Re_hub": 700.0, "T_req_Nm": 180.0, "S_slip": 1.5, ...},
  "stack": {"name": "axial play of the cross-located shaft", "LSL": 0.10, "USL": 0.50, "items": [...]},
  "gdt": {"F": 6.0, "H": 6.6, "H_tol": 0.18, "pattern": "M6 cover bolts in tapped housing, cover holes 6.6 H13"}
}
```

Command: `python tol.py run --in examples/tol_example.json --out example` (writes `report.md` and `fit_table.csv`):

```
# Tolerance report (ISO 286 / ISO 2768 / DIN 7190 / stack-up / position) - Gearbox intermediate shaft: 6207 seats, gear press fit, sliding sleeve, cover spigots, axial play, cover bolts (example)

## Fits (um; C > 0 clearance, C < 0 interference)
- 6207 inner ring on shaft (rotating load): 35 brg_bore/k5 -> hole -12/+0, shaft +2/+13; C -25.0 ... -2.0 (interference, P(interference) 100.0 %); at T hole 70 / shaft 70 C: -25.0 ... -2.0; need - ... -1 -> cold OK, hot OK
- 6207 outer ring in housing (stationary load, floating side): 72 H7/brg_od -> hole +0/+30, shaft -13/+0; C +0.0 ... +43.0 (clearance, P(interference) 0.0 %); at T hole 60 / shaft 70 C: -11.2 ... +31.8; need 0 ... 60 -> cold OK, hot NOT OK
- gear hub on shaft (press fit): 40 H7/u6 -> hole +0/+25, shaft +60/+76; C -76.0 ... -35.0 (interference, P(interference) 100.0 %); at T hole 70 / shaft 70 C: -76.0 ... -35.0; need - ... -20 -> cold OK, hot OK
- sliding sleeve on shaft (shift collar): 45 H7/g6 -> hole +0/+25, shaft -25/-9; C +9.0 ... +50.0 (clearance, P(interference) 0.0 %); at T hole 70 / shaft 70 C: +9.0 ... +50.0; need 5 ... 60 -> cold OK, hot OK
- bearing cover spigot in housing bore (centring): 72 H7/f7 -> hole +0/+30, shaft -60/-30; C +30.0 ... +90.0 (clearance, P(interference) 0.0 %); at T hole 60 / shaft 55 C: +33.8 ... +93.8; need 5 ... 120 -> cold OK, hot OK

## Interference fit H7/u6, d 40, hub D 70, l 40 (DIN 7190 style)
- interference 35 ... 76 um, effective (smoothing 0.8 x (Rz 3.2 + 6.3)) 27.4 ... 68.4 um
- pressure 48.4 ... 120.9 MPa; torque 584.4 ... 1458.8 N m vs 1.5 x 180.0 = 270.0 N m required (S 3.25); hub stress 316 MPa (S 2.21)
- press-in force up to 72.9 kN or shrink: heat hub by 252 K -> all checks OK

## Stack-up: axial play of the cross-located shaft (limits 0.10 ... 0.50 mm)
- + housing width between cover faces           150.000 +/- 0.100 mm (contribution 40.5 %)
- - spigot depth cover A                          5.000 +/- 0.050 mm (contribution 10.1 %)
- - spigot depth cover B                          5.000 +/- 0.050 mm (contribution 10.1 %)
- - bearing width 6207 A (17 0/-0.12)            16.940 +/- 0.060 mm (contribution 14.6 %)
- - bearing width 6207 B (17 0/-0.12)            16.940 +/- 0.060 mm (contribution 14.6 %)
- - shaft distance between bearing shoulders    105.800 +/- 0.050 mm (contribution 10.1 %)
- nominal 0.320 mm; worst case +/- 0.370 -> -0.050 ... 0.690 (NOT OK); RSS +/- 0.157 -> 0.163 ... 0.477 (OK); modified RSS +/- 0.236
- Monte Carlo 100000: normal sd 0.0526 mm, 370 ppm out; uniform sd 0.0907 mm, 27440 ppm out; Cpk (RSS sigma) 1.15

## Position tolerance: M6 cover bolts in tapped housing, cover holes 6.6 H13
- bolt 6.0, hole 6.60 ... 6.78: floating fastener T = H - F = 0.60 mm at MMC (up to 0.78 at LMC with bonus); fixed fastener (studs) 0.30 mm per part; equal +/- x/y 0.212 mm
```

`python tol.py ch78` adds the alternatives that lead to the decisions:

```python
def mf_example_options(P):
    """Decisions of the worked example: floating outer-ring zone (hot), press-fit candidates, axial play by shim."""
    fd = P["fits"][1]
    zones = []
    for h in ("H7", "G7", "F7"):
        r = fit_report(dict(fd, hole=h))
        ...
    for f_ in ("H7/r6", "H7/s6", "H7/u6"):
        R = press_fit_check(dict(pf, fit=f_))
        ...

def mf_shrink_options(pf, T_hub_max=150.0, T_room=20.0, T_cold=(-78.0, -196.0), alpha_shaft=11.5e-6):
    """Assembly temperature needed: interference + assembly clearance 0.001 d must come from heating the hub and / or
    cooling the shaft. Case-hardened gears must stay below about 150 ... 180 C (tempering temperature - check)."""
```

```
## 8.3 Decisions of the worked example
  floating 6207 outer ring H7: cold +0.0 ... +43.0, hot -11.2 ... +31.8 um
  floating 6207 outer ring G7: cold +10.0 ... +53.0, hot -1.2 ... +41.8 um
  floating 6207 outer ring F7: cold +30.0 ... +73.0, hot +18.8 ... +61.8 um
  gear hub H7/r6: U 9 ... 50 um, torque at U_min 30 N m (S 0.17), hub S 3.57 -> NOT OK
  gear hub H7/s6: U 18 ... 59 um, torque at U_min 222 N m (S 1.23), hub S 2.94 -> NOT OK
  gear hub H7/u6: U 35 ... 76 um, torque at U_min 584 N m (S 3.25), hub S 2.21 -> OK
  axial play with housing width +/-0.05: worst case 0.000 ... 0.640, RSS 0.189 ... 0.451 mm
  axial play with a shim (steps 0.05 mm, measuring 0.01 mm): play = target +/- 0.035 mm -> 0.30 +/- 0.035 inside 0.10 ... 0.50
  assembly of the gear (needs 0.116 mm diametral expansion): press-in up to 72.9 kN, or
    heat hub only                      hub at   272 C -> too hot for a case-hardened gear
    cool shaft to -78 C + heat hub     hub at   194 C -> too hot for a case-hardened gear
    cool shaft to -196 C + heat hub    hub at    99 C -> OK (<= 150 C for a case-hardened gear)
```

**Decisions, step by step.**

1. **Inner rings, 35 k5.** Rotating inner-ring load → interference fit. 2 … 25 µm, positive hot (same material,
   same temperature). Same choice as the compressor. OK.
2. **Outer rings, housing bore.** The bearing runs 10 K warmer than the cast-iron housing, and steel expands more
   than grey iron. With H7 the "floating" outer ring can be clamped by up to 11.2 µm when warm – the shaft would
   then be axially preloaded by thermal growth. In a cross-located arrangement the axial play (decision 5) is
   meant to take the growth, and the outer rings only need to sit without creeping, so **H7 is acceptable here**
   (stationary outer-ring load, the bearing maker's standard recommendation, check). If one bearing were a true
   floating bearing (locating / floating arrangement), **G7** would be chosen: it is never more than 1.2 µm tight
   when hot. F7 would be too loose cold (up to 73 µm → the ring creeps and wears the housing).
3. **Gear hub press fit.** r6 and s6 fail: after smoothing, s6 leaves only 10.4 µm effective interference at the
   minimum → 222 N m < 270 N m. **u6 is chosen**: S_slip 3.25 at the smallest interference, hub stress 316 MPa
   with S 2.21 against the case-hardened gear's core strength (700 MPa, check). A larger-than-needed slip safety is
   normal for u6; it is the smallest preferred zone that works.
4. **Assembly of the gear.** The program's simple shrink check (heat the hub by 252 K) is not allowed for a
   case-hardened gear: above about 150–180 °C the case is tempered and loses hardness. Options: press in with up to
   73 kN (needs a press, lubricated, risk of scoring at u6), or **cool the shaft in liquid nitrogen (−196 °C) and warm
   the gear to about 100 °C** (oil bath or induction heater). The last option is chosen: no force, no scoring, the
   gear stays well below its tempering temperature. Dry ice (−78 °C) is not enough (194 °C hub temperature).
5. **Axial play.** Worst case −0.05 … 0.69 mm – the shaft can be clamped (negative play) or shuttle (0.69 > 0.50).
   RSS gives 0.16 … 0.48 mm and Monte Carlo 370 ppm outside, if all parts are normal and centred. Tightening the
   housing width to ±0.05 helps but still does not meet the worst case (0.00 … 0.64). **Decision: shim at
   assembly.** The play is measured with cover A fitted, and cover B gets a shim from a set in 0.05 mm steps: play =
   0.30 ± 0.035 mm, independent of all part tolerances. The part tolerances can then stay cheap (ISO 2768-m on most
   lengths). This is the general rule: **when a worst-case stack fails and the volume is small or medium, adjust
   (shim, set screw, selective assembly) instead of tightening every tolerance.**
6. **Sliding sleeve, 45 H7/g6.** 9 … 50 µm: free to slide, small tilt. Same temperature, no change hot. OK.
7. **Cover spigot, 72 H7/f7.** 30 … 90 µm clearance: easy assembly, the spigot still centres the cover within
   0.045 mm radially, which is enough for a lip seal (check the seal maker's run-out limit).
8. **Cover screws.** Screws in tapped holes = **fixed fastener**. The clearance (6.6 − 6.0 = 0.6 mm) must be shared:
   position Ø 0.3 mm at MMC for the tapped holes in the housing and Ø 0.3 mm for the cover holes, with the MMC
   bonus on the cover holes (up to Ø 0.48 at LMC 6.78). Writing ±x/±y coordinates instead would allow only
   ±0.106 mm per axis for the same 0.3 zone (Ø 0.3 / (2√2)) – position tolerances give 57 % more area.

The resulting fit table (`fit_table.csv`) goes onto the assembly drawing together with the shim note and the shrink
instruction ("shaft −196 °C, gear max. 120 °C").

### 8.3 References

Standards (check the current editions):

- ISO 286-1:2010 Geometrical product specifications (GPS) – ISO code system for tolerances on linear sizes – Part 1:
  Basis of tolerances, deviations and fits. ISO 286-2:2010 Part 2: Tables of standard tolerance classes and limit
  deviations for holes and shafts.
- ISO 2768-1:1989 General tolerances – linear and angular dimensions; ISO 2768-2:1989 geometrical tolerances
  (H, K, L).
- ISO 1101:2017 GPS – Geometrical tolerancing – form, orientation, location and run-out.
- ISO 5459:2011 GPS – Datums and datum systems.
- ISO 2692:2021 GPS – Maximum material requirement (MMR), least material requirement (LMR) and reciprocity.
- ISO 14405-1:2016 GPS – Dimensional tolerancing – linear sizes (envelope requirement (E), size modifiers).
- ISO 8015:2011 GPS – Fundamentals – concepts, principles and rules (independency principle).
- ISO 1:2016 GPS – Standard reference temperature (20 °C).
- ISO 1938-1:2015 GPS – Dimensional measuring equipment – plain limit gauges of linear size.
- ISO 14253-1:2017 GPS – Inspection by measurement – decision rules for verifying conformity.
- ISO 492:2014 Rolling bearings – radial bearings – geometrical product specifications and tolerance values.
- ISO 5753-1:2009 Rolling bearings – internal clearance.
- DIN 7190-1:2017 Interference fits – calculation and design rules (cylindrical press and shrink fits).
- ISO/IEC Guide 98-3 (GUM) Uncertainty of measurement.
- ASME Y14.5-2018 Dimensioning and tolerancing.
- VDA Volume 5 Capability of measurement processes; AIAG Measurement Systems Analysis (MSA), 4th ed.;
  AIAG Statistical Process Control (SPC), 2nd ed.

Books:

- Wittel, Jannasch, Voßiek, Spura: Roloff/Matek Maschinenelemente – chapters on tolerances, fits and interference
  fits (with table book).
- Fischer, B. R.: Mechanical Tolerance Stackup and Analysis, CRC Press.
- Budynas, Nisbett: Shigley's Mechanical Engineering Design – chapter on limits and fits and press / shrink fits.
- Henzold, G.: Geometrical Dimensioning and Tolerancing for Design, Manufacturing and Inspection, Elsevier.
- Montgomery, D. C.: Introduction to Statistical Quality Control, Wiley.
- Dietrich, Schulze: Statistical Procedures for Machine and Process Qualification, Hanser.

### 8.4 Glossary

| Term | Meaning |
|---|---|
| nominal size | the size named on the drawing, to which deviations refer |
| deviation (upper / lower) | ES, EI (hole), es, ei (shaft): limit minus nominal size |
| tolerance | difference between upper and lower limit; ITn is the standard tolerance of grade n |
| fundamental deviation | the deviation nearer to the zero line; defines the position of the zone (letter) |
| tolerance class (zone) | letter + grade, e.g. H7, k5 |
| hole basis / shaft basis | system with all holes H (EI = 0) / all shafts h (es = 0) |
| Δ rule | correction ES = −ei + Δ for K…U holes so that hole-basis and shaft-basis fits are identical |
| clearance / transition / interference fit | C_min ≥ 0 / C_min < 0 < C_max / C_max ≤ 0 |
| smoothing | loss of interference when roughness peaks are flattened during pressing (≈ 0.8·Rz per surface) |
| closing dimension | the result dimension of a tolerance chain (gap, play) |
| worst case (WC) | Σ t_i: guarantees 100 % of assemblies |
| RSS | √Σ t_i²: statistical sum for independent, centred, normal parts |
| modified RSS | RSS × factor (≈ 1.5) to allow for shifts and non-normal parts |
| Cp / Cpk | process capability without / with the actual centring |
| MMC / LMC | maximum / least material condition (smallest hole, largest shaft / the opposite) |
| bonus tolerance | extra position tolerance gained when a feature departs from MMC |
| floating / fixed fastener | clearance holes in both parts / thread or press fit in one part |
| Taylor principle | GO gauge = full form at MMC, NO-GO gauge = two points at LMC |
| envelope requirement (E) | the feature must not exceed the perfect form at MMC |
| independency principle | ISO 8015 default: size and form are toleranced separately |
| measurement uncertainty U | interval around a result that contains the true value with about 95 % (k = 2) |
| guard band | tolerance reduced by U for proving conformance (ISO 14253-1) |
| gauge R&R | repeatability and reproducibility of a measuring system; %GRR, ndc |
| SPC, x̄–R chart | control chart of subgroup means and ranges with limits from the stable process |
| reference temperature | 20 °C, at which all drawing sizes are defined (ISO 1) |
| shim | thin calibrated washer chosen at assembly to set a play or preload |
| selective assembly | parts measured and sorted into classes, then paired class by class |
