# M5c – Worm gears: flank forms, geometry, efficiency and self-locking, heat balance, ISO/TS 14521 capacity, manufacturing

> Field 1 *Mechanical design*, item 5c (companion of M5 cylindrical gears and M5b bevel gears).
> **Theory and program are combined:** every formula is followed by the code of `tools/worm.py`, the command and the real
> output. MATLAB mirror: `tools/worm.m`. Web: tab **M_P_C tools**, item 10. Python standard library only – offline.
> **All inputs are example values.** ISO/TS 14521 and DIN 3996 are implemented in a simplified form (reference friction
> μ_0T, contact-stress parameter p*_m, sliding-path parameter s*, wear intensity J_W, housing area, heat-transfer
> coefficient). Values marked "check" must be compared with the standards, the bronze supplier and the gearbox maker's
> test data before a design is released.

## Contents
0. How to use this guide with the program
1. Purpose – what a worm gear calculation must prove
2. Worm gear types, flank forms, applications and terminology
3. Geometry (DIN 3975 / ISO/TS 14521)
4. Sliding, friction, efficiency, self-locking, forces and the bearing hand-over
5. Power losses, lubrication and heat balance
6. Load capacity in the style of ISO/TS 14521 / DIN 3996 (pitting, wear, tooth root, deflection, temperature)
7. Manufacturing of worm gears (worm: turning, whirling, case hardening, grinding per flank form; wheel: bronze casting, rim on hub, hob design, radial / tangential hobbing, fly-cutter; inspection; assembly, contact pattern, running-in)
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python worm.py params` | Default input as JSON (copy → edit → `--in`) |
| `python worm.py run --in my.json --out res` | Full calculation → `report.md`, `blank.csv` (worm and wheel blank data) |
| `python worm.py examples` | Report of the default stage, the effect of the number of starts, the wheel-material comparison |
| `python worm.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python worm.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=10#mpc` | Same calculation with KPIs, safety bars, efficiency curve, oil temperature vs power, blank table |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 3 | Lead angle, axial / normal pressure angle, pitches, lead, wheel profile shift from the centre distance, tip / root / outside diameters, throat radius, worm length, wheel width, wrap angle, ZI base cylinder, sliding velocity | `geometry()` |
| 4 | Reference friction μ_0T(v_g), factors Y_S, Y_R, Y_W, friction angle, efficiency worm-driving and wheel-driving, self-locking at rest and while running | `mu_0T()`, `efficiency()` |
| 4 | Torques, tangential / axial / radial / normal forces with friction | `forces()` |
| 5 | Mesh, bearing, seal and no-load losses, total efficiency, oil-sump temperature, thermal power limit | `losses()`, `thermal_power_limit()` |
| 6 | Pitting (p*_m, E_red, Z_N, Z_v, Z_S, Z_oil), wear (N_L, s*, J_W, W_ML), tooth root new / worn (Y_ε, Y_F, Y_γ, b_2R), worm deflection, temperature | `E_red()`, `p_star_m()`, `s_star()`, `J_W_TYPICAL`, `capacity()` |
| 7 | Worm over-three-wire measurement | `over_wires()` |
| – | Materials, report, blank CSV | `WHEEL_MATERIALS`, `report_text()`, `run()` |
| 2–4 | Flank forms, modules / q, starts for a ratio, lead-angle and pressure-angle tables, q and x2 studies, efficiency vs v_g and γ, energy check, self-locking map, holding brake, axial-force cases, worm and wheel shaft reactions (M3 hand-over), worm bearing options (M4 hand-over) | `z1_for_ratio()`, `lead_angle_table()`, `pressure_angles()`, `q_study()`, `x2_fit()`, `eta_vs_vg()`, `eta_vs_gamma()`, `energy_check()`, `self_locking_map()`, `holding_brake()`, `axial_force_cases()`, `worm_shaft_reactions()`, `worm_reactions_vs_shaft()`, `worm_bearing_options()`, `wheel_shaft_reactions()`, `wheel_bearing_life()`, `TOOLS`, `PROFILE_TYPES`, `MODULES_WORM`, `Q_COMMON`, `EXTRA_BEARINGS` |
| 5–6 | Loss breakdown, temperature curve, housing / fan study, mineral vs polyglycol, viscosity, oil-change interval, intermittent duty, start-up, pitting factors, wear life, worn root, deflection study, safety summary, maximum power per criterion, wheel-material study, bronze notes | `loss_breakdown()`, `temperature_curve()`, `housing_study()`, `lubricant_compare()`, `viscosity_for_vg()`, `oil_change_interval()`, `duty_cycle_temperature()`, `startup()`, `pitting_breakdown()`, `wear_life()`, `worn_root_curve()`, `deflection_study()`, `safety_summary()`, `max_power_criteria()`, `material_study()`, `VG_BY_VG`, `BRONZE_NOTES` |
| 7–8 | Process chains, worm heat treatment, thread-cutting time, ZK grinding-profile study, hob design, radial / tangential hobbing, fly-cutter, bronze rim shrink fit / bolts, wire check, backlash budget, contact-pattern setting, running-in, defects table, worked example | `worm_heat_treatment()`, `worm_thread_time()`, `grinding_profile_study()`, `hob_design()`, `fly_cutter_time()`, `rim_shrink_fit()`, `rim_bolts()`, `wire_check()`, `backlash_budget()`, `pattern_gain()`, `pattern_setting()`, `running_in()`, `worm_design_example()`, `PROCESS_CHAINS_WORM`, `PROCESS_CHAINS_WHEEL`, `FLANK_FORMS`, `WIRE_SERIES`, `DEFECTS`, `EXAMPLE_WORM` |
Example input of chapter 8: `tools/examples/worm_example.json`.

### 0.3 What the self-test proves
1. tan γ = z1·m_x/d1, lead p_z = z1·π·m_x; a = (d1 + d2)/2 + x2·m_x.
2. Torque balance on both members: F_t1·d1/2 = T1, F_t2·d2/2 = T2 = T1·i·η_z; power balance P2 = P1·η_z.
3. The force formulas agree with the components of the normal force W (inclined-plane model with friction).
4. At γ = ρ′ (limit of self-locking) the efficiency is (1 − tan²γ)/2 < 0.5 – a self-locking worm drive always has η < 50 %.
5. ZI base cylinder: cos γ_b = cos α_n·cos γ and d_b1·tan γ_b = d1·tan γ.
6. Loss sum and heat balance; the thermal power limit really gives θ_lim; the worn tooth root is weaker than the new one.
7. Over-wire measurement: the best wire touches on the reference line, M − d1 = D_M(1 + sin α_x).

## 1. Purpose – what a worm gear calculation must prove

A worm drive gives a high ratio (5 … 100) in one stage, at 90° shaft angle, quietly, with a compact housing. The price
is **sliding**: the worm thread slides along the wheel tooth at about the worm circumferential speed. Sliding produces
heat and wear, so a worm drive is designed differently from a spur or bevel drive: the **heat balance** and **wear**
are often the limits, not tooth breakage.

| Proof | Question | Chapter |
|---|---|---|
| Geometry | Correct centre distance, lead angle, worm length, wheel width, no undercut, wrap angle | 3 |
| Efficiency / self-locking | How much power is lost; can the load drive the worm back (lift, brake function)? | 4 |
| Forces | High axial force on the worm (= wheel tangential force) → worm bearings | 4 |
| Heat balance | Oil-sump temperature below the limit of the oil and the seals | 5 |
| Capacity | Pitting of the bronze, wear life, tooth root after wear, worm deflection, temperature | 6 |
| Manufacture | Worm grinding per flank form, wheel hobbing with a hob matched to the worm, contact pattern, running-in | 7 |

**Default example** (`python worm.py examples`): ZI worm drive a 100 mm, z1/z2 2/41 (i 20.5), m_x 4 mm, d1 36 mm (q 9),
b2 28 mm, 3 kW at 1450 rpm, case-hardened ground worm 16MnCr5, wheel CuSn12Ni2-C-GZ, mineral oil, fan on the worm shaft.

| Result | Value |
|---|---|
| Lead angle, sliding velocity | γ 12.53°, v_g 2.80 m/s |
| Friction, efficiency | μ_z 0.0347; η worm-driving 0.850, wheel-driving 0.827; not self-locking (1-start worm: self-locking at rest only) |
| Forces | T2 344 N m; F_t1 1098 N, F_t2 = F_a1 4200 N, F_r 1579 N |
| Heat | P_V 529 W, total η 0.824, oil sump 61.9 °C; thermal power limit 5.23 kW |
| Capacity | S_H 1.66, S_W 2.04 (wear 0.575 mm in 25 000 h), S_F 4.74 (worn 4.45), worm deflection S_δ 1.22 |


---

## 2. Worm gear types, flank forms, applications and terminology

### 2.1 What a worm drive is
A worm drive is a **crossed-axis** gear pair, usually with a shaft angle of 90°. The **worm** (part 1) is a screw with
z1 threads, called **starts**. The **wheel** (part 2) is a helical gear whose teeth are curved, so they wrap around the
worm (the **throat**). One turn of the worm moves the wheel by z1 teeth, so the ratio is

  i = n1 / n2 = z2 / z1                                    (2.1)

With z1 = 1 … 6 and z2 = 28 … 80, one stage gives i = 5 … 80 or more. A cylindrical gear stage gives at most about 6–8.

Three properties decide where worm drives are used:

| Property | Reason | What it means in practice |
|---|---|---|
| High ratio in one stage, compact, right angle | The worm is a screw: one turn = z1 teeth | Conveyors, turntables, lifts, valve actuators, indexing tables, packaging machines |
| **Sliding** contact, not rolling | The worm thread slides along the wheel tooth with the speed v_g (chapter 4) | Lower efficiency (50–95 %), heat, wear; needs a soft, slide-friendly wheel (bronze) |
| Quiet, smooth, damps shocks | Line contact over several teeth, sliding, bronze wheel | Lifts, stage machinery, medical equipment |
| **Self-locking** possible at small lead angles | The friction angle can exceed the lead angle (§4.5) | A load cannot turn the worm back. Useful for holding, but never a substitute for a brake |

The material pair is almost always a **case-hardened, ground steel worm** (16MnCr5, 20MnCr5, 18CrNiMo7-6; 58–62 HRC)
running against a **tin-bronze wheel** (CuSn12Ni2-C-GZ, centrifugally cast). The hard, smooth worm and the soft bronze
wheel with good emergency-running properties is the only pairing that survives high sliding speeds. Steel against steel
would seize. Chapter 6 compares the wheel materials.

### 2.2 Families of worm drives
| Family | Worm | Wheel | Contact | Use |
|---|---|---|---|---|
| Cylindrical worm drive (this program) | cylinder | throated (enveloping) | line contact | > 90 % of all industrial worm drives |
| Single-enveloping, non-throated wheel | cylinder | ordinary helical gear | point contact | light drives, instruments, adjusting screws |
| Double-enveloping (globoid, "Cone-Drive") | hourglass | throated | several lines at once | very high torque in a small space |
| Spiroid / helicon | tapered worm | face gear | line | high-ratio drives with offset axes |

### 2.3 Flank forms ZA, ZN, ZI, ZK, ZC (DIN 3975 / ISO/TS 14521)
The **flank form** of a cylindrical worm is defined by how its tool is set. This matters because the **wheel is cut by a
hob that is a copy of the worm** (chapter 7). The flank form therefore decides which machine and grinding wheel make the
worm, and whether the worm can be ground at all.

```python
PROFILE_TYPES = [  # code, flank definition, how it is made, grinding, typical use
    ("ZA", "straight line in the AXIAL section (Archimedean spiral in the transverse section)", ...),
    ("ZN", "straight line in the NORMAL section of the tooth (or of the space)", ...),
    ("ZI", "involute helicoid (straight line in a plane tangent to the base cylinder)", ...),
    ("ZK", "generated by a cone (double-cone disc wheel or milling cutter) set at the lead angle", ...),
    ("ZC", "concave flank (circular-arc profile of the tool in the axial section, 'Cavex', 'hollow flank')", ...),
    ("globoid / double-enveloping", ...)]
```
`python worm.py ch24` (first block, shortened):
```
  ZA      straight line in the AXIAL section (Archimedean spiral in the transverse section)
          made: lathe tool with straight edges in the axial plane (thread turning) or whirling | grinding: difficult -
          needs a dressed wheel with a curved profile; mostly not ground | use: small, slow, unhardened worms; low cost
  ZN      straight line in the NORMAL section ...  | use: medium sizes; multi-start worms that are milled
  ZI      involute helicoid (straight line in a plane tangent to the base cylinder)
          made: hobbing / milling, then grinding with a flat (plane) wheel face on the base-cylinder tangent plane |
          grinding: easy and exact: flat wheel face -> low dressing cost | use: industrial gearboxes, robots, lifts
  ZK      generated by a cone (double-cone disc wheel or milling cutter) set at the lead angle
          ... grinding: standard process of most worm-grinding machines; profile depends on the wheel diameter
  ZC      concave flank ... use: high-capacity drives: concave-convex contact -> ~15-30 % higher capacity (check maker data)
  globoid worm enveloping the wheel (hourglass shape) ... very high torque in a small space; needs exact axial setting
```

How to picture each form:
- **ZA**: a lathe tool with straight 20° edges, set at the height of the worm axis, cuts a thread just as a trapezoidal
  screw is cut. In the axial section you see straight flanks. In any other section the flank is curved.
- **ZN**: the same straight tool is tilted by the lead angle γ, so it lies in the **normal** section of the thread. This
  is better for multi-start worms with large γ, where a ZA tool would rub with its side.
- **ZI**: the flank is an **involute helicoid**, the same surface as the flank of a helical involute gear with very few
  teeth (z1 teeth, helix angle β = 90° − γ). Every plane **tangent to the base cylinder** cuts the flank along a straight
  line. So a grinding wheel with a **flat face** set in that plane grinds the flank exactly. This is the main reason
  ZI is preferred for ground, hardened worms: dressing a flat face is simple and accurate.
- **ZK**: a disc wheel with a straight-sided (biconical) profile, tilted to the lead angle, grinds the thread. The flank
  that results is slightly convex and **depends on the wheel diameter**. As the wheel wears and is dressed smaller, the
  flank changes a little, so the machine corrects the setting.
- **ZC**: a convex circular-arc wheel produces a **concave** worm flank. Concave worm against convex wheel flank gives
  a larger equivalent radius of curvature, which means lower contact stress and a thicker oil film. Makers report
  higher capacity (check maker data).

The flank forms differ only by a few micrometres on small worms with small γ. They differ by tens of micrometres at
large γ and large modules. **Worm and hob must have the same flank form and the same basic data**, otherwise the wheel
contact pattern runs off. For design, ISO/TS 14521 and this program treat all forms with the same formulas. The
parameter p*_m in chapter 6 is fitted to ZI (check for other forms).

### 2.4 Terminology (DIN 3975 / ISO 1122-1 style)
| Term | Symbol | Meaning |
|---|---|---|
| number of starts (threads) | z1 | 1 … 6; more starts → larger lead angle, higher efficiency, lower ratio |
| number of wheel teeth | z2 | ≥ 28–30 for α_n = 20°, to avoid undercut |
| axial module | m_x | axial pitch / π; equals the **transverse module of the wheel** |
| axial pitch | p_x = π m_x | distance between neighbouring threads, measured along the axis |
| lead | p_z = z1 p_x | axial advance of one thread in one worm revolution |
| reference diameter of the worm | d1 | chosen freely. It is **not** z1·m_x, which is the main difference from a cylindrical gear |
| diameter quotient | q = d1/m_x | 7 … 17; small q → slender worm (bending), large q → poor efficiency |
| lead angle (reference cylinder) | γ (γ_m) | tan γ = p_z / (π d1) = z1/q; complement of the helix angle |
| normal module | m_n = m_x cos γ | module in the normal section of the thread |
| profile shift of the wheel | x2 | the only profile shift. The worm is never shifted, because its hob would change too |
| throat radius | r_k | radius of the hollow of the wheel rim, r_k = a − d_a2/2 |
| wrap angle | 2 arcsin(b2/d_a1) | how far the wheel wraps around the worm |
| hand | right / left | right hand is standard (as an ordinary screw); worm and wheel have the **same** hand |

### 2.5 Choosing the number of starts
More starts give a larger lead angle and better efficiency, but a lower ratio for the same wheel. Fewer starts give
self-locking and a large ratio, but more heat.

```python
def z1_for_ratio(i):
    if i < 7:    z1 = 6
    elif i < 10: z1 = 4
    elif i < 15: z1 = 3
    elif i < 30: z1 = 2
    else:        z1 = 1
    return z1, round(z1 * i)
```
`python worm.py ch24`:
```
== Ch. 2 starts vs ratio (rule of thumb)
  i   5.0 -> z1 6, z2 30
  i   8.0 -> z1 4, z2 32
  i  12.0 -> z1 3, z2 36
  i  20.5 -> z1 2, z2 41
  i  40.0 -> z1 1, z2 40
  i  60.0 -> z1 1, z2 60
```
Makers of standard worm gearboxes use a ratio series of about 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100. They
often choose z2 so that z2/z1 is **not an integer**, for example 41/2 = 20.5 instead of 40/2 = 20. Then every worm thread
meets every wheel tooth ("hunting tooth"), so local errors are spread and the wheel wears in evenly. The default
example uses this rule.

### 2.6 Where worm drives are used – and where not
| Good choice | Poor choice |
|---|---|
| ratio 10–60 at a right angle, low to medium power (≤ 50–100 kW) | high power with continuous duty: the losses cost energy every hour. A bevel-helical drive at 95–97 % pays back |
| intermittent duty: conveyors, gates, lifts, rotary tables (heat has time to flow away) | very high input speed with low lubrication: v_g > 15–20 m/s needs forced cooling |
| quiet running, damping of shocks | precise positioning with zero backlash after wear, unless a dual-lead worm is used (chapter 7) |
| holding a load at rest (with a brake as backup) | applications that must back-drive freely (manual override) unless γ is large |

**Rule:** at P ≥ 15 kW and 6000 h per year, 10 % efficiency difference costs about 1.5 kW × 6000 h = 9000 kWh per year.
Compare that with the price difference of the gearbox before choosing a worm drive.

---

## 3. Geometry (DIN 3975 / ISO/TS 14521)

### 3.1 The basic relations
Unroll the reference cylinder of the worm (diameter d1). One thread rises by the lead p_z over the circumference π d1:

  tan γ = p_z / (π d1) = z1 π m_x / (π d1) = z1 m_x / d1 = z1 / q          (3.1)

Normal module and axial pitch:

  p_x = π m_x,   p_z = z1 p_x,   m_n = m_x cos γ                            (3.2)

The wheel is a helical gear with helix angle β2 = γ (same hand) and transverse module m_x:

  d2 = z2 m_x                                                              (3.3)

The centre distance follows from the two reference circles plus the wheel profile shift:

  a = (d1 + d2)/2 + x2 m_x    ⇒    x2 = (2a − d1 − d2) / (2 m_x)           (3.4)

Tip and root diameters (h_a* = 1, c* = 0.2 here; DIN 3975 allows c* 0.15–0.3, check):

  d_a1 = d1 + 2 h_a* m_x,       d_f1 = d1 − 2 (h_a* + c*) m_x
  d_a2 = d2 + 2 m_x (h_a* + x2),  d_f2 = d2 − 2 m_x (h_a* + c* − x2)
  d_e2 ≈ d_a2 + m_x  (outside diameter of the throated wheel, z1 ≤ 3; check DIN 3975)
  r_k = a − d_a2/2   (throat radius)                                        (3.5)

Code (`geometry()` in `worm.py`):
```python
    u = z2 / z1
    q = d1 / mx
    gam = math.atan(z1 * mx / d1)                       # lead angle at the reference cylinder
    an = math.radians(P["alpha_n_deg"])
    ax = math.atan(math.tan(an) / math.cos(gam))        # axial pressure angle
    px = math.pi * mx
    pz = z1 * px                                        # lead
    mn = mx * math.cos(gam)
    d2 = z2 * mx
    x2 = (2 * a - d1 - d2) / (2 * mx)                   # profile shift of the wheel from the centre distance
    ha, c = P["haP"] * mx, P["cP"] * mx
    da1, df1 = d1 + 2 * ha, d1 - 2 * (ha + c)
    da2 = d2 + 2 * mx * (P["haP"] + x2)
    df2 = d2 - 2 * mx * (P["haP"] + P["cP"] - x2)
    dae2 = da2 + mx                                     # outside (throat edge) diameter, z1 <= 3 (check DIN 3975)
    rk = a - da2 / 2                                    # throat radius of the wheel rim
```
`python worm.py examples` (report, geometry part):
```
ZI worm, a 100.0 mm, z1/z2 2/41 (i 20.50), mx 4.000, d1 36.00 (q 9.00), alpha_n 20.0 deg, b2 28.0 mm, ...
- lead angle 12.529 deg; axial pressure angle 20.448 deg; px 12.5664, lead pz 25.1327, mn 3.9047 mm
- worm d1 36.000, da1 44.000, df1 26.400; wheel d2 164.000, x2 +0.0000, da2 172.000, df2 154.400, dae2 176.000, throat radius 14.000 mm
```

**Hand calculation (check against the output):**
- tan γ = 2·4/36 = 0.22222 → γ = 12.529° ✓
- p_x = π·4 = 12.566 mm; p_z = 2·12.566 = 25.133 mm ✓; m_n = 4·cos 12.529° = 4·0.97619 = 3.9048 mm ✓
- d2 = 41·4 = 164 mm; x2 = (200 − 36 − 164)/8 = 0 ✓
- d_a1 = 36 + 8 = 44; d_f1 = 36 − 2·1.2·4 = 26.4; d_a2 = 164 + 8 = 172; d_f2 = 164 − 9.6 = 154.4 ✓
- r_k = 100 − 86 = 14 mm (= d1/2 − m_x = 18 − 4) ✓

### 3.2 Axial and normal pressure angle
The tooth normal is tilted by γ against the axial plane. Take a thread face with normal pressure angle α_n. Over one
unit of axial length the flank rises by tan α_n in the normal section. In the axial section the same rise is spread
over 1/cos γ:

  tan α_x = tan α_n / cos γ                                                (3.6)

Which angle is "fixed" depends on the flank form. ZA has a straight flank with α_x **exactly** in the axial section.
ZN, ZI and ZK are specified with α_n (α_0 for the tool). The program takes α_n and derives α_x.

```python
def pressure_angles(P=None):
    g = geometry(P)
    return {"alpha_n": P["alpha_n_deg"], "alpha_x": math.degrees(g["alpha_x"]),
            "alpha_x_hand": math.degrees(math.atan(math.tan(math.radians(P["alpha_n_deg"])) / math.cos(g["gamma"])))}
```
`python worm.py ch24`:
```
== Ch. 3 pressure angles: alpha_n 20.0 -> alpha_x 20.4479 deg (hand 20.4479)
```
Hand: tan α_x = 0.36397 / 0.97619 = 0.37285 → α_x = 20.448° ✓. At γ = 30° (z1 = 6) the difference grows to
α_x = 22.8°. A ZA tool ground to 20° would then give quite another worm than a ZI worm "with 20°". This is why the drawing
must state the **flank form and which pressure angle is meant**.

For large lead angles (γ > 15–20°), α_n = 20° can give undercut on the wheel or a pointed worm tooth. Makers then use
α_n = 22.5–25° (check DIN 3975 annex / maker).

### 3.3 Standard modules and diameter quotients
```python
MODULES_WORM = [1.0, 1.25, 1.6, 2.0, 2.5, 3.15, 4.0, 5.0, 6.3, 8.0, 10.0, 12.5, 16.0, 20.0]   # DIN 780-2 series (check)
Q_COMMON = [8.0, 9.0, 10.0, 11.0, 12.5, 14.0, 16.0, 17.0]                                   # DIN 3976 style (check)
```
The worm module series (R10 numbers 1.6, 3.15, 6.3, 12.5) differs from the cylindrical-gear series of ISO 54 (1.5, 3, 6, 12).
In practice the **hob for the wheel is the expensive item**. A gearbox maker owns a set of hobs for fixed (m_x, d1, z1)
combinations and designs around them. Centre distances follow the R20 series: 40, 50, 63, 80, 100, 125, 160, 200, 250,
315 mm. Standard gearboxes cover a ratio range at one centre distance by changing z1, z2, m_x, d1 and x2. The default
example (a 100, m_x 4, d1 36, z1 2, z2 41, x2 0) is such a combination.

### 3.4 Lead angle as a design table
```python
def lead_angle_table(z1s=(1, 2, 3, 4, 6), qs=(8, 9, 10, 12.5, 16)):
    return {(z1, q): math.degrees(math.atan(z1 / q)) for z1 in z1s for q in qs}
```
`python worm.py ch24`:
```
== Ch. 3 lead angle gamma = atan(z1/q) [deg]
  z1 \ q        8       9      10    12.5      16
       1     7.13    6.34    5.71    4.57    3.58
       2    14.04   12.53   11.31    9.09    7.13
       3    20.56   18.43   16.70   13.50   10.62
       4    26.57   23.96   21.80   17.74   14.04
       6    36.87   33.69   30.96   25.64   20.56
```
Chapter 4 shows that the efficiency depends mainly on γ. This table is therefore also a first efficiency table:
γ < 7° means statically self-locking with μ_static ≈ 0.12, but an efficiency below about 0.75.

### 3.5 The diameter quotient q – a real compromise
A smaller d1 (small q) raises γ and the efficiency and reduces v_g. But the worm becomes slender. Its root diameter d_f1
carries the bending from F_t1 and F_r over the bearing span l1, and the worm deflection disturbs the contact pattern
(limit about 0.01 m_x, chapter 6). The study keeps m_x, z1, z2 and the bearing span (160 mm) and lets the centre distance
follow:

```python
def q_study(P=None, qs=(7.0, 8.0, 9.0, 10.0, 12.5, 16.0)):
    for q in qs:
        d1 = q * P["mx"]
        a = (d1 + P["z2"] * P["mx"]) / 2
        Q = dict(P, d1=d1, a=a, b2=round(0.45 * (d1 + 2 * P["mx"] + 4 * P["mx"]), 1))
        R = capacity(Q)
        rows.append({... "eta": R["e"]["eta_z"], "delta_um": R["delta_m"] * 1000, "Sd": R["Sd"], "SH": R["SH"], ...})
```
`python worm.py ch24`:
```
== Ch. 3 q study (mx 4, z1 2, z2 41, x2 0, b2 = 0.45 (da1 + 4 mx))
  q     d1     a      gamma   vg     eta    defl um  S_delta  S_H   oil C
  7.0   28.0   96.0   15.95   2.21   0.867  156.3    0.26     1.54  60.8
  8.0   32.0   98.0   14.04   2.50   0.859  66.6     0.60     1.59  61.4
  9.0   36.0   100.0  12.53   2.80   0.850  32.8     1.22     1.64  61.9
  10.0  40.0   102.0  11.31   3.10   0.842  17.9     2.24     1.68  62.3
  12.5  50.0   107.0  9.09    3.84   0.822  5.3      7.57     1.81  62.8
  16.0  64.0   114.0  7.13    4.90   0.797  1.5      26.86    2.02  62.8
```
Read the table as a designer:
- Deflection grows with **1/d_f1⁴** (second moment of area). From q 9 to q 7 the worm root shrinks from 26.4 to 18.4 mm
  and the deflection rises almost five times (33 → 156 µm). q 7 and q 8 fail the deflection limit 40 µm with this span.
- Efficiency improves only from 0.850 to 0.867 when q goes from 9 to 7. The gain is small compared with the stiffness lost.
- S_H rises with q because a larger d1 gives a larger centre distance (σ_H ∝ a^−1.5, chapter 6).
- **q ≈ 9–10 is the usual compromise** for a 2-start worm. Short bearing spans allow q 8. Long, overhung or hollow worms
  need q 11–12.

### 3.6 Profile shift of the wheel – fitting a centre distance
The worm is never profile-shifted. Its geometry is "frozen" in the hob. A non-standard centre distance is reached only
with x2 (3.4):

```python
def x2_fit(P=None, a_targets=(98.0, 100.0, 102.0, 104.0)):
    for a in a_targets:
        g = geometry(dict(P, a=a))
        out.append((a, g["x2"], g["da2"], g["checks"]["x2_range"]))
```
`python worm.py ch24`:
```
== Ch. 3 x2 to fit a centre distance (mx 4, d1 36, z2 41)
  a 98.0 -> x2 -0.500, da2 168.00 mm
  a 100.0 -> x2 +0.000, da2 172.00 mm
  a 102.0 -> x2 +0.500, da2 176.00 mm
  a 104.0 -> x2 +1.000, da2 180.00 mm
```
- **x2 < 0** moves the wheel into the worm. The wheel teeth become thinner at the root and can be undercut at small z2.
  The contact zone moves to the **entry** side, which is poor for oil-film build-up. Limit about −0.5.
- **x2 > 0** moves the contact zone to the **exit** side, which is good for the oil wedge. Makers often use x2 = +0.2 …
  +0.5 for this reason. Above +1 the wheel tip becomes pointed.
- In the same way as in M5, x2 is also used to adjust a **standard centre distance** for different ratios with the same hob.

### 3.7 Face widths, worm length, wrap angle
**Wheel width b2.** The wheel wraps around the worm. Beyond the width where the wheel rim meets the worm root, more
width adds no contact, only weight. The recommendation and maximum used in `geometry()`:

  b2 ≈ 0.45 (d_a1 + 4 m_x)  (recommended, check)     b2,max = √(d_a1² − (d1 − 2 m_x)²)     (3.7)

  wrap angle = 2 arcsin(b2 / d_a1)

**Worm length b1.** The wheel tip circle (radius r_a2, centre at distance a) intersects the worm tip cylinder at
x = ±√(r_a2² − (a − r_a1)²). Contact cannot extend further, so this length is a safe upper value. The empirical DIN 3976 /
Niemann value for x2 = 0 is shorter:

  b1,geo = 2 √(r_a2² − (a − r_a1)²),   b1,emp = (11 + 0.06 z2) m_x  (z1 ≤ 2), (12.5 + 0.09 z2) m_x  (z1 3–4)    (3.8)

```python
    b1_geo = 2 * math.sqrt(max(ra2 ** 2 - (a - ra1) ** 2, 0.0))     # wheel tip circle reaches the worm tip cylinder
    b1_emp = (11 + 0.06 * z2) * mx if z1 <= 2 else (12.5 + 0.09 * z2) * mx   # empirical (x2 = 0)
    b2_rec = 0.45 * (da1 + 4 * mx)                      # recommended wheel width (check)
    b2_max = math.sqrt(da1 ** 2 - (d1 - 2 * mx) ** 2) if da1 > d1 - 2 * mx else da1
    wrap = 2 * math.asin(min(P["b2"] / da1, 1.0))       # wrap angle of the wheel on the worm tip cylinder
```
```
- worm length b1 >= 72.4 (geometric) / 53.8 mm (empirical); wheel width b2 28.0 (recommended 27.0, max 33.9); wrap angle 79.0 deg
```
Hand: r_a2 = 86, a − r_a1 = 100 − 22 = 78 → √(7396 − 6084) = 36.2 → b1,geo = 72.4 mm ✓.
b2,rec = 0.45·(44 + 16) = 27.0 ✓. b2,max = √(44² − 28²) = √1152 = 33.9 ✓. Wrap = 2·arcsin(28/44) = 79.0° ✓.

**Practice:** grind the thread over at least b1,emp plus one axial pitch on each side for the grinding-wheel run-out
(here 53.8 + 2·12.6 ≈ 80 mm). Keep the bearing journals **outside** this zone. Where possible, make them **smaller than
d_f1**, so the hob for the worm (if milled) and the grinding wheel can run out freely. A shoulder larger than d_f1 next
to the thread end collides with the grinding wheel.

### 3.8 The ZI base cylinder
An involute helicoid is generated by a straight line in a plane tangent to the **base cylinder** (diameter d_b1). It is the
helical-gear involute of M5 seen from the "screw side": the worm is a helical gear with z1 teeth and helix angle
β = 90° − γ. For a helical gear the base helix angle obeys sin β_b = sin β cos α_n. With β = 90° − γ (so sin β = cos γ)
and the base lead angle γ_b = 90° − β_b:

  cos γ_b = cos α_n · cos γ                                                (3.9)

The lead p_z is the same on every cylinder (it is one screw), so tan γ_b = p_z/(π d_b1) and tan γ = p_z/(π d1):

  d_b1 = d1 · tan γ / tan γ_b                                              (3.10)

```python
    gb = math.acos(math.cos(an) * math.cos(gam))        # base lead angle (ZI involute helicoid)
    db1 = d1 * math.tan(gam) / math.tan(gb)
```
```
- ZI base cylinder db1 18.431 mm (base lead angle 23.463 deg); sliding velocity vg 2.800 m/s; n2 70.73 rpm
```
Hand: cos γ_b = 0.93969·0.97619 = 0.91732 → γ_b = 23.463°; d_b1 = 36·0.22222/0.43403 = 18.43 mm ✓.
The self-test checks d_b1 tan γ_b = d1 tan γ.

**Manufacturing meaning:** the ZI grinding wheel face is set **tangent to the d_b1 = 18.43 mm cylinder**, inclined by γ_b.
Then one straight generatrix of the flank lies in the wheel face and the flank is ground exactly with a plane wheel
(chapter 7). d_b1 < d_f1 (18.4 < 26.4 mm), so the involute flank exists over the whole tooth depth. For very large γ
the base cylinder grows above d_f1 and part of the flank is no longer involute (check).

### 3.9 Geometry checks done by the program
```python
            "checks": {"x2_range": -0.5 <= x2 <= 1.0, "b2_le_max": P["b2"] <= b2_max, "q_range": 6 <= q <= 17}}
```
| Check | Why |
|---|---|
| −0.5 ≤ x2 ≤ 1 | weak / undercut wheel teeth below, pointed wheel tips above |
| b2 ≤ b2,max | extra width does not carry |
| 6 ≤ q ≤ 17 | slender worm below; poor efficiency and large wheel above |
| z2 ≥ 28–30 (α_n 20°) | undercut of the wheel (not coded: compare z2 yourself) |

---

## 4. Sliding, friction, efficiency, self-locking, forces and the bearing hand-over

### 4.1 Sliding velocity
At the pitch point the worm surface moves with the circumferential speed v1 = π d1 n1 / 60000. The wheel surface moves
with v2 = π d2 n2 / 60000, along the worm axis. The two vectors are **perpendicular**, and the relative speed lies
along the thread:

  v_g = √(v1² + v2²) = v1 / cos γ          (v2 = v1 tan γ)                (4.1)

```python
    vg = math.pi * d1 * P["n1_rpm"] / 60000.0 / math.cos(gam)        # sliding velocity m/s
    v1 = math.pi * d1 * P["n1_rpm"] / 60000.0
    v2 = math.pi * d2 * P["n1_rpm"] / u / 60000.0
```
Hand: v1 = π·36·1450/60000 = 2.733 m/s; v_g = 2.733/0.97619 = 2.800 m/s ✓. v2 = π·164·70.73/60000 = 0.607 m/s,
and v1·tan γ = 2.733·0.2222 = 0.607 ✓. **Nearly the whole surface speed is sliding.** In a cylindrical gear the sliding
is zero at the pitch point and small elsewhere. This one fact explains bronze, heat, wear and efficiency.

### 4.2 Friction coefficient
The friction coefficient of a worm mesh depends strongly on v_g. At low v_g there is mixed friction with metal contact.
At high v_g a hydrodynamic film builds up. ISO/TS 14521 and DIN 3996 give a reference value μ_0T for the test pairing
(case-hardened ground worm, CuSn12Ni2 wheel) as a function of v_g and lubricant. Factors then correct it for size,
roughness and material:

  μ_z = μ_0T · Y_S · Y_G · Y_W · Y_R,   Y_S = √(100/a),   Y_R = (R_a1/0.5)^0.25,   Y_G = 1 here     (4.2)

```python
def mu_0T(vg, lubricant):
    m = 0.028 + 0.026 / (vg + 0.18)
    return m if lubricant == "mineral" else 0.8 * m
...
    mu = m0 * YS * YR * mat["YW"]
    rho = math.atan(mu / math.cos(g["alpha_n"]))     # friction angle (normal section)
```
```
- mu_0T 0.0367 x Y_S 1.000 x Y_R 0.946 x Y_W 1.00 = mu_z 0.0347; friction angle 2.117 deg
```
Hand: μ_0T = 0.028 + 0.026/2.98 = 0.03672; Y_R = (0.4/0.5)^0.25 = 0.9457; μ_z = 0.03473 ✓.
ρ' = arctan(0.03473/cos 20°) = arctan(0.03696) = 2.117° ✓.

The curve, the 20 % polyglycol advantage and the factors are simplified (**check** against ISO/TS 14521 method B and the
oil maker). Polyglycol (PG) oils really do give lower friction and less wear with bronze. But they **do not mix with
mineral oil** and attack some paints and seals. Note that on the drawing and the oil plate.

**Why μ / cos α_n?** Friction acts along the flank, while the normal force W lies in the normal section, inclined by α_n.
Projected into the plane where the screw (inclined-plane) model works, the friction "seen" by the thread is μ/cos α_n.
This is the same correction as for a trapezoidal screw (M7 later uses it for power screws).

### 4.3 Efficiency – the inclined-plane model
Unroll one thread of the worm. It becomes an **inclined plane** with angle γ. The wheel tooth is a block on this plane.

- **Worm driving.** The worm pushes the block up the plane. The resultant force on the block is tilted by the friction
  angle ρ' away from the normal. The force needed in the circumferential direction is
  F_t1 = F_t2 · tan(γ + ρ'). Without friction it would be F_t2 · tan γ. Efficiency = useful work / input work:

  η_z = tan γ / tan(γ + ρ')                                               (4.3)

- **Wheel driving (back-driving).** The block slides down and friction now opposes it:

  η'_z = tan(γ − ρ') / tan γ      (zero or negative if γ ≤ ρ')            (4.4)

```python
    eta = math.tan(gam) / math.tan(gam + rho)        # worm driving
    eta_rev = math.tan(gam - rho) / math.tan(gam) if gam > rho else 0.0     # wheel driving
```
```
- mesh efficiency worm driving 0.8503, wheel driving 0.8269; self-locking at rest: no (rho_static 7.28 deg), while running: no
```
Hand: η_z = tan 12.529° / tan 14.646° = 0.22222/0.26135 = 0.8503 ✓; η'_z = tan 10.412°/tan 12.529° = 0.18376/0.22222 = 0.8269 ✓.

**Energy check.** In one worm revolution the input work is F_t1 · π d1. The wheel teeth move by one lead p_z against
F_t2, so the output work is F_t2 · p_z. Their ratio must equal (4.3):

```python
def energy_check(P=None):
    W_in = F["Ft1"] * math.pi * g["d1"]
    W_out = F["Ft2"] * g["pz"]
    return W_in, W_out, W_out / W_in, e["eta_z"]
```
```
== Ch. 4 energy check per worm revolution: W_in 124137.9 N mm, W_out 105560.7 N mm -> eta 0.85035 (formula 0.85035)
```
The difference, 18 577 N mm per revolution, becomes heat in the mesh: 18.58 J × 1450/60 = 449 W. That is exactly the
mesh loss P_Vz of the report (chapter 5).

### 4.4 Efficiency vs lead angle and vs sliding speed
Differentiate (4.3) with respect to γ. Setting d/dγ [tan γ / tan(γ + ρ')] = 0 gives sin 2γ = sin 2(γ + ρ') with the
non-trivial solution 2γ = 180° − 2(γ + ρ'), so the **best lead angle** is

  γ_opt = 45° − ρ'/2                                                      (4.5)

```python
def eta_vs_gamma(mu=0.0347, alpha_n_deg=20.0, gammas=(2, 4, 6, 8, 10, 12.53, 15, 20, 25, 30, 40, 45, 50)):
    rho = math.atan(mu / math.cos(math.radians(alpha_n_deg)))
    for gd in gammas:
        gm = math.radians(gd)
        eta = math.tan(gm) / math.tan(gm + rho)
        eta_r = math.tan(gm - rho) / math.tan(gm) if gm > rho else 0.0
    g_opt = 45 - math.degrees(rho) / 2
```
`python worm.py ch24`:
```
== Ch. 4 efficiency vs lead angle (mu 0.0347): best gamma = 45 - rho/2 = 43.94 deg
  gamma  2.00: eta worm 0.485, eta wheel 0.000
  gamma  4.00: eta worm 0.653, eta wheel 0.471
  gamma  6.00: eta worm 0.737, eta wheel 0.646
  gamma  8.00: eta worm 0.788, eta wheel 0.733
  gamma 10.00: eta worm 0.821, eta wheel 0.785
  gamma 12.53: eta worm 0.850, eta wheel 0.827
  gamma 15.00: eta worm 0.870, eta wheel 0.854
  gamma 20.00: eta worm 0.896, eta wheel 0.887
  gamma 25.00: eta worm 0.911, eta wheel 0.905
  gamma 30.00: eta worm 0.920, eta wheel 0.917
  gamma 40.00: eta worm 0.928, eta wheel 0.927
  gamma 45.00: eta worm 0.929, eta wheel 0.929
  gamma 50.00: eta worm 0.927, eta wheel 0.928
```
The curve is very flat above 25°. Real worms rarely exceed γ ≈ 30–35°: the ratio becomes small, and a cylindrical gear
stage would then be better. Below 10° the efficiency falls fast. This is the price of one-stage high ratios.

The sliding speed changes μ. Keep the geometry and vary v_g:
```python
def eta_vs_vg(P=None, vgs=(0.05, 0.2, 0.5, 1.0, 2.0, 2.8, 5.0, 10.0, 15.0)):
    corr = e["YS"] * e["YR"] * e["YW"]
    for v in vgs:
        mu = mu_0T(v, P["lubricant"]) * corr
        rho = math.atan(mu / math.cos(g["alpha_n"]))
        eta = math.tan(g["gamma"]) / math.tan(g["gamma"] + rho)
```
```
== Ch. 4 efficiency vs sliding speed (default geometry, gamma 12.53 deg)
  vg m/s  mu_z     eta worm  eta wheel
  0.05    0.1334   0.591     0.350
  0.20    0.0912   0.681     0.551
  0.50    0.0626   0.758     0.690
  1.00    0.0473   0.806     0.765
  2.00    0.0378   0.839     0.812
  2.80    0.0347   0.850     0.827
  5.00    0.0312   0.863     0.844
  10.00   0.0289   0.872     0.856
  15.00   0.0281   0.876     0.860
```
**Consequences in the factory:**
1. **Start-up efficiency** (v_g → 0) is far lower than the running efficiency, here 0.59 instead of 0.85. The motor must
   be sized for the **starting torque**: T1,start = T2 / (i η_start). For a lift or conveyor that starts under full load,
   this decides the motor, not the running power. Catalogues give a separate "starting efficiency" (check maker).
2. Slow hand-wheel drives and very slow inching (v_g < 0.5 m/s) run in mixed friction. Wear and efficiency are both poor.
3. Frequency-inverter drives that run a worm gearbox at 10 Hz lose efficiency and heat up per unit of output.

### 4.5 Self-locking – the condition and why η < 0.5
From (4.4), back-driving is impossible when

  γ ≤ ρ'     (self-locking)                                               (4.6)

Two friction values are needed:
- **At rest** (static friction μ_0 ≈ 0.10–0.15, check): is the drive **statically self-locking**? Can a load at rest
  start the worm turning?
- **While running** (μ at v_g): is the drive **dynamically self-locking**? Does it stop by itself when the motor is
  switched off while the load is still pulling?

**Why a self-locking drive always has η_z < 0.5.** At the limit γ = ρ':

  η_z = tan ρ' / tan 2ρ' = tan ρ' · (1 − tan² ρ') / (2 tan ρ') = (1 − tan² ρ')/2 < 0.5              (4.7)

For γ < ρ', η_z is even lower, because (4.3) rises with γ below γ_opt. **Self-locking and good efficiency exclude each
other.** A self-locking worm turns more than half of the input energy into heat. The self-test checks (4.7).

```python
    rho_s = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    return {... "self_locking_static": gam < rho_s, "self_locking_dynamic": gam <= rho}
```
Self-locking map (same m_x 4, z2 41):
```python
def self_locking_map(P=None, z1s=(1, 2, 3), qs=(8, 10, 12.5, 16), vg_run=None):
    for z1 in z1s:
        for q in qs:
            Q = dict(P, z1=z1, z2=P["z2"], d1=q * P["mx"], a=(q * P["mx"] + P["z2"] * P["mx"]) / 2)
            g, e = geometry(Q), efficiency(Q)
```
`python worm.py ch24`:
```
== Ch. 4 self-locking map (mu_static 0.12, running mu at vg)
  z1  q     gamma  rho_s  rho    eta    eta_rev  lock rest  lock running
  1   8.0   7.13   7.28   2.21   0.761  0.689    yes        no
  1   10.0  5.71   7.28   2.06   0.733  0.639    yes        no
  1   12.5  4.57   7.28   1.92   0.702  0.579    yes        no
  1   16.0  3.58   7.28   1.79   0.665  0.499    yes        no
  2   8.0   14.04  7.28   2.19   0.859  0.839    no         no
  2   10.0  11.31  7.28   2.05   0.842  0.815    no         no
  2   12.5  9.09   7.28   1.92   0.822  0.786    no         no
  2   16.0  7.13   7.28   1.79   0.797  0.747    yes        no
  3   8.0   20.56  7.28   2.18   0.895  0.886    no         no
  3   10.0  16.70  7.28   2.04   0.884  0.872    no         no
  3   12.5  13.50  7.28   1.92   0.871  0.854    no         no
  3   16.0  10.62  7.28   1.79   0.852  0.829    no         no
```
Important observations:
- **No geometry here is dynamically self-locking.** At v_g ≈ 2.8 m/s the running friction angle is only about 2°. A
  1-start worm with γ = 3.6° still back-drives while it is turning. A load **will run on** after the motor stops,
  until the speed (and with it v_g) has fallen and friction rises again.
- Static self-locking holds only at γ < 7.3°, and only while nothing shakes the drive. **Vibration** (a nearby press,
  a vibrating conveyor) reduces the effective friction to the running value and the load creeps down. Many accidents
  with lifting tables happened this way.
- The η values at "lock rest = yes" are 0.67–0.80 here, not < 0.5. Condition (4.7) applies to the friction that does the
  locking. With μ_static 0.12 the running efficiency (lower μ) can be higher than 0.5. Only with dynamic self-locking
  (γ ≤ ρ' running) is the running efficiency below 0.5.

**Rule for lifting and holding axes (EN 81 lifts, EN 1570 lifting tables, Machinery Directive):** a worm drive is **never**
the only holding means. Fit a spring-applied brake (on the motor) sized for the load. Self-locking is a welcome extra
safety, but not the safety function.

### 4.6 Holding brake and back-driving torque
A load torque T2 on the wheel drives the worm backwards with T1,back = T2 · η'_z / i. Use static friction for "can it
start to move?" and running friction for "does it keep moving?":

```python
def holding_brake(P=None, T2_load_Nm=None, safety=2.0):
    rho_s = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    eta_rs = math.tan(g["gamma"] - rho_s) / math.tan(g["gamma"]) if g["gamma"] > rho_s else 0.0
    T1_back = T2 / g["u"] * eta_rs
    T1_back_run = T2 / g["u"] * e["eta_rev"]
    return {... "T_brake": safety * max(T1_back, T1_back_run), "static_lock": eta_rs <= 0}
```
```
  holding default z1 2  T2 344 N m: eta_rev,static 0.414 -> back-drive T1 6.95 N m at rest, 13.89 N m running; brake >= 27.8 N m (x2)
  holding z1 1 (i 41)   T2 605 N m: eta_rev,static 0.000 -> back-drive T1 0.00 N m at rest, 9.78 N m running; brake >= 19.6 N m (x2) - statically self-locking
```
Hand (default): ρ_s = arctan(0.12/0.9397) = 7.28°; η'_static = tan 5.25°/tan 12.53° = 0.0919/0.2222 = 0.414;
T1,back = 344.4·0.414/20.5 = 6.95 N m ✓. Running back-drive is **larger** (13.9 N m) because running friction is lower.
**Size the brake on the running value**, which is the case of a load running on after the motor stops. For the 1-start
version the drive holds at rest, but once moving it needs 9.8 N m of braking. The brake (≥ 19.6 N m with factor 2,
check the applicable standard) is still required.

### 4.7 Forces from the normal force W
Let W be the tooth normal force at the pitch point. It lies in the normal section of the thread, inclined by α_n, and
the friction force μW acts along the thread. Resolve along the three axes. x is the worm axis = the tangential direction
of the wheel, t is the worm tangential direction = the wheel axis, and r is radial (common normal of the axes).

  F_t1 = W (cos α_n sin γ + μ cos γ)        (worm tangential = wheel axial F_a2)
  F_t2 = W (cos α_n cos γ − μ sin γ)        (wheel tangential = worm axial F_a1)
  F_r  = W sin α_n                          (radial, both members)                    (4.8)

Divide the first by the second. With μ = cos α_n · tan ρ':

  F_t1 / F_t2 = (sin γ + tan ρ' cos γ)/(cos γ − tan ρ' sin γ) = tan(γ + ρ')           (4.9)

  F_r = F_t2 · tan α_n · cos ρ' / cos(γ + ρ')                                         (4.10)

The torques fix F_t1 and F_t2:

  T1 = P1/ω1,  F_t1 = 2000 T1/d1,  T2 = T1 · i · η_z,  F_t2 = 2000 T2/d2              (4.11)

These two definitions are consistent with (4.9): F_t2/F_t1 = (i η_z d1)/d2 = η_z / tan γ = 1/tan(γ + ρ'). The self-test
checks all of (4.8)–(4.11).

```python
def forces(P, g=None, e=None):
    w1 = 2 * math.pi * P["n1_rpm"] / 60.0
    T1 = P["P1_kW"] * 1000.0 / w1
    T2 = T1 * g["u"] * e["eta_z"]
    Ft2 = 2000.0 * T2 / g["d2"]                      # = worm axial force
    Ft1 = Ft2 * math.tan(g["gamma"] + e["rho"])      # = wheel axial force
    Fr = Ft2 * math.tan(g["alpha_n"]) * math.cos(e["rho"]) / math.cos(g["gamma"] + e["rho"])
    Fn = Ft2 / (math.cos(g["alpha_n"]) * math.cos(g["gamma"]) - e["mu"] * math.sin(g["gamma"]))
```
```
- T1 19.76 N m, T2 344.4 N m; Ft1 = Fa2 1098 N, Ft2 = Fa1 4200 N, Fr 1579 N, Fn 4617 N; P2 2.551 kW
```
Hand: T1 = 3000/(2π·1450/60) = 3000/151.84 = 19.757 N m; F_t1 = 2·19 757/36 = 1097.6 N; T2 = 19.757·20.5·0.8503
= 344.4 N m; F_t2 = 2·344 400/164 = 4200 N; check F_t1/F_t2 = 0.2613 = tan 14.646° ✓.
F_r = 4200·0.36397·0.99932/0.96751 = 1579 N ✓.

**The striking result: the worm axial force (4200 N) is almost four times the worm tangential force (1098 N).** The worm
shaft is mainly a **thrust** problem. The locating bearing of the worm carries 4.2 kN axially at 1450 rpm, as the next
sections show.

### 4.8 Direction of the forces – hand and rotation
Rule for the worm (right hand). Curl the fingers of the **right hand** in the direction of worm rotation. The thumb
shows the **axial force on the worm** (the worm "screws itself" into the wheel and is pushed back). The wheel tooth at the
mesh moves the opposite way. Use the left hand for a left-hand worm.

```python
def axial_force_cases(P=None):
    for hand in ("right", "left"):
        for rot in ("cw", "ccw"):
            s = (1 if hand == "right" else -1) * (1 if rot == "cw" else -1)
            rows.append((hand, rot, s * F["Fa1"], "-x (towards the drive end)" if s > 0 else "+x (away from the drive end)"))
```
`python worm.py ch24`:
```
== Ch. 4 direction of forces (observer at the drive end, wheel above the worm)
  right hand, cw : axial force on the worm  +4200 N along x (away from the drive end); wheel tooth at the mesh moves -x (towards the drive end)
  right hand, ccw: axial force on the worm  -4200 N along x (towards the drive end); wheel tooth at the mesh moves +x (away from the drive end)
  left  hand, cw : axial force on the worm  -4200 N along x (towards the drive end); wheel tooth at the mesh moves +x (away from the drive end)
  left  hand, ccw: axial force on the worm  +4200 N along x (away from the drive end); wheel tooth at the mesh moves -x (towards the drive end)
```
(cw = clockwise as seen by an observer at the drive end looking along the worm.)

**Practical consequences:**
- A reversing drive (conveyor forward / back, gate open / close) loads **both** directions of the worm locating bearing.
  Both bearings of an adjusted pair see the full thrust in turn. Size the bearings for the worse direction and both duty
  shares.
- When the **wheel drives** (load lowering, braking), the force directions reverse again for the same rotation.
- On a gearbox with an output **hollow shaft**, the wheel axial force F_a2 (1098 N) changes direction with the rotation.
  The wheel locating bearing must take both.
- The contact pattern (chapter 7) moves slightly with load direction. A drive used mostly in one direction is
  bedded in for that direction.

### 4.9 Worm shaft reactions – the bearing hand-over (M3 → M4)
Model: worm between bearings A (x = 0, drive end) and B (x = l1), mesh in the middle, wheel above the worm (contact at
y = +d1/2). In the radial plane F_r pushes the worm downward (−y). The axial force F_a1 acting at the pitch radius adds
the moment M = F_a1 · d1/2. In the tangential plane F_t1 acts in the middle. Moments about A:

  R_B,y = F_r/2 + F_a1 d1 / (2 l1),   R_A,y = F_r/2 − F_a1 d1 / (2 l1),   R_A,z = R_B,z = F_t1/2     (4.12)

```python
def worm_shaft_reactions(P=None, l1=None):
    M = F["Fa1"] * g["d1"] / 2
    RAy, RBy = F["Fr"] / 2 - M / l1, F["Fr"] / 2 + M / l1
    RAz = RBz = F["Ft1"] / 2
    return {"F": F, "M_Nmm": M, "RA": math.hypot(RAy, RAz), "RB": math.hypot(RBy, RBz), ...}
```
```
== Ch. 4 worm shaft (l1 160 mm, mesh in the middle): M = Fa1 d1/2 = 75602 N mm
  radial plane RA 317, RB 1262 N; tangential plane 549 / 549 N -> RA 634 N, RB 1376 N; axial 4200 N
  cross-check shaft.reactions(): RAy -317.0 / RBy -1262.0 / RAz 548.8  vs  analytic 317.0 / 1262.0 / 548.8
```
Hand: M = 4200·18 = 75 602 N mm; M/l1 = 472.5 N; R_A,y = 789.5 − 472.5 = 317 N, R_B,y = 1262 N; R_z = 548.8 N;
R_B = √(1262² + 549²) = 1376 N ✓. The cross-check uses `shaft.reactions()` of M3 with the moment modelled as a force
couple. The signs differ only because shaft.py reports the reaction **on the shaft** with the opposite sign convention.
The magnitudes agree.

The moment from the axial force **doubles** the radial load of bearing B compared with F_r/2 alone (1262 vs 790 N).
Forgetting it is a classic design error.

### 4.10 Choosing the worm-shaft bearings – why steep tapered rollers
Four arrangements, each at n1 = 1450 rpm. The oil is VG 320 (typical worm-gear oil) at the sump temperature of chapter 5
(61.9 °C), with normal cleanliness. a_ISO uses bearing.py (M4).

1. **Fixed–floating with deep groove ball bearings**: 6305 at A takes all of F_a; 6305 at B floats.
2. **Adjusted pair of tapered roller bearings 30205 in X arrangement** (face to face, each carries thrust towards itself).
3. The same with the heavier **30305**.
4. The same with **steep-angle tapered rollers 31305** (contact angle ≈ 28–30°, e = 0.83, Y = 0.72), made for high
   thrust.

Induced axial forces of tapered rollers F_ad = 0.5 F_r / Y. In X arrangement with K_a pushing towards B (simplified
maker rule, same as M5b):

  if F_ad,A + K_a ≥ F_ad,B:  F_a,B = F_ad,A + K_a, F_a,A = F_ad,A;  otherwise F_a,A = F_ad,B − K_a, F_a,B = F_ad,B     (4.13)

```python
def _taper_pair_X(FrA, FrB, YA, YB, Ka):
    FadA, FadB = 0.5 * FrA / YA, 0.5 * FrB / YB
    if FadA + Ka >= FadB:
        return FadA, FadA + Ka
    return FadB - Ka, FadB

def worm_bearing_options(P=None, oil_VG=320, rel=90.0, cleanliness="normal cleanliness"):
    import bearing
    r = worm_shaft_reactions(P)
    theta = losses(P)["theta_S"]
    Pb = dict(bearing.DEFAULT, oil_VG=oil_VG, oil_temp_C=theta, reliability_pct=rel, cleanliness=cleanliness)
    ...
    res.append(("6305 locating + 6305 floating", life("6305", r["RA"], r["Fa"]), life("6305", r["RB"], 0.0)))
    for nm in ("30205", "30305", "31305"):
        Y = EXTRA_BEARINGS[nm]["Y"]
        FaA, FaB = _taper_pair_X(r["RA"], r["RB"], Y, Y, r["Fa"])
```
`python worm.py ch24`:
```
== Ch. 4 worm-shaft bearings, n 1450 rpm, oil VG 320 at 61.9 C (sump), normal cleanliness
  6305 locating + 6305 floating  A: Fr   634 Fa  4200 P  4945 L10h 1.22e+03 Lnmh 3.41e+03 | B: Fr  1376 Fa     0 P  1376 L10h 5.65e+04 Lnmh 1.78e+06 (kappa 5.51)
  30205 pair, X arrangement      A: Fr   634 Fa   198 P   634 L10h 5.76e+06 Lnmh 2.88e+08 | B: Fr  1376 Fa  4398 P  7588 L10h 1.47e+03 Lnmh 2.76e+03 (kappa 5.19)
  30305 pair, X arrangement      A: Fr   634 Fa   158 P   634 L10h 1.94e+07 Lnmh 9.71e+08 | B: Fr  1376 Fa  4359 P  9268 L10h 2.54e+03 Lnmh 4.78e+03 (kappa 5.51)
  31305 pair, X arrangement      A: Fr   634 Fa   440 P   634 L10h  9.7e+06 Lnmh 4.85e+08 | B: Fr  1376 Fa  4640 P  3891 L10h 2.29e+04 Lnmh 1.57e+05 (kappa 5.51)
```
Hand check of 31305 at B: F_ad,A = 0.5·634/0.72 = 440 N; F_a,B = 440 + 4200 = 4640 N; F_a/F_r = 3.37 > e 0.83 →
P = 0.4·1376 + 0.72·4640 = 3891 N; L10 = (38 000/3891)^(10/3) = 1990 Mrev → L10h = 1990·10⁶/(60·1450) = 22 900 h ✓.

**Reading the table – a typical worm-gearbox lesson:**
- The **standard tapered roller (30205, 30305) is worse** than one would expect. Its small contact angle gives a large
  Y (1.6–2.0), and Y multiplies the 4.4 kN thrust: P = 7.6–9.3 kN, L10h only 1500–2500 h. A bigger standard bearing does
  not help much.
- The **deep groove ball bearing** carrying 4.2 kN axially is overloaded (f0 F_a/C0 ≈ 4.3, L10h 1220 h) and would also
  run hot.
- The **steep-angle 31305** has Y = 0.72. The same thrust gives P = 3.9 kN and L10h ≈ 22 900 h, and with the good VG 320
  film (κ 5.5) L_nm far above the 25 000 h target. **This is why steep-angle tapered rollers (or a pair of 40° angular
  contact ball bearings, or a four-point bearing as locating bearing with a cylindrical roller as floating bearing) are the
  standard worm-shaft bearings.** The values of `EXTRA_BEARINGS` are typical catalogue data (**check** the maker's
  catalogue before use).
- The lightly loaded bearing A shows absurd modified lives (10⁸ h). a_ISO is capped at 50 and P is tiny. In reality the
  **minimum load** (about 0.02 C for rollers, check maker) and the preload decide its behaviour. Too little load lets the
  rollers skid. An adjusted pair with a light preload or a small axial clearance (typically 0–30 µm for worm shafts, check)
  keeps both rows loaded.
- For a **reversing** drive both A and B take 4.6 kN thrust in turn, so both must be 31305 (the adjusted pair is
  symmetrical anyway).

**Setting the axial clearance** of the adjusted pair is part of assembly (chapter 7). Too much clearance lets the worm
shift axially under the 4.2 kN reversal and the contact pattern wanders. Too much preload heats the bearings at 1450 rpm.
Worm shafts are set with shims under the bearing cover until the shaft just turns without play (measured with a dial
gauge, typical 0.01–0.03 mm end play, check).

### 4.11 Wheel shaft
Slow (n2 = 70.7 rpm), but carrying the large tangential force F_t2 = 4200 N. The axial force F_a2 = F_t1 = 1098 N acts
at the large radius d2/2 = 82 mm, so its moment (90 005 N mm) is larger than that on the worm:

```python
def wheel_shaft_reactions(P=None, l2=110.0):
    M = F["Fa2"] * g["d2"] / 2
    RCy, RDy = F["Fr"] / 2 - M / l2, F["Fr"] / 2 + M / l2
    RCz = RDz = F["Ft2"] / 2

def wheel_bearing_life(P=None, l2=110.0, name="6209", oil_VG=320):
    for side, Fr, Fa in (("C", r["RC"], 0.0), ("D", r["RD"], r["Fa"])):
        eq = bearing.equivalent_dynamic(b, Fr, Fa)
        ml = bearing.modified_life(b, eq["P"], r["n2"], Pb)
```
```
== Ch. 4 wheel shaft (l2 110 mm), T2 344 N m, n2 70.7 rpm, M = Fa2 d2/2 = 90005 N mm, 6209 fixed-floating
  C: Fr 2100, Fa 0, P 2100 N, L10h 1.1e+06 h, Lnmh 2.09e+06 h (kappa 0.61)
  D: Fr 2645, Fa 1098, P 3346 N, L10h 2.72e+05 h, Lnmh 3.17e+05 h (kappa 0.61)
```
Hand: M/l2 = 818 N; R_C,y = 789.5 − 818 = −29 N, R_D,y = 1608 N; R_z = 2100 N; R_D = √(1608² + 2100²) = 2645 N ✓.

- The wheel-shaft bearings are **not critical for life** at 70 rpm. They are chosen by the **shaft diameter** (torque
  344 N m and keyway or shrink disc → about 40–45 mm, M3) and by **stiffness**.
- κ = 0.61 < 1: at 70 rpm the oil film in the bearing is thin even with VG 320. Use additives (EP), or the bearing's
  a_ISO drops strongly with contamination. Here P/C is small enough that this does not matter.
- **Stiffness and accuracy matter more.** The wheel must stay central on the worm: axial play of the wheel shaft
  shifts the contact pattern sideways (chapter 7). Wheel-shaft locating bearings are often tapered rollers in O
  arrangement for that reason (30209 is in `EXTRA_BEARINGS` for comparison).

### 4.12 Summary of chapters 2–4 for the default stage
| Item | Value | Comment |
|---|---|---|
| Flank form, ratio | ZI, 41/2 = 20.5 | hunting-tooth ratio, ground worm |
| γ, α_x, d_b1 | 12.53°, 20.45°, 18.43 mm | ZI grinding wheel tangent to d_b1 |
| v_g | 2.80 m/s | nearly all surface speed is sliding |
| μ_z, ρ' | 0.0347, 2.12° | running; start-up μ ≈ 0.13 |
| η_z (worm / wheel driving) | 0.850 / 0.827 | not self-locking; start-up η ≈ 0.59 |
| Forces | F_t1 1098, F_a1 4200, F_r 1579 N | thrust dominates the worm shaft |
| Worm bearings | 31305 pair (X), L10h ≈ 22 900 h | standard tapered rollers fail (1500–2500 h) |
| Brake for holding | ≥ 27.8 N m at the worm (factor 2) | self-locking is not a brake |


---

## 5. Power losses, lubrication and heat balance

A worm gear is a **sliding** gear. In a spur or helical gear the flanks mostly roll; sliding is small and changes sign at
the pitch point. In a worm gear the worm thread slides along the wheel tooth at the full sliding velocity v_g, in the same
direction, everywhere in the mesh. The result:

- the mesh loses 5–30 % of the power as heat (spur gears lose only 1–2 %);
- the heat must leave through the housing, so **the oil temperature often limits the power**, not the tooth strength;
- the lubricant decides the friction, the wear and the life of the bronze wheel.

So chapter 5 comes before the strength checks of chapter 6. A worm gear that is strong enough but runs at 120 °C
fails in weeks: the oil oxidises, the seals harden, and the bronze wears or scuffs.

All results of this chapter: `python worm.py ch56` (the first part). The default drive is the example of chapter 1:
a 100 mm centre distance, i 20.5, ZI worm, CuSn12Ni2 wheel, 3 kW at 1450 rpm, mineral oil, fan on the worm shaft.

### 5.1 Where the power goes – the four loss groups

The input power P₁ splits into the output power P₂ and the loss P_V:

    P_V = P_Vz + P_VLP + P_VD + P_V0                     (5.1)

| Symbol | Loss | Depends on | How the program estimates it |
|---|---|---|---|
| P_Vz | Mesh (tooth friction) loss under load | μ_z, lead angle γ, load | P₁ (1 − η_z), η_z from chapter 4 |
| P_VLP | Bearing load loss | bearing forces, speed, bearing type | 1 % of P₁ for both shafts (check) |
| P_VD | Radial lip seals | shaft diameter, speed, seal material | 7.69·10⁻⁶ d² n per seal (W, d in mm, n in rpm, check) |
| P_V0 | No-load loss: churning and splashing of the oil, bearing no-load friction | oil level, viscosity, speed, worm position (below / above) | input value P_V0_W (default 40 W, **measure on the test stand**) |

**Mesh loss.** From chapter 4, with the worm driving:

    η_z = tan γ / tan(γ + ρ')          ρ' = arctan(μ_z / cos α_n)          (5.2)
    P_Vz = P₁ (1 − η_z)                                                     (5.3)

**Seal loss.** A radial lip seal presses a rubber lip on the shaft with a garter spring. The friction torque grows
with the diameter (lip length and lever arm) and the power with the speed, hence P ∝ d²·n. The constant 7.69·10⁻⁶
is a typical value for NBR seals with oil wetting (check the seal maker's diagram; FKM seals at high temperature can be
higher, PTFE seals lower).

**No-load loss.** With the worm *below* the wheel (the usual layout for v_g < 10 m/s) the worm dips in the oil and
churns it. This loss grows strongly with speed and viscosity and is best measured: run the gearbox without load, measure
input torque T₀ at operating temperature, then P_V0 = T₀ ω₁. Catalogue gearboxes at a = 100 mm show 20–80 W at
1450 rpm (check).

Code (`worm.py`):

```python
def losses(P, g=None, e=None):
    g = g or geometry(P)
    e = e or efficiency(P, g)
    P1 = P["P1_kW"] * 1000.0
    PVz = P1 * (1 - e["eta_z"])                      # mesh
    PVLP = 0.01 * P1                                 # bearings of both shafts (check)
    PVD = 7.69e-6 * (P["d_shaft1"] ** 2 * P["n1_rpm"] + P["d_shaft2"] ** 2 * g["n2_rpm"])   # radial lip seals (check)
    PV0 = P["P_V0_W"]
    PV = PVz + PVLP + PVD + PV0
    A = P["A_housing_m2"] or 9e-5 * P["a"] ** 1.85
    k = 28.0 if P["fan"] else 14.0                   # W/(m^2 K) (check)
    theta = P["theta_0"] + PV / (k * A)
    return {"PVz": PVz, "PVLP": PVLP, "PVD": PVD, "PV0": PV0, "PV": PV, "eta_total": (P1 - PV) / P1,
            "A": A, "k": k, "theta_S": theta, "ok": theta <= P["theta_lim"]}
```

The add-on of this chapter prints the breakdown as a table:

```python
def loss_breakdown(P):
    """Each loss in W and in % of the input power."""
    L = losses(P)
    P1 = P["P1_kW"] * 1000.0
    rows = [(n, L[k], 100.0 * L[k] / P1) for n, k in (("mesh (tooth friction)", "PVz"), ("bearings", "PVLP"),
                                                       ("seals", "PVD"), ("no-load (churning)", "PV0"), ("total", "PV"))]
    return rows, L
```

Command `python worm.py ch56`, real output:

```
== 5.1 Loss breakdown (default drive, 3.0 kW at 1450 rpm)
  mesh (tooth friction)      449.0 W  14.97 %
  bearings                    30.0 W   1.00 %
  seals                        9.8 W   0.33 %
  no-load (churning)          40.0 W   1.33 %
  total                      528.8 W  17.63 %
  total efficiency 0.8237
```

**Hand check.** η_z = 0.8503 (chapter 4) → P_Vz = 3000 (1 − 0.8503) = 449 W ✓.
Seals: n₂ = 1450 / 20.5 = 70.73 rpm;
7.69·10⁻⁶ (28²·1450 + 45²·70.73) = 7.69·10⁻⁶ (1 136 800 + 143 228) = 9.84 W ✓.
Sum 449 + 30 + 9.8 + 40 = 528.8 W; η_total = (3000 − 528.8)/3000 = 0.8237 ✓.

**Reading the result.** The mesh is 85 % of all losses. Every improvement of μ_z (better oil, smoother worm, higher
v_g) or of γ (more starts) acts directly on the heat. Seals and bearings are small; the no-load loss matters only at
part load: at 0.5 kW the same 40 W is 8 % of the input.

### 5.2 Heat balance – the oil sump temperature

In steady state all the loss heat leaves through the housing surface A by convection and radiation:

    P_V = k · A · (θ_S − θ₀)      →      θ_S = θ₀ + P_V / (k A)                    (5.4)

| Symbol | Meaning | Default |
|---|---|---|
| θ_S | oil sump temperature (steady) | result |
| θ₀ | ambient air temperature | 20 °C (use the real hall temperature, e.g. 35 °C in summer) |
| A | housing surface that is in contact with air, fins included | 9·10⁻⁵ a^1.85 m² (a in mm) – finned housing estimate, **check** |
| k | heat-transfer coefficient (convection + radiation) | 14 W/m²K still air, 28 W/m²K with a fan on the worm shaft (check) |

**Why k changes with the fan.** In still air the warm housing heats a thin air layer that rises slowly (free
convection, k ≈ 10–15 W/m²K including radiation). A fan cap on the worm shaft blows air along the fins (forced
convection); the air layer is thin and renewed all the time, k rises to 20–40 W/m²K depending on air speed and fin
design (check the gearbox maker). This is why almost every industrial worm gearbox with n₁ ≥ 1000 rpm has a fan cap.
At low input speed the fan is useless – the air speed is too low.

**Why the area formula has exponent 1.85.** For geometrically similar housings A grows with a²; housings of small
gearboxes are relatively bigger (bearing seats, flanges), so the fitted exponent is slightly below 2. The constant
9·10⁻⁵ gives 0.45 m² at a = 100, which is a finned cast housing about 250 × 220 × 260 mm. For your housing: measure
A from the CAD model (sum of all outer faces that see air; count fins with an efficiency of 0.7–0.9).

**Permissible temperature.** Mineral oil: θ_lim ≈ 90 °C (above, oxidation doubles every 10 K and NBR seals age);
polyglycol: 100–110 °C (check the oil and the seal material, FKM seals for > 100 °C).

The code is in `losses()` above (last four lines). The add-on prints θ_S over power, with and without fan:

```python
def temperature_curve(P, powers=(1.0, 2.0, 3.0, 4.0, 5.0, 6.0)):
    """Oil sump temperature vs input power (fan and no fan)."""
    out = []
    for p in powers:
        a = losses(dict(P, P1_kW=p, fan=True))
        b = losses(dict(P, P1_kW=p, fan=False))
        out.append((p, a["PV"], a["theta_S"], b["theta_S"]))
    return out
```

```
== 5.2 Oil sump temperature vs input power (A 0.451 m^2, ambient 20 C)
  P1 kW   P_V W   theta fan C   theta no fan C
    1.0     209       36.6          53.2
    2.0     369       49.2          78.5
    3.0     529       61.9         103.7
    4.0     688       74.5         129.0
    5.0     848       87.1         154.3
    6.0    1008       99.8         179.6
```

**Hand check at 3 kW with fan.** A = 9·10⁻⁵ · 100^1.85 = 9·10⁻⁵ · 5012 = 0.451 m²; kA = 28 · 0.451 = 12.63 W/K;
θ_S = 20 + 528.8 / 12.63 = 20 + 41.9 = 61.9 °C ✓. Without fan kA = 6.32 W/K → θ_S = 103.7 °C ✓ – **too hot**.

The same gearbox is fine with a fan and not acceptable without one. This is the most frequent design error in
worm drives: the tooth checks pass, the fan is forgotten (or the motor is a slow 6-pole motor, so the fan does nothing),
and the drive overheats.

**Thermal power limit.** `thermal_power_limit()` (chapter 4 code) finds by bisection the input power at which
θ_S = θ_lim. It is not simply proportional, because the no-load loss stays and η_z changes a little with load:

```python
def thermal_power_limit(P):
    """Input power at which the sump reaches theta_lim (bisection)."""
    lo, hi = 0.01, 200.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if losses(dict(P, P1_kW=mid))["theta_S"] > P["theta_lim"]:
            hi = mid
        else:
            lo = mid
    return lo
```

### 5.3 What you can do against heat – housing area and fan

```python
def housing_study(P, areas=(0.30, 0.451, 0.60, 0.80)):
    """Effect of housing surface (fins, larger housing) and fan on temperature and thermal limit."""
    out = []
    for A in areas:
        for fan in (False, True):
            Q = dict(P, A_housing_m2=A, fan=fan)
            out.append((A, fan, losses(Q)["theta_S"], thermal_power_limit(Q)))
    return out
```

```
== 5.3 Housing surface and fan -> temperature at 3 kW and thermal power limit
  A 0.300 m^2  fan False  theta  145.9 C   P_th  1.53 kW
  A 0.300 m^2  fan True   theta   83.0 C   P_th  3.37 kW
  A 0.451 m^2  fan False  theta  103.7 C   P_th  2.46 kW
  A 0.451 m^2  fan True   theta   61.9 C   P_th  5.22 kW
  A 0.600 m^2  fan False  theta   83.0 C   P_th  3.37 kW
  A 0.600 m^2  fan True   theta   51.5 C   P_th  7.05 kW
  A 0.800 m^2  fan False  theta   67.2 C   P_th  4.60 kW
  A 0.800 m^2  fan True   theta   43.6 C   P_th  9.51 kW
```

Measures in the order of cost (cheapest first):

| Measure | Effect | Remark |
|---|---|---|
| Fan cap on the worm shaft | k × 2 (at n₁ ≥ 1000 rpm) | needs free air inlet; check guard (EN ISO 13857) |
| Synthetic oil (polyglycol) | μ_z about −20 %, P_V −15 % | see 5.4: not compatible with mineral oil, paint, some seals |
| Clean housing, no cover | keeps k | dust layers and machine covers can halve k |
| Fins / larger housing | A × 1.3–2 | design change of the casting |
| More starts (larger γ) | η_z higher (chapter 4) | loses self-locking |
| Oil cooler / water cooling coil in the sump | removes 0.5–5 kW | for continuous duty near the limit |
| Next gearbox size | A ~ a^1.85, more mass | most robust, more cost |

### 5.4 Choice of lubricant – mineral oil or polyglycol

Worm gears use either **mineral oil with EP / friction-modifier additives** or **synthetic polyalkylene glycol
(PAG, "polyglycol")**. Polyalphaolefin (PAO) is also used but gives smaller friction gains in worm gears (check).

Why polyglycol helps:

- lower friction coefficient in mixed lubrication, about 20 % (in the program `mu_0T` × 0.8 – check the oil maker's data);
- higher viscosity index → the film stays thicker when hot;
- strongly lower wear of the bronze (the polar molecules form protective layers on the bronze) – J_W about 0.4× (check);
- longer oil life (about three times, 5.6).

Precautions (real failures in the field):

- **never mix** PAG with mineral oil: the mixture is not miscible, it forms a gel and blocks the lubrication;
  flush the gearbox when changing;
- PAG attacks some paints (inside paint of the housing) and some seal materials – use FKM or seals released for PAG;
- PAG is hygroscopic (takes water) – use a breather with a dryer in humid places;
- some sulphur-phosphorus EP additives attack bronze at high temperature (copper corrosion test, check the oil data sheet).

```python
def lubricant_compare(P):
    """Mineral vs polyglycol on the same drive."""
    out = {}
    for lub in ("mineral", "polyglycol"):
        R = capacity(dict(P, lubricant=lub))
        out[lub] = {"mu": R["e"]["mu"], "eta_z": R["e"]["eta_z"], "PV": R["L"]["PV"], "theta": R["L"]["theta_S"],
                    "SH": R["SH"], "SW": R["SW"], "Pth": thermal_power_limit(dict(P, lubricant=lub))}
    return out
```

```
== 5.4 Mineral oil vs polyglycol
  mineral    mu_z 0.0347  eta_z 0.8503  P_V   529 W  theta  61.9 C  S_H 1.66  S_W 2.04  P_th 5.23 kW
  polyglycol mu_z 0.0278  eta_z 0.8768  P_V   450 W  theta  55.6 C  S_H 1.53  S_W 5.02  P_th 6.26 kW
```

The thermal limit rises from 5.23 to 6.26 kW (+20 %) and the wear safety is 2.5 times higher. The pitting safety
falls slightly because the program uses Z_oil = 0.94 for polyglycol (6.2.4). This lubricant factor is a simplified
value – in the standards the oil influence on pitting depends on the oil type and is discussed differently in the
editions of DIN 3996 / ISO/TS 14521 (**check** before using it in a design).

### 5.5 Viscosity

The film between worm and wheel builds up hydrodynamically from the entrainment velocity. Low sliding velocity →
thin film → the oil must be thicker. Rough guide (mineral and polyglycol at the same ISO VG; check DIN 51509-1,
AGMA 9005 and the gearbox maker):

```python
VG_BY_VG = [  # sliding velocity up to (m/s), ISO VG mineral, ISO VG polyglycol - rough guide, check DIN 51509 / maker
    (1.0, 680, 680), (2.5, 460, 460), (5.0, 320, 320), (10.0, 220, 220), (15.0, 150, 150), (99.0, 100, 100)]

def viscosity_for_vg(vg):
    for v, m, pg in VG_BY_VG:
        if vg <= v:
            return m, pg
    return VG_BY_VG[-1][1:]
```

```
== 5.5 Viscosity for vg 2.80 m/s: ISO VG 320 (mineral) / VG 320 (polyglycol)  (check)
```

Too thick oil raises the churning loss P_V0 and the start-up torque; too thin oil raises wear and the risk of seizure.
At an ambient below 0 °C check the pour point and the start-up torque of the motor.

**Oil level.** Worm below: oil to the worm centre line (more oil only adds churning). Worm above (v_g > 10 m/s or
for space reasons): the wheel carries the oil up; the wheel must dip at least one tooth height (check maker).

### 5.6 Oil life and change interval

The oxidation rate of oil roughly doubles for every 10 K (Arrhenius rule; some makers use 15 K, check):

    t_change ≈ t_80 · 2^((80 − θ_S)/10)          t_80 = 5000 h mineral, 15000 h polyglycol (check)        (5.5)

```python
def oil_change_interval(theta, lubricant="mineral"):
    """Rule of thumb: base life at 80 C (mineral 5000 h, polyglycol 15000 h), halved for every +10 K (check maker)."""
    base = 5000.0 if lubricant == "mineral" else 15000.0
    return base * 2 ** ((80.0 - theta) / 10.0)
```

```
== 5.6 Oil-change interval vs sump temperature (rule of thumb, check)
   60 C : mineral  20000 h   polyglycol  60000 h
   70 C : mineral  10000 h   polyglycol  30000 h
   80 C : mineral   5000 h   polyglycol  15000 h
   90 C : mineral   2500 h   polyglycol   7500 h
  100 C : mineral   1250 h   polyglycol   3750 h
```

Our default runs at 62 °C → mineral oil about 17 500 h (change every 2 years in 2-shift duty). The first oil change
is done earlier (after 300–500 h) to remove the bronze particles of running-in. The bronze content of the oil
(spectrometric analysis, ppm Cu) is the best wear monitor in the factory: a rising trend means growing wear (chapter 7).

### 5.7 Intermittent duty

Many worm drives (lifting tables, gates, indexing) run only part of the time. The gearbox (oil + cast iron) has a
thermal mass m·c and heats with the time constant:

    τ = m c / (k A)                                                       (5.6)

With losses P_V during t_on and nothing during the pause (cycle t_c, duty factor ED = t_on / t_c), the first-order
model reaches a periodic steady state with the maximum rise

    Δθ_max = Δθ_cont · (1 − e^(−t_on/τ)) / (1 − e^(−t_c/τ))       Δθ_cont = P_V / (k A)          (5.7)

```python
def duty_cycle_temperature(P, ED=0.4, t_cycle_min=30.0, mass_kg=28.0, c_J_kgK=650.0):
    """Intermittent duty: losses only while running. First-order thermal model with time constant tau = m c /(k A).
    Returns steady continuous rise, periodic maximum rise and mean rise (housing + oil lumped mass - check)."""
    L = losses(P)
    kA = L["k"] * L["A"]
    tau = mass_kg * c_J_kgK / kA                      # s
    dT_cont = L["PV"] / kA
    t_on, t_c = ED * t_cycle_min * 60.0, t_cycle_min * 60.0
    dT_max = dT_cont * (1 - math.exp(-t_on / tau)) / (1 - math.exp(-t_c / tau))
    return {"tau_min": tau / 60.0, "dT_cont": dT_cont, "dT_max": dT_max, "dT_mean": ED * dT_cont,
            "theta_cont": P["theta_0"] + dT_cont, "theta_max": P["theta_0"] + dT_max}
```

```
== 5.7 Intermittent duty (cycle 30 min) at 4.5 kW
  ED 100 %: tau 24 min, continuous 80.8 C, periodic max 80.8 C, mean rise 60.8 K
  ED  60 %: tau 24 min, continuous 80.8 C, periodic max 65.0 C, mean rise 36.5 K
  ED  40 %: tau 24 min, continuous 80.8 C, periodic max 53.5 C, mean rise 24.3 K
  ED  25 %: tau 24 min, continuous 80.8 C, periodic max 42.9 C, mean rise 15.2 K
```

**Hand check ED 40 %.** τ = 28 · 650 / 12.63 = 1441 s = 24 min; t_on = 720 s, t_c = 1800 s;
(1 − e^(−0.50)) / (1 − e^(−1.25)) = 0.393 / 0.713 = 0.551; Δθ_max = 0.551 · 60.8 = 33.5 K → 53.5 °C ✓.

So a drive that would run at 81 °C in continuous duty stays at 54 °C at ED 40 %. **Caution:** this only helps if the
cycle is short compared with τ. One continuous run of 2 hours (τ × 5) reaches the full 81 °C. The tooth checks
(pitting, root) are not relieved by ED: the stress during the run is the same – only the life (load cycles) is shorter.
The mass 28 kg and c = 650 J/kgK (cast iron 500, oil 1900, weighted) are example values – check by a heating test.

### 5.8 Start-up – why the motor must be stronger than the running torque

At rest v_g = 0 and the film is gone: friction rises from μ_z ≈ 0.035 to μ_static ≈ 0.10–0.15. The friction curve
μ_0T(v_g) of chapter 4 shows the rise below 1 m/s:

```
  vg   0.0 m/s : mu_0T 0.1724
  vg   0.1 m/s : mu_0T 0.1209
  vg   0.5 m/s : mu_0T 0.0662
  vg   1.0 m/s : mu_0T 0.0500
  vg   2.8 m/s : mu_0T 0.0367
  vg   5.0 m/s : mu_0T 0.0330
  vg  10.0 m/s : mu_0T 0.0306
```

The start-up efficiency with ρ_s = arctan(μ_static / cos α_n):

    η_start = tan γ / tan(γ + ρ_s)            T₁,start = T₂ / (i η_start)                (5.8)

```python
def startup(P):
    """Start-up from rest: friction mu_static instead of the running value -> lower efficiency, higher worm torque."""
    g, e = geometry(P), efficiency(P)
    F = forces(P, g, e)
    rs = math.atan(P["mu_static"] / math.cos(g["alpha_n"]))
    eta_s = math.tan(g["gamma"]) / math.tan(g["gamma"] + rs)
    T1_start = F["T2"] / (g["u"] * eta_s)            # worm torque needed to give the running output torque from rest
    return {"mu_run": e["mu"], "eta_run": e["eta_z"], "mu_static": P["mu_static"], "eta_start": eta_s,
            "T1_run": F["T1"], "T1_start": T1_start, "ratio": T1_start / F["T1"]}
```

```
== 5.8 Start-up from rest: mu 0.035 -> 0.120, eta 0.850 -> 0.617, worm torque 19.76 -> 27.23 N m (x 1.38)
```

**Hand check.** ρ_s = arctan(0.12 / 0.9397) = 7.28°; η_start = tan 12.53° / tan 19.81° = 0.2222 / 0.3601 = 0.617 ✓.
T₁,start = 19.76 · 0.850 / 0.617 = 27.2 N m ✓.

The motor must deliver 1.38 × the running torque at start (plus acceleration torque). A 4-pole IE3 motor has a
starting torque of 2–3 × T_N, so a 3 kW motor is enough; with a frequency inverter set the current limit and the
starting boost accordingly. For a 1-start worm (γ 6.3°) the ratio is larger (1.63, run `startup()` with z1 = 1) –
gearbox makers give separate "start-up efficiency" values in the catalogue for this reason.

---

## 6. Load capacity in the style of ISO/TS 14521 / DIN 3996 (pitting, wear, tooth root, deflection, temperature)

### 6.0 The failure modes – what we are protecting against

The worm (case-hardened steel, 58–62 HRC, ground) is much harder than the wheel (bronze, 90–110 HB). Almost all damage
happens on the **wheel**. The standards ISO/TS 14521 and DIN 3996 therefore check five things:

| Failure | What you see | Physics | Check |
|---|---|---|---|
| **Pitting** of the bronze | small craters on the wheel flanks, first near the exit side of the mesh, grey spots growing to a band | surface fatigue under repeated Hertzian stress; in bronze the pits can stop growing ("progressive" vs "non-progressive" pitting) | S_H = σ_HG / σ_Hm (6.2) |
| **Wear** | flank becomes thinner, profile shape changes, backlash grows; bronze particles in the oil (oil goes gold / brown) | abrasive and adhesive mixed-lubrication wear; grows with the sliding path | S_W = δ_Wlim / δ_W (6.3) |
| **Tooth breakage** of the wheel | tooth breaks at the root, usually after wear has thinned it | bending fatigue / overload of the bronze tooth | S_F = τ_Flim / τ_F, new and worn (6.4) |
| **Worm deflection** | contact pattern moves, edge loading, noise, local pitting | the slender worm shaft bends under F_t1 and F_r | S_δ = δ_lim / δ_m (6.5) |
| **Seizure / scuffing**, overheating | smeared bronze on the worm thread, sudden temperature rise, rapid wear | film breaks down at too high temperature or too low viscosity | θ_S ≤ θ_lim (5.2, 6.6) |

The "method B" of the standards (used here in a simplified form) gives formulas; method A means a test or an FEM / TCA
analysis of the real gear set. Method C is a quick estimate. **All factor values below are simplified – check them in
ISO/TS 14521 (2020) / DIN 3996 (2019).**

Results: `python worm.py run` (main report) and `python worm.py ch56` (part 6).

### 6.1 The reduced modulus E_red

The bronze is softer *and* more elastic than steel. Both bodies flatten in the contact; the combined stiffness is

    E_red = 2 / [ (1 − ν₁²)/E₁ + (1 − ν₂²)/E₂ ]                               (6.1)

```python
def E_red(mat):
    return 2.0 / ((1 - WORM_NU ** 2) / WORM_E + (1 - mat["nu"] ** 2) / mat["E"])
```

**Hand check.** Steel 210 000 / 0.30, CuSn12Ni2 98 100 / 0.35:
(0.91 / 210 000) + (0.8775 / 98 100) = 4.333·10⁻⁶ + 8.945·10⁻⁶ = 13.28·10⁻⁶ → E_red = 150 622 MPa ✓ (program: 150622).

Note the definition: this E_red (with the factor 2) is the one used in DIN 3996, not the E* of Hertz theory
(E* = E_red / 2). Do not mix formulas from different books.

### 6.2 Pitting

#### 6.2.1 Mean contact stress

The contact line between a worm and a wheel is a curved line that moves across the wheel flank; the local Hertzian stress
varies along it. The standard replaces the whole field by a **mean** contact stress, with a dimensionless parameter
p*_m that comes from many contact analyses:

    σ_Hm = (4/π) · √( p*_m · T₂ · 10³ · E_red / a³ )        [MPa; T₂ in N m, a in mm, E_red in MPa]      (6.2)

Physically: σ_H ∝ √(load · E / curvature²). The load is T₂/a (force at the wheel), the size of the contact grows
with a, hence a³ under the root. **Pitting capacity grows with a^1.5**: doubling the centre distance gives 2.8 × the
torque at the same stress.

**p*_m** collects the geometry (ZI worm, DIN 3996 method B style approximation, check):

    p*_m = 1.03 [0.4 + x₂/u + 0.01 z₂ − 0.083 b₂/m_x + √q / 6.9 + (q + 50(u+1)/u) / (15.9 + 37.5 q)]     (6.3)

What the terms say: a wider wheel (b₂/m_x) spreads the load → p*_m smaller; a thick worm (large q) makes the
contact more conforming in one direction but raises the term √q; positive x₂ moves the contact to a less favourable
zone of the wheel. Typical values 0.8–1.1.

```python
def p_star_m(P, g):
    """Mean dimensionless contact stress parameter for ZI worms (DIN 3996 method B style approximation, check)."""
    q, u, x2, z2, mx = g["q"], g["u"], g["x2"], P["z2"], P["mx"]
    return 1.03 * (0.4 + x2 / u + 0.01 * z2 - 0.083 * P["b2"] / mx + math.sqrt(q) / 6.9 + (q + 50 * (u + 1) / u) / (15.9 + 37.5 * q))
```

**Hand check of p*_m.** q = 9, u = 20.5, x₂ = 0, z₂ = 41, b₂/m_x = 7:
0.4 + 0 + 0.41 − 0.581 + 3/6.9 + (9 + 52.44)/(15.9 + 337.5) = 0.4 + 0.41 − 0.581 + 0.4348 + 0.1739 = 0.8377;
× 1.03 = 0.863 ✓.

**Hand check of σ_Hm.** T₂ = 344.4 N m (chapter 4, K_A = 1):
p*_m T₂ 10³ E_red / a³ = 0.863 · 344 400 · 150 622 / 10⁶ = 44 767 → √ = 211.6 → × 4/π = **269.4 MPa** ✓.

#### 6.2.2 Permissible stress and factors

    σ_HG = σ_Hlim · Z_N · Z_v · Z_S · Z_oil                                   (6.4)
    S_H = σ_HG / σ_Hm ≥ S_Hmin (1.0)

| Factor | Formula (program) | Physics |
|---|---|---|
| σ_Hlim | material table (520 MPa CuSn12Ni2-C-GZ, check) | pitting endurance of the bronze at the reference conditions (25 000 h, v_g ≈ 1 m/s, mineral oil) |
| Z_N | (25 000 / L_h)^(1/6) ≤ 1.6 | life factor: shorter life → higher permitted stress (the Wöhler line of bronze pitting has a slope of about 6) |
| Z_v | √(5 / (4 + v_g)) | velocity factor: higher sliding velocity → more frictional heat in the contact, lower surface strength of the bronze |
| Z_S | √(3000 / (2900 + a)) | size factor: larger gears, larger stressed volume, more defects (pores) in the casting |
| Z_oil | 1.0 mineral, 0.94 polyglycol in this program (check) | lubricant factor |

```python
    pm = p_star_m(P, g)
    sHm = 4 / math.pi * math.sqrt(pm * T2 * 1000.0 * Er / P["a"] ** 3)
    ZN = min((25000.0 / P["Lh"]) ** (1 / 6.0), 1.6)
    Zv = math.sqrt(5.0 / (4.0 + g["vg"]))
    ZS = math.sqrt(3000.0 / (2900.0 + P["a"]))
    Zoil = 1.0 if P["lubricant"] == "mineral" else 0.94
    sHG = mat["sHlim"] * ZN * Zv * ZS * Zoil
    SH = sHG / sHm
```

The add-on shows each factor:

```python
def pitting_breakdown(P):
    R = capacity(P)
    F = R["F"]
    mat = WHEEL_MATERIALS[P["wheel_material"]]
    return {"T2": F["T2"] * P["KA"], "p_star_m": R["p_star_m"], "E_red": R["E_red"], "a": P["a"], "sHm": R["sHm"],
            "sHlim": mat["sHlim"], "ZN": R["ZN"], "Zv": R["Zv"], "ZS": R["ZS"], "Zoil": R["Zoil"], "sHG": R["sHG"], "SH": R["SH"]}
```

```
== 6.1 Pitting factor breakdown
  T2 344.4 N m, p*_m 0.863, E_red 150622 MPa, a 100 mm -> sigma_Hm 269.4 MPa
  sigma_Hlim 520 x Z_N 1.000 x Z_v 0.858 x Z_S 1.000 x Z_oil 1.00 = sigma_HG 445.9 MPa -> S_H 1.655
```

**Hand check.** Z_v = √(5 / 6.80) = 0.8575; Z_S = √(3000 / 3000) = 1.000; Z_N = 1 (L_h = 25 000 h);
σ_HG = 520 · 0.8575 = 445.9 MPa; S_H = 445.9 / 269.4 = 1.655 ✓.

**Why S_Hmin is only 1.0.** Pitting in bronze is usually not a sudden failure: the pits grow slowly and often stop
after running-in (the load spreads over a larger flank area). The standard therefore accepts S_H = 1. But **pitted area
also means more wear particles**, so check the oil and the pitted area on inspection (limit often 30–50 % of the
active flank – maker / customer agreement, check).

### 6.3 Wear

Wear of the bronze is the normal life-limiting process of a worm gear in good condition. It grows with the
**sliding path** that the wheel flank sees and with the contact pressure.

#### 6.3.1 Sliding path

Number of load cycles of one wheel tooth (one contact per wheel revolution):

    N_L = n₂ · 60 · L_h                                                       (6.5)

Mean sliding path of a wheel flank point during the life:

    s_Wm = σ_Hm · a · N_L · s* / E_red        [mm]                            (6.6)
    s* = 0.78 + 0.21 u + 5.6 / tan γ          (DIN 3996 style, check)          (6.7)

Physical meaning of (6.6): σ_Hm · a / E_red is proportional to the width of the Hertzian contact band – the distance
the worm thread slides over one point of the wheel while that point is inside the contact. s* corrects for the
geometry: a small lead angle γ means the thread slides a long way along the tooth for each contact (5.6 / tan γ
dominates: 25.2 of 30.3 here). So **1-start worms wear faster** per load cycle.

#### 6.3.2 Wear intensity and wear depth

    δ_W = J_W · s_Wm,          J_W = J_0 · W_ML                              (6.8)

J_W is a dimensionless wear coefficient: mm of flank depth per mm of sliding path. In the standards it comes from a
lubricant-film parameter (minimum film thickness from EHL theory, oil type, viscosity) and test results. **This program
uses typical values** (case-hardened ground worm, CuSn12Ni2): J_0 = 1.0·10⁻⁹ mineral oil, 4.0·10⁻¹⁰ polyglycol, and
a material factor W_ML (1.0 CuSn12Ni2, 1.6 CuSn12-GZ, 2.0 sand cast, 2.5 aluminium bronze, 1.5 GJS – check). Real
J_W values spread by a factor of 3 or more with oil and running-in; a test is the only reliable method (method A).

#### 6.3.3 Wear limit

A worn wheel tooth is thinner. The standard limits the wear by several criteria – tooth tip becomes pointed, backlash
becomes too large (positioning drives!), or tooth root gets too weak. This program uses the common tooth-thinning
limit

    δ_Wlim = 0.3 · m_x · cos γ                (check; for positioning drives use the backlash limit instead)  (6.9)
    S_W = δ_Wlim / δ_W ≥ S_Wmin (1.1)

```python
    NL = g["n2_rpm"] * 60.0 * P["Lh"]
    ss = s_star(g)
    sWm = sHm * P["a"] * NL * ss / Er                 # mean sliding path mm
    JW = (P["J_W"] or J_W_TYPICAL[P["lubricant"]]) * mat["WML"]
    dW = JW * sWm                                     # normal flank wear mm
    dWlim = 0.3 * P["mx"] * math.cos(g["gamma"])      # permissible wear (tooth thinning, check)
    SW = dWlim / dW
```

**Hand check.** N_L = 70.73 · 60 · 25 000 = 1.061·10⁸.
s* = 0.78 + 0.21 · 20.5 + 5.6 / 0.2222 = 0.78 + 4.305 + 25.20 = 30.29.
s_Wm = 269.4 · 100 · 1.061·10⁸ · 30.29 / 150 622 = 5.75·10⁸ mm (575 km of sliding!).
δ_W = 10⁻⁹ · 5.75·10⁸ = 0.575 mm; δ_Wlim = 0.3 · 4 · 0.9762 = 1.171 mm; S_W = 2.04 ✓ (report: wear 0.575, S_W 2.04).

#### 6.3.4 Wear rate and life

Wear grows linearly with time (constant load) – this gives a simple life prediction and a monitoring value:

```python
def wear_life(P):
    """Wear grows linearly with load cycles -> wear rate and hours until the wear limit."""
    R = capacity(P)
    rate = R["dW"] / P["Lh"] * 1000.0                # mm per 1000 h
    return {"dW": R["dW"], "dWlim": R["dWlim"], "rate_mm_1000h": rate, "h_to_limit": R["dWlim"] / rate * 1000.0,
            "SW": R["SW"]}
```

```
== 6.2 Wear life: wear 0.575 mm in 25000 h -> 0.0230 mm / 1000 h; limit 1.171 mm reached after 50965 h (S_W 2.04)
```

In the factory: measure the backlash at the output shaft (dial gauge on a lever, worm locked) at commissioning and every
year. Circumferential backlash grows by about 2 δ_W / cos α (both flanks if the drive reverses; one flank if it runs one
way). A rate clearly above the predicted 23 µm / 1000 h means wrong oil, too high temperature, or a contaminated oil.

Note that **running-in** wear (first 100–500 h) is higher than this steady rate; it is wanted (it creates the
contact pattern, chapter 7) and is the reason for the early first oil change.

### 6.4 Tooth root of the wheel – new and worn

The bronze wheel tooth is a short, wide cantilever. The standard uses a **shear-stress** formulation:

    τ_F = F_t2 / (b₂R · m_x) · Y_ε · Y_F · Y_γ ≤ τ_Flim / S_Fmin              (6.10)

| Factor | Program | Physics |
|---|---|---|
| F_t2 | 2000 T₂ / d₂ (× K_A) | tangential force at the wheel = axial force of the worm |
| b₂R | d_a1 · arcsin(b₂ / d_a1) | the wheel tooth is curved around the worm: its length is the **arc** on the worm tip cylinder, longer than b₂ |
| Y_ε | 0.5 | load sharing: on average about two teeth carry the load (contact ratio ≈ 2) |
| Y_F | 2.9 m_x / s_ft2 | form factor: thicker root chord s_ft2 → lower stress |
| Y_γ | 1 / cos γ | lead-angle factor: the force acts in the normal section, the tooth is inclined by γ |
| τ_Flim | material table (100 MPa CuSn12Ni2-GZ, check) | shear fatigue strength of the bronze tooth |

The root chord in the rack approximation (in the worm's axial section the wheel teeth look like a rack meshing with the
worm thread):

    s₂ = m_x (π/2 + 2 x₂ tan α_x) − j_t          s_ft2 = s₂ + 2 h_f2 tan α_x                    (6.11)
    s_ft2,worn = s_ft2 − δ_W / cos γ

```python
    hf2 = (P["haP"] + P["cP"] - g["x2"]) * P["mx"]
    s2 = P["mx"] * (math.pi / 2 + 2 * g["x2"] * math.tan(g["alpha_x"])) - P["jt_um"] / 1000.0
    sft2 = s2 + 2 * hf2 * math.tan(g["alpha_x"])      # rack approximation of the root chord
    sft2_worn = sft2 - dW / math.cos(g["gamma"])
    b2R = g["da1"] * math.asin(min(P["b2"] / g["da1"], 1.0))       # arc length of the wheel on the worm tip cylinder
    Ft2 = F["Ft2"] * P["KA"]
    Yeps, Ygam = 0.5, 1 / math.cos(g["gamma"])
    YF_new, YF_worn = 2.9 * P["mx"] / sft2, 2.9 * P["mx"] / sft2_worn
    tF = Ft2 / (b2R * P["mx"]) * Yeps * YF_new * Ygam
    tF_worn = Ft2 / (b2R * P["mx"]) * Yeps * YF_worn * Ygam
    SF = mat["tFlim"] / tF
    SF_worn = mat["tFlim"] / tF_worn
```

**Hand check.** α_x = 20.448°, tan = 0.37293; h_f2 = 1.2 · 4 = 4.8 mm; s₂ = 6.2832 − 0.120 = 6.1632 mm;
s_ft2 = 6.1632 + 2 · 4.8 · 0.37293 = 9.743 mm ✓; Y_F = 11.6 / 9.743 = 1.191.
b₂R = 44 · arcsin(28/44) = 44 · 0.6899 = 30.35 mm; F_t2 = 2000 · 344.4 / 164 = 4200 N.
τ_F = 4200 / (30.35 · 4) · 0.5 · 1.191 · 1.0244 = 34.59 · 0.610 = 21.10 MPa ✓; S_F = 100 / 21.10 = 4.74 ✓.

**Why the worn tooth matters.** At the end of life the flanks have lost δ_W on each side. The add-on follows the root
safety down to the wear limit:

```python
def worn_root_curve(P, fractions=(0.0, 0.25, 0.5, 0.75, 1.0)):
    """Root safety as the wheel teeth wear down to the wear limit (fraction of delta_Wlim)."""
    R = capacity(P)
    g = R["g"]
    out = []
    for fr in fractions:
        s = R["sft2"] - fr * R["dWlim"] / math.cos(g["gamma"])
        YF = 2.9 * P["mx"] / s
        tF = R["F"]["Ft2"] * P["KA"] / (R["b2R"] * P["mx"]) * 0.5 * YF / math.cos(g["gamma"])
        out.append((fr, fr * R["dWlim"], s, YF, tF, WHEEL_MATERIALS[P["wheel_material"]]["tFlim"] / tF))
    return out
```

```
== 6.3 Tooth root while the wheel wears
  wear fraction  wear mm  s_ft2 mm   Y_F    tau_F MPa   S_F
        0.00     0.000     9.743   1.191     21.10    4.74
        0.25     0.293     9.443   1.228     21.77    4.59
        0.50     0.586     9.143   1.269     22.48    4.45
        0.75     0.879     8.843   1.312     23.25    4.30
        1.00     1.171     8.543   1.358     24.06    4.16
```

With m_x = 4 the root is far from critical (S_F 4.2 even at the wear limit). The root becomes decisive for **small
modules with high torque**, shock loads (K_A ≥ 1.5, blocking of the driven machine), and for **slow hand-operated or
self-locking drives**, where a blocked output puts the full motor stall torque on one or two teeth. Then check the
static case with the stall torque against the 0.2 %-yield shear strength of the bronze (≈ 0.6 · R_p0.2, check).

### 6.5 Worm-shaft deflection

The worm is a slender shaft (root diameter d_f1 = 26.4 mm) between two bearings, loaded in the middle by the
tangential force F_t1 and the radial force F_r (the axial force F_a1 goes to the locating bearing and does not bend the
shaft). With simple supports:

    δ_m = l₁³ · √(F_t1² + F_r²) / (48 E I),      I = π d_f1⁴ / 64               (6.12)
    δ_lim = 0.01 · m_x       (typical, check DIN 3996),      S_δ = δ_lim / δ_m ≥ 1

Why it matters: the worm bends away from the wheel and twists the line of contact; the contact pattern (chapter 7)
moves out of the middle, the load concentrates at one end of the wheel tooth, local pitting and noise follow. The
bending also changes the effective centre distance and the backlash.

```python
    I = math.pi * g["df1"] ** 4 / 64.0
    dm = P["l1"] ** 3 * math.hypot(F["Ft1"], F["Fr"]) / (48.0 * WORM_E * I)
    dlim = 0.01 * P["mx"]
    Sd = dlim / dm
```

**Hand check.** I = π · 26.4⁴ / 64 = 23 848 mm⁴; F = √(1098² + 1579²) = 1923 N;
δ_m = 160³ · 1923 / (48 · 210 000 · 23 848) = 7.877·10⁹ / 2.404·10¹¹ = 0.0328 mm ✓; δ_lim = 0.040 mm → S_δ = 1.22 ✓.

Using d_f1 is conservative (the thread adds stiffness; DIN 3996 uses a slightly larger equivalent diameter, check).
Simple supports are also conservative for a pair of taper roller bearings; but the bearing elasticity and the housing
add deflection, so the simple formula is a reasonable design value.

The l₁³ term makes the bearing spread the strongest lever:

```python
def deflection_study(P, l1s=(120.0, 140.0, 160.0, 180.0, 200.0), d1s=(32.0, 36.0, 40.0)):
    """Worm deflection safety vs bearing spread l1 and worm diameter d1 (a fixed: x2 changes with d1)."""
    out = []
    for d1 in d1s:
        for l1 in l1s:
            R = capacity(dict(P, d1=d1, l1=l1))
            out.append((d1, l1, R["g"]["x2"], R["delta_m"], R["Sd"], R["e"]["eta_z"], R["SH"]))
    return out
```

```
== 6.4 Worm deflection vs worm diameter and bearing spread
  d1 mm  l1 mm   x2      delta mm  S_delta  eta_z   S_H
     32    120  +0.500    0.0281    1.42  0.8600   1.67
     32    140  +0.500    0.0447    0.90  0.8600   1.67
     32    160  +0.500    0.0667    0.60  0.8600   1.67
     32    180  +0.500    0.0950    0.42  0.8600   1.67
     32    200  +0.500    0.1303    0.31  0.8600   1.67
     36    120  +0.000    0.0138    2.89  0.8503   1.66
     36    140  +0.000    0.0220    1.82  0.8503   1.66
     36    160  +0.000    0.0328    1.22  0.8503   1.66
     36    180  +0.000    0.0467    0.86  0.8503   1.66
     36    200  +0.000    0.0640    0.62  0.8503   1.66
     40    120  -0.500    0.0075    5.32  0.8407   1.64
     40    140  -0.500    0.0119    3.35  0.8407   1.64
     40    160  -0.500    0.0178    2.24  0.8407   1.64
     40    180  -0.500    0.0254    1.58  0.8407   1.64
     40    200  -0.500    0.0348    1.15  0.8407   1.64
```

**Design conflict.** A thinner worm (d₁ 32) has a larger lead angle → higher efficiency (0.860), but bends 2.4 times
more. A thicker worm (d₁ 40) is stiff, but less efficient (0.841) and needs x₂ = −0.5 at the same centre distance. The
choice d₁ = 36 (q = 9) with a short bearing spread (≤ 140 mm, taper roller bearings close to the thread) is the usual
compromise. The wheel side is stiff and uncritical.

### 6.6 Temperature safety

The heat balance of chapter 5 gives θ_S; the program reports S_T = θ_lim / θ_S (1.45 for the default). This is only
an indicator – the real criterion is θ_S ≤ θ_lim, and an additional margin of 10 K is good practice for hot halls.
Above θ_lim the oil film gets thin, μ rises, the losses rise, the temperature rises further – a **thermal runaway**
that ends in scuffing (bronze smeared on the worm) within minutes to hours.

### 6.7 Safety summary and the limiting criterion

```python
def safety_summary(P):
    R = capacity(P)
    return [("pitting S_H", R["SH"], P["SHmin"]), ("wear S_W", R["SW"], P["SWmin"]), ("root (new) S_F", R["SF"], P["SFmin"]),
            ("root (worn) S_F", R["SF_worn"], P["SFmin"]), ("deflection S_delta", R["Sd"], P["Sdmin"]),
            ("temperature theta_lim / theta_S", R["ST"], 1.0)]
```

```
== 6.5 Safety summary (default drive)
  pitting S_H                        1.66  (min 1.00)  OK
  wear S_W                           2.04  (min 1.10)  OK
  root (new) S_F                     4.74  (min 1.10)  OK
  root (worn) S_F                    4.45  (min 1.10)  OK
  deflection S_delta                 1.22  (min 1.00)  OK
  temperature theta_lim / theta_S    1.45  (min 1.00)  OK
```

Safeties of different criteria cannot be compared directly: σ_H grows with √T, wear with √T, root and deflection with
T, losses roughly with P. The honest comparison is the **power at which each criterion reaches its limit**:

```python
def _bisect(P, ok_fn, lo=0.01, hi=100.0):
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if ok_fn(dict(P, P1_kW=mid)):
            lo = mid
        else:
            hi = mid
    return lo

def max_power_criteria(P):
    """Highest input power for each criterion alone -> the smallest one limits the drive."""
    crit = {
        "pitting": lambda Q: capacity(Q)["SH"] >= Q["SHmin"],
        "wear": lambda Q: capacity(Q)["SW"] >= Q["SWmin"],
        "root (worn)": lambda Q: capacity(Q)["SF_worn"] >= Q["SFmin"],
        "deflection": lambda Q: capacity(Q)["Sd"] >= Q["Sdmin"],
        "thermal": lambda Q: losses(Q)["theta_S"] <= Q["theta_lim"],
    }
    res = {k: _bisect(P, f) for k, f in crit.items()}
    lim = min(res, key=res.get)
    return res, lim
```

```
== 6.6 Maximum input power for each criterion
  pitting        8.22 kW
  wear          10.30 kW
  root (worn)   11.40 kW
  deflection     3.66 kW   <- limits
  thermal        5.23 kW
```

**Check of the deflection value.** Deflection is linear in the load: 3.0 kW × S_δ 1.22 = 3.66 kW ✓. Pitting:
σ_Hm ∝ √P (η nearly constant) → 3.0 × 1.655² = 8.2 kW ✓.

**Finding.** In this example the **worm deflection** limits the drive to 3.66 kW, then the **heat** (5.23 kW). The
tooth checks have large reserves. This is typical: in industrial worm gears the heat and the worm stiffness usually
decide, not the tooth strength. The direct remedies: bearing spread 140 mm (S_δ 1.82 → about 5.5 kW) and the fan; the
drive could then carry about 5 kW, limited by heat. With the default l₁ = 160 mm, running the gearbox at its thermal
limit would push the worm deflection above the limit and spoil the contact pattern.

### 6.8 Wheel material – bronze metallurgy for the designer

**Why a steel worm and a bronze wheel.** The pair works in permanent sliding. Two hard steels in sliding contact weld
locally (adhesion) and scuff. A soft, low-melting partner with a different crystal structure (copper-tin) does not
weld easily to steel, embeds hard particles, and runs in to a conforming contact. The worm must be hard and very smooth
(it is the "file" – a rough worm grinds the bronze away). Hence: worm 16MnCr5 / 20MnCr5 case hardened 58–62 HRC,
ground R_a ≤ 0.5 µm; wheel rim bronze, on a cast-iron or steel hub (shrink fit + screws or cast-on rim).

**Tin bronze CuSn12(Ni2).** About 12 % tin: the structure has a soft α-copper matrix with hard δ-phase islands
(Cu₃₁Sn₈). The δ-phase carries the load, the α-matrix gives toughness and embeds particles. Phosphorus (0.05–0.4 %)
deoxidises the melt (fewer pores) and forms hard Cu₃P. **Nickel** (1.5–2.5 %) refines the grain, distributes the
δ-phase more finely and raises strength and wear resistance – the standard material for high-duty wheels.

**Casting method** (the second letter group of the EN 1982 name):

| Code | Method | Structure | Use |
|---|---|---|---|
| GS | sand casting | slow cooling → coarse grain, porosity, segregation | large single wheels, low duty |
| GM | permanent mould (chill) | finer grain | small series |
| GZ | centrifugal casting | dense, fine-grained rim (impurities go inwards and are machined off) | **standard for worm wheel rims** |
| GC | continuous casting | fine and uniform, as bars / tubes | small wheels made from tube |

The same alloy, sand cast instead of centrifugal cast, loses about 25 % in pitting strength and wears twice as fast in
our value set (W_ML 2.0 vs 1.0 in the table, check).

**Aluminium bronze CuAl10Fe5Ni5.** Very strong (high σ_Hlim, τ_Flim), but it has poorer sliding properties: higher
friction, sensitivity to scuffing, and higher wear unless the worm is very hard and very smooth and the oil viscosity is
high. Use for slow, heavily loaded, shock-loaded drives.

**Ductile iron EN-GJS-400-15.** Cheap and strong, for low sliding velocities (hand drives, slow adjusters; v_g ≲ 2 m/s,
check). Poor emergency-running behaviour.

```python
def material_study(P):
    out = []
    for m in WHEEL_MATERIALS:
        R = capacity(dict(P, wheel_material=m))
        res, lim = max_power_criteria(dict(P, wheel_material=m))
        out.append((m, R["E_red"], R["SH"], R["SW"], R["SF_worn"], R["e"]["eta_z"], res[lim], lim))
    return out
```

```
== 6.7 Wheel material study (same drive, 3 kW)
  CuSn12Ni2-C-GZ (centrifugal cast tin bronze)   E_red 150622  S_H 1.66  S_W 2.04  S_F worn 4.45  eta 0.850  P_max  3.66 kW (deflection)
  CuSn12-C-GZ (centrifugal cast tin bronze)      E_red 140144  S_H 1.40  S_W 1.23  S_F worn 3.92  eta 0.850  P_max  3.66 kW (deflection)
  CuSn12-C-GS (sand cast tin bronze)             E_red 140144  S_H 1.33  S_W 0.99  S_F worn 3.43  eta 0.844  P_max  2.41 kW (wear)
  CuAl10Fe5Ni5-C-GZ (aluminium bronze)           E_red 174053  S_H 1.97  S_W 0.88  S_F worn 5.30  eta 0.838  P_max  1.93 kW (wear)
  EN-GJS-400-15 (ductile iron)                   E_red 209790  S_H 1.33  S_W 1.61  S_F worn 5.07  eta 0.844  P_max  3.68 kW (deflection)
```

Reading: aluminium bronze has the **highest** pitting safety (1.97) but **fails on wear** (S_W 0.88) – strength
is not everything in a sliding gear. The sand-cast bronze also fails on wear. Ductile iron passes here on paper, but
the sliding velocity 2.8 m/s is above the usual recommendation for cast iron wheels – the table values do not cover
scuffing risk (check). CuSn12Ni2-C-GZ is the clear choice.

The add-on also holds the short notes as data (`BRONZE_NOTES`) so that they can be printed in reports.

### 6.9 Design procedure – checklist

1. Choose a from the output torque with σ_Hm (6.2): a ≈ (p*_m T₂ 10³ E_red (4/π)² S_H² / σ_HG²)^(1/3); round up to the
   series 50, 63, 80, 100, 125, 160, 200, 250 mm.
2. Choose z₁ from the ratio and from the need for self-locking (chapter 4), q ≈ 8–11 (stiffness vs efficiency, 6.5).
3. Run `python worm.py run --in my.json`: check S_H, S_W, S_F(worn), S_δ, θ_S.
4. Find the limiting criterion with `max_power_criteria()` (`python worm.py ch56`); if it is heat: fan, polyglycol,
   larger housing; if deflection: shorter bearing spread, larger q.
5. Check the start-up torque (5.8) and, for blocking or self-locking drives, the static tooth strength with the stall
   torque.
6. Specify the oil (type, ISO VG), the first oil change, and the wear monitoring (backlash, Cu in oil).
7. Confirm the "check" values with the standard, the bronze supplier and – for series products – with a test (method A).


---

## 7. Manufacturing of worm gears (worm: turning, whirling, milling, case hardening, grinding per flank form, polishing; wheel: bronze casting, rim on hub, hob design, radial / tangential hobbing, fly-cutter; inspection; assembly, contact pattern, running-in)

> Program: `tools/worm.py` (core) and the chapter functions (`python worm.py ch78`). All machine, tool, heat-treatment and
> tolerance values in this chapter are **typical values – check with the machine maker, the tool maker, the bronze foundry
> and your heat-treatment shop**. Maker names are examples, not recommendations.

A worm drive is made of two very different parts:

- the **worm** – a hard steel screw (case hardened, ground, often polished), made like a precision thread, and
- the **worm wheel** – a soft bronze gear, **cut with a tool that is a copy of the worm** (the hob).

Unlike a cylindrical gear pair, the two members are **not interchangeable**. The wheel teeth are generated by a hob that
imitates the worm, so the wheel "fits" only that worm geometry. The performance of the drive (efficiency, temperature,
wear) is decided by three things that are all made in the factory, not in the calculation:

1. the **flank form** and the **surface** of the worm (profile accuracy, roughness Ra after grinding / polishing),
2. the **hob** used for the wheel (its oversize and its condition decide the contact pattern),
3. the **assembly and running-in** (wheel centre plane, contact on the leaving side, first hours at reduced load).

This chapter follows the parts through the factory: process chain → worm blank and heat treatment → thread cutting →
grinding by flank form → wheel blank (bronze rim on hub) → hob design and hobbing → inspection → assembly, contact pattern,
backlash → running-in → typical defects.

### 7.1 Process chains and their quality

**Theory.** For the worm, the chain is always **soft machining → (case hardening) → (hard finishing)**. A worm that is not
hardened runs only at low speed and low load (cranes driven by hand, adjusters). Every industrial power worm is
**case hardened and ground**: the hard smooth worm and the soft bronze wheel give the low-friction, low-wear pair that ISO/TS
14521 assumes (the friction curve `mu_0T` and the wear intensity `J_W` of the core program are for this pair).

For the wheel, the chain is **bronze rim casting → rim fixed on the hub → turning → hobbing**. The wheel is never hardened.
Its tooth form is produced by **generating**: the hob rotates like the worm, the wheel rotates with the ratio z1/z2, and the
hob "screws" the tooth spaces into the bronze.

Quality grades: DIN 3974-1/-2 (worm and wheel deviations, grades 1–12, smaller = more accurate). Industrial drives use grade
6–8 for the wheel and 5–6 for a ground worm.

**In the program** – both chains are stored as tables:

```python
PROCESS_CHAINS_WORM = [  # route, DIN 3974 grade typically reached (check), volume, relative cost (1 = lowest)
    ("turned (single-point thread tool) soft, not hardened", "9-10", "single parts, repair, low speed", 1),
    ("thread milled (disc cutter) soft, not hardened", "8-9", "small to medium lots", 2),
    ("whirled soft + case hardened + ground", "5-6", "medium to high volume (standard industrial drives)", 3),
    ("milled / whirled soft + case hardened + ground + polished", "4-5", "high efficiency drives, low wear", 4),
    ("hard whirled after hardening (no grinding)", "6-7", "medium lots, no thread grinder available", 3),
    ("rolled thread (cold forming), induction hardened", "8-9", "very high volume, small modules (actuators)", 1),
]
PROCESS_CHAINS_WHEEL = [  # route, grade, volume, relative cost
    ("bronze rim centrifugal cast, shrunk / bolted on hub, hobbed radially", "8-9", "standard, small lead angle", 2),
    ("bronze rim centrifugal cast, hobbed tangentially (taper hob)", "7-8", "large lead angle, precision", 3),
    ("bronze rim, fly-cutter (single tooth, tangential feed)", "8-9", "prototypes, spare parts, one-offs", 2),
    ("continuous cast / sand cast bronze, hobbed", "9-10", "low duty, large wheels", 1),
    ("injection moulded plastic (POM / PA) wheel", "10-11", "very high volume, small power", 1),
]
```

**Run it:** `python worm.py ch78` (first block)
```
== 7.1 process chains (typical, check)
  worm  turned (single-point thread tool) soft, not hardened       grade 9-10  cost 1  single parts, repair, low speed
  worm  thread milled (disc cutter) soft, not hardened             grade 8-9   cost 2  small to medium lots
  worm  whirled soft + case hardened + ground                      grade 5-6   cost 3  medium to high volume (standard industrial drives)
  worm  milled / whirled soft + case hardened + ground + polished  grade 4-5   cost 4  high efficiency drives, low wear
  worm  hard whirled after hardening (no grinding)                 grade 6-7   cost 3  medium lots, no thread grinder available
  worm  rolled thread (cold forming), induction hardened           grade 8-9   cost 1  very high volume, small modules (actuators)
  wheel bronze rim centrifugal cast, shrunk / bolted on hub, hobbed radially grade 8-9   cost 2  standard, small lead angle
  wheel bronze rim centrifugal cast, hobbed tangentially (taper hob) grade 7-8   cost 3  large lead angle, precision
  wheel bronze rim, fly-cutter (single tooth, tangential feed)     grade 8-9   cost 2  prototypes, spare parts, one-offs
  wheel continuous cast / sand cast bronze, hobbed                 grade 9-10  cost 1  low duty, large wheels
  wheel injection moulded plastic (POM / PA) wheel                 grade 10-11 cost 1  very high volume, small power
```

**Interpretation.**
- The standard industrial route is **worm: whirled → case hardened → ground (→ polished)**, **wheel: centrifugally cast
  CuSn12Ni2 rim on an iron hub → hobbed**. This is the pair the core program calculates.
- Polishing the ground worm from Ra ≈ 0.4 to ≈ 0.2 µm lowers the friction (factor `Y_R` in `efficiency()`:
  (0.2/0.5)^0.25 = 0.80 against 0.95 for Ra 0.4) – a few points of efficiency for a small extra cost.
- The cheap routes (turned soft worm, sand-cast wheel) are only for hand drives and adjusters. Do not use them in a motor
  drive running for thousands of hours.

**Check questions.** (1) Why must the wheel be cut with a tool that copies the worm? (2) Which route gives the best
efficiency, and why?

### 7.2 Worm blank and case hardening

**Theory.** The worm is normally made **in one piece with its shaft** (the root diameter is small, a separate worm on a key
would be too weak). Material: case-hardening steel **16MnCr5 / 20MnCr5 / 18CrNiMo7-6**. Route of the blank:

1. Saw → face and centre (the centres are the datum for every later operation – thread, grinding, inspection).
2. Rough turning with grinding allowance on the bearing seats (≈ 0.3 mm on diameter).
3. Thread cutting soft (7.3), leaving **grinding stock** on each flank.
4. **Carburising** (≈ 930 °C), quenching, tempering (≈ 180 °C) → surface 58–62 HRC, core ≈ 900–1200 MPa.
5. Straightening if bent (worms are long and slender – check run-out before grinding), **centre lapping**.
6. Grinding of bearing seats and thread (7.4); polishing.

**Case hardening depth (CHD).** The case must carry the contact stress below the surface and must survive the grinding
stock. Rule of thumb for worms (check the heat-treatment shop and DIN 3990 / ISO 6336-5 style recommendations):

  CHD_final ≈ 0.15 · m_n, limited to 0.3 … 1.6 mm;  grinding stock per flank s_g ≈ 0.08 + 0.02 · m_n mm;
  CHD to carburise = CHD_final + s_g.

The carburising time grows with the square of the depth (diffusion): CHD ≈ k · √t. With k ≈ 0.5 mm per √(2 h) at 930 °C
(check your furnace) this gives t ≈ 2 h · (CHD/0.5 mm)².

**In the program:**

```python
def worm_heat_treatment(P=None):
    """Case depth target and grinding stock for a case-hardened worm (rules of thumb - check heat-treatment shop)."""
    P = P or DEFAULT
    g = geometry(P)
    mn = g["mn"]
    chd = min(max(0.15 * mn, 0.3), 1.6)              # case hardening depth (550 HV) after grinding, mm
    stock = 0.08 + 0.02 * mn                         # grinding stock per flank, mm
    chd_before = chd + stock                         # carburise for this depth before grinding
    t_h = (chd_before / 0.5) ** 2 * 2.0              # carburising time h at ~930 C, CHD ~ k sqrt(t), k ~ 0.5 mm/sqrt(2h) (check)
    return {"mn": mn, "CHD_final": chd, "stock_per_flank": stock, "CHD_carburise": chd_before, "t_carburise_h": t_h,
            "surface_HRC": "58-62", "core_MPa": "900-1200 (16MnCr5 / 20MnCr5)"}
```

**Run it:** `python worm.py ch78`
```
== 7.2 worm heat treatment (rules of thumb, check)
  mn 3.905 mm: CHD after grinding 0.59 mm, grinding stock 0.158 mm/flank -> carburise to 0.74 mm (~4.4 h at 930 C); 58-62 HRC
```

**Interpretation.**
- For the default worm (m_x 4, γ 12.53°, m_n = 4 · cos 12.53° = 3.905 mm) the drawing says **CHD 0.6 +0.3 mm at 550 HV**
  after grinding, **58–62 HRC**. The heat-treatment order asks for 0.74 mm before grinding.
- **Distortion.** A slender worm bends during quenching. Typical run-out after hardening is 0.05–0.2 mm (check). If the
  grinding stock is smaller than the run-out, one side of the thread is ground out of the case – **soft spots on the
  flank** and fast wear. Therefore: straighten, measure run-out between centres, and keep stock ≥ run-out/2 + 0.05 mm.
- **Never grind with burn.** Grinding burn (tempering of the surface by too much heat) is invisible but halves the
  surface hardness locally. Check by nital etching (ISO 14104) on samples of every batch.

### 7.3 Cutting the thread soft – turning, milling, whirling

**Theory.** Three soft-machining processes are used:

| Process | Principle | Advantage | Limit |
|---|---|---|---|
| **Thread turning** | single-point tool, axial feed = lead per revolution, many passes (depth a_p ≈ 0.2–0.3 mm) | any lathe, any profile | slow, one start after the other, high axial speed for large leads |
| **Thread milling** (disc cutter) | disc cutter tilted to the lead angle, worm turns slowly | one pass per start, good for large modules | the cutter profile gives a ZN- or ZK-type flank; cutter per module |
| **Whirling** | ring with 3–6 inserts rotates fast around the worm (eccentric), worm turns slowly | fastest, one pass per start, good chips, ideal for series | special whirling unit on the lathe; profile of the inserts per module |

For multi-start worms (z1 = 2–4) each start is cut separately; the next start is reached by **indexing** the worm by 360°/z1
(or shifting the tool by one axial pitch p_x). The **pitch error between the starts** (indexing error) is an important
quality value (DIN 3974: f_px).

**Time model.** Thread length L = worm length b1 + 2 p_x (run-in, run-out). Thread depth h = (2 h_aP* + c_P*) · m_x.

- Turning: n from the cutting speed at d_a1, but limited so that the axial speed n · p_z stays ≤ 6 m/min (fast axial
  motion with a reversal at the end of each pass). Passes = h / a_p + 2 spring passes.
  t = z1 · passes · (L/(p_z · n) + return time).
- Milling: feed speed v_f = f_z · z_c · n_c (12-tooth cutter, D 100 mm), path along the helix L / sin γ.
- Whirling: the worm turns n_w ≈ 8 rpm; the axial feed is one lead per worm revolution: t = z1 · L/(p_z · n_w).
- Grinding (7.4): about 5 passes per start at a worm speed of about 20 rpm.

```python
def worm_thread_time(P=None, method="whirling", vc=None, ap=0.25, f_mill=0.08, n_work=8.0, z_ring=4):
    """Machining time of the worm thread (all starts), one worm. Typical cutting data (check tool maker)."""
    P = P or DEFAULT
    g = geometry(P)
    L = max(g["b1_geo"], g["b1_emp"]) + 2 * g["px"]  # thread length + run-in / run-out
    h = (2 * P["haP"] + P["cP"]) * P["mx"]           # thread depth
    if method == "turning":
        vc = vc or 120.0                             # m/min, carbide, soft 16MnCr5
        n = vc * 1000 / (math.pi * g["da1"])
        n = min(n, 1000.0 * 60 / g["pz"] * 0.1)      # feed per rev = lead: limit the axial speed to 6 m/min
        passes = math.ceil(h / ap) + 2               # + spring passes
        t = P["z1"] * passes * (L / (g["pz"] * n) + 0.05)   # + 3 s return per pass
    elif method == "milling":
        ...
    elif method == "whirling":
        # whirling ring with z_ring inserts around the worm, workpiece n_work rpm, one pass per start
        t = P["z1"] * (L / (g["pz"] * n_work) + 0.2)
    elif method == "grinding":
        # thread grinding: 3 roughing + 2 finishing passes per flank pair, workpiece 20 rpm, dressing every start
        passes = 5
        t = P["z1"] * (passes * L / (g["pz"] * 20.0) + 0.5)
```

**Run it:** `python worm.py ch78`
```
== 7.3 thread machining time per worm (typical data, check)
  turning   L 97.6 mm, depth 8.8 mm -> 5.04 min
  milling   L 97.6 mm, depth 8.8 mm -> 2.44 min
  whirling  L 97.6 mm, depth 8.8 mm -> 1.37 min
  grinding  L 97.6 mm, depth 8.8 mm -> 2.94 min
```

**Interpretation.**
- The thread is 8.8 mm deep (2 · 1.0 + 0.2 = 2.2 m_x). Turning needs 38 passes per start – **5 min** for the two starts.
  Whirling does each start in one pass – **1.4 min**. For a series of 500 worms per year the whirling unit pays back.
- The **thread length** comes from the geometry of chapter 3: `b1_geo` (72.4 mm, the wheel tip circle reaches the worm
  tip cylinder) is used, not the shorter empirical value (53.8 mm). A worm thread that is too short does not cut the
  wheel teeth completely at their ends – the contact ends early, the load per tooth rises.
- Grinding time (≈ 3 min) is about the same as soft cutting, but the grinding machine costs several times more per hour.
  This is why the grinding stock must be small and even (7.2).

### 7.4 Grinding the worm – the flank form decides the grinding method

**Theory.** DIN 3975 defines the worm flank forms by **how they are made** (a straight line of the flank lies in a
certain plane, or is produced by a certain tool):

| Form | Straight line of the flank lies in … | Cutting tool | Grinding |
|---|---|---|---|
| **ZA** | the **axial section** (transverse section: Archimedean spiral) | lathe tool at centre height | the wheel needs a corrected (convex) profile; difficult to grind exactly |
| **ZN** | the **normal section** of the thread or space | lathe tool tilted to γ; disc cutter | approximate with a straight wheel plus correction |
| **ZI** | lines **tangent to the base cylinder** (transverse section is an involute = involute helicoid) | hob-like tool, flat wheel | **exact** with the flat side of a wheel at the base lead angle γ_b |
| **ZK** | no straight line; generated by a **double-cone (straight-sided) disc** wheel or cutter | disc milling cutter | same wheel shape; profile depends on the wheel diameter |
| **ZC** | concave flank, generated by a convex circular-arc wheel ("Cavex", Niemann) | special | convex–concave contact, thicker oil film |

The ZI worm is a helical involute gear with very few teeth (z1 = 1–4) and a very large helix angle (90° − γ). Its base
cylinder is calculated in the core program (`geometry()`): cos γ_b = cos α_n · cos γ, d_b1 = d1 · tan γ / tan γ_b. For the
default worm: d_b1 = 18.431 mm, γ_b = 23.463°. A flat-sided grinding wheel set at γ_b touches the involute helicoid along a
straight line – **the grinding wheel profile does not depend on the wheel diameter**. This is the reason why the core
program and most modern standard drives use **ZI** (or ZK).

For **ZK** worms the generated flank is the **envelope** of the double-cone wheel during the screw motion. The flank is not
straight in any section, and its shape depends on the wheel radius R_w. The wheel shrinks with every dressing, so the
profile changes during the wheel's life. Modern CNC thread grinders correct the dressing profile for the actual wheel
diameter.

**In the program – numerical envelope.** The add-on computes the ZK flank in the axial section **numerically**: a point of
worm material (r, 0, z) is removed if, at some screw angle φ, the moved point (r cos φ, r sin φ, z + p_z φ/2π) lies inside
the wheel. The wheel is a double cone with flank angle α = 20°, centre at A = r_f1 + R_w on the x axis, axis
(0, −sin γ, cos γ) (the wheel mid-plane follows the thread). For each radius a bisection finds the flank position.

```python
def _ground_profile(P, Rw, n_r=9, alpha_wheel_deg=None):
    g = geometry(P)
    r1, rf1, ra1 = g["d1"] / 2, g["df1"] / 2, g["da1"] / 2
    gam, pz = g["gamma"], g["pz"]
    aw = math.radians(alpha_wheel_deg if alpha_wheel_deg is not None else P["alpha_n_deg"])
    A = rf1 + Rw                                     # wheel centre: tip reaches the worm root
    ax = (0.0, -math.sin(gam), math.cos(gam))        # wheel axis (worm axis = z, wheel centre on x)
    t0 = g["px"] * math.cos(gam) / 4 - (r1 - rf1) * math.tan(aw)   # wheel half-width at its tip
    def inside(x, y, z):
        dx, dy, dz = x - A, y, z
        s = dy * ax[1] + dz * ax[2]
        rho = math.sqrt(max(dx * dx + dy * dy + dz * dz - s * s, 0.0))
        return rho <= Rw and abs(s) <= t0 + (Rw - rho) * math.tan(aw)
    phis = [-0.7 + 1.4 * k / 280 for k in range(281)]
    def removed(r, z):
        for ph in phis:                              # point (r, 0, z) after screw motion by phi
            x, y = r * math.cos(ph), r * math.sin(ph)
            if inside(x, y, z + pz * ph / (2 * math.pi)):
                return True
        return False
    ...  # bisection on z for 9 radii between the root and the tip

def grinding_profile_study(P=None, wheel_diameters=(500.0, 400.0, 300.0, 200.0)):
    """Generated axial flank: angle and convexity (deviation from the chord) vs grinding wheel diameter (check)."""
```

**Run it:** `python worm.py ch78`
```
  ZK generation with a straight-sided disc wheel (alpha 20 deg), axial-section flank vs wheel diameter:
    Dw   500 mm: axial flank angle 20.317 deg, convexity 49.4 um, space width at d1 6.2836 mm
    Dw   400 mm: axial flank angle 20.308 deg, convexity 48.4 um, space width at d1 6.2834 mm
    Dw   300 mm: axial flank angle 20.294 deg, convexity 46.6 um, space width at d1 6.2831 mm
    Dw   200 mm: axial flank angle 20.269 deg, convexity 43.3 um, space width at d1 6.2826 mm
```

**Interpretation.**
- The space width at d1 is p_x/2 = 6.2832 mm for every wheel – the set-up (wheel tilted to γ, width t0) is right.
  A refinement with 1201 angle steps instead of 281 gives the same values (49.43 / 46.61 µm), so the result is not a
  grid effect.
- The ZK flank is **convex by about 45–50 µm** over the tooth height in the axial section, and its axial angle (≈ 20.3°)
  is **not** the ZA value α_x = 20.448°. A ZK worm is therefore not a ZA worm. **The hob for the wheel must be made for
  exactly the same flank form and the same nominal grinding-wheel diameter as the worm.**
- When the wheel is dressed from 500 to 300 mm the convexity changes by **2.8 µm** and the flank angle by 0.02°. That is
  small, but a DIN 3974 grade 5 profile tolerance is only a few µm (check the table for your module). Therefore CNC
  grinders correct the dressing for the actual wheel diameter, or the drawing states the grinding-wheel diameter range.
- **ZI avoids this problem**: a flat wheel side at γ_b gives the exact involute helicoid for any wheel diameter.

**Polishing.** After grinding, worms for high efficiency are polished (belt or brush polishing, or superfinishing) to
Ra ≈ 0.1–0.2 µm. The tips of the peaks are removed, which makes running-in faster and lowers the wear of the bronze in the
first hours (the hard peaks act like a file on the soft wheel).

### 7.5 The wheel blank – bronze rim and hub

**Theory.** Tin bronze is expensive (about 5–10 times the price of cast iron per kg – check today's metal prices), so only
the toothed **rim** is bronze. The hub is grey or ductile iron (or steel). Bronze casting methods:

| Casting | Structure | Use |
|---|---|---|
| **Centrifugal (GZ)** | fine, dense grain, few pores (impurities move to the bore and are turned away) | standard for power worm wheels; highest σ_Hlim and best wear (`WHEEL_MATERIALS`) |
| Continuous (GC) | fine grain, bars and tubes | small wheels |
| Sand (GS) | coarse grain, risk of porosity | large single wheels, low duty – shows S_W 0.99 in the core material comparison |

Ways to join the rim and hub:

1. **Shrink fit** (bronze rim heated, pushed on the hub) – often with **axial screws or pins in the joint** (half in the
   bronze, half in the iron) against slip.
2. **Bolted rim** – a flange on the hub, fitted bolts in shear.
3. **Cast-on rim** – bronze cast centrifugally directly onto a steel hub (metallurgical bond, special foundries).

**The temperature problem of a shrink fit.** The bronze expands more than the iron:
α_bronze ≈ 17.5 · 10⁻⁶ /K, α_GJS ≈ 11 · 10⁻⁶ /K (check). When the drive runs warm (ΔT = θ_S − θ_0), the interference
falls by

  ΔU = (α_rim − α_hub) · ΔT · d.

**Pressure in the joint (Lamé, the same model as M3 – `shaft.press_fit` is re-used).** The rim is the outer part ("hub"
in M3: Q_A = d/D_rim), the iron hub is the inner part (Q_I = d_i/d):

  p = (U_eff/d) / (K_A/E_rim + K_I/E_hub),  K_A = (1+Q_A²)/(1−Q_A²) + ν,  K_I = (1+Q_I²)/(1−Q_I²) − ν.

The joint must carry the tangential force 2T2/d and the **axial force of the wheel F_a2 = F_t1** together:

  S_slip = μ · p · π · d · b2 / √((2000 T2/d)² + F_a2²).

```python
def rim_shrink_fit(P=None, rim_under_root=2.0, di_hub=100.0, U_min_um=52.0, U_max_um=117.0, mu=0.12, Re_rim=180.0,
                   alpha_rim=17.5e-6, alpha_hub=11.0e-6, E_hub=169000.0, S_req=2.0):
    """Bronze rim shrunk on a ductile-iron hub (H7/s6 at d ~ 138: U 52 ... 117 um - check ISO 286).
    Uses shaft.press_fit (Lame). The bronze expands more than the iron: interference is LOST when warm."""
    P = P or DEFAULT
    sh = _shaft()
    R = capacity(P)
    g, F, L = R["g"], R["F"], R["L"]
    d = round(g["df2"] - 2 * rim_under_root * P["mx"])
    f = {"d": d, "D_hub": g["df2"], "di_shaft": di_hub, "l": P["b2"], "Rz_shaft": 6.3, "Rz_hub": 6.3,
         "E_shaft": E_hub, "E_hub": WHEEL_MATERIALS[P["wheel_material"]]["E"], "nu": 0.32, "mu": mu, "Re_hub": Re_rim}
    dT = L["theta_S"] - P["theta_0"]
    dU = (alpha_rim - alpha_hub) * dT * d * 1000      # um lost at operating temperature
    cold = sh.press_fit(f, U_min_um)
    warm = sh.press_fit(f, max(U_min_um - dU, 0.0))
    hi = sh.press_fit(f, U_max_um)
    T2, Fa2 = F["T2"] * P["KA"], F["Fa2"]
    Freq = math.hypot(2000 * T2 / d, Fa2)             # tangential + axial force on the joint
    Fcap = lambda r: math.pi * d * P["b2"] * r["p"] * mu
    shrink_dT = (U_max_um / 1000 + 0.001 * d) / (alpha_rim * d)
    ...   # bisection: interference U_req that gives S_slip = S_req when warm

def rim_bolts(P=None, n=6, d_bolt=8.0, tau_allow=120.0, Dk=None):
    """Bolted rim with fitted bolts (shear only, conservative). tau_allow for 8.8 fitted bolts ~ 0.6 x 640 / S (check)."""
    ...
    Fb = 2000 * F["T2"] * P["KA"] / (Dk * n)
    tau = Fb / (math.pi * d_bolt ** 2 / 4)
```

**Run it:** `python worm.py ch78`
```
== 7.5 bronze rim on ductile-iron hub
  joint d 138 mm, rim outer 154.4, b2 28; oil 61.9 C -> bronze/iron expansion loses 37.6 um of interference
  p cold 2.7 MPa -> S_slip 0.78; p warm 0.3 MPa -> S_slip 0.08; rim at U_max: sigma_v 69 MPa, S 2.61; shrink dT 106 K -> NOT OK - add screws / pins or use a bolted rim
  interference needed for S_slip 2 when warm: 156 um (rim yield safety then 1.91) -> a shrink fit alone is not practical
  bolted rim: 4 fitted bolts M8 on 122.4 mm: F 1407 N, tau 28.0 MPa, S 4.29
  bolted rim: 6 fitted bolts M8 on 122.4 mm: F 938 N, tau 18.7 MPa, S 6.43
  bolted rim: 8 fitted bolts M8 on 122.4 mm: F 703 N, tau 14.0 MPa, S 8.57
```

**Interpretation – an important design finding.**
- The rim is **thin** (2 m_x = 8 mm under the root → Q_A = 138/154.4 = 0.89). A thin ring is very soft in the radial
  direction (K_A ≈ 9), so even an H7/s6 fit gives only **2.7 MPa** joint pressure. Already cold, S_slip is only 0.78.
- At 62 °C oil temperature the bronze has grown **37.6 µm more** than the iron – most of the minimum interference
  (52 µm − 10 µm smoothing). The joint pressure falls to 0.3 MPa. **The rim would creep on the hub.**
- To hold it by friction alone, an interference of **156 µm** would be needed. That is beyond standard fits, needs a
  shrink temperature of > 130 K, and it loads the bronze close to yield (S 1.91).
- **Practice and conclusion:** for this size use a **bolted rim** (4–6 fitted bolts M8: S > 4) or a shrink fit **with 4–6
  axial screws in the joint**. The shrink fit then only centres the rim. This is the normal design of standard worm gear
  units.
- Assembly of a shrink fit: heat the rim by ΔT ≈ (U_max + 0.001 d)/(α_rim · d) = **106 K** (oil bath or induction, not a
  flame – bronze loses strength locally). Turn the tooth blank and **hob the wheel only after the rim is fixed**, otherwise
  the joint distortion appears as run-out of the teeth.

### 7.6 The hob for the wheel – oversize, gashes, regrinding

**Theory.** The worm-wheel hob is a **copy of the worm** with cutting edges: the thread is interrupted by **gashes**
(flutes), and each tooth is **relieved** (backed off) behind its cutting edge so that it does not rub. Three design rules:

1. **Same flank form, same starts, same axial module and lead direction as the worm.** A ZI worm needs a ZI hob.
2. **Oversize.** The new hob reference diameter is larger than the worm: d_0 = d1 + k · m_x with k ≈ 0.1–0.2 (check the hob
   maker). Two reasons:
   - **Regrind allowance.** A relieved hob is resharpened on the face of the gashes. Because of the relief, every regrind
     makes the hob smaller. Each regrind of depth e reduces the radius by Δr = e · tan(relief angle). The hob can be
     reground until d_0 has fallen to d1.
   - **Contact pattern.** A hob slightly larger than the worm has a slightly smaller lead angle: tan γ_0 = z1 m_x / d_0.
     The wheel teeth are therefore slightly more "open" than the worm: the worm touches the wheel first in a **bearing
     island** in the middle, not at the tooth edges. During running-in the bronze wears into a full pattern. Without
     oversize the contact starts at the edges – edge pressure, scuffing.
3. **Number of gashes.** More gashes give more cutting edges per revolution (finer envelope, better flank), but thinner
   teeth and fewer regrinds. Typical 6–12 for m_x 2–8 (check the hob maker).

**Hobbing time.** The hob turns at n_0 = v_c · 1000 / (π · d_a0); the wheel makes z1/z2 revolutions per hob revolution:
one wheel revolution takes z2/(z1 · n_0) minutes.

- **Radial infeed** (plunge): the hob is moved radially into the wheel by the tooth depth h with a feed f_r per wheel
  revolution: t ≈ (h/f_r + 3) · z2/(z1 n_0).
- **Tangential feed**: a **taper hob** (lead-in cone) is moved along its own axis, tangential to the wheel; the full-depth
  part passes through the wheel: t ≈ (L_t/f_t + 2) · z2/(z1 n_0), with L_t ≈ the engagement length plus the taper.

**Why tangential at large lead angles?** In radial infeed the hob teeth sweep through the tooth space at an angle while
they are not yet at full depth. At large lead angles (rule of thumb γ > 8° – check) they **cut away part of the flank near
the wheel faces** (the flank becomes "undercut" at the ends, the wheel is too thin there). Tangential feeding moves every
generating position through the wheel at full depth, so the flank is generated completely.

```python
def hob_design(P=None, k_over=0.15, regrind_depth=0.3, relief_deg=10.0, vc_hob=50.0, f_radial=0.15, f_tang=1.0):
    """Worm-wheel hob: oversize, lead angle mismatch, gashes, number of regrinds, hobbing time (radial / tangential).
    Typical values - check hob maker and DIN 3975 / DIN 8002 style hob data."""
    P = P or DEFAULT
    g = geometry(P)
    mx, z1, z2 = P["mx"], P["z1"], P["z2"]
    d0 = g["d1"] + k_over * mx                       # new hob reference diameter
    gam0 = math.atan(z1 * mx / d0)
    n_g = max(6, round(math.pi * d0 / (1.1 * g["px"])))   # gashes (cutting edges per turn)
    dr_per = regrind_depth * math.tan(math.radians(relief_deg))   # radius loss per regrind
    n_reg = int(((d0 - g["d1"]) / 2) / dr_per)
    h = (2 * P["haP"] + P["cP"]) * mx
    n0 = vc_hob * 1000 / (math.pi * (d0 + 2 * mx))   # hob rpm
    t_wheel_rev = z2 / (z1 * n0)                     # min per wheel revolution
    t_rad = h / f_radial * t_wheel_rev + 3 * t_wheel_rev          # infeed + 3 wheel turns sizing
    L_t = 2 * math.sqrt(max((d0 / 2 + mx * 1.2) ** 2 - (P["a"] - g["da2"] / 2 - 0.0) ** 2, 0.0)) + 3 * g["px"]   # taper + engagement
    t_tan = L_t / f_tang * t_wheel_rev + 2 * t_wheel_rev
    method = "tangential (taper hob)" if g["gamma_deg"] > 8.0 else "radial infeed acceptable"

def fly_cutter_time(P=None, vc=45.0, f_t=0.08):
    """Fly-cutter (one tooth on an arbor, tangential feed f_t per wheel revolution)."""
```

**Run it:** `python worm.py ch78`
```
== 7.6 wheel hob and hobbing time (typical, check)
  hob d0 36.60 mm (oversize 0.60 mm), lead angle 12.330 deg (worm 12.529, difference 0.199 deg), 8 gashes
  radius loss 0.053 mm per regrind -> 5 regrinds until d0 = d1
  hob 357 rpm, 0.057 min per wheel turn; radial infeed 3.5 min, tangential 4.4 min (L 74.4 mm) -> tangential (taper hob)
  fly-cutter: 326 rpm, tangential travel 46.5 mm -> 37 min (0.6 h)
```

**Interpretation.**
- The hob is 0.6 mm larger than the worm. Its lead angle is **0.2° smaller** – this small mismatch makes the bearing
  island of a new drive.
- **Only 5 regrinds** until the hob is as small as the worm. After that the wheels cut with it would have the **full**
  contact from the beginning (no island) and later regrinds make the wheel teeth too "closed" – contact at the edges.
  **Record the hob diameter on every regrind** and scrap or re-profile the hob at d_0 = d1.
- The default worm has γ = 12.5° > 8°: **tangential hobbing** with a taper hob (4.4 min). Radial infeed (3.5 min) would
  be a little faster but cuts the flank ends. For the 1-start worm of chapter 8 (γ = 6.3°) radial infeed is acceptable.
- **Fly-cutter.** For prototypes and spare parts a single tooth ("fly tool") on an arbor replaces the expensive hob
  (a special hob for one module, lead and diameter costs several thousand euros and has weeks of delivery time – check).
  The fly-cutter must be fed tangentially and cuts only once per revolution: **37 min instead of 4 min**, but the tool is
  ground in an hour. It is the standard way to make one replacement wheel.
- Hobbing machines for worm wheels need a **tangential slide** (standard on modern CNC hobbers). The machine set-up:
  hob axis at 90° to the wheel axis (not tilted, unlike cylindrical gear hobbing), centre distance = a_0 = (d_0 + d2)/2 +
  x2 m_x at the end of the infeed, and the **hob centre exactly in the wheel centre plane** (this plane becomes the
  reference for the assembly, 7.9).

### 7.7 Inspection of worm and wheel

**What is measured (DIN 3974-1/-2, AGMA 6022 style).**

| Part | Characteristic | Instrument |
|---|---|---|
| Worm | axial pitch f_px, cumulative pitch, **lead** (per start), indexing between starts | gear measuring machine (CNC, worm program) |
| Worm | profile form and angle (in the defining section of the flank form) | gear measuring machine |
| Worm | run-out of the thread to the bearing seats | between centres, dial gauge in the thread |
| Worm | tooth thickness | **over three wires** (or tooth caliper normal to the thread) |
| Worm | surface Ra, hardness, CHD, grinding burn | roughness tester, HRC, cut section, nital etch |
| Wheel | single pitch, cumulative pitch, **radial run-out** F_r | gear measuring machine / ball probe in the spaces |
| Wheel | double-flank roll test with a **master worm**: total composite F_i'', tooth-to-tooth f_i'' | roll tester |
| Pair | contact pattern, backlash, no-load torque | in the housing (7.8) |

**Over-wire measurement (theory).** Three wires of diameter D are laid in the thread spaces (two on one side, one on the
other) and the size M over the wires is measured with a micrometer. In the axial section the worm is approximately a rack
with flank angle α_x (exact for ZA, approximate for the other flank forms – check DIN 3975 / the gauge maker). For a space
of width e = p_x − s_x1 at the reference line:

- wire centre above the reference line: y_c = (D/(2 cos α_x) − e/2)/tan α_x,
- contact point on the flank: y = y_c − (D/2) sin α_x,
- size over wires: M = d1 + 2 y_c + D.
- The **best wire** touches exactly on the reference line (y = 0): D_best = e / cos α_x. Then M − d1 = D(1 + sin α_x) – the
  core program `over_wires()` uses this, and the self-test checks it.
- **Tolerance of M** from the tooth-thickness allowances: dM = ds_x / tan α_x (a thickness change of 10 µm changes M by
  10/tan 20.45° = 26.9 µm). So M is a **sensitive** measurement of the tooth thickness.
- In practice the next **standard wire** is used. The contact must still lie on the working flank, between the root
  clearance and the tip.

```python
WIRE_SERIES = [0.17, 0.22, 0.25, 0.29, 0.335, 0.39, 0.455, 0.53, 0.62, 0.725, 0.895, 1.1, 1.35, 1.65, 2.05, 2.55,
               3.2, 4.0, 5.05, 6.35, 8.0, 10.0]   # common measuring-wire diameters mm (check DIN 2269 / gauge maker)

def wire_check(P=None, D=None, A_sx_upper_um=-30.0, A_sx_lower_um=-80.0):
    P = P or DEFAULT
    g = geometry(P)
    ow = over_wires(P, g)
    D = D or min(WIRE_SERIES, key=lambda w: abs(w - ow["DM"]))
    ax = g["alpha_x"]
    e = g["px"] - ow["sx1"]                           # space width at the reference line
    yc = (D / (2 * math.cos(ax)) - e / 2) / math.tan(ax)          # wire centre above the reference line
    y_contact = yc - D / 2 * math.sin(ax)
    M = P["d1"] + 2 * yc + D
    r_c = P["d1"] / 2 + y_contact
    ok = g["df1"] / 2 + P["cP"] * P["mx"] < r_c < g["da1"] / 2 - 0.1 * P["mx"]
    tan_ax = math.tan(ax)
    M_up = M + A_sx_upper_um / 1000 / tan_ax
    M_lo = M + A_sx_lower_um / 1000 / tan_ax
```

**Run it:** `python worm.py ch78`
```
== 7.7 inspection
  best wire 6.706 mm -> standard wire 6.35 mm: M 43.674 (max 43.594 / min 43.460) mm, contact radius 17.553 mm (on the flank)
    wire 4.00: M 34.598, contact radius 14.600 (ok)
    wire 5.05: M 38.653, contact radius 15.920 (ok)
    wire 8.00: M 50.047, contact radius 19.626 (ok)
```

**Check of the formula.** With the best wire (`wire_check(P, 6.7057)`) the add-on gives M = 45.048 mm and a contact
radius of exactly 18.000 mm = d1/2 – the same M as the core `over_wires()` (report: "M 45.048 mm"). Both formulas agree.

**Interpretation.**
- With the standard 6.35 mm wire the contact is 0.45 mm below the reference line – still well on the flank (the flank runs
  from r ≈ 14 to 22 mm). The **drawing must state the wire diameter** together with M; an M value without D is useless.
- The worm drawing entry: "M over 3 wires D = 6.35 mm: **43.594 / 43.460 mm**" (for the allowances −30 / −80 µm on the
  axial thickness). The nominal value 43.674 mm (zero allowance) is not on the drawing.
- Usually the backlash is put **on the wheel** (thinner wheel teeth, `jt_um` in the core program) and the worm is made
  close to nominal thickness – the worm is the more accurate, more expensive part and is often used with a stock hob.

**Wheel inspection in the series.** A full gear measurement of each bronze wheel is too expensive. The normal plan:
first-part measurement on the CNC gear measuring machine (pitch, run-out, flank), then for the series the **double-flank
roll test with a master worm** (F_i'', f_i'' and the centre-distance value, which shows the tooth thickness) plus a sample
gear measurement every n parts (check your quality plan).

### 7.8 Backlash

**Theory.** The circumferential backlash j_t (at the wheel reference circle) comes from:

1. the **tooth thickness allowances** of the wheel (A_s2) and the worm (A_sx1): j_t ≈ −(A_s2 + A_sx1),
2. the **centre distance tolerance** ± f_a: Δj_t = 2 Δa · tan α_x (the same rack relation as above),
3. the **temperature**: the housing grows (more backlash), the worm and the bronze wheel grow (less backlash):
   Δa_th = a · α_housing · ΔT_housing − (d1/2) · α_steel · ΔT_worm − (d2/2) · α_bronze · ΔT_wheel.

```python
def backlash_budget(P=None, A_s2_um=(-60.0, -140.0), A_sx1_um=(-30.0, -80.0), fa_um=35.0, alpha_housing=11e-6,
                    dT_housing=35.0, dT_worm=45.0, dT_wheel=40.0):
    P = P or DEFAULT
    g = geometry(P)
    ta = math.tan(g["alpha_x"])
    j_min = -(A_s2_um[0] + A_sx1_um[0]) - 2 * fa_um * ta
    j_max = -(A_s2_um[1] + A_sx1_um[1]) + 2 * fa_um * ta
    da_th = (P["a"] * alpha_housing * dT_housing - g["d1"] / 2 * 11.5e-6 * dT_worm - g["d2"] / 2 * 17.5e-6 * dT_wheel) * 1000
    j_th = 2 * da_th * ta
```

**Run it:** `python worm.py ch78`
```
== 7.8 backlash budget
  backlash cold 64 ... 246 um; housing / gears warm: da -28.2 um -> -21.0 um -> warm 43 ... 225 um; 10 um of a = 7.5 um backlash
```

**Interpretation.**
- With a cast-iron housing the gears (bronze wheel 17.5 · 10⁻⁶ /K) grow more than the housing: **the backlash falls by
  21 µm when warm**. The minimum warm backlash (43 µm) must still be > 0 with margin – OK here.
- With an **aluminium housing** (α ≈ 23 · 10⁻⁶ /K) the sign changes: the backlash grows when warm (try
  `backlash_budget(P, alpha_housing=23e-6)`). Positioning drives (turntables, indexing) then need an adjustable centre
  distance or a duplex worm (different lead on the two flanks – the worm is shifted axially to set the backlash).
- 10 µm of centre-distance error = 7.5 µm of backlash. The housing bore distance tolerance (± 35 µm here, check DIN 3964)
  takes about a third of the backlash range.

### 7.9 Assembly – wheel centre plane and contact pattern

**Theory.** The wheel teeth were hobbed with the hob in the **wheel centre plane**. In the gearbox the worm axis must lie
in this plane again. If the wheel is shifted axially, the worm touches the wheel teeth on one side of the face width only.

**Where should the pattern be?** Not in the middle! Look at the wheel tooth in the direction of rotation: the worm thread
enters the wheel teeth on the **entry side** and leaves on the **leaving side**. The oil is carried into the mesh on the
entry side. If the entry side of the tooth has a **small gap** (no contact), a converging **oil wedge** forms and the
hydrodynamic film builds up. Therefore:

- the correct no-load pattern lies **towards the leaving side**, about 50–75 % of the face width (typical, check maker),
- the entry side is free (visible as a gap in the marking blue),
- under load and after running-in the pattern spreads over most of the flank, but the entry gap must remain.

For **reversing** drives both sides are leaving sides; the pattern is put in the middle and kept short (more hob oversize).

**How to set it.** Apply marking blue (Prussian blue) thinly on the worm, turn the worm by hand with light braking of the
wheel, read the print on the wheel teeth. Move the wheel axially with **shims** under the bearing covers (or an adjusting
nut) until the print is right. Because the hob is oversize, the pattern is a small island that moves **much faster than
the wheel**. The gain k (mm of pattern movement per mm of wheel shift) depends on the oversize and the geometry – it is
measured on the first gearbox: mark, add a known shim, mark again.

```python
def pattern_gain(frac1, frac2, shim_mm, b2):
    """Calibrate on the first gearbox: mark with blue, move the wheel axially by a known shim, mark again.
    k = pattern movement (mm along the face) per mm of wheel shift."""
    return (frac2 - frac1) * b2 / shim_mm

def pattern_setting(P=None, measured_frac=0.5, k_gain=8.0, target_frac=0.65):
    """Wheel centre-plane setting from a marking-blue print. measured_frac = centre of the pattern measured from the
    ENTRY edge of the wheel face (0 = entry edge, 1 = leaving edge). ..."""
    P = P or DEFAULT
    mx = P["mx"]
    tol = 0.03 if mx <= 3 else (0.05 if mx <= 6 else 0.08)
    shift = (target_frac - measured_frac) * P["b2"] / k_gain     # + = move the wheel towards the leaving side
    return {"tol_mm": tol, "measured": measured_frac, "target": target_frac, "shift_mm": shift,
            "pattern_move_in_tol_mm": k_gain * tol, "ok": 0.55 <= measured_frac <= 0.75}
```

**Run it:** `python worm.py ch78`
```
== 7.9 contact pattern (wheel centre plane)
  calibration: pattern centre 0.40 -> 0.69 of b2 after a 1.0 mm shim -> gain k = 8.1 mm per mm
  print centre 0.30 of b2 from entry: move -> move wheel +1.207 mm (towards leaving side); tolerance +-0.05 mm moves the pattern +-0.41 mm
  print centre 0.40 of b2 from entry: move -> move wheel +0.862 mm (towards leaving side); tolerance +-0.05 mm moves the pattern +-0.41 mm
  print centre 0.50 of b2 from entry: move -> move wheel +0.517 mm (towards leaving side); tolerance +-0.05 mm moves the pattern +-0.41 mm
  print centre 0.65 of b2 from entry: OK   -> move wheel +0.000 mm (towards entry side); tolerance +-0.05 mm moves the pattern +-0.41 mm
  print centre 0.85 of b2 from entry: move -> move wheel -0.690 mm (towards entry side); tolerance +-0.05 mm moves the pattern +-0.41 mm
```

**Interpretation.**
- The calibration values (0.40 → 0.69 after a 1.0 mm shim) are an **example**; measure your own gain on the first unit of
  every new design (k typically 5–15, check).
- With k ≈ 8 the axial tolerance ± 0.05 mm of the centre plane moves the pattern by ± 0.4 mm – acceptable on a 28 mm face.
  If the housing and part tolerances (bearing width, shoulder position, housing bore position) add up to more than about
  ± 0.05–0.1 mm, **shim adjustment is necessary** – the normal case in single and small-series production. In large series
  the tolerance chain is designed so that no shims are needed and the pattern is checked by sampling.
- Mark the setting: write the shim thickness on the assembly record. After running-in, mark again – the pattern must have
  grown from the leaving side, the entry gap must still be visible.

**Assembly checklist.**
1. Worm bearings: preload / axial play as specified (the worm axial force F_a1 = F_t2 is the largest force in the drive –
   4200 N in the default; the worm bearings are usually tapered roller bearings or a fixed angular-contact pair, M4).
2. Wheel axial position by shims → pattern (above).
3. Backlash: measure at the wheel with a dial gauge on a lever while the worm is locked; compare with 7.8.
4. No-load torque at the worm (shows binding or too much preload).
5. Oil fill to the mark (worm below: dip lubrication; worm above: wheel carries the oil – check the oil level for the
   mounting position, which is a common error), breather.

### 7.10 Running-in

**Theory.** A new bronze wheel has only a small bearing island (hob oversize, 7.6) and the roughness peaks of the new
flanks. In the first hours:

- the bronze wears **into the shape of the worm** (the pattern grows to 60–80 % of the flank),
- the bronze surface work-hardens and becomes smooth,
- friction and temperature are higher than later (the core friction curve `mu_0T` is for a run-in pair).

If full load is applied at once, the small contact area gets too much heat → **scuffing** (bronze smeared onto the worm),
which destroys the pair in minutes. Therefore the load is raised in steps, and the temperature is watched.

The add-on computes the oil temperature of each step with a raised friction (μ × 1.3 during running-in – a typical
assumption, check with the gearbox maker):

```python
def running_in(P=None, steps=((0.25, 2.0), (0.5, 3.0), (0.75, 5.0), (1.0, 10.0)), mu_factor=1.3):
    P = P or DEFAULT
    g = geometry(P)
    rows = []
    for frac, hours in steps:
        Q = dict(P, P1_kW=P["P1_kW"] * frac)
        e = dict(efficiency(Q, g))
        mu = e["mu"] * mu_factor
        rho = math.atan(mu / math.cos(g["alpha_n"]))
        e.update(mu=mu, rho=rho, eta_z=math.tan(g["gamma"]) / math.tan(g["gamma"] + rho))
        Ls = losses(Q, g, e)
        Ln = losses(Q, g)
```

**Run it:** `python worm.py ch78`
```
== 7.10 running-in programme (mu x 1.3 during running-in, check)
   25 % load (0.75 kW) for  2.0 h: eta 0.813, oil 35.6 C running-in / 33.4 C after (OK)
   50 % load (1.50 kW) for  3.0 h: eta 0.813, oil 47.3 C running-in / 42.9 C after (OK)
   75 % load (2.25 kW) for  5.0 h: eta 0.813, oil 59.0 C running-in / 52.4 C after (OK)
  100 % load (3.00 kW) for 10.0 h: eta 0.813, oil 70.6 C running-in / 61.9 C after (OK)
  first oil change after 300-500 h (check maker); then every 4000-8000 h mineral / 10000-20000 h polyglycol
```

**Interpretation.**
- During running-in the mesh efficiency is 0.813 instead of 0.850. At full load the oil runs **8.7 K hotter** than later
  (70.6 instead of 61.9 °C). A drive designed close to its thermal limit (`thermal_power_limit()`) **must** be run in at
  reduced load, otherwise it exceeds 90 °C in the first hours.
- Practical programme (typical – check the gearbox maker): 25 / 50 / 75 / 100 % load for about 2 / 3 / 5 / 10 h, stop a
  step if the sump temperature rises by more than about 10 K above the predicted value or does not become steady. Use the
  **same oil grade** as for operation (for polyglycol drives: never mix with mineral oil).
- **First oil change after 300–500 h**: the oil contains the bronze particles of running-in, which would otherwise act as
  an abrasive (wear intensity `J_W` rises with dirty oil).
- Factory test: many makers run each new unit for 10–30 min at no load or part load and check noise, temperature rise and
  leaks; the full running-in happens on site. Write this in the operating manual.

### 7.11 Typical defects and their causes

```python
DEFECTS = [  # symptom, likely cause, remedy
    ("pattern at the entry side, temperature high", "wheel centre plane offset, hob too small / worn", "shift wheel axially, check hob oversize"),
    ...
]
```

**Run it:** `python worm.py ch78`
```
== 7.11 typical defects
  pattern at the entry side, temperature high          | wheel centre plane offset, hob too small / worn            | shift wheel axially, check hob oversize
  pattern at the tip / root of the wheel tooth         | centre distance error or wrong hob diameter                | check a, hob d0; re-hob with correct hob
  fast wear, bronze particles in oil, rising backlash  | no running-in, rough worm (Ra > 0.5), wrong oil, too hot   | polish worm, running-in steps, oil change, PG oil
  pitting on the wheel flanks (grey spots)             | overload, sigma_H too high, oil too thin                   | check S_H, larger a or better bronze
  scuffing / seizure (smeared bronze)                  | oil starvation, sharp edges, no entry gap                  | oil level, chamfers, pattern to leaving side
  noise / vibration once per worm turn                 | worm run-out, pitch error, bent worm shaft                 | check run-out (DIN 3974), worm deflection
  rim slips on the hub when warm                       | bronze expands more than iron; interference lost           | screws / pins in the joint, bolted rim
  heat: oil above 90-100 C                             | power above the thermal limit, no fan, dirty fins          | fan, cooler, PG oil, larger size
```

**Notes.**
- Wheel pitting in bronze is often **not progressive**: small pits appear in the first months and then stop (the flank
  smooths and work-hardens). ISO/TS 14521 therefore permits a certain pitted area; the decision is made by **wear and
  temperature**, not only by S_H. Watch the backlash growth over time (wear) – it is the best condition indicator, and it
  can be measured on site.
- An oil analysis (Cu, Sn, Fe content in ppm) every few months gives the wear rate – useful for the digital twin
  (connect the measured backlash and Cu content to the wear model `dW = J_W · s_Wm` of chapter 6).

### 7.12 What this means for your factory

- **Buy or make?** Worm grinding machines and worm-wheel hobs are specialist equipment. For a compressor / machine factory
  the normal choice is to **buy standard worm gear units** (catalogue sizes a = 25 … 250 mm) and to use `worm.py` to
  check the catalogue rating, the thermal limit and the self-locking for your duty. Make worm drives yourself only if the
  geometry is special (integrated in a machine frame, special ratio) – then buy the worm ground and the wheel hobbed from
  a gear shop with the matching hob.
- **Drawing data** that the gear shop needs: flank form (ZI / ZK + grinding-wheel diameter for ZK), z1, z2, m_x, d1, α_n,
  lead direction (right hand standard), x2, centre distance, quality grade (DIN 3974), worm over-wire size with wire D,
  wheel tooth thickness / allowance, hob oversize (or "hob to maker's standard"), CHD and hardness, Ra of the worm flank,
  bronze grade and casting method, rim joint.
- **Spare wheels**: keep the hob (or the fly-cutter drawing) with the drawing – a new wheel without the original hob
  geometry will not match a worn worm.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification – what has been checked and how

| Check | How | Result |
|---|---|---|
| Geometry relations (tan γ, lead, a = (d1+d2)/2 + x2 m_x), force and torque balances, power balance, the force set from the normal force (Shigley form), γ = ρ' → η = (1 − tan² γ)/2 < 0.5, ZI base cylinder, loss sum, heat balance, thermal limit, over-wire best wire | `python worm.py selftest` | SELFTEST PASS (15 checks) |
| Over-wire formula of the add-on vs the core | `wire_check(P, D_best)` → M 45.048 mm, contact r = 18.000 mm | same as `over_wires()` |
| ZK envelope grid independence | 281 vs 1201 angle steps | 49.43 µm both |
| Pitting stress by hand (worked example below) | formula of chapter 6 | 275 MPa, same as the program |
| Rim fit | re-uses the verified M3 Lamé function `shaft.press_fit` | – |

What is **not** verified (no test data in this offline work): the absolute values of μ_0T, p*_m, s*, J_W, the housing
heat-transfer coefficient, all manufacturing times. They are typical values and are marked "check". Compare a calculation
with a **catalogue rating** of a standard unit of the same size before trusting it for a new design (8.3).

### 8.2 Complete worked example – lifting-table drive

**Task.** A scissor lifting table in the assembly line needs a drive at the spindle: about **150 N m at 45–50 rpm**
(≈ 0.75 kW output), operation 10 000 h over the life, start/stop several times per hour (moderate shocks: K_A = 1.25).
Motor: 4-pole, 1450 rpm. The table must **not run down** when the motor is switched off (holding).
Space: centre distance about 80 mm.

**Step 1 – ratio and size.** i = 1450 / 47 ≈ 31 → **z1 = 1, z2 = 31**. With m_x = 4 and d1 = 36 mm (q = 9):
d2 = 124 mm, a = (36 + 124)/2 = **80 mm**, x2 = 0. Wheel width b2 = 0.45 (d_a1 + 4 m_x) = 27 mm.

**Step 2 – input file** `tools/examples/worm_example.json` (only the keys that differ from `DEFAULT`):

```json
{
  "name": "Lifting-table drive 1.1 kW, i 31, a 80 (worked example chapter 8)",
  "a": 80.0, "z1": 1, "z2": 31, "mx": 4.0, "d1": 36.0, "b2": 27.0,
  "P1_kW": 1.1, "n1_rpm": 1450.0, "KA": 1.25, "Lh": 10000.0,
  "l1": 130.0, "d_shaft1": 25.0, "d_shaft2": 40.0, "P_V0_W": 25.0, "fan": true
}
```

**Step 3 – first iteration without a fan.** The first idea was a unit without a fan (cheaper, quieter):

```
== 8.2 worked example
  iteration 1 (no fan): oil 102.9 C, thermal limit 0.91 kW -> too hot
```

The 1-start worm has a low efficiency (≈ 0.72): about 300 W of the 1.1 kW become heat in the mesh. Without a fan
(k = 14 W/m²K) the 0.30 m² housing reaches **103 °C > 90 °C**. The thermal limit is only 0.91 kW. Options: fan,
polyglycol oil, a larger housing (a = 100), or a 2-start worm (better efficiency, but then i ≈ 15 and a second stage).
The program shows the effect of each (variants computed with `capacity()` on the example input):

| Variant | Oil °C | Thermal limit kW | S_H | S_W | η_z | Self-locking at rest |
|---|---|---|---|---|---|---|
| no fan, mineral | 102.9 | 0.91 | 1.90 | 5.05 | 0.725 | yes |
| **fan, mineral (chosen)** | **61.4** | **1.94** | **1.90** | **5.05** | **0.725** | **yes** |
| fan, polyglycol | 55.9 | 2.28 | 1.74 | 12.26 | 0.767 | yes |
| fan, z1 = 2, z2 = 31 (i 15.5 – different task) | 46.9 | 3.16 | 2.49 | 6.42 | 0.835 | no |

The fan solves the problem with a large margin. Polyglycol would add efficiency and much lower wear (S_W 12) – a good
choice for a heavy-duty version, but it needs PG-compatible seals and paint and must never be mixed with mineral oil.

**Step 4 – full calculation.** `python worm.py run --in examples/worm_example.json --out example`

```
# Worm gear report - Lifting-table drive 1.1 kW, i 31, a 80 (worked example chapter 8)

ZI worm, a 80.0 mm, z1/z2 1/31 (i 31.00), mx 4.000, d1 36.00 (q 9.00), alpha_n 20.0 deg, b2 27.0 mm, wheel CuSn12Ni2-C-GZ (centrifugal cast tin bronze), mineral oil

## Geometry
- lead angle 6.340 deg; axial pressure angle 20.113 deg; px 12.5664, lead pz 12.5664, mn 3.9755 mm
- worm d1 36.000, da1 44.000, df1 26.400; wheel d2 124.000, x2 +0.0000, da2 132.000, df2 114.400, dae2 136.000, throat radius 14.000 mm
- worm length b1 >= 63.0 (geometric) / 51.4 mm (empirical); wheel width b2 27.0 (recommended 27.0, max 33.9); wrap angle 75.7 deg
- ZI base cylinder db1 10.452 mm (base lead angle 20.942 deg); sliding velocity vg 2.750 m/s; n2 46.77 rpm

## Friction, efficiency, self-locking
- mu_0T 0.0369 x Y_S 1.118 x Y_R 0.946 x Y_W 1.00 = mu_z 0.0390; friction angle 2.376 deg
- mesh efficiency worm driving 0.7248, wheel driving 0.6237; self-locking at rest: yes (rho_static 7.28 deg), while running: no

## Forces
- T1 7.24 N m, T2 162.8 N m; Ft1 = Fa2 402 N, Ft2 = Fa1 2625 N, Fr 966 N, Fn 2824 N; P2 0.797 kW

## Losses and heat balance
- mesh 303 W, bearings 11 W, seals 7.5 W, no-load 25 W -> P_V 346 W; total efficiency 0.6852
- housing A 0.299 m^2, k 28 W/m^2K -> oil sump 61.4 deg C (limit 90: OK); thermal power limit 1.94 kW

## Load capacity (ISO/TS 14521 / DIN 3996 style, simplified)
- pitting: p*_m 0.779, E_red 150622 MPa -> sigma_Hm 275 MPa; sigma_HG 523 (Z_N 1.165, Z_v 0.861, Z_S 1.003, Z_oil 1.00) -> S_H 1.90 OK
- wear: N_L 2.81e+07, s* 57.69, s_Wm 2.36e+08 mm, J_W 1e-09 -> wear 0.236 mm (limit 1.193) -> S_W 5.05 OK
- tooth root wheel: s_ft2 9.679 (worn 9.441) mm, b2R 29.1 mm, tau_F 17.0 (worn 17.4) MPa -> S_F 5.88 (worn 5.73) OK
- worm deflection 0.0096 mm (limit 0.040) -> S_delta 4.18 OK; temperature S_T 1.46

## Inspection
- worm axial tooth thickness 6.2832 mm; over three wires D_M 6.6913 mm -> M 44.992 mm (rack approximation, check)
written: report.md, blank.csv -> example
```

**Step 5 – hand check of the main numbers.**
- γ = atan(z1 m_x / d1) = atan(4/36) = **6.340°** ✓.
- T1 = P1/ω1 = 1100 / (2π · 1450/60) = 1100 / 151.84 = **7.244 N m** ✓; T2 = T1 · i · η_z = 7.244 · 31 · 0.7248 =
  **162.8 N m** ✓ (requirement 150 N m met).
- σ_Hm = (4/π) √(p*_m · K_A T2 · 1000 · E_red / a³) = 1.2732 · √(0.779 · 203.5 · 10³ · 150 622 / 512 000)
  = 1.2732 · √46 640 = 1.2732 · 216.0 = **275 MPa** ✓.
- Wear: N_L = 46.77 · 60 · 10 000 = 2.81 · 10⁷ wheel revolutions ✓.

**Step 6 – the holding question (self-locking).** The program says: self-locking **at rest yes** (γ = 6.34° < ρ'_static
= 7.28°), **while running no** (wheel-driving efficiency 0.62 > 0). Meaning:
- When the table stops, the worm will normally hold the load.
- But the margin is small (1°), and **vibration** (presses or compressors nearby) lowers the static friction – the drive can
  creep down. While moving down, the load drives the worm with 62 % efficiency: the motor must brake.
- **Decision:** a **spring-applied motor brake** is required anyway (lifting device – safety function per EN ISO 13849 /
  Machinery Directive; self-locking is never a safety brake). The worm's self-locking is a welcome extra, not the safety
  function.

**Step 7 – manufacturing data** (from `python worm.py ch78`, last block):

```
  gamma 6.340 deg, x2 +0.000, vg 2.75 m/s, n2 46.8 rpm; eta 0.725 / reverse 0.624; self-locking rest True, running False
  T2 162.8 N m; oil 61.4 C (fan); thermal limit 1.94 kW; S_H 1.90, S_W 5.05, S_F worn 5.73, S_delta 4.18
  hob d0 36.60, radial infeed acceptable, hobbing 5.4 min; wire 6.35 -> M 43.659 mm
```

- Worm: 16MnCr5, whirled, case hardened CHD 0.6 mm, ground ZI, Ra ≤ 0.4 µm, DIN 3974 grade 6, M over 3 wires
  D 6.35 mm (nominal 43.659 mm, with the allowances of 7.7). Whirling time ≈ 1.1 min (`worm_thread_time` on the example
  input: L 88.1 mm).
- Wheel: CuSn12Ni2-C-GZ rim, bolted on a GJS-400 hub (6 fitted bolts M8 on 82.4 mm: F 823 N per bolt, τ 16.4 MPa, S 7.3 –
  `rim_bolts` on the example input), hobbed **radially** (γ = 6.3° < 8°) with a ZI hob d_0 = 36.6 mm (≈ 5.4 min per
  wheel), grade 8.
- Assembly: pattern to the leaving side for the **lifting** direction (the loaded direction), running-in programme of
  7.10, first oil change after 300–500 h.

**Result.** All proofs are met: S_H 1.90, S_W 5.05, S_F (worn) 5.73, S_δ 4.18, oil 61 °C with a fan. Input 1.1 kW, output
0.80 kW (0.75 kW required). Total efficiency 0.685 – this is the price of the high single-stage ratio and the holding
property. If energy cost matters (many hours per year), compare with a helical-bevel gear motor (η ≈ 0.95, M5 + M5b) plus
a brake.

### 8.3 Checklists

**Design.**
- [ ] i, z1 chosen; efficiency and self-locking accepted (do you need holding, or do you need back-driving?).
- [ ] a, m_x, q (6–17), x2 (−0.5 … +1.0), b2 ≤ b2_max, worm length ≥ b1_geo.
- [ ] Oil temperature ≤ limit **at the real ambient temperature** (40 °C in a hot hall changes the result!), fan / no fan.
- [ ] S_H ≥ 1.0, S_W ≥ 1.1, S_F (worn) ≥ 1.1, S_δ ≥ 1.0 (core program).
- [ ] Bearings of the worm for the large axial force F_a1 = F_t2 (M4); wheel bearings for F_a2 = F_t1.
- [ ] Comparison with a catalogue unit of the same size (rating at the same n1, i).

**Manufacturing drawing.** flank form, z1, z2, m_x, d1, α_n, hand, x2, a, grade, CHD/HRC, Ra, M over wires with D,
wheel tooth thickness allowance, hob data, bronze grade and casting, rim joint.

**Assembly.** bearing setting, pattern towards the leaving side with entry gap, backlash, no-load torque, oil level for
the mounting position, running-in, first oil change.

### 8.4 Common mistakes

1. Designing by pitting strength only – for bronze wheels **wear and temperature** usually decide.
2. Believing self-locking is a brake.
3. Using a hob of a different flank form or diameter → edge contact, hot running.
4. Pattern in the middle or at the entry side → no oil wedge, scuffing.
5. Shrink-fitted thin bronze rim without screws → slip when warm (7.5).
6. Full load on a new drive → scuffing in the first hour.
7. Wrong oil level for the mounting position (worm above the wheel).
8. Mixing polyglycol and mineral oil.

### 8.5 Limits of `worm.py`

- Only cylindrical worms with Σ = 90°. Globoid (double-enveloping) worm drives and spiroid drives are not covered.
- ISO/TS 14521 / DIN 3996 method B are **simplified** (p*_m formula for ZI, s*, J_W as typical values, Y_G = 1, Z_u not
  included, K_A applied to T2). Use the full standard (or commercial software that implements it) for a design release.
- Heat balance: one-zone model, housing area estimate 9 · 10⁻⁵ a^1.85 m², k = 14 / 28 W/m²K. A thermal test (or the
  catalogue thermal rating) is the real proof.
- Over-wire measurement: rack approximation in the axial section (exact for ZA at small γ).
- Manufacturing times, hob data and tolerances: typical values.

### 8.6 Standards and books

- **ISO/TS 14521:2020** Gears – Calculation of load capacity of worm gears.
- **DIN 3996:2019** Tragfähigkeitsberechnung von Zylinder-Schneckengetrieben mit sich rechtwinklig kreuzenden Achsen
  (method B is the basis of the simplified program).
- **DIN 3975-1/-2:2017** Begriffe und Bestimmungsgrößen für Zylinder-Schneckengetriebe (geometry, flank forms ZA, ZN, ZI,
  ZK, ZC).
- **DIN 3974-1/-2:1995** Toleranzen für Schneckengetriebe-Verzahnungen (accuracy grades).
- DIN 3964 (centre distance and axis tolerances of housings), ISO 286 (fits), ISO 14104 (grinding burn).
- **AGMA 6034** (practice for enclosed cylindrical wormgear speed reducers and gearmotors) and **AGMA 6022** (design manual
  for cylindrical wormgearing).
- **Niemann, G.; Winter, H.: Maschinenelemente, Band III** (Schraubrad-, Kegelrad-, Schnecken-, Ketten-, Riemen-,
  Reibradgetriebe…) – the standard textbook for worm gear capacity, efficiency and the ZC flank.
- **Roloff/Matek Maschinenelemente** (textbook + tables: worm geometry, b1 and b2 rules, materials).
- Maker literature: worm gear unit catalogues (thermal ratings, mounting positions, oil quantities), hob makers'
  catalogues (worm-wheel hobs, oversize, regrinding), bronze foundries' data sheets (CuSn12Ni2-C-GZ properties), thread
  grinding machine makers' application notes (ZI / ZK grinding, dressing).

### 8.7 Glossary

| Term | Meaning |
|---|---|
| Axial module m_x | Module of the worm in its axial section = transverse module of the wheel; d2 = z2 m_x |
| Diameter quotient q | q = d1/m_x; small q → slender worm (more deflection), large q → lower efficiency |
| Lead p_z, lead angle γ | Axial advance per worm revolution p_z = z1 π m_x; tan γ = p_z/(π d1) |
| Starts z1 | Number of threads of the worm (1–4, rarely 6) |
| Flank form ZA / ZN / ZI / ZK / ZC | Worm flank definition of DIN 3975 by the section in which a straight line lies or by the generating tool |
| Base cylinder d_b1 | Cylinder to which the straight generators of a ZI flank are tangent |
| Throat, throat radius r_k | Concave outer contour of the wheel rim that wraps around the worm |
| Wrap angle | Angle of the wheel face around the worm, 2 asin(b2/d_a1) |
| Sliding velocity v_g | Velocity of the flanks against each other, v_g = v1 / cos γ – drives friction, heat and wear |
| Friction angle ρ' | tan ρ' = μ_z / cos α_n |
| Self-locking (static / dynamic) | The wheel cannot drive the worm (γ < ρ'); at rest with static friction, while running with dynamic friction |
| Mean Hertzian stress σ_Hm | Mean contact stress of ISO/TS 14521 method B |
| Wear intensity J_W | Wear depth per sliding path (dimensionless); depends on lubricant, film thickness and material |
| Hob, oversize | Cutting tool copy of the worm; made larger than the worm (d_0 > d1) for regrinding and a bearing island |
| Gash | Flute that interrupts the hob thread and forms the cutting faces |
| Radial / tangential hobbing | Hob fed radially into the wheel, or fed along its own axis with a taper hob |
| Fly-cutter | Single-tooth tool on an arbor; replaces the hob for one-off wheels, tangential feed |
| Whirling | Thread cutting with a fast rotating ring of inserts around the slowly turning worm |
| Centrifugal casting (GZ) | Casting in a rotating mould: dense fine-grain bronze, standard for worm-wheel rims |
| Marking blue | Thin paste on the worm to print the contact pattern on the wheel |
| Entry / leaving side | Side of the wheel face where the worm thread enters / leaves the mesh; pattern towards the leaving side |
| Running-in | First hours at stepped load in which the bronze wears into the shape of the worm |
| Double-flank roll test | Wheel rolled in tight mesh with a master worm; the centre-distance variation shows composite errors |
| Over-wire size M | Size over three measuring wires of diameter D in the worm thread – measures the tooth thickness |
