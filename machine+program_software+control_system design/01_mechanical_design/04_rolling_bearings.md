# M4 – Rolling bearings: types, loads, ISO 281 life, lubrication, contamination, static safety, friction, fits, clearance, arrangement, damage

> Field 1 *Mechanical design*, item 4. **Theory and program are combined:** every formula is followed by the code of
> `tools/bearing.py`, the command and the real output. MATLAB mirror: `tools/bearing.m`. Web: tab **M_P_C tools**, item 7.
> Python standard library only – offline. **All inputs are example values; catalogue data are typical values of common
> series – check the current catalogue of your supplier.** The life calculation follows ISO 281:2007 as far as its
> formulas are reproduced here; values marked "check" must be compared with the standard before a report is signed.

## Contents
0. How to use this guide with the program
1. Purpose – what a bearing calculation must prove
2. Bearing types, catalogue data and designations
3. Loads and equivalent load (with the M2 → M3 → M4 chain)
4. Life theory – L10, reliability, a_ISO, modified life
5. Lubrication and contamination
6. Static load, minimum load, speed and friction
7. Fits, internal clearance and preload
8. Bearing arrangement design for the compressor
9. Damage, monitoring and the twin
10. Verification and supplier tools
11. Complete worked selection example, checklists, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python bearing.py params` | Default input as JSON (copy → edit → `--in`) |
| `python bearing.py run --in my.json --out res` | Full calculation → `report.md`, `bearing.csv` (loads over the revolution), `loads.svg`, `selection.svg` |
| `python bearing.py examples` | Worked examples: report A and B, candidates, viscosity table, a_ISO table, equivalent load with axial force |
| `python bearing.py ch24` / `ch56` / `ch711` | Extra results of chapters 2–4 / 5–6 / 7–11 |
| `python bearing.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=7#mpc` | Same calculation with charts, candidate tables and dropdowns |

### 0.2 The chain M2 → M3 → M4
`crank.py` gives the crank-pin force **vector** at every crank angle (2° steps); `shaft.py` puts it on the shaft
(pin plane x = 110 mm) together with the belt load (637 N) and returns the two bearing reactions; `bearing.py`
turns the reaction **history** into one equivalent load per bearing (cubic mean for ball bearings, 10/3 for rollers) and
then into a life. Change the compressor in `crank.py` (bore, speed, masses) and the bearing life follows automatically.

### 0.3 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Catalogue of typical bearings | `CATALOGUE` |
| 3 | Equivalent dynamic / static load, X / Y / e | `equivalent_dynamic()`, `equivalent_static()`, `p_exponent()` |
| 3 | Load over one revolution, cubic mean, duty cycle | `loads_over_revolution()`, `mean_load()`, `duty_cycle_mean()` |
| 4 | Basic life, reliability factor, modified life | `basic_life()`, `a1()`, `a_iso()`, `modified_life()` |
| 5 | Viscosity–temperature, rated viscosity, contamination | `nu_from_VG()`, `nu1_rated()`, `EC` |
| 6 | Friction | `friction()`, `MU` |
| 7 | Internal clearance, operating clearance | `CLEARANCE`, `operating_clearance()` |
| 7–11 | Selection of candidates, analysis of the arrangement | `select()`, `analyse()` |
| – | Report, CSV, charts | `report_text()`, `run()` |
| 2–4 | Catalogue table, axial loads of X / O pairs, a1 from the Weibull formula, system life, Lundberg–Palmgren exponent, compressor duty cycle, load sensitivity | `catalogue_table()`, `pair_axial()`, `a1_formula()`, `system_life()`, `lp_exponent()`, `compressor_duty()`, `load_sensitivity()` |
| 5–6 | 6206 internal geometry, Stribeck Q_max, Hertz ellipse, Hamrock–Dowson film, film parameter Λ, minimum VG for κ, life vs cleanliness / temperature, relubrication rule, static check, speed factor, Palmgren friction, heat balance | `GEOM_6206`, `q_max()`, `contact_radii()`, `hertz_ellipse()`, `entrainment_speed()`, `hamrock_dowson()`, `film_parameter()`, `min_VG_for_kappa()`, `life_vs_cleanliness()`, `life_vs_temperature()`, `relub_interval_rule()`, `S0_RECOMMENDED`, `static_check()`, `speed_factor()`, `palmgren_friction()`, `heat_balance()` |
| 7–11 | Shaft fits Ø30, ring expansion, clearance fixes, spring preload, thermal growth + blocked force, heating temperature, press force, defect frequencies, fleet Weibull, bearing stiffness, worked example | `SHAFT_FITS_30`, `ring_expansion_factor()`, `clearance_fixes()`, `preload_force_spring()`, `ALPHA`, `thermal_growth()`, `axial_force_if_fixed()`, `heating_temperature()`, `press_force_bearing()`, `GEOM`, `defect_frequencies()`, `fleet_weibull()`, `ball_bearing_stiffness()`, `EXAMPLE`, `example_selection()` |
Example input of chapter 11: `tools/examples/bearing_example.json`.

### 0.4 What the self-test proves
1. L10 = (C/P)³: C/P = 10 → 1000 million revolutions = 16 667 h at 1000 rpm.
2. a1(90 %) = 1, a1(99 %) = 0.25 (ISO table).
3. P = F_r without axial load; with F_a/F_r > e: P = 0.56 F_r + Y F_a.
4. The Walther viscosity line passes exactly through ν(40 °C) = VG and ν(100 °C).
5. a_ISO rises with κ and with e_c C_u/P and is capped at 50.
6. Cubic mean of a constant load = the load; cubic mean ≥ arithmetic mean.
7. Hand-over: bearing reactions + loads = 0 in both planes; peak bearing load ≤ pin peak + belt.
8. Operating clearance = initial − fit reduction − thermal reduction.

## 1. Purpose – what a bearing calculation must prove

| Proof | Question | Chapter |
|---|---|---|
| Fatigue life | Does the bearing reach the required hours with the required reliability, lubrication and cleanliness? | 3, 4, 5 |
| Static safety | No permanent dents at peak / shock load (also at standstill) | 6 |
| Minimum load, speed | No skidding; below the speed limit | 6 |
| Friction, temperature | Power loss, operating temperature, viscosity → κ | 5, 6 |
| Fits, clearance | Rings do not creep; the bearing does not run with harmful preload | 7 |
| Arrangement | Axial location, thermal growth, mounting, sealing | 8 |
| Monitoring | Failure modes, defect frequencies for the twin | 9 |

**Default example** (`python bearing.py examples`): the two main bearings of the VC20 crankshaft (6206 + 6206), loads
over one revolution from M2 + M3, 1450 rpm, compressor oil ISO VG 100 at 80 °C, "slight contamination",
target 20 000 h at 90 % reliability.

| Result | A (pulley side) | B |
|---|---|---|
| Equivalent / peak radial load | 1211 / 2046 N | 869 / 1418 N |
| Basic life L10h | 54 179 h | 146 302 h |
| κ, a_ISO | 1.12, 5.14 | 1.12, 9.27 |
| Modified life L_nm | 278 273 h | 1 356 507 h |
| Static safety s0 (peak × 1.5) | 3.6 | 5.3 |
| Operating clearance (C3, k5, ΔT 10 K) | **−1.7 … 21.3 µm** | same |

The main bearings are far from their fatigue limit; the design questions are **clearance (possible preload)**,
lubrication, contamination and the conrod bearing (chapter 8). The smallest bore-30 bearing that meets 20 000 h is a
6006 (L_nm 54 263 h).


---

## 2 Bearing types, catalogue data and designations

> Program: `tools/bearing.py` (`CATALOGUE`, `catalogue_table()`); extra results of chapters 2–4: `python bearing.py ch24`.
> All catalogue values are **typical values of common series (rounded) – check the current catalogue of your supplier.**

### 2.1 What a rolling bearing does

A rolling bearing carries a load between a rotating and a fixed part through **rolling elements** (balls or rollers)
between two **rings** (inner ring, outer ring). A **cage** keeps the elements apart. Rolling friction is small
(μ ≈ 0.001–0.002), so the bearing runs cool and starts easily. The price: the contact areas are very small, the contact
pressure is very high (1500–3500 MPa) and the material finally fails by **rolling-contact fatigue** (pitting, spalling).
Chapter 4 calculates when.

```
        outer ring
   ┌──────────────────┐
   │   ●   ●   ●   ●  │  ← balls in a cage
   └──────────────────┘
        inner ring  (fits on the shaft)
```

### 2.2 Bearing types – what each can do

| Type (example series) | Radial load | Axial load | Speed | Misalignment allowed (check catalogue) | Typical use |
|---|---|---|---|---|---|
| Deep groove ball (60, 62, 63) | medium | medium, both directions | very high | 2–10 arcmin | Motors, compressors, pumps – the standard |
| Angular contact ball, single row (72, 73 B, 40°) | medium | high, **one direction** | high | ≈ 2 arcmin | Pairs in pumps, spindles (X or O pair) |
| Angular contact double row (32, 33) | medium | medium, both | medium | ≈ 2 arcmin | Short shafts, wheel hubs |
| Four-point contact (QJ) | low | high, both | high | ≈ 2 arcmin | Axial bearing next to a radial roller bearing |
| Cylindrical roller NU / N | **high** | none (NU, N) | high | 3–4 arcmin | Floating bearing, heavy radial load |
| Cylindrical roller NJ / NUP | high | small (NJ one, NUP both directions) | high | 3–4 arcmin | Locating with small axial load |
| Tapered roller (302, 303, 322) | high | high, one direction | medium | ≈ 2 arcmin | Gearboxes, wheels, adjusted pairs |
| Spherical roller (222, 223) | very high | medium | medium | **1.5–2.5°** | Heavy shafts, misalignment, shaft deflection |
| Needle roller (NK, HK) | high (small section) | none | high | very small | Little radial space, conrod small ends |
| Thrust ball / thrust roller (511, 811, 293) | none / little | high | low–medium | small | Pure axial load |

**Rule:** ball bearings for speed and low cost, roller bearings for heavy load and long life, spherical bearings for
misalignment, pairs (angular / tapered) for stiff axial location.

### 2.3 Bearing arrangements

| Arrangement | How | When |
|---|---|---|
| **Locating / floating** | Bearing A fixes the shaft axially (both rings clamped), bearing B can slide axially (outer ring in a clearance fit, or an NU roller bearing whose rollers slide on the inner ring) | Standard for shafts that grow with temperature – the compressor crankshaft |
| **Adjusted, X (face-to-face)** | Two angular / tapered bearings, load lines cross between the bearings | Short shafts, small moment stiffness, easy adjustment |
| **Adjusted, O (back-to-back)** | Load lines cross outside the bearings → large effective spread | High moment stiffness: overhung pinions, spindles |
| **Floating** | Both bearings allow small axial movement (e.g. two NJ bearings mirror-mounted, or two deep groove with a few 0.1 mm end play) | Herringbone gears, simple shafts with small axial play |

Thermal growth example (M1 ch. 21): steel shaft 120 mm between bearings, ΔT 40 K → ΔL = 11.5·10⁻⁶ · 120 · 40 = 0.055 mm.
Two locating bearings would press this length against each other → overload. One bearing **must float**.

### 2.4 Catalogue data – the meaning of the numbers

| Symbol | Name | Meaning |
|---|---|---|
| d, D, B | Bore, outside diameter, width | Boundary dimensions (ISO 15 for radial bearings) |
| **C** | Basic dynamic load rating | Constant load at which 90 % of identical bearings reach 10⁶ revolutions (fatigue) |
| **C0** | Basic static load rating | Static load that gives a contact stress of 4200 MPa (ball) / 4000 MPa (roller) – a permanent dent of ≈ 0.0001 × rolling element diameter |
| **Cu** (or Pu) | Fatigue load limit | Load below which, in a clean, well lubricated bearing, no fatigue happens (contact stress ≈ 1500 MPa). Used in a_ISO (ch. 4.6) |
| f0 | Calculation factor | Used for the axial-load factors of deep groove ball bearings (ch. 3.3) |
| n_ref | Reference speed | Thermal speed: the speed where the bearing reaches a reference temperature under reference conditions |
| n_lim | Limiting speed | Mechanical limit (cage, seals, element strength) – never exceed it |
| e, Y, Y0 | Axial-load factors | For angular / tapered bearings (ch. 3) |

### 2.5 In the program – the catalogue

```python
CATALOGUE = {
    "6005":   {"type": "ball", "d": 25, "D": 47, "B": 12, "C": 11.9, "C0": 6.55, "Cu": 0.275, "f0": 14.0, "n_lim": 14000, "m": 0.08},
    "6205":   {"type": "ball", "d": 25, "D": 52, "B": 15, "C": 14.8, "C0": 7.8, "Cu": 0.335, "f0": 14.0, "n_lim": 12000, "m": 0.13},
    "6305":   {"type": "ball", "d": 25, "D": 62, "B": 17, "C": 23.4, "C0": 11.6, "Cu": 0.49, "f0": 12.0, "n_lim": 10000, "m": 0.23},
    "6006":   {"type": "ball", "d": 30, "D": 55, "B": 13, "C": 13.8, "C0": 8.3, "Cu": 0.355, "f0": 15.0, "n_lim": 12000, "m": 0.12},
    "6206":   {"type": "ball", "d": 30, "D": 62, "B": 16, "C": 20.3, "C0": 11.2, "Cu": 0.475, "f0": 14.0, "n_lim": 10000, "m": 0.20},
    ...
    "NU206":  {"type": "cyl_roller", "d": 30, "D": 62, "B": 16, "C": 44.0, "C0": 36.5, "Cu": 4.5, "n_lim": 11000, "m": 0.21},
    "30206":  {"type": "taper", "d": 30, "D": 62, "B": 17.25, "C": 40.2, "C0": 44.0, "Cu": 4.8, "e": 0.37, "Y": 1.6, "n_lim": 8500, "m": 0.23},
}
```
Add your supplier's bearings here (same keys) – every calculation in this guide then uses them.

**Run it:** `python bearing.py ch24` (first block)
```
name    type        d   D   B      C kN  C0 kN  Cu kN  C/C0  n_lim
6006    ball        30  55    13   13.8    8.3  0.355  1.66  12000
6206    ball        30  62    16   20.3   11.2  0.475  1.81  10000
6306    ball        30  72    19   29.6   16.0  0.670  1.85   9000
NU206   cyl_roller  30  62    16   44.0   36.5  4.500  1.21  11000
NU306   cyl_roller  30  72    19   58.5   48.0  6.200  1.22   9500
7206B   ang_ball40  30  62    16   23.8   15.6  0.655  1.53   9500
30206   taper       30  62 17.25   40.2   44.0  4.800  0.91   8500
```
**Interpretation.** Same bore 30 mm, same envelope 62 × 16 mm: the cylindrical roller NU206 has **2.2 × the dynamic
rating** of the ball bearing 6206 (44.0 vs 20.3 kN) and almost 10 × the fatigue load limit Cu – line contact is much
stronger than point contact. Because life ∝ (C/P)³ or (C/P)^(10/3), this means about 13 × the basic life at the same
load. The ball bearing wins on speed, axial ability in both directions, price and noise.

### 2.6 Designations and suffixes (common, all makers similar – check the maker's key)

```
   6  2  06  -2RS1  C3  /P6
   │  │  │     │    │    └─ tolerance class (P0 normal, P6, P5, P4 – ISO 492)
   │  │  │     │    └────── radial internal clearance (C2 < CN < C3 < C4)
   │  │  │     └─────────── seals: 2RS = 2 rubber contact seals, 2Z = 2 metal shields
   │  │  └───────────────── bore code: 06 × 5 = 30 mm (00 = 10, 01 = 12, 02 = 15, 03 = 17 mm)
   │  └──────────────────── dimension series (0 extra light, 2 light, 3 medium)
   └─────────────────────── type: 6 deep groove, 7 angular, N.. cylindrical, 3 tapered, 2 spherical, 5 thrust
```
| Suffix | Meaning |
|---|---|
| E / EC / ECP | Optimised internal design (larger rollers) – higher C |
| J / TN9 / M / P | Cage: pressed steel / glass-fibre polyamide / machined brass / polyamide (ECP) |
| B / BE | Angular contact 40° |
| C3 | Larger internal clearance – for tight fits and warm inner rings (compressors, motors) |
| P6, P5 | Tighter running accuracy: machine tools, spindles |
| HT / GJN | High-temperature grease |

**ISO 492 tolerance classes:** Normal (P0) is enough for compressors, motors and gearboxes; P6 for quieter motors and
precision gearboxes; P5 / P4 for machine-tool spindles (guide 18). Tighter classes cost 1.5–5 × more.

### 2.7 How to read a catalogue page (checklist)
1. Boundary dimensions d, D, B and the chamfer r_min (shaft fillet must be **smaller** than r_min – M3 ch. 2).
2. C, C0, Cu for the life and static calculation (ch. 3–4).
3. Reference and limiting speed (with oil / grease, with seals – seals lower the speed).
4. Abutment dimensions d_a min, D_a max: shoulder heights for the shaft and housing (M3 drawing).
5. Calculation factors f0, e, Y, Y0.
6. Mass, available variants (seals, clearance, cage), and the maker's recommended fits.

### 2.8 Real manufacturing / practice
- Buy bearings, never make them. Order with the full designation including clearance and seal suffix.
- Store in the original packing, horizontal, dry, < 3 years (grease ageing – check the maker).
- Mount with the correct tools: press on the ring that has the interference fit; heat the inner ring with an induction
  heater to ≤ 110–120 °C (check the maker); never hit the rolling elements.
- One supplier for one machine type keeps the spare parts simple.

### 2.9 MATLAB equivalent
```matlab
cat = struct('name',{'6206','NU206'}, 'C',{20.3,44.0}, 'C0',{11.2,36.5}, 'Cu',{0.475,4.5});
for k = 1:numel(cat), fprintf('%s C/C0 = %.2f\n', cat(k).name, cat(k).C/cat(k).C0); end
```

### 2.10 Check questions
1. Why does a cylindrical roller bearing of the same size have a much higher C than a ball bearing?
2. Which bearing of the compressor crankshaft must be the floating bearing, and why?
3. Decode 6306-2Z/C3.
4. Why can an NU206 not be the locating bearing?

---

## 3 Loads and equivalent load

> Program: `equivalent_dynamic()`, `equivalent_static()`, `pair_axial()`, `mean_load()`, `loads_over_revolution()`,
> `duty_cycle_mean()`, `compressor_duty()`.

### 3.1 Where the loads come from

The bearing loads are the **shaft reactions** of M3 (radial) plus the axial loads (helical gears, belt misalignment,
thrust, gravity of a vertical shaft). For the compressor the radial loads change with the crank angle (M2), so the
bearing sees a **load that moves around the ring and changes size every revolution**. Chapter 3.6 turns this into one
equivalent load.

### 3.2 Equivalent dynamic load – the idea

C is defined for a **pure radial** load (radial bearings). A real bearing often has radial **and** axial load. The
**equivalent dynamic load P** is the pure radial load that gives the **same life** as the real combined load:

  **P = X·Fr + Y·Fa**

X and Y come from the internal load distribution. Small axial load does not change the life (P = Fr) because the
rolling elements are already loaded by the radial load; above a limit **e** the axial load counts.

### 3.3 Why the factors of a deep groove ball bearing depend on Fa/C0 – derivation idea

A deep groove ball bearing has a **contact angle α ≈ 0° under radial load**. An axial load pushes the inner ring
sideways; because the groove radius is a little larger than the ball radius (osculation ≈ 0.52 × ball diameter) the
ball climbs up the groove side and the **contact angle grows** with the axial load. A larger contact angle means the axial
load is carried more efficiently (smaller Y) and the limit e grows. The amount of climbing depends on the axial load
relative to the bearing size – that is why the table uses **f0·Fa/C0** (f0 contains the internal geometry):

| f0·Fa/C0 | 0.172 | 0.345 | 0.689 | 1.03 | 1.38 | 2.07 | 3.45 | 5.17 | 6.89 |
|---|---|---|---|---|---|---|---|---|---|
| e | 0.19 | 0.22 | 0.26 | 0.28 | 0.30 | 0.34 | 0.38 | 0.42 | 0.44 |
| Y (X = 0.56) | 2.30 | 1.99 | 1.71 | 1.55 | 1.45 | 1.31 | 1.15 | 1.04 | 1.00 |
(ISO 281 values for single-row deep groove ball bearings with normal clearance – check the standard / catalogue;
C3 clearance gives a slightly larger contact angle and different factors in some catalogues.)

**Formula box – deep groove ball bearing**
- Fa/Fr ≤ e: **P = Fr**
- Fa/Fr > e: **P = 0.56·Fr + Y·Fa**, e and Y interpolated from f0·Fa/C0
- Static: **P0 = 0.6·Fr + 0.5·Fa**, but P0 ≥ Fr; static safety **s0 = C0/P0** (≥ 1 normal, ≥ 2 quiet running /
  shock, ≥ 0.5–1 slow and smooth – check the catalogue)

### 3.4 In the program
```python
def equivalent_dynamic(b, Fr, Fa):
    t = b["type"]
    if Fa <= 0 or t == "cyl_roller":
        return {"P": Fr, "X": 1.0, "Y": 0.0, "e": None}
    if t == "ball":
        q = b["f0"] * Fa / (b["C0"] * 1000)
        pts = _DG
        if q <= pts[0][0]:
            e, Y = pts[0][1], pts[0][2]
        elif q >= pts[-1][0]:
            e, Y = pts[-1][1], pts[-1][2]
        else:
            for (q1, e1, y1), (q2, e2, y2) in zip(pts, pts[1:]):
                if q1 <= q <= q2:
                    t_ = (q - q1) / (q2 - q1)
                    e, Y = e1 + t_ * (e2 - e1), y1 + t_ * (y2 - y1)
                    break
        if Fa / Fr <= e:
            return {"P": Fr, "X": 1.0, "Y": 0.0, "e": e}
        return {"P": 0.56 * Fr + Y * Fa, "X": 0.56, "Y": Y, "e": e}
    if t == "ang_ball40":
        if Fa / Fr <= 1.14:
            return {"P": Fr, "X": 1.0, "Y": 0.0, "e": 1.14}
        return {"P": 0.35 * Fr + 0.57 * Fa, "X": 0.35, "Y": 0.57, "e": 1.14}
    ...
```
```python
def equivalent_static(b, Fr, Fa):
    t = b["type"]
    if t == "ball":
        P0 = 0.6 * Fr + 0.5 * Fa
    elif t == "ang_ball40":
        P0 = 0.5 * Fr + 0.26 * Fa
    elif t == "taper":
        P0 = 0.5 * Fr + 0.5 * b["Y"] * 0.55 * Fa      # Y0 ~ 0.55 Y (typical catalogue relation, check)
    else:
        P0 = Fr
    return max(P0, Fr)
```

**Run it:** `python bearing.py examples` (last block) and `python bearing.py ch24`
```
## Equivalent load of a 6206 with axial load (Fr 1500 N)
  Fa    0 N: e -, X 1.00, Y 0.00 -> P 1500 N
  Fa  200 N: e 0.204, X 1.00, Y 0.00 -> P 1500 N
  Fa  500 N: e 0.253, X 0.56, Y 1.76 -> P 1721 N
  Fa 1000 N: e 0.293, X 0.56, Y 1.49 -> P 2327 N
```
```
  Fa    0: P 1500 N, P0 1500 N, s0 = C0/P0 = 7.47
  Fa 1000: P 2327 N, P0 1500 N, s0 = C0/P0 = 7.47
```
**Interpretation.**
- Fa = 200 N: Fa/Fr = 0.133 < e = 0.204 → no effect on the life.
- Fa = 500 N: Fa/Fr = 0.333 > e = 0.253 → P = 0.56·1500 + 1.76·500 = 1721 N, **+15 %**. Life ∝ P⁻³ → life × 0.66.
- Fa = 1000 N: P = 2327 N, **+55 %** → life × 0.27. Axial load is expensive for a deep groove ball bearing.
- The static load P0 stays 1500 N (0.6·1500 + 0.5·1000 = 1400 < Fr) – static safety 7.47 is no problem.

### 3.5 Angular contact and tapered bearings – induced axial force and pairs

An angular contact or tapered bearing has a **built-in contact angle α**. A radial load Fr therefore creates an
**internal (induced) axial force** that pushes the rings apart. A single bearing cannot run alone; it is always used
with a second bearing that takes this force (X or O pair).

**Formula box – induced axial force (typical catalogue rules, check the maker)**
- Tapered roller bearing: **F_ad = 0.5·Fr / Y**
- Angular contact ball bearing 40° (B series): **F_ad ≈ 1.14·Fr**  (rule used by several makers for pairs; check)
- Tapered: Fa/Fr ≤ e → P = Fr; Fa/Fr > e → **P = 0.4·Fr + Y·Fa**
- ACBB 40°: Fa/Fr ≤ 1.14 → P = Fr; else **P = 0.35·Fr + 0.57·Fa**

**Axial load distribution in a pair (same Y), external load Ka pushing the shaft towards bearing B:**
- Case 1: F_adA + Ka ≥ F_adB → **Fa_A = F_adA, Fa_B = F_adA + Ka**
- Case 2: F_adA + Ka < F_adB → **Fa_A = F_adB − Ka, Fa_B = F_adB**

Derivation: the shaft is in axial equilibrium. Each bearing must carry at least its own induced force (otherwise its
rollers lose contact). The bearing that is pushed by the sum "other bearing's induced force + Ka" carries that sum; the
other one carries only its own minimum.

**In the program (new function, chapter 3)**
```python
def pair_axial(FrA, FrB, Ka, Y, arrangement="O"):
    fa, fb = 0.5 * FrA / Y, 0.5 * FrB / Y
    if fa + Ka >= fb:
        FaA, FaB, case = fa, fa + Ka, 1
    else:
        FaA, FaB, case = fb - Ka, fb, 2
    return {"F_adA": fa, "F_adB": fb, "Fa_A": FaA, "Fa_B": FaB, "case": case, "arrangement": arrangement}
```
**Run it:** `python bearing.py ch24` – tapered pair 30206 (Y 1.6), FrA 2000 N, FrB 1200 N (example values)
```
  Ka     0: F_adA 625.0 F_adB 375.0 -> case 1: Fa_A 625.0, Fa_B 625.0 N; P_A 2000, P_B 1480 N
  Ka   300: F_adA 625.0 F_adB 375.0 -> case 1: Fa_A 625.0, Fa_B 925.0 N; P_A 2000, P_B 1960 N
  Ka  -500: F_adA 625.0 F_adB 375.0 -> case 2: Fa_A 875.0, Fa_B 375.0 N; P_A 2200, P_B 1200 N
```
**Interpretation.** Even **without external axial load** bearing B gets 625 N axial load – the induced force of the
more loaded bearing A. B's equivalent load is then 0.4·1200 + 1.6·625 = 1480 N instead of 1200 N. When designing a
tapered pair always check both bearings with the pair rule, never with Fa = 0.
The arrangement (X or O) decides the stiffness and which way each bearing can carry the shaft; it is fixed by the
direction of Ka in your drawing. The rules above are for the same Y; makers give the general case.

**Practice:** an adjusted pair is set to a small end play or a preload at assembly (shims, nut). Too much preload →
heat and short life; too much play → poor load sharing and noise. Measure the end play with a dial gauge, or the
friction torque when preloaded (check the maker's setting values).

### 3.6 Variable load over one revolution – the cubic mean

The compressor main bearing load changes with the crank angle. Damage per revolution is proportional to F^p (from the
life law L ∝ P^−p). For equal damage of the real load and a constant equivalent load P_m over the same number of
revolutions:

  Σ F_k^p · ΔN = P_m^p · N   →   **P_m = ( (1/N) Σ F_k^p )^(1/p)**   (p = 3 ball, 10/3 roller)

For a load that varies **within one revolution** at constant speed, ΔN is the same for every angle step → P_m is the
p-th-power mean over the crank angle. Because F^3 weights the large values strongly, **P_m lies between the arithmetic
mean and the peak**.

**In the program**
```python
def mean_load(F, p=3.0):
    """Equivalent constant load for a load varying over one revolution at constant speed: P_m = (mean F^p)^(1/p).
    (Derived from equal damage: L ~ (C/P)^p, damage per revolution ~ F^p.)"""
    return (sum(f ** p for f in F) / len(F)) ** (1 / p)
```
```python
def loads_over_revolution(step_deg=2.0):
    import crank
    import shaft
    R = crank.compute_all()
    P = dict(shaft.DEFAULT)
    belt = [f for f in P["forces"] if "belt" in f[3]][0]
    every = max(1, int(round(step_deg / R["P"]["step_deg"])))
    th, FA, FB = [], [], []
    for r in R["rows"][::every]:
        fx, fy = r["F_pin"]                      # frame axes: x horizontal, y vertical (crank.py)
        forces = [belt, [P["torque_out_x"], fy, fx, "pin"]]      # shaft plane y = vertical, z = horizontal
        Rr = shaft.reactions(dict(P, forces=forces))
        th.append(math.degrees(r["theta"]))
        FA.append(math.hypot(Rr["y"][0], Rr["z"][0]))
        FB.append(math.hypot(Rr["y"][1], Rr["z"][1]))
    return th, FA, FB
```
This is the full chain **M2 → M3 → M4**: the crank-pin force vector at every crank angle (crank.py) is put on the
shaft model (shaft.py, pin plane x = 110 mm, belt load 637 N on the pulley) and the two bearing reactions are computed.

**Run it:** `python bearing.py ch24`
```
  A: min 717, max 2046, arithmetic mean 1042, cubic mean 1211, 10/3 mean 1240 N
  B: min 189, max 1418, arithmetic mean 618, cubic mean 869, 10/3 mean 898 N
  peak of A at theta 8 deg
```
**Interpretation.**
- Bearing A (next to the pulley) carries more because it takes the belt load and its share of the pin load.
- Peak 2046 N but equivalent 1211 N: designing with the peak would give (2046/1211)³ = 4.8 × too short a life
  → oversized bearings. Designing with the arithmetic mean (1042 N) would be (1211/1042)³ = 1.57 × too optimistic.
  **Always use the p-th-power mean for fatigue, the peak for the static check and the fits.**
- The peak at θ ≈ 8° matches M2: cylinder 1 just past TDC with full gas pressure.
- `bearing.csv` (from `python bearing.py run`) contains the load at every 2° for SOLIDWORKS / Adams comparison.

### 3.7 Duty cycle with different speeds and loads

For operating states i with load P_i, speed n_i and time share q_i, the revolutions count:

  **P_m = ( Σ P_i^p · n_i · q_i / Σ n_i · q_i )^(1/p)**,   **n_m = Σ n_i · q_i / Σ q_i**

```python
def duty_cycle_mean(cases):
    p = 3.0
    num = sum(Pi ** p * n * q for Pi, n, q in cases)
    den = sum(n * q for Pi, n, q in cases)
    return (num / den) ** (1 / p), den / sum(q for *_, q in cases)
```
**Compressor example (new function `compressor_duty()`):** loaded running 55 % of the clock time (P = 1211 N), unloaded
running 15 % (pressure switch open, only belt + inertia, P ≈ 450 N – example value), stopped 30 %.

**Run it:** `python bearing.py ch24`
```
  P_m 1123 N, n running 1450, n clock 1015.0 rpm, L10 5912 Mrev = 67957 h running = 97082 h clock
```
**Interpretation.** The unloaded phases lower the mean load from 1211 to 1123 N; the stopped time adds clock hours but
no revolutions. Specify the life target in **running hours** (or revolutions) and state the duty in the requirement list
(M1 ch. 17), otherwise the supplier and you compare different numbers.

### 3.8 Real manufacturing / practice
- Belt tension is the largest controllable bearing load in the compressor: over-tensioned belts are the most common
  cause of early motor and compressor bearing failures. Tension with a gauge to the belt maker's value.
- Misalignment of pulleys creates axial load on the bearings – check with a straight edge / laser tool (≤ 0.5° – check
  the belt maker).
- Axial location: the locating bearing must take the axial load in both directions – clamp its inner ring (shoulder +
  nut / circlip) and its outer ring (shoulder + cover).

### 3.9 MATLAB equivalent
```matlab
T = readtable('bearing.csv');                 % from python bearing.py run
PmA = mean(T.Fr_A_N.^3)^(1/3);  PmB = mean(T.Fr_B_N.^3)^(1/3);
fprintf('A %.0f N, B %.0f N\n', PmA, PmB)     % expect about 1211 and 869 N (2-degree steps)
```

### 3.10 Check questions
1. Why is Fa = 200 N "free" for the 6206 at Fr = 1500 N, but Fa = 500 N not?
2. A tapered pair has no external axial load. Why does one bearing still carry axial load?
3. Explain why the cubic mean (1211 N) lies between the arithmetic mean (1042 N) and the peak (2046 N).
4. Which load do you use for the static safety, which for the life?

---

## 4 Life theory

> Program: `basic_life()`, `a1()`, `a1_formula()`, `system_life()`, `lp_exponent()`, `nu_from_VG()`, `nu1_rated()`,
> `a_iso()`, `modified_life()`, `select()`, `load_sensitivity()`.

### 4.1 Rolling-contact fatigue – what fails

Every time a ball passes, the material under the contact is stressed. The maximum **shear stress lies below the surface**
(about 0.5 × contact half-width deep, Hertz – M1 ch. 25). After millions of cycles a crack starts at an inclusion under
the surface, grows to the surface and a flake breaks out (**spalling**). The bearing gets noisy and hot, and finally
fails. Clean steel (vacuum-degassed 100Cr6), hardness 58–65 HRC and a full oil film delay this.

Because inclusions are scattered randomly, the lives of identical bearings scatter a lot (factor 20 between the
shortest and longest of a large lot). So life is a **statistical** quantity: **L10 = life reached by 90 % of the bearings**.

### 4.2 Lundberg–Palmgren – the origin of L = (C/P)^p

Lundberg and Palmgren (1947) combined Weibull's weakest-link theory with Hertz contact stress. The probability of
survival S after N cycles of a stressed volume V with orthogonal shear stress τ0 at depth z0:

  **ln(1/S) ∝ τ0^c · N^e · V / z0^h**

With Hertz contact (stresses and depths as powers of the load Q) and S = 0.9 fixed, solving for N gives N ∝ Q^(−p):

- point contact (balls): **p = (c − h + 2) / (3e)**
- line contact (rollers): **p = (c − h + 1) / (2e)**

With their test-fitted constants c = 31/3, h = 7/3, e = 10/9:

**Run it:** `python bearing.py ch24`
```
== 4 Lundberg-Palmgren exponents: point 3.000, line 4.050 (ISO uses 10/3 = 3.333 for rollers)
```
For rollers the real contact is partly point, partly line (edge profiles, crowning), so the standard uses the
compromise **p = 10/3**.

```python
def lp_exponent(c=31 / 3, h=7 / 3, e=10 / 9, contact="point"):
    if contact == "point":
        return (c - h + 2) / (3 * e)
    return (c - h + 1) / (2 * e)
```

### 4.3 Basic rating life

**Formula box**
- **L10 = (C/P)^p** [10⁶ revolutions], p = 3 (ball), 10/3 (roller)
- **L10h = 10⁶ · L10 / (60 · n)** [hours], n in rpm
- C in N (catalogue kN × 1000), P = equivalent dynamic load (ch. 3)

```python
def basic_life(C_kN, P_N, p, rpm):
    """L10 = (C/P)^p million revolutions, L10h = 1e6 L10 / (60 n) hours."""
    L10 = (C_kN * 1000 / P_N) ** p
    return L10, L10 * 1e6 / (60 * rpm)
```
**Run it:** `python bearing.py ch24` and `python bearing.py examples`
```
== 4 6206, P 1211 N, 1450 rpm: C/P 16.76, L10 4710 Mrev, L10h 54142 h
```
```
- basic life L10 4714 Mrev = 54179 h                     (report, unrounded P = 1210.9 N)
```
**Interpretation.** C/P = 16.8 → L10 = 16.8³ ≈ 4710 million revolutions = 54 000 h at 1450 rpm. Note how sensitive the
cube is: the program's unrounded load gives 54 179 h, the rounded 1211 N gives 54 142 h.

### 4.4 Sensitivity to the load

L ∝ P^(−p) → **L2/L1 = (P2/P1)^(−p)**. Life halves when the load rises by 2^(1/3) − 1 = 26 %.

**Run it:** `python bearing.py ch24`
```
== 4 load +26 % -> life x 0.500; load factor that halves life 1.260; +10 % load -> life x 0.751; roller +10 % -> x 0.728
```
**Practice:** +10 % belt tension or a 10 % higher discharge pressure costs 25 % of the bearing life. Load uncertainty
(M1 ch. 6) dominates the life prediction – a ± 20 % load error is a factor 0.58 … 1.73 in life.

### 4.5 Reliability – the factor a1

The scatter follows a 3-parameter Weibull distribution. ISO 281:2007 uses slope β = 1.5 and a failure-free life of
0.05·L10. From F(L) = 1 − exp(−((L − L0)/η)^β) one gets the life for reliability R relative to L10:

  **a1 = 0.95 · ( ln(1/R) / ln(1/0.9) )^(1/1.5) + 0.05**

```python
def a1_formula(R):
    return 0.95 * (math.log(1 / R) / math.log(1 / 0.9)) ** (1 / 1.5) + 0.05
```
**Run it:** `python bearing.py ch24`
```
  R 90.00 %: table 1.000, formula 1.000
  R 95.00 %: table 0.640, formula 0.638
  R 96.00 %: table 0.550, formula 0.555
  R 97.00 %: table 0.470, formula 0.465
  R 98.00 %: table 0.370, formula 0.366
  R 99.00 %: table 0.250, formula 0.248
  R 99.50 %: table 0.175, formula 0.175
  R 99.90 %: table 0.093, formula 0.093
  R 99.95 %: table 0.077, formula 0.077
```
The program uses the table (`a1()`, interpolated) – the formula reproduces it within 0.005, which confirms the model.
**Choose R by consequence:** 90 % for normal industrial machines (L10), 95–99 % for products sold in large numbers
(warranty cost, M1 ch. 27) or when a failure is dangerous. 99 % reliability = a1 0.25 → 4 × shorter life to plan for.

### 4.6 System life of several bearings

A machine fails when the **first** of its bearings fails. With the same Weibull slope e = 1.5:

  **L_sys = ( Σ L_i^(−e) )^(−1/e)**

```python
def system_life(lives, e=1.5):
    return sum(L ** -e for L in lives) ** (-1 / e)
```
**Run it:** `python bearing.py ch24`
```
== 4 system life: two main bearings L10h 54179 and 146302 h -> 47314 h; + 2 conrod bearings 30000 h each -> 16265 h
```
**Interpretation.** The two main bearings together: 47 314 h – shorter than the weaker one alone (54 179 h). If the
compressor also has two conrod big-end bearings of 30 000 h each (example value; their loads come from M2 rod forces),
the system L10 drops to 16 265 h – **the conrod bearings decide the product life**, not the main bearings. Calculate
every bearing and give the system life in the product data.

### 4.7 Modified life – ISO 281:2007

The basic life ignores lubrication, cleanliness and the fatigue limit. ISO 281:2007 adds a factor a_ISO:

  **L_nm = a1 · a_ISO · L10**

a_ISO depends on three things:

| Input | Symbol | Meaning |
|---|---|---|
| Viscosity ratio | κ = ν / ν1 | ν = actual oil viscosity at operating temperature; ν1 = viscosity needed for a separating film (depends on speed and size) |
| Contamination factor | e_c | 1 = perfectly clean … 0 = very dirty (particles dent the raceways) |
| Fatigue load ratio | e_c·Cu / P | how far the load is above the fatigue load limit |

**Formula box**
- ν1 = 45000 · n^−0.83 · d_m^−0.5 (n < 1000 rpm); **ν1 = 4500 · n^−0.5 · d_m^−0.5** (n ≥ 1000 rpm), d_m = (d + D)/2 [mm], ν in mm²/s
- Ball: **a_ISO = 0.1 · [1 − (2.5671 − k1/κ^e1)^0.83 · (e_c·Cu/P)^(1/3)]^(−9.3)**
- Roller: **a_ISO = 0.1 · [1 − (1.5859 − k1/κ^e1) · (e_c·Cu/P)^0.4]^(−9.185)**
- κ limited to 0.1 … 4, a_ISO ≤ 50; constants k1, e1 by κ range (in the code; **check ISO 281:2007**)

```python
def nu1_rated(rpm, dm):
    if rpm < 1000:
        return 45000 * rpm ** -0.83 * dm ** -0.5
    return 4500 * rpm ** -0.5 * dm ** -0.5
```
```python
def a_iso(kappa, ecCuP, kind="ball"):
    k = max(0.1, min(4.0, kappa))
    if kind == "ball":
        if k < 0.4:
            k1, e1 = 2.2649, 0.054381
        elif k < 1:
            k1, e1 = 1.9987, 0.19087
        else:
            k1, e1 = 1.9987, 0.071739
        base = max(0.0, 2.5671 - k1 / k ** e1)
        inner = base ** 0.83 * ecCuP ** (1 / 3)
        expo = -9.3
    else:
        ...
    if inner >= 1:
        return 50.0
    return min(50.0, 0.1 * (1 - inner) ** expo)
```
```python
def modified_life(b, P_N, rpm, P):
    p = p_exponent(b)
    L10, L10h = basic_life(b["C"], P_N, p, rpm)
    dm = (b["d"] + b["D"]) / 2
    nu = nu_from_VG(P["oil_VG"], P["oil_temp_C"])
    nu1 = nu1_rated(rpm, dm)
    kappa = nu / nu1
    ec = EC[P["cleanliness"]]
    x = ec * b["Cu"] * 1000 / P_N
    aI = a_iso(kappa, x, "ball" if "ball" in b["type"] else "roller")
    A = a1(P["reliability_pct"])
    return {"L10_Mrev": L10, "L10h": L10h, "dm": dm, "nu": nu, "nu1": nu1, "kappa": kappa, "ec": ec,
            "ecCu_P": x, "a_iso": aI, "a1": A, "Lnmh": A * aI * L10h}
```

**Run it:** `python bearing.py examples` (a_ISO table)
```
## a_ISO for a ball bearing vs kappa and e_c Cu/P
  e_c Cu/P 0.01: k 0.2 -> 0.13, k 0.5 -> 0.21, k 1.0 -> 0.38, k 2.0 -> 0.47, k 4.0 -> 0.57
  e_c Cu/P 0.05: k 0.2 -> 0.16, k 0.5 -> 0.37, k 1.0 -> 1.14, k 2.0 -> 1.70, k 4.0 -> 2.50
  e_c Cu/P 0.10: k 0.2 -> 0.19, k 0.5 -> 0.53, k 1.0 -> 2.43, k 2.0 -> 4.20, k 4.0 -> 7.20
  e_c Cu/P 0.20: k 0.2 -> 0.22, k 0.5 -> 0.86, k 1.0 -> 6.92, k 2.0 -> 15.11, k 4.0 -> 33.28
```
**Interpretation of the table.**
- κ < 1 (thin oil film): a_ISO < 1 even for clean bearings – **the life becomes shorter than L10**.
- Heavily loaded or dirty (e_c·Cu/P = 0.01): a_ISO stays below 0.6 whatever the oil – contamination kills life.
- Light load, clean, good oil (0.2, κ ≥ 2): a_ISO 15–33 – the bearing works close to its fatigue limit.

**Run it:** the compressor main bearing A (6206, P = 1211 N, ISO VG 100 at 80 °C, slight contamination) –
`python bearing.py examples`
```
- basic life L10 4714 Mrev = 54179 h
- lubrication: nu 19.5 mm2/s, nu1 17.4 mm2/s -> kappa 1.12; e_c 0.40, e_c Cu/P 0.1569 -> a_ISO 5.14; a1 1.00
- modified life L_nm 278273 h (target 20000 h) -> OK
```
and the influence of cleanliness and oil temperature (`python bearing.py ch24`):
```
== 4 modified life 6206: kappa 1.12, ecCu/P 0.1569, a_ISO 5.13, L_nm 277978 h; at 99 % reliability 69495 h
  normal cleanliness: e_c 0.55 -> a_ISO 9.04, L_nm 489608 h
  typical contamination: e_c 0.20 -> a_ISO 1.97, L_nm 106402 h
  severe contamination: e_c 0.05 -> a_ISO 0.58, L_nm 31542 h
  oil 60 C: nu 39.7, kappa 2.28, a_ISO 10.39, L_nm 562486 h
  oil 100 C: nu 11.1, kappa 0.64, a_ISO 1.39, L_nm 75010 h
```
**Interpretation.**
- From "slight" to "severe" contamination the life falls by a factor 9 (278 000 → 31 500 h). **Clean oil (filtered
  breather, clean assembly, first oil change after run-in) is worth more than a bigger bearing.**
- Oil at 100 °C instead of 80 °C: κ falls from 1.12 to 0.64 and the life by a factor 3.7. Cylinder and crankcase
  cooling (M2 ch. 4) protect the bearings too.
- 99 % reliability (a1 = 0.25): 69 500 h – still far above the 20 000 h target.

### 4.8 Candidates – which bearing for the crankshaft?

```python
def select(Fr, Fa, rpm, P, d=None, types=("ball", "cyl_roller", "ang_ball40", "taper")):
    out = []
    for name, b in CATALOGUE.items():
        if d and b["d"] != d:
            continue
        ...
        eq = equivalent_dynamic(b, Fr, Fa)
        ml = modified_life(b, eq["P"], rpm, P)
        s0 = b["C0"] * 1000 / equivalent_static(b, Fr, Fa)
        out.append({"name": name, ..., "ok": ml["Lnmh"] >= P["target_life_h"] and s0 >= 1.0 and rpm <= b["n_lim"]})
    return sorted(out, key=lambda r: (not r["ok"], r["m"]))
```
**Run it:** `python bearing.py examples`
```
name    type        D   B    P[N]   L10h      L_nm h    a_ISO  kappa  s0    OK
6006    ball        55   13   1211     17021     54263   3.19  1.07   6.9 yes
6206    ball        62   16   1211     54179    278273   5.14  1.12   9.3 yes
NU206   cyl_roller  62   16   1211   1827429  28497896  15.59  1.12  30.1 yes
7206B   ang_ball40  62   16   1211     87313    794307   9.10  1.12  12.9 yes
30206   taper       62 17.25   1211   1352338  25191087  18.63  1.12  36.3 yes
6306    ball        72   19   1211    167966   1697846  10.11  1.18  13.2 yes
NU306   cyl_roller  72   19   1211   4722637 216288629  45.80  1.18  39.6 yes
```
**Interpretation – why bearing fatigue is not the limit in a small compressor.**
- Even the lightest 6006 reaches 54 000 h modified life; the 6206 278 000 h. Lives of millions of hours (NU, tapered)
  are mathematically correct but meaningless: **something else ends the bearing life first**:
  - oil ageing and contamination (wear particles from rings, pistons, cylinder),
  - misalignment and shaft deflection (M3: slopes 0.6 arcmin, fine here),
  - false brinelling during transport (vibration at standstill),
  - corrosion from condensed water in the crankcase,
  - mounting damage, wrong fits, electric current from frequency inverters (motor side).
- The **conrod bearings** (needle or plain) see higher, oscillating loads and decide the system life (ch. 4.6).
- So choose the 6206 class: good margin, standard part, C3 clearance for the tight shaft fit (ch. 6), deep groove
  ball bearing takes the small axial loads in both directions. The 6006 is lighter but its 15 mm thinner section gives
  less margin against oil problems; NU / tapered are not needed for this load.

### 4.9 Real manufacturing / practice
- Specify in the requirement list: target L_nm in running hours, reliability, oil and cleanliness assumption.
- Write the calculated life and the assumptions on the bearing calculation sheet; the supplier's calculation tool
  (with the exact ISO 281 / ISO/TS 16281 method) is used to confirm the final choice.
- Plan the first oil change after the run-in (wear particles), a filtered breather, and clean assembly rooms for the
  crankcase (M1 ch. 33 control plan).
- Field data: record bearing failures with running hours → Weibull analysis (M1 ch. 27) to calibrate e_c and a1.

### 4.10 MATLAB equivalent
```matlab
C = 20.3e3; P = 1211; n = 1450; p = 3;
L10  = (C/P)^p;  L10h = 1e6*L10/(60*n);                    % 4710 Mrev, 54142 h
dm = (30+62)/2; nu1 = 4500*n^-0.5*dm^-0.5; kappa = 19.5/nu1;
x = 0.4*0.475e3/P; k1 = 1.9987; e1 = 0.071739;            % kappa >= 1 branch
aISO = 0.1*(1 - (2.5671 - k1/kappa^e1)^0.83 * x^(1/3))^-9.3;
Lnmh = aISO*L10h                                           % about 2.8e5 h
```

### 4.11 Check questions
1. Why is bearing life a statistical value, and what does L10 mean?
2. Derive how much the life changes when the load rises by 10 % (ball and roller bearing).
3. Why can a_ISO be smaller than 1? Name two causes.
4. The main bearings have very long lives. Which bearings and which other effects decide the real life of the
   compressor?
5. You must guarantee 99 % reliability. How much longer must L10 be than the required life?


---

## 5 Lubrication and contamination

> Program: `tools/bearing.py` – functions `nu_from_VG()`, `nu1_rated()`, `EC`, `a_iso()`, `modified_life()` and the
> chapter-5/6 additions `GEOM_6206`, `q_max()`, `contact_radii()`, `hertz_ellipse()`, `entrainment_speed()`,
> `hamrock_dowson()`, `film_parameter()`, `min_VG_for_kappa()`, `life_vs_temperature()`, `life_vs_cleanliness()`,
> `relub_interval_rule()`. All extra numbers of chapters 5 and 6: `python bearing.py ch56`.
> Example: bearing A of the compressor crankshaft, 6206, equivalent radial load 1211 N, peak 2046 N (from chapter 4,
> loads over one revolution from crank.py through shaft.py), 1450 rpm, ISO VG 100 at 80 °C. **All values are examples.**

### 5.1 Why lubrication decides the life

A rolling bearing does not fail because the steel is "too weak". In a well-designed bearing the contact stress is
about 1500–2500 MPa, far below the static limit (≈ 4200 MPa for ball bearings). The bearing fails by **rolling contact
fatigue**: small cracks start below or at the surface after many millions of over-rolls. How fast these cracks start
depends very much on **how well the oil film separates the ball from the raceway** and on **hard particles** in the oil.
This is why ISO 281 multiplies the basic life by the factor a_ISO, which comes from two numbers:

| Number | Meaning | Where it comes from |
|---|---|---|
| κ = ν / ν1 | Lubrication: actual viscosity / viscosity needed | Oil grade, temperature, speed, size (5.3) |
| e_c · Cu / P | Cleanliness × fatigue load limit / load | Contamination class (5.5), catalogue Cu, load P |

Before we use these numbers, we look at the physics behind them: the contact (5.1–5.2), the film (5.2) and the
oil (5.3).

### 5.2 Contact of the most loaded ball (Hertz)

**Theory – load on the most loaded ball.** In a radial bearing only the balls in the lower half carry load. Stribeck
showed (for zero clearance) that the most loaded ball carries Q_max = 4.37 F_r / Z. With normal clearance fewer balls
carry, so engineers use

  **Q_max ≈ 5 F_r / (Z · cos α)**   (Stribeck, Z = number of balls, α = contact angle)

**Theory – contact geometry.** A ball (radius r = D_w/2) touches the raceway. In the rolling direction x the inner
raceway is convex (radius (d_m − D_w)/2), the outer raceway concave ((d_m + D_w)/2). Across the groove (direction y)
the ball sits in a groove of radius f · D_w (osculation f ≈ 0.52–0.53, slightly bigger than the ball). Curvatures add:

  1/R_x = 1/r ± 1/R_race   1/R_y = 1/r − 1/(f D_w)

The contact patch is a long, thin **ellipse** (semi-axes a across, b along the rolling direction). Hamrock–Brewe give
simple formulas:

| Symbol | Formula | Unit |
|---|---|---|
| k | 1.0339 (R_y/R_x)^0.636 (ellipticity a/b) | – |
| ℰ | 1.0003 + 0.5968 R_x/R_y (elliptic integral, approx.) | – |
| R | 1 / (1/R_x + 1/R_y) | mm |
| E′ | E / (1 − ν²) for two steels = 230 769 | MPa |
| a | (6 k² ℰ Q R / (π E′))^(1/3) | mm |
| b | (6 ℰ Q R / (π k E′))^(1/3) | mm |
| p_max | 3 Q / (2 π a b) | MPa |

**Internal geometry of a 6206 (typical, check the maker's data):** Z = 9 balls, D_w = 9.525 mm (3/8"),
d_m = 46 mm, f_i = 0.52, f_o = 0.53, α = 0°. Bearing makers do not publish all of these values; the ball size and number
can be measured on a cut bearing.

**In the program**
```python
GEOM_6206 = {"Z": 9, "Dw": 9.525, "dm": 46.0, "f_i": 0.52, "f_o": 0.53, "alpha_deg": 0.0}   # typical, check maker

def q_max(Fr, Z, alpha_deg=0.0):
    """Stribeck: load on the most loaded ball Q_max ~ 5 Fr / (Z cos alpha) (radial bearing, small clearance)."""
    return 5.0 * Fr / (Z * math.cos(math.radians(alpha_deg)))

def contact_radii(g, race="inner"):
    r = g["Dw"] / 2
    if race == "inner":
        Rr = (g["dm"] - g["Dw"]) / 2
        Rx = 1 / (1 / r + 1 / Rr)
        f = g["f_i"]
    else:
        Rr = (g["dm"] + g["Dw"]) / 2
        Rx = 1 / (1 / r - 1 / Rr)
        f = g["f_o"]
    Ry = 1 / (1 / r - 1 / (f * g["Dw"]))
    return Rx, Ry

def hertz_ellipse(Q, Rx, Ry, E=210000.0, nu=0.3):
    k = 1.0339 * (Ry / Rx) ** 0.636
    Ee = 1.0003 + 0.5968 * Rx / Ry
    R = 1 / (1 / Rx + 1 / Ry)
    Ep = E / (1 - nu ** 2)
    a = (6 * k ** 2 * Ee * Q * R / (math.pi * Ep)) ** (1 / 3)
    b = (6 * Ee * Q * R / (math.pi * k * Ep)) ** (1 / 3)
    return {"k": k, "a": a, "b": b, "p_max": 3 * Q / (2 * math.pi * a * b), "Ep": Ep}
```

**Run it:** `python bearing.py ch56` (block 5.1)
```
equivalent load Fr 1211 N: Q_max 672.6 N | inner Rx 3.776 Ry 123.83 mm, k 9.52, a 1.235 b 0.130 mm, p_max 2005 MPa
equivalent load Fr 1211 N: Q_max 672.6 N | outer Rx 5.749 Ry 84.14 mm, k 5.70, a 1.004 b 0.176 mm, p_max 1815 MPa
peak load Fr 2046 N: Q_max 1136.5 N | inner Rx 3.776 Ry 123.83 mm, k 9.52, a 1.470 b 0.155 mm, p_max 2388 MPa
peak load Fr 2046 N: Q_max 1136.5 N | outer Rx 5.749 Ry 84.14 mm, k 5.70, a 1.196 b 0.210 mm, p_max 2162 MPa
C0 check: Q at Fr = C0 = 6222 N -> p_max inner 4209 MPa (ISO 76 reference ~4200 MPa for ball bearings)
```

**Interpretation.**
- The **inner ring contact is the critical one**: smaller R_x (convex against convex) → higher pressure (2005 vs
  1815 MPa). Inner rings usually fail first in rotating-shaft applications.
- The contact ellipse is only 2.5 mm × 0.26 mm (2a × 2b). All the shaft load goes through this tiny area, millions of
  times per hour. That is why surface finish and the oil film (a few tenths of a micrometre) matter so much.
- **Check of the geometry:** ISO 76 defines C0 as the load that gives 4200 MPa at the most loaded ball contact of a
  ball bearing. With F_r = C0 = 11.2 kN our model gives **4209 MPa** – the typical geometry is plausible.
- At the peak load of the revolution (2046 N) p_max = 2388 MPa – still well below 4200 MPa, so no static damage.

**Manufacturing / practice.** Raceways are ground and superfinished (Ra ≈ 0.05–0.1 µm), balls are lapped
(grade G10: Ra ≈ 0.02 µm). Through-hardened 100Cr6 (58–65 HRC) is the standard steel; cleanliness of the steel
(oxide inclusions, ISO 4967) decides where sub-surface cracks start. You cannot change this inside the bearing, but
you choose it by choosing a quality maker and by asking for the steel cleanliness grade for critical bearings.

**MATLAB**
```matlab
Z=9; Dw=9.525; dm=46; fi=0.52; Fr=1211;
Q  = 5*Fr/Z;  r = Dw/2;
Rx = 1/(1/r + 1/((dm-Dw)/2));  Ry = 1/(1/r - 1/(fi*Dw));
k = 1.0339*(Ry/Rx)^0.636; Ee = 1.0003 + 0.5968*Rx/Ry; R = 1/(1/Rx+1/Ry); Ep = 210000/(1-0.3^2);
a = (6*k^2*Ee*Q*R/(pi*Ep))^(1/3); b = (6*Ee*Q*R/(pi*k*Ep))^(1/3); pmax = 3*Q/(2*pi*a*b)   % 2005 MPa
```

**Check questions.** (1) Why is the inner-ring contact pressure higher than the outer one? (2) What happens to p_max
when the load doubles? (Answer: p_max ∝ Q^(1/3) → +26 %.) (3) Which number of the catalogue is defined by 4200 MPa?

### 5.3 The oil film: elastohydrodynamic lubrication (EHL)

**Theory.** When the ball rolls, oil is dragged into the narrowing gap. In the contact the pressure is so high
(2000 MPa) that two things happen at once: (1) the steel deforms elastically (Hertz flattening) and (2) the oil
viscosity rises by many orders of magnitude (piezo-viscous effect, η = η0 · e^(α·p)). The oil becomes almost solid
for the short time in the contact and carries the load with a film of only **0.05–0.5 µm**. This is
elastohydrodynamic lubrication (EHL).

Hamrock and Dowson (1977) fitted numerical EHL solutions for elliptical contacts:

  **H_min = 3.63 · U^0.68 · G^0.49 · W^−0.073 · (1 − e^(−0.68 k))**    **h_min = H_min · R_x**

| Group | Formula | Meaning |
|---|---|---|
| U | η0 · u / (E′ R_x) | Speed parameter (u = entrainment speed) |
| G | α · E′ | Material parameter (α ≈ 2·10⁻⁸ 1/Pa for mineral oil – check oil data) |
| W | Q / (E′ R_x²) | Load parameter |
| k | 1.0339 (R_y/R_x)^0.636 | Ellipticity |

Note the exponents: **speed and viscosity act with power 0.68, load only with −0.073.** The film is made by speed and
viscosity; the load hardly changes it. Entrainment speed for a rotating inner ring and a fixed outer ring:

  u = ω · (d_m² − D_w²) / (4 d_m)

Dynamic viscosity η0 = ν · ρ (ρ ≈ 870 kg/m³ for mineral oil).

**Film parameter Λ** compares the film with the surface roughness:

  **Λ = h_min / √(R_q,ball² + R_q,race²)**

| Λ | Regime | Consequence |
|---|---|---|
| < 1 | Boundary | Metal contact, surface distress, wear – short life |
| 1 … 3 | Mixed | Partial contact – life reduced |
| > 3 | Full film | No contact – fatigue limited by sub-surface stress |

ISO 281 does not use Λ directly; it uses κ = ν/ν1. The two are related: ν1 is roughly the viscosity that gives Λ ≈ 1
for a standard bearing, and a common rule is κ ≈ Λ^1.3 (rule of thumb – check, it depends on roughness).

**In the program**
```python
def entrainment_speed(g, rpm):
    w = rpm * 2 * math.pi / 60
    dm, Dw = g["dm"] / 1000, g["Dw"] / 1000
    return w * (dm ** 2 - Dw ** 2) / (4 * dm)

def hamrock_dowson(Q, Rx, Ry, u, nu_mm2s, rho=870.0, alpha_p=2.0e-8, E=210000.0, nu=0.3):
    Ep = E * 1e6 / (1 - nu ** 2)
    Rxm = Rx / 1000
    eta0 = nu_mm2s * 1e-6 * rho
    U = eta0 * u / (Ep * Rxm)
    G = alpha_p * Ep
    W = Q / (Ep * Rxm ** 2)
    k = 1.0339 * (Ry / Rx) ** 0.636
    H = 3.63 * U ** 0.68 * G ** 0.49 * W ** -0.073 * (1 - math.exp(-0.68 * k))
    return {"U": U, "G": G, "W": W, "H_min": H, "h_min_um": H * Rxm * 1e6, "eta0_Pas": eta0}

def film_parameter(h_um, Rq_ball=0.04, Rq_race=0.07):
    return h_um / math.sqrt(Rq_ball ** 2 + Rq_race ** 2)
```

**Run it:** block 5.2
```
VG100 at 60 C: nu 39.7 mm2/s, eta0 0.0345 Pa s, u 1.67 m/s, U 6.620e-11 G 4615 W 2.044e-04 -> h_min 0.190 um, Lambda 2.36
VG100 at 80 C: nu 19.5 mm2/s, eta0 0.0169 Pa s, u 1.67 m/s, U 3.248e-11 G 4615 W 2.044e-04 -> h_min 0.117 um, Lambda 1.45
VG100 at 100 C: nu 11.1 mm2/s, eta0 0.0097 Pa s, u 1.67 m/s, U 1.852e-11 G 4615 W 2.044e-04 -> h_min 0.080 um, Lambda 0.99
```

**Interpretation.**
- At the design point (80 °C) the film is **0.117 µm**, Λ = 1.45: mixed lubrication, but on the good side.
- If the crankcase oil reaches 100 °C, Λ drops to 0.99 – the boundary regime begins. **Oil temperature control is a
  bearing-life measure**, not only an oil-life measure.
- Compare with κ in 5.4: at 80 °C κ = 1.12 and Λ = 1.45 → Λ^1.3 = 1.62, the same order. Both say "adequate, not
  generous".
- The film (0.12 µm) is about 1/1000 of a hair. Particles larger than the film thickness (almost all particles!)
  are over-rolled and make dents – this is the contamination effect of 5.6.

**Practice.** Ask the oil supplier for α (pressure-viscosity coefficient); synthetic PAO oils have lower α than mineral
oils, so at the same ν the film is thinner. A higher viscosity index (VI) keeps ν higher at operating temperature.

**MATLAB**
```matlab
w=1450*2*pi/60; u = w*((0.046)^2-(0.009525)^2)/(4*0.046);       % 1.67 m/s
Ep=210e9/(1-0.09); Rxm=3.776e-3; eta0=19.5e-6*870; Q=672.6; alpha=2e-8; k=9.52;
U=eta0*u/(Ep*Rxm); G=alpha*Ep; W=Q/(Ep*Rxm^2);
hmin = 3.63*U^0.68*G^0.49*W^-0.073*(1-exp(-0.68*k))*Rxm*1e6   % 0.117 um
```

**Check questions.** (1) The load doubles – what happens to h_min? (W^−0.073: −5 %.) (2) The speed doubles?
(U^0.68: +60 %.) (3) Why can a heavily loaded slow bearing still fail by poor lubrication?

### 5.4 Viscosity, rated viscosity ν1 and κ

**Theory – viscosity and temperature.** Oil gets thin when warm. The ISO VG number is the kinematic viscosity at
40 °C in mm²/s (VG 100 → 100 mm²/s at 40 °C, tolerance ± 10 %). For other temperatures ASTM D341 uses the
**Ubbelohde–Walther** equation, a straight line in a double-log chart:

  **log10 log10(ν + 0.7) = A − B · log10(T)**   (T in kelvin, ν in mm²/s)

Two points (40 °C and 100 °C from the data sheet) fix A and B. Derivation in the program: W(ν) = log log(ν + 0.7);
B = (W(ν40) − W(ν100)) / (log T100 − log T40); A = W(ν40) + B log T40; then invert.

**Theory – rated viscosity ν1.** ν1 is the viscosity that gives adequate separation (κ = 1) for the bearing size and
speed. ISO 281:2007 gives

  n < 1000 rpm: **ν1 = 45000 · n^−0.83 · d_m^−0.5**   n ≥ 1000 rpm: **ν1 = 4500 · n^−0.5 · d_m^−0.5**   (mm²/s, d_m mm)

Faster and bigger bearings make their own film more easily → need less viscosity. Then **κ = ν / ν1**:
κ < 0.1 not covered by ISO 281; κ = 1 adequate; κ = 4 full film (larger values give no further benefit, the program
limits κ to 4).

**In the program** (`bearing.py`)
```python
def nu_from_VG(VG, T):
    nu100 = {32: 5.4, 46: 6.8, 68: 8.7, 100: 11.1, 150: 14.5, 220: 18.9, 320: 23.9, 460: 30.5}[int(VG)]
    def W(nu):
        return math.log10(math.log10(nu + 0.7))
    T1, T2 = math.log10(313.15), math.log10(373.15)
    B = (W(VG) - W(nu100)) / (T2 - T1)
    A = W(VG) + B * T1
    w = A - B * math.log10(T + 273.15)
    return 10 ** (10 ** w) - 0.7

def nu1_rated(rpm, dm):
    if rpm < 1000:
        return 45000 * rpm ** -0.83 * dm ** -0.5
    return 4500 * rpm ** -0.5 * dm ** -0.5

def min_VG_for_kappa(target_kappa, rpm, dm, T):
    nu1 = nu1_rated(rpm, dm)
    for VG in (32, 46, 68, 100, 150, 220, 320, 460):
        nu = nu_from_VG(VG, T)
        if nu / nu1 >= target_kappa:
            return VG, nu, nu / nu1
    return None
```
The ν100 values are typical for mineral oils with VI ≈ 95–100 – **use the 100 °C value of your oil data sheet.**

**Run it:** `python bearing.py examples` (viscosity table) and block 5.3
```
40 C: 100.0, 60 C: 39.7, 70 C: 27.2, 80 C: 19.5, 90 C: 14.5, 100 C: 11.1
nu1(1450 rpm, dm 46) = 17.42 mm2/s; nu1(900 rpm) = 23.43; nu1(3000 rpm) = 12.11
VG table at 80 C: VG46 11.1 (k 0.64), VG68 14.7 (k 0.84), VG100 19.5 (k 1.12), VG150 26.4 (k 1.51), VG220 35.5 (k 2.03)
target kappa 1 at 70 C -> VG68 (nu 20.1, kappa 1.15)
target kappa 1 at 80 C -> VG100 (nu 19.5, kappa 1.12)
target kappa 1 at 90 C -> VG150 (nu 19.2, kappa 1.10)
target kappa 2 at 70 C -> VG150 (nu 37.6, kappa 2.16)
target kappa 2 at 80 C -> VG220 (nu 35.5, kappa 2.03)
target kappa 2 at 90 C -> VG460 (nu 42.4, kappa 2.43)
target kappa 4 at 70 C -> VG460 (nu 92.6, kappa 5.31)
target kappa 4 at 80 C -> none <= VG460
```

**Interpretation.**
- VG 100 at 80 °C gives κ = 1.12 – just adequate. Going from VG 100 to VG 150 raises κ to 1.51 (and life, see 5.5),
  but a thicker oil raises friction and churning losses (chapter 6) and may be worse for the compressor's
  cylinders and valves. **The oil grade is a system decision:** the compressor maker's oil (typically VG 68–150
  for reciprocating air compressors – check) must suit the cylinder, the valves and the bearings together.
- Every 10 K of oil temperature costs about one VG grade. Cooling the crankcase from 90 to 70 °C has the same effect
  as changing VG 150 → VG 68 for the bearings.
- κ = 4 is not reachable at 80 °C with normal oils – and not needed here.

**Life against temperature** (block 5.4, 6206, P = 1211 N, slight contamination):
```
60 C: nu 39.7 kappa 2.28 a_ISO 10.39 L_nm 563131 h
70 C: nu 27.2 kappa 1.56 a_ISO 7.15 L_nm 387360 h
80 C: nu 19.5 kappa 1.12 a_ISO 5.14 L_nm 278273 h
90 C: nu 14.5 kappa 0.83 a_ISO 2.81 L_nm 152458 h
100 C: nu 11.1 kappa 0.64 a_ISO 1.39 L_nm 75078 h
```
From 80 to 100 °C the calculated life falls to about one quarter. All values are far above the 20 000 h target
because this compressor bearing is lightly loaded – but the trend is the important lesson.

**MATLAB**
```matlab
W = @(nu) log10(log10(nu+0.7)); T1=log10(313.15); T2=log10(373.15);
B=(W(100)-W(11.1))/(T2-T1); A=W(100)+B*T1;
nuT = @(T) 10.^(10.^(A-B*log10(T+273.15)))-0.7;   nuT(80)      % 19.5
nu1 = 4500*1450^-0.5*46^-0.5;  kappa = nuT(80)/nu1               % 1.12
```

**Check questions.** (1) Why does ν1 fall when the speed rises? (2) Your oil runs at 95 °C – which VG do you need for
κ ≥ 1? (3) Why do we not simply use VG 460 for maximum κ?

### 5.5 Contamination and the factor e_c

**Theory.** Hard particles (sand, machining chips, wear metal from cylinders, rust) bigger than the film thickness
(≈ 0.1 µm!) are rolled into the raceway and make **dents**. Each dent has raised edges; the over-rolling balls create
local stress peaks there, and surface-initiated fatigue starts much earlier. ISO 281 describes this with the
contamination factor **e_c** (1 = perfectly clean, 0 = very severely contaminated). It enters a_ISO through the
product e_c · Cu / P: Cu is the fatigue load limit (no fatigue below it for perfect conditions), so e_c · Cu / P
says "how far the load is above the fatigue limit, corrected for dirt".

**Cleanliness classes** (typical e_c for d_m < 100 mm, mid values of the ISO 281 ranges – check the standard; ISO 281
also gives a detailed method from the ISO 4406 oil code and filter rating):

| Class | e_c | Typical situation |
|---|---|---|
| Extreme cleanliness | 1.0 | Particle size ≈ film thickness, lab conditions |
| High cleanliness | 0.7 | Oil through an extremely fine filter; sealed + greased-for-life |
| Normal cleanliness | 0.55 | Fine filter; shielded bearings greased for life |
| Slight contamination | 0.4 | Slight contamination of the lubricant (our splash-lubricated crankcase, example) |
| Typical contamination | 0.2 | No integral seals, coarse filter, wear particles |
| Severe contamination | 0.05 | Highly contaminated environment, poor sealing |
| Very severe contamination | 0 | — |

**ISO 4406 oil cleanliness code:** three numbers for particles per ml > 4 / 6 / 14 µm, e.g. **–/17/14**. Each step of
the code doubles the particle count. **Filter β ratio:** β_x = particles upstream / downstream of size ≥ x µm;
β_12 = 200 means 99.5 % of particles ≥ 12 µm are removed.

**In the program** (`bearing.py`)
```python
EC = {   # typical e_c for dm < 100 mm (ISO 281 table ranges, mid values; check the standard / ISO 4406 method)
    "extreme cleanliness": 1.0, "high cleanliness": 0.7, "normal cleanliness": 0.55, "slight contamination": 0.4,
    "typical contamination": 0.2, "severe contamination": 0.05, "very severe contamination": 0.0}

def life_vs_cleanliness(name, P_N, rpm, base=None):
    out = []
    for cls in EC:
        Q = dict(base or DEFAULT, cleanliness=cls)
        out.append((cls, modified_life(CATALOGUE[name], P_N, rpm, Q)))
    return out
```

**Run it:** block 5.5
```
extreme cleanliness        e_c 1.00 -> a_ISO 35.78, L_nm 1938507 h (35.8 x L10h)
high cleanliness           e_c 0.70 -> a_ISO 14.89, L_nm 806742 h (14.9 x L10h)
normal cleanliness         e_c 0.55 -> a_ISO 9.05, L_nm 490161 h (9.0 x L10h)
slight contamination       e_c 0.40 -> a_ISO 5.14, L_nm 278273 h (5.1 x L10h)
typical contamination      e_c 0.20 -> a_ISO 1.97, L_nm 106503 h (2.0 x L10h)
severe contamination       e_c 0.05 -> a_ISO 0.58, L_nm 31569 h (0.6 x L10h)
very severe contamination  e_c 0.00 -> a_ISO 0.10, L_nm 5418 h (0.1 x L10h)
```

**Interpretation.** For the same bearing, load and oil, cleanliness changes the life by a factor of **350**
(5418 h to 1.9 million h). Between "slight" and "severe" contamination the life falls from 278 000 h to 32 000 h.
**Cleanliness is the cheapest life extension you can buy:** clean assembly, a good breather filter on the crankcase,
flushing after run-in, magnetic drain plug, oil change intervals.

**Practice in the compressor factory.**
- Assembly area: no grinding near the assembly line; bearings unpacked only at the station; crankcase washed and
  blown out (residual dirt specification, e.g. max particle size and mass per part – ISO 16232 / VDA 19 style).
- Run-in oil change after the first hours removes wear particles of the cylinders and rings.
- Breather with filter on the crankcase: the compressor "breathes" dusty factory air at every stroke.
- Oil analysis (ISO 4406 code, iron ppm) on endurance test machines (guide M1 ch. 32) to calibrate e_c.

**Check questions.** (1) Why do particles of 5 µm already damage a bearing with a 0.1 µm film? (2) Which is cheaper for
life: one VG grade more, or one cleanliness class better? (Compare 5.4 and 5.5.)

### 5.6 Oil or grease, splash lubrication, relubrication, seals

| Item | Oil (splash / bath / circulation) | Grease |
|---|---|---|
| Heat removal | Good (oil carries heat away) | Poor |
| Speed | Higher (n·d_m up to ≈ 0.6–1·10⁶ mm/min) | Lower (≈ 0.5·10⁶ – check catalogue) |
| Cleanliness | Can be filtered | Cannot be filtered; seals needed |
| Maintenance | Oil change, level check | Relubrication interval or greased for life |
| Compressor crankshaft | **Standard**: the crank train throws oil (splash), bearings run in oil mist / spray | Only for oil-free compressor designs |

**Splash lubrication in the crankcase.** The conrod big end (or a dipper) dips into the oil sump at every revolution
and throws oil; the main bearings get oil mist and drops. Design rules: oil level window with min/max marks; oil
passages or collecting pockets above the main bearings; drain path back to the sump behind the bearing (no oil
damming → churning loss); a few millimetres of axial gap between bearing and seal.

**Grease relubrication (orientation only).** Bearing makers give relubrication diagrams. A rough approximation that
reproduces the shape of these diagrams at 70 °C is t_f ≈ K/(n·√d) − 4 d (hours; K = 14·10⁶ ball,
7·10⁶ cylindrical roller, 10⁶ tapered), halved for every 15 K above 70 °C. **This is a rule of thumb – check the maker's
diagram.**
```python
def relub_interval_rule(n, dm, kind="ball"):
    K = {"ball": 14e6, "cyl_roller": 7e6, "taper": 1e6}[kind]
    d = dm
    return K / (n * math.sqrt(d)) - 4 * d
```
Block 5.6: `6206 grease, 1450 rpm: t_f ~ 1643 h at 70 C, ~ 821 h at 85 C` – i.e. a grease-lubricated 6206 at
compressor speed would need fresh grease every 2–3 months in continuous operation. This is one reason why
reciprocating compressors use oil.

**Seals and shields.**

| Design | Friction | Protection | Use |
|---|---|---|---|
| Open | Lowest | Relies on the housing | Inside the oil-filled crankcase |
| 2Z (metal shields, gap) | Very low | Coarse particles only | Clean, dry places, grease for life |
| 2RS / 2RSH (rubber lip contact seals) | Higher (adds several N·mm) | Good against dust and water | Motor bearings, fans, outdoor |
| Low-friction seals (2RZ, non-contact rubber) | Low | Medium | Compromise |
| Labyrinth / radial shaft seal in the housing | Depends | Keeps oil in, dirt out | Crankshaft ends (pulley side!) |

At the pulley end of the crankshaft a radial shaft seal (ISO 6194 / DIN 3760 type) keeps the oil in; its running
surface needs Ra 0.2–0.8 µm, hardness ≥ 45 HRC (or a wear sleeve) and **no lead** (plunge-ground) – see M3 chapter 2.

---

## 6 Static load, minimum load, speed and friction

### 6.1 Static load rating C0 and static safety s0

**Theory.** When the bearing stands still or turns slowly under a heavy load (or a shock hits it), the balls press
permanent dents into the raceway (**Brinell marks**). ISO 76 defines the **static load rating C0** as the load that
gives a contact pressure of 4200 MPa (ball bearings; 4000 MPa roller bearings) at the most loaded contact. At this
pressure the total permanent deformation of ball and raceway is about **0.0001 · D_w** – small enough that the bearing
still runs quietly. (We confirmed the 4200 MPa with the 6206 geometry in 5.2: 4209 MPa.)

The **equivalent static load** P0 combines radial and axial load:

  **P0 = X0 · F_r + Y0 · F_a, but P0 ≥ F_r**

| Type | X0 | Y0 |
|---|---|---|
| Deep groove ball | 0.6 | 0.5 |
| Angular contact ball 40° | 0.5 | 0.26 |
| Tapered roller | 0.5 | ≈ 0.55 · Y (catalogue relation, check) |
| Cylindrical roller (radial only) | 1 | 0 |

**Static safety:** **s0 = C0 / P0**

| Operating condition | Recommended s0 (typical, check the maker) |
|---|---|
| Smooth, no vibration, normal demands on quiet running | ≥ 1.0 |
| Normal operation | 1.0 – 2.0 |
| Shock loads, vibration | ≥ 2.0 |
| High demands on quiet running (e.g. motor, precision) | ≥ 2.0 |

In the program the peak radial load of the revolution is multiplied by 1.5 (start-up, fault – example factor in
`analyse()`, key `static_factor`).

**In the program** (`bearing.py`)
```python
def equivalent_static(b, Fr, Fa):
    t = b["type"]
    if t == "ball":
        P0 = 0.6 * Fr + 0.5 * Fa
    elif t == "ang_ball40":
        P0 = 0.5 * Fr + 0.26 * Fa
    elif t == "taper":
        P0 = 0.5 * Fr + 0.5 * b["Y"] * 0.55 * Fa      # Y0 ~ 0.55 Y (typical catalogue relation, check)
    else:
        P0 = Fr
    return max(P0, Fr)

S0_RECOMMENDED = {"smooth, no vibration": 1.0, "normal": 1.5, "shock loads": 2.0, "quiet running required": 2.0}

def static_check(name, Fr_peak, Fa=0.0):
    b = CATALOGUE[name]
    P0 = equivalent_static(b, Fr_peak, Fa)
    return {"P0": P0, "s0": b["C0"] * 1000 / P0}
```

**Run it:** block 6.1 (peak 2046 N × 1.5 = 3069 N)
```
6006   P0 3069 N, s0 2.70
6206   P0 3069 N, s0 3.65
6306   P0 3069 N, s0 5.21
NU206  P0 3069 N, s0 11.89
6206 with Fr 1500 / Fa 500 N: P0 1500 N, s0 7.47
```

**Interpretation.**
- All candidates have s0 > 2 – the static load is not critical for the compressor main bearings. The 6206 has
  s0 = 3.65 (also in the main report of chapter 4).
- Last line: with F_a = 500 N, 0.6 · 1500 + 0.5 · 500 = 1150 N < F_r, so the rule **P0 ≥ F_r** applies: P0 = 1500 N.
- Static safety becomes critical for slowly rotating heavy parts in your factory: pallet-changer bearings, rotary
  tables, crane wheels – there s0 is often the sizing criterion, not the life.

**Practice.** Brinell marks also come from **wrong assembly**: pressing the outer ring when the inner ring is fitted on
the shaft sends the force through the balls (s0 ≪ 1 for an instant). Always press on the ring that is being fitted
(M3 ch. 8, chapter 7 of this guide). Transport of a finished compressor with a vibrating truck can make "false
brinelling" marks on standing bearings – secure the crankshaft or ship with oil.

**Check questions.** (1) What does C0 mean physically? (2) Why is P0 never smaller than F_r? (3) Name a machine in your
factory where s0 decides the bearing size.

### 6.2 Minimum load, skidding and speed limits

**Minimum load – theory.** The rolling elements must be driven by friction at the raceway. If the load is too small,
the cage and the oil drag slow the rolling elements down; they **skid** instead of rolling. Skidding destroys the film
and makes smearing marks within hours. Rules of thumb (check the catalogue formula of your maker):

  **F_min ≈ 0.01 · C (ball bearings)   F_min ≈ 0.02 · C (roller bearings)**

The program checks `min_load_ok` in `analyse()` with the **peak** load; the more honest check uses the **minimum**
load over the revolution:

**Run it:** block 6.2
```
6206   F_min ~ 203 N; bearing A min load over the revolution 717 N
NU206  F_min ~ 880 N; bearing A min load over the revolution 717 N
n dm = 66700 mm/min (1450 x 46); n_lim catalogue 6206 10000 rpm -> n/n_lim 0.14
```

**Interpretation – an important design finding.** The NU206 cylindrical roller bearing had the "best" life in the
candidate table of chapter 4 (28 million hours). But the bearing load falls to **717 N** during each revolution, below
the roller minimum load of about **880 N**. In every revolution the rollers are at risk of skidding, especially at
start-up with cold, thick oil. **A bigger bearing is not always better:** the 6206 ball bearing (F_min ≈ 203 N) is the
safer choice here. If a roller bearing is needed, use preload, a lighter series, or a design with a spring load.

**Speed limits.**

| Speed | Meaning |
|---|---|
| Reference speed (ISO 15312) | Thermal: speed at which the bearing reaches 70 °C under standard reference conditions (load, oil, heat flow) |
| Limiting speed | Mechanical / kinematic limit (cage, seals, ring stresses) – do not exceed even with good cooling |
| Speed factor n · d_m | Quick check of the lubrication method (typical limits for standard deep groove ball bearings: grease ≈ 0.5·10⁶, oil splash ≈ 0.6·10⁶, oil jet ≈ 10⁶ mm/min – check) |

```python
def speed_factor(rpm, dm):
    return rpm * dm
```
The compressor runs at n·d_m = 66 700 mm/min and n/n_lim = 0.14 – **far from any speed limit**. Speed limits become
important in your HMC spindles (guides 18, 19: n·d_m > 10⁶ with grease → special bearings and greases).

**Check questions.** (1) Why do lightly loaded roller bearings fail faster than loaded ones? (2) Which speed must never
be exceeded, the reference or the limiting speed?

### 6.3 Friction: simple μ model and Palmgren model

**Theory – simple model.** For normal conditions (P ≈ 0.1 C, good lubrication) catalogues give a constant friction
coefficient referred to the bore:

  **M = 0.5 · μ · P · d**   (μ ≈ 0.0015 deep groove ball, 0.0011 cylindrical roller, 0.0018 tapered roller,
  0.0020 angular contact – typical, check)

**Theory – Palmgren model.** The friction moment has a load part M1 (elastic hysteresis, micro-slip in the contact)
and a speed part M0 (viscous drag of the oil):

  **M = M0 + M1**

  M0 = 10⁻⁷ · f0 · (ν · n)^(2/3) · d_m³  for ν·n ≥ 2000;  M0 = 160·10⁻⁷ · f0 · d_m³ for ν·n < 2000   (N·mm)

  M1 = f1 · P1 · d_m,  f1 = z · (P0/C0)^y  (deep groove: z ≈ 0.0006–0.0009, y = 0.5),  P1 = max(F_r, 3F_a − 0.1F_r)

f0 depends on bearing type and lubrication (deep groove ball: ≈ 1.5–2 oil mist / splash, ≈ 4 oil bath – typical, check).
**Power loss:** N = M · ω.

**In the program**
```python
MU = {"ball": 0.0015, "ang_ball40": 0.0020, "cyl_roller": 0.0011, "taper": 0.0018}   # typical (check catalogue)

def friction(b, P_N, rpm, mu=None):
    m = MU[b["type"]] if mu is None else mu
    M = 0.5 * m * P_N * b["d"]
    return {"mu": m, "M_Nmm": M, "N_W": M / 1000 * rpm * 2 * math.pi / 60}

def palmgren_friction(name, Fr, rpm, nu, f0=2.0, Fa=0.0):
    b = CATALOGUE[name]
    dm = (b["d"] + b["D"]) / 2
    vn = nu * rpm
    M0 = 1e-7 * f0 * vn ** (2 / 3) * dm ** 3 if vn >= 2000 else 160e-7 * f0 * dm ** 3
    P0 = equivalent_static(b, Fr, Fa)
    f1 = 0.0007 * (P0 / (b["C0"] * 1000)) ** 0.5
    P1 = max(Fr, 3 * Fa - 0.1 * Fr)
    M1 = f1 * P1 * dm
    N = (M0 + M1) / 1000 * rpm * 2 * math.pi / 60
    return {"M0": M0, "M1": M1, "M": M0 + M1, "f1": f1, "N_W": N, "dm": dm}
```

**Run it:** block 6.3
```
simple: mu 0.0015, M 27.2 N mm, 4.14 W
Palmgren: nu n 28225, M0 18.0 N mm, f1 0.000230, M1 12.8 N mm, M 30.9 N mm, 4.69 W
f0 1.5 -> M 26.4 N mm, 4.00 W
f0 2.0 -> M 30.9 N mm, 4.69 W
f0 4.0 -> M 48.9 N mm, 7.43 W
```

**Interpretation.**
- Both models agree within ≈ 15 % for this normal case: about **4–5 W per main bearing**, 9–10 W for both.
  Compared with the ≈ 1.6 kW indicated power of the compressor (M2) that is about 0.6 %. Bearings are not the big
  loss in a reciprocating compressor – piston rings and valves are.
- Here **60 % of the friction is the oil part M0**. Too much oil (bath above the lowest ball, f0 = 4) raises the loss
  to 7.4 W and heats the bearing – the reason for "oil level to the centre of the lowest rolling element" rules in
  oil-bath designs.
- Use the simple μ model for quick checks; use the Palmgren model (or the maker's online-free catalogue model) when
  speed is high or the oil is thick.

**MATLAB**
```matlab
dm=46; nu=19.47; n=1450; f0=2; Fr=1211; C0=11200;
P0 = max(0.6*Fr, Fr);                    % P0 >= Fr rule -> P0 = Fr
M0 = 1e-7*f0*(nu*n)^(2/3)*dm^3;  f1 = 0.0007*(P0/C0)^0.5;  M1 = f1*Fr*dm;   % f1 = 0.000230
P_loss = (M0+M1)/1000*n*2*pi/60         % 4.69 W
```

**Check questions.** (1) Which friction part grows with speed, which with load? (2) Why does a too-high oil level raise
the bearing temperature?

### 6.4 Heat balance – operating temperature, viscosity and life together

**Theory.** Friction heat must leave the bearing. In steady state

  **N(T) = k · A_r · (T − T_oil)**

with the heat-emitting area A_r = π · B · (d + D) (ISO 15312 reference area) and a heat-transfer coefficient k.
ISO 15312 uses a reference heat flow density of 0.016 W/mm² at 50 K temperature difference for A_r ≤ 50 000 mm²,
i.e. k ≈ 3.2·10⁻⁴ W/(mm²·K) (check – real k depends on housing, oil flow and air). But N depends on ν, and ν depends on
T – the problem is coupled. We solve it by **fixed-point iteration**:

  T → ν(T) (Walther) → M0(ν) + M1 → N → T_new = T_oil + N/(k A_r) → repeat until T does not change.

**In the program**
```python
def heat_balance(name, Fr, rpm, T_oil=80.0, VG=100, k=3.2e-4, f0=2.0, iters=50):
    b = CATALOGUE[name]
    Ar = math.pi * b["B"] * (b["d"] + b["D"])
    T = T_oil
    hist = []
    for i in range(iters):
        nu = nu_from_VG(VG, T)
        fr = palmgren_friction(name, Fr, rpm, nu, f0)
        Tn = T_oil + fr["N_W"] / (k * Ar)
        hist.append((i, T, nu, fr["N_W"]))
        if abs(Tn - T) < 1e-6:
            T = Tn
            break
        T = Tn
    nu = nu_from_VG(VG, T)
    return {"A_r": Ar, "T": T, "dT": T - T_oil, "nu": nu, "N_W": palmgren_friction(name, Fr, rpm, nu, f0)["N_W"],
            "iterations": len(hist), "history": hist}
```

**Run it:** block 6.4
```
it 0: T 80.00 C, nu 19.47, N 4.687 W
it 1: T 83.17 C, nu 17.65, N 4.514 W
it 2: T 83.05 C, nu 17.72, N 4.520 W
it 3: T 83.05 C, nu 17.71, N 4.520 W
converged after 6 iterations: A_r 4624 mm2, T 83.05 C (+3.05 K), nu 17.71 mm2/s, N 4.520 W
same bearing at 6000 rpm, oil bath f0 4: T 109.0 C (+29.0 K), N 42.88 W
life at the bearing temperature 83.1 C: kappa 1.02, L_nm 253439 h
```

**Interpretation.**
- The compressor main bearing runs only **3 K above the oil** – the bearing heat is small; the oil temperature
  (from the cylinders and the compression heat) decides the bearing temperature. The iteration converges quickly
  because hotter oil means less viscous friction (negative feedback).
- With the bearing temperature (83 °C) instead of the oil temperature, κ falls from 1.12 to 1.02 and the life from
  278 000 h to 253 000 h. **Always use the bearing temperature for κ**, not the room or sump temperature.
- The same bearing at 6000 rpm in an oil bath would run at ≈ 109 °C – then heat removal (oil circulation, cooling fins)
  becomes a design task. This is the situation of your machine-tool spindles (guide 18).

**Practice.** Measure the outer-ring temperature on the endurance test bench (thermocouple in the housing, 1–2 mm from
the outer ring). Typical acceptance: bearing temperature < 90–100 °C for standard bearings (cage / grease / oil
limits – check), stable after 1–2 h. Compare with the model; the difference calibrates k for your housing
(credibility level L3, M1 ch. 7).

**MATLAB**
```matlab
Ar = pi*16*(30+62); k=3.2e-4; T=80;
for it=1:50
  nu = nuT(T); M0=1e-7*2*(nu*1450)^(2/3)*46^3; M1=0.000230*1211*46;
  N=(M0+M1)/1000*1450*2*pi/60; Tn=80+N/(k*Ar);
  if abs(Tn-T)<1e-6, break; end; T=Tn;
end
T          % 83.05 C
```

**Check questions.** (1) Why does the iteration converge (negative feedback)? (2) What changes in the heat balance when
the oil level is too high? (3) Why must κ be calculated with the bearing temperature?

### 6.5 Checklist – chapters 5 and 6

- [ ] Oil grade chosen with the compressor (cylinders, valves) and the bearings: κ ≥ 1 at the **bearing** temperature.
- [ ] Oil temperature limit set (e.g. crankcase ≤ 80–85 °C) and monitored; κ and life recalculated at the maximum.
- [ ] Contamination class realistic (splash crankcase: slight contamination); breather filter, clean assembly, run-in
      oil change specified.
- [ ] Static safety s0 ≥ 2 with peak and shock loads; assembly forces only through the fitted ring.
- [ ] Minimum load checked with the **minimum** load of the cycle (roller bearings!).
- [ ] n · d_m and n / n_lim checked against the lubrication method.
- [ ] Friction and heat balance plausible; bearing temperature measured on the test bench.
- [ ] Seals chosen (open inside the crankcase, radial shaft seal at the pulley end with a proper running surface).

### 6.6 Common mistakes

- Using the sump or room temperature for κ instead of the bearing temperature.
- Choosing the bearing with the highest calculated life (roller bearing) and getting skidding damage at light load.
- Ignoring contamination (e_c = 1 by default in some tools) – life overestimated by a factor of 5–30.
- Grease-lubricating a bearing that runs hot and fast without a relubrication plan.
- Too much oil or grease: churning, heat, and **lower** life.
- Pressing a bearing on through the wrong ring – Brinell marks before the first start.

### 6.7 Limits of the models in chapters 5–6

- The internal geometry of the 6206 is typical, not maker data; Hertz and EHL results are good for trends and orders
  of magnitude (± 10–20 %).
- Hamrock–Dowson is isothermal and fully flooded; inlet shear heating and starvation (thin oil supply, grease) reduce
  the film further.
- The e_c values are mid values of ISO 281 ranges; the detailed ISO 281 method uses the ISO 4406 code, the filter
  rating and the bearing size.
- The Palmgren f0 / f1 values and the heat-transfer coefficient k are typical; modern catalogue friction models
  (four-component models with seal and drag losses) are more accurate.
- The relubrication rule is an approximation of maker diagrams for orientation only.


---

## 7 Fits, internal clearance and preload

> Program: `operating_clearance()`, `CLEARANCE` and (chapter 7 additions) `ring_expansion_factor()`, `clearance_fixes()`,
> `preload_force_spring()`, `SHAFT_FITS_30`. Extra results: `python bearing.py ch711`. All values are **example values**;
> ISO and catalogue values are marked "check".

### 7.1 Load conditions decide the fit

A bearing ring must not **creep** (turn slowly on its seat). Creep wears the seat, makes heat and fretting rust, and
the ring finally turns. Creep happens on the ring that sees a **rotating load** – the load direction moves around the
ring.

| Situation | Inner ring | Outer ring | Fit rule |
|---|---|---|---|
| Shaft turns, load direction fixed in space (gear, belt, crank pin in a frame) | **rotating load** | point (stationary) load | inner ring **tight** (interference), outer ring may be loose |
| Shaft stands, housing turns (wheel hub, idler pulley) | point load | **rotating load** | outer ring tight, inner ring loose |
| Unbalance load turning with the shaft | point load | rotating load | outer tight (rare in machines – check) |
| Load direction unknown / changes | both | both | both tight |

In the compressor the crank-pin force turns with the crank in the **frame** (chapter 5). Seen from the inner ring, which
turns with the shaft, the gas part of the load always points nearly the same way relative to the crank pin – but the
belt load is fixed in space, and the resultant direction moves. Rule for crankshaft main bearings: **inner ring tight
(k5/m5), outer ring in a clearance or transition fit (H7/J7) – the floating bearing must slide axially in the housing.**

### 7.2 Theory – why the inner ring grows when it is pressed on

Take the inner ring as a thick cylinder: bore radius a = d/2, raceway radius b = F/2 (F = inner raceway diameter ≈
dm − Dw). The shaft (solid, same steel) gives the contact pressure (Lamé, M3 chapter 8):

  p = E·U·(1 − (d/F)²) / (2d)    U = diametral interference

The radial displacement of the outer surface of a thick ring under internal pressure p is

  u(b) = 2·p·a²·b / (E·(b² − a²))

Put p in: u(b) = a²·U / (b·d) = U·d / (2F). The **diametral** growth of the raceway is twice that:

  **Δ_F = U · d / F**    (solid steel shaft, steel ring)

For the 6206 (d 30, dm 46, Dw 9.525 – typical geometry, check): F = 36.475 mm → d/F = **0.822**. The program uses the
round value **0.8**. The effective interference is smaller than the measured one because the roughness peaks are pressed
flat (≈ 0.9 × measured for ground seats – check).

| Formula | Meaning | Unit |
|---|---|---|
| **Δ_fit ≈ 0.8 · 0.9 · U** | clearance lost by the inner-ring fit | µm |
| **Δ_th = α · (T_i − T_o) · dm** | clearance lost because the inner ring is warmer | µm |
| **c_op = c_initial − Δ_fit − Δ_th** | operating radial clearance | µm |

### 7.3 In the program

```python
CLEARANCE = {   # radial internal clearance of deep groove ball bearings, d over 24 to 30 mm (um, ISO 5753 typical)
    "C2": (1, 11), "CN": (5, 20), "C3": (13, 28), "C4": (23, 41)}

def operating_clearance(b, P):
    """Operating radial clearance = initial - fit reduction - thermal reduction.
    Inner ring expansion ~ 0.8 x effective interference (solid steel shaft), outer ring contraction ~ 0 for a clearance
    housing fit; thermal: alpha (T_i - T_o) dm (both rings steel). Effective interference ~ 0.9 x measured (smoothing)."""
    lo, hi = CLEARANCE[P["clearance_class"]]
    alpha = 11.5e-6
    fit = [0.8 * 0.9 * u for u in P["shaft_fit_um"]]
    th = alpha * P["temp_diff_inner_outer_K"] * (b["d"] + b["D"]) / 2 * 1000
    return {"initial": (lo, hi), "fit_reduction": fit, "thermal": th,
            "min": lo - fit[1] - th, "max": hi - fit[0] - th}
```
and the derivation check of the factor 0.8:
```python
def ring_expansion_factor(d, F):
    """Diametral expansion of the inner-ring raceway per unit of diametral interference, solid steel shaft and
    steel ring (Lame, equal E): p = E U (1 - (d/F)^2) / (2 d);  u(F/2) = 2 p a^2 b / (E (b^2 - a^2))
    with a = d/2, b = F/2  ->  expansion = 2 u = U d / F.  F = inner raceway diameter ~ dm - Dw."""
    return d / F
```

**Run it:** `python bearing.py examples` (bearing A block) and `python bearing.py ch711` (first block)
```
- internal clearance C3 13...28 um - fit 1.4...9.4 - thermal 5.3 -> operating -1.7 ... 21.3 um
== 7.2 inner-ring expansion factor d/F (6206: d 30, F = dm - Dw = 46 - 9.525)
  F 36.475 mm -> d/F 0.822 (program uses 0.8)
```

### 7.4 FINDING – the default can run with a small preload, and the fixes

The default (C3 clearance, k5 seat +2 … +13 µm, inner ring 10 K warmer) gives an operating clearance of
**−1.7 … +21.3 µm**. The worst combination (smallest C3 bearing + tightest seat + warm inner ring) is slightly
**negative** = a small preload. The fixes, computed with `clearance_fixes()`:

```python
def clearance_fixes(P=None):
    """Operating clearance of bearing A for the default and for the usual fixes (C4, j5 fit, smaller dT, both).
    Returns list of (label, min um, max um)."""
    P = dict(DEFAULT if P is None else P)
    b = CATALOGUE[P["bearing_A"]]
    variants = [
        ("default: C3, k5 (+2...+13), dT 10 K", {}),
        ("C4 instead of C3", {"clearance_class": "C4"}),
        ("j5 fit (-4...+5) instead of k5", {"shaft_fit_um": [-4, 5]}),
        ("dT inner-outer 5 K (better cooling)", {"temp_diff_inner_outer_K": 5.0}),
        ("C4 + k5 + dT 10 K, inner ring heated to 20 K", {"clearance_class": "C4", "temp_diff_inner_outer_K": 20.0}),
        ("CN (normal) + k5, dT 10 K", {"clearance_class": "CN"}),
    ]
    ...
```
**Run it:** `python bearing.py ch711`
```
== 7.4 operating clearance of bearing A (6206) - default and fixes [um]
  default: C3, k5 (+2...+13), dT 10 K              -1.7 ...  21.3
  C4 instead of C3                                  8.3 ...  34.3
  j5 fit (-4...+5) instead of k5                    4.1 ...  25.6
  dT inner-outer 5 K (better cooling)               1.0 ...  23.9
  C4 + k5 + dT 10 K, inner ring heated to 20 K      3.1 ...  29.0
  CN (normal) + k5, dT 10 K                        -9.7 ...  13.3
```
**Interpretation.**
- **CN (normal clearance) is wrong here:** −9.7 µm minimum = clear preload in the worst case. This is why hot machines
  (compressors, electric motors, gearboxes) use **C3**.
- **C4** removes the risk completely (8.3 … 34.3 µm) and still works when the inner ring is 20 K warmer (3.1 µm minimum).
  The price: more noise and a little less load sharing (fewer balls carry the load).
- **j5** instead of k5 also helps (4.1 … 25.6 µm) – but j5 may be too loose for the rotating inner-ring load of the
  crankshaft (risk of creep; check with the maker for P/C ≈ 0.06).
- Recommendation for the example: **C3 + k5 is acceptable only if the inner-to-outer ring temperature difference
  stays ≤ 5 K** (measure it at the prototype test, chapter 9); otherwise specify **C4** for the bearing near the crank.

### 7.5 Theory – life versus operating clearance (idea)

A small clearance lets more rolling elements share the load; a large one concentrates the load on a few balls. Detailed
analysis (Lundberg–Palmgren with load distribution, ISO/TS 16281) shows a curve:

| Operating clearance | Load zone | Life (relative, idea – check ISO/TS 16281 for your case) |
|---|---|---|
| Large positive | < 180° (few balls carry) | lower |
| ≈ 0 | 180° | ≈ reference |
| Small negative (light preload) | > 180° | slightly **higher** (+ 5 … 10 %) |
| Large negative (heavy preload) | 360°, extra load on all balls | **falls very fast** – heat, more preload, seizure |

The maximum is close to zero, the cliff is on the negative side. Because temperature changes move you along the curve,
designers **aim for a small positive operating clearance**. ISO 281 basic life does not contain this effect – it assumes
a normal load distribution.

### 7.6 Preload of angular-contact and tapered pairs

Angular-contact (7206B) and tapered (30206) bearings carry axial load in one direction only and are used **in pairs**:

| Arrangement | Lines of contact | Use |
|---|---|---|
| **Back-to-back (O, "DB")** | lines open outwards, wide effective spread | tilting stiffness (spindles, pinion shafts, wheel hubs) |
| **Face-to-face (X, "DF")** | lines open inwards, short spread | less sensitive to shaft misalignment |
| Tandem | both in one direction | high axial load in one direction |

Preload is set by **spacers, shims, nuts** (rigid preload – stiff, but thermal growth changes it) or by **springs**
(constant force – soft, thermal-safe). Spring preload is also used on deep-groove ball bearings to stop skidding and
noise at light load.

```python
def preload_force_spring(d, factor=0.01):
    """Spring preload for a deep-groove ball bearing pair (noise, skidding): F = k d, k ~ 0.005 ... 0.01 kN/mm
    (rule of thumb of the large makers - check catalogue). Returns N."""
    return factor * d * 1000 / 1  # kN/mm * mm -> kN ... -> N
```
```
== 7.6 spring preload rule F = k d
  k 0.005 kN/mm, d 30 mm -> F 150 N
  k 0.010 kN/mm, d 30 mm -> F 300 N
```
Tapered bearings induce an axial force F_a,ind = 0.5·F_r/Y; the axial balance of the pair must be solved (catalogue
rules). This program checks single bearings only – for a 30206 pair use the maker's rules or tool (chapter 10).

### 7.7 Shoulders, fillets and the housing (manufacturing data)

| Feature | Rule (check the catalogue table for each bearing) | 6206 typical |
|---|---|---|
| Shaft shoulder diameter d_a | ≥ d_a,min (ring must sit on its flat face, not on the radius) | ≈ 35.6 mm min |
| Housing shoulder D_a | ≤ D_a,max | ≈ 56.4 mm max |
| Fillet radius r_a | ≤ r_a,max of the bearing chamfer (r_s,min 1 mm for 6206) | r_a ≤ 1 mm |
| Relief groove | DIN 509 form F when the seat is ground | see M3 ch. 6 |
| Seat roughness | Ra 0.8 (shaft), Ra 1.6 (housing) – IT5/IT6 seats | |
| Geometrical tolerance | cylindricity t ≈ IT3–IT4, shoulder run-out ≈ IT3 | check ISO 492 / catalogue |
| Housing | stiff, round within IT5 after bolting; no oval clamping of split housings | |

The M3 shaft drawing (Ø30 seats with r 1.0 mm fillets, M3 chapter 2 and 6) must take r_a and d_a from this table – the
fillet radius used in the strength proof must also fit under the bearing chamfer.

**MATLAB:**
```matlab
fit = 0.8*0.9*[2 13];  th = 11.5e-6*10*46*1000;      % um
cmin = 13 - fit(2) - th,  cmax = 28 - fit(1) - th     % -1.7 ... 21.3 um
```

**Check questions.** (1) Why does the ring with the rotating load need the interference fit? (2) Derive Δ_F = U·d/F
from Lamé. (3) Why is CN wrong for the compressor? (4) What happens to the life if the operating clearance becomes
−20 µm? (5) Where on the drawing do d_a,min and r_a,max appear?

---

## 8 Bearing arrangement design for the compressor

> Program: `thermal_growth()`, `axial_force_if_fixed()`, `heating_temperature()`, `press_force_bearing()`, `ALPHA`.

### 8.1 Locating / floating arrangement of the crankshaft

The crankshaft gets **one locating bearing** (takes axial load in both directions, fixes the shaft axially) and **one
floating bearing** (takes only radial load, lets the shaft grow).

| Variant | Locating (A, pulley side) | Floating (B) | Comment |
|---|---|---|---|
| V1 | 6206 (rings clamped on both sides) | 6206, outer ring free to slide in an H7 / G7 seat | cheap, same bearing twice; the floating outer ring slides in the housing |
| V2 | 6206 | **NU206** (cylindrical roller, axial movement inside the bearing) | best for thermal growth; NU needs a little radial load (skidding) – check minimum load |
| V3 | pair of 7206B in O | NU206 | high axial loads (helical gears) |
| V4 | 30206 + 30206 adjusted (X) | – | short, stiff shafts; preload must follow temperature |

For the compressor the **axial load is small** (no helical gear, belt in the plane) – V1 or V2. The crank-side bearing B
sees the higher temperature, so V2 (NU206 at B) is the more robust choice; chapter 6 showed that NU206 has a very large
life margin and the minimum-load check is fulfilled at 869 N equivalent load (check the catalogue minimum load).

### 8.2 Theory – thermal growth of shaft versus crankcase

Over the bearing spacing L the shaft and the case grow differently:

  **ΔL = (α_shaft·ΔT_shaft − α_case·ΔT_case) · L**

If both bearings located, this growth would be blocked and compress the shaft like a spring:

  **F_ax = E · A · ΔL / L**   (upper bound: housing and bearings rigid)

```python
ALPHA = {"steel": 11.5e-6, "grey iron": 10.5e-6, "aluminium": 23.0e-6}

def thermal_growth(L_mm, dT_shaft, dT_case, shaft="steel", case="grey iron"):
    """Difference of thermal expansion between shaft and housing over the bearing spacing L:
    dL = (alpha_s dT_s - alpha_c dT_c) L  [mm]. Positive: shaft grows more than the case."""
    return (ALPHA[shaft] * dT_shaft - ALPHA[case] * dT_case) * L_mm

def axial_force_if_fixed(dL_mm, L_mm, A_mm2, E=210000.0):
    """If both bearings locate (no floating bearing), the blocked growth acts like compression of the shaft:
    F = E A dL / L (upper bound, stiff housing and bearings)."""
    return E * A_mm2 * dL_mm / L_mm
```
**Run it:** `python bearing.py ch711`
```
== 8.2 thermal growth over the bearing spacing L = 120 mm
  steel shaft dT 60 K, grey iron case dT 40 K: dL +0.0324 mm -> if both bearings locate: F up to 40079 N
  steel shaft dT 60 K, grey iron case dT 20 K: dL +0.0576 mm -> if both bearings locate: F up to 71251 N
  steel shaft dT 60 K, aluminium case dT 40 K: dL -0.0276 mm -> if both bearings locate: F up to 34141 N
```
**Interpretation.** Only 0.03–0.06 mm difference – but blocked, it would produce **tens of kN** of axial force
(upper bound) – far above the 11.2 kN static rating of a 6206. In reality the internal clearance takes a part, but the
bearings would run hot and fail early. **This is why one bearing must float.** With an aluminium crankcase the sign
changes: the case grows more, the shaft is "pulled" – the floating bearing must allow movement in both directions
(leave axial play on both sides of the floating outer ring, ≥ 0.2–0.5 mm – check with the expected ΔL and tolerances).

### 8.3 Axial load path, seals and oil supply

- **Axial path (V1/V2):** belt side → shaft shoulder → inner ring of A → balls → outer ring of A → housing shoulder on one
  side and circlip / cover on the other. Write this path on the assembly drawing; every part in it needs a tolerance.
- **Splash lubrication:** the crank throws oil; bearings get oil mist and drips. Provide **oil catch pockets and drain
  holes** under each bearing so oil can run out (a full bearing churns oil and heats up). Viscosity at the real bearing
  temperature decides κ (chapter 4): measure the bearing outer-ring temperature on the prototype.
- **Seals:** the pulley-side bearing needs a radial shaft seal (DIN 3760 / ISO 6194) or a shielded bearing (2Z); seal
  running surface Ra 0.2–0.8 µm, no lead (plunge ground), hardness ≥ 45 HRC for long life (check seal maker).

### 8.4 Mounting – heating or pressing

**Heating the inner ring** (induction heater, never open flame):

  **ΔT = (U + s) / (α · d)**    U = max interference, s = wanted assembly clearance

```python
def heating_temperature(U_um, d_mm, s_um=10.0, alpha=11.5e-6, T_amb=20.0):
    """Mounting by heating the inner ring: dT = (U + s) / (alpha d), s = wanted assembly clearance.
    Returns dT (K) and ring temperature (C)."""
    dT = (U_um + s_um) / 1000.0 / (alpha * d_mm)
    return dT, T_amb + dT

def press_force_bearing(U_um, d, F, B, mu=0.15, E=210000.0):
    """Press-on force of an inner ring on a solid shaft (cold): p = E U (1 - (d/F)^2)/(2 d), F_press = mu p pi d B."""
    p = E * U_um / 1000.0 * (1 - (d / F) ** 2) / (2 * d)
    return p, mu * p * math.pi * d * B
```
```
== 8.4 mounting the 6206 inner ring on k5 (U max 13 um)
  assembly clearance 10 um: dT 66.7 K -> ring at 87 C
  assembly clearance 30 um: dT 124.6 K -> ring at 145 C
  cold press-on: p 14.7 MPa, force 3330 N (mu 0.15)
```
**Interpretation.** With 10 µm assembly clearance the ring must reach about **87 °C** – fine. Asking for 30 µm would need
145 °C, above the usual limit of **110–120 °C** for standard bearings (hardness and cage/seals – check the maker's
limit; shielded/greased bearings often lower). For a small 6206 the cold **press-on force of about 3.3 kN** is also
practical – but only if the force goes **through the inner ring** (press sleeve on the inner ring face), never through
the balls.

### 8.5 Dismounting, cleanliness, run-in

- Leave a **puller groove** or a shoulder height that lets a puller grip the inner ring (d_a not larger than allowed).
- **Cleanliness:** a single hard particle can dent a raceway (start of spalling). Assemble in a clean area, open bearings
  only at the line, keep the crankcase washed (contamination class in chapter 4 decides e_c).
- **Run-in:** the first hours smooth the roughness, temperature first rises and then falls; record the temperature curve
  at the end-of-line test (M2/guide 19 run-in idea) – a rising temperature after 30 min means wrong clearance, fit or oil.

**Check questions.** (1) Why must one crankshaft bearing float? (2) Compute ΔL for L = 150 mm, ΔT shaft 50 K, grey iron
case 30 K. (3) Why is 145 °C mounting temperature not allowed? (4) Where does the press force have to act?

---

## 9 Damage, monitoring and the twin

> Program: `defect_frequencies()`, `GEOM`, `fleet_weibull()` (uses `dm_strength.weibull_fit`).

### 9.1 How bearings fail (ISO 15243)

| Mode (ISO 15243 groups) | What you see | Typical cause | Fix |
|---|---|---|---|
| **Subsurface fatigue** | spalling (flakes) in the load zone after long service | normal end of life (L10) or overload | larger bearing, better κ |
| **Surface-initiated fatigue** | micro-pitting, grey frosted bands | thin oil film (κ < 1), roughness | higher viscosity, cooler oil |
| **Wear (abrasive/adhesive)** | dull surfaces, increased clearance, smearing | contamination, skidding at low load | filtration, seals, minimum load / preload |
| **Corrosion (moisture, fretting)** | rust, fretting rust on seats | water, micromovement on seat (fit too loose) | correct fit (ch. 7), sealing |
| **Electrical erosion** | fluting (washboard), craters | current through the bearing (VFD drives!) | insulated bearings, shaft grounding (VFD motor) |
| **Plastic deformation** | dents, false brinelling (marks at ball pitch) | shock, mounting through the balls, vibration at standstill | correct mounting (8.4), transport locks |
| **Fracture and cracking** | cracked rings | too tight fit, hoop stress, impact | fit selection, no hammer |

Note for the compressor: if the motor is driven by a **frequency converter** (variable speed), electrical erosion of the
motor bearings is a known risk – choose insulated bearings on the motor (check motor maker).

### 9.2 Theory – kinematic defect frequencies

A local defect gives an impact each time a rolling element passes it. With shaft frequency f_r = n/60 and
g = (D_w·cos α)/d_m (inner ring rotating, outer ring stationary):

| Frequency | Formula | Meaning |
|---|---|---|
| FTF (cage) | f_r/2 · (1 − g) | cage speed |
| **BPFO** (outer race) | Z·f_r/2 · (1 − g) | impacts on an outer-race defect |
| **BPFI** (inner race) | Z·f_r/2 · (1 + g) | impacts on an inner-race defect (modulated by f_r) |
| BSF (ball spin) | d_m/(2D_w) · f_r · (1 − g²) | ball defect hits a race at 2 × BSF |

### 9.3 In the program
```python
def defect_frequencies(rpm, Z, Dw, dm, alpha_deg=0.0):
    """Kinematic bearing frequencies, inner ring rotating, outer stationary (Hz):
    FTF = fr/2 (1 - g), BPFO = Z fr/2 (1 - g), BPFI = Z fr/2 (1 + g), BSF = dm/(2 Dw) fr (1 - g^2), g = Dw cos(a)/dm."""
    fr = rpm / 60.0
    g = Dw * math.cos(math.radians(alpha_deg)) / dm
    return {"fr": fr, "FTF": fr / 2 * (1 - g), "BPFO": Z * fr / 2 * (1 - g), "BPFI": Z * fr / 2 * (1 + g),
            "BSF": dm / (2 * Dw) * fr * (1 - g * g), "2xBSF": dm / Dw * fr * (1 - g * g)}
```
**Run it:** `python bearing.py ch711`
```
== 9.3 defect frequencies 6206 at 1450 rpm (Z 9, Dw 9.525, dm 46 - typical, check)
  fr 24.17, FTF 9.58, BPFO 86.23, BPFI 131.27, BSF 55.85, 2xBSF 111.71 Hz
```
**Interpretation.** In the vibration spectrum of the crankcase look for **86.2 Hz (outer race), 131.3 Hz with ± 24.2 Hz
side bands (inner race)** and 111.7 Hz (ball). The compressor itself makes strong 24.2 / 48.3 Hz orders (M2 chapter 7)
and many harmonics – the bearing lines are small and hidden at the beginning. Therefore:

### 9.4 Monitoring practice – envelope analysis, severity, temperature

1. **Envelope (demodulation):** band-pass the acceleration signal around a structural resonance (e.g. 2–10 kHz), rectify,
   low-pass, then FFT. The impacts appear as clean lines at BPFO / BPFI even when the raw spectrum shows only the
   compressor orders. Sampling: f_s ≥ 2.56 × the upper band frequency (M1 chapter 32).
2. **Severity:** overall vibration velocity (mm/s RMS, 10–1000 Hz) on the bearing housing, trended; limits for
   reciprocating compressors are given in ISO 10816-6 / ISO 20816 series (check the class for your mounting).
3. **Temperature trend:** outer-ring / housing temperature compared with oil temperature and load; a rise of > 5–10 K at
   the same load is an early warning (clearance loss, lubrication).
4. **Oil analysis:** particle counting (ISO 4406) and ferrography in splash-lubricated crankcases.

**Link to the twin:** the twin's predictive-maintenance logic (guide 50 AI, vibration and temperature channels) can use
these exact frequencies as features: store BPFO/BPFI/BSF amplitudes of the envelope spectrum per machine, trend them and
alarm on growth. M2 gives the forcing orders, M3 the shaft stiffness, M4 the bearing frequencies – together they say which
spectral line belongs to which part.

### 9.5 L10 versus observed failures – Weibull of a fleet

L10 is a **statistical** life of a large population. Field data of your own compressors check whether the calculation
fits reality. Fit a Weibull distribution to the failure hours (median ranks, M1 chapter 27):

```python
def fleet_weibull(hours=None):
    """Weibull fit (median ranks) of observed bearing failures in a fleet (example data) and B10 life."""
    from dm_strength import weibull_fit
    t = hours or [9500, 17800, 24100, 31500, 39000, 48500, 61000]
    w = weibull_fit(t)
    B10 = w["eta"] * (-math.log(0.9)) ** (1 / w["beta"])
    return {"beta": w["beta"], "eta": w["eta"], "r2": w["r2"], "B10_h": B10, "n": len(t)}
```
```
== 9.5 fleet Weibull (example failure hours)
  n 7, beta 1.69, eta 38303 h, r2 0.998 -> B10 10142 h
```
**Interpretation (example data).** β ≈ 1.7 is close to the typical bearing value 1.1–1.5 (fatigue, check) – the
failures look like fatigue, not like early failures (β < 1, mounting/contamination) or wear-out (β > 3). But
**B10 ≈ 10 000 h** is far below the calculated L_nm of 278 000 h for bearing A (chapter 4). Such a gap means the
calculation misses a real effect: contamination worse than assumed (e_c), lubrication worse (κ), wrong fit / clearance
(chapter 7), electrical erosion, or loads higher than calculated. **Investigate the failed bearings (ISO 15243 pictures)
before you change the bearing size.** (Only 7 failures, and only failures – suspended units must be included for a real
analysis; see M1 chapter 27.)

**MATLAB:** `fr = 1450/60; g = 9.525/46; BPFO = 9*fr/2*(1-g), BPFI = 9*fr/2*(1+g)`

**Check questions.** (1) Which frequency belongs to an outer-race spall of the 6206 at 1450 rpm? (2) Why does an inner-race
defect show side bands at f_r? (3) Why is envelope analysis needed in a reciprocating compressor? (4) What does β < 1 in a
fleet Weibull tell you?

---

## 10 Verification and supplier tools

> Program: `ball_bearing_stiffness()`.

### 10.1 Cross-check with supplier tools

| Tool | What it adds | Offline? |
|---|---|---|
| SKF Bearing Select / SimPro | SKF life (a_SKF), friction model, grease life, thermal speed | Bearing Select is a web tool (needs internet – against the offline rule); desktop tools by request (check) |
| Schaeffler medias / BEARINX | catalogue + ISO/TS 16281 shaft systems | medias online; BEARINX-online / desktop versions by licence (check) |
| NSK, NTN, Timken calculators | catalogue life, fits | mostly online (check) |
| KISSsoft / MESYS (M1 ch. 9) | ISO 281 + ISO/TS 16281 with internal geometry, shaft systems | **offline** (local licence) |

**What to compare:** P, L10h, κ, a_ISO, L_nm (same oil, temperature, e_c, reliability) – differences of 10–20 % in a_ISO are
normal (each maker has its own a_ISO table or model); differences in L10h must be ≤ 1–2 % (same C, P, n). If a maker's
C value differs from `CATALOGUE`, **the maker's value wins** – the program's catalogue is typical data only.

### 10.2 ISO/TS 16281 – when the simple method is not enough

ISO 281 assumes a normal load distribution, zero clearance effect and no tilt. **ISO/TS 16281** computes the load on each
rolling element from the internal geometry, clearance, shaft tilt and stiffness, then the life of each raceway. Use it
when: (1) the operating clearance is near zero or negative (chapter 7.4!), (2) the shaft slope is large (M3 chapter 5 –
the compressor shaft has only 0.17 mrad, uncritical), (3) combined loads on angular-contact or tapered pairs, (4) you need
the bearing stiffness for a dynamic model.

### 10.3 Bearing stiffness for M3 (critical speed) and for Adams / Ansys

Hertz point contact: the elastic approach δ grows with Q^(2/3) – the bearing is a **nonlinear, stiffening spring**.

  Q_max = 5·F_r / (Z·cos α)   (Stribeck, zero clearance)
  δ ≈ c · Q^(2/3) · D_w^(−1/3)  (c ≈ 4.4·10⁻⁴ mm·N^(−2/3)·mm^(1/3) for steel, usual osculation – estimate, check)
  k_tangent = dF_r/dδ_r = 1.5 · F_r / δ_r

```python
def ball_bearing_stiffness(Fr, Z, Dw, alpha_deg=0.0, c=4.4e-4):
    """Radial stiffness estimate of a deep-groove ball bearing with zero clearance.
    Max ball load (Stribeck): Q = 5 Fr / (Z cos a). Total elastic approach of the most loaded ball between both
    raceways: delta = c Q^(2/3) Dw^(-1/3) mm (Hertz point contact, c ~ 4.4e-4 for steel and usual osculation -
    estimate, check ISO/TS 16281 / maker). delta_r = delta / cos a. Secant + tangent stiffness: k_tan = 1.5 Fr/delta_r."""
    ca = math.cos(math.radians(alpha_deg))
    Q = 5.0 * Fr / (Z * ca)
    delta = c * Q ** (2.0 / 3.0) * Dw ** (-1.0 / 3.0)
    dr = delta / ca
    return {"Q": Q, "delta_um": delta * 1000, "k_secant": Fr / dr, "k_tangent": 1.5 * Fr / dr}
```
**Run it:** `python bearing.py ch711`
```
== 10.3 radial stiffness of 6206 (zero clearance, estimate)
  Fr  500 N: Q 278 N, delta 8.8 um, k_secant 56581 N/mm, k_tangent 84872 N/mm
  Fr 1211 N: Q 673 N, delta 15.9 um, k_secant 75986 N/mm, k_tangent 113979 N/mm
  Fr 2046 N: Q 1137 N, delta 22.6 um, k_secant 90501 N/mm, k_tangent 135751 N/mm
```
**Interpretation.** At the working load the 6206 has about **1.1·10⁵ N/mm** (tangent) – the same order as the
5·10⁴ N/mm assumed in M3 chapter 5 for the critical speed with bearing stiffness (so M3 was on the safe side). The
bearing deflects about 16 µm – **more than the shaft itself (9 µm, M3)**. For Adams flexible-body models and Ansys
shaft models use a **spring with this stiffness** (or a nonlinear force–deflection table F = (δ/c')^1.5) instead of a
rigid support; with clearance the curve has a dead band first.

### 10.4 Verification checklist
- [ ] L10h equals the hand formula for one load case (± 0.1 %).
- [ ] P with axial load equals the catalogue example of the maker (± 2 %).
- [ ] κ and a_ISO compared with a supplier tool (± 20 %).
- [ ] The variable-load mean (cubic) compared with a step-wise duty cycle (chapter 5).
- [ ] Measured outer-ring temperature at the prototype used to re-calculate ν and κ.

**Check questions.** (1) Why must the program's catalogue C be replaced by the maker's value? (2) When do you need
ISO/TS 16281? (3) Why does the bearing stiffness rise with load?

---

## 11 Complete worked selection example, checklists, limits, references

### 11.1 Example – a helical-gear shaft with axial load (not the compressor)

Requirement (example values): shaft d 30 mm, 960 rpm, locating bearing A carries F_r 3200 N and the gear axial force
F_a 1340 N (M3 chapter 3 gear example), floating bearing B carries F_r 2100 N. 20 000 h at **95 %** reliability.
Oil ISO VG 68 at 70 °C, normal cleanliness. First try: 6306 at A, NU206 at B.

Input file `tools/examples/bearing_example.json`:
```json
{
  "name": "Helical gear shaft (example): d 30, 960 rpm, axial gear force on the locating bearing A",
  "rpm": 960.0,
  "use_crank_loads": false,
  "bearing_A": "6306", "bearing_B": "NU206",
  "Fr_A_N": 3200.0, "Fa_A_N": 0.0, "Fr_B_N": 2100.0, "Fa_B_N": 0.0,
  "Fa_external_N": 1340.0,
  "target_life_h": 20000.0,
  "reliability_pct": 95.0,
  "oil_VG": 68, "oil_temp_C": 70.0,
  "cleanliness": "normal cleanliness"
}
```
**Run it:** `python bearing.py run --in examples/bearing_example.json --out gear_shaft` (same numbers in `python bearing.py ch711`)
```
## Bearing A: 6306 (ball, d 30, D 72, B 19, C 29.6 kN, C0 16.0 kN, Cu 0.670 kN)
- radial load: equivalent 3200 N, max 3200 N; axial 1340 N -> P = 3847 N (X 0.56, Y 1.53)
- basic life L10 456 Mrev = 7911 h
- lubrication: nu 20.1 mm2/s, nu1 21.1 mm2/s -> kappa 0.95; e_c 0.55, e_c Cu/P 0.0958 -> a_ISO 2.09; a1 0.64
- modified life L_nm 10572 h (target 20000 h) -> NOT OK
- static safety s0 3.3 (peak x 1.5); speed OK; minimum load OK

## Bearing B: NU206 (cyl_roller, d 30, D 62, B 16, C 44.0 kN, C0 36.5 kN, Cu 4.500 kN)
- radial load: equivalent 2100 N, max 2100 N; axial 0 N -> P = 2100 N (X 1.00, Y 0.00)
- basic life L10 25358 Mrev = 440239 h
- lubrication: nu 20.1 mm2/s, nu1 22.2 mm2/s -> kappa 0.91; e_c 0.55, e_c Cu/P 1.1786 -> a_ISO 5.22; a1 0.64
- modified life L_nm 1470700 h (target 20000 h) -> OK
```
The candidate lists (from `select()`, printed by `ch711`):
```
  candidates A (Fr 3200, Fa 1340, 960 rpm, 95 %):
   30206  taper      P   3424  L10h    63858  L_nm    101684  a_ISO  2.49  kappa 0.91  s0  13.8  ok
   6006   ball       P   3493  L10h     1071  L_nm       694  a_ISO  1.01  kappa 0.87  s0   2.6  no
   6206   ball       P   3655  L10h     2975  L_nm      2604  a_ISO  1.37  kappa 0.91  s0   3.5  no
   7206B  ang_ball40 P   3200  L10h     7143  L_nm     10386  a_ISO  2.27  kappa 0.91  s0   4.9  no
   6306   ball       P   3847  L10h     7911  L_nm     10572  a_ISO  2.09  kappa 0.95  s0   5.0  no
  candidates B (Fr 2100, Fa 0):
   6206   ball       P   2100  L10h    15682  L_nm     25880  a_ISO  2.58  s0   5.3  ok
   NU206  cyl_roller P   2100  L10h   440239  L_nm   1470700  a_ISO  5.22  s0  17.4  ok
   ...
```
**Decisions.**
1. **Bearing A: no deep-groove ball bearing of bore 30 is enough** with 1340 N axial load at 95 % reliability – even the
   6306 reaches only 10 572 h (the axial load raises P by 20 %, a1 = 0.64 costs 36 %, κ < 1 costs life too).
2. Options for A: (a) **pair of 30206 tapered bearings** adjusted in X or O (101 684 h for one bearing – but a single
   tapered bearing cannot locate in both directions, and its induced axial force must be included: solve the pair with the
   maker's rules or tool, chapter 7.6); (b) bigger shaft seat (d 35: 6307 class, check catalogue); (c) better oil (VG 100
   or cooler oil → κ > 1 raises a_ISO); (d) an angular-contact pair 7206B in O (each 10 386 h alone – a pair shares the
   radial load; check with the maker).
3. **Bearing B: a 6206 is enough** (25 880 h) – the NU206 has a huge margin but costs more; keep NU206 only if the shaft
   grows a lot (floating inside the bearing) or for stiffness.
4. Note: the report's s0 uses the peak load × 1.5 (static factor), `select()` uses the plain load – compare like with like.

### 11.2 Design sheet (example)

| Item | Bearing A (locating) | Bearing B (floating) |
|---|---|---|
| Bearing | pair 30206 in O (to be checked with maker tool) | 6206 C3 (or NU206) |
| Load | F_r 3200 N, F_a 1340 N | F_r 2100 N |
| Life target | 20 000 h, 95 % | 20 000 h, 95 % |
| Lubrication | ISO VG 68 at 70 °C, κ ≈ 0.9 → consider VG 100 | same |
| Shaft fit | k5 (rotating inner-ring load) | k5 |
| Housing fit | H7 (adjusted pair: axial setting by shims) | H7, outer ring free to slide (if 6206) |
| Clearance | set preload / end-play of the pair at assembly | C3 |
| Mounting | heat to ≤ 110 °C or press on the inner ring | same |
| Monitoring | BPFO / BPFI of the actual geometry in the twin | same |

### 11.3 Checklists

**Selection**
- [ ] Loads per bearing for all load cases (M3 reactions, M2 load cycle), axial path defined (ch. 8).
- [ ] Equivalent load P with X, Y (ch. 3); variable loads by cubic mean or duty cycle (ch. 5).
- [ ] L10h and L_nm with real oil temperature, cleanliness, reliability (ch. 4).
- [ ] Static safety s0 ≥ 1 (≥ 2 for quiet running or shock – check catalogue).
- [ ] Speed below the limiting speed; minimum load fulfilled.
- [ ] Catalogue values replaced by the maker's current data.

**Arrangement and fits**
- [ ] One locating, one floating bearing (or adjusted pair with known preload range).
- [ ] Fits by load condition; operating clearance positive in the worst case (ch. 7.4).
- [ ] Shoulder d_a / D_a and fillet r_a from the catalogue on the drawing.
- [ ] Mounting temperature ≤ maker's limit; press force through the fitted ring.

**Operation**
- [ ] Oil drains, seals, temperature measurement on the prototype.
- [ ] Defect frequencies stored for monitoring; vibration and temperature limits defined.

### 11.4 Common mistakes
- Using CN clearance in a warm machine (preload, overheating – ch. 7.4).
- Two locating bearings on a shaft that grows (axial overload – ch. 8.2).
- Taking ν at 40 °C instead of at the real bearing temperature (κ too optimistic).
- Ignoring the axial load in P, or forgetting the induced axial force of tapered bearings.
- Calculating with arithmetic-mean loads instead of the cubic mean for varying loads.
- Hammering bearings on, pressing through the balls (dents, false brinelling).
- Trusting L_nm > 10⁶ h: above ~ 10⁵ h other failure modes (wear, seals, grease, corrosion) decide the real life.

### 11.5 Limits of the program
- Catalogue data are typical; the maker's data win.
- ISO 281 style a_ISO as implemented (constants to check against ISO 281:2007); e_c as fixed typical values instead of the
  ISO 4406-based method.
- Single bearings only; pairs of tapered / angular bearings and preload need the maker's rules or ISO/TS 16281 tools.
- Operating clearance: simple factors (0.8 expansion, 0.9 smoothing), outer-ring fit effect not included.
- Friction: constant-μ model only (no speed/viscosity terms); no grease life; no thermal limiting speed.

### 11.6 Standards and books
**Standards:** ISO 281:2007 (dynamic load ratings and rating life) · ISO 76 (static load ratings) · ISO 15312 (thermal
speed rating) · ISO 15243 (damage and failures – terms and appearance) · ISO 5753-1 (radial internal clearance) · ISO 492
(tolerances of radial bearings) · ISO/TS 16281 (advanced rating life with internal geometry) · ISO 4406 (oil cleanliness
code) · ISO 286 (fits) · DIN 3760 / ISO 6194 (radial shaft seals) · ISO 10816-6 / ISO 20816 (vibration). Check the
current editions.
**Books and catalogues:** T. A. Harris, M. N. Kotzalas, *Rolling Bearing Analysis*, 5th ed. (2 vols.) · H. Brändlein,
P. Eschmann, L. Hasbargen, K. Weigand, *Ball and Roller Bearings – Theory, Design and Application* · Schaeffler,
*Technical Pocket Guide* · SKF, *Rolling bearings* general catalogue (check edition) · Niemann/Winter/Höhn,
*Maschinenelemente* Vol. 1.

### 11.7 Glossary
| Term | Meaning |
|---|---|
| a1 | life modification factor for reliability (1 at 90 %) |
| a_ISO | life modification factor for lubrication, contamination and fatigue load limit |
| BPFO / BPFI / BSF / FTF | outer-race, inner-race, ball-spin and cage frequencies |
| C, C0 | basic dynamic / static load rating |
| C3, C4 | internal clearance larger than normal (CN) |
| Cu | fatigue load limit |
| e_c | contamination factor |
| Floating bearing | bearing that allows axial movement of the shaft |
| κ (kappa) | viscosity ratio ν/ν1 |
| L10, L_nm | basic rating life (90 %), modified rating life |
| Locating bearing | bearing that fixes the shaft axially in both directions |
| O / X arrangement | back-to-back / face-to-face pair of angular bearings |
| Operating clearance | internal clearance at operating temperature after mounting |
| P, P0 | equivalent dynamic / static load |
| Preload | negative clearance, set on purpose |
| s0 | static safety factor C0/P0 |
