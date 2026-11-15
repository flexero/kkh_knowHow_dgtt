# M7 – Bolted joints: VDI 2230 calculation (R0–R13), joint diagram, preload and tightening, fatigue, slip, assembly

> Field 1 *Mechanical design*, item 7.
> **Theory and program are combined:** every formula is followed by the code of `tools/bolt.py`, the command and the real
> output. MATLAB mirror: `tools/bolt.m`. Web: tab **M_P_C tools**, item 13. Python standard library only – offline.
> **All inputs are example values.** VDI 2230 Part 1 (2015) is implemented in a simplified form: concentric clamping and
> loading, load introduction factor n given, no bending or prying unless stated. Tightening factors, friction ranges,
> embedding amounts, limiting surface pressures and fatigue values are typical table values – marked "check".

## Contents
0. How to use this guide with the program
1. Purpose – what a bolt calculation must prove
2. Bolted joints, threads, property classes and nuts
3. Compliance of bolt and clamped parts, the joint diagram and the load factor
4. Required clamp load, embedding, preload and tightening (R1–R7, R13)
5. Working stress, fatigue, eccentric loading and opening (R8–R9)
6. Surface pressure, embedding, temperature, slip and multi-bolt joints (R10–R12)
7. Manufacturing of bolts, assembly methods, tightening sequence, friction testing, self-loosening, inspection
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python bolt.py params` | Default input as JSON (copy → edit → `--in`) |
| `python bolt.py run --in my.json --out res` | Full calculation → `report.md`, `assembly.csv` (thread, tightening torque, preloads, method – for the assembly instruction) |
| `python bolt.py examples` | Report of the default joint, tightening-method comparison, preload / torque table M8–M20 × 8.8 / 10.9 / 12.9 |
| `python bolt.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python bolt.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=13#mpc` | Same calculation with KPIs, joint diagram, safety bars, torque table |

### 0.2 Program map – formula → function
| Step | Physics / method | Function |
|---|---|---|
| R0 | Thread geometry d2, d3, A_S, A_d3 (ISO 724), head and hole data | `THREADS`, `CLASSES`, `thread_geometry()` |
| R3 | Bolt compliance (head, shank, free thread, engaged thread, nut / tapped hole); plate compliance with deformation cone / cone + sleeve / sleeve; load factor Φ_K, Φ_n | `bolt_compliance()`, `cone_angle()`, `plate_compliance()`, `load_factor()` |
| R2 | Required clamp load for slip and sealing | `required_clamp()` |
| R4 | Embedding amount and preload loss | `FZ_TABLE`, `embedding()` |
| R1, R5 | Tightening factor α_A, required minimum and maximum assembly preload | `TIGHTENING`, `preload_check()` |
| R7, R13 | Permissible assembly preload (von Mises, plastic torsion), tightening torque, friction scatter | `FM_zul()`, `torque_coeff()`, `tightening()` |
| R8 | Working stress with residual torsion k_τ = 0.5 | `working_stress()` |
| R9 | Alternating stress and fatigue limit (rolled before / after heat treatment) | `fatigue()` |
| R10 | Surface pressure under head and nut | `PART_MATERIALS`, `surface_pressure()` |
| R12 | Residual clamp load and slip safety | `slip()` |
| – | All checks, size selection, report, assembly CSV | `summary()`, `select_size()`, `report_text()`, `run()` |
| 2–4 | Joint types, ISO 68-1 profile, fine vs coarse thread, property classes and nuts, engagement length in tapped holes, joint diagram, waisted bolt, plate study, load introduction factor n, opening load, exact thread torque, torque split, friction band and α_A, embedding studies | `iso68_profile()`, `fine_vs_coarse()`, `class_meaning()`, `engagement_length()`, `joint_diagram()`, `waisted_bolt_study()`, `plate_study()`, `n_study()`, `opening_load()`, `thread_torque_exact()`, `torque_split()`, `friction_band()`, `embedding_study()`, `lK_embedding()`, `JOINT_TYPES`, `FINE_THREADS`, `PROPERTY_CLASS_INFO`, `NUT_MATCH`, `TAPPED_MATERIALS`, `N_GUIDE` |
| 5–6 | k_τ study, yield-controlled tightening, finite-life fatigue, Haigh points, fatigue measures, eccentric opening trend, surface-pressure options (washer, material, flange bolt), embedding table, thermal preload change, slip study and μ_T table, bolt shear if slipping, flange bolt loads, bolts for a cylinder head, safety summary, fixing the default | `ktau_study()`, `yield_controlled()`, `fatigue_finite()`, `haigh_after_HT()`, `fatigue_measures()`, `eccentric_opening()`, `eccentric_trend()`, `with_washer()`, `pressure_options()`, `embedding_table()`, `thermal_preload()`, `slip_study()`, `bolt_shear_if_slip()`, `flange_bolt_loads()`, `n_bolts_for_head()`, `safety_summary()`, `fix_default_study()`, `PG_TABLE`, `ALPHA`, `MU_T` |
| 7–8 | Bolt process chain, coatings and friction classes, torque / angle / yield / ultrasonic / hydraulic / heat tightening, method comparison, tightening-sequence crosstalk, ISO 16047 friction test, loosening torque, transverse slip limit, locking measures, torque audit, galvanic risk, failures, re-use rule, cylinder-head worked example | `coating_effect()`, `torque_scatter()`, `angle_for_preload()`, `angle_control()`, `yield_control()`, `ultrasonic()`, `hydraulic_tension()`, `heat_tightening()`, `method_comparison()`, `crosstalk()`, `iso16047()`, `synthetic_test_points()`, `loosening_torque()`, `slip_limit_transverse()`, `torque_audit()`, `galvanic_risk()`, `reuse_rule()`, `gas_load()`, `gasket_clamp()`, `head_example_steps()`, `example_json()`, `BOLT_PROCESS_CHAIN`, `COATINGS`, `FRICTION_CLASSES`, `LOCKING`, `GALVANIC`, `FAILURES`, `EXAMPLE_HEAD` |
Example input of chapter 8: `tools/examples/bolt_example.json`.

### 0.3 What the self-test proves
1. A_S of M12 = 84.3 mm² and of M20 = 245 mm² (ISO 898-1 values).
2. At F_Mzul the von Mises stress from tension and full thread torsion (plastic section modulus π d0³/12) equals ν·R_p0.2.
3. M12 10.9 with μ = 0.12 gives F_Mzul ≈ 63 kN and M_A ≈ 123 N m – the order of the VDI 2230 table values.
4. The plate compliance is continuous where the cone + sleeve model meets the full-cone model, and turns into the sleeve formula at D_A = d_w.
5. 0 < Φ_n < Φ_K < 1; the bolt compliance is the sum of its parts.
6. Residual clamp load identity, torque coefficient, fatigue limit formula.

## 1. Purpose – what a bolt calculation must prove

A bolted joint works only through its **preload**: the clamp force created at assembly must be large enough for the
whole life (slip, sealing, no opening) but not so large that the bolt yields or the parts are crushed. Between these
limits sit the scatter of friction and of the tightening tool. VDI 2230 turns this into a fixed sequence of steps:

| Step | Question | Chapter |
|---|---|---|
| R0–R1 | Which thread, class, tightening method (α_A)? | 2, 4 |
| R2 | What clamp load is needed (slip, sealing, opening)? | 4 |
| R3 | How is the working load shared between bolt and parts (Φ)? | 3 |
| R4 | How much preload is lost by embedding? | 4, 6 |
| R5–R7, R13 | Required preload range – is it below the permissible preload? Tightening torque | 4 |
| R8 | Does the bolt yield under working load? | 5 |
| R9 | Does the bolt survive the alternating load (fatigue)? | 5 |
| R10 | Are the parts crushed under head and nut? | 6 |
| R11–R12 | Thread engagement; does the joint slip? | 2, 6 |

**Default example** (`python bolt.py examples`): through-bolt with nut M12 10.9, clamp length 40 mm (two C45 plates),
D_A 36 mm, working load 0 … 12 kN, transverse load 3 kN with μ_T 0.15, torque wrench (α_A 1.6), μ_G / μ_K 0.10 … 0.16.

| Result | Value |
|---|---|
| Stiffness | c_S 346 kN/mm, c_P 1423 kN/mm; Φ_K 0.196, Φ_n 0.098 |
| Preload | required F_Mmin 33.5 kN, F_Mmax 53.6 kN ≤ F_Mzul 64.9 kN (utilisation 0.83); M_A 107.9 N m |
| Bolt | S_F 1.15 (yield), S_D 7.0 (fatigue – only 1.2 kN of the 12 kN reach the bolt) |
| Fails | **surface pressure** 902 MPa > 630 MPa of C45 (S_p 0.70) and **slip** S_G 1.35 < 1.8 |
| Fix (chapters 6, 8) | hardened washer and / or M16 8.8 (the program's size selection), or angle-controlled tightening |


---

## 2. Bolted joints, threads, property classes and nuts

A bolted joint is not "a bolt that carries the load". It is a **pre-stressed spring system**: the bolt is a stiff,
stretched tension spring, the clamped parts are an even stiffer compressed spring, and the working load only changes
the balance between the two. Almost every bolt failure in a factory – loosening, fatigue fracture in the first engaged
thread, slipping flanges, leaking covers – is a **preload failure**: the preload was too small, too scattered, or got
lost. VDI 2230 Part 1 (2015) organises the proof in calculation steps R0 … R13; this chapter and the next two follow
those steps with the program `bolt.py`.

### 2.1 Joint types

| Joint | How it works | Typical use | Model consequence |
|---|---|---|---|
| **DSV** – through-bolt with nut (Durchsteckschraubverbindung) | bolt and nut clamp the parts, both sides accessible | flanges, frames, machine bases | deformation cone from both sides, w = 1 |
| **ESV** – tapped-thread joint (Einschraubverbindung) | the bolt is screwed into a threaded part | housings, covers, cylinder heads | cone only from the head side, w = 2; engagement length in the housing material matters (2.6) |
| Stud bolt | stud screwed into the housing, nut on top | covers opened often in cast iron / aluminium | like ESV; housing thread protected from wear |
| Eccentric joint | bolt axis not on the clamping / load axis | bearing caps, conrods, brackets | bolt bending, one-sided opening (VDI 2230 eccentric model – not in this program) |
| Multi-bolt flange | several bolts share force and moment | pipe flanges, slewing rings, gear rims | find the most-loaded bolt from the pattern, then do the single-bolt check |

The program covers the **concentric single-bolt joint** (DSV and ESV), which is the core of every VDI 2230 proof –
multi-bolt and eccentric joints are reduced to it.

```
python bolt.py ch24
```
```
## 2.1 Joint types
  DSV through-bolt with nut    | bolt + nut clamp the parts; both sides accessible | flanges, frames, machine bases                 | cone from both sides (w = 1)
  ESV tapped-thread joint      | bolt screwed into a threaded part              | housings, covers, cylinder heads               | cone from the head side only (w = 2)
  Stud bolt                    | stud screwed in, nut on the free end           | frequently opened covers in cast iron / aluminium | like ESV; thread in the housing protected
  Eccentric joint              | bolt axis not on the load / clamping axis      | brackets, bearing caps, conrods                | bending of the bolt, opening at one edge (VDI 2230 eccentric model)
  Multi-bolt flange            | several bolts share load and moment            | pipe flanges, slewing rings, gear rims         | most loaded bolt from the bolt pattern, then single-bolt check
```

**Default joint of this guide** (`python bolt.py params`): the cylinder-head / flange joint of the V-compressor –
through-bolt **M12 10.9** with nut, clamp length l_K = 40 mm (two C45 plates of 20 mm), shank length 25 mm, outer
diameter of the clamped parts D_A = 36 mm, working load 0 … 12 kN per bolt (pulsating gas force), transverse load 3 kN,
one slip interface with μ_T = 0.15, torque wrench (α_A = 1.6), friction μ_G = μ_K = 0.10 … 0.16.

**Why preload?** Without preload, the full working load and its fluctuation go into the bolt, the joint opens, the
interface slips, and the gasket leaks. With preload F_M the plates stay pressed together, and only a small share
Φ·F_A of the working load reaches the bolt. The joint diagram (chapter 3) shows this in one picture.

### 2.2 The ISO metric thread – basic profile and stress area

The ISO 68-1 basic profile is a 60° triangle of height H = (√3/2)·P, truncated at the crest by H/8 and at the root by
H/4 (internal thread). From the geometry:

```
H   = (√3 / 2) · P = 0.866025 P
d2  = d − 2 · (3/8) H = d − 0.75 H = d − 0.649519 P        (pitch diameter: thread tooth = thread gap)
D1  = d − 2 · (5/8) H = d − 1.25 H = d − 1.082532 P        (minor diameter of the nut)
d3  = d − 2 · (17/24) H = d − 1.226869 P                    (minor diameter of the bolt with rounded root, ISO 965)
```

The **stress area** A_S is the area of a circle with the mean of d2 and d3 – it was found experimentally that a
threaded rod breaks at the same force as a plain rod of this diameter:

```
d_S = (d2 + d3) / 2          A_S = (π/4) · d_S²          A_d3 = (π/4) · d3²
```

Code (`bolt.py`, R0):
```python
def thread_geometry(P):
    t = THREADS[P["thread"]]
    d, p = t["d"], t["P"]
    d2 = d - 0.649519 * p
    d3 = d - 1.226869 * p
    dS = 0.5 * (d2 + d3)
    AS = math.pi / 4 * dS ** 2
    Ad3 = math.pi / 4 * d3 ** 2
    AN = math.pi / 4 * d ** 2
    return dict(t, d2=d2, d3=d3, dS=dS, AS=AS, Ad3=Ad3, AN=AN)
```

The add-on derives the same factors from H:
```
## 2.2 ISO 68-1 basic profile (M12)
  H 1.5155 mm; d2 = d - 0.6495 P = 10.863; d3 = d - 1.2269 P = 9.853; D1 = 10.106 mm
```
and the report line of `python bolt.py examples`:
```
## R0 thread geometry
- d 12.0, P 1.75, d2 10.863, d3 9.853, A_S 84.27 mm2, A_d3 76.25 mm2; head bearing dw 16.6, hole dh 13.5 mm
```

**Hand check:** d2 = 12 − 0.649519·1.75 = 10.863; d3 = 12 − 1.226869·1.75 = 9.853; d_S = 10.358;
A_S = π/4·10.358² = **84.27 mm²** – the value in ISO 898-1 is 84.3 mm² (self-test line 1). For M20: 245 mm² (line 2).

**Head and hole data.** The table `THREADS` holds the width across flats s, the head bearing diameter d_w (≈ d_w,min of
hex bolts ISO 4014 / 4017) and the hole diameter d_h ("medium" series ISO 273). d_w and d_h define the bearing area for
the surface pressure and the start of the deformation cone. For M12: d_w 16.6, d_h 13.5 mm. A **washer** or a flange
bolt raises d_w – this is the usual remedy for surface pressure (chapter 6).

### 2.3 Fine thread vs coarse thread – and why threads hold

A smaller pitch gives a larger d3 and A_S, a smaller lead angle φ = atan(P/(π d2)), and therefore more preload for the
same yield and a stronger **self-locking margin**. A bolt stays tight under a static load as long as the friction angle
ρ′ = atan(μ_G / cos 30°) is larger than the lead angle φ – the "loosening torque" in the thread is

```
M_L = F_M · (d2/2) · tan(ρ′ − φ)        (> 0: the thread does not turn back by itself under pure axial force)
```

```
## 2.3 Fine vs coarse thread (mu_G = mu_K = 0.12, nu 0.9, class 10.9)
  M12       A_S  84.27 mm2, F_Mzul  63.3 kN, M_A  122.8 N m, lead 2.94 deg vs rho' 7.89 deg, loosening torque  29.8 N m
  M12x1.5   A_S  88.13 mm2, F_Mzul  66.9 kN, M_A  127.8 N m, lead 2.48 deg vs rho' 7.89 deg, loosening torque  34.9 N m
  M12x1.25  A_S  92.07 mm2, F_Mzul  70.6 kN, M_A  132.8 N m, lead 2.04 deg vs rho' 7.89 deg, loosening torque  40.5 N m
  M16       A_S 156.67 mm2, F_Mzul 118.9 kN, M_A  302.5 N m, lead 2.48 deg vs rho' 7.89 deg, loosening torque  82.8 N m
  M16x1.5   A_S 167.25 mm2, F_Mzul 128.7 kN, M_A  320.0 N m, lead 1.82 deg vs rho' 7.89 deg, loosening torque 102.9 N m
```

Code:
```python
        lead = math.degrees(math.atan(p / (math.pi * g["d2"])))
        rho = math.degrees(math.atan(1.155 * mu))
        # loosening torque in the thread (positive = self-locking): M_L = F d2/2 tan(rho' - phi)
        ML = t["FMzul"] * g["d2"] / 2 * math.tan(math.radians(rho - lead)) / 1000.0
```

**What the numbers mean.**
- M12×1.25 carries **12 % more preload** than M12 coarse (70.6 vs 63.3 kN) with the same bolt diameter.
- All threads are statically self-locking (ρ′ 7.9° ≫ φ 2–3°). But **static self-locking does not prevent loosening
  under transverse vibration**: when the interface slips sideways, the friction in the thread and under the head is
  momentarily "used up" in the transverse direction and the thread turns back a little each cycle (Junker test,
  DIN 65151). The real protection is **enough residual clamp load so that the interface never slips** – this is the
  slip check R12 (chapter 6). Locking elements (adhesive, prevailing-torque nuts) are only a second line of defence;
  spring washers and toothed lock washers are useless with high-strength bolts (withdrawn standards, check).
- Fine threads are more sensitive to damage and dirt, need more turns to assemble, and strip more easily in soft
  housing materials. Use them for high preload in small space (hydraulic, adjusting nuts, thin walls), not as a default.

### 2.4 Property classes and bolt materials (ISO 898-1)

The class "a.b" codes the strength: Rm ≈ a·100 MPa, R_p0.2 ≈ (b/10)·Rm. The program uses the minimum values of
ISO 898-1 for d ≤ 16 mm (`CLASSES`), which are slightly above the nominal code:

```
## 2.4 Property classes (ISO 898-1)
  8.8   Rm  800 (used  800), Rp/Rm 0.8 -> Rp  640 (used  640) MPa; HV 250-320; C35 / C45, B-alloyed steels, quenched + tempered; general machine building; nut: nut class 8 (ISO 898-2), height m ~ 0.8 d
  10.9  Rm 1000 (used 1040), Rp/Rm 0.9 -> Rp  900 (used  940) MPa; HV 320-380; boron or low-alloy steel (e.g. 34CrMo4), Q+T; high preload; electroplating needs baking; nut: nut class 10
  12.9  Rm 1200 (used 1220), Rp/Rm 0.9 -> Rp 1080 (used 1100) MPa; HV 385-435; alloy steel (e.g. 42CrMo4, 34CrNiMo6), Q+T; hydrogen embrittlement risk: no electroplating, use zinc flake; sensitive to notches; nut: nut class 12
```

Real manufacturing of a bolt (why the strength values look the way they do):
1. **Wire rod** (boron steel for 8.8 / 10.9, CrMo for 12.9), spheroidise annealed, drawn to size.
2. **Cold heading** of the head on multi-stage presses (100–300 parts/min) – the fibre flow follows the head contour,
   which is why a cold-headed bolt is stronger at the head fillet than a turned bolt.
3. **Thread rolling** (flat dies or cylindrical dies) – no cutting: the material is displaced, the root is cold-worked
   and gets compressive residual stress. Rolling *before* heat treatment (the normal case) loses this residual stress
   in hardening; rolling *after* heat treatment keeps it and raises the fatigue strength (chapter 6, `rolled = after`).
4. **Quench and temper** in a continuous belt furnace (austenitise ~850–880 °C, oil quench, temper ≥ 425 °C for
   8.8 / ≥ 340 °C for 12.9 – check ISO 898-1 table 2); decarburisation of the thread surface is limited by the
   standard because it weakens the thread root.
5. **Surface protection**: zinc flake (no hydrogen), phosphate + oil, or electroplated zinc. Electroplating
   charges the steel with hydrogen; above about 320 HV (10.9, 12.9) this can cause **delayed brittle fracture**
   hours or days after tightening – such bolts must be baked (≈ 200 °C, several hours) or zinc-flake coated.
   The coating also defines the **friction coefficient** – choose bolts with a specified friction range
   (e.g. μ_tot 0.09–0.14) or the tightening torque is meaningless (chapter 4).

### 2.5 Nuts and thread engagement

A standard nut of the matching class (8 for 8.8, 10 for 10.9, 12 for 12.9, ISO 898-2) is designed so that the **bolt
breaks before the threads strip** – a broken bolt is obvious, stripped threads are not. In a tapped hole (ESV) the
housing material takes the place of the nut, and the designer must provide a long enough engagement length m.

Simplified idea of VDI 2230 section 5.5.5: the shear strength of the internal thread over the engaged length must be at
least the breaking force of the bolt,

```
Rm,bolt · A_S  ≤  τ_B,housing · (π d · k_shear) · C3 · m_eff        →        m_eff,min = Rm A_S / (τ_B π d k_shear C3)
```

with k_shear ≈ 0.75 (part of the circumference loaded in shear at the thread flanks) and C3 ≈ 0.85 for thread bending
(check). Two pitches are added for the countersink and the incomplete first threads.

```python
def engagement_length(P=None, mat="AlMgSi1 F31", C3=0.85, k_shear=0.75):
    P = P or DEFAULT
    g = thread_geometry(P)
    Rm_b = CLASSES[P["cls"]]["Rm"]
    Rm, r = TAPPED_MATERIALS[mat]
    tau = r * Rm
    per_mm = tau * math.pi * g["d"] * k_shear * C3
    m = Rm_b * g["AS"] / per_mm
    return {"F_bolt_break": Rm_b * g["AS"], "tau_B": tau, "strip_per_mm": per_mm, "m_eff": m, "m_total": m + 2 * g["P"],
            "ratio_d": (m + 2 * g["P"]) / g["d"]}
```

```
## 2.5 Minimum engagement length in a tapped hole (M12 10.9, simplified, check)
  steel C45 (QT)             tau_B   420 MPa,  10094 N/mm -> m_eff   8.7 + 2P =  12.2 mm = 1.02 d
  steel S235                 tau_B   234 MPa,   5624 N/mm -> m_eff  15.6 + 2P =  19.1 mm = 1.59 d
  EN-GJL-250 (grey iron)     tau_B   250 MPa,   6008 N/mm -> m_eff  14.6 + 2P =  18.1 mm = 1.51 d
  EN-GJS-400 (ductile iron)  tau_B   360 MPa,   8652 N/mm -> m_eff  10.1 + 2P =  13.6 mm = 1.14 d
  AlMgSi1 F31                tau_B   186 MPa,   4470 N/mm -> m_eff  19.6 + 2P =  23.1 mm = 1.93 d
  AlSi9Cu3 (die cast)        tau_B   144 MPa,   3461 N/mm -> m_eff  25.3 + 2P =  28.8 mm = 2.40 d
  (8.8 bolt in AlMgSi1: 1.55 d)
```

**Hand check (C45):** F_break = 1040 · 84.27 = 87.6 kN; strip strength per mm = 420 · π · 12 · 0.75 · 0.85 =
10 094 N/mm; m_eff = 87 641 / 10 094 = 8.68 mm; + 2·1.75 = 12.2 mm = **1.0 d**.

These results reproduce the workshop rules: **steel ≈ 1 d, grey iron ≈ 1.25–1.5 d, aluminium ≈ 2 d, die-cast
aluminium ≥ 2.5 d** (check with the material supplier). In aluminium housings with frequent assembly use thread
inserts (wire inserts or solid bushes); they raise the effective diameter and therefore the shear area.

Practical rules for tapped holes:
- Drill depth ≥ engagement + 2…3 P + drill point; blind-hole taps need run-out; chips in a blind hole make the bolt
  "bottom out" – the torque is reached without preload (a classic assembly fault).
- Countersink the hole (90°) so that the first thread does not pull up a burr under the plate (embedding, 4.3).
- Do not use the full strength of a 12.9 bolt in a soft housing: the housing thread decides, not the bolt.

---

## 3. Compliance of bolt and clamped parts, the joint diagram and the load factor

### 3.1 Two springs in a closed loop

The bolt is stretched by f_SM, the clamped parts are compressed by f_PM, both by the same force F_M (the preload):

```
f_SM = δ_S · F_M          f_PM = δ_P · F_M          δ = compliance (mm/N) = 1 / stiffness
```

When a working load F_A is applied **under the head and nut** (n = 1), the bolt gets longer by Δf and the plates relax
by the same Δf. Bolt and plates are therefore springs **in parallel** for the working load:

```
F_SA = Δf / δ_S ,   F_PA = Δf / δ_P ,   F_A = F_SA + F_PA
→  F_SA = δ_P / (δ_S + δ_P) · F_A = Φ_K · F_A        F_PA = (1 − Φ_K) · F_A
```

Φ_K is the load factor for load introduction under the head (K = "Kopf"). If the load is introduced inside the plates
(load introduction factor n < 1), only the part of the plates between the introduction points is relieved, and

```
Φ_n = n · Φ_K
```

Code (R3):
```python
def load_factor(P, g=None):
    g = g or thread_geometry(P)
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    Phi_K = dP / (dS + dP)
    return {"Phi_K": Phi_K, "Phi_n": P["n"] * Phi_K, "cS": 1 / dS, "cP": 1 / dP}
```

**Design meaning:** an elastic bolt (large δ_S) and stiff plates (small δ_P) give a small Φ – the bolt "does not
see" the working load, its stress amplitude is small and its fatigue life long. This is the whole idea of a preloaded
joint.

### 3.2 Bolt compliance – sum of the sections

The bolt is a chain of sections in series; each section i of length l_i and area A_i adds l_i/(E_S·A_i). VDI 2230
adds equivalent lengths for the deformation of the head, the engaged thread and the nut (or tapped hole), which act
like extra bolt length:

| Section | Equivalent length | Area | Code |
|---|---|---|---|
| Head (hex) | 0.5·d | A_N = π d²/4 | `dSK` |
| Shank in the clamp length | l_s | A_N | `d1` |
| Free loaded thread | l_Gew = l_K − l_s | A_d3 | `dGew` |
| Engaged thread | 0.5·d | A_d3 | `dG` |
| Nut (DSV) | 0.4·d, E_S | A_N | `dM` |
| Tapped hole (ESV) | 0.33·d, E of the housing | A_N | `dM` |

```python
def bolt_compliance(P, g=None):
    g = g or thread_geometry(P)
    ES = 205000.0
    d = g["d"]
    lGew = P["lK"] - P["ls"]
    dSK = 0.5 * d / (ES * g["AN"])            # head (hex head)
    d1 = P["ls"] / (ES * g["AN"])             # shank
    dGew = lGew / (ES * g["Ad3"])             # free loaded thread
    dG = 0.5 * d / (ES * g["Ad3"])            # engaged thread
    if P["joint"] == "DSV":
        dM = 0.4 * d / (ES * g["AN"])         # nut
    else:
        EBI = PART_MATERIALS[P["nut_side_material"]]["E"]
        dM = 0.33 * d / (EBI * g["AN"])       # tapped hole
    tot = dSK + d1 + dGew + dG + dM
    return {"dSK": dSK, "d1": d1, "dGew": dGew, "dG": dG, "dM": dM, "deltaS": tot, "lGew": lGew}
```

Report (`python bolt.py examples`):
```
## R3 compliances and load factor
- bolt: head 2.59e-07, shank 1.08e-06, free thread 9.6e-07, engaged thread 3.84e-07, nut / tapped hole 2.07e-07 -> delta_S 2.888e-06 mm/N (c_S 346307 N/mm)
```

**Hand check:** A_N = 113.10 mm², E_S·A_N = 2.3185·10⁷ N.
- head 6 / 2.3185·10⁷ = 2.588·10⁻⁷;
- shank 25 / 2.3185·10⁷ = 1.078·10⁻⁶;
- free thread 15 / (205 000·76.25) = 9.597·10⁻⁷;
- engaged thread 6 / 1.5631·10⁷ = 3.84·10⁻⁷;
- nut 4.8 / 2.3185·10⁷ = 2.07·10⁻⁷.
Sum **2.888·10⁻⁶ mm/N**, stiffness c_S = 346 kN/mm (self-test: "bolt compliance = sum of the parts").

The **free loaded thread** (15 mm) is as compliant as 15·113.1/76.25 = 22 mm of shank – the thread is the soft part of
the bolt. The shank (25 mm) takes 37 % of the total compliance.

### 3.3 Plate compliance – the deformation cone

The preload spreads from the head bearing (diameter d_w) into the plates like a **cone** with half-angle φ. A thin slice
dx of the cone at depth x is an annulus of outer diameter D(x) = d_w + 2x·tan φ and inner diameter d_h. Its compliance is

```
dδ = dx / (E_P · (π/4) · (D(x)² − d_h²))
```

Integrating over the cone height and using ∫ dx / ((a + 2x t)² − d_h²) = 1/(4 t d_h) · ln[(a + 2x t − d_h)/(a + 2x t + d_h)]
gives, for one cone of height l_K/2 in a DSV (two cones, w = 1) or one cone of height l_K in an ESV (w = 2):

```
δ_P,cones = 2 · ln[ (d_w + d_h)(d_w + w l_K tanφ − d_h) / ((d_w − d_h)(d_w + w l_K tanφ + d_h)) ] / (w · E_P · π · d_h · tanφ)
```

The cone can only grow until it reaches the outer edge of the part. If the part is smaller than the cone's base,
D_A < D_A,Gr = d_w + w·l_K·tanφ, the rest is a **sleeve** of outer diameter D_A:

```
δ_P = [ 2/(w d_h tanφ) · ln((d_w + d_h)(D_A − d_h) / ((d_w − d_h)(D_A + d_h)))  +  4/(D_A² − d_h²) · (l_K − (D_A − d_w)/(w tanφ)) ] / (E_P π)
```

The cone angle comes from FE studies in VDI 2230 (2015), with β_L = l_K/d_w and y = D_A/d_w:

```
DSV:  tanφ = 0.362 + 0.032 ln(β_L/2) + 0.153 ln y          ESV:  tanφ = 0.348 + 0.013 ln β_L + 0.193 ln y
```

```python
def cone_angle(P, g=None):
    g = g or thread_geometry(P)
    bL = P["lK"] / g["dw"]
    y = P["DA"] / g["dw"]
    if P["joint"] == "DSV":
        return 0.362 + 0.032 * math.log(bL / 2) + 0.153 * math.log(y)
    return 0.348 + 0.013 * math.log(bL) + 0.193 * math.log(y)

def plate_compliance(P, g=None):
    g = g or thread_geometry(P)
    EP = PART_MATERIALS[P["part_material"]]["E"]
    dw, dh, lK, DA = g["dw"], g["dh"], P["lK"], P["DA"]
    w = 1.0 if P["joint"] == "DSV" else 2.0
    tp = cone_angle(P, g)
    DAGr = dw + w * lK * tp
    if DA >= DAGr:                            # full cones
        dP = 2 * math.log((dw + dh) * (dw + w * lK * tp - dh) / ((dw - dh) * (dw + w * lK * tp + dh))) / (w * EP * math.pi * dh * tp)
        model = "cones"
    elif DA <= dw:                            # pure sleeve
        dP = 4 * lK / (EP * math.pi * (DA ** 2 - dh ** 2))
        model = "sleeve"
    else:                                     # cone + sleeve
        dP = (2 / (w * dh * tp) * math.log((dw + dh) * (DA - dh) / ((dw - dh) * (DA + dh))) +
              4 / (DA ** 2 - dh ** 2) * (lK - (DA - dw) / (w * tp))) / (EP * math.pi)
        model = "cone + sleeve"
    return {"tan_phi": tp, "phi_deg": math.degrees(math.atan(tp)), "DA_Gr": DAGr, "deltaP": dP, "model": model}
```

Report:
```
- plates: tan(phi) 0.4864 (phi 25.94 deg), D_A,Gr 36.06 mm -> cone + sleeve model, delta_P 7.028e-07 mm/N (c_P 1422908 N/mm)
- load factor Phi_K 0.1957, n 0.50 -> Phi_n 0.0979
```

**Hand check.**
- β_L = 40/16.6 = 2.410, y = 36/16.6 = 2.169;
  tanφ = 0.362 + 0.032·ln 1.205 + 0.153·ln 2.169 = 0.362 + 0.00596 + 0.11844 = **0.4864** (φ = 25.9°).
- D_A,Gr = 16.6 + 40·0.4864 = 36.06 mm > D_A = 36 → cone + sleeve, but the sleeve is only
  40 − 19.4/0.4864 = 0.12 mm long – practically two full cones.
- Cone term: 2/(13.5·0.4864) · ln(30.1·22.5 / (3.1·49.5)) = 0.3046 · ln 4.4135 = 0.3046 · 1.4847 = 0.4522;
  sleeve term 4/(1296 − 182.25) · 0.116 = 0.00042; δ_P = 0.4526 / (205 000·π) = **7.03·10⁻⁷ mm/N**.
- Φ_K = 7.028 / (28.88 + 7.028) = **0.1957**; Φ_n = 0.5 · 0.1957 = **0.0979**.

The plates are **4.1 times stiffer** than the bolt (1423 vs 346 kN/mm). The self-test checks that the cone + sleeve
formula meets the full-cone formula exactly at D_A = D_A,Gr and the sleeve formula at D_A = d_w – the three formulas
form one continuous model.

**Plate study** (`plate_study()`):
```
## 3.3 Plate compliance vs D_A and l_K
  l_K   20, D_A   20 (D_A,Gr  24.1): cone + sleeve delta_P 7.006e-07 mm/N, Phi_K 0.2571
  l_K   20, D_A   28 (D_A,Gr  25.1): cones         delta_P 5.791e-07 mm/N, Phi_K 0.2224
  l_K   20, D_A   36 (D_A,Gr  25.9): cones         delta_P 5.531e-07 mm/N, Phi_K 0.2145
  l_K   20, D_A   50 (D_A,Gr  26.9): cones         delta_P 5.227e-07 mm/N, Phi_K 0.2052
  l_K   20, D_A   80 (D_A,Gr  28.3): cones         delta_P 4.849e-07 mm/N, Phi_K 0.1932
  l_K   40, D_A   20 (D_A,Gr  32.5): cone + sleeve delta_P 1.264e-06 mm/N, Phi_K 0.3044
  l_K   40, D_A   28 (D_A,Gr  34.5): cone + sleeve delta_P 7.775e-07 mm/N, Phi_K 0.2121
  l_K   40, D_A   36 (D_A,Gr  36.1): cone + sleeve delta_P 7.028e-07 mm/N, Phi_K 0.1957
  l_K   40, D_A   50 (D_A,Gr  38.1): cones         delta_P 6.565e-07 mm/N, Phi_K 0.1852
  l_K   40, D_A   80 (D_A,Gr  40.9): cones         delta_P 6.003e-07 mm/N, Phi_K 0.1721
  l_K   60, D_A   20 (D_A,Gr  41.2): cone + sleeve delta_P 1.83e-06 mm/N, Phi_K 0.3280
  l_K   60, D_A   28 (D_A,Gr  44.3): cone + sleeve delta_P 9.737e-07 mm/N, Phi_K 0.2061
  l_K   60, D_A   36 (D_A,Gr  46.6): cone + sleeve delta_P 8.019e-07 mm/N, Phi_K 0.1762
  l_K   60, D_A   50 (D_A,Gr  49.6): cones         delta_P 7.175e-07 mm/N, Phi_K 0.1606
  l_K   60, D_A   80 (D_A,Gr  53.9): cones         delta_P 6.518e-07 mm/N, Phi_K 0.1481
```
(shank length l_s = l_K − 15 mm in this study.)

Lessons:
- A **narrow part** (D_A 20 mm, a thin web around the bolt) is a soft sleeve – Φ_K rises to 0.30–0.33, the bolt sees
  50–70 % more alternating load. Keep material around the bolt: D_A ≥ D_A,Gr is the target.
- Beyond D_A,Gr extra width helps little (the cone does not reach it): D_A 50 → 80 changes Φ_K by only 0.01.
- **Long clamp lengths** make the bolt more elastic faster than the plates: Φ_K falls from 0.19 (l_K 20) to 0.15
  (l_K 60) at D_A 80. Long bolts with sleeves (spacer tubes) are an old trick for fatigue-loaded joints.

### 3.4 The joint diagram

Plotting force against elongation, the bolt line rises from the origin with slope c_S, the plate line falls with
slope c_P from the preload point. A working load F_A is drawn as a vertical distance between the two lines:

```
                F ▲
                  │            ● F_S = F_M + F_SA      (bolt force in service)
                  │          ╱│╲
              F_M ┼────────●  │  ╲            plate line (slope −c_P)
                  │      ╱ │  │F_A ╲
                  │    ╱   │  │      ●  F_KR = F_M − F_PA  (residual clamp load)
                  │  ╱  bolt line (slope c_S)    ╲
                  └───────────┼──────────────────────●──► f
                          f_SM            f_SM + f_PM
```

```python
def joint_diagram(P=None, FM=None):
    P = P or DEFAULT
    g = thread_geometry(P)
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    lf = load_factor(P, g)
    FM = FM or FM_zul(P, g) / TIGHTENING[P["tightening"]]
    FA = P["FA_max"]
    fSM, fPM = FM * dS, FM * dP
    FSA = lf["Phi_n"] * FA
    FPA = (1 - lf["Phi_n"]) * FA
    return {"FM": FM, "f_SM_um": fSM * 1000, "f_PM_um": fPM * 1000, "FA": FA, "FSA": FSA, "FPA": FPA,
            "FS": FM + FSA, "FKR": FM - FPA, "f_extra_um": FSA * dS * 1000,
            "bolt_line": [(0.0, 0.0), (fSM * 1000, FM)], "plate_line": [(fSM * 1000, FM), ((fSM + fPM) * 1000, 0.0)]}
```

```
## 3.1 Joint diagram (F_M = F_Mzul / alpha_A)
  F_M 40564 N: bolt elongation 117.13 um, plate compression 28.51 um
  F_A 12000 N -> F_SA 1174 N, F_PA 10826 N; bolt force 41738 N, residual clamp load 29738 N; extra elongation 3.391 um
  bolt line [(0.0, 0.0), (117.13300676448978, 40563.95096990096)], plate line [(117.13300676448978, 40563.95096990096), (145.64078469010948, 0.0)]
```

At the **lowest** preload that the torque wrench can deliver (F_M = F_Mzul/α_A = 40.6 kN) the bolt is stretched by
**0.117 mm** and the plates are compressed by only 0.029 mm. The 12 kN working load adds **1.17 kN** to the bolt
(+2.9 %, 3.4 µm extra stretch) and takes 10.8 kN off the plates. These two small numbers explain the practice:
- The bolt hardly notices the gas force → fatigue is easy (chapter 6).
- **Losing 29 µm of plate compression would lose all the preload** – embedding (4.3) of 9.5 µm is a third of that;
  a paint layer of 30 µm under the head that creeps away would loosen the joint completely. Never clamp paint,
  soft gaskets or rough castings in a highly loaded joint.

### 3.5 Load introduction factor n

Where the working load enters the plates decides how much of the plates is relieved. VDI 2230 (2015) classifies the
joint geometry (SV1 … SV6) and gives n from the distances of the load introduction point (check the guideline's table;
the values below are rough guide values):

```
## 3.4 Load introduction factor n (rough guide, check)
  SV1 n 0.70: Phi_n 0.1370, F_SA  1644 N, F_KRmin  27562 N, sigma_a 9.76 MPa
  SV2 n 0.50: Phi_n 0.0979, F_SA  1174 N, F_KRmin  27092 N, sigma_a 6.97 MPa
  SV3 n 0.40: Phi_n 0.0783, F_SA   940 N, F_KRmin  26858 N, sigma_a 5.57 MPa
  SV4 n 0.30: Phi_n 0.0587, F_SA   705 N, F_KRmin  26623 N, sigma_a 4.18 MPa
  SV5 n 0.15: Phi_n 0.0294, F_SA   352 N, F_KRmin  26270 N, sigma_a 2.09 MPa
  SV6 n 0.10: Phi_n 0.0196, F_SA   235 N, F_KRmin  26153 N, sigma_a 1.39 MPa
```

| Class | Load introduction | n (rough) |
|---|---|---|
| SV1 | close under head and nut (load applied at the outer faces) | 0.7 |
| SV2 | upper third of the plates | 0.5 |
| SV3 | middle of the plates | 0.4 |
| SV4 | near the interface | 0.3 |
| SV5 | at the interface, plates loaded far from the bolt | 0.15 |
| SV6 | at the interface, thin plates | 0.1 |

**Two opposite effects.** A small n is good for the bolt (σ_a 1.4 MPa at n 0.1 vs 9.8 MPa at n 0.7) but takes almost the
full working load out of the clamp force (F_KR changes only by (1 − Φ_n)·F_A). For **fatigue** a small n is
favourable; for **slip and opening** n hardly matters. When in doubt, compute both ends of the plausible n range.

### 3.6 Making the bolt elastic – waisted bolts

For highly fatigue-loaded joints (conrods, cylinder heads of large engines) the shank is reduced to a waist
d_T ≈ 0.9·d3. The bolt becomes more elastic (smaller Φ), but the waist also limits the preload, because tension and
torsion now act on the smaller cross-section. With the plastic torsion modulus (4.6) the waist preload limit is

```
F_Mzul,T = ν R_p0.2 A_T / √(1 + 3 [1.5 (d2/d_T)(P/(π d2) + 1.155 μ_G)]²)
```

```
## 3.2 Waisted bolt study
  full shank d   d_T 12.000 mm: delta_S 2.888e-06 mm/N, Phi_n 0.0979, sigma_a 6.97 MPa, S_D 7.01, F_Mzul  64.9 kN
  waist 1.00 d3  d_T  9.853 mm: delta_S 3.409e-06 mm/N, Phi_n 0.0855, sigma_a 6.09 MPa, S_D 8.03, F_Mzul  58.2 kN
  waist 0.90 d3  d_T  8.868 mm: delta_S 3.784e-06 mm/N, Phi_n 0.0783, sigma_a 5.58 MPa, S_D 8.76, F_Mzul  46.2 kN
  waist 0.80 d3  d_T  7.882 mm: delta_S 4.308e-06 mm/N, Phi_n 0.0701, sigma_a 4.99 MPa, S_D 9.79, F_Mzul  35.4 kN
```

For the compressor flange the waist is **the wrong remedy**: fatigue is already safe (S_D 7), but the waist reduces
the permissible preload by 29 % (0.9 d3) – and the joint already fails the slip check (chapter 6). A waisted bolt pays
only where fatigue governs and the clamp-load requirement is low (cylinder heads with gaskets, conrod bolts tightened
in the yield range).

### 3.7 Opening load

For a concentric joint the interface opens when the residual clamp load reaches zero:

```
F_KR = F_V − (1 − Φ_n) F_A = 0        →        F_Aab = F_V / (1 − Φ_n),      F_V = F_M − F_Z  (preload after embedding)
```

```
## 3.5 Opening load: F_V 37918 .. 62256 N -> F_Aab 42032 .. 69010 N (F_Amax 12000 N)
```

**Hand check:** F_V,min = 40 564 − 2 646 = 37 918 N; F_Aab = 37 918 / 0.9021 = **42.0 kN** – 3.5 times the working
load. Opening is not the problem of this joint; the transverse load (slip) is.

---

## 4. Required clamp load, embedding, preload and tightening (R1–R7, R13)

VDI 2230 works **backwards from what the joint must do**:

```
R2  F_Kerf  (clamp load the interface needs: friction grip, sealing, no opening)
R4  + F_Z   (preload lost by embedding)
R5  + (1 − Φ_n) F_Amax   (clamp load taken away by the working load)
    = F_Mmin   (smallest preload that must still be there after assembly)
R1  × α_A  →  F_Mmax   (largest preload the tightening method may produce)
R7  F_Mmax ≤ F_Mzul      (the bolt must survive the largest preload)
R13 M_A                  (tightening torque that gives F_Mzul at the lowest friction)
```

### 4.1 R1 – tightening factor α_A

α_A = F_Mmax / F_Mmin is the **scatter of the preload** produced by a tightening method. It comes from friction
scatter (dominant), tool scatter, and how the target is set.

```python
TIGHTENING = {   # alpha_A typical (VDI 2230 table A8 style, check)
    "torque wrench / precision nut runner": 1.6,
    "impact wrench, adjusted": 2.5,
    "torque-controlled with friction test on the part": 1.4,
    "angle-controlled (yield range)": 1.0,
    "yield-controlled": 1.0,
}
```

| Method | α_A (check VDI 2230 table A8) | Remarks |
|---|---|---|
| Yield-controlled (gradient method, electronic) | 1.0* | preload scatter only from the yield-strength scatter of the bolt; needs bolt with known R_p0.2 |
| Angle-controlled in the yield range | 1.0* | snug torque + angle; bolt slightly plastic; re-use limited |
| Torque-controlled, friction measured on the real parts | 1.4 … 1.6 | |
| Torque wrench / precision nut runner, friction estimated | 1.6 … 2.0 | the common case |
| Impact wrench, adjusted by test | 2.5 … 4 | only for low-demand joints |

\* For yield-range methods VDI 2230 uses F_Mmin from the minimum yield point and does not multiply by α_A; the
program uses α_A = 1.0 as a simplification (check).

The add-on estimates α_A for our friction range 0.10 … 0.16 and ±5 % tool scatter:
```
## 4.3 Preload band at M_A 107.9 N m: 41134 .. 68147 N -> alpha_A estimate 1.66 (friction + 5 % tool)
```
```python
def friction_band(P=None, tool_scatter=0.05):
    P = P or DEFAULT
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000
    FMmax = MA * (1 + tool_scatter) / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    FMmin = MA * (1 - tool_scatter) / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    return {"MA": MA / 1000, "FMmax": FMmax, "FMmin": FMmin, "alpha_A_est": FMmax / FMmin}
```
1.66 confirms that **α_A = 1.6 is realistic only with bolts of controlled friction** (μ 0.10 … 0.16). With unknown,
dry, mixed bolts (μ 0.08 … 0.20) the scatter would be about 2.

### 4.2 R2 – required clamp load

The interface must transmit the transverse load F_Q by friction over q_F interfaces, and must keep a gasket tight:

```
F_KQ = F_Q / (q_F · μ_T)           F_Kerf = max(F_KQ, F_KP, F_KA)
```

```python
def required_clamp(P):
    FKQ = P["FQ"] / (P["qF"] * P["muT"]) if P["FQ"] > 0 else 0.0
    return {"FKQ": FKQ, "FKP": P["F_seal"], "FKerf": max(FKQ, P["F_seal"])}
```
```
- required clamp load: slip 20000 N, sealing 0 N -> F_Kerf 20000 N
```
3 kN transverse load needs **20 kN** of clamp force at μ_T = 0.15 – friction joints need clamp loads 5–10 times
the transverse force. μ_T is the most uncertain number of the whole calculation: machined dry steel 0.10–0.20,
oiled 0.07–0.10, grit-blasted 0.4–0.6, with friction-enhancing shims (diamond-coated foils) ≥ 0.5 (check VDI 2230
table A6). The safety factor S_G (chapter 6) covers part of this uncertainty.

### 4.3 R4 – embedding

New surfaces have roughness peaks that flatten under load in the first hours – in the thread, under the head and nut,
and in each interface. The plastic flattening f_Z (µm) is lost from the stretch of the bolt and the compression of the
plates, so the preload loss is

```
F_Z = f_Z / (δ_S + δ_P)
```

```python
FZ_TABLE = {   # embedding amounts um (axial load): thread, per head / nut bearing, per inner interface (VDI 2230 table 5 style, check)
    "<10": (3.0, 2.5, 1.5), "10-40": (3.0, 3.0, 2.0), "40-160": (3.0, 4.0, 3.0)}

def embedding(P, g=None):
    g = g or thread_geometry(P)
    ft, fb, fi = FZ_TABLE[P["Rz"]]
    fZ = ft + 2 * fb + fi * P["n_interfaces"]            # um (head + nut bearing; ESV: head only + thread)
    if P["joint"] == "ESV":
        fZ = ft + fb + fi * P["n_interfaces"]
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    return {"fZ_um": fZ, "FZ": fZ / 1000.0 / (dS + dP)}
```
```
- embedding f_Z 9.5 um -> F_Z 2646 N
```
**Hand check:** f_Z = 3 + 2·2.5 + 1.5 = 9.5 µm; F_Z = 0.0095 / (2.888 + 0.703)·10⁻⁶ = **2 646 N**.

```
## 4.4 Embedding (VDI table style, check)
  Rz <10    interfaces 0: f_Z  8.0 um, F_Z  2228 N =  5.5 % of F_Mzul/alpha_A
  Rz <10    interfaces 1: f_Z  9.5 um, F_Z  2646 N =  6.5 % of F_Mzul/alpha_A
  Rz <10    interfaces 3: f_Z 12.5 um, F_Z  3482 N =  8.6 % of F_Mzul/alpha_A
  Rz 10-40  interfaces 0: f_Z  9.0 um, F_Z  2507 N =  6.2 % of F_Mzul/alpha_A
  Rz 10-40  interfaces 1: f_Z 11.0 um, F_Z  3064 N =  7.6 % of F_Mzul/alpha_A
  Rz 10-40  interfaces 3: f_Z 15.0 um, F_Z  4178 N = 10.3 % of F_Mzul/alpha_A
  Rz 40-160 interfaces 0: f_Z 11.0 um, F_Z  3064 N =  7.6 % of F_Mzul/alpha_A
  Rz 40-160 interfaces 1: f_Z 14.0 um, F_Z  3899 N =  9.6 % of F_Mzul/alpha_A
  Rz 40-160 interfaces 3: f_Z 20.0 um, F_Z  5570 N = 13.7 % of F_Mzul/alpha_A
  l_K   15 mm: F_Z  4141 N
  l_K   25 mm: F_Z  3339 N
  l_K   40 mm: F_Z  2646 N
  l_K   80 mm: F_Z  1722 N
```

Lessons for the shop:
- **Short, stiff joints lose the most preload** from the same embedding: l_K 15 mm loses 4.1 kN, l_K 80 mm only 1.7 kN.
  A rule of thumb: l_K / d ≥ 3 … 5 for joints that must keep their preload; otherwise use sleeves.
- Rough castings and many interfaces (stacked shims, washers) double the loss. Machine the bearing faces, avoid
  stacks of thin sheets.
- Embedding happens in hours; **re-tightening after a running-in period** (common on large engines and presses) recovers
  it – but only for joints designed for it and with the same method.
- Soft materials (aluminium, painted surfaces) creep long-term – the embedding table no longer applies; check the
  surface pressure (R10) and use hardened washers.

### 4.4 R5 – minimum and maximum assembly preload

```
F_Mmin = F_Kerf + (1 − Φ_n) F_Amax + F_Z            F_Mmax = α_A · F_Mmin
```
```python
def preload_check(P, g=None):
    g = g or thread_geometry(P)
    rc = required_clamp(P)
    lf = load_factor(P, g)
    ez = embedding(P, g)
    t = tightening(P, g)
    FMmin = rc["FKerf"] + (1 - lf["Phi_n"]) * P["FA_max"] + ez["FZ"]
    FMmax = t["alpha_A"] * FMmin
    return {"FMmin_req": FMmin, "FMmax_req": FMmax, "ok": FMmax <= t["FMzul"],
            "utilisation": FMmax / t["FMzul"]}
```
```
- F_Mmin = F_Kerf + (1 - Phi_n) F_Amax + F_Z = 33472 N; F_Mmax = alpha_A 1.60 x F_Mmin = 53554 N
```
**Hand check:** 20 000 + 0.9021·12 000 + 2 646 = 20 000 + 10 825 + 2 646 = **33 471 N**; ×1.6 = **53 554 N**.

Notice the structure: 60 % of the required preload is the friction-grip requirement, 32 % is the working load,
8 % embedding. Then α_A inflates everything by 60 % – the **tightening method costs more bolt capacity than the
working load**.

### 4.5 Thread torque from the inclined plane

Unwind one thread turn: it becomes an inclined plane of slope tan φ = P/(π d2). Lifting the load F up this plane by a
horizontal force at radius d2/2 against friction (the normal force in a 60° thread is larger by 1/cos 30°, so the
effective friction is μ′ = μ_G / cos 30° = 1.155 μ_G, friction angle ρ′ = atan μ′) needs

```
M_G = F · (d2/2) · tan(φ + ρ′)
```

For small angles tan(φ + ρ′) ≈ tan φ + tan ρ′, so

```
M_G ≈ F · (d2/2) · (P/(π d2) + 1.155 μ_G) = F · (P/(2π) + 0.5775 d2 μ_G) ≈ F · (0.16 P + 0.58 d2 μ_G)
```

The head (or nut) bearing adds friction at the mean bearing radius D_Km/2 = (d_w + d_h)/4:

```
M_K = F · μ_K · D_Km / 2            M_A = M_G + M_K = F · (0.16 P + 0.58 d2 μ_G + (D_Km/2) μ_K)
```

```python
def thread_torque_exact(P=None, F=10000.0, mu=0.12):
    P = P or DEFAULT
    g = thread_geometry(P)
    phi = math.atan(g["P"] / (math.pi * g["d2"]))
    rho = math.atan(mu / math.cos(math.radians(30)))
    exact = F * g["d2"] / 2 * math.tan(phi + rho)
    simple = F * (0.16 * g["P"] + 0.58 * g["d2"] * mu)
    return {"phi_deg": math.degrees(phi), "rho_deg": math.degrees(rho), "MG_exact": exact / 1000, "MG_simple": simple / 1000,
            "error_pct": 100 * (simple / exact - 1)}
```
```
## 4.1 Thread torque: exact inclined plane vs simplified formula (F = 10 kN)
  mu 0.08: phi 2.935 deg, rho' 5.278 deg, M_G exact 7.840 N m, simplified 7.841 N m (+0.01 %)
  mu 0.12: phi 2.935 deg, rho' 7.889 deg, M_G exact 10.385 N m, simplified 10.361 N m (-0.24 %)
  mu 0.16: phi 2.935 deg, rho' 10.467 deg, M_G exact 12.943 N m, simplified 12.881 N m (-0.48 %)
```
**Hand check (μ 0.12):** φ = atan(1.75/(π·10.863)) = 2.935°; ρ′ = atan(0.1386) = 7.889°;
M_G = 10 000 · 5.4315 · tan 10.824° = 54 315 · 0.19118 = **10.38 N m**. The simplified formula is within 0.5 % –
good enough, because μ itself is uncertain by ±25 %.

**Where the torque goes:**
```
## 4.2 Where the tightening torque goes
  mu 0.08: pitch 20.2 %, thread friction 36.4 %, head friction 43.4 % (k = 1.386 mm)
  mu 0.10: pitch 16.8 %, thread friction 37.9 %, head friction 45.3 % (k = 1.663 mm)
  mu 0.12: pitch 14.4 %, thread friction 39.0 %, head friction 46.6 % (k = 1.939 mm)
  mu 0.14: pitch 12.6 %, thread friction 39.8 %, head friction 47.5 % (k = 2.216 mm)
  mu 0.16: pitch 11.2 %, thread friction 40.5 %, head friction 48.3 % (k = 2.492 mm)
```
**Only 11–20 % of the tightening torque produces preload; 80–90 % is friction.** A change of μ from 0.10 to 0.16
raises the "torque coefficient" k by 50 % – the same torque gives 33 % less preload. This is why torque tightening
has α_A ≈ 1.6 and why the bolt's coating, lubrication and the bearing face condition must be specified on the drawing.

### 4.6 R7 – permissible assembly preload F_Mzul

During tightening the bolt carries tension σ_M = F_M/A_0 **and** torsion from the thread torque M_G. The bolt may be
loaded up to a fraction ν (typically 0.9) of its yield point in the von Mises equivalent stress:

```
σ_red = √(σ_M² + 3 τ²) = ν · R_p0.2
```

VDI 2230 uses the **plastic** torsional section modulus W_p = π d_0³/12 (the outer fibres of the thread core are
already yielding in torsion at this load level), with d_0 = d_S and A_0 = A_S:

```
τ / σ_M = [F (d2/2)(P/(π d2) + 1.155 μ_G) / (π d_S³/12)] / [F / (π d_S²/4)] = (3/2) (d2/d_S) (P/(π d2) + 1.155 μ_G)

F_Mzul = ν R_p0.2 A_S / √(1 + 3 [(3/2)(d2/d_S)(P/(π d2) + 1.155 μ_G,min)]²)
```

The **minimum** thread friction is used: low friction leaves more of the yield capacity for tension, and the torque
M_A (4.7) is set for this case – at higher friction the same torque produces less preload, never more.

```python
def FM_zul(P, g=None, mu=None):
    """Permissible assembly preload: sigma_red = nu Rp0.2 with tension + torsion (mu = muG_min)."""
    g = g or thread_geometry(P)
    mu = P["muG_min"] if mu is None else mu
    Rp = CLASSES[P["cls"]]["Rp"]
    k = 1.5 * g["d2"] / g["dS"] * (g["P"] / (math.pi * g["d2"]) + 1.155 * mu)
    return P["nu"] * Rp * g["AS"] / math.sqrt(1 + 3 * k ** 2)
```
```
- F_Mzul (nu 0.90, mu_G 0.10) 64902 N -> utilisation F_Mmax / F_Mzul 0.825 OK
```
**Hand check:** d2/d_S = 1.0488; P/(π d2) = 0.05128; + 0.1155 = 0.16678; k = 1.5·1.0488·0.16678 = 0.26236;
√(1 + 3·0.06883) = 1.0984; F_Mzul = 0.9·940·84.27 / 1.0984 = **64.9 kN**. The self-test confirms
σ_red(tension + plastic torsion) = ν R_p0.2 exactly.

Even at μ_G = 0.10 the torsion takes **10 %** of the bolt's tension capacity (1/1.098); at μ_G 0.16 it would be 17 %.
Lubricated bolts are stronger in assembly.

The R7 check: F_Mmax = 53.6 kN ≤ F_Mzul = 64.9 kN, utilisation **0.825 – OK**. The M12 10.9 can deliver the preload
the joint needs. (Whether the joint survives in service is the subject of chapter 6 – it fails surface pressure and
slip.)

The table of `python bolt.py examples` (μ 0.12) gives the familiar shop-floor values:
```
## Thread size and class: permissible preload and torque (mu_G = mu_K = 0.12, nu 0.9)
  M8   8.8  18.6 kN   24.6 N m | 10.9  27.4 kN   36.1 N m | 12.9  32.0 kN   42.2 N m
  M10  8.8  29.6 kN   48.4 N m | 10.9  43.5 kN   71.1 N m | 12.9  50.9 kN   83.3 N m
  M12  8.8  43.1 kN   83.6 N m | 10.9  63.3 kN  122.8 N m | 12.9  74.1 kN  143.7 N m
  M16  8.8  81.0 kN  205.9 N m | 10.9 118.9 kN  302.5 N m | 12.9 139.2 kN  353.9 N m
  M20  8.8 126.5 kN  403.0 N m | 10.9 185.8 kN  591.9 N m | 12.9 217.5 kN  692.6 N m
```
(The values are of the same order as VDI 2230 table A1; the torque differs a few per cent because table A1 uses
D_Km for a specific head and hole – check the table for released values.)

### 4.7 R13 – tightening torque

```python
def torque_coeff(P, g, muG, muK):
    DKm = 0.5 * (g["dw"] + g["dh"])
    return 0.16 * g["P"] + 0.58 * g["d2"] * muG + 0.5 * DKm * muK      # N mm per N preload

def tightening(P, g=None):
    g = g or thread_geometry(P)
    Fz = FM_zul(P, g)
    MA = Fz * torque_coeff(P, g, P["muG_min"], P["muK_min"]) / 1000.0       # N m
    FM_low_friction = Fz
    FM_high_friction = MA * 1000.0 / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    aA = TIGHTENING[P["tightening"]]
    return {"FMzul": Fz, "MA": MA, "alpha_A": aA, "FM_high_mu": FM_high_friction, "FMmin_from_alphaA": Fz / aA,
            "friction_scatter": FM_low_friction / FM_high_friction}
```
```
- tightening torque M_A 107.9 N m (mu_G 0.10, mu_K 0.10); at high friction (0.16 / 0.16) the same torque gives 43298 N (scatter 1.50)
```
**Hand check:** D_Km = (16.6 + 13.5)/2 = 15.05 mm; k = 0.16·1.75 + 0.58·10.863·0.10 + 7.525·0.10
= 0.280 + 0.630 + 0.753 = 1.663 mm; M_A = 64 902 · 1.663 = **107.9 N m**. At μ 0.16: k = 2.492 mm,
F_M = 107 900 / 2.492 = **43.3 kN**. Friction alone scatters the preload by 1.50.

**Is the lowest preload enough?** 43.3 kN (high friction) > F_Mmin = 33.5 kN – yes. With the tool scatter included
(4.1) the lowest value is 41.1 kN, still above. The joint therefore meets R5/R7; the margin is used in chapter 6.

**The tightening method changes everything** (`python bolt.py examples`):
```
## Tightening method (same joint)
  torque wrench / precision nut runner             alpha_A 1.6: F_Mmax/F_Mzul 0.825, S_G 1.35 fails
  impact wrench, adjusted                          alpha_A 2.5: F_Mmax/F_Mzul 1.289, S_G 0.62 fails
  torque-controlled with friction test on the part alpha_A 1.4: F_Mmax/F_Mzul 0.722, S_G 1.64 fails
  angle-controlled (yield range)                   alpha_A 1.0: F_Mmax/F_Mzul 0.516, S_G 2.57 fails
  yield-controlled                                 alpha_A 1.0: F_Mmax/F_Mzul 0.516, S_G 2.57 fails
```
- An **impact wrench** cannot be used: F_Mmax would exceed F_Mzul (1.29) and the slip safety drops to 0.62.
- Angle- or yield-controlled tightening raises the slip safety to 2.57 – the slip problem disappears – but the
  joint still "fails" because of the surface pressure under the head (chapter 6: hardened washer needed).

### 4.8 Shop practice for preload

1. **Specify friction**, not just torque: drawing note e.g. "M12-10.9, zinc flake, μ_tot 0.09–0.14, M_A 108 N m
   ±5 %" (check with the supplier's friction certificate, ISO 16047 test).
2. **Do not lubricate a bolt specified dry** (or vice versa): lubrication lowers μ by 30–50 % and the same torque then
   overloads the bolt (F_M can exceed F_Mzul).
3. **Torque tools** need calibration (ISO 6789); nut runners with torque + angle monitoring detect stripped threads,
   missing washers and bottomed-out bolts from the torque–angle curve.
4. **Checking assembled bolts** with a torque wrench ("breakaway" or "further-tightening" torque) is only a rough
   check; the reliable measurement of preload is **ultrasonic** (time of flight in the bolt ∝ elongation) or
   instrumented bolts / load washers.
5. **Tightening sequence** for multi-bolt flanges: cross pattern, in 2–3 steps (30 % / 70 % / 100 %), final pass
   all round – otherwise the first bolts lose preload when the others pull the flange flat (elastic interaction).
6. **Re-use**: bolts tightened in the yield range may be re-used only a limited number of times (check the maker);
   torque-tightened bolts within ν = 0.9 can be re-used if threads are undamaged.


---

## 5. Working stress, fatigue, eccentric loading and opening (R8–R9)

Chapters 3 and 4 gave the clamp load the joint needs and the preload the bolt receives at assembly. This chapter checks
the bolt itself in service. It asks three questions:

1. **R8 static strength:** does the bolt yield when the working load F_A comes on top of the assembly preload?
2. **R9 fatigue:** does the alternating part of the bolt load break the thread over millions of cycles?
3. **Eccentricity and opening:** what changes when the bolt or the load is not on the axis of the joint, and at which
   load does the interface start to open?

The default joint is the one of chapter 1: M12 10.9 through-bolt with nut, clamp length l_K 40 mm, D_A 36 mm, parts C45,
F_A 0 … 12 kN dynamic, F_Q 3 kN, torque wrench (α_A 1.6). Its working-state lines in the report are:

`python bolt.py run`
```
## R8 - R12 stresses and safeties
- working: F_SA 1174 N, F_Smax 66077 N, sigma_z 784 MPa, tau 269 MPa, sigma_red 818 MPa (k_tau 0.5) -> S_F 1.15 OK
- fatigue: sigma_a 7.0 MPa, sigma_AS 48.9 MPa (rolled before heat treatment) -> S_D 7.01 OK
- surface pressure: A_p 73.3 mm2, assembly 886 MPa, working 902 MPa, p_G 630 MPa -> S_p 0.70 NOT OK
- slip: F_KRmin 27092 N -> S_G 1.35 (required 1.8) NOT OK
```

The bolt is strong enough (S_F 1.15, S_D 7.01). The joint fails at the **bearing surface** (S_p 0.70) and in **slip**
(S_G 1.35 < 1.8). These two findings are the teaching thread of chapter 6.

### 5.1 R8 – maximum bolt load and reduced stress

**Bolt force in service.** The bolt is tightened to the permissible preload F_Mzul (the worst case: lowest friction gives the
highest preload for a given torque). The working load adds only the share Φ_n·F_A (load factor, chapter 3):

  F_Smax = F_Mzul + F_SA = F_Mzul + Φ_n·F_Amax

**Tension stress** on the stress area A_S:

  σ_z,max = F_Smax / A_S

**Torsion from the thread friction.** During tightening the thread torque M_G twists the bolt:

  M_G = F_M·(d_2/2)·(P/(π·d_2) + 1.155·μ_G,min)

The term P/(π d_2) = tan of the lead angle; 1.155·μ_G = μ_G/cos 30° is the friction of the 60° thread flank. The torsional
stress uses the polar section modulus of the stress diameter d_S = (d_2 + d_3)/2:

  τ = M_G / W_P,  W_P = π·d_S³/16

**Residual torsion.** After the wrench is removed part of the torsion relaxes (the head springs back a little, the thread
settles). VDI 2230 therefore counts only a part k_τ of τ in the working state; k_τ = 0.5 is the recommended value:

  σ_red,B = √(σ_z,max² + 3·(k_τ·τ)²) ≤ R_p0.2  →  S_F = R_p0.2 / σ_red,B ≥ 1.0

Note the difference to R7 (chapter 4): there the full torsion and the *plastic* modulus π d_S³/12 are used to define
F_Mzul at ν = 0.9; here the elastic modulus and k_τ = 0.5 describe the state after assembly.

Code (`bolt.py`):
```python
def working_stress(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    Fz = FM_zul(P, g)
    Rp = CLASSES[P["cls"]]["Rp"]
    FSA = lf["Phi_n"] * P["FA_max"]
    FSmax = Fz + FSA
    sz = FSmax / g["AS"]
    MG = Fz * 0.5 * g["d2"] * (g["P"] / (math.pi * g["d2"]) + 1.155 * P["muG_min"])
    WP = math.pi / 16 * g["dS"] ** 3
    tau = MG / WP
    kt = 0.5                                   # residual torsion after assembly (VDI recommendation)
    sred = math.sqrt(sz ** 2 + 3 * (kt * tau) ** 2)
    return {"FSA": FSA, "FSmax": FSmax, "sigma_z": sz, "tau": tau, "sigma_red": sred, "S_F": Rp / sred,
            "FSA_ok": FSA <= 0.1 * Rp * g["AS"]}
```

**Hand check** (M12: d_2 10.863, d_3 9.853, d_S 10.358 mm, A_S 84.27 mm², P 1.75 mm, F_Mzul 64 902 N, Φ_n 0.0979):

- F_SA = 0.0979 × 12 000 = 1175 N (program 1174 N, Φ_n not rounded); F_Smax = 64 902 + 1174 = 66 076 N
- σ_z = 66 076 / 84.27 = 784 MPa
- M_G = 64 902 × 5.4315 × (1.75/(π × 10.863) + 1.155 × 0.10) = 64 902 × 5.4315 × (0.05128 + 0.1155) = 58 791 N mm
- W_P = π × 10.358³/16 = 218.2 mm³ → τ = 58 791 / 218.2 = 269 MPa
- σ_red = √(784² + 3 × (0.5 × 269)²) = √(614 656 + 54 270) = 818 MPa → S_F = 940/818 = 1.15 ✓

**Why S_F is only 1.15 – and why that is correct.** A bolt is the one machine element that is *meant* to be used close to
its yield point. ν = 0.9 at assembly already uses 90 % of R_p0.2 with full torsion. The working load adds very little
because Φ_n is small (the stiff plates take ~90 % of F_A). The margin is in the preload level, not in a large safety
factor.

**Influence of k_τ.**

`python bolt.py ch56`
```
## 5.1 Working stress: residual torsion factor k_tau
  k_tau 0.0: sigma_red 784 MPa, S_F 1.20
  k_tau 0.5: sigma_red 818 MPa, S_F 1.15
  k_tau 1.0: sigma_red 913 MPa, S_F 1.03
  yield-controlled: F_M(nu 0.9) 64902 N, F_M(nu 1.0) 72114 N, upper yield scatter 82931 N; slip S_G 2.57
```

Code:
```python
def ktau_study(P, kts=(0.0, 0.5, 1.0)):
    g = thread_geometry(P)
    ws = working_stress(P, g)
    Rp = CLASSES[P["cls"]]["Rp"]
    out = []
    for k in kts:
        sred = math.sqrt(ws["sigma_z"] ** 2 + 3 * (k * ws["tau"]) ** 2)
        out.append({"k_tau": k, "sigma_red": sred, "S_F": Rp / sred})
    return out
```

Even with the full torsion kept (k_τ 1.0) the bolt does not yield in service (S_F 1.03). When is k_τ = 1 realistic? On
joints that are tightened and never "settle" – very short, stiff bolts in a dry thread. When k_τ = 0? After the joint has
been loaded once beyond the preload direction (the torsion is shaken out) – never count on it.

**Yield-controlled and angle-controlled tightening.** With a torque wrench the preload scatter (friction, tool) forces the
designer to stay at ν = 0.9 for the *highest* preload, and the lowest preload is F_Mzul/α_A. Yield-controlled tightening
(the controller stops at the knee of the torque–angle curve) and angle-controlled tightening into the plastic range
(snug torque + angle, e.g. 30 N m + 90°) put the bolt *at* its yield point:

- preload ≈ F_M(ν = 1.0) = 72 114 N – 11 % more than F_Mzul at ν 0.9;
- scatter comes only from the yield point of the batch (R_p0.2 between the minimum and ~1.15 × minimum, check): the
  highest preload is 82 931 N – the bolt and the parts must tolerate it (surface pressure!);
- α_A ≈ 1.0 for the *minimum*: the slip safety jumps from 1.35 to 2.57.

Code:
```python
def yield_controlled(P):
    g = thread_geometry(P)
    F_nu1 = FM_zul(dict(P, nu=1.0), g)
    Rp = CLASSES[P["cls"]]["Rp"]
    Rp_max = 1.15 * Rp                                    # upper yield scatter of a class (example, check)
    return {"FM_nu09": FM_zul(P, g), "FM_nu1": F_nu1, "FM_max_yield_scatter": F_nu1 * Rp_max / Rp,
            "slip_S_G": slip(dict(P, tightening="angle-controlled (yield range)"), g)["S_G"]}
```

The program keeps the stress check at F_Mzul (ν 0.9) for this method; in the yield range the working stress check of
VDI 2230 is replaced by the condition F_SA ≤ 0.1·R_p0.2·A_S (the bolt can take only a small additional load once it is
at yield). The core returns that check as `FSA_ok` (here 1174 N ≤ 0.1 × 940 × 84.27 = 7921 N ✓). Practical rules:

| Rule | Reason |
|---|---|
| Angle method only with bolts that have enough plastic elongation (class 8.8 / 10.9, long free thread or waisted shank) | short, fully engaged bolts break before the angle is reached |
| Re-use only as specified (often once or never) | each tightening adds plastic strain; cylinder-head bolts are usually single-use |
| Surface pressure checked with the **upper** yield preload | 82.9 kN, not 64.9 kN |
| Monitor torque *and* angle (window) | a low torque at the final angle shows a stripped thread or a missing washer |

### 5.2 R9 – fatigue of the bolt

**Why the thread is so weak in fatigue.** The first engaged thread turn in the nut carries roughly a third of the bolt load
(load distribution in the thread, check), and the thread root is a sharp notch (stress concentration factor ~ 4–6). The
result: a high-strength bolt that withstands 940 MPa static tension survives only about **±50 MPa stress amplitude** at
2·10⁶ cycles. The strength class hardly matters for fatigue – the notch dominates.

**Stress amplitude.** Only the share Φ_n of the alternating working load reaches the bolt:

  σ_a = (F_SAo − F_SAu)/(2·A_S) = Φ_n·(F_Amax − F_Amin)/(2·A_S)

**Endurance limit, thread rolled before heat treatment** (the normal case for 8.8 … 12.9, VDI 2230 R9):

  σ_ASV = 0.85·(150/d + 45)  [MPa, d in mm]

**Endurance limit, thread rolled after heat treatment** (the rolling leaves compressive residual stress in the hardened
root – it is lost if the bolt is hardened afterwards):

  σ_ASG = (2 − F_Sm/F_0.2min)·σ_ASV,  F_Sm = F_Mzul + Φ_n·(F_Amax + F_Amin)/2,  F_0.2min = R_p0.2·A_S

The gain is large when the mean load is low and disappears when the bolt runs at its yield point (F_Sm/F_0.2 → 1).

  S_D = σ_AS / σ_a ≥ 1.2

Code:
```python
def fatigue(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    sa = lf["Phi_n"] * (P["FA_max"] - P["FA_min"]) / (2 * g["AS"])
    sASV = 0.85 * (150.0 / g["d"] + 45.0)
    if P["rolled"] == "after":
        Fz = FM_zul(P, g)
        F02 = CLASSES[P["cls"]]["Rp"] * g["AS"]
        FSm = Fz + lf["Phi_n"] * (P["FA_max"] + P["FA_min"]) / 2
        sAS = (2 - FSm / F02) * sASV
    else:
        sAS = sASV
    return {"sigma_a": sa, "sigma_AS": sAS, "S_D": sAS / sa if sa > 0 else float("inf")}
```

**Hand check:** σ_a = 0.0979 × 12 000/(2 × 84.27) = 6.97 MPa; σ_ASV = 0.85 × (150/12 + 45) = 0.85 × 57.5 = 48.9 MPa;
S_D = 48.9/6.97 = 7.01 ✓.

**Finite life.** Below the knee point N_D = 2·10⁶ the permissible amplitude rises with slope k = 3 (check VDI 2230 R9 for
the validity range, roughly 10⁴ < N < 2·10⁶):

  σ_AZSV = σ_ASV·(N_D/N)^(1/3)

`python bolt.py ch56`
```
## 5.2 Fatigue: finite life (sigma_AS (2e6/N)^(1/3))
  N    10000: sigma_AZ 285.8 MPa, S_D 41.02
  N   100000: sigma_AZ 132.7 MPa, S_D 19.04
  N   500000: sigma_AZ 77.6 MPa, S_D 11.13
  N  2000000: sigma_AZ 48.9 MPa, S_D 7.01
```

Code:
```python
def fatigue_finite(P, Ns=(1e4, 1e5, 5e5, 2e6)):
    f = fatigue(P)
    out = []
    for N in Ns:
        s = f["sigma_AS"] * (2e6 / N) ** (1 / 3.0)
        out.append({"N": N, "sigma_AZ": s, "S_D": s / f["sigma_a"] if f["sigma_a"] > 0 else float("inf")})
    return out
```

Check at N = 10⁴: 48.9 × (200)^(1/3) = 48.9 × 5.848 = 286 MPa ✓. A compressor head bolt sees one gas-pressure cycle per
crank revolution: 1450 rpm × 60 × 20 000 h = 1.7·10⁹ cycles – always design for the endurance limit, finite life is only
for start/stop or pressure-test loads.

**Rolled after heat treatment – Haigh-type points.**

`python bolt.py ch56`
```
  rolled after heat treatment, sigma_ASG = (2 - F_Sm/F_0.2) sigma_ASV:
    F_Sm/F_0.2 0.2: sigma_ASG 88.0 MPa (x 1.8)
    F_Sm/F_0.2 0.4: sigma_ASG 78.2 MPa (x 1.6)
    F_Sm/F_0.2 0.6: sigma_ASG 68.4 MPa (x 1.4)
    F_Sm/F_0.2 0.8: sigma_ASG 58.6 MPa (x 1.2)
    F_Sm/F_0.2 1.0: sigma_ASG 48.9 MPa (x 1.0)
```

Code:
```python
def haigh_after_HT(P, ratios=(0.2, 0.4, 0.6, 0.8, 1.0)):
    g = thread_geometry(P)
    sASV = 0.85 * (150.0 / g["d"] + 45.0)
    return [{"FSm_F02": r, "sigma_ASG": (2 - r) * sASV, "gain": 2 - r} for r in ratios]
```

These points form a falling straight line in the Haigh diagram (amplitude over mean stress): the residual compressive
stress from rolling helps most at low mean stress. A bolt tightened to ν = 0.9 runs at F_Sm/F_0.2 ≈ 0.8 → gain only
1.2. In our default (F_A 0 … 12 kN): F_Sm = 64 902 + 0.0979 × 6000 = 65 489 N, F_0.2 = 940 × 84.27 = 79 214 N → ratio
0.827 → gain 1.17. In the 40 kN study below: F_Sm = 64 902 + 0.0979 × 20 000 = 66 860 N → ratio 0.844 → gain 1.156 →
σ_ASG = 1.156 × 48.9 = 56.5 MPa (the "rolled after" line).

**Fatigue measures.** To show their effect the load is raised to F_A 0 … 40 kN (a heavy dynamic joint):

`python bolt.py ch56`
```
  fatigue measures at F_A 0..40 kN:
    default (shank d, lK 40)                 Phi_n 0.0979, sigma_a  23.2 MPa, sigma_AS  48.9 MPa, S_D 2.10
    waisted shank dT = 0.9 d3                Phi_n 0.0783, sigma_a  18.6 MPa, sigma_AS  48.9 MPa, S_D 2.63
    longer clamp lK 60 (sleeve)              Phi_n 0.0881, sigma_a  20.9 MPa, sigma_AS  48.9 MPa, S_D 2.34
    thread rolled after heat treatment       Phi_n 0.0979, sigma_a  23.2 MPa, sigma_AS  56.5 MPa, S_D 2.43
    load introduced near interface n = 0.3   Phi_n 0.0587, sigma_a  13.9 MPa, sigma_AS  48.9 MPa, S_D 3.51
```

Code (waisted shank compliance and the study):
```python
def _waisted_deltaS(P, g, dT):
    b = bolt_compliance(P, g)
    ES = 205000.0
    return b["deltaS"] - b["d1"] + P["ls"] / (ES * math.pi / 4 * dT ** 2)


def fatigue_measures(P, FA_max=None):
    FA = FA_max or P["FA_max"]
    Q = dict(P, FA_max=FA, FA_min=0.0)
    g = thread_geometry(Q)
    rows = []

    def row(name, Phi_n, sAS):
        sa = Phi_n * FA / (2 * g["AS"])
        rows.append({"measure": name, "Phi_n": Phi_n, "sigma_a": sa, "sigma_AS": sAS, "S_D": sAS / sa})
    base = load_factor(Q, g)
    row("default (shank d, lK 40)", base["Phi_n"], fatigue(Q, g)["sigma_AS"])
    dT = 0.9 * g["d3"]
    dS_w = _waisted_deltaS(Q, g, dT)
    dP = plate_compliance(Q, g)["deltaP"]
    row("waisted shank dT = 0.9 d3", Q["n"] * dP / (dS_w + dP), fatigue(Q, g)["sigma_AS"])
    ...
```

Hand check of the waisted shank: d_T = 0.9 × 9.853 = 8.868 mm, area 61.76 mm². The shank part changes from
25/(205 000 × 113.1) = 1.078·10⁻⁶ to 25/(205 000 × 61.76) = 1.975·10⁻⁶ mm/N → δ_S = 2.888 + 0.897 = 3.785·10⁻⁶ mm/N.
Φ_n = 0.5 × 0.7028/(3.785 + 0.7028) = 0.0783 ✓.

What each measure does physically:

| Measure | Mechanism | Cost / limit |
|---|---|---|
| Waisted (reduced) shank d_T ≈ 0.9 d_3 | softer bolt → smaller Φ, less load in the bolt | must not be the weakest section in tension: d_T ≥ 0.9 d_3 |
| Longer clamp length (sleeve, spacer) | softer bolt relative to plates | space; sleeve adds an interface (embedding) |
| Thread rolled after heat treatment | compressive residual stress in the root | special bolt, ~ +30 % price, gain falls at high preload |
| Load introduced near the interface (small n) | the bolt "sees" less of F_A | design of the parts: load path close to the interface |
| Nut with tension flange / lip nut | spreads the load over more thread turns, lower peak at the first turn | special nut (check data) |
| **Higher preload** | keeps the joint closed; does *not* change σ_a as long as the joint stays closed | no gain when already closed – but essential to avoid opening (5.3) |
| Fine thread | slightly larger A_S | lower stripping strength, more sensitive to damage |

The single most effective measure in practice is often **n**: the same bolt sees 40 % less amplitude when the load is
introduced close to the interface instead of under the head.

### 5.3 Eccentric clamping and loading – opening of the interface

The core program assumes a **concentric** joint: bolt axis, interface centroid and load line coincide. Real flanges,
connecting-rod caps and housing covers are eccentric: the bolt sits at a distance s_sym from the axis of the interface
area, and the working load acts at a distance a. Then:

1. the working load bends the clamped parts; the bolt is stretched more than in the concentric case → larger load factor
   Φ_en;
2. the interface pressure is no longer uniform; on the load side it falls first – at the **opening load F_Aab** the
   interface starts to gape. After that the bolt load rises steeply (the bolt takes almost all of the additional load)
   and fatigue failures follow quickly.

VDI 2230 treats this with the bending compliance β_P of the clamped parts and gives exact formulas for Φ_en and F_Aab
(R8–R9, eccentric case). The add-on uses a **simplified beam model** to show the trend (check the guideline for design):

- interface: rectangle b × c (here 40 × 36 mm) minus the hole, area A_D, second moment I = b c³/12, edge distance u = c/2;
- clamp load in the interface F_K = F_V − (1 − Φ_en)·F_A, with F_V = F_Mzul/α_A − F_Z (lowest preload after embedding);
- moment about the interface axis: M = F_A·a − F_K·s_sym (bolt on the opposite side of the axis helps);
- edge pressure on the load side: σ_edge = F_K/A_D − M·u/I. Setting σ_edge = 0 and solving for F_A:

  F_Aab = F_V·k_1 / (a·u/I + (1 − Φ_en)·k_1),  k_1 = 1/A_D + s_sym·u/I

- trend form of the eccentric load factor: Φ_en ≈ Φ_n·(1 + a·s_sym·A_D/I).

Code:
```python
def eccentric_opening(P, s_sym=8.0, a=20.0, b_int=40.0, c_int=36.0):
    g = thread_geometry(P)
    lf = load_factor(P, g)
    t = tightening(P, g)
    ez = embedding(P, g)
    AD = b_int * c_int - math.pi / 4 * g["dh"] ** 2
    I = b_int * c_int ** 3 / 12.0
    u = c_int / 2
    FV = t["FMzul"] / t["alpha_A"] - ez["FZ"]
    k1 = 1 / AD + s_sym * u / I
    Phi_en = lf["Phi_n"] * (1 + a * s_sym * AD / I)
    FAab = FV * k1 / (a * u / I + (1 - Phi_en) * k1)
    return {"AD": AD, "I": I, "FV_min": FV, "Phi_n": lf["Phi_n"], "Phi_en": Phi_en, "FA_ab": FAab,
            "FA_ab_centric": FV / (1 - lf["Phi_n"])}
```

`python bolt.py ch56`
```
## 5.3 Eccentric loading (beam model, s_sym 8 mm, interface 40 x 36 mm)
  a  0.0 mm: Phi_en 0.0979, opening load F_Aab 42032 N (centric limit 42032 N)
  a 10.0 mm: Phi_en 0.1632, opening load F_Aab 24965 N (centric limit 42032 N)
  a 20.0 mm: Phi_en 0.2285, opening load F_Aab 17755 N (centric limit 42032 N)
  a 30.0 mm: Phi_en 0.2937, opening load F_Aab 13777 N (centric limit 42032 N)
```

**Hand check at a = 0** (concentric load): F_V = 64 902/1.6 − 2646 = 37 918 N. With a = 0 the formula reduces to
F_Aab = F_V/(1 − Φ_n) = 37 918/0.9021 = 42 032 N ✓ – the familiar condition that the residual clamp load becomes zero.

**Reading the trend.** With the load 30 mm off the bolt axis the joint opens already at 13.8 kN – one third of the
concentric value – and the load factor triples. The default F_Amax of 12 kN is still below, but with little margin. Design
rules:

| Rule | Why |
|---|---|
| Put the bolt as close as possible to the load line (small a) | the moment F_A·a is what opens the joint |
| Keep the bolt close to the edge on the load side (s_sym towards the load) | the clamp load then counteracts the moment |
| Make the interface wide in the direction of bending (large I) | lower edge pressure drop |
| Check F_Amax < F_Aab with margin, and use Φ_en in the fatigue check | after opening, σ_a explodes |
| Connecting-rod caps, crank-case main-bearing caps: always eccentric – use the full VDI 2230 eccentric procedure or FEA | the beam model is only a trend |

---

## 6. Surface pressure, embedding, temperature, slip and multi-bolt joints (R10–R12)

### 6.1 R10 – surface pressure under the head and nut

The head (and nut) bearing area is a ring:

  A_p = (π/4)·(d_w² − d_h²)

The pressure at assembly and in service must stay below the limiting surface pressure p_G of the softer clamped part:

  p_M = F_Mzul / A_p,  p_B = F_Smax / A_p ≤ p_G  →  S_p = p_G / p_B ≥ 1.0

If p_G is exceeded, the part material creeps plastically under the head. The result is **preload loss after assembly**
(much larger than the embedding of chapter 4) and, under vibration, loosening.

Code:
```python
def surface_pressure(P, g=None):
    g = g or thread_geometry(P)
    Ap = math.pi / 4 * (g["dw"] ** 2 - g["dh"] ** 2)
    Fz = FM_zul(P, g)
    FSmax = working_stress(P, g)["FSmax"]
    pG = min(PART_MATERIALS[P["part_material"]]["pG"], PART_MATERIALS[P["nut_side_material"]]["pG"])
    pM, pB = Fz / Ap, FSmax / Ap
    return {"Ap": Ap, "p_assembly": pM, "p_working": pB, "pG": pG, "S_p": pG / pB}
```

**Hand check:** A_p = π/4 × (16.6² − 13.5²) = π/4 × (275.56 − 182.25) = 73.3 mm²; p_B = 66 077/73.3 = 902 MPa;
S_p = 630/902 = 0.70 ✗. The ring is very narrow: the medium hole d_h 13.5 mm (ISO 273) leaves only 1.55 mm of bearing
width under a standard hex head. High-strength bolts (10.9, 12.9) almost always need a washer or a flange head on
normal structural steel.

**Remedies.**

`python bolt.py ch56`
```
## 6.1 Surface pressure options (working load)
  hex head on C45 (default)      A_p   73.3 mm2, p  902 MPa, p_G  630 -> S_p 0.70
  hardened washer D 24 mm        A_p  309.3 mm2, p  212 MPa, p_G  630 -> S_p 2.97
  parts 42CrMo4 QT               A_p   73.3 mm2, p  902 MPa, p_G 1080 -> S_p 1.20
  flange bolt (dw ~ 20.6 mm)     A_p  190.2 mm2, p  345 MPa, p_G  630 -> S_p 1.82
```

Code:
```python
def with_washer(P, D_washer=24.0, h_washer=2.5):
    key = P["thread"] + "+washer"
    t0 = THREADS[P["thread"]]
    THREADS[key] = dict(t0, dw=D_washer)
    try:
        Q = dict(P, thread=key, n_interfaces=P["n_interfaces"] + 1, lK=P["lK"] + h_washer)
        S = summary(Q)
    finally:
        del THREADS[key]
    return S
```

Hand check of the washer: A_p = π/4 × (24² − 13.5²) = π/4 × 393.75 = 309.3 mm² ✓. The washer (ISO 7089, 300 HV, outer
diameter 24 mm for M12) raises the clamp length by 2.5 mm and adds one interface – the program accounts for both. The
pressure on the *washer itself* under the head (902 MPa on a 300 HV washer with p_G ≈ 1100 MPa) is acceptable. The load
spread through the washer thickness is ignored; that is conservative for the plate.

Limiting surface pressures (typical, check VDI 2230 table A9 and the material supplier):

| Material | p_G MPa | Material | p_G MPa |
|---|---|---|---|
| S235JR | 490 | EN-GJL-250 | 850 |
| E295 | 710 | EN-GJS-400 | 600 |
| C45 normalised | 630 | EN-GJS-600 | 900 |
| 34CrNiMo6 QT | 1080 | AlMgSi1 F31 | 360 |
| 38MnB5 QT | 1100 | AlZnMgCu1.5 | 370 |
| hardened washer 300 HV | 1100 | GD-AlSi9Cu3 (die cast) | 220 |
| | | GD-MgAl9Zn1 (magnesium) | 140 |

The table is in the add-on as `PG_TABLE`. Grey cast iron has a high p_G (850 MPa) because it is strong in compression –
compressor crankcases in GJL take a 10.9 bolt directly; aluminium and magnesium housings always need washers, flange
bolts or steel inserts.

### 6.2 R4 in detail – embedding and creep

**Embedding** (settling) is the plastic flattening of the surface roughness peaks in the thread, under the head and nut
and in every interface during the first load cycles. It shortens the joint by f_Z and costs the preload

  F_Z = f_Z / (δ_S + δ_P)

because bolt and plates spring back together over the total compliance. The amounts depend on roughness and the number of
surfaces (VDI 2230 table 5 style values, axial load, check):

| Rz | thread | per head / nut bearing | per inner interface |
|---|---|---|---|
| < 10 µm | 3 µm | 2.5 µm | 1.5 µm |
| 10 – 40 µm | 3 µm | 3.0 µm | 2.0 µm |
| 40 – 160 µm | 3 µm | 4.0 µm | 3.0 µm |

Code:
```python
FZ_TABLE = {   # embedding amounts um (axial load): thread, per head / nut bearing, per inner interface (VDI 2230 table 5 style, check)
    "<10": (3.0, 2.5, 1.5), "10-40": (3.0, 3.0, 2.0), "40-160": (3.0, 4.0, 3.0)}

def embedding(P, g=None):
    g = g or thread_geometry(P)
    ft, fb, fi = FZ_TABLE[P["Rz"]]
    fZ = ft + 2 * fb + fi * P["n_interfaces"]            # um (head + nut bearing; ESV: head only + thread)
    if P["joint"] == "ESV":
        fZ = ft + fb + fi * P["n_interfaces"]
    dS = bolt_compliance(P, g)["deltaS"]
    dP = plate_compliance(P, g)["deltaP"]
    return {"fZ_um": fZ, "FZ": fZ / 1000.0 / (dS + dP)}
```

Hand check (default, Rz < 10, one interface): f_Z = 3 + 2 × 2.5 + 1.5 = 9.5 µm; F_Z = 0.0095/(2.888 + 0.703)·10⁻⁶ =
0.0095/3.591·10⁻⁶ = 2646 N ✓.

`python bolt.py ch56`
```
## 6.2 Embedding by roughness and number of interfaces
  Rz <10    interfaces 0: f_Z  8.0 um, F_Z  2228 N (3.4 % of F_Mzul)
  Rz <10    interfaces 1: f_Z  9.5 um, F_Z  2646 N (4.1 % of F_Mzul)
  Rz <10    interfaces 3: f_Z 12.5 um, F_Z  3482 N (5.4 % of F_Mzul)
  Rz 10-40  interfaces 0: f_Z  9.0 um, F_Z  2507 N (3.9 % of F_Mzul)
  Rz 10-40  interfaces 1: f_Z 11.0 um, F_Z  3064 N (4.7 % of F_Mzul)
  Rz 10-40  interfaces 3: f_Z 15.0 um, F_Z  4178 N (6.4 % of F_Mzul)
  Rz 40-160 interfaces 0: f_Z 11.0 um, F_Z  3064 N (4.7 % of F_Mzul)
  Rz 40-160 interfaces 1: f_Z 14.0 um, F_Z  3899 N (6.0 % of F_Mzul)
  Rz 40-160 interfaces 3: f_Z 20.0 um, F_Z  5570 N (8.6 % of F_Mzul)
```

**Why short, stiff joints are critical.** F_Z grows with 1/(δ_S + δ_P): a short bolt (small δ_S) loses much more preload
for the same f_Z. Rule of thumb: keep the clamp length l_K ≥ 3–5 d; a 1-d clamp length can lose 20 % or more. Here
(l_K = 3.3 d) the loss is 4–9 %.

**Creep and relaxation** come on top of embedding when the clamped parts are not steel:

| Part material | Effect | Measure (check data) |
|---|---|---|
| Aluminium wrought / cast, > 100 °C | creep under the head and in the thread → preload loss 10–30 % over time | washer, large d_w, steel insert (Helicoil), re-tighten after run-in, avoid > 120 °C |
| Magnesium | creep already at 80–100 °C | steel sleeves through the clamped part |
| Plastics, gaskets | strong creep, preload loss > 50 % | compression limiters (steel sleeves), metal-to-metal contact |
| Painted / coated interfaces | paint flows | mask the interfaces, or slip-resistant coating (zinc silicate) |

### 6.3 Temperature – thermal change of the preload

If bolt and clamped parts have different thermal expansion α, a temperature change ΔT changes their free lengths by
different amounts. The difference must be absorbed elastically over the total compliance:

  ΔF_Vth = (α_P − α_S)·ΔT·l_K / (δ_S + δ_P)

Positive: the parts expand more than the bolt → preload **rises** when hot and **falls** when cold. (The change of E with
temperature and creep are ignored here – check VDI 2230 R4 temperature terms.)

Code:
```python
ALPHA = {"steel": 11.5e-6, "stainless A2": 16.0e-6, "aluminium": 23.0e-6, "grey cast iron": 10.5e-6, "magnesium": 26.0e-6}


def thermal_preload(P, dT=80.0, part="aluminium", part_material="AlMgSi1 F31", bolt="steel"):
    Q = dict(P, part_material=part_material, nut_side_material=part_material)
    g = thread_geometry(Q)
    dS = bolt_compliance(Q, g)["deltaS"]
    dP = plate_compliance(Q, g)["deltaP"]
    dF = (ALPHA[part] - ALPHA[bolt]) * dT * P["lK"] / (dS + dP)
    return {"dT": dT, "deltaS": dS, "deltaP": dP, "dF_Vth": dF, "FMzul": FM_zul(Q, g)}
```

`python bolt.py ch56`
```
## 6.3 Temperature: steel bolt in aluminium parts
  dT   -40 K: dF_Vth  -3720 N (F_Mzul 64902 N)
  dT   +40 K: dF_Vth  +3720 N (F_Mzul 64902 N)
  dT   +80 K: dF_Vth  +7441 N (F_Mzul 64902 N)
  dT  +120 K: dF_Vth +11161 N (F_Mzul 64902 N)
  steel bolt in stainless parts, dT +80 K: dF_Vth +4011 N
```

Hand check (+40 K, aluminium plates): free length difference (23 − 11.5)·10⁻⁶ × 40 × 40 mm = 0.0184 mm. The plate
compliance in aluminium (E 70 000) is about 2.06·10⁻⁶ mm/N, so δ_S + δ_P = 2.888 + 2.06 ≈ 4.95·10⁻⁶ mm/N and
ΔF = 0.0184/4.95·10⁻⁶ = 3720 N ✓.

Consequences:

| Case | Problem | Design answer |
|---|---|---|
| Steel bolt in aluminium, hot (+80 K) | +7.4 kN on top of F_Mzul → bolt may yield, aluminium creeps under the head | assemble at ν ≤ 0.8, washer, check σ_red with F_Mzul + ΔF_Vth |
| Same joint, cold start (−40 K) | −3.7 kN → may fall below F_Kerf (leak, slip) | include −ΔF_Vth in F_Mmin (R5) |
| Steel bolt in stainless parts | +4 kN hot | same as above, smaller |
| Bolt hotter than the parts (exhaust flanges) | preload drops | long, waisted bolts; heat-resistant bolt steel |

In a compressor the cylinder head runs at 120–180 °C while the bolt is cooler at the start – grey-iron heads with steel
bolts (α nearly equal) avoid most of this problem; an aluminium head would not.

### 6.4 R12 – slip resistance and shear of the bolt

The transverse load F_Q must be carried by **friction in the interface**, never by the bolt shank. The residual clamp load
in the worst case (lowest preload, full working load, after embedding):

  F_KRmin = F_Mzul/α_A − (1 − Φ_n)·F_Amax − F_Z

  S_G = F_KRmin·q_F·μ_T / F_Q ≥ 1.2 (static) … 1.8 (dynamic / alternating transverse load)

Code:
```python
def slip(P, g=None):
    g = g or thread_geometry(P)
    lf = load_factor(P, g)
    ez = embedding(P, g)
    t = tightening(P, g)
    FKRmin = t["FMzul"] / t["alpha_A"] - (1 - lf["Phi_n"]) * P["FA_max"] - ez["FZ"]
    S = FKRmin * P["qF"] * P["muT"] / P["FQ"] if P["FQ"] > 0 else float("inf")
    return {"FKRmin": FKRmin, "S_G": S, "opens": FKRmin <= 0}
```

**Hand check:** F_KRmin = 64 902/1.6 − (1 − 0.0979) × 12 000 − 2646 = 40 564 − 10 825 − 2646 = 27 093 N (program 27 092);
S_G = 27 092 × 1 × 0.15/3000 = 1.35 < 1.8 ✗.

Why slip is dangerous: under an alternating transverse load a slipping joint **self-loosens** – each micro-slip in the
thread lets the nut turn back a little (Junker test). After loosening the bolt fails in fatigue or the joint falls apart.
That is why S_G ≥ 1.8 is used for dynamic transverse loads, and why locking elements (adhesive, ribbed flange) do not
replace sufficient clamp load.

**Interface friction μ_T** (typical, dry, check VDI 2230 table A6 / EN 1090-2 for slip-resistant joints):

`python bolt.py ch56`
```
## 6.4 Slip: interface friction
  steel, machined, degreased             muT 0.15: S_G 1.35 static OK dynamic --
  steel, machined, oiled                 muT 0.10: S_G 0.90 static -- dynamic --
  steel, shot-blasted                    muT 0.40: S_G 3.61 static OK dynamic OK
  steel, blasted + zinc silicate         muT 0.35: S_G 3.16 static OK dynamic OK
  steel, primed / painted                muT 0.15: S_G 1.35 static OK dynamic --
  cast iron / steel dry                  muT 0.18: S_G 1.63 static OK dynamic --
  aluminium / steel dry                  muT 0.20: S_G 1.81 static OK dynamic OK
  with friction shim (diamond coated)    muT 0.50: S_G 4.52 static OK dynamic OK
```

Code:
```python
def slip_study(P):
    g = thread_geometry(P)
    rows = []
    for name, mu in MU_T.items():
        sl = slip(dict(P, muT=mu), g)
        rows.append({"surface": name, "muT": mu, "S_G": sl["S_G"], "static_ok": sl["S_G"] >= 1.2, "dynamic_ok": sl["S_G"] >= 1.8})
    return rows
```

The interface condition is a **manufacturing specification**, not a detail: an oiled interface (assembly oil, corrosion
protection) drops S_G from 1.35 to 0.90. Write it on the drawing: "interfaces dry, free of oil and paint" or "blasted
Sa 2½". Diamond-coated friction shims are the standard fix in drive trains where the bolt cannot be made larger.

**If the joint slips anyway:** the hole clearance is taken up and the shank is loaded in shear and bearing:

  τ_Q = F_Q / (π d²/4),  τ_B ≈ 0.6·R_m (check),  σ_L = F_Q/(d·t_min)

`python bolt.py ch56`
```
  bolt in shear after slip (shank d): tau 26.5 MPa, tau_B 624 -> S 23.5; bearing 12.5 MPa
  bolt in shear after slip (fitted bolt d+1): tau 22.6 MPa, tau_B 624 -> S 27.6; bearing 11.5 MPa
```

Code:
```python
def bolt_shear_if_slip(P, fit=False):
    g = thread_geometry(P)
    d = g["d"] + (1.0 if fit else 0.0)
    A = math.pi / 4 * d ** 2
    tau = P["FQ"] / A
    tauB = 0.6 * CLASSES[P["cls"]]["Rm"]
    return {"A": A, "tau": tau, "tau_B": tauB, "S": tauB / tau, "bearing": P["FQ"] / (d * P["lK"] / 2)}
```

Hand check: A = π/4 × 12² = 113.1 mm², τ = 3000/113.1 = 26.5 MPa ✓; bearing on half the clamp length (20 mm per plate):
3000/(12 × 20) = 12.5 MPa ✓. Statically the shank would survive easily – but **static shear strength is not the point**.
A slipping joint fails by loosening and fretting, not by shear. Fitted bolts (reamed holes, d + 1 mm shank) are used where
the position must be held exactly or the transverse load cannot be carried by friction (they then work as pins); they need
reamed holes in both parts together – expensive.

### 6.5 Multi-bolt joints – load per bolt

The single-bolt calculation needs the load **per bolt**. For a rigid flange on a bolt circle of diameter D_t with n
equally spaced bolts:

- axial force F and tilting moment M: F_A,i = F/n + M·y_i / Σy_j²,  y_i = (D_t/2)·cos(2πi/n)
- for a bolt circle Σy_j² = n·D_t²/8 (independent of the orientation, n ≥ 3)
- torque T and transverse force F_Q: F_Q,i = 2T/(n·D_t) + F_Q/n (all bolts share equally, rigid flange)

Code:
```python
def flange_bolt_loads(n=8, Dt=150.0, M_tilt=0.0, F_axial=0.0, T_torsion=0.0, F_trans=0.0):
    ys = [Dt / 2 * math.cos(2 * math.pi * i / n) for i in range(n)]
    sy2 = sum(y * y for y in ys)
    FA = [F_axial / n + M_tilt * 1000.0 * y / sy2 for y in ys]
    FQ = 2 * T_torsion * 1000.0 / (n * Dt) + F_trans / n
    return {"FA_max": max(FA), "FA_min": min(FA), "FQ": FQ, "sum_y2": sy2, "sum_y2_formula": n * Dt ** 2 / 8}
```

`python bolt.py ch56`
```
## 6.5 Multi-bolt joints
  8 bolts on 150 mm, F 40 kN, M 600 N m, T 300 N m, F_Q 4 kN: F_A,i 3000 .. 7000 N, F_Q,i 1000 N; sum y^2 22500 = n Dt^2/8 22500
```

Hand check: Σy² = 8 × 150²/8 = 22 500 mm² ✓; F_A,max = 40 000/8 + 600 000 × 75/22 500 = 5000 + 2000 = 7000 N ✓;
F_Q,i = 2 × 300 000/(8 × 150) + 4000/8 = 500 + 500 = 1000 N ✓.

**Compressor cylinder head – how many bolts?** Gas pressure 10 bar on a seal diameter of 110 mm:

  F = p·π·D²/4 = 1.0 MPa × π × 110²/4 = 9503 N, shared by n bolts (check that the gasket needs F_seal on top).

`python bolt.py ch56`
```
  cylinder head p 10 bar, seal D 110 -> gas force 9503 N:
    n  4: F_A   2376 N, pitch 117.8 mm, S_F 1.16, S_D 35.42, F_Mmax/F_Mzul 0.118 OK
    n  6: F_A   1584 N, pitch  78.5 mm, S_F 1.17, S_D 53.14, F_Mmax/F_Mzul 0.100 OK
    n  8: F_A   1188 N, pitch  58.9 mm, S_F 1.17, S_D 70.85, F_Mmax/F_Mzul 0.092 OK
    n 10: F_A    950 N, pitch  47.1 mm, S_F 1.17, S_D 88.56, F_Mmax/F_Mzul 0.086 OK
    n 12: F_A    792 N, pitch  39.3 mm, S_F 1.17, S_D 106.27, F_Mmax/F_Mzul 0.083 OK
```

Code:
```python
def n_bolts_for_head(p_bar=10.0, D_seal=110.0, Dt=150.0, F_seal_per_bolt=0.0, M_tilt=0.0, ns=(4, 6, 8, 10, 12), P=None):
    P = dict(P or DEFAULT)
    F = p_bar * 0.1 * math.pi / 4 * D_seal ** 2
    rows = []
    for n in ns:
        L = flange_bolt_loads(n, Dt, M_tilt, F, 0.0, 0.0)
        Q = dict(P, FA_max=L["FA_max"], FA_min=0.0, FQ=0.0, F_seal=F_seal_per_bolt)
        S = summary(Q)
        rows.append({"n": n, "FA": L["FA_max"], "S_F": S["ws"]["S_F"], "S_D": S["fat"]["S_D"], "util": S["pre"]["utilisation"],
                     "ok": S["ok"]["preload"] and S["ok"]["yield"] and S["ok"]["fatigue"], "pitch": math.pi * Dt / n})
    return {"F_gas": F, "rows": rows}
```

Strength alone would allow 4 × M12. The real criterion for the number of bolts is the **gasket**: the clamp pressure
between two bolts must stay above the gasket's minimum seating stress. Rule of thumb (check the gasket maker): bolt pitch
≤ 5 … 7 d for a metal/composite gasket on a stiff head → for M12 a pitch ≤ 60–84 mm → **n = 6 … 8** on D_t 150 mm.
F_seal (gasket force per bolt) must then be entered in the bolt calculation (R2: F_Kerf = max(F_KQ, F_KP)).

**Load distribution caution.** The formulas assume a rigid flange. Thin flanges bend: the bolts near the load carry more,
and the flange opens between bolts (prying, eccentric case of 5.3). For thin covers use FEA with contact or the VDI 2230
Part 2 multi-bolt procedure.

### 6.6 Safety summary and fixing the default joint

`python bolt.py ch56`
```
## 6.6 Safety summary of the default and fixing it
  preload F_Mmax/F_Mzul      0.83  (<= 1) OK
  yield S_F                  1.15  (>= 1.0) OK
  fatigue S_D                7.01  (>= 1.2) OK
  surface pressure S_p       0.70  (>= 1.0) NOT OK
  slip S_G                   1.35  (>= 1.8) NOT OK
  default M12 10.9                               util 0.825 S_F 1.15 S_D  7.01 S_p 0.70 S_G 1.35 M_A 107.9 N m fails
  + hardened washer                              util 0.854 S_F 1.16 S_D 13.57 S_p 2.97 S_G 1.30 M_A 119.9 N m fails
  + washer + torque with friction test (aA 1.4)  util 0.747 S_F 1.16 S_D 13.57 S_p 2.97 S_G 1.59 M_A 119.9 N m fails
  + washer + angle-controlled (aA 1.0)           util 0.534 S_F 1.16 S_D 13.57 S_p 2.97 S_G 2.51 M_A 119.9 N m ALL OK
  + washer + blasted interface muT 0.40          util 0.546 S_F 1.16 S_D 13.57 S_p 2.97 S_G 3.46 M_A 119.9 N m ALL OK
  M16 8.8, DA 44 (no washer)                     util 0.678 S_F 1.15 S_D 11.74 S_p 1.18 S_G 1.84 M_A 180.2 N m ALL OK
  8 instead of 6 bolts (FQ x 6/8) + washer       util 0.731 S_F 1.16 S_D 13.57 S_p 2.97 S_G 1.73 M_A 119.9 N m fails
```

Code:
```python
def fix_default_study(P=None):
    P = dict(P or DEFAULT)
    out = []

    def add(name, S, Q):
        out.append({"variant": name, "util": S["pre"]["utilisation"], "S_F": S["ws"]["S_F"], "S_D": S["fat"]["S_D"],
                    "S_p": S["sp"]["S_p"], "S_G": S["slip"]["S_G"], "MA": S["tight"]["MA"],
                    "all_ok": all(S["ok"].values()) if isinstance(S["ok"], dict) else False})
    add("default M12 10.9", summary(P), P)
    add("+ hardened washer", with_washer(P), P)
    Q = dict(P, tightening="torque-controlled with friction test on the part")
    add("+ washer + torque with friction test (aA 1.4)", with_washer(Q), Q)
    ...
```

How to read the study – each line answers one engineering question:

1. **Washer alone** cures the surface pressure (S_p 0.70 → 2.97) and even doubles S_D (longer clamp length, larger d_w →
   softer bolt relative to the plates, smaller Φ). But S_G drops slightly (1.35 → 1.30): one more interface means more
   embedding. The torque rises from 107.9 to 119.9 N m because the head friction radius D_Km = (d_w + d_h)/2 is larger –
   **the assembly instruction must change together with the washer**.
2. **Better torque control** (friction tested on the real part, α_A 1.4) raises S_G to 1.59 – still not 1.8.
3. **Angle-controlled tightening** (α_A ≈ 1.0) or a **blasted interface** (μ_T 0.40) solve slip – all checks pass.
4. **M16 8.8** passes everything without a washer, but needs a larger D_A (44 mm), larger holes and 180 N m.
5. **More bolts** (8 instead of 6 on the same flange) are not enough alone (S_G 1.73).

**Recommended fix for the compressor joint:** M12 10.9 + hardened washer ISO 7089 under head and nut + interfaces dry and
blasted, **or** angle-controlled tightening on the assembly line. Both keep the M12 size (no change of the casting). The
choice depends on the assembly equipment: a station with angle monitoring is standard for cylinder heads; a blasted
interface is cheaper for a few hundred units per year.

**Assembly specification derived from chapters 5–6** (goes on the drawing / work instruction):

| Item | Specification |
|---|---|
| Bolt | ISO 4014 M12 × 1.75 × 60 – 10.9 (l_K 40 + 2 washers + nut + 2 P overhang, check), thread lightly oiled (μ_G 0.10 … 0.16) |
| Washers | ISO 7089 – 12 – 300 HV under head and nut |
| Interfaces | dry, free of oil and paint (μ_T ≥ 0.15) – or blasted Sa 2½ (μ_T ≥ 0.40) |
| Tightening | torque 120 N m (washer) with calibrated tool, or snug + angle per tests; cross pattern, 2 stages (50 % / 100 %) |
| Check | 100 % torque/angle record; audit: residual torque or ultrasonic preload on samples |
| Re-use | bolts tightened into yield: do not re-use |


---

## 7. Manufacturing of bolts, assembly methods, tightening sequence, friction testing, self-loosening, inspection

Chapters 3–6 calculated *what preload the joint needs* and *what preload the bolt can carry*. This chapter is about the
shop floor: how the bolt is made (because that sets its strength, fatigue limit and friction), how the preload is really
put into the joint, how much it scatters, how the friction is measured, why joints come loose, and how a finished
joint is checked. All numbers come from `python bolt.py ch78` (the add-on functions of this chapter, merged into
`bolt.py`) and from the core report `python bolt.py examples` / `python bolt.py run`.

### 7.0 Where the preload comes from – one picture in words

```
  tightening torque M_A  ──►  thread friction (≈ 40 %) + head friction (≈ 45 %) + pitch (≈ 10–15 %)  ──►  preload F_M
                                  └──── only the pitch part stretches the bolt; friction is "lost" as heat ────┘
```

About 85–90 % of the tightening torque is spent on friction. A ±25 % change of friction therefore changes the preload by
almost ±25 % for the same torque. This single fact explains most of chapter 7: coatings and lubricants (7.1), the
tightening factor α_A of each method (7.2), the friction test (7.4) and why a joint loosens when friction disappears
under transverse slip (7.5).

### 7.1 Manufacturing of bolts

#### 7.1.1 The process chain

`BOLT_PROCESS_CHAIN` lists the standard route of a hexagon-head bolt of property class 8.8 … 12.9:

```python
BOLT_PROCESS_CHAIN = [
    ("wire rod", "cold-heading quality steel (8.8: C35/B-alloyed 20MnB4/C45; 10.9: 32CrB4/34Cr4/42CrMo4; 12.9: 42CrMo4/34CrNiMo6), spheroidise annealed, drawn to size"),
    ("cold heading", "multi-station header forms the head in 3-5 blows at 100-300 parts/min, no chips, unbroken fibre flow"),
    ("thread rolling (8.8 usual)", "flat dies or cylindrical dies; before heat treatment -> residual stress relieved by tempering"),
    ("quench and temper", "austenitise ~850-880 C, oil/polymer quench, temper >= 425 C (8.8) / >= 425 C (10.9) / >= 380 C (12.9) per ISO 898-1 (check)"),
    ("thread rolling after HT (option)", "rolling the hardened bolt keeps compressive residual stress at the thread root -> higher fatigue limit (sigma_ASG)"),
    ...
]
```

`python bolt.py ch78` prints it as the first block:

```
## 7.1 Bolt manufacturing chain
  wire rod                       cold-heading quality steel (8.8: C35/B-alloyed 20MnB4/C45; 10.9: 32CrB4/34Cr4/42CrMo4; 12.9: 42CrMo4/34CrNiMo6), spheroidise annealed, drawn to size
  cold heading                   multi-station header forms the head in 3-5 blows at 100-300 parts/min, no chips, unbroken fibre flow
  thread rolling (8.8 usual)     flat dies or cylindrical dies; before heat treatment -> residual stress relieved by tempering
  quench and temper              austenitise ~850-880 C, oil/polymer quench, temper >= 425 C (8.8) / >= 425 C (10.9) / >= 380 C (12.9) per ISO 898-1 (check)
  thread rolling after HT (option) rolling the hardened bolt keeps compressive residual stress at the thread root -> higher fatigue limit (sigma_ASG)
  coating                        zinc flake (no hydrogen), electroplated zinc / Zn-Ni + baking for >= 10.9 (hydrogen), phosphate + oil, black oxide
  friction control               top coat / wax / lubricant sets the friction class (target mu_tot 0.09-0.14, check)
  inspection                     hardness, tensile / wedge test (ISO 898-1), decarburisation, thread gauge, 100 % crack / sorting for safety parts
```

What each step means for the designer:

| Step | Physics | Consequence for the joint |
|---|---|---|
| Wire rod, spheroidise annealing | Carbides become globular → the steel can be cold formed without cracks | Boron steels (20MnB4, 32CrB4) are cheap and harden well up to about M20; above that Cr/Mo steels are needed for through-hardening |
| Cold heading | Plastic forming at room temperature, the fibre flow follows the head contour | No cut fibres at the head–shank fillet → better fatigue strength than a turned bolt; turned bolts only for prototypes / large sizes |
| Thread rolling | The thread is formed, not cut; material flows into the flanks | Smooth, cold-worked root with compressive residual stress; a cut thread has ~20–30 % lower fatigue strength (check) |
| Quench and temper | Martensite, then tempering to the class hardness (8.8 ≈ 22–32 HRC, 10.9 ≈ 32–39 HRC, 12.9 ≈ 39–44 HRC, check ISO 898-1) | Sets R_p0.2 and R_m used in chapter 6 (`CLASSES` in `bolt.py`) |
| Rolling after heat treatment | The compressive residual stress is not removed by tempering | Fatigue limit rises with low mean stress: σ_ASG = (2 − F_Sm/F_0.2)·σ_ASV (chapter 6, `fatigue()` with `"rolled": "after"`) |
| Coating | Corrosion protection; electroplating brings hydrogen into high-strength steel | Delayed fracture risk for ≥ 10.9 (7.6), friction depends on the coating (7.1.2) |

**Rolled before or after heat treatment.** The core program covers both (chapter 6). For the default joint the
fatigue safety is already high (S_D 7.01) because the stiff plates take most of the working load (Φ_n 0.098). Rolling
after heat treatment pays off for joints with a large load factor (soft or short clamped parts, gaskets in the clamp
path, eccentric loading) – typically connecting-rod bolts, cylinder-head bolts of engines with long thin bolts, wind-turbine
flange bolts. It costs more because rolling hardened material wears the dies quickly.

#### 7.1.2 Coatings, friction and the "same torque, different preload" problem

The preload produced by a torque is

```
F_M = M_A / (0.16·P + 0.58·d2·μ_G + D_Km/2·μ_K)          (chapter 5, torque_coeff())
```

so every coating, with its own friction range, gives a different preload for the same torque. `coating_effect()`
keeps the tightening torque of the default joint (set for μ = 0.10, M_A 107.9 N m) and changes only the coating:

```python
def coating_effect(P=None):
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000.0
    rows = []
    for name, c in COATINGS.items():
        lo, hi = c["mu"]
        Fmax = MA / torque_coeff(P, g, lo, lo)
        Fmin = MA / torque_coeff(P, g, hi, hi)
        rows.append({"coating": name, "mu": c["mu"], "Fmin": Fmin, "Fmax": Fmax, "ratio": Fmax / Fmin,
                     "over_FMzul_at_mu_lo": Fmax / FM_zul(P, g, lo)})
    return {"MA_Nm": MA / 1000.0, "rows": rows}
```

`python bolt.py ch78`:

```
## 7.1 Coatings: same torque M_A 107.9 N m (set for mu 0.10) -> preload range
  zinc flake + top coat (e.g. ISO 10683)   mu 0.09-0.14: F  48702 ..  70789 N (x1.45), F_max / F_Mzul(mu_lo) 1.08
  electroplated zinc + passivation         mu 0.12-0.18: F  38974 ..  55647 N (x1.43), F_max / F_Mzul(mu_lo) 0.88
  zinc-nickel electroplated                mu 0.09-0.15: F  45842 ..  70789 N (x1.54), F_max / F_Mzul(mu_lo) 1.08
  phosphate + oil                          mu 0.10-0.16: F  43298 ..  64902 N (x1.50), F_max / F_Mzul(mu_lo) 1.00
  black oxide + oil                        mu 0.12-0.18: F  38974 ..  55647 N (x1.43), F_max / F_Mzul(mu_lo) 0.88
  plain, dry                               mu 0.16-0.30: F  24370 ..  43298 N (x1.78), F_max / F_Mzul(mu_lo) 0.72
```

**Hand check (zinc flake, μ = 0.09).** torque coefficient = 0.16·1.75 + 0.58·10.863·0.09 + (16.6 + 13.5)/4·0.09
= 0.280 + 0.567 + 0.677 = 1.524 mm → F = 107 903 / 1.524 = 70 790 N ✓.

What the table teaches:

1. **A torque value is only valid together with its friction class.** The torque for phosphate + oil (μ 0.10) put on a
   zinc-flake bolt with μ 0.09 gives up to 1.08 × F_Mzul – the bolt is over-stressed at assembly (it may yield, which
   is not dangerous by itself, but the calculation of chapter 5 no longer holds).
2. **Dry, uncoated bolts are the worst case:** preload range ×1.78 and only 24 kN at the high-friction end – the
   joint of chapter 5 would lose most of its clamp load. Never leave the friction to chance on a calculated joint.
3. The ratio F_max/F_min of about 1.45 is the friction part of the tightening factor α_A (7.2).

**Friction classes** (`FRICTION_CLASSES`, VDI 2230 style, check):

| Class | μ range | Typical surface |
|---|---|---|
| A | 0.04–0.10 | metallic coatings with solid lubricant / wax, MoS2 paste |
| B | 0.08–0.16 | zinc flake with top coat, phosphate + oil, Zn-Ni with lubricant (the normal design class) |
| C | 0.14–0.24 | electroplated zinc without lubricant, black oxide dry |
| D | 0.20–0.35 | plain steel dry, austenitic stainless dry |
| E | 0.30–0.45 | stainless / aluminium dry, galling risk |

The default input uses μ_G, μ_K = 0.10 … 0.16 (class B). On the drawing write the coating **and** the friction
window, e.g. "zinc flake ISO 10683 flZnnc-480h-L, μ_tot 0.09–0.14 (ISO 16047)".

#### 7.1.3 Hydrogen embrittlement

Electroplating (acid pickling and the plating current) puts atomic hydrogen into the steel. In high-strength bolts
(hardness above about 39 HRC, i.e. 12.9 and the upper range of 10.9) the hydrogen collects at the thread root under the
high preload stress and causes **delayed fracture hours or days after assembly**, without any overload. Measures:

- prefer zinc flake (applied by dip-spin, no hydrogen) for ≥ 10.9;
- if electroplated: bake at about 200 °C for 4–8 h within 4 h after plating (ISO 4042, check);
- avoid 12.9 with electroplating altogether; use 10.9 with zinc flake or a non-coated 12.9 with oil in dry rooms;
- hydrogen can also enter from corrosion in service (cathodic protection, acid environment) – then lower strength
  classes are safer.

### 7.2 Assembly methods

The tightening factor α_A = F_Mmax/F_Mmin describes how well a method controls the preload. Chapter 5 used
α_A = 1.6 for a torque wrench (`TIGHTENING` table). Here the factor is **calculated** from the physics of each
method for the default joint M12 10.9.

#### 7.2.1 Torque control

Scatter has two sources: the friction range μ_min … μ_max and the tool (a click wrench or nut runner reaches about
±5 %, an impact wrench ±20 % and more, check).

```python
def torque_scatter(P=None, tool_tol=0.05):
    P = dict(P or DEFAULT)
    g = thread_geometry(P)
    MA = tightening(P, g)["MA"] * 1000.0
    Fmax = MA * (1 + tool_tol) / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    Fmin = MA * (1 - tool_tol) / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    return {"MA_Nm": MA / 1000.0, "Fmin": Fmin, "Fmax": Fmax, "alpha_A": Fmax / Fmin}
```

```
  torque control: M_A 107.9 N m, F 41134 .. 68147 N -> alpha_A 1.66
```

**Hand check.** Coefficient at μ 0.10: 0.280 + 0.630 + 0.7525 = 1.6626 mm; at μ 0.16: 0.280 + 1.008 + 1.204 = 2.492 mm.
F_max = 107 903·1.05/1.6626 = 68 147 N, F_min = 107 903·0.95/2.492 = 41 134 N, α_A = 1.66 ✓ – the table value 1.6 of
VDI 2230 is confirmed for class-B friction and a good tool.

Note that the friction alone gives 1.50 (`friction scatter 1.50` in the core report); the tool adds the rest.

#### 7.2.2 Torque-angle control (turn-of-nut)

After a small snug torque has closed all gaps, the nut is turned by an angle θ. Each turn of 360° advances the nut by
one pitch P; this displacement is shared by the bolt elongation and the plate compression:

```
θ/360 · P = F·(δ_S + δ_P)      →      F = θ·P / (360·(δ_S + δ_P)),      θ = 360·(δ_S + δ_P)·(F − F_snug)/P
```

Friction does not enter the angle step – only the snug preload (reached by torque) still depends on friction.

```python
def angle_for_preload(P, F_target, F_snug):
    g = thread_geometry(P)
    d = bolt_compliance(P, g)["deltaS"] + plate_compliance(P, g)["deltaP"]
    return 360.0 * d * (F_target - F_snug) / g["P"]

def angle_control(P=None, snug_frac=0.15, angle_tol_deg=3.0):
    ...
    Ftar = Fz / 1.1
    Msnug = snug_frac * Fz * torque_coeff(P, g, mu_m, mu_m)
    Fs_lo = Msnug / torque_coeff(P, g, P["muG_max"], P["muK_max"])
    Fs_hi = Msnug / torque_coeff(P, g, P["muG_min"], P["muK_min"])
    th = angle_for_preload(P, Ftar, snug_frac * Fz)
    k = g["P"] / (360.0 * d)                         # N per degree
    Fmin = Fs_lo + k * (th - angle_tol_deg)
    Fmax = Fs_hi + k * (th + angle_tol_deg)
```

```
  torque-angle: snug 20.2 N m, angle 36.4 deg for 59002 N (1354 N/deg), F 53320 .. 65493 N -> alpha_A 1.23
```

**Hand check.** δ_S + δ_P = 2.888·10⁻⁶ + 0.703·10⁻⁶ = 3.591·10⁻⁶ mm/N (core report, R3).
Stiffness per degree = 1.75/(360·3.591·10⁻⁶) = 1354 N/° ✓. Target F_Mzul/1.1 = 64 902/1.1 = 59 002 N, snug
0.15·64 902 = 9 735 N → θ = (59 002 − 9 735)/1354 = 36.4° ✓.

Practical rules:

- the angle method in the **elastic** range needs a stiff joint and accurate angle measurement: here 1° ≈ 1.35 kN,
  so ±3° gives ±4 kN (±7 %). For short, stiff joints (l_K/d < 2) the angle becomes small and the method loses
  accuracy;
- most production angle methods tighten **into the yield range** of the bolt (θ larger than the elastic value): the
  preload then hardly depends on the angle any more (flat part of the force–elongation curve) and α_A → 1.0–1.1;
- the snug torque must close the gaps, but be low enough that its friction scatter does not matter: here the snug
  torque of 20.2 N m (set for 15 % of F_Mzul at mean friction 0.13) gives F_snug 8.1–12.2 kN depending on friction –
  this ±2 kN plus the ±3° angle tolerance (±4 kN) make up the whole scatter of α_A 1.23.

#### 7.2.3 Yield-point (gradient) control

The nut runner measures torque and angle and stops when the gradient dM/dθ drops (start of yielding). The preload is then
the yield preload of the bolt under tension + torsion, i.e. F_Mzul with ν = 1. It still depends on the thread friction
through the torsion share, but no longer on the head friction and the tool:

```python
def yield_control(P=None):
    P = dict(P or DEFAULT)
    Q = dict(P, nu=1.0)
    g = thread_geometry(Q)
    Fhi = FM_zul(Q, g, P["muG_min"])
    Flo = FM_zul(Q, g, P["muG_max"])
    return {"Fmin": Flo, "Fmax": Fhi, "alpha_A": Fhi / Flo}
```

```
  yield control: F 66618 .. 72114 N -> alpha_A 1.08
```

**Hand check.** F_Mzul(ν 0.9, μ_G 0.10) = 64 902 N (core report) → ν = 1: 64 902/0.9 = 72 113 N ✓.

Yield-controlled bolts use the full strength of the bolt (here 66.6 kN minimum instead of 41.1 kN with torque control,
+62 %). They are standard for engine cylinder heads, connecting rods and wind-turbine flanges. Conditions: the bolt
must have a ductile, reduced shank or enough free thread length so that yielding happens in a defined place; the joint
must tolerate the higher preload (surface pressure! – chapter 6); the bolt must not be re-used without checking
(7.6.4).

#### 7.2.4 Ultrasonic elongation measurement

An ultrasonic probe on the bolt head measures the time of flight of a sound pulse to the bolt end and back. The time
changes with the elongation ΔL = F·δ_S **and** with the stress itself (acousto-elastic effect, the sound speed falls with
stress). The add-on uses a simple model with an acousto-elastic factor K ≈ 2 (check – every bolt type is calibrated
on a test rig):

```
ΔL = F·δ_S,       Δt = 2·L_eff/c_L · σ/E · (1 + K)
```

```
  ultrasonic: F 59002 N -> elongation 170.4 um (2.89 um/kN), L_eff 50.8 mm, time-of-flight change 176.4 ns
```

**Hand check.** ΔL = 59 002·2.888·10⁻⁶ = 0.1704 mm ✓. The sensitivity is only 2.9 µm per kN – the instrument must
resolve about 1 ns. Ultrasonic control reaches α_A ≈ 1.1–1.2 (check) independent of friction; it is used for critical
joints, for audits of finished joints and for calibrating torque values on the real part.

#### 7.2.5 Hydraulic tensioning and heating

**Tensioner.** A hydraulic cylinder pulls the bolt end; the nut is run down by hand; the pressure is released. Part of
the force is lost when the load moves from the tool to the nut (thread and nut deformation). The load transfer factor
LTF ≈ 1 + d/l_K (rule of thumb, check with the tool maker):

```python
    LTF = 1 + 1.0 * g["d"] / P["lK"]
    F_tool = LTF * F_residual
```

```
  hydraulic tensioner: LTF 1.30 -> tool force 76703 N, sigma 910 MPa (OK)
```

The bolt sees pure tension during tensioning (no torsion), so 0.9 R_p0.2 can be used fully; several bolts can be
tensioned together (uniform flange closure). Used for large bolts (M30 and up), wind-turbine and pressure-vessel flanges.
For this short M12 joint the LTF of 1.30 is large – tensioning suits long bolts.

**Heating.** The bolt is heated, the nut run down, the bolt cools and shrinks:

```
ΔT = F·(δ_S + δ_P) / (α_th · l_K)
```

```
  heat tightening: elongation 211.8 um -> dT 461 K
```

461 K is impossible for a quenched-and-tempered bolt (tempering temperature ≈ 425 °C!). Heat tightening only works
for long bolts (l_K ≫ 10 d: turbine casings, press tie rods) – a useful plausibility check from one formula.

#### 7.2.6 Comparison: what the method does to the joint

`method_comparison()` takes the preload range of each method and recomputes the slip safety of the default joint with
the **minimum** preload of that method:

```python
    def SG(Fmin):
        FKR = Fmin - (1 - lf["Phi_n"]) * P["FA_max"] - ez["FZ"]
        return FKR * P["qF"] * P["muT"] / P["FQ"]
```

```
## 7.2 Method comparison: preload range and slip safety (required 1.8)
  torque control (tool +/-5 %)     F  41134 ..  68147 N, alpha_A 1.66, S_G 1.38 NOT OK
  torque-angle control (elastic)   F  53320 ..  65493 N, alpha_A 1.23, S_G 1.99 OK
  yield-point control              F  66618 ..  72114 N, alpha_A 1.08, S_G 2.66 OK
```

**Hand check (torque control).** F_KR = 41 134 − (1 − 0.0979)·12 000 − 2 646 = 27 663 N → S_G = 27 663·0.15/3 000 = 1.38 ✓
(the core report gives 1.35 because it uses F_Mzul/α_A = 64 902/1.6 = 40 564 N).

**Design result.** The slip failure of the default joint (chapter 6, S_G 1.35) is not solved by a bigger bolt only –
it is solved by **a better assembly method**: torque-angle control already gives S_G 1.99 with the same M12 10.9. The
surface-pressure failure (S_p 0.70) remains and is solved by a hardened washer or a flange-head bolt (chapter 6);
with yield control the surface pressure becomes even higher, so the washer is needed in any case.

| Method | α_A (calculated / typical) | Equipment | Typical use |
|---|---|---|---|
| Impact wrench | 2.5–4 | cheap | steel construction (non-calculated), assembly aid only |
| Torque wrench / nut runner | 1.66 / 1.4–1.8 | click wrench, EC nut runner | general machinery |
| Torque with friction test on the part | – / 1.2–1.4 | test rig + torque | series parts with known friction |
| Torque-angle, elastic | 1.23 / 1.2–1.4 | angle-measuring nut runner | stiff joints, flanges |
| Torque-angle / yield into plastic range | 1.08 / 1.0–1.1 | EC nut runner with gradient control | engines, conrods, safety parts |
| Ultrasonic | – / 1.1–1.2 | ultrasonic instrument, calibrated bolts | critical joints, audits |
| Hydraulic tensioner | – / 1.1–1.3 | tensioning cylinders | large bolts, flanges |

### 7.3 Tightening sequence and elastic interaction

When a flange with many bolts is tightened, each bolt compresses the flange locally. Tightening bolt j compresses the
flange also around its neighbours – their plates spring back a little and they **lose part of their preload**
("elastic interaction", "cross-talk"). The add-on uses the simplest linear model: tightening bolt j by ΔF_j reduces bolt
i by c_ij·ΔF_j, with c = 0.15 for the two neighbours and 0.05 for the others (illustrative values – real coefficients
come from FEA or from a test with instrumented bolts, check):

```python
    STAR = {4: [0, 2, 1, 3], 6: [0, 3, 1, 4, 2, 5], 8: [0, 4, 2, 6, 1, 5, 3, 7], 12: [...]}
    seq = STAR.get(n_bolts, list(range(n_bolts))) if order == "cross" else list(range(n_bolts))
    F = [0.0] * n_bolts
    for _ in range(passes):
        for j in seq:
            dF = F_target - F[j]
            F[j] = F_target
            for i in range(n_bolts):
                if i == j:
                    continue
                near = (abs(i - j) % n_bolts) in (1, n_bolts - 1)
                F[i] -= (c_near if near else c_far) * dF
```

```
## 7.3 Tightening sequence, 8-bolt flange, elastic interaction c_near 0.15 / c_far 0.05, target 50 kN
  round 1 pass(es): seq 1-2-3-4-5-6-7-8 -> F  22.5 ..  50.0 kN (max/min 2.22)
  round 2 pass(es): seq 1-2-3-4-5-6-7-8 -> F  39.8 ..  50.0 kN (max/min 1.26)
  round 3 pass(es): seq 1-2-3-4-5-6-7-8 -> F  46.4 ..  50.0 kN (max/min 1.08)
  cross 1 pass(es): seq 1-5-3-7-2-6-4-8 -> F  22.5 ..  50.0 kN (max/min 2.22)
  cross 2 pass(es): seq 1-5-3-7-2-6-4-8 -> F  40.1 ..  50.0 kN (max/min 1.25)
  cross 3 pass(es): seq 1-5-3-7-2-6-4-8 -> F  46.8 ..  50.0 kN (max/min 1.07)
```

What this simple model shows – and what it does not:

1. **One pass is never enough.** After one pass the first bolt has only 22.5 kN of the 50 kN (−55 %). Each extra pass
   reduces the scatter roughly by the factor of the interaction; three passes bring all bolts within 7–8 %.
2. **In a perfectly elastic, already-closed flange the order hardly matters** (1.25 vs 1.26 after two passes) – the
   linear model is symmetric. The star (cross) pattern matters for a different reason that this model does not contain:
   the flange is not flat at the start; tightening in a star pattern closes the gap evenly and keeps the gasket from
   being squeezed to one side. For gasketed flanges the standard procedure (e.g. ASME PCC-1 style, check) is:
   snug all bolts in star pattern → 30 % → 60 % → 100 % in star pattern → one or two check passes round the circle.
3. Alternative: tighten all bolts at the same time (multi-spindle nut runner, several hydraulic tensioners) – no
   interaction scatter at all; standard in engine and gearbox assembly lines.

### 7.4 Friction testing (ISO 16047)

Calculated torques are only as good as the friction values. ISO 16047 defines a test rig: the bolt is tightened through
a load cell (preload F) on a thread-torque sensor (M_G) and a total-torque sensor (M_A). From one reading:

```
μ_G   = (M_G/F − 0.16·P) / (0.58·d2)                 thread friction
μ_K   = (M_A − M_G) / (F·D_Km/2)                     head friction
μ_tot = (M_A/F − 0.16·P) / (0.58·d2 + D_Km/2)        total friction (one number for the drawing)
```

```python
def iso16047(P, MA_Nm, MG_Nm, F):
    g = thread_geometry(P)
    MA, MG = MA_Nm * 1000.0, MG_Nm * 1000.0
    DKm = 0.5 * (g["dw"] + g["dh"])
    muG = (MG / F - 0.16 * g["P"]) / (0.58 * g["d2"])
    muK = (MA - MG) / (F * DKm / 2)
    mutot = (MA / F - 0.16 * g["P"]) / (0.58 * g["d2"] + DKm / 2)
    return {"muG": muG, "muK": muK, "mutot": mutot}
```

To check the evaluation, `synthetic_test_points()` generates readings from known friction (μ_G 0.12, μ_K 0.11):

```
## 7.4 Friction test evaluation (ISO 16047), synthetic readings from mu_G 0.12 / mu_K 0.11
  M_A  37.28 N m, M_G  20.72 N m, F  20000 N -> mu_G 0.1200, mu_K 0.1100, mu_tot 0.1146
  M_A  65.23 N m, M_G  36.26 N m, F  35000 N -> mu_G 0.1200, mu_K 0.1100, mu_tot 0.1146
  M_A  93.19 N m, M_G  51.80 N m, F  50000 N -> mu_G 0.1200, mu_K 0.1100, mu_tot 0.1146
```

**Hand check (first point).** μ_tot = (37 280/20 000 − 0.280)/(0.58·10.863 + 15.05/2) = (1.864 − 0.280)/(6.300 + 7.525)
= 1.584/13.825 = 0.1146 ✓. μ_tot is a weighted mean of μ_G and μ_K – here between 0.11 and 0.12.

Test practice (check ISO 16047):

- evaluate between 50 % and 75 % of the yield preload (the friction is not constant at low load);
- test at least 10 bolts per lot, report mean and range → μ_min, μ_max for chapter 5;
- test with the **real counter-part** (nut, tapped material, washer, bearing surface roughness) – the head friction on
  aluminium or on a painted surface is very different from the standard steel test washer;
- repeat after a coating supplier change, after a lubricant change and on the first-article inspection.

### 7.5 Self-loosening

#### 7.5.1 Why a tight bolt turns loose

At rest, loosening needs a torque because thread friction and head friction resist; the pitch helps:

```
M_loosen = F·(−0.16·P + 0.58·d2·μ_G + D_Km/2·μ_K)
```

```python
def loosening_torque(P=None, F=None):
    ...
    ML = F * (-0.16 * g["P"] + 0.58 * g["d2"] * P["muG_min"] + DKm / 2 * P["muK_min"]) / 1000.0
    Mpitch = F * 0.16 * g["P"] / 1000.0
```

```
## 7.5 Self-loosening
  at F_Mzul 64902 N: tightening 107.9 N m, loosening torque 71.6 N m, inner loosening torque from the pitch 18.2 N m
```

**Hand check.** F·(−0.280 + 0.630 + 0.7525) = 64 902·1.1026 = 71 560 N mm = 71.6 N m ✓; pitch part 64 902·0.280 =
18.2 N m ✓.

The 18.2 N m "inner loosening torque" is always there – it is the preload trying to unscrew the nut along the helix.
At rest friction (53.4 N m more) holds it. **When the joint slips transversely**, the bearing surfaces and the thread
flanks slide sideways; in the sliding direction the friction is used up, and in the circumferential direction it
practically vanishes (a sliding contact offers no resistance to a second, small motion). The inner loosening torque
then turns the nut back a little in every slip cycle. This is what Junker showed in 1969 with his transverse
vibration test (DIN 65151 / ISO 16130): joints loosen by rotation within a few hundred cycles **as soon as transverse
slip occurs** – not because of vibration as such.

#### 7.5.2 The real criterion: no transverse slip

```python
def slip_limit_transverse(P=None):
    s = slip(P)
    FQ_lim = s["FKRmin"] * P["qF"] * P["muT"]
    return {"FKRmin": s["FKRmin"], "FQ_slip": FQ_lim, "FQ": P["FQ"], "margin": FQ_lim / P["FQ"]}
```

```
  transverse slip starts at 4064 N (F_KRmin 27092 N x mu_T); applied 3000 N -> margin 1.35
```

The default joint has only 35 % margin against slip (S_G 1.35 < 1.8 required for dynamic transverse load). With
alternating transverse load and a low-friction bearing face it would be at risk of self-loosening. The correct remedy is
the one from 7.2.6 (higher, better controlled preload), not a locking element.

#### 7.5.3 Locking elements – what works

```
  - high preload + enough clamp length (l_K/d > 3..5)              works - the primary measure
  - wedge-locking washer pair (cam angle > thread lead angle)      works against rotation (loosening); not against loss of preload by embedding
  - anaerobic adhesive (medium / high strength)                    works; also seals; temperature limit ~150 C; breakaway torque test
  - prevailing-torque nut (all-metal / nylon insert)               loss-preventing only - loosens partly, stays on the bolt
  - ribbed flange bolts / nuts                                     works on steel parts of moderate hardness; damages the surface
  - spring washer (DIN 127), toothed / serrated lock washer, plain lock nut INEFFECTIVE - flattened at assembly, withdrawn standards
  - split pin / safety wire                                        loss-preventing only (prevents falling off)
```

Why the spring washer does not work: its spring force (a few hundred N) is flattened completely at a preload of tens
of kN – it adds an extra, soft interface (more embedding, chapter 4) and no locking. The DIN 127 / DIN 6798 standards
were withdrawn for this reason. Long clamp lengths help because a flexible bolt follows a small transverse slip by
bending instead of sliding in the thread (rule l_K/d ≥ 3–5, check); the default joint has l_K/d = 40/12 = 3.3.

### 7.6 Inspection, corrosion, re-use

#### 7.6.1 Torque audit of a finished joint

After assembly the preload cannot be seen. Audit methods, from simple to exact:

| Method | What is measured | Meaning |
|---|---|---|
| Marking (paint line across nut and part) | Visual rotation | Detects loosening in service, not the preload |
| Breakaway torque (loosening direction) | Torque to start turning back | Depends on static friction – rough indication only |
| Tightening-on torque ("Weiterdrehmoment") | Torque at which the nut starts to turn further in the tightening direction | Close to the original torque if the joint was tightened correctly |
| Ultrasonic (7.2.4) | Elongation → preload | Real preload, ±10 % after calibration |
| Instrumented bolt / load washer | Preload directly | Test rigs, prototypes |

```python
def torque_audit(P=None, k_breakaway=(1.05, 1.30), k_continue=(0.95, 1.15)):
    MA = tightening(P)["MA"]
    return {"MA": MA, "breakaway": (k_breakaway[0] * MA, k_breakaway[1] * MA),
            "continue": (k_continue[0] * MA, k_continue[1] * MA)}
```

```
## 7.6 Inspection and corrosion
  torque audit for M_A 107.9 N m: breakaway 113.3 .. 140.3 N m, tightening-on 102.5 .. 124.1 N m
```

The windows are typical shop values (check – each company calibrates them on the part with ultrasonic measurements). A
tightening-on torque far below the window means the joint was not tightened or has lost preload; far above it means a
seized thread or wrong friction.

#### 7.6.2 Galvanic corrosion

Two metals in contact with an electrolyte (condensate, salt spray) form a cell; the less noble metal (the anode)
corrodes. The rate is worst when the anode is **small** and the cathode is **large** – which is exactly the case of a
small bolt in a large plate of a more noble metal.

```python
def galvanic_risk(bolt, part, area_ratio_bolt_to_part=0.05):
    dU = GALVANIC[part] - GALVANIC[bolt]
    anode = bolt if dU > 0 else part
    ...
    risk = "low" if abs(dU) < 0.15 else ("medium" if abs(dU) < 0.30 else "high")
```

```
  bolt zinc-flake coated steel          in aluminium alloy                  dU +0.15 V, anode zinc-flake coated steel, risk low
  bolt stainless steel A2/A4 (passive)  in aluminium alloy                  dU -0.72 V, anode aluminium alloy, risk high
  bolt carbon steel                     in cast iron                        dU +0.03 V, anode carbon steel, risk low
  bolt carbon steel                     in stainless steel A2/A4 (passive)  dU +0.57 V, anode carbon steel, risk high (small anode - worst case)
```

- Stainless bolts in aluminium: the aluminium (large) corrodes around the hole – acceptable in dry rooms, otherwise use
  insulating washers / sealant or zinc-flake steel bolts.
- Carbon-steel bolts in stainless parts: the bolt is the small anode and corrodes fast – always use stainless bolts in
  stainless parts.
- Potentials are typical sea-water values (check); in a dry, heated factory the risk is small.

#### 7.6.3 Hydrogen and coatings – the inspection side

For ≥ 10.9 electroplated parts request the baking certificate. For safety parts a sustained-load test (bolts held at
high preload for 48 h, check ISO 15330) detects hydrogen-embrittled lots before they reach assembly.

#### 7.6.4 Re-use of bolts

```
  re-use: torque method -> elastically tightened: re-use possible if thread and coating undamaged (friction changes after first use - re-check)
  re-use: yield method  -> plastically tightened: re-use only if the elongation is checked (e.g. < 0.3 %) and the supplier allows it; usually replace
```

A yield-tightened bolt has been stretched plastically. Each re-tightening adds plastic strain and uses up ductility.
Engine makers specify "replace" for cylinder-head and conrod bolts, or a maximum length / number of uses. Also elastic
bolts change their friction after the first tightening (coating worn) – a second tightening with the same torque gives
a different preload.

### 7.7 Typical failures and their causes

```
## 7.7 Typical failures
  - fatigue fracture at the first engaged thread (nut side) | cause: low preload -> high F_SA share, bending, rough thread root | remedy: higher / controlled preload, longer clamp length, rolled after HT, thread run-out; check sigma_a
  - fracture under the head / at the shank transition | cause: bending from inclined bearing faces, small head fillet | remedy: flat bearing faces, larger fillet, washers, check perpendicularity
  - thread stripping (nut or tapped hole) | cause: engagement too short, soft tapped material, oversize tapping | remedy: m_eff >= 1.0-1.5 d steel / 2 d aluminium (check), thread inserts, nut class >= bolt class
  - self-loosening (rotation) | cause: transverse slip from too low residual clamp load | remedy: raise preload, more bolts, larger mu_T, pins for transverse loads, wedge-locking washers
  - loss of preload without rotation | cause: embedding, creep of soft parts / gaskets / coatings, temperature | remedy: fewer interfaces, hard washers, re-tighten gaskets, account for F_Z and temperature
  - delayed (hydrogen) fracture hours after assembly | cause: electroplated >= 10.9 not baked, hydrogen from corrosion | remedy: zinc flake, baking, lower hardness, avoid 12.9 electroplated
  - corrosion / seizing | cause: galvanic pairing, crevice, no coating | remedy: coating, isolation washers, same-metal pairing, anti-seize paste (changes friction!)
  - overstressed at assembly (yield / torsion fracture) | cause: too high torque for the actual friction, impact wrench | remedy: friction class control, torque from F_Mzul at mu_min, calibrated tools
```

How to read a fractured bolt:

- **Fatigue fracture** has a flat, smooth zone with beach marks starting at the thread root (usually the first loaded
  thread at the nut, where the load flow concentrates) and a small rough final-fracture zone. A small final zone means a
  low nominal stress – the cause is almost always **too low preload** (the bolt then sees the full working load
  amplitude), not a too weak bolt.
- **Overload fracture** is rough, fibrous, with a cup-and-cone or 45° shear lip; torsion overload at assembly shows
  a spiral surface.
- **Hydrogen fracture** is brittle, intergranular, at the first engaged thread or under the head, without plastic
  deformation, appearing hours after assembly.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification of the program

| Check | Where | Result |
|---|---|---|
| Stress area A_S of M12 = 84.3 mm², M20 = 245 mm² (ISO 898-1) | `python bolt.py selftest` | 84.267 / 245 ✓ |
| F_Mzul: σ_red with full torsion (plastic W_P = πd0³/12) = ν·R_p0.2 | selftest | ✓ |
| M12 10.9, μ 0.12: F_Mzul 63.3 kN, M_A 122.8 N m – order of the VDI 2230 table A1 values | selftest | ✓ |
| Plate compliance continuous between cone + sleeve and full cones at D_A = D_A,Gr; equals the sleeve formula at D_A = d_w | selftest | ✓ |
| 0 < Φ_n < Φ_K < 1; bolt compliance = sum of its parts; residual clamp load identity; torque coefficient; σ_ASV formula | selftest | ✓ |
| Angle method: 1354 N/° and 36.4° by hand | 7.2.2 | ✓ |
| ISO 16047 evaluation returns the friction used to generate the readings | 7.4 | μ_G 0.1200, μ_K 0.1100 ✓ |
| Loosening torque and pitch torque by hand | 7.5.1 | 71.6 / 18.2 N m ✓ |

Limits of the program (always state them in a design report):

1. Concentric clamping and loading only – no eccentric load, no bending of the bolt, no prying (VDI 2230 sections 5.3.2,
   5.5 with s_sym, a; check for flanges with the load outside the bolt circle).
2. The load introduction factor n is an input (0.5 default); VDI 2230 Part 1 gives it from the joint geometry (load
   introduction points). For a load introduced near the interface n ≈ 0.3, near the head n ≈ 0.7.
3. No temperature change (ΔF_Vth) and no creep of gaskets / plastics in the clamp path.
4. Minimum length of engagement (stripping) is not calculated; use m_eff ≥ 0.8 d with a standard nut of the matching
   class, tapped steel ≥ 1.0–1.25 d, grey iron ≥ 1.25 d, aluminium ≥ 2 d (check VDI 2230 section 5.5.5).
5. `select_size()` keeps D_A, l_K and the shank length of the input – it answers "which bolt fits *this* joint", not
   "which joint would be best".

### 8.2 Complete worked example – compressor cylinder head

**Task.** The V-compressor of this project (M2: bore 70 mm recommended in chapter 12 of M2, 8 bar discharge) has an
aluminium or cast-iron cylinder head held by 4 bolts screwed into the grey-iron cylinder. Design the bolts.

**Step 1 – loads.** The head is lifted by the pressure acting on the area inside the gasket centre line. Design pressure
= safety-valve setting 10 bar (the operating pressure is 8 bar; the relief valve may let the pressure rise to its set
value). Gasket mean diameter 85 mm:

```python
def gas_load(p_bar=10.0, D_gasket=85.0, n_bolts=4):
    A = math.pi / 4 * D_gasket ** 2
    F = p_bar * 0.1 * A
    return {"A_mm2": A, "F_total": F, "F_per_bolt": F / n_bolts}
```

```
## 8.2 Worked example: compressor cylinder head
  gas: 10 bar on D 85 mm -> A 5675 mm2, F 5675 N, per bolt (4) 1419 N
```

The load is **dynamic**: 0 … 1419 N per bolt in every compression cycle (1450 rpm → 2.1·10⁹ cycles in 25 000 h) –
so `FA_min = 0`, `FA_max = 1419`.

**Step 2 – sealing clamp load.** A metal-reinforced gasket ring 80/90 mm needs a minimum residual surface pressure of
about 20 MPa to stay tight (check the gasket maker, EN 1591 style):

```
  gasket: A 1335 mm2 x q_min 20 MPa -> 26704 N, per bolt 6676 N
```

→ `F_seal = 6676` N per bolt. A transverse load from thermal expansion of the head of about 300 N per bolt is assumed
(`FQ = 300`, μ_T 0.15). Design choice: the gasket sits in a groove so that the head lands **metal-to-metal** on the
cylinder after compression – the gasket is not in the clamp path (otherwise its compliance would have to be added to δ_P
and its creep to the embedding).

**Step 3 – try sizes.** `head_example_steps()` runs the full VDI check for candidate bolts:

```
  M8   10.9 head AlMgSi1 F31  util 0.51, S_p 0.53, S_G 7.7, S_D 18.59, M_A 29.5 N m -> fails: pressure
  M8   10.9 head EN-GJS-400   util 0.53, S_p 0.89, S_G 7.5, S_D 37.16, M_A 29.5 N m -> fails: pressure
  M10  10.9 head EN-GJS-400   util 0.36, S_p 0.96, S_G 12.4, S_D 53.89, M_A 58.1 N m -> fails: pressure
  M10  8.8  head AlMgSi1 F31  util 0.50, S_p 0.84, S_G 8.1, S_D 27.10, M_A 39.5 N m -> fails: pressure
  M10  8.8  head EN-GJS-400   util 0.52, S_p 1.41, S_G 7.9, S_D 53.89, M_A 39.5 N m -> all OK
```

Reading the table:

- The **loads are small** – slip (S_G ≈ 8) and fatigue (S_D 18–54) are never critical. Every candidate is limited by
  **surface pressure under the head**, because the assembly preload F_Mzul (set by the bolt, not by the load) presses
  on the small annulus between d_w and d_h.
- **Higher strength makes it worse:** M10 10.9 fails (S_p 0.96) where M10 8.8 passes (S_p 1.41) – the 10.9 bolt is
  tightened to a 47 % higher preload. This is the opposite of the usual reflex "take a stronger bolt".
- An **aluminium head** fails with every bolt (p_G 360 MPa): it needs a hardened washer (d_w ≈ 2 d) or a flange-head
  bolt. The design below uses a ductile-iron head (EN-GJS-400, p_G 600 MPa); for an aluminium head add hardened
  washers 10.5 × 20 × 2 (check).

**Step 4 – final design and full report.** Saved as `examples/bolt_example.json`:

```json
{
  "name": "Compressor cylinder head: 4 bolts M10 8.8 into the cast-iron cylinder (worked example chapter 8)",
  "thread": "M10", "cls": "8.8", "joint": "ESV",
  "lK": 22.0, "ls": 12.0, "DA": 26.0,
  "part_material": "EN-GJS-400", "nut_side_material": "EN-GJL-250",
  "FA_max": 1419.0, "FA_min": 0.0, "FQ": 300.0, "qF": 1, "muT": 0.15, "F_seal": 6676.0,
  "tightening": "torque wrench / precision nut runner",
  "muG_min": 0.09, "muG_max": 0.14, "muK_min": 0.09, "muK_max": 0.14,
  "n_interfaces": 1, "rolled": "before"
}
```

`python bolt.py run --in examples/bolt_example.json --out example`:

```
# Bolted joint report (VDI 2230 style, simplified) - Compressor cylinder head: 4 bolts M10 8.8 into the cast-iron cylinder (worked example chapter 8)

M10 8.8, ESV, clamp length 22.0 mm (shank 12.0, free thread 10.0), DA 26.0 mm, parts EN-GJS-400 / EN-GJL-250, torque wrench / precision nut runner

## R0 thread geometry
- d 10.0, P 1.50, d2 9.026, d3 8.160, A_S 57.99 mm2, A_d3 52.29 mm2; head bearing dw 14.6, hole dh 11.0 mm

## R3 compliances and load factor
- bolt: head 3.11e-07, shank 7.45e-07, free thread 9.33e-07, engaged thread 4.66e-07, nut / tapped hole 3.82e-07 -> delta_S 2.837e-06 mm/N (c_S 352474 N/mm)
- plates: tan(phi) 0.4647 (phi 24.92 deg), D_A,Gr 35.05 mm -> cone + sleeve model, delta_P 5.192e-07 mm/N (c_P 1926075 N/mm)
- load factor Phi_K 0.1547, n 0.50 -> Phi_n 0.0773

## R2 / R4 / R5 clamp load, embedding, required preload
- required clamp load: slip 2000 N, sealing 6676 N -> F_Kerf 6676 N
- embedding f_Z 7.0 um -> F_Z 2086 N
- F_Mmin = F_Kerf + (1 - Phi_n) F_Amax + F_Z = 10071 N; F_Mmax = alpha_A 1.60 x F_Mmin = 16113 N

## R7 / R13 assembly preload and tightening torque
- F_Mzul (nu 0.90, mu_G 0.09) 30707 N -> utilisation F_Mmax / F_Mzul 0.525 OK
- tightening torque M_A 39.5 N m (mu_G 0.09, mu_K 0.09); at high friction (0.14 / 0.14) the same torque gives 21149 N (scatter 1.45)

## R8 - R12 stresses and safeties
- working: F_SA 110 N, F_Smax 30817 N, sigma_z 531 MPa, tau 174 MPa, sigma_red 552 MPa (k_tau 0.5) -> S_F 1.16 OK
- fatigue: sigma_a 0.9 MPa, sigma_AS 51.0 MPa (rolled before heat treatment) -> S_D 53.89 OK
- surface pressure: A_p 72.4 mm2, assembly 424 MPa, working 426 MPa, p_G 600 MPa -> S_p 1.41 OK
- slip: F_KRmin 15797 N -> S_G 7.90 (required 1.8) OK

## Size selection
- smallest thread / class of the table that passes all checks: M6 10.9
written: report.md, assembly.csv -> example
```

**Hand checks.**

- Gas force: π/4·85² = 5 674.5 mm² × 1.0 MPa = 5 675 N, /4 = 1 419 N ✓.
- Required preload R5: 6 676 + (1 − 0.0773)·1 419 + 2 086 = 6 676 + 1 309 + 2 086 = 10 071 N ✓.
- Embedding ESV, R_z < 10: thread 3 + one head bearing 2.5 + one interface 1.5 = 7.0 µm; F_Z = 0.007/(2.837 + 0.519)·10⁶
  = 2 086 N ✓.
- Residual clamp load: 30 707/1.6 − 0.9227·1 419 − 2 086 = 19 192 − 1 309 − 2 086 = 15 797 N ✓ → gasket keeps
  15 797 N per bolt, 2.4 × the 6 676 N it needs.
- Surface pressure: A_p = π/4·(14.6² − 11²) = 72.4 mm²; 30 707/72.4 = 424 MPa ✓.

**Step 5 – decisions the program cannot make.**

1. **Why not M6 10.9?** `select_size()` says M6 10.9 would pass every check with the same clamp geometry. It is still
   not chosen: (a) the gasket needs an even pressure all round – 4 bolts at 120 mm bolt circle have a pitch of 94 mm,
   about 9 d for M10 but 16 d for M6; the usual limit for tight gasket joints is a pitch of about 5–7 d (check), so M6
   would let the cover bend open between the bolts; (b) M6 in grey iron needs careful engagement (≥ 1.25 d = 8 mm)
   and strips easily in service when re-tightened; (c) a 39.5 N m M10 joint is robust against assembly errors (a
   wrong tool setting of ±20 % still keeps the joint tight). The program checks a single bolt; bolt spacing and
   robustness are engineering judgement.
2. **Bolt pitch.** With M10 the pitch of 94 mm is above 7 d = 70 mm → **use 6 bolts M10 8.8** for a better pressure
   distribution (63 mm pitch, 6.3 d); the per-bolt loads then drop by one third and every safety improves. Re-run with
   `FA_max 946`, `F_seal 4451`.
3. **Engagement in grey iron:** tapped depth ≥ 1.25 d = 12.5 mm full thread plus 3 P run-out; drill depth 18 mm.
4. **Assembly instruction (`assembly.csv`):** M10 8.8 zinc flake (μ_tot 0.09–0.14), torque 39.5 N m with a calibrated
   click wrench, star pattern 1-3-2-4 (or 1-4-2-5-3-6), 2 passes (50 %, 100 %) + check pass; re-check torque after the
   first heat cycle only if the gasket is in the clamp path (here not).
5. **Inspection:** paint mark after assembly; tightening-on torque audit on 1 head per shift (window ≈ 37.5–45.4 N m from
   7.6.1).

### 8.3 What this chapter adds to the design pipeline (M1)

| Pipeline step (M1) | Bolt-joint content |
|---|---|
| Requirements | loads (static / dynamic), sealing, transverse load, temperature, re-use, corrosion class |
| Concept | through-bolt or tapped thread, number and spacing of bolts, metal-to-metal or gasket in the clamp path |
| Embodiment | clamp length l_K/d ≥ 3, bearing area (washer / flange head), engagement depth, thread run-out |
| Calculation | `bolt.py run` (VDI 2230 R0–R13), then the method comparison of 7.2.6 |
| Manufacturing data | bolt class, coating, friction class, torque / angle, tightening sequence, audit window |
| Verification | friction test (ISO 16047), ultrasonic preload check on the first articles, Junker test if transverse slip is possible |

### 8.4 References

- VDI 2230 Part 1 (2015): Systematic calculation of highly stressed bolted joints – joints with one cylindrical bolt.
- VDI 2230 Part 2 (2014): Multi-bolted joints.
- ISO 898-1 (2013): Mechanical properties of fasteners – bolts, screws and studs; ISO 898-2: nuts.
- ISO 16047 (2005): Fasteners – torque/clamp force testing.
- ISO 724 / ISO 965-1: ISO general-purpose metric threads – basic dimensions / tolerances.
- DIN 946: Determination of the coefficient of friction of bolt/nut assemblies (withdrawn, replaced by ISO 16047).
- ISO 4014 / 4017 (hexagon head bolts / screws), ISO 4032 (hexagon nuts), ISO 273 (clearance holes).
- ISO 10683 (zinc-flake coatings), ISO 4042 (electroplated coatings, hydrogen embrittlement), ISO 15330 (hydrogen test).
- DIN 65151 / ISO 16130: transverse vibration (Junker) test.
- J. H. Bickford: *Introduction to the Design and Behavior of Bolted Joints*, 4th ed., CRC Press.
- G. Niemann, H. Winter, B.-R. Höhn: *Maschinenelemente*, Vol. 1, Springer.
- Roloff/Matek: *Maschinenelemente* (chapter Schraubenverbindungen), Springer Vieweg.
- R. Kellermann, H.-C. Klein: Investigations on the influence of friction on the tightening torque and preload (1955) –
  basis of the torque formula.
- G. Junker: New criteria for self-loosening of fasteners under vibration, SAE Paper 690055 (1969).
- Bolt makers' technical handbooks (e.g. Bossard, Würth, Kamax, NORD-LOCK) – friction data, locking tests, check.

### 8.5 Glossary

| Term | Meaning |
|---|---|
| Preload F_M / F_V | Axial clamp force in the bolt after assembly (F_M at assembly, F_V after embedding) |
| F_Mzul | Permissible assembly preload: bolt stressed to ν·R_p0.2 under tension + torsion |
| Clamp load F_K, residual F_KR | Force pressing the parts together; F_KR = what remains under working load |
| Load factor Φ | Share of the axial working load that goes into the bolt (Φ_n = n·Φ_K) |
| Load introduction factor n | Where the working load enters the clamped parts (0 … 1) |
| Compliance δ_S, δ_P | Elastic elongation per newton of the bolt / compression per newton of the plates |
| Deformation cone / sleeve | Model of the stressed volume in the clamped parts (angle φ, limit diameter D_A,Gr) |
| Embedding f_Z, F_Z | Flattening of surface roughness after assembly → loss of preload |
| Tightening factor α_A | F_Mmax/F_Mmin of an assembly method (scatter of the preload) |
| μ_G, μ_K, μ_tot | Thread friction, head (bearing) friction, total friction (ISO 16047) |
| Snug torque | Small torque that closes the gaps before an angle step |
| Torque-angle / yield control | Tightening by angle after snug / to the yield point detected by the torque–angle gradient |
| LTF | Load transfer factor of a hydraulic tensioner (tool force / residual preload) |
| Elastic interaction (cross-talk) | Preload loss of bolts already tightened when neighbours are tightened |
| Inner loosening torque | F·0.16·P – the pitch part that tries to unscrew the nut; acts alone under transverse slip |
| Junker test | Transverse vibration test showing self-loosening by slip (DIN 65151 / ISO 16130) |
| DSV / ESV | Through-bolt with nut / tapped-thread joint (German abbreviations of VDI 2230) |
| σ_ASV, σ_ASG | Fatigue limit (stress amplitude) of a bolt rolled before / after heat treatment |
| p_G | Limiting surface pressure of the clamped material under the head / nut |
| Hydrogen embrittlement | Delayed brittle fracture of high-strength steel caused by absorbed hydrogen |
| Friction class | Specified μ window of a fastener surface (A … E) |
