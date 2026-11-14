# M2 – Crank mechanism: kinematics, compressor cycle, forces, torque, flywheel, balancing, loads, manufacturing

> Field 1 *Mechanical design*, item 2. **Theory and program are combined:** every formula in this guide is followed by
> the lines of `tools/crank.py` that compute it, the command to run it and the real output. A MATLAB mirror is in
> `tools/crank.m`. Python standard library only – runs on the offline factory PC.
> Reference product: V-type 90° two-cylinder single-acting air compressor (bore 65 mm, stroke 46 mm, rod 90 mm,
> 1450 rpm, 0.8 MPa gauge). **All inputs are example values** – replace them with your design data
> (`python crank.py params > my.json`, edit, `python crank.py run --in my.json --out result`).

## Contents
0. How to use this guide with the program
1. Purpose and the design questions answered
2. Mechanism types, geometry and conventions
3. Kinematics
4. Thermodynamics of the compressor cycle
5. Masses of the crank train
6. Forces in the crank train
7. Torque, energy fluctuation and flywheel
8. Balancing and vibration isolation
9. Loads for component design (hand-over to M3 shaft, M4 bearings, conrod, pin)
10. From calculation to real manufacturing
11. Verification with SOLIDWORKS Motion / Adams and MATLAB
12. Complete worked design example
13. Checklists, mistakes, limits, standards, glossary

---

## 0. How to use this guide with the program

### 0.1 The three ways to read it
| You want | Do this |
|---|---|
| Learn the theory | Read chapter by chapter; each derivation ends in a formula box |
| Check a number | Each formula box is followed by **"In the program"** (exact code) and **"Run it"** (command + output) |
| Design your own compressor | `python crank.py params > my.json` → edit → `python crank.py run --in my.json --out my_result` → read `report.md`, open the `.svg` charts in a browser, load `crank.csv` in Excel / MATLAB |

### 0.2 Program map – formula → function

| Chapter | Physics | Function in `crank.py` | Output |
|---|---|---|---|
| 3 | Exact slider-crank kinematics s, x, ds/dφ, d²s/dφ², β | `kin()` | position, velocity, acceleration |
| 3 | Fourier (series) approximation | `kin_series()` | error of the 2-term formula |
| 4 | Geometry, swept and clearance volume | `geometry()` | A, V_s, V_c, ω, λ |
| 4 | Gas pressure vs crank angle (polytropic + valve losses) | `gas_pressure()` | p(φ) |
| 4 | p-V loop, indicated work, λ_V, FAD, powers | `cycle()` | FAD, P_ind, η_iso |
| 5 | Conrod 2-mass split + 3-mass error | `masses()` | m_osc, m_rot, ΔJ |
| 6 | Piston, rod, side, pin, main-bearing forces; torque two ways | `forces_at()` | all forces at one angle |
| 6–9 | Sweep over one revolution | `sweep()` | rows for all angles |
| 7 | Mean torque, ΔE, flywheel, harmonic orders | `torque_analysis()` | M_mean, J_fly, orders |
| 8 | Primary / secondary forces, counterweight, rocking couple | `balancing()` | shaking forces |
| 8 | Permissible residual unbalance | `iso21940()` | U_per |
| 9 | Bearing loads, cubic mean, rod forces, side force | `bearing_loads()` | inputs for M3 / M4 |
| 10 | TDC-gap stack, FAD sensitivity to clearance | `tolerance_effects()` | manufacturing limits |
| – | Charts + CSV + report | `run()`, `_svg_line()`, `report_text()` | files |
| – | Independent cross-checks | `cmd_selftest()` | SELFTEST PASS |
| 3 | 4-term series, conrod angular motion, max piston speed, offset crank | `kin_series4()`, `rod_motion()`, `max_piston_speed()`, `kin_offset()`, `offset_stroke()` |
| 4 | Closed-form polytropic work, discharge temperature, isentropic power, motor power, design for FAD target | `polytropic_work_closed()`, `discharge_temp()`, `isentropic_power()`, `motor_power()`, `design_for_fad()` |
| 5 | Rod angular motion, 3-mass inertia correction, pendulum test, weight grouping | `rod_angle_motion()`, `rod_inertia_correction()`, `pendulum_J()`, `pendulum_period()`, `weight_group_effect()` |
| 7 | Single-cylinder orders, twin order factor, flywheel rim, rim stress, run-up time | `single_cyl_orders()`, `twin_order_factor()`, `flywheel_rim()`, `rim_stress()`, `runup_time()` |
| 8 | V-angle comparison, transmissibility, mount design | `v_angle_compare()`, `transmissibility()`, `mount_design()` |
| 9 | Load cases, start torque, cubic mean, two-bearing split, conrod buckling + fatigue, crank pin, gudgeon pin | `LOAD_CASES`, `load_case_table()`, `start_torque()`, `cubic_mean()`, `main_bearing_split()`, `conrod_buckling()`, `conrod_shank_fatigue()`, `crankpin_check()`, `gudgeon_pin_check()` |
| 10 | Monte Carlo TDC gap, displacement tolerance, unequal-mass shaking, flywheel disc | `gap_monte_carlo()`, `displacement_tolerance()`, `unequal_mass_shaking()`, `flywheel_disc()` |
| 12 | Design option table | `design_options()` |
Extra results of these functions: `python crank.py ch24` (chapters 2–4), `ch58` (5–8), `ch913` (9–12);
`python crank.py examples` prints everything.

### 0.3 What the self-test proves (run it after every change)
`python crank.py selftest` checks, without trusting the formulas themselves:
1. Analytic derivatives = finite differences (kinematics correct).
2. a(TDC) = rω²(1+λ) and x(180°) = 2r.
3. Drive torque by **virtual work** = torque from **pin-force vectors** (two independent derivations, difference ≈ 10⁻¹⁴ N·m).
4. Mean torque × ω = indicated power from the p-V loop (energy conservation, ± 0.5 %).
5. λ_V from the loop = textbook formula.
6. V90 primary = constant rotating vector m_osc·r·ω²; residual after counterweight ≈ √2 × secondary.
7. Without gas the mean torque is zero (inertia forces do no net work).
8. Piston equilibrium S·cosβ = F_gas + m_osc·a at every angle.
This is how a calculation program earns trust (M1 chapter 7: credibility level L2).

## 1. Purpose and the design questions answered

The crank mechanism turns motor rotation into piston strokes. Almost every other design depends on its numbers:

| Question | Answer from | Used by |
|---|---|---|
| How much air (FAD) and power? | Ch. 4 | Motor choice, product data sheet |
| What forces act on pins, bearings, rods, liner? | Ch. 6, 9 | M3 shaft, M4 bearings, conrod, piston pin |
| What torque does the motor see? How big a flywheel? | Ch. 7 | Motor, belt, pulley, coupling |
| How much does the machine shake? Counterweight? Mounts? | Ch. 8 | Crankshaft design, base frame, noise |
| Which tolerances matter for performance and safety? | Ch. 10 | Drawings, inspection plan |
| Is my SOLIDWORKS Motion / Adams model right? | Ch. 11 | Your CAE credibility (M1 ch. 7) |

**Example result (default input, `python crank.py examples`)** – the numbers you will meet in the chapters:

| Quantity | Value |
|---|---|
| Displacement / FAD | 26.56 / **16.58 m³/h** (target 20 → chapter 4 and 12 show how to reach it) |
| Indicated power | 1581 W (isothermal efficiency 0.645) |
| Drive torque mean / max / min | 10.41 / 47.77 / −12.64 N·m |
| Energy fluctuation, flywheel to add | 37.6 J, 0.059 kg·m² (δ = 0.02, motor inertia counted) |
| Primary / secondary force per cylinder | 203.3 / 51.9 N; residual with counterweight 74.7 N |
| Rod bearing peak load, specific pressure | 2664 N, 4.93 MPa |
| ISO 21940-11 G6.3 permissible unbalance | 124.5 g·mm |
| TDC gap 0.60 mm: minimum worst case / RSS | 0.400 / 0.513 mm |


---

## 2 Mechanism types, geometry and conventions

### 2.1 What the crank mechanism does
The crank mechanism (slider-crank) changes **rotation** of the crankshaft into **straight back-and-forth motion** of
the piston, or back. In an engine, gas pushes the piston and the crank turns. In a **compressor** it is the other way:
the motor turns the crank and the piston pushes the gas. The same equations hold for both. Only the sign of the
power is different.

Main parts: crankshaft (with crank pin and counterweights), connecting rod (conrod) with big end and small end,
piston with piston pin (gudgeon pin) and rings, cylinder, crankcase, main bearings.

### 2.2 Arrangements

| Arrangement | Description | Typical use | Notes for balancing / design |
|---|---|---|---|
| Single cylinder | One slider-crank | Small compressors, engines | Primary and secondary forces stay. Counterweight balances only half the primary force (or moves it) |
| Inline 2, 3, 4 | Cylinders in one row, cranks at 180°, 120°, 90° … | Engines, large compressors | Inline 4 at 180°: primary balanced, secondary 4·F2 not balanced |
| **V with side-by-side rods** | Two rods on **one crank pin**, axially offset by a | **V-twin compressors** (our VC20), motorcycles | Simple and cheap. The two cylinders are offset axially by about one rod width, which gives a small rocking couple (chapter 8) |
| V with fork-and-blade rods | One rod is forked; the other runs inside the fork on the same pin | Some motorcycles and aero engines | No axial offset, so no rocking couple. The fork rod is more complex to make |
| V with master / articulated rod | Second rod is pinned to the big end of the master rod | Radial engines, some large V engines | The articulated rod has a slightly different motion (different stroke, not symmetric) |
| Opposed (boxer), 180° V | Cylinders face each other | Air compressors, engines | Good primary balance with two crank pins |
| W, radial | Three or more banks | Aircraft, special compressors | Complex |

**Our case – V90 two-cylinder compressor, side-by-side rods on one crank pin.**
The V angle is 90°. Both cylinders are single-acting: they compress only on one side of the piston. The V bisector
is vertical. Cylinder 1 sits at γ₁ = −45°, cylinder 2 at γ₂ = +45°. Both rods share one crank pin. Chapter 8 shows why
the V90 is so attractive: one counterweight balances the **whole primary force**.

### 2.3 Geometry and symbols

```
                cyl 1 (gamma1 = -45 deg)          cyl 2 (gamma2 = +45 deg)
                        \  head                      head  /
                         \ [piston] Q1         Q2 [piston]/
                          \   |                    |    /        u_i = unit vector of cylinder axis
                           \  | rod l         rod l|   /               (towards the head)
                            \ |                    |  /
                             \|   beta             | /          s = |OQ| crank centre -> piston pin
                              P ===================P            P = crank pin (both rods on one pin)
                               \  r     theta    /
                                \      |       /                theta from the vertical (V bisector)
                                 \     |     /                  phi_i = theta - gamma_i
                                  ---- O ----                   O = crank centre (main bearings)
```

| Symbol | Meaning | Unit | Example (VC20) |
|---|---|---|---|
| D | Bore | mm | 65 |
| s_H = 2r | Stroke | mm | 46 |
| r | Crank radius | m | 0.023 |
| l | Conrod centre distance (big-end centre to small-end centre) | m | 0.090 |
| λ = r/l | Crank ratio | – | 0.2556 |
| θ | Crank angle from the vertical, positive in the direction of rotation | rad | – |
| γ_i | Angle of cylinder axis i from the vertical | rad | −45°, +45° |
| φ_i = θ − γ_i | Crank angle seen by cylinder i (φ_i = 0 means piston i is at TDC) | rad | – |
| β | Conrod angle to the cylinder axis, sin β = λ sin φ | rad | max 14.81° |
| s | Distance from crank centre to piston pin (largest at TDC: s = r + l) | m | 0.113 at TDC |
| x = r + l − s | Piston travel from TDC | m | 0 … 0.046 |
| A = πD²/4 | Piston area | m² | 3.318·10⁻³ |
| V_s = A·2r | Swept volume per cylinder | m³ | 152.64 cm³ |
| V_c = c·V_s | Clearance (dead) volume | m³ | 7.632 cm³ |
| c | Clearance ratio V_c/V_s | – | 0.05 |
| ω = 2πn/60 | Crank angular speed | rad/s | 151.844 |

TDC = top dead centre (piston nearest the head, smallest volume). BDC = bottom dead centre.

### 2.4 Sign conventions (exactly as in crank.py)
- θ is measured from the vertical and grows in the direction of rotation.
- φ_i = θ − γ_i. So cylinder 1 (γ₁ = −45°) is at TDC when θ = −45° = 315°. Cylinder 2 reaches TDC 90° later, at θ = 45°.
- s is measured from the crank centre towards the head. **Piston velocity v = ds/dt is negative when the piston moves
  towards the crank** (suction stroke). Acceleration a = d²s/dt² is negative at TDC: the piston is being pulled towards
  the crank.
- Gas force F_gas > 0 pushes the piston towards the crank.
- Rod force S > 0 means compression in the rod.
- M_drive > 0 is the torque the motor must give the crankshaft.

Use the same conventions in SOLIDWORKS Motion or Adams, or convert them. Most "wrong" comparisons between programs are
sign or angle-origin mistakes.

### 2.5 Choice of the crank ratio λ

| Effect | Small λ (long rod, about 0.2) | Large λ (short rod, about 0.35) |
|---|---|---|
| Machine height (crank centre to head) | Higher (r + l + piston + head) | Lower, more compact |
| Max conrod angle β_max = asin λ | Small (11.5° at λ = 0.2) | Large (20.5° at λ = 0.35) |
| Piston side force N = F·tan β | Smaller: less liner wear, less piston slap | Larger |
| Secondary inertia force F2 = λ·m·r·ω² | Smaller | Larger: more vibration |
| Conrod mass | Longer rod: heavier | Lighter |
| Dwell at TDC (time near TDC) | Longer at TDC | Shorter at TDC, longer at BDC |

Typical values: compressors and engines 0.20–0.35. Our example uses λ = 23/90 = 0.2556. That gives β_max = 14.81°,
and the crank centre-to-pin height at TDC is r + l = 113.0 mm (from the program, section 3).

### 2.6 Offset (desaxé) crank
Sometimes the cylinder axis is moved sideways by an offset e from the crank centre. Then:

```
  s(phi) = r cos(phi) + sqrt( l^2 - (r sin(phi) - e)^2 )
  stroke = sqrt((l + r)^2 - e^2) - sqrt((l - r)^2 - e^2)              (slightly MORE than 2r)
  TDC at phi_TDC = asin( e/(l + r) ),   BDC at phi_BDC = 180 deg + asin( e/(l - r) )
```

Effects: the stroke grows a little, and the two strokes take different crank angles (quick return). The conrod angle
becomes smaller on the loaded side. Engines use a small offset of the piston pin to reduce piston slap. In compressors
an offset is rare.

**In the program** (new functions `kin_offset`, `offset_stroke`):
```python
def kin_offset(phi, r, l, e, w):
    """Offset (desaxe) slider crank: cylinder axis shifted by e from the crank centre.
    s = r cos phi + sqrt(l^2 - (r sin phi - e)^2); returns s, ds/dphi, beta."""
    sp, cp = math.sin(phi), math.cos(phi)
    q = r * sp - e
    root = math.sqrt(l * l - q * q)
    s = r * cp + root
    ds = -r * sp - q * r * cp / root
    return s, ds, math.asin(q / l)

def offset_stroke(r, l, e):
    """Stroke and TDC/BDC crank angles of an offset crank."""
    s_tdc = math.sqrt((l + r) ** 2 - e * e)
    s_bdc = math.sqrt((l - r) ** 2 - e * e)
    phi_tdc = math.asin(e / (l + r))                 # rod and crank in line
    phi_bdc = math.pi + math.asin(e / (l - r))       # crank opposite, folded
    return s_tdc - s_bdc, math.degrees(phi_tdc), math.degrees(phi_bdc)
```
**Run it** (e = 5 mm, example): stroke **46.0762 mm** (+0.076 mm), TDC at **2.536°**, BDC at **184.280°**. So one
stroke takes **181.74°** and the other takes **178.26°**. At φ = 90° the conrod angle falls from 14.807° to **11.537°**.
At φ = 270° it rises to **−18.126°**. Rule: put the offset so that the **smaller angle is on the high-load stroke**
(compression for a compressor). Then the side force is smaller when the gas force is high.

**Check questions 2**
1. Why does a V90 with side-by-side rods have a rocking couple, but a fork-and-blade V does not?
2. Cylinder 2 is at γ₂ = +45°. At what θ is it at BDC? (Answer: θ = 225°.)
3. Rod length 90 → 110 mm. Calculate the new λ and β_max, and say what happens to the side force and to F2.

---

## 3 Kinematics

### 3.1 Exact position
Look at triangle O–P–Q (crank centre, crank pin, piston pin). Project both links onto the cylinder axis:

```
  s = r cos(phi) + l cos(beta)                                   (1)
```
Sideways (perpendicular to the axis), the pin and the piston pin must end up on the axis:

```
  r sin(phi) = l sin(beta)   ->   sin(beta) = lam sin(phi)        (2)
```
From (2): l cos β = √(l² − l² sin² β) = √(l² − r² sin² φ). Put this into (1):

```
  s(phi) = r cos(phi) + sqrt( l^2 - r^2 sin^2(phi) )              (3)
  x(phi) = r + l - s(phi)                    (travel from TDC, 0 ... 2r)
```

### 3.2 Exact derivatives with respect to the crank angle
Write w(φ) = √(l² − r² sin² φ). Then dw/dφ = −r² sin φ cos φ / w.

First derivative:
```
  ds/dphi = -r sin(phi) - r^2 sin(phi) cos(phi) / w                (4)
```
Second derivative. The first term gives −r cos φ. For the second term use the quotient rule on
u/w with u = r² sin φ cos φ = (r²/2) sin 2φ, so du/dφ = r² cos 2φ:

```
  d/dphi (u/w) = (du/dphi)/w - u (dw/dphi)/w^2
               = r^2 cos(2phi)/w + (r^2 sin phi cos phi)(r^2 sin phi cos phi)/w^3
```
So:
```
  d2s/dphi2 = -r cos(phi) - r^2 cos(2phi)/w - r^4 sin^2(phi) cos^2(phi) / w^3      (5)
```
Check at TDC (φ = 0): w = l, sin φ = 0, so d²s/dφ² = −r − r²/l = **−r(1 + λ)** (towards the crank).
At BDC (φ = π): cos φ = −1, cos 2φ = 1, so d²s/dφ² = +r − r²/l = **+r(1 − λ)** (towards the head).

### 3.3 Velocity and acceleration in time
For constant crank speed ω (dφ/dt = ω):
```
  v = ds/dt   = (ds/dphi) * omega          [m/s]
  a = d2s/dt2 = (d2s/dphi2) * omega^2      [m/s^2]
  a_TDC = -r omega^2 (1 + lam)   (towards crank),   a_BDC = +r omega^2 (1 - lam)  (towards head)
```
When the speed is not constant (start-up, flywheel ripple) add the term (ds/dφ)·dω/dt. At steady speed with a
2 % fluctuation this term is small. Chapter 7 shows where it matters.

### 3.4 Conrod angle, angular velocity and acceleration
Differentiate (2) in time: λ cos φ · ω = cos β · dβ/dt, so

```
  omega_rod = d(beta)/dt = omega * lam * cos(phi) / cos(beta)                       (6)
```
Differentiate again (ω constant). Use d(cos β)/dt = −sin β · ω_rod and sin β = λ sin φ:

```
  alpha_rod = omega^2 lam [ -sin(phi) cos(beta) + cos(phi) sin(beta) * lam cos(phi)/cos(beta) ] / cos^2(beta)
            = -omega^2 lam sin(phi) [ cos^2(beta) - lam^2 cos^2(phi) ] / cos^3(beta)
  with cos^2(beta) = 1 - lam^2 sin^2(phi):  cos^2(beta) - lam^2 cos^2(phi) = 1 - lam^2
  alpha_rod = -omega^2 * lam * sin(phi) * (1 - lam^2) / cos^3(beta)                  (7)
```
We need α_rod for the inertia torque of the conrod. That torque is the 3-mass correction in chapter 5.

### 3.5 Fourier series (harmonic) form
Expand √(1 − λ² sin² φ) with the binomial series and replace sin² φ, sin⁴ φ, … by cosines of multiple angles:

```
  sqrt(1 - lam^2 sin^2 phi) = 1 - (lam^2/2) sin^2 phi - (lam^4/8) sin^4 phi - (lam^6/16) sin^6 phi - ...
  sin^2 phi = (1 - cos 2phi)/2,   sin^4 phi = (3 - 4 cos 2phi + cos 4phi)/8, ...
```
Collecting terms gives:
```
  x(phi) = r [ A0 - cos(phi) - (A2/4) cos(2phi) + (A4/16) cos(4phi) - (A6/36) cos(6phi) + ... ]
  a(towards crank) = r omega^2 [ cos(phi) + A2 cos(2phi) - A4 cos(4phi) + A6 cos(6phi) - ... ]

  A2 = lam + lam^3/4 + 15 lam^5/128        A4 = lam^3/4 + 3 lam^5/16        A6 = 9 lam^5/128
```
**2-term form** (A2 ≈ λ, A4 = A6 = 0), used in every textbook:
```
  x ~= r [ (1 - cos phi) + (lam/2) sin^2 phi ]
  a ~= r omega^2 [ cos phi + lam cos 2phi ]       -> 1st order (primary) + 2nd order (secondary)
```
The secondary term is why "secondary inertia forces" exist (chapter 8). They have **twice** the crank frequency
and an amplitude λ times the primary.

**In the program** – exact (`kin`), 2-term (`kin_series`) and 4-term (new `kin_series4`):
```python
def kin(phi, r, l, w):
    """Exact slider-crank kinematics. phi rad, r l m, w rad/s."""
    sp, cp = math.sin(phi), math.cos(phi)
    root = math.sqrt(l * l - (r * sp) ** 2)
    s = r * cp + root
    ds = -r * sp - r * r * sp * cp / root
    d2s = -r * cp - r * r * math.cos(2 * phi) / root - (r ** 4) * sp * sp * cp * cp / root ** 3
    beta = math.asin(r * sp / l)
    return {"s": s, "x": r + l - s, "ds": ds, "d2s": d2s, "v": ds * w, "a": d2s * w * w, "beta": beta}

def kin_series(phi, r, l, w):
    lam = r / l
    x = r * ((1 - math.cos(phi)) + lam / 2 * math.sin(phi) ** 2)
    a_tc = r * w * w * (math.cos(phi) + lam * math.cos(2 * phi))
    return x, a_tc

def kin_series4(phi, r, l, w):
    lam = r / l
    A2 = lam + lam ** 3 / 4 + 15 * lam ** 5 / 128
    A4 = lam ** 3 / 4 + 3 * lam ** 5 / 16
    A6 = 9 * lam ** 5 / 128
    x = r * (1 + A2 / 4 - A4 / 16 + A6 / 36
             - math.cos(phi) - A2 / 4 * math.cos(2 * phi) + A4 / 16 * math.cos(4 * phi) - A6 / 36 * math.cos(6 * phi))
    a_tc = r * w * w * (math.cos(phi) + A2 * math.cos(2 * phi) - A4 * math.cos(4 * phi) + A6 * math.cos(6 * phi))
    return x, a_tc, (A2, A4, A6)
```
Formulas (4) and (5) are the lines `ds =` and `d2s =`. The self-test checks them against finite differences
(`python crank.py selftest`: "ds/dphi = finite difference OK", "d2s/dphi2 = finite difference OK",
"a at TDC = r w^2 (1+lam) OK").

**Run it** – `python crank.py examples` (kinematics table, VC20, 1450 rpm):
```
phi  x_exact[mm]  x_series[mm]  v[m/s]  a_towards_crank_exact  a_series [m/s2]  beta[deg]
  0      0.0000       0.0000    0.000         665.8         665.8    0.000
 30      3.8192       3.8161    2.136         529.3         527.0    7.341
 60     13.7318      13.7042    3.421         197.5         197.4   12.786
 90     25.9885      25.9389    3.492        -140.2        -135.5   14.807
120     36.7318      36.7042    2.628        -332.8        -332.9   12.786
150     43.6563      43.6533    1.357        -389.2        -391.5    7.341
180     46.0000      46.0000    0.000        -394.8        -394.8    0.000
270     25.9885      25.9389   -3.492        -140.2        -135.5  -14.807
```
(The table prints v as the speed of travel x, i.e. −ds/dt.) 4-term coefficients: **A2 = 0.259856, A4 = 0.004377,
A6 = 7.66·10⁻⁵**. Largest error over one turn:

| Model | Max error of x | Max error of a |
|---|---|---|
| 2-term | 0.0496 mm | 4.65 m/s² (0.7 % of a_TDC) |
| 4-term | 6.7·10⁻⁵ mm | 0.0125 m/s² |

**Interpretation.** The 2-term form is good enough for balancing theory and hand checks. Its acceleration error is
below 1 %. Use the exact form for the clearance volume near TDC and for anything you compare with CAD or a measurement.
At φ = 90° the piston has already moved **25.99 mm**, which is **more than half** the stroke (23 mm). The conrod
angularity "pulls" the piston: it moves faster in the upper half of the stroke.

Key values (program): a_TDC = r ω²(1 + λ) = **665.8 m/s²** (68 g), a_BDC = **394.8 m/s²**. Even this small
compressor pulls about 68 g at TDC. With m_osc = 0.383 kg that is an inertia force of **255 N**, already about 9 % of
the peak gas force (chapter 6).

### 3.6 Conrod motion (program)
New function `rod_motion` (formulas 6 and 7):
```python
def rod_motion(phi, r, l, w):
    lam = r / l
    beta = math.asin(lam * math.sin(phi))
    cb = math.cos(beta)
    w_rod = w * lam * math.cos(phi) / cb
    a_rod = -w * w * lam * math.sin(phi) * (1 - lam * lam) / cb ** 3
    return beta, w_rod, a_rod
```
Output (1450 rpm): at φ = 0, ω_rod = **38.80 rad/s** (= λω); at φ = 45°, β = 10.41°, ω_rod = 27.90 rad/s,
α_rod = **−4093 rad/s²**; at φ = 90°, ω_rod = 0, α_rod = **−6095 rad/s²** (maximum). Finite-difference check at
φ = 0.7 rad: −3697.26 = −3697.26 rad/s². With a rod inertia of a few 10⁻⁴ kg·m², the rod's inertia torque J·α_rod is
about 1–2 N·m. That is small next to the gas torque, but not zero (chapter 5, 3-mass model).

### 3.7 Maximum and mean piston speed
**Mean piston speed** c_m = 2·s_H·n/60 = 2 · 0.046 · 1450/60 = **2.223 m/s**.
**Maximum piston speed:** set dv/dφ = 0, i.e. d²s/dφ² = 0. There is no closed solution, so we solve it numerically. A
good approximation: the maximum is near the point where crank and rod are at 90°, at φ ≈ arctan(1/λ) = **75.66°**.

New function:
```python
def max_piston_speed(r, l, w, n=200000):
    best = (0.0, 0.0)
    for k in range(1, n):
        ph = math.pi * k / n
        v = abs(kin(ph, r, l, w)["v"])
        if v > best[1]:
            best = (ph, v)
    return math.degrees(best[0]), best[1]
```
Result: **v_max = 3.605 m/s at φ = 76.47°**. That is 1.621 × c_m and 1.03 × rω (3.492 m/s).

| Mean piston speed c_m | Typical application (guide values, check maker data) |
|---|---|
| < 3 m/s | Oil-lubricated small air compressors for continuous duty (long ring and liner life) |
| 3–4 m/s | Common upper range for industrial piston compressors |
| > 4–5 m/s | Short-duty or special designs; valve losses and wear rise strongly |
Ring and liner wear grows roughly with sliding speed and contact pressure. Valve pressure losses grow roughly with
(gas speed)², and gas speed ∝ c_m · A_piston / A_valve. Keep c_m in mind when you raise the speed to get more flow
(section 4.9).

### 3.8 MATLAB equivalent (kinematics)
```matlab
r = 0.023; l = 0.090; n = 1450; w = 2*pi*n/60; lam = r/l;
phi = linspace(0, 2*pi, 721);
root = sqrt(l^2 - (r*sin(phi)).^2);
s   = r*cos(phi) + root;            x = r + l - s;
ds  = -r*sin(phi) - r^2*sin(phi).*cos(phi)./root;
d2s = -r*cos(phi) - r^2*cos(2*phi)./root - r^4*sin(phi).^2.*cos(phi).^2./root.^3;
v = ds*w;  a = d2s*w^2;  beta = asin(lam*sin(phi));
[vmax, i] = max(abs(v));  fprintf('vmax %.3f m/s at %.2f deg\n', vmax, rad2deg(phi(i)));
plot(rad2deg(phi), -a, rad2deg(phi), r*w^2*(cos(phi)+lam*cos(2*phi)), '--'); grid on
xlabel('\phi [deg]'); ylabel('a towards crank [m/s^2]'); legend('exact','2-term')
```
Expect v_max ≈ 3.605 m/s near 76.5° (the 0.5° grid gives ±0.01). This is the same check you should do in
**SOLIDWORKS Motion**: plot the piston linear velocity and acceleration and compare with this table. The difference
must be < 0.5 %. If it is bigger, look first at units, the angle origin and the motor speed definition.

### 3.9 Real manufacturing link
- The **crank radius r** (stroke) is made by the crankshaft machining. A typical tolerance is ±0.02 mm. It changes the
  swept volume very little (0.04 mm in 46 mm = 0.09 %), but it changes the **TDC gap** directly (chapter 10 stack).
- The **conrod centre distance l** (bore-to-bore) is usually held to ±0.02–0.05 mm. Holding it in a pair matters
  more for the V twin: both pistons should reach the same TDC gap.
- **Bearing clearances** (big end, small end, main bearing) add "free play" at the dead centres. When the inertia force
  turns over, the piston jumps by the clearance. That causes noise and impact, and it also changes the TDC gap.

**Check questions 3**
1. Derive a_BDC from (5) and show that it equals r ω²(1 − λ). Calculate it for 1450 rpm (answer 394.8 m/s²).
2. Why is the piston travel at φ = 90° larger than r? Calculate x(90°) exactly (25.99 mm).
3. With the 2-term series, at which angles is the acceleration zero? Compare with the exact table.
4. Speed 1450 → 1750 rpm: how do a_TDC and v_max change? (Both scale with n² and n.)

---

## 4 Thermodynamics of the compressor cycle

### 4.1 The ideal cycle without clearance
Think of an ideal cylinder with no dead volume and ideal valves:
1. **Suction** (TDC to BDC): the inlet valve is open. Air flows in at the suction pressure p_s.
2. **Compression** (from BDC): both valves are closed. The air is compressed until p reaches p_d.
3. **Discharge**: the outlet valve opens and air is pushed out at p_d until TDC.
Every cycle the whole swept volume V_s is filled with fresh air. The volumetric efficiency is 1.

### 4.2 The real cycle with clearance volume
A real piston cannot touch the valve plate. There is a gap, plus valve pockets and ports. This dead volume
V_c = c·V_s stays full of compressed air at p_d at TDC. On the suction stroke this air first **re-expands**. The inlet
valve opens only when the pressure has fallen to p_s. Part of the stroke is lost.

```
 p
 pd  2 --------------- 3'          1 -> 2  polytropic compression   p V^nc = const
     |  discharge     /|          2 -> 3'  discharge at pd
     |               / |          3'-> 4   re-expansion of clearance gas  p V^ne = const
     |   compression/  |          4 -> 1   suction at ps
     |             /   |
 ps  4 ...........1    |           V at 3' = Vc (TDC), V at 1 = Vc + Vs (BDC)
     Vc  V1(=4)      Vc+Vs  V      V1 = start of suction
```

### 4.3 Polytropic process
Real compression is neither isothermal (pV = const) nor isentropic (pV^κ = const, κ = 1.4 for air). It is polytropic:

```
  p V^n = const,     T2/T1 = (p2/p1)^((n-1)/n)
```
For air-cooled small compressors: compression n ≈ 1.25–1.35, re-expansion n ≈ 1.15–1.25 (the gas takes heat from the
hot walls). Our example uses n_c = 1.30 and n_e = 1.20 (example values; measure them from an indicator diagram if
you can).

### 4.4 Volumetric efficiency – derivation
Re-expansion from TDC (p_d, V_c) to the start of suction (p_s, V₁):

```
  pd Vc^ne = ps V1^ne   ->   V1 = Vc (pd/ps)^(1/ne)
```
The fresh volume sucked in per cycle is (V_c + V_s) − V₁. Divide by V_s:

```
  lam_V = (Vc + Vs - V1)/Vs = 1 + c - c (pd/ps)^(1/ne)
  lam_V = 1 - c [ (pd/ps)^(1/ne) - 1 ]                                       (8)
```
Two lessons follow from (8):
- λ_V falls **linearly with c**. Dead volume is the enemy of flow.
- λ_V falls with the pressure ratio. At λ_V = 0 the compressor delivers nothing: π_max = (1 + 1/c)^{n_e}.

### 4.5 From swept volume to FAD
FAD (free air delivery) is the volume flow **at inlet conditions** (ambient pressure and temperature at the
compressor inlet). It is measured according to ISO 1217 (displacement compressors; annex C covers acceptance tests of
electrically driven packages). Our model multiplies three factors:

```
  lam_total = lam_V * lam_p * lam_T
     lam_p = ps/p_amb            (pressure factor: suction valve and filter loss, here 1 - 0.05)
     lam_T                       (heating of the incoming air by hot walls + ring and valve leakage, here 0.92)
  FAD = lam_total * Vs * z * n * 60          [m^3/h]    z = number of cylinders, n in rpm
```
The displacement (theoretical flow) is V_s · z · n · 60. The ratio FAD/displacement for real small two-cylinder
air-cooled compressors at 8 bar is often about 0.6–0.75. Check the competitor data sheets: they often state
displacement and FAD separately.

### 4.6 Indicated work and power
The work done on the gas per cycle is the area of the p-V loop:

```
  W_ind = - (closed integral of p dV) = area of the loop                    [J per cycle]
```
For our idealised loop (constant suction and discharge pressure, polytropic curves) there is a **closed form**. The
area between the pressure lines p_s and p_d, measured to the p-axis (∫V dp), is "n/(n−1)·p·V·(π^((n−1)/n) − 1)" for
each curve:

```
  W_ind = nc/(nc-1) * ps * V3 * [ pi^((nc-1)/nc) - 1 ]  -  ne/(ne-1) * ps * V1 * [ pi^((ne-1)/ne) - 1 ]
  V3 = Vc + Vs (BDC),  V1 = start of suction,  pi = pd/ps  (effective pressures incl. valve losses)
  P_ind = W_ind * z * n/60                                                   [W]
```
Reference powers for the delivered flow q = FAD/3600 (m³/s) at inlet pressure p₁:

```
  isothermal   P_iso = p1 q ln(p2/p1)
  isentropic   P_s   = kappa/(kappa-1) p1 q [ (p2/p1)^((kappa-1)/kappa) - 1 ],   kappa = 1.4
  efficiencies eta_iso = P_iso/P_ind,  eta_s = P_s/P_ind
```

### 4.7 Discharge temperature
```
  T2 = T1 (p2/p1)^((n-1)/n)       [K]
```
This is the most important limit of a single stage. Lubricating oil on the hot valves and in the discharge line forms
carbon deposits. The rule of thumb is to keep the discharge gas below about **180–200 °C** for continuous duty with
mineral oil (check your oil supplier; synthetic oils allow more). Very hot discharge also raises the fire / explosion
risk in the discharge line. EN 1012-1 and the oil supplier give guidance.

### 4.8 In the program
`geometry()` turns the input into SI values. `gas_pressure()` returns p(φ) for the loop of section 4.2. `cycle()`
integrates the loop and computes the efficiencies.
```python
def geometry(P):
    r = P["stroke_mm"] / 2000.0
    l = P["rod_mm"] / 1000.0
    A = math.pi / 4 * (P["bore_mm"] / 1000.0) ** 2
    Vs = A * 2 * r
    return {"r": r, "l": l, "lam": r / l, "A": A, "Vs": Vs, "Vc": P["clearance_ratio"] * Vs,
            "w": P["rpm"] * 2 * math.pi / 60.0}

def gas_pressure(phi, P, geo):
    A, Vs, Vc, r, l = geo["A"], geo["Vs"], geo["Vc"], geo["r"], geo["l"]
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd_abs = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6
    pd = pd_abs * (1 + P["dp_discharge_rel"])
    ph = phi % (2 * math.pi)
    V = Vc + A * kin(ph, r, l, 1.0)["x"]
    if ph <= math.pi:                       # expansion then suction (TDC -> BDC)
        p = pd * (Vc / V) ** P["n_expansion"]
        return max(p, ps)
    p = ps * ((Vc + Vs) / V) ** P["n_compression"]   # compression then discharge (BDC -> TDC)
    return min(p, pd)
```
Core of `cycle()` (trapezoid integration of the loop, then formula 8 and the FAD chain):
```python
    for k in range(n + 1):
        ph = 2 * math.pi * k / n
        V = Vc + A * kin(ph, r, l, 1.0)["x"]
        p = gas_pressure(ph, P, geo)
        if Vprev is not None:
            W += 0.5 * (p + pprev) * (Vprev - V)      # work done ON the gas = -int p dV
        Vprev, pprev = V, p
    V1 = Vc * (pd / ps) ** (1 / P["n_expansion"])
    lam_V = (Vc + Vs - V1) / Vs                         # volumetric (clearance) efficiency
    lam_p = ps / (P["p_amb_MPa"] * 1e6)                 # pressure factor (suction loss)
    lam_total = lam_V * lam_p * P["lambda_T"]
    fad_m3h = lam_total * Vs * P["n_cyl"] * P["rpm"] * 60
    P_ind = W * P["rpm"] / 60 * P["n_cyl"]
    P_iso = p1 * q * math.log(pd_abs / p1)
```
New functions for this chapter (closed-form work, temperature, isentropic power, motor size):
```python
def polytropic_work_closed(P, geo):
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6 * (1 + P["dp_discharge_rel"])
    nc, ne = P["n_compression"], P["n_expansion"]
    V3 = geo["Vc"] + geo["Vs"]
    V1 = geo["Vc"] * (pd / ps) ** (1 / ne)
    pi = pd / ps
    Wc = nc / (nc - 1) * ps * V3 * (pi ** ((nc - 1) / nc) - 1)
    We = ne / (ne - 1) * ps * V1 * (pi ** ((ne - 1) / ne) - 1)
    return Wc - We, Wc, We

def discharge_temp(T1_C, p1, p2, n):
    return (T1_C + 273.15) * (p2 / p1) ** ((n - 1) / n) - 273.15

def isentropic_power(P, fad_m3h, kappa=1.4):
    p1 = P["p_amb_MPa"] * 1e6
    p2 = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6
    q = fad_m3h / 3600
    return kappa / (kappa - 1) * p1 * q * ((p2 / p1) ** ((kappa - 1) / kappa) - 1)

def motor_power(P_ind_W, eta_mech=0.85, eta_belt=0.95, service=1.15):
    P_shaft = P_ind_W / eta_mech
    P_motor = P_shaft / eta_belt
    return P_shaft, P_motor, P_motor * service
```

### 4.9 Run it – VC20 example values
`python crank.py examples` (thermodynamics block) and the new functions give:

| Quantity | Value | How |
|---|---|---|
| Effective suction / discharge pressure | p_s = 0.9624 bar, p_d = 9.464 bar abs | 1.013·(1 − 0.05); 9.013·(1 + 0.05) |
| Pressure ratio | nominal 8.897, effective **9.834** | Valve losses raise the ratio the piston actually sees |
| Swept volume per cylinder | 152.64 cm³ | A·2r |
| Clearance volume | 7.632 cm³ | c = 0.05. Equal to a flat gap of **2.30 mm** over the bore |
| Start of suction V₁ | 51.28 cm³ | V_c·(p_d/p_s)^(1/1.2) |
| λ_V (numeric = formula 8) | **0.7141** | Self-test "lambda_V analytic = …" OK |
| λ_p, λ_T, λ_total | 0.950, 0.92, **0.6241** | |
| Displacement | **26.56 m³/h** | 2 cylinders · 1450 rpm |
| **FAD** | **16.58 m³/h** | 0.6241 · 26.56 |
| Indicated work per cylinder | 32.702 J numeric = 32.702 J closed form (W_c 46.431, W_e 13.729) | difference 0.000 % |
| Indicated power | **1581 W** | 32.70 J · 2 · 1450/60 |
| Isothermal / isentropic power | 1019.5 W / 1415.9 W | for 16.58 m³/h |
| η_iso, η_s (indicated) | 0.645 / 0.896 | |
| Shaft power (η_mech 0.85) | 1860 W | |
| Motor output (belt η 0.95) | 1957 W; × 1.15 service = **2251 W** | The 3 kW motor has margin |

λ_V against clearance ratio (same pressures, n_e = 1.2):

| c | 0 | 0.03 | 0.05 | 0.08 |
|---|---|---|---|---|
| λ_V | 1.000 | 0.828 | **0.714** | 0.543 |
λ_V reaches zero at c = 0.175. At c = 0.05 the delivery stops at a pressure ratio of 38.6.

Discharge temperature (nominal ratio 8.897, effective 9.834):

| T₁ | n | T₂ nominal ratio | T₂ effective ratio |
|---|---|---|---|
| 20 °C | 1.2 | 148.8 °C | – |
| 20 °C | 1.3 | 212.3 °C | 223.6 °C |
| 40 °C | 1.2 | 177.6 °C | – |
| 40 °C | 1.3 | 245.4 °C | 257.5 °C |
| 40 °C | 1.4 | 311.6 °C | 328.6 °C |

**Interpretation.** With n = 1.3, the end temperature of compression at 8 bar is above 200 °C. Good cylinder and
head cooling (fins, fan) lowers the effective n towards 1.2. That is why air-cooled single-stage compressors are
practical up to about 8–10 bar. To stay below 180 °C at T₁ = 40 °C with n = 1.3, the pressure ratio may only be
**4.96**. That is the reason for **two-stage** compressors at 10–15 bar (for example, 13 bar abs single-stage would
give 291 °C). The measured discharge temperature at the valve plate is a key test-bench value (chapter on tests in M1,
ch. 32).

**p-V diagram.** `python crank.py run --out crank_out` writes `pv.svg` (one cylinder, p abs in bar against V in cm³).
Read it like this: the top flat line is discharge at 9.46 bar; the bottom line is suction at 0.96 bar. The right
curve is compression from BDC (160.3 cm³). The left curve is re-expansion from TDC (7.63 cm³) to 51.3 cm³. The **width
of the bottom line** (51.3 → 160.3 cm³) is the fresh charge. The **area** is the indicated work, 32.7 J. The pressure
losses show as the gaps between 0.96 / 1.013 bar and between 9.01 / 9.46 bar.

### 4.10 Valve losses and real valve dynamics
Our model uses constant pressure losses (5 % of the absolute pressure on each side). Real reed or ring-plate valves:
- open late and flutter (the valve plate is a spring-mass system with natural frequency f_v = (1/2π)√(k/m));
- have losses that grow with (gas speed)², so roughly with (c_m · A/A_valve)²;
- can close late (back-flow) when the valve stiffness is too low or the stop lift is too high.
A good valve gives about 3–6 % pressure loss at rated speed. To model valve motion, pulsation in the pipes and the
real p(φ), use a 1D tool such as GT-SUITE (guide 54 C31) or write your own valve equation of motion. Then feed the
real p(φ) curve into chapter 6 (forces) in place of `gas_pressure()`. The force and torque chapters accept any
pressure curve.

### 4.11 Design case – the example does **not** reach 20 m³/h
The requirement is FAD ≥ 20 m³/h (M1 requirement R01). The program gives 16.58 m³/h. New function `design_for_fad`
checks three fixes. Each fix is re-calculated with `cycle()`, not only scaled:
```python
def design_for_fad(P, target_m3h):
    geo = geometry(P)
    base = cycle(P, geo)
    f0 = base["fad_m3h"]
    D = P["bore_mm"] * math.sqrt(target_m3h / f0)            # (1) FAD ~ D^2
    n = P["rpm"] * target_m3h / f0                           # (2) FAD ~ n
    ps = P["p_amb_MPa"] * 1e6 * (1 - P["dp_suction_rel"])
    pd = (P["p_amb_MPa"] + P["p_dis_gauge_MPa"]) * 1e6 * (1 + P["dp_discharge_rel"])
    lamV_need = base["lam_V"] * target_m3h / f0              # (3) clearance from formula (8)
    c_need = (1 - lamV_need) / ((pd / ps) ** (1 / P["n_expansion"]) - 1)
    # ... each variant is then recomputed with cycle() (see crank.py)
```
**Run it:**

| Option | Change | FAD | P_ind | Side effects |
|---|---|---|---|---|
| Base | D 65, 1450 rpm, c 0.05 | 16.58 | 1581 W | – |
| (1) Larger bore | D = **71.40 mm** | 20.00 | 1907 W | Peak gas force 2804 → **3383 N** (× 1.207 = (D₁/D₀)²): pin, bearings, rod and crankshaft loads all +21 %. Needs new piston, rings, cylinder |
| (1b) Standard bore 70 | D = 70 | 19.22 | 1833 W | Not enough alone |
| (1c) Standard bore 72 | D = 72 | 20.34 | 1939 W | OK, loads +23 % |
| (2) Higher speed | n = **1749.5 rpm** | 20.00 | 1907 W | c_m 2.22 → 2.68 m/s; inertia forces × (1749.5/1450)² = 1.46; valve losses and noise rise; bearing life falls |
| (3) Less clearance | c = **0.0242** (λ_V 0.862) | 20.00 | 1868 W | No change to loads or speed. But V_c must fall from 7.63 to 3.70 cm³: smaller TDC gap, smaller valve pockets. Needs tight manufacturing (chapter 10) |
| (4) Combined | D 68 + c 0.03 | 21.05 | 1974 W | Moderate load increase, realistic clearance |

**Engineering judgement.** Option (3) is the cheapest per unit if the valve plate and the TDC gap can be made tight.
It also gives the best efficiency (lowest P_ind for 20 m³/h). But c = 0.024 means V_c ≈ 3.7 cm³. A 0.6 mm TDC gap
alone gives c = 0.6/46 = 0.013, so only ≈ 1.7 cm³ is left for valve pockets and ports. That is hard. Option (1c)
(bore 72) is robust but raises every load by about 23 %. Then chapters 6–9 and items M3/M4 must be recalculated.
Option (4) is a balanced choice. Decide with the weighted matrix of M1 section 5.4, and keep the new FAD under the
real test-bench check (ISO 1217).

All three options need about 1.9 kW indicated power. The shaft power becomes about 2.2–2.3 kW, and the motor output
with belt losses about 2.4 kW. The 3 kW motor still has margin. Check the motor's continuous duty and its starting
torque at the start case (chapter 7).

### 4.12 MATLAB equivalent (cycle)
```matlab
D=0.065; r=0.023; l=0.090; c=0.05; n=1450; z=2; pa=1.013e5;
ps=pa*(1-0.05); pd=(pa+0.8e6)*1.05; nc=1.30; ne=1.20; lamT=0.92;
A=pi/4*D^2; Vs=A*2*r; Vc=c*Vs;
phi=linspace(0,2*pi,2881); x=r+l-(r*cos(phi)+sqrt(l^2-(r*sin(phi)).^2)); V=Vc+A*x;
p=zeros(size(phi));
up = phi<=pi;  p(up)  = max(pd*(Vc./V(up)).^ne, ps);
dn = ~up;      p(dn)  = min(ps*((Vc+Vs)./V(dn)).^nc, pd);
W = -trapz(V, p);                         % work on the gas per cycle [J]
lamV = 1 - c*((pd/ps)^(1/ne) - 1);
FAD = lamV*(ps/pa)*lamT*Vs*z*n*60;        % m^3/h
Pind = W*z*n/60;
fprintf('W %.3f J, lamV %.4f, FAD %.2f m3/h, Pind %.0f W\n', W, lamV, FAD, Pind)
plot(V*1e6, p/1e5); xlabel('V [cm^3]'); ylabel('p abs [bar]'); grid on
```
Expected: W ≈ 32.70 J, λ_V = 0.7141, FAD = 16.58 m³/h, P_ind ≈ 1581 W.

### 4.13 Real manufacturing and practice link
- **Clearance volume is a manufacturing result.** V_c = A·(TDC gap) + valve pocket volumes + port volumes + the ring
  land volume above the top ring. Each 0.1 mm of gap adds 0.0022 to c and costs **0.289 m³/h FAD (1.74 %)**
  (chapter 10, `tolerance_effects`). So the deck-height and gasket tolerances directly cost flow.
- **Measure the real clearance** on the first prototypes: fill the volume above the piston at TDC with oil from a
  burette (or calculate it from CAD with all pockets), then put the real c into the program.
- **Valve plate design**: pocket volume, port area and stop lift are a trade-off between flow loss (larger ports) and
  dead volume (smaller ports). Valve steel (for example Sandvik/Hiflex-type strip steels), flatness and edge quality
  decide the valve life.
- **Test bench**: measure FAD (ISO 1217), shaft power, discharge temperature, and if possible an indicator diagram
  (pressure sensor in the cylinder head plus a crank-angle encoder). Fit n_c, n_e and the valve losses to that data.
  Then the program is validated (credibility level L3, M1 chapter 7).

**Check questions 4**
1. Derive formula (8) yourself, starting from p_d·V_c^{n_e} = p_s·V₁^{n_e}.
2. Why does the clearance volume reduce flow but cost little energy? (Hint: the re-expanding gas gives back most of
   its compression work, the W_e term.)
3. Calculate λ_V for c = 0.05 at 10 bar gauge. Calculate T₂ at T₁ = 30 °C with n = 1.3. Is one stage acceptable?
4. Option (2) raises speed to 1750 rpm. Estimate the new inertia force at TDC with m_osc = 0.383 kg.
   (Answer: 255 N · (1749.5/1450)² ≈ 371 N.)
5. Which option in 4.11 changes nothing in chapters 6–9? Why is it still risky?


---

## 5 Masses of the crank train

> Program: `tools/crank.py` – functions `masses()`, `rod_angle_motion()`, `rod_inertia_correction()`, `pendulum_J()`,
> `weight_group_effect()`. Run the core with `python crank.py examples`, the chapter 5–8 numbers with
> `python crank.py ch58`. All masses are **example values** (VC20 example data set, `python crank.py params`).

### 5.1 Why masses matter
At 1450 rpm the crank turns at ω = 151.8 rad/s. The piston changes direction twice per revolution. Its acceleration at
TDC is 666 m/s² (≈ 68 g, chapter 3). A small mass then gives a large force: 0.38 kg × 666 m/s² = 255 N. This is about
10 % of the peak gas force (2804 N). The inertia forces decide:
- the **shaking force** on the frame (balancing, chapter 8),
- the **rod tension** at TDC of the suction stroke,
- part of the **torque ripple** (flywheel, chapter 7),
- the **bearing loads** at low pressure (unloaded running).

We cannot treat the conrod as one point. Its small end moves with the piston (straight line). Its big end moves with the
crank pin (circle). The shank in between swings. Chapter 5 shows how we replace it with simple point masses.

### 5.2 Two-mass model of the conrod – derivation
Replace the real rod (mass m, CG at distance a from the big-end centre, b = l − a from the small-end centre, inertia J
about the CG) by two point masses: m_A at the big-end centre and m_B at the small-end centre.

A replacement system is **dynamically equivalent** if it has the same
1. total mass: m_A + m_B = m
2. CG position: m_A · a = m_B · b
3. moment of inertia about the CG: m_A · a² + m_B · b² = J

Conditions 1 and 2 give:

  m_A = m · b / l   (rotating, big end)  m_B = m · a / l   (oscillating, small end)

With two masses we have only two free values. We cannot also meet condition 3. The two-mass model has the inertia

  J₂ = m_A a² + m_B b² = m · a · b

(insert m_A, m_B: m b a²/l + m a b²/l = m a b (a + b)/l = m a b).

The error is **ΔJ = J_real − m·a·b**. For real conrods J_real is normally **smaller** than m·a·b, because the heavy
big-end eye sits near the CG side. So ΔJ is negative.

**Formula box 5.1 – conrod reduction**

| Symbol | Meaning | Unit |
|---|---|---|
| m | conrod mass (with bolts, bearing shells) | kg |
| l | centre distance big end – small end | m |
| a, b | CG distance from big-end / small-end centre, a + b = l | m |
| m_A = m b / l | rotating share (with the crank pin) | kg |
| m_B = m a / l | oscillating share (with the piston) | kg |
| J₂ = m a b | inertia of the 2-mass model about the CG | kg·m² |
| ΔJ = J − m a b | 3-mass correction (inertia error) | kg·m² |
| m_osc = m_piston + m_B | oscillating mass per cylinder | kg |
| m_rot = m_A (per rod) + crank unbalance at r | rotating mass at the pin radius | kg |

**In the program** (`masses()`):
```python
def masses(P):
    """Two-mass conrod split + 3-mass correction term. Returns m_osc, m_rot per cylinder and checks."""
    l = P["rod_mm"] / 1000
    a = P["rod_cg_from_bigend_mm"] / 1000      # CG from big end
    b = l - a                                   # CG from small end
    m = P["m_rod_kg"]
    m_big = m * b / l
    m_small = m * a / l
    J2 = m_big * a * a + m_small * b * b       # inertia of the 2-mass model about CG
    dJ = P["J_rod_cg_kgm2"] - J2               # error of the 2-mass model (3-mass correction)
    return {"m_rod_big": m_big, "m_rod_small": m_small, "m_osc": P["m_piston_kg"] + m_small,
            "m_rot_cyl": m_big, "J_2mass": J2, "J_error": dJ}
```

**Run it** – `python crank.py ch58` (first lines):
```
m_rod_big 0.1667, m_rod_small 0.0833, m_osc 0.3833, J_2mass 4.500e-04, J_real 3.600e-04, dJ -9.000e-05
```
Example data: m = 0.25 kg, l = 90 mm, a = 30 mm (b = 60 mm), J = 3.6·10⁻⁴ kg·m², piston group 0.30 kg.
- m_A = 0.25 · 60/90 = **0.1667 kg** rotating, m_B = 0.25 · 30/90 = **0.0833 kg** oscillating.
- m_osc = 0.30 + 0.0833 = **0.3833 kg** per cylinder.
- J₂ = 0.25 · 0.03 · 0.06 = 4.5·10⁻⁴ kg·m² against real 3.6·10⁻⁴ → ΔJ = **−9.0·10⁻⁵ kg·m²** (the model is 25 % too stiff in rotation).

### 5.3 Three-mass model and the correction couple
A third "mass" fixes condition 3: a **negative or positive pure inertia** ΔJ attached to the rod. It adds the couple

  M_corr = −ΔJ · β̈

on the rod, where β̈ is the angular acceleration of the rod. For constant crank speed (sin β = λ sin φ):

  β̇ = ω λ cos φ / cos β  β̈ = ω² λ sin φ (λ² − 1) / cos³β

β̈ is largest near φ = 90° and 270°. The couple on the rod reaches the crank through the rod geometry; by virtual work
the crank torque part is M_corr · dβ/dφ.

**In the program** (`rod_angle_motion()`, `rod_inertia_correction()`):
```python
def rod_angle_motion(phi, lam, w):
    b = math.asin(lam * math.sin(phi))
    cb = math.cos(b)
    bd = w * lam * math.cos(phi) / cb
    bdd = w * w * lam * math.sin(phi) * (lam * lam - 1) / cb ** 3
    return b, bd, bdd

def rod_inertia_correction(P, n=720):
    geo = geometry(P); M = masses(P)
    lam, w = geo["lam"], geo["w"]
    dJ = M["J_error"]
    amp_rod, amp_crank = 0.0, 0.0
    for k in range(n):
        ph = 2 * math.pi * k / n
        b, bd, bdd = rod_angle_motion(ph, lam, w)
        Mc = -dJ * bdd
        amp_rod = max(amp_rod, abs(Mc))
        amp_crank = max(amp_crank, abs(Mc * bd / w))
    ...
```
**Run it:**
```
beta_ddot_max 6094.6 rad/s2, M_corr_rod_max 0.5485 N m, crank torque from it max 0.0678 N m
```
**Interpretation.** The rod swings with up to 6095 rad/s². The missing couple is 0.55 N·m on the rod and only
**0.068 N·m** on the crank. The drive torque peak is 47.8 N·m (chapter 7) → error 0.14 %. **For this compressor the
two-mass model is good enough.** The correction matters for high-speed engines (λ larger, n > 5000 rpm) and for
torsional-vibration models where small torque orders count. In Adams or SOLIDWORKS Motion the real rod inertia is used
automatically – compare their torque with `crank.py`; a difference of about 0.07 N·m is this effect, not an error.

### 5.4 Measuring the mass split and the inertia (shop method)
**Mass split by weighing.** Put the rod horizontal: big-end eye on a knife edge on a scale, small-end eye on a knife
edge on a second scale (or on a block of the same height). Scale readings are directly m_A and m_B. Check:
a = l · m_B / m. Example: 0.0833 kg on the small end → a = 90 · 0.0833/0.25 = **30.0 mm** (matches the input).

**Inertia by pendulum.** Hang the rod on a knife edge through the small-end bore. Let it swing with a small amplitude
(< 5°). Measure the period T over 20–50 swings. With pivot-to-CG distance a_p (here b = 60 mm):

  J_O = m g a_p T² / (4π²)  J_CG = J_O − m a_p²  (Steiner / parallel-axis theorem)

Derivation: for the physical pendulum J_O θ̈ = −m g a_p sin θ ≈ −m g a_p θ → ω_p² = m g a_p / J_O → T = 2π √(J_O/(m g a_p)).

**In the program** (`pendulum_J()`):
```python
def pendulum_J(m, a, T, g=9.81):
    JO = m * g * a * T * T / (4 * math.pi ** 2)
    return {"J_O": JO, "J_CG": JO - m * a * a}
```
**Run it:**
```
pendulum: T = 0.5814 s -> J_O 1.2599e-03, J_CG 3.5994e-04 (from measured T rounded to 0.1 ms)
pendulum sensitivity: T + 2 ms -> J_CG 3.6863e-04 (2.4 %)
```
**Practice.** J_CG is the small difference of two larger numbers (1.26·10⁻³ − 0.90·10⁻³). A timing error of 2 ms gives
2.4 % error. So time ≥ 20 periods with a light barrier or phone slow-motion video, and measure a_p from the weighed
split, not from the drawing. CAD (SOLIDWORKS Mass Properties) gives J within ± 2–5 % if the density and the bearing
shells / bolts are modelled.

### 5.5 Oscillating and rotating masses – summary
| Mass | Moves | Contains | Example value |
|---|---|---|---|
| m_osc (per cylinder) | straight line, with acceleration a(φ) | piston, rings, pin, clips, m_B | 0.3833 kg |
| m_A (per rod) | circle radius r | big end share of the rod | 0.1667 kg |
| crank unbalance at r | circle radius r | crank pin + webs (without counterweight) reduced to r | 0.40 kg |
| m_rot total (V-twin, one pin) | circle radius r | 2 · m_A + crank unbalance | 0.7333 kg |

**Reducing the crank to radius r.** A web part with mass m_k and CG at radius r_k gives the same centrifugal force as
m_k · r_k / r at the pin radius. Add all parts (pin, web segments) with their sign (counterweight side negative).
CAD gives this directly: static moment of the crankshaft without counterweights = Σ m_k r_k; divide by r.
Example: 0.40 kg at r = 23 mm → centrifugal force 0.40 · 0.023 · 151.8² = **212 N** (`ch58` output).

### 5.6 Weight-grouping tolerances in production
The counterweight is sized for the **nominal** masses. If one piston is heavier by Δm, that difference is unbalanced:

  ΔF₁ = Δm · r ω²  ΔF₂ = λ · ΔF₁  (along that cylinder axis)
  big end heavier by Δm_A → rotating ΔF = Δm_A · r ω²

**In the program** (`weight_group_effect()`):
```python
def weight_group_effect(P, dm_piston_kg, dm_small_kg=0.0, dm_big_kg=0.0):
    geo = geometry(P)
    r, w, lam = geo["r"], geo["w"], geo["lam"]
    dmo = dm_piston_kg + dm_small_kg
    F1 = dmo * r * w * w
    return {"dF1_N": F1, "dF2_N": lam * F1, "dF_rot_N": dm_big_kg * r * w * w,
            "dF_total_max_N": F1 * (1 + lam) + dm_big_kg * r * w * w}
```
**Run it:**
```
weight group dm_piston 2 g: dF1 1.06 N, dF2 0.27 N, max 1.33 N
weight group dm_piston 5 g: dF1 2.65 N, dF2 0.68 N, max 3.33 N
weight group dm_piston 10 g: dF1 5.30 N, dF2 1.36 N, max 6.66 N
big-end +5 g: dF_rot 2.65 N
```
**Interpretation.** The residual shaking force of the balanced V90 is 74.7 N (chapter 8). A 10 g piston difference adds
6.7 N (9 %). **Practice rule (example):** piston groups ± 2–3 g, rod big end ± 2 g and small end ± 2 g per engine set.
Real practice: pistons and rods are weighed after machining and marked with a weight class letter; assembly takes the
same class for both cylinders. Rods are corrected by milling the balance pads on the big-end cap and on the small-end
boss (pads are on the drawing as "weight-correction area, max. depth x mm").

**MATLAB equivalent (5.2–5.6):**
```matlab
l=0.090; a=0.030; b=l-a; m=0.25; J=3.6e-4; mp=0.30; r=0.023; w=1450*2*pi/60; lam=r/l;
mA=m*b/l, mB=m*a/l, mosc=mp+mB, J2=m*a*b, dJ=J-J2
phi=linspace(0,2*pi,721); be=asin(lam*sin(phi));
bdd=w^2*lam*sin(phi).*(lam^2-1)./cos(be).^3;  Mcorr=max(abs(-dJ*bdd))
T=0.5814; JO=m*9.81*b*T^2/(4*pi^2); JCG=JO-m*b^2
dF1=0.010*r*w^2      % 10 g piston difference
```

**Check questions.** (1) Why can the two-mass model not satisfy the inertia condition? (2) What is m_osc if the piston
is 20 g lighter? (3) Why must the pendulum period be timed over many swings? (4) A rod CG moves 2 mm towards the small end –
what happens to m_osc and to the shaking force?

---

## 6 Forces in the crank train

> Program: `forces_at()` (one crank angle), `sweep()` (full revolution), `bearing_loads()`.

### 6.1 The force chain
At every crank angle the forces flow: **gas + inertia on the piston → rod → crank pin → crankshaft → main bearings →
crankcase**. The piston side force goes into the cylinder wall. We follow this chain for one cylinder, then add the two
cylinders as vectors on the common crank pin.

### 6.2 Forces on the piston (along the cylinder axis)
- **Gas force:** F_g = (p − p_cc) · A, positive towards the crank. p from the cycle model (chapter 4), p_cc = crankcase
  pressure (here atmospheric), A = πD²/4 = 3.318·10⁻³ m².
- **Inertia force of the oscillating mass:** F_i = −m_osc · a, with a = d²s/dt² (s = crank centre to piston pin).
  At TDC a = −rω²(1 + λ), so F_i = +m_osc rω²(1+λ) = **+255.2 N** (it pulls the piston away from the crank).
- **Axial force the rod must give:** Newton for the piston along the axis (+ towards the head):
  m_osc s̈ = −F_g + R_ax → **F = R_ax = F_g + m_osc s̈**.

### 6.3 Rod force and side force – derivation
The rod is a two-force member (pins at both ends, its own mass already moved to the two ends). So it carries only a force
S along its axis. It makes the angle β with the cylinder axis (sin β = λ sin φ). Split S at the piston pin:
- along the axis: S cos β = F → **S = F / cos β** (compression positive)
- across the axis: the wall must push back with **N = F tan β** (side force)

The side force changes side when F or β changes sign. That is the **piston slap**: the piston crosses the clearance and
hits the other wall. Large N means liner wear (oval wear in the plane of the rod), friction loss and noise.

### 6.4 Tangential and radial force on the crank pin – derivation
The rod force S acts on the pin along the rod. The rod direction is at angle (φ + β) to the crank arm. Split S into:
- **tangential** (perpendicular to the crank arm): F_t = S · sin(φ + β)
- **radial** (along the crank arm, towards the crank centre): F_r = S · cos(φ + β)

Sign convention of the program: F_t > 0 helps rotation (engine), F_t < 0 resists it (compression). The torque the motor must
give to overcome cylinder i is **M_i = −F_t,i · r**.

**Vector method (used in the program).** Instead of angles the program uses positions. Pin P = r(sin θ, cos θ), piston pin
Q = s·u (u = cylinder axis unit vector). Unit vector e = (Q − P)/l. Rod force on the pin F_p = −S·e. Then

  F_t = F_p · (dP/dθ) / r  F_r = −F_p · P / r

This is the same as the angle formulas but needs no case distinction for the two cylinders and works for any V angle.

**Run it** – check of both methods (`ch58`, cylinder 1):
```
theta 270: phi1 315.0, S 1866.6, Ft prog -1536.66, -S sin(phi+beta) 1536.66, Fr prog 1059.64, S cos(phi+beta) 1059.64, Ft*r -35.343
theta 300: phi1 345.0, S 2568.2, Ft prog -827.31, -S sin(phi+beta) 827.31, Fr prog 2431.25, S cos(phi+beta) 2431.25, Ft*r -19.028
theta 330: phi1 15.0, S 1476.0, Ft prog 475.48, -S sin(phi+beta) -475.48, Fr prog 1397.32, S cos(phi+beta) 1397.32, Ft*r 10.936
```
F_t from the program equals **S sin(φ+β)** (the column "−S sin" has the opposite sign, as it should) and F_r equals
S cos(φ+β) exactly. At θ = 270° cylinder 1 is in compression (φ₁ = 315°): F_t = −1537 N resists rotation; the motor must
give 35.3 N·m for this cylinder. At θ = 330° (φ₁ = 15°, just after TDC) the compressed air in the clearance volume
expands and pushes the piston: F_t = +475 N gives 10.9 N·m back to the shaft (energy recovery of the re-expansion).

### 6.5 Drive torque by virtual work – derivation and proof
Power balance with constant ω and the two-mass model (rotating masses do no work at constant speed):

  M_drive · ω = Σ_i (F_g,i + m_osc s̈_i) · ṡ_i  and ṡ = (ds/dφ) ω

  **M_drive = Σ_i (F_g,i + m_osc s̈_i) · ds_i/dφ = Σ_i F_i · ds_i/dφ**

This needs no rod or pin forces at all. The program computes the torque both ways and the self-test proves they agree:

**In the program** (`forces_at()`, core lines):
```python
        k = kin(phi, r, l, w)
        p = gas_pressure(phi, P, geo)
        Fg = (p - pcc) * A                                          # towards crank
        m_osc = M["m_osc"]
        Fax = Fg + m_osc * k["a"]                                   # axial force the rod must give the piston
        S = Fax / math.cos(k["beta"])                               # rod force, compression +
        N = Fax * math.tan(k["beta"])                               # piston side force on liner
        Q = (k["s"] * u[0], k["s"] * u[1])                          # piston pin position
        e = ((Q[0] - Ppin[0]) / l, (Q[1] - Ppin[1]) / l)            # unit vector pin -> piston pin
        Fp = (-S * e[0], -S * e[1])                                 # rod force acting on crank pin
        F_pin[0] += Fp[0]
        F_pin[1] += Fp[1]
        M_vw += Fax * k["ds"]                                       # = drive torque (two-mass, constant w)
        ...
    M_vec = -(F_pin[0] * dP[0] + F_pin[1] * dP[1])                  # drive torque from vector forces
```
**Run it** – `python crank.py selftest`:
```
drive torque: virtual work = pin-force vector method       OK   max diff 2.84e-14 N m
piston equilibrium S cos(beta) = Fg + m_osc a              OK
```
The difference is 3·10⁻¹⁴ N·m – rounding only. Two independent derivations give the same torque: this is the kind of
**verification** chapter 7 of guide M1 asks for before you trust a model.

### 6.6 The force table – row by row
`python crank.py examples` prints cylinder 1 (its TDC is at θ = −45° = 315°):
```
theta  p[bar]  F_gas[N]  F_inertia[N]  S_rod[N]  N_side[N]  M_drive_total[Nm]
  315   9.464    2804.2       255.2    2549.0      -0.0      8.23
    0   1.527     170.5       144.6      26.3       4.8     34.84
   45   0.962     -16.8       -53.7      38.2       9.8     -0.85
   90   0.962     -16.8      -142.9     128.2      23.2     -2.17
  135   0.962     -16.8      -151.3     134.5       0.0     -0.85
  180   1.118      34.8      -142.9     180.6     -32.6      0.68
  225   1.929     304.0       -53.7     370.0     -94.6      8.23
  270   6.981    1980.5       144.6    1866.6    -337.3     37.70
```
| θ | Cylinder 1 is… | What you see |
|---|---|---|
| 315° | at TDC (φ₁ = 0) | p = discharge 9.46 bar abs, F_g = 2804 N. Inertia F_i = +255 N pulls the piston away from the crank → S = 2804 − 255 = 2549 N. β = 0 → N = 0. |
| 0° | 45° after TDC | Clearance air has expanded to 1.53 bar. Gas 171 N almost cancelled by inertia → S only 26 N. Total torque 34.8 N·m comes from **cylinder 2**, which is now in compression. |
| 45° … 135° | suction stroke | p = 0.962 bar (suction loss 5 %): F_g = −16.8 N (slight vacuum pulls the piston outward). The rod force is pure inertia (38–135 N). |
| 180° | 225° after TDC (compression starts) | p rises to 1.12 bar; inertia still dominates. |
| 225° | BDC + 90°… | 1.93 bar, S = 370 N. N = −95 N: side force has changed wall (compression side). |
| 270° | late compression | 6.98 bar, F_g = 1981 N, S = 1867 N, side force **−337 N**. Total torque 37.7 N·m. |

Extremes over the revolution (`ch58`):
```
max S cyl1 at theta 277.0 (phi1 322.0)
min S cyl1 at theta 13.5 (phi1 58.5) S -101.8
max |N| cyl1 at phi1 322.0 N -419.1
```
- **Maximum rod compression 2664 N** at φ₁ = 322° (38° before TDC): discharge pressure is reached while β is still large.
  Not at TDC – at TDC the inertia (255 N) is subtracted.
- **Maximum rod tension −102 N** at φ₁ = 58.5° (suction stroke, inertia pulls). Small, because this is a compressor: the
  big tension of an engine at the exhaust TDC does not occur (gas pressure at TDC is the highest of the cycle).
  The rod bolts are therefore sized by **preload for the joint and assembly**, not by inertia (VDI 2230, item M7).
- **Maximum side force 419 N** at the same angle as the max rod force. Liner wear mark appears on the thrust side.

### 6.7 Crank-pin polar diagram and main bearing load
`python crank.py run` writes **pin_polar.svg**: the tip of the force vector on the pin over one revolution, in frame axes.
- Rod 1 alone: a long loop in the direction of cylinder 1 (peak 2664 N) with a small inertia loop.
- Resultant of both rods: two loops at ±45° – the pin is loaded in two directions, 90° apart.

Bearing loads (`bearing_loads()`):
```
rod_bearing_max_N 2663.6, rod_bearing_cubic_N 1387.1, pin_resultant_max_N 2684.3,
main_total_max_N 2824.2, main_total_cubic_N 1862.9, rod_S_max_comp_N 2663.6, rod_S_max_tension_N -101.8,
side_force_max_N 419.1, p_rod_bearing_MPa 4.9
```
- **Specific load of the rod bearing** p = F_max / (d · b) = 2664 / (30 · 18) = **4.93 MPa**. For a needle bearing this is
  low; for a plain bush (bronze CuSn8, oil splash) typical allowable 10–20 MPa (check the bush maker). OK.
- **Main bearings (both together):** peak 2824 N, cubic mean **1863 N**. The cubic mean F_m = (Σ F³/n)^(1/3) is the
  equivalent constant load for rolling-bearing life (ISO 281 uses the cubic mean for variable load, ball bearings p = 3).
  It goes into item M4 (bearings). Split between the two main bearings with the lever arms of your shaft layout.
- The main bearing load includes rod forces + rotating centrifugal forces − counterweight force:
  ```python
  F_main = (F_pin[0] + M["m_rot_cyl"] * 2 * r * w * w * cen[0] + (P["m_crank_unbal_kg"] - m_cw) * r * w * w * cen[0], ...)
  ```
  A full counterweight (chapter 8) also lowers the main bearing load near TDC, because it acts against the inertia.

**Practice links.** Rod force → conrod shank buckling + big-end bolt joint (items M3/M7). Side force → liner honing
(plateau honing, guide 49) and piston skirt profile. Polar diagram → oil hole position in the pin: put it where the load is
**lowest** (here near 135°/225° in pin coordinates – read from the plot) so the oil film is not weakened at peak load.

**MATLAB equivalent (6.2–6.5), one cylinder:**
```matlab
D=0.065; A=pi/4*D^2; r=0.023; l=0.090; w=1450*2*pi/60; mosc=0.3833;
phi=deg2rad(0:0.5:359.5); s=r*cos(phi)+sqrt(l^2-(r*sin(phi)).^2);
ds=gradient(s,phi); d2s=gradient(ds,phi); a=d2s*w^2; be=asin(r/l*sin(phi));
p=...;  % pressure vector from chapter 4 model
Fg=(p-1.013e5)*A; F=Fg+mosc*a; S=F./cos(be); N=F.*tan(be);
Ft=S.*sin(phi+be); Fr=S.*cos(phi+be); Mdrive=F.*ds;   % = -Ft*r
max(abs(Mdrive+Ft*r))   % ~0 (numerical)
```

**Check questions.** (1) Why is the maximum rod force not at TDC? (2) Show with the virtual-work formula that rotating
masses give no torque at constant speed. (3) Where would you put the oil hole in the crank pin? (4) What changes in the
force table at 0.6 MPa discharge?

---

## 7 Torque, energy fluctuation and flywheel

> Program: `torque_analysis()`, `single_cyl_orders()`, `twin_order_factor()`, `flywheel_rim()`, `rim_stress()`,
> `runup_time()`.

### 7.1 Mean torque and power – the energy check
Over one revolution the inertia forces give zero net work (kinetic energy returns to the same value). Only the gas work
remains. So

  M_mean = (1/2π) ∮ M_drive dθ = P_ind / ω

**Run it** (`examples` / `selftest`):
```
mean 10.41 N m (shaft power 1581 W), max 47.77, min -12.64 N m, dE 37.56 J
mean torque * w = indicated power (+-0.5 %)                OK   1580.6 W vs 1580.6 W
no gas -> mean drive torque = 0                            OK   1.67e-17
```
The torque integral (force model) and the p-V area (thermodynamic model) are **two independent calculations** of the same
power. They agree to 0.1 W. With gas switched off the mean torque is 0 – the inertia part is pure exchange.
Real shaft power adds friction: P_shaft = P_ind / η_mech; with η_mech ≈ 0.85 (example) → 1.86 kW. The 3 kW motor has margin
for 0.9 MPa, dirty filters and voltage drop.

### 7.2 Shape of the torque curve (torque.svg)
The curve has two big humps per revolution, 90° apart (one per cylinder compression), peak **47.8 N·m**, and a negative
dip to **−12.6 N·m** where the re-expansion of both cylinders drives the shaft. The **uniformity** (M_max − M_min)/M_mean
= **5.80** – a piston compressor is a very uneven load. Without inertia on the shaft the speed would collapse in every
compression and the motor current would pulse.

### 7.3 Harmonic orders – and why orders 2, 6, 10 vanish for the V90
Write the drive torque as a Fourier series in crank angle:

  M(θ) = M₀ + Σ_k M_k cos(kθ + ψ_k)  (order k = k times per revolution)

The program computes M_k by DFT (`torque_analysis()`, loop `for h in range(1, 9)`).

**Derivation of the cancellation.** Both cylinders are identical; cylinder 2 runs the same torque curve shifted by the
phase δ = 90° of crank angle: M₂(θ) = M₁(θ − δ). In the complex form one order of the sum is

  M_k,total = M_k,1 · (1 + e^(−i k δ))  → |1 + e^(−i k δ)| = 2 |cos(k δ / 2)|

For δ = 90°: factor = 2|cos(45° k)| → k = 1: √2, **k = 2: 0**, k = 3: √2, k = 4: 2, k = 5: √2, **k = 6: 0**, ...,
**k = 10: 0**. Orders 4 and 8 add fully (factor 2).

**In the program** (`single_cyl_orders()`, `twin_order_factor()`):
```python
def twin_order_factor(k, phase_deg=90.0):
    return 2 * abs(math.cos(math.radians(k * phase_deg) / 2))
```
**Run it:**
```
twin orders: 1: 15.409, 2: 0.000, 3: 10.353, 4: 10.548, 5: 4.146, 6: 0.000, 7: 0.747, 8: 0.942
single cylinder orders (amp, phase): 0: 5.205, 1: 10.896, 2: 8.103, 3: 7.321, 4: 5.274, 5: 2.931, 6: 1.262, ...
twin factor 2|cos(k*45)|: 1: 1.414, 2: 0.000, 3: 1.414, 4: 2.000, 5: 1.414, 6: 0.000, 7: 1.414, 8: 2.000, ...
predicted twin amp = single*factor: 1: 15.409, 2: 0.000, 3: 10.353, 4: 10.548, 5: 4.146, 6: 0.000, 7: 0.747, 8: 0.942
```
Single cylinder × factor = twin, to the last digit. The mean is 2 × 5.205 = 10.41 N·m.

**Use of the orders.**
| Use | How |
|---|---|
| Torsional vibration of motor–belt–crank | Excitation frequency of order k: f_k = k · n/60 = k · 24.17 Hz. Keep each torsional natural frequency ≥ 20 % away from strong orders (1, 3, 4, 5 → 24, 72, 97, 121 Hz). |
| Belt | Order 1 (15.4 N·m) and 3–4 (≈ 10.5 N·m) make belt-tension pulses → belt slip and wear; the flywheel inertia filters them. |
| Flexible coupling (direct drive) | Coupling is sized for M_mean × service factor and checked for the alternating torque amplitude (strongest orders) at the excitation frequency (coupling catalogue, e.g. DIN 740-2 method). |
| Noise / structure | 2nd order of the *torque* is zero, but the 2nd order of the *shaking force* is not (chapter 8). |

### 7.4 Energy fluctuation and flywheel – derivation
Kinetic energy of the shaft system: E = ½ J ω². Between two angles the change of E equals the work of the torque surplus:

  ΔE(θ) = ∫ (M_motor − M_drive) dθ ≈ ∫ (M_mean − M_drive) dθ  (motor torque ≈ constant over one revolution)

ΔE_max = (max − min) of this cumulative integral. With ω_max and ω_min:

  ΔE_max = ½ J (ω_max² − ω_min²) = J · ω_mean · (ω_max − ω_min) = J ω² δ

  **J = ΔE_max / (δ ω²)**,  δ = (ω_max − ω_min)/ω_mean (coefficient of speed fluctuation)

Typical δ: compressors and pumps 1/20–1/50, generators 1/100–1/300 (example values from machine-design textbooks).

**In the program** (`torque_analysis()`):
```python
    Mm = sum(Ms) / n
    E, Emin, Emax = 0.0, 0.0, 0.0
    for m in Ms:
        E += (m - Mm) * dth
        Emin, Emax = min(Emin, E), max(Emax, E)
    dE = Emax - Emin
    J_need = dE / (P["speed_fluct_coeff"] * w * w)
    J_motor_red = P["J_motor_kgm2"] * P["belt_ratio"] ** 2     # motor inertia seen at the crank
    J_fly = max(0.0, J_need - J_motor_red)
```
**Reflected inertia.** The motor turns i = 2.02 times faster. Same kinetic energy: ½ J_m (i ω)² = ½ (J_m i²) ω² → seen at the
crank the motor counts **J_m · i²** = 0.0055 · 2.02² = 0.0224 kg·m². A belt drive "multiplies" the motor rotor inertia.

**Run it:**
```
M_mean 10.409, ... dE 37.563 J, J_need 0.0815, J_motor_red 0.0224, J_fly 0.0590, uniformity 5.80
```
→ with δ = 0.02: J_need = 37.56 / (0.02 · 151.8²) = **0.0815 kg·m²**; the motor gives 0.0224; the crank-side
pulley/flywheel must give **0.0590 kg·m²**.

### 7.5 Flywheel / heavy pulley design
Most of the inertia should sit at large radius (rim). For a rim (hollow cylinder, outer R_o, inner R_i, width b, density ρ):

  J = m (R_o² + R_i²)/2,  m = ρ π (R_o² − R_i²) b  → m = 2J/(R_o² + R_i²), b = m/(ρπ(R_o² − R_i²))

Rim stress of a thin rotating ring: **σ = ρ v²** (v = R_o ω). Grey iron flywheels: keep v ≤ 30–40 m/s typical
(σ about 6–12 MPa; the limit comes from casting defects and low ductility, not from the static strength).

**In the program** (`flywheel_rim()`, `rim_stress()`):
```python
def flywheel_rim(J_need, R_o, R_i, rho=7200.0):
    m = 2 * J_need / (R_o ** 2 + R_i ** 2)
    b = m / (rho * math.pi * (R_o ** 2 - R_i ** 2))
    return {"m_kg": m, "b_m": b}

def rim_stress(rho, v):
    return rho * v * v
```
**Run it:**
```
flywheel rim Ro 101 Ri 80: m 7.11 kg, width 82.7 mm, rim v 15.34 m/s, sigma 1.69 MPa
flywheel rim Ro 150 Ri 125: m 3.10 kg, width 19.9 mm, v 22.78 m/s, sigma 3.74 MPa
grey iron v limit check: v at 35 m/s -> sigma 8.82 MPa
```
**Interpretation.** Putting the 0.059 kg·m² into the Ø202 mm driven pulley would need an 83 mm wide, 7.1 kg rim – too
heavy and too wide. A **Ø300 mm flywheel-pulley** (rim 150/125 mm) needs only 3.1 kg and 20 mm rim width; rim speed
22.8 m/s and σ = 3.7 MPa are safe for EN-GJL-250. The larger driven pulley changes the belt ratio, so the motor pulley
grows with it (2.02 × … ) – check belt speed (item M9). This is why small compressors have a big **finned flywheel
pulley**: the fins also blow cooling air over the cylinders (two functions, one part – design principle "integration").
Manufacturing: cast EN-GJL-250, turn rim + bore in one set-up, balance as single-plane (static) to G6.3 (chapter 8.6),
groove profile to ISO 4183 / maker standard.

### 7.6 Start-up: motor torque and run-up time
Direct-on-line (DOL) induction motors give 2–3 × nominal torque during run-up (motor data sheet: M_A/M_N, M_K/M_N).
Estimate with constant average torques:

  t_run-up = J_total · ω / (M_motor,avg − M_load,avg)  (all at the crank side)

**Run it:**
```
run-up: T_N 9.78 N m motor, x2 avg -> 39.50 N m at crank, J_total 0.0815, M_load_mean 10.41 -> t 0.425 s
run-up unloaded start (valve unloader): t 0.313 s
peak torque vs motor: M_max 47.77 at crank = 23.65 N m at motor vs T_N 9.78
```
- Motor 3 kW, 2930 rpm: T_N = 9550 · 3/2930 = 9.78 N·m; ×2 average × belt ratio 2.02 → 39.5 N·m at the crank.
- Run-up loaded 0.43 s, with an unloader (cylinder vented at start) 0.31 s. Both short → star-delta start not needed for
  thermal reasons at this size; but check the motor's allowed starts per hour (pressure-switch cycling).
- The instantaneous peak 47.8 N·m at the crank equals 23.7 N·m at the motor = 2.4 × T_N. Without inertia the motor would
  have to follow this; with the flywheel it sees nearly the mean 10.4/2.02 = 5.2 N·m plus a ±1 % speed ripple.

**MATLAB equivalent (7.1–7.6):**
```matlab
M = Mdrive_total;                    % vector over 0..360 deg (from chapter 6 / crank.csv column 8)
th = deg2rad(0:0.5:359.5); dth = th(2)-th(1); w = 1450*2*pi/60;
Mm = mean(M); E = cumsum((M-Mm)*dth); dE = max(E)-min(E);
J = dE/(0.02*w^2); Jm = 0.0055*2.02^2; Jfly = J - Jm
c = fft(M)/numel(M); amp = 2*abs(c(2:9))       % orders 1..8
Ro=0.150; Ri=0.125; m=2*Jfly/(Ro^2+Ri^2); b=m/(7200*pi*(Ro^2-Ri^2)); sig=7200*(Ro*w)^2/1e6
```
(Check: `crank.csv` from `python crank.py run` contains M_drive per 0.5° – load it with `readmatrix` and compare.)

**Check questions.** (1) Why does order 4 of the twin equal twice the single-cylinder order 4? (2) What J is needed for
δ = 1/50? (3) Why is the motor inertia multiplied by i²? (4) What limits the rim speed of a cast-iron flywheel?

---

## 8 Balancing and vibration isolation

> Program: `balancing()`, `iso21940()`, `v_angle_compare()`, `transmissibility()`, `mount_design()`; plot `shaking.svg`.

### 8.1 Shaking force of one cylinder – primary and secondary
The gas force is an **internal** force: it pushes the piston and the cylinder head with the same force in opposite
directions. It does not shake the frame (it gives the torque reaction only). What shakes the frame are the **inertia
forces**. From the series acceleration (chapter 3), the inertia force of the oscillating mass along the cylinder axis is

  F_osc = m_osc r ω² (cos φ + λ cos 2φ + …)

  **F₁ = m_osc r ω² cos φ** (primary, once per revolution)  **F₂ = λ m_osc r ω² cos 2φ** (secondary, twice)

Rotating masses give the centrifugal force m_rot r ω² along the crank (rotating vector, constant size).
Example per cylinder: F₁,amp = 0.3833 · 0.023 · 151.8² = **203.3 N**, F₂,amp = 0.2556 · 203.3 = **51.95 N**.

### 8.2 Inline twin 180° (for comparison)
Two cylinders side by side, cranks at 180°: primary forces cancel (cos(φ + 180°) = −cos φ), secondary forces **add**
(cos 2(φ+180°) = cos 2φ) → 2F₂, plus a primary **rocking couple** F₁ × cylinder distance. That is why inline twins shake
at twice speed.

### 8.3 V90 twin on one crank pin – full derivation
Axis unit vectors (x horizontal, y up): cylinder 1 at γ₁ = −45°: u₁ = (−√2/2, √2/2); cylinder 2 at γ₂ = +45°:
u₂ = (√2/2, √2/2). Crank angle θ from the vertical; cylinder angles φ₁ = θ + 45°, φ₂ = θ − 45°.

**Primary:** F₁ [cos φ₁ u₁ + cos φ₂ u₂]
- x: (√2/2)[−cos(θ+45°) + cos(θ−45°)] = (√2/2) · 2 sin θ sin 45° = **sin θ**
- y: (√2/2)[cos(θ+45°) + cos(θ−45°)] = (√2/2) · 2 cos θ cos 45° = **cos θ**

→ primary resultant = **m_osc r ω² (sin θ, cos θ)**: a vector of **constant size m_osc r ω²** pointing along the crank, i.e.
it behaves exactly like a rotating mass m_osc at the pin. A counterweight can cancel it completely.

**Secondary:** λF₁ [cos 2φ₁ u₁ + cos 2φ₂ u₂]; cos 2φ₁ = cos(2θ + 90°) = −sin 2θ, cos 2φ₂ = cos(2θ − 90°) = sin 2θ
- x: (√2/2)(sin 2θ + sin 2θ) = √2 sin 2θ; y: (√2/2)(−sin 2θ + sin 2θ) = 0

→ secondary resultant = **√2 · λ m_osc r ω² · sin 2θ, horizontal** (perpendicular to the V bisector). It cannot be cancelled
by any counterweight on the crank (it would need two shafts turning at 2ω – Lanchester balancer, not used at this size).

**Counterweight rule for V90:**
  m_cw · r_cw = (m_rot + m_osc) · r   (m_rot = 2 m_A + crank unbalance; one m_osc, not two!)

**In the program** (`forces_at()` and `balancing()`):
```python
        shake[0] += -m_osc * k["a"] * u[0]           # inertia force of each piston along its axis
        shake[1] += -m_osc * k["a"] * u[1]
    ...
    m_rot = M["m_rot_cyl"] * len(P["cyl_angles_deg"]) + P["m_crank_unbal_kg"]
    m_cw = P["cw_balance_share"] * (m_rot + M["m_osc"]) if len(P["cyl_angles_deg"]) == 2 else ...
    F_rot = ((m_rot - m_cw) * r * w * w * cen[0], (m_rot - m_cw) * r * w * w * cen[1])
    shake_tot = (shake[0] + F_rot[0], shake[1] + F_rot[1])
```
**Run it** (`ch58`):
```
F1_per_cyl 203.281, F2_per_cyl 51.95, V90_secondary_theory 73.468, shake_osc_max 263.712, shake_residual_max 74.74,
m_cw_at_r 1.117, m_rot 0.733, rocking_couple_Nm 4.472
m_rot = 2*0.1667 + 0.40 = 0.7333; m_cw at r = 1.1167; at r_cw 35 mm: 0.7338 kg
max residual at theta 225.0: Fx 74.7 Fy -1.3
theta 0 residual Fx 0.00 Fy 1.26 ...
theta 45 residual Fx 74.73 Fy -1.26 ...
```
and the self-test:
```
V90 primary = constant rotating vector m_osc r w^2 (mean radial) OK   203.3 vs 203.3 N
V90 residual with counterweight ~ sqrt(2) F2 (+-10 %)      OK   74.7 vs 73.5 N
```
**Interpretation.**
- Without counterweight the frame sees up to 650 N (`v_angle_compare`, column "no cw"), from the oscillating masses
  (264 N) plus the unbalanced rotating mass 0.733 kg (≈ 389 N).
- With m_cw = 1.117 kg at r (= 0.734 kg at r_cw = 35 mm, or Σ m·r = 25.7 kg·mm) the residual is **74.7 N**, horizontal,
  twice per revolution (48.3 Hz). Theory √2 F₂ = 73.5 N; the extra 1.2 N is the 4th-order term (the small Fy = 1.26 N is
  also 4th order).
- The residual is max at θ = 45° and 225° (sin 2θ = ±1) and zero at θ = 0°, 90°: matches the derivation (sin 2θ, not
  cos 2θ, because θ is measured from the V bisector, not from a TDC).

**Bob weight (balancing machine).** The crankshaft is balanced alone on a balancing machine. The rods and pistons are
missing, so a **bob weight** is clamped on the pin to represent them: m_bob = 2 m_A + (share of m_osc). For the V90 with
the rule above the share is one full m_osc for the pin = 2 · 0.1667 + 0.3833 = 0.7167 kg (the `ch58` line prints this as
2·m_A + 2·m_osc·0.5). Then the machine balances to zero → the counterweight is right including the oscillating share.

### 8.4 Rocking couple
The two rods sit side by side on the pin, a = 22 mm apart (axial). Each cylinder's forces act in its own plane. The
primary part F₁ of each cylinder is offset by a → a couple about an axis perpendicular to the crankshaft:
order of magnitude M ≈ F₁ · a = 203.3 · 0.022 = **4.47 N·m** (`rocking_couple_Nm`). It is small but it rocks the unit
on its mounts (8.7). Counterweights split into both webs with slightly different masses can reduce the rotating part of it.

### 8.5 Other V angles – comparison
`v_angle_compare()` reruns the whole force model with cylinders at ±V/2 and scans the counterweight share:
```python
def v_angle_compare(P, angles=(60.0, 75.0, 90.0), shares=None):
    ...
    for V in angles:
        Q = dict(P); Q["cyl_angles_deg"] = [-V / 2, V / 2]; Q["step_deg"] = 2.0
        def mx(share):
            Q["cw_balance_share"] = share
            geo, M, rows = sweep(Q)
            return max(math.hypot(*x["shake"]) for x in rows), ...
        r1, osc, m_rot, m_osc = mx(1.0)
        r0, _, _, _ = mx(0.0)
        best = min(((mx(s)[0], s) for s in shares))
```
**Run it:**
```
V 60: no cw 740.3, osc only 351.4, cw share 1.0 148.2, best 148.2 at share 1.00
V 75: no cw 667.7, osc only 278.8, cw share 1.0 109.1, best 99.6 at share 0.96
V 90: no cw 650.5, osc only 263.7, cw share 1.0 74.7, best 74.7 at share 1.00
```
| V angle | Residual with best counterweight | Why |
|---|---|---|
| 60° | 148 N | primary is an **ellipse**, not a circle → a counterweight can cancel only part |
| 75° | 100 N (share 0.96) | ellipse closer to a circle |
| **90°** | **74.7 N** | primary is a perfect circle → fully balanced; only √2 F₂ remains |

The 90° V is the natural choice for a single-pin twin compressor. A narrower V saves width but shakes 1.3–2× more.

### 8.6 Rotor balance quality – ISO 21940-11
The crankshaft (with counterweights, without rods) is a rigid rotor. Its residual unbalance U = m · e (e = CG offset)
makes a rotating force U ω². ISO 21940-11 (formerly ISO 1940-1) defines **balance grades G** = e · ω in mm/s
(G6.3: e ω = 6.3 mm/s). Then

  e_per = G / ω,  U_per = m · e_per = m · G / ω = m G · 60 / (2π n)
  in practical units: **U_per [g·mm] = 9549 · G [mm/s] · m [kg] / n [rpm]**   (1000 · 60/(2π) = 9549)

**In the program** (`iso21940()`):
```python
def iso21940(P):
    U = 9549 * P["balance_grade_G"] * P["crank_rotor_mass_kg"] / P["rpm"]
    return {"U_per_gmm": U, "e_per_um": U / P["crank_rotor_mass_kg"], "per_plane_gmm": U / 2}
```
**Run it:**
```
ISO: {'U_per_gmm': 124.47, 'e_per_um': 41.49, 'per_plane_gmm': 62.23}
G2.5 -> U 49.4 g mm    G6.3 -> U 124.5 g mm    G16.0 -> U 316.1 g mm
e*w check G6.3: e = 41.49 um, e*w = 6.300 mm/s
two-plane (CG 40 mm from A, planes 100 mm apart): U_A 74.7, U_B 49.8 g mm
hole equivalent: 62.2 g mm at radius 40 mm -> 1.56 g -> steel drill Ø8 depth 3.9 mm
```
- Crankshaft 3.0 kg, 1450 rpm, **G6.3** (example; the grade for your rotor type comes from the ISO 21940-11 table and
  the customer – check the standard; crankshaft assemblies are often specified coarser, G16–G40, and the crankshaft alone
  finer): U_per = **124.5 g·mm**, e_per = 41.5 µm.
- The residual force U ω² = 124.5·10⁻⁶ kg·m · 151.8² = 2.9 N – negligible against the 74.7 N secondary. Balancing finer
  than G6.3 gives no benefit for this machine.
- **Two-plane allocation:** split U_per inversely to the plane distances from the CG: plane A (40 mm from CG, 100 mm
  span) gets U · 60/100 = 74.7 g·mm, plane B 49.8 g·mm (ISO 21940-11 allocation rule for planes outside / inside the
  bearings – check the standard for the exact case). The simple 50/50 split gives 62.2 g·mm per plane.

**Production balancing practice.**
1. Machine the counterweights to nominal (CAD static moment Σ m r = required value ± tolerance on the drawing).
2. Measure on a horizontal balancing machine with the bob weight on the pin.
3. Correct by **drilling** radial holes in the counterweight (removal) at the indicated angle. Example: 62.2 g·mm at
   r = 40 mm = 1.56 g → Ø8 mm drill about 3.9 mm deep in steel (cone tip ignored – use the balancing machine's
   hole calculator). Or by milling a flat.
4. Re-measure; record the residual unbalance per plane in the part record (traceability, guide 15).
5. Flywheel pulley: single-plane (static) balancing if width/diameter < about 0.2; same grade.

### 8.7 Vibration isolation of the compressor unit
The residual shaking force (and the torque reaction) go into the base frame and the floor or the air tank. Rubber mounts
reduce what is transmitted. For a single-degree-of-freedom mount (mass m on stiffness k, damping ratio ζ):

  f_n = (1/2π) √(k/m),  r = f/f_n
  **TR = √[(1 + (2ζr)²) / ((1 − r²)² + (2ζr)²)]**  (undamped: TR = 1/|1 − r²|)

Isolation starts only above r = √2 (TR < 1). Rule: **f_n ≤ f_exc / (2.5 … 3)**. Static deflection δ_st = g/(2π f_n)².

**In the program** (`transmissibility()`, `mount_design()`):
```python
def transmissibility(f, fn, zeta=0.0):
    r = f / fn
    return math.sqrt((1 + (2 * zeta * r) ** 2) / ((1 - r * r) ** 2 + (2 * zeta * r) ** 2))

def mount_design(m_kg, f_exc_hz, ratio=3.0, n_mounts=4, zeta=0.05, g=9.81):
    fn = f_exc_hz / ratio
    k = m_kg * (2 * math.pi * fn) ** 2
    return {"fn_hz": fn, "k_total_N_per_m": k, "k_mount_N_per_mm": k / n_mounts / 1000,
            "static_defl_mm": g / (2 * math.pi * fn) ** 2 * 1000,
            "TR_undamped": transmissibility(f_exc_hz, fn, 0.0), "TR_damped": transmissibility(f_exc_hz, fn, zeta),
            "load_per_mount_N": m_kg * g / n_mounts}
```
**Run it** (unit compressor + motor + frame 60 kg, example; lowest excitation = order 1 at 24.17 Hz; 4 mounts, ζ = 0.05):
```
ratio 3:   fn 8.06 Hz, k_total 153 710 N/m, k_mount 38.4 N/mm, static_defl 3.83 mm, TR 0.125 (undamped) / 0.130, load 147 N per mount
ratio 2.5: fn 9.67 Hz, k_mount 55.3 N/mm, static_defl 2.66 mm, TR 0.191 / 0.196
r 0.500 TR0 1.333 TR(0.05) 1.332 TR(0.2) 1.314
r 1.000 TR0 inf   TR(0.05) 10.050 TR(0.2) 2.693
r 1.414 TR0 1.001 TR(0.05) 1.001 TR(0.2) 1.000
r 2.000 TR0 0.333 TR(0.05) 0.339 TR(0.2) 0.412
r 3.000 TR0 0.125 TR(0.05) 0.130 TR(0.2) 0.193
transmitted residual force: 74.7 N x TR 0.130 = 9.7 N
2nd order (48.3 Hz) TR: 0.0333
```
**Interpretation.**
- Choose rubber mounts with about **38 N/mm** each at **147 N** load (≈ 15 kg per mount) and ≈ 4 mm static deflection.
  Then only 13 % of the order-1 forces and 3.3 % of the 2nd-order residual (74.7 N → 2.5 N) reach the floor.
  (The 9.7 N line is the conservative case: the whole residual taken at the order-1 TR.)
- Damping helps **only at resonance** (TR 10 instead of infinite at r = 1, run-up passes through f_n in < 0.5 s,
  chapter 7.6); above r = √2 more damping slightly **raises** TR (0.193 with ζ = 0.2 at r = 3). So use soft natural
  rubber (ζ ≈ 0.05), not very damped material.
- Real mounts have six rigid-body modes (bounce, rock, pitch, roll…). The rocking couple (8.4) and the torque reaction
  excite the rotational modes – put the mounts in the plane of the CG if possible and check all six frequencies (a small
  Adams / SOLIDWORKS Motion or MATLAB 6-DOF model).
- Flexible hoses for the discharge line are needed; a rigid pipe bypasses the mounts.

**Practice links.** Mount selection from catalogue (stiffness at the actual load, not nominal; rubber hardness 40–60 Shore A;
dynamic stiffness ≈ 1.2–1.4 × static for natural rubber – check datasheet). Field check: measure vibration velocity on the
compressor feet and on the frame (ISO 10816 / ISO 20816 family for reciprocating machines – ISO 10816-6 – check current
edition for limits).

**MATLAB equivalent (8.1–8.7):**
```matlab
mo=0.3833; r=0.023; w=1450*2*pi/60; lam=0.2556; th=deg2rad(0:1:359);
F1=mo*r*w^2; F2=lam*F1;
u1=[-1 1]/sqrt(2); u2=[1 1]/sqrt(2); p1=th+pi/4; p2=th-pi/4;
Fosc = F1*(cos(p1)'*u1+cos(p2)'*u2) + F2*(cos(2*p1)'*u1+cos(2*p2)'*u2);
mrot=0.7333; mcw=mrot+mo; Frot=(mrot-mcw)*r*w^2*[sin(th') cos(th')];
res = max(vecnorm(Fosc+Frot,2,2))           % ~ sqrt(2)*F2 = 73.5 N (2-term series)
U = 9549*6.3*3.0/1450                        % g mm
fn=24.17/3; k=60*(2*pi*fn)^2; TR=@(r,z) sqrt((1+(2*z*r).^2)./((1-r.^2).^2+(2*z*r).^2)); TR(3,0.05)
```

**Check questions.** (1) Show that the V90 primary force is a rotating vector of constant size. (2) Why can the secondary
not be removed by a counterweight? (3) Calculate the counterweight Σ m·r if the crank unbalance is 0.5 kg at r. (4) Why
does more damping raise the transmissibility above r = √2? (5) What balance grade makes sense when the residual secondary
force is 75 N?


---

## 9 Loads for component design – the hand-over to M3 (shaft), M4 (bearings), conrod and pins

> Program: `tools/crank.py` (functions `compute_all`, `bearing_loads`) and the chapter-9 functions `load_case_table`,
> `start_torque`, `cubic_mean`, `main_bearing_split`, `conrod_buckling`, `conrod_shank_fatigue`, `crankpin_check`,
> `gudgeon_pin_check`. All inputs are **example values** (default design D 65 mm unless stated).

### 9.1 Why load cases, not "the load"

Theory. A part does not see one force. It sees a **history** of forces over the crank angle, and this history changes with
the operating state. A design is safe only if it is safe in **every** state that can happen in its life. We therefore
define **load cases (LC)** – each one is a full crank revolution computed by the program with a different input.

| LC | State | What changes in the input | Used for |
|---|---|---|---|
| LC1 | Normal operation, 0.8 MPa gauge | default | Fatigue (10⁹ cycles), bearing life, wear |
| LC2 | Pressure switch fails, safety valve opens at 0.99 MPa gauge (≈ 1.1 × 0.9 MPa) | `p_dis_gauge_MPa: 0.99` | Static strength, buckling, peak bearing load |
| LC3 | Start (motor start torque, cold oil) | motor data, not the cycle | Shaft torsion, key, belt slip (M3, M9) |
| LC4 | Fault: sticking / dirty discharge valve at safety-valve pressure | `0.99` + `dp_discharge_rel: 0.10` | Static "worst credible" case |

Rule: **fatigue is checked with LC1** (it acts 10⁹ times); **static strength with LC2/LC4** (they act rarely but are the
highest). LC4 is the "worst credible" load; if a part survives LC4 with a static safety factor ≥ 1.5 against yield, it is
not the weak point.

**In the program**

```python
LOAD_CASES = {
    "LC1 normal 0.8 MPa": {},
    "LC2 safety valve 0.99 MPa": {"p_dis_gauge_MPa": 0.99},
    "LC4 fault: sticking discharge valve": {"p_dis_gauge_MPa": 0.99, "dp_discharge_rel": 0.10},
}

def load_case_table(P=None):
    """Run compute_all() for each load case; return the key loads per case."""
    base = dict(DEFAULT if P is None else P)
    out = {}
    for name, upd in LOAD_CASES.items():
        Q = dict(base)
        Q.update(upd)
        R = compute_all(Q)
        out[name] = {"M_max": R["tq"]["M_max"], "M_mean": R["tq"]["M_mean"], "P_ind": R["cyc"]["P_ind_W"],
                     "rod_max": R["brg"]["rod_bearing_max_N"], "rod_cubic": R["brg"]["rod_bearing_cubic_N"],
                     "main_max": R["brg"]["main_total_max_N"], "S_comp": R["brg"]["rod_S_max_comp_N"],
                     "S_tens": R["brg"]["rod_S_max_tension_N"], "N_side": R["brg"]["side_force_max_N"],
                     "p_rod": R["brg"]["p_rod_bearing_MPa"], "fad": R["cyc"]["fad_m3h"]}
    return out
```

The same can be done from the command line with a JSON file per load case:

```
echo {"name": "LC2", "p_dis_gauge_MPa": 0.99} > lc2.json
python crank.py run --in lc2.json --out lc2_out
```

**Run it** (default design D 65 mm, 1450 rpm):

| Quantity | LC1 normal | LC2 0.99 MPa | LC4 fault |
|---|---|---|---|
| Drive torque max M_max [N m] | 47.77 | 54.46 | 56.03 |
| Mean torque [N m] / indicated power [W] | 10.41 / 1581 | 10.76 / 1633 | 10.81 / 1641 |
| Rod (crank-pin) bearing load max [N] | 2664 | 3311 | 3489 |
| Rod bearing load cubic mean [N] | 1387 | 1695 | 1777 |
| Main bearings (both together) max [N] | 2824 | 3469 | 3645 |
| Rod force: max compression / max tension [N] | 2664 / −102 | 3311 / −69 | 3489 / −61 |
| Piston side force max [N] | 419 | 473 | 486 |
| Rod bearing specific pressure p [MPa] | 4.93 | 6.13 | 6.46 |
| FAD [m³/h] | 16.58 | 15.23 | 14.87 |

Interpretation. (1) Going from LC1 to LC4 raises the peak loads by ≈ 31 % (2664 → 3489 N) but the mean torque by only 4 %:
peak loads follow the peak pressure, the mean torque follows the area of the p-V loop. (2) The rod is almost never in tension
(−102 N): in a compressor the gas force acts during compression near TDC, where the inertia force also acts towards the head
only weakly at 1450 rpm. In a fast engine the tension case dominates the small end; here it does not. (3) FAD falls at higher
pressure – the clearance gas re-expands longer (chapter 4).

**LC3 start.**

```python
def start_torque(P_motor_kW=3.0, n_motor=2930.0, k_start=2.5, belt_ratio=2.02):
    """LC3 start: motor locked-rotor / breakdown torque reflected to the crank (belt losses ignored)."""
    T_nom = 9550 * P_motor_kW / n_motor
    return {"T_motor_nom": T_nom, "T_motor_start": k_start * T_nom, "T_crank_start": k_start * T_nom * belt_ratio}
```

Run: T_motor_nom = 9550·3/2930 = **9.78 N m**, start torque 2.5 × = **24.4 N m**, at the crank × 2.02 = **49.4 N m**.
This is the static torque for the crankshaft and key (M3) and for the belt slip check (M9). Note 49.4 N m is close to the
peak gas torque of LC1 (47.8 N m): the shaft must carry both, but not at the same time with full amplitude.

### 9.2 Bearing specific pressure p = F/(d·b)

Theory. A plain bearing carries the load by an oil film. The mean pressure on the projected area d·b is the first, simple
measure of how hard the bearing works:

  **p = F / (d · b)**    [N/mm² = MPa]  F peak load, d journal diameter, b bearing width

For a rolling (needle) bearing p is not the criterion – there one uses the dynamic load rating C and life L10 (M4). p is
still useful to compare concepts.

**In the program** (`crank.py`, `bearing_loads`):

```python
    rod1 = [math.hypot(*x["cyl"][0]["Fp"]) for x in rows]
    ...
    p_rod = max(rod1) / (P["pin_d_mm"] * P["rod_bearing_b_mm"])     # N/mm2 = MPa
```

Run: d = 30 mm, b = 18 mm per rod → LC1 **4.93 MPa**, LC2 **6.13 MPa**, LC4 **6.46 MPa**.

Typical permissible **peak** specific pressures (orientation, check the bearing maker's data):

| Bearing type | Typical limit p_max (peak) | Comment |
|---|---|---|
| Plain bearing, white metal (tin babbitt) | ≈ 10–15 MPa | Soft, embeds dirt, low fatigue strength |
| Plain bearing, Al-Sn / Al-Si bimetal | ≈ 25–40 MPa | Standard in car engines and many compressors |
| Plain bearing, lead-free bronze, sintered bronze bushing | ≈ 15–30 MPa (dynamic) | Small ends, low speed |
| Needle roller bearing (rod big end) | not by p → C, L10 (M4) | Needs hardened raceway (pin 58–62 HRC) or inner ring |

So 6.5 MPa is low for a bimetal plain bearing. For a small compressor with splash lubrication, needle bearings in the big end
are common (no oil pump). The choice is made in M4 with the cubic-mean load below.

### 9.3 Cubic-mean equivalent load for rolling bearings (input to ISO 281)

Derivation. The basic life of a ball/roller bearing at a constant load P is (ISO 281)

  L10 = (C / P)^p   [10⁶ revolutions],  p = 3 ball, p = 10/3 roller

The damage per revolution is therefore proportional to P^p. For a load that changes over the revolution in N equal angle steps
(equal time steps, constant speed), the total damage of one revolution is Σ P_i^p / N. The **equivalent constant load P_m**
gives the same damage:

  P_m^p = (1/N) · Σ |F_i|^p   →   **P_m = ( Σ |F_i|³ / N )^(1/3)**   (cubic mean, p = 3)

For rollers use p = 10/3; the difference is small (a few %). The cubic mean is always between the arithmetic mean and the
maximum, and closer to the maximum when the load has short peaks – exactly our case.

**In the program**

```python
def cubic_mean(vals):
    """P_m = (sum |F|^3 / N)^(1/3) - equal angle steps at constant speed = equal time steps."""
    return (sum(abs(v) ** 3 for v in vals) / len(vals)) ** (1.0 / 3.0)
```

Run: rod bearing LC1 **max 2664 N, cubic mean 1387 N** (P_m / F_max = 0.52). Main bearings together max 2824 N, cubic mean
1863 N (higher ratio, because the rotating forces are always present).

Practice. For M4 you give the bearing maker (or the ISO 281 calculation): P_m, speed, temperature, lubrication (κ), and
**the angle of the load relative to the ring**. The rod big-end bearing rotates relative to the load (outer ring = rod,
point load on the pin) – this decides which ring needs the tight fit.

### 9.4 Main bearing loads per bearing – two-bearing beam split with belt pull

Theory. The program gives the **net force in the crank-pin plane** F_main(θ) = rod forces + rotating centrifugal forces −
counterweight. The real crankshaft has two main bearings A and B and an overhung pulley. Treat the crankshaft as a rigid beam:

```
   pulley (belt pull Fb)        A                 pin plane F_main        B
        |<--- 45 mm --->|<-------- 40 mm -------->|<------ 40 mm ------>|
  z =  -45              0                         40                    80
```

Equilibrium of the shaft (reactions R_A, R_B on the shaft, vectors in the x-y plane):

  Moment about A:  R_B · L + F_main · z_p + F_b · z_b = 0  →  **R_B = −(F_main · z_p + F_b · z_b) / L**
  Forces:          **R_A = −F_main − F_b − R_B**

Belt pull. The tangential belt force is F_t = 2·M/d_p. The shaft load of a V-belt drive is larger because of the pre-tension:
F_b = (T₁ + T₂) ≈ k · F_t with k ≈ 1.5–2.5 for V-belts (k comes from the belt-maker's pre-tension rule; M9). Here k = 2.5,
belt horizontal (90° from vertical, towards the motor).

**In the program**

```python
def main_bearing_split(P=None, L_ab_mm=80.0, z_pin_mm=40.0, z_pulley_mm=-45.0, d_pulley_mm=202.0,
                       belt_factor=2.5, belt_dir_deg=90.0):
    Q = dict(DEFAULT if P is None else P)
    geo, M, rows = sweep(Q)
    tq = torque_analysis(Q, geo, rows)
    Ft = 2 * tq["M_mean"] / (d_pulley_mm / 1000)
    Fb = belt_factor * Ft
    bd = math.radians(belt_dir_deg)
    Fbv = (Fb * math.sin(bd), Fb * math.cos(bd))
    L, zp, zb = L_ab_mm, z_pin_mm, z_pulley_mm
    RA, RB = [], []
    for x in rows:
        F = x["F_main"]
        rbx = -(F[0] * zp + Fbv[0] * zb) / L
        rby = -(F[1] * zp + Fbv[1] * zb) / L
        rax = -F[0] - Fbv[0] - rbx
        ray = -F[1] - Fbv[1] - rby
        RA.append(math.hypot(rax, ray))
        RB.append(math.hypot(rbx, rby))
    return {"F_t": Ft, "F_belt": Fb, "A_max": max(RA), "A_cubic": cubic_mean(RA), "B_max": max(RB),
            "B_cubic": cubic_mean(RB)}
```

Run (LC1, default design): F_t = 2·10.41/0.202 = **103 N**, F_b = 2.5·103 = **258 N**.
Bearing A (pulley side): **max 1661 N, cubic mean 990 N**. Bearing B: **max 1529 N, cubic mean 950 N**.

Interpretation. Bearing A is more loaded because the overhung belt pull adds lever action (z_b = −45 mm). The two cubic means
(990 / 950 N) are the inputs for the M4 bearing selection. The model is statically determinate (two supports); a third
bearing would need a stiffness model (M3).

### 9.5 Conrod: buckling under maximum compression

Theory. The conrod is a strut loaded by S (compression +). It can fail by **buckling** before the material yields if it is
slender. Two planes must be checked:
- **In the plane of motion**: both eyes rotate freely on their pins → pinned-pinned, effective length factor K = 1.
- **Out of the plane**: the wide bearings hold the eyes almost clamped → K ≈ 0.5 (use 0.5–0.7 to be careful).

Slenderness λ = K·L / i, radius of gyration i = √(I/A). The transition slenderness λ_T = π·√(2E/R_p) separates the two laws:

  Euler (λ ≥ λ_T): **σ_cr = π² E / λ²**
  Johnson parabola (λ < λ_T): **σ_cr = R_p − (R_p · λ / 2π)² / E**

Safety against buckling n = σ_cr · A / S_max (aim ≥ 3 for conrods, because of eccentric loading and bending from
inertia of the shank).

**In the program**

```python
def conrod_buckling(S_max, L_mm=90.0, b_mm=10.0, h_mm=16.0, E=75000.0, Rp=140.0, K_in=1.0, K_out=0.5):
    A = b_mm * h_mm
    res = {"A_mm2": A, "sigma_c": S_max / A}
    for plane, I, K in (("in-plane", b_mm * h_mm ** 3 / 12, K_in), ("out-of-plane", h_mm * b_mm ** 3 / 12, K_out)):
        i = math.sqrt(I / A)
        lam = K * L_mm / i
        lam_T = math.pi * math.sqrt(2 * E / Rp)
        if lam >= lam_T:
            scr = math.pi ** 2 * E / lam ** 2
            law = "Euler"
        else:
            scr = Rp - (Rp * lam / (2 * math.pi)) ** 2 / E
            law = "Johnson"
        res[plane] = {"i_mm": i, "lambda": lam, "lambda_T": lam_T, "sigma_cr": scr, "law": law,
                      "n_buckling": scr * A / S_max}
    return res
```

Run (LC2, S_max = 3311 N; shank 10 × 16 mm, die-cast aluminium EN AC-46000 type, E ≈ 75 GPa, R_p0.2 ≈ 140 MPa –
typical, check the casting certificate):

| Plane | i [mm] | λ | λ_T | Law | σ_cr [MPa] | n |
|---|---|---|---|---|---|---|
| In-plane (K = 1) | 4.62 | 19.5 | 102.8 | Johnson | 137.5 | **6.64** |
| Out-of-plane (K = 0.5) | 2.89 | 15.6 | 102.8 | Johnson | 138.4 | **6.69** |

Mean compressive stress σ_c = 3311/160 = 20.7 MPa. Interpretation: the rod is short and stocky (λ ≈ 20 ≪ 103); buckling
does not govern. The two planes are nearly equal – a good design balances them (that is why conrods use I-sections). The
real limit for this rod is the **eye** (bearing bore distortion) and **fatigue** at the shank-to-eye transitions.

### 9.6 Conrod shank fatigue (link to M1 chapter 26)

The rod force alternates between S_max (compression, gas) and S_min (tension, inertia) every revolution. Stress amplitude
and mean:

  σ_a = (S_max − S_min) / (2A),  σ_m = (S_max + S_min) / (2A),  Goodman: 1/n = σ_a/S_e + σ_m/R_m

(compression is positive here; for a compressive mean stress the Goodman line is conservative – many guidelines allow
n = S_e/σ_a for σ_m < 0, see FKM in M1 ch. 26).

```python
def conrod_shank_fatigue(S_max, S_min, A_mm2=160.0, Rm=240.0, Se=60.0):
    sa = (S_max - S_min) / 2 / A_mm2
    sm = (S_max + S_min) / 2 / A_mm2
    n = 1 / (sa / Se + sm / Rm) if sm >= 0 else Se / sa
    return {"sigma_a": sa, "sigma_m": sm, "n_goodman": n}
```

Run (LC1, S_max 2664 N, S_min −102 N, A = 160 mm², R_m 240 MPa, part endurance limit S_e = 60 MPa at 10⁸–10⁹ cycles –
**example for die-cast Al including size, surface and casting porosity; aluminium has no true endurance limit**):
σ_a = **8.64 MPa**, σ_m = **8.01 MPa**, **n = 5.64**. The nominal shank stress is low; local stresses at the eye transitions
are 2–3 × higher (K_t) – check them with FEA (M1 ch. 28) on the CAD rod.

### 9.7 Crank pin bending and shear

Theory. The crank pin is a short beam between the two webs. Both rods load it. A conservative hand model puts the resultant
pin load at mid-span of a simply supported beam:

  M_b = F · L_w / 4,  σ_b = 32 M_b / (π d³),  τ_max = 4 V / (3 A) with V = F/2

```python
def crankpin_check(F_pin_max, d_mm=30.0, span_mm=40.0):
    Mb = F_pin_max * span_mm / 4
    sb = 32 * Mb / (math.pi * d_mm ** 3)
    tau = 4 * (F_pin_max / 2) / (3 * math.pi * d_mm ** 2 / 4)
    return {"M_Nmm": Mb, "sigma_b": sb, "tau": tau}
```

Run (LC2, resultant pin load max from `compute_all`, d = 30 mm, L_w = 40 mm): M_b = **33 158 N mm**, σ_b = **12.5 MPa**,
τ = **3.1 MPa**. Interpretation: the pin is very lightly stressed; its diameter is set by the **bearing** (p, needle
bearing size, surface hardness) and by **stiffness**, not by strength. The real critical spot of the crankshaft is the
**fillet between pin and web** – the full check (DIN 743 / FKM with K_t of the fillet, torsion + bending from all load
cases) is M3.

### 9.8 Gudgeon (piston) pin

Theory. The piston pin carries the axial force S·cos β between the rod small end (width b) and the two piston bosses
(centre distance L). Load spread over b, reaction at the boss centres:

  M_b = F/8 · (2L − b),  W = π (d⁴ − d_i⁴) / (32 d),  σ_b = M_b / W,  small-end bearing pressure p = F / (d · b)

Ovalisation: a hollow pin also deforms into an oval under the line load; for thin-wall pins (d_i/d > 0.6) ovalisation stress
can exceed bending stress. Use the pin maker's formula or FEA; keep d_i/d ≤ 0.6 for a hand check to be meaningful.

```python
def gudgeon_pin_check(F, d_mm=16.0, di_mm=9.0, L_boss_mm=36.0, b_small_end_mm=18.0, d_boss_len_mm=None):
    Mb = F / 8 * (2 * L_boss_mm - b_small_end_mm)
    W = math.pi * (d_mm ** 4 - di_mm ** 4) / (32 * d_mm)
    return {"M_Nmm": Mb, "W_mm3": W, "sigma_b": Mb / W, "p_small_end": F / (d_mm * b_small_end_mm)}
```

Run (LC2, F = 3311 N, pin Ø16/Ø9, L = 36 mm, b = 18 mm): M_b = **22 351 N mm**, W = 361.9 mm³, σ_b = **61.8 MPa**,
small-end pressure p = **11.5 MPa**. Pin material: case-hardened 17Cr3 / 16MnCr5 (58–62 HRC surface); σ_b = 62 MPa is far
below its strength. p = 11.5 MPa on a bronze bushing is acceptable (oscillating motion, splash oil).

### 9.9 Hand-over sheet (what M3 / M4 / conrod design receive)

| Receiver | Value | LC | Number (default design) |
|---|---|---|---|
| M3 shaft | Peak drive torque | LC4 | 56.0 N m |
| M3 shaft | Start torque | LC3 | 49.4 N m |
| M3 shaft | Torque orders (torsional vibration) | LC1 | 1st 15.4, 3rd 10.4, 4th 10.6 N m |
| M3 shaft | Pin-plane force history | LC1/LC2 | `crank.csv` columns Fmain_x, Fmain_y |
| M4 bearings | Rod bearing P_m / F_max | LC1 | 1387 / 2664 N |
| M4 bearings | Main bearing A / B cubic mean | LC1 | 990 / 950 N |
| Conrod | S_max compression (static) / S range (fatigue) | LC4 / LC1 | 3489 N / 2664 … −102 N |
| Piston, liner | Side force max | LC4 | 486 N |
| Gudgeon pin | Axial force max | LC4 | ≈ 3489 N |

**MATLAB equivalent** (load cases with `crank.m`): change `P.p_dis_gauge_MPa = 0.99;` in `defaults()` and re-run; the
printed lines "rod force max" and "main bearing total max" must equal the table.

Check questions. (1) Why is the cubic mean, not the arithmetic mean, used for bearing life? (2) Which load case sets the
static size of the gudgeon pin? (3) Why is bearing A more loaded than B?

---

## 10 From calculation to real manufacturing

> Program: `tolerance_effects` (crank.py), chapter-10 functions `gap_monte_carlo`, `displacement_tolerance`,
> `unequal_mass_shaking`, and `iso21940`.

### 10.1 Process routes of the crank-train parts (typical, small piston compressor)

| Part | Material (typical) | Route | Key characteristics |
|---|---|---|---|
| Crankshaft | Forged C45 (+N or +QT) or 42CrMo4 +QT; cast alternative EN-GJS-700-2 | Forge (or cast) → centre + rough turn → (QT if not pre-treated) → finish turn → mill/drill oil holes and keyway → **induction-harden pin and journals 50–58 HRC, depth ≈ 1–2 mm** → grind pin + journals → **dynamic balance (drill counterweights)** → crack test (MPI) → final inspection | Stroke 2r, pin Ø + roundness, journal Ø, pin-journal parallelism, fillet radius + surface, hardness pattern, residual unbalance |
| Conrod | Die-cast Al (EN AC-46000 / -47100) for small compressors, or forged C45 / sinter steel | Cast/forge → face both sides → bore small and big ends in **one set-up** → (split + bolts for steel) → press bushing → finish bore → weigh / grade | Centre distance l, big-end bore Ø + cylindricity, bore parallelism (bend) and twist, side width, mass (small end / big end) |
| Piston | Al-Si (eutectic/hypereutectic, e.g. AlSi12CuNiMg) gravity die cast, T6/T5 | Cast → heat treat → turn crown and skirt (oval-barrel profile on CNC) → cut ring grooves → bore pin bosses → **weigh / grade** | Skirt Ø + ovality + barrel, ring groove width + flank flatness, pin bore Ø + position to crown (compression height), mass |
| Cylinder | Grey iron EN-GJL-250 (or Al with iron liner) | Cast → rough bore → finish bore → **plateau honing** → wash | Bore Ø, cylindricity (≈ 5–10 µm), honing Rz / Rpk / Rk / Rvk (ISO 13565-2), cross-hatch angle ≈ 40–60° |
| Crankcase | EN-GJL-250 or Al die cast | Cast → mill decks + faces → bore main bearing seats in one set-up (line boring) → drill/tap | Bearing seat coaxiality, deck height and angle (90° V) relative to the crank axis |

### 10.2 TDC gap stack – worst case, RSS and Monte Carlo

Theory. The gap between piston top and valve plate at TDC ("deck clearance") is the main part of the clearance volume. It
must be **small** (FAD) but **never zero** (piston hits the valve plate, broken valves). It is the result of a dimension chain:

  gap = block deck height − (main bearing position + crank radius r + rod length l + piston compression height) + gasket
        thickness ± bearing clearances

Every link has a tolerance. Three ways to combine (M1 ch. 24):

  Worst case: T_WC = Σ t_i    RSS: T_RSS = √(Σ t_i²)    Monte Carlo: simulate the real distributions

**In the program** (`crank.py`)

```python
def tolerance_effects(P):
    """(a) TDC gap stack worst case / RSS; (b) FAD sensitivity to clearance volume (deck height)."""
    st = P["deck_stack"]
    tol = list(st["tol_mm"].values())
    wc = sum(tol)
    rss = math.sqrt(sum(t * t for t in tol))
    g = st["nominal_gap_mm"]
    geo = geometry(P)
    dVc = geo["A"] * 0.1e-3                    # 0.1 mm more gap -> more clearance volume
    P2 = dict(P)
    P2["clearance_ratio"] = (geo["Vc"] + dVc) / geo["Vs"]
    f1 = cycle(P, geo)["fad_m3h"]
    f2 = cycle(P2, geometry(P2))["fad_m3h"]
    return {"gap_nom": g, "gap_min_wc": g - wc, "gap_min_rss": g - rss, "wc": wc, "rss": rss,
            "c_per_0.1mm": dVc / geo["Vs"], "fad_loss_per_0.1mm_m3h": f1 - f2,
            "fad_loss_per_0.1mm_pct": 100 * (f1 - f2) / f1}
```

and the Monte Carlo addition:

```python
def gap_monte_carlo(P=None, n=200000, seed=1, gap_min_mm=0.35, dist="normal"):
    """TDC gap = nominal + sum of deviations. Each tolerance +/-t taken as 3 sigma (normal) or uniform +/-t."""
    Q = dict(DEFAULT if P is None else P)
    st = Q["deck_stack"]
    tol = list(st["tol_mm"].values())
    rnd = random.Random(seed)
    below = 0
    gmin, s, s2 = 1e9, 0.0, 0.0
    for _ in range(n):
        dev = 0.0
        for t in tol:
            dev += rnd.gauss(0, t / 3) if dist == "normal" else rnd.uniform(-t, t)
        g = st["nominal_gap_mm"] + dev
        gmin = min(gmin, g); s += g; s2 += g * g
        below += g < gap_min_mm
    mean = s / n
    sd = math.sqrt(s2 / n - mean * mean)
    return {"mean": mean, "sd": sd, "min_seen": gmin, "ppm_below": below / n * 1e6}
```

**Run it** – tolerances (example): crank radius ±0.02, rod centre distance ±0.03, piston compression height ±0.03,
block deck height ±0.05, gasket ±0.05, bearing clearances ±0.02 mm; nominal gap 0.60 mm.

| Method | Result |
|---|---|
| Worst case | T_WC = ±0.200 mm → minimum gap **0.400 mm** |
| RSS | T_RSS = ±0.0872 mm → minimum gap **0.513 mm** |
| Monte Carlo, normal (t = 3σ), 200 000 assemblies | σ = 0.0291 mm, smallest seen 0.469 mm, **325 ppm below 0.50 mm** |
| Monte Carlo, uniform ±t (no process control) | σ = 0.0504 mm, smallest seen 0.420 mm, **21 900 ppm (2.2 %) below 0.50 mm** |

Interpretation. If the minimum *running* gap (cold gap minus thermal growth of rod and piston, rod stretch from inertia,
bearing clearance take-up) must be ≥ 0.50 mm, then: with capable processes (normal, centred) 325 ppm of compressors fail
the gap; with uncontrolled processes 2.2 % fail. Options: (a) reduce the two big tolerances (deck height, gasket ±0.05) –
they contribute 66 % of the variance (0.05² + 0.05² of 0.0076); (b) **select the gasket thickness per crankcase**
(measure the piston protrusion at TDC on the assembly line, choose gasket class – common practice in engines);
(c) raise nominal gap (costs FAD, below).

### 10.3 Clearance volume → FAD sensitivity

Every 0.1 mm of extra gap adds A·0.1 mm of clearance volume: Δc = 0.1/(2r) = 0.1/46 = **+0.0022** (independent of bore).
Run: `fad_loss_per_0.1mm` → **−0.289 m³/h (−1.74 %)** for the default design. So the gap tolerance of ±0.087 mm (RSS)
causes ≈ ±1.5 % FAD scatter between compressors – visible on the ISO 1217 test bench. This is the link: **a mechanical
tolerance becomes a performance tolerance.** Write it into the specification (FAD tolerance per ISO 1217 Annex: typically
±5–7 % for small compressors – check the edition).

### 10.4 Stroke and bore tolerance → displacement

  ΔV_s / V_s = 2 ΔD/D + Δr/r

```python
def displacement_tolerance(P=None, d_bore_mm=0.01, d_r_mm=0.02):
    Q = dict(DEFAULT if P is None else P)
    r = Q["stroke_mm"] / 2
    return {"bore_pct": 100 * 2 * d_bore_mm / Q["bore_mm"], "stroke_pct": 100 * d_r_mm / r,
            "total_wc_pct": 100 * (2 * d_bore_mm / Q["bore_mm"] + d_r_mm / r)}
```

Run: bore ±0.01 mm → ±0.031 %; crank radius ±0.02 mm → ±0.087 %; worst case **±0.118 %**. Negligible for FAD – but the crank
radius tolerance also enters the gap stack (10.2), where it matters more.

### 10.5 Weight grouping → shaking force

Theory. The counterweight is sized for the **nominal** oscillating mass. If the two pistons differ by Δm, the primary forces
of the two cylinders no longer add to a constant rotating vector; a residual primary of order Δm·r·ω² remains.

```python
def unequal_mass_shaking(P=None, dm_kg=0.004):
    Q = dict(DEFAULT if P is None else P)
    geo, M = geometry(Q), masses(Q)
    r, l, w = geo["r"], geo["l"], geo["w"]
    m = [M["m_osc"], M["m_osc"] + dm_kg]
    m_cw_extra = M["m_osc"]                    # counterweight part that balances the V90 primary
    res = []
    for k in range(720):
        th = math.radians(k * 0.5)
        fx = fy = 0.0
        for mi, g in zip(m, Q["cyl_angles_deg"]):
            gam = math.radians(g)
            a = kin(th - gam, r, l, w)["a"]
            fx += -mi * a * math.sin(gam)
            fy += -mi * a * math.cos(gam)
        fx -= m_cw_extra * r * w * w * math.sin(th)
        fy -= m_cw_extra * r * w * w * math.cos(th)
        res.append(math.hypot(fx, fy))
    return {"max_N": max(res), "dm_primary_N": dm_kg * r * w * w}
```

Run: equal masses → 74.7 N residual (secondary). Δm = 4 g (pistons graded ±2 g) → **76.6 N**; Δm = 10 g (no grading) →
**79.5 N**. Δm·r·ω² = 2.1 N and 5.3 N. Interpretation: at 1450 rpm the secondary (74.7 N) dominates; grading pistons to ±2 g
is enough. At higher speed or bigger pistons it becomes more important – the function shows it immediately.

### 10.6 Balancing in production – ISO 21940-11

Theory. The crankshaft with counterweights is a rigid rotor. ISO 21940-11 gives the permissible residual unbalance from a
**balance quality grade G** (G = e_per · ω in mm/s):

  **U_per = 9549 · G · m / n**  [g mm],  m rotor mass [kg], n [rpm];  e_per = U_per / m [µm]

```python
def iso21940(P):
    U = 9549 * P["balance_grade_G"] * P["crank_rotor_mass_kg"] / P["rpm"]
    return {"U_per_gmm": U, "e_per_um": U / P["crank_rotor_mass_kg"], "per_plane_gmm": U / 2}
```

Run: G 6.3, m = 3.0 kg, 1450 rpm → **U_per = 124.5 g mm**, e_per = **41.5 µm**, per correction plane (two planes, symmetric
rotor) **62.2 g mm**. Note: the crankshaft of a reciprocating machine is balanced **with a bob weight** or to a target
unbalance that represents the rotating + share of oscillating mass (the counterweight is intentionally "unbalanced" by
m_cw − m_rot); the residual tolerance above applies to the deviation from that target. The grade for crankshaft assemblies
is often coarser (G16–G40 in ISO 21940-11 tables for complete crank drives); G6.3 is a careful choice for the shaft itself –
check the current table and your noise target.

Production correction (hand calculation): drilling Ø10 mm in steel removes 7850·π·0.01²/4 = 0.617 g per mm depth; at a
radius of 40 mm that is 24.7 g mm per mm depth. One plane tolerance (62.2 g mm) ≈ **2.5 mm drill depth** – a balancing
machine with 1 g mm resolution is ample.

### 10.7 Inspection plan (key characteristics of the crank train – example)

| Characteristic | Tolerance (example) | Method | Frequency | Reaction plan |
|---|---|---|---|---|
| Crank radius r (stroke/2) | 23 ± 0.02 mm | Crank checking fixture with dial gauge or CMM | 1 / 50 + first-off | Stop, adjust grinding |
| Pin and journal Ø | Ø30 k5 / bearing fit | Air gauge / snap gauge | 100 % (in-process) | Sort, correct offset |
| Pin roundness, parallelism to journal | 5 µm, 10 µm / 100 mm | Roundness tester / CMM | 1 / shift | Check centres, steady rest |
| Hardness and depth (pin) | 50–58 HRC, 1–2 mm | Hardness tester, cut-up (metallography) | 1 / batch + setup | Adjust induction parameters |
| Residual unbalance | ≤ 62 g mm per plane (to target) | Balancing machine | 100 % | Re-correct |
| Conrod centre distance l | 90 ± 0.03 mm | Conrod gauge / CMM | 1 / 100 | Adjust boring |
| Conrod bend / twist | ≤ 0.03 / 0.05 mm per 100 mm | Bend-twist fixture | 1 / 100 | Adjust fixture |
| Piston mass grade | ±2 g groups | Scale | 100 % | Grade, pair per compressor |
| Cylinder bore Ø, cylindricity, honing | Ø65 H7, 8 µm, Rpk/Rk/Rvk (ISO 13565-2) | Bore gauge, profilometer | 1 / 20 | Honing stones / parameters |
| TDC gap (assembled) | ≥ 0.50 mm | Lead wire or dial gauge at TDC | 100 % or selective gasket | Change gasket class |
| FAD on test bench | ≥ 20 m³/h − tolerance | ISO 1217 bench | 100 % short test / sample full test | Analyse valves, gap |

### 10.8 Drawing notes (examples)

Crankshaft: "Pin and journals induction hardened 50–58 HRC, effective case depth (DIN EN 10328 method) 1.0–2.0 mm, no
hardening in fillets unless specified; fillets R2 ±0.2 rolled or ground, Ra ≤ 0.8; magnetic particle inspection 100 %;
balance to target unbalance per drawing table, residual ≤ 62 g mm per plane (ISO 21940-11)". Conrod: "Bores machined in one
set-up; centre distance 90 ± 0.03; bend ≤ 0.03/100, twist ≤ 0.05/100; mass and mass distribution class marked". Piston:
"Mass class marked on crown; ovality and barrel per table".

Check questions. (1) Which two tolerances dominate the TDC gap variance? (2) Why does the uniform distribution give more
rejects than the normal distribution with the same ±t? (3) What does 0.1 mm of extra gap cost in FAD?

---

## 11 Verification with SOLIDWORKS Motion / Adams and MATLAB

### 11.1 Purpose

The program solves the mechanism with exact closed-form kinematics and the two-mass rod model. An independent multibody
model (SOLIDWORKS Motion, Adams) solves the same mechanism numerically, with the real rod inertia. If both agree, both are
trusted (credibility level L2, M1 ch. 7). The differences you expect are known in advance (11.5).

### 11.2 Build the V90 model (SOLIDWORKS Motion; Adams is the same logic)

1. **Parts**: crankshaft (with counterweight), 2 conrods, 2 piston assemblies, crankcase (fixed). Use the real CAD or simple
   bodies with the **masses from `masses()`**: piston assembly 0.30 kg, conrod 0.25 kg with CG 30 mm from big end and
   J_CG = 3.6·10⁻⁴ kg m². Override mass properties in SOLIDWORKS if the CAD is simplified.
2. **Mates / joints** (avoid redundant constraints):
   - Crankshaft – case: concentric + coincident (= revolute).
   - Conrod big end – crank pin: concentric only (+ one axial limit only on one rod).
   - Conrod small end – piston pin: concentric.
   - Piston – cylinder axis: concentric (= cylindrical joint along the cylinder axis at ±45°).
   In Adams: revolute (crank), revolute (big end), revolute (small end), translational (piston) – check "redundant
   constraints = 0" in the model verify. In SOLIDWORKS Motion, look at "redundant constraints" in the results and replace
   concentric by "point-on-line" where needed.
3. **Motor**: rotary motor on the crankshaft, constant speed 1450 rpm (8700 deg/s).
4. **Gravity**: off for the comparison (the program ignores gravity; with gravity the torque changes by ±m·g·r ≈ 0.1 N m).
5. **Gas forces**: one force per piston along the cylinder axis, magnitude from a table versus **crank angle** (or time).
   - Get the table from `python crank.py run --out out` → `crank.csv`: columns `theta_deg`, `p1_bar`, `p2_bar`.
     F_gas,i = (p_i − p_crankcase)·A = (p_i [bar] − 1.013)·10⁵·A, A = 3.318·10⁻³ m² (D 65).
   - Time = θ/ω: t = θ_deg / 8700 s; one revolution = 0.04138 s.
   - SOLIDWORKS Motion: Force → "Data points" (time or angle based, interpolation Akima/cubic), direction along the cylinder
     axis, acting on the piston, reaction on the case.
   - Adams: spline from the table + force `AKISPL(MOD(time, 0.04138), 0, spline_1, 0)` on a single-component force along the
     cylinder axis (or use the crank angle `AZ(...)` as the independent variable).
6. **Simulate** 3 revolutions (transients settle), 720 steps per revolution or more; use the last revolution.

### 11.3 Outputs to compare

| Output in the MBD model | Program value (default design, LC1) | Acceptance |
|---|---|---|
| Motor torque max / min / mean | 47.77 / −12.64 / 10.41 N m | ±3 % (mean ±1 %) |
| Rod 1 big-end joint force max | 2664 N | ±3 % |
| Crankshaft–case joint force max (counterweight included) | 2824 N | ±5 % |
| Piston side force max | 419 N | ±5 % |
| Shaking force (sum of case reactions minus gas forces, or gas forces off) | 74.7 N residual with counterweight; 263.7 N oscillating only | ±5 % |
| Torque orders (FFT of motor torque) | 1st 15.41, 3rd 10.35, 4th 10.55 N m; 2nd and 6th ≈ 0 | ±5 % |

Mean motor torque × ω must equal the indicated power 1581 W in both models (energy check, M1 ch. 7).

### 11.4 Typical errors and how they show

| Symptom | Cause |
|---|---|
| Mean torque wrong by a factor | Gas force table in bar not converted, wrong area, wrong sign (force pulls instead of pushes) |
| Torque curve shifted 45° or 90° | Crank angle zero not at the V bisector, or cylinder 2 force table not shifted by 90° |
| Joint forces huge or random | Redundant constraints (over-defined mates) – reactions are not unique |
| Mean torque OK but peaks differ by ≈ 5–10 % | Mass properties from simplified CAD, rod CG wrong |
| Small differences in big-end force but not in torque | 3-mass effect (11.5) – expected |
| Steady offset of ±0.1 N m | Gravity on |

### 11.5 The 3-mass effect you will see in MBD

The two-mass model puts the rod mass in two points. Its moment of inertia about the CG is
J₂ = m_big·a² + m_small·b² = 4.50·10⁻⁴ kg m² (program), but the real rod has J_CG = 3.60·10⁻⁴ kg m² (error −0.90·10⁻⁴).
The MBD model uses the real J. The difference creates a small extra torque from the rod angular acceleration
β̈ (up to 6095 rad/s², chapter 5): the missing couple is ≈ 0.55 N m on the rod but only **0.068 N m** on the crank
(`rod_inertia_correction()`, chapter 5). So expect **< 0.1 N m** difference in the torque curve from this effect; larger
differences come from friction, joint compliance or wrong masses. This is why the
acceptance band is ±3 %, not ±0.1 %.

### 11.6 MATLAB (`tools/crank.m`)

`crank.m` mirrors the core of `crank.py` (geometry, kinematics, gas pressure, virtual-work torque, flywheel, orders,
balancing, plots). Run it in MATLAB (R2017b or newer). The header lists the numbers it must print; they are the program
values of this guide. Use it to: (a) plot in MATLAB; (b) connect to Simulink (feed `Mdrive` into a motor + belt model,
guide 54 C11); (c) optimise (fmincon over bore, stroke, rpm, clearance – M1 ch. 8).

Check questions. (1) Which three outputs are the best first check of a new MBD model? (2) How do you get the gas force table
into Adams? (3) Why does the MBD torque differ slightly from the program even when everything is right?

---

## 12 Complete worked design example – from 20 m³/h to a design sheet

### 12.1 Step 1 – start design and requirement

Requirement (from S0 of M1): **FAD ≥ 20 m³/h at 0.8 MPa gauge**, ISO 1217, 3 kW motor, life 20 000 h, noise and vibration
"low". Start design = the default input (D 65, stroke 46, 1450 rpm, c 0.05). Report line:

```
- FAD 16.58 m3/h, indicated power 1581 W, isothermal power 1019 W, isothermal efficiency 0.645
```

The start design **misses the requirement by 17 %**. Volumetric efficiency total 0.624 (λ_V 0.714 × λ_p 0.95 × λ_T 0.92).

### 12.2 Step 2 – variants (program iteration with --in)

```python
def design_options():
    var = {
        "V0 base (D65, 1450 rpm, c 0.05)": {},
        "V1 speed 1750 rpm": {"rpm": 1750.0},
        "V2 bore 72 mm": {"bore_mm": 72.0},
        "V3 bore 70, c 0.035": {"bore_mm": 70.0, "clearance_ratio": 0.035},
        "V4 bore 70, c 0.035, valve loss 3 %": {"bore_mm": 70.0, "clearance_ratio": 0.035,
                                               "dp_suction_rel": 0.03, "dp_discharge_rel": 0.03},
    }
    ...  # compute_all() per variant, shaft power = P_ind / 0.85 (example mechanical efficiency)
```

| Variant | FAD [m³/h] | λ total | P_ind [W] | P_shaft ≈ P_ind/0.85 [W] | Spec. power [W per m³/h] | M_max [N m] | Flywheel add [kg m²] | Rod max [N] | v_m [m/s] | Shaking residual [N] |
|---|---|---|---|---|---|---|---|---|---|---|
| V0 base | 16.58 | 0.624 | 1581 | 1860 | 112.2 | 47.8 | 0.0590 | 2664 | 2.22 | 74.7 |
| V1 1750 rpm | 20.01 | 0.624 | 1908 | 2244 | 112.2 | 47.4 | 0.0335 | 2583 | 2.68 | 108.9 |
| V2 bore 72 | 20.34 | 0.624 | 1939 | 2282 | 112.2 | 58.8 | 0.0775 | 3308 | 2.22 | 74.7 |
| V3 bore 70, c 0.035 | **21.53** | 0.699 | 2027 | 2384 | 110.7 | 57.5 | 0.0758 | 3126 | 2.22 | 74.7 |
| V4 = V3 + valve loss 3 % | 22.20 | 0.721 | 2040 | 2400 | 108.1 | 57.0 | 0.0766 | 3062 | 2.22 | 74.7 |

Interpretation.
- **V1 (speed)** just reaches 20.01 m³/h – no margin; shaking force +46 % (∝ ω²), valve losses and noise rise with speed
  (the model keeps valve losses constant – optimistic). Rod load *falls* slightly (inertia offsets gas near TDC).
- **V2 (bore 72)** reaches 20.3 with no margin and +24 % rod load.
- **V3 (bore 70 + smaller clearance)** gives **+7.6 % margin**, better specific power, moderate loads. Smaller clearance is a
  design measure (valve plate with less pocket volume, gap 0.6 mm kept) – it costs tolerance work (chapter 10).
- V4 shows what better valves give (+3 %); keep it as reserve, do not design on it.
**Decision: V3.** (Note: a 70 mm piston is heavier than the 65 mm one; with `m_piston_kg` ≈ 0.34 kg the inertia numbers
change a few % – update when the piston CAD exists.)

### 12.3 Step 3 – full report of V3

```
v3.json:  {"name": "VC20 design V3 - bore 70, c 0.035", "bore_mm": 70.0, "clearance_ratio": 0.035}
python crank.py run --in v3.json --out v3_out
```

Report lines (V3):

```
- displacement 30.80 m3/h, lambda_V 0.800 (formula 0.800), lambda_p 0.950, lambda_T 0.92, lambda total 0.699
- FAD 21.53 m3/h, indicated power 2027 W, isothermal power 1324 W, isothermal efficiency 0.653
- mean 13.35 N m (shaft power 2027 W), max 57.51, min -12.43 N m, dE 45.32 J
- J needed 0.0983 kg m2, motor reflected 0.0224, flywheel/pulley to add 0.0758 kg m2
- orders: 1: 18.52, 2: 0.00, 3: 11.91, 4: 12.48, 5: 5.24, 6: 0.00
- shaking max: oscillating only 263.7 N, with counterweight 74.7 N; counterweight 1.1167 kg at r
- ISO 21940-11 G6.3: U_per 124.5 g mm (62.2 per plane), e_per 41.5 um
- rod bearing max 3126 N (cubic mean 1631), p = 5.79 MPa; pin resultant max 3179 N
- main bearings total max 3310 N (cubic mean 2170); rod force max compression 3126 N, max tension -154 N; side force max 513 N
- +0.1 mm gap -> c +0.0022 -> FAD -0.335 m3/h (1.55 %)
```

### 12.4 Step 4 – motor, flywheel, counterweight

- **Motor**: P_shaft ≈ 2027/0.85 = **2.38 kW** < 3 kW (79 % load) – motor OK; at LC2 P_ind = 2152 W → 2.53 kW, still < 3 kW.
- **Flywheel**: J to add 0.0758 kg m² at the crank. A solid cast-iron pulley Ø202 × 30 mm has m = 6.92 kg and
  J = m·D²/8 = **0.0353 kg m²** – not enough alone. A solid disc Ø250 mm giving 0.0758 kg m² needs m = 8J/D² = **9.70 kg**,
  width **27.5 mm** (ρ 7200). Practical: pulley with heavy rim (J ≈ 0.04) + separate small flywheel, or accept δ = 0.03.

```python
def flywheel_disc(J_add, D_mm=250.0, rho=7200.0, D_pulley_mm=202.0, t_pulley_mm=30.0):
    """Solid disc: J = m D^2 / 8 -> m = 8 J / D^2 ; width t = m / (rho pi D^2 / 4)."""
    D = D_mm / 1000
    m = 8 * J_add / D ** 2
    t = m / (rho * math.pi * D ** 2 / 4)
    Dp, tp = D_pulley_mm / 1000, t_pulley_mm / 1000
    mp = rho * math.pi * Dp ** 2 / 4 * tp
    return {"m_disc_kg": m, "t_disc_mm": t * 1000, "m_pulley_kg": mp, "J_pulley": mp * Dp ** 2 / 8}
```

- **Counterweight**: m_cw·r_cw = 1.1167 kg × 23 mm = **25.7 kg mm** (= 25 684 g mm) on the crankshaft, opposite the pin.
  Two webs → 12.8 kg mm each. With the CG of each counterweight at 30 mm: 0.428 kg per web (hand: 12.84/30).
- **Balance**: ISO 21940-11 residual ≤ 62 g mm per plane relative to the target.

### 12.5 Step 5 – loads for M3 / M4 (V3)

| Item | LC1 | LC2 | LC4 |
|---|---|---|---|
| M_max [N m] | 57.5 | 66.0 | 68.1 |
| Rod bearing max / cubic [N] | 3126 / 1631 | 3883 / 1989 | 4089 / 2086 |
| Main total max [N] | 3310 | 4072 | 4279 |
| Rod S compression / tension [N] | 3126 / −154 | 3883 / −130 | 4089 / −124 |
| Side force max [N] | 513 | 583 | 601 |
| p rod bearing [MPa] | 5.79 | 7.19 | 7.57 |

Two-bearing split (V3, LC1): F_t = 132 N, F_belt = 330 N, **bearing A max 1967 N / cubic 1168 N**, **B max 1809 N /
cubic 1111 N**. Conrod buckling LC2 (S = 3883 N, same 10 × 16 mm shank): n = **5.67** in-plane, **5.70** out-of-plane.
Gudgeon pin LC2: σ_b = **72.4 MPa**, p = **13.5 MPa**. Crank pin LC2: σ_b = **14.8 MPa**, τ = **3.7 MPa**. Start torque
(LC3) unchanged: 49.4 N m.

### 12.6 Step 6 – design sheet

| Item | Value (V3, example) | Source |
|---|---|---|
| Bore × stroke × rod | 70 × 46 × 90 mm, λ = 0.256 | Design |
| Speed / drive | 1450 rpm, V-belt 2.02 : 1, motor 3 kW 2930 rpm | Design |
| Clearance ratio / TDC gap | c = 0.035 / 0.60 mm nominal, ≥ 0.50 mm running | ch. 4, 10 |
| Displacement / FAD | 30.80 / 21.53 m³/h (margin +7.6 %) | `cycle` |
| Indicated / shaft power | 2027 / ≈ 2384 W | `cycle` |
| Drive torque mean / max (LC1 / LC4) | 13.35 / 57.5 / 68.1 N m | `torque_analysis` |
| Flywheel inertia to add | 0.0758 kg m² (δ = 0.02) | ch. 7 |
| Counterweight | 25.7 kg mm (1.117 kg at r) | ch. 8 |
| Residual shaking force | 74.7 N (2nd order, horizontal) | ch. 8 |
| Balance grade | G6.3 → 124.5 g mm total | ISO 21940-11 |
| Rod bearing | F_max 4089 N (LC4), P_m 1631 N (LC1) | ch. 9 → M4 |
| Main bearings A / B | P_m 1168 / 1111 N (LC1) | ch. 9 → M4 |
| Conrod | S 4089 / −154 N; buckling n ≥ 5.6 | ch. 9 |
| Key tolerances | r ±0.02, l ±0.03, deck ±0.05 (or selective gasket), piston mass ±2 g | ch. 10 |

---

## 13 Checklists, common mistakes, limits, references, glossary

### 13.1 Checklists

**Before you trust the program output**
- [ ] `python crank.py selftest` prints SELFTEST PASS.
- [ ] Inputs checked: bore, stroke, rod, V angle, rpm, pressures absolute vs gauge, masses from CAD (not guesses).
- [ ] Mean torque × ω = indicated power (printed in the report).
- [ ] FAD plausible (λ total 0.6–0.8 for small single-stage compressors at 0.8 MPa).

**Before you hand loads to M3 / M4**
- [ ] All load cases LC1–LC4 run, each with its own output folder.
- [ ] Fatigue values from LC1, static values from LC2/LC4.
- [ ] Cubic-mean loads for rolling bearings, peak loads for static checks.
- [ ] Belt pull and overhang included for the main bearings.

**Before release to manufacturing**
- [ ] TDC gap stack with Monte Carlo; selective assembly decided.
- [ ] FAD sensitivity to gap written into the test specification.
- [ ] Balance target + tolerance on the crankshaft drawing; balancing machine capability checked.
- [ ] Piston and rod mass grading defined.
- [ ] MBD verification done (chapter 11) and recorded.

### 13.2 Common mistakes

| Mistake | Consequence | Correct |
|---|---|---|
| Gauge pressure used as absolute in the polytropic law | Wrong p-V loop, wrong FAD and power | Polytropic laws use absolute pressure |
| Rod mass fully in the oscillating mass | Too high inertia forces, wrong counterweight | Two-mass split by CG position (ch. 5) |
| Counterweight for rotating mass only in a V90 | Primary force 203 N remains | V90: counterweight for m_rot + m_osc |
| Fatigue checked with LC2 peak | Over-design | Fatigue LC1, static LC2/LC4 |
| Arithmetic mean load for bearings | Life over-estimated | Cubic mean |
| Ignoring belt pull | Pulley-side bearing under-sized | Two-bearing split with belt force |
| Gap designed to worst case only | Too much clearance, FAD lost | RSS / Monte Carlo + selective gasket |
| MBD model with redundant mates | Arbitrary joint forces | Joint count check, point-on-line |

### 13.3 Limits of the model

- **Ideal valves with constant pressure loss**: real valves open late, flutter and have speed-dependent losses; FAD and
  power can differ by 5–15 %. For valve design use a valve-dynamics model (guide 54 C31, GT-SUITE) or test.
- **No ring friction, no blow-by, no heat transfer model**: λ_T and the mechanical efficiency (0.85 here) are inputs, not
  results. Measure them on the first prototype (ISO 1217 bench) and update.
- **Rigid bodies, constant speed**: no torsional vibration, no belt elasticity, no speed fluctuation in the forces (with
  δ = 0.02 the error is ≈ 2 % in the inertia forces). Torsional vibration → M3 / Simulink model (guide 54 C11).
- **Two-mass rod model**: small error from the rod inertia (chapter 11.5).
- **Crankcase pressure = ambient**, no pulsation in the suction line.
- **Bearing split**: rigid shaft, statically determinate two-bearing support.

### 13.4 Standards and references

Standards (check the current edition):
- ISO 1217 – Displacement compressors – acceptance tests (FAD, specific power, tolerances).
- ISO 21940-11 – Mechanical vibration – rotor balancing – procedures and tolerances for rotors with rigid behaviour.
- ISO 281 – Rolling bearings – dynamic load ratings and rating life (input from ch. 9).
- EN 1012-1 – Compressors and vacuum pumps – safety requirements – air compressors.
- ISO 13565-2 – Surface texture – plateau-honed surfaces (Rk, Rpk, Rvk).
- VDI 2149 Blatt 1 – Getriebedynamik – Starrkörper-Mechanismen (dynamics of rigid-body mechanisms; check title/edition).
- DIN 743 / FKM guideline – shaft and component strength (M3, M1 ch. 26).

Books:
- Heisler, H.: *Advanced Engine Technology*, Arnold / SAE – crank mechanism, balancing, conrods.
- Taylor, C. F.: *The Internal-Combustion Engine in Theory and Practice*, Vol. 2, MIT Press – dynamics, balancing, bearing loads.
- Bloch, H. P.: *A Practical Guide to Compressor Technology*, Wiley – reciprocating compressor design and operation.
- Brown, R. N.: *Compressors: Selection and Sizing*, Gulf Professional – reciprocating compressor thermodynamics.
- Budynas, Nisbett: *Shigley's Mechanical Engineering Design*, McGraw-Hill – columns (Euler/Johnson), fatigue, bearings.
- Hanlon, P. C. (ed.): *Compressor Handbook*, McGraw-Hill – reciprocating compressor components.

### 13.5 Glossary (chapters 9–13)

| Term | Meaning |
|---|---|
| Load case (LC) | One defined operating state, computed over a full revolution |
| Cubic mean P_m | Equivalent constant bearing load with the same fatigue damage (L10 ∝ 1/P³) |
| Specific pressure p | Bearing load / projected area d·b |
| Belt factor k | Shaft load of the belt / tangential belt force (pre-tension effect) |
| Johnson parabola | Buckling stress law for short / intermediate columns |
| TDC gap (deck clearance) | Distance piston top – valve plate at top dead centre |
| Selective assembly | Choosing a part class (e.g. gasket thickness) per assembly to hit a tight result |
| Weight grading | Sorting pistons / rods into mass classes and pairing them |
| Balance quality grade G | e_per · ω in mm/s (ISO 21940-11) |
| Target unbalance | Intended unbalance of a crankshaft (counterweight for oscillating share) |
| 3-mass effect | Torque error of the two-mass rod model from the rod's real inertia |
| Data-points force / AKISPL | Table-driven forces in SOLIDWORKS Motion / Adams |
