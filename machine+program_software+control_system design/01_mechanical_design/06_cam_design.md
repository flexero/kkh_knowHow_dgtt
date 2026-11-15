# M6 – Cam design: motion laws (VDI 2143), cam geometry, dynamics and lift-off, contact stress, manufacturing

> Field 1 *Mechanical design*, item 6.
> **Theory and program are combined:** every formula is followed by the code of `tools/cam.py`, the command and the real
> output. MATLAB mirror: `tools/cam.m`. Web: tab **M_P_C tools**, item 12. Python standard library only – offline.
> **All inputs are example values.** Allowable pressure angle, allowable Hertz stress, curvature limits, friction and
> dynamic data are typical values; values marked "check" must be compared with VDI 2143 / VDI 2741, the track-roller
> maker and your material data before a design is released.

## Contents
0. How to use this guide with the program
1. Purpose – what a cam design must prove
2. Cam mechanisms, followers and motion laws (VDI 2143)
3. Motion programme and kinematics (segments, boundary conditions, polynomials, characteristic values)
4. Cam geometry: pitch curve, profile, pressure angle, radius of curvature, undercut, base-circle sizing, offset, oscillating and flat-faced followers
5. Dynamics: forces, spring and lift-off, follower vibration, camshaft torque and drive
6. Contact stress, roller bearing life, lubrication and roller slip
7. Manufacturing of cams (materials, process chains, NC data, milling, hardening, grinding with X–C interpolation, inspection, harmonic errors, assembly)
8. Verification, complete worked example, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python cam.py params` | Default input as JSON (copy → edit → `--in`) |
| `python cam.py run --in my.json --out res` | Full calculation → `report.md`, `profile.csv` (lift, profile, pitch and cutter-centre points, pressure angle, radius every 0.5°) |
| `python cam.py examples` | Report of the default cam, characteristic values of all laws, rise-law comparison, speed vs lift-off |
| `python cam.py ch24` / `ch56` / `ch78` | Extra results of chapters 2–4 / 5–6 / 7–8 |
| `python cam.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=12#mpc` | Same calculation with KPIs, cam-profile drawing, s-v-a diagrams, contact force and pressure angle over the revolution |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Normalised motion laws from their acceleration shape (cycloidal, simple harmonic, 3-4-5, 4-5-6-7, modified sine, modified trapezoid), smooth interpolation, characteristic values C_v, C_a, C_j | `LAWS`, `law_table()`, `law_values()`, `characteristic_values()` |
| 3 | Motion programme of rise / dwell / return segments; s, s′, s″, s‴ over the cam angle | `check_segments()`, `motion()`, `segment_at()` |
| 4 | Pitch curve, profile (offset by the roller radius), pressure angle, radius of curvature, undercut, base-circle sizing | `pitch_point()`, `sweep()`, `geometry_summary()`, `size_base_circle()` |
| 5 | Inertia, spring and external forces, contact force, lift-off, minimum preload, normal and side force, camshaft torque | `dynamics()`, `jump_check()` |
| 6 | Hertz line contact roller–cam, safety, roller speed | `hertz_line()`, `contact()` |
| 7 | Cutter / grinding-wheel centre path and gouging check, NC profile CSV | `tool_path()`, `run()` |
| – | Report | `report_text()` |
| 2–4 | Cam / follower / motion-task tables, law characteristic table and samples, harmonic jerk at a dwell, polynomial law from boundary conditions (Gauss), R–G transfer, velocity matching, offset study, base-circle curve, roller-size undercut map, Flocke nomogram, oscillating roller follower, flat-faced follower | `law_char_table()`, `law_samples()`, `harmonic_jerk_at_dwell()`, `gauss_solve()`, `poly_bc()`, `poly_eval()`, `poly_char()`, `r_g_transfer()`, `velocity_matching_check()`, `offset_study()`, `base_circle_curve()`, `roller_size_study()`, `phi_max_single()`, `nomogram()`, `osc_center()`, `osc_point()`, `osc_summary()`, `flat_faced()`, `CAM_TYPES`, `FOLLOWER_TYPES`, `MOTION_TASKS`, `STEEP_SEGMENTS`, `OSC_DEFAULT` |
| 5–6 | Guide forces and jamming, lift-off speed, spring requirement, helical spring, follower vibration (RK4) and residual-vibration table, torque harmonics, flywheel, contact materials, crowned roller, contact detail, track-roller life, film thickness, roller slip | `guide_forces()`, `jam_table()`, `lift_off_speed()`, `spring_requirement()`, `helical_spring()`, `sdof_rise()`, `residual_table()`, `follower_vibration()`, `torque_harmonics()`, `flywheel()`, `crowned_contact()`, `contact_detail()`, `track_roller_life()`, `film_thickness()`, `roller_slip()`, `CONTACT_MATERIALS` |
| 7–8 | Process chains and materials, chordal error and NC step, adaptive points, milling time, X–C grinding (wheel centre, axis demand, constant surface speed, time, burn), probe lift, harmonic profile errors and DFT, timing error, roller misalignment, defects table, worked example | `chord_error()`, `profile_speed()`, `nc_step_for_tol()`, `adaptive_points()`, `profile_length()`, `milling_time()`, `wheel_centre_radius()`, `xc_axis_demand()`, `constant_surface_speed()`, `grinding_time()`, `grinding_burn_check()`, `lift_with_probe()`, `probe_vs_design()`, `harmonic_error_effect()`, `k_for_liftoff()`, `synthetic_lift_error()`, `dft_amplitudes()`, `timing_error()`, `roller_misalignment()`, `worked_example()`, `PROCESS_CHAINS_CAM`, `CAM_MATERIALS`, `DEFECTS_CAM`, `EXAMPLE_CAM` |
Example input of chapter 8: `tools/examples/cam_example.json`.

### 0.3 What the self-test proves
1. The characteristic values C_v and C_a of all six laws agree with the published values (cycloidal 2 / 2π, harmonic π/2 / π²/2, 3-4-5 1.875 / 5.774, 4-5-6-7 2.1875 / 7.513, modified sine 1.760 / 5.528, modified trapezoid 2 / 4.888).
2. The numerically integrated laws match the closed forms (cycloidal, 3-4-5).
3. Every profile point lies exactly one roller radius from its pitch point; the computed radius of curvature equals the circle through three neighbouring pitch points; s′ equals the numerical derivative.
4. For e = 0 the pitch radius is R0 + r + s and tan φ = s′/(R_p + s).
5. Energy: the camshaft work per revolution equals the external work (spring and inertia give their energy back).
6. Hertz formula for two equal cylinders; the sized base circle meets the allowable pressure angle.

## 1. Purpose – what a cam design must prove

A cam turns a uniform rotation into a precisely timed follower motion – pushers, feeders, valve trains, indexers, needle
bars. It is still the best solution when the motion is **fixed, fast and repeated millions of times**: no controller, no
servo tuning, exact timing. The design must prove:

| Proof | Question | Chapter |
|---|---|---|
| Motion | Does the law give finite jerk, low acceleration and low vibration for this task? | 2, 3 |
| Geometry | Pressure angle small enough (no jamming), no undercut, cam not too big | 4 |
| Dynamics | Does the roller stay on the cam at full speed (no lift-off)? Spring, torque, drive | 5 |
| Contact | Hertz stress, roller bearing life, no roller skidding | 6 |
| Manufacture | NC data accurate enough, grinding possible in concave parts, profile errors small enough | 7 |

**Default example** (`python cam.py examples`): disc cam for a packaging-machine pusher. Stroke 20 mm, rise 120° with
modified sine, dwell 60°, return 120° cycloidal, dwell 60°, 300 rpm. Base circle 40 mm, roller Ø20 × 12 mm, no offset,
follower mass 2.5 kg, spring 3 N/mm with 30 N preload, 100 N process load during the rise.

| Result | Value |
|---|---|
| Rise / return | v_max 0.528 / 0.600 m/s, a_max 24.9 / 28.3 m/s² |
| Geometry | pressure angle +15.8° / −17.9° (allowed 30°); smallest profile radius 37.8 mm, fully convex; R0 could be 14.3 mm for φ only |
| Dynamics | contact force min **13.1 N** at 213° (early return – the spring has to pull the follower down); camshaft torque −1.56 … 2.78 N m |
| Speed limit | lift-off between 300 and 400 rpm (at 400 rpm a preload of 72 N would be needed) |
| Contact | Hertz stress 260 MPa (S 6.3), roller speed up to 1800 rpm |


---

## 2. Cam mechanisms, followers and motion laws (VDI 2143)

A cam mechanism turns a **uniform rotation** (the camshaft, often the main shaft of a machine) into a **prescribed
non-uniform motion** of a follower: a stroke with dwells, a transfer with a given speed, a reversal. Before servo drives
became cheap, every packaging, textile, printing and assembly machine was a "cam machine"; today cams are still used
where the motion is fixed, the speed is high and the machine must run for years without a controller: valve trains,
indexers, presses, high-speed packaging, tool changers.

The design question of a cam always has three layers:
1. **Motion** – which displacement s(θ) does the follower need (stroke, dwell, timing)? → motion programme (chapter 3).
2. **Geometry** – which cam contour produces s(θ) with acceptable pressure angle and curvature? → chapter 4.
3. **Strength and dynamics** – can the follower keep contact, can the roller and the cam carry the load? → chapters 5–6.

### 2.1 Cam types

| Type | Contact closure | Typical use | Remark |
|---|---|---|---|
| Disc (radial) cam | spring / gravity (force closure) | packaging, valve trains, feeders | simplest, cheapest; lift-off risk at high speed |
| Grooved disc cam (positive drive) | form closure (roller in a groove) | presses, sewing and textile machines | no spring; the roller changes its direction of rotation at every flank change → backlash, wear |
| Conjugate (double disc) cam | form closure with two rollers on two discs | high-speed indexers, printing | no backlash with preload; the two profiles must match (ground together) |
| Cylindrical (barrel) cam | groove on a cylinder | axial strokes, tool changers, assembly | follower moves parallel to the camshaft |
| Globoid cam (roller-gear indexer) | several rollers engaged at once | rotary indexing tables, tool changers | very stiff, preloaded; made on special 5-axis machines |
| Face cam | groove or rib on a disc face | light mechanisms | follower moves radially in the face plane |

The program of this guide handles the **disc cam with a roller follower**, the type that is designed most often and
from which the other types are derived (a groove cam is two disc profiles at distance 2·r_r; a conjugate cam is two disc
cams with a phase shift; a barrel cam is a disc cam "unrolled" on a cylinder).

```
python cam.py ch24
```
```
## 2.1 Cam types
  disc (radial) cam                    | spring / gravity (force closure)       | packaging, valve trains, feeders     | simplest, cheapest; lift-off risk at speed
  grooved disc cam (positive drive)    | form closure (roller in a groove)      | presses, sewing and textile machines | no spring; roller changes rotation at every flank change -> backlash, wear
  conjugate (double disc) cam          | form closure, two rollers on two discs | high-speed indexers, printing        | no backlash with preload; two profiles must match (grinding together)
  cylindrical (barrel) cam             | groove on a cylinder, form closure     | axial strokes, tool changers, assembly | follower moves parallel to the cam axis
  globoid cam (roller-gear indexer)    | form closure, several rollers engaged  | rotary indexing tables, ATC          | very stiff, preloaded; made on special 5-axis machines
  face cam                             | groove or rib on a disc face           | light mechanisms                     | follower moves radially in the face plane
```

**Force closure vs form closure.** With force closure (spring, gravity, air cylinder) the cam can only *push*; the return
motion and the deceleration at the end of a rise must be produced by the spring. If the follower's inertia force is
larger than the spring force, the follower **lifts off** ("jump", chapter 5). Form closure (groove, conjugate cam) can push
and pull, but every backlash in the groove causes an impact when the force changes sign. That is why fast indexers use
conjugate cams with *preloaded* rollers.

### 2.2 Follower types

```
## 2.2 Follower types
  translating roller               | low friction (rolling), pressure angle limit ~30 deg               | default of this guide
  oscillating roller (lever)       | pressure angle limit ~45 deg, stroke amplified by the lever        | chapter 4.8
  translating flat-faced (mushroom) | pressure angle 0 (no offset), needs a convex cam (R0 + s + s'' > 0) | valve trains, chapter 4.9
  knife edge                       | point contact, very high stress and wear                           | only instruments / very light loads
```

- **Roller followers** are standard in machines. The roller is a *track roller* (cam follower) – a needle or cylindrical
  roller bearing with a thick outer ring and a crowned or cylindrical running surface (chapter 6). Rolling friction is low
  (μ ≈ 0.002–0.005), but the roller must be accelerated at each contact change, and it slips if the load is too small.
- **Flat-faced followers** (automotive valve tappets) have no pressure angle problem (the force is always along the
  follower axis when there is no offset), but the cam must be **convex everywhere** and the contact slides, so it needs
  good lubrication.
- **Oscillating followers** (levers) are used when the output must move on an arc, or to amplify a small cam stroke; the
  allowable pressure angle is larger (≈ 45°, check) because the guide is a pivot bearing, not a sliding guide that can jam.

The allowable pressure angle of a **translating** roller follower is usually **30°** (`phi_allow` in DEFAULT, check
VDI 2143 / the guide design): the side force F_n·sin φ loads the follower guide; with a long overhang and friction the
guide can jam (self-locking) at φ ≈ 40–50°.

### 2.3 Motion laws – the normalised description

All motion laws of VDI 2143 are written in a **normalised** form: for one segment (a rise or a return) the cam angle
runs from the start θ_0 to θ_0 + β and the follower moves the stroke h. With

  x = (θ − θ_0)/β  (0 … 1),  y(x) = s/h  (0 … 1)

every law is a function y(x) with derivatives y′ = dy/dx, y″ = d²y/dx², y‴ = d³y/dx³. Scaling back to the cam:

  s(θ) = h·y(x)
  s′ = ds/dθ = h·y′/β              [mm/rad]
  s″ = d²s/dθ² = h·y″/β²           [mm/rad²]
  s‴ = d³s/dθ³ = h·y‴/β³           [mm/rad³]

and with a constant cam speed ω (dθ/dt = ω):

  v = s′·ω,  a = s″·ω²,  j = s‴·ω³.

This scaling explains the most important design rule of cams:

> **The acceleration grows with ω² and with 1/β².** Doubling the speed gives 4× the inertia forces; halving the rise
> angle gives 4× the acceleration as well. A short rise angle at high speed is the expensive combination.

The **characteristic values** compare the laws independently of h, β, ω:

  C_v = max |y′|, C_a = max |y″|, C_j = max |y‴|

so that v_max = C_v·h·ω/β, a_max = C_a·h·ω²/β², j_max = C_j·h·ω³/β³.

**How the program computes a law.** Instead of coding six closed formulas, `cam.py` defines the *shape of the
acceleration* of each law and integrates it twice; the scale is fixed by y(1) = 1. This is exactly how the laws were
invented (the designer chooses the acceleration diagram) and it makes it easy to add a new law:

```python
def _acc_shape(law):
    """Acceleration shape a(x) on 0..1 (any scale); y is obtained by integration and normalised to y(1) = 1."""
    p = math.pi
    if law == "cycloidal":
        return lambda x: math.sin(2 * p * x)
    if law == "harmonic":
        return lambda x: math.cos(p * x)
    if law == "poly345":
        return lambda x: 60 * x - 180 * x ** 2 + 120 * x ** 3
    ...
    if law == "modsine":
        def a(x):
            if x <= 0.125:
                return math.sin(4 * p * x)
            if x <= 0.875:
                return math.cos(4 * p / 3 * (x - 0.125))
            return -math.cos(4 * p * (x - 0.875))
        return a
```

```python
def law_table(law, N=4000):
    """y, y', y'', y''' on N+1 points (integration of the acceleration shape with the trapezoid rule, then normalised)."""
    ...
    V = [0.0]
    for i in range(N):
        V.append(V[-1] + 0.5 * (A[i] + A[i + 1]) / N)
    Y = [0.0]
    for i in range(N):
        Y.append(Y[-1] + 0.5 * (V[i] + V[i + 1]) / N)
    c = 1.0 / Y[-1]
    Y = [y * c for y in Y]
    V = [v * c for v in V]
    A = [x * c for x in A]
```

Between the 4000 table points `law_values()` uses **cubic Hermite interpolation** of y (with the stored y′ as slope) and
of y′ (with y″ as slope). This matters: with plain linear interpolation y would be a polygon, and a radius of
curvature computed from three close points would be wrong (the self-test "radius of curvature = circle through 3 near
pitch points" checks this).

**Why the acceleration shapes look like this:**

- **Cycloidal**: a(x) = sin 2πx – one full sine wave. Acceleration is zero at both ends (smooth start from a dwell),
  jerk is finite everywhere. The safe standard law for dwell–rise–dwell.
- **Simple harmonic**: a(x) = cos πx – the follower is the projection of a point moving on a circle. Lowest C_a after the
  trapezoid laws, but y″(0) = π²/2 ≠ 0: at a dwell the acceleration jumps.
- **3-4-5 polynomial**: the lowest-order polynomial with y, y′, y″ prescribed at both ends.
- **4-5-6-7 polynomial**: also y‴ = 0 at the ends (smooth jerk) – high C_a.
- **Modified sine** (Hrones / VDI 2143): quarter sine waves of period 1/2 at the ends (steep, like cycloidal) and a slow
  sine wave of period 3/2 in the middle. Low C_v (1.76) – the best law when the **velocity** (motor power, roller speed)
  is the limit.
- **Modified trapezoid**: like a trapezoidal acceleration diagram with sine-shaped corners – the lowest C_a (4.89) of the
  laws with zero end acceleration, but high jerk.

### 2.4 Characteristic values

```
python cam.py examples      (excerpt)
```
```
## Characteristic values of the motion laws (VDI 2143 style)
  cycloidal C_v 2.000  C_a 6.283  C_j     39.5
  harmonic  C_v 1.571  C_a 4.935  C_j     15.5
  poly345   C_v 1.875  C_a 5.774  C_j     60.0
  poly4567  C_v 2.187  C_a 7.513  C_j     52.5
  modsine   C_v 1.760  C_a 5.528  C_j     69.5
  modtrap   C_v 2.000  C_a 4.888  C_j     61.4
```

The self-test compares these with the published values (VDI 2143 / Norton): cycloidal 2 / 2π, harmonic π/2 / π²/2,
3-4-5 1.875 / 5.7735, 4-5-6-7 2.1875 / 7.5132, modified sine 1.7596 / 5.5280, modified trapezoid 2.0 / 4.8881 – all agree
to better than 0.003. (The C_j of the harmonic law, 15.5 = π³/2, is the value *inside* the segment; the jump at the
ends is not included – see 2.6.)

The add-on table adds two more columns used for selection:

- **C_v·C_a** – the product governs the **maximum inertia power** v·a ∝ C_v·C_a·h²ω³/β³ (motor and camshaft torque if
  inertia dominates).
- **max |y′y″|** – the exact peak of the inertia power (the product of the two maxima is an upper bound because they do
  not occur at the same x).
- **y″(0), y″(1)** – acceleration at the ends: must be 0 for a law that starts or ends at a dwell.

```
python cam.py ch24
```
```
## 2.4 Characteristic values (normalised)
  law        C_v    C_a     C_j    C_v*C_a  max|y'y''|  y''(0)  y''(1)
  cycloidal 2.000  6.283    39.5   12.566      8.162    0.000  -0.000
  harmonic  1.571  4.935    15.5    7.752      3.876    4.935  -4.935
  poly345   1.875  5.774    60.0   10.825      6.694    0.000   0.000
  poly4567  2.187  7.513    52.5   16.435     10.750    0.000   0.000
  modsine   1.760  5.528    69.5    9.727      5.458    0.000  -0.000
  modtrap   2.000  4.888    61.4    9.776      8.090    0.000  -0.000
```

The code:

```python
def law_char_table():
    """C_v, C_a, C_j, C_v*C_a, power factor max(y' y''), acceleration at the ends (jump -> infinite jerk at a dwell)."""
    rows = []
    for law in LAWS:
        T = law_table(law)
        c = characteristic_values(law)
        cp = max(abs(v * a) for v, a in zip(T["v"], T["a"]))
        rows.append({"law": law, "Cv": c["Cv"], "Ca": c["Ca"], "Cj": c["Cj"], "CvCa": c["Cv"] * c["Ca"], "Cp": cp,
                     "a0": T["a"][0], "a1": T["a"][-1]})
    return rows
```

**Law selection guide** (dwell–rise–dwell, typical shop practice, check VDI 2143):

| Limit of the design | Best law | Why |
|---|---|---|
| Inertia force / lift-off / Hertz stress at high speed | modified trapezoid, then modified sine | lowest C_a |
| Velocity: motor power, roller speed, impact at the end of a transfer | modified sine | lowest C_v (1.76) |
| Vibration of an elastic follower, noise | cycloidal or 4-5-6-7 | low jerk, smooth spectrum |
| General purpose, robust against speed changes | modified sine or cycloidal | good balance |
| Between two reversals (no dwell) | simple harmonic | lowest C_a, end acceleration allowed |
| Simple programme with velocity conditions | polynomial (chapter 3.3) | any boundary condition |

### 2.5 The modified sine sampled

```
## 2.5 Sampled modified sine (x, y, y', y'', y''')
  x 0.000  y 0.00000  y' 0.0000  y'' +0.0000  y'''   +69.47
  x 0.125  y 0.01998  y' 0.4399  y'' +5.5280  y'''    +0.05
  x 0.250  y 0.11718  y' 1.0998  y'' +4.7874  y'''   -11.58
  x 0.375  y 0.28748  y' 1.5828  y'' +2.7640  y'''   -20.05
  x 0.500  y 0.50000  y' 1.7596  y'' +0.0000  y'''   -23.16
  x 0.625  y 0.71252  y' 1.5828  y'' -2.7640  y'''   -20.05
  x 0.750  y 0.88282  y' 1.0998  y'' -4.7874  y'''   -11.58
  x 0.875  y 0.98002  y' 0.4399  y'' -5.5280  y'''    +0.05
  x 1.000  y 1.00000  y' 0.0000  y'' -0.0000  y'''   +69.47
```

Read the table like an engineer:
- the maximum acceleration C_a = 5.528 is reached already at x = 1/8 – the steep sine quarter gets the follower moving;
- the maximum velocity C_v = 1.7596 is at the middle x = 0.5, where y″ changes sign;
- the jerk is largest at the ends (69.5) – the price of the steep start; this is why modified sine excites vibration of
  an elastic follower slightly more than cycloidal (C_j 39.5);
- the law is antisymmetric: y(1 − x) = 1 − y(x).

**Hand check of y at x = 0.125.** On the first piece y″ = A sin 4πx with A = C_a = 5.528 (scale). Integrating twice from
zero: y = A·(x/(4π) − sin 4πx/(4π)²). At x = 1/8: y = 5.528·(0.125/12.566 − 1/157.91) = 5.528·(0.009947 − 0.006333)
= 0.01998. ✓ (table: 0.01998)

### 2.6 Why simple harmonic is bad between dwells

```
## 2.6 Simple harmonic between dwells: acceleration jump at the dwell (300 rpm, beta 120 deg)
  jump 22.21 m/s^2 in zero time -> jerk theoretically infinite
```

```python
def harmonic_jerk_at_dwell(P=None, beta_deg=120.0):
    """Simple harmonic between dwells: acceleration jumps from 0 to h pi^2/(2 beta^2) omega^2 -> theoretically infinite jerk."""
    ...
    return P["h"] * math.pi ** 2 / 2 / b ** 2 * w ** 2 / 1000.0      # m/s^2 jump
```

Hand check: h = 20 mm, β = 2.0944 rad, ω = 31.416 rad/s: a = 20·4.9348/4.3865·986.96/1000 = 22.21 m/s². ✓

During the dwell the follower has a = 0; at the first moment of the rise it should have 22 m/s². A real follower is
elastic, so the acceleration step becomes a **force step** that excites the follower's natural frequency: it oscillates,
the contact force swings, and the cam surface sees impacts at every revolution (noise, pitting, wear). The same step
(with opposite sign) happens at the top dwell. **Rule:** a law used next to a dwell must have y″ = 0 at that end – all
laws in the table except simple harmonic. Simple harmonic is fine between two **reversals** (task U–U, 2.7) where no
dwell is next to it.

### 2.7 VDI 2143 movement tasks

VDI 2143 sorts motion segments by the state at their two ends: **R** = Rast (dwell, v = 0, a = 0), **G** =
Gleichgeschwindigkeit (constant velocity, a = 0), **U** = Umkehr (reversal, v = 0 but a ≠ 0), **B** = Bewegung (general
motion: v ≠ 0, a ≠ 0).

```
## 2.3 VDI 2143 movement tasks
  R-R  dwell (Rast)   -> dwell                                      y'(0)=y'(1)=0, y''(0)=y''(1)=0 -> cycloidal, modsine, modtrap, 3-4-5, 4-5-6-7
  R-G  dwell          -> constant velocity (Gleichgeschwindigkeit)  y'(0)=0, y''(0)=0; y'(1)=v1, y''(1)=0 -> polynomial with end velocity
  G-R  constant velocity -> dwell                                      mirror of R-G
  G-G  constant velocity -> constant velocity                          y'(0)=v0, y'(1)=v1, y''=0 at both ends (velocity change)
  R-U  dwell          -> reversal (Umkehr)                          y'(0)=0, y''(0)=0; y'(1)=0, y''(1) != 0 (turning point at the top, no dwell)
  U-U  reversal       -> reversal                                   y'=0 at both ends, y'' != 0 -> e.g. simple harmonic is ideal here
```

The task decides the **boundary conditions** of y; the law must satisfy them, and at every junction between two
segments s, s′ and s″ must be continuous (chapter 3.4). The standard laws of the table solve only R–R; the other tasks
need laws built for them – most easily polynomials (3.3).

---

## 3. Motion programme and kinematics (segments, boundary conditions, polynomials, characteristic values)

### 3.1 The motion programme

A cam turns 360° per machine cycle. The **motion diagram** (Bewegungsplan) divides the revolution into segments. The
default example is a packaging-machine pusher:

| Segment | Cam angle | Task | Law |
|---|---|---|---|
| rise 20 mm | 0–120° | R–R | modified sine |
| dwell (top) | 120–180° | – | – |
| return 20 mm | 180–300° | R–R | cycloidal |
| dwell (bottom) | 300–360° | – | – |

```python
"segments": [
    {"kind": "rise", "law": "modsine", "beta": 120.0},
    {"kind": "dwell", "beta": 60.0},
    {"kind": "return", "law": "cycloidal", "beta": 120.0},
    {"kind": "dwell", "beta": 60.0},
],
```

`check_segments()` refuses a programme whose angles do not add up to 360°. How to choose the angles in practice:
1. The **process** fixes the dwells (the pusher must stand still while the product is placed / sealed).
2. The remaining angle is shared by rise and return. Because a ∝ 1/β², give the **longer angle to the segment with the
   larger mass or external load**, and use the remaining time for the return.
3. In a machine with several cams (one main shaft) the segments of all cams are drawn in one **timing diagram** so that
   tools do not collide; the angles are a compromise between cams.

### 3.2 Kinematics in the program

```python
def motion(P, theta_deg):
    """Follower displacement s (mm), s' = ds/dtheta (mm/rad), s'' (mm/rad^2), s''' (mm/rad^3) at cam angle theta."""
    ...
            x = (th - a0) / b
            br = math.radians(b)
            if seg["kind"] == "dwell":
                return lift, 0.0, 0.0, 0.0
            y, v, a, j = law_values(seg["law"], x)
            sg = 1.0 if seg["kind"] == "rise" else -1.0
            h = P["h"]
            base = 0.0 if seg["kind"] == "rise" else h
            return base + sg * h * y, sg * h * v / br, sg * h * a / br ** 2, sg * h * j / br ** 3
```

This is the scaling of 2.3 in code: `h*v/br` is h·y′/β, `h*a/br**2` is h·y″/β². A return is a mirrored rise
(s = h − h·y).

**Hand check (θ = 30°, x = 0.25 of the modified sine rise).** From the table in 2.5: y = 0.11718, y′ = 1.0998,
y″ = 4.7874. With h = 20 mm, β = 120° = 2.0944 rad:

- s = 20·0.11718 = 2.3436 mm
- s′ = 20·1.0998/2.0944 = 10.502 mm/rad
- s″ = 20·4.7874/2.0944² = 95.748/4.3865 = 21.828 mm/rad²

Program (`pitch_point(P, 30)`): s 2.343570, s′ 10.501859, s″ 21.827712. ✓

The core report converts the maxima into machine values (ω = 2π·300/60 = 31.416 rad/s):

```
python cam.py examples      (excerpt)
```
```
## Motion programme
- rise 120.0 deg, modsine (C_v 1.760, C_a 5.528, C_j 69.5): v_max 0.528 m/s, a_max 24.9 m/s^2, jerk_max 4689 m/s^3
- dwell 60.0 deg
- return 120.0 deg, cycloidal (C_v 2.000, C_a 6.283, C_j 39.5): v_max 0.600 m/s, a_max 28.3 m/s^2, jerk_max 2665 m/s^3
- dwell 60.0 deg
```

Hand check of the rise: v_max = 1.7596·20·31.416/2.0944/1000 = 0.528 m/s; a_max = 5.528·20·986.96/4.3865/1000 =
24.88 m/s² (2.5 g); j_max = 69.5·20·31006/9.187/1000 ≈ 4690 m/s³. ✓ The return uses the cycloidal law with the larger
C_a (6.283) and so has the larger acceleration (28.3 m/s²) – for the return the spring must provide the deceleration
force, so this is the critical segment for lift-off (chapter 5). Changing the return law to modified trapezoid would
reduce a_max to 24.9·4.888/5.528 ≈ 22.0 m/s².

### 3.3 Polynomials with arbitrary boundary conditions

Tasks other than R–R need a law with **given end values**. The general tool is a polynomial

  y(x) = c_0 + c_1 x + c_2 x² + c_3 x³ + c_4 x⁴ + c_5 x⁵

with six coefficients for six conditions: y, y′, y″ at x = 0 and at x = 1. The conditions give a linear system

  Σ c_k x^k = y,  Σ k c_k x^(k−1) = y′,  Σ k(k−1) c_k x^(k−2) = y″  (at x = 0 and x = 1)

which the add-on solves with Gaussian elimination (no numpy – offline stdlib):

```python
def poly_bc(y0=0.0, v0=0.0, a0=0.0, y1=1.0, v1=0.0, a1=0.0):
    """5th-order normalised law y = sum c_k x^k with y, y', y'' given at x = 0 and x = 1."""
    rows, rhs = [], []
    for x, (y, v, a) in ((0.0, (y0, v0, a0)), (1.0, (y1, v1, a1))):
        rows.append([x ** k for k in range(6)]); rhs.append(y)
        rows.append([k * x ** (k - 1) if k >= 1 else 0.0 for k in range(6)]); rhs.append(v)
        rows.append([k * (k - 1) * x ** (k - 2) if k >= 2 else 0.0 for k in range(6)]); rhs.append(a)
    return gauss_solve(rows, rhs)
```

**Check 1 – zero end conditions must give the 3-4-5 law.** With y′ = y″ = 0 at both ends the solution is unique:

```
## 3.3 Polynomial with arbitrary boundary conditions
  zero end conditions -> c = [0.0000, 0.0000, 0.0000, 10.0000, -15.0000, 6.0000]  (3-4-5 law)
```

y = 10x³ − 15x⁴ + 6x⁵ – exactly the 3-4-5 law of `cam.py` (self-test "poly345 closed form"). ✓

**Example – R–G transfer.** A pusher must accelerate from rest and *hand over* a product to a conveyor running at
V = 0.25 mm per cam degree, after a rise h_1 = 15 mm in β_1 = 90°. In normalised units the end velocity is

  y′(1) = V·β_1/h_1 = 0.25·90/15 = 1.5 (y′ is per unit x, x = θ/β_1).

```
  R-G transfer h1 15 mm / 90 deg into V 0.25 mm/deg: v1 = 1.500; c = [0.0000, 0.0000, 0.0000, 4.0000, -4.5000, 1.5000]
  C_v 1.536, C_a 3.151, C_j 24.0, y in [0.0000, 1.0000]
```

So y = 4x³ − 4.5x⁴ + 1.5x⁵. Hand check of the end conditions: y(1) = 4 − 4.5 + 1.5 = 1 ✓; y′(1) = 12 − 18 + 7.5 = 1.5 ✓;
y″(1) = 24 − 54 + 30 = 0 ✓. Note C_v = 1.536 > 1.5: the follower slightly overshoots the conveyor speed before it settles
to it – acceptable here, but a reason to check every polynomial with `poly_char()`.

**The danger of polynomials – overshoot.** If the end velocity is too high for the stroke, the polynomial first moves
*backwards* (y < 0) to "gain run-up":

```
  v1 1.0: C_a 3.940, y_min 0.0000, y_max 1.0000 
  v1 2.0: C_a 3.000, y_min 0.0000, y_max 1.0000 
  v1 3.0: C_a 6.302, y_min -0.0128, y_max 1.0000 
```

At v1 = 3 the follower dips 0.0128·h below its start – the cam would have to pull the follower below the base circle.
**Always check y_min ≥ 0 and y_max ≤ 1** (unless the overshoot is wanted). C_a has a minimum around v1 = 2 (3.000): for
a given stroke there is a "natural" end velocity that needs the least acceleration (v1 = 2 is the value of a constant
acceleration ramp, y = x²).

### 3.4 Continuity at segment boundaries (velocity and acceleration matching)

At every junction θ_k the motion must be continuous in s, s′, s″ – otherwise velocity jumps cause impacts and
acceleration jumps cause infinite jerk (2.6). The add-on evaluates left and right limits:

```python
def velocity_matching_check(P=None, eps=1e-3):
    """Continuity of s, s', s'' across every segment boundary of the motion programme (left / right limits)."""
    ...
        L = motion(P, a0 - eps)
        R = motion(P, (a0 + eps) % 360.0)
        out.append({"theta": a0 % 360.0, "ds": R[0] - L[0], "dv": R[1] - L[1], "da": R[2] - L[2]})
```

```
## 3.4 Continuity at the segment boundaries of the default programme
  theta 120.0: jump s +6.03e-12 mm, s' -2.30e-08 mm/rad, s'' +2.64e-03 mm/rad^2
  theta 180.0: jump s -3.43e-12 mm, s' -1.31e-08 mm/rad, s'' -1.50e-03 mm/rad^2
  theta 300.0: jump s -3.42e-12 mm, s' +1.31e-08 mm/rad, s'' -1.50e-03 mm/rad^2
  theta   0.0: jump s +6.03e-12 mm, s' +2.30e-08 mm/rad, s'' +2.64e-03 mm/rad^2
```

The remaining "jumps" are only the change over ±0.001° (s″ changes by a few 10⁻³ mm/rad² over that tiny step because y‴
≠ 0 at the ends) – the programme is continuous up to the acceleration. A programme mixing an R–G polynomial with a
following constant-velocity segment must be checked the same way: v1 of the polynomial must equal the velocity of the
G segment *in mm/rad*, not in normalised units (the normalisation differs when the segment angles differ).

### 3.5 Choice of law changes the whole machine

The core example run changes only the rise law:

```
python cam.py examples      (excerpt)
```
```
## Same programme, rise law changed
  cycloidal phi_max 17.85 deg, Fc_min   13.1 N, p_max   269 MPa
  harmonic  phi_max 14.23 deg, Fc_min   13.1 N, p_max   254 MPa
  poly345   phi_max 16.81 deg, Fc_min   13.1 N, p_max   265 MPa
  poly4567  phi_max 19.40 deg, Fc_min   13.1 N, p_max   277 MPa
  modsine   phi_max 15.84 deg, Fc_min   13.1 N, p_max   260 MPa
  modtrap   phi_max 17.78 deg, Fc_min   13.1 N, p_max   271 MPa
```

(Default: 2.5 kg follower, spring 3 N/mm with 30 N preload, 100 N process load on the rise.)
- The **pressure angle** on the rise follows C_v directly (tan φ ≈ s′/(R_p + s) and s′ ∝ C_v): simple harmonic (C_v 1.57)
  14.2°, modified sine (C_v 1.76) 15.8°, 4-5-6-7 (C_v 2.19) 19.4°.
- The **Hertz stress** follows the contact force on the rise (process load + spring + inertia) and the pressure angle
  (F_n = F_c/cos φ): modified sine is the lowest of the dwell-capable laws (260 MPa), 4-5-6-7 the highest (277 MPa).
- The **minimum contact force** (13.1 N) does not change, because it occurs on the *return* (cycloidal, at 213°), which
  was not changed – on the rise the cam pushes the follower against the 100 N process force.

---

## 4. Cam geometry: pitch curve, profile, pressure angle, radius of curvature, undercut, base-circle sizing, offset, oscillating and flat-faced followers

### 4.1 Coordinates and the pitch curve

The cam turns counter-clockwise by θ. Instead of moving the cam we use the **inversion** principle: in a frame fixed to
the cam, the follower turns clockwise around the cam by −θ. The **pitch curve** is the path of the *roller centre* in
the cam frame; the **cam profile** is the pitch curve moved inwards by the roller radius r_r.

Definitions (DEFAULT):
- R_0 = 40 mm – base circle of the **profile** (smallest profile radius at the lower dwell)
- r_r = 10 mm – roller radius, R_p = R_0 + r_r = 50 mm – base circle of the **pitch curve**
- e = 0 – offset of the follower axis from the cam centre
- s_0 = √(R_p² − e²) – height of the roller centre at s = 0

In the fixed frame the roller centre is at q = (e, s_0 + s). In the cam frame it is the point q rotated by −θ:

  P(θ) = R(−θ)·q(θ),  R(α) = [[cos α, −sin α], [sin α, cos α]].

```python
    s, s1, s2, _ = motion(P, theta_deg)
    e, Rp = P["e"], P["R0"] + P["rr"]
    s0 = math.sqrt(Rp ** 2 - e ** 2)
    r = s0 + s
    th = math.radians(theta_deg)
    c, sn = math.cos(-th), math.sin(-th)
    q = (e, r)
    Pt = (c * q[0] - sn * q[1], sn * q[0] + c * q[1])          # rotate by -theta (cam turns +theta, ccw)
```

Hand check (θ = 60°, e = 0, s = 10 mm): q = (0, 60); rotated by −60°: (60·sin 60°, 60·cos 60°) = (51.9615, 30.0000).
Program: pitch (51.9615, 30.0000). ✓

### 4.2 Pressure angle

The **pressure angle** φ is the angle between the direction of the force the cam can transmit (the common normal at the
contact) and the direction of the follower motion. Only F·cos φ moves the follower; F·sin φ presses the follower
sideways into its guide.

Derivation (velocity of the contact point): the roller centre moves along the follower axis with velocity s′ (per rad);
the cam point under it moves with the circumferential velocity of radius vector q. The normal to the pitch curve in the
fixed frame is perpendicular to the relative velocity u = q′ − J·q = (s_0 + s, s′ − e) (see 4.3), and the angle of
this normal against the follower axis is

  **tan φ = (s′ − e)/(s_0 + s)**   (Norton's form, ccw cam rotation, offset e positive in the direction that reduces φ
  on the rise).

```python
    phi = math.atan2(s1 - e, r)                               # pressure angle (Norton convention)
```

Hand check (θ = 60°, middle of the modified sine rise, e = 0): s′ = 20·1.7596/2.0944 = 16.803 mm/rad, s_0 + s = 50 + 10 =
60 mm → φ = atan(16.803/60) = atan(0.28005) = 15.645°. Program: φ 15.6449°. ✓ (The self-test checks
tan φ = s′/(R_p + s) for e = 0.)

**The geometric meaning:** s′ (mm/rad) is the distance from the cam centre at which the common normal crosses the line
perpendicular to the follower axis (the instant centre). A large s′ (fast rise) or a small radius (small cam) both make
the normal lean over. Therefore:

> φ is reduced by a **larger base circle** (4.6), a **longer rise angle** (s′ ∝ 1/β), a law with **lower C_v**, or a
> suitable **offset** (4.5).

Default result:

```
python cam.py examples      (excerpt)
```
```
## Geometry
- pressure angle max +15.84 deg, min -17.85 deg; largest |phi| at 244.0 deg (allow 30: OK)
- smallest convex radius: pitch curve 47.77, profile 37.77 mm (roller 10.0: no undercut); smallest concave profile radius none (profile fully convex)
- smallest base circle for phi <= 30 deg and rho_pitch >= 1.5 r: R0 = 14.29 mm
```

The positive maximum (+15.84°) is on the rise (θ ≈ 60°), the negative one (−17.85°) on the cycloidal return. The angle
"at 244.0 deg" printed in this line is the location of the largest **absolute** value, i.e. of the −17.85° on the return
(the return of a cycloidal law has its maximum speed at x = 0.5, θ = 240°; because the radius s_0 + s shrinks while the
follower moves down, the maximum |φ| is reached slightly later, at 244°).

### 4.3 Radius of curvature of the pitch curve and of the profile

The pitch curve must not be curved more sharply than the roller can follow. Its radius of curvature follows from the
first and second derivatives of P(θ) = R(−θ)·q(θ). With J = [[0, −1], [1, 0]] (rotation by +90°) and
dR(−θ)/dθ = −J·R(−θ):

  P′ = R(−θ)·(q′ − J q) = R(−θ)·u
  P″ = R(−θ)·(q″ − 2J q′ + J² q) = R(−θ)·(q″ − 2J q′ − q) = R(−θ)·w

With q = (e, r), r = s_0 + s, q′ = (0, s′), q″ = (0, s″), J q = (−r, e), J q′ = (−s′, 0):

  **u = (r, s′ − e)**,  **w = (2s′ − e, s″ − r)**

A rotation does not change lengths or the cross product, so the curvature can be computed directly with u and w:

  κ = (u × w)/|u|³,  ρ_pitch = −|u|³/(u × w)  (sign chosen so that ρ > 0 means convex).

```python
    u = (r, s1 - e)                                           # q' - J q
    w = (2 * s1 - e, s2 - r)                                  # q'' - 2 J q' - q
    cross = u[0] * w[1] - u[1] * w[0]
    mag = math.hypot(*u)
    rho_p = -mag ** 3 / cross if cross != 0 else float("inf")    # > 0 convex
```

Hand check (θ = 60°, s = 10, s′ = 16.803, s″ = 0, e = 0): u = (60, 16.803), |u| = √(3600 + 282.34) = 62.308,
|u|³ = 241 902; w = (33.606, −60); u × w = 60·(−60) − 16.803·33.606 = −3600 − 564.68 = −4164.68.
ρ_pitch = 241 902/4164.68 = **58.08 mm**. Program: ρ_pitch 58.0843. ✓

The self-test also checks the formula independently: the circle through three pitch points 0.05° apart has radius
63.566 mm at θ = 50°, equal to the formula value 63.566 mm.

Special cases that confirm the formula: in a dwell s′ = s″ = 0 and ρ_pitch = r = R_p + s (a circular arc): at θ = 120°
(top dwell) the program gives ρ_pitch = 70.000 = 50 + 20. ✓

**Profile radius.** The profile is the inner offset curve of the pitch curve at distance r_r:

  convex part: ρ_cam = ρ_pitch − r_r;  concave part (ρ_pitch < 0): |ρ_cam| = |ρ_pitch| + r_r.

```python
    rho_c = rho_p - P["rr"] if rho_p > 0 else rho_p - P["rr"]   # concave: |rho_c| = |rho_p| + rr
```

At θ = 60°: ρ_cam = 58.08 − 10 = 48.08 mm (program 48.0843 ✓). The smallest convex radius of the default cam is 37.77 mm
on the profile (47.77 on the pitch curve).

### 4.4 The profile (offset) and undercut

The profile point is the pitch point minus r_r along the outward unit normal n:

```python
    t = (c * u[0] - sn * u[1], sn * u[0] + c * u[1])
    t = (t[0] / mag, t[1] / mag)
    nrm = (t[1], -t[0])
    if nrm[0] * Pt[0] + nrm[1] * Pt[1] < 0:
        nrm = (-nrm[0], -nrm[1])
    prof = (Pt[0] - P["rr"] * nrm[0], Pt[1] - P["rr"] * nrm[1])
```

(The normal is chosen to point away from the cam centre; this is safe for usual cams, where the normal is never
perpendicular to the radius vector.) At θ = 60° the profile point is (44.9705, 22.8498): its distance to the pitch point
is √(6.991² + 7.150²) = 10.000 = r_r ✓ (self-test "profile point lies one roller radius from the pitch point").

**Undercut.** If on a convex part ρ_pitch < r_r, the inner offset curve forms a loop: the cutter would remove material
that the roller needs, and the follower does not follow the intended motion (it "skips" the sharp nose). Condition for a
usable profile:

  **ρ_pitch,min (convex) > r_r**, in practice ρ_cam,min ≥ (0.5…1)·r_r or a stress-based minimum (chapter 6).

`geometry_summary()` evaluates the whole sweep:

```python
def geometry_summary(P, pts=None):
    pts = pts or sweep(P)
    phis = [p["phi_deg"] for p in pts]
    convex = [p["rho_pitch"] for p in pts if p["rho_pitch"] > 0]
    concave = [-p["rho_pitch"] for p in pts if p["rho_pitch"] < 0]
    rho_p_min = min(convex) if convex else float("inf")
    ...
            "undercut": rho_p_min <= P["rr"], "phi_ok": max(abs(x) for x in phis) <= P["phi_allow"]}
```

The default (slow) programme never comes close to undercut. A **steep programme** does: 20 mm rise in only 60° (modified
sine), 120° dwell, 60° cycloidal return, 120° dwell. The add-on keeps the pitch base circle R_p constant (same pitch
curve) and changes the roller:

```python
def roller_size_study(P=None, rrs=(5.0, 10.0, 15.0, 20.0), Rps=(25.0, 35.0, 45.0), segments=None):
    """Keep the PITCH base circle Rp = R0 + rr constant -> same pitch curve; the profile radius rho_cam = rho_pitch - rr
    changes with the roller. Undercut when rho_pitch_min <= rr (profile radius <= 0)."""
```

```
## 4.7 Undercut: steep programme (rise 20 mm in 60 deg modsine, return 60 deg cycloidal), roller vs pitch base circle
  Rp 25.0 rr  5.0 (R0 20.0): |phi|max 48.5 deg, rho_pitch_min 13.65, rho_cam_min  +8.65, concave min 15.10 mm 
  Rp 25.0 rr 10.0 (R0 15.0): |phi|max 48.5 deg, rho_pitch_min 13.65, rho_cam_min  +3.65, concave min 20.10 mm 
  Rp 25.0 rr 15.0 (R0 10.0): |phi|max 48.5 deg, rho_pitch_min 13.65, rho_cam_min  -1.35, concave min 25.10 mm UNDERCUT
  Rp 25.0 rr 20.0 (R0  5.0): |phi|max 48.5 deg, rho_pitch_min 13.65, rho_cam_min  -6.35, concave min 30.10 mm UNDERCUT
  Rp 35.0 rr  5.0 (R0 30.0): |phi|max 40.9 deg, rho_pitch_min 18.56, rho_cam_min +13.56, concave min 26.55 mm 
  Rp 35.0 rr 10.0 (R0 25.0): |phi|max 40.9 deg, rho_pitch_min 18.56, rho_cam_min  +8.56, concave min 31.55 mm 
  Rp 35.0 rr 15.0 (R0 20.0): |phi|max 40.9 deg, rho_pitch_min 18.56, rho_cam_min  +3.56, concave min 36.55 mm 
  Rp 35.0 rr 20.0 (R0 15.0): |phi|max 40.9 deg, rho_pitch_min 18.56, rho_cam_min  -1.44, concave min 41.55 mm UNDERCUT
  Rp 45.0 rr  5.0 (R0 40.0): |phi|max 35.1 deg, rho_pitch_min 23.99, rho_cam_min +18.99, concave min 45.82 mm 
  Rp 45.0 rr 10.0 (R0 35.0): |phi|max 35.1 deg, rho_pitch_min 23.99, rho_cam_min +13.99, concave min 50.82 mm 
  Rp 45.0 rr 15.0 (R0 30.0): |phi|max 35.1 deg, rho_pitch_min 23.99, rho_cam_min  +8.99, concave min 55.82 mm 
  Rp 45.0 rr 20.0 (R0 25.0): |phi|max 35.1 deg, rho_pitch_min 23.99, rho_cam_min  +3.99, concave min 60.82 mm 
```

What the table teaches:
1. **The pitch curve depends only on R_p, not on the roller.** ρ_pitch,min (13.65 at R_p 25) and φ are identical for all
   rollers. The roller only decides how much of the curvature is "used up": ρ_cam = ρ_pitch − r_r.
2. **Undercut** appears when r_r > ρ_pitch,min (15 > 13.65 and 20 > 18.56). The cure is a larger cam (R_p 45: no undercut
   even with r_r 20) or a smaller roller – but a smaller roller has a lower load rating and higher Hertz stress.
3. **Concave parts** (between the nose and the dwells) have |ρ_cam| = |ρ_pitch| + r_r, so a larger roller *increases* the
   concave radius – concave parts limit the **cutter / grinding-wheel radius** instead (chapter 7: the wheel must be
   smaller than the smallest concave radius).
4. The steep programme also fails the pressure-angle limit at R_p 25 and 35 (48.5° and 40.9° > 30°) – the pressure angle
   usually forces a larger cam *before* undercut does.

### 4.5 Offset of the follower

An offset e moves the follower axis sideways. From tan φ = (s′ − e)/(s_0 + s): on the rise (s′ > 0) a positive e reduces
φ, on the return (s′ < 0) it increases |φ|. Offset is therefore useful when the **rise** carries the load (process force)
and the return is unloaded:

```python
def offset_study(P=None, es=(-10.0, -5.0, 0.0, 5.0, 10.0)):
    P = P or DEFAULT
    out = []
    for e in es:
        g = geometry_summary(dict(P, e=e, step_deg=1.0))
        out.append({"e": e, "phi_max": g["phi_max"], "phi_min": g["phi_min"], "rho_min": g["rho_pitch_min_convex"]})
    return out
```

```
## 4.5 Offset study (R0 40, rr 10)
  e -10.0 mm: phi_max +24.91 deg, phi_min  -8.82 deg, rho_pitch_min 46.55 mm
  e  -5.0 mm: phi_max +20.37 deg, phi_min -13.39 deg, rho_pitch_min 47.20 mm
  e  +0.0 mm: phi_max +15.84 deg, phi_min -17.85 deg, rho_pitch_min 47.78 mm
  e  +5.0 mm: phi_max +11.28 deg, phi_min -22.26 deg, rho_pitch_min 48.29 mm
  e +10.0 mm: phi_max  +6.61 deg, phi_min -26.67 deg, rho_pitch_min 48.74 mm
```

Hand check (e = 10, θ = 60°): s_0 = √(50² − 10²) = 48.990, s′ = 16.803 → tan φ = (16.803 − 10)/(48.990 + 10) = 0.11532,
φ = 6.578°. Program (`pitch_point(dict(P, e=10), 60)`): φ 6.5786°. ✓ (The table shows +6.61° as the maximum because the
largest value lies slightly away from θ = 60°.)

**Engineering use:** with e = +10 mm the loaded rise runs at only 6.6° (side force on the guide F_n·sin φ reduced by
≈ 60 %), the unloaded return at −26.7° (still < 30°). The offset changes direction with the direction of rotation:
**an offset cam must never be run backwards** – mark the direction of rotation on the cam and in the drawing.

### 4.6 Base-circle sizing

The base circle is the main size decision: a larger cam has a smaller pressure angle and larger radii of curvature, but
needs more space, has more inertia, and makes the circumferential (and roller) speed higher.

```
## 4.6 Base circle study (e 0, rr 10)
  R0  10.0: |phi|max 33.73 deg, rho_pitch_min  20.00, rho_cam_min  10.00 mm 
  R0  15.0: |phi|max 29.46 deg, rho_pitch_min  25.00, rho_cam_min  15.00 mm 
  R0  20.0: |phi|max 26.11 deg, rho_pitch_min  30.00, rho_cam_min  20.00 mm 
  R0  30.0: |phi|max 21.22 deg, rho_pitch_min  38.86, rho_cam_min  28.86 mm 
  R0  40.0: |phi|max 17.85 deg, rho_pitch_min  47.78, rho_cam_min  37.78 mm 
  R0  60.0: |phi|max 13.51 deg, rho_pitch_min  66.22, rho_cam_min  56.22 mm 
  sized R0 (phi <= 30, rho_p >= 1.5 rr): 14.29 mm
```

For small cams the smallest convex radius equals the base circle itself (ρ_pitch,min = R_p = R_0 + r_r: 20, 25, 30 mm) –
the slow programme has no sharp nose; from R_0 30 on the nose of the rise is curved slightly more than the base circle.
The automatic sizing in `cam.py`:

```python
def size_base_circle(P, R_lo=10.0, R_hi=300.0, rho_factor=1.5):
    """Smallest profile base-circle radius R0 with |phi| <= phi_allow and rho_pitch_min >= rho_factor * rr (scan + bisection)."""
    def ok(R):
        g = geometry_summary(dict(P, R0=R, step_deg=1.0))
        return max(abs(g["phi_max"]), abs(g["phi_min"])) <= P["phi_allow"] and g["rho_pitch_min_convex"] >= rho_factor * P["rr"]
    ...
    for _ in range(40):
        mid = 0.5 * (lo + hi)
        if ok(mid):
            hi = mid
        else:
            lo = mid
    return hi
```

Result: **R_0 = 14.29 mm** is enough for φ ≤ 30° (the curvature condition ρ_pitch ≥ 15 mm is satisfied automatically);
the pressure angle decides. The default R_0 = 40 mm is therefore *not* geometry-driven: in the example it is chosen for
the shaft and hub (a cam bore of 25–30 mm with a keyway needs R_0 ≳ 30 mm, check M3), the Hertz stress (chapter 6) and a
low pressure angle on the loaded rise (side force on the guide). This is typical: **the smallest geometric cam is rarely
the best cam** – shaft, hub, stress and guide forces decide.

**Nomogram (Flocke style).** Before a programme exists in detail, a designer reads the needed base circle from a chart
of R_p/h against the rise angle β for φ = 30°. The add-on computes this chart for one isolated rise (e = 0):

  tan φ(x) = (h·y′(x)/β)/(R_p + h·y(x)) → φ_max(R_p/h) by scanning x, then bisection for φ_max = 30°.

```python
def phi_max_single(law, beta_deg, Rp_over_h, n=400):
    """Max pressure angle of one rise (e = 0): tan(phi) = (h y'/beta) / (Rp + h y), in units of h."""
    b = math.radians(beta_deg)
    return max(math.degrees(math.atan2(law_values(law, i / n)[1] / b, Rp_over_h + law_values(law, i / n)[0])) for i in range(n + 1))
```

```
## 4.6b Nomogram: smallest Rp/h for phi_max 30 deg (translating, e 0)
  law        beta 60   90    120   180
  cycloidal   2.84   1.75   1.21   0.69
  harmonic    2.15   1.30   0.89   0.50
  poly345     2.64   1.62   1.12   0.64
  modsine     2.45   1.50   1.03   0.59
  modtrap     2.83   1.73   1.19   0.66
```

Use: h = 20 mm, β = 120°, cycloidal return → R_p ≥ 1.21·20 = 24.2 mm, R_0 ≥ 24.2 − 10 = 14.2 mm – the same result as the full
sizing above (14.29 mm, which was decided by the cycloidal return). Halving the rise angle to 60° more than doubles the
required cam (2.84 vs 1.21). The modified sine needs about 15 % less base circle than cycloidal – its low C_v pays off
directly in cam size.

### 4.7 Roller size

The roller radius r_r is chosen from three conditions:
1. **Geometry**: r_r < ρ_pitch,min of all convex parts (no undercut, 4.4), with margin.
2. **Strength**: the track-roller load rating and the Hertz stress (chapter 6) need a large roller.
3. **Speed**: the roller speed n_r ≈ v_contact/r_r (core report: 1800 rpm max) must be below the bearing limit; at high
   speed the roller may slip when it is accelerated at the start of contact (skidding) – chapter 6.

Typical: r_r ≈ (0.2 … 0.4)·R_0, and a standard track-roller size (outside diameter 16, 19, 22, 26, 30, 32, 35, 40, 47,
52, 62 mm …, check maker catalogue).

### 4.8 Oscillating roller follower

For a lever follower the roller centre moves on a circle of radius L (arm length) around a pivot at distance d from the
cam centre. With ψ = angle between the arm and the line pivot → cam centre:

  roller centre (fixed frame) C = (d − L cos ψ, L sin ψ),  |C|² = d² + L² − 2 d L cos ψ.

At the lower dwell |C| = R_p, so

  **cos ψ_0 = (d² + L² − R_p²)/(2 d L)**,  ψ(θ) = ψ_0 + Ψ·y (Ψ = angular stroke).

The roller-centre velocity is perpendicular to the arm: direction (L sin ψ, L cos ψ). In the cam frame the pitch curve
is again C rotated by −θ. The add-on does not derive a closed curvature formula; it uses the **generic pitch-curve
approach** – three close points give the tangent T and the radius of curvature, and the pressure angle is the angle between the
pitch-curve normal and the velocity direction:

  φ = arcsin |T̂ · v̂|  (since the normal is perpendicular to T).

```python
def osc_point(P, O, theta_deg, h=0.05):
    """Pressure angle and pitch-curve radius of curvature of the oscillating follower (numerical, 3-point)."""
    A, _, _ = osc_center(P, O, theta_deg - h)
    B, v, psi = osc_center(P, O, theta_deg)
    C, _, _ = osc_center(P, O, theta_deg + h)
    T = (C[0] - A[0], C[1] - A[1])
    ...
    phi = math.degrees(math.asin(min(1.0, abs((T[0] * v[0] + T[1] * v[1]) / (tm * vm)))))
    ...
    rho = ab * bc * ca / (2 * cr) if cr != 0 else float("inf")
```

Example d = 80 mm, L = 60 mm, Ψ = 20° (the same motion programme drives y; roller travel along the arc L·Ψ = 20.94 mm ≈
the 20 mm stroke), R_p = 50 mm:

```
## 4.8 Oscillating roller follower (d 80, L 60, Psi 20 deg, Rp 50)
  psi0 38.625 deg, roller travel 20.94 mm, phi_max 23.38 deg at 73 deg, smallest |rho_pitch| 46.29 mm
  L   40 (Psi 30.00 deg, same travel): phi_max 39.88 deg, |rho|min 47.61 mm
  L   60 (Psi 20.00 deg, same travel): phi_max 23.38 deg, |rho|min 46.29 mm
  L   80 (Psi 15.00 deg, same travel): phi_max 35.83 deg, |rho|min 44.27 mm
```

Hand check of ψ_0: cos ψ_0 = (6400 + 3600 − 2500)/(2·80·60) = 7500/9600 = 0.78125 → ψ_0 = 38.625°. ✓

Findings:
- The pressure angle of a lever follower depends strongly on the **lever geometry**, not only on the cam: for the same
  roller travel L = 60 mm gives 23.4°, while both a shorter (40 mm) and a longer (80 mm) arm are worse. The best arm is the
  one whose roller path is roughly *tangent* to the pitch circle in the middle of the stroke (the arm is then
  perpendicular to the radius from the cam centre and the follower motion is "radial" relative to the cam surface).
- Compared with the translating follower (|φ| 17.9° at the same R_p and stroke) the lever follower here has a larger φ, but
  it is allowed up to ≈ 45° (pivot bearing instead of a sliding guide, check) – the lever is the better choice when
  space or the output motion require it.
- For a real design, replace the 3-point derivative by the analytic formulas (Norton, chapter 7) or use a fine step;
  the numerical method is general and works for any follower kinematics (it is how CAM software computes the profile).

### 4.9 Flat-faced follower

For a translating flat-faced follower (face perpendicular to the follower axis, no offset) the cam profile is the
envelope of the face lines. Two classical results:

- The contact point is at distance **x = s′** (mm/rad) from the follower axis – the face must be at least
  max|s′| wide on each side (plus margin for wear and tolerances).
- The radius of curvature of the cam is **ρ = R_0 + s + s″**; the cam must be convex everywhere: **R_0 + s + s″ > 0**.
  If not, the face cannot reach the profile (cusp) and the follower motion is wrong.

```python
def flat_faced(P=None, R0=None, step=0.5):
    """Translating flat-faced follower (face normal to the stroke): radius of curvature of the cam rho = R0 + s + s''
    (must be > 0 everywhere), contact point distance from the follower axis x = s' (face half width >= max |s'|)."""
    ...
    rho_min = min(R0 + s + s2 for s, s1, s2, _ in vals)
    need = max(-(s + s2) for s, s1, s2, _ in vals)
```

```
## 4.9 Flat-faced follower
  R0 40.0: rho_min +29.34 mm (convex OK), R0 needed > 10.66 mm; contact offset x -19.10 .. 16.80 mm
  R0 15.0: rho_min +4.34 mm (convex OK), R0 needed > 10.66 mm; contact offset x -19.10 .. 16.80 mm
  R0 10.0: rho_min -0.66 mm (CUSP - not usable), R0 needed > 10.66 mm; contact offset x -19.10 .. 16.80 mm
```

Hand check of x_max: the largest s′ on the rise is 20·1.7596/2.0944 = 16.80 mm/rad, on the cycloidal return
−20·2/2.0944 = −19.10 mm/rad. ✓ The face must reach at least 16.8 mm to one side and 19.1 mm to the other → a mushroom of
≥ 2·19.1 + margin ≈ 45 mm diameter (or an offset of the face centre). The convexity limit (R_0 > 10.66 mm) is set where
s + s″ is most negative – near the top of the rise, where the deceleration s″ is large and negative.

Why automotive valve trains use flat-faced tappets despite the sliding contact: zero pressure angle (no side force in
the guide), a very compact design, and the tappet rotates (offset of the cam relative to the tappet axis) so that wear is
spread. The cam laws are then chosen for convexity and for the valve-spring dynamics (polydyne cams, chapter 5).

### 4.10 Summary of the geometric design procedure

1. Draw the timing diagram, choose segments and laws (chapters 2–3).
2. Read a first R_p from the nomogram (4.6b) for φ_allow (30° translating, ≈ 45° lever, check).
3. Choose the roller from load and speed (chapter 6), check r_r < ρ_pitch,min with margin (4.4, 4.7).
4. Use offset only if one direction carries the load and the direction of rotation is fixed (4.5).
5. Run `python cam.py run --in my.json` → pressure angle, curvature, profile CSV; then dynamics and contact (chapters 5–6)
   and manufacturing data (chapter 7).


---

## 5. Dynamics: forces, spring and lift-off, follower vibration, camshaft torque and drive

Chapters 2–4 gave the **shape** of the cam: the motion law, the profile, the pressure angle and the radius of curvature.
These values are pure kinematics; they do not depend on the speed. This chapter brings in **mass, springs, loads and
speed**. These decide whether the cam really works at 300 rpm or 600 rpm:

| What can go wrong | Physical cause | Check (section) | Function |
|---|---|---|---|
| Follower lifts off the cam (noise, hammering, roller damage) | Negative inertia force larger than spring + load | 5.3 | `jump_check()`, `lift_off_speed()` |
| Follower jams or wears the guide | Side force × friction in the bushings | 5.2 | `guide_forces()`, `jam_table()` |
| Spring breaks or surges | Shear stress too high; surge frequency near a cam harmonic | 5.3 | `spring_requirement()`, `helical_spring()` |
| Follower overshoots, vibrates in the dwell | Follower stiffness too low for the rise time; motion law with jerk steps | 5.4 | `sdof_rise()`, `residual_table()`, `follower_vibration()` |
| Drive speed fluctuates, gearbox overloaded | Camshaft torque changes sign every cycle | 5.5 | `torque_harmonics()`, `flywheel()` |

All results are for the default cam of this guide (`python cam.py params`): pusher with reduced mass m 2.5 kg, spring
3 N/mm with 30 N preload, 100 N process load during the rise, 20 mm stroke, modified-sine rise 120°, cycloidal return
120°, 300 rpm.

### 5.1 Force balance on the follower

**Model.** The follower is a rigid body moving along its axis. Acting on it, in the direction of the axis (positive = away
from the cam, i.e. the rise direction):

- the cam contact force component along the axis, F_c (always ≥ 0: the cam can only push),
- the inertia force: the cam must accelerate the mass, F_i = m·a,
- the spring force (pressing the follower onto the cam), F_s = F_0 + k·s,
- the external (process) load F_e, here 100 N during the rise (the pusher moves a product against friction).

Newton's second law along the axis: F_c − F_s − F_e = m·a, so the force the cam must deliver along the axis is

  **F_c = m·a + F_0 + k·s + F_e**                                                          (5.1)

The follower acceleration comes from the motion law (chapter 3): with s'' = d²s/dθ² in mm/rad² and the cam angular
speed ω = 2πn/60,

  a = s''·ω² / 1000   [m/s²],   v = s'·ω / 1000   [m/s]                                   (5.2)

The cam touches the roller along the **normal** of the profile, which is inclined by the pressure angle φ to the follower
axis (chapter 4). The normal force and the side force on the guide are therefore

  **F_n = F_c / cos φ,   F_side = F_n·sin φ**                                               (5.3)

**Camshaft torque from the power balance.** The power that goes into the follower is F_c·v; it must come from the
camshaft, T·ω. Because v = s'·ω (s' in m/rad):

  T·ω = F_c·s'·ω   →   **T = F_c·s' / 1000   [N m]** (s' in mm/rad)                      (5.4)

This is exact for a frictionless contact. It also shows why T changes sign: in the second half of the rise and the
first half of the return, the follower gives energy back (spring and inertia), the camshaft is *driven* by the follower.

Code (`tools/cam.py`):

```python
def dynamics(P, pts=None):
    pts = pts or sweep(P)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    out = []
    for p in pts:
        a = p["s2"] * w ** 2 / 1000.0                        # m/s^2
        v = p["s1"] * w / 1000.0                             # m/s
        Fi = P["m"] * a
        Fs = P["F0_spring"] + P["k_spring"] * p["s"]
        seg = segment_at(P, p["theta"])
        Fe = P["F_ext_rise"] if seg["kind"] == "rise" else 0.0
        Fc = Fi + Fs + Fe                                    # force along the follower axis (cam pushes up)
        phi = math.radians(p["phi_deg"])
        Fn = Fc / math.cos(phi)
        T = Fc * p["s1"] / 1000.0                            # N m (power balance T w = Fc v)
        out.append({"theta": p["theta"], "v": v, "a": a, "Fi": Fi, "Fs": Fs, "Fe": Fe, "Fc": Fc, "Fn": Fn,
                    "Fside": Fn * math.sin(phi), "T": T})
    return out
```

Command and output (part of the report, `python cam.py examples`):

```
## Dynamics
- follower force: inertia -71..71 N, spring 30..90 N, contact force min 13.1 N at 213.0 deg (keeps contact)
- minimum spring preload for contact: 16.9 N (actual 30.0 N)
- normal force max 196 N, side force on the guide max 49 N, camshaft torque -1.56 .. 2.78 N m (mean 0.318)
```

**Hand check at the critical point θ = 213°** (start of the return, the follower is accelerated *downwards*):
from `lift_off_speed()` (section 5.3) the neighbouring point θ = 212.5° has s = 17.739 mm, s'' = −28.40 mm/rad².
ω = 2π·300/60 = 31.416 rad/s, ω² = 986.96 s⁻².

- a = −28.40·986.96/1000 = −28.03 m/s²  →  F_i = 2.5·(−28.03) = −70.1 N
- F_s = 30 + 3·17.739 = 83.2 N, F_e = 0 (return)
- F_c = −70.1 + 83.2 + 0 = **13.1 N** ✓ (program: 13.1 N at 213.0°)

**Hand check of the inertia range:** the largest acceleration is on the cycloidal return,
a_max = C_a·h·ω²/β² = 6.283·20·986.96/(2.0944²)/1000 = 28.3 m/s² (report line "a_max 28.3 m/s^2"); m·a_max = 70.7 N ✓ (−71..71 N).

**Energy check** (from the self-test): the camshaft work over one revolution ∮T dθ must equal the work done on the
product, because spring and inertia give back everything they store:
W = F_e·h = 100 N·0.020 m = 2.000 J; the self-test prints `2.0000 J vs 2.0000 J`. The mean torque is therefore
T_mean = W/(2π) = 2.000/6.2832 = **0.318 N m** ✓ – the large swing −1.56 … +2.78 N m is pure energy exchange.

**What the numbers say.** The cam must deliver up to 196 N, but only 10 W of mean power (section 5.5). The contact force
falls to 13.1 N at the start of the return – only 13 N stand between normal running and lift-off. This is the first
design issue of the default cam (section 5.3).

### 5.2 Guide friction and jamming of a translating follower

The side force F_side = F_n·sin φ (eq. 5.3) must be carried by the follower guide. A typical guide has **two bushings**
with spacing L; the roller sits a distance a (the overhang) below the lower bushing.

```
        |  |   <- upper bushing  R2 (acts towards the side force)
        |  |
        |  |   L
        |  |
        |  |   <- lower bushing  R1 (acts against the side force)
        |  |
        |  |   a  (overhang)
        (O)    <- roller, side force F_side
```

Moment balance about the upper bushing and force balance give the bushing reactions

  R1 = F_side·(a + L)/L,   R2 = F_side·a/L,   R1 + R2 = F_side·(1 + 2a/L)                 (5.5)

The bushing friction μ·(R1 + R2) acts **against the follower velocity**. The axial force balance becomes

  F_n·cos φ − sign(v)·μ·F_n·|sin φ|·(1 + 2a/L) = F_load   (F_load = F_c of eq. 5.1)

so

  **F_n = F_c / (cos φ − sign(v)·k·|sin φ|),   k = μ·(1 + 2a/L)**                          (5.6)

When the denominator becomes zero the cam can push as hard as it wants – the follower does not move: it **jams**
(self-locking of the guide, the same physics as the self-locking worm in M5c). The jamming pressure angle is

  **tan φ_jam = 1/k = 1 / (μ·(1 + 2a/L))**                                                 (5.7)

Code (add-on `cm_add_B.py`, merged into `cam.py`):

```python
def guide_forces(P, a_over=40.0, L_guide=60.0, mu=0.10):
    k = mu * (1 + 2 * a_over / L_guide)
    phi_jam = math.degrees(math.atan(1 / k))
    pts = sweep(P)
    dyn = dynamics(P, pts)
    worst = None
    for p, d in zip(pts, dyn):
        phi = math.radians(p["phi_deg"])
        sgn = 1.0 if d["v"] >= 0 else -1.0          # friction opposes the follower velocity
        den = math.cos(phi) - sgn * k * abs(math.sin(phi))   # F_n cos(phi) - sign(v) mu (R1 + R2) = F_load
        Fn_mu = d["Fc"] / den if den > 0 else float("inf")
        ratio = Fn_mu / d["Fn"] if d["Fn"] > 1e-9 else 1.0
        if worst is None or ratio > worst["ratio"]:
            worst = {"theta": p["theta"], "phi": p["phi_deg"], "Fn": d["Fn"], "Fn_mu": Fn_mu, "ratio": ratio}
    return {"k": k, "phi_jam": phi_jam, "worst": worst,
            "R1_over_side": (a_over + L_guide) / L_guide, "R2_over_side": a_over / L_guide}

def jam_table(mus=(0.05, 0.10, 0.15, 0.20), ratios=(0.0, 0.5, 1.0, 2.0)):
    return [[mu] + [math.degrees(math.atan(1 / (mu * (1 + 2 * r)))) for r in ratios] for mu in mus], ratios
```

Command and output (`python cam.py ch56`):

```
## 5.2 Guide friction (a = 40 mm overhang, L = 60 mm bushing spacing, mu 0.10)
  bushing reactions R1 = 1.667 x side force, R2 = 0.667 x side force; k = mu (1 + 2a/L) = 0.2333
  jamming pressure angle 76.87 deg; worst point 54.5 deg (phi +15.84): F_n 173.6 -> 186.0 N with friction (x1.071)
  jamming angle [deg] vs mu (rows) and a/L (columns 0.0, 0.5, 1.0, 2.0):
   mu 0.05:  87.14   84.29   81.47   75.96
   mu 0.10:  84.29   78.69   73.30   63.43
   mu 0.15:  81.47   73.30   65.77   53.13
   mu 0.20:  78.69   68.20   59.04   45.00
```

**Hand check.** k = 0.10·(1 + 2·40/60) = 0.10·2.333 = 0.2333; φ_jam = atan(1/0.2333) = atan(4.286) = 76.87° ✓.
At φ = 15.84° (rise, v > 0): cos φ = 0.9620, sin φ = 0.2729; denominator 0.9620 − 0.2333·0.2729 = 0.8983;
ratio to the frictionless F_n = cos φ/0.8983 = 1.071 ✓ (F_n 173.6 → 186.0 N).

**Why the allowable pressure angle is ~30° and not 76°.** Jamming is far away for this guide, but the table shows how
fast φ_jam falls with a long overhang and a dry guide: μ 0.2 and a/L = 2 jam at 45°. The other reasons for the
30° rule (VDI 2143 recommends about 30° for translating, 45° for oscillating roller followers – check):

- the side force (here 49 N) causes wear of the bushings and the follower stem; wear increases a/L and μ over time;
- friction adds force (7 % here) and causes stick-slip at low speed;
- elastic bending of the stem changes the follower motion.

**Design rules** (from the formula): keep the overhang short (a/L ≤ 0.5 … 1), use long guide spacing, lubricated or
PTFE-lined bushings (μ 0.05 … 0.10), or a **roller guide / linear ball guide** for heavy side forces; an offset e of the
follower (chapter 4) can reduce the pressure angle during the loaded stroke.

### 5.3 Lift-off speed, spring preload and the spring itself

**Condition for contact.** The cam can only push (force closure). Contact is kept as long as F_c ≥ 0 at every angle.
From eq. 5.1, with a = s''·ω²/1000, lift-off can only happen where s'' < 0 (the follower is decelerated in the rise or
accelerated towards the cam in the return). Setting F_c = 0 gives the **lift-off speed** at each such point:

  m·s''·ω²/1000 + F_s + F_e = 0   →   **ω_lim² = min over θ (s''<0) of (F_s + F_e) / (−m·s''/1000)**   (5.8)

The core function `jump_check()` evaluates F_c over the revolution at the given speed and the minimum preload that would
just keep F_c ≥ 0:

```python
def jump_check(P, dyn=None):
    dyn = dyn or dynamics(P)
    Fmin = min(d["Fc"] for d in dyn)
    # preload that brings the minimum contact force exactly to zero (add your own margin, e.g. 30-50 %)
    need = max(0.0, -(Fmin - P["F0_spring"]))
    return {"Fc_min": Fmin, "lift_off": Fmin <= 0.0, "F0_min_no_jump": need,
            "theta_Fc_min": min(dyn, key=lambda d: d["Fc"])["theta"]}
```

(The preload needed is F0 − F_c,min: lowering the preload by F_c,min would bring the contact force exactly to zero.)
The add-on computes the speed limit directly from eq. 5.8:

```python
def lift_off_speed(P):
    pts = sweep(P)
    best = None
    for p in pts:
        if p["s2"] < 0:
            Fs = P["F0_spring"] + P["k_spring"] * p["s"]
            Fe = P["F_ext_rise"] if segment_at(P, p["theta"])["kind"] == "rise" else 0.0
            w2 = (Fs + Fe) / (-P["m"] * p["s2"] / 1000.0)
            if best is None or w2 < best[0]:
                best = (w2, p["theta"], p["s"], p["s2"])
    w = math.sqrt(best[0])
    return {"n_lim": w * 60 / (2 * math.pi), "theta": best[1], "s": best[2], "s2": best[3]}
```

Core output (`python cam.py examples`, last table):

```
## Speed: contact force and lift-off
   200 rpm: Fc_min    30.0 N , preload needed 0 N
   300 rpm: Fc_min    13.1 N , preload needed 17 N
   400 rpm: Fc_min   -41.5 N LIFT-OFF, preload needed 72 N
   500 rpm: Fc_min  -112.0 N LIFT-OFF, preload needed 142 N
   600 rpm: Fc_min  -198.4 N LIFT-OFF, preload needed 228 N
```

Add-on output (`python cam.py ch56`):

```
## 5.3 Lift-off speed and spring
  lift-off speed 326.9 rpm (critical point 212.5 deg, s 17.739 mm, s'' -28.40 mm/rad^2)
  at 300 rpm: Fc_min 13.1 N at 213.0 deg; minimum preload 16.9 N
```

**Hand check of eq. 5.8.** F_s = 30 + 3·17.739 = 83.22 N; −m·s''/1000 = 2.5·28.40/1000 = 0.0710 kg·m/rad²;
ω_lim² = 83.22/0.0710 = 1172 s⁻² → ω_lim = 34.24 rad/s → n_lim = 34.24·60/(2π) = **326.9 rpm** ✓.
The machine runs at 300 rpm – only **9 % below lift-off**. A speed increase of the packaging line to 330 rpm, a
heavier pusher tool or a spring that has lost 15 N of preload by relaxation would make the follower jump.

Two remarks on the table:
- at 200 rpm the minimum contact force (30 N) is the preload at the base circle (s = 0, a = 0): inertia is no longer
  the limiting effect;
- the required preload grows with ω² (17 → 72 → 142 → 228 N): **doubling the speed needs about four times the
  inertia margin**.

**Spring preload with a margin.** A real design does not stop at F_c,min = 0. Spring relaxation, mass tolerances, follower
vibration (section 5.4 – the dynamic inertia force can be 7 … 70 % higher than the rigid value) and speed overshoot must
be covered. A common rule is a margin of 1.2 … 1.5 on the inertia force that pulls the follower away (check VDI 2143 /
maker practice). The requirement at every angle is

  F_0 + k·s ≥ M·(−m·a − F_e)   →   **F_0,req(k) = max over θ of [M·(−m·a − F_e) − k·s]**        (5.9)

```python
def spring_requirement(P, n_design=None, margin=1.3, rates=(1.0, 2.0, 3.0, 4.0, 6.0)):
    n = n_design or P["n_rpm"]
    w = 2 * math.pi * n / 60.0
    pts = sweep(P)
    rows = []
    for k in rates:
        need = 0.0
        for p in pts:
            a = p["s2"] * w ** 2 / 1000.0
            Fe = P["F_ext_rise"] if segment_at(P, p["theta"])["kind"] == "rise" else 0.0
            need = max(need, margin * (-P["m"] * a - Fe) - k * p["s"])
        rows.append({"k": k, "F0": need, "F_max": need + k * P["h"]})
    return rows
```

Output for a future speed of 400 rpm with margin 1.3 (`python cam.py ch56`):

```
  preload needed with margin 1.3 at 400 rpm:
   k 1.0 N/mm: F0 >=  145.2 N, F_max  165.2 N
   k 2.0 N/mm: F0 >=  127.1 N, F_max  167.1 N
   k 3.0 N/mm: F0 >=  109.1 N, F_max  169.1 N
   k 4.0 N/mm: F0 >=   91.2 N, F_max  171.2 N
   k 6.0 N/mm: F0 >=   55.5 N, F_max  175.5 N
```

**Hand check (k = 3 N/mm).** ω = 41.89 rad/s, ω² = 1754.7 s⁻². At the critical point (s'' ≈ −28.40, s ≈ 17.74):
a = −28.40·1754.7/1000 = −49.83 m/s²; M·(−m·a) = 1.3·2.5·49.83 = 162.0 N; minus k·s = 53.2 N → 108.8 N.
The program finds 109.1 N at a neighbouring angle ✓.

**Reading the table.** A stiffer spring helps only a little at the critical point (it is near the top of the stroke,
s ≈ 0.89·h, where the spring force is already high) but it raises the **maximum** spring force only slightly
(165 → 176 N). The **maximum spring force** is what loads the cam, the roller and the camshaft for the whole revolution –
including the dwell at the top, where the cam does no useful work. Choose the softest spring with the needed preload
that fits into the space; a long preloaded spring with a low rate is the classic solution.

**The spring itself – a first check (M8 springs goes deeper).** For a cylindrical helical compression spring with wire
diameter d, mean coil diameter D, spring index c = D/d and n active coils (shear modulus G):

  rate  k = G·d⁴ / (8·D³·n)   →   n = G·d⁴ / (8·D³·k)                                     (5.10)

  shear stress with the Wahl factor  τ = K·8·F·D/(π·d³),   K = (4c − 1)/(4c − 4) + 0.615/c   (5.11)

The spring is itself a mass–spring system. Its first longitudinal natural frequency (both ends fixed, "surge"):

  m_spring = ρ·π²·d²·D·n/4,   **f_surge = ½·√(k/m_spring)**                                (5.12)

The cam excites the spring with all harmonics of the cam frequency n/60 (section 5.5). If a harmonic with a large
amplitude meets f_surge, coils clash, the spring force at the follower drops (lift-off although the static check is
fine) and the spring breaks early. Rule of thumb from valve-train practice: f_surge ≥ 13 × the cam frequency (check
the spring maker / VDI 2143 for your motion law).

```python
def helical_spring(k_req, F_max, d=2.5, D=20.0, G=81500.0, rho=7.85e-6, Rm=1900.0):
    c = D / d
    n = G * d ** 4 / (8 * D ** 3 * k_req)
    K = (4 * c - 1) / (4 * c - 4) + 0.615 / c
    tau = K * 8 * F_max * D / (math.pi * d ** 3)
    m = rho * math.pi ** 2 * d ** 2 * D * n / 4          # kg
    f = 0.5 * math.sqrt(k_req * 1000.0 / m)              # Hz
    return {"c": c, "n": n, "K": K, "tau": tau, "tau_allow": 0.5 * Rm, "m_kg": m, "f_surge": f}
```

Output (spring for the 400 rpm case, k 3 N/mm, F_max 169.1 N):

```
  helical spring for k 3 N/mm, F_max 169.1 N (d 2.5, D 20, G 81500): c 8.0, n_a 16.58, Wahl K 1.1840, tau 653 MPa (allow ~950, check), mass 0.0401 kg, surge frequency 136.7 Hz = 20.5 x cam frequency at 400 rpm
```

**Hand check.**
- n = 81 500·2.5⁴/(8·20³·3) = 81 500·39.06/192 000 = **16.58** coils ✓.
- K = (4·8 − 1)/(4·8 − 4) + 0.615/8 = 31/28 + 0.0769 = **1.1840** ✓.
- τ = 1.184·8·169.1·20/(π·2.5³) = 1.184·27 056/49.09 = **653 MPa** ✓.
- m = 7.85e-6·π²·6.25·20·16.58/4 = 0.0401 kg; f = ½·√(3000/0.0401) = ½·273.5 = **136.7 Hz** ✓.
- Cam frequency 400/60 = 6.67 Hz; ratio 20.5 ✓.

τ = 653 MPa is a static value; for a spring loaded between F_0 = 109 N and F_max = 169 N at 400 rpm (2.1·10⁸ cycles per
year in two shifts) the **fatigue** check with τ_min/τ_max and the Goodman diagram of the wire grade (EN 10270) is
needed – that is the topic of M8. The 1/3-mass of the spring (0.013 kg) is already inside the reduced mass m 2.5 kg.

**Alternatives when a spring is not enough** (form-closed cams, chapter 2): groove cam (the roller runs in a groove –
no spring, but backlash and roller reversal at each change of force direction), conjugate (double) cams with two rollers,
or a **desmodromic** cam pair. They remove lift-off completely but cost more and need tighter tolerances.

### 5.4 Follower vibration: the cam drives a mass–spring system

**Why a rigid model is not enough.** The follower, the roller pin, the bearing, the guide, the camshaft and its bearings
are elastic. Together they form a spring k_f between the ideal cam motion s(t) and the follower mass m. With a damping
coefficient c (from the guide, the oil, the material), the follower position x(t) obeys **base excitation**:

  m·ẍ = −c·(ẋ − ṡ) − k_f·(x − s)   ⇔   **ẍ = −2ζω_n·(ẋ − ṡ) − ω_n²·(x − s)**                  (5.13)

with ω_n = √(k_f/m) and ζ = c/(2·√(k_f·m)). The total stiffness is the series connection of all elastic parts:

  1/k_f = 1/k_stem + 1/k_pin + 1/k_bearing + 1/k_guide + 1/k_camshaft + …                  (5.14)

so the **weakest part dominates** (often the roller-pin bending or the camshaft bending between its bearings). For the
default pusher we assume k_f = 2·10⁶ N/m (2 kN/mm) – check with FEA or a measurement (impulse hammer on the follower).

**Two results matter:**

1. **Dynamic amplification** during the rise: the real inertia force is m·ẍ, not m·s̈. It can be considerably larger,
   which reduces the lift-off margin of section 5.3.
2. **Residual vibration** in the dwell after the rise: the follower oscillates around the top position with amplitude
   A_r. For a pusher, a printing roller or an indexing table this is a **position error during the working phase**.

**Numerical solution.** Eq. 5.13 is integrated with the classic 4th-order Runge–Kutta method (stdlib only). The input
s(t) is the normalised motion law over the rise time T, followed by a dwell; the residual amplitude is the size of the
free vibration √((x − h)² + (ẋ/ω_n)²).

```python
def sdof_rise(law, T_rise, fn, zeta=0.05, h=20.0, n_steps=4000, dwell_factor=2.0):
    wn = 2 * math.pi * fn
    T_end = T_rise * (1 + dwell_factor)
    dt = T_end / n_steps
    def base(t):
        if t >= T_rise:
            return h, 0.0, 0.0
        y, v, a, _ = law_values(law, t / T_rise)
        return h * y, h * v / T_rise, h * a / T_rise ** 2
    def f(t, x, xd):
        s, sd, _ = base(t)
        return -2 * zeta * wn * (xd - sd) - wn ** 2 * (x - s)
    x, xd, t = 0.0, 0.0, 0.0
    amax_x = amax_s = 0.0
    resid = 0.0
    for _ in range(n_steps):
        k1v, k1x = f(t, x, xd), xd
        k2v, k2x = f(t + dt / 2, x + dt / 2 * k1x, xd + dt / 2 * k1v), xd + dt / 2 * k1v
        k3v, k3x = f(t + dt / 2, x + dt / 2 * k2x, xd + dt / 2 * k2v), xd + dt / 2 * k2v
        k4v, k4x = f(t + dt, x + dt * k3x, xd + dt * k3v), xd + dt * k3v
        x += dt / 6 * (k1x + 2 * k2x + 2 * k3x + k4x)
        xd += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
        t += dt
        if t <= T_rise:
            amax_x = max(amax_x, abs(f(t, x, xd)))
            amax_s = max(amax_s, abs(base(t)[2]))
        else:
            resid = max(resid, math.hypot(x - h, xd / wn))   # amplitude of the free vibration around h
    return {"amp_ratio": amax_x / amax_s, "residual_mm": resid}

def follower_vibration(P, k_f=2.0e6, zeta=0.05):
    fn = math.sqrt(k_f / P["m"]) / (2 * math.pi)
    seg = P["segments"][0]
    T_rise = seg["beta"] / 360.0 * 60.0 / P["n_rpm"]
    r = sdof_rise(seg["law"], T_rise, fn, zeta, P["h"])
    return {"fn": fn, "T_rise": T_rise, "ratio": T_rise * fn, **r}
```

The only parameter that matters for a given law is the ratio **T/T_n = T_rise·f_n** (rise time in natural periods) –
the response scales with h. `residual_table()` therefore runs the model with f_n = 1 Hz and T = ratio seconds.

Output (`python cam.py ch56`):

```
## 5.4 Follower vibration (single DOF, RK4)
  k_f 2.0e6 N/m, m 2.5 kg -> fn 142.4 Hz; rise 0.0667 s -> T_rise/T_n 9.49; inertia amplification 1.082, residual 0.0063 mm
  residual amplitude [mm] after a 20 mm rise, undamped, vs T_rise/T_n (2.0, 2.5, 4.0, 4.5, 6.0, 6.5, 9.5, 10.0):
   harmonic   1.3333   0.0000   0.3175   0.0000   0.1399   0.0000   0.0000   0.0501
   cycloidal  0.0000   0.4850   0.0000   0.0735   0.0000   0.0237   0.0075   0.0000
   poly345    0.5775   0.5891   0.0361   0.1046   0.0071   0.0350   0.0112   0.0009
   modsine    1.0998   0.5829   0.1067   0.1769   0.0000   0.0566   0.0113   0.0000
   modtrap    0.0000   0.0797   0.0000   0.1029   0.0000   0.0559   0.0088   0.0000
  inertia amplification vs T_rise/T_n (modsine, zeta 0.05):
   ratio  3.0: max|x''|/max|s''| 1.716, residual 0.2567 mm
   ratio  5.0: max|x''|/max|s''| 1.532, residual 0.0520 mm
   ratio 10.0: max|x''|/max|s''| 1.073, residual 0.0050 mm
   ratio 20.0: max|x''|/max|s''| 1.044, residual 0.0007 mm
```

**Hand check of f_n and the ratio.** ω_n = √(2·10⁶/2.5) = 894.4 rad/s → f_n = 142.4 Hz ✓. T_rise = (120/360)·(60/300)
= 0.0667 s → T/T_n = 0.0667·142.4 = 9.49 ✓.

**Hand check of the zeros (theory).** For an undamped system the residual amplitude is proportional to the magnitude of
the Fourier transform of the acceleration pulse at ω_n (Duhamel integral after the pulse has ended). The cycloidal
acceleration is one full sine period over T: its transform is zero at f_n·T = 2, 3, 4 … – the table shows 0.0000 at
2, 4, 6, 10 ✓. The simple-harmonic acceleration is a half cosine wave with jumps at both ends; its transform has zeros at
f_n·T = 1.5, 2.5, 3.5 … ✓ (0.0000 at 2.5, 4.5, 6.5, 9.5). The zeros are useless in practice – the real f_n is never
known that well and changes with the follower position and the oil temperature – so **read the envelope** (the larger
value of each pair of neighbouring ratios):

| T/T_n ≈ | harmonic | cycloidal | 3-4-5 | modified sine | modified trapezoid |
|---|---|---|---|---|---|
| 2 – 2.5 | 1.33 | 0.49 | 0.59 | 1.10 | 0.08 |
| 4 – 4.5 | 0.32 | 0.07 | 0.10 | 0.18 | 0.10 |
| 6 – 6.5 | 0.14 | 0.024 | 0.035 | 0.057 | 0.056 |
| 9.5 – 10 | 0.050 | 0.0075 | 0.011 | 0.011 | 0.009 |

(mm, after a 20 mm rise, undamped.)

**Conclusions** (they agree with the classical results in VDI 2143 and Norton's *Cam Design and Manufacturing Handbook*):

1. **Simple harmonic is the worst** at every ratio: its acceleration jumps at the start and end (infinite jerk), which
   excites the follower like a hammer blow. Use it only for slow cams.
2. **Cycloidal** has the lowest residual vibration (continuous acceleration, smooth spectrum) – at the price of the
   highest C_a (6.28) of the "good" laws.
3. **3-4-5 polynomial, modified sine and modified trapezoid** are close to each other at ratios ≥ 6. Modified sine
   (C_v 1.76) is chosen when velocity matters (lower kinetic energy, lower pressure angle – section 4), modified
   trapezoid (C_a 4.89) when acceleration matters (lowest inertia force).
4. **The ratio decides more than the law.** Going from T/T_n = 3 to 10 reduces the residual vibration of the modified
   sine by a factor of 50 (0.2567 → 0.0050 mm) and the inertia amplification from 1.72 to 1.07. Rule: **T/T_n ≥ 10 for
   precise machines** (check VDI 2143); below about 5 the rigid-body calculation of sections 5.1–5.3 is not valid any
   more.

**Default cam.** T/T_n = 9.49 gives an amplification of 1.082 (the real peak inertia force is 8 % higher than in 5.1)
and a residual vibration of 6 µm – acceptable for a pusher. The 8 % higher inertia force lowers the lift-off speed by
about √1.08 = 4 % to about 314 rpm – **even closer to the 300 rpm operating speed**. Together with section 5.3 this
calls for a higher preload (≥ 50 N) before the machine goes into production.

**How to raise T/T_n:** stiffer follower (short stiff stem, larger roller pin, camshaft bearings close to the cam),
lighter follower (aluminium or CFRP stem – check fatigue), longer rise angle β (T ∝ β), lower speed. The ratio grows only
with √(k/m), so halving the mass is worth as much as doubling the stiffness.

### 5.5 Camshaft torque, its harmonics, flywheel and drive

**Torque curve.** Eq. 5.4 gives T(θ). For the default cam (core report): T = −1.56 … +2.78 N m, mean 0.318 N m. The
camshaft is alternately driving and driven; every change of sign moves the drive through its backlash (gear, chain,
coupling) – a source of noise and of angular position error of the cam.

**Harmonics.** Any periodic torque can be written as a Fourier series

  T(θ) = T_mean + Σ_k (a_k·cos kθ + b_k·sin kθ),   a_k = (2/N)·Σ T_i cos kθ_i,   b_k = (2/N)·Σ T_i sin kθ_i      (5.15)

The k-th harmonic excites the drive train at f_k = k·n/60. If a torsional natural frequency of motor–coupling–gearbox–
camshaft is near one of the large harmonics, the torque swing is amplified and the cam angle oscillates.

```python
def torque_harmonics(P, nh=6):
    dyn = dynamics(P)
    N = len(dyn)
    th = [math.radians(d["theta"]) for d in dyn]
    T = [d["T"] for d in dyn]
    mean = sum(T) / N
    out = []
    for k in range(1, nh + 1):
        a = 2.0 / N * sum(Ti * math.cos(k * t) for Ti, t in zip(T, th))
        b = 2.0 / N * sum(Ti * math.sin(k * t) for Ti, t in zip(T, th))
        out.append({"k": k, "amp": math.hypot(a, b), "f_hz": k * P["n_rpm"] / 60.0})
    return {"mean": mean, "harm": out}
```

**Flywheel and speed fluctuation.** With the drive delivering a constant torque T_mean, the kinetic energy of the rotating
masses rises when T < T_mean and falls when T > T_mean. The **energy fluctuation** is

  ΔE = max − min of ∫₀^θ (T(θ) − T_mean) dθ                                                (5.16)

and the polar moment of inertia needed for a coefficient of speed fluctuation δ = (ω_max − ω_min)/ω_mean is

  **J = ΔE / (δ·ω²)**                                                                      (5.17)

```python
def flywheel(P, delta=0.02):
    dyn = dynamics(P)
    dth = math.radians(P["step_deg"])
    Tm = sum(d["T"] for d in dyn) / len(dyn)
    E, Emin, Emax = 0.0, 0.0, 0.0
    for d in dyn:
        E += (d["T"] - Tm) * dth
        Emin, Emax = min(Emin, E), max(Emax, E)
    w = 2 * math.pi * P["n_rpm"] / 60.0
    dE = Emax - Emin
    return {"T_mean": Tm, "T_max": max(d["T"] for d in dyn), "dE": dE, "J": dE / (delta * w ** 2),
            "P_mean": Tm * w, "P_peak": max(d["T"] for d in dyn) * w, "delta": delta}
```

Output (`python cam.py ch56`):

```
## 5.5 Camshaft torque, harmonics, flywheel
  mean torque 0.3183 N m; harmonics: 1: 1.290 N m (5 Hz), 2: 0.478 N m (10 Hz), 3: 0.623 N m (15 Hz), 4: 0.247 N m (20 Hz), 5: 0.080 N m (25 Hz), 6: 0.125 N m (30 Hz)
  energy fluctuation 2.6046 J -> J 0.13195 kg m^2 for delta 0.02; mean power 10.0 W, peak 87.2 W
```

**Hand checks.**
- T_mean = W/(2π) = 2.000/(2π) = 0.3183 N m ✓; P_mean = T_mean·ω = 0.3183·31.416 = **10.0 W** ✓ (= 100 N·0.020 m·5 s⁻¹).
- P_peak = 2.78 N m·31.416 = 87.3 W ✓ (87.2 W from the unrounded torque).
- J = 2.6046/(0.02·31.416²) = 2.6046/19.74 = **0.132 kg m²** ✓.

**What this means for the drive.**
- The **energy** swing (2.6 J) is larger than the useful work per cycle (2.0 J). A small motor without inertia would see
  its speed oscillate strongly; δ = 2 % needs J = 0.132 kg m² on the camshaft – a steel disc of about Ø300 × 21 mm.
  Usually this inertia is already present: motor rotor × i² of the gearbox (e.g. rotor 0.0005 kg m² × i² = 15² → 0.11
  kg m²) plus other cams on the same shaft.
- **Motor power** is set by the mean power plus losses (10 W + friction), but the **gearbox and coupling** must be sized
  for the peak torque 2.78 N m including the dynamic amplification (5.4) and must have low backlash because the torque
  reverses every cycle.
- The 1st harmonic (1.29 N m at 5 Hz) and 3rd harmonic (0.62 N m at 15 Hz) are the largest. Keep the first torsional
  natural frequency of the drive train well above 6 × 5 Hz = 30 Hz (check), or shift the cams on a common shaft so that
  their torque harmonics cancel (packaging machines with many cams on one line shaft use this deliberately).
- For servo-driven "electronic cams" (chapter 2) the same torque curve is the motor torque requirement; the motor must
  deliver T_max and the rms torque without overheating.

---

## 6. Contact stress, roller bearing life, lubrication and roller slip

The roller transmits the normal force F_n from the cam to the follower. Three things can fail at this contact: the
**surfaces** (pitting of cam or roller from the Hertz stress), the **roller bearing** (rolling fatigue of the needles or
rollers inside the track roller) and the **lubrication** (wear, scuffing, skidding of the roller). This chapter checks
all three.

### 6.1 Hertz line contact between roller and cam

**Model.** Two cylinders with radii r₁ (roller) and r₂ (local cam profile radius ρ_cam, chapter 4) pressed together by
F_n over the length b. Hertz theory gives a rectangular contact band of half width b_H and an elliptical pressure
distribution with maximum

  **p_max = √( F_n·(1/r₁ + 1/r₂) / (π·b·[(1 − ν₁²)/E₁ + (1 − ν₂²)/E₂]) )**                  (6.1)

  b_H = √( 8·F_n·(1 − ν²) / (π·b·E·(1/r₁ + 1/r₂)) )   (equal materials),   p_max = 2·F_n/(π·b_H·b)         (6.2)

A concave cam portion has a negative radius r₂ (the cam wraps around the roller): the curvature sum gets smaller and
the stress drops – this is why concave flanks are rarely critical for stress (but critical for the cutter, chapter 7).
The largest shear stress lies **below** the surface: τ_max ≈ 0.30·p_max at a depth z ≈ 0.78·b_H. Pitting cracks start
there; the case depth of a hardened cam must be several times z (chapter 7).

Code (`tools/cam.py`):

```python
def hertz_line(F, b, r1, r2, E=210000.0, nu=0.3):
    k = 1.0 / r1 + 1.0 / r2
    if k <= 0 or F <= 0:
        return 0.0
    return math.sqrt(F * k / (math.pi * b * 2 * (1 - nu ** 2) / E))
```

`contact()` applies it at every cam angle with F_n from `dynamics()` and ρ_cam from `pitch_point()`. Core output:

```
## Contact
- Hertz stress max 260 MPa at 32.5 deg (allow 1650) -> S 6.34; roller speed max 1800 rpm
```

The add-on gives the details at the worst point (`contact_detail()`):

```python
def contact_detail(P, R_crown=500.0):
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    i = max(range(len(pts)), key=lambda j: ct["series"][j]["p_max"])
    F = dyn[i]["Fn"]
    rc = pts[i]["rho_cam"]
    cr = crowned_contact(F, P["rr"], rc, R_crown, P["E"], P["nu"])
    q = F / P["b_roller"]
    bh = math.sqrt(8 * F * (1 - P["nu"] ** 2) / (math.pi * P["b_roller"] * P["E"] * (1 / P["rr"] + 1 / rc)))   # half width
    return {"theta": pts[i]["theta"], "F": F, "rho_cam": rc, "q": q, "p_line": ct["p_max"], "half_width": bh,
            "crown": cr, "edge_ok": 2 * cr["a"] < P["b_roller"], "z_max": 0.78 * bh, "tau_max": 0.30 * ct["p_max"]}
```

```
## 6.1 Contact stress detail
  worst point 32.5 deg: F_n 193.8 N, rho_cam 70.50 mm, q 16.15 N/mm, p_line 260 MPa, half width 0.0395 mm, tau_max 78 MPa at depth 0.0308 mm
```

**Hand check.** Curvature sum 1/10 + 1/70.50 = 0.11418 mm⁻¹.
b_H = √(8·193.8·0.91/(π·12·210 000·0.11418)) = √(1410.9/903 950) = √(1.5608·10⁻³) = 0.0395 mm ✓;
p_max = 2·193.8/(π·0.0395·12) = 387.6/1.489 = **260 MPa** ✓; τ_max = 0.30·260 = 78 MPa at z = 0.78·0.0395 = 0.031 mm ✓.

**Why the worst point is at 32.5° and not at the largest force.** The largest stress needs a large force *and* a small
profile radius. At 32.5° (first part of the rise) the process load and the inertia force add up (F_n 194 N) while the
profile is still curved (ρ_cam 70.5 mm). On the top dwell the force is smaller and the radius is R0 + h = 60 mm.

**Allowable stress.** The allowable Hertz stress depends on the material, the hardness, the number of load cycles and the
lubrication. Typical values for line contact at about 10⁸ cycles (check VDI 2143 sheet 2, the material supplier and your
own tests):

```python
CONTACT_MATERIALS = [   # allowable Hertz stress (line contact, ~1e8 load cycles, lubricated) MPa - typical, check
    ("100Cr6 through-hardened 60 HRC", 1650),
    ("16MnCr5 case hardened 58-62 HRC", 1600),
    ("42CrMo4 induction hardened 52-56 HRC", 1300),
    ("31CrMoV9 gas nitrided", 1200),
    ("C45 quenched + tempered 250 HB", 650),
    ("EN-GJS-700 (ductile iron)", 600),
]
```

```
  allowable Hertz stress (check):
   100Cr6 through-hardened 60 HRC          1650 MPa -> S 6.34
   16MnCr5 case hardened 58-62 HRC         1600 MPa -> S 6.15
   42CrMo4 induction hardened 52-56 HRC    1300 MPa -> S 5.00
   31CrMoV9 gas nitrided                   1200 MPa -> S 4.61
   C45 quenched + tempered 250 HB           650 MPa -> S 2.50
   EN-GJS-700 (ductile iron)                600 MPa -> S 2.31
```

With an ideal cylindrical line contact, even an unhardened C45 cam would be safe (S 2.5). **This is misleading** – see
6.2: real rollers are crowned, and the stress is much higher.

### 6.2 Crowned rollers, edge stress and misalignment

**Why rollers are crowned.** A perfectly cylindrical roller only gives a uniform line load when the roller axis is
exactly parallel to the cam axis. A tilt of a few arc-minutes (pin bending under load, follower clearance in the guide,
camshaft deflection) shifts the load to one edge; the Hertz stress at the edge of a cylindrical roller then rises far
above eq. 6.1 ("edge stress", can be 2 … 3 × p_line, check). Track rollers for cams are therefore **crowned** (curved
outer surface, crown radius R_crown) or have a logarithmic profile. The price: the contact becomes a **point contact**
with an elliptical contact area; for small loads it does not use the full roller width.

**Point contact formulas** (Hamrock–Brewe approximation of the Hertz elliptic integrals):

  R_x = 1/(1/r_r + 1/ρ_cam) (rolling direction),   R_y = R_crown (across; the cam is straight across)
  1/R = 1/R_x + 1/R_y,   k = 1.0339·(R_y/R_x)^0.636,   Ē = 1.0003 + 0.5968·R_x/R_y,   E′ = E/(1 − ν²)
  a = (6·k²·Ē·F·R / (π·E′))^(1/3)  (semi-axis along the roller axis),   b = (6·Ē·F·R / (π·k·E′))^(1/3)
  **p_max = 3·F / (2π·a·b)**                                                                (6.3)

```python
def crowned_contact(F, rr, rho_cam, R_crown=500.0, E=210000.0, nu=0.3):
    Rx = 1.0 / (1.0 / rr + 1.0 / rho_cam)
    Ry = R_crown
    R = 1.0 / (1.0 / Rx + 1.0 / Ry)
    k = 1.0339 * (Ry / Rx) ** 0.636
    Eb = 1.0003 + 0.5968 * Rx / Ry
    Ep = E / (1 - nu ** 2)
    a = (6 * k ** 2 * Eb * F * R / (math.pi * Ep)) ** (1 / 3.0)
    b = (6 * Eb * F * R / (math.pi * k * Ep)) ** (1 / 3.0)
    return {"a": a, "b": b, "p": 3 * F / (2 * math.pi * a * b), "k": k}
```

Output (`python cam.py ch56`):

```
  crowned roller R_crown 500 mm: ellipse a 1.368 (axial) x b 0.1010 mm, k 13.54, p_max 670 MPa; ellipse inside width: yes
   R_crown    100 mm: 2a 1.37 mm, p_max 959 MPa
   R_crown    250 mm: 2a 2.03 mm, p_max 779 MPa
   R_crown   1000 mm: 2a 3.67 mm, p_max 577 MPa
   R_crown   2000 mm: 2a 4.93 mm, p_max 498 MPa
```

Note: the first line prints the **semi**-axis a = 1.368 mm (full contact length 2a = 2.74 mm for R_crown 500 mm); the
table prints the full length 2a. For R_crown 100 mm the full length is 1.37 mm – the same digits only by coincidence.

**Hand check (R_crown 500 mm).** R_x = 1/0.11418 = 8.758 mm; R_y/R_x = 57.09; k = 1.0339·57.09^0.636 = 1.0339·13.10
= **13.54** ✓; R = 1/(1/8.758 + 1/500) = 8.607 mm; Ē = 1.0003 + 0.5968·0.01752 = 1.0108; E′ = 230 769 MPa;
a = (6·183.3·1.0108·193.8·8.607/(π·230 769))^(1/3) = (1.8546·10⁶/724 980)^(1/3) = 2.558^(1/3) = **1.368 mm** ✓;
b = (6·1.0108·193.8·8.607/(π·13.54·230 769))^(1/3) = (10 117/9.816·10⁶)^(1/3) = 0.1010 mm ✓;
p = 3·193.8/(2π·1.368·0.1010) = 581.4/0.8681 = **670 MPa** ✓.

**Result and design consequence.** The crowned roller (R 500 mm) loads only 2.7 mm of the 12 mm width at the worst point,
and the stress is **2.6 × the line-contact value** (670 vs 260 MPa). With the material table of 6.1, S drops to
1650/670 = 2.5 for 100Cr6 and to **0.97 for C45** and 0.90 for GJS-700: an unhardened cam would pit. Rules:

- Calculate with the **crowned** contact when the roller is crowned (most catalogue track rollers are – check the
  maker's crown radius; some makers give an "effective" contact length instead).
- A larger crown radius spreads the load (R 2000 mm: 4.9 mm long, 498 MPa) but becomes more sensitive to tilt.
  The best crown just keeps the ellipse inside the width at the **maximum** load and **maximum** tilt.
- Make the cam surface **hardened** (≥ 55 HRC) for any industrial cam; the case depth must be well below the shear
  maximum depth (here 0.03 mm for line contact, about 0.08 mm for the crowned contact) – chapter 7.
- Cam and roller widths: make the cam a little wider than the roller so that the roller edge never runs on a cam edge.

### 6.3 Track-roller bearing life

The roller is a **track roller (cam follower)** – a needle or cylindrical roller bearing with a thick outer ring that
rolls directly on the cam. Two designs: stud type (KR / CF, mounted on a cantilever stud – simple, but the stud bends)
and yoke type (NATR / NUTR, supported on both sides – stiffer, higher load). The thick outer ring bends under the
concentrated load, which unloads some rollers; makers therefore give an **effective dynamic load rating as track roller
C_w** that is lower than the normal bearing rating C_r (check the catalogue; often C_w ≈ 0.7 … 0.9 C_r).

**Equivalent load.** The load and the roller speed change over the cam revolution. The bearing life depends on the cubic
mean of the load **weighted with the roller revolutions** (ISO 281 variable load, exponent p = 10/3 for roller bearings;
we use the cube as in M4 – check):

  P_eq = ( Σ F_n,i³·n_r,i·Δθ / Σ n_r,i·Δθ )^(1/3),   L10 = (C_w/P_eq)^(10/3)·10⁶ roller rev,   L10h = L10/(60·n̄_r)   (6.4)

```python
def track_roller_life(P, C_w=3300.0, lim_h=20000.0):
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    num = den = 0.0
    for d, c in zip(dyn, ct["series"]):
        F = max(d["Fn"], 0.0)
        num += F ** 3 * c["n_roller"]
        den += c["n_roller"]
    Peq = (num / den) ** (1 / 3.0)
    n_mean = den / len(dyn)
    L10_rev = (C_w / Peq) ** (10 / 3.0) * 1e6
    L10_h = L10_rev / (n_mean * 60.0)
    return {"P_eq": Peq, "n_roller_mean": n_mean, "L10_rev": L10_rev, "L10_h": L10_h, "ok": L10_h >= lim_h, "C_w": C_w}
```

Output (example roller Ø20 × 12, C_w 3300 N – a typical value for this size, check the maker):

```
## 6.2 Track-roller life
  C_w 3300 N; equivalent load 121.4 N; mean roller speed 1522 rpm; L10 6.03e+10 rev = 660904 h (OK)
```

**Hand check.** C_w/P_eq = 3300/121.4 = 27.18; 27.18^(10/3) = e^(3.3025·3.333) = e^11.008 = 60 500 → L10 = 6.05·10¹⁰ rev ✓;
L10h = 6.03·10¹⁰/(1522·60) = 660 000 h ✓.

**Reading the result.** The bearing life is no issue – the roller is loaded with only 4 % of its rating. For track
rollers the limits are usually elsewhere: **outer-ring fracture** under shock (check the maker's maximum permissible
radial load F_r,per), **stud bending**, **grease life** at 1800 rpm and 60 °C (relubrication interval; the roller turns
continuously while the load is low – risk of skidding, 6.5), and **wear of the outer-ring surface** if the oil film is
thin (6.4). The mean roller speed (1522 rpm) is 5 × the cam speed because the roller is small: r_cam/r_roller ≈ 5.

### 6.4 Lubrication film between roller and cam

**Elastohydrodynamic (EHL) film.** The rolling contact pulls oil into the inlet; at the high pressure the viscosity rises
by orders of magnitude, and a thin load-carrying film separates the surfaces. For a line contact the minimum film
thickness (Dowson–Higginson) is

  **h_min = 2.65·R_x·U^0.70·G^0.54·W^−0.13**                                              (6.5)

with the dimensionless speed U = η₀·u/(E′·R_x), material parameter G = α·E′ and load W = w/(E′·R_x) (w = F_n/b load per
length, u = mean entraining (rolling) speed, η₀ the dynamic viscosity at the inlet temperature, α the pressure-viscosity
coefficient). The **specific film thickness**

  λ = h_min / √(R_q,roller² + R_q,cam²)                                                    (6.6)

tells the regime: λ < 1 boundary lubrication (wear, scuffing risk, low pitting life), 1 … 3 mixed, > 3 full film.

```python
def film_thickness(P, eta0=0.09, alpha=2.0e-8, Rq=0.3):
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    Ep = P["E"] / (1 - P["nu"] ** 2) * 1e6               # Pa
    worst = None
    for p, d, c in zip(pts, dyn, ct["series"]):
        if d["Fn"] <= 0:
            continue
        Rx = 1.0 / (1.0 / P["rr"] + 1.0 / p["rho_cam"]) / 1000.0     # m
        u = c["n_roller"] * 2 * math.pi / 60 * P["rr"] / 1000.0      # rolling speed m/s (roller surface)
        if u <= 0:
            continue
        w = d["Fn"] / (P["b_roller"] / 1000.0)
        U, G, W = eta0 * u / (Ep * Rx), alpha * Ep, w / (Ep * Rx)
        h = 2.65 * Rx * U ** 0.7 * G ** 0.54 * W ** -0.13 * 1e6      # um
        lam = h / math.sqrt(2) / Rq
        if worst is None or lam < worst["lambda"]:
            worst = {"theta": p["theta"], "u": u, "h_um": h, "lambda": lam}
    return worst
```

Inputs: η₀ = 0.09 Pa·s (ISO VG 100 mineral oil at about 40 °C – check at your real temperature), α = 2·10⁻⁸ Pa⁻¹,
ground surfaces R_q 0.3 µm each.

```
## 6.3 Lubrication film and roller slip
  thinnest film at 0.0 deg: u 1.257 m/s, h_min 0.686 um, lambda 1.62
```

**Hand check at θ = 0°** (base circle, start of the rise): ρ_cam = R0 = 40 mm → R_x = 1/(0.1 + 0.025) = 8 mm;
u = ω·R0 = 31.416·0.040 = 1.257 m/s ✓; F_n = F_c = F_0 + F_e = 30 + 100 = 130 N (the rise segment starts at 0°, so the
process load is already applied) → w = 10 833 N/m.
E′ = 2.308·10¹¹ Pa; U = 0.09·1.257/(2.308·10¹¹·0.008) = 6.13·10⁻¹¹; G = 4615; W = 5.87·10⁻⁶.
U^0.7 = 7.09·10⁻⁸, G^0.54 = 95.2, W^−0.13 = 4.79 → h = 2.65·0.008·7.09·10⁻⁸·95.2·4.79 m = 0.686 µm ✓;
λ = 0.686/(√2·0.3) = **1.62** ✓.

**Meaning.** The default cam runs in **mixed lubrication** (λ 1.6) – acceptable for a hardened, ground cam with oil
lubrication, but with grease or splash lubrication (lower effective viscosity, starved inlet) the film can be much
thinner. Measures: higher viscosity (VG 220 roughly doubles η₀ and raises h by 2^0.7 = 1.6), smoother surfaces
(grinding + superfinishing, chapter 7), larger roller radius (R_x up), and oil jet onto the inlet of the contact. Note
that the thinnest film is at the **base circle** where the speed is low *and* the radius is smallest; on the top dwell
(R0 + h = 60 mm, speed 1.885 m/s) the film is thicker.

### 6.5 Roller slip (skidding)

**Why the roller can skid.** The roller only turns because the cam friction drives it. The required roller speed changes
quickly along the cam (rolling speed = cam surface speed, which depends on ρ and s′), so the roller must be
**accelerated and braked** by the friction force. Where the contact force is small (near lift-off!) and the acceleration
is large, the friction is not enough: the roller slides on the cam, wears flats on its outer ring and scuffs the cam.

Torque balance on the roller (outer ring + rollers approximated as a ring r_o = r_r, r_i, width b):

  J·|α_r| + M₀ ≤ μ·F_n·r_r,   J = m_r·(r_o² + r_i²)/2,   α_r = (dω_r/dθ)·ω                   (6.7)

M₀ is the friction torque of the roller bearing and seals (grease churning – the largest part at low load, check the
maker), μ the traction coefficient of the lubricated contact (0.03 … 0.08).

```python
def roller_slip(P, mu=0.05, M0=0.003, ri_frac=0.5, rho=7.85e-6):
    pts = sweep(P)
    dyn = dynamics(P, pts)
    ct = contact(P, pts, dyn)
    ro, ri = P["rr"], ri_frac * P["rr"]
    m = rho * math.pi * (ro ** 2 - ri ** 2) * P["b_roller"]           # kg
    J = m * ((ro / 1000) ** 2 + (ri / 1000) ** 2) / 2                  # kg m^2
    w = 2 * math.pi * P["n_rpm"] / 60.0
    dth = math.radians(P["step_deg"])
    s = ct["series"]
    N = len(s)
    worst = None
    for i in range(N):
        wr1 = s[(i + 1) % N]["n_roller"] * 2 * math.pi / 60
        wr0 = s[i - 1]["n_roller"] * 2 * math.pi / 60
        alpha = (wr1 - wr0) / (2 * dth) * w
        need = J * abs(alpha) + M0
        avail = mu * max(dyn[i]["Fn"], 0.0) * ro / 1000.0
        ratio = avail / need
        if worst is None or ratio < worst["ratio"]:
            worst = {"theta": s[i]["theta"], "alpha": alpha, "need": need, "avail": avail, "ratio": ratio}
    return {"m_roller": m, "J": J, **worst}
```

Output (`python cam.py ch56`):

```
  roller m 0.0222 kg, J 1.387e-06 kg m^2; worst 212.0 deg: alpha -607 rad/s^2, needed 0.0038 N m, friction 0.0067 N m -> ratio 1.74 (no slip)
   300 rpm (preload for contact x1.3): ratio 1.74 at 212.0 deg
   400 rpm (preload for contact x1.3): ratio 2.37 at 210.5 deg
   600 rpm (preload for contact x1.3): ratio 5.10 at 208.5 deg
```

**Hand check.** m_r = 7.85·10⁻⁶·π·(10² − 5²)·12 = 0.0222 kg ✓; J = 0.0222·(0.01² + 0.005²)/2 = 1.387·10⁻⁶ kg m² ✓;
needed = 1.387·10⁻⁶·607 + 0.003 = 0.00084 + 0.003 = 0.0038 N m ✓; available = 0.05·F_n·0.010 = 0.0067 N m →
F_n = 13.4 N, i.e. the minimum contact force 13.1 N divided by cos φ ✓.

**Reading the result.**
- The worst point is **the same angle as the lift-off point** (212°): small contact force. Skidding is the "early warning"
  of lift-off – a roller with flats on a cam that never lifted off in the calculation usually means the real contact
  force near the critical point was lower than calculated.
- The bearing friction torque M₀ (0.003 N m) is about 80 % of the requirement – the roller inertia is small. Sealed,
  grease-filled rollers with high M₀ skid more easily than open, oil-lubricated ones.
- At higher speeds the ratio *improves* in this table because the preload is raised with the speed (×1.3 the
  lift-off preload); the roller inertia term grows with ω² but the preload grows with ω² as well.

**Measures:** enough preload (section 5.3), a roller with low friction torque (shields instead of contact seals, oil
instead of grease), smaller or lighter roller (J ∝ r⁴), and avoiding very small cam radii at low-force regions.

### 6.6 Summary of chapters 5–6 for the default cam (300 rpm)

| Check | Result | Limit / rule | Status |
|---|---|---|---|
| Lift-off | F_c,min 13.1 N; lift-off speed 326.9 rpm (about 314 rpm with the 8 % dynamic amplification) | ≥ 0 N with margin 1.2–1.5 | **too close – raise preload to ≥ 50 N** |
| Guide | φ_max 17.9°, friction +7 %, φ_jam 76.9° | φ ≤ 30°, a/L ≤ 1 | OK |
| Follower vibration | T/T_n 9.49, amplification 1.08, residual 6 µm | T/T_n ≥ 10 for precise machines | acceptable |
| Spring (400 rpm, k 3) | F_0 109 N, τ 653 MPa, f_surge 20.5 × cam frequency | τ static ≤ 0.5 R_m, fatigue → M8; ≥ 13× | OK statically |
| Torque / drive | −1.56 … +2.78 N m, mean 0.318 N m, ΔE 2.6 J, J 0.13 kg m² for δ 2 % | gearbox for T_max, low backlash | design input |
| Hertz, line contact | 260 MPa | p_allow by material | S 6.3 (100Cr6) |
| Hertz, crowned roller R 500 | **670 MPa** | p_allow | S 2.5 (100Cr6); unhardened steel / cast iron fail |
| Track roller | L10h 660 000 h | ≥ 20 000 h | OK |
| Film | λ 1.62 at the base circle | ≥ 1 (better ≥ 2) | mixed lubrication |
| Roller slip | ratio 1.74 at 212° | ≥ 1 | OK, but linked to the low contact force |

The decisive items are **dynamic** (lift-off margin) and the **crowned contact stress**, not the bearing life. This is
typical for cam mechanisms: the cam is designed in kinematics (chapters 3–4), but it fails in dynamics.


---

## 7. Manufacturing of cams (materials, process chains, NC data, milling, hardening, grinding with X–C interpolation, inspection, harmonic errors, assembly)

A cam is a part whose **shape is the program**. Everything the designer did in chapters 2–6 – the motion law, the
pressure angle, the radius of curvature, the contact force – is only true if the workshop makes the profile to a few
micrometres, hardens it without losing that shape and mounts it at the right angle. This chapter follows the cam through
the workshop, in the order the work is done:

| Step | What happens | Section | Program |
|---|---|---|---|
| 1 | Choose material, heat treatment and process chain | 7.1 | `PROCESS_CHAINS_CAM`, `CAM_MATERIALS` |
| 2 | Generate NC data: point step, chord error, cutter path, gouging | 7.2 | `chord_error()`, `nc_step_for_tol()`, `adaptive_points()`, `tool_path()` |
| 3 | Rough and finish milling | 7.3 | `profile_length()`, `milling_time()` |
| 4 | Harden (induction, case hardening, nitriding) | 7.3 | `CAM_MATERIALS` |
| 5 | Grind on an X–C cam grinder | 7.4–7.5 | `wheel_centre_radius()`, `xc_axis_demand()`, `constant_surface_speed()`, `grinding_time()`, `grinding_burn_check()` |
| 6 | Inspect the lift curve and its error spectrum | 7.6–7.7 | `lift_with_probe()`, `probe_vs_design()`, `harmonic_error_effect()`, `k_for_liftoff()`, `dft_amplitudes()` |
| 7 | Mount, time and adjust | 7.8 | `timing_error()`, `roller_misalignment()`, `DEFECTS_CAM` |

All results of this chapter come from

```
python cam.py ch78
```

and the default cam of `cam.py` (rise 20 mm / 120° modified sine, return 120° cycloidal, R0 40 mm, roller r 10 × 12 mm,
300 rpm, m 2.5 kg, spring 3 N/mm with 30 N preload). Its core report (`python cam.py examples`) ends with:

```
## Contact
- Hertz stress max 260 MPa at 32.5 deg (allow 1650) -> S 6.34; roller speed max 1800 rpm

## Manufacturing
- cutter r 10.0 mm: OK; grinding wheel r 150.0 mm: OK
```

### 7.1 Materials, heat treatment and process chains

**What the cam surface must survive.** The roller rolls over the profile under a line contact. The surface sees a
Hertz stress cycle once per revolution (more often at the nose if the force has several peaks). The failure modes are
the same as for gear flanks and rolling bearings: **pitting** (fatigue under the surface, at the depth of the maximum
shear stress ≈ 0.78·a, a = half contact width), **wear** (abrasive, if hardness is low or the oil is dirty) and
**scuffing** (if the roller slides instead of rolling). The answer is always a hard surface on a tough core, with a
hardened depth well below the shear-stress depth.

The add-on gives two tables. First the process chains (typical values, check with your suppliers):

```
## 7.1 Process chains for cams (check)
  laser / flame cut plate -> mill contour -> induction harden -> grind     tol 0.010 mm, 55-60 HRC         cost 3  | single cams, machine building, medium load
  bar / forging -> turn -> mill contour -> case harden (16MnCr5) -> grind  tol 0.005 mm, 58-62 HRC         cost 4  | high load, high speed, series
  mill from QT steel (42CrMo4) -> nitride (no grinding)                    tol 0.015 mm, 600-700 HV        cost 3  | medium load, low distortion, complex grooves
  chilled cast iron camshaft -> grind                                      tol 0.010 mm, 48-55 HRC (chill) cost 1  | engine camshafts, large series
  mill from tool steel (1.2379) hardened -> wire EDM / grind               tol 0.005 mm, 58-62 HRC         cost 5  | small cams, tool-like cams, prototypes
  mill aluminium / plastic (POM, PA) -> no hardening                       tol 0.030 mm, -                 cost 1  | light duty, low speed, noise-sensitive
  additive (L-PBF 1.2709 maraging) -> age -> grind                         tol 0.010 mm, 50-54 HRC         cost 6  | integrated / hollow cams, prototypes
```

How to read the routes:

- **Plate cam, induction hardened (route 1).** The most common route in machine building (packaging, assembly,
  printing machines). A blank is cut from plate (laser or flame), the bore and faces are turned, the contour is milled
  with 0.2–0.3 mm grinding stock, the track is induction hardened (scanning inductor that follows the contour, or a
  single-shot inductor shaped like the cam) and then ground. Induction heats only the track, so the bore and keyway stay
  soft and do not distort much. Watch the **start/stop overlap** of the scanning inductor: a soft or over-tempered spot
  there is a classic pitting start point. Place it on a dwell at the base circle where the force is lowest.
- **Case hardened 16MnCr5 (route 2).** Best for high load and speed. The whole part is carburised (CHD 0.8–1.2 mm for
  cams – more than for gears because the contact width is larger), hardened and tempered. Distortion is larger than
  with induction, so grinding stock is 0.15–0.3 mm. The bore must be ground too, or protected against carburising
  (copper paste) if it is to be machined after hardening.
- **Nitrided 42CrMo4 (route 3).** Very low distortion (no phase change, 500–550 °C), so the cam can be finish-milled
  before nitriding and used without grinding. The hard layer is thin (0.3–0.5 mm), so the Hertz stress must be
  moderate. Good for **groove cams** (positive-drive cams), whose grooves are hard to grind.
- **Chilled cast iron (route 4).** Engine camshafts: the lobes are cast against chill plates, which gives white,
  hard iron at the surface. Cheapest in very large series.
- **Plastic cams (route 6).** Quiet and cheap for light duty. Allowable stress is about 40 MPa, so only low forces.

Then the materials with a typical allowable Hertz stress (line contact, ~10⁸ cycles, good lubrication – **check**
with your material data and VDI 2741 or the track-roller maker):

```
## 7.1 Materials (allowable Hertz stress, check)
  C45 induction hardened       induction, 1.5-3 mm          55 HRC  p_allow 1100 MPa
  42CrMo4 induction hardened   induction, 2-4 mm            56 HRC  p_allow 1250 MPa
  42CrMo4 nitrided             gas nitriding 0.3-0.5 mm     60 HRC  p_allow 1150 MPa
  16MnCr5 case hardened        carburise CHD 0.8-1.2 mm     60 HRC  p_allow 1650 MPa
  100Cr6 through hardened      through hardened 60-62 HRC   61 HRC  p_allow 1650 MPa
  GJS-700 / chilled cast iron  chill / induction            50 HRC  p_allow  900 MPa
  POM / PA6 (plastic)          -                             0 HRC  p_allow   40 MPa
  default p_max 260 MPa -> lowest material with S >= 1.5: GJS-700 / chilled cast iron
```

The code that picks the lowest material:

```python
ct = contact(P, pts)
print("  default p_max %.0f MPa -> lowest material with S >= 1.5: %s" % (
    ct["p_max"], min((pa, m) for m, (_, _, pa) in CAM_MATERIALS.items() if pa >= 1.5 * ct["p_max"])[1]))
```

**Engineering reading.** The default pusher cam is lightly loaded (260 MPa). In theory cast iron would do. In practice
the shop still chooses an induction-hardened 42CrMo4 or C45 plate cam, for three reasons: (1) the roller is a hardened
bearing ring (about 60 HRC), and a much softer cam wears against it; (2) the hardened track tolerates dirt and the
occasional overload at start-up; (3) the cost difference for one cam is small compared with a machine stop.
**Rule:** for a hardened steel roller, use a cam surface of at least 50–55 HRC, even when the Hertz stress is low.

**Hardened depth check.** The half-width of the contact for line contact is

  a = sqrt( 4·F·R′ / (π·b·E′) ),  1/R′ = 1/r_roller + 1/ρ_cam,  E′ = E/(1 − ν²)

and the maximum shear stress lies at z ≈ 0.78·a. For the default at the maximum normal force (Fn ≈ 196 N, r 10,
ρ ≈ 38 mm, b 12): R′ = 1/(0.1 + 0.0263) = 7.92 mm, E′ = 230 769 MPa, a = sqrt(4·196·7.92/(π·12·230 769)) = 0.0268 mm,
z ≈ 0.021 mm. Even a nitrided layer of 0.3 mm is more than ten times deeper. The hardened depth of cams is decided by
**shock loads, wear allowance and grinding stock**, not by the shear-stress depth of the nominal load. Typical rule
(check): effective hardened depth ≥ 3·(grinding stock per side) + 10·z, and at least 0.8 mm after grinding for
induction-hardened cams.

### 7.2 NC data: point step, chord error, adaptive points, cutter path

The cam profile is not a circle or a line, so a CNC machine can only follow it through **many short elements**:
straight lines (G1 polyline), circular arcs (G2/G3 fitted) or a spline (NURBS, if the control supports it). The core
program writes the profile every `step_deg` = 0.5° into `profile.csv` (columns profile_x, profile_y, cutter_x,
cutter_y …). The question is: how fine must the steps be?

**Chord error.** A straight chord of length L between two points on a curve of radius ρ leaves a gap (sagitta) in the
middle:

  e = ρ − sqrt(ρ² − L²/4) ≈ L²/(8·ρ)

Derivation: the chord, the radius to its middle and the radius to its end form a right triangle with sides L/2,
ρ − e and hypotenuse ρ, so (ρ − e)² + (L/2)² = ρ². Solve for e; for e ≪ ρ drop e², which gives e = L²/(8ρ).

```python
def chord_error(L, rho):
    """Sagitta of a chord L on a circle of radius rho: e = rho - sqrt(rho^2 - L^2/4) ~ L^2 / (8 rho)."""
    return rho - math.sqrt(rho ** 2 - L ** 2 / 4.0)
```

```
## 7.2 NC data: chord error and step
  chord 0.5 mm on rho 37.77 mm: exact 0.8274 um, L^2/(8 rho) 0.8274 um
  chord 1.0 mm on rho 37.77 mm: exact 3.3096 um, L^2/(8 rho) 3.3095 um
  chord 2.0 mm on rho 37.77 mm: exact 13.2403 um, L^2/(8 rho) 13.2380 um
```

Hand check, L = 1 mm on ρ 37.77 mm (the smallest convex profile radius of the default cam): 1²/(8·37.77) =
0.0033095 mm = 3.31 µm ✓. The approximation is exact to 0.02 % even for 2 mm chords.

**Step angle for a tolerance.** Invert the sagitta formula: the allowed chord is L = sqrt(8·ρ·tol). The cam angle that
corresponds to this chord is Δθ = L / (ds_profile/dθ), where ds_profile/dθ is the length of profile per radian. The
program gets the profile length per radian from the pitch-curve speed times ρ_cam/ρ_pitch (the profile is a parallel
curve of the pitch curve at distance r, so arc lengths scale with the radii):

```python
def profile_speed(p):
    """Arc length of the PROFILE per radian of cam angle: pitch speed x rho_cam / rho_pitch."""
    return p["speed_mm_rad"] * abs(p["rho_cam"] / p["rho_pitch"])

def nc_step_for_tol(P, tol_mm=0.001, pts=None):
    pts = pts or sweep(P)
    worst = None
    for p in pts:
        rho = abs(p["rho_cam"])
        L = math.sqrt(8 * rho * tol_mm)           # chord length allowed by the tolerance
        dth = math.degrees(L / profile_speed(p))
        if worst is None or dth < worst[0]:
            worst = (dth, p["theta"], rho)
    return {"step_deg": worst[0], "theta": worst[1], "rho": worst[2], "points": int(math.ceil(360.0 / worst[0]))}
```

A constant step is decided by the worst place on the profile. An **adaptive** step uses the local radius everywhere:
the number of points is the integral of (profile length per step)/(allowed chord):

```python
def adaptive_points(P, tol_mm=0.001, pts=None):
    pts = pts or sweep(P)
    st = math.radians(P["step_deg"])
    n = 0.0
    for p in pts:
        L = math.sqrt(8 * abs(p["rho_cam"]) * tol_mm)
        n += profile_speed(p) * st / L
    return int(math.ceil(n))
```

```
  tol 0.0010 mm: constant step 0.580 deg (621 points, decided at 209.0 deg, rho 38.26) / adaptive 497 points
  tol 0.0005 mm: constant step 0.410 deg (878 points, decided at 209.0 deg, rho 38.26) / adaptive 703 points
  tol 0.0001 mm: constant step 0.183 deg (1963 points, decided at 209.0 deg, rho 38.26) / adaptive 1571 points
```

Hand check for 1 µm: L = sqrt(8·38.26·0.001) = 0.5532 mm. The step 0.580° = 0.01012 rad, so the profile speed at
θ = 209° is 0.5532/0.01012 = 54.7 mm/rad – plausible, since this is on the return flank where the profile runs far from
the centre (R0 + s ≈ 50 mm) and at an angle (pressure angle ~ 18°). Halving the tolerance multiplies the points by √2
(621 → 878), as e ∝ L² predicts.

**Practical rules for NC data:**

1. **Tolerance band.** Use a chord error of at most 1/10 of the profile tolerance. For a ground cam with ±5 µm
   profile tolerance, the NC data for grinding need ≤ 0.5 µm → about 900 points (0.4°). The program's 0.5° output
   is good for milling and for 1 µm grinding data; use `step_deg` 0.1–0.2 for finish-grinding data.
2. **Do not use G1 polylines for high-speed milling** with thousands of points if the control has a small block buffer:
   the feed drops. Use the control's spline compressor (Siemens COMPCURV / COMPCAD, Heidenhain M124 / cycle 32,
   Fanuc AI contour control) or arc fitting with a tolerance of about 1 µm.
3. **Dwell sections are circular arcs**: send them as one G2/G3 block. The base circle and the top dwell are exactly
   concentric circles (radius R0 and R0 + h). Only the rise and return need dense points.
4. **Even steps in angle, not in length**, are best for X–C grinders (section 7.4), because the C axis is the master.

**Cutter path and gouging.** On a milling machine the cutter centre must run on a curve parallel to the profile at the
distance of the cutter radius r_c. The core function offsets the pitch curve (which is already at distance r_roller
from the profile) by (r_c − r_roller):

```python
def tool_path(P, r_tool, pts=None):
    """Centre path of a cutter / grinding wheel of radius r_tool: pitch curve offset by (r_tool - rr) along the outward normal.
    Concave regions need |rho_cam| >= r_tool, otherwise the tool cuts too much (gouging)."""
    pts = pts or sweep(P)
    path = [(p["pitch"][0] + (r_tool - P["rr"]) * p["normal"][0], p["pitch"][1] + (r_tool - P["rr"]) * p["normal"][1]) for p in pts]
    conc = [abs(p["rho_cam"]) for p in pts if p["rho_pitch"] < 0]
    return {"path": path, "rho_concave_min": min(conc) if conc else None, "gouge": bool(conc) and min(conc) < r_tool}
```

```
  cutter r  6.0: gouge False (smallest concave radius None)
  cutter r 10.0: gouge False (smallest concave radius None)
  cutter r 20.0: gouge False (smallest concave radius None)
```

The default profile is fully convex, so any cutter fits. **Two important cases:**

- **Concave flanks.** A cam with a small base circle and a large stroke gets concave parts (ρ_pitch < 0). A tool can
  only make a concave radius that is **at least as large as its own radius**. The same rule holds for the grinding
  wheel – and grinding wheels are large (r 100–300 mm). If the profile has a concave radius of 60 mm, a 150 mm wheel
  cannot grind it: either the cam is redesigned (larger base circle, different law), or a small wheel (r ≤ 50 mm) and a
  slower process are used. Check this **during design**, not when the cam reaches the grinder.
- **Roller radius = cutter radius.** If the cutter radius equals the roller radius, the cutter centre runs exactly on
  the pitch curve. Many shops mill groove cams with an end mill of the roller diameter (slightly undersize) and finish
  with a second pass – the program's `cutter_x, cutter_y` columns are then just the pitch curve.

If you use the control's cutter-radius compensation (G41/G42), send the **profile** coordinates and let the control
offset them. Then the operator can correct wear by changing the radius in the tool table. If you send the cutter-centre
path, the tool radius is "baked in" and every regrind needs new data.

### 7.3 Milling, hardening and the grinding stock

**Milling time.** The contour length is the sum of the polyline elements of the profile:

```python
def profile_length(P, pts=None):
    pts = pts or sweep(P)
    L = 0.0
    for a, b in zip(pts, pts[1:] + pts[:1]):
        L += math.dist(a["profile"], b["profile"])
    return L

def milling_time(P, stock_mm=3.0, ae_rough=1.5, f_rough=600.0, f_finish=300.0, t_setup_min=0.0, pts=None):
    L = profile_length(P, pts)
    nr = math.ceil(stock_mm / ae_rough)
    t = nr * L / f_rough + L / f_finish
    return {"L": L, "passes_rough": nr, "t_min": t + t_setup_min}
```

```
  profile length 318.67 mm; milling: 2 roughing passes + 1 finish -> 2.12 min
```

Hand check: ceil(3/1.5) = 2 passes; 2·318.67/600 + 318.67/300 = 1.062 + 1.062 = 2.12 min ✓. A plain base circle of
R0 40 mm would be 2π·40 = 251 mm long; the rise and return add 67 mm. With side milling (end mill, full flank height)
the time is small. For thick cams or hardened tool steel, the roughing data drop sharply (check the cutter maker's
data).

**What milling must leave for hardening and grinding** (typical, check):

| Route | Stock before hardening, per side | Reason |
|---|---|---|
| Induction hardening + grinding | 0.15–0.25 mm | Small distortion, mostly local; scale |
| Case hardening + grinding | 0.2–0.35 mm | Size growth, ovality, flatness of thin plates |
| Nitriding, no grinding | 0 (finish size − growth ≈ 5–15 µm) | Only the compound layer grows |
| Through hardening + grinding | 0.25–0.4 mm | Larger distortion, quench cracks risk at sharp edges |

**Induction hardening of cam tracks** – the details that decide quality:

1. **Frequency.** The heated depth is set mainly by the frequency (reference depth δ ≈ 503·sqrt(ρ_el/(μ_r·f)) – the
   same formula as M5d chapter 5). For a hardened depth of 1.5–3 mm use 10–30 kHz; for 0.8–1.5 mm use 50–200 kHz.
2. **Contour following.** The coupling gap between inductor and track must stay constant (1–3 mm). At the nose (small
   radius) a straight inductor heats the edges more – use a shaped or scanning inductor with a CNC that follows the
   contour (the NC data of section 7.2 are reused).
3. **Edges.** Cam edges overheat and can crack. A 0.5–1 mm chamfer on both track edges is mandatory.
4. **Overlap zone.** In scanning hardening the start and end overlap. Put the overlap on the base-circle dwell (lowest
   force) and mark it on the drawing ("soft zone allowed 20° at 300–320°" for the default cam, where the follower rests).
5. **Tempering** at 160–200 °C right after hardening to reduce cracking and grinding sensitivity.

### 7.4 Grinding on an X–C cam grinder

A cam grinder has two axes: the workpiece spindle **C** turns the cam, and the wheel slide **X** moves the wheel towards
and away from the cam centre on a straight line through the C axis. The cam profile is created by **interpolating X as a
function of C**. Old machines used a master cam and a follower; CNC grinders use the NC data.

**Geometry.** The wheel touches the cam like a **radial roller follower whose roller radius is the wheel radius r_g**:
the wheel centre is always on the same line through the cam centre (no offset). For every C angle the wheel centre
distance X is the smallest distance at which the circle of radius r_g touches but does not cut the profile. The add-on
computes it directly from the profile points: turn the profile by C, and for every profile point with |x| ≤ r_g the
circle centre must be at least at y + sqrt(r_g² − x²):

```python
def wheel_centre_radius(P, rg, pts=None, step_deg=None):
    pts = pts or sweep(P)
    prof = [p["profile"] for p in pts]
    st = step_deg or P["step_deg"]
    out = []
    n = int(round(360.0 / st))
    for i in range(n):
        ph = math.radians(i * st)
        c, s = math.cos(ph), math.sin(ph)
        best = -1e9
        for (x0, y0) in prof:
            x = c * x0 - s * y0                      # profile turned by +C (same sense as the cam rotation in cam.py)
            if abs(x) <= rg:
                y = s * x0 + c * y0
                v = y + math.sqrt(rg * rg - x * x)
                if v > best:
                    best = v
        out.append((i * st, best))
    return out
```

This is a robust "envelope" method: it never gouges, it works for any profile (also for profiles that come from a
measurement or a CAD export), and it shows the important fact that **X(C) is not the follower lift s(θ)** unless the
wheel radius equals the roller radius and the follower has no offset. The program proves this special case:

```
## 7.4 X-C grinding (wheel centre on a fixed line through the C axis)
  check: wheel radius = roller radius -> X = R0 + rr + s, max deviation 0.00000 mm
```

With r_g = r_roller = 10 mm and e = 0 the wheel centre runs on the pitch curve, so X = R0 + r_roller + s(θ) exactly ✓.

**X axis demand.** The slide must follow X(C) with the right velocity and acceleration. With constant C speed ω_C:

  v_X = dX/dC · ω_C,  a_X = d²X/dC² · ω_C²

```python
def xc_axis_demand(P, rg, C_rpm=30.0, pts=None, step_deg=1.0):
    X = wheel_centre_radius(P, rg, pts, step_deg)
    n = len(X)
    w = 2 * math.pi * C_rpm / 60.0
    h = math.radians(step_deg)
    v = [(X[(i + 1) % n][1] - X[i - 1][1]) / (2 * h) * w for i in range(n)]          # mm/s
    a = [(X[(i + 1) % n][1] - 2 * X[i][1] + X[i - 1][1]) / h ** 2 * w ** 2 for i in range(n)]   # mm/s^2
    return {"X_min": min(x for _, x in X), "X_max": max(x for _, x in X), "v_max": max(abs(x) for x in v),
            "a_max": max(abs(x) for x in a) / 1000.0, "X": X}
```

```
  wheel r  50.0: X 90.000 .. 110.000 mm, at C 30 rpm: v_X max 58.2 mm/s, a_X max 0.37 m/s^2
  wheel r 150.0: X 190.000 .. 210.000 mm, at C 30 rpm: v_X max 57.4 mm/s, a_X max 0.44 m/s^2
  wheel r 250.0: X 290.000 .. 310.000 mm, at C 30 rpm: v_X max 57.3 mm/s, a_X max 0.47 m/s^2
  wheel r 150, C   10 rpm: v_X max   19.1 mm/s, a_X max 0.049 m/s^2
  wheel r 150, C   30 rpm: v_X max   57.4 mm/s, a_X max 0.441 m/s^2
  wheel r 150, C   60 rpm: v_X max  114.8 mm/s, a_X max 1.764 m/s^2
```

Hand checks:
- X range for r_g 150: base circle R0 + r_g = 40 + 150 = 190 mm; top dwell 190 + 20 = 210 mm ✓ (on dwells the wheel
  touches a concentric circle, so X differs from the lift only by a constant there).
- Velocity scales with ω_C, acceleration with ω_C²: 57.4/3 = 19.1 ✓, 0.441/9 = 0.049 ✓, 0.441·4 = 1.764 ✓.
- For r_g = r_roller the peak dX/dC would be the follower's s′_max on the cycloidal return:
  C_v·h/β = 2·20/2.094 = 19.1 mm/rad → 60.0 mm/s at 30 rpm. A larger wheel "sees" a slightly smoother lift
  (57.4 mm/s) because it bridges over the profile.

**Engineering reading.** The X slide of a cam grinder is a small, servo-driven axis. At 60 rpm C speed it needs only
1.8 m/s² – easy. The real limit is **following accuracy**: a profile tolerance of ±3 µm at v_X = 115 mm/s means the
servo lag (velocity/K_v) must be compensated almost perfectly. Cam grinders therefore use feed-forward control, linear
motors or hydrostatic slides, and they grind the finishing passes **slowly** (C 5–20 rpm), even though the slide could
go faster.

**Constant surface speed.** At constant C speed, the work surface speed v_w = ω_C·(ds_profile/dC) changes a lot
around the profile: slow at the base circle, fast on the flanks and on the top dwell. That changes the chip thickness,
the grinding force and the risk of burn. Modern grinders **vary the C speed** so that v_w is constant:

  ω_C(θ) = v_w / (ds_profile/dθ),  t_rev = ∮ dθ / ω_C

```python
def constant_surface_speed(P, v_w_m_min=20.0, pts=None):
    pts = pts or sweep(P)
    vw = v_w_m_min * 1000.0 / 60.0                       # mm/s
    st = math.radians(P["step_deg"])
    t = 0.0
    rpm = []
    for p in pts:
        sp = profile_speed(p)                            # mm/rad
        wC = vw / sp                                     # rad/s
        rpm.append(wC * 60 / (2 * math.pi))
        t += st / wC
    return {"C_rpm_min": min(rpm), "C_rpm_max": max(rpm), "t_rev_s": t}
```

```
  constant surface speed 15 m/min: C 39.8 .. 59.7 rpm, 1.27 s per revolution
```

Hand check: on the base circle the profile speed is R0 = 40 mm/rad, so ω_C = 250/40 = 6.25 rad/s = 59.7 rpm ✓. The
lowest C speed, 39.8 rpm, belongs to the fastest profile region (250/(39.8·2π/60) = 60.0 mm/rad). Since t_rev =
(profile length)/v_w = 318.67/250 = 1.27 s ✓, the time per pass simply follows from the contour length.

### 7.5 Grinding passes, time and grinding burn

**Passes and time.** The grinding stock (here 0.15 mm on the radius, after induction hardening) is removed in roughing
passes of depth a_e, then finishing passes with a small a_e, then spark-out revolutions without infeed (the elastic
deflection of wheel, cam and machine relaxes, and the profile settles to size):

```python
def grinding_time(P, stock_mm=0.15, ae_rough=0.01, ae_finish=0.003, n_spark=2, v_w_m_min=15.0, pts=None):
    cs = constant_surface_speed(P, v_w_m_min, pts)
    nr = math.ceil((stock_mm - 0.01) / ae_rough)
    nf = math.ceil(0.01 / ae_finish)
    n = nr + nf + n_spark
    return {"passes": n, "rough": nr, "finish": nf, "t_rev_s": cs["t_rev_s"], "t_min": n * cs["t_rev_s"] / 60.0}
```

```
  grinding stock 0.15 mm: 14 rough + 4 finish + 2 spark-out = 20 passes -> 0.42 min
```

Hand check: (0.15 − 0.01)/0.01 = 14 rough; 0.01/0.003 = 3.3 → 4 finish; + 2 = 20 passes × 1.27 s = 25.4 s = 0.42 min ✓.
Add 1–2 min for loading, probing (the cam's angular position is found with a touch probe on the keyway or a flank) and
wheel dressing per batch. For a single cam on a universal grinder with a CNC rotary axis, the process is the same but
slower.

**Grinding burn.** If too much material is removed per unit time, the contact zone gets so hot that the hardened surface
is **tempered** (softened – "tempering burn") or even re-austenitised and quenched again ("re-hardening burn", a brittle
white layer with a soft zone under it). Both reduce the pitting life drastically and can crack. A first measure is the
**specific material removal rate**

  Q′_w = a_e · v_w   [mm³/(mm·s)]   (removed volume per second and per mm of wheel width)

```python
def grinding_burn_check(ae_mm, v_w_m_min, Qw_limit=3.0):
    """Specific removal rate Q'w = ae v_w (mm^3 / (mm s)); corundum wheels on hardened steel ~ 1..3 safe, CBN higher (check)."""
    Qw = ae_mm * v_w_m_min * 1000.0 / 60.0
    return {"Qw": Qw, "burn_risk": Qw > Qw_limit}
```

```
  ae 0.003 mm, v_w 15 m/min: Q'w 0.75 mm3/(mm s) ok
  ae 0.010 mm, v_w 15 m/min: Q'w 2.50 mm3/(mm s) ok
  ae 0.020 mm, v_w 20 m/min: Q'w 6.67 mm3/(mm s) BURN RISK
```

Hand check: 0.01 mm · 15 000 mm/min / 60 = 2.5 mm³/(mm·s) ✓. The limit of about 3 mm³/(mm·s) for a corundum wheel on
hardened steel is a typical shop value (check with the wheel maker; CBN wheels and good coolant allow 5–20). Note the
connection with constant surface speed: at constant C speed the flank regions run faster and **burn first**; constant
v_w keeps Q′_w even around the profile.

**Inspection for burn:** nital etching (dark/light spots show tempered/re-hardened areas, standard ISO 14104) on a sample
of each batch, or Barkhausen-noise testing on every cam for safety-relevant parts. A cam that shows burn is scrapped –
regrinding does not remove the damaged zone under the surface.

### 7.6 Inspection of the lift curve

**What is measured.** For a cam, the functional quantity is the **lift curve** s(θ) seen by the follower, not the
x–y profile. Two ways:

1. **On a cam measuring machine or a rotary table with a radial probe**: the cam turns in steps (e.g. 0.5°), a probe
   with a roller or ball of radius r_probe on a linear scale measures the radial lift. This is the classical method and
   gives the lift directly.
2. **On a coordinate measuring machine (CMM)** with scanning: the x–y profile is measured and compared with the CAD
   profile normal to the surface ("profile deviation"); the lift is then computed in software.

**Probe radius matters.** A probe of another radius than the follower roller "sees" another lift curve, because the
contact point moves on the profile. The add-on simulates the radial probe with the same envelope method as the
grinding wheel:

```python
def lift_with_probe(P, r_probe, pts=None, step_deg=1.0):
    X = wheel_centre_radius(P, r_probe, pts, step_deg)
    base = min(x for _, x in X)
    return [(th, x - base) for th, x in X]

def probe_vs_design(P, r_probe, pts=None):
    L = lift_with_probe(P, r_probe, pts, 1.0)
    diff = [abs(l - motion(P, th)[0]) for th, l in L]
    return max(diff)
```

```
## 7.6 Inspection: lift seen by a probe of another radius
  probe r  5.0 mm: max difference to the design lift 0.2787 mm
  probe r 10.0 mm: max difference to the design lift 0.0000 mm
  probe r 15.0 mm: max difference to the design lift 0.2318 mm
```

**Engineering reading.** A probe that is only 5 mm smaller than the roller shows up to **0.28 mm** "error" on a cam that
is perfect – 50 times the profile tolerance. Rules for the inspection plan:

- Measure with a **probe of the follower's roller radius**, on the follower's offset line, or
- Convert the design lift for the actual probe radius in software (exactly what `lift_with_probe()` does) and compare
  measured with converted.
- Specify on the drawing: "lift table for roller Ø20, offset 0, valid for measuring roller Ø20" – and give the lift
  table (θ, s) from `profile.csv`.

**Tolerances (typical, check VDI 2741 and your application):**

| Cam class | Lift tolerance | Profile form tolerance | Angle (timing) tolerance |
|---|---|---|---|
| Machine-building plate cam, milled | ±0.03 mm | 0.03 mm | ±0.2° |
| Ground plate cam (packaging, printing) | ±0.01 mm | 0.01 mm | ±0.05° |
| High-speed / indexing cam, ground | ±0.005 mm | 0.005 mm + harmonic limits | ±0.02° |
| Engine camshaft | ±0.01–0.02 mm (lift), velocity/acceleration checked | – | ±0.25° crank |

A plain lift tolerance is not enough for fast cams – section 7.7 shows why.

### 7.7 Harmonic profile errors – why micrometres become newtons

This is the most important practical result of cam manufacturing. A lift error is never random noise only. It has
**harmonics**: eccentricity of the mounting (order k = 1), the C-axis drive and gears of the grinder (k = number of
teeth or poles), wheel unbalance and chatter (k = wheel speed / work speed), polygon effects of the NC data (k = number
of points between "corners"). Write one harmonic of the lift error as

  δs(θ) = A · sin(k·θ)

With θ = ω·t the follower acceleration from this error is

  δa = d²(δs)/dt² = −A · k² · ω² · sin(kθ)   → amplitude **A·k²·ω²**

The acceleration grows with the **square of the harmonic order**. A 5 µm error at k = 20 is a 100-fold larger
acceleration than the same error at k = 2. The extra force on the follower is m·A·k²·ω², and it can eat the whole
contact-force margin that the spring was designed for (chapter 5).

```python
def harmonic_error_effect(P, A_um, k, n_rpm=None):
    n = n_rpm or P["n_rpm"]
    w = 2 * math.pi * n / 60.0
    da = A_um * 1e-6 * k ** 2 * w ** 2
    return {"k": k, "da": da, "dF": P["m"] * da, "f_Hz": k * n / 60.0}

def k_for_liftoff(P, A_um, n_rpm=None):
    Q = dict(P, n_rpm=n_rpm or P["n_rpm"])
    Fm = jump_check(Q)["Fc_min"]
    w = 2 * math.pi * Q["n_rpm"] / 60.0
    if Fm <= 0:
        return 0.0
    return math.sqrt(Fm / (P["m"] * A_um * 1e-6 * w ** 2))
```

```
## 7.7 Harmonic profile errors (A = 5 um, default 300 rpm, a_max design 28.3 m/s^2, Fc_min 13.1 N)
  k  1: f    5.0 Hz, extra acceleration   0.00 m/s^2, extra force   0.01 N
  k  5: f   25.0 Hz, extra acceleration   0.12 m/s^2, extra force   0.31 N
  k 10: f   50.0 Hz, extra acceleration   0.49 m/s^2, extra force   1.23 N
  k 20: f  100.0 Hz, extra acceleration   1.97 m/s^2, extra force   4.93 N
  k 30: f  150.0 Hz, extra acceleration   4.44 m/s^2, extra force  11.10 N
  k 50: f  250.0 Hz, extra acceleration  12.34 m/s^2, extra force  30.84 N
  300 rpm: a 5 um error at k >= 32.6 uses up the whole contact margin
  400 rpm: the default already lifts off without any profile error
```

Hand check for k = 20: ω = 2π·300/60 = 31.42 rad/s, ω² = 987.0; δa = 5·10⁻⁶·400·987.0 = 1.974 m/s² ✓;
δF = 2.5·1.974 = 4.93 N ✓; frequency 20·5 Hz = 100 Hz ✓. Lift-off order: k = sqrt(13.1/(2.5·5·10⁻⁶·987.0)) =
sqrt(1061.8) = 32.6 ✓.

**Engineering reading:**

1. A ground cam with "only" ±5 µm lift tolerance can still be **noisy and lift off** if that error sits at a high
   harmonic. The default pusher has a contact margin of only 13.1 N at 300 rpm (chapter 5); a 5 µm waviness with
   about 33 waves per revolution would make the roller jump – although every point is inside the lift tolerance.
2. **A second danger is resonance.** The error excites the follower at f = k·n/60. If this frequency is near the
   natural frequency of the follower train (spring–mass, chapter 5/6), the response is amplified many times. A 100 Hz
   excitation on a follower with 100 Hz natural frequency is a classic cause of pitting and noise "at one speed only".
3. **Specify harmonics, not only lift.** Good practice for fast cams: limit the harmonic amplitudes, e.g. A_k ≤
   A_max·(k_ref/k)² above k_ref (check), or directly specify the maximum **acceleration error** derived from the
   measured lift (second difference after filtering). Cam measuring software provides an FFT of the lift error.

**Analysing a measured lift error (DFT).** The add-on builds a synthetic measurement with the typical sources –
4 µm eccentricity (k = 1), 2.5 µm from the grinder's C drive (k = 8), 1.2 µm chatter (k = 23) and 0.3 µm noise – and
takes the discrete Fourier transform:

  A_k = (2/N) · | Σ e_i · exp(−j·k·θ_i) |

```python
def synthetic_lift_error(n=720, seed=7):
    import random                      # local: the merge keeps only the code after the cam import
    rnd = random.Random(seed)
    out = []
    for i in range(n):
        th = 2 * math.pi * i / n
        e = 4.0 * math.sin(th + 0.3) + 2.5 * math.sin(8 * th + 1.1) + 1.2 * math.sin(23 * th) + rnd.gauss(0.0, 0.3)
        out.append(e)
    return out

def dft_amplitudes(err, kmax=40):
    n = len(err)
    res = []
    for k in range(1, kmax + 1):
        re = sum(e * math.cos(2 * math.pi * k * i / n) for i, e in enumerate(err))
        im = sum(e * math.sin(2 * math.pi * k * i / n) for i, e in enumerate(err))
        res.append((k, 2.0 / n * math.hypot(re, im)))
    return res
```

```
  synthetic measured error: peak-peak 15.23 um; largest DFT amplitudes: k1 4.01 um, k8 2.49 um, k23 1.19 um, k7 0.06 um
    k  1 (4.01 um): extra force 0.01 N
    k  8 (2.49 um): extra force 0.39 N
    k 23 (1.19 um): extra force 1.55 N
```

The DFT finds the three sources with the right amplitudes (4.01 / 2.49 / 1.19 µm against 4.0 / 2.5 / 1.2 µm put in).
The peak-to-peak error of 15.2 µm is dominated by the **eccentricity**, which is dynamically harmless (0.01 N) –
it is only a small timing/lift shift and can be corrected by better centring. The **smallest** component, 1.2 µm at
k = 23, produces the **largest** force (1.55 N). This is why cam inspection must look at the spectrum, not at the
peak-to-peak value. Each harmonic also points to its cause: k = 1 → mounting/centring; k = number of teeth of the C
drive or encoder lines → machine; k from wheel speed ratio → wheel balance/dressing; regular k at the NC point spacing
→ NC data too coarse.

### 7.8 Timing on the shaft, assembly and adjustment

**Timing (phasing).** The cam must sit on the camshaft at the right angle relative to the machine's master angle
(encoder zero, other cams). The connection decides how well this angle holds:

| Connection | Angle accuracy | Torque / remarks |
|---|---|---|
| Feather key (DIN 6885) | Key play 0.01–0.05 mm → 0.05–0.2° | Simple; play can grow (fretting); not adjustable |
| Taper bush / clamping sleeve | Free adjustment, holds by friction | Set angle with a gauge or encoder, then clamp |
| Shrink disc / clamping set | Free adjustment, high torque, no play | Best for indexing and high-speed cams |
| Fitted pins (two dowels) | ±0.02° after drilling in assembly | For final timing after adjustment |
| Integral (cam ground on the shaft) | Ground in one set-up | Engine camshafts, best accuracy |

The angle error from play is Δθ = backlash/r (r = radius of the key or clamping surface), and the lift error it causes
is up to s′_max·Δθ:

```python
def timing_error(P, backlash_mm=0.02, r_mm=15.0, pts=None):
    pts = pts or sweep(P)
    dth = backlash_mm / r_mm
    return {"dtheta_deg": math.degrees(dth), "ds_max_mm": max(abs(p["s1"]) for p in pts) * dth}
```

```
## 7.8 Timing and assembly
  key play 0.020 mm at r 15: timing error 0.076 deg, lift error up to 0.025 mm
  key play 0.050 mm at r 15: timing error 0.191 deg, lift error up to 0.064 mm
  key play 0.000 mm at r 15: timing error 0.000 deg, lift error up to 0.000 mm
```

Hand check: 0.02/15 = 1.333·10⁻³ rad = 0.0764° ✓; s′_max (cycloidal return) = 2·20/2.094 = 19.10 mm/rad;
19.10·1.333·10⁻³ = 0.0255 mm ✓. **A key with 0.02 mm play alone uses the whole ±0.01 mm lift tolerance of a ground
cam** on the steep flank – and if the torque reverses during the cycle (the camshaft torque of the default cam goes
from −1.56 to +2.78 N·m, chapter 5), the cam knocks across the play twice per revolution. For ground cams use a
play-free connection (shrink disc, clamping set, or key with interference fit plus pins).

**Roller alignment.** The roller axis must be parallel to the cam axis. A tilt opens a gap at one edge of the roller;
the load then runs on part of the width and the Hertz stress rises (p ∝ 1/sqrt(b)). The add-on uses a deliberately
simple estimate – full width if the edge gap is below about 2 µm (elastic approach), otherwise a width proportional to
2 µm/gap (**check** with the roller maker's crowning data):

```python
def roller_misalignment(b_mm, tilt_deg, Fn, E=210000.0, nu=0.3):
    g = b_mm * math.tan(math.radians(tilt_deg)) * 1000.0   # um
    b_eff = b_mm if g <= 2.0 else max(b_mm * 2.0 / g, 0.2 * b_mm)
    return {"gap_um": g, "b_eff": b_eff, "stress_factor": math.sqrt(b_mm / b_eff)}
```

```
  roller tilt 0.005 deg: edge gap 1.0 um, effective width 12.0 mm, stress x 1.00
  roller tilt 0.020 deg: edge gap 4.2 um, effective width 5.7 mm, stress x 1.45
  roller tilt 0.050 deg: edge gap 10.5 um, effective width 2.4 mm, stress x 2.24
```

Hand check for 0.02°: 12·tan(0.02°) = 12·3.49·10⁻⁴ mm = 4.19 µm; b_eff = 12·2/4.19 = 5.73 mm; factor sqrt(12/5.73) =
1.45 ✓. A tilt of 0.02° – 0.35 mm per metre – is already a 45 % stress increase. Therefore:

- Use **crowned track rollers** (cam followers with a crowned outer ring, e.g. profile "R" in the maker's catalogue).
  The crown tolerates about 0.05–0.1° misalignment with a smaller stress increase.
- Specify parallelism of cam bore and follower guide (e.g. 0.02 mm over the roller width) and check it at assembly
  with a dial gauge across the roller.
- Look at the **wear track** after the first hours: it must be centred and of even width.

**Preload setting.** The spring preload is a design value (chapter 5) but it is set at assembly – by a spacer, a
threaded spring seat or a pneumatic cylinder. Procedure: (1) measure the spring force at the follower's base position
with a force gauge, (2) set to the design preload (30 N for the default) **plus** a margin for spring relaxation
(5–10 %, check), (3) run up the speed slowly and listen/measure (accelerometer on the follower) for knocking at the
angle of minimum contact force (213° for the default).

**Typical defects** (from the add-on table `DEFECTS_CAM`):

```
  defects:
   - noise / knocking at one angle | cause: lift-off (jump) or backlash reversal | remedy: check Fc_min, raise preload, smoother law
   - pitting near the nose / on the flank of max force | cause: Hertz stress too high, poor hardness | remedy: larger base circle / roller, harder material, wider roller
   - scuffing / smearing | cause: roller skidding (does not roll), poor lubrication | remedy: lower roller inertia, minimum load, better oil
   - flat spots on the roller | cause: skidding at high acceleration changes | remedy: check roller drag torque, preload
   - wavy wear pattern | cause: profile harmonics, grinding chatter | remedy: DFT of lift error, dress wheel, balance
   - worn edge of the track | cause: roller tilt / not crowned | remedy: align, use crowned track roller
   - wrong timing of the machine | cause: key play, wrong phasing, slipped clamp | remedy: taper / shrink disc, check timing with encoder
   - cracks after grinding | cause: grinding burn / re-hardening | remedy: nital etch, lower Q'w, sharper wheel
```

A note on **roller skidding**: the roller must be accelerated by friction at the contact. At high angular accelerations
of the roller (its speed changes with the profile speed – on the default cam it reaches 1800 rpm, see the core report –
and changes fastest where the profile radius changes) and low contact force, the friction cannot accelerate the roller's inertia plus its bearing drag, and the roller
slides. Sliding under load destroys the surface in hours (smearing). Remedies: enough minimum contact force (here is
another reason for the spring margin), light rollers, rollers with low-friction bearings (needle rather than plain
bush), and oil rather than grease at high speed.

---

## 8. Verification, complete worked example, references, glossary

### 8.1 Verification – what the self-test and the hand checks prove

The core self-test (`python cam.py selftest`) checks the theory of chapters 2–6 independently (published C_v and C_a
of all motion laws, closed forms of the cycloidal and 3-4-5 laws, roller distance between pitch curve and profile,
radius of curvature by a 3-point circle, derivative of the lift, pressure angle formula, energy balance of the camshaft
torque, Hertz formula, base-circle sizing). Chapter 7 adds these checks, all reproduced by hand above:

| Check | Program value | Hand value |
|---|---|---|
| Chord error L = 1 mm, ρ 37.77 | 3.3096 µm (exact), 3.3095 µm (L²/8ρ) | 3.31 µm |
| Step for 1 µm at ρ 38.26 | 0.580° | L = 0.553 mm at 54.7 mm/rad |
| Milling time | 2.12 min | 2·318.67/600 + 318.67/300 |
| X–C wheel = roller radius | max deviation 0.00000 mm to R0 + r + s | exact by geometry |
| X range r_g 150 | 190 … 210 mm | R0 + r_g … + h |
| Constant surface speed on the base circle | 59.7 rpm | 250 mm/s / 40 mm |
| Grinding passes / time | 20 / 0.42 min | 14 + 4 + 2, × 1.27 s |
| Q′_w | 2.50 mm³/(mm·s) | 0.01·15 000/60 |
| Harmonic error k 20, 5 µm | 1.97 m/s², 4.93 N | A k² ω² |
| Lift-off order | 32.6 | sqrt(F/(m A ω²)) |
| DFT of synthetic error | 4.01 / 2.49 / 1.19 µm | 4.0 / 2.5 / 1.2 µm input |
| Timing error | 0.076°, 0.025 mm | 0.02/15 rad, × 19.10 |
| Roller tilt 0.02° | 4.2 µm gap, × 1.45 | 12 tan 0.02° |

### 8.2 Complete worked example – the pusher must run at 400 rpm

**Task.** The packaging line is to be speeded up from 300 to 400 cycles per minute. The pusher cam (default of
`cam.py`) must keep contact, stay within the pressure angle and Hertz limits, and be manufacturable with the existing
route (plate cam 42CrMo4, induction hardened, ground on an X–C grinder with a 150 mm wheel). The stroke (20 mm) and the
total cycle are fixed by the machine; the dwell at the top may be shortened from 60° to 40°, and the base dwell from 60°
to 40°, because the product transfer only needs 40°.

**Step 0 – what happens at 400 rpm with the old cam?** From the core (chapter 5) the contact force at 400 rpm is −41.5 N:
the follower **lifts off** on the return stroke (the cycloidal return has C_a 6.28, the return acceleration pulls the
follower away and the soft spring cannot hold it).

**Step 1 – better motion programme.** Use the 40° of freed dwell for longer motion segments and replace the cycloidal
return by a modified sine (C_a 5.53 instead of 6.28):

| Segment | old | new |
|---|---|---|
| rise | 120° modified sine | 130° modified sine |
| dwell (top) | 60° | 40° |
| return | 120° cycloidal | 150° modified sine |
| dwell (base) | 60° | 40° |

The peak return acceleration scales with C_a/β²: old 6.283/2.094² = 1.433, new 5.528/2.618² = 0.807 per (h ω²) – a
44 % reduction. The rise gets slightly faster acceleration because 130° with modified sine still gives
5.528/2.269² = 1.074 < 1.433.

**Step 2 – spring.** The contact force after step 1 is positive again (17.7 N), but the program shows the margin is
small: a 5 µm harmonic at k ≈ 28 would already eat it. A stiffer spring with more preload (4 N/mm, 70 N) gives a large
margin that also covers the start-up, spring relaxation and the harmonic errors of section 7.7.

**Step 3 – base circle.** With the lower pressure angles (14.7° after step 1) the base circle can be reduced from 40 to
35 mm. This makes the cam lighter and smaller, the camshaft hub still fits (bore 25–30 mm), and the pressure angle stays
far below 30°.

The add-on runs all steps:

```python
EXAMPLE_CAM = {
    "name": "Packaging pusher redesigned for 400 rpm: modified-sine rise 130 deg, modified-sine return 150 deg (example)",
    "segments": [
        {"kind": "rise", "law": "modsine", "beta": 130.0},
        {"kind": "dwell", "beta": 40.0},
        {"kind": "return", "law": "modsine", "beta": 150.0},
        {"kind": "dwell", "beta": 40.0},
    ],
    "n_rpm": 400.0,
    "k_spring": 4.0, "F0_spring": 70.0,
    "R0": 35.0,
}
```

```
## 8.2 Worked example: pusher at 400 rpm
  variant                           phi_max   rho_cam    Fc_min   Fn_max    p_max    T_max
  default at 300 rpm                 17.85°    37.77     13.1 N    196 N   260 MPa  2.78 Nm
  default at 400 rpm                 17.85°    37.77    -41.5 N    243 N   289 MPa  3.06 Nm
  step 1: return modsine 150 deg     14.68°    40.00     17.7 N    227 N   281 MPa  2.73 Nm
  step 2: + spring 4 N/mm, 70 N      14.68°    40.00     70.0 N    268 N   306 MPa  3.42 Nm
  step 3: + R0 35 (final)            15.99°    35.00     70.0 N    269 N   307 MPa  3.42 Nm
  step 1  preload needed for contact 12.3 N (actual 30 N); 5 um error uses the margin at k >= 28.4
  final   preload needed for contact 0.0 N (actual 70 N); 5 um error uses the margin at k >= 56.5
  smallest base circle for the final programme: R0 = 10.00 mm (search starts at 10 mm)
  NC step for 1 um: 0.619 deg (582 points); grinding 0.38 min
```

How to read the table:

- In steps 2 and 3, Fc_min = 70.0 N is the preload on the base dwell – the motion itself never comes close to zero
  (the program says a preload of 0 N would be enough for contact, the 70 N are pure margin). The harmonic margin rises
  from k ≈ 28 to k ≈ 57 for a 5 µm error, which is far above what a good grinder produces.
- The price of the stronger spring: the normal force rises from 227 to 269 N, the Hertz stress from 281 to 307 MPa
  (S = 1650/307 = 5.4 on the case-hardened value; for induction-hardened 42CrMo4 with 1250 MPa still S = 4.1), the
  peak camshaft torque from 2.73 to 3.42 N·m. All acceptable.
- The minimum base circle the pressure angle and curvature would allow is very small (the search returns its lower bound
  of 10 mm). The base circle is therefore set by the **hub and shaft** (35 mm leaves a 10 mm wall around a 30 mm bore
  with keyway/clamp), not by the kinematics.

**Step 4 – full report of the final cam.**

```
python cam.py run --in examples/cam_example.json --out example
```

```
# Cam report - Packaging pusher redesigned for 400 rpm: modified-sine rise 130 deg, modified-sine return 150 deg (example)

stroke 20.0 mm, base circle R0 35.0 (pitch 45.0), roller r 10.0 x 12.0 mm, offset e 0.0, 400 rpm (ccw)

## Motion programme
- rise 130.0 deg, modsine (C_v 1.760, C_a 5.528, C_j 69.5): v_max 0.650 m/s, a_max 37.7 m/s^2, jerk_max 8742 m/s^3
- dwell 40.0 deg
- return 150.0 deg, modsine (C_v 1.760, C_a 5.528, C_j 69.5): v_max 0.563 m/s, a_max 28.3 m/s^2, jerk_max 5691 m/s^3
- dwell 40.0 deg

## Geometry
- pressure angle max +15.99 deg, min -13.94 deg; largest |phi| at 58.5 deg (allow 30: OK)
- smallest convex radius: pitch curve 45.00, profile 35.00 mm (roller 10.0: no undercut); smallest concave profile radius none (profile fully convex)
- smallest base circle for phi <= 30 deg and rho_pitch >= 1.5 r: R0 = 10.00 mm

## Dynamics
- follower force: inertia -94..94 N, spring 70..150 N, contact force min 70.0 N at 320.0 deg (keeps contact)
- minimum spring preload for contact: 0.0 N (actual 70.0 N)
- normal force max 269 N, side force on the guide max 66 N, camshaft torque -1.57 .. 3.42 N m (mean 0.318)

## Contact
- Hertz stress max 307 MPa at 32.5 deg (allow 1650) -> S 5.37; roller speed max 2200 rpm

## Manufacturing
- cutter r 10.0 mm: OK; grinding wheel r 150.0 mm: OK
written: report.md, profile.csv -> example
```

Hand check of the rise acceleration: ω = 2π·400/60 = 41.89 rad/s, ω² = 1754.6; β = 130° = 2.269 rad;
a_max = C_a·h·ω²/β² = 5.528·0.020·1754.6/5.148 = 37.7 m/s² ✓; inertia force 2.5·37.7 = 94 N ✓. The mean camshaft torque
0.318 N·m equals the process work per cycle: 100 N·0.020 m/(2π) = 0.318 N·m ✓ (spring and inertia return their energy
over a revolution).

**Step 5 – manufacturing data of the final cam** (route: plate 42CrMo4 → turn → mill → induction harden → grind):

| Item | Value | Source |
|---|---|---|
| NC data | step 0.619° (582 points) for 1 µm chord error; send dwells as G2/G3 arcs | `nc_step_for_tol()` |
| Milling | contour with 0.2 mm stock per side; r_c 10 mm cutter OK (no concave parts) | `tool_path()` |
| Hardening | induction, 1.5–2.5 mm, 54–58 HRC; overlap zone on the base dwell 330–350°; edges chamfered 1 mm | 7.3 |
| Grinding | wheel r 150 mm OK (convex profile), constant surface speed 15 m/min, Q′_w ≤ 2.5 → 0.38 min per cam | `grinding_time()`, `grinding_burn_check()` |
| Inspection | lift table for roller Ø20 / offset 0 measured with a Ø20 roller; lift ±0.01 mm; harmonics: A_k ≤ 2 µm for k > 20 (check); nital etch per batch | 7.6, 7.7 |
| Mounting | shrink disc (no play) instead of the old key; timing set with the machine encoder, ±0.05° | 7.8 |
| Follower | crowned track roller Ø20 × 12, max 2200 rpm (check the roller's limiting speed); spring 4 N/mm, preload 70 N set with a force gauge | 7.8, core report |

**Result.** The pusher runs at 400 rpm with a 70 N contact margin, 16° maximum pressure angle and 307 MPa Hertz stress.
The cam is smaller than before (R0 35 instead of 40). The change of the connection from key to shrink disc is part of the
redesign: with the old 0.02 mm key play the timing error alone (0.076°, up to 0.025 mm lift error) would exceed the
±0.01 mm lift tolerance of a ground cam.

### 8.3 Checklist for releasing a cam drawing

1. Motion programme with laws and segment angles, lift table (θ, s) for the follower roller radius and offset.
2. Pressure angle ≤ allowable over the whole cycle, smallest convex profile radius > 0 (no undercut), concave radii ≥
   grinding-wheel radius.
3. Contact force > 0 with margin at the maximum speed, including spring tolerance and relaxation; harmonic margin
   (section 7.7).
4. Hertz stress ≤ allowable for the chosen material and hardened depth; roller limiting speed and life.
5. Material, heat treatment, hardened depth after grinding, soft zone position.
6. Profile/lift tolerance, harmonic limits, angle (timing) tolerance and the datum (keyway, bore, mark).
7. Inspection method stated (measuring roller radius!), nital etch / Barkhausen for burn.
8. Mounting: play-free connection or pinned after timing; roller alignment tolerance; preload value and how it is set.

### 8.4 References

- VDI 2143 Blatt 1: Bewegungsgesetze für Kurvengetriebe – Theoretische Grundlagen (motion laws, characteristic values).
- VDI 2143 Blatt 2: Bewegungsgesetze für Kurvengetriebe – Praktische Anwendung.
- VDI 2142 Blatt 1/2: Auslegung ebener Kurvengetriebe (design of planar cam mechanisms; pressure angle, base circle).
- VDI 2741: Kurvengetriebe für Punkt- und Ebenenführung (cam mechanisms, design and calculation).
- R. L. Norton: *Cam Design and Manufacturing Handbook*, 2nd ed., Industrial Press, 2009 (motion laws, curvature,
  dynamics, manufacturing and the effect of manufacturing errors on acceleration).
- H. A. Rothbart (ed.): *Cam Design Handbook*, McGraw-Hill, 2004.
- J. Volmer (ed.): *Getriebetechnik – Kurvengetriebe*, Verlag Technik, Berlin.
- F. Y. Chen: *Mechanics and Design of Cam Mechanisms*, Pergamon, 1982.
- M. P. Koster: *Vibrations of Cam Mechanisms*, Macmillan, 1974 (follower dynamics, jump, residual vibration).
- Schaeffler (INA): catalogue "Track rollers" (cam followers, crowned outer rings, load ratings, limiting speeds).
- ISO 14104: Gears – Surface temper etch inspection after grinding (nital etch – also used for ground cams).
- K. L. Johnson: *Contact Mechanics*, Cambridge University Press, 1985 (line contact, shear-stress depth).
- Machine maker literature: cam / non-round grinders (X–C interpolation, constant surface speed, feed-forward control).

### 8.5 Glossary

| Term | Meaning |
|---|---|
| Base circle (R0) | Smallest circle of the cam profile around the cam centre; the follower rests on it in the low dwell |
| Pitch curve | Path of the roller centre relative to the cam; the profile is parallel to it at distance r_roller |
| Lift (s) | Follower displacement from its lowest position as a function of cam angle θ |
| Motion law | Normalised function y(x) for a rise or return (cycloidal, modified sine, …) |
| C_v, C_a, C_j | Characteristic values: maximum normalised velocity, acceleration, jerk of a motion law |
| Dwell | Cam angle range with constant lift |
| Pressure angle (φ) | Angle between the follower's direction of motion and the contact normal |
| Undercut | Profile cannot be made because the pitch curve is sharper than the roller (ρ_pitch < r_roller) |
| Concave radius | Hollow part of the profile; must be ≥ cutter and grinding-wheel radius |
| Lift-off / jump | Loss of contact between roller and cam when the contact force becomes zero |
| Preload | Spring force at the follower's lowest position |
| Chord error | Gap between a straight NC element and the true curve (sagitta) |
| Cutter-radius compensation | CNC function G41/G42 that offsets the programmed contour by the tool radius |
| X–C interpolation | Grinding (or turning) of a non-round part by moving the X slide as a function of the rotary C axis |
| Constant surface speed | Varying the C speed so that the work speed at the contact stays constant |
| Specific removal rate Q′_w | Removed volume per second and per mm of wheel width |
| Grinding burn | Thermal damage of the hardened surface (tempering or re-hardening) by grinding |
| Nital etch | Etching with nitric acid in alcohol that shows grinding burn as dark/light zones |
| Harmonic (order k) | Component of the lift error with k waves per revolution |
| DFT | Discrete Fourier transform; splits a measured error into its harmonics |
| Timing / phasing | Angular position of the cam on the camshaft relative to the machine's reference |
| Shrink disc | Friction clamping element that connects hub and shaft without play |
| Track roller (cam follower) | Rolling bearing with a thick outer ring that rolls on the cam |
| Crowned roller | Roller with a slightly convex outer ring that tolerates misalignment |
| Skidding | Roller slides instead of rolling (too little traction) |
| Induction hardening | Surface hardening by eddy-current heating and quenching |
| Overlap (soft) zone | Start/end region of scanning induction hardening, often tempered |
