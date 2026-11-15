# M9 – Belt, chain and coupling drives: V-belts, synchronous belts, roller chains, flexible couplings, manufacturing

> Field 1 *Mechanical design*, item 9.
> **Theory and program are combined:** every formula is followed by the code of `tools/drive.py`, the command and the
> real output. MATLAB mirror: `tools/drive.m`. Web: tab **M_P_C tools**, item 15. Python standard library only – offline.
> **All inputs are example values.** Belt section data, permissible belt stresses, synchronous-belt tooth loads, chain
> ratings, coupling torques and stiffnesses are typical values in the style of ISO 4184 / DIN 7753 / ISO 5292,
> ISO 13050, ISO 606 / ISO 10823 and DIN 740-2 – marked "check". The default task is the compressor drive of M2
> (motor 3 kW 2930 rpm → crank 1450 rpm), so M2, M3 and M9 use the same numbers.

## Contents
0. How to use this guide with the program
1. Purpose – what a drive calculation must prove, and how to choose the drive type
2. Belt mechanics: friction (Euler–Eytelwein), wedge effect, creep, centrifugal force, belt stresses, fatigue, belt types and materials, geometry
3. Narrow V-belt drive design (DIN 7753-2 / ISO 5292): service factor, section, pulleys, length, wrap and length factors, number of belts, tension, shaft load, life, tension check
4. Synchronous (toothed) belts: profiles, teeth in mesh, width, tension, positioning drives
5. Roller chains (ISO 606): kinematics and polygon effect, rating (link plate / roller-bushing / galling), length, lubrication, wear, sprockets
6. Shaft couplings: types, misalignment, DIN 740-2 selection, torsional vibration and resonance, damping heat, torque limiters, universal joints
7. Manufacturing, installation and maintenance (pulleys, sprockets, belts, chains, coupling hubs, balancing, alignment, tensioning, inspection, failure modes) and comparison of the drives
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python drive.py params` | Default input as JSON (copy → edit → `--in`) |
| `python drive.py run --in my.json --out res` | Full calculation → `report.md`, `drive_data.csv` (data block for the drive drawing / assembly instruction) |
| `python drive.py examples` | Report of the default task, V-belt section × pulley table, rating table, chain size table |
| `python drive.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python drive.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=15#mpc` | Same calculation with KPIs, rating curves, coupling resonance curve, comparison table |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 1 | Service factor from load class and hours per day | `LOAD_CLASS`, `service_factor()` |
| 2 | Open-belt geometry (exact and approximate length, wrap angles, span), centre distance from length | `open_belt()`, `centre_from_length()`, `nearest()` |
| 3 | V-belt sections, pulley and length series, rating model (tension + bending + fatigue), wrap factor c1, length factor c3, complete drive design, section × pulley table | `VBELT`, `VB_MODEL`, `D_SERIES`, `LD_SERIES`, `vb_sig_perm()`, `vb_rated()`, `vb_c1()`, `vb_c3()`, `vbelt()`, `vbelt_table()` |
| 4 | Synchronous belt profiles, teeth in mesh, width selection, tension | `SYNC`, `Z_E_MAX`, `sync()` |
| 5 | Roller chains: ACA rating, number of links, centre distance, polygon effect, static safety, lubrication | `CHAINS`, `STRAND_FACTOR`, `chain_rating()`, `chain_length()`, `chain_centre()`, `lubrication()`, `chain()` |
| 6 | Elastic jaw coupling: DIN 740-2 factors, magnification function, two-mass resonance, selection | `JAW`, `SPIDER`, `S_t()`, `S_z()`, `magnification()`, `coupling_check()`, `coupling()` |
| 7 | Comparison of the four drives (efficiency, energy cost, shaft load) | `compare()` |
| – | All results, report, drive data | `summary()`, `report_text()`, `run()` |
| 2–4 | Belt types, cords, compounds; capstan law with numeric check; wedge effect; creep; centrifugal force and optimum speed; belt stresses; open vs crossed belts; service-factor table; section suggestion; ISO 4183 grooves; adjustment allowances; rating curves; life vs small pulley; tension study (slip vs life vs shaft load); run-in tension; tension-meter table; matched sets; alignment; ribbed belts; synchronous profiles; tooth / jump-over check; synchronous width table; positioning-axis stiffness, error and frequency | `capstan_numeric()`, `wedge_mu()`, `capstan_table()`, `creep_estimate()`, `power_speed_curve()`, `belt_stresses()`, `crossed_belt()`, `section_suggest()`, `groove_dims()`, `adjustment()`, `rating_curves()`, `life_vs_d1()`, `tension_study()`, `run_in()`, `frequency_table()`, `matched_set()`, `sync_tooth_check()`, `sync_width_table()`, `positioning_axis()`, `BELT_TYPES`, `CORD_MATERIALS`, `COMPOUNDS`, `EA_VB`, `GROOVE`, `RUN_IN`, `ALIGNMENT`, `RIBBED`, `SYNC_PROFILES`, `EA_SYNC` |
| 5–6 | ISO 606 A/B data, polygon effect and roller impact, hunting tooth, ACA rating curves and crossover speed, strand and size selection, low-speed case 1450→480 rpm, lubrication regimes, Archard wear life to 3 % elongation, fatigue safety, sag and shaft load; coupling types, misalignment restoring forces and bearing loads, full DIN 740-2 listing, M2 torque orders by DFT, magnification curve, damping heat, soft vs stiff stiffness study, Holzer 3-mass, Cardan single and double joint, torque limiter, hub connection | `ch_rating_curve()`, `ch_crossover()`, `ch_polygon()`, `ch_impact_energy()`, `ch_hunting()`, `ch_sag()`, `ch_wear_life()`, `ch_safety()`, `ch_select()`, `ch_low_speed_case()`, `ch_shaft_load()`, `cp_dft_orders()`, `cp_mag_curve()`, `cp_din740()`, `cp_restoring()`, `cp_bearing_from_restoring()`, `cp_damping_heat()`, `cp_stiffness_study()`, `cp_holzer()`, `cp_drive_train()`, `cp_cardan()`, `cp_cardan_double()`, `cp_torque_limiter()`, `CH_B_SERIES`, `CH_BEARING_AREA`, `CH_PIN_D`, `CH_LUB_FACTOR`, `CH_K_WEAR`, `CH_FATIGUE_RATIO`, `CP_TYPES`, `CP_RADIAL_STIFF`, `CP_P_KW` |
| 7–8 | Pulley materials and rim speed, ISO 4183 groove data, groove turning and two-ball gauge, balancing ISO 21940-11, synchronous pulleys / sprockets / coupling hubs, keyway DIN 6885 and hub pressure, how V-belts, synchronous belts and chains are made, taper bushes, belt and coupling alignment, tensioning with run-in and take-up, chain wear limit, maintenance intervals, inspection plan, failure modes, life-cycle cost, decision matrix, worked example (conveyor head drive 7.5 kW 1460 → 480 rpm) | `mfg_groove()`, `mfg_groove_gauge()`, `mfg_gauge_sensitivity()`, `mfg_datum_ball()`, `mfg_rim_speed()`, `mfg_pulley_mass()`, `mfg_unbalance()`, `mfg_balance_planes()`, `mfg_key()`, `mfg_belt_alignment()`, `mfg_coupling_alignment()`, `mfg_tension_plan()`, `mfg_take_up()`, `mfg_chain_wear_limit()`, `mfg_lcc()`, `mfg_decision()`, `example_params()`, `example_options()`, `MFG_PULLEY_MAT`, `MFG_GROOVE`, `MFG_KEY`, `MFG_P_ALLOW`, `MFG_BELT_ALIGN`, `MFG_SHAFT_ALIGN`, `MFG_RUNIN`, `MFG_INTERVALS`, `INSPECTION_PLAN_DRIVE`, `FAILURES_DRIVE`, `PROCESS_CHAIN_DRIVE`, `MFG_COST`, `MFG_CRITERIA`, `MFG_SCORES`, `EXAMPLE_TASK` |
Example input of chapter 8: `tools/examples/drive_example.json`.

### 0.3 What the self-test proves
1. The approximate belt-length formula is within 0.05 % of the exact geometry; the centre-distance formula is its exact inverse.
2. The wrap factor from Euler–Eytelwein gives c1(180°) = 1 and c1(120°) = 0.82 – the value of the DIN table.
3. The span forces obey (F1 − Fc)/(F2 − Fc) = e^(μ'β) and F1 − F2 = F_e.
4. The span frequency measured with a tension meter gives the installation tension back (string formula).
5. At the permissible stress the belt life equals the reference life (Wöhler line consistent).
6. Chain: centre distance from the number of links is the inverse of the links formula; the polygon effect vanishes for many teeth.
7. Synchronous belt: pitch length = teeth × pitch, pitch diameter = z·p/π.
8. Coupling: a time simulation of the two-mass system (RK4) gives the same torque amplitude as the magnification formula.
9. The default V-belt drive and one coupling size pass all checks.

## 1. Purpose – what a drive calculation must prove

A belt, chain or coupling connects a motor to a machine. It must transmit the torque **for the whole life**, at the
**right speed**, without overloading the shafts and bearings it hangs on, without **resonance**, and it must be
possible to **install, tension, align and maintain** it on the shop floor.

| Proof | Question | Chapter |
|---|---|---|
| Load | Which power is the design basis (motor rating × service factor), which peak torques at start? | 1, 6 |
| Kinematics | Ratio, speed error, slip / creep, polygon speed variation | 2–5 |
| Capacity | Power per belt / per mm width / per chain strand; coupling nominal, peak and vibratory torque | 3–6 |
| Life | Belt fatigue and ageing, chain wear, elastomer heat | 3, 5, 6 |
| Shaft load | Installation tension → bearing and shaft loads (input to M3 and M4) | 3, 4, 5 |
| Dynamics | Span vibration, chain chordal action, torsional resonance of the drive train | 3, 5, 6 |
| Manufacture and service | Pulleys, sprockets, hubs, balancing, alignment, tensioning, inspection | 7 |

### 1.1 Choosing the drive type
| Drive | Strong points | Weak points | Typical use |
|---|---|---|---|
| Narrow V-belt | cheap, quiet, damps shocks, slips instead of breaking on overload, ratio adjustable by pulley change | 1–2 % creep (no exact ratio), needs re-tensioning, η ≈ 0.94–0.97, high shaft load | motors to fans, pumps, compressors, machine tools |
| Synchronous belt | exact ratio, η ≈ 0.98, low tension, no lubrication, light | noise at high speed, needs good alignment, sensitive to shock and dirt | positioning axes, compressors, engines (cam drive) |
| Roller chain | exact ratio, high torque at low speed, tolerant of heat and dirt, small shaft load | needs lubrication, polygon effect, wear elongation, noise; poor at high speed | conveyors, agricultural and lifting machines, low-speed heavy drives |
| Direct + coupling | no transmission loss, no shaft load from belt tension, no maintenance of a belt | ratio fixed at 1 (a 4-pole motor or a gearbox is needed), alignment critical, torsional resonance must be checked | pumps, fans, compressors with a motor of matching speed |

**Default task** (`python drive.py examples`): the M2 compressor, 3 kW 2-pole motor at 2930 rpm, crank at 1450 rpm,
actual mean shaft power 1.58 kW (M2 `crank.py`), heavy duty (piston compressor), 16 h per day, centre distance about
400 mm. The program designs all four drives and compares them.

| Result | Value |
|---|---|
| Service factor | c2 = 1.30 → design power P_B = 3.90 kW |
| V-belt (default SPZ d1 150) | d2 300 mm, Ld 1600 mm, a 440 mm, wrap 160.4°, 5.61 kW per belt → **1 belt**; T0 177 N, shaft load 272 N running / 349 N at standstill; output 1450 rpm; expected life 40 000 h (ageing limit) |
| Cheapest V-belt | SPZ d1 112 / d2 224, 1 belt |
| Synchronous belt HTD 8M | z 32 / 65, belt 1200 mm, a 404 mm, **20 mm wide** (5.49 kW ≥ 3.90 kW), shaft load 407 N, output 1443 rpm |
| Roller chain 08A simplex | z 19 / 38, v 11.8 m/s, rating 3.80 kW < 3.90 kW required (roller-bushing limit), needs **pressure lubrication** → not suitable at 2930 rpm |
| Direct drive | 4-pole motor 1445 rpm + elastic jaw coupling **J28** (92 Sh A): start torque at the coupling 94.7 N m ≤ 190 N m; coupling natural frequency 173 Hz above all compressor orders (24–120 Hz) |
| Energy (4000 h/year, 0.20 €/kWh) | V-belt 1528 €/y, synchronous belt 1473 €/y, direct 1444 €/y → the belt costs about 84 € per year more than the direct drive |

**Hand-over to M3 / M4:** the shaft calculation of M3 assumed a belt shaft load of 2 × F_e = 637 N from the peak torque.
The real V-belt drive gives 272 N running and 349 N at standstill (installation tension for the design power). M3 is
therefore on the safe side. The installation tension, not the transmitted torque, sets the bearing load.


---

## 2. Belt mechanics: friction, wedge effect, creep, centrifugal force, stresses, fatigue, belt types, geometry

A belt drive transmits power by **friction** (flat, V and ribbed belts) or by **form fit** (synchronous belts). For the
friction belts, everything comes from one law: how much the tension can change along the wrap before the belt slides.
This chapter derives that law, adds the wedge effect, creep and centrifugal force, and then looks at the stresses that
decide the **life** of a belt. All results come from the add-on of chapter 2 (`python drive.py ch24`) and from the core
functions of `drive.py`.

### 2.1 Belt types, cords and compounds

`python drive.py ch24` starts with the type tables (`BELT_TYPES`, `CORD_MATERIALS`, `COMPOUNDS`):

```
## 2.1 Belt types
  flat belt (polyamide / polyester core)     friction, flat           v up to 80   eta 0.97-0.99  very high speed, needs high tension, crowned pulleys
  classical V-belt (Z, A, B, C, ISO 4184)    friction, wedge          v up to 30   eta 0.92-0.96  old standard, cheap, low power per belt
  narrow V-belt (SPZ, SPA, SPB, SPC)         friction, wedge          v up to 42   eta 0.94-0.97  1.5-2 x the power of a classical belt of equal width
  raw-edge cogged narrow V-belt (XPZ ...)    friction, wedge, notched v up to 50   eta 0.95-0.97  smaller pulleys, cooler running
  banded V-belt (joined set)                 friction, wedge          v up to 30   eta 0.94-0.97  no belt turn-over on shock loads / long spans
  ribbed belt (PJ, PK, PL, PM; ISO 9982)     friction, small wedges   v up to 60   eta 0.96-0.98  thin -> very small pulleys, serpentine drives
  synchronous belt (HTD, GT, AT, T)          form fit (teeth)         v up to 40-80 eta 0.97-0.99  exact ratio, low tension
  cords:
    polyester    modulus medium, ~ 8 GPa (cord)   elongation medium, slight creep   standard V-belts and ribbed belts
    aramid       modulus high, ~ 60 GPa           elongation very low               high power, shock, small elongation; poor in compression -> careful at small pulleys
    glass fibre  modulus high, ~ 70 GPa           elongation very low, no creep     synchronous belts (HTD, GT); must not be kinked before installation
    carbon fibre modulus very high, ~ 230 GPa     elongation lowest                 high-power synchronous belts (motorcycle, compressor)
    steel        modulus very high, ~ 200 GPa     elongation lowest                 polyurethane synchronous belts (AT, T) for linear axes
  compounds:
    CR (chloroprene)   -30 ... +80   classical compound, oil resistant, ages above 80 C
    EPDM               -40 ... +120  modern compound, ozone / heat resistant, longer life, not oil resistant
    HNBR               -30 ... +120  synchronous belts with oil contact (engines)
    PU (polyurethane)  -20 ... +80   cast / extruded synchronous belts with steel cords, abrasion resistant
```

**How a V-belt is built.** From the inside out it has:
- a **compression section** of rubber (often with short fibres, so it is stiff across the belt);
- a **cord layer** (the tension member, which carries almost all of the tension);
- a **tension section** of rubber on top;
- either a **fabric wrap** around everything, or a **raw edge**.

A *wrapped* belt runs more quietly and tolerates slip better. A *raw-edge* belt (flanks cut, often cogged on the inside)
grips better, runs cooler and bends round smaller pulleys. The cogs reduce the bending stress, and that is why
XPZ belts carry more power than SPZ belts on the same pulley.

**Cords** decide the stiffness and the elongation:
- Polyester elongates slowly, so V-belts need re-tensioning after the run-in.
- Glass and carbon hardly elongate, so synchronous belts keep their tension. But a glass cord breaks if the belt is
  kinked or bent tighter than its smallest pulley during storage or installation.

**Compound** decides temperature and ageing. EPDM belts live much longer at heat than the old CR belts. A rule of
thumb from the makers (check) is that belt life halves for every 10 K above about 60 °C ambient.

### 2.2 The capstan law (Euler–Eytelwein)

Take a short piece of belt of angle dθ on the pulley, with tension F on one side and F + dF on the other. The two
tensions press it radially onto the pulley with dN = F·dθ. Friction can carry at most dF = μ·dN, so

  dF / F = μ·dθ  →  integrate over the wrap angle β  →  **F1 / F2 = e^(μ·β)**

F1 is the tight-span tension and F2 the slack-span tension. The difference F1 − F2 = F_e is the **effective pull**, which
transmits the power P = F_e·v. The tension ratio depends only on μ and β, not on the pulley diameter. This is why a
small wrap angle (a small pulley with a short centre distance) reduces the capacity.

The add-on checks the closed formula by integrating dF/dθ = μF in small steps:

```python
def capstan_numeric(mu, beta, F2=1.0, n=2000):
    """Integrate dF/dtheta = mu F along the wrap (explicit midpoint steps) -> F1/F2; compare with e^(mu beta)."""
    F, h = F2, beta / n
    for _ in range(n):
        Fm = F + 0.5 * h * mu * F
        F += h * mu * Fm
    return F / F2
```

```
## 2.2 Capstan (Euler-Eytelwein): F1/F2 = e^(mu beta)
  mu 0.250: 120 deg   1.69  150 deg   1.92  180 deg   2.19  210 deg   2.50
  mu 0.512: 120 deg   2.92  150 deg   3.82  180 deg   5.00  210 deg   6.53
  mu 0.900: 120 deg   6.59  150 deg  10.55  180 deg  16.90  210 deg  27.08
  numeric integration mu 0.512, 180 deg: 4.99529 vs e^(mu pi) 4.99529
```

**Centrifugal force adds to both spans.** A belt running at speed v round a pulley needs a centripetal force. It comes
from an extra tension F_c = m·v² in the whole belt (m = mass per metre). This extra tension does **not** press the belt
onto the pulley, because it is used up keeping the belt on its circular path. The friction law therefore holds for the
tensions *above* F_c:

  (F1 − F_c) / (F2 − F_c) = e^(μ'·β)

The self-test (item 3) proves that `vbelt()` obeys exactly this law and that F1 − F2 = F_e.

### 2.3 The wedge effect: why V-belts carry so much more than flat belts

In a groove of angle α, the radial force dN is carried by the two flanks. Each flank sees a normal force
dN / (2·sin(α/2)), so the total friction is μ·dN / sin(α/2). The V-belt behaves like a flat belt with

  **μ' = μ / sin(α/2)**

```python
def wedge_mu(mu, groove_deg):
    """Wedge effect: the normal force on the two flanks is N / sin(alpha/2) -> mu' = mu / sin(alpha/2)."""
    return mu / math.sin(math.radians(groove_deg) / 2)
```

```
## 2.3 Wedge effect mu' = mu / sin(alpha/2)
  mu 0.20: groove 34 deg -> mu' 0.684  groove 36 deg -> mu' 0.647  groove 38 deg -> mu' 0.614
  mu 0.30: groove 34 deg -> mu' 1.026  groove 36 deg -> mu' 0.971  groove 38 deg -> mu' 0.921
  rating value mu' 0.512 -> equivalent flat-belt mu at 38 deg: 0.167
```

With rubber on cast iron, μ ≈ 0.3, so the physical μ' is about 0.9 to 1.0 and e^(μ'π) ≈ 18. **The rating does not use this
value.** `drive.py` uses `VB_MODEL["mu_eff"] = 0.512`, so e^(μ'π) = 5. There are three reasons:
1. Near the full friction limit the belt starts to creep and **slip over the whole arc**. Then it heats up, wears and glazes.
   A drive must work well below that limit.
2. The friction coefficient drops with dust, oil, wear and glazing. The rating has to cover a used belt in a used pulley.
3. With μ' = 0.512 the formula c1 = (1 − e^(−μ'β)) / (1 − e^(−μ'π)) reproduces the **wrap factor c1 of the DIN / ISO tables**.
   Self-test item 2 checks c1(120°) = 0.82. So the value is not arbitrary: it is the value the standard's tables imply.

```python
def vb_c1(beta, mu=None):
    """Wrap factor = friction capacity at beta / at 180 deg (Euler-Eytelwein)."""
    mu = VB_MODEL["mu_eff"] if mu is None else mu
    return (1 - math.exp(-mu * beta)) / (1 - math.exp(-mu * math.pi))
```

The maker's tension formulas (chapter 3.6) are less conservative, because they assume a higher friction close to the
physical value. The difference is discussed there.

### 2.4 Creep is not slip

Between the tight span and the slack span the belt tension falls from F1 to F2. The belt therefore **shortens** a little
while it runs round the driving pulley, and it gets longer again on the driven pulley. As a result the driven pulley
turns slightly slower than d1/d2 predicts. This is **elastic creep**. It is unavoidable and happens in the "creep
arc" on the exit side of each pulley. The rest of the wrap is an "idle arc", which is the reserve against slip.
**Slip** is different: it happens when the creep arc has grown to cover the whole wrap, so the belt slides everywhere.
Slip is a failure.

  creep s ≈ (F1 − F2) / (E·A)    (E·A = stiffness of the cord layer of one belt)

```python
EA_VB = {"SPZ": 1.0e5, "SPA": 1.6e5, "SPB": 2.6e5, "SPC": 4.8e5}   # cord stiffness per belt N (typical, check)

def creep_estimate(V):
    EA = EA_VB[V["section"]]
    s = (V["F1"] - V["F2"]) / EA
    return {"EA": EA, "creep": s, "rpm_loss": s * DEFAULT["n2"]}
```

```
## 2.4 Creep
  EA 100000 N, F1 - F2 169 N -> elastic creep 0.169 % = 2.46 rpm at the crank; slip used in design 1.0 %
```

The pure cord creep is only 0.17 %. Real narrow V-belts lose 1 to 2 % of speed. On top of the cord creep there is radial
movement: the belt sinks deeper into the groove on the tight side and rises on the slack side, which changes its
effective radius, and the rubber is compressed and sheared. `drive.py` therefore uses `vb_slip = 0.01` to size d2 (chapter
3.4). For an exact ratio, use a synchronous belt (chapter 4) or a chain.

### 2.5 Centrifugal force and the optimum belt speed

The power per belt is P = F_e·v, with F_e = (F1,max − m·v²)·(1 − e^(−μ'β)). At low speed P rises linearly with v. At high
speed the centrifugal tension m·v² uses up the permissible tension, and P falls back to zero. If F1,max is taken as
constant:

  dP/dv = 0  →  F1,max − 3·m·v² = 0  →  **v_opt = √(F1,max / (3·m))**

At v_opt the centrifugal tension is one third of the permissible tension. The core rating function `vb_rated()` contains
exactly this physics:

```python
def vb_rated(sec, d1, n1, L=None, beta=math.pi):
    """Power per belt (kW) from the stress model: F1_max = A (sig_perm - sig_b); F_e = (F1_max - m v^2)(1 - e^(-mu' beta))."""
    S = VBELT[sec]
    L = S["L_ref"] if L is None else L
    v = math.pi * d1 * n1 / 60000
    sp, fB = vb_sig_perm(sec, v, L)
    sb = VB_MODEL["E_b"] * S["h"] / d1
    F1 = S["A"] * (sp - sb)
    Fc = S["m"] * v * v
    Fe = max(0.0, (F1 - Fc) * (1 - math.exp(-VB_MODEL["mu_eff"] * beta)))
    return {"P_kW": Fe * v / 1000, "v": v, "f_B": fB, "sig_perm": sp, "sig_b": sb, "F1_max": F1, "F_c": Fc, "F_e": Fe}
```

The add-on `power_speed_curve()` scans the speed for the default pulley SPZ d1 150:

```
## 2.5 Centrifugal force and optimum speed (SPZ d1 150)
  n   500 rpm  v   3.9 m/s  F1_max   458 N  F_c     1 N  P_N  1.44 kW
  n  2000 rpm  v  15.7 m/s  F1_max   379 N  F_c    18 N  P_N  4.53 kW
  n  3500 rpm  v  27.5 m/s  F1_max   350 N  F_c    56 N  P_N  6.47 kW
  n  5000 rpm  v  39.3 m/s  F1_max   333 N  F_c   114 N  P_N  6.86 kW
  n  6500 rpm  v  51.1 m/s  F1_max   320 N  F_c   193 N  P_N  5.19 kW
  n  8000 rpm  v  62.8 m/s  F1_max   310 N  F_c   292 N  P_N  0.91 kW
  n  9500 rpm  v  74.6 m/s  F1_max   302 N  F_c   412 N  P_N  0.00 kW
  n 11000 rpm  v  86.4 m/s  F1_max   296 N  F_c   552 N  P_N  0.00 kW
  maximum: 6.93 kW at 4500 rpm (v 35.3 m/s); formula v_opt = sqrt(F1_max/(3 m)) = 39.0 m/s
```

The scanned maximum (35 m/s) lies below the simple formula (39 m/s) because F1,max itself falls with speed: more bends
per second mean a lower permissible stress (chapter 2.6). In practice narrow V-belts run at 20 to 30 m/s. The standard limit
is 42 m/s, which the core checks as `speed_le_42`. Above that, grey cast-iron pulleys also reach their rim-speed limit
(chapter 7). The default drive runs at 23 m/s, which is right in the efficient range.

### 2.6 Stresses in a belt and fatigue life

Each time a point of the belt passes a pulley it is bent and then straightened. On every revolution it also sees the
tight-span tension once. The maximum stress occurs where the tight span enters the small pulley:

  σ_max = σ_t1 + σ_b1 = F1/A + E_b·h/d1     (F1 contains the centrifugal part m·v²)

- σ_t1 = F1/A is the tension stress in the tight span.
- σ_c = m·v²/A is the centrifugal part of it.
- σ_b = E_b·h/d is the bending stress: the outer fibre at distance about h/2 is strained by h/d.

```python
def belt_stresses(V):
    S = VBELT[V["section"]]
    st = V["F1"] / S["A"]
    sc = V["F_c"] / S["A"]
    sb1 = VB_MODEL["E_b"] * S["h"] / V["d1"]
    sb2 = VB_MODEL["E_b"] * S["h"] / V["d2"]
    return {"sig_t1": st, "sig_c": sc, "sig_t2": V["F2"] / S["A"], "sig_b1": sb1, "sig_b2": sb2, "sig_max": st + sb1,
            "sig_perm": vb_sig_perm(V["section"], V["v"], V["Ld"])[0]}
```

```
## 2.6 Belt stresses (default drive, design power)
  tight span 4.59 MPa (centrifugal part 0.69), slack span 1.62 MPa, bending small pulley 2.67 / large 1.33 MPa
  max 7.26 MPa vs permissible 8.97 MPa at f_B 28.8 Hz (ratio 0.81)
```

Bending takes 37 % of the maximum stress on the 150 mm pulley. On an 80 mm pulley it would be 5 MPa, more than half the
permissible stress. This is why every section has a minimum pulley diameter d_min, and why bigger pulleys make belts
live longer.

**Fatigue: the Wöhler line of a belt.** A belt fails by fatigue of the cord and rubber after a number of bending cycles N.
Like steel, it follows a Wöhler line σ^m·N = const. The exponent is high: m ≈ 10 (typical, check). The number of cycles
is the **bending frequency** times the running time:

  f_B = (number of pulleys)·v / L = 2·v / L   [Hz],   N = f_B·3600·L_h

Combine these with a reference point (σ_ref permissible at f_ref = 20 Hz for L_h,ref = 25 000 h) to get two relations.

The permissible stress for the reference life at another bending frequency:

  σ_perm = σ_ref·(f_ref / f_B)^(1/m)

The life at an actual maximum stress σ_max:

  L_h = L_h,ref·(f_ref / f_B)·(σ_ref / σ_max)^m

```python
def vb_sig_perm(sec, v, L):
    """Permissible max. belt stress for the reference life at bending frequency f_B = 2 v / L."""
    fB = 2 * v / (L / 1000)
    return VBELT[sec]["sig_ref"] * (VB_MODEL["f_ref"] / fB) ** (1 / VB_MODEL["m_w"]), fB
```

and in `vbelt()`:

```python
    Lh_fat = VB_MODEL["L_h_ref"] * (VB_MODEL["f_ref"] / fB) * (S["sig_ref"] / sig_max) ** VB_MODEL["m_w"]
    Lh = min(Lh_fat, VB_MODEL["L_h_age"])                  # expected life: fatigue or ageing, whichever comes first
```

Self-test item 5 proves the two relations are consistent: at σ_max = σ_perm the life equals exactly L_h,ref.

Three consequences follow, and the drive designer controls all of them:
- **A short belt dies young.** At the same speed it bends more often. This is the length factor c3 (chapter 3.5).
- **Because m ≈ 10, a small stress change makes a big life change.** 10 % more stress gives 0.9^10 = 0.35 of the life.
  This is why over-tensioning (chapter 3.8) and small pulleys (chapter 3.7) are so harmful.
- **Lightly loaded belts do not die of fatigue but of ageing.** The rubber hardens, cracks and the flanks glaze.
  `drive.py` therefore caps the expected life at `L_h_age = 40 000 h` (typical at about 30 °C, check).

### 2.7 Geometry of open and crossed belts

For the **open belt** (both pulleys turn the same way) the core function `open_belt()` gives the exact geometry:

  sin γ = (d2 − d1) / (2a);  β1 = π − 2γ;  β2 = π + 2γ
  L = 2a·cos γ + π·(d1 + d2)/2 + γ·(d2 − d1)       (exact)
  L ≈ 2a + π/2·(d1 + d2) + (d2 − d1)² / (4a)        (approximate, DIN 7753 / ISO formula)
  span length = a·cos γ

```python
def open_belt(d1, d2, a):
    """Open belt geometry: approximate and exact length, wrap angles, span length."""
    gam = math.asin((d2 - d1) / (2 * a))
    L_exact = 2 * a * math.cos(gam) + math.pi * (d1 + d2) / 2 + gam * (d2 - d1)
    L_approx = 2 * a + math.pi / 2 * (d1 + d2) + (d2 - d1) ** 2 / (4 * a)
    return {"gamma": gam, "beta1": math.pi - 2 * gam, "beta2": math.pi + 2 * gam, "L_exact": L_exact, "L_approx": L_approx,
            "span": a * math.cos(gam)}
```

The inverse, the centre distance for a chosen standard length, is the root of the quadratic approximate formula:

  a = ¼·[k + √(k² − 2·(d2 − d1)²)],   k = L − π/2·(d1 + d2)

```python
def centre_from_length(L, d1, d2):
    k = L - math.pi / 2 * (d1 + d2)
    return 0.25 * (k + math.sqrt(k * k - 2 * (d2 - d1) ** 2))
```

The **crossed belt** reverses the direction of rotation: sin γ = (d1 + d2)/(2a), both wraps are π + 2γ, and
L = 2a·cos γ + (π + 2γ)·(d1 + d2)/2. It works only for flat and round belts, because a V-belt would rub on itself and
twist out of the groove.

```
## 2.7 Geometry open vs crossed (d1 150, d2 300, a 440.2)
  open: beta1 160.4 deg, beta2 199.6 deg, L exact 1600.0 mm, L approx 1600.0 mm, span 433.7 mm
  crossed: both wraps 241.5 deg, L 1705.0 mm
```

For the default drive the approximate length formula is accurate to better than 0.1 mm. Self-test item 1 checks it at
a = 400 mm: 1520.92 against 1520.96 mm exact. The formula is safe for all normal V-belt drives (ratio up to about 8,
a ≥ 0.7·(d1 + d2)).

---

## 3. Narrow V-belt drive design (DIN 7753-2 / ISO 5292)

The design procedure for narrow V-belts is standardised. DIN 7753-2 and ISO 5292 define the steps, ISO 4184 the belt
sections and lengths, and ISO 4183 the pulley grooves. The maker catalogues follow the same steps. `vbelt()` carries them
out in this order:

| Step | What | `vbelt()` line / field |
|---|---|---|
| 1 | Design power P_B = P·c2 | `c2 = service_factor(P)`, `PB` |
| 2 | Section from P_B and n1 | input `vb_section` (chapter 3.2 suggests one) |
| 3 | Small pulley d1 ≥ d_min, d2 from the ratio incl. creep | `d2 = nearest(n1 d1 (1 - s)/n2, D_SERIES)` |
| 4 | Theoretical length → standard Ld → actual centre distance | `L_th`, `Ld`, `a` |
| 5 | Wrap angle β1 → c1; length → c3 | `vb_c1()`, `vb_c3()` |
| 6 | Rating P_N per belt, number of belts z | `vb_rated()`, `z` |
| 7 | Installation tension, span forces, shaft load | `T0`, `F1`, `F2`, `F_shaft` |
| 8 | Life, tension check values, speed error, checks | `L_h`, `F_test`, `f_span`, `ok` |

### 3.1 Service factor c2

The motor rating alone is not the design basis. A piston compressor gives a torque that pulsates strongly (M2: peak
47.8 N m against a mean of 10.4 N m). It starts against pressure, and it runs 16 hours per day. The **service factor**
c2 raises the power to cover this:

```python
def service_factor(P):
    t = LOAD_CLASS[P["load_class"]]
    h = P["hours_per_day"]
    return t[0] if h <= 10 else t[1] if h <= 16 else t[2]
```

```
## 3.1 Service factor c2 (hours/day <= 10 / <= 16 / > 16)
  light (fans, centrifugal pumps)          1.0 / 1.1 / 1.2
  medium (screw compressors, conveyors)    1.1 / 1.2 / 1.3
  heavy (piston compressors, mills)        1.2 / 1.3 / 1.4
  very heavy (crushers, hoists)            1.3 / 1.4 / 1.5
  default: heavy (piston compressors, mills), 16 h -> c2 1.30, P_B 3.90 kW
```

The table is for soft-starting AC motors (star-delta or soft starter). For direct-on-line start with a high starting
torque, or for internal-combustion engines, the makers add 0.1 to 0.2 (check). Note that the design uses the **motor
rating** of 3 kW, not the actual 1.58 kW. The drive must survive whatever the motor can deliver, for example when the
compressor valve sticks.

### 3.2 Choosing the section

The section chart in a catalogue is a plot of P_B over the small-pulley speed n1, divided into fields SPZ, SPA, SPB, SPC.
`section_suggest()` follows the logic behind that chart: on a typical pulley (1.6 × d_min) the section should need no
more than about 4 belts, and the belt speed must stay ≤ 42 m/s.

```python
def section_suggest(P_B, n1):
    out = []
    for sec, S in VBELT.items():
        d = nearest(1.6 * S["d_min"], D_SERIES)
        r = vb_rated(sec, d, n1)
        z = math.ceil(P_B / r["P_kW"]) if r["P_kW"] > 0.01 else 99
        out.append((sec, d, r["P_kW"], z, r["v"]))
    pick = next((o for o in out if o[3] <= 4 and o[4] <= 42), None)
    return out, pick
```

```
## 3.2 Section suggestion (pulley 1.6 x d_min, at most 4 belts)
  SPZ d 100: P_N  3.52 kW, v  15.3 m/s -> z 2
  SPA d 140: P_N  7.92 kW, v  21.5 m/s -> z 1
  SPB d 224: P_N 17.02 kW, v  34.4 m/s -> z 1
  SPC d 355: P_N 21.63 kW, v  54.5 m/s -> z 1
  suggested: SPZ
```

SPZ is right for 3.9 kW at 2930 rpm. Bigger sections would need much bigger pulleys (SPC: 54 m/s, far over the limit).
The section data in `VBELT` (top width, height, cord area A, mass m, d_min, reference length L_ref, σ_ref) are typical
values; check them in ISO 4184 and the maker catalogue.

### 3.3 Pulley grooves (ISO 4183)

A belt that bends round a small pulley gets wider on its inner side and narrower on its outer side, so its flank angle
becomes smaller. Small pulleys therefore get a **34° groove** and large pulleys a **38° groove**. The limit diameter
depends on the section.

```python
GROOVE = {"SPZ": {"b": 2.0, "hf": 9.0, "e": 12.0, "f": 8.0, "d34": 80}, ...}

def groove_dims(sec, d, z=1):
    """Groove angle 34 deg on small pulleys (belt top widens when it bends), 38 deg on large ones;
    top width b1 = b_d + 2 b tan(alpha/2); outside diameter d_a = d + 2 b; pulley width B = (z - 1) e + 2 f."""
    G, S = GROOVE[sec], VBELT[sec]
    alpha = 34.0 if d <= G["d34"] else 38.0
    b1 = S["bd"] + 2 * G["b"] * math.tan(math.radians(alpha / 2))
    return {"alpha": alpha, "b1": b1, "da": d + 2 * G["b"], "depth": G["b"] + G["hf"], "B": (z - 1) * G["e"] + 2 * G["f"], "e": G["e"], "f": G["f"]}
```

```
## 3.3 Groove dimensions (ISO 4183 style)
  SPZ d  63: alpha 34 deg, top width b1 9.72, d_a 67.0, depth 11.00, e 12.0, f 8.0, width for 2 grooves 28.0 mm
  SPZ d 150: alpha 38 deg, top width b1 9.88, d_a 154.0, depth 11.00, e 12.0, f 8.0, width for 2 grooves 28.0 mm
  SPZ d 300: alpha 38 deg, top width b1 9.88, d_a 304.0, depth 11.00, e 12.0, f 8.0, width for 2 grooves 28.0 mm
  SPA d 125: alpha 38 deg, top width b1 12.89, d_a 130.5, depth 13.75, e 15.0, f 10.0, width for 2 grooves 35.0 mm
  SPB d 200: alpha 38 deg, top width b1 16.41, d_a 207.0, depth 17.50, e 19.0, f 12.5, width for 2 grooves 44.0 mm
```

Meaning of the symbols:
- **d (datum diameter)** is the diameter at the datum width b_d of the groove. All design calculations use it.
- **b** is the height of the datum line below the outside diameter, so d_a = d + 2b.
- **e** is the groove pitch and **f** the distance from the pulley edge to the first groove.
- The belt must not touch the groove bottom: the depth is chosen so it never does, otherwise the wedge effect is lost.

In the shop the groove angle is checked with a groove gauge, and the datum diameter with two measuring balls or rods
in opposite grooves (chapter 7). The values in `GROOVE` are typical; check ISO 4183.

### 3.4 Pulleys, length, centre distance, adjustment

Step 3 sizes the large pulley. Creep makes the driven pulley turn about 1 % slow, so d2 is made 1 % *smaller* than the
pure ratio requires, and then rounded to the pulley series `D_SERIES`:

```python
    d2 = nearest(P["n1"] * d1 * (1 - P["vb_slip"]) / P["n2"], D_SERIES)
    a0 = max(P["a_target"], 0.7 * (d1 + d2))                # wanted centre distance, at least the DIN minimum
    L_th = open_belt(d1, d2, a0)["L_approx"]
    Ld = nearest(L_th, [x for x in LD_SERIES if S["Lr"][0] <= x <= S["Lr"][1]])
    a = centre_from_length(Ld, d1, d2)
```

The belt can only be bought in standard datum lengths (`LD_SERIES`, ISO 4184 / R20 style). The actual centre distance
follows from the standard length. The **adjustment range** of the motor slide must allow two things:
- moving in by y, to put the belts on without levering them over the pulley flange (levering breaks cords);
- moving out by x, to tension the belts and to re-tension them after they elongate.

```python
def adjustment(V, x_rel=0.03, y_rel=0.015):
    return {"x": x_rel * V["Ld"], "y": y_rel * V["Ld"], "a_min": V["a"] - y_rel * V["Ld"], "a_max": V["a"] + x_rel * V["Ld"]}
```

```
## 3.4 Pulleys, length, centre distance, adjustment
  d2 = n1 d1 (1 - s) / n2 = 2930 x 150 x 0.99 / 1450 = 300.1 -> 300 mm; L_th 1520.9 -> Ld 1600; a 440.2 mm
  adjustment: tensioning x 48 mm, installing y 24 mm -> slide range a 416 ... 488 mm
```

The wanted 400 mm gives L_th = 1521 mm. The nearest standard length is 1600 mm, which moves the centre distance to
440 mm. The motor base of M2 must provide a slide (or a tensioning screw on a rocker base) from 416 to 488 mm. The
percentages 3 % and 1.5 % are typical; check the maker. Polyester-cord belts need the full 3 %. Aramid belts elongate
less.

### 3.5 Rating, wrap factor and length factor

The catalogue rating P_N is the power one belt carries on a 180° wrap and at the reference length L_ref. For other wrap
angles and lengths it is multiplied by c1 and c3:

  P per belt = P_N·c1·c3

- c1 = (1 − e^(−μ'β1)) / (1 − e^(−μ'π)) follows from the friction capacity (chapter 2.3).
- c3 = (L / L_ref)^(1/m) follows from the bending frequency (chapter 2.6): a longer belt bends less often, so it may carry
  a higher stress.

```python
def vb_c3(sec, L):
    """Length factor: a longer belt bends less often -> higher permissible stress (Woehler): (L / L_ref)^(1/m)."""
    return (L / VBELT[sec]["L_ref"]) ** (1 / VB_MODEL["m_w"])
```

```
## 3.5 Rating curves P_N [kW] (SPZ, 180 deg, L_ref 1600)
  d1 \ n     720    960   1450   2000   2930   3500   5000
     80     0.82   1.04   1.44   1.84   2.44   2.74   3.33
    100     1.16   1.47   2.06   2.65   3.52   3.96   4.73
    125     1.56   1.99   2.80   3.62   4.77   5.32   6.07
    150     1.96   2.50   3.52   4.53   5.89   6.47   6.86
    200     2.73   3.49   4.88   6.19   7.68   8.05   6.45
  factors: c1 0.952 (wrap 160.4 deg), c3 1.000 (Ld 1600); other lengths: 800 -> 0.933, 1250 -> 0.976, 2500 -> 1.046, 3550 -> 1.083
```

This table is what a catalogue prints, but here it is *computed* from the stress model. The model was calibrated
against typical catalogue values: SPZ 100 mm at 2930 rpm → 3.5 kW, SPB 200 at 1450 → 10.5 kW, SPC 315 at 1450 → 28.9 kW
(`python drive.py examples`). Before release, compare the rating with the actual maker's table (check). Three patterns
are worth learning:
- **Doubling d1 more than doubles P_N at low speed.** The bending stress drops, and the belt speed doubles.
- **At high speed the large pulleys lose again** (d 200 at 5000 rpm: 6.45 < 8.05 kW). Centrifugal force at 52 m/s takes
  over, and that is far beyond the 42 m/s limit anyway.
- **The length factor is weak** (exponent 1/10). An 800 mm belt carries only 7 % less than a 1600 mm one, but it lives
  much shorter at the same stress.

### 3.6 Number of belts, installation tension, shaft load

**Number of belts:** z = P_B / (P_N·c1·c3), rounded up.

**Installation tension.** The belt must not slip at the design power P_B. With e = e^(μ'β1) and F_e,B = P_B / (z·v) per belt,
the slack-span friction tension must be F2' = F_e,B/(e − 1) and the tight-span tension F1' = F2' + F_e,B. The static
(installation) tension is their mean plus the centrifugal tension:

  **T0 = F_e,B·(e + 1) / (2·(e − 1)) + m·v²**

Running at design power: F1 = T0 + F_e/2, F2 = T0 − F_e/2.
Shaft load running: F_W = 2·(T0 − F_c)·z·sin(β1/2). At standstill: F_W0 = 2·T0·z·sin(β1/2).

```python
    z = max(1, math.ceil(PB / (r0["P_kW"] * c1 * c3) - 1e-9)) if r0["P_kW"] > 0.01 else 99   # 99 = belt cannot carry power
    v = r0["v"]
    e = math.exp(VB_MODEL["mu_eff"] * g["beta1"])
    FeB = PB * 1000 / (z * v)                               # design effective pull per belt
    Fc = S["m"] * v * v
    T0 = FeB * (e + 1) / (2 * (e - 1)) + Fc                 # static (installation) tension per belt
    F1, F2 = T0 + FeB / 2, T0 - FeB / 2                     # running span forces at design power (incl. Fc)
    F_shaft = 2 * (T0 - Fc) * z * math.sin(g["beta1"] / 2)  # shaft load when running
    F_shaft_static = 2 * T0 * z * math.sin(g["beta1"] / 2)  # shaft load at standstill (installation)
```

```
## 3.6 Number of belts, tension, shaft load
  z = P_B/(P_N c1 c3) = 3.90/(5.89 x 0.952 x 1.000) = 0.70 -> 1
  T0 177 N (run-in x 1.3: 230 N), shaft load running 272 N, standstill 349 N, new belt standstill 454 N
```

Notes for the drawing and the assembly instruction:
- **The shaft load at standstill is higher than when running.** The centrifugal tension relieves the pulley at speed.
  The bearings of M4 and the shaft of M3 must take the **standstill** value, and with a new belt even the run-in value:
  454 N for the default drive.
- **Run-in.** A new belt loses a large part of its tension in the first hours: it beds into the grooves and the cord
  settles. The makers therefore install new belts at about 1.3 × T0 (`RUN_IN = 1.3`, check) and re-tension to T0 after
  0.5 to 4 hours of running under load.
- **Maker formula.** The catalogues often use T0 = 500·(2.02 − c1)·P_B / (c1·z·v) + k·v² (P_B in kW, v in m/s). At 180°
  this gives about 0.51·F_e, against 0.75·F_e here, because the makers assume a higher friction close to the physical value
  (chapter 2.3). `drive.py` is on the safe side for slip, but gives a higher shaft load. For the bearing calculation use
  the larger of the two values (check).
- **One or two belts?** The default needs 0.70 of one belt, so one belt is enough with margin. Many designers still choose
  two thinner belts, so that the machine can keep running for a while if one breaks. That is a decision about
  availability, not strength.

### 3.7 Belt life versus pulley size

`life_vs_d1()` runs `vbelt()` for a range of small pulleys with the same task:

```python
def life_vs_d1(P, sec="SPZ", d_list=(80, 90, 100, 112, 125, 140, 150, 180)):
    rows = []
    for d in d_list:
        V = vbelt(P, sec, float(d))
        rows.append((d, V["d2"], V["z"], V["v"], V["T0"], V["F_shaft"], V["sig_max"], V["L_h_fat"]))
    return rows
```

```
## 3.7 Life vs small pulley (SPZ, same task)
  d1  80 / d2 160: z 2, v  12.3 m/s, T0  136 N, shaft  498 N, sig_max  7.96 MPa, fatigue life     108499 h
  d1  90 / d2 180: z 2, v  13.8 m/s, T0  125 N, shaft  443 N, sig_max  7.15 MPa, fatigue life     314574 h
  d1 100 / d2 200: z 2, v  15.3 m/s, T0  119 N, shaft  402 N, sig_max  6.53 MPa, fatigue life     695827 h
  d1 112 / d2 224: z 1, v  17.2 m/s, T0  203 N, shaft  359 N, sig_max  7.93 MPa, fatigue life      99897 h
  d1 125 / d2 250: z 1, v  19.2 m/s, T0  191 N, shaft  324 N, sig_max  7.28 MPa, fatigue life     211178 h
  d1 140 / d2 280: z 1, v  21.5 m/s, T0  184 N, shaft  293 N, sig_max  6.72 MPa, fatigue life     418028 h
  d1 150 / d2 300: z 1, v  23.0 m/s, T0  177 N, shaft  272 N, sig_max  6.37 MPa, fatigue life     759337 h
  d1 180 / d2 355: z 1, v  27.6 m/s, T0  176 N, shaft  232 N, sig_max  5.80 MPa, fatigue life    1615309 h
```

How to read it:
- **The shaft load falls as the pulley grows** (498 N → 232 N). The same torque needs less force on a larger radius.
  This matters more for M3 and M4 than the belt itself.
- **A jump in z resets the stress.** At d1 = 112 the drive switches from 2 belts to 1, so each belt carries twice the pull,
  and its life drops from about 700 000 h to 100 000 h.
- All lives are far above the ageing limit of 40 000 h, because the actual load (1.58 kW) is only 40 % of the design power.
  Under these conditions the belt dies of age and wear, not of fatigue. The fatigue model becomes decisive for drives
  that run near full load.

The pulley size is limited by the speed (v ≤ 42 m/s), by the space and by the inertia, which the motor has to accelerate
at start (M2 chapter 7). For the compressor, d1 = 150 / d2 = 300 is a good compromise. It is also what M2 and M3 assumed.

### 3.8 Installation tension: too low slips, too high kills

`tension_study()` installs the default belt at k × T0 and evaluates three things:
- the slip margin at design power: F_e,max / F_e,B with F_e,max = 2·(T − F_c)·(e − 1)/(e + 1);
- the fatigue life at the actual load;
- the standstill shaft load.

```python
def tension_study(P, factors=(0.6, 0.8, 1.0, 1.3, 1.6, 2.0)):
    V = vbelt(P)
    S = VBELT[V["section"]]
    e = math.exp(VB_MODEL["mu_eff"] * math.radians(V["beta1_deg"]))
    Fe_act = P["P_load_kW"] * 1000 / (V["z"] * V["v"])
    rows = []
    for k in factors:
        T = k * V["T0"]
        Fe_max = 2 * (T - V["F_c"]) * (e - 1) / (e + 1)
        sig = (T + Fe_act / 2) / S["A"] + VB_MODEL["E_b"] * S["h"] / V["d1"]
        Lh = VB_MODEL["L_h_ref"] * (VB_MODEL["f_ref"] / V["f_B"]) * (S["sig_ref"] / sig) ** VB_MODEL["m_w"]
        rows.append((k, T, Fe_max / V["F_e"], sig, Lh, 2 * T * V["z"] * math.sin(math.radians(V["beta1_deg"]) / 2)))
    return rows
```

```
## 3.8 Installation tension study (k x T0)
  k 0.6: T  106 N, slip margin 0.49, sig_max  5.13 MPa, fatigue life   6634443 h, shaft load  209 N  SLIPS at design power
  k 0.8: T  142 N, slip margin 0.74, sig_max  5.75 MPa, fatigue life   2116718 h, shaft load  279 N  SLIPS at design power
  k 1.0: T  177 N, slip margin 1.00, sig_max  6.37 MPa, fatigue life    759337 h, shaft load  349 N
  k 1.3: T  230 N, slip margin 1.39, sig_max  7.31 MPa, fatigue life    194086 h, shaft load  454 N
  k 1.6: T  283 N, slip margin 1.77, sig_max  8.24 MPa, fatigue life     58446 h, shaft load  558 N
  k 2.0: T  354 N, slip margin 2.28, sig_max  9.48 MPa, fatigue life     14347 h, shaft load  698 N
```

This is the most important practical lesson of belt drives:
- **Under-tension** (k < 1) does not show at normal load. It shows at start and at load peaks: the belt squeals,
  slips, burns and glazes its flanks. After that, the friction is gone for good.
- **Over-tension** is invisible. A fitter who "tightens it properly" to twice the value cuts the fatigue life by a factor
  of 50 (759 337 h → 14 347 h). He also doubles the bearing load: 698 N instead of 349 N, which in M4 means roughly an
  eighth of the bearing life, since L10 ∝ (C/P)³.

The tension must therefore be **measured** (chapter 3.9) and written on the drawing and in the maintenance plan.

### 3.9 Checking the tension in the shop

There are two methods. Both are printed by the core in `drive_data.csv`.

**Deflection–force method.** A test force F_test at the middle of the span gives a deflection f. For a string under
tension T: f = F_test·L_span / (4·T). The standard test deflection is 16 mm per 1000 mm of span (DIN 7753 style, check),
so

  F_test = 4·T0·f / L_span

**Frequency method (tension meter).** Pluck the span. It vibrates at the string frequency

  f = 1 / (2·L_span)·√(T / m)   ↔   T = m·(2·L_span·f)²

```python
    test_def = 16.0 * g["span"] / 1000                      # deflection 16 mm per 1000 mm span
    F_test = 4 * T0 * test_def / g["span"]                  # mid-span force for that deflection (string)
    f_span = 1 / (2 * g["span"] / 1000) * math.sqrt(T0 / S["m"])
```

```
## 3.9 Tension check: span frequency vs tension (span 434 mm)
  T    89 N -> f  39.9 Hz
  T   142 N -> f  50.4 Hz
  T   177 N -> f  56.4 Hz
  T   230 N -> f  64.3 Hz
  T   283 N -> f  71.3 Hz
  new belt: install to 64 Hz (or 14.7 N for 6.9 mm deflection); after run-in check 56 Hz
```

Self-test item 4 proves that the frequency gives the tension back exactly. The frequency method is better in practice:
- It needs no force gauge and no ruler.
- It does not depend on the fitter's feel.
- It can be logged, for example in the condition-monitoring system of the digital twin.

The tension meter needs two inputs, the belt mass m (`VBELT[...]["m"]`) and the span length (434 mm here). Both belong in
the maintenance instruction.

**Assembly instruction for the default drive:**
1. Align the pulleys (chapter 3.11).
2. Fit the new belt without force, using the slide at a = 416 mm.
3. Tension it to 64 Hz.
4. Run under load for 0.5 to 4 h.
5. Re-tension to 56 Hz.
6. Check every 3 months: re-tension below 50 Hz (0.8 × T0); replace the belt if it is cracked or glazed, or if the slide
   has reached its end.

### 3.10 Several belts: matched sets

When z > 1, all belts are stretched to the same installed length. A belt that is shorter than the others by ΔL carries
an extra tension E·A·ΔL / L. Because the cord is stiff, even small length differences give large tension differences:

```python
def matched_set(P, P_kW=11.0, dL_rel=(0.0002, 0.0005, 0.002), sec="SPA", d1=125.0):
    """Belts of one set differ in length by +-dL. All are stretched to the same installed length: the shorter belt
    carries more tension: T_i = T0 + EA (L_mean - L_i)/L. With z belts at +-dL the spread is +-EA dL/L."""
    V = vbelt(dict(P, P_kW=P_kW), sec, d1)                # a larger drive that needs several belts
    EA = EA_VB[sec]
    out = []
    for r in dL_rel:
        dT = EA * r
        out.append((r * 100, r * V["Ld"], V["T0"] + dT, max(0.0, V["T0"] - dT), dT / V["T0"]))
    return V, out
```

```
## 3.10 Matched sets (11 kW drive, SPA d1 125, length tolerance)
  drive: 3 x SPA, Ld 1400, T0 246 N per belt
  +-0.02 % (+-0.3 mm): shortest belt  278 N, longest  214 N (+- 13 % of T0)
  +-0.05 % (+-0.7 mm): shortest belt  326 N, longest  166 N (+- 33 % of T0)
  +-0.20 % (+-2.8 mm): shortest belt  566 N, longest    0 N (+-130 % of T0)
```

With ±2.8 mm (0.2 %) the longest belt is slack and the shortest carries more than twice its share, so that belt dies early.
The model is simple: it ignores how the belts sink into the grooves, which evens out part of the difference (check). The
conclusions are still those of the makers:
- Multi-belt drives must use a **matched set**: belts from one production batch, measured and sorted into a narrow
  length class. Modern narrow V-belts are made "set-constant" within a tight tolerance.
- **Always replace the whole set**, never a single belt. An old belt has elongated, so a new one would carry everything.
- Pulley grooves must be equal. A worn groove lets one belt sink deeper and run on a smaller diameter, so it slips
  against the others.
- For long spans or shock loads, use a **banded belt** (several belts joined by a cover band): they cannot turn over
  or jump out of their grooves.

### 3.11 Idlers, alignment, multi-pulley drives, ribbed belts

**Idlers** (tensioning pulleys) are a second-best solution when the centre distance cannot be adjusted:
- Put the idler on the **slack span**. Its tension is the lowest there, so the idler adds the least stress.
- Place it close to the large pulley, so the wrap on the small pulley is not reduced.
- An **inside** idler must be grooved and should be at least as large as the small pulley.
- An **outside** idler (on the back of the belt) increases the wrap angle, but it bends the belt backwards. This reverse
  bending cuts belt life sharply. The idler then needs at least 1.3 × d_min (typical, check), and banded belts or
  double-V belts are better.
- Each idler adds one more bend per revolution, so f_B grows by 50 %.

**Alignment:**

```
## 3.11 Alignment and ribbed belts
  narrow V-belt      angle 0.5 deg   offset about 1 mm per 100 mm centre distance at most
  ribbed belt        angle 0.25 deg  offset 0.5 mm per 100 mm
  synchronous belt   angle 0.25 deg  offset 0.3 mm per 100 mm; the belt runs against a flange otherwise
  ribbed PJ: rib pitch 2.34 mm, smallest pulley 20 mm
  ribbed PK: rib pitch 3.56 mm, smallest pulley 45 mm
  ribbed PL: rib pitch 4.70 mm, smallest pulley 75 mm
  ribbed PM: rib pitch 9.40 mm, smallest pulley 180 mm
```

Misalignment makes the belt enter the groove at an angle. The flank on one side wears, the belt rolls and it gets hot.
Alignment is checked with a straight edge, a cord or, better, a laser pulley-alignment tool that sits in the grooves
(chapter 7). The values are typical; check the maker.

**Multi-pulley drives** (one motor, several machines, or serpentine drives with ribbed belts) are designed span by span.
The tight-span tension after each driven pulley follows from the power taken by that pulley. The wrap on every driving
contact must satisfy Euler–Eytelwein, and the bending frequency counts all pulleys: f_B = (number of pulleys)·v / L.

**Ribbed belts** (ISO 9982: PJ, PK, PL, PM) are thin, so they bend round very small pulleys and can run on their back
over idlers. Typical uses are car auxiliary drives, household machines and small fans. Their rating is given per rib.
They need about 1.5 to 2 times the tension of a V-belt for the same power, because the wedge effect of the small 40° ribs
is weaker, and they need better alignment.

---

## 4. Synchronous (toothed) belts

A synchronous belt transmits the force by **teeth**, like a gear, while keeping the flexibility of a belt. Its features
follow from that:
- There is **no creep**, so the ratio is exact. This is why it is used for cam drives, positioning axes and printers.
- **Low installation tension** is enough, only to keep the teeth engaged, so the shaft loads are small.
- No lubrication is needed, and the efficiency is 0.97 to 0.99.
- In exchange it does **not slip on overload**: the teeth jump instead. It is noisier at high speed, and it needs good
  alignment.

### 4.1 Profiles

```
## 4.1 Synchronous belt profiles
  MXL / XL / L / H (trapezoidal, ISO 5296)   trapezoid                  p 2.032 / 5.08 / 9.525 / 12.7  glass           old inch standard, light drives
  T5 / T10 / T20 (DIN 7721)                  trapezoid, PU              p 5 / 10 / 20                  steel           linear axes, conveyors
  AT5 / AT10 / AT20                          trapezoid, wide tooth, PU  p 5 / 10 / 20                  steel           linear axes: stiffer, more teeth load
  HTD 3M / 5M / 8M / 14M / 20M (ISO 13050)   round (arc)                p 3 / 5 / 8 / 14 / 20          glass / aramid  power drives, no tooth-root stress peaks
  GT / STD (S5M, S8M) modified curvilinear   modified arc               p 2 / 3 / 5 / 8 / 14           glass / carbon  less backlash, quieter, higher rating
```

The **trapezoidal** tooth (XL, L, T) concentrates stress at the tooth root and enters the pulley with an impact. The
**curvilinear HTD** tooth (High Torque Drive, ISO 13050) has a round flank, so the load spreads more evenly over the tooth.
It carries several times more per tooth. **GT / STD** profiles modify the arc further: less backlash, quieter, about 20 to
30 % more rating. Profiles of different makers can look alike but **must not be mixed**: belt and pulley must be of one
system.

Polyurethane belts with **steel cords** (T, AT) are very stiff and are cut from long lengths. They are the standard for
linear axes, where the carriage is clamped to the belt ends. Rubber belts with glass cords (HTD, GT) are made endless and
are the standard for power drives.

### 4.2 Tooth mechanics: shear, jump-over, tension member

Three things limit a synchronous belt:
1. **Tooth shear and wear.** The effective pull F_e is shared by the teeth in mesh on the small pulley. The share is not even,
   because the first teeth on the tight side carry the most. Catalogues therefore count **at most 6 teeth**
   (`Z_E_MAX = 6`, check), however many are in mesh.
2. **Jump-over (ratcheting).** If the slack-span tension is too low, the belt climbs out of the pulley under load. The
   teeth jump, the timing is lost and the belt is damaged. The installation tension prevents this.
3. **Tension member.** The glass cords carry F1. They are very stiff, but they fail if they are kinked or bent too tightly.
   This is why every profile has a smallest pulley z_min.

`sync()` in the core designs the belt:

```python
    p = S["p"]
    d1, d2 = z1 * p / math.pi, z2 * p / math.pi
    L_th = open_belt(d1, d2, P["a_target"])["L_approx"]
    Lp = nearest(L_th, S["lengths"])
    a = centre_from_length(Lp, d1, d2)
    g = open_belt(d1, d2, a)
    zm = z1 * g["beta1"] / (2 * math.pi)                    # teeth in mesh on the small pulley
    ze = min(math.floor(zm), Z_E_MAX)
    v = math.pi * d1 * P["n1"] / 60000
    c2 = service_factor(P)
    PB = P["P_kW"] * c2
    per_mm = v * (ze * S["f_t"] - S["m_w"] * v * v) / 1000  # kW per mm width
    b = next((w for w in S["widths"] if w * per_mm >= PB), None)
```

The formulas are:
- Pitch diameter: d = z·p / π. The pitch line lies in the cord layer, so the pitch circle is slightly *larger* than the tip
  diameter of the pulley.
- Teeth in mesh: z_m = z1·β1 / 360°.
- Rating per mm width: P/b = v·(z_e·f_t − m_w·v²), where f_t is the permissible tooth load in N per mm width per tooth
  and m_w the belt mass per mm width.
- Width: the smallest standard width with b·(P/b) ≥ P_B.

The add-on checks the tooth load and the jump-over margin:

```python
def sync_tooth_check(P, Y=None):
    Y = Y or sync(P)
    S = SYNC[Y["profile"]]
    b = Y["b"] or S["widths"][-1]
    Fe_act = P["P_load_kW"] * 1000 / Y["v"]
    q = Y["F_e"] / (b * Y["z_e"])
    T2 = Y["T0"] - Y["F_e"] / 2
    return {"b": b, "q": q, "f_t": S["f_t"], "util": q / S["f_t"], "q_act": Fe_act / (b * Y["z_e"]), "T2": T2,
            "jump_margin": T2 / Y["F_e"], "f_mesh": Y["z1"] * P["n1"] / 60}
```

```
## 4.2 Tooth check (default 8M)
  width 20 mm, z_m 14.9 -> counted 6; tooth load 2.60 N/mm per tooth vs 3.8 permissible (util 0.68; actual load 1.05)
  T0 204 N, slack span at design power 48 N -> jump-over margin T2/F_e 0.16; mesh frequency 1563 Hz
```

The default 8M belt, 20 mm wide, uses 68 % of its tooth capacity at design power and 28 % at the actual load. The slack span
keeps 48 N at design power, so it stays taut: no jump-over. The core installs the belt at T0 = 0.6·F_e + m·v²
(typical, check maker). This is lower than the V-belt rule T0 ≈ 0.75·F_e + m·v² (chapter 3.6) for the same power. **Warning:** if the
start torque of the motor (2.5 × nominal, M2) reaches the belt, F_e at start is about 2.5/1.3 of the design value. The slack
span then goes slack and the teeth can jump. For heavy starts, raise T0 or use a soft starter (check).

### 4.3 Choosing profile, pulley size and width

```python
def sync_width_table(P, cases=(("5M", 40, 81), ("8M", 24, 49), ("8M", 32, 65), ("14M", 28, 57))):
    rows = []
    for prof, z1, z2 in cases:
        Y = sync(P, prof, z1, z2)
        rows.append((prof, z1, z2, Y["d1"], Y["v"], Y["z_m"], Y["P_per_mm"], Y["b"], Y["F_shaft"], all(Y["ok"].values()),
                     [k for k, v in Y["ok"].items() if not v]))
    return rows
```

```
## 4.3 Width table (same task)
  5M  z 40/81: d1  63.66, v  9.77 m/s, z_m 19.0, 0.091 kW/mm -> width None, shaft  492 N fails: width_found
  8M  z 24/49: d1  61.12, v  9.38 m/s, z_m 11.4, 0.209 kW/mm -> width 20, shaft  517 N OK
  8M  z 32/65: d1  81.49, v 12.50 m/s, z_m 14.9, 0.274 kW/mm -> width 20, shaft  407 N OK
  14M z 28/57: d1 124.78, v 19.14 m/s, z_m 12.5, 0.968 kW/mm -> width 40, shaft  513 N OK
```

- **5M** is too small: even the widest standard belt (25 mm) carries only 2.3 kW.
- **8M with z1 = 32** is the best choice. It is narrow (20 mm), has the lowest shaft load (407 N) and a moderate speed.
- **8M with z1 = 24** works, but the smaller pulley gives a higher pull and therefore a higher shaft load, and 24 teeth is
  close to z_min = 22, which shortens the life of the cords.
- **14M** is oversized: it needs 40 mm of width and a larger pulley.

The rules behind the table:
- z1 ≥ z_min of the profile (`z1_ge_zmin`).
- At least **6 teeth in mesh** on the small pulley (`teeth_in_mesh_ge_6`).
- v ≤ 40 m/s for rubber belts.
- Speed error ≤ 3 %. Integer tooth numbers cannot give every ratio: 32/65 gives 1442.5 rpm instead of 1450 (−0.5 %), which
  is acceptable for a compressor.

### 4.4 Installation, flanges, noise

**Flanges.** A synchronous belt tends to run sideways, because of the helix of its cords and small misalignment. At least one
pulley needs **flanges**:
- With a short centre distance (a < 8 × d_small, typical rule, check), flange the small pulley on both sides, or each pulley
  on opposite sides.
- With a long centre distance, flange both pulleys.
- On vertical shafts, always flange both pulleys, the lower one on its lower side at least.

A belt that runs hard against a flange wears its edge and overheats. Then the alignment must be corrected, not the flange
made stronger.

**Tension.** It is set and checked with the frequency method, as for V-belts (chapter 3.9), using the belt mass per metre
m_w·b. Synchronous belts do not elongate much (glass cords), so they need no run-in tension and rarely need re-tensioning.
The adjustment range is smaller: about +0.5 % of the belt length to tension and −1 % to install (typical, check). Never lever
the belt over the flange.

**Noise.** The teeth enter the pulley at the **mesh frequency** f_z = z1·n1 / 60. For the default drive that is
32 × 2930 / 60 = 1563 Hz, which is right in the range where the ear is most sensitive. Fast synchronous belts can exceed
85 dB(A). The remedies are:
- GT / STD profiles;
- a correct (not excessive) tension;
- a narrower belt with more teeth;
- covers lined with absorbing material.

For a compressor in a workshop, the V-belt is clearly the quieter choice.

### 4.5 Positioning drives: stiffness, error, backlash

In a linear axis (gantry, handling unit, packaging machine) the belt is the spring between motor and carriage. The two belt
pieces from the carriage to the drive pulley and to the idler act as two springs **in parallel**:

  k = (EA)_spec·b·(1/x + 1/(L − x))

- (EA)_spec is the cord stiffness per mm width.
- x is the carriage position and L the axis length.

The static error under the acceleration force F = m·a is Δx = F/k. The lowest natural frequency of the axis is
f = 1/(2π)·√(k/m). Both are worst at **mid-stroke**, where the stiffness has its minimum.

```python
EA_SYNC = {"5M": 1500.0, "8M": 3000.0, "14M": 6000.0}   # tension member stiffness per mm belt width, N per mm width (unit strain; check)

def positioning_axis(prof="5M", b=15.0, L_axis=1000.0, x=500.0, m_carriage=5.0, acc=5.0, z=24, backlash=0.15):
    EA = EA_SYNC[prof] * b
    rows = []
    for xx in (0.1 * L_axis, 0.25 * L_axis, x, 0.75 * L_axis, 0.9 * L_axis):
        k = EA * (1 / xx + 1 / (L_axis - xx)) * 1000           # N/m (lengths in mm)
        F = m_carriage * acc
        rows.append((xx, k / 1000, F / k * 1000, math.sqrt(k / m_carriage) / (2 * math.pi)))
    d = z * SYNC[prof]["p"] / math.pi
    return {"rows": rows, "F": m_carriage * acc, "d": d, "mm_per_rev": z * SYNC[prof]["p"], "backlash": backlash}
```

```
## 4.4 Positioning axis (5M, 15 mm, 1000 mm, 5 kg at 5 m/s2)
  pulley z 24: d 38.20 mm, 120 mm per revolution, force 25 N, mesh backlash about 0.15 mm (check)
  carriage at  100 mm: k  250.0 N/mm, error 0.100 mm, axis frequency  35.6 Hz
  carriage at  250 mm: k  120.0 N/mm, error 0.208 mm, axis frequency  24.7 Hz
  carriage at  500 mm: k   90.0 N/mm, error 0.278 mm, axis frequency  21.4 Hz
  carriage at  750 mm: k  120.0 N/mm, error 0.208 mm, axis frequency  24.7 Hz
  carriage at  900 mm: k  250.0 N/mm, error 0.100 mm, axis frequency  35.6 Hz
```

What this means for the designer of a handling axis:
- **Error during acceleration.** The carriage lags 0.28 mm behind the motor at mid-stroke. When the acceleration stops,
  the lag disappears as an oscillation at 21 Hz. The position controller must not try to correct faster than that
  frequency: the bandwidth of the loop has to stay well below 21 Hz, typically at a third of it (check, field 3 control
  systems). A stiffer axis needs a wider belt, an AT profile with steel cords, or a shorter belt.
- **Backlash** of the tooth mesh (about 0.1 to 0.2 mm for HTD, less for GT, check) adds to the error when the direction
  reverses. With a motor encoder only, it cannot be corrected; a linear scale on the carriage measures it.
- **The tension must exceed the acceleration force** in both belt pieces, otherwise one piece goes slack and the stiffness
  halves. As a rule (check), T0 ≥ F = m·a, here ≥ 25 N, plus a margin.
- **Resolution:** 120 mm per motor revolution. With a 20-bit encoder that is 0.1 µm per count, so the encoder is never the
  limit. The belt stiffness and the backlash are.

`(EA)_spec` values are typical for glass-cord belts; steel-cord PU belts are 2 to 4 times stiffer (check maker data).


---

## 5. Roller chains (ISO 606): kinematics and polygon effect, rating, length, lubrication, wear, sprockets

A roller chain is a row of short, rigid links that bend only in their joints. It gives an **exact ratio** (no creep),
carries **high force at low speed** with a small shaft load, and tolerates heat, dirt and oil. It has three natural
enemies: **high speed** (impact of the rollers on the teeth), **poor lubrication** (joint wear → elongation) and the
**polygon effect** (the chain runs on a polygon, not on a circle). This chapter derives all three and shows with the
program why the chain fails the 2930 rpm compressor task but is the best choice for a slow conveyor.

All extra results of this chapter: `python drive.py ch56` (add-on functions of chapters 5–6). The core functions
`chain_rating()`, `chain_length()`, `chain_centre()`, `lubrication()` and `chain()` are in the main part of `drive.py`.

### 5.1 Chain parts and the ISO 606 series

A simplex roller chain has five parts per pitch:

| Part | Function | Material and process (chapter 7) |
|---|---|---|
| **Inner plate** (pair) | carries the tension, holds the bushes | quenched and tempered steel, fine-blanked, holes calibrated, shot peened |
| **Outer plate** (pair) | carries the tension, holds the pins (press fit) | as inner plate |
| **Pin** | joint shaft, turns inside the bush | case-hardened (carburised) or through-hardened, ground |
| **Bush** | joint bearing, pressed into the inner plates | case-hardened, rolled or drawn |
| **Roller** | rolls on the tooth, spreads the impact | case-hardened, free to turn on the bush |

The chain joint is a **plain bearing** (pin in bush) that works with an oscillating angle of 360°/z each time a link
enters or leaves a sprocket. Wear in this bearing makes the pitch longer – the chain "stretches", although no plate
stretches at all.

ISO 606 has two families with the same pitches:

- **A series** = American ANSI B29.1 chains (numbers 35, 40, 50 … = pitch in 1/8 inch times 10). Used worldwide; all
  published rating formulas (ACA) refer to it. `drive.py` uses it.
- **B series** = European chains (origin DIN 8187). Same pitch, different roller and width, mostly **higher breaking
  force** at small sizes (08B 18 kN vs 08A 13.9 kN). Ratings differ slightly – use the maker's diagram for B chains.

The data in the program (`CHAINS` in the core, `CH_B_SERIES`, `CH_BEARING_AREA` in the add-on, typical – check):

```python
CHAINS = {
    "06C (ANSI 35)":  {"p": 9.525, "F_B": 7.9, "q": 0.33, "Kr": 29.0},
    "08A (ANSI 40)":  {"p": 12.70, "F_B": 13.9, "q": 0.62, "Kr": 17.0},
    ...
CH_BEARING_AREA = {   # joint bearing area f = pin diameter x bush length, mm2 (simplex, typical, check)
    "06C (ANSI 35)": 28.0, "08A (ANSI 40)": 44.0, "10A (ANSI 50)": 70.0, "12A (ANSI 60)": 106.0,
```

`python drive.py ch56`:

```
## 5.1 ISO 606 roller chains: A series (ANSI) in drive.py and B series (European)
  06C (ANSI 35)   p  9.525 mm  F_B    7.9 kN  q 0.33 kg/m  joint area    28 mm2  F_B/q  23.9 kN m/kg
  08A (ANSI 40)   p 12.700 mm  F_B   13.9 kN  q 0.62 kg/m  joint area    44 mm2  F_B/q  22.4 kN m/kg
  10A (ANSI 50)   p 15.875 mm  F_B   21.8 kN  q 1.02 kg/m  joint area    70 mm2  F_B/q  21.4 kN m/kg
  12A (ANSI 60)   p 19.050 mm  F_B   31.3 kN  q 1.50 kg/m  joint area   106 mm2  F_B/q  20.9 kN m/kg
  16A (ANSI 80)   p 25.400 mm  F_B   55.6 kN  q 2.60 kg/m  joint area   179 mm2  F_B/q  21.4 kN m/kg
  20A (ANSI 100)  p 31.750 mm  F_B   87.0 kN  q 3.91 kg/m  joint area   262 mm2  F_B/q  22.3 kN m/kg
  24A (ANSI 120)  p 38.100 mm  F_B  125.0 kN  q 5.62 kg/m  joint area   394 mm2  F_B/q  22.2 kN m/kg
  08B             p 12.700 mm  F_B   18.0 kN  q 0.70 kg/m
  ...
```

Two lessons from this table:

1. **Strength per mass is almost constant** (≈ 21–24 kN per kg/m). A bigger chain is not "more efficient"; it is just
   bigger. But mass matters at speed: the centrifugal force is F_c = q·v², and the impact energy grows with q·p (5.2).
2. **Breaking force is not the design criterion.** Static safety at normal load is usually 20–100 (see 5.5). Chains
   fail by **fatigue of the plates**, **impact of the rollers** or **wear of the joints** long before the breaking force
   matters. The breaking force is used only for shock and blocking cases (static safety ≥ 7, DIN 8195 style, check).

### 5.2 Kinematics: the polygon (chordal) effect

When a sprocket with z teeth turns, the chain wraps it as a **polygon** with side p, not as a circle. The pitch radius
is

  R = p / (2·sin(π/z))

The link that is just entering the sprocket swings between two positions: when its joint is at the top, the chain
line is at radius R and moves with v_max = ω·R; half a tooth later the chain line is at R·cos(π/z) and moves with
v_min = ω·R·cos(π/z). So the chain speed – and the speed of the driven sprocket – fluctuates by

  (v_max − v_min)/v_max = 1 − cos(π/z)      (≈ π²/(2z²) for many teeth)

at the **tooth-mesh frequency** f_z = z·n/60. The chain line also moves up and down by R·(1 − cos(π/z)), which excites
transverse vibration of the span.

When a roller meets the tooth, it has to change its velocity from the straight-line direction of the span to the
circular path of the sprocket. The change of direction between two neighbouring links is 2π/z, so the **impact
velocity** is about

  v_imp ≈ v·sin(2π/z) → ω·p   for many teeth     (approximation, check)

and the kinetic energy of one link that hits the tooth is E = ½·(q·p)·v_imp². Important: for large z the impact
velocity does **not** go down – it tends to ω·p. It depends on **pitch × speed**. This is why high speed demands a
**small pitch**, and it is the physics behind the roller-bushing limit of 5.3.

```python
def ch_polygon(z, p, n):
    R = p / (2 * math.sin(math.pi / z))
    w = 2 * math.pi * n / 60
    vmax = w * R / 1000
    vmin = vmax * math.cos(math.pi / z)
    v = z * p * n / 60000
    return {"R": R, "v_max": vmax, "v_min": vmin, "var_pct": 100 * (1 - math.cos(math.pi / z)),
            "rise_mm": R * (1 - math.cos(math.pi / z)), "v_imp": v * math.sin(2 * math.pi / z), "f_mesh_Hz": z * n / 60}

def ch_impact_energy(name, z, n):
    C = CHAINS[name]
    v_imp = ch_polygon(z, C["p"], n)["v_imp"]
    return 0.5 * C["q"] * C["p"] / 1000 * v_imp ** 2
```

```
## 5.2 Polygon (chordal) effect, 08A at 2930 rpm vs number of teeth
  z  9: R  18.57 mm, speed variation  6.03 %, chain-line rise 1.120 mm, v_imp 3.59 m/s, E_imp 50.679 mJ, mesh  440 Hz
  z 11: R  22.54 mm, speed variation  4.05 %, chain-line rise 0.913 mm, v_imp 3.69 m/s, E_imp 53.556 mJ, mesh  537 Hz
  z 13: R  26.53 mm, speed variation  2.91 %, chain-line rise 0.771 mm, v_imp 3.75 m/s, E_imp 55.269 mJ, mesh  635 Hz
  z 15: R  30.54 mm, speed variation  2.19 %, chain-line rise 0.667 mm, v_imp 3.78 m/s, E_imp 56.366 mJ, mesh  732 Hz
  z 17: R  34.56 mm, speed variation  1.70 %, chain-line rise 0.588 mm, v_imp 3.81 m/s, E_imp 57.108 mJ, mesh  830 Hz
  z 19: R  38.58 mm, speed variation  1.36 %, chain-line rise 0.526 mm, v_imp 3.83 m/s, E_imp 57.634 mJ, mesh  928 Hz
  z 21: R  42.61 mm, speed variation  1.12 %, chain-line rise 0.476 mm, v_imp 3.84 m/s, E_imp 58.019 mJ, mesh 1026 Hz
  z 25: R  50.66 mm, speed variation  0.79 %, chain-line rise 0.400 mm, v_imp 3.86 m/s, E_imp 58.533 mJ, mesh 1221 Hz
  z 31: R  62.77 mm, speed variation  0.51 %, chain-line rise 0.322 mm, v_imp 3.87 m/s, E_imp 58.967 mJ, mesh 1514 Hz
  z 40: R  80.93 mm, speed variation  0.31 %, chain-line rise 0.249 mm, v_imp 3.88 m/s, E_imp 59.291 mJ, mesh 1953 Hz
```

The self-test also checks the core value for the default (z 19): 1 − cos(180°/19) = 1.36 %.

**Why z1 ≥ 17 (and better 19–25 at high speed):**

- The speed variation falls with 1/z²: 6 % at z = 9, 1.7 % at z = 17, 0.8 % at z = 25. Below about 17 teeth the
  fluctuation is felt as noise, vibration and fluctuating torque in the driven machine.
- The joint angle 360°/z is larger for small z → more sliding per articulation → more wear (5.7).
- The impact energy hardly changes with z, but the **number of impacts per second** (mesh frequency, 928 Hz at z 19 and
  2930 rpm) is proportional to z·n. At 2930 rpm a chain screams – a second reason to keep chains at low speed.
- Upper limit: z2 ≤ about 120 (150 for slow drives). With an elongated chain the rollers ride higher on the teeth; on a
  big sprocket the allowed elongation before the chain jumps is ≈ 200/z2 % – so a large wheel shortens the usable life.

### 5.3 Hunting tooth: odd teeth, even links

The chain length must be an **even** number of links: an odd number needs a cranked (offset) link, which is weaker
(about 80 % of the strength, check). With an even link count, choose an **odd** number of teeth on the sprockets. Then
the greatest common divisor of z and X is 1, and every tooth meets every link in turn – wear is spread evenly ("hunting
tooth").

```python
def ch_hunting(z, X):
    g = math.gcd(z, X)
    return {"gcd": g, "passes_until_repeat": X // g}
```

```
## 5.3 Hunting tooth: z1 vs links X
  z 19, X 92: gcd 1 -> a tooth meets the same link every 92 passes
  z 20, X 92: gcd 4 -> a tooth meets the same link every 23 passes
  z 18, X 90: gcd 18 -> a tooth meets the same link every 5 passes
  z 19, X 91: gcd 1 -> a tooth meets the same link every 91 passes
```

z 18 with 90 links is the worst case: the same five links always land in the same tooth gap, and a single hard or
worn link wears its tooth locally. The default 19 / 38 / 92 links has gcd 1 on the small sprocket. (The big sprocket
z 38 is even, gcd(38, 92) = 2 – acceptable, it turns slowly; 37 or 39 teeth would be perfect.)

### 5.4 Rating: link plate fatigue, roller-bushing impact, galling

The American Chain Association (ACA) rating – the base of ANSI, ISO 10823 and most maker diagrams – has three limits
for one strand, assuming **15 000 h life, recommended lubrication, 3 % allowed elongation, 100-pitch chain, two
sprockets, smooth load** (all check):

**1. Link-plate fatigue** (low and medium speed). The plate is loaded once per chain pass with the chain pull. The
fatigue limit is a force; power = force × speed, and the speed is v = z1·p·n1. Empirically

  H1 = 0.004 · z1^1.08 · n1^0.9 · p^(3 − 0.07 p)     [hp; p in inch, n1 in rpm]

The exponent 0.9 instead of 1.0 says: at higher speed the plate sees more load cycles per hour → slightly less force
for the same life. z1^1.08 is a little more than proportional to the speed v.

**2. Roller-bushing impact** (high speed). From 5.2, the impact energy per engagement is ∝ q·p·(ω·p)², and the number
of impacts per hour ∝ z1·n1. Making the roller and bush survive this gives a power that **falls** with speed:

  H2 = 1000 · K_r · z1^1.5 · p^0.8 / n1^1.5     [hp], K_r = 17 for 08A…24A, 29 for 06C (bushing chain)

**3. Galling** of pin and bush (highest speed): the oil film in the joint breaks down; the rating becomes zero at a
speed limit given in the maker's diagram. It is not in the program; stay well inside the H2 branch.

The rating is H = min(H1, H2) for one strand. In the core of `drive.py`:

```python
def chain_rating(name, z1, n1):
    C = CHAINS[name]
    p = C["p"] / 25.4
    H1 = 0.004 * z1 ** 1.08 * n1 ** 0.9 * p ** (3 - 0.07 * p)
    H2 = 1000 * C["Kr"] * z1 ** 1.5 * p ** 0.8 / n1 ** 1.5
    return {"H1_kW": H1 * HP, "H2_kW": H2 * HP, "P_kW": min(H1, H2) * HP, "limit": "link plate" if H1 < H2 else "roller-bushing"}
```

Setting H1 = H2 gives the **crossover speed**, the speed where the chain carries most power:

  n* = [1000·K_r·z1^0.42·p^0.8 / (0.004·p^(3 − 0.07p))]^(1/2.4)

```python
def ch_crossover(name, z1):
    C = CHAINS[name]
    p = C["p"] / 25.4
    return (1000 * C["Kr"] * z1 ** 0.42 * p ** 0.8 / (0.004 * p ** (3 - 0.07 * p))) ** (1 / 2.4)
```

```
## 5.4 Rating curves 08A, z1 19 (one strand, good lubrication) - H1 link plate, H2 roller-bushing [kW]
  n1  100 rpm: H1   0.58  H2  603.00  ->   0.58 kW (link plate)
  n1  200 rpm: H1   1.08  H2  213.19  ->   1.08 kW (link plate)
  n1  500 rpm: H1   2.47  H2   53.93  ->   2.47 kW (link plate)
  n1 1000 rpm: H1   4.60  H2   19.07  ->   4.60 kW (link plate)
  n1 1500 rpm: H1   6.63  H2   10.38  ->   6.63 kW (link plate)
  n1 2000 rpm: H1   8.59  H2    6.74  ->   6.74 kW (roller-bushing)
  n1 3000 rpm: H1  12.37  H2    3.67  ->   3.67 kW (roller-bushing)
  n1 4000 rpm: H1  16.03  H2    2.38  ->   2.38 kW (roller-bushing)
  crossover speeds (z1 19): 06C 2938 rpm, 08A 1808 rpm, 10A 1476 rpm, 12A 1251 rpm, 16A 967 rpm, 20A 795 rpm, 24A 679 rpm
  08A crossover vs z1: z 13 1692 rpm, z 17 1773 rpm, z 19 1808 rpm, z 25 1897 rpm
```

Reading the curve: the 08A carries most power (≈ 7 kW) at about 1800 rpm. Above that, every extra rpm **reduces**
the rating – at 2930 rpm it is down to 3.8 kW. The bigger the pitch, the lower the crossover speed (24A: 679 rpm).
This single table explains the rule "**fast drive → small pitch, more strands; slow drive → big pitch**".

**Correction factors** (applied in `chain()`):

| Factor | Meaning | In the program |
|---|---|---|
| Strand factor K2 | 2 strands do not carry twice: load sharing is uneven | `STRAND_FACTOR = {1: 1.0, 2: 1.7, 3: 2.5, 4: 3.3}` |
| Service factor K_s | shocks of the driven machine and the motor | `service_factor(P)` – the same c2 as the belts (1.30 for the compressor) |
| Tooth factor K1 | the formula already contains z1, so the ACA tables at z 17 need (z1/17)^1.08 – **not** needed here | – |
| Lubrication | rating valid only with the recommended regime (5.6); with poor lubrication the life is shorter (5.7) | `lubrication(v)` |

The check is P_allow = K2·H ≥ P_req = P·K_s:

```python
    r = chain_rating(name, z1, P["n1"])
    Ks = service_factor(P)
    P_req = P["P_kW"] * Ks
    P_all = r["P_kW"] * STRAND_FACTOR[k]
```

### 5.5 Number of links, centre distance, static safety – the default task at 2930 rpm

The number of links for a wanted centre distance a (same structure as the belt length, with the pitch line of the
polygon):

  X = 2a/p + (z1 + z2)/2 + ((z2 − z1)/(2π))²·p/a

rounded to an **even** number, and the real centre distance back from X:

  a = p/4 · [A + √(A² − 8·((z2 − z1)/(2π))²)],  A = X − (z1 + z2)/2

```python
def chain_length(z1, z2, a, p):
    return 2 * a / p + (z1 + z2) / 2 + ((z2 - z1) / (2 * math.pi)) ** 2 * p / a

def chain_centre(X, z1, z2, p):
    A = X - (z1 + z2) / 2
    return p / 4 * (A + math.sqrt(A * A - 8 * ((z2 - z1) / (2 * math.pi)) ** 2))
```

The self-test proves that `chain_centre(chain_length(...))` returns the input distance. Recommended a = 30…50 p
(max 80 p): shorter → few teeth in wrap and fast joint wear; longer → span vibration and a sagging slack side.

Static safety against breaking: S = F_B·k_strands / (F_t·K_s + F_c) with F_t = P/v and F_c = q·v².

`python drive.py examples` (core) gives the default (08A simplex, z 19 / 38):

```
## Roller chain 08A (ANSI 40) x 1
- z1 19 / z2 38, d 77.2 / 153.8 mm, v 11.78 m/s, 92 links (theory 91.8), a 401.4 mm (32 pitches)
- rating per strand: link plate 12.11 kW, roller-bushing 3.80 kW -> 3.80 kW (roller-bushing); allowed 3.80 kW vs required 3.90 kW
- chain pull 255 N, centrifugal 86.1 N, static safety 33.3; polygon speed variation 1.36 %; lubrication: pressure spray (oil pump) -> fails: rating
```

The add-on tries other sizes and strands (`ch_select()` returns the smallest passing chain):

```python
def ch_select(P, z1=None):
    for k in (1, 2, 3):
        for nm in CHAINS:
            K = chain(P, name=nm, strands=k, z1=z1)
            if all(K["ok"].values()):
                return K
    return None
```

```
## 5.5 Default task (2930 rpm): strands and sizes
  06C (ANSI 35)   x1: allowed  5.12 kW vs 3.90, v  8.84 m/s, S_static  16.9, pressure spray (oil pump) -> OK
  06C (ANSI 35)   x2: allowed  8.70 kW vs 3.90, v  8.84 m/s, S_static  33.8, pressure spray (oil pump) -> OK
  06C (ANSI 35)   x3: allowed 12.80 kW vs 3.90, v  8.84 m/s, S_static  50.7, pressure spray (oil pump) -> OK
  08A (ANSI 40)   x1: allowed  3.80 kW vs 3.90, v 11.78 m/s, S_static  33.3, pressure spray (oil pump) -> fails: rating
  08A (ANSI 40)   x2: allowed  6.46 kW vs 3.90, v 11.78 m/s, S_static  66.7, pressure spray (oil pump) -> OK
  08A (ANSI 40)   x3: allowed  9.51 kW vs 3.90, v 11.78 m/s, S_static 100.0, pressure spray (oil pump) -> OK
  10A (ANSI 50)   x1: allowed  4.55 kW vs 3.90, v 14.73 m/s, S_static  44.8, pressure spray (oil pump) -> fails: a_30_to_80_pitches
  10A (ANSI 50)   x2: allowed  7.73 kW vs 3.90, v 14.73 m/s, S_static  89.7, pressure spray (oil pump) -> fails: a_30_to_80_pitches
  10A (ANSI 50)   x3: allowed 11.36 kW vs 3.90, v 14.73 m/s, S_static 134.5, pressure spray (oil pump) -> fails: a_30_to_80_pitches
  smallest passing chain at 2930 rpm: 06C (ANSI 35) x1 (v 8.84 m/s, pressure spray (oil pump))
  wear: p_G 15.8 MPa, 29823 passes/h, life to 3 % elongation 4613 h (good lubrication)
```

Engineering judgement:

- The **smaller** 06C passes where the 08A fails – the smaller pitch moves the crossover speed up to 2938 rpm. This is
  the 5.4 rule in action.
- But every passing chain at 2930 rpm runs at 8.8–11.8 m/s and needs **pressure-spray lubrication** (an oil pump, a
  closed case, an oil cooler) and its life is only ≈ 4600 h even with good oil (5.7) – one year at 16 h/day.
- The V-belt (1 × SPZ) or the HTD belt (20 mm) do the same job dry, in an open guard. **A chain is the wrong drive
  for the compressor.** The program says "fails" for the default simplex 08A and the reasons above say "do not use
  even the passing ones".

### 5.6 Lubrication regimes

The joint is a plain bearing that oscillates; it needs oil **inside** the joint, between pin and bush. Oil on the
outside of the plates does nothing. The required regime depends on the chain speed (typical maker chart, check):

```python
def lubrication(v):
    return "manual / grease" if v <= 2 else "drip" if v <= 4 else "oil bath / slinger" if v <= 7 else "pressure spray (oil pump)"
```

| Regime | Chain speed | How | Notes |
|---|---|---|---|
| Manual / grease | ≤ 2 m/s | brush or oil can, every 8 h | open drives, agricultural machines; grease does not penetrate well |
| Drip | ≤ 4 m/s | drip lubricator, 5–20 drops/min onto the slack span at the plate gaps | simple guard with a sump |
| Oil bath / slinger disc | ≤ 7 m/s | the lower span dips 5–10 mm into oil, or a disc throws oil | oil-tight casing |
| Pressure spray | > 7 m/s | pump, nozzles across the full width on the inside of the slack span, return and filter, often cooler | heavy drives, engines (timing chains) |

Oil: ISO VG 68–220 depending on temperature (thicker at higher temperature and load, check). Pre-lubricated
(sintered-bush, O-ring/X-ring) chains extend the interval but do not reach the bath rating at high speed.

### 5.7 Wear elongation and life

Each time a joint enters or leaves a sprocket, pin and bush turn against each other by the joint angle 2π/z. The
sliding way in the joint per articulation is s = (d_pin/2)·(2π/z). One chain pass has four articulations of each joint
(in and out of both sprockets), so

  s_pass = 2·(d_pin/2)·(2π/z1 + 2π/z2)

The joint pressure is the **articulation pressure**

  p_G = F_t·K_s / f,  f = d_pin × bush length (joint bearing area)

By Archard's wear law the wear depth is h = k·p_G·s (k = wear coefficient / hardness, mm²/N). The pitch lengthens by
about h (pin and bush wear add up along the load line), so with N passes per hour the life until the elongation limit
Δp/p = 3 % is

  L_h = 0.03·p / (k·λ·p_G·s_pass·N),   N = v·3600 / (X·p)

with a lubrication factor λ (1 good … 20 dry). The constant k is calibrated so that a chain loaded like an ACA rating
case reaches the ACA rating life of 15 000 h (typical – check with maker wear data).

```python
CH_K_WEAR = 7.4e-11   # wear coefficient k/H mm2/N of the pin-bush joint, calibrated so that the low-speed case
                      # (08A, z 19/57, 1450 rpm, good lubrication) reaches ~15 000 h = the ACA rating life (check)

def ch_wear_life(P, lub="good (bath / pressure)", limit=0.03, name=None, z1=None, z2=None):
    K = chain(P, name=name, z1=z1, z2=z2)
    nm = K["chain"]
    f, d = CH_BEARING_AREA[nm] * K["strands"], CH_PIN_D[nm]
    pG = K["F_t"] * K["K_s"] / f
    s_pass = 2 * d / 2 * (2 * math.pi / K["z1"] + 2 * math.pi / K["z2"])    # mm sliding per joint per pass
    passes_h = K["v"] * 3600 / (K["X"] * K["p"] / 1000)
    h_per_h = CH_K_WEAR * CH_LUB_FACTOR[lub] * pG * s_pass * passes_h
    return {"p_G": pG, "s_pass": s_pass, "passes_h": passes_h, "L_h": limit * K["p"] / h_per_h, "lub": lub}
```

What the formula teaches (independent of the exact k):

- Life ∝ 1/(p_G·N): a **short, fast** chain wears fastest because every joint articulates more often. The 06C at 2930
  rpm: 29 823 passes/h → 4613 h. Doubling the centre distance (more links) doubles the life.
- Life ∝ z: bigger sprockets → smaller joint angle → less sliding.
- Life ∝ 1/λ: lubrication dominates (5.6 below shows 15 000 h → 750 h when dry).
- Why 3 %: with elongation the rollers climb up the tooth flank; at about 3 % (less on large sprockets, ≈ 200/z2 %)
  the chain jumps teeth or the timing of a synchronised machine is lost. **Measure elongation** over 10–20 links with a
  caliper or chain gauge and replace at the limit – and replace worn sprockets with the chain.

### 5.8 Where chains belong: the low-speed case

Same 3 kW, but a 4-pole motor at 1450 rpm drives a conveyor at 480 rpm (i ≈ 3), medium duty, a ≈ 500 mm:

```python
def ch_low_speed_case():
    return dict(DEFAULT, n1=1450.0, n2=480.0, ch_z1=19, ch_z2=57, load_class="medium (screw compressors, conveyors)",
                a_target=500.0, vb_d1=125.0, sy_z1=30, sy_z2=90)
```

```
## 5.8 Low-speed case: 3 kW, 1450 -> 480 rpm, conveyor (where chains belong)
  smallest passing chain: 08A (ANSI 40) x1, z 19/57, v 5.83 m/s, 118 links, a 502.1 mm, rating 6.43 (link plate) vs 3.60 kW, S_static 21.8, oil bath / slinger
  wear life with lubrication 'good (bath / pressure)': 15003 h
  wear life with lubrication 'drip': 7501 h
  wear life with lubrication 'manual, irregular': 3001 h
  wear life with lubrication 'dry': 750 h
  static safety 21.8, link-plate fatigue safety 5.44 (F_fat 3475 N)
  compare at 1450 -> 480: chain shaft load 592 N; V-belt 2 x SPZ d1 125/d2 375 shaft load 625 N (n2 478); HTD 8M 30 mm shaft load 746 N (n2 483)
  chain shaft load (horizontal): 592 N
  chain shaft load (vertical): 540 N
```

Now the 08A simplex is in its **link-plate branch** (6.43 kW, almost 2 × the requirement), an oil bath is enough,
the ratio is exact (z 19/57 = 3.000 → 483 rpm) and the **shaft load is the smallest** of the three drives. The chain
needs no pre-tension – only the weight sag of the slack span (5.9). The V-belt needs 2 belts here, because the belt
speed at 1450 rpm is half and the power per belt drops (chapter 3).

Static and fatigue safety (add-on):

```python
CH_FATIGUE_RATIO = 0.25   # link-plate fatigue force / breaking force (typical, check)

def ch_safety(P, name=None, strands=None):
    K = chain(P, name=name, strands=strands)
    C = CHAINS[K["chain"]]
    Ffat = CH_FATIGUE_RATIO * C["F_B"] * 1000 * STRAND_FACTOR[K["strands"]]
    return {"S_static": K["S_static"], "S_fatigue": Ffat / (K["F_t"] * K["K_s"] + K["F_c"]), "F_fat": Ffat}
```

The fatigue safety 5.44 (> 1 with margin) confirms that the plates are not the limit; the **wear life** (15 000 h with
an oil bath) is. Rule: if the drive is greased by hand once a week, plan on 3000 h – or choose a sealed (O-ring) chain.

### 5.9 Sag, tension and the shaft load

A chain is not pre-tensioned like a belt. The slack span hangs as a shallow parabola: sag f = q·g·a²/(8·F). The
recommended sag is 1–2 % of a (horizontal drives, check); then the span tension from the weight is only tens of
newtons:

```python
def ch_sag(a_mm, q, F_N=None, sag_pct=None):
    a = a_mm / 1000
    if F_N is not None:
        return 1000 * q * 9.81 * a * a / (8 * F_N)
    f = sag_pct / 100 * a
    return q * 9.81 * a * a / (8 * f)
```

```
## 5.9 Sag and tension of the slack span (low-speed case)
  sag 1 % of a (5.0 mm): span tension from weight 38.2 N
  sag 2 % of a (10.0 mm): span tension from weight 19.1 N
  sag 3 % of a (15.1 mm): span tension from weight 12.7 N
  chain pull 514 N -> tight-span sag 0.373 mm
```

Consequences:

- The shaft load is about the chain pull plus the weight: F_W ≈ 1.15·F_t horizontal, ≈ 1.05·F_t vertical
  (`ch_shaft_load()`, typical, check). Compare a V-belt: ≈ 1.5–2 × F_e because it needs friction tension.
- Too tight (no sag): the joints are loaded all the way round → fast wear and bearing load. Too slack (> 3 %): the
  chain whips, climbs teeth, and the slack span can resonate.
- **Tensioners**: adjustable centre distance (motor on slide rails – best), or an idler sprocket / spring tensioner on
  the **slack** span, close to the driven sprocket, wrapping at least 3 teeth. Vertical drives always need a
  tensioner, because the sag does not hold the chain on the lower sprocket.
- Span resonance: the tight span is a string with f_span = (1/(2a))·√(F/q). Keep it away from the mesh frequency
  z1·n1/60 and from the machine orders.

### 5.10 Chain design checklist

1. Speed v = z1·p·n1/60000: ≤ 7 m/s for an oil bath; > 12 m/s → reconsider (belt).
2. z1 ≥ 17 (≥ 19–25 at high speed, ≥ 25 for heavy shocks), odd; z2 ≤ 120; i ≤ 7.
3. Rating with service factor and strand factor ≥ required; check which branch limits (plate or roller-bushing).
4. Links even, a = 30…50 p, sag 1–2 %, adjustable centre or tensioner on the slack span.
5. Lubrication regime from speed, written on the drawing and in the maintenance plan.
6. Wear life ≥ required hours; elongation limit 3 % (2 % for timing drives) in the inspection plan.
7. Static safety ≥ 7 for the blocking / start case.
8. Shaft load 1.15·F_t → M3 shaft and M4 bearings; align sprockets within 0.5 mm per 100 mm a (check).

---

## 6. Shaft couplings: types, misalignment, DIN 740-2 selection, torsional vibration, torque limiters, universal joints

The direct-drive alternative of the compressor replaces the belt by a **4-pole motor** (1445 rpm) and a **coupling**.
A coupling has four jobs:

1. transmit the torque (nominal, start peak, vibratory),
2. **accept misalignment** between two shafts that are never exactly in line (radial, angular, axial),
3. **tune the torsional vibration** of the drive train (stiffness) and dissipate energy (damping),
4. sometimes **protect** the machine (torque limiter) or insulate electrically.

### 6.1 Coupling types

```
## 6.1 Coupling types
  rigid sleeve / flange            rigid                        none (shafts must be aligned exactly) none                 line shafts, vertical pumps
  shrink disc / clamp              rigid                        none                                 none                 hollow-shaft gearboxes, hub-shaft connection
  disc pack (steel lamellae)       torsionally stiff            angular + axial, radial with spacer  none                 pumps, compressors, servo
  gear coupling (crowned teeth)    torsionally stiff            angular, radial (double)             none, needs grease   heavy drives, rolling mills
  metal bellows                    torsionally stiff, no backlash all three, small                     none                 encoders, ball screws, servo
  Oldham                           stiff, small backlash        radial (large)                       low                  small drives, pumps
  elastic jaw (spider)             elastic, progressive         all three, small                     medium (psi ~0.8)    motors to pumps, fans, compressors
  tyre coupling                    very elastic                 all three, large                     high                 shock loads, poor alignment
  pin-and-bush (N-EUPEX type)      elastic                      all three, medium                    medium               general industry, fail-safe
  highly flexible (rubber block)   very soft                    large                                high                 diesel engines, generator sets
```

How each works:

- **Rigid** (sleeve, flange, shrink disc): the two shafts become one. Allowed only when both shafts are held by one
  rigid bearing system (or one shaft has only one bearing). Any misalignment is forced into the bearings.
- **Torsionally stiff, flexible**: steel elements bend instead of an elastomer. A **disc pack** (thin stainless
  lamellae bolted alternately to the two hubs) bends for angular and axial offset; two packs with a spacer accept
  radial offset. No wear, no lubrication, no backlash; the API 610 / API 671 choice for pumps and compressors. A
  **gear coupling** (crowned external teeth in an internal sleeve) carries very high torque in small size, but needs
  grease and wears. A **metal bellows** is the servo coupling (no backlash, high stiffness, small misalignment). An
  **Oldham** coupling slides a middle disc in two perpendicular slots – large radial offset, but the slide wears and
  the middle disc causes a once-per-revolution disturbance.
- **Elastic**: an elastomer element between the hubs. The **jaw coupling** (curved jaws with a polyurethane spider,
  92 or 98 Shore A) is compact and fail-safe (when the spider is destroyed, the jaws still drive), with **progressive**
  stiffness (the spider stiffens with load). The **tyre coupling** (rubber tyre clamped to two flanges) is very soft,
  accepts large misalignment and damps shocks, but is big. The **pin-and-bush** type (pins with rubber buffers) is the
  classic general-industry coupling.
- **Highly flexible** (large rubber blocks): very low stiffness to move the torsional resonance below idle speed of a
  diesel engine.

### 6.2 Misalignment and restoring forces

Three kinds of misalignment exist, and real shafts have all three at once:

| Kind | Symbol | Cause | Effect on the machine |
|---|---|---|---|
| radial (parallel) offset | ΔK_r [mm] | foot heights, shim errors | restoring force F_r = C_r·ΔK_r on both shaft ends, at 1 × and 2 × speed |
| angular | ΔK_w [deg] | soft foot, base distortion | restoring moment M_w ≈ C_w·ΔK_w; bending in the shafts |
| axial | ΔK_a [mm] | thermal growth, end float | axial force on bearings |

An elastic coupling **does not make misalignment harmless**: the elastomer is a spring, and offsetting a spring by
ΔK_r creates a force that rotates with the shaft. This force acts on the motor bearing and the machine bearing, it
heats the spider and it is a typical source of 1× and 2× vibration.

```python
CP_RADIAL_STIFF = {"J14": 180.0, "J19": 600.0, "J24": 1100.0, "J28": 1400.0, "J38": 1900.0, "J42": 2100.0, "J48": 2600.0}   # N/mm (92 Sh A, check)

def cp_restoring(size, dKr_mm, dKw_deg=0.0, spider="92 Sh A"):
    Cr = CP_RADIAL_STIFF[size] * SPIDER[spider]["C"]
    Cw = 0.35 * JAW[size]["C_dyn"] * SPIDER[spider]["C"]
    return {"F_r": Cr * dKr_mm, "M_w": Cw * math.radians(dKw_deg), "dKr_perm": JAW[size]["dKr"]}

def cp_bearing_from_restoring(F_r, a_brg=120.0, b_overhang=60.0):
    return {"near": F_r * (a_brg + b_overhang) / a_brg, "far": F_r * b_overhang / a_brg}
```

The bearing loads follow from statics: a force F_r at the overhang b from the near bearing, with bearing distance a,
gives F_near = F_r·(a + b)/a and F_far = F_r·b/a (a lever).

```
## 6.2 Misalignment: restoring forces of the jaw coupling (92 Sh A)
  J24 dKr 0.05 mm (perm 0.22): F_r    55 N, M_w(0.5 deg) 15.0 N m -> motor bearing near 82 N / far 28 N
  J24 dKr 0.10 mm (perm 0.22): F_r   110 N, M_w(0.5 deg) 15.0 N m -> motor bearing near 165 N / far 55 N
  J24 dKr 0.20 mm (perm 0.22): F_r   220 N, M_w(0.5 deg) 15.0 N m -> motor bearing near 330 N / far 110 N
  J28 dKr 0.05 mm (perm 0.25): F_r    70 N, M_w(0.5 deg) 31.5 N m -> motor bearing near 105 N / far 35 N
  J28 dKr 0.10 mm (perm 0.25): F_r   140 N, M_w(0.5 deg) 31.5 N m -> motor bearing near 210 N / far 70 N
  J28 dKr 0.20 mm (perm 0.25): F_r   280 N, M_w(0.5 deg) 31.5 N m -> motor bearing near 420 N / far 140 N
  J38 dKr 0.05 mm (perm 0.28): F_r    95 N, M_w(0.5 deg) 64.1 N m -> motor bearing near 142 N / far 48 N
  ...
```

**Lesson for the compressor:** with the J28 at the catalogue limit 0.20 mm the motor drive-end bearing gets 420 N
extra – **more than the whole V-belt shaft load** (272 N running, chapter 3). The advantage "no shaft load" of the
direct drive exists only if the drive is **aligned to ≤ 0.05 mm** (laser alignment, chapter 7). Also: the catalogue
misalignment values are maxima for the coupling itself and are often reduced with speed (check the maker's speed
factor); for long bearing life aim at ≤ 25 % of the catalogue value.

### 6.3 DIN 740-2 selection – the default direct drive

DIN 740-2 compares the coupling ratings with the loads multiplied by factors:

| Check | Formula | Factor meaning |
|---|---|---|
| Nominal | T_KN ≥ T_N·S_t | T_N = 9550·P/n; S_t temperature factor (elastomer softens when warm) |
| Peak (start, shock) | T_Kmax ≥ T_S = T_AS·M_A·S_A·S_z·S_t | T_AS motor start torque (k_start × T_N); M_A share that reaches the coupling; S_A shock factor; S_z start-frequency factor |
| Vibratory | T_KW ≥ T_W·S_t·S_f | T_W vibratory torque amplitude at the coupling; S_f = √(f/10) for f > 10 Hz (the T_KW rating is for 10 Hz) |
| Resonance passage | T_Kmax ≥ T_res | when starting through a resonance (supercritical drive) |
| Damping heat | P_W ≤ P_KW(T) | 6.6 |
| Bore, speed | d ≤ bore_max, n ≤ n_max | |

**The mass factors.** When a torque acts on one side of a 2-mass system (motor J_A, load J_L) slowly, the coupling only
transmits the part needed to accelerate the **other** mass:

- torque from the motor (start): coupling sees T·J_L/(J_A + J_L) = T·M_A,
- torque from the load (compressor pulses): coupling sees T·J_A/(J_A + J_L) = T·M_L.

Derivation (drive side): the whole system accelerates with α = T/(J_A + J_L); the coupling must accelerate J_L, so
T_K = J_L·α = T·J_L/(J_A + J_L). The heavy flywheel on the compressor side makes M_A ≈ 0.89 (nearly the full start
torque passes) and M_L ≈ 0.12 (the compressor pulses are mostly absorbed by the flywheel itself).

In the core:

```python
    st = S_t(P["cp_T_amb"])
    TN = 9550 * P["P_kW"] / P["cp_n"]
    MA, ML = JL / (JA + JL), JA / (JA + JL)                  # share of a drive-side / load-side torque seen by the coupling
    TS = P["cp_k_start"] * TN * MA * P["cp_S_A"] * S_z(P["cp_starts_h"]) * st
```

```python
def S_t(T):
    return 1.0 if T <= 30 else 1.2 if T <= 40 else 1.4 if T <= 60 else 1.8

def S_z(starts):
    return 1.0 if starts <= 100 else 1.2 if starts <= 200 else 1.4 if starts <= 400 else 1.6
```

`python drive.py ch56`:

```
## 6.3 DIN 740-2 selection, default direct drive (4-pole motor 1445 rpm, 92 Sh A)
  T_N = 9550 P/n = 19.83 N m; S_t(40 C) 1.2; S_z(6 starts/h) 1.0; S_A 1.8; k_start 2.5
  J_A 0.00980, J_L 0.07530 kg m2 -> M_A 0.885 (drive-side share), M_L 0.115 (load-side share)
  nominal: T_KN 95 >= T_N S_t 23.8; peak: T_Kmax 190 >= T_S 94.7; vibratory T_KW 24.7 N m
  order 1: f 24.1 Hz, eta 0.139, V 1.019, T at coupling 1.81 N m, x S_t x S_f -> 3.37 N m, util 0.14
  order 3: f 72.2 Hz, eta 0.417, V 1.205, T at coupling 1.44 N m, x S_t x S_f -> 4.63 N m, util 0.19
  order 4: f 96.3 Hz, eta 0.555, V 1.434, T at coupling 1.74 N m, x S_t x S_f -> 6.49 N m, util 0.26
  order 5: f 120.4 Hz, eta 0.694, V 1.890, T at coupling 0.90 N m, x S_t x S_f -> 3.76 N m, util 0.15
  checks: bore OK, nominal OK, peak_start OK, vibratory OK, resonance_passage OK, no_resonance OK, speed OK
```

The **start peak decides the size**: T_S = 2.5 × 19.83 × 0.885 × 1.8 × 1.0 × 1.2 = 94.7 N m. The J24 (T_Kmax 70 N m)
fails this check, although its nominal torque (35 N m) is 1.5 × the motor torque – a typical trap of "selecting by
nominal torque". The J24 would also have its natural frequency (121 Hz) right on order 5 (120 Hz) – see 6.7. The J28
passes everything with 2 × margin on the start peak. (Its bore 38 mm also takes the motor shaft 28 mm and the crank
journal 30 mm.)

### 6.4 The compressor torque orders (hand-over from M2)

The vibratory loads are the harmonics of the compressor's drive torque M_drive(θ) from M2. The default values in
`cp_T_harm` are checked by a discrete Fourier transform of `crank.compute_all()`:

  a_k = (2/N)·Σ M(θ_i)·cos(kθ_i),  b_k = (2/N)·Σ M(θ_i)·sin(kθ_i),  T_k = √(a_k² + b_k²)

```python
def cp_dft_orders(n_orders=6):
    import crank
    R = crank.compute_all()
    th = [r["theta"] for r in R["rows"]]
    M = [r["M_drive"] for r in R["rows"]]
    N = len(M)
    out = []
    for k in range(1, n_orders + 1):
        a = sum(m * math.cos(k * t) for m, t in zip(M, th)) * 2 / N
        b = sum(m * math.sin(k * t) for m, t in zip(M, th)) * 2 / N
        out.append((k, math.hypot(a, b)))
    return {"mean": sum(M) / N, "orders": out}
```

```
## 6.4 Compressor torque orders from M2 crank.py (DFT) vs cp_T_harm
  mean 10.409 N m; order 1 15.409 (cp_T_harm 15.41); order 2 0.000 (cp_T_harm -); order 3 10.353 (cp_T_harm 10.35); order 4 10.548 (cp_T_harm 10.55); order 5 4.146 (cp_T_harm 4.15); order 6 0.000 (cp_T_harm -)
```

The DFT reproduces the input values to the second decimal and confirms that orders 2 and 6 are zero for this M2
machine. Note the size of the pulsation: the order amplitudes add up to more than 4 × the mean torque (10.4 N m) –
a piston compressor is a strong torsional exciter. If the M2 design changes, re-run the DFT and copy the new values
into `cp_T_harm`.

### 6.5 Torsional vibration of the two-mass system

Motor rotor J_A and compressor + flywheel J_L are connected by the coupling spring C (torsional stiffness, N m/rad).
With the twist θ = φ_L − φ_A and a load torque T·sin(ωt):

  J_A·φ̈_A = C·θ,   J_L·φ̈_L = T·sin(ωt) − C·θ   ⟹   θ̈ + C·(1/J_A + 1/J_L)·θ = (T/J_L)·sin(ωt)

Natural frequency (the core uses exactly this):

  f_e = (1/2π)·√(C·(J_A + J_L)/(J_A·J_L))

Elastomers damp by **hysteresis**: the energy lost per cycle is a fixed fraction ψ of the elastic energy, almost
independent of frequency. This is modelled by a complex stiffness C·(1 + j·ψ/2π). The steady-state coupling torque is

  T_K = T·M_L·V(η),   V = √(1 + (ψ/2π)²) / √((1 − η²)² + (ψ/2π)²),   η = f/f_e

```python
def magnification(eta, psi):
    d = psi / (2 * math.pi)
    return math.sqrt(1 + d * d) / math.sqrt((1 - eta * eta) ** 2 + d * d)
```

The core self-test integrates the same two-mass system in time (RK4) and finds the same amplitude (1.779 N m both).

```
## 6.5 Magnification V(eta), psi 0.80 (92 Sh A)
  eta 0.000: V 1.000
  eta 0.200: V 1.041
  eta 0.400: V 1.187
  eta 0.600: V 1.545
  eta 0.800: V 2.640
  eta 0.900: V 4.408
  eta 1.000: V 7.917
  eta 1.100: V 4.105
  eta 1.200: V 2.201
  eta 1.414: V 1.001
  eta 2.000: V 0.336
  eta 3.000: V 0.126
  resonance V_R = sqrt(1 + (2 pi/psi)^2) = 7.92 (~ 2 pi / psi = 7.85)
```

Three zones:

| Zone | η | Behaviour | Use |
|---|---|---|---|
| subcritical | < 0.8 | V ≈ 1…2.6, the coupling transmits the torque pulses nearly 1:1 | stiff coupling (f_e above all orders) |
| resonance | 0.8…1.3 | V up to 2π/ψ ≈ 8 – the program forbids this band (`no_resonance`) | never in steady running |
| supercritical | > √2 = 1.414 | V < 1 – the coupling **isolates** | soft coupling (f_e below the lowest order); the drive passes the resonance at every start and stop |

### 6.6 Damping heat in the spider

The energy lost per cycle is ψ times the elastic energy W_el = T_K²/(2C). Summed over all orders:

  P_W = Σ ψ·T_K,k²/(2C)·f_k

It heats the elastomer; the maker gives a permissible damping power P_KW, reduced at higher ambient temperature
(typical, check):

```python
def cp_damping_heat(P, size=None):
    r = cp_din740(P, size)
    P_W = sum(r["psi"] * o["T_coupling"] ** 2 / (2 * r["C_dyn"]) * o["f"] for o in r["orders"])
    perm = CP_P_KW[r["size"]] * (1.0 if P["cp_T_amb"] <= 30 else 0.8 if P["cp_T_amb"] <= 40 else 0.6)
    return {"P_W": P_W, "P_KW_perm": perm, "size": r["size"]}
```

```
## 6.6 Damping heat in the spider
  J28: P_W 0.024 W vs permissible 5.1 W at 40 C
  J38: P_W 0.010 W vs permissible 6.4 W at 40 C
```

Because the flywheel takes most of the compressor pulses (M_L = 0.115), the spider loses only 0.024 W – no problem.
Damping heat becomes the limit near resonance (V ≈ 8 → 64 × the heat) and for diesel engines. Misalignment adds
heat too (the spider is flexed once per revolution) – another reason for good alignment.

### 6.7 Soft or stiff coupling? – stiffness study

The add-on keeps the J28 torques and hubs and varies only the stiffness:

```python
def cp_stiffness_study(P, Cs=(150.0, 300.0, 600.0, 1200.0, 2500.0, 5000.0, 10300.0, 24720.0)):
    rows = []
    for C in Cs:
        JAW["_tmp"] = dict(JAW["J28"], C_dyn=C)          # temporary size entry, removed again
        try:
            r = coupling_check(P, "_tmp")
        finally:
            del JAW["_tmp"]
        Tmax = max(o["T_coupling"] for o in r["orders"])
        ...
```

The resonance-passage torque in the core for supercritical orders is T_k·M_L·V(η = 1) (·S_z·S_t). V(1) = √(1 + (ψ/2π)²)/(ψ/2π) = 7.92 for ψ = 0.8 – slightly more than the common shortcut 2π/ψ = 7.85:

```python
    supercritical = [o for o in orders if o["eta"] > 1]
    T_res = max((o["T_coupling"] / o["V"] * magnification(1.0, psi) for o in supercritical), default=0.0) * S_z(P["cp_starts_h"]) * st
```

```
## 6.7 Soft vs stiff coupling (J28 torques, stiffness varied)
  C    150 N m/rad: f_e   20.9 Hz, supercritical max order torque 5.14 N m, resonance passage 16.9 N m -> fails: no_resonance
  C    300 N m/rad: f_e   29.6 Hz, mixed         max order torque 4.95 N m, resonance passage 11.5 N m -> fails: no_resonance
  C    600 N m/rad: f_e   41.9 Hz, mixed         max order torque 2.63 N m, resonance passage 11.5 N m -> OK
  C   1200 N m/rad: f_e   59.2 Hz, mixed         max order torque 2.38 N m, resonance passage 11.5 N m -> fails: no_resonance
  C   2500 N m/rad: f_e   85.5 Hz, mixed         max order torque 4.09 N m, resonance passage 11.5 N m -> fails: no_resonance
  C   5000 N m/rad: f_e  120.9 Hz, subcritical   max order torque 3.78 N m, resonance passage 0.0 N m -> fails: no_resonance
  C  10300 N m/rad: f_e  173.5 Hz, subcritical   max order torque 1.81 N m, resonance passage 0.0 N m -> OK
  C  24720 N m/rad: f_e  268.7 Hz, subcritical   max order torque 1.79 N m, resonance passage 0.0 N m -> OK
```

The compressor has orders at 24, 72, 96 and 120 Hz – a dense comb. Every stiffness that puts f_e within −20 %…+30 % of
any order fails: 150 (order 1), 300 (order 1), 1200 (order 3), 2500 (order 4), 5000 (order 5 – this is the J24).
Only two "windows" remain:

- **C ≈ 600 N m/rad** (f_e 42 Hz, between orders 1 and 3): narrow window; the spider stiffness changes with
  temperature (±20 %) and with load (progressive), so the drive could drift into order 1 or 3 – risky.
- **C ≥ 10 000 N m/rad** (f_e ≥ 170 Hz, above order 5): all orders subcritical, V ≤ 1.9, no resonance passage at start.
  This is the J28 92 Sh A (f_e 173.5 Hz) or the J28 98 Sh A (268.7 Hz, even more margin).

**Decision: stiff coupling, J28.** For this compressor, a soft "isolating" coupling would need f_e below
24/√2 = 17 Hz (C < 100 N m/rad) – a highly flexible coupling with large twist and a strong resonance passage at
every start. The flywheel already isolates the motor (M_L = 0.115), so stiffness is the better choice.

### 6.8 More than two masses: the Holzer method

The real train is motor – coupling – flywheel – crank stub – crank. Holzer's method finds the natural frequencies of
such a chain of inertias J_i and springs k_i: for a trial frequency ω, start at the free end with twist θ = 1, add the
inertia torques J_i·ω²·θ_i along the chain, reduce the twist by T/k_i over each spring, and look at the residual torque
at the other free end. Where the residual is zero, ω is a natural frequency.

```python
def cp_holzer(J, k, f_lo=1.0, f_hi=2000.0, steps=4000):
    def resid(f):
        w2 = (2 * math.pi * f) ** 2
        th, T = 1.0, 0.0
        for i, Ji in enumerate(J):
            T += Ji * w2 * th
            if i < len(k):
                th -= T / k[i]
        return T
    ...                       # scan for sign changes, refine by bisection

def cp_drive_train(P, size="J28", d_shaft=30.0, L_shaft=150.0, G=81000.0, J_crank=0.003):
    hub = JAW[size]["J_hub"]
    k_sh = G * math.pi * d_shaft ** 4 / (32 * L_shaft) / 1000          # N m/rad (G MPa, mm -> N mm/rad / 1000)
    J = [P["cp_J_motor"] + hub, P["cp_J_load"] - J_crank + hub, J_crank]
    k = [JAW[size]["C_dyn"] * SPIDER[P["cp_spider"]]["C"], k_sh]
    return {"J": J, "k": k, "f": cp_holzer(J, k), "f_2mass": coupling_check(P, size)["f_e"]}
```

The shaft stub stiffness is k = G·I_p/L = G·π·d⁴/(32·L).

```
## 6.8 Holzer: motor - coupling J28 - flywheel - crank stub (d 30, L 150) - crank
  J ['0.0098', '0.0723', '0.0030'] kg m2, k ['10300', '42942'] N m/rad
  natural frequencies ['173.4', '614.6'] Hz; two-mass value 173.5 Hz
  Holzer with 2 masses: 173.46 Hz (must equal the two-mass formula)
```

The first mode (173.4 Hz) is the coupling mode of the two-mass model – the crank stub is so much stiffer that it
hardly matters. The second mode (615 Hz, crank against flywheel) is far above all orders. With two masses Holzer gives
exactly the formula of 6.5 – a check of the method. For longer trains (motor – coupling – gearbox – coupling – pump),
use Holzer with all inertias reduced to one shaft speed (J·i², k·i²) or a modal FE model (M1 chapter on CAE).

### 6.9 Universal (Cardan) joints

When two shafts meet at an angle β (or have a large offset), a universal joint is used. A single joint is **not**
homokinetic: with input angle φ,

  ω2/ω1 = cos β / (1 − sin²β·cos²φ)

which swings between cos β and 1/cos β twice per revolution. Non-uniformity U = (ω_max − ω_min)/ω ≈ tan β·sin β.

```python
def cp_cardan(beta_deg, phi_deg):
    b, ph = math.radians(beta_deg), math.radians(phi_deg)
    return math.cos(b) / (1 - math.sin(b) ** 2 * math.cos(ph) ** 2)
```

Two joints with an intermediate shaft cancel the error if (1) both angles are equal and (2) the inner forks of the
intermediate shaft lie **in the same plane** (in phase) – the Z or the W arrangement. Joint 1 gives
tan φ2 = tan φ1 / cos β1; joint 2 with forks in phase works backwards, tan φ3 = tan φ2·cos β2, so

  tan φ3 = c·tan φ1,  ω3/ω1 = c / (cos²φ1 + c²·sin²φ1),  c = cos β2 / cos β1 (in phase) or 1/(cos β1·cos β2) (forks 90° off)

```python
def cp_cardan_double(beta1, beta2, phi_deg, in_phase=True):
    b1, b2, ph = math.radians(beta1), math.radians(beta2), math.radians(phi_deg)
    c = math.cos(b2) / math.cos(b1) if in_phase else 1 / (math.cos(b1) * math.cos(b2))
    return c / (math.cos(ph) ** 2 + c * c * math.sin(ph) ** 2)
```

(With c = 1/cos β the formula reduces to the single joint – a check of the algebra.)

```
## 6.9 Universal (Cardan) joint
  beta  5 deg: w2/w1 0.9962 ... 1.0038, U = tan b sin b 0.0076 (0.76 %)
  beta 10 deg: w2/w1 0.9848 ... 1.0154, U = tan b sin b 0.0306 (3.06 %)
  beta 20 deg: w2/w1 0.9397 ... 1.0642, U = tan b sin b 0.1245 (12.45 %)
  beta 30 deg: w2/w1 0.8660 ... 1.1547, U = tan b sin b 0.2887 (28.87 %)
  double joint 15/15 deg, forks in phase: output ratio 1.0000 ... 1.0000
  double joint 15/15 deg, forks 90 deg off: output ratio 0.9330 ... 1.0718
  double joint 15/10 deg, forks in phase: output ratio 0.9808 ... 1.0195
```

A wrongly assembled intermediate shaft (forks 90° off) **doubles** the error instead of cancelling it (±7 % at 15°) –
an assembly mistake that is easy to make when a splined shaft is pulled apart and put back one spline off. Mark the
forks before disassembly. Unequal angles (15° / 10°) leave ±2 %. The fluctuating speed also means fluctuating torque
(the intermediate shaft's inertia is accelerated twice per revolution) and bending moments on the joint bearings.

### 6.10 Torque limiters

A torque limiter (friction slip clutch, ball-detent, shear pin) protects the train when the machine blocks
(a liquid slug in the compressor, a jammed conveyor). Its setting must lie **above** the highest normal peak (motor
start) and **below** what the weakest part can carry:

```python
def cp_torque_limiter(P, margin_start=1.1, factor_max=0.8):
    b = coupling(P)["best"]
    lo = b["T_S"] / (P["cp_S_A"] * b["S_t"]) * margin_start          # start torque without safety factors x margin
    hi = factor_max * b["T_Kmax"]
    return {"T_slip_min": lo, "T_slip_max": hi, "T_set": 0.5 * (lo + hi)}
```

```
## 6.10 Torque limiter setting (direct drive)
  slip torque between 48.2 and 152.0 N m -> set 100.1 N m
```

The lower bound 48.2 N m is the start torque at the coupling (2.5 × 19.83 × 0.885) + 10 %; the upper 80 % of T_Kmax.
In a real design the upper bound is the weakest of: coupling peak, key / shrink fit of the hubs (M3), crank pin
strength (M2), motor shaft. Note: the **V-belt is its own torque limiter** – it slips at roughly 2–3 × the design
power – which is one hidden advantage of the belt drive. A synchronous belt, a chain or a coupling does not slip.

### 6.11 Connecting the hubs to the shafts

The coupling is only as strong as its hub–shaft connection:

- **Parallel key (DIN 6885 / ISO 773)**: hub bore H7 (or K7 for shocks), shaft k6 / m6; key checked for surface
  pressure (M3 chapter on shaft–hub connections). With alternating torque (compressor orders!) a key slowly fretts the
  keyway – use a tight fit (no clearance on the key flanks) or a clamping hub.
- **Clamping hub / shrink disc**: friction joint, no backlash, no fretting; required pressure p from the torque
  T = μ·p·π·d²·L/2 (M3 / M7 for the screws).
- **Set screw on the key**: only for axial location, never to transmit torque.
- **Axial distance** between the hubs: set to the catalogue gap E (± tolerance); the motor's thermal growth and end
  float must not close it, or the spider is crushed axially.

### 6.12 Coupling selection checklist

1. Type from the task: torsionally stiff (servo, pumps API), elastic (general, shocks), highly flexible (engines).
2. T_KN ≥ T_N·S_t; T_Kmax ≥ start / shock peak with M_A, S_A, S_z, S_t; bore and speed within limits.
3. Torque orders of the machine (DFT of the torque curve, M2) → f_e outside −20 %…+30 % of every order in operation;
   decide sub- or supercritical; check resonance passage for supercritical drives.
4. Vibratory torque with S_f and damping heat with the temperature factor.
5. Misalignment allowance ≥ measured alignment, aim ≤ 25 % of catalogue; restoring forces → bearing loads (M4).
6. Hub–shaft connection (key, clamp, shrink) for the peak torque; axial gap set.
7. Torque limiter setting between the start peak and the weakest part.


---

## 7. Manufacturing, installation and maintenance – and comparison of the drives

A drive that is correct on paper can still fail in the first week. The usual causes are a groove turned at the wrong
angle, an unbalanced pulley, a belt pried over the flange, a motor that is 3 mm out of line, or a belt tensioned "by
feel". This chapter follows the parts from raw material to the running machine:

1. how pulleys, sprockets, belts, chains and coupling hubs are **made**;
2. how they are **checked** – groove gauge, runout, balancing, bore and keyway;
3. how the drive is **installed** – alignment, tension, run-in;
4. how it is **maintained** – intervals, wear limits, failure modes;
5. what each drive **costs over its life**, and which one to choose.

All numbers come from `python drive.py ch78` (functions of add-on C). Data marked "check" are typical values in the
style of the standards and of maker catalogues.

### 7.1 Pulley materials and rim speed

A pulley rim is a rotating ring. Its hoop stress grows with the square of the rim speed:

  σ_θ ≈ ρ · v²   (thin ring; v = π · d_out · n / 60)

Grey cast iron EN-GJL-250 has a tensile strength of only about 250 MPa and is brittle. Catalogue makers therefore limit
GJL pulleys to a **rim speed of about 30 m/s** (check maker). At 30 m/s the pure ring stress is 7200 · 30² = 6.5 MPa, far
below the strength. The real reasons for the limit are casting defects, the stress raisers at the arms and web, the
groove notches, and the burst safety that is needed for a brittle material. Ductile iron (GJS) and steel allow
40–45 m/s.

```python
MFG_PULLEY_MAT = {   # material, density kg/m3, permissible rim speed m/s, typical use (check maker / foundry)
    "EN-GJL-250 (grey cast iron)":   {"rho": 7200.0, "v_max": 30.0, "use": "standard catalogue pulleys, damping, cheap in series"},
    "EN-GJS-400-15 (ductile iron)":  {"rho": 7100.0, "v_max": 40.0, "use": "higher speed, shock, larger diameters"},
    "S355 / C45 (steel, welded or turned)": {"rho": 7850.0, "v_max": 45.0, "use": "one-off, high speed, small diameters from bar"},
    "EN AW-6082 T6 (aluminium)":     {"rho": 2700.0, "v_max": 35.0, "use": "light, low inertia (synchronous pulleys, servo axes)"},
}

def mfg_rim_speed(d_out_mm, n, material):
    v = math.pi * d_out_mm * n / 60000
    vm = MFG_PULLEY_MAT[material]["v_max"]
    return {"v": v, "v_max": vm, "ok": v <= vm}
```

`python drive.py ch78` (first block):
```
## 7.1 Pulley materials and rim speed (default drive, d2 runs at 1450 rpm)
  EN-GJL-250 (grey cast iron)            rho  7200 kg/m3, v_max   30 m/s - standard catalogue pulleys, damping, cheap in series
  EN-GJS-400-15 (ductile iron)           rho  7100 kg/m3, v_max   40 m/s - higher speed, shock, larger diameters
  S355 / C45 (steel, welded or turned)   rho  7850 kg/m3, v_max   45 m/s - one-off, high speed, small diameters from bar
  EN AW-6082 T6 (aluminium)              rho  2700 kg/m3, v_max   35 m/s - light, low inertia (synchronous pulleys, servo axes)
  motor pulley d1 150: groove 38 deg, d_out 154.0 mm, face width B 16.0 mm, depth 11.00 mm; rim speed 23.6 m/s vs 30 (GJL-250) -> OK
  crank pulley d2 300: groove 38 deg, d_out 304.0 mm, face width B 16.0 mm, depth 11.00 mm; rim speed 23.1 m/s vs 30 (GJL-250) -> OK
  rim speed limit check, larger pulleys at 2930 rpm (GJL-250):
    d 150: v 23.6 m/s -> OK
    d 180: v 28.2 m/s -> OK
    d 200: v 31.3 m/s -> use GJS / steel
    d 224: v 35.0 m/s -> use GJS / steel
```

**Reading:** both pulleys of the compressor drive run at about 23 m/s, so standard grey-iron catalogue pulleys are fine.
A 2-pole motor (2930 rpm) cannot carry a grey-iron pulley larger than about 190 mm. If a bigger motor pulley is wanted,
for example to reduce the number of belts, it must be made of GJS or steel. Mind the flywheel effect too: the crank
pulley of M2 is also the flywheel (J_fly 0.059 kg m²). A flywheel rim must then be checked for burst (σ_θ = ρ v² with
safety ≥ 4 for cast iron). At 23 m/s this is uncritical.

### 7.2 Grooves to ISO 4183 – turning and gauging

**Groove geometry.** The narrow V-belt sits on its *datum width* b_d (SPZ 8.5 mm). The datum diameter d_d is measured
at this width – it is **not** the outside diameter. Above the datum line the groove has the height b, below it the
depth h. The groove angle is 34° on small pulleys and 38° on large ones. A belt bent round a small pulley gets wider at
the bottom (the compression rubber bulges sideways) and its flank angle drops, so the small groove must be narrower.

```python
MFG_GROOVE = {
    "SPZ": {"b": 2.0, "h": 9.0, "e": 12.0, "e_tol": 0.3, "f": 8.0, "d34": 80.0},
    "SPA": {"b": 2.75, "h": 11.0, "e": 15.0, "e_tol": 0.3, "f": 10.0, "d34": 118.0},
    "SPB": {"b": 3.5, "h": 14.0, "e": 19.0, "e_tol": 0.4, "f": 12.5, "d34": 190.0},
    "SPC": {"b": 4.8, "h": 19.0, "e": 25.5, "e_tol": 0.5, "f": 17.0, "d34": 315.0},
}

def mfg_groove(sec, d, z):
    """Groove angle, outside diameter, pulley face width B = (z - 1) e + 2 f, groove depth."""
    g = MFG_GROOVE[sec]
    alpha = 34.0 if d <= g["d34"] else 38.0
    return {"alpha": alpha, "d_out": d + 2 * g["b"], "B": (z - 1) * g["e"] + 2 * g["f"], "depth": g["b"] + g["h"], ...}
```

Face width: B = (z − 1)·e + 2·f. For a one-groove SPZ pulley B = 16 mm. Groove pitch e has a tolerance (±0.3 mm for
SPZ), and the *sum* of the pitch errors over all grooves is also limited (check ISO 4183). Otherwise the belts of a
multi-belt set run on different diameters and share the load unequally.

**How the groove is made.**
- *Turning with a form tool* (the profile is ground into the insert) – one groove after the other, or a gang tool for all grooves at once. Simple, but the tool wears to a rounded tip and the angle drifts. Check the first and the last part of each batch.
- *Turning with CNC contouring* (a 35° or 55° insert follows the flank). Every angle and diameter is programmable, which is ideal for one-off and special pulleys. The surface is finer at the cost of longer cycle time.
- **Surface:** groove flanks Ra ≤ 3.2 µm (check maker). Rougher flanks wear the belt, while polished flanks reduce friction and the belt slips. Edges must be rounded or chamfered, because sharp edges cut the belt during fitting.
- **Runout:** radial and axial runout of the groove ≤ about 0.1 mm per 100 mm diameter (check). A pulley that wobbles makes the belt "pump" and wears its flanks unevenly.

**Groove gauge over balls.** In the workshop you cannot measure b_d directly. Two gauge balls (or rolls) of diameter D_b
are laid in the groove at opposite sides, and the dimension K over the balls is measured with a micrometer or caliper.
Geometry, with half angle φ = α/2: a ball of radius r that touches both flanks has its centre r/sin φ above the
(virtual) groove apex. The apex lies (b_d/2)/tan φ below the datum line. So:

  y = r / sin φ − (b_d / 2) / tan φ  (centre above the datum line),  K = d_d + 2y + 2r

```python
def mfg_groove_gauge(sec, d, Db):
    bd = VBELT[sec]["bd"]
    phi = math.radians(mfg_groove(sec, d, 1)["alpha"] / 2)
    r = Db / 2
    y = r / math.sin(phi) - bd / 2 / math.tan(phi)
    return {"Db": Db, "y": y, "K": d + 2 * y + 2 * r}

def mfg_datum_ball(sec, d):
    """Ball that touches the flanks exactly at the datum width: r cos(phi) = b_d / 2 -> D_b = b_d / cos(phi). ..."""
    phi = math.radians(mfg_groove(sec, d, 1)["alpha"] / 2)
    return VBELT[sec]["bd"] / math.cos(phi)
```

```
## 7.2 ISO 4183 groove data and ball gauge
  SPZ: b 2.00, h 9.0, e 12.0 +-0.3, f 8.0 mm, 34 deg up to d 80, 38 deg above
  SPA: b 2.75, h 11.0, e 15.0 +-0.3, f 10.0 mm, 34 deg up to d 118, 38 deg above
  SPB: b 3.50, h 14.0, e 19.0 +-0.4, f 12.5 mm, 34 deg up to d 190, 38 deg above
  SPC: b 4.80, h 19.0, e 25.5 +-0.5, f 17.0 mm, 34 deg up to d 315, 38 deg above
  ball touching at the datum width: D_b = b_d / cos(alpha/2) = 8.990 mm, centre 1.463 mm above datum -> K 161.917 mm; +0.5 deg changes K by 0.0003 mm
  SPZ d 150, ball 8.0 mm: centre -0.057 mm above datum line -> K over balls 157.887 mm; +0.5 deg groove angle changes K by 0.038 mm
  SPZ d 150, ball 9.0 mm: centre 1.479 mm above datum line -> K over balls 161.958 mm; +0.5 deg groove angle changes K by -0.000 mm
  SPZ d 150, ball 10.0 mm: centre 3.015 mm above datum line -> K over balls 166.030 mm; +0.5 deg groove angle changes K by -0.039 mm
```

**The two-ball method.** A ball of D_b = b_d / cos φ (8.99 mm for SPZ, 38°) touches the flanks exactly at the datum
width. K then barely changes with the angle (0.0003 mm per 0.5°), so this ball measures the **datum diameter** alone. A
smaller ball (8 mm) touches deeper and a larger one (10 mm) higher. Their K values change by ±0.04 mm per 0.5° of angle
error, so the **difference** of the 8 mm and 10 mm readings measures the **angle**. In series production, a go / no-go
groove template or a ring gauge with fixed balls is used instead. The inspection plan (7.8) asks for the first article
plus one part per batch.

### 7.3 Balancing to ISO 21940-11

A pulley is balanced so that the unbalance force at speed stays small compared with the bearing loads. ISO 21940-11
defines the **balance quality grade G** = e·ω in mm/s (e = permissible mass eccentricity). From this:

  U_per = 9549 · G · m / n   [g mm]   (m in kg, n in rpm),   e_per = U_per / m,   F = U · ω²

Pulleys for belt drives are usually balanced to **G16** (catalogue standard). Above about 30 m/s rim speed, or on
compressors and machine tools, **G6.3** is used. Narrow pulleys (B/d < about 0.25) need only single-plane, *static*
balancing. Wide pulleys need two planes.

```python
def mfg_pulley_mass(d_out, B, d_hub=None, rho=7200.0, fill=0.55):
    """Rough mass of an arm / web pulley: full cylinder x fill factor (0.45...0.65 for web and arm pulleys, check)."""
    return rho * math.pi / 4 * (d_out / 1000) ** 2 * (B / 1000) * fill

def mfg_unbalance(m_kg, n, G=6.3, r_mm=None):
    U = 9549 * G * m_kg / n
    w = 2 * math.pi * n / 60
    return {"U_gmm": U, "e_um": U / m_kg, "F_N": U * 1e-6 * w * w, "mass_g_at_r": U / r_mm if r_mm else None}
```

```
## 7.3 Balancing ISO 21940-11
  d1 150 mm: mass ~1.18 kg, G6.3  U_per 24.2 g mm (e 20.5 um), correction mass at r 67: 0.36 g, force at speed 2.3 N; single plane (static)
  d1 150 mm: mass ~1.18 kg, G16.0 U_per 61.5 g mm (e 52.1 um), correction mass at r 67: 0.92 g, force at speed 5.8 N; single plane (static)
  d2 300 mm: mass ~4.60 kg, G6.3  U_per 190.8 g mm (e 41.5 um), correction mass at r 142: 1.34 g, force at speed 4.4 N; single plane (static)
  d2 300 mm: mass ~4.60 kg, G16.0 U_per 484.5 g mm (e 105.3 um), correction mass at r 142: 3.41 g, force at speed 11.2 N; single plane (static)
```

**Reading:** even at G16 the unbalance force of the crank pulley is 11 N. That is small next to the belt shaft load of
272 N and the crank-pin forces of M2 (2.7 kN). G16 is technically sufficient for the pulley alone. On the compressor,
however, the crank pulley is also the flywheel and is balanced *together with the crankshaft* (M2, chapter on
balancing, ISO 21940 G6.3). Order it "balanced G6.3 with crankshaft" on the drawing. The correction is about 1.3 g at a
142 mm radius: in practice a 6 mm drill hole about 6 mm deep in the web of a cast pulley.

> Mass is estimated with a fill factor (web / arm pulley ≈ 0.55 of a full disc, check). For a real pulley take the CAD
> mass.

### 7.4 Synchronous pulleys, sprockets, coupling hubs

**Synchronous pulleys.** The tooth profile (HTD, GT, AT, T) must match the belt within a few hundredths of a
millimetre:
- Bar stock (aluminium EN AW-6082 or steel) is turned, and the profile is **generated by hobbing** with a hob made for that profile and tooth number range.
- Small pulleys and pulleys with an integral flange are **shaped**, because the hob cannot run out next to the flange.
- Flanges (on at least one pulley, usually the small one) are pressed or rolled on, to keep the belt from walking off.
- Surface: anodised aluminium or black-oxided steel.
- High-volume pulleys (automotive) are sintered or injection moulded.

**Sprockets.**
- The tooth form follows ISO 606 (seating curve radius, roller seating angle, tooth flank radius).
- Hobbing is the standard process. Plate sprockets are cut by laser or flame and then hobbed or ground.
- Because the small sprocket meets every roller with an impact (polygon effect, chapter 5), its teeth are **induction hardened to about 45–55 HRC** at the flanks (check maker), especially for z1 < 25 or chain speeds above about 3 m/s. A soft sprocket wears to a "hooked" tooth that throws the chain.
- Large wheels can stay soft (normalised C45) because each tooth engages less often (z1/z2 times).

**Coupling hubs (jaw coupling).**
- Supplied pre-bored. The final bore H7 and the keyway are cut to order.
- Keyway DIN 6885-1: hub groove width P9 (tight, for alternating torque) or JS9 (normal), depth t2.
- A set screw over the key fixes the hub axially.
- The elastomer spider is injection moulded TPU/PU: 92 Sh A (softer, more damping, lower torque) or 98 Sh A (1.7 × torque, 2.4 × stiffer – see `SPIDER`).

Key pressure on the hub side (form A key, rounded ends, l_eff = l − b):

  p = 2 · T / (d · (h − t1) · l_eff) ≤ p_zul

```python
MFG_KEY = [   # d from, d to, b x h, t1 shaft, t2 hub (DIN 6885-1 style, check)
    (17, 22, 6, 6, 3.5, 2.8), (22, 30, 8, 7, 4.0, 3.3), (30, 38, 10, 8, 5.0, 3.3), ...]
MFG_P_ALLOW = {"steel hub": 90.0, "cast iron hub (GJL)": 50.0, "sintered / aluminium hub": 35.0}   # MPa static, check

def mfg_key(d, T_Nm, l_key, hub="steel hub", phi_peak=1.0):
    row = next(r for r in MFG_KEY if r[0] < d <= r[1])
    _, _, b, h, t1, t2 = row
    leff = l_key - b
    p = 2 * T_Nm * 1000 * phi_peak / (d * (h - t1) * leff)
    ...
```

The demo uses the **start torque at the coupling** of chapter 6 (T_S = 94.7 N m for J28, i.e. φ_peak = T_S / T_N):
```
## 7.4 Coupling hub: bore, keyway DIN 6885, key pressure (direct drive, J28, motor shaft 28 mm)
  d 28 H7, key 8x7, t1 4.0 / t2 3.3, l 40 (l_eff 32): p at start torque 70 MPa vs steel hub 90 MPa -> OK
  d 28 H7, key 8x7, t1 4.0 / t2 3.3, l 40 (l_eff 32): p at start torque 70 MPa vs cast iron hub (GJL) 50 MPa -> NOT OK
  d 30 H7, key 8x7, t1 4.0 / t2 3.3, l 40 (l_eff 32): p at start torque 66 MPa vs steel hub 90 MPa -> OK
```

**Reading:** the 28 mm motor shaft with an 8 × 7 key carries the start shock only in a **steel** hub (70 MPa ≤ 90 MPa).
A grey-iron hub, as found on some cheap jaw couplings, would be overloaded at every start. Order the J28 hubs in steel
(or sintered steel with a check), with fit H7/k6 on the motor and H7/m6 on the crank. A loose fit causes fretting
corrosion (red rust in the bore) within months, even when the key pressure is OK. The key only carries torque well when
the hub sits tight.

### 7.5 How belts and chains are made

Knowing the process explains the rules of use.

**Narrow V-belt (raw edge, cogged – the modern type):**
1. A sleeve is built on a drum. First the cover / cushion rubber, then the **tension cord** (polyester, sometimes aramid), wound helically under constant tension. The cord carries the load. Its position sets the datum line, which is why b_d is defined there.
2. Compression rubber (CR or EPDM with short fibres across the belt, giving high transverse stiffness so the belt does not collapse in the groove).
3. Vulcanising of the sleeve in an autoclave or press. The rubber cross-links, and its properties depend on time and temperature.
4. Cutting the sleeve into single belts at the flank angle. This is the *raw edge*, without a fabric wrap, so it has higher friction.
5. Grinding the cogs on the bottom. Cogs make the belt more flexible, which allows smaller pulleys and cuts bending loss.
6. **Length measurement on a measuring machine** at a defined force. The belts are sorted into length classes, the **matched sets**.

Consequences:
- Belts of a multi-belt drive must come from one set. Never mix new and old belts: the old ones have stretched and the new ones would carry everything.
- Never pry a belt over the flange, because the cord breaks inside without being visible. Move the motor in instead (take-up, 7.6).
- Store belts cool and dark. Rubber ages, which is the reason for the ageing limit `L_h_age` = 40 000 h in `VB_MODEL`.

**Synchronous belt:** the cord (glass fibre for low stretch, aramid or carbon for high load) is wound helically on a
toothed mould. Rubber (CR, HNBR) is pressed into the mould, or polyurethane is poured. The teeth get a nylon facing
against wear, and the sleeve is vulcanised or cured, then cut to width. Glass cords are **sensitive to kinking**: a
bent synchronous belt (crimped during storage or fitting) loses strength. This explains the minimum pulley tooth numbers
`z_min` in `SYNC`.

**Roller chain:**
1. Inner and outer plates are **fine blanked** (smooth, square sheared holes), then hardened and tempered.
2. Bushes are rolled from strip or made seamless, then carburised. Rollers are cold formed and case hardened. Pins are cold drawn, hardened and ground.
3. Bushes are press fitted into inner plates, pins into outer plates. The joint (pin turning in bush) is where wear happens.
4. **Pre-stretching**: the finished chain is loaded to about ⅓ F_B (check), which settles the press fits and removes the initial elongation.
5. Lubricated, cut to length, connecting link riveted or fitted.

Consequence: chain wear is *joint wear* (pin and bush). Lubrication, not strength, decides the life at speed. Hence the
roller-bushing / galling limits of chapter 5 and the lubrication regime in `lubrication()`.

`python drive.py ch78`, block 7.7, prints the process chains of all parts:
```
## 7.7 Process chains (how the parts are made)
  cast pulley: pattern + sand mould (GJL-250) -> cast, knock out, fettle -> turn bore / taper-bush seat and hub faces -> turn outside and grooves with form tool (one groove after the other or gang tool) -> check grooves with balls / template -> balance (G6.3 or G16, drill material out of the rim / web) -> phosphate or paint, protect grooves
  synchronous pulley: bar stock (aluminium / steel) or cast blank -> turn blank, bore -> generate profile by hobbing (or shaping for flanged / small) -> deburr, flanges pressed or rolled on -> anodise / black oxide
  sprocket: plate cut (laser / flame) or turned blank -> turn hub and bore -> hob teeth (ISO 606 profile) -> induction harden tooth flanks (45-55 HRC) -> broach / slot keyway -> inspect profile and hardness
  V-belt (raw edge, cogged): build on drum: cover/cushion rubber, tension cord (polyester) wound under constant tension -> compression rubber (EPDM / CR with fibres) -> vulcanise sleeve in autoclave / press -> cut sleeve into single belts with the flank angle (raw edge) -> grind cogs / flanks -> measure length, sort into matched sets
  synchronous belt: cord (glass / aramid / carbon) wound helically on a toothed mould -> rubber (CR / HNBR) or PU poured / pressed into the mould -> nylon facing on the teeth -> vulcanise (rubber) or cure (PU) -> cut sleeve to widths -> check pitch length
  roller chain: fine-blank inner / outer plates, then harden + temper -> form bushes (rolled or seamless), carburise -> rollers: cold formed / drawn, case hardened -> pins: cold drawn, through/ case hardened, ground -> press-fit bushes into inner plates, pins into outer plates -> pre-stretch (pre-load ~ 1/3 F_B) to remove initial elongation -> lubricate, cut to length, rivet
  jaw coupling hub: sawn bar or casting (steel / GJL / aluminium) -> turn, cut jaws (milling) -> bore H7 after customer order, broach keyway P9 / JS9 -> tap set-screw hole over the keyway -> spider: injection moulded PU / TPU, 92 / 98 Sh A
```

**Taper bushes.** Most catalogue pulleys and sprockets are bored for a *taper bush* (a split, conical sleeve clamped by
two or three screws). Its advantages:
- one pulley fits many shaft diameters;
- the clamping gives a press fit without heating;
- the pulley can be removed without a puller.

Tighten the screws alternately to the catalogue torque, and recheck after the run-in. A taper bush also carries torque
by friction, so the keyway in the shaft is often only a back-up (check maker).

### 7.6 Installation: alignment, tension, run-in

**Belt alignment.** Pulleys must lie in one plane. Check with a straightedge or a laser line across both pulley faces.
The angle between the belt and the groove is

  δ = arctan(offset / span),  allowed about 0.5° for V-belts, 0.25° for synchronous belts, 0.3° for chains (check maker)

```python
MFG_BELT_ALIGN = {"V-belt": 0.5, "synchronous belt": 0.25, "roller chain": 0.3}   # max angle deg (check maker)

def mfg_belt_alignment(offset_mm, span_mm, kind):
    ang = math.degrees(math.atan(offset_mm / span_mm))
    return {"angle_deg": ang, "allow_deg": MFG_BELT_ALIGN[kind], "ok": ang <= MFG_BELT_ALIGN[kind],
            "max_offset_mm": span_mm * math.tan(math.radians(MFG_BELT_ALIGN[kind]))}
```

**Coupling alignment.** For a direct drive the motor and crank shafts must be coaxial. It is measured with a laser
alignment system (or two dial gauges, rim-and-face method) as **offset** (mm) and **angularity** (mm per 100 mm). The
tolerance gets tighter with speed. The permissible misalignment of the coupling (e.g. ΔKr = 0.25 mm for J28) is **not**
the target: it is a damage limit, and running at it shortens spider and bearing life. Align to the laser table and use
the coupling capacity only for thermal growth and settling.

```python
MFG_SHAFT_ALIGN = [(1000, 0.10, 0.08), (2000, 0.07, 0.05), (3000, 0.05, 0.04), (6000, 0.03, 0.03)]   # rpm, offset, angle (check)
```

**Tension and run-in.** A new V-belt stretches during the first hours and seats itself in the groove. The maker
therefore asks for about **1.3 × the static tension** at installation and a re-tension to T0 after 0.5–4 h of running
(check maker). The tension is checked by the **span frequency** (f = 1/(2L_s)·√(T/m'), chapter 3) with an acoustic or
optical meter, or by the **deflection force** at mid-span (16 mm per 1000 mm span). The motor slide (take-up) must
allow about +3 % L_d to tension and take up stretch, and −1.5 % L_d to fit the belt without prying (DIN 7753 style,
check).

```python
MFG_RUNIN = 1.3      # new V-belt: install with 1.3 x T0, re-tension after the run-in (0.5 ... 4 h), check maker

def mfg_tension_plan(P):
    V = vbelt(P)
    S = VBELT[V["section"]]
    Ls = V["span"] / 1000
    f = lambda T: 1 / (2 * Ls) * math.sqrt(T / S["m"])
    Tn = MFG_RUNIN * V["T0"]
    return {"T0": V["T0"], "T_new": Tn, "f_new": f(Tn), "f_run": f(V["T0"]), "f_min": f(0.8 * V["T0"]),
            "F_test_new": 4 * Tn * 0.016, "F_test_run": 4 * V["T0"] * 0.016, "deflection": 16.0 * Ls}

def mfg_take_up(Ld):
    return {"x_tension": 0.03 * Ld, "y_fit": 0.015 * Ld}
```

```
## 7.5 Installation: alignment and tensioning
  V-belt            offset 2.0 mm over span 434 mm: 0.26 deg vs 0.50 -> OK (max offset 3.8 mm)
  V-belt            offset 5.0 mm over span 434 mm: 0.66 deg vs 0.50 -> NOT OK (max offset 3.8 mm)
  synchronous belt  offset 2.0 mm over span 434 mm: 0.26 deg vs 0.25 -> NOT OK (max offset 1.9 mm)
  coupling at 1445 rpm: offset 0.05 mm, angle 0.03 mm/100 -> laser tol 0.07 / 0.05 -> OK; 20 % of the coupling's dKr 0.25 mm
  coupling at 1445 rpm: offset 0.12 mm, angle 0.05 mm/100 -> laser tol 0.07 / 0.05 -> re-align; 48 % of the coupling's dKr 0.25 mm
  tension: new belt 230 N (f 64 Hz, test force 14.7 N at 6.9 mm), after run-in 177 N (f 56 Hz, 11.3 N); re-tension below 50 Hz
  motor slide travel: + 48 mm to tension / take up stretch, - 24 mm to fit the belt without prying
```

**Reading – the installation instruction for the compressor drive:**
1. Align the pulleys to within 3.8 mm offset over the 434 mm span (a synchronous belt would allow only 1.9 mm).
2. Fit the SPZ 1600 belt with the motor moved in by 24 mm. Do not pry it on.
3. Tension it to a span frequency of **64 Hz** (new belt).
4. Run it for 0.5–4 h, then re-tension to **56 Hz**.
5. At each service: re-tension when the frequency drops below **50 Hz** (0.8 × T0).
6. Provide 48 mm of motor slide travel.

For the direct drive, the second case (offset 0.12 mm) would still be inside the coupling's capacity (48 %), but it is
out of the laser tolerance and must be re-aligned.

These numbers go into `drive_data.csv` (see `run()`) and onto the assembly drawing.

### 7.7 Maintenance: intervals and chain wear limit

A chain is replaced when its **wear elongation** reaches the limit. A longer chain rides higher on the teeth, and on a
large sprocket it climbs over the teeth sooner. Hence the limit is the smaller of 3 % and 200/z2 % (DIN 8195 style,
check). The elongation is measured over a number of links under light tension.

```python
def mfg_chain_wear_limit(z2, p, n_links=20):
    lim = min(3.0, 200.0 / z2)
    L0 = n_links * p
    return {"limit_pct": lim, "L_new": L0, "L_replace": L0 * (1 + lim / 100), "n_links": n_links}
```

```
## 7.6 Maintenance: chain wear limit and intervals
  z2  38: limit 3.00 % -> 20 links new 254.0 mm, replace at 261.6 mm
  z2  58: limit 3.00 % -> 20 links new 254.0 mm, replace at 261.6 mm
  z2  80: limit 2.50 % -> 20 links new 254.0 mm, replace at 260.3 mm
  z2 100: limit 2.00 % -> 20 links new 254.0 mm, replace at 259.1 mm
  V-belt (new)       after 0.5-4 h run-in       re-tension to T0, check span frequency
  V-belt             every 3 months / 1000 h    tension, cracks, glazing, pulley groove wear (gauge)
  synchronous belt   every 6 months / 2000 h    tension, tooth wear, flange contact, alignment
  roller chain       every 500 h / weekly drip  lubrication, elongation over 20 links, sprocket hook wear
  elastic coupling   every 4000 h / yearly      spider wear (torsional backlash), alignment, hub screws
  all drives         after any motor move       alignment check with laser or straightedge
```

Always replace a worn chain **together with the small sprocket**. A new chain on a hooked sprocket wears out in a
fraction of its life. Likewise, replace V-belts as a complete matched set, and check the grooves with the gauge (a
worn groove lets the belt bottom out and slip).

### 7.8 Inspection plan

```
## 7.8 Inspection plan
  groove angle / datum diameter          ball gauge K, groove template                        first article + 1 per batch
  pulley runout radial / axial           dial gauge, <= 0.1 mm / 0.1 mm per 100 mm (check)    each pulley
  residual unbalance                     balancing machine, ISO 21940-11 G6.3                 each pulley > 1500 rpm / v > 30 m/s
  bore and keyway                        plug gauge H7, key gauge P9 / JS9                    each hub
  tooth profile (sprocket, synch. pulley) profile template / CMM                               first article
  tooth hardness (sprocket)              HRC / HV                                             1 per batch
  belt length / matched set              measuring machine at defined force                   each set (supplier)
  installation tension                   span frequency meter / deflection force              installation + after run-in
  alignment                              laser / straightedge                                 installation, after maintenance
```

### 7.9 Failure modes – what you see, why, what to do

```
## 7.9 Failure modes
  V-belt           glazing                    shiny hard flanks, squeal              | slip from low tension or overload | re-tension, check rating, replace
  V-belt           base cracking              transverse cracks on the bottom        | too small pulley, heat, age, back-side idler | bigger d1, ventilation, inside idler
  V-belt           cord break                 belt torn, cord ends frayed            | shock, foreign body, prying the belt on | shorten centre to fit, guard, shock factor
  V-belt           side wear                  flanks worn, belt sits deep            | misalignment, worn grooves, wrong section | align, gauge grooves, replace pulley
  V-belt           unequal length in set      one belt slack, others overloaded      | mixed old/new or unmatched belts | always replace the full matched set
  synchronous belt tooth shear                teeth missing on a length              | overload, too few teeth in mesh, low tension (jump) | wider belt, more z1, tension
  synchronous belt edge wear                  frayed edge                            | misalignment, flange rubbing | align, check flange
  roller chain     wear elongation            chain rides high on teeth, skips       | poor lubrication, dirt, age | lubricate, replace at limit with sprockets
  roller chain     plate / roller fatigue crack cracks at holes, broken rollers        | overload, impact at high speed (small z1) | bigger chain or z1, check rating
  roller chain     galling of pin / bush      blue / seized joints                   | speed above lubrication limit | pressure lubrication or slower drive
  elastic coupling spider wear                torsional backlash, knock at start     | overload, misalignment, heat, oil | replace spider, align, harder spider
  elastic coupling hub slip / fretting        red rust on bore, key worn             | loose fit, key overload | H7/k6 fit, check key pressure, clamping hub
  elastic coupling elastomer fatigue / burn   cracked or melted cams                 | resonance, vibratory torque too high | change stiffness (f_e), check orders
```

Each failure links back to a calculation in this guide:
- glazing → tension T0 (ch. 3);
- base cracking → bending stress σ_b = E_b·h/d and the minimum pulley d_min (ch. 2–3);
- tooth shear → teeth in mesh z_e (ch. 4);
- galling → the roller-bushing limit and lubrication (ch. 5);
- elastomer burn → the resonance check V(η) (ch. 6).

A failure analysis therefore always starts with recalculating the drive using the *real* operating data.

### 7.10 Life-cycle cost and decision for the compressor

The purchase price is the smallest part of the cost of a drive. Over 10 years the **energy** dominates. A drive that
is 3 % more efficient saves more than its whole purchase price.

  LCC = purchase + years · (energy + maintenance) + number of replacements · replacement cost

The energy per year comes from `compare()` (chapter 7 of the core: P_el = P_load / (η_drive · η_motor)). The purchase,
maintenance and replacement costs are typical values for a 3 kW drive. Check them against real quotes.

```python
MFG_COST = {   # purchase EUR, maintenance EUR/year, replacement interval h, replacement EUR (typical 3 kW drive, check quotes)
    "V-belt":            {"buy": 95.0, "maint": 40.0, "repl_h": None, "repl": 12.0},
    "synchronous belt":  {"buy": 140.0, "maint": 20.0, "repl_h": 25000.0, "repl": 45.0},
    "roller chain":      {"buy": 180.0, "maint": 120.0, "repl_h": 15000.0, "repl": 90.0},   # incl. pressure lubrication share
    "direct + coupling": {"buy": 160.0, "maint": 15.0, "repl_h": 24000.0, "repl": 20.0},    # coupling + 4-pole motor premium
}

def mfg_lcc(P, years=10):
    V = vbelt(P)
    rows = []
    for c in compare(P):
        k = MFG_COST[c["drive"]]
        rh = V["L_h"] if c["drive"] == "V-belt" else k["repl_h"]
        hours = P["hours_year"] * years
        n_repl = int(hours // rh) if rh else 0
        total = k["buy"] + years * (c["eur_year"] + k["maint"]) + n_repl * k["repl"]
        ...
```

The V-belt replacement interval is the **expected life from chapter 3** (`L_h`, here the ageing limit 40 000 h). A
weighted decision matrix adds the criteria that money does not show directly (noise, ratio accuracy, maintenance
effort). A drive that fails a check gets the score 1 for capacity.

```
## 7.10 Life-cycle cost over 10 years (default task, costs typical - check quotes)
  V-belt             OK     buy   95 + energy  15280 + maint.   400 + 1 repl.   12 =  15787 EUR (+1021)
  synchronous belt   OK     buy  140 + energy  14731 + maint.   200 + 1 repl.   45 =  15116 EUR (+351)
  roller chain       NOT OK buy  180 + energy  15116 + maint.  1200 + 2 repl.  180 =  16676 EUR (+1910)
  direct + coupling  OK     buy  160 + energy  14435 + maint.   150 + 1 repl.   20 =  14765 EUR (+0)
  decision matrix (weights capacity / checks pass 0.25, energy + LCC 0.25, shaft and bearing load 0.15, maintenance effort 0.15, noise 0.10, ratio accuracy 0.10):
  direct + coupling  scores [5, 5, 5, 5, 4, 4] -> 4.80
  synchronous belt   scores [5, 4, 3, 4, 3, 5] -> 4.10
  V-belt             scores [5, 3, 4, 3, 5, 3] -> 3.85
  roller chain       scores [1, 3, 4, 1, 2, 5] -> 2.45
```

**Decision for the M2 compressor:**
1. **Direct drive (4-pole motor 1445 rpm + J28 steel-hub jaw coupling)** has the lowest 10-year cost: about 1020 €
   less than the V-belt, almost all of it energy (−845 €) plus less maintenance. It also removes the belt shaft load
   from the crankshaft bearing (M3/M4) and the belt guard. It needs a good laser alignment (7.6), a steel hub (7.4), and
   a check that a 4-pole motor (frame 100L, 28 mm shaft) fits the frame.
   - The compressor runs at 1445 rpm instead of 1450 rpm: −0.3 % flow, negligible.
   - The flywheel must provide almost the whole inertia, because the motor rotor is no longer multiplied by i² = 4. M2
     gives J_need 0.0815 kg m², so the flywheel grows from 0.059 to about 0.072 kg m² (`cp_J_load` 0.075 incl. crank).
2. The **synchronous belt** is second: 350 € more over 10 years, exact ratio, low maintenance. Consider it if the motor
   must stay a 2-pole type.
3. The **V-belt** is the cheapest to buy and the most forgiving of shock and misalignment. It is the right choice for a
   prototype or a retrofit, where the ratio may still change, but it costs about 100 € per year more in energy.
4. The **roller chain** is not suitable at 2930 rpm (rating and pressure lubrication).

> The efficiencies in `compare()` (V-belt 0.95, synchronous 0.98, chain 0.97, coupling 0.995) and the IE3 motor
> efficiencies (2-pole 87.1 %, 4-pole 87.7 %) are typical values – check the motor data sheet and the belt maker. The
> ranking above is sensitive to the V-belt efficiency: at η = 0.97 (well-tensioned cogged belt) the V-belt energy falls by
> about 315 € in 10 years and the gap to the direct drive shrinks from about 1020 € to about 700 €.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification – what the self-test proves and why it matters

`python drive.py selftest` checks the program against independent results:

| # | Check | Why it is independent / what it catches |
|---|---|---|
| 1 | Approximate belt length = exact geometry (within 0.05 %) | The exact formula 2a·cos γ + π(d1+d2)/2 + γ(d2−d1) is derived from the tangent lines. It catches a wrong term in the textbook approximation |
| 2 | Centre distance from length is the inverse of the length formula | Catches sign / root errors in the quadratic solution used for the standard length |
| 3 | c1(180°) = 1, c1(120°) = 0.82 | The physics (Euler–Eytelwein with μ' = 0.512) reproduces the **DIN table** value – evidence that the rating model is calibrated like the standard |
| 4 | (F1 − Fc)/(F2 − Fc) = e^(μ'β), F1 − F2 = F_e | The span forces satisfy the capstan equation and the torque balance |
| 5 | Span frequency → tension gives T0 back | The value written into the installation instruction (Hz) belongs to the computed T0 |
| 6 | Life at the permissible stress = reference life | The Wöhler line and the rating model use the same reference point |
| 7 | Chain centre distance from links is the inverse | Same as 2, for chains (even number of links) |
| 8 | Polygon effect → 0 for many teeth, 1.36 % for z = 19 | Limit case and an exact number |
| 9 | Synchronous pitch length = teeth × pitch, d = z·p/π | Geometry of the toothed belt |
| 10 | Coupling: RK4 two-mass simulation = T·M_L·V(η) within 2 % | A time-domain simulation, independent of the closed-form magnification function, confirms the resonance check |
| 11 | Default V-belt drive and one coupling pass | Regression: the default task stays valid after code changes |

`python drive.py ch78` adds manufacturing results. Checks that are consistent by construction:
- the datum ball (8.990 mm) gives a K change of only 0.0003 mm per 0.5°, which confirms the derivation of D_b = b_d / cos φ;
- the run-in frequencies scale exactly with √1.3 (64/56 Hz).

**What the program does *not* prove** (check with the maker):
- the absolute rating values (σ_ref, f_t, ACA constants, coupling torques), which are typical values;
- the efficiency and cost data;
- the ageing limit of the belt.

Before release, recalculate the chosen drive with the maker's software or catalogue, and compare it with
`python drive.py run`. A deviation of more than about 15 % in the number of belts or the belt width needs an
explanation.

### 8.2 Complete worked example – belt conveyor head drive

**Task.** A belt conveyor in the factory logistics area is driven at its head pulley shaft:
- motor 7.5 kW, 4-pole, 1460 rpm → head shaft about **480 rpm** (i ≈ 3.04);
- actual power about 6.0 kW, conveyor duty (medium), 16 h per day;
- centre distance about 600 mm (motor on a slide rail beside the gear-less head shaft).

Which drive? The input file `tools/examples/drive_example.json` (only the keys that differ from `DEFAULT`):

```json
{
  "name": "Belt conveyor head drive 7.5 kW 1460 -> 480 rpm (example, chapter 8)",
  "P_kW": 7.5, "P_load_kW": 6.0, "n1": 1460.0, "n2": 480.0,
  "load_class": "medium (screw compressors, conveyors)", "hours_per_day": 16.0, "a_target": 600.0,
  "vb_section": "SPA", "vb_d1": 160.0,
  "sy_profile": "14M", "sy_z1": 30, "sy_z2": 91,
  "ch_chain": "12A (ANSI 60)", "ch_z1": 19, "ch_z2": 58, "ch_strands": 1,
  "cp_n": 480.0, "cp_J_motor": 0.30, "cp_J_load": 2.0, "cp_T_harm": [[1, 5.0]], "cp_d_motor": 60.0, "cp_d_load": 60.0,
  "eta_motor_4p": 0.90, "hours_year": 4000.0
}
```

The `cp_…` keys describe a "direct drive" with a 480 rpm motor. Such a motor would be a 12-pole special machine; the
entry is there to show that the program correctly rejects a direct drive for this ratio. A real direct alternative is
a **gear motor** (M5).

**Step 1 – design options** (`python drive.py ch78`, block 8.2):
```
## 8.2 Worked example: Belt conveyor head drive 7.5 kW 1460 -> 480 rpm (example, chapter 8)
  service factor 1.20 -> P_B 9.00 kW, i 3.042
  V-belt options:
    SPA d1 125 / d2 375: z 3, a 594, shaft load 1530 N, n2 481.8 -> OK
    SPA d1 160 / d2 475: z 2, a 601, shaft load 1216 N, n2 486.9 -> OK
    SPA d1 200 / d2 600: z 2, a 588, shaft load 996 N, n2 481.8 -> OK
    SPB d1 160 / d2 475: z 2, a 601, shaft load 1216 N, n2 486.9 -> OK
    SPB d1 200 / d2 600: z 1, a 588, shaft load 996 N, n2 481.8 -> OK
  synchronous belt options:
    8M  z 34 / 104: v 6.6 m/s, width 85 mm (12.7 kW), shaft load 1654 N, n2 477.3 -> OK
    8M  z 40 / 122: v 7.8 m/s, width 85 mm (14.9 kW), shaft load 1419 N, n2 478.7 -> OK
    14M z 28 / 85: v 9.5 m/s, width 40 mm (20.3 kW), shaft load 1177 N, n2 480.9 -> OK
    14M z 30 / 91: v 10.2 m/s, width 40 mm (21.7 kW), shaft load 1107 N, n2 481.3 -> OK
  chain options:
    08A (ANSI 40)  z 19 / 58: v 5.87 m/s, allowed 6.47 vs required 9.00 kW, oil bath / slinger -> fails
    10A (ANSI 50)  z 19 / 58: v 7.34 m/s, allowed 12.59 vs required 9.00 kW, pressure spray (oil pump) -> OK
    12A (ANSI 60)  z 17 / 52: v 7.88 m/s, allowed 12.65 vs required 9.00 kW, pressure spray (oil pump) -> OK
    12A (ANSI 60)  z 19 / 58: v 8.81 m/s, allowed 14.95 vs required 9.00 kW, pressure spray (oil pump) -> OK
  LCC 10 years:
    V-belt             OK     total  59347 EUR (energy  58840)
    synchronous belt   OK     total  56773 EUR (energy  56388)
    roller chain       OK     total  58169 EUR (energy  56609)
    direct + coupling  NOT OK total  53931 EUR (energy  53601)
```

What the options teach:
- **V-belt:**
  - A larger d1 means fewer belts and a lower shaft load: SPA 125 needs 3 belts and 1530 N, SPA 200 needs 2 belts and 996 N.
  - Pulley rim speeds stay low at 1460 rpm. d2 600 runs at 15 m/s, which GJL allows.
  - SPA d1 160 lands on d2 475 (standard series), giving 486.9 rpm (+1.4 %). The ratio is set by the pulley series, not by the belt.
- **Synchronous belt:**
  - 8M needs the widest belt (85 mm) and gives the highest shaft load.
  - 14M with 40 mm (the narrowest 14M width) carries 21.7 kW, 2.4 × the need. The narrowest standard width is the limit, not the load. A 14M drive with 28 teeth is equally possible.
- **Chain:**
  - 08A is too weak.
  - 10A and 12A pass on rating, but at 1460 rpm the chain speed is 7.3–8.8 m/s, which needs **pressure lubrication** (`lubrication()`). A chain belongs at the slow side of a drive (for example after a gear unit), not on the motor shaft.
- **Direct:** not possible (no 480 rpm motor). A gear motor with the head shaft on its hollow shaft would avoid the
  belt; that is the M5 route.

**Step 2 – the full report** for the chosen input (`python drive.py run --in examples/drive_example.json --out example`):

```
# Drive report (belts, chain, coupling) - Belt conveyor head drive 7.5 kW 1460 -> 480 rpm (example, chapter 8)

Task: 7.50 kW motor at 1460 rpm -> 480 rpm (i 3.042), actual load 6.00 kW; medium (screw compressors, conveyors), 16 h/day -> service factor c2 1.20; a about 600 mm

## Narrow V-belt SPA (DIN 7753 / ISO 5292 procedure)
- design power P_B = 7.50 x 1.20 = 9.00 kW; pulleys d1 160 / d2 475 mm, belt speed 12.23 m/s
- datum length: theoretical 2239 -> standard Ld 2240 mm, centre distance a 600.6 mm, wrap angle 149.6 deg, span 580 mm
- rating P_N 5.77 kW per belt (180 deg, L_ref); c1 0.922, c3 0.989 -> 5.26 kW per belt -> z = 2 belt(s)
- per belt: effective pull 368 N, centrifugal 18.4 N, installation tension T0 333 N, F1 517 / F2 149 N; shaft load 1216 N running (1287 N at standstill)
- bending frequency 10.9 Hz, max stress 8.03 MPa at the actual load -> fatigue life 143398 h; expected life 40000 h (ageing limit 40000 h)
- tension check: 9.3 mm deflection at mid-span with 21.3 N, or span frequency 45 Hz; output 486.9 rpm -> all checks OK
- cheapest passing V-belt drive (smallest belt width, life >= 25000 h): SPB d1 200 / d2 600, 1 belt(s), width 16.3 mm, life 40000 h

## Synchronous belt HTD 14M
- z1 30 / z2 91, d 133.69 / 405.53 mm, belt 2100 mm (150 teeth), a 611.4 mm, wrap 154.3 deg, teeth in mesh 12.9 (counted 6)
- v 10.22 m/s, rating 0.542 kW per mm width -> width 40 mm (21.67 kW >= 9.00 kW); T0 568 N, shaft load 1107 N; output 481.3 rpm -> all checks OK

## Roller chain 12A (ANSI 60) x 1
- z1 19 / z2 58, d 115.7 / 351.9 mm, v 8.81 m/s, 102 links (theory 102.7), a 593.0 mm (31 pitches)
- rating per strand: link plate 21.64 kW, roller-bushing 14.95 kW -> 14.95 kW (roller-bushing); allowed 14.95 kW vs required 9.00 kW
- chain pull 852 N, centrifugal 116.4 N, static safety 27.5; polygon speed variation 1.36 %; lubrication: pressure spray (oil pump) -> all checks OK

## Direct drive: 4-pole motor 480 rpm + elastic jaw coupling (92 Sh A, DIN 740-2 style)
- J14: T_KN 8, T_Kmax 15, T_KW 2.0 N m, C 380 N m/rad -> f_e 6 Hz; start 700.7 N m; vib. util. max 0.54 -> fails: bore, nominal, peak_start
- J19: T_KN 10, T_Kmax 20, T_KW 2.6 N m, C 1280 N m/rad -> f_e 11 Hz; start 700.7 N m; vib. util. max 0.61 -> fails: bore, nominal, peak_start
- J24: T_KN 35, T_Kmax 70, T_KW 9.1 N m, C 4900 N m/rad -> f_e 22 Hz; start 700.7 N m; vib. util. max 0.10 -> fails: bore, nominal, peak_start
- J28: T_KN 95, T_Kmax 190, T_KW 24.7 N m, C 10300 N m/rad -> f_e 32 Hz; start 700.6 N m; vib. util. max 0.03 -> fails: bore, nominal, peak_start
- J38: T_KN 190, T_Kmax 380, T_KW 49.4 N m, C 21000 N m/rad -> f_e 45 Hz; start 700.4 N m; vib. util. max 0.02 -> fails: bore, peak_start
- J42: T_KN 265, T_Kmax 530, T_KW 68.9 N m, C 23200 N m/rad -> f_e 47 Hz; start 700.1 N m; vib. util. max 0.01 -> fails: bore, peak_start
- J48: T_KN 310, T_Kmax 620, T_KW 80.6 N m, C 36200 N m/rad -> f_e 59 Hz; start 699.8 N m; vib. util. max 0.01 -> fails: peak_start

## Comparison (energy at 4000 h/year, 0.20 EUR/kWh; efficiencies typical - check)
- V-belt             OK     , n2 487 rpm, eta drive 0.950 x motor 0.871 -> 7.355 kW electric, 29420 kWh/y, 5884 EUR/y, shaft load 1216 N
- synchronous belt   OK     , n2 481 rpm, eta drive 0.980 x motor 0.871 -> 7.049 kW electric, 28194 kWh/y, 5639 EUR/y, shaft load 1107 N
- roller chain       OK     , n2 478 rpm, eta drive 0.970 x motor 0.871 -> 7.076 kW electric, 28305 kWh/y, 5661 EUR/y, shaft load 979 N
- direct + coupling  NOT OK , n2 480 rpm, eta drive 0.995 x motor 0.900 -> 6.700 kW electric, 26801 kWh/y, 5360 EUR/y, shaft load 0 N
written: report.md, drive_data.csv -> example
```

> The motor of this example is a 4-pole machine at 1460 rpm. `compare()` takes the motor efficiency of the belt and
> chain drives from the key `eta_motor_belt` (default 0.871, the compressor's 2-pole motor). The example file keeps that
> default, so the output above uses 0.871 for all three. The relative ranking is unaffected, because the same value
> is used for all three. For absolute energy cost, add `"eta_motor_belt": 0.90` (IE3 7.5 kW 4-pole, check) to the JSON.

**Step 3 – decision.**
1. Over 10 years the 14M synchronous belt saves about **2570 €** against the V-belt. That is ≈ 245 € per year of energy, at 6 kW and 16 h/day.
2. It also gives the exact ratio (481.3 rpm) and a lower shaft load (1107 N vs 1216 N), and it needs no re-tensioning.
3. Its risks:
   - alignment must be within 0.25°, i.e. 2.5 mm offset over the 580 mm span;
   - the conveyor can block (tooth shear instead of slip), so a torque limiter or the motor's current limit must protect it;
   - at 10 m/s the 14M belt is louder than a V-belt.
4. Choice: **HTD 14M, z 30 / 91, belt 2100 mm, 40 mm wide, a ≈ 611 mm**, flanged small pulley in aluminium or steel
   (7.4), installation tension ≈ 568 N (span frequency from the maker's tension meter table), take-up on the motor slide.
5. If the conveyor sees frequent blockages, keep the **V-belt SPA d1 200 / d2 600 (2 belts)**. It slips on overload,
   has the lowest belt shaft load (996 N), and its d2 600 runs at 15 m/s, safe in grey iron.

**Step 4 – hand-over.**
- The head shaft and its bearings are designed with the shaft load of the chosen drive: 1107 N (synchronous) or
  996 N / 1287 N at standstill (V-belt). These go into M3 / M4.
- The pulleys get the manufacturing data of 7.1–7.4: rim speed, balance grade G16, bore H7 or taper bush.
- The installation instruction of 7.6 goes into the maintenance documents.

### 8.3 References

Standards (check the current edition):
- ISO 4184 – Classical and narrow V-belts – lengths in datum system; DIN 7753-1 – narrow V-belts, dimensions
- ISO 4183 – Grooved pulleys for classical and narrow V-belts
- DIN 7753-2 / ISO 5292 – V-belts and V-ribbed belts – calculation of power ratings
- DIN 2218 – Endless V-belts for mechanical engineering – calculation of drives (service factors)
- ISO 9982 – Belt drives – pulleys and V-ribbed belts (PH, PJ, PK, PL, PM) for industrial applications
- ISO 9981 / ISO 22 / DIN 2211 – pulleys for flat and V-ribbed belts
- ISO 13050 – Curvilinear toothed synchronous belt drives (HTD-type profiles); ISO 5296 – Synchronous belt drives – belts with pitch codes MXL…XXH; ISO 5294 – pulleys
- ISO 606 – Short-pitch transmission precision roller and bush chains, attachments and sprockets
- ISO 10823 – Guidance on the selection of roller chain drives; DIN 8195 – Selection of roller chain drives
- ANSI/ASME B29.1 – Precision power transmission roller chains (ACA rating formulae: American Chain Association, *Standard Handbook of Chains*)
- DIN 740-1 / DIN 740-2 – Flexible shaft couplings – requirements, parameters and design
- ISO 21940-11 – Mechanical vibration – rotor balancing – procedures and tolerances for rotors with rigid behaviour
- DIN 6885-1 – Parallel keys and keyways; DIN 6892 – calculation of parallel key joints
- VDI 2758 – Belt drives (Riemengetriebe)
- VDI 3839 / ANSI-ASA S2.75 – shaft alignment methodology (laser alignment tolerances)
- IEC 60034-30-1 – Efficiency classes of line-operated AC motors (IE codes)

Books:
- G. Niemann, H. Winter, B.-R. Höhn: *Maschinenelemente*, Vol. 1 and 3 (belt and chain drives, couplings).
- Decker: *Maschinenelemente – Funktion, Gestaltung und Berechnung* (belt, chain, coupling chapters).
- Roloff / Matek: *Maschinenelemente* – textbook and table book (chapters on belt drives, chain drives, couplings; Tables TB 16–17).
- R. G. Budynas, J. K. Nisbett: *Shigley's Mechanical Engineering Design*, chapter 17 "Flexible mechanical elements" (flat and V-belts, synchronous belts, roller chains, ACA formulae).
- Haberhauer / Bodenstein: *Maschinenelemente* (couplings, DIN 740 selection).
- Maker handbooks (technical manuals of V-belt, synchronous belt, chain and coupling makers) – for real rating tables, tension values and installation instructions.

### 8.4 Glossary

| Term | Meaning |
|---|---|
| Datum diameter d_d | Pulley diameter at the datum width of the groove; all ratio and length calculations use it |
| Datum width b_d | Groove width at the level of the belt's tension cord (SPZ 8.5 mm) |
| Datum length L_d | Belt length at the datum line; the standard length series (ISO 4184) |
| Service factor c2 | Factor on motor power for load type, hours per day and start conditions → design power P_B |
| Wrap factor c1 | Capacity at wrap angle β divided by capacity at 180° (Euler–Eytelwein) |
| Length factor c3 | Correction of the rating for belt length (bending frequency) |
| Euler–Eytelwein (capstan) equation | F1/F2 = e^(μβ) – the tension ratio that friction can hold over the wrap angle β |
| Wedge effect | V-groove multiplies the friction: μ' = μ / sin(α/2) |
| Creep (elastic slip) | Small speed loss (~1 %) because the belt stretches differently in the tight and slack span |
| Installation (static) tension T0 | Tension per belt at standstill that prevents slip at design power, plus the centrifugal share |
| Span frequency | Natural frequency of the free belt span; used to measure tension |
| Matched set | Belts of equal measured length for a multi-belt drive |
| Raw edge belt | V-belt cut from a sleeve without a fabric wrap on the flanks |
| HTD / 8M / 14M | Curvilinear synchronous belt profile with 8 / 14 mm pitch |
| Teeth in mesh z_m | Number of belt teeth on the small pulley; at least 6 |
| Pitch p (chain) | Distance between roller centres (08A = 12.7 mm) |
| Polygon (chordal) effect | Speed variation of a chain because it wraps the sprocket as a polygon: 1 − cos(180°/z) |
| Link-plate / roller-bushing limit | Two fatigue and impact limits of the ACA chain rating; the smaller one governs |
| Galling | Seizure of pin and bush from lack of lubricant at high speed |
| Wear elongation | Growth of chain length from joint wear; replace at 3 % (or 200/z2 %) |
| T_KN, T_Kmax, T_KW | Nominal, maximum and permissible vibratory torque of a flexible coupling (DIN 740-2) |
| S_t, S_A, S_z, S_f | Temperature, shock, start frequency and frequency factors of DIN 740-2 |
| Relative damping ψ | Damping energy per cycle / elastic energy of the elastomer (≈ 0.8 for 92 Sh A) |
| Magnification V | Ratio of dynamic to static coupling torque at frequency ratio η = f / f_e |
| Shore A (Sh A) | Hardness scale of elastomers; 92 Sh A softer, 98 Sh A harder spider |
| Balance grade G | e·ω in mm/s (ISO 21940-11); G6.3 / G16 typical for pulleys |
| U_per | Permissible residual unbalance in g mm |
| Taper bush | Split conical clamping sleeve for mounting pulleys and sprockets on plain shafts |
| Take-up | Motor slide travel to fit and tension a belt |
| Laser alignment | Measurement of shaft offset and angularity between two coupled shafts |
| LCC | Life-cycle cost: purchase + energy + maintenance + replacements over the life |
