# M2b – Four-bar linkage: classification, position, velocity, acceleration, synthesis, dynamics, joints, tolerances

> Field 1 *Mechanical design*, item 2b (companion of M2 crank mechanism – the slider-crank is the four-bar with an
> infinitely long rocker). **Theory and program are combined:** every formula is followed by the code of
> `tools/fourbar.py` that computes it, the command and the real output. MATLAB mirror: `tools/fourbar.m`.
> Python standard library only – offline. **All inputs are example values**
> (`python fourbar.py params > my.json`, edit, `python fourbar.py run --in my.json --out result`).

## Contents
0. How to use this guide with the program
1. Purpose – where four-bar linkages are used in the factory
2. Linkage types, mobility and classification
3. Position analysis
4. Velocity, acceleration, transmission angle, mechanical advantage
5. Coupler curves
6. Synthesis (design of the link lengths)
6b. Path generation – find the linkage for a required track
7. Dynamics – forces, input torque, shaking, balancing
8. Link and joint design
9. Tolerances and accuracy for manufacturing
10. Verification with SOLIDWORKS Motion / Adams and MATLAB
11. Complete worked application design, checklists, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python fourbar.py params` | Default input as JSON (copy → edit → `--in`) |
| `python fourbar.py run --in my.json --out res` | Full analysis → `report.md`, `fourbar.csv` (every degree), `coupler_curve.svg`, `angles.svg`, `torque.svg`, `pin_forces.svg` |
| `python fourbar.py examples` | Worked examples of the guide |
| `python fourbar.py ch24` / `ch56` / `ch711` | Extra results of chapters 2–4 / 5–6 / 7–11 |
| `python fourbar.py pathparams > track.json` → `python fourbar.py path --in track.json --out res` | **Required track → linkage** (ch. 6b): `path_report.md`, `path.svg`, `linkage_for_run.json` |
| `python fourbar.py ch6b` | Results of chapter 6b |
| `python fourbar.py selftest` | Independent cross-checks → SELFTEST PASS (≈ 15 s, includes path synthesis) |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Grashof condition, Barker class | `grashof()` |
| 3 | Position by circle intersection; Freudenstein closed form (check) | `position()`, `freudenstein()` |
| 3 | Limit positions, swing, time ratio Q | `limit_positions()` |
| 4 | Angular velocities, accelerations (loop differentiation) | `velocity()`, `acceleration()` |
| 4–5 | Coupler point position, velocity, acceleration | `coupler_point()` |
| 4 | Transmission angle (cosine law) | `transmission_angle()` |
| 6 | Freudenstein function generation, Chebyshev spacing, structural error, defects | `freudenstein_synthesis()`, `chebyshev_points()`, `function_generator_example()` |
| 6 | Crank-rocker with time ratio 1 | `crank_rocker_Q1()` |
| 7 | Newton–Euler 9 × 9 inverse dynamics + energy check, shaking force / moment | `dynamics_at()`, `solve_linear()` |
| 7 | Sweep over one turn, summary | `sweep()`, `summary()` |
| 9 | Sensitivity, Monte Carlo tolerances, joint play | `sensitivity()`, `tolerance_mc()`, `clearance_play()` |
| – | Report, CSV, charts | `run()`, `report_text()` |
| 2–4 | Mobility (Gruebler–Kutzbach), toggle force gain, slider-crank limit, assembly range, instant centre I24, mechanical advantage, transmission-angle extremes | `mobility()`, `toggle_gain()`, `slider_limit()`, `assembly_range()`, `instant_centre_I24()`, `mechanical_advantage()`, `mu_extremes()` |
| 5 | General position, coupler curves, curve shape, straightness, Roberts–Chebyshev cognates, dwell six-bar | `position_general()`, `coupler_curve()`, `curve_shape()`, `straightness()`, `cognates()`, `cognate_check()`, `circle_fit()`, `dwell_sixbar()` |
| 6 | Dyad standard form, 3-position motion generation, quick-return synthesis, function-generator evaluation and optimisation | `dyad_standard_form()`, `motion_generation_3pos()`, `quick_return()`, `quick_return_best()`, `fg_eval()`, `fg_optimise()`, `slope_ratio()` |
| 7 | Crank flywheel, torque statistics, gearmotor sizing, motor inertia, Berkof–Lowen force balance, gravity | `flywheel_crank()`, `torque_stats()`, `gearmotor_size()`, `motor_inertia_effect()`, `berkof_lowen()`, `compare_balance()`, `gravity_effect()` |
| 8 | Coupler loads + design (buckling, fatigue), joint materials and checks (p, pv, pin shear) | `coupler_loads()`, `coupler_design()`, `JOINT_MATERIALS`, `joint_check()` |
| 6b | Path generation: exact 3 points with timing, search of free choices, N-point optimisation (GA + Nelder–Mead) with constraints, report / SVG / JSON for `run` | `path_generation_3pt()`, `path_3pt_search()`, `path_synthesis()`, `path_error()`, `path_curve()`, `path_report()`, `PATH_EXAMPLE` |
| 9, 11 | Tolerances over the cycle, arc error at the tool, worked application | `tolerance_cycle()`, `arc_error_mm()`, `APP`, `application()` |
Example input of chapter 11: `tools/examples/swing_arm.json`.

### 0.3 What the self-test proves
1. Loop closure error ≈ 10⁻¹⁴ mm; circle intersection = Freudenstein closed form (two independent position methods).
2. ω3, ω4, α3, α4 closed form = finite differences of the position.
3. Transmission angle by cosine law = angle between coupler and rocker.
4. Input torque by **Newton–Euler** = torque by the **energy (power) method** (difference ≈ 10⁻¹⁵ N·m), also with gravity
   and a coupler force.
5. Mean input power = mean load power; a constant rocker torque alone needs zero mean power.
6. Rocker swing from the sweep = limit-position formula.
7. Synthesis: function generator exact at the three precision points and defect-free; Q = 1 synthesis gives Q = 1.0000.
8. Monte Carlo 3σ of the output error = linear RSS (± 5 %).
9. Path generation: exact 3-point solution passes its points (10⁻¹³ mm); timed straight track < 2 %; a track taken
   from a known linkage is re-synthesised within 3 % of its size.

## 1. Purpose – where four-bar linkages are used in the factory

A four-bar linkage is the simplest closed chain that turns one motion into another with **only pin joints** – cheap,
robust, no sliding guides, easy to make on the machines you already have (guide 49).

| Application in the compressor factory | Linkage type | Key design issue |
|---|---|---|
| Toggle clamps on fixtures (HMC, assembly) | Toggle (near change point) | Force gain near the dead position, self-locking |
| Swing / transfer arm on a conveyor | Crank-rocker | Swing angle, time ratio, transmission angle, pin forces |
| Robot / pick-and-place grippers | Parallelogram / four-bar fingers | Parallel jaw motion, grip force |
| Pallet changer and door mechanisms | Double-rocker / parallelogram | Positions, dead points, safety |
| Packaging, labelling, stacking | Coupler-curve mechanisms (dwell, straight line) | Coupler curve shape |
| Valve / damper actuation, test benches | Function generator | Output angle vs input angle law |
| Engines and compressors | Slider-crank (limit case, M2) | Forces, balancing |

**Default example in this guide** (`python fourbar.py examples`): crank 30, coupler 100, rocker 80, ground 100 mm,
120 rpm, constant rocker torque −5 N·m + viscous load 0.8 N·m·s/rad.

| Result | Value |
|---|---|
| Class | Grashof crank-rocker (s + l = 130 ≤ p + q = 180) |
| Rocker swing / time ratio | 47.74° / Q = 1.1773 |
| Transmission angle | 44.0 … 91.8° (deviation from 90° max 46.0°) |
| Input torque mean / max / min | 0.910 / 3.359 / −0.657 N·m; mean power 11.4 W; ΔE 3.975 J |
| Pin forces max | ≈ 113–114 N at all four joints |
| Output error from link tolerances (θ2 = 90°) | Monte Carlo 3σ 0.0415°, worst case 0.0715°; joint clearance ≈ 0.115° (dominant) |


---

## 2 Linkage types, mobility and classification

### 2.1 Links, joints and the words we use

A **linkage** is a chain of rigid **links** connected by **joints**. One link is fixed: the **ground** (frame).
A four-bar has four links (ground, crank, coupler, rocker) and four pin joints.

| Word | Meaning | Example in the factory |
|---|---|---|
| Link | Rigid body with two or more joints | Lever of a fixture clamp |
| Binary / ternary link | Link with 2 / 3 joints | Coupler with a coupler point = ternary plate |
| Full joint (j1) | Removes 2 of the 3 planar freedoms: pin (revolute, R) or slider (prismatic, P) | Pin with bushing; guide rail |
| Half joint (j2) | Removes 1 freedom: cam contact with rolling + sliding, pin in a slot | Cam and flat follower |
| Crank | Link to ground that turns 360° | Motor-driven input crank |
| Rocker | Link to ground that only swings | Output arm of a transfer unit |
| Coupler | Link not connected to ground | Connecting link, carries the coupler point |
| Coupler point P | Any point on the coupler; it draws a **coupler curve** | Gripper finger tip on a coupler |

Notation in this guide (same as `fourbar.py`): a = crank (link 2), b = coupler (link 3), c = rocker (link 4),
d = ground (link 1). Pivot O2 at the origin, pivot O4 at (d, 0). Angles from +x, counter-clockwise positive.

### 2.2 Mobility – how many inputs does the mechanism need?

**Theory.** A free body in the plane has 3 freedoms (x, y, rotation). n links have 3n freedoms. The ground is fixed:
−3. Each full joint removes 2, each half joint removes 1. This gives the **Gruebler–Kutzbach** equation.

**Derivation.**
1. Freedoms of n free links: 3n.
2. Fix the ground: 3n − 3 = 3(n − 1).
3. Each full joint (pin or slider) leaves only 1 relative freedom → removes 2: −2·j1.
4. Each half joint leaves 2 relative freedoms → removes 1: −j2.

**Formula box**

| Symbol | Meaning | Unit |
|---|---|---|
| M | Mobility (number of independent inputs) | – |
| n | Number of links including the ground | – |
| j1 | Full joints (R or P) | – |
| j2 | Half joints | – |

  **M = 3·(n − 1) − 2·j1 − j2**

M = 1: one motor drives it (four-bar, slider-crank). M = 0: a structure (truss). M = 2: two inputs needed (five-bar),
or one freedom is "idle" (a roller spinning on its own pin).

**In the program** (`fourbar.py`, chapter 2 additions):
```python
def mobility(n, j1, j2=0):
    """Gruebler-Kutzbach mobility of a planar mechanism: M = 3 (n - 1) - 2 j1 - j2.
    n = number of links incl. the ground, j1 = full joints (pin, slider), j2 = half joints (cam, rolling+sliding)."""
    return 3 * (n - 1) - 2 * j1 - j2
```

**Run it:** `python fourbar.py ch24`
```
## Chapter 2 - mobility (Gruebler-Kutzbach M = 3(n-1) - 2 j1 - j2)
  four-bar                                                n 4 j1 4 j2 0 -> M = 1
  slider-crank                                            n 4 j1 4 j2 0 -> M = 1
  Watt / Stephenson six-bar                               n 6 j1 7 j2 0 -> M = 1
  five-bar (two inputs)                                   n 5 j1 5 j2 0 -> M = 2
  triangle (structure)                                    n 3 j1 3 j2 0 -> M = 0
  cam + roller follower (roller pinned)                   n 4 j1 3 j2 1 -> M = 2
  pneumatic toggle clamp (cylinder + lever + link + arm)  n 6 j1 7 j2 0 -> M = 1
```

**Interpretation.**
- Four-bar and slider-crank: M = 1. One motor or one cylinder is enough.
- Six-bars (Watt: the two ternary links are joined; Stephenson: they are not) also have M = 1. They give longer
  dwells or bigger swing angles than a four-bar.
- Cam with a pinned roller: M = 2. The second freedom is only the roller spinning. It does not change the output.
  This is a **passive (idle) freedom** – count it, then remove it in your head.
- Pneumatic toggle clamp: frame, cylinder body, piston rod, lever, link, clamp arm = 6 links; 6 pins + 1 slider
  (piston in cylinder) = 7 full joints → M = 1. The cylinder stroke is the one input.

**Limits of the formula.** Gruebler counts joints. It does not see geometry. A parallelogram with an extra parallel
link gives M = 0 by the formula but moves (M = 1). Such special geometry is called **over-constrained**. In CAD and
MBD this is the "redundant constraint" warning (SOLIDWORKS Motion / Adams). Remove it with a better joint choice
(e.g. one pin replaced by a pin-in-slot) – see M1 chapter 7.

**Practice.** Every redundant constraint in a real machine needs tight tolerances to assemble without stress.
A design with M = 1 and no redundancies assembles freely and does not jam when the frame bends or warms up.

**MATLAB equivalent**
```matlab
mobility = @(n, j1, j2) 3*(n-1) - 2*j1 - j2;
mobility(6, 7, 0)     % toggle clamp -> 1
```

**Check questions**
1. A robot parallel gripper has 8 links and 10 pins. What is M? (Answer: 3·7 − 20 = 1.)
2. Why does the cam with a pinned roller give M = 2, but you still need only one motor?

### 2.3 The Grashof law – which link can turn all the way round?

**Theory.** Sort the four link lengths: s = shortest, l = longest, p and q the other two.

  **Grashof condition: s + l ≤ p + q** → at least one link can turn fully relative to the others.

**Proof idea.** The shortest link s can make a full turn only if it can pass the two "straight" positions where it
lines up with its neighbour. In each straight position the other three links must form a triangle (or a flat line).
The triangle inequality for the worst of these positions gives exactly s + l ≤ p + q. If s + l > p + q there is
no full rotation: every link only rocks (non-Grashof, "triple rocker"). If s + l = p + q the linkage can become flat
(all four links on one line). In the flat position it can switch branch: this is the **change-point** case.

**Barker classification (by which link is the shortest)**

| Class | Condition | Shortest link | Name | Motion |
|---|---|---|---|---|
| I (Grashof) | s + l < p + q | ground d | Double-crank (drag link) | Both ground links turn fully |
| II | s + l < p + q | crank a (input) | Crank-rocker | Input turns, output rocks |
| III | s + l < p + q | coupler b | Double-rocker | Coupler turns, both ground links rock |
| IV | s + l < p + q | rocker c (output) | Rocker-crank | Output turns, input rocks |
| V–VIII (non-Grashof) | s + l > p + q | any | Triple-rocker | No link turns fully |
| IX–XIV (special) | s + l = p + q | any | Change-point | Can fold flat; parallelogram, antiparallelogram, deltoid (kite) |

**Inversions (Reuleaux).** The same chain of four links gives different mechanisms when you fix a different link.
With a Grashof chain: fix the link next to the shortest → crank-rocker; fix the shortest → double-crank;
fix the link opposite the shortest → double-rocker. The relative motions between links do not change – only what
you call "ground". The same idea gives the four inversions of the slider-crank (M2: engine/compressor, Whitworth
quick-return, oscillating cylinder, hand pump).

**In the program**
```python
def grashof(a, b, c, d):
    """Grashof condition and Barker class. Returns dict."""
    L = {"a (crank)": a, "b (coupler)": b, "c (rocker)": c, "d (ground)": d}
    srt = sorted(L.items(), key=lambda kv: kv[1])
    s, l = srt[0][1], srt[-1][1]
    pq = srt[1][1] + srt[2][1]
    val = s + l - pq
    short = srt[0][0]
    if abs(val) < 1e-9:
        kind = "change-point (special Grashof): s + l = p + q, can fold - needs a guide past the flat position"
    elif val < 0:
        kind = {"a (crank)": "Grashof crank-rocker (input crank turns fully, output rocks)",
                "d (ground)": "Grashof double-crank (drag link): both cranks turn fully",
                "b (coupler)": "Grashof double-rocker (coupler turns fully)",
                "c (rocker)": "Grashof rocker-crank (output turns fully, input rocks)"}[short]
    else:
        kind = "non-Grashof triple-rocker: no link turns fully"
    return {"s": s, "l": l, "p_plus_q": pq, "s+l-(p+q)": val, "shortest": short, "class": kind}
```

**Run it:** `python fourbar.py ch24`
```
## Grashof / Barker classes
  a b c d = (30, 100, 80, 100)   s+l 130.0 p+q 180.0 -> Grashof crank-rocker (input crank turns fully, output rocks)
  a b c d = (100, 80, 60, 30)    s+l 130.0 p+q 140.0 -> Grashof double-crank (drag link): both cranks turn fully
  a b c d = (60, 30, 100, 80)    s+l 130.0 p+q 140.0 -> Grashof double-rocker (coupler turns fully)
  a b c d = (60, 90, 30, 80)     s+l 120.0 p+q 140.0 -> Grashof rocker-crank (output turns fully, input rocks)
  a b c d = (50, 80, 70, 40)     s+l 120.0 p+q 120.0 -> change-point (special Grashof): s + l = p + q, can fold - needs a guide past the flat position
  a b c d = (70, 100, 60, 80)    s+l 160.0 p+q 150.0 -> non-Grashof triple-rocker: no link turns fully
  a b c d = (40, 80, 40, 80)     s+l 120.0 p+q 120.0 -> change-point (special Grashof): s + l = p + q, can fold - needs a guide past the flat position
```

**Interpretation.** The DEFAULT example (30, 100, 80, 100) is a crank-rocker with a large margin: s + l = 130 is
50 mm below p + q = 180. The last row (40, 80, 40, 80) is a **parallelogram**: the coupler always stays parallel to
the ground (good for lifting tables, parallel grippers). In its flat positions it can jump into the
**antiparallelogram** (crossed) branch. Real parallelogram drives need a third crank at 90° or a gear/guide to
pass the flat position safely.

**Practice.**
- Keep a margin from s + l = p + q. With tolerances of a few hundredths of a mm this does not matter, but bending of
  long thin links or bearing play can bring a near-change-point linkage into the wrong branch.
- Rule of thumb (experience, not a standard): (p + q) − (s + l) ≥ 5–10 % of l for motor-driven crank-rockers.

**MATLAB equivalent**
```matlab
L = sort([30 100 80 100]);  s = L(1); l = L(4); pq = L(2)+L(3);
isGrashof = (s + l) < pq      % true -> one link can rotate fully
```

**Check questions**
1. a = 25, b = 60, c = 50, d = 70: which class? (s + l = 95 < 110, shortest = crank → crank-rocker.)
2. Why does fixing the coupler of a crank-rocker chain give a double-rocker?

### 2.4 Special cases: slider-crank as a limit, toggle linkages

**Slider-crank = four-bar with an infinitely long rocker.** If the rocker c becomes very long and its pivot O4
moves very far away, point B runs on a circle with a huge radius – practically a straight line. That is the slider
of M2. So all four-bar theory (Grashof, transmission angle, limit positions) has a slider-crank version.

**In the program**
```python
def slider_limit(a, b, R, t2_deg):
    """Four-bar whose rocker (length R, pivot far away at (b, R)) replaces the slider of a slider-crank.
    The circle of B touches the slider axis (x axis) at x = b. Returns (B_x four-bar, s exact slider-crank, error mm)."""
    t2 = math.radians(t2_deg)
    A = complex(a * math.cos(t2), a * math.sin(t2))
    O4 = complex(b, R)
    v = O4 - A
    e = abs(v)
    x = (b * b - R * R + e * e) / (2 * e)
    h = math.sqrt(max(0.0, b * b - x * x))
    u = v / e
    cands = [A + x * u + s * h * complex(-u.imag, u.real) for s in (1, -1)]
    B = min(cands, key=lambda z: abs(z.imag))          # the branch near the slider axis
    s_exact = a * math.cos(t2) + math.sqrt(b * b - (a * math.sin(t2)) ** 2)
    return B.real, s_exact, B.real - s_exact
```

**Run it** (crank r = 23 mm, rod l = 90 mm – the compressor of M2):
```
## Slider-crank as the limit of a four-bar (a 23, b 90 mm, M2 crank) - error of B_x vs exact slider
  rocker R    200 mm -> max |error| 0.15533 mm
  rocker R   1000 mm -> max |error| 0.02984 mm
  rocker R   5000 mm -> max |error| 0.00592 mm
  rocker R  50000 mm -> max |error| 0.00059 mm
```
The error falls like 1/R (×10 R → ÷10 error). The four-bar formulas become the slider-crank formulas of
`crank.py kin()` in the limit. Practical use: a **long swinging link instead of a linear guide** (cheaper, no rail,
no contamination). With R = 1000 mm the path deviates only 0.03 mm over a 46 mm stroke.

**Toggle linkages (clamps, presses, stone crushers).** Two links meet at a "knee". When they are almost straight,
a small knee force makes a very large output force.

**Derivation** (symmetric toggle, two equal links at angle α to the line of action, friction ignored):
1. Knee force F_in acts perpendicular to the line of action.
2. Knee equilibrium: the two link forces S have components perpendicular to the line: 2·S·sin α = F_in →
   S = F_in / (2·sin α).
3. Output force = component of S along the line: F_out = S·cos α = F_in / (2·tan α).

**Formula box**

  **F_out / F_in = 1 / (2·tan α)**   α = angle of each link to the line of action (rad or deg in tan)

As α → 0 the gain → ∞. In reality the gain is limited by link and frame elasticity (the toggle "locks" against its
stiffness) and by friction in the pins.

**In the program**
```python
def toggle_gain(alpha_deg):
    """Symmetric toggle (two equal links meeting at the knee, angle alpha to the line of action).
    Knee force F_in perpendicular to the line of action -> each link force S = F_in / (2 sin alpha),
    output force along the line F_out = S cos alpha = F_in / (2 tan alpha). Returns F_out / F_in."""
    return 1.0 / (2.0 * math.tan(math.radians(alpha_deg)))
```

**Run it**
```
## Toggle force gain F_out/F_in = 1/(2 tan alpha)
  alpha 20.0 deg -> gain   1.374
  alpha 10.0 deg -> gain   2.836
  alpha  5.0 deg -> gain   5.715
  alpha  2.0 deg -> gain  14.318
  alpha  1.0 deg -> gain  28.645
```

**Worked example (example values).** A pneumatic cylinder Ø32 mm at 0.6 MPa gives F_in = 0.6·π·32²/4 ≈ 483 N.
At α = 5° the clamp force is 483 × 5.715 ≈ 2760 N; at α = 2° about 6900 N. Over-centre clamps (toggle goes
slightly past α = 0 against a stop) are **self-locking**: the part stays clamped when air pressure is lost – a safety
feature for machining fixtures (check with your safety engineer; ISO 12100 risk assessment).

**Examples of linkages in the compressor factory**

| Application | Linkage | Why |
|---|---|---|
| Fixture clamps on HMC pallets (crankcase machining) | Toggle (over-centre) four-bar | High clamp force, self-locking |
| Robot / end-of-arm grippers | Parallelogram + toggle, or slider-crank | Parallel fingers, force gain |
| Pallet changer lifting / swinging | Crank-rocker or slider-crank with cylinder | Smooth start/stop at limit positions (ω = 0) |
| Conveyor transfer bars, walking beams | Crank-rocker with coupler curve, six-bar | Lift-move-lower motion from one motor |
| Packaging (box flaps, cartoning) | Crank-rockers, double-rockers | Cheap, fast, repeatable |
| Valve actuation, damper flaps | Four-bar between cylinder and flap | Converts linear stroke to swing, force gain near ends |
| Hand presses, riveting | Toggle | Force gain at the end of the stroke |

**Check questions**
1. Why does a toggle press need a stiff frame? (The force gain becomes very large as α → 0; any elasticity limits it.)
2. A linear guide of 46 mm stroke may deviate 0.05 mm. Which rocker length R replaces it? (From the table: R ≈ 1000 mm
   gives 0.03 mm.)

---

## 3 Position analysis

### 3.1 The vector loop

**Theory.** Write every link as a vector (a complex number). Walk around the loop O2 → A → B → O4 → O2. The sum is zero.

```
                 B
        b      / \
   A ---------/   \  c
   |  coupler      \
 a |                \
   |  theta2         \  theta4
  O2 ----------------- O4
           d (ground)
```

**Loop-closure equation** (complex form, i = √−1):

  **a·e^(iθ2) + b·e^(iθ3) − c·e^(iθ4) − d = 0**

Real and imaginary parts give two scalar equations:

  a·cos θ2 + b·cos θ3 − c·cos θ4 − d = 0
  a·sin θ2 + b·sin θ3 − c·sin θ4 = 0

Given θ2 (input), the unknowns are θ3 and θ4. Two nonlinear equations, two unknowns → solve.

### 3.2 Solution 1: circle intersection (used by `position()`)

**Derivation.**
1. Joint A is known: A = a·e^(iθ2).
2. B is a distance b from A and a distance c from O4 = (d, 0). So B is an intersection of two circles.
3. Let e = |O4 − A| (the "diagonal" of the quadrilateral) and u = (O4 − A)/e (unit vector).
4. Put the foot of the common chord on the line A–O4 at distance x from A. From the two right triangles:
   b² − x² = c² − (e − x)² → **x = (b² − c² + e²) / (2e)**.
5. Half-chord height: **h = √(b² − x²)**.
6. Two solutions: **B = A + x·u ± h·u⊥**, u⊥ = u rotated by +90°. The sign is the **branch** (open / crossed).
7. θ3 = arg(B − A), θ4 = arg(B − O4).

**Assembly condition.** Real intersection only if |b − c| ≤ e ≤ b + c. If the diagonal is too long or too short, the
linkage **cannot be assembled** at this input angle (the program returns None).

**Formula box**

| Symbol | Meaning | Unit |
|---|---|---|
| e | Diagonal length \|O4 − A\| | mm |
| x | Distance from A to the chord foot along A→O4 | mm |
| h | Half chord | mm |
| branch | +1 open, −1 crossed | – |

  x = (b² − c² + e²)/(2e),  h = √(b² − x²),  B = A + x·u + branch·h·u⊥,  assembly: |b − c| ≤ e ≤ b + c

**In the program**
```python
def position(t2, a, b, c, d, branch=1):
    """Position by circle intersection (geometric). Returns theta3, theta4 (rad) and joint points, or None if the
    linkage cannot be assembled at this input angle."""
    A = complex(a * math.cos(t2), a * math.sin(t2))
    O4 = complex(d, 0)
    v = O4 - A
    e = abs(v)
    if e > b + c or e < abs(b - c) or e == 0:
        return None
    # distance from A to the foot of the chord along v
    x = (b * b - c * c + e * e) / (2 * e)
    h = math.sqrt(max(0.0, b * b - x * x))
    u = v / e
    B = A + x * u + branch * h * complex(-u.imag, u.real)
    t3 = cmath.phase(B - A)
    t4 = cmath.phase(B - O4)
    return {"t3": t3, "t4": t4, "A": A, "B": B, "O4": O4}
```

**Why this method?** It is short, has no division by a coefficient that can become zero, and it shows the geometry
directly. It is also the method you would use with compass and ruler.

### 3.3 Solution 2: the Freudenstein equation and Norton's closed form (`freudenstein()`)

**Derivation of Freudenstein's equation.**
1. Move the θ3 terms alone: b·cos θ3 = c·cos θ4 + d − a·cos θ2, b·sin θ3 = c·sin θ4 − a·sin θ2.
2. Square and add (sin² + cos² = 1 removes θ3):
   b² = (c cos θ4 + d − a cos θ2)² + (c sin θ4 − a sin θ2)².
3. Expand and divide by 2ac:
   **K1·cos θ4 − K2·cos θ2 + K3 = cos(θ2 − θ4)**, with K1 = d/a, K2 = d/c, K3 = (a² − b² + c² + d²)/(2ac).
   (In Norton's book the same terms are written K1 cos θ4 − K2 cos θ2 + K3 = cos(θ2 − θ4) with K1 = d/a, K2 = d/c.)
4. Tangent half-angle substitution t = tan(θ4/2), cos θ4 = (1 − t²)/(1 + t²), sin θ4 = 2t/(1 + t²) turns it into a
   quadratic A·t² + B·t + C = 0 with
   A = cos θ2 − K1 − K2 cos θ2 + K3, B = −2 sin θ2, C = K1 − (K2 + 1) cos θ2 + K3.
5. **θ4 = 2·atan2(−B ± √(B² − 4AC), 2A)**. The two signs are the two branches. B² − 4AC < 0 → cannot assemble.
6. Same steps eliminating θ4 give θ3 with K4 = d/b, K5 = (c² − d² − a² − b²)/(2ab):
   D = cos θ2 − K1 + K4 cos θ2 + K5, E = −2 sin θ2, F = K1 + (K4 − 1) cos θ2 + K5,
   **θ3 = 2·atan2(−E ± √(E² − 4DF), 2D)**.

The Freudenstein equation is **linear in K1, K2, K3**. This is why it is the basis of function-generation
synthesis (chapter 6): give three (θ2, θ4) pairs → solve three linear equations for K1, K2, K3 → link lengths.

**In the program**
```python
def freudenstein(t2, a, b, c, d, sign=-1):
    """Closed-form Freudenstein / Norton solution (independent check of position()).
    sign selects the root (-1 = open for the usual set-up)."""
    K1, K2, K3 = d / a, d / c, (a * a - b * b + c * c + d * d) / (2 * a * c)
    A = math.cos(t2) - K1 - K2 * math.cos(t2) + K3
    B = -2 * math.sin(t2)
    C = K1 - (K2 + 1) * math.cos(t2) + K3
    disc = B * B - 4 * A * C
    if disc < 0:
        return None
    t4 = 2 * math.atan2(-B + sign * math.sqrt(disc), 2 * A)
    K4, K5 = d / b, (c * c - d * d - a * a - b * b) / (2 * a * b)
    D = math.cos(t2) - K1 + K4 * math.cos(t2) + K5
    E = -2 * math.sin(t2)
    F = K1 + (K4 - 1) * math.cos(t2) + K5
    t3 = 2 * math.atan2(-E + sign * math.sqrt(E * E - 4 * D * F), 2 * D)
    return t3, t4
```

**Run it** (DEFAULT a 30, b 100, c 80, d 100 mm at θ2 = 90°): `python fourbar.py ch24`
```
  theta2 90: branch +1 -> theta3 29.319, theta4 99.214 deg, B = (87.190, 78.968) mm
  theta2 90: branch -1 -> theta3 -62.718, theta4 -132.612 deg, B = (45.837, -58.876) mm
  K1 3.33333 K2 1.25000 K3 1.52083 K4 1.00000 K5 -2.41667
  Freudenstein root sign -1: theta3 -330.681, theta4 -260.786 deg
  Freudenstein root sign +1: theta3 297.282, theta4 227.388 deg
```

**Interpretation.** Add 360° to the Freudenstein results: −260.786 + 360 = 99.214°, −330.681 + 360 = 29.319° →
root sign −1 = open branch (+1 in `position()`). Root +1: 227.388 − 360 = −132.612° → crossed branch.
Both methods agree; the self-test checks this at 52 input angles (difference ≈ 10⁻¹⁵ rad,
`python fourbar.py selftest`). Two independent derivations giving the same number is how a program earns trust
(M1 chapter 7, credibility level L2).

### 3.4 Branches, assembly ranges, dead (toggle) positions

**Branches.** For one input angle there are two ways to assemble the same links: **open** (B above the diagonal, the
usual drawing) and **crossed** (coupler and rocker cross each other). A Grashof linkage cannot go from one branch to
the other without taking it apart. A change-point linkage can switch branch in its flat position – dangerous if not
guided. The branch is fixed at assembly: mark it on the drawing (sketch of the assembled position).

**Assembly range.** Non-Grashof and some Grashof inversions can only be assembled for part of the input turn.

**In the program**
```python
def assembly_range(a, b, c, d, step_deg=0.5):
    """Input angles (deg) where the linkage can be assembled (|O4 A| inside [|b - c|, b + c])."""
    ok = []
    k = 0.0
    while k < 360.0:
        if position(math.radians(k), a, b, c, d, 1) is not None:
            ok.append(k)
        k += step_deg
    if not ok:
        return []
    # group into continuous ranges
    rng, start, prev = [], ok[0], ok[0]
    for v in ok[1:]:
        if v - prev > step_deg + 1e-9:
            rng.append((start, prev))
            start = v
        prev = v
    ...
```

**Run it**
```
## Chapter 3 - assembly ranges
  a b c d = (30, 100, 80, 100) assemblable theta2 ranges [deg]: [(0.0, 359.5)]
  a b c d = (70, 100, 60, 80)  assemblable theta2 ranges [deg]: [(30.0, 330.0)]
  a b c d = (60, 30, 100, 80)  assemblable theta2 ranges [deg]: [(58.0, 135.5), (224.5, 302.0)]
```

**Interpretation.**
- Crank-rocker (30, 100, 80, 100): full turn – the input can be a motor.
- Non-Grashof (70, 100, 60, 80): link a only swings between about 30° and 330°. At the ends of this range the
  coupler and rocker are in line: a **dead (toggle) position for the input**. Driven from link a, the mechanism
  stops there; driven from the rocker it passes the toggle only with momentum.
- Double-rocker (60, 30, 100, 80): two separate ranges – one for each branch area. Link a only rocks inside one of
  them; which one depends on how it was assembled.

**Dead positions** occur when the driving link's force passes through the other pivot: the transmission angle is 0°
or 180°. For a crank-rocker driven by the crank there are no dead positions. Driven from the rocker (e.g. a treadle,
a hand lever) the two positions where crank and coupler are collinear are dead positions – a flywheel or a second
phase-shifted mechanism carries it through.

### 3.5 Limit positions of the rocker and the time ratio Q

**Theory.** In a crank-rocker the rocker stops (ω4 = 0) and reverses when crank and coupler are **collinear**:
- **Extended**: crank and coupler on one line, O2B = b + a.
- **Folded**: crank folded back over the coupler, O2B = b − a.

In both positions B lies on a circle of radius b ± a about O2 **and** on the rocker circle of radius c about O4.
So each limit position is a triangle O2–O4–B with known sides.

**Derivation.**
1. Triangle O2 O4 B with sides d, c, L (L = b + a or b − a). Angle at O4 between O4O2 and O4B (cosine law):
   cos γ = (c² + d² − L²)/(2cd).
2. Swing angle of the rocker: **ψ = |γ(b + a) − γ(b − a)|**.
3. Angle at O2 between O2O4 and O2B: cos β = (L² + d² − c²)/(2Ld).
   Extended: θ2 = β(b + a) (crank points to B). Folded: θ2 = 180° + β(b − a) (crank points away from B).
4. Between the two limit positions the crank turns 180° + α one way and 180° − α the other way, with
   **α = |180° − |θ2,folded − θ2,extended||**.
5. At constant crank speed the time ratio of the two rocker strokes is

  **Q = (180° + α) / (180° − α)**   (Q > 1 = quick-return mechanism)

**In the program**
```python
def limit_positions(a, b, c, d):
    """Crank-rocker: rocker extremes when crank and coupler are collinear (extended b+a, folded b-a).
    Returns swing angle psi, crank angle between the limits, time ratio Q."""
    def t4_for(L):         # triangle O2-O4-B with O2B = L
        cosg = (c * c + d * d - L * L) / (2 * c * d)
        return math.acos(max(-1, min(1, cosg)))      # angle at O4 between O4O2 and O4B
    def t2_for(L):
        cosb = (L * L + d * d - c * c) / (2 * L * d)
        return math.acos(max(-1, min(1, cosb)))      # angle at O2 between O2O4 and O2B
    g1, g2 = t4_for(b - a), t4_for(b + a)
    psi = abs(g2 - g1)
    beta1, beta2 = t2_for(b - a), t2_for(b + a)
    # folded: crank points opposite to B -> crank angle = pi + beta1 ; extended: crank angle = beta2
    alpha = abs(math.pi - abs((math.pi + beta1) - beta2))   # angle the crank turns 'less than 180' between limits
    Q = (math.pi + alpha) / (math.pi - alpha)
    return {"psi_deg": math.degrees(psi), "alpha_deg": math.degrees(alpha), "Q": Q,
            "t2_extended_deg": math.degrees(beta2), "t2_folded_deg": math.degrees(math.pi + beta1)}
```

**Run it** (DEFAULT, 120 rpm): `python fourbar.py ch24`
```
  DEFAULT limit positions: extended theta2 37.958, folded theta2 232.617 deg, alpha 14.659, swing 47.742 deg, Q 1.1773
    at extended theta4 88.209 deg, w4 0.00e+00 rad/s (zero = dead point of the rocker)
    at folded   theta4 135.951 deg, w4 5.81e-16 rad/s (zero = dead point of the rocker)
  forward stroke 194.659 deg of crank, return 165.341 deg; at 120 rpm: 0.2704 s / 0.2296 s
```

**Worked example (example values).**
- Swing ψ = 135.951 − 88.209 = **47.742°**. The sweep over the full turn (`python fourbar.py run`, report line
  "swing 47.74 deg") gives the same value – the self-test compares both (± 0.05°).
- The crank turns 194.659° while the rocker goes from 88.2° to 136.0° and 165.341° back: Q = 194.659/165.341 =
  **1.1773**. At 120 rpm (0.5 s per turn): 0.2704 s out, 0.2296 s back.
- At both limits ω4 = 0 (the program shows 0 and 6·10⁻¹⁶ rad/s = numerical zero). The rocker **stops smoothly** there –
  no impact. This is why crank-rockers are good for pick-and-place: the gripper closes/opens while the arm stands still.

**Practice.**
- Use the slow stroke for the working stroke (part transport) and the fast stroke for the return.
- Q = 1 (no quick return) when O2 lies on the line through the two rocker end positions B1 B2 – synthesis in
  chapter 6 (`crank_rocker_Q1()`).
- Stops at limit positions are **kinematic**: repeatable, no sensor needed for the end position. The repeatability
  depends on pin clearance and link tolerances (chapter 9).

### 3.6 Position table for the DEFAULT linkage

**Run it:** `python fourbar.py examples` (kinematics table, 120 rpm)
```
## Kinematics table (theta2 deg: theta3, theta4 deg, w3, w4 rad/s, alpha3, alpha4 rad/s2, mu deg, T12 N m)
   0    52.617   96.665   -5.386  -5.386    -11.30    73.87   44.05   -0.346
  45    35.986   88.475   -3.270   0.931     50.67    89.92   52.49    0.441
  90    29.319   99.214   -0.643   4.375     33.64    24.42   69.89    2.973
 135    30.472  115.965    1.233   4.576     28.24   -14.64   85.49    3.144
 180    37.958  129.749    2.900   2.900     23.31   -35.93   91.79    1.674
 225    50.325  135.818    3.781   0.439      1.65   -41.23   85.49    0.184
 270    62.718  132.612    2.718  -2.300    -38.93   -48.15   69.89   -0.561
 315    66.125  118.614   -1.341  -5.541    -86.89   -47.64   52.49   -0.222
```
Read it like this: at θ2 = 45° the rocker is near its lower limit (88.2°) and almost stopped (ω4 = 0.93 rad/s);
at θ2 = 225° it is near the upper limit (135.95°), ω4 = 0.44 rad/s. Velocities and accelerations: chapter 4.
Torques T12: chapter 7.

**Coupler point position.** P = A + p·e^(i(θ3 + δ)), here p = 50 mm, δ = 30° (`coupler_point()`, chapter 4.4). At
θ2 = 90°: P = (25.513, 73.001) mm. The full coupler curve is drawn in `coupler_curve.svg` (`python fourbar.py run`).

**MATLAB equivalent (position by circle intersection)**
```matlab
a=30; b=100; c=80; d=100; br=1; t2=deg2rad(90);
A  = a*exp(1i*t2);  O4 = d;  v = O4 - A;  e = abs(v);  u = v/e;
x  = (b^2 - c^2 + e^2)/(2*e);  h = sqrt(b^2 - x^2);
B  = A + x*u + br*h*(1i*u);              % 1i*u = u rotated +90 deg
t3 = rad2deg(angle(B - A)), t4 = rad2deg(angle(B - O4))   % 29.319, 99.214
```

**Check questions**
1. Show that for the DEFAULT linkage the diagonal e at θ2 = 0 is d − a = 70 mm and check |b − c| ≤ 70 ≤ b + c.
2. Why must the drawing show the assembled branch?
3. Compute Q for a crank-rocker with α = 30°. (Q = 210/150 = 1.4.)

---

## 4 Velocity, acceleration, transmission angle, mechanical advantage

### 4.1 Velocity by differentiating the loop equation

**Derivation.**
1. Loop: a·e^(iθ2) + b·e^(iθ3) − c·e^(iθ4) − d = 0. d is constant.
2. Differentiate in time (d/dt e^(iθ) = i·ω·e^(iθ)):
   i·a·ω2·e^(iθ2) + i·b·ω3·e^(iθ3) − i·c·ω4·e^(iθ4) = 0.
3. Multiply by e^(−iθ3) and take the imaginary part → the ω3 term drops out (sin 0 = 0):
   a·ω2·sin(θ2 − θ3) − c·ω4·sin(θ4 − θ3) = 0 → **ω4 = a·ω2·sin(θ2 − θ3) / (c·sin(θ4 − θ3))**.
4. Multiply by e^(−iθ4) and take the imaginary part → the ω4 term drops out:
   **ω3 = a·ω2·sin(θ4 − θ2) / (b·sin(θ3 − θ4))**.
5. Velocities are **linear** in ω2: double the motor speed, double all velocities.

**Formula box**

| Symbol | Meaning | Unit |
|---|---|---|
| ω2, ω3, ω4 | Angular velocities of crank, coupler, rocker | rad/s |
| θ2, θ3, θ4 | Link angles from position analysis | rad |

  ω3 = a ω2 sin(θ4 − θ2) / (b sin(θ3 − θ4)),  ω4 = a ω2 sin(θ2 − θ3) / (c sin(θ4 − θ3))

Note the denominator sin(θ4 − θ3) = ± sin μ (transmission angle, 4.5): at μ = 0 or 180° (toggle) the rocker
velocity formula breaks down – a dead position.

**In the program**
```python
def velocity(t2, t3, t4, w2, a, b, c):
    """Closed form (Norton): w3 = a w2 sin(t4-t2) / (b sin(t3-t4)), w4 = a w2 sin(t2-t3) / (c sin(t4-t3))."""
    w3 = a * w2 * math.sin(t4 - t2) / (b * math.sin(t3 - t4))
    w4 = a * w2 * math.sin(t2 - t3) / (c * math.sin(t4 - t3))
    return w3, w4
```
The self-test compares ω3, ω4 with finite differences of the position solution (agreement better than 10⁻⁶).

### 4.2 Acceleration – a 2 × 2 linear system

**Derivation.**
1. Differentiate the velocity loop again (α = dω/dt):
   a(iα2 − ω2²)e^(iθ2) + b(iα3 − ω3²)e^(iθ3) − c(iα4 − ω4²)e^(iθ4) = 0.
2. Real and imaginary parts:
   −a α2 s2 − a ω2² c2 − b α3 s3 − b ω3² c3 + c α4 s4 + c ω4² c4 = 0
    a α2 c2 − a ω2² s2 + b α3 c3 − b ω3² s3 − c α4 c4 + c ω4² s4 = 0
   (s2 = sin θ2, c2 = cos θ2, …)
3. Unknowns α3 and α4 appear **linearly** → move known terms right, solve the 2 × 2 system by Cramer's rule.
4. The terms with ω² are **centripetal** accelerations (always present at constant speed). The terms with α are
   tangential.

**Formula box**

  [ −b s3   c s4 ] [α3]   [ a α2 s2 + a ω2² c2 + b ω3² c3 − c ω4² c4 ]
  [  b c3  −c c4 ] [α4] = [ −a α2 c2 + a ω2² s2 + b ω3² s3 − c ω4² s4 ]

Accelerations scale with **ω2²**: double speed → four times the acceleration → four times the inertia forces.

**In the program**
```python
def acceleration(t2, t3, t4, w2, w3, w4, al2, a, b, c):
    """Second derivative of the loop equation -> linear 2x2 in alpha3, alpha4.
    real: -a al2 s2 - a w2^2 c2 - b al3 s3 - b w3^2 c3 + c al4 s4 + c w4^2 c4 = 0
    imag:  a al2 c2 - a w2^2 s2 + b al3 c3 - b w3^2 s3 - c al4 c4 + c w4^2 s4 = 0"""
    s2, c2, s3, c3, s4, c4 = (math.sin(t2), math.cos(t2), math.sin(t3), math.cos(t3), math.sin(t4), math.cos(t4))
    r1 = a * al2 * s2 + a * w2 * w2 * c2 + b * w3 * w3 * c3 - c * w4 * w4 * c4
    r2 = -a * al2 * c2 + a * w2 * w2 * s2 + b * w3 * w3 * s3 - c * w4 * w4 * s4
    al3, al4 = _solve2(-b * s3, c * s4, b * c3, -c * c4, r1, r2)
    return al3, al4
```

**Run it** (DEFAULT, θ2 = 90°, 120 rpm → ω2 = 12.5664 rad/s): `python fourbar.py ch24`
```
  theta2 90: w3 -0.6428 w4 4.3754 rad/s, al3 33.640 al4 24.422 rad/s2
```
Same values as the kinematics table row θ2 = 90 (chapter 3.6). The self-test checks α3, α4 against second finite
differences of the position solution.

### 4.3 Instant centres and Kennedy's theorem – a graphical check

**Theory.** For two links in plane motion there is one point where they have the same velocity: the
**instant centre** (IC) I_jk. Number of ICs for n links: **N = n(n − 1)/2** → 6 for a four-bar, 15 for a six-bar.

- I12 = O2 and I14 = O4 (pins to ground), I23 = A, I34 = B (pins).
- **Kennedy's theorem:** the three ICs of any three links lie on one straight line.
  → I24 (crank–rocker) lies on line I12–I14 (the ground line O2O4) **and** on line I23–I34 (the coupler line AB).
  So I24 = intersection of the ground line with the extended coupler.
- I24 is a point of link 2 and of link 4 with the same velocity:
  ω2·(I24 − O2) = ω4·(I24 − O4) → **ω4/ω2 = O2I24 / O4I24** (signed distances along the ground line).
  I24 outside the pivots → same direction of rotation; between the pivots → opposite direction.

**In the program**
```python
def instant_centre_I24(t2, a, b, c, d, branch=1):
    """Kennedy: I24 lies on line O2-O4 (I12-I14, here the x axis) and on line A-B (I23-I34).
    Returns x of I24 and the velocity ratio w4/w2 = (I24 - O2)/(I24 - O4) (signed)."""
    pos = position(t2, a, b, c, d, branch)
    A, B = pos["A"], pos["B"]
    dv = B - A
    t = -A.imag / dv.imag
    x24 = A.real + t * dv.real
    return x24, x24 / (x24 - d)
```

**Run it** (columns 2–5): `python fourbar.py ch24`
```
## Chapter 4 - velocity, IC, MA, coupler point (DEFAULT, 120 rpm, w2 = 12.5664 rad/s)
  t2  w4 (closed)  w4/w2  I24_x[mm]  w4/w2 (IC)  MA=T4/T2  MA(angles)  mu  nu
    0   -5.3856 -0.42857      30.00   -0.42857    -2.333    -2.333  44.05  52.62
   45    0.9308  0.07407      -8.00    0.07407    13.501    13.501  52.49   9.01
   90    4.3754  0.34818     -53.42    0.34818     2.872     2.872  69.89  60.68
  135    4.5759  0.36414     -57.27    0.36414     2.746     2.746  85.49 104.53
  180    2.8999  0.23077     -30.00    0.23077     4.333     4.333  91.79 142.04
  225    0.4387  0.03491      -3.62    0.03491    28.643    28.643  85.49 174.67
  270   -2.3002 -0.18304      15.47   -0.18304    -5.463    -5.463  69.89 152.72
  315   -5.5415 -0.44098      30.60   -0.44098    -2.268    -2.268  52.49 111.12
```

**Interpretation.**
- The velocity ratio from the instant centre equals the closed-form ratio in every row (5 decimals) – an
  independent geometric check of `velocity()`.
- θ2 = 0: I24 at x = 30 mm, between O2 (0) and O4 (100) → ω4/ω2 = 30/(30 − 100) = −0.42857: the rocker turns
  opposite to the crank.
- θ2 = 45° and 225°: I24 is very close to O2 (−8.0 and −3.6 mm) → ω4 small: the rocker is near its limit positions
  (37.958° and 232.617°, chapter 3.5). When I24 = O2 exactly, ω4 = 0.
- In SOLIDWORKS sketches you can find I24 graphically: extend the coupler line until it cuts the ground line. This
  is a quick check of any MBD result for velocity ratios.

### 4.4 Coupler point velocity and acceleration (`coupler_point()`)

**Derivation.** P = A + p·e^(i(θ3 + δ)). Differentiate:
- v_P = v_A + i·p·ω3·e^(i(θ3+δ)), with v_A = i·a·ω2·e^(iθ2)
- a_P = a_A + (i·α3 − ω3²)·p·e^(i(θ3+δ)), with a_A = (i·α2 − ω2²)·a·e^(iθ2)
(rigid-body relation: velocity of a point = velocity of a reference point + ω × distance).

**In the program**
```python
def coupler_point(A, t3, w2, w3, al2, al3, t2, a, p, delta):
    """Position, velocity, acceleration of coupler point P = A + p e^(i(t3+delta))."""
    eA = cmath.exp(1j * t2)
    eP = cmath.exp(1j * (t3 + delta))
    P = A + p * eP
    vA = 1j * a * w2 * eA
    aA = (1j * al2 - w2 * w2) * a * eA
    vP = vA + 1j * p * w3 * eP
    aP = aA + (1j * al3 - w3 * w3) * p * eP
    return P, vP, aP
```

**Run it** (p = 50 mm, δ = 30°, θ2 = 90°)
```
  coupler point P (25.513, 73.001) mm, |vP| 0.3497 m/s, |aP| 4.160 m/s2
```
The coupler point is where you attach a gripper finger or a transfer bar. Its acceleration × carried mass = the
force your gripper must hold: 4.16 m/s² × 0.5 kg part (example) ≈ 2.1 N here – small, but it grows with rpm².

### 4.5 Transmission angle

**Theory.** The **transmission angle μ** is the angle between the coupler and the rocker at joint B. The coupler
(a two-force member if it carries no load) pushes the rocker **along** the coupler. Only the component perpendicular
to the rocker makes torque; the component along the rocker only loads the pivot O4:

  useful force = S·sin μ,  pivot load = S·cos μ   (S = coupler force)

μ = 90° is ideal. μ near 0° or 180° = almost all force goes into the bearing, small torque, sensitive to friction
and tolerances, risk of jamming.

**Derivation (cosine law).** The diagonal e = |O4 − A| belongs to two triangles, O2–A–O4 and A–B–O4:
- Triangle O2 A O4: e² = a² + d² − 2ad·cos θ2.
- Triangle A B O4: e² = b² + c² − 2bc·cos μ.
- Equal: **cos μ = (b² + c² − a² − d² + 2ad·cos θ2) / (2bc)**.
Extremes at θ2 = 0° (e = d − a) and θ2 = 180° (e = d + a):

  cos μ_0 = (b² + c² − (d − a)²)/(2bc),  cos μ_180 = (b² + c² − (d + a)²)/(2bc)

**In the program**
```python
def transmission_angle(t2, a, b, c, d):
    """Transmission angle mu (deg, 0..180) by the cosine law: cos mu = (b^2 + c^2 - a^2 - d^2 + 2 a d cos t2) / (2 b c)."""
    cm = (b * b + c * c - a * a - d * d + 2 * a * d * math.cos(t2)) / (2 * b * c)
    return math.degrees(math.acos(max(-1.0, min(1.0, cm))))
```
and the extreme values (added for this chapter):
```python
def mu_extremes(a, b, c, d):
    """Extreme transmission angles of a crank-rocker at t2 = 0 and 180 deg:
    cos mu = (b^2 + c^2 - (d -+ a)^2) / (2 b c)."""
    m0 = math.degrees(math.acos((b * b + c * c - (d - a) ** 2) / (2 * b * c)))
    m180 = math.degrees(math.acos((b * b + c * c - (d + a) ** 2) / (2 * b * c)))
    return m0, m180
```

**Run it**
```
  mu extremes: at theta2 0 -> 44.05 deg, at 180 -> 91.79 deg
```
and the report of `python fourbar.py run`: "transmission angle 44.0 ... 91.8 deg (max deviation from 90 deg: 46.0)".

**Design rules (common practice – check with your own experience and the load):**

| Rule | Value | Note |
|---|---|---|
| Minimum transmission angle | μ ≥ 40° (and ≤ 140°) | Classic rule (Alt); for high speed / high load aim 45–50° |
| Maximum deviation from 90° | ≤ 50° | Same rule written as deviation |
| Hand-operated / slow | μ ≥ 30° may be accepted | If friction is low and no jamming risk |
| Toggle clamps | μ → 0° wanted at the end | Force gain is the goal (2.4) |

The DEFAULT linkage has μ_min = 44.05° – inside the rule but close. If the rocker load is high at θ2 ≈ 0°, increase
μ_min by making the crank shorter or the coupler/rocker longer (rerun `python fourbar.py run --in my.json`).
The self-test proves that the cosine-law μ equals |θ4 − θ3| from the position solution.

### 4.6 Mechanical advantage

**Theory.** With no friction and no inertia, power in = power out:

  T2·ω2 = T4·ω4 → **MA = T4/T2 = ω2/ω4**

So the output torque is high where the rocker is slow. With the angles (from 4.1):

  **MA = c·sin(θ4 − θ3) / (a·sin(θ2 − θ3)) = c·sin μ / (a·sin ν)**,  ν = angle between crank and coupler

- MA → ∞ when ν → 0° or 180° (crank and coupler collinear = rocker limit position = **toggle for the output**).
- MA → 0 when μ → 0° or 180° (coupler and rocker collinear).
- With the instant centre: MA = O4I24 / O2I24.

**In the program**
```python
def mechanical_advantage(t2, a, b, c, d, branch=1):
    """Ideal MA = T4/T2 = w2/w4 (power in = power out, no losses).
    Same value from the angles: MA = c sin(t4 - t3) / (a sin(t2 - t3)) = c sin(mu)/(a sin(nu)), nu = angle crank-coupler."""
    pos = position(t2, a, b, c, d, branch)
    t3, t4 = pos["t3"], pos["t4"]
    w3, w4 = velocity(t2, t3, t4, 1.0, a, b, c)
    ma_w = 1.0 / w4
    ma_ang = c * math.sin(t4 - t3) / (a * math.sin(t2 - t3))
    nu = math.degrees(abs(_wrap(t2 - t3)))
    return ma_w, ma_ang, transmission_angle(t2, a, b, c, d), nu
```

**Run it:** columns 6–9 of the chapter 4 table above.

**Interpretation (example values).**
- θ2 = 225°: ν = 174.67° (crank and coupler nearly in line) → MA = 28.6. 1 N·m at the crank would hold 28.6 N·m at
  the rocker (ideal). This is the toggle effect near the rocker limit position – it is how a crank-driven press
  gets its force at the bottom of the stroke.
- θ2 = 0°: MA = −2.333 (negative sign = opposite rotation direction, see ω4/ω2 = −0.42857).
- Both formulas (ω ratio and angles) give identical numbers – a third independent check.

Real MA is lower: pin friction torque μ_f·F·r_pin at each joint and inertia (chapter 7) take part of the input. Use
the ideal MA for kinematic design, the dynamic analysis (`dynamics_at()`) for motor sizing.

### 4.7 Design advice for driven linkages (speed, acceleration, jerk)

**Run it**
```
  rocker max |w4| 6.477 rad/s, max |al4| 111.26 rad/s2 -> tip (c = 80 mm) v 0.518 m/s, tangential a 8.90 m/s2
  inertia torque on a 0.002 kg m2 tool on the rocker: J al4 max = 0.223 N m
  alpha4 scales with rpm^2: at 240 rpm max |al4| = 445.0 rad/s2
  number of instant centres for n = 4 links: 6; n = 6: 15
```

**Interpretation and rules.**
1. **Acceleration grows with speed squared.** Doubling the rate from 120 to 240 rpm raises α4 from 111 to
   445 rad/s² → inertia torques ×4, pin forces from inertia ×4, shaking ×4. Check the cycle time requirement before
   choosing rpm.
2. **Heavy rockers: keep α4 low.** Inertia torque J·α4 adds directly to the motor torque. A 0.002 kg·m² tool on the
   rocker needs 0.223 N·m extra at 120 rpm, 0.89 N·m at 240 rpm (example values).
3. **Jerk (dα/dt).** Sudden changes of acceleration excite vibration of the arm and the frame. Linkages have smooth
   (continuous) acceleration as long as the crank speed is smooth – an advantage over cam drives with poor motion
   laws (M6). Avoid stepper motors with coarse steps or a jerky servo profile on the crank.
4. **Use the limit positions for work.** ω4 = 0 there; place pick/place, clamping or pressing at the limits.
5. **Long thin links** bend under the inertia load: deflection changes the output angle. Check stiffness, not only
   strength (M1 chapter 21).
6. **Check list for a driven four-bar:** Grashof class right? μ_min ≥ 40°? Q as wanted? max ω4, α4 and the
   resulting torques acceptable? branch shown on drawing? tolerances and pin play (chapter 9)?

**MATLAB equivalent (velocity, acceleration at one angle)**
```matlab
w2 = 120*2*pi/60;  t2 = deg2rad(90);  t3 = deg2rad(29.319);  t4 = deg2rad(99.214);
w3 = a*w2*sin(t4-t2)/(b*sin(t3-t4));     w4 = a*w2*sin(t2-t3)/(c*sin(t4-t3));     % -0.643, 4.375
M  = [-b*sin(t3)  c*sin(t4);  b*cos(t3)  -c*cos(t4)];
r  = [a*w2^2*cos(t2) + b*w3^2*cos(t3) - c*w4^2*cos(t4);
      a*w2^2*sin(t2) + b*w3^2*sin(t3) - c*w4^2*sin(t4)];
al = M \ r                                                                          % [33.64; 24.42]
mu = acosd((b^2 + c^2 - a^2 - d^2 + 2*a*d*cos(t2))/(2*b*c))                       % 69.89
```
(Lengths in mm give velocities in rad/s because a/b and a/c are ratios; a_P in mm/s² must be divided by 1000.)

**Check questions**
1. Where is I24 when the rocker is at a limit position? (At O2: ω4 = 0.)
2. A crank-rocker runs at 60 rpm and max |α4| = 30 rad/s². What is α4 at 90 rpm? (30 × 1.5² = 67.5 rad/s².)
3. Why is μ_min usually at θ2 = 0° for this layout? (The diagonal e = d − a is shortest; the cosine law gives the
   smallest angle opposite to the shortest side.)
4. Explain with MA why a crank press is strongest at the bottom of the stroke.


---

## 5 Coupler curves

> Program: `tools/fourbar.py`. Base functions: `coupler_point()`, `sweep()`, `run()` (chart `coupler_curve.svg`).
> Functions added for this chapter: `position_general()`, `coupler_curve()`, `curve_shape()`, `straightness()`,
> `cognates()`, `cognate_check()`, `circle_fit()`, `dwell_sixbar()`. All results: `python fourbar.py ch56`.
> All link lengths and positions are **example values**.

### 5.1 What a coupler curve is

**Theory.** The crank (link 2) turns. The rocker (link 4) swings. The coupler (link 3) does both at the same time:
it moves **and** rotates. So every point fixed on the coupler draws its own closed path. This path is the
**coupler curve**. One four-bar has an infinite number of coupler curves – one for each point on the coupler plane.
This is why the four-bar is so useful in machines: with only 4 links and 4 pin joints you can get a very large
family of paths – ovals, figure-eights, near-straight lines, near-circular arcs, cusps.

**Definition of the coupler point.** We fix the point P on the coupler by two numbers measured from joint A:

- p = distance from A to P (mm)
- δ = angle between line AB and line AP (deg, counter-clockwise positive)

Then P always moves with the coupler angle θ3:

**Derivation.** Joint A is at a·e^(iθ2). The vector A→P has the fixed length p and the angle θ3 + δ (the coupler turns
by θ3, and P is δ further). So

  P = a·e^(iθ2) + p·e^(i(θ3+δ))

Differentiate once in time (θ̇2 = ω2, θ̇3 = ω3). The derivative of e^(iθ) is i·θ̇·e^(iθ):

  v_P = i·a·ω2·e^(iθ2) + i·p·ω3·e^(i(θ3+δ))

Differentiate again. The derivative of i·ω·e^(iθ) is (i·α − ω²)·e^(iθ):

  a_P = (i·α2 − ω2²)·a·e^(iθ2) + (i·α3 − ω3²)·p·e^(i(θ3+δ))

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ P   = a e^(iθ2) + p e^(i(θ3+δ))                                    [mm]       │
│ v_P = i a ω2 e^(iθ2) + i p ω3 e^(i(θ3+δ))                          [mm/s]     │
│ a_P = (iα2 − ω2²) a e^(iθ2) + (iα3 − ω3²) p e^(i(θ3+δ))             [mm/s²]    │
│ p = A→P distance, δ = angle from AB to AP, θ3 coupler angle, ω3, α3 from ch. 4│
└──────────────────────────────────────────────────────────────────────────────┘
```

**In the program** (`coupler_point()` in `fourbar.py`, used by `sweep()` and `dynamics_at()`):
```python
def coupler_point(A, t3, w2, w3, al2, al3, t2, a, p, delta):
    """Position, velocity, acceleration of coupler point P = A + p e^(i(t3+delta))."""
    eA = cmath.exp(1j * t2)
    eP = cmath.exp(1j * (t3 + delta))
    P = A + p * eP
    vA = 1j * a * w2 * eA
    aA = (1j * al2 - w2 * w2) * a * eA
    vP = vA + 1j * p * w3 * eP
    aP = aA + (1j * al3 - w3 * w3) * p * eP
    return P, vP, aP
```
The curve over one turn (`coupler_curve()`, added for this chapter) simply calls `position()` for every input angle:
```python
def coupler_curve(a, b, c, d, p, delta_deg, branch=1, n=360):
    dl = math.radians(delta_deg)
    out = []
    for k in range(n):
        t2 = 2 * math.pi * k / n
        pos = position(t2, a, b, c, d, branch)
        if pos:
            out.append((t2, pos["A"] + p * cmath.exp(1j * (pos["t3"] + dl))))
    return out
```

**Run it:**
```
python fourbar.py ch56
## 5.1 Coupler curve of the default linkage (a 30, b 100, c 80, d 100 mm, p 50 mm, delta 30 deg)
  oval / single loop; width 56.47 mm, height 53.10 mm, length 167.78 mm, min/mean speed 0.646
  mean coupler-point speed at 120 rpm: 0.336 m/s
```
`python fourbar.py run --out fb` writes `coupler_curve.svg`. It shows the coupler curve (red) and the linkage drawn at
θ2 = 0, 90, 180 and 270° (grey). Open it in any browser – it works offline.

**Interpretation.** For the default transfer-arm linkage, P runs on an oval about 56 × 53 mm. Its path is 167.8 mm
long per turn. At 120 rpm (2 turns per second) the mean speed is 167.8 mm · 2 /s = 0.336 m/s. The ratio
"min/mean speed" = 0.646 tells you that P never slows down much – a smooth oval without sharp corners.

### 5.2 Shapes of coupler curves

**Theory.** If you move P on the coupler plane, the curve shape changes. The main families:

| Shape | What it looks like | Typical use |
|---|---|---|
| Oval / single loop | Closed, smooth, no crossing | Stirring, brushing, simple transfer |
| Figure-eight | The path crosses itself once | Film pull-down, feed motions with two strokes |
| Cusp | A sharp point – P stops for a moment there | Pick-up and set-down without sliding (zero speed at the part) |
| Near-straight segment | One part of the loop is almost a line | Walking-beam conveyors, straight guiding |
| Near-circular arc | One part is almost an arc | Dwell mechanisms (5.6) |
| Degenerate arc | The point is on the rocker pin B, so it moves back and forth on one arc | (just the rocker motion) |

**How the program decides the shape** (`curve_shape()`): it cuts the curve into 720 small segments.
- It counts how many segment pairs cross each other: 0 → oval, 1 → figure-eight.
- More than 10 "crossings" means the curve runs back over itself on a single arc (degenerate).
- It divides the shortest segment by the mean segment length. This is the speed ratio at constant input speed. A value
  below 0.05 means P almost stops → **cusp**.
```python
    lens = [abs(s[1] - s[0]) for s in segs]
    L = sum(lens)
    ...
    if cross > 10:
        kind = "degenerate: runs back and forth on one arc (rocker pin B)"
    else:
        kind = "figure-eight (crosses itself)" if cross == 1 else ("oval / single loop" if cross == 0 else
                                                                  "%d self-crossings" % cross)
    ratio = min(lens) / (L / m)
    if ratio < 0.05 and cross <= 10:
        kind += ", cusp (point almost stops)"
```

**Run it** (same linkage a 30, b 100, c 80, d 100 mm – only the coupler point changes):
```
## 5.2 Shapes for other coupler points on the same linkage
  p 50 mm, delta 30 deg  -> oval / single loop                              width 56.47 height 53.10 min/mean speed 0.646
  p 80 mm, delta -45 deg -> figure-eight (crosses itself)                   width 60.22 height 25.16 min/mean speed 0.202
  p 110 mm, delta 15 deg -> oval / single loop, cusp (point almost stops)   width 68.03 height 30.71 min/mean speed 0.008
  p 100 mm, delta 0 deg  -> degenerate: runs back and forth on one arc (rocker pin B)  width 60.00 height 24.38
  p 200 mm, delta 20 deg -> oval / single loop                              width 112.51 height 24.10 min/mean speed 0.179
  p 100 mm, delta 90 deg -> oval / single loop                              width 60.71 height 104.81 min/mean speed 0.571
```

**Interpretation.**
- p = 100 mm, δ = 0 puts P exactly on joint B (b = 100 mm). B belongs to the rocker, so it only swings on an arc of
  radius c = 80 mm. The width 60.00 mm is the chord of that arc. This is a good check of the program: the arc chord is
  2·c·sin(ψ/2) = 2 · 80 · sin(47.742°/2) = 64.8 mm for the full swing; the curve width 60.00 mm is its x-projection.
- p = 110 mm, δ = 15° gives a cusp: the speed falls to 0.8 % of the mean speed. A gripper on such a point touches a part
  with almost zero speed – no impact, no sliding.
- p = 200 mm, δ = 20° gives a long flat oval (112.5 × 24.1 mm): good for a short "walking beam" stroke.

**Hrones–Nelson atlas.** In 1951 Hrones and Nelson published an atlas of four-bar coupler curves: crank length = 1, the
other links in steps, and a grid of coupler points for each linkage (about 7 000 curves – number from memory, check the
book). Designers looked for a curve with the right shape, then scaled it. Today you do the same with the program:
loop over p and δ (and the link ratios), call `curve_shape()` and keep the curves that fit. That is a digital atlas.

**Practice.** In the compressor factory, typical coupler-curve jobs are: moving a part from a conveyor into a fixture,
the feed motion of a deburring brush, a "walking beam" that steps cylinder heads forward on a washing line, a lid
closer. When the path is fixed but the timing along it is free, a four-bar is cheaper than a servo axis and needs no
program.

**MATLAB equivalent:**
```matlab
a=30; b=100; c=80; d=100; p=50; dl=deg2rad(30); t2=linspace(0,2*pi,361);
P=zeros(size(t2));
for k=1:numel(t2)
  A=a*exp(1i*t2(k)); v=d-A; e=abs(v); x=(b^2-c^2+e^2)/(2*e); h=sqrt(b^2-x^2);
  u=v/e; B=A+x*u+h*1i*u;                      % branch +1
  P(k)=A+p*exp(1i*(angle(B-A)+dl));
end
plot(real(P),imag(P)); axis equal; sum(abs(diff(P)))   % length, expect about 167.8 mm
```

**Check questions.** (1) Why does the point on joint B not draw a closed loop? (2) Which shape do you choose for a
gripper that must stop at the part? (3) What is the mean speed of P at 60 rpm for the default oval?

### 5.3 Approximate straight-line linkages

**Theory.** Before precision slides existed, engineers needed straight motion from pin joints only (steam engine piston
rods). A four-bar cannot give an exact straight line, but some coupler points come very close over part of the turn.

| Linkage | Proportions (unit lengths) | Straight part |
|---|---|---|
| Watt (1784) | Two equal rockers, coupler midpoint | Figure-eight; straight near the crossing; double-rocker |
| Chebyshev | Ground 4, two crossed rockers 5, coupler 2, P = coupler midpoint | Double-rocker; long straight part |
| Roberts | Isosceles coupler triangle, equal rockers | Double-rocker; straight between the pivots |
| Hoeken | Crank 1, ground 2, coupler 2.5, rocker 2.5, P on AB extended at 5 from A | **Crank-rocker** (motor can drive it); straight over about 180° of crank turn, nearly constant speed |

The Hoeken linkage is the most useful in machines because its input is a full crank. It is in fact a **cognate**
of the Chebyshev linkage (5.5) – the program shows this.

**How straightness is measured** (`straightness()`): for every window of crank angle (here 180°), take the coupler
points, fit the best line through them (principal axis of the point cloud) and find the largest distance of any
point from that line.

Best line through points (x_i, y_i): angle φ with tan 2φ = 2·S_xy / (S_xx − S_yy), where S_xx = Σ(x−x̄)², S_yy = Σ(y−ȳ)²,
S_xy = Σ(x−x̄)(y−ȳ). Deviation of a point = its distance from the line.

```
┌─────────────────────────────────────────────────────────────────────┐
│ φ = ½ atan2(2 S_xy, S_xx − S_yy)            best-line angle          │
│ e_i = Im[(P_i − P̄) · e^(−iφ)]               distance from the line   │
│ straightness = max|e_i| / straight length · 100 %                   │
└─────────────────────────────────────────────────────────────────────┘
```
```python
        ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
        u = complex(math.cos(ang), math.sin(ang))
        dev = max(abs(((z - complex(mx, my)) / u).imag) for z in P)
        along = [((z - complex(mx, my)) / u).real for z in P]
        length = max(along) - min(along)
```

**Run it:**
```
## 5.3 Approximate straight-line linkages (unit lengths)
  Hoeken a 1, b 2.5, c 2.5, d 2, P on AB extended at 5 (crank-rocker): best 180 deg window from 90.0 deg:
  straight length 4.0000, max deviation 0.00501 (0.125 %), speed variation 26.07 %
  Hoeken, 120 deg window: length 2.7747, deviation 0.005308 (0.1913 %), speed variation 6.53 %
  Grashof Hoeken: Grashof crank-rocker (input crank turns fully, output rocks)
  cognate 2 of Hoeken (pivots O2, O6): crank 5.0000, coupler 2.0000, rocker 5.0000, ground 4.0000 -> Grashof double-rocker
  cognate 3 of Hoeken (pivots O4, O6): crank 2.5000, coupler 2.5000, rocker 1.0000, ground 2.0000 -> Grashof rocker-crank
```

**Interpretation.**
- Over half a crank turn the Hoeken point moves 4.000 units (= 4 crank lengths) in a line with only
  0.125 % deviation. With a 50 mm crank: a 200 mm stroke, straight within 0.25 mm.
- The speed along the line varies 26 % over the full 180° window, but only 6.5 % over a 120° window. If you need
  near-constant speed (e.g. a gluing nozzle), use the middle 120°. (The 120° window was chosen by the best ratio
  deviation/length, so its absolute deviation 0.0053 is not smaller – it lies in a different part of the curve.)
- Cognate 2 of Hoeken has links 5 – 2 – 5 – 4: this **is** the Chebyshev linkage (ground 4, rockers 5, coupler 2). The
  program proves that the two classic linkages draw the same curve.

**Practice.** A Hoeken drive is used for walking-beam conveyors, film transport and toy "walkers". For a real machine
remember: the straightness is a nominal value. Link-length tolerances and pin clearance add errors of the same size or
larger (chapter 9). For guiding a heavy part straight, a linear guide is still better; the linkage is the **drive**.

**MATLAB:** use the coupler-curve loop of 5.2 with a=1, b=2.5, c=2.5, d=2, p=5, δ=0, then
`[V,~]=eig(cov([real(P(i)) imag(P(i))]))` on the window points to get the line direction.

**Check questions.** (1) Why is the Hoeken linkage preferred over the Chebyshev linkage when an electric motor drives
it? (2) A 40 mm crank Hoeken: what stroke and what straightness in mm?

### 5.4 Symmetric coupler curves and dwell mechanisms

**Theory – symmetric curves.** If the coupler, the rocker and the coupler point form an isosceles arrangement
(|AB| = |BO4| = |BP|), the coupler curve is symmetric about a line through O4. Symmetric curves are easy to design
for back-and-forth motions with equal forward and return paths. (Rule from Norton, ch. 3 – check the conditions there.)

**Theory – dwell.** Many machines need an output that **stops** for part of the cycle while the motor keeps running
(index, press, wait for a gripper). A four-bar alone cannot dwell. A **six-bar dwell mechanism** can:
1. Find a part of a coupler curve that is close to a **circular arc** of radius R and centre C.
2. Add link 5 of length R from P to a new joint, placed at C.
3. Connect this joint to an output rocker pivoted at O6.
While P runs on the arc, the distance from P to C stays R, so the joint does not move → the output rocker stands
still. Outside the arc the output swings.

**Circle fit** (`circle_fit()`, algebraic Kåsa fit): the circle x² + y² + D·x + E·y + F = 0 is linear in D, E, F →
least squares (normal equations 3 × 3) → centre (−D/2, −E/2), R = √(x_c² + y_c² − F).

```
┌──────────────────────────────────────────────────────────────────┐
│ min Σ (x_i² + y_i² + D x_i + E y_i + F)²   → solve 3×3 normal eqs  │
│ C = (−D/2, −E/2),  R = √(C_x² + C_y² − F),  dev = max| |P_i − C| − R | │
└──────────────────────────────────────────────────────────────────┘
```
```python
def circle_fit(pts):
    S = [[0.0] * 3 for _ in range(3)]
    r = [0.0] * 3
    for z in pts:
        row = [z.real, z.imag, 1.0]
        rhs = -(z.real ** 2 + z.imag ** 2)
        for i in range(3):
            r[i] += row[i] * rhs
            for j in range(3):
                S[i][j] += row[i] * row[j]
    D, E, F = solve_linear(S, r)
    cen = complex(-D / 2, -E / 2)
    R = math.sqrt(cen.real ** 2 + cen.imag ** 2 - F)
    dev = max(abs(abs(z - cen) - R) for z in pts)
    return cen, R, dev
```
`dwell_sixbar()` searches every 60° window of the coupler curve for the best arc, places joint C at the centre, the
output pivot O6 60 mm below C, and then follows joint C over the whole turn (circle–circle intersection, keeping the
branch continuous from the dwell window).

**Run it:**
```
## 5.5 Six-bar dwell from the default coupler curve (input window 60 deg, output rocker 60 mm)
  arc from theta2 = 112.0 deg: radius R 45.739 mm, centre (30.536, 27.881), arc deviation 0.0124 mm
  output rocker: moves 0.0410 deg during the 60 deg dwell window, total swing 37.865 deg
```

**Interpretation.** On the default oval, the part between θ2 = 112° and 172° is a circular arc of R = 45.739 mm within
0.012 mm. With link 5 = 45.739 mm and a 60 mm output rocker, the output moves only 0.041° during 60° of crank turn
(1/6 of the cycle) and swings 37.9° in the rest. 0.041° on a 60 mm arm = 0.043 mm: for most handling jobs this is a
true stop. If you need a longer dwell, search with a 90° window – the arc deviation will grow; you trade dwell length
against dwell quality.

**Practice.** Dwell six-bars are common in packaging and in older presses. Compared with a cam (M6) they have only pin
joints – cheap, robust, no cam wear, good at high speed. A cam gives an exact dwell and any motion law. Choose the cam
when accuracy of the dwell matters; choose the linkage when robustness and cost matter.

**Check questions.** (1) Why must link 5 have exactly the arc radius? (2) What happens to the dwell if link 5 is
made 0.1 mm too long?

### 5.5 Roberts–Chebyshev cognates – three linkages, one curve

**Theory (Roberts' law, 1875).** Every coupler curve of a four-bar is drawn by **three** different four-bars. They are
called **cognates**. Why is this useful? If the first linkage has a bad transmission angle, needs a pivot where there is
no space, or is non-Grashof, one of its cognates may be better – with exactly the same coupler path.

**Derivation with complex numbers.** Let r2 = A − O2 (crank), r3 = B − A (coupler), r4 = B − O4 (rocker),
g = O4 − O2 (ground). The coupler point P is fixed on the coupler, so P − A = k·(B − A) with a constant complex number

  k = (p / b)·e^(iδ)

(length ratio and angle of the coupler triangle). The loop closure is r2 + r3 = g + r4, so r3 = g + r4 − r2. Then

  P = O2 + r2 + k·r3 = O2 + r2 + k(g + r4 − r2) = (O2 + k·g) + (1 − k)·r2 + k·r4

Define the third fixed pivot **O6 = O2 + k·g**. Now P can be written in three ways:

| Way | Formula | Built from |
|---|---|---|
| Original | P = O2 + r2 + k·r3 | crank r2 from O2, then coupler |
| Cognate 2 | P = O2 + k·r3 + r2 | first a link k·r3 from O2 (turns like the coupler), then r2 |
| Cognate 3 | P = O4 + (k − 1)·r3 + r4 | first a link (k−1)·r3 from O4, then r4 |
| (via O6) | P = O6 + (1 − k)·r2 + k·r4 | closes cognates 2 and 3 at O6 |

From these, cognate 2 has links |k|·b (crank at O2), |k|·a (coupler), |k|·c (rocker at O6), ground |k|·d.
Cognate 3 has links |1−k|·b (crank at O4), |1−k|·c (coupler), |1−k|·a (rocker at O6), ground |1−k|·d.
So each cognate is the original **scaled and with the links in a different order**.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ k = (p/b) e^(iδ)          O6 = O2 + k (O4 − O2)                            │
│ cognate 2 (O2–O6): crank |k| b, coupler |k| a, rocker |k| c, ground |k| d    │
│ cognate 3 (O4–O6): crank |1−k| b, coupler |1−k| c, rocker |1−k| a,           │
│                    ground |1−k| d                                          │
│ coupler point: cognate 2: P = D + (E − D)/k ; cognate 3: P = F + (G − F)/(1−k) │
└───────────────────────────────────────────────────────────────────────────┘
```

**In the program** (`cognates()`):
```python
def cognates(a, b, c, d, p, delta_deg):
    k = (p / b) * cmath.exp(1j * math.radians(delta_deg))
    O2, O4 = 0j, complex(d, 0)
    O6 = O2 + k * (O4 - O2)
    k1 = 1 - k
    return {"k": k, "O6": O6,
            "original": {"O2": O2, "O4": O4, "links": (a, b, c, d)},
            "cognate2": {"O2": O2, "O4": O6, "links": (abs(k) * b, abs(k) * a, abs(k) * c, abs(k) * d)},
            "cognate3": {"O2": O4, "O4": O6, "links": (abs(k1) * b, abs(k1) * c, abs(k1) * a, abs(k1) * d)}}
```
`cognate_check()` is the independent proof: it drives the original, computes P, then **solves each cognate as a
separate linkage** with `position_general()` (ground pivots anywhere) and compares the cognate's coupler point with P.

**Run it:**
```
## 5.4 Roberts-Chebyshev cognates of the default linkage
  k = 0.4330 +0.2500i (|k| 0.5000, angle 30.0 deg), O6 = (43.301, 25.000) mm
  original  crank 30.000 coupler 100.000 rocker 80.000 ground 100.000 mm -> Grashof crank-rocker
  cognate2  crank 50.000 coupler  15.000 rocker 40.000 ground  50.000 mm -> Grashof double-rocker (coupler turns fully)
  cognate3  crank 61.966 coupler  49.573 rocker 18.590 ground  61.966 mm -> Grashof rocker-crank (output turns fully)
  check: max distance between coupler points: cognate 2 4.41e-13 mm, cognate 3 7.21e-12 mm
```

**Interpretation.**
- p = 50, b = 100, δ = 30° → k = 0.5·e^(i30°) = 0.433 + 0.25i. O6 = k·100 mm = (43.30, 25.00) mm.
- Cognate 2 = original × 0.5 with links reordered: 50, 15, 40, 50 mm. |1 − k| = |0.567 − 0.25i| = 0.6197 → cognate 3:
  61.97, 49.57, 18.59, 61.97 mm.
- The cognates draw the same curve to 10⁻¹² mm (numerical noise). The program proves Roberts' law on your linkage.
- The **Grashof type changes** between cognates: original crank-rocker, cognate 2 double-rocker, cognate 3
  rocker-crank (its link at O6 turns fully). Rule (Norton ch. 3 – check there): if the original is a Grashof
  crank-rocker, one cognate is also drivable by a full crank – here cognate 3 driven at O6. A double-rocker cognate can only trace part of the curve
  when driven by a motor.
- Timing: the cognates trace the curve with **different timing** unless the input is geared. To get the same timing
  you drive cognate 2's crank with the same speed as the original coupler – in practice by gears or a belt between
  links (Norton calls these geared five-bar equivalents). For path-only jobs timing does not matter.

**Practice.** Use cognates when the pivot location is the problem – e.g. the original pivot O4 would sit inside the
conveyor frame; cognate 3 uses O4 and O6 instead of O2 and O4. Before you build, check the cognate's transmission angle
and branch (chapter 4) – a cognate is a new linkage.

**MATLAB:**
```matlab
k=(50/100)*exp(1i*deg2rad(30)); O6=k*100;          % expect 43.301 + 25.000i
L2=abs(k)*[100 30 80 100]                          % cognate 2: 50 15 40 50
L3=abs(1-k)*[100 80 30 100]                        % cognate 3: 61.966 49.573 18.590 61.966
```

**Check questions.** (1) Which cognate uses the original O2 and O4 – none, one or two? (2) Why does a cognate have the
same path but not always the same timing? (3) Prove that cognate 2's ground equals |k|·d.

### 5.6 Coupler curves for conveyor and transfer motions – design procedure

1. Sketch the wanted path (start, end, lift height, clearance to the frame) and the timing (how many degrees of crank
   turn for transfer, return, dwell).
2. Choose a linkage family: Hoeken-type for straight strokes, cusp curves for soft pick-up, dwell six-bar for a stop.
3. Search coupler points with `curve_shape()` (digital atlas) or synthesise with chapter 6 (3 poses).
4. Check: Grashof (motor drive), transmission angle ≥ 40° (chapter 4), branch, dynamics and pin forces (chapter 7).
5. Check cognates if pivots do not fit the frame.
6. Run `fourbar.py run` → `coupler_curve.svg`, check clearances in SOLIDWORKS with the exported link lengths.
7. Tolerances: link lengths and pin clearance shift the path (chapter 9). Plan one adjustable link (slotted or eccentric
   pin) for fine-tuning at commissioning.

---

## 6 Synthesis – from the task to the link lengths

> Program: `tools/fourbar.py`. Base functions: `freudenstein_synthesis()`, `chebyshev_points()`,
> `function_generator_example()`, `crank_rocker_Q1()`, `limit_positions()`, `transmission_angle()`.
> Added for this chapter: `dyad_standard_form()`, `motion_generation_3pos()`, `quick_return()`, `quick_return_best()`,
> `fg_eval()`, `fg_optimise()`, `slope_ratio()`. All results: `python fourbar.py ch56`.

### 6.1 The three kinds of synthesis

**Analysis** = links given → find the motion (chapters 3–4). **Synthesis** = motion given → find the links.

| Step | Question | Example |
|---|---|---|
| Type synthesis | Which mechanism type? Linkage, cam, gears, belt, servo? | Repeating swing at fixed timing → linkage or cam |
| Number synthesis | How many links and joints? (Gruebler: DOF = 3(n − 1) − 2·j1 − j2) | 4 links, 4 pin joints: DOF = 3·3 − 2·4 = 1 → one motor drives it |
| Dimensional synthesis | Which lengths and pivot positions? | This chapter |

Dimensional synthesis has three task types:

| Task | What is prescribed | Method in this chapter |
|---|---|---|
| **Function generation** | Output angle as a function of input angle: θ4 = f(θ2) | Freudenstein equation (6.4) |
| **Path generation** | Coupler point passes given points (timing free or prescribed) | Coupler curves (ch. 5), optimisation (6.6) |
| **Motion generation** | The coupler body passes given **poses** (position + angle) | Dyad standard form (6.2) |

**Precision points** are the positions where the linkage is exact. Between them there is a **structural error**.
With the closed-form methods here you get 2 or 3 precision points; more points need optimisation.

### 6.2 Motion generation: two and three positions

**Graphical 2-position (rocker output).** Two positions B1, B2 of a rocker pin are given. Any point on the perpendicular
bisector of B1B2 can be the rocker pivot O4. For a crank-rocker with Q = 1, put the crank pivot O2 on the line through
B1 and B2 (6.3). Simple, and it shows the freedom you have: one task, an infinite number of solutions.

**Graphical 3-position motion generation.** The coupler must pass three poses (a part in three positions).
Choose two points A and B on the moving part. Draw A1, A2, A3 and B1, B2, B3. The centre of the circle through A1, A2, A3
is the ground pivot O2 – construct it with the perpendicular bisectors of A1A2 and A2A3. The same for B → O4. Then
a = |O2A1|, c = |O4B1|, b = |A1B1|, d = |O2O4|. Different choices of A and B give different linkages.

**Analytical 3-position motion generation (Erdman–Sandor standard form).** Each side of the linkage is a **dyad**:
a ground link W (pivot → moving joint) and a vector Z (moving joint → coupler point P). In pose j the dyad has turned:
W by β_j (link rotation, chosen freely) and Z by α_j (the coupler rotation, given by the task). The coupler point moves
by δ_j = P_j − P_1. Loop for pose 1 and pose j:

  pivot + W + Z = P_1    and    pivot + W·e^(iβj) + Z·e^(iαj) = P_j

Subtract:

  **W·(e^(iβj) − 1) + Z·(e^(iαj) − 1) = δ_j**,  j = 2, 3

Two complex equations, two complex unknowns (W, Z) – linear! Choose β2, β3, solve the 2×2 complex system (Cramer).
Do it twice – once for the left dyad (crank), once for the right dyad (rocker), with different free choices:

```
┌────────────────────────────────────────────────────────────────────────────┐
│ W (e^(iβj) − 1) + Z (e^(iαj) − 1) = δj ,  j = 2, 3     (complex, linear)     │
│ given: δj = Pj − P1, αj = γj − γ1 ;  free: β2, β3                            │
│ moving joint A1 = P1 − Z ;  ground pivot O = A1 − W                          │
│ links: a = |W_L|, c = |W_R|, b = |A1 − B1|, d = |O2 − O4|                     │
└────────────────────────────────────────────────────────────────────────────┘
```

**In the program:**
```python
def dyad_standard_form(deltas, alphas, betas):
    a11, a12 = cmath.exp(1j * betas[0]) - 1, cmath.exp(1j * alphas[0]) - 1
    a21, a22 = cmath.exp(1j * betas[1]) - 1, cmath.exp(1j * alphas[1]) - 1
    det = a11 * a22 - a12 * a21
    W = (deltas[0] * a22 - a12 * deltas[1]) / det
    Z = (a11 * deltas[1] - deltas[0] * a21) / det
    return W, Z
```
`motion_generation_3pos()` solves both dyads, builds the linkage, and then makes an **independent analysis**: it
assembles the linkage with `position_general()`, turns the crank by β2 and β3 and measures where the coupler point and
the coupler angle really are.
```python
    WL, ZL = dyad_standard_form(deltas, alphas, betas_left)
    WR, ZR = dyad_standard_form(deltas, alphas, betas_right)
    A1, B1 = P1 - ZL, P1 - ZR
    O2, O4 = A1 - WL, B1 - WR
    a, c = abs(WL), abs(WR)
    b, d = abs(B1 - A1), abs(O4 - O2)
    kP = (P1 - A1) / (B1 - A1)
```

**Example (example values) – pick-and-place.** A gripper must pass three poses: P1 = (0, 0) mm at 0°, P2 = (60, 40) mm
at 20°, P3 = (120, 50) mm at 45°. Free choices: crank rotations β = 120°, 200°; rocker rotations 20°, 10°. (These
choices came from a scan of all β in 10° steps; the program kept compact Grashof crank-rockers with all links
15–250 mm and selected the best transmission angle.)

**Run it:**
```
## 6.2 Three-position motion generation (pick-and-place poses, mm / deg)
  free choices: left dyad (crank) beta2 120, beta3 200 deg; right dyad (rocker) beta2 20, beta3 10 deg
  O2 (36.574, 233.804), O4 (-83.426, 190.138), A1 (58.746, 215.196), B1 (19.639, 155.207)
  links: crank a 28.947, coupler b 71.611, rocker c 108.823, ground d 127.697 mm; branch 1; Grashof crank-rocker
  rocker angle at the 3 poses: -18.72, 1.28, -8.72 deg; swing 30.85 deg; min transmission angle 61.0 deg
  pose 1: position error 1.21e-13 mm, angle error 2.54e-14 deg
  pose 2: position error 9.66e-14 mm, angle error 2.54e-14 deg
  pose 3: position error 6.36e-14 mm, angle error 2.54e-14 deg
```

**Interpretation.**
- The analysis finds the three poses with errors of 10⁻¹³ mm – the synthesis is exact at the precision poses.
- The result is a Grashof crank-rocker (a 28.9, b 71.6, c 108.8, d 127.7 mm): a motor can drive it continuously.
  Transmission angle never below 61° – very good.
- **Order check**: the crank reaches the poses at 0°, 120°, 200° – one direction, increasing → no order defect.
  The rocker goes −18.72° → +1.28° → −8.72°: it swings forward and comes back, which is allowed (a rocker can reverse).
- The coupler point P is not at a joint: it is defined by kP = (P1 − A1)/(B1 − A1). The gripper sits on a bracket on
  the coupler.
- With other free choices (for example β = 40°, 80° / 25°, 60°) the same method gives a non-Grashof linkage with an
  883 mm coupler – correct at the poses, useless in the machine. **Synthesis gives candidates; the checks choose.**

**MATLAB:**
```matlab
P=[0, 60+40i, 120+50i]; g=deg2rad([0 20 45]);
dlt=P(2:3)-P(1); al=g(2:3)-g(1);
dyad=@(be) [exp(1i*be(:))-1, exp(1i*al(:))-1] \ dlt(:);   % [W; Z]
L=dyad(deg2rad([120 200])); R=dyad(deg2rad([20 10]));
A1=P(1)-L(2); B1=P(1)-R(2); O2=A1-L(1); O4=B1-R(1);
[abs(L(1)) abs(B1-A1) abs(R(1)) abs(O4-O2)]               % expect 28.947 71.611 108.823 127.697
```

**Check questions.** (1) How many free choices does the 3-position method have per dyad? (2) Why do we check the
result by analysis, if the equations are exact? (3) What is an order defect?

### 6.3 Crank-rocker for a given swing: Q = 1 and quick return Q > 1

**Theory – time ratio.** A crank-rocker has two limit positions: crank and coupler **extended** in one line
(O2B = b + a) and **folded** (O2B = b − a). Between them the crank turns 180° + α one way and 180° − α the other way.
The time ratio is

  Q = (180° + α) / (180° − α)   →   **α = 180°·(Q − 1)/(Q + 1)**

(solve the first equation for α). Q = 1 → α = 0: forward and return take the same time. Q = 1.5 → α = 36°: the work
stroke takes 216° of crank turn, the return only 144° (quick return).

**Derivation – Q = 1 (`crank_rocker_Q1()`).** Put the rocker pivot O4 at the origin and the two rocker extremes B1, B2
symmetric about a middle line, |O4B| = c, angle ψ between them. For α = 0 the two crank directions at the limits are
exactly opposite, so O2, B1, B2 lie on one line. Put O2 on the line B1B2 extended, a distance L beyond B1:
O2B1 = b − a = L, O2B2 = b + a = L + |B1B2|. Subtract: 2a = |B1B2| → **a = |B1B2|/2 = c·sin(ψ/2)**, **b = L + a**,
**d = |O2O4|**. L is your free choice.

**Derivation – Q > 1 (`quick_return()`).** Now the crank directions at the limits differ by 180° − α, which means the
angle B1–O2–B2 = α. All points that see the chord B1B2 under the same angle α lie on a circle through B1 and B2
(inscribed-angle theorem). Its radius follows from chord = 2·R·sin α:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ α = 180° (Q − 1)/(Q + 1)                                                       │
│ |B1B2| = 2 c sin(ψ/2)                                                          │
│ circle for O2: R_c = |B1B2| / (2 sin α), centre at R_c cos α from the chord     │
│ a = | |O2B2| − |O2B1| | / 2 ,   b = (|O2B1| + |O2B2|)/2 ,   d = |O2 O4|          │
│ Q = 1: O2 on line B1B2,  a = c sin(ψ/2),  b = L + a                             │
└──────────────────────────────────────────────────────────────────────────────┘
```
Every point on the correct arc of that circle is a solution. Not every point is good: some give a tiny crank, some put
B1 and B2 on opposite sides of the line O2O4 (then the real linkage cannot reach both extremes in one assembly), some
give bad transmission angles. `quick_return_best()` scans the circle (both mirror circles, 1° steps), keeps only
designs that a **separate analysis** (`limit_positions()`) confirms – swing and Q exactly as asked – and picks the best
minimum transmission angle.

**In the program:**
```python
    al = math.radians(180.0 * (Q - 1) / (Q + 1))
    h = math.radians(psi_deg) / 2
    m = math.radians(theta4_mid_deg)
    B1 = c * cmath.exp(1j * (m + h))
    B2 = c * cmath.exp(1j * (m - h))
    chord = abs(B1 - B2)
    Rc = chord / (2 * math.sin(al))
    M = (B1 + B2) / 2
    n = (B1 - B2) / chord * 1j
    centre = M + side * n * Rc * math.cos(al)
    O2 = centre + Rc * cmath.exp(1j * math.radians(s_deg))
    L1, L2 = abs(O2 - B1), abs(O2 - B2)
    return {"alpha_deg": math.degrees(al), "Rc": Rc, "centre": centre, "O2": O2, "B1": B1, "B2": B2,
            "a": abs(L2 - L1) / 2, "b": (L1 + L2) / 2, "c": c, "d": abs(O2)}
```

**Example (example values).** Rocker c = 80 mm, swing ψ = 50°. Q = 1 with L = 70 mm; Q = 1.2 and 1.5 by scanning.

**Run it:**
```
## 6.3 Crank-rocker Q = 1 (crank_rocker_Q1) and quick return Q > 1
  Q = 1: a 33.809 b 103.809 c 80.000 d 126.623; check swing 50.000, Q 1.00000; min transmission angle 59.0 deg
  Q = 1.2: alpha 16.364 deg, circle R 120.006 mm; 438 valid positions; best side +1, s 129 deg:
           a 32.198 b 79.302 c 80.000 d 90.918 mm; check swing 50.0000 deg, Q 1.20000; min transmission angle 43.3 deg
  Q = 1.5: alpha 36.000 deg, circle R 57.520 mm; 322 valid positions; best side +1, s 156 deg:
           a 29.814 b 59.589 c 80.000 d 72.098 mm; check swing 50.0000 deg, Q 1.50000; min transmission angle 31.1 deg
```

**Interpretation.**
- Q = 1: a = 80·sin 25° = 33.809 mm. Checked by analysis: swing 50.000°, Q = 1.00000, μ_min 59°.
- Hand check of Q = 1.2: α = 180·0.2/2.2 = 16.364°; chord = 2·80·sin 25° = 67.62 mm; R_c = 67.62/(2·sin 16.364°) =
  120.0 mm ✓.
- **The price of quick return**: the best transmission angle falls from 59° (Q = 1) to 43° (Q = 1.2) and 31° (Q = 1.5).
  31° is below the usual 40° rule (chapter 4): the Q = 1.5 linkage will run, but with high pin forces and sensitivity
  to friction near that position. For Q ≥ 1.5 with a 50° swing, use a six-bar or a cam.
- "Valid positions" counts the circle points that passed all checks – the designer still has hundreds of choices;
  pick by space, pivot location and transmission angle.

**Practice.** Quick return is used where a work stroke (cutting, pressing, pushing a part) should be slow and the
return fast: shapers, some feeders, packaging pushers. The motor must be sized for the peak torque of the work
stroke (chapter 7 dynamics).

**MATLAB:**
```matlab
Q=1.2; c=80; psi=50; al=pi*(Q-1)/(Q+1);              % 16.364 deg
B1=c*exp(1i*deg2rad(90+psi/2)); B2=c*exp(1i*deg2rad(90-psi/2));
Rc=abs(B1-B2)/(2*sin(al))                           % expect 120.006 mm
```

**Check questions.** (1) What is α for Q = 1.3? (2) Why does a higher Q lower the best transmission angle?
(3) Why must B1 and B2 be on the same side of line O2O4?

### 6.4 Function generation – the Freudenstein equation

**Task.** The output angle must follow a function of the input: θ4 = f(θ2). Classic examples: a linkage that "computes"
log x for an analogue instrument, a throttle linkage with a non-linear response, a valve lever whose opening follows
a wanted curve.

**Derivation.** Loop closure: a·e^(iθ2) + b·e^(iθ3) = d + c·e^(iθ4). Isolate the coupler (the unknown θ3):

  b·e^(iθ3) = d + c·e^(iθ4) − a·e^(iθ2)

Take the squared magnitude of both sides (|z|² = z·z̄). θ3 disappears because |e^(iθ3)| = 1:

  b² = a² + c² + d² + 2cd·cos θ4 − 2ad·cos θ2 − 2ac·cos(θ2 − θ4)

Divide by 2ac and rearrange:

  **R1·cos θ4 − R2·cos θ2 + R3 = cos(θ2 − θ4)**,  R1 = d/a, R2 = d/c, R3 = (a² − b² + c² + d²)/(2ac)

This is linear in R1, R2, R3. Three precision pairs (θ2j, θ4j) give a **3 × 3 linear system**. Solve, then
a = d/R1, c = d/R2, b² = a² + c² + d² − 2ac·R3 (d = 1 or any scale). A negative a or c only means that link points
the other way (add 180° to its angle) – the program handles this.

**Mapping the function to angles.** x from x0 to x1 maps linearly to θ2 from θ20 over Δθ2; y = f(x) maps to θ4 from
θ40 over Δθ4:
  θ2 = θ20 + (x − x0)/(x1 − x0)·Δθ2 ,  θ4 = θ40 + (y − y0)/(y1 − y0)·Δθ4

**Chebyshev spacing.** Where to put the three precision points? Chebyshev spacing makes the error peaks
(roughly) equal:
  x_j = (x0 + x1)/2 − (x1 − x0)/2·cos((2j − 1)π / (2n)),  j = 1 … n

```
┌──────────────────────────────────────────────────────────────────────────┐
│ R1 cos θ4 − R2 cos θ2 + R3 = cos(θ2 − θ4)     (Freudenstein)              │
│ R1 = d/a,  R2 = d/c,  R3 = (a² − b² + c² + d²)/(2ac)                        │
│ 3 precision points → 3×3 linear system → R1, R2, R3 → a, c, b              │
│ Chebyshev: x_j = (x0+x1)/2 − (x1−x0)/2 · cos((2j−1)π/(2n))                 │
│ structural error e(x) = y_generated(x) − f(x)   (0 at the precision points)│
└──────────────────────────────────────────────────────────────────────────┘
```

**In the program:**
```python
def chebyshev_points(x0, x1, n=3):
    return [(x0 + x1) / 2 - (x1 - x0) / 2 * math.cos((2 * j - 1) * math.pi / (2 * n)) for j in range(1, n + 1)]

def freudenstein_synthesis(pairs, d=1.0):
    A = [[math.cos(t4), -math.cos(t2), 1.0] for t2, t4 in pairs]
    rhs = [math.cos(t2 - t4) for t2, t4 in pairs]
    R1, R2, R3 = solve_linear(A, rhs)
    a = d / R1
    c = d / R2
    b2 = a * a + c * c + d * d - 2 * a * c * R3
    if b2 <= 0:
        return None
    off2 = math.pi if a < 0 else 0.0
    off4 = math.pi if c < 0 else 0.0
    return {"R": (R1, R2, R3), "a": abs(a), "b": math.sqrt(b2), "c": abs(c), "d": d,
            "a_signed": a, "c_signed": c, "off2": off2, "off4": off4}
```
`function_generator_example()` maps y = log10 x, synthesises, then **analyses** the linkage at 101 points with
`position()` to get the structural error and the transmission angle – and reports a defect if the linkage cannot be
assembled somewhere.

**Run it** (`python fourbar.py examples` and `ch56`):
```
## Function generator y = log10(x), 1..10 (Chebyshev, Freudenstein, d = 1); input 90 deg from 30, output 45 deg from 120
  precision x: 1.6029, 5.5000, 9.3971
  (theta2, theta4) deg: (36.029, 129.221), (75.000, 153.316), (113.971, 163.785)
  a 1.9095, b 1.4253, c 1.3923, d 1.0000 (signed a 1.9095, c 1.3923), branch -1
  max structural error |dy| 0.06345 = 6.345 % of output range; min transmission angle 48.5 deg
  error curve (x: dy): 1.00: +0.06345, 1.90: -0.01220, 2.80: -0.02093, 3.70: -0.01493, 4.60: -0.00677, 5.50: +0.00000,
                       6.40: +0.00445, 7.30: +0.00637, 8.20: +0.00567, 9.10: +0.00200, 10.00: -0.00559
## 6.4 Function generation y = log10 x: range effect
  x 1..2: slope ratio f'(x0)/f'(x1) 2.00, max error 0.234 % of output range, min mu 43.5 deg
  x 1..10: slope ratio f'(x0)/f'(x1) 10.00, max error 6.345 % of output range, min mu 48.5 deg
```

**Interpretation.**
- Error is zero at x = 5.5 (a precision point) and changes sign at the other precision points – typical.
- The largest error (+0.063, 6.3 % of the output range) is at x = 1, the start of the range. log10 is most curved
  there.
- **Why does the error grow from 0.234 % (x 1..2) to 6.345 % (x 1..10)?** A four-bar can make only a limited "bend"
  between input and output. The slope ratio f'(x0)/f'(x1) measures how much the function bends: 2.0 for x 1..2, 10.0
  for x 1..10. With three precision points the linkage matches three values of the function; the rest of the shape
  must come from the linkage's own natural curve. The more the wanted curve bends, the larger the gap.
- Why these angles (input 90° from 30°, output 45° from 120°)? The angle ranges and start angles are **free
  choices** of the designer. They were found by a scan (start angles in 10° steps, ranges 60/90/120° and 45/60/90°)
  that kept linkages that work over the whole range with good transmission angle. Other choices give other linkages
  – or defects (6.5).

**MATLAB:**
```matlab
x=1+4.5-4.5*cos((2*(1:3)-1)*pi/6);                 % 1.6029 5.5 9.3971
t2=deg2rad(30)+(x-1)/9*deg2rad(90); t4=deg2rad(120)+log10(x)*deg2rad(45);
R=[cos(t4(:)) -cos(t2(:)) ones(3,1)] \ cos(t2(:)-t4(:));
a=1/R(1); c=1/R(2); b=sqrt(a^2+c^2+1-2*a*c*R(3));  % expect 1.9095 1.4253 1.3923
```

**Check questions.** (1) Why does θ3 disappear in the derivation? (2) Where is the structural error zero? (3) Give
the Chebyshev points for x 2..4 with n = 3.

### 6.5 Defects: branch (circuit), order and Grashof

The equations of synthesis only know the precision points. They do not know if the real linkage can move from one
point to the next. Three defects:

| Defect | What happens | How to detect |
|---|---|---|
| **Branch (circuit) defect** | The precision points lie on different assembly branches (open / crossed), or the linkage cannot be assembled between them. You would have to take it apart to reach the next point | Analyse the linkage over the full range on one branch (`position()` returns None, or the angle jumps) |
| **Order defect** | The linkage reaches the points, but in the wrong order (2 before 1) for the crank direction | Check that the input angles at the precision points increase in the driving direction |
| **Grashof defect** | A motor should drive a full crank, but the result is non-Grashof (no link turns fully) | `grashof()` |

**Run it:**
```
  defect example (45, 135, 60, 90): links 0.4993 2.2018 1.4314 1.0000, defect at x = 1.00, branch 1
```
With input 60° from 45° and output 90° from 135°, Freudenstein gives a = 0.4993, b = 2.2018, c = 1.4314, d = 1. The
linkage passes the three precision points exactly. But at x = 1.00 (the start of the range) it **cannot be
assembled** – the distance from A to O4 is larger than b + c. The task is only reachable at the precision points.
This is exactly why every synthesis in the program ends with an analysis over the whole range.

**After every synthesis – the check list:**
1. Branch: assemblable over the whole working range on one branch.
2. Order: precision points reached in the right sequence.
3. Grashof: motor-driven crank really turns fully.
4. Transmission angle ≥ 40° (≥ 30° only for light loads, slow speed).
5. Link lengths practical (ratio longest/shortest ≤ about 6–8, pivots inside the frame).
6. Dynamics and pin forces (chapter 7), tolerances (chapter 9).

### 6.6 Optimisation-based synthesis

**Theory.** Closed-form methods give exactness at 2–3 points and accept the error elsewhere. Often you do not need
exactness anywhere – you need the **smallest maximum error** over the whole range, and constraints such as
μ ≥ 40°. This is an optimisation problem (M1 chapter 29):

  minimise  E(x) = max over the range |y_generated − f|   (minimax)
  subject to  μ_min ≥ 40°, no defect

The design variables can be link lengths directly, or – smarter – the **positions of the precision points**: each
choice of three points gives a linkage by Freudenstein, so the optimiser moves only 3 numbers and every candidate
is exact somewhere. A penalty adds 10 × (40° − μ_min) when the angle is too small and a large value (10³) for a
defect.

**In the program** (`fg_optimise()`, Nelder–Mead from `dm_toolkit.py`, M1 ch. 29):
```python
    def obj(x):
        xs = sorted(x)
        if xs[0] <= 1.0 or xs[-1] >= 10.0 or min(xs[1] - xs[0], xs[2] - xs[1]) < 0.2:
            return 1e3
        r = fg_eval(xs, t20, t40, dt2, dt4)
        if r is None:
            return 1e3
        return r["err_pct"] + 10 * max(0.0, mu_limit - r["mu_min"])
    start = fg_eval(x_ch, t20, t40, dt2, dt4)
    xbest, fbest = nelder_mead(obj, x_ch, step=0.5, tol=1e-6, itmax=600)
```
`fg_eval()` is the same synthesis + analysis as `function_generator_example()`, but with any three precision points.

**Run it:**
```
## 6.5 Optimised precision points (minimax, mu >= 40 deg)
  Chebyshev x 1.6029, 5.5000, 9.3971 -> error 6.345 %, mu_min 48.5 deg
  optimised x 1.2012, 3.7135, 9.9979 -> error 2.183 %, mu_min 40.0 deg; links 1.5850, 1.1308, 1.3548, 1.0000
```

**Interpretation.**
- The optimiser cuts the maximum error from 6.345 % to **2.183 %** – almost three times better – with the same type of
  linkage.
- The precision points moved towards the curved start of log10 (x = 1.20 instead of 1.60): the error was largest
  there.
- μ_min = 40.0°: the transmission-angle constraint is **active** – the optimiser went as far as it was allowed. If you
  accept μ ≥ 35°, the error would fall further; that is an engineering decision (M1 ch. 8: active constraints decide
  the design).
- Chebyshev spacing is the right **start point** – it is theoretically optimal for polynomials, not for linkages.
- For path generation with more points, use the same idea with link lengths and coupler point as variables
  (5–9 variables) and a GA or multi-start Nelder–Mead (M1 ch. 29), because the error surface has many local minima.

**Practice.** Commercial tools (e.g. Lincages, SAM by Artas, MotionGen – names from memory, check availability and
whether they run offline) do this with a GUI. The program here shows the method so you can check what such a tool
does, and it runs offline.

**MATLAB:**
```matlab
obj=@(x) fgerr(sort(x));                       % fgerr = your version of fg_eval (synthesis + analysis), returns %
xopt=fminsearch(obj,[1.6029 5.5 9.3971]);      % expect about [1.2012 3.7135 9.9979], error about 2.18 %
```

**Check questions.** (1) Why are the precision-point positions better design variables than the link lengths?
(2) What does it mean that μ_min ends exactly at 40.0°? (3) Which constraint would you relax first, and why?

### 6.7 Chapter 5–6 checklist

- [ ] Task type clear: function, path or motion generation?
- [ ] Precision points / poses written with tolerance (how exact must each be?)
- [ ] Synthesis result analysed over the full range (branch, order, Grashof)
- [ ] Transmission angle ≥ 40° over the working range
- [ ] Link-length ratio and pivot positions fit the frame
- [ ] Cognates checked if pivots do not fit
- [ ] Structural error plotted; optimisation used if the closed-form error is too large
- [ ] Dynamics (chapter 7) and tolerances (chapter 9) done before release

### 6.8 Common mistakes

- Taking the synthesis output without analysis – precision points are exact, the motion between them may be
  impossible (6.5).
- Forgetting that a cognate has a different Grashof type and timing.
- Choosing Q > 1.4 with a large swing in a four-bar → transmission angle far below 40°.
- Using a dwell six-bar without checking that link 5 equals the arc radius within the dwell tolerance.
- Reading the nominal straightness of a Hoeken linkage as the machine accuracy – tolerances and pin clearance are
  often larger (chapter 9).

### 6.9 References (chapters 5–6)
- R. L. Norton, *Design of Machinery*, 6th ed., McGraw-Hill (2019) – ch. 3 (graphical synthesis, cognates, straight-line
  and dwell linkages), ch. 5 (analytical synthesis).
- A. G. Erdman, G. N. Sandor, S. Kota, *Mechanism Design: Analysis and Synthesis*, Vol. 1, 4th ed., Prentice Hall (2001)
  – standard form, cognates, structural error.
- F. Freudenstein, "Approximate synthesis of four-bar linkages", *Trans. ASME* 77 (1955) 853–861.
- J. A. Hrones, G. L. Nelson, *Analysis of the Four-Bar Linkage*, MIT Press / Wiley (1951) – coupler-curve atlas.
- J. J. Uicker, G. R. Pennock, J. E. Shigley, *Theory of Machines and Mechanisms*, 5th ed., Oxford (2017).
- VDI 2125 (planar four-bar linkages – transmission angle), VDI 2727 (selection of mechanisms) – titles from memory,
  check the current VDI catalogue.

---

## 6b Path generation – find the linkage for a REQUIRED TRACK

> New in M2b. Programs: `path_generation_3pt()`, `path_3pt_search()`, `path_synthesis()`, `path_error()`,
> `path_curve()`, `path_report()`; commands `python fourbar.py path …` and `python fourbar.py ch6b`.
> All tracks are **example values**.

### 6b.1 The problem and the three kinds of synthesis

You have a **required movement track**: a gripper, a transfer finger or a tool must move along given points
(for example "straight 120 mm, then lift 40 mm and come back"). You want the link lengths, the pivot positions and the
coupler point that make the coupler point follow this track.

| Kind | What is prescribed | Exact points possible | Program |
|---|---|---|---|
| Function generation (ch. 6) | Output angle vs input angle | 3 (Freudenstein linear), 5 (nonlinear) | `freudenstein_synthesis()` |
| Motion generation (ch. 6) | Position **and orientation** of the coupler | 3 (dyad form, linear), 5 (Burmester) | `motion_generation_3pos()` |
| **Path generation** (this chapter) | Position of a coupler **point** along a track | 3 with timing (linear), up to **9** in theory (Alt–Burmester problem, nonlinear) | `path_generation_3pt()`, `path_synthesis()` |

**Timing** means: is it prescribed **when** (at which crank angle) the point must be at each track point?
- **Prescribed timing** – e.g. "constant speed on the straight part" or "at crank 0°, 30°, 60° …". Needed when the
  motion must be synchronised with a conveyor or another machine.
- **Unprescribed timing** – only the **shape** of the track matters; the crank angles are free (the point must still pass
  the points in the right order).

Why not always exact? A four-bar with a coupler point has **9 free dimensions** in the plane: O2 (x, y) = 2,
O4 (x, y) = 2, link lengths a, b, c = 3 (d follows from O2 and O4), coupler point (p, δ) = 2 → 9. So at most
9 track points can be met exactly – and the exact solutions are often unusable (wrong order, branch defect, huge links,
bad transmission angle). **In practice you use 3 exact points for simple tasks and optimisation for real tracks**
(many points, with constraints).

### 6b.2 Theory – loop equations of the coupler point

Coupler point P in position j, with the crank dyad (ground pivot O2, crank vector W, coupler vector Z from A to P):

  P_j = O2 + W·e^(iβ_j) + Z·e^(iα_j)

β_j = crank rotation, α_j = coupler rotation from position 1 to j. Subtract position 1 (δ_j = P_j − P_1):

  **W·(e^(iβ_j) − 1) + Z·(e^(iα_j) − 1) = δ_j**  j = 2, 3    (standard form, Erdman–Sandor)

The rocker side (ground pivot O4, rocker vector U, coupler vector S from B to P, rocker rotation γ_j) gives the same form:

  **U·(e^(iγ_j) − 1) + S·(e^(iα_j) − 1) = δ_j**

For 3 points each is a **linear complex 2 × 2 system** (2 complex unknowns, 2 complex equations). Path generation with
prescribed timing: you give δ_j (track) and β_j (timing), you **choose freely** α_j and γ_j → W, Z, U, S follow. Every
free choice gives another linkage, so you can search the free choices for the best transmission angle and size.

### 6b.3 In the program – exact 3-point path generation

```python
def path_generation_3pt(points, betas_deg, alphas_deg, gammas_deg):
    """EXACT path generation through 3 points WITH prescribed timing (Erdman-Sandor standard form).
    points = [P1, P2, P3] (complex or (x, y)) the coupler point must pass.
    betas_deg  = crank rotations from position 1 to 2 and 3 (the timing you prescribe).
    alphas_deg = coupler rotations (free choice), gammas_deg = rocker rotations (free choice).
    Left dyad:  WL (e^(i beta) - 1) + ZL (e^(i alpha) - 1) = delta   (crank O2-A, coupler A-P)
    Right dyad: WR (e^(i gamma) - 1) + ZR (e^(i alpha) - 1) = delta  (rocker O4-B, coupler B-P)
    Returns the linkage and an independent analysis check of the three points."""
    P = [q if isinstance(q, complex) else complex(*q) for q in points]
    deltas = (P[1] - P[0], P[2] - P[0])
    al = [math.radians(v) for v in alphas_deg]
    be = [math.radians(v) for v in betas_deg]
    ga = [math.radians(v) for v in gammas_deg]
    try:
        WL, ZL = dyad_standard_form(deltas, al, be)
        WR, ZR = dyad_standard_form(deltas, al, ga)
    except ZeroDivisionError:
        return {"branch": None, "check_mm": [None] * 3, "grashof": "degenerate (singular dyad equations)"}
    A1, B1 = P[0] - ZL, P[0] - ZR
    O2, O4 = A1 - WL, B1 - WR
    a, b, c, d = abs(WL), abs(B1 - A1), abs(WR), abs(O4 - O2)
    if min(a, b, c, d) < 1e-9:
        return {"branch": None, "check_mm": [None] * 3, "grashof": "degenerate (zero-length link)"}
    kP = (P[0] - A1) / (B1 - A1)
    t21 = cmath.phase(WL)
    br = None
    for bb in (1, -1):
        q = position_general(O2, O4, a, b, c, t21, bb)
        if q and abs(q["B"] - B1) < 1e-6 * max(a, b, c, d):
            br = bb
    check = []
    for j in range(3):
        beta = 0.0 if j == 0 else be[j - 1]
        q = position_general(O2, O4, a, b, c, t21 + beta, br) if br else None
        check.append(None if q is None else abs(q["A"] + kP * (q["B"] - q["A"]) - P[j]))
    return {"O2": O2, "O4": O4, "a": a, "b": b, "c": c, "d": d, "kP": kP, "branch": br, "t2_1_deg": math.degrees(t21),
            "check_mm": check, "grashof": grashof(a, b, c, d)["class"]}
```

**Run it:** `python fourbar.py ch6b` (first block)
```
== 6b.3 exact 3-point path generation, prescribed timing (crank 0 / 60 / 120 deg)
  free choices alpha (-10, 5), gamma (30, 50): a 67.816 b 108.055 c 135.297 d 156.900, O2 (251.47, 77.05), O4 (142.70, 190.12)
  Grashof crank-rocker (input crank turns fully, output rocks); check errors at the 3 points [mm]: 9.0e-14, 1.0e-13, 4.5e-14
  transmission angle 41.1 ... 134.6 deg
  search over free choices: 28 valid crank-rockers (mu >= 40); best worst-case mu 62.3 deg with alpha (0, 10) gamma (20, 30): a 60.83 b 256.93 c 175.15 d 294.95
```
**Interpretation.** The three track points (0, 0), (60, 10), (120, 0) mm are met with an error of ≈ 10⁻¹³ mm (only
rounding) – the independent check assembles the linkage with `position_general()` and turns the crank by the
prescribed 60° and 120°. Your free choices decide the linkage: with α = (−10°, 5°), γ = (30°, 50°) the worst
transmission angle is 41°; the search over 9 × 9 × … choices (`path_3pt_search()`) finds 28 valid crank-rockers and the
best has 62° – much better for force transmission (ch. 4), but with larger links. **Choose with all criteria
(size, μ, pivot places), not only μ.**

```python
def path_3pt_search(points, betas_deg, alpha_range=(-60, 61, 5), gamma_step=5, mu_min=40.0, ratio_max=8.0):
    """Scan the free choices (coupler rotations alpha2, alpha3 = alpha2/2 ... and rocker rotations gamma2 < gamma3)
    of path_generation_3pt and keep exact, assemblable Grashof crank-rockers with the best transmission angle.
    Returns the best solution (or None) and the number of valid candidates."""
    best, n_ok = None, 0
    for a2 in range(*alpha_range):
        for a3 in range(*alpha_range):
            for g2 in range(gamma_step, 120, gamma_step):
                for g3 in range(g2 + gamma_step, 150, gamma_step):
                    q = path_generation_3pt(points, betas_deg, (a2, a3), (g2, g3))
                    if not q["branch"] or any(c is None or c > 1e-6 for c in q["check_mm"]):
                        continue
                    if not q["grashof"].startswith("Grashof crank-rocker"):
                        continue
                    L = (q["a"], q["b"], q["c"], q["d"])
                    if max(L) / min(L) > ratio_max:
                        continue
                    mus = [transmission_angle(math.radians(k), *L) for k in range(0, 360, 5)]
                    m = min(min(mus), 180 - max(mus))
                    if m < mu_min:
                        continue
                    n_ok += 1
                    if best is None or m > best["mu_worst"]:
                        q.update({"mu_worst": m, "alphas": (a2, a3), "gammas": (g2, g3)})
                        best = q
    return best, n_ok
```

### 6b.4 Optimisation-based path synthesis (N points, real tracks)

**Design vector** (9 variables, + 1 with prescribed timing):

  x = [O2x, O2y, a, b, c, d, θ1 (ground angle), px, py (, θ2 of point 1)]

P = A + (px + i·py)·e^(iθ3): px along the coupler AB, py perpendicular.

**Objective** – the root-mean-square distance between the required points T_k and the coupler point:

- unprescribed timing: e_k = min over the coupler curve |P(θ2) − T_k| (nearest point of the curve, 120 / 360 samples);
- prescribed timing: e_k = |P(θ2,1 + τ_k) − T_k| (τ_k = given crank angles).

  **f(x) = √( Σ e_k² / N ) + penalties**

**Constraints (as penalties):**

| Constraint | Why | In `path_error()` |
|---|---|---|
| Grashof crank (input turns fully) | Motor drive, continuous cycle | 10⁸ + … if not crank-rocker / double-crank |
| Assemblable over the full turn | No branch defect | 10⁷ if `path_curve()` breaks |
| μ within [μ_min, 180° − μ_min] (default 40°) | Force transmission, no jamming | Σ (violation)² over the turn |
| Link ratio ≤ 8 | Practical proportions | 10⁹ |
| Size ≤ factor × track size (default 2.5) | Fits in the machine; keeps the search space small | 10⁶ + 10³ × excess |
| Targets in the given order (unprescribed timing) | The tool must not jump back along the track | 10³ per extra wrap |

**Search:** the problem has many local minima, so a **global** method starts (real-coded genetic algorithm: tournament of
3, BLX-0.5 crossover, 15 % Gaussian mutation, 2 elites; 60 designs × 120 generations, both assembly branches), then
**Nelder–Mead** refines (3 restarts, 360 curve samples). This is the method of M1 chapter 29 (GA + local refinement).

```python
def path_error(x, targets, branch, timing=None, mu_min=40.0, n=180, ratio_max=8.0, need_crank=True, max_link=None):
    """Objective of path synthesis: RMS distance of the targets to the coupler curve (mm) + penalties.
    timing = None  -> unprescribed timing: each target uses its nearest curve point; the targets must be met in
                      their given order along the curve (at most one wrap per turn);
    timing = [deg] -> prescribed crank angles relative to target 1; theta2 of target 1 is x[9]."""
    O2, O4, a, b, c, d, kp = _path_linkage(x)
    if min(a, b, c, d) <= 0 or max(a, b, c, d) / min(a, b, c, d) > ratio_max:
        return 1e9, None
    if max_link is not None:                 # size limit (links, coupler point, pivots near the track)
        over = max(0.0, max(a, b, c, d, abs(kp)) - max_link)
        if over > 0:
            return 1e6 + 1e3 * over, None
    g = grashof(a, b, c, d)
    if need_crank and not (g["class"].startswith("Grashof crank-rocker") or g["class"].startswith("Grashof double-crank")):
        return 1e8 + 1e6 * max(0.0, g["s+l-(p+q)"]), None
    pen = 0.0
    for k in range(0, 360, 10):              # transmission angle over the full turn
        mu = transmission_angle(math.radians(k), a, b, c, d)
        pen += max(0.0, mu_min - mu) ** 2 + max(0.0, mu - (180 - mu_min)) ** 2
    T = [complex(*t) for t in targets]
    if timing is None:
        curve = path_curve(x, branch, n)
        if not curve:
            return 1e7, None
        idx, d2 = [], 0.0
        for t in T:
            j = min(range(len(curve)), key=lambda i: abs(curve[i][1] - t))
            idx.append(j)
            d2 += abs(curve[j][1] - t) ** 2
        fwd = sum(1 for i in range(len(idx)) if idx[(i + 1) % len(idx)] < idx[i])
        bwd = sum(1 for i in range(len(idx)) if idx[(i + 1) % len(idx)] > idx[i])
        pen += 1e3 * max(0, min(fwd, bwd) - 1)          # order kept (either running direction of the crank)
        return math.sqrt(d2 / len(T)) + pen, {"idx": idx, "curve": curve}
    d2 = 0.0
    for t, tau in zip(T, timing):
        q = position_general(O2, O4, a, b, c, x[9] + math.radians(tau), branch)
        if q is None:
            return 1e7, None
        d2 += abs(q["A"] + kp * (q["B"] - q["A"]) / b - t) ** 2
    return math.sqrt(d2 / len(T)) + pen, {}
```

**Run it – your own track:**
```
python fourbar.py pathparams > track.json      # edit "track_mm", "timing_deg", "mu_min_deg", "max_link_factor"
python fourbar.py path --in track.json --out my_track
python fourbar.py run --in my_track/linkage_for_run.json --out my_track_analysis
```
The first command gives this input (the D-track of 6b.7):
```json
{
  "name": "pick-and-place D-track: straight transfer 120 mm, lift and return 40 mm",
  "track_mm": [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0], [128, 18], [110, 36], [60, 42], [10, 36], [-8, 18]],
  "timing_deg": null,
  "mu_min_deg": 40.0,
  "max_link_factor": 2.5,
  "generations": 120
}
```
`timing_deg`: `null` = unprescribed; or a list of crank angles (same length as the track, first = 0) for prescribed
timing. The `path` command writes `path_report.md`, `path.svg` (track and coupler curve and the linkage) and
`linkage_for_run.json` – the result in the standard frame, ready for the full analysis of chapters 3–9 (velocities,
torque, pin forces, tolerances). Placement in your machine = the printed O2, O4 and ground angle.

### 6b.5 Example 1 – straight track with prescribed timing (constant speed)

**Run it:** `python fourbar.py ch6b` (second block)
```
== 6b.5 timed straight track: 5 points 30 mm apart at crank steps of 30 deg
# Path synthesis result
- linkage: a 59.28, b 92.46, c 180.41, d 183.94 mm, branch -1 -> Grashof crank-rocker (input crank turns fully, output rocks)
- frame: O2 (-23.30, 83.82) mm, O4 (63.47, 246.01) mm, ground angle 61.85 deg
- coupler point: p 120.10 mm at delta -38.19 deg from AB
- track error: RMS 0.815 mm, max 1.093 mm (track size 120.0 mm -> max 0.91 %)
- transmission angle 40.0 ... 122.8 deg
- point errors [mm]: 0.565, 1.071, 0.654, 1.093, 0.483
```
Five points 30 mm apart at equal crank steps of 30° = the coupler point should move with almost constant speed along a
straight line of 120 mm. Result: max error 1.09 mm (0.9 % of the stroke) with μ ≥ 40°. Good enough for a transfer
finger with a lead-in chamfer; for ± 0.1 mm use a linear axis or a cam (M6).

### 6b.6 Example 2 – test with a track that has an exact solution

The track is 10 points of the coupler curve of a known linkage (30 / 100 / 80 / 100 mm, coupler point 60 mm at 40°).
**Run it:** third block
```
== 6b.6 track taken from a known linkage (10 points) - an exact solution exists
  points: (27.3, 59.9), (36.2, 76.4), (28.9, 85.2), (12.3, 84.5), (-5.2, 74.5), (-17.5, 58.7), (-21.8, 42.3), (-17.9, 30.8), (-7.1, 29.2), (9.0, 40.4)
# Path synthesis result
- linkage: a 26.13, b 68.29, c 108.85, d 97.70 mm, branch +1 -> Grashof crank-rocker (input crank turns fully, output rocks)
- frame: O2 (10.04, 16.47) mm, O4 (85.54, -45.53) mm, ground angle -39.40 deg
- coupler point: p 45.38 mm at delta 56.64 deg from AB
- track error: RMS 0.167 mm, max 0.246 mm (track size 58.0 mm -> max 0.42 %)
- transmission angle 40.0 ... 85.5 deg
- point errors [mm]: 0.079, 0.199, 0.213, 0.246, 0.214, 0.208, 0.157, 0.075, 0.054, 0.066
```
The optimiser does **not** return the original linkage but **another** one with 0.25 mm maximum error (0.4 %). This is
normal: many linkages (cognates, ch. 5, and near-solutions) trace almost the same curve. The program found a solution
that also meets μ ≥ 40° everywhere. **Proof that the method works** – the self-test repeats this case.

### 6b.7 Example 3 – D-track for pick-and-place (unprescribed timing)

**Run it:** fourth block (= `python fourbar.py path`)
```
== 6b.7 D-track for pick-and-place (PATH_EXAMPLE, unprescribed timing)
# Path synthesis result
- linkage: a 61.17, b 108.28, c 184.63, d 184.97 mm, branch -1 -> Grashof crank-rocker (input crank turns fully, output rocks)
- frame: O2 (128.50, -19.39) mm, O4 (64.91, -193.09) mm, ground angle -110.11 deg
- coupler point: p 83.74 mm at delta -29.53 deg from AB
- track error: RMS 1.547 mm, max 3.283 mm (track size 136.0 mm -> max 2.41 %)
- transmission angle 40.3 ... 111.7 deg
- point errors [mm]: 1.356, 0.613, 0.631, 1.630, 1.422, 0.857, 0.660, 1.554, 3.283, 1.506
  same track without a practical size limit (factor 10): max link 618.8 mm, RMS 13.179 mm, max 20.246 mm
```
**Interpretation.**
- RMS 1.55 mm, max 3.28 mm on a 136 mm track (2.4 %). The straight transfer part (points 1–5) is within 0.6–1.6 mm.
  The largest error is at the corner of the return arc (point 9) – corners are hard for a smooth coupler curve.
- Links ≤ 185 mm, μ 40.3 … 111.7° – a practical crank-rocker driven by a gearmotor.
- **Without the size limit** (factor 10) the search space is too large: the GA ends with 619 mm links and 13 mm RMS error.
  **Good bounds are part of the method**, not a detail.
- To improve: more points on the critical parts (weights), round the corners of the required track (a real tool cannot
  follow a sharp corner at speed anyway), more generations (`"generations": 300`), or a six-bar / cam if ± 0.5 mm is
  required everywhere.

### 6b.8 Real manufacturing / practice

1. **Track definition:** take the track from the process (gripper approach, clearance to the fixture, place position).
   Mark which points are **critical** (pick, place) and which only need clearance. Put more points on critical parts.
2. **Tolerance band:** compare the result error with the allowed band (e.g. ± 1 mm for a gripper with a V-centring jaw).
3. **Check the whole cycle:** run `fourbar.py run` on `linkage_for_run.json` – velocities, accelerations, torque, pin
   forces, tolerances (ch. 7–9). A track with a sharp turn gives high accelerations at the coupler point.
4. **Make it adjustable:** a slotted or eccentric pivot (O4) or a turnbuckle on the coupler lets the fitter correct the
   track by ± 2–3 mm at commissioning – cheaper than tight tolerances (ch. 9).
5. **Verify in CAD/MBD:** build the linkage in SOLIDWORKS Motion with the printed pivots, add a trace path of the coupler
   point and overlay the required track (sketch points) – the difference must equal the program's point errors (± 0.1 mm).
6. **When a four-bar is not enough:** six-bar linkages (Watt / Stephenson) give more free parameters; a cam-driven
   linkage or a servo axis gives exact tracks and timing.

### 6b.9 MATLAB equivalent (sketch, uses the Global Optimization Toolbox)
```matlab
% x = [O2x O2y a b c d th1 px py]; targets T (N x 2) in mm
obj  = @(x) path_error_m(x, T, +1, 40);           % write path_error_m like path_error() above (nearest curve point)
lb   = [cx-2.5*L cy-2.5*L 0.1*L 0.3*L 0.3*L 0.3*L -pi -2*L -2*L];
ub   = [cx+2.5*L cy+2.5*L 1.5*L 2.5*L 2.5*L 2.5*L  pi  2*L  2*L];
opts = optimoptions('ga','PopulationSize',60,'MaxGenerations',120,'HybridFcn',@fminsearch);
[x, f] = ga(obj, 9, [], [], [], [], lb, ub, [], opts);
```

### 6b.10 Check questions
1. Why can a four-bar meet at most 9 track points exactly, and why do we still use optimisation with 10 or more points?
2. What is the difference between prescribed and unprescribed timing? Give one example of each in your factory.
3. In 6b.3, which free choices did you have, and why do different choices give different linkages?
4. Why did the D-track get a worse result when the size limit was removed?
5. Your gripper needs ± 0.5 mm on the place position but only clearance elsewhere – how do you set up the track points?

---

## 7 Dynamics – forces, input torque, flywheel, shaking, balancing, motor

> Program: `dynamics_at()` and `sweep()` in `fourbar.py`; extra functions of this chapter are run by
> `python fourbar.py ch711`. All inputs are **example values** (default linkage a 30, b 100, c 80, d 100 mm, 120 rpm,
> rocker load T4 = −5 N·m constant + viscous 0.8 N·m·s/rad).

### 7.1 Theory – what "inverse dynamics" means
Kinematics (chapters 3–4) gives the motion of every link for a given crank motion. **Inverse dynamics** asks: which
forces in the pins and which input torque T12 are needed to make the links move like that, against the external loads?
We assume the crank turns at the given speed (the motor is strong enough). The answer gives:
- the **input torque** curve → motor, gearbox, flywheel (7.5–7.8),
- the **pin forces** → pins, bushings, bearings (chapter 8),
- the **shaking force and moment** on the frame → foundation, vibration, balancing (7.9–7.10).

### 7.2 Free-body diagrams
Cut every link free. At each pin there is an unknown force with x and y parts. Notation: **Fij = force of link i on
link j**; then Fji = −Fij (Newton's third law).

```
 link 2 (crank)            link 3 (coupler)                 link 4 (rocker)
   F32 at A                 -F32 at A    F43 at B             -F43 at B
      \                        \__________/                      \
       O---G2---A               A---G3---B   F_P at P             B
      /F12, T12                     m3 a_G3, J3 al3              G4
   m2 a_G2, J2 al2                                              O4  F14,  T4 (load)
```
Unknowns: F12 (2), F32 (2), F43 (2), F14 (2), T12 (1) = **9**. Equations: 3 per link (ΣFx, ΣFy, ΣM) × 3 links = **9**.
The problem is statically determinate per position → one linear 9 × 9 system.

### 7.3 Derivation of the 9 equations
For each link: ΣF = m·a_G (plus gravity), ΣM_G = J_G·α. Vectors R are from the centre of gravity G to the point where
the force acts; the 2D cross product is R × F = R_x F_y − R_y F_x.

| Link | Force equations | Moment equation about G |
|---|---|---|
| 2 | F12 + F32 + m2·g = m2·a_G2 | R12 × F12 + R32 × F32 + T12 = J2·α2 |
| 3 | −F32 + F43 + F_P + m3·g = m3·a_G3 | R23 × (−F32) + R43 × F43 + R_P × F_P = J3·α3 |
| 4 | −F43 + F14 + m4·g = m4·a_G4 | R34 × (−F43) + R14 × F14 + T4 = J4·α4 |

Written as **[M]·x = rhs** with x = [F12x, F12y, F32x, F32y, F43x, F43y, F14x, F14y, T12]. Accelerations of the CGs
come from chapter 4: a_G2 = (iα2 − ω2²)·r_G2·e^(iθ2), a_G3 = a_A + (iα3 − ω3²)·r_G3·e^(i(θ3+δ3)),
a_G4 = (iα4 − ω4²)·r_G4·e^(iθ4).

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ [M] x = rhs ,  9 x 9 , solved at every crank angle                                   │
│ input torque T12 [N m] = x9 ;  pin forces F12, F32, F43, F14 [N] = x1..x8             │
│ shaking force on the frame  F_s = -(F12 + F14)  ;  shaking moment M_s about O2          │
└───────────────────────────────────────────────────────────────────────────────────┘
```

**In the program** – the matrix rows of `dynamics_at()` (exact excerpt):
```python
    R12 = 0 - g2; R32 = A - g2
    R23 = A - g3; R43 = B - g3; RP = Pp - g3
    R34 = B - g4; R14 = O4 - g4
    rows = [
        [1, 0, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 1, 0, 0, 0, 0, 0],
        [-R12.imag, R12.real, -R32.imag, R32.real, 0, 0, 0, 0, 1],
        [0, 0, -1, 0, 1, 0, 0, 0, 0],
        [0, 0, 0, -1, 0, 1, 0, 0, 0],
        [0, 0, R23.imag, -R23.real, -R43.imag, R43.real, 0, 0, 0],
        [0, 0, 0, 0, -1, 0, 1, 0, 0],
        [0, 0, 0, 0, 0, -1, 0, 1, 0],
        [0, 0, 0, 0, R34.imag, -R34.real, -R14.imag, R14.real, 0],
    ]
    rhs = [m2 * ag2.real, m2 * ag2.imag - m2 * gv, J2 * al2,
           m3 * ag3.real - FP.real, m3 * ag3.imag - FP.imag - m3 * gv, J3 * al3 - cross(RP, FP),
           m4 * ag4.real, m4 * ag4.imag - m4 * gv, J4 * al4 - T4]
    x = solve_linear(rows, rhs)
```
Row 3 is the moment equation of link 2: −R_y·F_x + R_x·F_y is R × F written for the unknowns. Row 6 has the opposite signs
because the force on link 3 at A is −F32.

**Run it:** `python fourbar.py examples` (row θ2 = 90° of the kinematics table) and `fourbar.csv`:
```
  90    29.319   99.214   -0.643   4.375     33.64    24.42   69.89    2.973
theta2_deg,...,T12_Nm,F12_N,F32_N,F43_N,F14_N,shake_N,shakeM_Nm
90.00,29.3194,99.2139,-0.64281,4.37538,33.640,24.422,69.894,25.513,73.001,2.97326,114.027,113.933,113.231,112.936,1.476,-8.47187
```
**Interpretation.** At θ2 = 90° the motor gives 2.973 N·m. All four pin forces are ≈ 113–114 N. They are almost equal
because the links are light: the pins mainly pass on the rocker load (5 N·m / 0.08 m ≈ 62 N plus geometry factor of the
transmission angle μ = 69.9°).

### 7.4 Independent check – the energy (power) method
If the solution is right, the input power must equal the rate of change of kinetic and potential energy minus the power
of the external loads:

  T12·ω2 = Σ(m·a_G·v_G + J·α·ω) + d(PE)/dt − (T4·ω4 + F_P·v_P)

This uses only velocities and accelerations, no pin forces. `dynamics_at()` computes it as `T_energy`; the self-test
compares both over the full turn:
```
input torque: Newton-Euler = energy (power) method           OK   max diff 1.8e-15 N m
same with gravity + coupler force                            OK   2.0e-15
```
**Interpretation.** Two different derivations agree to 10⁻¹⁵ N·m → the 9 × 9 matrix, all signs and the CG
accelerations are right. Use this check also in your own Adams or SOLIDWORKS Motion model: power in = power out + dE/dt.

### 7.5 Why a constant rocker torque does no net work, a viscous load does
Work of the rocker load over one cycle: W = ∮ T4 dθ4.
- **Constant T4:** W = T4·∮dθ4 = T4·(θ4,end − θ4,start) = 0, because the rocker comes back to its start. The motor
  gives energy in one half of the cycle and gets it back in the other half (like lifting and lowering a weight, or a
  spring).
- **Viscous load T4 = −c4·ω4:** W = −∮c4·ω4² dt < 0 always → the motor must supply c4·ω4² on average. This is real work
  (friction, damping, cutting, pushing a part along).

**Run it:** `python fourbar.py ch711`
```
torque mean 0.9105, rms 1.6773, peak 3.3591 N m; mean power 11.441 W
constant rocker torque only: mean power 0.000000 W; with viscous 0.8 N m s: 11.441 W
```
**Interpretation.** The 5 N·m constant torque makes large pin forces (114 N) and a large torque swing, but the mean
power is **0 W**. Only the viscous part needs **11.44 W** on average. Self-test: mean input power = mean of c4·ω4²
(11.4412 W both). **Practice:** size the motor for the **rms and peak torque**, not only for the mean power; a gravity
or spring load can need a big motor even with zero net work.

### 7.6 Input torque curve and motor sizing
Motor (or gearmotor) checks:
- **Thermal:** rated torque ≥ SF · T_rms (rms = root mean square over the cycle, because heating ∝ current² ∝ torque²).
- **Peak:** short-time torque ≥ T_peak (most gearmotors allow about 2 × rated for short peaks – check the catalogue).
- **Power:** P_motor ≥ T_rated·ω2 / η_gear.

  T_rms = √( (1/N)·Σ T12,k² )  SF = service factor (1.25–2 by duty, shocks, starts per hour – catalogue table)

**In the program** (`gearmotor_size()`):
```python
def gearmotor_size(P, SF=1.5, eta_gear=0.85, rows=None):
    ts = torque_stats(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    T_rated = max(SF * ts["T_rms"], ts["T_peak"] / 2.0)
    P_motor = T_rated * w2 / eta_gear
    return dict(ts, T_rated_min=T_rated, P_motor_min_W=P_motor, SF=SF, eta=eta_gear)
```
**Run it:** `gearmotor: T_rms 1.677 -> rated >= 2.516 N m (SF 1.5), motor >= 37.2 W (eta 0.85)`

**Interpretation.** Mean power is 11.4 W, but the motor must be ≥ 37 W because of the rms torque and the service factor.
Pick the next catalogue size (e.g. 60–90 W gearmotor with ≥ 2.5 N·m at 120 rpm – example). Worm gearmotors have
η ≈ 0.5–0.8 (check) and may be self-locking – good for holding, bad for back-driving.

### 7.7 Energy fluctuation and flywheel – and why slow linkages rarely need one
Same method as M2 chapter 7: ΔE = max − min of ∫(T12 − T_mean)dθ2, then J = ΔE / (δ·ω2²).

**In the program** (`flywheel_crank()`, `motor_inertia_effect()`):
```python
def flywheel_crank(P, delta=0.05, rows=None):
    rows = sweep(P) if rows is None else rows
    s = summary(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    return {"dE_J": s["dE_J"], "w2": w2, "delta": delta, "J_kgm2": s["dE_J"] / (delta * w2 * w2)}

def motor_inertia_effect(P, J_motor=2.0e-4, n_motor=1400.0, rows=None):
    rows = sweep(P) if rows is None else rows
    s = summary(P, rows)
    w2 = P["rpm"] * 2 * math.pi / 60
    i = n_motor / P["rpm"]
    Jr = J_motor * i * i
    return {"i": i, "J_red": Jr, "delta": s["dE_J"] / (Jr * w2 * w2), "dE_J": s["dE_J"]}
```
**Run it:**
```
flywheel: dE 3.9750 J, w2 12.5664 rad/s, delta 0.02 -> J 1.2586 kg m2
flywheel: dE 3.9750 J, w2 12.5664 rad/s, delta 0.05 -> J 0.5034 kg m2
gearmotor rotor 2.0e-4 kg m2 at 1400 rpm: i 11.67, J_red 0.0272 kg m2 -> delta 0.9247
```
**Interpretation.** At 120 rpm ω2 is small, ω2² is very small, so a flywheel on the crank would need 0.5–1.3 kg·m² –
a huge disc. Even the motor rotor seen through the gearbox (J·i²) gives only δ ≈ 0.92 if it had to work alone as a
flywheel. **In reality the induction motor itself keeps the speed:** its torque–speed curve is steep near rated speed,
so a small speed drop gives a large extra torque. Therefore: for slow gearmotor drives, check **peak torque ≤ motor
capacity and gearbox rating** instead of adding a flywheel. A flywheel is useful for fast linkages (presses, shakers)
or weak drives. (The δ-formula assumes no motor torque change – an upper estimate.)

### 7.8 Gravity – linkage in a vertical plane
Gravity adds m·g to every link. It is conservative: over a full cycle it does no net work, but it changes the torque
curve and the pin forces.

**Run it:**
```
gravity 0.00: T_peak 3.3591, T_rms 1.6773 N m, P_mean 11.441 W, pins O2 114.1 A 114.0 B 113.4 O4 113.2 N
gravity 9.81: T_peak 3.3104, T_rms 1.6438 N m, P_mean 11.441 W, pins O2 112.5 A 112.8 B 113.6 O4 114.6 N
```
**Interpretation.** Mean power is unchanged (11.441 W) – proof that gravity does no net work. Peak and rms change by
≈ 1–2 % here because the links are light (0.08–0.30 kg). With a heavy tool on the rocker (chapter 11 example: 1.6 kg)
gravity can dominate: then use a **counter-spring or counterweight** so that the motor does not carry the weight.

### 7.9 Shaking force and shaking moment
The frame feels the reaction of the pin forces at O2 and O4 and the reaction of the motor torque:

  F_s = −(F12 + F14) = −Σ m_i·a_Gi (external loads acting on the frame cancel)   M_s = moment of these reactions about O2 − T12

Physically: F_s = −(total mass)·(acceleration of the total CG). If the total CG stands still, F_s = 0.

### 7.10 Force balancing – Berkof–Lowen method
**Derivation.** Total CG: m_t·r_G = m2·g2 + m3·g3 + m4·g4 with
g2 = r2·e^(i(θ2+φ2)), g3 = a·e^(iθ2) + r3·e^(i(θ3+φ3)), g4 = d + r4·e^(i(θ4+φ4)).
Use the loop equation to remove θ3: e^(iθ3) = (d + c·e^(iθ4) − a·e^(iθ2)) / b. Then
m_t·r_G = [m2·r2·e^(iφ2) + m3·a·(1 − (r3/b)·e^(iφ3))]·e^(iθ2) + [m4·r4·e^(iφ4) + m3·(c/b)·r3·e^(iφ3)]·e^(iθ4) + const.
θ2 and θ4 change independently, so r_G is constant only if both brackets are zero:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ m2 r2 e^(i phi2) = - m3 a (1 - (r3/b) e^(i phi3))                           │
│ m4 r4 e^(i phi4) = - m3 (c/b) r3 e^(i phi3)          ->  F_s = 0 for all angles │
└──────────────────────────────────────────────────────────────────────────┘
```
(r2 from O2 along O2A, r3 from A along AB at angle φ3, r4 from O4 along O4B.) With the coupler CG on AB (φ3 = 0) both
vectors are real and negative: **counterweights on the extensions of crank and rocker, behind the pivots.**

**In the program** (`berkof_lowen()`, core lines):
```python
    need2 = -m3 * a * (1 - (r3 / b) * e3)        # required m2 r2 vector (link frame)
    need4 = -m3 * (c / b) * r3 * e3
    ...
        have = m * rg
        add = need - have                          # kg m along the link (negative = opposite side)
        rcw = rcw_mm / 1000
        mcw = abs(add) / rcw
        xcw = math.copysign(rcw, add)
        m_new = m + mcw
        rg_new = need / m_new
        J_pivot = P["J" + k] + m * rg ** 2 + mcw * xcw ** 2   # cw as point mass (add its own J if large)
        J_new = J_pivot - m_new * rg_new ** 2
```
**Run it:** `python fourbar.py ch711`
```
link 2: need m r -0.00450 kg m, have 0.00120, counterweight 0.2280 kg at -25.0 mm -> m 0.3080 kg, rg -14.610 mm, J 1.048e-04
link 4: need m r -0.01200 kg m, have 0.01000, counterweight 0.4400 kg at -50.0 mm -> m 0.6900 kg, rg -17.391 mm, J 1.441e-03
unbalanced shake max 3.314e+00 N, shaking moment max 8.7656 N m, pins O2 114.1 A 114.0 B 113.4 O4 113.2 N, T_rms 1.6773, T_peak 3.3591, dE 3.9750
balanced   shake max 1.589e-14 N, shaking moment max 8.8157 N m, pins O2 114.0 A 114.3 B 113.7 O4 114.0 N, T_rms 1.6775, T_peak 3.3592, dE 3.9752
inertia only, 300 rpm, unbalanced shake max 2.071e+01 N, shaking moment 0.9074 N m, pins O2 22.54 A 21.39 B 11.65 O4 10.41 N, T_rms 0.1269 N m
inertia only, 300 rpm, balanced   shake max 5.024e-15 N, shaking moment 1.6993 N m, pins O2 30.41 A 34.56 B 24.44 O4 30.41 N, T_rms 0.2157 N m
```
**Interpretation.**
- The shaking force goes from 3.3 N (20.7 N in the fast inertia-only case) to **10⁻¹⁴ N = zero**. The method is exact.
- The price: +0.67 kg of counterweights, and in the inertia-dominated case the **shaking moment almost doubles**
  (0.91 → 1.70 N·m), **pin forces rise 35–110 %**, and the **input rms torque rises 70 %** (0.127 → 0.216 N·m).
- For the default (load-dominated) linkage balancing changes almost nothing, because the 5 N·m load dominates.
- **Rule:** balance only when the shaking force is a real problem (fast machines, light frames, precision tables).
  Moment balancing needs extra inertia counter-rotors (not covered here).

**MATLAB equivalent** (core of the check):
```matlab
need2 = -m3*a*(1 - r3/b);  need4 = -m3*(c/b)*r3;     % kg m, coupler CG on AB
mcw2 = abs(need2 - m2*rg2)/rcw2;  mcw4 = abs(need4 - m4*rg4)/rcw4;
```

### 7.11 Check questions
1. Why is the problem statically determinate at each position? Count unknowns and equations.
2. Prove with W = ∮T4 dθ4 that a spring on the rocker does no net work. What does it change?
3. The motor mean power is 11.4 W. Why must the motor be ≥ 37 W?
4. After Berkof–Lowen balancing, why can the shaking moment increase?
5. Why does a slow gearmotor drive normally need no flywheel?

---

## 8 Link and joint design

> Program: `coupler_loads()`, `coupler_design()`, `joint_check()` (`python fourbar.py ch711`). Section and pin sizes
> are **example values**. Material limits marked "check" are typical catalogue orders of magnitude.

### 8.1 Theory – what loads a link sees
- **Crank and rocker:** bending from the pin force (cantilever from the pivot), torsion if the pins are offset out of plane.
- **Coupler:** if it carries no mass and no external force it is a **two-force member** (force only along AB). With mass
  and inertia it also gets a transverse load: q ≈ m3·a⊥ / b (distributed inertia load).
- **Out-of-plane:** real links sit in different planes → the pin forces have offsets → bending moments in the pins and
  twisting of the links. Keep the planes close together and symmetric (clevis / fork joints).

Coupler loads in its own frame (axial along AB, transverse perpendicular):

  F_ax = F43 · u_AB  F_tr = F43 · n_AB  u_AB = (cos θ3, sin θ3)

**In the program** (`coupler_loads()`):
```python
    for r in rows:
        if not r:
            continue
        u = complex(math.cos(r["t3"]), math.sin(r["t3"]))        # unit vector A -> B
        F = r["F43"]
        ax.append(F.real * u.real + F.imag * u.imag)
        tr.append(-F.real * u.imag + F.imag * u.real)
    return {"axial_max_tension": max(ax), "axial_max_compression": -min(ax), "transverse_max": max(abs(t) for t in tr),
```
**Run it:** `coupler loads: tension max 113.4 N, compression max 3.2 N, transverse max 0.7 N`

**Interpretation.** The coupler is almost a pure tension member (the −5 N·m rocker load always pulls it). Transverse
force is only 0.7 N → bending from inertia is negligible at 120 rpm.

### 8.2 Coupler strength, buckling and fatigue
Formulas (section h × t, pinned–pinned length L = b):

  σ_ax = F_ax / (h·t)  M ≈ q·L²/8, q = m3·a⊥,max / L  σ_b = M / W, W = t·h²/6
  Euler (out of plane, weak axis): P_cr = π²·E·I_min / L², I_min = h·t³/12 (use Johnson for short, stocky bars)
  Fatigue: σ_a = (σ_t + σ_c)/2 + σ_b , σ_m = (σ_t − σ_c)/2 → modified Goodman (M1 ch. 6.3 / 26)

**In the program** (`coupler_design()`, key lines):
```python
    q = P["m3"] * aperp / (L / 1000)            # N/m
    M = q * (L / 1000) ** 2 / 8 * 1000          # N mm
    s_ax_t = cl["axial_max_tension"] / A
    s_ax_c = cl["axial_max_compression"] / A
    s_b = M / W
    Pcr = math.pi ** 2 * E * I_min / L ** 2
    sa = (s_ax_t + s_ax_c) / 2 + s_b
    sm = (s_ax_t - s_ax_c) / 2
    try:
        from dm_toolkit import marin_goodman
        g = marin_goodman(Rm, Re, max(t_mm, 2.8), sa, abs(sm), "machined", 99)
```
**Run it:**
```
section 20x8: A 160 mm2, W 533.3 mm3, I_min 853.3 mm4; a_perp max 3.91 m/s2 -> M 14.7 N mm
stress tension 0.709, compression 0.020, bending 0.027 MPa; Pcr 176863 N -> buckling SF 55160.8; sigma_a 0.392 sigma_m 0.344 n_f 347.7
```
**Interpretation.** Stresses below 1 MPa, buckling safety 55 000, fatigue safety ≈ 350. **The strength of this link is
not the design driver.** The real drivers are: stiffness (deflection changes the output angle), joint wear, mounting
space and manufacturing (a 20 × 8 mm flat bar is easy to cut, drill and ream). This is typical for light handling
linkages. For press linkages, toggle clamps or high-speed machines the same program gives large forces – then this
check is critical. (S355, R_m 510 MPa, R_e 355 MPa example; buckling here only out of plane, in-plane is stiffer.)

### 8.3 Pin joints – bushing pressure, sliding speed, pv
For a plain bushing (sleeve bearing):

  p = F / (d·L) [MPa]  v = |ω_rel|·d/2 [m/s]  pv = p·v [MPa·m/s]

Relative angular speed per joint: O2: ω2; A: ω3 − ω2; B: ω4 − ω3; O4: ω4. Pin shear (double shear in a clevis):
τ = F / (2·π d²/4). Pin bending in a clevis with gap ≈ L (load spread): M ≈ F·L/8, σ_b = M / (π d³/32).

Typical limits (orders of magnitude – **check the maker's data sheet**):

| Bushing | p_max MPa | v_max m/s | pv_max MPa·m/s | Notes |
|---|---|---|---|---|
| Sintered bronze, oil-impregnated | ≈ 10 | ≈ 6 | ≈ 1.8 | Cheap, needs no extra oil at low pv |
| PTFE composite, steel-backed (DU type) | ≈ 56 (dynamic) | ≈ 2.5 | ≈ 1.8 | Dry running, thin wall, good for oscillation |
| Needle bearing | rated by C, C0 | – | – | Small play, needs hardened shaft (≥ 58 HRC), ISO 281 life |
| Rod end / spherical plain bearing | by C0 | – | – | Allows misalignment between link planes |

**In the program** (`joint_check()`):
```python
    joints = {"O2": ("F12", lambda r: w2), "A": ("F32", lambda r: r["w3"] - w2),
              "B": ("F43", lambda r: r["w4"] - r["w3"]), "O4": ("F14", lambda r: r["w4"])}
    out = {}
    for j, (key, wrel) in joints.items():
        Fmax = max(abs(r[key]) for r in rows if r)
        vmax = max(abs(wrel(r)) for r in rows if r) * d_mm / 2000
        pvmax = max(abs(r[key]) / (d_mm * L_mm) * abs(wrel(r)) * d_mm / 2000 for r in rows if r)
        tau = Fmax / (2 * math.pi * d_mm ** 2 / 4)
        sb = (Fmax * L_mm / 8) / (math.pi * d_mm ** 3 / 32)
```
**Run it** (pin Ø10 mm, bushing length 12 mm):
```
joint O2 F 114.1 N, p 0.951 MPa, v 0.0628 m/s, pv 0.05974 MPa m/s, tau 0.726 MPa, sigma_b 1.743 MPa
joint A  F 114.0 N, p 0.950 MPa, v 0.0899 m/s, pv 0.06565 MPa m/s, tau 0.726 MPa, sigma_b 1.742 MPa
joint B  F 113.4 N, p 0.945 MPa, v 0.0254 m/s, pv 0.02381 MPa m/s, tau 0.722 MPa, sigma_b 1.733 MPa
joint O4 F 113.2 N, p 0.943 MPa, v 0.0324 m/s, pv 0.02239 MPa m/s, tau 0.721 MPa, sigma_b 1.730 MPa
```
**Interpretation.** p ≈ 1 MPa and pv ≤ 0.066 MPa·m/s are far below the limits of sintered bronze (pv ≈ 1.8). Joint A
has the highest pv because it has the highest relative speed. pv is computed **at each angle** (not p_max × v_max),
which is less conservative and more correct. **Oscillating joints** (B, O4) wear differently from rotating ones: the
lubricant film is not renewed → prefer PTFE composite or needle bearings for B and O4 in long-life machines.

### 8.4 Fits, clearance, lubrication
- Pin in bushing: **H7/g6** (Ø10: hole 0/+15 µm, shaft −5/−14 µm → clearance 5–29 µm) for accurate joints;
  **H7/f7** (shaft −13/−28 µm → clearance 13–43 µm) for dirty or warm environments. Bushing press-fitted in the link:
  housing H7 with the bushing maker's outside tolerance (often s7 or r6 class – check).
- The radial clearance per joint (half the diametral clearance, ≈ 0.01–0.02 mm) adds directly to the output play
  (chapter 9) – this is why precise linkages use needle bearings or preloaded joints.
- Pins: hardened and ground (e.g. 1.3505 / 100Cr6 58–62 HRC, or case-hardened 16MnCr5), Ra ≤ 0.4 µm for bushings;
  secure with circlips (DIN 471) or shoulder + nut. Grease nipples for sintered bronze only if pv is high.

### 8.5 Manufacturing of links
Flat bar (laser or waterjet cut, then drilled and **reamed together in a drilling jig** so that centre distances match),
or machined from plate with both bores in one set-up (CNC). Bore position tolerance ±0.02 mm, parallelism of bores
0.02/100 mm, perpendicularity to the face 0.02 mm (chapter 9 explains why).

### 8.6 MATLAB equivalent
```matlab
p = abs(F)/(d*L);  v = abs(w_rel)*d/2000;  pv = p.*v;       % F in N, d L in mm, w_rel in rad/s
tau = max(abs(F))/(2*pi*d^2/4);
```

### 8.7 Check questions
1. Why is the coupler almost a two-force member here? When is it not?
2. Which joint has the highest pv and why?
3. Why does an oscillating joint wear more than a rotating one at the same pv?
4. Compare H7/g6 and H7/f7: which gives less output play, which is safer in a hot, dusty cell?

---

## 9 Tolerances and accuracy for manufacturing

> Program: `sensitivity()`, `tolerance_mc()`, `clearance_play()`; extra `tolerance_cycle()`, `arc_error_mm()`
> (`python fourbar.py ch711`). Tolerances are **example values** (a ±0.02, b ±0.03, c ±0.03, d ±0.05 mm, 3σ).

### 9.1 Theory – linearised error propagation
The output angle is a function θ4 = f(θ2, a, b, c, d). For small errors (first-order Taylor series):

  Δθ4 = Σ_k (∂θ4/∂L_k)·ΔL_k

- **Worst case:** Δθ4,WC = Σ |∂θ4/∂L_k|·t_k (all errors add in the worst direction).
- **Statistical (RSS):** with t_k = 3σ_k: 3σ_θ4 = √Σ (∂θ4/∂L_k·t_k)².
- **Monte Carlo:** draw random lengths, solve the exact position, take the standard deviation – checks if the linear
  formula is good enough.

**In the program** (`sensitivity()`, `tolerance_mc()` core):
```python
def sensitivity(t2, P, h=1e-4):
    base = {k: P[k + "_mm"] for k in "abcd"}
    out = {}
    for k in "abcd":
        vals = []
        for s in (+1, -1):
            L = dict(base)
            L[k] += s * h
            pos = position(t2, L["a"], L["b"], L["c"], L["d"], P["branch"])
            vals.append(pos["t4"])
        out[k] = math.degrees(_wrap(vals[0] - vals[1])) / (2 * h)
    return out
...
    for _ in range(n):
        L = {k: P[k + "_mm"] + rnd.gauss(0, P["tol_mm"][k] / 3) for k in "abcd"}
        pos = position(t2, L["a"], L["b"], L["c"], L["d"], P["branch"])
        errs.append(math.degrees(_wrap(pos["t4"] - base)))
```
**Run it:** report section "Tolerances" and `ch711`:
```
- sensitivity dtheta4/dL [deg/mm]: a -0.3735, b -0.7627, c 0.2622, d 0.6650
- output angle error: Monte Carlo 3 sigma 0.0415 deg, RSS 0.0418 deg, worst case 0.0715 deg; joint play ~0.115 deg
theta2   0: MC 3s 0.0503, RSS 0.0508, WC 0.0969 deg
theta2  45: MC 3s 0.0509, RSS 0.0516, WC 0.0979 deg
theta2  90: MC 3s 0.0413, RSS 0.0418, WC 0.0715 deg
theta2 135: MC 3s 0.0377, RSS 0.0379, WC 0.0578 deg
theta2 180: MC 3s 0.0372, RSS 0.0373, WC 0.0617 deg
theta2 225: MC 3s 0.0346, RSS 0.0346, WC 0.0605 deg
theta2 270: MC 3s 0.0328, RSS 0.0328, WC 0.0618 deg
theta2 315: MC 3s 0.0370, RSS 0.0372, WC 0.0684 deg
```
(The cycle table uses 8 000 samples, the report 20 000 – hence 0.0413 vs 0.0415 at 90°.)

**Interpretation.**
- **Coupler b is the most sensitive length** (−0.76 °/mm), then ground d (+0.67 °/mm). The crank a and rocker c matter
  less. → Put the tight tolerance (or an adjustment) on b and d.
- Monte Carlo and RSS agree within 1–2 % → the linear model is valid for these small tolerances (self-test ±5 %).
- Worst case is ≈ 1.7–1.9 × RSS. Use WC for small lots or safety-relevant positions, RSS for series with capable processes.
- The error depends on the crank angle: largest near θ2 = 0–45° (0.05° 3σ), where the transmission angle is smallest
  (44°). **Small transmission angle = sensitive and weak position.**

### 9.2 Joint clearance usually dominates
`clearance_play()` gives a rough upper bound: each of the 4 joints can shift the chain by up to 2 × radial clearance;
the effect on the rocker angle is ≈ Σ shifts / c:

  Δθ4,play ≈ 4·2·e_r / c (rad)  (rough upper bound, real play depends on force direction)

**Run it:**
```
joint play (4 joints, 0.02 mm) ~ 0.1146 deg -> at rocker tip r = 80 mm: 0.1600 mm; MC 3s at 90 deg: 0.0577 mm
```
**Interpretation.** Joint play (0.115°, 0.16 mm at the tip) is **almost 3 × the length-tolerance effect** (0.041°,
0.058 mm). Tightening the length tolerances further is wasted money while the joints have clearance. Better: needle
bearings or preloaded joints, a constant load direction (spring or gravity keeps all joints loaded on one side, so the
play does not show), or measure and compensate in the control.

### 9.3 How to dimension and tolerance link drawings
| Feature | Example tolerance | Why |
|---|---|---|
| Centre distance of bores (b, c, a) | ±0.02 … ±0.03 mm | Direct effect on θ4 (sensitivities above) |
| Frame pivot distance d | ±0.03 … ±0.05 mm (machined in one set-up) | Second most sensitive; base plate bored in one clamping |
| Bore diameter | H7 | Fit with pin / bushing |
| Bore parallelism | 0.02 / 100 mm | Avoids out-of-plane twist and edge loading of bushings |
| Bore perpendicular to link face | 0.02 mm | Same |
| Link thickness / flatness | ±0.1 mm / 0.05 mm | Axial play, stacking of planes |
Dimension the centre distance as a basic (theoretically exact) dimension and control the bores with **position
tolerance** to a common datum (ISO 1101) – or a direct ± on the centre distance for simple parts. Measure at 20 °C.

### 9.4 Adjustable coupler (turnbuckle)
A coupler with left- and right-hand threads (turnbuckle) or an eccentric pin lets you set the output angle on the
machine. Because b is the most sensitive length, a ±1 mm adjustment moves θ4 by about ±0.76° at θ2 = 90° – enough to
take out all length errors (≈ 0.04–0.1°) and the frame error. Lock with a lock nut and mark the setting.

### 9.5 Inspection and assembly
- CMM: centre distance and bore position; or a gauge with two fixed pins (go / no-go for the centre distance).
- Ream bores of a link pair together in a jig → equal lengths for parallel linkages.
- Assembly: check free movement over the full turn before connecting the motor; check the rocker end positions with a
  protractor or dial gauge; record the turnbuckle setting.

### 9.6 MATLAB equivalent
```matlab
s = zeros(1,4); h = 1e-4; L0 = [a b c d];
for k = 1:4
  Lp = L0; Lp(k) = Lp(k) + h; Lm = L0; Lm(k) = Lm(k) - h;
  [~,~,t4p] = position(t2, Lp(1),Lp(2),Lp(3),Lp(4), 1); [~,~,t4m] = position(t2, Lm(1),Lm(2),Lm(3),Lm(4), 1);
  s(k) = rad2deg(angle(exp(1i*(t4p - t4m))))/(2*h);   % deg/mm
end
rss = sqrt(sum((s.*tol).^2));  wc = sum(abs(s).*tol);
```

### 9.7 Check questions
1. Which link length would you make adjustable and why?
2. Why do Monte Carlo and RSS agree here? When would they not (large tolerances, near a toggle position)?
3. The joint play is 3 × the length effect. Name three ways to reduce its influence.

---

## 10 Verification with SOLIDWORKS Motion / Adams and MATLAB

### 10.1 Purpose
Your MBD model must reproduce `fourbar.py` before you trust it for things the program cannot do (3D offsets, contact,
flexible links, friction in joints, motor model). This raises the credibility of the MBD model to level L2 (M1 ch. 7).

### 10.2 Model set-up (planar four-bar in 3D software)
1. Parts: crank, coupler, rocker, frame with the exact centre distances (a 30, b 100, c 80, d 100 mm). Give each part
   the **mass, CG and J of the input** (`python fourbar.py params`: m2 0.08 kg, rg2 15 mm, J2 1.0e-5 kg·m², …) – override
   the CAD mass properties for this test.
2. Joints: O2 revolute, A revolute, B revolute, O4 **revolute** – but a planar four-bar built from 4 revolutes in 3D has
   **redundant constraints** (Grübler in 3D: 6·3 − 4·5 = −2 → 2 redundancies). Use instead: O2 revolute, O4 revolute,
   A **cylindrical** (or revolute), B **spherical** (or universal) – then DOF = 1 and no redundancy. In SOLIDWORKS Motion
   redundant mates are removed automatically but the reaction forces at those mates become **unreliable**; in Adams
   check "Model verify" for redundant constraints.
3. Motor at O2: constant speed 120 rpm (720 deg/s).
4. Rocker load: torque −5 N·m about O4 + rotational damper 0.8 N·m·s/rad (Adams: torsion spring-damper with k = 0;
   SOLIDWORKS: torsional damper) – sign convention: counter-clockwise positive, viewed from +z.
5. Gravity off (the program default is gravity 0); turn on later with `"gravity": 9.81` in the JSON and gravity −y.
6. Simulation: 0.5 s = 1 revolution, ≥ 360 output steps; Adams integrator error 1e-5.

### 10.3 What to compare (acceptance)
| Output | fourbar.csv column | Expected at θ2 = 90° | Tolerance |
|---|---|---|---|
| Rocker angle θ4 | theta4_deg | 99.214° | ±0.01° |
| Rocker speed ω4 | w4 | 4.375 rad/s | ±0.5 % |
| Rocker acceleration α4 | al4 | 24.42 rad/s² | ±1 % |
| Motor torque | T12_Nm | 2.973 N·m | ±1 % |
| Pin force at O2 | F12_N | 114.03 N | ±1 % (only without redundancy!) |
| Shaking force | shake_N | 1.476 N | ±2 % |
| Swing, mean power | report | 47.74°, 11.44 W | ±0.05°, ±1 % |

### 10.4 Typical errors
| Symptom | Cause |
|---|---|
| Pin forces wrong but torque right | Redundant constraints – force split between mates is arbitrary |
| Torque off by a constant pattern | Gravity on in one model, off in the other; mass from CAD instead of input |
| Torque sign inverted | Motor torque reported as reaction on the frame, or clockwise rotation |
| θ4 differs by 180° or other branch | Assembly in the crossed configuration (branch −1) |
| Values × 1000 | mm vs m, N·mm vs N·m |
| Mean power ≠ 11.44 W | Damper missing or wrong unit (N·mm·s/deg) |

### 10.5 MATLAB mirror `tools/fourbar.m`
Same position (circle intersection), velocity, acceleration, Newton–Euler 9 × 9 and transmission-angle functions as
`fourbar.py`; it prints the values of 10.3 and plots θ4 and μ, T12, pin forces and the coupler curve. It was written as a
line-by-line translation and **not executed on the build PC** (no MATLAB) – run it once and compare with the numbers in
its header (θ2 = 90°: θ4 99.214°, T12 2.973 N·m; swing 47.74°; T12 max 3.359 N·m; mean power 11.44 W).

### 10.6 Check questions
1. Why does a planar four-bar with 4 revolute joints have redundant constraints in 3D?
2. Which output proves your damper is right? (Mean power.)
3. How do you detect that the MBD model assembled in the other branch?

---

## 11 Complete worked application design – swing transfer arm

### 11.1 Requirement (example values)
Swing a part gripper on the compressor line between two positions **50° apart**, **30 cycles/min**, equal time
forward and back (**Q = 1**), rocker arm 80 mm to the gripper axis, gripper + part 1.6 kg total on the rocker (CG
70 mm from O4), horizontal plane, damping/friction load 2 N·m·s/rad. Position repeatability at the gripper ≤ ±0.2 mm.

### 11.2 Synthesis
Crank-rocker with Q = 1 (chapter 6, `crank_rocker_Q1(c=80, ψ=50°, L_extra=70)`):
```
synthesis: a 33.809 b 103.809 c 80.000 d 126.623 mm; Grashof crank-rocker (input crank turns fully, output rocks)
```
L_extra (distance of O2 beyond B1) is the free choice: it was chosen so that the transmission angle stays near 90°.

### 11.3 Analysis with the program
Input file `tools/examples/swing_arm.json` (the values not listed are the defaults):
```json
{"name": "Swing transfer arm for the compressor line - 50 deg, Q = 1, 30 cycles/min",
 "a_mm": 33.809, "b_mm": 103.809, "c_mm": 80.0, "d_mm": 126.623, "branch": 1,
 "p_mm": 0.0, "delta_deg": 0.0, "rpm": 30.0, "alpha2": 0.0,
 "m2": 0.15, "rg2_mm": 15.0, "J2": 4e-05, "m3": 0.40, "rg3_mm": 51.9, "dg3_deg": 0.0, "J3": 0.0004,
 "m4": 1.60, "rg4_mm": 70.0, "J4": 0.003, "T4_load_Nm": 0.0, "c4_visc_Nms": 2.0, "F_P_N": [0.0, 0.0],
 "gravity": 0.0, "tol_mm": {"a": 0.02, "b": 0.03, "c": 0.03, "d": 0.05}, "joint_clearance_mm": 0.015, "step_deg": 1.0}
```
**Run it:** `python fourbar.py run --in examples/swing_arm.json --out swing_out`
```
- s + l = 160.43, p + q = 183.81 -> Grashof crank-rocker (input crank turns fully, output rocks)
- rocker angle 99.93 ... 149.93 deg, swing 50.00 deg; max |w4| 1.48 rad/s, max |alpha4| 6.4 rad/s2
- transmission angle 59.0 ... 121.0 deg (max deviation from 90 deg: 31.0)
- limit positions: swing 50.00 deg, crank angle difference alpha 0.00 deg, time ratio Q 1.0000
- input torque mean 0.608, max 1.399, min -0.000 N m; mean power 1.9 W; energy fluctuation 0.833 J
- pin forces max: O2 41.8, A 41.8, B 41.8, O4 42.0 N
- shaking force max 0.9 N, shaking moment max 2.993 N m
- sensitivity dtheta4/dL [deg/mm]: a -0.2760, b -0.7162, c -0.0000, d 0.6609
- output angle error: Monte Carlo 3 sigma 0.0396 deg, RSS 0.0398 deg, worst case 0.0601 deg; joint play ~0.086 deg
```
**Interpretation.** Swing 50.00° and Q = 1.0000 as required. The transmission angle stays within 90 ± 31° (good: ≥ 40°
rule). Sensitivity to c is zero at θ2 = 90° (symmetric position) but not at other angles.

### 11.4 Dynamics, motor and joints (`python fourbar.py ch711`, section ch11)
```
torque mean 0.608 rms 0.758 peak 1.399 N m, P mean 1.91 W -> gearmotor rated >= 1.14 N m, motor >= 4.2 W
flywheel delta 0.05: dE 0.8327 J -> J 1.6874 kg m2
with gearmotor rotor 1.0e-4 kg m2 at 1400 rpm: i 46.67, J_red 0.2178 kg m2, delta 0.3874
pins max: O2 41.8 A 41.8 B 41.8 O4 42.0 N; shake max 0.90 N
  joint O2 p 0.348 MPa pv 0.00547 MPa m/s tau 0.27 MPa
  joint A  p 0.348 MPa pv 0.00688 MPa m/s tau 0.27 MPa
  joint B  p 0.348 MPa pv 0.00222 MPa m/s tau 0.27 MPa
  joint O4 p 0.350 MPa pv 0.00259 MPa m/s tau 0.27 MPa
coupler: compression max 41.8 N, buckling SF 3927, sigma_a 0.243 MPa, n_f 712.5
```
**Interpretation.**
- Motor: ≥ 1.14 N·m at 30 rpm and ≥ 4.2 W – the smallest catalogue gearmotors (≈ 25–40 W, ratio ≈ 45–50) are far
  above this; choose by **output speed 30 rpm and mounting**, check the peak 1.4 N·m against the rating.
- A flywheel would need 1.7 kg·m² – not sensible; the gearmotor holds the speed (chapter 7.7).
- Joints: p 0.35 MPa, pv < 0.007 MPa·m/s → sintered bronze bushings Ø10 × 12 are more than enough; for B and O4
  (oscillating, repeatability ±0.2 mm) use **needle bearings or PTFE composite with H7/g6** to keep the play small.

### 11.5 Accuracy check at the gripper
```
  tol theta2   0: MC 3s 0.0409 WC 0.0774 deg
  tol theta2  90: MC 3s 0.0394 WC 0.0601 deg
  tol theta2 180: MC 3s 0.0494 WC 0.0909 deg
  tol theta2 270: MC 3s 0.0326 WC 0.0546 deg
  joint play 0.0859 deg -> tip (r 80) 0.1200 mm
```
At the end positions the rocker is at rest (ω4 = 0) – these are the positions that matter for the gripper. Worst
length effect 0.091° → 80 mm · 0.091° · π/180 = 0.13 mm (worst case); joint play 0.12 mm. Sum ≈ 0.25 mm > 0.2 mm
requirement in the worst case → **use the turnbuckle on b to set the end position** (removes the length errors) and
**needle bearings at B and O4** (play → ≈ 0.02–0.04 mm). Then the repeatability is set by the joint play only → within
±0.2 mm. (Repeatability = play; absolute accuracy = lengths + play – set once by adjustment.)

### 11.6 Design sheet
| Item | Value | Source |
|---|---|---|
| Links a / b / c / d | 33.81 / 103.81 (adjustable ±1 mm) / 80.00 / 126.62 mm | `crank_rocker_Q1`, 11.2 |
| Class | Grashof crank-rocker, Q = 1.0000, swing 50.00° | report |
| Transmission angle | 59.0 … 121.0° | report |
| Speed | 30 rpm crank, 2 s per cycle | requirement |
| Motor | gearmotor, 30 rpm, ≥ 1.14 N·m rated, peak 1.4 N·m, ≥ 4.2 W (choose catalogue size) | 11.4 |
| Pin forces | ≤ 42 N | 11.4 |
| Joints | Ø10 H7/g6; O2, A sintered bronze 10 × 12; B, O4 needle bearings (or PTFE composite) | 8.3–8.4, 11.5 |
| Coupler | 20 × 8 flat bar S355, turnbuckle, buckling SF ≈ 3900 | 8.2 |
| Tolerances | a ±0.02, c ±0.03, frame d ±0.05 (one set-up), b set by turnbuckle | 9.3 |
| Accuracy at gripper | play ≈ 0.12 mm with bushings; with needles ≈ 0.02–0.04 mm | 11.5 |
| Verification | SOLIDWORKS Motion / Adams vs fourbar.csv (10.3) | 10 |

### 11.7 Checklists
**Design** – [ ] Grashof class right for the task · [ ] transmission angle 40–140° over the working range · [ ] no
branch / order defect (chapter 6) · [ ] limit positions and Q checked · [ ] motor by rms and peak torque · [ ] pin forces
→ joints (p, pv, fit) · [ ] coupler buckling only if compressed · [ ] gravity / counter-spring for heavy rockers ·
[ ] shaking force acceptable or balanced.
**Manufacturing** – [ ] centre distances ±0.02–0.05, bores reamed in a jig · [ ] frame pivots in one set-up ·
[ ] most sensitive link adjustable · [ ] joint clearance specified (fit class) · [ ] inspection of centre distances.
**Verification** – [ ] self-test PASS · [ ] MBD model without redundant constraints matches fourbar.csv (10.3) ·
[ ] end positions measured on the real machine.

### 11.8 Common mistakes
- Choosing link lengths by eye without checking Grashof and the transmission angle → the linkage locks or runs rough.
- Synthesis passes the precision points but the linkage cannot move between them (branch defect, chapter 6).
- Motor sized by mean power only; a constant (spring/gravity) load gives zero mean power but high peak torque.
- Four revolute joints in a 3D MBD model → wrong pin forces (redundancy).
- Tight length tolerances while the joints have large clearance.
- Counterweights added "to be safe": they increase pin forces, shaking moment and torque.

### 11.9 Limits of the program
Rigid links, ideal joints without friction or clearance in the dynamics, constant crank speed (no motor model), planar
motion (no out-of-plane offsets), linear tolerance model (checked by Monte Carlo), rough joint-play bound. Joint
friction, link flexibility and motor dynamics → Adams / SOLIDWORKS Motion (chapter 10).

### 11.10 Standards and references
- VDI 2127 (transmission design – kinematic analysis of linkages) and VDI 2130 (four-bar linkages / transfer functions):
  titles and current editions **to check** – German VDI guideline series 21xx on linkages ("Getriebetechnik").
- ISO 286-1/-2 (fits), ISO 1101 (geometrical tolerancing), ISO 3547 (wrapped bushes), ISO 4379 (sintered bushes) –
  check the edition; bushing makers' catalogues for p, v, pv.
- R. L. Norton, *Design of Machinery*, 6th ed., McGraw-Hill (chapters on position, velocity, acceleration, dynamic
  force analysis, balancing – the notation of this guide).
- A. G. Erdman, G. N. Sandor, S. Kota, *Mechanism Design: Analysis and Synthesis*, Vol. 1, 4th ed.
- J. J. Uicker, G. R. Pennock, J. E. Shigley, *Theory of Machines and Mechanisms*, 5th ed., Oxford.
- R. S. Hartenberg, J. Denavit, *Kinematic Synthesis of Linkages*, McGraw-Hill 1964 (free-form classic).
- J. M. McCarthy, G. S. Soh, *Geometric Design of Linkages*, 2nd ed., Springer.
- G. G. Lowen, R. S. Berkof, "Survey of investigations into the balancing of linkages", J. Mechanisms 3 (1968) – force
  balancing method of 7.10.

### 11.11 Glossary
| Term | Meaning |
|---|---|
| Inverse dynamics | Find forces and input torque for a given motion |
| Pin force Fij | Force of link i on link j at their joint |
| Shaking force / moment | Net force / moment the mechanism puts on the frame |
| Force balancing (Berkof–Lowen) | Counterweights that keep the total CG fixed → zero shaking force |
| rms torque | Root mean square torque – decides motor heating |
| Service factor | Multiplier on the load torque for duty, shocks and starts (gearmotor catalogues) |
| pv value | Bushing pressure × sliding speed – wear / heat limit of plain bearings |
| Two-force member | Link loaded only at two pins and without mass → force along the line of the pins |
| Redundant constraint | Joint condition that repeats another one – makes reaction forces undetermined |
| Turnbuckle | Adjustable link with left- and right-hand thread |
| Joint play | Free movement from pin clearances |
