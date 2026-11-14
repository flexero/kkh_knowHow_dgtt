# M3 – Shaft design: layout, loads, deflection, critical speed, DIN 743 strength proof, keys, press fits, manufacturing

> Field 1 *Mechanical design*, item 3. **Theory and program are combined:** every formula is followed by the code of
> `tools/shaft.py`, the command and the real output. MATLAB mirror: `tools/shaft.m`. Web: tab **M_P_C tools**, item 6.
> Python standard library only – offline. **All inputs are example values.** The strength proof follows the structure and
> the published formulas of DIN 743 (2012) in a simplified form; values marked "check" must be compared with the standard
> before a design report is signed.

## Contents
0. How to use this guide with the program
1. Purpose – what a shaft calculation must prove
2. Shaft design process, layout and real manufacturing
3. Loads on shafts (hand-over from M2)
4. Internal forces and section properties
5. Stiffness: deflection, slope, twist, critical speed
6. Notches and stress concentration
7. Strength proof in the style of DIN 743
8. Shaft–hub connections (keys, interference fits, splines)
9. Manufacturing and inspection of the shaft
10. Verification with SOLIDWORKS Simulation / Ansys
11. Complete worked design example, checklists, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python shaft.py params` | Default input as JSON (copy → edit → `--in`) |
| `python shaft.py run --in my.json --out res` | Full calculation → `report.md`, `shaft.csv` (every 0.5 mm), `moments.svg`, `deflection.svg`, `geometry.svg` |
| `python shaft.py examples` | Worked examples (hand-over from M2, full report, Kt table, DIN 743 factors) |
| `python shaft.py ch24` / `ch56` / `ch711` | Extra results of chapters 2–4 / 5–6 / 7–11 |
| `python shaft.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=6#mpc` | Same calculation with charts; button "Take loads from M2 crank" |

### 0.2 The input (JSON)
| Key | Meaning |
|---|---|
| `segments` | `[[length, outer d, bore], …]` from the left end, mm |
| `bearings` | x of bearing A (locating) and B (floating), mm |
| `forces` | `[[x, Fy, Fz, label], …]` N in two planes |
| `masses` | `[[x, kg, label]]` attached masses for the critical speed |
| `torque_in_x`, `torque_out_x` | where the torque enters and leaves |
| `T_mean_Nm`, `T_amp_Nm`, `T_max_Nm` | torque mean, amplitude (fatigue) and peak (static) |
| `notches` | `[[x, type, {D, d, r, Rz}]]` cross-sections to prove: shoulder, keyway, pressfit, groove, plain |
| `key`, `pressfit` | shaft–hub connections to check |
| `S_min`, `slope_limit_rad`, `deflection_limit_mm` | acceptance limits |

### 0.3 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Material data (typical, d ≤ 16 mm) | `MATERIALS` |
| 3 | Hand-over from the crank mechanism (torque statistics, peak pin load, belt load) | `loads_from_crank()` |
| 4 | Section properties, reactions, moments in two planes, torque | `section()`, `reactions()`, `internal()`, `geometry_at()` |
| 5 | Elastic line of the stepped shaft, slopes, twist, critical speed (Rayleigh + Dunkerley) | `deflection()`, `deflection_summary()`, `torsion_angle()`, `critical_speed()` |
| 6 | Kt of shoulders (Peterson fits), support number, notch factors | `kt_shoulder()`, `support_n()`, `notch_betas()` |
| 7 | DIN 743 style factors and safety at a notch | `K1()`, `K2()`, `KF()`, `din743_point()`, `strength()` |
| 8 | Feather key, interference fit | `KEYS`, `key_size()`, `key_check()`, `press_fit()`, `press_fit_design()` |
| – | Report, CSV, charts | `report_text()`, `run()` |
| 2–4 | Pre-sizing (torsion, combined), gear / belt / coupling loads, mass, load cases, moment table, hollow vs solid, equivalent stress | `presize_torsion()`, `presize_combined()`, `gear_forces()`, `belt_load()`, `coupling_force()`, `shaft_mass()`, `load_cases()`, `moment_table()`, `hollow_vs_solid()`, `equiv_stress()` |
| 5–6 | Slope in arcmin, slender-shaft case, critical speed with bearing stiffness, torsional 2-mass, Jeffcott rotor, cross-hole Kt, DIN 509 grooves, surface factor K_V, fillet-radius table | `slope_arcmin()`, `slender_example()`, `critical_speed_kb()`, `torsional_2mass()`, `jeffcott()`, `kt_cross_hole_bending()`, `DIN509_TYPICAL`, `din743_point_kv()`, `radius_table()`, `slender_stress_case()` |
| 7–11 | Critical notch, sensitivity study, comparison with Shigley / FKM, crank-web fillet check, ISO fits Ø30, interference from a fit, press-fit fix, lighter redesign | `critical_notch()`, `sensitivity_study()`, `shigley_compare()`, `fkm_compare()`, `web_fillet_check()`, `ISO_30`, `fit_interference()`, `press_fit_fix()`, `REDESIGN`, `redesign()` |
Example input of chapter 11: `tools/examples/shaft_redesign.json`.

### 0.4 What the self-test proves
1. Equilibrium in both planes (ΣF = 0, ΣM = 0) and zero moment beyond the last load.
2. Stepped-shaft integration reproduces closed forms: central load F L³/(48EI) and slope F L²/(16EI); overhung tip
   F a²(L + a)/(3EI) – error < 0.2 %.
3. Rayleigh critical speed = √(k/m_eff) for a disc on a uniform shaft (± 2 %); Dunkerley ≤ Rayleigh.
4. K2(7.5 mm) = 1, K2(150 mm) = 0.8; Kt falls with a larger fillet radius.
5. Press fit pressure = Lamé closed form; key length l_min gives safety exactly 1.
6. Hand-over: the loads equal the M2 numbers (T_mean 10.41, T_max 47.77 N·m, pin 2684 N).

## 1. Purpose – what a shaft calculation must prove

A shaft carries **torque** and **bending** and positions gears, pulleys and bearings. The calculation must prove:

| Proof | Question | Chapter |
|---|---|---|
| Static strength | No yielding at the peak load (start, fault) | 7 |
| Fatigue strength | No crack after 10⁹ rotations at every notch | 6, 7 |
| Stiffness | Deflection and slope small enough for bearings, gears, seals | 5 |
| Dynamics | Far from bending and torsional resonance | 5 |
| Connections | Keys, press fits, splines transmit the torque | 8 |
| Manufacture | Drawing data, tolerances, heat treatment, inspection | 2, 9 |

**Default example** (`python shaft.py examples`): the compressor crankshaft treated as a stepped shaft (Ø25 pulley seat,
Ø30 bearing seats, Ø35 middle) on bearings at x = 50 and 170 mm, belt load 637 N on the pulley, crank-pin peak 2684 N
(from M2), C45+QT. Results: bearing loads ≈ 1.6 / 1.4 kN, max deflection ≈ 9 µm, critical speed ≈ 60 × running speed,
fatigue safety ≥ 9 at every notch – the small compressor shaft is sized by **stiffness, bearing size and handling**, not
by strength. The real crankshaft has webs and a crank pin: chapter 7 explains why the straight-beam model is only the
first step there.


---

## 2 Shaft design process, layout and real manufacturing

### 2.1 Shaft, axle, spindle – what is the difference?

| Element | Carries | Rotates? | Typical stresses | Example in the compressor factory |
|---|---|---|---|---|
| **Shaft** | Torque **and** bending | Yes | Torsion (mean + amplitude) + rotating bending (fully reversed) | Compressor crankshaft, gearbox shafts, motor shaft |
| **Axle** | Bending only (no torque) | Fixed or rotating | Bending | Idler pulley axle, AGV wheel axle, conveyor roller axle |
| **Spindle** | Torque + bending, **high accuracy** | Yes, often fast | Like a shaft, but stiffness and runout decide | HMC milling spindle (guides 18, 19) |

A shaft has four jobs at the same time:
1. **Transmit torque** from the input element (pulley, coupling, gear) to the output element (crank pin, gear).
2. **Carry the transverse forces** of these elements to the bearings (bending).
3. **Locate** the parts axially and radially (shoulders, fits, rings).
4. **Run true and stiff enough** that bearings, gears and seals work (deflection, slope, critical speed).

### 2.2 The design steps – from loads to the drawing

```
 1 loads (M2 hand-over, belt, gears, K_A)        -> chapter 3
 2 pre-size d from torque (and bending)           -> 2.3
 3 layout: bearings, shoulders, seats, keyways    -> 2.4 - 2.6
 4 internal forces: reactions, M(x), T(x)         -> chapter 4
 5 stiffness: deflection, slope, twist, n_crit    -> chapter 5
 6 strength proof at every notch (DIN 743)        -> chapters 6 - 7
 7 shaft-hub connections (key, press fit)         -> chapter 8
 8 detail + drawing + manufacturing + inspection  -> 2.7 - 2.9, chapter 9
```
This is the M1 pipeline (S4 embodiment → S5 detail → S6 verification) applied to one machine element.
The loop 3 → 6 is normally run 2–3 times: the first layout is never final.

### 2.3 Pre-sizing – the first diameter

**Theory.** At the start you know the torque, but not the bending moment (the bearing positions are not fixed yet)
and not the notches. So you size the shaft for torsion only, with a **low** allowable shear stress. The low value
covers the unknown bending, the notches and fatigue.

Derivation: torsional shear stress at the surface τ = T / W_t, with W_t = π d³ / 16 for a solid shaft. Set τ = τ_allow
and solve for d.

```
 Pre-size from torque only:         d = ( 16 T / (π τ_allow) )^(1/3)          τ_allow = 20 … 40 MPa (steel)
 Pre-size from bending + torque:    d = ( 32 M_v / (π σ_allow) )^(1/3)        M_v = √(M² + 0.75 T²)
                                    σ_allow ≈ 50 … 80 MPa for C45 / 42CrMo4 (pre-check only)
 T [N mm], M [N mm], d [mm], stresses [MPa]
```
M_v comes from the von Mises stress σ_v = √(σ_b² + 3τ²) with σ_b = 32M/(πd³) and τ = 16T/(πd³):
σ_v = (32/(πd³))·√(M² + 3·(T/2)²) = (32/(πd³))·√(M² + 0.75 T²).

**In the program** (added for this chapter, `shaft.py`):
```python
def presize_torsion(T_Nm, tau_allow=25.0):
    """Pre-size from torsion only: tau = 16 T / (pi d^3) <= tau_allow  ->  d = (16 T / (pi tau_allow))^(1/3).
    tau_allow is LOW on purpose (20...40 MPa) because bending, notches and fatigue are not yet known."""
    return (16 * T_Nm * 1000 / (math.pi * tau_allow)) ** (1 / 3)


def presize_combined(M_Nm, T_Nm, sigma_allow=60.0):
    """Pre-size from bending + torsion (von Mises): sigma_v = 32/(pi d^3) sqrt(M^2 + 0.75 T^2) <= sigma_allow."""
    Mv = math.sqrt(M_Nm ** 2 + 0.75 * T_Nm ** 2) * 1000
    return (32 * Mv / (math.pi * sigma_allow)) ** (1 / 3), Mv / 1000
```
**Run it:** `python shaft.py ch24` (first block)
```
== 2 pre-sizing
  compressor T_max 47.8 N m, tau_allow 20 MPa: d = 23.00 mm
  compressor T_max 47.8 N m, tau_allow 25 MPa: d = 21.35 mm
  compressor T_max 47.8 N m, tau_allow 40 MPa: d = 18.26 mm
  compressor M 81.1 N m (pin peak) + T 47.8 N m, sigma_allow 60 MPa: M_v 91.1 N m -> d = 24.91 mm
  gearbox T 500 N m, tau_allow 25 MPa: d = 46.70 mm
```
**Interpretation.**
- Compressor: torque alone gives d ≈ 21–23 mm. With the bending moment from the crank-pin peak (81.1 N·m, chapter 4)
  the combined pre-size is 24.9 mm. The example design uses **25 mm at the pulley and 30–35 mm between the bearings** –
  consistent. Chapter 7 will show large fatigue safeties (≈ 9–13): for this small compressor the shaft diameter is set
  by the **bearings, the crank pin and stiffness**, not by strength. This is normal for small reciprocating machines.
- Gearbox example (T = 500 N·m): d ≈ 47 mm from torque; chapter 3 adds the gear forces.

**Manufacturing link.** Round the pre-size **up** to a standard bearing bore (20, 25, 30, 35, 40, 45, 50 … mm) at the
bearing seats and to a preferred number (ISO 3, R20) elsewhere. Standard bores mean catalogue bearings, seals,
rings and gauges.

**MATLAB:** `d = (16*T*1e3/(pi*tau)).^(1/3);  d2 = (32*sqrt(M.^2+0.75*T.^2)*1e3/(pi*sig)).^(1/3);`

**Check questions.** 1) Why is τ_allow so low (20–40 MPa) compared with the yield strength of C45 (≈ 490 MPa)?
2) Where does the factor 0.75 in M_v come from? 3) Why is the final diameter of the compressor shaft larger than the pre-size?

### 2.4 Bearing arrangements – locating, floating, adjusted

A shaft grows with temperature (ΔL = α·L·ΔT; steel α ≈ 11.5·10⁻⁶ 1/K: 120 mm and 40 K give 0.055 mm). If both
bearings hold the shaft axially, this growth creates large axial forces. Therefore:

| Arrangement | How | Use | Compressor / factory example |
|---|---|---|---|
| **Locating + floating** | One bearing holds axial load both ways (locating); the other can slide (floating: cylindrical roller NU/N, or a ball bearing with a sliding outer ring) | Standard for most shafts; free thermal growth | Crankshaft: locating ball bearing on the pulley side (belt pull, axial location), floating bearing on the far side |
| **Adjusted (cross-located)** | Two angular-contact or taper roller bearings, each takes axial load in one direction, preload set at assembly | Short shafts, stiff, accurate | Gear pinion shafts, wheel hubs, spindle front |
| **Floating (both)** | Both bearings let the shaft move a little; location by another element (helical gear teeth, herringbone gear) | Special cases | Herringbone gear shafts |

The default example in `shaft.py`: bearing A at x = 50 mm (locating, next to the pulley), B at x = 170 mm (floating).

### 2.5 Axial location of parts

| Means | Notch effect | Comment |
|---|---|---|
| Shoulder with fillet | Low–medium (r!) | Best. Radius must be **smaller than the bearing chamfer** r_s min (catalogue), but as large as possible |
| Shoulder + spacer ring | Low | Lets you use a large fillet radius behind a small bearing chamfer |
| Retaining ring DIN 471 (shaft) | **High** (sharp groove) | Only in low-moment zones (shaft ends) |
| Lock nut KM + washer MB (DIN 981 / ISO 2982-2) | High at the thread undercut | Bearings on adapter sleeves, adjustable preload |
| Interference fit only | Medium (fretting at the hub edge) | Gears, pulleys, bearing inner rings |
| Clamp collar / taper bush | Low | Pulleys (taper-lock), easy assembly |

### 2.6 Design rules for fatigue (shape the shaft for the force flow)

1. **Smooth transitions:** fillet radius r/d ≥ 0.05 where possible; D/d ≤ 1.2 at highly loaded steps. Chapter 6 shows
   Kt = 1.96 for r = 1 mm at D/d = 30/25, but 1.60 for r = 2.5 mm.
2. **Radius vs bearing chamfer:** the bearing must sit flat on the shoulder. Use the largest fillet that the bearing
   chamfer allows, or a spacer ring, or a relief groove.
3. **Relief grooves (undercuts) DIN 509:** form E (for a ground cylindrical surface only) and form F (ground cylinder
   **and** ground face). Typical sizes for d up to about 18 … 80 mm: r = 0.6 … 1.0 mm, depth t1 ≈ 0.2 … 0.3 mm
   (check DIN 509 table). They cost fatigue strength, so put them where the moment is low.
4. **Keyways:** end-milled (form A) gives a higher notch effect at the keyway end than a disc-milled (form B) runout.
   Do not end a keyway close to a shoulder fillet (notches add up). Leave ≥ 3–5 mm between keyway end and fillet.
5. **No notches in high-moment zones:** look at the M(x) diagram (chapter 4) before you place grooves, holes, threads,
   marking or keyways.
6. **Hub edges:** at a press fit the stress peaks at the hub edge (fretting). A slightly larger seat diameter (raised
   seat, d_seat = 1.05–1.1 d) with a fillet moves the peak out of the fretting zone.
7. **Surface:** fine finish (Rz ≤ 6.3, Ra ≤ 0.8) in highly stressed zones; KF factor in chapter 7.
8. **Residual compressive stress:** fillet rolling, shot peening, induction hardening, nitriding raise the fatigue limit
   of the notch by 30–100 % (typical; DIN 743 factor K_V, chapter 7).

### 2.7 Materials and heat treatment – how to use the `MATERIALS` table

**In the program:**
```python
MATERIALS = {   # Rm, Re (MPa) for reference diameter dB = 16 mm; E, G (MPa); rho kg/m3; kind for K1 law
    "C45+N":       {"Rm": 620, "Re": 340, "E": 210000, "G": 81000, "rho": 7850, "kind": "normalised"},
    "C45+QT":      {"Rm": 700, "Re": 490, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "42CrMo4+QT":  {"Rm": 1100, "Re": 900, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "34CrNiMo6+QT": {"Rm": 1200, "Re": 1000, "E": 210000, "G": 81000, "rho": 7850, "kind": "QT"},
    "16MnCr5 (core)": {"Rm": 1000, "Re": 695, "E": 210000, "G": 81000, "rho": 7850, "kind": "case"},
    "S355J2":      {"Rm": 490, "Re": 355, "E": 210000, "G": 81000, "rho": 7850, "kind": "structural"},
}
```
The values are **minimum values for the reference diameter d_B = 16 mm** (EN 10083 / DIN 743-3 style). Larger
blanks are weaker in the core: chapter 7 applies the technological size factor K1(d). Values are typical – **check the
material certificate (EN 10204 3.1) and EN 10083-2/-3, EN 10084**.

| Material | Use it when | Heat treatment / surface | Notes for the factory |
|---|---|---|---|
| C45+N (normalised) | Low-stressed shafts, axles, cheap parts | none / induction hardening of seats | Machines well; lowest cost |
| **C45+QT** | **Standard machine shafts, compressor crankshafts (forged)** | QT; seats/journals induction hardened 50–56 HRC (check) | Good balance cost/strength; example material of this guide |
| 42CrMo4+QT | Highly loaded shafts, gearbox shafts, thick sections | QT; induction hardening or nitriding | Hardenability for d up to ≈ 100 mm |
| 34CrNiMo6+QT | Very high loads, large diameters, toughness | QT | Expensive; for large gearboxes |
| 16MnCr5 / 18CrNiMo7-6 | Shafts with integral gear teeth (pinion shafts) | Case hardening 58–62 HRC, case depth 0.6–1.2 mm | Distortion → grind after hardening |
| Nitriding steels (e.g. 31CrMoV9) | Spindles, wear + fatigue, low distortion | Gas / plasma nitriding, compound layer | Thin hard layer, very good fatigue at notches |
| EN-GJS-700-2 / EN-GJS-800 (ductile iron) | Cast crankshafts in series | Fillet rolling, induction hardening of pins | Cheaper than forging in series; DIN 743 is for steel – use FKM for cast iron |

### 2.8 Manufacturing route of a stepped shaft / small crankshaft

| Op | Operation | Machine (guide 49) | Key result |
|---|---|---|---|
| 10 | Saw bar or forge blank (crankshaft: closed-die forging; or cast EN-GJS) | Saw / forge press / foundry | Blank with allowance 2–4 mm |
| 20 | Face + centre holes DIN 332 form A/R (datum for all later operations) | Centring machine / lathe | Common datum axis |
| 30 | Rough turning | CNC lathe | Allowance 0.5–1 mm for QT distortion |
| 40 | Heat treatment QT (if bought +N or annealed) | Furnace (subcontract) | Hardness check, e.g. 220–260 HB (example) |
| 50 | Straighten (if needed), finish turning, keyways, threads, grooves | CNC lathe with driven tools / mill | Seats with 0.2–0.3 mm grinding allowance |
| 60 | Induction hardening of seats / journals / pins | Induction machine | 50–56 HRC, depth 1–2 mm (example, check) |
| 70 | **Fillet rolling** (crankshafts) | Rolling machine | Residual compression in the fillet |
| 80 | Grinding of bearing seats, pins, seal surface (plunge grinding, no lead on seal surfaces) | Cylindrical / pin-chasing grinder | IT5–IT6, Ra 0.4–0.8 |
| 90 | Dynamic balancing (crankshaft with counterweights, M2 ISO 21940-11) | Balancing machine | U_per, e.g. G6.3 |
| 100 | Final inspection: diameters, runout, roundness, hardness, crack test (MT) | Gauges, CMM, roundness tester, MT bench | Inspection record (traceability) |

### 2.9 Drawing specification – what must be on the shaft drawing

| Feature | Typical specification (example values, check catalogue / standard) |
|---|---|
| Bearing seat (rotating inner ring, normal load) | **k5** (d ≤ 40 mm), **m5** (40–100 mm), j6 for light loads; housing H7 / J7 |
| Pulley / gear seat with key | k6 or j6 (transition) |
| Press-fit seat (torque by friction) | p6 / s6 or calculated (chapter 8) |
| Seal running surface | h11, Ra 0.2–0.8 µm, no lead (plunge ground), hardness ≥ 45 HRC for high speed (check seal maker) |
| Runout of seats to the common axis A–B | 0.005–0.010 mm (bearing seats), 0.02–0.05 mm (pulley seat) |
| Cylindricity of bearing seats | ≈ IT3–IT4 (e.g. 0.003–0.004 mm for d 30) – check bearing catalogue |
| Shoulder face runout (bearing abutment) | 0.005–0.010 mm |
| Surface roughness | Seats Ra 0.4–0.8; fillets of highly loaded steps Ra ≤ 0.8 (Rz 6.3); general Ra 3.2 |
| Fillet radii | Value + tolerance on the drawing (e.g. R1 +0.2/0); never "sharp" |
| Centre holes | DIN 332-1 form A or R, "required on the finished part" if used for regrinding / balancing |
| Chamfers | 1 × 45° at ends, lead-in chamfers 15–20° for press fits |
| General tolerances | ISO 2768-mK |
| Material, heat treatment | "C45+QT, EN 10083-2; induction hardened 52 ± 3 HRC, depth 1.0–2.0 mm at seats" (example) |
| Keyway | DIN 6885-1, width tolerance N9 (fixed key) / P9 |

**Check questions.** 1) Why must the fillet radius be smaller than the bearing chamfer, and how do you still get a large
radius? 2) Which bearing of the crankshaft should be the locating bearing, and why? 3) Why must the seal surface be
plunge-ground without lead?

---

## 3 Loads on shafts

### 3.1 Hand-over from M2 – the compressor loads

The crank mechanism program (M2, `crank.py`) already calculated the drive torque curve and the crank-pin force for every
crank angle. The shaft program reads them directly, so M2 and M3 always use the **same numbers**.

**In the program:**
```python
def loads_from_crank(pulley_d_mm=300.0, belt_factor=2.0):
    """Hand-over M2 -> M3: torque statistics and the peak crank-pin load from crank.py (default compressor).
    Belt shaft load ~ belt_factor x effective pull F_e = 2 T_max / d_p (peak torque; V-belt rule of thumb 1.5 ... 2.5,
    check the belt maker's method)."""
    import crank
    R = crank.compute_all()
    Ms = [r["M_drive"] for r in R["rows"]]
    Tm = sum(Ms) / len(Ms)
    Ta = (max(Ms) - min(Ms)) / 2
    pins = [math.hypot(*r["F_pin"]) for r in R["rows"]]
    k = pins.index(max(pins))
    Fe = 2 * max(Ms) / (pulley_d_mm / 1000)
    return {"T_mean": Tm, "T_amp": Ta, "T_max": max(Ms), "T_min": min(Ms), "pin_max": max(pins),
            "theta_at_pin_max": math.degrees(R["rows"][k]["theta"]), "F_belt": belt_factor * Fe, "F_e": Fe}
```
**Run it:** `python shaft.py ch24` (hand-over block)
```
== 3 hand-over M2: T_mean 10.41 T_amp 30.20 T_max 47.77 T_min -12.64 N m, pin max 2684 N at 7.0 deg
```
**Interpretation – three torque numbers, three uses:**

| Value | Meaning | Used for |
|---|---|---|
| T_mean = 10.41 N·m | Time average over one turn = power / ω (M2 chapter 7) | Motor power, belt selection, bearing life |
| T_max = 47.77 N·m, T_min = −12.64 N·m | Peak and lowest torque in one turn | Static proof, key, press fit, belt load |
| T_amp = (T_max − T_min)/2 = 30.20 N·m and the mid-range (T_max + T_min)/2 = **17.57 N·m** | The cyclic part of the torque | **Fatigue** proof (chapter 7) |

Note the difference: the **fatigue** mean value is the mid-range of the cycle (17.6 N·m, used as `T_mean_Nm` in the shaft
input), not the time average (10.4 N·m). The torque curve is not a sine wave; the mid-range + amplitude pair
envelopes the real cycle and is on the safe side for one cycle per turn. (A rainflow count of the curve, M1 chapter 17,
gives the exact cycle content.)

The crank-pin peak of **2684 N at θ = 7°** is the gas force of cylinder 1 near its top dead centre combined with
the rod forces of both cylinders (M2 chapter 6). The shaft input uses this peak as a transverse force at the crank pin
(x = 110 mm). This is a **simplification**: a real crankshaft has webs and an offset pin (chapter 7 explains what must
be added: the web-pin fillets, FEA, fillet rolling).

### 3.2 Belt and chain loads

**Theory.** A belt transmits the effective pull F_e = F₁ − F₂ (tight side minus slack side). From the torque at the pulley
of pitch diameter d_p: F_e = 2T/d_p. The shaft load is the **vector sum** F₁ + F₂, which is larger than F_e because the
slack side must keep a tension (initial tension) to avoid slip. With the Euler–Eytelwein law F₁/F₂ = e^(μβ):

```
 F_e = 2 T / d_p            F_shaft ≈ k · F_e
 k ≈ 1.5 … 2.5 (V-belts, depends on wrap angle and set tension)  ·  2 … 3 (flat belts)  ·  ≈ 1.0 … 1.2 (chains)
```
Belt makers give their own procedure (initial tension per belt, static shaft load at installation, which can be
**higher** than in operation) – use it in the final proof.

**In the program:**
```python
def belt_load(T_Nm, dp_mm, factor=2.0):
    """Effective pull F_e = 2 T / d_p; shaft load ~ factor x F_e (V-belt 1.5...2.5, flat belt 2...3, chain ~1.1)."""
    Fe = 2 * T_Nm * 1000 / dp_mm
    return {"F_e": Fe, "F_shaft": factor * Fe}
```
**Run it:** `python shaft.py ch24`
```
  belt d_p 300 mm, T_max: F_e 318.5 N, factor 1.5 -> shaft load 478 N
  belt d_p 300 mm, T_max: F_e 318.5 N, factor 2.0 -> shaft load 637 N
  belt d_p 300 mm, T_max: F_e 318.5 N, factor 2.5 -> shaft load 796 N
  same with T_mean: F_e 69.4 N -> 139 N
```
**Interpretation.** The default shaft input uses **637 N** (factor 2 on the peak torque) in the z direction at the
flywheel pulley (x = 20 mm). If you used the mean torque you would get only 139 N – too low, because the belt must
carry the peak without slipping, so its tension is set for the peak. The pulley is Ø300 mm because it is also the
flywheel (M2 chapter 7: 3.1 kg).

**Practice.** Set the belt tension with a tension gauge (frequency method) as the belt maker specifies; re-tension after
the run-in (typically after 0.5–24 h, check). Over-tensioned belts are a common cause of locating-bearing failure on
the pulley side – your bearing life calculation (M4) must use the **installation** shaft load.

### 3.3 Gear forces

**Theory.** For a spur or helical gear of operating pitch diameter d, the tooth force is split into three components:
tangential F_t (transmits the torque), radial F_r (pushes the gears apart, pressure angle α_n) and axial F_a (only
helical, helix angle β):

```
 F_t = 2 T / d            F_r = F_t · tan α_n / cos β            F_a = F_t · tan β
 The axial force acts at radius d/2  ->  bending moment on the shaft  M_a = F_a · d / 2
```
**In the program:**
```python
def gear_forces(T_Nm, d_mm, alpha_n_deg=20.0, beta_deg=0.0):
    """Spur / helical gear: F_t = 2 T / d, F_r = F_t tan(alpha_n) / cos(beta), F_a = F_t tan(beta)."""
    Ft = 2 * T_Nm * 1000 / d_mm
    Fr = Ft * math.tan(math.radians(alpha_n_deg)) / math.cos(math.radians(beta_deg))
    Fa = Ft * math.tan(math.radians(beta_deg))
    return {"Ft": Ft, "Fr": Fr, "Fa": Fa, "F_radial_total": math.hypot(Ft, Fr), "M_axial_Nm": Fa * d_mm / 2 / 1000}
```
**Run it:** `python shaft.py ch24`
```
== 3 gear forces, T 500 N m, d 200 mm, alpha_n 20, beta 15: Ft 5000.0 Fr 1884.0 Fa 1339.7 N, radial total 5343.2 N, axial moment 134.0 N m
  spur (beta 0): Ft 5000.0 Fr 1819.9 Fa 0.0 N
  gearbox pre-size with M = (F_rad/2) x 60 mm = 160.3 N m + T 500: d = 42.80 mm
```
**Interpretation (gearbox example, example values).** The helix angle 15° adds an axial force of 1340 N (the locating
bearing must take it) and a moment of 134 N·m from F_a·d/2. With the gear 60 mm from a bearing, the bending moment is
about 160 N·m, and the combined pre-size gives 42.8 mm – smaller than the torsion-only pre-size (46.7 mm, which uses the
deliberately low τ_allow = 25 MPa). Use the larger value until the layout is known.
Gear geometry and strength (ISO 6336) follow in item M5.

### 3.4 Coupling forces, weight, other loads

| Load | Formula / rule | Example |
|---|---|---|
| Flexible coupling, parallel offset Δr | F = k_r · Δr (radial stiffness from the coupling catalogue) | 0.2 mm × 500 N/mm = **100 N** (`coupling_force()`) |
| Weight of the shaft and parts | m·g | Shaft 1.170 kg → **11.5 N** (vs 2684 N pin load – negligible here, but not for heavy rolls) |
| Unbalance | F = m·e·ω² = U·ω² | Pulley G6.3 at 1450 rpm: small; important for fast shafts (M2 chapter 8) |
| Thermal axial force | Only if both bearings locate (avoid!) | – |
| Assembly forces | Press-fitting, tightening of nuts | Static check only |

**Run it:**
```
  coupling offset 0.2 mm, k_r 500 N/mm: F = 100 N
  shaft mass 1.170 kg, weight 11.48 N (vs pin load 2684 N)
```

### 3.5 Application factor and load cases

**Theory.** The calculated loads are **nominal** values of a smooth machine. Real drives have shocks (start, motor
type, driven machine type). The **application factor K_A** multiplies the nominal torque: K_A = 1.0 (uniform: electric
motor + fan), 1.25 (light shocks: piston compressor with flywheel), 1.5 – 1.75 (moderate / heavy shocks) – typical
values from ISO 6336-6 / DIN 3990 style tables (**check** the table for your driver and driven machine).

**In the program:**
```python
def load_cases(T_nom_Nm, cases=(("normal", 1.0), ("peak (start, K_A)", 1.5), ("fault (blocked valve)", 2.5))):
    """Torque for each load case = factor x nominal."""
    return [(n, f, f * T_nom_Nm) for n, f in cases]
```
**Run it:**
```
  load case normal                 factor 1.0 -> T 47.8 N m
  load case peak (start, K_A)      factor 1.5 -> T 71.7 N m
  load case fault (blocked valve)  factor 2.5 -> T 119.4 N m
```
| Load case | Used for | In `shaft.py` |
|---|---|---|
| Normal operation (M2 torque curve, peak pin force) | **Fatigue** (infinite life: 20 000 h × 1450 rpm × 60 ≈ 1.7·10⁹ cycles) | `T_mean_Nm`, `T_amp_Nm`, forces |
| Peak / start (motor start torque ≈ 2–3 × nominal for direct-on-line, K_A) | **Static** proof against yielding | `load_factor_static` = 1.5 (example) |
| Fault (blocked discharge until the safety valve opens, M2 load cases) | Static proof, key and press-fit slip | Run `shaft.py run --in` with the fault loads |

### 3.6 Rotating shaft, fixed load direction – why bending is fully reversed

The belt pull and (on average) the crank-pin load have a **fixed direction in space**, while the shaft rotates.
A point on the shaft surface passes the tension side and the compression side once per turn:
σ_b(t) = (M/W_b)·cos(ωt). So the bending stress is **fully reversed** (mean 0, amplitude M/W_b), even though the load
is constant. This is why `"bending_rotating": True` sets σ_ba = M/W_b and σ_bm = 0 (chapter 7).
Exceptions: a load that rotates **with** the shaft (unbalance, a crank-pin load seen in the shaft frame) gives a
**static** bending stress for the rotating fibre. For the crankshaft the pin load rotates with the crank but also changes
in size every turn – this is why chapter 7 uses the peak value conservatively as a fully reversed amplitude.

The **torque** is not reversed: it has a mean value (17.6 N·m mid-range) and an amplitude (30.2 N·m) → mean-stress
effect in the fatigue proof (Haigh diagram, M1 chapter 26).

**Check questions (chapter 3).** 1) Why must the belt load be based on the peak torque? 2) Name the three gear force
components and which bearing takes the axial one. 3) Why is the bending stress in the rotating shaft fully reversed
although the belt pull is constant? 4) What is the difference between T_mean = 10.41 and the mid-range 17.6 N·m?

---

## 4 Internal forces and section properties

### 4.1 Section properties of round shafts

**Derivation.** For a circle the second moment of area about a diameter is I = ∫y² dA = πd⁴/64; the polar moment is
I_p = ∫r² dA = I_y + I_z = 2I = πd⁴/32. For a hollow shaft subtract the bore. Section moduli: W_b = I/(D/2) (bending),
W_t = I_p/(D/2) = 2W_b (torsion).

```
 A  = π (D² − d_i²) / 4         I  = π (D⁴ − d_i⁴) / 64        I_p = 2 I
 W_b = I / (D/2)                W_t = I_p / (D/2) = 2 W_b
 solid: W_b = π D³/32 ≈ 0.098 D³    W_t = π D³/16 ≈ 0.196 D³
```
**In the program:**
```python
def section(D, di=0.0):
    """Area A, second moment I, polar Ip, section moduli Wb, Wt of a (hollow) round section, mm units."""
    A = math.pi / 4 * (D ** 2 - di ** 2)
    I = math.pi / 64 * (D ** 4 - di ** 4)
    return {"A": A, "I": I, "Ip": 2 * I, "Wb": I / (D / 2), "Wt": 2 * I / (D / 2)}
```
**Run it:**
```
  section 35/20: A 648.0 mm2, I 65808 mm4, Ip 131616 mm4, Wb 3760.4 mm3, Wt 7520.9 mm3
```

### 4.2 Hollow vs solid

Material near the axis carries almost no bending or torsion (stress ∝ radius). Removing it saves mass but costs little
stiffness.

**In the program:**
```python
def hollow_vs_solid(D, di):
    """Hollow shaft vs solid shaft of the same outer diameter: ratios of mass, I (stiffness), Wb (strength)."""
    s, h = section(D), section(D, di)
    return {"mass_ratio": h["A"] / s["A"], "I_ratio": h["I"] / s["I"], "W_ratio": h["Wb"] / s["Wb"]}
```
**Run it:**
```
  hollow 35/15: mass 0.816, I 0.966, Wb 0.966 of solid
  hollow 35/20: mass 0.673, I 0.893, Wb 0.893 of solid
  hollow 35/25: mass 0.490, I 0.740, Wb 0.740 of solid
```
A Ø20 bore in a Ø35 shaft removes **33 % of the mass** but only **11 % of the stiffness and strength**. M1 §8.5 showed
the same idea as an optimisation (hollow shaft −61 % mass). Practical uses: oil supply bores in crankshafts, spindle
draw-bar bores, light drive shafts. Costs: deep-hole drilling (L/D > 10 needs gun drilling), and a bore is a notch at
cross holes.

### 4.3 Bearing reactions – equilibrium in two planes

**Theory.** The forces act in two perpendicular planes (y: crank-pin load; z: belt pull). Each plane is a simply
supported beam with overhangs; it is **statically determinate** with two bearings, so equilibrium alone gives the
reactions:

```
 Σ F = 0:   R_A + R_B + Σ F_i = 0
 Σ M_A = 0: R_B (x_B − x_A) + Σ F_i (x_i − x_A) = 0
 ->  R_B = − Σ F_i (x_i − x_A) / (x_B − x_A)        R_A = − Σ F_i − R_B
 resultant bearing load  R = √(R_y² + R_z²)   (input for the bearing life, M4)
```
**In the program:**
```python
def reactions(P):
    """Two bearings A, B (statically determinate). Sum of forces and moments in each plane."""
    xa, xb = P["bearings"]
    out = {}
    for k, idx in (("y", 1), ("z", 2)):
        F = sum(f[idx] for f in P["forces"])
        Mb = sum(f[idx] * (f[0] - xa) for f in P["forces"])   # moments about A
        RB = -Mb / (xb - xa)
        RA = -F - RB
        out[k] = (RA, RB)
    return out
```
**Run it:** `python shaft.py examples` (reactions) and `python shaft.py ch24`
```
## Reactions [N]
- A: y 1342.0, z 796.2 (resultant 1560.4)
- B: y 1342.0, z -159.2 (resultant 1351.4)
```
**Check by hand.** y plane: pin load −2684 N at x = 110, exactly in the middle of A (50) and B (170) → each bearing
takes +1342 N. ✔ z plane: belt −637 N at x = 20, overhang 30 mm in front of A, span 120 mm →
R_B = −(−637)(20 − 50)/120 = **−159.25 N** (B is pulled the other way – the lever effect of the overhang), R_A = 637 + 159.25
= **796.25 N**. ✔ The locating bearing A carries **1560 N**, more than B (1351 N), because of the overhung belt load.
The self-test (`python shaft.py selftest`) checks ΣF = 0 and ΣM = 0 in both planes.

### 4.4 Bending moments, torque, and why the moments add as vectors

**Theory.** The bending moment at x is the moment of all forces to the left of x about the section:
M(x) = Σ_{x_i < x} F_i·(x − x_i). M_y comes from the y forces, M_z from the z forces. They are two vectors at 90°;
the shaft section sees only their **vector sum** (the neutral axis turns to be perpendicular to the resultant):

```
 M_y(x) = Σ F_y,i (x − x_i)        M_z(x) = Σ F_z,i (x − x_i)        M(x) = √(M_y² + M_z²)
 σ_b = M / W_b      τ_t = T / W_t      σ_v = √(σ_b² + 3 τ_t²)   (nominal pre-check, no notch)
 T(x) = T between the torque input (pulley, x = 20) and the output (crank pin, x = 110), 0 outside
```
Adding |M_y| + |M_z| would be wrong (too large); taking only the larger one would be unsafe.

**In the program:**
```python
def internal(P, x):
    """Bending moments My(x) (from y-forces), Mz(x) (from z-forces) [N mm], resultant M, torque T [N mm].
    Moment at x = sum over loads left of x of F (x - xF)."""
    R = reactions(P)
    xa, xb = P["bearings"]
    loads = [(xa, R["y"][0], R["z"][0]), (xb, R["y"][1], R["z"][1])] + [(f[0], f[1], f[2]) for f in P["forces"]]
    My = sum(Fy * (x - xf) for xf, Fy, Fz in loads if xf < x)
    Mz = sum(Fz * (x - xf) for xf, Fy, Fz in loads if xf < x)
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    T = P["T_max_Nm"] * 1000 if t1 <= x <= t2 else 0.0
    return {"My": My, "Mz": Mz, "M": math.hypot(My, Mz), "T": T}
```
The moment table (added for this chapter) samples `internal()` at the important positions:
```python
def moment_table(P=None, xs=(0, 20, 40, 50, 60, 80, 110, 140, 160, 170, 190)):
    """My, Mz, M, T [N m] and the nominal stresses at chosen x positions."""
    P = P or DEFAULT
    out = []
    for x in xs:
        it = internal(P, x)
        D, di = geometry_at(P, x)
        s = section(D, di)
        sb = it["M"] / s["Wb"]
        tt = it["T"] / s["Wt"]
        out.append((x, D, it["My"] / 1000, it["Mz"] / 1000, it["M"] / 1000, it["T"] / 1000, sb, tt,
                    math.sqrt(sb ** 2 + 3 * tt ** 2)))
    return out
```
**Run it:** `python shaft.py ch24`
```
  x    D   My     Mz     M      T      sigma_b tau_t  sigma_v
    0  25   0.00   0.00   0.00   0.00   0.00   0.00   0.00
   20  25   0.00   0.00   0.00  47.80   0.00  15.58  26.99
   40  25   0.00 -12.74  12.74  47.80   8.31  15.58  28.24
   50  30   0.00 -19.11  19.11  47.80   7.21   9.02  17.20
   60  30  13.42 -17.52  22.07  47.80   8.32   9.02  17.70
   80  35  40.26 -14.33  42.74  47.80  10.15   5.68  14.13
  110  35  80.52  -9.55  81.08  47.80  19.26   5.68  21.63
  140  35  40.26  -4.78  40.54   0.00   9.63   0.00   9.63
  160  35  13.42  -1.59  13.51   0.00   3.21   0.00   3.21
  170  30   0.00   0.00   0.00   0.00   0.00   0.00   0.00
  190  25   0.00   0.00   0.00   0.00   0.00   0.00   0.00
```
(Units: x, D mm; moments N·m; stresses MPa. `geometry_at()` takes the left segment at a step, so the stresses at
x = 40 and 60 are for d = 25 and 30 mm – the smaller diameter, which is the critical side of a shoulder.)

**Interpretation.**
- **M_z** (belt plane) grows linearly from the pulley to bearing A (−19.1 N·m = 637 N × 30 mm) and falls linearly to 0
  at B.
- **M_y** (pin plane) is a triangle with the peak **80.5 N·m** at the crank pin (= 1342 N × 60 mm). ✔
- The resultant peak **81.1 N·m at x = 110** is where the crank pin acts; the nominal stresses there are small
  (σ_b 19.3, τ 5.7, σ_v 21.6 MPa) because d = 35 mm.
- The highest **nominal** σ_v is at x = 40 (28.2 MPa): d = 25 mm with full torque – but bending is small there. Which
  section is critical can only be decided with the **notch factors** (chapter 6) and the DIN 743 proof (chapter 7):
  a shoulder with Kt ≈ 2 at low nominal stress can be worse than a plain section at higher stress.
- Torque is 47.8 N·m (peak) from x = 20 to 110 and zero beyond the crank pin: the right part of the shaft (110–190) only
  bends.

**Pre-check with the equivalent stress (added function):**
```python
def equiv_stress(M_Nm, T_Nm, d_mm):
    """Nominal pre-check: sigma_b = M/Wb, tau_t = T/Wt, sigma_v = sqrt(sigma_b^2 + 3 tau_t^2) (MPa)."""
    s = section(d_mm)
    sb, tt = M_Nm * 1000 / s["Wb"], T_Nm * 1000 / s["Wt"]
    return sb, tt, math.sqrt(sb ** 2 + 3 * tt ** 2)
```
```
  pre-check d 35, M 81.1, T 47.8: sigma_b 19.27 tau 5.68 sigma_v 21.63 MPa
```
Compare with the pre-size allowable σ_allow = 60 MPa (2.3): factor ≈ 2.8 margin before notches – again a sign that this
small shaft is stiffness- and bearing-driven.

### 4.5 Real practice – getting the loads into CAD/CAE

- **SOLIDWORKS Motion / Adams** (M1 ch. 7, guide 54): export the bearing reaction forces vs time and compare with
  `reactions()` at the same crank angle (θ = 7°) – they should agree within a few % (differences: shaft flexibility,
  real pin offset).
- **Ansys / SOLIDWORKS Simulation:** apply the forces as remote forces at the real pulley/pin positions, the bearings as
  remote displacements (or bearing connections) at x = 50 / 170. Check the reaction forces of the FE model against
  this chapter before you look at any stress (M1 §7.3: reactions = loads ± 0.5 %).
- **Excel / MATLAB:** `shaft.py run` writes `shaft.csv` with My, Mz, M, T, deflection and slope along x for your own plots.

**MATLAB equivalent (reactions and moments):**
```matlab
F  = [20 0 -637; 110 -2684 0];  xa = 50; xb = 170;            % [x Fy Fz]
for k = 2:3
  RB(k-1) = -sum(F(:,k).*(F(:,1)-xa))/(xb-xa);  RA(k-1) = -sum(F(:,k)) - RB(k-1);
end
L = [xa RA; xb RB; F];                                       % all loads [x Fy Fz]
x = 0:0.5:190;  My = zeros(size(x)); Mz = My;
for i = 1:numel(x), m = L(:,1) < x(i);
  My(i) = sum(L(m,2).*(x(i)-L(m,1)));  Mz(i) = sum(L(m,3).*(x(i)-L(m,1)));  end
M = hypot(My, Mz)/1000;  plot(x, M)                          % N m
```

**Check questions (chapter 4).** 1) Show by hand that bearing B gets −159 N in the belt plane. 2) Why do M_y and M_z
add as √(M_y² + M_z²)? 3) Why is the section with the highest nominal stress not necessarily the critical one?
4) How much stiffness do you lose with a Ø20 bore in a Ø35 shaft, and how much mass do you save?


---

## 5 Stiffness: deflection, slope, twist, critical speed

> Strength (chapter 7) asks *"will it break?"*. Stiffness asks *"will it work?"*: bearings, gears, seals and the
> belt drive only work well when the shaft bends, tilts and twists very little. In many small machines (like our
> compressor) stiffness and bearing size decide the diameters, not strength.
> Program: `deflection()`, `deflection_summary()`, `torsion_angle()`, `critical_speed()` in `shaft.py`, extra results
> `python shaft.py ch56`. All numbers are **example values**.

### 5.1 Theory – the elastic line

Take a short piece dx of the shaft. The bending moment M bends it into a circle with radius ρ. From beam theory
(plane sections stay plane, Hooke's law σ = E·ε, ε = y/ρ):

  σ = E·y/ρ  and  M = ∫ σ·y dA = (E/ρ)·∫ y² dA = E·I/ρ  →  **1/ρ = M/(E·I)**

For small slopes the curvature is 1/ρ ≈ v″ (v = deflection, ′ = d/dx). So:

  **v″(x) = M(x) / (E·I(x))**            (elastic line, Euler–Bernoulli)

Integrate twice:

  slope θ(x) = v′(x) = ∫ M/(E·I) dx + C1  deflection v(x) = ∫ θ dx + C1·x + C0

The two constants come from the bearings: **v(x_A) = 0 and v(x_B) = 0**.

| Symbol | Meaning | Unit |
|---|---|---|
| v | deflection (displacement perpendicular to the axis) | mm |
| θ = v′ | slope (tilt) | rad |
| M | bending moment in the plane | N·mm |
| E | Young's modulus (steel 210 000) | MPa |
| I = π(D⁴ − dᵢ⁴)/64 | second moment of area | mm⁴ |

Two planes: the program solves the y-plane (crank-pin load) and the z-plane (belt) separately and adds them as
vectors: v = √(v_y² + v_z²), θ = √(θ_y² + θ_z²). This is correct because the problem is linear.

### 5.2 Stepped shaft – why numerical integration is exact enough

A real shaft has steps, so I(x) jumps. Hand methods (Mohr's analogy, area-moment) handle each step separately – long
and error-prone. The program integrates M/(E·I) **numerically** with the trapezoid rule on a 0.5 mm grid:

1. curvature k_i = M(x_i) / (E·I(x_i)) at every grid point (I from the local diameter);
2. θ_i = θ_{i−1} + ½(k_i + k_{i−1})·h, v_i = v_{i−1} + ½(θ_i + θ_{i−1})·h, starting with θ = v = 0 at x = 0;
3. this curve is correct except for an unknown **rigid-body line** C1·x + C0 (the constants of integration);
4. add the line that makes v = 0 at both bearings.

Between loads M is linear, so the trapezoid error is only at the jumps of I and is proportional to h. With h = 0.5 mm
the error is below 0.1 % (selftest).

```
 formula box
 v''(x) = M(x) / (E I(x))           integrate twice, v(x_A) = v(x_B) = 0
 uniform beam, central load F:   v_max = F L^3 / (48 E I),  theta_support = F L^2 / (16 E I)
 overhung load F at distance a:  v_tip = F a^2 (L + a) / (3 E I)       (L = bearing span)
```

**In the program** (`shaft.py`):
```python
    n = int(round(length(Q) / Q["step_mm"]))
    xs = [i * Q["step_mm"] for i in range(n + 1)]
    key = "My" if plane == "y" else "Mz"
    k = []
    for x in xs:
        D, di = geometry_at(Q, x)
        k.append(internal(Q, x)[key] / (E * section(D, di)["I"]))   # curvature v''
    th = [0.0]
    v = [0.0]
    for i in range(1, len(xs)):
        h = xs[i] - xs[i - 1]
        th.append(th[-1] + 0.5 * (k[i] + k[i - 1]) * h)
        v.append(v[-1] + 0.5 * (th[i] + th[i - 1]) * h)
    xa, xb = Q["bearings"]
    ...
    # add rigid-body line C1 x + C0 so that v(xa) = v(xb) = 0
    va, vb = at(v, xa), at(v, xb)
    C1 = -(vb - va) / (xb - xa)
    C0 = -va - C1 * xa
    v = [vi + C1 * x + C0 for vi, x in zip(v, xs)]
    th = [ti + C1 for ti in th]
```

**Run it – check against closed forms:** `python shaft.py selftest`
```
uniform beam, central load: v_max = F L^3/(48 E I) (+-0.1 %)   OK   0.019961 vs 0.019961 mm
uniform beam: slope at support = F L^2/(16 E I) (+-0.2 %)      OK
overhung load: tip deflection = F a^2 (L + a)/(3 E I) (+-0.2 %) OK   0.012475 vs 0.012475 mm
```
(Test shaft: d 30 mm, span 200 mm, 1000 N in the middle; and 500 N on a 50 mm overhang.)

**Run it – the compressor shaft:** `python shaft.py ch56`
```
== 5.2 stepped shaft deflection (default compressor shaft)
  max deflection 0.0094 mm at x = 0.0 mm; slope A 0.00017 rad = 0.59 arcmin, B 0.00016 rad = 0.56 arcmin
  deflection at load 'belt': 0.0055 mm
  deflection at load 'crank-pin': 0.0064 mm
```

**Interpretation.**
- The largest deflection (9.4 µm) is at the **free end of the pulley overhang** (x = 0), not between the bearings.
  Overhangs are the weak point of shaft stiffness: v_tip grows with a²(L + a). Keep the pulley close to bearing A.
- Under the crank pin the shaft moves 6.4 µm. Compared with piston clearances (~ 50–100 µm) this is negligible.
- Slopes at the bearings are 0.56–0.59 arcmin – far inside every bearing limit (5.3).
- Remember the model: the real crankshaft has webs and a crank throw. The straight-shaft model gives the **order of
  magnitude** and the bearing slopes; the web/pin region needs FEA (chapter 10).

### 5.3 Slope at the bearings and other stiffness limits

A bearing ring that is tilted against the other ring loads the rolling elements unevenly: edge stress, heat, short
life. Catalogues give a permissible misalignment. **Typical values (check the catalogue of your bearing maker):**

| Bearing type | Permissible misalignment (typical) | In rad |
|---|---|---|
| Deep-groove ball bearing | 2 … 10 arcmin (depends on clearance and load) | 0.0006 … 0.003 |
| Cylindrical roller bearing | 3 … 4 arcmin | ≈ 0.001 |
| Tapered roller bearing | ≈ 2 arcmin | ≈ 0.0006 |
| Needle roller bearing | ≈ 1 … 2 arcmin | 0.0003 … 0.0006 |
| Self-aligning ball / spherical roller | 1.5 … 3 ° (designed to tilt) | 0.03 … 0.05 |
| Plain (sleeve) bearing | edge loading limit: slope × bearing width < oil film (few µm) | from film calculation |

1 arcmin = 1/60 ° = 0.000291 rad. The program converts: slope [arcmin] = degrees(θ)·60.

**Other stiffness limits (rules of thumb – check the relevant standard / supplier):**

| Element | Limit (typical) | Why |
|---|---|---|
| Gear mesh | relative tilt of the two shafts ≤ ≈ 0.01 mm per 100 mm face width; centre-distance change ≤ ≈ 0.1 module | Load across the face (ISO 6336 factor K_Hβ), noise |
| Radial lip seal | dynamic run-out ≤ ≈ 0.1–0.2 mm (depends on speed, check the seal maker) | Lip must follow the shaft |
| Belt pulley | slope small enough that the belt runs true (≈ 0.5 °) | Belt wear |
| Machine-tool spindle | µm level, separate stiffness budget (M1 ch. 21) | Accuracy |
| General transmission shaft | v_max ≤ ≈ 0.0002 … 0.0003 × span | Classic rule (check) |

Our shaft: 0.59 arcmin ≪ 2 arcmin (even the strict tapered-roller value). The input field `slope_limit_rad` (0.001)
is checked in the report.

### 5.4 Torsional twist

A torque T twists a length L of the shaft by

  **φ = T·L / (G·I_p)**, I_p = π(D⁴ − dᵢ⁴)/32 = 2·I  (stepped shaft: φ = Σ T·L_i/(G·I_p,i))

G = E / (2(1 + ν)) ≈ 81 000 MPa for steel.

**In the program:**
```python
def torsion_angle(P):
    """Twist between torque input and output: phi = sum T L / (G Ip)."""
    G = MATERIALS[P["material"]]["G"]
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    n = 400
    phi = 0.0
    h = (t2 - t1) / n
    for i in range(n):
        x = t1 + (i + 0.5) * h
        D, di = geometry_at(P, x)
        phi += P["T_max_Nm"] * 1000 * h / (G * section(D, di)["Ip"])
    return {"phi_rad": phi, "phi_deg": math.degrees(phi), "deg_per_m": math.degrees(phi) / ((t2 - t1) / 1000)}
```
**Run it:** `python shaft.py ch56`
```
== 5.4 twist
  phi 0.00066 rad = 0.0376 deg over the torque-carrying length, 0.418 deg/m
```
**Interpretation.** Limits used in practice: 0.25 °/m for long transmission shafts and machine tools (positioning,
torsional vibration), up to ≈ 0.5–1 °/m for general machinery (check your application). Our 0.418 °/m at the peak
torque 47.8 N·m is fine – the torque-carrying length is only 90 mm, so the absolute twist is 0.038 °.
For a long line shaft (e.g. a conveyor drive 2 m long) the °/m limit decides the diameter (M1 E8: twist was the
active constraint of the optimum shaft).

### 5.5 Critical speed

#### 5.5.1 Jeffcott rotor – why a critical speed exists

Put a disc of mass m in the middle of a massless shaft with bending stiffness k (N/m). The disc centre of mass is at
a small distance e (unbalance) from the shaft axis. At speed ω the shaft bends by r (whirl radius). Centrifugal force
= elastic force:

  m·ω²·(r + e) = k·r  →  **r = e·(ω/ω_n)² / (1 − (ω/ω_n)²)**, **ω_n = √(k/m)**

At ω = ω_n the radius r goes to infinity (in reality limited by damping): **critical speed**. Above ω_n, r becomes
negative – the disc turns its heavy side inwards (self-centring); far above, r → −e.

**Run it:**
```
  Jeffcott e = 10 um, w/wn = 0.5: whirl radius 3.3 um
  Jeffcott e = 10 um, w/wn = 0.7: whirl radius 9.6 um
  Jeffcott e = 10 um, w/wn = 0.9: whirl radius 42.6 um
  Jeffcott e = 10 um, w/wn = 1.2: whirl radius -32.7 um
  Jeffcott e = 10 um, w/wn = 2.0: whirl radius -13.3 um
```
At 0.7·ω_n the whirl is already about equal to the unbalance; at 0.9·ω_n it is 4 × e. **Rule:** run below
≈ 0.7 n_crit (stiff rotor, all our machines) or above ≈ 1.3–1.4 n_crit and pass the resonance quickly with damping
(flexible rotors: turbines, some high-speed spindles).

#### 5.5.2 Rayleigh's energy method (many masses, stepped shaft)

For a vibrating shaft with lumped masses m_i at deflections y_i: maximum kinetic energy = maximum strain energy.
Assume the vibration shape = the **static deflection line under the weights**. Strain energy = work of the weights
= ½·Σ m_i·g·y_i; kinetic energy at the middle position = ½·ω²·Σ m_i·y_i². Equal:

  **ω_crit = √( g·Σ m_i·y_i / Σ m_i·y_i² )**

Because the assumed shape is not exactly the true mode, Rayleigh gives an **upper bound** (slightly too high).

#### 5.5.3 Dunkerley's lower bound

Each mass alone on the massless shaft gives ω_i² = 1/(m_i·a_ii) (a_ii = deflection at i per unit force at i).
Dunkerley: **1/ω² ≈ Σ 1/ω_i² = Σ m_i·a_ii** – a **lower bound**. The truth lies between Dunkerley and Rayleigh.

```
 formula box
 Jeffcott:   w_n = sqrt(k/m),   r = e (w/w_n)^2 / (1 - (w/w_n)^2)
 Rayleigh:   w = sqrt( g sum(m_i y_i) / sum(m_i y_i^2) )      (y_i = static deflection under weights)  -> upper bound
 Dunkerley:  1/w^2 = sum(m_i a_ii)                              (a_ii = influence number, m/N)          -> lower bound
 n = w 60 / (2 pi) [rpm];  rule: n_operation <= 0.7 n_crit
```

**In the program:**
```python
    lumps += [(m_[0], m_[1]) for m_ in P["masses"]]
    forces = [[x, -m * g / 1000.0, 0.0, "w"] for x, m in lumps]   # N (m kg * g m/s2)
    xs, _, v = deflection(P, "y", extra_forces=forces)
    def at(x):
        return v[min(range(len(xs)), key=lambda i: abs(xs[i] - x))]
    ys = [abs(at(x)) for x, _ in lumps]
    num = sum(m * y for (x, m), y in zip(lumps, ys))
    den = sum(m * y * y for (x, m), y in zip(lumps, ys))
    w = math.sqrt(g * num / den)                   # rad/s (y in mm, g in mm/s2)
    n_crit = w * 60 / (2 * math.pi)
    # Dunkerley: 1/w^2 = sum 1/w_i^2 with each mass alone
    inv = 0.0
    for x, m in lumps:
        xs1, _, v1 = deflection(P, "y", extra_forces=[[x, -1.0, 0.0, "unit"]])
        a = abs(v1[min(range(len(xs1)), key=lambda i: abs(xs1[i] - x))])     # mm per N
        inv += m * a * 1e-3                       # kg * m/N
    w_d = math.sqrt(1 / inv)
```
The shaft itself is lumped as one mass per segment (at the segment centre); attached masses (pulley, flywheel, gear)
come from the input list `masses`.

**Run it:** `python shaft.py ch56`
```
== 5.5 critical speed
  compressor shaft: Rayleigh 87806 rpm, Dunkerley 76564 rpm, mass 4.270 kg, ratio to 1450 rpm 60.6
  slender shaft L 800, d 30, disc 25 kg mid-span: Rayleigh 1557 rpm, Dunkerley 1557 rpm, 0.7 n_crit = 1090 rpm, mass 29.44 kg
```
**Interpretation.**
- Compressor shaft: 76 600 … 87 800 rpm against 1450 rpm – a factor of 50–60. Bending resonance of this short, thick
  shaft is no problem (but see 5.5.4 – bearings and the crankcase are softer than the shaft).
- **Slender example** (new function `slender_example()`): an 800 mm long Ø30 shaft with a 25 kg disc in the middle
  (e.g. a fan or a long conveyor roll drive). n_crit = 1557 rpm, so the shaft must not run faster than ≈ 1090 rpm.
  Driven directly by a 1450 rpm motor it would run at 0.93·n_crit – whirl ≈ 6 × unbalance, loud and dangerous.
  Fix: larger diameter (with a dominant disc n_crit ∝ √k and k ∝ d⁴, so n_crit ∝ d²: Ø40 instead of Ø30 gives
  ≈ 1.8 × n_crit), shorter span, or a bearing near the disc.
- Here Rayleigh = Dunkerley because one mass (the disc) dominates. With several similar masses they differ more
  (compressor: 13 %).

#### 5.5.4 Caveats – bearing stiffness, gyroscopic effect, housing

The calculation assumes **rigid bearings**. Real rolling bearings are springs (typical radial stiffness of a small
ball bearing ≈ 10⁴–10⁵ N/mm, roller bearings higher – check maker data), and the housing is also elastic. Shaft and
bearings act as **springs in series**: k_total = 1/(1/k_shaft + 1/k_bearing). New function
`critical_speed_kb(P, k_b)` adds the bearing displacements R/k_b as a rigid-body line to the weight-deflection curve
(Rayleigh again):

**Run it:**
```
  slender shaft with bearing stiffness 1e+06 N/mm: n_crit 1557 rpm
  slender shaft with bearing stiffness 2e+05 N/mm: n_crit 1556 rpm
  slender shaft with bearing stiffness 5e+04 N/mm: n_crit 1551 rpm
  slender shaft with bearing stiffness 2e+04 N/mm: n_crit 1542 rpm
  compressor shaft with bearing stiffness 2e+05 N/mm: n_crit 47980 rpm
  compressor shaft with bearing stiffness 5e+04 N/mm: n_crit 27475 rpm
```
**Interpretation.** For the **slender** shaft the bearings hardly matter (the shaft is the soft spring). For the
**short stiff compressor shaft** the bearings dominate: n_crit falls from 87 800 to 27 500 rpm when k_b = 5·10⁴ N/mm.
Still ≫ 1450 rpm, but the lesson is general: **for stiff shafts the bearings and the housing set the critical speed.**
Machine-tool spindles are designed this way (bearing pre-load raises k_b).

Other effects not in the model: gyroscopic moments of discs (raise or lower the critical speed with forward/backward
whirl – matters for overhung discs at high speed), shear deformation of short thick shafts, damping. For those use a
rotor-dynamics FEA (Ansys Mechanical rotordynamics with Campbell diagram, Adams, or MATLAB) – chapter 10.

### 5.6 Torsional vibration of the drive train

The crankshaft gets a strongly pulsating torque (M2 ch. 7: 1st order 24.2 Hz, 2nd order 48.3 Hz at 1450 rpm; in the
V90 the 2nd order cancels, but 1st, 3rd, 4th remain). Motor rotor, belt and flywheel form a torsional spring–mass
system. Simplest model – **two inertias joined by the belt**, everything reduced to the crankshaft speed:

- J1 = J_motor·i² (motor rotor seen from the crank, i = 2.02, M2 ch. 7);
- J2 = J_flywheel + J_crank (flywheel pulley + crank train, example 0.059 + 0.003 kg·m²);
- belt span stiffness k_s = n·E·A / L_span (n belts, E·A per belt from the maker); with pre-tension both spans carry
  load changes, so the torsional stiffness at the crank pulley (radius r) is k_t = 2·k_s·r².

  **f = (1/2π)·√( k_t·(J1 + J2) / (J1·J2) )**

**Run it:**
```
  torsional: J1 (motor at crank) 0.0224, J2 0.0620 kg m2, belt span k 5.000e+05 N/m, k_t 22500 N m/rad -> f 186.0 Hz (orders 24.2 / 48.3 Hz, f / 2nd order = 3.8)
  same with one soft belt (EA 1e4 N): k_t 1125 N m/rad -> f 41.6 Hz (f / 2nd order 0.86)
```
**Interpretation.** With two normal V-belts (example E·A = 10⁵ N per belt, span 400 mm) the torsional mode is at
186 Hz – far above the strong low orders. With one very soft belt it falls to 41.6 Hz, close to the 2nd order
(48.3 Hz): belt flutter, slip, noise. **Check the belt E·A with the maker** and keep the torsional frequency away
from the 1st–4th torque orders (± 20 % is a common margin – check). The belt also slips (non-linear) – a real
measurement (strobe, accelerometer on the belt span) is the final proof.

### 5.7 Real manufacturing / practice
- **Overhang short:** pulley hub against the bearing shoulder; a spacer instead of a long free shaft end.
- **Bearing seats in one set-up** (turn or grind between centres) so the two seats are coaxial – misalignment from
  machining (e.g. 0.01 mm over 120 mm = 0.29 arcmin) adds to the deflection slope.
- **Housing bores line-bored** in one clamping (HMC, guide 12); bore coaxiality tolerance on the crankcase drawing.
- **Measure:** shaft run-out between centres (dial gauge, µm), and in the assembled machine the vibration (ISO 10816 /
  20816) – a resonance shows as a peak that moves with speed.
- **Balancing** reduces e (5.5.1) – ISO 21940-11 (M2 ch. 8).

### 5.8 MATLAB equivalent
```matlab
% stepped shaft, one plane: M(x) given as vector Mx at grid xs (N mm), I(x) in mm^4
k  = Mx ./ (E .* Ix);                       % curvature
th = cumtrapz(xs, k);  v = cumtrapz(xs, th);
va = interp1(xs, v, xa); vb = interp1(xs, v, xb);
C1 = -(vb - va)/(xb - xa); C0 = -va - C1*xa;
v  = v + C1*xs + C0;  th = th + C1;        % deflection and slope
% Rayleigh: masses m (kg) at positions xm, y = static deflection under weights (mm)
w  = sqrt(9810*sum(m.*y)/sum(m.*y.^2));  n_crit = w*60/(2*pi);
```

### 5.9 Check questions
1. Why is the largest deflection of the compressor shaft at the pulley end and not between the bearings?
2. Convert the bearing slope 0.00017 rad to arcmin. Which bearing type would still be OK at 0.001 rad?
3. Explain with the Jeffcott formula why a shaft must not run at 0.9·n_crit.
4. Why does bearing stiffness change the critical speed of the compressor shaft so much more than that of the slender shaft?
5. Which torque orders of the V90 compressor could excite the belt drive, and what do you check with the belt maker?

---

## 6 Notches and stress concentration

> Shafts almost never break in the smooth middle. They break at **notches**: shoulders, grooves, keyways, press-fit
> edges, cross holes. This chapter explains how big the local stress is and how to make it smaller – the most
> effective (and cheapest) way to make a shaft stronger. Program: `kt_shoulder()`, `support_n()`, `notch_betas()`.

### 6.1 Theory – stress concentration factor K_t

At a change of section the stress lines crowd together. The peak elastic stress at the notch root is

  **σ_max = K_t · σ_nom**  (σ_nom = M/W or T/W_t on the smaller diameter d)

K_t (theoretical / elastic stress concentration factor) depends only on **geometry** (D/d, r/d, notch shape) and on
the load type (bending, torsion, tension). It is found by elasticity theory, photo-elasticity or FEA and is published
in charts (Peterson's *Stress Concentration Factors*, Pilkey & Pilkey, 3rd ed.).

### 6.2 Shoulder fillet – Peterson charts and curve fits

The program uses curve fits **K_t = A·(r/d)^b** of Peterson's charts for stepped round shafts, with A and b tabulated
for several D/d (as given by R. L. Norton, *Machine Design*), linear interpolation in D/d.

**In the program:**
```python
def kt_shoulder(D, d, r, load="bending"):
    """Stress concentration factor of a shoulder fillet, curve fits Kt = A (r/d)^b of Peterson's charts
    (coefficients as tabulated by R. L. Norton, Machine Design). Linear interpolation in D/d."""
    tab = _KT_BEND if load == "bending" else _KT_TORS
    q = D / d
    keys = sorted(tab)
    if q <= keys[0]:
        A, b = tab[keys[0]]
    elif q >= keys[-1]:
        A, b = tab[keys[-1]]
    else:
        k1 = max(k for k in keys if k <= q)
        k2 = min(k for k in keys if k >= q)
        t = 0 if k2 == k1 else (q - k1) / (k2 - k1)
        A = tab[k1][0] + t * (tab[k2][0] - tab[k1][0])
        b = tab[k1][1] + t * (tab[k2][1] - tab[k1][1])
    return max(1.0, A * (r / d) ** b)
```
**Run it:** `python shaft.py examples`
```
## Kt of the shoulder fillet D/d = 30/25 vs radius
  r 0.4 mm: Kt bending 2.391, torsion 2.042
  r 0.6 mm: Kt bending 2.189, torsion 1.871
  r 1.0 mm: Kt bending 1.958, torsion 1.675
  r 1.6 mm: Kt bending 1.768, torsion 1.513
  r 2.5 mm: Kt bending 1.604, torsion 1.373
```
**Interpretation.** Going from r = 0.4 to 2.5 mm lowers K_t in bending from 2.39 to 1.60 (−33 %). The fits are valid
for r/d ≈ 0.01–0.3 (outside, check the chart). Torsion K_t is lower than bending K_t for the same notch.

### 6.3 Why the real notch is weaker than K_t – stress gradient and support number

A fatigue crack needs a small **volume** of highly stressed material, not just one point. At a sharp notch the stress
falls very quickly below the surface (steep gradient), so only a tiny volume sees σ_max – the neighbouring, less
stressed grains "support" it (micro-support, Neuber, Siebel). Measure of steepness: **relative stress gradient**

  **G′ = (1/σ_max)·|dσ/dy|** at the notch root [1/mm]

For a shoulder fillet (DIN 743-2 approximation): G′ = 2.3·(1 + φ)/r (bending), G′ = 1.15/r (torsion), with
φ = 1/(4·√(t/r) + 2), t = (D − d)/2 (φ = 0 when t/d > 0.25). Smaller r → larger G′.

The **support number** n raises the endurance of the notched part:

  **n = 1 + √(G′·mm) · 10^−(0.33 + R_e(d)/712 MPa)**  (DIN 743-2 form)

and the **fatigue notch factor** is **β = K_t / n** (≤ K_t). Strong steels (high R_e) have less support – they are
more notch-sensitive. (This is the same physics as Peterson's q in M1 ch. 25, with a different formula.)

```
 formula box
 sigma_max = Kt sigma_nom                (elastic peak)
 G' = 2.3 (1 + phi)/r  (bending)   G' = 1.15/r  (torsion)   phi = 1/(4 sqrt(t/r) + 2)
 n  = 1 + sqrt(G' mm) 10^-(0.33 + Re(d)/712)
 beta = Kt / n                         (used in the fatigue proof, chapter 7)
```

**In the program:**
```python
def support_n(G1, Re_d):
    """Support number from the relative stress gradient G' [1/mm]: n = 1 + sqrt(G' mm) 10^-(0.33 + Re(d)/712)."""
    return 1 + math.sqrt(max(G1, 0.0)) * 10 ** -(0.33 + Re_d / 712.0)
```
and in `notch_betas()` for a shoulder:
```python
        D, d, r = prm["D"], prm["d"], prm["r"]
        ktb, ktt = kt_shoulder(D, d, r, "bending"), kt_shoulder(D, d, r, "torsion")
        t = (D - d) / 2
        phi = 1 / (4 * math.sqrt(t / r) + 2) if t / d <= 0.25 else 0.0
        nb = support_n(2.3 * (1 + phi) / r, Re_d)
        nt = support_n(1.15 / r, Re_d)
        ...
        return ktb / nb, ktt / nt, {"Kt_b": ktb, "Kt_t": ktt, "n_b": nb, "n_t": nt}
```
**Run it:** `python shaft.py ch56` (new function `radius_table()`, default shaft, C45+QT, x = 40 mm)
```
== 6.2 Kt of the shoulder 30/25 versus radius (bending)
  r     Kt_b   n_b    beta_s K_sigma sADK   S_fat
  0.4  2.391  1.259  1.899  2.166   132.7  8.44
  0.6  2.189  1.213  1.804  2.063   138.3  8.88
  1.0  1.958  1.167  1.679  1.926   146.4  9.52
  1.6  1.768  1.133  1.560  1.797   155.0  10.20
  2.5  1.604  1.108  1.448  1.676   164.0  10.91
```
**Interpretation.**
- K_t falls by 33 % (0.4 → 2.5 mm), but n also falls (1.26 → 1.11) because the gradient gets flatter. So β falls only
  by 24 % (1.90 → 1.45): **the support effect partly hides the benefit of a large radius.** This is why using K_t
  directly (no support) is conservative and why β is used in DIN 743.
- The part endurance limit σ_ADK rises from 132.7 to 164.0 MPa (+24 %) and the fatigue safety from 8.44 to 10.91.
  K_σ also contains the size factor K2 and the roughness factor KF (chapter 7).
- Our compressor shaft has very high safety at every radius (it is sized by stiffness and bearing bore). For a heavier
  drive see 6.8.

### 6.4 Notch types on shafts

| Notch | Typical β (bending) | Why | Remedy |
|---|---|---|---|
| Shoulder fillet | 1.3 … 2.5 (from K_t, n) | Section change | Large r, relief groove (DIN 509), elliptical fillet |
| Retaining-ring groove | 2.5 … 4 | Sharp groove bottom | Put it where M is low; use a shoulder or a nut instead |
| Keyway, end-milled (sled-runner = disc-milled is milder) | ≈ 1.8 … 2.6 (DIN 743 form 3.0·(R_m/1000)^0.38) | Sharp ends of the groove, plus hub edge | Disc-milled keyway, key away from max M, splines/press fit |
| Press-fit edge | ≈ 2 … 2.7 (DIN 743 form 2.7·(R_m/1000)^0.43) | Pressure peak at the hub edge + **fretting** (micro-slip, oxide, early cracks) | Stress-relief groove, raised seat (d_seat ≥ 1.05 d), rounded hub edge, rolling |
| Cross (oil) hole | K_t ≈ 2.4 … 2.8 (6.6) | Hole edge | Chamfer + polish the edge, place at low stress, roll/peen |
| Thread | ≈ 2.5 … 4 | Thread root | Rolled threads, run-out groove |

The keyway and press-fit formulas are those programmed in `notch_betas()` (reference diameter 40 mm); they are
DIN 743-2 type relations – **check the exact form and size correction in DIN 743-2 (2012)**.

**Why the press fit is a notch even without a groove:** the hub is stiff at its end, the shaft is soft – contact
pressure peaks at the hub edge (often 2–3 × the mean pressure). The rotating bending makes the shaft surface slide by
a few µm against the hub → **fretting fatigue**. Typical failures: crack just inside the hub edge of a pulley or
a bearing inner ring.

### 6.5 Shoulder geometry rules for the drawing
- Fillet radius as large as the mating part allows: bearing seats need r_shaft ≤ the chamfer r_s,min of the bearing
  ring (catalogue). If the bearing chamfer is small, use a **relief groove** (6.7) or a spacer ring with a big chamfer.
- Avoid D/d > 1.5 at one step: use two steps.
- Keep notches away from the section of maximum bending moment (look at `moments.svg`).
- Write the radius **with tolerance** on the drawing (e.g. R1 ±0.2, or "R1 min") and check it with a radius gauge – a
  machinist who leaves a sharp corner (r ≈ 0.2 mm) raises K_t from ≈ 2 to ≈ 3.

### 6.6 Cross holes – oil holes in crankshafts

Crankshafts with plain bearings have oil bores from the main journal to the crank pin. The bore exit is a notch exactly
where the load is high. New function (polynomial fit of Peterson data, bending, nominal stress on the gross section –
**check Peterson / Pilkey before use**):

  K_t ≈ 3.0 − 3.13·(a/D) + 3.66·(a/D)² − 1.53·(a/D)³

**Run it:**
```
== 6.6 cross hole (oil hole) in bending, D = 35 mm
  a  3 mm (a/D 0.086): Kt 2.758
  a  5 mm (a/D 0.143): Kt 2.623
  a  7 mm (a/D 0.200): Kt 2.508
  a 10 mm (a/D 0.286): Kt 2.369
```
**Interpretation.** A small hole has K_t ≈ 2.8 (the classic 3 for a hole in a wide plate). Practice: place the oil
hole exit **at the neutral side** of the crank pin load (≈ 90° from the main load direction), chamfer and polish the
edge (removes machining marks, the real crack starters), and – on highly loaded crankshafts – roll or shot-peen it.
Our VC20 uses rolling bearings and splash lubrication, so it has no oil bores – a design advantage for fatigue.

### 6.7 Relief grooves (undercuts) DIN 509

A relief groove (form E: one face; form F: shoulder face and cylinder both ground) lets the grinding wheel run out and
the bearing ring sit flat against the shoulder, while keeping a **defined radius** in the groove.

**Run it (typical sizes, check DIN 509 for the exact table and tolerances):**
```
== 6.7 DIN 509 relief grooves (typical r x t, check DIN 509)
  r 0.6 x t 0.2  d <= 18 (light)
  r 0.6 x t 0.3  > 18 ... 80
  r 1.0 x t 0.2  d <= 18
  r 1.0 x t 0.4  > 18 ... 80
  r 1.6 x t 0.3  > 18 ... 80
  r 2.5 x t 0.4  > 80
  r 4.0 x t 0.5  > 80
```
Drawing: "Undercut DIN 509-F1×0.4" (or the current designation in the standard). In the strength proof treat it as a
shoulder/groove with the groove radius r and depth t; under high load prefer the larger radius (1.6 × 0.3 instead of
1.0 × 0.4 at d 30).

### 6.8 Design improvements with numbers

For the default compressor all safeties are high, so the improvements show better on a heavier drive. New function
`slender_stress_case()`: the same 30/25 shoulder with all loads × 6 (e.g. a larger compressor with the same shaft),
without and with a surface strengthening factor K_V = 1.3 (fillet **rolling** or **shot peening** – typical K_V for
rolled fillets 1.2–1.5 on steel, check DIN 743-2 table):

**Run it:**
```
== 6.8 heavier drive (loads x 6): S_fatigue at the 30/25 shoulder without / with KV = 1.3 (rolled)
  r 0.4: S 1.41 -> 1.87
  r 1.0: S 1.59 -> 2.12
  r 2.5: S 1.82 -> 2.45
```
**Interpretation.** With 6 × load the sharp fillet (r 0.4) has S = 1.41 – just above S_min = 1.2. Two cheap
measures: a larger radius (r 2.5 → S 1.82, +29 %) and rolling (+33 %). Together S rises from 1.41 to 2.45 (+74 %) with
**no extra material and no larger diameter**. In `din743_point_kv()` K_V enters as K_σ = (β/K2 + 1/KF − 1)/K_V:

```python
    Ks = (pt["beta_s"] / k2 + 1 / pt["KFs"] - 1) / KV
    Kt = (pt["beta_t"] / k2 + 1 / pt["KFt"] - 1) / KV
    sbWK = 0.5 * mat["Rm"] * k1 / Ks
    ttWK = 0.3 * mat["Rm"] * k1 / Kt
```

Ranked list of measures (most effect per cost first – typical):
1. Larger fillet radius, relief groove with defined radius – almost free.
2. Notch out of the maximum moment (move the shoulder, the keyway, the groove).
3. Better surface at the notch (grind/polish: Rz 6.3 → 1.6 raises KF a few %; removes tool marks).
4. Rolling or shot peening of fillets (K_V 1.2–1.5); induction hardening of seats/pins (K_V up to ≈ 1.5–2.5 for
   notched parts, check DIN 743-2).
5. Raised press-fit seat + stress-relief groove next to the hub edge.
6. Only then: larger diameter or stronger steel (stronger steel is more notch-sensitive, so the gain is smaller than R_m
   suggests).

### 6.9 Real manufacturing / practice
- **Turning:** a form insert with the exact radius (e.g. r 1.0 insert for R1) – do not rely on the default nose radius
  0.4/0.8 mm. Write the radius on the CAM tool list (NX CAM tool library).
- **Grinding:** dress the wheel corner to the radius; F-undercut lets you grind seat and face in one plunge.
- **Inspection:** radius gauges or an optical profile projector / contour measurement on first articles; surface Rz in
  the fillet with a stylus instrument; crack test (magnetic particle) on crankshafts after hardening/rolling.
- **Heat treatment:** induction-hardened zones must end **away** from fillets (or run through them) – a hardness
  transition in a fillet is a new notch with tensile residual stress.
- **Keyways:** specify disc-milled (sled runner) where possible; break the edges (0.2–0.3 × 45°).

### 6.10 MATLAB equivalent
```matlab
Kt = @(A,b,r,d) max(1, A*(r/d)^b);                    % Peterson fit, A,b for the D/d of your step
Gb = @(r,t) 2.3*(1 + 1/(4*sqrt(t/r)+2))/r;            % stress gradient, bending, shoulder
n  = @(G,Re) 1 + sqrt(G)*10^(-(0.33 + Re/712));       % support number
r = 1.0; d = 25; D = 30; t = (D-d)/2; Re_d = 0.95*490; % K1(25) = 0.95, C45+QT
beta = Kt(0.95120,-0.23757,r,d)/n(Gb(r,t),Re_d)        % compare with beta_s 1.68 in the report (D/d 1.2 interpolated)
```
(The program interpolates A, b between D/d = 1.1 and 1.2; the MATLAB line uses the D/d = 1.1 pair only as an example.)

### 6.11 Check questions
1. What is the difference between K_t and β? Why is β smaller?
2. Why does a large fillet radius help less than the drop of K_t suggests (use the radius table)?
3. Why is a press-fit edge a notch even when the shaft is perfectly smooth?
4. Where would you place an oil hole in a crank pin, and how would you finish its edge?
5. Name three ways to raise the fatigue safety of a shoulder without changing the diameter, with the numbers from 6.8.


---

## 7 Strength proof in the style of DIN 743

> Program: `din743_point()`, `K1()`, `K2()`, `KF()`, `support_n()`, `notch_betas()`, `strength()` in `tools/shaft.py`;
> extra results `python shaft.py ch711`. All inputs are **example values**. The factor formulas follow the published
> structure of DIN 743; every constant marked "check DIN 743" must be compared with DIN 743-1…-4 (2012) before you sign
> a design report.

### 7.1 What DIN 743 is and how it is built

DIN 743 "Calculation of load capacity of shafts and axles" is the German standard method for the **strength proof of
round shafts** made of steel. It is used across Europe for gearboxes, compressors, pumps and machine tools. It has four
parts:

| Part | Content |
|---|---|
| DIN 743-1 | General: the proof format, safety S ≥ S_min = 1.2, static proof and fatigue proof, load cases, combination of stresses |
| DIN 743-2 | Notch factors and size factors: β for shoulders, grooves, keyways, press fits, splines, cross holes; K1, K2, KF, KV; support number n from the stress gradient |
| DIN 743-3 | Material data: tensile strength, yield strength and fatigue limits of common shaft steels at a reference diameter d_B (16 mm for most steels) |
| DIN 743-4 | Fatigue strength for finite life and variable amplitude (Miner, damage-equivalent stress) |

The proof is done **at every notch** (shoulder, groove, keyway, press fit, thread, cross hole) and at the place of the
largest nominal stress. You need **two proofs**:

1. **Static proof** – against yielding (plastic deformation) under the highest load that can occur (start, fault, blocked
   compressor). Safety S_static ≥ 1.2.
2. **Fatigue proof** – against fatigue cracks under the repeated load. Safety S_fatigue ≥ 1.2.

Why only 1.2? Because the DIN 743 material values and factors are already **conservative** (they include the 97.5 %
survival level of the material data and lower-bound notch factors). The real safety against the mean failure load is
much higher. If your loads are uncertain (no measurement, no load spectrum), use S_min = 1.5 … 2 – the program input
`"S_min"` lets you do that.

The program follows the DIN 743 structure but makes simplifications (one combined load case, simple static notch factor,
typical constants). It is a **design tool and a teaching tool** – for a certified report use the full standard or a
commercial program that implements it (KISSsoft, MDESIGN, eAssistant offline versions – see M1 chapter 9).

### 7.2 Static proof

**Theory.** The shaft must not yield at the maximum load. Yield starts at the notch root, but a ductile steel can carry
more load than "first yield" because the plastic zone is small and supported by elastic material around it (plastic
support). DIN 743 therefore uses the yield strength **increased** by two factors:

- **K2F** – static support factor of the section shape. For a solid round shaft in bending K2F = 1.2, in torsion 1.2, in
  tension 1.0 (a fully plastic round section carries 1.70 × the first-yield bending moment, DIN takes a safe 1.2).
- **γF** – static notch increase factor (notches support each other under static load; 1.0 … 1.15 depending on β). The
  program uses a simple γF = 1.1 for every notch and 1.0 for a plain section (check DIN 743-1 table for your notch).

Yield strength of the real diameter: σ_S(d) = K1(d) · σ_S(d_B) (technological size factor K1, see 7.4).

```
 Permissible static stresses
   σ_bFK = K1(d) · K2F · γF · σ_S(d_B)                 bending
   τ_tFK = K1(d) · K2F · γF · σ_S(d_B) / √3            torsion (von Mises: τ_yield = σ_yield / √3)
 Static safety (bending + torsion together)
   S_static = 1 / √( (σ_b,max / σ_bFK)² + (τ_t,max / τ_tFK)² )   ≥ S_min = 1.2
   σ_b,max = LF · M / W_b ,  τ_t,max = LF · T_max / W_t    (LF = static load factor, peak / nominal)
```

The square-root form is the von Mises interaction: when both stresses are at their limit alone, the combined safety is
1/√2 of the single ones.

**In the program** – the static part of `din743_point()`:

```python
    # static: peak values x load factor
    LF = P["load_factor_static"]
    sbmax = LF * Mnom / sec["Wb"]
    ttmax = LF * (P["T_max_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0)
    gF = 1.0 if ntype == "plain" else 1.1                  # static notch increase factor (simplified)
    K2F = 1.2
    sbFK = k1 * K2F * gF * mat["Re"]
    ttFK = k1 * K2F * gF * mat["Re"] / math.sqrt(3)
    S_s = 1 / math.sqrt((sbmax / sbFK) ** 2 + (ttmax / ttFK) ** 2) if (sbmax or ttmax) else float("inf")
```

**Example (critical shoulder x = 40 mm, d = 25 mm, C45+QT, example values):** K1(25) = 0.950, σ_S(d_B) = 490 MPa →
σ_bFK = 0.950 · 1.2 · 1.1 · 490 = 614 MPa. The nominal bending amplitude there is 8.31 MPa and the torsion 9.84 + 5.74 MPa
(amplitude + mean); with LF = 1.5 the program gives **S_static = 14.50** (`python shaft.py ch711`, first line).

### 7.3 Fatigue proof – the chain of factors

**Theory in one sentence:** start from the fatigue limit of a small, polished, unnotched specimen; reduce it for size,
notch, roughness and surface condition; reduce it again for the mean stress; compare with the stress amplitude.

```
 specimen limit σ_bW(d_B)          (material table, DIN 743-3)
   × K1(d)                          technological size (bigger blank = weaker core)
   ÷ K_σ                            notch + geometric size + roughness + surface treatment
 = σ_bWK                            fatigue limit of THIS notch (fully reversed, σ_m = 0)
   ÷ (1 + ψ_σK · σ_mv/σ_ba)         mean stress
 = σ_bADK                           permissible amplitude
 S = σ_bADK / σ_ba  (and the same for torsion; combined with the square-root rule)
```

### 7.4 Specimen fatigue limits and the size factors K1, K2

**Specimen limits.** When DIN 743-3 has no value for your steel, it allows the approximations

```
 σ_bW(d_B) ≈ 0.5 · R_m(d_B)        rotating bending
 σ_zdW(d_B) ≈ 0.4 · R_m(d_B)       tension–compression
 τ_tW(d_B) ≈ 0.3 · R_m(d_B)        torsion
```

For C45+QT (R_m = 700 MPa at d_B = 16 mm, example value from the material table): σ_bW = 350 MPa, τ_tW = 210 MPa.

**K1 – technological size factor.** A thick bar cannot be hardened through, and forged or rolled bars of large diameter
have a coarser grain. So R_m, R_e and the fatigue limit fall with the diameter of the **raw part** at heat treatment.
For quenched-and-tempered steels the program uses

```
 K1(d) = 1                          d ≤ d_B = 16 mm
 K1(d) = 1 − 0.26 · lg(d / d_B)     16 < d ≤ 300 mm        (form as in DIN 743-2 – check the table there)
```

Use the **heat-treatment diameter** (raw part), not the finished diameter: a crankshaft forged at Ø 45 and machined to
Ø 25 has the strength of Ø 45. In the program d is the notch diameter – for a conservative design enter the raw diameter
in a separate run.

**K2 – geometric size factor.** Fatigue depends on the stress gradient: a large shaft has a larger volume of highly
stressed material, so the probability of a weak spot is higher (statistical size effect). For bending and torsion

```
 K2(d) = 1 − 0.2 · lg(d / 7.5 mm) / lg 20      7.5 ≤ d < 150 mm ;   K2 = 0.8 for d ≥ 150 mm ;  tension: K2 = 1
```

**In the program:**

```python
def K1(d, mat):
    """Technological size factor (strength of the blank falls with size). Reference dB = 16 mm.
    QT / case: K1 = 1 - 0.26 lg(d/dB) for 16 < d <= 300 (form as in DIN 743-2; check the table there)."""
    if d <= 16:
        return 1.0
    return max(0.5, 1 - 0.26 * math.log10(d / 16.0))

def K2(d):
    """Geometric size factor (fatigue): 1 - 0.2 lg(d/7.5)/lg 20 for 7.5 <= d < 150, 0.8 above."""
    if d <= 7.5:
        return 1.0
    if d >= 150:
        return 0.8
    return 1 - 0.2 * math.log10(d / 7.5) / math.log10(20)
```

**Run it:** `python shaft.py examples` (last block)
```
## DIN 743 factors for C45+QT
  d  16: K1 1.000  K2 0.949  KF(Rz 6.3) 0.904 / 0.945
  d  25: K1 0.950  K2 0.920  KF(Rz 6.3) 0.908 / 0.947
  d  40: K1 0.897  K2 0.888  KF(Rz 6.3) 0.913 / 0.950
  d  80: K1 0.818  K2 0.842  KF(Rz 6.3) 0.920 / 0.954
  d 160: K1 0.740  K2 0.800  KF(Rz 6.3) 0.927 / 0.958
```
**Interpretation.** From Ø 16 to Ø 160 the material strength (K1) falls by 26 % and the fatigue size effect (K2) adds
another 16 %. This is why you cannot take a fatigue limit from a 10 mm test bar and use it for a 100 mm shaft.

### 7.5 Roughness factor KF and surface-treatment factor KV

**KF.** A rough surface has micro-notches at which cracks start. The effect grows with the strength of the steel (strong
steels are more notch-sensitive):

```
 K_Fσ = 1 − 0.22 · lg(R_z / µm) · ( lg(R_m(d) / 20 MPa) − 1 )
 K_Fτ = 0.575 · K_Fσ + 0.425
```

```python
def KF(Rz, Rm):
    """Surface roughness factor: KF_sigma = 1 - 0.22 lg(Rz/um) (lg(Rm/20 MPa) - 1); KF_tau = 0.575 KF_sigma + 0.425."""
    ks = 1 - 0.22 * math.log10(max(Rz, 1.0)) * (math.log10(Rm / 20.0) - 1)
    return ks, 0.575 * ks + 0.425
```

Typical R_z by process (example values): fine turning 6.3 … 10 µm, grinding 1.6 … 3.2 µm, fine grinding / superfinishing
0.4 … 1 µm, rough turning 25 µm.

**KV – surface treatment (surface strengthening).** Treatments that create **compressive residual stress** and a hard
layer raise the fatigue strength. DIN 743-2 gives KV ranges; typical values (check DIN 743-2 table – depend on diameter,
notch and treatment depth):

| Treatment | KV unnotched | KV notched | Note |
|---|---|---|---|
| None | 1.0 | 1.0 | – |
| Nitriding (gas, plasma), layer 0.1–0.4 mm | 1.10 … 1.15 | 1.3 … 2.0 | Good for crankshafts, small distortion |
| Induction hardening / flame hardening | 1.2 … 1.5 | 1.5 … 2.5 | Hardened zone must cover the fillet |
| Case hardening (carburising) | 1.1 … 1.5 | 1.2 … 2.0 | 16MnCr5, 18CrNiMo7-6 |
| Fillet rolling / deep rolling | 1.2 … 1.4 | 1.5 … 2.2 | Cheapest big gain for crank-pin fillets |
| Shot peening | 1.1 … 1.25 | 1.1 … 1.5 | Fillets, springs, conrods |

The program sets KV = 1.0 (no treatment) – conservative. Chapter 7.11 shows the effect of KV = 1.3 on the crank-pin fillet.

### 7.6 Notch factor β and the support number n

**Theory.** A notch raises the **elastic** stress at its root by the stress concentration factor K_t (= α_σ in DIN
notation, chapter 6). In fatigue the real effect is smaller, because the stress falls quickly away from the notch root
(steep gradient) and the material "supports" the peak. DIN 743 expresses this with the **support number n** that depends
on the **relative stress gradient** G′:

```
 β_σ = K_tσ / n_σ        β_τ = K_tτ / n_τ
 n = 1 + √(G′ · mm) · 10^−(0.33 + σ_S(d) / 712 MPa)
 shoulder fillet:  G′_bending = 2.3 · (1 + φ) / r ,   G′_torsion = 1.15 / r
                   φ = 1 / (4 · √(t / r) + 2) ,  t = (D − d)/2   (φ = 0 if t/d > 0.25)
```

High-strength steels have a large σ_S → small n → **less support**. A sharp radius gives a large G′ → more support, but
K_t grows faster – so a larger radius is always better.

For keyways and press fits DIN 743-2 gives β **directly** from test data (reference diameter 40 mm; the program does not
apply the small size correction to d – check DIN 743-2):

```
 keyway (end-milled):  β_σ = 3.0 · (R_m(d)/1000 MPa)^0.38 ,  β_τ = 0.56 · β_σ + 0.1
 press fit (hub edge): β_σ = 2.7 · (R_m(d)/1000 MPa)^0.43 ,  β_τ = 0.65 · β_σ
```

**In the program** (`notch_betas()`, the shoulder and keyway branches):

```python
    if ntype == "shoulder" or ntype == "groove":
        D, d, r = prm["D"], prm["d"], prm["r"]
        ktb, ktt = kt_shoulder(D, d, r, "bending"), kt_shoulder(D, d, r, "torsion")
        t = (D - d) / 2
        phi = 1 / (4 * math.sqrt(t / r) + 2) if t / d <= 0.25 else 0.0
        nb = support_n(2.3 * (1 + phi) / r, Re_d)
        nt = support_n(1.15 / r, Re_d)
        if ntype == "groove":
            ktb, ktt = ktb * 1.3, ktt * 1.3          # rough: a groove is sharper than a shoulder (check DIN 743-2)
        return ktb / nb, ktt / nt, {"Kt_b": ktb, "Kt_t": ktt, "n_b": nb, "n_t": nt}
    if ntype == "keyway":
        bs = 3.0 * (Rm_d / 1000) ** 0.38
        return bs, 0.56 * bs + 0.1, {}
    if ntype == "pressfit":
        bs = 2.7 * (Rm_d / 1000) ** 0.43
        return bs, 0.65 * bs, {}
```

**Run it:** `python shaft.py ch711` (lines 1–2)
```
== 7 critical notch: x 40.0 mm shoulder d 25: K1 0.950 K2 0.920 KFs 0.908 beta_s 1.679 K_sigma 1.926 sbWK 172.5 psi_s 0.1491 sADK 146.4 tADK 111.4 sba 8.31 tta 9.84 ttm 5.74 -> S_fat 9.52, S_stat 14.50
   Kt_b 1.958 n_b 1.167 Kt_t 1.675 n_t 1.111
```
At the shoulder Ø 30 / Ø 25, r = 1 mm: K_t = 1.958 in bending, the support number is 1.167, so β_σ = 1.958 / 1.167 = 1.679.
The material "takes back" about 14 % of the elastic peak.

### 7.7 Total influence factor K_σ and the notch fatigue limit

```
 K_σ = ( β_σ / K2(d) + 1 / K_Fσ − 1 ) · 1 / K_V         (the same with τ for torsion)
 σ_bWK = σ_bW(d_B) · K1(d) / K_σ          τ_tWK = τ_tW(d_B) · K1(d) / K_τ
```

Why "+ 1/K_F − 1"? Roughness and notch do not simply multiply: at a polished notch (K_F = 1) only β counts, at a rough
plain section (β = 1) only roughness counts. The additive form fits the test data.

```python
    k2 = K2(d)
    kfs, kft = KF(prm.get("Rz", 6.3), Rm_d)
    KV = 1.0
    Ks = (bs / k2 + 1 / kfs - 1) / KV
    Kt = (bt / k2 + 1 / kft - 1) / KV
    sbWK = sbW * k1 / Ks
    ttWK = ttW * k1 / Kt
```

Check by hand at x = 40: K_σ = 1.679 / 0.920 + 1 / 0.908 − 1 = 1.825 + 1.101 − 1 = **1.926**;
σ_bWK = 350 · 0.950 / 1.926 = **172.6 MPa** (program 172.5 – rounding of the factors).

### 7.8 Mean stress: ψ and the permissible amplitude

**Theory.** A tensile mean stress lowers the amplitude the part can carry (Haigh diagram, M1 chapter 26). DIN 743 uses a
straight line from σ_WK (at σ_m = 0) towards the tensile strength. Its slope is the **mean-stress sensitivity**

```
 ψ_σK = σ_bWK / (2 · K1(d) · R_m(d_B) − σ_bWK)        ψ_τK = τ_tWK / (2 · K1(d) · R_m(d_B) − τ_tWK)
```

Mean stresses of bending, tension and torsion are combined into one **equivalent mean stress** (von Mises):

```
 σ_mv = √( (σ_zdm + σ_bm)² + 3 · τ_tm² )        τ_mv = σ_mv / √3
```

**Load case "σ_mv / σ_a = const"** (DIN 743 case 2 – the usual one for a running machine: when the load grows, mean and
amplitude grow together):

```
 σ_bADK = σ_bWK / (1 + ψ_σK · σ_mv / σ_ba)          τ_tADK = τ_tWK / (1 + ψ_τK · τ_mv / τ_ta)
```

For a **rotating shaft with constant load direction** (our compressor), the bending is fully reversed: σ_ba = M/W_b,
σ_bm = 0. The torque has a mean and an amplitude (from the M2 torque curve: T_m = 17.6, T_a = 30.2 N·m, example values).

```python
    psi_s = sbWK / (2 * k1 * mat["Rm"] - sbWK)
    psi_t = ttWK / (2 * k1 * mat["Rm"] - ttWK)
    it = internal(P, x)
    Mnom = it["M"]                                          # N mm (with the peak pin load)
    sba = Mnom / sec["Wb"] if P["bending_rotating"] else 0.0
    sbm = 0.0 if P["bending_rotating"] else Mnom / sec["Wb"]
    t1, t2 = sorted((P["torque_in_x"], P["torque_out_x"]))
    carries_T = t1 <= x <= t2
    tta = P["T_amp_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0
    ttm = P["T_mean_Nm"] * 1000 / sec["Wt"] if carries_T else 0.0
    smv = math.sqrt(sbm ** 2 + 3 * ttm ** 2)
    tmv = smv / math.sqrt(3)
    sADK = sbWK / (1 + psi_s * smv / sba) if sba > 0 else sbWK
    tADK = ttWK / (1 + psi_t * tmv / tta) if tta > 0 else ttWK
```

At x = 40: ψ_σK = 172.5 / (2 · 0.950 · 700 − 172.5) = 0.149; σ_mv = √3 · 5.74 = 9.94 MPa; σ_bADK = 172.5 / (1 + 0.149 ·
9.94 / 8.31) = **146.4 MPa**. Note: a pure torsion mean stress lowers the **bending** permissible amplitude too – this is
the von Mises combination.

### 7.9 Combined fatigue safety

```
 S_fatigue = 1 / √( (σ_ba / σ_bADK)² + (τ_ta / τ_tADK)² )       ≥ S_min = 1.2
 (with tension: (σ_zda/σ_zdADK + σ_ba/σ_bADK)² inside the root – normal stresses add linearly)
```

```python
    S_f = 1 / math.sqrt((sba / sADK) ** 2 + (tta / tADK) ** 2) if (sba or tta) else float("inf")
```

At x = 40: S = 1 / √((8.31/146.4)² + (9.84/111.4)²) = 1 / √(0.00322 + 0.00780) = **9.52**.

### 7.10 Full table for the compressor shaft

**Run it:** `python shaft.py examples` (strength block)
```
## Strength (DIN 743 style, S_min 1.20)
x[mm] type      d   M[Nm]  sba   tta   beta_s K_sig  sADK   S_fat  S_stat
 40.0 shoulder   25   12.7   8.3   9.8   1.68  1.93  146.4   9.52  14.50 OK
 60.0 shoulder   30   22.1   8.3   5.7   1.77  2.04  145.1  12.98  22.64 OK
 20.0 keyway     25    0.0   0.0   9.8   2.57  2.89  114.8  11.10  15.17 OK
 50.0 pressfit   30   19.1   7.2   5.7   2.24  2.53  118.1  12.60  23.29 OK
160.0 shoulder   30   13.5   5.1   0.0   1.77  2.04  159.0  31.20  78.57 OK
110.0 plain      35   81.1  19.3   3.6   1.00  1.17  258.6  12.81  16.52 OK
```

**Interpretation.**
- All safeties are 9–31 – far above 1.2. **This is normal for small compressor shafts.** Their diameters are set by
  other requirements: the **bearing bore** (a 6205/6206 bearing needs Ø 25/30), the **stiffness** (slope at the
  bearings, chapter 5), the **pulley hub and key**, handling and machining (a Ø 15 shaft would whip during turning). Strength
  is rarely the limit below about 5 kW.
- The **keyway** has the highest β (2.57) but carries only torque there (no bending at the pulley centre) – S = 11.1.
- The weakest place is the **first shoulder** (x = 40, Ø 25 → Ø 30) where bending from the belt and torque meet.
- The highest bending moment (81 N·m at the crank pin) sits on the thickest section (Ø 35), so S is 12.8 there.
- **But:** this is a straight-beam model of a crankshaft. The real weak spot of a crankshaft is the **web-to-pin fillet**,
  see 7.11.

### 7.11 Sensitivity study – what really changes the safety

**In the program** (new function, chapter 7 additions):

```python
def sensitivity_study(x=40.0):
    """Fatigue safety at the shoulder x = 40 mm (D/d 30/25, r 1.0) for material, roughness and load level."""
    base = dict(DEFAULT)
    n = [k for k in base["notches"] if abs(k[0] - x) < 1e-9][0]
    rows = []
    for mat in ("C45+N", "C45+QT", "42CrMo4+QT"):
        for Rz in (1.6, 6.3, 25.0):
            for lf in (1, 2, 3):
                P = dict(base, material=mat,
                         forces=[[f[0], f[1] * lf, f[2] * lf, f[3]] for f in base["forces"]],
                         T_mean_Nm=base["T_mean_Nm"] * lf, T_amp_Nm=base["T_amp_Nm"] * lf, T_max_Nm=base["T_max_Nm"] * lf)
                prm = dict(n[2], Rz=Rz)
                s = din743_point(P, x, n[1], prm)
                rows.append((mat, Rz, lf, s["S_fatigue"], s["S_static"], s["K_sigma"], s["sADK"]))
    return rows
```

**Run it:** `python shaft.py ch711` (extract)
```
   C45+N       Rz  6.3 x1 : S_fat   8.94  S_stat  10.06  K_sig 1.774  sADK  138.7
   C45+QT      Rz  1.6 x1 : S_fat   9.78  S_stat  14.50  K_sig 1.849  sADK  151.4
   C45+QT      Rz  6.3 x1 : S_fat   9.52  S_stat  14.50  K_sig 1.926  sADK  146.4
   C45+QT      Rz 25.0 x1 : S_fat   9.25  S_stat  14.50  K_sig 2.016  sADK  141.0
   C45+QT      Rz  6.3 x3 : S_fat   3.17  S_stat   4.83  K_sig 1.926  sADK  146.4
   42CrMo4+QT  Rz  6.3 x1 : S_fat  13.72  S_stat  26.64  K_sig 2.178  sADK  207.6
   42CrMo4+QT  Rz 25.0 x1 : S_fat  13.19  S_stat  26.64  K_sig 2.317  sADK  196.9
```

**Lessons.**
1. **Load** acts linearly: 3 × load → 1/3 of the safety. Knowing the real load (M2, measurement) matters more than any
   factor.
2. **Material:** 42CrMo4+QT gives +44 % fatigue safety over C45+QT – but its K_σ is **higher** (2.178 vs 1.926): strong
   steel is more notch- and roughness-sensitive. Expensive steel with a sharp radius and a rough surface wastes money.
3. **Roughness** from Rz 25 to Rz 1.6 changes S by only ±3 % here (low-strength steel, small d). For 42CrMo4 the effect is
   larger (K_σ 2.317 → 2.067).
4. C45+N (normalised) has a lower yield (340 MPa) – the static safety falls more (10.06) than the fatigue safety.

### 7.12 Comparison with the M1 method (Shigley / Marin) and with FKM

The same section calculated three ways (`shigley_compare()`, `fkm_compare()`):

**Run it:** `python shaft.py ch711`
```
== 7 M1 Shigley/Marin at x = 40: q 0.848 Kf_b 1.813 Kf_t 1.572 sa_eq 30.75 sm_eq 15.62 Se 199.0 -> n_f 5.65 (DIN 743 style S 9.52)
== 7 FKM local (bending) at x = 40: local amplitude 16.27 MPa, sigma_AK 309.0 MPa, utilisation a_BK 0.079 (j_D 1.5) -> equivalent safety 19.00, n_sigma 1.221
```

| Method | Result | Why different |
|---|---|---|
| M1 Shigley / Marin + Goodman (99 % reliability, von Mises equivalent) | n_f = 5.65 | 99 % reliability factor 0.814, Peterson q, Goodman line to R_m, torsion included as √3·K_f·τ – the most conservative |
| DIN 743 style (this chapter) | S = 9.52 | Support number from gradient, K1/K2 size laws, separate bending + torsion limits, square-root combination |
| FKM local, **bending only** | equivalent 19.0 | Local stress approach with its own support law; torsion is **not** included in this simple call – do not compare directly |

**Rule:** use **one** method consistently in a company, calibrated with test results (M1 chapter 7). Never pick the method
that gives the nicest number.

### 7.13 Crankshaft specifics – where the straight-beam model is not enough

A crankshaft is **not** a straight shaft. The crank pin is offset by r = 23 mm and connected by two **webs**. Force flow:
pin → web (bending + shear) → main journal. The critical places are:

| Place | Why critical | Typical K_t (check FEA) |
|---|---|---|
| Crank-pin to web fillet | Pin bending + web bending meet; small radius for short length | 2.5 … 4 |
| Main-journal to web fillet | Torsion + bending | 2 … 3 |
| Oil hole exit on the pin surface | Hole in a bending/torsion field | 2.5 … 3.5 (round the edge, polish) |
| Keyway / taper at the pulley end | Torque + belt bending | DIN 743 keyway β |

The program estimates the web fillet with the straight-beam moment at the pin (x = 110 mm) on the pin diameter Ø 30 and an
assumed K_t (`web_fillet_check()`):

```python
def web_fillet_check(Kt, r=1.5, d=30.0, Rz=1.6, KV=1.0, M_scale=1.0):
    P = dict(DEFAULT)
    mat = MATERIALS[P["material"]]
    M = internal(P, 110.0)["M"] * M_scale
    sba = M / section(d)["Wb"]
    k1 = K1(d, mat)
    n = support_n(2.3 / r, k1 * mat["Re"])
    beta = Kt / n
    kfs, _ = KF(Rz, k1 * mat["Rm"])
    Ks = (beta / K2(d) + 1 / kfs - 1) / KV
    sWK = 0.5 * mat["Rm"] * k1 / Ks
    return {"Kt": Kt, "KV": KV, "sba": sba, "beta": beta, "K_sigma": Ks, "sWK": sWK, "S": sWK / sba}
```

**Run it:** `python shaft.py ch711`
```
   Kt 2.5 KV 1.0: sba 30.59 MPa beta 2.207 K_sigma 2.455 sWK 132.4 -> S 4.33
   Kt 3.0 KV 1.0: sba 30.59 MPa beta 2.648 K_sigma 2.942 sWK 110.5 -> S 3.61
   Kt 4.0 KV 1.0: sba 30.59 MPa beta 3.531 K_sigma 3.914 sWK 83.1 -> S 2.72
   Kt 4.0 KV 1.3: sba 30.59 MPa beta 3.531 K_sigma 3.011 sWK 108.0 -> S 3.53
   worst case Kt 4, moment x3 (webs, real crank geometry, fault): S 0.91
```

**Interpretation.**
- The safety falls from 12.8 (plain Ø 35, straight beam) to **2.7 … 4.3** at a web fillet – a factor of 3 to 5.
- If the real web bending moment is 3 × the straight-beam value (short pin, thin webs, fault load) and K_t = 4, the safety
  is **0.91 – failure**. This is how crankshafts break in practice: a fatigue crack starting at the pin fillet and running
  diagonally through the web.
- **Countermeasures** (all common in compressor and engine crankshafts): large fillet radius (r ≥ 0.05 d, undercut into the
  web so the bearing width is kept), **fillet rolling** (KV 1.3 shown: +30 %; published gains 30 … 80 % – check with the
  supplier), **nitriding** or **induction hardening** of pin and fillet, ductile iron EN-GJS-700-2 only with rolling,
  oil-hole edges rounded and polished.
- **Required next step for the real part:** a solid **FEA of the crankshaft** (Ansys / Abaqus) with the bearing forces of
  M2 at several crank angles, then the fatigue proof with the FEA stresses (FKM local approach, M1 chapter 26) – chapter 10.

### 7.14 Manufacturing link
- Write on the drawing what the calculation assumed: material + heat treatment (e.g. "C45+QT, 220–260 HB"),
  fillet radius **with tolerance** (e.g. R1 +0.2/0, "no undercut steps, no tool marks"), R_z / R_a of every fillet and seat.
- A fillet that comes out R0.5 instead of R1 raises K_t from 1.96 to about 2.28 (chapter 6 table) – check fillet radii in
  the first-article inspection with radius gauges or a contour scan (chapter 9).
- Rolled or nitrided fillets: the treatment specification (rolling force, depth of the compressed layer, nitriding depth
  and surface hardness) is part of the calculation – no treatment, no KV.

### 7.15 MATLAB equivalent
```matlab
K1 = @(d) (d<=16) + (d>16).*max(0.5, 1-0.26*log10(d/16));
K2 = @(d) min(1, max(0.8, 1-0.2*log10(d/7.5)/log10(20)));
KF = @(Rz,Rm) 1-0.22*log10(max(Rz,1))*(log10(Rm/20)-1);
d=25; Rm=700; Re=490; Kt=1.958; r=1; t=2.5; phi=1/(4*sqrt(t/r)+2);
n  = 1+sqrt(2.3*(1+phi)/r)*10^-(0.33+K1(d)*Re/712);
Ks = (Kt/n/K2(d) + 1/KF(6.3,K1(d)*Rm) - 1);
sWK = 0.5*Rm*K1(d)/Ks      % expect about 172.5 MPa
```

### 7.16 Check questions
1. Why does DIN 743 accept S_min = 1.2 while many textbooks use 1.5–2?
2. Your crankshaft is forged at Ø 50 and machined to Ø 30. Which diameter do you use for K1, and which for K2?
3. Explain in words why 42CrMo4 has a higher K_σ than C45 at the same notch.
4. A torsion mean stress lowers the permissible **bending** amplitude. Which formula causes this?
5. The plain Ø 35 section has S = 12.8. Why can the real crankshaft still break there?

---

## 8 Shaft–hub connections

> Program: `KEYS`, `key_size()`, `key_check()`, `press_fit()`, `press_fit_design()`, new `fit_interference()`,
> `press_fit_fix()`. Example values.

### 8.1 Overview – how torque goes from the shaft into the hub

| Connection | Principle | Torque capacity | Typical use |
|---|---|---|---|
| Feather key (DIN 6885) | Form fit: key flanks press on shaft groove and hub groove | Medium; limited by surface pressure | Pulleys, couplings, gears on one-direction drives |
| Interference fit (DIN 7190) | Friction from radial pressure | High, no notch from a groove, but press-fit β | Gears, bearing rings, crank webs (built crankshafts) |
| Spline (DIN 5480, ISO 4156) | Form fit, many teeth | High; axial sliding possible | Gearboxes, sliding hubs |
| Polygon profile (P3G, P4C) | Form fit, smooth contour | High, low notch | Machine tools, servo hubs |
| Clamping set / locking assembly | Friction from tapered rings and screws | High, adjustable, removable | Heavy pulleys, flywheels, positioning |
| Taper + key / taper lock bush | Friction (+ form) | Medium–high, easy to remove | Pulley hubs ("Taper-Lock") |

### 8.2 Feather key – forces and the two checks

**Theory.** The torque T is carried by the key flank at the radius ≈ d/2. Circumferential force F_t = 2 T / d. This force
acts on:
- the **hub groove flank** – contact height h − t1 (part of the key above the shaft) → **surface pressure** p,
- the **shaft groove flank** – contact height t1 (usually less critical because the shaft is steel),
- the **key cross-section** b × l → **shear** τ.

Load-bearing length of a round-ended (form A) key: l_tr = l − b. With an application factor K_A (shocks, M2 start
torque):

```
 p   = 2 · T · K_A / ( d · (h − t1) · l_tr )      ≤ p_allow (weakest of hub / key / shaft material)
 τ   = 2 · T · K_A / ( d · b · l_tr )
 l_min = 2 · T · K_A / ( d · (h − t1) · p_allow ) + b
```

**In the program:**

```python
def key_check(k):
    """Feather key, simple method (DIN 6892 method C idea): flank pressure p = 2 T K_A / (d (h - t1) l_tr),
    l_tr = l - b (round ends), shear tau = 2 T K_A / (d b l_tr). Hub material decides p_allow."""
    s = key_size(k["d"])
    ltr = k["l"] - s["b"]
    T = k["T_Nm"] * 1000 * k["K_A"]
    p = 2 * T / (k["d"] * (s["h"] - s["t1"]) * ltr)
    tau = 2 * T / (k["d"] * s["b"] * ltr)
    pa = P_ALLOW[k["hub"]]
    l_min = 2 * T / (k["d"] * (s["h"] - s["t1"]) * pa) + s["b"]
    return {**s, "l_tr": ltr, "p": p, "p_allow": pa, "S_p": pa / p, "tau": tau, "l_min": l_min}
```

The key dimensions come from the table `KEYS` (DIN 6885-1, common values – check the standard for your size):

| d over … up to [mm] | 17–22 | 22–30 | 30–38 | 38–44 | 44–50 | 50–58 |
|---|---|---|---|---|---|---|
| b × h | 6 × 6 | 8 × 7 | 10 × 8 | 12 × 8 | 14 × 9 | 16 × 10 |
| t1 (shaft groove) | 3.5 | 4.0 | 5.0 | 5.0 | 5.5 | 6.0 |

**Run it:** `python shaft.py ch711`
```
== 8 key d 25: b 8 h 7 t1 4.0 l_tr 24 p 66.4 tau 24.9 S_p 1.36 l_min 25.7
   hub steel     p_allow 150 -> S_p 2.26, l_min 18.6 mm
   hub cast iron p_allow 90 -> S_p 1.36, l_min 25.7 mm
   hub aluminium p_allow 60 -> S_p 0.90, l_min 34.6 mm
```
Hand check: T·K_A = 47.8 · 1.25 = 59.75 N·m; p = 2 · 59 750 / (25 · 3 · 24) = **66.4 MPa**.

**Interpretation.**
- Shear τ = 24.9 MPa is tiny (a C45 key carries ≈ 200 MPa). **Keys fail by flank pressure, wear and fretting, not by
  shear.** The hub groove widens, the key starts to move, the fit loosens and the key works itself out.
- With a **grey-iron pulley** (p_allow ≈ 90 MPa, example value) the 32 mm key has S = 1.36 – acceptable. An **aluminium**
  pulley would need l ≥ 34.6 mm or a steel bush.
- p_allow values are typical static values (check DIN 6892 and your hub material). For **alternating torque** (our
  compressor torque reverses: T_min = −12.6 N·m!) the key rocks in its groove – use a tight key fit (P9 in shaft and hub)
  or an interference fit + key, otherwise fretting.

**DIN 6892 methods** (outline): **A** = FEA / test; **B** = calculation with load-distribution factors (torsion and bending
stiffness of shaft and hub, load peak at the hub entry, fatigue check of the key groove); **C** = simple average pressure
(what the program does). Method C is fine for one-direction drives with large safety; use method B for reversing,
shock-loaded or long keys (l > 1.3 d – the load concentrates at the torque entry side).

### 8.3 Interference fit – Lamé theory

**Derivation (thick cylinders).** For a long cylinder with radial stress σ_r and tangential stress σ_t, equilibrium of a
small ring element gives dσ_r/dr + (σ_r − σ_t)/r = 0. With Hooke's law and compatibility the solution is

```
 σ_r = A − B / r² ,   σ_t = A + B / r²          (Lamé)
```

Boundary conditions for the **hub** (inner radius d/2, outer D_A/2): σ_r(d/2) = −p, σ_r(D_A/2) = 0 →

```
 σ_t,hub(bore) = p · (1 + Q_A²)/(1 − Q_A²) ,   Q_A = d / D_A          (tension, the critical stress)
 σ_t,shaft     = −p · (1 + Q_I²)/(1 − Q_I²) ,  Q_I = d_i / d            (compression; solid shaft: −p)
```

The radial displacements of hub bore (+) and shaft surface (−) must add up to the interference: u_hub − u_shaft = U/2.
From Hooke's law (plane stress) this gives

```
 ξ = U_eff / d = p · ( K_A / E_A + K_I / E_I )
 K_A = (1 + Q_A²)/(1 − Q_A²) + ν_A          K_I = (1 + Q_I²)/(1 − Q_I²) − ν_I
 p   = ξ / ( K_A / E_A + K_I / E_I )
```

**Smoothing.** The measured interference U (from the diameters) is larger than the effective one, because the roughness
peaks are flattened during assembly. Classic rule: U_eff = U − 0.8 · (R_z,shaft + R_z,hub). DIN 7190-1:2017 uses a
smaller loss (0.4 · R_z per part – check the standard). The program uses the classic, conservative rule.

**Torque and axial force** (friction coefficient μ on the area π d l):

```
 T  = π/2 · d² · l · p · μ          F_ax = π · d · l · p · μ
 Hub check at U_max:  σ_v,bore ≈ 2 p / (1 − Q_A²) ≤ R_e,hub / S   (fully elastic design)
 Press-in force:  F_press = π · d · l · p_max · μ_press   (μ_press ≈ 0.07–0.1 oiled steel – check)
 Shrink temperature (hub heated):  ΔT = (U_max + s_assembly) / (α_A · d),  s_assembly ≈ 0.001 d
```

**In the program:**

```python
def press_fit(f, U_um):
    d = f["d"]
    Ue = max(0.0, U_um - 0.8 * (f["Rz_shaft"] + f["Rz_hub"])) / 1000.0     # mm
    QA, QI = d / f["D_hub"], f["di_shaft"] / d
    KA = (1 + QA ** 2) / (1 - QA ** 2) + f["nu"]
    KI = (1 + QI ** 2) / (1 - QI ** 2) - f["nu"]
    p = (Ue / d) / (KA / f["E_hub"] + KI / f["E_shaft"])
    T = math.pi / 2 * d ** 2 * f["l"] * p * f["mu"] / 1000.0               # N m
    Fax = math.pi * d * f["l"] * p * f["mu"]                                # N
    s_hub = p * (1 + QA ** 2) / (1 - QA ** 2)                               # tangential stress at hub bore
    sv_hub = 2 * p / (1 - QA ** 2)                                          # von Mises at the hub bore (approx.)
    return {"U_eff_um": Ue * 1000, "p": p, "T_Nm": T, "F_ax_N": Fax, "sigma_t_hub": s_hub, "sv_hub": sv_hub,
            "S_hub": f["Re_hub"] / sv_hub if sv_hub else float("inf")}
```

### 8.4 Example – the default fit fails, and the fix

**Run it:** `python shaft.py examples` (interference block)
```
## Interference fit d 30, hub 55, l 16 mm
- U_min 18 um -> U_eff 10.4, p 25.6 MPa, T 69.4 N m (slip safety 0.97 vs 71.7 N m)
- U_max 48 um -> p 99.3 MPa, hub von Mises 282.8 MPa (S 2.12); shrink: heat hub by 236 K
```

**Two findings:**
1. **Slip safety 0.97 < 1** at the smallest interference: the worst-case assembly (largest bore, smallest shaft) slips at
   the design torque 71.7 N·m (= 1.5 × T_max). Note how much the smoothing costs: 18 − 0.8 · (3.2 + 6.3) = 10.4 µm – **42 %
   of the interference is lost in the roughness**.
2. **Shrink temperature 236 K** – the hub must be heated to ≈ 260 °C. Acceptable for a plain steel hub, **not** if the hub
   carries a bearing, seal or rubber element (≤ 120 °C typical), and it can temper a hardened hub.

**The fix – search fits, length and finish** (`press_fit_fix()`, ISO 286 deviations for 24 < d ≤ 30, check the table):

```python
def press_fit_fix(T_req=71.7, S_slip=1.5, dT_max=200.0, mu_press=0.08):
    base = dict(DEFAULT["pressfit"])
    rows = []
    for fit in ("p6", "r6", "s6", "u6"):
        Umin, Umax = fit_interference(fit)
        for l in (16, 20, 25, 30):
            for Rz_s in (3.2, 1.6):
                f = dict(base, l=l, Rz_shaft=Rz_s, U_min_um=Umin, U_max_um=Umax)
                lo, hi = press_fit(f, Umin), press_fit(f, Umax)
                dT = (Umax / 1000 + 0.001 * f["d"]) / (f["alpha_hub"] * f["d"])
                F_press = math.pi * f["d"] * l * hi["p"] * mu_press
                ok = lo["T_Nm"] / T_req >= S_slip and hi["S_hub"] >= 1.2
                rows.append({"fit": "H7/" + fit, "l": l, "Rz_shaft": Rz_s, "U": (Umin, Umax), "S_slip": lo["T_Nm"] / T_req,
                             "S_hub": hi["S_hub"], "dT": dT, "F_press_kN": F_press / 1000, "ok": ok,
                             "shrink_ok": dT <= dT_max})
    good = [r for r in rows if r["ok"]]
    best = min(good, key=lambda r: (r["l"], r["U"][1])) if good else None
    return rows, best
```

**Run it:** `python shaft.py ch711` (extract)
```
   H7/p6  l 30 Rz_s 1.6 U  1..35 um: S_slip 0.00 S_hub 2.99 dT 197 K F_press 16.0 kN -
   H7/r6  l 30 Rz_s 1.6 U  7..41 um: S_slip 0.12 S_hub 2.47 dT 215 K F_press 19.3 kN -
   H7/s6  l 30 Rz_s 1.6 U 14..48 um: S_slip 1.34 S_hub 2.06 dT 236 K F_press 23.2 kN -
   H7/u6  l 16 Rz_s 1.6 U 27..61 um: S_slip 1.92 S_hub 1.57 dT 276 K F_press 16.2 kN OK
   H7/u6  l 30 Rz_s 1.6 U 27..61 um: S_slip 3.61 S_hub 1.57 dT 276 K F_press 30.4 kN OK
   chosen: H7/u6 l 16 Rz_shaft 3.2 U (27, 61) S_slip 1.81 S_hub 1.61 dT 276 K F_press 15.8 kN
```

**Interpretation.**
- **H7/p6 and H7/r6 cannot transmit torque reliably** at Ø 30: U_min = 1 and 7 µm – the roughness eats everything. They
  are **locating fits** (bearing rings, bushes), not torque fits.
- H7/s6 needs l = 30 mm **and** a ground shaft (Rz 1.6) and still reaches only S_slip 1.34.
- **H7/u6, l = 16 mm** works: S_slip 1.81, hub S 1.61. Its shrink temperature 276 K is too high for heating → **press it
  in** (15.8 kN, a small hydraulic press; oil the parts, use a lead-in chamfer 15° on the hub bore) or **cool the shaft**
  (liquid nitrogen −196 °C gives ΔT ≈ 216 K, with α ≈ 8·10⁻⁶ /K at low temperature – check), or combine heating the hub to
  150 °C with cooling the shaft.
- Alternative: keep H7/s6 and add a key, or use a **clamping set** (catalogue torque, removable).

### 8.5 Practice: fretting, fit edges and assembly
- At the **hub edge** the shaft surface slips a few µm under rotating bending → **fretting corrosion** (red-brown powder)
  and fatigue cracks just inside the hub edge. That is why DIN 743 gives β ≈ 2.2 … 2.6 for press fits. Remedies: hub edge
  relief groove or tapered hub end, slightly larger shaft diameter under the hub (+5 … 10 %) with a fillet to the free
  shaft, rolled shaft seat.
- **Measure** every bore and shaft of a press fit (2-point and 3-point, 2 planes) – the calculation is only valid if the
  actual U is inside U_min … U_max.
- **Press-in record:** force–displacement curve; a too-low force means too little interference (reject).

### 8.6 Splines, polygon profiles, clamping sets, tapers (overview)

**Involute spline (DIN 5480 / ISO 4156).** Many teeth share the torque; check the flank pressure

```
 p = 2 · T · K_A / ( d_m · z · h_w · l_tr · φ )       φ ≈ 0.75 load-share factor (not all teeth carry – check DIN 5466)
```

d_m mean diameter, z number of teeth, h_w working tooth height. Splines allow axial sliding (gear shifting) and carry 3–5 ×
the torque of a key of the same length. Manufacturing: hobbing, shaping, broaching (hub), rolling (shaft).

**Polygon profiles (P3G, P4C, DIN 32711/32712 – check).** Smooth, self-centring, very low notch effect, good for reversing
torque; need CNC grinding or turning with polygon attachment.

**Clamping sets (locking assemblies).** Tapered rings pressed by screws create the radial pressure. Torque from the maker's
catalogue (it depends on screw torque, hub outer diameter and tolerances h8/H8 typical). Removable, adjustable angle – good
for flywheels and heavy pulleys on the compressor.

**Tapers (1:10, 1:5) and Taper-Lock bushes.** A pulled-on taper creates pressure without shrinking; easy to dismantle with a
puller thread. The standard solution for V-belt pulleys in industry.

### 8.7 MATLAB equivalent
```matlab
d=30; DA=55; l=16; mu=0.12; E=210000; nu=0.3;
U = 27e-3 - 0.8*(3.2+6.3)*1e-3;           % H7/u6 U_min after smoothing [mm]
QA = d/DA; KA = (1+QA^2)/(1-QA^2)+nu; KI = 1-nu;
p = (U/d)/(KA/E + KI/E);
T = pi/2*d^2*l*p*mu/1000                   % expect about 129.5 N m  (S_slip 1.81 x 71.7)
```

### 8.8 Check questions
1. Why does a key fail by flank pressure and fretting rather than by shear?
2. Our compressor torque goes negative (T_min = −12.6 N·m). What does this mean for the key fit?
3. Explain why H7/r6 at Ø 30 cannot transmit torque in the worst case.
4. What limits the shrink temperature, and what can you do instead?
5. Where does a fatigue crack start in a press-fitted shaft, and how do you prevent it?

---

## 9 Manufacturing and inspection of the shaft

### 9.1 Process route (crankshaft / compressor shaft, example)

| Op | Process | Result / achievable | Note |
|---|---|---|---|
| 10 | Saw bar or forge blank (drop forging for crankshafts) | Forging tolerance ISO 8062 / EN 10243-1 | Forging gives grain flow along the webs – better fatigue |
| 20 | Quench & temper (C45+QT, 42CrMo4+QT) – if not supplied QT | 220–260 HB (C45), 280–320 HB (42CrMo4), example | Raw diameter decides K1 |
| 30 | Face, centre drill (DIN 332 form A/R) | Centre holes = datum for all further ops | Protect the centres (form R with protecting chamfer) |
| 40 | Rough turn (allowance 1–1.5 mm on Ø) | IT11–IT12, Rz 25 | Stress relief anneal 550–600 °C if distortion matters |
| 50 | Finish turn / turn-mill, mill keyway, drill oil holes | IT8–IT9, Rz 6.3–10, fillet R by form insert | Fillets by form tool – never by a pointed tool |
| 60 | Induction harden pins / journals (if specified) | 50–58 HRC, depth 1–2.5 mm (example) | The hardened zone must run through the fillet or stop well before it – never end in the fillet |
| 70 | Fillet rolling (if specified) | Compressive residual stress | Before final grinding of the journal, rolling force per spec |
| 80 | Grind bearing seats, pins, journals (between centres) | IT5–IT6, Rz 1.6–3.2, roundness 2–5 µm | Coolant, sharp wheel – avoid grinding burn |
| 90 | Nital etch inspection of ground surfaces (ISO 14104) | No burn indications | Grinding burn = local tempering / re-hardening + tensile residual stress |
| 100 | Magnetic particle inspection (MPI, ISO 9934) | No cracks | Especially fillets and oil holes |
| 110 | Balance (ISO 21940-11, M2 chapter 8) | U ≤ U_per | Drill / mill counterweights |
| 120 | Final inspection, corrosion protection, marking | | Serial number, heat number (traceability) |

### 9.2 Drawing specifications that come from the calculation

| Characteristic | Example spec | From |
|---|---|---|
| Material + heat treatment | C45+QT, 220–260 HB; or 42CrMo4+QT 280–320 HB | Ch. 7 (K1, R_m, R_e) |
| Surface hardening | Pins induction hardened 52 ± 4 HRC, Eht 1.5 +1 mm (DIN EN 10328 – check), fillets included | KV |
| Fillet radii | R1 +0.2/0, tangent, no step; crank-pin fillet R2.5 rolled | K_t, β |
| Bearing seats | Ø30 k5 (rotating inner ring load), Rz 3.2, roundness 0.004, run-out 0.01 to A–B | Bearing maker, ch. 5 slope |
| Pulley seat | Ø25 k6 or j6 with key P9 / taper 1:10 | Ch. 8 |
| Press-fit seat | Ø30 u6, Rz 1.6 ground | Ch. 8.4 |
| Keyway | 8 P9 × 4.0 +0.2, end-milled form A | Ch. 8.2 |
| Geometric tolerances | Run-out of seats 0.01 to common axis A–B (ISO 1101); cylindricity 0.005 of seats | Ch. 5, bearing life |
| Undercuts | DIN 509 form E/F where grinding needs a run-out | Grinding + notch |
| Centre holes | DIN 332-1 R3.15, to remain | Inspection datum |
| Balance | G6.3, two planes, U_per per plane | M2 |

### 9.3 Inspection methods

| What | Method | Typical frequency (example) |
|---|---|---|
| Diameters of seats | Micrometer / air gauge / in-process gauge on the grinder | 100 % for press-fit and bearing seats (critical) |
| Run-out | Between centres, dial gauge or CMM | 1 per 10 (SPC), 100 % at start-up |
| Roundness, cylindricity | Form tester (e.g. roundness machine) | 1 per lot |
| Fillet radius and form | Radius gauges, contour measuring machine, optical profile | First article + 1 per lot (and after tool change) |
| Roughness R_z / R_a | Stylus instrument (ISO 21920) | 1 per lot per characteristic |
| Hardness, depth | HRC / HB tester; cut-up specimen for hardening depth | Per batch / per furnace load |
| Grinding burn | Nital etch (ISO 14104) or Barkhausen noise | Per lot or 100 % (automotive) |
| Cracks | MPI (wet fluorescent) | 100 % for crankshafts |
| Balance | Balancing machine | 100 % |

### 9.4 Control plan (extract, example)

| No. | Characteristic | Spec | Class | Method | Frequency | Reaction |
|---|---|---|---|---|---|---|
| 1 | Ø30 u6 press-fit seat | 30.048 … 30.061 | Critical | In-process gauge + air gauge | 100 % | Stop, adjust, 100 % check of lot |
| 2 | Fillet R x = 40 | R1 +0.2/0 | Critical | Contour scan | First part + every insert change | Replace insert, quarantine |
| 3 | Run-out bearing seats | ≤ 0.01 | Major | Between centres | 1/10 + SPC | Check centres, regrind |
| 4 | Hardness | 220–260 HB | Major | Brinell | 3 per heat-treatment lot | Reject lot, re-treat |
| 5 | Cracks | none | Critical | MPI | 100 % | Scrap, 8D |
| 6 | Residual unbalance | ≤ U_per | Major | Balancing machine | 100 % | Correct |

### 9.5 Check questions
1. Why must an induction-hardened zone never end exactly in a fillet?
2. What is grinding burn, why is it dangerous, and how do you find it?
3. Which three characteristics of the compressor shaft would you mark as "critical" and why?

---

## 10 Verification with SOLIDWORKS Simulation / Ansys (and Adams)

### 10.1 Two levels of model

| Model | Use | Expected agreement with `shaft.py` |
|---|---|---|
| **Beam model** (SOLIDWORKS Simulation beam / Ansys BEAM188, Adams flexible beam) | Reactions, moments, deflection, slopes, critical speed | Reactions and moments exact; deflection ≤ 2 % (beam theory is the same; shear deformation adds a little for short shafts) |
| **Solid model** (tetra 10 / hexa 20 elements) | Peak stress at fillets, keyways, oil holes, crank webs | Peak = K_t · σ_nom ± 5–10 % for shoulders (after mesh convergence) |

### 10.2 How to build the solid model
1. Geometry: real fillets (do **not** suppress them), keyway, oil holes. Split faces where loads and supports act.
2. **Bearing supports:** do **not** fix the seat faces (too stiff, false stresses). Use a *remote displacement* /
   *bearing support* on the seat: bearing A (locating) fixes x, y, z; bearing B (floating) fixes y, z only; leave the
   rotation free. Better: springs with the bearing stiffness (M4).
3. **Loads:** crank-pin force as *bearing load* (sinusoidal pressure over 180° of the pin surface) or as a remote force on
   the pin face; belt force as bearing load on the pulley seat; torque as *remote moment* on the pulley seat and the
   opposite on the pin.
4. Mesh: global size d/10; at fillets at least 3–4 elements per quarter-circle of the radius (element size ≤ r/3). Run
   **three meshes** (r/2, r/4, r/8) and compute the GCI (M1 chapter 5.7, `dm_toolkit.gci`) – converged when GCI < 2–5 %.
5. Static, linear, small displacement. Material E = 210 GPa, ν = 0.3.

### 10.3 What to compare

| Quantity | shaft.py value (default) | FEA target |
|---|---|---|
| Reaction A / B (resultant) | 1560.4 / 1351.4 N | same (± 0.5 %) |
| Max deflection (pulley end, x = 0) | 0.0094 mm | ± 5 % (solid includes shear + hub stiffness) |
| Slope at A / B | 0.00017 / 0.00016 rad | ± 5 % |
| Nominal bending at x = 40 | σ_ba = 8.31 MPa (M = 12.7 N·m, W = 1534 mm³) | Away from the fillet |
| Peak at the fillet x = 40 | K_t · σ = 1.958 · 8.31 = 16.3 MPa (bending part) | ± 10 % after convergence |
| Critical speed (modal analysis, with pulley mass) | 87 806 rpm (Rayleigh) | first bending mode ± 5 % |

### 10.4 Typical errors
- **Fixed seat faces** → peak stress at the seat edge that does not exist (singularity) – use remote supports.
- **Point load** on the pin → huge local stress; distribute it.
- **No fillet** in the CAD (sharp corner) → stress grows with every mesh refinement (singularity, M1 chapter 28) – never
  converges.
- **Comparing peak FEA stress with the DIN 743 nominal limit** – wrong: either nominal stress + β (DIN 743), or local
  stress + local method (FKM local). Do not mix.
- Units (mm–N–MPa vs m–N–Pa) and torque applied on one face only without the reaction torque → rigid-body motion.

### 10.5 Adams / SOLIDWORKS Motion with a flexible shaft
For torsional and bending dynamics of the crank train (M2), replace the rigid crankshaft by a **flexible body** (Ansys
modal reduction → MNF → Adams, guide 54 C16). Compare: first torsional frequency, bearing forces with and without
flexibility. For this short, stiff shaft (n_crit ≈ 60 × operating speed) the rigid model is sufficient – the flexible body is
needed for long shafts and high speeds.

### 10.6 Check questions
1. Why should bearing seats not be modelled as "fixed" faces?
2. Your FEA peak at the fillet changes from 15 to 19 to 24 MPa on three meshes. What is wrong?
3. Which value do you put into the DIN 743 proof: the FEA peak or the nominal stress?

---

## 11 Complete worked design example, checklists, limits, references

### 11.1 Task – a lighter compressor shaft (example)

Material and production cost of the shaft scale with its mass. Requirement: reduce the diameters, keep
- S_fatigue and S_static ≥ 1.2 at every notch (we keep a margin: target ≥ 3 because of the crank-web uncertainty, 7.13),
- slope at the bearings ≤ 0.001 rad, deflection ≤ 0.05 mm,
- critical speed ≥ 1.3 × … here far above,
- key flank pressure safety ≥ 1.2 with a grey-iron pulley.

Input file (`python shaft.py params > redesign.json`, then change these keys; values not listed stay as in the default):

```json
{
  "name": "VC20 crankshaft - lighter redesign (example)",
  "segments": [[40, 20, 0], [20, 25, 0], [100, 28, 0], [20, 25, 0], [10, 20, 0]],
  "notches": [[40.0, "shoulder", {"D": 25, "d": 20, "r": 1.0, "Rz": 6.3}],
              [60.0, "shoulder", {"D": 28, "d": 25, "r": 1.0, "Rz": 6.3}],
              [20.0, "keyway", {"d": 20, "Rz": 6.3}],
              [50.0, "pressfit", {"d": 25, "Rz": 3.2}],
              [160.0, "shoulder", {"D": 28, "d": 25, "r": 1.0, "Rz": 6.3}],
              [110.0, "plain", {"d": 28, "Rz": 3.2}]],
  "key": {"d": 20, "l": 32, "hub": "cast iron", "T_Nm": 47.8, "K_A": 1.25}
}
```
Run it: `python shaft.py run --in examples/shaft_redesign.json --out redesign` – or the same through the new function `redesign()`:

**Run it:** `python shaft.py ch711` (last block)
```
== 11 redesign: S_fat_min 5.17 S_stat_min 7.62 v_max 0.0224 mm slope A 0.00041 B 0.00039 rad n_crit 57182 rpm; key p 91.9 MPa S 0.98; mass 1.170 -> 0.761 kg (-35.0 %)
   x  40.0 shoulder  d 20: S_fat   5.17 S_stat   7.62
   x  60.0 shoulder  d 25: S_fat   8.20 S_stat  13.39
   x  20.0 keyway    d 20: S_fat   5.87 S_stat   7.97
   x  50.0 pressfit  d 25: S_fat   7.47 S_stat  13.78
   x 160.0 shoulder  d 25: S_fat  18.99 S_stat  46.48
   x 110.0 plain     d 28: S_fat   6.83 S_stat   8.69
   key fix d 20 (6 x 6): l 36 -> l_tr 30 p 79.7 MPa S_p 1.13 (l_min 32.6)
   key fix d 20 (6 x 6): l 40 -> l_tr 34 p 70.3 MPa S_p 1.28 (l_min 32.6)
```

**Evaluation.**
- Mass −35 % (1.170 → 0.761 kg, straight-beam model). All strength safeties ≥ 5.17, stiffness still fine (slope 0.00041
  rad < 0.001, deflection 0.022 mm < 0.05).
- **The key fails** (S_p 0.98 with l = 32): the smaller shaft gives a smaller key (6 × 6) and a larger force. Fix: key length
  **40 mm** (S_p 1.28) – the pulley seat is 40 mm long, so the key fills it; or a steel/Taper-Lock hub.
- **Bearings:** the seats are now Ø 25 → bearing 6205 instead of 6206 – check its life with M4 (smaller C!). This is often
  the real limit.
- **Crank web:** the pin Ø 28 instead of 30 raises the web-fillet stress by (30/28)³ = 1.23 → from 7.13 the K_t = 3 case
  falls from S 3.61 to ≈ 2.9 (straight-beam moment) – acceptable only with rolled fillets and the FEA check.
- **Decision (example):** accept the lighter shaft with key l = 40, rolled pin fillets, FEA of the crank web, and the
  bearing life check in M4.

### 11.2 Design sheet (example)

| Item | Value |
|---|---|
| Material | C45+QT 220–260 HB (forged blank Ø 35) |
| Diameters | Ø20 pulley / Ø25 bearings / Ø28 body / Ø28 pin (straight-beam equivalent) |
| Min. fatigue / static safety | 5.17 / 7.62 (DIN 743 style, S_min 1.2) |
| Deflection / slopes | 0.022 mm / 0.00041 rad |
| Key | 6 × 6 × 40 form A, P9, grey-iron pulley, S_p 1.28 |
| Press fit (crank hub, if built) | Ø30 H7/u6, l 16, shaft Rz 1.6–3.2, press-in 15.8 kN |
| Surface treatment | Crank-pin fillets rolled; seats ground Rz 3.2 |
| Open checks | Bearing life (M4), crank-web FEA (ch. 10), balancing (M2) |

### 11.3 Checklists

**Before calculating:** loads from M2 for all load cases (normal, start, fault) · torque mean and amplitude · bearing
positions and type (locating / floating) · raw-part diameter for K1 · all notches listed (shoulders, grooves, keyways, fits,
holes) with r, R_z.

**After calculating:** S_fatigue and S_static ≥ S_min at every notch · slope at bearings within the bearing maker's limit ·
deflection at gears / seals within limits · n_crit ≥ 1.3 × n (or ≤ 0.7 × n) · keys and fits checked at the worst
tolerance · bearing life (M4) · drawing specs match all assumptions (ch. 9.2).

### 11.4 Common mistakes
- Using the finished diameter instead of the heat-treatment diameter for K1.
- Forgetting the mean torque (ψ term) or the torque reversal (key fretting).
- Using fixed supports in FEA and then "finding" high stress at the seats.
- Sharp fillet radii because the CAD model had none – K_t 3+ instead of 2.
- Taking H7/p6 or H7/r6 as a torque-transmitting press fit.
- Treating a crankshaft as a straight shaft without the web check.
- Specifying surface treatment in the calculation (KV) but not on the drawing.

### 11.5 Limits of `shaft.py`
- Simplified DIN 743: one load case "σ_mv/σ_a = const", fixed γF = 1.1, no size correction of keyway / press-fit β,
  approximated specimen limits, typical material values – **check DIN 743-1…-4 (2012)** for a design report.
- Two bearings only (statically determinate); no bearing stiffness, no shear deformation.
- Straight-beam model of the crankshaft – webs, pin offset and oil holes need FEA (ch. 7.13, 10).
- Infinite-life fatigue only; finite life / load spectra → DIN 743-4 (and M1 chapter 26 Miner).
- No thermal stresses, no corrosion fatigue.

### 11.6 Standards and books
**Standards:** DIN 743-1…-4:2012 (shaft strength) · DIN 6885-1 (feather keys) · DIN 6892 (key calculation) ·
DIN 7190-1:2017 (interference fits) · DIN 5480 / ISO 4156 (involute splines) · DIN 509 (undercuts) · DIN 332-1 (centre
holes) · ISO 286-1/-2 (fits) · ISO 1101 (geometrical tolerances) · ISO 21920 (surface texture) · ISO 14104 (grinding burn,
nital etch) · ISO 9934 (MPI) · ISO 21940-11 (balancing) · FKM guideline "Analytical strength assessment", 7th ed.
**Books:** Niemann, Winter, Höhn – *Maschinenelemente* Vol. 1 · Roloff/Matek – *Maschinenelemente* · Budynas, Nisbett –
*Shigley's Mechanical Engineering Design* · Haberhauer – *Maschinenelemente* · Peterson / Pilkey – *Stress Concentration
Factors*.

### 11.7 MATLAB mirror
`tools/shaft.m` repeats the core of `shaft.py` (reactions, moments, stepped-shaft deflection, Rayleigh critical speed,
DIN-743-style safety at the notches, key and press fit). It was **not executed** in this environment – run it once and compare
with the numbers in its header (they are the `shaft.py` results above).

### 11.8 Glossary (chapters 7–11)
| Term | Meaning |
|---|---|
| β_σ, β_τ | Fatigue notch factor (effective notch effect in fatigue) |
| K_t (α_σ) | Elastic stress concentration factor |
| G′ | Relative stress gradient at the notch root [1/mm] |
| n (support number) | Ratio K_t / β – how much the material supports the peak |
| K1 | Technological size factor (blank strength falls with size) |
| K2 | Geometric size factor (fatigue size effect) |
| K_F | Roughness factor |
| K_V | Surface-treatment factor (rolling, nitriding, hardening) |
| ψ | Mean-stress sensitivity |
| σ_ADK | Permissible stress amplitude of the notched part |
| U, U_eff | Interference (measured), effective after smoothing |
| Fretting | Wear and corrosion from micro-slip at fit edges |
| Clamping set | Removable friction hub connection with tapered rings |
