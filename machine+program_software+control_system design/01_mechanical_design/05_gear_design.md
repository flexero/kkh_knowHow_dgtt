# M5 – Gear design: involute geometry, profile shift, forces, ISO 6336 load capacity, manufacturing and inspection data

> Field 1 *Mechanical design*, item 5. **Theory and program are combined:** every formula is followed by the code of
> `tools/gear.py`, the command and the real output. MATLAB mirror: `tools/gear.m`. Web: tab **M_P_C tools**, item 8.
> Python standard library only – offline. **All inputs are example values.** The load capacity follows the structure of
> ISO 6336 (2019) in a simplified form (method B form factors, simplified K_V, K_Hβ given, life factors explained in
> chapter 5); values marked "check" must be compared with the standard before a design report is signed.

## Contents
0. How to use this guide with the program
1. Purpose – what a gear calculation must prove
2. Gear types, terms and real manufacturing
3. Involute geometry and profile shift
4. Forces, torque, efficiency and the shaft / bearing hand-over (M3, M4)
5. Load capacity in the style of ISO 6336
6. Manufacturing and inspection data
7. Verification
8. Complete worked design example, checklists, references, glossary

---

## 0. How to use this guide with the program

### 0.1 Commands
| Command | What it does |
|---|---|
| `python gear.py params` | Default input as JSON (copy → edit → `--in`) |
| `python gear.py run --in my.json --out res` | Full calculation → `report.md`, `gear.csv` (involute points for CAD / CAM check), `profile.svg` |
| `python gear.py examples` | Report of the default stage, form factors vs number of teeth, effect of profile shift |
| `python gear.py ch24` / `ch5` / `ch68` | Extra results of chapters 2–4 / 5 / 6–8 |
| `python gear.py selftest` | Independent cross-checks → SELFTEST PASS |
| Web: `http://localhost:8080/?mpcitem=8#mpc` | Same calculation with charts (profile-shift effect, involute flank) and the manufacturing table |

### 0.2 Program map – formula → function
| Chapter | Physics / method | Function |
|---|---|---|
| 2 | Typical allowable stress numbers of gear materials | `MATERIALS` |
| 3 | Involute function and its inverse; involute flank points | `inv()`, `inv_inverse()`, `involute_points()` |
| 3 | Diameters, transverse angles, profile shift, working centre distance, contact ratios, tip thickness, undercut | `geometry()` |
| 4 | Torque, tangential / radial / axial force, speed | `forces()` |
| 5 | K_V, K_Fβ, Z_H, Z_E, Z_ε, Z_β, Y_β | `KV_factor()`, `KFbeta()`, `ZH()`, `ZE()`, `Zeps()`, `Zbeta()`, `Ybeta()` |
| 5 | Tooth form factor Y_F and stress correction Y_S (ISO 6336-3 method B) | `form_factor_B()` |
| 5 | Contact and root stress, safeties | `capacity()` |
| 6 | Span measurement W_k, dimension over pins / balls, backlash | `span_measurement()`, `over_pins()`, `backlash()` |
| – | Report, CSV, chart | `report_text()`, `run()` |
| 2–4 | Module series + next standard module, basic racks, pitches, case depth, contact points, specific sliding + balance x1, mesh loss (Ohlendorf), pinion-shaft bearing loads (hand-over to M3 / M4) | `MODULES_I`, `MODULES_II`, `next_module()`, `BASIC_RACK`, `pitches()`, `chd_recommendation()`, `contact_points()`, `specific_sliding()`, `sliding_table()`, `balance_x1()`, `mesh_loss()`, `pinion_shaft_loads()`, `bearing_handover()` |
| 5 | K_A table, resonance ratio, K_Hβ estimate, life factors Z_NT / Y_NT, form-factor steps, method C comparison, module / width / helix / material studies, maximum power, flash temperature, film thickness, oil VG by speed | `KA_TABLE`, `resonance_ratio()`, `KHbeta_estimate()`, `ZNT()`, `YNT()`, `life_effect()`, `form_factor_steps()`, `methodC_compare()`, `module_study()`, `width_study()`, `helix_study()`, `material_study()`, `max_power()`, `flash_temperature()`, `film_thickness()`, `VG_BY_SPEED`, `vg_for_speed()` |
| 6–8 | Thermal backlash, ISO 1328 tolerances, tip relief, crowning, drawing data block, ISO 54 modules, pre-sizing d1, worked example | `backlash_thermal()`, `iso1328_2013()`, `tip_relief()`, `crowning()`, `drawing_block()`, `ISO54`, `presize_d1()`, `EXAMPLE`, `design_example()` |
Example input of chapter 8: `tools/examples/gear_example.json`.

### 0.3 What the self-test proves
1. inv(20°) = 0.014904 and the Newton inverse returns the angle.
2. Standard spur pair: a_w = a0 = m(z1 + z2)/2 and no tip shortening.
3. Contact ratio = path of contact / base pitch, computed independently.
4. Span measurement z 20, m 1, x 0 over k = 3 teeth = 7.660 mm (textbook value).
5. a_w → x1 + x2 → a_w is consistent; dimension over pins lies between d_a and d_a + 2 D_M.
6. Y_F falls with more teeth and with positive profile shift; Y_F·Y_S (method B) agrees with Y_Fa·Y_Sa·Y_ε (method C) within 15 %.
7. Z_H Z_E √(…) equals the Hertz line-contact pressure at the pitch point; Z_E (steel/steel) = 189.8 √MPa.

## 1. Purpose – what a gear calculation must prove

| Proof | Question | Chapter |
|---|---|---|
| Geometry | Do the gears mesh correctly (no undercut, no pointed tip, contact ratio > 1.2, correct centre distance)? | 3 |
| Pitting | Do the flanks survive the Hertz pressure for the required life? | 5 |
| Tooth root | Does the tooth root survive bending fatigue (and peak load)? | 5 |
| Scuffing, micropitting | Is the oil film / temperature acceptable? | 5 |
| Forces | Which loads go into shafts and bearings? | 4 (→ M3, M4) |
| Manufacture | Which values go on the drawing (W_k, pins, accuracy, heat treatment) and how are they inspected? | 6 |

**Default example** (`python gear.py examples`): helical reducer stage for a factory drive – 15 kW at 1450 rpm,
m_n 2 mm, z 19 / 60 (u 3.158), β 15°, x 0.25 / −0.10, b 28 mm, 18CrNiMo7-6 case hardened and ground, K_A 1.25.

| Result | Value |
|---|---|
| Centre distance a_w / contact ratios | 82.083 mm / ε_α 1.520, ε_β 1.153, ε_γ 2.674 |
| Forces | F_t 5022 N, F_r 1947 N, F_a 1346 N; v 2.99 m/s |
| Contact stress / pitting safety | σ_H 1168 MPa → S_H 1.28 |
| Root stress / safety pinion, wheel | 328 / 342 MPa → S_F 3.05 / 2.92 |
| Inspection | W_k pinion 15.690 mm over 3 teeth (with allowances 15.615 … 15.643), over balls Ø3.25: 44.105 mm |

Pitting governs, as in most case-hardened industrial gears; the root has a large margin.


---

## 2 Gear types, terms and real manufacturing

> Program: `tools/gear.py` (`MATERIALS`, `DEFAULT`) + chapter functions `next_module()`, `BASIC_RACK`, `pitches()`,
> `chd_recommendation()`. Extra results: `python gear.py ch24`. All numbers are **example values**.

### 2.1 Why gears, and which type

A gear pair transmits rotation with a **fixed ratio** by teeth that roll on each other. Compared with belts (used on
the compressor, M2/M3) gears are compact, have no slip and carry high torque – but they need accurate machining,
heat treatment and lubrication.

| Type | Ratio per stage (typical) | Efficiency per stage | Noise | Cost | Typical use |
|---|---|---|---|---|---|
| Spur (straight teeth) | 1 … 6 (max ~8) | 98–99 % | higher | low | simple drives, low speed, sliding gears |
| Helical | 1 … 6 (max ~10) | 98–99 % | low | medium | industrial reducers, machine tools |
| Double-helical / herringbone | 1 … 10 | 98–99 % | very low | high | large power, no axial force |
| Internal gear | 1.5 … 8 | 98–99 % | low | medium–high | planetary gears, compact drives |
| Rack and pinion | rotation → line | 97–98 % | medium | medium | linear axes, gantries, doors |
| Bevel (straight / spiral) | 1 … 6 | 97–99 % | medium / low | high | 90° drives, AGV wheel drives |
| Worm | 5 … 100 | 50–90 % (falls with ratio) | very low | medium | indexing tables, self-locking drives |
| Planetary (one stage) | 3 … 10 | 97–98 % | low | high | servo gearboxes, robot joints |
(Values are typical ranges for orientation – check the maker's data.)

**Where gears are in this factory** (other guides): pallet changer rotary drive (guide 09), rotary indexing tables
(guide 17), conveyor and AS/RS drives (guide 03), AGV wheel drives (guide 11), robot joints (planetary / strain-wave,
guide 21), machine-tool spindle and feed drives (guides 08, 49). **The compressor itself uses a V-belt** (M2: ratio
2.02, motor 2930 rpm → crank 1450 rpm) – a belt is cheaper, quiet and absorbs the torque pulsation. This guide's
example is therefore a **15 kW helical reducer stage** of the kind used in those drives.

### 2.2 Basic rack and terms

All involute gears are defined by a **basic rack** (a straight-sided tooth rack, ISO 53). The rack "rolls" on the
gear; the hob or grinding wheel is made in the form of this rack, so the rack *is* the tool profile.

| Term | Symbol | Formula | Default (mn 2, β 15°) |
|---|---|---|---|
| Normal module | m_n | chosen from ISO 54 | 2 mm |
| Normal pitch | p_n | π m_n | 6.2832 mm |
| Transverse pitch | p_t | π m_n / cos β | 6.5048 mm |
| Normal base pitch | p_bn | p_n cos α_n | 5.9043 mm |
| Transverse base pitch | p_bt | p_t cos α_t | 6.0870 mm |
| Axial pitch | p_x | π m_n / sin β | 24.276 mm |
| Addendum | h_a | h_aP m_n | 2.00 mm |
| Dedendum | h_f | h_fP m_n | 2.50 mm |
| Tooth height | h | (h_aP + h_fP) m_n | 4.50 mm |
| Bottom clearance | c | (h_fP − h_aP) m_n | 0.50 mm |

The four ISO 53 rack profiles (factors of m_n; check the current standard):
```
  ISO 53 profile A: h_aP 1.00, h_fP 1.25, rho_fP 0.38 (x mn)
  ISO 53 profile B: h_aP 1.00, h_fP 1.25, rho_fP 0.30 (x mn)
  ISO 53 profile C: h_aP 1.00, h_fP 1.25, rho_fP 0.25 (x mn)
  ISO 53 profile D: h_aP 1.00, h_fP 1.40, rho_fP 0.39 (x mn)
```
Profile A is the normal choice for power gears; D (deeper, h_fP 1.40, large root radius) leaves stock for grinding
after hardening; B and C have smaller root radius (rho_fP) – weaker root, more room for the mating tip.

**In the program**
```python
def pitches(P):
    """Pitches and tooth heights from the basic rack: p = pi m, p_b = p cos(alpha), c = (h_fP - h_aP) m."""
    mn, an, be = P["mn"], math.radians(P["alpha_n_deg"]), math.radians(P["beta_deg"])
    at = math.atan(math.tan(an) / math.cos(be))
    mt = mn / math.cos(be)
    return {"pn": math.pi * mn, "pt": math.pi * mt, "pbn": math.pi * mn * math.cos(an), "pbt": math.pi * mt * math.cos(at),
            "ha": P["haP"] * mn, "hf": P["hfP"] * mn, "h": (P["haP"] + P["hfP"]) * mn, "c": (P["hfP"] - P["haP"]) * mn,
            "px": math.pi * mn / math.sin(be) if be else float("inf")}
```

### 2.3 Module series (ISO 54 / DIN 780)

Use **series I** (preferred) first, series II only if needed. A new function picks the next standard module:
```python
def next_module(m_req):
    """Next standard module >= m_req: series I (preferred) and series II (ISO 54 / DIN 780, check the standard)."""
    m1 = min((m for m in MODULES_I if m >= m_req - 1e-12), default=None)
    m2 = min((m for m in MODULES_II if m >= m_req - 1e-12), default=None)
    return {"series_I": m1, "series_II": m2}
```
**Run it:** `python gear.py ch24` (first block)
```
== 2.1 next standard module
  m_req 1.83 -> series I 2, series II 2.25
  m_req 2.10 -> series I 2.5, series II 2.25
  m_req 2.60 -> series I 3, series II 2.75
  m_req 3.70 -> series I 4, series II 4.5
```
**Interpretation.** If a pre-calculation asks for 1.83 mm, take m_n = 2 (series I). Tools (hobs, grinding wheels,
gauges) for series I modules are cheap and available from stock – a series II module may mean a special tool and weeks
of delivery.

### 2.4 Materials and heat treatment

| Material (`MATERIALS`) | σ_Hlim MPa | σ_Flim MPa | Surface | When to use |
|---|---|---|---|---|
| 18CrNiMo7-6 case hardened | 1500 | 500 | 58–62 HRC | highest load, large gears, shock |
| 16MnCr5 case hardened | 1450 | 460 | 58–62 HRC | standard small/medium carburised gears |
| 42CrMo4 nitrided | 1200 | 420 | ~600 HV | low distortion, no grinding, medium load |
| 42CrMo4 induction hardened | 1200 | 360 | 50–56 HRC | large gears, local hardening |
| 42CrMo4 QT | 770 | 320 | ~300 HB | cheaper, through-hardened, can be hobbed after QT |
| C45 normalised | 560 | 220 | ~190 HB | low load, hand-operated drives |
| EN-GJS-600-3 | 560 | 220 | ~220 HB | cast wheels, low speed |
(Typical ISO 6336-5 quality MQ values used by the program – **check** the figures of ISO 6336-5 for your quality grade.)

**Case hardening depth (CHD)** – depth to 550 HV. Rule of thumb CHD ≈ 0.15 … 0.20 · m_n (check ISO 6336-5 and your
heat treater):
```python
def chd_recommendation(mn):
    """Typical case hardening depth (CHD at 550 HV) ~ 0.15 ... 0.20 mn (rule of thumb, check ISO 6336-5 / supplier)."""
    return {"CHD_min": 0.15 * mn, "CHD_max": 0.20 * mn}
```
**Run it:** `python gear.py ch24` → `== 2.3 case hardening depth for mn 2.0: 0.30 ... 0.40 mm`
Too thin → case crushing / pitting below the case; too deep → brittle teeth, more distortion, higher cost.

Heat treatment and the drawing: write material, process, surface hardness, CHD (with the test method, e.g. ISO 18203),
core hardness, and zones that must stay soft (bores to be machined later, threads).

### 2.5 Manufacturing processes and achievable accuracy

| Process | Principle | Before / after hardening | ISO 1328 grade (typical) | Relative cost |
|---|---|---|---|---|
| Hobbing | continuous generating with a worm-shaped cutter (the rack) | soft | 8–10 | 1 |
| Shaping | reciprocating pinion-type cutter; internal gears, shoulders | soft | 8–9 | 1.2 |
| Power skiving | rotating cutter at a crossed axis; fast for internal gears | soft (or hard skiving) | 7–8 | 1.1 |
| Shaving | free-running shaving cutter removes 0.02–0.1 mm | soft, before hardening | 7–8 | +0.3 |
| Generating grinding | threaded grinding wheel (like hobbing) | hard | 4–6 | +1.0 |
| Profile grinding | form wheel, tooth by tooth | hard | 3–5 | +1.5 |
| Honing | abrasive gear-shaped tool, low speed | hard | 5–6, better surface / noise | +0.5 |
(Grades and costs are typical for orientation – check with your machine supplier, guide 49.)

**Why grind after hardening?** Carburising at ~900–950 °C and quenching distort the gear (profile, helix, run-out,
growth of the bore). The distortion is typically larger than a grade-6 tolerance. Therefore: hob soft with a
**protuberance hob** (leaves grinding stock and an undercut at the root so the grinding wheel does not touch the root),
harden, then grind the flanks. Nitrided gears (≈ 500–550 °C, no quench) distort much less and are often not ground.

**Typical route of the default pinion (example):** saw bar 42 mm → turn blank (bore/shaft, faces, tip Ø44.33 h11) →
hob with protuberance hob, grinding stock ≈ 0.1 mm per flank → deburr / chamfer tooth ends → carburise, harden, temper
(CHD 0.3–0.4 mm, 58–62 HRC) → shot blast → grind bearing seats → generate-grind flanks (grade 6) → measure (span W_k,
profile/helix on a gear measuring machine) → nital-etch check for grinding burn → wash, preserve.

### 2.6 Check questions
1. Why does the compressor use a belt and not a gear stage?
2. A calculation gives m_n = 2.6 mm. Which module do you choose and why?
3. Why is a protuberance hob used before grinding?
4. Give two reasons to choose nitriding instead of case hardening.

---

## 3 Involute geometry

> Program: `inv()`, `inv_inverse()`, `involute_points()`, `geometry()` in `tools/gear.py`; chapter functions
> `contact_points()`, `specific_sliding()`, `sliding_table()`, `balance_x1()`. Extra results: `python gear.py ch24`.

### 3.1 The involute and why it is used

Unwind a taut string from a cylinder (the **base circle**, radius r_b). The end of the string draws an **involute**.
At every point the string is tangent to the base circle and **normal to the curve**. So two involute flanks in contact
always touch on the common tangent of the two base circles – the **line of action** – and the force direction is
constant. Consequences:
- constant ratio even if the centre distance changes a little (only backlash and pressure angle change);
- one straight-flanked rack generates all gears of the same module (simple tools);
- contact moves along a straight line → simple calculation of contact ratio and stresses.

**Derivation.** Let the string leave the base circle at angle t. The tangent point is
T = r_b (cos t, sin t); the unwound length is r_b·t along the tangent direction (sin t, −cos t):

  **x = r_b (cos t + t sin t),  y = r_b (sin t − t cos t)**

The polar angle of the point is θ = t − arctan t and the pressure angle α at radius r satisfies cos α = r_b / r and
t = tan α. Hence θ = tan α − α, the **involute function**:

  **inv α = tan α − α**

```python
def involute_points(rb, ra, n=40):
    """Points of the involute from the base circle to the tip: x = rb (cos t + t sin t), y = rb (sin t - t cos t)."""
    tmax = math.sqrt((ra / rb) ** 2 - 1)
    return [(rb * (math.cos(t) + t * math.sin(t)), rb * (math.sin(t) - t * math.cos(t))) for t in
            (tmax * i / n for i in range(n + 1))]
```
**Run it:** `python gear.py ch24` (block 3.1) – 5 points of the pinion flank from base to tip:
```
== 3.1 involute check: base radius 18.4069 mm, 5 points (x, y): (18.407, 0.000), (18.664, 0.029), (19.414, 0.229), (20.592, 0.762), (22.096, 1.771)
  inv(20 deg) = 0.014904, inv(alpha_t) = 0.016453, inv(alpha_wt) = 0.017836; inv_inverse(0.0149044) = 20.0000 deg
  z_min (x = 0, beta 15) = 15.54; spur z_min = 17.10
```
The first point lies on the base circle (r_b = 18.4069 mm); the last on the tip circle. `python gear.py run` writes
41 points per flank to `gear.csv` – you can import them into SOLIDWORKS (curve through XYZ points) or NX to check a
CAD gear model or a wire-EDM profile.

**inv α and its inverse.** inv α has no closed inverse. The program uses Newton iteration with the start value
α₀ = (3y)^(1/3) (from tan α − α ≈ α³/3):
```python
def inv(a):
    return math.tan(a) - a
```
```python
def inv_inverse(y):
    """Solve inv(a) = y (Newton), a in rad."""
    a = (3 * y) ** (1 / 3) if y > 0 else 0.0
    for _ in range(60):
        f = math.tan(a) - a - y
        a -= f / (math.tan(a) ** 2)
    return a
```
inv(20°) = 0.014904; inv_inverse(0.0149044) = 20.0000° (block 3.1).

### 3.2 Transverse and normal plane, diameters

For a helical gear the tool works in the **normal** plane (m_n, α_n), the involute lives in the **transverse** plane:

  **tan α_t = tan α_n / cos β,  m_t = m_n / cos β,  tan β_b = tan β cos α_t**

| Diameter | Formula |
|---|---|
| Reference | d = m_t z |
| Base | d_b = d cos α_t |
| Tip | d_a = d + 2 m_n (h_aP + x − k) |
| Root | d_f = d − 2 m_n (h_fP − x) |

```python
def geometry(P):
    """ISO 21771 style geometry of an external pair. Returns all diameters, angles, centre distance, contact ratios."""
    mn, z1, z2 = P["mn"], P["z1"], P["z2"]
    an, be = math.radians(P["alpha_n_deg"]), math.radians(P["beta_deg"])
    at = math.atan(math.tan(an) / math.cos(be))              # transverse pressure angle
    mt = mn / math.cos(be)
    d1, d2 = mt * z1, mt * z2
    db1, db2 = d1 * math.cos(at), d2 * math.cos(at)
    bb = math.atan(math.tan(be) * math.cos(at))               # base helix angle
    a0 = (d1 + d2) / 2
    if P.get("a_w"):
        aw = P["a_w"]
        awt = math.acos(a0 * math.cos(at) / aw)
        xsum = (inv(awt) - inv(at)) * (z1 + z2) / (2 * math.tan(an))
    ...
```
**Run it:** `python gear.py examples` (geometry lines of the default report):
```
- ratio u 3.1579; d 39.340 / 124.233; da 44.333 / 127.826; df 35.340 / 118.833; db 36.814 / 116.254 mm
- a0 81.787, a_w 82.083 mm (x1 + x2 = 0.1500, tip shortening k 0.0019); alpha_t 20.647, alpha_wt 21.189, beta_b 14.076 deg
- contact ratios: eps_alpha 1.520, eps_beta 1.153, total 2.674; tip thickness s_a 1.27 / 1.67 mm (>= 0.50)
- undercut: x_min -0.223 / -2.862 (x 0.250 / -0.100 -> OK)
```

### 3.3 Profile shift, undercut and pointed tips

**Profile shift** x moves the rack away from the gear centre by x·m_n during cutting. The tooth becomes thicker at the
root and thinner at the tip; the involute part moves outwards. Tooth thickness on the reference circle:

  **s_n = m_n (π/2 + 2 x tan α_n)**

**Undercut.** The rack tip line must not cross the interference point T (where the line of action touches the base
circle), otherwise the tool cuts away the root of the involute. Geometry in the transverse plane: the distance of T
below the reference line is (d/2) sin² α_t. The rack tip line lies (h_aP − x) m_n below it in the normal section,
i.e. (h_aP − x) m_n in the transverse section (heights are the same in both sections). No undercut if

  (h_aP − x) m_n ≤ (m_n z / (2 cos β)) sin² α_t

  **x_min = h_aP − z sin² α_t / (2 cos β),  z_min (x = 0) = 2 h_aP cos β / sin² α_t**

Default: z_min = 15.54 (β 15°) and 17.10 (spur) – block 3.1. The pinion with z 19 and x = +0.25 is far from undercut
(x_min = −0.223, report line). In practice a little undercut is accepted down to z ≈ 14 (spur), but the root then gets
weaker and the contact ratio smaller.

**Pointed tip.** Positive x makes the tip thin. The program computes the transverse tip thickness s_a and the report
compares it with 0.25 m_n. Rules (typical, check): s_a ≥ 0.25 m_n for through-hardened, ≥ 0.4 m_n for case-hardened
gears (the thin tip would be hardened through and chip).

### 3.4 Working pressure angle and centre distance

With profile shifts x1, x2 the gears mesh without backlash at a **working pitch circle** with pressure angle α_wt.
Condition: the sum of the tooth thicknesses on the working circles equals the working pitch. With
s_wt = d_w (s_t/d + inv α_t − inv α_wt) for both gears this gives

  **inv α_wt = 2 tan α_n (x1 + x2)/(z1 + z2) + inv α_t,  a_w = a0 cos α_t / cos α_wt,  a0 = (d1 + d2)/2**

If the centre distance is fixed (housing exists), solve the other way: α_wt from a_w, then x1 + x2. Because a_w grows
less than (x1 + x2) m_n, the tips would come too close to the opposite root; the program shortens both tips by
k·m_n:

  **k m_n = a0 + (x1 + x2) m_n − a_w**

```python
    else:
        xsum = P["x1"] + P["x2"]
        awt = inv_inverse(2 * math.tan(an) * xsum / (z1 + z2) + inv(at))
        aw = a0 * math.cos(at) / math.cos(awt)
    x1, x2 = P["x1"], P["x2"]
    # tip diameters with tip shortening k (keeps the bottom clearance): k mn = a0 + (x1+x2) mn - aw
    k = (a0 + xsum * mn - aw) / mn
    da1 = d1 + 2 * mn * (P["haP"] + x1 - k)
    da2 = d2 + 2 * mn * (P["haP"] + x2 - k)
    df1 = d1 - 2 * mn * (P["hfP"] - x1)
    df2 = d2 - 2 * mn * (P["hfP"] - x2)
    # transverse contact ratio
    ga = 0.5 * (math.sqrt(da1 ** 2 - db1 ** 2) + math.sqrt(da2 ** 2 - db2 ** 2)) - aw * math.sin(awt)
    pbt = math.pi * mt * math.cos(at)
    ...
```
Default: x1 + x2 = 0.15 → α_wt = 21.189°, a_w = 82.083 mm (a0 = 81.787), k = 0.0019 (negligible). The self-test checks
a_w → x1 + x2 → a_w.

### 3.5 Contact ratio from the path of contact

Contact starts at A, where the **wheel tip circle** cuts the line of action, and ends at E, where the **pinion tip
circle** cuts it. Measured from T1:

  T1T2 = a_w sin α_wt,  T1E = √(r_a1² − r_b1²),  T1A = T1T2 − √(r_a2² − r_b2²)

  **g_α = T1E − T1A,  ε_α = g_α / p_bt,  ε_β = b sin β / (π m_n),  ε_γ = ε_α + ε_β**

ε_α ≥ 1.2–1.3 is needed for smooth running (typical rule, check); ε_β ≥ 1 for quiet helical gears.
```python
def contact_points(P, g):
    """Distances along the line of action measured from T1 (tangent point on the pinion base circle):
    T1T2 = a_w sin(a_wt); start of contact A: rho2 = sqrt(ra2^2 - rb2^2) -> rho1_A = T1T2 - rho2;
    end of contact E: rho1_E = sqrt(ra1^2 - rb1^2); pitch point C: rho1_C = r_w1 sin(a_wt)."""
    T1T2 = g["aw"] * math.sin(g["awt"])
    r2a = math.sqrt((g["da2"] / 2) ** 2 - (g["db2"] / 2) ** 2)
    r1e = math.sqrt((g["da1"] / 2) ** 2 - (g["db1"] / 2) ** 2)
    rw1 = g["aw"] / (1 + g["u"])
    return {"T1T2": T1T2, "A": T1T2 - r2a, "E": r1e, "C": rw1 * math.sin(g["awt"])}
```
**Run it:** `python gear.py ch24` (block 3.2)
```
== 3.2 line of action: T1T2 29.668, A 3.096, C 7.135, E 12.351 mm; g_alpha 9.255 mm; p_bt 6.0870 -> eps_alpha 1.520
```
ε_α = 9.255 / 6.0870 = 1.520 – the same as `geometry()` (report line), found independently from the four points.
ε_β = 28 sin 15° / (2π) = 1.153 → ε_γ = 2.674: always 2–3 tooth pairs share the load – one reason helical gears are
quiet and strong.

### 3.6 Sliding velocity and specific sliding

Only at the pitch point C do the flanks roll purely. Elsewhere they slide. With radii of curvature ρ1 = T1Y and
ρ2 = T2Y at a contact point Y:

  tangential speeds v1 = ω1 ρ1, v2 = ω2 ρ2 = ω1 ρ2 / u;  sliding speed v_g = |v1 − v2| = (ω1 + ω2)·|CY|

  **ζ1 = 1 − ρ2 / (u ρ1),  ζ2 = 1 − u ρ1 / ρ2**  (specific sliding)

High negative ζ at the root of a gear means high wear and scuffing risk there. Good design: **equal specific sliding at
the two roots** (start and end of contact).
```python
def specific_sliding(P, g, rho1):
    """Specific sliding at a contact point with pinion radius of curvature rho1 (transverse plane):
    v1 = w1 rho1, v2 = w2 rho2 = w1 rho2/u -> zeta1 = 1 - rho2/(u rho1), zeta2 = 1 - u rho1/rho2."""
    cp = contact_points(P, g)
    rho2 = cp["T1T2"] - rho1
    u = g["u"]
    return {"rho1": rho1, "rho2": rho2, "zeta1": 1 - rho2 / (u * rho1), "zeta2": 1 - u * rho1 / rho2}
```
```python
def balance_x1(P, xsum):
    """x1 (with x2 = xsum - x1) for equal specific sliding at the two roots: |zeta1(A)| = |zeta2(E)| (bisection)."""
    def f(x1):
        Q = dict(P, x1=x1, x2=xsum - x1)
        t = sliding_table(Q)
        return abs(t["A"]["zeta1"]) - abs(t["E"]["zeta2"])
    lo, hi = -0.5, 1.0
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    x1 = 0.5 * (lo + hi)
    t = sliding_table(dict(P, x1=x1, x2=xsum - x1))
    return {"x1": x1, "x2": xsum - x1, "zeta1_root": t["A"]["zeta1"], "zeta2_root": t["E"]["zeta2"]}
```
**Run it:** `python gear.py ch24` (block 3.3)
```
== 3.3 specific sliding (default x 0.25 / -0.10)
  A: rho1 3.096, rho2 26.573 mm, zeta1 -1.718, zeta2 +0.632, v_g 0.808 m/s
  C: rho1 7.135, rho2 22.533 mm, zeta1 +0.000, zeta2 +0.000, v_g 0.000 m/s
  E: rho1 12.351, rho2 17.318 mm, zeta1 +0.556, zeta2 -1.252, v_g 1.043 m/s
  balanced sliding for x1 + x2 = 0.00: x1 0.314, x2 -0.314 (zeta1 root -1.446, zeta2 root -1.446)
  balanced sliding for x1 + x2 = 0.15: x1 0.338, x2 -0.188 (zeta1 root -1.352, zeta2 root -1.352)
  balanced sliding for x1 + x2 = 0.50: x1 0.397, x2 0.103 (zeta1 root -1.169, zeta2 root -1.169)
  for comparison x1 0, x2 0.15: zeta1 root -3.590, zeta2 root -0.979
```
**Interpretation.** With the default split x1 = 0.25 / x2 = −0.10 the pinion root has ζ1 = −1.718 and the wheel root
ζ2 = −1.252 – close, the pinion slightly worse. For the same sum 0.15 the balance is x1 = 0.338 / x2 = −0.188
(both −1.352). Putting all shift on the wheel (x1 0, x2 0.15) is bad: pinion root −3.590. Rule: **give the small gear
the larger profile shift.** v_g is largest at the end of contact (1.043 m/s): the scuffing (flash temperature) check of
ISO/TS 6336-20 uses the sliding speed along the path (check the method).

### 3.7 Choosing the profile shift (summary of DIN 3992 guidance – check the standard)

| Goal | Choice |
|---|---|
| Avoid undercut on a small pinion | x1 ≥ x_min |
| Higher root strength of the pinion | x1 positive (0.2 … 0.5); Y_F falls (table below) |
| Balanced wear / scuffing | split x1 / x2 for equal specific sliding (`balance_x1()`) |
| Slightly lower flank stress | larger x1 + x2: α_wt grows → Z_H falls → σ_H a little lower |
| Quieter running | smaller x1 + x2 → larger ε_α |
| Fixed centre distance | x1 + x2 from a_w, then split |
| Limit | s_a ≥ 0.25–0.4 m_n, ε_α ≥ 1.2 |

**Run it:** `python gear.py examples` – profile-shift table of the pinion (sum not constant, x2 = −0.10):
```
## Effect of profile shift on the pinion (z 19, helical default)
  x1 -0.20: a_w 81.170, eps_a 1.664, s_a1 1.60, Y_F1 1.730, S_F1 2.79, S_H 1.28
  x1 +0.00: a_w 81.585, eps_a 1.602, s_a1 1.47, Y_F1 1.475, S_F1 2.96, S_H 1.29
  x1 +0.25: a_w 82.083, eps_a 1.520, s_a1 1.27, Y_F1 1.277, S_F1 3.05, S_H 1.28
  x1 +0.50: a_w 82.562, eps_a 1.436, s_a1 1.06, Y_F1 1.171, S_F1 3.04, S_H 1.28
```
x1 from −0.20 to +0.50: Y_F1 falls 1.730 → 1.171 (root stronger, S_F1 2.79 → 3.04), but ε_α falls 1.664 → 1.436 and
the tip thickness 1.60 → 1.06 mm (still above 0.4 m_n = 0.8 mm for case hardening at x1 = 0.50). The pitting
safety stays ≈ 1.28: profile shift helps the root, not the flank. The default x1 = 0.25 is a sensible compromise;
x1 ≈ 0.34 would balance sliding.

### 3.8 MATLAB equivalent
```matlab
inv = @(a) tan(a) - a;
an = deg2rad(20); be = deg2rad(15); mn = 2; z1 = 19; z2 = 60; x1 = 0.25; x2 = -0.10;
at = atan(tan(an)/cos(be)); mt = mn/cos(be); d1 = mt*z1; d2 = mt*z2; a0 = (d1+d2)/2;
y  = 2*tan(an)*(x1+x2)/(z1+z2) + inv(at);
awt = fzero(@(a) inv(a) - y, at);                 % working pressure angle
aw  = a0*cos(at)/cos(awt)                         % 82.083 mm
db1 = d1*cos(at); db2 = d2*cos(at); k = (a0 + (x1+x2)*mn - aw)/mn;
da1 = d1 + 2*mn*(1 + x1 - k); da2 = d2 + 2*mn*(1 + x2 - k);
ga  = 0.5*(sqrt(da1^2-db1^2) + sqrt(da2^2-db2^2)) - aw*sin(awt);
ea  = ga/(pi*mt*cos(at))                          % 1.520
```

### 3.9 Check questions
1. Derive inv α from the string model. Why is the force direction constant?
2. Why is z_min smaller for a helical gear (15.54) than for a spur gear (17.10)?
3. With the housing fixed at a_w = 82.5 mm, how do you find x1 + x2? (Hint: `geometry(dict(P, a_w=82.5))`.)
4. Why should the pinion get the larger profile shift?
5. Your case-hardened pinion has s_a = 0.6 mm at m_n = 2. Acceptable? What do you change?

---

## 4 Forces, torque, efficiency and the shaft/bearing hand-over

> Program: `forces()` in `tools/gear.py`; chapter functions `mesh_loss()`, `pinion_shaft_loads()`,
> `bearing_handover()` (use `shaft.py` M3 and `bearing.py` M4). Extra results: `python gear.py ch24` (blocks 4.x).

### 4.1 Tooth forces

The normal force F_n acts along the line of action (normal to the flank, in the normal plane). Split it at the working
pitch circle in the transverse plane and along the axis:

  **T1 = P / ω1,  F_t = 2 T1 / d1,  F_r = F_t tan α_wt,  F_a = F_t tan β,  F_n = √(F_t² + F_r² + F_a²)**

(The program uses d1 for F_t – the ISO 6336 convention; the radial force uses the working pressure angle.)
```python
def forces(P, g):
    T1 = P["P_kW"] * 1000 / (P["n1_rpm"] * 2 * math.pi / 60)          # N m
    Ft = 2 * T1 * 1000 / g["d1"]                                         # N (at the reference circle)
    Fr = Ft * math.tan(g["awt"])                                         # radial (working pressure angle)
    Fa = Ft * math.tan(math.radians(P["beta_deg"]))
    v = math.pi * g["d1"] / 1000 * P["n1_rpm"] / 60                       # m/s
    return {"T1": T1, "T2": T1 * g["u"], "Ft": Ft, "Fr": Fr, "Fa": Fa, "Fn": math.sqrt(Ft ** 2 + Fr ** 2 + Fa ** 2),
            "v": v, "n2": P["n1_rpm"] / g["u"]}
```
**Run it:** `python gear.py ch24` (block 4.1)
```
== 4.1 forces: T1 98.79 N m, Ft 5022.1, Fr 1946.8, Fa 1345.7, Fn 5551.8 N, v 2.987 m/s
```
15 kW at 1450 rpm → T1 = 98.79 N m; F_t = 5022 N, F_r = 1947 N, F_a = 1346 N; v = 2.99 m/s (pitch-line speed:
< 5 m/s is "slow"; the dynamic factor stays small, chapter 5).

**Directions (memorise).**
- F_t on the **driving** pinion acts **against** its rotation; on the driven wheel **with** its rotation.
- F_r always points **towards each gear centre** (external gears).
- F_a on helical gears: use the **hand rule** – for the driver, right-hand helix → use the right hand, fingers in the
  direction of rotation, thumb shows the axial force on the driver; left-hand helix → left hand. The driven gear gets
  the opposite force. Pinion and wheel of a pair have opposite hands.
- On a shaft with two helical gears, choose the hands so that the axial forces **cancel** (intermediate shafts).

### 4.2 Mesh efficiency and power loss

The sliding of 3.6 with a friction coefficient μ_m costs power. Ohlendorf's gear loss factor integrates the sliding
along the path of contact (published by Niemann/Winter; check the method in your reference):

  **P_V = P μ_m H_V,  H_V = π (u + 1) / (z1 u cos β_b) · (1 − ε_α + ε_1² + ε_2²),  η = 1 − μ_m H_V**

ε_1 = CE / p_bt (recess), ε_2 = AC / p_bt (approach). μ_m ≈ 0.04 … 0.07 for mineral oil, lower for synthetic oils
and ground flanks (typical, check).
```python
def mesh_loss(P, mu_m=0.05):
    """Tooth mesh power loss (Ohlendorf / Niemann): P_V = P mu_m H_V with the gear loss factor
    H_V = pi (u + 1) / (z1 u cos(beta_b)) (1 - eps_a + eps_1^2 + eps_2^2), eps_1 = E-side, eps_2 = A-side addendum
    contact ratios. mu_m ~ 0.04 ... 0.07 for mineral oil (check). eta = 1 - mu_m H_V."""
    g = geometry(P)
    cp = contact_points(P, g)
    e1 = (cp["E"] - cp["C"]) / g["pbt"]            # recess (pinion tip side)
    e2 = (cp["C"] - cp["A"]) / g["pbt"]            # approach
    HV = math.pi * (g["u"] + 1) / (P["z1"] * g["u"] * math.cos(g["bb"])) * (1 - g["ea"] + e1 ** 2 + e2 ** 2)
    PV = P["P_kW"] * 1000 * mu_m * HV
    return {"eps1": e1, "eps2": e2, "HV": HV, "PV_W": PV, "eta": 1 - mu_m * HV}
```
**Run it:** `python gear.py ch24` (block 4.2)
```
== 4.2 mesh loss mu_m 0.04: eps1 0.857, eps2 0.664, H_V 0.1468 -> P_V 88 W, eta 0.9941
== 4.2 mesh loss mu_m 0.05: eps1 0.857, eps2 0.664, H_V 0.1468 -> P_V 110 W, eta 0.9927
== 4.2 mesh loss mu_m 0.07: eps1 0.857, eps2 0.664, H_V 0.1468 -> P_V 154 W, eta 0.9897
```
H_V = 0.147 → **P_V ≈ 90–150 W of 15 kW, η ≈ 99.0–99.4 %** for the mesh alone. Bearings (M4, a few W each at this
size, more for tapered), seals and oil churning add to this; a single helical stage typically reaches 97–98.5 % in
total (typical, check). The heat must leave through the housing: oil temperature → viscosity → κ (M4) → life.

### 4.3 Hand-over to the shaft (M3) and the bearings (M4)

Pinion on a shaft with bearings at x = 0 (A, locating) and x = L = 100 mm (B, floating), gear in the middle (a = 50 mm)
– example values. The radial plane (y) gets F_r **and the couple** M = F_a · d1/2, because F_a acts at the pitch
radius, not on the axis. The tangential plane (z) gets F_t. Moment balance about A:

  y: R_B,y L = F_r a − F_a d1/2 (sign by direction),  z: R_B,z L = F_t a;  R_A = F − R_B in each plane;
  A also carries the full axial force F_a.

```python
def pinion_shaft_loads(P, L=100.0, a=50.0):
    """Bearing reactions of the pinion shaft: bearings at x = 0 (A, locating) and x = L (B), pinion at x = a.
    Planes: y = radial Fr (towards the wheel centre) + couple from the axial force Fa d1/2; z = tangential Ft.
    Moment balance about A: R_B L = F a +/- Fa d1/2. A carries Fa (locating). Cross-check of the Ft/Fr part with
    shaft.reactions()."""
    import shaft
    g = geometry(P)
    F = forces(P, g)
    Mfa = F["Fa"] * g["d1"] / 2                          # N mm couple in the y-plane
    RBy = -(-F["Fr"] * a + Mfa) / L                      # forces: -Fr at x = a (y), couple +Mfa
    RAy = F["Fr"] - RBy
    RBz = F["Ft"] * a / L
    RAz = F["Ft"] - RBz
    S = dict(shaft.DEFAULT, segments=[[L, 30, 0]], bearings=[0.0, L], forces=[[a, -F["Fr"], -F["Ft"], "gear"]])
    R = shaft.reactions(S)
    check = abs(R["z"][1] - RBz) < 1e-9 and abs(R["y"][0] + R["y"][1] - F["Fr"]) < 1e-9
    return {"Mfa_Nm": Mfa / 1000, "RA": math.hypot(RAy, RAz), "RB": math.hypot(RBy, RBz), "RAy": RAy, "RAz": RAz,
            "RBy": RBy, "RBz": RBz, "Fa": F["Fa"], "shaft_check": check}
```
```python
def bearing_handover(P, L=100.0, a=50.0):
    """Feed the pinion shaft reactions into bearing.py: A = 6206 (locating, takes Fa) or 30206; B = 6206 or NU206 floating."""
    import bearing
    r = pinion_shaft_loads(P, L, a)
    BP = dict(bearing.DEFAULT, oil_VG=68, oil_temp_C=70.0, cleanliness="normal cleanliness")
    out = {}
    for name, Fr, Fa in (("6206", r["RA"], r["Fa"]), ("30206", r["RA"], r["Fa"]), ("6206 B", r["RB"], 0.0), ("NU206 B", r["RB"], 0.0)):
        b = bearing.CATALOGUE[name.split()[0]]
        eq = bearing.equivalent_dynamic(b, Fr, Fa)
        ml = bearing.modified_life(b, eq["P"], P["n1_rpm"], BP)
        out[name] = {"Fr": Fr, "Fa": Fa, "P": eq["P"], "X": eq["X"], "Y": eq["Y"], "L10h": ml["L10h"], "Lnmh": ml["Lnmh"],
                     "kappa": ml["kappa"], "a_iso": ml["a_iso"]}
    return r, out
```
**Run it:** `python gear.py ch24` (block 4.3)
```
== 4.3 pinion shaft (bearings 0 / 100 mm, gear at 50): couple Fa d1/2 26.47 N m; A: y 1238.1 z 2511.0 -> 2799.7 N; B: y 708.7 z 2511.0 -> 2609.1 N; Fa 1345.7 N on A; shaft.py check True
  6206    Fr 2800 Fa 1346 -> P 3437 N (X 0.56 Y 1.39), L10h 2369, kappa 1.15, a_ISO 1.94, L_nm 4595 h
  30206   Fr 2800 Fa 1346 -> P 3273 N (X 0.40 Y 1.60), L10h 49141, kappa 1.15, a_ISO 4.17, L_nm 205015 h
  6206 B  Fr 2609 Fa 0 -> P 2609 N (X 1.00 Y 0.00), L10h 5413, kappa 1.15, a_ISO 2.73, L_nm 14779 h
  NU206 B Fr 2609 Fa 0 -> P 2609 N (X 1.00 Y 0.00), L10h 141361, kappa 1.15, a_ISO 5.71, L_nm 807054 h
```
**Interpretation (important for real design).**
- The axial-force couple 26.5 N m makes the two bearing loads **unequal** in the y-plane (1238 vs 709 N) – forget it and
  one bearing is under-designed. The Ft/Fr part is cross-checked against `shaft.reactions()` (True).
- **A deep-groove 6206 as locating bearing fails:** F_a/F_r = 0.48 > e → P = 3437 N, L_nm only **4 595 h**
  (target 20 000 h, oil VG 68 at 70 °C, normal cleanliness). A **30206 tapered roller bearing** (mounted as an
  adjusted pair, chapter M4 §3) gives L_nm ≈ 205 000 h. For the floating side, 6206 (14 779 h) is also too short;
  **NU206** gives ≈ 807 000 h.
- This is why industrial helical reducers use tapered roller bearings (or angular-contact pairs) on the pinion shaft.
- Next steps: feed the reactions as `forces` into `shaft.py` (M3: moments, deflection, DIN 743 proof at the pinion
  shoulder and keyway) and run `bearing.py` with `use_crank_loads: false` and these loads (M4).

### 4.4 Manufacturing / practice
- **Shaft deflection at the mesh** tilts the teeth → face load factor K_Hβ (chapter 5). Keep the pinion between the
  bearings, close to the bearing that carries more load, and check the slope with `shaft.py` (M3 §5).
- **Pinion shaft vs pinion on a shaft:** at d_f1 = 35.3 mm and a 30 mm shaft there is no room for a keyway hub →
  make the pinion **integral with the shaft** (common for z1 < ~20). The bearing seats are ground in the same set-up as
  the flank reference (between centres).
- **Axial location:** the locating bearing must carry F_a in both directions if the drive reverses (pallet changer!).
- **Lubrication:** at v ≈ 3 m/s splash (dip) lubrication is fine (typical up to ~15 m/s, check); the wheel dips 1–3 × m_n.

### 4.5 MATLAB equivalent
```matlab
P = 15e3; n1 = 1450; w1 = 2*pi*n1/60; T1 = P/w1;          % 98.79 N m
d1 = 39.340e-3; awt = deg2rad(21.189); be = deg2rad(15);
Ft = 2*T1/d1; Fr = Ft*tan(awt); Fa = Ft*tan(be);         % 5022, 1947, 1346 N
L = 0.100; a = 0.050; M = Fa*d1/2;                         % couple 26.47 N m
RBy = (Fr*a - M)/L; RAy = Fr - RBy; RBz = Ft*a/L; RAz = Ft - RBz;
RA = hypot(RAy, RAz), RB = hypot(RBy, RBz)                 % 2800 / 2609 N
```

### 4.6 Check questions
1. Derive F_r and F_a from F_n. Why does the program use α_wt for F_r?
2. Right-hand pinion, driving, rotating counter-clockwise seen from the coupling side: which way does F_a act?
3. Why does the axial force make the two bearing loads different?
4. Why does the 6206 fail as locating bearing although its C is 20.3 kN?
5. Estimate the mesh loss of the default stage at 7.5 kW (H_V does not change with power).


---

## 5 Load capacity in the style of ISO 6336

> Programs: `capacity()`, `KV_factor()`, `KFbeta()`, `ZH()`, `ZE()`, `Zeps()`, `Zbeta()`, `form_factor_B()`, `Ybeta()` in
> `tools/gear.py`, plus the chapter-5 functions `KA_TABLE`, `resonance_ratio()`, `KHbeta_estimate()`, `ZNT()`, `YNT()`,
> `life_effect()`, `form_factor_steps()`, `methodC_compare()`, `module_study()`, `width_study()`, `helix_study()`,
> `material_study()`, `max_power()`, `flash_temperature()`, `film_thickness()`, `vg_for_speed()`.
> All extra numbers of this chapter: `python gear.py ch5`. Default pair: 15 kW, 1450 rpm, mn 2, z 19/60, β 15°,
> x +0.25/−0.10, b 28 mm, 18CrNiMo7-6 case hardened. **All values are example values.** The ISO 6336 parts are
> implemented in a simplified form – every factor marked "check ISO 6336" must be compared with the standard
> (ISO 6336-1/-2/-3/-5:2019) before a design report is signed.

### 5.1 How gears fail – and which failure governs which design

A gear tooth is a short, thick cantilever (tooth root) with a curved, rolling-sliding surface (flank). Each mode has its
own cause and its own calculation:

| Failure mode | What you see | Cause | Calculation | Governs typically |
|---|---|---|---|---|
| **Pitting** (macropitting) | Craters on the flank near the pitch line | Rolling contact fatigue under Hertz pressure | ISO 6336-2 (σ_H) | Hardened, well-lubricated industrial gears – **our default pair** |
| **Tooth root breakage** | Whole tooth breaks at the root fillet | Bending fatigue (or overload) | ISO 6336-3 (σ_F) | Small modules, few teeth, shock loads, through-hardened gears at high hardness |
| **Scuffing** | Welded and torn stripes in sliding direction | Oil film breaks at high temperature + sliding | ISO/TS 6336-20/-21 (flash / integral temperature) | High speed, high load, thin oil, tip regions |
| **Micropitting** | Grey frosted area, fine cracks | Thin film (λ < 1), high sliding | ISO/TS 6336-22 | Case-hardened ground gears with low viscosity oil |
| **Wear** | Profile lost, backlash grows | Abrasive particles, boundary lubrication, low speed | Experience, oil cleanliness | Slow, dirty, open gears |
| **Tooth flank fracture** | Crack starts below the surface (case/core) | Subsurface shear in large case-hardened gears | ISO/TS 6336-4 | Large modules (mn > ~8), thin case |

Rule of thumb for steel gears:
- **Soft / through-hardened (QT, normalised)**: pitting governs, the root is usually far away.
- **Case hardened / nitrided**: the flank is very strong, so the module (root) and pitting are often close; with
  modern ground flanks pitting still governs at medium modules (our pair: S_H 1.28 vs S_F 2.9).
- **Very small modules** (mn ≤ 1.5) or **few teeth**: root breakage governs.

**Check questions**
1. Which failure is a surface fatigue and which is a bending fatigue?
2. Why do soft gears fail by pitting long before the root breaks?

### 5.2 Structure of ISO 6336 and the general factors

ISO 6336 (2019) has these parts used here:

| Part | Content |
|---|---|
| ISO 6336-1 | Basic principles, general influence factors (K_A, K_V, K_Hβ, K_Fβ, K_Hα, K_Fα) |
| ISO 6336-2 | Surface durability (pitting): σ_H, σ_HP, Z-factors |
| ISO 6336-3 | Tooth bending strength: σ_F, σ_FP, Y-factors (form factor methods B and C) |
| ISO 6336-5 | Strength and quality of materials: σ_Hlim, σ_Flim (qualities ML / MQ / ME) |
| ISO 6336-6 | Service life under variable load (load spectra, Miner) |
| ISO/TS 6336-20/-21/-22, ISO/TS 6336-4 | Scuffing, micropitting, tooth flank fracture |

**Methods A / B / C**: A = measurement or full analysis (FEM, tests); B = detailed formulas (what most gear programs
use); C = simplified formulas with assumptions. `gear.py` uses method-B form factors and method-C-style K_V and K_Hβ.

The two basic equations (both use the nominal tangential force F_t at the reference circle):

```
pitting:      sigma_H = sigma_H0 * sqrt(K_A K_V K_Hbeta K_Halpha)      <=  sigma_HP = sigma_Hlim Z_NT Z_L Z_V Z_R Z_W Z_X / S_Hmin
tooth root:   sigma_F = sigma_F0 *       K_A K_V K_Fbeta K_Falpha       <=  sigma_FP = sigma_Flim Y_ST Y_NT Y_drelT Y_RrelT Y_X / S_Fmin
safety:       S_H = sigma_Hlim Z... / sigma_H        S_F = sigma_Flim Y_ST Y... / sigma_F
```

Pitting stress grows with √load (Hertz), root stress grows linearly with load – this is why the load factors appear
under a square root for pitting.

**Application factor K_A** – the ratio of the real peak torque to the nominal torque that the drive train brings from
outside the gear. Typical values (check ISO 6336-6 annex):

**Run it:** `python gear.py ch5` (first block)
```
== 5.2 application factors (typical)
  electric motor -> uniform (generator, conveyor belt, fan)              K_A 1.00
  electric motor -> light shocks (machine tool main drive, pumps)        K_A 1.25
  electric motor -> moderate shocks (piston compressor, mixer, hoist)    K_A 1.50
  electric motor -> heavy shocks (crusher, press, rolling mill)          K_A 1.75
  multi-cylinder engine -> moderate shocks                               K_A 1.75
```
The default uses K_A = 1.25. A gear that drives our piston compressor directly would need about 1.5, or better a
**measured or calculated torque spectrum** (M2 gives the full torque curve: T_max/T_mean = 47.77/10.41 = 4.6 – so for a
compressor the spectrum method of ISO 6336-6 is the honest one).

**Check questions**
1. Why is K_A under the square root for pitting but not for the root?
2. Which K_A would you choose for a gear on the AS/RS crane hoist?

### 5.3 Dynamic factor K_V and the resonance check

**Theory.** The tooth pair is a spring (mesh stiffness c_γ per mm of face width) between two rotating masses. Each tooth
engagement is an impulse with the mesh frequency f_z = z1 n1/60. If f_z is near the natural frequency of the gear pair,
the dynamic tooth force can be many times the static force. ISO 6336-1 reduces both gears to masses on the line of action:

```
m_i* = J_i* / r_bi^2 = pi/8 * (d_mi / d_bi)^2 * d_mi^2 * rho        [kg per mm face width, solid gear]
1/m_red = 1/m1* + 1/m2*
n_E1 = 30000 / (pi z1) * sqrt(c_gamma / m_red)                       [rpm, c_gamma in N/(mm um), m_red in kg/mm]
N = n1 / n_E1        N <= 0.85 subcritical | 0.85 ... 1.15 main resonance (avoid) | above: intermediate / supercritical
```

Then, in the **subcritical range**, the method-C-style formula used by `gear.py`:

```
K_V = 1 + ( K1 / (K_A F_t / b) + K2 ) * z1 v / 100 * sqrt( u^2 / (1 + u^2) )
K1 from the accuracy grade (spur / helical), K2 = 0.0193 (spur) / 0.0087 (helical);  K_A F_t / b >= 100 N/mm
```

The first term grows with **worse accuracy** (larger K1) and with **lighter load** (pitch errors matter more when the
teeth are not pressed hard); the second with speed.

**In the program**
```python
_KV = {"spur": {5: 7.5, 6: 14.9, 7: 26.8, 8: 39.1, 9: 52.8, 10: 76.6}, "helical": {5: 6.7, 6: 13.3, 7: 23.9, 8: 34.8, 9: 47.0, 10: 68.2}}
def KV_factor(P, g, F):
    kind = "spur" if P["beta_deg"] == 0 else "helical"
    K1 = _KV[kind][int(P["accuracy_grade"])]
    K2 = 0.0193 if kind == "spur" else 0.0087
    w = max(P["KA"] * F["Ft"] / P["b"], 100.0)
    return 1 + (K1 / w + K2) * P["z1"] * F["v"] / 100 * math.sqrt(g["u"] ** 2 / (1 + g["u"] ** 2))
```
and the new resonance check:
```python
def resonance_ratio(P, rho=7.83e-6, c_gamma=20.0):
    g = geometry(P)
    def mstar(i):
        dm = (g["da%d" % i] + g["df%d" % i]) / 2
        return math.pi / 8 * (dm / g["db%d" % i]) ** 2 * dm ** 2 * rho
    m1, m2 = mstar(1), mstar(2)
    mred = m1 * m2 / (m1 + m2)
    nE1 = 30000 / (math.pi * P["z1"]) * math.sqrt(c_gamma / mred)
    N = P["n1_rpm"] / nE1
    zone = "subcritical (N <= 0.85)" if N <= 0.85 else ("main resonance - avoid (0.85 < N <= 1.15)" if N <= 1.15 else "intermediate / supercritical")
    return {"m1": m1, "m2": m2, "m_red": mred, "nE1": nE1, "N": N, "zone": zone}
```

**Run it:** `python gear.py ch5`
```
== 5.3 dynamic factor and resonance
  m1* 5.714e-03, m2* 5.263e-02, m_red 5.154e-03 kg/mm; n_E1 31307 rpm; N = n1/n_E1 = 0.046 -> subcritical (N <= 0.85)
  K_V (grade 6) = 1.0368; grade 8: 1.0887; spur (beta 0, grade 6): 1.0436
```

**Interpretation.** The small pinion is light and the mesh stiff, so the pair resonates only at ~31 000 rpm – our
1450 rpm is far below (N = 0.05). K_V is only 1.04 at grade 6; grade 8 (normal hobbed, not ground) gives 1.09 – still
small at v = 3 m/s. K_V becomes important for fast drives (v > 20 m/s, turbo gears, spindle gearboxes): then grade 4–5
and method B are needed.

**Practice.** The accuracy grade costs money: hobbing reaches grade 7–9, shaving 6–7, profile grinding 4–6 (ISO 1328-1,
typical). For our 3 m/s reducer grade 6–7 is enough; the case-hardened gear must be ground anyway to remove the
hardening distortion.

**MATLAB**
```matlab
mstar = @(dm, db) pi/8*(dm/db)^2*dm^2*7.83e-6;
mred = 1/(1/mstar(39.84,36.81) + 1/mstar(123.33,116.25));
nE1 = 30000/(pi*19)*sqrt(20/mred)        % about 31 300 rpm
```
(d_m = (d_a + d_f)/2 of each gear.)

**Check questions**
1. What happens to K_V when the load is reduced to 20 % (same speed)? Why?
2. Calculate N for a pinion with z1 = 19 running at 30 000 rpm.

### 5.4 Face load factor K_Hβ, K_Fβ and transverse factor K_Hα

**Theory.** The load is not uniform across the face width b. The shafts bend (f_sh), the housing bores are not parallel,
the helix of the teeth has errors (f_Hβ) – together the **effective mesh misalignment F_βy** (µm, after running-in). With
the mesh stiffness c_γ, a misalignment F_βy over the face width means the teeth at one end are pressed F_βy deeper. Two
cases (method-C-style, check ISO 6336-1):

```
F_m/b = F_t K_A K_V / b                        mean line load
q = F_betay c_gamma / (2 F_m/b)
q <= 1 (contact over the full width):  K_Hbeta = 1 + q
q  > 1 (contact only on part of b):    K_Hbeta = sqrt(2 F_betay c_gamma / (F_m/b))
```

The root sees a smaller effect because the tooth "spreads" the load over a wider zone (beam action):

```
K_Fbeta = K_Hbeta ^ N_F ,    N_F = (b/h)^2 / (1 + b/h + (b/h)^2) ,   h = tooth height = (h_aP + h_fP) mn
```

K_Hα (transverse load distribution between the tooth pairs in contact, from pitch errors) is about 1.0 for accurate
(grade ≤ 6), well-loaded gears; it can reach 1.1–1.4 for poor accuracy. The default uses K_Hα = K_Fα = 1.0.

**In the program**
```python
def KFbeta(KHb, b, h):
    r = b / h
    NF = r * r / (1 + r + r * r)
    return KHb ** NF

def KHbeta_estimate(P, F_betay_um, c_gamma=20.0):
    g = geometry(P)
    F = forces(P, g)
    KV = KV_factor(P, g, F)
    w = F["Ft"] * P["KA"] * KV / P["b"]
    q = F_betay_um * c_gamma / (2 * w)
    K = 1 + q if q <= 1 else math.sqrt(2 * F_betay_um * c_gamma / w)
    return {"Fm_b": w, "q": q, "KHbeta": K}
```

**Run it:** `python gear.py ch5`
```
== 5.4 face load factor
  F_betay  5 um: F_m/b 232.5 N/mm, q 0.215 -> K_Hbeta 1.215, K_Fbeta 1.178
  F_betay 10 um: F_m/b 232.5 N/mm, q 0.430 -> K_Hbeta 1.430, K_Fbeta 1.352
  F_betay 15 um: F_m/b 232.5 N/mm, q 0.645 -> K_Hbeta 1.645, K_Fbeta 1.521
  F_betay 25 um: F_m/b 232.5 N/mm, q 1.075 -> K_Hbeta 2.074, K_Fbeta 1.849
  F_betay 40 um: F_m/b 232.5 N/mm, q 1.721 -> K_Hbeta 2.624, K_Fbeta 2.254
  b/h = 6.222 -> N_F = 0.8428; K_Fbeta = 1.25^N_F = 1.2069
```

**Interpretation.** The default K_Hβ = 1.25 corresponds to an effective misalignment of only ~6 µm across 28 mm – a good,
stiff, ground and crowned gear in a precise housing. 15 µm already gives 1.65 and costs 22 % of pitting capacity
(S_H ∝ 1/√K_Hβ). **K_Hβ is the factor that design and manufacturing control most:**

| Measure | Effect on F_βy |
|---|---|
| Short, stiff shafts, bearings close to the gear (M3 slope!) | smaller f_sh |
| Housing bores machined in one set-up, parallelism ≤ 0.01/100 | smaller f_ma |
| Helix crowning / end relief (ground flank modification 5–15 µm) | load moves to the centre, K_Hβ ≈ 1.1–1.3 |
| Gear in the middle between bearings, not overhung | symmetric deflection |
| b/d1 ≤ 1 (here 28/39.3 = 0.71) | less sensitivity to twist |

Link to M3: the shaft slope at the gear (shaft.py `deflection_summary`) times the face width gives a first f_sh
estimate: e.g. 0.2 mrad × 28 mm = 5.6 µm.

**MATLAB**
```matlab
w = 5022*1.25*1.0368/28;  q = 10*20/(2*w);  KHb = 1 + q          % 1.43 for 10 um
r = 28/4.5;  NF = r^2/(1+r+r^2);  KFb = KHb^NF
```

**Check questions**
1. Why is K_Fβ smaller than K_Hβ?
2. A shaft slope of 0.5 mrad at the pinion: estimate f_sh and K_Hβ.

### 5.5 Pitting: from Hertz to σ_H

**Derivation.** At the pitch point C both flanks are involutes; their radii of curvature are the lengths along the line
of action from the base-circle tangent points: ρ1 = (d_w1/2) sin α_wt, ρ2 = (d_w2/2) sin α_wt. Two cylinders pressed
together along a line (Hertz):

```
p_max^2 = F_n / (pi b_eff) * (1/rho1 + 1/rho2) / ( (1 - nu1^2)/E1 + (1 - nu2^2)/E2 )
```

For a spur gear: F_n = F_t / cos α, and 1/ρ1 + 1/ρ2 = 2/(d1 sin α) · (u + 1)/u. Put together:

```
p_max = sqrt( 1 / (pi ((1-nu1^2)/E1 + (1-nu2^2)/E2)) )  *  sqrt( 2 / (sin a cos a) )  *  sqrt( F_t/(d1 b) * (u+1)/u )
       =            Z_E                                 *          Z_H              *  sqrt( F_t/(d1 b) * (u+1)/u )
```

For helical gears with profile shift the same idea gives (ISO 6336-2):

```
sigma_H0 = Z_H Z_E Z_eps Z_beta * sqrt( F_t / (d1 b) * (u + 1) / u )
Z_H     = sqrt( 2 cos(beta_b) cos(alpha_wt) / (cos^2(alpha_t) sin(alpha_wt)) )        zone factor
Z_E     = sqrt( 1 / (pi ((1 - nu1^2)/E1 + (1 - nu2^2)/E2)) )  = 189.8 sqrt(MPa) steel/steel (E 206 000)
Z_eps   = sqrt( (4 - eps_a)/3 (1 - eps_b) + eps_b/eps_a )  (eps_b < 1) ;  sqrt(1/eps_a) (eps_b >= 1)
Z_beta  = 1 / sqrt(cos beta)
sigma_H = sigma_H0 sqrt(K_A K_V K_Hbeta K_Halpha)
```

Z_ε takes into account that the load is shared by more than one tooth pair (helical gears: the contact lines are longer
than b). The selftest proves that `Z_H Z_E sqrt(...)` equals the Hertz line contact at the pitch point (1822.7 MPa for
the test pair, difference < 10⁻⁶). ISO 6336-2 also has **single pair contact factors Z_B (pinion) and Z_D (wheel)**:
for spur gears with ε_α < 2 the stress at the inner point of single contact can be higher than at C, then σ_H is
multiplied by Z_B > 1. For helical gears with ε_β ≥ 1 (our case) Z_B = Z_D = 1. `gear.py` uses 1 (check for spur gears
with few teeth).

**In the program**
```python
def ZH(g):
    return math.sqrt(2 * math.cos(g["bb"]) * math.cos(g["awt"]) / (math.cos(g["at"]) ** 2 * math.sin(g["awt"])))

def ZE(m1, m2):
    return math.sqrt(1 / (math.pi * ((1 - m1["nu"] ** 2) / m1["E"] + (1 - m2["nu"] ** 2) / m2["E"])))

def Zeps(ea, eb):
    if eb >= 1:
        return math.sqrt(1 / ea)
    return math.sqrt((4 - ea) / 3 * (1 - eb) + eb / ea)

def Zbeta(beta_deg):
    return 1 / math.sqrt(math.cos(math.radians(beta_deg)))
```
and in `capacity()`:
```python
    zh, ze, zeps, zb = ZH(g), ZE(m1, m2), Zeps(g["ea"], g["eb"]), Zbeta(P["beta_deg"])
    sH0 = zh * ze * zeps * zb * math.sqrt(F["Ft"] / (g["d1"] * P["b"]) * (g["u"] + 1) / g["u"])
    sH = sH0 * math.sqrt(K_H)
```

**Run it:** `python gear.py ch5`
```
== 5.5 pitting
  Ft 5022.1 N, d1 39.340, b 28.0, u 3.1579 -> sqrt(Ft/(d1 b) (u+1)/u) = 2.450
  Z_H 2.3906, Z_E 189.81, Z_eps 0.8110, Z_beta 1.0175 -> sigma_H0 917.4 MPa; K_H = K_A K_V K_Hb K_Ha = 1.6200 -> sigma_H 1167.6 MPa
  sigma_HP (Z_NT=1) 1500 MPa -> S_H 1.285
```

Hand check: 2.3906 × 189.81 × 0.8110 × 1.0175 × 2.450 = 917.4 MPa; √(1.25 × 1.0368 × 1.25 × 1.0) = √1.620 = 1.273;
917.4 × 1.273 = 1167.6 MPa. S_H = 1500/1167.6 = 1.285.

**Interpretation.** The flank of the pinion sees 1168 MPa contact pressure 1450 times per minute – 1.74·10⁹ times in
20 000 h. Case-hardened 18CrNiMo7-6 (quality MQ) allows 1500 MPa. Note: with ε_β = 1.153 ≥ 1 the program uses
Z_ε = √(1/ε_α) = √(1/1.520) = 0.811. A helix angle of 15° gives Z_β = 1.017 (slightly worse) but Z_ε much better than spur.

**Permissible stress.**
```
sigma_HP = sigma_Hlim * Z_NT * Z_L * Z_V * Z_R * Z_W * Z_X / S_Hmin
```
Z_NT life factor (5.6), Z_L Z_V Z_R lubricant / speed / roughness (product `ZLVR`, ground flanks ≈ 1.0, hobbed ≈ 0.92 –
check), Z_W work hardening (1 for equal hardness), Z_X size (1 for mn ≤ 10). S_Hmin = 1.0 is common for industrial
gears with known loads (1.2–1.3 when a pitting failure is dangerous or loads are uncertain – check your contract / AGMA
practice).

**MATLAB**
```matlab
ZH = sqrt(2*cosd(14.076)*cosd(21.189)/(cosd(20.647)^2*sind(21.189)));
ZE = sqrt(1/(pi*2*(1-0.3^2)/206000));
sH0 = ZH*ZE*sqrt(1/1.520)/sqrt(cosd(15))*sqrt(5022.1/(39.34*28)*(3.1579+1)/3.1579)
```

**Check questions**
1. Why does σ_H depend on (u + 1)/u? What happens for an internal gear pair?
2. Doubling the torque: by how much does σ_H rise?

### 5.6 Life factors Z_NT and Y_NT

**Theory.** σ_Hlim and σ_Flim are the **endurance limits** (long life). For fewer load cycles a higher stress is allowed;
for very many cycles (≫ 10⁹) ISO 6336 lets the curve fall slightly (no true endurance limit in rolling contact). The
life factor is read from S-N lines on log-log scale. Typical points for case-hardened steel (check ISO 6336-2/-3, the
values depend on material and the "normal / optimum" condition):

| | static | knee | 10¹⁰ cycles |
|---|---|---|---|
| Z_NT (pitting) | 1.6 at N ≤ 10⁵ | 1.0 at 5·10⁷ | 0.85 (normal) … 1.0 (optimum lubrication, clean, high quality) |
| Y_NT (root) | 2.5 at N ≤ 10³ | 1.0 at 3·10⁶ | 0.85 … 1.0 |

```
Z_NT(N) = log-linear interpolation between the points;  N = n * 60 * life_h
```

**In the program**
```python
def _loginterp(N, pts):
    if N <= pts[0][0]:
        return pts[0][1]
    for (n1, v1), (n2, v2) in zip(pts, pts[1:]):
        if N <= n2:
            t = (math.log10(N) - math.log10(n1)) / (math.log10(n2) - math.log10(n1))
            return v1 + t * (v2 - v1)
    return pts[-1][1]

def ZNT(N):
    return _loginterp(N, [(1e5, 1.6), (5e7, 1.0), (1e10, 0.85)])

def YNT(N):
    return _loginterp(N, [(1e3, 2.5), (3e6, 1.0), (1e10, 0.85)])
```

**Run it:** `python gear.py ch5`
```
== 5.6 life factors (20 000 h)
  gear 1: N 1.740e+09 -> Z_NT 0.900, Y_NT 0.882; S_H 1.156, S_F 2.687
  gear 2: N 5.510e+08 -> Z_NT 0.932, Y_NT 0.904; S_H 1.197, S_F 2.640
  N 1e+05: Z_NT 1.600, Y_NT 1.637
  N 1e+06: Z_NT 1.378, Y_NT 1.206
  N 1e+07: Z_NT 1.155, Y_NT 0.978
  N 5e+07: Z_NT 1.000, Y_NT 0.948
  N 1e+09: Z_NT 0.915, Y_NT 0.893
  N 1e+10: Z_NT 0.850, Y_NT 0.850
```

**Interpretation.** `capacity()` uses Z_NT = Y_NT = 1 (the endurance limit). For 20 000 h the pinion makes 1.74·10⁹
cycles; with the conservative "normal" line Z_NT = 0.90 and S_H drops from 1.285 to **1.156** – still ≥ 1.0. With
optimum lubrication and clean, high-quality steel the standard allows Z_NT closer to 1.0. Write in the report which line
you use. For a short-life gear (e.g. a positioning drive with 10⁶ cycles) Z_NT = 1.38 would allow a much smaller gear.
Variable loads (the compressor torque curve, or start/stop) are handled with ISO 6336-6: each load level gives cycles
n_i, the S-N curve gives N_i, damage D = Σ n_i/N_i ≤ 1 (Miner, M1 chapter 26).

**Check questions**
1. Why is the pinion more critical for life than the wheel?
2. A hoist gear runs 2 000 h at 100 rpm: compute N and Z_NT.

### 5.7 Tooth root: from Lewis to the ISO 6336-3 method B form factor

**Theory.** Lewis (1892): the tooth is a cantilever of constant strength (a parabola inside the tooth). The bending stress
at the weakest section is σ = 6 F h / (b s²). ISO 6336-3 refines this:

- the **critical section** is where a 30° tangent touches the root fillet (method B), its chord is s_Fn;
- the **load** acts at the **outer point of single tooth contact** (not at the tip – before that point a second pair
  shares the load), at a lever h_Fe and with the angle α_Fen to the tooth centre line;
- the **notch** at the fillet (radius ρ_F) raises the stress: stress correction factor Y_S.

```
Y_F = 6 (h_Fe/mn) cos(alpha_Fen) / ( (s_Fn/mn)^2 cos(alpha_n) )          tooth form factor (method B)
Y_S = (1.2 + 0.13 L) * q_s^( 1 / (1.21 + 2.3/L) ),  L = s_Fn/h_Fe,  q_s = s_Fn/(2 rho_F)     stress correction
Y_beta = 1 - eps_b* beta/120  (eps_b* = min(eps_b, 1), beta <= 30 deg)  helix factor
sigma_F0 = F_t / (b mn) * Y_F Y_S Y_beta     ( * Y_B Y_DT = 1 for solid gears, eps_alpha_n < 2 )
sigma_F  = sigma_F0 * K_A K_V K_Fbeta K_Falpha
```

The helical gear is replaced by a **virtual spur gear** with z_n = z / (cos²β_b cos β) teeth in the normal section.
The 30° tangent point is found from the generating basic rack (h_fP = 1.25 mn, ρ_fP = 0.38 mn) with an angle θ that
must be iterated:

```
E = pi/4 mn - h_fP tan(a_n) - (1 - sin a_n) rho_fP / cos a_n
G = rho_fP/mn - h_fP/mn + x
H = 2/z_n (pi/2 - E/mn) - pi/3
theta = 2 G / z_n * tan(theta) - H          (iterate, start pi/6)
s_Fn/mn  = z_n sin(pi/3 - theta) + sqrt(3) (G/cos(theta) - rho_fP/mn)
rho_F/mn = rho_fP/mn + 2 G^2 / ( cos(theta) (z_n cos^2(theta) - 2 G) )
```

**In the program** (first half of `form_factor_B()`: the 30° tangent)
```python
    hfP, rhofP = P["hfP"] * mn, P["rhofP"] * mn
    E = math.pi / 4 * mn - hfP * math.tan(an) + 0 / math.cos(an) - (1 - math.sin(an)) * rhofP / math.cos(an)
    G = rhofP / mn - hfP / mn + x
    H = 2 / zn * (math.pi / 2 - E / mn) - math.pi / 3
    th = math.pi / 6
    for _ in range(200):
        th_new = 2 * G / zn * math.tan(th) - H
        if abs(th_new - th) < 1e-12:
            break
        th = th_new
    sFn = mn * (zn * math.sin(math.pi / 3 - th) + math.sqrt(3) * (G / math.cos(th) - rhofP / mn))
    rhoF = mn * (rhofP / mn + 2 * G * G / (math.cos(th) * (zn * math.cos(th) ** 2 - 2 * G)))
```
(second half: the outer point of single contact on the virtual gear, lever h_Fe and the factors)
```python
    dn = mn * zn
    dbn = dn * math.cos(an)
    dan = dn + da - d
    ean = g["ea"] / math.cos(g["bb"]) ** 2
    den = 2 * math.sqrt((math.sqrt((dan / 2) ** 2 - (dbn / 2) ** 2) - math.pi * d * math.cos(be) * math.cos(an) / z * (ean - 1)) ** 2
                        + (dbn / 2) ** 2)
    aen = math.acos(dbn / den)
    ge = (math.pi / 2 + 2 * x * math.tan(an)) / zn + inv(an) - inv(aen)
    aFen = aen - ge
    hFe = 0.5 * mn * ((math.cos(ge) - math.sin(ge) * math.tan(aFen)) * den / mn - zn * math.cos(math.pi / 3 - th)
                      - G / math.cos(th) + rhofP / mn)
    YF = 6 * (hFe / mn) * math.cos(aFen) / ((sFn / mn) ** 2 * math.cos(an))
    L = sFn / hFe
    qs = sFn / (2 * rhoF)
    YS = (1.2 + 0.13 * L) * qs ** (1 / (1.21 + 2.3 / L))
```
d_en is the diameter of the virtual gear where the outer point of single contact lies: from the tip, go back one base
pitch times (ε_αn − 1) along the line of action.

**Run it – walkthrough with the default pinion:** `python gear.py ch5`
```
== 5.7 form factor walkthrough (pinion)
  z_n 20.907, E 0.1287 mm, G -0.6200, H -0.9031, theta 47.973 deg (15 iterations)
  s_Fn 4.189 mm, rho_F 0.976 mm, h_Fe 1.877 mm, alpha_Fen 20.824 deg, q_s 2.145 -> Y_F 1.2771, Y_S 2.0946
  wheel: z_n 66.022, theta 54.982 deg, s_Fn 4.377, rho_F 1.037, h_Fe 2.233 -> Y_F 1.4011, Y_S 1.9900
  Y_beta = 1 - min(eb,1) beta/120 = 0.8750
  sigma_F0 = Ft/(b mn) Y_F Y_S Y_beta = 209.9 MPa; K_F 1.5642 -> sigma_F 328.3; sigma_FE = 2 x 500 = 1000 -> S_F 3.046
  method B vs C (z 20, x 0, spur): Y_F Y_S 2.893 vs Y_Fa Y_Sa Y_eps = 4.35 x 0.7087 = 3.083
```

Step by step for the pinion (z 19, β 15°, x +0.25, mn 2):
1. Virtual number of teeth z_n = 19/(cos²14.076° cos 15°) = 20.907.
2. E = 0.1287 mm, G = 0.38 − 1.25 + 0.25 = −0.6200, H = −0.9031.
3. θ converges in 15 iterations to 47.97°.
4. Root chord s_Fn = 4.189 mm (= 2.09 mn), fillet radius ρ_F = 0.976 mm (= 0.49 mn), q_s = 4.189/(2 × 0.976) = 2.145.
5. Lever h_Fe = 1.877 mm, load angle α_Fen = 20.82°.
6. Y_F = 6 × (1.877/2) × cos 20.82° / ((4.189/2)² × cos 20°) = 1.277; Y_S = 2.095.
7. σ_F0 = 5022.1/(28 × 2) × 1.277 × 2.095 × 0.875 = 209.9 MPa.
8. K_F = K_A K_V K_Fβ K_Fα = 1.25 × 1.0368 × 1.2069 × 1.0 = 1.564 → σ_F = 328.3 MPa.
9. Permissible: σ_FE = σ_Flim Y_ST = 500 × 2 = 1000 MPa (Y_NT = Y_δrelT = Y_RrelT = Y_X = 1 in `capacity()`, check)
   → S_F = 1000/328.3 = **3.05** (wheel 2.92).

**Method B vs DIN method C.** The older DIN 3990 / method C puts the load at the **tip** (factors Y_Fa, Y_Sa) and
corrects for load sharing with Y_ε = 0.25 + 0.75/ε_α. For the standard test gear (z 20, x 0, spur): method B
Y_F Y_S = 2.893, method C 4.35 × 0.7087 = 3.083 – 6 % apart. Never mix factors of the two methods (Y_F of method B
with Y_ε of method C would be wrong by ~30 %).

**Permissible root stress.**
```
sigma_FP = sigma_Flim * Y_ST * Y_NT * Y_drelT * Y_RrelT * Y_X / S_Fmin       Y_ST = 2.0 (stress correction of the test gear)
```
Y_δrelT (relative notch sensitivity, ~1.0) and Y_RrelT (root roughness: ground / shot-peened root up to ~1.05, rough root
~0.95) – check ISO 6336-3. S_Fmin ≥ 1.4 is usual because a tooth breakage destroys the gearbox (pitting gives warning).

**Practice.** The root fillet is made by the **hob or the grinding wheel tip** – the program assumes the full basic rack
radius ρ_fP = 0.38 mn. A protuberance hob (undercut before grinding) avoids a grinding notch in the fillet; a
**ground root without protuberance** can lose 10–20 % root strength (grinding notch, burns). Shot peening the root after
case hardening raises σ_Flim (often quoted +10–20 %, check). Specify on the drawing: "root fillet not ground" or "root
ground with protuberance, no grinding step".

**Check questions**
1. Why is the load placed at the outer point of single contact and not at the tip?
2. What happens to Y_F and Y_S with a larger fillet radius ρ_fP?

### 5.8 The complete capacity() walkthrough

**In the program** (`capacity()`, load factors and the loop over both gears)
```python
    KV = KV_factor(P, g, F)
    h = (P["haP"] + P["hfP"]) * P["mn"]
    KFb = KFbeta(P["KHbeta"], P["b"], h)
    K_H = P["KA"] * KV * P["KHbeta"] * P["KHalpha"]
    K_F = P["KA"] * KV * KFb * P["KHalpha"]
    zh, ze, zeps, zb = ZH(g), ZE(m1, m2), Zeps(g["ea"], g["eb"]), Zbeta(P["beta_deg"])
    sH0 = zh * ze * zeps * zb * math.sqrt(F["Ft"] / (g["d1"] * P["b"]) * (g["u"] + 1) / g["u"])
    sH = sH0 * math.sqrt(K_H)
    ...
    for i, m in ((1, m1), (2, m2)):
        sHP = m["sHlim"] * P["ZLVR"] / 1.0          # Z_NT = Z_W = Z_X = 1 (long life, equal hardness) - check
        ff = form_factor_B(P, g, i)
        sF0 = F["Ft"] / (P["b"] * P["mn"]) * ff["YF"] * ff["YS"] * Yb
        sF = sF0 * K_F
        sFP = m["sFlim"] * 2.0 * 1.0                 # Y_ST = 2, Y_NT = Y_delta = Y_R = Y_X = 1 - check
```

**Run it:** `python gear.py examples` (load-capacity block of the report)
```
## Forces and speed
- T1 98.79 N m, T2 311.96 N m; Ft 5022 N, Fr 1947 N, Fa 1346 N; v 2.99 m/s; n2 459.2 rpm

## Load capacity (ISO 6336 style, simplified)
- K_A 1.25, K_V 1.037, K_Hbeta 1.25, K_Fbeta 1.207, K_Halpha 1.00
- Z_H 2.391, Z_E 189.8, Z_eps 0.811, Z_beta 1.017 -> sigma_H0 917 MPa, sigma_H 1168 MPa
- Y_beta 0.875
- gear 1: Y_F 1.277, Y_S 2.095 (s_Fn 4.19, h_Fe 1.88, rho_F 0.98 mm); sigma_F 328 MPa vs 1000 -> S_F 3.05; pitting S_H 1.28; OK
- gear 2: Y_F 1.401, Y_S 1.990 (s_Fn 4.38, h_Fe 2.23, rho_F 1.04 mm); sigma_F 342 MPa vs 1000 -> S_F 2.92; pitting S_H 1.28; OK
```

**Summary table of the default design**

| Item | Pinion | Wheel |
|---|---|---|
| σ_H / σ_HP | 1168 / 1500 MPa | 1168 / 1500 MPa (same contact) |
| S_H (Z_NT = 1) / with Z_NT for 20 000 h | 1.285 / 1.156 | 1.285 / 1.197 |
| σ_F / σ_FE | 328 / 1000 MPa | 342 / 1000 MPa |
| S_F (Y_NT = 1) / with Y_NT | 3.05 / 2.69 | 2.92 / 2.64 |
| Governing | **pitting** | pitting |

The wheel root is a little more loaded than the pinion root here because the negative profile shift (x2 = −0.10) makes
its root thinner – the pinion's +0.25 shift strengthened the pinion. This is the classic purpose of profile shift
(chapter 3): balance the roots and avoid undercut on the small gear.

**Check questions**
1. Which single number decides whether this reducer is acceptable?
2. Where would you see a problem first in a test run: on the pinion or on the wheel?

### 5.9 Sensitivity: module, face width, helix angle, material – and maximum power

**In the program** (new functions; example of one)
```python
def module_study(a_target=82.083, mns=(1.75, 2.0, 2.5, 3.0), x1=0.25):
    rows = []
    be = math.radians(DEFAULT["beta_deg"])
    for mn in mns:
        zs = 2 * a_target * math.cos(be) / mn
        z1 = round(zs / (1 + 60 / 19))
        z2 = int(math.floor(zs - z1))
        P = dict(DEFAULT, mn=mn, z1=z1, z2=z2, a_w=a_target, x1=x1, x2=0.0)
        xs = geometry(P)["xsum"]
        P["x2"] = xs - x1
        SH, SF, R = _safeties(P)
        rows.append({"mn": mn, "z1": z1, "z2": z2, "u": z2 / z1, "x2": P["x2"], "ea": R["g"]["ea"], "SH": SH, "SF": SF})
    return rows

def max_power(P, SH_req=1.0, SF_req=1.4):
    def solve(key):
        lo, hi = 0.1, 500.0
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            SH, SF, _ = _safeties(dict(P, P_kW=mid))
            okk = SH >= SH_req if key == "H" else SF >= SF_req
            lo, hi = (mid, hi) if okk else (lo, mid)
        return lo
    return {"P_pitting_kW": solve("H"), "P_root_kW": solve("F")}
```

**Run it:** `python gear.py ch5`
```
== 5.9 sensitivity
  mn 1.75: z 22/68 (u 3.091), x2 +0.075, eps_a 1.528 -> S_H 1.313, S_F 2.583
  mn 2.00: z 19/60 (u 3.158), x2 -0.100, eps_a 1.520 -> S_H 1.285, S_F 2.922
  mn 2.50: z 15/48 (u 3.200), x2 -0.023, eps_a 1.458 -> S_H 1.252, S_F 3.500
  mn 3.00: z 13/39 (u 3.000), x2 +0.218, eps_a 1.377 -> S_H 1.281, S_F 4.097
  b 20: K_Fb 1.191, eps_b 0.824 -> S_H 1.067, S_F 2.081
  b 28: K_Fb 1.207, eps_b 1.153 -> S_H 1.285, S_F 2.922
  b 36: K_Fb 1.216, eps_b 1.483 -> S_H 1.450, S_F 3.696
  b 45: K_Fb 1.223, eps_b 1.854 -> S_H 1.614, S_F 4.550
  beta  0: eps_a 1.591 eps_b 0.000 Z_eps 0.896 Z_beta 1.000 Fa 0 N -> S_H 1.109, S_F 2.417
  beta  8: eps_a 1.571 eps_b 0.620 Z_eps 0.838 Z_beta 1.005 Fa 724 N -> S_H 1.205, S_F 2.578
  beta 15: eps_a 1.520 eps_b 1.153 Z_eps 0.811 Z_beta 1.017 Fa 1346 N -> S_H 1.285, S_F 2.922
  beta 20: eps_a 1.466 eps_b 1.524 Z_eps 0.826 Z_beta 1.032 Fa 1778 N -> S_H 1.305, S_F 3.183
  beta 25: eps_a 1.398 eps_b 1.883 Z_eps 0.846 Z_beta 1.050 Fa 2197 N -> S_H 1.332, S_F 3.512
  42CrMo4 QT                   S_H 0.659, S_F 1.870
  42CrMo4 induction hardened   S_H 1.028, S_F 2.104
  42CrMo4 nitrided             S_H 1.028, S_F 2.455
  16MnCr5 case hardened        S_H 1.242, S_F 2.688
  18CrNiMo7-6 case hardened    S_H 1.285, S_F 2.922
  max power: S_H >= 1.0 -> 25.07 kW; S_F >= 1.4 -> 31.83 kW
```
(S_F in the table = the smaller of pinion and wheel.)

**Interpretation – the five lessons**
1. **Module at the same centre distance hardly changes pitting** (S_H 1.25–1.31): pitting is decided by the **size**
   (d1, a) and the material, not by the module. A bigger module only makes the root stronger (S_F 2.58 → 4.10) – and
   gives fewer teeth, lower ε_α (1.53 → 1.38), more noise. Choose the smallest module that keeps S_F ≥ 1.4 with margin
   (and ≥ the minimum for shocks / wear): here mn 1.75–2.
2. **Face width helps both** (b 20 → 45: S_H 1.07 → 1.61), but only if K_Hβ stays small – a wider gear needs stiffer
   shafts and better alignment (5.4). Keep b/d1 ≤ ~1–1.2 for through-the-centre mounted pinions.
3. **Helix angle** 0 → 15° raises S_H from 1.11 to 1.29 (longer contact lines, Z_ε) and S_F (Y_β). Above ~20° the gain
   is small but the axial force grows (2197 N at 25°) – bearings (M4: tapered pair!) and housing pay for it. 10–20° is
   the common window.
4. **Material is the strongest lever for pitting**: QT 42CrMo4 gives S_H 0.66 (fails!), induction / nitrided 1.03,
   case hardened 1.24–1.29. Case hardening doubles the pitting capacity (S_H² ratio ≈ 3.8 → load ratio ≈ 3.8).
5. **Maximum power** of this exact pair: 25.1 kW until S_H = 1.0, 31.8 kW until S_F = 1.4. The 15 kW design has
   1.67 × power reserve on pitting – consistent with S_H² = 1.285² = 1.65 (power ∝ σ_H²).

**Check questions**
1. Why does the module change S_F a lot but S_H very little?
2. You need 22 kW in the same housing. Which two changes from the table would you combine?

### 5.10 Scuffing and micropitting (outline)

**Scuffing – flash temperature (Blok).** Where the flanks slide (everywhere except the pitch point) friction heat is
produced in the thin Hertz band. Blok's flash temperature for line contact of equal materials (check ISO/TS 6336-20,
which uses a more detailed "flash temperature" and ISO/TS 6336-21 the "integral temperature" method):

```
dT_fl = 1.11 * mu * w' * |v1 - v2| / ( B * sqrt(b_H) * (sqrt(v1) + sqrt(v2)) )
w' = normal load per unit length (N/m), v1, v2 = surface speeds along the profile (m/s), v_i = omega_i * rho_i
b_H = Hertz half width = sqrt(4 w' R / (pi E*)),  B = sqrt(lambda rho c) ~ 12 900 N/(m s^0.5 K) for steel
T_contact = T_oil + dT_fl  <  scuffing temperature of the oil (mineral oil without EP ~ 150-250 C, EP oils higher - check FZG tests)
```

**In the program**
```python
def flash_temperature(P, mu=0.06, theta_oil=80.0, B=12900.0):
    g = geometry(P)
    F = forces(P, g)
    KV = KV_factor(P, g, F)
    w1 = 2 * math.pi * P["n1_rpm"] / 60
    w2 = w1 / g["u"]
    rb1, rb2 = g["db1"] / 2, g["db2"] / 2
    rho1 = math.sqrt((g["da1"] / 2) ** 2 - rb1 ** 2)                  # mm, at the pinion tip
    rho2 = g["aw"] * math.sin(g["awt"]) - rho1
    v1, v2 = w1 * rho1 / 1000, w2 * rho2 / 1000                      # m/s
    Fbn = F["Ft"] * P["KA"] * KV / (math.cos(g["awt"]) * math.cos(g["bb"]))
    w_line = Fbn / (P["b"] / math.cos(g["bb"])) * 1000               # N/m over the contact length ~ b / cos(beta_b)
    R = (rho1 * rho2 / (rho1 + rho2)) / math.cos(g["bb"]) / 1000      # normal radius (m)
    Estar = 1 / (2 * (1 - 0.3 ** 2) / 206e9)
    bH = math.sqrt(4 * w_line * R / (math.pi * Estar))
    dT = 1.11 * mu * w_line * abs(v1 - v2) / (B * math.sqrt(bH) * (math.sqrt(v1) + math.sqrt(v2)))
    return {"v1": v1, "v2": v2, "vg": abs(v1 - v2), "w_line_Nmm": w_line / 1000, "bH_mm": bH * 1000, "dT": dT,
            "T_contact": theta_oil + dT}
```

**Micropitting – film thickness.** Dowson–Higginson minimum film thickness for line contact at the pitch point (check
ISO/TS 6336-22, which uses a more detailed method):

```
h_min = 2.65 R (eta0 u / (E' R))^0.7 (alpha E')^0.54 (w' / (E' R))^-0.13 ,   lambda = h_min / (sqrt(2) Rq)
```
(E' = E/(1 − ν²), α = pressure-viscosity coefficient ~ 2·10⁻⁸ Pa⁻¹ for mineral oil, u = rolling speed, Rq = rms
roughness of each flank.)

**Run it:** `python gear.py ch5`
```
== 5.10 scuffing / micropitting
  pinion tip: v1 1.875, v2 0.833, sliding 1.043 m/s; w' 249.3 N/mm; b_H 0.1444 mm -> flash 48.9 K, contact 128.9 C
  VG 150 at 80 C: nu 26.4 mm2/s, u 1.080 m/s -> h_min 0.139 um, lambda 0.20 (Rq 0.5 um)
  VG 220 at 80 C: nu 35.5 mm2/s, u 1.080 m/s -> h_min 0.172 um, lambda 0.24 (Rq 0.5 um)
  VG 320 at 80 C: nu 46.5 mm2/s, u 1.080 m/s -> h_min 0.207 um, lambda 0.29 (Rq 0.5 um)
  oil choice for v 2.99 m/s: VG 220 - 320
```

**Interpretation.**
- **Scuffing is not a risk** at 3 m/s: contact temperature ~129 °C (oil 80 °C + 49 K flash), well below the scuffing
  limit of normal gear oils. Scuffing becomes important at v > ~10–20 m/s or with very high loads and low viscosity.
- **Micropitting deserves attention**: λ = 0.2–0.3 means **mixed lubrication** – the roughness peaks touch. This is
  typical for slow, highly loaded case-hardened gears. Measures: higher viscosity (VG 320 instead of 150: +49 % film),
  smoother flanks (superfinishing Ra < 0.2 µm doubles λ), oils with good micropitting rating (FVA 54 / GFT class "high"
  – check), cooler oil. Z_LVR in pitting already contains part of this effect.

**Check questions**
1. Why is the flash temperature zero at the pitch point?
2. Which two changes raise λ the most?

### 5.11 Lubrication choice and surface finish

**Oil viscosity by pitch-line speed** – rough guide for case-hardened enclosed industrial gears, mineral oil, ~40 °C
ambient (check DIN 51509-1 / AGMA 9005 / your oil supplier):

```python
VG_BY_SPEED = [   # rough guide for case-hardened industrial gears, mineral oil, ~40 C ambient (check DIN 51509 / AGMA 9005)
    (1.0, "VG 460 - 680"), (2.5, "VG 320 - 460"), (5.0, "VG 220 - 320"), (10.0, "VG 150 - 220"), (25.0, "VG 68 - 150")]
```

| Pitch-line speed v | Oil (rough) | Lubrication method |
|---|---|---|
| < 1 m/s | VG 460–680 | splash / grease for open gears |
| 1–5 m/s | VG 220–460 | splash (dip depth 1–3 × module for the wheel) |
| 5–15 m/s | VG 100–220 | splash or spray |
| > 15 m/s | VG 32–100 | spray / jet into the mesh (outgoing side for cooling) |

Our reducer (v = 2.99 m/s): **VG 220–320**, splash lubrication, oil temperature ≤ 80–90 °C. Use the same oil as the
bearings if possible (M4: κ was calculated with VG 100 for the compressor crankcase – a separate reducer can use VG 220).

**Surface finish (typical, check ISO 1328 / supplier):**

| Process | Flank Ra | Root | Comment |
|---|---|---|---|
| Hobbing / shaping (soft) | 1.6–3.2 µm | hob radius | before heat treatment |
| Shaving (soft) | 0.8–1.6 µm | – | before hardening, grade 6–7 |
| Profile / generating grinding (hard) | 0.3–0.6 µm | protuberance avoids notch | grade 4–6, standard for case hardened |
| Honing / superfinishing | 0.1–0.2 µm | – | micropitting and noise improvement |

### 5.12 Practice – what to change first when a safety is too small

| Problem | First measures (in this order) | Why |
|---|---|---|
| **S_H too small** | 1. better material / hardness (QT → nitrided → case hardened) 2. wider face (with good K_Hβ) 3. larger centre distance (d1) 4. helix angle 10–20° 5. crowning / end relief to lower K_Hβ 6. better oil / finish (Z_LVR) | σ_H ∝ 1/√(d1² b) at the same torque; material raises σ_Hlim directly |
| **S_F too small** | 1. larger module (fewer teeth, same a) 2. positive profile shift on the weak gear 3. larger root radius (protuberance hob, full-radius) 4. shot peening 5. wider face | σ_F ∝ 1/(b mn); Y_F falls with x and z |
| **K_Hβ large** | stiffer / shorter shafts, bearings near the gear, housing bores in one set-up, helix modification | load distribution |
| **Noise** | higher ε_α and ε_β (ε_β ≥ 1), smaller module, grade 5–6, profile modification (tip relief) | smoother mesh |
| **Micropitting / scuffing** | higher viscosity, EP oil, superfinish, cooling, tip relief | film thickness, temperature |

**Design sequence used in practice** (and in the worked example of this guide):
1. Pre-size the centre distance from pitting (empirical: a ≈ (u + 1) · ∛(K T1 / (u ψ_a σ_HP²)) or from a similar gearbox).
2. Choose the material and hardening.
3. Choose mn for S_F ≥ 1.4–2 with ≥ 17–20 teeth on the pinion (or use profile shift).
4. Choose β (10–20°) and b (b/d1 ≤ 1) for ε_β ≥ 1.
5. Calculate K-factors honestly (K_Hβ from the real shaft deflection – M3).
6. Check scuffing / micropitting and choose the oil.
7. Produce the manufacturing data (chapter 6): W_k, M_d, quality grade, flank modifications.

**MATLAB – full capacity check in a few lines**
```matlab
Ft = 5022.1; b = 28; d1 = 39.34; u = 60/19; mn = 2;
sH0 = 2.3906*189.81*0.8110*1.0175*sqrt(Ft/(d1*b)*(u+1)/u);
sH  = sH0*sqrt(1.25*1.0368*1.25*1.0);          SH = 1500/sH          % 1.285
sF  = Ft/(b*mn)*1.2771*2.0946*0.875*1.25*1.0368*1.2069;  SF = 1000/sF  % 3.05
```

**Checklist – gear load capacity**
- [ ] K_A from the real driving / driven machine, or a torque spectrum (ISO 6336-6) for strongly fluctuating loads (compressor!)
- [ ] Resonance ratio N < 0.85 (or > 1.5 with care); K_V with the real accuracy grade
- [ ] K_Hβ from shaft deflection + manufacturing errors, not just a guess; flank modification specified
- [ ] Life factors with the real cycle numbers; state "normal" or "optimum" line
- [ ] Both gears checked (pinion: more cycles; wheel: x < 0 weakens the root)
- [ ] S_H ≥ 1.0–1.3, S_F ≥ 1.4–2.0 (agreed with the customer)
- [ ] Scuffing / micropitting checked; oil VG and temperature fixed; same oil as bearings?
- [ ] Root fillet process (protuberance) and surface finish on the drawing

**Common mistakes**
- Mixing method B Y_F with method C Y_ε (≈ 30 % error).
- Using K_Hβ = 1.0 "because the gear is accurate" – shaft bending alone often gives 1.2–1.5.
- Forgetting that the wheel with negative profile shift can be the weaker root.
- Taking σ_Hlim of quality ME for a supplier who delivers ML.
- Checking only the nominal torque of a piston compressor drive (T_max/T_mean ≈ 4.6 in M2).
- Grinding the root without protuberance (grinding notch) and still using the full Y_S and Y_RrelT.

**Check questions (chapter)**
1. List the three load factors that appear in both σ_H and σ_F, and the one that differs.
2. Your gear has S_H = 0.95 and S_F = 2.8. Propose a change that fixes pitting without making the gearbox bigger.
3. Why is a QT gear (S_H 0.66) still used in practice for large, slow gears?

**References** – ISO 6336-1, -2, -3, -5, -6 (2019); ISO/TS 6336-4, -20, -21, -22; ISO 1328-1 (2013); DIN 3990 (1987,
withdrawn, method C background); AGMA 2101-D04 / 2001-D04; Niemann, Winter: *Maschinenelemente Band 2* (Springer);
Linke: *Stirnradverzahnung* (Hanser, 2nd ed.); Dudley: *Handbook of Practical Gear Design*; Radzevich: *Dudley's Handbook
of Practical Gear Design and Manufacture* (3rd ed.); FVA / FZG test methods (scuffing FZG A/8.3/90, micropitting FVA 54).


---

## 6 Manufacturing and inspection data

> Programs: `span_measurement()`, `over_pins()`, `backlash()` in `tools/gear.py`; added in this chapter:
> `backlash_thermal()`, `iso1328_2013()`, `tip_relief()`, `crowning()`, `drawing_block()`.
> Extra results: `python gear.py ch68`. All numbers are **example values** of the default pair
> (15 kW, m_n 2, z 19/60, β 15°, x +0.25/−0.10, b 28 mm, case hardened).

A strength calculation is only half of a gear design. The workshop needs numbers it can **measure**: a base tangent
length W_k, a dimension over balls M_d, an accuracy grade, a backlash range, the heat-treatment data. This chapter
derives these numbers and shows how the program produces them.

### 6.1 Span measurement (base tangent length) W_k

**Theory.** Put the two flat anvils of a disc micrometer over k teeth. Each anvil touches one flank. Because every
flank is an involute of the base circle, the line between the two contact points is a **tangent to the base circle**,
and its length equals the **arc on the base circle** between the two flanks (property of the involute: the generating
line rolls on the base circle without slip).

**Derivation (spur gear, then helical).**
1. Arc on the base circle between two opposite flanks k teeth apart = (k − 1) base pitches + one base tooth thickness:
   W_k = (k − 1) p_b + s_b.
2. Base pitch p_b = π m cos α. Base tooth thickness s_b = d_b (s/d + inv α) with s = m(π/2 + 2 x tan α).
3. Insert: W_k = m cos α [ (k − 0.5) π + z inv α + 2 x tan α ].
4. Helical gear: measure in the **normal** section; the transverse involute uses α_t, the result is turned into the
   normal plane by cos β_b. The common closed form is

   **W_k = m_n cos α_n [ (k − 0.5) π + z inv α_t + 2 x tan α_n ]**

   With a tooth thickness allowance A_sn (negative, µm): **W_k,act = W_k + A_sn cos α_n**.
5. **Choice of k.** The anvils must touch the flanks near mid-height (not at the tip, not in the root fillet).
   The program takes the pressure angle at the mid diameter d + 2 x m_n and rounds k from it.
6. **Face-width condition (helical).** The two contact points are offset axially by W_k sin β_b. They must lie on the
   face: W_k sin β_b < b (better < b − 5 mm so the anvils sit fully on the tooth).

**Formula box**

| Symbol | Meaning | Unit |
|---|---|---|
| W_k | base tangent length over k teeth | mm |
| k | number of teeth spanned | – |
| α_t, α_n | transverse / normal pressure angle | rad |
| inv α | involute function tan α − α | – |
| A_sn | normal tooth thickness allowance (negative) | µm |
| β_b | base helix angle | rad |

W_k = m_n cos α_n [ (k − 0.5) π + z inv α_t + 2 x tan α_n ] + A_sn cos α_n ; check W_k sin β_b < b

**In the program** (`tools/gear.py`)
```python
def span_measurement(P, g, which=1, allowance_um=0.0):
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    z, x = P["z%d" % which], P["x%d" % which]
    be = math.radians(P["beta_deg"])
    at = g["at"]
    # contact at mid-flank: diameter ~ d + 2 x mn ; pressure angle there
    dm = g["d%d" % which] + 2 * x * mn
    amt = math.acos(g["db%d" % which] / dm)
    k = max(2, round(z / math.pi * (math.tan(amt) / math.cos(g["bb"]) ** 2 - 2 * x * math.tan(an) / z - inv(at)) + 0.5))
    W = mn * math.cos(an) * ((k - 0.5) * math.pi + z * inv(at) + 2 * x * math.tan(an))
    return {"k": k, "Wk": W + allowance_um / 1000 * math.cos(an), "Wk_nominal": W,
            "fits_face": W * math.sin(g["bb"]) < P["b"]}
```

**Run it:** `python gear.py ch68` (block 6.1)
```
  gear 1: k 3, W_k nominal 15.6902 mm, W sin(beta_b) 3.82 mm < b 28.0: True
  gear 2: k 8, W_k nominal 46.0005 mm, W sin(beta_b) 11.19 mm < b 28.0: True
  gear 1 with k 2: W 9.7859 mm
  gear 1 with k 3: W 15.6902 mm
  gear 1 with k 4: W 21.5945 mm
```
**Interpretation.** One more tooth adds exactly one base pitch p_bn = π m_n cos α_n = 5.904 mm
(21.5945 − 15.6902 = 5.9043). The program picks k = 3 for the pinion and k = 8 for the wheel. Both fit on the 28 mm face.
With the allowances −50 / −80 µm the drawing value of the pinion is **W₃ = 15.643 … 15.615 mm** (report, chapter 3).

**Manufacturing / practice.**
- Use a disc micrometer (flat discs Ø 15–25 mm) or a gear tooth vernier only for rough checks. Resolution 1 µm.
- W_k is measured on **every** gear after hobbing / shaping (with grinding stock) and after grinding (final).
  It is the workshop's main tooth thickness check because it needs no centre and no reference circle.
- Measure at three places 120° apart: the scatter shows runout and pitch errors.
- With grinding stock q per flank (normal direction) the pre-grind value is about **W_k,soft = W_k,finished + 2 q**
  (one flank per anvil). It belongs on a separate operation drawing of the soft stage.

**MATLAB equivalent**
```matlab
invf = @(a) tan(a) - a;
Wk = mn*cos(an)*((k - 0.5)*pi + z*invf(at) + 2*x*tan(an));   % nominal
Wk_act = Wk + Asn/1000*cos(an);                               % with allowance (um)
fits = Wk*sin(bb) < b;
```

**Check questions.** (1) Why is W_k independent of the tip and root diameters? (2) Why does one extra tooth add one base
pitch? (3) For a helical gear with b = 12 mm, β = 30°, can you measure over k = 8? (compute W_k sin β_b).

### 6.2 Dimension over pins or balls M_d

**Theory.** Put two balls (or pins) of diameter D_M into opposite tooth spaces and measure over them. The ball centre
lies on a circle d_M. The ball touches the two flanks of its space where the involute normal passes through the centre.

**Derivation.**
1. The space width on the circle through the ball centre must equal the ball "width" seen on the base circle:
   the involute normal through the centre is tangent to the base circle; the pressure angle there is α_Mt.
2. Condition (transverse section, ball touching both flanks):
   inv α_Mt = inv α_t + D_M / (m_n z cos α_n) − π/(2 z) + 2 x tan α_n / z
   (a thinner tooth from a negative allowance adds a small term; the program adds A_sn/(m_n z)).
3. Centre circle: d_M = d cos α_t / cos α_Mt (same base circle).
4. **Even z:** the two balls are diametrically opposite → **M_d = d_M + D_M**.
   **Odd z:** the spaces are offset by half a pitch → **M_d = d_M cos(90°/z) + D_M**.
5. Helical gears: use **balls** (not pins); the same formula is valid in the transverse section with the normal ball size.
6. **Ball size.** The ball should touch near the reference circle. Rule: D_M ≈ 1.68 m_n (spur, α 20°); choose the next
   available standard ball (steps of 0.25 mm in the program).

**Formula box:** inv α_Mt = inv α_t + D_M/(m_n z cos α_n) − π/(2z) + 2x tan α_n / z ; d_M = d cos α_t / cos α_Mt ;
M_d = d_M + D_M (z even) or d_M cos(90°/z) + D_M (z odd).

**In the program**
```python
def over_pins(P, g, which=1, DM=None, allowance_um=0.0):
    mn, an = P["mn"], math.radians(P["alpha_n_deg"])
    z, x = P["z%d" % which], P["x%d" % which]
    DM = DM or round(1.68 * mn * 4) / 4
    s_add = allowance_um / 1000 / (mn * z)        # thickness allowance as an angle term (normal, small)
    y = inv(g["at"]) + DM / (mn * z * math.cos(an)) - math.pi / (2 * z) + 2 * x * math.tan(an) / z + s_add
    aMt = inv_inverse(y)
    dM = g["d%d" % which] * math.cos(g["at"]) / math.cos(aMt)
    M = dM + DM if z % 2 == 0 else dM * math.cos(math.pi / (2 * z)) + DM
    return {"DM": DM, "M": M, "aMt_deg": math.degrees(aMt)}
```

**Run it:** `python gear.py ch68` (block 6.2)
```
  gear 1 DM 3.00: M 43.2517 mm, alpha_Mt 24.29 deg
  gear 1 DM 3.25: M 44.1047 mm, alpha_Mt 26.10 deg
  gear 1 DM 3.50: M 44.9226 mm, alpha_Mt 27.66 deg
  gear 2 DM 3.00: M 126.9711 mm, alpha_Mt 20.32 deg
  gear 2 DM 3.25: M 127.9480 mm, alpha_Mt 21.21 deg
  gear 2 DM 3.50: M 128.8977 mm, alpha_Mt 22.02 deg
  gear 1 DM 3.25 with allowances: M 43.9275 ... 43.9944 (nominal 44.1047)
  gear 2 DM 3.25 with allowances: M 127.7325 ... 127.8136 (nominal 127.9480)
```
**Interpretation.** For the pinion (z 19, odd, x +0.25) α_Mt = 26° with D_M 3.25: the ball touches above the reference
circle (α_t = 20.6°) because of the positive shift; D_M 3.0 brings it closer. For the wheel 3.25 mm is ideal (α_Mt ≈ α_t).
Note: the allowance changes M_d about 2.5 × more than W_k (−50 µm thickness → −110 µm on M_d of the pinion). M_d is
therefore the more **sensitive** check, W_k the more **robust** one.

**Practice.** M_d is used when W_k is impossible: small modules, narrow face (helical), internal gears, splines.
Balls must be grade G10 or better; measure with a micrometer with ball anvils or on a CMM. Odd z: measure with a
fixture that holds the balls in the offset spaces.

**MATLAB equivalent**
```matlab
y   = invf(at) + DM/(mn*z*cos(an)) - pi/(2*z) + 2*x*tan(an)/z + Asn/1000/(mn*z);
aMt = fzero(@(a) invf(a) - y, 0.4);
dM  = d*cos(at)/cos(aMt);
if mod(z,2)==0, M = dM + DM; else, M = dM*cos(pi/(2*z)) + DM; end
```

**Check questions.** (1) Why do odd tooth numbers need the factor cos(90°/z)? (2) Which check, W_k or M_d, reacts more
to a thickness change, and why? (3) Why are pins wrong for a helical gear?

### 6.3 Tooth thickness allowances and backlash

**Theory.** Gears are made **thinner** than the theoretical tooth (zero-backlash) thickness. Two numbers per gear go on
the drawing (DIN 3967 series of "allowances", ISO 21771 terms):
- **upper allowance A_sne** (the smallest thinning, e.g. −50 µm),
- **lower allowance A_sni** (the largest thinning, e.g. −80 µm); **tolerance T_sn = A_sne − A_sni** (here 30 µm).
DIN 3967 gives series of allowances (a, ab, b, bc, c, cd, d, e, f, g, h; e.g. "c" ≈ moderate backlash) and tolerance
rows (21 … 30) depending on the reference diameter – take the values from the standard (check).

**Derivation of the backlash.** Thinning the teeth by A_sn1 and A_sn2 opens a normal gap of −(A_sn1 + A_sn2) cos α_n
(measured along the line of action). A larger centre distance (+Δa) opens the gap by 2 Δa sin α_wn. So

- **j_n,min = −2 A_sne cos α_n − 2 Δa sin α_wn** (thickest teeth, smallest centre distance),
- **j_n,max = −2 A_sni cos α_n + 2 Δa sin α_wn**,
- circumferential (transverse, on the working circle): **j_t = j_n / (cos α_wt cos β_b)**.

(The program assumes the same allowances on both gears.)

**Thermal effect.** In operation the housing and the gears have different temperatures and may be of different
material. The centre distance grows with the housing, the gears grow on their pitch radii:

Δa = a_w α_housing ΔT_housing − (d₁ + d₂)/2 · α_gear ΔT_gear  ;  Δj_n = 2 Δa sin α_wn

**In the program**
```python
def backlash(P, g):
    up, lo = P["tooth_thickness_allowance_um"]
    da = P["centre_distance_tol_um"]
    awn = math.atan(math.tan(g["awt"]) * math.cos(g["bb"]))
    jn_min = -(up + up) * math.cos(math.radians(P["alpha_n_deg"])) - 2 * da * math.sin(awn)
    jn_max = -(lo + lo) * math.cos(math.radians(P["alpha_n_deg"])) + 2 * da * math.sin(awn)
    f = 1 / (math.cos(g["awt"]) * math.cos(g["bb"]))
    return {"jn_min_um": jn_min, "jn_max_um": jn_max, "jt_min_um": jn_min * f, "jt_max_um": jn_max * f}

def backlash_thermal(P, g, dT_gear=40.0, dT_housing=25.0, alpha_gear=11.5e-6, alpha_housing=23e-6):
    awn = math.atan(math.tan(g["awt"]) * math.cos(g["bb"]))
    da = g["aw"] * alpha_housing * dT_housing - (g["d1"] + g["d2"]) / 2 * alpha_gear * dT_gear
    dj = 2 * da * math.sin(awn) * 1000
    b0 = backlash(P, g)
    return {"delta_a_um": da * 1000, "delta_jn_um": dj, "jn_min_hot": b0["jn_min_um"] + dj, "jn_max_hot": b0["jn_max_um"] + dj}
```

**Run it:** `python gear.py ch68` (block 6.3)
```
  cold: j_n 79.9 ... 164.4 um, j_t 88.3 ... 181.8 um
  aluminium housing (gears +40 K, housing +25 K): delta a 9.6 um, delta j_n 6.7 um -> hot j_n 86.6 ... 171.2 um
  grey iron housing (gears +40 K, housing +25 K): delta a -16.1 um, delta j_n -11.3 um -> hot j_n 68.6 ... 153.1 um
  Al, cold start (gears +60 K, housing +20 K): delta a -18.7 um, delta j_n -13.1 um -> hot j_n 66.7 ... 151.3 um
```
**Interpretation.**
- Cold backlash 80 … 164 µm (normal). Typical recommended minimum backlash for industrial reducers is roughly
  0.02–0.05 m_n + a thermal reserve (check DIN 3967 / supplier); 80 µm = 0.04 m_n is reasonable.
- The steel gears warm faster than the housing at start-up. With a grey iron housing the hot backlash falls by 11 µm,
  in an aluminium housing at cold start by 13 µm – the minimum must stay > 0 in **every** case, otherwise the teeth jam
  (noise, heat, root overload).
- The aluminium housing helps when it is warm (it grows twice as much as steel), but hurts at cold start.

**Practice.** Measure backlash in the assembled box with a dial gauge on a tooth (lock one gear, rock the other).
Write the backlash range on the assembly drawing, not only the allowances.

**MATLAB equivalent**
```matlab
awn = atan(tan(awt)*cos(bb));
jn  = [-2*Asne*cos(an) - 2*da*sin(awn),  -2*Asni*cos(an) + 2*da*sin(awn)];   % um
dA  = aw*aH*dTH - (d1+d2)/2*aG*dTG;  djn = 2*dA*sin(awn)*1000;
```

**Check questions.** (1) Why does a bigger centre distance tolerance increase **both** the max backlash and reduce the
min backlash? (2) Steel gears in an aluminium housing: when is the backlash smallest? (3) What happens at j_n < 0?

### 6.4 Accuracy – ISO 1328-1:2013

**Theory.** ISO 1328-1:2013 defines **flank tolerance classes** 1 (finest) … 11. Each grade step multiplies the
tolerances by √2. Main deviations:

| Symbol | Name | What it influences |
|---|---|---|
| f_pT | single pitch tolerance | noise, dynamic load (K_V) |
| F_pT | total cumulative pitch tolerance | transmission error per revolution, runout |
| F_αT | total profile tolerance | noise, load at tip/root, pitting |
| F_βT | total helix tolerance | load distribution K_Hβ |
| F_rT | radial runout (ISO 1328-2) | backlash variation, noise per revolution |

**Formulas** (grade A, base grade 5, k = √2^(A−5)):
- f_pT = (0.001 d + 0.4 m_n + 5) k  [µm]  (form as in ISO 1328-1:2013 – check)
- F_pT = (0.002 d + 0.55 √d + 0.7 m_n + 12) k [µm]  (check)
- F_αT, F_βT, F_rT in the program are **approximations** in the same style (F_rT ≈ 0.9 F_pT) – **use the standard's
  formulas / tables for the drawing**.

**In the program** (added function)
```python
def iso1328_2013(mn, d, b, A):
    k = math.sqrt(2) ** (A - 5)
    fpt = (0.001 * d + 0.4 * mn + 5) * k
    Fp = (0.002 * d + 0.55 * math.sqrt(d) + 0.7 * mn + 12) * k
    Fa = (0.55 * math.sqrt(mn) + 5) * k * 1.0 + 0.0          # approximation
    Fb = (0.07 * math.sqrt(d) + 0.45 * math.sqrt(b) + 4) * k   # approximation
    return {"fpT": fpt, "FpT": Fp, "FalphaT": Fa, "FbetaT": Fb, "FrT": 0.9 * Fp}
```

**Run it:** `python gear.py ch68` (block 6.4)
```
  gear 1 (d 39.3): f_pT 8.3, F_pT 23.9, F_alpha 8.2, F_beta 9.6, F_r 21.5 um
  gear 2 (d 124.2): f_pT 8.4, F_pT 28.0, F_alpha 8.2, F_beta 10.1, F_r 25.2 um
  gear 1 grade 5: f_pT 5.8, F_pT 16.9 um
  gear 1 grade 6: f_pT 8.3, F_pT 23.9 um
  gear 1 grade 7: f_pT 11.7, F_pT 33.9 um
  gear 1 grade 8: f_pT 16.5, F_pT 47.9 um
```
**Interpretation.** Grade 6 = ground case-hardened gears of an industrial reducer. Grade 7–8 = hobbed / shaved, not
ground. Each grade doubles the tolerances every two steps. The grade used for K_V in chapter 5 must be the grade the
workshop **really** reaches after heat treatment (distortion!).

**Manufacturing link.**

| Process | Typical grade (ISO 1328-1:2013, check) | Remarks |
|---|---|---|
| Hobbing (soft) | 8–9 | before heat treatment; distortion adds 1–2 grades |
| Shaping | 7–8 | internal gears, shoulders |
| Shaving (soft) | 6–7 | before hardening; distortion remains |
| Profile / generating grinding (hard) | 4–6 | after case hardening; standard for loaded gears |
| Honing (hard) | 5–6 | improves noise and surface |

### 6.5 Profile and helix modifications

**Theory.** Under load the teeth bend. The next tooth pair enters the mesh too early ("corner contact") → shock, noise,
higher K_V. **Tip relief** C_a removes material at the tip so the tooth enters smoothly. The amount is about the
tooth deflection at the operating load:

C_a ≈ K_A F_t / (b c′)  with single-tooth stiffness c′ ≈ 14 N/(mm·µm) for steel (check ISO 6336-1).

**Crowning** C_β (helix modification) protects the tooth ends from edge loading caused by misalignment
(manufacturing f_ma + shaft/housing deflection f_sh): C_β ≈ 0.5 (f_ma + f_sh) as a first estimate (check). A good
crowning lowers K_Hβ (chapter 5).

**In the program**
```python
def tip_relief(Ft, b, KA=1.0, c_prime=14.0):
    return KA * Ft / (b * c_prime)

def crowning(f_ma=8.0, f_sh=6.0):
    return 0.5 * (f_ma + f_sh)
```
**Run it** (block 6.5): `F_t 5022 N, b 28 mm: tip relief C_a 12.8 um (K_A 1) / 16.0 um (K_A 1.25); crowning C_beta 7.0 um`

**Interpretation.** Specify C_a ≈ 12–16 µm (long or short relief, starting about at the diameter of the single-pair
contact) and C_β ≈ 7 µm. For variable loads choose the relief for the most frequent load, not the peak. Better values
come from a load-distribution calculation (KISSsoft/MESYS contact analysis, chapter 7).

**Practice.** Modifications are made in **grinding** (CNC profile grinders have them as parameters) and are checked on a
gear measuring machine in the profile and helix diagrams (the measured line must lie inside the tolerance band
around the **modified** nominal line).

### 6.6 Gear drawing data block (ISO 1340 / DIN 3966)

**In the program** (`drawing_block(P, 1)`, block 6.6):
```
  Normal module m_n                2.00 mm
  Number of teeth z                19
  Normal pressure angle            20 deg
  Helix angle / hand               15.0 deg / right
  Profile shift coefficient x      +0.250
  Reference diameter d             39.340 mm
  Tip diameter d_a                 44.333 h11 mm
  Root diameter d_f                35.340 mm (ref.)
  Base tangent length W_k, k       3 teeth: 15.643 / 15.615 mm (nominal 15.690)
  Dimension over balls M_d, D_M    43.994 / 43.928 mm, D_M 3.25
  Accuracy grade                   ISO 1328-1:2013 grade 6
  Mating gear / centre distance    z 60, a_w 82.083 +/- 0.020 mm
  Heat treatment                   case hardened 58-62 HRC, CHD550 = 0.3-0.5 mm (check), core >= 30 HRC
  Flank / root roughness           Ra 0.4 (ground) / Rz 10 (root, not ground)
```
Add on the real drawing: tooth thickness allowances with the DIN 3967 series, profile and helix modifications
(C_a, C_β with diagrams), basic rack (ISO 53 profile A), datum (bore axis), runout of the reference faces, number of the
mating gear drawing, inspection notes (W_k at 3 places, M_d alternative).

### 6.7 Heat treatment specification

- **Case hardening** (18CrNiMo7-6, 16MnCr5): carburise, quench, temper. Surface 58–62 HRC.
- **Case hardening depth CHD** (to 550 HV, ISO 2639): rule of thumb **CHD ≈ 0.15–0.20 m_n** at the flank after grinding
  (m_n 2 → 0.3–0.4 mm finished; check ISO 6336-5 recommendation, which links CHD to m_n and the load).
- Add the **grinding stock** (0.1–0.15 mm per flank for m_n 2) to the carburising depth so the finished CHD is reached.
- Core hardness 30–40 HRC (tooth root fatigue).
- Check **grinding burns** after grinding (nital etch per ISO 14104, or Barkhausen noise): burns reduce σ_Hlim strongly.
- Nitriding (42CrMo4): no grinding after nitriding; small distortion; depth 0.3–0.6 mm NHD (check).

### 6.8 Inspection methods

| Method | Measures | When |
|---|---|---|
| Gear measuring machine (CNC, 4-axis) | profile, helix, pitch, runout, tooth thickness | first article, sampling, after grinding |
| Double-flank roll test (master gear) | total radial composite F_i″, tooth-to-tooth f_i″, centre distance variation | 100 % in series, fast |
| Single-flank test | transmission error, noise prediction | noise-critical gears |
| W_k / M_d micrometer | tooth thickness | every gear, every operation |
| Contact pattern (marking compound) | load distribution in the housing | assembly, run-in |
| Hardness, CHD (cut section), MPI | heat-treatment quality | batch samples |

### 6.9 NX CAM / hobbing data (brief)

- **Hob**: module m_n, pressure angle α_n, basic rack with protuberance if the root must not be ground; single-start
  for accuracy, 2–3 starts for productivity; hob quality AA–A (DIN 3968, check).
- Hob swivel angle = β ± hob lead angle; **axial feed** 1–3 mm per work revolution (soft steel, roughing larger).
- **Machine set-up data** from the drawing block: z, β, hand, x (radial infeed), W_k with grinding stock.
- NX CAM machines gear blanks (turning, bores, keyways); the toothing itself is usually made on dedicated hobbing and
  grinding machines with their own software – the gear data block is the interface.

---

## 7 Verification

### 7.1 Cross-check with commercial software
KISSsoft, MESYS, Romax and similar tools implement ISO 6336 completely (method B K_V, K_Hβ from shaft deflection,
micropitting, scuffing, contact analysis). **Offline rule of the project:** these tools run with local or dongle licences
on the factory PC (check the licence type – some versions need an internet licence server). Compare:

| Value | Agreement expected with `gear.py` |
|---|---|
| geometry (d, d_a, a_w, ε_α, ε_β, W_k, M_d) | exact (± 1 µm) |
| Y_F, Y_S (method B) | ± 1–3 % |
| Z_H, Z_E, Z_ε, Z_β | exact |
| K_V | different (method B vs our simplified form) |
| K_Hβ | different (we use a given value) |
| S_H, S_F | ± 5–15 % because of K-factors and life factors |

When the difference is larger, find which factor differs – that is the learning.

### 7.2 FEA of the tooth root stress (Ansys / Abaqus)
1. Model: 2D plane strain of 3–5 teeth (transverse section of the virtual spur gear, z_n) or a 3D sector for the helical
   gear. Generate the exact profile and root fillet from the generating rack (or export from KISSsoft / the gear module of
   SOLIDWORKS). `python gear.py run` writes the involute points to `gear.csv`.
2. Load: normal force F_bn = F_t/(cos α_wt cos β_b) per unit width at the **outer point of single tooth contact**
   (diameter d_en from method B, chapter 5), direction along the line of action.
3. Boundary: fix the rim section 3–4 module below the root; avoid stress singularities at the cut.
4. Mesh: quadratic elements; ≥ 8–10 elements along the fillet; mesh convergence with the GCI method (M1 ch. 5.7).
5. Compare the max principal stress at the 30° tangent point with **σ_F0 = F_t/(b m_n) Y_F Y_S Y_β** (without K factors):
   default pair σ_F0 = **209.9 MPa** (pinion) and **218.8 MPa** (wheel) (`python gear.py ch68`, block 7).
   Expect ± 10 % (method B is an engineering approximation; FEA of a 2D spur model does not include Y_β).
6. Contact stress: FEA needs a very fine mesh at the contact; usually compare σ_H0 with a Hertz line contact (chapter 5,
   selftest) instead.

### 7.3 Contact pattern test
Paint the wheel with marking compound, run the pinion under light load, look at the pattern: it must be centred and
cover ≥ 40–60 % of the face width (check grade requirement). An edge pattern shows misalignment → correct the housing
or the crowning.

### 7.4 Noise and transmission error (brief)
Noise comes from the variation of the transmission error (TE) at the mesh frequency f_z = z₁ n₁ / 60
(default pair: 19 × 1450 / 60 = 459 Hz) and its harmonics. Helical gears with ε_β ≥ 1 (here 1.153) are quiet. Profile
and helix modifications are designed to make the TE flat at the operating load.

### 7.5 Test bench
Back-to-back (power-circulating) test rigs test a pair at 1.0–1.5 × rated torque for a defined time; inspect for
pitting, scuffing, micropitting and root cracks; measure temperature and noise.

---

## 8 Complete worked design example, checklists, references

### 8.1 Requirements (example values)
P = 5.5 kW at n₁ = 960 rpm (4-pole motor), ratio i ≈ 4, centre distance free, case-hardened 18CrNiMo7-6 ground,
S_H ≥ 1.2, S_F ≥ 1.6, 20 000 h, K_A 1.25.

### 8.2 Step 1 – pre-size the pinion from the pitting formula
**Derivation.** σ_H = Z_H Z_E Z_ε Z_β √(F_t/(d₁ b) · (u+1)/u · K) ≤ σ_HP with F_t = 2T₁/d₁ and b = ψ_d d₁:

  **d₁ ≥ ∛( 2 K T₁ (u + 1) / (ψ_d u) · (Z_H Z_E Z_ε Z_β / σ_HP)² )**

Assumptions (example): K = K_A K_V K_Hβ ≈ 1.25 · 1.05 · 1.25 = 1.64, ψ_d = b/d₁ = 0.8, Z_H 2.45, Z_E 189.8, Z_ε 0.80,
σ_HP = σ_Hlim / S_H = 1500 / 1.2 = 1250 MPa.

```python
def presize_d1(T1_Nm, u, sHP, K=1.64, psi_d=0.8, ZH_=2.45, ZE_=189.8, Zeps_=0.80, Zbeta_=1.0):
    T = T1_Nm * 1000.0
    return (2 * K * T * (u + 1) / (psi_d * u) * (ZH_ * ZE_ * Zeps_ * Zbeta_ / sHP) ** 2) ** (1 / 3)
```
**Run it** (`python gear.py ch68`, block 8):
`T1 54.71 N m, sigma_HP 1250 MPa, d1_min 29.18 mm -> mn raw 1.359 -> ISO 54 mn 1.50`

### 8.3 Step 2 – teeth, module, helix, shift
- z₁ = 21 (≥ 17 to avoid undercut and for smooth running; odd numbers for "hunting" teeth), z₂ = 83 → u = 3.952
  (83 and 21 have no common factor → every pinion tooth meets every wheel tooth).
- β = 12° (axial force moderate, ε_β ≥ 1).
- m_n,raw = d₁ cos β / z₁ = 1.359 → **ISO 54 preferred module 1.5**.
- x₁ = +0.2 (stronger pinion root, balanced sliding), x₂ = 0.
- b = ψ_d d₁ = 0.8 × 32.2 ≈ **26 mm**.

### 8.4 Step 3 – check with the program
Input file (saved as `tools/examples/gear_example.json`):
```json
{
  "name": "Design example: helical stage 5.5 kW, 960 rpm, i ~ 4 (case hardened)",
  "mn": 1.5, "z1": 21, "z2": 83, "beta_deg": 12.0, "x1": 0.2, "x2": 0.0, "b": 26.0,
  "P_kW": 5.5, "n1_rpm": 960.0, "KA": 1.25, "KHbeta": 1.25, "accuracy_grade": 6,
  "material1": "18CrNiMo7-6 case hardened", "material2": "18CrNiMo7-6 case hardened",
  "SHmin": 1.2, "SFmin": 1.6, "tooth_thickness_allowance_um": [-40, -70], "centre_distance_tol_um": 18
}
```
**Run it:** `python gear.py run --in examples/gear_example.json --out gear_example`
```
- ratio u 3.9524; d 32.204 / 127.281; da 35.796 / 130.274; df 29.054 / 123.531; db 30.182 / 119.291 mm
- a0 79.743, a_w 80.039 mm (x1 + x2 = 0.2000, tip shortening k 0.0026); alpha_t 20.410, alpha_wt 20.973, beta_b 11.267 deg
- contact ratios: eps_alpha 1.584, eps_beta 1.147, total 2.731; tip thickness s_a 0.99 / 1.24 mm (>= 0.38)
- undercut: x_min -0.306 / -4.160 (x 0.200 / 0.000 -> OK)
- T1 54.71 N m, T2 216.23 N m; Ft 3398 N, Fr 1302 N, Fa 722 N; v 1.62 m/s; n2 242.9 rpm
- K_A 1.25, K_V 1.030, K_Hbeta 1.25, K_Fbeta 1.215, K_Halpha 1.00
- Z_H 2.414, Z_E 189.8, Z_eps 0.795, Z_beta 1.011 -> sigma_H0 830 MPa, sigma_H 1053 MPa
- gear 1: Y_F 1.275, Y_S 2.075 (s_Fn 3.13, h_Fe 1.39, rho_F 0.75 mm); sigma_F 324 MPa vs 1000 -> S_F 3.08; pitting S_H 1.42; OK
- gear 2: Y_F 1.293, Y_S 2.127 (s_Fn 3.37, h_Fe 1.63, rho_F 0.71 mm); sigma_F 337 MPa vs 1000 -> S_F 2.97; pitting S_H 1.42; OK
- gear 1: W_k over k = 3 teeth 11.746 mm nominal, with allowances 11.680 ... 11.708 mm; over pins/balls D_M 2.50: M 35.884 mm
- gear 2: W_k over k = 10 teeth 43.925 mm nominal, with allowances 43.859 ... 43.887 mm; over pins/balls D_M 2.50: M 130.576 mm
- backlash (allowances + centre distance tol.): j_n 63 ... 144 um, j_t 68 ... 157 um
```
**Interpretation.** S_H = 1.42 > 1.2 because the module was rounded **up** (d₁ = 32.2 mm instead of 29.2 mm) and the
real Z_ε is a little smaller. Pitting decides (S_F ≈ 3 ≫ 1.6) – typical for case-hardened gears. Face-width study
(same file, b changed): b 22 → S_H 1.31, b 26 → 1.43, b 30 → 1.53. Variants (block 8):
```
  variant z 20/79 x1 0.0: a_w 75.909, S_H 1.36, S_F1 2.84, S_F2 2.94
  variant z 21/83 x1 0.2: a_w 80.039, S_H 1.42, S_F1 3.08, S_F2 2.97
  variant z 23/91 x1 0.3: a_w 87.852, S_H 1.56, S_F1 3.40, S_F2 3.18
```
Choose z 21/83 (smallest box with margin). If the centre distance must be a round number (e.g. 80.000 mm), give
`"a_w": 80.0` and the program computes the needed x₁ + x₂ (chapter 3).

### 8.5 Step 4 – manufacturing sheet (example)

| Item | Pinion z 21 | Wheel z 83 |
|---|---|---|
| W_k (k) | 11.708 / 11.680 mm (3) | 43.887 / 43.859 mm (10) |
| M_d (D_M 2.50) | 35.884 mm nominal | 130.576 mm nominal |
| Accuracy | ISO 1328-1 grade 6: f_pT 8.0, F_pT 23.0 µm | grade 6: f_pT 8.1, F_pT 27.6 µm |
| Backlash (pair) | j_n 63 … 144 µm | |
| Heat treatment | case hardened 58–62 HRC, CHD550 ≈ 0.25–0.35 mm finished (check) | same |
| Tip relief / crowning | C_a ≈ K_A F_t/(b c′) = 1.25 × 3398/(26 × 14) ≈ 11.7 µm; C_β ≈ 7 µm (check) | same |

### 8.6 Checklists

**Design**
- [ ] z₁ ≥ 17 (or x ≥ x_min), hunting tooth numbers, ε_α ≥ 1.2, helical ε_β ≥ 1 for quiet running
- [ ] tip thickness s_a ≥ 0.25 m_n (case hardened) / 0.2 m_n (QT); no undercut
- [ ] S_H ≥ S_Hmin, S_F ≥ S_Fmin for **all** load cases (peak torque: static check with life factors)
- [ ] K_A justified (motor + driven machine), K_Hβ from a shaft-deflection estimate, K_V with the real grade
- [ ] axial forces taken by the bearings (M4), shaft stresses (M3) with F_t, F_r, F_a
- [ ] lubrication: viscosity for v and load (scuffing / micropitting check in a full tool)

**Drawing**
- [ ] data block complete (6.6), allowances (DIN 3967), W_k and M_d with tolerances, grade, modifications
- [ ] heat treatment: hardness, CHD at 550 HV, core hardness, zones not to be hardened
- [ ] datum axis, runout of bore and faces, roughness of flank and root

**Manufacture / inspection**
- [ ] grinding stock and pre-grind W_k on the soft-stage drawing
- [ ] grinding-burn check, CHD cut section per batch, first-article gear measurement
- [ ] contact pattern in the housing, backlash measured

### 8.7 Common mistakes
- Using the DIN tip-load form factor Y_Fa (≈ 2.8) with the ISO method-B formula (Y_F ≈ 1.5) – mixing methods.
- E = 210 000 instead of the ISO value 206 000 for Z_E (small, but the self-test checks 189.8).
- Rounding the module down (S_H falls with d₁²).
- Forgetting the thermal change of backlash or the housing deflection.
- Specifying grade 5 for a hobbed, unground, hardened gear (distortion makes it grade 8–9).
- W_k with k so large that W_k sin β_b exceeds the face width.
- Forgetting tip relief on heavily loaded gears → noise and early pitting at the tip.

### 8.8 Limits of the program
- ISO 6336 **simplified**: K_V by a method-C style formula, K_Hβ given (not computed from deflections), K_Hα = 1,
  life factors Z_NT, Y_NT = 1 (long life), Z_W = Z_X = Y_X = Y_δ = Y_R = 1, σ_Hlim / σ_Flim typical values.
- No scuffing (flash / integral temperature), micropitting, tooth flank fracture, internal gears, bevel or worm gears.
- ISO 1328 F_α, F_β, F_r are approximations – use the standard.
- For a certified design report use the full standard or a commercial tool and keep this program as the cross-check.

### 8.9 Standards
ISO 6336-1/-2/-3/-5:2019 (load capacity), ISO 6336-6 (variable load), ISO/TS 6336-20/-21/-22 (scuffing, micropitting),
ISO 21771:2007 (geometry), ISO 53 (basic rack), ISO 54 (modules), ISO 1328-1:2013 and ISO 1328-2 (accuracy), ISO 1340
(drawing data), DIN 3967 (backlash, allowances), DIN 3990 (old German method), DIN 3992 (profile shift), DIN 3966
(drawing data), ISO 2639 (CHD), ISO 14104 (grinding burns), AGMA 2001-D04 / 2101-D04 (US rating). Check current editions.

### 8.10 Books
Niemann / Winter: *Maschinenelemente* Vol. II (gears); Linke: *Stirnradverzahnung*; Radzevich: *Dudley's Handbook of
Practical Gear Design and Manufacture* (3rd ed.); Maitra: *Handbook of Gear Design*; Klocke / Brecher:
*Zahnrad- und Getriebetechnik*.

### 8.11 Glossary
| Term | Meaning |
|---|---|
| Base tangent length W_k | distance over k teeth measured with flat anvils; equals an arc on the base circle |
| Dimension over balls M_d | measurement over two balls in opposite tooth spaces |
| Tooth thickness allowance A_sn | planned thinning of the tooth (negative), gives backlash |
| Backlash j_n / j_t | gap between non-working flanks, normal / circumferential |
| Flank tolerance class | ISO 1328-1 accuracy grade 1 … 11 |
| f_pT, F_pT | single / cumulative pitch tolerance |
| Tip relief C_a | profile modification at the tip for smooth mesh entry |
| Crowning C_β | helix modification against edge loading |
| CHD | case hardening depth to 550 HV |
| Double-flank roll test | mesh with a master gear, measures centre-distance variation (F_i″, f_i″) |
| HPSTC | highest point of single tooth contact (load point of method B) |
| Hunting tooth | tooth numbers without common factor – every tooth meets every tooth |
